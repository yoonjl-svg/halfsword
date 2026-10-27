// ─────────────────────────────────────────────────────────────
//  독일 비기 '죽음의 일격 (모르트슐라크 · Mordschlag)' — 사람 먼저 (사장님 10/22 저녁 — docs/strike/german_mordschlag_2026-10-22.md)
//   조건 (secret.js PlayerSecretWatch · when 'press'): 밀치기 누르기(fighter.barge phase 'press')가 SECRET.mordPress(10/25 23:1x 2 s · 끊겨도 mordGrace 0.4 s(10/27 21:4x) 안에 다시 누르면 이어 셈) 이어지면
//    창(SECRET.playerWindow 0.6 s · 금색 '!' — 고노센과 같은 창 · 표시) — 그 안의 공격 입력 하나가 죽음의 일격.
//   동작: 다른 비기와 같은 길 틀(skill.js secret — 준비 chamber → 베기 길 strike → 따라 지나감 follow → 굳음 stiff)에 칸 셋을 더한다.
//    판 'reverse'(기본): ① 쥠 바꿈 — 공격 입력 스텝에 칼날을 거꾸로 쥔다(fighter.reverseGrip — 두 손이 칼날 가운데쯤, 칼자루가 위, 칼끝이 손 아래)
//     ② 준비 — 겨눔을 뒤집어(fighter.mordAim) 손이 기술의 시작 자세(지붕 — SECRET.mord.tech 의 from)로 가는 동안 칼자루가 선다
//     ③ 내리치기 — 칼자루가 칼날이 가던 길로 휘둘린다(손목 · 팔 · 빈손은 보통 베기와 같은 꼴) — 코등이 · 폼멜이 머리로
//     ④ 다시 세우기(stage 'mordBack') — 손을 시작 자세로 되돌려(실제 손이 들 때까지 · 0.6 s 까지) 칼자루를 세운 뒤 원래 쥠으로(칼끝을 곧게 위로 — mordEnd) → 굳음
//    판 'hilt'(가장 가까운 판 · `?mordGrip=hilt` · 칼날을 잡을 수 없는 칼은 늘): 쥠 그대로 겨눔만 뒤집어 폼멜(칼자루 끝)이 같은 길로 — 지레가 손에서 폼멜까지(롱소드 0.12 m)뿐.
//   결과: 판정은 지금 규칙 그대로 — 코등이 · 폼멜은 칼자루 부품이라 둔타(combat.js analyze), 머리 둔타는 의식 · 멍함 · 주저앉음 · 쓰러짐(fighter.applyWound) ·
//    비기 배율(손 빠르기 SECRET.handSpeed · 서보 힘 창 SECRET.power · 판정 배율 SECRET.hitMul — 다른 비기의 베기 길과 같은 자리)만 곱한다. 새 힘 · 새 넘어뜨리기 · 새 문턱 없음.
//    넘어 들어감 규칙(SECRET.mordOver — 내리치는 동안 내 칼 ↔ 상대 칼 충돌 끔)은 스위치 · 기본 끔(사장님 확인 전).
//   10/24 사장님 12:0x 'ai도 비기 쓰게 해' — AI 도 같은 조건 · 같은 실행부(ai.js mordTick → skill.secret · SECRET.aiOpenSchools 'german' · 숙련도 5 이상).
//    AI 는 창 안에서 상대 머리가 칼자루 길에 닿을 때(mordHeadReach — 아래) 곧장 낸다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, ARM } from './config.js';
import { FINISH } from './finish.js';
import { comboArmLen } from './secret_instant.js';

/** 이 몸의 판: 'reverse'(칼날을 거꾸로 쥠) | 'hilt'(쥠 그대로 폼멜) — 칼날을 잡을 수 없는 칼(날 없는 무기 · 라이트세이버 · 부러진 칼)은 늘 'hilt' */
export function mordMode(f) {
  const W = f.weaponCfg;
  if (SECRET.mord.grip === 'hilt' || !W?.edged || W.ignoreArmor || f.weaponBroken) return 'hilt';
  return 'reverse';
}

/** 거꾸로 쥔 자리 (칼 축 y, m): 칼 든 손 g(칼날 위 SECRET.mord.at 몫) · 빈손 gOff(칼 든 손보다 칼끝 쪽 |gripAlong| — 한손 칼은 같은 자리) */
export function mordGripOf(f) {
  const W = f.weaponCfg;
  const g = W.hiltLength + W.bladeLength * SECRET.mord.at;
  return { g, gOff: g - (W.twoHand ? W.gripAlong ?? -0.14 : 0) };
}

/** 이 비기가 휘두르는 기술 (꾸러미의 기본 동작 — SECRET.mord.tech, 없으면 정수리 베기) */
export function mordTech(byName) {
  const t = byName?.[SECRET.mord.tech] ?? byName?.oberhau;
  return t ? { ...t, mord: true } : null;
}

/**
 * 시작 (skill.js secret — 공격 입력이 들어온 그 스텝): 'reverse' 판은 곧장 칼날을 거꾸로 쥔다 — 칼자루를 위로(칼끝은 손 아래), 칼 면은 아래팔 경첩 축 쪽
 *  (fighter.reverseGrip). 붙어 밀던 칼은 상대 쪽으로 누워 있어 그대로 뒤집으면 칼자루가 상대 몸 속으로 옮겨 가니 '위'로 세워 쥔다.
 *  두 판 모두 지금부터 겨눔을 뒤집어(mordAim) 준비 동안 칼자루가 기술의 시작 자세(지붕) 쪽으로 선다. 거꾸로 쥐지 못하면(칼을 놓침 등) false
 */
export function mordStart(f, run, tech) {
  const mode = mordMode(f);
  const m = (run.mord = { mode, G: mode === 'reverse' ? mordGripOf(f) : null, flipped: false, overOn: false });
  if (mode === 'reverse') {
    m.flipped = f.reverseGrip(m.G, DOWN);
    if (!m.flipped) return false;
  }
  f.mordAim = true;
  const d = f.strokeCommand(tech.from[0], tech.from[1], _h, _d); // 시작 자세 패드의 칼끝 겨눔 (몸 틀) — 준비 동안 칼자루가 이쪽으로 선다
  f.mordHold = [d.x, d.y, d.z];
  return true;
}
const _h = new THREE.Vector3();
const _d = new THREE.Vector3();
const DOWN = { x: 0, y: -1, z: 0 };

/** 준비가 끝났나 (skill.js chamber): 실제 손목이 손 목표(fighter.handTarget — 시작 자세)에서 SECRET.mord.ready m 안 */
export function mordReady(f) {
  const fa = f.bodies.farmS;
  const r = fa.rotation();
  const t = fa.translation();
  // 손목 = 아래팔 (0.13, 0, 0)
  const x = 2 * (r.x * r.y + r.w * r.z), y = 2 * (r.x * r.z - r.w * r.y), xx = 1 - 2 * (r.y * r.y + r.z * r.z);
  const wx = t.x + 0.13 * xx, wy = t.y + 0.13 * x, wz = t.z + 0.13 * y;
  const h = f.handTarget;
  return Math.hypot(wx - h.x, wy - h.y, wz - h.z) < SECRET.mord.ready;
}

/**
 * 칼자루가 아직 휘둘리는 중인가 (skill.js follow — 다른 비기는 칼끝 빠르기 < 6 m/s 로 '칼이 지나감'을 본다): 거꾸로 쥐면 칼끝은 손 뒤 꼬리라 느리다 →
 *  코등이 빠르기를 같은 6 m/s 에 (손 ~ 코등이 지레 ÷ 원래 쥠의 손 ~ 칼끝 거리) 를 곱한 문턱과 견준다 (새 값 없음 — 같은 각속도). 'hilt' 판은 폼멜까지 지레
 */
export function mordSwinging(f) {
  const W = f.weaponCfg;
  const m = f.mordGrip;
  const lever = m ? m.g - W.hiltLength : 0.12;
  const sw = f.sword;
  const r = sw.rotation();
  const t = sw.translation();
  const y = m ? W.hiltLength : -0.12; // 코등이 (거꾸로) · 폼멜 (쥠 그대로) — 칼 원점 기준 칼 축
  const p = { x: t.x + y * 2 * (r.x * r.y - r.w * r.z), y: t.y + y * (1 - 2 * (r.x * r.x + r.z * r.z)), z: t.z + y * 2 * (r.y * r.z + r.w * r.x) };
  const v = sw.velocityAtPoint(p);
  return Math.hypot(v.x, v.y, v.z) >= (6 * lever) / (W.hiltLength + W.bladeLength);
}

/** 매 스텝 (skill.js updateSecret 머리): 넘어 들어감 규칙 창 — 베기 길 · 따라 지나감 동안만 */
export function mordStep(f, run) {
  if (run.stage !== 'chamber') f.mordHold = null; // 베기 길부터는 패드(길)의 겨눔을 뒤집어 따른다
  const on = !!SECRET.mordOver && (run.stage === 'strike' || run.stage === 'follow');
  if (on !== run.mord.overOn) {
    over(f, on);
    run.mord.overOn = on;
  }
}

/**
 * 넘어 들어감 규칙 (SECRET.mordOver — 사장님 확인 전 · 기본 끔): on 이면 내 칼 부품(칼날 · 칼자루) 충돌 짝에서 상대 칼을 뺀다(충돌 그룹 거름의 '상대 칼' 비트만) —
 *  상대가 칼을 들어 막아도 내 칼자루가 그 칼 위로 지나 머리에 떨어진다. 몸 · 팔 · 땅 · 제 몸통은 그대로. off 면 원래 그룹으로
 */
function over(f, on) {
  const cols = f.swordColliders ?? [];
  if (on && !f._mordGroups) {
    f._mordGroups = cols.map((c) => c.collisionGroups());
    const wBit = (f.index ?? 0) === 0 ? 16 : 4; // 상대 칼 비트 (fighter.js weaponBit(1 − index) — 0 번 몸 4 · 1 번 몸 16)
    for (const c of cols) c.setCollisionGroups(c.collisionGroups() & ~wBit);
  } else if (!on && f._mordGroups) {
    cols.forEach((c, i) => c.setCollisionGroups(f._mordGroups[i]));
    f._mordGroups = null;
  }
}

/** 끝 · 끊김: 원래 쥠 · 겨눔 · 충돌 그룹으로 (skill.js — 굳음에 들어갈 때 · secretEnd). 이미 원래면 아무것도 안 함 */
export function mordEnd(f) {
  over(f, false);
  // 칼끝을 곧게 위로 (다시 세우기 끝은 칼자루가 대개 위라 거의 같은 줄 · 손이 늦거나 끊겼을 때도 칼날이 상대 몸 · 땅 속으로 옮겨 가지 않게)
  if (f.mordGrip) f.reverseGrip(null, UP);
  f.mordAim = false;
  f.mordHold = null;
}
const UP = { x: 0, y: 1, z: 0 };

// ── 가볍고 느림을 고칠 안 (10/22 밤 감독 — 스위치 · 기본 끔 · 문서 §11) ──

/** 판정 배율 (SECRET.mord.power): 'hit' = 결정타 SECRET.hitMul · 'finish' = 마무리 찍기 FINISH.power (겹치지 않고 그 자리에) · 수 = 그 수. 둔타도 듣는 자리(f.secretHit — combat.js hk) */
export function mordHitMul() {
  const v = SECRET.mord.power;
  return v === 'finish' ? FINISH.power : v === 'hit' || v == null ? SECRET.hitMul : +v || SECRET.hitMul;
}

/**
 * 운동학 길(SECRET.mord.kin)의 칼 자리 (칼 축 m · 칼 든 손 기준): g = 칼 든 손이 쥔 칼 축 자리(쥠 그대로 'hilt' 판은 0) · gOff = 빈손 ·
 *  Lc = 손 → 코등이(칼날 시작 hiltLength) · Lp = 손 → 칼자루 끝(칼자루 부품 가운데 가장 아래 끝 — 폼멜 공 밑) · 치는 쪽 = 칼 축 −y (겨눔 뒤집기와 같음).
 *  end = 끝날 때 원래 쥠으로 (secret_instant.js endCombo 가 부름 — 굳음 붙잡기 전에)
 */
export function mordKinOf(f, run) {
  const W = f.weaponCfg;
  const G = run.mord.G ?? { g: 0, gOff: W.twoHand ? W.gripAlong ?? -0.14 : 0 };
  let yp = 0;
  for (const c of f.swordColliders ?? []) {
    if (f.colliderInfo?.get(c.handle)?.part !== 'hilt') continue;
    const y = c.translationWrtParent().y;
    const t = c.shapeType();
    const h = t === 0 ? c.radius() : t === 1 ? c.halfExtents().y : 0; // 공(ball) · 상자(cuboid)
    yp = Math.min(yp, y - h);
  }
  return { g: G.g, gOff: G.gOff, Lc: G.g - W.hiltLength, Lp: G.g - yp, pull: SECRET.mord.aim === 'pull', over: !!SECRET.mordOver, end: mordEnd };
}

/**
 * 상대 머리가 칼자루 길에 닿나 (10/24 — AI 가 창 안에서 낼 때 · ai.js mordTick): 운동학 길의 머리 겨눔('pull' — secret_instant.js comboPlanMord)은 칼자루 가운데
 *  (손에서 (Lc + Lp) / 2 — mordKinOf)가 상대 머리 가운데를 지나게 손 길을 옮기고, 손은 팔이 닿는 데까지만 간다(comboArmLen). 그래서 내 칼 어깨에서 상대 머리 가운데까지가
 *  팔 길이 + 손 → 칼자루 가운데 안이면 그 동작이 머리를 칠 수 있다. 새 값 없음(동작이 쓰는 길이 그대로). 쥔 자리는 이 몸의 판(mordMode — 거꾸로 쥠 · 쥠 그대로)으로
 */
export function mordHeadReach(f) {
  const head = f.foe?.bodies?.head;
  if (!head || !f.weaponCfg) return false;
  const K = mordKinOf(f, { mord: { G: mordMode(f) === 'reverse' ? mordGripOf(f) : null } });
  const q = f.bodies.chest.rotation();
  const S = _s.set(ARM.shoulder[0], ARM.shoulder[1], f.side * ARM.shoulder[2]).applyQuaternion(_q.set(q.x, q.y, q.z, q.w)).add(f.bodies.chest.translation());
  const h = head.translation();
  return Math.hypot(h.x - S.x, h.y - S.y, h.z - S.z) <= comboArmLen() + (K.Lc + K.Lp) / 2;
}
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
