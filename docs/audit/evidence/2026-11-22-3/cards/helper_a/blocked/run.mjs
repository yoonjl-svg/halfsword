// Inputs while the player's body cannot act — FORCED situations (foe AI frozen; knockDown / dropSword by script).
// usage: node blocked/run.mjs <baseUrl> <outDir> <down|drop> <input|control> <runIndex>
// Real CDP touches; every touchMove is followed by a wait until the page has seen a pointermove before the frame is stepped.
import fs from 'node:fs';
import { boot, installRec, ptrLog } from '../lib.mjs';

const [base0, out, sit, mode, runS] = process.argv.slice(2);
const base = base0.replace(/\/$/, '');
const run = +runS || 0;
fs.mkdirSync(out, { recursive: true });
const H = await boot(base, 'german', 'longsword');
const page = H.page;
await installRec(page);
await page.evaluate(() => {
  window.__pm = 0;
  window.addEventListener('pointermove', () => { window.__pm++; }, true);
  const g = window.game, p = g.player;
  g.ai.update = () => g.enemy.move.set(0, 0); // forced: foe frozen
  const sw = () => { const s = p.sword; const b = s?.body ?? s?.handle ?? s; try { const t = b?.translation?.(); return t ? [+t.x.toFixed(3), +t.z.toFixed(3)] : null; } catch { return null; } };
  window.__f = () => {
    const c = p.stamina.counts, pl = p.bodies.pelvis.translation(), fo = g.enemy.bodies.pelvis.translation();
    return { t: +p.fightT.toFixed(3), state: p.state, armed: !!p.armed, autoPick: !!p.autoPick, pickup: !!p.pickup, thrust: c.thrust, cut: c.cut, tap: !!p.skill.tap, swing: !!p.skill.swinging, guard: !!g.playerGuard?.held, move: [+p.move.x.toFixed(2), +p.move.y.toFixed(2)], pelvis: [+pl.x.toFixed(3), +pl.z.toFixed(3)], foe: [+fo.x.toFixed(3), +fo.z.toFixed(3)], sword: sw(), hand: [+p.handOffset.x.toFixed(3), +p.handOffset.y.toFixed(3)], sec: p.skill.sec?.stage ?? null, uq: p.uniqueCue?.name ?? null };
  };
});
const F = () => page.evaluate(() => window.__f());
const pm = () => page.evaluate(() => window.__pm);
const frames = [];
let fi = 0;
const step = async (tag = null) => { await H.frame(); fi++; const r = await F(); r.f = fi; if (tag) r.in = tag; frames.push(r); return r; };
// wait until the page has seen at least one more pointermove than before (lock-step); runFor(0) lets queued events dispatch
const seen = async (before) => { for (let i = 0; i < 50; i++) { if ((await pm()) > before) return true; await page.clock.runFor(0); } return false; };
let lateMoves = 0;
const moveStick = async (v) => { const b = await pm(); await H.stick(v); if (v && !(await seen(b))) lateMoves++; };
const moveSword = async (x, y) => { const b = await pm(); await H.swordMove(x, y); if (!(await seen(b))) lateMoves++; };

for (let i = 0; i < 150 + run * 7; i++) await H.frame(); // past round start freeze
await ptrLog(page);
const t0 = await F();
const ev = { start: t0 };
if (sit === 'down') await page.evaluate(() => window.game.player.knockDown(true));
else await page.evaluate(() => window.game.player.dropSword());
ev.forcedAtF = fi;

const blocked = (r) => (sit === 'down' ? r.state !== 'stand' : !r.armed);
let r = await step();
let inputs = [];
// stick direction pointing AWAY from the sword (drop) — in stick space: y = toward foe, x = right of that
const awayStick = (r) => {
  if (!r.sword) return [1, 0];
  const fx = r.foe[0] - r.pelvis[0], fz = r.foe[1] - r.pelvis[1], fl = Math.hypot(fx, fz) || 1;
  const ux = fx / fl, uz = fz / fl; // forward
  const rx = -uz, rz = ux; // a perpendicular (sign checked from the logged move vector)
  const sx = r.sword[0] - r.pelvis[0], sz = r.sword[1] - r.pelvis[1];
  const a = [-(sx * rx + sz * rz), -(sx * ux + sz * uz)], L = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / L, a[1] / L];
};
if (sit === 'down') {
  for (let i = 0; i < 10; i++) r = await step();
} else {
  for (let i = 0; i < 300 && !r.autoPick && blocked(r); i++) r = await step();
  ev.autoPickStartF = r.autoPick ? fi : null;
}
ev.inputStartF = fi;
if (mode === 'input' && blocked(r) && (sit === 'down' || r.autoPick)) {
  const P = { x: 600 + run * 6, y: 200 };
  // tap: down + up back to back (0 ms stepped), then a frame
  await H.swordDown(P.x, P.y); await H.swordUp(); r = await step('tap'); inputs.push({ k: 'tap', f: fi, blocked: blocked(r), autoPick: r.autoPick });
  r = await step();
  // fast swipe: down, frame, 4 moves of (-30,+30) px each followed by a frame, up
  await H.swordDown(P.x, P.y - 40); r = await step('swipeDown');
  for (let k = 1; k <= 4; k++) { await moveSword(P.x - 30 * k, P.y - 40 + 30 * k); r = await step('swipe'); }
  await H.swordUp(); r = await step('swipeUp'); inputs.push({ k: 'swipe', f: fi, blocked: blocked(r), autoPick: r.autoPick });
  // guard press held 15 frames
  await H.guard(true); for (let i = 0; i < 15; i++) r = await step('guard');
  await H.guard(false); r = await step('guardUp'); inputs.push({ k: 'guard15', f: fi, blocked: blocked(r), autoPick: r.autoPick });
  // stick full: sideways (down) or away from the sword (drop), held until no longer blocked
  const v = sit === 'down' ? [1, 0] : awayStick(r);
  ev.stickVec = v.map((x) => +x.toFixed(2));
  await moveStick(v); r = await step('stick'); inputs.push({ k: 'stick', f: fi, v: ev.stickVec, blocked: blocked(r), autoPick: r.autoPick });
  for (let i = 0; i < 900 && blocked(r); i++) r = await step('stick');
  await moveStick(null);
  ev.stickReleasedF = fi;
} else if (mode === 'input') {
  ev.note = `could not send inputs: at frame ${fi} blocked=${blocked(r)} autoPick=${r.autoPick}`;
}
for (let i = 0; i < 1200 && blocked(r); i++) r = await step();
ev.freeF = blocked(r) ? null : fi;
ev.freeT = blocked(r) ? null : r.t;
ev.blockedS = ev.freeT != null ? +(ev.freeT - t0.t).toFixed(3) : null;
if (sit === 'drop') { const a = frames.filter((x) => x.autoPick); ev.autoPickFrames = a.length; ev.autoPickF = a.length ? [a[0].f, a.at(-1).f] : null; }
const freeIdx = frames.length;
for (let i = 0; i < 60; i++) r = await step();
const during = frames.slice(0, freeIdx), after = frames.slice(freeIdx);
const cnt = (arr, k) => arr.filter((x) => x[k]).length;
const summary = {
  situation: sit === 'down' ? 'forced: player.knockDown(true); foe AI frozen' : 'forced: player.dropSword(); foe AI frozen',
  mode, run, ev, inputs, lateMoves,
  counts: { before: { thrust: t0.thrust, cut: t0.cut }, atFree: { thrust: during.at(-1)?.thrust, cut: during.at(-1)?.cut }, end: { thrust: r.thrust, cut: r.cut } },
  blockedPhase: { tapFrames: cnt(during, 'tap'), swingFrames: cnt(during, 'swing'), guardFrames: cnt(during, 'guard'), moveNonZeroFrames: during.filter((x) => x.move[0] || x.move[1]).length, pelvisStart: during[0]?.pelvis, pelvisAtFree: during.at(-1)?.pelvis, pelvisPathLen: +during.reduce((s, x, i) => (i ? s + Math.hypot(x.pelvis[0] - during[i - 1].pelvis[0], x.pelvis[1] - during[i - 1].pelvis[1]) : 0), 0).toFixed(3), sword: during.at(-1)?.sword ?? null },
  after60: { tapFrames: cnt(after, 'tap'), swingFrames: cnt(after, 'swing'), guardFrames: cnt(after, 'guard'), moveNonZeroFrames: after.filter((x) => x.move[0] || x.move[1]).length, sec: [...new Set(after.map((x) => x.sec).filter(Boolean))], thrustDelta: r.thrust - (during.at(-1)?.thrust ?? 0), cutDelta: r.cut - (during.at(-1)?.cut ?? 0) },
  errors: H.errors,
};
summary.pointerLog = await ptrLog(page);
fs.writeFileSync(`${out}/${sit}_${mode}_${run}.json`, JSON.stringify({ summary, frames }, null, 1));
console.log(JSON.stringify(summary).slice(0, 1500));
await H.close();
