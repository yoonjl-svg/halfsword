// 네 판 견줌: node sum4.mjs <나온 곳> fa_main fa_arm fa_lim fb_base
// 줄마다 144 판 합 · 묶음 여섯 · 묶음 표준편차. 차: fa_main 에 대한 셋 · fa_arm → fb_base. 문턱 = 2 × s × √6 (s = 두 칸 묶음 sd 의 제곱 평균 제곱근)
// '날 넘어짐(겹침 포함)' · '날 스스로' 는 fall_context 가 dup 으로 표시한 겹친 넘어짐까지 센 수(legs_battery 의 falls · selfFalls 와 같은 셈에 가까움)
import { readFileSync } from 'node:fs';
const [O, ...cells] = process.argv.slice(2);
const W = process.env.TREE ?? '.';
const { load, targets } = await import(W + '/tools/sim/fall_mech.mjs');
const OFFS = [0, 300, 600, 624, 648, 672];
const ROWS = ['날 넘어짐(겹침 포함)', '날 스스로(겹침 포함)', '따로 일어난 넘어짐', '상처 없는 넘어짐(= 스스로)', '상처 뒤 넘어짐', 'T1∪T2∪T3', 'sink:knee', 'cap:short', 'tilt', 'cap:late(+nostep)', 'getup', 'other'];
const cls = (c) => c === 'sink:knee' ? 'sink:knee' : c === 'cap:short' ? 'cap:short' : c.startsWith('tilt') ? 'tilt' : (c === 'cap:late' || c === 'cap:nostep') ? 'cap:late(+nostep)' : c === 'getup' ? 'getup' : 'other';
function vec(c, off) {
  const fj = `${O}/${c}/fall_${off}.json`;
  const F = JSON.parse(readFileSync(fj, 'utf8'));
  const rows = load([[fj, `${O}/${c}/ring_${off}.json`]]).rows;
  const t = targets(rows), s = rows.filter((r) => r.self);
  const k = (x) => s.filter((r) => cls(r.mech.cause) === x).length;
  return [F.falls.length, F.falls.filter((r) => r.self).length, t.all, t.self, t.wound, t.T123, k('sink:knee'), k('cap:short'), k('tilt'), k('cap:late(+nostep)'), k('getup'), k('other')];
}
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const sum = (a) => a.reduce((x, y) => x + y, 0);
const V = Object.fromEntries(cells.map((c) => [c, OFFS.map((o) => vec(c, o))]));
const col = (c, i) => V[c].map((v) => v[i]);
console.log(`## 네 판 (144 판 합 [묶음 ${OFFS.join(' · ')}] sd)\n`);
console.log(`| 줄 | ${cells.join(' | ')} |\n|---|${cells.map(() => '---').join('|')}|`);
ROWS.forEach((n, i) => console.log(`| ${n} | ${cells.map((c) => `**${sum(col(c, i))}** [${col(c, i).join('·')}] ${sd(col(c, i)).toFixed(1)}`).join(' | ')} |`));
const pairs = [[cells[0], cells[1]], [cells[0], cells[2]], [cells[0], cells[3]], [cells[1], cells[3]]];
console.log(`\n## 차 (문턱 = 2 × s × √6 · '넘음' = |차| > 문턱)\n`);
console.log(`| 줄 | ${pairs.map(([a, b]) => `${a} → ${b}`).join(' | ')} |\n|---|${pairs.map(() => '---').join('|')}|`);
ROWS.forEach((n, i) => console.log(`| ${n} | ${pairs.map(([a, b]) => {
  const d = sum(col(b, i)) - sum(col(a, i)), th = 2 * Math.sqrt((sd(col(a, i)) ** 2 + sd(col(b, i)) ** 2) / 2) * Math.sqrt(6);
  return `${d > 0 ? '+' : ''}${d} (${th.toFixed(1)}) ${Math.abs(d) > th ? '**넘음**' : '안'}`;
}).join(' | ')} |`));
// legs_battery 싸움 도구(오프셋 0 · 300 = 48 판)의 같은 칸 두 판 차의 흔들림: 묶음 sd s 이면 48 판 합의 sd = s√2, 두 합의 차의 sd = 2s
console.log(`\n## 48 판(오프셋 0 · 300) 합의 흔들림 — 칸 넷의 묶음 sd 제곱 평균 제곱근 s · 48 판 합 sd = s√2 · 두 판 차 sd = 2s · 두 배 문턱 = 4s\n`);
for (const i of [0, 1, 2, 3]) { const s = Math.sqrt(sum(cells.map((c) => sd(col(c, i)) ** 2)) / cells.length); console.log(`- ${ROWS[i]}: s ${s.toFixed(1)} · 48 판 합 ± ${(s * Math.SQRT2).toFixed(1)} · 두 판 차 sd ${(2 * s).toFixed(1)} · 2 sd ${(4 * s).toFixed(1)}`); }
