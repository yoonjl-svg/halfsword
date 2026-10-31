// 10/31 이탈리아 자리 바꿈 — 실제 빌드 브라우저 점검 (docs/strike/italian_swap_2026-10-31.md · 폰 가로 844 × 390 · CDP 터치).
//  ① 스킬트리 화면: 이탈리아 I1 · I3 · I7 · I2 를 익힌 저장 → 첫 화면 → 대기실 '스킬' → 이탈리아 탭 — 트리 한 장 + 상세 카드 I7 내려 찌르기 · I2 칼끝 돌려 빼기 · I8 헛누름 · I9 비껴서며 찌르기
//  ② 칼끝 돌려 빼기 한 번: 판(레이피어 · 상대 이졸데 롱소드 · ?skillNodes=all · 상대 AI 그대로) — 조이스틱(CDP)으로 걸어 들어가 막기 단추(CDP 손가락 1)를 쥐고 받다가
//     칼끼리 닿음(touchTick — 막고 서 있다 닿음)이 열리면 실제 0.45 s 뒤 칼 쪽 화면 탭(CDP 손가락 2 — 막기 쥔 채) → 나감 · 그 순간 그림
//  ③ 비껴서며 찌르기 한 번: 같은 판 · 상대 AI 그대로(공격해 옴) · 위협이 읽히면 조이스틱(CDP 손가락 1)을 옆으로 밀고 칼 쪽 화면 탭(CDP 손가락 2 — touchMove 로 더하고 뺌) → 나감 · 잔상 그림
//  ④ 내려 찌르기: 같은 판 · 상대 세움 · 손가락 긋기(CDP 터치 끌기 — 게임 화면 박자마다 한 번 움직임) ↓ · ↙ · ↘ 를 높이 · 가운데 · 낮게 시작해 각 DOWN_REP(2) 번 + 수평 ← · 올려 ↑ 견줌 → 내려 찌르기로 읽힌 수
//  실행: npm run build → (cd dist && python3 -m http.server 5631) &  node tools/browser/italian_swap_shots.mjs http://127.0.0.1:5631 docs/handoff/italian_swap_2026-10-31
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { titleToLobby } from './to_lobby.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:5631').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/italian_swap_2026-10-31';
const ONLY = (process.env.ONLY || 'tree,cav,inq,down').split(',');
fs.mkdirSync(out, { recursive: true });
const errors = [];
const log = [];
const say = (s) => { console.log(s); log.push(s); };
// WebP 로 (PIL — 이 상자의 -I 판 PIL 이 깨져 있으면 사용자 판으로 · 그래도 안 되면 PNG 그대로)
const toWebp = (png) => {
  for (const args of [['-I', '-c'], ['-c']]) {
    try { execFileSync('python3', [...args, 'import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert("RGB").save(sys.argv[2], "WEBP", quality=84, method=6)', png, png.replace(/\.png$/, '.webp')], { stdio: 'ignore' }); fs.unlinkSync(png); return png.replace(/\.png$/, '.webp'); } catch { /* 다음 */ }
  }
  try { execFileSync('convert', [png, '-quality', '84', png.replace(/\.png$/, '.webp')], { stdio: 'ignore' }); fs.unlinkSync(png); return png.replace(/\.png$/, '.webp'); } catch { /* ImageMagick 없음 */ }
  return png;
};
const shot = async (p, name) => { const f = `${out}/${name}.png`; await p.screenshot({ path: f }); say(`그림 ${toWebp(f)}`); };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const W = 844, H = 390;

// ── ① 스킬트리 ──
if (ONLY.includes('tree')) {
  const SAVE = { version: 1, coins: 900, heads: 12, titles: [], title: '', acquisitions: ['I1', 'I3', 'I7', 'I2'].map((id) => ({ receipt: `skill:italian:${id}`, kind: 'skill', paid: { coins: 100, heads: 0 } })) };
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript((save) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('stillness.lobby.progress.v1', save); } }, JSON.stringify(SAVE));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`tree pageerror ${e}`));
  await p.goto(base + '/', { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player, null, { timeout: 180000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open).catch(() => false)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 120000 });
  await titleToLobby(p, '#newJourney', 'tap');
  for (let k = 0; k < 12; k++) {
    await p.waitForTimeout(150);
    const open = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot; const d = [...r.querySelectorAll('dialog')].find((x) => x.open); if (!d) return false; const b = d.querySelector('button'); b?.click(); return !!b; });
    if (!open) break;
  }
  await p.locator('#tabSkills').tap();
  await p.locator('.school-tabs [data-school=italian]').tap();
  await p.waitForTimeout(600);
  for (const [id, nm] of [['I7', 'tree_italian_upper_844x390'], ['I8', 'tree_italian_lower_844x390']]) {
    await p.evaluate((nid) => document.querySelector('#gameEntrance').shadowRoot.querySelector(`.tree-node[data-node="${nid}"]`).scrollIntoView({ block: 'center' }), id);
    await p.waitForTimeout(400);
    await shot(p, nm);
  }
  for (const id of ['I7', 'I2', 'I8', 'I9']) {
    await p.evaluate((nid) => document.querySelector('#gameEntrance').shadowRoot.querySelector(`.tree-node[data-node="${nid}"]`).scrollIntoView({ block: 'center' }), id);
    await p.waitForTimeout(250);
    const box = await p.evaluate((nid) => { const b = document.querySelector('#gameEntrance').shadowRoot.querySelector(`.tree-node[data-node="${nid}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, id);
    await p.touchscreen.tap(box.x, box.y);
    await p.waitForTimeout(400);
    const card = await p.evaluate(() => { const r = document.querySelector('#gameEntrance').shadowRoot; return { title: r.getElementById('nodeTitle')?.textContent, state: r.querySelector('.node-detail')?.dataset.state, text: r.querySelector('.node-detail')?.innerText.replace(/\s+/g, ' ').slice(0, 260) }; });
    say(`카드 ${id} ${JSON.stringify(card)}`);
    await shot(p, `card_${id}_844x390`);
    await p.evaluate(() => document.querySelector('#gameEntrance').shadowRoot.querySelector('.detail-close').click());
    await p.waitForTimeout(200);
  }
  await ctx.close();
}

/** 판 열기 (터치 기기 · 이탈리아 칸 모두) */
async function fight(name, gap = 2.0) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${name} pageerror ${e}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(`${name} ${m.text()}`); });
  await p.goto(`${base}/?weapon=rapier&foe=isolde&foeWeapon=longsword&skillNodes=all&slowMo=0`, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
  await p.evaluate((g) => { window.game.config.ARENA.startGap = g; window.game.config.ARENA.startHold = 0; }, gap); // 가슴 사이 gap 에서 시작 (이 상자는 브라우저 물리가 아주 느려 — 걸어 들어갈 시간을 아낌 · cavazione_probe 와 같은 손)
  await p.getByText('여정 시작').tap();
  await p.waitForFunction(() => window.game.state === 'fight' && window.game.playerUnique, null, { timeout: 180000 });
  await p.waitForFunction(() => !window.game.player.openHold && window.game.stats.simTime > 1.5, null, { timeout: 180000 });
  const cdp = await ctx.newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q) => ({ x: q.x, y: q.y, id: q.id })) });
  const TAP = { x: W * 0.66, y: H * 0.32, id: 2 };
  const tap = async () => { await touch('touchStart', [TAP]); await p.waitForTimeout(50); await touch('touchEnd', []); };
  const stickBox = await p.locator('#moveStick').boundingBox();
  const S0 = { x: stickBox.x + stickBox.width / 2, y: stickBox.y + stickBox.height / 2, id: 1 };
  const sim = () => p.evaluate(() => window.game.stats.simTime);
  /** 물리가 n 스텝 넘게 갈 때까지 (손가락 움직임을 게임 화면 박자에 맞춤 — 느린 상자에서 한 화면에 끌기가 몰리지 않게) */
  const frame = async (n = 2) => { const t0 = await sim(); await p.waitForFunction(([t, dt]) => window.game.stats.simTime >= t + dt, [t0, n * (1 / 120)], { timeout: 120000, polling: 'raf' }); };
  const waitSim = async (s) => { const t0 = await sim(); await p.waitForFunction((t) => window.game.stats.simTime >= t, t0 + s, { timeout: 120000, polling: 'raf' }); };
  /** 조이스틱 손가락으로 걸어 들어감 (가슴 사이 gap 까지) */
  const walkIn = async (gap) => {
    await touch('touchStart', [S0]);
    await touch('touchMove', [{ ...S0, y: S0.y - stickBox.height * 0.45 }]);
    try { await p.waitForFunction((g) => window.game.player.foeDistance() <= g, gap, { timeout: 60000, polling: 'raf' }); } catch { /* 벽 · 상대가 물러섬 */ }
    await touch('touchEnd', []);
  };
  return { ctx, p, cdp, touch, tap, TAP, S0, stickBox, sim, waitSim, walkIn, frame };
}

// ── ② 칼끝 돌려 빼기 ── (상대 AI 그대로 — 공격해 옴 · 막기 단추(CDP 손가락 1)를 쥐고 받다가 칼끼리 닿으면 실제 0.45 s 뒤 칼 쪽 화면 탭(CDP 손가락 2 — 막기 쥔 채 · cavHeld))
if (ONLY.includes('cav')) {
  const F = await fight('cav', 1.9);
  const { p, touch, TAP } = F;
  await p.evaluate(() => { const g = window.game; g.player.applyWound = () => {}; });
  const bp = await p.locator('#btnParry').boundingBox();
  const P1 = { x: bp.x + bp.width / 2, y: bp.y + bp.height / 2, id: 1 };
  let res = null;
  for (let k = 0; k < 12 && !res; k++) {
    const n0 = await p.evaluate(() => window.game.playerUnique.stats.fired.cavazione ?? 0);
    await touch('touchStart', [P1]); // 막기 단추를 쥠
    let C = null;
    try { C = await p.waitForFunction(() => { const u = window.game.playerUnique, T = u.touch; return T && !T.cut && !T.cavSpent && u.t - T.t1 < 0.1 ? { t0: T.t0 } : null; }, null, { timeout: 180000, polling: 'raf' }).then((h) => h.jsonValue()); } catch { /* 안 닿음 */ }
    if (C) {
      await p.waitForFunction((t0) => window.game.playerUnique.t - t0 >= 0.45 * 1.1, C.t0, { timeout: 120000, polling: 'raf' }).catch(() => {}); // 닿음 처음부터 실제 0.45 s
      const t1 = await p.evaluate(() => window.game.playerUnique.t);
      await touch('touchMove', [P1, TAP]); // 막기를 쥔 채 둘째 손가락 탭
      await p.waitForTimeout(50);
      await touch('touchMove', [P1]);
      const ok = await p.waitForFunction((n) => (window.game.playerUnique.stats.fired.cavazione ?? 0) > n, n0, { timeout: 60000, polling: 'raf' }).then(() => true, () => false);
      if (ok) {
        await p.waitForFunction(() => !!window.game.player.iai, null, { timeout: 3000, polling: 'raf' }).catch(() => {});
        await shot(p, 'cav_fire_844x390');
        await p.waitForFunction(() => !window.game.player.iai, null, { timeout: 8000, polling: 'raf' }).catch(() => {});
        res = await p.evaluate((t1) => { const g = window.game, u = g.playerUnique, r = g.player.instantResult, A = g.player.instantArc; return { age: +(t1 - u.touch.t0).toFixed(3), touch: { steps: u.touch.steps, cut: u.touch.cut }, touches: u.stats.touches, touchCut: u.stats.touchCut ?? 0, early: u.stats.tapEarly ?? 0, fired: u.stats.fired, armSlow: u.stats.armSlow ?? 0, foeArmSlow: !!g.enemy.flowRecovery, arcOfCav: !!A && A.pts?.length > 0 && g.player.artTech === 'cavazione', hit: r?.hit, zone: r?.zone, tech: r?.tech, cue: g.player.uniqueCue?.text, state: g.player.state }; }, t1);
      }
    }
    await touch('touchEnd', []);
    await F.waitSim(0.5);
  }
  say(`칼끝 돌려 빼기 ${JSON.stringify(res)}`);
  if (!res) errors.push('칼끝 돌려 빼기가 나가지 않음');
  await F.ctx.close();
}

// ── ③ 비껴서며 찌르기 ──
if (ONLY.includes('inq')) {
  const F = await fight('inq', 2.0);
  const { p, touch, S0, stickBox, TAP } = F;
  await p.evaluate(() => { const g = window.game; g.player.applyWound = () => {}; window.inqLog = []; });
  let res = null;
  for (let k = 0; k < 12 && !res; k++) {
    // 상대 칼이 들어오는 걸 막기 단추 눈(위협)으로 기다림
    try { await p.waitForFunction(() => window.game.playerGuard.noThreat === 0, null, { timeout: 240000, polling: 'raf' }); } catch { continue; }
    const n0 = await p.evaluate(() => window.game.playerUnique.stats.fired.inquartata ?? 0);
    const side = k % 2 ? -1 : 1;
    const S1 = { ...S0, x: S0.x + side * stickBox.width * 0.45 };
    await touch('touchStart', [S0]);
    await touch('touchMove', [S1]);
    await touch('touchMove', [S1, TAP]); // 둘째 손가락 — 칼 쪽 화면 탭
    await p.waitForTimeout(50);
    await touch('touchMove', [S1]);
    const ok = await p.waitForFunction((n) => (window.game.playerUnique.stats.fired.inquartata ?? 0) > n, n0, { timeout: 60000, polling: 'raf' }).then(() => true, () => false);
    if (!ok) say(`  비껴서며 찌르기 시도 ${k} 안 나감 ${JSON.stringify(await p.evaluate(() => { const g = window.game; return { nt: +g.playerGuard.noThreat.toFixed(3), sx: g.player.stickX, tap: !!g.player.skill.tap, cool: g.playerUnique.coolLeft('inquartata'), early: g.playerUnique.stats.tapEarly ?? 0, fired: g.playerUnique.stats.fired }; }))}`);
    if (ok) {
      await p.waitForFunction(() => !!window.game.player.iai, null, { timeout: 3000, polling: 'raf' }).catch(() => {});
      await p.waitForTimeout(60);
      await shot(p, 'inq_fire_844x390');
      await p.waitForFunction(() => !window.game.player.iai, null, { timeout: 8000, polling: 'raf' }).catch(() => {});
      await shot(p, 'inq_after_844x390');
      res = await p.evaluate(() => { const g = window.game, u = g.playerUnique, r = g.player.instantResult, A = g.player.instantArc; return { fired: u.stats.fired, arc: A ? { kind: A.kind, share: A.share, pts: A.pts.length } : null, hit: r?.hit, zone: r?.zone, cool: +u.coolLeft('inquartata').toFixed(2), cue: g.player.uniqueCue?.text, state: g.player.state }; });
    }
    await touch('touchEnd', []);
    await F.waitSim(0.4);
  }
  say(`비껴서며 찌르기 ${JSON.stringify(res)}`);
  if (!res) errors.push('비껴서며 찌르기가 나가지 않음');
  await F.ctx.close();
}

// ── ④ 내려 찌르기 (손가락 긋기) ──
if (ONLY.includes('down')) {
  const F = await fight('down', 1.7);
  const { p, touch } = F;
  await p.evaluate(() => { const g = window.game; g.ai.update = () => { g.enemy.move.set(0, 0); g.enemy.handOffset.set(0, -0.45); }; g.player.applyWound = () => {}; g.enemy.applyWound = () => {}; });
  // 화면 끌기 → 손 목표 (input.js: 화면 픽셀 → 패드 m — 화면 높이 기준) · 시작 자리로 천천히 옮긴 뒤(휘두르기 문턱 밑) 멈추고 실제 손 빠르기로 긋기
  const pxPerPad = await p.evaluate(() => { const g = window.game; return g.config.INPUT?.touchPx ?? null; });
  const cx = W * 0.62, cy = H * 0.5;
  const K = 380; // 패드 m 당 화면 px (대략 — 끌기 길이만 가늠)
  const STARTS = { high: 0.28, mid: 0.06, low: -0.18 };
  const DIRS = { '↓': [0, -1], '↙': [-0.7071, -0.7071], '↘': [0.7071, -0.7071], '←': [-1, 0], '↑': [0, 1] };
  const rows = [];
  for (const [hn, hy] of Object.entries(STARTS)) for (const [dn, d] of Object.entries(DIRS)) for (let rep = 0; rep < (['↓', '↙', '↘'].includes(dn) ? +(process.env.DOWN_REP ?? 2) : 1); rep++) {
    await p.waitForFunction(() => !window.game.player.skill.tap && !window.game.player.iai, null, { timeout: 15000, polling: 'raf' }).catch(() => {});
    // 손을 시작 자리로 (느리게 · 손가락 한 번)
    const here = await p.evaluate(() => [window.game.player.handOffset.x, window.game.player.handOffset.y]);
    const sx = (rep % 2 ? -0.12 : 0.12) * (dn === '↓' ? 1 : 0.5);
    const mv = [(sx - here[0]) * K, -(hy - here[1]) * K];
    let x = cx, y = cy;
    await touch('touchStart', [{ x, y, id: 3 }]);
    for (let i = 1; i <= 24; i++) { await touch('touchMove', [{ x: x + (mv[0] * i) / 24, y: y + (mv[1] * i) / 24, id: 3 }]); await F.frame(2); }
    x += mv[0]; y += mv[1];
    await F.frame(12);
    const n0 = await p.evaluate(() => ({ imb: window.game.playerUnique.stats.fired.imbroccata ?? 0, strokes: window.game.playerUnique.stats.strokes }));
    const L = 0.34 * K; // 긋기 길이
    for (let i = 1; i <= 9; i++) { await touch('touchMove', [{ x: x + (d[0] * L * i) / 9, y: y - (d[1] * L * i) / 9, id: 3 }]); await F.frame(2); }
    await touch('touchEnd', []);
    await F.frame(48);
    const n1 = await p.evaluate(() => ({ imb: window.game.playerUnique.stats.fired.imbroccata ?? 0, strokes: window.game.playerUnique.stats.strokes, last: window.game.playerUnique.last && { tech: window.game.playerUnique.last.tech, kind: window.game.playerUnique.last.kind, pad: window.game.playerUnique.last.pad, unique: window.game.playerUnique.last.unique } }));
    rows.push({ start: hn, dir: dn, imb: n1.imb > n0.imb, strokes: n1.strokes - n0.strokes, last: n1.last });
    if (rows.length === 1) await shot(p, 'down_first_844x390');
    await F.waitSim(0.5);
  }
  const by = {};
  for (const r of rows) { const k = `${r.dir}`; by[k] ??= { n: 0, imb: 0, read: 0 }; by[k].n++; if (r.imb) by[k].imb++; if (r.strokes > 0) by[k].read++; }
  say(`내려 찌르기 (긋기 방향마다 — n 시도 · read 긋기로 읽힘 · imb 내려 찌르기): ${JSON.stringify(by)}`);
  for (const r of rows) say(`  ${r.start} ${r.dir} imb ${r.imb} strokes ${r.strokes} ${JSON.stringify(r.last)}`);
  await F.ctx.close();
}

await browser.close();
fs.writeFileSync(`${out}/shots_log.txt`, log.join('\n') + '\n' + (errors.length ? `오류 ${errors.length}\n${errors.join('\n')}\n` : '콘솔 오류 0\n'));
console.log(errors.length ? `FAIL ${errors.length}\n  ${errors.join('\n  ')}` : 'PASS');
