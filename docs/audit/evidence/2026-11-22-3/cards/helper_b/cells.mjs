// Skill-card input check, real touch events, normal game path.
// node cells.mjs <baseUrl> <outDir> [CELL ...]   (default: all 13 cells of this share)
import fs from 'node:fs';
import { boot, firedDiff, sleep } from './lib.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:5310').replace(/\/$/, '');
const out = process.argv[3] || 'out';
const want = process.argv.slice(4);
fs.mkdirSync(out, { recursive: true });
const log = (...a) => console.error(new Date().toISOString().slice(11, 19), ...a);

const SCHOOL = {
  italian: { weapon: 'rapier', cells: ['I1', 'I11', 'I3', 'I12', 'I7', 'I5', 'I2', 'I6', 'I8', 'I9', 'I4', 'I10'] },
  japanese: { weapon: 'uchigatana', cells: ['J1', 'J6', 'J7', 'J2', 'J11', 'J9', 'J8', 'J3', 'J10', 'J4', 'J12', 'J5'] },
  chinese: { weapon: 'qinggang', cells: ['C1', 'C2', 'C3', 'C7', 'C11', 'C4', 'C5', 'C6', 'C8', 'C10', 'C12', 'C9'] },
};
const PAD = { tag: [0.02, 0.52], tagR: [0.42, 0.42], tagL: [-0.4, 0.42], langort: [0.0, 0.03], sideR: [0.52, 0.06], sideL: [-0.52, 0.06], center: [0, 0.3] };
const SCR = { '↓': [0, 1], '↑': [0, -1], '←': [-1, 0], '→': [1, 0], '↙': [-1, 1], '↘': [1, 1] }; // screen px direction (y down)
const results = fs.existsSync(`${out}/results.json`) ? JSON.parse(fs.readFileSync(`${out}/results.json`, 'utf8')) : {};
const save = () => fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));

let H = null, curSchool = null;
async function ensure(school, fresh = false) {
  if (H && curSchool === school && !fresh) {
    const r = await H.rec().catch(() => null);
    if (r && r.state === 'fight' && r.alive && r.pState === 'stand' && !r.exhausted) return H;
  }
  if (H) await H.close().catch(() => {});
  const S = SCHOOL[school];
  H = await boot({ base, school, cells: S.cells, weapon: S.weapon, log });
  curSchool = school;
  if (H.info.state !== 'fight') throw new Error('no fight');
  await H.frame(20);
  return H;
}
const idle = async (n) => { for (const id of [1, 2, 3]) if (H.T.has(id)) await H.T.up(id); const r = await H.frame(n); await H.plog(); return r; };
const wrap = (fn) => async (o) => {
  const setupFails = [];
  let r;
  for (let k = 0; k < 3; k++) {
    r = await fn(o);
    r.pointerEvents = H ? await H.plog().catch(() => null) : null;
    if (!(r.ok === null && r.setup)) break;
    setupFails.push({ setup: r.setup, waitedFrames: r.waitedFrames });
    if (H) await H.close().catch(() => {}); H = null; // fresh fight for the retry
  }
  if (setupFails.length) r.setupRetries = setupFails;
  return r;
};
const snap = (r) => ({ t: r.t, d: r.d, hand: r.hand, stick: r.stick, hud: r.hud, guardName: r.guardName, cue: r.cue, stam: r.stam, foeState: r.foeState, foeAtk: r.foeAtk, noThreat: r.noThreat });

// ── stroke cells: optional stick, steer hand to start pad slowly, fast swipe ──
async function _stroke1({ school, name, stick = null, start, dir, steps = 4, px = 24, label }) {
  await ensure(school);
  await idle(200); // > special cooldown 3 s
  if (stick) { await H.stick(stick); await H.frame(6); }
  const hand0 = await H.steer(start);
  const b = await H.rec();
  const sw = await H.swipe(SCR[dir] ?? dir, { steps, px });
  const a = await H.frame(8);
  if (stick) await H.stick([0, 0]);
  const first = sw.find((x) => x.cur) ?? a;
  const fd = firedDiff(b.fired, a.fired);
  return { label, input: { stick, startPad: start, handAtStart: hand0, swipeScreenDir: dir, steps, pxPerFrame: px }, stickSeen: first.stick, classified: first.cur, fired: fd, ok: !!fd[name], hudBefore: b.hud, hudAfter: a.hud, cueAfter: a.cue, d: a.d };
}

async function stroke(o) { const tries = []; for (let k = 0; k < 3; k++) { const r = await stroke1(o); tries.push(r); if (r.classified) break; await idle(30); } const r = tries.at(-1); r.attemptsWithoutStrokeRegistered = tries.length - 1; return r; }
// ── J9: down cut that misses, then up cut after gap frames (same finger) ──
async function _tsubame({ gapF = 0, first = 'tagR', firstDir = '↙', upDir = '↑', label }) {
  await ensure('japanese');
  await idle(200);
  const r0 = await H.rec();
  if (r0.d < 2.6) { await H.stick([0, -1]); for (let i = 0; i < 90 && (await H.rec()).d < 3.0; i++) await H.frame(); await H.stick([0, 0]); await H.frame(10); }
  await H.steer(PAD[first]);
  const b = await H.rec();
  const sw1 = await H.swipe(SCR[firstDir] ?? firstDir, { release: false });
  const c1 = sw1.find((x) => x.cur)?.cur ?? null;
  const mid = await H.frame(gapF + 1);
  const sw2 = await H.swipe(SCR[upDir] ?? upDir);
  const a = await H.frame(8);
  const c2 = sw2.find((x) => x.cur && x.cur.t0 !== c1?.t0)?.cur ?? null;
  const prevEnd = sw2.map((x) => x.last).find((l) => l && l.t0 === c1?.t0)?.tEnd ?? mid.last?.tEnd ?? null;
  const fd = firedDiff(b.fired, a.fired);
  return { label, input: { firstPad: first, firstDir, holdFramesBetween: gapF, upDir }, firstStroke: c1, firstLanded: sw2.map((x) => x.last).find((l) => l && l.t0 === c1?.t0)?.landed ?? null, secondStroke: c2, gapAfterFirstEnd_s: c2 && prevEnd != null ? +(c2.t0 - prevEnd).toFixed(3) : null, fired: fd, ok: !!fd.tsubameGaeshi, hudAfter: a.hud, cueAfter: a.cue, d: a.d };
}

// ── C6: back stick then tap ──
async function _lian({ back = 1, tapWhile = true, afterReleaseF = 0, label }) {
  await ensure('chinese');
  await idle(200);
  const r0 = await H.rec();
  if (r0.d < 3) { /* fine either way */ }
  await H.stick([0, -back]); const s = await H.frame(20);
  if (s.stick[1] > -0.3 || s.d < 1.1) { await H.stick([0, 0]); return { label, setup: s.d < 1.1 ? `foe too close (d=${s.d}), pommel rule would take the tap` : 'stick not registered as back', ok: null }; }
  if (!tapWhile) { await H.stick([0, 0]); await H.frame(afterReleaseF); }
  const b = await H.rec();
  const tp = await H.tap();
  const a = await H.frame(10);
  await H.stick([0, 0]);
  const fd = firedDiff(b.fired, a.fired);
  return { label, input: { stickBack: back, stickSeen: s.stick, tapWhileBack: tapWhile, framesAfterRelease: tapWhile ? null : afterReleaseF, msAfterRelease_game: tapWhile ? null : afterReleaseF * 17, tapRealMs: tp.realMs }, fired: fd, ok: !!fd.lianchi, hudAfter: a.hud, cueAfter: a.cue, tapState: a.tap, d: a.d };
}

// ── I6: guard button new press ──
async function _opposition({ holdF = 20, label, alsoSecondPressWhileHeld = false }) {
  await ensure('italian');
  await idle(60);
  const b = await H.rec();
  const t0 = Date.now();
  await H.guardDown();
  const seen = [];
  for (let i = 0; i < holdF; i++) seen.push(await H.frame());
  await H.guardUp();
  const realMs = Date.now() - t0;
  const a = await H.frame(30);
  const started = a.oppStarts - b.oppStarts;
  const firstRun = seen.findIndex((x) => x.oppRun);
  return { label, input: { guardHoldFrames: holdF, guardRealMs: realMs }, oppStartsDelta: started, firstRunFrame: firstRun, guardNameDuring: seen.find((x) => x.oppRun)?.guardName ?? null, guardNameShowedOpposition: [...seen, a].some((x) => x.guardName.includes('막아찌르기')), oppRunFrames: seen.filter((x) => x.oppRun).length, hudAfter: a.hud, ok: started >= 1, gHeldSeen: seen.some((x) => x.gHeld), d: a.d };
}

// approach the foe with the stick until distance <= dmax (or timeout); returns rec
async function approach(dmax, maxF = 400) {
  let r = await H.rec();
  if (r.d <= dmax) return r;
  await H.stick([0, 1]);
  for (let i = 0; i < maxF && r.d > dmax; i++) r = await H.frame();
  await H.stick([0, 0]);
  return r;
}

// ── I9: under threat, stick side + tap ──
async function _inq({ side = 1, stickY = 0, wantThreat = true, label }) {
  await ensure('italian');
  await idle(200);
  await approach(2.4);
  let r = await H.rec(), waited = 0;
  const id0 = r.threatId;
  if (wantThreat) { for (; waited < 1500; waited++) { r = await H.frame(); if (r.noThreat === 0 && r.threatId !== id0) break; if (!r.alive || r.pState !== 'stand') break; } }
  if (!(r.noThreat === 0) && wantThreat) return { label, setup: 'no foe attack seen', waitedFrames: waited, ok: null };
  const b = await H.rec();
  const t0 = Date.now();
  await H.stick([side, stickY]); await H.frame(1);
  const atStick = await H.rec();
  const tp = await H.tap();
  const a = await H.frame(12);
  await H.stick([0, 0]);
  const fd = firedDiff(b.fired, a.fired);
  return { label, input: { stick: [side, stickY], stickSeen: atStick.stick, tapRealMs: tp.realMs, stickToTapRealMs: Date.now() - t0 }, waitedFramesForThreat: waited, noThreatAtTap: atStick.noThreat, threatId: atStick.threatId, foeAtk: atStick.foeAtk, d: atStick.d, fired: fd, ok: !!fd.inquartata, hudAfter: a.hud, cueAfter: a.cue, coolBefore: b.cool };
}

// ── I2: blade contact, tap at chosen age ──
async function _cav({ age = 0.3, early = null, label }) {
  await ensure('italian');
  await idle(120);
  await approach(1.9);
  let r = await H.rec(), waited = 0;
  const seenT0 = r.touch?.t0 ?? null;
  for (; waited < 1500; waited++) {
    r = await H.frame();
    if (r.touch && !r.touch.cut && !r.touch.spent && r.touch.t0 !== seenT0 && r.uqT - r.touch.t0 < 0.1) break;
    if (!r.alive || r.pState !== 'stand') break;
    if (waited % 120 === 119 && r.d > 2.2) await approach(1.7);
  }
  if (!(r.touch && r.uqT - r.touch.t0 < 0.1)) return { label, setup: 'no blade contact seen', waitedFrames: waited, ok: null };
  const C = r.touch.t0;
  const b = await H.rec();
  const taps = [];
  if (early != null) { while ((await H.rec()).uqT - C < early) await H.frame(); const q = await H.rec(); const tp = await H.tap(); taps.push({ ageAtTap: +(q.uqT - C).toFixed(3), sinceLastTouch: +(q.uqT - q.touch.t1).toFixed(3), realMs: tp.realMs }); await H.frame(1); }
  let q = await H.rec();
  for (let i = 0; i < 120 && q.uqT - C < age; i++) q = await H.frame();
  const tp = await H.tap();
  taps.push({ ageAtTap: +(q.uqT - C).toFixed(3), sinceLastTouch: q.touch ? +(q.uqT - q.touch.t1).toFixed(3) : null, touchCut: q.touch?.cut, realMs: tp.realMs });
  const a = await H.frame(12);
  const fd = firedDiff(b.fired, a.fired);
  return { label, taps, waitedFramesForContact: waited, d: q.d, foeAtk: q.foeAtk, fired: fd, ok: !!fd.cavazione, hudAfter: a.hud, cueAfter: a.cue };
}

// ── J5: idle until armed, wait for window, then tap ──
async function _gonosen({ nudgeAtF = null, label }) {
  await ensure('japanese', true);
  await idle(5);
  const t0 = (await H.rec()).t;
  let r, armedAt = null, openAt = null, nudged = null;
  for (let i = 0; i < 1800; i++) {
    if (nudgeAtF != null && i === nudgeAtF) { await H.stick([0, 0.5]); await H.frame(3); await H.stick([0, 0]); nudged = (await H.rec()).t; }
    r = await H.frame();
    if (r.armed && armedAt == null) armedAt = r.t;
    if (r.secOpen) { openAt = r.t; break; }
    if (!r.alive || r.pState !== 'stand') break;
  }
  const res = { label, input: { noTouchUntilWindow: true, stickNudgeAt_s: nudged != null ? +(nudged - t0).toFixed(2) : null }, armedAfter_s: armedAt != null ? +(armedAt - t0).toFixed(2) : null, hudWhenArmed: null, windowAfter_s: openAt != null ? +(openAt - t0).toFixed(2) : null, dAtWindow: r.d, foeAtkAtWindow: r.foeAtk };
  const armedFrame = H.frames.find((x) => x.armed && x.t >= t0);
  res.hudWhenArmed = armedFrame?.hud ?? null;
  if (openAt == null) return { ...res, ok: false, setup: armedAt == null ? 'never armed' : 'armed but window never opened' };
  const b = await H.rec();
  const tp = await H.tap();
  const seen = [];
  for (let i = 0; i < 20; i++) seen.push(await H.frame());
  res.tapRealMs = tp.realMs;
  res.windowOpen = true;
  res.secretRan = seen.some((x) => x.sec || x.secretPhase || x.iai);
  res.secStages = [...new Set(seen.map((x) => x.sec).filter(Boolean))];
  res.hudAfter = seen.at(-1).hud;
  res.ok = true; // card promise = window opens ("비기 활성화")
  return res;
}

// ── C9: forward stick, new guard press when the foe attack starts ──
async function _gyeoksal({ fwd = 1, delayF = 0, label }) {
  await ensure('chinese');
  await idle(200);
  await approach(2.3);
  let r = await H.rec(), waited = 0;
  const id0 = r.threatId;
  for (; waited < 1500; waited++) { r = await H.frame(); if (r.noThreat === 0 && r.threatId !== id0) break; if (!r.alive || r.pState !== 'stand') break; }
  if (!(r.noThreat === 0)) return { label, setup: 'no foe attack seen', waitedFrames: waited, ok: null };
  await H.stick([0, fwd]);
  await H.frame(delayF);
  const b = await H.rec();
  const t0 = Date.now();
  await H.guardDown();
  const seen = [];
  for (let i = 0; i < 50; i++) seen.push(await H.frame());
  await H.guardUp(); await H.stick([0, 0]);
  const a = await H.frame(20);
  const gkD = {}; for (const k of Object.keys(a.gk ?? {})) if (typeof a.gk[k] === 'number' && a.gk[k] !== (b.gk?.[k] ?? 0)) gkD[k] = a.gk[k] - (b.gk?.[k] ?? 0);
  const opened = a.secOpened - b.secOpened;
  const ranF = [...seen, a].findIndex((x) => x.sec);
  return { label, input: { stickFwd: fwd, framesFromThreatToPress: delayF + 1, guardHeldFrames: 50, guardRealMs: Date.now() - t0 }, threatNoThreat: r.noThreat, d: r.d, gkCountersDelta: gkD, windowOpened: opened, secretRanFrame: ranF, ok: opened > 0 && ranF >= 0, hudAfter: a.hud, stickSeen: b.stick };
}

// ── I4: blades near, stick mirrors the foe's steps ──
async function _risoluto({ mirror = true, label, maxF = 1500 }) {
  await ensure('italian', true);
  await idle(5);
  await approach(2.0);
  let r = await H.rec(), openAt = null, onF = 0;
  const t0 = r.t;
  for (let i = 0; i < maxF; i++) {
    const my = r.foeMoveY;
    const want = mirror ? (my < -0.1 ? 1 : my > 0.1 ? -1 : 0) : (my < -0.1 ? -1 : my > 0.1 ? 1 : 0);
    const cur = r.stick[1];
    if (want === 0 && H.T.has(1)) await H.stick([0, 0]);
    else if (want !== 0 && Math.sign(cur) !== want) await H.stick([0, want * 0.8]);
    r = await H.frame();
    if (r.riso?.on) onF++;
    if (r.secOpen) { openAt = r.t; break; }
    if (!r.alive || r.pState !== 'stand') break;
    if (i % 200 === 199 && r.d > 2.6) await approach(1.9);
  }
  const res = { label, input: { mirrorFoeSteps: mirror }, framesCoveredAndMirroring: onF, riso: r.riso, windowAfter_s: openAt != null ? +(openAt - t0).toFixed(2) : null, d: r.d };
  if (openAt == null) return { ...res, ok: false };
  await H.stick([0, 0]);
  const tp = await H.tap();
  const seen = []; for (let i = 0; i < 20; i++) seen.push(await H.frame());
  return { ...res, ok: true, tapRealMs: tp.realMs, secretRan: seen.some((x) => x.sec || x.secretPhase), hudAfter: seen.at(-1).hud };
}

const stroke1 = wrap(_stroke1);
const tsubame = wrap(_tsubame);
const lian = wrap(_lian);
const opposition = wrap(_opposition);
const inq = wrap(_inq);
const cav = wrap(_cav);
const gonosen = wrap(_gonosen);
const gyeoksal = wrap(_gyeoksal);
const risoluto = wrap(_risoluto);
const PLAN = {
  I6: async () => [await opposition({ label: 'canon 1: guard press held 20 frames' }), await opposition({ holdF: 40, label: 'canon 2: held 40 frames' }), await opposition({ holdF: 10, label: 'canon 3: held 10 frames' }), await opposition({ holdF: 1, label: 'variant: very short guard tap (1 frame)' })],
  I7: async () => [
    await stroke({ school: 'italian', name: 'imbroccata', start: PAD.center, dir: '↓', label: 'canon 1: ↓ from middle-high' }),
    await stroke({ school: 'italian', name: 'imbroccata', start: PAD.tagR, dir: '↙', label: 'canon 2: ↙ from right high' }),
    await stroke({ school: 'italian', name: 'imbroccata', start: PAD.tagL, dir: '↘', label: 'canon 3: ↘ from left high' }),
    await stroke({ school: 'italian', name: 'imbroccata', start: PAD.sideR, dir: [-1, 0.35], label: 'variant: shallow ↙ from right side (screen 1:0.35, hand ~66° from straight down)' }),
    await stroke({ school: 'italian', name: 'imbroccata', start: PAD.sideR, dir: [-1, 0.2], label: 'variant: shallower ↙ from right side (screen 1:0.2, hand ~75° from straight down)' }),
    await stroke({ school: 'italian', name: 'imbroccata', start: PAD.langort, dir: '↓', steps: 2, label: 'variant: short ↓ from waist level' }),
  ],
  J7: async () => [
    await stroke({ school: 'japanese', name: 'kote', start: PAD.langort, dir: '↓', steps: 2, label: 'canon 1: short ↓ from middle' }),
    await stroke({ school: 'japanese', name: 'kote', start: [0.05, 0.05], dir: '↓', steps: 2, label: 'canon 2: short ↓ from middle (slightly right)' }),
    await stroke({ school: 'japanese', name: 'kote', start: [-0.04, 0.0], dir: '↓', steps: 3, label: 'canon 3: short ↓ from middle (slightly left)' }),
    await stroke({ school: 'japanese', name: 'kote', start: PAD.center, dir: '↓', steps: 2, label: 'variant: short ↓ started a little higher (chest height)' }),
  ],
  C3: async () => [
    await stroke({ school: 'chinese', name: 'yaoji', start: PAD.sideR, dir: '←', label: 'canon 1: ← from right side' }),
    await stroke({ school: 'chinese', name: 'yaoji', start: [0.48, 0.1], dir: '←', label: 'canon 2: ← from right side (slightly in)' }),
    await stroke({ school: 'chinese', name: 'yaoji', start: [0.5, 0.0], dir: '←', label: 'canon 3: ← from right side (lower)' }),
    await stroke({ school: 'chinese', name: 'yaoji', start: PAD.langort, dir: '←', label: 'variant: ← started from the middle' }),
    await stroke({ school: 'chinese', name: 'yaoji', start: PAD.sideL, dir: '→', label: 'variant: mirrored → from left side' }),
  ],
  C5: async () => [
    await stroke({ school: 'chinese', name: 'chebuYaoji', stick: [0, 1], start: PAD.sideR, dir: '←', label: 'canon 1: stick ↑ + ← from right side' }),
    await stroke({ school: 'chinese', name: 'chebuYaoji', stick: [0.2, 0.9], start: [0.48, 0.1], dir: '←', label: 'canon 2: stick ↑ (slightly right) + ←' }),
    await stroke({ school: 'chinese', name: 'chebuYaoji', stick: [0, 0.6], start: PAD.sideR, dir: '←', label: 'canon 3: stick ↑ half tilt + ←' }),
    await stroke({ school: 'chinese', name: 'chebuYaoji', stick: [0, 1], start: PAD.langort, dir: '←', label: 'variant: stick ↑ + ← from the middle' }),
  ],
  J6: async () => [
    await stroke({ school: 'japanese', name: 'hirakiGiri', stick: [1, 0], start: PAD.tagL, dir: '↘', label: 'canon 1: stick → + ↘ from left high' }),
    await stroke({ school: 'japanese', name: 'hirakiGiri', stick: [-1, 0], start: PAD.tagL, dir: '↘', label: 'canon 2: stick ← + ↘ from left high' }),
    await stroke({ school: 'japanese', name: 'hirakiGiri', stick: [1, 0.2], start: [-0.36, 0.4], dir: '↘', label: 'canon 3: stick → (slightly fwd) + ↘' }),
    await stroke({ school: 'japanese', name: 'hirakiGiri', stick: [1, 0], start: PAD.center, dir: '↘', label: 'variant: stick → + ↘ from the middle' }),
    await stroke({ school: 'japanese', name: 'hirakiGiri', stick: [1, 0], start: PAD.tagR, dir: '↙', label: 'variant: mirrored stick → + ↙ from right high' }),
  ],
  J9: async () => [
    await tsubame({ gapF: 0, label: 'canon 1: ↙ cut (miss) then ↑ at once' }),
    await tsubame({ gapF: 6, label: 'canon 2: ↙ cut then ↑ after 6 frames still' }),
    await tsubame({ gapF: 12, first: 'tag', firstDir: '↓', label: 'canon 3: ↓ from top then ↑ after 12 frames' }),
    await tsubame({ gapF: 30, label: 'timing: ↙ then ↑ after 30 frames' }),
    await tsubame({ gapF: 45, label: 'timing: ↙ then ↑ after 45 frames' }),
    await tsubame({ gapF: 0, upDir: [0.9, -1], label: 'variant: ↙ then ↗ (up-right) at once' }),
  ],
  C6: async () => [
    await lian({ label: 'canon 1: stick ↓ held, tap' }),
    await lian({ label: 'canon 2: stick ↓ held, tap' }),
    await lian({ tapWhile: false, afterReleaseF: 15, label: 'canon 3: stick ↓ released, tap 0.25 s later' }),
    await lian({ back: 0.4, label: 'variant: stick ↓ at 40% tilt, tap' }),
    await lian({ tapWhile: false, afterReleaseF: 30, label: 'timing: tap 0.5 s after release' }),
    await lian({ tapWhile: false, afterReleaseF: 42, label: 'timing: tap 0.7 s after release' }),
  ],
  I9: async () => [
    await inq({ side: 1, label: 'canon 1: foe attacking, stick → + tap' }),
    await inq({ side: -1, label: 'canon 2: foe attacking, stick ← + tap' }),
    await inq({ side: 1, label: 'canon 3: foe attacking, stick → + tap' }),
    await inq({ side: 0.6, stickY: 0.8, label: 'variant: foe attacking, stick diagonal ↗ + tap' }),
  ],
  I2: async () => [
    await cav({ age: 0.3, label: 'canon 1: tap 0.3 s after blade contact began' }),
    await cav({ age: 0.5, label: 'canon 2: tap 0.5 s after contact' }),
    await cav({ age: 0.25, label: 'canon 3: tap 0.25 s after contact' }),
    await cav({ early: 0.05, age: 0.4, label: 'variant: early tap at 0.05 s then tap at 0.4 s' }),
  ],
  J5: async () => [
    await gonosen({ label: 'canon 1: no input, wait' }),
    await gonosen({ label: 'canon 2: no input, wait' }),
    await gonosen({ label: 'canon 3: no input, wait' }),
    await gonosen({ nudgeAtF: 90, label: 'variant: brief stick nudge at 1.5 s' }),
  ],
  C9: async () => {
    const o = [];
    for (let k = 0; k < 6; k++) o.push(await gyeoksal({ delayF: k % 3 === 2 ? 6 : 0, label: `canon ${k + 1}: stick ↑ + new guard press ${k % 3 === 2 ? '6 frames' : '1 frame'} after foe attack seen` }));
    o.push(await gyeoksal({ fwd: 0, label: 'variant: no stick, new guard press 1 frame after foe attack seen' }));
    return o;
  },
  I4: async () => [await risoluto({ label: 'canon 1: stick follows foe steps' }), await risoluto({ label: 'canon 2' }), await risoluto({ label: 'canon 3' }), await risoluto({ mirror: false, label: 'variant: stick opposite to foe steps' })],
};
const SCH = (c) => (c[0] === 'I' ? 'italian' : c[0] === 'J' ? 'japanese' : 'chinese');
const order = want.length ? want : ['I6', 'I7', 'J7', 'C3', 'C5', 'C6', 'J6', 'J9', 'I9', 'I2', 'J5', 'C9', 'I4'];
for (const cell of order) {
  log('cell', cell);
  try {
    const runs = await PLAN[cell]();
    results[cell] = { school: SCH(cell), weapon: SCHOOL[SCH(cell)].weapon, foe: H?.info?.foe, foeWeapon: H?.info?.foeWeapon, runs };
  } catch (e) { results[cell] = { error: String(e?.stack ?? e) }; log('ERR', cell, e); if (H) await H.close().catch(() => {}); H = null; }
  save();
  for (const r of results[cell].runs ?? []) log(cell, r.label, 'ok=', r.ok, r.setup ?? '', JSON.stringify(r.fired ?? r.gkCountersDelta ?? ''));
}
if (H) await H.close();
log('done');
