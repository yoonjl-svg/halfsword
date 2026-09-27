// 온몸 베기 측정 묶음 (docs/whole_body_strike.md L0·7장·15장). 이해 단계의 motion_sim·cutprobe·body_probe·step_probe·
//  hand_probe·impact_probe 를 합쳤다. 플레이어 입력은 모두 손가락 궤적 길(harness_m.mjs feedTrace: input.js → handOffset →
//  skill.update)로 넣는다. 결심 단계는 fighter.onCommit(stage, c, fam) 고리로 센다 (결심 층이 없으면 0).
// 실행 (저장소 뿌리): node tools/sim/hybrid.mjs wholebody.mjs <부분> [N]
//   MODE=hybrid|levitate 로 걸음 방식을 바꾼다 (없으면 감싸는 스크립트가 정한 값). 층 끄기: with_config.mjs WHOLE.chain=false ...
//   결과: 요약을 찍고 JSON 을 OUT(없으면 OUTDIR 또는 임시 폴더의 wholebody_<부분>_<모드>.json)에 남긴다
// 부분:
//   support        지탱도 s: 가만히 섬 / 8방향 걷기 (s 평균·범위)
//   cuts           플레이어 베기 4무리 × {상대 1.55 m, 틈 2.0, 2.3 m} × 손가락 {6, 12 m/s}: 손 경로·호·골반/가슴·무게중심·발·빠르기…
//   detect         결심 판정: 큰 긋기·들었다 베기·자세 바꾸기 29가지 × 빠르기 × {60, 90, 120 Hz} × {멈춤, 떼기}
//   react          반응: 긋기 시작 → 칼끝이 긋는 방향으로 2 cm / → 닿기 (결심 켬·끔)
//   combo          오른-왼-오른 베기 0.6/0.8/1.0초 간격, 걷다가 곧바로 베기: 발 닿는 시각
//   sweep          서 있는 더미 1.38/1.53/1.71/1.91 m + 걸어 들어가며: 에너지·헛침·첫 부위·옆 어긋남·최고 빠르기와 닿기 시간차
//   trunkoff       척추·골반 비틀기를 0으로 묶은 베기: 에너지 비
//   strength       근력 0.8 / 1.0 / 1.3: 획 시간·에너지
//   power          손가락 6 / 8.6 / 12 m/s (결심 세기 c 0.3 / 0.6 / 1.0): 획 시간·에너지·걸음
//   stand N        상대 없이 제자리 베기 N번: 스스로 넘어짐, s 평균
//   miss N         헛친 베기 (상대가 멀다): 비틀 걸음·넘어짐·s 회복 시간 (반은 조이스틱을 뒤로 당긴다)
//   block N        멈춰 선 막기 / 근력 1.3 츠바이핸더 AI 에 막힘: 부딪힘·잃은 빠르기·밀린 발·기울기
//   react_body     더미가 맞았을 때 머리·가슴·무게중심·발 이동
//   ai N           AI 대 AI: 준비 있는 내려베기 비율, 첫 신호 → 닿기, 칼끝 빠르기, 칠 때 몸 빠르기, 걸음 수락률, 넘어짐
//   aistep N       AI 대 AI 의 기술 걸음(ai.js gaitStep → gait.requestStep) 하나하나: 발 이동, 닿을 때 몸 전진, 닿은 뒤 밀림,
//                  다시 딛기(같은 발이 0.5초 안에 다른 발보다 먼저 다시 뜸), 부탁했는데 기술 걸음으로 딛지 못한 것 (R1 합격선)
//   tapstep N      플레이어 탭 찌르기(skill.thrust)의 내딛기: 상대 1.6/1.9/2.2 m × N번. 앞발 이동, 닿을 때 무게중심 전진, 닿은 뒤 밀림
//   duel N         스크립트 플레이어(결심 베기만 / 팔 베기만) 대 보통 AI: 시도당 준 에너지, 맞힌·맞은 비율, 넘어짐/분과 까닭
//   defend N       스크립트 방어자(반응 250 ms + 막기 긋기 100 ms) 대 AI 쉬움/보통/어려움: 막은 비율
//   hitstop N      AI 대 AI 의 멈칫(main.js 규칙 그대로): 가운데값과 멈칫 총량(벽시계 시간 중 비율)
//   feedcheck      같은 궤적을 두 번 넣으면 handOffset 이 바이트까지 같은가 (60/90/120 Hz)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newRound, THREE, DT, AI, CONFIG, V, Q, handPos, feedTrace, inputPump } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';

if (process.env.MODE) CONFIG.BODY.weightMode = process.env.MODE;
const MODE = CONFIG.BODY.weightMode;
const SUB = process.argv[2] || 'cuts';
const NARG = process.argv[3] != null ? +process.argv[3] : null;
const HZ = +(process.env.HZ || 60); // 화면 새로고침 빠르기 (손가락 궤적이 들어오는 박자). 폰 기본 60

const R2D = 180 / Math.PI;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r0 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const q = (a, p) => {
  const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  return b.length ? b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))] : NaN;
};
const med = (a) => q(a, 0.5);
const pct = (n, d) => (d ? +((100 * n) / d).toFixed(1) : null);
/** 도구 자신의 난수 (Math.random 은 AI·판이 쓴다) */
function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 패드 자리 (guards.js 규약: x + = 칼 든 쪽, y + = 위) 와 베기 무리 (설계서 L1 (a) 표) ──
const PAD = {
  Pflug: [0.18, -0.28], PflugL: [-0.18, -0.28], Ochs: [0.22, 0.26], OchsL: [-0.22, 0.26], Tag: [0.02, 0.52], ShR: [0.42, 0.42], ShL: [-0.4, 0.42],
  Langort: [0, 0.03], Alber: [0, -0.5], WechselL: [-0.4, -0.42], Wechsel: [0.38, -0.44], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Neben: [0.55, -0.26],
};
const FAM = {
  diagR: { ch: PAD.ShR, end: PAD.WechselL },
  diagL: { ch: PAD.ShL, end: PAD.Wechsel },
  vert: { ch: PAD.Tag, end: PAD.Alber },
  horizR: { ch: PAD.Side, end: PAD.SideL },
  horizL: { ch: PAD.SideL, end: PAD.Side },
  riseR: { ch: PAD.Wechsel, end: PAD.OchsL },
  riseL: { ch: PAD.WechselL, end: PAD.Ochs },
};
const CUT4 = ['diagR', 'vert', 'horizR', 'riseR']; // 플레이어 베기 4무리

// ── 손가락 궤적 만들기 (패드 m, 손가락을 댄 자리에서의 이동) ──
const sj = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u)); // 최소 저크
/** 곧은 긋기: 이동 (dx, dy) 를 평균 빠르기 v(패드 m/s)로. shape 'drag' = 같은 빠르기, 'minjerk' = 최소 저크 (최고 빠르기 1.875 v) */
function stroke(dx, dy, v, { shape = 'drag', hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  const fn = (t) => {
    const u = T > 0 ? Math.min(1, t / T) : 1;
    const k = shape === 'minjerk' ? sj(u) : u;
    return [dx * k, dy * k];
  };
  return { fn, T: T + hold, lift, down };
}
/** 여러 다리를 잇는 긋기 (다리 사이 pause ms 머묾): legs = [[dx, dy], ...] */
function strokes(legs, v, { shape = 'minjerk', pause = 25, hold = 0, lift = true, down = true } = {}) {
  const segs = [];
  let t = 0;
  let x = 0;
  let y = 0;
  for (const [dx, dy] of legs) {
    const T = (Math.hypot(dx, dy) / v) * 1000;
    segs.push({ t0: t, T, x0: x, y0: y, dx, dy });
    x += dx;
    y += dy;
    t += T + pause;
  }
  const fn = (tm) => {
    let px = 0;
    let py = 0;
    for (const s of segs) {
      if (tm < s.t0) break;
      const u = Math.min(1, (tm - s.t0) / Math.max(1e-6, s.T));
      const k = shape === 'minjerk' ? sj(u) : u;
      px = s.x0 + s.dx * k;
      py = s.y0 + s.dy * k;
    }
    return [px, py];
  };
  return { fn, T: t - pause + hold, lift, down };
}

// ── 무대 ──
/**
 * 플레이어 + 상대. 상대는 기본으로 서 있는 더미(AI 끔, 칼은 부딪히지 않음).
 *  o.dist: 자세를 잡은 뒤 두 가슴 사이 거리(m, 없으면 o.gap = 두 골반 사이 처음 거리), o.park: 상대를 치운다, o.air: 내 칼도 부딪히지 않는다(헛휘두름 측정),
 *  o.foeSword: 상대 칼이 부딪힌다, o.foeAI: 상대 AI 를 켠다, o.immortal: 상대(와 o.immortalP 면 나)가 죽지 않는다
 */
const CHEST_GAP = 0.17; // 판 시작 골반 거리 − 자세를 잡은 뒤 두 가슴 사이 거리 (재 보니 0.16~0.18 m)
function stage(o = {}) {
  const gap = o.dist != null ? o.dist + CHEST_GAP : o.gap ?? 2.0;
  const G = newRound({ walls: o.walls ?? false, gap, seed: o.seed ?? 7, weapon: o.weapon, weapon2: o.weapon2, difficulty: o.difficulty });
  const P = G.player;
  const E = G.enemy;
  if (!o.foeAI) G.ai.update = () => E.move.set(0, 0);
  if (!o.foeSword && !o.foeAI) for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  if (o.air) for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  if (o.park) G.park();
  if (o.immortal) E.die = () => {};
  if (o.immortalP) P.die = () => {};
  if (o.str != null) P.strength = o.str;
  if (o.foeStr != null) E.strength = o.foeStr;
  P.skill.level = o.skill ?? 0.7;
  // 판 시작 손 자리: 쟁기(베고 나면 돌아가는 기본 자세). 이해 단계 측정(motion_sim)과 같은 출발 — 칼이 닿는지는 출발 자세에 민감하다
  if (o.pad !== null) setPad(P, o.pad ?? PAD.Pflug);
  // 플레이어 입력 길 (AI 대 AI 에서는 붙이지 않는다: 자세로 돌아가기(autoGuard)가 AI 손을 건드린다)
  if (o.pump !== false) inputPump(G, { hz: o.hz ?? HZ });
  const step0 = G.step;
  G.step = () => {
    step0();
    G.after?.();
  };
  G.woundsR = [];
  G.onWound = (att, vic, r) => G.woundsR.push({ t: G.t, att, vic, zone: r.zone, type: r.type, E: r.energy, sev: r.severity, point: r.point.clone(), speed: r.speed, mEff: r.mEff, pass: r.pass, stuck: r.stuck });
  G.clashT = [];
  const oc = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (point, sp, touch) => {
    oc?.(point, sp, touch);
    G.clashT.push({ t: G.t, vn: touch ? touch.vn : sp, fresh: !!touch?.fresh });
  };
  // 결심 단계 기록 (결심 층이 fighter.onCommit 을 부른다)
  for (const f of [P, E]) {
    f.commitLog = [];
    const oc2 = f.onCommit.bind(f);
    f.onCommit = (stage, c, fam) => {
      f.commitLog.push({ t: G.t, stage, c, fam });
      return oc2(stage, c, fam);
    };
    f.tdLog = [];
    if (f.gait) {
      const ot = f.gait.onTouchdown.bind(f.gait);
      f.gait.onTouchdown = (foot, s, kind) => {
        f.tdLog.push({ t: G.t, foot, s, kind });
        return ot(foot, s, kind);
      };
    }
    installKd(G, f);
  }
  G.run = (secs, fn) => {
    for (let i = 0; i < Math.round(secs / DT); i++) {
      fn?.(i);
      G.step();
    }
  };
  return G;
}

/** 손 목표와 검술 층의 걸러진 값들을 한 자리에 맞춘다 (판을 차리는 것일 뿐 입력이 아니다) */
function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v.set(xy[0], xy[1]);
  k.aimVel.set(0, 0);
  k.vel.set(0, 0);
  k.follow.set(0, 0);
}

/** 넘어짐 기록 (까닭: gauge 균형 게이지 / tilt 기울기 / footing 발 밖 / legs 다리 / collapse 다리가 못 받침 / other) */
function installKd(G, f) {
  f.kdLog = [];
  const k = f.knockDown.bind(f);
  f.knockDown = (heavy) => {
    if (f.state === 'stand') {
      const c = f.balance <= 0 ? 'gauge' : f.tiltDeg() > CONFIG.BODY.fallTiltDeg ? 'tilt' : f.offBalanceTime > CONFIG.BALANCE.fallDelay ? 'footing' : f.legHealth < 0.25 ? 'legs' : f.gait && (f.gait.lowT > 0.25 || f.gait.satT > 0.25) ? 'collapse' : 'other';
      f.kdLog.push({ t: G.t, c, heavy });
    }
    return k(heavy);
  };
}

// ── 한 순간 재기 (몸 기준: x 앞, y 위, z 칼 든 쪽) ──
const _u = new THREE.Vector3();
const _f = new THREE.Vector3();
function bodyYaw(rb) {
  _f.set(1, 0, 0).applyQuaternion(Q(rb.rotation()));
  return Math.atan2(-_f.z, _f.x);
}
function footYaw(f, k) {
  return bodyYaw(f.bodies['foot' + k]);
}
function elbowDeg(f) {
  const u = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(f.bodies.uarmS.rotation()));
  const a = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(f.bodies.farmS.rotation()));
  return Math.acos(THREE.MathUtils.clamp(u.dot(a), -1, 1)) * R2D;
}
function sample(f, t) {
  const yawInv = f.yaw.clone().invert();
  const chest = V(f.bodies.chest.translation());
  const pel = V(f.bodies.pelvis.translation());
  const head = V(f.bodies.head.translation());
  const hand = handPos(f);
  const tip = f.bladePoint(1, new THREE.Vector3());
  const b = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(f.sword.rotation()));
  const gl = f.gait?.legs;
  // 칼날 70% 점의 빠르기 중 가슴이 단단히 붙어 옮긴 몫 (cutprobe 방식)
  const P70 = f.bladePoint(0.7, new THREE.Vector3());
  const cv = V(f.bodies.chest.linvel());
  const cw = V(f.bodies.chest.angvel());
  const carry = cv.add(cw.cross(P70.clone().sub(V(f.bodies.chest.worldCom()))));
  const vb = f.hitPointVel;
  const vbl = vb.length();
  return {
    t,
    heading: f.heading,
    pelYaw: bodyYaw(f.bodies.pelvis),
    chYaw: bodyYaw(f.bodies.chest),
    pelTw: -wrap(bodyYaw(f.bodies.pelvis) - f.heading) * R2D, // + = 칼 든 쪽 골반이 뒤로 (guards.js 규약)
    chTw: -wrap(bodyYaw(f.bodies.chest) - f.heading) * R2D,
    hand,
    handB: hand.clone().sub(chest).applyQuaternion(yawInv),
    handFromChest: hand.distanceTo(chest),
    com: f.com ? f.com.clone() : pel.clone(),
    tipW: tip,
    tipB: tip.clone().sub(head).applyQuaternion(yawInv),
    tipBC: tip.clone().sub(chest).applyQuaternion(yawInv),
    blade: b,
    bladeB: b.clone().applyQuaternion(yawInv),
    w: V(f.sword.angvel()),
    tip: f.tipVel.length(),
    mid: vbl,
    bodyAlong: vbl > 1e-3 ? carry.dot(vb) / vbl : 0,
    feet: [V(f.bodies.footF.translation()), V(f.bodies.footB.translation())],
    fyaw: [footYaw(f, 'F'), footYaw(f, 'B')],
    stance: gl ? [gl.F.stance, gl.B.stance] : [f.footLoad.F > 0.5, f.footLoad.B > 0.5],
    fwd: f.forward(new THREE.Vector3()),
    state: f.state,
    pelY: pel.y,
    headY: head.y,
    lean: (() => {
      _u.set(0, 1, 0).applyQuaternion(Q(f.bodies.chest.rotation())).applyQuaternion(yawInv);
      return Math.atan2(_u.x, _u.y) * R2D;
    })(),
    elbow: elbowDeg(f),
    s: f.support,
    levC: f.gait ? f.gait.levC : 0,
    wsat: f.debug.wristCap > 0 && f.debug.wristTorque.length() >= f.debug.wristCap * 0.98,
    stage: f.commit?.stage ?? (f.commit?.on ? 'on' : null),
  };
}

/** 한 번 휘두름 분석. S = 샘플, i0 = 긋기 시작, tgt = 겨눈 곳(상대 가슴, 월드) */
function analyse(S, i0, i1, tgt, hitT = null, pkWin = 0.6) {
  const W = S.slice(i0, i1 + 1);
  const s0 = W[0];
  // 최고 빠르기 (긋기 시작 뒤 pkWin 초 안, 그 뒤 자세로 돌아가는 움직임을 잡지 않게). 이해 단계 motion_sim 과 같게
  //  휘두름 끝(iEnd)은 칼끝 빠르기가 최고의 20% 아래로 떨어진 때, 최고 순간(iPk)은 칼날 70% 점 기준
  let iPk = 0;
  let iTip = 0;
  for (let i = 0; i < W.length && W[i].t - s0.t <= pkWin; i++) {
    if (W[i].mid > W[iPk].mid) iPk = i;
    if (W[i].tip > W[iTip].tip) iTip = i;
  }
  const midPk = W[iPk].mid;
  const tipPk = W[iTip].tip;
  let iEnd = W.length - 1;
  for (let i = iTip; i < W.length; i++)
    if (W[i].tip < 0.2 * tipPk) {
      iEnd = i;
      break;
    }
  const Wc = W.slice(0, iEnd + 1);
  let pathB = 0;
  let maxDisp = 0;
  let maxDispB = 0;
  const hv = [];
  for (let i = 1; i < Wc.length; i++) {
    pathB += Wc[i].handB.distanceTo(Wc[i - 1].handB);
    hv.push(Wc[i].hand.distanceTo(Wc[i - 1].hand) / DT);
  }
  for (const s of Wc) {
    maxDisp = Math.max(maxDisp, s.hand.distanceTo(s0.hand));
    maxDispB = Math.max(maxDispB, s.handB.distanceTo(s0.handB));
  }
  const chordB = Wc[Wc.length - 1].handB.distanceTo(s0.handB);
  let iHv = 0;
  for (let i = 0; i < hv.length; i++) if (hv[i] > hv[iHv]) iHv = i;
  const rate = (k) => {
    const r = [];
    for (let i = 1; i < W.length; i++) r.push((wrap(W[i][k] - W[i - 1][k]) / DT) * R2D);
    return r;
  };
  const pr = rate('pelYaw');
  const cr = rate('chYaw');
  const net = (k) => wrap(Wc[Wc.length - 1][k] - s0[k]);
  const sgnP = Math.sign(net('pelYaw') || 1);
  const sgnC = Math.sign(net('chYaw') || 1);
  let iP = 0;
  let iC = 0;
  for (let i = 0; i < pr.length && i <= iEnd; i++) {
    if (pr[i] * sgnP > pr[iP] * sgnP) iP = i;
    if (cr[i] * sgnC > cr[iC] * sgnC) iC = i;
  }
  const ex = (k) => {
    const a = Wc.map((s) => s[k]);
    return Math.max(...a) - Math.min(...a);
  };
  // 무게중심: 상대 쪽으로 (없으면 처음 바라본 쪽)
  const fwd0 = tgt ? new THREE.Vector3(tgt.x - s0.com.x, 0, tgt.z - s0.com.z).normalize() : s0.fwd.clone();
  const along = (s) => s.com.clone().sub(s0.com).dot(fwd0);
  let comMax = -9;
  for (const s of Wc) comMax = Math.max(comMax, along(s));
  const comV = (i) => {
    const a = W[Math.max(0, i - 3)];
    return (W[i].com.clone().sub(a.com).dot(fwd0) / ((i - Math.max(0, i - 3)) * DT || DT));
  };
  // 발: 가장 많이 움직인 발, 들고 닿은 때
  const lim = Math.min(W.length, iEnd + 60);
  const footMove = [0, 1].map((k) => {
    let m = 0;
    for (const s of W.slice(0, lim)) m = Math.max(m, Math.hypot(s.feet[k].x - s0.feet[k].x, s.feet[k].z - s0.feet[k].z));
    return m;
  });
  const kStep = footMove[0] >= footMove[1] ? 0 : 1;
  let tLift = null;
  let tTD = null;
  for (let i = 1; i < lim; i++) {
    if (tLift == null && W[i - 1].stance[kStep] && !W[i].stance[kStep]) tLift = W[i].t;
    if (tLift != null && tTD == null && !W[i - 1].stance[kStep] && W[i].stance[kStep]) tTD = W[i].t;
  }
  // 딛은 발 비틀림: 처음부터 계속 딛고 있던 동안 발 방향이 돈 최대 각
  let twist = 0;
  for (const k of [0, 1]) {
    for (let i = 0; i < lim; i++) {
      if (!W[i].stance[k]) break;
      twist = Math.max(twist, Math.abs(wrap(W[i].fyaw[k] - s0.fyaw[k])) * R2D);
    }
  }
  // 칼 호: 휘두르는 평균 축 둘레로 누적한 칼 방향 회전
  const n = new THREE.Vector3();
  for (const s of Wc) n.addScaledVector(s.w, DT);
  n.normalize();
  const phi = [0];
  for (let i = 1; i < W.length; i++) {
    const c = new THREE.Vector3().crossVectors(W[i - 1].blade, W[i].blade);
    phi.push(phi[i - 1] + Math.atan2(c.length(), W[i - 1].blade.dot(W[i].blade)) * Math.sign(c.dot(n) || 1));
  }
  let iMaxPhi = 0;
  for (let i = 0; i < W.length; i++) if (phi[i] > phi[iMaxPhi]) iMaxPhi = i;
  // 닿기: 실제로 맞았으면 그 순간, 아니면 칼이 겨눈 곳을 가리킨 순간 (헛휘두름)
  let iLine = 0;
  let best = -2;
  for (let i = 0; i <= iMaxPhi; i++) {
    const s = W[i];
    const d = tgt ? new THREE.Vector3(tgt.x - s.hand.x, tgt.y - s.hand.y, tgt.z - s.hand.z).normalize() : s.fwd;
    const c = s.blade.dot(d);
    if (c > best) {
      best = c;
      iLine = i;
    }
  }
  let iHit = iLine;
  if (hitT != null) for (let i = 0; i < W.length; i++) if (W[i].t >= hitT - 1e-9) {
    iHit = i;
    break;
  }
  const tms = (i) => r0((W[i].t - s0.t) * 1000);
  const b0 = s0.bladeB;
  const win = Wc.slice(0, Math.max(1, Wc.length));
  return {
    dur_ms: tms(iEnd),
    tPk_ms: tms(iPk),
    tip: r1(tipPk),
    mid70: r1(midPk),
    handPathB: r2(pathB),
    handChordB: r2(chordB),
    handMaxDispB: r2(maxDispB),
    handMaxDisp: r2(maxDisp),
    handVpk: r1(Math.max(0, ...hv)),
    tHandPk_ms: tms(Math.min(W.length - 1, iHv + 1)),
    handFwdHit: r2(W[iHit].handB.x),
    elbowPk: r0(W[iPk].elbow),
    elbowHit: r0(W[iHit].elbow),
    pelTwEx: r1(ex('pelTw')),
    chTwEx: r1(ex('chTw')),
    pelTw0: r1(s0.pelTw),
    chTw0: r1(s0.chTw),
    pelRatePk: r0(pr[iP] * sgnP),
    chRatePk: r0(cr[iC] * sgnC),
    tPel_ms: tms(Math.min(W.length - 1, iP + 1)),
    tCh_ms: tms(Math.min(W.length - 1, iC + 1)),
    pelToChest_ms: r0((W[Math.min(W.length - 1, iC + 1)].t - W[Math.min(W.length - 1, iP + 1)].t) * 1000),
    handToBlade_ms: r0((W[iPk].t - W[Math.min(W.length - 1, iHv + 1)].t) * 1000),
    pelToBlade_ms: r0((W[iPk].t - W[Math.min(W.length - 1, iP + 1)].t) * 1000),
    bodySharePk: r2(W[iPk].bodyAlong / Math.max(1e-6, W[iPk].mid)),
    comFwdMax: r2(comMax),
    comVatHit: r2(comV(iHit)),
    comVatPk: r2(comV(iPk)),
    pelDrop: r2(s0.pelY - Math.min(...win.map((s) => s.pelY))),
    leanMax: r1(Math.max(...win.map((s) => s.lean))),
    lean0: r1(s0.lean),
    footMove: footMove.map(r2),
    stepFoot: footMove[kStep] > 0.05 ? (kStep === 0 ? 'F' : 'B') : null, // F = 칼 든 쪽 발
    stepLift_ms: tLift == null ? null : r0((tLift - s0.t) * 1000),
    stepTDvsPk_ms: tTD == null ? null : r0((tTD - W[iPk].t) * 1000),
    stanceTwistMax: r1(twist),
    arcTotal: r0((phi[iMaxPhi] - phi[0]) * R2D),
    arcToHit: r0((phi[iHit] - phi[0]) * R2D),
    follow: r0((phi[iMaxPhi] - phi[iHit]) * R2D),
    bladeStartSagittal: r0(Math.atan2(b0.y, b0.x) * R2D),
    tipBehindHead: r2(s0.tipB.x),
    pkMinusHit_ms: r0((W[iPk].t - W[iHit].t) * 1000),
    sMean: r3(mean(win.map((s) => s.s))),
    sMin: r3(Math.min(...win.map((s) => s.s))),
    levCMax: r3(Math.max(...W.slice(0, lim).map((s) => s.levC))),
    wristSat_pct: pct(win.filter((s) => s.wsat).length, win.length),
  };
}

/**
 * 플레이어 한 번 베기: 손가락을 준비 자세로 천천히 옮기고(chamberV, 머묾 dwell) 떼지 않은 채 긋고 뗀다.
 *  chambered=false 면 준비 없이 지금 자리에서 긋는다(from 이 지금 자리). walk: 머묾~긋기 동안 조이스틱 앞으로
 * @returns { S(샘플), i0(긋기 시작 샘플), t0, tgt, wounds(이 베기 뒤 내 상처들) }
 */
function playerCut(G, fam, o = {}) {
  const P = G.player;
  const E = G.enemy;
  const F = typeof fam === 'string' ? FAM[fam] : fam;
  const v = o.v ?? 12;
  const hz = o.hz ?? HZ;
  const S = o.S ?? [];
  const smp = () => S.push(sample(P, G.t));
  const pump = inputPump(G, { hz });
  pump.hz = hz;
  const from = o.from ?? F.ch;
  // armAtCut: 준비 자세로 옮기는 동안엔 내 칼이 아무것도 건드리지 않게 (들어 올리다 더미를 치면 더미가 넘어진다)
  const groups0 = o.armAtCut ? P.swordColliders.map((c) => c.collisionGroups()) : null;
  if (groups0) for (const c of P.swordColliders) c.setCollisionGroups(0);
  if (o.chambered !== false) {
    const off = [P.handOffset.x, P.handOffset.y];
    const ch = feedTrace(G, stroke(from[0] - off[0], from[1] - off[1], o.chamberV ?? 1.2, { hold: (o.dwell ?? 0.4) * 1000, lift: false }), hz);
    while (!ch.done) {
      if (o.walk && G.t > (ch.t0 ?? 1e9) + ch.T / 1000 - (o.dwell ?? 0.4)) pump.stick = { x: 0, y: o.walk };
      G.step();
      smp();
    }
  }
  const cur = [P.handOffset.x, P.handOffset.y];
  const end = o.to ?? F.end;
  const cut = feedTrace(G, stroke(end[0] - cur[0], end[1] - cur[1], v, { shape: o.shape ?? 'drag', down: o.chambered === false, lift: true }), hz);
  if (o.walk) pump.stick = { x: 0, y: o.walk };
  if (groups0) P.swordColliders.forEach((c, i) => c.setCollisionGroups(groups0[i]));
  const tgt = E && !G.parkEnemy ? V(E.bodies.chest.translation()) : null;
  const d0 = P.foeDistance();
  const nW = G.woundsR.length;
  // 궤적은 다음 화면 프레임에 시작한다 (60 Hz 면 앞 프레임의 두 번째 물리 스텝이 남아 있을 수 있다)
  do {
    G.step();
    smp();
  } while (cut.t0 == null);
  const i0 = S.length - 1;
  const t0 = cut.t0;
  for (let i = 0; i < (o.after ?? 1.2) / DT; i++) {
    if (o.walk && cut.done && G.t > cut.t1 + 0.2) pump.stick = { x: 0, y: 0 };
    G.step();
    smp();
  }
  if (o.walk) pump.stick = { x: 0, y: 0 };
  return { S, i0, t0, tgt, d0, wounds: G.woundsR.slice(nW).filter((w) => w.att === P), cut };
}

/** 서 있는 더미 앞에서 한 번 베고 결과를 정리 (hit=true 면 칼이 닿는다) */
function cutTrial(fam, o = {}) {
  const G = stage({ dist: o.dist, gap: o.gap, seed: o.seed ?? 7, air: !o.hit, park: o.park, str: o.str, immortal: true, hz: o.hz, weapon: o.weapon });
  G.run(o.settle ?? 2.0);
  const C = playerCut(G, fam, o);
  C.wounds = C.wounds.filter((w) => w.t <= C.t0 + 0.6); // 이 베기의 상처만 (그 뒤 자세로 돌아가며 닿은 것은 빼고)
  const w0 = C.wounds[0];
  const best = C.wounds.length ? C.wounds.reduce((a, b) => (b.E > a.E ? b : a)) : null;
  const A = analyse(C.S, C.i0, C.S.length - 1, C.tgt, w0 ? w0.t : null);
  A.d0 = r2(C.d0);
  A.state = G.player.state;
  A.kd = G.player.kdLog.length;
  if (o.hit) {
    A.hitFirst = w0 ? { t_ms: r0((w0.t - C.t0) * 1000), zone: w0.zone, type: w0.type, E: r0(w0.E), v: r1(w0.speed), mEff: r2(w0.mEff) } : null;
    A.hitBestE = best ? r0(best.E) : 0;
    A.hitBestZone = best ? best.zone : null;
    // 닿은 점이 두 가슴을 잇는 선에서 옆으로 벗어난 거리 (m)
    if (w0) {
      const a = C.S[C.i0].com;
      const b = C.tgt;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const L = Math.hypot(dx, dz) || 1;
      A.hitLat = r2(Math.abs(((w0.point.x - a.x) * dz - (w0.point.z - a.z) * dx) / L));
    }
  }
  A.commits = G.player.commitLog.map((c) => `${c.stage}@${r0((c.t - C.t0) * 1000)}`);
  return { A, G, C };
}

function save(name, obj) {
  const f = process.env.OUT || path.join(process.env.OUTDIR || os.tmpdir(), `wholebody_${name}_${MODE}.json`);
  fs.writeFileSync(f, JSON.stringify(obj, null, 1));
  console.log('결과 파일:', f);
}
const line = (k, o) => console.log(k.padEnd(22), JSON.stringify(o));

// ═════════════════════════════ 부분 명령 ═════════════════════════════
const out = { sub: SUB, mode: MODE, whole: { ...CONFIG.WHOLE } };

if (SUB === 'support') {
  // 가만히 섬: 판 시작 때 자세로 고쳐 딛는 걸음(약 1초)이 끝난 뒤 3~8초. 걷기: 몸 기준 약 1 m/s (앞 조이스틱 0.43, 뒤·옆은 끝까지)와
  //  끝까지 민 앞걸음(약 2.3 m/s), 걷기 시작 1초 뒤부터 4초. 설계 합격선: 서기 평균 ≥ 0.98, 걷는 동안 0.35~0.75 사이를 오간다
  const res = {};
  const G = stage({ park: true });
  const s = [];
  G.run(8, (i) => i * DT >= 3 && s.push(G.player.support));
  res.stand = { mean: r3(mean(s)), min: r3(Math.min(...s)) };
  const walk = [];
  for (const [name, x, y] of [['앞 1 m/s', 0, 0.43], ['뒤', 0, -1], ['오른쪽', 1, 0], ['왼쪽', -1, 0], ['앞오른쪽', 0.3, 0.3], ['뒤왼쪽', -0.7, -0.7], ['앞 끝까지', 0, 1]]) {
    const G2 = stage({ park: true });
    G2.run(2.5);
    const a = [];
    const v = [];
    G2.pump.stick = { x, y };
    G2.run(5, (i) => {
      if (i * DT > 1) a.push(G2.player.support), v.push(Math.hypot(G2.player.comVel.x, G2.player.comVel.z));
    });
    walk.push({ name, speed: r2(mean(v)), mean: r3(mean(a)), min: r3(Math.min(...a)), max: r3(Math.max(...a)), p10: r3(q(a, 0.1)), p90: r3(q(a, 0.9)), kd: G2.player.kdLog.length });
  }
  res.walk = walk;
  const slow = walk.filter((w) => w.name !== '앞 끝까지');
  res.walkRange = { p10min: Math.min(...slow.map((w) => w.p10)), p90max: Math.max(...slow.map((w) => w.p90)) };
  line('가만히 선 s', res.stand);
  for (const w of walk) line(`걷기 ${w.name}`, w);
  line('걷기 (1 m/s 안팎) 범위', res.walkRange);
  Object.assign(out, res);
}

if (SUB === 'cuts') {
  // 4무리 × {상대 1.55 m 에 세움, 틈 2.0 m, 2.3 m} × 손가락 {6, 12 m/s} × 화면 {60, 120 Hz}. 헛휘두름(칼이 닿지 않게)으로 동작 크기를 잰다
  //  (120 Hz 는 물리 스텝마다 손 목표가 바뀌어 이해 단계 motion_sim 의 1-1 표 값이 그대로 나온다. 60 Hz 는 두 스텝에 한 번)
  const rows = [];
  for (const hz of [60, 120]) {
    for (const fam of CUT4)
      for (const dist of [1.55, 2.0, 2.3])
        for (const v of [6, 12]) {
          const { A } = cutTrial(fam, { dist, v, hz, hit: false });
          rows.push({ fam, dist, v, hz, ...A });
        }
    // 걸어 들어가며 (사선 베기): 2.3 m 에서 머묾·긋기 동안 조이스틱 앞으로
    for (const v of [6, 12]) {
      const { A } = cutTrial('diagR', { dist: 2.3, v, hz, walk: 1, hit: false });
      rows.push({ fam: 'diagR', dist: 2.3, v, hz, walk: true, ...A });
    }
  }
  out.rows = rows;
  const keys = ['arcTotal', 'arcToHit', 'follow', 'handChordB', 'handMaxDispB', 'handMaxDisp', 'handFwdHit', 'elbowPk', 'pelTwEx', 'chTwEx', 'pelRatePk', 'chRatePk', 'pelToChest_ms', 'handToBlade_ms', 'pelToBlade_ms', 'bodySharePk', 'comFwdMax', 'comVatHit', 'pelDrop', 'leanMax', 'tip', 'mid70', 'wristSat_pct', 'sMean', 'sMin', 'levCMax', 'stanceTwistMax', 'dur_ms'];
  const summ = (rs) => Object.fromEntries(keys.map((k) => [k, r2(med(rs.map((r) => r[k])))]));
  out.byFam = {};
  for (const hz of [60, 120]) for (const fam of CUT4) for (const v of [6, 12]) out.byFam[`${fam}/${v} ${hz}Hz`] = summ(rows.filter((r) => r.fam === fam && r.v === v && r.hz === hz && !r.walk));
  for (const hz of [60, 120]) out[`diagR12_${hz}Hz`] = summ(rows.filter((r) => r.fam === 'diagR' && r.v === 12 && r.hz === hz && !r.walk));
  for (const hz of [60, 120]) out[`diagR12walk_${hz}Hz`] = summ(rows.filter((r) => r.fam === 'diagR' && r.v === 12 && r.hz === hz && r.walk));
  out.steps = rows.map((r) => `${r.fam}@${r.dist}/${r.v}/${r.hz}${r.walk ? 'w' : ''}:${r.stepFoot ?? '-'}${r.stepTDvsPk_ms != null ? '(' + r.stepTDvsPk_ms + 'ms)' : ''}`);
  out.handPathRatio6to12 = Object.fromEntries([60, 120].flatMap((hz) => CUT4.map((fam) => [`${fam} ${hz}Hz`, r2(med(rows.filter((r) => r.fam === fam && r.v === 6 && r.hz === hz && !r.walk).map((r) => r.handPathB)) / med(rows.filter((r) => r.fam === fam && r.v === 12 && r.hz === hz && !r.walk).map((r) => r.handPathB)))])));
  for (const [k, s] of Object.entries(out.byFam)) line(k, s);
  line('걸음', out.steps);
  line('손 경로 6/12', out.handPathRatio6to12);
}

// ── 결심 판정 시험 궤적 (finalizer/commit_rule4.mjs 와 같은 모양) ──
const tp = (name, S, dirDeg, len) => ({ name, S, legs: [[Math.cos((dirDeg * Math.PI) / 180) * len, Math.sin((dirDeg * Math.PI) / 180) * len]] });
const TP = [
  tp('Pflug diag DL', PAD.Pflug, 225, 0.65), tp('Pflug->WechselL drop', PAD.Pflug, 194, 0.65), tp('Pflug down', PAD.Pflug, 268, 0.65), tp('Pflug left', PAD.Pflug, 180, 0.65), tp('Pflug diag DR', PAD.Pflug, 315, 0.65),
  tp('PflugL diag DR', PAD.PflugL, 315, 0.65), tp('PflugL right', PAD.PflugL, 0, 0.65), tp('PflugL diag DL', PAD.PflugL, 225, 0.65),
  tp('ShR diagR', PAD.ShR, 225, 0.8), tp('ShL diagL', PAD.ShL, 312, 0.8), tp('Tag vert', PAD.Tag, 269, 0.8), tp('Tag diag DL', PAD.Tag, 230, 0.7),
  tp('Ochs diagR', PAD.Ochs, 225, 0.65), tp('Ochs vert', PAD.Ochs, 262, 0.75), tp('OchsL diagL', PAD.OchsL, 315, 0.65),
  tp('Side horizR', PAD.Side, 180, 0.9), tp('SideL horizL', PAD.SideL, 0, 0.9),
  tp('Wechsel riseR', PAD.Wechsel, 130, 0.8), tp('WechselL riseL', PAD.WechselL, 48, 0.8), tp('Alber riseL', PAD.Alber, 60, 0.7), tp('Alber riseR', PAD.Alber, 120, 0.7), tp('Neben riseR', PAD.Neben, 140, 0.8),
];
const deg = (d, len) => [Math.cos((d * Math.PI) / 180) * len, Math.sin((d * Math.PI) / 180) * len];
const HOOK = [
  { name: 'Pflug hook up->DL', S: PAD.Pflug, legs: [deg(85, 0.5), deg(225, 0.75)] },
  { name: 'Pflug hook upR->DL', S: PAD.Pflug, legs: [deg(60, 0.5), deg(225, 0.8)] },
  { name: 'PflugL hook up->DR', S: PAD.PflugL, legs: [deg(95, 0.5), deg(315, 0.75)] },
];
const VSMALL = { name: 'Pflug V small', S: PAD.Pflug, legs: [deg(100, 0.4), deg(230, 0.7)] }; // 팔 베기여야 한다
const mv = (a, b) => ({ name: `${a}->${b}`, S: PAD[a], to: PAD[b], legs: [[PAD[b][0] - PAD[a][0], PAD[b][1] - PAD[a][1]]] });
const FP = [['Pflug', 'Ochs'], ['Pflug', 'OchsL'], ['Pflug', 'Tag'], ['Pflug', 'PflugL'], ['PflugL', 'Pflug'], ['Pflug', 'Alber'], ['Pflug', 'Wechsel'], ['Pflug', 'Neben'], ['Pflug', 'Langort'],
  ['Ochs', 'OchsL'], ['OchsL', 'Ochs'], ['Alber', 'Ochs'], ['Alber', 'OchsL'], ['WechselL', 'Ochs'], ['Wechsel', 'OchsL'], ['Tag', 'Langort'], ['Langort', 'Side'], ['Langort', 'SideL'], ['Ochs', 'Pflug'],
  ['OchsL', 'PflugL'], ['Tag', 'Ochs'], ['Ochs', 'Tag'], ['Side', 'Langort'], ['ShR', 'Ochs'], ['Ochs', 'Langort'], ['Langort', 'Pflug'], ['Wechsel', 'Pflug'], ['WechselL', 'PflugL'], ['Alber', 'Pflug']].map(([a, b]) => mv(a, b));

/**
 * 결심 판정 한 번: 시작 자리로 옮기고(dwell 이면 0.3초 머묾, 아니면 지나가며) 궤적을 긋는다.
 * foeAttack: 상대 AI 가 치기 시작할 때 긋는다. 돌려주는 값: 1단계·확정 시각(ms, 긋기 시작부터), 손목이 자리 잡은 시각
 */
function detectOne(c, v, hz, { lift = false, dwell = true, foeAttack = false, commitOn = true } = {}) {
  const save0 = CONFIG.WHOLE.commit;
  CONFIG.WHOLE.commit = commitOn;
  const G = stage({ gap: foeAttack ? 1.9 : 2.2, seed: 11, hz, foeAI: foeAttack, immortal: true, immortalP: true });
  const P = G.player;
  G.run(0.8);
  const off = [P.handOffset.x, P.handOffset.y];
  const ch = feedTrace(G, stroke(c.S[0] - off[0], c.S[1] - off[1], 1.2, { hold: dwell ? 300 : 0, lift: false }), hz);
  while (!ch.done) G.step();
  if (foeAttack) for (let i = 0; i < 6 / DT && !(G.ai.mode === 'attack' && G.ai.phase === 'strike'); i++) G.step();
  const tr = feedTrace(G, strokes(c.legs, v, { lift, down: false, hold: lift ? 0 : 150 }), hz);
  const nC = P.commitLog.length;
  const yawInv = () => P.yaw.clone().invert();
  const wr = [];
  while (tr.t0 == null) G.step();
  const t0 = tr.t0;
  for (let i = 0; i < 1.0 / DT; i++) {
    G.step();
    wr.push({ t: G.t, h: handPos(P).sub(V(P.bodies.chest.translation())).applyQuaternion(yawInv()) });
  }
  const log = P.commitLog.slice(nC);
  const A = log.find((x) => x.stage === 'A');
  const B = log.find((x) => x.stage === 'B');
  const fin = wr[wr.length - 1].h;
  let tSettle = null;
  for (let i = wr.length - 1; i >= 0; i--) if (wr[i].h.distanceTo(fin) > 0.03) {
    tSettle = wr[Math.min(wr.length - 1, i + 1)].t;
    break;
  }
  CONFIG.WHOLE.commit = save0;
  return { A: A ? r0((A.t - t0) * 1000) : null, B: B ? r0((B.t - t0) * 1000) : null, fam: B?.fam ?? A?.fam ?? null, c: B ? r2(B.c) : null, settle: tSettle == null ? 0 : r0((tSettle - t0) * 1000) };
}

if (SUB === 'detect') {
  const HZ = [60, 90, 120];
  const speeds = NARG ? [NARG] : [4, 5, 6, 8, 12];
  const res = {};
  for (const hz of HZ)
    for (const v of speeds) {
      const key = `${hz}Hz ${v}m/s`;
      const r = { big: null, hook: null, vsmall: null, fp: null, fpFoe: null };
      if (v >= 5) {
        let n = 0;
        let nA = 0;
        let nB = 0;
        const miss = [];
        const tA = [];
        const tB = [];
        const pflugN = [0, 0];
        for (const c of TP)
          for (const lift of [false, true]) {
            const d = detectOne(c, v, hz, { lift });
            n++;
            if (d.A != null) nA++, tA.push(d.A);
            if (d.B != null) nB++, tB.push(d.B);
            else miss.push(c.name + (lift ? '(떼기)' : ''));
            if (c.name.startsWith('Pflug')) (pflugN[0] += 1), (pflugN[1] += d.B != null ? 1 : 0);
          }
        r.big = { confirmed: `${nB}/${n}`, pct: pct(nB, n), stageA: `${nA}/${n}`, pflug: `${pflugN[1]}/${pflugN[0]}`, tA_med: r0(med(tA)), tB_med: r0(med(tB)), tB_max: tB.length ? Math.max(...tB) : null, miss };
        let hk = 0;
        for (const c of HOOK) for (const lift of [false, true]) if (detectOne(c, v, hz, { lift }).B != null) hk++;
        r.hook = `${hk}/${HOOK.length * 2}`;
        r.vsmall = detectOne(VSMALL, v, hz).B != null ? '확정(틀림)' : '팔 베기';
      }
      if ([4, 6, 8].includes(v)) {
        let fB = 0;
        let fA = 0;
        let fBd = 0;
        const delays = [];
        const bad = [];
        for (const c of FP)
          for (const dwell of [false, true]) {
            const d = detectOne(c, v, hz, { dwell });
            if (d.A != null) {
              fA++;
              const off = detectOne(c, v, hz, { dwell, commitOn: false });
              delays.push(d.settle - off.settle);
            }
            if (d.B != null) (dwell ? fBd++ : fB++), bad.push(c.name + (dwell ? '(머묾)' : ''));
          }
        r.fp = { confirmed: `${fB}/${FP.length}`, confirmedDwelled: `${fBd}/${FP.length}`, stageA: `${fA}/${FP.length * 2}`, delay_ms_max: delays.length ? Math.max(...delays) : 0, delay_ms_med: delays.length ? r0(med(delays)) : 0, bad };
        let foe = 0;
        for (const c of FP) if (detectOne(c, v, hz, { foeAttack: true }).B != null) foe++;
        r.fpFoe = `${foe}/${FP.length}`;
      }
      res[key] = r;
      line(key, { big: r.big && r.big.confirmed, pflug: r.big?.pflug, hook: r.hook, fp: r.fp && r.fp.confirmed, fpFoe: r.fpFoe, delay: r.fp?.delay_ms_max });
    }
  out.res = res;
  out.note = '확정·1단계는 fighter.onCommit 고리로 센다. 결심 층(L1)이 없으면 모두 0 (기준).';
}

if (SUB === 'react') {
  // 준비 자세에서 8 m/s 로 긋기 시작 → 칼끝(가슴 기준)이 긋는 방향(패드 → 몸: 칼 든 쪽·위)으로 2 cm 움직인 때 (moveDir),
  //  어느 쪽이든 2 cm 움직인 때 (moveAny), → 1.55 m 더미에 닿은 때 (hit: 첫 상처나 칼 부딪힘). 쟁기에서 곧바로 사선으로 긋기(자동 감기 자리)도.
  //  결심 켬·끔을 한 프로세스에서 번갈아 잰다
  const rows = [];
  const cases = [...['diagR', 'vert', 'horizR', 'diagL'].map((fam) => ({ fam, from: FAM[fam].ch, to: FAM[fam].end })), { fam: 'Pflug→diag', from: PAD.Pflug, to: [PAD.Pflug[0] - 0.46, PAD.Pflug[1] - 0.46] }];
  for (const commitOn of [false, true])
    for (const cs of cases)
      for (const hz of [60, 120]) {
        const save0 = CONFIG.WHOLE.commit;
        CONFIG.WHOLE.commit = commitOn;
        const G = stage({ dist: 1.55, seed: 5, hz, immortal: true });
        G.run(1.5);
        const C = playerCut(G, { ch: cs.from, end: cs.to }, { v: 8, hz, after: 0.8, dwell: 0.3 });
        const S = C.S;
        const dx = cs.to[0] - cs.from[0];
        const dy = cs.to[1] - cs.from[1];
        const L = Math.hypot(dx, dy);
        const dir = new THREE.Vector3(0, dy / L, dx / L); // 몸 기준 (앞, 위, 칼 든 쪽)
        const tip0 = S[C.i0 - 1].tipBC;
        let tDir = null;
        let tAny = null;
        for (let i = C.i0; i < S.length; i++) {
          const d = S[i].tipBC.clone().sub(tip0);
          if (tDir == null && d.dot(dir) >= 0.02) tDir = S[i].t;
          if (tAny == null && d.length() >= 0.02) tAny = S[i].t;
        }
        const w = C.wounds.find((x) => x.t <= C.t0 + 0.8);
        const cl = G.clashT.find((c) => c.t >= C.t0 && c.t <= C.t0 + 0.8);
        const tHit = w ? w.t : cl ? cl.t : null;
        rows.push({ commitOn, fam: cs.fam, hz, moveDir_ms: tDir == null ? null : r0((tDir - C.t0) * 1000), moveAny_ms: tAny == null ? null : r0((tAny - C.t0) * 1000), hit_ms: tHit == null ? null : r0((tHit - C.t0) * 1000), d0: r2(C.d0) });
        CONFIG.WHOLE.commit = save0;
      }
  out.rows = rows;
  for (const on of [false, true]) {
    const rs = rows.filter((r) => r.commitOn === on && r.fam !== 'Pflug→diag');
    const pf = rows.filter((r) => r.commitOn === on && r.fam === 'Pflug→diag');
    out[on ? 'on' : 'off'] = { moveDir_ms_med: r0(med(rs.map((r) => r.moveDir_ms))), moveDir_ms_max: Math.max(...rs.map((r) => r.moveDir_ms ?? 999)), moveAny_ms_med: r0(med(rs.map((r) => r.moveAny_ms))), hit_ms_med: r0(med(rs.map((r) => r.hit_ms))), pflugHit_ms: pf.map((r) => r.hit_ms) };
    line(on ? '결심 켬' : '결심 끔', out[on ? 'on' : 'off']);
  }
  for (const r of rows.filter((x) => !x.commitOn)) line(`  ${r.fam} ${r.hz}Hz`, r);
}

if (SUB === 'combo') {
  // 오른-왼-오른 (사선) 베기를 0.6/0.8/1.0초 간격으로, 상대 2.3 m. 걷다가 곧바로 베기. 각 베기의 칼 최고 빠르기와 발 닿는 시각
  const res = {};
  for (const I of [0.6, 0.8, 1.0]) {
    const G = stage({ dist: 2.3, seed: 9, immortal: true });
    const P = G.player;
    G.run(1.2);
    // 준비: 어깨 지붕
    const off = [P.handOffset.x, P.handOffset.y];
    const ch = feedTrace(G, stroke(PAD.ShR[0] - off[0], PAD.ShR[1] - off[1], 1.2, { hold: 300, lift: false }), 60);
    while (!ch.done) G.step();
    // 한 줄 궤적: 베기(12 m/s) → 반대 어깨로 들기(3 m/s) → 베기 …, 베기 시작 간격 I
    const seq = [['diagR', PAD.ShR, PAD.WechselL], ['diagL', PAD.WechselL, PAD.ShL, PAD.Wechsel], ['diagR', PAD.Wechsel, PAD.ShR, PAD.WechselL]];
    const pts = [[0, 0, 0]];
    let t = 0;
    let x = 0;
    let y = 0;
    const cutT = [];
    for (let k = 0; k < seq.length; k++) {
      const s = seq[k];
      const tStart = k * I * 1000;
      if (s.length === 4) {
        // 반대 어깨로 들어 올리기 (베기 시작 전에 끝나게)
        const up = [s[2][0] - s[1][0], s[2][1] - s[1][1]];
        const Tu = (Math.hypot(...up) / 3) * 1000;
        t = Math.max(t, tStart - Tu - 60);
        pts.push([t, x, y]);
        x += up[0];
        y += up[1];
        t += Tu;
        pts.push([t, x, y]);
      }
      const a = s.length === 4 ? s[2] : s[1];
      const b = s.length === 4 ? s[3] : s[2];
      t = Math.max(t, tStart);
      pts.push([t, x, y]);
      cutT.push(t);
      x += b[0] - a[0];
      y += b[1] - a[1];
      t += (Math.hypot(b[0] - a[0], b[1] - a[1]) / 12) * 1000;
      pts.push([t, x, y]);
    }
    const tr = feedTrace(G, { pts, down: false, lift: true }, 60);
    const S = [];
    while (tr.t0 == null) G.step();
    const t0 = tr.t0;
    for (let i = 0; i < (cutT.at(-1) / 1000 + 1.0) / DT; i++) {
      G.step();
      S.push({ t: G.t, mid: P.hitPointVel.length() });
    }
    const cuts = cutT.map((ct, k) => {
      const a = t0 + ct / 1000;
      const win = S.filter((s) => s.t >= a && s.t < a + 0.45);
      const pk = win.reduce((m, s) => (s.mid > m.mid ? s : m), win[0]);
      const td = P.tdLog.filter((d) => d.t > a - 0.3 && d.t < a + 0.6);
      const near = td.length ? td.reduce((m, d) => (Math.abs(d.t - pk.t) < Math.abs(m.t - pk.t) ? d : m)) : null;
      return { cut: seq[k][0], pk_ms: r0((pk.t - a) * 1000), td: near ? { foot: near.foot, kind: near.kind, vsPk_ms: r0((near.t - pk.t) * 1000) } : null };
    });
    res[`interval ${I}`] = { cuts, kd: P.kdLog.length };
    line(`간격 ${I}초`, res[`interval ${I}`]);
  }
  {
    // 걷다가 곧바로 베기: 3.0 m 에서 앞으로 걸어 2.0 m 에 오면 준비 없이 곧바로 사선 베기
    const G = stage({ dist: 3.0, seed: 9, immortal: true });
    const P = G.player;
    G.run(1.0);
    const off = [P.handOffset.x, P.handOffset.y];
    const ch = feedTrace(G, stroke(PAD.ShR[0] - off[0], PAD.ShR[1] - off[1], 1.2, { hold: 0, lift: false }), 60);
    G.pump.stick = { x: 0, y: 1 };
    for (let i = 0; i < 4 / DT && (P.foeDistance() > 2.0 || !ch.done); i++) G.step();
    const C = playerCut(G, 'diagR', { chambered: false, from: [P.handOffset.x, P.handOffset.y], v: 12, after: 1.0 });
    G.pump.stick = { x: 0, y: 0 };
    const A = analyse(C.S, C.i0, C.S.length - 1, C.tgt);
    const pkT = C.S[C.i0].t + A.tPk_ms / 1000;
    const td = P.tdLog.filter((d) => d.t > C.t0 - 0.3 && d.t < C.t0 + 0.8).map((d) => ({ foot: d.foot, kind: d.kind, vsPk_ms: r0((d.t - pkT) * 1000) }));
    res.walkThenCut = { tPk_ms: A.tPk_ms, touchdowns: td, kd: P.kdLog.length };
    line('걷다가 베기', res.walkThenCut);
  }
  out.res = res;
}

function sweepRows(fams, { dists = [1.38, 1.53, 1.71, 1.91], walkDists = [1.95, 2.15, 2.35], jit = [0, -0.03, 0.03], v = 12, str } = {}) {
  // 더미는 AI 가 없어 판마다 똑같이 움직인다 → 시드 대신 거리를 조금씩(jit) 흔든다: 맞느냐 빗나가느냐가 몇 cm 에 갈린다.
  //  걸어 들어가며: 그 거리에서 머묾·긋기 동안 조이스틱 앞으로. j = 0 인 줄이 이름난 거리
  const rows = [];
  const row = (fam, d, j, walk, A) => ({ fam, walk, d, j, d0: A.d0, E: A.hitBestE, zone: A.hitBestZone ?? '-', first: A.hitFirst?.zone ?? '-', lat: A.hitLat ?? null, pkMinusHit: A.hitFirst ? A.pkMinusHit_ms : null, mid70: A.mid70, com: A.comFwdMax, comV: A.comVatHit, tPk: A.tPk_ms });
  for (const fam of fams)
    for (const j of jit) {
      for (const d of dists) rows.push(row(fam, d, j, false, cutTrial(fam, { dist: d + j, v, hit: true, str }).A));
      for (const d of walkDists) rows.push(row(fam, d, j, true, cutTrial(fam, { dist: d + j, v, hit: true, walk: 1, str }).A));
    }
  return rows;
}
const sweepSumm = (rs) => ({ n: rs.length, meanE: r0(mean(rs.map((r) => r.E))), medE: r0(med(rs.map((r) => r.E))), miss: rs.filter((r) => !r.E).length, latMed: r2(med(rs.map((r) => r.lat))), pkMinusHitMed: r0(med(rs.map((r) => r.pkMinusHit))), firstZones: rs.map((r) => r.first).join(',') });

if (SUB === 'sweep') {
  const rows = sweepRows(['diagR', 'vert']);
  out.rows = rows;
  out.summary = {};
  for (const fam of ['diagR', 'vert']) {
    out.summary[fam + ' 서서 (4 거리)'] = sweepSumm(rows.filter((r) => r.fam === fam && !r.walk && r.j === 0));
    out.summary[fam + ' 서서 (흔들어 12)'] = sweepSumm(rows.filter((r) => r.fam === fam && !r.walk));
    out.summary[fam + ' 걸어 들어가며 (9)'] = sweepSumm(rows.filter((r) => r.fam === fam && r.walk));
  }
  out.summary.walkOverStand_diagR = r2(out.summary['diagR 걸어 들어가며 (9)'].meanE / out.summary['diagR 서서 (흔들어 12)'].meanE);
  for (const [k, s] of Object.entries(out.summary)) line(k, s);
}

if (SUB === 'trunkoff') {
  // 몸통 비틀기(골반·가슴 비틀기 목표)를 0으로 묶는다: updateBodyPose 를 감싸 비틀기 목표와 그 속도를 지운다 (저장소 코드는 그대로)
  const orig = Fighter.prototype.updateBodyPose;
  let pin = false;
  Fighter.prototype.updateBodyPose = function (dt) {
    orig.call(this, dt);
    if (!pin || this.index !== 0) return;
    this.bodyPose.pelvisYaw = this.bodyPose.chestYaw = 0;
    this.bodyPoseVel.pelvisYaw = this.bodyPoseVel.chestYaw = 0;
    this.pelvisYawOffset = 0;
  };
  const res = {};
  for (const p of [false, true]) {
    pin = p;
    const air = [];
    for (const fam of ['diagR', 'horizR', 'vert']) for (const v of [6, 12]) air.push({ fam, v, mid70: cutTrial(fam, { dist: 2.0, v, hit: false }).A.mid70 });
    const hit = sweepRows(['diagR', 'horizR', 'vert'], { dists: [1.38, 1.53, 1.71], walkDists: [] });
    res[p ? 'off' : 'on'] = { air, hit, meanE: mean(hit.map((r) => r.E)) };
  }
  pin = false;
  Fighter.prototype.updateBodyPose = orig;
  const ratioV = res.off.air.map((a, i) => (a.mid70 / res.on.air[i].mid70) ** 2);
  out.res = res;
  out.energyRatio_v70sq = { med: r2(med(ratioV)), min: r2(Math.min(...ratioV)), max: r2(Math.max(...ratioV)) };
  out.energyRatio_dummy = r2(res.off.meanE / res.on.meanE);
  line('몸통 끔 / 켬 (칼 70% 빠르기²)', out.energyRatio_v70sq);
  line('몸통 끔 / 켬 (더미 에너지)', out.energyRatio_dummy);
}

if (SUB === 'strength' || SUB === 'power') {
  const res = {};
  const cases = SUB === 'strength' ? [0.8, 1.0, 1.3].map((s) => ({ key: `근력 ${s}`, str: s, v: 12 })) : [[0.3, 6], [0.6, 6 + (0.3 * 6) / 0.7], [1.0, 12]].map(([c, v]) => ({ key: `c ${c} (${r1(v)} m/s)`, v }));
  for (const cs of cases) {
    // 맞느냐 빗나가느냐가 몇 cm 에 갈려 에너지가 크게 흔들린다 → 3무리 × 4거리 × 3흔듦 = 36번의 평균
    const rows = sweepRows(['diagR', 'vert', 'horizR'], { dists: [1.38, 1.53, 1.71, 1.91], walkDists: [], v: cs.v, str: cs.str });
    res[cs.key] = { meanE: r0(mean(rows.map((r) => r.E))), hits: rows.filter((r) => r.E > 0).length + '/' + rows.length, meanE_hits: r0(mean(rows.filter((r) => r.E > 0).map((r) => r.E))), strokeT_ms: r0(med(rows.map((r) => r.tPk))), mid70: r1(med(rows.map((r) => r.mid70))), comFwd: r2(med(rows.map((r) => r.com))), rows };
    line(cs.key, { ...res[cs.key], rows: undefined });
  }
  const ks = Object.keys(res);
  if (SUB === 'strength') {
    out.E_13over10 = r2(res[ks[2]].meanE / res[ks[1]].meanE);
    out.T_08over13 = r2(res[ks[0]].strokeT_ms / res[ks[2]].strokeT_ms);
    line('근력 1.3/1.0 에너지 · 0.8/1.3 획 시간', [out.E_13over10, out.T_08over13]);
  } else {
    out.E_c1overc03 = r2(res[ks[2]].meanE / res[ks[0]].meanE);
    line('c 1 / c 0.3 에너지', out.E_c1overc03);
  }
  out.res = res;
}

if (SUB === 'stand') {
  // 상대 없이 제자리에서 N번 (무리를 돌아가며, 12 m/s). 스스로 넘어짐과 s
  const N = NARG ?? 200;
  const G = stage({ park: true });
  const P = G.player;
  G.run(1.2);
  const s = [];
  let stepped = 0;
  const fams = ['diagR', 'vert', 'horizR', 'riseR', 'diagL'];
  const S = [];
  for (let k = 0; k < N; k++) {
    if (P.state !== 'stand') G.run(1, () => s.push(P.support));
    const C = playerCut(G, fams[k % fams.length], { v: 12, dwell: 0.2, chamberV: 2, after: 0.5, S });
    for (let i = C.i0; i < S.length; i++) s.push(S[i].s);
    const A = analyse(S, C.i0, S.length - 1, null);
    if (A.stepFoot) stepped++;
    S.length = 0;
  }
  out.cuts = N;
  out.selfKd = P.kdLog.length;
  out.kdCauses = P.kdLog.map((k) => k.c);
  out.sMean = r3(mean(s));
  out.sMin = r3(Math.min(...s));
  out.stepped = stepped;
  line('서서 휘두르기', { cuts: N, selfKd: out.selfKd, sMean: out.sMean, sMin: out.sMin, stepped });
}

if (SUB === 'miss') {
  // 헛친 베기: 상대가 2.8 m 에 서 있어 닿지 않는다. 반은 긋고 나서 0.4초 동안 조이스틱을 뒤로 당긴다(거스름).
  //  비틀 걸음 = 스스로 딛은 걸음이 아닌 것: 균형을 잡는 걸음('catch'), 조이스틱을 건드리지 않은 판은 균형 걸음(stumble)도.
  //  (뒤로 당긴 판은 멈추며 생기는 균형 걸음이 섞이므로 'catch' 만 센다). s 회복 = 가장 낮던 때부터 0.9 까지
  const N = NARG ?? 40;
  const rows = [];
  for (let k = 0; k < N; k++) {
    const counter = k % 2 === 1;
    const G = stage({ dist: 2.8, seed: 100 + k, immortal: true });
    const P = G.player;
    G.run(2.0);
    const fam = ['diagR', 'vert', 'horizR', 'diagL'][(k >> 1) % 4];
    const C = playerCut(G, fam, { v: 12, after: 0.15 });
    const tEnd = C.cut.t1 ?? G.t;
    let stag = 0;
    let sLow = 1;
    let tLow = null;
    let tBack = null;
    const td0 = P.tdLog.length;
    G.run(1.2, (i) => {
      G.pump.stick = { x: 0, y: counter && i * DT < 0.4 ? -1 : 0 };
      if (!counter && P.stumble.length() > 0.01) stag++;
      if (P.support < sLow) (sLow = P.support), (tLow = G.t);
      if (tLow != null && tBack == null && sLow < 0.9 && P.support >= 0.9) tBack = G.t;
    });
    G.pump.stick = { x: 0, y: 0 };
    const tds = P.tdLog.slice(td0).map((d) => d.kind);
    rows.push({ fam, counter, stagger: stag > 0 || tds.includes('catch'), kd: P.kdLog.length, sLow: r3(sLow), sBack_ms: tBack == null ? null : r0((tBack - tLow) * 1000), steps: tds.join(','), after_ms: r0((G.t - tEnd) * 1000) });
  }
  out.rows = rows;
  for (const counter of [false, true]) {
    const rs = rows.filter((r) => r.counter === counter);
    out[counter ? 'counter' : 'plain'] = { n: rs.length, stagger: pct(rs.filter((r) => r.stagger).length, rs.length), kd: pct(rs.filter((r) => r.kd).length, rs.length), sBack_ms_med: r0(med(rs.map((r) => r.sBack_ms))), sLow_med: r3(med(rs.map((r) => r.sLow))) };
    line(counter ? '헛침 + 뒤로 당김' : '헛침', out[counter ? 'counter' : 'plain']);
  }
}

if (SUB === 'block') {
  // (가) 멈춰 선 막기: 상대가 왼쪽 높은 자세로 칼을 세워 받친다 (AI 끔, 칼은 부딪힌다). 나는 1.7 m 에서 사선 베기
  // (나) 더 센 칼: 상대 = 근력 1.3 츠바이핸더 AI (보통). 상대가 치기 시작하면 나도 사선 베기
  const N = NARG ?? 30;
  const res = {};
  for (const kind of ['받친 막기', '센 칼']) {
    const rows = [];
    for (let k = 0; k < N; k++) {
      const strong = kind === '센 칼';
      const G = stage({ dist: strong ? 2.0 : 1.55, seed: 200 + k, foeSword: true, foeAI: strong, weapon2: strong ? 'zweihander' : undefined, foeStr: strong ? 1.3 : undefined, immortal: true, immortalP: true });
      const P = G.player;
      const E = G.enemy;
      if (!strong) E.handOffset.set(-0.3 + 0.05 * ((k % 3) - 1), 0.28);
      G.run(1.2);
      if (strong) for (let i = 0; i < 6 / DT && !(G.ai.mode === 'attack' && G.ai.phase === 'strike'); i++) G.step();
      const tilt0 = P.tiltDeg();
      const C = playerCut(G, 'diagR', { v: 12, dwell: strong ? 0.05 : 0.4, chamberV: strong ? 4 : 1.2, after: 1.0 });
      const cl = G.clashT.filter((c) => c.t >= C.t0 && c.t < C.t0 + 0.5);
      let loss = null;
      if (cl.length) {
        const tc = cl[0].t;
        const pre = C.S.filter((s) => s.t <= tc && s.t > tc - 0.05);
        const post = C.S.filter((s) => s.t > tc && s.t <= tc + 0.06);
        if (pre.length && post.length) loss = 1 - Math.min(...post.map((s) => s.tip)) / Math.max(...pre.map((s) => s.tip));
      }
      const A = analyse(C.S, C.i0, C.S.length - 1, C.tgt);
      rows.push({ clash: cl.length > 0, loss: r2(loss), hit: C.wounds.length > 0, footMove: Math.max(...A.footMove), tiltMax: r1(Math.max(...C.S.slice(C.i0).map((s) => Math.abs(s.lean - C.S[C.i0].lean)))), tilt0: r1(tilt0), kd: P.kdLog.length, result: G.player.commit?.result ?? null });
    }
    res[kind] = { n: rows.length, clash: pct(rows.filter((r) => r.clash).length, rows.length), lossMed: r2(med(rows.map((r) => r.loss))), pushedStep: pct(rows.filter((r) => r.footMove > 0.08).length, rows.length), tiltMed: r1(med(rows.map((r) => r.tiltMax))), kd: rows.filter((r) => r.kd).length, blockedJudged: pct(rows.filter((r) => r.result === 'blocked').length, rows.length), rows };
    line(kind, { ...res[kind], rows: undefined });
  }
  out.res = res;
}

if (SUB === 'react_body') {
  // 더미가 맞았을 때 0.6초 동안 머리·가슴·무게중심·발이 움직인 최대 거리 (impact_probe A 와 같은 잣대)
  const rows = [];
  // 더미는 AI 가 없어 시드가 같은 판을 만든다 → 거리를 조금씩 흔든다
  for (const fam of ['diagR', 'vert', 'horizR', 'diagL'])
    for (const d of [1.3, 1.45, 1.6, 1.75])
      for (const j of [-0.02, 0, 0.02]) {
        const G = stage({ dist: d + j, immortal: true });
        const E = G.enemy;
        G.run(1.5);
        const S = [];
        G.after = () => S.push({ t: G.t, head: V(E.bodies.head.translation()), chest: V(E.bodies.chest.translation()), com: E.com.clone(), footF: V(E.bodies.footF.translation()), footB: V(E.bodies.footB.translation()), state: E.state });
        const C = playerCut(G, fam, { v: 12, after: 0.01, armAtCut: true });
        const stood = E.state === 'stand';
        G.run(0.8);
        G.after = null;
        const ws = G.woundsR.filter((x) => x.att === G.player && x.t >= C.t0 && x.t <= C.t0 + 0.6);
        const w = ws.length ? ws.reduce((a, b) => (b.E > a.E ? b : a)) : null;
        if (!w || !stood) {
          rows.push({ fam, d, j, hit: false, stood });
          continue;
        }
        const s0 = S.filter((s) => s.t < w.t).at(-1) ?? S[0];
        const win = S.filter((s) => s.t >= w.t && s.t <= w.t + 0.6);
        const disp = (k) => Math.max(...win.map((s) => Math.hypot(s[k].x - s0[k].x, s[k].z - s0[k].z)));
        rows.push({ fam, d, j, hit: true, E: r0(w.E), zone: w.zone, type: w.type, head_cm: r1(disp('head') * 100), chest_cm: r1(disp('chest') * 100), com_cm: r1(disp('com') * 100), foot_cm: r1(Math.max(disp('footF'), disp('footB')) * 100), fell: win.some((s) => s.state !== 'stand'), states: [...new Set(win.map((s) => s.state))].join('>') });
      }
  out.rows = rows;
  // 넘어진(균형을 잃고 주저앉은) 판은 몸 이동에서 뺀다 (넘어지며 움직인 거리라서). 넘어진 수는 따로 센다
  out.fellHits = rows.filter((r) => r.hit && r.fell).length;
  const hits = rows.filter((r) => r.hit && !r.fell);
  const big = hits.filter((r) => r.E >= 80);
  const head = hits.filter((r) => r.zone === 'head' || r.zone === 'neck');
  const sm = (rs) => ({ n: rs.length, E: r0(med(rs.map((r) => r.E))), head_cm: r1(med(rs.map((r) => r.head_cm))), chest_cm: r1(med(rs.map((r) => r.chest_cm))), com_cm: r1(med(rs.map((r) => r.com_cm))), foot_cm: r1(med(rs.map((r) => r.foot_cm))), fell: rs.filter((r) => r.fell).length });
  out.all = sm(hits);
  out.E80plus = sm(big);
  out.headHits = sm(head);
  line('맞힘 전체', out.all);
  line('80 J 넘음', out.E80plus);
  line('머리·목', out.headHits);
  line('맞고 넘어짐', `${out.fellHits}/${rows.filter((r) => r.hit).length}`);
}

/** AI 대 AI 싸움 한 판을 돌리며 AI 공격마다 기록 (ai·hitstop 부분이 쓴다) */
function aiFight(seed, secs, { difficulty = 'normal', onStep } = {}) {
  const G = stage({ walls: true, gap: CONFIG.ARENA.startGap, seed, foeAI: true, difficulty, pump: false, pad: null });
  const P = G.player;
  const E = G.enemy;
  G.ai2 = new AI(P, E, difficulty);
  const recs = [];
  const req = { asked: 0, ok: 0 };
  for (const [ai, me, foe] of [[G.ai2, P, E], [G.ai, E, P]]) {
    const oa = ai.startAttack.bind(ai);
    ai.startAttack = (tech, why, opt) => {
      const ok = oa(tech, why, opt);
      if (ok) ai._att = { t: G.t, why };
      return ok;
    };
    const os = ai.startStrike.bind(ai);
    ai.startStrike = () => {
      const hand = [me.handOffset.x, me.handOffset.y];
      os();
      const t = ai.tech;
      const down = t.kind !== 'thrust' && t.path.length && t.path[t.path.length - 1][1] < t.from[1] - 0.3;
      const cd = Math.hypot(hand[0] - t.from[0], hand[1] - t.from[1]);
      // 준비 있는 베기 = 치기 시작할 때 칼이 앞에서 90° 넘게 뒤로 젖혀져 있다 (들어 올려 감은 칼). 이해 단계 motion_sim 의
      //  bladeStartFromFwd > 90° 와 같은 잣대 (그때 AI 내려베기 52%)
      const b = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(me.sword.rotation())).applyQuaternion(me.yaw.clone().invert());
      const fromFwd = Math.acos(THREE.MathUtils.clamp(b.x, -1, 1)) * R2D;
      recs.push({ seed, who: me.name, me, foe, t: G.t, tAtt: ai._att?.t ?? G.t, why: ai.why, tech: t.name, kind: t.kind, feint: !!ai.feint, down, chamberDist: r2(cd), bladeFromFwd: r0(fromFwd), prepared: fromFwd > 90, d: r2(me.foeDistance()), com0: me.com.clone(), foe0: V(foe.bodies.chest.translation()), tipPk: 0, contact: null });
    };
    if (me.gait) {
      const orq = me.gait.requestStep.bind(me.gait);
      me.gait.requestStep = (o) => {
        req.asked++;
        const r = orq(o);
        if (r) req.ok++;
        return r;
      };
    }
  }
  const wounds = [];
  G.onWound = (att, vic, r) => {
    const a = att.bodies.pelvis.linvel();
    const pa = att.bodies.chest.translation();
    const pv = vic.bodies.chest.translation();
    const dx = pv.x - pa.x;
    const dz = pv.z - pa.z;
    const L = Math.hypot(dx, dz) || 1;
    wounds.push({ t: G.t, att, vic, E: r.energy, type: r.type, zone: r.zone, sev: r.severity, pass: r.pass, stuck: r.stuck, helmet: r.helmet, vToward: (a.x * dx + a.z * dz) / L, alive: vic.alive });
  };
  G.woundsAI = wounds;
  let tEnd = secs;
  for (let i = 0; i < secs / DT; i++) {
    G.step();
    onStep?.(G);
    for (const r of recs) {
      const age = G.t - r.t;
      if (age > 0.8) continue;
      r.tipPk = Math.max(r.tipPk, r.me.tipVel.length());
      if (age <= 0.5) r.comFwd = r.me.com.clone().sub(r.com0).dot(new THREE.Vector3(r.foe0.x - r.com0.x, 0, r.foe0.z - r.com0.z).normalize());
      for (const x of wounds) if (x.att === r.me && x.t >= r.t && x.t <= G.t && !(x.E <= (r.hitE ?? 0))) r.hitE = x.E;
      if (r.contact == null) {
        const w = wounds.find((x) => x.att === r.me && x.t >= r.t && x.t <= G.t);
        const c = G.clashT.find((x) => x.t >= r.t && x.t <= G.t);
        if (w || c) r.contact = (w && c ? Math.min(w.t, c.t) : w ? w.t : c.t) - r.t;
      }
    }
    if (!P.alive || !E.alive) {
      tEnd = G.t;
      break;
    }
  }
  return { G, recs, wounds, req, tEnd, kd: P.kdLog.length + E.kdLog.length, kdCauses: [...P.kdLog, ...E.kdLog].map((k) => k.c) };
}

if (SUB === 'ai') {
  const N = NARG ?? 8;
  const all = [];
  const W = [];
  const req = { asked: 0, ok: 0 };
  let kd = 0;
  const causes = [];
  let secs = 0;
  for (let seed = 1; seed <= N; seed++) {
    const r = aiFight(seed, 40);
    all.push(...r.recs);
    W.push(...r.wounds);
    req.asked += r.req.asked;
    req.ok += r.req.ok;
    kd += r.kd;
    causes.push(...r.kdCauses);
    secs += r.tEnd;
  }
  const cuts = all.filter((r) => r.kind !== 'thrust');
  const downs = cuts.filter((r) => r.down && !r.feint);
  const wAI = W.filter((w) => w.E >= 15);
  out.strikes = all.length;
  out.downCuts = downs.length;
  out.preparedDown_pct = pct(downs.filter((r) => r.prepared).length, downs.length);
  out.unpreparedHitE_med = r0(med(downs.filter((r) => !r.prepared).map((r) => r.hitE)));
  out.signalToContact = { fromAttack_ms_med: r0(med(all.filter((r) => r.contact != null).map((r) => (r.t - r.tAtt + r.contact) * 1000))), fromStrike_ms_med: r0(med(all.filter((r) => r.contact != null).map((r) => r.contact * 1000))), p10_fromAttack_ms: r0(q(all.filter((r) => r.contact != null).map((r) => (r.t - r.tAtt + r.contact) * 1000), 0.1)) };
  out.tipMed = r1(med(cuts.map((r) => r.tipPk)));
  out.tipP90 = r1(q(cuts.map((r) => r.tipPk), 0.9));
  out.comFwdMed = r2(med(cuts.map((r) => r.comFwd)));
  out.vTowardAtWound_med = r2(med(wAI.map((w) => w.vToward)));
  out.stepRequests = `${req.ok}/${req.asked}`;
  out.kdPerFight = r2(kd / N);
  out.kdCauses = causes;
  out.fightSecs = r1(secs);
  out.recs = all.map(({ me, foe, com0, foe0, ...r }) => r);
  for (const k of ['strikes', 'downCuts', 'preparedDown_pct', 'signalToContact', 'tipMed', 'tipP90', 'comFwdMed', 'vTowardAtWound_med', 'stepRequests', 'kdPerFight']) line(k, out[k]);
}

/**
 * 딛은 발이 닿은 자리에서 미끄러진 거리 (m, 수평). gait.js pinFeet 와 같은 점을 본다: 발바닥 가운데, 뒤꿈치를 들었으면 발끝.
 *  (발 몸체 가운데를 보면 뒤꿈치를 들 때 발이 발끝으로 구르는 것까지 밀림으로 잡힌다)
 *  td = 닿은 순간의 { C: pinC, T: pinT } 사본
 */
const SOLE_C = new THREE.Vector3(0, -0.035, 0);
const SOLE_T = new THREE.Vector3(0.12, -0.035, 0);
const _sp = new THREE.Vector3();
function pinSlip(f, k, td) {
  const l = f.gait.legs[k];
  const b = f.bodies[l.foot];
  const toe = l.heel > 0.05;
  _sp.copy(toe ? SOLE_T : SOLE_C).applyQuaternion(Q(b.rotation())).add(V(b.translation()));
  const ref = toe ? td.T : td.C;
  return Math.hypot(_sp.x - ref.x, _sp.z - ref.z);
}

if (SUB === 'aistep') {
  const N = NARG ?? 8;
  const recs = [];
  const ctls = [];
  const lost = {};
  let asked = 0;
  let strikes = 0;
  let kd = 0;
  let secs = 0;
  const along = (a, b, fw) => (a.x - b.x) * fw.x + (a.z - b.z) * fw.z;
  for (let seed = +(process.env.AISEED || 1); seed <= N; seed++) {
    let hooked = false;
    const live = [];
    const hook = (G, f) => {
      const g = f.gait;
      if (!g) return;
      // 딛지 못한 부탁의 까닭: 발을 들기 전에 물러남(wait) / 든 발을 걷는 걸음으로 바꿈(air) / 1초 안에 못 시작함(expired)
      const oup = g.update.bind(g);
      g.update = (...a) => {
        const r0 = g.req;
        const ph0 = ['F', 'B'].some((k) => !g.legs[k].stance && g.legs[k].kind === 'req') ? 'air' : null;
        const res = oup(...a);
        const landed = ['F', 'B'].some((k) => g.legs[k].kind === 'req' && g.legs[k].stance && g.legs[k].tLand === 0); // 이번 스텝에 부탁한 걸음으로 딛음
        if (r0 && !g.req && !landed) {
          const why = r0.age > 1 ? 'expired' : ph0 === 'air' ? 'air' : 'wait';
          lost[why] = (lost[why] || 0) + 1;
        }
        return res;
      };
      const orq = g.requestStep.bind(g);
      g.requestStep = (o) => {
        asked++;
        const ok = orq(o);
        if (ok) {
          // 한 번 받은 부탁 = 걸음 하나. 아직 딛지 못한 앞 부탁은 딛지 못한 채로 남긴다 (새 부탁이 덮어썼다)
          const fw = f.forward(new THREE.Vector3());
          const pv = f.bodies.pelvis.linvel();
          live.push({ seed, who: f.name, f, t: G.t, kind: o.kind, fwd: o.fwd, dur: o.duration ?? 0.4, fw, vReq: r2(pv.x * fw.x + pv.z * fw.z), levReq: r2(g.lev), tiltReq: r1(f.tiltDeg()), offReq: r2(f.offBalance), swingReq: ['F', 'B'].map((k) => (g.legs[k].stance ? '' : g.legs[k].kind + k)).join('') || null, stanceReq: r3(Math.abs((g.legs.F.plant.x - g.legs.B.plant.x) * fw.x + (g.legs.F.plant.z - g.legs.B.plant.z) * fw.z)), s0: { F: f.solePoint('footF', new THREE.Vector3()), B: f.solePoint('footB', new THREE.Vector3()) }, com0: f.com.clone(), lead: g.frontLeg(fw), tTD: null, done: false });
        }
        return ok;
      };
      // AITRACE=1: 기술 걸음으로 딛은 발을 곧 붙잡기 걸음으로 다시 들 때, 그 까닭(엉덩이에서 먼 거리 / 발바닥 높이 / 실린 무게)을 남긴다
      if (process.env.AITRACE) {
        const ob = g.begin.bind(g);
        g.begin = (l, kind, T) => {
          const r = kind === 'catch' || kind === 'settle' ? live.findLast((x) => x.f === f && !x.ctl && x.tTD != null && x.foot === l.k && G.t - x.tTD < 0.6) : null;
          if (r && !r.why2) r.why2 = { kind, age: r3(G.t - r.tTD), reach: r3(Math.hypot(l.hip.x - l.plant.x, l.hip.z - l.plant.z)), soleY: r3(l.soleY), toeY: r3(l.toeY), N: r2((l.N || 0) / g.Mg), lev: r2(g.lev), h: r3(g.h), py: r3(f.bodies.pelvis.translation().y), mv: r2(f.move.y), walking: g.walking };
          return ob(l, kind, T);
        };
      }
      const otd = g.touchdown.bind(g);
      g.touchdown = (l, sp) => {
        const kind = l.kind;
        // 앞 기술 걸음 뒤 이 싸움꾼이 처음 딛는 걸음의 종류·발 (다시 딛기 까닭 보기)
        const prev = live.findLast((x) => x.f === f && !x.ctl && x.tTD != null && x.next == null);
        if (prev) prev.next = `${kind}${l.k}@${r3(G.t - prev.tTD)}`;
        let r = kind === 'req' ? live.findLast((x) => x.f === f && x.tTD == null) : null;
        const out = otd(l, sp);
        // 견줄 거리: 같은 싸움의 다른 걸음(걷기·자세 고치기·붙잡기)도 같은 잣대로 잰다
        if (!r && kind !== 'req') live.push((r = { ctl: kind, seed, who: f.name, f, t: G.t, done: false }));
        if (r) {
          r.tTD = G.t;
          r.foot = l.k;
          if (!r.ctl) r.stanceTD = r3(Math.abs((g.legs.F.plant.x - g.legs.B.plant.x) * r.fw.x + (g.legs.F.plant.z - g.legs.B.plant.z) * r.fw.z));
          r.sTD = f.solePoint(l.k === 'F' ? 'footF' : 'footB', new THREE.Vector3());
          if (!r.ctl) {
            r.moved = along(r.sTD, r.s0[l.k], r.fw);
            r.comTD = f.com.clone().sub(r.com0).dot(r.fw);
            // 딛을 때 발바닥 높이(m, 땅에 닿지 못한 채 딛은 것으로 쳐졌나)와 엉덩이에서 발까지 수평 거리(m), 골반 높이
            const L = g.legs[l.k];
            r.soleTD = r3(L.soleY);
            r.reachTD = r3(Math.hypot(L.hip.x - L.ankle.x, L.hip.z - L.ankle.z));
            r.pyTD = r3(f.bodies.pelvis.translation().y);
          }
          r.pin = { C: g.legs[l.k].pinC.clone(), T: g.legs[l.k].pinT.clone() };
          r.pinL = null; // 발에 몸무게 0.1 W 넘게 처음 실린 때의 자리 (G2 와 같은 잣대: 실린 동안만 잰다)
          r.driftL = 0;
          r.drift = 0;
          r.other = false; // 다른 발이 먼저 떴다 (보통 걷기로 넘어감)
          r.restep = false;
          r.lifted = false;
        }
        return out;
      };
    };
    const TW = process.env.AITRACE_T ? process.env.AITRACE_T.split(':') : null; // <판>:<P|E>:<시작초>:<끝초> 그 싸움꾼 상태를 0.025초마다 찍는다
    const res = aiFight(seed, 40, {
      onStep: (G) => {
        if (!hooked) {
          hooked = true;
          for (const f of [G.player, G.enemy]) hook(G, f);
        }
        if (TW && +TW[0] === seed && G.t >= +TW[2] && G.t <= +TW[3] && Math.round(G.t / DT) % 3 === 0) {
          const f = TW[1] === 'P' ? G.player : G.enemy;
          const g = f.gait;
          const ai = [G.ai, G.ai2].find((x) => x?.me === f);
          const legs = ['F', 'B'].map((k) => { const l = g.legs[k]; return `${k}:${l.stance ? 'st' : 'sw'}/${l.kind}/N${r2((l.N || 0) / g.Mg)}/sole${r3(l.soleY)}/heel${r2(l.heel || 0)}`; }).join(' '); // prettier-ignore
          console.log(`t=${r3(G.t)} ${f.state} ${ai?.mode}/${ai?.phase} mv=${r2(f.move.x)},${r2(f.move.y)} lev=${r2(g.lev)} levC=${r2(g.levC)} off=${r2(f.offBalance)} tilt=${r1(f.tiltDeg())} py=${r3(f.bodies.pelvis.translation().y)} h=${r3(g.h)} d=${r2(f.foeDistance())} ${legs}`);
        }
        for (const r of live) {
          if (r.done) continue;
          const f = r.f;
          if (r.tTD == null) {
            if (G.t - r.t > 1.2 || f.state !== 'stand') r.done = true; // 기술 걸음으로 딛지 못했다
            continue;
          }
          const age = G.t - r.tTD;
          if (age > 0.5 || f.state !== 'stand') {
            r.done = true;
            continue;
          }
          const g = f.gait;
          const o = r.foot === 'F' ? 'B' : 'F';
          if (!g.legs[o].stance && !r.lifted) r.other = true;
          if (!g.legs[r.foot].stance) {
            if (!r.lifted) {
              r.restep = !r.other;
              // 같은 발이 다시 뜬 때: 딛은 뒤 시간, 걸음 종류, 조이스틱, AI 모드 (감독 합격선: 0.3초 안에 같은 발이 다시 뜸 = 더듬기)
              if (r.restep) {
                const ai = [G.ai, G.ai2].find((x) => x?.me === f);
                r.lift = { age: r3(age), kind: g.legs[r.foot].kind, mv: r2(f.move.y), side: r2(f.move.x), mode: ai ? `${ai.mode}${ai.mode === 'attack' ? '/' + ai.phase : ''}` : '?' };
              }
            }
            r.lifted = true;
          }
          // 내디딘 발에 실린 몸무게 (딛은 뒤 0.1~0.3초 평균, W. 다시 뜨면 0으로 친다)
          if (!r.ctl && age >= 0.1 && age <= 0.3) {
            r.loadS = (r.loadS || 0) + (r.lifted ? 0 : (g.legs[r.foot].N || 0) / g.Mg);
            r.loadN = (r.loadN || 0) + 1;
          }
          if (process.env.AITRACE && !r.ctl && !r.lifted && Math.round(age / DT) % 6 === 0) {
            const L = g.legs[r.foot];
            (r.tl ||= []).push(`${r3(age)} mv${r2(f.move.y)} ${g.walking ? 'W' : 's'} N${r2((L.N || 0) / g.Mg)} sole${r3(L.soleY)} py${r3(f.bodies.pelvis.translation().y)}/h${r3(g.h)} com${r3(f.com.clone().sub(r.com0).dot(r.fw))}`);
          }
          if (!r.lifted) {
            r.drift = Math.max(r.drift, pinSlip(f, r.foot, r.pin));
            const L = g.legs[r.foot];
            if ((L.N || 0) > 0.1 * g.Mg) {
              if (!r.pinL) r.pinL = { C: L.pinC.clone(), T: L.pinT.clone() };
              r.driftL = Math.max(r.driftL, pinSlip(f, r.foot, r.pinL));
            }
          }
          // 이 걸음 동안 내가 상처를 냈으면: 그때 내디딘 발이 딛고 몸무게를 받고 있었나 (칼 뒤에 몸무게)
          if (!r.ctl && r.woundLoad == null) {
            const w = (G.woundsAI || []).find((x) => x.att === f && x.t >= r.tTD - 0.3 && x.t <= G.t);
            if (w) r.woundLoad = g.legs[r.foot].stance && !r.lifted ? r2((g.legs[r.foot].Nf || 0) / g.Mg) : -1; // (발바닥 정지 마찰이 쓰는 걸러진 무게)
          }
          // 부딪힘: 이 걸음 동안 칼끼리 부딪히거나 맞았다
          if (!r.bump) r.bump = G.clashT.some((c) => c.t >= r.tTD - 0.2 && c.t <= G.t) || (G.woundsAI || []).some((w) => w.vic === f && w.t >= r.tTD - 0.2 && w.t <= G.t);
        }
      },
    });
    for (const r of live) r.kd = r.f.kdLog.some((k) => k.t >= r.t && k.t <= r.t + 1.5); // 부탁 뒤 1.5초 안에 넘어짐
    recs.push(...live.filter((r) => !r.ctl));
    ctls.push(...live.filter((r) => r.ctl));
    strikes += res.recs.length;
    kd += res.kd;
    secs += res.tEnd;
  }
  const got = recs.filter((r) => r.tTD != null);
  const dr = got.map((r) => r.drift * 100);
  out.accepted = recs.length;
  out.askedCalls = asked; // AI 는 받아 줄 때까지 프레임마다 다시 부탁한다 → 부른 횟수는 부탁 수보다 많다
  out.strikes = strikes;
  out.acceptPerStrike = r2(recs.length / Math.max(1, strikes));
  out.landedAsReq = `${got.length}/${recs.length}`;
  out.notLanded = lost; // 물러나 발을 들기 전에 그만둠(wait) · 든 발을 걷는 걸음으로 바꿔 딛음(air) · 1초 안에 못 시작(expired)
  out.kinds = recs.reduce((a, r) => ((a[`${r.kind}${r.fwd}`] = (a[`${r.kind}${r.fwd}`] || 0) + 1), a), {});
  out.footIsLead_pct = pct(got.filter((r) => (r.kind === 'lunge') === (r.foot === r.lead)).length, got.length);
  out.moved_m = { med: r3(med(got.map((r) => r.moved))), p10: r3(q(got.map((r) => r.moved), 0.1)), p90: r3(q(got.map((r) => r.moved), 0.9)) };
  out.comAtTD_m = { med: r3(med(got.map((r) => r.comTD))), p10: r3(q(got.map((r) => r.comTD), 0.1)), p90: r3(q(got.map((r) => r.comTD), 0.9)) };
  out.tdT_s = r3(med(got.map((r) => r.tTD - r.t)));
  out.driftCm = { med: r2(med(dr)), p99: r2(q(dr, 0.99)), max: r2(Math.max(...dr)), over3_pct: pct(dr.filter((x) => x > 3).length, dr.length) };
  const drL = got.map((r) => r.driftL * 100);
  out.driftLoadedCm = { med: r2(med(drL)), p99: r2(q(drL, 0.99)), max: r2(Math.max(...drL)), over3_pct: pct(drL.filter((x) => x > 3).length, drL.length) };
  const calm = got.filter((r) => !r.bump);
  out.driftCalmCm = { n: calm.length, p99: r2(q(calm.map((r) => r.drift * 100), 0.99)), over3_pct: pct(calm.filter((r) => r.drift > 0.03).length, calm.length), loadedOver3_pct: pct(calm.filter((r) => r.driftL > 0.03).length, calm.length) };
  // 견줄 거리: 같은 싸움의 보통 걸음
  out.control = {};
  for (const k of ['walk', 'settle', 'catch']) {
    const c = ctls.filter((r) => r.ctl === k && r.done);
    if (!c.length) continue;
    const d = c.map((r) => r.drift * 100);
    out.control[k] = { n: c.length, med: r2(med(d)), p99: r2(q(d, 0.99)), over3_pct: pct(d.filter((x) => x > 3).length, d.length), loadedOver3_pct: pct(c.filter((r) => r.driftL > 0.03).length, c.length) };
  }
  out.restep_pct = pct(got.filter((r) => r.restep).length, got.length); // 같은 발이 다른 발보다 먼저 0.5초 안에 뜸 (걷기 차례 포함)
  // 다시 딛기 (좁은 뜻): 그 다음 걸음이 같은 발의 붙잡기·자세 고치기 걸음 = 딛은 자리가 나빠 고쳐 딛었다
  out.restepFix_pct = pct(got.filter((r) => r.restep && /^(catch|settle)/.test(r.next || '')).length, got.length);
  // 더듬기 (감독 합격선, R1 고침부터): 기술 걸음으로 딛은 발이 0.3초 안에 (다른 발보다 먼저) 다시 뜸. ≤ 5%
  const stut = got.filter((r) => r.restep && r.lift && r.lift.age < 0.3);
  out.stutter_pct = pct(stut.length, got.length);
  out.stutterBy = stut.reduce((a, r) => ((a[`${r.lift.kind}|${r.lift.mode}|mv${r.lift.mv < -0.1 ? '<0' : r.lift.mv > 0.1 ? '>0' : '0'}`] = (a[`${r.lift.kind}|${r.lift.mode}|mv${r.lift.mv < -0.1 ? '<0' : r.lift.mv > 0.1 ? '>0' : '0'}`] || 0) + 1), a), {});
  out.stutterCalm_pct = pct(stut.filter((r) => !r.bump && !r.kd).length, got.filter((r) => !r.bump && !r.kd).length); // 부딪힘·넘어짐 없는 걸음만
  // 같은 발이 다시 뜬 때 (딛은 뒤 초) 나눔: 0.3초 안 / 0.3~0.5초
  const la = got.filter((r) => r.lift).map((r) => r.lift.age);
  out.sameFootLift = { n: la.length, lt0_3: la.filter((a) => a < 0.3).length, med: r3(med(la)), p10: r3(q(la, 0.1)) };
  // 딛은 뒤 0.1~0.3초 동안 내디딘 발에 실린 몸무게 평균 (W): 가운데, 10%, 0.3 W 넘게 실린 비율
  const lm = got.filter((r) => r.loadN).map((r) => r.loadS / r.loadN);
  out.lungeLoad = { med: r2(med(lm)), p10: r2(q(lm, 0.1)), over0_3_pct: pct(lm.filter((x) => x > 0.3).length, lm.length) };
  // 내딛는 동안 낸 상처: 그때 내디딘 발이 딛고 있었나 (-1 = 이미 다시 뜸), 실린 몸무게
  const wl = got.filter((r) => r.woundLoad != null).map((r) => r.woundLoad);
  out.woundWhileLunge = { n: wl.length, planted_pct: pct(wl.filter((x) => x >= 0).length, wl.length), loadMed: r2(med(wl.filter((x) => x >= 0))) };
  // 땅에 닿지 못한 채 딛은 것으로 쳐진 걸음 (딛을 때 발바닥이 2 cm 넘게 떠 있음): 그 뒤 붙잡기 걸음·끌림의 까닭
  out.airLanding_pct = pct(got.filter((r) => r.soleTD > 0.02).length, got.length);
  out.kdAfter_pct = pct(recs.filter((r) => r.kd).length, recs.length);
  out.kdPerFight = r2(kd / N);
  out.fightSecs = r1(secs);
  if (process.env.AITRACE) for (const r of got.filter((r) => r.restep && /^(catch|settle)/.test(r.next || '')).slice(0, 12)) console.log(`다시 딛기 ${r.who} ${r.next} 까닭 ${JSON.stringify(r.why2)}\n   ${(r.tl || []).join(' | ')}`);
  out.recs = recs.map(({ f, fw, s0, com0, sTD, pin, pinL, ...r }) => ({ ...r, moved: r3(r.moved), comTD: r3(r.comTD), drift: r3(r.drift), driftL: r3(r.driftL), t: r3(r.t), tTD: r3(r.tTD) }));
  for (const k of ['accepted', 'askedCalls', 'strikes', 'acceptPerStrike', 'landedAsReq', 'notLanded', 'kinds', 'footIsLead_pct', 'moved_m', 'comAtTD_m', 'tdT_s', 'driftCm', 'driftLoadedCm', 'driftCalmCm', 'control', 'restep_pct', 'restepFix_pct', 'stutter_pct', 'stutterBy', 'stutterCalm_pct', 'sameFootLift', 'lungeLoad', 'woundWhileLunge', 'airLanding_pct', 'kdAfter_pct', 'kdPerFight', 'fightSecs']) line(k, out[k]);
}

if (SUB === 'tapstep') {
  const N = NARG ?? 4;
  const rows = [];
  for (const gap of [1.6, 1.9, 2.2])
    for (let k = 0; k < N; k++) {
      const G = stage({ gap, seed: 300 + k * 11, immortal: true });
      const P = G.player;
      G.run(1.5 + k * 0.07);
      const fw = P.forward(new THREE.Vector3());
      const s0 = { F: P.solePoint('footF', new THREE.Vector3()), B: P.solePoint('footB', new THREE.Vector3()) };
      const com0 = P.com.clone();
      const lead = P.gait?.frontLeg(fw);
      const r = { gap, k, lead, foot: null, moved: null, comTD: null, drift: 0, tdT: null };
      const ot = P.gait?.onTouchdown;
      if (P.gait)
        P.gait.onTouchdown = (foot, st, kind) => {
          if (r.foot == null && kind === 'lunge') {
            r.foot = foot;
            r.sTD = P.solePoint(foot === 'F' ? 'footF' : 'footB', new THREE.Vector3());
            r.moved = (r.sTD.x - s0[foot].x) * fw.x + (r.sTD.z - s0[foot].z) * fw.z;
            r.comTD = P.com.clone().sub(com0).dot(fw);
            r.tdT = G.t - t0;
            r.pin = { C: P.gait.legs[foot].pinC.clone(), T: P.gait.legs[foot].pinT.clone() };
          }
          return ot(foot, st, kind);
        };
      const t0 = G.t;
      P.skill.thrust();
      let lifted = false;
      G.run(1.2, () => {
        if (r.foot == null || lifted || G.t - t0 - r.tdT > 0.5) return;
        if (!P.gait.legs[r.foot].stance) return void (lifted = true);
        r.drift = Math.max(r.drift, pinSlip(P, r.foot, r.pin));
      });
      r.com12 = P.com.clone().sub(com0).dot(fw);
      r.kd = P.kdLog.length;
      delete r.sTD;
      delete r.pin;
      rows.push(r);
      line(`gap ${gap} #${k}`, { lead, foot: r.foot, moved: r3(r.moved), comTD: r3(r.comTD), com12: r3(r.com12), driftCm: r2(100 * r.drift), tdT: r3(r.tdT), kd: r.kd });
    }
  const got = rows.filter((r) => r.moved != null);
  out.rows = rows;
  out.summary = { n: rows.length, landed: got.length, leadFoot_pct: pct(got.filter((r) => r.foot === r.lead).length, got.length), moved_med: r3(med(got.map((r) => r.moved))), moved_min: r3(Math.min(...got.map((r) => r.moved))), moved_max: r3(Math.max(...got.map((r) => r.moved))), comTD_med: r3(med(got.map((r) => r.comTD))), com12_med: r3(med(rows.map((r) => r.com12))), driftMaxCm: r2(100 * Math.max(...got.map((r) => r.drift))), kd: rows.reduce((a, r) => a + r.kd, 0) };
  line('SUMMARY tapstep', out.summary);
}

if (SUB === 'hitstop') {
  // main.js 멈칫 규칙 그대로 (onWound·onClash): 상처 = 관통 min(0.06, E/2000) · 박힘/뼈/투구 min(0.1, E/900) · 그 밖 min(0.08, E/1200),
  //  칼끼리 vn > 6 이고 0.5초에 한 번 min(0.08, vn/200). 멈칫 동안 물리는 0.12배로 간다 → 벽시계 시간 중 멈칫 비율
  const N = NARG ?? 12;
  const stops = [];
  let stopReal = 0;
  let simT = 0;
  for (let seed = 1; seed <= N; seed++) {
    let hs = 0;
    let clashCd = 0;
    let clashStopCd = 0;
    let nW = 0;
    let nC = 0;
    const r = aiFight(300 + seed, 30, {
      onStep: (G) => {
        const W = G.woundsAI;
        for (; nW < W.length; nW++) {
          const w = W[nW];
          const e = w.E;
          const bone = e > 70 && (w.zone === 'head' || w.zone === 'arm' || w.zone === 'leg');
          const st = w.pass ? Math.min(0.06, e / 2000) : w.stuck || bone || w.helmet ? Math.min(0.1, e / 900) : Math.min(0.08, e / 1200);
          if (w.type !== 'blunt' && w.sev > 0) stops.push(st);
          hs = Math.max(hs, st);
        }
        for (; nC < G.clashT.length; nC++) {
          const c = G.clashT[nC];
          if (clashCd > 0 || c.vn < 2.5) continue;
          clashCd = 0.09;
          if (c.vn > 6 && clashStopCd <= 0) {
            hs = Math.max(hs, Math.min(0.08, c.vn / 200));
            clashStopCd = 0.5;
          }
        }
        clashCd -= DT;
        clashStopCd -= DT;
        // 이 물리 스텝이 차지한 벽시계 시간: 멈칫 중이면 DT / 0.12
        if (hs > 0) {
          const real = DT / 0.12;
          stopReal += Math.min(hs, real);
          hs -= real;
        }
      },
    });
    simT += r.tEnd;
  }
  const realT = simT + stopReal * (1 - 0.12);
  out.openedWounds = stops.length;
  out.stopMed_ms = r0(med(stops) * 1000);
  out.stopP90_ms = r0(q(stops, 0.9) * 1000);
  out.stopTotal_pct = r2((100 * stopReal) / realT);
  line('멈칫 가운데값 (ms)', out.stopMed_ms);
  line('멈칫 총량 (%)', out.stopTotal_pct);
}

/** 스크립트 플레이어(결심 베기만 / 팔 베기만) 대 보통 AI 한 판 */
function duelFight(seed, policy, secs = 30) {
  const G = stage({ walls: true, gap: CONFIG.ARENA.startGap, seed, foeAI: true });
  const P = G.player;
  const E = G.enemy;
  const rnd = rng(seed * 31 + (policy === 'commit' ? 1 : 2));
  let next = 1.0 + rnd();
  const att = [];
  let cur = null;
  const fams = ['diagR', 'vert', 'horizR', 'diagL', 'riseR'];
  let standT = 0;
  for (let i = 0; i < secs / DT; i++) {
    const d = P.foeDistance();
    if (P.state === 'stand') standT += DT;
    if (!cur) G.pump.stick = { x: 0, y: d > 2.0 ? 0.8 : d < 1.35 ? -0.6 : 0 };
    if (!cur && G.t > next && d < 2.1 && P.state === 'stand' && !G.pump.queue.length) {
      const fam = fams[Math.floor(rnd() * fams.length)];
      const F = FAM[fam];
      G.pump.stick = { x: 0, y: 0 };
      const off = [P.handOffset.x, P.handOffset.y];
      if (policy === 'commit') {
        feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 2.5, { hold: 100, lift: false }), 60);
        cur = { fam, tr: feedTrace(G, stroke(F.end[0] - F.ch[0], F.end[1] - F.ch[1], 12, { down: false }), 60) };
      } else {
        const dx = F.end[0] - F.ch[0];
        const dy = F.end[1] - F.ch[1];
        const L = Math.hypot(dx, dy);
        cur = { fam, tr: feedTrace(G, stroke((dx / L) * 0.35, (dy / L) * 0.35, 5), 60) };
      }
    }
    G.step();
    if (cur && cur.tr.done) {
      cur.t0 = cur.tr.t0;
      cur.t1 = cur.tr.t1;
      att.push(cur);
      cur = null;
      next = G.t + 0.8 + rnd() * 0.8;
    }
    if (!P.alive || !E.alive) break;
  }
  const W = G.woundsR;
  const rows = att.map((a) => {
    const mine = W.filter((w) => w.att === P && w.t >= a.t0 && w.t <= a.t0 + 0.8);
    const got = W.filter((w) => w.vic === P && w.t >= a.t1 && w.t <= a.t1 + 1.0);
    return { fam: a.fam, E: mine.reduce((s, w) => s + w.E, 0), hit: mine.length > 0, gotHit: got.length > 0 };
  });
  return { rows, kd: P.kdLog, standMin: standT / 60, dead: !P.alive ? 'P' : !E.alive ? 'E' : null };
}

if (SUB === 'duel') {
  const N = NARG ?? 20;
  const res = {};
  for (const policy of ['commit', 'arm']) {
    const rows = [];
    const kds = [];
    let standMin = 0;
    const deaths = { P: 0, E: 0 };
    for (let seed = 1; seed <= N; seed++) {
      const r = duelFight(seed, policy);
      rows.push(...r.rows);
      kds.push(...r.kd);
      standMin += r.standMin;
      if (r.dead) deaths[r.dead]++;
    }
    const causes = {};
    for (const k of kds) causes[k.c] = (causes[k.c] || 0) + 1;
    res[policy] = { attempts: rows.length, E_perAttempt: r1(mean(rows.map((r) => r.E))), hit_pct: pct(rows.filter((r) => r.hit).length, rows.length), gotHit1s_pct: pct(rows.filter((r) => r.gotHit).length, rows.length), kdPerMin: r2(kds.length / Math.max(1e-6, standMin)), kdCauses: causes, deaths };
    line(policy === 'commit' ? '결심 베기만' : '팔 베기만', res[policy]);
  }
  res.commitOverArm_E = r2(res.commit.E_perAttempt / res.arm.E_perAttempt);
  res.commitOverArm_gotHit = r2(res.commit.gotHit1s_pct / Math.max(1e-6, res.arm.gotHit1s_pct));
  line('결심/팔 (에너지, 맞은 비율)', [res.commitOverArm_E, res.commitOverArm_gotHit]);
  out.res = res;
}

if (SUB === 'defend') {
  // 스크립트 방어자: AI 가 치기 시작하고(strike) 250 ms 뒤, 100 ms 동안 막는 자리로 긋는다 (0.4초 버티고 뗀다)
  //  막는 자리: AI 칼이 오는 쪽 (AI 의 준비 자세가 AI 칼 든 쪽이면 내 왼쪽). 올려베기면 낮게, 곧게 내려베기면 머리 위
  const N = NARG ?? 20;
  const res = {};
  for (const difficulty of ['easy', 'normal', 'hard']) {
    let blocked = 0;
    let hit = 0;
    let none = 0;
    for (let seed = 1; seed <= N; seed++) {
      const G = stage({ walls: true, gap: 2.4, seed: 500 + seed, foeAI: true, difficulty, immortalP: true });
      const P = G.player;
      let prevPhase = null;
      const pend = [];
      const strikes = [];
      for (let i = 0; i < 30 / DT; i++) {
        const d = P.foeDistance();
        G.pump.stick = { x: 0, y: d > 2.3 ? 0.6 : d < 1.5 ? -0.6 : 0 };
        const ph = G.ai.mode === 'attack' ? G.ai.phase : null;
        if (ph === 'strike' && prevPhase !== 'strike' && P.state === 'stand') {
          const t = G.ai.tech;
          strikes.push({ t: G.t, from: t.from });
          pend.push({ t: G.t + 0.25, from: t.from });
        }
        prevPhase = ph;
        if (pend.length && G.t >= pend[0].t) {
          const p = pend.shift();
          const [fx, fy] = p.from;
          const tgt = fy < -0.2 ? [fx > 0 ? -0.35 : 0.35, -0.35] : Math.abs(fx) < 0.12 && fy > 0.3 ? [0.05, 0.45] : [fx > 0 ? -0.25 : 0.3, 0.3];
          const off = [P.handOffset.x, P.handOffset.y];
          const L = Math.hypot(tgt[0] - off[0], tgt[1] - off[1]);
          if (L > 0.02 && !G.pump.queue.length) feedTrace(G, stroke(tgt[0] - off[0], tgt[1] - off[1], L / 0.1, { hold: 400 }), 60);
        }
        G.step();
        if (!G.enemy.alive) break;
      }
      for (const s of strikes) {
        const w = G.woundsR.find((x) => x.vic === P && x.t >= s.t && x.t <= s.t + 0.8);
        const c = G.clashT.find((x) => x.t >= s.t && x.t <= s.t + 0.8);
        if (w) hit++;
        else if (c) blocked++;
        else none++;
      }
    }
    res[difficulty] = { strikes: blocked + hit + none, blocked, hit, none, blocked_pct: pct(blocked, blocked + hit) };
    line(difficulty, res[difficulty]);
  }
  out.res = res;
}

if (SUB === 'feedcheck') {
  // 같은 궤적을 두 번 넣으면 handOffset(과 걸러진 손 목표) 흐름이 바이트까지 같은가
  const res = {};
  for (const hz of [60, 90, 120]) {
    const runOnce = () => {
      const G = stage({ gap: 2.0, seed: 7, hz, immortal: true });
      const P = G.player;
      G.run(1.0);
      feedTrace(G, strokes([[0.25, 0.7], [-0.82, -0.84]], 9, { pause: 120 }), hz);
      const h = [];
      G.run(1.0, () => h.push(P.handOffset.x, P.handOffset.y, P.skill.aim.x, P.skill.aim.y));
      const ft = G.pump.input.fingerTrace;
      return { h: Buffer.from(new Float64Array(h).buffer).toString('base64'), pieces: ft.total };
    };
    const a = runOnce();
    const b = runOnce();
    res[hz] = { identical: a.h === b.h, pieces: a.pieces };
    line(`${hz} Hz`, res[hz]);
  }
  out.res = res;
}

if (out.rows || out.res || Object.keys(out).length > 3) save(SUB, out);
else console.log('모르는 부분:', SUB, '(support cuts detect react combo sweep trunkoff strength power stand miss block react_body ai duel defend hitstop feedcheck)');
