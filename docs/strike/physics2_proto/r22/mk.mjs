// r22 칸 만들기: SCRATCH=$S node mk.mjs <칸...> — r21/mk.mjs 와 같은 틀($SCRATCH/p2/r6/mx/cells/fb_base 를 cp -a 하고 [파일 · 바꿀 글자 · 새 글자] 를 꼭 한 번씩 바꿈 · <칸>.diff 를 이 폴더에)
// 값만 바꾸는 칸 sd_* (config.js LEGS.limit) · 작은 코드 칸 se_* (칸 사본의 src/legs_vmc.js LegDrive.legTorques 의 자르기만 — 계획 도우미가 읽는 LEGS.limit 은 오늘 값 그대로)
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const C = `${process.env.SCRATCH}/p2/r6/mx/cells`;
const OLD = 'limit: { hipFlex: 250, hipAbd: 150, hipRot: 70, kneeExt: 250, kneeFlex: 130, anklePlantar: 250, ankleDorsi: 60, ankleInv: 50, ankleRot: 40 },';
const BASE = { hipFlex: 250, hipAbd: 150, hipRot: 70, kneeExt: 250, kneeFlex: 130, anklePlantar: 250, ankleDorsi: 60, ankleInv: 50, ankleRot: 40 };
const lim = (o) => [['src/config.js', OLD, 'limit: { ' + Object.entries({ ...BASE, ...o }).map(([k, v]) => `${k}: ${+v.toFixed(2)}`).join(', ') + ' },']];
const mul = (m) => lim(Object.fromEntries(Object.entries(BASE).map(([k, v]) => [k, v * m])));

// ── 방향 따라 한도 (se_*): 자를 축마다 날 토크 t 의 쪽 한도에 배수 s 를 곱한다 ──
//  pair(부모, 자식, τ) 는 부모 +τ · 자식 −τ → 관절이 내는 일률 P = τ · (ω부모 − ω자식). 축마다 v = sign(t) · w (w = (ω부모 − ω자식) 의 그 축 몫, 자르는 틀과 같은 틀).
//  v < 0 = 토크와 반대로 끌려감(편심 · 일을 먹음) → w_ecc = −v. v > 0 = 동심.
//  모드 k: 편심 s = 1 + k · clamp(w_ecc / 1, 0, 1) · 동심 s = 1.
//  모드 src (Anderson 2007 표 3): 편심 s = 1 + C6 · clamp(w_ecc, 0, 1) · 동심 s = (0,1)·(C4,0.75)·(C5,0.5) 를 잇는 꺾은선, C5 뒤 같은 기울기로 바닥 0.25 까지.
const HELP = (mode, k) => `const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
// r22 칸: 방향 따라 한도 (모드 ${mode}${mode === 'k' ? ' · k ' + k : ''})
const ECC = { mode: '${mode}', k: ${k} };
const SRC = { kneeExt: [1.52, 3.95, 0.10], kneeFlex: [2.01, 5.23, 0.30], hipExt: [1.58, 3.19, 0.24], hipFlex: [2.10, 4.27, 0.22], plantar: [0.99, 3.56, 0.30], dorsi: [0.70, 1.94, 0.83], other: [1.48, 3.69, 0.2] }; // [C4, C5, C6] · other = 표에 없는 축(엉덩이 벌림 · 돌림 · 발목 안팎 · 비틀기): C6 0.2 · C4 C5 는 여섯 값 평균
const _rw = new THREE.Vector3(), _rq = new THREE.Quaternion();
let _ON = false;
function relW(p, c, q, out) { const a = p.angvel(), b = c.angvel(); out.set(a.x - b.x, a.y - b.y, a.z - b.z); if (q) out.applyQuaternion(_rq.copy(q).invert()); return out; }
function eccS(v, key) {
  if (ECC.mode === 'k') return v < 0 ? 1 + ECC.k * Math.min(1, -v) : 1;
  const [c4, c5, c6] = SRC[key] ?? SRC.other;
  if (v < 0) return 1 + c6 * Math.min(1, -v);
  return v <= c4 ? 1 - (0.25 * v) / c4 : Math.max(0.25, 0.75 - (0.25 * (v - c4)) / (c5 - c4));
}
function clE(t, w, lo, hi, kNeg, kPos, st) {
  const v = t >= 0 ? w : -w, s = eccS(v, t >= 0 ? kPos : kNeg);
  const W = globalThis.__eccWin;
  if (W && _ON) { const R = (globalThis.__ecc ??= {}), o = ((R[W] ??= {})[st] ??= { n: 0, ecc: 0, sumS: 0 }); o.n++; if (v < 0) o.ecc++; o.sumS += s; }
  return t >= 0 ? Math.min(t, hi * s) : Math.max(t, -lo * s);
}`;
const V = 'src/legs_vmc.js';
const ecc = (mode, k) => [
  [V, 'const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));', HELP(mode, k)],
  [V, '    const lim = LEGS.limit;\n', '    const lim = LEGS.limit;\n    _ON = ankleOn;\n'],
  [V, `      const x = clamp(_b.x, -lim.ankleInv * str, lim.ankleInv * str);
      const y = clamp(_b.y, -lim.ankleRot * str, lim.ankleRot * str);
      const z = clamp(_b.z, -lim.ankleDorsi * str, lim.anklePlantar * str);`,
  `      relW(sh, ft, L.qF, _rw);
      const x = clE(_b.x, _rw.x, lim.ankleInv * str, lim.ankleInv * str, 'other', 'other', 'ankleX');
      const y = clE(_b.y, _rw.y, lim.ankleRot * str, lim.ankleRot * str, 'other', 'other', 'ankleY');
      const z = clE(_b.z, _rw.z, lim.ankleDorsi * str, lim.anklePlantar * str, 'dorsi', 'plantar', 'ankleZ');`],
  [V, '      const s = clamp(s0, -lim.kneeExt * str, lim.kneeFlex * str);',
    "      const s = clE(s0, relW(th, sh, null, _rw).dot(_b), lim.kneeExt * str, lim.kneeFlex * str, 'kneeExt', 'kneeFlex', 'knee');"],
  [V, `      const x = clamp(_b.x, -lim.hipAbd * str, lim.hipAbd * str);
      const y = clamp(_b.y, -lim.hipRot * str, lim.hipRot * str);
      const z = clamp(_b.z, -lim.hipFlex * str, lim.hipFlex * str);`,
  // 엉덩이 z: 허벅지 +z 회전 = 굽힘(sign_check.mjs 의 축 검사로 확인) → 허벅지가 받는 −τ_z > 0 ⇔ t < 0 = 굽힘 쪽
  `      relW(pel, th, L.qT, _rw);
      const x = clE(_b.x, _rw.x, lim.hipAbd * str, lim.hipAbd * str, 'other', 'other', 'hipX');
      const y = clE(_b.y, _rw.y, lim.hipRot * str, lim.hipRot * str, 'other', 'other', 'hipY');
      const z = clE(_b.z, _rw.z, lim.hipFlex * str, lim.hipFlex * str, 'hipFlex', 'hipExt', 'hipZ');`],
];
const KNOB = {
  sd_knee2: lim({ kneeExt: 500, kneeFlex: 260 }),
  sd_hip2: lim({ hipFlex: 500, hipAbd: 300, hipRot: 140 }),
  sd_ank2: lim({ anklePlantar: 500, ankleDorsi: 120, ankleInv: 100, ankleRot: 80 }),
  sd_all125: mul(1.25),
  sd_all15: mul(1.5),
  se_ecc13: ecc('k', 0.3),
  se_ecc15: ecc('k', 0.5),
  se_src: ecc('src', 0),
};
for (const cell of process.argv.slice(2)) {
  const T = `${C}/${cell}`;
  if (existsSync(T)) { console.log(cell, '있음 — 건너뜀'); continue; }
  if (!KNOB[cell]) throw new Error('모르는 칸 ' + cell);
  execSync(`cp -a ${C}/fb_base ${T}`);
  for (const [f, a, b] of KNOB[cell]) {
    const p = `${T}/${f}`, s = readFileSync(p, 'utf8');
    if (s.split(a).length !== 2) throw new Error(`${cell} ${f}: 글자가 한 번이 아님 — ${a}`);
    writeFileSync(p, s.replace(a, () => b));
  }
  let d = '';
  try { execSync(`diff -ru ${C}/fb_base/src ${T}/src`, { encoding: 'utf8' }); } catch (e) { d = e.stdout; }
  writeFileSync(`${HERE}/${cell}.diff`, d.split(process.env.SCRATCH).join('$S'));
  console.log(cell, '만듦', d.split('\n').filter((l) => /^[+-][^+-]/.test(l)).length, '줄 바뀜');
}
