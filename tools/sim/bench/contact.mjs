// ─────────────────────────────────────────────────────────────
//  contact.mjs — 닿을 때 칼 뒤에 무엇이 실리나 (접촉 벤치).
//   칼날 70 % 점에 질량 0 인 작은 공(반지름 15 mm)을 달고, 칼날 70 % 가 가장 빠른 스텝의 앞에 그 점의 진행 방향 n 을 법선으로 하는 토막을 0.5 mm 앞에 세운다.
//   닿음은 엔진(Rapier)의 진짜 접촉이다 — 마찰 0 · 되튐 0. 토막은 돌지 않고(회전 잠금) 중력을 받지 않는다(충격량 = 토막 운동량 변화가 되게).
//   과녁: 자유 토막(질량 M) / 스프링 토막(질량 M · 스프링 k 를 스텝마다 명시 힘으로).
//   재는 것 (모두 n 쪽 몫):
//    J₁ = 첫 스텝 충격량 · J(t) = 누적 · v₀ = 닿기 전 칼날 점 빠르기 · v_f(t) = 안 닿은 판(같은 스텝)의 칼날 점 빠르기 · v_c(t) = 닿은 판
//    유효 질량 m_eff(t) = J(t) ÷ (v_f(t) − v_c(t))  — 8 ms(1 스텝) · 25 ms(3) · 50 ms(6)
//    닿은 자리에서 흩어진 에너지(상처에 쓰이는 몫) E_w = Σ J_i · (그 스텝 앞뒤 상대 빠르기 평균) · 토막이 받은 에너지 E_b = ½Mv² + ½kx² (최고)
//    힘: 스텝 평균 J_i/dt 의 최고(자유 토막은 한 스텝에 끝나 해상도 한계) · 스프링 토막은 k·x 최고 · 닿은 시간 = 충격량이 있는 스텝 수 × dt
//   견줌: 게임 판정식 ½·(m_free + 0.3)·v₀²·2.0 — m_free = 닿은 점 · n 쪽 칼 자유 강체 유효 질량 (src/combat.js freeMass 와 같은 식)
// ─────────────────────────────────────────────────────────────
import { DT, add, sub, scl, adds, dot, cross, len, nrm, perp, qbasis, QO, O, V, mv, minv, madd } from './lib.mjs';

const G_BALL = 0x00020004, G_BLOCK = 0x00040002; // 공 ↔ 토막만 닿는다
export const R_BALL = 0.015;

/** 칼날 70 % 점에 질량 0 공을 단다 (질량 값이 안 바뀌는지 확인해 돌려줌) */
export function addStriker(M, rPt = M.r70) {
  const R = M.R; const sw = M.rb.sword; const m0 = sw.mass(), I0 = V(sw.principalInertia());
  M.world.createCollider(R.ColliderDesc.ball(R_BALL).setTranslation(0, rPt, 0).setDensity(0).setFriction(0).setRestitution(0).setCollisionGroups(G_BALL), sw);
  const dm = Math.abs(sw.mass() - m0), dI = len(sub(V(sw.principalInertia()), I0));
  if (dm > 1e-9 || dI > 1e-9) throw new Error(`striker changed sword mass props: dm ${dm} dI ${dI}`);
}
/** 칼 자유 강체의 점 P · 방향 n 유효 질량: 1 / (1/m + (r×n)·I⁻¹(r×n)) */
export function freeMass(M, P, n) {
  const s = M.s.sword, m = M.mp.sword.m; const rn = cross(sub(P, s.c), n);
  return 1 / (1 / m + dot(rn, mv(minv(M.Iw('sword')), rn)));
}

export class Target {
  /**
   * spec: { mass, k(스프링 N/m · 0 = 자유), zeta(스프링 감쇠비 — 토막 + 칼 0.4 kg 기준 · 기본 0.5) } · P = 칼날 점(세계) · n = 진행 방향(단위)
   *  스프링은 엔진의 암시 스프링 관절(JointData.spring)이다 — 스텝마다 명시 힘으로 걸면 dt 1/120 · 풀이 6 토막에서 에너지가 불어난다(ω·dt 0.8 에서 스텝마다 + 29 % — 처음 판에서 확인).
   *  접촉 충격량은 엔진의 접촉 힘 사건(totalForce × dt)으로 읽는다. 자유 토막에서는 토막 운동량 변화와 같아야 한다(검산 값 chk).
   */
  constructor(M, spec, P, n) {
    this.M = M; this.spec = spec; this.n = n; const R = M.R;
    const hx = 0.2, hy = 0.25;
    let y = perp([0, 1, 0], n); if (len(y) < 0.1) y = perp([1, 0, 0], n); y = nrm(y);
    const q = qbasis(n, y, cross(n, y));
    const c = adds(P, n, R_BALL + 0.0005 + hx);
    this.x0 = c;
    const rb = (this.rb = M.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...c).setRotation(QO(q)).setGravityScale(0).setCanSleep(false).lockRotations()));
    this.col = M.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hy).setMass(spec.mass).setFriction(0).setRestitution(0).setCollisionGroups(G_BLOCK).setActiveEvents(R.ActiveEvents.CONTACT_FORCE_EVENTS).setContactForceEventThreshold(0), rb);
    if (spec.k) {
      const L = 1; const anchor = M.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(...adds(c, n, L)));
      this.c = 2 * (spec.zeta ?? 0.5) * Math.sqrt(spec.k * (spec.mass + 0.4));
      M.world.createImpulseJoint(R.JointData.spring(L, spec.k, this.c, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }), anchor, rb, true);
    }
    if (!M.evq) M.evq = new R.EventQueue(true);
    this.v = [0, 0, 0]; this.log = [];
  }
  pre() { this.v = V(this.rb.linvel()); }
  /** 스텝 뒤: 이 스텝의 접촉 충격량(벡터 · 토막이 받은 쪽) */
  post() {
    let F = [0, 0, 0]; const h = this.col.handle;
    this.M.evq.drainContactForceEvents((ev) => { if (ev.collider1() === h || ev.collider2() === h) { const f = V(ev.totalForce()); F = add(F, dot(f, this.n) < 0 ? scl(f, -1) : f); } });
    const v1 = V(this.rb.linvel()); const J = scl(F, DT);
    const x = sub(V(this.rb.translation()), this.x0);
    const dp = scl(sub(v1, this.v), this.spec.mass);
    const rec = { J, Jn: dot(J, this.n), dpn: dot(dp, this.n), vb0: dot(this.v, this.n), vb1: dot(v1, this.n), x: dot(x, this.n) };
    this.log.push(rec); return rec;
  }
}

/**
 * 한 칸의 접촉 재기. run = (opts) => { rows, sum } (runCut / runGame 를 감싼 것 · opts 에 hook 을 받아야 한다).
 *  targets: [{ name, mass, k, c }] · relax: null | 'trunk' | 'limp' · nAfter: 닿은 뒤 잴 스텝 수
 *  → { dry: { v0, n, mFree, iPk, ... }, res: { name: {...} } }
 */
export function contactCase(run, targets, { relax = null, nAfter = 12, frac = 0.7 } = {}) {
  // ① 안 닿는 판 (공은 단다 — 질량 0). 스텝마다 칼날 점의 자리 · 빠르기(스텝 앞 상태)를 적는다
  const free = []; let rPt = null;
  const dry = run({ hook: { init: (M) => { rPt = M.W.hiltLength + frac * M.W.bladeLength; addStriker(M, rPt); }, pre: (M, i) => { const P = M.bladePt(rPt); free[i] = { P, v: M.velAt('sword', P) }; return null; } }, noBrake: true });
  const iPk = dry.sum.iPk; const r0 = dry.rows[iPk];
  const nDir = nrm(free[iPk].v); const v0 = len(free[iPk].v);
  const vFree = (k) => (free[iPk + k] ? dot(free[iPk + k].v, nDir) : NaN); // k 스텝 뒤(스텝 iPk+k 의 앞 상태)
  const out = { dry: { v0, v70: len(r0.vP), n: nDir, iPk, tPk: r0.t, keS: r0.keS, tip: r0.tip, sum: dry.sum }, res: {} };
  for (const T of targets) {
    let tg = null; const recs = []; let vChk = null;
    const hook = {
      init: (M) => addStriker(M, rPt),
      pre: (M, i) => {
        if (i === iPk) {
          const P = M.bladePt(rPt); const vP = M.velAt('sword', P); vChk = len(sub(vP, free[iPk].v));
          out.dry.mFree = freeMass(M, P, nDir);
          tg = new Target(M, T, P, nDir);
        }
        if (tg) { tg.pre(); tg.vc0 = dot(M.velAt('sword', M.bladePt(rPt)), nDir); }
        return i >= iPk && relax ? { relax } : null;
      },
      post: (M, i) => {
        if (!tg || i - iPk >= nAfter) return;
        const rec = tg.post(); rec.vc0 = tg.vc0; rec.vc1 = dot(M.velAt('sword', M.bladePt(rPt)), nDir); rec.k = i - iPk + 1; rec.vf1 = vFree(rec.k);
        if (!T.k) rec.Jev = rec.Jn, rec.Jn = rec.dpn; // 자유 토막은 운동량 변화(정확) · 사건 값은 검산으로
        recs.push(rec);
      },
    };
    run({ hook, noBrake: true });
    if (vChk > 1e-9) throw new Error(`contact run diverged from dry run before contact: |Δv| = ${vChk}`);
    // 요약
    const J1 = recs[0].Jn; const Jsum = (k) => recs.slice(0, k).reduce((a, r) => a + r.Jn, 0);
    // 유효 질량: 첫 스텝은 안 닿은 판과의 차로(그 스텝의 근육 · 중력 몫을 뺀다) · 뒤는 누적 충격량 ÷ 처음 빠르기에서 잃은 빠르기
    const meff1 = J1 / (recs[0].vf1 - recs[0].vc1);
    const meffAt = (k) => { const r = recs[k - 1]; return r ? Jsum(k) / (v0 - r.vc1) : NaN; };
    let Ew = 0, Wb = 0, WbMax = 0, kW = 0; recs.forEach((r, i) => { Ew += r.Jn * 0.5 * (r.vc0 - r.vb0 + (r.vc1 - r.vb1)); Wb += r.Jn * 0.5 * (r.vb0 + r.vb1); if (Wb > WbMax) { WbMax = Wb; kW = i + 1; } });
    const thr = 0.01 * Math.abs(J1); let nCon = 0, lastCon = 0; recs.forEach((r, i) => { if (Math.abs(r.Jn) > thr) { nCon++; lastCon = i + 1; } });
    const xMax = Math.max(...recs.map((r) => r.x)); const kX = recs.findIndex((r) => r.x === xMax) + 1;
    const Jlat = Math.max(...recs.map((r) => len(perp(r.J, nDir))));
    const chk = T.k ? NaN : Math.max(...recs.map((r) => Math.abs(r.Jev - r.dpn))); // 자유 토막: 사건 충격량 − 운동량 변화
    const push = (Jsum(6) - J1) / (5 * DT); // 첫 스텝 뒤 8 ~ 50 ms 의 평균 미는 힘
    out.res[T.name] = {
      J1, Jtot: Jsum(recs.length), J3: Jsum(3), J6: Jsum(6), v1: recs[0].vc1, vb1: recs[0].vb1, vf1: recs[0].vf1,
      meff1, meff3: meffAt(3), meff6: meffAt(6), push,
      Ew, Wb: WbMax, tWb: kW * DT, Edel: Ew + WbMax, Fstep: Math.max(...recs.map((r) => r.Jn)) / DT, Fspring: T.k ? T.k * xMax : NaN, xMax, tX: kX * DT,
      JtoX: Jsum(kX), nCon, tCon: nCon * DT, lastCon: lastCon * DT, Jlat, chk, recs,
    };
  }
  return out;
}
