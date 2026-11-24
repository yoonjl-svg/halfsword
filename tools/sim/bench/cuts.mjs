// ─────────────────────────────────────────────────────────────
//  cuts.mjs — 베기 정의(감은 자세 · 겨눈 선 · 끝 자세)와 제어 방식 (i) 끝점 힘 자코비안 전치 · (ii) 차례 활성. 재기 · 요약.
//   겨눈 선 = 앞(+x)으로 뻗은 줄 y = 1.40 · z = 0.10 (게임 패드 가운데 줄). 획 방향 d: 빗겨 (0,−1,−1)/√2 · 세로 (0,−1,0) · 가로 (0,0,−1).
//   베는 면 법선 n = x̂ × d (칼이 도는 축 · 이쪽으로 돌면 겨눈 선에서 칼날이 d 로 간다). 겨눈 선 넘는 때 = (P₇₀ − T)·d 가 0 을 지나는 때.
//   정확도 = 그때 P₇₀ 가 겨눈 선에서 벗어난 거리의 면 밖 몫 |(P₇₀ − T)·n|.
// ─────────────────────────────────────────────────────────────
import { Model, Muscles, holdPD, holdPDhinge, hill, rotvec, madd, mpara, WEAPONS, DT, DEG, G, add, sub, scl, adds, dot, cross, len, nrm, perp, clampLen, clamp, qrot, qconj, qmul, qaxis, mv, fmt } from './lib.mjs';

export const AIM = { y: 1.4, z: 0.1 };
const S2 = Math.SQRT1_2;
export const FAMS = {
  diag: { d: [0, -S2, -S2], ko: '빗겨' },
  vert: { d: [0, -1, 0], ko: '세로' },
  horiz: { d: [0, 0, -1], ko: '가로' },
};
// 게임 패드 → 손 · 칼끝 (src/fighter.js rawHand · guardDir — 두손 꼴) · 패드 자리 (tools/sim/corr_lib.mjs PAD · FAM)
export const PAD = { diag: { ch: [0.42, 0.42], end: [-0.4, -0.42] }, vert: { ch: [0.02, 0.52], end: [0, -0.5] }, horiz: { ch: [0.52, 0.03], end: [-0.52, 0.03] } };
export function rawHand(x, y) { const Rr = 0.62; return [0.12 + 0.5 * Math.sqrt(Math.max(0, 1 - (x * x + y * y) / (Rr * Rr))), 0.1 + y, 0.1 + x]; }
export function guardDir(x, y) {
  const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
  const az = clamp((x - 0.05) * 1.7, -1.1, 1.3); const c = Math.cos(el);
  return [c * Math.cos(az), Math.sin(el), c * Math.sin(az)];
}
const CH0 = [0, 1.33, 0]; // 곧게 선 가슴 무게중심

/**
 * 베기 한 칸의 기하. size: 'small' = 지금 게임(패드 감기 자리의 손 · 칼끝 · 몸 돌림 0.7 × −x × 0.35 · 골반 반) / 'large' = 기준 클립 큰 베기 꼴
 *  (골반 −32° · 가슴 −70° — 끝 자세까지 골반 약 65 ~ 75° · 가슴 120 ~ 140° 를 돌게 · 칼끝이 가슴 뒤).
 */
export function cutDef(fam, size, W) {
  const F = FAMS[fam]; const d = F.d; const n = cross([1, 0, 0], d);
  const r70 = W.hiltLength + 0.7 * W.bladeLength;
  let wind, endYaw;
  const pad = PAD[fam];
  if (size === 'small') {
    const cT = 0.7 * -pad.ch[0] * 0.35;
    wind = { pelYaw: 0.5 * cT, twist: 0.5 * cT, frame: 'heading', hand: rawHand(...pad.ch), blade: guardDir(...pad.ch) };
    const cE = 0.7 * -pad.end[0] * 0.35 * 3; // 휘두르는 동안 몸의 호 (1 + trunkArc 2) 배
    endYaw = { pel: 0.5 * cE, chest: cE };
  } else {
    if (fam === 'diag') wind = { pelYaw: -32 * DEG, twist: -38 * DEG, frame: 'chest', hand: [-0.02, 0.32, 0.3], blade: [-0.75, 0.45, 0.5] };
    else if (fam === 'vert') wind = { pelYaw: 0, twist: 0, lean: 0.2, frame: 'chest', hand: [0.0, 0.5, 0.12], blade: [-0.9, 0.25, 0.05], pole: [0.5, 0, 0.85], poleO: [0.5, 0, -0.85] };
    else wind = { pelYaw: -32 * DEG, twist: -38 * DEG, frame: 'chest', hand: [0.12, 0.1, 0.36], blade: [-0.72, 0.08, 0.69], pole: [-0.5, -0.45, 0.75], poleO: [0.3, -0.9, -0.3] };
    endYaw = fam === 'vert' ? { pel: 0, chest: 0 } : { pel: 35 * DEG, chest: 60 * DEG };
  }
  // 겨눈 선 넘는 자리의 손(세계) · 끝 자세(세계 — 게임 패드 끝 자리의 손 · 칼끝, 가로는 칼 팔이 닿게 당김)
  const via = fam === 'diag' ? [0.45, 1.4, 0.14] : fam === 'vert' ? [0.45, 1.47, 0.1] : [0.47, 1.4, 0.16];
  const eh = rawHand(...pad.end); const endHand = fam === 'horiz' ? [0.38, 1.4, -0.24] : add(CH0, eh);
  const endBlade = nrm(guardDir(...pad.end));
  const dy = via[1] - AIM.y, dz = via[2] - AIM.z; const T = [via[0] + Math.sqrt(Math.max(0.01, r70 * r70 - dy * dy - dz * dz)), AIM.y, AIM.z];
  const leanEnd = fam === 'vert' ? -0.25 : fam === 'diag' ? -0.1 : 0;
  return { fam, size, d, n, wind, via, endHand, endBlade, endYaw, T, r70, leanEnd };
}

/** 꺾은선 길 따라가기: 지금 자리 r 에서 길 위 가장 가까운 점(뒤로는 안 감)보다 L 앞선 점 */
class Path {
  constructor(pts) { this.pts = pts; this.seg = []; let s = 0; for (let i = 0; i + 1 < pts.length; i++) { const l = len(sub(pts[i + 1], pts[i])); this.seg.push({ a: pts[i], b: pts[i + 1], s0: s, l }); s += l; } this.L = s; this.sCur = 0; }
  at(s) { s = clamp(s, 0, this.L); for (const g of this.seg) if (s <= g.s0 + g.l || g === this.seg[this.seg.length - 1]) return adds(g.a, sub(g.b, g.a), clamp((s - g.s0) / g.l, 0, 1)); return this.pts[this.pts.length - 1]; }
  ahead(r, L) {
    let best = this.sCur, bd = Infinity;
    for (const g of this.seg) { const ab = sub(g.b, g.a); const u = clamp(dot(sub(r, g.a), ab) / (g.l * g.l), 0, 1); const s = g.s0 + u * g.l; if (s < this.sCur - 1e-9) continue; const dd = len(sub(r, adds(g.a, ab, u))); if (dd < bd) { bd = dd; best = s; } }
    this.sCur = Math.max(this.sCur, best);
    return this.at(this.sCur + L);
  }
}

export const DEFAULTS = {
  yawCap: 135, strength: 1, wristCap: null, human: 'src', legsI: 0.5, pgs: 4,
  // (i) 끝점 PD (칼자루 자리 · 칼끝 방향 → 힘 · 모멘트)
  Kx: 1500, Dx: 60, Kth: 80, Dth: 8, Fmax: 1500,
  // (ii) 차례 활성: 몰기 크기(모든 관절이 한도에 닿게 큰 값 — 방향만 뜻이 있다) · 관절이 켜지는 때 (s)
  F0: 1000, M0: 100, tSh: 0.06, tEl: 0.1, tWr: 0.14, tBk: 0, look: 0.3,
  Kn: 2500, Dn: 80, kEps: 2,
  // 벤 뒤 멈춤: 관절마다 관성에 맞춘 감쇠(고유 진동수 wnBrake)를 사람 한도 안에서
  wnBrake: 40,
  wnHold: 30, wnYaw: 12, KyawG: 300, pelHard: 58 * DEG, pelLim: 45 * DEG, Ibrake: 1.5, IchBrake: 2.5, elMargin: 0.12, groundVmax: 0, wnPost: 20, tEnd: 0.9, wristPassive: false, hold: true, gateTrunkM: true,
};

/**
 * 베기 한 번. o: { weapon, fam, size, style: 'i' | 'ii', twoHand?, yawCap, strength, wristCap, ... DEFAULTS 덮어쓰기 }
 *  → { rows(스텝마다), sum(요약) }
 */
export function runCut(R, o) {
  const p = { ...DEFAULTS, ...o };
  const W = WEAPONS[p.weapon]; const twoHand = p.twoHand ?? W.twoHand;
  const C = cutDef(p.fam, p.size, W);
  const M = new Model(R, { weapon: p.weapon, twoHand, pose: C.wind, legsI: p.legsI, pgs: p.pgs, iters: p.iters, offJoint: p.offJoint, pelHard: p.pelHard });
  const mus = new Muscles(M, { human: p.human, strength: p.strength, cap: { ...(p.wristCap != null ? { wrist: p.wristCap } : {}), ...(p.cap || {}) }, vmax: p.vmax, tAct: p.tAct, hill: p.hill, hillAvg: p.hillAvg, hillImp: p.hillImp, ecc: p.ecc });
  const hk = p.hook || null; hk?.init?.(M, { C, p, mus }); // 접촉 벤치 고리 (contact.mjs) — 없으면 아무 일도 안 한다
  const aG = -W.gripAlong;
  const JN = ['waist', 'back', 'neck', 'shS', 'elS', 'wr', 'shO', 'elO'];
  // 처음 자세의 관절 상대 회전 (버팀 목표)
  const q0 = {}; for (const j of JN) q0[j] = M.jt[j].type === 'hinge' ? M.hingeAngle(j) : M.relQ(j);
  const gc0 = {}; for (const j of JN) gc0[j] = M.jt[j].type === 'hinge' ? dot(M.gravComp(j), M.hingeAxis(j)) : M.gravComp(j);
  mus.prime(gc0);
  const hand0 = M.a.wr.slice(); const qSw0 = qmul(qconj(M.s.chest.q), M.s.sword.q);
  // 끝 자세를 가슴 틀로 (가슴이 끝 yaw 에 왔을 때 세계 끝 자세와 같아지게) — 칼 어깨에서 팔 길이 안으로 자름
  const qCe = qaxis([0, 1, 0], C.endYaw.chest);
  let endHandC = qrot(qconj(qCe), sub(C.endHand, [0, 1.33, 0])); { const dS = sub(endHandC, [0, 0.1, 0.2]); if (len(dS) > 0.54) endHandC = adds([0, 0.1, 0.2], nrm(dS), 0.54); }
  const endBladeC = qrot(qconj(qCe), C.endBlade);
  const mid = p.fam === 'vert' ? null : (p.size === 'large' ? (p.fam === 'diag' ? [0.1, 1.62, 0.36] : [0.12, 1.42, 0.44]) : null);
  const path = new Path([hand0, ...(mid ? [mid] : []), C.via, C.endHand]);
  const leanQ = (share) => qaxis([0, 0, 1], C.leanEnd * 0.5); // 허리 · 등 반반
  const rows = []; let phase = p.style === 'ii' ? 'drive' : 'servo'; let tCross = null, sPrev = null, crossRow = null;
  const E0 = M.mech().e; let W_ = {}, impG = 0, impGabs = 0; const acc = (k, v) => { W_[k] = (W_[k] || 0) + v; };
  let tBrake = null;
  const nSteps = Math.round(p.tEnd / DT);
  let residMax = 0;
  for (let i = 0; i < nSteps; i++) {
    const ctl = hk?.pre?.(M, i) || null; // { relax: 'trunk' | 'limp' } — 닿는 순간부터 근육을 푼다
    const s = M.s, a = M.a, t = M.t;
    const b = M.bladeDir(); const r1 = a.wr, r2 = a.grip2; const vh = M.velAt('farmS', r1);
    const P70 = M.bladePt(M.r70); const vP = M.velAt('sword', P70);
    const wS = s.sword.w; const wSp = perp(wS, b);
    // ── 끝점에서 바라는 힘 F(칼자루) · 모멘트 Mm(칼) ──
    let F, Mm, gate = { sh: true, el: true, wr: true, bk: true };
    if (phase === 'drive') {
      gate = { sh: t >= p.tSh, el: t >= p.tEl, wr: t >= p.tWr, bk: t >= p.tBk };
      const tgt = path.ahead(r1, p.look);
      const g = nrm(sub(tgt, r1));
      // 면 지키기: 칼날 70 % 점이 베는 면에서 벗어난 만큼 손을 면 쪽으로 (겨눈 선 1 m 안에서 차츰)
      const dev = dot(sub(P70, C.T), C.n), vn = dot(vP, C.n);
      const near = clamp(1 - Math.abs(dot(sub(P70, C.T), C.d)) / 1.0, 0, 1);
      F = adds(scl(g, p.F0), C.n, clamp(-(p.Kn * dev + p.Dn * vn) * near, -0.7 * p.F0, 0.7 * p.F0));
      if (gate.wr) {
        // 풀림: 칼을 베는 면 법선 둘레로 돌린다 + 칼날을 면 안으로
        const sw = nrm(perp(C.n, b)); const eps = dot(b, C.n); const corr = nrm(cross(b, C.n));
        Mm = scl(nrm(adds(sw, corr, -p.kEps * eps)), p.M0);
      } else {
        // 버팀: 칼을 가슴 틀의 감은 방향에 붙든다 (관성에 맞춘 PD — 손목 한도 + 두 손 짝힘 안에서)
        const e = rotvec(qmul(qmul(s.chest.q, qSw0), qconj(s.sword.q)));
        const Is = madd(M.Iw('sword'), mpara(M.mp.sword.m, sub(s.sword.c, r1)));
        Mm = p.hold ? mv(Is, sub(scl(e, p.wnHold * p.wnHold), scl(sub(wS, s.chest.w), 2 * p.wnHold))) : [0, 0, 0];
      }
    } else {
      const brake = phase === 'brake';
      const Kx = p.Kx, Dx = p.Dx, Kth = p.Kth, Dth = p.Dth;
      // (i) 손 · 칼끝 목표는 가슴 틀(몸통이 돌면 실려 간다) — 벤 뒤 멈춤은 세계 틀 끝 자세
      let xT = C.endHand, dT = C.endBlade, vT = [0, 0, 0], wT = [0, 0, 0];
      if (!brake) { xT = add(s.chest.p, qrot(s.chest.q, endHandC)); dT = qrot(s.chest.q, endBladeC); vT = add(s.chest.v, cross(s.chest.w, sub(xT, s.chest.c))); wT = s.chest.w; }
      F = clampLen(sub(scl(sub(xT, r1), Kx), scl(sub(vh, vT), Dx)), p.Fmax);
      let ax = cross(b, dT); const sn = len(ax); const ang = Math.atan2(sn, dot(b, dT));
      ax = sn > 1e-4 ? scl(ax, 1 / sn) : nrm(perp(C.n, b));
      if (ang > 120 * DEG && dot(ax, C.n) < 0.3) ax = nrm(perp(C.n, b)); // 반 바퀴 넘게 남았으면 베는 면 쪽으로 돈다 (짧은 쪽이 거꾸로일 수 있다)
      Mm = sub(scl(ax, Kth * ang), scl(perp(sub(wS, wT), b), Dth));
      if (brake) {
        // 벤 뒤 멈춤 (온 힘으로): 끝점 목표 없이 칼의 돎을 멈추는 모멘트(관성에 맞춘 감쇠 · 손목 한도 + 두 손 짝힘 안) — 관절마다의 상대 각속도 제동은 아래에서 더한다
        const Is = madd(M.Iw('sword'), mpara(M.mp.sword.m, sub(s.sword.c, r1)));
        F = [0, 0, 0]; Mm = mv(Is, scl(perp(wS, b), -2 * p.wnBrake));
      }
    }
    const brk = phase === 'brake';
    const dampJ = (j) => (brk ? mv(M.redI(j), scl(M.relW(j), -2 * p.wnBrake)) : [0, 0, 0]);
    // ── 먼 쪽 → 몸 쪽으로 나눔 ──
    const u = {};
    const gcv = (j) => M.gravComp(j);
    const Mp = perp(Mm, b);
    // 손목: 한도까지 · 못 낸 몫은 두 손 짝힘(팔 관절)으로 — 한손이면 몸 쪽 관절이 온 값으로 받는다
    const Mwd = clampLen(Mp, mus.capOf('wr'));
    u.wr = p.wristPassive && phase === 'drive' && gate.wr ? gcv('wr') : add(Mwd, gcv('wr'));
    // 칼날 축 굴림 버팀 (관성에 맞춘 작은 PD — 쥔 손이 칼 굴림을 붙든다): 칼 면 법선 → 아래팔 경첩 축
    const zf = nrm(perp(qrot(s.farmS.q, [0, 0, 1]), b)), zs = qrot(s.sword.q, [0, 0, 1]);
    const It = M.mp.sword.Ip[1]; const rollErr = Math.atan2(dot(cross(zs, zf), b), dot(zs, zf));
    const roll = scl(b, It * (40 * 40 * rollErr - 2 * 40 * dot(sub(wS, s.farmS.w), b)));
    const tauW = mus.drive({ wr: u.wr }, { add: { wr: roll } }).wr;
    const Cc = twoHand ? scl(cross(b, sub(Mp, Mwd)), 1 / aG) : [0, 0, 0];
    const Mpass = twoHand ? Mwd : Mp;
    const Fh = twoHand ? scl(F, 0.5) : F;
    const f1 = (on) => sub(on ? Fh : [0, 0, 0], Cc), f2 = (on) => add(on ? Fh : [0, 0, 0], Cc);
    const jt1 = (j, on) => add(cross(sub(r1, a[j]), f1(on)), Mpass);
    const jt2 = (j, on) => cross(sub(r2, a[j]), f2(on));
    const F1 = f1(true), F2 = f2(true);
    // 칼 팔
    const axE = M.hingeAxis('elS');
    u.elS = (gate.el || !p.hold ? 0 : holdPDhinge(M, 'elS', q0.elS, p.wnHold, 1)) + dot(add(add(jt1('elS', gate.el), gcv('elS')), dampJ('elS')), axE);
    u.shS = add(gate.sh || !p.hold ? [0, 0, 0] : holdPD(M, 'shS', q0.shS, p.wnHold, 1), add(add(jt1('shS', gate.sh), gcv('shS')), dampJ('shS')));
    // 관절 끝 멈춤 (근육 한도 안 · 미리 제동): 지금 빠르기로 멈출 각 ω²·I / (2τ) 이 끝까지 남은 각을 넘으면 되돌리는 쪽으로 한도 토크 — 엔진 한도에 부딪혀 에너지를 잃지 않게
    const stopU = (uj, th, w, lo, hi, I, cap) => {
      const need = (w * w * I) / (2 * cap) + p.elMargin;
      if (w < 0 && th - lo < need) return Math.max(uj, 2 * cap * clamp((need - (th - lo)) / 0.06, 0, 1));
      if (w > 0 && hi - th < need) return Math.min(uj, -2 * cap * clamp((need - (hi - th)) / 0.06, 0, 1));
      return uj;
    };
    const elStop = (j, uj) => { const ax = M.hingeAxis(j); const w = dot(M.relW(j), ax); return stopU(uj, M.hingeAngle(j), w, M.jt[j].lim[0], M.jt[j].lim[1], dot(ax, mv(M.compI(j, 'point'), ax)), mus.capOf(j, -Math.sign(w)) * mus.H.ecc); };
    // 빈팔
    const axEO = M.hingeAxis('elO');
    if (twoHand) {
      u.elO = (gate.el || !p.hold ? 0 : holdPDhinge(M, 'elO', q0.elO, p.wnHold, 1)) + dot(add(add(jt2('elO', gate.el), gcv('elO')), dampJ('elO')), axEO);
      u.shO = add(gate.sh || !p.hold ? [0, 0, 0] : holdPD(M, 'shO', q0.shO, p.wnHold, 1), add(add(jt2('shO', gate.sh), gcv('shO')), dampJ('shO')));
    } else {
      u.elO = holdPDhinge(M, 'elO', q0.elO, 20, 1) + dot(gcv('elO'), axEO);
      u.shO = add(holdPD(M, 'shO', q0.shO, 20, 1), gcv('shO'));
    }
    // 몸통: 축 돌림(비틀기) = 온 끝점 힘의 자코비안 전치의 축 몫 (한도 120) · 휨(숙임 · 옆) = 자세 버팀 PD (한도 300) — 세로 베기의 숙임은 자세 목표가 끝 숙임으로 가며 낸다
    const Mtr = Mp;
    const jtT = (x) => add(add(cross(sub(r1, x), twoHand ? F1 : F), twoHand ? cross(sub(r2, x), F2) : [0, 0, 0]), twoHand ? Mpass : Mtr);
    const twist = {};
    for (const j of ['back', 'waist']) {
      const J = M.jt[j]; const qp = s[J.p].q; const yv = qrot(qp, [0, 1, 0]);
      const post = perp(holdPD(M, j, leanQ(), p.wnPost, 1), yv);
      const qr = M.relQ(j); const th = 2 * Math.atan2(qr[1], qr[3]); const wr_ = dot(M.relW(j), yv); twist[j] = th;
      let ax;
      if (phase === 'drive') {
        // (ii) 몸통 비틀기: 가슴 yaw 를 끝 자세 각으로 — 한도 토크로 몰다가 멈출 거리(ω²/2a)가 남은 각을 넘으면 제동
        const chY = M.yawOf('chest'), wC = s.chest.w[1]; const capA = mus.capOf(j)[1]; const aC = capA / p.IchBrake;
        const pred = chY + (wC * Math.abs(wC)) / (2 * aC);
        ax = j === 'back' && !gate.bk ? dot(holdPD(M, j, q0[j], 30, 1), yv) : capA * clamp((C.endYaw.chest - pred) / (4 * DEG), -1, 1) * 2;
      } else if (brk) ax = dot(dampJ(j), yv) + dot(jtT(a[j]), yv);
      else {
        ax = dot(jtT(a[j]), yv);
        if (phase === 'servo') { const chY = M.yawOf('chest'); ax += dot(yv, mv(M.redI(j), yv)) * (p.wnYaw * p.wnYaw * (C.endYaw.chest - chY) - 2 * p.wnYaw * s.chest.w[1]) * 0.5; } // (i) 몸통 자세 목표 = 끝 yaw (허리 · 등 반반)
      }
      // 비틀림 한도 앞 미리 제동 (근육 한도 안)
      ax = stopU(ax, th, wr_, J.lim.y[0], J.lim.y[1], dot(yv, mv(M.redI(j), yv)), mus.capOf(j)[1] * mus.H.ecc);
      u[j] = add(adds(post, yv, ax), gcv(j));
    }
    u.neck = add(holdPD(M, 'neck', q0.neck, 25, 1), gcv('neck'));
    u.elS = elStop('elS', u.elS); if (twoHand) u.elO = elStop('elO', u.elO);
    const uh = qrot(s.uarmS.q, [1, 0, 0]);
    const tau = mus.drive({ back: u.back, waist: u.waist, neck: u.neck, shS: u.shS, elS: u.elS, shO: u.shO, elO: u.elO }, { twistPass: { shS: dot(tauW, uh) } });
    tau.wr = tauW;
    // 땅 yaw 예산: 자코비안 전치의 수직축 몫. 골반 yaw 는 선 자리에서 ±pelLim 안에 서야 한다(다리 · 엉덩관절 범위) — 멈춤도 같은 예산으로: 멈출 거리 ω²/(2·cap/I) 가 남은 각을 넘으면 제동
    const pelYaw = M.yawOf('pelvis'); const wPel = s.pelvis.w[1];
    const ab = p.yawCap / p.Ibrake; const ahead = pelYaw + (wPel * Math.abs(wPel)) / (2 * ab);
    let gq;
    if (phase === 'drive') gq = p.yawCap * clamp((Math.min(C.endYaw.pel, p.pelLim) - ahead) / (4 * DEG), -1, 1) * 2; // (ii) 골반을 끝 자세 각으로 (예산 안 · 멈춤도 같은 예산)
    else if (brk) gq = p.brakeGroundOld ? -p.yawCap * clamp(wPel / 0.4, -1, 1) * 2 : -0.5 * (M.Iw('pelvis')[4] / DT) * wPel; // 멈춤: 골반 돎을 같은 예산으로 제동 — 감쇠 이득은 골반(+ 다리) yaw 관성에 맞춤(d·dt/I = 0.5).
    //  (2 회차 고침: 예전 값 675 N·m/(rad/s) 는 d·dt/I ≈ 9 라 골반이 느려진 뒤 ± 상한으로 떨었다 — 빗나간 뒤 표에서 '안 멈춤'으로 드러남. brakeGroundOld 로 예전 꼴)
    else { gq = dot(jtT(s.pelvis.p), [0, 1, 0]) + p.KyawG * (Math.min(C.endYaw.pel, p.pelLim) - pelYaw) - 40 * wPel; }
    if (ahead > p.pelLim) gq = Math.min(gq, -4000 * (ahead - p.pelLim) - 30 * Math.max(0, wPel));
    if (ahead < -p.pelLim) gq = Math.max(gq, -4000 * (ahead + p.pelLim) - 30 * Math.min(0, wPel));
    let ground = clamp(gq, -p.yawCap, p.yawCap);
    if (p.groundVmax) ground *= ground * wPel > 0 ? hill(Math.abs(wPel), p.groundVmax) : 1; // 민감도: 다리에도 힘–빠르기 (기본 끔 — 과제는 상한만)
    if (ctl?.relax) {
      // 풀기: 그 관절은 무게 버팀 토크만(밀지도 멈추지도 않음 · 활성 지연 없이 바로) · 땅 yaw 0. 'trunk' = 허리 · 등 + 땅 / 'limp' = 팔 · 손목까지 모두
      for (const j of ctl.relax === 'limp' ? ['waist', 'back', 'shS', 'elS', 'shO', 'elO', 'wr'] : ['waist', 'back']) {
        const g = M.gravComp(j); tau[j] = M.jt[j].type === 'hinge' ? scl(M.hingeAxis(j), dot(g, M.hingeAxis(j))) : g;
        mus.act[j] = M.jt[j].type === 'hinge' ? dot(g, M.hingeAxis(j)) : qrot(qconj(s[M.jt[j].p].q), g);
      }
      ground = 0;
    }
    // ── 스텝 ──
    const row = { t, phase, P70, vP, v70: len(vP), tip: len(M.velAt('sword', M.bladePt(M.rTip))), hand: len(vh), keS: M.swordKE(), b, r1 };
    row.share = shares(M, P70, vP);
    row.om = omegas(M);
    row.tau = Object.fromEntries(Object.entries(tau).map(([k, v]) => [k, len(v)])); row.ground = ground;
    row.qCh = s.chest.q; row.pelYaw = pelYaw; row.chYaw = M.yawOf('chest'); row.tw = [twist.waist / DEG, twist.back / DEG]; row.sat = { ...mus.last, ground: Math.abs(gq) >= p.yawCap ? 1 : Math.abs(gq) / p.yawCap };
    row.sC = dot(sub(P70, C.T), C.d); row.dev = dot(sub(P70, C.T), C.n);
    const r = M.step(tau, { ground });
    hk?.post?.(M, i, row);
    for (const k in r.work) acc(k, r.work[k]);
    impG += ground * DT; impGabs += Math.abs(ground) * DT;
    row.E = r.e1; row.W = Object.values(W_).reduce((x, y) => x + y, 0); row.resid = r.e1 - E0 - row.W; row.work = { ...W_ }; row.impG = impG; row.Ly = r.Ly;
    row.F = r.F; row.Mf = r.M; row.gyroY = r.gyroY;
    row.gap = twoHand ? len(sub(M.a.handO, M.a.grip2)) : 0;
    row.elS = M.hingeAngle('elS') / DEG; row.elO = M.hingeAngle('elO') / DEG;
    { const fx = qrot(M.s.farmS.q, [1, 0, 0]), bb = M.bladeDir(); row.cone = Math.acos(clamp(dot(fx, bb), -1, 1)) / DEG; row.roll = Math.acos(clamp(dot(qrot(M.s.farmS.q, [0, 0, 1]), qrot(M.s.sword.q, [0, 0, 1])), -1, 1)) / DEG;
      const uC = qrot(qconj(M.s.chest.q), qrot(M.s.uarmS.q, [1, 0, 0])); row.shPl = Math.min(uC[0] * Math.sin(40 * DEG) + uC[2] * Math.cos(40 * DEG), uC[0] * Math.sin(45 * DEG) + uC[2] * Math.cos(45 * DEG)); }
    rows.push(row);
    // 겨눈 선 넘음: 다음 상태에서 본다
    const sNow = dot(sub(M.bladePt(M.r70), C.T), C.d);
    if (tCross == null && row.sC < 0 && sNow >= 0 && M.bladePt(M.r70)[0] > 0.2) {
      const f = -row.sC / (sNow - row.sC); tCross = t + f * DT; crossRow = rows.length - 1;
      if ((phase === 'drive' || p.brakeI) && !p.noBrake) { phase = 'brake'; tBrake = M.t; } // brakeI: (i) 도 겨눈 선을 넘으면 같은 온 힘 멈춤으로 (빗나간 뒤 표)
    }
    if (!Number.isFinite(r.e1) || r.ke > 5000) { rows.bad = true; break; }
  }
  const sum = summarize(rows, { C, M, mus, p, tCross, crossRow, twoHand });
  M.free();
  return { rows, sum, C };
}

/** 마디별 몫 (tools/sim/chain_probe.mjs 와 같은 식): v_P = v_골반 + ω_골반×(P−c_골반) + (ω_배−ω_골반)×(P−J_허리) + … + (ω_칼−ω_아래팔)×(P−J_손목), v̂_P 에 사영 */
export function shares(M, P, vP) {
  const s = M.s, a = M.a; const sp = len(vP); const dir = sp > 1e-6 ? scl(vP, 1 / sp) : [1, 0, 0];
  const term = (wa, wb, j) => dot(cross(sub(wa, wb), sub(P, j)), dir);
  const parts = {
    pelLin: dot(s.pelvis.v, dir), pelRot: term(s.pelvis.w, [0, 0, 0], s.pelvis.c), waist: term(s.abdomen.w, s.pelvis.w, a.waist), back: term(s.chest.w, s.abdomen.w, a.back),
    shoulder: term(s.uarmS.w, s.chest.w, a.shS), elbow: term(s.farmS.w, s.uarmS.w, a.elS), wrist: term(s.sword.w, s.farmS.w, a.wr),
  };
  parts.sum = Object.values(parts).reduce((x, y) => x + y, 0);
  return parts;
}
/** 관절 각속도 (rad/s · chain_probe 의 om 과 같은 뜻) */
export function omegas(M) {
  const s = M.s; const b = M.bladeDir();
  const wWr = perp(sub(s.sword.w, s.farmS.w), b);
  const uAx = qrot(s.uarmS.q, [1, 0, 0]); const wSh = sub(s.uarmS.w, s.chest.w);
  const elAx = qrot(s.uarmS.q, [0, 0, 1]);
  return { pelW: len(s.pelvis.w), chestW: len(s.chest.w), uarmW: len(s.uarmS.w), farmW: len(s.farmS.w), swordW: len(perp(s.sword.w, b)), pelYaw: Math.abs(s.pelvis.w[1]), trunkTwist: Math.abs(s.chest.w[1] - s.pelvis.w[1]), trunkRel: len(sub(s.chest.w, s.pelvis.w)), chest: len(s.chest.w), shoulder: len(perp(wSh, uAx)), shTwist: Math.abs(dot(wSh, uAx)), elbow: Math.abs(dot(sub(s.farmS.w, s.uarmS.w), elAx)), wrist: len(wWr) };
}

export function summarize(rows, { C, M, mus, p, tCross, crossRow, twoHand }) {
  const n = rows.length; if (!n) return { bad: true };
  // 칼날 70 % 최고: 시작 ~ 겨눈 선 넘고 25 ms (못 넘으면 전체)
  const iEnd = crossRow != null ? Math.min(n - 1, crossRow + 3) : n - 1; // 겨눈 선 넘고 25 ms 까지 (그 뒤는 멈춤 구간)
  let iPk = 0; for (let i = 0; i <= iEnd; i++) if (rows[i].v70 > rows[iPk].v70) iPk = i;
  let iTip = 0; for (let i = 0; i <= iEnd; i++) if (rows[i].tip > rows[iTip].tip) iTip = i;
  const Rk = rows[iPk]; const sh = Rk.share; const sp = Rk.v70;
  const share = { pelRot: sh.pelRot / sp, waist: sh.waist / sp, back: sh.back / sp, shoulder: sh.shoulder / sp, elbow: sh.elbow / sp, wrist: sh.wrist / sp, pelLin: sh.pelLin / sp, check: sh.sum / sp };
  const pk = (k) => { let b = 0; for (let i = 0; i <= iEnd; i++) if (rows[i].om[k] > rows[b].om[k]) b = i; return { v: rows[b].om[k], lead: (iPk - b) * DT * 1000 }; };
  const pkHand = (() => { let b = 0; for (let i = 0; i <= iEnd; i++) if (rows[i].hand > rows[b].hand) b = i; return { v: rows[b].hand, lead: (iPk - b) * DT * 1000 }; })();
  const om = { pelYaw: pk('pelYaw'), trunkTwist: pk('trunkTwist'), trunkRel: pk('trunkRel'), shoulder: pk('shoulder'), elbow: pk('elbow'), wrist: pk('wrist') };
  const lead = ['pelYaw', 'trunkTwist', 'shoulder', 'elbow', 'wrist'].map((k) => om[k].lead);
  const order = lead.every((x, i) => i === 0 || lead[i - 1] >= x);
  // 세계 틀 마디 차례 (운동 사슬의 흔한 정의): 골반 → 가슴 → 위팔 → 아래팔 → 칼 의 세계 각속도 최고가 이 차례로 오나 (골반이 거의 안 도는 획은 가슴부터)
  const segK = ['pelW', 'chestW', 'uarmW', 'farmW', 'swordW']; for (const k of segK) om[k] = pk(k);
  const segUse = om.pelW.v > 1 ? segK : segK.slice(1); const leadW = segUse.map((k) => om[k].lead);
  const orderW = leadW.every((x, i) => i === 0 || leadW[i - 1] >= x);
  const cr = crossRow != null ? rows[crossRow] : null;
  const out = {
    bad: !!rows.bad, iPk, orderW, leadW, v70: sp, tPk: (iPk + 1) * DT, tip: rows[iTip].tip, tipAt70: Rk.tip, keS: Rk.keS, hand: pkHand, share, trunkShare: share.pelRot + share.waist + share.back, om, order, lead,
    handFirst: pkHand.lead > 0, tCross, cross: cr ? { v70: cr.v70, tip: cr.tip, keS: cr.keS, dev: Math.abs(cr.dev), devS: cr.dev, x: cr.P70[0], y: cr.P70[1], z: cr.P70[2] } : null,
  };
  // 일 · 에너지 (최고 순간까지 · 겨눈 선까지)
  const at = cr || Rk; const atI = crossRow != null ? crossRow : iPk;
  out.work = at.work; out.resid = at.resid; out.dE = at.E - (rows[0].E - (rows[0].W + rows[0].resid) + 0) ; // ΔE = W + resid
  out.dE = at.W + at.resid; out.Wsum = at.W;
  out.residPk = Rk.resid; out.WsumPk = Rk.W; out.workPk = Rk.work;
  out.impG = at.impG; out.impGpk = Rk.impG; out.Ly = at.Ly - (rows[0].Ly - 0);
  // 한도에 닿은 시간 몫 (시작 ~ 기준 순간)
  out.sat = {}; out.peakTau = {};
  const JN = ['waist', 'back', 'shS', 'elS', 'wr', 'shO', 'elO'];
  const capNow = (j) => { const c = mus.capOf(j); return Array.isArray(c) ? c[1] : c; };
  for (const j of [...JN, 'ground']) { let c = 0, pkT = 0; for (let i = 0; i <= atI; i++) { if ((rows[i].sat[j] ?? 0) >= 0.98) c++; pkT = Math.max(pkT, j === 'ground' ? Math.abs(rows[i].ground) : (rows[i].tau[j] ?? 0)); } out.sat[j] = c / (atI + 1); out.peakTau[j] = pkT; }
  // 받침 반력 (다리가 대야 하는 것): 수평 힘 최고 · 수직 힘 범위 · 기울기 모멘트 최고 (시작 ~ 기준 순간 + 0.1 s)
  let fh = 0, fvMin = Infinity, fvMax = -Infinity, mt = 0, gapMax = 0;
  for (let i = 0; i <= iEnd; i++) { const r = rows[i]; fh = Math.max(fh, Math.hypot(r.F[0], r.F[2])); fvMin = Math.min(fvMin, r.F[1]); fvMax = Math.max(fvMax, r.F[1]); mt = Math.max(mt, Math.hypot(r.Mf[0], r.Mf[2])); gapMax = Math.max(gapMax, r.gap); }
  const pct = (arr, q) => { const b = arr.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; };
  const sl = rows.slice(0, iEnd + 1);
  out.fix = { fh, fvMin, fvMax, mt, weight: M.mTot * G, fh95: pct(sl.map((r) => Math.hypot(r.F[0], r.F[2])), 0.95), mt95: pct(sl.map((r) => Math.hypot(r.Mf[0], r.Mf[2])), 0.95), fhMean: sl.reduce((a, r) => a + Math.hypot(r.F[0], r.F[2]), 0) / sl.length, fv05: pct(sl.map((r) => r.F[1]), 0.05), fv95: pct(sl.map((r) => r.F[1]), 0.95) }; out.gapMax = gapMax;
  // 움직인 범위
  const yr = (k) => { let lo = Infinity, hi = -Infinity; for (const r of rows) { lo = Math.min(lo, r[k]); hi = Math.max(hi, r[k]); } return (hi - lo) / DEG; };
  out.rngPel = yr('pelYaw'); out.rngCh = yr('chYaw');
  // 벤 뒤 멈춤: 겨눈 선 넘고 칼날 70 % 가 2 m/s 아래로 처음 내려갈 때까지 · 그 동안 땅 각충격 · 칼날이 더 간 거리
  if (crossRow != null) {
    let iS = null; for (let i = crossRow + 1; i < n; i++) if (rows[i].v70 < 2) { iS = i; break; }
    let dist = 0; for (let i = crossRow + 1; i <= (iS ?? n - 1); i++) dist += rows[i].v70 * DT;
    let ig = 0, gmax = 0; for (let i = crossRow + 1; i <= (iS ?? n - 1); i++) { ig += rows[i].ground * DT; gmax = Math.max(gmax, Math.abs(rows[i].ground)); }
    let fhS = 0, mtS = 0; for (let i = crossRow + 1; i <= (iS ?? n - 1); i++) { fhS = Math.max(fhS, Math.hypot(rows[i].F[0], rows[i].F[2])); mtS = Math.max(mtS, Math.hypot(rows[i].Mf[0], rows[i].Mf[2])); }
    out.stop = { t: iS != null ? (iS - crossRow) * DT : null, dist, impG: ig, gmax, fh: fhS, mt: mtS, residEnd: rows[iS ?? n - 1].resid - cr.resid };
  }
  return out;
}
