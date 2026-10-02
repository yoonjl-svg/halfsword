#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
//  support_measure.mjs — 보이지 않는 받침 재기 (읽기만 한다)
//
//   node support_measure.mjs --root=<트리> --scenes=<idle,walk,cuts,shove,hit,getup|all> [--set=GROUP.key=value,...]
//        [--seed=N] [--out=<폴더>] [--quick] [--proof] [--json]
//   라이브러리: import { measure, loadGame, SCENE_NAMES, summarise } from './support_measure.mjs'
//     measure({ root, scenes, set, seed, out, quick, proof }) → { meta, scenes: {...}, proof }
//     (설정은 프로세스마다 한 번: 다른 --set 은 새 node 프로세스로. loadGame 이 두 번째 root/set 을 거절한다)
//
//  게임은 --root 에서 동적 import (sim 도구처럼 tools/sim/harness_m.mjs newRound). --set 은 with_config.mjs 와 똑같이
//  (true/false → 참·거짓, 숫자 → 수, 나머지 글자 그대로) 아무것도 만들기 전에 CONFIG 에 넣는다.
//
//  스텝 고리: harness_m G.step 을 줄 그대로 옮긴 stepWith() 에 세 곳만 끼운다 (다 읽기만):
//    pre  = G.before 뒤, 싸움꾼 step 앞 : 붙잡기 sag·tilt 경사 (G.h·hNom·anchorUp 이 그 스텝 G.update 가 읽을 값), prevU·gaitWeight·stanceDrop
//    mid  = 두 싸움꾼 step 뒤, world.step 앞 : fy 다시 계산 (driveBalance 와 같은 입력, 같은 식), offBalance 경사, 기준 막대 회전력,
//           딛은 다리 엉덩이·무릎 스프링 회전력 (driveJoints 와 같은 식), gait legs.N, 골반 userForce (fy 대조)
//    post = world.step·combat.afterStep 뒤 : 땅 접촉 (Rapier contactPair: 싸움꾼 콜라이더 × 고정 물체, 법선 충격량 / dt), 골반 높이, 상태 (넘어짐)
//  몸·관절·콜라이더·게임 상태에 쓰지 않는다. 증명 (--proof): 같은 장면을 stock (harness G.step) · off (stepWith, 표본 없음) · on (표본)
//  세 번 돌려 스텝마다 두 싸움꾼 골반·칼끝 위치 (float64) sha256 이 셋 다 같아야 한다.
//  장면 입력은 하니스 몫뿐: 손 패드·스틱·move (main.js / live_battery / down_hits / shove_check 와 같은 길), AI 멈춤,
//  getup 장면의 밀기 충격량 (down_hits 의 넘어뜨리기 밀기와 같은 꼴, knockDown 은 부르지 않는다 — 넘어짐은 게임 판정).
//  자르기·한도·바닥 없음.
// ─────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

export const SCENE_NAMES = ['idle', 'walk', 'cuts', 'shove', 'hit', 'getup'];
const R2D = 180 / Math.PI;

// ───────── 설정 (with_config.mjs 그대로) ─────────
export function parseSets(str) {
  if (!str) return [];
  return String(str).split(',').map((s) => s.trim()).filter(Boolean);
}
export function applySets(CONFIG, sets) {
  for (const s of sets) {
    if (!/^[A-Z_]+\.[A-Za-z0-9_]+=/.test(s)) throw new Error(`--set 꼴이 아님: ${s}`);
    const [path, v] = s.split('=');
    const [grp, key] = path.split('.');
    CONFIG[grp][key] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}

let GAME = null;
export async function loadGame(root, sets = []) {
  const R = realpathSync(resolve(root));
  const key = R + '|' + sets.join(',');
  if (GAME) {
    if (GAME.key !== key) throw new Error('한 프로세스에 설정 하나 (다른 root/set 은 새 프로세스로)');
    return GAME;
  }
  const CONFIG = await import(pathToFileURL(join(R, 'src/config.js')).href);
  applySets(CONFIG, sets);
  const H = await import(pathToFileURL(join(R, 'tools/sim/harness_m.mjs')).href);
  const LK = await import(pathToFileURL(join(R, 'src/looks.js')).href);
  GAME = { key, root: R, sets, CONFIG, H, THREE: H.THREE, DT: H.DT, getLook: LK.getLook };
  return GAME;
}

// ───────── 작은 셈 ─────────
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const pct = (a, p) => {
  if (!a.length) return null;
  const b = Float64Array.from(a).sort();
  return b[Math.min(b.length - 1, Math.floor(p * b.length))];
};
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const stat = (a) => ({ mean: r3(mean(a)), p10: r3(pct(a, 0.1)), p50: r3(pct(a, 0.5)), p90: r3(pct(a, 0.9)), n: a.length });

function rotVec(q) {
  // fighter.js toRotVec 와 같은 식
  const w = Math.min(1, Math.abs(q.w));
  const sgn = q.w < 0 ? -1 : 1;
  const s = Math.sqrt(1 - w * w);
  if (s < 1e-6) return [0, 0, 0];
  const a = 2 * Math.acos(w);
  return [(q.x * sgn * a) / s, (q.y * sgn * a) / s, (q.z * sgn * a) / s];
}

const PART_GROUP = (n) => (n === 'footF' || n === 'footB' ? n : n.startsWith('shin') ? 'shin' : n.startsWith('thigh') ? 'thigh' : n.startsWith('farm') ? 'hand' : n.startsWith('uarm') ? 'uarm' : n === 'pelvis' || n === 'abdomen' ? 'pelvis' : n === 'chest' ? 'chest' : n === 'head' ? 'head' : 'other');
const OTHER_GROUPS = ['shin', 'thigh', 'hand', 'uarm', 'pelvis', 'chest', 'head', 'sword', 'other'];
const STATE_CODE = { stand: 0, down: 1, getup: 2, kneel: 3, dead: 4 };

// Rapier 0.19 contactImpulse 는 쉬는 접촉에서 (n + 1) / n 배로 나온다 (n = numSolverIterations; 상자 시험 n = 1, 2, 3, 4, 6, 12 →
//  2.000, 1.500, 1.333, 1.250, 1.167, 1.083, 출렁이는 짐에서도 평균 1.1675). 힘으로 쓸 땐 n / (n + 1) 을 곱한다.
//  게임 gait groundForce (legs.N, Nsum, pinFeet 한도) 는 고치지 않은 값을 쓴다 → 아래 gaitCmp 는 고치지 않은 값끼리 견준다.
export const contactCal = (W) => {
  const n = W.integrationParameters?.numSolverIterations ?? 4;
  return n / (n + 1);
};

// ───────── 관찰자 (읽기만) ─────────
class Obs {
  constructor(G) {
    this.G = G;
    const { CONFIG, THREE } = GAME;
    this.C = CONFIG;
    this.T = THREE;
    this.fs = [G.player, G.enemy].map((f) => ({ f, rows: [], pre: null, cur: null, prevState: f.state, prevFootTot: null, falls: [] }));
    this._q1 = new THREE.Quaternion();
    this._q2 = new THREE.Quaternion();
    this._q3 = new THREE.Quaternion();
  }
  colliders(f) {
    // 콜라이더 목록 (스텝마다 새로: 칼 떨굼·투구 벗겨짐에 따라 바뀐다). 읽기만
    const out = [];
    for (const [name, rb] of Object.entries(f.bodies)) {
      const n = rb.numColliders ? rb.numColliders() : 0;
      for (let i = 0; i < n; i++) out.push({ col: rb.collider(i), g: PART_GROUP(name) });
    }
    if (f.armed !== false) for (const c of f.swordColliders || []) out.push({ col: c, g: 'sword' });
    return out;
  }
  pre() {
    const { C } = this;
    for (const s of this.fs) {
      const f = s.f;
      const G = f.gait;
      const p = f.bodies.pelvis.translation();
      let rSag = 0, rTilt = 0, tilt = f.tiltDeg();
      if (G) {
        // gait.update 의 sag: enter() 가 먼저 불리면 h = 지금 골반 높이
        const h = G.active ? G.h : p.y;
        const sag = Math.max(h, G.hNom - 0.04) - p.y;
        rSag = clamp((sag - C.GAIT.catchSag) / 0.08, 0, 1);
        rTilt = clamp((tilt - C.GAIT.catchTilt) / 20, 0, 1);
      }
      s.pre = { prevU: { thighF: f.prevU?.thighF, thighB: f.prevU?.thighB }, gaitWeight: f.gaitWeight, stanceDrop: f.stanceDrop, rSag, rTilt, tilt, levC0: G ? G.levC : 0 };
    }
  }
  mid() {
    const { C, T } = this;
    const { BODY, GAIT, BALANCE } = C;
    const dt = GAME.DT;
    for (const s of this.fs) {
      const f = s.f;
      const pr = s.pre;
      const G = f.gait;
      const M = f.totalMass;
      const Mg = M * 9.81;
      const mus = f.muscle;
      const pel = f.bodies.pelvis;
      const p = pel.translation();
      const v = pel.linvel();
      const hybrid = !!G && f.state === 'stand';
      const stanceOf = (k) => (hybrid ? (G.legs[k].stance ? 1 : 0.05) : pr.gaitWeight < 0.3 ? 1 : (pr.prevU['thigh' + k] ?? 0) < 0.6 ? 1 : 0.05);
      let lF = f.footLoad.F * stanceOf('F');
      let lB = f.footLoad.B * stanceOf('B');
      const kn = f.kneelAmount;
      let kneelFloor = 0;
      if (kn > 0) {
        if (lF < 0.6 || lB < 0.6) kneelFloor = 1;
        lF = Math.max(lF, 0.6);
        lB = Math.max(lB, 0.6);
      }
      const loadSum = lF + lB;
      const r = { t: this.G.t + dt, st: STATE_CODE[f.state] ?? -1, hyb: hybrid ? 1 : 0, mus, kn, kneelFloor };
      // 1) 체중 받치기 fy (driveBalance 그대로 다시 계산)
      let share = null, fy = 0, a = 0, b = 0, c = 0, h = null, atCap = 0, atZero = 0, cut = 0;
      if (mus > 0.1 && loadSum > 0) {
        h = hybrid ? G.h : BODY.standHeight - (1 - f.legHealth) * 0.1 - pr.stanceDrop - f.crouch;
        share = hybrid ? G.supportShare(Mg) : BODY.support;
        a = Mg * share * mus;
        b = BODY.supportStiffness * (h - p.y) * mus;
        c = -BODY.supportDamping * v.y * mus;
        const Tot = a + b + c;
        const legPower = (lF * f.limbs.legF + lB * f.limbs.legB) / loadSum;
        const cap = Mg * (1.2 + 1.3 * legPower) * Math.min(1, loadSum * 1.5);
        fy = clamp(Tot, 0, cap);
        if (Tot > cap) atCap = 1;
        if (Tot < 0) atZero = 1;
        if (p.y > h + 0.25) (fy = 0), (cut = 1);
        const sc = Tot > 0 ? fy / Tot : 0;
        a *= sc;
        b *= sc;
        c *= sc;
      }
      r.share = share;
      r.fyMg = fy / Mg;
      r.fyShareMg = a / Mg;
      r.fySpringMg = b / Mg;
      r.fyDampMg = c / Mg;
      r.atCap = atCap;
      r.atZero = atZero;
      r.cut = cut;
      r.hT = h;
      // 골반 userForce 대조 (push 의 y 는 골반에만 간다)
      const uf = pel.userForce ? pel.userForce() : null;
      const cf = f.bodies.chest.userForce ? f.bodies.chest.userForce() : null;
      // 내딛는 다리의 swingPull (발 ↔ 골반, 몸 안 힘) 도 골반에 걸리므로 두 발 다 딛은 스텝 (또는 hybrid 아님) 만 견준다
      const noSwing = !hybrid || (G.legs.F.stance && G.legs.B.stance);
      r.ufyMg = uf && noSwing ? uf.y / Mg : null;
      // 걷기 밂 = push(fx, 0, fz) 의 가슴 몫 (upperShare) ÷ upperShare. 가슴에 거는 다른 힘은 shove() 발사 때뿐
      r.walkPushMg = cf ? Math.hypot(cf.x, cf.z) / BODY.upperShare / Mg : null;
      // 2) 붙잡기 반사 경사 셋 + lev
      r.levH = G ? G.levH : 0;
      r.levC = G ? G.levC : 0;
      r.lev = G ? G.lev : 0;
      r.rSag = pr.rSag;
      r.rTilt = pr.rTilt;
      r.rOff = clamp((f.offBalance - GAIT.catchOff) / 0.25, 0, 1);
      const mode = GAIT.catchMode ?? 'on';
      r.need = mode === 'off' ? 0 : mode === 'fall' ? r.rOff : Math.max(r.rSag, r.rTilt, r.rOff);
      r.offBal = f.offBalance;
      r.tilt = pr.tilt;
      // levC 다시 짓기 (오름 스텝만 대조: levC0 → (줄기 있었으면 줄인 뒤) → need 쪽으로 30/s)
      if (hybrid && G && r.levC > pr.levC0 + 1e-9) {
        const kk = Math.min(1, dt * 30);
        const c1 = pr.levC0 + (r.need - pr.levC0) * kk;
        const d0 = Math.max(0, pr.levC0 - dt / GAIT.handover);
        const c2 = d0 + (r.need - d0) * kk;
        r.levCErr = Math.min(Math.abs(c1 - r.levC), Math.abs(c2 - r.levC));
      } else r.levCErr = null;
      // 3) 기준 막대 (똑바로 서기) 회전력 ≈ k·assist·r·각 (축마다, 감쇠 몫 빼고)
      const hold = clamp(1 - f.offBalance / BALANCE.fallRange, 0.15, 1);
      const assist = BODY.uprightAssist * mus * hold * (0.3 + 0.7 * Math.min(1, loadSum));
      const nr = f.anchor.nextRotation ? f.anchor.nextRotation() : f.anchor.rotation();
      const qa = this._q1.set(nr.x, nr.y, nr.z, nr.w);
      const pq = pel.rotation();
      const qp = this._q2.set(pq.x, pq.y, pq.z, pq.w);
      const qr = this._q3.copy(qa).invert().multiply(qp);
      const ang = rotVec(qr);
      const tq = [0, 1, 2].map((i) => BODY.uprightStiffness * assist * f.uprightRelax(3 + i) * ang[i]);
      r.anchorT = Math.hypot(tq[0], tq[1], tq[2]);
      r.anchorTilt = Math.hypot(tq[0], tq[2]); // 기울기 축 (x 옆, z 앞뒤)
      r.anchorYaw = Math.abs(tq[1]);
      r.anchorK = BODY.uprightStiffness * assist;
      // 4) 딛은 다리 엉덩이·무릎·발목 스프링 회전력 (driveJoints 의 식, 근력 한도 j.max·mus 로 묶인 몫)
      const legsMus = Math.max(0.15, f.muscle);
      const J = f.jointByName;
      let hipT = 0, kneeT = 0, ankT = 0, hipU = 0, kneeU = 0, hipB = 0, kneeB = 0, nSt = 0;
      for (const k of ['F', 'B']) {
        const stance = hybrid ? G.legs[k].stance : false;
        if (!stance) continue;
        nSt++;
        for (const [jn, kind] of [['thigh' + k, 'hip'], ['shin' + k, 'knee'], ['foot' + k, 'ankle']]) {
          const j = J[jn];
          if (!j) continue;
          let m = legsMus * (0.6 + 0.4 * f.legHealth);
          m *= 0.4 + 0.6 * (k === 'F' ? f.limbs.legF : f.limbs.legB);
          const kk = j.k * m * (j.gain || 1);
          const maxErr = (j.max * m) / Math.max(1, kk);
          const rv = rotVec(new T.Quaternion().copy(j.restInv).multiply(j.target));
          const qpar = j.parent.rotation(), qch = j.child.rotation();
          const qcur = new T.Quaternion().copy(j.restInv).multiply(new T.Quaternion(qpar.x, qpar.y, qpar.z, qpar.w).invert().multiply(new T.Quaternion(qch.x, qch.y, qch.z, qch.w)));
          const cur = rotVec(qcur);
          let tau, util, bound;
          if (j.type === 'hinge') {
            const raw = rv[2] - cur[2];
            const e = clamp(raw, -maxErr, maxErr);
            tau = kk * Math.abs(e);
            util = maxErr > 0 ? Math.abs(e) / maxErr : 0;
            bound = Math.abs(raw) >= maxErr ? 1 : 0;
          } else {
            let s2 = 0, um = 0;
            bound = 0;
            for (let i = 0; i < 3; i++) {
              const raw = rv[i] - cur[i];
              const e = clamp(raw, -maxErr, maxErr);
              s2 += e * e;
              um = Math.max(um, maxErr > 0 ? Math.abs(e) / maxErr : 0);
              if (Math.abs(raw) >= maxErr) bound = 1;
            }
            tau = kk * Math.sqrt(s2);
            util = um;
          }
          if (kind === 'hip') (hipT = Math.max(hipT, tau)), (hipU = Math.max(hipU, util)), (hipB = Math.max(hipB, bound));
          else if (kind === 'knee') (kneeT = Math.max(kneeT, tau)), (kneeU = Math.max(kneeU, util)), (kneeB = Math.max(kneeB, bound));
          else ankT = Math.max(ankT, tau);
        }
      }
      r.nStance = nSt;
      r.hipT = nSt ? hipT : null;
      r.kneeT = nSt ? kneeT : null;
      r.ankT = nSt ? ankT : null;
      r.hipU = nSt ? hipU : null;
      r.kneeU = nSt ? kneeU : null;
      r.hipB = nSt ? hipB : null;
      r.kneeB = nSt ? kneeB : null;
      // 5) gait legs.N (이 스텝 pinFeet 가 지난 world.step 접촉으로 잰 값 × muscle) 와 지난 post 의 발 접촉 대조
      if (G && G.active) {
        const gN = (G.legs.F.N || 0) + (G.legs.B.N || 0);
        r.gaitNMg = gN / Mg;
        const both = G.legs.F.stance && G.legs.B.stance && (G.legs.F.N || 0) > 0 && (G.legs.B.N || 0) > 0;
        r.gaitCmp = both && s.prevFootTot != null && s.prevFootTot > 0 ? gN / (s.prevFootTot * f.muscle) : null;
      } else {
        r.gaitNMg = null;
        r.gaitCmp = null;
      }
      r.Mg = Mg;
      s.cur = r;
    }
  }
  post() {
    const W = this.G.world;
    const dt = W.timestep || GAME.DT;
    const KC = contactCal(W);
    for (const s of this.fs) {
      const f = s.f;
      const r = s.cur;
      const sum = { footF: 0, footB: 0 };
      const tot = { footF: 0, footB: 0 };
      for (const g of OTHER_GROUPS) sum[g] = 0;
      for (const { col, g } of this.colliders(f)) {
        let vy = 0, all = 0;
        W.contactPairsWith(col, (other) => {
          const pb = other.parent ? other.parent() : null;
          if (pb && pb.isFixed && pb.isFixed())
            W.contactPair(col, other, (m) => {
              const n = m.normal();
              for (let i = 0, k = m.numContacts(); i < k; i++) {
                const imp = m.contactImpulse(i);
                all += imp;
                vy += imp * Math.abs(n.y);
              }
            });
        });
        sum[g] = (sum[g] || 0) + (vy / dt) * KC;
        if (g === 'footF' || g === 'footB') tot[g] += all / dt;
      }
      const Mg = r.Mg;
      r.NF = sum.footF / Mg;
      r.NB = sum.footB / Mg;
      r.load = r.NF + r.NB;
      let oth = 0;
      for (const g of OTHER_GROUPS) {
        r['g_' + g] = sum[g] / Mg;
        oth += sum[g];
      }
      r.otherMg = oth / Mg;
      r.cF = tot.footF > 0 ? 1 : 0;
      r.cB = tot.footB > 0 ? 1 : 0;
      s.prevFootTot = tot.footF + tot.footB;
      // 실제 무게 (붙어 있는 몸 + 칼 + 딛은 발 더한 무게): rb.mass()
      let m = 0;
      for (const { rb, kind } of f.meshes) if (kind !== 'loose' && !(kind === 'weapon' && f.armed === false)) m += rb.mass();
      r.Mreal = m;
      r.eqMg = (sum.footF + sum.footB + oth + r.fyMg * Mg) / (m * 9.81);
      const p = f.bodies.pelvis.translation();
      r.pelY = p.y;
      r.hTpost = f.gait && f.gait.active ? f.gait.h : null;
      r.stPost = STATE_CODE[f.state] ?? -1;
      r.fightT = f.fightT;
      if (f.state === 'dead' && s.prevState !== 'dead') s.deaths = (s.deaths || []).concat([{ t: r3(r.t), cause: f.causeOfDeath ?? null }]);
      else if (s.prevState === 'stand' && f.state !== 'stand') s.falls.push({ t: r3(r.t), to: f.state, kind: f.state === 'down' ? 'knockDown(heavy)' : f.state === 'getup' ? 'knockDown(light)' : f.state });
      s.prevState = f.state;
      s.rows.push(r);
    }
  }
}

// ───────── 스텝: harness_m G.step 줄 그대로 + 고리 셋 ─────────
function stepWith(G, obs) {
  const DT = GAME.DT;
  const { player, enemy, ai, world, eventQueue, combat } = G;
  player.foe = G.parkEnemy ? null : enemy;
  enemy.foe = G.parkEnemy ? null : player;
  player.faceTarget = G.faceP || enemy.bodies.pelvis.translation();
  enemy.faceTarget = player.bodies.pelvis.translation();
  if (!G.parkEnemy) ai.update(DT);
  else enemy.move.set(0, 0);
  if (G.ai2) G.ai2.update(DT);
  if (G.before) G.before(G.t);
  if (obs) obs.pre();
  player.step(DT);
  enemy.step(DT);
  if (obs) obs.mid();
  player.cacheState();
  enemy.cacheState();
  world.step(eventQueue, combat.physicsHooks);
  combat.afterStep(world, eventQueue);
  G.t += DT;
  if (obs) obs.post();
}

const _f64 = new Float64Array(12);
function hashTraj(G, h) {
  let i = 0;
  for (const f of [G.player, G.enemy]) {
    const p = f.bodies.pelvis.translation();
    _f64[i++] = p.x;
    _f64[i++] = p.y;
    _f64[i++] = p.z;
    const q = f.sword.rotation(), o = f.sword.translation();
    const L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
    // (0, L, 0) 을 q 로 돌림
    const x = q.x, y = q.y, z = q.z, w = q.w;
    _f64[i++] = o.x + L * 2 * (x * y - w * z);
    _f64[i++] = o.y + L * (1 - 2 * (x * x + z * z));
    _f64[i++] = o.z + L * 2 * (y * z + w * x);
  }
  h.update(Buffer.from(_f64.buffer));
}

// ───────── 장면 ─────────
const jit = (seed, k) => {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x) - 0.5;
};
class Puppet {
  constructor(me, foe) {
    this.me = me;
    this.foe = foe;
  }
  update() {}
}
function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  f.skill.prev.set(xy[0], xy[1]);
  f.skill.aim.set(xy[0], xy[1]);
  f.skill.aimRaw.set(xy[0], xy[1]);
  f.skill.anchor?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}
const slowTo = (off, q, sp) => {
  const DT = GAME.DT;
  const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT;
  if (dd > s) (off.x += (dx / dd) * s), (off.y += (dy / dd) * s);
  else off.set(q[0], q[1]);
};
const setStick = (f, x, y) => {
  // main.js:1364-1368 처럼 (감정 배수 1)
  f.move.set(f.alive ? x : 0, f.alive ? y : 0);
  f.stickX = f.alive ? x : 0;
  f.stickY = f.alive ? y : 0;
};
const LB_CUTS = { oberhau: [[0.02, 0.52], [0.0, -0.45]], zornhau: [[0.42, 0.42], [-0.4, -0.42]], zwerch: [[0.52, 0.06], [-0.5, 0.06]] }; // live_battery CUTS
const DH_ATTACKS = { oberhau: { from: [0.02, 0.52], to: [0.0, -0.5], sp: 13 }, zornhau: { from: [0.42, 0.42], to: [-0.4, -0.42], sp: 13 } }; // down_hits

/** 장면 → 판 목록. 판 = { id, opts, setup(G), script(G, step, mk) } (script 가 step 을 부른다) */
function sceneRounds(name, seed, quick) {
  const { CONFIG } = GAME;
  const hold = CONFIG.ARENA.startHold;
  const S = (k) => seed * 100 + k;
  if (name === 'idle') {
    const T = hold + (quick ? 3 : 5);
    return [{ id: 'idle', win: [hold, T], opts: { seed: S(1), walls: false }, setup: (G) => (G.ai.update = () => {}), script: (G, step) => { while (G.t < T - 1e-9) step(); } }];
  }
  if (name === 'walk') {
    const seg = quick ? 3 : 5;
    const T = hold + 3 * seg + 1;
    return [{
      // 상대는 30 m 앞에 그대로 선다 (park 는 쓰지 않는다: 옮긴 몸의 딛은 자리가 40 m 뒤에 남아 다리가 허공을 딛는다 → 그 쪽 표본이 쓸모없다)
      id: 'walk', win: [hold, T], opts: { seed: S(2), walls: false, gap: 30 },
      setup: (G) => { G.ai.update = () => {}; },
      script: (G, step, mk) => {
        const P = G.player;
        while (G.t < hold - 1e-9) step();
        for (const [nm, x, y] of [['fwd', 0, 1], ['back', 0, -1], ['side', 1, 0], ['stop', 0, 0]]) {
          mk(nm);
          const t1 = G.t + (nm === 'stop' ? 1 : seg);
          while (G.t < t1 - 1e-9) { setStick(P, x, y); step(); }
        }
      },
    }];
  }
  if (name === 'cuts') {
    const names = quick ? ['zornhau'] : ['oberhau', 'zornhau', 'zwerch'];
    return names.map((cn, i) => ({
      // live_battery cut() 의 손 패드 길 (13 m/s). 상대는 park 대신 시작 거리 (5.6 m, 닿지 않음) 에 AI 멈춘 채
      id: 'cuts_' + cn, cut: cn, opts: { seed: S(10 + i), walls: false },
      setup: (G) => { G.ai.update = () => {}; G.player.skill.level = 0.7; },
      script: (G, step, mk) => {
        const P = G.player;
        const [a, b] = LB_CUTS[cn];
        setHand(P, a);
        const tSet = hold + 0.5;
        while (G.t < tSet - 1e-9) step();
        mk('cut');
        const t1 = G.t + 2.0;
        const sp = 13;
        while (G.t < t1 - 1e-9) {
          const off = P.handOffset; const dx = b[0] - off.x, dy = b[1] - off.y, d = Math.hypot(dx, dy), st = sp * GAME.DT;
          if (d > st) (off.x += (dx / d) * st), (off.y += (dy / d) * st);
          else off.set(b[0], b[1]);
          step();
        }
      },
      winFrom: 'cut',
    }));
  }
  if (name === 'shove') {
    const foes = quick ? ['braced'] : ['braced', 'backing'];
    const PFLUG = CONFIG.SKILL.homeGuard;
    return foes.map((foe, i) => {
      const sd = S(20 + i);
      const gj = 0.1 * jit(sd, 1);
      return {
        id: 'shove_' + foe, foe, opts: { seed: sd, walls: false, gap: 1.6 + gj, AIClass: Puppet },
        setup: (G) => { G.player.canShove = true; },
        script: (G, step, mk) => {
          const P = G.player, E = G.enemy;
          const padP = [PFLUG[0] + 0.06 * jit(sd, 2), PFLUG[1] + 0.06 * jit(sd, 3)];
          const padE = [PFLUG[0] + 0.06 * jit(sd, 4), PFLUG[1] + 0.06 * jit(sd, 5)];
          const st = { ph: 'hold', tA: 0, tG: null, tRel: null, tPress: null, fire: null, tAfter: null, sh0: P.shoves ?? 0 };
          const foeMove = () => (foe === 'backing' ? -1 : 0);
          G.before = (t) => {
            slowTo(P.handOffset, padP, 1.0);
            slowTo(E.handOffset, padE, 1.0);
            const d = P.foeDistance();
            let ps = [0, 0], em = 0;
            if (st.ph === 'hold' && !P.feetHeld && !E.feetHeld) (st.ph = 'approach'), (st.tA = t), mk('approach');
            if (st.ph === 'approach') {
              ps = [0, 1];
              em = 1;
              if (st.tG == null && d < 0.6) st.tG = t;
              let done = st.tG != null && t >= st.tG + 0.5 - 1e-9;
              if (!done && t - st.tA > 4) done = true;
              if (done) (st.ph = 'release'), (st.tRel = t), (ps = [0, 0]), (em = 0), mk('release');
            } else if (st.ph === 'release') {
              if (t >= st.tRel + 0.1 - 1e-9) (st.ph = 'press'), (st.tPress = t), mk('press');
            }
            if (st.ph === 'press') {
              em = foeMove();
              ps = [0, 1];
              const sh = P.shoves ?? 0;
              if (st.fire == null && sh > st.sh0) (st.fire = t), mk('fire');
              const lim = st.fire != null ? 2.0 : 1.0;
              const tf = st.fire != null ? t - st.fire : t - st.tPress;
              if ((st.fire != null && t > st.fire && !P.barge) || tf >= lim) (st.ph = 'after'), (st.tAfter = t), (ps = [0, 0]), mk('after');
            } else if (st.ph === 'after') em = foeMove();
            setStick(P, ps[0], ps[1]);
            E.stickX = 0;
            E.stickY = 0;
            E.move.set(0, E.state === 'stand' ? em : 0);
          };
          while (G.t < 16 - 1e-9 && !(st.tAfter != null && G.t >= st.tAfter + 3)) step();
          G.before = null;
        },
      };
    });
  }
  if (name === 'hit') {
    // 맨몸 zornhau (머리·팔 베기, 산다) + heinrich 판금 겉모습에 zornhau (ARMOR: 판금 위는 둔기). oberhau 0.7 m 는 맨몸·판금 둘 다 목 베기로 죽어 뺐다
    const V = quick ? [['zornhau', false]] : [['zornhau', false], ['zornhau', true]];
    return V.map(([an, plate], i) => ({
      id: 'hit_' + an + (plate ? '_plate' : ''), attack: an, winFrom: 'swing', winLen: 4.3, opts: { seed: S(30 + i), walls: false, gap: 2.4, weapon2: 'longsword', ...(plate ? { look2: GAME.getLook('heinrich') } : {}) },
      setup: (G) => (G.ai.update = () => {}),
      script: (G, step0, mk) => {
        // down_hits trial(stand = true) 의 길 (dist 0.7: 가슴끼리 1.3 m), 휘두른 뒤 3 s 더 본다
        const P = G.player, E = G.enemy;
        const step = (mv = 0) => { P.move.set(0, mv); step0(); };
        setHand(P, [0.18, -0.28]);
        Math.random();
        Math.random(); // down_hits 의 jitter 두 번 (난수 소비를 맞춘다)
        for (let k = 0; k < 2.5 / GAME.DT; k++) step();
        const want = 0.7 + 0.6;
        for (const [tol, mx] of [[0.12, 0.5], [0.03, 0.22]]) {
          for (let k = 0; k < 5 / GAME.DT; k++) {
            const d = P.foeDistance();
            if (Math.abs(d - want) < tol) break;
            step(clamp((d - want) * 2.5, -mx, mx));
          }
          for (let k = 0; k < 0.6 / GAME.DT; k++) step();
        }
        const A = DH_ATTACKS[an];
        for (let k = 0; k < 1.2 / GAME.DT; k++) { slowTo(P.handOffset, A.from, 1.0); step(); }
        mk('swing');
        const off = P.handOffset;
        for (let k = 0; k < 1.3 / GAME.DT; k++) {
          const dx = A.to[0] - off.x, dy = A.to[1] - off.y, d = Math.hypot(dx, dy), st = A.sp * GAME.DT;
          if (d > st) (off.x += (dx / d) * st), (off.y += (dy / d) * st);
          else off.set(A.to[0], A.to[1]);
          P.inputActive = d > 1e-4;
          step();
        }
        P.inputActive = false;
        mk('after');
        for (let k = 0; k < 3 / GAME.DT; k++) step();
      },
    }));
  }
  if (name === 'stand30' || name === 'walk30' || name === 'getupN') return sweepRounds(name, seed, quick);
  if (name === 'getup') {
    const J = 200; // 몸체마다 N·s (가슴·머리, 0.25 s 에 나눠). down_hits 넘어뜨리기 밀기 꼴 (40). 기본값 시험: 100 안 넘어짐, 150 겨우, 200·300·450 lostFooting → knockDown(light) → getup (무릎) → stand, 700 다시 넘어짐. heavy (down) 는 이 밀기로 안 나온다
    return [{
      id: 'getup', J, opts: { seed: S(40), walls: false, gap: 4 },
      setup: (G) => (G.ai.update = () => {}),
      script: (G, step, mk) => {
        const P = G.player, E = G.enemy;
        while (G.t < hold + 1 - 1e-9) step();
        mk('push');
        const t0 = G.t;
        const rose = new Map(), refall = new Map();
        G.before = (t) => {
          if (t - t0 < 0.25 - 1e-9)
            for (const [f, a] of [[P, Math.PI], [E, 0]]) for (const k of ['chest', 'head']) f.bodies[k].applyImpulse({ x: Math.cos(a) * J * GAME.DT * 4, y: 0, z: Math.sin(a) * J * GAME.DT * 4 }, true);
        };
        const done = () => [P, E].every((f) => rose.has(f) && G.t >= rose.get(f) + 3);
        const fell = new Set();
        while (G.t < t0 + 14 - 1e-9 && !done()) {
          step();
          for (const f of [P, E]) {
            if (f.state !== 'stand') fell.add(f);
            if (fell.has(f) && f.state === 'stand' && !rose.has(f)) rose.set(f, G.t);
            if (rose.has(f) && f.state !== 'stand' && !refall.has(f)) refall.set(f, G.t);
          }
        }
        G.before = null;
      },
    }];
  }
  throw new Error('장면 없음: ' + name);
}

// ───────── sweep 장면 (support_sweep.mjs 가 부른다. 기본 SCENE_NAMES 에는 없다 → 기본 출력·해시 그대로) ─────────
//  stand30 : 둘 다 가만히 30 s (AI 멈춤). 씨앗마다 간격 3 ± 0.2 m · 쟁기 패드 ± 3 cm (하니스 입력만). 넘어짐 / 분
//  walk30  : P 가 30 s 걷기 (씨앗 차림: 8 방향 중 하나 · 1.2-2.4 s · 스틱 0.6-1 → 같은 길이로 반대 방향, 가끔 0.5-1 s 멈춤),
//            E 는 30 m 앞에 AI 멈춤 (walk 장면과 같다). 넘어짐 / 분
//  getupN  : getup 장면을 씨앗마다 밀기 크기 300 × (1 ± 0.15) N·s · 방향 ± 0.3 rad 로 (하니스 입력만), 3 s 버티면 성공
//  씨앗 수: quick 2, 아니면 6 (SWEEP_NS 환경변수로 바꿈)
function sweepRounds(name, seed, quick) {
  const { CONFIG } = GAME;
  const hold = CONFIG.ARENA.startHold;
  const NS = +(process.env.SWEEP_NS || (quick ? 2 : 6));
  const ks = Array.from({ length: NS }, (_, i) => i + 1);
  const PFLUG = CONFIG.SKILL.homeGuard;
  if (name === 'stand30') {
    const T = hold + 30;
    return ks.map((k) => {
      const sd = seed * 1000 + 500 + k;
      return {
        id: 'stand30_s' + k, win: [hold, T], opts: { seed: sd, walls: false, gap: 3 + 0.4 * jit(sd, 1) },
        setup: (G) => { G.ai.update = () => {}; },
        script: (G, step) => {
          setHand(G.player, [PFLUG[0] + 0.06 * jit(sd, 2), PFLUG[1] + 0.06 * jit(sd, 3)]);
          setHand(G.enemy, [PFLUG[0] + 0.06 * jit(sd, 4), PFLUG[1] + 0.06 * jit(sd, 5)]);
          while (G.t < T - 1e-9) step();
        },
      };
    });
  }
  if (name === 'walk30') {
    const T = hold + 30;
    return ks.map((k) => {
      const sd = seed * 1000 + 600 + k;
      // 차림 (게임 밖 난수: jit 만, Math.random 은 건드리지 않는다)
      const plan = [];
      let tt = 0, i = 0;
      while (tt < 30) {
        const a = Math.floor((jit(sd, 10 + i) + 0.5) * 8) % 8 * (Math.PI / 4);
        const mag = 0.8 + 0.4 * jit(sd, 200 + i);
        const dur = 1.8 + 1.2 * jit(sd, 400 + i);
        plan.push([Math.sin(a) * mag, Math.cos(a) * mag, dur], [-Math.sin(a) * mag, -Math.cos(a) * mag, dur]);
        tt += 2 * dur;
        if (jit(sd, 600 + i) > 0.2) { const ds = 0.75 + 0.5 * jit(sd, 800 + i); plan.push([0, 0, ds]); tt += ds; }
        i++;
      }
      return {
        id: 'walk30_s' + k, win: [hold, T], opts: { seed: sd, walls: false, gap: 30 },
        setup: (G) => { G.ai.update = () => {}; },
        script: (G, step, mk) => {
          const P = G.player;
          while (G.t < hold - 1e-9) step();
          mk('go');
          let j = 0, tSeg = G.t + plan[0][2];
          while (G.t < T - 1e-9) {
            while (j < plan.length - 1 && G.t >= tSeg - 1e-9) { j++; tSeg += plan[j][2]; }
            setStick(P, plan[j][0], plan[j][1]);
            step();
          }
          setStick(P, 0, 0);
        },
      };
    });
  }
  if (name === 'getupN') {
    return ks.map((k) => {
      const sd = seed * 1000 + 700 + k;
      const J = 300 * (1 + 0.3 * jit(sd, 1)); // 255-345 N·s: getup 장면 기록상 200·300·450 모두 넘어짐 → getup (200 아래는 안 넘어지는 판이 있어 300 가운데)
      const da = 0.6 * jit(sd, 2);
      return {
        id: 'getupN_s' + k, J: +J.toFixed(1), opts: { seed: sd, walls: false, gap: 4 },
        setup: (G) => (G.ai.update = () => {}),
        script: (G, step, mk) => {
          const P = G.player, E = G.enemy;
          while (G.t < hold + 1 - 1e-9) step();
          mk('push');
          const t0 = G.t;
          const rose = new Map();
          G.before = (t) => {
            if (t - t0 < 0.25 - 1e-9)
              for (const [f, a] of [[P, Math.PI + da], [E, da]]) for (const kk of ['chest', 'head']) f.bodies[kk].applyImpulse({ x: Math.cos(a) * J * GAME.DT * 4, y: 0, z: Math.sin(a) * J * GAME.DT * 4 }, true);
          };
          const done = () => [P, E].every((f) => rose.has(f) && G.t >= rose.get(f) + 3);
          const fell = new Set();
          while (G.t < t0 + 14 - 1e-9 && !done()) {
            step();
            for (const f of [P, E]) {
              if (f.state !== 'stand') fell.add(f);
              if (fell.has(f) && f.state === 'stand' && !rose.has(f)) rose.set(f, G.t);
            }
          }
          G.before = null;
        },
      };
    });
  }
  throw new Error('장면 없음: ' + name);
}

/** 판 하나를 돌린다. mode: 'stock' (harness G.step) | 'off' (stepWith 표본 없음) | 'on' (표본) */
function runRound(spec, mode) {
  const { H } = GAME;
  const G = H.newRound(spec.opts);
  spec.setup?.(G);
  const obs = mode === 'on' ? new Obs(G) : null;
  const hs = createHash('sha256');
  const marks = {};
  const mk = (k) => (marks[k] = G.t);
  let n = 0;
  const wounds0 = G.wounds.length;
  const step = () => {
    if (mode === 'stock') G.step();
    else stepWith(G, obs);
    hashTraj(G, hs);
    n++;
  };
  spec.script(G, step, mk);
  return { traj: hs.digest('hex').slice(0, 16), n, marks, obs, G, wounds: G.wounds.slice(wounds0).map((w) => ({ t: r3(w.t), att: w.att.name, vic: w.vic.name, zone: w.zone, type: w.type, J: r1(w.energy) })) };
}

// ───────── 요약 ─────────
function episodes(rows, dt, assist) {
  // 붙잡기: levC > 0.05 이 이어진 구간 (live_common assistRaised 문턱과 같음)
  const out = [];
  let cur = null;
  for (let i = 0; i <= rows.length; i++) {
    const r = rows[i];
    const on = r && r.hyb && r.levC > 0.05;
    if (on) {
      if (!cur) {
        // 방아쇠: 처음 오른 스텝 (levC 가 0.05 를 넘기 전 need 가 처음 > 0 인 스텝) 의 가장 큰 경사
        let j = i;
        while (j > 0 && rows[j - 1].hyb && rows[j - 1].levC > 1e-4) j--;
        const r0 = rows[j];
        const tr = [['sag', r0.rSag], ['tilt', r0.rTilt], ['off', r0.rOff]].sort((a, b) => b[1] - a[1]);
        cur = { t0: r.t, trig: tr[0][1] > 0 ? tr[0][0] : 'none', n: 0, peakLev: 0, peakLevC: 0, peakShareX: 0, peakFy: 0, intShareX: 0, intFy: 0, trigAtPeak: null, _pk: -1 };
      }
      cur.n++;
      cur.peakLev = Math.max(cur.peakLev, r.lev);
      if (r.levC > cur.peakLevC) cur.peakLevC = r.levC;
      const need = Math.max(r.rSag, r.rTilt, r.rOff);
      if (need > cur._pk) (cur._pk = need), (cur.trigAtPeak = r.rSag >= r.rTilt && r.rSag >= r.rOff ? 'sag' : r.rTilt >= r.rOff ? 'tilt' : 'off');
      const sx = r.share != null ? r.share - assist : 0;
      cur.peakShareX = Math.max(cur.peakShareX, sx);
      cur.peakFy = Math.max(cur.peakFy, r.fyMg);
      cur.intShareX += sx * dt;
      cur.intFy += r.fyMg * dt;
    } else if (cur) {
      out.push({ t0: r3(cur.t0), dur: r3(cur.n * dt), trig: cur.trig, trigAtPeak: cur.trigAtPeak, peakLev: r3(cur.peakLev), peakLevC: r3(cur.peakLevC), restoredX: r3(cur.peakShareX), peakFyMg: r3(cur.peakFy), intShareX: r3(cur.intShareX), intFyMg: r3(cur.intFy) });
      cur = null;
    }
  }
  return out;
}

function handovers(rows, dt, assist) {
  const out = [];
  let cur = null;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const prev = rows[i - 1];
    if (r.hyb && r.levH > 0.999 && (!prev || !prev.hyb)) cur = { t0: r.t, intShareX: 0, intFy: 0 };
    if (cur) {
      if (!r.hyb) { out.push({ t0: r3(cur.t0), dur: null, interrupted: true }); cur = null; continue; }
      cur.intShareX += (r.share - assist) * dt;
      cur.intFy += r.fyMg * dt;
      if (r.levH < 1e-4) { out.push({ t0: r3(cur.t0), dur: r3(r.t - cur.t0), intShareX: r3(cur.intShareX), intFyMg: r3(cur.intFy) }); cur = null; }
    }
  }
  if (cur) out.push({ t0: r3(cur.t0), dur: null, unfinished: true, intShareX: r3(cur.intShareX), intFyMg: r3(cur.intFy) });
  return out;
}

export function summarise(rows, { dt, assist, win = null }) {
  // 죽은 뒤 스텝은 뺀다 (죽음은 넘어짐이 아니다: 따로 deaths)
  const W = rows.filter((r) => r.st !== 4 && r.stPost !== 4 && (win ? r.t >= win[0] - 1e-9 && r.t <= win[1] + 1e-9 : true));
  const n = W.length;
  const st = W.filter((r) => r.stPost === 0 && r.st === 0);
  const col = (a, k) => a.map((r) => r[k]).filter((x) => x != null && Number.isFinite(x));
  const standMed = pct(col(st, 'pelY'), 0.5);
  const pel = col(st, 'pelY');
  // 평형: 0.5 s 창, 모두 서 있음 + 골반 표준편차 < 5 mm
  const wn = Math.round(0.5 / dt);
  const eq = [];
  for (let i = 0; i + wn <= W.length; i += wn) {
    const s = W.slice(i, i + wn);
    if (!s.every((r) => r.st === 0 && r.stPost === 0)) continue;
    const m = mean(s.map((r) => r.pelY));
    const sd = Math.sqrt(mean(s.map((r) => (r.pelY - m) ** 2)));
    if (sd > 0.005) continue;
    eq.push({ eq: mean(s.map((r) => r.eqMg)), feet: mean(s.map((r) => r.load)) * (s[0].Mg / (s[0].Mreal * 9.81)), oth: mean(s.map((r) => r.otherMg)) * (s[0].Mg / (s[0].Mreal * 9.81)), fy: mean(s.map((r) => r.fyMg)) * (s[0].Mg / (s[0].Mreal * 9.81)) });
  }
  const ufd = W.filter((r) => r.ufyMg != null).map((r) => Math.abs(r.ufyMg - r.fyMg));
  const lce = col(W, 'levCErr');
  const gc = col(W, 'gaitCmp');
  const both0 = st.filter((r) => r.cF === 0 && r.cB === 0).length;
  const single = st.filter((r) => r.cF + r.cB === 1).length;
  // 두 발 뜸 구간 (>= 0.1 s)
  let run = 0, epi = 0, longest = 0;
  for (const r of W) {
    const o = r.st === 0 && r.cF === 0 && r.cB === 0;
    if (o) run++;
    else { if (run * dt >= 0.1 - 1e-9) epi++; longest = Math.max(longest, run); run = 0; }
  }
  if (run * dt >= 0.1 - 1e-9) epi++;
  longest = Math.max(longest, run);
  const ep = episodes(W, dt, assist);
  const byTrig = {};
  for (const e of ep) byTrig[e.trig] = (byTrig[e.trig] || 0) + 1;
  const hyb = W.filter((r) => r.hyb);
  const stance = W.filter((r) => r.nStance > 0);
  const kneel = W.filter((r) => r.kn > 0);
  return {
    n, durS: r3(n * dt), standFrac: r3(n ? st.length / n : null),
    share: stat(col(hyb, 'share')),
    invisible: { fyMg: stat(col(W, 'fyMg')), shareMg: stat(col(W, 'fyShareMg')), springMg: stat(col(W, 'fySpringMg')), dampMg: stat(col(W, 'fyDampMg')), atCapFrac: r3(mean(col(W, 'atCap'))), atZeroFrac: r3(mean(col(W, 'atZero'))), cutFrac: r3(mean(col(W, 'cut'))), standFyMg: stat(col(st, 'fyMg')), walkPushMg: stat(col(W, 'walkPushMg')) },
    lev: { levH: stat(col(W, 'levH')), levC: stat(col(W, 'levC')), lev: stat(col(W, 'lev')), catchActiveFrac: r3(hyb.length ? hyb.filter((r) => r.levC > 0.05).length / hyb.length : null), leverRaisedFrac: r3(hyb.length ? hyb.filter((r) => r.lev > 0.05).length / hyb.length : null), rampActiveFrac: { sag: r3(mean(hyb.map((r) => (r.rSag > 0 ? 1 : 0)))), tilt: r3(mean(hyb.map((r) => (r.rTilt > 0 ? 1 : 0)))), off: r3(mean(hyb.map((r) => (r.rOff > 0 ? 1 : 0)))) } },
    catch: { count: ep.length, byTrigger: byTrig, durS: stat(ep.map((e) => e.dur)), peakLev: stat(ep.map((e) => e.peakLev)), restoredX: stat(ep.map((e) => e.restoredX)), intShareX: r3(ep.reduce((s, e) => s + e.intShareX, 0)), intFyMg: r3(ep.reduce((s, e) => s + e.intFyMg, 0)), episodes: ep.slice(0, 40) },
    handover: handovers(W, dt, assist),
    anchor: { T: stat(col(W, 'anchorT')), tilt: stat(col(W, 'anchorTilt')), yaw: stat(col(W, 'anchorYaw')), K: stat(col(W, 'anchorK')) },
    feet: { load: stat(col(st, 'load')), loadAll: stat(col(W, 'load')), loadBelowHalfFrac: r3(st.length ? st.filter((r) => r.load < 0.5).length / st.length : null), otherMg: stat(col(W, 'otherMg')), otherByPart: Object.fromEntries(OTHER_GROUPS.map((g) => [g, r3(mean(col(W, 'g_' + g)))]).filter(([, v]) => v)), gaitNMg: stat(col(W, 'gaitNMg')), gaitVsContact: { n: gc.length, median: r3(pct(gc, 0.5)), p10: r3(pct(gc, 0.1)), p90: r3(pct(gc, 0.9)), within1pct: r3(gc.length ? gc.filter((x) => Math.abs(x - 1) < 0.01).length / gc.length : null) }, bothOffFrac: r3(st.length ? both0 / st.length : null), bothOffEpisodes: epi, bothOffLongestS: r3(longest * dt), singleFrac: r3(st.length ? single / st.length : null) },
    pelvis: { standMedian: r3(standMed), dip: r3(standMed != null && pel.length ? standMed - Math.min(...pel) : null), dipP5: r3(standMed != null ? standMed - pct(pel, 0.05) : null), vsTarget: stat(W.filter((r) => r.hTpost != null && r.st === 0).map((r) => r.pelY - r.hTpost)) },
    legs: { hipT: stat(col(stance, 'hipT')), kneeT: stat(col(stance, 'kneeT')), ankT: stat(col(stance, 'ankT')), hipU: stat(col(stance, 'hipU')), kneeU: stat(col(stance, 'kneeU')), hipBoundFrac: r3(mean(col(stance, 'hipB'))), kneeBoundFrac: r3(mean(col(stance, 'kneeB'))) },
    fyByState: Object.fromEntries(Object.entries(STATE_CODE).map(([nm, c]) => [nm, { frac: r3(n ? W.filter((r) => r.st === c).length / n : null), fyMg: r3(mean(W.filter((r) => r.st === c).map((r) => r.fyMg))), share: r3(mean(W.filter((r) => r.st === c && r.share != null).map((r) => r.share))) }]).filter(([, v]) => v.frac)),
    kneelFloor: { activeFrac: r3(n ? kneel.filter((r) => r.kneelFloor).length / n : null), fyMgWhile: stat(col(kneel, 'fyMg')) },
    equilibrium: { windows: eq.length, mean: r3(mean(eq.map((e) => e.eq))), residual: r3(eq.length ? mean(eq.map((e) => e.eq)) - 1 : null), residualAbsMax: r3(eq.length ? Math.max(...eq.map((e) => Math.abs(e.eq - 1))) : null), feet: r3(mean(eq.map((e) => e.feet))), other: r3(mean(eq.map((e) => e.oth))), fy: r3(mean(eq.map((e) => e.fy))) },
    checks: { fyVsUserForceMaxMg: r3(ufd.length ? Math.max(...ufd) : null), levCReconMaxErr: r3(lce.length ? Math.max(...lce) : null), levCReconN: lce.length },
  };
}

// 칼 장면: 칼끝 빠르기와 순서 (골반 yaw · 가슴 yaw · 손 · 칼끝 의 시작·최고 시각, 베기 시작 기준 ms)
function cutOrder(rowsP, tCut, dt) {
  const S = rowsP.filter((r) => r.t > tCut - 1e-9 && r.t <= tCut + 0.8 + 1e-9);
  const out = {};
  for (const k of ['pelYaw', 'chYaw', 'hand', 'tip']) {
    const a = S.map((r) => r[k]);
    if (!a.length) continue;
    let ip = 0;
    for (let i = 1; i < a.length; i++) if (a[i] > a[ip]) ip = i;
    const base = a[0];
    const thr = base + 0.2 * (a[ip] - base);
    let io = a.findIndex((x) => x > thr);
    out[k] = { peak: r3(a[ip]), peakMs: r1((S[ip].t - tCut) * 1000), onsetMs: io >= 0 ? r1((S[io].t - tCut) * 1000) : null };
  }
  return out;
}

const f0 = (rows, k) => (rows.length ? rows[0][k] : null);

// ───────── 돌리기 ─────────
export async function measure({ root, scenes = SCENE_NAMES, set = [], seed = 1, out = null, quick = false, proof = false, series = true }) {
  await loadGame(root, set);
  const { CONFIG, THREE } = GAME;
  const dt = GAME.DT;
  const assist = CONFIG.GAIT.assist;
  const res = { meta: { root: GAME.root, set, seed, quick, dt, assist, catchMode: CONFIG.GAIT.catchMode ?? null, legTorque: CONFIG.BODY.legTorque ?? null, weightMode: CONFIG.BODY.weightMode, contactCal: 'contactImpulse/dt × n/(n+1), n = numSolverIterations (harness 6 → 6/7)' }, scenes: {}, proof: proof ? {} : null };
  if (out) mkdirSync(join(out, 'series'), { recursive: true });
  for (const sc of scenes) {
    const rounds = sceneRounds(sc, seed, quick);
    res.scenes[sc] = { rounds: [] };
    for (const spec of rounds) {
      // 표본 켬 (칼 장면은 손·칼끝 빠르기를 위해 post 에 몇 개 더 읽는다)
      const extra = [];
      const R = runRound(
        {
          ...spec,
          setup: (G) => {
            spec.setup?.(G);
          },
        },
        'on',
      );
      // 칼 장면: 손·칼끝·yaw 빠르기는 표본 행에 같이 (다시 돌리지 않으려고 runRound 뒤가 아니라 obs 에서 읽어야 하나,
      //  여기서는 obs 행의 시각과 같은 두 번째 표본 판을 돌리지 않고, Obs 에 넣는다 → 아래 cutRows)
      const rowsBy = R.obs.fs.map((s) => s.rows);
      const winFrom = spec.winFrom ? R.marks[spec.winFrom] : null;
      const win = spec.win ?? (winFrom != null ? [winFrom, winFrom + (spec.winLen ?? 2.0)] : [CONFIG.ARENA.startHold, Infinity]);
      const rr = { id: spec.id, J: spec.J, traj: R.traj, steps: R.n, marks: Object.fromEntries(Object.entries(R.marks).map(([k, v]) => [k, r3(v)])), win: [r3(win[0]), r3(win[1])], wounds: R.wounds, fighters: {} };
      ['P', 'E'].forEach((nm, i) => {
        const s = R.obs.fs[i];
        const sum = summarise(s.rows, { dt, assist, win });
        sum.falls = s.falls;
        sum.deaths = s.deaths || [];
        sum.mass = { totalMassKg: r3(f0(s.rows, 'Mg') / 9.81), realKgMean: r3(mean(s.rows.map((x) => x.Mreal))) };
        sum.fallsInWin = s.falls.filter((x) => x.t >= win[0] && x.t <= win[1]).length;
        rr.fighters[nm] = sum;
      });
      if (sc === 'cuts') {
        const rowsP = R.obs.fs[0].rows;
        rr.cut = cutOrder(rowsP, R.marks.cut, dt);
      }
      if (sc === 'getup' || sc === 'getupN') {
        rr.getup = {};
        ['P', 'E'].forEach((nm, i) => {
          const s = R.obs.fs[i];
          const rows = s.rows;
          const tPush = R.marks.push;
          const fall = s.falls.find((x) => x.t >= tPush);
          let tStand = null, refall = null;
          if (fall) {
            for (const r of rows) if (r.t > fall.t && r.stPost === 0 && tStand == null) tStand = r.t;
            if (tStand != null) refall = s.falls.find((x) => x.t > tStand) || null;
          }
          const lastT = rows[rows.length - 1].t;
          const ho = handovers(rows.filter((r) => tStand != null && r.t >= tStand - dt), dt, assist)[0] || null;
          rr.getup[nm] = { fell: !!fall, fall: fall || null, tStandAfterPushS: tStand != null ? r3(tStand - tPush) : null, success: tStand != null && (!refall || refall.t > tStand + 3) && lastT >= tStand + 3 - 1e-6, refall, handover: ho };
        });
      }
      if (out && series) {
        R.obs.fs.forEach((s, i) => {
          const keys = ['t', 'st', 'hyb', 'share', 'fyMg', 'fyShareMg', 'fySpringMg', 'fyDampMg', 'levH', 'levC', 'lev', 'rSag', 'rTilt', 'rOff', 'load', 'NF', 'NB', 'otherMg', 'gaitNMg', 'eqMg', 'pelY', 'hTpost', 'anchorT', 'hipT', 'kneeT', 'hipU', 'kneeU', 'cF', 'cB', 'offBal', 'tilt', 'pelYaw', 'chYaw', 'hand', 'tip'];
          const lines = [keys.join(',')];
          s.rows.forEach((r, k) => {
            if (k % 4) return;
            lines.push(keys.map((kk) => (r[kk] == null ? '' : typeof r[kk] === 'number' ? +r[kk].toFixed(4) : r[kk])).join(','));
          });
          writeFileSync(join(out, 'series', `${spec.id}__${i ? 'E' : 'P'}.csv`), lines.join('\n') + '\n');
        });
      }
      res.scenes[sc].rounds.push(rr);
      if (proof) {
        const a = runRound(spec, 'stock');
        const b = runRound(spec, 'off');
        res.proof[spec.id] = { stock: a.traj, off: b.traj, on: R.traj, equal: a.traj === b.traj && b.traj === R.traj, steps: [a.n, b.n, R.n] };
      }
    }
  }
  return res;
}

// 칼 장면용 빠르기: Obs.post 에 덧붙인다 (읽기만)
const _post = Obs.prototype.post;
Obs.prototype.post = function () {
  _post.call(this);
  const dt = GAME.DT;
  for (const s of this.fs) {
    const f = s.f;
    const r = s.cur;
    r.pelYaw = Math.abs(f.bodies.pelvis.angvel().y) * R2D;
    r.chYaw = Math.abs(f.bodies.chest.angvel().y) * R2D;
    r.tip = f.tipVel ? f.tipVel.length() : null;
    const b = f.bodies.farmS, q = b.rotation(), t = b.translation();
    const x = q.x, y = q.y, z = q.z, w = q.w;
    // farmS 로컬 (0.13, 0, 0) → 월드 (harness handPos)
    const hx = t.x + 0.13 * (1 - 2 * (y * y + z * z)), hy = t.y + 0.13 * 2 * (x * y + w * z), hz = t.z + 0.13 * 2 * (x * z - w * y);
    r.hand = s.hp ? Math.hypot(hx - s.hp[0], hy - s.hp[1], hz - s.hp[2]) / dt : 0;
    s.hp = [hx, hy, hz];
  }
};

// ───────── 보고서 (한국어 표) ─────────
const fx = (x, d = 2) => (x == null || !Number.isFinite(x) ? '–' : (+x).toFixed(d));
export function summaryMd(res, extra = {}) {
  const L = [];
  const m = res.meta;
  L.push(`# 보이지 않는 받침 재기 — ${m.set.length ? m.set.join(' ') : '기본값'} (${m.root})`);
  L.push('');
  L.push(`assist ${m.assist} · catchMode ${m.catchMode ?? '(없음 = on)'} · legTorque ${m.legTorque ?? '(없음 = asis)'} · ${m.weightMode} · dt ${fx(m.dt * 1000, 3)} ms · 씨앗 ${m.seed}${m.quick ? ' · quick' : ''}`);
  if (extra.head) L.push('', ...extra.head);
  L.push('');
  L.push('값은 몸무게 배수 (×BW = 힘 / (totalMass·g)). 창 = 판 시작 정지(startHold) 뒤 (칼: 베기 시작 뒤 2 s). 발 하중·두 발 뜸은 서 있는 스텝만.');
  L.push('');
  L.push('## 1. 받침 몫 (장면 × 싸움꾼)');
  L.push('');
  L.push('| 판 | 쪽 | 서 있음 | share 평균 | fy 평균 (몫 / 스프링 / 감쇠) | fy p90 | 발 하중 p10 / p50 | 다른 땅 접촉 | catch 켜짐 | catch 수 (sag/tilt/off) | 기준 막대 τ 평균 / p90 N·m | 넘어짐 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [sc, S] of Object.entries(res.scenes))
    for (const r of S.rounds)
      for (const [nm, s] of Object.entries(r.fighters)) {
        const bt = s.catch.byTrigger;
        L.push(`| ${r.id} | ${nm} | ${fx(s.standFrac)} | ${fx(s.share.mean)} | ${fx(s.invisible.fyMg.mean)} (${fx(s.invisible.shareMg.mean)} / ${fx(s.invisible.springMg.mean)} / ${fx(s.invisible.dampMg.mean)}) | ${fx(s.invisible.fyMg.p90)} | ${fx(s.feet.load.p10)} / ${fx(s.feet.load.p50)} | ${fx(s.feet.otherMg.mean, 3)} | ${fx((s.lev.catchActiveFrac ?? 0) * 100, 0)} % | ${s.catch.count} (${bt.sag || 0}/${bt.tilt || 0}/${bt.off || 0}) | ${fx(s.anchor.T.mean, 0)} / ${fx(s.anchor.T.p90, 0)} | ${s.fallsInWin} |`);
      }
  L.push('');
  L.push('## 2. 평형 (0.5 s 창, 서 있고 골반 σ < 5 mm): (발 + 다른 땅 접촉 + fy) / (실제 무게·g)');
  L.push('');
  L.push('| 판 | 쪽 | 창 수 | 합 | 잔차 | |잔차| 최대 | 발 | 다른 | fy |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const S of Object.values(res.scenes))
    for (const r of S.rounds)
      for (const [nm, s] of Object.entries(r.fighters)) {
        const e = s.equilibrium;
        if (!e.windows) continue;
        L.push(`| ${r.id} | ${nm} | ${e.windows} | ${fx(e.mean, 3)} | ${fx(e.residual, 3)} | ${fx(e.residualAbsMax, 3)} | ${fx(e.feet, 3)} | ${fx(e.other, 3)} | ${fx(e.fy, 3)} |`);
      }
  L.push('');
  L.push('## 3. 발·골반·다리');
  L.push('');
  L.push('| 판 | 쪽 | 두 발 뜸 % (구간 / 최장 s) | 한 발 % | 골반 처짐 (최대 / p5) m | 골반 − 목표 p10 / p50 m | 엉덩이 τ p50 / p90 N·m (한도 쓰임 p90, 한도에 닿음 %) | 무릎 τ p50 / p90 N·m (쓰임 p90, 닿음 %) | gait legs.N ÷ 접촉 (중앙, ±1 % 안) |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const S of Object.values(res.scenes))
    for (const r of S.rounds)
      for (const [nm, s] of Object.entries(r.fighters)) {
        const F = s.feet, P = s.pelvis, G = s.legs;
        L.push(`| ${r.id} | ${nm} | ${fx((F.bothOffFrac ?? 0) * 100, 1)} (${F.bothOffEpisodes} / ${fx(F.bothOffLongestS)}) | ${fx((F.singleFrac ?? 0) * 100, 0)} | ${fx(P.dip, 3)} / ${fx(P.dipP5, 3)} | ${fx(P.vsTarget.p10, 3)} / ${fx(P.vsTarget.p50, 3)} | ${fx(G.hipT.p50, 0)} / ${fx(G.hipT.p90, 0)} (${fx(G.hipU.p90)}, ${fx((G.hipBoundFrac ?? 0) * 100, 0)} %) | ${fx(G.kneeT.p50, 0)} / ${fx(G.kneeT.p90, 0)} (${fx(G.kneeU.p90)}, ${fx((G.kneeBoundFrac ?? 0) * 100, 0)} %) | ${fx(F.gaitVsContact.median, 3)} (${fx((F.gaitVsContact.within1pct ?? 0) * 100, 0)} %) |`);
      }
  L.push('');
  L.push('## 4. catch (붙잡기) 구간');
  L.push('');
  L.push('| 판 | 쪽 | 수 | 방아쇠 (시작 / 최고 때) | 길이 p50 / p90 s | 최고 lev p50 | 되살린 몫 p50 / 최대 ×BW | ∫(share − assist) dt BW·s | ∫ fy dt BW·s |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const S of Object.values(res.scenes))
    for (const r of S.rounds)
      for (const [nm, s] of Object.entries(r.fighters)) {
        const c = s.catch;
        if (!c.count) continue;
        const atPk = {};
        for (const e of c.episodes) atPk[e.trigAtPeak] = (atPk[e.trigAtPeak] || 0) + 1;
        L.push(`| ${r.id} | ${nm} | ${c.count} | ${JSON.stringify(c.byTrigger).replace(/"/g, '')} / ${JSON.stringify(atPk).replace(/"/g, '')} | ${fx(c.durS.p50)} / ${fx(c.durS.p90)} | ${fx(c.peakLev.p50)} | ${fx(c.restoredX.p50)} / ${fx(Math.max(...c.episodes.map((e) => e.restoredX)))} | ${fx(c.intShareX, 3)} | ${fx(c.intFyMg, 3)} |`);
      }
  const cuts = res.scenes.cuts?.rounds || [];
  if (cuts.length) {
    L.push('');
    L.push('## 5. 칼 (P, live_battery 손 패드 13 m/s): 최고 빠르기와 순서 (베기 시작 기준 ms, 시작 = 최고의 20 %)');
    L.push('');
    L.push('| 베기 | 칼끝 최고 m/s (ms) | 손 최고 m/s (ms) | 골반 yaw 최고 °/s (시작 / 최고 ms) | 가슴 yaw 최고 °/s (시작 / 최고 ms) | 손 시작 ms | 칼끝 시작 ms |');
    L.push('|---|---|---|---|---|---|---|');
    for (const r of cuts) {
      const c = r.cut;
      L.push(`| ${r.id.slice(5)} | ${fx(c.tip?.peak)} (${fx(c.tip?.peakMs, 0)}) | ${fx(c.hand?.peak)} (${fx(c.hand?.peakMs, 0)}) | ${fx(c.pelYaw?.peak, 0)} (${fx(c.pelYaw?.onsetMs, 0)} / ${fx(c.pelYaw?.peakMs, 0)}) | ${fx(c.chYaw?.peak, 0)} (${fx(c.chYaw?.onsetMs, 0)} / ${fx(c.chYaw?.peakMs, 0)}) | ${fx(c.hand?.onsetMs, 0)} | ${fx(c.tip?.onsetMs, 0)} |`);
    }
  }
  const gu = res.scenes.getup?.rounds || [];
  if (gu.length) {
    L.push('');
    L.push(`## 6. 일어서기 (두 싸움꾼 가슴·머리를 서로 먼 쪽으로 몸체마다 ${gu[0].J ?? '?'} N·s, 0.25 s 에 나눠 · 게임 넘어짐 판정 → getup (무릎) → stand · 3 s 버티면 성공)`);
    L.push('');
    L.push('| 쪽 | 넘어짐 | 선 때 (밀기 뒤 s) | 3 s 버팀 | 다시 넘어짐 | 넘겨받기 길이 s | ∫(share − assist) dt BW·s | ∫ fy dt BW·s |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const r of gu)
      for (const [nm, g] of Object.entries(r.getup)) L.push(`| ${nm} | ${g.fall ? g.fall.kind + ' @' + g.fall.t : '없음'} | ${fx(g.tStandAfterPushS)} | ${g.success ? '예' : '아니오'} | ${g.refall ? g.refall.kind + ' @' + g.refall.t : '–'} | ${fx(g.handover?.dur)} | ${fx(g.handover?.intShareX, 3)} | ${fx(g.handover?.intFyMg, 3)} |`);
  }
  if (res.proof) {
    L.push('');
    L.push('## 7. 읽기만 증명 (스텝마다 두 싸움꾼 골반·칼끝 float64 sha256 앞 16자)');
    L.push('');
    L.push('| 판 | stock (harness G.step) | off (표본 없음) | on (표본) | 같음 |');
    L.push('|---|---|---|---|---|');
    for (const [id, p] of Object.entries(res.proof)) L.push(`| ${id} | ${p.stock} | ${p.off} | ${p.on} | ${p.equal ? '예' : '아니오'} |`);
  }
  L.push('');
  L.push('## 8. 대조');
  L.push('');
  L.push('| 판 | 쪽 | fy 다시 계산 − 골반 userForce.y 최대 ×BW | levC 다시 짓기 최대 오차 (오름 스텝 수) | 걷기 밂 평균 ×BW | 무릎 꿇기 바닥 켜짐 % |');
  L.push('|---|---|---|---|---|---|');
  for (const S of Object.values(res.scenes))
    for (const r of S.rounds)
      for (const [nm, s] of Object.entries(r.fighters)) L.push(`| ${r.id} | ${nm} | ${fx(s.checks.fyVsUserForceMaxMg, 4)} | ${fx(s.checks.levCReconMaxErr, 4)} (${s.checks.levCReconN}) | ${fx(s.invisible.walkPushMg.mean, 3)} | ${fx((s.kneelFloor.activeFrac ?? 0) * 100, 1)} |`);
  if (extra.tail) L.push('', ...extra.tail);
  return L.join('\n') + '\n';
}

// ───────── CLI ─────────
const SELF = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(resolve(process.argv[1])) === realpathSync(SELF)) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) throw new Error('알 수 없는 인자 ' + a);
    args[m[1]] = m[2] ?? true;
  }
  if (!args.root) throw new Error('--root=<트리> 필요');
  const scenes = !args.scenes || args.scenes === 'all' ? SCENE_NAMES : String(args.scenes).split(',');
  const set = parseSets(args.set);
  const out = args.out ? resolve(args.out) : null;
  const res = await measure({ root: args.root, scenes, set, seed: +(args.seed ?? 1), out, quick: !!args.quick, proof: !!args.proof });
  const js = JSON.stringify(res, null, 1);
  const outHash = createHash('sha256').update(js).digest('hex').slice(0, 16);
  if (out) {
    writeFileSync(join(out, 'summary.json'), js + '\n');
    writeFileSync(join(out, 'summary.md'), summaryMd(res, { head: [`출력 해시 (summary.json sha256 앞 16자): ${outHash}`] }));
  }
  if (args.json) console.log(js);
  else console.log(`support_measure ${scenes.join(',')} set=[${set.join(' ')}] out=${out ?? '-'} hash=${outHash}`);
}
