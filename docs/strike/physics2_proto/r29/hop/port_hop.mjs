// r29 뛰기 나무에 다리 한도 셈(legLimit · clampLeg · 관절 빠르기 읽기 · LEGS.ecc · LEGS.eccW)을 손으로 옮김 — leglimit.patch 가 뛰기 나무(다리 구동을 고쳐 쓴 가지)에는 그대로 안 얹혀서, 같은 일곱 자르기를 글 바꾸기로 옮긴다.
//  쓰는 법: node port_hop.mjs <나무 뿌리> [ecc=1.0] [한도 %=100]   — 바꿀 글은 저마다 꼭 한 번 나와야 한다(아니면 멈춤). 값 1.0 · 100 이면 뛰기 나무와 같은 수(관문 줄로 확인).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const [ROOT, ECC = '1.0', PCT = '100'] = process.argv.slice(2);
if (!ROOT) throw new Error('나무 뿌리를 주시오');
function edit(file, pairs) {
  let s = readFileSync(file, 'utf8');
  for (const [a, b] of pairs) { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`${file}: '${a.slice(0, 70)}' 가 ${n} 번`); s = s.replace(a, () => b); }
  writeFileSync(file, s);
}
const LIM = '  limit: { hipFlex: 250, hipAbd: 150, hipRot: 70, kneeExt: 250, kneeFlex: 130, anklePlantar: 250, ankleDorsi: 60, ankleInv: 50, ankleRot: 40 },';
const lim2 = +PCT === 100 ? LIM : LIM.replace(/: (\d+)/g, (_, v) => ': ' + (+v * +PCT) / 100);
edit(join(ROOT, 'src/config.js'), [[LIM, lim2 + `\n  ecc: ${+ECC === 1 ? '1.0' : +ECC},\n  eccW: 1,`]]);
edit(join(ROOT, 'src/legs_vmc.js'), [
  ['const clamp = THREE.MathUtils.clamp;\n', `const clamp = THREE.MathUtils.clamp;
export function legLimit(base, str, wEcc) {
  const W = LEGS.eccW;
  return base * str * (1 + (LEGS.ecc - 1) * (wEcc > 0 ? (wEcc < W ? wEcc / W : 1) : 0));
}
const clampLeg = (t, w, lo, hi, str) => clamp(t, -legLimit(lo, str, -w), legLimit(hi, str, w));
const _wp = new THREE.Vector3();
`],
  ['    raw: { hx: 0, hy: 0, hz: 0, k: 0, ax: 0, ay: 0, az: 0 },', '    wH: new THREE.Vector3(), wK: 0, wA: new THREE.Vector3(),\n    raw: { hx: 0, hy: 0, hz: 0, k: 0, ax: 0, ay: 0, az: 0 },'],
  ['    L.lx = -L.hz; L.lz = L.hx;\n  }', `    L.lx = -L.hz; L.lz = L.hx;
    let w = th.angvel();
    const tx = w.x, ty = w.y, tz = w.z;
    L.wH.set(tx - _wp.x, ty - _wp.y, tz - _wp.z).applyQuaternion(_qi.copy(L.qT).invert());
    w = sh.angvel();
    _t.set(0, 0, 1).applyQuaternion(L.qT);
    L.wK = (w.x - tx) * _t.x + (w.y - ty) * _t.y + (w.z - tz) * _t.z;
    const sx = w.x, sy = w.y, sz = w.z;
    w = ft.angvel();
    L.wA.set(w.x - sx, w.y - sy, w.z - sz).applyQuaternion(_qi.copy(L.qF).invert());
  }`],
  ["    for (const k of ['F', 'B']) this.senseLeg(this.legs[k]);", "    { const w = f.bodies.pelvis.angvel(); _wp.set(w.x, w.y, w.z); }\n    for (const k of ['F', 'B']) this.senseLeg(this.legs[k]);"],
  ['clamp(R.ax, -lim.ankleInv * str, lim.ankleInv * str)', 'clampLeg(R.ax, L.wA.x, lim.ankleInv, lim.ankleInv, str)'],
  ['clamp(R.ay, -lim.ankleRot * str, lim.ankleRot * str)', 'clampLeg(R.ay, L.wA.y, lim.ankleRot, lim.ankleRot, str)'],
  ['clamp(R.az, -lim.ankleDorsi * str, lim.anklePlantar * str)', 'clampLeg(R.az, L.wA.z, lim.ankleDorsi, lim.anklePlantar, str)'],
  ['clamp(s0, -lim.kneeExt * str, lim.kneeFlex * str)', 'clampLeg(s0, L.wK, lim.kneeExt, lim.kneeFlex, str)'],
  ['clamp(R.hx, -lim.hipAbd * str, lim.hipAbd * str)', 'clampLeg(R.hx, L.wH.x, lim.hipAbd, lim.hipAbd, str)'],
  ['clamp(R.hy, -lim.hipRot * str, lim.hipRot * str)', 'clampLeg(R.hy, L.wH.y, lim.hipRot, lim.hipRot, str)'],
  ['clamp(R.hz, -lim.hipFlex * str, lim.hipFlex * str)', 'clampLeg(R.hz, L.wH.z, lim.hipFlex, lim.hipFlex, str)'],
]);
const L = (await import('file://' + join(ROOT, 'src/config.js'))).LEGS;
console.log(`${ROOT}: LEGS.ecc ${L.ecc} · eccW ${L.eccW} · limit ${JSON.stringify(L.limit)}`);
