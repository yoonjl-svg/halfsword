// Group a transition CPU profile (click -> first fight frame + 400 ms) into hitch causes; plus top functions by self and total.
//  node prof_hitch.mjs <file.cpuprofile> [topN=25]
import fs from 'node:fs';
const p = JSON.parse(fs.readFileSync(process.argv[2]));
const N = +process.argv[3] || 25; // (argv[3] may be --long)
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children || []) parent.set(c, n.id);
const file = (n) => { const u = n.callFrame.url || ''; if (!u) return ''; if (u.startsWith('wasm')) return 'wasm'; return u.replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*$/, ''); };
const nm = (n) => n.callFrame.functionName || '(anon)';
const has = (chain, f) => chain.some(f);
// groups in priority order (first match wins; the chain is leaf..root)
const G = [
  ['GC', (c) => nm(c[0]) === '(garbage collector)'],
  ['GPU wait / native (program)', (c) => nm(c[0]) === '(program)'],
  ['idle', (c) => nm(c[0]) === '(idle)'],
  ['shader compile/link (getProgram, compileShader, linkProgram, program info)', (c) => has(c, (n) => /^(compileShader|linkProgram|getProgramParameter|getShaderParameter|getProgramInfoLog|getShaderInfoLog|shaderSource|WebGLProgram|getProgram|fetchAttributeLocations|fetchUniformLocations|getUniforms|getAttributes|precompile)$/.test(nm(n)))],
  ['texture create/upload (texImage2D, uploadTexture, initTexture, canvas textures)', (c) => has(c, (n) => /^(texImage2D|texSubImage2D|texStorage2D|compressedTexImage2D|uploadTexture|initTexture|setTexture2D|generateMipmap|getContext|putImageData|createImageData|fillRect|drawImage)$/.test(nm(n)))],
  ['sound: reverb IR synthesis', (c) => has(c, (n) => /reverbIR/.test(nm(n)))],
  ['sound: other (setStage, _applyRoom, voices, buffers)', (c) => has(c, (n) => /sound|sfx|synth|audio/i.test(file(n)))],
  ['Rapier (world/bodies create, step)', (c) => has(c, (n) => n === c[0] && (file(n) === 'wasm' || /rapier/.test(file(n))))],
  ['fighter/outfit construction', (c) => has(c, (n) => /(fighter|outfit[a-z_]*|looks|character[a-z_]*|hands|weapon[a-z_]*|armor[a-z_]*|helm[a-z_]*|hair[a-z_]*|face[a-z_]*)\.js$/.test(file(n)) || /^(Fighter|newRound)$/.test(nm(n)))],
  ['stage build (stages.build, stage_*.js, stage_kit, arena)', (c) => has(c, (n) => (/stages\.js$/.test(file(n)) && /build|clear|dispose/i.test(nm(n))) || /(stage_[a-z_]*|arena[a-z_]*|field)\.js$/.test(file(n)))],
  ['stage warm other (first draw of new stage)', (c) => has(c, (n) => /stages\.js$/.test(file(n)) && /warm/.test(nm(n)))],
  ['three.js render (normal frames)', (c) => has(c, (n) => /three/.test(file(n)) && /render$/.test(nm(n)))],
  ['other JS', () => true],
];
// --long: restrict to the longest gap between two runs of main.js frame() samples (= the long frame)
let keep = null;
if (process.argv.includes('--long')) {
  let t = p.startTime; const T = []; const isF = [];
  for (let i = 0; i < p.samples.length; i++) { t += p.timeDeltas[i]; T.push(t); let f = false; for (let x = p.samples[i]; x; x = parent.get(x)) { const n = byId.get(x); if (n.callFrame.functionName.startsWith('frame') && /main\.js/.test(n.callFrame.url)) { f = true; break; } } isF.push(f); }
  let best = [0, 0], lastF = -1;
  for (let i = 0; i < T.length; i++) if (isF[i]) { if (lastF >= 0 && T[i] - T[lastF] > best[1] - best[0]) best = [T[lastF], T[i]]; lastF = i; }
  keep = (i) => T[i] > best[0] && T[i] < best[1];
  console.log(`long gap between frame() samples: ${((best[1] - best[0]) / 1000).toFixed(0)}ms`);
}
let tot = 0; const S = {}, FS = {}, FT = {};
for (let i = 0; i < p.samples.length; i++) {
  if (keep && !keep(i)) continue;
  const us = Math.max(0, p.timeDeltas[i + 1] ?? 0);
  tot += us;
  const chain = []; for (let x = p.samples[i]; x; x = parent.get(x)) chain.push(byId.get(x));
  const g = G.find(([, f]) => f(chain))[0];
  S[g] = (S[g] || 0) + us;
  const k = (n) => `${nm(n)} ${file(n) || '(native)'}:${n.callFrame.lineNumber + 1}`;
  FS[k(chain[0])] = (FS[k(chain[0])] || 0) + us;
  const seen = new Set(); for (const n of chain) { const kk = k(n); if (seen.has(kk)) continue; seen.add(kk); FT[kk] = (FT[kk] || 0) + us; }
}
const idle = S.idle || 0;
const pr = (o, lim, den) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, lim).map(([k, v]) => `${((100 * v) / den).toFixed(1).padStart(5)}% ${(v / 1000).toFixed(0).padStart(6)}ms  ${k}`).join('\n');
console.log(`profile ${(tot / 1000).toFixed(0)}ms, idle ${(idle / 1000).toFixed(0)}ms; shares below are of non-idle`);
console.log('== groups'); console.log(pr(S, 20, tot - idle));
console.log('== top self'); console.log(pr(FS, N, tot - idle));
console.log('== top total'); console.log(pr(FT, N + 15, tot - idle));
