// r22p 읽기 지적 고침: 넘어짐이 준 것이 '선 몸 시간이 줄어서'인지 · 어느 줄에서 줄었는지 가르는 표.
// TREE=<fall_mech 가 있는 트리> node expo.mjs <나온 곳> <바탕> <칸...> [--offs=...]
// 줄: 선 몸 분(bodyMin.stand 합) · 따로 · 상처 없는 · 상처 뒤 · sink:knee · 상처 · 죽음 · 베기 시작 · 걸은 m/분 · 선 몸 10 분당 따로 / 상처 없는 / 상처 뒤 · 바탕 대비 차(따로 = 상처 없는 + 상처 뒤)
// 무릎 회전력 · 짐은 재지 않는다(나온 것에 그런 기록이 없음).
import { readFileSync, existsSync } from 'node:fs';
const argv = process.argv.slice(2);
const offs = (argv.find((a) => a.startsWith('--offs=')) ?? '--offs=0,300,600,624,648,672').slice(7).split(',').map(Number);
const [O, base, ...cells] = argv.filter((a) => !a.startsWith('--'));
const { load, targets } = await import((process.env.TREE ?? '.') + '/tools/sim/fall_mech.mjs');
function cell(dir) {
  const s = { all: 0, self: 0, wound: 0, sk: 0, stand: 0, deaths: 0, wounds: 0, strokes: 0, walk: 0, n: 0 };
  for (const off of offs) {
    const f = `${O}/${dir}/fall_${off}.json`; if (!existsSync(f)) continue;
    const F = JSON.parse(readFileSync(f, 'utf8')); const rows = load([[f, `${O}/${dir}/ring_${off}.json`]]).rows, t = targets(rows);
    s.all += t.all; s.self += t.self; s.wound += t.wound; s.n++;
    s.sk += rows.filter((r) => r.self && r.mech.cause === 'sink:knee').length;
    s.stand += F.bodyMin.stand; s.deaths += F.cost.deaths; s.wounds += F.cost.wounds; s.strokes += F.cost.strokes; s.walk += F.cost.walk;
  }
  return s;
}
const B = cell(base);
console.log(`묶음 ${offs.join(' · ')}\n`);
console.log('| 칸 | 선 몸 분 | 따로 (차) | 상처 없는 (차) | 상처 뒤 (차) | sink:knee (차) | 상처 (차) | 죽음 (차) | 베기 시작 | 걸은 m/분 | 선 몸 10 분당 따로 · 상처 없는 · 상처 뒤 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
const d = (a, b) => (a - b > 0 ? '+' : '') + (a - b);
for (const c of [base, ...cells]) {
  const s = c === base ? B : cell(c); if (s.n !== B.n) { console.log(`| ${c} | 묶음 수 다름 |`); continue; }
  const p = (x) => (10 * x / s.stand).toFixed(2);
  console.log(`| ${c} | ${s.stand.toFixed(1)} | ${s.all} (${d(s.all, B.all)}) | ${s.self} (${d(s.self, B.self)}) | ${s.wound} (${d(s.wound, B.wound)}) | ${s.sk} (${d(s.sk, B.sk)}) | ${s.wounds} (${d(s.wounds, B.wounds)}) | ${s.deaths} (${d(s.deaths, B.deaths)}) | ${s.strokes} | ${(s.walk / s.stand).toFixed(1)} | ${p(s.all)} · ${p(s.self)} · ${p(s.wound)} |`);
}
