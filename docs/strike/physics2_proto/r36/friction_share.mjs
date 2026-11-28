// r36 반박 — 칼 → 상대 몸 닿음에서 마찰(접선) 충격량이 법선 충격량에 견줘 얼마인가 (읽기만: 엔진 닿음 정보를 읽을 뿐 · 몸에 아무것도 걸지 않음)
//  rescore.mjs 의 ③ 은 법선 충격량만 더한다. 이 대본은 같은 런지 장면에서 같은 칼 콜라이더 × 몸 토막 쌍의 접선 충격량(X · Y)을 함께 읽어 몫을 적는다.
//  node friction_share.mjs --root=<칸> [--w=rapier] [--add=0.45] [--seeds=7001-7004]
import { pathToFileURL, fileURLToPath } from 'node:url'; import { join, resolve, dirname } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.')); const HERE = dirname(fileURLToPath(import.meta.url));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { makeMeasure, seedList } = await imp('tools/sim/wb_measure.mjs');
const { runLunge } = await import(pathToFileURL(join(HERE, '../r33/lunge_lib.mjs')).href);
const M = makeMeasure(H); const W = String(args.w ?? 'rapier'); const add = +(args.add ?? 0.45);
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } };
for (const s of seedList(args.seeds ?? '7001-7004')) {
  let Jn = 0, Jt = 0, nstep = 0, firstN = null, firstT = null;
  const onTap = (G, P, E) => { const C = G.combat; const o = C.afterStep.bind(C);
    C.afterStep = function (world, eq) { o(world, eq); let sn = 0, st = 0;
      for (const name in E.bodies) { const rb = E.bodies[name]; for (let ci = 0; ci < rb.numColliders(); ci++) { const col = rb.collider(ci);
        for (const sc of P.swordColliders) world.contactPair(col, sc, (m) => { for (let q = 0; q < m.numContacts(); q++) { const n = m.contactImpulse(q); if (!(n > 0)) continue; sn += n; st += Math.hypot(m.contactTangentImpulseX(q), m.contactTangentImpulseY(q)); } }); } }
      if (sn > 0) { Jn += sn; Jt += st; nstep++; if (firstN == null) (firstN = sn), (firstT = st); } }; };
  runLunge(M, H, s, W, { gap: BODY.reach[W] + BODY.front + add, walk: 0.6, post: 2.0, wb: true, onTap });
  console.log(JSON.stringify({ seed: s, W, add, steps: nstep, sumN: +Jn.toFixed(4), sumT: +Jt.toFixed(4), ratioT: Jn > 0 ? +(Jt / Jn).toFixed(3) : null, firstN: firstN && +firstN.toFixed(4), firstT: firstT && +firstT.toFixed(4) }));
}
