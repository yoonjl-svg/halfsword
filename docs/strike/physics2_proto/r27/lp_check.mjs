// 거름 도구 따로 검산: 상수 · 한 스텝(8.3 ms) 튐 · 2 Hz 사인 · 20 Hz 사인(한 번 −3 dB → 앞뒤 두 번이면 0.5)
//  node lp_check.mjs <lowpass.mjs 길>
const { filtfilt } = await import(process.argv[2]);
const fs = 120, N = 1200, mx = (a, i0, i1) => { let m = -Infinity; for (let i = i0; i < i1; i++) m = Math.max(m, a[i]); return m; }, mn = (a, i0, i1) => { let m = Infinity; for (let i = i0; i < i1; i++) m = Math.min(m, a[i]); return m; };
const c = filtfilt(Array(N).fill(1), fs, 20); console.log('상수 1 →', mn(c, 0, N).toFixed(4), '~', mx(c, 0, N).toFixed(4));
const sp = Array(N).fill(0); sp[600] = 1; const s = filtfilt(sp, fs, 20); console.log('한 스텝 튐 → 꼭대기', mx(s, 0, N).toFixed(3));
for (const f of [2, 20]) { const x = Array.from({ length: N }, (_, i) => Math.sin(2 * Math.PI * f * i / fs)); const y = filtfilt(x, fs, 20); console.log(f + ' Hz 사인 진폭 →', mx(y, 300, 900).toFixed(3)); }
