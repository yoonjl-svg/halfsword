// 부름 하나 견줌 (시뮬 없음): node bit_chk.mjs <바탕 칸> <새 칸> [N] → 같은 입력(가슴 · 손 목표 · 지금 위팔 자세 · side)으로 두 칸의 offArmIK 를 불러
//  uarmO · farmO 목표 사원수가 비트까지 같은지를 손 축과 −pole 각 띠별로 셈. 바깥 각 밖은 모두 같아야 함. 출력 한 줄씩 (띠 · 부름 · 다름 · 가장 큰 각 차 °)
const [A, B, N = '400000'] = process.argv.slice(2);
const FA = (await import(A + '/src/fighter.js')).Fighter, FB = (await import(B + '/src/fighter.js')).Fighter;
const { ARM } = await import(B + '/src/config.js');
const THREE = await import(B + '/node_modules/three/build/three.module.js');
let s = 12345; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const rq = (q) => { const u = [rnd(), rnd(), rnd()]; return q.set(Math.sqrt(1 - u[0]) * Math.sin(2 * Math.PI * u[1]), Math.sqrt(1 - u[0]) * Math.cos(2 * Math.PI * u[1]), Math.sqrt(u[0]) * Math.sin(2 * Math.PI * u[2]), Math.sqrt(u[0]) * Math.cos(2 * Math.PI * u[2])); };
const mk = () => ({ jointByName: { uarmO: { target: new THREE.Quaternion() }, farmO: { target: new THREE.Quaternion() } }, bodies: { chest: { r: null, t: null, rotation() { return this.r; }, translation() { return this.t; } }, uarmO: { r: null, rotation() { return this.r; } } }, side: 1 });
const fa = mk(), fb = mk(), HD = 180 / Math.PI;
const bands = [[0, ARM.offElbowIn], [ARM.offElbowIn, ARM.offElbowOut], [ARM.offElbowOut, 180]].map(([lo, hi]) => ({ lo, hi, n: 0, diff: 0, mx: 0 }));
const qc = new THREE.Quaternion(), qu = new THREE.Quaternion(), T = new THREE.Vector3(), Dn = new THREE.Vector3(), pole = new THREE.Vector3();
for (let i = 0; i < +N; i++) {
  const side = rnd() < 0.5 ? 1 : -1; rq(qc); rq(qu);
  const c = { x: rnd() * 4 - 2, y: 1.2 + rnd() * 0.3, z: rnd() * 4 - 2 };
  // 손 목표: 절반은 −pole 가까이 몰아 띠마다 넉넉히 (가슴 틀에서 뽑아 월드로)
  pole.set(-0.25, -1, -side * 0.5).normalize();
  if (rnd() < 0.5) Dn.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(rnd() * 1.2).sub(pole).normalize(); else Dn.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
  T.copy(Dn).multiplyScalar(0.05 + rnd() * 0.6).add({ x: 0, y: 0.1, z: -side * 0.2 }).applyQuaternion(qc).add(c);
  const th = Math.acos(Math.max(-1, Math.min(1, -Dn.dot(pole)))) * HD;
  for (const f of [fa, fb]) { f.side = side; f.bodies.chest.r = { x: qc.x, y: qc.y, z: qc.z, w: qc.w }; f.bodies.chest.t = c; f.bodies.uarmO.r = { x: qu.x, y: qu.y, z: qu.z, w: qu.w }; }
  FA.prototype.offArmIK.call(fa, T.clone()); FB.prototype.offArmIK.call(fb, T.clone());
  const a = fa.jointByName, b = fb.jointByName;
  const same = ['x', 'y', 'z', 'w'].every((k) => a.uarmO.target[k] === b.uarmO.target[k] && a.farmO.target[k] === b.farmO.target[k]);
  const d = 2 * Math.acos(Math.min(1, Math.abs(a.uarmO.target.dot(b.uarmO.target)))) * HD;
  const g = bands.find((x) => th >= x.lo && th < x.hi) || bands[2];
  g.n++; if (!same) { g.diff++; g.mx = Math.max(g.mx, d); }
}
for (const g of bands) console.log(`손 축 −pole 각 ${g.lo} ~ ${g.hi}°: 부름 ${g.n} · 비트 다름 ${g.diff} · 위팔 목표 가장 큰 차 ${g.mx.toFixed(2)}°`);
