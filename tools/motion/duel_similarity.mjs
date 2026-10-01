// ─────────────────────────────────────────────────────────────
//  실제 결투 동작 유사도 (동작 연구 PM, 디렉터 요청 10/1) — `stillness-duel-similarity/1`
//   게임 기록에서 뽑은 특징(장면마다) → 기준(클립 24벌 + 사람 움직임 봉투 + 문헌)과의 가까움 0~100.
//   정의·근거: docs/motion/duel_similarity_metric_2026-10-01.md. 사람 값은 참고이지 한도가 아니다.
//   쓰는 법: import { similarity } from './tools/motion/duel_similarity.mjs';
//            similarity({ zornhau: {...}, oberhau: {...}, zwerchhau: {...}, stand: {...}, walk: {...}, push: {...} })
//   특징 값은 장면의 판 중앙값(여러 판이면 중앙값을 넣는다). 없는 특징은 빼고 가중치를 다시 나눈다.
// ─────────────────────────────────────────────────────────────
export const VERSION = 'stillness-duel-similarity/1';

/**
 * 특징 기준: band = [아래, 위] 안이면 1점, 밖이면 거리 d 에 대해 exp(−½(d/w)²). w = 허용 폭.
 * src = 기준 출처 (봉투 = docs/motion/human_envelope_2026-09-30.md 표 번호).
 */
const CUT = {
  pelvisLeadMs: { band: [-130, -70], w: 40, wt: 3, src: '봉투 표3: 골반 최고 −108~−92 ms (칼끝 최고 = 0) · 골프 순서' },
  chestLeadMs: { band: [-70, -25], w: 30, wt: 2, src: '봉투 표3: 가슴 −58~−33 ms' },
  handLeadMs: { band: [-70, -30], w: 30, wt: 1, src: '봉투 표3: 손 −58~−42 ms' },
  orderOk: { band: [0.8, 1], w: 0.25, wt: 2, src: '골반 ≤ 가슴 ≤ 손 ≤ 칼끝 최고가 맞은 획 몫 (S 큰 획만) — 기준 클립 보통·크게 100 %' },
  pelvisYawPeak: { band: [200, 750], w: 150, wt: 2, src: '봉투 표1: 크게 321 °/s · 문헌 위 끝 야구 714 · 골프 480±82 °/s' },
  chestYawPeak: { band: [400, 1000], w: 200, wt: 2, src: '봉투 표1: 크게 678 °/s · 문헌 야구 937 · 골프 605±87 °/s' },
  pelvisDropRange: { band: [0.01, 0.10], w: 0.04, wt: 2, src: '봉투 표2: 골반 높이 폭 크게 0.08 m (런지는 더 — 런지는 이 척도 밖)' },
  bothFeetAir: { band: [0, 0.002], w: 0.01, wt: 2, src: '봉투 표2: 두 발 함께 뜸 0 (베기는 걷기·뛰기가 아님)' },
  footLoadP10: { band: [0.9, 1.3], w: 0.15, wt: 3, src: '발 수직 하중 합 ÷ 몸무게, 획 동안 p10. 사람 = 몸무게 전부가 발로 (보이지 않는 받침 없음)' },
  landMs: { band: [-40, 60], w: 60, wt: 1, src: '봉투 표3: 디딤 +9~25 ms (칼이 겨눈 선을 지날 때 딛음 — Döbringer·Meyer)' },
  liftMs: { band: [-360, -230], w: 80, wt: 1, src: '봉투 표3: 발 뗌 −300~−284 ms (크게, v1 이른 걸음)' },
  kneeMax: { band: [10, 90], w: 20, wt: 1, src: '봉투 표1: 무릎 굽힘 크게 ≤ 87° (서서 베기)' },
  legHf: { band: [0, 0.035], w: 0.03, wt: 2, src: '다리 각속도의 8 Hz 넘는 몫 — 사람 걷기·서기는 거의 0. 기준선 = 게임 C2 0.029 (진단 §6, 사람 값 아님)' },
};
export const REF = {
  cut: CUT,
  stand: {
    pelvisDropRange: { band: [0, 0.015], w: 0.01, wt: 2, src: '서 있기 골반 높이 흔들림 — 사람 조용히 서기 몸 흔들림 약 1 cm [기억]' },
    comSwayRms: { band: [0, 0.02], w: 0.015, wt: 2, src: '무게중심 수평 빠르기 RMS m/s — 사람 조용히 서기 약 0.01~0.02 [기억]' },
    footLoadP10: { band: [0.95, 1.05], w: 0.05, wt: 3, src: '서 있기 발 하중 합 ÷ 몸무게 = 1' },
    catchShare: { band: [0, 0], w: 0.05, wt: 2, src: '넘어짐 반사가 켜진 스텝 몫 — 그냥 서 있을 때 0' },
    legHf: { band: [0, 0.02], w: 0.02, wt: 2, src: '서 있기 다리 떨림 — 0 에 가까움' },
  },
  walk: {
    bothFeetAir: { band: [0, 0], w: 0.005, wt: 3, src: '걷기에는 두 발이 다 뜨는 때가 없다 (뛰기와 다른 점)' },
    footLoadP10: { band: [0.85, 1.3], w: 0.1, wt: 3, src: '걷기 발 하중 합 ÷ 몸무게 — 한 발로 디딜 때도 몸무게 전부' },
    pelvisBob: { band: [0.015, 0.06], w: 0.02, wt: 1, src: '걷기 골반 위아래 흔들림 — 사람 약 3~5 cm [기억], 검술 걸음은 낮게 걷는 편' },
    catchShare: { band: [0, 0.02], w: 0.05, wt: 2, src: '걷기 중 넘어짐 반사 — 거의 0' },
    legHf: { band: [0, 0.035], w: 0.03, wt: 1, src: '걷기 다리 떨림' },
  },
  push: {
    fell: { band: [0, 0], w: 0.3, wt: 3, src: '밀린 뒤 넘어짐 (0/1, 판 평균) — 보통 밀림이면 사람은 버틴다' },
    pelvisDropMax: { band: [0, 0.12], w: 0.05, wt: 2, src: '밀린 뒤 골반 최대 처짐 m — 무릎을 굽혀 낮추되 무너지지 않음 [추정]' },
    recoverS: { band: [0.3, 1.5], w: 0.5, wt: 2, src: '밀림 → 흔들림이 서 있기 수준으로 돌아오기까지 s — 사람 발목·엉덩이·한 걸음 전략 [추정]' },
    steps: { band: [0, 2], w: 1, wt: 1, src: '버티려 내딛는 걸음 수 — 사람은 0~2 걸음 (센 밀림이면 한 걸음)' },
    bothFeetAir: { band: [0, 0], w: 0.01, wt: 2, src: '밀린 뒤 두 발 뜸 0' },
    catchShare: { band: [0, 0.3], w: 0.2, wt: 1, src: '밀린 뒤 반사 켜진 몫 — 넘어지려는 짧은 순간만 (사람의 "반사" 몫)' },
  },
};
/** 장면 무게 (합 1): 베기 셋 0.5 · 서기 0.15 · 걷기 0.15 · 밀린 뒤 0.2 */
export const SCENE_WEIGHT = { zornhau: 1 / 6, oberhau: 1 / 6, zwerchhau: 1 / 6, stand: 0.15, walk: 0.15, push: 0.2 };

function featureScore(v, r) {
  const [lo, hi] = r.band;
  const d = v < lo ? lo - v : v > hi ? v - hi : 0;
  return Math.exp(-0.5 * (d / r.w) ** 2);
}
/** 장면 하나: { score 0~1, parts: { 특징: { value, score } } } */
export function sceneScore(kind, feats) {
  const ref = kind === 'stand' || kind === 'walk' || kind === 'push' ? REF[kind] : REF.cut;
  let s = 0, w = 0;
  const parts = {};
  for (const [k, r] of Object.entries(ref)) {
    const v = feats?.[k];
    if (v == null || !Number.isFinite(v)) continue;
    const f = featureScore(v, r);
    parts[k] = { value: v, score: +f.toFixed(3) };
    s += f * r.wt;
    w += r.wt;
  }
  return { score: w ? s / w : null, parts };
}
/** 전체: { total 0~100, scenes: { 장면: { score, parts } } } — 없는 장면은 빼고 무게를 다시 나눈다 */
export function similarity(scenes) {
  let s = 0, w = 0;
  const out = {};
  for (const [name, wt] of Object.entries(SCENE_WEIGHT)) {
    if (!scenes?.[name]) continue;
    const r = sceneScore(name, scenes[name]);
    out[name] = r;
    if (r.score == null) continue;
    s += r.score * wt;
    w += wt;
  }
  return { format: VERSION, total: w ? +((100 * s) / w).toFixed(1) : null, scenes: out };
}
