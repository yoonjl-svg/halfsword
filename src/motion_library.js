// ─────────────────────────────────────────────────────────────
//  동작 라이브러리 — 옛 이름 겉면 (검술 보정 v2 확장 ① 구조, 10/8)
//
//  자료·만들기·덧씌우기(자세표 FRAME_GUARDS·STYLE_GUARDS, 기술 NEW_TECH·styleTech, 덧씌우기 OVERLAY·COVERS, 막기 자리 LIB_PARRY,
//   본판 스위치 MOTION …)는 frames.js(틀 층)로 옮겼고 여기서 그대로 다시 내보낸다 — 도구·브라우저 스크립트가 이 이름으로 부른다.
//  아래 세 함수(libSchool·motionFor·applyMotionLibrary)도 옛 이름 그대로 남긴다.
// ─────────────────────────────────────────────────────────────
import { TECH, WATCH_GUARDS } from './ai_techniques.js';
import { MOTION, weightTech, NEW_TECH, styleTech, styleFeints, frameWatchGuards, frameTable, OVERLAY, LIB_PARRY, COVERS, installLunge, installFlow, installCover } from './frames.js';
export * from './frames.js';

const _libSchools = new Map();
/**
 * 유파 꾸러미에 라이브러리 몫을 더한다 (AI 생성자가 부른다 — 본판 스위치 MOTION.lib, 10/8). 캐릭터 PM·무기 담당이 고른 기술 간격·가중치·간격표(measure)는 그대로 두고,
 *  몸 틀·방식의 가중치(앞무게: 내리치는 베기 ×1.4 · 찌르기 방식: 찌르기 ×1.8·베기 ×0.7 · 베기 방식: 찌르기 ×0.5 — 유파가 이미 손본 목록(세이버·팔쉬온 weakThrust)이면 건너뜀)와
 *  새 기술(탈류→레베스·손목 베기, styleTech 와 같은 규칙), 속임수(styleFeints), 간 보는 자세(frameWatchGuards — 유파가 따로 고른 것은 그대로)를 덧붙인다.
 *  A 두손 두루(롱소드류)·총·자루는 그대로. 꾸러미는 무기마다 한 번 만들어 둔다(결정적)
 */
export function libSchool(school, weapon) {
  if (!MOTION.lib || !school || school.lib) return school;
  const frame = weapon?.frame ?? 'two';
  const style = weapon?.style ?? 'versatile';
  if ((frame === 'two' && style === 'versatile') || frame === 'gun' || frame === 'pole') return school;
  const key = `${school.id}|${weapon?.id}`;
  const hit = _libSchools.get(key);
  if (hit) return hit;
  let t = school.tech;
  const plain = t === TECH; // 손보지 않은 롱소드 기술 목록
  if (style === 'cut' && plain) t = weightTech(t, (x) => x.kind === 'thrust', 0.5);
  if (style === 'thrust') t = weightTech(weightTech(t, (x) => x.kind === 'thrust', 1.8), (x) => x.kind === 'cut', 0.7);
  if (style === 'blunt') t = t.filter((x) => x.kind !== 'thrust');
  if (frame === 'heavy') t = weightTech(t, (x) => x.presses, 1.4);
  const have = new Set(t.map((x) => x.name));
  const add = (NEW_TECH[frame] ?? []).filter((x) => x.ai !== false && !have.has(x.name) && !(style === 'blunt' && x.name === 'wristCut') && (style !== 'thrust' || x.kind === 'thrust'));
  t = [...t, ...add];
  const out = { ...school, lib: true, tech: t, techByName: Object.fromEntries(t.map((x) => [x.name, x])), feints: styleFeints(style, frame), guards: school.guards === WATCH_GUARDS ? frameWatchGuards(frame) : school.guards };
  _libSchools.set(key, out);
  return out;
}

/**
 * 한 검객에게 라이브러리를 입힌다 (점검 도구가 부른다). 무기 스펙의 frame·style 을 읽는다.
 *  반환: { frame, style, table, tech, feints, watch, overlay }
 */
export function motionFor(weapon, base = null) {
  const frame = weapon.frame ?? 'two';
  const style = weapon.style ?? 'versatile';
  return { frame, style, table: frameTable(frame, style, weapon.motionSkip ?? [], base), tech: styleTech(style, frame), feints: styleFeints(style, frame), watch: frameWatchGuards(frame), overlay: OVERLAY[style] ?? null, parry: MOTION.useParry ? LIB_PARRY[weapon.id] ?? null : null, noTwist: style === 'blunt', flow: frame === 'heavy', counter: frame === 'pole' ? { default: styleTech(style, frame).map((t) => t.name) } : null }; // counter: 유파 맞받아치기 목록을 바꿔야 하는 틀(자루)만
}
export function applyMotionLibrary(fighter, { overlay = true, flow = true, noTwist = false, ai = null, cover = true } = {}) {
  const m = motionFor(fighter.weapon ?? {}, fighter.guardPose?.table ?? null); // 바탕 = 검객이 쥔 무기별 표 (없으면 옛 바탕)
  if (m.table) fighter.guardPose.table = fighter.bodyGuard.table = m.table; // 고칠 것이 없으면(롱소드류·총) 무기별 표를 그대로 둔다
  fighter.motion = m;
  if (overlay && m.overlay?.lunge) installLunge(fighter, m.overlay.lunge);
  // 날 세우기(손목 비틀기)를 끈다: 날 없는 무기(④ 때리기)는 어느 면으로 맞아도 같다.
  //  비트는 힘도 손목 힘 한도(cap) 안에서 나눠 쓰므로, 끄면 그만큼 휘두르는 데 쓴다 (무기-검술 연구 ② 제안).
  //  잰 값(motion_lab swings): 나뭇가지 +15~30%, 참치는 베기마다 들쭉날쭉. 라이트세이버(연구 ⑥ 제안)는 우리 판정이 날 있는 칼로 보므로
  //  끄면 날이 안 서 베기 지표가 0 이 된다 — 넣지 않는다.
  //  기본은 끔(noTwist=false): 실제 싸움에서 참치 23% → 8%, 나뭇가지도 떨어졌다 (비트는 힘이 칼을 붙잡아 주는 몫이 컸다). 기록용으로만 남긴다
  if (overlay && noTwist && m.noTwist) fighter.twistScale = 0;
  // 흐름(SKILL.flow — 멈추지 않고 이어 베기)을 이 검객에게만 켠다: 앞무게(B)는 되돌리지 않고 이어 도는 것이 빠른 길 (몬탄테)
  if (overlay && flow && m.flow) installFlow(fighter);
  // 막기 덧씌우기(COVERS): AI 가 그 줄을 칼로 막는 동안만 손·칼끝을 막기 자세로 덮는다 (자세표에 넣으면 베기 길이 휜다 — COVERS 주석)
  if (overlay && cover && ai && COVERS[m.frame]) installCover(fighter, ai, COVERS[m.frame]);
  return m;
}
