// hlib.mjs — real page + real touch events + frame-stepped clock (pattern of tools/browser/mordschlag_real_check.mjs)
//  boot({ base, school, cells, weapon, freezeFoe }) -> { page, cdp, run, touch, tap, swipe, drag, hold, stick, snap, ev, close }
//  The game is entered the normal way: title -> 'Stage 1' -> fight, with skills and the weapon pre-filled in the lobby save.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function boot({ base, school = 'german', cells = [], weapon = 'longsword', freezeFoe = true, settle = 6000, tearOff = false, stopAt = 'fight', atkStick = false }) { // weapon: null = nothing equipped in the lobby (the game then deals weapon cards: state 'draw') · stopAt: 'draw' hands the page over at the cards
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(({ school, cells, weapon, tearOff, atkStick }) => {
    if (localStorage.getItem('audit.seeded')) return;
    const acquisitions = [...cells.map((id) => ({ receipt: `skill:${school}:${id}`, kind: 'skill' })), ...(weapon ? [{ receipt: `weapon:${weapon}`, kind: 'item' }] : [])];
    localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, acquisitions, coins: 100, heads: 0 }));
    if (weapon) localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon }));
    if (tearOff) localStorage.setItem('stillness.lobby.neck.v1', JSON.stringify({ version: 1, neck: null })); // take off the default necklace (infinite stamina) — a player can do this in the lobby
    if (atkStick) localStorage.setItem('gladiator-settings', JSON.stringify({ atkStick: true })); // the settings switch 'attack stick' (off by default) saved as on
    localStorage.setItem('audit.seeded', '1');
  }, { school, cells, weapon, tearOff, atkStick });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
  await page.clock.install({ time: new Date('2026-11-22T12:00:00') });
  await page.clock.pauseAt(new Date('2026-11-22T12:00:01'));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const run = (ms) => page.clock.runFor(ms);
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player)); i++) await run(100);
  await page.evaluate(() => { window.__paint = false; window.game.renderCap.tick = () => window.__paint; });
  const tapSel = async (sel) => { const L = page.locator(sel).first(); if (!(await L.isVisible().catch(() => false))) return false; const b = await L.boundingBox({ timeout: 500 }).catch(() => null); if (!b) return false; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return true; };
  if (await page.locator('#noticeDialog').evaluate((d) => d.open).catch(() => false)) await tapSel('#confirmNotices');
  await run(2500);
  await tapSel('#newJourney');
  for (let i = 0; i < 400 && !(await page.evaluate((st) => window.game?.state === 'fight' || window.game?.state === st, stopAt)); i++) {
    await run(100);
    if (i % 20 === 5) for (const s of ['#confirmNotices', '#newJourney']) await tapSel(s).catch(() => {});
  }
  const state = await page.evaluate(() => window.game?.state);
  if (state !== 'fight' && state !== stopAt) { await browser.close(); throw new Error('did not reach fight: ' + state); }
  if (freezeFoe && state === 'fight') await page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); });
  // event counters the page itself sees (what reached the DOM) — for the wiring checks
  await page.evaluate(() => { window.__ev = { down: 0, up: 0, cancel: 0, move: 0 }; const c = document.getElementById('game'); c.addEventListener('pointerdown', () => window.__ev.down++); window.addEventListener('pointermove', () => window.__ev.move++, true); window.addEventListener('pointerup', () => window.__ev.up++); window.addEventListener('pointercancel', () => window.__ev.cancel++); });
  const cdp = await ctx.newCDPSession(page);
  const pad = await page.locator('#moveStick').boundingBox();
  const SC = pad ? { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2, r: pad.width / 2 } : { x: 86, y: 304, r: 66 }; // the stick is hidden while the cards are up — use where it will be
  const pts = new Map(); // live touch points by id
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()] });
  const down = async (id, x, y) => { pts.set(id, { x, y, id }); await send('touchStart'); };
  const move = async (id, x, y) => { pts.set(id, { x, y, id }); await send('touchMove'); };
  // moveSync: the same, but waits until the page has really seen the move before the next frame is stepped
  //  (a move can reach the page a little after the call returns; when that happens two moves fall into one frame — found 11/22 with probe7)
  const moveSync = async (id, x, y) => { const n0 = await page.evaluate(() => window.__ev.move); await move(id, x, y); for (let i = 0; i < 80; i++) { if ((await page.evaluate(() => window.__ev.move)) > n0) return i; } return -1; };
  // CDP: a touchEnd lists the point(s) being LIFTED (listing the remaining ones lifts those instead — checked with a pointer-event log)
  const up = async (id) => { const p = pts.get(id); pts.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [p] : [] }); };
  const cancel = async () => { pts.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); };
  if (state === 'fight') await run(settle); // opening camera + first stance
  const snap = () => page.evaluate(() => {
    const g = window.game, p = g.player, e = g.enemy, sk = p.skill, st = p.stamina, G = g.playerGuard, W = g.playerSecret;
    const tp = sk.tap;
    return {
      state: g.state, d: +p.foeDistance().toFixed(2), ps: p.state, es: e.state,
      tap: tp ? { down: !!tp.down, cleave: !!tp.cleave, head: !!tp.head, vital: !!tp.vital, it: !!tp.it, drive: !!tp.drive } : null,
      thrusts: sk.thrusts ?? 0, vital: sk.vitalThrusts ?? 0, swinging: !!sk.swinging, pom: !!sk.pom, flick: !!sk.flick,
      sec: sk.sec?.stage ?? null, secPhase: sk.secretPhase ?? null, secOpen: !!W?.open, secName: W?.S?.name ?? null,
      counts: st.counts ? { ...st.counts } : null, spent: st.spent ? Object.fromEntries(Object.entries(st.spent).map(([k, v]) => [k, +(+v).toFixed(2)])) : null,
      stam: +st.value.toFixed(1), exhausted: !!st.exhausted,
      hand: [+p.handOffset.x.toFixed(3), +p.handOffset.y.toFixed(3)], mv: [+p.move.x.toFixed(2), +p.move.y.toFixed(2)], run: !!p.run?.on, runHold: +(p.run?.hold ?? 0).toFixed(2),
      guard: G ? { held: !!G.held, broken: !!G.broken } : null, handHeld: !!p.handHeld, grip: !!p.handGrip, autoPick: !!p.autoPick,
      iai: !!p.iai, iaiDraw: !!p.iaiDraw, rdWind: !!p.rdWind, winding: !!sk.uniq?.winding,
      cue: (document.getElementById('techSlot')?.innerText ?? '').trim().replace(/\s+/g, ' '), guardName: (document.getElementById('guardName')?.innerText ?? '').trim(),
      shots: p.gun?.shots ?? p.shots ?? null, ev: { ...window.__ev },
    };
  });
  const frames = async (n, each) => { for (let i = 0; i < n; i++) { await run(17); if (each) await each(i); } };
  // gestures (sword finger id 2, stick thumb id 1)
  const tap = async (x = 620, y = 200) => { await down(2, x, y); await run(17); await up(2); await run(17); };
  const swipe = async (x0, y0, x1, y1, steps = 4) => { await down(2, x0, y0); await run(17); for (let k = 1; k <= steps; k++) { await move(2, x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps); await run(17); } await up(2); await run(17); };
  const drag = async (x0, y0, x1, y1, steps = 40) => { await down(2, x0, y0); await run(17); await sleep(260); for (let k = 1; k <= steps; k++) { await move(2, x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps); await run(17); } };
  const stick = async (fx, fy) => { if (!pts.has(1)) { await down(1, SC.x, SC.y); await run(17); } await move(1, SC.x + fx * SC.r, SC.y - fy * SC.r); await run(17); };
  const stickUp = async () => { if (pts.has(1)) { await up(1); await run(17); } };
  return { browser, page, cdp, run, frames, down, move, moveSync, up, cancel, tap, swipe, drag, stick, stickUp, snap, SC, errors, close: () => browser.close() };
}
