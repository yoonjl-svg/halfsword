// 이탈리아 빈팔 고증 (10/10 — schools.js offArm, fighter.js offArmSchool) 캡처: 레이피어 AI·플레이어의 대기·런지를 옆·앞·3/4 에서. 콘솔 에러 0.
//  docs/handoff/rapier_offhand_{ai,player}_{guard,lunge}_{side,front,q34}.png (PREFIX 로 앞 이름을 바꿀 수 있다 — 전/후 비교용)
//  빈손 자리(가슴 몸체 기준 m: 앞·위·바깥)와 손 높이(땅에서 m)·머리 높이를 함께 적는다.
//  AI 런지 = 비기 Passata in contratempo(오래 안 나오면 직접 낸다 — 조건 판정만 건너뜀). 플레이어 런지 = lungeT 를 직접 켠다(시험만 — 런지 자세만 보기)
//  실행: npx vite build && npx vite preview --port 4191 --strictPort &
//        node tools/browser/rapier_offhand_shots.mjs http://127.0.0.1:4191 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4191';
const dir = process.argv[3] || '.';
const PREFIX = process.env.PREFIX || 'rapier_offhand';
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
// who: 'enemy' | 'player'
const probe = (page, who) =>
  page.evaluate((who) => {
    const g = window.game;
    const f = g[who];
    const o = who === 'enemy' ? g.player : g.enemy;
    const q = (b) => { const r = b.rotation(); return [r.x, r.y, r.z, r.w]; };
    const applyQ = ([x, y, z, w], v) => { // v 를 q 로 돌림
      const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
      return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
    };
    const fo = f.bodies.farmO, ch = f.bodies.chest;
    const ft = fo.translation(), ct = ch.translation();
    const hv = applyQ(q(fo), [0, -0.135, 0]);
    const hand = [ft.x + hv[0], ft.y + hv[1], ft.z + hv[2]];
    const cq = q(ch); const ci = [-cq[0], -cq[1], -cq[2], cq[3]];
    const loc = applyQ(ci, [hand[0] - ct.x, hand[1] - ct.y, hand[2] - ct.z]);
    const hd = f.bodies.head.translation();
    const ai = who === 'enemy' ? g.ai : null;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, d: +f.foeDistance().toFixed(2), alive: f.alive, oAlive: o.alive, mode: ai?.mode ?? null, lungeT: +(f.lungeT ?? 0).toFixed(2), stanceW: +(f._stance?.w ?? 0).toFixed(2), stanceKey: f._stance?.key ?? null,
      hand: { fwd: +loc[0].toFixed(2), up: +loc[1].toFixed(2), out: +(-f.side * loc[2]).toFixed(2), y: +hand[1].toFixed(2) }, headY: +hd.y.toFixed(2), chestY: +ct.y.toFixed(2), pelvisY: +f.bodies.pelvis.translation().y.toFixed(2) };
  }, who);
// view: side(두 사람 줄에 수직, 빈손 쪽에서) · front(상대 쪽에서 비스듬히 앞) · q34(3/4)
const shot = async (page, who, view, path) => {
  await page.evaluate(([who, view]) => {
    const g = window.game;
    const f = g[who];
    const o = who === 'enemy' ? g.player : g.enemy;
    const b = f.bodies.chest.translation();
    const a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z; // f → 상대
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx; // 줄에 수직
    const s = -f.side; // 빈손 쪽
    const ang = { side: [0, 1], front: [0.82, 0.57], q34: [0.5, 0.87] }[view]; // front: 상대 쪽 35° 비껴(상대에 가리지 않게)
    const R = 1.9;
    const cx = fx * ang[0] + rx * s * ang[1], cz = fz * ang[0] + rz * s * ang[1];
    g.freeCam = true;
    g.camera.position.set(b.x + cx * R, 1.25, b.z + cz * R);
    g.camera.lookAt(b.x, 1.0, b.z);
  }, [who, view]);
  await page.waitForTimeout(150);
  await page.screenshot({ path });
  await page.evaluate(() => (window.game.freeCam = false));
};
const freeze = (page, on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
async function three(page, who, scene) {
  await freeze(page, true);
  for (const v of ['side', 'front', 'q34']) await shot(page, who, v, `${dir}/${PREFIX}_${who === 'enemy' ? 'ai' : 'player'}_${scene}_${v}.png`);
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
// ① AI 레이피어: 대기(간 보기) → 런지
{
  const page = await open('?weapon=longsword&foeWeapon=rapier');
  await page.evaluate(() => (window.game.player.applyWound = () => {})); // 시험만: 런지가 나올 때까지 내가 죽지 않게
  let r = await waitFor(page, 'enemy', (x) => x.sim > 2.5 && x.mode === 'watch', 60000);
  await three(page, 'enemy', 'guard');
  out.aiGuard = r;
  r = await waitFor(page, 'enemy', (x) => x.stanceKey === 'lunge' && x.stanceW > 0.95, 90000, 30);
  let forced = false;
  if (!(r.stanceW > 0.95)) {
    await page.keyboard.down('KeyW');
    r = await waitFor(page, 'enemy', (x) => x.d < 2.0, 60000, 40);
    await page.keyboard.up('KeyW');
    forced = await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
    r = await waitFor(page, 'enemy', (x) => x.stanceKey === 'lunge' && x.stanceW > 0.95, 30000, 30);
  }
  await three(page, 'enemy', 'lunge');
  out.aiLunge = { ...r, forced };
  await page.context().close();
}
// ② 플레이어 레이피어: 대기 → 런지(직접 켬)
{
  const page = await open('?weapon=rapier&foeWeapon=longsword');
  await page.evaluate(() => (window.game.player.applyWound = () => {}));
  let r = await waitFor(page, 'player', (x) => x.sim > 2.0, 30000);
  await three(page, 'player', 'guard');
  out.playerGuard = r;
  await page.evaluate(() => (window.game.player.lungeT = 0.6)); // 시험만: 런지 자세(SECRET.stance.lunge)를 켠다
  r = await waitFor(page, 'player', (x) => x.stanceKey === 'lunge' && x.stanceW > 0.95, 5000, 20);
  await three(page, 'player', 'lunge');
  out.playerLunge = r;
  await page.context().close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
