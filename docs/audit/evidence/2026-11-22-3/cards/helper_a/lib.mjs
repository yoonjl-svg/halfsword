// Shared harness: normal game path ('/'), seeded save, fake clock, painting off, real CDP touch events.
// Pattern follows tools/browser/mordschlag_real_check.mjs of the checkout.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

export const CELLS = {
  german: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12'],
  iberian: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12'],
};
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
export { log };

export async function boot(base, school, weapon) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const errors = [];
  await ctx.addInitScript(({ school, cells, weapon }) => {
    if (localStorage.getItem('audit.seeded')) return;
    const acquisitions = [...cells.map((id) => ({ receipt: `skill:${school}:${id}`, kind: 'skill' })), { receipt: `weapon:${weapon}`, kind: 'item' }];
    localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, acquisitions, coins: 100, heads: 0 }));
    localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon }));
    localStorage.setItem('audit.seeded', '1');
  }, { school, cells: CELLS[school], weapon });
  await ctx.addInitScript(() => { window.__ptr = []; for (const ev of ['pointerdown', 'pointerup']) window.addEventListener(ev, (e) => { if (window.__ptr.length < 400) window.__ptr.push([ev === 'pointerdown' ? 'D' : 'U', e.pointerId, e.target?.id || e.target?.tagName, Math.round(e.clientX), Math.round(e.clientY)]); }, true); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && !/deprecated parameters/.test(m.text()) && errors.push(`console ${m.text()}`));
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
    return { state: g.state, weapon: p.weapon?.id, tradition: p.swordArt?.tradition, secret: g.playerSecret?.S?.name ?? null, unique: g.playerUnique?.list?.map((e) => e.name) ?? [], foe: g.enemy?.name, foeWeapon: g.enemy?.weapon?.id, url: location.href };
  });
  const cdp = await ctx.newCDPSession(page);
  const pad = await page.locator('#moveStick').boundingBox();
  const parry = await page.locator('#btnParry').boundingBox().catch(() => null);
  const S = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2, R: pad.width / 2 };
  // touch state: id 1 = left thumb on stick, id 2 = right finger (sword), id 3 = guard button
  const T = { stick: null, sword: null, guard: null };
  const pts = () => [T.stick && { ...T.stick, id: 1 }, T.sword && { ...T.sword, id: 2 }, T.guard && { ...T.guard, id: 3 }].filter(Boolean);
  const send = (type, list) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: list });
  const H = {
    page, ctx, browser, cdp, run, errors, info, S, parry,
    frame: () => run(17),
    // stick: vector (x right, y forward) in stick-radius units, or null to lift
    async stick(v) {
      if (!v) { if (T.stick) { const q = { ...T.stick, id: 1 }; T.stick = null; await send('touchEnd', [q]); } return; }
      const p = { x: S.x + v[0] * S.R * 0.9, y: S.y - v[1] * S.R * 0.9 };
      if (!T.stick) { T.stick = { x: S.x, y: S.y }; await send('touchStart', pts()); }
      T.stick = p; await send('touchMove', pts());
    },
    async swordDown(x, y) { T.sword = { x, y }; await send('touchStart', pts()); },
    async swordMove(x, y) { T.sword = { x, y }; await send('touchMove', pts()); },
    async swordUp() { if (!T.sword) return; const q = { ...T.sword, id: 2 }; T.sword = null; await send('touchEnd', [q]); },
    async guard(on) {
      if (on && !T.guard) { T.guard = { x: parry.x + parry.width / 2, y: parry.y + parry.height / 2 }; await send('touchStart', pts()); }
      if (!on && T.guard) { const q = { ...T.guard, id: 3 }; T.guard = null; await send('touchEnd', [q]); }
    },
    // tap: down and up back to back (real time well under 180 ms), then one frame
    async tap(x, y) { await H.swordDown(x, y); await H.swordUp(); await run(17); },
    async liftAll() { const q = pts(); T.stick = T.sword = T.guard = null; if (q.length) await send('touchEnd', q); },
    async shot(path) { await page.evaluate(() => { window.__paint = true; }); await run(17); await page.screenshot({ path }); await page.evaluate(() => { window.__paint = false; }); },
    async close() { await browser.close().catch(() => {}); },
  };
  log('booted', JSON.stringify(info));
  return H;
}

// installed in page: per-frame snapshot of the signals
export async function installRec(page) {
  await page.evaluate(() => {
    const g = window.game, p = g.player;
    window.__cues = [];
    let lastCue = null, lastHud = '';
    window.__rec = () => {
      const U = g.playerUnique, W = g.playerSecret, gt = p.gait, hud = document.querySelector('#techSlot .slot')?.textContent?.trim() ?? '';
      const uc = p.uniqueCue;
      if (uc && uc !== lastCue) { lastCue = uc; window.__cues.push({ t: +p.fightT.toFixed(3), name: uc.name, text: uc.text, kind: uc.kind }); }
      if (hud !== lastHud) { lastHud = hud; window.__cues.push({ t: +p.fightT.toFixed(3), hud }); }
      return {
        t: +p.fightT.toFixed(3), hand: [+p.handOffset.x.toFixed(3), +p.handOffset.y.toFixed(3)], d: +p.foeDistance().toFixed(3),
        swing: !!p.skill.swinging, tap: !!p.skill.tap, sec: p.skill.sec?.stage ?? null, phase: p.skill.secretPhase ?? null,
        cur: U?.cur ? { tech: U.cur.tech, pad: U.cur.pad, unique: U.cur.unique ?? null } : null,
        uniqR: U?.r?.e?.name ?? null, hold: U?.hold?.st ?? null, winding: !!U?.winding, link: U?.link?.phase ?? null,
        open: !!W?.open, openEv: W?.open?.ctx?.ev ?? null, armed: !!W?.spinArm?.armed, pressT: +(W?.pressT ?? 0).toFixed(2),
        burst: gt?.burst ? { fore: gt.burst.fore, side: gt.burst.side, dig: gt.burst.dig ?? 0 } : null, fastK: +(gt?.fastK ?? 1).toFixed(2), walking: !!gt?.walking, fastDir: gt?.fastDir ?? null, fastSide: gt?.fastSide ?? null, pushN: p.stamina.counts?.push ?? null, burstLeg: !!gt?.burstLeg,
        ibFlowOn: !!p.ibFlowOn, ibCutN: p.ibCutN ?? 0, ibLink: !!p.ibLink, st: +p.stamina.value.toFixed(1), stand: p.state, foeState: g.enemy?.state, hud,
        dupSt: +(U?.dupA?.st ?? 0).toFixed(2), dupWhy: U?.dupWhy ?? null, touch: !!U?.bladeTouch?.(),
      };
    };
    // observe-only hook: record the burst object at the moment a step uses it (gait.fastBegin) — does not change arguments or result
    window.__bursts = [];
    const gt = p.gait, fb = gt.fastBegin.bind(gt);
    gt.fastBegin = (...a) => { const B = gt.burst; const r = fb(...a); if (B) window.__bursts.push({ t: +p.fightT.toFixed(3), fore: B.fore, side: B.side, dig: B.dig ?? 0, fastK: +(gt.fastK ?? 1).toFixed(2) }); return r; };
    window.__stats = () => { const U = g.playerUnique; return { fired: { ...(U?.stats?.fired ?? {}) }, link: U?.stats?.link ? { fired: U.stats.link.fired, tech: { ...U.stats.link.tech } } : null, autoFired: U?.stats?.autoFired ?? 0, bursts: window.__bursts.slice(), holdRefused: U?.stats?.holdRefused ?? 0 }; };
  });
}
export const rec = (page) => page.evaluate(() => window.__rec());
export const cues = (page) => page.evaluate(() => window.__cues.splice(0));
export const ptrLog = (page) => page.evaluate(() => window.__ptr.splice(0));
export const stats = (page) => page.evaluate(() => window.__stats());
