// 방랑 — 일반 무대 30곳을 모두 깨면 열리는 무작위 대면 (샛별 저장소 전달본 977c2a43 — 사장님 10/23 18:3x '방랑은 이름 확정', docs/import/wander_heroes_import_2026-10-23.md)
//  대기실 '방랑' 단추로 언제든 들어간다(사장님 10/23 18:5x '언제든 들어가서 플레이할 수 있는 자유 스테이지'). 무대(여정 30곳)와 상대(무대 상대 + 방랑 전용 다섯)를 따로 뽑는다.
//  이기면 '다음 방랑'(새로 뽑은 다음 판 — 사장님 10/24 00:3x, 전 '다음 대면') · 지면 그 연속이 끝나 대기실로 · 다시 들어가면 새 조합. 판과 판 사이에 대기실로 나갔다 오면 같은 판을 이어 간다.
//  보상 (사장님 10/24 02:4x · 03:0x): 방랑 판 금화는 따로 정한 범위(WANDER_COINS — 낮 · 밤 같음): 이기면 +20 ~ 50 · 지면 −10 ~ 20 (0 아래 없음 — 전 일반 판 보상 × 2 · 지면 일반 차감).
//   이긴 판에 연승 보너스(WANDER_STREAK — 한 방랑에서 3승째부터 그 판 금화의 15 % · 한 판마다 +5 %p · 올림) · 특별 상대 몫 '왕의 금고'(금화) · '빼앗은 수급'(백린의 전사 머리)을 더한다.
//   참수 머리 1(여정과 같음 — 전 2).
//  연승 횟수는 연승 보너스에만 건다(10/24 03:0x — 전 '보상에 걸지 않음'). 저장은 lobby_progress.js 의 wander 칸(보상 · 연승 보너스와 같은 저장 — 새로고침 · 다시 열기로 두 번 받지 않음).
export const WANDER_NAME = '방랑';

/** 방랑에서만 나오는 상대 — 일반 여정 무대(stages.js STAGE_FOE_EXTRA)와 무작위 상대(characters.js randomCharacter)에서 뺀다
 *  (사장님 10/23 18:3x '아르토리아 방랑 전용' · 롤랑 · 백린은 전달본 그대로 · 베르나르도는 사장님 10/23 저녁 '롤랑과 같은 방랑 보상') */
export const WANDER_EXCLUSIVE = Object.freeze(['artoria', 'artoria_mad', 'roland', 'white_scale', 'bernardo']);

/** 특별 상대 몫 '왕의 금고' · '빼앗은 수급' (이긴 판만 · 판 금화 · 연승 보너스 뒤에 더하고 곱하지 않음 — 사장님 10/23 저녁): 아르토리아 두 모습 금화 100 · 롤랑 · 베르나르도 금화 200 · 백린의 전사 머리 10 (참수와 무관 — 참수까지 하면 머리 11)
 *  (사장님 10/24 02:4x '보너스 금화는 아르토리아 100 롤랑과 베르나르도 200' — 전 250 · 400(10/24 01:5x) · 그 전 200 · 250) */
export const WANDER_BONUS = Object.freeze({
  artoria: Object.freeze({ coins: 100, heads: 0 }),
  artoria_mad: Object.freeze({ coins: 100, heads: 0 }),
  roland: Object.freeze({ coins: 200, heads: 0 }),
  white_scale: Object.freeze({ coins: 0, heads: 10 }),
  bernardo: Object.freeze({ coins: 200, heads: 0 }), // 사장님 10/23 저녁 '롤랑과 같은 방랑 금화 보상' · 10/24 02:4x 200
});
/** 보너스 이름 — 결과 창 금화 줄 '금화 +N (왕의 금고 +200 · 연승 보너스 +M 포함)' · 머리 '머리 +N (빼앗은 수급 +10 포함)' · 공지
 *  (사장님 10/24 02:4x '특별 금화는 왕의 금고라고 해' · '백린 전사 목 보너스는 빼앗은 수급이라고 해' · 03:0x '연승보너스') */
export const WANDER_BONUS_LABEL = Object.freeze({ coins: '왕의 금고', heads: '빼앗은 수급', streak: '연승 보너스' });
/** 방랑 판 금화 [가장 적게, 가장 많이] (정수 · 양 끝 포함 · 낮 · 밤 같음) — 사장님 10/24 03:0x '방랑 승리 +20~50 패배 -10~20'
 *  (전: 일반 판 보상 × 2 = 낮 +20 ~ 60 · 밤 +40 ~ 120 · 지면 일반 차감 — 02:4x '지금의 50%로'는 03:0x 이 숫자로 바뀜) */
export const WANDER_COINS = Object.freeze({ win: Object.freeze([20, 50]), loss: Object.freeze([10, 20]) });
/** 연승 보너스 (사장님 10/24 03:0x '방랑에서 3승째부터 승리마다 연승보너스 기본 +10%에 +5%씩 증가하며 적립. … 소수점은 금화 1단위가 되도록 올림' · 04:3x '그럼 3승째에 기본 15%로 시작해'):
 *  한 방랑(진 판에서 끝나는 연속 — run.wins)의 from 번째 승리부터 그 판 금화(WANDER_COINS.win 에서 굴린 값 — 왕의 금고 빼고)의 basePct % · 한 판마다 stepPct %p 더 · 상한 없음 · 금화 한 닢 단위로 올림.
 *  3승째 15 % · 4승째 20 % · 5승째 25 % … 30승째 150 % (04:3x — 전 03:0x 를 '3승째 10 %'로 읽어 넣었던 것). 셈은 정수 % 로(소수 오차로 한 닢 더 올리지 않게) */
export const WANDER_STREAK = Object.freeze({ from: 3, basePct: 15, stepPct: 5 });
/** 방랑 알림 창 글 (30 무대를 처음 다 깬 판의 결과 창 위 — main.js · 이미 깬 사람은 대기실에 처음 들어올 때 — lobby.js · 한 번). 줄바꿈은 창에서 줄로.
 *  두 문단만 (사장님 10/24 00:3x "'아르토리아~' 부터는 삭제" — 셋째 문단 '아르토리아와 롤랑, 베르나르도, 백린의 전사는 방랑에서만 만납니다.' 뺌)
 *  '이기면 보상이 두 배입니다'는 10/24 03:0x 숫자에서도 맞다(방랑 이기면 +20 ~ 50 = 여정 +10 ~ 25 의 두 배) — 글 그대로 */
export const WANDER_NOTICE_TEXT = '모든 무대를 깨서 방랑이 열렸습니다. 대기실의 방랑 단추로 언제든 들어갈 수 있습니다.\n'
  + '방랑에서는 무대와 상대를 무작위로 만나고, 이기면 보상이 두 배입니다. 지면 그 방랑이 끝나고, 다시 들어가면 새로 시작합니다.';
/** 방랑 판에서 상대의 목을 베면 머리 — 일반 여정과 같은 1 (사장님 10/24 02:4x '목도 백린 전사 빼고는 1개씩만 줘' — 전 2) */
export const WANDER_HEAD = 1;

/**
 * 스위치 (새 값은 사장님 확인 전 — docs/strike/owner_defaults_table.md 2291 ~ 2300). 주소로도 바꾼다(main.js — ?title=1 과 함께 · 예 ?title=1&wanderQuit=1)
 *  quitAsLoss: 싸움 도중 '재대결'(정지 창 — 10/24 02:4x 전 '처음부터 다시') · 대기실로 나가기 · 새로고침을 패배로 친다(감독 첫 권고). 기본 끔 — 일반 여정과 같게
 *   (재대결 = 같은 대면을 카드부터 다시 · 나가기 · 새로고침 = 금화 그대로 · 같은 대면을 이어 감). 켜면 판과 판 사이 · 카드 고르는 동안만 이어 간다
 *  legacyLoop: 옛 저장 인정 — 누적 깬 수가 '한 바퀴(무대 수) + 이어하기 지점 자리' 이상이면 30 무대를 모두 깬 것으로 친다 (사장님 10/23 18:3x '이미 다 깬 여정도 인정')
 */
export const WANDER = { quitAsLoss: false, legacyLoop: true };

/** 이 방랑에서 win 번째 승리의 연승 보너스 % (정수 — 3승째 15 · 4승째 20 …) · from 번째 전이면 0 */
export function wanderStreakPct(win) {
  return Number.isSafeInteger(win) && win >= WANDER_STREAK.from ? WANDER_STREAK.basePct + WANDER_STREAK.stepPct * (win - WANDER_STREAK.from) : 0;
}
/** 연승 보너스 금화 = 올림(그 판 금화 × % ÷ 100) */
export function wanderStreakBonus(win, coins) {
  return Math.ceil((coins * wanderStreakPct(win)) / 100);
}

/** 특별 상대 몫 { coins, heads } (없으면 0) */
export function wanderBonus(foe) {
  const b = WANDER_BONUS[foe];
  return { coins: b?.coins ?? 0, heads: b?.heads ?? 0 };
}

/**
 * 판 보상: rolled = 이 판 금화(WANDER_COINS 에서 굴린 값 — 이기면 받을 · 지면 잃을) · winNo = 이기면 이 방랑에서 몇 번째 승리인가(run.wins + 1)
 *  → { coins(지면 음수) = 이기면 rolled + 연승 보너스 + 왕의 금고, heads = 빼앗은 수급, bonus: 특별 몫 { coins, heads }, streak: 연승 보너스 금화 }
 */
export function wanderReward(win, foe, rolled, winNo = 1) {
  const bonus = win ? wanderBonus(foe) : { coins: 0, heads: 0 };
  const streak = win ? wanderStreakBonus(winNo, rolled) : 0;
  return { coins: win ? rolled + streak + bonus.coins : -rolled, heads: bonus.heads, bonus, streak };
}

const isId = (v) => typeof v === 'string' && /^[a-z0-9_]{1,64}$/.test(v);
const RUN_STATUS = ['active', 'won', 'lost'];

/** 저장된 판 한 개가 모양이 맞나 (아니면 버린다 — 새로 뽑게) */
function validRun(run) {
  if (!run || typeof run.id !== 'string' || run.id.length > 100 || !RUN_STATUS.includes(run.status)) return false;
  if (!Number.isSafeInteger(run.round) || run.round < 1 || !Number.isSafeInteger(run.wins) || run.wins < 0) return false;
  if (!isId(run.stage) || !isId(run.foe) || !isId(run.foeWeapon)) return false;
  if (['weapon', 'lastWeapon'].some((k) => run[k] != null && !isId(run[k]))) return false;
  if (run.cards != null && (!Array.isArray(run.cards) || run.cards.length !== 2 || !run.cards.every(isId))) return false;
  return true;
}

/**
 * 저장 칸 wander 를 거른다:
 *  { cleared: 깬 무대 id, unlocked: 열렸나(한 번 열리면 계속), legacyChecked: 옛 저장을 한 번 봤나, noticeSeen: 방랑 알림 창을 봤나,
 *    run: { id, round, wins, stage, foe, foeWeapon, status: active|won|lost, weapon, cards, lastWeapon, headTaken, fighting, encounterSeen, reward } | null }
 *  encounterSeen: 이 대면의 방랑 전용 상대 알림 창을 봤나 (10/24 — main.js wanderEncounter · 같은 대면을 다시 열면 안 뜬다)
 */
export function normalizeWander(value) {
  const cleared = Array.isArray(value?.cleared) ? [...new Set(value.cleared.filter(isId))] : [];
  const run = validRun(value?.run) ? { ...value.run, headTaken: !!value.run.headTaken, fighting: !!value.run.fighting, encounterSeen: !!value.run.encounterSeen } : null;
  return { cleared, unlocked: value?.unlocked === true, legacyChecked: value?.legacyChecked === true, noticeSeen: value?.noticeSeen === true, run };
}

/** 무대 · 상대를 따로 뽑는다 (특정 인물에 특정 무대를 묶지 않는다) */
export function chooseWanderEncounter(stages, foes, random = Math.random) {
  if (!stages.length || !foes.length) throw new Error('방랑 풀이 비었음');
  const pick = (pool) => pool[Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))];
  return { stage: pick(stages), foe: pick(foes) };
}

/**
 * 옛 저장에서 깬 무대를 찾는다 (방랑이 들어오기 전 저장 — 무대별 기록이 없다). 증거는 두 가지뿐이다:
 *  이어하기 지점 checkpointStage(stillness.journey.checkpoint.v1 — 순서대로 깨야 넘어가는 자리)와 누적 깬 수 clears(stillness.journeyClears.v1 — 이긴 판마다 +1).
 *  ① 지점 앞의 무대: 지점이 i 번째(0 부터)이고 깬 수가 i 이상이면 0 ~ i−1 번째를 깬 것으로 친다 (전달본 그대로)
 *  ② 한 바퀴(legacyLoop): 깬 수가 무대 수 + i 이상이면 모두 깬 것으로 친다 — 마지막 무대를 깨면 지점이 다시 1 번으로 돌아가므로,
 *     한 바퀴 돈 저장은 지점이 앞쪽이어도 깬 수가 그만큼 쌓여 있다
 *  지점이 없으면(첫 화면 · 대기실을 거치지 않은 옛 판만 한 저장) 증거가 없어 아무것도 치지 않는다
 */
export function legacyWanderStages(checkpointStage, clears, required, { loop = WANDER.legacyLoop } = {}) {
  const index = required.indexOf(checkpointStage);
  if (index < 0 || !Number.isSafeInteger(clears) || clears <= 0) return [];
  if (loop && clears >= required.length + index) return [...required];
  if (index > 0 && clears >= index) return required.slice(0, index);
  return [];
}
