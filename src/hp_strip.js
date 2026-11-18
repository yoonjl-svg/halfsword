// ─────────────────────────────────────────────────────────────
//  동시 대전 체력 칸 (사장님 11/18 '생사전에서 좌측 상단에 캐릭터 체력바가 뜨는데 그거 없애고 기력바랑 같이 뜨게 해. 기력바 위나 아래에.
//   기력바랑 헷갈리지 않기 위해서 실선 모양의 바 말고 점선 모양의 바가 되어도 좋겠다. 10칸 정도로 구성해 봐. 원래 초록색이다가 80% 아래로 내려가면 노랑색
//   50% 아래로 내려가면 주황색 20% 아래로 내려가면 빨강색. 출혈이나 중상 이상의 부상 상태에서는 어떤 색이든 점멸.')
//  규칙만 (그림 없음 — Node 시험 tools/sim/hp_strip.test.mjs). 그리는 곳 = stamina_hud.js (머리 위 기력 막대 바로 위 · 동시 대전 판만 — teamRun · newTeamRound).
//  값 = config TEAM_FIGHT.hpStrip 한 곳 · 색 = index.html --hp-green · --hp-yellow · --hp-orange · --hp-red (편과 무관 — 아군 · 적 같은 색).
// ─────────────────────────────────────────────────────────────
import { TEAM_FIGHT, VITALS, SAENGSA } from './config.js';

const H = () => TEAM_FIGHT.hpStrip;

/** 체력 몫 0 ~ 1 (피 1 = 1 · 쓰러져 죽는 문턱 VITALS.collapseBlood = 0 · 죽으면 0) — 생사전 판 끝 체력(saengsa_match.js hpFromFighter)과 같은 잣대 */
export const hpShare = (f) => (f.alive ? Math.min(1, Math.max(0, (f.blood - VITALS.collapseBlood) / (1 - VITALS.collapseBlood))) : 0);

/**
 * 켜진 칸 수 = 올림(몫 × 칸 수) — 0 ~ cells.
 *  올림인 까닭: 산 몸은 늘 한 칸 이상(빈 막대 = 죽음으로만 읽힘 · 생사전 판 끝 체력도 산 사람은 적어도 1 — hpFromFighter) ·
 *  한 칸은 그 칸 몫(10 %)을 다 잃어야 꺼진다(가득 = 10 칸은 100 % 일 때만이 아니라 90 % 넘을 때). 아주 작은 셈 찌꺼기(1e-9)는 버린다.
 */
export function hpLit(share, cells = H().cells) {
  if (!(share > 0)) return 0;
  return Math.min(cells, Math.ceil(share * cells - 1e-9));
}

/** 색 갈래: 몫 ≥ 0.8 초록 · < 0.8 노랑 · < 0.5 주황 · < 0.2 빨강 (사장님 11/18 — 문턱 TEAM_FIGHT.hpStrip.tones) */
export function hpTone(share) {
  for (const [at, tone] of H().tones) if (share >= at) return tone;
  return H().low;
}

/**
 * 점멸 (사장님 11/18 '출혈이나 중상 이상의 부상 상태에서는 어떤 색이든 점멸') — 둘 가운데 하나면 참:
 *  ① 출혈: 지금 출혈 f.bleed(초당 잃는 피 — 전체 피 대비 · fighter.js updateVitals 가 굳는 만큼 줄임)가 hpStrip.bleedAt 넘게
 *     (1:1 화면 가장자리 출혈 맥박 main.js updateHud 와 같은 문턱 0.002 — 상처마다 출혈은 굳으며 줄어 이 밑이면 '멎음'으로 본다)
 *  ② 중상 이상: 몸에 난 칼날 상처(f.wounds — 베기 · 찌르기 · 잘린 단면 · 생사전에서 지고 들어온 부상 carried 포함) 가운데 심각도가
 *     생사전 중상 문턱 SAENGSA.seriousAt(0.5) 이상인 것이 하나라도 — 판이 끝나면 생사전이 '중상'으로 적을 상처(saengsa_rules.js isSerious · injuriesFromWounds)와 같은 잣대.
 *     둔기 · 막힌 타격은 상처를 남기지 않아(applyWound) 셈에 없다.
 *  죽은 몸은 칸이 없으니(그리지 않음) 따로 가르지 않는다.
 */
export function hpAlarm(f) {
  if ((f.bleed ?? 0) > H().bleedAt) return true;
  for (const w of f.wounds ?? []) if (w.severity >= SAENGSA.seriousAt) return true;
  return false;
}

/** 한 몸의 칸 상태 { lit, tone, blink, pct } (pct = 화면 읽기 0 ~ 100) */
export function hpStrip(f, cells = H().cells) {
  const share = hpShare(f);
  return { lit: hpLit(share, cells), tone: hpTone(share), blink: hpAlarm(f), pct: Math.round(share * 100) };
}

/** 기력 막대 위로 체력 칸이 차지하는 높이(px — 칸 높이 + 막대와의 틈): 그 위에 서는 것(칠 때 알림 느낌표 · 상대 머리 위 붉은 세모)이 이만큼 더 올라간다 */
export const hpLift = () => H().h + H().gap;
