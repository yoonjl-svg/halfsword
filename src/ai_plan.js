// ─────────────────────────────────────────────────────────────
//  유파 AI 기본 전투 흐름 — 공통 틀 (11/14 — 사장님 '유파별 ai의 전투 방식에 기본을 잡는거야' · 설계안 docs/design/ai_school_baseline_2026-11-14.md §2 · 1 단계 기록 §9)
//
//  세 층: ① 국면 판정(공통 — 본 것과 내 몸 상태만 · judgePhase) ② 유파 플랜(SCHOOL_PLAN — 국면마다 기울기 칸) ③ 숙련도 띠 · 세 축(bandOf · axesOf).
//  플랜은 '반드시 · 절대'가 아니라 기울기다(사장님 11/14 '절대적 규칙은 빼'): 칸 값은 그 행동을 고를 몫이고, AI 가 띠 세기(tilt)를 곱해 확률 · 문턱으로 쓴다.
//  1 단계: 이탈리아만 플랜이 있다(config AI_PLAN.schools). 플랜이 없는 유파는 ai.js 가 이 파일의 어떤 셈도 부르지 않는다(바이트 같음).
//  연산(사장님 11/14 '랙이 생기진 않을까'): 국면 판정은 AI_PLAN.tick 마다 한 번 · 스텝마다 새 객체 · 배열을 만들지 않음 · 탐색 · 미리 돌려 보기 같은 무거운 셈 없음.
// ─────────────────────────────────────────────────────────────
import { AI_PLAN, STAMINA, GAIT } from './config.js';
import { itEdgeOn } from './italian_outbox.js';

/** 국면 일곱 (판정 차례는 judgePhase — 위에서부터) */
export const PHASES = Object.freeze(['tired', 'behind', 'finish', 'ahead', 'commit', 'contest', 'probe']);
export const PHASE_KO = Object.freeze({ tired: '지쳤을 때', behind: '불리할 때', finish: '끝내기', ahead: '우위를 쥔 뒤', commit: '들어감 / 받음', contest: '거리 다툼', probe: '간 보기' });
/** 띠 이름 (config AI_PLAN.bands 의 값) */
export const BANDS = Object.freeze(['무', '낮음', '가운데', '높음']);

/** 숙련도 → 띠 0 무 · 1 낮음 · 2 가운데 · 3 높음 (사장님 11/14) */
export function bandOf(p) {
  const B = AI_PLAN.bands;
  return B[Math.max(0, Math.min(B.length - 1, Math.round(p ?? 0)))];
}

/** 띠의 플랜 기울기 세기 0 ~ 1 (무 = 0) */
export function tiltOf(p) {
  return AI_PLAN.tilt[bandOf(p)] ?? 0;
}

/** ① 무기 이해 — 거리 오차 폭 m (0 = 굴리지 않음): 스위치 · 그 유파(1 단계 — 이탈리아) · 숙련도 (높음부터 0) */
export function distErrWidth(p, tradition) {
  if (!AI_PLAN.on || !AI_PLAN.errSchools.includes(tradition)) return 0;
  return Math.max(0, AI_PLAN.errMax * (1 - (p ?? 0) / AI_PLAN.errClear));
}

/**
 * 숙련도 세 축의 그릇 (설계 §2-4) — 1 단계가 읽는 칸: band · tilt · weapon.err · link · lure. read 칸(상대 유파 · 버릇 · 되풀이)은 자리만(3 단계).
 *  link = 첫 고리(낮음부터) · lure = 유도(가운데 끝 4 부터) · read.mem = 버릇 기억 창 s (가운데 6.0 · 높음 10.0 — 시간 사다리 · 아직 안 읽음)
 */
export function axesOf(p, tradition) {
  const band = bandOf(p);
  return {
    band,
    tilt: AI_PLAN.tilt[band] ?? 0,
    weapon: { err: distErrWidth(p, tradition) },
    link: band >= 1,
    lure: (p ?? 0) >= 4,
    read: { school: band >= 2, habit: band >= 2, repeat: band >= 3, mem: band >= 3 ? 10.0 : band >= 2 ? 6.0 : 0 },
  };
}

/**
 * 유파 플랜 (설계 §3) — 국면마다 칸. 값은 고를 몫(0 ~ 1)이고 AI 가 띠 세기를 곱해 쓴다.
 *  retreat  상대가 걸어 들어오면 한 박자 물러섰다 멈춤 (물러서며 받기)
 *  receive  걸어 들어오는 몸을 받아 찌를 기회 (빈틈 점수 '들어옴'의 문턱을 걸음 문턱 · 내 칼끝 거리로 옮기고 점수에 기울기)
 *  link     첫 고리 — 칼이 맞닿으면 빼서 찌르기 (헛누름 → 칼 우위)
 *  engage   유도 — 상대 칼끝이 나를 겨누면 칼끝을 겨눈 채 칼이 닿을 때까지 조금씩 다가가 칼을 맞댐
 *  invite   유도 — 상대가 조용히 서 있으면 한 걸음 물러섰다 멈춰 들어오게 꾐
 */
export const SCHOOL_PLAN = Object.freeze({
  italian: Object.freeze({
    nameKo: '아웃복서',
    lureAt: 4, // 유도는 가운데 끝(4)부터 (설계 §2-4)
    probe: Object.freeze({ retreat: 0, receive: 1, link: 1, engage: 0, invite: 0 }),
    contest: Object.freeze({ retreat: 1, receive: 1, link: 1, engage: 1, invite: 1 }),
    commit: Object.freeze({ retreat: 0, receive: 1, link: 1, engage: 0, invite: 0 }),
    ahead: Object.freeze({ retreat: 0, receive: 1, link: 0, engage: 0, invite: 0 }), // 칼 우위 — 리솔루토 무장(지금 비기 셈)이 먼저 · 빼서 찌르기로 덮음을 끊지 않게 덜 고름
    finish: Object.freeze({ retreat: 0, receive: 1, link: 1, engage: 0, invite: 0 }),
    behind: Object.freeze({ retreat: 1, receive: 1, link: 1, engage: 0, invite: 0 }),
    tired: Object.freeze({ retreat: 1, receive: 1, link: 0, engage: 0, invite: 0 }),
  }),
});

/** 이 유파의 플랜 (스위치 · 유파 · 띠 무가 아니면) — 없으면 null */
export function planFor(tradition, p) {
  if (!AI_PLAN.on || !AI_PLAN.schools.includes(tradition) || bandOf(p) === 0) return null;
  return SCHOOL_PLAN[tradition] ?? null;
}

/**
 * 국면 판정 (위에서부터 먼저 — 설계 §2-2). ai 에서 읽기만 한다(굴림 · 새 객체 없음). d = 본 가슴 사이(ai.d).
 *  s = 늦게 본 상대 모습(있으면 상대 몸 상태를 거기서 — 반응 시간만큼 늦게 · 공정함).
 *  지쳤을 때: 기력 쉼(ai.staminaRest) · 탈진 / 불리할 때: 피를 더 흘림(desperate) · hurtT 안에 맞음 · 상대 칼 우위 빛 /
 *  끝내기: 상대가 서 있지 않음 · 칼 씨름에 무너짐 · 탈진 · 내 비기 창 / 우위: 내 칼 우위 · 상대가 피를 더 흘림(cautious) /
 *  들어감 · 받음: 공격 · 막기 · 비기 꼴 / 거리 다툼: 간 보는 거리 + 0.6 m 안(간 보기 옆 돌기와 같은 거리) / 간 보기: 그 밖
 */
export function judgePhase(ai, d, s = null) {
  const me = ai.me;
  const foe = ai.foe;
  if (STAMINA.on && (ai.staminaRest || me.stamina?.exhausted)) return 'tired';
  if (ai.desperate || (ai.lastHurtT != null && ai.sense.t - ai.lastHurtT < AI_PLAN.hurtT) || itEdgeOn(foe)) return 'behind';
  if ((s?.state ?? foe.state) !== 'stand' || foe.ringHit || foe.stamina?.exhausted || ai.riso?.win > 0 || ai.press?.win > 0) return 'finish';
  if (itEdgeOn(me) || ai.cautious) return 'ahead';
  if (ai.mode === 'attack' || ai.mode === 'defend' || ai.mode === 'secret') return 'commit';
  if (d < ai.holdDist() + 0.6) return 'contest';
  return 'probe';
}

/** 본 상대 걸음 (리솔루토 맞춤 걸음 — 사람 스틱 대신 늦게 본 다가옴 ai.foeClosing · 걸음 문턱 GAIT.walkMin): 'advance' · 'retreat' · null */
export function seenStep(closing) {
  return closing >= GAIT.walkMin ? 'advance' : closing <= -GAIT.walkMin ? 'retreat' : null;
}

/** 국면 시간 재기 칸 (AI 하나에 한 번 만듦) */
export function planStats() {
  return { t: { tired: 0, behind: 0, finish: 0, ahead: 0, commit: 0, contest: 0, probe: 0 }, judges: 0, events: 0, retreat: 0, stop: 0, invite: 0, engage: 0, engageTouch: 0, link: 0, stepin: 0 };
}
