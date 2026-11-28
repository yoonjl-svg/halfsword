// s1_motor_probe.mjs — 제자리 뜀(hop) 여섯째 시도 S1: '시킨 수직 힘의 0.8 만 닿음' 의 뿌리 가르기. 재기만 한다(몸에 힘 · 빠르기를 걸지 않음).
//   cd <칸> && nice -n 15 node <이 파일> --root=<칸> --weapon=longsword --variants=400-405 [--from=1.5] [--x=<실험>] --out=<결과.json>
//   장면 · 자리 잡기 · 넘어짐 규칙은 refute_probe.mjs(= run_scenes.mjs hop)와 같음. 창 = 켜진 뒤 --from s ~ 6 s 의 뛰는 걸음(runG) 스텝.
//   디딘 다리 관절마다(굽힘 축 z): 명시 토크 · 엔진 모터 토크(넘어간 k · d 로 다시 셈) = 스프링 몫 k(t − e) + 감쇠 몫 d(tv − ω) · 목표 속도 tv 와 관절 속도(스텝 앞 · 뒤) · 스프링 상한 걸림.
//   몫 가르기: 모터 토크를 같은 압력 중심의 땅 힘으로 바꾼 값(legRaw 의 선형 꼴 · 최소 제곱) · 토막 묶음마다 m(g + a_y) · 디딘 발 땅 힘.
//   --x (실험 전용 · 이 대본 안에서만 엔진 모터 설정을 바꿈 — 게임 코드는 그대로): nomotor = 뛰는 디딘 다리 k = d = 0 · nodamp = d = 0 · tvfollow = 목표 속도를 스텝 앞 관절 속도로
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
const DT = H.DT, G0 = 9.81, LIM = CFG.LEGS.limit;
const WEAPON = String(args.weapon ?? 'longsword');
const [v0, v1] = String(args.variants ?? '400-400').split('-').map(Number);
const FROM = args.from != null ? +args.from : 1.5;
const X = String(args.x ?? '');

const qrot = (q, v) => { const tx = 2 * (q.y * v.z - q.z * v.y), ty = 2 * (q.z * v.x - q.x * v.z), tz = 2 * (q.x * v.y - q.y * v.x); return { x: v.x + q.w * tx + (q.y * tz - q.z * ty), y: v.y + q.w * ty + (q.z * tx - q.x * tz), z: v.z + q.w * tz + (q.x * ty - q.y * tx) }; };
const qmul = (a, b) => ({ x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x, z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z });
const qconj = (q) => ({ x: -q.x, y: -q.y, z: -q.z, w: q.w });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const rotvec = (q) => { const w = Math.max(-1, Math.min(1, q.w)), s = Math.sqrt(Math.max(0, 1 - w * w)), a = 2 * Math.acos(Math.abs(w)); const k = s > 1e-9 ? (a / s) * (w < 0 ? -1 : 1) : 2; return { x: q.x * k, y: q.y * k, z: q.z * k }; };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (a, p) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}

/** 3×3 · 4×4 풀이 (가우스) */
function solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]); for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; if (Math.abs(M[c][c]) < 1e-12) return null; for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } } return M.map((r, i) => r[n] / r[i]); }

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
  const live = { on: false, jt: {}, grp: null };
  const legSet = { F: new Set(['thighF', 'shinF', 'footF']), B: new Set(['thighB', 'shinB', 'footB']) };
  const L = HON.attach(G.world, named, {
    fighter: P, legLimit: LIM, axisTag: () => null,
    onJoint: (J, tm, te, prev, cur) => {
      if (!live.on) return;
      if (!live.grp) { // 토막 묶음마다 m (g + a_y) — 스텝 앞 · 뒤 빠르기
        const g = { F: 0, B: 0, pelvis: 0, upper: 0 };
        named.forEach(([n], i) => { const m = prev.m[i], a = (cur.v[i].y - prev.v[i].y) / DT, f = m * (G0 + a); const key = legSet.F.has(n) ? 'F' : legSet.B.has(n) ? 'B' : n === 'pelvis' ? 'pelvis' : 'upper'; g[key] += f; });
        const gi = { F: 0, B: 0 }; named.forEach(([n], i) => { const a = (cur.v[i].y - prev.v[i].y) / DT; if (legSet.F.has(n)) gi.F += prev.m[i] * a; if (legSet.B.has(n)) gi.B += prev.m[i] * a; });
        live.grp = { ...g, inF: gi.F, inB: gi.B };
      }
      const kind = /^thigh/.test(J.name) ? 'hip' : /^shin/.test(J.name) ? 'knee' : /^foot/.test(J.name) ? 'ankle' : null;
      if (!kind) return;
      const k = J.name.slice(-1);
      const capAll = (P.joints.find((j) => j.joint)?.joint)?.rawSet?.__honestyCap, m = capAll?.get(J.handle);
      const qp = prev.q[J.ip], qc = prev.q[J.ic];
      const e = rotvec(qmul(J.restInv, qmul(qconj(qp), qc)));
      const wrPost = qrot(qconj(qp), sub(cur.w[J.ic], cur.w[J.ip])), wrPre = qrot(qconj(qp), sub(prev.w[J.ic], prev.w[J.ip]));
      const sl = J.hinge ? m?.[3] : m?.[5];
      const fj = P.jointByName[J.name];
      const rv = fj?.target ? rotvec(qmul(J.restInv, { x: fj.target.x, y: fj.target.y, z: fj.target.z, w: fj.target.w })) : null;
      // 부호: 명시 토크의 '자르기 앞' 꼴(legRaw — 무릎 − = 폄 · 엉덩이 z · 발목 z)에 맞춤. honesty te · tm 은 먼 쪽(자식)이 받은 토크 → 부모 틀 z 몫의 반대 부호
      const fr = qp, ax = qrot(fr, { x: 0, y: 0, z: 1 });
      const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
      live.jt[kind + k] = {
        te: -dot(te, ax), tm: -dot(tm, ax),
        tmW: tm, // 모터 토크 (월드 · 자식이 받은 것)
        spring: sl ? -(sl.k * (sl.t - e.z)) : null, damp: sl ? -(sl.d * (sl.tv - wrPost.z)) : null,
        tv: sl?.tv ?? null, wPre: wrPre.z, wPost: wrPost.z, k: sl?.k ?? null, d: sl?.d ?? null,
        atCap: rv && sl ? Math.abs(rv.z - e.z) > Math.abs(sl.t - e.z) + 1e-6 : null, gap: rv ? rv.z - e.z : null,
      };
    },
  });
  HON.hook(G, [L]);
  // 실험 전용: 엔진 모터 설정 바꾸기 (honesty 의 감싸기 위에 한 겹 — 바꾼 값이 장부에도 그대로 들어감)
  if (X) {
    const rs = P.joints.find((j) => j.joint).joint.rawSet, o = rs.jointConfigureMotor;
    const legH = {}; for (const k of ['F', 'B']) for (const n of ['thigh', 'shin', 'foot']) legH[P.jointByName[n + k].joint.handle] = { k, n: n + k };
    rs.jointConfigureMotor = function (h, ax, t, tv, kk, dd) {
      const lh = legH[h];
      if (lh && P.gait?.runG && P.gait.legs[lh.k].stance) {
        if (X === 'nomotor') { kk = 0; dd = 0; }
        else if (X === 'nodamp') dd = 0;
        else if (X === 'tvfollow') { const J = P.jointByName[lh.n], qp = J.parent.rotation(), wc = J.child.angvel(), wp = J.parent.angvel(); const w = qrot(qconj(qp), { x: wc.x - wp.x, y: wc.y - wp.y, z: wc.z - wp.z }); tv = lh.n.startsWith('shin') ? w.z : ax === 5 ? w.z : ax === 4 ? w.y : w.x; }
      }
      return o.call(this, h, ax, t, tv, kk, dd);
    };
  }
  const calls = [];
  { const orig = D.legTorques.bind(D); D.legTorques = (Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring) => { const r = orig(Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring); if (ankleOn) calls.push({ k: Lg.k, Lg, c: { x: c.x, y: c.y, z: c.z }, Fx, Fy, Fz, ny, rk: Lg.raw.k, rhz: Lg.raw.hz, raz: Lg.raw.az, str }); return r; }; }
  const nIter = G.world.integrationParameters?.numSolverIterations ?? 4, KC = nIter / (nIter + 1);
  const footN = (k) => { const rb = P.bodies['foot' + k]; let N = 0; for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) { const col = rb.collider(ci); G.world.contactPairsWith(col, (o) => { const ob = o.parent(); if (!ob || !ob.isFixed()) return; G.world.contactPair(col, o, (m) => { const n = m.normal(); for (let q = 0, nk = m.numContacts(); q < nk; q++) N += Math.abs(n.y * m.contactImpulse(q) * KC) / DT; }); }); } return N; };
  /** 모터 토크(월드 · 자식이 받음)를 같은 압력 중심의 땅 힘으로: legRaw 가 (Fx, Fy, Fz, ny) 에 선형 — 7 성분(발목 3 · 무릎 1 · 엉덩이 3) 최소 제곱 */
  const motorForce = (cl, jt) => {
    const Lg = cl.Lg, saved = { ...Lg.raw };
    const col = (fx, fy, fz, ny) => { D.legRaw(Lg, cl.c, fx, fy, fz, ny, false, cl.str, true, false); return [Lg.raw.ax, Lg.raw.ay, Lg.raw.az, Lg.raw.k, Lg.raw.hx, Lg.raw.hy, Lg.raw.hz]; };
    const A = [col(1, 0, 0, 0), col(0, 1, 0, 0), col(0, 0, 1, 0), col(0, 0, 0, 1)];
    Object.assign(Lg.raw, saved);
    // 모터 토크를 legRaw 의 틀로: 발목 = 발 틀 · 무릎 = 허벅지 z 축 · 엉덩이 = 허벅지 틀 · 부호 = −(자식이 받은 것)
    const inv = (q, v) => qrot(qconj(q), v), qF = Lg.qF, qT = Lg.qT;
    const ta = jt['ankle' + cl.k]?.tmW, tk = jt['knee' + cl.k]?.tmW, th = jt['hip' + cl.k]?.tmW;
    if (!ta || !tk || !th) return null;
    const a = inv(qF, ta), h = inv(qT, th), kz = qrot(qT, { x: 0, y: 0, z: 1 });
    const y = [-a.x, -a.y, -a.z, -(tk.x * kz.x + tk.y * kz.y + tk.z * kz.z), -h.x, -h.y, -h.z];
    // 정규 방정식 (AᵀA) f = Aᵀ y
    const n = 4, AtA = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => A[i].reduce((s, v, r) => s + v * A[j][r], 0))), Aty = Array.from({ length: n }, (_, i) => A[i].reduce((s, v, r) => s + v * y[r], 0));
    const f = solve(AtA, Aty);
    if (!f) return null;
    const fit = A[0].map((_, r) => f.reduce((s, fi, i) => s + fi * A[i][r], 0)), res = Math.hypot(...fit.map((v, r) => v - y[r])), nrm = Math.hypot(...y);
    return { Fy: f[1], Fx: f[0], Fz: f[2], resRel: nrm > 1e-6 ? res / nrm : 0 };
  };
  const rows = [];
  let tOn = null, fell = false, tFall = null, low = 0, tilt = 0, dn0 = D.dbg?.n ?? 0;
  for (let i = 0; i < Math.round(10.5 / DT); i++) {
    const t = i * DT;
    P.runReach = 1; P.move.set(0, 1); P.stickX = 0; P.stickY = 1;
    calls.length = 0; live.jt = {}; live.grp = null;
    live.on = tOn != null && t - tOn >= FROM - 1e-9;
    G.step();
    if (P.run?.on && tOn == null) tOn = t;
    const pp = P.bodies.pelvis.translation(), tl = P.tiltDeg();
    low = pp.y < 0.5 ? low + DT : 0; tilt = tl > 60 ? tilt + DT : 0;
    if (!fell && (P.state !== 'stand' || low > 0.25 || tilt > 0.25)) { fell = true; tFall = t; }
    const dn = D.dbg?.n ?? 0, ran = dn !== dn0; dn0 = dn;
    if (fell) break;
    if (tOn == null) continue;
    if (t - tOn > 6) break;
    if (!live.on) continue;
    const R = P.gait?.runG, RP = R?.plan ?? null;
    if (!R) continue;
    const nF = footN('F'), nB = footN('B'), N = ran && D.dbg.on > 0 ? D.dbg.N : 0;
    const row = { t: t - tOn, s: RP ? RP.t / RP.Tc : null, k: RP?.k ?? null, km: RP?.km ?? null, N, nF, nB, fy: L.lastRes?.y ?? 0, grp: live.grp, one: (nF > thr) !== (nB > thr) };
    if (RP && N > 0) {
      const cl = calls.filter((c) => c.k === RP.k).pop(), jt = live.jt;
      if (cl) {
        row.cl = { Fy: cl.Fy, rk: cl.rk, rhz: cl.rhz, raz: cl.raz, copA: (cl.c.x - cl.Lg.pa.x) * cl.Lg.hx + (cl.c.z - cl.Lg.pa.z) * cl.Lg.hz };
        row.mf = motorForce(cl, jt);
      }
      row.j = {}; for (const n of ['hip', 'knee', 'ankle']) { const x = jt[n + RP.k]; if (x) row.j[n] = { te: x.te, tm: x.tm, spring: x.spring, damp: x.damp, tv: x.tv, wPre: x.wPre, wPost: x.wPost, atCap: x.atCap, gap: x.gap, k: x.k, d: x.d }; }
    }
    rows.push(row);
  }
  try { G.world.free(); } catch { /* */ }
  return analyse({ variant, rows, Mg, M, fell, tFall: tFall != null && tOn != null ? tFall - tOn : null });
}

function analyse(o) {
  const { rows, Mg } = o;
  const out = { variant: o.variant, weapon: WEAPON, x: X || null, from: FROM, fell: o.fell, tFall: r3(o.tFall) };
  // 한 발 디딤 가운데 · 뒤(계획 s 0.33 ~ 1) — 진단과 같은 쪽(앞 1/3 은 닿는 충격)
  const mid = rows.filter((x) => x.one && x.s != null && x.s >= 1 / 3 && x.s <= 1 && x.N > 0 && x.cl);
  const front = rows.filter((x) => x.one && x.s != null && x.s < 1 / 3 && x.N > 0 && x.cl);
  const foot = (x) => (x.k === 'F' ? x.nF : x.nB);
  const sumN = (a, f) => a.reduce((s, x) => s + f(x), 0);
  out.n = mid.length;
  out.recvOverCmd = r3(sumN(mid, foot) / Math.max(1, sumN(mid, (x) => x.N))); // 그 발 땅 힘 합 ÷ 시킨 N 합
  out.recvOverCmdFront = r3(sumN(front, foot) / Math.max(1, sumN(front, (x) => x.N)));
  out.motorFyOverCmd = r3(sumN(mid.filter((x) => x.mf), (x) => x.mf.Fy) / Math.max(1, sumN(mid.filter((x) => x.mf), (x) => x.N))); // 모터 토크가 같은 압력 중심에서 내는 수직 힘 ÷ 시킨 N
  out.motorFitRes = r3(mean(mid.filter((x) => x.mf).map((x) => x.mf.resRel)));
  // 묶음마다 m (g + a_y) 합 ÷ 시킨 N (한 발 디딤 가운데 · 뒤): 디딘 다리 · 뜬 다리 · 골반 · 윗몸
  const gs = (key) => r3(sumN(mid, (x) => (key === 'st' ? x.grp[x.k] : key === 'sw' ? x.grp[x.k === 'F' ? 'B' : 'F'] : key === 'stIn' ? x.grp[x.k === 'F' ? 'inF' : 'inB'] : key === 'swIn' ? x.grp[x.k === 'F' ? 'inB' : 'inF'] : x.grp[key])) / Math.max(1, sumN(mid, (x) => x.N)));
  out.grp = { stanceLeg: gs('st'), swingLeg: gs('sw'), pelvis: gs('pelvis'), upper: gs('upper'), stanceLegInertia: gs('stIn'), swingLegInertia: gs('swIn') };
  // 관절마다: 명시 · 모터 · 스프링 · 감쇠 평균(N·m · 부호 = 명시 꼴) · 목표 속도 대 관절 속도
  out.j = {};
  for (const n of ['hip', 'knee', 'ankle']) {
    const a = mid.map((x) => x.j?.[n]).filter(Boolean);
    if (!a.length) continue;
    const m = (f) => r3(mean(a.map(f).filter((v) => v != null && Number.isFinite(v))));
    // 목표 속도가 무엇을 따라가나: tv − 스텝 앞 관절 속도 · tv − 스텝 뒤 관절 속도 (rad/s 의 평균 절대값과 평균)
    out.j[n] = { expl: m((x) => x.te), motor: m((x) => x.tm), spring: m((x) => x.spring), damp: m((x) => x.damp), motorOverExpl: r3(mean(a.map((x) => x.tm)) / mean(a.map((x) => x.te))),
      tv: m((x) => x.tv), wPre: m((x) => x.wPre), wPost: m((x) => x.wPost), tvMinusPre: m((x) => x.tv - x.wPre), tvMinusPost: m((x) => x.tv - x.wPost), absTvMinusPre: m((x) => Math.abs(x.tv - x.wPre)),
      atCapShare: r3(a.filter((x) => x.atCap).length / a.length), gap: m((x) => x.gap), k: m((x) => x.k), d: m((x) => x.d) };
  }
  // km · 시킨 최고 (뛰는 디딤 계획마다 최고의 평균)
  { const peaks = [], kms = []; let cur = null; for (const x of rows) { if (x.s == null || x.N <= 0) continue; if (!cur || x.s < cur.sLast - 1e-6) { if (cur) { peaks.push(cur.N); kms.push(cur.km); } cur = { N: 0, km: 0, sLast: x.s }; } cur.N = Math.max(cur.N, x.N); cur.km = Math.max(cur.km, x.km ?? 0); cur.sLast = x.s; } if (cur) { peaks.push(cur.N); kms.push(cur.km); }
    out.kmPeakMean = r3(mean(kms)); out.cmdPeakMeanBW = r3(mean(peaks) / Mg); out.cmdPeakMaxBW = r3(peaks.length ? Math.max(...peaks) / Mg : null); out.stances = peaks.length; }
  // 무릎 · 발목 바란 ÷ 한도 99 % (뛰는 디딤 · 창 안 · 디딘 발 호출만)
  { const K = [], A = []; for (const x of rows) if (x.cl) { K.push(Math.abs(x.cl.rk) / (x.cl.rk < 0 ? LIM.kneeExt : LIM.kneeFlex)); A.push(Math.abs(x.cl.raz) / (x.cl.raz > 0 ? LIM.anklePlantar : LIM.ankleDorsi)); } out.knee99 = r3(pct(K, 0.99)); out.ankle99 = r3(pct(A, 0.99)); }
  out.copA = r3(mean(mid.map((x) => x.cl.copA)));
  return out;
}

const res = [];
for (let v = v0; v <= v1; v++) { const r = one(v); res.push(r); console.log(JSON.stringify(r)); }
if (args.out) writeFileSync(String(args.out), JSON.stringify(res));
