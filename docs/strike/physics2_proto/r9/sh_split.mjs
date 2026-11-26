// 서 있을 때 칼 든 어깨를 건너는 '코드가 건 토크'를 몸체별로 쪼갬 + 무게가 실제로 요구하는 토크 (읽기만)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const THREE = await import(u('node_modules/three/build/three.module.js'));
const G = H.newRound({ walls: false, weapon: String(args.weapon ?? 'longsword'), seed: 7 });
G.park?.(); const P = G.player; const DT = 1 / 120;
const names = ['uarmS', 'farmS', 'sword'];
const B = { uarmS: P.bodies.uarmS, farmS: P.bodies.farmS, sword: P.sword };
const acc = {}; let stackSeen = {};
for (const n of names) { const b = B[n]; if (!b) continue; const o = b.addTorque.bind(b); acc[n] = new THREE.Vector3();
  b.addTorque = (t, w) => { acc[n].x += t.x; acc[n].y += t.y; acc[n].z += t.z; const st = (new Error().stack.split('\n')[2] || '').trim().replace(/^at /, '').replace(/\(.*[\\/]/, '(').slice(0, 60); const k = n + ' ← ' + st; (stackSeen[k] ||= { n: 0, s: 0 }); stackSeen[k].n++; stackSeen[k].s += Math.hypot(t.x, t.y, t.z); return o(t, w); }; }
const rows = []; const n = Math.round(7 / DT);
for (let i = 0; i < n; i++) {
  for (const k in acc) acc[k].set(0, 0, 0);
  if (i < 3 / DT) stackSeen = {};
  P.move.set(0, 0); G.step();
  if (i < 3 / DT) continue;
  const net = new THREE.Vector3(); for (const k in acc) net.add(acc[k]);
  // 무게가 어깨 둘레에 거는 토크 (팔 + 칼)
  const sh = P.bodies.uarmS.translation(), qc = P.bodies.uarmS.rotation();
  const S0 = new THREE.Vector3(-0.15, 0, 0).applyQuaternion(new THREE.Quaternion(qc.x, qc.y, qc.z, qc.w)).add(new THREE.Vector3(sh.x, sh.y, sh.z));
  const g = new THREE.Vector3();
  for (const k of names) { const b = B[k]; if (!b) continue; const c = b.worldCom ? b.worldCom() : b.translation(); const r = new THREE.Vector3(c.x - S0.x, c.y - S0.y, c.z - S0.z); g.add(r.cross(new THREE.Vector3(0, -9.81 * b.mass(), 0))); }
  rows.push({ net: net.length(), u: acc.uarmS.length(), f: acc.farmS.length(), s: acc.sword?.length() ?? 0, g: g.length(), along: net.clone().add(g).length() });
}
const med = (f) => { const a = rows.map(f).sort((x, y) => x - y); return a[a.length >> 1]; };
console.log(`${String(args.weapon ?? 'longsword').padEnd(10)} 어깨 건너는 코드 토크 합 ${med((r) => r.net).toFixed(0)} N·m (위팔에 ${med((r) => r.u).toFixed(0)} · 아래팔에 ${med((r) => r.f).toFixed(0)} · 칼에 ${med((r) => r.s).toFixed(0)}) · 팔 + 칼 무게가 어깨에 거는 토크 ${med((r) => r.g).toFixed(0)} N·m · 합 + 무게 = ${med((r) => r.along).toFixed(0)} (0 이면 꼭 무게만큼)`);
for (const [k, v] of Object.entries(stackSeen).sort((a, b) => b[1].s - a[1].s).slice(0, 8)) console.log(`     ${k.padEnd(72)} 스텝마다 ${(v.n / rows.length).toFixed(1)} 번 · 평균 ${(v.s / v.n).toFixed(1)} N·m`);
