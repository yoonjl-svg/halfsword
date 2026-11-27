// 고정 몸 자세 · 손 축을 −pole 둘레 고리(각 th)로 0.1° 씩 돌려 위팔 목표가 한 걸음에 가장 크게 바뀐 각: node ring.mjs <칸> [th...] → stdout
const [C, ...TH] = process.argv.slice(2);
const F = (await import(C + '/src/fighter.js')).Fighter;
const THREE = await import(C + '/node_modules/three/build/three.module.js');
const mk = (qu) => ({ jointByName: { uarmO: { target: new THREE.Quaternion() }, farmO: { target: new THREE.Quaternion() } }, bodies: { chest: { rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }), translation: () => ({ x: 0, y: 0, z: 0 }) }, uarmO: { rotation: () => qu } }, side: 1 });
const pole = new THREE.Vector3(-0.25, -1, -0.5).normalize(), np = pole.clone().negate();
const e1 = new THREE.Vector3(1, 0, 0).addScaledVector(np, -np.x).normalize(), e2 = new THREE.Vector3().crossVectors(np, e1);
const S0 = new THREE.Vector3(0, 0.1, -0.2), HD = 180 / Math.PI;
// 몸 자세 몇 가지: 위팔이 −pole 쪽에서 조금 비낀 여러 쪽 (곧은 몫 큼 · 0.5)
for (const th of (TH.length ? TH : ['5', '17.5', '24']).map(Number)) {
  let worst = 0, cnt = 0;
  for (let ps = 0; ps < 12; ps++) {
    const ua = np.clone().multiplyScalar(Math.cos(0.5)).addScaledVector(e1.clone().multiplyScalar(Math.cos(ps * Math.PI / 6)).addScaledVector(e2, Math.sin(ps * Math.PI / 6)), Math.sin(0.5)).normalize();
    const qu = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), ua);
    const f = mk({ x: qu.x, y: qu.y, z: qu.z, w: qu.w }); let prev = null, mx = 0;
    for (let i = 0; i <= 3600; i++) {
      const ph = i / 10 / HD, t = th / HD;
      const Dn = np.clone().multiplyScalar(Math.cos(t)).addScaledVector(e1.clone().multiplyScalar(Math.cos(ph)).addScaledVector(e2, Math.sin(ph)), Math.sin(t));
      F.prototype.offArmIK.call(f, S0.clone().addScaledVector(Dn, 0.45));
      const q = f.jointByName.uarmO.target.clone();
      if (prev) { const d = 2 * Math.acos(Math.min(1, Math.abs(q.dot(prev)))) * HD; mx = Math.max(mx, d); if (d > 8) cnt++; }
      prev = q;
    }
    worst = Math.max(worst, mx);
  }
  console.log(`th ${th}°: 몸 자세 12 · 0.1° 걸음 · 한 걸음 가장 큰 위팔 목표 바뀜 ${worst.toFixed(1)}° · > 8° 걸음 ${cnt}`);
}
