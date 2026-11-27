// 칸마다 표 · 견줌 표: node sum.mjs <나온 곳> <바탕 칸> <견줄 칸...>
// 줄마다: 144 판 합 · 묶음(24 판) 여섯의 표준편차 · 안 본 씨앗(601 ~ 696 · 96 판) 합
// 견줌: 차 · 문턱 = 2 × (두 칸 묶음 표준편차의 제곱 평균 제곱근) × √(묶음 수) — 144 판은 √6 · 안 본 96 판은 √4
import { existsSync } from 'node:fs';
const [O, ...cells] = process.argv.slice(2);
const W = process.env.TREE ?? '.';
const { load, targets } = await import(W + '/tools/sim/fall_mech.mjs');
const OFFS = [0, 300, 600, 624, 648, 672], UNSEEN = [600, 624, 648, 672];
const ROWS = ['따로 일어난 넘어짐', '상처 없는 넘어짐', 'T1∪T2∪T3', ' T1', ' T2', ' T3', 'sink:knee', 'cap:short', 'tilt', 'cap:late(+nostep)', 'getup', 'other', '상처 뒤 넘어짐'];
const cls = (c) => c === 'sink:knee' ? 'sink:knee' : c === 'cap:short' ? 'cap:short' : c.startsWith('tilt') ? 'tilt' : (c === 'cap:late' || c === 'cap:nostep') ? 'cap:late(+nostep)' : c === 'getup' ? 'getup' : 'other';
function vec(rows) {
  const t = targets(rows), s = rows.filter((r) => r.self);
  const c = (k) => s.filter((r) => cls(r.mech.cause) === k).length;
  return [t.all, t.self, t.T123, t.T1, t.T2, t.T3, c('sink:knee'), c('cap:short'), c('tilt'), c('cap:late(+nostep)'), c('getup'), c('other'), t.wound];
}
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const D = {};
for (const c of cells) {
  const per = {};
  for (const off of OFFS) { const f = `${O}/${c}/fall_${off}.json`; if (existsSync(f)) per[off] = vec(load([[f, `${O}/${c}/ring_${off}.json`]]).rows); }
  D[c] = per;
  const have = Object.keys(per).map(Number);
  console.log(`\n## ${c}  (묶음 ${have.length}/6: ${have.join(' ')})`);
  console.log('| 줄 | 144 판 합 | 묶음 0·300·600·624·648·672 | 표준편차 | 안 본 96 판 |\n|---|---|---|---|---|');
  ROWS.forEach((name, i) => {
    const b = OFFS.map((o) => per[o]?.[i]);
    const ok = b.filter((x) => x != null);
    const un = UNSEEN.map((o) => per[o]?.[i]).filter((x) => x != null);
    console.log(`| ${name} | ${ok.reduce((x, y) => x + y, 0)} | ${b.map((x) => x ?? '-').join(' · ')} | ${ok.length > 1 ? sd(ok).toFixed(1) : '-'} | ${un.reduce((x, y) => x + y, 0)} |`);
  });
}
const base = cells[0];
for (const c of cells.slice(1)) {
  console.log(`\n## 견줌 ${base} → ${c}  (넘음 = |차| > 문턱)`);
  console.log('| 줄 | 144 판 바탕 → 고침 (차) | 문턱 144 | 넘음 | 안 본 96 판 바탕 → 고침 (차) | 문턱 96 | 넘음 |\n|---|---|---|---|---|---|---|');
  ROWS.forEach((name, i) => {
    const col = (offs) => {
      const a = offs.filter((o) => D[base][o] && D[c][o]);
      const xa = a.map((o) => D[base][o][i]), xb = a.map((o) => D[c][o][i]);
      const sa = xa.reduce((x, y) => x + y, 0), sb = xb.reduce((x, y) => x + y, 0);
      const s = a.length > 1 ? Math.sqrt((sd(OFFS.filter((o) => D[base][o]).map((o) => D[base][o][i])) ** 2 + sd(OFFS.filter((o) => D[c][o]).map((o) => D[c][o][i])) ** 2) / 2) : NaN;
      const th = 2 * s * Math.sqrt(a.length);
      const d = sb - sa;
      return `${sa} → ${sb} (${d > 0 ? '+' : ''}${d}) | ${th.toFixed(1)} | ${Math.abs(d) > th ? (d < 0 ? '줄어 넘음' : '**늘어 넘음**') : '안'}`;
    };
    console.log(`| ${name} | ${col(OFFS)} | ${col(UNSEEN)} |`);
  });
}
