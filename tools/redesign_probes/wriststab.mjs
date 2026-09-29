// 가벼운 칼 손목 튐 수치: 무기마다 c·dt/I, k·dt²/I, 최대 토크 한 스텝 각속도·칼끝 속도 변화 (1이 넘으면 한 스텝에 튄다)
// 실행: node tools/redesign_probes/wriststab.mjs (저장소 루트에서; src 패치 불필요)
const H = await import('../sim/harness_m.mjs');
const { WEAPON_LIST } = await import('../../src/weapons.js');
const dt = 1/120;
for (const w of WEAPON_LIST) {
  const G = H.newRound({ seed: 1, weapon: w.id, walls: false });
  const f = G.player, c = f.weaponCfg, I = f.swordIhand;
  // effective inertia at hand incl? swordIhand = rotational inertia about hand
  const k = c.aimStiffness, d = c.aimDamping, dr = c.releaseDamping;
  console.log(w.id.padEnd(18), 'm', f.swordMass.toFixed(2), 'Ihand', I.toFixed(4), 'k', k, 'd', d, 'dRel', dr, 'Tmax', c.maxAimTorque, 'wVmax', c.wristVmax,
    ' c*dt/I', (d*dt/I).toFixed(2), ' k*dt2/I', (k*dt*dt/I).toFixed(3), ' Tmax/I rad/s2', (c.maxAimTorque/I).toFixed(0), ' dw/step at Tmax', (c.maxAimTorque/I*dt).toFixed(1), 'rad/s', 'tipDv/step', (c.maxAimTorque/I*dt*(c.hiltLength+c.bladeLength)).toFixed(2));
}
