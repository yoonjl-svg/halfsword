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

// 무기 재질 쌍 API(Sound.impact)가 알아듣는 재질 이름들. 다른 무기를 추가하는 쪽에서 이 목록을 참고한다
export const MATERIALS = ['steel', 'armor', 'flesh', 'wood', 'plasma', 'rubber', 'frozen'];

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
/** 우그러들거나 긁히는 "우두둑" 그릿: 짧은 대역 잡음 조각을 무작위 시간에 흩뿌린다 (투구 찌그러짐, 나무 쪼개짐 등) */
function gritBurst(out, sr, r, { t0 = 0, span = 0.04, count = 10, amp = 1, fLo = 500, fHi = 3000 }) {
  for (let k = 0; k < count; k++) {
    const t = t0 + r() * span;
    const f = Math.exp(between(r, Math.log(fLo), Math.log(fHi)));
    noiseHit(out, sr, r, { t0: t, amp: amp * between(r, 0.3, 1), attack: 0.0002, tau: between(r, 0.0015, 0.004), type: 'bandpass', f, q: between(r, 0.8, 2) });
  }
}
/** 냄비 대역 깎기: 원래 소리에서 f 근처(대역 통과) 성분을 빼서 그 대역만 움푹 낮춘다 (amount 0.6 ≈ −8dB) */
function potCut(a, sr, f = 550, amount = 0.6, q = 0.7) {
  const bp = new Filt('bandpass', f, q, sr);
  for (let i = 0; i < a.length; i++) a[i] -= amount * bp.run(a[i]);
  return a;
}
/**
 * 쇠가 찢어지듯 갈라지는 "짝-치직": 아주 짧고 높은(2.5kHz 위) 딸깍이 몇 ms 사이에 연달아 터진다 (금이 번져 나가는 파열).
 * 첫 딸깍이 가장 크고 뒤로 갈수록 작아진다
 */
function crackBurst(out, sr, r, { t0 = 0.001, count = 4, span = 0.012, amp = 1, f = 2800 }) {
  for (let k = 0; k < count; k++) {
    const t = t0 + (k ? span * (k / count) * between(r, 0.6, 1.3) : 0);
    noiseHit(out, sr, r, { t0: t, amp: amp * (k ? between(r, 0.25, 0.6) : 1), attack: 0.00005, tau: between(r, 0.0004, 0.0012), type: 'highpass', f: f * between(r, 0.9, 1.4), q: 0.8, len: 6 });
  }
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
function swordModes(r, { f1 = 22, at = 0.6, edge = 0.6, damp = 1, fmax = 9500, even = false }) {
  const modes = [];
  // even: 긁기·스치기처럼 계속 이어지는 소리용 고른 음색 (부딪힘처럼 날카롭게 올리면 오래 들을 때 귀가 아프다)
  const tiltEven = (f) => (0.3 + 0.9 * Math.exp(-(Math.log2(f / 650) ** 2) / (2 * 0.7 ** 2)) + 0.9 * Math.exp(-(Math.log2(f / 3000) ** 2) / (2 * 0.8 ** 2))) * (f > 6500 ? (6500 / f) ** 1.5 : 1);
  const tilt = (f) => {
    if (even) return tiltEven(f);
    // 소리 설계용 음색 곡선. 300~900Hz를 키우면 폰 스피커(200Hz 아래는 거의 안 나온다)에서 "냄비 두드리는 퉁"만 남는다
    //  → 그 대역은 낮추고, 쇠가 찢어지듯 날카로운 3~5kHz를 올린다 (무게감은 따로 넣는 200Hz 아래 "쿵"이 맡는다)
    const body = 0.45 * Math.exp(-(Math.log2(f / 450) ** 2) / (2 * 0.7 ** 2));
    const bite = 1.3 * Math.exp(-(Math.log2(f / 3800) ** 2) / (2 * 0.7 ** 2));
    return (0.25 + body + bite) * (f > 7500 ? (7500 / f) ** 1.5 : 1);
  };
  const decay = (f) => {
    // 손이 쥐고 있어서 낮은 진동은 금방 죽고, 예전엔 1~5kHz 울림이 0.8초까지 남아 종처럼 울렸다 →
    // 전 대역을 확 줄여서(약 1/5) "쟁그렁"은 남기되 "댕~"하고 우는 꼬리는 없앤다
    const t = f < 350 ? 0.03 + (0.045 * (f - 150)) / 200 : f < 1400 ? 0.075 + (0.08 * (f - 350)) / 1050 : f < 5000 ? 0.13 : 0.13 - (0.07 * (f - 5000)) / 4500;
    return Math.max(0.018, t) * damp * between(r, 0.7, 1.15);
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
  return [1, 2.756, 5.404].map((k, i) => ({ f: f0 * k * (1 + 0.02 * gauss(r)), a: amp * (i === 0 ? 1 : 0.6) * between(r, 0.6, 1.1), t60: between(r, 0.03, 0.06) })); // 길게 울리면 종·마림바 같은 "통"이 된다
}

// ─────────────────────────────────────────────────────────────
//  목소리: 모음별 입안 공명대(포먼트) [F1~F4 (Hz), 대역폭 B1~B4 (Hz)] — 성인 남성 기준 (Peterson & Barney 1952 평균값 근처)
// ─────────────────────────────────────────────────────────────
const VOWELS = {
  a: [730, 1090, 2440, 3400, 90, 110, 160, 250],
  ʌ: [640, 1190, 2390, 3400, 80, 100, 150, 250],
  u: [300, 870, 2240, 3300, 60, 90, 150, 250],
  o: [570, 840, 2410, 3400, 70, 90, 150, 250],
  e: [530, 1840, 2480, 3500, 70, 110, 160, 250],
  ə: [500, 1500, 2500, 3500, 80, 110, 160, 250],
};

/**
 * 캐릭터별 목소리 (characters.js 의 id 로 찾는다. 없으면 generic).
 *  f0: 평소 목소리 높이(Hz), tract: 입안 공명대 배율(성도가 짧을수록 큼 — 여성 약 1.15),
 *  breath: 숨 섞인 정도, rough: 목 긁힘(보컬 프라이), style: 죽을 때의 버릇 (voiceScript)
 *  rec: 녹음된 목소리 (public/sfx/voice/<id>_<ko|bleed><번호>.mp3, 출처는 public/sfx/LICENSE.txt).
 *       ko·bleed = 파일 개수(0이면 그 죽음은 합성 목소리), rate = 재생 속도(목소리 높이), gain = 음량
 *       녹음은 들어 보지 않고 음높이·길이 분석으로 골랐다 — 귀로 듣고 바꾸려면 파일만 갈아 끼우면 된다
 */
export const VOICES = {
  player: { f0: 118, tract: 1.0, breath: 0.35, rough: 0.3, style: 'grunt', rec: { ko: 2, bleed: 2 } }, // HaelDB 3번 목소리
  generic: { f0: 124, tract: 1.0, breath: 0.35, rough: 0.3, style: 'grunt', rec: { ko: 2, bleed: 2 } }, // HaelDB 첫 목소리 + VoiceBosch
  bran: { f0: 98, tract: 0.93, breath: 0.3, rough: 0.55, style: 'sob', rec: { ko: 2, bleed: 2, rate: 0.92 } }, // Baradari(거칠고 낮음) + VoiceBosch. 굵고 거친 목
  isolde: { f0: 225, tract: 1.17, breath: 0.45, rough: 0.08, style: 'gasp', rec: { ko: 1, bleed: 1, gain: 0.75 } }, // 여성 비명(짧은 것만), 작게
  liao: { f0: 112, tract: 1.0, breath: 0.65, rough: 0.35, style: 'sigh', rec: { ko: 1, bleed: 0, gain: 0.6, rate: 0.95 } }, // 짧은 신음 하나, 피 흘려 죽을 땐 합성 한숨
  heinrich: { f0: 132, tract: 1.03, breath: 0.3, rough: 0.35, style: 'laugh', rec: { ko: 2, bleed: 2 } }, // HaelDB 가장 높은 목소리(과장된 외침) + VoiceBosch
  margarethe: { f0: 168, tract: 1.12, breath: 0.6, rough: 0.3, style: 'exhale', rec: { ko: 1, bleed: 0, gain: 0.7, rate: 0.85 } }, // 낮춘 여성 신음 하나, 출혈사는 합성 날숨
};

/**
 * 죽을 때 목소리의 "대본": 조각(모음·길이·음높이·세기·성대 울림 정도·바람 소리)을 시간 순서로 늘어놓는다.
 * kind 'ko' = 머리를 맞아 정신을 잃음(짧게 뚝 끊김), 'bleed' = 피가 빠져 숨이 잦아듦(길게)
 */
function voiceScript(r, prof, kind) {
  const F = prof.f0 * between(r, 0.95, 1.05);
  const S = [];
  let t = 0.005;
  const add = (dur, vowel, a, b, amp, voice, air = 0, attack = 0.012, release = 0.05, gap = 0) => {
    S.push({ t, dur, vowel, f0a: F * a, f0b: F * b, amp, voice, air, attack, release });
    t += dur + gap;
  };
  const inhale = (dur, amp) => add(dur, 'a', 1, 1, amp, 0, 1, dur * 0.4, dur * 0.3, 0.02); // 들숨: 성대 안 울리고 바람만
  const exhale = (dur, amp, vowel = 'ə') => add(dur, vowel, 0.9, 0.7, amp, 0.12, 0.9, 0.02, dur * 0.6); // 날숨: 끝이 스르르
  const ko = kind === 'ko';
  switch (prof.style) {
    case 'sob':
      if (ko) {
        add(0.14, 'a', 1.5, 1.15, 1, 1, 0.2, 0.006, 0.02);
        add(0.06, 'ʌ', 1.1, 0.9, 0.6, 0.8, 0.1, 0.005, 0.012);
        exhale(0.3, 0.25);
      } else {
        for (let i = 0; i < 3; i++) {
          inhale(0.12, 0.25);
          add(0.18 + 0.05 * i, 'u', 1.35 - 0.05 * i, 1.05, 0.7 - 0.15 * i, 0.85, 0.25, 0.02, 0.06, 0.05);
        }
        exhale(0.6, 0.3, 'ʌ');
      }
      break;
    case 'gasp':
      if (ko) {
        inhale(0.11, 0.6);
        add(0.05, 'ə', 1, 0.95, 0.25, 0.6, 0.3, 0.004, 0.01);
      } else {
        inhale(0.2, 0.45);
        add(0.35, 'e', 1.1, 0.85, 0.35, 0.55, 0.4, 0.03, 0.15, 0.25);
        inhale(0.14, 0.25);
        exhale(0.7, 0.25);
      }
      break;
    case 'sigh':
      if (ko) {
        add(0.07, 'ʌ', 1, 0.9, 0.5, 0.8, 0.2, 0.004, 0.02);
        exhale(0.25, 0.2);
      } else {
        exhale(0.9, 0.35);
        add(0.25, 'ə', 0.75, 0.6, 0.25, 0.5, 0.3, 0.05, 0.15);
      }
      break;
    case 'laugh':
      if (ko) {
        add(0.12, 'a', 1.35, 1.1, 1, 1, 0.15, 0.005, 0.02);
        exhale(0.25, 0.2);
      } else {
        for (let i = 0; i < 4; i++) {
          add(0.035, 'a', 1, 1, 0.35, 0, 1, 0.005, 0.01); // "ㅎ"
          add(0.09, 'a', 1.25 - 0.06 * i, 1.15 - 0.06 * i, 0.75 - 0.12 * i, 0.9, 0.2, 0.008, 0.03, 0.06);
        }
        add(0.4, 'ʌ', 0.85, 0.7, 0.5, 0.8, 0.3, 0.03, 0.2, 0.05);
        exhale(0.5, 0.2);
      }
      break;
    case 'exhale':
      if (ko) {
        add(0.09, 'ʌ', 0.95, 0.85, 0.55, 0.75, 0.3, 0.006, 0.03);
        exhale(0.3, 0.2);
      } else {
        inhale(0.25, 0.2);
        add(1.1, 'o', 0.95, 0.7, 0.4, 0.4, 0.6, 0.08, 0.6);
      }
      break;
    default:
      if (ko) {
        add(0.16, 'ʌ', 1.3, 0.9, 1, 0.95, 0.15, 0.006, 0.03);
        exhale(0.3, 0.22);
      } else {
        inhale(0.22, 0.35);
        add(0.45, 'ʌ', 1.05, 0.75, 0.6, 0.7, 0.3, 0.03, 0.2, 0.2);
        exhale(0.6, 0.28);
      }
  }
  return S;
}

// ─────────────────────────────────────────────────────────────
//  소리 조각 만들기 (각각 Float32Array 하나를 돌려준다)
// ─────────────────────────────────────────────────────────────
export const SYNTH = {
  /**
   * 칼끼리 부딪힘. hard = 세게(짧은 접촉 → 밝고 긴 울림), 아니면 약하게(둔탁한 "텅")
   */
  clash(sr, r, hard) {
    const dur = hard ? 0.4 : 0.32; // 울림을 확 줄였으니 조각 길이도 짧게 (메모리·CPU 절약)
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
      ...swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.35, 0.9), edge, damp: hard ? 0.6 : 0.35 }),
      ...swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.35, 0.9), edge, damp: hard ? 0.6 : 0.35 }),
      ...guardModes(r, hard ? 0.12 : 0.08), // 코등이 "깡"(700~980Hz)은 냄비 소리의 주범이라 아주 조금만
    ];
    resonate(x, out, sr, modes, Math.ceil(xEnd * sr) + 2);
    normalize(out, 1);
    potCut(out, sr, 560, 0.75);
    // 울림(음정)이 앞에 나서면 마림바처럼 "통" 한다 → 울림을 줄이고 칼날끼리 긁히며 부서지는 거친 알갱이를 덮는다
    for (let i = 0; i < n; i++) out[i] *= hard ? 0.7 : 0.55;
    gritBurst(out, sr, r, { t0: 0.001, span: hard ? 0.025 : 0.015, count: hard ? 16 : 10, amp: hard ? 0.4 : 0.35, fLo: 1500, fHi: 7000 });
    // 쇠가 찢어지는 "짝-치직": 맞은 순간 높은 딸깍이 연달아 (세게 칠수록 많이, 크게)
    crackBurst(out, sr, r, { t0: 0.001, count: hard ? 6 : 3, span: hard ? 0.014 : 0.008, amp: hard ? 1.1 : 0.55, f: hard ? 3000 : 2400 });
    saturate(out, hard ? 2.2 : 1.6);
    // "쿵": 두 손과 팔이 받는 충격. 찌그러뜨린 뒤에 깨끗한 저음으로 더한다 (찌그러뜨리면 300~600Hz 배음 = 냄비 소리가 생긴다)
    thumpTone(out, sr, { t0: 0.001, f0: between(r, hard ? 60 : 85, hard ? 85 : 120), drop: 0.65, dropTau: 0.012, tau: hard ? 0.03 : 0.024, amp: hard ? 0.55 : 0.35 });
    return fadeOut(normalize(out, 0.9), sr, hard ? 0.06 : 0.08);
  },

  /**
   * 투구: 두꺼운 강철 사발 + 안쪽 누비 + 머리 무게 → 짧고 둔탁한 "퍽-크덕" (종소리 성분을 빼고 그릿·저역 위주로)
   * heavy = 세게 맞음(찌그러짐이 큼): 저역을 더 밀고 그릿을 더 두껍게 깐다
   */
  helmet(sr, r, heavy = false) {
    const dur = 0.4;
    const n = Math.round(dur * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const tc = between(r, 0.0003, 0.0006);
    pulse(x, sr, 0.001, tc, 1);
    if (r() < 0.5) pulse(x, sr, 0.001 + between(r, 0.003, 0.012), tc * 1.5, between(r, -0.4, 0.4));
    const modes = [];
    // 사발 모양 껍데기: 모드가 촘촘하고 아주 짧게 죽는다. 300~900Hz(냄비 소리)는 약하게, 2~5kHz(쇠가 찢기는 소리)를 세게
    for (let i = 0; i < 30; i++) {
      const f = Math.exp(between(r, Math.log(600), Math.log(6000)));
      const a = (f < 1500 ? 0.35 : f < 5000 ? 1 : 0.6) * between(r, 0.25, 0.85) * (r() < 0.5 ? -1 : 1);
      modes.push({ f, a, t60: between(r, 0.008, 0.022) });
    }
    // 비조화 금속 "칭" 두세 개, 아주 짧게만 (긴 종소리 대신)
    for (let i = 0; i < 3; i++) modes.push({ f: between(r, 2200, 5000), a: between(r, 0.35, 0.6), t60: between(r, 0.015, 0.03) });
    // 칼도 아주 조금, 아주 짧게 울린다
    const blade = swordModes(r, { f1: between(r, 19, 25), at: between(r, 0.4, 0.9), edge: 0.8, damp: 0.3 });
    for (const m of blade) m.a *= 0.28;
    resonate(x, out, sr, [...modes, ...blade], Math.ceil(0.012 * sr));
    normalize(out, 1);
    potCut(out, sr, 560, 0.75);
    // 쇠판이 우그러지며 갈라지는 "까각": 연쇄 파열 + 거친 잔가루(그릿)
    crackBurst(out, sr, r, { t0: 0.001, count: heavy ? 6 : 4, span: heavy ? 0.02 : 0.012, amp: heavy ? 1 : 0.7, f: 2600 });
    gritBurst(out, sr, r, { t0: 0.002, span: heavy ? 0.045 : 0.025, count: heavy ? 16 : 9, amp: heavy ? 0.45 : 0.3, fLo: 1200, fHi: 5000 });
    saturate(out, heavy ? 2.6 : 2.2);
    // "퍽": 머리 무게가 받는 낮은 몸통 충격 (40~100Hz). 찌그러뜨린 뒤에 깨끗하게 더한다 (배음이 냄비 소리를 만들지 않게)
    thumpTone(out, sr, { t0: 0.001, f0: between(r, heavy ? 45 : 60, heavy ? 65 : 85), drop: 0.75, dropTau: 0.015, tau: heavy ? 0.021 : 0.015, amp: heavy ? 0.8 : 0.5 });
    return fadeOut(normalize(out, 0.9), sr, heavy ? 0.045 : 0.035);
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
    const modes = [...swordModes(r, { f1: 22, at: 0.5, edge: 0.9, damp: 0.22, fmax: 9800, even: true }), ...swordModes(r, { f1: 23.5, at: 0.7, edge: 0.9, damp: 0.22, even: true })];
    // 낮은 모드는 빼고(쥔 손이 죽인다), 종처럼 안 울리게 나머지도 짧게 눌러 거친 "지이익"에 가깝게 만든다
    for (const m of modes) {
      if (m.f < 600) m.a *= 0.3;
      m.t60 = Math.min(m.t60, 0.1);
      if (r() < 0.06 && m.f > 1500) m.t60 = between(r, 0.15, 0.3);
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
    const modes = [...swordModes(r, { f1: between(r, 20, 24), at: between(r, 0.4, 0.9), edge: 1, damp: 0.7, even: true }), ...guardModes(r, 0.15)];
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
   * + 질척한 낮은 잡음. heavy = 깊이 베인 큰 상처: 방울을 더 촘촘히, 물컹한 저역 "우두둑" 크런치를 더한다
   */
  wet(sr, r, heavy = false) {
    const dur = 0.36;
    const n = Math.round(dur * sr);
    const out = new Float32Array(n);
    const count = Math.round(between(r, heavy ? 55 : 30, heavy ? 90 : 55));
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
    // 크게 베였을 때: 물컹한 살·연골이 눌리며 나는 낮은 "우두둑" 크런치 (그릿을 낮은 대역으로)
    if (heavy) gritBurst(out, sr, r, { t0: 0.002, span: 0.09, count: 14, amp: 0.5, fLo: 150, fHi: 700 });
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
    const out = new Float32Array(n);
    // 살덩이는 울리지 않는다: 예전엔 170~560Hz 사인파 울림을 넣었더니 마림바 건반처럼 "통" 하고 음정이 났다 →
    // 음정 없는 잡음 뭉치(살이 눌리는 "퍽") + 누비옷 "철썩" + 아주 낮은 몸통 "쿵"(찌그러뜨린 뒤에 깨끗하게)만 쓴다
    noiseHit(out, sr, r, { amp: 0.8, attack: 0.0015, tau: between(r, 0.014, 0.02), type: 'lowpass', f: between(r, 350, 500), q: 0.6 });
    noiseHit(out, sr, r, { amp: 0.45, attack: 0.001, tau: 0.01, type: 'lowpass', f: 900, q: 0.6 });
    noiseHit(out, sr, r, { amp: 0.28, attack: 0.0005, tau: 0.004, type: 'bandpass', f: between(r, 1100, 1600), q: 0.9 }); // 누비옷 "철썩"
    gritBurst(out, sr, r, { t0: 0.001, span: 0.02, count: 6, amp: 0.12, fLo: 400, fHi: 1500 });
    saturate(out, 2.5, 0.15);
    thumpTone(out, sr, { f0: between(r, 55, 75), drop: 0.8, dropTau: 0.012, tau: between(r, 0.025, 0.035), amp: 0.7 });
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

  /** 나무(방패·둔기 자루): 두꺼운 각재를 친 "퍽-톡". 낮은~중간 대역 모드가 금방 죽고, 섬유 쪼개지는 잔가루가 섞인다 */
  wood(sr, r) {
    const n = Math.round(0.3 * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    pulse(x, sr, 0.001, between(r, 0.0006, 0.0012), 1);
    const modes = [];
    for (let i = 0; i < 10; i++) modes.push({ f: Math.exp(between(r, Math.log(180), Math.log(2500))), a: between(r, 0.4, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.012, 0.03) }); // 짧게: 길면 마림바(나무 건반)가 된다
    resonate(x, out, sr, modes, Math.ceil(0.01 * sr));
    normalize(out, 1);
    noiseHit(out, sr, r, { t0: 0.001, amp: 0.5, attack: 0.0004, tau: 0.006, type: 'bandpass', f: 900, q: 1 });
    gritBurst(out, sr, r, { t0: 0.001, span: 0.02, count: 6, amp: 0.35, fLo: 1200, fHi: 4500 });
    thumpTone(out, sr, { t0: 0.001, f0: between(r, 90, 130), drop: 0.6, dropTau: 0.02, tau: 0.045, amp: 0.5 });
    saturate(out, 2.2);
    return fadeOut(normalize(out, 0.9), sr, 0.06);
  },

  /** 플라즈마 날이 다른 것과 부딪힘: 지지직 튀는 전기 스파크 + 짧게 부풀었다 죽는 "웅" 훔 (SF 무기용) */
  plasmaZap(sr, r) {
    const n = Math.round(0.3 * sr);
    const out = new Float32Array(n);
    let t = 0;
    while (t < n) {
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / 900) * sr));
      if (t < n) noiseHit(out, sr, r, { t0: t / sr, amp: between(r, 0.2, 0.7), attack: 0.0001, tau: between(r, 0.0008, 0.003), type: 'highpass', f: between(r, 2500, 7000), q: between(r, 0.6, 1.3) });
    }
    const f0 = between(r, 85, 130);
    const dur = 0.09;
    for (let i = 0; i < n; i++) {
      const tt = i / sr;
      if (tt > dur) break;
      let s = 0;
      for (let h = 1; h <= 5; h++) s += (Math.sin(TAU * f0 * h * tt) / h) * (1 + 0.02 * Math.sin(TAU * 7 * tt));
      out[i] += 0.22 * s * Math.min(1, tt / 0.006) * Math.exp(-tt / 0.05);
    }
    saturate(out, 2.0);
    return fadeOut(normalize(out, 0.85), sr, 0.05);
  },

  /** 플라즈마가 살을 지지는 "치이익": 기름 튀듯 잔 크랙이 촘촘하고, 위로 김 새듯 잡음이 스민다 */
  plasmaSizzle(sr, r) {
    const dur = 0.4;
    const n = Math.round(dur * sr);
    const out = new Float32Array(n);
    let t = 0;
    while (t < n) {
      t += Math.max(1, Math.round((-Math.log(r() + 1e-9) / 2600) * sr));
      if (t < n) noiseHit(out, sr, r, { t0: t / sr, amp: between(r, 0.15, 0.5), attack: 0.0001, tau: between(r, 0.0006, 0.002), type: 'bandpass', f: between(r, 2000, 6500), q: between(r, 1, 2.2) });
    }
    const hp = new Filt('highpass', 3200, 0.7, sr);
    const wb = wobble(r, sr, 18);
    for (let i = 0; i < n; i++) {
      const tt = i / sr;
      out[i] += 0.3 * hp.run(r() * 2 - 1) * Math.min(1, tt / 0.01) * Math.exp(-tt / 0.3) * (0.4 + 0.6 * Math.abs(wb()));
    }
    return fadeOut(normalize(out, 0.85), sr, 0.08);
  },

  /** 고무 닭(코미디 무기): 삑삑이 "끽" + 짧은 경적 "빵" — 진지한 재질들 사이에서 일부러 튀는 소리 */
  rubberHonk(sr, r) {
    const n = Math.round(0.35 * sr);
    const out = new Float32Array(n);
    const f0 = between(r, 900, 1500);
    let ph = 0;
    const len1 = Math.round(0.09 * sr);
    for (let i = 0; i < len1; i++) {
      const t = i / sr;
      const f = f0 * (1 - (0.3 * t) / 0.09) * (1 + 0.05 * Math.sin(TAU * 40 * t));
      ph += (TAU * f) / sr;
      out[i] += 0.35 * Math.sign(Math.sin(ph)) * Math.exp(-t / 0.05) * Math.min(1, i / (0.002 * sr));
    }
    const f1 = between(r, 210, 260);
    const start = Math.round(0.05 * sr);
    const len2 = Math.round(0.22 * sr);
    for (let i = 0; i < len2 && start + i < n; i++) {
      const t = i / sr;
      const v = Math.sign(Math.sin(TAU * f1 * t)) * 0.5 + Math.sign(Math.sin(TAU * f1 * 1.5 * t)) * 0.3;
      out[start + i] += 0.4 * v * Math.min(1, i / (0.004 * sr)) * Math.exp(-t / 0.11);
    }
    saturate(out, 1.4, 0);
    return fadeOut(normalize(out, 0.85), sr, 0.05);
  },

  /**
   * 모래 위 발소리: 뒤꿈치의 낮은 "툭" + 모래가 눌리는 "사각" + 알갱이 부서지는 잔소리 + 앞꿈치 "사박".
   * heavy = 비틀거리며 크게 디딘 발 (더 낮고 길게, 모래를 더 많이 흩뜨린다)
   */
  footstep(sr, r, heavy = false) {
    // "저-벅": 뒤꿈치가 먼저 닿고(저) 50~90ms 뒤 발바닥·앞꿈치가 눌린다(벅). 둘 다 낮고 굵은 자갈 크런치
    const n = Math.round(0.3 * sr);
    const out = new Float32Array(n);
    const t2 = between(r, 0.05, 0.09);
    for (const [t0, k] of [[0.002, 1], [t2, 0.75]]) {
      noiseHit(out, sr, r, { t0, amp: 0.5 * k, attack: 0.005, tau: heavy ? 0.035 : 0.025, type: 'lowpass', f: between(r, 280, 420), q: 0.8 });
      gritBurst(out, sr, r, { t0: t0 + 0.003, span: heavy ? 0.06 : 0.045, count: heavy ? 18 : 12, amp: 0.26 * k, fLo: 220, fHi: 1000 });
    }
    gritBurst(out, sr, r, { t0: 0.006, span: 0.1, count: 4, amp: 0.06, fLo: 2000, fHi: 5000 }); // 튀는 잔모래 아주 조금 (밝기)
    saturate(out, 1.6);
    // 몸무게가 실리는 낮은 "쿵" 두 번 (찌그러뜨린 뒤에 더해 깨끗하게)
    thumpTone(out, sr, { t0: 0.002, f0: between(r, 42, 58), drop: 0.4, dropTau: 0.01, attack: 0.004, tau: heavy ? 0.03 : 0.024, amp: heavy ? 1.3 : 1.05 });
    thumpTone(out, sr, { t0: t2, f0: between(r, 45, 60), drop: 0.3, dropTau: 0.01, attack: 0.006, tau: 0.022, amp: heavy ? 0.9 : 0.7 });
    return fadeOut(normalize(out, 0.9), sr, 0.05);
  },

  /**
   * 사람이 모래 위로 쓰러짐: 몸통 무게의 낮은 "쿵"이 부위마다 몇십 ms 차이로 겹치고(골반 → 어깨 → 팔),
   * 모래가 튀어 흩어지는 "촤르르", 누비옷이 부딪히는 "퍽". heavy = 통나무처럼 그대로 넘어짐
   */
  bodyFall(sr, r, heavy = true) {
    const n = Math.round(0.6 * sr);
    const out = new Float32Array(n);
    const parts = heavy ? 3 : 2;
    for (let k = 0; k < parts; k++) {
      const t0 = 0.002 + (k ? between(r, 0.025, 0.08) * k : 0);
      thumpTone(out, sr, { t0, f0: between(r, 45, 70), drop: 0.6, dropTau: 0.015, attack: 0.004, tau: between(r, 0.035, 0.05), amp: k ? between(r, 0.35, 0.6) : 1 });
      noiseHit(out, sr, r, { t0, amp: k ? 0.35 : 0.6, attack: 0.004, tau: 0.03, type: 'lowpass', f: between(r, 350, 600), q: 0.7 });
    }
    const n0 = Math.round(0.006 * sr);
    const bp = new Filt('bandpass', 3500, 0.6, sr);
    const wb = wobble(r, sr, 40);
    for (let i = 0; i < Math.round(0.25 * sr) && n0 + i < n; i++) {
      const t = i / sr;
      out[n0 + i] += 0.18 * bp.run(r() * 2 - 1) * Math.min(1, t / 0.01) * Math.exp(-t / 0.07) * (0.3 + 0.7 * Math.abs(wb()));
    }
    gritBurst(out, sr, r, { t0: 0.004, span: 0.15, count: heavy ? 30 : 18, amp: 0.18, fLo: 1500, fHi: 6000 });
    noiseHit(out, sr, r, { t0: 0.004, amp: 0.3, attack: 0.001, tau: 0.008, type: 'bandpass', f: 1300, q: 1 });
    saturate(out, 2.4, 0.15);
    return fadeOut(normalize(out, 0.9), sr, 0.1);
  },

  /**
   * 무기가 부러짐. wood(나뭇가지): 섬유가 연달아 끊기는 "우지끈" + 둔한 "딱".
   * frozen(언 참치): 얼음이 쩍 갈라지는 날카롭고 짧은 금속성 "쩍" + 잔금 + 물컹한 살덩이의 둔한 "퍽"
   */
  weaponBreak(sr, r, material = 'wood') {
    const frozen = material === 'frozen';
    const n = Math.round(0.5 * sr);
    const x = new Float32Array(n);
    const out = new Float32Array(n);
    const cracks = [0.001];
    const k = Math.round(between(r, 3, 6));
    for (let i = 0; i < k; i++) cracks.push(0.001 + (between(r, 0.004, frozen ? 0.03 : 0.07) * (i + 1)) / k);
    for (const [i, t] of cracks.entries()) pulse(x, sr, t, frozen ? 0.0001 : 0.0002, (i === 0 ? 1 : between(r, 0.25, 0.7)) * (r() < 0.5 ? -1 : 1));
    const modes = [];
    for (let i = 0; i < 9; i++) {
      const f = Math.exp(between(r, Math.log(frozen ? 1800 : 300), Math.log(frozen ? 7000 : 2500)));
      modes.push({ f, a: between(r, 0.4, 1) * (r() < 0.5 ? -1 : 1), t60: between(r, 0.02, frozen ? 0.06 : 0.07) });
    }
    resonate(x, out, sr, modes, Math.ceil(0.09 * sr));
    normalize(out, 1);
    for (const t of cracks) noiseHit(out, sr, r, { t0: t, amp: between(r, 0.3, 0.6), tau: 0.0015, f: frozen ? 3000 : 1500 });
    gritBurst(out, sr, r, { t0: 0.002, span: 0.12, count: 40, amp: 0.3, fLo: frozen ? 2500 : 900, fHi: frozen ? 9000 : 5000 });
    thumpTone(out, sr, { t0: 0.001, f0: frozen ? between(r, 75, 95) : between(r, 100, 130), drop: 0.5, tau: 0.03, amp: 0.5 });
    saturate(out, 2.5);
    return fadeOut(normalize(out, 0.9), sr, 0.06);
  },

  /**
   * 목소리 (성대 + 입안 공명을 흉내 낸 합성). 녹음이 없을 때 쓰는 죽음 소리.
   *  - 성대: 로젠버그 성문 파형(열렸다 닫히는 공기 흐름)의 변화량. 주기마다 음높이·세기가 조금씩 흔들린다(지터·시머)
   *  - 거친 목(rough): 주기마다 세기를 번갈아 바꿔 "끄륵" 하는 목 긁힘(보컬 프라이)을 만든다
   *  - 숨(breath): 성대가 열릴 때 새는 바람 소리 + 순수한 날숨
   *  - 입안: 모음마다 다른 공명대(포먼트) 4개. 성도 길이(tract)가 짧을수록(여성·젊음) 공명대가 높다
   * @param prof VOICES 항목, kind: 'ko'(머리를 맞아 뚝 끊김) | 'bleed'(피가 빠져 숨이 잦아듦)
   */
  voice(sr, r, prof, kind = 'ko') {
    const segs = voiceScript(r, prof, kind);
    const total = segs.reduce((m, s) => Math.max(m, s.t + s.dur), 0) + 0.15;
    const n = Math.round(total * sr);
    const out = new Float32Array(n);
    const F = [0, 1, 2, 3].map(() => new Filt('bandpass', 500, 5, sr));
    const FG = [1, 0.55, 0.28, 0.14];
    const rough = prof.rough;
    for (const s of segs) {
      const V = VOWELS[s.vowel] || VOWELS['ə'];
      F.forEach((fl, i) => fl.set(V[i] * prof.tract, (V[i] * prof.tract) / (V[4 + i] * (s.voice > 0.3 ? 1 : 1.8))));
      const n0 = Math.round(s.t * sr);
      const len = Math.round(s.dur * sr);
      let ph = 0;
      let per = 0;
      let pAmp = 1;
      let pF = s.f0a;
      let g1 = 0;
      for (let i = 0; i < len && n0 + i < n; i++) {
        const u = i / len;
        const f0 = (s.f0a + (s.f0b - s.f0a) * u) * (per % 2 && rough > 0.2 ? 1 + 0.04 * rough : 1);
        ph += pF / sr;
        if (ph >= 1) {
          ph -= 1;
          per++;
          pF = f0 * (1 + 0.012 * gauss(r));
          pAmp = (1 + 0.08 * gauss(r)) * (per % 2 ? 1 - 0.55 * rough : 1);
        }
        const g = ph < 0.4 ? 0.5 * (1 - Math.cos((Math.PI * ph) / 0.4)) : ph < 0.62 ? Math.cos((Math.PI / 2) * ((ph - 0.4) / 0.22)) : 0;
        const exc = (g - g1) * 18 * pAmp * s.voice + (r() * 2 - 1) * (prof.breath * 0.35 * (0.3 + g) * s.voice + s.air * 0.5);
        g1 = g;
        const env = Math.min(1, i / (s.attack * sr)) * Math.min(1, (len - i) / (s.release * sr));
        let y = 0;
        for (let k = 0; k < 4; k++) y += FG[k] * F[k].run(exc);
        out[n0 + i] += s.amp * env * y;
      }
    }
    saturate(out, 1.3, 0.05);
    return fadeOut(normalize(out, 0.9), sr, 0.08);
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
  ['wet', 3, (sr, r) => SYNTH.wet(sr, r, false)],
  ['shing', 3, SYNTH.shing],
  ['scrape', 1, SYNTH.scrape],
  ['helmet', 3, (sr, r) => SYNTH.helmet(sr, r, false)],
  ['bone', 3, SYNTH.bone],
  ['helmetHeavy', 2, (sr, r) => SYNTH.helmet(sr, r, true)],
  ['wetHeavy', 2, (sr, r) => SYNTH.wet(sr, r, true)],
  ['wood', 2, SYNTH.wood],
  ['plasmaZap', 2, SYNTH.plasmaZap],
  ['plasmaSizzle', 2, SYNTH.plasmaSizzle],
  ['rubberHonk', 2, SYNTH.rubberHonk],
  ['step', 6, (sr, r) => SYNTH.footstep(sr, r, false)],
  ['stepHeavy', 3, (sr, r) => SYNTH.footstep(sr, r, true)],
  ['fall', 3, (sr, r) => SYNTH.bodyFall(sr, r, true)],
  ['fallLight', 2, (sr, r) => SYNTH.bodyFall(sr, r, false)],
  ['breakWood', 2, (sr, r) => SYNTH.weaponBreak(sr, r, 'wood')],
  ['breakFrozen', 2, (sr, r) => SYNTH.weaponBreak(sr, r, 'frozen')],
];
// 목소리 조각은 이름이 "voice:캐릭터id:ko|bleed" 이고, 이번 판에 나오는 캐릭터 것만 만든다 (prepareVoices)
const VOICE_COUNT = 2;
function bankEntry(name) {
  if (name.startsWith('voice:')) {
    const [, id, kind] = name.split(':');
    return [name, VOICE_COUNT, (sr, r) => SYNTH.voice(sr, r, VOICES[id] || VOICES.generic, kind)];
  }
  return BANK.find((b) => b[0] === name);
}
/** 소리 조각 하나 만들기 (일꾼 스레드 soundgen.js 에서도 부른다) */
export function makeBankSound(name, sr, seed) {
  return bankEntry(name)[2](sr, makeRng(seed));
}

// 녹음된 소리 (Kenney.nl, CC0). 없거나 못 읽어도 합성 소리만으로 동작한다
const nums = (base, k) => Array.from({ length: k }, (_, i) => `${base}${i + 1}`);
const SAMPLES = {
  punch: ['punch1', 'punch2', 'punch3', 'punch4', 'punch5'], // 몸통을 세게 치는 "퍽" (Kenney impactPunch_heavy)
  punchMed: nums('hit/punch_med', 5), // 가볍게 치는 "퍽" (Kenney impactPunch_medium)
  soft: nums('hit/soft', 5), // 누비옷 너머로 몸통 덩어리가 받는 둔한 "쿵" (Kenney impactSoft_heavy)
  woodHit: nums('hit/wood', 5), // 나무 몽둥이 (Kenney impactWood_medium)
  woodHeavy: nums('hit/wood_heavy', 3), // (Kenney impactWood_heavy)
  step: nums('step/sand', 8), // 모래 위 무거운 발걸음: 둔한 뒤꿈치 "쿵"(Kenney footstep_carpet) + 눌리는 크런치(footstep_snow), 음을 낮추고 고음을 깎음
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
      // 아이폰: 무음 스위치를 켜 두면 웹 소리(Web Audio)가 통째로 꺼진다. 음악 앱처럼 "재생" 용도로 알리면
      // 무음 모드에서도 소리가 난다 (Safari 17 / iOS 17부터 되는 Audio Session API)
      if (!ctx) {
        try {
          if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback';
        } catch {
          /* 지원하지 않는 브라우저 */
        }
      }
      this.ctx = ctx || new AC();
      this.build();
      if (!this.ctx.startRendering) this.prepareSoon(); // (분석용 OfflineAudioContext 는 prepareAll 로 한꺼번에)
      this.samplesReady = this.useSamples ? this.loadSamples() : Promise.resolve();
    }
    // 폰이 전화·잠금 등으로 소리를 멈췄으면 다시 켠다 (아이폰은 'interrupted'). 분석용 OfflineAudioContext 는 빼고
    const st = this.ctx.state;
    if ((st === 'suspended' || st === 'interrupted') && !this.ctx.startRendering) this.ctx.resume().catch(() => {});
    // 아이폰: 손가락을 댄 그 순간에 아주 짧은 무음을 한 번 재생해 두어야 소리 장치가 확실히 켜진다
    if (!this.primed && !this.ctx.startRendering) {
      this.primed = true;
      try {
        const b = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = b;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch {
        this.primed = false;
      }
    }
  }

  /** 경기장 울림 세기 바꾸기 (0 = 끔) */
  setReverb(amount) {
    for (const s of this.sends || []) s.g.gain.setTargetAtTime(s.amt * amount, this.ctx.currentTime, 0.02);
  }

  /**
   * 온몸 베기 고리 (docs/whole_body_strike.md 4-7, 14장): 게임 시간이 느려질 때(멈칫·결정타 슬로) 그 배율 k(1 = 보통).
   *  지금은 빈 함수다. 소리 담당이 슬로 동안 새 소리를 낮고 느리게 내는 것을 여기에 붙인다 (멈칫 때문에 소리를 늦추지는 않는다)
   */
  setTimeScale(k) {}

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
    // 먹먹함 필터: 평소엔 활짝 열려 있다가 내가 쓰러지면 닫혀서 소리가 물속처럼 멀어진다 (setMuffle)
    this.muffle = c.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.muffle.Q.value = 0.5;
    this.master.connect(this.muffle).connect(lim).connect(pre).connect(clip).connect(c.destination);
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
    this.runJobs(jobs);
  }
  /**
   * 이번 판에 나오는 캐릭터들의 죽음 목소리를 미리 만든다 (판을 시작할 때 main.js 가 부른다).
   * 다른 캐릭터 목소리는 버려서 메모리를 아낀다 (한 벌에 약 0.3MB)
   */
  prepareVoices(ids) {
    if (!this.ctx) return;
    const keep = new Set();
    for (const id of ids) for (const kind of ['ko', 'bleed']) keep.add(`voice:${id}:${kind}`);
    for (const name of Object.keys(this.bank)) if (name.startsWith('voice:') && !keep.has(name)) delete this.bank[name];
    const jobs = [];
    for (const name of keep) for (let i = this.bank[name]?.length || 0; i < VOICE_COUNT; i++) jobs.push({ name, seed: this.seedFor(name, i) });
    if (jobs.length) this.runJobs(jobs);
    this.voicesReady = this.useSamples ? this.loadVoiceSamples(ids) : Promise.resolve();
  }
  runJobs(jobs) {
    if (this.ctx.startRendering) return this.prepareOnMain(jobs); // 분석용 OfflineAudioContext
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
    let h = 0;
    if (name.startsWith('voice:')) for (let k = 0; k < name.length; k++) h = (Math.imul(h, 31) + name.charCodeAt(k)) | 0;
    return this.seed + name.charCodeAt(0) * 7919 + name.length * 131 + i * 104729 + h;
  }
  need(name) {
    return (this.bank[name]?.length || 0) < bankEntry(name)[1];
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
    if (!list || !list.length) return null;
    // 바로 앞에 쓴 것은 피한다 (발소리처럼 자주 나는 소리가 똑같이 두 번 연달아 나면 기계처럼 들린다)
    this._lastPick = this._lastPick || {};
    let i = (Math.random() * list.length) | 0;
    if (list.length > 1 && i === this._lastPick[name]) i = (i + 1 + ((Math.random() * (list.length - 1)) | 0)) % list.length;
    this._lastPick[name] = i;
    return list[i];
  }

  /** 녹음된 소리 읽기 (첫 화면 터치 뒤에, 뒤에서 천천히) */
  async loadSamples() {
    // 한꺼번에 받는다 (하나씩 받으면 발소리처럼 판 시작부터 필요한 소리가 몇 초 늦는다). 순서는 목록 순서로 맞춘다
    const jobs = [];
    for (const [name, files] of Object.entries(SAMPLES)) files.forEach((f, i) => jobs.push(this.decodeSample(f).then((buf) => buf && (((this.samples[name] = this.samples[name] || [])[i] = buf)))));
    await Promise.all(jobs);
    for (const name of Object.keys(SAMPLES)) if (this.samples[name]) this.samples[name] = this.samples[name].filter(Boolean);
  }
  async decodeSample(f) {
    const c = this.ctx;
    try {
      const res = await fetch(new URL(`sfx/${f}.mp3`, document.baseURI));
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      const buf = await new Promise((ok, bad) => c.decodeAudioData(ab, ok, bad)?.then?.(ok, bad));
      return trimStart(c, buf);
    } catch {
      return null; // 못 읽으면 합성 소리만 쓴다
    }
  }
  async loadSample(name, f) {
    const c = this.ctx;
    try {
      const res = await fetch(new URL(`sfx/${f}.mp3`, document.baseURI));
      if (!res.ok) return;
      const ab = await res.arrayBuffer();
      // 옛 사파리는 콜백 방식만 된다. 요즘 브라우저는 promise 도 함께 돌려주는데, 못 읽으면 그 promise 도
      // 실패해서 "처리 안 된 오류"가 콘솔에 뜬다 → promise 쪽 결과도 같은 곳(ok/bad)으로 받는다 (두 번 불려도 한 번만 처리됨)
      const buf = await new Promise((ok, bad) => c.decodeAudioData(ab, ok, bad)?.then?.(ok, bad));
      (this.samples[name] = this.samples[name] || []).push(trimStart(c, buf));
    } catch {
      /* 못 읽으면 합성 소리만 쓴다 */
    }
  }
  /** 이번 판 캐릭터들의 녹음된 죽음 목소리 읽기 (public/sfx/voice/<id>_<ko|bleed><번호>.mp3). 다른 캐릭터 것은 버린다 */
  async loadVoiceSamples(ids) {
    for (const name of Object.keys(this.samples)) if (name.startsWith('voice:') && !ids.includes(name.split(':')[1])) delete this.samples[name];
    for (const id of ids) {
      const rec = VOICES[id]?.rec;
      if (!rec) continue;
      for (const kind of ['ko', 'bleed']) {
        const name = `voice:${id}:${kind}`;
        if (this.samples[name]) continue;
        this.samples[name] = [];
        for (let n = 1; n <= (rec[kind] || 0); n++) await this.loadSample(name, `voice/${id}_${kind}${n}`);
      }
    }
  }

  // ── 소리 하나(이벤트) 틀기 ──
  // 소리 조각 여러 겹 → 각자 음량 → (밝기 필터) → 이벤트 음량 → 묶음(bus)
  // 동시에 너무 많이 울리면 가장 오래된 소리를 빨리 줄여서 끈다 (폰 부담)
  event({ bus, gain = 1, bright = 0, prio = 1, pos = null }) {
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
    // 자리(pos.x, 왼쪽/오른쪽)를 주면 살짝 팬 (무기 시스템에서 부딪힌 위치를 알려줄 때)
    if (pos && typeof pos.x === 'number' && c.createStereoPanner) {
      const pan = c.createStereoPanner();
      pan.pan.value = Math.max(-1, Math.min(1, pos.x / 4));
      out.connect(pan).connect(bus);
      nodes++;
    } else {
      out.connect(bus);
    }
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
    const bright = 5000 + 11000 * x ** 1.3; // (하한이 낮으면 약한 타격의 날카로운 성분이 잘려 가운데 울림만 "통" 하고 남는다)
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

  /** 투구를 친 소리: 짧고 뭉툭한 "퍽-크덕" (머리가 받는 "쿵"은 조각 안에 들어 있고, 몸통 소리는 main.js 가 blunt 로 따로 낸다) */
  helmet(energy) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 110);
    const ev = this.event({ bus: this.metalBus, gain: 0.3 + 0.7 * e ** 0.8, bright: 1800 + 6000 * e, prio: 2 });
    // 세기에 따라 층을 고른다: 약하게 = 가벼운 "깡", 세게(찌그러짐) = 저역이 실린 "퍽-크덕"
    const heavyP = clamp01((e - 0.35) / 0.4);
    const buf = Math.random() < heavyP ? this.pick('helmetHeavy') : this.pick('helmet');
    this.layer(ev, buf, { rate: between(Math.random, 0.92, 1.04) * (1 - 0.06 * e) });
  }

  /** 몸통 "퍽" 한 겹 (녹음된 소리가 있으면 둘 다 섞는다) */
  body(ev, gain, rate = 1) {
    // 녹음된 주먹 "퍽"(세면 heavy) + 누비옷 너머 몸통 덩어리의 "쿵". 합성 "퍽"은 녹음이 있으면 살짝만 (없으면 이것만)
    const rec = this.pickSample(gain >= 0.8 ? 'punch' : 'punchMed') || this.pickSample('punch');
    const soft = this.pickSample('soft');
    this.layer(ev, this.pick('thump'), { gain: rec ? gain * 0.35 : gain, rate: rate * between(Math.random, 0.9, 1.1) });
    if (rec) this.layer(ev, rec, { gain: gain * 0.8, rate: rate * between(Math.random, 0.92, 1.06) });
    if (soft) this.layer(ev, soft, { gain: gain * 0.5, rate: rate * between(Math.random, 0.9, 1.05) });
  }

  /** 베기: 천이 찢기고 살을 가르는 "쉭-지직" + 젖은 소리 + 몸통 "퍽". through = 베고 지나감 */
  cut(energy, through) {
    if (!this._on || !this.ctx) return;
    const e = clamp01(energy / 140);
    const ev = this.event({ bus: this.fleshBus, gain: 0.35 + 0.65 * e ** 0.8, prio: 2 });
    // 베고 지나가면 가르는 소리가 길고(느리게 틀기), 몸통 충격은 작다 (칼이 멈추지 않았으니까)
    this.layer(ev, this.pick('slice'), { gain: 0.5 + 0.3 * e, rate: through ? between(Math.random, 0.72, 0.82) : between(Math.random, 0.9, 1.1) });
    // 깊이 베인 큰 상처(e 높음)는 물컹한 크런치가 섞인 "젖은" 소리로
    this.layer(ev, this.pick(e > 0.55 ? 'wetHeavy' : 'wet'), { gain: 0.35 + 0.5 * e, rate: between(Math.random, 0.85, 1.15), delay: 0.012 });
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
    // 칼끝이 스치는 약한 접촉(10J 안팎)은 싸움 중 1초에 한 번꼴로 난다 → 아주 약하게 (15J 넘어야 제대로 "퍽")
    if (energy < 5) return;
    const e = clamp01(energy / 120);
    const ev = this.event({ bus: this.fleshBus, gain: 0.1 + 0.9 * e ** 0.8, prio: 1.5 });
    this.body(ev, 1);
    // 세게 맞으면(칼 면으로 후려침) 칼도 둔하게 울린다
    if (e > 0.2) this.layer(ev, this.pick('clashSoft'), { gain: 0.25 * e, rate: between(Math.random, 0.8, 0.9), delay: 0.003 });
  }

  /**
   * 재질 쌍 충돌음 (여러 무기를 다루는 무기 시스템 공용 API).
   * @param a,b     'steel' | 'armor'(투구·판금) | 'flesh' | 'wood' | 'plasma'(SF 광검) | 'rubber'(코미디 무기). 순서 상관없음
   * @param energy  충돌 세기 (대략 기존 helmet/cut 등과 같은 J 스케일)
   * @param pos     {x} 를 주면 부딪힌 자리로 살짝 좌우 팬 (없어도 된다)
   */
  impact({ a = 'steel', b = 'steel', energy = 40, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const e = Math.max(0, energy);
    const has = (m) => a === m || b === m;
    if (has('rubber')) return this._impactRubber(e, pos);
    if (has('plasma')) return has('flesh') ? this._impactPlasmaFlesh(e, pos) : this._impactPlasmaSteel(e, pos);
    if (has('flesh')) return this._impactFleshDull(e, pos);
    if (has('armor')) return this._impactArmor(e, a === 'armor' && b === 'armor', pos);
    if (has('wood')) return this._impactWood(e, pos);
    if (has('frozen')) return this._impactFrozen(e, pos);
    return this._impactSteel(e, pos);
  }
  /** steel+steel (또는 알 수 없는 재질): 기존 칼끼리 부딪힘과 같은 소리, 에너지를 세기로 바꿔서 쓴다 */
  _impactSteel(energy, pos) {
    const e = clamp01(energy / 90);
    const ev = this.event({ bus: this.metalBus, gain: 0.2 + 0.8 * e ** 0.7, bright: e > 0.75 ? 0 : 2400 + 11000 * e, prio: 1 + e, pos });
    const buf = Math.random() < clamp01((e - 0.15) / 0.4) ? this.pick('clashHard') : this.pick('clashSoft');
    this.layer(ev, buf, { rate: between(Math.random, 0.93, 1.05) * (1 - 0.05 * e), dur: 0.35 + 1.1 * e });
  }
  /** steel/wood+armor 또는 armor+armor: 투구·판금이 우그러지는 "퍽-크덕" */
  _impactArmor(energy, plateOnPlate, pos) {
    const e = clamp01(energy / 110);
    const ev = this.event({ bus: this.metalBus, gain: 0.3 + 0.7 * e ** 0.8, bright: 1800 + 6000 * e, prio: 2, pos });
    const buf = Math.random() < clamp01((e - 0.35) / 0.4) ? this.pick('helmetHeavy') : this.pick('helmet');
    this.layer(ev, buf, { gain: plateOnPlate ? 0.9 : 1, rate: between(Math.random, 0.92, 1.04) * (1 - 0.06 * e) });
  }
  /** *+wood: 방패·목재 둔기의 "퍽-톡" */
  _impactWood(energy, pos) {
    const e = clamp01(energy / 80);
    const ev = this.event({ bus: this.fleshBus, gain: 0.3 + 0.7 * e ** 0.8, prio: 1.5, pos });
    const rec = this.pickSample(e > 0.6 ? 'woodHeavy' : 'woodHit');
    this.layer(ev, this.pick('wood'), { gain: rec ? 0.35 : 1, rate: between(Math.random, 0.9, 1.08) * (1 - 0.05 * e) });
    if (rec) this.layer(ev, rec, { gain: 0.9, rate: between(Math.random, 0.92, 1.06) });
  }
  /** *+flesh (강철·투구·나무 대 살): 자르지 않는 뭉툭한 접촉이므로 몸통 "퍽"만 */
  _impactFleshDull(energy, pos) {
    const e = clamp01(energy / 100);
    const ev = this.event({ bus: this.fleshBus, gain: 0.15 + 0.85 * e ** 0.8, prio: 1.5, pos });
    this.body(ev, 1);
  }
  /** *+plasma (살 제외): 전기 아크가 튀는 "파직" + 짧은 "웅" 훔 */
  _impactPlasmaSteel(energy, pos) {
    const e = clamp01(energy / 70);
    const ev = this.event({ bus: this.metalBus, gain: 0.3 + 0.7 * e ** 0.7, prio: 1.5 + e, pos });
    this.layer(ev, this.pick('plasmaZap'), { gain: 0.8 + 0.4 * e, rate: between(Math.random, 0.95, 1.08) });
  }
  /** 플라즈마 대 살: 지지는 "치이익" */
  _impactPlasmaFlesh(energy, pos) {
    const e = clamp01(energy / 100);
    const ev = this.event({ bus: this.fleshBus, gain: 0.35 + 0.65 * e ** 0.7, prio: 2, pos });
    this.layer(ev, this.pick('plasmaSizzle'), { gain: 0.8 + 0.3 * e, rate: between(Math.random, 0.9, 1.1) });
    this.body(ev, 0.25 + 0.2 * e); // 살짝 둔한 충격도 섞는다 (에너지 덩어리가 닿긴 닿았으니)
  }
  /** 고무 닭(코미디 무기): 무엇에 맞든 삑삑이+경적이 먼저 튄다 */
  _impactRubber(energy, pos) {
    const e = clamp01(energy / 60);
    const ev = this.event({ bus: this.fleshBus, gain: 0.4 + 0.6 * e ** 0.6, prio: 1.5, pos });
    this.layer(ev, this.pick('rubberHonk'), { rate: between(Math.random, 0.95, 1.15) });
  }

  /** *+frozen (언 참치): 속까지 언 살덩이의 둔하고 딱딱한 "텅" — 나무보다 낮고 무겁게 */
  _impactFrozen(energy, pos) {
    const e = clamp01(energy / 90);
    const ev = this.event({ bus: this.fleshBus, gain: 0.3 + 0.7 * e ** 0.8, prio: 1.5, pos });
    const rec = this.pickSample('woodHeavy');
    this.layer(ev, rec || this.pick('wood'), { rate: between(Math.random, 0.7, 0.8) });
    this.layer(ev, this.pickSample('soft') || this.pick('thump'), { gain: 0.5, rate: between(Math.random, 0.85, 1) });
  }

  // ─────────────────────────────────────────────────────────────
  //  몸 소리: 발소리, 쓰러짐, 무기 부러짐, 죽음 (BodySounds 가 몸 상태를 보고 부른다)
  // ─────────────────────────────────────────────────────────────

  /** 모래 위 발소리. speed = 발이 내려오던 속도 (m/s, AI 대결에서 중간값 1, 상위 10% 1.6 — 크게 내딛거나 비틀거림) */
  footstep(speed, pos) {
    if (!this._on || !this.ctx) return;
    const x = clamp01((speed - 0.3) / 1.8);
    // 녹음된 발소리(8가지, 같은 것이 연달아 안 나오게). 예전 장화 소리는 딱딱한 바닥의 "또각"과 방 울림이 있어 회랑처럼 들렸다.
    // 크게 디디면 합성 "쿵"을 조금 깔아 무게를 더한다
    const rec = this.pickSample('step');
    const ev = this.event({ bus: this.fleshBus, gain: rec ? 0.22 + 0.45 * x : 0.1 + 0.4 * x, bright: rec ? 0 : 1800 + 3500 * x, prio: 0.3, pos });
    if (rec) {
      this.layer(ev, rec, { rate: between(Math.random, 0.9, 1.02) });
      if (x > 0.65) this.layer(ev, this.pick('stepHeavy'), { gain: 0.35 * x, rate: between(Math.random, 0.9, 1.05) });
    } else this.layer(ev, this.pick(x > 0.65 ? 'stepHeavy' : 'step'), { rate: between(Math.random, 0.9, 1.1) });
  }

  /**
   * 무기 뽑기 룰렛의 "딸깍" (화면 소리, 위치 없음). 아주 짧은 사각파 한 번 → 폰 부담 거의 없음.
   * final = 멈춘 순간: 조금 낮고 길게, grand = 전설급이 뽑혔을 때 한 옥타브 위 울림을 더한다
   */
  tick(final = false, grand = false) {
    if (!this._on || !this.ctx || !this.master) return;
    const c = this.ctx;
    const t = c.currentTime;
    const blip = (freq, dur, vol, type = 'square') => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    };
    if (!final) blip(1800 + Math.random() * 300, 0.025, 0.05);
    else {
      blip(660, 0.16, 0.08, 'triangle');
      if (grand) blip(1320, 0.5, 0.05, 'sine');
    }
  }

  /** 몸이 땅에 부딪힘. speed = 몸통이 떨어지던 속도 (m/s). light = 무릎이 꺾여 주저앉음 */
  bodyFall(speed, { light = false, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const x = clamp01((speed - 0.5) / 3);
    const ev = this.event({ bus: this.fleshBus, gain: (light ? 0.25 : 0.35) + 0.65 * x, prio: 2, pos });
    this.layer(ev, this.pick(light || x < 0.3 ? 'fallLight' : 'fall'), { rate: between(Math.random, 0.88, 1.02) * (1 - 0.08 * x) });
    // 녹음된 "퍽"을 느리게 깔아 무게를 더한다 (이어폰에서 저역이 산다)
    const rec = this.pickSample('punch');
    if (rec) this.layer(ev, rec, { gain: 0.35 + 0.3 * x, rate: between(Math.random, 0.6, 0.7), delay: 0.004 });
    const soft = this.pickSample('soft'); // 몸통 덩어리가 모래에 부딪히는 둔한 "쿵"
    if (soft) this.layer(ev, soft, { gain: 0.5 + 0.4 * x, rate: between(Math.random, 0.8, 0.95), delay: 0.002 });
  }

  /** 무기가 부러짐 (material: 무기 재질. 나무·언 참치 말고는 부러지지 않는다) */
  weaponBreak(material = 'wood', pos) {
    if (!this._on || !this.ctx) return;
    const ev = this.event({ bus: this.metalBus, gain: 1, prio: 3, pos });
    this.layer(ev, this.pick(material === 'frozen' ? 'breakFrozen' : 'breakWood'), { rate: between(Math.random, 0.92, 1.06) });
    const rec = this.pickSample('crack');
    if (rec && material !== 'frozen') this.layer(ev, rec, { gain: 0.55, rate: between(Math.random, 0.85, 1), delay: 0.002 });
  }

  /**
   * 죽음. voice = VOICES 의 id (캐릭터 id, 플레이어는 'player'), cause = fighter.causeOfDeath
   *  '기절'·'머리' → 짧게 뚝 끊기는 소리, '출혈'·'목' → 숨이 잦아드는 긴 소리 ('목'은 피 끓는 소리가 섞인다)
   *  me = 플레이어 자신이 죽음: 목소리 대신 귀가 멍해지고(삐—) 온 소리가 먹먹해진다
   */
  death(voice, cause, { me = false, pos } = {}) {
    if (!this._on || !this.ctx) return;
    const kind = cause === '출혈' || cause === '목' ? 'bleed' : 'ko';
    const id = voice in VOICES ? voice : 'generic';
    const ev = this.event({ bus: this.fleshBus, gain: me ? 0.7 : 0.9, prio: 3, pos });
    // 녹음이 있으면 녹음(캐릭터에 맞게 재생 속도로 목소리 높이를 조금 바꾼다), 없으면 합성 목소리
    const rec = this.pickSample(`voice:${id}:${kind}`);
    const R = VOICES[id].rec;
    if (rec) this.layer(ev, rec, { gain: R.gain ?? 1, rate: (R.rate ?? 1) * between(Math.random, 0.97, 1.03) });
    else this.layer(ev, this.pick(`voice:${id}:${kind}`), { rate: between(Math.random, 0.97, 1.03) });
    if (cause === '목') this.layer(ev, this.pick('wetHeavy'), { gain: 0.5, rate: between(Math.random, 0.55, 0.65), delay: 0.08 });
    if (me) this.fadeOutWorld();
  }

  /** 내가 쓰러짐: 이명(삐—)이 울리고, 온 소리가 몇 초에 걸쳐 먹먹해진다 */
  fadeOutWorld() {
    const c = this.ctx;
    const t = c.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setValueAtTime(this.muffle.frequency.value, t);
    this.muffle.frequency.exponentialRampToValueAtTime(420, t + 1.8);
    const o = c.createOscillator();
    o.frequency.value = between(Math.random, 3600, 4200);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 3.5);
    o.connect(g).connect(this.ctx.destination); // (먹먹함 필터를 거치지 않게 바로 스피커로)
    o.start(t);
    o.stop(t + 3.6);
  }

  /**
   * 바닷가 절벽의 고요: 아주 멀리서 밀려오는 파도 + 옅은 바람. 음악이 아니라 "정적"이라 발소리보다 훨씬 작게(약 -45dB) 깔린다.
   * 처음 한 번만 만들고 계속 돈다 (시작 버튼을 누를 때 main.js 가 부른다). 전체 음량(master)을 거치므로
   * 소리 끄기·음량 설정·쓰러졌을 때의 먹먹함을 그대로 따른다. 노드 몇 개뿐이라 폰 부담은 거의 없다
   */
  ambience() {
    if (this._amb || !this.ctx || this.ctx.startRendering || !this.master) return;
    const c = this.ctx;
    // 4초짜리 흰 잡음 (22050Hz 로 만들어 메모리를 아낀다. 흰 잡음이라 되풀이 이음매에서 딸깍이지 않는다)
    const sr = 22050;
    const buf = c.createBuffer(1, sr * 4, sr);
    const d = buf.getChannelData(0);
    const rnd = makeRng(this.seed ^ 0x5eed);
    for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1;
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, c.currentTime + 0.5, 2.5); // 천천히 스며든다
    out.connect(this.master);
    const lfo = (hz) => {
      const o = c.createOscillator();
      o.frequency.value = hz;
      return o;
    };
    const amt = (src, v, param) => {
      const g = c.createGain();
      g.gain.value = v;
      src.connect(g).connect(param);
    };
    // 파도: 낮게 거른 잡음을 주기가 서로 안 맞는 느린 물결 둘(12초, 7.6초)로 부풀렸다 가라앉힌다
    const surf = c.createBufferSource();
    surf.buffer = buf;
    surf.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.Q.value = 0.3;
    const sg = c.createGain();
    sg.gain.value = 0.03;
    const w1 = lfo(0.083);
    const w2 = lfo(0.131);
    amt(w1, 0.016, sg.gain);
    amt(w2, 0.009, sg.gain);
    amt(w1, 160, lp.frequency); // 파도가 부서질 때 조금 밝아진다
    surf.connect(lp).connect(sg).connect(out);
    // 바람: 좁게 거른 잡음, 가운데 높이와 세기가 아주 천천히 오르내린다
    const wind = c.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    wind.playbackRate.value = 0.87; // 파도와 같은 잡음이 겹쳐 들리지 않게
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 650;
    bp.Q.value = 1.2;
    const wg = c.createGain();
    wg.gain.value = 0.012;
    const w3 = lfo(0.047);
    amt(w3, 220, bp.frequency);
    amt(w3, 0.008, wg.gain);
    wind.connect(bp).connect(wg).connect(out);
    const t = c.currentTime;
    for (const n of [surf, wind, w1, w2, w3]) n.start(t);
    this._amb = out;
  }

  /** 새 판: 먹먹함을 푼다 */
  resetRound() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.muffle.frequency.cancelScheduledValues(t);
    this.muffle.frequency.setTargetAtTime(20000, t, 0.1);
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
   * @param material 'steel'(기본, 바람 소리만) | 'plasma'(광검: 항상 켜진 낮은 "웅" 훔이 함께 돈다)
   */
  whooshLoop(material = 'steel') {
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
    const hum = material === 'plasma' ? this._plasmaHum() : null;
    const self = this;
    return {
      set(speed) {
        const x = Math.min(1, Math.max(0, (speed - 4) / 16)); // 칼끝 4 → 20 m/s
        // (0,0) (0.66, ≈0.25) (1, 0.6) × 전체 음량. 타격음이 무거워진 만큼 바람 소리도 조금 키웠다 (+4dB)
        const vol = self._on ? 0.6 * Math.pow(x, 2.2) * 0.8 : 0;
        const t = c.currentTime;
        g.gain.setTargetAtTime(vol, t, 0.03);
        f.frequency.setTargetAtTime(250 + 1150 * x, t, 0.03);
        hum?.set(x);
      },
      /** 무기가 바뀌어 이 고리를 버릴 때 */
      stop() {
        try {
          src.stop();
        } catch {
          /* 이미 멈춤 */
        }
        g.disconnect();
        hum?.stop();
      },
    };
  }
  /** 플라즈마 날의 상시 "웅" 훔: 가만히 있어도 낮게 울리고, 휘두르면 커지며 이따금 "파직" 끼어든다 */
  _plasmaHum() {
    const c = this.ctx;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.value = 58;
    o2.frequency.value = 58 * 1.503; // 완전5도 위, 순정과 살짝 어긋나게(SF스러운 맥놀이)
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 0.6;
    const g = c.createGain();
    g.gain.value = 0;
    o1.connect(lp);
    o2.connect(lp);
    lp.connect(g).connect(this.master);
    o1.start();
    o2.start();
    const self = this;
    let crackleAt = 0;
    return {
      stop() {
        o1.stop();
        o2.stop();
        g.disconnect();
      },
      set(x) {
        const t = c.currentTime;
        const base = 0.05; // 가만히 있어도 들리는 대기 훔
        g.gain.setTargetAtTime(self._on ? base + 0.22 * x : 0, t, 0.05);
        lp.frequency.setTargetAtTime(700 + 2200 * x, t, 0.05);
        // 빨리 휘두를수록 "파직" 스파크가 더 자주 낀다
        if (self._on && t > crackleAt) {
          crackleAt = t + between(Math.random, 0.15, 0.6) / (0.15 + x);
          const ev = self.event({ bus: self.master, gain: 0.12 + 0.25 * x, prio: 0.5 });
          self.layer(ev, self.pick('plasmaZap'), { gain: 0.35, rate: between(Math.random, 1.1, 1.4) });
        }
      },
    };
  }
}

/**
 * 파이터 한 명의 몸 소리 감지기: 매 화면(프레임)마다 몸 상태를 읽고 알맞은 소리를 부른다.
 * fighter.js 를 고치지 않고 밖에서 보기만 한다 (state, causeOfDeath, weaponBroken, 몸 조각의 높이·속도).
 *  - 발소리: 발이 들렸다가(9cm 위) 다시 땅(6cm 아래)에 닿는 순간. 세기 = 내려오던 속도
 *  - 쓰러짐: 서 있지 않을 때 골반·가슴이 떨어지다(초속 1m 넘게) 땅 근처에서 멈춘 순간 → 슬로모션에도 박자가 맞는다
 *  - 무릎 꺾임(서 있다 → 일어나는 중), 무기 부러짐, 죽음은 상태가 바뀌는 순간
 */
export class BodySounds {
  constructor(sound, fighter, voice, me = false) {
    this.s = sound;
    this.f = fighter;
    this.voice = voice;
    this.me = me;
    this.state = fighter.state;
    this.broken = !!fighter.weaponBroken;
    this.feet = { footF: { up: false, vy: 0, t: 0 }, footB: { up: false, vy: 0, t: 0 } };
    this.fallV = { pelvis: 0, chest: 0 };
    this.lastFall = -1;
    this.t = 0;
  }

  update(dt) {
    const f = this.f;
    const s = this.s;
    this.t += dt;
    if (f.state !== this.state) {
      if (f.state === 'dead') s.death(this.voice, f.causeOfDeath, { me: this.me });
      else if (f.state === 'getup' && this.state === 'stand') s.bodyFall(1.2, { light: true }); // 무릎이 꺾여 주저앉음
      this.state = f.state;
    }
    if (f.weaponBroken && !this.broken) s.weaponBreak(f.weapon?.material);
    this.broken = !!f.weaponBroken;

    if (f.state === 'stand' || f.state === 'getup') {
      for (const k of ['footF', 'footB']) {
        const b = f.bodies[k];
        const ft = this.feet[k];
        const y = b.translation().y;
        const vy = b.linvel().y;
        if (y > 0.09) {
          ft.up = true;
          ft.vy = Math.min(ft.vy, vy);
        } else if (ft.up && y < 0.06) {
          ft.up = false;
          if (this.t - ft.t > 0.12) s.footstep(Math.max(-ft.vy, -vy));
          ft.t = this.t;
          ft.vy = 0;
        }
      }
    }
    if (f.state !== 'stand') {
      for (const k of ['pelvis', 'chest']) {
        const b = f.bodies[k];
        const y = b.translation().y;
        const vy = b.linvel().y;
        const v0 = this.fallV[k];
        if (v0 < -1 && vy > v0 * 0.35 && y < 0.45) {
          // 떨어지던 몸이 땅에서 멈췄다. 골반·가슴이 잇달아 닿으면 한 번만 크게
          if (this.t - this.lastFall > 0.25) s.bodyFall(-v0);
          this.lastFall = this.t;
          this.fallV[k] = 0;
        } else this.fallV[k] = vy < 0 ? Math.min(v0, vy) : 0;
      }
    }
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
