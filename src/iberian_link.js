// ─────────────────────────────────────────────────────────────
//  이베리아 B7 '이어 돌리기' (11/14 사장님 '이베리아 이어 돌리기로 진행해.' — config IB_LINK · 기록 docs/strike/ib_link_2026-11-14.md)
//   사장님 11/14: "아니면 이베리아의 큰 공격들을 부드럽게 연환해주는 사이동작 같은 거 없을꺼? 새 공격 기술이라기보다눈 기존 공격을 연격처럼 부드럽게 해주는."
//   새 공격이 아니라 사이동작: 앞 긋기가 끝나고 이어짐 창 안에 다음 큰 칼(내려 · 가로 베기)을 그었는데 손이 그 칼의 시작 자리에 없으면, 칼이 지금 자리에서 머리 위로 원을 그리며
//   그 칼의 시작 자리로 넘어간다(이 파일 — 칼 길) · 그은 긋기는 거기서 그대로 나간다(unique_assist.js linkTick — 손가락 몫을 받아 두었다 다시 그음 · AI 는 ai.js linkTick).
//  원전 (기록 §1): 피게이레두 복Ⅱ 「passandoo por sima da cabeça se dará hũ talho cingido e hũ revez」 · 복ⅩⅥ 「levantando o montante por sima da cabeça para vir a cingir pello lado dereyto」 ·
//   고디뉴 규칙 4 「Der Tajo schneidet und läuft durch bis er über deinem Kopf dreht, und das Montante verbleibt aufgezogen zu einem Reves」 · 규칙 5 주 '돌리지 않으면 두 박자'.
//
//  몸놀림만 대본 (물리 원칙의 예외 — 풍차 감기 iberian_redondo.js windStep 과 같은 놓기): 두 팔 · 칼을 물리 스텝마다 길 위 자리에 놓는다(secret_instant.js placeArmsAt —
//   팔 IK · 굴림 묶음 · 손목 교정 · 빠르기 = 가슴 · 덧씌우기 칸도 같은 자세 · 몸 비틀기 0 — 몸은 상대를 본 채 걸음 그대로). 칼 · 팔은 동역학 몸 그대로 · 충돌을 끄지 않음.
//  길 (몸 틀 — 지금 몸 방향 f.yaw · 가슴 원점 · x 앞 · y 위 · z 칼 든 쪽 m — windPose 와 같은 틀):
//   지금 손 · 칼날 → ① 들기: 두 손 이마 앞 위(풍차 감기 고리 UNIQUE_ASSIST.rdLoop.hand) · 칼은 곧게 선 축에서 rdLoop.cone ° 기운 채 지금 칼의 가로 쪽으로 →
//   ② 머리 위 원: 기운 쪽 가로 각 ψ 를 지금 칼 쪽에서 다음 칼 시작 자세의 가로 쪽까지 — 앞(ψ 0)을 지나지 않고 옆 · 뒤로 돎(칼끝이 머리 뒤로 원을 그림) →
//   ③ 내림: 다음 칼 시작 패드의 자세(fighter.padPose — 손가락이 그 패드에 있을 때 서보가 가는 자세 그대로).
//   빠르기: 원을 부른 때의 칼끝 빠르기에서 서지 않고 곧게 올라 IB_LINK.time 초에 다 돎(linkSpeed) · 도는 쪽 = 앞 칼이 가던 쪽(linkPlan sigma — 앞 칼의 기세를 이어 돎).
//  11/15 넘기기 판 (IB_LINK.mode 'bridge' — 기본 · 사장님 11/15 "억지로 원을 만들려다보니까 이상한 걸 수도 있어. '원'을 공격과 다음 공격을 잇기 위한 브릿지로서의
//   메타포로 이해해 … 최소의 동작이 돼야해. 이때 '원'이란 관성 중력 등의 힘을 다루기 위한 방편이지 품새가 아냐." — 기록 §12):
//   머리 위 원 대본(운동학 놓기)을 그만두고, 손 목표(패드)를 앞 칼이 남긴 빠르기(관성)에서 다음 칼의 첫 방향 · 빠르기까지 이어지는 가장 짧고 매끄러운 길
//   (3 차 에르미트 — bridgePlan)로 옮긴다. 팔 · 칼은 보통 칼처럼 서보 · 물리가 몬다(놓기 없음 — 튐 · 손목 교정 뒤집힘 없음 · 몸은 칼을 따라 그대로).
//   길이 끝나는 스텝에 받아 둔 손가락 긋기가 같은 빠르기 · 방향으로 이어서 나간다(멈춤 없음). 'circle' = 11/14 머리 위 원 판(견줌 — `?ibLinkMode=circle`).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { IB_LINK, UNIQUE_ASSIST as UA, WEAPON } from './config.js';
import { placeArmsAt, armRopes } from './secret_instant.js';
import { windRopesBack, windContact } from './iberian_redondo.js';
import { TECH } from './ai_techniques.js';
import { classifyStroke } from './attack_stroke.js';

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;
const hyp = Math.hypot;
const sideOf = (f) => (f.side >= 0 ? 1 : -1);
const BODY0 = Object.freeze({ pelvisYaw: 0, chestYaw: 0, pitch: 0, drop: 0 });
function angDeg(a, b) {
  const na = hyp(a[0], a[1]);
  const nb = hyp(b[0], b[1]);
  if (na < 1e-9 || nb < 1e-9) return 180;
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (na * nb)))) / D2R;
}

/** 잇는 큰 칼: 베기이고 시작 자리가 가슴 높이 이상(내려 베기 셋 · 가로 베기 둘 — 올려 베기 · 찌르기는 아래서 그대로 흐름) */
export const LINK_TECH = Object.freeze(TECH.filter((t) => t.kind === 'cut' && t.from[1] > 0));
const CUT_TECH = Object.freeze(TECH.filter((t) => t.kind === 'cut'));
const firstDir = (t) => [t.path[0][0] - t.from[0], t.path[0][1] - t.from[1]];

/**
 * 이 긋기에 이어 돌리기가 드나 (사람 unique_assist.js · 재는 도구): 시작 자리 start(패드) · 처음 방향 dir →
 *  여기서 그대로 그어지는 기본 동작이면(classifyStroke — 시작 패드 + 첫 방향) null(돌릴 것 없음 — 올려 베기 · 이미 시작 자리에 손을 둔 칼) ·
 *  아니면 첫 방향이 허용 각(UNIQUE_ASSIST.angle) 안인 큰 칼 가운데 가장 가까운 것 — 그 시작 자리가 지금 자리에서 패드 반지름(padRadius) 넘게 떨어졌을 때만. 없으면 null
 */
export function linkNeed(start, dir) {
  let best = null;
  let ba = UA.angle;
  for (const t of LINK_TECH) {
    const a = angDeg(dir, firstDir(t));
    if (a <= ba) (ba = a), (best = t);
  }
  if (!best) return null;
  // 11/15 (사장님 "내가 실제로 조작한 다음칼이 나가지도 않았어" — 기록 §12): 그은 방향에 가장 가까운 베기가 큰 칼이 아니면(올려 베기 ↖ · ↗) 원을 부르지 않음 —
  //  전엔 올려 베기 ↖ 가 가로베기 ← 의 허용 각 끝에 걸려 가로베기로 넘어감
  for (const t of CUT_TECH) if (!LINK_TECH.includes(t) && angDeg(dir, firstDir(t)) < ba) return null;
  // 여기서 그대로 그어지는 기본 동작(시작 패드 + 첫 방향)이 그은 방향에 큰 칼만큼 맞으면 그 칼 — 전엔 맞기만 하면(허용 각 안) 늘 그 칼이라 아래 왼 자리에서 → 가 올려 베기(43°)로 읽힘(가로베기 0°)
  const c = classifyStroke(start, dir);
  if (c.tech) {
    const ct = CUT_TECH.find((x) => x.name === c.tech) ?? TECH.find((x) => x.name === c.tech);
    if (!ct || angDeg(dir, firstDir(ct)) <= ba) return null;
  }
  if (hyp(start[0] - best.from[0], start[1] - best.from[1]) <= UA.padRadius) return null;
  return best;
}

/** 칼날 D(몸 틀)의 가로 각 ψ (0 앞 · + 칼 든 쪽) — 거의 곧게 선 칼이면 손 H 의 옆 자리로 */
function psiOf(f, D, H) {
  const s = sideOf(f);
  const h = hyp(D.x, D.z);
  if (h > 0.2) return Math.atan2(s * D.z, D.x);
  return s * H.z >= 0 ? Math.PI / 2 : -Math.PI / 2;
}
/** 머리 위 원 자리 (풍차 감기 원뿔 고리와 같은 꼴 — iberian_redondo.js windPose 'spin'): 두 손 이마 앞 위 · 칼은 곧게 선 축에서 cone ° 기운 채 가로 각 psi 쪽 */
//  두 손은 칼이 기운 옆쪽으로 IB_LINK.handR 만큼 따라감(sin ψ) — 손이 이마 앞 가운데에 머물면 칼이 칼 든 쪽 앞으로 기울 때 손목이 사람 범위를 넘어(교정 최대 70°) 칼끝이 한 스텝에 1 m 넘게 뜀(플랑베르주 — 기록 §2)
function overPose(f, psi, L) {
  const s = sideOf(f);
  const b = L.cone * D2R;
  return { H: new THREE.Vector3(L.hand[0], L.hand[1], s * (L.hand[2] + IB_LINK.handR * Math.sin(psi))), D: new THREE.Vector3(Math.sin(b) * Math.cos(psi), Math.cos(b), s * Math.sin(b) * Math.sin(psi)) };
}
/** 두 자세 사이 u 자리 (손 곧게 · 칼날 slerp — secret_instant.js comboLerp 와 같음) */
function lerpPose(A, B, u, oH = new THREE.Vector3(), oD = new THREE.Vector3()) {
  const q = new THREE.Quaternion().setFromUnitVectors(A.D, B.D);
  oD.copy(A.D).applyQuaternion(new THREE.Quaternion().slerp(q, u)).normalize();
  oH.copy(A.H).lerp(B.H, u);
  return { H: oH, D: oD };
}
const tipOf = (f, P, out = new THREE.Vector3()) => out.copy(P.H).addScaledVector(P.D, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength);

const wrapPos = (x) => ((x % TAU) + TAU) % TAU;
/**
 * 길 짜기 (몸 틀 자세 줄): A 지금 → 들기 → 머리 위 원 → B 다음 칼 시작 자세. 돌려줌 { pts, len(토막마다 칼끝 길이), total, dpsi(머리 위에서 돈 각 rad) }
 *  도는 쪽 sigma (+1 = 가로 각이 칼 든 쪽으로 · −1 = 반대 · 0 = 짧은 쪽): 앞 칼이 가던 쪽 그대로 — 고디뉴 규칙 4 '베고 지나가 머리 위에서 돈다'(앞 칼의 기세를 이어 돎).
 *  그래서 탈류(오른 위 → 왼 아래) 뒤 레베스(왼 위에서)는 왼쪽으로 들어 짧게 · 탈류 뒤 탈류는 왼쪽 → 머리 뒤 → 오른쪽으로 한 바퀴 (몬탄테 돌려 베기)
 */
export function linkPlan(f, A, B, sigma = 0, L = UA.rdLoop) {
  const a = psiOf(f, A.D, A.H);
  const b = psiOf(f, B.D, B.H);
  const near = Math.atan2(Math.sin(b - a), Math.cos(b - a)); // 짧은 쪽
  let d = sigma > 0 ? wrapPos(b - a) : sigma < 0 ? -wrapPos(a - b) : near;
  if (Math.abs(near) <= Math.PI / 4) d = near; // 45° 안이면 짧은 쪽 (칼이 이미 다음 칼 쪽에 와 있음 — 앞 칼이 조금 더 지나갔어도 한 바퀴 돌지 않음)
  const n = Math.max(1, Math.ceil(Math.abs(d) / (Math.PI / 4)));
  const pts = [A];
  for (let k = 1; k <= n; k++) pts.push(overPose(f, a + (d * k) / n, L)); // 들기는 곧장 도는 쪽 첫 자리로 (앞 칼의 기세를 이음)
  pts.push(B);
  const len = [];
  const _t0 = new THREE.Vector3();
  const _t1 = new THREE.Vector3();
  for (let i = 0; i + 1 < pts.length; i++) {
    let s = 0;
    tipOf(f, pts[i], _t0);
    for (let j = 1; j <= 8; j++) {
      tipOf(f, lerpPose(pts[i], pts[i + 1], j / 8), _t1);
      s += _t1.distanceTo(_t0);
      _t0.copy(_t1);
    }
    len.push(Math.max(1e-4, s));
  }
  return { pts, len, total: len.reduce((x, y) => x + y, 0), dpsi: d };
}

/** 지금 손 · 칼날 (몸 틀 — 가슴 원점 · 칼 원점 = 손) */
export function linkNow(f) {
  const inv = f.yaw.clone().invert();
  const c = f.bodies.chest.translation();
  const sw = f.sword.translation();
  const H = new THREE.Vector3(sw.x - c.x, sw.y - c.y, sw.z - c.z).applyQuaternion(inv);
  const D = f.bladePoint(1, new THREE.Vector3()).sub(f.bladePoint(0, new THREE.Vector3())).normalize().applyQuaternion(inv);
  return { H, D };
}

/**
 * 원 빠르기 (칼끝 m/s): 지금 칼끝 빠르기 v0 에서 서지 않고 이어 — 평균 len ÷ T 보다 느리면 v0 → v1 = 2 × 평균 − v0 로 곧게 올라 T 초에 다 돎 ·
 *  더 빠르면 v0 그대로(T 보다 짧게). 돌려줌 { T, v0, v1 } — 진행 = linkProgress
 */
export function linkSpeed(len, T, v0) {
  const avg = len / Math.max(1e-3, T);
  const w = Math.max(0, v0);
  if (w <= avg) return { T, v0: w, v1: 2 * avg - w };
  return { T: len / w, v0: w, v1: w };
}
/** 원 진행 몫 (0 ~ 1): 빠르기가 v0 → v1 로 곧게 바뀌는 길 (linkSpeed) · t 게임 초 */
export function linkProgress(t, S) {
  if (t <= 0) return 0;
  if (t >= S.T) return 1;
  const len = ((S.v0 + S.v1) / 2) * S.T;
  return (S.v0 * t + ((S.v1 - S.v0) * t * t) / (2 * S.T)) / Math.max(1e-6, len);
}

/** 넘기기 판인가 (11/15 — IB_LINK.mode 'bridge' 기본) */
export const bridgeMode = () => IB_LINK.mode !== 'circle';
/** 칼의 첫 방향 (패드 · 단위) */
export function techDir(t) {
  const d = firstDir(t);
  const n = hyp(d[0], d[1]) || 1;
  return [d[0] / n, d[1] / n];
}
const bez = (P, u) => {
  const a = 1 - u;
  return [a * a * a * P[0][0] + 3 * a * a * u * P[1][0] + 3 * a * u * u * P[2][0] + u * u * u * P[3][0], a * a * a * P[0][1] + 3 * a * a * u * P[1][1] + 3 * a * u * u * P[2][1] + u * u * u * P[3][1]];
};
const clampPad = (p) => {
  const R = WEAPON.reach;
  const n = hyp(p[0], p[1]);
  return n > R ? [(p[0] * R) / n, (p[1] * R) / n] : p;
};
/**
 * 넘기기 길 (11/15 — 패드 · 게임 초): 손 목표 p0(지금) · v0(지금 손 목표 빠르기 = 앞 칼이 남긴 관성, 패드/게임 s) → p3(다음 칼 시작 자리) · v3(다음 칼 첫 빠르기 = 받아 둔 손가락 그대로).
 *  3 차 에르미트(처음 · 끝 빠르기가 그대로 이어짐) — 길이 패드 반지름(WEAPON.reach) 밖으로 나가는 몫은 손 목표 자름(skill.js)과 같이 반지름 위로(칼이 몸 옆 · 머리 위를 지나는 것은 그 결과).
 *  시간 T = 길이 ÷ 처음 · 끝 빠르기 가운데 큰 쪽(가장 짧게 — 남은 빠르기 · 다음 칼 빠르기보다 늦추지 않음) · 위 · 아래 한도 [IB_LINK.bridgeMin, IB_LINK.time](새 수 없음 — 시간 사다리 0.2 · 0.4) · 세 번 고쳐 셈.
 *  돌려줌 { P(제어점 넷), T, len, v0, v3 }
 */
export function bridgePlan(p0, v0, p3, v3) {
  const s0 = hyp(v0[0], v0[1]);
  const s3 = hyp(v3[0], v3[1]);
  const vb = Math.max(0.5, s0, s3); // 남은 빠르기와 다음 칼 빠르기 가운데 큰 쪽 (늦추지 않음)
  let T = Math.max(IB_LINK.bridgeMin, Math.min(IB_LINK.time, hyp(p3[0] - p0[0], p3[1] - p0[1]) / vb));
  let P = null;
  let len = 0;
  for (let it = 0; it < 3; it++) {
    P = [p0, [p0[0] + (v0[0] * T) / 3, p0[1] + (v0[1] * T) / 3], [p3[0] - (v3[0] * T) / 3, p3[1] - (v3[1] * T) / 3], p3];
    len = 0;
    let q = clampPad(p0);
    for (let j = 1; j <= 16; j++) {
      const r = clampPad(bez(P, j / 16));
      len += hyp(r[0] - q[0], r[1] - q[1]);
      q = r;
    }
    T = Math.max(IB_LINK.bridgeMin, Math.min(IB_LINK.time, len / vb));
  }
  P = [p0, [p0[0] + (v0[0] * T) / 3, p0[1] + (v0[1] * T) / 3], [p3[0] - (v3[0] * T) / 3, p3[1] - (v3[1] * T) / 3], p3];
  return { P, T, len, v0: s0, v3: s3 };
}
/** 실제 칼날이 패드 자리 pad 의 자세(fighter.padPose — 손가락이 거기 있을 때 서보가 가는 칼날)에서 벗어난 각 ° (11/15 넘기기 문 — 칼이 정말 그 자리에 왔나: 무거운 칼은 손 목표보다 늦음) */
export function bladeOff(f, pad) {
  const A = linkNow(f);
  const H = new THREE.Vector3();
  const D = new THREE.Vector3();
  f.padPose(pad[0], pad[1], H, D);
  return Math.acos(Math.max(-1, Math.min(1, A.D.dot(D)))) / D2R;
}
/** 넘기기 길의 t 게임 초 자리 (패드 — 자르지 않은 값: 손 목표 자름은 skill.js) */
export const bridgeAt = (B, t) => bez(B.P, Math.min(1, Math.max(0, t / B.T)));

/**
 * 이어 돌리기 시작: to = 다음 칼 시작 패드 [x, y] · T = 원 시간(게임 초). f.ibLink 를 돌려줌 (이미 돌리는 중이면 null).
 *  풍차 감기 휘청 고침 ①(UNIQUE_ASSIST.rdSteady)과 같이 도는 동안 손목 원뿔 · 칼 어깨 면 밧줄을 뗀다(끝나면 linkEnd 가 다시 검)
 */
export function linkStart(f, to, { T = IB_LINK.time, tech = null, sigma = 0, bridge = null } = {}) {
  if (f.ibLink || !f.sword || !f.armed) return null;
  if (bridge) {
    // 넘기기 판 (11/15): 놓기 없음 — 손 목표만 길로(부른 쪽이 스텝마다 bridgeStep) · 밧줄 · 덧씌우기 그대로
    f.ibLink = { t: 0, T: bridge.T, bridge, to: [to[0], to[1]], tech, wounds0: f.wounds?.length ?? 0, touch: 0, x: 0 };
    f.ibTradeOpen = { t0: f.ibFlowT ?? 0 }; // 맞바꿈 창 (11/15 사장님 '공격 사이의 n초, 이런 식으로 고정해' — 넘김을 시작한 때부터 IB_LINK.tradeT · fighter.js ibTradeTry)
    return f.ibLink;
  }
  const A = linkNow(f);
  const B = { H: new THREE.Vector3(), D: new THREE.Vector3() };
  f.padPose(to[0], to[1], B.H, B.D);
  // 도는 쪽: 부른 쪽이 준 앞 칼 쪽(sigma) · 없으면 지금 칼끝이 몸 옆으로 가는 쪽(가슴에 대해 · 1 m/s 넘을 때) · 그도 없으면 짧은 쪽
  const tipV = tipVelBody(f);
  const sg = sigma || (Math.abs(tipV.lat) > 1 ? Math.sign(tipV.lat) : 0);
  const plan = linkPlan(f, A, B, sg);
  const speed = linkSpeed(plan.total, T, tipV.sp); // 지금 칼끝 빠르기에서 서지 않고
  const I = { yaw: f.yaw.clone(), mord: null, kind: 'wind', moves: null, mi: 0, off: !!(f.weaponCfg.twoHand && f.bodies.uarmO && f.limbs?.armO > 0.3), body: BODY0, wristMargin: UA.rdWristMargin ?? 0 };
  f.ibLink = { t: 0, T: speed.T, speed, to: [to[0], to[1]], tech, plan, sigma: sg, I, H: A.H.clone(), D: A.D.clone(), wounds0: f.wounds?.length ?? 0, touch: 0, ropes: null, x: 0 };
  f.ibTradeOpen = { t0: f.ibFlowT ?? 0 };
  if (UA.rdSteady > 0) {
    f.ibLink.ropes = { grip: !!f.gripCone, shoulder: !!f.shoulderRopes };
    armRopes(f, false);
  }
  return f.ibLink;
}

const _H = new THREE.Vector3();
const _D = new THREE.Vector3();
const _e = new THREE.Vector3();
/**
 * 한 물리 스텝 (사람 unique_assist.js linkTick · AI skill.js — 물리 스텝 앞): 원 진행을 dt 만큼 · 그 자리에 두 팔 · 칼을 놓는다.
 *  돌려줌 = 지난 스텝 칼이 닿은 것('body' · 'blade' · 'other' — 재기만 · 닿아도 그대로) 또는 null. 다 돌았으면 f.ibLink.done = true (놓기는 이 스텝까지 — 끝은 부른 쪽이 linkEnd)
 */
export function linkStep(f, dt) {
  const K = f.ibLink;
  if (!K || K.bridge) return null; // 넘기기 판은 놓지 않음 (bridgeStep)
  const hit = windContact(f);
  if (hit) K.touch++;
  K.t += dt;
  const x = Math.min(1, K.t / K.T);
  K.x = x;
  const P = K.plan;
  let s = linkProgress(K.t, K.speed) * P.total;
  let i = 0;
  while (i < P.len.length - 1 && s > P.len[i]) s -= P.len[i++];
  const u = Math.min(1, s / P.len[i]);
  const { H, D } = lerpPose(P.pts[i], P.pts[i + 1], u, _H, _D);
  // 날: 풍차 감기 windEdge 와 같은 꼴(가로 각이 느는 쪽 · rdEdge −1 이면 반대 날) — 도는 쪽과 상관없이 같은 면 (몬탄테는 양날 · 반대 면은 오른쪽 앞에서 손목이 사람 범위를 20° 넘음 — 기록 §2)
  const psi = psiOf(f, D, H);
  _e.set(-Math.sin(psi), 0, sideOf(f) * Math.cos(psi)).multiplyScalar(UA.rdEdge < 0 ? -1 : 1);
  K.H.copy(H);
  K.D.copy(D);
  K.I.yaw.copy(f.yaw); // 몸 틀 = 지금 몸 방향 (걷고 돌아도 머리 위 그대로)
  placeArmsAt(f, K.I, H, D, _e.applyQuaternion(f.yaw));
  if (x >= 1) K.done = true;
  return hit;
}

/**
 * 넘기기 한 물리 스텝 (11/15 — 사람 unique_assist.js linkTick · AI ai.js linkTick): 시간을 dt 만큼 · 이 스텝 손 목표 자리(패드)를 돌려줌 · 다 왔으면 K.done.
 *  칼 · 팔은 서보가 그 손 목표를 따라감(놓지 않음). 지난 스텝 칼이 닿은 것은 재기만(windContact)
 */
export function bridgeStep(f, dt) {
  const K = f.ibLink;
  if (!K?.bridge) return null;
  if (windContact(f)) K.touch++;
  K.t += dt;
  K.x = Math.min(1, K.t / K.T);
  if (K.t >= K.T - 1e-9) K.done = true;
  return bridgeAt(K.bridge, K.t);
}

/** 이어 돌리기 끝 (다 돌았든 그만두든): 대본 놓기를 멈춤 · 덧씌우기 칸을 곧장 내려놓음(다음 칼은 손가락 · 서보가) · 뗀 밧줄을 다시 (칼을 잃었으면 손목 원뿔은 안 검) */
export function linkEnd(f) {
  const K = f.ibLink;
  if (!K) return null;
  f.ibLink = null;
  if (K.bridge) return K; // 넘기기 판: 놓은 것 · 뗀 밧줄 없음
  const th = f.skill?.thrustPose;
  if (th) th.w = 0;
  windRopesBack(f, K.ropes);
  f.tipPrev = f.bladePoint(1, new THREE.Vector3());
  f.hitPointPrev = f.bladePoint(0.7, new THREE.Vector3());
  return K;
}

/** 칼끝이 가슴에 대해 가는 빠르기 (m/s) · 그 몸 옆 몫 lat (+ = 칼 든 쪽 — 몸 틀) */
function tipVelBody(f) {
  const tip = f.bladePoint(1, new THREE.Vector3());
  const v = f.sword.velocityAtPoint({ x: tip.x, y: tip.y, z: tip.z });
  const c = f.bodies.chest.linvel();
  const r = new THREE.Vector3(v.x - c.x, v.y - c.y, v.z - c.z);
  const sp = r.length();
  r.applyQuaternion(f.yaw.clone().invert());
  return { sp, lat: sideOf(f) * r.z };
}
/** 칼끝이 지금 가는 빠르기 (m/s — 재기 · 그림) */
export function tipSpeed(f) {
  const tip = f.bladePoint(1, new THREE.Vector3());
  const v = f.sword.velocityAtPoint({ x: tip.x, y: tip.y, z: tip.z });
  return hyp(v.x, v.y, v.z);
}

