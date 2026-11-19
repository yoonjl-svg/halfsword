// ─────────────────────────────────────────────────────────────
//  충돌 부류 · 제 몸 닿음 (11/20 — 한 판 넷 제한 걷음: 사장님 11/20 '이딴 규칙은 없애' · 기록 docs/strike/many_fighters_2026-11-20.md)
//
//  예전(10/29 ~ 11/19)에는 싸움꾼(자리)마다 몸 · 칼 · 몸통 · 칼팔 비트를 따로 두어 '제 몸끼리만 지나감'을 충돌 그룹이 정했다 —
//   16 비트를 다 써서 한 판에 넷까지였다.
//  이제 충돌 그룹은 부류 다섯만 둔다 (싸움꾼마다 비트 없음 — 몇 명이든 같은 값):
//   땅 1 · 몸 2 · 칼 4 · 날아간 투구 32(땅하고만) · 발 64
//   몸 ↔ 몸 · 몸 ↔ 칼 · 칼 ↔ 칼 · 칼 ↔ 발 · 모두 ↔ 땅은 부딪히고, 발 ↔ 몸 · 발 ↔ 발은 지나간다 — 예전 비트의 '남과는' 규칙 그대로.
//  같은 싸움꾼의 쌍은 물리 걸이(Rapier filterContactPair — combat.js · 전투가 없는 도구는 selfHooks)가 버린다.
//   남기는 것은 둘뿐 (사람 관절 한도 — 예전 torsoBit · armSBit 의 몫): 제 칼 ↔ 제 몸통(골반 · 배 · 가슴 · 허벅지) · 제 칼팔(위팔 · 아래팔) ↔ 제 몸통.
//  콜라이더마다 colliderInfo.self 에 제 몸 부류(SELF)를 적는다 — 그 밖의 부위 · 발 · 휘는 덩굴 마디(druid_whip.js — 제 몸통에 감기지 않게, 예전 & ~ownTorsoBit)는 0.
//  같은 판정을 엔진 안(걸이)과 밖(줍기 겹침 물음 pickup.js · 시험)이 같은 함수(pairAllowed)로 본다.
//  바이트 같음: 엔진(Rapier 0.30.1)은 충돌 그룹을 넓은 단계(broad phase)에서 보지 않고 좁은 단계에서 걸이 바로 앞에 본다 —
//   그룹이 버린 쌍과 걸이가 버린 쌍은 같은 길(pair.clear)이라 결정이 같으면 접촉 · 풀이 차례가 같다 (기록 §2).
//   대신 물리 스텝은 늘 사건 큐 · 걸이와 함께 (world.step(큐, 걸이)). Rapier JS 는 큐 없이 부르면 걸이도 버려 제 몸끼리 부딪히고(조용히),
//   큐만 주고 걸이를 안 주면 걸이를 부르다 TypeError 로 멈춘다(크게 — 11/19 까지도 칼날 걸이가 있어 같은 길이었다).
//  이 파일은 다른 src 파일을 읽지 않는다 (fighter.js · combat.js · pickup.js · druid_whip.js 가 함께 읽어도 돌림 import 가 없게)
// ─────────────────────────────────────────────────────────────

/** 충돌 부류 비트 (구성원 = 위 16 비트 · 거름 = 아래 16 비트 — Rapier InteractionGroups) */
export const BIT = Object.freeze({ ground: 1, body: 2, weapon: 4, helmet: 32, foot: 64 });
export const groups = (member, filter) => (member << 16) | filter;
/** 땅 · 벽 · 무대 장애물 — 모두와 */
export const GROUND_GROUPS = groups(BIT.ground, 0xffff);
/** 몸 부위 (발 빼고): 땅 · 몸 · 칼 */
export const BODY_GROUPS = groups(BIT.body, BIT.ground | BIT.body | BIT.weapon);
/** 발: 땅 · 칼만 (발 · 다리끼리 밟고 엉겨 붙지 않게 — 예전 footBit) */
export const FOOT_GROUPS = groups(BIT.foot, BIT.ground | BIT.weapon);
/** 칼 (칼날 · 칼자루 · 덩굴 마디): 땅 · 몸 · 칼 · 발 */
export const WEAPON_GROUPS = groups(BIT.weapon, BIT.ground | BIT.body | BIT.weapon | BIT.foot);
/** 날아간 투구: 땅하고만 */
export const HELMET_GROUPS = groups(BIT.helmet, BIT.ground);

/** 제 몸 부류 (colliderInfo.self) — 제 몸통 ↔ 제 칼팔 · 제 몸통 ↔ 제 칼만 부딪힌다 */
export const SELF = Object.freeze({ none: 0, torso: 1, arm: 2, weapon: 4 });
const TORSO_ARM = SELF.torso | SELF.arm;
const TORSO_WEAPON = SELF.torso | SELF.weapon;

/**
 * 두 콜라이더 정보(colliderInfo 값)가 부딪혀도 되나 — 다른 싸움꾼(또는 싸움꾼이 아닌 것)이면 늘 참(그다음은 충돌 그룹),
 *  같은 싸움꾼이면 제 몸통 ↔ 제 칼팔 · 제 몸통 ↔ 제 칼만 참
 */
export function pairAllowed(a, b) {
  if (!a || !b || a.fighter !== b.fighter) return true;
  const s = a.self | b.self;
  return s === TORSO_ARM || s === TORSO_WEAPON;
}

/** 전투(combat.js)가 없는 물리 스텝용 걸이: 제 몸 쌍만 버린다 (그 밖은 엔진 기본 — 부딪힘 1) */
export function selfHooks(info) {
  return {
    filterContactPair: (c1, c2) => (pairAllowed(info.get(c1), info.get(c2)) ? 1 : null),
    filterIntersectionPair: () => true,
  };
}
