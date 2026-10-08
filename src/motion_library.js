// ─────────────────────────────────────────────────────────────
//  동작 라이브러리 — 옛 이름 겉면 (검술 보정 v2 확장 ① 구조, 10/8)
//
//  자료·만들기·덧씌우기(자세표 FRAME_GUARDS·STYLE_GUARDS, 기술 NEW_TECH·styleTech, 덧씌우기 OVERLAY·COVERS, 막기 자리 LIB_PARRY,
//   쥠 모양 HAND_GRIPS, 본판 스위치 MOTION …)는 frames.js(틀 층)로 옮겼고 여기서 그대로 다시 내보낸다 — 도구·브라우저 스크립트가 이 이름으로 부른다.
//  고르기는 sword_art.js resolveSwordArt 한 곳이 한다. 아래 넷(libSchool·motionFor·applyMotionLibrary·frameTable)은 옛 이름 그대로 남긴 호환 겉면으로,
//   안에서 resolveSwordArt 를 부른다 (Fighter·AI 생성자는 이제 resolveSwordArt 를 바로 읽는다).
// ─────────────────────────────────────────────────────────────
import { resolveSwordArt, applySwordArt } from './sword_art.js';
export * from './frames.js';

/** (호환) 유파 꾸러미에 라이브러리 몫을 더한다 — 본판 스위치 MOTION.lib 가 꺼져 있으면 그대로. 몸은 sword_art.js mergeLibSchool */
export function libSchool(school, weapon) {
  return resolveSwordArt(weapon, null, { school }).school;
}

/**
 * (호환) 한 무기의 라이브러리 몫 (점검 도구가 부른다). 무기 스펙의 frame·style 을 읽는다.
 *  반환: { frame, style, table, tech, feints, watch, overlay, parry, noTwist, flow, counter } — base: 바탕 표 (없으면 옛 바탕)
 */
export function motionFor(weapon, base = null) {
  return resolveSwordArt(weapon, null, { lib: true, base }).motion;
}

/** (호환) 한 검객에게 라이브러리를 입힌다 (점검 도구가 부른다) — 바탕 = 검객이 지금 쥔 표 (없으면 옛 바탕) */
export function applyMotionLibrary(fighter, opts = {}) {
  return applySwordArt(fighter, resolveSwordArt(fighter.weapon ?? {}, null, { lib: true, base: fighter.guardPose?.table ?? null }), opts);
}

/** (호환) 몸 틀(+싸움 방식)의 자세표 — 고칠 것이 없으면 null. 몸은 frames.js buildFrameTable */
export function frameTable(frame, style = null, skip = [], base = null) {
  return resolveSwordArt({ frame, style: style ?? undefined, motionSkip: skip }, null, { lib: true, base }).libTable;
}
