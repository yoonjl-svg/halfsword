// 서 있는 자세에서 칼 든 어깨: 근육이 겨누는 위팔 자세와 실제 자세의 차이 · 밧줄 여유 · 팔꿈치 (읽기만)
//  node sh_err.mjs --root=<나무> --weapon=rapier [--secs=4]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const THREE = await import(u('node_modules/three/build/three.module.js'));
const { HUMAN } = await import(u('src/fighter.js'));
const HM = H;
const G = H.newRound({ walls: false, weapon: String(args.weapon ?? 'longsword'), seed: 7 });
G.park?.(); const P = G.player; const DT = 1 / 120;
const q = (b) => { const r = b.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); };
const HD = Math.PI / 180; const N = [HUMAN.shoulderPlane[1] - 90, HUMAN.shoulderPlane[0] + 90].map((c) => [Math.sin(c * HD), Math.cos(c * HD)]);
const side = P.side ?? P.swordSide ?? 1;
const rows = [];
const n = Math.round((+(args.secs ?? 4) + 3) / DT);
for (let i = 0; i < n; i++) {
  P.move.set(0, 0); G.step();
  if (i < 3 / DT) continue;
  const J = P.jointByName.uarmS, E = P.jointByName.farmS;
  const qp = q(J.parent), qc = q(J.child);
  const qt = qp.clone().multiply(J.target);
  const err = qt.clone().multiply(qc.clone().invert()); if (err.w < 0) { err.x *= -1; err.y *= -1; err.z *= -1; err.w *= -1; }
  const ang = 2 * Math.acos(Math.min(1, err.w)); const s = Math.sqrt(1 - err.w * err.w) || 1; const rv = new THREE.Vector3(err.x / s * ang, err.y / s * ang, err.z / s * ang);
  const bone = new THREE.Vector3(1, 0, 0).applyQuaternion(qc), boneT = new THREE.Vector3(1, 0, 0).applyQuaternion(qt);
  const tw = rv.dot(bone); const sw = rv.clone().addScaledVector(bone, -tw).length();
  const dirErr = Math.acos(Math.min(1, bone.dot(boneT)));
  const ci = qp.clone().invert(); const ua = bone.clone().applyQuaternion(ci), ut = boneT.clone().applyQuaternion(ci);
  const rm = (v) => Math.min(...N.map(([sn, cs]) => sn * v.x + side * cs * v.z));
  // 팔꿈치: 경첩 각 (위팔 x 와 아래팔 x 사이)
  const fb = new THREE.Vector3(1, 0, 0).applyQuaternion(q(E.child)); const elb = Math.acos(Math.max(-1, Math.min(1, bone.dot(fb))));
  const et = E.target; const elbT = et == null ? NaN : (typeof et === 'number' ? et : 2 * Math.acos(Math.min(1, Math.abs(et.w))));
  rows.push({ sw, tw, dirErr, rmA: rm(ua), rmT: rm(ut), elb, elbT, k: J.k, max: J.max, ua: [ua.x, ua.y, ua.z], ut: [ut.x, ut.y, ut.z] });
}
const med = (f) => { const a = rows.map(f).sort((x, y) => x - y); return a[a.length >> 1]; };
const D = (x) => (x / HD).toFixed(1);
const r0 = rows[rows.length - 1];
console.log(`${String(args.weapon ?? 'longsword').padEnd(10)} 위팔 방향 차이 ${D(med((r) => r.dirErr))}° · 휘두름 쪽 남은 회전 ${D(med((r) => r.sw))}° (근육 k ${r0.k} × 그 각 = ${(r0.k * med((r) => r.sw)).toFixed(0)} N·m, 상한 ${r0.max}) · 돌림 쪽 ${D(med((r) => r.tw))}° · 밧줄 여유(실제 ${med((r) => r.rmA).toFixed(2)} · 겨눔 ${med((r) => r.rmT).toFixed(2)}; 0 아래 = 밖) · 팔꿈치 실제 ${D(med((r) => r.elb))}° 겨눔 ${D(med((r) => r.elbT))}°`);
console.log(`   위팔(가슴 틀) 실제 [${r0.ua.map((x) => x.toFixed(2))}] 겨눔 [${r0.ut.map((x) => x.toFixed(2))}] · 칼 쪽 ${side}`);
