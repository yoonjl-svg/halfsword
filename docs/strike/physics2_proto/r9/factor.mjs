// 안정 셈이 감쇠 토크를 방향마다 얼마나 남기나 (서 있는 자세 · 읽기만): 어깨 — 뼈 축 · 어깨–손 선 · 그 둘에 수직 · 손목 — 칼날에 수직인 두 방향(아래팔 축 쪽 · 그에 수직)
//  + 스프링 한계: h² × (강성 ÷ 관성)의 가장 큰 값 (1 밑이어야 스프링이 부호를 바꾸며 흔들리지 않음)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs')); const THREE = await import(u('node_modules/three/build/three.module.js'));
for (const w of String(args.weapons ?? 'longsword,rapier,zweihander,katana').split(',')) {
  const G = H.newRound({ walls: false, weapon: w, seed: 7 }); G.park?.(); const P = G.player; const DT = 1 / 120;
  for (let i = 0; i < Math.round(4 / DT); i++) { P.move.set(0, 0); G.step(); }
  const q = (b) => { const r = b.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); };
  const bone = new THREE.Vector3(1, 0, 0).applyQuaternion(q(P.bodies.uarmS)); const fa = new THREE.Vector3(1, 0, 0).applyQuaternion(q(P.bodies.farmS)); const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(q(P.sword));
  P._armTick++; const Dy = P.armDyn(); const line = Dy.R.clone().normalize(); const n2 = bone.clone().cross(line).normalize(); const n1 = line.clone().addScaledVector(bone, -line.dot(bone)).normalize();
  const J = P.jointByName.uarmS; const d = J.d, k = J.k; const twR = H.CONFIG.JOINTS.twistK / 25;
  const g = (v) => { const t = v.clone(); P._armTick++; P.stableTorque(bone, d, 0.8 * twR, t); return t.dot(v).toFixed(2); };
  const damp = P.weaponCfg.aimDamping; const p1 = fa.clone().addScaledVector(blade, -fa.dot(blade)).normalize(); const p2 = blade.clone().cross(p1).normalize();
  const gw = (v) => { const t = v.clone(); P._armTick++; P.stableWrist(blade, damp, fa, t); return t.dot(v).toFixed(2); };
  // 스프링 한계: M⁻¹ K 의 가장 큰 값 (거듭제곱 되풀이) — K = k·(1 − a aᵀ) + 25 twR·a aᵀ
  P._armTick++; const Mi = P.armDyn().Minv.clone(); let v = new THREE.Vector3(0.3, 0.5, 0.8), lam = 0;
  for (let i = 0; i < 60; i++) { const kv = v.clone().addScaledVector(bone, -v.dot(bone)).multiplyScalar(k).addScaledVector(bone, 25 * twR * v.dot(bone)); const nv = kv.applyMatrix3(Mi); lam = nv.length() / v.length(); v = nv.normalize(); }
  console.log(`${w.padEnd(10)} 어깨 감쇠 남는 몫: 뼈 축(비틀기) ${g(bone)} · 어깨–손 선 쪽 ${g(n1)} · 그 둘에 수직(팔 전체 휘두름) ${g(n2)} | 손목 겨눔 감쇠(${damp}) 남는 몫: 아래팔 축 쪽 ${gw(p1)} · 그에 수직 ${gw(p2)} | 어깨 스프링 한계 h²·λ = ${(lam / 14400).toFixed(2)} (1 밑)`);
}
