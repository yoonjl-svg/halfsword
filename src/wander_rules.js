// 방랑 — 일반 무대 30곳을 모두 깨면 열리는 무작위 대면 (샛별 저장소 전달본 977c2a43 — 사장님 10/23 18:3x '방랑은 이름 확정', docs/import/wander_heroes_import_2026-10-23.md)
//  대기실 '방랑' 단추로 언제든 들어간다(사장님 10/23 18:5x '언제든 들어가서 플레이할 수 있는 자유 스테이지'). 무대(여정 30곳)와 상대(무대 상대 + 방랑 전용 다섯)를 따로 뽑는다.
//  이기면 '다음 대면'(새로 뽑은 다음 판) · 지면 그 연속이 끝나 대기실로 · 다시 들어가면 새 조합. 판과 판 사이에 대기실로 나갔다 오면 같은 판을 이어 간다.
//  보상: 일반 판 보상(lobby_progress.js JOURNEY_COINS — 낮 · 밤)의 두 배를 셈한 뒤 특별 상대 몫을 더한다(특별 몫은 두 배 하지 않음) · 지면 일반 판과 같은 차감 · 참수 머리 2.
//  연승 횟수는 보상에 걸지 않는다(몇 번째 판이든 같다 — 사장님 결정 전). 저장은 lobby_progress.js 의 wander 칸(보상과 같은 저장 — 새로고침 · 다시 열기로 두 번 받지 않음).
export const WANDER_NAME = '방랑';

/** 방랑에서만 나오는 상대 — 일반 여정 무대(stages.js STAGE_FOE_EXTRA)와 무작위 상대(characters.js randomCharacter)에서 뺀다
 *  (사장님 10/23 18:3x '아르토리아 방랑 전용' · 롤랑 · 백린은 전달본 그대로 · 베르나르도는 사장님 10/23 저녁 '롤랑과 같은 방랑 보상') */
export const WANDER_EXCLUSIVE = Object.freeze(['artoria', 'artoria_mad', 'roland', 'white_scale', 'bernardo']);

/** 특별 상대 몫 (이긴 판만 · 일반 판 보상 × 2 뒤에 더하고 두 배 하지 않음 — 사장님 10/23 저녁): 아르토리아 두 모습 금화 200 · 롤랑 · 베르나르도 금화 250 · 백린의 전사 머리 10 (참수와 무관 — 참수까지 하면 머리 12) */
export const WANDER_BONUS = Object.freeze({
  artoria: Object.freeze({ coins: 200, heads: 0 }),
  artoria_mad: Object.freeze({ coins: 200, heads: 0 }),
  roland: Object.freeze({ coins: 250, heads: 0 }),
  white_scale: Object.freeze({ coins: 0, heads: 10 }),
  bernardo: Object.freeze({ coins: 250, heads: 0 }), // 사장님 10/23 저녁 '롤랑과 같은 방랑 금화 보상'
});
/** 방랑 알림 창 글 (30 무대를 처음 다 깬 판의 결과 창 위 — main.js · 이미 깬 사람은 대기실에 처음 들어올 때 — lobby.js · 한 번). 줄바꿈은 창에서 줄로 */
export const WANDER_NOTICE_TEXT = '모든 무대를 깨서 방랑이 열렸습니다. 대기실의 방랑 단추로 언제든 들어갈 수 있습니다.\n'
  + '방랑에서는 무대와 상대를 무작위로 만나고, 이기면 보상이 두 배입니다. 지면 그 방랑이 끝나고, 다시 들어가면 새로 시작합니다.\n'
  + '아르토리아와 롤랑, 베르나르도, 백린의 전사는 방랑에서만 만납니다.';
/** 방랑 판에서 상대의 목을 베면 머리 (일반 여정 1) */
export const WANDER_HEAD = 2;

/**
 * 스위치 (새 값은 사장님 확인 전 — docs/strike/owner_defaults_table.md 2291 ~ 2300). 주소로도 바꾼다(main.js — ?title=1 과 함께 · 예 ?title=1&wanderQuit=1)
 *  quitAsLoss: 싸움 도중 '처음부터 다시' · 대기실로 나가기 · 새로고침을 패배로 친다(감독 첫 권고). 기본 끔 — 일반 여정과 같게
 *   (처음부터 다시 = 같은 대면을 카드부터 다시 · 나가기 · 새로고침 = 금화 그대로 · 같은 대면을 이어 감). 켜면 판과 판 사이 · 카드 고르는 동안만 이어 간다
 *  legacyLoop: 옛 저장 인정 — 누적 깬 수가 '한 바퀴(무대 수) + 이어하기 지점 자리' 이상이면 30 무대를 모두 깬 것으로 친다 (사장님 10/23 18:3x '이미 다 깬 여정도 인정')
 */
export const WANDER = { quitAsLoss: false, legacyLoop: true };

/** 특별 상대 몫 { coins, heads } (없으면 0) */
export function wanderBonus(foe) {
  const b = WANDER_BONUS[foe];
  return { coins: b?.coins ?? 0, heads: b?.heads ?? 0 };
}

/** 판 보상: ordinaryCoins = 일반 판이면 받았을(이기면) · 잃었을(지면) 금화 → { coins(지면 음수), heads, bonus } */
export function wanderReward(win, foe, ordinaryCoins) {
  const bonus = win ? wanderBonus(foe) : { coins: 0, heads: 0 };
  return { coins: win ? ordinaryCoins * 2 + bonus.coins : -ordinaryCoins, heads: bonus.heads, bonus };
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
 *    run: { id, round, wins, stage, foe, foeWeapon, status: active|won|lost, weapon, cards, lastWeapon, headTaken, fighting, reward } | null }
 */
export function normalizeWander(value) {
  const cleared = Array.isArray(value?.cleared) ? [...new Set(value.cleared.filter(isId))] : [];
  const run = validRun(value?.run) ? { ...value.run, headTaken: !!value.run.headTaken, fighting: !!value.run.fighting } : null;
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
