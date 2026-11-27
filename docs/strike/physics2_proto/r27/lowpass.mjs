// ─────────────────────────────────────────────────────────────
//  lowpass.mjs — 힘판 논문처럼 거르는 셈 (재는 도구 전용 · 게임 코드 아님 · 몸에 아무것도 걸지 않음)
//
//   filtfilt(x, fs, fc) → 영위상(앞으로 한 번 · 뒤로 한 번) 2 차 버터워스 저역 = 논문들이 '4 차 영위상 버터워스'라 부르는 것.
//     · 차단 주파수 fc 는 한 번 돌릴 때의 값 그대로(두 번 돌려 생기는 −6 dB 자리 고침은 하지 않음 — r22 의 셈과 같음).
//     · 쌍선형 변환 + 미리 휨(prewarp). 두 끝은 홀수 거울로 늘려 붙이고(길이 3 × fs/fc 스텝), 거름 상태는 첫 값의 정상 상태에서 시작한다 → 상수는 그대로 지나감.
//   peakFiltered(x, fs, fc, i0, i1) → 거른 줄의 [i0, i1] 안 가장 큰 값.
//   검사: node tools/sim/lowpass.mjs  (상수 · 8 ms 홀로 봉우리 · 2 Hz 사인 — r27_hop_force.md)
// ─────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';

/** 2 차 버터워스 저역 계수 (b0 b1 b2 a1 a2 · a0 = 1) */
export function butter2(fs, fc) {
  const K = Math.tan((Math.PI * fc) / fs), q = Math.SQRT2, n = 1 / (1 + q * K + K * K);
  const b0 = K * K * n;
  return { b0, b1: 2 * b0, b2: b0, a1: 2 * (K * K - 1) * n, a2: (1 - q * K + K * K) * n };
}

/** 한 방향 (직접형 II 전치 · 첫 값 정상 상태에서 시작) — 제자리에 쓴다 */
function pass(y, c) {
  const x0 = y[0];
  let z2 = (c.b2 - c.a2) * x0, z1 = (c.b1 - c.a1) * x0 + z2;
  for (let i = 0; i < y.length; i++) {
    const x = y[i], o = c.b0 * x + z1;
    z1 = c.b1 * x - c.a1 * o + z2; z2 = c.b2 * x - c.a2 * o; y[i] = o;
  }
}

/** 영위상 저역: 앞 · 뒤 한 번씩 (두 끝은 홀수 거울로 늘림) */
export function filtfilt(x, fs, fc) {
  const n = x.length;
  if (n < 3) return Float64Array.from(x);
  const c = butter2(fs, fc), p = Math.min(n - 1, Math.ceil((3 * fs) / fc));
  const y = new Float64Array(n + 2 * p);
  for (let i = 0; i < p; i++) y[i] = 2 * x[0] - x[p - i];
  for (let i = 0; i < n; i++) y[p + i] = x[i];
  for (let i = 0; i < p; i++) y[p + n + i] = 2 * x[n - 1] - x[n - 2 - i];
  pass(y, c); y.reverse(); pass(y, c); y.reverse();
  return y.subarray(p, p + n);
}

export function peakFiltered(x, fs, fc, i0 = 0, i1 = x.length - 1) {
  const y = filtfilt(x, fs, fc); let m = -Infinity;
  for (let i = i0; i <= i1; i++) if (y[i] > m) m = y[i];
  return m;
}

// ── 검사 (직접 부를 때만) ──
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const fs = 120, N = 1200, rows = [];
  let bad = 0;
  const ok = (name, v, lo, hi) => { const g = v >= lo && v <= hi; if (!g) bad++; rows.push(`| ${name} | ${v.toFixed(4)} | ${lo} ~ ${hi} | ${g ? '맞음' : '어긋남'} |`); };
  for (const fc of [20, 25]) {
    // 1. 상수 1.0 이 그대로
    const c = new Float64Array(N).fill(1); const yc = filtfilt(c, fs, fc);
    ok(`${fc} Hz · 상수 1 — 가장 큰 벗어남`, Math.max(...yc.map((v) => Math.abs(v - 1))), 0, 1e-9);
    // 2. 바탕 1 위 한 스텝(8.3 ms) 봉우리 높이 1 → 남는 몫 (가운데에 · 거른 최고 − 1)
    const s = new Float64Array(N).fill(1); s[600] = 2;
    ok(`${fc} Hz · 8 ms 홀로 봉우리 남는 몫`, peakFiltered(s, fs, fc) - 1, fc === 20 ? 0.25 : 0.3, fc === 20 ? 0.42 : 0.5);
    // 3. 2 Hz 사인 (진폭 1 · 바탕 1) — 가운데 절반의 진폭 몫
    const w = Float64Array.from({ length: N }, (_, i) => 1 + Math.sin((2 * Math.PI * 2 * i) / fs)), yw = filtfilt(w, fs, fc);
    let mx = 0; for (let i = N / 4; i < (3 * N) / 4; i++) mx = Math.max(mx, Math.abs(yw[i] - 1));
    ok(`${fc} Hz · 2 Hz 사인 진폭 몫`, mx, 0.99, 1.01);
    // 4. 2 Hz 사인 끝까지 (거울 늘림이 두 끝에서 어긋나지 않나)
    let me = 0; for (let i = 0; i < N; i++) me = Math.max(me, Math.abs(yw[i] - w[i]));
    ok(`${fc} Hz · 2 Hz 사인 끝 포함 가장 큰 차이`, me, 0, 0.01);
  }
  console.log(`표본 ${fs} Hz (게임 한 스텝) · 2 차 버터워스 앞뒤 = 4 차 영위상\n| 검사 | 값 | 금 | 판정 |\n|---|---|---|---|\n${rows.join('\n')}\n검사 ${bad ? '어긋남 ' + bad : '모두 맞음'}`);
  process.exitCode = bad ? 1 : 0;
}
