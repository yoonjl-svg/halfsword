// 동방 맹호은림 (猛虎隱林 — 사냥 스택 · 새 칸 C12 · 몫 열쇠 'cnHunt' · 값 config UNIQUE_ASSIST.cnHunt · 기록 docs/strike/cn_hunt_2026-11-14.md)
//  사장님 11/14 '동방은 사냥감을 말려죽이는 고양이과 맹수야.' · '빠지는 규칙은 안 둘게.' · '격살이 세지는 만큼 3번 제한을 다른 비기처럼 1번으로' · '스택당 기력 회복 -8% 격살 빠르기 +8%'.
//  허리를 베는 세 칼(요격 · 끌어 딛고 허리 베기 · 날개 접기)이 상대 몸통에 칼날 상처를 낸 맞음마다(공격 하나에 한 겹) 맞은 몸에 한 겹 · 상한 max · 판 끝까지 빠지지 않음.
//  겹마다 맞은 몸 자연 회복 −regen · 그 몸을 겨눈 격살 칼끝 빠르기 +share. 사람 = C12 를 익힌 몸만 · AI · 시뮬 몸 = cnHunt.ai 스위치(기본 끔).
//  부르는 곳(좁게 하나씩): combat.js strike(출혈 이점 잔상 줄) → huntHit · stamina.js recoverRate → huntRegenK · skill.js gyeoksalReq → huntShareK · secret.js secretUsesOf → huntUses.
//  아무것도 쌓이지 않은 몸은 늘 1 · 겹 칸 자체가 없다(난수 · 몸 · 장부 그대로 — 다른 유파 판은 바이트 같음).
import { UNIQUE_ASSIST as UA } from './config.js';

const H = () => UA.cnHunt;

/** 이 몸이 사냥 겹을 쌓는가 (동방 무기 · 사람 = 스킬트리 C12 몫 · 스킬트리가 없는 몸(AI · 시뮬) = ai 스위치) */
export function huntOn(f) {
  const C = H();
  if (!C?.on || f?.swordArt?.tradition !== 'chinese') return false;
  return f.skillKit ? !!f.skillKit.cnHunt : !!C.ai;
}

/** 이 몸에 쌓인 겹 수 (0 ~ max) */
export const huntN = (f) => f?.cnHunt?.n ?? 0;

/**
 * 허리를 베는 칼이 몸통에 칼날 상처를 냄 (combat.js strike — 출혈 × k 가 붙는 조건이 맞은 때만 부름): att 가 쌓는 몸이면 vic 에 한 겹.
 *  공격 하나에 한 겹 — 칼이 가슴 · 배를 함께 갈라도 한 번(기력 장부 공격 번호 attackId · 기력 끔이면 상처마다). 상한 max · 빠지지 않음.
 *  돌려줌: 새로 쌓았으면 true
 */
export function huntHit(att, vic) {
  if (!vic || vic === att || !huntOn(att)) return false;
  const C = H();
  const S = (vic.cnHunt ??= { n: 0, hits: 0, last: new Map(), t5: null });
  S.hits++;
  const id = att.stamina?.attackId ?? 0;
  if (id && S.last.get(att) === id) return false; // 같은 공격의 두 번째 상처
  S.last.set(att, id);
  if (S.n >= C.max) return false;
  S.n++;
  if (S.n >= C.max && S.t5 == null) S.t5 = vic.stamina?.time ?? 0; // 재기: 상한에 닿은 때 (맞은 몸 기력 시계)
  return true;
}

/** 맞은 몸의 자연 회복 배율 (stamina.js recoverRate): 1 − regen × 겹 (0 아래로는 안 내려감) · 겹 없음 = 1 */
export function huntRegenK(f) {
  const n = f?.cnHunt?.n;
  if (!n) return 1;
  const C = H();
  return C?.on && C.regen > 0 ? Math.max(0, 1 - C.regen * n) : 1;
}

/** 격살 칼끝 빠르기 몫 배율 (skill.js gyeoksalReq): 쌓는 몸이 겨눈 상대(f.foe)의 겹 × share 를 더함 · 겹 없음 = 1 */
export function huntShareK(f) {
  const n = f?.foe?.cnHunt?.n;
  if (!n || !huntOn(f)) return 1;
  const C = H();
  return C.share > 0 ? 1 + C.share * n : 1;
}

/** 동방 비기 판당 쓸 수 덮기 (secret.js secretUsesOf): 사람 동방(스킬트리가 있는 몸 — 칸과 상관없이) · ai 스위치면 AI 도 → uses · 아니면 null(config secretUses 그대로) */
export function huntUses(f) {
  const C = H();
  if (!C?.on || C.uses == null || f?.swordArt?.tradition !== 'chinese') return null;
  return f.skillKit || C.ai ? C.uses : null;
}
