// s3_td_probe.mjs — 제자리 뜀(hop) 여섯째 시도 S3: 뛰는 디딤마다 계획(뜬 시간 · 높이 되찾기 rec · 힘 한도 여유)과 그 디딤에서 몸이 한 일. 재기만 한다(몸에 힘 · 빠르기를 걸지 않음).
//   cd <칸> && nice -n 15 node <이 파일> --root=<칸> --weapon=zweihander --variants=400-403 | --list=400,402 [--settleS=<초>] [--nudgeJ=<N·s>] --out=<결과.json>
//   장면 · 자리 잡기 · 가슴 치기 · 넘어짐 규칙은 s2_cop_probe.mjs(= run_scenes.mjs hop)와 같음. --settleS 는 자리 잡기 초를 바로 줌 · --nudgeJ 는 치기 세기(기본 6).
//   디딤마다: 계획을 만든 스텝에서 R.plan · R.hLow · R.capMin(지난 디딤 가운데의 가장 작은 힘 한도)을 읽고, 박자로만 셈한 뜬 시간 · 바란 rec 와 견줘 '무엇이 계획을 묶었나'를 가린다.
//   그 디딤 동안: 무릎 굽힘 최고 · 시킨 수직 충격량(Jc) · 받은 수직 충격량(디딘 발 groundForce 적분) · 깎인 스텝 · 골반 최저.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const CFG = await import(u('src/config.js'));
for (const [k, v] of [['cost', 0], ['legVmax', 0], ['contactMax', 0.26]]) CFG.RUN[k] = v; // hop 장면과 같은 덮어씀
const H = await import(u('tools/sim/harness_m.mjs'));
const RG = await import(u('src/run_gait.js'));
const DT = H.DT, G0 = 9.81, RUN = CFG.RUN;
const WEAPON = String(args.weapon ?? 'longsword');
let list;
if (args.list) list = String(args.list).split(',').map(Number);
else { const [a, b] = String(args.variants ?? '400-400').split('-').map(Number); list = []; for (let v = a; v <= b; v++) list.push(v); }
const NUDGE = args.nudgeJ != null ? +args.nudgeJ : 6;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const kneeOf = (Lg) => { const len = Lg.ph.distanceTo(Lg.pa), c = Math.max(-1, Math.min(1, (Lg.lenT ** 2 + Lg.lenS ** 2 - len * len) / (2 * Lg.lenT * Lg.lenS))); return Math.PI - Math.acos(c); };

function one(variant) {
  const G = H.newRound({ walls: false, weapon: WEAPON, seed: 100 + variant });
  G.park();
  const P = G.player, D = P.legDrive;
  const settleS = args.settleS != null ? +args.settleS : 2.0 + 0.11 * variant;
  const settle = Math.round(settleS / DT), nudgeAt = settle - Math.round(0.5 / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, NUDGE, variant * 2.39996); G.step(); }
  let M = 0; { const seen = new Set(); for (const b of [...Object.values(P.bodies), P.sword]) if (b && !seen.has(b.handle)) { seen.add(b.handle); M += b.mass(); } }
  const Mg = M * G0;
  const { A } = RG.runShape(); let pk = 0; for (let i = 1; i < 40; i++) pk = Math.max(pk, RG.shapeAt(i / 40));
  // 재기만: trunkShare 가 1 밑일 때 무엇이 묶는지(축 · σ=0 에서 이미 넘는가) — 같은 식을 legRaw 로 다시 셈(몸에 아무것도 안 건다)
  const tsLog = [];
  { const LIM = CFG.LEGS.limit, orig = D.trunkShare.bind(D);
    D.trunkShare = (A, cx, cz, com, N, Mx, Mz, hx, hz, hT, str, ny) => {
      const sg = orig(A, cx, cz, com, N, Mx, Mz, hx, hz, hT, str, ny);
      if (sg < 0.5) {
        const saved = { ...A.raw }, R = A.raw;
        const run = (s) => { const fx = (s * (Mz - hz) - (cx - com.x) * N) / hT, fz = -(s * (Mx - hx) + (cz - com.z) * N) / hT; D.legRaw(A, A.c, fx, N, fz, ny, true, str, true); return [R.ax, R.ay, R.az, R.k, R.hx, R.hy, R.hz]; };
        const b = run(1), a = run(0); Object.assign(A.raw, saved);
        const lo = [-LIM.ankleInv, -LIM.ankleRot, -LIM.ankleDorsi, -LIM.kneeExt, -LIM.hipAbd, -LIM.hipRot, -LIM.hipFlex], hi = [LIM.ankleInv, LIM.ankleRot, LIM.anklePlantar, LIM.kneeFlex, LIM.hipAbd, LIM.hipRot, LIM.hipFlex];
        const nm = ['aInv', 'aRot', 'aPl', 'knee', 'hAbd', 'hRot', 'hFlex'];
        const bind = []; for (let i = 0; i < 7; i++) if (b[i] < lo[i] * str || b[i] > hi[i] * str) bind.push(nm[i] + ':' + (a[i] / ((a[i] < 0 ? -lo[i] : hi[i]) * str)).toFixed(2) + '>' + (b[i] / ((b[i] < 0 ? -lo[i] : hi[i]) * str)).toFixed(2));
        tsLog.push({ t: P.gait?.runG?.plan ? +P.gait.runG.plan.t.toFixed(3) : null, sg: +sg.toFixed(3), N: +(N / (M * G0)).toFixed(2), Mx: +Mx.toFixed(0), Mz: +Mz.toFixed(0), bind: bind.join(' ') });
      }
      return sg;
    }; }
  let airRec = null;
  { const origA = D.airTrunk.bind(D); D.airTrunk = (Mx, My, Mz) => { if (airRec) { const m = Math.hypot(Mx, Mz); airRec.n++; airRec.mMax = Math.max(airRec.mMax, m); if (m > RUN.airTilt) airRec.over++; } return origA(Mx, My, Mz); }; }
  const tds = []; let cur = null, lastPlan = null, tOn = null, fell = false, tFall = null, low = 0, tilt = 0, p15 = null;
  const track = [];
  for (let i = 0; i < Math.round(10.5 / DT); i++) {
    const t = i * DT;
    P.runReach = 1; P.move.set(0, 1); P.stickX = 0; P.stickY = 1;
    G.step();
    if (P.run?.on && tOn == null) tOn = t;
    const pp = P.bodies.pelvis.translation(), tl = P.tiltDeg();
    low = pp.y < 0.5 ? low + DT : 0; tilt = tl > 60 ? tilt + DT : 0;
    if (!fell && (P.state !== 'stand' || low > 0.25 || tilt > 0.25)) { fell = true; tFall = t; }
    if (fell) break;
    if (tOn == null) continue;
    const ta = t - tOn;
    if (ta > 6) break;
    const R = P.gait?.runG;
    if (ta >= 1.5 && !p15 && P.com) p15 = { x: P.com.x, z: P.com.z };
    if (i % 6 === 0 && P.com) track.push([r3(ta), r3(pp.y), r3(P.com.x), r3(P.com.z), r3(P.comVel.x), r3(P.comVel.z), r3(tl)]);
    if (!R) continue;
    const RP = R.plan;
    if (RP && RP !== lastPlan) {
      // 새 디딤: 계획을 만든 스텝
      if (cur) tds.push(cur);
      const l = P.gait.legs[RP.k], Lg = D.legs[RP.k];
      const Tc = RP.Tc;
      let TfCad = Math.max(RUN.flightMin, Math.min(RUN.flightMax, 1 / RUN.cadence - Tc));
      TfCad = RUN.flightMin + (TfCad - RUN.flightMin) * Math.min(1, R.n / Math.max(1, RUN.rampSteps));
      const recWant = Math.max(-RUN.hRec, Math.min(RUN.hRec, R.hLow ?? 0));
      const recEff = (RP.vto - (G0 * RP.Tf) / 2) / RUN.hGain;
      const capPlan = RUN.capUse * Math.min(R.capMin, RUN.loadMax * Mg);
      const mk = (tf, rec) => M * ((G0 * tf) / 2 + RUN.hGain * rec - RP.vy0) + M * G0 * Tc;
      const fwd = R.fwd, rgt = R.rgt, c = P.com, v = P.comVel;
      const aF = (l.ankle.x - c.x) * fwd.x + (l.ankle.z - c.z) * fwd.z, aL = (l.ankle.x - c.x) * rgt.x + (l.ankle.z - c.z) * rgt.z;
      cur = {
        t: r3(ta), k: RP.k, n: R.n, Tc: r3(Tc), Tf: r3(RP.Tf), TfCad: r3(TfCad), hLow: r3(R.hLow), recWant: r3(recWant), recEff: r3(recEff),
        capMinBW: r3(R.capMin / Mg), capPlanBW: r3(capPlan / Mg), needBW: r3((mk(TfCad, recWant) / (Tc * A)) * pk / Mg), needNoRecBW: r3((mk(TfCad, 0) / (Tc * A)) * pk / Mg), planBW: r3((RP.J / (Tc * A)) * pk / Mg),
        vy0: r3(RP.vy0), vto: r3(RP.vto), J: r3(RP.J), pelY: r3(pp.y), knee0: r3(kneeOf(Lg) * 180 / Math.PI), aF: r3(aF), aL: r3(aL), vF: r3(v.x * fwd.x + v.z * fwd.z), vL: r3(v.x * rgt.x + v.z * rgt.z), tilt: r3(tl),
        kneeMax: 0, pelMin: pp.y, cut: 0, steps: 0, Jgot: 0, Nmax: 0, cutMinBW: Infinity, tsMin: 1, tsSum: 0, tiltMax: tl, copSum: 0,
      };
      lastPlan = RP;
    }
    if (cur && RP && RP === lastPlan) {
      const Lg = D.legs[RP.k];
      cur.kneeMax = Math.max(cur.kneeMax, kneeOf(Lg) * 180 / Math.PI);
      cur.pelMin = Math.min(cur.pelMin, pp.y);
      cur.steps++;
      if (D.dbg.capCut) cur.cut++;
      if (D.dbg.on === 1) { const ts = D.dbg.trunkShare ?? 1; cur.tsMin = Math.min(cur.tsMin, ts); cur.tsSum += ts; }
      cur.tiltMax = Math.max(cur.tiltMax, tl);
      { const l = P.gait.legs[RP.k], Lg = D.legs[RP.k]; if (D.copOk && Lg.hx != null) cur.copSum += (D.cop.x - Lg.pa.x) * Lg.hx + (D.cop.z - Lg.pa.z) * Lg.hz; }
      cur.Jgot += P.gait.groundForce(P.gait.legs[RP.k]) * DT;
      cur.Nmax = Math.max(cur.Nmax, D.dbg.N || 0);
      cur.Jc = RP.Jc; cur.capMidBW = r3(RP.capMin / Mg); cur.km = r3(RP.km);
    }
    if (!RP && lastPlan) { lastPlan = null; if (cur) { cur.vyTO = r3(P.comVel.y); cur.tTO = r3(ta); cur.capAx = D.capAxis; cur.tiltTO = r3(tl); airRec = cur.air = { n: 0, mMax: 0, over: 0 }; } }
  }
  if (cur) tds.push(cur);
  for (const x of tds) { x.kneeMax = r3(x.kneeMax); x.pelMin = r3(x.pelMin); x.got = r3(x.Jgot / Math.max(1e-6, x.J)); x.cmd = r3((x.Jc || 0) / Math.max(1e-6, x.J)); x.NmaxBW = r3(x.Nmax / Mg); x.tsMean = r3(x.tsSum / Math.max(1, x.steps)); x.tsMin = r3(x.tsMin); x.tiltMax = r3(x.tiltMax); x.cop = r3(x.copSum / Math.max(1, x.steps)); delete x.tsSum; delete x.copSum; delete x.Jgot; delete x.Nmax; delete x.cutMinBW; }
  try { G.world.free(); } catch { /* */ }
  const c = P.com;
  return { variant, weapon: WEAPON, settleS, fell, tFall: tFall != null && tOn != null ? r3(tFall - tOn) : null, M: r3(M), tsLog, drift15: p15 && c ? r3(Math.hypot(c.x - p15.x, c.z - p15.z)) : null, tds, track };
}

const res = [];
for (const v of list) { const r = one(v); res.push(r); console.error(v, r.fell, r.tFall, r.tds.length); }
if (args.out) writeFileSync(String(args.out), JSON.stringify(res));
