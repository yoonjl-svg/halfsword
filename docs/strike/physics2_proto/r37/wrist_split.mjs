// r37 진단 — 칼을 돌리는 토크는 어디서 오나 (재기만 — 몸에 힘 · 자리 · 빠르기를 걸지 않음 · 원래 함수를 감싸 값을 적을 뿐)
//  node wrist_split.mjs --root=<나무> --out=<폴더> --scene=hcut|hthrust|ai|stand [--w=longsword,zweihander,rapier] [--seeds=4001-4020] [--secs=30] [--hon=1] [--tag=이름]
//   스텝마다 칼(강체)에 걸린 토크를 칼 손 손목 점 A(칼 몸 원점 = gripJoint 칼 쪽 닻) 둘레로 가른다:
//    servo = driveSword 안에서 칼에 건 것(손목 서보 · 날 세우기 · 무게 버팀) · off = offHand 안에서 칼자루에 건 힘의 모멘트 (P − A) × F (지렛대)
//    grav = (c − A) × m g · con = 엔진 접촉(법선 충격량 · honesty.mjs readContacts 와 같은 식 — 접선 마찰은 엔진이 안 내줌) · oth = 그 밖에 칼에 건 것(판정 충격 따위) · damp = 감쇠
//    tot = 칼의 각운동량 변화 = I_앞 (ω_뒤 − ω_앞) / dt + (c − A) × m a_c   (엔진은 자이로 항을 안 씀 — honesty.mjs 와 같은 읽기)
//    res = tot − (servo + off + grav + con + oth + damp) = 관절 구속이 A 둘레로 낸 토크 (공 관절 힘은 A 를 지나 0 · 손목 원뿔 밧줄 · 풀이 오차)
//   ① 손목 관절 몫 wr = servo + res (심판의 '전달 토크'에서 지렛대를 뺀 것) · ② 지렛대 몫 lev = off · 심판과 같은 정의 jud = servo + res + off (닿음 없을 때 honesty 의 mHist 와 견줌)
//   검산: 닿음 없고 밧줄 둘 다 느슨한 스텝은 res ≈ 0 이어야 한다 (요약 대본이 |res| ÷ |tot| 를 낸다).
//  장면: hcut = 관문의 사람 베기(wb_measure runCut 을 옮겨 적음 · 무기만 인자 — 장검은 관문 그대로 세로 · 사선 · 세로(둘째) · 가로)
//        hthrust = 관문 가까운 장면 사람 탭 찌르기(wb_measure runThrust 그대로 · 간격 차례는 wb_gate nearGap)
//        ai = AI 대 AI 같은 무기(wb_gate 의 AI 길과 같은 판) · 스텝 이름표: cut(휘두름 · 찌르기 기술 아님) · thrust(탭 또는 찌르기 기술 휘두름) · block(AI mode defend) · idle
//        stand = 서서 겨눈 채 (패드 셋 · 3 s · AI 없음) — 가만히 선 칼 ↔ 명령 어긋남
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, mkdirSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList, rng } = await imp('tools/sim/wb_measure.mjs');
const { attach, hook } = await imp('tools/sim/honesty.mjs');
const THREE = H.THREE; const M = makeMeasure(H); const DT = M.DT;
const OUT = String(args.out ?? '.'); mkdirSync(OUT, { recursive: true });
const seeds = seedList(args.seeds ?? '4001-4020'); const SCENE = String(args.scene ?? 'ai'); const secs = +(args.secs ?? 30);
const WS = String(args.w ?? 'longsword,zweihander,rapier').split(','); const HON = String(args.hon ?? '0') === '1';
const HD = 180 / Math.PI;
const v3 = (o) => new THREE.Vector3(o.x, o.y, o.z), q4 = (o) => new THREE.Quaternion(o.x, o.y, o.z, o.w);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const STICH = M.STICH;
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };

// ── 싸움꾼 하나에 재기 달기 (칼 강체의 힘 부름을 감싸 적음 · 값은 그대로 넘김) ──
function install(f) {
  const sw = f.sword; const R = { tag: 'other', calls: [], placed: false };
  f.__r37 = R;
  for (const [n, t] of [['driveSword', 'servo'], ['offHand', 'off']]) { const o = f[n]; f[n] = function (...a) { const p = R.tag; R.tag = t; try { return o.apply(this, a); } finally { R.tag = p; } }; }
  const o = {}; for (const k of ['addForce', 'addForceAtPoint', 'addTorque', 'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse', 'setLinvel', 'setAngvel', 'setTranslation', 'setRotation']) o[k] = sw[k];
  const com = () => v3(sw.worldCom());
  sw.addForce = function (F, w) { R.calls.push({ tag: R.tag, F: v3(F), P: com() }); return o.addForce.call(this, F, w); };
  sw.addForceAtPoint = function (F, P, w) { R.calls.push({ tag: R.tag, F: v3(F), P: v3(P) }); return o.addForceAtPoint.call(this, F, P, w); };
  sw.addTorque = function (T, w) { R.calls.push({ tag: R.tag, T: v3(T) }); return o.addTorque.call(this, T, w); };
  sw.applyImpulse = function (J, w) { R.calls.push({ tag: R.tag, F: v3(J).multiplyScalar(1 / DT), P: com() }); return o.applyImpulse.call(this, J, w); };
  sw.applyImpulseAtPoint = function (J, P, w) { R.calls.push({ tag: R.tag, F: v3(J).multiplyScalar(1 / DT), P: v3(P) }); return o.applyImpulseAtPoint.call(this, J, P, w); };
  sw.applyTorqueImpulse = function (J, w) { R.calls.push({ tag: R.tag, T: v3(J).multiplyScalar(1 / DT) }); return o.applyTorqueImpulse.call(this, J, w); };
  sw.setLinvel = function (v, w) { R.placed = true; return o.setLinvel.call(this, v, w); };
  sw.setAngvel = function (v, w) { R.placed = true; return o.setAngvel.call(this, v, w); };
  sw.setTranslation = function (t, w) { R.placed = true; return o.setTranslation.call(this, t, w); };
  sw.setRotation = function (q, w) { R.placed = true; return o.setRotation.call(this, q, w); };
  R.prev = snap(f);
}
function snap(f) {
  const sw = f.sword; const q = q4(sw.rotation()); const pf = q4(sw.principalInertiaLocalFrame()); const ip = sw.principalInertia();
  const fq = q4(f.bodies.farmS.rotation());
  return { A: v3(sw.translation()), c: v3(sw.worldCom()), v: v3(sw.linvel()), w: v3(sw.angvel()), m: sw.mass(), q, qi: q.clone().multiply(pf), ip: v3(ip), fq, gs: sw.gravityScale(), ld: sw.linearDamping(), ad: sw.angularDamping() };
}
const Iw = (s, w) => { const qi = s.qi; const wl = w.clone().applyQuaternion(qi.clone().invert()); return new THREE.Vector3(s.ip.x * wl.x, s.ip.y * wl.y, s.ip.z * wl.z).applyQuaternion(qi); };
function swordContacts(f) {
  const W = f.world; const sw = f.sword; const nIter = W.integrationParameters?.numSolverIterations ?? 4, KC = nIter / (nIter + 1); const out = [];
  for (let ci = 0, nc = sw.numColliders(); ci < nc; ci++) { const col = sw.collider(ci);
    W.contactPairsWith(col, (other) => { const ob = other.parent(); if (!ob || ob.handle === sw.handle) return; const ct = v3(col.translation()), cq = q4(col.rotation());
      W.contactPair(col, other, (m, flipped) => { const n = m.normal(), sg = flipped ? 1 : -1;
        for (let k = 0, nk = m.numContacts(); k < nk; k++) { const Jn = m.contactImpulse(k) * KC; if (Jn === 0) continue; const lp = flipped ? m.localContactPoint2(k) : m.localContactPoint1(k);
          out.push({ F: new THREE.Vector3(sg * n.x, sg * n.y, sg * n.z).multiplyScalar(Jn / DT), P: lp ? v3(lp).applyQuaternion(cq).add(ct) : ct }); } }); }); }
  return out;
}
// ── 한 스텝 가름 (G.step 뒤) ──
function split(f, judgeVal) {
  const R = f.__r37; const a = R.prev, b = snap(f); R.prev = b; const calls = R.calls; R.calls = []; const placed = R.placed; R.placed = false;
  if (!f.sword || !f.armed) return null;
  const A = a.A; const g = new THREE.Vector3(0, f.world.gravity.y * a.gs, 0);
  const sum = { servo: new THREE.Vector3(), off: new THREE.Vector3(), oth: new THREE.Vector3() }; const offF = new THREE.Vector3(); let offP = null; const Flin = new THREE.Vector3();
  for (const c of calls) { const k = c.tag === 'servo' ? 'servo' : c.tag === 'off' ? 'off' : 'oth';
    if (c.T) sum[k].add(c.T); if (c.F) { sum[k].add(c.P.clone().sub(A).cross(c.F)); Flin.add(c.F); if (k === 'off') { offF.add(c.F); offP = c.P; } } }
  const grav = a.c.clone().sub(A).cross(g.clone().multiplyScalar(a.m));
  const cons = swordContacts(f); const con = new THREE.Vector3(); for (const c of cons) con.add(c.P.clone().sub(A).cross(c.F));
  const damp = a.c.clone().sub(A).cross(b.v.clone().multiplyScalar(-a.m * a.ld)).add(Iw(a, b.w).multiplyScalar(-a.ad));
  const tot = Iw(a, b.w.clone().sub(a.w)).multiplyScalar(1 / DT).add(a.c.clone().sub(A).cross(b.v.clone().sub(a.v).multiplyScalar(a.m / DT)));
  const res = tot.clone().sub(sum.servo).sub(sum.off).sub(sum.oth).sub(grav).sub(con).sub(damp);
  const wr = sum.servo.clone().add(res); const jud = wr.clone().add(sum.off); // 판정 충격(oth)은 심판도 짝 없는 밖 힘으로 빼고 잰다
  const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(a.q);
  const Fp = offF.clone().addScaledVector(blade, -offF.dot(blade)).length();
  const dLev = offP ? offP.clone().sub(A).length() : null;
  // 빈손 실제 자리 (offHand 의 hand 와 같은 식: 빈 아래팔 (0, −0.135, 0)) → 칼 손 점까지
  const fo = f.bodies.farmO; const hO = fo ? new THREE.Vector3(0, -0.135, 0).applyQuaternion(q4(fo.rotation())).add(v3(fo.translation())) : null;
  const xF = new THREE.Vector3(1, 0, 0).applyQuaternion(a.fq), zF = new THREE.Vector3(0, 0, 1).applyQuaternion(a.fq), zS = new THREE.Vector3(0, 0, 1).applyQuaternion(a.q);
  const ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * HD;
  const aim = f.aimDirW.clone().normalize(); const sv = sum.servo.length(), ov = sum.off.length();
  const tipP = f.bladePoint(1, new THREE.Vector3()); const tip = v3(f.sword.velocityAtPoint(tipP)).length();
  const cap = f.debug?.wristCap ?? null, wt = f.debug?.wristTorque ? f.debug.wristTorque.length() : null;
  return {
    wr: wr.length(), lev: ov, con: con.length(), grav: grav.length(), oth: sum.oth.length(), res: res.length(), tot: tot.length(), jud: jud.length(), judge: judgeVal,
    srv: sv, F: offF.length(), Fp, d: dLev, dh: hO ? hO.distanceTo(A) : null, grip: !!f.gripping, cap, sat: cap ? wt / cap : null,
    a1: ang(xF, blade), a2: ang(zF, zS), aimSw: ang(aim, blade), tip, nc: cons.length, placed,
    cosSO: sv > 1e-6 && ov > 1e-6 ? sum.servo.dot(sum.off) / (sv * ov) : null, cosWL: wr.length() > 1e-6 && ov > 1e-6 ? wr.dot(sum.off) / (wr.length() * ov) : null,
    sV: sum.servo.toArray().map(r2), oV: sum.off.toArray().map(r2), rV: res.toArray().map(r2), bl: blade.toArray().map(r2),
  };
}
const pack = (x) => (x ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1000) / 1000 : v])) : null);
function judgeOf(LJ, st) { const J = LJ?.joint?.sword; if (!J) return null; const n = J.mHist?.length ?? 0; const r = n > (st.n ?? 0) ? J.mHist[n - 1] : null; st.n = n; return r; }

const rows = [];
// ── 사람 베기 (wb_measure.mjs runCut 을 옮겨 적음 · 무기만 인자 · 같은 난수 차례) ──
function humanCut(seed, cut, weapon, opt) {
  const CUT_PAD = M.CUT_PAD; const R = rng(seed); let a, b, form;
  if (cut === 'horiz') { a = CUT_PAD.SideR; b = CUT_PAD.SideL; form = 'horiz'; } else { const diag = opt.form ? opt.form === 'diag' : R() < 0.5; if (opt.form) R(); a = diag ? CUT_PAD.ShR : CUT_PAD.Tag; b = diag ? CUT_PAD.WechselL : CUT_PAD.Alber; form = diag ? 'diag' : 'vert'; }
  const ch = a.map((v) => v + (R() - 0.5) * 0.08), en = b.map((v) => v + (R() - 0.5) * 0.08); const v = 10 + R() * 4; const gap0 = 1.5 + R() * 0.35;
  class Passive { update() {} }
  const G = H.newRound({ walls: false, weapon, weapon2: 'longsword', seed, AIClass: Passive }); const P = G.player, E = G.enemy;
  P.skill.level = 0.7; P.skill.autoGuard = true;
  const dx = P.pelvisPos.x + gap0 - E.pelvisPos.x; for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z }, true); }
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.handOffset.set(ch[0], ch[1]); P.handHeld = true; P.inputActive = false;
  const line = []; const hits = M.hookHits(G, P, E, () => line.length); const WO = [];
  const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (A === P && Vc === E) WO.push({ i: line.length, type: r.type, E: r.energy, zone: r.zone }); };
  for (let i = 0; i < Math.round(3.5 / DT); i++) { P.move.set(0, 0); E.move.set(0, 0); G.step(); const s = M.sample(P); if (s) line.push(s); }
  const o = line.length; let tEnd = 0; hits.length = 0; WO.length = 0;
  let LP = null; const jst = {}; if (HON) { LP = attach(G.world, bodiesOf(P), { fighter: P }); hook(G, [LP]); }
  install(P); const xs = [];
  for (let k = 0; k < Math.round(opt.post / DT); k++) {
    const off = P.handOffset; const ddx = en[0] - off.x, ddy = en[1] - off.y, d = Math.hypot(ddx, ddy), st = v * DT;
    if (d > st) { off.x += (ddx / d) * st; off.y += (ddy / d) * st; } else if (d > 0) off.set(en[0], en[1]);
    if (d > 0) tEnd = k; P.inputActive = d > 0; P.handHeld = k <= tEnd + Math.round(0.15 / DT);
    P.move.set(0, 0); E.move.set(0, 0); G.step(); const s = M.sample(P); if (!s) break; line.push(s); xs.push(pack(split(P, judgeOf(LP, jst))));
  }
  M.freeWorld(G);
  const r = M.strokeWB(line, o, hits, 'cut'); const t0 = o + Math.round(r.t0rel / 1000 / DT), end = t0 + Math.round(r.tEnd / DT);
  const hitI = r.hit ? t0 + Math.round(r.tHit / DT) : null; const w = hitI != null ? WO.find((x) => x.i === hitI) ?? null : null;
  let iT = t0; for (let i = t0; i <= end; i++) if (line[i].tipSp > line[iT].tipSp) iT = i;
  return { seed, weapon, scene: 'hcut', form, act: 'cut', ...r, wound: w, k0: t0 - o, kEnd: end - o, kTip: iT - o, kHit: hitI != null ? hitI - o : null, steps: xs.slice(0, Math.min(xs.length, end - o + 13)) };
}
// ── 사람 탭 찌르기 (wb_measure runThrust 그대로 · onTap 에서 재기를 닮) ──
function humanThrust(seed, weapon, gap) {
  let P = null, LP = null; const jst = {}; const xs = [];
  const res = M.runThrust(seed, weapon, { gap, pelvisGap: gap, post: 3.2, raw: true,
    onTap: (G, P0) => { P = P0; if (HON) { LP = attach(G.world, bodiesOf(P), { fighter: P }); hook(G, [LP]); } install(P); },
    onStep: () => { xs.push(pack(split(P, judgeOf(LP, jst)))); } });
  if (!res.ok) return null; const { line, o, hits } = res; const r = M.strokeWB(line, o, hits, 'thrust');
  const t0 = o + Math.round(r.t0rel / 1000 / DT), end = t0 + Math.round(r.tEnd / DT); let iT = t0; for (let i = t0; i <= end; i++) if (line[i].tipSp > line[iT].tipSp) iT = i;
  // xs[0] = 탭 뒤 첫 스텝 = line[o]
  return { seed, weapon, scene: 'hthrust', act: 'thrust', ...r, k0: t0 - o, kEnd: end - o, kTip: iT - o, kHit: r.hit ? t0 - o + Math.round(r.tHit / DT) : null, steps: xs.slice(0, Math.min(xs.length, end - o + 13)) };
}
// ── 서서 겨눔 (가만히 선 칼 ↔ 명령) ──
function stand(seed, weapon, pad) {
  class Passive { update() {} }
  const G = H.newRound({ walls: false, weapon, weapon2: 'longsword', seed, AIClass: Passive }); const P = G.player, E = G.enemy;
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.skill.level = 0.7; P.skill.autoGuard = true; M.setHand(P, pad); P.handHeld = !!args.held; P.inputActive = false;
  install(P); const xs = [];
  for (let i = 0; i < Math.round(3.0 / DT); i++) { P.move.set(0, 0); E.move.set(0, 0); G.step(); const x = split(P, null); if (i >= Math.round(2.0 / DT)) xs.push(pack(x)); }
  const idle = P.bodyPose?.idle ?? null; M.freeWorld(G);
  return { seed, weapon, scene: 'stand', act: 'stand', pad, idle, steps: xs };
}

if (SCENE === 'hcut') {
  for (const w of WS) for (const s of seeds) {
    rows.push(humanCut(s, 'desc', w, { form: 'vert', post: 3.5 })); rows.push(humanCut(s, 'desc', w, { form: 'diag', post: 3.5 }));
    { const x = humanCut(s + 100000, 'desc', w, { form: 'vert', post: 3.5 }); x.seed = s; x.rep = 1; rows.push(x); }
    rows.push(humanCut(s, 'horiz', w, { post: 3.5 }));
    process.stderr.write(`hcut ${w} ${s}\n`);
  }
} else if (SCENE === 'hthrust') {
  const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // wb_gate.mjs BODY 와 같음
  for (const s of seeds) { const R = rng(s * 7 + 1); for (const w of ['rapier', 'longsword']) { for (let k = 0; k < 3; k++) R(); const gn = BODY.reach[w] + BODY.front - (0.05 + 0.30 * R()); if (!WS.includes(w)) continue;
    const x = humanThrust(s, w, gn); if (x) rows.push(x); }
    process.stderr.write(`hthrust ${s}\n`); }
} else if (SCENE === 'stand') {
  const PADS = String(args.pads ?? '0.18,-0.28;0.22,0.26;0,0.03;0,-0.5').split(';').map((p) => p.split(',').map(Number));
  for (const w of WS) for (const s of seeds) for (const p of PADS) rows.push(stand(s, w, p));
} else {
  for (const w of WS) for (const s of seeds) {
    const G = H.newRound({ walls: true, seed: s, weapon: w, weapon2: w, AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
    const F = [G.player, G.enemy];
    let LP = null, LE = null; if (HON) { LP = attach(G.world, bodiesOf(G.player), { fighter: G.player }); LE = attach(G.world, bodiesOf(G.enemy), { fighter: G.enemy }); LP.foe = LE; LE.foe = LP; hook(G, [LP, LE]); }
    const LJ = new Map([[G.player, LP], [G.enemy, LE]]); const JS = new Map(F.map((f) => [f, {}]));
    for (const f of F) install(f);
    const X = new Map(F.map((f) => [f, []])); const dead = new Set();
    for (let k = 0; k < Math.round(secs / DT); k++) {
      G.step();
      for (const f of F) { if (dead.has(f)) continue; if (!f.alive || !f.sword) { dead.add(f); continue; }
        const x = split(f, judgeOf(LJ.get(f), JS.get(f))); const ai = ais.get(f); const tn = ai?.tech?.name ?? null; const sk = f.skill;
        const lab = sk?.tap && !sk.tap.down ? 'thrust' : sk?.swinging ? (STICH.has(tn) ? 'thrust' : 'cut') : ai?.mode === 'defend' ? 'block' : 'idle';
        const p = pack(x); if (p) { p.k = k; p.lab = lab; p.tech = tn; p.st = f.state; p.idleW = f.bodyPose?.idle != null ? r2(f.bodyPose.idle) : null; } X.get(f).push(p); }
    }
    M.freeWorld(G);
    for (const f of F) rows.push({ seed: s, weapon: w, scene: 'ai', who: f === G.player ? 'P' : 'E', steps: X.get(f) });
    process.stderr.write(`ai ${w} ${s}\n`);
  }
}
const tag = String(args.tag ?? `${SCENE}_${WS.join('+')}`);
writeFileSync(join(OUT, `split_${tag}.json`), JSON.stringify({ args, rows }));
console.log(`→ ${join(OUT, `split_${tag}.json`)} 줄 ${rows.length}`);
