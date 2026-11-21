// ─────────────────────────────────────────────────────────────
//  동작 라이브러리 — 옛 이름 겉면 (검술 보정 v2 확장 ① 구조, 10/8) · 도구 전용 (11/21 감사 N-004: 게임은 안 불러 src/ 에서 여기로 옮김)
//
//  자료·만들기·덧씌우기(자세표 FRAME_GUARDS·STYLE_GUARDS, 기술 NEW_TECH·styleTech, 덧씌우기 OVERLAY·COVERS, 막기 자리 LIB_PARRY,
//   쥠 모양 HAND_GRIPS, 점검 손잡이 MOTION …)는 src/frames.js(틀 층)에 있고 여기서 그대로 다시 내보낸다 — 도구·브라우저 스크립트가 이 이름으로 부른다.
//  고르기는 src/sword_art.js resolveSwordArt 한 곳이 한다. 아래 둘(motionFor·applyMotionLibrary)은 도구가 부르는 옛 이름 겉면으로,
//   안에서 resolveSwordArt 를 부른다 (Fighter·AI 생성자는 resolveSwordArt 를 바로 읽는다). 아무도 안 부르던 libSchool · frameTable 은 옮기지 않았다.
// ─────────────────────────────────────────────────────────────
import { resolveSwordArt, applySwordArt } from '../../../src/sword_art.js';
export * from '../../../src/frames.js';

/**
 * (호환) 한 무기의 라이브러리 몫 (점검 도구가 부른다). 무기 스펙의 frame·style 을 읽는다.
 *  반환: { frame, style, table, tech, feints, watch, overlay, parry, noTwist, flow, counter } — base: 바탕 표 (없으면 옛 바탕)
 */
export function motionFor(weapon, base = null) {
  return resolveSwordArt(weapon, null, { base }).motion;
}

/** (호환) 한 검객에게 라이브러리를 입힌다 (점검 도구가 부른다) — 바탕 = 검객이 지금 쥔 표 (없으면 옛 바탕) */
export function applyMotionLibrary(fighter, opts = {}) {
  return applySwordArt(fighter, resolveSwordArt(fighter.weapon ?? {}, null, { base: fighter.guardPose?.table ?? null }), opts);
}
