// 유파 걸음 (10/10 비싼 층 ⑥ — docs/strike/school_gait_design_2026-10-10.md) 옆모습 캡처. 콘솔 에러 0.
//  유파마다 AI 한 장 + 플레이어 한 장: 이탈리아 follow(레이피어) · 일본 끌어 딛기(우치가타나) · 이베리아 둥근 걸음·엇갈림(츠바이핸더) · 중국 체보(청강검)
//  그 몸의 한 발이 떠 있는 때(follow 는 앞발 내딛기 75~95 %, 나머지 40~70 %)인 물리 스텝에서 일시정지(P)로 멈춰 옆에서 찍는다 — follow 유파는 follow 가 켜졌을 때,
//  이베리아는 엇갈림 걸음(cross)일 때(못 찾으면 옆으로 가는 걸음), 중국은 끌어붙이는 뒷발(draw·따라붙음)일 때를 먼저 기다린다.
//  시험만: 찍는 몸이 죽지 않게 상처를 끈다(걸음·물리 그대로). 플레이어는 W 로 다가간 뒤 옆으로(A, 이베리아는 D).
//  실행: npx vite build && npx vite preview --port 4188 --strictPort &
//        node tools/browser/school_gait_shots.mjs http://127.0.0.1:4188 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4188';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
async function open(q) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  await page.evaluate(() => (document.getElementById('techCue').style.visibility = 'hidden'));
  return page;
}
// 찍을 몸(who: 'enemy' | 'player')의 걸음 상태 + 멈춤 갈고리 (want: 'follow' | 'cross' | 'drag' | 'side')
async function arm(page, who, want) {
  await page.evaluate(([who, want]) => {
    const g = window.game;
    const f = g[who];
    g.player.applyWound = () => {};
    g.enemy.applyWound = () => {};
    const c = g.combat;
    const o = c.afterStep.bind(c);
    g._shot = null;
    g._shotT0 = g.stats.simTime;
    c.afterStep = (...a) => {
      const res = o(...a);
      const G = f.gait;
      if (g._shot || !G?.active || f.state !== 'stand') return res;
      const sw = !G.legs.F.stance ? G.legs.F : !G.legs.B.stance ? G.legs.B : null;
      if (!sw) return res;
      const u = sw.t / sw.T;
      const [u0, u1] = want === 'follow' ? [0.75, 0.95] : [0.4, 0.7]; // follow 는 앞발이 내딛기를 거의 마친 때(두 발이 가장 벌어짐 — 앞뒤 발이 안 바뀐 것이 보임)
      if (u < u0 || u > u1) return res;
      const late = g.stats.simTime - g._shotT0 > 25; // 오래 못 찾으면 조건을 늦춘다
      const ok =
        want === 'follow' ? G.follow && sw.kind === 'walk' && (!G.trailStep || late) :
        want === 'drag' ? sw.kind === 'draw' || (G.follow && G.trailStep && sw.kind === 'walk' && (late || sw.lift < 0.04)) :
        want === 'cross' ? (sw.kind === 'walk' && sw.cross) || (late && sw.kind === 'walk' && Math.abs(f.move.x) > 0.15) :
        sw.kind === 'walk';
      if (!ok) return res;
      const pv = f.bodies.pelvis.translation();
      const st = sw === G.legs.F ? G.legs.B : G.legs.F;
      g._shot = { who, want, kind: sw.kind, cross: !!sw.cross, follow: !!G.follow, trail: !!G.trailStep, u: +u.toFixed(2), lift: +(sw.lift ?? 0).toFixed(3), soleY: +sw.soleY.toFixed(3), pelvisY: +pv.y.toFixed(3), feet: +Math.hypot(st.plant.x - sw.ankle.x, st.plant.z - sw.ankle.z).toFixed(2), d: +f.foeDistance().toFixed(2), late, tradition: G.P?.tradition ?? null, sim: +g.stats.simTime.toFixed(2) };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
      return res;
    };
  }, [who, want]);
}
async function waitShot(page, ms, onTick) {
  const t0 = Date.now();
  for (;;) {
    const s = await page.evaluate(() => ({ shot: window.game._shot, state: window.game.state, d: window.game.player.foeDistance() }));
    if (s.shot && s.state === 'paused') return s.shot;
    if (Date.now() - t0 > ms || (s.state !== 'fight' && s.state !== 'paused')) return null;
    if (onTick) await onTick(s);
    await page.waitForTimeout(80);
  }
}
// 옆에서 (찍는 몸이 화면 가운데, 두 사람 줄에 수직)
async function side(page, who, path, back = false) {
  await page.evaluate(([who, back]) => {
    const g = window.game;
    const f = g[who];
    const o = who === 'enemy' ? g.player : g.enemy;
    document.getElementById('menu').style.visibility = 'hidden';
    const a = o.bodies.chest.translation();
    const b = f.bodies.pelvis.translation();
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    if (back) g.camera.position.set(b.x + (dx / L) * 2.4, 0.9, b.z + (dz / L) * 2.4); // 뒤에서 (옆으로 엇갈리는 발이 보이게)
    else g.camera.position.set(b.x - (dz / L) * 2.6, 0.75, b.z + (dx / L) * 2.6);
    g.camera.lookAt(b.x, 0.45, b.z);
  }, [who, back]);
  await page.waitForTimeout(300);
  await page.screenshot({ path });
}
const CASES = [
  { key: 'italian', weapon: 'rapier', want: 'follow' },
  { key: 'japanese', weapon: 'uchigatana', want: 'follow' },
  { key: 'iberian', weapon: 'zweihander', want: 'cross' },
  { key: 'chinese', weapon: 'qinggang', want: 'drag' },
];
for (const C of CASES) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(C.key)) continue;
  // AI
  {
    const page = await open(`?weapon=longsword&foeWeapon=${C.weapon}`);
    await arm(page, 'enemy', C.want);
    const s = await waitShot(page, 240000);
    if (s) await side(page, 'enemy', `${dir}/school_gait_${C.key}_ai.png`);
    out[`${C.key}_ai`] = s;
    await page.context().close();
  }
  // 플레이어
  {
    const page = await open(`?weapon=${C.weapon}&foeWeapon=longsword`);
    await arm(page, 'player', C.want);
    await page.keyboard.down('KeyW');
    // 다가간 뒤 옆으로 (스틱 끝까지 밀면 앞으로는 followVmax 0.8 m/s 를 넘어 지나 딛는다 — 옆 최고 0.71 m/s 는 follow 안)
    let lateral = false;
    const s = await waitShot(page, 240000, async (st) => {
      if (!lateral && st.d < 3.0) {
        lateral = true;
        await page.keyboard.up('KeyW');
        await page.keyboard.down(C.key === 'iberian' ? 'KeyD' : 'KeyA');
      }
    });
    if (s) await side(page, 'player', `${dir}/school_gait_${C.key}_player.png`);
    if (s && C.key === 'iberian') await side(page, 'player', `${dir}/school_gait_${C.key}_player_back.png`, true);
    out[`${C.key}_player`] = s;
    await page.context().close();
  }
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
