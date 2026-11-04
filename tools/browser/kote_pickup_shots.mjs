// 떨어진 칼 줍기 그림 (사장님 11/04 '떨어진 무기를 줍는 동작을 신설하자 … 무기 주위로 가서 막기 버튼을 누르거나 혹은 주위로 가면 자동으로 줍게' — 기록 docs/strike/kote_pickup_2026-11-05.md)
//  실제 빌드(npx vite build → dist/ · 정적 서버)에서 롱소드 대 롱소드(상대 AI 멈춤) · `?pickup=block` · 폰 가로(844 × 390 · 터치) — 내 칼을 떨군 뒤(fighter.dropSword — 손목 치기 떨굼과 같은 길)
//  키보드 W 로 칼까지 걷고(막기 단추 글이 '줍기'로 바뀌는지) F(막기 키 = 단추와 같은 parryHold)로 줍는다. 정한 때마다 화면 시계를 거의 세우고 찍음:
//   ① 칼 곁 — 단추 '줍기' (게임 카메라) · ② 웅크려 손을 뻗음 (옆 눈) · ③ 쥐고 일어섬 (옆 눈) · ④ 다시 쥔 뒤 (게임 카메라)
//  실행 (저장소 뿌리): npx vite build && python3 -m http.server 5493 -d dist &  ·  node tools/browser/kote_pickup_shots.mjs http://127.0.0.1:5493 [그림 폴더 (기본 docs/strike/kote_pickup_2026-11-05)]
//  끝 코드 0 = 콘솔 오류 0 · 단추 글 · 주움 맞음. 크롬 PW_CHROMIUM (기본 /opt/pw-browsers/chromium) · 그림은 WebP(브라우저 canvas)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 미리 깔린 playwright (전역 — NODE_PATH)

const base = (process.argv[2] || 'http://127.0.0.1:5493').replace(/\/$/, '');
const out = process.argv[3] || 'docs/strike/kote_pickup_2026-11-05';
fs.mkdirSync(out, { recursive: true });
const W = 844, H = 390;
const errors = [], report = {};
// WebP 는 브라우저 canvas 로 (b4_shots.mjs 와 같은 길 — 이 컨테이너의 PIL 은 깨져 있음)
let enc = null;
const toWebp = async (buf, name, crop = null) => {
  enc ??= await ctx.newPage();
  const url = await enc.evaluate(async ([b64, c]) => {
    const im = new Image();
    im.src = 'data:image/png;base64,' + b64;
    await im.decode();
    const [x, y, w, h] = c ?? [0, 0, im.width, im.height];
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(im, x, y, w, h, 0, 0, w, h);
    return cv.toDataURL('image/webp', 0.8);
  }, [buf.toString('base64'), crop]);
  fs.writeFileSync(`${out}/${name}.webp`, Buffer.from(url.split(',')[1], 'base64'));
};
const clockInit = () => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
};
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await ctx.addInitScript(clockInit);
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${base}/?weapon=longsword&foeWeapon=longsword&pickup=block&slowMo=0&camOpen=old&emo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
await page.evaluate(() => { game.config.ARENA.startGap = 2.6; game.config.ARENA.startHold = 0; });
await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game?.state === 'fight', null, { timeout: 180000 });
await page.waitForFunction(() => window.game?.stats?.simTime > 3.0, null, { timeout: 300000 });
// 상대는 서 있게 (그림용 — 칼을 놓친 몸을 쫓아오지 않게)
await page.evaluate(() => { const g = window.game; g.ai.update = () => { g.enemy.move.set(0, 0); g.enemy.stickX = g.enemy.stickY = 0; }; });
const label = () => page.evaluate(() => ({ text: document.getElementById('btnParry').textContent, show: document.getElementById('btnParry').classList.contains('show'), pick: document.getElementById('btnParry').classList.contains('pick') }));
report.before = await label();
await page.evaluate(() => window.game.player.dropSword());
const simT = () => page.evaluate(() => game.stats.simTime);
const t0 = await simT();
await page.waitForFunction((t) => game.stats.simTime > t + 1.2, t0, { timeout: 120000 });
report.dropped = await page.evaluate(() => { const g = window.game, P = g.player, s = P.sword.translation(), p = P.bodies.pelvis.translation(); return { armed: P.armed, swordY: +s.y.toFixed(2), dist: +Math.hypot(s.x - p.x, s.z - p.z).toFixed(2) }; });
report.labelFar = await label();
// 칼까지 걷기 (W) — 단추가 '줍기'가 되면 멈춤
await page.keyboard.down('KeyW');
await page.waitForFunction(() => document.getElementById('btnParry').textContent === '줍기', null, { timeout: 30000, polling: 'raf' }).catch(() => errors.push('단추가 줍기로 안 바뀜'));
await page.keyboard.up('KeyW');
await page.waitForTimeout(400);
report.labelNear = await label();

const sideView = (on) => page.evaluate((on) => {
  const g = window.game, f = g.player, V3 = g.THREE.Vector3;
  if (!on) { g.freeCam = false; return; }
  g.freeCam = true;
  const c = f.bodies.chest.translation(), s = f.sword.translation();
  const C = new V3((c.x + s.x) / 2, 0.75, (c.z + s.z) / 2);
  const e = g.enemy.bodies.chest.translation();
  const fw = new V3(e.x - c.x, 0, e.z - c.z).normalize();
  const sd = new V3(-fw.z, 0, fw.x).multiplyScalar(f.side >= 0 ? 1 : -1); // 칼 든 쪽
  g.camera.position.copy(C).addScaledVector(sd, 2.6).addScaledVector(fw, 0.4).setY(1.25);
  g.camera.lookAt(C);
  g.camera.updateMatrixWorld();
}, on);
async function shoot(name, side) {
  await page.evaluate(() => { window.__k0 = window.__timeK; window.__timeK = 0.0005; });
  await sideView(side);
  const f0 = await page.evaluate(() => window.game.renderInfo().frame);
  await page.evaluate(() => { window.__timeK = 0.012; });
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(100); await sideView(side); if ((await page.evaluate(() => window.game.renderInfo().frame)) >= f0 + 3) break; }
  await page.evaluate(() => { window.__timeK = 0.0005; });
  const st = await page.evaluate(() => { const P = window.game.player; return { phase: P.pickup?.phase ?? null, armed: P.armed, pelvisY: +P.bodies.pelvis.translation().y.toFixed(2), state: P.state }; });
  const buf = await page.screenshot({ timeout: 180000 });
  await toWebp(buf, name, side ? [112, 0, 620, 390] : null);
  await sideView(false);
  await page.evaluate(() => { window.__timeK = window.__k0; });
  report[name] = st;
  console.log('SHOT', name, JSON.stringify(st));
}
await shoot('pickup_1_near', false);
// 줍기: F 를 누른 채 (단추와 같은 parryHold)
await page.evaluate(() => (window.__timeK = 0.25)); // 천천히 (찍을 때를 놓치지 않게)
await page.keyboard.down('KeyF');
await page.waitForFunction(() => window.game.player.pickup?.phase === 'bend', null, { timeout: 30000, polling: 'raf' }).catch(() => errors.push('줍기가 시작 안 됨'));
const K = await page.evaluate(() => game.config.TIME.k);
const b0 = await simT();
await page.waitForFunction((t) => game.stats.simTime >= t || game.player.pickup?.phase !== 'bend', b0 + 0.24 * K, { timeout: 60000, polling: 'raf' });
await shoot('pickup_2_reach', true);
await page.waitForFunction(() => game.player.pickup?.phase === 'lift' || game.player.armed, null, { timeout: 60000, polling: 'raf' });
await page.waitForFunction(() => game.player.armed || (game.player.pickup?.sword?.t ?? 0) > 0.6 * game.player.pickup?.sword?.fly, null, { timeout: 60000, polling: 'raf' });
await shoot('pickup_3_lift', true);
await page.keyboard.up('KeyF');
await page.evaluate(() => (window.__timeK = 1));
await page.waitForFunction(() => game.player.armed && !game.player.pickup, null, { timeout: 60000 });
const a0 = await simT();
await page.waitForFunction((t) => game.stats.simTime > t + 0.8, a0, { timeout: 60000 });
await shoot('pickup_4_armed', false);
report.log = await page.evaluate(() => window.game.player.pickupLog);
report.labelAfter = await label();
if (!report.before.show) errors.push('막기 단추가 안 보임 (터치 문맥)');
if (report.labelFar.text !== '막기' || report.labelNear.text !== '줍기' || !report.labelNear.pick || report.labelAfter.text !== '막기') errors.push(`단추 글 ${JSON.stringify([report.labelFar, report.labelNear, report.labelAfter])}`);
if (!report.log?.[0]?.ok) errors.push(`줍기 기록 ${JSON.stringify(report.log)}`);
await browser.close();
console.log(JSON.stringify(report, null, 1));
console.log(errors.length ? `FAIL ${errors.length}\n${errors.join('\n')}` : 'PASS');
process.exit(errors.length ? 1 : 0);
