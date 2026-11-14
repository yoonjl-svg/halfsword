// ─────────────────────────────────────────────────────────────
//  帯刀 — 발도 대기 칼 자리 원전대로 · 무기를 따르는 빈 칼집 (사장님 11/14 결정 "권고대로 둘 다 진행해. 근대 칼집이 떠보이거나 시각적으로 물리적 오류를 일으킬까보ㅏ 걱정이야."
//   — 기록 docs/strike/iai_obi_2026-11-14.md · 확인표 3870 ~)
//  원전: 전일본검도연맹 거합 「指導上の留意点」 2025 作法 3② 帯刀 「右手で鍔がへそ前に来るように刀を帯びる」(코등이가 배꼽 앞) ·
//   解説 1본 「刃を上にしたまま、鞘引きとともに刀を抜き出し」(날은 위 · 칼집을 당기며 뽑음) · 「鯉口をへそ前に戻しながら」(鞘戻し — 칼집 입을 배꼽 앞으로)
//  ① 대기 칼 자리 (SECRET.iaiObi): 발도 대기(사람 허리 대기 · AI 웅크린 대기) 동안 칼은 허리띠에 찬 칼집 안 — 칼날 시작(칼 축 hiltLength · 칼집 입)이
//   골반 몸체 틀 SECRET.iaiObiMouth · 칼 축(칼끝 쪽)이 SECRET.iaiObiAxis. 골반을 따름(칼집은 허리띠에 참) — 덧씌우기 칸(thrustPose)의 칼 손 · 칼날을 스텝마다 이 자리에서 셈 ·
//   뽑는 길의 시작 자리(B)도 이 자리 (secret_instant.js startIai). 鞘戻し 점(fighter.js sayaMouthW)도 이 자리의 칼집 입 쥠(칼집 입 + iaiSayaKoi).
//  ② 빈 칼집 (SECRET.iaiObiSaya — 그림만: 물리 몸 · 판정 · 난수 없음): 일본 칼 넷을 쥔 몸의 골반 그림에 칼집 하나 —
//   쉴 때 = 칼집 입은 대기 칼 자리 그대로 · 축은 SECRET.iaiObiSayaAxis(왼 앞 허리 모서리에 닿게 — 사람 팔 · 손목이 대기 칼을 몸 가까이 이 각까지 못 들여
//   대기 칼 축 iaiObiAxis 보다 뒤로 13°) · 대기(대기 몫 iaiObiW) 동안은 칼을 감싸 지금 칼 자리를 따름(칼이 칼집 안으로 보이게 · 비킴 한도 iaiObiFollow 안 — 왼손이 칼집 입을 쥐고 받음) ·
//   鞘引き(왼손이 칼집 입을 쥔 채 왼 허리로)는 왼손을 따라 SECRET.iaiObiPull 축으로 · 鞘戻し 로 제자리 ·
//   어느 자리든 골반 · 배 · 가슴 그림 상자(기본 겉모습 + 겉 여유 SECRET.iaiObiSkin) · 허벅지 캡슐(그 인물 옷 그림의 윗반 굵기)에 든 몫만큼 바깥으로 밀어냄(몸 · 옷을 뚫지 않게 — 그림만).
//   꼴은 칼날 그림을 재서 짓는다(칼날이 칼집 안에 들어가게 — 휨 · 폭 · 두께를 따름). 광기의 다라이시 · 다라이시(자기 빈 검집 — outfit_silver_wanderer.js)와
//   김씨(허리에 찬 칼 — outfit_renji.js)는 자기 것을 쓰고 이 칼집을 달지 않음.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET } from './config.js';
import { DARAISHI_SCABBARD, placeDaraishiScabbard } from './outfit_silver_wanderer.js'; // 다라이시 빈 검집 자리 (11/14 — daraishiSaya)

const D2R = Math.PI / 180;
/** 帯刀 칼집을 다는 무기 (일본 유파 칼 넷 — weapons.js school 'japanese') */
export const OBI_IDS = Object.freeze(['uchigatana', 'muramasa', 'kusanagi', 'monohoshizao']);
/** 이 몸이 帯刀 대기 칼 자리 · 칼집을 쓰나 (스위치 SECRET.iaiObi · 일본 칼 넷) */
export function obiOn(f) {
  return !!SECRET.iaiObi && !!SECRET.iaiObiMouth && OBI_IDS.includes(f.weapon?.id);
}

const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _d = new THREE.Vector3();
const _c = new THREE.Vector3();
/** 골반 틀 [앞, 위, 빈손 쪽 바깥] → 몸체 좌표 (z = 칼 든 쪽 +) */
export function obiPt(g, side, out = new THREE.Vector3()) {
  return out.set(g[0], g[1], -side * g[2]);
}
/** 축 (칼끝 쪽) — yaw ° 앞 0 → 칼 든 쪽 + · el ° 위 + (secret_instant.js dirOf 와 같은 셈 · 몸체 좌표) */
export function obiDir(A, side, out = new THREE.Vector3()) {
  const a = A.yaw * D2R;
  const e = A.el * D2R;
  return out.set(Math.cos(e) * Math.cos(a), Math.sin(e), side * Math.cos(e) * Math.sin(a));
}
/** ① 대기 칼 자리 (골반 몸체 틀 — 칼 목표): 칼집 입 M(칼날 시작) · 칼 축 D (칼끝 쪽) */
export function obiReady(f, M = new THREE.Vector3(), D = new THREE.Vector3()) {
  obiPt(SECRET.iaiObiMouth, f.side, M);
  obiDir(SECRET.iaiObiAxis, f.side, D);
  return { M, D };
}
/** ② 쉬는 칼집 (골반 몸체 틀): 칼집 입 = SECRET.iaiObiSayaMouth (11/14 '각도가 벌어진 거 같은데' → 배 왼쪽 앞 · 없으면 대기 칼 자리의 칼집 입) · 축 = SECRET.iaiObiSayaAxis (없으면 대기 칼 축) */
export function obiRest(f, M = new THREE.Vector3(), D = new THREE.Vector3()) {
  obiPt(SECRET.iaiObiSayaMouth ?? SECRET.iaiObiMouth, f.side, M);
  obiDir(SECRET.iaiObiSayaAxis ?? SECRET.iaiObiAxis, f.side, D);
  return { M, D };
}
/** 鞘引き 끝 (골반 몸체 틀): 왼손이 왼 허리 칼집 손 자리(SECRET.iaiSayaHip)에서 칼집 입 + iaiSayaKoi 를 쥠 → 칼집 입 M · 축 D */
export function obiPulled(f, M = new THREE.Vector3(), D = new THREE.Vector3()) {
  obiDir(SECRET.iaiObiPull, f.side, D);
  obiPt(SECRET.iaiSayaHip, f.side, M).addScaledVector(D, -(SECRET.iaiSayaKoi ?? 0.05));
  return { M, D };
}
/** 쉬는 칼집 입 쥠 (골반 몸체 틀 — 칼집 입 + 축 × iaiSayaKoi): 鞘戻し 점 (왼손이 칼집 입을 배꼽 앞 제자리로 돌려 놓는 자리) */
export function obiGrip(f, out = new THREE.Vector3()) {
  const { M, D } = obiRest(f, out, _d);
  return M.addScaledVector(D, SECRET.iaiSayaKoi ?? 0.05);
}
/** 골반 몸체 틀 점 → 월드 */
export function pelvisToWorld(f, v) {
  const r = f.bodies.pelvis.rotation();
  const t = f.bodies.pelvis.translation();
  return v.applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_p.set(t.x, t.y, t.z));
}

/**
 * ① 대기 칼 자리를 덧씌우기 칸 꼴로 (thrustPose hand = 칼 원점(손) · dir = 칼날 — 가슴 원점 · 몸 헤딩 틀 f.yaw): 칼집 입 M(월드) − 축 × hiltLength = 칼 원점.
 *  hand · dir 배열에 넣음 (iaiReadyPose · iaiReadyPosePlayer · startIai 뽑는 자리)
 */
export function obiReadyInto(f, hand, dir) {
  const r = f.bodies.pelvis.rotation();
  const t = f.bodies.pelvis.translation();
  const qp = _q.set(r.x, r.y, r.z, r.w);
  const { M, D } = obiReady(f, _a, _d);
  M.applyQuaternion(qp).add(_p.set(t.x, t.y, t.z));
  D.applyQuaternion(qp);
  const c = f.bodies.chest.translation();
  M.addScaledVector(D, -f.weaponCfg.hiltLength).sub(_c.set(c.x, c.y, c.z));
  const yi = _qi.copy(f.yaw).invert();
  M.applyQuaternion(yi);
  D.applyQuaternion(yi);
  hand[0] = M.x;
  hand[1] = M.y;
  hand[2] = M.z;
  dir[0] = D.x;
  dir[1] = D.y;
  dir[2] = D.z;
}
/** 뽑는 길 시작 자리 B (startIai — 몸 헤딩 틀 yaw 쿼터니언 · 가슴 원점): { hand: [x, y, z], yaw °, el ° } — 대기 칼 자리 그대로 */
export function obiPathB(f) {
  const hand = [0, 0, 0];
  const dir = [0, 0, 0];
  obiReadyInto(f, hand, dir);
  return { hand, yaw: Math.atan2(dir[2], dir[0]) / D2R, el: Math.asin(Math.max(-1, Math.min(1, dir[1]))) / D2R };
}

// ── 납도 (納刀) ────────────────────────────────────────────────
//  11/14 사장님 '발도 대기 자세로 전환될 때 칼을 칼집에 넣는 모션이 없어서 어색하더라 0.4초나 0.6초 정도 그 시간을 부여해' · '아니야 2초 후에 납도 시작' (SECRET.iaiSheathe):
//   고노센 준비 셈(secret.js IaiArm)이 iaiArmTime 을 넘으면 준비 전 iaiSheathe 초 동안 — 원전 納刀 꼴(왼손이 칼집 입 · 칼등을 칼집 입에 얹어 칼끝부터 칼집에 미끄러뜨려 넣음)을
//   덧씌우기 칸(thrustPose)의 칼 손 · 칼날 목표로: 앞 몫(SECRET.iaiSheatheWay.at) = 칼끝을 칼집 입으로(칼 든 손이 앞 오른쪽 hand 로 나가며 칼 축이 그 손 → 칼집 입 줄로 ·
//   왼손은 칼자루 끝을 놓고 칼집 입으로) · 뒤 몫 = 칼끝부터 밀어 넣음(칼 축 = 들어갈 축 → 대기 칼 축 · 칼끝이 칼집 입을 지나 칼날 길이만큼 — 대기 칼 자리 obiReady 에서 끝남 · 왼손이 칼집 입을 쥠).
//   칼집 그림은 왼손이 쥔 입을 쉬는 자리 → 대기 칼 자리 입으로 옮기며 축을 들어갈 축으로 돌리고, 칼끝이 입을 지나면 지금 칼을 감쌈(obiSayaPose). 새 걸음 · 공격 시간 값 없음
const _nr = new THREE.Vector3();
const _ne = new THREE.Vector3();
const _nm = new THREE.Vector3();
const _nd = new THREE.Vector3();
const _nq = new THREE.Quaternion();
const _nq2 = new THREE.Quaternion();
const _nv = new THREE.Vector3();
const smooth01 = (x) => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };
/** 단위 벡터 a → b 를 몫 t 로 (큰 원 — 골반 틀) */
function slerpDir(a, b, t, out) {
  _nq.setFromUnitVectors(a, b);
  _nq2.identity().slerp(_nq, t);
  return out.copy(a).applyQuaternion(_nq2).normalize();
}
/** 골반 틀 칼 원점 O · 칼 축 D → 덧씌우기 칸 (가슴 원점 · 몸 헤딩 틀 — obiReadyInto 와 같은 셈) */
function pelvisSwordInto(f, O, D, hand, dir) {
  const r = f.bodies.pelvis.rotation();
  const t = f.bodies.pelvis.translation();
  const qp = _q.set(r.x, r.y, r.z, r.w);
  const M = _a.copy(O).applyQuaternion(qp).add(_p.set(t.x, t.y, t.z));
  const Dw = _d.copy(D).applyQuaternion(qp);
  const c = f.bodies.chest.translation();
  M.sub(_c.set(c.x, c.y, c.z));
  const yi = _qi.copy(f.yaw).invert();
  M.applyQuaternion(yi);
  Dw.applyQuaternion(yi);
  hand[0] = M.x;
  hand[1] = M.y;
  hand[2] = M.z;
  dir[0] = Dw.x;
  dir[1] = Dw.y;
  dir[2] = Dw.z;
}
/**
 * 납도 길 (골반 몸체 틀): 몫 p (0 ~ 1)에서 칼 원점 N.O · 칼 축 N.D · 칼집 그림 입 N.Ms · 축 N.Ds · 몸 비틂 몫 N.k · 날 위 몫 N.edge · 왼손 칼집 입 몫 N.left ·
 *  칼집 입의 칼 위 자리 N.along (칼 원점에서 — 뒤 몫) · 감쌈 몫 N.wrap. 시작 칼 자리 N.O0 · N.D0 (notoStep 이 손을 놓은 첫 스텝에 잡음).
 *  앞 몫: 칼을 '들이기 전 자리'로 — 칼 축 SECRET.iaiSheatheWay { yaw, el }(왼쪽 가로로 조금 아래 — 앞 오른쪽 손에서 몸 앞을 가로지름) · 칼 든 손 = 대기 칼집 입 − 그 축 × reach
 *   (칼끝은 칼집 입을 칼 길이 − reach 만큼 지난 자리 — 이 게임 팔 길이 0.57 m 로 칼끝을 칼집 입에 댄 채 손을 뻗을 수 없어, 왼손이 칼집 입을 칼끝 쪽으로 당겨 받음 — 칼집 그림이 칼 위로 감).
 *   칼집 그림은 쉬는 자리 → 대기 칼집 입 · 들일 축으로 돌고(왼손이 쥐어 옮김) 뒤 70 % 에 걸쳐 지금 칼을 감쌈(칼 위 reach 자리 = 칼집 입).
 *  뒤 몫: 칼 든 손이 들이기 전 자리 → 대기 칼 자리(칼 축 → 대기 칼 축)로 밀어 넣는 동안 칼집 그림은 지금 칼을 감싼 채 입이 칼 위에서 reach → 칼날 시작으로 —
 *   칼집 입은 대기 칼집 입 곁에 머물고 칼이 칼끝부터 칼집 축을 따라 들어감 (원전 納刀). 끝 = 대기 칼 자리 · 대기 감쌈(obiSayaPose)과 같은 자리
 */
export function notoPlan(f, p, N) {
  const W = SECRET.iaiSheatheWay ?? {};
  const a = Math.max(0.05, Math.min(0.95, W.at ?? 0.4));
  const hilt = f.weaponCfg.hiltLength;
  const L = hilt + f.weaponCfg.bladeLength; // 칼 원점(손) → 칼끝
  const ext = Math.min(L, hilt + Math.max(0.05, W.reach ?? 0.37)); // 들이기 전 자리: 칼 원점 ↔ 칼집 입 = 대기 쥠(칼날 시작) + reach (칼끝은 칼집 입을 칼날 길이 − reach 만큼 지남)
  const R = obiReady(f, _nm, _nd); // 대기 칼 자리 (칼집 입 · 칼 축) — 납도 끝
  const De = obiDir({ yaw: W.yaw ?? -95, el: W.el ?? -12 }, f.side, _ne); // 들일 축 (칼끝 쪽)
  const Oe = _nr.copy(R.M).addScaledVector(De, -ext); // 들이기 전 칼 원점
  obiRest(f, _M0, _D0); // 쉬는 칼집 (그림 — 왼손이 쥐어 옮김)
  N.p = p;
  N.k = smooth01(p);
  N.edge = smooth01(p / a);
  if (p < a) {
    const q = smooth01(p / a);
    // 칼 축: 지금 축 → 들일 축 (두 축의 가운데가 뒤를 보면 — 칼끝이 몸 뒤 · 다리로 돌지 않게 — 앞 왼쪽 가로를 거침)
    _nv.addVectors(N.D0, De);
    if (_nv.lengthSq() > 1e-6 && _nv.x > 0.3 * _nv.length()) slerpDir(N.D0, De, q, N.D);
    else {
      obiDir({ yaw: -50, el: 0 }, f.side, _nv);
      if (q < 0.5) slerpDir(N.D0, _nv, q * 2, N.D);
      else slerpDir(_nv, De, q * 2 - 1, N.D);
    }
    N.O.copy(N.O0).lerp(Oe, q);
    const qs = smooth01(p / a); // 칼집은 왼손이 쥐어 받을 자리로 (칼과 함께)
    N.Ms.copy(_M0).lerp(R.M, qs);
    slerpDir(_D0, De, qs, N.Ds);
    N.wrap = smooth01((p / a - 0.3) / 0.7); // 앞 몫 뒤 70 % 에 걸쳐 지금 칼을 감싸 들어감 (칼이 늦게 와도 칼집이 한 번에 휙 돌지 않게)
    N.along = ext;
    N.left = 0.5 * (p / a);
    N.phase = 0;
  } else {
    const r = smooth01((p - a) / (1 - a));
    // 밀어 넣기: 칼 축은 뒤 40 % 에서야 대기 칼 축으로 (손이 몸 앞 가운데로 온 뒤 — 손이 오른쪽에 있는 채 칼끝을 뒤로 돌리면 칼 든 손목이 사람 범위 밖으로 꺾임 · 재기 §13)
    slerpDir(De, R.D, smooth01((r - 0.6) / 0.4), N.D);
    N.along = ext + (hilt - ext) * r; // 칼집 입의 칼 위 자리: reach → 칼날 시작 (칼이 칼끝부터 들어감)
    N.O.copy(R.M).addScaledVector(N.D, -N.along); // 칼집 입은 대기 칼집 입에 머묾 — 칼 원점 = 입 − 축 × 칼집 입 자리
    N.Ms.copy(R.M);
    N.Ds.copy(N.D);
    N.wrap = 1;
    N.left = 0.5 + 0.5 * ((p - a) / (1 - a));
    N.phase = 1;
  }
  return N;
}
/**
 * 납도 한 스텝 (secret_instant.js iaiReadyPose · iaiReadyPosePlayer — 준비 전 납도 몫 s 0 → 1 · IaiArm.sheathe): hold = 손이 쉼(사람 — 칼을 쥐지 않음 · AI 늘 참).
 *  손을 놓은 첫 스텝(덧씌우기 몫 0 에서)에 지금 칼 자리(골반 틀 칼 원점 · 칼 축)를 잡아 남은 몫 동안 납도 길(notoPlan)을 감 — 잡은 자리가 첫 목표라 덧씌우기 몫 1 로 들어가도 튀지 않음.
 *  쥐면(hold 거짓) 몫 0 — 칼은 곧장 사람 손 (셈은 그대로 흐름 · 다시 놓으면 그 자리에서 이어감). hand · dir = 덧씌우기 칸. 돌려줌: 덧씌우기 몫
 */
export function notoStep(f, s, hold, hand, dir) {
  const N = (f.noto ??= { w: 0, s0: 0, p: 0, k: 0, edge: 0, left: 0, along: 0, wrap: 0, phase: 0, O0: new THREE.Vector3(), D0: new THREE.Vector3(), O: new THREE.Vector3(), D: new THREE.Vector3(), Ms: new THREE.Vector3(), Ds: new THREE.Vector3() });
  if (!hold || !f.sword || !f.armed) {
    N.w = 0;
    return 0;
  }
  if (!(N.w > 0)) {
    // 지금 칼 자리 (골반 틀 — 칼 원점 · 칼 축)
    const pr = f.bodies.pelvis.rotation();
    const pt = f.bodies.pelvis.translation();
    const qpi = _q.set(pr.x, pr.y, pr.z, pr.w).invert();
    const r = f.sword.rotation();
    const t = f.sword.translation();
    N.O0.set(t.x - pt.x, t.y - pt.y, t.z - pt.z).applyQuaternion(qpi);
    N.D0.set(0, 1, 0).applyQuaternion(_qi.set(r.x, r.y, r.z, r.w)).applyQuaternion(qpi).normalize();
    N.s0 = Math.min(s, 0.999);
  }
  N.w = 1;
  notoPlan(f, Math.max(0, Math.min(1, (s - N.s0) / (1 - N.s0))), N);
  pelvisSwordInto(f, N.O, N.D, hand, dir);
  return 1;
}
/** 납도 그만 (준비가 켜짐 · 셈이 풀림 · 발도): 덧씌우기 몫 0 — 돌려줌: 그만둔 스텝에 납도 중이었나 */
export function notoStop(f) {
  const N = f.noto;
  if (!N || !(N.w > 0)) return false;
  N.w = 0;
  return true;
}
/**
 * 납도 동안 왼손이 가는 칼집 입 쥠 자리 (월드 · fighter.js offHand): 납도 길의 칼집 입 + 축 × iaiSayaKoi — 왼손이 칼집 입을 쥐고 칼을 그리로 이끎(뒤 몫의 쥐는 끈은 칼 위 칼집 입 자리에) ·
 *  끝 20 % 에 지금 칼 위 칼집 입 쥠 자리로 옮김 (대기에 들 때 빈손 목표가 한 스텝에 튀지 않게 — 대기 쥠은 칼 위 자리) · 납도 밖이면 null
 */
export function notoKoiW(f, out) {
  const N = f.noto;
  if (!N || !(N.w > 0)) return null;
  const koi = SECRET.iaiSayaKoi ?? 0.05;
  out.copy(N.Ms).addScaledVector(N.Ds, koi);
  pelvisToWorld(f, out);
  const e = N.phase === 1 ? smooth01((N.p - 0.8) / 0.2) : 0;
  if (e > 0 && f.sword) {
    const r = f.sword.rotation();
    const t = f.sword.translation();
    out.lerp(_nkw.set(0, N.along + koi, 0).applyQuaternion(_nkq.set(r.x, r.y, r.z, r.w)).add(_nkt.set(t.x, t.y, t.z)), e);
  }
  return out;
}
const _nkw = new THREE.Vector3();
const _nkt = new THREE.Vector3();
const _nkq = new THREE.Quaternion();

// ── ② 빈 칼집 그림 ─────────────────────────────────────────────

/** 무기마다 칼집 빛깔 (그림만) — 칼자루 · 쇠붙이 색을 따름 [추정 — 그림으로 고름] */
const SAYA_LOOK = {
  uchigatana: { body: 0x17171a, fit: 0x2b2e33, rough: 0.32, cord: 0x23263a }, // 검은 옻칠 · 쇠 (츠바 · 카시라 0x2b2e33) · 사게오 쪽빛
  muramasa: { body: 0x2a1615, fit: 0x9b7c51, rough: 0.34, cord: 0x5a1f1c }, // 검붉은 옻칠 · 청동 (하바키 · 띠 0x9b7c51) · 사게오 검붉음
  kusanagi: { body: 0x1d3a37, fit: 0xb49b60, rough: 0.5, cord: 0x8a7444 }, // 짙은 청록 · 금 (KUSANAGI_COLORS grip · gold) · 사게오 금빛 갈색
  monohoshizao: { body: 0x141416, fit: 0xc9a14a, rough: 0.3, cord: 0x2e2a20 }, // 검은 옻칠 · 금 테 (츠바 금 테 0xc9a14a) · 사게오 검은 갈색
};
/** 사게오(下緒) — 칼집 栗形 에서 허리띠로 잇는 끈 (그림만): 끈 길이 m · 굵기(반지름) m [추정 — 그림으로 고름 · 확인표 3887] */
const SAGEO = { len: 0.14, r: 0.0035, seg: 12, sides: 6 };

/**
 * 칼날 그림을 칼 원점 틀에서 재서 칼집 단면 줄을 짓는다: 칼날 시작(hiltLength)부터 칼끝까지 N 칸 — 칸마다 날 쪽 x 가운데(휨) · 반폭 · 반두께.
 *  칼집 = 그 줄을 감싼 겉(반폭 + 0.005 · 반두께 + 0.008 m — 날이 칼집 겉을 뚫지 않게) · 길이 = 칼끝 + 0.02 m (끝 쇠).
 */
function bladeProfile(swordGroup, bladeMesh, hilt, bladeLen, N = 18) {
  const lo = new Array(N + 1).fill(Infinity);
  const hi = new Array(N + 1).fill(-Infinity);
  const zz = new Array(N + 1).fill(0);
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  swordGroup.updateMatrixWorld(true);
  inv.copy(swordGroup.matrixWorld).invert();
  const root = bladeMesh ?? swordGroup;
  let yMax = hilt;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const pos = o.isMesh && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y < hilt - 1e-4) continue;
      yMax = Math.max(yMax, v.y);
    }
  });
  const span = Math.max(0.1, yMax - hilt);
  root.traverse((o) => {
    const pos = o.isMesh && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y < hilt - 1e-4) continue;
      const k = Math.max(0, Math.min(N, Math.round(((v.y - hilt) / span) * N)));
      lo[k] = Math.min(lo[k], v.x);
      hi[k] = Math.max(hi[k], v.x);
      zz[k] = Math.max(zz[k], Math.abs(v.z));
    }
  });
  // 빈 칸은 이웃 칸으로 메움 · 칼끝 칸은 좁아지니 칼집은 끝에서 조금만 좁힘(칼집 끝은 둥근 끝 쇠)
  for (let k = 0; k <= N; k++) {
    if (Number.isFinite(lo[k])) continue;
    const j = k > 0 ? k - 1 : k + 1;
    lo[k] = lo[j];
    hi[k] = hi[j];
    zz[k] = zz[j];
  }
  const rows = [];
  const w0 = (hi[0] - lo[0]) / 2;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const cx = (lo[k] + hi[k]) / 2;
    const w = Math.max((hi[k] - lo[k]) / 2, w0 * (1 - 0.25 * t)); // 칼끝 쪽 좁아짐은 칼날 밑동 폭의 3/4 까지만 (칼집 끝이 바늘처럼 되지 않게)
    rows.push({ y: hilt + t * span, cx, hw: w + 0.005, ht: Math.max(zz[k], zz[0] * 0.6) + 0.008 });
  }
  if (!Number.isFinite(rows[0].cx)) return null;
  return { rows, len: span + 0.02, bladeLen };
}

/** 칼집 메쉬 (칼집 틀: 원점 = 칼집 입(칼날 시작) · +y = 칼끝 쪽 · +x = 날 쪽 · z = 칼 면) */
function sayaGroup(prof, look) {
  const g = new THREE.Group();
  g.name = 'iai-obi-saya';
  g.userData.visualOnly = true;
  const body = new THREE.MeshStandardMaterial({ color: look.body, roughness: look.rough, metalness: 0.05 });
  const fit = new THREE.MeshStandardMaterial({ color: look.fit, roughness: 0.38, metalness: 0.7 });
  const S = 10; // 단면 꼭짓점
  const R = prof.rows;
  const y0 = R[0].y;
  const len = prof.len;
  const rowAt = (y) => {
    const s = Math.max(0, Math.min(R.length - 1, ((y - y0) / (R.at(-1).y - y0)) * (R.length - 1)));
    const i = Math.min(R.length - 2, Math.floor(s));
    const w = s - i;
    const a = R[i];
    const b = R[i + 1];
    return { cx: a.cx + (b.cx - a.cx) * w, hw: a.hw + (b.hw - a.hw) * w, ht: a.ht + (b.ht - a.ht) * w };
  };
  // 몸 (끝은 둥근 끝 쇠 안으로 모임)
  const rings = 24;
  const pos = [];
  const idx = [];
  for (let r = 0; r <= rings; r++) {
    const y = (r / rings) * len;
    const q = rowAt(y0 + Math.min(y, R.at(-1).y - y0));
    const tip = Math.max(0, (y - (len - 0.03)) / 0.03); // 끝 3 cm 둥글게
    const sh = Math.sqrt(Math.max(0, 1 - tip * tip * 0.75));
    for (let s = 0; s < S; s++) {
      const a = (s / S) * Math.PI * 2;
      pos.push(q.cx + Math.cos(a) * q.hw * sh, y, Math.sin(a) * q.ht * sh);
    }
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < S; s++) {
      const a = r * S + s;
      const b = r * S + ((s + 1) % S);
      idx.push(a, a + S, b, b, a + S, b + S);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, body);
  m.castShadow = true;
  g.add(m);
  // 칼집 입 쇠(鯉口 — 짧은 고리) · 끝 쇠(鐺) · 끈 고리 혹(栗形 — 칼 면 바깥, 입에서 0.1 m)
  const q0 = rowAt(y0);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.012, S), fit);
  mouth.scale.set(q0.hw + 0.0015, 1, q0.ht + 0.0015);
  mouth.position.set(q0.cx, 0.006, 0);
  g.add(mouth);
  const qe = rowAt(y0 + R.at(-1).y - y0);
  const end = new THREE.Mesh(new THREE.SphereGeometry(1, S, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), fit);
  end.scale.set(qe.hw * 0.62, 0.03, qe.ht * 0.62);
  end.position.set(qe.cx, len - 0.03, 0);
  g.add(end);
  const qk = rowAt(y0 + 0.1);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.008), fit);
  knob.position.set(qk.cx - qk.hw * 0.35, 0.1, -(qk.ht + 0.002));
  g.add(knob);
  g.userData.knob = knob.position.clone().setZ(knob.position.z - 0.004); // 사게오가 매이는 자리 (栗形 바깥)
  return g;
}

/**
 * 몸 f 에 빈 칼집을 단다 (fighter.js 생성자 — 무기 그림 뒤 · isolatedVisual 안): 골반 그림 그룹의 아이 · 그림만.
 *  다라이시(자기 빈 검집 — look.daraishiRevision · outfit silver_wanderer) · 김씨(허리 칼 renji-sheathed-sword 가 보임)는 달지 않음
 */
export function attachObiSaya(f, look) {
  f.obiSaya = null;
  if (!SECRET.iaiObiSaya || !obiOn(f) || !f.groups?.pelvis || !f.swordGroup) return null;
  // 옷 두께 (누운 몸 밀어냄 — obiPush): 칼집을 달기 전 그림으로 잼
  const garm = {
    pelvis: partHalf(f.groups.pelvis, PELVIS_BOX),
    abdomen: partHalf(f.groups.abdomen, ABDOMEN_BOX),
    chest: partHalf(f.groups.chest, CHEST_BOX),
  };
  const skirt = skirtProfile(f.groups.pelvis);
  const legR = { thighF: legRadius(f.groups.thighF), thighB: legRadius(f.groups.thighB) };
  const legRF = { thighF: legRadius(f.groups.thighF, -1), thighB: legRadius(f.groups.thighB, -1) };
  const shinR = { shinF: legRadius(f.groups.shinF, -1, 0.05), shinB: legRadius(f.groups.shinB, -1, 0.05) };
  let g = null;
  let prof = null;
  const lk = SAYA_LOOK[f.weapon.id] ?? SAYA_LOOK.uchigatana;
  if (ownScabbard(f, look)) {
    // 다라이시 (11/14 사장님 '다라이시 검집 모양은 그대로 두고 자리만 다른 인물처럼 허리띠로'): 자기 빈 검집 그림을 칼집 틀로 옮겨 같은 몰기 · 밀어냄 · 땅 셈 (daraishiSaya)
    const own = SECRET.iaiObiOwn ? daraishiSaya(f, look) : null;
    if (!own) return null;
    ({ g, prof } = own);
  } else {
    prof = bladeProfile(f.swordGroup, f.bladeMesh, f.weaponCfg.hiltLength, f.weaponCfg.bladeLength);
    if (!prof) return null;
    g = sayaGroup(prof, lk);
  }
  f.groups.pelvis.add(g);
  const edge = SECRET.iaiObiEdge ? 1 : f.weapon.id === 'monohoshizao' ? 1 : -1; // 날 쪽 — 날 위(iaiObiEdge — 원전 「刃を上に」)면 처음부터 위
  f.obiSaya = { g, prof, k: 0, t: null, pulled: false, fw: 0, fPos: new THREE.Vector3(), fQuat: new THREE.Quaternion(), edge, legR, legRF, shinR, garm, skirt, knob: g.userData.knob ?? null, cord: null, own: !!g.userData.own }; // edge: 날 쪽 (obiSayaPose) · legR: 허벅지 그림 반지름 (obiPush) · garm: 누운 몸 옷 두께 상자
  if (SECRET.iaiObiSageo && f.obiSaya.knob) f.obiSaya.cord = sageoCord(f, g.userData.cordColor ?? lk.cord ?? lk.body);
  syncObiSaya(f);
  return g;
}

/**
 * 다라이시 빈 검집을 칼집 틀로 (11/14 — SECRET.iaiObiOwn): 옷 모듈이 이름 붙여 둔 검집 몸 · 쇠붙이(outfit_silver_wanderer.js · _detail.js 'daraishi-scabbard*')를
 *  그 자리(검집 좌표 → 골반 — placeDaraishiScabbard)에서 빼 칼집 틀(입 = 원점 · +y = 끝 쪽)로 옮김 — 꼴 · 길이 · 입 쇠 · 끝 쇠 · 끈 띠 · 빛깔 그대로.
 *  매다는 끈 둘(옛 자리의 허리띠 → 검집)은 감추고 사게오가 잇는다. 둥근 검집이라 단면 줄은 반지름 그대로(입 0.025 → 끝 0.02 · 입 쇠 0.027).
 *  v7 아래(굵은 옛 판 — 이름 없음)는 null → 옛 자리 그대로
 */
function daraishiSaya(f, look) {
  const pel = f.groups.pelvis;
  const parts = [];
  pel.traverse((o) => { if (o.isMesh && /^daraishi-scabbard/.test(o.name)) parts.push(o); });
  if (!parts.length) return null;
  const DS = DARAISHI_SCABBARD;
  const SL = look?.daraishiScabbardLen ?? DS.length;
  // 검집 좌표 → 옷 층 좌표 (placeDaraishiScabbard 를 점 넷에 걸어 읽음 — 입 · 기울임 · 안쪽 들임 그대로)
  const probe = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1], 3));
  const bakeFn = (geo, pos, rot) => geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...(pos ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rot ?? [0, 0, 0]))), new THREE.Vector3(1, 1, 1)));
  const P = placeDaraishiScabbard(THREE, bakeFn, probe, look).attributes.position;
  const o = new THREE.Vector3().fromBufferAttribute(P, 0);
  const ax = [1, 2, 3].map((i) => new THREE.Vector3().fromBufferAttribute(P, i).sub(o));
  const T = new THREE.Matrix4().makeBasis(ax[0], ax[1], ax[2]).setPosition(o);
  // 검집 좌표 → 칼집 틀: 입(y = top)을 원점으로 · y 를 뒤집음(끝 쪽 +) · x 도 뒤집어 오른손 틀
  const A = new THREE.Matrix4().makeRotationZ(Math.PI).multiply(new THREE.Matrix4().makeTranslation(0, -DS.top, 0));
  const M = A.multiply(T.invert());
  const g = new THREE.Group();
  g.name = 'iai-obi-saya';
  g.userData.visualOnly = true;
  g.userData.own = true;
  let cordColor = null;
  for (const m of parts) {
    if (/strap/.test(m.name)) { m.visible = false; cordColor ??= m.material?.color?.getHex?.() ?? null; continue; } // 옛 자리 매다는 끈
    m.parent.remove(m);
    m.matrixAutoUpdate = false;
    m.matrix.copy(M);
    g.add(m);
  }
  g.userData.cordColor = cordColor;
  g.userData.knob = new THREE.Vector3(0, DS.top - 0.27, -0.031); // 검집 끈 띠(검집 좌표 y 0.27 — 입 쇠 아래) 겉
  const N = 18;
  const rows = [];
  for (let k = 0; k <= N; k++) {
    const y = (k / N) * (SL - 0.01);
    const r = 0.025 + (0.02 - 0.025) * (y / SL) + (y < 0.043 ? 0.002 : 0); // 몸 cyl(0.025 → 0.02) · 입 쇠 0.027
    rows.push({ y, cx: 0, hw: r, ht: r });
  }
  return { g, prof: { rows, len: SL, bladeLen: f.weaponCfg.bladeLength } };
}

/** 몸 조각 그림(옷 포함)의 반 크기 (몸체 틀 축마다 꼭짓점 가장 먼 값) — 몸 그림 상자 h 아래로 안 내림 · h + 0.05 에서 자름 (누운 몸 밀어냄) */
function partHalf(group, h) {
  const out = [...h];
  if (!group) return out;
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  group.updateMatrixWorld(true);
  inv.copy(group.matrixWorld).invert();
  group.traverse((o) => {
    const pos = o.isMesh && o.visible !== false && !/^iai-obi|^daraishi-scabbard/.test(o.name) && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i += 3) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      out[0] = Math.max(out[0], Math.min(h[0] + 0.05, Math.abs(v.x)));
      out[1] = Math.max(out[1], Math.min(h[1] + 0.05, Math.abs(v.y)));
      out[2] = Math.max(out[2], Math.min(h[2] + 0.05, Math.abs(v.z)));
    }
  });
  return out;
}

/**
 * 골반 옷 자락 꼴 (누운 몸 밀어냄 — 그림만): 골반 그림(옷 자락 · 갑옷 자락 포함)을 허리띠 아래 높이 띠 8 칸으로 나눠 칸마다 앞뒤 · 옆 반지름(꼭짓점 가장 먼 |x| · |z|) —
 *  누운 몸에서 칼집이 자락 겉에 얹히게(자락을 뚫지 않게). 몸 그림 상자 아래로 안 내림 · 0.25 m 에서 자름. 자락이 없으면(그림 상자 안) null
 */
function skirtProfile(group) {
  if (!group) return null;
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  group.updateMatrixWorld(true);
  inv.copy(group.matrixWorld).invert();
  let y0 = 0;
  const pts = [];
  group.traverse((o) => {
    const pos = o.isMesh && o.visible !== false && !/^iai-obi|^daraishi-scabbard/.test(o.name) && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y > PELVIS_BOX[1] || Math.abs(v.x) > 0.3 || Math.abs(v.z) > 0.3) continue;
      pts.push(v.x, v.y, v.z);
      y0 = Math.min(y0, v.y);
    }
  });
  if (y0 > -PELVIS_BOX[1] - 0.02) return null;
  const N = 8;
  const top = PELVIS_BOX[1];
  const rx = new Array(N).fill(PELVIS_BOX[0]);
  const rz = new Array(N).fill(PELVIS_BOX[2]);
  for (let i = 0; i < pts.length; i += 3) {
    const k = Math.max(0, Math.min(N - 1, Math.floor(((top - pts[i + 1]) / (top - y0)) * N)));
    rx[k] = Math.min(0.25, Math.max(rx[k], Math.abs(pts[i])));
    rz[k] = Math.min(0.25, Math.max(rz[k], Math.abs(pts[i + 2])));
  }
  return { top, bot: y0, rx, rz };
}

/**
 * 사게오(下緒 — 11/14 사장님 '칼집과 허리띠를 잇는 끈' · 그림만): 칼집 栗形(입에서 0.1 m — 칼집 겉)에서 허리띠 위 매는 자리(쉬는 칼집 栗形 바로 안쪽 몸 겉)까지
 *  끈 길이 SAGEO.len 의 처진 끈(두 끝 사이 V 처짐 — 땅 쪽으로). 발도 대기 동안 칼집이 대기 칼을 감싸 허리에서 뜬 틈을 잇는다. 끈 점은 골반 · 배 · 허벅지 밖으로 밀어냄
 */
function sageoCord(f, color) {
  const n = SAGEO.seg + 1;
  const sides = SAGEO.sides;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * sides * 3), 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(n * sides * 3), 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j;
      const b = i * sides + ((j + 1) % sides);
      idx.push(a, b, a + sides, b, b + sides, a + sides);
    }
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 }));
  mesh.name = 'iai-obi-sageo';
  mesh.userData.visualOnly = true;
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  f.groups.pelvis.add(mesh);
  return { mesh, geo, A: null, pts: Array.from({ length: n }, () => new THREE.Vector3()) };
}
/**
 * 허벅지 그림(옷 — 하카마 · 자락 · 갑옷 포함)의 윗반 반지름: 허벅지 몸체 틀(축 = y)에서 엉덩이 쪽 반(y > −0.05)의 꼭짓점이 축에서 가장 먼 거리 —
 *  칼집을 그 굵기의 허벅지 캡슐 밖으로 밀어냄(obiPush — 다리를 들거나 비틀 때 칼집이 옷을 뚫지 않고 밀려남 · 다라이시 자락 셈의 교훈). 몸 캡슐 0.065 아래로는 안 내림 · 0.16 에서 자름
 */
function legRadius(group, yMin = -0.05, r0 = 0.065) {
  let r = r0;
  if (!group) return r;
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  group.updateMatrixWorld(true);
  inv.copy(group.matrixWorld).invert();
  group.traverse((o) => {
    const pos = o.isMesh && o.visible !== false && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (yMin < 0 ? v.y > yMin : true) r = Math.max(r, Math.hypot(v.x, v.z));
    }
  });
  return Math.min(0.16, r);
}
/** 자기 칼집 · 허리 칼이 있는 겉모습 (다라이시 빈 검집 · 김씨 허리 칼) */
export function ownScabbard(f, look) {
  if (look?.outfit && String(look.outfit).startsWith('silver_wanderer')) return true;
  if (look?.daraishiRevision != null || look?.daraishiScabbard != null) return true;
  const sw = f.groups?.pelvis?.getObjectByName?.('renji-sheathed-sword');
  return !!(sw && sw.visible !== false);
}

const _M0 = new THREE.Vector3();
const _D0 = new THREE.Vector3();
const _M1 = new THREE.Vector3();
const _D1 = new THREE.Vector3();
const _G0 = new THREE.Vector3();
const _G1 = new THREE.Vector3();
const _h = new THREE.Vector3();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
const _mx = new THREE.Matrix4();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _sp = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
/** 축 D 와 날 쪽(골반 위 · 아래 edge = ±1)으로 칼집 틀 쿼터니언 (x = 날 · y = 칼끝 쪽 · z = x × y) */
function frameQ(D, out, edge = 1) {
  _x.copy(_UP).addScaledVector(D, -D.y);
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
  _x.normalize().multiplyScalar(edge < 0 ? -1 : 1);
  _z.crossVectors(_x, D);
  _mx.makeBasis(_x, D, _z);
  return out.setFromRotationMatrix(_mx);
}

/**
 * 왼손이 칼집을 쥔 몫 · 鞘引き 몫 (그림만 — 몸 필드를 읽기만):
 *  쥠 = 대기에서 낸 발도의 鞘引き(iai.saya) · 그 뒤 굳음 · 풀기(iaiOneHold — 鞘引き 한 판) · 다시 쥐기 앞 반(鞘戻し — iaiRegripVia · 몫 0.5 까지)
 *  (대기 동안 왼손은 칼집 입을 칼째 쥠 — 칼집이 칼을 감쌈 · obiSayaPose)
 *  鞘引き 몫 k = 왼손을 대기 쥠 자리 G0 → 왼 허리 G1 줄에 내린 몫 (쥘 때만 · 놓으면 0 으로 iaiRegrip 초에)
 */
export function obiSayaK(f) {
  const S = f.obiSaya;
  if (!S) return 0;
  const draw = !!f.iai?.saya;
  if (draw) S.pulled = true;
  const rg = f.iaiRegripT > 0 && f.iaiRegripVia ? 1 - f.iaiRegripT / Math.max(1e-6, f.iaiRegripDur || 1) : null;
  if (S.pulled && !draw && !f.iaiOneHold && !(f.iaiHoldT > 0) && !(f.iaiFade > 0) && (rg == null || rg > 0.5)) S.pulled = false;
  const hold = S.pulled && f.alive && f.limbs?.armO > 0.3 && f.bodies.farmO;
  let kT = 0;
  if (hold) {
    obiGrip(f, _G0);
    obiPt(SECRET.iaiSayaHip, f.side, _G1);
    const fo = f.bodies.farmO;
    const r = fo.rotation();
    const t = fo.translation();
    _h.set(0, -0.135, 0).applyQuaternion(_qa.set(r.x, r.y, r.z, r.w)).add(_sp.set(t.x, t.y, t.z));
    const pr = f.bodies.pelvis.rotation();
    const pt = f.bodies.pelvis.translation();
    _h.sub(_sp.set(pt.x, pt.y, pt.z)).applyQuaternion(_qa.set(pr.x, pr.y, pr.z, pr.w).invert());
    const seg = _G1.sub(_G0);
    kT = Math.max(0, Math.min(1, _h.sub(_G0).dot(seg) / Math.max(1e-6, seg.lengthSq())));
  }
  // 놓으면(쥠 끝 · 넘어짐 · 죽음) 제자리로 iaiRegrip 초에 (시계 = 기력 시계 stamina.time — 그림만)
  const now = f.stamina?.time ?? 0;
  const dt = S.t != null ? Math.max(0, now - S.t) : 0;
  S.t = now;
  S.k = hold ? kT : Math.max(0, S.k - dt / Math.max(1e-3, SECRET.iaiRegrip || 0.2));
  if (S.fw > 0 && (f.iai || f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0)) S.fw = Math.max(0, S.fw - dt / Math.max(1e-3, SECRET.iaiRegrip || 0.2)); // 감싼 몫을 걷음 (위 obiSayaPose)
  return S.k;
}

/**
 * 납도 동안 칼집 그림 (11/14 — notoPlan): 왼손이 쥔 칼집을 납도 길의 입 N.Ms · 축 N.Ds 로 (쉬는 자리 → 대기 칼 자리 입 · 들어갈 축) ·
 *  칼끝이 그 입을 지나면 지금 칼을 감쌈 — 칼집 입 = 칼 축 위 입에 가장 가까운 점(칼날 시작 ~ 칼끝) · 축 = 칼 축(날 위 그림 칼 굴림 포함 — 칼집 단면이 칼날 그림을 쟀으니 칼날이 칼집 안).
 *  감쌈 몫: 칼끝이 입을 3 cm 지나며 0 → 1 · 칼 축이 입에서 SECRET.iaiObiFollow.m 넘게 비키면 덜 (두 배에서 0).
 *  납도가 그치면(준비 · 셈 풀림) 마지막 자리를 iaiRegrip 초에 걷음(대기 감쌈이 이어 받음). 그림만
 */
function notoSaya(f, S, out) {
  const N = f.noto;
  const now = f.stamina?.time ?? 0;
  const dt = S.nt != null ? Math.max(0, now - S.nt) : 0;
  S.nt = now;
  S.nPos ??= new THREE.Vector3();
  S.nQuat ??= new THREE.Quaternion();
  if (N && N.w > 0 && f.sword && f.armed) {
    const edge = S.edge ?? 1;
    const pos = _nsP.copy(N.Ms);
    const quat = frameQ(N.Ds, _nsQ, edge);
    if (N.wrap > 0) {
      // 지금 칼을 감쌈: 칼집 입 = 칼 위 N.along 자리 · 축 = 칼 축 (날 위 그림 칼 굴림 포함) — 그 입이 납도 길 입에서 iaiObiFollow.m 의 두 배 넘게 비키면 덜 (네 배에서 0)
      const pr = f.bodies.pelvis.rotation();
      const pt = f.bodies.pelvis.translation();
      const qpi = _qs.set(pr.x, pr.y, pr.z, pr.w).invert();
      const r = f.sword.rotation();
      const t = f.sword.translation();
      const qw = _qw.set(r.x, r.y, r.z, r.w);
      if (f.obiEdge?.roll) qw.multiply(_qr.setFromAxisAngle(_UP, f.obiEdge.roll));
      // 칼집 틀은 칼 축만 따르고 굴림은 칼집 틀 꼴(날 쪽 = 축에 수직인 위 — frameQ · 날 위 그림 칼과 같은 쪽)로: 칼 굴림 그대로 섞으면 들일 축 ↔ 칼 틀 사이 굴림이 반 바퀴 곁일 때 축이 한 스텝에 휙 돎
      const ql = frameQ(_nsD.set(0, 1, 0).applyQuaternion(qw).applyQuaternion(qpi), _ql, edge);
      const Mw = _ms.set(0, N.along, 0).applyQuaternion(qw).add(_nsV.set(t.x, t.y, t.z)).sub(_nsV.set(pt.x, pt.y, pt.z)).applyQuaternion(qpi);
      const Lm = 2 * (SECRET.iaiObiFollow ?? { m: 0.06 }).m;
      const off = Mw.distanceTo(N.Ms);
      const wT = N.wrap * smooth01(2 - off / Lm);
      const ww = (S.nww = S.nww == null ? wT : S.nww + Math.max(-dt / 0.15, Math.min(dt / 0.15, wT - S.nww))); // 감쌈 몫은 0.15 s 에 다 바뀜 (한 스텝에 튀지 않게)
      if (ww > 0) {
        pos.lerp(Mw, ww);
        quat.slerp(ql, ww);
      }
    }
    S.nPos.copy(pos);
    S.nQuat.copy(quat);
    S.nw = 1;
  } else {
    S.nw = Math.max(0, (S.nw ?? 0) - dt / Math.max(1e-3, SECRET.iaiRegrip || 0.2));
    S.nww = null;
  }
  if (S.nw > 0) {
    out.pos.lerp(S.nPos, S.nw);
    out.quat.slerp(S.nQuat, S.nw);
    out.follow = Math.max(out.follow, S.nw);
  }
}
const _nsP = new THREE.Vector3();
const _nsQ = new THREE.Quaternion();
const _nsV = new THREE.Vector3();
const _nsD = new THREE.Vector3();

/**
 * 칼집 자리 (골반 몸체 틀): 제자리 ↔ 鞘引き 끝을 k 로 섞고, 대기 동안(iaiObiW — 대기 칼 자리 몫) 칼을 감싸 지금 칼 자리로 —
 *  지금 칼이 대기 칼 자리(obiReady)에서 SECRET.iaiObiFollow 한도(칼집 입 m · 축 °)를 넘게 벗어나면 넘은 만큼 덜 따르고 한도 두 배에서 안 따름(허리띠를 떠나 떠 보이지 않게) ·
 *  뽑기 · 굳음 · 풀기 동안은 감싼 자리를 그대로 두되 鞘引き 몫(k)만큼 · iaiRegrip 초에 걷음.
 *  끝으로 골반 · 배 상자를 뚫은 몫만큼 바깥으로 밀어냄(obiPush). out: { pos, quat } (칼집 틀 원점 = 칼집 입 · 골반 몸체 틀) — 시험 · 재기 도구도 같은 셈을 씀
 */
export function obiSayaPose(f, out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), follow: 0, k: 0, push: 0 }) {
  const k = obiSayaK(f);
  obiRest(f, _M0, _D0);
  obiPulled(f, _M1, _D1);
  // 칼집 입은 골반 세로축 둘레로 돌아 감 (배꼽 앞 → 왼 허리 — 몸 모서리를 가로질러 뚫지 않게: 둘레 각 · 반지름 · 높이를 섞음)
  const a0 = Math.atan2(_M0.z, _M0.x), a1 = Math.atan2(_M1.z, _M1.x);
  const r0 = Math.hypot(_M0.x, _M0.z), r1 = Math.hypot(_M1.x, _M1.z);
  const ak = a0 + (a1 - a0) * k, rk = r0 + (r1 - r0) * k;
  out.pos.set(Math.cos(ak) * rk, _M0.y + (_M1.y - _M0.y) * k, Math.sin(ak) * rk);
  // 쉬는 칼집의 날 쪽 = 대기 칼의 날 쪽 (이 게임 대기 칼은 날이 아래 — 사람 모노호시자오 허리 대기만 위 · 감쌀 때 칼집이 칼 둘레로 반 바퀴 돌지 않게 · 아래에서 감쌀 때마다 고침)
  const edge = f.obiSaya?.edge ?? 1;
  frameQ(_D0, _qa, edge);
  frameQ(_D1, _qb, edge);
  out.quat.copy(_qa).slerp(_qb, k);
  out.k = k;
  out.follow = 0;
  out.push = 0;
  // 대기 동안 칼을 감쌈 (칼 원점 틀 → 골반 몸체 틀). 발도 · 굳음 · 풀기 동안은 감싼 자리를 그대로 두고(칼이 칼집 입에서 나감) 그 몫을 iaiRegrip 초에 걷음 — 鞘引き 가 칼집을 허리로 데려감
  const S = f.obiSaya;
  if (S) notoSaya(f, S, out);
  const busy = !!f.iai || !!f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0;
  const sw = busy ? 0 : f.iaiObiW ?? 0;
  if (S && busy && S.fw > 0) {
    const w = S.fw * (1 - k); // 鞘引き 로 왼손이 칼집을 허리로 데려가는 만큼 감싼 자리를 놓음 (왼손 ↔ 칼집 입이 떨어지지 않게)
    out.pos.lerp(S.fPos, w);
    out.quat.slerp(S.fQuat, w);
    out.follow = w;
  } else if (S) S.fw = 0;
  if (sw > 0 && f.sword && f.armed) {
    const pr = f.bodies.pelvis.rotation();
    const pt = f.bodies.pelvis.translation();
    const qpi = _qs.set(pr.x, pr.y, pr.z, pr.w).invert();
    const r = f.sword.rotation();
    const t = f.sword.translation();
    const qw = _qw.set(r.x, r.y, r.z, r.w);
    if (f.obiEdge?.roll) qw.multiply(_qr.setFromAxisAngle(_UP, f.obiEdge.roll)); // 날 위 (그림 칼 — obiEdgeRoll): 칼집이 그림 칼을 감쌈 (칼 축 둘레라 입 자리 그대로)
    const ql = _ql.copy(qpi).multiply(qw);
    const Ms = _ms.set(0, f.weaponCfg.hiltLength, 0).applyQuaternion(qw).add(_sp.set(t.x, t.y, t.z)).sub(_sp.set(pt.x, pt.y, pt.z)).applyQuaternion(qpi);
    const Ds = _ds.set(0, 1, 0).applyQuaternion(ql);
    // 비킴은 대기 칼 자리(칼 목표 — obiReady)에서 잼: 칼이 그 자리 곁이면 다 감쌈
    const R = obiReady(f, _mr, _dk);
    const L = SECRET.iaiObiFollow ?? { m: 0.06, deg: 20 };
    const dm = Ms.distanceTo(R.M);
    const da = Math.acos(Math.max(-1, Math.min(1, Ds.dot(R.D)))) / D2R;
    const over = Math.max(dm / L.m, da / L.deg);
    const w = sw * (over <= 1 ? 1 : Math.max(0, 2 - over)); // 한도 안 = 다 따름 · 한도 두 배에서 0
    if (w > 0) {
      out.pos.lerp(Ms, w);
      out.quat.slerp(ql, w);
      out.follow = w;
    }
    if (S) {
      S.fPos.copy(Ms);
      S.fQuat.copy(ql);
      S.fw = w;
      // 감싼 칼의 날 쪽(위 · 아래 — 칼 x 를 골반 위로 견줌)을 쉬는 칼집 날 쪽으로 (다 감쌌을 때만 · 0.5 넘게 기울 때만 바꿈)
      if (w >= 0.9) {
        const e = _ex.set(1, 0, 0).applyQuaternion(ql).dot(_x.copy(_UP).addScaledVector(Ds, -Ds.y).normalize());
        if (Math.abs(e) > 0.5) S.edge = e > 0 ? 1 : -1;
      }
    }
  }
  if (f.obiSaya) {
    _q0.copy(out.quat);
    out.ground = obiGround(f, out.pos, out.quat); // 땅 (넘어짐 · 죽음 — 누운 몸의 칼집이 땅으로 들지 않게 입을 축으로 눕힘)
    out.push = obiPush(f, out.pos, out.quat, _q0);
  }
  return out;
}

// 골반 · 배 · 가슴 상자 — 칼집 밀어냄: 기본 겉모습 그림 상자(fighter.js dressPart — 골반 0.21 × 0.18 × 0.33 · 배 0.22 × 0.155 × 0.32 + 허리띠 0.235 × 0.04 × 0.335)의 반 크기
//  (몸 상자 partDefs 골반 0.1 · 0.085 · 0.16 · 배 0.1 · 0.07 · 0.15 보다 0.5 ~ 1.75 cm 큼) + 겉 여유 SECRET.iaiObiSkin
const PELVIS_BOX = [0.105, 0.09, 0.165];
const ABDOMEN_BOX = [0.1175, 0.0775, 0.1675];
const CHEST_BOX = [0.12, 0.14, 0.185]; // 가슴 그림 상자 0.24 × 0.28 × 0.37 (몸 0.11 · 0.13 · 0.18) — 웅크려 숙인 가슴이 긴 칼집 위로 올 때
const _bc = new THREE.Vector3();
const _bq = new THREE.Quaternion();
const _bl = new THREE.Vector3();
const _bn = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _bp = new THREE.Vector3();
const _bs = new THREE.Vector3();
/** 상자(반 크기 h · 가운데 c · 회전 q — 골반 틀) 부호 거리 · 바깥 쪽 (골반 틀) */
function boxSd(p, c, q, h, nOut) {
  _bl.copy(p).sub(c).applyQuaternion(_bq.copy(q).invert());
  const qx = Math.abs(_bl.x) - h[0], qy = Math.abs(_bl.y) - h[1], qz = Math.abs(_bl.z) - h[2];
  const mx = Math.max(qx, qy, qz);
  if (mx > 0) {
    nOut.set(Math.max(qx, 0) * Math.sign(_bl.x), Math.max(qy, 0) * Math.sign(_bl.y), Math.max(qz, 0) * Math.sign(_bl.z));
    const o = nOut.length();
    nOut.multiplyScalar(1 / Math.max(1e-9, o)).applyQuaternion(q);
    return o;
  }
  if (mx === qx) nOut.set(Math.sign(_bl.x) || 1, 0, 0);
  else if (mx === qy) nOut.set(0, Math.sign(_bl.y) || 1, 0);
  else nOut.set(0, 0, Math.sign(_bl.z) || 1);
  nOut.applyQuaternion(q);
  return mx;
}
/**
 * 칼집을 골반 · 배 · 가슴 상자 · 허벅지 캡슐(그림 윗반 굵기 legR) 밖으로 (골반 틀 pos · quat 를 고침): 칼집 축 점(단면 줄 가운데 — 칼날 길이 18 칸을 다시 넷으로 · 끝 쇠까지)에서 그 쪽 단면 반지름(타원 — 날 쪽 반폭 · 면 쪽 반두께) + 겉 여유 SECRET.iaiObiSkin 만큼
 *  상자 안으로 든 가장 깊은 몫을 그 상자 바깥 쪽으로 옮김 (열 번까지). 배 상자는 지금 배 몸체 자리(골반 틀로). 옮긴 길이(m)를 돌려줌
 */
export function obiPush(f, pos, quat, quat0 = null) {
  const S = f.obiSaya;
  const skin = SECRET.iaiObiSkin ?? 0.006;
  const pr = f.bodies.pelvis.rotation();
  const pt = f.bodies.pelvis.translation();
  const qpi = _qs.set(pr.x, pr.y, pr.z, pr.w).invert();
  // 누운 몸(골반 위 축이 누움 — 넘어짐 · 죽음): 옷 두께 상자 · 허벅지 온 길이 굵기 · 정강이까지 (서 있을 땐 그림 상자 · 허벅지 윗반 그대로 — 쉬는 칼집 자리 그대로)
  const lie = !!SECRET.iaiObiDroop && lieOf(f) > 0.5 && !!S.garm;
  const boxes = [[_zero, _ident, lie ? S.garm.pelvis : PELVIS_BOX]];
  for (const [name, H0, C, Q] of [['abdomen', ABDOMEN_BOX, _ac, _aq], ['chest', CHEST_BOX, _cc, _cq]]) {
    const H = lie ? S.garm[name] ?? H0 : H0;
    const b = f.bodies[name];
    if (!b) continue;
    const at = b.translation();
    const ar = b.rotation();
    boxes.push([C.set(at.x - pt.x, at.y - pt.y, at.z - pt.z).applyQuaternion(qpi), Q.copy(qpi).multiply(_qw.set(ar.x, ar.y, ar.z, ar.w)), H]);
  }
  // 허벅지 캡슐 (축 = 허벅지 몸체 y · 반 길이 0.15 — fighter.js partDefs · 반지름 = 그림 윗반 반지름 legR) — 골반 틀
  const legs = [];
  for (const [name, A0, B0, hl] of [['thighF', _la, _lb, 0.15], ['thighB', _lc, _ld, 0.15], ['shinF', _le, _lf, 0.16], ['shinB', _lg, _lh, 0.16]]) {
    const b = f.bodies[name];
    if (!b) continue;
    const at = b.translation();
    const ar = b.rotation();
    const q = _lq.copy(qpi).multiply(_qw.set(ar.x, ar.y, ar.z, ar.w));
    const c = _lo.set(at.x - pt.x, at.y - pt.y, at.z - pt.z).applyQuaternion(qpi);
    A0.set(0, hl, 0).applyQuaternion(q).add(c);
    B0.set(0, -hl, 0).applyQuaternion(q).add(c);
    const r = name.startsWith('shin') ? S.shinR?.[name] ?? 0.05 : lie ? S.legRF?.[name] ?? S.legR?.[name] ?? 0.065 : S.legR?.[name] ?? 0.065;
    legs.push([A0, B0, r]);
  }
  // 땅 (골반 틀 — 위 방향 · 골반 원점의 땅 위 높이): 몸 상자에 밀려 땅으로 든 몫도 같은 셈으로 밀어냄 (평지 무대 0 · 지형 무대는 골반 아래 땅 높이)
  const ground = _gp;
  ground.up.set(0, 1, 0).applyQuaternion(qpi);
  ground.h = pt.y - (f.groundHeightAt?.(pt.x, pt.z) ?? 0);
  const solve = (g) => {
    let moved = 0;
    let worst = 0;
    for (let it = 0; it < 10; it++) {
      worst = sayaPen(S, pos, quat, boxes, legs, skin, _bs, g, lie ? S.skirt : null);
      if (worst <= 1e-5) break;
      pos.addScaledVector(_bs, worst + 0.001); // 1 mm 더 (골반 · 배 두 상자가 맞닿는 모서리에서 번갈아 밀리며 덜 빠지지 않게)
      moved += worst + 0.001;
    }
    return [moved, sayaPen(S, pos, quat, boxes, legs, skin, _bs, g, lie ? S.skirt : null)];
  };
  _po.copy(pos);
  _qs1.copy(quat);
  let [moved, left] = solve(ground);
  if (left <= 0.002) { S.turn = null; return moved; }
  const turnAt = (a) => {
    pos.copy(_po);
    quat.copy(quat0);
    obiGround(f, pos, quat, a, true);
    [moved, left] = solve(ground);
    return left <= 0.002;
  };
  if (quat0 && S.turn != null && turnAt(S.turn)) return moved; // 지난 스텝에 찾은 방향 그대로 (누워 있는 동안 같은 자리 — 셈 한 번)
  // 몸과 땅 사이에 끼임 (엎어지거나 왼쪽으로 누운 몸 — 배 앞 칼집 입이 몸 아래): 칼집을 골반 옆(칼집 쪽)으로 빼며 둘 다 비키는 자리를 찾음 (3 cm 씩 · 24 cm 까지)
  quat.copy(_qs1);
  _pl.set(0, 1, 0).applyQuaternion(quat).multiplyScalar(S.prof.len * 0.5).add(_po);
  const side = _pl.z < 0 ? -1 : 1;
  const ks = S.slideK ? [S.slideK, 1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8]; // 지난 스텝에 찾은 만큼부터
  // 뺄 쪽: 골반 옆(칼집 쪽) · 그래도 끼면(11/14 쉬는 칼집 입이 배 왼쪽 앞 모서리로 옮겨 — 왼쪽으로 누운 몸에서 칼집 입이 골반과 땅 사이에 낌) 배 앞 · 땅 위 쪽 · 둘 사이
  const dirs = [_sd0.set(0, 0, side), _sd1.set(1, 0, 0), _sd2.copy(ground.up), _sd3.set(1, 0, 0).add(ground.up).normalize()];
  const order = S.slideD ? [S.slideD, ...[0, 1, 2, 3].filter((i) => i !== S.slideD)] : [0, 1, 2, 3];
  for (const di of order) {
    for (const k of di === S.slideD || (!S.slideD && di === 0) ? ks : [1, 2, 3, 4, 5, 6, 7, 8]) {
      pos.copy(_po).addScaledVector(dirs[di], 0.03 * k);
      [moved, left] = solve(ground);
      if (left <= 0.002) { S.turn = null; S.slideK = k; S.slideD = di; return moved + 0.03 * k; }
    }
  }
  S.slideK = 0;
  S.slideD = 0;
  // 그래도 끼면(왼쪽으로 누운 몸 — 칼집 쪽이 땅): 칼집을 땅 위에 뉘인 채 수평 방향을 돌려 몸 밖 · 땅 위 자리를 찾음 (30° 씩 · 찾은 방향은 다음 스텝에 먼저)
  if (quat0) {
    for (const a of TURNS) {
      if (a === S.turn) continue;
      if (turnAt(a)) { S.turn = a; return moved; }
    }
  }
  S.turn = null;
  // 못 찾으면 몸을 먼저 — 땅 때문에 눕히기 전 칼집으로 되돌려 몸 밖으로만 (왼쪽으로 누운 몸: 칼집이 골반과 땅 사이 — 눕히면 골반을 지나고, 그대로면 몸 아래 땅으로 들어 몸에 가려짐)
  pos.copy(_po);
  if (quat0) quat.copy(quat0);
  return solve(null)[0];
}
const _q0 = new THREE.Quaternion();
const _qs1 = new THREE.Quaternion();
const TURNS = [30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
const _po = new THREE.Vector3();
const _pl = new THREE.Vector3();
const _sd0 = new THREE.Vector3();
const _sd1 = new THREE.Vector3();
const _sd2 = new THREE.Vector3();
const _sd3 = new THREE.Vector3();
/**
 * 칼집 겉(단면 줄 사이 넷 · 칼집 끝 쇠까지)이 몸 상자 · 허벅지 캡슐 안으로 가장 깊이 든 값 (m — 음수면 가장 가까운 틈) · nW = 그 곳 몸 바깥 쪽
 *  boxes = [[중심 · 돌림 · 반 크기]] · legs = [[축 끝 A · B · 반지름]] — 모두 골반 틀
 */
function sayaPen(S, pos, quat, boxes, legs, skin, nW, ground = null, skirt = null) {
  const R = S.prof.rows;
  _bx.set(1, 0, 0).applyQuaternion(quat);
  _bz.set(0, 0, 1).applyQuaternion(quat);
  let worst = -Infinity;
  nW.set(0, 0, 0);
  const SUB = 4; // 단면 줄 사이를 넷으로 (줄 간격 4 ~ 5 cm — 모서리를 비스듬히 지나는 곳을 놓치지 않게)
  for (let j = 0; j <= R.length * SUB; j++) {
    const i = Math.min(R.length - 1, Math.floor(j / SUB));
    const i2 = Math.min(R.length - 1, i + 1);
    const u = j / SUB - i;
    const a = R[i];
    const b = R[i2];
    const row = _row;
    row.cx = a.cx + (b.cx - a.cx) * u;
    row.hw = a.hw + (b.hw - a.hw) * u;
    row.ht = a.ht + (b.ht - a.ht) * u;
    const yy = Math.min(S.prof.len - 0.01, a.y + (b.y - a.y) * u - R[0].y + (j >= R.length * SUB ? S.prof.len - (R.at(-1).y - R[0].y) - 0.01 : 0)); // 마지막 = 끝 쇠(칼끝 너머 0.02 m)
    _bp.set(row.cx, yy, 0).applyQuaternion(quat).add(pos);
    for (const [c, q, h] of boxes) {
      const sd = boxSd(_bp, c, q, h, _bn);
      const rr = Math.hypot(row.hw * _bn.dot(_bx), row.ht * _bn.dot(_bz)) + skin;
      const pen = rr - sd;
      if (pen > worst) {
        worst = pen;
        nW.copy(_bn);
      }
    }
    for (const [A0, B0, LR] of legs) {
      _ls.subVectors(B0, A0);
      const v = Math.max(0, Math.min(1, _bn.subVectors(_bp, A0).dot(_ls) / Math.max(1e-9, _ls.lengthSq())));
      _bn.copy(A0).addScaledVector(_ls, v);
      _bn.subVectors(_bp, _bn);
      const d = _bn.length();
      if (d < 1e-6) continue;
      _bn.multiplyScalar(1 / d);
      const rr = Math.hypot(row.hw * _bn.dot(_bx), row.ht * _bn.dot(_bz)) + skin;
      const pen = rr + LR - d;
      if (pen > worst) {
        worst = pen;
        nW.copy(_bn);
      }
    }
    if (skirt && _bp.y < skirt.top && _bp.y > skirt.bot) {
      // 옷 자락 (누운 몸만 — skirtProfile): 그 높이 띠의 타원 기둥 밖으로 (가로로)
      const k = Math.max(0, Math.min(skirt.rx.length - 1, Math.floor(((skirt.top - _bp.y) / (skirt.top - skirt.bot)) * skirt.rx.length)));
      const ax = skirt.rx[k], az = skirt.rz[k];
      const e = Math.hypot(_bp.x / ax, _bp.z / az);
      if (e > 1e-6) {
        _bn.set(_bp.x / (ax * ax), 0, _bp.z / (az * az)).normalize();
        const rr = Math.hypot(row.hw * _bn.dot(_bx), row.ht * _bn.dot(_bz)) + skin;
        const pen = rr - (e - 1) * Math.min(ax, az);
        if (pen > worst) {
          worst = pen;
          nW.copy(_bn);
        }
      }
    }
    if (ground) {
      const rr = Math.hypot(row.hw * ground.up.dot(_bx), row.ht * ground.up.dot(_bz)) + skin;
      const pen = rr - (ground.h + _bp.dot(ground.up));
      if (pen > worst) {
        worst = pen;
        nW.copy(ground.up);
      }
    }
  }
  return worst;
}
const _gp = { up: new THREE.Vector3(), h: 0 };
/**
 * 땅 (11/14 — 넘어짐 · 죽음): 칼집은 골반 틀에 붙어 있어 누운 몸(위를 보고 누움)에서는 뒤 아래로 뻗은 칼집이 땅으로 듦(우치가타나 6 cm · 모노호시자오 64 cm — 첫 재기).
 *  칼집 끝(鐺)이 땅 위 (단면 반지름 + 겉 여유)에 오도록 칼집을 입을 축으로 돌려 눕힘 — 수평 방향(어디로 뻗나)은 그대로 · 아래로 기운 몫만 줄임.
 *  그림만 · 땅 높이는 몸이 쓰는 그대로(fighter.groundHeightAt — 평지 무대 0). 남은 작은 몫은 obiPush 가 땅 위로 밀어냄. 돌린 각(도)을 돌려줌
 */
function obiGround(f, pos, quat, turn = 0, force = false) {
  const S = f.obiSaya;
  if (!S) return 0;
  const R = S.prof.rows;
  S.gR ??= Math.max(...R.map((r) => Math.abs(r.cx) + Math.max(r.hw, r.ht)));
  const pr = f.bodies.pelvis.rotation();
  const pt = f.bodies.pelvis.translation();
  const qp = _gq.set(pr.x, pr.y, pr.z, pr.w);
  const Dl = _gl.set(0, 1, 0).applyQuaternion(quat);
  const D = _gd.copy(Dl).applyQuaternion(qp);
  const M = _gm.copy(pos).applyQuaternion(qp).add(_gt.set(pt.x, pt.y, pt.z));
  const L = S.prof.len;
  const gy = Math.max(f.groundHeightAt?.(M.x, M.z) ?? 0, f.groundHeightAt?.(M.x + D.x * L, M.z + D.z * L) ?? 0);
  const need = (S.gR + (SECRET.iaiObiSkin ?? 0.006) + gy - M.y) / L; // 칼집 끝이 땅 위에 남는 가장 작은 위 성분
  // 처짐 (11/14 — SECRET.iaiObiDroop): 누운 몸(골반 위 축 y 0.5 → 0.2)에서 칼집이 위로 서면(칼 끝 쪽이 하늘로 — 칼집 쪽이 위인 옆으로 누운 몸) 띠에 낀 칼집이 제 무게로 처져
  //  누운 몫만큼 수평까지 내림 — 몸 위(엉덩이 · 허벅지 겉)에 얹힘. 이미 수평 아래면 그대로(땅 셈이 맡음)
  const lie = SECRET.iaiObiDroop ? lieOf(f) : 0;
  const yD = D.y > 0 ? D.y * (1 - lie) : D.y;
  if (D.y >= need && !force && lie <= 0) return 0;
  const yN = Math.min(0.9, Math.max(need, force ? Math.min(yD, 0.9) : yD));
  if (!force && Math.abs(yN - D.y) < 1e-4) return 0;
  let h = Math.hypot(D.x, D.z);
  if (h < 1e-4) { D.set(0, 0, -1).applyQuaternion(qp); D.y = 0; h = Math.hypot(D.x, D.z) || 1; } // 곧장 아래면 골반 왼쪽으로 눕힘
  if (turn) D.applyAxisAngle(_UP, turn * D2R); // 수평 방향을 돌림 (obiPush — 몸과 땅 사이에 끼었을 때 땅 위로 뉘일 쪽 찾기)
  const c = Math.sqrt(1 - yN * yN) / h;
  const Dn = _gn.set(D.x * c, yN, D.z * c).applyQuaternion(qp.invert()); // 골반 틀
  const ang = Dl.angleTo(Dn);
  quat.premultiply(_gf.setFromUnitVectors(Dl, Dn));
  return ang / D2R;
}
const _gq = new THREE.Quaternion();
const _gf = new THREE.Quaternion();
const _gl = new THREE.Vector3();
const _gd = new THREE.Vector3();
const _gm = new THREE.Vector3();
const _gt = new THREE.Vector3();
const _gn = new THREE.Vector3();
const _zero = new THREE.Vector3();
const _row = { cx: 0, hw: 0, ht: 0 };
const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
const _lc = new THREE.Vector3();
const _ld = new THREE.Vector3();
const _le = new THREE.Vector3();
const _lf = new THREE.Vector3();
const _lg = new THREE.Vector3();
const _lh = new THREE.Vector3();
const _lq = new THREE.Quaternion();
const _lo = new THREE.Vector3();
const _ls = new THREE.Vector3();
const _ident = new THREE.Quaternion();
const _ac = new THREE.Vector3();
const _aq = new THREE.Quaternion();
const _cc = new THREE.Vector3();
const _cq = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _ql = new THREE.Quaternion();
const _ms = new THREE.Vector3();
const _ds = new THREE.Vector3();
const _dk = new THREE.Vector3();
const _mr = new THREE.Vector3();
const _ex = new THREE.Vector3();
const _qr = new THREE.Quaternion();

/** 누운 몫 (0 = 섬 · 1 = 누움): 골반 위 축의 세계 위 성분 0.5 → 0.2 (넘어짐 · 죽음 — 그림만) */
export function lieOf(f) {
  const r = f.bodies?.pelvis?.rotation();
  if (!r) return 0;
  const upY = 1 - 2 * (r.x * r.x + r.z * r.z); // 골반 y 축의 세계 y
  return Math.min(1, Math.max(0, (0.5 - upY) / 0.3));
}

/**
 * ③ 날 위 (11/14 사장님 '칼날 방향 원전대로 — 대기 때 날이 위' · SECRET.iaiObiEdge — 그림만): 칼 그림을 칼 축 둘레로 돌려 발도 대기 동안 외날(칼 +x — weapon_looks bladeGeometry)이
 *  칼 축에 수직인 위로. 일본 칼 넷의 콜라이더는 칼 축 위 상자 · 공 · 캡슐(fighter.js parts — partCollider 없음)이라 칼 축 둘레 반 바퀴에 같은 꼴 → 물리 · 판정 · 뽑는 길 그대로.
 *  (물리 칼을 굴려 날을 위로 하면 사람 손목 굴림 80° · 어깨 면 한도로 칼이 대기 자리에서 16 ~ 70 cm 벗어남 — 기록 §3)
 *  대기 몫(iaiObiW)만큼 · 대기에서 낸 발도는 칼이 칼집을 떠나는 몫(길 N.at — 없으면 M 까지 0.5)에 걸쳐 0 으로(뽑으며 날이 돌아 섬 — 抜き付け) ·
 *  대기가 풀리면 iaiRegrip 초에 반 바퀴 빠르기로 0 으로(사람이 칼을 쥐어 대기 몫이 한 스텝에 0 이 되어도 튀지 않게 · 새 시간 값 없음). 돌린 각(rad — 칼 y 둘레)
 */
export function obiEdgeRoll(f) {
  const E = (f.obiEdge ??= { roll: 0, roll0: 0, iai: null, t: null });
  const now = f.stamina?.time ?? 0;
  const dt = E.t != null ? Math.max(0, now - E.t) : 0;
  E.t = now;
  if (!SECRET.iaiObiEdge || !obiOn(f) || !f.sword || !f.armed) return (E.roll = 0);
  const I = f.iai;
  if (I && I.kind === 'iai') {
    if (E.iai !== I) { E.iai = I; E.roll0 = E.roll; }
    const end = I.K?.N?.at ?? 0.5;
    const u = Math.min(1, Math.max(0, (I.u ?? 0) / Math.max(1e-3, end)));
    return (E.roll = E.roll0 * (1 - u * u * (3 - 2 * u)));
  }
  E.iai = null;
  const busy = !!f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0;
  const w = busy ? 0 : Math.max(f.iaiObiW ?? 0, f.noto?.w > 0 ? f.noto.edge : 0); // 11/14 납도: 앞 몫 동안 날을 위로 (원전 納刀 — 칼등을 칼집 입에 얹음)
  let target = 0;
  if (w > 0) {
    const r = f.sword.rotation();
    const q = _qe.set(r.x, r.y, r.z, r.w);
    const b = _eb.set(0, 1, 0).applyQuaternion(q);
    const e = _ee.set(1, 0, 0).applyQuaternion(q);
    const u = _eu.set(0, 1, 0).addScaledVector(b, -b.y);
    if (u.lengthSq() > 1e-4) {
      u.normalize();
      let phi = Math.atan2(_ec.crossVectors(e, u).dot(b), e.dot(u)); // 물리 날 → 위 (칼 축 둘레)
      if (Math.abs(phi) > 0.8 * Math.PI && E.roll !== 0 && Math.sign(phi) !== Math.sign(E.roll)) phi += Math.sign(E.roll) * 2 * Math.PI; // 반 바퀴 곁에서 돌 쪽이 뒤바뀌지 않게
      target = phi * w;
    }
  }
  const rate = Math.PI / Math.max(1e-3, SECRET.iaiRegrip || 0.2); // 반 바퀴 / iaiRegrip 초
  const d = target - E.roll;
  E.roll = Math.abs(d) <= rate * dt || dt <= 0 && w > 0 ? target : E.roll + Math.sign(d) * rate * dt;
  return E.roll;
}
const _qe = new THREE.Quaternion();
const _eb = new THREE.Vector3();
const _ee = new THREE.Vector3();
const _eu = new THREE.Vector3();
const _ec = new THREE.Vector3();
/** 그릴 때마다 (fighter.js syncMeshes — 무기 그림 자리를 놓은 뒤): 칼 그림을 날 위로 돌림 (obiEdgeRoll) */
export function syncObiEdge(f) {
  const roll = obiEdgeRoll(f);
  if (roll && f.swordGroup) f.swordGroup.quaternion.multiply(_qr.setFromAxisAngle(_UP, roll));
}

const _pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), follow: 0, k: 0 };
/** 그릴 때마다 (fighter.js syncMeshes — 그림만): 칼집 그룹을 골반 그림 그룹 안 자리로 · 사게오 */
export function syncObiSaya(f) {
  const S = f.obiSaya;
  if (!S) return;
  const P = obiSayaPose(f, _pose);
  S.g.position.copy(P.pos);
  S.g.quaternion.copy(P.quat);
  if (S.cord) syncSageo(f, S, P);
}

/**
 * 사게오 끈 (그림만): 栗形 K(지금 칼집) ↔ 허리띠 매는 자리 A(붙일 때 쉬는 칼집 栗形을 골반 그림 상자 겉으로 · 골반 틀 고정) — 두 끝 사이 거리 d 가 끈 길이 Lr 보다 짧으면
 *  가운데가 땅 쪽(골반 틀로 옮긴 세계 아래 — 끈 줄에 수직)으로 √(Lr² − d²)/2 처짐 (두 곧은 반쪽의 V) · 두 끝과 처진 가운데를 지나는 2차 곡선 · 점마다 골반 · 배 · 허벅지 밖으로
 */
export function sageoPoints(f, S, P, out) {
  const C = S.cord;
  if (!C.A) {
    // 매는 자리 = 쉬는 칼집 栗形 과 대기 칼집(대기 칼 자리) 栗形 사이(대기 쪽 6 할)를 허리띠 겉으로 (11/14 쉬는 칼집이 왼 허리 앞 모서리로 옮겨 대기 칼집과 멀어짐 — 두 자리 모두 끈 길이 안 · 처짐)
    obiRest(f, _M0, _D0);
    frameQ(_D0, _qa, S.edge);
    const K0 = _sg1.copy(S.knob).applyQuaternion(_qa).add(_M0);
    obiReady(f, _M1, _D1);
    frameQ(_D1, _qb, S.edge);
    K0.multiplyScalar(0.4).addScaledVector(_sg4.copy(S.knob).applyQuaternion(_qb).add(_M1), 0.6); // 대기 쪽으로 6 할 (대기 · 낮은 걸음 동안 칼집이 대기 칼을 감싸 더 벌어짐)
    const H = S.garm?.pelvis ?? PELVIS_BOX; // 허리띠 · 옷 겉 (옷 두께 상자)
    const c = _sg2.set(Math.max(-H[0], Math.min(H[0], K0.x)), Math.max(-H[1], Math.min(H[1], K0.y)), Math.max(-H[2], Math.min(H[2], K0.z)));
    const n = _sg3.subVectors(K0, c);
    C.A = n.lengthSq() > 1e-8 ? c.addScaledVector(n.normalize(), SAGEO.r + 0.003).clone() : K0.clone();
  }
  const K = _sg1.copy(S.knob).applyQuaternion(P.quat).add(P.pos);
  const A = C.A;
  const d = K.distanceTo(A);
  const sag = d < SAGEO.len ? Math.sqrt(SAGEO.len * SAGEO.len - d * d) / 2 : 0;
  const pr = f.bodies.pelvis.rotation();
  const down = _sg2.set(0, -1, 0).applyQuaternion(_sgq.set(pr.x, pr.y, pr.z, pr.w).invert());
  const ln = _sg3.subVectors(K, A);
  if (ln.lengthSq() > 1e-8) down.addScaledVector(ln.normalize(), -down.dot(ln));
  if (down.lengthSq() < 1e-8) down.set(0, -1, 0);
  down.normalize();
  const mid = _sg4.addVectors(A, K).multiplyScalar(0.5).addScaledVector(down, 2 * sag); // 2차 곡선 조절점 (t 0.5 에서 처짐 sag)
  const n = out.length;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = (1 - t) * (1 - t), b = 2 * t * (1 - t), c = t * t;
    out[i].set(a * A.x + b * mid.x + c * K.x, a * A.y + b * mid.y + c * K.y, a * A.z + b * mid.z + c * K.z);
  }
  // 몸 밖으로 (골반 · 배 옷 두께 상자 · 허벅지 캡슐(옷 굵기) — 끈 반지름 + 0.002 · 네 번)
  const pt = f.bodies.pelvis.translation();
  const qpi = _sgq.set(pr.x, pr.y, pr.z, pr.w).invert();
  const ab = f.bodies.abdomen;
  const abC = ab ? _sg5.set(ab.translation().x - pt.x, ab.translation().y - pt.y, ab.translation().z - pt.z).applyQuaternion(qpi) : null;
  const abQ = ab ? _sgq2.copy(qpi).multiply(_qw.set(ab.rotation().x, ab.rotation().y, ab.rotation().z, ab.rotation().w)) : null;
  const HP = S.garm?.pelvis ?? PELVIS_BOX;
  const HA = S.garm?.abdomen ?? ABDOMEN_BOX;
  const legs = [];
  for (const [name, A0, B0] of [['thighF', _la, _lb], ['thighB', _lc, _ld]]) {
    const b = f.bodies[name];
    if (!b) continue;
    const q = _lq.copy(qpi).multiply(_qw.set(b.rotation().x, b.rotation().y, b.rotation().z, b.rotation().w));
    const c = _lo.set(b.translation().x - pt.x, b.translation().y - pt.y, b.translation().z - pt.z).applyQuaternion(qpi);
    legs.push([A0.set(0, 0.15, 0).applyQuaternion(q).add(c), B0.set(0, -0.15, 0).applyQuaternion(q).add(c), S.legR?.[name] ?? 0.065]);
  }
  const rr = SAGEO.r + 0.002;
  // 땅 (누운 몸 — 끈이 땅으로 들지 않게): 골반 틀 위 방향 · 골반 원점의 땅 위 높이 (obiPush 와 같은 셈)
  const gUp = _sg6.set(0, 1, 0).applyQuaternion(qpi);
  const gH = pt.y - (f.groundHeightAt?.(pt.x, pt.z) ?? 0);
  for (let i = 1; i < n - 1; i++) {
    const p = out[i];
    for (let it = 0; it < 4; it++) {
      let sd = boxSd(p, _zero, _ident, HP, _bn);
      if (sd < rr) p.addScaledVector(_bn, rr - sd);
      if (abC) { sd = boxSd(p, abC, abQ, HA, _bn); if (sd < rr) p.addScaledVector(_bn, rr - sd); }
      for (const [A0, B0, R] of legs) {
        _ls.subVectors(B0, A0);
        const v = Math.max(0, Math.min(1, _sg3.subVectors(p, A0).dot(_ls) / Math.max(1e-9, _ls.lengthSq())));
        const d = _sg3.copy(A0).addScaledVector(_ls, v).sub(p).negate();
        const dl = d.length();
        if (dl > 1e-6 && dl < R + rr) p.addScaledVector(d, (R + rr - dl) / dl);
      }
      const gh = gH + p.dot(gUp); // 땅 위로 (마지막 — 몸에 밀린 몫도)
      if (gh < rr) p.addScaledVector(gUp, rr - gh);
    }
  }
  return out;
}
function syncSageo(f, S, P) {
  const C = S.cord;
  const pts = sageoPoints(f, S, P, C.pts);
  const pos = C.geo.attributes.position.array;
  const nor = C.geo.attributes.normal.array;
  const sides = SAGEO.sides;
  const r = SAGEO.r;
  for (let i = 0; i < pts.length; i++) {
    const t = _sg1.subVectors(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)]);
    if (t.lengthSq() < 1e-10) t.set(0, 1, 0);
    t.normalize();
    const ref = Math.abs(t.y) < 0.9 ? _sg2.set(0, 1, 0) : _sg2.set(1, 0, 0);
    const nx = _sg3.crossVectors(t, ref).normalize();
    const ny = _sg4.crossVectors(t, nx);
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      const cx = Math.cos(a), cy = Math.sin(a);
      const k = (i * sides + j) * 3;
      const ox = nx.x * cx + ny.x * cy, oy = nx.y * cx + ny.y * cy, oz = nx.z * cx + ny.z * cy;
      pos[k] = pts[i].x + ox * r;
      pos[k + 1] = pts[i].y + oy * r;
      pos[k + 2] = pts[i].z + oz * r;
      nor[k] = ox;
      nor[k + 1] = oy;
      nor[k + 2] = oz;
    }
  }
  C.geo.attributes.position.needsUpdate = true;
  C.geo.attributes.normal.needsUpdate = true;
}
const _sg1 = new THREE.Vector3();
const _sg2 = new THREE.Vector3();
const _sg3 = new THREE.Vector3();
const _sg4 = new THREE.Vector3();
const _sg5 = new THREE.Vector3();
const _sg6 = new THREE.Vector3();
const _sgq = new THREE.Quaternion();
const _sgq2 = new THREE.Quaternion();
