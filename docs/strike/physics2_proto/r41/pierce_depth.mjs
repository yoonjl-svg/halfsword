// r41 칼끝 문 · 살갗 스프링 걸음 1 — 깊이 재기 대본 (읽기만: 게임 함수를 감싸 값을 적을 뿐 · 몸에 힘 · 자리 · 빠르기를 걸지 않음)
//  node pierce_depth.mjs --root=<칸> --scene=lunge|near|fight [--w=rapier,longsword] [--seeds=…] [--adds=0.3,0.45] [--walk=0.6] [--secs=30] [--fp=10] [--ff=0] [--json=파일]
//   장면은 r36/rescore.mjs 와 같은 틀 · 같은 판: lunge = r33/lunge_lib.mjs runLunge (간격 = 팔 닿음 + 몸 앞 + add · 걸음 0.6 s · 탭 뒤 2 s) ·
//   near = wb_gate 가까운 사람 길 탭 (rng(s*7+1) 차례 그대로) · fight = AI 대 AI (walls · 씨앗 1-6 · 30 s · 두 몸 모두 공격자)
//  --fp / --ff: 칸의 src/combat.js PIERCE.FP · FF 를 재는 수준으로 바꿔 돌림 (게임 코드의 값은 하나 — 재는 쪽만 바꿈). PIERCE 가 없는 칸(바탕)은 상처 줄만 적음.
//  적는 것:
//   rows  = combat.strike 한 번 (공격자 칼 → 상대 토막) · cat(wound / bruise / none) · pierce 길에서 불렸나
//   pierces = 칼끝 장부 하나: 열림 · 들어옴(entered) · 뚫림 · 가장 깊이 dMax · 들어올 때 칼 축 빠르기 vIn · 걸린 시간 · 충격량 합 · 한 일 · 끝(clear 겹침 없음 / miss / gone) ·
//             깊이가 가장 깊을 때의 칼끝 · 토막 축 빠르기 · 코등이(칼자루) · 팔이 상대 몸에 닿았나 · 꿰뚫음 길이 Lexit · 그 동안 칼날이 상대의 다른 토막에 엔진 닿음으로 받은 충격량
//   check = 정직 검산: pierceStep 이 건 충격량 쌍의 합 |ΣJ| · 원점 둘레 토크 합 |Στ| 의 가장 큰 값 · 끝난 스텝의 겹침(가장 깊은 contactDist) · 되돌린 다음 스텝에 엔진이 그 쌍에 준 충격량
import { pathToFileURL, fileURLToPath } from 'node:url'; import { join, resolve, dirname } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.')); const HERE = dirname(fileURLToPath(import.meta.url));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { makeMeasure, seedList, rng } = await imp('tools/sim/wb_measure.mjs');
const THREE = await imp('node_modules/three/build/three.module.js'); const CM = await imp('src/combat.js'); const { Combat } = CM; const PIERCE = CM.PIERCE ?? null;
const { runLunge } = await import(pathToFileURL(join(HERE, '../r33/lunge_lib.mjs')).href);
const M = makeMeasure(H); const DT = H.DT;
const SCENE = String(args.scene ?? 'lunge'); const WS = String(args.w ?? 'rapier,longsword').split(',');
if (PIERCE) { if (args.fp != null) PIERCE.FP = +args.fp; if (args.ff != null) PIERCE.FF = +args.ff; }
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // r36/rescore.mjs 와 같음
const r6 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(6));
const tvv = (v) => ({ x: v.x, y: v.y, z: v.z });

let cur = null; let KC = 6 / 7;
const newCur = () => ({ on: false, pairs: [], rows: [], pierces: [], k: 0, chk: { maxSumJ: 0, maxSumT: 0, steps: 0, ends: [], pending: [] } });
const watched = (att, vic) => cur && cur.on && cur.pairs.some(([a, v]) => a === att && v === vic);

// ── 상처 줄 ──
let inPierce = false;
const oS = Combat.prototype.strike; Combat.prototype.strike = function (pr, point, passing) {
  if (!watched(pr.w.fighter, pr.v.fighter)) return oS.call(this, pr, point, passing);
  const cool = pr.v.fighter.hitCooldowns.has(`${pr.w.fighter.index}:${pr.v.part}`);
  const r = oS.call(this, pr, point, passing);
  cur.rows.push({ k: cur.k, att: pr.w.fighter.index, part: pr.v.part, passing: !!passing, cool, pierce: inPierce, type: r?.type ?? null, sev: r6(r?.severity ?? 0), speed: r6(r?.speed ?? null), cat: cool || !r ? 'none' : (r.type === 'stab' || r.type === 'cut') && r.severity > 0 ? 'wound' : 'bruise' });
  return r;
};

// ── 칼끝 장부 ──
function engineJ(world, colsA, colB) { // 엔진이 그 쌍에 이 스텝 준 법선 충격량 합 (× KC) · 가장 깊은 contactDist
  let J = 0, dmin = Infinity;
  for (const a of colsA) world.contactPair(a, colB, (m) => { for (let q = 0, n = m.numContacts(); q < n; q++) { const j = m.contactImpulse(q); if (j > 0) J += j * KC; dmin = Math.min(dmin, m.contactDist(q)); } });
  return { J, dmin };
}
if (PIERCE) {
  const oPS = Combat.prototype.pierceStep; const oPE = Combat.prototype.pierceEnd;
  Combat.prototype.pierceStep = function (world, p, dt) {
    const att = p.pr.w.fighter, vic = p.pr.v.fighter;
    if (!watched(att, vic)) return oPS.call(this, world, p, dt);
    if (!p.__rec) { p.__rec = { scene: cur.meta, att: att.index, part: p.pr.v.part, kOpen: cur.k, entered: false, pierced: false, vIn: null, dMax: 0, Jsum: 0, W: 0, Jother: 0, peak: null, trace: [] }; cur.pierces.push(p.__rec); }
    const sw = p.pr.w.body, vb = p.pr.v.body; const applied = [];
    const wrap = (rb) => { const o = rb.applyImpulseAtPoint; rb.applyImpulseAtPoint = function (J, P, w) { applied.push({ J: tvv(J), P: tvv(P) }); return o.call(this, J, P, w); }; return () => { rb.applyImpulseAtPoint = o; }; };
    const u1 = wrap(sw), u2 = wrap(vb); const wasEntered = p.entered; inPierce = true;
    try { oPS.call(this, world, p, dt); } finally { inPierce = false; u1(); u2(); }
    const R = p.__rec;
    if (applied.length) { // 쌍의 합 · 원점 둘레 토크 합
      const sJ = { x: 0, y: 0, z: 0 }, sT = { x: 0, y: 0, z: 0 };
      for (const a of applied) { sJ.x += a.J.x; sJ.y += a.J.y; sJ.z += a.J.z; sT.x += a.P.y * a.J.z - a.P.z * a.J.y; sT.y += a.P.z * a.J.x - a.P.x * a.J.z; sT.z += a.P.x * a.J.y - a.P.y * a.J.x; }
      cur.chk.maxSumJ = Math.max(cur.chk.maxSumJ, Math.hypot(sJ.x, sJ.y, sJ.z)); cur.chk.maxSumT = Math.max(cur.chk.maxSumT, Math.hypot(sT.x, sT.y, sT.z)); cur.chk.steps++;
      if (applied.length !== 2) cur.chk.oddSteps = (cur.chk.oddSteps ?? 0) + 1;
    }
    if (p.entered && !wasEntered) { R.entered = true; R.k0 = cur.k; R.Lexit = r6(p.Lexit); }
    if (p.entered && p.end == null) {
      if (R.vIn == null) R.vIn = r6(p.s);
      R.trace.push([cur.k - R.k0, r6(p.d), r6(p.s), r6(p.J)]);
      if (p.pierced && !R.pierced) { R.pierced = true; R.kPierce = cur.k - R.k0; }
      // 다른 토막과의 엔진 닿음 (같은 칼날 ↔ 상대의 다른 토막)
      const blades = att.swordColliders.filter((c) => this.info.get(c.handle)?.part === 'blade');
      for (const name in vic.bodies) { const rb = vic.bodies[name]; if (rb === vb) continue; R.Jother += engineJ(world, blades, rb.collider(0)).J; }
      if (p.d >= R.dMax) { // 가장 깊을 때의 몸
        const u = p.ub.clone().applyQuaternion((() => { const q = vb.rotation(); return new THREE.Quaternion(q.x, q.y, q.z, q.w); })());
        const va = sw.linvel(), vv = vb.linvel(); const hilts = att.swordColliders.filter((c) => this.info.get(c.handle)?.part !== 'blade');
        let hilt = 0, arm = 0; for (const name in vic.bodies) { const c = vic.bodies[name].collider(0); hilt += engineJ(world, hilts, c).J; arm += engineJ(world, [att.bodies.farmS.collider(0), att.bodies.uarmS.collider(0)], c).J; }
        const pp = att.bodies.pelvis.linvel();
        R.dMax = r6(p.d); R.peak = { dk: cur.k - R.k0, swAx: r6(va.x * u.x + va.y * u.y + va.z * u.z), vicAx: r6(vv.x * u.x + vv.y * u.y + vv.z * u.z), attPelvisAx: r6(pp.x * u.x + pp.y * u.y + pp.z * u.z), hiltJ: r6(hilt), armJ: r6(arm) };
      }
    }
    R.Jsum = r6(p.Jsum); R.W = r6(p.W);
  };
  Combat.prototype.pierceEnd = function (p, why) {
    oPE.call(this, p, why);
    const R = p.__rec; if (!R || !cur) return;
    R.end = why; R.dur = r6(R.entered ? (cur.k - R.k0) * DT : 0); R.Jother = r6(R.Jother); R.strike = p.strike ? { type: p.strike.type, sev: r6(p.strike.severity) } : null;
    const att = p.pr.w.fighter; const blades = att.swordColliders.filter((c) => this.info.get(c.handle)?.part === 'blade'); const world = cur.G.world; const vcol = world.getCollider(p.pr.vc);
    const e = engineJ(world, blades, vcol); R.endDist = r6(Number.isFinite(e.dmin) ? e.dmin : null);
    if (R.entered) cur.chk.pending.push({ R, blades, vcol, k: cur.k });
  };
}

function attach(G, pairs) {
  const nIter = G.world.integrationParameters?.numSolverIterations ?? 4; KC = nIter / (nIter + 1); cur.G = G;
  const C = G.combat; const oAS = C.afterStep.bind(C);
  C.afterStep = function (world, eq) {
    oAS(world, eq);
    if (cur?.on) { // 되돌린 다음 스텝: 엔진이 그 쌍에 준 충격량
      const keep = [];
      for (const x of cur.chk.pending) { if (x.k >= cur.k) { keep.push(x); continue; } const e = engineJ(world, x.blades, x.vcol); x.R.restoreJ = r6(e.J); x.R.restoreDist = r6(Number.isFinite(e.dmin) ? e.dmin : null); }
      cur.chk.pending = keep;
    }
    if (cur) cur.k++;
  };
}

const out = { scene: SCENE, root: ROOT, pierce: PIERCE ? { ...PIERCE } : null, runs: [] };
const pushRun = (o) => { for (const R of cur.pierces) delete R.scene; out.runs.push({ ...o, chk: { maxSumJ: cur.chk.maxSumJ, maxSumT: cur.chk.maxSumT, steps: cur.chk.steps, oddSteps: cur.chk.oddSteps ?? 0 }, rows: cur.rows, pierces: cur.pierces }); };
if (SCENE === 'lunge' || SCENE === 'near') {
  const seeds = seedList(args.seeds ?? (SCENE === 'lunge' ? '7001-7020,8001-8020' : '7001-7040')); const ADDS = String(args.adds ?? '0.3,0.45').split(',').map(Number); const WALK = +(args.walk ?? 0.6);
  for (const W of WS) for (const add of SCENE === 'lunge' ? ADDS : [null]) for (const s of seeds) {
    cur = newCur(); cur.meta = { W, add, seed: s };
    const onTap = (G, P, E) => { cur.pairs = [[P, E]]; attach(G, cur.pairs); cur.on = true; cur.k = 0; };
    let r;
    if (SCENE === 'lunge') r = runLunge(M, H, s, W, { gap: BODY.reach[W] + BODY.front + add, walk: WALK, post: 2.0, wb: true, onTap });
    else { const R = rng(s * 7 + 1); let gn = null; for (const w of ['rapier', 'longsword']) { for (let q = 0; q < 3; q++) R(); const g0 = BODY.reach[w] + BODY.front - (0.05 + 0.30 * R()); if (w === W) gn = g0; }
      const rr = M.runThrust(s, W, { gap: gn, pelvisGap: gn, post: 3.2, wb: true, onTap }); r = rr[0] ?? null; }
    if (cur.on) pushRun({ W, add, seed: s, hit: !!r?.hit });
    cur = null;
  }
} else if (SCENE === 'fight') {
  const seeds = seedList(args.seeds ?? '1-6'); const secs = +(args.secs ?? 30);
  for (const W of WS) for (const s of seeds) {
    const G = H.newRound({ walls: true, seed: s, weapon: W, weapon2: W, AI2Class: H.AI }); cur = newCur(); cur.meta = { W, seed: s }; cur.pairs = [[G.player, G.enemy], [G.enemy, G.player]]; attach(G, cur.pairs); cur.on = true;
    for (let i = 0; i < Math.round(secs / DT); i++) G.step();
    pushRun({ W, seed: s }); M.freeWorld(G); cur = null;
  }
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
const np = out.runs.reduce((a, r) => a + r.pierces.filter((x) => x.entered).length, 0); const nw = out.runs.reduce((a, r) => a + r.rows.filter((x) => x.cat === 'wound').length, 0);
console.log(`${SCENE} · FP ${PIERCE?.FP ?? '-'} · FF ${PIERCE?.FF ?? '-'} · 판 ${out.runs.length} · 칼끝 든 수 ${np} · 상처 줄 ${nw} · |ΣJ| 최대 ${Math.max(0, ...out.runs.map((r) => r.chk.maxSumJ)).toExponential(2)}`);
