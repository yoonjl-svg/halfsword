// s1_agg.mjs — s1_motor_probe.mjs 결과 묶기 (읽기만). node s1_agg.mjs <결과.json> ...  → 파일마다 판 평균 한 줄
import { readFileSync } from 'node:fs';
const mean = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const f = (x, d = 2) => (x == null ? '-' : x.toFixed(d));
for (const p of process.argv.slice(2)) {
  const R = JSON.parse(readFileSync(p, 'utf8')), ok = R.filter((r) => r.n > 0);
  const m = (g) => mean(ok.map(g));
  console.log(`${p.split('/').pop().replace('.json', '')} · 판 ${R.length} · 넘어짐 ${R.filter((r) => r.fell).length} · 받은÷시킨 ${f(m((r) => r.recvOverCmd))} (앞 1/3 ${f(m((r) => r.recvOverCmdFront))}) · 모터 땅힘÷시킨 ${f(m((r) => r.motorFyOverCmd))} · km 최고 ${f(m((r) => r.kmPeakMean))} · 시킨 최고 ${f(m((r) => r.cmdPeakMeanBW))}/${f(Math.max(...ok.map((r) => r.cmdPeakMaxBW)))} · 무릎99 ${f(m((r) => r.knee99))} 발목99 ${f(m((r) => r.ankle99))} · 모터÷명시 엉 ${f(m((r) => r.j?.hip?.motorOverExpl))} 무 ${f(m((r) => r.j?.knee?.motorOverExpl))} 발 ${f(m((r) => r.j?.ankle?.motorOverExpl))} · 무릎 감쇠 ${f(m((r) => r.j?.knee?.damp), 1)} 스프링 ${f(m((r) => r.j?.knee?.spring), 1)} · 무릎 tv−앞 ${f(m((r) => r.j?.knee?.tvMinusPre))} tv−뒤 ${f(m((r) => r.j?.knee?.tvMinusPost))} · 묶음 디딘 ${f(m((r) => r.grp?.stanceLeg))} 뜬 ${f(m((r) => r.grp?.swingLeg))} 골반 ${f(m((r) => r.grp?.pelvis))} 윗몸 ${f(m((r) => r.grp?.upper))} · 압력중심 ${f(m((r) => r.copA), 3)}`);
}
