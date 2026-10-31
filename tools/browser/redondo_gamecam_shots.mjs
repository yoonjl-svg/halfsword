// 풍차 베기(이베리아 B4) — 게임 카메라로 본 감기 · 내려침 (사장님 10/31 08:xx '풍차 b는 칼을 어깨 위로 올리거나 들지 않던데? 플레이어만 그런 건가? 누가봐도 레돈두 준비처럼 보여야해.')
//  읽기만 — 게임 값은 주소로만. 기록 docs/strike/redondo_hold_2026-10-29.md §8-12.
//  ① 사람(빌드): 개발 서버에서 금화를 채워 진짜 배우기(skill_tree_store.js learnNode)로 이베리아 B1 → B5 → B4 를 익히고 그 저장을 빌드 쪽에 넣음(tools/browser/longpress_probe.mjs 와 같은 길) ·
//   844×390 터치 기기 · 츠바이핸더 · 상대 롱소드(AI 멈춤) · CDP 터치로 칼 쪽 화면을 길게 누름(엄지 떠돎 3 px) → 정한 때마다 게임 카메라 그대로(freeCam 없음) 찍음 → 뗌 → 내려침.
//  ② AI(개발 서버 — 모듈을 불러 기술을 꺼냄): 사람 롱소드 · 상대 츠바이핸더(이베리아) · 상대에게 머리 위 돌려 베기(redondo — AI 몫)를 빈틈 공격('open')으로 시킴(다가가 벰) → 같은 카메라로 찍음.
//  화면 시계를 늦춰(requestAnimationFrame · performance.now 를 __timeK 배 — 게임 코드는 그대로) 찍는 때마다 시계를 거의 세움.
//  실행 (저장소 뿌리): npm run build → npx vite preview --port 5391 --strictPort --host 127.0.0.1 & · npx vite --port 5392 --strictPort --host 127.0.0.1 &
//        node tools/browser/redondo_gamecam_shots.mjs http://127.0.0.1:5391 http://127.0.0.1:5392 <그림 폴더> <이름 꼬리 (before | after)> [who: player,ai]
//   환경: EXTRA(주소 덧붙임 — 예 &rdWind=slowSpin) · KEEP=1 낱장 남김 · PYTHON
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] || 'http://127.0.0.1:5391';
const dev = process.argv[3] || 'http://127.0.0.1:5392';
const dir = process.argv[4] || 'docs/handoff/redondo_motion_2026-10-29';
const tag = process.argv[5] || 'now';
const who = (process.argv[6] || 'player,ai').split(',');
const EXTRA = process.env.EXTRA || '';
const W = 844, H = 390;
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const clockInit = () => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
};
// 몸 틀 칼끝 · 손 (가슴 원점 · x 앞 · y 위 · z 칼 든 쪽 +) — 찍을 때 자세를 숫자로 적음
const poseOf = (who) => {
  const g = window.game;
  const f = who === 'ai' ? g.enemy : g.player;
  const c = f.bodies.chest.translation();
  const q = f.yaw.clone().invert();
  const s = f.side >= 0 ? 1 : -1;
  const V3 = f.forward().constructor; // THREE.Vector3 (전역이 없어 몸이 돌려준 벡터의 틀을 씀)
  const loc = (p) => { const v = new V3(p.x - c.x, p.y - c.y, p.z - c.z).applyQuaternion(q); return [+v.x.toFixed(2), +v.y.toFixed(2), +(s * v.z).toFixed(2)]; };
  const tip = f.bladePoint(1, new V3());
  const W = f.rdWind;
  return { tip: loc(tip), hand: loc(f.sword.translation()), wind: W ? { t: +W.t.toFixed(2), k: +W.k.toFixed(2), turns: +W.turns.toFixed(2), kind: W.M.kind } : null, iai: !!f.iai, thW: +(f.skill.thrustPose?.w ?? 0).toFixed(2), held: !!f.handHeld, aiPhase: who === 'ai' ? `${g.ai.mode}/${g.ai.phase}` : null, simT: +g.stats.simTime.toFixed(2) };
};
async function shoot(page, file, k, label, whoName) {
  await page.evaluate(() => { window.__k0 = window.__timeK; window.__timeK = 0.003; });
  const pose = await page.evaluate(poseOf, whoName);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/_${file}_${k}.png`, timeout: 180000 });
  await page.evaluate(() => { window.__timeK = window.__k0; });
  console.log(`  SHOT ${file} ${k} ${label} ${JSON.stringify(pose)}`);
  return { k, label, pose };
}
const summary = [];

if (who.includes('player')) {
  // 진짜 배우기 (개발 서버)
  const dctx = await browser.newContext({ viewport: { width: W, height: H } });
  const dpage = await dctx.newPage();
  await dpage.goto(`${dev}/?weapon=zweihander`, { waitUntil: 'networkidle' });
  await dpage.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
  const save = await dpage.evaluate(async () => {
    const P = await import('/src/lobby_progress.js');
    const S = await import('/src/skill_tree_store.js');
    P.setCoins(100000);
    P.setHeads(100);
    const r = {};
    for (const id of ['B1', 'B5', 'B4']) r[id] = S.learnNode('iberian', id);
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    return { r, ls };
  });
  await dctx.close();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(([ls]) => { try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch { /* */ } }, [save.ls]);
  await ctx.addInitScript(clockInit);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('player pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('player ' + m.text()); });
  await page.goto(`${base}/?weapon=zweihander&foeWeapon=longsword&slowMo=0&camOpen=old${EXTRA}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
  await page.evaluate(() => { game.config.ARENA.startGap = 4.2; game.config.ARENA.startHold = 0; });
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game?.state === 'fight' && window.game?.playerUnique, null, { timeout: 180000 });
  await page.waitForFunction(() => window.game?.stats?.simTime > 2.0, null, { timeout: 300000 });
  const kit = await page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); if (g.playerSecret) { g.playerSecret.update = () => {}; g.playerSecret.open = null; } return { holdE: g.playerUnique?.holdE?.name ?? null, mode: g.config.UNIQUE_ASSIST.rdWindMode, holdPx: g.config.INPUT.holdPx ?? null }; });
  console.log('player', JSON.stringify({ learned: save.r, kit }));
  if (kit.holdE !== 'redondo') throw Error('풍차 베기 없음');
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: 1, radiusX: 18, radiusY: 18, force: 0.5 })) });
  const p0 = { x: W * 0.68, y: H * 0.42 };
  const shots = [];
  shots.push(await shoot(page, `p_${tag}`, 0, 'before press', 'player'));
  await page.evaluate(() => (window.__timeK = 0.12));
  await touch('touchStart', [p0]);
  const g0 = await page.evaluate(() => game.stats.simTime);
  const atT = async (dt) => {
    // 누른 뒤 게임 초 dt (엄지 떠돎 3 px — 천천히)
    for (;;) {
      const t = await page.evaluate(() => game.stats.simTime);
      const u = Math.min(1, (t - g0) / 2.6);
      await touch('touchMove', [{ x: p0.x + 3 * Math.sin(u * 3), y: p0.y + 2 * u }]);
      if (t - g0 >= dt) break;
      await page.waitForTimeout(60);
    }
  };
  // 누름 0.6 s(감기 시작) 뒤: 감기 0.15 · 0.35 · 0.66(얹음) · 1.0 · 1.5 s
  for (const [i, w] of [[1, 0.15], [2, 0.35], [3, 0.66], [4, 1.0], [5, 1.5]]) {
    await atT(0.66 + w * 1.1);
    shots.push(await shoot(page, `p_${tag}`, i, `wind ${w}s`, 'player'));
  }
  await touch('touchEnd', []);
  const rel = await page.evaluate(() => game.stats.simTime);
  for (const [i, w] of [[6, 0.06], [7, 0.14], [8, 0.3]]) {
    await page.waitForFunction((t) => game.stats.simTime >= t, rel + w * 1.1, { timeout: 120000, polling: 'raf' });
    shots.push(await shoot(page, `p_${tag}`, i, `release +${w}s`, 'player'));
  }
  const st = await page.evaluate(() => ({ fired: game.playerUnique.stats.fired?.redondo ?? 0, winds: game.playerUnique.stats.winds ?? 0, refused: game.playerUnique.stats.holdRefused ?? 0, cancel: game.playerUnique.stats.windCancel ?? {} }));
  console.log('player result', JSON.stringify(st));
  summary.push({ who: 'player', tag, kit, st, shots });
  await ctx.close();
}

if (who.includes('ai')) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.addInitScript(clockInit);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('ai pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('ai ' + m.text()); });
  await page.goto(`${dev}/?weapon=longsword&foeWeapon=zweihander&slowMo=0&camOpen=old${EXTRA}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
  await page.evaluate(() => { game.config.ARENA.startGap = 2.6; game.config.ARENA.startHold = 0; });
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game?.state === 'fight', null, { timeout: 180000 });
  await page.waitForFunction(() => window.game?.stats?.simTime > 2.0 && !window.game.enemy.feetHeld, null, { timeout: 300000 });
  const info = await page.evaluate(async () => {
    const g = window.game;
    const S = await import('/src/schools.js');
    const t = S.TRADITIONS.iberian.unique.find((u) => u.name === 'redondo');
    const ai = g.ai;
    // 상대가 다른 것을 하지 않게: 결정은 그대로 두되 이 공격 하나만 (뒤엔 멈춤)
    const up = ai.update.bind(ai);
    window.__aiDone = false;
    ai.update = (dt) => { if (window.__aiDone) { g.enemy.move.set(0, 0); return; } up(dt); if (ai.mode !== 'attack' && window.__aiStarted) window.__aiDone = true; };
    window.__aiStarted = true;
    const ok = ai.startAttack({ ...t, plain: null }, 'open', { noFeint: true });
    return { ok, tradition: ai.art?.tradition, mode: g.config.UNIQUE_ASSIST.rdWindMode, aiWind: g.config.UNIQUE_ASSIST.rdAiWind ?? null };
  });
  console.log('ai', JSON.stringify(info));
  const t0 = await page.evaluate(() => game.stats.simTime);
  const shots = [];
  for (const [i, w] of [[0, 0.0], [1, 0.2], [2, 0.4], [3, 0.7], [4, 1.0], [5, 1.4], [6, 1.8], [7, 2.2], [8, 2.6]]) {
    await page.waitForFunction((t) => game.stats.simTime >= t, t0 + w * 1.1, { timeout: 120000, polling: 'raf' });
    shots.push(await shoot(page, `a_${tag}`, i, `AI +${w}s`, 'ai'));
  }
  summary.push({ who: 'ai', tag, info, shots });
  await ctx.close();
}
await browser.close();
// 같은 꼬리의 앞 기록에 이번에 찍은 쪽(사람 · AI)만 바꿔 넣음
const jf = `${dir}/_gamecam_${tag}.json`;
let prev = [];
try { prev = JSON.parse(fs.readFileSync(jf, 'utf8')).summary.filter((s) => !summary.some((x) => x.who === s.who)); } catch { /* 처음 */ }
fs.writeFileSync(jf, JSON.stringify({ tag, summary: [...prev, ...summary], errors }, null, 1));
// 띠 그림 (게임 카메라 화면 — 몸 둘레를 잘라 한 줄 · 낱장 9 장) — 이번에 찍은 쪽만
execFileSync(process.env.PYTHON || '/usr/bin/python3', ['tools/browser/redondo_gamecam_strip.py', dir, tag, summary.map((s) => s.who).join(',')], { stdio: 'inherit' });
const pre = summary.map((s) => (s.who === 'player' ? 'p' : 'a')).join('');
if (!process.env.KEEP) for (const f of fs.readdirSync(dir)) if (new RegExp(`^_[${pre}]_${tag}_\\d+\\.png$`).test(f)) fs.unlinkSync(`${dir}/${f}`);
if (errors.length) console.log(`콘솔 에러 ${errors.length}:\n${errors.slice(0, 10).join('\n')}`);
