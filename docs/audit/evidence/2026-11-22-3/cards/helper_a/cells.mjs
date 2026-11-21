// Skill-card input check (German G1 G2 G5 G8 G7 G10, Iberian B2 B3 B4 B5 B7) — real page, real CDP touch, fake clock.
// usage: node cells.mjs <baseUrl> <outDir> [cell,cell,...]
// Every run is a fresh page on the normal path ('/', seeded save, all 12 cells of the school, a school weapon).
import fs from 'node:fs';
import { boot, installRec, rec, cues, stats, log, ptrLog } from './lib.mjs';
let lastPtr = null;

const base = (process.argv[2] || 'http://127.0.0.1:5310').replace(/\/$/, '');
const out = process.argv[3] || 'out';
const only = process.argv[4] ? process.argv[4].split(',') : null;
fs.mkdirSync(out, { recursive: true });
const WEAPON = { german: 'longsword', iberian: process.env.IB_WEAPON || 'zweihander' };
const PX = 2.6 / 390; // pad metres per touch px (INPUT.touchSensitivity / viewport height — mobile_intent.js)
const SW0 = { x: 600, y: 200 }; // right-hand finger start (sword side)

// ── helpers ──
async function settle(H, n) { const fr = []; for (let i = 0; i < n; i++) { await H.frame(); fr.push(await rec(H.page)); } return fr; }
// put the hand near a pad target with a SLOW drag (below swing speed) — finger stays down
async function placeHand(H, target, start = SW0, maxF = 120) {
  let p = { ...start };
  await H.swordDown(p.x, p.y);
  await H.frame();
  for (let i = 0; i < maxF; i++) {
    const r = await rec(H.page);
    const ex = target[0] - r.hand[0], ey = target[1] - r.hand[1];
    if (Math.hypot(ex, ey) < 0.03) break;
    const kx = Math.max(-2, Math.min(2, ex / PX)), ky = Math.max(-2, Math.min(2, -ey / PX));
    p = { x: p.x + kx, y: p.y + ky };
    await H.swordMove(p.x, p.y);
    await H.frame();
  }
  await settle(H, 8); // let any slow motion stop
  return p;
}
// fast drag: n frames of (dx,dy) px each, then lift
async function swipe(H, p, dx, dy, n = 4, lift = true) {
  const fr = [];
  for (let k = 1; k <= n; k++) { await H.swordMove(p.x + dx * k, p.y + dy * k); await H.frame(); fr.push(await rec(H.page)); }
  if (lift) await H.swordUp();
  return { fr, end: { x: p.x + dx * n, y: p.y + dy * n } };
}
async function startRun(school, waitF) {
  const H = await boot(base, school, WEAPON[school]);
  await installRec(H.page);
  await ptrLog(H.page);
  const close0 = H.close;
  H.close = async () => { lastPtr = await ptrLog(H.page).catch(() => null); await close0(); };
  if (H.info.state !== 'fight') throw new Error('no fight');
  await settle(H, waitF); // past the round-start freeze
  await cues(H.page);
  return H;
}
const firstCue = (cs, pred) => cs.find((c) => c.name && pred(c));
const hudList = (cs) => [...new Set(cs.filter((c) => c.hud).map((c) => c.hud))];

// ── scenarios: each returns an observation object ──
const SC = {};

// G1: from standstill, stick back (↓)
SC.G1 = async (run, variant) => {
  const H = await startRun('german', 150 + run * 9);
  const v = variant ? [-0.8, -0.6] : [run === 1 ? 0.15 : 0, -1];
  const r0 = await rec(H.page);
  await H.stick(v);
  const fr = await settle(H, 60);
  await H.stick(null);
  const cs = await cues(H.page);
  const bursts = (await stats(H.page)).bursts;
  const set = fr.find((f) => f.pushN > r0.pushN);
  const fast = (await stats(H.page)).bursts.find((b) => b.fore === -1 && !b.side);
  await H.close();
  return { precondition: 'game path; standing still at round start, foe far', touch: `stick touchStart at centre, touchMove to (${v}) of radius, held 60 frames`, stillBefore: !r0.walking, signal: { burstsUsed: bursts, fastStep: fast ? { t: fast.t, fastK: fast.fastK } : null }, hud: hudList(cs), fired: !!fast, staminaNote: 'stamina is infinite in this stage (stamina.infinite true) so the push charge is not counted; fast burst step (gait.fastK>1 with the burst direction) is the signal', errors: H.errors };
};
// G2: from standstill, stick forward (↑)
SC.G2 = async (run, variant) => {
  const H = await startRun(variant === 'iberianControl' ? 'iberian' : 'german', 150 + run * 9);
  const v = variant === 'half' ? [0, 0.5] : [run === 1 ? 0.15 : 0, 1];
  const r0 = await rec(H.page);
  await H.stick(v);
  const fr = await settle(H, 60);
  await H.stick(null);
  const cs = await cues(H.page);
  const bursts = (await stats(H.page)).bursts;
  const set = fr.find((f) => f.pushN > r0.pushN);
  const fast = fr.filter((f) => f.fastK > 1 && f.fastDir > 0);
  const dig = bursts.filter((b) => b.fore === 1 && b.dig > 0);
  await H.close();
  return { precondition: 'game path; standing still at round start, foe far', touch: `stick to (${v}) of radius, held 60 frames`, signal: { burstsUsed: bursts, fastFrames: fast.length, firstFast: fast[0]?.t ?? null }, hud: hudList(cs), fired: dig.length > 0, staminaNote: 'stamina infinite in this stage; signal = burst objects used by a step (dig>0 = dig-in) — fastK>1 alone also occurs on a plain forward start', errors: H.errors };
};
// swipe-stroke cells: G5 / G8 / B3
async function strokeCell(school, expect, { stick = null, pad = null, dir, run, variant }) {
  const H = await startRun(school, 150 + run * 9);
  if (stick) { await H.stick(stick); await settle(H, 10); }
  const start = { x: SW0.x + run * 6, y: SW0.y - run * 5 };
  let p = start;
  if (pad) p = await placeHand(H, pad, start);
  else { await H.swordDown(p.x, p.y); await settle(H, 6); }
  const at = await rec(H.page);
  const s = await swipe(H, p, dir[0], dir[1], 4);
  const fr = await settle(H, 50);
  if (stick) await H.stick(null);
  const cs = await cues(H.page);
  const st = await stats(H.page);
  const cur = [...s.fr, ...fr].find((f) => f.cur)?.cur ?? null;
  const c = firstCue(cs, (x) => x.name === expect);
  await H.close();
  return { precondition: 'game path; foe far (no contact needed)', touch: `${stick ? `stick held at (${stick}); ` : ''}right finger down at (${start.x},${start.y})${pad ? `, slow drag (<=2 px/frame) until hand target within 0.03 m of pad [${pad}]` : ' (no positioning)'}, then 4 frames of (${dir}) px per 17 ms frame, lift`, handAtSwipe: at.hand, strokeRead: cur, signal: { cue: c ?? null, fired: st.fired }, hud: hudList(cs), allCues: cs.filter((x) => x.name), fired: !!c, errors: H.errors };
}
// G5: ↙ swipe (start: right shoulder roof tagR [0.42,0.42], the zornhau start pad)
SC.G5 = (run, variant) => strokeCell('german', 'schielhau', variant === 'mirror' ? { pad: [-0.4, 0.42], dir: [25, 25], run } : variant ? { pad: null, dir: [-25, 25], run } : { pad: [0.42, 0.42], dir: [-25, 25], run });
// G8: stick side + ← swipe from side guard sideR [0.52,0.06]
SC.G8 = (run, variant) => strokeCell('german', 'zwerchAbtritt', variant ? { stick: [1, 0], pad: null, dir: [-35, 0], run } : { stick: [run === 1 ? -1 : 1, 0], pad: [0.52, 0.06], dir: [-35, 0], run });
// B3: stick side + ↙ swipe from tagR
SC.B3 = (run, variant) => strokeCell('iberian', 'talhoRodeado', variant ? { stick: [1, 0], pad: null, dir: [-25, 25], run } : { stick: [run === 1 ? -1 : 1, 0], pad: [0.42, 0.42], dir: [-25, 25], run });

// B2: stick side from standstill
SC.B2 = async (run, variant) => {
  const H = await startRun('iberian', 150 + run * 9);
  const v = variant ? [0.8, 0.5] : [run === 1 ? -1 : 1, run === 2 ? 0.1 : 0];
  const r0 = await rec(H.page);
  await H.stick(v);
  const fr = await settle(H, 60);
  await H.stick(null);
  const cs = await cues(H.page);
  const bursts = (await stats(H.page)).bursts;
  const set = fr.find((f) => f.pushN > r0.pushN);
  const fast = fr.filter((f) => f.fastK > 1 && f.fastSide);
  const sideB = bursts.filter((b) => b.side);
  await H.close();
  return { precondition: 'game path; standing still at round start, foe far', touch: `stick to (${v}) of radius, held 60 frames`, signal: { burstsUsed: bursts, fastFrames: fast.length }, hud: hudList(cs), fired: sideB.length > 0, staminaNote: 'stamina infinite in this stage; signal = side burst object used by a step', errors: H.errors };
};

// G10: walk in with stick forward and keep pushing while bodies touch -> window -> swipe
SC.G10 = async (run, variant, forced) => {
  const H = await startRun('german', 150 + run * 9);
  if (forced) await H.page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); });
  const closeN = await H.page.evaluate(() => window.game.config.SECRET.mordCloseN);
  const fwd = [run === 1 ? 0.12 : 0, 1];
  await H.stick(fwd);
  let fr = [], firstClose = null, openAt = null, fireT = null, phaseSeen = [], released = false;
  for (let f = 0; f < 60 * 30; f++) {
    await H.frame();
    const r = await rec(H.page);
    fr.push(r);
    if (firstClose == null && r.d <= closeN) firstClose = r.t;
    if (variant && firstClose != null && !released) { await H.stick(null); released = true; } // variant: bodies touching but stick let go
    if (r.open && r.openEv && openAt == null) {
      openAt = { t: r.t, ev: r.openEv, pressT: r.pressT, d: r.d };
      const A = { x: 640 + run * 5, y: 150 };
      await H.swordDown(A.x, A.y); await H.frame();
      for (let k = 1; k <= 3; k++) { await H.swordMove(A.x - 35 * k, A.y + 30 * k); await H.frame(); }
      await H.swordUp();
      fireT = r.t;
    }
    if (r.sec && !phaseSeen.includes(r.sec)) phaseSeen.push(r.sec);
    if (openAt && fr.length > 0 && !r.sec && phaseSeen.length && f > 30) break;
    if (variant && firstClose != null && r.t - firstClose > 6) break;
    if (r.stand !== 'stand' && !openAt && f > 600) break;
  }
  await H.stick(null);
  const cs = await cues(H.page);
  // longest run of consecutive close frames before the window
  let best = 0, cur = 0; for (const r of fr) { if (openAt && r.t >= openAt.t) break; cur = r.d <= closeN ? cur + 1 : 0; best = Math.max(best, cur); }
  await H.close();
  return { precondition: forced ? 'forced: foe AI frozen (stands still)' : 'game path; real foe AI', touch: `stick to (${fwd}) held ${variant ? 'until chests within closeN, then lifted' : 'throughout'}; when window opens: right finger 3 frames of (-35,+30) px, lift`, closeN, firstCloseT: firstClose, window: openAt, secondsFromFirstClose: openAt && firstClose != null ? +(openAt.t - firstClose).toFixed(2) : null, longestCloseRunS: +(best * 17 / 1000 * 1.1).toFixed(2), stages: phaseSeen, hud: hudList(cs), allCues: cs.filter((x) => x.name), fired: !!openAt && phaseSeen.length > 0, opened: !!openAt, errors: H.errors };
};

// G7: auto on blade contact at 1.0-1.6 m — walk in, hold the guard button, let the real AI attack
SC.G7 = async (run, variant, forced) => {
  const H = await startRun('german', 150 + run * 9);
  const res = { precondition: forced ? 'forced: foe AI frozen; ' : 'game path; real foe AI; ', touch: '' };
  if (forced) await H.page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); });
  await H.stick([0, 1]);
  let r = await rec(H.page);
  for (let f = 0; f < 600 && r.d > 1.45 - run * 0.05; f++) { await H.frame(); r = await rec(H.page); }
  await H.stick(null);
  const reachT = r.t, reachD = r.d;
  if (!variant) await H.guard(true);
  else if (variant === 'push') { // forced variant: slow drag of the sword forward/left into the foe blade
    await H.swordDown(SW0.x, SW0.y); await H.frame();
  }
  const fr = []; let fired = null; let p = { ...SW0 };
  for (let f = 0; f < 60 * 20; f++) {
    if (variant === 'push' && f % 2 === 0 && f < 200) { p = { x: p.x - 1, y: p.y - 1 }; await H.swordMove(p.x, p.y); }
    await H.frame();
    const x = await rec(H.page);
    fr.push(x);
    const st = await stats(H.page);
    if (st.fired.duplieren) { fired = { t: x.t, why: x.dupWhy, d: x.d }; break; }
    if (x.stand !== 'stand') break;
  }
  await H.guard(false); await H.swordUp();
  const cs = await cues(H.page);
  const touchFrames = fr.filter((x) => x.touch);
  const inBand = touchFrames.filter((x) => x.d > 1.0 && x.d <= 1.6);
  await H.close();
  res.precondition += 'walked in with stick ↑ until chests ≈ 1.4 m';
  res.touch = `stick (0,1) until d<=${(1.45 - run * 0.05).toFixed(2)} m, lifted; then ${variant === 'push' ? 'right finger slow drag up-left 1 px / 2 frames for 200 frames' : variant ? 'nothing (no guard)' : 'guard button held (touch id 3)'} for up to 20 s`;
  return { ...res, reach: { t: reachT, d: reachD }, bladeTouchFrames: touchFrames.length, touchFramesInBand: inBand.length, maxDupStack: Math.max(0, ...fr.map((x) => x.dupSt)), signal: fired, hud: hudList(cs), allCues: cs.filter((x) => x.name), fired: !!fired, errors: H.errors };
};

// B4: stay outside blade length 2 s -> armed window ('altib') -> press still >= 0.6 s -> release
SC.B4 = async (run, variant, forced) => {
  const H = await startRun('iberian', 120 + run * 9);
  if (forced) await H.page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); });
  const t0 = (await rec(H.page)).t;
  let r, openAt = null;
  for (let f = 0; f < 60 * 12; f++) { await H.frame(); r = await rec(H.page); if (r.openEv === 'altib') { openAt = { t: r.t, d: r.d }; break; } }
  const o = { precondition: forced ? 'forced: foe AI frozen (keeps distance)' : 'game path; real foe AI', window: openAt, waitedFromRecordStartS: openAt ? +(openAt.t - t0).toFixed(2) : null };
  if (!openAt) { await H.close(); return { ...o, touch: 'none (window never opened)', fired: false, errors: H.errors }; }
  const P = { x: 620 + run * 7, y: 180 + run * 4 };
  const fr = [];
  if (variant === 'swipe') {
    o.touch = 'window open → fast swipe (4 frames of -25,+25 px) instead of a hold';
    await H.swordDown(P.x, P.y); await H.frame();
    await swipe(H, P, -25, 25, 4);
  } else {
    o.touch = 'window open → right finger touchStart, kept still (0 px), fake clock advanced frame by frame until hold state "wind" (+10 frames) [real-time hold: several seconds of real time pass], then touchEnd';
    await H.swordDown(P.x, P.y);
    let windAt = null;
    for (let f = 0; f < 120; f++) { await H.frame(); const x = await rec(H.page); fr.push(x); if (x.hold === 'wind' && !windAt) windAt = x.t; if (windAt && x.t - windAt > 0.15) break; }
    o.pressToWindS = windAt ? +(windAt - fr[0].t).toFixed(2) : null;
    await H.swordUp();
  }
  for (let f = 0; f < 120; f++) { await H.frame(); fr.push(await rec(H.page)); }
  const cs = await cues(H.page);
  const st = await stats(H.page);
  await H.close();
  const c = firstCue(cs, (x) => x.kind === 'secret' || x.name === 'altib');
  return { ...o, holdStates: [...new Set(fr.map((x) => x.hold))], secPhases: [...new Set(fr.map((x) => x.phase).filter(Boolean))], windowAfter: fr.at(-1)?.openEv ?? null, signal: c ?? null, holdRefused: st.holdRefused, hud: hudList(cs), allCues: cs.filter((x) => x.name), fired: !!c, errors: H.errors };
};

// B5 / B7: two cuts with a gap (seconds of game time between end of cut 1 and start of cut 2)
async function chain(run, gapS, dir2 = [-35, 0]) {
  const H = await startRun('iberian', 150 + run * 9);
  const p = { x: SW0.x + run * 5, y: SW0.y - 40 };
  await H.swordDown(p.x, p.y); await settle(H, 4);
  const s1 = await swipe(H, p, -25, 30, 4, false); // cut 1: ↙
  const t1 = (await rec(H.page)).t;
  const gapFr = Math.round(gapS / (0.017 * 1.1));
  const fr = [...s1.fr, ...(await settle(H, gapFr))];
  const t2 = (await rec(H.page)).t;
  const s2 = await swipe(H, s1.end, dir2[0], dir2[1], 4, true); // cut 2 in the same touch (no lift between)
  fr.push(...s2.fr, ...(await settle(H, 60)));
  const cs = await cues(H.page);
  const st = await stats(H.page);
  await H.close();
  return { H, fr, cs, st, t1, t2, gap: +(t2 - t1).toFixed(3) };
}
SC.B5 = async (run, variant) => {
  const gap = variant?.startsWith('gap') ? +variant.slice(3) : variant ? 1.0 : [0.05, 0.15, 0.25][run];
  const { H, fr, cs, st, gap: g } = await chain(run, gap, variant === 'upcut' || process.env.UPCUT ? [25, -30] : [-35, 0]);
  const on = fr.filter((x) => x.ibFlowOn);
  return { precondition: 'game path; foe far', touch: `one finger: down, cut 1 = 4 frames of (-25,+30) px, keep finger down, wait ${gap}s game time, cut 2 = 4 frames of (-35,0) px, lift`, gapEndOfCut1ToCut2StartS: g, signal: { ibFlowOnFrames: on.length, maxIbCutN: Math.max(0, ...fr.map((x) => x.ibCutN)), ibLinkFrames: fr.filter((x) => x.ibLink).length, linkStats: st.link }, hud: hudList(cs), allCues: cs.filter((x) => x.name), fired: on.length > 0, errors: H.errors };
};
SC.B7 = async (run, variant) => {
  const gap = variant?.startsWith('gap') ? +variant.slice(3) : variant ? 1.0 : [0.05, 0.15, 0.25][run];
  const { H, fr, cs, st, gap: g } = await chain(run, gap);
  return { precondition: 'game path; foe far', touch: `one finger: cut 1 (-25,+30)×4, keep down, wait ${gap}s, cut 2 (-35,0)×4 (← horizontal, starts far from side-guard pad), lift`, gapEndOfCut1ToCut2StartS: g, signal: { linkStats: st.link, linkPhases: [...new Set(fr.map((x) => x.link).filter(Boolean))] }, hud: hudList(cs), allCues: cs.filter((x) => x.name), fired: !!(st.link && st.link.fired > 0), errors: H.errors };
};

// ── run ──
const PLAN = { G1: 1, G2: 1, G5: 1, G8: 1, G7: 1, G10: 1, B2: 1, B3: 1, B4: 1, B5: 1, B7: 1 };
const resPath = `${out}/results.json`;
const all = fs.existsSync(resPath) ? JSON.parse(fs.readFileSync(resPath, 'utf8')) : {};
const forcedEnv = process.env.FORCED === '1';
const variantName = process.env.VARIANT || 'variant';
for (const cell of Object.keys(PLAN)) {
  if (only && !only.includes(cell)) continue;
  const runs = [];
  const which = process.env.RUNS ? process.env.RUNS.split(',') : ['0', '1', '2', 'v'];
  for (const k of which) {
    const variant = k === 'v' ? variantName : null;
    try {
      const o = await SC[cell](k === 'v' ? 0 : +k, variant, forcedEnv);
      runs.push({ run: k === 'v' ? `variant:${variantName}` : `canonical#${+k + 1}`, forced: forcedEnv, ...o, pointerLog: lastPtr });
      log(cell, k, o.fired, JSON.stringify(o.signal ?? o.window ?? null).slice(0, 300));
    } catch (e) { runs.push({ run: k, error: String(e) }); log(cell, k, 'ERR', String(e)); }
  }
  const key = process.env.KEY ? `${cell}:${process.env.KEY}` : cell;
  all[key] = runs;
  fs.writeFileSync(resPath, JSON.stringify(all, null, 1));
}
