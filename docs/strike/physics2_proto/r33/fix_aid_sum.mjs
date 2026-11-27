// r33 고치기 — lunge_honesty.mjs 의 json 들에서 골반 밖 토크(driveAid · 갈래 aid) 쓰임을 무기마다 모음 (읽기만)
//  node fix_aid_sum.mjs <json> [<json> …] — 판마다 aid.torqueRate (N·m · 잰 시간 평균) · stepShare (걸린 스텝 몫) · peakNm · yaw / tilt 평균 → 무기 · +간격마다 평균
import { readFileSync } from 'node:fs';
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
for (const p of process.argv.slice(2)) {
  const rows = JSON.parse(readFileSync(p, 'utf8'));
  console.log(p.split('/').pop());
  const keys = [...new Set(rows.map((r) => `${r.W} +${r.add}`))];
  for (const k of [...new Set(rows.map((r) => r.W))].concat(keys)) {
    const R = rows.filter((r) => r.W === k || `${r.W} +${r.add}` === k).map((r) => r.sum?.aid).filter(Boolean);
    console.log(`  ${k.padEnd(16)} 판 ${R.length} · 평균 토크 ${mean(R.map((a) => a.torqueRate)).toFixed(1)} N·m · 걸린 스텝 ${(100 * mean(R.map((a) => a.stepShare))).toFixed(0)} % · 스텝 최고 ${Math.max(...R.map((a) => a.peakNm)).toFixed(0)} · yaw ${mean(R.map((a) => a.yaw.avg)).toFixed(1)} · 기울기 ${mean(R.map((a) => a.tilt.avg)).toFixed(1)}`);
  }
}
