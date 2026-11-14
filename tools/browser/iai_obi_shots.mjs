// 帯刀 칼집 브라우저 확인 (11/14 — src/iai_obi.js · docs/strike/iai_obi_2026-11-14.md): 한 몸(상대 자리 — ?foe= 인물 · 칼)을 동작마다 세우고
//  물리를 멈춘 채 앞 · 옆(왼 — 칼집 쪽) · 뒤 · 위 네 방향에서 찍는다. 동작: 서기 · 걷기 · 달리기 · 낮은 걸음(웅크린 발도 대기로 옆걸음) · 발도 대기 · 뽑는 순간 · 잔심(굳음) ·
//  다시 쥐기 · 밀치기 묶임(맞닿아 미는 거리) · 맞음(가슴에 친 힘) · 넘어짐 · 쓰러져 죽음(라그돌). 상대 AI 는 끄고 이 도구가 스텝마다 몸을 몬다(ai.update 바꿔치기 — 그 스텝 안에서 멈춤).
//  실행: 이 worktree 에서 개발 서버(npx vite --port 5181 --strictPort) 를 띄운 뒤
//    node tools/browser/iai_obi_shots.mjs http://127.0.0.1:5181 <출력 폴더> <인물 id | default> <무기 id> [동작,…] [주소 덧붙임 예 iaiObi=0] [파일 이름 붙임 예 before]
//  출력: <폴더>/<인물>_<무기>_<동작>_<front|side|back|top>.png (480×480) + <폴더>/<인물>_<무기>.json (동작마다 멈춘 때 몸 · 칼집 값)
//  11/14 (기록 §13): 동작 noto@0.2 = 납도(SECRET.iaiSheathe) 시작 뒤 0.2 실제 초에 멈춤 (AI 몸 셈 iaiReadyPose · 사람 몸이면 허리 대기 iaiReadyPosePlayer) · noto 는 납도 뒤 대기 0.3 s ·
//   drawH@0.3 = 사람 허리 대기에서 낸 발도(requestIai player)를 길 몫 0.3 에서 · draw@0.3 도 같은 꼴 (AI 발도).
//   환경 OBI_SET='{"iaiObiSayaAxis":{"yaw":-121,"el":-15},…}' = 찍기 전 SECRET 을 바꿈(전 판 그림 — 사게오 매는 자리도 다시 셈) ·
//   OBI_VIEWS=front,side,top = 찍을 방향만 · OBI_FIT=1 = 칼끝 · 칼집 입이 다 들게 당겨 찍음 (11/14 납도 고른 밀도 그림) · OBI_DIST=1.9 = 사진기 거리(몸 전체)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 전역 playwright (NODE_PATH) — 설치하지 않음
const base = (process.argv[2] || 'http://127.0.0.1:5181').replace(/\/$/, '');
const out = process.argv[3] || '.tmp/obi/shots';
const who = process.argv[4] || 'minami';
const weapon = process.argv[5] || 'uchigatana';
const ALL = ['stand', 'walk', 'run', 'lowwalk', 'ready', 'draw', 'zanshin', 'regrip', 'clinch', 'hit', 'fall', 'dead'];
const states = (process.argv[6] || ALL.join(',')).split(',');
const SET = process.env.OBI_SET ? JSON.parse(process.env.OBI_SET) : null; // 전 판 그림 — 찍기 전 SECRET 바꿈
const extra = process.argv[7] ? `&${process.argv[7]}` : '';
const tag = process.argv[8] ? `${who}_${process.argv[8]}` : who; // 파일 이름 앞 (전 판을 따로 찍을 때 — 예 before)
const VIEWS = process.env.OBI_VIEWS ? process.env.OBI_VIEWS.split(',') : null; // 11/14: 찍을 방향만 (예 front,side,top)
const FIT = process.env.OBI_FIT === '1'; // 11/14: 칼끝 · 칼집 입이 다 들게 당겨 찍음 (그림 11)
const DIST = +(process.env.OBI_DIST ?? 1.45); // 11/14: 사진기 거리 m (그림 12 — 몸 전체)
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
let page = null;
const nextFrames = (n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
async function openPage() {
page = await browser.newPage({ viewport: { width: 480, height: 480 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const foeQ = who === 'player' ? 'foe=minami' : `foe=${who}`;
await page.goto(`${base}/?stage=arena&${foeQ}&weapon=${who === 'player' ? weapon : 'longsword'}&foeWeapon=${who === 'player' ? 'longsword' : weapon}&emo=0${extra}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 900000 });
await page.getByText('여정 시작').click({ timeout: 600000 });
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 900000 });
await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
// 몸 몰기 고리: 스텝마다 (ai.update 자리) — 상태 기계는 window.__obi
await page.evaluate(async ({ subj, SET }) => {
  const g = window.game;
  const SI = await import('/src/secret_instant.js');
  const O = await import('/src/iai_obi.js');
  const C = await import('/src/config.js');
  if (SET) { Object.assign(C.SECRET, SET); for (const f of [g.player, g.enemy]) if (f.obiSaya?.cord) f.obiSaya.cord.A = null; } // 전 판 (사게오 매는 자리 다시 셈)
  const S = (window.__obi = { mode: 'stand', t: 0, frozen: false, want: null, info: null, SI, O });
  const F = subj === 'player' ? g.player : g.enemy;
  const other = subj === 'player' ? g.enemy : g.player;
  S.F = F;
  for (const m of other.meshes) m.group.visible = false;
  if (other.swordGroup) other.swordGroup.visible = false;
  const realStep = g.world.step.bind(g.world);
  S.freeze = () => { S.frozen = true; g.world.step = () => {}; };
  S.thaw = () => { S.frozen = false; g.world.step = realStep; };
  const T = g.THREE;
  const pelv = () => F.bodies.pelvis.translation();
  g.ai.update = (dt) => {
    if (S.frozen) return;
    S.t += dt;
    const m = S.mode;
    if (subj !== 'player') { F.move.set(0, 0); F.handOffset.set(0, 0); }
    if (m === 'walk') F.move.set(0, 0.45);
    else if (m === 'run') F.move.set(0, 1);
    else if (m === 'back') F.move.set(0, -0.6);
    else if (m === 'noto') { // 납도 (11/14 — SECRET.iaiSheathe): 몫 = 지난 초 ÷ 납도 초 · 다 차면 대기 (사람 몸이면 허리 대기)
      const X = C.SECRET.iaiSheathe || 1e-6;
      const sh = S.t / X;
      if (subj === 'player') SI.iaiReadyPosePlayer(F, sh >= 1, false, dt, true, sh < 1 ? sh : 0);
      else SI.iaiReadyPose(F, sh >= 1, dt, sh < 1 ? sh : 0);
    } else if (m === 'drawH') { if (!S.fired) { SI.iaiReadyPosePlayer(F, true, false, dt, true); if (S.t > 1.2 && !F.iai && !F.iaiReq) { SI.requestIai(F, { player: true }); S.fired = true; } } }
    else if (m === 'lowwalk') { SI.iaiReadyPose(F, true, dt); F.move.set(0.55, 0); }
    else if (m === 'ready') SI.iaiReadyPose(F, true, dt);
    else if (m === 'draw' || m === 'zanshin' || m === 'regrip') {
      if (!S.fired) { SI.iaiReadyPose(F, true, dt); if (S.t > 1.2 && !F.iai && !F.iaiReq) { SI.requestIai(F, {}); S.fired = true; } }
    } else if (m === 'clinch') {
      F.move.set(0, F.foeDistance() > 1.0 ? 1 : 0.8); // 멀면 달려 다가감
      // 두 칼 부딪힘을 끔 — 칼끝이 상대 몸 · 칼에 걸려 1.4 m 에서 멈추지 않고 몸끼리 맞닿게 (이 도구만 · 상대는 숨긴 몸)
      if (!S.noSw) { for (const w of [other.sword, F.sword]) for (let i = 0; w && i < w.numColliders(); i++) w.collider(i).setCollisionGroups(0); S.noSw = true; }
    }
    if (m !== 'noto' && m !== 'drawH' && m !== 'lowwalk' && m !== 'ready' && !((m === 'draw' || m === 'zanshin' || m === 'regrip') && !S.fired)) SI.iaiReadyPose(F, false, dt); // 대기가 아닌 동작은 발도 대기를 풂 (게임 AI 와 같이)
    if (m === 'hit') { if (!S.fired && S.t > 0.4) { const c = F.bodies.chest; const p = c.translation(); const o = other.bodies.chest.translation(); const d = new T.Vector3(p.x - o.x, 0, p.z - o.z).normalize(); c.applyImpulseAtPoint({ x: d.x * 70, y: 0, z: d.z * 70 }, { x: p.x, y: p.y + 0.1, z: p.z }, true); S.fired = S.t; } }
    else if (m === 'fall') { if (!S.fired && S.t > 0.3) { F.knockDown(true); S.fired = S.t; } }
    else if (m === 'dead') { if (!S.fired && S.t > 0.3) { F.die('obi-test', true); S.fired = S.t; } }
    else if (m === 'deadR' || m === 'deadL') { // 옆으로 밀어 쓰러뜨린 죽음 (오른 = 칼집 쪽이 위로 누움 · 왼 = 칼집 쪽이 땅)
      if (!S.fired && S.t > 0.3) {
        const c = F.bodies.chest; const p = c.translation(); const o = other.bodies.chest.translation();
        const fw = new T.Vector3(o.x - p.x, 0, o.z - p.z).normalize(); const lf = new T.Vector3(0, 1, 0).cross(fw).multiplyScalar(m === 'deadL' ? 1 : -1);
        c.applyImpulseAtPoint({ x: lf.x * 70, y: 0, z: lf.z * 70 }, { x: p.x, y: p.y + 0.1, z: p.z }, true);
        F.die('obi-test', true); S.fired = S.t;
      }
    }
    // 멈출 때
    const W = S.want;
    let stop = false;
    if (m === 'stand' || m === 'ready') stop = S.t > 1.6;
    else if (m === 'walk' || m === 'run' || m === 'lowwalk') stop = S.t > 1.1;
    else if (m === 'draw' || m === 'drawH') stop = !!F.iai && F.iai.u >= (W ?? 0.3);
    else if (m === 'noto') stop = S.t >= (W != null ? W * (C.SECRET.iaiSheathe / 0.6) : C.SECRET.iaiSheathe + 0.3); // W = 실제 초 (납도 0.6 실제 초 기준 몫)
    else if (m === 'zanshin') stop = F.iaiHoldT > 0 && (S.holdT = (S.holdT ?? 0) + dt) > 0.15;
    else if (m === 'regrip') stop = F.iaiRegripT > 0 && 1 - F.iaiRegripT / F.iaiRegripDur >= (W ?? 0.3);
    else if (m === 'clinch') { if (S.touch == null && F.foeDistance() < 0.5) S.touch = S.t; stop = (S.touch != null && S.t - S.touch > 0.5) || S.t > 12; } // 맞닿아 밀고 0.5 s
    else if (m === 'hit') stop = S.fired && S.t - S.fired > 0.12;
    else if (m === 'fall') stop = S.fired && S.t - S.fired > 1.8;
    else if (m === 'dead' || m === 'deadR' || m === 'deadL') stop = S.fired && S.t - S.fired > 1.5; // 판 끝(죽고 3.5 s) 뒤 결과 창 · 쪽이 바뀌기 전에 멈춤
    if (stop) {
      const p = pelv();
      const sp = F.obiSaya ? O.obiSayaPose(F) : null;
      S.info = { mode: m, t: +S.t.toFixed(3), noto: F.noto ? { w: F.noto.w, p: +F.noto.p.toFixed(3) } : null, state: F.state, pelvisY: +p.y.toFixed(3), iaiU: F.iai?.u ?? null, holdT: F.iaiHoldT, rg: F.iaiRegripT > 0 ? 1 - F.iaiRegripT / F.iaiRegripDur : null, sayaW: F.iaiSayaW ?? 0, obiW: F.iaiObiW ?? 0, saya: sp && { k: +sp.k.toFixed(3), follow: +sp.follow.toFixed(3) }, hasSaya: !!F.obiSaya, foeD: +F.foeDistance().toFixed(3) };
      S.freeze();
    }
  };
}, { subj: who === 'player' ? 'player' : 'enemy', SET });
}
await openPage();

async function shoot(state) {
  await page.setViewportSize({ width: 96, height: 96 }); // 도는 동안은 작은 화면 (소프트웨어 그리기가 느려 게임 시간이 늦게 감 — 찍을 때만 크게)
  await page.evaluate((st) => { const S = window.__obi; const [m, w] = st.replace(/^-/, '').split('@'); S.mode = m; S.want = w != null ? +w : null; S.t = 0; S.fired = false; S.holdT = 0; S.touch = null; S.info = null; S.thaw(); }, state);
  await page.waitForFunction(() => !window.__obi || window.__obi.frozen, null, { timeout: 900000, polling: 200 });
  if (!(await page.evaluate(() => !!window.__obi))) throw new Error('쪽이 다시 읽힘 (개발 서버 고침) — 새로 열어 다시');
  const info0 = await page.evaluate(() => window.__obi.info);
  if (state.startsWith('-')) return info0; // '-stand' = 몰기만 (찍지 않음 — 다음 동작을 서기에서 시작하게)
  await page.setViewportSize({ width: 480, height: 480 });
  await nextFrames(4);
  const info = info0;
  for (const [view, cam] of [['front', [0, 0.2, 1.45]], ['side', [-1, 0.2, 0]], ['back', [Math.PI, 0.2, 1.45]], ['top', [0, 1.45, 0.25]]].filter(([v]) => !VIEWS || VIEWS.includes(v))) {
    await page.evaluate(([view, cam, fit, dist0]) => {
      const g = window.game, T = g.THREE, F = window.__obi.F;
      const c = F.bodies.pelvis.translation();
      const fw = new T.Vector3(1, 0, 0).applyQuaternion(F.yaw ?? new T.Quaternion()).setY(0).normalize();
      const left = new T.Vector3(0, 1, 0).cross(fw).normalize(); // 몸 왼쪽 (y × 앞)
      g.freeCam = true;
      let at = new T.Vector3(c.x, Math.max(0.35, c.y + 0.02), c.z);
      let d = dist0;
      if (fit && F.obiSaya?.g) {
        // 11/14 (그림 11): 칼끝 · 칼집 입(鯉口 — 칼집 틀 원점)이 다 들게 당겨 찍음 — 가운데 = 둘의 가운데 · 거리 = 둘 사이 + 0.3 m 가 화면 높이의 80 %
        const tip = F.bladePoint(1, new T.Vector3());
        const koi = F.obiSaya.g.getWorldPosition(new T.Vector3());
        at = tip.clone().add(koi).multiplyScalar(0.5);
        const fov = ((g.camera.fov ?? 50) * Math.PI) / 180;
        d = Math.max(0.55, Math.min(1.6, (tip.distanceTo(koi) + 0.3) / 0.8 / 2 / Math.tan(fov / 2)));
      }
      if (view === 'side') g.camera.position.copy(at).addScaledVector(left, d).setY(at.y + 0.2 * (d / 1.45));
      else if (view === 'top') { const hy = F.bodies.head ? F.bodies.head.translation().y + 0.3 : 0; g.camera.position.copy(at).addScaledVector(fw, cam[2] * (d / 1.45)).setY(Math.max(at.y + d, hy)); } // 위: 머리 위에서 (당겨 찍어도 머리가 가리지 않게)
      else g.camera.position.copy(at).addScaledVector(fw.clone().applyAxisAngle(new T.Vector3(0, 1, 0), cam[0]), d).setY(at.y + cam[1] * (d / 1.45));
      g.camera.lookAt(at);
    }, [view, cam, FIT, DIST]);
    await nextFrames(3);
    await page.screenshot({ path: `${out}/${tag}_${weapon}_${state}_${view}.png` });
  }
  await page.evaluate(() => (window.game.freeCam = false));
  return info;
}
const infos = {};
for (const st of states) {
  for (let tryN = 0; tryN < 2; tryN++) {
    try {
      infos[st] = await shoot(st);
      console.log(st, JSON.stringify(infos[st]));
      break;
    } catch (e) {
      console.log(st, 'FAIL', String(e).split('\n')[0].slice(0, 160));
      infos[st] = { fail: String(e).split('\n')[0].slice(0, 160) };
      // 그리기 프로세스가 죽으면(메모리 — 여러 작업이 한 기계에서 돎) 새 쪽으로 다시 열고 그 동작을 한 번 더
      await page.close().catch(() => {});
      await openPage();
    }
  }
}
fs.writeFileSync(`${out}/${tag}_${weapon}.json`, JSON.stringify({ who, weapon, extra, infos, errors }, null, 1));
await browser.close();
console.log(who, weapon, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
