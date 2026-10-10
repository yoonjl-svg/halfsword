// 이탈리아 레이피어 자세 고증 (10/10 — guards.js ITALIAN_RAPIER, schools.js ITALIAN_WATCH) 캡처: AI 레이피어가 간 보는 자세를 하나씩 붙잡아 옆·앞·3/4 에서. 콘솔 에러 0.
//  docs/handoff/<PREFIX>_<자세>_{side,front,q34}.png (PREFIX 기본 rapier_guard — 전/후 비교는 PREFIX=rapier_guard_before 로 main 빌드에서)
//  GUARDS = 붙잡을 자세 이름(ai.school.guards 의 name, 쉼표) — 기본 이탈리아 다섯. 시험만: ai.pickGuard 를 그 자세로 고정하고 플레이어는 맞지 않게 한다.
//  자세마다 코등이 자리(칼 손 바로 앞 — 가슴 몸체 기준 앞·위·바깥 m, 땅에서 손 높이)·칼끝 올림각·방위(상대 쪽 0, 칼 든 쪽 +)·팔꿈치 굽힘·표 가장 가까운 자세 이름을 함께 적는다.
//  WEAPON = 찍을 무기(기본 rapier — 10/10 중국 자세 고증은 WEAPON=qinggang PREFIX=chinese_guard GUARDS=nebenR,langort,…).
//  PLAYER=1 이면 플레이어 레이피어 대기(손가락 없음 = 쉴 자세)도 같은 값을 잰다(캡처 player_rest).
//  실행: npx vite build && npx vite preview --port 4192 --strictPort &
//        node tools/browser/rapier_guard_shots.mjs http://127.0.0.1:4192 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4192';
const dir = process.argv[3] || '.';
const PREFIX = process.env.PREFIX || 'rapier_guard';
const WEAPON = process.env.WEAPON || 'rapier';
const NAMES = (process.env.GUARDS || 'pflugR,langort,pflugL,ochsR,tag').split(',').filter(Boolean);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
async function open(q, guardName) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.ai, null, { timeout: 60000 });
  await page.evaluate((nm) => {
    document.getElementById('techCue').style.visibility = 'hidden';
    const g = window.game;
    g.player.applyWound = () => {}; // 시험만: 판이 끝나지 않게
    if (nm) {
      const ai = g.ai;
      const G = ai.school.guards.find((x) => x.name === nm);
      if (G) {
        ai.pickGuard = () => G; // 시험만: 이 자세로 고정
        ai.guard = G;
      }
      ai.startAttack = () => {}; // 시험만: 치러 들지 않게 (간 보기만)
      if (ai.pers) ai.pers.aggr = 0;
    }
  }, guardName);
  return page;
}
const probe = (page, who) =>
  page.evaluate((who) => {
    const g = window.game;
    const f = g[who];
    const o = who === 'enemy' ? g.player : g.enemy;
    const q = (b) => { const r = b.rotation(); return [r.x, r.y, r.z, r.w]; };
    const applyQ = ([x, y, z, w], v) => {
      const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
      return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
    };
    const ct = f.bodies.chest.translation();
    const V = (a) => [a.x, a.y, a.z];
    const p0 = V(f.bladePoint(0)); // 코등이 자리 (칼 손 바로 앞)
    const p1 = V(f.bladePoint(1));
    // 몸 기준(자세표와 같은 틀): 앞 = 검객이 바라보는 쪽(heading), 위 = 땅 위, 옆 = 칼 든 쪽 +
    const F = V(f.forward()), Rt = V(f.right());
    const rel = [p0[0] - ct.x, p0[1] - ct.y, p0[2] - ct.z];
    const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const loc = [dot(rel, F), rel[1], f.side * dot(rel, Rt)];
    const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const L = Math.hypot(...d) || 1;
    const el = (Math.asin(d[1] / L) * 180) / Math.PI;
    const az = (Math.atan2(f.side * dot(d, Rt), dot(d, F)) * 180) / Math.PI;
    const ua = applyQ(q(f.bodies.uarmS), [1, 0, 0]), fa = applyQ(q(f.bodies.farmS), [1, 0, 0]);
    const elb = (Math.acos(Math.max(-1, Math.min(1, ua[0] * fa[0] + ua[1] * fa[1] + ua[2] * fa[2]))) * 180) / Math.PI;
    const ni = f.guardPose?.nearest;
    const ai = who === 'enemy' ? g.ai : null;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, mode: ai?.mode ?? null, guard: ai?.guard?.name ?? null, d: +f.foeDistance().toFixed(2),
      hand: { fwd: +loc[0].toFixed(2), up: +loc[1].toFixed(2), side: +loc[2].toFixed(2), y: +p0[1].toFixed(2) }, tip: { el: +el.toFixed(0), az: +az.toFixed(0) }, elbow: +elb.toFixed(0),
      nearest: ni >= 0 ? f.guardPose.table?.[ni]?.name ?? null : null, chestY: +ct.y.toFixed(2), headY: +f.bodies.head.translation().y.toFixed(2) };
  }, who);
const shot = async (page, who, view, path) => {
  await page.evaluate(([who, view]) => {
    const g = window.game;
    const f = g[who];
    const o = who === 'enemy' ? g.player : g.enemy;
    const b = f.bodies.chest.translation();
    const a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx;
    const s = -f.side; // 빈손 쪽에서 (옆으로 선 몸의 앞가슴·칼 팔이 판 그림처럼 보이게)
    const ang = { side: [0, 1], front: [0.82, 0.57], q34: [0.5, 0.87] }[view];
    const R = 2.3;
    const cx = fx * ang[0] + rx * s * ang[1], cz = fz * ang[0] + rz * s * ang[1];
    g.freeCam = true;
    g.camera.position.set(b.x + cx * R, 1.3, b.z + cz * R);
    g.camera.lookAt(b.x + fx * 0.4, 1.05, b.z + fz * 0.4);
  }, [who, view]);
  await page.waitForTimeout(150);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
const freeze = (page, on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
async function three(page, who, tag) {
  await freeze(page, true);
  for (const v of ['side', 'front', 'q34']) await shot(page, who, v, `${dir}/${PREFIX}_${tag}_${v}.png`);
  await freeze(page, false);
}
async function waitFor(page, who, pred, ms, step = 60) {
  const t0 = Date.now();
  let r = await probe(page, who);
  while (!pred(r) && Date.now() - t0 < ms && (r.state === 'fight' || r.state === 'paused')) {
    await page.waitForTimeout(step);
    r = await probe(page, who);
  }
  return r;
}
for (const nm of NAMES) {
  const page = await open(`?weapon=longsword&foeWeapon=${WEAPON}`, nm);
  // 간 보기에 들고 1.5 s 더 (손이 자세에 붙게)
  let r = await waitFor(page, 'enemy', (x) => x.sim > 2.5 && x.mode === 'watch', 60000);
  const t1 = r.sim + 1.5;
  r = await waitFor(page, 'enemy', (x) => x.sim > t1, 30000);
  await three(page, 'enemy', nm);
  out[nm] = r;
  await page.context().close();
}
if (process.env.PLAYER === '1') {
  const page = await open(`?weapon=${WEAPON}&foeWeapon=longsword`, null);
  const r = await waitFor(page, 'player', (x) => x.sim > 3.0, 90000);
  await three(page, 'player', 'player_rest');
  out.player_rest = r;
  await page.context().close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
