// r29 inj part 3 maker: copy cell ll_13_125 to ll_13_125_cnt2 and add wobble counting to its legs_vmc.js only (read-only counters; the clamp result is unchanged).
//  Per stance-leg clamp call (legTorques with ankleOn) and axis, keyed by the leg object L and the fighter's drive step counter f.__r29s:
//   - when the call is at the limit and the same leg/axis was clamped on the previous step: |wE(t) - wE(t-1)| with both on the side of the current torque,
//     the implied limit change |legLimit(side, str, wE(t)) - legLimit(side, str, wE(t-1))| in N·m and as a share of legLimit(side, str, wE(t));
//   - alternation runs: maximal runs of consecutive steps whose saturated flag flips every step; histogram of run length.
//  usage: S=<scratch> node mk_cnt2.mjs     (then run fights12 in the copy with --import cnt2_dump.mjs)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const S = process.env.S; if (!S) throw new Error('S=<scratch>');
const C = join(S, 'p2/r6/mx/cells'), D = join(C, 'll_13_125_cnt2');
if (existsSync(D)) execFileSync('rm', ['-rf', D]);
execFileSync('cp', ['-a', join(C, 'll_13_125'), D]);
const f = join(D, 'src/legs_vmc.js');
let s = readFileSync(f, 'utf8');
const once = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`'${a.slice(0, 50)}' found ${n} times`); s = s.replace(a, b); };
once('const clampLeg = (t, w, lo, hi, str) => clamp(t, -legLimit(lo, str, -w), legLimit(hi, str, w));',
`const clampLeg = (t, w, lo, hi, str) => clamp(t, -legLimit(lo, str, -w), legLimit(hi, str, w));
const _W2 = (globalThis.__r29w ??= { ph: 0, L: null, st: 0, rep: 0, all: [], ax: Array.from({ length: 7 }, () => ({ calls: 0, sat: 0, satCons: 0, dw: [], dl: [], sh: [], runs: new Float64Array(64) })) });
function _w2flush(id, len) { if (len >= 2) _W2.ax[id].runs[Math.min(len, 63)]++; }
function clampLegC(id, t, w, lo, hi, str) {
  const r = clampLeg(t, w, lo, hi, str);
  if (_W2.ph !== 0 || !_W2.L) return r;
  const L = _W2.L, A = _W2.ax[id], sat = r !== t;
  let k = L.__r29w;
  if (!k) { k = L.__r29w = { st: new Float64Array(7).fill(-9), w: new Float64Array(7), sat: new Uint8Array(7), alt: new Int32Array(7) }; _W2.all.push(k); }
  if (k.st[id] === _W2.st) { _W2.rep++; return r; }
  A.calls++; if (sat) A.sat++;
  const cons = k.st[id] === _W2.st - 1;
  if (cons) {
    if (sat) {
      const pos = t >= 0, base = pos ? hi : lo, wE = pos ? w : -w, wEp = pos ? k.w[id] : -k.w[id];
      const ln = legLimit(base, str, wE), lp = legLimit(base, str, wEp);
      A.satCons++; A.dw.push(Math.abs(wE - wEp)); A.dl.push(Math.abs(ln - lp)); A.sh.push(ln > 0 ? Math.abs(ln - lp) / ln : 0);
    }
    if (sat !== (k.sat[id] === 1)) k.alt[id]++; else { _w2flush(id, k.alt[id]); k.alt[id] = 1; }
  } else { _w2flush(id, k.alt[id]); k.alt[id] = 1; }
  k.st[id] = _W2.st; k.w[id] = w; k.sat[id] = sat ? 1 : 0;
  return r;
}`);
once('    const lim = LEGS.limit;\n', '    const lim = LEGS.limit;\n    _W2.ph = ankleOn ? 0 : 1; _W2.L = L; _W2.st = f.__r29s ?? 0;\n');
once('    { const w = f.bodies.pelvis.angvel(); _wp.set(w.x, w.y, w.z); }', '    { const w = f.bodies.pelvis.angvel(); _wp.set(w.x, w.y, w.z); } f.__r29s = (f.__r29s ?? 0) + 1;');
const calls = [['_b.x, L.wH.x', 0], ['_b.y, L.wH.y', 1], ['_b.z, L.wH.z', 2], ['s0, L.wK', 3], ['_b.x, L.wA.x', 4], ['_b.y, L.wA.y', 5], ['_b.z, L.wA.z', 6]];
for (const [a, id] of calls) once(`clampLeg(${a},`, `clampLegC(${id}, ${a},`);
writeFileSync(f, s);
console.log(`${D.replace(S, '$S')}: instrumented clamps ${calls.length} · lines with clampLegC( ${execFileSync('grep', ['-c', 'clampLegC(', f], { encoding: 'utf8' }).trim()}`);
