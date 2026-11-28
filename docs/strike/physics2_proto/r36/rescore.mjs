// r36 찌르기 상처 셈 세 갈래 — 재기 대본 (읽기만: 원래 함수를 감싸 값을 적을 뿐 · 몸에 힘 · 자리 · 빠르기를 걸지 않음 · 엔진의 닿음 정보는 읽기만)
//  node rescore.mjs --root=<칸> --scene=lunge|near|fight|check [--w=rapier,longsword] [--seeds=7001-7020] [--adds=0.3,0.45] [--walk=0.6] [--json=파일]
//   lunge = r33/lunge_lib.mjs runLunge (r33/lunge_hits.mjs 와 같은 간격 · 걸음 0.6 s · 탭 뒤 2 s)
//   near  = tools/sim/wb_gate.mjs 의 가까운 사람 길 탭 (같은 난수 차례: rng(s*7+1) · 무기 rapier → longsword · 먼 간격 셋 뽑은 뒤 가까운 간격 하나 · runThrust post 3.2)
//   fight = AI 대 AI (H.newRound AI2Class · walls) --secs 동안 · 두 몸 모두 공격자로 적음
//   check = 엔진 닿는 충격량 읽기 검산 (서 있는 몸의 발-땅 법선 충격량 합 ÷ 시간 ÷ 몸무게)
//  한 줄 = combat.strike 가 공격자의 칼 → 상대 몸 토막으로 불린 한 번. ① 게임 값 + 판정 식 다시 셈(검산) · 그 순간 몸 · ③ 용 닿음 토막(episode) 번호.
//  닿음 토막(③) = 같은 상대 몸 토막에 공격자 칼(모든 칼 콜라이더)이 주는 충격량(엔진 닿음 법선 충격량 × KC + combat.afterStep 이 그 토막에 건 끌림 · 박힘 충격량)이 0 이 아닌 스텝이
//   0.1 s(12 스텝) 넘게 끊기기 전까지. 첫 스텝부터 T = 0.025 · 0.05 · 0.1 s 창으로 더함.
import { pathToFileURL } from 'node:url'; import { join, resolve, dirname } from 'node:path'; import { writeFileSync } from 'node:fs'; import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.')); const HERE = dirname(fileURLToPath(import.meta.url));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { makeMeasure, seedList, rng } = await imp('tools/sim/wb_measure.mjs');
const { Combat, stepMassOf, bladeWeight } = await imp('src/combat.js'); const THREE = await imp('node_modules/three/build/three.module.js');
const { STRIKE, ANATOMY } = await imp('src/config.js'); const { fingerCutK } = await imp('src/finger_cut.js'); const { itThrust } = await imp('src/italian_outbox.js');
const { runLunge } = await import(pathToFileURL(join(HERE, '../r33/lunge_lib.mjs')).href);
const M = makeMeasure(H); const DT = H.DT;
const SCENE = String(args.scene ?? 'lunge'); const WS = String(args.w ?? 'rapier,longsword').split(',');
const WIN = [0.025, 0.05, 0.1].map((T) => Math.round(T / DT)); const GAPK = Math.round(0.1 / DT);
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // r33/lunge_hits.mjs · tools/sim/wb_gate.mjs BODY 와 같음
const ARM_L = 0.565; // [어림] fighter.js partDefs: 어깨(uarmS -0.15) → 팔꿈치(uarmS +0.15 · farmS -0.135) → 손(farmS +0.13 · harness handPos) = 0.30 + 0.265 m
const Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3(1, 0, 0);
const v3 = (o) => new THREE.Vector3(o.x, o.y, o.z);
const velAt = (st, p) => v3(p).sub(st.com).cross(st.w).negate().add(st.v); // combat.js 129 velAt 그대로
function freeMass(props, S, point, n) { // combat.js 1146 freeMass 그대로
  if (!props) return 0.5; const { m, I, frame } = props; const fq = S.q.clone().multiply(frame).invert();
  const rn = point.clone().sub(S.com).cross(n).applyQuaternion(fq); return 1 / (1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / I.z);
}
const r6 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(6));

// ── ① 판정 식 다시 셈 (combat.js analyze 290 ~ 470 · 옮기지 못한 갈래는 게임 값 g 를 받아 씀) ──
function reAnalyze(pr, point, S, P, g) {
  const att = pr.w.fighter, vic = pr.v.fighter, cfg = att.weaponCfg;
  const rel = velAt(S, point).sub(velAt(P, point)); const speed = rel.length(); // 286 ~ 289
  if (speed < 0.5) return { none: 'slow' };
  const dir = rel.clone().divideScalar(speed);
  const axis = Y.clone().applyQuaternion(S.q), edge = X.clone().applyQuaternion(S.q); // 296 ~ 297
  const local = point.clone().sub(S.p).applyQuaternion(S.q.clone().invert()); const t = THREE.MathUtils.clamp((local.y - cfg.hiltLength) / cfg.bladeLength, 0, 1); // 299 ~ 300
  const isBlade = pr.w.part === 'blade' && local.y > cfg.hiltLength - 0.01 && cfg.edged && !att.weaponBroken; // 302 (부러진 칼 BREAK.stubEdge 는 옮기지 않음 — 이 장면에 없음)
  const mFree = freeMass(pr.w.props || att.swordProps, S, point, dir); // 306
  const itk = itThrust(att, vic); const hk = (att.secretHit ?? 1) * fingerCutK(att, 'hit') * (itk ? itk.k : 1); // 322 ~ 323
  const physK = hk > 0 && hk < 1 ? 1 / hk : 1; // 328
  const along = rel.dot(axis) / speed; const ts = cfg.thrustStyle; const win = ts ? ts.window : 0; // 333 ~ 335
  let geom = 'blunt', mUsed = mFree + STRIKE.armAssist, quality = 1, push = false, bw = 1, mStep = 0;
  if (isBlade && along > STRIKE.stabAlign - win && t > 0.8 - win) { geom = 'stab'; push = !!att.skill?.thrustPush && (att.state === 'stand' || att.state === 'kneel'); if (push) mUsed = mFree + STRIKE.thrustAssist; } // 342 ~ 357
  else if (isBlade) { const perp = rel.clone().addScaledVector(axis, -rel.dot(axis)); const pl = perp.length(); const ea = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0; // 359 ~ 362
    if (ea > STRIKE.edgeAlign) { geom = 'cut'; quality = 0.4 + 0.6 * ((ea - STRIKE.edgeAlign) / (1 - STRIKE.edgeAlign)); mStep = stepMassOf(att, vic); mUsed += mStep; bw = bladeWeight(t); } } // 363 ~ 377
  const ephysUsed = 0.5 * mUsed * speed * speed; // 실제 에너지 (찌르기면 팔 몫이 실린 값)
  // 문턱 (395 ~ 437): 투구 · 판금이 없는 몸이면 옮김(옷 guard · 찌르기 틈 gap), 있으면 게임 값
  const zone = g?.zone; const body = zone !== 'head' && zone !== 'neck'; let thrRe = null, thrSrc = 'game';
  if (geom !== 'blunt' && zone && !g.helmet && !g.plate && !cfg.ignoreArmor && !cfg.ignoreArmorDamage) {
    let guard = body ? 0.55 + 0.45 * (vic.cloth[pr.v.part] ?? 1) : 1;
    if (geom === 'stab' && ts?.gap && body) guard -= ts.gap * Math.max(0, guard - 0.55); // 434 ~ 437 (imbroccata 갈래는 옮기지 않음 — 탭 찌르기)
    thrRe = (geom === 'cut' ? ANATOMY[zone].cut : ANATOMY[zone].stab) * guard; thrSrc = 're';
  }
  const emo = (att.emoMods?.dealt ?? 1) * (vic.emoMods?.taken ?? 1);
  const power = cfg.power * (att.weapon?.woundRage || att.weapon?.duelOneHand ? NaN : 1); // 와신상담 · 결투 칼은 옮기지 않음 (이 무기들엔 없음)
  const wMult = geom === 'blunt' ? null : power * (geom === 'cut' ? cfg.mCut : cfg.mThrust); // 456
  const fin = g?.finishPower ?? 1;
  const K = geom === 'blunt' ? null : STRIKE.energyScale * hk * (geom === 'cut' ? bw : 1) * quality * wMult * emo * fin; // eff = ephysUsed × K (324 · 344 · 377 · 462 ~ 463)
  const eff = K == null ? null : ephysUsed * K; const thr = thrRe ?? g?.thr ?? null;
  // 멍으로 바뀌었을 때의 에너지 (475 ~ 479 · 488): 팔 몫 · 걸음 몫 · 칼날 자리 무게를 뺀 값 × 공격력 × mBlunt × 감정
  const Eblunt = 0.5 * (mFree + STRIKE.armAssist) * speed * speed * STRIKE.energyScale * hk * power * cfg.mBlunt * emo;
  return { speed, mFree, along, t, isBlade, geom, push, mUsed, ephysUsed, hk, physK, K, eff, thr, thrSrc, Eblunt, wMult, quality, mStep, axis, dir, zone };
}
// 다시 셈의 분류: eff > thr 면 상처(세기 (eff − thr)/60 · 베기 /90 × 뒤 배율 postK), 아니면 멍 에너지 Eb · 판정 문턱 STRIKE.minEnergy (strike 986)
function classify(eff, thr, geom, Eb, physK, energyStab, postK = 1) {
  if (geom !== 'blunt' && eff > thr) { if (energyStab * physK < STRIKE.minEnergy) return { cat: 'none', sev: 0 }; return { cat: 'wound', sev: ((eff - thr) / (geom === 'cut' ? 90 : 60)) * postK }; }
  return Eb * physK >= STRIKE.minEnergy ? { cat: 'bruise', sev: 0, Eb } : { cat: 'none', sev: 0 };
}

// ── 감싸기 ──
let cur = null; // 지금 판의 기록 { pairs: [[att, vic]], rows, eps, k, ... }
const oA = Combat.prototype.analyze; Combat.prototype.analyze = function (pr, point, S, P, predicting) { const r = oA.call(this, pr, point, S, P, predicting); if (cur?.inStrike) { cur.lastA = { pr, point: point.clone(), S, P, r }; } return r; };
const oS = Combat.prototype.strike; Combat.prototype.strike = function (pr, point, passing) {
  const watch = cur && cur.on && cur.pairs.some(([a, v]) => a === pr.w.fighter && v === pr.v.fighter);
  if (!watch) return oS.call(this, pr, point, passing);
  const cool = pr.v.fighter.hitCooldowns.has(`${pr.w.fighter.index}:${pr.v.part}`);
  cur.inStrike = true; cur.lastA = null; let r; try { r = oS.call(this, pr, point, passing); } finally { cur.inStrike = false; }
  const A = cur.lastA; cur.rows.push(makeRow(pr, point, passing, cool, A, r)); return r;
};
function bodyState(att, vic, S) { // 그 순간의 몸 (스텝 전 상태 — combat 이 쓰는 cache)
  const c = att.cache; let Mm = 0; const Pm = new THREE.Vector3();
  for (const name in att.bodies) { const rb = att.bodies[name], st = c?.parts?.[name]; if (!st) continue; const m = rb.mass(); Mm += m; Pm.addScaledVector(st.v, m); }
  if (c?.sword) { const m = att.sword.mass(); Mm += m; Pm.addScaledVector(c.sword.v, m); }
  const comV = Pm.divideScalar(Mm); const axis = Y.clone().applyQuaternion(S.q);
  const tip = S.p.clone().addScaledVector(axis, att.weaponCfg.hiltLength + att.weaponCfg.bladeLength); const tipV = velAt(S, tip);
  const pp = att.bodies.pelvis.translation(), ep = vic.bodies.pelvis.translation(); const ux = ep.x - pp.x, uz = ep.z - pp.z, ul = Math.hypot(ux, uz);
  const ua = att.bodies.uarmS, fa = att.bodies.farmS; const sh = new THREE.Vector3(-0.15, 0, 0).applyQuaternion(v3q(ua.rotation())).add(v3(ua.translation())); const hand = new THREE.Vector3(0.13, 0, 0).applyQuaternion(v3q(fa.rotation())).add(v3(fa.translation()));
  return { tipV: tipV.length(), tipAx: tipV.dot(axis), comAx: comV.dot(axis), comTo: (comV.x * ux + comV.z * uz) / ul, arm: sh.distanceTo(hand) / ARM_L, push: !!att.skill?.thrustPush, state: att.state, tapT: att.skill?.tap?.t ?? null };
}
const v3q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
function makeRow(pr, point, passing, cool, A, r) {
  const att = pr.w.fighter, vic = pr.v.fighter; const g = A?.r ?? null;
  const row = { k: cur.k, att: att.index, part: pr.v.part, wpart: pr.w.part, passing: !!passing, cool, analyzed: !!A, judged: !cool && !!r, traded: !!r?.traded };
  if (g) Object.assign(row, { type: g.type, zone: g.zone, speed: r6(g.speed), mEff: r6(g.mEff), mFree: r6(g.mFree), ephys: r6(g.ephys), energy: r6(g.energy), physE: r6(g.physE ?? null), thr: r6(g.thr), eff: r6(g.eff), sev: r6(g.severity), pass: !!g.pass, t: r6(g.t), helmet: !!g.helmet, plate: !!g.plate });
  row.cat = cool || !r ? 'none' : (r.type === 'stab' || r.type === 'cut') && r.severity > 0 ? 'wound' : 'bruise'; // ① 게임이 낸 것
  if (A && g) {
    const R = reAnalyze(pr, A.point, A.S, A.P, g);
    if (!R.none) {
      const energyStab = R.ephysUsed * STRIKE.energyScale * R.hk; const postK = g.severity > 0 && g.eff > g.thr ? g.severity / ((g.eff - g.thr) / (R.geom === 'cut' ? 90 : 60)) : 1;
      const C1 = cool ? { cat: 'none' } : classify(R.eff, R.thr, R.geom, R.Eblunt, R.physK, energyStab, postK);
      const B = bodyState(att, vic, A.S);
      Object.assign(row, { re: { geom: R.geom, push: R.push, speed: r6(R.speed), mFree: r6(R.mFree), mUsed: r6(R.mUsed), ephysUsed: r6(R.ephysUsed), K: r6(R.K), eff: r6(R.eff), thr: r6(R.thr), thrSrc: R.thrSrc, Eblunt: r6(R.Eblunt), physK: R.physK, hk: R.hk, postK: r6(postK), cat: C1.cat, sev: r6(C1.sev), along: r6(R.along) }, body: Object.fromEntries(Object.entries(B).map(([k, v]) => [k, typeof v === 'number' ? r6(v) : v])) });
    }
  }
  return row;
}

// ── 닿는 충격량 (엔진 + 판정 코드가 몸 토막에 건 것) ──
let KC = 1; // tools/sim/honesty.mjs · run_scenes.mjs 와 같은 보정 nIter / (nIter + 1) — 검산(--scene=check)으로 확인
function attach(G, pairs) { // pairs = [[att, vic]] · afterStep 을 감싸 스텝마다 읽음
  const nIter = G.world.integrationParameters?.numSolverIterations ?? 4; KC = nIter / (nIter + 1);
  const C = G.combat; const oAS = C.afterStep.bind(C); const gameJ = []; let inAS = false;
  for (const [, vic] of pairs) for (const name in vic.bodies) { const rb = vic.bodies[name]; if (rb.__r36) continue; rb.__r36 = true; const o = rb.applyImpulseAtPoint.bind(rb);
    rb.applyImpulseAtPoint = function (J, Pt, w) { if (inAS && cur?.on) gameJ.push({ vic, part: name, J: v3(J), P: v3(Pt) }); return o(J, Pt, w); }; }
  C.afterStep = function (world, eq) { inAS = true; gameJ.length = 0; try { oAS(world, eq); } finally { inAS = false; } if (cur?.on) readStep(G, pairs, gameJ); cur && cur.k++; };
}
function readStep(G, pairs, gameJ) {
  const k = cur.k;
  for (const [att, vic] of pairs) {
    const SW = att.cache?.sword; if (!SW || !att.armed) continue; const swCols = att.swordColliders;
    for (const name in vic.bodies) {
      const rb = vic.bodies[name]; const PS = vic.cache?.parts?.[name]; if (!PS) continue;
      const Jv = new THREE.Vector3(); let Jeng = 0; const Pw = new THREE.Vector3(); let wsum = 0; const parts = []; // 이 스텝 이 토막
      for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) { const col = rb.collider(ci); const ct = v3(col.translation()), cq = v3q(col.rotation());
        for (const sc of swCols) G.world.contactPair(col, sc, (m, flipped) => { const n = m.normal(), sg = flipped ? 1 : -1; // 힘의 몫 = 첫 콜라이더(몸 토막)에 걸린 쪽 (honesty.mjs 와 같은 꼴)
          for (let q = 0, nk = m.numContacts(); q < nk; q++) { const jn = m.contactImpulse(q) * KC; if (!(jn > 0)) continue; const lp = flipped ? m.localContactPoint2(q) : m.localContactPoint1(q);
            const p = lp ? v3(lp).applyQuaternion(cq).add(ct) : ct.clone(); const J = new THREE.Vector3(sg * n.x * jn, sg * n.y * jn, sg * n.z * jn); parts.push({ J, p }); Jeng += jn; } }); }
      let Jg = new THREE.Vector3(); for (const x of gameJ) if (x.vic === vic && x.part === name) { parts.push({ J: x.J, p: x.P, game: true }); Jg.add(x.J); }
      if (!parts.length) continue;
      let W = 0, Wax = 0; const axis = Y.clone().applyQuaternion(SW.q);
      for (const x of parts) { const vr = velAt(SW, x.p).sub(velAt(PS, x.p)); W += x.J.dot(vr); Wax += x.J.dot(axis) * vr.dot(axis); const w = x.J.length(); Jv.add(x.J); Pw.addScaledVector(x.p, w); wsum += w; }
      if (wsum > 0) Pw.divideScalar(wsum);
      const key = `${att.index}:${vic.index}:${name}`; let ep = cur.open[key];
      if (!ep || k - ep.last > GAPK) { const vr = velAt(SW, Pw).sub(velAt(PS, Pw)); const un = Jv.clone().normalize();
        ep = cur.open[key] = { id: cur.eps.length, att: att.index, part: name, k0: k, last: k, vn: r6(vr.dot(un)), vax: r6(vr.dot(axis)), vrel: r6(vr.length()), un, steps: [] }; cur.eps.push(ep); }
      ep.last = k;
      if (k - ep.k0 < WIN[2]) ep.steps.push({ dk: k - ep.k0, Jn: r6(Jv.dot(ep.un)), Jax: r6(Jv.dot(axis)), Jmag: r6(Jv.length()), Jeng: r6(Jeng), Jgame: r6(Jg.length()), W: r6(W), Wax: r6(Wax) });
    }
  }
}
function finishEps() { return cur.eps.map(({ un, ...e }) => { const w = WIN.map((n) => { const s = e.steps.filter((x) => x.dk < n); const sum = (key) => s.reduce((a, x) => a + (x[key] ?? 0), 0); return { n, Jn: r6(sum('Jn')), Jax: r6(sum('Jax')), Jeng: r6(sum('Jeng')), Jgame: r6(sum('Jgame')), W: r6(sum('W')), Wax: r6(sum('Wax')) }; });
  const mags = e.steps.map((x) => x.Jmag).filter((x) => x > 0).sort((a, b) => a - b); const spike = mags.length ? mags[mags.length - 1] / mags[mags.length >> 1] : null;
  return { ...e, win: w, spike: r6(spike), nSteps: e.steps.length, steps: undefined, stepJ: e.steps.map((x) => [x.dk, x.Jn, x.Jeng, x.Jgame]) }; }); }
function linkRows() { for (const r of cur.rows) { const c = cur.eps.filter((e) => e.att === r.att && e.part === r.part && r.k >= e.k0 - 2 && r.k <= e.last + 1); r.ep = c.length ? c[c.length - 1].id : null; } }

// ── 장면 ──
const out = { scene: SCENE, root: ROOT, KC: null, runs: [] };
const newCur = () => ({ on: false, pairs: [], rows: [], eps: [], open: {}, k: 0, inStrike: false, lastA: null });
if (SCENE === 'check') {
  // 서 있는 몸: runThrust 의 겨눔 · 고요 (탭 없이) — 고요 0.4 ~ 0.8 s 의 땅 → 몸 법선 충격량 합 ÷ 시간 ÷ (몸 + 칼 무게 × g)
  const res = [];
  for (const s of seedList(args.seeds ?? '7001-7004')) for (const W of WS) {
    const G = H.newRound({ walls: false, gap: 3, seed: s, weapon: W, weapon2: 'longsword' }); G.ai.update = () => {}; const P = G.player; G.park();
    const nIter = G.world.integrationParameters.numSolverIterations; const kc = nIter / (nIter + 1); let Jy = 0, Jyraw = 0, n = 0, mass = 0;
    for (const name in P.bodies) mass += P.bodies[name].mass(); mass += P.sword.mass();
    for (let i = 0; i < Math.round(2.0 / DT); i++) { P.move.set(0, 0); G.step(); if (i < Math.round(1.2 / DT)) continue; n++;
      for (const name in P.bodies) { const rb = P.bodies[name]; for (let ci = 0; ci < rb.numColliders(); ci++) { const col = rb.collider(ci); G.world.contactPairsWith(col, (o) => { if (!o.parent()?.isFixed()) return; G.world.contactPair(col, o, (m, fl) => { const nn = m.normal(), sg = fl ? 1 : -1; for (let q = 0; q < m.numContacts(); q++) { Jyraw += sg * nn.y * m.contactImpulse(q); } }); }); } } }
    const T = n * DT; res.push({ seed: s, W, nIter, kc, mass: r6(mass), ratioKC: r6((Jyraw * kc) / T / (mass * 9.81)), ratioRaw: r6(Jyraw / T / (mass * 9.81)), T });
    M.freeWorld(G);
  }
  out.check = res; console.log(JSON.stringify(res));
} else if (SCENE === 'lunge' || SCENE === 'near') {
  const seeds = seedList(args.seeds ?? '7001-7020'); const ADDS = String(args.adds ?? '0.3,0.45').split(',').map(Number); const WALK = +(args.walk ?? 0.6);
  for (const W of WS) for (const add of SCENE === 'lunge' ? ADDS : [null]) for (const s of seeds) {
    cur = newCur(); let tapInfo = null;
    const onTap = (G, P, E) => { cur.pairs = [[P, E]]; attach(G, cur.pairs); cur.on = true; cur.k = 0; const p = P.bodies.pelvis.translation(), e = E.bodies.pelvis.translation(); tapInfo = { gapTap: r6(Math.hypot(e.x - p.x, e.z - p.z)) }; };
    let r;
    if (SCENE === 'lunge') r = runLunge(M, H, s, W, { gap: BODY.reach[W] + BODY.front + add, walk: WALK, post: 2.0, wb: true, onTap });
    else { // wb_gate.mjs runSeed 의 난수 차례 그대로: R = rng(s*7+1) · WEAPONS = rapier, longsword 차례 · 무기마다 farGap 셋(R() 하나씩) → nearGap(R() 하나)
      const R = rng(s * 7 + 1); let gn = null; for (const w of ['rapier', 'longsword']) { for (let q = 0; q < 3; q++) R(); const g0 = BODY.reach[w] + BODY.front - (0.05 + 0.30 * R()); if (w === W) gn = g0; }
      const rr = M.runThrust(s, W, { gap: gn, pelvisGap: gn, post: 3.2, wb: true, onTap }); r = rr[0] ?? null; if (r) r.gapSet = r6(gn); }
    if (cur.on) { linkRows(); out.runs.push({ W, add, seed: s, ok: !!r, hit: !!r?.hit, tHit: r?.tHit ?? null, ...tapInfo, rows: cur.rows, eps: finishEps() }); }
    cur = null;
  }
} else if (SCENE === 'fight') {
  const seeds = seedList(args.seeds ?? '1-6'); const secs = +(args.secs ?? 30);
  for (const W of WS) for (const s of seeds) {
    const G = H.newRound({ walls: true, seed: s, weapon: W, weapon2: W, AI2Class: H.AI }); cur = newCur(); cur.pairs = [[G.player, G.enemy], [G.enemy, G.player]]; attach(G, cur.pairs); cur.on = true;
    for (let i = 0; i < Math.round(secs / DT); i++) G.step();
    M.freeWorld(G); linkRows(); out.runs.push({ W, seed: s, rows: cur.rows, eps: finishEps() }); cur = null;
  }
}
out.KC = KC;
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
const nr = out.runs.reduce((a, r) => a + r.rows.length, 0); console.log(`${SCENE} · 판 ${out.runs.length} · 판정 줄 ${nr} · 닿음 토막 ${out.runs.reduce((a, r) => a + r.eps.length, 0)} · KC ${KC.toFixed(4)}`);
