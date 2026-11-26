// 서 있을 때 칼끝 겨눔 차이: 칼날 방향과 손목이 겨누는 방향(debug.aim) 사이 각 · 손목 토크 ÷ 상한 (읽기만)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const THREE = await import(u('node_modules/three/build/three.module.js'));
for (const w of String(args.weapons ?? 'longsword,rapier,zweihander,katana').split(',')) {
  const G = H.newRound({ walls: false, weapon: w, seed: 7 }); G.park?.(); const P = G.player; const DT = 1 / 120; const rows = [];
  for (let i = 0; i < Math.round(7 / DT); i++) { P.move.set(0, 0); G.step(); if (i < 3 / DT) continue;
    const q = P.sword.rotation(); const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)); const aim = P.debug.aim;
    rows.push({ e: Math.acos(Math.max(-1, Math.min(1, blade.dot(aim) / (aim.length() || 1)))) * 57.2958, t: P.debug.wristTorque.length(), cap: P.debug.wristCap }); }
  const med = (f) => { const a = rows.map(f).sort((x, y) => x - y); return a[a.length >> 1]; };
  console.log(`${w.padEnd(10)} 칼날이 겨눔에서 ${med((r) => r.e).toFixed(1)}° · 손목 토크 ${med((r) => r.t).toFixed(1)} / 상한 ${med((r) => r.cap).toFixed(1)} N·m · 상한에 닿은 스텝 ${(100 * rows.filter((r) => r.t > 0.98 * r.cap).length / rows.length).toFixed(0)} %`);
}
