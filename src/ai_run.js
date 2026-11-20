// ─────────────────────────────────────────────────────────────
//  AI 뛰기 (11/19 사장님 '뛰기 AI에도 넣고 무리 싸움에 먼저 넣어.' · 원칙 '가급적 ai와 사람이 같아야 한다' — 기록 docs/strike/ai_run_2026-11-19.md)
//
//  뛰는 몸은 사람과 같다: AI 는 사람이 main.js 에서 두는 칸 그대로 — 스틱(stickX · stickY 상대 틀 · move) · 스틱 길 몫(runReach) · 공격 · 막기 입력(runBreak) —
//   를 두고, 들어감 · 나감 · 빠르기 · 기력 · 돌아섬은 src/run.js 의 runStep 이 사람 몸과 한 줄로 셈한다 (config RUN 그대로 · AI 몫 값 없음).
//  여기는 '언제 스틱을 끝까지 미나'만 정한다 — 셋 이상 판(판 사본 me.teamSense 가 있는 몸)만 부른다 (ai.js moveFeet 끝). 1:1 AI 는 runReach 를 두지 않아
//   f.run 이 생기지 않는다 (관문 바이트 같음). 난수를 부르지 않는다.
//
//  언제 (까닭 — 둘 중 하나):
//   join   겨눈 상대가 내 동료를 겨눔 — 동료와 붙은 적 · 다친 동료를 겨눈 적(엄호 겨눔 — team_sense.js)에게 달려가 끼어듦
//   chase  겨눈 상대가 빈손(ai.chasing) · 나를 겨눈 채 AI_RUN.flee 넘게 멀어짐(물러나 숨 고름)
//   나를 겨눠 다가오는 상대에게는 안 뜀 (판 시작처럼 — 어차피 오는 상대에게 기력만 씀)
//   셋 따로 판의 제삼자와 붙은 적에게는 안 뜀 (둘이 싸우는 데 달려들면 내 적 하나를 돕는 셈 — 걸어서 다가가는 기습은 team_sense.js 그대로 ·
//    11/19 재기: 판 시작 거리 같음 겨눔에서 자리 2 가 자리 0 에게 뛰어들어 자리 0 이김 13 → 5 / 60)
//  조건: 간 보기(watch) 중 · 서 있음 · 쉼(기력 쉼) · 밀치기 아님 · 겨눈 상대까지 간 보는 거리(holdDist) 밖으로 AI_RUN.gap 넘게 남음 ·
//   뛰어 닿을 때 기력이 AI_RUN.keep 넘게 남음(남은 길 ÷ 뛰는 끝 빠르기 × 초당 기력 어림) · 겨눈 상대 말고 다른 적이 제 칼끝 + AI_RUN.near 안에 없음
//   (뛰면 몸이 뛰는 쪽을 보고 옆 · 등이 열린다 — 판 사본의 제 층 눈(늦음)으로 읽되 시야는 묻지 않음) → 스틱을 상대 쪽 끝으로 (옆 몫은 앞 몫 × AI_RUN.lat 안 — 몸이 거의 안 돌고 뜀)
//  미리 (11/21 사장님 '끝까지 밀고 2초 이상 유지하면 뛰기 시작.' — 사람과 같은 규칙: 스틱을 끝까지 민 채 RUN.hold 를 걸어야 뜀 · run.js):
//   뛰기 전 남은 길에서 '버티며 걷는 길'(남은 버팀 시간 × (걷는 끝 빠르기 + 상대가 다가오는 빠르기 — 멀어지면 빼고))을 먼저 빼고 위 gap · 기력 어림을 셈 — 멀리서 미리 정해 밀기 시작 ·
//   버티기 시작한 뒤에는 gap 대신 AI_RUN.holdGap 으로 셈(사이 띠 — 버티다 그만두지 않게 · 버틴 끝에 뛸 길이 거의 없는데 뛰지 않게) · 그동안 까닭이 사라지거나 다른 조건이 깨지면
//   스틱 길 몫 0 (사람이 스틱을 되돌린 것과 같음 — 버틴 셈은 처음부터)
//  끝: 남은 길이 멈추는 길(지금 빠르기에서 RUN.accel 로 줄며 가는 길 + 그동안 상대가 다가오는 길) 안 · 기력 keep 밑 · 위 조건이 깨짐 → 스틱 길 몫 0 (사람이 스틱을 되돌린 것과 같음)
//  공격 · 막기 · 비기 꼴이면 runBreak (사람의 공격 · 막기 입력과 같은 끊기 — 끊긴 뒤 다시 걺도 run.js 그대로)
//  숙련도는 판단에만: 겨눈 상대가 누구를 겨누나 · 다른 적이 둘레에 있나를 그 몸의 층 눈(바탕 0.6 s · 가운데 0.4 s · 위 0.2 s 늦은 장 — team_sense.js viewOf)으로 읽음
// ─────────────────────────────────────────────────────────────
import { AI_RUN, RUN } from './config.js';
import { walkTopOf, runCostRate } from './run.js';
import { viewOf } from './team_sense.js';
import { sameSide } from './team.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

/** 겨눈 상대 말고 다른 적이 내 둘레(그 적의 칼끝 + near)에 있나 — 판 사본 제 층 눈의 장(시야는 묻지 않음) */
function otherFoeNear(ai) {
  const v = viewOf(ai);
  if (!v) return false;
  const S = ai.me.teamSense;
  const x = ai.foe?.index ?? -1;
  for (let j = 0; j < v.fr.b.length; j++) {
    if (j === v.i || j === x || sameSide(S.fighters[v.i], S.fighters[j])) continue;
    const g = v.fr.b[j];
    if (g.live && g.stand && Math.hypot(g.x - v.me.x, g.z - v.me.z) <= g.reach + AI_RUN.near) return true;
  }
  return false;
}

/** 뛰다 멈추는 길 (m): 지금 다가가는 빠르기 v 에서 RUN.accel 로 0 까지 줄며 가는 길 + 그동안 상대가 다가오는 길 */
function brakeDist(ai) {
  const v = Math.max(0, ai.myClosing ?? 0);
  const t = v / RUN.accel;
  return (v * t) / 2 + Math.max(0, ai.foeClosing ?? 0) * t;
}

/** 뛸 까닭 ('join' · 'chase' · null) — 판 사본 제 층 눈의 장으로 */
function runWhy(ai) {
  if (ai.chasing) return 'chase';
  const v = viewOf(ai);
  if (!v) return null;
  const S = ai.me.teamSense;
  const t = v.fr.b[ai.foe.index].foe; // 겨눈 상대가 겨눈 몸
  if (t >= 0 && t !== v.i && sameSide(S.fighters[v.i], S.fighters[t])) return 'join';
  return t === v.i && (ai.foeClosing ?? 0) < -AI_RUN.flee ? 'chase' : null;
}

/**
 * 스틱 (fwd 앞 · side 오른쪽 — 상대 틀)을 고쳐 돌려준다 · me.runReach · me.runBreak 를 둔다 (ai.js moveFeet 끝 — 셋 이상 판만).
 *  뛰지 않을 때는 스틱을 그대로 두고 runReach 0
 */
export function aiRunFeet(ai, fwd, side) {
  const me = ai.me;
  if (me.run && ai.mode !== 'watch' && ai.mode !== 'withdraw') me.runBreak = true; // 공격 · 막기 · 비기 꼴 = 사람의 공격 · 막기 입력 (뛰기를 끊음 — run.js)
  const why = runWant(ai, fwd);
  if (why && !ai.runWhy) {
    const R = (ai.stats.run ??= { join: 0, chase: 0 });
    R[why]++;
  }
  ai.runWhy = why;
  me.runReach = why ? 1 : 0;
  if (!why) return [fwd, side];
  const s = clamp(side, -AI_RUN.lat * fwd, AI_RUN.lat * fwd);
  const n = Math.hypot(fwd, s);
  return [fwd / n, s / n];
}

/** 지금 뛸 때인가 — 까닭 또는 null */
function runWant(ai, fwd) {
  const me = ai.me;
  if (ai.mode !== 'watch' || me.state !== 'stand' || me.feetHeld || me.barge || ai.staminaRest || !ai.foe?.alive || !(fwd > 0)) return null;
  const S = me.stamina;
  const st = S.infinite ? Infinity : S.value;
  if (st <= AI_RUN.keep) return null;
  const left = ai.d - ai.holdDist(); // 간 보는 거리까지 남은 길
  const on = !!me.run?.on;
  const pre = on ? 0 : Math.max(0, RUN.hold - (me.run?.hold || 0)) * Math.max(0, walkTopOf(me) + (ai.foeClosing ?? 0)); // 버티며 걷는 동안 줄어드는 길 (11/21 — 뛰기 전 · 상대가 멀어지면 덜)
  const holding = !on && (me.run?.hold || 0) > 0; // 버티는 중 — gap 대신 holdGap (멀리서 정한 것을 이어감 · 사이 띠)
  if (!on && left - pre <= (holding ? AI_RUN.holdGap : AI_RUN.gap)) return null;
  const stop = brakeDist(ai);
  if (left - pre <= stop) return null;
  if (!on && st - ((left - pre - stop) / (walkTopOf(me) * RUN.mul)) * runCostRate(me) < AI_RUN.keep) return null; // 닿을 때 기력 어림 (뛰는 끝 빠르기로 — 가속 동안은 덜 씀 · 버티며 걷는 동안 걸음 기력은 셈하지 않음)
  const why = runWhy(ai);
  return why && !otherFoeNear(ai) ? why : null;
}
