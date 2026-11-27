// r22 leg sources — every derived number in docs/strike/physics2_notes/r22_leg_sources.md comes from here.
// Inputs are values copied from the cited papers (see the note). No simulation is run.
// Run: node docs/strike/physics2_proto/r22/leg_sources_calc.mjs
const g = 9.81;
const M = 75; // reference body mass for N·m columns
const f1 = (x) => x.toFixed(1);
const f2 = (x) => x.toFixed(2);
const out = [];
const say = (s) => out.push(s);

// ---------- 1. in-task peak moments (N·m/kg) -> N·m for 75 kg ----------
const tasks = [
  ['run 4.1 m/s ankle PF (sprinters)', 4.17], ['run 4.1 m/s knee ext', 3.35], ['run 4.1 m/s hip ext', 1.85],
  ['sprint 9.3 m/s ankle PF', 4.69], ['sprint knee ext', 3.59], ['sprint hip ext', 3.44], ['sprint hip flex', 3.36],
  ['run 3.5 m/s ankle PF (10 Hz filter)', 2.23], ['run 3.5 m/s knee ext (10 Hz)', 3.18], ['run 4.5 m/s ankle PF (10 Hz)', 2.34], ['run 4.5 m/s knee ext (10 Hz)', 3.41],
  ['run 4.0 m/s knee ext 1st peak (sim)', 2.402], ['run 5.0 m/s knee ext 1st peak (sim)', 2.430],
  ['fencing lunge lead hip (phase II)', 3.63], ['fencing lunge lead knee', 1.71], ['fencing lunge lead ankle', 1.28],
  ['fencing step rear hip (phase I)', 2.27], ['fencing step rear knee', 1.9], ['fencing step rear ankle', 1.01],
  ['cut 45 deg knee ext', 3.53], ['cut 45 deg hip ext', 3.70], ['cut 45 deg knee abd', 1.01], ['cut 45 deg hip abd', 2.07],
  ['cut handball knee abd 10-10 Hz', 1.27], ['cut handball knee abd 10-50 Hz', 1.64], ['cut handball hip flex 10-10 Hz', 3.64], ['cut handball hip flex 10-50 Hz', 5.92],
  ['drop 44 cm stiff knee flex mom', 2.23], ['drop 44 cm stiff ankle', 1.16],
];
say('## 1. N·m/kg x 75 kg');
for (const [k, v] of tasks) say(`${k}: ${v} N·m/kg -> ${f1(v * M)} N·m`);
say(`sprinter group own mass 73.3 kg: ankle run ${f1(4.17 * 73.3)} · sprint ${f1(4.69 * 73.3)} · knee run ${f1(3.35 * 73.3)} · sprint ${f1(3.59 * 73.3)} N·m`);

// ---------- 2. in-task / dynamometer ----------
// isometric references from physics2_human_data_2026-11-24.md A1-A3 (young men)
const iso = { kneeExt: [203, 265], hipExt: [201, 201], plantar: [119, 158.1] }; // plantar upper = isokinetic Biodex men (da Fonseca 2025)
say('\n## 2. in-task (75 kg) / dynamometer');
const cmp = [['run 4.1 ankle', 4.17, 'plantar'], ['sprint ankle', 4.69, 'plantar'], ['run 3.5 ankle (10 Hz)', 2.23, 'plantar'],
  ['run 4.1 knee', 3.35, 'kneeExt'], ['sprint knee', 3.59, 'kneeExt'], ['cut knee', 3.53, 'kneeExt'],
  ['sprint hip ext', 3.44, 'hipExt'], ['cut hip ext', 3.70, 'hipExt'], ['lunge lead hip', 3.63, 'hipExt']];
for (const [k, v, j] of cmp) say(`${k}: ${f1(v * M)} N·m = ${f2(v * M / iso[j][1])} – ${f2(v * M / iso[j][0])} x isometric (${iso[j][1]}–${iso[j][0]} N·m)`);
say(`leg press ankle / isolated plantarflexion (same 18 men): ${f2(234.7 / 185.7)}`);
say(`leg press knee 289.5 N·m vs knee-ext isometric refs: ${f2(289.5 / 265)} – ${f2(289.5 / 203)}`);

// ---------- 3. eccentric / isometric / concentric ----------
say('\n## 3. contraction-type ratios');
say(`GLMM log-link (18 men, 60 deg/s): ecc/con ${f2(Math.exp(0.147))} · iso/con ${f2(Math.exp(0.258))} · iso/ecc ${f2(Math.exp(0.258 - 0.147))}`);
const morin = [['knee ext', 3.92, 2.68], ['knee flex', 2.29, 1.73], ['hip ext', 3.36, 2.55], ['hip flex', 2.97, 2.28]];
for (const [k, e, c] of morin) say(`120 deg/s ${k}: ecc/con ${f2(e / c)}`);
// knee extension speed series (Frey-Law 2012, already in hand): share of isometric
const fl = [[0, 212], [60, 158], [120, 135], [180, 116], [240, 101], [300, 89]];
say('knee ext concentric share of isometric (27 men): ' + fl.map(([w, t]) => `${w} deg/s ${Math.round(100 * t / 212)} %`).join(' · '));
say(`Harbo <30 y knee ext 90 deg/s / isometric: ${Math.round(100 * 215 / 265)} %`);
// Anderson 2007 C4/C5 in deg/s
const rad = 180 / Math.PI;
for (const [k, c4, c5] of [['hip ext', 1.58, 3.19], ['knee ext', 1.52, 3.95], ['plantar', 0.99, 3.56]]) say(`Anderson ${k}: 75 % at ${Math.round(c4 * rad)} deg/s · 50 % at ${Math.round(c5 * rad)} deg/s`);

// ---------- 4. ground force ----------
say('\n## 4. ground force');
const hopN = 2642, hopKg = 77.8, tc = 0.273, fHz = 2.21;
const hopBW = hopN / (hopKg * g);
say(`two-leg hop men 2.21 Hz: ${f2(hopBW)} BW total · ${f2(hopBW / 2)} BW per leg (contact ${tc * 1000} ms)`);
say(`fastest hop men 4.13 Hz: ${f2(2033 / (hopKg * g))} BW total (contact 187 ms)`);
const meanContact = (1 / fHz) / tc; // impulse balance: mean force over contact = BW * period / contact
say(`impulse check 2.21 Hz: mean force over contact ${f2(meanContact)} BW · half-sine peak ${f2(meanContact * Math.PI / 2)} BW`);
for (const kg of [60, 70, 80]) {
  const thr = 200 / (kg * g);
  const rb = (0.9 * 1.89 - thr) / 463.1, rs = (0.9 * 1.74 - thr) / 69.7;
  say(`impact rise 200 N -> 90 % peak, ${kg} kg: barefoot heel ${f1(rb * 1000)} ms · shod heel ${f1(rs * 1000)} ms`);
}
say(`effective mass 75 kg: heel 6.8 % -> ${f1(0.068 * M)} kg · forefoot 1.7 % -> ${f1(0.017 * M)} kg`);
for (const h of [30, 60]) say(`two-leg drop ${h} cm, per foot (Niu 2014): low-rate ${f2(0.44 * Math.sqrt(h) + 0.45)} · mid ${f2(0.49 * Math.sqrt(h) + 0.37)} · >1200 Hz ${f2(0.75 * Math.sqrt(h) + 0.17)} BW`);
say(`two-leg drop 22/44 cm (8 Hz filtered GRF): soft ${f2(12.71 / g)}/${f2(17.24 / g)} · natural ${f2(18.18 / g)}/${f2(23.05 / g)} · stiff ${f2(22.36 / g)}/${f2(26.60 / g)} BW`);
say(`fencing step-lunge lead leg ${f2(9.52 / g)} (step) · ${f2(17.90 / g)} (lunge) BW · rear leg ${f2(13.36 / g)} BW`);
say(`handball cut resultant GRF at peak knee abd: ${f2(30.88 / g)} – ${f2(32.74 / g)} BW`);
say(`added-mass hop study: leg stiffness 20 kN/m on 65 kg -> ${f1(20000 / (65 * g))} BW per m`);

// filter response: lone rectangular pulse of 8.33 ms (one 120 Hz step) sampled at 1000 Hz,
// 2nd-order Butterworth run forward and backward (= the usual "4th-order zero-lag" in these papers).
function lp2(x, fc, fs) {
  const K = Math.tan(Math.PI * fc / fs), q = Math.SQRT2;
  const n = 1 / (1 + q * K + K * K);
  const b0 = K * K * n, b1 = 2 * b0, b2 = b0, a1 = 2 * (K * K - 1) * n, a2 = (1 - q * K + K * K) * n;
  const y = new Array(x.length).fill(0);
  let x1 = x[0], x2 = x[0], y1 = x[0], y2 = x[0];
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
const filtfilt = (x, fc, fs) => lp2(lp2(x, fc, fs).reverse(), fc, fs).reverse();
const fs = 1000, N = 2000;
const pulse8 = Array.from({ length: N }, (_, i) => (i >= 1000 && i < 1008) ? 1 : 0);
say('lone 8 ms pulse of height 1, zero-lag Butterworth: retained peak fraction');
for (const fc of [8, 10, 15, 18, 20, 25, 50, 100]) {
  const y = filtfilt(pulse8, fc, fs);
  say(`  fc ${fc} Hz: ${f2(Math.max(...y))}`);
}
// 25 ms moving average of the same pulse
say(`  25 ms moving average: ${f2(8 / 25)}`);
// smooth hop half-sine (peak 3.46 BW, 273 ms) through the same filters: change of peak
const hop = Array.from({ length: N }, (_, i) => (i >= 800 && i < 800 + 273) ? hopBW * Math.sin(Math.PI * (i - 800) / 273) : 0);
say('half-sine hop (3.46 BW, 273 ms) peak after filter:');
for (const fc of [8, 10, 20, 50]) say(`  fc ${fc} Hz: ${f2(Math.max(...filtfilt(hop, fc, fs)))} BW`);

// ---------- 5. stiffness / angles ----------
say('\n## 5. stiffness');
say(`running k_leg (Patoz 2022, 115 runners) 9/11/13 km/h = ${f2(9 / 3.6)}/${f2(11 / 3.6)}/${f2(13 / 3.6)} m/s`);

// ---------- 6. single-leg capacity at depth ----------
say('\n## 6. one-leg leg press (18 men, seated) in body weights');
const lp = [[30, 3369], [40, 3239], [50, 2748], [60, 2236], [70, 1750], [80, 1385], [90, 1157], [100, 1015]];
for (const kg of [75, 80]) say(`  ${kg} kg: ` + lp.map(([a, F]) => `${a} deg ${f2(F / (kg * g))}`).join(' · '));

console.log(out.join('\n'));
