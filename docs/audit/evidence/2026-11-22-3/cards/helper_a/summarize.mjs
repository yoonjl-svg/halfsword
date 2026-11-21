// usage: node summarize.mjs <results.json> [...more] — prints per cell / run: fired + key signal
import fs from 'node:fs';
for (const f of process.argv.slice(2)) {
  const R = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const [cell, runs] of Object.entries(R)) for (const r of runs) {
    const pick = { fired: r.fired, error: r.error, hand: r.handAtSwipe, read: r.strokeRead, sig: r.signal, win: r.window, s: r.secondsFromFirstClose, gap: r.gapEndOfCut1ToCut2StartS, hud: r.hud, cues: (r.allCues || []).map((c) => c.name), extra: { holdStates: r.holdStates, sec: r.secPhases ?? r.stages, pressToWind: r.pressToWindS, bt: r.bladeTouchFrames, btBand: r.touchFramesInBand, maxDup: r.maxDupStack, reach: r.reach, longest: r.longestCloseRunS, wait: r.waitedFromRecordStartS } };
    console.log(cell, r.run, JSON.stringify(pick).slice(0, 700));
  }
}
