// r22 짝 지은 견줌: TREE=<fall_mech 가 있는 트리> node pair.mjs <나온 곳> <바탕 나옴 폴더> <칸...> [--offs=0,300,600,624,648,672]
//  같은 씨앗의 판끼리 짝 (바탕 ↔ 칸). 두 물음: (1) 그 판에 상처 없는 넘어짐이 하나라도 있었나 (fall_mech load · r.self — sum.mjs 와 같은 줄)
//  (2) 그 판에 죽음이 있었나 (fall_cost.mjs json 의 perFight — r22 복사본만 적는다. 없으면 '기록 없음').
//  엇갈린 짝 b = 바탕만 예 · c = 칸만 예 · 정확한 두쪽 이항 p = min(1, 2 · Σ_{k ≤ min(b,c)} C(b+c, k) / 2^(b+c)).
import { readFileSync, existsSync } from 'node:fs';
const argv = process.argv.slice(2);
const offs = (argv.find((a) => a.startsWith('--offs=')) ?? '--offs=0,300,600,624,648,672').slice(7).split(',').map(Number);
const [O, base, ...cells] = argv.filter((a) => !a.startsWith('--'));
const { load } = await import((process.env.TREE ?? '.') + '/tools/sim/fall_mech.mjs');
function per(dir) {
  const nw = new Map(), death = new Map(); let fights = 0, deathRec = true;
  for (const off of offs) {
    const f = `${O}/${dir}/fall_${off}.json`; if (!existsSync(f)) return null;
    const F = JSON.parse(readFileSync(f, 'utf8'));
    for (let s = off + 1; s <= off + F.fights; s++) nw.set(s, false);
    fights += F.fights;
    for (const r of load([[f, `${O}/${dir}/ring_${off}.json`]]).rows) if (r.self) nw.set(r.seed, true);
    if (F.perFight) for (const p of F.perFight) death.set(p.seed, p.deaths > 0); else deathRec = false;
  }
  return { nw, death: deathRec ? death : null, fights };
}
function binom2(b, c) {
  const n = b + c, k = Math.min(b, c); if (n === 0) return 1;
  let lg = [0]; for (let i = 1; i <= n; i++) lg[i] = lg[i - 1] + Math.log(i);
  let s = 0; for (let i = 0; i <= k; i++) s += Math.exp(lg[n] - lg[i] - lg[n - i] - n * Math.LN2);
  return Math.min(1, 2 * s);
}
function test(A, B) {
  let yy = 0, b = 0, c = 0, nn = 0;
  for (const [s, a] of A) { if (!B.has(s)) continue; const x = B.get(s); if (a && x) yy++; else if (a) b++; else if (x) c++; else nn++; }
  return { yes0: yy + b, yes1: yy + c, b, c, p: binom2(b, c) };
}
const B = per(base);
console.log(`묶음 ${offs.join(' · ')} · 바탕 ${base} ${B?.fights} 판`);
console.log('| 칸 | 물음 | 바탕 예 | 칸 예 | 바탕만 예 (b) | 칸만 예 (c) | 두쪽 p |');
console.log('|---|---|---|---|---|---|---|');
for (const cell of cells) {
  const X = per(cell);
  if (!X) { console.log(`| ${cell} | - | 묶음 없음 | | | | |`); continue; }
  for (const [q, a, x] of [['상처 없는 넘어짐 ≥ 1', B.nw, X.nw], ['죽음 있음', B.death, X.death]]) {
    if (!a || !x) { console.log(`| ${cell} | ${q} | 판마다 기록 없음${a ? '' : ' (바탕)'}${x ? '' : ' (칸)'} | | | | |`); continue; }
    const t = test(a, x);
    console.log(`| ${cell} | ${q} | ${t.yes0} | ${t.yes1} | ${t.b} | ${t.c} | ${t.p < 0.001 ? t.p.toExponential(1) : t.p.toFixed(3)} |`);
  }
}
