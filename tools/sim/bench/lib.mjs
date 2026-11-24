// ─────────────────────────────────────────────────────────────
//  lib.mjs — 물리 2.0 타격 사슬 벤치 (저장소 밖 · 재기만). 맨 Rapier 0.19.3 세계에 게임의 윗몸(골반 · 배 · 가슴 · 머리 · 두 팔 · 칼)을
//   src/fighter.js partDefs · jointDefs 의 모양 · 질량 · 관절 자리 그대로 세우고, 근육은 명시 토크 쌍으로만 건다.
//   dt 1/120 · 풀이 반복 6 · 내부 PGS 4 · 중력 −9.81 · 엔진 감쇠 0 · 덧 관성 0 (골반의 다리 yaw 관성만 — 과제가 준 것)
//   좌표: 앞 +x · 위 +y · 칼 든 쪽 +z (오른손). yaw + = 위에서 봐 반시계(앞 → 왼쪽).
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

export const HERE = dirname(fileURLToPath(import.meta.url));
const RAPIER_PATH = join(dirname(fileURLToPath(import.meta.url)), '../../../node_modules/@dimforge/rapier3d-compat/rapier.mjs');
let _R = null;
export async function loadRapier() {
  if (_R) return _R;
  const m = await import(pathToFileURL(RAPIER_PATH).href);
  _R = m.default ?? m;
  const w = console.warn; console.warn = () => {}; await _R.init(); console.warn = w;
  return _R;
}
export const WEAPONS = JSON.parse(readFileSync(join(HERE, 'weapons.json'), 'utf8'));
export const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
export const DT = 1 / 120;
export const G = 9.81;
export const DEG = Math.PI / 180;

// ── 벡터 · 쿼터니언 · 3×3 ──
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const adds = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const nrm = (a) => { const l = len(a); return l > 1e-12 ? scl(a, 1 / l) : [0, 0, 0]; };
export const perp = (a, n) => adds(a, n, -dot(a, n)); // a 에서 단위 n 쪽 몫을 뺌
export const clampLen = (a, m) => { const l = len(a); return l > m ? scl(a, m / l) : a; };
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
export const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
export const qrot = (q, v) => { const u = [q[0], q[1], q[2]]; const t = scl(cross(u, v), 2); return add(adds(v, t, q[3]), cross(u, t)); };
export const qaxis = (ax, ang) => { const s = Math.sin(ang / 2); return [ax[0] * s, ax[1] * s, ax[2] * s, Math.cos(ang / 2)]; };
export const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]); return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
/** 열이 X · Y · Z 인 회전 행렬 → 쿼터니언 */
export function qbasis(X, Y, Z) {
  const m00 = X[0], m10 = X[1], m20 = X[2], m01 = Y[0], m11 = Y[1], m21 = Y[2], m02 = Z[0], m12 = Z[1], m22 = Z[2];
  const tr = m00 + m11 + m22; let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, 0.25 * s]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [0.25 * s, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, 0.25 * s, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, 0.25 * s, (m10 - m01) / s]; }
  return qnorm(q);
}
/** 쿼터니언 → 회전 벡터 (축 × 각, −π ~ π) */
export const rotvec = (q) => { const s = Math.hypot(q[0], q[1], q[2]); if (s < 1e-12) return [0, 0, 0]; let a = 2 * Math.atan2(s, q[3]); if (a > Math.PI) a -= 2 * Math.PI; return [(q[0] / s) * a, (q[1] / s) * a, (q[2] / s) * a]; };
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
// 3×3 (행 우선 9 칸)
export const mzero = () => [0, 0, 0, 0, 0, 0, 0, 0, 0];
export const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export const madd = (a, b) => a.map((x, i) => x + b[i]);
export function minv(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
/** 세계 틀 관성: 회전 q · 주관성 대각 Ip · 주축 틀 qf(몸 기준) */
export function inertiaWorld(q, Ip, qf) {
  const qq = qf ? qmul(q, qf) : q;
  const ex = qrot(qq, X), ey = qrot(qq, Y), ez = qrot(qq, Z);
  const m = mzero();
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) m[r * 3 + c] = Ip[0] * ex[r] * ex[c] + Ip[1] * ey[r] * ey[c] + Ip[2] * ez[r] * ez[c];
  return m;
}
/** 점질량 m 을 r 만큼 떨어진 축으로 옮기는 항 m(|r|²·1 − r rᵀ) */
export const mpara = (m, r) => { const d = dot(r, r); return [m * (d - r[0] * r[0]), -m * r[0] * r[1], -m * r[0] * r[2], -m * r[1] * r[0], m * (d - r[1] * r[1]), -m * r[1] * r[2], -m * r[2] * r[0], -m * r[2] * r[1], m * (d - r[2] * r[2])]; };

export const V = (o) => [o.x, o.y, o.z];
export const O = (a) => ({ x: a[0], y: a[1], z: a[2] });
export const QO = (q) => ({ x: q[0], y: q[1], z: q[2], w: q[3] });
export const QA = (o) => [o.x, o.y, o.z, o.w];

/** 근육 힘–빠르기 (게임 src/fighter.js hill 과 같은 식): v = 힘 내는 쪽 각속도 · vmax 에서 0 · 버티는 쪽 최대 ecc 배 */
export function hill(v, vmax, a = 0.25, ecc = 1.3) {
  const r = v / vmax;
  if (r >= 1) return 0;
  if (r >= 0) return (1 - r) / (1 + r / a);
  const e = Math.min(1, -r / 0.3);
  return 1 + (ecc - 1) * (1 - (1 - e) * (1 - e));
}

// ── 몸 표 (src/fighter.js partDefs · s = +1) ──
export const PARTS = [
  { name: 'pelvis', shape: ['box', 0.1, 0.085, 0.16], pos: [0, 0.97, 0], mass: 10.7 },
  { name: 'abdomen', shape: ['box', 0.1, 0.07, 0.15], pos: [0, 1.13, 0], mass: 10.4 },
  { name: 'chest', shape: ['box', 0.11, 0.13, 0.18], pos: [0, 1.33, 0], mass: 16.2 },
  { name: 'head', shape: ['ball', 0.1], pos: [0, 1.62, 0], mass: 6.1 },
  { name: 'uarmS', shape: ['capsule', 0.105, 0.045], pos: [0.15, 1.43, 0.2], alongX: true, mass: 2.1 },
  { name: 'farmS', shape: ['capsule', 0.095, 0.04], pos: [0.435, 1.43, 0.2], alongX: true, mass: 1.65 },
  { name: 'uarmO', shape: ['capsule', 0.105, 0.045], pos: [0, 1.28, -0.2], mass: 2.1 },
  { name: 'farmO', shape: ['capsule', 0.095, 0.04], pos: [0, 0.99, -0.2], mass: 1.65 },
];
// 관절 자리 (몸 기준 · jointDefs 의 at − 토막 자리) · 한도 (humanJointDefs 뒤 값)
const TW = 45 * DEG;
export const JOINTS = [
  { name: 'waist', p: 'pelvis', c: 'abdomen', a1: [0, 0.09, 0], a2: [0, -0.07, 0], type: 'ball', lim: { x: [-0.35, 0.35], y: [-TW * 0.5 / 1.1, TW * 0.5 / 1.1], z: [-0.7, 0.3] }, game: { k: 1800, d: 180, max: 500 } },
  { name: 'back', p: 'abdomen', c: 'chest', a1: [0, 0.07, 0], a2: [0, -0.13, 0], type: 'ball', lim: { x: [-0.3, 0.3], y: [-TW * 0.6 / 1.1, TW * 0.6 / 1.1], z: [-0.5, 0.25] }, game: { k: 1600, d: 160, max: 440 } },
  { name: 'neck', p: 'chest', c: 'head', a1: [0, 0.17, 0], a2: [0, -0.12, 0], type: 'ball', lim: { x: [-0.5, 0.5], y: [-1.0, 1.0], z: [-0.7, 0.5] }, game: { k: 280, d: 16, max: 80 } },
  { name: 'shS', p: 'chest', c: 'uarmS', a1: [0, 0.1, 0.2], a2: [-0.15, 0, 0], type: 'ball', game: { k: 320, d: 26, max: 80 } }, // 한도 = 밧줄 둘 (shoulderOn)
  { name: 'elS', p: 'uarmS', c: 'farmS', a1: [0.15, 0, 0], a2: [-0.135, 0, 0], type: 'hinge', lim: [0, 150 * DEG], game: { k: 400, d: 38, max: 80 } },
  { name: 'shO', p: 'chest', c: 'uarmO', a1: [0, 0.1, -0.2], a2: [0, 0.15, 0], type: 'ball', lim: { x: [-2.4, 2.4], y: [-1.5, 1.5], z: [-1.0, 2.9] }, game: { k: 400, d: 36, max: 140 } },
  { name: 'elO', p: 'uarmO', c: 'farmO', a1: [0, -0.15, 0], a2: [0, 0.14, 0], type: 'hinge', lim: [0, 2.5], game: { k: 240, d: 20, max: 100 } },
  { name: 'wr', p: 'farmS', c: 'sword', a1: [0.13, 0, 0], a2: [0, 0, 0], type: 'ball' }, // 한도 = 손목 원뿔 밧줄 둘 (gripConeOn)
];
export const HAND_O = [0, -0.135, 0]; // 빈 아래팔 끝 (offHand)
const SUB = { // 관절 먼 쪽 토막 (닫힌 고리의 칼은 칼 팔 쪽으로 셈)
  waist: ['abdomen', 'chest', 'head', 'uarmS', 'farmS', 'sword', 'uarmO', 'farmO'], back: ['chest', 'head', 'uarmS', 'farmS', 'sword', 'uarmO', 'farmO'], neck: ['head'],
  shS: ['uarmS', 'farmS', 'sword'], elS: ['farmS', 'sword'], wr: ['sword'], shO: ['uarmO', 'farmO'], elO: ['farmO'],
};
const ALL = ['pelvis', 'abdomen', 'chest', 'head', 'uarmS', 'farmS', 'uarmO', 'farmO', 'sword'];
export const ARM = { a: 0.3, b: 0.265, aO: 0.3, bO: 0.275, S: [0, 0.1, 0.2], SO: [0, 0.1, -0.2] };

// ── 사람 한도 ──
//  HUMAN_SRC (기본): p2/human_data.md 의 출처 있는 값 (과제: 그 파일이 있으면 시작 값 대신 쓴다) — 값마다 출처 · 읽은 깊이는 RESULT.md §가정 표
//   몸통 축 돌림 105 N·m (McGill & Hoodless 1990 — 30° 감은 채 되돌리는 쪽 · 중립 97) · 몸통 굽힘 250 (Zouita 2018 굽힘 60°/s 비운동선수 249 · 운동선수 297 / 폄은 236 ~ 465)
//   어깨 85 (Harbo 2012 모음 60°/s 남 83.1 ± 17.7 · 벌림 등척 61) · 위팔 돌림 50 (Westrick 2013 안쪽 돌림 ≈ 52 — 지레 가정한 환산) · 팔꿈치 굽힘 63 / 폄 53 (Frey-Law 2012)
//   손목 한 손 12.2 (Delp 1996 굽힘 · 요측 11.0 · 척측 9.5) — 두 손이면 두 손목 몫 24.4 를 칼 손 손목 관절 하나에 모아 건다 · 목 50 (Vasavada 2001 폄 52)
//   힘–빠르기: Hill a 0.25 · 무부하 빠르기 — 팔꿈치 28 rad/s (Frey-Law 2012 의 300°/s 값 폄 0.51 · 굽힘 0.41 배에 맞춤: 32 · 23) · 몸통 관절마다 3.6 (Kumar 2003 축 돌림 −1 ~ −1.5 N·m 당 °/s → 가슴–골반 5.8 ~ 8.7 rad/s 를 두 관절이 나눔)
//    어깨 18 · 손목 30 은 게임 값 그대로 — **가정**(자료 없음). 버티는 쪽 1.2 배 (Anderson 2007 C6 0.1 ~ 0.3 · caveat 3 '10 ~ 30 %'). 활성 오름 35 ms — **가정**(과제 30 ~ 40 ms · 자료 없음)
//  HUMAN_START: 과제가 준 시작 값 (몸통 축 120 · 굽힘/폄 300 · 어깨 100 · 팔꿈치 80 · 손목 25) — 민감도 줄에서만
export const HUMAN_SRC = {
  cap: { trunkAxial: 105, trunkBend: 250, neck: 50, shoulder: 85, shoulderTwist: 50, elbowFlex: 63, elbowExt: 53, wristHand: 12.2 },
  vmax: { trunk: 3.6, neck: 20, shoulder: 18, elbow: 28, wrist: 30 }, tAct: 0.035, hillA: 0.25, ecc: 1.2,
};
export const HUMAN_START = {
  cap: { trunkAxial: 120, trunkBend: 300, neck: 60, shoulder: 100, shoulderTwist: 50, elbowFlex: 80, elbowExt: 80, wristHand: 12.5 },
  vmax: { trunk: 8, neck: 20, shoulder: 18, elbow: 25, wrist: 30 }, tAct: 0.035, hillA: 0.25, ecc: 1.3,
};
export const HUMAN0 = HUMAN_SRC;

// ── 자세 (정기구학) ──
/** 두 마디 IK (가슴 틀): 어깨 S · 손 T · 위팔 a · 아래팔 b · 팔꿈치 겨냥 pole → 위팔 방향 u · 접히는 쪽 y · 굽힘 flex · 닿은 손 자리 */
function ik2(S, T, a, b, pole) {
  const D = sub(T, S); const d = clamp(len(D), 0.08, a + b - 0.005); const Dn = nrm(D);
  let pDir = perp(nrm(pole), Dn); if (len(pDir) < 1e-3) pDir = perp([0, -1, 0], Dn); pDir = nrm(pDir);
  const alpha = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const u = add(scl(Dn, Math.cos(alpha)), scl(pDir, Math.sin(alpha)));
  const flex = Math.PI - Math.acos(clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
  let fold = perp(sub(scl(Dn, d), scl(u, a)), u); if (len(fold) < 1e-6) fold = perp(pDir, u); fold = nrm(fold);
  return { u, fold, flex, hand: adds(S, Dn, d), d };
}
const rotY = (a) => qaxis(Y, a), rotZ = (a) => qaxis(Z, a), rotX = (a) => qaxis(X, a);
/**
 * 자세 명세 → 토막마다 세계 자리 · 회전.
 *  spec: { pelYaw, twist(가슴 − 골반 yaw), lean(+ = 뒤로 젖힘 · 허리 등 반반), side(옆 굽힘), frame: 'chest'|'heading', hand[3], blade[3], pole[3], poleO[3], off: [3]|null(한손일 때 빈손 자리 · 가슴 틀) }
 *  손 · 칼끝 방향은 가슴 무게중심 기준. 두손이면 빈손이 칼자루(gripAlong)에 닿게 빈팔을 풀고, 못 닿으면 손 자리를 빈 어깨 쪽으로 당긴다(게임 twoHandReach 와 같은 뜻).
 */
export function fkPose(spec, W, twoHand) {
  const P = {};
  const qp = rotY(spec.pelYaw || 0);
  const tw = spec.twist || 0, ln = spec.lean || 0, sd = spec.side || 0;
  const qa = qmul(qp, qmul(rotY(tw * 0.45), qmul(rotZ(ln * 0.5), rotX(sd * 0.5))));
  const qc = qmul(qa, qmul(rotY(tw * 0.55), qmul(rotZ(ln * 0.5), rotX(sd * 0.5))));
  const pp = [0, 0.97, 0];
  const jw = add(pp, qrot(qp, [0, 0.09, 0])); const pa = sub(jw, qrot(qa, [0, -0.07, 0]));
  const jb = add(pa, qrot(qa, [0, 0.07, 0])); const pc = sub(jb, qrot(qc, [0, -0.13, 0]));
  P.pelvis = { p: pp, q: qp }; P.abdomen = { p: pa, q: qa }; P.chest = { p: pc, q: qc };
  const qh = qmul(qc, rotY(spec.headYaw ?? -(tw + (spec.pelYaw || 0)) * 0.8)); // 머리는 앞(겨눈 쪽)을 본다 — 목 한도 안
  const jn = add(pc, qrot(qc, [0, 0.17, 0])); P.head = { p: sub(jn, qrot(qh, [0, -0.12, 0])), q: qh };
  const qci = qconj(qc);
  const toC = (v, isDir) => (spec.frame === 'heading' ? qrot(qci, v) : v); // 가슴 틀로
  let handC = toC(spec.hand); const bladeC = nrm(spec.bladeFrame === 'heading' ? qrot(qci, spec.blade) : toC(spec.blade));
  const pole = spec.pole ?? [-0.25, -1, 0.5], poleO = spec.poleO ?? [-0.25, -1, -0.5];
  let I;
  for (let it = 0; it < 6; it++) {
    I = ik2(ARM.S, handC, ARM.a, ARM.b, pole);
    if (!twoHand) break;
    const g = adds(I.hand, bladeC, W.gripAlong); const dO = len(sub(g, ARM.SO)); const mx = ARM.aO + ARM.bO - 0.02;
    if (dO <= mx) break;
    handC = adds(I.hand, nrm(sub(ARM.SO, g)), dO - mx + 0.002);
  }
  const qu = qmul(qc, qbasis(I.u, I.fold, cross(I.u, I.fold)));
  const sh = add(pc, qrot(qc, ARM.S)); const el = add(sh, qrot(qu, [0.3, 0, 0]));
  const qf = qmul(qu, rotZ(I.flex)); const wr = add(el, qrot(qf, [0.265, 0, 0]));
  P.uarmS = { p: add(sh, qrot(qu, [0.15, 0, 0])), q: qu }; P.farmS = { p: add(el, qrot(qf, [0.135, 0, 0])), q: qf };
  // 칼: y = 칼날 방향 · z = 칼 면 법선 = 아래팔 경첩 축(굴림 0 — 쥔 자세)
  const bW = qrot(qc, bladeC); let zf = perp(qrot(qf, Z), bW); if (len(zf) < 1e-3) zf = perp(qrot(qf, Y), bW); zf = nrm(zf);
  const qs = qbasis(cross(bW, zf), bW, zf);
  P.sword = { p: wr, q: qs };
  // 빈팔
  const shO = add(pc, qrot(qc, ARM.SO));
  const tgtO = twoHand ? adds(I.hand, bladeC, W.gripAlong) : (spec.off ?? [0.12, -0.32, -0.26]);
  const IO = ik2(ARM.SO, tgtO, ARM.aO, ARM.bO, poleO);
  const xA = IO.fold, yA = scl(IO.u, -1);
  const quO = qmul(qc, qbasis(xA, yA, cross(xA, yA))); const elO = add(shO, qrot(quO, [0, -0.3, 0]));
  const qfO = qmul(quO, rotZ(IO.flex));
  P.uarmO = { p: add(shO, qrot(quO, [0, -0.15, 0])), q: quO }; P.farmO = { p: add(elO, qrot(qfO, [0, -0.14, 0])), q: qfO };
  const handO = add(elO, qrot(qfO, [0, -0.275, 0]));
  const gripW = adds(wr, bW, W.gripAlong);
  // 점검 값
  const fx = qrot(qf, X);
  const info = {
    hand: wr, blade: bW, p70: adds(wr, bW, W.hiltLength + 0.7 * W.bladeLength), tip: adds(wr, bW, W.hiltLength + W.bladeLength), chest: pc,
    elbowFlex: I.flex / DEG, offElbowFlex: IO.flex / DEG, gripGap: twoHand ? len(sub(handO, gripW)) : 0,
    wristCone: Math.acos(clamp(dot(fx, bW), -1, 1)) / DEG, // 아래팔 줄 ↔ 칼날 (한도 163)
    shPlane: [dot(I.u, [Math.sin(40 * DEG), 0, Math.cos(40 * DEG)]), dot(I.u, [Math.sin(45 * DEG), 0, Math.cos(45 * DEG)])], // 둘 다 ≥ 0 이어야 어깨 면 안
    tipBehindChest: -dot(sub(adds(wr, bW, W.hiltLength + W.bladeLength), pc), qrot(qc, X)), // 칼끝이 가슴 앞면 방향 뒤로 간 거리 (m)
    chestYaw: ((spec.pelYaw || 0) + tw) / DEG, pelYaw: (spec.pelYaw || 0) / DEG,
  };
  return { P, info };
}

// ── 세계 · 몸 ──
function shapeDesc(R, s) { return s[0] === 'box' ? R.ColliderDesc.cuboid(s[1], s[2], s[3]) : s[0] === 'ball' ? R.ColliderDesc.ball(s[1]) : R.ColliderDesc.capsule(s[1], s[2]); }
const NOCOL = 0x00010000; // 아무와도 닿지 않음 (제 몸 · 칼–몸 닿음은 벤치에서 보지 않는다)
const ALONG_X = qaxis(Z, -Math.PI / 2);

export class Model {
  /**
   * o: { weapon, twoHand, pose(spec), legsI(다리 yaw 관성 kg·m²), pgs, iters, game(게임 감쇠 · 덧 관성 켬), offJoint(빈손–칼자루 공 관절), fixture: 'yaw'(yaw 만 풂) | 'lock' | 'slide'(운동학 받침 — 찌르기) }
   */
  constructor(R, o) {
    this.R = R; this.o = o;
    const W = (this.W = WEAPONS[o.weapon]);
    this.twoHand = o.twoHand ?? W.twoHand;
    const world = (this.world = new R.World({ x: 0, y: o.g ?? -G, z: 0 }));
    world.timestep = DT;
    world.integrationParameters.numSolverIterations = o.iters ?? 6;
    world.integrationParameters.numInternalPgsIterations = o.pgs ?? 4;
    const { P, info } = fkPose(o.pose, W, this.twoHand);
    this.pose0 = P; this.poseInfo = info;
    this.rb = {}; this.mp = {}; // 강체 · 질량 값 { m, lc(몸 기준 무게중심), Ip, qf, extra }
    const game = !!o.game;
    for (const d of PARTS) {
      const rb = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...P[d.name].p).setRotation(QO(P[d.name].q)).setLinearDamping(game ? 0.05 : 0).setAngularDamping(game ? (d.alongX ? 1.5 : 0.4) : 0).setCanSleep(false));
      const cd = shapeDesc(R, d.shape).setMass(d.mass).setCollisionGroups(NOCOL);
      if (d.alongX) cd.setRotation(QO(ALONG_X));
      world.createCollider(cd, rb);
      this.rb[d.name] = rb;
    }
    const sword = world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...P.sword.p).setRotation(QO(P.sword.q)).setAngularDamping(game ? 0.3 : 0).setCanSleep(false));
    for (const p of W.parts) world.createCollider(shapeDesc(R, p.shape).setTranslation(0, p.y, 0).setMassProperties(p.m, { x: 0, y: p.c, z: 0 }, { x: p.Ie, y: p.It, z: p.Ie }, { x: 0, y: 0, z: 0, w: 1 }).setCollisionGroups(NOCOL), sword);
    this.rb.sword = sword;
    for (const n of ALL) { const b = this.rb[n]; this.mp[n] = { m: b.mass(), lc: V(b.localCom()), Ip: V(b.principalInertia()), qf: QA(b.principalInertiaLocalFrame()) }; }
    // 덧 관성: 골반에 다리의 yaw 관성 (과제) · 게임 꼴이면 배 +0.4 · 칼 팔 비틀림 +0.004 (fighter.js:794 · 799)
    this.extra = {};
    const addI = (n, I) => { this.rb[n].setAdditionalMassProperties(0, { x: 0, y: 0, z: 0 }, O(I), { x: 0, y: 0, z: 0, w: 1 }, true); this.extra[n] = I; };
    const legsI = o.legsI ?? 0.5;
    if (legsI > 0) addI('pelvis', [0, legsI, 0]);
    if (game) { addI('abdomen', [0.4, 0.4, 0.4]); addI('uarmS', [0.004, 0, 0]); addI('farmS', [0.004, 0, 0]); }
    // 관절
    this.jt = {};
    for (const jd of JOINTS) {
      const data = jd.type === 'hinge' ? R.JointData.revolute(O(jd.a1), O(jd.a2), { x: 0, y: 0, z: 1 }) : R.JointData.spherical(O(jd.a1), O(jd.a2));
      const j = world.createImpulseJoint(data, this.rb[jd.p], this.rb[jd.c], true);
      j.setContactsEnabled(false);
      if (jd.type === 'hinge') j.setLimits(jd.lim[0], jd.lim[1]);
      else if (jd.lim) ['x', 'y', 'z'].forEach((ax, i) => j.rawSet.jointSetLimits(j.handle, 3 + i, jd.lim[ax][0], jd.lim[ax][1]));
      this.jt[jd.name] = { ...jd, joint: j, P: this.rb[jd.p], C: this.rb[jd.c] };
    }
    // 밧줄: 칼 어깨 들림 면 −45 ~ 130° · 손목 원뿔 163° · 아래팔 굴림 80° (fighter.js shoulderOn · gripConeOn)
    const L = 1, K = 10; const rl = (deg) => Math.sqrt(L * L + K * K - 2 * L * K * Math.cos(deg * DEG));
    for (const c of [40, 45]) { const n = [Math.sin(c * DEG), 0, Math.cos(c * DEG)]; world.createImpulseJoint(R.JointData.rope(Math.sqrt(L * L + K * K), { x: K * n[0], y: 0.1, z: 0.2 + K * n[2] }, { x: -0.15 + L, y: 0, z: 0 }), this.rb.chest, this.rb.uarmS, true).setContactsEnabled(false); }
    if (o.wristRopes !== false) {
      world.createImpulseJoint(R.JointData.rope(rl(163), { x: 0.13 + K, y: 0, z: 0 }, { x: 0, y: L, z: 0 }), this.rb.farmS, sword, true);
      world.createImpulseJoint(R.JointData.rope(rl(80), { x: 0.13, y: 0, z: K }, { x: 0, y: 0, z: L }), this.rb.farmS, sword, true);
    }
    // 빈손 — 칼자루: 닫힌 고리 관절 (정직한 두 손)
    this.offJoint = null;
    if (this.twoHand && o.offJoint !== false) this.offJoint = world.createImpulseJoint(R.JointData.spherical(O(HAND_O), { x: 0, y: W.gripAlong, z: 0 }), this.rb.farmO, sword, true);
    // 골반 받침: 자리 · 기울기는 잡고 yaw 만 푼다 (세계 y 축 경첩) — 다리 대신
    const fx = (this.fixBody = world.createRigidBody(o.kinematic ? R.RigidBodyDesc.kinematicVelocityBased().setTranslation(...P.pelvis.p) : R.RigidBodyDesc.fixed().setTranslation(...P.pelvis.p)));
    this.fixJoint = world.createImpulseJoint(o.fixture === 'lock' ? R.JointData.fixed({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, { x: 0, y: 0, z: 0 }, QO(qconj(P.pelvis.q))) : R.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), fx, this.rb.pelvis, true);
    if (o.fixture !== 'lock' && o.pelHard) this.fixJoint.setLimits(-o.pelHard, o.pelHard);
    this.fixP = P.pelvis.p.slice();
    this.t = 0; this.n = 0;
    this.r70 = W.hiltLength + 0.7 * W.bladeLength; this.rTip = W.hiltLength + W.bladeLength;
    this.sense();
    this.mTot = ALL.reduce((a, n) => a + this.mp[n].m, 0);
  }

  /** 모든 토막의 상태를 읽는다 */
  sense() {
    const s = {};
    for (const n of ALL) {
      const b = this.rb[n]; const p = V(b.translation()), q = QA(b.rotation()), v = V(b.linvel()), w = V(b.angvel());
      const mp = this.mp[n];
      const c = add(p, qrot(q, mp.lc));
      s[n] = { p, q, v, w, c };
    }
    this.s = s;
    // 관절 자리 (세계)
    const a = {};
    for (const jd of JOINTS) a[jd.name] = add(s[jd.p].p, qrot(s[jd.p].q, jd.a1));
    a.grip2 = add(s.sword.p, qrot(s.sword.q, [0, this.W.gripAlong, 0]));
    a.handO = add(s.farmO.p, qrot(s.farmO.q, HAND_O));
    this.a = a;
    if (this.o.kinematic) this.fixP = V(this.fixBody.translation());
    return s;
  }
  /** 토막 위 한 점(세계)의 빠르기 */
  velAt(n, pt) { const b = this.s[n]; return add(b.v, cross(b.w, sub(pt, b.c))); }
  bladeDir() { return qrot(this.s.sword.q, Y); }
  bladePt(r) { return adds(this.s.sword.p, this.bladeDir(), r); }
  Iw(n) { const m = inertiaWorld(this.s[n].q, this.mp[n].Ip, this.mp[n].qf); const e = this.extra[n]; return e ? madd(m, inertiaWorld(this.s[n].q, e, null)) : m; }
  /** 역학 에너지 · 운동량 · 받침 점 둘레 각운동량 */
  mech() {
    let ke = 0, pe = 0; let Pm = [0, 0, 0], L = [0, 0, 0], gyro = [0, 0, 0], tg = [0, 0, 0];
    for (const n of ALL) {
      const b = this.s[n], m = this.mp[n].m, I = this.Iw(n), Iw_ = mv(I, b.w);
      ke += 0.5 * m * dot(b.v, b.v) + 0.5 * dot(b.w, Iw_); pe += m * G * b.c[1];
      Pm = adds(Pm, b.v, m); const r = sub(b.c, this.fixP);
      L = add(L, add(scl(cross(r, b.v), m), Iw_)); gyro = add(gyro, cross(b.w, Iw_)); tg = add(tg, cross(r, [0, -m * G, 0]));
    }
    return { ke, pe, e: ke + pe, P: Pm, L, gyro, tg };
  }
  swordKE() { const b = this.s.sword, m = this.mp.sword.m, I = this.Iw('sword'); return 0.5 * m * dot(b.v, b.v) + 0.5 * dot(b.w, mv(I, b.w)); }
  /** 관절 j 먼 쪽 토막들의 무게가 관절 둘레에 만드는 모멘트를 버티는 토크 (자식에 거는 값) */
  gravComp(j, withSword = true) {
    const x = this.a[j]; let t = [0, 0, 0];
    for (const n of SUB[j]) { if (n === 'sword' && !withSword) continue; t = add(t, cross(sub(this.s[n].c, x), [0, this.mp[n].m * G, 0])); }
    return t;
  }
  /** 관절 j 먼 쪽을 한 덩이로 본 관절 둘레 관성 (세계 3×3) · sword: 'rigid' | 'point'(손목에 점질량) | 'none' */
  compI(j, swordMode = 'rigid') {
    const x = this.a[j]; let m = mzero();
    for (const n of SUB[j]) {
      if (n === 'sword') { if (swordMode === 'none') continue; if (swordMode === 'point') { m = madd(m, mpara(this.mp.sword.m, sub(this.a.wr, x))); continue; } }
      m = madd(madd(m, this.Iw(n)), mpara(this.mp[n].m, sub(this.s[n].c, x)));
    }
    return m;
  }
  /** 관절 j 몸 쪽(나머지 전부)을 한 덩이로 본 관성 — 받침이 기울기를 잡으므로 x · z 는 아주 크게 */
  compIprox(j) {
    const x = this.a[j]; let m = [1e4, 0, 0, 0, 0, 0, 0, 0, 1e4]; const set = new Set(SUB[j]);
    for (const n of ALL) { if (set.has(n)) continue; m = madd(madd(m, this.Iw(n)), mpara(this.mp[n].m, sub(this.s[n].c, x))); }
    return m;
  }
  /** 두 쪽 사이의 줄인 관성 (Ic⁻¹ + Ip⁻¹)⁻¹ — 명시 PD 의 안정 한계(d < 2I/dt)가 묶이는 값 */
  redI(j, swordMode = 'rigid') { const a = minv(this.compI(j, swordMode)), b = minv(this.compIprox(j)); return minv(madd(a, b)); }
  relW(j) { const J = this.jt[j]; return sub(this.s[J.c].w, this.s[J.p].w); }
  relQ(j) { const J = this.jt[j]; return qmul(qconj(this.s[J.p].q), this.s[J.c].q); }
  hingeAxis(j) { return qrot(this.s[this.jt[j].p].q, Z); }
  hingeAngle(j) { const q = this.relQ(j); return 2 * Math.atan2(q[2], q[3]); }
  yawOf(n) { const a = qrot(this.s[n].q, X); return Math.atan2(-a[2], a[0]); }

  /**
   * 한 스텝: tau = { 관절 이름: 자식에 거는 토크(세계) — 부모에는 반대 }, ext = { ground: 골반 yaw 토크(바깥), forces: [{body, f, at}] }.
   *  일(사다리꼴: 스텝 앞뒤 상대 각속도의 평균) · 에너지 · 받침 반력(운동량 변화에서)을 함께 돌려준다.
   */
  step(tau, ext = {}) {
    const R = this.R;
    for (const n of ALL) { this.rb[n].resetForces(true); this.rb[n].resetTorques(true); }
    const acc = Object.fromEntries(ALL.map((n) => [n, [0, 0, 0]]));
    const w0 = {};
    for (const j in tau) { const J = this.jt[j]; acc[J.c] = add(acc[J.c], tau[j]); acc[J.p] = sub(acc[J.p], tau[j]); w0[j] = this.relW(j); }
    const g = ext.ground || 0; if (g) acc.pelvis = add(acc.pelvis, [0, g, 0]);
    const wp0 = this.s.pelvis.w[1];
    for (const n of ALL) if (acc[n][0] || acc[n][1] || acc[n][2]) this.rb[n].addTorque(O(acc[n]), true);
    const fw0 = [];
    for (const f of ext.forces || []) { this.rb[f.body].addForceAtPoint(O(f.f), O(f.at), true); fw0.push(this.velAt(f.body, f.at)); }
    const m0 = ext.noMech ? null : this.mech();
    this.world.step(this.evq || undefined); // evq: 접촉 벤치만 (접촉 힘 사건)
    this.t += DT; this.n++;
    this.sense();
    const work = {};
    for (const j in tau) work[j] = dot(tau[j], scl(add(w0[j], this.relW(j)), 0.5)) * DT;
    work.ground = g * 0.5 * (wp0 + this.s.pelvis.w[1]) * DT;
    let wExt = 0; (ext.forces || []).forEach((f, i) => { wExt += dot(f.f, scl(add(fw0[i], this.velAt(f.body, f.at)), 0.5)) * DT; });
    work.ext = wExt;
    let out = { work };
    if (m0) {
      const m1 = this.mech();
      const fExt = (ext.forces || []).reduce((a, f) => add(a, f.f), [0, 0, 0]);
      const tExt = (ext.forces || []).reduce((a, f) => add(a, cross(sub(f.at, this.fixP), f.f)), [0, 0, 0]);
      // 받침이 준 힘 · 모멘트 = 운동량 변화 − 중력 − 건 바깥 힘 (각운동량에는 엔진에 없는 자이로 항 Σ ω × Iω 이 섞여 따로 뺀다)
      const F = sub(add(scl(sub(m1.P, m0.P), 1 / DT), [0, this.mTot * G, 0]), fExt);
      const gy = scl(add(m0.gyro, m1.gyro), 0.5);
      const M = sub(sub(sub(sub(scl(sub(m1.L, m0.L), 1 / DT), scl(add(m0.tg, m1.tg), 0.5)), [0, g, 0]), tExt), gy);
      out = { work, e0: m0.e, e1: m1.e, ke: m1.ke, pe: m1.pe, F, M, Ly: m1.L[1], gyroY: gy[1], dLy: m1.L[1] - m0.L[1] };
    }
    return out;
  }
  free() { this.world.free(); }
}

// ── 근육: 활성 1 차 지연 · 사람 한도 · Hill ──
/**
 * 관절마다 '바라는 토크'(세계 · 자식에 거는 값)를 받아: ① 등척 한도로 자름(방향 지킴) ② 활성 지연 tAct(부모 틀에서 1 차) ③ 힘–빠르기 Hill 을 곱함.
 *  가는 축(위팔 비틀기)은 따로: 손목이 낸 토크를 팔 축으로 그대로 넘기는 몫(정확히 상쇄) + 관성에 견준 한도 안의 몫.
 */
export class Muscles {
  constructor(model, o = {}) {
    this.m = model;
    const B = o.human === 'start' ? HUMAN_START : HUMAN_SRC;
    const H = (this.H = { cap: { ...B.cap, ...(o.cap || {}) }, vmax: { ...B.vmax, ...(o.vmax || {}) }, tAct: o.tAct ?? B.tAct, hillA: B.hillA, ecc: o.ecc ?? B.ecc });
    if (H.cap.wrist == null) H.cap.wrist = H.cap.wristHand * (model.twoHand ? 2 : 1); // 두 손이면 두 손목 몫
    this.str = o.strength ?? 1; // 힘 표: 모든 근육 한도에 (땅 예산에는 안 곱함)
    this.alpha = 1 - Math.exp(-DT / H.tAct);
    this.act = {}; // 관절 → 부모 틀 활성 토크 (벡터) / 스칼라
    this.sat = {}; this.n = 0; this.peak = {}; this.last = {};
    this.twistAlpha = o.twistAlpha ?? 240; // rad/s² — 가는 축에 거는 토크 한도 = 관성 × 이 값 (한 스텝 Δω ≤ 2 rad/s)
    this.hillOn = o.hill !== false; this.hillAvg = o.hillAvg === true; this.wPrev = {}; this.hillImp = o.hillImp === true; // hillAvg · hillImp: 몸통 떨림을 잡아 보려던 두 시도 — 기본 끔(둘 다 떨림을 못 없앴다 · NOTES.md '몸통 떨림')
  }
  hill(v, vmax) { return this.hillOn ? hill(v, vmax, this.H.hillA, this.H.ecc) : 1; }
  /** 등척 한도 (N·m): 몸통은 [휨, 축, 휨] · 팔꿈치는 sign > 0 굽힘 / < 0 폄 (안 주면 큰 쪽) */
  capOf(j, sign = 0) { const c = this.H.cap, s = this.str; return j === 'waist' || j === 'back' ? [c.trunkBend * s, c.trunkAxial * s, c.trunkBend * s] : j === 'neck' ? c.neck * s : j === 'shS' || j === 'shO' ? c.shoulder * s : j === 'elS' || j === 'elO' ? (sign > 0 ? c.elbowFlex : sign < 0 ? c.elbowExt : Math.max(c.elbowFlex, c.elbowExt)) * s : c.wrist * s; }
  vmaxOf(j) { const v = this.H.vmax; return j === 'waist' || j === 'back' ? v.trunk : j === 'neck' ? v.neck : j === 'shS' || j === 'shO' ? v.shoulder : j === 'elS' || j === 'elO' ? v.elbow : v.wrist; }
  /** 등척 한도로 자른 값(부모 틀) · 포화 정도(1 = 한도) */
  isoClamp(j, uL) {
    const cap = this.capOf(j);
    if (Array.isArray(cap)) { const s = Math.hypot(uL[0] / cap[0], uL[1] / cap[1], uL[2] / cap[2]); return s > 1 ? [scl(uL, 1 / s), 1] : [uL, s]; }
    const l = len(uL); return l > cap ? [scl(uL, cap / l), 1] : [uL, l / cap];
  }
  /** 처음 활성을 정적 버팀 토크로 (감은 자세가 t = 0 에 평형) */
  prime(u) { for (const j in u) { const J = this.m.jt[j]; if (J.type === 'hinge') this.act[j] = clamp(u[j], -this.capOf(j, -1), this.capOf(j, 1)); else this.act[j] = this.isoClamp(j, qrot(qconj(this.m.s[J.p].q), u[j]))[0]; } }
  /**
   * u: { 관절: 바라는 토크(세계 벡터 · 경첩은 스칼라) } · twistPass: { shS: 스칼라, shO: 스칼라 } = 팔 축으로 그대로 넘길 토크(손목 반작용 상쇄)
   * → tau: { 관절: 자식에 거는 토크(세계) }
   */
  drive(u, o = {}) {
    const m = this.m, tau = {}; this.n++;
    const note = (j, satv, mag) => { this.last[j] = satv; this.sat[j] = (this.sat[j] || 0) + (satv >= 0.98 ? 1 : 0); this.peak[j] = Math.max(this.peak[j] || 0, mag); };
    for (const j in u) {
      const J = m.jt[j]; const wNow = m.relW(j);
      // 힘–빠르기에 넣는 관절 각속도는 지금 · 앞 스텝의 평균 (2 회차 고침). 명시 Hill 은 기울기 5·τ/vmax 짜리 감쇠와 같아서, 몸통(vmax 3.6 rad/s · 활성 200 N·m 안팎)에서는
      //  d·dt/I ≈ 2.3 > 2 로 스텝마다 뒤집히는 떨림이 났다(가슴 · 배가 서로 반대로 ± 1 ~ 3 rad/s). 두 스텝 평균은 그 떨림 꼴(주기 2 스텝)의 이득을 0 으로 만든다 — 감쇠 · 관성을 더하지 않는다.
      const wRel = this.hillAvg ? scl(add(wNow, this.wPrev[j] ?? wNow), 0.5) : wNow; this.wPrev[j] = wNow;
      if (J.type === 'hinge') {
        const ax = m.hingeAxis(j), capF = this.capOf(j, 1), capE = this.capOf(j, -1);
        const uc = clamp(u[j], -capE, capF);
        const a = (this.act[j] = (this.act[j] ?? 0) + (uc - (this.act[j] ?? 0)) * this.alpha);
        const t = a * this.hill(Math.sign(a || 1) * dot(wRel, ax), this.vmaxOf(j));
        tau[j] = scl(ax, t); note(j, Math.abs(a) / (a >= 0 ? capF : capE), Math.abs(t));
        continue;
      }
      const qp = m.s[J.p].q;
      if (j === 'shS' || j === 'shO') {
        // 위팔 축 û: 휘두르는 몫(û 에 수직)과 비트는 몫을 따로
        const uh = j === 'shS' ? qrot(m.s.uarmS.q, X) : qrot(m.s.uarmO.q, [0, -1, 0]);
        const uSw = perp(u[j], uh); const [ucL, sv] = this.isoClamp(j, qrot(qconj(qp), uSw));
        const a0 = this.act[j] ?? [0, 0, 0];
        const aL = (this.act[j] = adds(a0, sub(ucL, a0), this.alpha));
        const aW = perp(qrot(qp, aL), uh); const al = len(aW);
        const wSw = perp(wRel, uh);
        let t = al > 1e-9 ? scl(aW, this.hill(dot(wSw, aW) / al, this.vmaxOf(j))) : [0, 0, 0];
        // 비틀기: 넘기는 몫(정확) + 관성 한도 안의 몫
        const pass = o.twistPass?.[j] ?? 0;
        const Ieff = dot(uh, mv(m.compI(j, 'point'), uh));
        const capTw = Math.min(this.H.cap.shoulderTwist * this.str, Ieff * this.twistAlpha);
        const want = clamp(dot(u[j], uh) - pass, -capTw, capTw);
        const k = j + 'Tw'; const at = (this.act[k] = (this.act[k] ?? 0) + (want - (this.act[k] ?? 0)) * this.alpha);
        const tw = clamp(at, -capTw, capTw) * this.hill(Math.sign(at || 1) * dot(wRel, uh), this.vmaxOf(j));
        t = adds(t, uh, tw + pass);
        tau[j] = t; note(j, sv, len(t)); this.peak[k] = Math.max(this.peak[k] || 0, Math.abs(tw + pass));
        continue;
      }
      let uu = u[j];
      const b = j === 'wr' ? m.bladeDir() : null;
      if (b) uu = perp(uu, b); // 손목 근육은 칼날 축에 수직인 몫만 (칼날 축은 관성이 아주 작다 — 아래 굴림 버팀만)
      const [ucL, sv] = this.isoClamp(j, qrot(qconj(qp), uu));
      const a0 = this.act[j] ?? [0, 0, 0];
      const aL = (this.act[j] = adds(a0, sub(ucL, a0), this.alpha));
      let aW = qrot(qp, aL); if (b) aW = perp(aW, b);
      const al = len(aW);
      let hf = al > 1e-9 ? this.hill(dot(wRel, aW) / al, this.vmaxOf(j)) : 0;
      if (this.hillImp && al > 1e-9 && (j === 'waist' || j === 'back' || j === 'neck')) {
        // 힘–빠르기를 한 스텝 암시로 (2 회차 고침): τ = a·h(v + τ·dt/I) 를 한 번 펴서 τ = a·h(v) / (1 − a·h′(v)·dt/I). 곡선은 그대로이고 적분만 암시 —
        //  명시로 두면 몸통(vmax 3.6 rad/s · 활성 100 ~ 250 N·m)에서 기울기 a·|h′| 가 d·dt/I > 2 인 명시 감쇠가 되어 가슴 · 배가 스텝마다 뒤집히며 떨었다(± 1 ~ 3 rad/s · 힘–빠르기를 끄면 사라짐).
        const uu = scl(aW, 1 / al); const v = dot(wRel, uu); const vm = this.vmaxOf(j), eps = 0.01 * vm;
        const dh = (this.hill(v + eps, vm) - this.hill(v - eps, vm)) / (2 * eps);
        const Iinv = dot(uu, mv(madd(minv(m.compI(j)), minv(m.compIprox(j))), uu));
        hf /= 1 - Math.min(0, al * dh) * DT * Iinv;
      }
      let t = al > 1e-9 ? scl(aW, hf) : [0, 0, 0];
      if (o.add?.[j]) t = add(t, o.add[j]);
      tau[j] = t; note(j, sv, len(t));
    }
    return tau;
  }
}

/** 관성에 맞춘 버팀 PD (세계 벡터): τ = I_red · (ωn²·e − 2·ζ·ωn·ω_rel) — 축마다 d·dt/I = 2ζ·ωn·dt 라 가는 축에서도 안정 */
export function holdPD(model, j, qRelTarget, wn = 30, zeta = 1, swordMode = 'rigid') {
  const J = model.jt[j]; const qp = model.s[J.p].q, qc = model.s[J.c].q;
  const e = rotvec(qmul(qmul(qp, qRelTarget), qconj(qc)));
  const I = model.redI(j, swordMode);
  return mv(I, sub(scl(e, wn * wn), scl(model.relW(j), 2 * zeta * wn)));
}
export function holdPDhinge(model, j, flexTarget, wn = 30, zeta = 1, swordMode = 'rigid') {
  const ax = model.hingeAxis(j); const I = dot(ax, mv(model.redI(j, swordMode), ax));
  return I * (wn * wn * (flexTarget - model.hingeAngle(j)) - 2 * zeta * wn * dot(model.relW(j), ax));
}
export const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : '–');
