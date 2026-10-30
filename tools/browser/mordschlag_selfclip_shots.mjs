// 모르트슐라크 '팔이 내 머리를 뚫음' 화면 확인 (10/31 02:xx 사장님 '가까이서 보면 팔이 나의 머리를 뚫고 뒤로 갔다가 다시 적을 강타하는 것처럼 보여') — 읽기만
//  실제 게임 화면(844 × 390 · 테스트 경로 ?test=1 · 롱소드 독일 · 상대 꼭두각시 — 가만히 섬)에서: 상대를 가슴 사이 GAP 에 세우고(붙은 거리 · 'close' 규칙) 비기 창(금빛 '!')이 열리면
//  main.js 와 같은 길(playerSecret.fire → player.skill.secret)로 낸다. 시간은 가짜 시계(performance.now · rAF)로 손수 — 한 장마다 1/60 s 를 나아간 뒤 시간을 세운 채
//  눈 셋(옆 · 앞 3/4 · 뒤 어깨 너머 — 내 머리 가까이)을 그린다. 장마다 내 머리 기준 두 손 자리 · 팔 ↔ 머리 틈 · 'pull' 옮김 delta(몸 틀 앞 · 위 · 옆)를 _frames.json 에.
//  실행: node node_modules/vite/bin/vite.js --port 5187 --strictPort --host 127.0.0.1 &   (끝나면 그 PID 만 끈다)
//        node tools/browser/mordschlag_selfclip_shots.mjs http://127.0.0.1:5187 .tmp/mord_shots [끔 0 | 켬 1 — ?mordNoClip] [GAP 0.6] [덧 주소 인자 '&mordAt=0.45']
//        띠 그림: python3 tools/browser/mordschlag_selfclip_sheet.py .tmp/mord_shots
//  playwright 는 저장소 의존성에 없다(전역 — createRequire). 크롬 경로 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 저장소 밖(전역 NODE_PATH)의 playwright — ESM import 는 NODE_PATH 를 안 봄

const base = (process.argv[2] || 'http://127.0.0.1:5187').replace(/\/$/, '');
const dir = process.argv[3] || '.tmp/mord_shots';
const clip = process.argv[4] ?? '0';
const GAP = +(process.argv[5] ?? 0.6);
const extra = process.argv[6] ?? '';
const FOE = process.env.FOE ?? 'isolde';
const VIEWS = (process.env.VIEWS ?? 'side,q34,back').split(',');
const STEP_MS = 1000 / 60;
fs.mkdirSync(dir, { recursive: true });
const tag = `${clip === '1' ? 'clip' : 'now'}_${GAP}${process.env.TAG ? `_${process.env.TAG}` : ''}`;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  // 가짜 시계: __manual 이 꺼져 있으면 실제 시간 · 켜면 __adv 로만 나아감 (rAF 는 그대로 돌고 시간 차 0 이면 물리 스텝 없이 그리기만)
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__manual = false;
  const clock = () => { const t = pn(); if (!window.__manual) acc += t - last; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
  window.__frame = (ms) => new Promise((res) => { acc += ms; raf(() => raf(() => res())); }); // 게임 프레임 하나(ms 나아감) + 그 뒤 그리기 하나(0 ms)
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console ${m.text()}`));
await page.goto(`${base}/?test=1&weapon=longsword&foe=${FOE}&stage=castle&slowMo=0&skillNodes=all&mordNoClip=${clip}${extra}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
await page.getByText('여정 시작').click({ timeout: 60000 }).catch(() => {});
await page.waitForFunction(() => window.game.state === 'fight' && !!window.game.playerSecret, null, { timeout: 180000 });
await page.waitForFunction(() => window.game?.stats?.simTime > 4.5, null, { timeout: 400000 }); // 판 시작 정지가 끝난 뒤
await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 60000 }).catch(() => {});
const info = await page.evaluate((GAP) => {
  const g = window.game, T = g.THREE;
  g.settings.fpsCap = false;
  window.__manual = true;
  g.ai.update = () => g.enemy.move.set(0, 0);
  const p = g.player, e = g.enemy;
  p.move.set(0, 0);
  // 상대를 가슴 사이 GAP 에 (내 앞 · 몸 · 닻 · 걸음 자리 같이 옮김 — redondo_motion_shots.mjs 와 같은 꼴) · 창이 열린 뒤 내기 바로 전에도 다시 (2 s 붙어 있는 동안 몸이 다가옴)
  window.__place = (gap) => {
    const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
    let fx = ec.x - pc.x, fz = ec.z - pc.z;
    const L0 = Math.hypot(fx, fz);
    const fw = L0 > 0.05 ? { x: fx / L0, z: fz / L0 } : p.forward();
    const dx = pc.x + fw.x * gap - ec.x, dz = pc.z + fw.z * gap - ec.z;
    for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
    const at = e.anchor.translation();
    e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
    if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]?.isVector3) { l[key].x += dx; l[key].z += dz; } }
  };
  { const pc = p.bodies.chest.translation(), fw = p.forward(), ec = e.bodies.chest.translation(); const dx = pc.x + fw.x * GAP - ec.x, dz = pc.z + fw.z * GAP - ec.z;
    for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
    const at = e.anchor.translation(); e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
    if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]?.isVector3) { l[key].x += dx; l[key].z += dz; } } }
  // 재기 (읽기만): 내 머리 기준 몸 틀(길을 짠 yaw — secret_instant.js comboPlanMord 와 같은 틀)
  const V = (q) => new T.Vector3(q.x, q.y, q.z), Q = (r) => new T.Quaternion(r.x, r.y, r.z, r.w);
  const segDist = (A, B, P) => { const ab = B.clone().sub(A); const t = Math.max(0, Math.min(1, P.clone().sub(A).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return A.clone().addScaledVector(ab, t).distanceTo(P); };
  const CAPS = { uarmS: [0.105, 0.045, 'x'], farmS: [0.095, 0.04, 'x'], uarmO: [0.105, 0.045, 'y'], farmO: [0.095, 0.04, 'y'] };
  window.__meas = () => {
    const I = p.iai;
    const yaw = I?.yaw ?? p.yaw;
    const yi = yaw.clone().invert();
    const hd = V(p.bodies.head.translation()), c = V(p.bodies.chest.translation());
    const L = (w) => w.clone().sub(hd).applyQuaternion(yi);
    const wS = new T.Vector3(0.13, 0, 0).applyQuaternion(Q(p.bodies.farmS.rotation())).add(V(p.bodies.farmS.translation()));
    const wO = new T.Vector3(0, -0.13, 0).applyQuaternion(Q(p.bodies.farmO.rotation())).add(V(p.bodies.farmO.translation()));
    let arm = Infinity, part = null;
    for (const [k, [h, rad, ax]] of Object.entries(CAPS)) {
      const b = p.bodies[k], a = new T.Vector3(ax === 'x' ? h : 0, ax === 'y' ? h : 0, 0).applyQuaternion(Q(b.rotation())), m = V(b.translation());
      const gp = segDist(m.clone().sub(a), m.clone().add(a), hd) - (p.headR ?? 0.1) - rad;
      if (gp < arm) { arm = gp; part = k; }
    }
    const sq = Q(p.sword.rotation()), sp = V(p.sword.translation());
    const grip = new T.Vector3(0, p.mordGrip ? p.mordGrip.g : 0, 0).applyQuaternion(sq).add(sp), pom = new T.Vector3(0, -0.15, 0).applyQuaternion(sq).add(sp);
    const hilt = segDist(grip, pom, hd) - (p.headR ?? 0.1) - 0.02;
    const s0 = I?.segs?.[0]?.B, sh = I?.segs?.find((sg) => sg.B.back)?.B;
    const delta = I?.mord && s0 && sh && !I.mordBacked ? s0.H.clone().sub(sh.H) : null;
    const r3 = (x) => +x.toFixed(3);
    const v3 = (v) => [r3(v.x), r3(v.y), r3(v.z)];
    return {
      t: r3(g.stats.simTime), sec: p.skill.sec?.stage ?? p.skill.secretPhase ?? null, open: !!g.playerSecret.open, d: r3(p.foeDistance()),
      ph: I?.mord ? (I.segs[I.si]?.B?.back ? 'back' : I.segs[I.si]?.cut ? 'cut' : 'wind') : null,
      wristS: v3(L(wS)), wristO: v3(L(wO)), arm: r3(arm), armPart: part, hilt: r3(hilt), handHead: r3(Math.min(wS.distanceTo(hd), wO.distanceTo(hd))),
      delta: delta ? v3(delta) : null, pullD: I?.mord?.pullD != null ? r3(I.mord.pullD) : null, myChestMoved: r3(c.distanceTo(window.__c0 ?? c)),
      hits: g.stats.hits.length, foe: e.state, result: p.instantResult?.mord ? { hit: p.instantResult.hit, part: p.instantResult.part, wPart: p.instantResult.wPart, E: r3(p.instantResult.energy ?? 0), clip: p.instantResult.clip ?? null } : null,
    };
  };
  // 눈: 내 머리 가까이 (좁은 화각 32° — 게임 카메라 화각은 되돌림): side = 왼쪽 옆 · q34 = 앞 왼쪽 60°(상대 몸에 안 가리게) · back = 뒤 오른쪽 어깨 너머(게임 카메라 쪽 가까이)
  const fov0 = g.camera.fov;
  window.__camOff = () => { g.camera.fov = fov0; g.camera.updateProjectionMatrix(); g.freeCam = false; };
  window.__cam = (view) => {
    const hd = V(p.bodies.head.translation()), ec2 = e.bodies.chest.translation();
    let fx = ec2.x - hd.x, fz = ec2.z - hd.z;
    const Lf = Math.hypot(fx, fz) || 1;
    fx /= Lf; fz /= Lf;
    const lx = fz, lz = -fx; // 왼쪽
    g.freeCam = true;
    g.camera.fov = 32;
    g.camera.updateProjectionMatrix();
    const at = (a, b, up) => ({ x: hd.x + fx * a + lx * b, y: hd.y + up, z: hd.z + fz * a + lz * b });
    let P0, T0;
    if (view === 'side') { P0 = at(0.3, 2.6, 0.05); T0 = at(0.3, 0, -0.12); }
    else if (view === 'q34') { const a = Math.PI / 3; P0 = at(Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.35); T0 = at(0.05, 0, -0.1); }
    else { P0 = at(-1.9, -0.55, 0.45); T0 = at(0.35, 0, -0.12); }
    g.camera.position.set(P0.x, P0.y, P0.z);
    g.camera.lookAt(T0.x, T0.y, T0.z);
  };
  window.__c0 = V(p.bodies.chest.translation());
  return { gap: GAP, d: p.foeDistance(), S: g.playerSecret.S?.name, noClip: g.config.SECRET.mord.noSelfClip, at: g.config.SECRET.mord.at, track: g.config.SECRET.mord.track };
}, GAP);
console.log(JSON.stringify(info));
const frames = [];
const step = async () => { await page.evaluate((ms) => window.__frame(ms), STEP_MS); return page.evaluate(() => window.__meas()); };
// 비기 창을 기다림 (가슴 사이 ≤ 0.8 m 로 2 s — 'close' 규칙)
let r = await step();
for (let i = 0; i < 400 && !r.open; i++) r = await step();
console.log(`창 ${r.open} · 가슴 사이 ${r.d} · t ${r.t}`);
let fired = false;
if (r.open) {
  await page.evaluate((gap) => window.__place(gap), GAP);
  await page.evaluate(() => window.__frame(0));
  fired = await page.evaluate(() => { const g = window.game; const o = g.playerSecret.fire(); return !!(o && g.player.skill.secret(o)); });
}
console.log(`냄 ${fired}`);
const shots = [];
let n = 0;
const shoot = async (m) => {
  const k = String(n++).padStart(3, '0');
  for (const v of VIEWS) {
    await page.evaluate((v) => window.__cam(v), v);
    await page.evaluate(() => window.__frame(0));
    await page.screenshot({ path: `${dir}/${tag}_${v}_${k}.png`, timeout: 180000 });
  }
  shots.push({ k, ...m });
};
if (fired) {
  let lastT = null, after = 0;
  for (let i = 0; i < 120 && after < 3; i++) {
    r = await step();
    frames.push(r);
    if (!r.ph && shots.some((s) => s.ph)) after++;
    if (r.t !== lastT && (r.ph === 'cut' || r.ph === 'wind' || (r.ph === 'back' && i % 2 === 0) || (!r.ph && after > 0))) await shoot(r); // 준비 · 내리침은 1/60 s 마다 · 다시 세우기는 1/30 s · 멈칫(같은 시각)은 건너뜀
    lastT = r.t;
  }
}
await page.evaluate(() => window.__camOff());
const summary = { info, tag, fired, minArm: Math.min(...frames.filter((f) => f.ph).map((f) => f.arm)), minHilt: Math.min(...frames.filter((f) => f.ph).map((f) => f.hilt)), minHandHead: Math.min(...frames.filter((f) => f.ph).map((f) => f.handHead)), deepestBehind: Math.min(...frames.filter((f) => f.ph).map((f) => Math.min(f.wristS[0], f.wristO[0]))), result: frames.findLast((f) => f.result)?.result ?? null, errors };
fs.writeFileSync(`${dir}/${tag}_frames.json`, JSON.stringify({ summary, shots, frames }, null, 1));
console.log(JSON.stringify(summary));
await browser.close();
