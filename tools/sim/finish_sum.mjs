// 마무리 찌르기 줄(--rows)을 다섯째 판 E3 목표 칸으로 줄인다 (재는 칸만 읽음).
//  사용법: node tools/sim/finish_sum.mjs <이름=finish_thrust --rows 출력> [...]
//  판금이 아닌 줄만 센다(--armour=plate 출력이면 판금 줄만).
import fs from 'node:fs';
const avg = (L) => (L.length ? L.reduce((s, x) => s + x, 0) / L.length : NaN);
const med = (L) => { const s = [...L].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '-' : x.toFixed(d));
for (const a of process.argv.slice(2)) {
  const [name, p] = a.split('=');
  const all = fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.startsWith('{"guard"')).map((l) => JSON.parse(l));
  const R = all.some((r) => !r.plate) ? all.filter((r) => !r.plate) : all;
  const go = R.filter((r) => r.go && r.X?.iGo != null);
  const F = go.filter((r) => r.fin);
  const out = R.filter((r) => r.d0 > 1.7).length;
  console.log(`== ${name}: n ${R.length}${R[0]?.plate ? ' (판금)' : ''} · 상처 ${R.filter((r) => r.wound).length} (${Math.round((100 * R.filter((r) => r.wound).length) / R.length)}%) · 닿음 ${R.filter((r) => r.first).length} · 지나침(dMin<0.35) ${R.filter((r) => (r.X?.dMin ?? 9) < 0.35).length} · 찍는 쪽 넘어짐 ${R.filter((r) => r.X?.fellP).length} · go ${go.length} · go 때 골반 앞 빠르기 가운데 ${f(med(go.map((r) => r.X.vGo)))} m/s · 탭 때 1.7 m 밖 ${out}`);
  console.log(`   go 때: 칼자루 옆 ${f(avg(go.map((r) => r.arm.z)))} · 선 각 ${f(avg(go.map((r) => r.arm.lineAng)), 0)}° · 몸통 거리 ${f(avg(go.map((r) => r.X.dGo)))} · 골반 높이 ${f(avg(go.map((r) => r.X.pelY)))} · 앞 숙임 ${f(avg(go.map((r) => r.X.leanFwd)), 1)}° · 보는 쪽 ${f(avg(go.map((r) => r.X.face)), 1)}° · 탭→go ${f(avg(go.map((r) => r.arm.tGo)))} s · 칼날 자리 ${f(avg(F.map((r) => r.fin.along)))} (칼끝 쪽 ${F.filter((r) => r.fin.along > 0.75).length}/${F.length}) · 판정 ${JSON.stringify(F.reduce((o, r) => ((o[r.fin.type] = (o[r.fin.type] ?? 0) + 1), o), {}))}`);
}
