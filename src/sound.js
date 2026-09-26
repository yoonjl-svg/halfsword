// ─────────────────────────────────────────────────────────────
//  효과음: 무거운 강철 롱소드의 소리를 코드로 "물리처럼" 만든다 (모드 합성)
//
//  쇠붙이를 치면 그 물체가 가진 "고유 진동(모드)"들이 한꺼번에 울린다.
//   - 롱소드 칼날은 길고 얇은 쇠막대(1m, 두께 6mm → 끝 2mm)라서 굽힘 진동이 200Hz~9kHz에
//     수십 개가 촘촘히 있다. 배음이 정수배가 아니라서(비조화음) 실로폰 같은 "딩"이 아니라 "쟁그렁"이 된다.
//   - 날끼리 부딪히면 칼날 폭 방향 굽힘(훨씬 단단 → 7배쯤 높은 음), 비틀림 진동도 함께 울린다.
//   - 칼자루를 쥔 두 손이 낮은 진동을 금방 죽이고, 1~5kHz 울림만 길게 남는다.
//   - 세게 칠수록 두 칼이 맞닿는 시간이 짧아져서(헤르츠 접촉) 높은 모드까지 울린다 → 밝고 크다.
//   - 부딪힐 때의 "딱"(넓은 대역 잡음), 두 손이 받는 "쿵"(낮은 몸통 소리), 날이 서로 긁히는 "지익"을 더하고,
//     살짝 찌그러뜨려(포화) 거친 맛을 낸다. 두 칼의 모드가 조금씩 어긋나 "우웅" 하고 맥놀이가 생긴다.
//
//  이런 소리 조각(버퍼)을 게임을 시작할 때 여러 벌 미리 만들어 두고, 칠 때마다 골라서
//  높낮이·밝기·세기를 조금씩 바꿔 튼다 → 매번 조금씩 다른 소리, 폰에서도 가볍다 (소리 하나에 노드 몇 개).
//  몸통 타격·뼈·칼이 스치는 소리엔 녹음된 무료(CC0) 소리를 조금 섞는다 (public/sfx, Kenney.nl).
//
//  들어보기: 메뉴의 "소리 들어보기" (sounds.html)
// ─────────────────────────────────────────────────────────────
import { SOUND } from './config.js';

// ── 난수: 같은 씨앗이면 같은 소리 (시험할 때 똑같이 다시 만들 수 있게) ──
export function makeRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (r, a, b) => a + (b - a) * r();
const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const TAU = Math.PI * 2;

// ─────────────────────────────────────────────────────────────
//  소리 만들기 도구 (모두 Float32Array 에 직접 계산)
// ─────────────────────────────────────────────────────────────

/**
 * 공명 모드 묶음. 두드림(x)을 받아 모드마다 "감쇠하며 울리는 사인파"로 반응한다.
 * 모드 하나 = 2차 공명 필터: y[n] = g·x[n] + 2r·cos(w)·y[n-1] − r²·y[n-2]
 * @param modes [{ f: 주파수(Hz), a: 세기, t60: 60dB 줄어드는 시간(초) }]
 * @param xEnd  x 에서 두드림이 있는 구간의 끝 (그 뒤는 울림만 계산)
 */
function resonate(x, out, sr, modes, xEnd = x.length) {
  const n = out.length;
  for (const m of modes) {
    if (m.f <= 20 || m.f >= sr * 0.45 || !m.a) continue;
    const w = (TAU * m.f) / sr;
    const r = Math.exp(-6.91 / (m.t60 * sr));
    const c1 = 2 * r * Math.cos(w);
    const c2 = -r * r;
    const g = m.a * Math.sin(w); // 두드림 1 → 진폭 1인 사인파
    const e1 = Math.min(n, xEnd);
    const end = Math.min(n, xEnd + Math.ceil(m.t60 * 1.4 * sr)); // −84dB 아래는 안 들리니 계산 생략
    let y1 = 0;
    let y2 = 0;
    let i = 0;
    for (; i < e1; i++) {
      const y = g * x[i] + c1 * y1 + c2 * y2;
      out[i] += y;
      y2 = y1;
      y1 = y;
    }
    for (; i < end; i++) {
      const y = c1 * y1 + c2 * y2;
      out[i] += y;
      y2 = y1;
      y1 = y;
    }
  }
}

/** 두 물체가 맞닿아 미는 힘 = 반쪽 사인 모양 펄스. 면적(충격량)이 amp 가 되게 한다 */
function pulse(x, sr, t0, dur, amp) {
  const n0 = Math.round(t0 * sr);
  const len = Math.max(2, Math.round(dur * sr));
  const peak = (amp * Math.PI) / 2 / len;
  for (let i = 0; i < len && n0 + i < x.length; i++) x[n0 + i] += peak * Math.sin((Math.PI * (i + 0.5)) / len);
}

/** 2차 필터 (RBJ 요리책 공식). type: lowpass | highpass | bandpass */
class Filt {
  constructor(type, f, q, sr) {
    this.type = type;
    this.sr = sr;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }
  set(f, q) {
    const w = (TAU * Math.min(f, this.sr * 0.45)) / this.sr;
    const al = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + al;
    let b0, b1, b2;
    if (this.type === 'lowpass') [b0, b1, b2] = [(1 - c) / 2, 1 - c, (1 - c) / 2];
    else if (this.type === 'highpass') [b0, b1, b2] = [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    else [b0, b1, b2] = [al, 0, -al];
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * c) / a0;
    this.a2 = (1 - al) / a0;
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** 잡음 한 번: 흰 잡음 → 필터 → 지수 감쇠 (attack, tau = 초) */
function noiseHit(out, sr, r, { t0 = 0, amp = 1, attack = 0.0003, tau = 0.004, type = 'highpass', f = 1000, q = 0.7, len = 8 }) {
  const fl = new Filt(type, f, q, sr);
  const n0 = Math.round(t0 * sr);
  const n = Math.min(out.length - n0, Math.round(tau * len * sr));
  const na = Math.max(1, attack * sr);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / na) * Math.exp(-i / (tau * sr)) * Math.min(1, (n - i) / (0.2 * n));
    out[n0 + i] += amp * env * fl.run(r() * 2 - 1);
  }
}

/** 몸통 "쿵": 음높이가 뚝 떨어지는 낮은 사인파 (f0 → f0/(1+drop)) */
function thumpTone(out, sr, { t0 = 0, f0 = 80, drop = 0.8, dropTau = 0.015, attack = 0.0015, tau = 0.04, amp = 1 }) {
  const n0 = Math.round(t0 * sr);
  const n = Math.min(out.length - n0, Math.round(tau * 10 * sr));
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    ph += (TAU * f0 * (1 + drop * Math.exp(-t / dropTau))) / sr;
    const fade = Math.min(1, (n - i) / (0.2 * n)); // 끝을 부드럽게 (뚝 끊기면 "틱" 소리가 난다)
    out[n0 + i] += amp * Math.min(1, t / attack) * Math.exp(-t / tau) * fade * Math.sin(ph);
  }
}

function peakOf(a) {
  let p = 0;
  for (let i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i]));
  return p;
}
function normalize(a, peak = 0.9) {
  const p = peakOf(a);
  if (p > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / p;
  return a;
}
/** 포화(찌그러뜨림): 큰 소리 부분만 둥글게 눌러서 배음·혼변조를 만든다 → 거칠고 꽉 찬 소리 */
function saturate(a, drive, asym = 0.12) {
  normalize(a, 1);
  const k = Math.tanh(drive);
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    a[i] = Math.tanh(drive * (x + asym * x * x)) / k;
  }
  return a;
}
/** 끝을 부드럽게 줄인다 (뚝 끊기는 소리 방지) */
function fadeOut(a, sr, dur = 0.03) {
  const n = Math.min(a.length, Math.round(dur * sr));
  for (let i = 0; i < n; i++) a[a.length - 1 - i] *= i / n;
  return a;
}
/** 낮은 주파수 잡음(흔들림)을 하나 만든다: 0 근처에서 천천히 움직이는 값 */
function wobble(r, sr, rate) {
  let v = 0;
  let target = 0;
  let cnt = 0;
  const hold = Math.max(1, Math.round(sr / rate));
  return () => {
    if (cnt-- <= 0) {
      target = r() * 2 - 1;
      cnt = hold;
    }
    v += (target - v) * (4 / hold);
    return v;
  };
}

// ─────────────────────────────────────────────────────────────
//  롱소드의 고유 진동 (모드) 목록
// ─────────────────────────────────────────────────────────────
// 양 끝이 자유로운 막대의 굽힘 모드: f_n = f1 × (β_n / β_1)²,  β = 4.730, 7.853, 10.996, 14.137, 17.279, (2n+1)π/2 …
const BETA = [4.73, 7.8532, 10.9956, 14.1372, 17.2788];
const beta = (n) => (n <= 5 ? BETA[n - 1] : ((2 * n + 1) * Math.PI) / 2);

/**
 * 칼 한 자루의 모드.
 * f1: 첫 굽힘 진동(Hz). 강철 칼날 1.2m·두께 6mm → 약 22Hz (E=200GPa로 계산)
 * at: 맞은 자리(칼날 길이 비율). 모드의 "마디" 근처를 맞으면 그 모드는 약하게 울린다
 * edge: 날끼리(폭 방향 굽힘) 맞은 정도 0~1, 나머지는 칼 면 방향 굽힘
 */
function swordModes(r, { f1 = 22, at = 0.6, edge = 0.6, damp = 1, fmax = 9500 }) {
  const modes = [];
  const tilt = (f) => {
    // 소리 설계용 음색 곡선: 250~800Hz "몸통"을 키우고(무게감), 2~4kHz "쨍"은 적당히, 7kHz 위는 줄인다
    const body = 1.6 * Math.exp(-(Math.log2(f / 430) ** 2) / (2 * 0.75 ** 2));
    const ring = 0.5 + 0.3 * Math.exp(-(Math.log2(f / 2800) ** 2) / (2 * 0.8 ** 2));
    return (body + ring) * (f > 6500 ? (6500 / f) ** 1.5 : 1);
  };
  const decay = (f) => {
    // 손이 쥐고 있어서 낮은 진동은 금방 죽고, 1~5kHz 울림이 가장 오래 간다 (초)
    const t = f < 350 ? 0.07 + (0.2 * (f - 150)) / 200 : f < 1400 ? 0.27 + (0.5 * (f - 350)) / 1050 : f < 5000 ? 0.8 : 0.8 - (0.35 * (f - 5000)) / 4500;
    return Math.max(0.05, t) * damp * between(r, 0.65, 1.3);
  };
  const add = (f, a) => {
    if (f < 140 || f > fmax) return;
    modes.push({ f, a: a * tilt(f), t60: decay(f) });
    // 맥놀이: 거의 같은 높이의 모드 쌍 (칼이 완전히 대칭이 아니라서 갈라진다) → "우웅~" 떨림
    if (f > 700 && r() < 0.55) modes.push({ f: f * (1 + between(r, 0.0005, 0.003)), a: a * tilt(f) * between(r, 0.5, 1), t60: decay(f) });
  };
  // 1) 칼 면 방향 굽힘 (두께 방향: 촘촘하다). 칼날이 끝으로 갈수록 가늘어져서 정수비에서 3~4% 벗어난다
  for (let n = 3; n < 40; n++) {
    const f = f1 * (beta(n) / BETA[0]) ** 2 * (1 + 0.035 * gauss(r));
    if (f > fmax) break;
    add(f, (1 - edge * 0.6) * Math.sin(beta(n) * at + 0.8) * between(r, 0.6, 1.2));
  }
  // 2) 날 방향 굽힘 (폭 45mm / 두께 6mm → 약 7.5배 높다). 날끼리 부딪히면 이게 크게 울린다
  const f1e = f1 * between(r, 6.8, 8);
  for (let n = 1; n < 12; n++) {
    const f = f1e * (beta(n) / BETA[0]) ** 2 * (1 + 0.03 * gauss(r));
    if (f > fmax) break;
    add(f, (0.4 + edge) * Math.sin(beta(n) * at + 0.8) * between(r, 0.6, 1.2));
  }
  // 3) 비틀림 (칼날을 비트는 진동, 약 350Hz 간격)
  const ft = between(r, 320, 390);
  for (let n = 1; n < 10; n++) add(ft * n * (1 + 0.03 * gauss(r)), 0.35 * Math.sin(n * 2.1 + at * 5) * r());
  return modes;
}

/** 코등이(가로막대 25cm): 830Hz 근처의 "깡" — 너무 크면 종소리처럼 깨끗해져서 조금만 */
function guardModes(r, amp = 0.35) {
  const f0 = between(r, 700, 980);
  return [1, 2.756, 5.404].map((k, i) => ({ f: f0 * k * (1 + 0.02 * gauss(r)), a: amp * (i === 0 ? 1 : 0.6) * between(r, 0.6, 1.1), t60: between(r, 0.2, 0.5) }));
}

// ─────────────────────────────────────────────────────────────
//  소리 조각 만들기 (각각 Float32Array 하나를 돌려준다)
// ─────────────────────────────────────────────────────────────
export const SYNTH = {
  /**
   * 칼끼리 부딪힘. hard = 세게(짧은 접촉 → 밝고 긴 울림), 아니면 약하게(둔탁한 "텅")
   */
  clash(sr, r, hard) {
    const dur = hard ? 1.25 : 0.75;
    const n = Math.round(dur * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    // 두 칼이 맞닿는 시간: 세게 = 0.15~0.25ms (9kHz까지 울림), 약하게 = 0.5~0.9ms (3kHz까지)
    const tc = hard ? between(r, 0.00015, 0.00025) : between(r, 0.0005, 0.0009);
    pulse(x, sr, 0.001, tc, 1);
    // 부딪힌 뒤 칼이 튀었다가 다시 닿는 "따닥" (몇 ms 뒤 작게)
    let xEnd = 0.001 + tc;
    if (r() < 0.65) {
      const t = 0.001 + between(r, 0.002, 0.009);
      pulse(x, sr, t, tc * 1.3, between(r, -0.5, 0.5));
      xEnd = t + tc * 1.3;
    }
    if (r() < 0.35) {
      const t = 0.001 + between(r, 0.01, 0.025);
      pulse(x, sr, t, tc * 1.6, between(r, -0.3, 0.3));
      xEnd = t + tc * 1.6;
    }
    // 날이 서로 파고들며 긁히는 짧은 마찰 (모드를 무작위 위상으로 흔든다 → "치익" 섞인 울림)
    const grind = hard ? 0.05 : 0.02;
    const gTau = between(r, 0.006, 0.02);
    for (let i = 0, m = Math.round(gTau * 5 * sr); i < m; i++) x[i + 20] += grind * (r() * 2 - 1) * Math.exp(-i / (gTau * sr)) * (0.3 + 0.7 * r());
    xEnd = Math.max(xEnd, 20 / sr + gTau * 5);
    const edge = between(r, 0.3, 1);
    const modes = [
      ...swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.35, 0.9), edge, damp: hard ? 1 : 0.55 }),
      ...swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.35, 0.9), edge, damp: hard ? 1 : 0.55 }),
      ...guardModes(r, hard ? 0.3 : 0.2),
    ];
    resonate(x, out, sr, modes, Math.ceil(xEnd * sr) + 2);
    normalize(out, 1);
    // "딱": 쇠끼리 맞은 순간의 넓은 대역 잡음
    noiseHit(out, sr, r, { t0: 0.001, amp: hard ? 0.55 : 0.25, tau: hard ? 0.0025 : 0.004, f: hard ? 1200 : 700 });
    // "쿵": 두 손과 팔이 충격을 받는 낮은 소리 (찌그러뜨리면 폰 스피커에서 들리는 배음이 생긴다)
    thumpTone(out, sr, { t0: 0.001, f0: between(r, 110, 150), drop: 0.6, tau: hard ? 0.03 : 0.04, amp: hard ? 0.4 : 0.35 });
    saturate(out, hard ? 2.2 : 1.6);
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },

  /** 투구: 두꺼운 강철 사발 + 안쪽 누비 + 머리 무게 → 짧고 둔탁한 "깡-" (투구 몸체 모드가 촘촘하고 금방 죽는다) */
  helmet(sr, r) {
    const dur = 0.6;
    const n = Math.round(dur * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const tc = between(r, 0.0003, 0.0005);
    pulse(x, sr, 0.001, tc, 1);
    if (r() < 0.5) pulse(x, sr, 0.001 + between(r, 0.003, 0.012), tc * 1.5, between(r, -0.4, 0.4));
    const modes = [];
    // 사발 모양 껍데기: 모드가 고르게 촘촘하다 (300Hz~5kHz)
    for (let i = 0; i < 40; i++) {
      const f = Math.exp(between(r, Math.log(300), Math.log(5200)));
      const a = (f < 1500 ? 1 : (1500 / f) ** 0.6) * between(r, 0.3, 1) * (r() < 0.5 ? -1 : 1);
      modes.push({ f, a, t60: between(r, 0.06, 0.25) * (f < 900 ? 1.4 : 1) });
    }
    // 투구 자체의 "울림" 몇 개 (종처럼 길게, 550~1400Hz)
    for (let i = 0; i < 4; i++) modes.push({ f: between(r, 550, 1400), a: between(r, 0.6, 1.1), t60: between(r, 0.35, 0.7) });
    // 칼도 조금 울린다
    const blade = swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.4, 0.9), edge: 0.8, damp: 0.7 });
    for (const m of blade) m.a *= 0.35;
    resonate(x, out, sr, [...modes, ...blade], Math.ceil(0.02 * sr));
    normalize(out, 1);
    noiseHit(out, sr, r, { t0: 0.001, amp: 0.4, tau: 0.003, f: 900 });
    thumpTone(out, sr, { t0: 0.001, f0: between(r, 110, 140), drop: 0.7, tau: 0.04, amp: 0.4 });
    saturate(out, 2.6);
    return fadeOut(normalize(out, 0.9), sr, 0.08);
  },

  /**
   * 칼날이 칼날을 긁는 소리 (맞대고 밀 때 계속 도는 고리). 끝과 처음이 이어지게 만든다.
   * 미끄러지면서 작은 흠·요철에 걸렸다 풀리는 "걸림-미끄럼"(stick-slip): 아주 짧은 두드림이 1초에 천 번 넘게
   * → 칼날 모드를 계속 흔든다 → "지이익". 가끔 크게 걸리는 "득"도 섞는다.
   */
  scrape(sr, r) {
    const L = Math.round(2 * sr);
    const tail = Math.round(0.9 * sr);
    const x = new Float32Array(L + tail);
    const out = new Float32Array(L + tail);
    let t = 0;
    while (t < L) {
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / 1400) * sr));
      if (t < L) x[t] += Math.exp(0.7 * gauss(r)) * (r() < 0.5 ? -1 : 1) * 0.12;
    }
    // 크게 걸리는 순간 (1초에 8번쯤): 그 뒤로 잠깐 두드림이 몰린다
    t = 0;
    while (t < L) {
      t += Math.round((-Math.log(r() + 1e-9) / 8) * sr);
      for (let k = 0, tt = t; k < 12 && tt < L; k++, tt += Math.round(between(r, 0.0003, 0.002) * sr)) x[tt] += between(r, -1, 1) * 0.5;
    }
    for (let i = 0; i < L; i++) x[i] += 0.02 * (r() * 2 - 1); // 마찰 잡음
    const modes = [...swordModes(r, { f1: 22, at: 0.5, edge: 0.9, damp: 0.22, fmax: 9800 }), ...swordModes(r, { f1: 23.5, at: 0.7, edge: 0.9, damp: 0.22 })];
    // 낮은 모드는 빼고(쥔 손이 죽인다) 몇 개는 길게 남겨 "쉬이잉" 음색을 준다
    for (const m of modes) {
      if (m.f < 600) m.a *= 0.3;
      if (r() < 0.06 && m.f > 1500) m.t60 = between(r, 0.4, 0.8);
    }
    resonate(x, out, sr, modes, L);
    // 쇠 가루 "쉬익" (높은 잡음)
    const hp = new Filt('highpass', 3500, 0.7, sr);
    const wb = wobble(r, sr, 30);
    for (let i = 0; i < L; i++) out[i] += 0.4 * hp.run(r() * 2 - 1) * (0.4 + 0.6 * Math.abs(wb()));
    // 이음새: 끝에 남은 울림을 처음에 더한다 → 고리로 돌려도 틈이 없다
    const loop = out.slice(0, L);
    for (let i = 0; i < tail; i++) loop[i] += out[L + i];
    return normalize(loop, 0.8);
  },

  /** 스치듯 긁고 지나가는 한 번 "스르릉" (빗맞은 칼, 칼날 위로 미끄러진 타격) */
  shing(sr, r) {
    const dur = between(r, 0.35, 0.5);
    const n = Math.round((dur + 0.7) * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const L = Math.round(dur * sr);
    let t = 0;
    while (t < L) {
      const u = t / L;
      const rate = 2600 * (1 - u) + 250; // 미끄러지는 속도가 줄어든다
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / rate) * sr));
      const env = Math.min(1, t / (0.006 * sr)) * (1 - u) ** 1.5;
      if (t < L) x[t] += Math.exp(0.6 * gauss(r)) * (r() < 0.5 ? -1 : 1) * env * 0.15;
    }
    const modes = [...swordModes(r, { f1: between(r, 20, 24), at: between(r, 0.4, 0.9), edge: 1, damp: 0.7 }), ...guardModes(r, 0.15)];
    for (const m of modes) if (m.f < 700) m.a *= 0.35;
    resonate(x, out, sr, modes, L);
    const bp = new Filt('bandpass', 6000, 0.8, sr);
    for (let i = 0; i < L; i++) {
      const u = i / L;
      if (i % 64 === 0) bp.set(7000 - 4000 * u, 0.8);
      out[i] += 0.35 * bp.run(r() * 2 - 1) * Math.min(1, i / (0.004 * sr)) * (1 - u) ** 2;
    }
    return fadeOut(normalize(out, 0.9), sr, 0.2);
  },

  /**
   * 젖은 살: 살·피 속 공기 방울이 터지는 작은 "뽁" 수십 개 (방울 소리 모델: 음이 살짝 올라가며 금방 죽는 사인파)
   * + 질척한 낮은 잡음
   */
  wet(sr, r) {
    const dur = 0.36;
    const n = Math.round(dur * sr);
    const out = new Float32Array(n);
    const count = Math.round(between(r, 30, 55));
    for (let k = 0; k < count; k++) {
      const t0 = Math.min(0.3, -Math.log(r() + 1e-9) * 0.045);
      const f0 = Math.exp(between(r, Math.log(220), Math.log(1700)));
      const d = (0.13 * f0 + 0.0072 * f0 ** 1.5) * between(r, 0.6, 1.2); // 감쇠(1/초): 작은 방울일수록 빨리 죽는다
      const sigma = 0.1 * d * between(r, 0.5, 1.5); // 음이 올라가는 정도
      const amp = between(r, 0.2, 1) * (f0 / 500) ** -0.5 * Math.exp(-t0 / 0.12);
      const n0 = Math.round(t0 * sr);
      const len = Math.min(n - n0, Math.round((6 / d) * sr));
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        ph += (TAU * f0 * (1 + sigma * t)) / sr;
        out[n0 + i] += amp * Math.exp(-d * t) * Math.sin(ph);
      }
    }
    // 질척한 잡음: 필터 주파수가 흔들리는 저음 잡음
    const lp = new Filt('lowpass', 900, 2.5, sr);
    const wb = wobble(r, sr, 60);
    const am = wobble(r, sr, 45);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      if (i % 32 === 0) lp.set(750 + 450 * wb(), 2.5);
      out[i] += 0.5 * lp.run(r() * 2 - 1) * Math.min(1, t / 0.004) * Math.exp(-t / 0.07) * (0.3 + 0.7 * Math.abs(am()));
    }
    return fadeOut(normalize(out, 0.9), sr, 0.05);
  },

  /**
   * 베는 소리: 누비옷 천이 찢기는 "지직"(섬유가 끊어지는 틱 수천 번) + 칼날이 살을 가르는 "쉭"(높은음 → 낮은음)
   */
  slice(sr, r) {
    const dur = between(r, 0.18, 0.26);
    const n = Math.round((dur + 0.05) * sr);
    const out = new Float32Array(n);
    const L = Math.round(dur * sr);
    const env = (i) => Math.min(1, i / (0.004 * sr)) * (i < L ? (1 - i / L) ** 0.7 : 0);
    const bp = new Filt('bandpass', 2600, 0.8, sr);
    let next = 0;
    for (let i = 0; i < n; i++) {
      let v = 0;
      if (i >= next) {
        v = (r() * 2 - 1) * 2.5;
        next = i + Math.max(1, Math.round((-Math.log(r() + 1e-9) / 3200) * sr));
      }
      out[i] += bp.run(v) * env(i);
    }
    const sw = new Filt('bandpass', 4000, 1.2, sr);
    for (let i = 0; i < n; i++) {
      if (i % 32 === 0) sw.set(4200 * Math.pow(900 / 4200, Math.min(1, i / L)), 1.2);
      out[i] += 0.9 * sw.run(r() * 2 - 1) * env(i);
    }
    return fadeOut(normalize(out, 0.9), sr, 0.03);
  },

  /** 몸통을 치는 둔탁한 "퍽". 세게 찌그러뜨려 폰 스피커에서도 들리는 200~600Hz 배음을 만든다 */
  thump(sr, r) {
    const n = Math.round(0.3 * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    // 살과 근육 덩어리가 출렁이는 둔한 울림 (180~500Hz, 금방 죽는다): 부드러운 접촉(1.5ms)으로 두드린다
    pulse(x, sr, 0.001, between(r, 0.0012, 0.002), 1);
    const modes = [];
    for (let i = 0; i < 7; i++) modes.push({ f: Math.exp(between(r, Math.log(170), Math.log(560))), a: between(r, 0.5, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.06, 0.14) });
    resonate(x, out, sr, modes, Math.ceil(0.004 * sr));
    normalize(out, 1);
    thumpTone(out, sr, { f0: between(r, 70, 90), drop: 0.9, dropTau: 0.012, tau: between(r, 0.03, 0.04), amp: 0.6 });
    noiseHit(out, sr, r, { amp: 0.5, attack: 0.001, tau: 0.012, type: 'lowpass', f: 700, q: 0.8 });
    noiseHit(out, sr, r, { amp: 0.25, attack: 0.0005, tau: 0.004, type: 'bandpass', f: 1300, q: 1 }); // 살 "철썩"
    saturate(out, 3.5, 0.2);
    return fadeOut(normalize(out, 0.9), sr, 0.05);
  },

  /** 뼈: 날카로운 "딱"이 몇 번 겹치고(금이 가며 부러짐), 단단하지만 금방 멎는 울림 (700Hz~4kHz) */
  bone(sr, r) {
    const n = Math.round(0.2 * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const times = [0.001];
    const k = Math.round(between(r, 3, 6));
    for (let i = 0; i < k; i++) times.push(0.001 + between(r, 0.003, 0.045) * (i + 1) / k);
    for (const [i, t] of times.entries()) pulse(x, sr, t, 0.00015, (i === 0 ? 1 : between(r, 0.2, 0.7)) * (r() < 0.5 ? -1 : 1));
    const modes = [];
    for (let i = 0; i < 9; i++) modes.push({ f: Math.exp(between(r, Math.log(700), Math.log(4200))), a: between(r, 0.4, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.02, 0.07) });
    resonate(x, out, sr, modes, Math.ceil(0.06 * sr));
    normalize(out, 1);
    for (const t of times) noiseHit(out, sr, r, { t0: t, amp: between(r, 0.3, 0.6), tau: 0.0015, f: 2000 });
    saturate(out, 1.8);
    return fadeOut(normalize(out, 0.9), sr, 0.03);
  },

  /** 경기장 울림(잔향)용 충격 응답: 관중석에 되울리는 초기 반사 몇 개 + 부드럽게 사라지는 꼬리 (스테레오) */
  reverbIR(sr, r) {
    const dur = 0.9;
    const n = Math.round(dur * sr);
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    for (let k = 0; k < 8; k++) {
      const t = between(r, 0.018, 0.075);
      const a = between(r, 0.2, 0.5) * (r() < 0.5 ? -1 : 1);
      (r() < 0.5 ? L : R)[Math.round(t * sr)] += a;
    }
    const lpL = new Filt('lowpass', 5000, 0.7, sr);
    const lpR = new Filt('lowpass', 5000, 0.7, sr);
    for (let i = Math.round(0.012 * sr); i < n; i++) {
      const t = i / sr;
      if (i % 256 === 0) {
        // 높은 소리일수록 먼저 사라진다
        const f = 6000 * Math.exp(-t / 0.35) + 900;
        lpL.set(f, 0.7);
        lpR.set(f, 0.7);
      }
      const e = 0.35 * Math.exp((-6.91 * t) / 0.85) * Math.min(1, (t - 0.012) / 0.03);
      L[i] += e * lpL.run(r() * 2 - 1);
      R[i] += e * lpR.run(r() * 2 - 1);
    }
    // 에너지를 1로 맞춘다 → 보내는 양(SOUND.reverb)이 곧 "원래 소리 대비 울림의 크기"가 된다
    let en = 0;
    for (let i = 0; i < n; i++) en += (L[i] * L[i] + R[i] * R[i]) / 2;
    const k = 1 / Math.sqrt(en);
    for (let i = 0; i < n; i++) {
      L[i] *= k;
      R[i] *= k;
    }
    return [L, R];
  },
};

// 미리 만들어 둘 소리 조각: [이름, 벌 수, 만드는 함수] (자주·먼저 필요한 것부터)
const BANK = [
  ['clashSoft', 4, (sr, r) => SYNTH.clash(sr, r, false)],
  ['clashHard', 5, (sr, r) => SYNTH.clash(sr, r, true)],
  ['thump', 3, SYNTH.thump],
  ['slice', 3, SYNTH.slice],
  ['wet', 3, SYNTH.wet],
  ['shing', 3, SYNTH.shing],
  ['scrape', 1, SYNTH.scrape],
  ['helmet', 3, SYNTH.helmet],
  ['bone', 3, SYNTH.bone],
];
/** 소리 조각 하나 만들기 (일꾼 스레드 soundgen.js 에서도 부른다) */
export function makeBankSound(name, sr, seed) {
  return BANK.find((b) => b[0] === name)[2](sr, makeRng(seed));
}

// 녹음된 소리 (Kenney.nl, CC0). 없거나 못 읽어도 합성 소리만으로 동작한다
const SAMPLES = {
  punch: ['punch1', 'punch2', 'punch3', 'punch4', 'punch5'], // 몸통을 치는 "퍽"
  crack: ['crack1'], // 나무 쪼개지는 "딱" → 뼈 부러지는 소리로 쓴다 (효과음에서 흔히 쓰는 방법)
  slide: ['slide1', 'slide2'], // 칼날이 미끄러지는 "스르릉"
};

// ─────────────────────────────────────────────────────────────
//  실제로 소리를 내는 부분
// ─────────────────────────────────────────────────────────────
export class Sound {
  constructor() {
    this.ctx = null;
    this._on = true;
    this.bank = {};
    this.samples = {};
    this.voices = [];
    this.useSamples = SOUND.samples;
    this.stats = { events: 0, nodes: 0, stolen: 0, genMs: 0 };
    this._lastClash = { t: -1, x: 0 };
    this.seed = (Math.random() * 1e9) | 0;
  }

  get on() {
    return this._on;
  }
  /** 소리 켜기/끄기: 끄면 새 소리를 안 내고, 울리고 있던 꼬리(울림·고리 소리)도 바로 줄인다 */
  set on(v) {
    this._on = !!v;
    if (this.master) this.master.gain.setTargetAtTime(this._on ? SOUND.volume : 0, this.ctx.currentTime, 0.02);
  }

  /**
   * 브라우저 규칙상 사용자가 화면을 누른 뒤에만 소리를 켤 수 있다 → 시작 버튼을 누를 때 부른다.
   * ctx 를 주면 그 오디오 문맥을 쓴다 (소리 분석용 OfflineAudioContext)
   */
  unlock(ctx) {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!ctx && !AC) return;
      this.ctx = ctx || new AC();
      this.build();
      if (!this.ctx.startRendering) this.prepareSoon(); // (분석용 OfflineAudioContext 는 prepareAll 로 한꺼번에)
      this.samplesReady = this.useSamples ? this.loadSamples() : Promise.resolve();
    }
    // 폰이 전화·잠금 등으로 소리를 멈췄으면 다시 켠다 (아이폰은 'interrupted'). 분석용 OfflineAudioContext 는 빼고
    const st = this.ctx.state;
    if ((st === 'suspended' || st === 'interrupted') && !this.ctx.startRendering) this.ctx.resume().catch(() => {});
  }

  /** 경기장 울림 세기 바꾸기 (0 = 끔) */
  setReverb(amount) {
    for (const s of this.sends || []) s.g.gain.setTargetAtTime(s.amt * amount, this.ctx.currentTime, 0.02);
  }

  /** 소리 길: 소리들 → (쇳소리 / 살 소리 묶음) → 전체 음량 → 리미터(찢어지지 않게) → 스피커. 묶음마다 울림을 조금씩 보낸다 */
  build() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this._on ? SOUND.volume : 0;
    // 여러 소리가 겹쳐도 소리가 깨지지(클리핑) 않게: 큰 소리를 부드럽게 누르고(컴프레서),
    // 그래도 넘치는 순간은 둥글게 깎는다(소프트 클리퍼: 입력 ±2 까지를 ±0.95 안으로)
    const lim = c.createDynamicsCompressor();
    lim.threshold.value = -6;
    lim.knee.value = 6;
    lim.ratio.value = 8;
    lim.attack.value = 0.002;
    lim.release.value = 0.1;
    const clip = c.createWaveShaper();
    const curve = new Float32Array(1025);
    for (let i = 0; i < curve.length; i++) {
      const x = ((i / (curve.length - 1)) * 2 - 1) * 2; // −2 ~ 2
      const a = Math.abs(x);
      curve[i] = Math.sign(x) * (a < 0.7 ? a : 0.7 + 0.25 * Math.tanh((a - 0.7) / 0.25));
    }
    clip.curve = curve;
    const pre = c.createGain();
    pre.gain.value = 0.5; // 곡선의 입력 범위(−1~1)에 ±2 를 담으려고 반으로 줄인다 (곡선 값은 원래 크기)
    this.master.connect(lim).connect(pre).connect(clip).connect(c.destination);
    this.metalBus = c.createGain();
    this.fleshBus = c.createGain();
    this.metalBus.connect(this.master);
    this.fleshBus.connect(this.master);
    if (SOUND.reverb > 0) {
      const conv = c.createConvolver();
      const [L, R] = SYNTH.reverbIR(c.sampleRate, makeRng(7));
      const ir = c.createBuffer(2, L.length, c.sampleRate);
      ir.getChannelData(0).set(L);
      ir.getChannelData(1).set(R);
      conv.normalize = false;
      conv.buffer = ir;
      conv.connect(this.master);
      this.sends = [];
      const send = (bus, amt) => {
        const g = c.createGain();
        g.gain.value = amt * SOUND.reverb;
        bus.connect(g).connect(conv);
        this.sends.push({ g, amt });
      };
      send(this.metalBus, 1); // 쇳소리는 관중석에 크게 되울린다
      send(this.fleshBus, 0.4);
    }
    // 바람 소리용 흰 잡음 (0.4초, 되풀이해서 쓴다)
    const len = Math.round(c.sampleRate * 0.4);
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    const r = makeRng(this.seed);
    for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  }

  /**
   * 소리 조각 만들기: 일꾼 스레드(Web Worker, soundgen.js)에서 계산해서 받는다 → 게임 화면이 멈칫하지 않는다.
   * 일꾼을 못 쓰는 브라우저면 메인 스레드에서 한 번에 하나씩 나눠서 만든다.
   */
  prepareSoon() {
    const jobs = [];
    for (const [name, count] of BANK) for (let i = 0; i < count; i++) jobs.push({ name, seed: this.seedFor(name, i) });
    try {
      const w = new Worker(new URL('./soundgen.js', import.meta.url), { type: 'module' });
      let left = jobs.length;
      w.onmessage = (e) => {
        this.addBuffer(e.data.name, e.data.data);
        this.stats.genMs += e.data.ms;
        if (--left === 0) w.terminate();
      };
      w.onerror = () => {
        w.terminate();
        this.prepareOnMain(jobs);
      };
      w.postMessage({ jobs, sr: this.ctx.sampleRate });
    } catch {
      this.prepareOnMain(jobs);
    }
  }
  prepareOnMain(jobs) {
    const next = () => {
      const j = jobs.shift();
      if (!j) return;
      if (this.need(j.name)) this.makeOne(j.name);
      setTimeout(next, 0);
    };
    setTimeout(next, 0);
  }
  /** 모든 소리 조각을 지금 바로 만든다 (분석용) */
  prepareAll() {
    for (const [name] of BANK) while (this.need(name)) this.makeOne(name);
  }
  seedFor(name, i) {
    return this.seed + name.charCodeAt(0) * 7919 + name.length * 131 + i * 104729;
  }
  need(name) {
    return (this.bank[name]?.length || 0) < BANK.find((b) => b[0] === name)[1];
  }
  addBuffer(name, data) {
    if (!this.need(name)) return null; // (일꾼이 만든 것과 급히 만든 것이 겹치면 버린다)
    const buf = this.ctx.createBuffer(1, data.length, this.ctx.sampleRate);
    buf.getChannelData(0).set(data);
    (this.bank[name] = this.bank[name] || []).push(buf);
    return buf;
  }
  /** 지금 바로 하나 만든다 (필요한데 아직 도착하지 않았을 때) */
  makeOne(name) {
    const t0 = performance.now();
    const buf = this.addBuffer(name, makeBankSound(name, this.ctx.sampleRate, this.seedFor(name, this.bank[name]?.length || 0)));
    this.stats.genMs += performance.now() - t0;
    return buf;
  }
  /** 이름으로 소리 조각 하나를 무작위로 (아직 하나도 없으면 지금 만든다) */
  pick(name) {
    const list = this.bank[name];
    if (!list || !list.length) return this.makeOne(name);
    return list[(Math.random() * list.length) | 0];
  }
  pickSample(name) {
    if (!this.useSamples) return null;
    const list = this.samples[name];
    return list && list.length ? list[(Math.random() * list.length) | 0] : null;
  }

  /** 녹음된 소리 읽기 (첫 화면 터치 뒤에, 뒤에서 천천히) */
  async loadSamples() {
    const c = this.ctx;
    for (const [name, files] of Object.entries(SAMPLES)) {
      for (const f of files) {
        try {
          const res = await fetch(new URL(`sfx/${f}.mp3`, document.baseURI));
          if (!res.ok) continue;
          const ab = await res.arrayBuffer();
          const buf = await new Promise((ok, bad) => c.decodeAudioData(ab, ok, bad)); // 옛 사파리는 콜백 방식만 된다
          (this.samples[name] = this.samples[name] || []).push(trimStart(c, buf));
        } catch {
          /* 못 읽으면 합성 소리만 쓴다 */
        }
      }
    }
  }

  // ── 소리 하나(이벤트) 틀기 ──
  // 소리 조각 여러 겹 → 각자 음량 → (밝기 필터) → 이벤트 음량 → 묶음(bus)
  // 동시에 너무 많이 울리면 가장 오래된 소리를 빨리 줄여서 끈다 (폰 부담)
  event({ bus, gain = 1, bright = 0, prio = 1 }) {
    const c = this.ctx;
    const now = c.currentTime;
    this.voices = this.voices.filter((v) => v.end > now);
    while (this.voices.length >= SOUND.maxVoices) {
      this.voices.sort((a, b) => a.prio - b.prio || a.start - b.start);
      const v = this.voices.shift();
      v.out.gain.setTargetAtTime(0, now, 0.01);
      for (const s of v.srcs) {
        try {
          s.stop(now + 0.06);
        } catch {
          /* 옛 사파리: stop 을 두 번 부르면 오류 */
        }
      }
      this.stats.stolen++;
    }
    const out = c.createGain();
    out.gain.value = gain;
    let input = out;
    let nodes = 1;
    if (bright > 0) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = Math.min(bright, c.sampleRate * 0.45);
      f.Q.value = 0.5;
      f.connect(out);
      input = f;
      nodes++;
    }
    out.connect(bus);
    const ev = { out, input, srcs: [], end: now, start: now, prio };
    this.voices.push(ev);
    this.stats.events++;
    this.stats.nodes += nodes;
    return ev;
  }
  /** 이벤트에 소리 조각 한 겹 더하기 */
  // dur: 이 길이(초)만 틀고 끝을 줄여 끈다 (약한 소리는 긴 울림 꼬리가 어차피 안 들린다 → 폰 부담 줄이기)
  layer(ev, buf, { gain = 1, rate = 1, delay = 0, dur = 0 } = {}) {
    if (!buf || gain <= 0.001) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate;
    let node = s;
    if (Math.abs(gain - 1) > 0.02) {
      node = c.createGain();
      node.gain.value = gain;
      s.connect(node);
      this.stats.nodes++;
    }
    const t = c.currentTime + delay;
    s.start(t); // (stop 보다 먼저 불러야 한다)
    let len = buf.duration / rate;
    if (dur > 0 && dur < len - 0.05) {
      // 끝을 부드럽게 줄이고 끈다 (이 소리 층만 따로 줄이려고 음량 노드를 하나 둔다)
      if (node === s) {
        node = c.createGain();
        s.connect(node);
        this.stats.nodes++;
      }
      node.gain.setTargetAtTime(0, t + dur - 0.12, 0.03);
      len = dur;
      s.stop(t + dur);
    }
    node.connect(ev.input);
    ev.srcs.push(s);
    ev.end = Math.max(ev.end, t + len);
    this.stats.nodes++;
  }

  // ─────────────────────────────────────────────────────────────
  //  게임에서 부르는 소리들
  // ─────────────────────────────────────────────────────────────

  /**
   * 칼끼리 부딪힘.
   * @param impact 부딪히는 속도 (m/s, 맞닿는 방향). 세기와 밝기가 여기서 정해진다
   * @param slide  칼날을 따라 스치는 속도 (m/s). 크면 "스르릉" 긁히는 소리가 섞인다
   */
  clash(impact, slide = 0) {
    if (!this._on || !this.ctx) return;
    // 세기 0~1: 부딪히는 속도 0.3 → 7.8 m/s (AI 대결에서 중간값 2m/s, 상위 10% 6m/s, 사람이 세게 치면 10m/s 넘게)
    const x = clamp01((impact - 0.3) / 7.5);
    const glance = clamp01((slide - 1.2) / 6) * clamp01(slide / (impact + slide + 1e-6) * 1.6 - 0.4);
    if (x <= 0 && glance <= 0) return;
    // 아주 짧은 사이에 거듭 닿으면(칼이 떨며 몇 번 부딪힘) 더 센 것만 낸다
    const now = this.ctx.currentTime;
    if (now - this._lastClash.t < 0.06 && x <= this._lastClash.x + 0.15) return;
    this._lastClash = { t: now, x };
    const vol = 0.18 + 0.82 * x ** 0.7; // 약 −15dB ~ 0dB
    // 세게 칠수록 두 칼이 맞닿는 시간이 짧아져서 높은 소리까지 울린다 (거의 최대면 필터 없이)
    const bright = 2200 + 14000 * x ** 1.3;
    const ev = this.event({ bus: this.metalBus, gain: vol, bright: bright < 12000 ? bright : 0, prio: 1 + x });
    // 세기에 따라 층을 고른다 (녹음 효과음의 "세기 층" 방식): 약하게 = 둔탁한 "텅", 세게 = "쨍그렁".
    // 0.15~0.55 사이에서는 센 층이 나올 확률이 점점 커진다
    const hardP = clamp01((x - 0.15) / 0.4);
    const buf = Math.random() < hardP ? this.pick('clashHard') : this.pick('clashSoft');
    const pitch = between(Math.random, 0.93, 1.05) * (1 - 0.05 * x); // 세게 치면 살짝 낮게 (더 무겁게)
    const skim = 1 - 0.6 * glance; // 스친 타격은 덜 울린다
    this.layer(ev, buf, { gain: skim, rate: pitch, dur: 0.35 + 1.1 * x });
    if (glance > 0) this.shing(ev, glance, slide);
  }

  /** 스치는 "스르릉" 한 번 (clash 가 부른다) */
  shing(ev, amount, slide) {
    const rate = 0.85 + 0.25 * clamp01(slide / 10);
    this.layer(ev, this.pick('shing'), { gain: 0.9 * amount, rate, delay: 0.004 });
    const rec = this.pickSample('slide');
    if (rec) this.layer(ev, rec, { gain: 0.5 * amount, rate: rate * between(Math.random, 0.8, 0.95), delay: 0.006 });
  }

  /** 투구를 친 소리: 둔탁한 "깡" (머리가 받는 "쿵"은 조각 안에 들어 있고, 몸통 소리는 main.js 가 blunt 로 따로 낸다) */
  helmet(energy) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 110);
    const ev = this.event({ bus: this.metalBus, gain: 0.3 + 0.7 * e ** 0.8, bright: 2500 + 12000 * e, prio: 2 });
    this.layer(ev, this.pick('helmet'), { rate: between(Math.random, 0.9, 1.06) });
  }

  /** 몸통 "퍽" 한 겹 (녹음된 소리가 있으면 둘 다 섞는다) */
  body(ev, gain, rate = 1) {
    const rec = this.pickSample('punch');
    this.layer(ev, this.pick('thump'), { gain: rec ? gain * 0.9 : gain, rate: rate * between(Math.random, 0.9, 1.1) });
    if (rec) this.layer(ev, rec, { gain: gain * 0.55, rate: rate * between(Math.random, 0.9, 1.08) }); // 녹음된 "퍽"은 저음이 많아 이어폰에서 무게를 더한다
  }

  /** 베기: 천이 찢기고 살을 가르는 "쉭-지직" + 젖은 소리 + 몸통 "퍽". through = 베고 지나감 */
  cut(energy, through) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 140);
    const ev = this.event({ bus: this.fleshBus, gain: 0.35 + 0.65 * e ** 0.8, prio: 2 });
    // 베고 지나가면 가르는 소리가 길고(느리게 틀기), 몸통 충격은 작다 (칼이 멈추지 않았으니까)
    this.layer(ev, this.pick('slice'), { gain: 0.5 + 0.3 * e, rate: through ? between(Math.random, 0.72, 0.82) : between(Math.random, 0.9, 1.1) });
    this.layer(ev, this.pick('wet'), { gain: 0.35 + 0.5 * e, rate: between(Math.random, 0.85, 1.15), delay: 0.012 });
    this.body(ev, through ? 0.45 + 0.3 * e : 0.6 + 0.4 * e);
  }

  /** 찌르기: 무겁고 짧은 "퍽" + 푹 들어가는 젖은 소리 */
  stab(energy) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 100);
    const ev = this.event({ bus: this.fleshBus, gain: 0.4 + 0.6 * e ** 0.8, prio: 2 });
    this.body(ev, 0.9, 0.85);
    this.layer(ev, this.pick('wet'), { gain: 0.5 + 0.4 * e, rate: between(Math.random, 0.7, 0.85), delay: 0.008 });
    this.layer(ev, this.pick('slice'), { gain: 0.3, rate: 1.3, delay: 0.004 }); // 천을 뚫는 짧은 "틱"
  }

  /** 둔기(칼 면, 손잡이, 막힌 베기): "퍽" + 칼 면이 몸을 때리는 둔한 쇳소리 */
  blunt(energy) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 120);
    const ev = this.event({ bus: this.fleshBus, gain: 0.3 + 0.7 * e ** 0.8, prio: 1.5 });
    this.body(ev, 1);
    // 세게 맞으면(칼 면으로 후려침) 칼도 둔하게 울린다
    if (e > 0.2) this.layer(ev, this.pick('clashSoft'), { gain: 0.25 * e, rate: between(Math.random, 0.8, 0.9), delay: 0.003 });
  }

  /** 뼈 부딪히는/부러지는 소리 */
  bone(energy) {
    if (!this._on || !this.ctx) return;
    const e = clamp01((energy - 50) / 150);
    const ev = this.event({ bus: this.fleshBus, gain: 0.35 + 0.55 * e, prio: 2 });
    this.layer(ev, this.pick('bone'), { gain: 0.9, rate: between(Math.random, 0.85, 1.1), delay: 0.006 });
    const rec = this.pickSample('crack');
    if (rec) this.layer(ev, rec, { gain: 0.6, rate: between(Math.random, 1.05, 1.3), delay: 0.004 });
  }

  /**
   * 칼끼리 맞대고 긁는 소리 (바인드). 매 프레임 부른다.
   * @param slide 미끄러지는 속도 (m/s), press 누르는 힘 (N). 둘 다 0 이면 조용해진다
   */
  scrape(slide, press = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (!this._scrape) {
      if (!(slide > 0.2) || !this._on) return; // 처음 긁을 때 만든다
      const s = c.createBufferSource();
      s.buffer = this.pick('scrape');
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 0.6;
      f.frequency.value = 3000;
      const g = c.createGain();
      g.gain.value = 0;
      s.connect(f).connect(g).connect(this.metalBus);
      s.start();
      this._scrape = { s, f, g, quiet: c.currentTime };
    }
    const v = clamp01((slide - 0.2) / 4); // 0.2 → 4.2 m/s
    const p = clamp01(Math.sqrt(press / 150)); // 세게 누를수록 크게 (150N 이상 = 최대)
    const vol = this._on ? 0.55 * v ** 0.8 * (0.35 + 0.65 * p) : 0;
    const t = c.currentTime;
    const sc = this._scrape;
    if (vol > 0) sc.quiet = t;
    else if (t - (sc.quiet ?? t) > 0.4) {
      // 한동안 조용하면 멈춘다 (다음에 긁을 때 다시 만든다)
      sc.s.stop();
      sc.g.disconnect();
      this._scrape = null;
      return;
    }
    sc.g.gain.setTargetAtTime(vol, t, vol > sc.g.gain.value ? 0.02 : 0.06);
    sc.s.playbackRate.setTargetAtTime(0.9 + 0.2 * v, t, 0.05); // 빨리 미끄러질수록 촘촘하고 조금 높게
    sc.f.frequency.setTargetAtTime(1800 + 3500 * v, t, 0.05); // … 그리고 밝게
  }

  /**
   * 칼마다 하나씩 계속 도는 바람 소리. 칼끝 속도에 따라 커지고 높아진다 → 칼이 가속·감속하는 게 들린다.
   * 음량 곡선은 아래로 볼록 (Blade & Sorcery의 긴 칼 바람 소리 곡선 모양: 느릴 땐 거의 안 들리다가 빨라지면 확 커진다)
   */
  whooshLoop() {
    if (!this.ctx) return null;
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.6;
    f.frequency.value = 300;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    const self = this;
    return {
      set(speed) {
        const x = Math.min(1, Math.max(0, (speed - 4) / 16)); // 칼끝 4 → 20 m/s
        const vol = self._on ? 0.6 * Math.pow(x, 2.2) * 0.5 : 0; // (0,0) (0.66, ≈0.25) (1, 0.6) × 전체 음량
        const t = c.currentTime;
        g.gain.setTargetAtTime(vol, t, 0.03);
        f.frequency.setTargetAtTime(250 + 1150 * x, t, 0.03);
      },
    };
  }
}

/** mp3 는 앞에 짧은 빈 소리(인코더 지연 약 25ms)가 붙기도 한다 → 잘라내서 합성 소리와 박자를 맞춘다 */
function trimStart(c, buf) {
  const d = buf.getChannelData(0);
  const peak = peakOf(d);
  let i = 0;
  while (i < d.length && Math.abs(d[i]) < peak * 0.01) i++;
  i = Math.max(0, i - 32);
  if (i < 16) return buf;
  const out = c.createBuffer(buf.numberOfChannels, d.length - i, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) out.getChannelData(ch).set(buf.getChannelData(ch).subarray(i));
  return out;
}
