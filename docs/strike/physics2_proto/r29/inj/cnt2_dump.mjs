// r29 inj part 3 dump hook: R29_W2=<out.json> [R29_ECC=x] [R29_LIMDIV=y] node --import file://<this file> tools/sim/fights12.mjs   (run inside ll_13_125_cnt2)
//  Optional: mutate the cell's exported LEGS before the game loads (LEGS.ecc = R29_ECC · every LEGS.limit entry / R29_LIMDIV) for the controls.
//  On exit writes per-axis summaries of the wobble counters (median / p95 / max of |dwE|, limit change N·m and share; alternation run histogram).
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const { LEGS } = await import(pathToFileURL(resolve('src/config.js')).href);
if (process.env.R29_ECC) LEGS.ecc = +process.env.R29_ECC;
if (process.env.R29_LIMDIV) for (const k of Object.keys(LEGS.limit)) LEGS.limit[k] /= +process.env.R29_LIMDIV;
const q = (a, p) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p + 0.5))]; };
process.on('exit', () => {
  const W = globalThis.__r29w;
  if (!W) { writeFileSync(process.env.R29_W2, 'null'); return; }
  for (const k of W.all) for (let id = 0; id < 7; id++) if (k.alt[id] >= 2) W.ax[id].runs[Math.min(k.alt[id], 63)]++;
  const out = { legs: { ecc: LEGS.ecc, hipFlex: LEGS.limit.hipFlex }, rep: W.rep, ax: W.ax.map((A) => ({
    calls: A.calls, sat: A.sat, satCons: A.satCons,
    dw: [q(A.dw, 0.5), q(A.dw, 0.95), A.dw.length ? Math.max(...A.dw) : null],
    dl: [q(A.dl, 0.5), q(A.dl, 0.95), A.dl.length ? Math.max(...A.dl) : null],
    sh: [q(A.sh, 0.5), q(A.sh, 0.95), A.sh.length ? Math.max(...A.sh) : null],
    runs: Array.from(A.runs),
  })) };
  writeFileSync(process.env.R29_W2, JSON.stringify(out));
});
