// r33 짓기 1 — 탭 찌르기 런지의 선 자세 · 발 떼기 차례를 판마다 적음 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//  node lunge_stance.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4001-4006] [--gap=2.35] [--walk=0.6] [--post=1.0]
//   탭 때: 두 발 앞뒤 간격(앞 = 바라보는 쪽) · 옆 간격 · 무게중심 − 뒷발(d) · gait.frontLeg 가 고른 앞발 · 탭이 부탁한 런지 걸음(fwd · duration · push · accel)
//   탭 뒤: 발이 뜰 때마다 [시각 · 발 · 걸음 꼴(gait legs.kind) · 뜬 시간 T · 그때 d · 부탁의 gather/gathered/swap] · 런지 발 디딤 뒤 d
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList } = await imp('tools/sim/wb_measure.mjs');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H);
const WS = String(args.w ?? 'rapier,longsword').split(','); const seeds = seedList(args.seeds ?? '4001-4006');
const GAP = +(args.gap ?? 2.35); const WALK = +(args.walk ?? 0.6); const POST = +(args.post ?? 1.0);
const f3 = (x) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(3));
for (const W of WS) for (const seed of seeds) {
  let fw = null, prev = null, out = [], tapInfo = null;
  const geo = (P) => { const a = P.bodies.footF.translation(), b = P.bodies.footB.translation(); const fr = P.gait.frontLeg(fw); const A = fr === 'F' ? a : b, B = fr === 'F' ? b : a; const c = P.com;
    return { fr, spread: (A.x - B.x) * fw.x + (A.z - B.z) * fw.z, side: (A.x - B.x) * -fw.z + (A.z - B.z) * fw.x, d: c ? (c.x - B.x) * fw.x + (c.z - B.z) * fw.z : NaN, dl: c ? (c.x - B.x) * -fw.z + (c.z - B.z) * fw.x : NaN }; };
  runLunge(M, H, seed, W, { gap: GAP, walk: WALK, post: POST,
    onTap: (G, P) => { fw = { x: Math.cos(P.heading), z: -Math.sin(P.heading) }; tapInfo = geo(P); prev = { F: P.gait.legs.F.stance, B: P.gait.legs.B.stance }; },
    tap: (P) => { const ok = P.skill.thrust(); const r = P.gait.req; tapInfo.req = r ? `${r.kind} fwd ${f3(r.fwd)} T ${f3(r.duration)} push ${r.push ?? 1}${r.accel ? ' accel' : ''}` : '-'; tapInfo.wf = P.gait.P.weightFront; tapInfo.it = !!P.skill.tap?.it; return ok; },
    onStep: (G, P, E, i) => { if (!fw || P.state !== 'stand') return; const g = P.gait; for (const k of ['F', 'B']) { const l = g.legs[k]; if (prev[k] && !l.stance) { const q = geo(P); out.push(`${f3((i + 1) * H.DT)}s ${k}${q.fr === k ? '(앞)' : '(뒤)'} ${l.kind} T ${f3(l.T)} d ${f3(q.d)} 옆 ${f3(q.dl)}${g.req ? ` req[${g.req.gather ? 'gather ' : ''}${g.req.gathered ? 'gathered ' : ''}${g.req.swap ? 'swap' : ''}]` : ''}`); } if (!prev[k] && l.stance) { const q = geo(P); out.push(`${f3((i + 1) * H.DT)}s ${k} 디딤 spread ${f3(q.spread)} d ${f3(q.d)}`); } prev[k] = l.stance; } } });
  const t = tapInfo; console.log(`${W} ${seed} | 탭 때 앞발 ${t.fr} spread ${f3(t.spread)} 옆 ${f3(t.side)} d ${f3(t.d)} 옆d ${f3(t.dl)} wf ${t.wf} it ${t.it} | 부탁 ${t.req}\n   ${out.slice(0, 8).join(' · ')}`);
}
