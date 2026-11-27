// r33 Q2 능력 지도 표 — lunge_cap.sh 가 낸 cap_<자세>_<가속 배율>_<가려는 속도>.json 을 모아 무기 · 단계마다 가운데값(씨앗) 표 (읽기만)
//  node lunge_cap_sum.mjs <나온 것 폴더>
import { readdirSync, readFileSync } from 'node:fs'; import { join } from 'node:path';
const dir = process.argv[2]; const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[(b.length - 1) >> 1] : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-'); const mx = (a) => Math.max(...a.filter(Number.isFinite));
console.log('자세 | 가속 배율 | 가려는 속도 | 무기 | 무게중심 최고 | 골반 최고 | 뒷다리 밀기 최고 ÷mg | Δv 한도뒤/압중뒤/실제 | 뒷다리 바람÷한도 최고(엉덩/무릎/발목/벌림) | 넘는 스텝 | 받기 앞다리 최고(엉덩/무릎/발목) 넘음 | 앞발 미끄러짐 m | 걸음 실제 m | 넘어짐');
for (const fn of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const m = fn.match(/cap_w([\d.]+)_a(\d)_v([\d.]+)\.json/); if (!m) continue; const runs = JSON.parse(readFileSync(join(dir, fn), 'utf8')).map((r) => r.sum);
  for (const W of ['rapier', 'longsword']) { const R = runs.filter((s) => s.W === W); if (!R.length) continue;
    console.log(`${m[1] === '0' ? '나란함' : '펜싱'} | ×${m[2]} | ${m[3] === '0' ? '오늘(≤1.1)' : m[3]} | ${W} | ${f(med(R.map((s) => s.cvPk)))} | ${f(med(R.map((s) => s.pelPk)))} | ${f(med(R.map((s) => s.pushPk)))} | ${f(med(R.map((s) => s.dv.cap)))}/${f(med(R.map((s) => s.dv.cop)))}/${f(med(R.map((s) => s.dv.act)))} | ${['hip', 'knee', 'ank', 'abd'].map((j) => f(mx(R.map((s) => s.rearPeak[j])))).join('/')} | ${R.reduce((a, s) => a + s.satSteps, 0)}/${R.reduce((a, s) => a + s.nWin, 0)} | ${['hip', 'knee', 'ank'].map((j) => f(mx(R.map((s) => s.rcv?.peak[j] ?? NaN)))).join('/')} ${R.reduce((a, s) => a + (s.rcv?.sat ?? 0), 0)} | ${f(mx(R.map((s) => s.rcv?.slip ?? NaN)))} | ${f(med(R.map((s) => s.stepAct)))} | ${R.filter((s) => s.fell).length}/${R.length}`); }
}
