// ─────────────────────────────────────────────────────────────
//  낮은 상대 마무리 진입 (높이 제한) — 스위치 FINISH.entry = 'low' 일 때만 (기본 'down' = 끔, 예전 그대로)
//   사장님 10/12 지시로 샛별 저장소 b9d28ca6·080ea451(진입 결함 기록 4b010726) 의 뜻을 우리 finish.js·skill.js·combat.js·ai.js 에 옮겼다.
//   기록: docs/import/saetbyeol_round2_2026-10-12.md §3 · 확인표 954~956 (사장님 확인 전)
//
//  뜻: '쓰러짐(state down)' 이름 대신 실제 몸 높이로 내려찍기를 연다.
//   · 상대가 down 이나 getup 이고, 가슴·골반(둔기·부러진 칼은 머리도) 가운데 가장 높은 곳이 enterHeight 아래 — 막 넘어지기 시작해 아직 높은 몸은 아니다
//   · 그리고 내 가슴보다 minimumDrop 이상 낮다
//   · 이미 시작한 같은 상대의 찍기는 exitMargin 만큼 너그럽게 본다(경계에서 켜졌다 꺼졌다 하지 않게). 일어나기(getup) 이름만으로는 끊지 않는다
//   · 칼끝이 몸 겉면에 닿기만 하면 시작할 수 있다(짧은·부러진 칼). 걸어서 깊이 닿을 수 있으면 그만큼 걸어 들어간다
//   · 다 걸었는데도 닿지 않으면 허공을 찍지 않고 거둔다
//  높이 값은 게임 설계값이다(인체 실측 한계가 아니다). 바닥은 평평한 y = 0 이라고 본다.
// ─────────────────────────────────────────────────────────────
import { BODY, SKILL } from './config.js';

export const LOW_FINISH = {
  enterHeight: BODY.standHeight * 0.7, // m (0.665): 이 아래로 내려온 몸만 새로 연다 — 서 있을 때 골반 높이의 70 %
  exitMargin: 0.1, // m: 이미 시작한 찍기는 이만큼 높아질 때까지 이어 간다
  minimumDrop: 0.2, // m: 내 가슴보다 이만큼은 낮아야 한다 (무릎 꿇고 버티는 상대는 아니다)
  approach: SKILL.lungeMove * SKILL.level, // 걸어 들어가는 앞 밀기 (예전 찍기와 같은 값)
};

/** 스위치 (FINISH.entry) — finish.js 가 이 파일을 부르기 전에 읽어 넘긴다 */
//  'auto' (10/12 약한 자세 겨눔 묶음): 약한 자세 겨눔(FINISH.vital)이 켜져 있으면 'low' — 무릎 꿇은·높은 몸은 겨눔이, 낮은 몸은 내려찍기가 맡는다
export const lowFinishOn = (FINISH) => FINISH?.entry === 'low' || (FINISH?.entry === 'auto' && !!FINISH.vital);

/**
 * 고친 판 (FINISH.entry 'downlow', 기본 끔): 큰 쓰러짐(down)은 지금처럼 이름으로 열고(넘어지는 중 탭도 그대로),
 *  가벼운 넘어짐에서 일어나는 중(getup)인 상대는 몸이 낮을 때만(lowFinishPosture) 더 연다. 겉면 닿음·허공 거둠 같은 'low' 의 나머지 규칙은 쓰지 않는다.
 *  (우리 판 측정: 자연 결투에선 큰 쓰러짐이 거의 없고 가벼운 넘어짐(무릎부터 일어남)이 판마다 몇 번 — 그때 탭은 늘 보통 찌르기였다)
 */
export function downLowTarget(FINISH, att, vic, continuing = false, cached = false) {
  if (vic?.state === 'down') return true;
  return FINISH?.entry === 'downlow' && vic?.state === 'getup' && lowFinishPosture(att, vic, continuing, cached);
}

/**
 * 지금 몸만 보는 판정 (부작용 없음 — 접촉 예측에서 여러 번 불러도 된다).
 *  cached = true: 물리 엔진을 부르지 않고 스텝 전 저장값(fighter.cacheState)만 읽는다 (접촉 예측 안에서 엔진을 다시 부르면 안 된다). 저장값이 없으면 false
 */
export function lowFinishPosture(att, vic = att?.foe, continuing = false, cached = false) {
  if (!att?.alive || !att.armed || !vic?.alive) return false;
  if ((att.state !== 'stand' && att.state !== 'kneel') || (vic.state !== 'down' && vic.state !== 'getup')) return false;
  const pos = (f, part) => (cached ? f.cache?.parts?.[part]?.p : f.bodies[part].translation());
  const chest = pos(vic, 'chest');
  const pelvis = pos(vic, 'pelvis');
  const me = pos(att, 'chest');
  const headToo = !att.weaponCfg.edged || att.weaponBroken;
  const head = headToo ? pos(vic, 'head')?.y : -Infinity;
  if (!chest || !pelvis || !me || (headToo && !Number.isFinite(head))) return false;
  const top = Math.max(chest.y, pelvis.y, head);
  const limit = LOW_FINISH.enterHeight + (continuing ? LOW_FINISH.exitMargin : 0);
  return top <= limit && top + LOW_FINISH.minimumDrop < me.y;
}

/** 이 파이터가 같은 상대에게 시작한 찍기를 이어 가는 중인가 */
export function lowFinishContinuing(f, foe = f.foe) {
  const tp = f.skill?.tap;
  return !!(tp?.down && !tp.abort && !tp.ended && (tp.foe ?? f.foe) === foe); // tp.foe 는 'low' 때만 적는다
}
