// ─────────────────────────────────────────────────────────────
//  thrust.mjs — 찌르기: 같은 근육 한도로 팔을 뻗고(끝점 힘 → 자코비안 전치), 골반은 입력 빠르기로 앞으로 옮긴다(런지 — 다리 대신 운동학 받침).
//   자세: 골반 −15° · 가슴 −25°(칼 든 어깨 뒤) · 손은 칼 쪽 옆구리 앞 · 칼끝은 앞(+x). 찌르는 줄 = 처음 손 자리를 지나는 +x 줄.
//   재는 것: ① 허공 — 칼 축 쪽 칼끝 빠르기 최고 ② 칼 축 유효 질량 — 칼끝에 칼 축 반대로 충격량 5 N·s 를 한 스텝에 걸고 안 건 판과의 빠르기 차로 (8 · 17 · 33 ms 뒤)
//            ③ 0.1 m 를 뚫는 동안 버틸 수 있는 가장 큰 칼 축 저항 힘 (칼끝이 닿는 면을 지난 뒤 칼 축 쪽 0.1 m 동안 일정한 힘 · 칼끝 축 빠르기가 0.3 m/s 아래로 떨어지면 멈춘 것 — 이분법) · 그때 받침 반력
// ─────────────────────────────────────────────────────────────
import { Model, Muscles, holdPD, holdPDhinge, WEAPONS, DT, DEG, G, add, sub, scl, adds, dot, cross, len, nrm, perp, clampLen, clamp, qrot, qconj, qmul, qaxis, rotvec, mv, madd, mpara, O } from './lib.mjs';

export const TH0 = { vL: 0, tRamp: 0.25, tArm: 0.1, F0: 1500, Kl: 4000, Dl: 120, Kth: 150, Dth: 10, strength: 1, tEnd: 0.7, wnPost: 20 };
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

/** o: { weapon, twoHand?, vL(골반 빠르기 m/s), tArm(팔 뻗기 시작 s), impulse: {t, J} | null, resist: {x0, F, depth} | null } */
export function runThrust(R, o) {
  const p = { ...TH0, ...o };
  const W = WEAPONS[p.weapon]; const twoHand = p.twoHand ?? W.twoHand;
  const pose = { pelYaw: -15 * DEG, twist: -10 * DEG, frame: 'chest', hand: [0.12, -0.15, 0.2], bladeFrame: 'heading', blade: [1, 0, 0] };
  const M = new Model(R, { weapon: p.weapon, twoHand, pose, legsI: 0, fixture: 'lock', kinematic: true });
  const mus = new Muscles(M, { strength: p.strength, human: p.human });
  const aG = -W.gripAlong; const ax = [1, 0, 0];
  const JN = ['waist', 'back', 'neck', 'shS', 'elS', 'wr', 'shO', 'elO'];
  const q0 = {}; for (const j of JN) q0[j] = M.jt[j].type === 'hinge' ? M.hingeAngle(j) : M.relQ(j);
  const gc0 = {}; for (const j of JN) gc0[j] = M.jt[j].type === 'hinge' ? dot(M.gravComp(j), M.hingeAxis(j)) : M.gravComp(j);
  mus.prime(gc0);
  const hand0 = M.a.wr.slice(); const pel0 = M.s.pelvis.p.slice();
  const rows = []; let resistDone = false, stalled = false, tHit = null, tOut = null, tip0 = null, b0 = null; let depthMax = 0, tStall = null;
  const n = Math.round(p.tEnd / DT);
  for (let i = 0; i < n; i++) {
    const s = M.s, a = M.a, t = M.t;
    const vPel = p.vL * smooth(t / p.tRamp);
    M.fixBody.setLinvel({ x: vPel, y: 0, z: 0 }, true);
    const b = M.bladeDir(); const r1 = a.wr, r2 = a.grip2; const vh = M.velAt('farmS', r1);
    const tip = M.bladePt(M.rTip); const vTip = M.velAt('sword', tip);
    const wS = s.sword.w;
    const on = t >= p.tArm;
    // 끝점 힘: 찌르는 줄 쪽으로 밀기(한도에 닿게 큰 값) + 줄에서 벗어난 만큼 되돌림 · 칼끝은 찌르는 줄에 맞춤
    const e = sub(r1, hand0); const eLat = perp(e, ax); const vLat = perp(vh, ax);
    let F = sub(scl(eLat, -p.Kl), scl(vLat, p.Dl)); if (on) F = adds(F, ax, p.F0);
    let axr = cross(b, ax); const sn = len(axr); const ang = Math.atan2(sn, dot(b, ax)); axr = sn > 1e-6 ? scl(axr, 1 / sn) : [0, 0, 0];
    const Mm = sub(scl(axr, p.Kth * ang), scl(perp(wS, b), p.Dth));
    const u = {}; const gcv = (j) => M.gravComp(j);
    const Mp = perp(Mm, b); const Mwd = clampLen(Mp, mus.capOf('wr'));
    const zf = nrm(perp(qrot(s.farmS.q, [0, 0, 1]), b)), zs = qrot(s.sword.q, [0, 0, 1]);
    const It = M.mp.sword.Ip[1]; const rollErr = Math.atan2(dot(cross(zs, zf), b), dot(zs, zf));
    const roll = scl(b, It * (40 * 40 * rollErr - 2 * 40 * dot(sub(wS, s.farmS.w), b)));
    const tauW = mus.drive({ wr: add(Mwd, gcv('wr')) }, { add: { wr: roll } }).wr;
    const Cc = twoHand ? scl(cross(b, sub(Mp, Mwd)), 1 / aG) : [0, 0, 0];
    const Mpass = twoHand ? Mwd : Mp; const Fh = twoHand ? scl(F, 0.5) : F;
    const F1 = sub(Fh, Cc), F2 = add(Fh, Cc);
    const jt1 = (j) => add(cross(sub(r1, a[j]), F1), Mpass), jt2 = (j) => cross(sub(r2, a[j]), F2);
    const stopU = (uj, th, w, lo, hi, I, cap) => { const need = (w * w * I) / (2 * cap) + 0.12; if (w < 0 && th - lo < need) return Math.max(uj, 2 * cap * clamp((need - (th - lo)) / 0.06, 0, 1)); if (w > 0 && hi - th < need) return Math.min(uj, -2 * cap * clamp((need - (hi - th)) / 0.06, 0, 1)); return uj; };
    const elStop = (j, uj) => { const axh = M.hingeAxis(j); const w = dot(M.relW(j), axh); return stopU(uj, M.hingeAngle(j), w, M.jt[j].lim[0], M.jt[j].lim[1], dot(axh, mv(M.compI(j, 'point'), axh)), mus.capOf(j, -Math.sign(w)) * mus.H.ecc); };
    u.elS = elStop('elS', dot(add(jt1('elS'), gcv('elS')), M.hingeAxis('elS')));
    u.shS = add(jt1('shS'), gcv('shS'));
    if (twoHand) { u.elO = elStop('elO', dot(add(jt2('elO'), gcv('elO')), M.hingeAxis('elO'))); u.shO = add(jt2('shO'), gcv('shO')); }
    else { u.elO = holdPDhinge(M, 'elO', q0.elO, 20, 1) + dot(gcv('elO'), M.hingeAxis('elO')); u.shO = add(holdPD(M, 'shO', q0.shO, 20, 1), gcv('shO')); }
    const jtT = (x) => add(add(cross(sub(r1, x), F1), twoHand ? cross(sub(r2, x), F2) : [0, 0, 0]), Mpass);
    for (const j of ['back', 'waist']) {
      const J = M.jt[j]; const yv = qrot(s[J.p].q, [0, 1, 0]);
      const post = perp(holdPD(M, j, [0, 0, 0, 1], p.wnPost, 1), yv);
      const qr = M.relQ(j); const th = 2 * Math.atan2(qr[1], qr[3]); const wr_ = dot(M.relW(j), yv);
      let axq = on ? dot(jtT(a[j]), yv) : dot(holdPD(M, j, q0[j], 30, 1), yv);
      axq = stopU(axq, th, wr_, J.lim.y[0], J.lim.y[1], dot(yv, mv(M.redI(j), yv)), mus.capOf(j)[1] * mus.H.ecc);
      u[j] = add(adds(post, yv, axq), gcv(j));
    }
    u.neck = add(holdPD(M, 'neck', q0.neck, 25, 1), gcv('neck'));
    const uh = qrot(s.uarmS.q, [1, 0, 0]);
    const tau = mus.drive({ back: u.back, waist: u.waist, neck: u.neck, shS: u.shS, elS: u.elS, shO: u.shO, elO: u.elO }, { twistPass: { shS: dot(tauW, uh) } });
    tau.wr = tauW;
    // 바깥 힘: 충격량(유효 질량 재기) · 저항(뚫는 동안)
    const forces = [];
    if (p.impulse && Math.abs(t - p.impulse.t) < DT / 2) forces.push({ body: 'sword', f: scl(b, -p.impulse.J / DT), at: tip });
    if (p.resist && !resistDone && !stalled && tip[0] >= p.resist.x0) {
      if (tHit == null) { tHit = t; tip0 = tip.slice(); b0 = b.slice(); }
      const depth = dot(sub(tip, tip0), b0); depthMax = Math.max(depthMax, depth);
      if (dot(vTip, b) < 0.3 && t > tHit) { stalled = true; tStall = t; } // 멈춤(더 못 뚫음)
      else if (depth < p.resist.depth) forces.push({ body: 'sword', f: scl(b, -p.resist.F), at: tip }); // 저항은 칼 축 쪽 (칼날이 든 길을 따라)
      else { resistDone = true; tOut = t; }
    }
    const row = { t, tipX: tip[0], vAx: dot(vTip, b), vTipX: vTip[0], hand: dot(vh, ax), handRel: dot(vh, ax) - vPel, vPel, el: M.hingeAngle('elS') / DEG, ang: ang / DEG, lat: len(eLat), tauSh: 0 };
    const r = M.step(tau, { forces });
    row.F = r.F; row.Mf = r.M; row.wExt = r.work.ext; row.tauSh = len(tau.shS); row.tauEl = len(tau.elS); row.chYaw = M.yawOf('chest') / DEG;
    rows.push(row);
    if (!Number.isFinite(r.e1)) { rows.bad = true; break; }
  }
  let iPk = 0; for (let i = 0; i < rows.length; i++) if (rows[i].vAx > rows[iPk].vAx) iPk = i;
  const sum = { vAx: rows[iPk].vAx, tPk: rows[iPk].t, tipXpk: rows[iPk].tipX, handRel: Math.max(...rows.map((r) => r.handRel)), hand: Math.max(...rows.map((r) => r.hand)), elAtPk: rows[iPk].el, reach: rows.at(-1).tipX - rows[0].tipX, latMax: Math.max(...rows.map((r) => r.lat)), tHit, tOut, through: resistDone, fxMax: Math.max(...rows.map((r) => Math.abs(r.F[0]))), fxPk: rows[iPk].F[0], bad: !!rows.bad };
  if (p.resist && tHit != null) { const seg = rows.filter((r) => r.t >= tHit && (tOut == null || r.t <= tOut)); sum.fxResist = Math.max(...seg.map((r) => r.F[0])); sum.fxResistMean = seg.reduce((a_, r) => a_ + r.F[0], 0) / seg.length; /* 받침이 몸을 앞으로 미는 힘 (+ = 다리가 밀어야 함) */ sum.vOut = tOut != null ? rows.find((r) => r.t >= tOut)?.vAx : 0; sum.vIn = rows.find((r) => r.t >= tHit).vAx; sum.depthMax = depthMax; sum.tStall = tStall; }
  M.free();
  return { rows, sum };
}
