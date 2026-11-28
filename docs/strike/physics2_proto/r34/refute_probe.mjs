// refute_probe.mjs — 제자리 뜀(hop) 진단을 다른 길로 다시 재는 대본 (여섯째 시도 · 반박 몫). 재기만 한다 — 몸에 힘 · 빠르기를 걸지 않는다(legTorques 는 감싸 적기만 · honesty onJoint 는 읽기만).
//   cd <칸> && nice -n 15 node <이 파일> --root=<칸> --weapon=longsword --variants=470-477 --out=<결과.json>
//   장면 조종 · 자리 잡기 · 넘어짐 규칙은 run_scenes.mjs hop 과 같게 새로 적었다(그 파일을 옮기지 않음). 판마다: 창 앞머리 · 뛰는 걸음 뒤 · 받은 ÷ 시킨 쪼갬 · 받는 쪽 한도 넣은 몫 · 높이 되찾기 버림.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const CFG = await import(u('src/config.js'));
for (const [k, v] of [['cost', 0], ['legVmax', 0], ['contactMax', 0.26]]) CFG.RUN[k] = v; // hop 장면과 같은 덮어씀
const H = await import(u('tools/sim/harness_m.mjs'));
const HON = await import(u('tools/sim/honesty.mjs'));
const VMC = await import(u('src/legs_vmc.js'));
const DT = H.DT, G0 = 9.81, LIM = CFG.LEGS.limit, RUN = CFG.RUN;
const WEAPON = String(args.weapon ?? 'longsword');
const [v0, v1] = String(args.variants ?? '470-470').split('-').map(Number);

const qrot = (q, v) => { const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x); return { x: v.x + q.w * tx + (q.y * tz - q.z * ty), y: v.y + q.w * ty + (q.z * tx - q.x * tz), z: v.z + q.w * tz + (q.x * ty - q.y * tx) }; };
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const pct = (a, p) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}

function one(variant) {
  const G = H.newRound({ walls: false, weapon: WEAPON, seed: 100 + variant });
  G.park();
  const P = G.player, D = P.legDrive;
  const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); }
  const seen = new Set(), named = [];
  for (const [n, b] of [...Object.entries(P.bodies), ['sword', P.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); named.push([n, b]); }
  const bodies = named.map(([, b]) => b); let M = 0; for (const b of bodies) M += b.mass();
  const Mg = M * G0, thr = 0.03 * Mg;
  const live = { on: false, jt: {} };
  const L = HON.attach(G.world, named, {
    fighter: P, legLimit: LIM, axisTag: () => null,
    onJoint: (J, tm, te, prev) => {
      if (!live.on) return;
      const kind = /^thigh/.test(J.name) ? 'hip' : /^shin/.test(J.name) ? 'knee' : /^foot/.test(J.name) ? 'ankle' : null;
      if (!kind) return;
      const k = J.name.slice(-1);
      const fr = kind === 'knee' ? prev.q[J.ip] : prev.q[J.ic], ax = qrot(fr, { x: 0, y: 0, z: 1 });
      const ang = (() => { const q = qmul(J.restInv, qmul(qconj(prev.q[J.ip]), prev.q[J.ic])); const w = Math.max(-1, Math.min(1, q.w)), s = Math.sqrt(Math.max(0, 1 - w * w)), a = 2 * Math.acos(Math.abs(w)); const kk = s > 1e-9 ? (a / s) * (w < 0 ? -1 : 1) : 2; return q.z * kk; })();
      live.jt[kind + k] = { te: -dot(te, ax), tm: -dot(tm, ax), ang };
    },
  });
  HON.hook(G, [L]);
  const calls = [];
  { const orig = D.legTorques.bind(D); D.legTorques = (Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring) => { const r = orig(Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring); if (ankleOn) calls.push({ k: Lg.k, rk: Lg.raw.k, raz: Lg.raw.az, str: str || 1, wK: Lg.wK, wAz: Lg.wA?.z ?? 0, Fy, Fh: Math.hypot(Fx, Fz) }); return r; }; }
  const nIter = G.world.integrationParameters?.numSolverIterations ?? 4, KC = nIter / (nIter + 1);
  const footN = (k) => { const rb = P.bodies['foot' + k]; let N = 0; for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) { const col = rb.collider(ci); G.world.contactPairsWith(col, (o) => { const ob = o.parent(); if (!ob || !ob.isFixed()) return; G.world.contactPair(col, o, (m) => { const n = m.normal(); for (let q = 0, nk = m.numContacts(); q < nk; q++) N += Math.abs(n.y * m.contactImpulse(q) * KC) / DT; }); }); } return N; };
  const com = () => { let x = 0, z = 0, vx = 0, vy = 0, vz = 0; for (const b of bodies) { const m = b.mass(), p = b.worldCom(), v = b.linvel(); x += m * p.x; z += m * p.z; vx += m * v.x; vy += m * v.y; vz += m * v.z; } return { x: x / M, z: z / M, vx: vx / M, vy: vy / M, vz: vz / M }; };
  const steps = [], plans = [];
  let tOn = null, fell = false, tFall = null, low = 0, tilt = 0, lastPlan = null, dn0 = D.dbg?.n ?? 0;
  for (let i = 0; i < Math.round(10 / DT); i++) {
    const t = i * DT;
    P.runReach = 1; P.move.set(0, 1); P.stickX = 0; P.stickY = 1;
    calls.length = 0; live.jt = {};
    live.on = tOn != null;
    G.step();
    if (P.run?.on && tOn == null) tOn = t;
    const pp = P.bodies.pelvis.translation(), tl = P.tiltDeg();
    low = pp.y < 0.5 ? low + DT : 0; tilt = tl > 60 ? tilt + DT : 0;
    if (!fell && (P.state !== 'stand' || low > 0.25 || tilt > 0.25)) { fell = true; tFall = t; }
    const dn = D.dbg?.n ?? 0, ran = dn !== dn0; dn0 = dn;
    if (tOn == null) continue;
    const R = P.gait?.runG, RP = R?.plan ?? null;
    if (RP && RP !== lastPlan) {
      const recUsed = (RP.vto - (G0 * RP.Tf) / 2) / RUN.hGain, recWant = Math.max(-RUN.hRec, Math.min(RUN.hRec, R.hLow ?? 0));
      plans.push({ t: t - tOn, k: RP.k, Tc: RP.Tc, Tf: RP.Tf, J: RP.J, vto: RP.vto, hLow: R.hLow, recUsed, recWant, py: pp.y });
    }
    lastPlan = RP;
    const c = com();
    steps.push({ t: t - tOn, runG: !!R, plan: RP ? { k: RP.k, s: RP.t / RP.Tc, J: RP.J } : null, N: ran && D.dbg.on > 0 ? D.dbg.N : 0, fy: L.lastRes?.y ?? 0, nF: footN('F'), nB: footN('B'), c, py: pp.y, gs: { F: !!P.gait?.legs?.F?.stance, B: !!P.gait?.legs?.B?.stance }, calls: calls.map((x) => ({ ...x })), jt: live.jt });
    if (fell || t - tOn > 6) break;
  }
  try { G.world.free(); } catch { /* */ }
  return analyse({ variant, steps, plans, Mg, M, thr, fell, tFall: tFall != null && tOn != null ? tFall - tOn : null, tOn });
}

function analyse(o) {
  const { steps: S, plans, Mg, thr } = o;
  const out = { variant: o.variant, weapon: WEAPON, fell: o.fell, tFall: r3(o.tFall), tOn: r3(o.tOn) };
  if (!S.length) return out;
  const iR = S.findIndex((x) => x.runG), tR = iR >= 0 ? S[iR].t : null;
  out.v0 = r3(Math.hypot(S[0].c.vx, S[0].c.vz)); out.tRunG = r3(tR); out.vRunG = r3(iR >= 0 ? Math.hypot(S[iR].c.vx, S[iR].c.vz) : null);
  // 디딤 사건 (발마다 3 % 넘음 · 앞 두 발 뜬 시간)
  const tds = []; let air = 0; const cur = { F: S[0].nF > thr, B: S[0].nB > thr };
  for (let i = 1; i < S.length; i++) { const x = S[i], on = { F: x.nF > thr, B: x.nB > thr }; for (const k of ['F', 'B']) if (on[k] && !cur[k]) tds.push({ t: x.t, air, runG: x.runG }); cur.F = on.F; cur.B = on.B; air = on.F || on.B ? 0 : air + DT; }
  const fs = (a) => (a.length ? a.filter((d) => d.air > 0.05 - 1e-9).length / a.length : null);
  out.flight05 = r3(fs(tds)); out.flight05AfterRunG = r3(fs(tds.filter((d) => tR != null && d.t >= tR))); out.flight05After1s = r3(fs(tds.filter((d) => d.t >= 1)));
  out.badTdTimes = tds.filter((d) => d.air < 0.05 - 1e-9).map((d) => r3(d.t));
  // 자리 흐름
  const dist = (a, b) => Math.hypot(b.c.x - a.c.x, b.c.z - a.c.z), end = S[S.length - 1];
  out.drift = r3(dist(S[0], end)); out.driftAfterRunG = r3(iR >= 0 ? dist(S[iR], end) : null);
  const i1 = S.findIndex((x) => x.t >= 1), i2 = S.findIndex((x) => x.t >= 2);
  out.drift1s = r3(i1 >= 0 ? dist(S[0], S[i1]) : null); out.driftAfter2s = r3(i2 >= 0 ? dist(S[i2], end) : null);
  // 받침: 받은 ÷ 시킨(N 적분) · 받은 ÷ 첫 계획 J (받침 안에서 처음 생긴 계획)
  const ph = []; let p = null;
  for (const x of S) { const any = x.nF > thr || x.nB > thr; if (any) { if (!p) p = { t0: x.t, J: 0, Jn: 0, pJ: null, first: x.plan ? x.plan.J : null, runG: x.runG }; p.J += x.fy * DT; p.Jn += x.N * DT; if (p.pJ == null && x.plan) p.pJ = x.plan.J; } else if (p) { p.T = x.t - p.t0; ph.push(p); p = null; } }
  const ok = ph.filter((q) => q.T >= 0.05);
  out.phases = ok.length; out.phasesPlanAtFirstStep = ok.filter((q) => q.first != null).length;
  const rN = ok.filter((q) => q.Jn > 1).map((q) => q.J / q.Jn), rP = ok.filter((q) => q.pJ).map((q) => q.J / q.pJ);
  out.impN = [r3(Math.min(...rN)), r3(mean(rN)), r3(Math.max(...rN))]; out.impPlan = [r3(Math.min(...rP)), r3(mean(rP)), r3(Math.max(...rP))];
  // 한 발 디딤 가운데(계획 s 0.3 ~ 0.7): 시킨 N 이 legTorques 로 갔나 · 그 발 땅 힘 ÷ N · 무릎 토크 (바란 · 건 명시 · 모터)
  const mid = S.filter((x) => x.plan && x.plan.s > 0.3 && x.plan.s < 0.7 && x.N > 0 && (x.gs.F !== x.gs.B));
  const fyCall = [], footRat = [], fyRat = [], kRaw = [], kTe = [], kTm = [], hTe = [], hTm = [], aTe = [], aTm = [];
  for (const x of mid) {
    const k = x.plan.k, cl = x.calls.filter((c) => c.k === k);
    if (cl.length) fyCall.push(cl[cl.length - 1].Fy / x.N);
    footRat.push((k === 'F' ? x.nF : x.nB) / x.N); fyRat.push(x.fy / x.N);
    const j = x.jt; if (cl.length && j['knee' + k]) { kRaw.push(cl[cl.length - 1].rk); kTe.push(j['knee' + k].te); kTm.push(j['knee' + k].tm); }
    if (j['hip' + k]) { hTe.push(j['hip' + k].te); hTm.push(j['hip' + k].tm); }
    if (j['ankle' + k]) { aTe.push(j['ankle' + k].te); aTm.push(j['ankle' + k].tm); }
  }
  out.mid = { n: mid.length, callFyOverN: r3(mean(fyCall)), footNOverN: r3(mean(footRat)), fyOverN: r3(mean(fyRat)), kneeRaw: r3(mean(kRaw)), kneeExpl: r3(mean(kTe)), kneeMotor: r3(mean(kTm)), hipExpl: r3(mean(hTe)), hipMotor: r3(mean(hTm)), ankleExpl: r3(mean(aTe)), ankleMotor: r3(mean(aTm)) };
  // 무릎 · 발목 몫 99 % — 관문 셈(한도 × 근력) · 받는 쪽 한도 넣은 셈 · 창 앞머리 / 뛰는 걸음 뒤
  const sh = (c, ecc) => {
    const kl = c.rk < 0 ? (ecc ? VMC.legLimit(LIM.kneeExt, c.str, -c.wK) : LIM.kneeExt * c.str) : (ecc ? VMC.legLimit(LIM.kneeFlex, c.str, c.wK) : LIM.kneeFlex * c.str);
    const al = c.raz > 0 ? (ecc ? VMC.legLimit(LIM.anklePlantar, c.str, c.wAz) : LIM.anklePlantar * c.str) : (ecc ? VMC.legLimit(LIM.ankleDorsi, c.str, -c.wAz) : LIM.ankleDorsi * c.str);
    return { k: Math.abs(c.rk) / kl, a: Math.abs(c.raz) / al };
  };
  const grp = (f) => { const K = [], A = [], Ke = [], Ae = []; for (const x of S.filter(f)) for (const c of x.calls) { const s = sh(c, false), e = sh(c, true); K.push(s.k); A.push(s.a); Ke.push(e.k); Ae.push(e.a); } return { n: K.length, k99: r3(pct(K, 0.99)), a99: r3(pct(A, 0.99)), k99ecc: r3(pct(Ke, 0.99)), a99ecc: r3(pct(Ae, 0.99)) }; };
  out.share = { all: grp(() => true), before: grp((x) => !x.runG), afterRunG: grp((x) => x.runG), after1s: grp((x) => x.t >= 1 && x.runG) };
  // 관절 끝 (엉덩이 폄 −0.5 rad 의 0.03 안) — 디딘 다리 · 때
  const ends = []; for (const x of S) for (const k of ['F', 'B']) { const j = x.jt['hip' + k]; if (j && j.ang <= -0.47) ends.push({ t: x.t, st: x.gs[k], runG: x.runG }); }
  out.hipEnd = { n: ends.length, afterRunG: ends.filter((e) => e.runG).length, tMax: r3(ends.length ? Math.max(...ends.map((e) => e.t)) : null) };
  // 높이 되찾기 버림: 낮게 닿았는데(hLow > 1 cm) 쓴 rec 가 바란 것의 반 밑
  const lowP = plans.filter((q) => q.hLow > 0.01);
  out.rec = { plans: plans.length, low: lowP.length, dropped: lowP.filter((q) => q.recUsed < 0.5 * q.recWant).length, flightCut: plans.filter((q) => q.Tf < RUN.flightMin + 1e-4).length, firstDropT: r3(lowP.find((q) => q.recUsed < 0.5 * q.recWant)?.t ?? null), pyTdMin: r3(Math.min(...plans.map((q) => q.py))) };
  return out;
}

const res = [];
for (let v = v0; v <= v1; v++) { const r = one(v); res.push(r); console.log(JSON.stringify(r)); }
if (args.out) writeFileSync(String(args.out), JSON.stringify(res));
