// r27 부호 검사 (r22/sign_check.mjs 를 이 나무에 맞게): 하나뿐인 한도 셈 legLimit 이 받는 '늘어나며 버티는 빠르기'의 부호가 일곱 축 모두 맞는지.
//  쓰는 법: (cd <나무> && node docs/strike/physics2_proto/r27/sign_check.mjs [--J=40])
//  1) 축 검사 (선 자세 2 s 뒤 · 두 다리 · r22 와 같음): + 이면 정강이 +z = 무릎 폄 · 허벅지 +z = 엉덩이 굽힘 · 발 +z = 발등 굽힘.
//  2) 무릎 기하 검사: 무릎 굽힘 빠르기 dφ/dt(다리 길이로 잰 것)와 −wK(= (허벅지 − 정강이) 각속도 · 허벅지 z — wK 는 이 나무가 한도 셈에 넣는 자식 − 부모 빠르기)의 부호가 같은 몫 → 100 % 여야 함.
//  3) 가라앉기(아래로 J N·s) · 들기(위로): 골반이 내려가는 창 'sink' · 올라가는 창 'rise' 에서 딛은 다리 한도 축마다 구동 토크(부모 쪽 · 이번 스텝 합)의 그 쪽 wEcc(legs_vmc.js 의 clampLeg 와 같은 셈: + 쪽 w · − 쪽 −w) > 0 인 몫 = 늘어나며 버틴 몫.
//     기대: 무릎은 sink 에서 폄 토크 · 굽는 중 → 늘어나며(높음), rise 에서 폄 토크 · 펴는 중 → 줄며(낮음).
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { THREE } = H;
const DT = H.DT, J = +(args.J ?? 40);
const V3 = () => new THREE.Vector3();
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const AXN = ['hip.x(벌림)', 'hip.y(돌림)', 'hip.z(굽힘)', 'knee(− 폄)', 'ankle.x(안팎)', 'ankle.y(비틀기)', 'ankle.z(+ 발바닥)'];
function scene(name, dir) {
  const G = H.newRound({ walls: false, weapon: 'longsword', seed: 100 });
  G.park();
  const P = G.player, D = P.legDrive;
  const settle = Math.round(2.0 / DT), n = settle + Math.round(1.5 / DT);
  const axis = {}, kn = { sink: { n: 0, ok: 0 }, rise: { n: 0, ok: 0 } }, ecc = { sink: AXN.map(() => [0, 0]), rise: AXN.map(() => [0, 0]) }, prevPhi = {};
  let minY = 9, maxY = 0, y0 = 0;
  const zT = V3(), zF = V3(), xF = V3(), a = V3(), b = V3(), qi = new THREE.Quaternion(), t = V3();
  const phiOf = (L) => { const len = L.ph.distanceTo(L.pa); const c = Math.min(1, Math.max(-1, (L.lenT * L.lenT + L.lenS * L.lenS - len * len) / (2 * L.lenT * L.lenS))); return Math.PI - Math.acos(c); };
  for (let i = 0; i < n; i++) {
    if (i === settle) {
      y0 = P.bodies.pelvis.translation().y;
      const fwd = V3().set(Math.cos(P.heading), 0, -Math.sin(P.heading));
      for (const k of ['F', 'B']) {
        const L = D.legs[k];
        zT.set(0, 0, 1).applyQuaternion(L.qT); zF.set(0, 0, 1).applyQuaternion(L.qF); xF.set(1, 0, 0).applyQuaternion(L.qF);
        axis[k] = { knee: a.copy(zT).cross(b.copy(L.pa).sub(L.pk)).dot(fwd), hip: a.copy(zT).cross(b.copy(L.pk).sub(L.ph)).dot(fwd), ankle: a.copy(zF).cross(xF).y };
      }
      const s = dir * J;
      P.bodies.pelvis.applyImpulse({ x: 0, y: s / 2, z: 0 }, true);
      P.bodies.chest.applyImpulse({ x: 0, y: s / 2, z: 0 }, true);
    }
    let win = null;
    if (i >= settle) { const vy = P.bodies.pelvis.linvel().y; win = vy < -0.05 ? 'sink' : vy > 0.05 ? 'rise' : null; }
    G.step();
    if (i < settle) { prevPhi.F = prevPhi.B = null; continue; }
    const y = P.bodies.pelvis.translation().y; minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const k of ['F', 'B']) {
      const L = D.legs[k];
      const phi = phiOf(L), dphi = prevPhi[k] == null ? 0 : (phi - prevPhi[k]) / DT; prevPhi[k] = phi;
      if (!win || !L.on) continue;
      if (Math.abs(dphi) > 0.2) { kn[win].n++; if (Math.sign(dphi) === Math.sign(-L.wK)) kn[win].ok++; }
      // 구동 토크 (부모 쪽 · 한도 틀) 와 그 쪽 wEcc
      qi.copy(L.qT).invert(); t.copy(L.tqH).applyQuaternion(qi);
      const tz = V3().set(0, 0, 1).applyQuaternion(L.qT);
      const tk = L.tqK.dot(tz);
      const qa = new THREE.Quaternion().copy(L.qF).invert(); const ta = V3().copy(L.tqA).applyQuaternion(qa);
      const T = [t.x, t.y, t.z, tk, ta.x, ta.y, ta.z], W = [L.wH.x, L.wH.y, L.wH.z, L.wK, L.wA.x, L.wA.y, L.wA.z];
      T.forEach((tq, ai) => { if (Math.abs(tq) < 1) return; const wE = tq >= 0 ? W[ai] : -W[ai]; const E = ecc[win][ai]; E[0]++; if (wE > 0) E[1]++; });
    }
  }
  console.log(`\n장면 ${name} (${dir < 0 ? '아래' : '위'}로 ${J} N·s) · 골반 높이 ${f2(y0)} → 가장 낮음 ${f2(minY)} · 가장 높음 ${f2(maxY)} m`);
  console.log(`  축 검사: ` + ['F', 'B'].map((k) => `${k} 무릎 ${f2(axis[k].knee)} 엉덩이 ${f2(axis[k].hip)} 발목 ${f2(axis[k].ankle)}`).join(' · '));
  for (const W of ['sink', 'rise']) {
    const K = kn[W];
    console.log(`  창 ${W}: 무릎 dφ/dt 와 −wK 부호 같은 몫 ${K.n ? ((100 * K.ok) / K.n).toFixed(0) : '-'} % (${K.n} 스텝) · 늘어나며 버틴 몫: ` + AXN.map((nm, ai) => { const [c, e] = ecc[W][ai]; return `${nm} ${c ? ((100 * e) / c).toFixed(0) + '%' : '-'}(${c})`; }).join(' · '));
  }
}
scene('sink', -1);
scene('lift', +1);
