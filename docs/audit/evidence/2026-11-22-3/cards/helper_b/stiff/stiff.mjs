// Input leak during the player's secret 'stiff' phase (Japanese gonosen), real touches, stepped clock.
// node stiff.mjs <baseUrl> <outDir> [runs spec, default: input,input,input,control,control]
import fs from 'node:fs';
import { boot } from '../lib.mjs';
const base = (process.argv[2] || 'http://127.0.0.1:5310').replace(/\/$/, '');
const out = process.argv[3] || 'out';
const spec = (process.argv[4] || 'input,control,input,control,input').split(',');
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);
const CELLS = ['J1', 'J6', 'J7', 'J2', 'J11', 'J9', 'J8', 'J3', 'J10', 'J4', 'J12', 'J5'];
const results = [];

async function oneRun(kind, idx) {
  const H = await boot({ base, school: 'japanese', cells: CELLS, weapon: 'uchigatana', log });
  const { page, T } = H;
  await page.evaluate(() => {
    const g = window.game;
    window.__pc = { down: 0, move: 0, up: 0 };
    for (const [ev, k] of [['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up']]) window.addEventListener(ev, (e) => { if (e.pointerType === 'touch') window.__pc[k]++; }, true);
    window.__s = () => {
      const p = g.player, b = p.bodies.pelvis.translation(), U = g.playerUnique;
      return { t: +p.fightT.toFixed(3), phase: p.skill.secretPhase ?? null, stage: p.skill.sec?.stage ?? null, counts: { ...p.stamina.counts }, stam: +p.stamina.value.toFixed(2),
        tap: !!p.skill.tap, swinging: !!p.skill.swinging, move: [+p.move.x.toFixed(2), +p.move.y.toFixed(2)], stick: [+(p.stickX ?? 0).toFixed(2), +(p.stickY ?? 0).toFixed(2)],
        gHeld: !!g.playerGuard?.held, hand: [+p.handOffset.x.toFixed(3), +p.handOffset.y.toFixed(3)], pelvis: [+b.x.toFixed(3), +b.z.toFixed(3)], d: +p.foeDistance().toFixed(3),
        fired: { ...(U?.stats?.fired ?? {}) }, secOpen: !!g.playerSecret?.open, iai: !!p.iai, iaiDraw: !!p.iaiDraw, opp: g.playerGuard?.opposition?.starts ?? null,
        hud: document.querySelector('#techSlot .slot')?.textContent ?? '', pc: { ...window.__pc }, state: g.state, alive: p.alive && g.enemy.alive, pState: p.state };
    };
  });
  const S = () => page.evaluate(() => window.__s());
  const pcNow = () => page.evaluate(() => window.__pc.down + window.__pc.move + window.__pc.up);
  // lock-step: send, then wait (no clock step) until the page has counted the pointer event
  const lock = async (fn, expect = 1) => { const c0 = await pcNow(); await fn(); let n = 0; while ((await pcNow()) < c0 + expect && n < 50) n++; return n; };
  const frames = [];
  const step = async (tag = null) => { await H.run(17); const r = await S(); if (tag) r.sent = tag; frames.push(r); return r; };
  // fire gonosen as in J5: no touch until the window opens, then one tap
  let r = await S(), openAt = null;
  for (let i = 0; i < 1800 && !openAt; i++) { r = await step(); if (r.secOpen) openAt = r.t; if (!r.alive || r.pState !== 'stand') break; }
  if (!openAt) { await H.close(); return { kind, idx, setup: 'gonosen window never opened', ok: null }; }
  await lock(() => T.down(2, 640, 170)); await step('secret tap down'); await lock(() => T.up(2)); 
  let stiff0 = null;
  for (let i = 0; i < 200; i++) { r = await step(); if (r.phase === 'stiff' || r.stage === 'stiff') { stiff0 = r; break; } }
  if (!stiff0) { await H.close(); return { kind, idx, setup: 'secret did not reach stiff', ok: null, framesAfterOpen: frames.slice(-40) }; }
  const iStiff = frames.length - 1;
  const lockWaits = [];
  let f = 0, guardUpAt = null;
  const inStiff = (x) => x.phase === 'stiff' || x.stage === 'stiff';
  while (inStiff(r) && f < 400) {
    let tag = null;
    if (kind === 'input') {
      if (f === 1) { lockWaits.push(await lock(() => T.down(2, 640, 170))); await H.run(17); lockWaits.push(await lock(() => T.up(2))); tag = 'tap (17 ms stepped, 0 px)'; }
      if (f === 4) { lockWaits.push(await lock(() => T.down(2, 620, 190))); tag = 'swipe down'; }
      if (f >= 5 && f <= 8) { const p = T.pos(2); lockWaits.push(await lock(() => T.move(2, p.x - 24, p.y + 18))); tag = `swipe move ${f - 4}`; }
      if (f === 9) { lockWaits.push(await lock(() => T.up(2))); tag = 'swipe up'; }
      if (f === 10) { lockWaits.push(await lock(() => H.stick([0, 1]), 1)); tag = 'stick down (centre)'; }
      if (f === 11) { tag = 'stick tilt ↑ full'; }
      if (f === 12) { lockWaits.push(await lock(() => T.down(3, H.btn.x + H.btn.width / 2, H.btn.y + H.btn.height / 2))); tag = 'guard down'; guardUpAt = f + 15; }
      if (f === guardUpAt) { lockWaits.push(await lock(() => T.up(3))); tag = 'guard up (held 15 frames)'; }
    }
    r = await step(tag);
    f++;
  }
  // H.stick([0,1]) sends touchStart + one frame + touchMove internally; note it
  const iEnd = frames.length - 1;
  if (kind === 'input' && T.has(3)) { await lock(() => T.up(3)); }
  for (let i = 0; i < 60; i++) await step();
  const during = frames.slice(iStiff, iEnd + 1), after = frames.slice(iEnd + 1);
  const cd = (a, b) => Object.fromEntries(Object.keys(b.counts).map((k) => [k, b.counts[k] - a.counts[k]]).filter(([, v]) => v));
  const fd = (a, b) => Object.fromEntries(Object.keys(b.fired).map((k) => [k, b.fired[k] - (a.fired[k] ?? 0)]).filter(([, v]) => v));
  const disp = (a, b) => +Math.hypot(b.pelvis[0] - a.pelvis[0], b.pelvis[1] - a.pelvis[1]).toFixed(3);
  const handMove = (arr) => +Math.max(...arr.map((x) => Math.hypot(x.hand[0] - arr[0].hand[0], x.hand[1] - arr[0].hand[1]))).toFixed(3);
  const res = {
    kind, idx, weapon: H.info.weapon, foe: H.info.foe,
    stiffStart_t: stiff0.t, stiffEnd_t: during.at(-1).t, stiffLen_s: +(during.at(-1).t - stiff0.t + 0.017 * 1.1).toFixed(3), stiffFrames: during.length,
    during: { countsDiff: cd(during[0], during.at(-1)), firedDiff: fd(during[0], during.at(-1)), tapSeen: during.some((x) => x.tap), swingingSeen: during.some((x) => x.swinging), moveNonZero: during.filter((x) => x.move[0] || x.move[1]).length, stickRawSeen: during.find((x) => x.stick[1])?.stick ?? null, guardHeldFrames: during.filter((x) => x.gHeld).length, oppDiff: during.at(-1).opp - during[0].opp, handMaxChange: handMove(during), pelvisDisp: disp(during[0], during.at(-1)), stamina: [during[0].stam, during.at(-1).stam] },
    after60: { countsDiff: cd(during.at(-1), after.at(-1)), firedDiff: fd(during.at(-1), after.at(-1)), firstTapFrame: after.findIndex((x) => x.tap), firstSwingFrame: after.findIndex((x) => x.swinging), firstMoveFrame: after.findIndex((x) => x.move[0] || x.move[1]), moveAtFrame0: after[0].move, pelvisDisp10: disp(during.at(-1), after[Math.min(9, after.length - 1)]), pelvisDisp60: disp(during.at(-1), after.at(-1)), guardHeldFrames: after.filter((x) => x.gHeld).length, hudEnd: after.at(-1).hud },
    lockWaitsPolls: lockWaits, framesStiffAndAfter: frames.slice(iStiff - 2),
  };
  await H.close();
  return res;
}
for (let i = 0; i < spec.length; i++) {
  let res;
  for (let k = 0; k < 3; k++) { res = await oneRun(spec[i], i).catch((e) => ({ kind: spec[i], idx: i, error: String(e) })); if (res.ok !== null && !res.error) break; log('retry', JSON.stringify(res).slice(0, 200)); }
  results.push(res);
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
  log(spec[i], JSON.stringify({ ...res, framesStiffAndAfter: undefined }).slice(0, 900));
}
log('done');
