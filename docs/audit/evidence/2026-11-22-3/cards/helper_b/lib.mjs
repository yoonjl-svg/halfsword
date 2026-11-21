// Shared harness: normal game path, fake clock, real CDP touch events. Read-only probe of window.game.
// Usage from a scenario script: const H = await boot({ base, school, cells, weapon });
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function boot({ base, school, cells, weapon, log = () => {} }) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  await ctx.addInitScript(({ school, cells, weapon }) => {
    if (localStorage.getItem('audit.seeded')) return;
    const acquisitions = [...cells.map((id) => ({ receipt: `skill:${school}:${id}`, kind: 'skill' })), { receipt: `weapon:${weapon}`, kind: 'item' }];
    localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, acquisitions, coins: 100, heads: 0 }));
    localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon }));
    localStorage.setItem('audit.seeded', '1');
  }, { school, cells, weapon });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
  await page.clock.install({ time: new Date('2026-10-31T12:00:00') });
  await page.clock.pauseAt(new Date('2026-10-31T12:00:01'));
  await page.goto(`${base}/`, { waitUntil: 'networkidle' });
  const run = (ms) => page.clock.runFor(ms);
  for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player)); i++) await run(100);
  await page.evaluate(() => { window.__paint = false; window.game.renderCap.tick = () => window.__paint; });
  const tapSel = async (sel) => { const L = page.locator(sel).first(); if (!(await L.isVisible().catch(() => false))) return false; const b = await L.boundingBox({ timeout: 500 }).catch(() => null); if (!b) return false; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return true; };
  if (await page.locator('#noticeDialog').evaluate((d) => d.open).catch(() => false)) await tapSel('#confirmNotices');
  await run(2500);
  await tapSel('#newJourney');
  for (let i = 0; i < 400 && !(await page.evaluate(() => window.game?.state === 'fight')); i++) {
    await run(100);
    if (i % 20 === 5) for (const s of ['#confirmNotices', '#newJourney']) await tapSel(s).catch(() => {});
  }
  const info = await page.evaluate(() => {
    const g = window.game, p = g.player;
    return { state: g.state, weapon: p.weapon?.id, tradition: p.swordArt?.tradition, secret: g.playerSecret?.S?.name ?? null, uniques: (g.playerUnique?.list ?? []).map((e) => e.name), foe: g.enemy?.name, foeWeapon: g.enemy?.weapon?.id, url: location.href };
  });
  log('boot', JSON.stringify(info));
  // recorder (reads only)
  await page.evaluate(() => {
    const g = window.game;
    window.__rec = () => {
      const p = g.player, e = g.enemy, U = g.playerUnique, S = g.playerSecret, G = g.playerGuard;
      const slot = document.querySelector('#techSlot .slot');
      return {
        t: +p.fightT?.toFixed?.(3), d: +p.foeDistance().toFixed(3),
        hand: [+p.handOffset.x.toFixed(3), +p.handOffset.y.toFixed(3)], stick: [+(p.stickX ?? 0).toFixed(2), +(p.stickY ?? 0).toFixed(2)],
        swinging: !!p.skill.swinging, tap: !!p.skill.tap, sec: p.skill.sec?.stage ?? null, secretPhase: p.skill.secretPhase ?? null,
        fired: { ...(U?.stats?.fired ?? {}) }, cue: p.uniqueCue ? p.uniqueCue.name + '|' + p.uniqueCue.text + '|' + (+p.uniqueCue.t).toFixed(3) : null,
        cur: U?.cur ? { tech: U.cur.tech, pad: U.cur.pad, kind: U.cur.kind, unique: U.cur.unique, dir: U.cur.dir.map((v) => +v.toFixed(2)), start: U.cur.start?.map((v) => +v.toFixed(2)), t0: +U.cur.t0.toFixed(3) } : null,
        last: U?.last ? { tech: U.last.tech, pad: U.last.pad, unique: U.last.unique, landed: U.last.landed, bound: U.last.bound, t0: +U.last.t0.toFixed(3), tEnd: U.last.tEnd != null ? +U.last.tEnd.toFixed(3) : null } : null,
        touch: U?.touch ? { t0: +U.touch.t0.toFixed(3), t1: +U.touch.t1.toFixed(3), cut: !!U.touch.cut, spent: !!U.touch.cavSpent } : null, uqT: +(U?.t ?? 0).toFixed(3),
        cool: Object.fromEntries(Object.entries(U?.coolT ?? {}).map(([k, v]) => [k, Number.isFinite(v) ? +v.toFixed(2) : String(v)])),
        hud: slot?.textContent ?? '', guardName: document.querySelector('#guardName')?.textContent ?? '',
        gHeld: !!G?.held, gBroken: !!G?.broken, gMode: G?.mode ?? null, noThreat: G?.noThreat != null ? +G.noThreat.toFixed(3) : null, threatId: G?.threatId ?? null,
        oppStarts: G?.opposition?.starts ?? null, oppRun: !!G?.opposition?.run,
        secOpen: !!S?.open, secOpened: S?.opened ?? 0, secName: S?.S?.name ?? null, armed: !!S?.iaiArm?.armed, armT: +(S?.iaiArm?.t ?? 0).toFixed(2),
        gk: S?.pc?.gk ? { ...S.pc.gk, stance: undefined, by: undefined } : null,
        riso: S?.riso ? { on: !!S.riso.on, held: +(S.riso.held ?? 0).toFixed(2), d: Number.isFinite(S.riso.d) ? +S.riso.d.toFixed(3) : null, ends: { ...S.riso.ends }, gapBlocked: S.riso.gapBlocked ?? 0 } : null, foeMoveY: +(e.move?.y ?? 0).toFixed(2),
        iai: !!p.iai, iaiDraw: !!p.iaiDraw, stam: +p.stamina.value.toFixed(1), exhausted: !!p.stamina.exhausted, secretReady: !!p.stamina.secretReady,
        foeState: e.state, foeAtk: g.ai?.phase ?? null, foeSwing: !!e.skill?.swinging, foeTip: null, pState: p.state, alive: p.alive && e.alive, state: g.state,
      };
    };
  });
  await page.evaluate(() => { window.__plog = []; for (const ev of ['pointerdown', 'pointerup']) window.addEventListener(ev, (e) => { if (e.pointerType === 'touch') window.__plog.push([ev, e.pointerId, e.target?.id || e.target?.tagName, Math.round(e.clientX), Math.round(e.clientY)]); }, true); });
  const plog = () => page.evaluate(() => window.__plog.splice(0));
  const cdp = await ctx.newCDPSession(page);
  const pad = await page.locator('#moveStick').boundingBox();
  const btn = await page.locator('#btnParry').boundingBox().catch(() => null);
  const S = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2 };
  const active = new Map(); // id -> {x,y}
  const pts = () => [...active.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id }));
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts() });
  const T = {
    async down(id, x, y) { active.set(id, { x, y }); await send('touchStart'); },
    async move(id, x, y) { active.set(id, { x, y }); await send('touchMove'); },
    async up(id) { const p = active.get(id); active.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: p.x, y: p.y, id }] }); }, // CDP touchEnd lifts the LISTED point
    has: (id) => active.has(id), pos: (id) => active.get(id),
  };
  const frames = [];
  const frame = async (n = 1) => { let r; for (let i = 0; i < n; i++) { await run(17); r = await page.evaluate(() => window.__rec()); frames.push(r); } return r; };
  const rec = () => page.evaluate(() => window.__rec());
  // stick: id 1. dir = [x(+right), y(+forward)] in -1..1
  const stick = async (dir) => {
    const R = pad.width * 0.45;
    const p = { x: S.x + dir[0] * R, y: S.y - dir[1] * R };
    if (!dir[0] && !dir[1]) { if (T.has(1)) await T.up(1); return; }
    if (!T.has(1)) { await T.down(1, S.x, S.y); await frame(); }
    await T.move(1, p.x, p.y);
  };
  // sword finger: id 2. tap = down/up with one 17 ms game frame between (real time measured)
  const tap = async (x = 640, y = 170) => {
    const t0 = Date.now();
    await T.down(2, x, y); await run(17); await T.up(2);
    const realMs = Date.now() - t0;
    return { realMs, x, y };
  };
  // move hand (handOffset, pad metres) slowly to target with the finger held; returns final hand
  const SC = 2.6 / 390, GY = 1.35;
  const steer = async (target, { x0 = 620, y0 = 190, maxF = 90, tol = 0.03, stepPx = 2 } = {}) => {
    if (!T.has(2)) { await T.down(2, x0, y0); await frame(); }
    let r = await rec();
    for (let i = 0; i < maxF; i++) {
      const ex = target[0] - r.hand[0], ey = target[1] - r.hand[1];
      if (Math.hypot(ex, ey) < tol) break;
      let px = ex / SC, py = -ey / (SC * GY);
      const L = Math.hypot(px, py), k = L > stepPx ? stepPx / L : 1;
      const p = T.pos(2);
      await T.move(2, p.x + px * k, p.y + py * k);
      r = await frame();
    }
    await frame(3); // settle (finger still, not swinging)
    return (await rec()).hand;
  };
  // fast swipe from current finger position in screen direction (dx right, dy down px per step)
  const swipe = async (dir, { steps = 4, px = 24, release = true } = {}) => {
    const L = Math.hypot(dir[0], dir[1]);
    const ux = dir[0] / L, uy = dir[1] / L;
    const out = [];
    for (let k = 0; k < steps; k++) { const p = T.pos(2); await T.move(2, p.x + ux * px, p.y + uy * px); out.push(await frame()); }
    if (release) { await T.up(2); }
    return out;
  };
  const guardDown = async () => { await T.down(3, btn.x + btn.width / 2, btn.y + btn.height / 2); };
  const guardUp = async () => { if (T.has(3)) await T.up(3); };
  const shot = async (path) => { await page.evaluate(() => { window.__paint = true; }); await run(17); await page.screenshot({ path }); await page.evaluate(() => { window.__paint = false; }); };
  const close = async () => { for (const id of [...active.keys()]) await T.up(id).catch(() => {}); await browser.close(); };
  return { plog, browser, page, info, errors, run, frame, rec, frames, T, stick, tap, steer, swipe, guardDown, guardUp, shot, close, pad, btn };
}

/** diff of fired counters */
export const firedDiff = (a, b) => { const o = {}; for (const k of new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})])) { const d = (b?.[k] ?? 0) - (a?.[k] ?? 0); if (d) o[k] = d; } return o; };
