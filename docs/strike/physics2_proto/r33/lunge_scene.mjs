// r33 Q6 '닿는가' 장면 — 팔만으로는 안 닿고 사람 같은 런지면 닿아야 하는 골반 간격에서 사람 길 탭 찌르기의 맞음 수 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//  node lunge_scene.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4001-4020] [--adds=0,0.15,0.3,0.45,0.6] [--walk=0 | 0.6] [--json=파일]
//   간격 = 팔 닿음(tools/sim/wb_gate.mjs BODY.reach — 걸음 없는 탭에서 칼끝이 탭 때 골반보다 앞선 최대) + 몸통 앞 두께(BODY.front 0.11) + add.
//    add 0 = 팔만으로 닿는 끝 · 0.3 / 0.45 / 0.6 = 걸음 사다리 칸만큼 몸이 실려야 닿음 (사람 런지의 골반 이동 0.6 ~ 0.9 m · 자료 앞발 걸음 0.6 ~ 0.9 m 의 몫).
//   장면 = lunge_lib.mjs runLunge (walk 0 = 관문 runThrust 와 같은 틀 · walk 0.6 = 먼저 걸어 펜싱 자세) · 셈 = wb_measure.strokeWB (관문과 같은 정의 — 맞음 · 골반 최고 · 골반 이동 · 넘어짐).
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList, q } = await imp('tools/sim/wb_measure.mjs');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H);
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // tools/sim/wb_gate.mjs BODY 와 같은 값 (그 파일은 부르면 관문이 돌아 베낌)
const WS = String(args.w ?? 'rapier,longsword').split(','); const seeds = seedList(args.seeds ?? '4001-4020');
const ADDS = String(args.adds ?? '0,0.15,0.3,0.45,0.6').split(',').map(Number); const WALK = +(args.walk ?? 0);
const rows = [];
for (const W of WS) for (const add of ADDS) { const gap = BODY.reach[W] + BODY.front + add;
  for (const s of seeds) { const r = runLunge(M, H, s, W, { gap, walk: WALK, post: 3.2, wb: true }); if (r) rows.push({ W, add, ...r }); } }
const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
console.log(`앞서 걸음 ${WALK} s · 씨앗 ${seeds[0]}-${seeds[seeds.length - 1]}`);
console.log('무기 | 간격 m (팔 닿음 + 몸통 + add) | 맞음 / 획 | 골반 최고 가운데 m/s | 골반 이동(창 끝까지) 가운데 m | 탭 → 맞음 가운데 s | 넘어짐');
for (const W of WS) for (const add of ADDS) { const R = rows.filter((r) => r.W === W && r.add === add); if (!R.length) continue; const hit = R.filter((r) => r.hit);
  console.log(`${W} | ${f(R[0].gap)} (+${add}) | ${hit.length} / ${R.length} | ${f(q(R.map((r) => r.pelPk), 0.5))} | ${f(q(R.map((r) => r.pelTravel), 0.5))} | ${f(q(hit.map((r) => r.tHit), 0.5), 3)} | ${R.filter((r) => r.fell).length}`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify({ walk: WALK, rows }));
