// ─────────────────────────────────────────────────────────────
//  live_common.mjs — R2 실전 진단 공용 (브라우저 하니스·시뮬 쌍둥이가 같은 것을 쓴다)
//   PROGRAMME  긋기 차림표 (패드 m, 손가락 표본 8 ms) + 패드 → 화면 px (input.js 배율)
//   PACINGS    rAF 프레임 간격 생성기 (씨앗 고정, 브라우저·쌍둥이 같은 수열)
//   RANGES     사람 관절 가동 범위 (출처·여유)      PEAKS  사람 최고 각속도·각가속도 (출처)
//   sampleFighter(ctx)  물리 스텝 한 번의 표본. 자기 완결: 모듈 밖 이름을 안 쓴다 → toString() 으로 페이지에 넣는다.
//                       ges·drive·strike 가 없는 체크아웃(main)에서도 돈다 (그 칸은 null)
//   summarise(samples, events, meta)  칸 하나의 요약 (뒤틀림·자기 몸 뚫림·흐물거림·과제·조종)
//   node tools/sim/live_common.mjs --selftest   합성 표본 검사 (곧은 팔·팔꿈치 젖힘·가슴 뚫은 아래팔·12 Hz 떨림·두 발 뜸·몸통 건너뛰기)
//  src 를 들이지 않는다. DOM 없음. 재기만 한다 — 자르기·한도·바닥 없음 (문턱은 판정 표시일 뿐 몸에 걸지 않는다)
// ─────────────────────────────────────────────────────────────

// ───────── 씨앗 난수 (det.mjs 와 같은 mulberry32) ─────────
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ───────── 패드 ↔ 화면 ─────────
// input.js: scale = INPUT.touchSensitivity / max(320, innerHeight) (패드 m / CSS px), +패드 y = 위 = 화면 −y
export const MAP_PHONE = { touchSensitivity: 2.6, innerWidth: 844, innerHeight: 390, minH: 320 }; // 가로 폰 844×390 → 1 패드 m = 150 px
export const pxPerPad = (map = MAP_PHONE) => Math.max(map.minH, map.innerHeight) / map.touchSensitivity;
/** 패드 이동 (dx, dy) → 화면 px (origin = 손가락을 댄 px) */
export function padToPx(dx, dy, origin, map = MAP_PHONE) {
  const k = pxPerPad(map);
  return [origin[0] + dx * k, origin[1] - dy * k];
}
/** 화면 px 이동 → 패드 m */
export function pxToPad(dxPx, dyPx, map = MAP_PHONE) {
  const k = pxPerPad(map);
  return [dxPx / k, -dyPx / k];
}

// ───────── 긋기 차림표 ─────────
// 패드 자세 (gesture_eval.mjs · gesture_touch.mjs 의 zornhau 감기와 같다): 쟁기 → 어깨 지붕(감기) → 왼쪽 바꿈 자세(긋기)
export const PAD = { PFLUG: [0.18, -0.28], TAG_R: [0.42, 0.42], WECHSEL_L: [-0.4, -0.42] };
const WIND_V = [PAD.TAG_R[0] - PAD.PFLUG[0], PAD.TAG_R[1] - PAD.PFLUG[1]]; // 감기 길 (0.740 m)
const CUT_V = [PAD.WECHSEL_L[0] - PAD.TAG_R[0], PAD.WECHSEL_L[1] - PAD.TAG_R[1]]; // 긋기 길 (1.174 m)
export const PROGRAMME = {
  sampleMs: 8, // 터치 표본 간격 (폰 디지타이저 120 Hz 급)
  startHoldMs: 2000, // 판 시작 발 묶임 (ARENA.startHold, fighter.feetHeld)
  idleMs: 3000, // 발이 풀린 뒤 가만히 서기 → 첫 긋기 (프로그램 시계 0 = 싸움 시작)
  standWinMs: [2500, 5000], // 서 있는 골반 높이 기준 창 (발 풀린 뒤 0.5 s 부터)
  gapMs: 800, // 긋기 사이 (손가락 뗌)
  dwellMs: 120, // 대고 쉼 (원점 잡기, gesture_touch.mjs 와 같다)
  pad0: PAD.PFLUG, // 하니스가 첫 긋기 전에 손 목표를 쟁기에 둔다 (chain.mjs setPad 처럼 handOffset·skill aim/aimRaw/anchor/prev)
  kinds: ['wind', 'straight'], // 감기 = 쟁기 → 어깨 지붕 → 뒤집어 바꿈 자세로 / 긋기 = 같은 긋기 길 한 번 (감기 없음, 대는 자리에서)
  amps: { small: 0.5, mid: 0.75, large: 1.0 }, // gesture_touch 길 길이의 배율 (두 다리 모두)
  // 패드 m/s. slow = gesture_touch.mjs 기본 (감기 1.0 · 긋기 4.0): 150 px/m → 긋기 600 px/s ≈ 유리 위 0.10 m/s, 천천히 끄는 엄지.
  //  fast = chain.mjs W 변형 (감기 3 m/s · 긋기 v 12 m/s 기본값): 1800 px/s ≈ 0.3 m/s, 빠른 엄지 튕기기 (관문 격자 3–20 m/s 안).
  //  vStrike 1.5 m/s 가 느린 감기(1.0)와 빠른 감기(3.0) 사이 — B(긋기 입력)는 빠른 감기 다리를 제 긋기로 읽는 설계
  speeds: { slow: { wind: 1.0, cut: 4.0 }, fast: { wind: 3.0, cut: 12.0 } },
  touches: ['clean', 'cont'], // clean = 긋고 한 표본 뒤 뗌 / cont = 댄 채 0.6 s 살짝 흔들리다 뗌
  cleanLiftMs: 8,
  cont: { ms: 600, ampPad: 0.03, fxHz: 1.3, fyHz: 0.9, phase: 0.7, noisePx: 0.5 }, // 흔들림: 4.5 px 리사주 (최고 ≈ 0.25 m/s = restV 문턱 근처) + ±0.5 px 고른 떨림
  originPx: [600, 200], // 칼 쪽 엄지를 대는 자리 (844×390, 오른쪽 반, 조이스틱·위 단추 밖)
  seed: 20260930,
  passive: { gapM: 1.3, foe: 'heinrich', weapon: 'longsword', ai: 'stub' }, // 가슴–가슴 수평 거리 (fighter.foeDistance)
  fight: { foe: 'heinrich', weapon: 'longsword', rounds: 2, maxS: 60, walkInM: 1.6, walkStopM: 1.3, stickDeflect: 0.9, stickR: 40 }, // 조이스틱: 멀면 앞으로 (R 40 px 의 0.9)
};

/** 12 변형 (감기·긋기 × 작게·보통·크게 × 느리게·빠르게) */
export function variants() {
  const out = [];
  for (const kind of PROGRAMME.kinds) for (const amp of Object.keys(PROGRAMME.amps)) for (const speed of Object.keys(PROGRAMME.speeds)) out.push({ id: `${kind}-${amp}-${speed}`, kind, amp, speed });
  return out;
}

/** 다리 하나: from → from + d, 빠르기 v (패드 m/s), 8 ms 표본 (마지막 표본이 끝). 표본 [t, x, y, 1] 을 pts 에 넣고 끝 시각 */
function leg(pts, t0, from, d, v) {
  const L = Math.hypot(d[0], d[1]);
  const step = PROGRAMME.sampleMs;
  const n = Math.max(1, Math.round((L / v) * 1000 / step));
  for (let k = 1; k <= n; k++) pts.push([t0 + k * step, from[0] + (d[0] * k) / n, from[1] + (d[1] * k) / n, 1]);
  return t0 + n * step;
}

/**
 * 한 획: 손가락 표본 [t ms, dx, dy, phase] (dx·dy = 댄 자리에서의 패드 이동, phase 0 댐 · 1 움직임 · 2 뗌).
 *  멈춰 있는 동안은 표본을 내지 않는다 (같은 자리 touchMove 는 보내지 않는다 — 쌍둥이 inputPump 와 같게)
 *  때: tDown · tCutStart (감기 꼭짓점 / 긋기 시작) · tCutEnd (긋기 마지막 표본) · tLift · tEnd (다음 획이 대는 때)
 */
export function buildStroke(v, touch, t0, rand, map = MAP_PHONE) {
  const P = PROGRAMME;
  const a = P.amps[v.amp];
  const sp = P.speeds[v.speed];
  const pts = [[t0, 0, 0, 0]];
  let t = t0 + P.dwellMs;
  let tCutStart;
  let at = [0, 0];
  if (v.kind === 'wind') {
    const dw = [WIND_V[0] * a, WIND_V[1] * a];
    t = leg(pts, t, at, dw, sp.wind);
    at = dw;
    tCutStart = t; // 꼭짓점 (뒤집힘)
  } else tCutStart = t;
  const dc = [CUT_V[0] * a, CUT_V[1] * a];
  t = leg(pts, t, at, dc, sp.cut);
  at = [at[0] + dc[0], at[1] + dc[1]];
  const tCutEnd = t;
  let tLift;
  if (touch === 'cont') {
    const C = P.cont;
    const nz = C.noisePx / pxPerPad(map);
    const s0 = Math.sin(C.phase);
    for (let k = 1; (k * P.sampleMs) <= C.ms; k++) {
      const tau = (k * P.sampleMs) / 1000;
      const x = at[0] + C.ampPad * Math.sin(2 * Math.PI * C.fxHz * tau) + (2 * rand() - 1) * nz;
      const y = at[1] + C.ampPad * (Math.sin(2 * Math.PI * C.fyHz * tau + C.phase) - s0) + (2 * rand() - 1) * nz;
      pts.push([tCutEnd + k * P.sampleMs, x, y, 1]);
    }
    tLift = tCutEnd + C.ms;
  } else tLift = tCutEnd + P.cleanLiftMs;
  const last = pts[pts.length - 1];
  pts.push([tLift, last[1], last[2], 2]);
  return { id: `${v.id}-${touch}`, kind: v.kind, amp: v.amp, speed: v.speed, touch, samples: pts, tDown: t0, tCutStart, tCutEnd, tLift, tEnd: tLift + P.gapMs };
}

/**
 * 차림표 한 벌 (24 획 = 12 변형 × clean·cont), loops 번 되풀이. 시계 = 프로그램 ms (0 = 싸움 시작, 첫 획 = startHold + idle)
 *  브라우저: 페이지 시계 = 싸움 시작 페이지 ms + t, CDP timestamp = (timeOrigin + 페이지 ms) / 1000.
 *  쌍둥이: 벽시계 = 싸움 시작 P.wall + t
 */
export function buildProgramme({ loops = 1, seed = PROGRAMME.seed, map = MAP_PHONE, t0 = PROGRAMME.startHoldMs + PROGRAMME.idleMs } = {}) {
  const rand = rng(seed);
  const strokes = [];
  let t = t0;
  for (let L = 0; L < loops; L++)
    for (const v of variants())
      for (const touch of PROGRAMME.touches) {
        const s = buildStroke(v, touch, t, rand, map);
        s.loop = L;
        s.idx = strokes.length;
        strokes.push(s);
        t = s.tEnd;
      }
  return { strokes, t0, tEnd: t, map, originPx: PROGRAMME.originPx, standWinMs: PROGRAMME.standWinMs };
}

/** 획 표본 → 화면 px [t, x, y, phase] (댄 자리 originPx) */
export function strokePx(stroke, originPx = PROGRAMME.originPx, map = MAP_PHONE) {
  return stroke.samples.map(([t, x, y, ph]) => [t, ...padToPx(x, y, originPx, map), ph]);
}

/** 프로그램 때 → 벽시계(표본 tw 와 같은 시계) 획 창 (summarise meta.strokes) */
export function strokeWindows(prog, wall0) {
  return prog.strokes.map((s) => ({ id: s.id, idx: s.idx, kind: s.kind, amp: s.amp, speed: s.speed, touch: s.touch, twDown: wall0 + s.tDown, twCutStart: wall0 + s.tCutStart, twCutEnd: wall0 + s.tCutEnd, twLift: wall0 + s.tLift, twEnd: wall0 + s.tEnd }));
}

/** FIGHT 조이스틱 (몸 멀면 앞으로, 가까우면 놓음 — 걸음 입력만, 사이 간격 walkStop–walkIn 은 그대로) → { on, dx, dy } px (조이스틱 가운데 기준) */
export function stickCommand(dist, wasOn) {
  const F = PROGRAMME.fight;
  const on = wasOn ? dist > F.walkStopM : dist > F.walkInM;
  return { on, dx: 0, dy: on ? -F.stickR * F.stickDeflect : 0 };
}

// ───────── 프레임 빠르기 ─────────
//  steady: 늘 mean. jit: mean × (1 + U(−jitter, +jitter)), 그리고 hitchEveryMs × U(1 − spread, 1 + spread) 마다 한 프레임이 U(hitchMs) (멈칫).
//   mean 은 멈칫 아닌 프레임의 평균 (멈칫이 평균을 조금 올린다 — 자체 검사가 실제 평균을 찍는다)
//  chainJ: chain.mjs jitterPump 그대로 — js = (seed·2654435761)>>>0, 프레임마다 js = js·1664525 + 1013904223, hz = 24 + 21·js/2³², 간격 1000/hz (24–45 fps)
export const PACINGS = {
  120: { kind: 'steady', mean: 1000 / 120 },
  60: { kind: 'steady', mean: 1000 / 60 },
  45: { kind: 'steady', mean: 1000 / 45 },
  '45J': { kind: 'jit', mean: 1000 / 45, jitter: 0.35, hitchEveryMs: 2000, hitchSpread: 0.25, hitchMs: [60, 100] },
  30: { kind: 'steady', mean: 1000 / 30 },
  '30J': { kind: 'jit', mean: 1000 / 30, jitter: 0.35, hitchEveryMs: 2000, hitchSpread: 0.25, hitchMs: [60, 100] },
  J: { kind: 'chainJ', hzMin: 24, hzSpan: 21 },
};
export const PACING_NAMES = ['120', '60', '45', '45J', '30', '30J', 'J'];

/** 프레임 간격 생성기: next() → ms. seed 는 'J' 에서 chain.mjs SEED (기본 7), 나머지는 mulberry32 씨앗 */
export function pacer(name, seed = 7) {
  const P = PACINGS[name];
  if (!P) throw new Error(`모르는 pacing ${name}`);
  let t = 0;
  if (P.kind === 'steady') return { name, next: () => ((t += P.mean), P.mean), get t() { return t; } };
  if (P.kind === 'chainJ') {
    let js = (seed * 2654435761) >>> 0;
    return {
      name,
      next() {
        js = (Math.imul(js, 1664525) + 1013904223) >>> 0;
        const dt = 1000 / (P.hzMin + (P.hzSpan * js) / 4294967296);
        t += dt;
        return dt;
      },
      get t() { return t; },
    };
  }
  const r = rng(seed);
  const gapNext = () => P.hitchEveryMs * (1 - P.hitchSpread + 2 * P.hitchSpread * r());
  let hitchAt = gapNext();
  return {
    name,
    next() {
      let dt;
      if (t >= hitchAt) {
        dt = P.hitchMs[0] + (P.hitchMs[1] - P.hitchMs[0]) * r();
        hitchAt = t + dt + gapNext();
      } else dt = P.mean * (1 + P.jitter * (2 * r() - 1));
      t += dt;
      return dt;
    },
    get t() { return t; },
  };
}

// ───────── 사람 가동 범위 (도) ─────────
//  출처 열쇠는 tools/motion/lib/sources.mjs (aaos_rom 등). [기억] = 원문 대조 전 (동작 연구 PM 봉투 문서와 같은 표시).
//  여유(margin)는 잰 각의 오차(몸체 틀 ≠ 뼈 선, 캡슐 근사)만큼 — 판정 표시일 뿐 한도가 아니다
export const RANGES = {
  src: {
    aaos: 'AAOS 관절 가동 범위 1965 (Greene & Heckman 1994) — tools/motion/lib/sources.mjs aaos_rom',
    envelope: '동작 연구 PM 사람 움직임 봉투 (main 4dd17bf tools/motion/human_envelope.json · docs/motion/human_envelope_2026-09-30.md): 클립 24벌(저작, 모캡 아님) + 문헌',
    memory: '[기억] 원문 대조 전 교과서 값 (Norkin & White 가 옮긴 AAOS 표)',
  },
  shoulderElev: { lo: 0, hi: 180, margin: 0, flag: false, src: 'aaos: 굽힘·벌림 180 (들림 0–180) — 정의상 0–180, 기록만' },
  // 몸 앞면(이마면) 뒤로 넘어간 각 β = asin(max(0, −u·앞)) 의 들림별 한계 (선형 보간): 내린 팔 폄 60, 수평 벌림 45 (들림 90), 머리 위 0
  shoulderBehind: { byElev: [[0, 60], [90, 45], [180, 0]], margin: 10, src: 'aaos: 폄 60 · 수평 벌림 45 [기억] (봉투 shPlaneS 문헌 칸과 같음)' },
  // 몸 앞 가로지름: 들림면 plane > 135 (수평 모음 135) — 들림 60–170 에서만 (낮은 팔의 가로지름은 몸통 부피 검사가 본다)
  shoulderAcross: { planeMax: 135, elevMin: 60, elevMax: 170, margin: 10, src: 'aaos: 수평 모음 135 [기억] (봉투: 약 130)' },
  elbow: { lo: -10, hi: 150, margin: 5, src: 'aaos: 굽힘 150; 젖힘 0–10 은 흔한 개인차 [기억]' },
  wrist: { lo: 0, hi: 150, margin: 10, src: '봉투 wrist: 아래팔–칼 각 135–160° 부터 무리 (손목 굽힘 80·폄 70 + 쥔 손가락)' },
  hipFlex: { lo: -30, hi: 120, margin: 10, src: 'aaos: 엉덩관절 굽힘 120 · 폄 30 (봉투 hipL 문헌 칸)' },
  hipAbd: { lo: -30, hi: 45, margin: 10, src: 'aaos: 벌림 45 · 모음 30 [기억]' },
  hipRot: { lo: -45, hi: 45, margin: 10, src: 'aaos_rom: 엉덩이 안쪽·바깥 돌림 45 (+ = 안쪽)' },
  knee: { lo: -10, hi: 135, margin: 5, src: 'aaos: 무릎 굽힘 135 (봉투 kneeL 문헌 칸); 젖힘 0–10 [기억]' },
  spineTwist: { lo: -45, hi: 45, margin: 10, src: 'aaos_rom: 가슴허리 돌림 45 (한쪽) · 골프 X-factor 40–60 (golf_xfactor)' },
  spineFlex: { lo: -25, hi: 80, margin: 10, src: 'aaos: 가슴허리 굽힘 80 · 폄 25 [기억]' },
  spineSide: { lo: -35, hi: 35, margin: 10, src: 'aaos: 가슴허리 옆굽힘 35 [기억]' },
  // 사람 범위가 아니라 물리 풀이가 관절을 지키지 못한 것 (탈구 같은 벌어짐): 따로 센다
  constraint: { anchorSepM: 0.02, hingeOffDeg: 10, src: '선언: 관절 기준점 2 cm 넘게 벌어짐 · 경첩 축 밖 10° 넘게 돎 = 물리 풀이가 관절을 놓침' },
};

// ───────── 사람 최고 각속도 (도/초) · 각가속도 (도/초², 유도) ─────────
//  각가속도 문헌 값은 없다 (봉투도 "클립 곡선 값이라 사람 한계로 읽지 말 것") → 유도: α ≈ (π/2)·ω최고 / 오름 시간 (사인 모양 가속),
//   오름 시간 선언: 팔 0.05 s (던지기 가속 구간), 몸통 0.10 s, 다리 0.08 s. 배수로 읽는다
export const PEAKS = {
  rise: { arm: 0.05, trunk: 0.1, legs: 0.08 },
  joints: {
    shS: { group: 'arm', w: 7000, src: '위팔 돌림 포함 전체: 야구 던지기 안쪽 돌림 ≈ 7000 °/s [기억: Fleisig 외 1995]' },
    shSsw: { group: 'arm', w: 2500, src: '위팔 방향(휘두름) 각속도: 문헌 값 없음 — 던지기 팔꿈치와 같은 자리수로 선언 (봉투 클립 크게 2478 °/s)' },
    shO: { group: 'arm', w: 7000, src: 'shS 와 같음' },
    shOsw: { group: 'arm', w: 2500, src: 'shSsw 와 같음 (봉투 빈쪽 클립 크게 3708 °/s 는 IK 튐 섞임)' },
    elS: { group: 'arm', w: 2500, src: '던지기 팔꿈치 폄 2200–2500 °/s [기억: Fleisig 외 1995] (봉투 elbowS 문헌 칸)' },
    elO: { group: 'arm', w: 2500, src: 'elS 와 같음' },
    wrS: { group: 'arm', w: 2000, src: '선언: 문헌 값 없음 (봉투 아래팔–칼 각 클립 크게 1789 °/s)' },
    sp: { group: 'trunk', w: 1000, src: '선언: 가슴–골반 상대 각속도 ≤ 윗몸 절대 최고 937 °/s (baseball_sequence Welch 1995) — 문헌 상대 값 없음' },
    pelY: { group: 'trunk', w: 750, src: '골반 돌림: 야구 타격 714 °/s (baseball_sequence Welch 1995) · 골프 480±82 (golf_sequence); 봉투 "골반 > 약 750 은 엘리트도 넘음"' },
    chY: { group: 'trunk', w: 1000, src: '가슴 돌림: 야구 937 °/s · 성인 857 (baseball_sequence Escamilla 2009) · 골프 605±87; 봉투 "윗몸 > 약 1000"' },
    hipF: { group: 'legs', w: 800, src: '선언 [기억]: 차기 동작 엉덩관절 굽힘 수백 °/s 대 (서서 베는 동작은 봉투 클립 크게 326 °/s)' },
    hipB: { group: 'legs', w: 800, src: 'hipF 와 같음' },
    knF: { group: 'legs', w: 1500, src: '[기억]: 공 차기 무릎 폄 1500–2300 °/s 의 낮은 끝 (Lees & Nolan 1998); 봉투 클립 크게 477 °/s' },
    knB: { group: 'legs', w: 1500, src: 'knF 와 같음' },
    anF: { group: 'legs', w: 1000, src: '선언: 펜싱 런지 뒷발목 폄 564±132 °/s (fencing_mulloy) 의 약 2 배' },
    anB: { group: 'legs', w: 1000, src: 'anF 와 같음' },
  },
};
for (const k in PEAKS.joints) {
  const J = PEAKS.joints[k];
  J.a = Math.round(((Math.PI / 2) * J.w) / PEAKS.rise[J.group]);
}
// 떨림 띠: 맘대로 하는 되풀이 움직임은 약 5–7 Hz 아래, 생리 떨림 8–12 Hz [기억: McAuley & Marsden 2000 Brain 123:1545]
export const OSC = { band: [3, 20], highAbove: 8, winS: 1.0, hopS: 0.5, signals: ['elS', 'shElevS', 'kneeF', 'kneeB', 'hipFlexF', 'hipFlexB', 'spTw', 'pelY', 'chW'], src: '맘대로 되풀이 움직임 ≲ 5–7 Hz, 생리 떨림 8–12 Hz [기억: McAuley & Marsden 2000]' };
// 선언 값 (재기만: 판정 표시)
export const DECL = {
  penTolM: 0.01, // 자기 몸 뚫림 깊이 문턱 (모양이 거친 상자·캡슐이라 1 cm 아래는 셈하지 않는다)
  handR: 0.04, // 손 공 반지름 (손 콜라이더가 없다: farmS (0.13, 0, 0) 쥔 점)
  trunkPrism: { x: [-0.11, 0.11], y: [-0.45, 0.13], z: [-0.18, 0.18] }, // 가슴 틀 몸통 기둥 (가슴 상자 + 아래로 배·골반까지)
  teleportK: 3, // 스텝 (25 ms) 안에 몸통 기둥을 건너면 순간 이동
  limbR: { hand: 0.04, elbow: 0.045 },
  footMarginM: 0.02, // 엔진 접촉을 못 읽을 때만: 발바닥 가장 낮은 모서리 < 2 cm 면 닿음
  bothOffMinS: 0.1,
  pelvisWinS: 0.5,
  settleS: 0.5, // 판 시작 뒤 이 시간(fightT)의 표본은 빼고 잰다: 몸이 처음 놓이며 발이 땅에 닿기까지 (쌍둥이 쉬는 자세: 첫 0.1 s 두 발 뜸, 빈팔 배 안쪽)
  g: 9.81,
};

// 표본의 부위 × 부피 뚫림 배열 순서
export const PEN_PARTS = ['uarm', 'farm', 'hand', 'blade', 'hilt', 'farmO'];
export const PEN_VOLS = ['chest', 'abdomen', 'pelvis', 'thighF', 'thighB'];
export const FAMS = ['diagR', 'diagL', 'vert', 'horizR', 'horizL', 'riseR', 'riseL'];
export const CUTS = ['zornhau', 'oberhau', 'mittelhau', 'unterhau'];
export const STATES = ['stand', 'down', 'getup', 'kneel', 'dead'];

// ─────────────────────────────────────────────────────────────
//  물리 스텝 한 번의 표본 (world.step·combat.afterStep 뒤에 부른다). 자기 완결 — 이 함수 밖 이름을 쓰지 않는다.
//   ctx = { f (파이터), world (Rapier World, 없으면 발 닿음은 높이로), t (게임 s), tw (벽시계 ms = f.stepT), dt (물리 s), st ({} — 파이터마다 하나, 차분용), meta (참이면 충돌 그룹 보고) }
//   각 도, 각속도 도/초, 각가속도 도/초², 길이 m, 힘 N. 없는 것은 null
// ─────────────────────────────────────────────────────────────
export function sampleFighter(ctx) {
  const f = ctx.f;
  const W = ctx.world || null;
  const st = ctx.st || (ctx.st = {});
  const HAND_R = ctx.handR ?? 0.04;
  const FOOT_M = ctx.footMargin ?? 0.02;
  const R2D = 180 / Math.PI;
  const Q = (r) => [r.x, r.y, r.z, r.w];
  const P = (v) => [v.x, v.y, v.z];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qinv = (a) => [-a[0], -a[1], -a[2], a[3]];
  const qrot = (q, v) => {
    const x = q[0], y = q[1], z = q[2], w = q[3];
    const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
    return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
  };
  const wrapD = (a) => { a = ((a + 180) % 360 + 360) % 360 - 180; return a; };
  const clamp1 = (x) => (x > 1 ? 1 : x < -1 ? -1 : x);
  const B = f.bodies || {};
  const has = (n) => !!B[n];
  const bq = (n) => Q(B[n].rotation());
  const bp = (n) => P(B[n].translation());
  const bw = (n) => P(B[n].angvel());
  const pt = (n, local) => add(bp(n), qrot(bq(n), local)); // 몸체 점 → 월드
  const toLocal = (q, o, p) => qrot(qinv(q), sub(p, o));
  const s = { t: ctx.t ?? null, tw: ctx.tw ?? (f.stepT ?? null), dt: ctx.dt ?? null };
  const stCode = { stand: 0, down: 1, getup: 2, kneel: 3, dead: 4 }[f.state];
  s.st = stCode ?? -1;
  s.fightT = f.fightT ?? null;
  const side = f.side || 1;
  // ── 관절 각 ──
  const qc = bq('chest'), qp = bq('pelvis');
  const shoulder = (arm, bone, lat) => {
    const u = qrot(qinv(qc), qrot(bq(arm), bone));
    const up = u[1], fw = u[0], out = u[2] * lat;
    return [Math.acos(clamp1(-up)) * R2D, Math.atan2(fw, out) * R2D, Math.asin(Math.max(0, Math.min(1, -fw))) * R2D];
  };
  [s.shElevS, s.shPlaneS, s.shBehindS] = shoulder('uarmS', [1, 0, 0], side);
  [s.shElevO, s.shPlaneO, s.shBehindO] = shoulder('uarmO', [0, -1, 0], -side);
  const hinge = (par, chi) => {
    const q = qmul(qinv(bq(par)), bq(chi));
    return [wrapD(2 * Math.atan2(q[2], q[3]) * R2D), 2 * Math.asin(Math.min(1, Math.hypot(q[0], q[1]))) * R2D];
  };
  let offElS, offElO, offKnF, offKnB;
  [s.elS, offElS] = hinge('uarmS', 'farmS');
  [s.elO, offElO] = hinge('uarmO', 'farmO');
  [s.kneeF, offKnF] = hinge('thighF', 'shinF');
  [s.kneeB, offKnB] = hinge('thighB', 'shinB');
  s.kneeF = -s.kneeF;
  s.kneeB = -s.kneeB;
  s.offElS = offElS;
  s.offElO = offElO;
  s.offKnF = offKnF;
  s.offKnB = offKnB;
  const qs = f.sword ? Q(f.sword.rotation()) : null;
  s.wrS = qs ? Math.acos(clamp1(dot(qrot(bq('farmS'), [1, 0, 0]), qrot(qs, [0, 1, 0])))) * R2D : null;
  const hip = (thigh, legSide) => {
    const qt = bq(thigh);
    const t = qrot(qinv(qp), qrot(qt, [0, -1, 0]));
    const q = qmul(qinv(qp), qt);
    return [Math.atan2(t[0], -t[1]) * R2D, Math.atan2(t[2] * legSide, -t[1]) * R2D, wrapD(2 * Math.atan2(q[1], q[3]) * R2D) * legSide];
  };
  [s.hipFlexF, s.hipAbdF, s.hipRotF] = hip('thighF', side);
  [s.hipFlexB, s.hipAbdB, s.hipRotB] = hip('thighB', -side);
  {
    const q = qmul(qinv(qp), qc);
    const cu = qrot(q, [0, 1, 0]);
    s.spTw = wrapD(2 * Math.atan2(q[1], q[3]) * R2D);
    s.spFlex = Math.atan2(cu[0], cu[1]) * R2D;
    s.spSide = Math.atan2(cu[2], cu[1]) * R2D;
  }
  // ── 관절 기준점 벌어짐 (물리 풀이가 관절을 놓쳤나) ──
  let sepMax = 0, sepJ = null;
  const sepOf = (joint, pb, cb, name) => {
    if (!joint || !joint.anchor1 || !pb || !cb) return;
    if (joint.isValid && !joint.isValid()) return; // 세계에서 뗀 관절 (칼 떨굼 dropSword 은 gripJoint 를 남겨 둔다): 읽으면 wasm 이 죽는다
    const a = add(P(pb.translation()), qrot(Q(pb.rotation()), P(joint.anchor1())));
    const b = add(P(cb.translation()), qrot(Q(cb.rotation()), P(joint.anchor2())));
    const d = len(sub(a, b));
    if (d > sepMax) (sepMax = d), (sepJ = name);
  };
  for (const j of f.joints || []) sepOf(j.joint, j.parent, j.child, j.name);
  if (f.gripJoint && f.sword && f.armed !== false) sepOf(f.gripJoint, B.farmS, f.sword, 'grip');
  s.sepMax = sepMax;
  s.sepJ = sepJ;
  // ── 상대 각속도 (몸체 angvel 차) · 각가속도 (앞 스텝과의 차분) ──
  const tg = s.t;
  const dtg = st.tPrev != null && tg != null && tg > st.tPrev ? tg - st.tPrev : ctx.dt || 1 / 120;
  const wPrev = st.wPrev || (st.wPrev = {});
  const pairs = [['shS', 'chest', 'uarmS'], ['shO', 'chest', 'uarmO'], ['elS', 'uarmS', 'farmS'], ['elO', 'uarmO', 'farmO'], ['sp', 'pelvis', 'chest'], ['hipF', 'pelvis', 'thighF'], ['hipB', 'pelvis', 'thighB'], ['knF', 'thighF', 'shinF'], ['knB', 'thighB', 'shinB'], ['anF', 'shinF', 'footF'], ['anB', 'shinB', 'footB']];
  const rel = {};
  for (const [k, a, b] of pairs) if (has(a) && has(b)) rel[k] = sub(bw(b), bw(a));
  if (f.sword) rel.wrS = sub(P(f.sword.angvel()), bw('farmS'));
  const swing = (k, arm, bone) => {
    const u = qrot(bq(arm), bone);
    const w = rel[k];
    if (w) rel[k + 'sw'] = sub(w, mul(u, dot(w, u)));
  };
  swing('shS', 'uarmS', [1, 0, 0]);
  swing('shO', 'uarmO', [0, -1, 0]);
  rel.pelY = [0, bw('pelvis')[1], 0];
  rel.chY = [0, bw('chest')[1], 0];
  for (const k in rel) {
    const w = rel[k];
    s['w_' + k] = len(w) * R2D;
    const p = wPrev[k];
    s['a_' + k] = p ? (len(sub(w, p)) * R2D) / dtg : null;
    wPrev[k] = w;
  }
  s.chW = len(bw('chest')) * R2D;
  // ── 골반·무게중심·발 ──
  const pel = bp('pelvis');
  s.pelX = pel[0];
  s.pelY = pel[1];
  s.pelZ = pel[2];
  s.comY = f.com ? f.com.y : null;
  const mass = f.totalMass || null;
  s.mass = mass;
  const foot = (n) => {
    const b = B[n];
    const q = Q(b.rotation()), c = P(b.translation());
    let low = Infinity;
    for (const x of [-0.12, 0.12]) for (const z of [-0.05, 0.05]) low = Math.min(low, add(c, qrot(q, [x, -0.035, z]))[1]);
    let imp = 0, ok = false;
    const col = b.numColliders && b.numColliders() > 0 ? b.collider(0) : null;
    if (W && W.contactPairsWith && W.contactPair && col) {
      ok = true;
      W.contactPairsWith(col, (other) => {
        const pb = other.parent ? other.parent() : null;
        if (pb && pb.isFixed && pb.isFixed()) W.contactPair(col, other, (m) => { for (let i = 0, n2 = m.numContacts(); i < n2; i++) imp += m.contactImpulse(i); });
      });
    }
    const ts = (W && W.timestep) || ctx.dt || 1 / 120;
    return ok ? [imp > 0 ? 1 : 0, imp / ts, low] : [low < FOOT_M ? 1 : 0, null, low];
  };
  [s.cF, s.NF, s.soleF] = foot('footF');
  [s.cB, s.NB, s.soleB] = foot('footB');
  s.load = s.NF != null && s.NB != null && mass ? (s.NF + s.NB) / (mass * 9.81) : null;
  const G = f.gait || null;
  s.stF = G ? (G.legs.F.stance ? 1 : 0) : null;
  s.stB = G ? (G.legs.B.stance ? 1 : 0) : null;
  s.lev = G ? G.lev ?? null : null;
  s.levC = G ? G.levC ?? null : null;
  s.levH = G ? G.levH ?? null : null;
  s.gaitOn = G ? (G.active ? 1 : 0) : null;
  s.support = f.support ?? null;
  s.offBal = f.offBalance ?? null;
  // ── 자기 몸 뚫림: 부위 [uarm 먼 절반, farm, hand, blade, hilt, farmO] × 부피 [chest, abdomen, pelvis, thighF, thighB], 깊이 m (0 = 안 뚫음) ──
  const shapeOf = (col) => {
    const ty = col.shapeType ? col.shapeType() : -1;
    const c = P(col.translation()), q = Q(col.rotation());
    if (ty === 1) return { box: true, c, q, h: P(col.halfExtents()) };
    if (ty === 2) { const ax = qrot(q, [0, col.halfHeight(), 0]); return { box: false, a: sub(c, ax), b: add(c, ax), r: col.radius() }; }
    if (ty === 0) return { box: false, a: c, b: c, r: col.radius() };
    return null;
  };
  const sdBox = (p, h) => {
    const qx = Math.abs(p[0]) - h[0], qy = Math.abs(p[1]) - h[1], qz = Math.abs(p[2]) - h[2];
    const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
    return out + Math.min(Math.max(qx, qy, qz), 0);
  };
  const segBox = (a, b, bx) => {
    // 선분 위 상자 부호 거리의 최소 (볼록 → 황금 분할)
    const la = toLocal(bx.q, bx.c, a), lb = toLocal(bx.q, bx.c, b);
    const at = (u) => sdBox([la[0] + (lb[0] - la[0]) * u, la[1] + (lb[1] - la[1]) * u, la[2] + (lb[2] - la[2]) * u], bx.h);
    let lo = 0, hi = 1;
    const g = 0.6180339887;
    let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), f1 = at(x1), f2 = at(x2);
    for (let i = 0; i < 40; i++) {
      if (f1 < f2) (hi = x2), (x2 = x1), (f2 = f1), (x1 = hi - g * (hi - lo)), (f1 = at(x1));
      else (lo = x1), (x1 = x2), (f1 = f2), (x2 = lo + g * (hi - lo)), (f2 = at(x2));
    }
    return Math.min(f1, f2, at(0), at(1));
  };
  const segSeg = (p1, q1, p2, q2) => {
    const d1 = sub(q1, p1), d2 = sub(q2, p2), r = sub(p1, p2);
    const a = dot(d1, d1), e = dot(d2, d2), ff = dot(d2, r);
    let sN, tN;
    if (a <= 1e-12 && e <= 1e-12) return len(r);
    if (a <= 1e-12) { sN = 0; tN = Math.min(1, Math.max(0, ff / e)); }
    else {
      const c = dot(d1, r);
      if (e <= 1e-12) { tN = 0; sN = Math.min(1, Math.max(0, -c / a)); }
      else {
        const bb = dot(d1, d2), den = a * e - bb * bb;
        sN = den > 1e-12 ? Math.min(1, Math.max(0, (bb * ff - c * e) / den)) : 0;
        tN = (bb * sN + ff) / e;
        if (tN < 0) { tN = 0; sN = Math.min(1, Math.max(0, -c / a)); }
        else if (tN > 1) { tN = 1; sN = Math.min(1, Math.max(0, (bb - c) / a)); }
      }
    }
    return len(sub(add(p1, mul(d1, sN)), add(p2, mul(d2, tN))));
  };
  const boxBox = (A, Bx) => {
    // 분리축 (15 축): 겹친 깊이의 최소 (음수 = 떨어짐)
    const ax = [qrot(A.q, [1, 0, 0]), qrot(A.q, [0, 1, 0]), qrot(A.q, [0, 0, 1])];
    const bx = [qrot(Bx.q, [1, 0, 0]), qrot(Bx.q, [0, 1, 0]), qrot(Bx.q, [0, 0, 1])];
    const T = sub(Bx.c, A.c);
    const cand = [...ax, ...bx];
    for (const u of ax) for (const v of bx) {
      const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const l = len(c);
      if (l > 1e-6) cand.push(mul(c, 1 / l));
    }
    let best = Infinity;
    for (const L of cand) {
      const ra = A.h[0] * Math.abs(dot(ax[0], L)) + A.h[1] * Math.abs(dot(ax[1], L)) + A.h[2] * Math.abs(dot(ax[2], L));
      const rb = Bx.h[0] * Math.abs(dot(bx[0], L)) + Bx.h[1] * Math.abs(dot(bx[1], L)) + Bx.h[2] * Math.abs(dot(bx[2], L));
      const o = ra + rb - Math.abs(dot(T, L));
      if (o < best) best = o;
    }
    return best;
  };
  const depth = (part, vol) => {
    if (!part || !vol) return 0;
    let d;
    if (part.box && vol.box) d = boxBox(part, vol);
    else if (part.box) d = vol.r - segBox(vol.a, vol.b, part);
    else if (vol.box) d = part.r - segBox(part.a, part.b, vol);
    else d = part.r + vol.r - segSeg(part.a, part.b, vol.a, vol.b);
    return d > 0 ? d : 0;
  };
  const colOf = (n) => (B[n] && B[n].numColliders && B[n].numColliders() > 0 ? B[n].collider(0) : null);
  const volShape = (n) => { const c = colOf(n); return c ? shapeOf(c) : null; };
  const vols = ['chest', 'abdomen', 'pelvis', 'thighF', 'thighB'].map(volShape);
  const parts = [];
  {
    // 위팔: 팔꿈치 쪽 절반의 뼈 축 (반지름 0). 캡슐 그대로면 내린 팔이 가슴 상자 옆면과 2.5 cm 겹친다
    //  (어깨 z 0.2 − 반지름 0.045 < 가슴 반폭 0.18: 모양 탓, 뚫림 아님) → 뼈 축이 몸통 부피 안에 들어가야 센다
    const u = colOf('uarmS') ? shapeOf(colOf('uarmS')) : null;
    if (u && !u.box) {
      const el = bp('farmS');
      const far = len(sub(u.a, el)) < len(sub(u.b, el)) ? u.a : u.b;
      parts.push([{ box: false, a: mul(add(u.a, u.b), 0.5), b: far, r: 0 }]);
    } else parts.push([]);
    const fa = colOf('farmS') ? shapeOf(colOf('farmS')) : null;
    parts.push(fa ? [fa] : []);
    const hc = pt('farmS', [0.13, 0, 0]);
    parts.push([{ box: false, a: hc, b: hc, r: HAND_R }]);
    const blade = [], hilt = [];
    const bl = new Set(f.bladeColliders || []);
    for (const c of f.swordColliders || []) { if (c.isEnabled && !c.isEnabled()) continue; const sh = shapeOf(c); if (sh) (bl.has(c) ? blade : hilt).push(sh); } // 떨어져 나간 (꺼진) 부품은 뺀다
    if (!f.swordColliders) for (const c of f.bladeColliders || []) { const sh = shapeOf(c); if (sh) blade.push(sh); }
    parts.push(f.armed === false ? [] : blade, f.armed === false ? [] : hilt);
    const fo = colOf('farmO') ? shapeOf(colOf('farmO')) : null;
    parts.push(fo ? [fo] : []);
  }
  const pen = [];
  for (const group of parts) for (const vol of vols) {
    let d = 0;
    for (const sh of group) d = Math.max(d, depth(sh, vol));
    pen.push(Math.round(d * 1e4) / 1e4);
  }
  s.pen = pen;
  // ── 손·팔꿈치 (가슴 틀 — 몸 뒤로 넘어갔는지는 맥락만), 손 (바라보는 틀, 가슴 원점 — chain.mjs 되돌아감과 같은 틀) ──
  const hand = pt('farmS', [0.13, 0, 0]);
  const jEl = f.jointByName && f.jointByName.farmS && f.jointByName.farmS.joint;
  const ja = jEl && jEl.anchor2 && !(jEl.isValid && !jEl.isValid()) ? P(jEl.anchor2()) : [-0.135, 0, 0];
  const elbow = pt('farmS', ja);
  const pc = bp('chest');
  s.hC = toLocal(qc, pc, hand);
  s.eC = toLocal(qc, pc, elbow);
  const yawQ = f.yaw ? Q(f.yaw) : [0, Math.sin((f.heading || 0) / 2), 0, Math.cos((f.heading || 0) / 2)];
  s.hH = qrot(qinv(yawQ), sub(hand, pc));
  // ── 칼끝 ──
  if (f.sword && f.weaponCfg) {
    const tip = add(P(f.sword.translation()), qrot(qs, [0, (f.weaponCfg.hiltLength || 0) + (f.weaponCfg.bladeLength || 0), 0]));
    s.tipSp = st.tipPrev ? len(sub(tip, st.tipPrev)) / dtg : null;
    st.tipPrev = tip;
    s.tipY = tip[1];
  } else (s.tipSp = null), (s.tipY = null);
  s.tipVg = f.tipVel ? Math.hypot(f.tipVel.x, f.tipVel.y, f.tipVel.z) : null;
  // ── 조종 (손짓 층·드라이브·검술 층) ──
  const sk = f.skill || null;
  s.gw = f.guardWeight ? f.guardWeight() : null;
  s.lvl = sk ? sk.level : null;
  s.act = sk ? sk.activity : null;
  s.rec = sk ? (sk.recovering ? 1 : 0) : null;
  s.held = f.handHeld == null ? null : f.handHeld ? 1 : 0;
  s.hoX = f.handOffset ? f.handOffset.x : null;
  s.hoY = f.handOffset ? f.handOffset.y : null;
  s.aimX = sk && sk.aim ? sk.aim.x : null;
  s.aimY = sk && sk.aim ? sk.aim.y : null;
  const g = f.ges || null, V = f.strike || null;
  s.gSt = g ? g.state : null;
  s.gS = g ? g.S : null;
  s.gSw = g ? g.Swind : null;
  s.gC = g ? g.c : null;
  s.gMode = g ? (g.mode === 'wind' ? 1 : g.mode === 'stroke' ? 2 : 0) : null;
  s.gFam = g ? ['diagR', 'diagL', 'vert', 'horizR', 'horizL', 'riseR', 'riseL'].indexOf(g.famA) : null;
  s.gPhi = g ? g.phi : null;
  s.gHeld = g ? (g.held ? 1 : 0) : null;
  s.gCuts = V && V.stats ? V.stats.cuts : null;
  s.gCom = V && V.stats ? V.stats.commits : null;
  const d = f.drive || null;
  s.dW = d ? d.w : null;
  s.dAct = d ? (d.active ? 1 : 0) : null;
  s.dCut = d ? ['zornhau', 'oberhau', 'mittelhau', 'unterhau'].indexOf(d._cut) : null;
  s.dSide = d ? (d._side === 'left' ? -1 : 1) : null;
  s.dPhi = d ? d._phiB : null;
  s.dIn = d ? (d._inCut ? 1 : 0) : null;
  s.dStep = d ? (d.stepping ? 1 : 0) : null;
  s.dPole = V && V.stats && V.stats.poleFlip != null ? V.stats.poleFlip : null;
  s.dPoleJ = d && d.debug && d.debug.poleJump != null ? d.debug.poleJump : null;
  s.dHErr = d && d.debug ? d.debug.handErr ?? null : null;
  s.dAErr = d && d.debug ? d.debug.aimErrDeg ?? null : null;
  s.dStepReq = V && V.stats && V.stats.stepRequests != null ? V.stats.stepRequests : null;
  s.blood = f.blood ?? null;
  s.cons = f.consciousness ?? null;
  s.pain = f.pain ?? null;
  st.tPrev = tg;
  // ── 한 번만 (ctx.meta): 자기 몸끼리 부딪히나 (충돌 그룹) · 관절 접촉 ──
  if (ctx.meta) {
    const grp = (c) => (c && c.collisionGroups ? c.collisionGroups() >>> 0 : null);
    const meets = (a, b) => (a == null || b == null ? null : (((a >>> 16) & (b & 0xffff)) !== 0 && ((b >>> 16) & (a & 0xffff)) !== 0));
    const own = {};
    const torso = ['chest', 'abdomen', 'pelvis', 'thighF', 'thighB'];
    const limbs = ['uarmS', 'farmS', 'uarmO', 'farmO'];
    for (const tn of torso) {
      for (const ln of limbs) own[`${ln}-${tn}`] = meets(grp(colOf(ln)), grp(colOf(tn)));
      (f.swordColliders || []).forEach((c, i) => (own[`sword${i}-${tn}`] = meets(grp(c), grp(colOf(tn)))));
    }
    const jc = {};
    for (const j of f.joints || []) if (j.joint && j.joint.contactsEnabled) jc[j.name] = j.joint.contactsEnabled();
    s.meta = { ownCollide: own, anyOwn: Object.values(own).some((x) => x === true), jointContacts: jc, groups: { chest: grp(colOf('chest')), farmS: grp(colOf('farmS')), sword: grp((f.swordColliders || [])[0]), footF: grp(colOf('footF')) } };
  }
  return s;
}

// ───────── 요약 ─────────
const pctl = (arr, p) => {
  const a = arr.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  return a[Math.min(a.length - 1, Math.max(0, Math.floor(p * (a.length - 1) + 0.5)))];
};
const median = (a) => pctl(a, 0.5);
const r3 = (x) => (x == null || !Number.isFinite(x) ? x ?? null : Math.round(x * 1000) / 1000);
const lerpTab = (tab, x) => {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) return tab[i - 1][1] + ((tab[i][1] - tab[i - 1][1]) * (x - tab[i - 1][0])) / (tab[i][0] - tab[i - 1][0]);
  return tab[tab.length - 1][1];
};
const outR = (v, R) => v != null && (v < R.lo - R.margin || v > R.hi + R.margin);

/** 한 표본의 범위 밖 관절 (이름 → 참) */
export function rangeFlags(s, R = RANGES) {
  const F = {};
  for (const [sd, e, pl, bh] of [['S', s.shElevS, s.shPlaneS, s.shBehindS], ['O', s.shElevO, s.shPlaneO, s.shBehindO]]) {
    if (e == null) continue;
    F['shBehind' + sd] = bh > lerpTab(R.shoulderBehind.byElev, e) + R.shoulderBehind.margin;
    const A = R.shoulderAcross;
    F['shAcross' + sd] = e >= A.elevMin && e <= A.elevMax && pl > A.planeMax + A.margin;
  }
  F.elS = outR(s.elS, R.elbow);
  F.elO = outR(s.elO, R.elbow);
  F.wrS = outR(s.wrS, R.wrist);
  for (const L of ['F', 'B']) {
    F['hipFlex' + L] = outR(s['hipFlex' + L], R.hipFlex);
    F['hipAbd' + L] = outR(s['hipAbd' + L], R.hipAbd);
    F['hipRot' + L] = outR(s['hipRot' + L], R.hipRot);
    F['knee' + L] = outR(s['knee' + L], R.knee);
  }
  F.spTw = outR(s.spTw, R.spineTwist);
  F.spFlex = outR(s.spFlex, R.spineFlex);
  F.spSide = outR(s.spSide, R.spineSide);
  return F;
}

/** 선분 a→b 가 상자 X(가슴 틀, 범위)를 지나나 (slab) */
function segHitsBox(a, b, X, grow = 0) {
  let t0 = 0, t1 = 1;
  for (let i = 0; i < 3; i++) {
    const k = ['x', 'y', 'z'][i];
    const lo = X[k][0] - grow, hi = X[k][1] + grow;
    const d = b[i] - a[i];
    if (Math.abs(d) < 1e-12) {
      if (a[i] < lo || a[i] > hi) return false;
    } else {
      let u0 = (lo - a[i]) / d, u1 = (hi - a[i]) / d;
      if (u0 > u1) [u0, u1] = [u1, u0];
      t0 = Math.max(t0, u0);
      t1 = Math.min(t1, u1);
      if (t0 > t1) return false;
    }
  }
  return true;
}
const inBox = (p, X, grow = 0) => p[0] >= X.x[0] - grow && p[0] <= X.x[1] + grow && p[1] >= X.y[0] - grow && p[1] <= X.y[1] + grow && p[2] >= X.z[0] - grow && p[2] <= X.z[1] + grow;

/** 선형 추세를 빼고 한 창의 정수 Hz 빈 파워 (Hann) */
function spectrum(x, fs, fMax) {
  const n = x.length;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) (sx += i), (sy += x[i]), (sxx += i * i), (sxy += i * x[i]);
  const den = n * sxx - sx * sx;
  const b = den ? (n * sxy - sx * sy) / den : 0, a = (sy - b * sx) / n;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = (x[i] - a - b * i) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  const T = n / fs;
  const P = [];
  for (let f = 1; f <= fMax; f++) {
    const k = f * T; // 빈 번호 (창 1 s 면 f)
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) (re += y[i] * Math.cos((2 * Math.PI * k * i) / n)), (im -= y[i] * Math.sin((2 * Math.PI * k * i) / n));
    P.push(re * re + im * im);
  }
  return P; // P[f-1]
}

/**
 * 칸 요약. samples = sampleFighter 표본 (한 파이터, 스텝 차례), events = [{ type: 'wound'|'commit'|'clash'|'fall'|'round', tw, t, att, vic, zone, kind, energy, severity, S, fam, result }],
 *  meta = { dt, who ('player'), ginput ('wind'|'stroke'), strokes (strokeWindows), standWin [tw0, tw1], rounds [{ result: 'win'|'loss'|'timeout', t }], cell, block }
 *  판정은 서 있는 스텝(st = 0)에서. 문턱·범위는 RANGES·PEAKS·OSC·DECL
 */
export function summarise(samples, events = [], meta = {}) {
  const settle = meta.settleS ?? DECL.settleS;
  const S = (samples || []).filter((x) => x.fightT == null || x.fightT >= settle);
  const n = S.length;
  const dt = meta.dt || S.find((x) => x.dt)?.dt || 1 / 120;
  const who = meta.who || 'player';
  const durS = n * dt;
  const stand = S.map((x) => x.st === 0);
  // 판 조각: fightT 가 줄면 (또는 tw 가 거꾸로면) 새 판 — 여러 판을 이어 붙인 표본에서 판 경계 너머 이웃을 잇지 않는다 (순간 이동·창·발·넘어짐·뚫림 시작)
  const seg = new Int32Array(n);
  for (let i = 1; i < n; i++) seg[i] = seg[i - 1] + ((S[i].fightT != null && S[i - 1].fightT != null && S[i].fightT < S[i - 1].fightT) || (S[i].tw != null && S[i - 1].tw != null && S[i].tw < S[i - 1].tw) ? 1 : 0);
  const same = (i, j) => seg[i] === seg[j];
  const nStand = stand.filter(Boolean).length;
  const out = { cell: meta.cell ?? null, block: meta.block ?? null, n, durS: r3(durS), standFrac: r3(n ? nStand / n : null) };
  // ── 뒤틀림 (사람 범위 밖) ──
  const flagCount = {};
  let anyStand = 0, anyAll = 0;
  let sepOver = 0, offOver = 0;
  const seps = [], offs = [];
  for (let i = 0; i < n; i++) {
    const F = rangeFlags(S[i]);
    const any = Object.values(F).some(Boolean);
    if (any) anyAll++;
    if (stand[i]) {
      if (any) anyStand++;
      for (const k in F) if (F[k]) flagCount[k] = (flagCount[k] || 0) + 1;
      seps.push(S[i].sepMax);
      const off = Math.max(S[i].offElS ?? 0, S[i].offElO ?? 0, S[i].offKnF ?? 0, S[i].offKnB ?? 0);
      offs.push(off);
      if (S[i].sepMax > RANGES.constraint.anchorSepM) sepOver++;
      if (off > RANGES.constraint.hingeOffDeg) offOver++;
    }
  }
  const perJoint = {};
  for (const k in flagCount) perJoint[k] = r3(flagCount[k] / Math.max(1, nStand));
  out.distortion = { index: r3(nStand ? anyStand / nStand : null), indexAll: r3(n ? anyAll / n : null), perJoint, constraint: { sepP99: r3(pctl(seps, 0.99)), sepFrac: r3(sepOver / Math.max(1, nStand)), hingeOffP99: r3(pctl(offs, 0.99)), hingeOffFrac: r3(offOver / Math.max(1, nStand)) } };
  // ── 자기 몸 뚫림 · 순간 이동 ──
  const strokes = meta.strokes || [];
  const nStr = strokes.length || null;
  const perMin = (c) => (durS > 0 ? r3(c / (durS / 60)) : null);
  const pairN = PEN_PARTS.length * PEN_VOLS.length;
  const evCount = new Array(pairN).fill(0), maxD = new Array(pairN).fill(0), stepsIn = new Array(pairN).fill(0);
  const penEvents = [];
  for (let i = 0; i < n; i++) {
    const p = S[i].pen;
    if (!p) continue;
    for (let j = 0; j < pairN; j++) {
      const on = p[j] > DECL.penTolM;
      const was = i > 0 && same(i, i - 1) && S[i - 1].pen && S[i - 1].pen[j] > DECL.penTolM;
      if (on) {
        stepsIn[j]++;
        if (p[j] > maxD[j]) maxD[j] = p[j];
        if (!was) (evCount[j]++, penEvents.push({ i, tw: S[i].tw, pair: j }));
      }
    }
  }
  const byPair = {};
  let total = 0, armTorso = 0;
  for (let j = 0; j < pairN; j++) {
    if (!evCount[j]) continue;
    const pn = PEN_PARTS[Math.floor(j / PEN_VOLS.length)], vn = PEN_VOLS[j % PEN_VOLS.length];
    byPair[`${pn}>${vn}`] = { events: evCount[j], perStroke: nStr ? r3(evCount[j] / nStr) : null, perMin: perMin(evCount[j]), maxDepth: r3(maxD[j]), stepFrac: r3(stepsIn[j] / Math.max(1, n)) };
    if (pn !== 'farmO' && pn !== 'hilt') total += evCount[j];
    if ((pn === 'uarm' || pn === 'farm' || pn === 'hand') && (vn === 'chest' || vn === 'abdomen' || vn === 'pelvis')) armTorso += evCount[j];
  }
  const tele = { hand: 0, elbow: 0, list: [] };
  const X = DECL.trunkPrism;
  for (const [key, name, rr] of [['hC', 'hand', DECL.limbR.hand], ['eC', 'elbow', DECL.limbR.elbow]]) {
    let skip = -1;
    for (let i = 1; i < n; i++) {
      if (i <= skip || !S[i][key]) continue;
      for (let k = 1; k <= DECL.teleportK && i - k >= 0 && same(i, i - k); k++) {
        const a = S[i - k][key], b = S[i][key];
        if (!a || inBox(a, X, rr) || inBox(b, X, rr)) continue;
        if (segHitsBox(a, b, X)) {
          tele[name]++;
          tele.list.push({ part: name, i, tw: S[i].tw, steps: k, speed: r3(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / (k * dt)) });
          skip = i + DECL.teleportK;
          break;
        }
      }
    }
  }
  const grow = (key) => {
    let c = 0, prev = null;
    for (const x of S) {
      if (x[key] != null && prev != null && x[key] > prev) c += x[key] - prev;
      if (x[key] != null) prev = x[key];
    }
    return c;
  };
  const pole = grow('dPole'), poleJump = grow('dPoleJ');
  out.selfPen = { byPair, events: total, perStroke: nStr ? r3(total / nStr) : null, perMin: perMin(total), armThroughTorso: armTorso, armThroughTorsoPerStroke: nStr ? r3(armTorso / nStr) : null, teleports: { hand: tele.hand, elbow: tele.elbow, perStroke: nStr ? r3((tele.hand + tele.elbow) / nStr) : null, list: tele.list.slice(0, 50) }, poleFlips: pole, poleFlipsPerStroke: nStr ? r3(pole / nStr) : null, poleJumps: poleJump };
  // ── 흐물거림 ──
  const speed = {}, accel = {};
  for (const k in PEAKS.joints) {
    const J = PEAKS.joints[k];
    const ws = [], as = [];
    for (let i = 0; i < n; i++) if (stand[i]) (ws.push(S[i]['w_' + k]), as.push(S[i]['a_' + k]));
    const wv = ws.filter((x) => x != null), av = as.filter((x) => x != null);
    if (!wv.length) continue;
    const w99 = pctl(wv, 0.99), a99 = pctl(av, 0.99);
    speed[k] = { p99: r3(w99), peak: J.w, xPeak: r3(w99 / J.w), fracAbove: r3(wv.filter((x) => x > J.w).length / wv.length), max: r3(Math.max(...wv)) };
    if (av.length) accel[k] = { p99: r3(a99), peak: J.a, xPeak: r3(a99 / J.a), fracAbove: r3(av.filter((x) => x > J.a).length / av.length) };
  }
  // 떨림: 서 있는 동안 이어진 구간의 1 s 창 (0.5 s 씩)
  const fs = 1 / dt;
  const win = Math.round(OSC.winS * fs), hop = Math.round(OSC.hopS * fs);
  const fMax = OSC.band[1];
  const osc = {};
  let hiAll = 0, bandAll = 0;
  const sumSpec = new Array(fMax).fill(0);
  for (const sig of OSC.signals) {
    const acc = new Array(fMax).fill(0);
    let wins = 0;
    for (let i0 = 0; i0 + win <= n; i0 += hop) {
      let ok = true;
      const x = [];
      for (let i = i0; i < i0 + win; i++) {
        const v = S[i][sig];
        if (!stand[i] || v == null || !same(i, i0)) { ok = false; break; }
        x.push(v);
      }
      if (!ok) continue;
      const P = spectrum(x, fs, fMax);
      for (let f = 0; f < fMax; f++) acc[f] += P[f];
      wins++;
    }
    if (!wins) continue;
    let band = 0, hi = 0, dom = null, dP = -1;
    for (let fz = OSC.band[0]; fz <= OSC.band[1]; fz++) {
      const p = acc[fz - 1];
      band += p;
      if (fz > OSC.highAbove) hi += p;
      if (p > dP) (dP = p), (dom = fz);
    }
    // 신호마다 크기가 다르다: 전체 몫은 신호마다 띠 파워로 정규화해 더한다
    if (band > 0) for (let fz = OSC.band[0]; fz <= OSC.band[1]; fz++) sumSpec[fz - 1] += acc[fz - 1] / band;
    if (band > 0) (hiAll += hi / band), (bandAll += 1);
    osc[sig] = { windows: wins, highShare: r3(band > 0 ? hi / band : null), domHz: dom };
  }
  let domAll = null, dAll = -1;
  for (let fz = OSC.band[0]; fz <= OSC.band[1]; fz++) if (sumSpec[fz - 1] > dAll) (dAll = sumSpec[fz - 1]), (domAll = fz);
  // 골반 높이: 서 있는 기준 (standWin, 없으면 첫 서 있는 1 s), 0.5 s 창 표준편차, 기준 대비 가라앉음
  const pelStand = [];
  if (meta.standWin) for (let i = 0; i < n; i++) if (stand[i] && S[i].tw >= meta.standWin[0] && S[i].tw <= meta.standWin[1]) pelStand.push(S[i].pelY);
  // 창이 없으면 차림표의 서 있기 창 (싸움 시작 뒤 2.5–5 s, fightT)
  if (!pelStand.length) for (let i = 0; i < n; i++) if (stand[i] && S[i].fightT != null && S[i].fightT * 1000 >= PROGRAMME.standWinMs[0] && S[i].fightT * 1000 <= PROGRAMME.standWinMs[1]) pelStand.push(S[i].pelY);
  const base = median(pelStand);
  const pw = Math.round(DECL.pelvisWinS * fs), ph = Math.max(1, Math.round(0.1 * fs));
  const stds = [];
  for (let i0 = 0; i0 + pw <= n; i0 += ph) {
    let ok = true, m = 0;
    for (let i = i0; i < i0 + pw; i++) { if (!stand[i] || !same(i, i0)) { ok = false; break; } m += S[i].pelY; }
    if (!ok) continue;
    m /= pw;
    let v = 0;
    for (let i = i0; i < i0 + pw; i++) v += (S[i].pelY - m) ** 2;
    stds.push(Math.sqrt(v / pw));
  }
  const pelS = S.filter((x, i) => stand[i]).map((x) => x.pelY);
  // 발: 서 있는 스텝에서 두 발 다 뜸
  let off = 0, epi = 0, run = 0, longest = 0;
  const minRun = Math.round(DECL.bothOffMinS * fs);
  for (let i = 0; i <= n; i++) {
    if (i > 0 && i < n && !same(i, i - 1)) { if (run >= minRun) epi++; if (run > longest) longest = run; run = 0; } // 판이 바뀌면 끊는다
    const o = i < n && stand[i] && S[i].cF === 0 && S[i].cB === 0;
    if (o) (off++, run++);
    else {
      if (run >= minRun) epi++;
      if (run > longest) longest = run;
      run = 0;
    }
  }
  const loads = [], levs = [];
  for (let i = 0; i < n; i++) if (stand[i]) (S[i].load != null && loads.push(S[i].load), S[i].lev != null && levs.push(S[i].lev));
  out.boneless = {
    speed, accel,
    osc: { highShareMean: r3(bandAll ? hiAll / bandAll : null), domHz: domAll, perSignal: osc, band: OSC.band, highAbove: OSC.highAbove },
    pelvis: { standMedian: r3(base), stdMedian: r3(median(stds)), stdP95: r3(pctl(stds, 0.95)), stdMax: r3(stds.length ? Math.max(...stds) : null), dip: r3(base != null && pelS.length ? base - Math.min(...pelS) : null), dipP5: r3(base != null ? base - pctl(pelS, 0.05) : null) },
    feet: { bothOffFrac: r3(nStand ? off / nStand : null), episodes: epi, episodesPerMin: perMin(epi), longestS: r3(longest * dt) },
    load: { median: r3(median(loads)), p10: r3(pctl(loads, 0.1)), fracBelowHalf: r3(loads.length ? loads.filter((x) => x < 0.5).length / loads.length : null), assistRaisedFrac: r3(levs.length ? levs.filter((x) => x > 0.05).length / levs.length : null), levMedian: r3(median(levs)) },
  };
  // ── 과제: 칼끝·상처·넘어짐·판 ──
  const ev = events || [];
  const dealt = ev.filter((e) => e.type === 'wound' && e.att === who), recv = ev.filter((e) => e.type === 'wound' && e.vic === who);
  let falls = 0;
  for (let i = 1; i < n; i++) if (same(i, i - 1) && S[i - 1].st === 0 && (S[i].st === 1 || S[i].st === 2)) falls++;
  const R = meta.rounds || [];
  out.task = {
    woundsDealt: dealt.length, woundsReceived: recv.length, energyDealt: r3(dealt.reduce((a, e) => a + (e.energy || 0), 0)), energyReceived: r3(recv.reduce((a, e) => a + (e.energy || 0), 0)),
    falls, fallsPerMin: perMin(falls),
    rounds: { won: R.filter((x) => x.result === 'win').length, lost: R.filter((x) => x.result === 'loss').length, timeout: R.filter((x) => x.result === 'timeout').length, timeS: R.map((x) => r3(x.t)) },
  };
  // ── 획마다: 분류·헛 확정·드라이브 남음·손 되돌아감·칼끝·상처 ──
  const rows = [];
  const idxAt = (tw) => { let lo = 0, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if ((S[m].tw ?? -Infinity) < tw) lo = m + 1; else hi = m; } return lo; };
  const cutSteps = [];
  for (let i = 1; i < n; i++) if (same(i, i - 1) && S[i].gCuts != null && S[i - 1].gCuts != null && S[i].gCuts > S[i - 1].gCuts) cutSteps.push(i);
  const comTimes = ev.filter((e) => e.type === 'commit').map((e) => e.tw);
  if (!comTimes.length) for (let i = 1; i < n; i++) if (same(i, i - 1) && S[i].gCom != null && S[i - 1].gCom != null && S[i].gCom > S[i - 1].gCom) comTimes.push(S[i].tw);
  const hasGes = S.some((x) => x.gCuts != null);
  for (const w of strokes) {
    const i0 = idxAt(w.twDown), i1 = Math.min(n, idxAt(w.twEnd));
    const row = { id: w.id, kind: w.kind, amp: w.amp, speed: w.speed, touch: w.touch };
    let tip = null, iTip = null;
    const iT0 = idxAt(w.twCutStart - 100), iT1 = Math.min(n, idxAt(w.twCutEnd + 300));
    for (let i = iT0; i < iT1; i++) if (S[i].tipSp != null && (tip == null || S[i].tipSp > tip)) (tip = S[i].tipSp), (iTip = i);
    row.tipPeak = r3(tip);
    row.dealt = dealt.filter((e) => e.tw >= w.twDown && e.tw < w.twEnd).length;
    row.dealtJ = r3(dealt.filter((e) => e.tw >= w.twDown && e.tw < w.twEnd).reduce((a, e) => a + (e.energy || 0), 0));
    row.recv = recv.filter((e) => e.tw >= w.twDown && e.tw < w.twEnd).length;
    if (hasGes) {
      const cuts = cutSteps.filter((i) => i >= i0 && i < i1);
      const cls = cuts.find((i) => S[i].tw >= w.twCutStart - 60 && S[i].tw <= w.twCutEnd + 40) ?? null;
      const expMode = meta.ginput === 'stroke' ? 2 : w.kind === 'wind' ? 1 : 2;
      row.cuts = cuts.length;
      row.startPad = i0 < n && S[i0].hoX != null ? [r3(S[i0].hoX), r3(S[i0].hoY)] : null; // 댄 순간 손 목표 (앞 획의 복귀 자세에서 시작할 수 있다)
      row.clsMode = cls != null ? ['none', 'wind', 'stroke'][S[cls].gMode] ?? null : null;
      row.clsFam = cls != null ? FAMS[S[cls].gFam] ?? null : null;
      // 잘못 읽음 = 뜻한 종류(감기/긋기)와 다르게 읽음 또는 긋기를 못 읽음. 무리(diagR 기대 — 쟁기에서 댔을 때)는 따로 센다
      row.misclass = cls == null || S[cls].gMode !== expMode;
      row.famMismatch = cls != null && FAMS[S[cls].gFam] !== 'diagR';
      row.spuriousCuts = cuts.length - (cls != null ? 1 : 0);
      const coms = comTimes.filter((t) => t >= w.twDown && t < w.twEnd);
      const mainCom = cls != null ? coms.filter((t) => t >= S[cls].tw && t <= w.twCutEnd + 300).length > 0 : false;
      row.commits = coms.length;
      row.spuriousCommits = coms.length - (mainCom ? 1 : 0);
      row.driftCuts = w.touch === 'cont' ? cuts.filter((i) => S[i].tw > w.twCutEnd + 50 && S[i].tw <= w.twLift).length : 0;
      row.driftCommits = w.touch === 'cont' ? coms.filter((t) => t > w.twCutEnd + 50 && t <= w.twLift).length : 0;
      // 뗀 뒤 드라이브·손짓 S 가 남은 시간
      const iL = idxAt(w.twLift);
      // 다음 획이 댈 때까지 0 이 안 되면 잘린 값 (…Censored 참): 이어진 획으로 넘어간 것
      const after = (key) => {
        if (iL >= n || S[iL][key] == null) return [null, false];
        for (let i = iL; i < i1; i++) if (!(S[i][key] > 0)) return [r3(S[i].tw - w.twLift), false];
        return [r3((S[i1 - 1]?.tw ?? w.twLift) - w.twLift), true];
      };
      [row.driveAfterMs, row.driveAfterCensored] = after('dW');
      [row.gestureAfterMs, row.gestureAfterCensored] = after('gS');
      // 되돌아감 (chain.mjs 와 같은 식): tCut … max(칼끝 최고, 몸 위상 0.85), 가슴 원점·바라보는 틀의 손이 tCut 자리 쪽으로 가는 빠르기 최고 (베는 쪽으로 나간 뒤만)
      const iA = cls ?? idxAt(w.twCutStart);
      let iTc = null;
      for (let i = iA; i < i1; i++) if (S[i].dIn === 1 && S[i].dPhi >= 0.85) { iTc = i; break; }
      if (iTc == null) for (let i = iA; i < i1; i++) if ((S[i].gSt === 2 || S[i].gSt === 3) && S[i].gPhi >= 0.85) { iTc = i; break; }
      const iB = Math.min(n - 1, Math.max(iA + 1, iTip ?? 0, iTc ?? 0));
      if (iA < n - 1 && S[iA].hH && S[iB].hH) {
        const h0 = S[iA].hH, dC = [S[iB].hH[0] - h0[0], S[iB].hH[1] - h0[1], S[iB].hH[2] - h0[2]];
        let hitch = 0, hitchRaw = 0;
        for (let i = iA + 1; i <= iB; i++) {
          const rel = [S[i].hH[0] - h0[0], S[i].hH[1] - h0[1], S[i].hH[2] - h0[2]];
          const L = Math.hypot(...rel);
          if (L < 1e-9) continue;
          const dv = [S[i].hH[0] - S[i - 1].hH[0], S[i].hH[1] - S[i - 1].hH[1], S[i].hH[2] - S[i - 1].hH[2]];
          const tow = -(dv[0] * rel[0] + dv[1] * rel[1] + dv[2] * rel[2]) / L / dt;
          if (tow > hitchRaw) hitchRaw = tow;
          if (rel[0] * dC[0] + rel[1] * dC[1] + rel[2] * dC[2] > 0 && tow > hitch) hitch = tow;
        }
        row.hitch = r3(hitch);
        row.hitchRaw = r3(hitchRaw);
        row.hitchWinMs = r3((iB - iA) * dt * 1000);
      }
      // 뗀 뒤 0.4 s 손 빠르기 최고 (바라보는 틀, 가슴 원점)
      let rs = 0;
      const iR1 = Math.min(i1, idxAt(w.twLift + 400));
      for (let i = Math.max(1, iL); i < iR1; i++) if (S[i].hH && S[i - 1].hH) rs = Math.max(rs, Math.hypot(S[i].hH[0] - S[i - 1].hH[0], S[i].hH[1] - S[i - 1].hH[1], S[i].hH[2] - S[i - 1].hH[2]) / dt);
      row.postLiftHandSpeed = r3(rs);
    }
    rows.push(row);
  }
  const col = (k, filt = () => true) => rows.filter(filt).map((r) => r[k]).filter((x) => x != null);
  const sum = (a) => a.reduce((x, y) => x + (typeof y === 'boolean' ? (y ? 1 : 0) : y), 0);
  const clean = (r) => r.touch === 'clean', cont = (r) => r.touch === 'cont';
  out.task.tipPeakMedian = r3(median(col('tipPeak')));
  out.task.hitsPerStroke = nStr ? r3(sum(col('dealt')) / nStr) : null;
  out.task.woundsReceivedPerStroke = nStr ? r3(sum(col('recv')) / nStr) : null;
  out.control = hasGes && rows.length
    ? {
        strokes: rows.length,
        misclass: { count: sum(col('misclass')), frac: r3(sum(col('misclass')) / rows.length), byKind: { wind: sum(col('misclass', (r) => r.kind === 'wind')), straight: sum(col('misclass', (r) => r.kind === 'straight')) }, famMismatch: sum(col('famMismatch')) },
        spuriousCommits: { clean: sum(col('spuriousCommits', clean)), cont: sum(col('spuriousCommits', cont)), perStrokeClean: r3(sum(col('spuriousCommits', clean)) / Math.max(1, rows.filter(clean).length)), perStrokeCont: r3(sum(col('spuriousCommits', cont)) / Math.max(1, rows.filter(cont).length)) },
        spuriousCuts: { clean: sum(col('spuriousCuts', clean)), cont: sum(col('spuriousCuts', cont)), driftCuts: sum(col('driftCuts')), driftCommits: sum(col('driftCommits')) },
        driveAfterReleaseMs: { median: r3(median(col('driveAfterMs'))), max: r3(Math.max(0, ...col('driveAfterMs'))), clean: r3(median(col('driveAfterMs', clean))), cont: r3(median(col('driveAfterMs', cont))), censored: sum(col('driveAfterCensored')) },
        gestureAfterReleaseMs: { median: r3(median(col('gestureAfterMs'))), max: r3(Math.max(0, ...col('gestureAfterMs'))) },
        hitch: { median: r3(median(col('hitch'))), max: r3(Math.max(0, ...col('hitch'))), rawMax: r3(Math.max(0, ...col('hitchRaw'))) },
        postLiftHandSpeed: { median: r3(median(col('postLiftHandSpeed'))), max: r3(Math.max(0, ...col('postLiftHandSpeed'))) },
      }
    : null;
  out.perStroke = rows;
  out.penEventsHead = penEvents.slice(0, 50).map((e) => ({ tw: e.tw, pair: `${PEN_PARTS[Math.floor(e.pair / PEN_VOLS.length)]}>${PEN_VOLS[e.pair % PEN_VOLS.length]}` }));
  return out;
}

// ───────── 자체 검사: 흉내 파이터 (Rapier 비슷한 몸체·콜라이더) ─────────
const PARTS0 = {
  pelvis: [[0, 0.97, 0], ['box', 0.1, 0.085, 0.16], 10.7], abdomen: [[0, 1.13, 0], ['box', 0.1, 0.07, 0.15], 10.4], chest: [[0, 1.33, 0], ['box', 0.11, 0.13, 0.18], 16.2], head: [[0, 1.62, 0], ['ball', 0.1], 6.1],
  uarmS: [[0.15, 1.43, 0.2], ['capsule', 0.105, 0.045], 2.1, true], farmS: [[0.435, 1.43, 0.2], ['capsule', 0.095, 0.04], 1.65, true], uarmO: [[0, 1.28, -0.2], ['capsule', 0.105, 0.045], 2.1], farmO: [[0, 0.99, -0.2], ['capsule', 0.095, 0.04], 1.65],
  thighF: [[0, 0.715, 0.095], ['capsule', 0.15, 0.065], 7.5], shinF: [[0, 0.29, 0.095], ['capsule', 0.16, 0.05], 3.5], footF: [[0.05, 0.045, 0.095], ['box', 0.12, 0.035, 0.05], 1.1],
  thighB: [[0, 0.715, -0.095], ['capsule', 0.15, 0.065], 7.5], shinB: [[0, 0.29, -0.095], ['capsule', 0.16, 0.05], 3.5], footB: [[0.05, 0.045, -0.095], ['box', 0.12, 0.035, 0.05], 1.1],
};
const JOINTS0 = [['pelvis', 'abdomen', [0, 1.06, 0]], ['abdomen', 'chest', [0, 1.2, 0]], ['chest', 'head', [0, 1.5, 0]], ['chest', 'uarmS', [0, 1.43, 0.2]], ['uarmS', 'farmS', [0.3, 1.43, 0.2]], ['chest', 'uarmO', [0, 1.43, -0.2]], ['uarmO', 'farmO', [0, 1.13, -0.2]], ['pelvis', 'thighF', [0, 0.93, 0.095]], ['thighF', 'shinF', [0, 0.5, 0.095]], ['shinF', 'footF', [0, 0.08, 0.095]], ['pelvis', 'thighB', [0, 0.93, -0.095]], ['thighB', 'shinB', [0, 0.5, -0.095]], ['shinB', 'footB', [0, 0.08, -0.095]]];
const qAxis = (ax, a) => [ax[0] * Math.sin(a / 2), ax[1] * Math.sin(a / 2), ax[2] * Math.sin(a / 2), Math.cos(a / 2)];
const vq = (q) => ({ x: q[0], y: q[1], z: q[2], w: q[3] });
const vv = (v) => ({ x: v[0], y: v[1], z: v[2] });
function qm(a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; }
function qr(q, v) { const [x, y, z, w] = q; const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]); return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)]; }
const ALONG_X = qAxis([0, 0, 1], -Math.PI / 2);
function mockCollider(body, shape, localT = [0, 0, 0], localQ = [0, 0, 0, 1]) {
  return {
    shapeType: () => (shape[0] === 'box' ? 1 : shape[0] === 'capsule' ? 2 : 0),
    halfExtents: () => vv([shape[1], shape[2], shape[3]]),
    halfHeight: () => shape[1],
    radius: () => (shape[0] === 'ball' ? shape[1] : shape[2]),
    translation: () => vv(body._p.map((x, i) => x + qr(body._q, localT)[i])),
    rotation: () => vq(qm(body._q, localQ)),
    collisionGroups: () => body._grp,
    parent: () => body,
  };
}
function mockBody(p, q = [0, 0, 0, 1], m = 1) {
  const b = { _p: p.slice(), _q: q.slice(), _w: [0, 0, 0], _cols: [], _grp: 0, translation: () => vv(b._p), rotation: () => vq(b._q), angvel: () => vv(b._w), linvel: () => vv([0, 0, 0]), mass: () => m, worldCom: () => vv(b._p), numColliders: () => b._cols.length, collider: (i) => b._cols[i], isFixed: () => false };
  return b;
}
/** 쉬는 자세의 흉내 파이터 (heading 0, 오른손잡이). 칼은 앞으로 누운 준비 자세 (생성자와 같은 z −1.45 rad) */
export function mockFighter() {
  const f = { bodies: {}, joints: [], jointByName: {}, side: 1, state: 'stand', fightT: 3, heading: 0, yaw: vq([0, 0, 0, 1]), totalMass: 0, armed: true, handHeld: false, handOffset: { x: 0.18, y: -0.28 }, blood: 1, consciousness: 1, pain: 0, support: 1, offBalance: 0 };
  const bodyGrp = (2 << 16) | (1 | 8 | 16), footGrp = (64 << 16) | (1 | 16), weaponGrp = (4 << 16) | (1 | 8 | 16 | 128);
  for (const [name, [p, shape, m, alongX]] of Object.entries(PARTS0)) {
    const b = mockBody(p, [0, 0, 0, 1], m);
    b._grp = name.startsWith('foot') ? footGrp : bodyGrp;
    b._cols.push(mockCollider(b, shape, [0, 0, 0], alongX ? ALONG_X : [0, 0, 0, 1]));
    f.bodies[name] = b;
    f.totalMass += m;
  }
  for (const [pn, cn, at] of JOINTS0) {
    const pp = PARTS0[pn][0], cp = PARTS0[cn][0];
    const joint = { anchor1: () => vv([at[0] - pp[0], at[1] - pp[1], at[2] - pp[2]]), anchor2: () => vv([at[0] - cp[0], at[1] - cp[1], at[2] - cp[2]]), contactsEnabled: () => true };
    const j = { joint, name: cn, parent: f.bodies[pn], child: f.bodies[cn] };
    f.joints.push(j);
    f.jointByName[cn] = j;
  }
  const L = 0.95, H = 0.25;
  const sw = mockBody([0.565, 1.43, 0.2], qAxis([0, 0, 1], -1.45), 1.4);
  sw._grp = weaponGrp;
  const blade = mockCollider(sw, ['box', 0.022, L / 2, 0.003], [0, H + L / 2, 0]);
  const hilt = mockCollider(sw, ['box', 0.015, H / 2, 0.015], [0, H / 2 - 0.1, 0]);
  sw._cols.push(hilt, blade);
  f.sword = sw;
  f.swordColliders = [hilt, blade];
  f.bladeColliders = [blade];
  f.weaponCfg = { hiltLength: H, bladeLength: L };
  f.gripJoint = { anchor1: () => vv([0.13, 0, 0]), anchor2: () => vv([0, 0, 0]) };
  f.gait = { legs: { F: { stance: true }, B: { stance: true } }, lev: 0, levC: 0, levH: 0, active: true };
  f.guardWeight = () => 1;
  return f;
}
/** 팔꿈치 경첩을 flex(도) 로 굽힌다 (farmS 를 팔꿈치 둘레로), 팔꿈치 빠르기 wDeg (도/초, z 축) */
function setElbow(f, flexDeg, wDeg = 0) {
  const el = [0.3, 1.43, 0.2];
  const q = qAxis([0, 0, 1], (flexDeg * Math.PI) / 180);
  const fb = f.bodies.farmS;
  fb._q = q;
  fb._p = el.map((x, i) => x + qr(q, [0.135, 0, 0])[i]);
  fb._w = [0, 0, (wDeg * Math.PI) / 180];
}

function selftest() {
  const bad = [];
  const ok = (cond, msg) => (cond ? console.log('  ok  ' + msg) : (bad.push(msg), console.log('  XX  ' + msg)));
  const dt = 1 / 120;
  const run = (build, N, t0 = 3) => {
    const f = mockFighter();
    const st = {};
    const out = [];
    for (let i = 0; i < N; i++) {
      build(f, i, i * dt);
      out.push(sampleFighter({ f, world: null, t: t0 + i * dt, tw: (t0 + i * dt) * 1000, dt, st, meta: i === 0 }));
    }
    return out;
  };
  // 1) 곧은 팔 (쉬는 자세: 칼 팔 앞으로 수평, 팔꿈치 0)
  console.log('1) 곧은 팔');
  const s1 = run(() => {}, 24);
  const a = s1[5];
  ok(Math.abs(a.elS) < 1e-6 && Math.abs(a.shElevS - 90) < 1e-6 && Math.abs(a.shPlaneS - 90) < 1e-6, `팔꿈치 ${a.elS.toFixed(2)}° · 어깨 들림 ${a.shElevS.toFixed(1)}° 면 ${a.shPlaneS.toFixed(1)}°`);
  ok(Object.values(rangeFlags(a)).every((x) => !x), '범위 밖 없음');
  ok(a.pen.every((x) => x <= DECL.penTolM), `뚫림 없음 (최대 ${Math.max(...a.pen).toFixed(4)} m)`);
  ok(a.cF === 1 && a.cB === 1 && a.sepMax < 1e-9, `두 발 닿음 · 관절 벌어짐 ${a.sepMax.toExponential(1)} m`);
  ok(s1[0].meta && s1[0].meta.anyOwn === false, `자기 몸 충돌 쌍 없음 (그룹 흉내: ${Object.keys(s1[0].meta.ownCollide).length} 쌍)`);
  const sum1 = summarise(s1, [], { dt });
  ok(sum1.distortion.index === 0 && sum1.selfPen.events === 0, `요약: 뒤틀림 ${sum1.distortion.index} · 뚫림 ${sum1.selfPen.events}`);
  // 2) 팔꿈치 젖힘 −25°
  console.log('2) 팔꿈치 젖힘');
  const s2 = run((f) => setElbow(f, -25), 12);
  ok(Math.abs(s2[3].elS + 25) < 1e-6 && rangeFlags(s2[3]).elS, `팔꿈치 ${s2[3].elS.toFixed(1)}° → 범위 밖`);
  const sum2 = summarise(s2, [], { dt });
  ok(sum2.distortion.perJoint.elS === 1, `요약 elS 몫 ${sum2.distortion.perJoint.elS}`);
  // 3) 아래팔이 가슴을 뚫음 (farmS 를 가슴 한가운데로)
  console.log('3) 가슴 뚫은 아래팔');
  const s3 = run((f, i) => { if (i >= 4) f.bodies.farmS._p = [0, 1.33, 0.05]; }, 12);
  const j = PEN_PARTS.indexOf('farm') * PEN_VOLS.length + PEN_VOLS.indexOf('chest');
  ok(s3[6].pen[j] > 0.05, `farm>chest 깊이 ${s3[6].pen[j].toFixed(3)} m`);
  const sum3 = summarise(s3, [], { dt });
  ok(sum3.selfPen.byPair['farm>chest']?.events === 1 && sum3.selfPen.armThroughTorso >= 1, `요약 farm>chest ${JSON.stringify(sum3.selfPen.byPair['farm>chest'])}`);
  ok(s3[6].sepMax > 0.1, `관절 벌어짐 ${s3[6].sepMax.toFixed(3)} m (${s3[6].sepJ})`);
  // 4) 12 Hz 떨림: 팔꿈치 30 ± 10° 를 12 Hz 로 2 s
  console.log('4) 12 Hz 떨림');
  const fz = 12, A = 10;
  const s4 = run((f, i, t) => setElbow(f, 30 + A * Math.sin(2 * Math.PI * fz * t), A * 2 * Math.PI * fz * Math.cos(2 * Math.PI * fz * t)), 240);
  const sum4 = summarise(s4, [], { dt });
  const o4 = sum4.boneless.osc.perSignal.elS;
  ok(o4 && o4.domHz === 12 && o4.highShare > 0.9, `elS 떨림 우세 ${o4?.domHz} Hz · 8 Hz 위 몫 ${o4?.highShare}`);
  const wExp = A * 2 * Math.PI * fz;
  ok(Math.abs(sum4.boneless.speed.elS.max - wExp) / wExp < 0.02, `팔꿈치 각속도 최고 ${sum4.boneless.speed.elS.max} °/s (식 ${wExp.toFixed(0)})`);
  const aExp = A * (2 * Math.PI * fz) ** 2;
  ok(Math.abs(sum4.boneless.accel.elS.p99 - aExp) / aExp < 0.08, `팔꿈치 각가속도 p99 ${sum4.boneless.accel.elS.p99} °/s² (식 ${aExp.toFixed(0)}, 차분)`);
  // 5) 두 발 뜸: 0.5 s 동안 몸 전체를 0.2 m 올림 (엔진 없이 높이 문턱)
  console.log('5) 두 발 뜸');
  const s5 = run((f, i) => { const up = i >= 30 && i < 90 ? 0.2 : 0; for (const [n2, [p]] of Object.entries(PARTS0)) f.bodies[n2]._p = [p[0], p[1] + up, p[2]]; }, 120);
  const sum5 = summarise(s5, [], { dt, standWin: [s5[0].tw, s5[29].tw] });
  ok(sum5.boneless.feet.episodes === 1 && Math.abs(sum5.boneless.feet.longestS - 0.5) < 0.01 && Math.abs(sum5.boneless.feet.bothOffFrac - 0.5) < 0.01, `두 발 뜸 ${JSON.stringify(sum5.boneless.feet)}`);
  ok(Math.abs(sum5.boneless.pelvis.standMedian - 0.97) < 1e-9 && Math.abs(sum5.boneless.pelvis.dip) < 1e-9 && sum5.boneless.pelvis.stdMax > 0.05, `골반 (몸이 올라가 가라앉음 0, 창 표준편차 최대 > 5 cm) ${JSON.stringify(sum5.boneless.pelvis)}`);
  const s5b = run((f, i) => { const dn = i >= 60 ? -0.25 : 0; f.bodies.pelvis._p = [0, 0.97 + dn, 0]; }, 120);
  const sum5b = summarise(s5b, [], { dt, standWin: [s5b[0].tw, s5b[59].tw] });
  ok(Math.abs(sum5b.boneless.pelvis.dip - 0.25) < 1e-9, `골반 주저앉음 0.25 m → dip ${sum5b.boneless.pelvis.dip}`);
  // 6) 몸통 건너뛰기: 손이 한 스텝에 가슴 앞 → 뒤
  console.log('6) 몸통 순간 이동');
  const s6 = run(() => {}, 10);
  s6.forEach((x, i) => (x.hC = i < 5 ? [0.3, 0, 0.05] : [-0.3, 0, 0.05]));
  const sum6 = summarise(s6, [], { dt });
  ok(sum6.selfPen.teleports.hand === 1, `손 순간 이동 ${sum6.selfPen.teleports.hand} (빠르기 ${sum6.selfPen.teleports.list[0]?.speed} m/s)`);
  // 6b) 두 판 이어 붙임: 판 경계 너머 손 자리 차이는 순간 이동이 아니다 (fightT 가 줄면 새 판)
  const s6b = [...run(() => {}, 10), ...run(() => {}, 10, 0.6)];
  s6b.forEach((x, i) => (x.hC = i < 10 ? [0.3, 0, 0.05] : [-0.3, 0, 0.05]));
  const sum6b = summarise(s6b, [], { dt });
  ok(sum6b.selfPen.teleports.hand === 0 && sum6b.n === 20, `판 경계 순간 이동 ${sum6b.selfPen.teleports.hand} (표본 ${sum6b.n})`);
  // 6c) 뗀 관절 (isValid 거짓) · 칼 떨굼 (armed 거짓, gripJoint 는 남음): anchor 를 읽지 않는다 (엔진은 읽으면 죽는다)
  {
    const f = mockFighter();
    const boom = () => { throw new Error('뗀 관절을 읽음'); };
    f.joints[0].joint = { isValid: () => false, anchor1: boom, anchor2: boom };
    f.armed = false;
    f.gripJoint = { isValid: () => false, anchor1: boom, anchor2: boom };
    let okRun = true;
    try { sampleFighter({ f, world: null, t: 3, tw: 3000, dt, st: {} }); } catch (e) { okRun = false; }
    ok(okRun, '뗀 관절·떨군 칼의 관절은 건너뛴다');
  }
  // 7) 차림표·빠르기 생성기·px
  console.log('7) 차림표·빠르기');
  const prog = buildProgramme();
  ok(prog.strokes.length === 24, `획 ${prog.strokes.length} · 끝 ${(prog.tEnd / 1000).toFixed(2)} s`);
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, vMax = 0;
  for (const s of prog.strokes) {
    const px = strokePx(s);
    for (const [, x, y] of px) (xMin = Math.min(xMin, x)), (xMax = Math.max(xMax, x)), (yMin = Math.min(yMin, y)), (yMax = Math.max(yMax, y));
    for (let i = 1; i < s.samples.length; i++) {
      const [t0, x0, y0] = s.samples[i - 1], [t1, x1, y1] = s.samples[i];
      if (t1 > t0 && t1 <= s.tCutEnd) vMax = Math.max(vMax, Math.hypot(x1 - x0, y1 - y0) / ((t1 - t0) / 1000));
    }
  }
  ok(xMin > MAP_PHONE.innerWidth / 2 && xMax < MAP_PHONE.innerWidth && yMin > 0 && yMax < MAP_PHONE.innerHeight, `px 범위 x ${xMin.toFixed(0)}–${xMax.toFixed(0)} · y ${yMin.toFixed(0)}–${yMax.toFixed(0)} (844×390, 오른쪽 반)`);
  ok(Math.abs(vMax - 12) < 0.6, `빠른 긋기 표본 빠르기 최고 ${vMax.toFixed(2)} 패드 m/s`);
  const w0 = prog.strokes.find((s) => s.kind === 'wind' && s.amp === 'large' && s.speed === 'slow' && s.touch === 'clean');
  ok(Math.abs(w0.tCutStart - w0.tDown - PROGRAMME.dwellMs - 736) <= 8 && Math.abs(w0.tCutEnd - w0.tCutStart - 296) <= 8, `감기 큼 느림: 감기 ${w0.tCutStart - w0.tDown - PROGRAMME.dwellMs} ms · 긋기 ${w0.tCutEnd - w0.tCutStart} ms`);
  for (const nm of PACING_NAMES) {
    const p = pacer(nm, 7);
    let T = 0, k = 0, mn = Infinity, mx = 0, hitch = 0;
    while (T < 60000) { const d = p.next(); T += d; k++; mn = Math.min(mn, d); mx = Math.max(mx, d); if (d >= 60) hitch++; }
    console.log(`     pacing ${nm.padEnd(3)} 60 s: 평균 ${(T / k).toFixed(2)} ms · 최소 ${mn.toFixed(2)} · 최대 ${mx.toFixed(2)} · 60 ms 넘는 프레임 ${hitch}`);
  }
  const pj = pacer('J', 7), js0 = (7 * 2654435761) >>> 0, js1 = (Math.imul(js0, 1664525) + 1013904223) >>> 0;
  ok(Math.abs(pj.next() - 1000 / (24 + (21 * js1) / 4294967296)) < 1e-12, `J = chain.mjs jitterPump 수열 (첫 간격)`);
  // 8) 페이지에 넣기: 자기 완결
  const fn = new Function(`return (${sampleFighter.toString()})`)();
  const f8 = mockFighter();
  const r8 = fn({ f: f8, world: null, t: 3, tw: 3000, dt, st: {}, meta: true });
  ok(r8 && Math.abs(r8.shElevS - 90) < 1e-6 && r8.meta && r8.meta.anyOwn === false, 'sampleFighter.toString() 을 다시 만든 함수가 같은 값 (meta 포함)');
  const m8 = mockFighter();
  delete m8.gait; m8.ges = undefined; m8.drive = undefined; m8.strike = undefined; m8.guardWeight = undefined; m8.gripJoint = undefined;
  const r9 = sampleFighter({ f: m8, t: 3, tw: 3000, dt, st: {} });
  ok(r9.gS === null && r9.dW === null && r9.lev === null, 'main 같은 파이터 (ges·drive·gait 없음) 에서도 돈다');
  console.log(bad.length ? `\n실패 ${bad.length}: ${bad.join(' | ')}` : '\n자체 검사 모두 통과');
  console.log('범위 표:', Object.entries(RANGES).filter(([k]) => k !== 'src').map(([k, v]) => `${k} ${v.lo ?? ''}${v.hi != null ? '…' + v.hi : ''}${v.margin != null ? ' ±' + v.margin : ''}`).join(' · '));
  console.log('최고 표 (°/s | °/s²):', Object.entries(PEAKS.joints).map(([k, v]) => `${k} ${v.w}|${v.a}`).join(' · '));
  return bad.length === 0;
}

// 직접 돌렸을 때만 (페이지·다른 도구가 불러오면 조용하다)
const isMain = typeof process !== 'undefined' && process.argv && process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].startsWith('/') ? '' : process.cwd() + '/'}${process.argv[1]}`).href;
if (isMain && process.argv.includes('--selftest')) process.exit(selftest() ? 0 : 1);
