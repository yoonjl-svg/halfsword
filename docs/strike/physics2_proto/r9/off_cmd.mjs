import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs')); const THREE = await import(u('node_modules/three/build/three.module.js'));
const G = H.newRound({ walls: true, seed: 1, weapon: String(args.weapon ?? 'longsword'), AI2Class: H.AI }); const DT = 1 / 120; const f = G.player;
const J = f.jointByName.uarmO; let calls = [];
const o = f.offArmIK.bind(f); f.offArmIK = (t) => { const st = new Error().stack.split('\n').slice(2, 4).map((x) => x.trim().replace(/^at /, '').replace(/\(.*[\\/]/, '(').slice(0, 44)).join(' ⇐ '); calls.push({ st, t: [t.x, t.y, t.z] }); return o(t); };
let prevQ = null, prevCalls = null; let jumps = 0, n = 0; const kinds = {}; const ex = [];
for (let i = 0; i < Math.round(20 / DT); i++) { calls = []; G.step(); if (f.state !== 'stand') { prevQ = null; continue; } n++;
  const q = J.target.clone(); if (prevQ) { const a = 2 * Math.acos(Math.min(1, Math.abs(q.dot(prevQ)))) * 57.3; if (a > 8) { jumps++; const k = calls.map((c) => c.st).join(' | ') || '(부름 없음)'; kinds[k] = (kinds[k] || 0) + 1;
      if (ex.length < 6) ex.push(`t ${(i * DT).toFixed(3)} 명령이 ${a.toFixed(0)}° 뜀 · 목표 점 ${calls.map((c) => '[' + c.t.map((x) => x.toFixed(2)) + ']').join(' ')} · 앞 스텝 ${prevCalls.map((c) => '[' + c.t.map((x) => x.toFixed(2)) + ']').join(' ')} · 쥠 ${f.gripping}`); } }
  prevQ = q; prevCalls = calls; }
console.log(`빈 위팔 명령이 한 스텝에 8° 넘게 뛴 스텝 ${jumps}/${n}`); for (const [k, v] of Object.entries(kinds)) console.log(`  ${v} 번: ${k}`); console.log(ex.join('\n'));
