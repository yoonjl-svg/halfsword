// r21 표: TREE=<fall_mech 가 있는 트리> node sum.mjs <나온 곳> <바탕 나옴 폴더> <칸...> [--offs=0,300]
// r22p: 이 복사본은 맨 끝에 '두 배 한도(sb_legs) 가 줄인 몫의 몇 %' 표를 더 찍는다(칸 이름 sb_legs 가 주어졌을 때 · 읽기 규칙용).
// 줄 정의는 v3base/sum.mjs 와 같음(fall_mech targets · classify). 싸움 쪽 값은 fall_cost.mjs 의 cost.
// 소음 문턱(미리 정한 잣대 그대로 · 읽기 지적에 따라 고침): 48 판 대 48 판 = 따로 23 · 상처 없는 17, 144 판 대 144 판 = 40 · 30. 차가 문턱 '아래'(|d| < t)면 소음 — 문턱과 같으면 소음 밖.
//  (옛 식 2 × sd × √(2 × 묶음 수) 는 23.2 · 17.2 · 40.2 · 29.8 이고 |d| ≤ t 로 문턱 값 자체를 소음으로 셌다)
import { readFileSync, existsSync } from 'node:fs';
const argv = process.argv.slice(2);
const offs = (argv.find((a) => a.startsWith('--offs=')) ?? '--offs=0,300').slice(7).split(',').map(Number);
const [O, base, ...cells] = argv.filter((a) => !a.startsWith('--'));
const { load, targets } = await import((process.env.TREE ?? '.') + '/tools/sim/fall_mech.mjs');
const cls = (c) => c === 'sink:knee' ? 'sink:knee' : c === 'cap:short' ? 'cap:short' : c.startsWith('tilt') ? 'tilt' : (c === 'cap:late' || c === 'cap:nostep') ? 'cap:late' : c === 'getup' ? 'getup' : 'other';
const K = ['sink:knee', 'cap:short', 'tilt', 'cap:late', 'getup', 'other'];
function cell(dir) {
  const s = { all: 0, self: 0, wound: 0, cls: Object.fromEntries(K.map((k) => [k, 0])), per: [], cost: null, n: 0 };
  for (const off of offs) {
    const f = `${O}/${dir}/fall_${off}.json`; if (!existsSync(f)) continue;
    const F = JSON.parse(readFileSync(f, 'utf8'));
    const rows = load([[f, `${O}/${dir}/ring_${off}.json`]]).rows, t = targets(rows);
    s.all += t.all; s.self += t.self; s.wound += t.wound; s.n++; s.per.push(`${t.all}/${t.self}`);
    for (const r of rows.filter((r) => r.self)) s.cls[cls(r.mech.cause)]++;
    if (F.cost) { s.cost ??= { fights: 0, secs: 0, deaths: 0, fightsDeath: 0, wounds: 0, woundE: 0, strokes: 0, walk: 0, standMin: 0 }; for (const k in F.cost) s.cost[k] += F.cost[k]; s.cost.standMin += F.bodyMin.stand; }
  }
  return s;
}
const TH = { 2: [23, 17], 6: [40, 30] }; // 묶음 수 → [따로, 상처 없는]
const B = cell(base), th = (i, n) => { if (!TH[n]) throw new Error('문턱이 정해지지 않은 묶음 수 ' + n); return TH[n][i]; };
const verdict = (d, t) => Math.abs(d) < t ? '안(소음)' : d < 0 ? '줄어 넘음' : '늘어 넘음';
console.log(`묶음 ${offs.join(' · ')} · 문턱 따로 ${th(0, offs.length)} · 상처 없는 ${th(1, offs.length)}\n`);
console.log('| 칸 | 묶음 | 따로 일어난 (차) | 상처 없는 (차) | 판정 따로 / 상처 없는 | sink:knee · cap:short · tilt · cap:late · getup · other | 상처 뒤 | 판 길이 평균 s | 죽음 (판) | 상처 | 베기 시작 | 선 채 걸은 m/분 | 따로 · 상처 없는 넘어짐 / 선 몸 10 분 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const [name, dir] of [[base, base], ...cells.map((c) => [c, c])]) {
  const s = dir === base ? B : cell(dir), c = s.cost;
  const dA = s.all - B.all, dS = s.self - B.self, same = s.n === B.n;
  const v = dir === base ? '—' : same ? `${verdict(dA, th(0, s.n))} / ${verdict(dS, th(1, s.n))}` : `묶음 수 다름 ${s.n}/${B.n}`;
  const cs = c ? `${(c.secs / c.fights).toFixed(1)} | ${c.deaths} (${c.fightsDeath}) | ${c.wounds} | ${c.strokes} | ${(c.walk / c.standMin).toFixed(1)} | ${(10 * s.all / c.standMin).toFixed(2)} · ${(10 * s.self / c.standMin).toFixed(2)}` : '- | - | - | - | - | -';
  console.log(`| ${name} | ${s.n} [${s.per.join(' ')}] | ${s.all} (${dir === base ? '' : (dA > 0 ? '+' : '') + dA}) | ${s.self} (${dir === base ? '' : (dS > 0 ? '+' : '') + dS}) | ${v} | ${K.map((k) => s.cls[k]).join(' · ')} | ${s.wound} | ${cs} |`);
}
// r22p: 읽기 규칙 — 두 배 한도(sb_legs)가 줄인 몫(바탕 − sb_legs)에서 각 칸이 닿은 몫
if (cells.includes('sb_legs')) {
  const L = cell('sb_legs'), gA = B.all - L.all, gS = B.self - L.self;
  console.log(`\n두 배 한도가 줄인 몫: 따로 ${B.all} → ${L.all} (${gA}) · 상처 없는 ${B.self} → ${L.self} (${gS})`);
  console.log('| 칸 | 따로 줄어든 수 · 그 몫 % | 상처 없는 줄어든 수 · 그 몫 % |\n|---|---|---|');
  for (const c of cells) { if (c === 'sb_legs' || c === base) continue; const s = cell(c); if (s.n !== B.n) continue; const a = B.all - s.all, b = B.self - s.self; console.log(`| ${c} | ${a} · ${(100 * a / gA).toFixed(0)} % | ${b} · ${(100 * b / gS).toFixed(0)} % |`); }
}
