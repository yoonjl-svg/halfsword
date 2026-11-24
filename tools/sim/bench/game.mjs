// ─────────────────────────────────────────────────────────────
//  game.mjs — 방식 (iii): 지금 게임 꼴의 기준 (src/fighter.js 의 값 · 식을 벤치 몸에 옮김 — 견줄 숫자를 내는 용도)
//   · 손 자리 서보: 패드 → rawHand(바라보는 방향 틀) → 두 마디 IK → 칼 어깨 명시 근육(k 320 · d 26 · 한도 80 × Hill 18 · 비틀기 60 / 1.92 ±48 · 무게 앞먹임) + 칼 팔꿈치 엔진 모터(k 400 · d 38 · 오차 ≤ 80/k × Hill 25) + 팔꿈치 무게 앞먹임
//   · 손목 서보: 칼 강체에 직접 토크 60·θ − 11·(ω − ω_겨눔) · 놓아주기(감쇠 1.5) · 상한 26(두손) / 22(한손) × Hill 30(30 ms 거름 · 버팀 1.3) · 날 세우기 4 / 0.12 는 상한 밖 · 반작용의 아래팔 축 몫은 가슴으로
//   · 빈손: 빈팔 IK + 끈(1500 N/m · 50 N·s/m · 250 N) · 빈팔 엔진 모터(400 / 36 / 140 · 240 / 20 / 100)
//   · 몸: 가슴 목표 0.7 × (−x × 0.35) + 몸의 호 2 × activity · 골반 반 · 2 차 따라가기 34 / 26 rad/s · 허리 0.45 : 등 0.55 엔진 모터(1800 / 180 / 500 · 1600 / 160 / 440)
//   · 골반 yaw: 받침 경첩의 엔진 모터 k 2500 · d 330 — 요구 토크가 상한을 넘으면 그 비로 k · d 를 낮춤 (게임의 닻 yaw 상한과 같은 식)
//   · 엔진: 풀이 6 × 내부 PGS 1 (게임 main.js) · 선 감쇠 0.05 · 회전 감쇠 0.4 (칼 팔 1.5 · 칼 0.3) · 배 관성 + 0.4 · 칼 팔 비틀림 + 0.004
//  옮기지 않은 것: 자세 지도(guards) · 보정 v2(corr) · 팔꿈치 돌림 · 몸 follow · 세로 follow · 손목 교정 · 관절 끝 스프링 · 걷기 · 균형 — 그래서 값은 게임과 같지 않다(맞춤 확인은 t_ref).
// ─────────────────────────────────────────────────────────────
import { Model, WEAPONS, DT, DEG, G, hill, add, sub, scl, adds, dot, cross, len, nrm, perp, clampLen, clamp, qrot, qconj, qmul, qaxis, qbasis, rotvec, mv, QA } from './lib.mjs';
import { cutDef, PAD, rawHand, guardDir, shares, omegas, summarize, AIM } from './cuts.mjs';

const TWIST_I_BASE = 0.0010137;
const smooth = (x, a, b) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const eulerYXZ = (yaw, pitch) => qmul(qaxis([0, 1, 0], yaw), qaxis([0, 0, 1], pitch)); // THREE Euler(0, yaw, pitch, 'YXZ')

export function runGame(R, o) {
  const p = { yawCap: 100, pgs: 1, vFinger: 12, tSettle: 0.8, tAfter: 0.6, strength: 1, ...o };
  const W = WEAPONS[p.weapon]; const twoHand = p.twoHand ?? W.twoHand;
  const C = cutDef(p.fam, p.size, W);
  const pad = PAD[p.fam];
  const M = new Model(R, { weapon: p.weapon, twoHand, pose: C.wind, legsI: p.legsI ?? 0.5, pgs: p.pgs, iters: 6, game: true, offJoint: false });
  const s0 = M.s;
  // 엔진 모터 켬 (힘 기준)
  const raw = (j) => M.jt[j].joint.rawSet;
  for (const j of ['waist', 'back', 'neck', 'shO']) for (let i = 0; i < 3; i++) raw(j).jointConfigureMotorModel(M.jt[j].joint.handle, 3 + i, 1);
  for (const j of ['elS', 'elO']) M.jt[j].joint.configureMotorModel(R.MotorModel.ForceBased);
  M.fixJoint.configureMotorModel(R.MotorModel.ForceBased);
  const mAim = (p.wristCap ?? (twoHand ? 26 : 22)) * p.strength; // wristCap: 접촉 벤치에서 손목 상한을 바꿔 볼 때만
  const hk = p.hook || null; hk?.init?.(M, { C, p });
  const pI = M.mp.sword.Ip; const lc = M.mp.sword.lc;
  const Ihand = Math.max(pI[0], pI[2]) + M.mp.sword.m * lc[1] * lc[1];
  const ts = p.weapon === 'longsword' ? 1 : pI[1] / TWIST_I_BASE;
  // 목표 길: 작게 = 패드 감기 자리 → 끝 자리를 12 m/s 로 (게임 대본) / 크게 = 큰 감은 자세의 손 · 칼끝 · 몸 → 같은 끝 자세로 같은 시간에
  const padLen = Math.hypot(pad.end[0] - pad.ch[0], pad.end[1] - pad.ch[1]); const tSweep = padLen / p.vFinger;
  const large = p.size === 'large';
  const qC0 = s0.chest.q; const hand0L = sub(M.a.wr, s0.chest.p); const blade0 = M.bladeDir();
  const hEnd = large || p.fam === 'horiz' ? sub(C.endHand, [0, 1.33, 0]) : rawHand(...pad.end);
  const st = { aim: [...pad.ch], aimV: [0, 0], vel: [0, 0], act: 0, pel: M.yawOf('pelvis'), pelV: 0, ch: M.yawOf('chest'), chV: 0, wristHill: null, brake: false, brakeAng: 0, prevAim: null, prevShT: null, prevFlex: null, prevPsi: null, u: 0, uV: 0 };
  const rows = []; let tCross = null, crossRow = null; let satN = 0, satC = 0; const impG = { v: 0 };
  const nSettle = Math.round(p.tSettle / DT), nTot = nSettle + Math.round((tSweep + p.tAfter) / DT);
  for (let i = 0; i < nTot; i++) {
    const s = M.s, a = M.a; const t = (i - nSettle) * DT; // 획 시작 = 0
    if (i >= nSettle) hk?.pre?.(M, i - nSettle);
    const u = clamp(t / tSweep, 0, 1); const padNow = [pad.ch[0] + (pad.end[0] - pad.ch[0]) * u, pad.ch[1] + (pad.end[1] - pad.ch[1]) * u];
    const padV = t > 0 && t < tSweep ? [(pad.end[0] - pad.ch[0]) / tSweep, (pad.end[1] - pad.ch[1]) / tSweep] : [0, 0];
    // skill.update: 손 빠르기 거르기 τ 40 ms · 휘두름 문턱 1.5 m/s · activity · 손 목표 2 차 거르기 14 / 24 rad/s
    for (let k = 0; k < 2; k++) st.vel[k] += (padV[k] - st.vel[k]) * (1 - Math.exp(-25 * DT));
    const swinging = Math.hypot(st.vel[0], st.vel[1]) > 1.5;
    st.act += ((swinging ? 1 : 0) - st.act) * (1 - Math.exp(-DT / (swinging ? 0.04 : 0.4)));
    const wF = swinging ? 24 : 14;
    for (let k = 0; k < 2; k++) { st.aimV[k] += (wF * wF * (padNow[k] - st.aim[k]) - 2 * wF * st.aimV[k]) * DT; st.aim[k] += st.aimV[k] * DT; }
    // 큰 감기: 같은 거르기를 0 → 1 몫에 (손 · 칼끝 · 몸 목표를 감은 자세 → 끝 자세로 섞음)
    st.uV += (wF * wF * (u - st.u) - 2 * wF * st.uV) * DT; st.u += st.uV * DT;
    // 몸 (updateBodyPose v2 · 숙련 0.7): 가슴 목표 · 골반 반 · 2 차 따라가기
    let cT, pT;
    if (large) { cT = (C.wind.pelYaw + C.wind.twist) + (C.endYaw.chest - (C.wind.pelYaw + C.wind.twist)) * u; pT = C.wind.pelYaw + (C.endYaw.pel - C.wind.pelYaw) * u; }
    else { const turn = -padNow[0] * 0.35; const arc = -st.aim[0] * 2 * st.act * 0.35; cT = 0.7 * turn + arc; pT = 0.5 * cT; }
    const spd = 0.3 + 0.7 * st.act;
    const fol = (key, tgt, w) => { st[key + 'V'] += (w * w * (tgt - st[key]) - 2 * w * st[key + 'V']) * DT; st[key] += st[key + 'V'] * DT; };
    fol('pel', pT, 34 * spd); fol('ch', cT, 26 * spd);
    // 골반 yaw: 받침 경첩 모터 (닻 yaw 상한 식)
    {
      const psi = M.yawOf('pelvis'); const e = Math.atan2(Math.sin(st.pel - psi), Math.cos(st.pel - psi));
      const wA = st.prevPsi == null ? 0 : (st.pel - st.prevPsi) / DT; st.prevPsi = st.pel;
      let kk = 2500, dd = 330; const tau = kk * e - dd * (s.pelvis.w[1] - wA);
      const sc = Math.min(1, p.yawCap / Math.max(1e-6, Math.abs(tau))); kk *= sc; dd *= sc;
      M.fixJoint.configureMotor(st.pel, wA, kk, dd);
    }
    // 허리 · 등 · 목: 엔진 위치 모터 (목표 오차를 max/k 로 자름)
    const twist = clamp(st.ch - st.pel, -0.8, 0.8);
    const tgtQ = { waist: eulerYXZ(twist * 0.45, 0), back: eulerYXZ(twist * 0.55, 0), neck: eulerYXZ(-clamp(st.ch, -0.8, 0.8), 0) };
    const motor3 = (j, qT, key) => {
      const J = M.jt[j]; const rvT = rotvec(qT), cur = rotvec(M.relQ(j)); const maxErr = J.game.max / J.game.k; const prev = st[key] || rvT;
      for (let k = 0; k < 3; k++) raw(j).jointConfigureMotor(J.joint.handle, 3 + k, cur[k] + clamp(rvT[k] - cur[k], -maxErr, maxErr), clamp((rvT[k] - prev[k]) / DT, -15, 15), J.game.k, J.game.d);
      st[key] = rvT;
    };
    motor3('waist', tgtQ.waist, 'pW'); motor3('back', tgtQ.back, 'pB'); motor3('neck', tgtQ.neck, 'pN');
    // 손 목표 (바라보는 방향 틀 · 가슴 자리에 더함) → 팔 IK (가슴 틀)
    let handL, aimDir;
    if (large) { handL = adds(hand0L, sub(hEnd, hand0L), st.u); aimDir = nrm(adds(blade0, sub(C.endBlade, blade0), st.u)); if (len(aimDir) < 0.2) aimDir = C.endBlade; }
    else { handL = p.fam === 'horiz' ? adds(rawHand(...st.aim), sub(hEnd, rawHand(...pad.end)), smooth(st.u, 0.5, 1)) : rawHand(...st.aim); aimDir = nrm(guardDir(...st.aim)); }
    const target = add(s.chest.p, handL);
    const qc = s.chest.q; const qci = qconj(qc);
    const acc = {}; const addT = (n, v) => { acc[n] = acc[n] ? add(acc[n], v) : v; };
    const gravT = (names, pivot) => { let tq = [0, 0, 0]; for (const n of names) tq = add(tq, cross(sub(s[n].c, pivot), [0, -M.mp[n].m * G, 0])); return tq; };
    {
      const T = qrot(qci, sub(target, s.chest.p)); const S = [0, 0.1, 0.2]; const aL = 0.3, bL = 0.27;
      const D = sub(T, S); const d = clamp(len(D), 0.08, aL + bL - 0.005); const Dn = nrm(D);
      let pDir = perp(nrm([-0.25, -1, 0.5]), Dn); if (len(pDir) < 1e-3) pDir = [0, -1, 0]; pDir = nrm(pDir);
      const alpha = Math.acos(clamp((aL * aL + d * d - bL * bL) / (2 * aL * d), -1, 1));
      const uu = add(scl(Dn, Math.cos(alpha)), scl(pDir, Math.sin(alpha)));
      const flex = Math.PI - Math.acos(clamp((aL * aL + bL * bL - d * d) / (2 * aL * bL), -1, 1));
      let yA = perp(sub(scl(Dn, d), scl(uu, aL)), uu); if (len(yA) < 1e-6) yA = perp([0, 1, 0], uu); yA = nrm(yA);
      const qT = qbasis(uu, yA, cross(uu, yA)); // 가슴 기준 위팔 목표
      // 칼 어깨: manualMuscle (명시)
      const qp = qc, qcU = s.uarmS.q; const k = 320, d_ = 26, maxT = 80 * p.strength;
      const mE = rotvec(qmul(qmul(qp, qT), qconj(qcU))); const mW = sub(s.uarmS.w, s.chest.w);
      const bone = qrot(qcU, [1, 0, 0]); const eTw = dot(mE, bone), wTw = dot(mW, bone); const wSw = perp(mW, bone);
      let wT = [0, 0, 0]; if (st.prevShT) { wT = qrot(qp, scl(rotvec(qmul(qT, qconj(st.prevShT))), 1 / DT)); wT = clampLen(wT, 20); } st.prevShT = qT;
      let mT = scl(perp(mE, bone), k); mT = adds(mT, perp(sub(mW, wT), bone), -d_);
      let mG = scl(gravT(['uarmS', 'farmS', 'sword'], a.shS), -1); const twistFF = clamp(dot(mG, bone), -10, 10); mG = perp(mG, bone);
      mT = add(mT, mG);
      const tl = len(mT); const cap = maxT * hill(tl > 1e-6 ? dot(wSw, mT) / tl : 0, 18, 0.25, 1.4); if (tl > cap) mT = scl(mT, cap / tl);
      mT = adds(mT, bone, clamp(eTw * 60 - wTw * 1.92, -48, 48) + twistFF);
      addT('uarmS', mT); addT('chest', scl(mT, -1));
      // 칼 팔꿈치: 엔진 모터 + 무게 앞먹임
      const J = M.jt.elS; const cur = M.hingeAngle('elS'); const ax = M.hingeAxis('elS'); const wRel = dot(M.relW('elS'), ax);
      const mErr = (J.game.max * p.strength / J.game.k) * hill(Math.sign(flex - cur || 1) * wRel, 25, 0.25, 1.4);
      const vz = clamp(st.prevFlex == null ? 0 : (flex - st.prevFlex) / DT, -15, 15); st.prevFlex = flex;
      J.joint.configureMotor(cur + clamp(flex - cur, -mErr, mErr), vz, J.game.k * p.strength, J.game.d * Math.sqrt(p.strength));
      const tg = -dot(gravT(['farmS', 'sword'], a.elS), ax) * Math.min(1, p.strength);
      addT('farmS', scl(ax, tg)); addT('uarmS', scl(ax, -tg));
    }
    // 손목 서보 (driveSword)
    const b = M.bladeDir(); const wS = s.sword.w; let wristSat = 0, capW = 0, tauWr = [0, 0, 0];
    {
      let wAim = [0, 0, 0]; if (st.prevAim) { wAim = scl(cross(st.prevAim, aimDir), 1 / DT); wAim = clampLen(wAim, 25); } st.prevAim = aimDir;
      const axis = cross(b, aimDir); const sinA = len(axis); const angle = Math.atan2(sinA, dot(b, aimDir));
      const leadK = twoHand ? 1 : 1.5;
      let tq = sinA > 1e-5 ? scl(axis, (60 * angle) / sinA * leadK) : [0, 0, 0];
      const wTwist = scl(b, dot(wS, b)); const wSwing = sub(wS, wTwist); wAim = perp(wAim, b);
      let cap = mAim; let damp = 11;
      if (sinA > 1e-5) {
        const toward = dot(wSwing, axis) / sinA, tgtSp = dot(wAim, axis) / sinA;
        if (st.brake && (toward < 1 || angle > st.brakeAng + 0.35)) st.brake = false;
        if (!st.brake && toward > 3 && toward > tgtSp && angle > 0.25) {
          const stopAngle = (toward * toward) / (2 * ((cap * 1.3) / Ihand));
          if (angle * leadK > stopAngle * 1.4) damp = 1.5; else { st.brake = true; st.brakeAng = angle; }
        }
      }
      tq = adds(tq, sub(wSwing, wAim), -damp);
      const mG = scl(gravT(['sword'], a.wr), -Math.min(1, p.strength)); tq = add(tq, mG);
      const fw = s.farmS.w; const tl = len(tq); const vAlong = tl > 1e-6 ? dot(sub(wS, fw), tq) / tl : 0;
      const h = hill(vAlong, 30 * Math.sqrt(p.strength), 0.25, 1.3); st.wristHill = (st.wristHill ?? h) + (h - (st.wristHill ?? h)) * Math.min(1, DT / 0.03);
      cap *= st.wristHill; capW = cap; if (tl > cap) { tq = scl(tq, cap / tl); wristSat = 1; } else wristSat = tl >= 0.98 * cap ? 1 : 0;
      // 날 세우기 (상한 밖)
      const flat = qrot(s.sword.q, [0, 0, 1]); let ft = perp([0, 0, 1], b); if (len(ft) < 1e-2) ft = flat; ft = nrm(ft); if (dot(ft, flat) < 0) ft = scl(ft, -1);
      const ev_ = perp(M.velAt('sword', M.bladePt(W.hiltLength + 0.6 * W.bladeLength)), b); const ev = len(ev_); const moving = smooth(ev, 0.5, 2.5);
      if (moving > 0) { let mf = nrm(cross(b, ev_)); if (dot(mf, flat) < 0) mf = scl(mf, -1); ft = nrm(adds(scl(ft, 1 - moving), mf, moving)); if (len(ft) < 1e-2) ft = mf; }
      const tw = adds(scl(b, dot(cross(flat, ft), b) * 4 * ts), wTwist, -0.12 * ts);
      tq = add(tq, tw); tauWr = tq;
      addT('sword', tq);
      const fa = qrot(s.farmS.q, [1, 0, 0]); const along = dot(tq, fa);
      addT('farmS', scl(adds(tq, fa, -along), -1)); addT('chest', scl(fa, -along));
    }
    // 빈손: 빈팔 IK(엔진 모터) + 끈
    const forces = [];
    {
      const gripAim = twoHand ? adds(a.wr, aimDir, W.gripAlong) : add(s.chest.p, qrot(qc, [0.12, -0.32, -0.26]));
      const T = qrot(qci, sub(gripAim, s.chest.p)); const S = [0, 0.1, -0.2]; const aL = 0.3, bL = 0.275;
      const D = sub(T, S); const d = clamp(len(D), 0.08, aL + bL - 0.005); const Dn = nrm(D);
      let pDir = perp(nrm([-0.25, -1, -0.5]), Dn); if (len(pDir) < 1e-3) pDir = [0, -1, 0]; pDir = nrm(pDir);
      const alpha = Math.acos(clamp((aL * aL + d * d - bL * bL) / (2 * aL * d), -1, 1));
      const uu = add(scl(Dn, Math.cos(alpha)), scl(pDir, Math.sin(alpha)));
      const flex = Math.PI - Math.acos(clamp((aL * aL + bL * bL - d * d) / (2 * aL * bL), -1, 1));
      let xA = perp(sub(scl(Dn, d), scl(uu, aL)), uu); if (len(xA) < 1e-6) xA = perp([1, 0, 0], uu); xA = nrm(xA);
      const yA = scl(uu, -1); const qT = qbasis(xA, yA, cross(xA, yA));
      motor3('shO', qT, 'pSO');
      const J = M.jt.elO; const cur = M.hingeAngle('elO'); const mErr = J.game.max / J.game.k;
      const vz = clamp(st.prevFlexO == null ? 0 : (flex - st.prevFlexO) / DT, -15, 15); st.prevFlexO = flex;
      J.joint.configureMotor(cur + clamp(flex - cur, -mErr, mErr), vz, J.game.k, J.game.d);
      if (twoHand) {
        const pom = a.grip2, hand = a.handO; const dist = len(sub(pom, hand));
        if (dist <= 0.25) {
          const grab = clamp((0.25 - dist) / 0.125, 0, 1);
          let F = adds(scl(sub(pom, hand), 1500), sub(M.velAt('sword', pom), M.velAt('farmO', hand)), 50); F = clampLen(scl(F, grab), 250);
          forces.push({ body: 'farmO', f: F, at: hand }, { body: 'sword', f: scl(F, -1), at: pom });
        }
      }
    }
    // ── 스텝 (명시 토크는 몸마다 바로 건다) ──
    const P70 = M.bladePt(M.r70), vP = M.velAt('sword', P70); const vh = M.velAt('farmS', a.wr);
    const row = { t, phase: t < 0 ? 'settle' : 'servo', P70, vP, v70: len(vP), tip: len(M.velAt('sword', M.bladePt(M.rTip))), hand: len(vh), keS: M.swordKE(), b, r1: a.wr };
    row.share = shares(M, P70, vP); row.om = omegas(M); row.tau = { wr: len(tauWr) }; row.capW = capW;
    row.qCh = s.chest.q; row.pelYaw = M.yawOf('pelvis'); row.chYaw = M.yawOf('chest'); row.sC = dot(sub(P70, C.T), C.d); row.dev = dot(sub(P70, C.T), C.n);
    for (const n in M.rb) { M.rb[n].resetForces(true); M.rb[n].resetTorques(true); }
    const m0 = M.mech();
    for (const n in acc) M.rb[n].addTorque({ x: acc[n][0], y: acc[n][1], z: acc[n][2] }, true);
    for (const f of forces) M.rb[f.body].addForceAtPoint({ x: f.f[0], y: f.f[1], z: f.f[2] }, { x: f.at[0], y: f.at[1], z: f.at[2] }, true);
    M.world.step(M.evq || undefined); M.t += DT; M.sense();
    if (i >= nSettle) hk?.post?.(M, i - nSettle, row);
    const m1 = M.mech();
    // 받침이 준 힘 · 모멘트 (명시 토크 · 끈은 몸 안 쌍이라 합 0)
    const Ff = add(scl(sub(m1.P, m0.P), 1 / DT), [0, M.mTot * G, 0]); const gy = scl(add(m0.gyro, m1.gyro), 0.5);
    const Mf = sub(sub(scl(sub(m1.L, m0.L), 1 / DT), scl(add(m0.tg, m1.tg), 0.5)), gy);
    row.F = Ff; row.Mf = [Mf[0], 0, Mf[2]]; row.ground = Mf[1]; // 받침 yaw 모멘트 = 닻 모터가 준 토크 (엔진 감쇠의 몫 포함)
    if (t >= 0) impG.v += row.ground * DT; row.impG = impG.v; row.Ly = m1.L[1];
    row.E = m1.e; row.W = 0; row.resid = 0; row.work = {}; row.gap = twoHand ? len(sub(M.a.handO, M.a.grip2)) : 0; row.sat = { wr: wristSat, ground: Math.abs(row.ground) >= 0.98 * p.yawCap ? 1 : 0 };
    row.elS = M.hingeAngle('elS') / DEG;
    if (t >= 0) rows.push(row);
    const sNow = dot(sub(M.bladePt(M.r70), C.T), C.d);
    if (t >= 0 && tCross == null && row.sC < 0 && sNow >= 0 && M.bladePt(M.r70)[0] > 0.2) { const f = -row.sC / (sNow - row.sC); tCross = t + f * DT; crossRow = rows.length - 1; }
    if (!Number.isFinite(m1.e) || m1.ke > 5000) { rows.bad = true; break; }
  }
  const mus = { capOf: (j) => (j === 'wr' ? mAim : 1) };
  const sum = summarize(rows, { C, M, mus, p, tCross, crossRow, twoHand, game: true });
  sum.windInfo = M.poseInfo; sum.Ihand = Ihand;
  M.free();
  return { rows, sum, C };
}
