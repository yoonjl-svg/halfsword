// 이베리아 몬탄테 고증 (10/10 — schools.js IBERIAN_GUARDS·IBERIAN_TECHK, guards.js IBERIAN_TABLE) 캡처: 츠바이핸더 AI 의 대기(간 보기)·베기 한가운데를 옆·앞·3/4 에서. 콘솔 에러 0.
//  docs/handoff/iberian_montante_{guard,cut}_{side,front,q34}.png (PREFIX 로 앞 이름을 바꾼다 — 전/후 비교용)
//  대기 = 간 보기 2.5 s 뒤 처음으로 AI 자세가 원전 자세(GUARDS 열쇠 — 기본 긴 자세 자리 = 곧은 자세)에 머물 때, 베기 = 공격 'strike' 들어서 STRIKE_MS 뒤
//  실행: npx vite build && npx vite preview --port 4193 --strictPort &
//        node tools/browser/iberian_montante_shots.mjs http://127.0.0.1:4193 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4193';
const dir = process.argv[3] || '.';
const PREFIX = process.env.PREFIX || 'iberian_montante';
const GUARD = process.env.GUARD || 'langort'; // 대기 캡처를 찍을 자세 이름 (없으면 간 보기 아무 자세)
const STRIKE_MS = +(process.env.STRIKE_MS || 120);
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
const probe = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const f = g.enemy, ai = g.ai;
    const q = (b) => { const r = b.rotation(); return [r.x, r.y, r.z, r.w]; };
    const applyQ = ([x, y, z, w], v) => {
      const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
      return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
    };
    const ch = f.bodies.chest, ct = ch.translation();
    const cq = q(ch); const ci = [-cq[0], -cq[1], -cq[2], cq[3]];
    const sp = f.sword.translation();
    const loc = applyQ(ci, [sp.x - ct.x, sp.y - ct.y, sp.z - ct.z]);
    const tip = f.tipPos ?? null;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, d: +f.foeDistance().toFixed(2), mode: ai?.mode ?? null, phase: ai?.phase ?? null, guard: ai?.guard?.name ?? null, tech: ai?.tech?.name ?? null,
      hilt: { fwd: +loc[0].toFixed(2), up: +loc[1].toFixed(2), y: +sp.y.toFixed(2) }, headY: +f.bodies.head.translation().y.toFixed(2), tipY: tip ? +tip.y.toFixed(2) : null, hud: f.swordArt?.names?.[f.guardPose?.nearest ?? -1]?.name ?? null };
  });
const shot = async (page, view, path) => {
  await page.evaluate((view) => {
    const g = window.game;
    const f = g.enemy, o = g.player;
    const b = f.bodies.chest.translation();
    const a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx;
    const s = f.side; // 칼 든 쪽에서
    const ang = { side: [0, 1], front: [0.82, 0.57], q34: [0.5, 0.87] }[view];
    const R = 2.6;
    const cx = fx * ang[0] + rx * s * ang[1], cz = fz * ang[0] + rz * s * ang[1];
    g.freeCam = true;
    g.camera.position.set(b.x + cx * R, 1.35, b.z + cz * R);
    g.camera.lookAt(b.x, 1.15, b.z);
  }, view);
  await page.waitForTimeout(150);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
const freeze = (page, on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
async function three(page, scene) {
  await freeze(page, true);
  for (const v of ['side', 'front', 'q34']) await shot(page, v, `${dir}/${PREFIX}_${scene}_${v}.png`);
  await freeze(page, false);
}
async function waitFor(page, pred, ms, step = 40) {
  const t0 = Date.now();
  let r = await probe(page);
  while (!pred(r) && Date.now() - t0 < ms && (r.state === 'fight' || r.state === 'paused')) {
    await page.waitForTimeout(step);
    r = await probe(page);
  }
  return r;
}
{
  const page = await open('?weapon=longsword&foeWeapon=zweihander');
  await page.evaluate(() => { window.game.player.applyWound = () => {}; window.game.enemy.applyWound = () => {}; }); // 시험만: 캡처가 끝날 때까지 둘 다 죽지 않게
  let r = await waitFor(page, (x) => x.sim > 2.5 && x.mode === 'watch' && (!GUARD || x.guard === GUARD) , 45000);
  if (!(r.mode === 'watch')) r = await waitFor(page, (x) => x.mode === 'watch', 20000);
  await page.waitForTimeout(250);
  r = await probe(page);
  await three(page, 'guard');
  out.guard = r;
  r = await waitFor(page, (x) => x.mode === 'attack' && x.phase === 'strike', 60000, 15);
  await page.waitForTimeout(STRIKE_MS);
  r = await probe(page);
  await three(page, 'cut');
  out.cut = r;
  await page.context().close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
