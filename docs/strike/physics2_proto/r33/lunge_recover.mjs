// r33 받기와 돌아옴 (판정 줄 R9) — 사람 길 탭 찌르기 런지 한 판에서 앞발을 디딘 뒤를 셈 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//  node lunge_recover.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4001-4020] [--adds=0.3,0.45] [--walk=0.6] [--json=파일]
//   장면 = lunge_lib.mjs runLunge (lunge_scene.mjs 와 같은 간격 · 씨앗 갈래) · 탭 뒤 2.6 s 봄.
//   앞발 = 런지 부탁 걸음(gait.req · 발 kind 'req')으로 뜬 발 · 디딤 = 그 발이 3 스텝 내리 닿은 첫 스텝 (lunge_trace.mjs 와 같은 셈) · 런지 부탁이 없으면 칸을 비움
//   미끄러짐 = 디딘 뒤 0.5 s 동안 앞발 몸체가 디딘 자리에서 앞뒤로 가장 멀어진 거리 (lunge_trace.mjs rcv.slip 과 같음)
//   돌아옴 = 디딘 뒤 처음으로 3 스텝 내리 '두 발 디딤 · 무게중심 수평 빠르기 < 0.2 m/s · |앞뒤 발 간격 − 자세 길이(gait.P.guardLength)| ≤ 0.15 m' 인 때 (s) · 1.2 s 안이면 돌아옴
//   몸 닿음 = 탭 뒤 내 몸통(골반 · 배 · 가슴)이 상대 몸(칼 아닌 몸체)에 엔진 접촉으로 닿은 스텝 수
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList, q } = await imp('tools/sim/wb_measure.mjs');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H); const { THREE, DT } = H;
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // lunge_scene.mjs 와 같음
const WS = String(args.w ?? 'rapier,longsword').split(','); const seeds = seedList(args.seeds ?? '4001-4020');
const ADDS = String(args.adds ?? '0.3,0.45').split(',').map(Number); const WALK = +(args.walk ?? 0.6);
const TORSO = ['pelvis', 'abdomen', 'belly', 'chest'];
function torsoTouch(G, P, E) {
  const eh = new Set(); for (const rb of Object.values(E.bodies)) if (rb) eh.add(rb.handle);
  let n = 0;
  for (const k of TORSO) { const rb = P.bodies[k]; if (!rb) continue;
    for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) { const col = rb.collider(ci);
      G.world.contactPairsWith(col, (o) => { const pr = o.parent(); if (!pr || !eh.has(pr.handle)) return; G.world.contactPair(col, o, (m) => { if (m.numContacts() > 0) n++; }); }); } }
  return n > 0;
}
const rows = [];
for (const W of WS) for (const add of ADDS) { const gap = BODY.reach[W] + BODY.front + add;
  for (const s of seeds) {
    const tr = []; let fw = null; let gl = null;
    const r = runLunge(M, H, s, W, { gap, walk: WALK, post: 2.6, wb: true,
      onTap: (G, P) => { fw = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading)); gl = P.gait?.P?.guardLength ?? null; },
      onStep: (G, P, E, i) => { const gt = P.gait; const sw = gt ? (!gt.legs.F.stance && gt.legs.F.kind === 'req' ? 'F' : !gt.legs.B.stance && gt.legs.B.kind === 'req' ? 'B' : null) : null;
        const fp = P.bodies.footF.translation(), bp = P.bodies.footB.translation(); const s2 = M.sample(P); const cv = P.comVel;
        tr.push({ i, onF: !!s2?.onF, onB: !!s2?.onB, xF: fp.x * fw.x + fp.z * fw.z, xB: bp.x * fw.x + bp.z * fw.z, v: cv ? Math.hypot(cv.x, cv.z) : NaN, sw, touch: torsoTouch(G, P, E), st: P.state }); } });
    if (!r) continue;
    const rq = tr.find((x) => x.sw); let land = null, slip = null, tRec = null, spreadLand = null;
    if (rq) { const FR = rq.sw, onK = 'on' + FR; const k0 = tr.indexOf(rq);
      for (let k = k0; k + 2 < tr.length; k++) if (!tr[k].sw && tr[k][onK] && tr[k + 1][onK] && tr[k + 2][onK]) { land = k; break; }
      if (land != null) { const e = Math.min(tr.length - 1, land + Math.round(0.5 / DT)); slip = 0; for (let k = land; k <= e; k++) slip = Math.max(slip, Math.abs(tr[k]['x' + FR] - tr[land]['x' + FR]));
        spreadLand = Math.abs(tr[land].xF - tr[land].xB);
        const ok = (x) => x.onF && x.onB && x.v < 0.2 && gl != null && Math.abs(Math.abs(x.xF - x.xB) - gl) <= 0.15;
        for (let k = land; k + 2 < tr.length; k++) if (ok(tr[k]) && ok(tr[k + 1]) && ok(tr[k + 2])) { tRec = (k - land) * DT; break; } } }
    const end = tr[tr.length - 1];
    rows.push({ W, add, seed: s, hit: !!r.hit, fell: !!r.fell || tr.some((x) => x.st !== 'stand'), comPk: r.comPk, tHit: r.tHit, land: land != null ? land * DT : null, slip, tRec, spreadLand, gl,
      spreadEnd: end ? Math.abs(end.xF - end.xB) : null, vEnd: end?.v ?? null, touch: tr.filter((x) => x.touch).length });
  } }
const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
console.log(`앞서 걸음 ${WALK} s · 씨앗 ${seeds[0]}-${seeds[seeds.length - 1]} · 자세 길이 ${[...new Set(rows.map((r) => r.W + ' ' + r.gl))].join(' / ')}`);
console.log('무기 | +간격 | 판 | 맞음 | 넘어짐 | 디딤 s 가운데 | 앞발 미끄러짐 가운데 / 최고 m · ≤0.05 판 | 돌아옴 1.2 s 안 판 · 돌아온 때 가운데 s | 디딜 때 발 간격 가운데 | 끝(2.6 s) 발 간격 · 빠르기 가운데 | 몸통 닿음 스텝 합 · 닿은 판');
for (const W of WS) for (const add of ADDS) { const R = rows.filter((r) => r.W === W && r.add === add); if (!R.length) continue; const md = (a) => q(a.filter((x) => x != null && Number.isFinite(x)), 0.5);
  const sl = R.map((r) => r.slip).filter((x) => x != null); const rec = R.filter((r) => r.tRec != null && r.tRec <= 1.2);
  console.log(`${W} | +${add} | ${R.length} | ${R.filter((r) => r.hit).length} | ${R.filter((r) => r.fell).length} | ${f(md(R.map((r) => r.land)))} | ${f(md(sl), 3)} / ${f(Math.max(...sl), 3)} · ${sl.filter((x) => x <= 0.05).length} | ${rec.length} · ${f(md(rec.map((r) => r.tRec)))} | ${f(md(R.map((r) => r.spreadLand)))} | ${f(md(R.map((r) => r.spreadEnd)))} · ${f(md(R.map((r) => r.vEnd)))} | ${R.reduce((a, r) => a + r.touch, 0)} · ${R.filter((r) => r.touch > 0).length}`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(rows));
