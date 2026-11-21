// Aggregate a .cpuprofile: self time by file, top functions, and phase buckets by the direct callee of main.js `frame`.
//  node prof_bucket.mjs <file.cpuprofile> [frames] [--callees] [--fn N] [--window t0ms t1ms]
import fs from 'node:fs';
const argv = process.argv.slice(2);
const p = JSON.parse(fs.readFileSync(argv[0]));
const frames = +argv[1] || 0;
const showCallees = argv.includes('--callees');
const fnN = argv.includes('--fn') ? +argv[argv.indexOf('--fn') + 1] : 0;
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const file = (n) => { const u = n.callFrame.url || ''; if (!u) return ''; if (u.startsWith('wasm')) return 'wasm'; return u.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, '').replace(/^node_modules\/\.vite\/deps\//, 'deps/'); };
const name = (n) => n.callFrame.functionName || '(anon)';
const isRapier = (f) => f === 'wasm' || /rapier/i.test(f);
// phase map: direct callee of frame (main.js) -> bucket. key = file|fn ; fallbacks by file
const PHYS_FILES = /(^|\/)(fighter|gait|ai[a-z_]*|combat|corr|skill|secret|guards|match|terrain[a-z_]*|close_hold|run|pickup)\.js$/;
function bucketOfCallee(n) {
  const f = file(n), fn = name(n);
  if (isRapier(f)) return 'physics';
  if (/three/.test(f) && /render$/.test(fn)) return 'render';
  if (f === '' && /update$/.test(fn)) return 'physics'; // AI wrapper installed by the harness (ai.update + second AI)
  if (/body_reads/.test(f)) return 'physics'; // world.step wrapper (installBodyReads)
  if (/parry_button/.test(f)) return 'physics'; // playerGuard.step in the step loop
  if (/screen_tint/.test(f) && fn === 'render') return 'render';
  if (/fighter\.js$/.test(f) && fn === 'syncMeshes') return 'mesh sync';
  if (PHYS_FILES.test(f) && fn !== 'syncMeshes') return 'physics';
  if (/debris|trails|particles|decap_fx|limb_fx|revive_fx|aura|cape_sway|drip|blood|wound|impact_fx|secret_fx|it_edge|italian|fighter_light|trail|tint|mad_eyes|eye/.test(f) || /^(updateDrips|updateCapeSway|tickDebris|itEdgeLook|watchSecretFx)$/.test(fn)) return 'effects';
  if (/sound|sfx|whoosh/.test(f) || /^(updateWhoosh|updateBindSound|muteWhoosh)$/.test(fn)) return 'sound';
  if (/camera/.test(f) || fn === 'updateCamera') return 'camera';
  if (/perfmeter/.test(f)) return 'perfmeter (measurement)';
  if (/hud|cue|stamina|hp_strip|tech_cue/.test(f) || /^(updateHud|tickHudTimers|guardVisible|updateTechCue|playerInputFrame|updateGuardName|updateParryLabel)$/.test(fn)) return 'HUD/DOM+input';
  if (fn === 'stageTick' || /stage_|arena/.test(f)) return 'stage anim';
  return 'glue:' + fn + '@' + f;
}
// WebGLShadowMap line range in the three.js deps file (dev server), override with SH=a,b
const SH = (process.env.SH || '47119,47414').split(',').map(Number);
const self = new Map();
let t = p.startTime; const sampT = [];
for (let i = 0; i < p.samples.length; i++) { t += p.timeDeltas[i]; sampT.push(t); }
const win = argv.includes('--window') ? [+argv[argv.indexOf('--window') + 1] * 1000, +argv[argv.indexOf('--window') + 2] * 1000] : null;
for (let i = 0; i < p.samples.length; i++) {
  const dt = p.timeDeltas[i + 1] ?? 0; // V8: delta i is time before sample i; attribute interval after the sample
  if (win && (sampT[i] < win[0] || sampT[i] > win[1])) continue;
  self.set(p.samples[i], (self.get(p.samples[i]) || 0) + Math.max(0, dt));
}
const B = {}, F = {}, FN = {}, CAL = {}, PH = {}, NP = {};
let tot = 0, idle = 0;
const phys2 = {};
for (const [id, us] of self) {
  const n = byId.get(id);
  tot += us;
  const fn = name(n);
  if (fn === '(idle)') { idle += us; B.idle = (B.idle || 0) + us; continue; }
  // file view: native (no url) folded into nearest JS ancestor, except GL natives under three.js
  let f = file(n), nn = n;
  if (!f) { for (let x = parent.get(id); x; x = parent.get(x)) { const a = byId.get(x); if (file(a)) { f = /three/.test(file(a)) ? 'GL/native under three.js' : file(a) + ' (+native)'; break; } } }
  if (!f) f = fn; // (program), (garbage collector), (root)
  F[f] = (F[f] || 0) + us;
  const key = `${fn} ${file(n) || '(native)'}:${n.callFrame.lineNumber + 1}`;
  FN[key] = (FN[key] || 0) + us;
  // phase view
  let b = null; let chain = [];
  for (let x = id; x; x = parent.get(x)) chain.push(byId.get(x));
  const fi = chain.findIndex((a) => name(a) === 'frame' && /main\.js$/.test(file(a)));
  if (fn === '(garbage collector)') b = 'GC';
  else if (fn === '(program)') b = 'GPU wait ((program): main thread blocked in ReadPixels/WaitForGetOffset, see q1_trace)';
  else if (fi > 0) {
    const callee = chain[fi - 1];
    b = bucketOfCallee(callee);
    CAL[`${name(callee)}@${file(callee)}`] = (CAL[`${name(callee)}@${file(callee)}`] || 0) + us;
    if (b === 'render') {
      if (chain.slice(0, fi - 1).some((a) => /three/.test(file(a)) && a.callFrame.lineNumber + 1 >= SH[0] && a.callFrame.lineNumber + 1 < SH[1])) b = 'render: shadow pass';
      else if (!file(n)) b = 'render: GL calls (main pass)';
      else b = 'render: main pass JS';
      if (!file(n) && b === 'render: shadow pass') b = 'render: shadow pass';
    }
    if (b === 'physics') { const k = isRapier(file(n)) ? (file(n) === 'wasm' ? 'rapier wasm' : 'rapier JS') : (!file(n) ? 'native' : file(n).replace(/^src\//, '')); phys2[k] = (phys2[k] || 0) + us; }
  } else if (fi === 0) b = 'frame self (main.js glue)';
  else {
    // non-frame roots: event handlers, timers, my rAF counter, microtasks
    const top = chain.at(-2) || n;
    const tf = chain.find((a) => file(a));
    b = 'other task:' + (tf ? file(tf).replace(/^src\//, '') : name(top));
  }
  PH[b] = (PH[b] || 0) + us;
  if (b !== 'physics' && !b.startsWith('GPU wait')) { const kk = `${key}  [${b}]`; NP[kk] = (NP[kk] || 0) + us; }
}
const busy = tot - idle;
const pr = (o, lim, den = busy) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, lim).map(([k, v]) => `${((100 * v) / den).toFixed(1).padStart(5)}%  ${(v / 1000).toFixed(0).padStart(6)}ms${frames ? '  ' + (v / 1000 / frames).toFixed(3).padStart(6) + 'ms/fr' : ''}  ${k}`).join('\n');
console.log(`total ${(tot / 1000).toFixed(0)}ms  idle ${(idle / 1000).toFixed(0)}ms (${((100 * idle) / tot).toFixed(1)}% of all)  busy ${(busy / 1000).toFixed(0)}ms  frames ${frames}  busy/frame ${frames ? (busy / 1000 / frames).toFixed(2) : '-'}ms`);
const gw = Object.entries(PH).filter(([k]) => k.startsWith('GPU wait')).reduce((a, [, v]) => a + v, 0);
const cpu = busy - gw;
console.log('== PHASE buckets (share of non-idle)'); console.log(pr(PH, 40));
// compact: main-thread CPU (non-idle minus GPU wait); other task:* and glue:* summed
const C2 = {}; for (const [k, v] of Object.entries(PH)) { if (k.startsWith('GPU wait')) continue; const kk = k.startsWith('other task:') ? 'other tasks (timers/handlers/other rAF)' : k.startsWith('glue:') ? 'other frame callees' : k; C2[kk] = (C2[kk] || 0) + v; }
const R2 = { render: 0 }; for (const [k, v] of Object.entries(C2)) if (k.startsWith('render')) R2.render += v;
console.log(`== CPU-only shares (busy minus GPU wait = ${(cpu / 1000).toFixed(0)}ms, ${frames ? (cpu / 1000 / frames).toFixed(2) : '-'} ms/frame); render total ${((100 * R2.render) / cpu).toFixed(1)}%`); console.log(pr(C2, 30, cpu));
console.log('== physics by file (share of non-idle)'); console.log(pr(phys2, 12));
console.log('== FILE self (natives folded; share of non-idle)'); console.log(pr(F, 30));
if (showCallees) { console.log('== direct callees of frame'); console.log(pr(CAL, 60)); }
if (fnN) { console.log('== top functions self'); console.log(pr(FN, fnN)); }
if (argv.includes('--nonphys')) { console.log('== top NON-physics functions self (share of CPU = busy minus GPU wait)'); console.log(pr(NP, 25, cpu)); }
