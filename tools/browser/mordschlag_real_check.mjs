// 모르트슐라크 본판 점검 (10/31 14:xx 사장님 '폼멜 찍기로 바꿔서 본판에 올려.' · '모르트슐라크가 발동 안 하더라' · '웹과 앱의 차이가 있는 거 같애') — 읽기만
//  빌드한 판(npm run build → vite preview)을 주소 인자 없이(설치한 앱처럼 '/') 844 × 390 · 터치 기기로 연다. 저장(localStorage)을 미리 채움:
//   독일 스킬트리 칸 모두(G10 모르트슐라크 포함 — 'skill:german:Gn') · 롱소드를 가짐('weapon:longsword') · 장착(stillness.lobby.weapon.v1).
//  첫 화면 'Stage 1' → 싸움 → CDP 터치로만: 왼쪽 이동 스틱을 앞으로 쥔 채 붙음(가슴 사이 ≤ 0.8 m 2 s — 'close' 규칙) → 금빛 '!'(비기 창) → 오른쪽 화면을 빠르게 긋기 → 비기.
//  FOE=still(기본 — 상대 꼭두각시: 가만히 섬) | ai(상대 그대로 — 진짜 AI 앞에서 창이 열리나만 봄) · 시간은 playwright 가짜 시계로 한 프레임(1/60 s)씩
//  찍는 것: 창 · 낸 비기 · 쥠(거꾸로였나) · 맞은 곳 · 두 손이 내 머리 앞인지 · 넘어짐 · 기력 · 가슴 사이 — JSON + 게임 카메라 그림 몇 장
//  실행: node node_modules/vite/bin/vite.js build --outDir .tmp/dist && node node_modules/vite/bin/vite.js preview --outDir .tmp/dist --port 4187 &
//        node tools/browser/mordschlag_real_check.mjs http://127.0.0.1:4187 .tmp/mord_real [still|ai] [최대 싸움 초 = 30]
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // 저장소 밖(전역 NODE_PATH)

const base = (process.argv[2] || 'http://127.0.0.1:4187').replace(/\/$/, '');
const out = process.argv[3] || '.tmp/mord_real';
const FOE = process.argv[4] || 'still';
const MAXS = +(process.argv[5] ?? 30);
const tag = process.env.TAG ?? FOE;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
const G_NODES = JSON.parse(process.env.G_NODES ?? '["G1","G2","G3","G4","G5","G6","G7","G8","G9","G10"]');
await ctx.addInitScript((nodes) => {
  if (localStorage.getItem('stillness.mordcheck.seeded')) return;
  const acquisitions = [...nodes.map((id) => ({ receipt: `skill:german:${id}`, kind: 'skill' })), { receipt: 'weapon:longsword', kind: 'item' }];
  localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, acquisitions, coins: 100, heads: 0 }));
  localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon: 'longsword' }));
  localStorage.setItem('stillness.mordcheck.seeded', '1');
}, G_NODES);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
page.on('console', (m) => m.type() === 'error' && !/deprecated parameters/.test(m.text()) && errors.push(`console ${m.text()}`));
await page.clock.install({ time: new Date('2026-10-31T12:00:00') });
await page.clock.pauseAt(new Date('2026-10-31T12:00:01'));
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
const run = (ms) => page.clock.runFor(ms);
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a); // 느린 기계에서 어디까지 왔나
for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player)); i++) await run(100);
// 그리기는 그림을 찍을 때만 (소프트웨어 GPU 라 그리기가 가장 느림 — 싸움 셈은 그리기와 따로 돈다: main.js paint)
await page.evaluate(() => { window.__paint = false; window.game.renderCap.tick = () => window.__paint; });
log('게임 뜸');
const tapSel = async (sel) => { const L = page.locator(sel).first(); if (!(await L.isVisible().catch(() => false))) return false; const b = await L.boundingBox({ timeout: 500 }).catch(() => null); if (!b) return false; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return true; };
if (await page.locator('#noticeDialog').evaluate((d) => d.open).catch(() => false)) await tapSel('#confirmNotices');
await run(2500); // 첫 화면 바람(start_screen.js showTitle — 1.8 s 뒤 'ready')
const startedTitle = await tapSel('#newJourney');
for (let i = 0; i < 400 && !(await page.evaluate(() => window.game?.state === 'fight')); i++) {
  await run(100);
  if (i % 20 === 5) {
    for (const s of ['#confirmNotices', '#newJourney']) await tapSel(s).catch(() => {});
    log('기다림', await page.evaluate(() => `${window.game?.state} start-open=${document.documentElement.hasAttribute('data-start-open')}`));
  }
}
const info = await page.evaluate(() => {
  const g = window.game, p = g.player, M = g.config.SECRET.mord;
  return { state: g.state, weapon: p.weapon?.id, tradition: p.swordArt?.tradition, secret: g.playerSecret?.S?.name ?? null, pommel: M.pommel, noSelfClip: M.noSelfClip, regrip: M.regrip, rule: g.config.SECRET.mordRule, closeN: g.config.SECRET.mordCloseN, press: g.config.SECRET.mordPress, foe: g.enemy?.name, url: location.href };
});
console.log(JSON.stringify({ startedTitle, info }));
if (info.state !== 'fight') { console.log('싸움에 못 들어감'); await page.screenshot({ path: `${out}/${tag}_nofight.png` }); await browser.close(); process.exit(1); }
await page.evaluate((still) => {
  const g = window.game, p = g.player, e = g.enemy, T = g.THREE;
  if (still) g.ai.update = () => e.move.set(0, 0);
  const V = (q) => new T.Vector3(q.x, q.y, q.z), Q = (r) => new T.Quaternion(r.x, r.y, r.z, r.w);
  window.__mc = { hits: [], front: Infinity, fell: false, rev: false, opened: 0, fired: 0, stages: [] };
  const H = g.config; void H;
  window.__rec = () => {
    const W = g.playerSecret, I = p.iai, mc = window.__mc;
    if (W?.open) mc.opened = Math.max(mc.opened, W.opened ?? 1);
    if (p.mordGrip) mc.rev = true;
    if (p.skill.sec && p.state !== 'stand') mc.fell = true;
    if (I?.mord) {
      const yi = I.yaw.clone().invert(), hd = V(p.bodies.head.translation());
      const wS = new T.Vector3(0.13, 0, 0).applyQuaternion(Q(p.bodies.farmS.rotation())).add(V(p.bodies.farmS.translation()));
      mc.front = Math.min(mc.front, wS.sub(hd).applyQuaternion(yi).x);
    }
    const st = p.skill.sec?.stage ?? null;
    if (st && mc.stages.at(-1) !== st) mc.stages.push(st);
    return { t: +p.fightT.toFixed(2), d: +p.foeDistance().toFixed(3), open: !!W?.open, pressT: +(W?.pressT ?? 0).toFixed(2), sec: st, st: +p.stamina.value.toFixed(1), ready: !!p.stamina.secretReady, stand: p.state, foe: e.state, R: p.instantResult?.mord ? { hit: p.instantResult.hit, part: p.instantResult.part, wPart: p.instantResult.wPart, E: +(p.instantResult.energy ?? 0).toFixed(1) } : null };
  };
  g.combat.hooks.onWound = ((prev) => (att, vic, r, pt, pr) => { if (att === p && p.skill.sec) window.__mc.hits.push({ zone: r.zone, part: pr?.w?.part, E: +r.energy.toFixed(1) }); prev?.(att, vic, r, pt, pr); })(g.combat.hooks.onWound);
}, FOE === 'still');
const cdp = await ctx.newCDPSession(page);
const pad = await page.locator('#moveStick').boundingBox();
const S = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const stickPt = { x: S.x, y: S.y - pad.height * 0.45, id: 1 };
await touch('touchStart', [{ ...S, id: 1 }]);
await run(17);
await touch('touchMove', [stickPt]);
const frames = [];
let r = null, fired = false, shots = 0;
const shot = async (name) => { shots++; await page.evaluate(() => { window.__paint = true; }); await run(17); await page.screenshot({ path: `${out}/${tag}_${String(shots).padStart(2, '0')}_${name}.png` }); await page.evaluate(() => { window.__paint = false; }); };
for (let f = 0; f < MAXS * 60; f++) {
  await run(17);
  r = await page.evaluate(() => window.__rec());
  frames.push(r);
  if (f % 120 === 0) log(JSON.stringify(r));
  if (r.open && !fired) {
    await shot('window');
    // 오른쪽 화면 빠르게 긋기 (스틱 손가락은 쥔 채 — 두 손가락)
    const A = { x: 640, y: 150, id: 2 };
    await touch('touchStart', [stickPt, A]);
    await run(17);
    for (let k = 1; k <= 3; k++) { await touch('touchMove', [stickPt, { x: A.x - 35 * k, y: A.y + 30 * k, id: 2 }]); await run(17); }
    await touch('touchEnd', [stickPt]);
    fired = true;
  }
  if (fired && r.sec === 'instant' && !frames.some((x) => x.shotStrike)) { r.shotStrike = true; await shot('strike'); }
  if (fired && !r.sec && frames.filter((x) => x.sec).length > 0) { await run(400); await shot('after'); break; }
}
await touch('touchEnd', []);
const mc = await page.evaluate(() => window.__mc);
const dists = frames.map((x) => x.d);
const summary = { tag, info, fired, opened: frames.some((x) => x.open), firstOpenT: frames.find((x) => x.open)?.t ?? null, stages: mc.stages, hits: mc.hits, R: frames.findLast((x) => x.R)?.R ?? null, rev: mc.rev, front: Number.isFinite(mc.front) ? +mc.front.toFixed(3) : null, fell: mc.fell, minD: Math.min(...dists), closeFrac: +(dists.filter((d) => d <= info.closeN).length / Math.max(1, dists.length)).toFixed(2), pressMax: Math.max(...frames.map((x) => x.pressT)), stamina: { min: Math.min(...frames.map((x) => x.st)), notReady: frames.filter((x) => !x.ready).length }, frames: frames.length, errors };
fs.writeFileSync(`${out}/${tag}_check.json`, JSON.stringify({ summary, frames }, null, 1));
console.log(JSON.stringify(summary));
await browser.close();
