// 빈 팔꿈치 쪽 셈만 (물리 없음 · 게임 코드 안 바꿈): ca(11/27 빌더 — m·Δψ + k 따라감) 와 cb(첫 고침 — Δψ 따름 · k 따라감 둘 다 w = min(1, m/m0) 몫) · cc(둘째 고침 — |Δψ| ≤ k·π 이면 옛 셈처럼 다 따름 · 넘으면 그 스텝 그대로) 맞댐
//  node elbow_cmp.mjs <나무 뿌리(three)>  — 네 장면: ① 목표가 pole 축을 지나감(b = 축에서 비낀 몫) ② 축 위 떨림 ③ 빠른 겨눔 바꿈(pole 쪽이 0.15 초에 90° 돎 · m 0.3 / 0.5 / 0.9) ④ 0 이 아닌 m 에서 old(pole 그대로) 와 차이
const THREE = await import(process.argv[2] + '/node_modules/three/build/three.module.js');
const V = THREE.Vector3, HD = 180 / Math.PI, k = 1 - Math.exp(-(1 / 120) / 0.2);
const X = new V();
const turnTo = (a, b, n) => Math.atan2(X.crossVectors(a, b).dot(n), a.dot(b));
const turnBy = (a, n, th) => { const x = new V().crossVectors(n, a); return a.multiplyScalar(Math.cos(th)).addScaledVector(x, Math.sin(th)).normalize(); };
const side = 1, pole = new V(-0.25, -1, -side * 0.5).normalize(), m0 = Math.hypot(pole.x, pole.z);
function mk(kind) {
  const e = new V(), pp = new V(); let first = true;
  return (pr, Dn) => {
    const m = pr.length(); const P = m > 1e-9 ? pr.clone().multiplyScalar(1 / m) : null;
    if (kind === 'old') return P.clone();
    if (first) { e.copy(P); pp.copy(P); first = false; }
    e.addScaledVector(Dn, -e.dot(Dn)).normalize();
    if (P) {
      pp.addScaledVector(Dn, -pp.dot(Dn)); const dpsi = pp.lengthSq() > 1e-12 ? turnTo(pp.normalize(), P, Dn) : 0;
      if (kind === 'cc') { // pole 쪽이 한 스텝에 따라감 한계 k·π 보다 빨리 돌면 그 스텝은 면이 안 정해진 것 — 팔꿈치를 그대로 둠 · 아니면 옛 셈처럼 다 따름 + k 따라감
        const L = k * Math.PI; if (Math.abs(dpsi) <= L) { turnBy(e, Dn, dpsi); turnBy(e, Dn, Math.min(L - dpsi, Math.max(-L - dpsi, k * turnTo(e, P, Dn)))); } // 한 스텝 돎 합도 k·π 아래
        pp.copy(P); return e.clone();
      }
      const w = kind === 'ca' ? m : Math.min(1, m / m0);
      turnBy(e, Dn, w * dpsi);
      const a = turnTo(e, P, Dn);
      turnBy(e, Dn, k * (kind === 'ca' ? 1 : w) * a);
      pp.copy(P);
    }
    return e.clone();
  };
}
const v = new V(1, 0, 0).addScaledVector(pole, -pole.x).normalize(), w = new V().crossVectors(pole, v).normalize();
const K = ['ca', 'cb', 'cc'];
console.log(`m0 (pole 의 아래 곧은 몫 = 팔 늘어뜨린 m) = ${m0.toFixed(3)} · k = ${k.toFixed(4)}`);
// ① 지나감
for (const b of [0, 0.01, 0.03]) for (const kind of K) {
  const f = mk(kind); const dirs = [];
  for (let i = 0; i <= 120; i++) dirs.push(pole.clone().addScaledVector(v, -0.6 + 1.2 * i / 120).addScaledVector(w, b).normalize());
  for (let i = 0; i < 120; i++) dirs.push(dirs[120].clone());
  let maxOff = 0, t30 = -1, upMax = -9, stepMax = 0, prev = null;
  dirs.forEach((Dn, i) => { const pr = pole.clone().addScaledVector(Dn, -pole.dot(Dn)); const e = f(pr, Dn); const a = e.angleTo(pr) * HD;
    if (prev) stepMax = Math.max(stepMax, e.angleTo(prev) * HD); prev = e;
    if (i > 60) { maxOff = Math.max(maxOff, a); if (a > 30) t30 = i; upMax = Math.max(upMax, e.y); } });
  console.log(`① 지나감 b=${b} ${kind}: pole 과 가장 먼 ${maxOff.toFixed(0)}° · 30° 넘게 남음 ${Math.max(0, (t30 - 60) / 120).toFixed(2)} 초 · 팔꿈치 y 가장 큰 ${upMax.toFixed(2)} · 한 스텝 가장 큰 ${stepMax.toFixed(2)}°`);
}
// ② 축 위 떨림 (0.4 m 에서 1.6 mm)
for (const kind of K) {
  const f = mk(kind); let prev = null, sum = 0, mx = 0, n = 0, upMax = -9, rnd = 12345; const r = () => (rnd = (rnd * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let i = 0; i < 1200; i++) { const Dn = pole.clone().addScaledVector(v, 0.008 * r()).addScaledVector(w, 0.008 * r()).normalize();
    const pr = pole.clone().addScaledVector(Dn, -pole.dot(Dn)); const e = f(pr, Dn);
    if (prev) { const a = e.angleTo(prev) * HD; sum += a; mx = Math.max(mx, a); n++; } prev = e; upMax = Math.max(upMax, e.y); }
  console.log(`② 축 위 떨림 ${kind}: 스텝마다 팔꿈치 쪽 돎 평균 ${(sum / n).toFixed(2)}° · 가장 큰 ${mx.toFixed(2)}° · 초당 ${(sum / n * 120).toFixed(0)}° · 팔꿈치 y 가장 큰 ${upMax.toFixed(2)}`);
}
// ③ 빠른 겨눔 바꿈: Dn 은 pole 에서 θ(m = sinθ) 비낀 채 pole 둘레로 90° 를 18 스텝에 돎 → 끝 뒤처짐 · 0.2 초 뒤
for (const m of [0.3, 0.5, 0.9]) for (const kind of K) {
  const f = mk(kind), th = Math.asin(m); let lag = 0, lag24 = 0;
  for (let i = 0; i <= 18 + 24; i++) { const ph = Math.PI / 2 * Math.min(i, 18) / 18;
    const Dn = pole.clone().multiplyScalar(Math.cos(th)).addScaledVector(v.clone().multiplyScalar(Math.cos(ph)).addScaledVector(w, Math.sin(ph)), Math.sin(th)).normalize();
    const pr = pole.clone().addScaledVector(Dn, -pole.dot(Dn)); const e = f(pr, Dn); const a = e.angleTo(pr) * HD;
    if (i === 18) lag = a; if (i === 18 + 24) lag24 = a; }
  console.log(`③ 겨눔 바꿈 m=${m} ${kind}: 끝 뒤처짐 ${lag.toFixed(1)}° · 0.2 초 뒤 ${lag24.toFixed(1)}°`);
}
