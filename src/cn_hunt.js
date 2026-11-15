// 동방 맹호은림 (猛虎隱林 — 사냥 스택 · 새 칸 C12 · 몫 열쇠 'cnHunt' · 값 config UNIQUE_ASSIST.cnHunt · 기록 docs/strike/cn_hunt_2026-11-14.md)
//  사장님 11/14 '동방은 사냥감을 말려죽이는 고양이과 맹수야.' · '빠지는 규칙은 안 둘게.' · '격살이 세지는 만큼 3번 제한을 다른 비기처럼 1번으로' · '스택당 기력 회복 -8% 격살 빠르기 +8%'.
//  허리를 베는 세 칼(요격 · 끌어 딛고 허리 베기 · 날개 접기)이 상대 몸 어디든 칼날 상처를 낸 맞음마다(공격 하나에 한 겹 — 11/14 '전부 권고대로' · 전 판 몸통만 = cnHunt.torso 1) 맞은 몸에 한 겹 · 상한 max · 판 끝까지 빠지지 않음.
//  겹마다 맞은 몸 자연 회복 −regen · 그 몸을 겨눈 격살 칼끝 빠르기 +share. 사람 = C12 를 익힌 몸만 · AI · 시뮬 몸 = cnHunt.ai 스위치(기본 끔).
//  부르는 곳(좁게 하나씩): combat.js strike · Combat.huntWound(운동학 칼 — secret_instant.js) → huntHit · stamina.js recoverRate → huntRegenK · skill.js gyeoksalReq → huntShareK.
//  격살 판당 1 번은 공용 표 UNIQUE_ASSIST.secretUses.chinese (11/14 — 사람 · AI 같음 · secret.js secretUsesOf).
//  아무것도 쌓이지 않은 몸은 늘 1 · 겹 칸 자체가 없다(난수 · 몸 · 장부 그대로 — 다른 유파 판은 바이트 같음).
import { UNIQUE_ASSIST as UA } from './config.js';

const H = () => UA.cnHunt;

/** 이 몸이 사냥 겹을 쌓는가 (동방 무기 · 사람 = 스킬트리 C12 몫 · 스킬트리가 없는 몸(AI · 시뮬) = ai 스위치) */
export function huntOn(f) {
  const C = H();
  if (!C?.on || f?.swordArt?.tradition !== 'chinese') return false;
  return f.skillKit ? !!f.skillKit.cnHunt : !!C.ai;
}

/**
 * 겹 사라짐 (11/16 사장님 '동방이 쌓는 스택이 시간이 지나면 줄어드는 게 맞는 거 같애' → '대신 기력 회복 -10% 6초 후 사라지게?' → '이건 아까 취지를 살려 8초로 하자' — config cnHunt.life 8.0 s · 0 = 안 빠짐 전 판):
 *  겹 하나마다 쌓인 때(맞은 몸 시계 fightT)를 적어 두고, 그때부터 life 가 지난 겹은 뺌 — 읽는 자리(huntN · 기력 회복 · 격살 빠르기 · 표시)마다 셈. 배열은 몸마다 하나(겹 상한 5)
 */
function prune(f) {
  const S = f?.cnHunt;
  const L = H()?.life;
  if (!S?.ts?.length || !(L > 0)) return;
  const now = f.fightT ?? 0;
  while (S.ts.length && now - S.ts[0] >= L) S.ts.shift();
  S.n = S.ts.length;
}

/** 이 몸에 쌓인 겹 수 (0 ~ max · 11/16 — 8.0 s 지난 겹은 사라짐) */
export function huntN(f) {
  prune(f);
  return f?.cnHunt?.n ?? 0;
}

/**
 * 동방 공격이 칼날 상처를 냄 (11/16 — 전 허리를 베는 칼만 · combat.js Combat.huntWound 가 조건을 보고 부름 — 몸 어디든 · torso 1 이면 출혈 × k 가 붙는 몸통 맞음만): att 가 쌓는 몸이면 vic 에 한 겹.
 *  공격 하나에 한 겹 — 칼이 가슴 · 배를 함께 갈라도 한 번(기력 장부 공격 번호 attackId · 기력 끔이면 상처마다). 상한 max · 겹마다 life(8.0 s) 뒤 사라짐(11/16 — 전 빠지지 않음) · 11/16 부터 칼날 상처를 낸 공격 모두(cnHunt.any — combat.js huntWound).
 *  돌려줌: 새로 쌓았으면 true
 */
export function huntHit(att, vic) {
  if (!vic || vic === att || !huntOn(att)) return false;
  const C = H();
  const S = (vic.cnHunt ??= { n: 0, hits: 0, last: new Map(), t5: null, ts: [] });
  S.hits++;
  const id = att.stamina?.attackId ?? 0;
  if (id && S.last.get(att) === id) return false; // 같은 공격의 두 번째 상처
  S.last.set(att, id);
  prune(vic); // 11/16 — 사라진 겹 자리를 비움
  if (S.n >= C.max) return false;
  S.n++;
  (S.ts ??= []).push(vic.fightT ?? 0); // 이 겹이 쌓인 때 (제 시계 — life 뒤 사라짐)
  if (S.n >= C.max && S.t5 == null) S.t5 = vic.stamina?.time ?? 0; // 재기: 상한에 닿은 때 (맞은 몸 기력 시계)
  return true;
}

/** 맞은 몸의 자연 회복 배율 (stamina.js recoverRate): 1 − regen × 겹 (0 아래로는 안 내려감) · 겹 없음 = 1 */
export function huntRegenK(f) {
  const n = huntN(f);
  if (!n) return 1;
  const C = H();
  return C?.on && C.regen > 0 ? Math.max(0, 1 - C.regen * n) : 1;
}

/** 쌓는 몸이 겨눈 상대의 겹 수 (격살 풀기 더함 몫 — skill.js gyeoksalReq · 쌓는 몸이 아니면 0) */
export function huntStacksFor(f) {
  const n = huntN(f?.foe);
  return n && huntOn(f) ? n : 0;
}

/** 격살 칼끝 빠르기 몫 배율 (skill.js gyeoksalReq): 쌓는 몸이 겨눈 상대(f.foe)의 겹 × share 를 더함 · 겹 없음 = 1 */
export function huntShareK(f) {
  const n = huntN(f?.foe);
  if (!n || !huntOn(f)) return 1;
  const C = H();
  return C.share > 0 ? 1 + C.share * n : 1;
}
