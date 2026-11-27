// r29 inj part 1 table: node lunge_table.mjs <out dir>  (reads lg_*.json from run_lunge.sh)
import { readFileSync, existsSync } from 'node:fs';
const O = process.argv[2];
const J = (t) => (existsSync(`${O}/lg_${t}.json`) ? JSON.parse(readFileSync(`${O}/lg_${t}.json`, 'utf8')) : null);
const sig = (r) => r.events.map((e) => `${e.att}>${e.vic}@s${e.step}:${e.type}/${e.zone}/${e.energy}`).join(' ');
// 1) proof
const a = J('proof_cell'), b = J('proof_mut');
if (a && b) {
  const same = a.map((r, i) => sig(r) === sig(b[i]) && JSON.stringify(r.clashes) === JSON.stringify(b[i].clashes) && r.dEnd === b[i].dEnd && r.tipGapMin === b[i].tipGapMin);
  console.log(`mutation proof (ll_10_100 + ecc 1.3 + limit x1.25 vs cell ll_13_125): ${same.every(Boolean) ? 'IDENTICAL' : 'DIFFERENT'} — ` + a.map((r, i) => `gap ${r.gap}: cell [${sig(r)}] mut [${sig(b[i])}]`).join(' | '));
}
// 2) seeds
for (const t of ['seeds_base', 'seeds_new']) { const R = J(t); if (!R) continue; const S = new Set(R.map(sig)); console.log(`${t}: ${R.length} seeds · distinct event signatures ${S.size} · hit ${R.filter((r) => r.hit).length}/${R.length}`); }
// 3) grid — first P->A body contact per cell and gap
const cells = ['r24_om', 'll_10_100', 'll_13_100', 'll_10_125', 'll_117_125', 'll_13_125', 'll_14_125', 'm13_110', 'm12_125'];
const G = J('grid_r24_om')?.map((r) => r.gap) ?? [];
console.log('\nP->A body contacts in 1.2 s after fire (seed 1). cell: per gap "type zone energyJ (eff vs thr) @tReal step, point height, chest-local y" ; HIT = test would count a hit');
console.log(`| cell | ${G.map((g) => g + ' m').join(' | ')} |`);
console.log(`|---|${G.map(() => '---').join('|')}|`);
for (const c of cells) {
  const R = J('grid_' + (c.startsWith('m') ? c : c)) ?? J('grid_' + c);
  if (!R) continue;
  console.log(`| ${c} | ${R.map((r) => { const e = r.events.filter((x) => x.att === 'P' && x.vic === 'A'); if (!e.length) return `none (over ${r.over})`; return e.map((x) => `${x.type} ${x.zone} ${x.energy} J (eff ${x.eff} / thr ${x.thr}) @${x.tReal} y ${x.point?.[1]} ly ${x.vicLocal?.[1]}`).join(' ; ') + (r.hit ? ' **HIT**' : ''); }).join(' | ')} |`);
}
console.log('\nper cell: gaps with a hit (test-counted) and with a cut-geometry contact (eff computed, i.e. edge-on) ');
for (const c of cells) {
  const R = J('grid_' + c); if (!R) continue;
  const hits = R.filter((r) => r.hit).map((r) => r.gap);
  const edge = R.filter((r) => r.events.some((x) => x.att === 'P' && x.vic === 'A' && x.eff != null)).map((r) => r.gap);
  const over = [...new Set(R.map((r) => r.over))];
  console.log(`${c}: hit at [${hits.join(', ')}] · edge contact at [${edge.join(', ')}] · overshoot values ${over.join(', ')}`);
}
// 4) where / when: every P->A contact in the grid — blade point, timing vs the lunge result, lunger state, step mass share
const all = [];
for (const c of cells) for (const r of J('grid_' + c) ?? []) for (const e of r.events.filter((x) => x.att === 'P' && x.vic === 'A')) all.push({ c, gap: r.gap, lungeEnd: r.lungeEnd?.tReal, ...e });
const mm = (k) => { const v = all.map((e) => e[k]).filter((x) => x != null); return v.length ? `${Math.min(...v)} .. ${Math.max(...v)}` : '-'; };
console.log(`\nall P->A contacts in grid: n ${all.length} · bladePart ${[...new Set(all.map((e) => e.bladePart))].join(',')} · bladeT ${mm('bladeT')} · from guard m ${mm('fromGuard_m')} · tReal ${mm('tReal')} · lunge result at ${mm('lungeEnd')} · lunger iai during contact ${[...new Set(all.map((e) => e.attIai?.kind ?? 'none'))].join(',')} · sec stage ${[...new Set(all.map((e) => e.attSecStage ?? 'none'))].join(',')} · speed ${mm('speed')} · stepMass ${mm('stepMass_now')} · attacker pelvis fwd v ${mm('attPelvisVfwd')} · victim AI mode ${[...new Set(all.map((e) => e.vicMode))].join(',')}`);
const cuts = all.filter((e) => e.type === 'cut');
console.log(`cuts: n ${cuts.length} · zones ${[...new Set(cuts.map((e) => e.zone))].join(',')} · energy ${Math.min(...cuts.map((e) => e.energy))} .. ${Math.max(...cuts.map((e) => e.energy))} · energy without step mass would be (mEff-1)/mEff of it: ${cuts.map((e) => +((e.energy * (e.mEff - e.stepMass_now)) / e.mEff).toFixed(1)).join(' ')} vs thr ${[...new Set(cuts.map((e) => e.thr))].join(',')} (eff scales the same way: ${cuts.map((e) => +((e.eff * (e.mEff - e.stepMass_now)) / e.mEff).toFixed(1)).join(' ')})`);
