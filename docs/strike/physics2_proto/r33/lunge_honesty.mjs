// r33 짓기 2 — 런지 장면에 정직 심판(tools/sim/honesty.mjs)을 붙임 (판정 줄 R8 · 읽기만 — 심판은 강체 메서드를 감싸 적을 뿐 인자는 그대로)
//  node lunge_honesty.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4001-4004] [--adds=0.3,0.45] [--walk=0.6] [--json=파일] [--report]
//   장면 = lunge_lib.mjs runLunge (lunge_scene.mjs 와 같은 간격 · 씨앗 갈래) · 심판은 탭 때 붙여(r30 v3_reqlunge.mjs 와 같은 attach · hook) 탭 뒤 1.5 s 를 봄 · 사람 몸 하나
//   판마다 L.summary() 를 모음 · --report 면 판마다 Hn.report 글도 찍음
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const Hn = await imp('tools/sim/honesty.mjs');
const { makeMeasure, seedList } = await imp('tools/sim/wb_measure.mjs');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H); const { DT } = H;
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } };
const WS = String(args.w ?? 'rapier,longsword').split(','); const seeds = seedList(args.seeds ?? '4001-4004');
const ADDS = String(args.adds ?? '0.3,0.45').split(',').map(Number); const WALK = +(args.walk ?? 0.6); const POST = 1.5;
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };
const out = [];
for (const W of WS) for (const add of ADDS) for (const s of seeds) {
  let L = null, sum = null; const nPost = Math.round(POST / DT);
  runLunge(M, H, s, W, { gap: BODY.reach[W] + BODY.front + add, walk: WALK, post: POST,
    onTap: (G, P) => { L = Hn.attach(G.world, bodiesOf(P), { fighter: P }); Hn.hook(G, [L]); },
    onStep: (G, P, E, i) => { if (i === nPost - 1 || P.state !== 'stand') { if (!sum) sum = L.summary(); } } });
  if (!sum && L) sum = L.summary();
  out.push({ W, add, seed: s, sum });
  if (args.report) console.log(Hn.report(`런지 · ${W} +${add} · ${s}`, sum), '\n');
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
console.log('판', out.length);
