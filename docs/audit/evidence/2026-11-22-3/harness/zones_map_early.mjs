// probe4.mjs — three finer looks at the finger → action path
//  node probe4.mjs <baseUrl> <part>     part = zones | map | speed | early
//   zones : which element is on top at every point of the fight screen (a touch that does not land on #game is not a sword touch)
//   map   : how long the finger stayed (real ms) x how far it slid (px) -> thrust / nothing / cut
//   speed : the slowest sword-finger speed that counts as an attack input (ends a run, lets go of the guard) —
//           even frames / one long frame / two move events landing in one frame
//   early : a tap in the first moments of a fight
import { boot, sleep } from './hlib.mjs';
const [base, part = 'zones'] = process.argv.slice(2);
const out = (o) => console.log(JSON.stringify(o));

if (part === 'zones') {
  const H = await boot({ base });
  const z = await H.page.evaluate(() => {
    const W = innerWidth, Hh = innerHeight, step = 4, seen = new Map();
    const nameOf = (el) => (el ? (el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '')) : 'null');
    for (let y = step / 2; y < Hh; y += step) for (let x = step / 2; x < W; x += step) {
      const el = document.elementFromPoint(x, y); const n = nameOf(el);
      const r = seen.get(n) ?? { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1, pe: el ? getComputedStyle(el).pointerEvents : '' };
      r.n++; r.x0 = Math.min(r.x0, x); r.y0 = Math.min(r.y0, y); r.x1 = Math.max(r.x1, x); r.y1 = Math.max(r.y1, y); seen.set(n, r);
    }
    const total = Math.floor(W / step) * Math.floor(Hh / step);
    const pad = document.getElementById('moveStick').getBoundingClientRect();
    return { W, Hh, step, total, stick: [pad.x, pad.y, pad.width, pad.height], top: [...seen.entries()].map(([k, r]) => ({ el: k, share: +(r.n / total * 100).toFixed(2), box: [r.x0 - 2, r.y0 - 2, r.x1 + 2, r.y1 + 2], pointerEvents: r.pe })).sort((a, b) => b.share - a.share) };
  });
  out({ part, ...z });
  // the ring around the stick: touches there are taken by the stick, not the sword (INPUT.stickGuardPx)
  const ring = [];
  for (const extra of [2, 8, 14, 16, 20, 30]) { const a = await H.snap(); await H.tap(H.SC.x + H.SC.r + extra, H.SC.y); await H.frames(40); const b = await H.snap(); ring.push([extra, b.counts.thrust - a.counts.thrust]); await H.frames(30); }
  out({ part: 'stick_ring_px_outside_edge,thrust', ring });
  await H.close();
}

if (part === 'map') {
  const H = await boot({ base });
  const rows = [];
  for (const T of [40, 90, 140, 170, 200, 260, 400]) for (const D of [0, 6, 10, 14, 20, 30, 45, 70, 110]) {
    const a = await H.snap();
    const n = Math.max(1, Math.round(T / 17)); const t0 = Date.now();
    await H.down(2, 560, 200);
    let sw = 0;
    for (let k = 1; k <= n; k++) { const due = t0 + (T * k) / n - 4; if (D > 0) await H.move(2, 560 + (D * k) / n, 200); await H.run(17); const w = due - Date.now(); if (w > 0) await sleep(w); }
    await H.up(2); const real = Date.now() - t0;
    for (let k = 0; k < 50; k++) { await H.run(17); if ((await H.snap()).swinging) sw++; }
    const b = await H.snap();
    rows.push({ wantMs: T, realMs: real, px: D, thrust: b.counts.thrust - a.counts.thrust, cutCharged: b.counts.cut - a.counts.cut, swingFrames: sw });
    await H.frames(45);
  }
  for (const r of rows) out(r);
  await H.close();
}

if (part === 'speed') {
  // attack-input speed line, read through two things the player can see: a run that ends, a guard that lets go
  const startRun = async (H) => { await H.stick(1, 0); for (let i = 0; i < 260; i++) { await H.run(17); if ((await H.snap()).run) return true; } return false; };
  const res = [];
  for (const mode of ['even', 'long_frame', 'two_in_one']) for (const pxPerFrame of [1, 1.5, 2, 3, 3.5, 4, 5]) {
    const H = await boot({ base });
    const ran = await startRun(H); await H.frames(10);
    await H.down(2, 560, 200); await H.run(17); await sleep(230); // rest: not a tap
    let x = 560, broke = null;
    if (mode === 'even') { for (let k = 0; k < 24; k++) { x += pxPerFrame; await H.move(2, x, 200); await H.run(17); if (!(await H.snap()).run && broke == null) broke = k; } }
    if (mode === 'two_in_one') { for (let k = 0; k < 24; k++) { if (k % 2) { x += pxPerFrame; await H.move(2, x, 200); x += pxPerFrame; await H.move(2, x, 200); } await H.run(17); if (!(await H.snap()).run && broke == null) broke = k; } }
    if (mode === 'long_frame') { for (let k = 0; k < 6; k++) { x += pxPerFrame; await H.move(2, x, 200); await H.run(17); if (!(await H.snap()).run && broke == null) broke = k; }
      for (let k = 0; k < 18; k++) { x += pxPerFrame; await H.move(2, x, 200); } await H.page.clock.fastForward(306); await H.run(17); if (!(await H.snap()).run && broke == null) broke = 'long'; // one 306 ms frame holding the same finger speed
      for (let k = 0; k < 6; k++) { x += pxPerFrame; await H.move(2, x, 200); await H.run(17); if (!(await H.snap()).run && broke == null) broke = 'after'; } }
    await H.up(2); await H.stickUp();
    res.push({ part, see: 'run ends', mode, pxPerFrame, pxPerSec: Math.round(pxPerFrame / 0.017), ranBefore: ran, runEndedAt: broke });
    out(res.at(-1));
    await H.close();
  }
  for (const mode of ['even', 'long_frame', 'two_in_one']) for (const pxPerFrame of [1.5, 2, 3, 4, 5]) {
    const H = await boot({ base });
    const g = await H.page.locator('#btnParry').boundingBox();
    await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.frames(20);
    const a = await H.snap();
    await H.down(2, 480, 200); await H.run(17); await sleep(230);
    let x = 480, broke = 0, maxHand = 0; const h0 = (await H.snap()).hand;
    const look = async () => { const s = await H.snap(); if (s.guard?.broken) broke++; maxHand = Math.max(maxHand, Math.hypot(s.hand[0] - h0[0], s.hand[1] - h0[1])); };
    if (mode === 'even') for (let k = 0; k < 24; k++) { x += pxPerFrame; await H.move(2, x, 200); await H.run(17); await look(); }
    if (mode === 'two_in_one') for (let k = 0; k < 24; k++) { if (k % 2) { x += pxPerFrame; await H.move(2, x, 200); x += pxPerFrame; await H.move(2, x, 200); } await H.run(17); await look(); }
    if (mode === 'long_frame') { for (let k = 0; k < 6; k++) { x += pxPerFrame; await H.move(2, x, 200); await H.run(17); await look(); } for (let k = 0; k < 18; k++) { x += pxPerFrame; await H.move(2, x, 200); } await H.page.clock.fastForward(306); await H.run(17); await look(); for (let k = 0; k < 6; k++) { x += pxPerFrame; await H.move(2, x, 200); await H.run(17); await look(); } }
    await H.up(2); await H.up(3);
    out({ part, see: 'guard lets go', mode, pxPerFrame, pxPerSec: Math.round(pxPerFrame / 0.017), heldBefore: a.guard?.held, framesGuardBroken: broke, handMoved: +maxHand.toFixed(3) });
    await H.close();
  }
}

if (part === 'early') {
  for (const wait of [0, 300, 600, 1000, 1500, 2500, 4000]) {
    const H = await boot({ base, settle: 0 });
    await H.run(wait); const a = await H.snap(); await H.tap(620, 200); let seenTap = null; for (let k = 0; k < 90; k++) { await H.run(17); if ((await H.snap()).tap && seenTap == null) seenTap = k; } const b = await H.snap();
    out({ part, msAfterFightState: wait, thrust: b.counts.thrust - a.counts.thrust, tapSeenAfterFrames: seenTap, ps: a.ps, d: a.d });
    await H.close();
  }
}
