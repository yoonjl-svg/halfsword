// 이베리아 휘감아 돌기 스틱 판 브라우저 확인 · 연속 그림 (10/23 — src/stick_turn.js · secret.js spinStick · main.js stickGo · src/iberian_spin.js · docs/strike/iberian_spin_2026-10-22.md §10 · §11). 읽기만.
//  테스트 경로(모든 칸)로 츠바이핸더를 들고, 상대 AI 를 멈춰 내 앞 칼끝 거리 + GAP 자리로 옮긴다 → 무장(내 머리 위 금색 '!' · 금색 화면 테두리) →
//   ① 무장 동안 칼 쪽 화면을 톡 → 보통 찌르기가 나가고 휘감아 돌기는 안 나가는지
//   ② 다시 무장 → 왼쪽 아래 이동 스틱을 손가락으로 원 그리듯 반시계로 돌림(터치 포인터 — TURN° 를 게임 시간 DUR 초에) → 몸이 왼쪽으로 도는지 · 연속 그림
//   ③ 다시 무장 → 같은 몸짓을 시계로 → 몸이 오른쪽으로(칼 든 쪽이 오른쪽이면 반대로 — 레베스) 도는지 · 연속 그림
//   ④ (② 앞에서) 다시 무장 → 키보드 W → W+D → D → D+S → S (이웃한 방향키 차례 — 시계) → 나가는지
//  연속 그림 = 무장 · 몸짓 가운데 · 돌기 ½ · 대본 끝(받아 멈춤) · 끝난 뒤 0.4 · 1.0 s (굳음 1.3 s 안 — 게임 카메라 + 옆 카메라 두 줄) → 띠 그림 JPEG (방향마다).
//  비기 잔상(10/23 — 칼을 놓은 뒤 가로지르는 몫, sword_trail.js 비기 색 호)이 그림에 남는다(화면 시계를 세운 동안 옅어지지 않음). 견줌: Q=ibTrail=all TAG=…
//  화면 시계를 늦춰(requestAnimationFrame · performance.now 를 __timeK 배 — 게임 코드는 그대로) 소프트웨어 GL 에서도 몸짓 동안 프레임이 촘촘하게 한다(게임 시간으로 잼).
//  실행 (저장소 뿌리에서): npx vite --port 5417 --strictPort &
//        node tools/browser/iberian_stick_shots.mjs http://127.0.0.1:5417 [그림 폴더 (기본 docs/handoff/iberian_spin)]
//        FOE=인물 id (기본 isolde) · GAP=칼끝 거리 밖 몫 (기본 0.3 m) · TURN=° (기본 220) · DUR=게임 초 (기본 0.45) · NOSHOT=1 찍지 않고 확인만 ·
//        Q=주소에 더할 것 (예 ibTorso=0&ibSettle=0 — 전 판 그림) · TAG=그림 이름 꼬리 (기본 zweihander) · DIRS=ccw|cw (그 쪽만) · SKIPKEY=1 (키보드 확인 건너뜀)
//  끝 코드 0 = 확인 모두 맞음 · 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] || 'http://127.0.0.1:5417';
const dir = process.argv[3] || 'docs/handoff/iberian_spin';
const TURN = +(process.env.TURN ?? 220);
const DUR = +(process.env.DUR ?? 0.45);
const GAP = +(process.env.GAP ?? 0.3);
const NOSHOT = process.env.NOSHOT === '1';
const TAG = process.env.TAG || 'zweihander';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/?test=1&weapon=zweihander&foe=${process.env.FOE ?? 'isolde'}&stage=poseidon&slowMo=0${process.env.Q ? '&' + process.env.Q : ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 120000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.8, null, { timeout: 400000 });
await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
const info0 = await page.evaluate(() => {
  const g = window.game, p = g.player, e = g.enemy;
  g.settings.fpsCap = false;
  g.ai.update = () => e.move.set(0, 0); // 멈춘 상대
  e.handOffset.set(0, -0.5);
  e.die = () => {}; // 그림용 과녁: 죽지 않음 (여러 번 낸다 — 판이 끝나면 창이 안 열린다)
  p.stamina.setInfinite?.(true); // 여러 번 낸다 — 기력이 바닥나면(탈진) 몸짓 셈이 비워진다(낼 수 없음 — 공격 입력과 같은 조건). 기력은 이 확인의 대상이 아님
  for (let i = 0; i < e.sword.numColliders(); i++) e.sword.collider(i).setCollisionGroups(0); // 그림용 과녁 (iberian_spin_shots.mjs 와 같음)
  // 재기: 몸짓 셈 · 비기 단계 · 몸 방향 (읽기만)
  const W = g.playerSecret;
  const rec = (window.__rec = []);
  const step0 = p.step.bind(p);
  p.step = (dt) => {
    step0(dt);
    const S = p.ibSpin;
    rec.push({ t: g.stats.simTime, ex: p.stamina.exhausted, feet: !!(p.gait?.legs?.F?.stance || p.gait?.legs?.B?.stance), open: W.open?.ctx?.ev ?? null, turn: W.turn?.turn ?? 0, sec: p.skill.sec?.stage ?? null, spin: !!S, settle: !!S?.settle, q: S ? S.q : null, dir: S ? S.dir : null, ws: S ? S.ws : null, tap: !!p.skill.tap, h: p.heading });
  };
  return { S: W.S?.name, input: g.config.SECRET.ibSpin.input, reach: p.swordArt.measure.reach, side: p.side };
});
console.log(`비기 ${info0.S} · 조작 ${info0.input} · 칼끝 거리 ${info0.reach.toFixed(2)} m · 칼 든 쪽 ${info0.side}`);
// 상대를 내 앞 칼끝 거리 + GAP 자리로 (몸 · 닻 · 딛은 자리를 함께 평행 이동 — iberian_spin_shots.mjs 와 같음)
const place = () => page.evaluate((want) => {
  const g = window.game, p = g.player, e = g.enemy;
  const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
  const fw = p.forward();
  const dx = pc.x + fw.x * want - ec.x, dz = pc.z + fw.z * want - ec.z;
  for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
  const at = e.anchor.translation();
  e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
  if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]) { l[key].x += dx; l[key].z += dz; } }
}, info0.reach + GAP);
await place();
const st = () => page.evaluate(() => { const g = window.game, p = g.player, W = g.playerSecret; return { t: g.stats.simTime, d: p.foeDistance(), open: W.open?.ctx?.ev ?? null, turn: +((W.turn?.turn ?? 0) * 180 / Math.PI).toFixed(0), sec: p.skill.sec?.stage ?? null, spin: !!p.ibSpin, q: p.ibSpin ? +p.ibSpin.q.toFixed(2) : null }; });
const waitArm = async () => {
  await page.evaluate(() => (window.__timeK = 1));
  await page.waitForFunction(() => !window.game.player.skill.sec, null, { timeout: 60000, polling: 200 });
  await place(); // 비기 · 찌르기 뒤 다시 칼끝 거리 + GAP 자리로
  await page.waitForFunction(() => window.game.playerSecret.open?.ctx?.ev === 'spin' && !window.game.player.skill.sec, null, { timeout: 240000, polling: 200 });
};
let shots = [];
const shoot = async (k, label) => {
  const s = await st();
  shots.push({ k, label, ...s });
  console.log(`SHOT ${k} ${label} · 창 ${s.open} · 셈 ${s.turn}° · 단계 ${s.sec} · 진행 ${s.q ?? '-'} · 상대 가슴 ${s.d.toFixed(2)} m`);
  if (NOSHOT) return;
  const k0 = await page.evaluate(() => { const k = window.__timeK; window.__timeK = 0.003; return k; });
  await page.screenshot({ path: `${dir}/_g${k}.png` });
  await page.evaluate(() => {
    // 옆 카메라 (싸움 줄의 왼쪽 옆 · 조금 위 — iberian_spin_shots.mjs 와 같은 자리)
    const g = window.game, f = g.player, o = g.enemy;
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    g.freeCam = true;
    g.camera.position.set(mx + fz * 3.6, 2.6, mz - fx * 3.6);
    g.camera.lookAt(mx, 0.9, mz);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/_s${k}.png` });
  await page.evaluate(() => (window.game.freeCam = false));
  await page.evaluate((k) => (window.__timeK = k), k0);
};
const strip = (name) => {
  if (NOSHOT || !shots.length) return;
  fs.writeFileSync(`${dir}/_shots.json`, JSON.stringify({ shots }, null, 1));
  const py = `
import sys, json
from PIL import Image, ImageDraw
d, name = sys.argv[1], sys.argv[2]
meta = json.load(open(d + '/_shots.json'))
rows = []
for kind in ('g', 's'):
    rows.append([Image.open(f"{d}/_{kind}{s['k']}.png").convert('RGB') for s in meta['shots']])
w, h = rows[0][0].size
sw, sh = w // 2, h // 2
cols = len(meta['shots'])
out = Image.new('RGB', (cols * sw, 2 * (sh + 18)), (16, 16, 16))
dr = ImageDraw.Draw(out)
for r, ims in enumerate(rows):
    for i, (im, s) in enumerate(zip(ims, meta['shots'])):
        x, y = i * sw, r * (sh + 18)
        out.paste(im.resize((sw, sh)), (x, y + 18))
        q = '-' if s['q'] is None else f"{s['q']:.2f}"
        dr.text((x + 4, y + 3), f"{s['k']}  q {q}  {s['sec'] or ''}  d {s['d']:.2f}", fill=(255, 214, 90))
out.save(f"{d}/{name}.jpg", quality=82, optimize=True)
`;
  execFileSync('python3', ['-c', py, dir, name]);
  for (const f of fs.readdirSync(dir)) if (f.startsWith('_')) fs.unlinkSync(`${dir}/${f}`);
  shots = [];
};
const checks = {};
const K = +(process.env.STICK_K ?? 0.1); // 몸짓 동안 화면 시계 배 (소프트웨어 GL 은 느려 프레임이 드물다 — 늦출수록 게임 시간에 표본이 촘촘)

// ① 무장 동안 톡 → 보통 찌르기
await waitArm();
const n0 = await page.evaluate(() => window.__rec.length);
await page.evaluate(async () => {
  const cv = document.getElementById('game');
  const o = { pointerId: 71, pointerType: 'touch', clientX: 640, clientY: 160, bubbles: true, isPrimary: true, button: 0 };
  cv.dispatchEvent(new PointerEvent('pointerdown', o));
  await new Promise((r) => setTimeout(r, 40));
  window.dispatchEvent(new PointerEvent('pointerup', o));
});
await page.waitForTimeout(2500);
const r1 = await page.evaluate((n) => window.__rec.slice(n), n0);
checks.tap = { thrust: r1.some((r) => r.tap), spin: r1.some((r) => r.spin) };
console.log(`① 톡: 보통 찌르기 ${checks.tap.thrust} · 휘감아 돌기 ${checks.tap.spin}`);

/** 스틱 원 그리기 (터치 — 노드에서 한 점씩) · sense +1 = 화면에서 반시계 · −1 = 시계. 무장 · 몸짓 가운데 · 돌기 ½ · 대본 끝 · 끝난 뒤 0.4 s 를 찍는다 */
async function stickSpin(sense, name) {
  await waitArm();
  await shoot(0, '무장');
  const n1 = await page.evaluate(() => window.__rec.length);
  const pad = await page.evaluate(() => { const r = document.getElementById('moveStick').getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const disp = (type, x, y) => page.evaluate(([type, x, y]) => document.getElementById('moveStick').dispatchEvent(new PointerEvent(type, { pointerId: 61, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: false, button: 0 })), [type, x, y]);
  const gt = () => page.evaluate(() => performance.now()); // 게임 시계 (늦춘 시계)
  const R = 36; // 손가락이 그리는 원 (px — 조이스틱 반지름 40 안)
  const a0 = 90; // 화면 위(앞)에서 시작
  const at = (a) => [pad.cx + R * Math.cos((a * Math.PI) / 180), pad.cy - R * Math.sin((a * Math.PI) / 180)];
  await page.evaluate((K) => (window.__timeK = K), K);
  await disp('pointerdown', pad.cx, pad.cy);
  for (let i = 1; i <= 3; i++) {
    await page.waitForTimeout(((0.02 / K) * 1000) | 0);
    await disp('pointermove', pad.cx, pad.cy - (R * i) / 3);
  }
  const t0 = await gt();
  let mid = false;
  for (;;) {
    const u = Math.min(1, ((await gt()) - t0) / (DUR * 1000));
    await disp('pointermove', ...at(a0 + sense * TURN * u));
    if (!mid && u >= 0.4) {
      mid = true;
      await shoot(1, '스틱 돌리는 중');
    }
    if (u >= 1) break;
    await page.waitForTimeout(6);
  }
  await page.waitForTimeout(((0.05 / K) * 1000) | 0);
  await disp('pointerup', ...at(a0 + sense * TURN));
  const fired = await page.waitForFunction(() => !!window.game.player.ibSpin, null, { timeout: 30000, polling: 'raf' }).then(() => true).catch(() => false);
  let res = { fired };
  if (fired) {
    await page.evaluate(() => (window.__timeK = 0.08));
    await page.waitForFunction(() => { const S = window.game.player.ibSpin; return !S || S.q >= 0.5; }, null, { timeout: 120000, polling: 'raf' });
    await shoot(2, '돌기 ½');
    await page.waitForFunction(() => { const S = window.game.player.ibSpin; return !S || S.settle || S.q >= 1; }, null, { timeout: 120000, polling: 'raf' });
    await shoot(3, '한 바퀴 끝');
    await page.waitForFunction(() => !window.game.player.ibSpin, null, { timeout: 120000, polling: 'raf' });
    const tE = await page.evaluate(() => window.game.stats.simTime);
    await page.waitForFunction((t) => window.game.stats.simTime >= t + 0.4, tE, { timeout: 120000, polling: 'raf' });
    await shoot(4, '끝난 뒤 0.4 s');
    await page.waitForFunction((t) => window.game.stats.simTime >= t + 1.0, tE, { timeout: 120000, polling: 'raf' });
    await shoot(5, '끝난 뒤 1.0 s (굳음)');
    const r = await page.evaluate((n) => window.__rec.slice(n), n1);
    const sp = r.filter((x) => x.spin);
    let turned = 0;
    for (let i = 1; i < sp.length; i++) turned += Math.atan2(Math.sin(sp[i].h - sp[i - 1].h), Math.cos(sp[i].h - sp[i - 1].h));
    res = { fired, dir: sp[0]?.dir ?? null, ws: sp[0]?.ws ?? null, turnedDeg: Math.round((turned * 180) / Math.PI) };
  }
  strip(name);
  console.log(`스틱 ${sense > 0 ? '반시계' : '시계'}: ${JSON.stringify(res)}`);
  return res;
}
// ④ 키보드 W → WD → D → DS → S (시계)
if (process.env.SKIPKEY !== '1') {
await waitArm();
const n2 = await page.evaluate(() => window.__rec.length);
await page.evaluate(async ({ K }) => {
  window.__timeK = K / 2; // 키 상태마다 프레임이 여럿 들게 (소프트웨어 GL — 한 상태를 건너뛰면 135° 로 읽혀 안 나간다)
  K /= 2;
  const wall = (s) => (s / K) * 1000;
  const kd = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  const ku = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
  const gap = wall(0.12); // 상태마다 0.12 s (게임) → 반 바퀴 0.48 s
  kd('KeyW'); await new Promise((r) => setTimeout(r, gap));
  kd('KeyD'); await new Promise((r) => setTimeout(r, gap));
  ku('KeyW'); await new Promise((r) => setTimeout(r, gap));
  kd('KeyS'); await new Promise((r) => setTimeout(r, gap));
  ku('KeyD'); await new Promise((r) => setTimeout(r, gap));
  ku('KeyS');
}, { K });
await page.waitForTimeout(1500);
const r3 = await page.evaluate((n) => window.__rec.slice(n), n2);
checks.key = { fired: r3.some((r) => r.spin), dir: r3.find((r) => r.spin)?.dir ?? null, maxTurn: Math.round((Math.max(0, ...r3.map((r) => r.turn)) * 180) / Math.PI), openSteps: r3.filter((r) => r.open === 'spin').length, steps: r3.length, exSteps: r3.filter((r) => r.ex).length, airSteps: r3.filter((r) => !r.feet).length };
console.log(`④ 키보드: ${JSON.stringify(checks.key)}`);
if (process.env.DEBUG) console.log(JSON.stringify(await page.evaluate(() => { const g = window.game, p = g.player, e = g.enemy, W = g.playerSecret; return { pState: p.state, eAlive: e.alive, eState: e.state, d: p.foeDistance(), arm: W.spinArm.armed, armT: W.spinArm.t, open: W.open?.ctx?.ev ?? null, S: !!W.S, sec: p.skill.sec?.stage ?? null, armed: p.armed, round: g.state }; })));
}
if (process.env.ONLY === 'key') { console.log('CHECKS ' + JSON.stringify(checks)); await browser.close(); process.exit(0); }
const DIRS = (process.env.DIRS ?? 'ccw,cw').split(','); // 그림만 다시: DIRS=cw (앞 판에 맞은 상대가 주저앉아 있지 않게 따로)
if (DIRS.includes('ccw')) checks.ccw = await stickSpin(1, `stick_ccw_${TAG}`);
if (DIRS.includes('cw')) checks.cw = await stickSpin(-1, `stick_cw_${TAG}`);

await page.evaluate(() => (window.__timeK = 1));

console.log('CHECKS ' + JSON.stringify(checks));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
const ok = process.env.DIRS || process.env.SKIPKEY ? Object.values(checks).every((c) => c.fired !== false) : checks.tap?.thrust && !checks.tap?.spin && checks.ccw?.fired && checks.cw?.fired && checks.ccw.dir !== checks.cw.dir && checks.key?.fired;
process.exit(errors.length || !ok ? 1 : 0);
