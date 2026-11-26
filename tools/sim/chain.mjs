// ─────────────────────────────────────────────────────────────
//  chain.mjs — 원칙 재기 넷째: 온몸으로 치는가 (물리 2.0 · 11/26 사장님 '너의 제안은 타당하다' — 새 잣대). 재기만 한다.
//   숨은 힘(honesty.mjs) · 관절 토크 한도(honesty.mjs) · 스텝마다 뒤집히는 떨림(physics2_proto/r9/buzz.mjs) 다음의 잣대:
//   ① 칼끝 빠르기 가운데 다리 · 몸통 몫  ② 실제 칼 운동 에너지(판정 배율 STRIKE.energyScale 을 곱하기 앞)
// ─────────────────────────────────────────────────────────────
// 칼끝 빠르기가 몸의 어디서 오나 (읽기만): 싸움(AI 대 AI)에서 벨 때마다 칼끝이 가장 빠른 순간에
//  v_칼끝 = 골반 옮겨 감(다리가 몸을 미는 몫) + 골반 돌기 + Σ 관절마다 (자식 − 부모 각속도) × (칼끝 − 관절 점)  을 칼끝이 가는 방향으로 비춘 몫.
//  node chain.mjs --root=<나무> [--weapons=longsword,zweihander,rapier] [--seeds=1,2,3] [--secs=20]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs')); const THREE = await import(u('node_modules/three/build/three.module.js'));
const V = (o) => new THREE.Vector3(o.x, o.y, o.z); const Q = (b) => { const r = b.rotation(); return new THREE.Quaternion(r.x, r.y, r.z, r.w); };
const CH = ['abdomen', 'chest', 'uarmS', 'farmS']; const NAME = { move: '골반 옮겨 감(다리)', prot: '골반 돌기(다리 · 엉덩이)', abdomen: '허리 아래(골반–배)', chest: '허리 위(배–가슴)', uarmS: '어깨', farmS: '팔꿈치', sword: '손목' };
const DT = 1 / 120; const W = String(args.weapons ?? 'longsword,zweihander,rapier').split(','); const seeds = String(args.seeds ?? '1,2,3').split(',').map(Number);
function decomp(f) {
  const tip = f.bladePoint(1, new THREE.Vector3());
  const s = f.sword; const vt = V(s.velocityAtPoint(tip)); const sp = vt.length(); if (sp < 1e-6) return null; const dir = vt.clone().multiplyScalar(1 / sp);
  const B = f.bodies; const out = {}; const pel = B.pelvis; const cP = V(pel.worldCom());
  out.move = V(pel.linvel()).dot(dir); out.prot = V(pel.angvel()).cross(tip.clone().sub(cP)).dot(dir);
  let sum = out.move + out.prot;
  for (const n of CH) { const j = f.jointByName[n]; const a1 = j.joint.anchor1(); const a = V(a1).applyQuaternion(Q(j.parent)).add(V(j.parent.translation())); const w = V(j.child.angvel()).sub(V(j.parent.angvel())); out[n] = w.cross(tip.clone().sub(a)).dot(dir); sum += out[n]; }
  { const a = V(s.translation()); const w = V(s.angvel()).sub(V(B.farmS.angvel())); out.sword = w.cross(tip.clone().sub(a)).dot(dir); sum += out.sword; }
  const m = s.mass(), vc = V(s.linvel()), w = V(s.angvel()), I = s.effectiveAngularInertia();
  const Iw = new THREE.Vector3(I.m11 * w.x + I.m12 * w.y + I.m13 * w.z, I.m12 * w.x + I.m22 * w.y + I.m23 * w.z, I.m13 * w.x + I.m23 * w.y + I.m33 * w.z);
  const ke = 0.5 * m * vc.lengthSq() + 0.5 * w.dot(Iw); // 칼의 실제 운동 에너지 (J · 옮겨 감 + 돎)
  return { sp, out, resid: sp - sum, ke };
}
for (const w of W) {
  const acc = {}; let n = 0, spSum = 0, resid = 0, keSum = 0, wN = 0, wE = 0; const strokes = [];
  for (const seed of seeds) {
    const G = H.newRound({ walls: true, seed, weapon: w, AI2Class: H.AI }); const st = new Map();
    for (let i = 0; i < Math.round(+(args.secs ?? 20) / DT); i++) { G.step();
      for (const f of [G.player, G.enemy]) { if (f.state !== 'stand' || !f.armed) { st.delete(f); continue; }
        const sw = !!f.skill?.swinging; let cur = st.get(f);
        if (sw) { const d = decomp(f); if (d && (!cur || d.sp > cur.sp)) st.set(f, d); }
        else if (cur) { if (cur.sp > 6) { strokes.push(cur); n++; spSum += cur.sp; keSum += cur.ke; resid += Math.abs(cur.resid); for (const k in cur.out) acc[k] = (acc[k] || 0) + cur.out[k]; } st.delete(f); } } }
    for (const x of G.wounds ?? []) { if (x.type !== 'blunt' || x.energy > 0) { wN++; wE += x.energy; } }
    try { G.world.free(); } catch { /* */ }
  }
  if (!n) { console.log(`${w}: 벤 획 없음`); continue; }
  const order = ['move', 'prot', 'abdomen', 'chest', 'uarmS', 'farmS', 'sword'];
  console.log(`${w.padEnd(10)} 벤 획 ${n} · 칼끝 가장 빠를 때 평균 ${(spSum / n).toFixed(1)} m/s (맞춤 나머지 ${(resid / n).toFixed(2)}) — 그 빠르기가 온 곳:`);
  console.log('   ' + order.map((k) => `${NAME[k]} ${(100 * acc[k] / spSum).toFixed(0)} %`).join(' · '));
  const legsTrunk = (acc.move + acc.prot + acc.abdomen + acc.chest) / spSum, arm = (acc.uarmS + acc.farmS + acc.sword) / spSum;
  console.log(`   → 다리 · 몸통 ${(100 * legsTrunk).toFixed(0)} % · 팔(어깨 · 팔꿈치 · 손목) ${(100 * arm).toFixed(0)} %`);
  const ES = H.CONFIG.STRIKE?.energyScale ?? 1;
  console.log(`   칼의 실제 운동 에너지(칼끝이 가장 빠를 때 · 벤 획 평균) ${(keSum / n).toFixed(0)} J · 맞은 판정 ${wN} 번의 판정 에너지 평균 ${wN ? (wE / wN).toFixed(0) : '-'} J = 실제 ${wN ? (wE / wN / ES).toFixed(0) : '-'} J × 판정 배율 ${ES}`);
}
