// ─────────────────────────────────────────────────────────────
//  뒤 박차기 헛침 경직 ([사장님 11/19 결정] — 기록 docs/strike/burst_whiff_2026-11-19.md · 값 config BURST_WHIFF)
//   "뒤로 박차서 상대 칼을 헛치게 하면, 그 상대는 헛친 칼이 끝난 뒤 0.6초 동안 경직 (막기 · 공격 불가)" — 게임 규칙 · 사람 · AI 같음 · 스위치 없음.
//
//  한 공격 = 사람: 검술 층 휘두르기 덩이(skill.js whiffTrack — 휘두름 · 탭이 이어진 동안 + 칼이 다 지나갈 때까지 · 기력 장부가 공격으로 센 것만) ·
//            AI: 칼이 나가는 순간(ai.js startStrike) ~ 친 뒤(afterStrike). 비기 칼은 셈하지 않음(비기는 제 경직이 있음).
//  ① 공격 시작 (bwAtkStart): 그때 겨눈 상대(f.foe)가 내 칼끝 거리(검술 풀이 간격 measure.reach — 가슴 사이 수평 거리) 안이었나를 적음 — 밖이면 처음부터 닿지 않을 칼
//  ② 닿음 (bwTouch — combat.js): 이 공격 동안 내 칼이 그 상대 몸에 닿음(판정 문턱 밑 닿음도) · 칼끼리 닿음(코등이 · 자루 포함) → 헛침 아님
//  ③ 뒤 박차기 (gait.js — 독일 보법 G1 · 앞뒤 몫만 · 옆 박차기 · 파고들기는 아님): 박차기를 걸 때(사람 스틱 뒤 · AI backBurstAi — bwAim) 나를 겨눠 나가는 중인 칼
//     (칼이 나간 뒤 다 지나갈 때까지 — AI 'strike' · 'follow' · 사람 휘두름 덩이)을 적고, 그 박찬 걸음을 실제로 뗄 때(fastBegin — bwBurst) 그 칼이 아직 안 끝났으면 표시 ·
//     뗄 때 나가는 중인 칼도 표시 (칼을 들 때 미리 읽고 건 박차기 — 걸 때는 칼이 아직 안 나감). 걸었다가 못 뗀 박차기 · 칼이 끝난 뒤에야 뗀 걸음은 표시 없음
//  ④ 공격 끝 (bwAtkEnd): 표시가 있고 · 시작 때 칼끝 거리 안 · 닿음 없음(그 몸의 맞힘 · 맞물림 셈도 없음)이면 굳음 BURST_WHIFF.stiff — 끝난 때부터
//  굳음 = 비기 경직과 같은 꼴: 칼(손 목표)은 굳은 자리에 멈춤(skill.js holdStiff) · 걸음 없음 · 막기 · 공격 없음
//   (사람: 검술 층 secretPhase 'stiff' → main.js 가 칼 · 막기 · 스틱 입력을 막음 · 막기 단추 parry_button.js · AI: ai.js 공격 문 · respond · 꼴 분기 · 걸음)
// ─────────────────────────────────────────────────────────────
import { BURST_WHIFF } from './config.js';

const hdist = (a, b) => {
  const p = a.bodies.chest.translation();
  const q = b.bodies.chest.translation();
  return Math.hypot(q.x - p.x, q.z - p.z);
};

/** y 의 칼끝 거리 (검술 풀이 간격 — 무기 실측 · AI 어림 오차가 섞이지 않은 몸의 값) */
const reachOf = (y) => y.swordArt?.measure?.reach ?? y.aiCtl?.M?.reach ?? 1.8;

/** f 가 지금 굳었나 (뒤 박차기 헛침 경직) */
export const bwStiff = (f) => (f?.bwStiffT ?? 0) > 0;

/** y 의 칼이 지금 나가는 중인가 = 그 공격 기록이 살아 있음(칼이 나간 때 ~ 다 지나가 끝날 때) · 비기 칼 아님 */
function inFlight(y) {
  if (!y?.bwAtk?.live) return false;
  return y.aiCtl ? !y.aiCtl.secretRun : !y.skill?.sec;
}

/** 재기 칸 (읽기만): 시작 · 박차기 표시 · 굳음 · 닿아서 안 굳음 · 칼끝 밖이라 안 굳음 */
const statOf = (f) => (f.bwStats ??= { atk: 0, burst: 0, stiff: 0, touched: 0, far: 0, log: [] });

/** ① 공격 시작 (사람 whiffTrack 덩이 시작 · AI startStrike) */
export function bwAtkStart(y) {
  const x = y.foe;
  if (y.bwAtk) y.bwAtk.live = false;
  y.bwAtk = { y, tgt: x, inReach: !!x && x.alive && !!x.bodies && hdist(y, x) <= reachOf(y), burst: false, touched: false, live: true };
  statOf(y).atk++;
}

/**
 * ② 닿음 (combat.js strike — 칼이 몸에 닿음 · clashGroup — 칼끼리 닿음 · secret_instant.js 운동학 칼): 공격 중인 y 가 그 겨눈 상대 x 에 닿음.
 *  그 칼이 끝난 바로 그 물리 스텝의 닿음(끝을 정한 판단 뒤 같은 스텝 물리 — 다 느려진 칼끝이 스침)도 그 공격의 닿음 → 막 건 굳음을 거둠
 */
export function bwTouch(y, x, kind = 'body') {
  const A = y?.bwAtk;
  if (A && A.tgt === x && !A.touched) A.touched = kind; // 'body' 몸 · 'blade' 칼끼리 · 'kin' 운동학 칼 (재기 — 처음 닿은 꼴)
  const E = y?.bwEnd;
  if (E && E.tgt === x && (y.fightT ?? 0) - E.t <= (y.lastDt ?? 0) + 1e-9) {
    y.bwEnd = null;
    y.bwStiffT = 0;
    const st = statOf(y);
    st.stiff--;
    st.touched++;
    st.late = (st.late ?? 0) + 1;
  }
}

/** ③-1 x 가 뒤 박차기를 검 (gait.js — 사람 스틱 뒤로 걷기 시작 · AI backBurstAi): x 를 겨눠 지금 나가는 중인 상대 칼들 (없으면 null) */
export function bwAim(x) {
  let out = null;
  for (const y of x.foes ?? (x.foe ? [x.foe] : [])) {
    const A = y?.bwAtk;
    if (A && A.tgt === x && inFlight(y)) (out ??= []).push(A);
  }
  return out;
}

/** ③-2 x 가 그 뒤 박찬 걸음을 실제로 뗌 (gait.js fastBegin): 건 때 적은 칼(list)이 아직 안 끝났으면 · 지금 x 를 겨눠 나가는 중인 칼이면 표시 */
export function bwBurst(x, list) {
  for (const A of [...(list ?? []), ...(bwAim(x) ?? [])]) {
    if (!A.live || A.burst) continue;
    A.burst = true;
    statOf(A.y).burst++;
  }
}

/** ④ y 의 공격이 끝남 (사람 whiffEnd · AI afterStrike): landed · bound = 그 몸이 센 맞힘 · 맞물림. 굳었으면 true */
export function bwAtkEnd(y, landed = false, bound = false) {
  const A = y.bwAtk;
  y.bwAtk = null;
  if (A) A.live = false;
  if (!A?.burst) return false;
  const st = statOf(y);
  if (!A.inReach) return void st.far++, false;
  if (A.touched || landed || bound) {
    st.touched++;
    const k = `t_${A.touched || (bound ? 'bound' : 'landed')}`;
    st[k] = (st[k] ?? 0) + 1; // 재기: 처음 닿은 꼴
    return false;
  }
  y.bwStiffT = BURST_WHIFF.stiff;
  y.bwEnd = { tgt: A.tgt, t: y.fightT ?? 0 }; // 같은 물리 스텝의 닿음이 오면 거둠 (bwTouch)
  st.stiff++;
  if (st.log.length < 64) st.log.push(y.fightT ?? 0);
  return true;
}

/** 공격이 끝나지 않고 거둬짐 (AI 공격 꼴을 afterStrike 없이 떠남 · 사람 덩이 없음): 기록만 지움 */
export function bwAtkDrop(y) {
  if (y.bwAtk) y.bwAtk.live = false;
  y.bwAtk = null;
}

/** 물리 스텝마다 (fighter.step): 굳음 시간이 줄어듦 */
export function bwTick(f, dt) {
  if (f.bwStiffT > 0) f.bwStiffT = Math.max(0, f.bwStiffT - dt);
}
