// ─────────────────────────────────────────────────────────────
//  player_edge.mjs — 플레이어(사람 손가락) 칼의 칼 면 맞음 계기 (10/10 사장님 '인간 플레이어 쪽' — docs/motion/player_edge_2026-10-10.md)
//   main.js frame() 의 플레이어 입력 길을 그대로 흉내 낸다: 60 Hz 프레임마다 손가락 패드 이동을 handOffset 에 더하고 (input.js 는 px → 패드 선형 배율뿐),
//   handHeld(손가락 닿음)·inputActive(이번 프레임 움직임)를 두고, 톡이면 skill.thrust(). 멈칫(hitStop)은 main.js 처럼 물리 스텝을 0.12 배·손가락 0.25 배.
//   플레이어 = main.js 와 같게 skill.corr = SKILL.corr · corrTip · autoGuard 켬 · 숙련 0.7. 상대 = 롱소드.
//   상대 셋: stand (AI 멈춤, 가만히 선 과녁) · block (AI 가 공격을 시작하지 않음 — 간 보기·막기·물러남만) · ai (보통 AI, 맞받아 침)
//   둘 다 죽지 않는다 (상처·넘어짐은 그대로). 한쪽이 1.5 s 넘게 서 있지 않으면 그 판을 끝낸다.
//   대본 (씨앗 고정, 결정적): 감기(느리게 감는 자리로 → 빠르게 긋기) · 바로 긋기(쉰 자리에서 그 길 방향으로) · 되긋기(긋고 곧장 반대로) · 톡(찌르기),
//     긋기 길 = 내려베기·사선(좌우)·가로(좌우)·올려베기(좌우)·짧은 튕김, 크기 0.5~1.1 · 빠르기 4~14 패드 m/s, 긋고 곧 뗌 / 0.4 s 댄 채 둠.
//     획 사이 0.5~1.2 s 손 뗌(되돌아옴). 획마다 바라는 거리(무기 길이로)를 골라 조이스틱으로 다가가거나 물러남.
//   잰다 (플레이어가 때린 새 상처, 칼날 부품만 — joint_range EdgeCounter 와 같은 정의):
//     날 각 = 칼날 방향(칼 몸 x) ↔ 맞는 순간 상대 속도의 칼날 축 수직 몫 (스텝 전 칼 상태), 칼 면 = > 45° (확인표 520). 찌르기(stab)는 칸을 나눔.
//     칼날 J = r.ephys × STRIKE.energyScale · × 날 세움 J · 맞힘률 = 칼날 상처를 낸 획 / 획 · 팽이(칼날 축 > 60 rad/s 스텝) · 폭발(팔 > 80 rad/s) · NaN
//   칼 면 갈래 (맞음마다 하나, 위에서부터):
//     clash  칼끼리 닿은 뒤 15 스텝(0.125 s) 안 · foe  제 칼 70 % 속도로는 날이 섬(상대 몸 움직임 몫) · rest  섞기 < 0.5 (칼이 느려 쉼 굴림 목표)
//     lag    목표는 날인데 칼이 못 따라감(어긋남 > 45°) · aim  목표·칼 다 맞는데 제 속도로 칼 면 (판정 순간 굴림 목표가 이미 틀림 — 보정 창 섞기 등)
//   입력 때 (맞음마다): wind 감는 중 · early 긋기 첫 0.1 s · cut 긋는 중 · rev 되긋기 꺾은 뒤 0.15 s · hold 긋고 댄 채 멈춤 · post 뗀 뒤 0.35 s 안(긋기 관성) · lift 그 뒤(되돌아옴) · tap 찌르기 획
//   입력 예측 날 각: 손가락 속도(skill.vel)로 겨눔(guardDir)이 도는 쪽 = 칼이 곧 갈 쪽 ↔ 칼날 방향 각 (입력이 미리 알려 주는 날 방향)
//
//   node tools/sim/player_edge.mjs [무기,…|all] [--foes=stand,block,ai] [--rounds=6] [--secs=24] [--seed0=0] [--json=<파일>] [--quiet]
//   설정 바꿈은 with_config.mjs 로 감싼다 (예: node tools/sim/with_config.mjs JOINTS.playerEdge=off player_edge.mjs longsword)
//  src 는 읽기만 (하니스 몫: AI 멈춤·공격 막음·죽지 않음 — live_twin passive 와 같은 종류)
// ─────────────────────────────────────────────────────────────
import { newRound, THREE, CONFIG, DT, seedRandom } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { Fighter } from '../../src/fighter.js';
import { edgeAngleOf, EDGE_FLAT } from './joint_range.mjs';
import { rng } from './live_common.mjs';
import { writeFileSync } from 'node:fs';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const ALL = ['longsword', 'zweihander', 'monohoshizao', 'uchigatana', 'sabre', 'falchion', 'qinggang', 'rapier', 'estoc'];
const WEAPONS = !pos[0] || pos[0] === 'all' ? ALL : pos[0].split(',');
const FOES = String(args.foes ?? 'stand,block,ai').split(',');
const ROUNDS = +(args.rounds ?? 6);
const SECS = +(args.secs ?? 24);
const SEED0 = +(args.seed0 ?? 0); // 씨앗 밀기 (잡음 폭 재기: --seed0=5000 등)
const FRAME = 1 / 60;
const R2D = 180 / Math.PI;
const { STRIKE, SKILL, INPUT } = CONFIG;

// ── 획 길 (패드 m, 칼 든 쪽 = +x) ──
const LINES = {
  ober: [[0.02, 0.52], [0.0, -0.45]],
  zornR: [[0.42, 0.42], [-0.4, -0.42]],
  zornL: [[-0.4, 0.42], [0.38, -0.44]],
  zwerchR: [[0.52, 0.06], [-0.5, 0.06]],
  zwerchL: [[-0.5, 0.06], [0.52, 0.06]],
  unterR: [[0.38, -0.44], [-0.3, 0.26]],
  unterL: [[-0.4, -0.42], [0.3, 0.26]],
};
const LINE_KEYS = Object.keys(LINES);

/** 획 하나 만들기 (rand 결정적). 다리 [{to:[x,y] 또는 d:[dx,dy], v, tag}] + 뒤 처리 */
function makeStroke(rand, wlen) {
  const u = rand();
  const kind = u < 0.38 ? 'wind' : u < 0.66 ? 'direct' : u < 0.84 ? 'combo' : 'tap';
  const line = LINE_KEYS[Math.floor(rand() * LINE_KEYS.length)];
  const amp = 0.5 + 0.6 * rand();
  const vc = 4 + 10 * rand();
  const vw = 1 + 2 * rand();
  const hold = rand() < 0.4;
  const pause = rand() < 0.5 ? 0 : 0.05 + 0.1 * rand();
  const gapS = 0.5 + 0.7 * rand();
  const dist = 0.55 + wlen * (0.45 + 0.4 * rand());
  const flick = rand() < 0.15; // 짧은 튕김 (길이 0.3~0.5 · 아무 방향)
  const fa = rand() * Math.PI * 2, fl = 0.3 + 0.2 * rand();
  return { kind, line, amp, vc, vw, hold, pause, gapS, dist, flick, fa, fl };
}

function runRound(weapon, foeMode, seed, acc, sw) {
  seedRandom(seed);
  const G = newRound({ walls: true, weapon, weapon2: 'longsword', seed });
  const P = G.player, E = G.enemy;
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  // 죽지 않음 (상처·넘어짐 그대로)
  for (const f of [P, E]) {
    f.die = () => {};
    const aw = f.applyWound.bind(f);
    f.applyWound = (h) => { if (!(f.decapitated && h.zone === 'neck')) aw(h); };
  }
  if (foeMode === 'stand') G.ai.update = () => E.move.set(0, 0);
  else if (foeMode === 'block') G.ai.startAttack = () => false;
  const wlen = P.weaponCfg.hiltLength + P.weaponCfg.bladeLength;
  const rand = rng(seed * 7919 + 13);
  // 멈칫 (main.js onWound·onClash 와 같은 식)
  let hitStop = 0, clashCd = 0, clashStopCd = 0;
  const oW = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    oW?.(att, vic, r, ...rest);
    const e = r.energy;
    const bone = e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg');
    hitStop = Math.max(hitStop, r.pass ? Math.min(0.06, e / 2000) : r.stuck || bone || r.helmet || r.plate ? Math.min(0.1, e / 900) : Math.min(0.08, e / 1200));
  };
  G.combat.hooks.onClash = (point, speed, touch) => {
    const impact = touch ? (touch.fresh || touch.vn > 3 ? touch.vn : 0) : speed;
    if (clashCd > 0) return;
    if (impact < 2.5) { if (touch && touch.vt > 5) clashCd = 0.12; return; }
    clashCd = 0.09;
    if (impact > 6 && clashStopCd <= 0) { hitStop = Math.max(hitStop, Math.min(0.08, impact / 200)); clashStopCd = 0.5; }
  };
  // 상태 (대본)
  const S = { phase: 'lift', tPhase: 0, stroke: null, legs: [], li: 0, held: false, sinceLift: 9, revT: -9, strokeHit: false, tapT: 0 };
  sw.cur = S;
  sw.P = P;
  let stepAcc = 0, notStand = 0, t = 0;
  let gPrev = null; // 빈손 쥠 계기 (10/10 몬탄테 — montante_offhand.mjs 와 같은 정의): 지난 스텝 gripping (서 있지 않으면 null)
  const pending = { taps: 0 };
  const startStroke = () => {
    const st = makeStroke(rand, wlen);
    S.stroke = st;
    acc.strokes++;
    acc.kind[st.kind] = (acc.kind[st.kind] || 0) + 1;
    S.strokeHit = false;
    const [A, B] = LINES[st.line];
    const legs = [];
    if (st.kind === 'tap') { S.phase = 'tap'; S.tPhase = 0; S.legs = []; return; }
    if (st.flick) {
      legs.push({ d: [Math.cos(st.fa) * st.fl, Math.sin(st.fa) * st.fl], v: st.vc, tag: 'cut' });
    } else if (st.kind === 'wind') {
      legs.push({ to: A, v: st.vw, tag: 'wind' });
      if (st.pause) legs.push({ wait: st.pause, tag: 'wind' });
      legs.push({ to: [A[0] + (B[0] - A[0]) * st.amp, A[1] + (B[1] - A[1]) * st.amp], v: st.vc, tag: 'cut' });
    } else if (st.kind === 'direct') {
      legs.push({ d: [(B[0] - A[0]) * st.amp * 0.8, (B[1] - A[1]) * st.amp * 0.8], v: st.vc, tag: 'cut' });
    } else {
      // combo: 감는 자리 → 긋기 → 곧장 되긋기 (패드 바꿈)
      legs.push({ to: A, v: st.vw * 1.5, tag: 'wind' });
      legs.push({ to: [A[0] + (B[0] - A[0]) * st.amp, A[1] + (B[1] - A[1]) * st.amp], v: st.vc, tag: 'cut' });
      legs.push({ to: [A[0] + (B[0] - A[0]) * st.amp * 0.25, A[1] + (B[1] - A[1]) * st.amp * 0.25], v: st.vc * 0.9, tag: 'rev' });
    }
    if (st.hold) legs.push({ wait: 0.4, tag: 'hold' });
    S.legs = legs;
    S.li = 0;
    S.phase = 'stroke';
    S.held = true;
    S.tPhase = 0;
    S.legT = 0;
    S.legFrom = null;
  };
  while (t < SECS) {
    // ── 프레임: 입력 ──
    let dx = 0, dy = 0, moved = false;
    const off = P.handOffset;
    if (S.phase === 'lift') {
      S.held = false;
      S.sinceLift += FRAME;
      if (S.tPhase >= (S.stroke ? S.stroke.gapS : 1.5) && t > 2.6) startStroke();
    }
    if (S.phase === 'tap') {
      S.held = S.tPhase < 0.1;
      if (S.tPhase >= 0.1 && !S.tapDone) { pending.taps++; S.tapDone = true; S.tapT = t; }
      if (S.tPhase >= 0.6) { S.phase = 'lift'; S.tPhase = 0; S.tapDone = false; S.sinceLift = 0; }
    } else if (S.phase === 'stroke') {
      const L = S.legs[S.li];
      if (!L) { S.phase = 'lift'; S.tPhase = 0; S.sinceLift = 0; S.held = false; }
      else if (L.wait) {
        S.legT += FRAME;
        if (S.legT >= L.wait) { S.li++; S.legT = 0; S.legFrom = null; }
      } else {
        if (!S.legFrom) {
          S.legFrom = [off.x, off.y];
          const to = L.to ?? [off.x + L.d[0], off.y + L.d[1]];
          S.legTo = to;
          S.legDur = Math.max(FRAME, Math.hypot(to[0] - off.x, to[1] - off.y) / L.v);
          S.legT = 0;
          if (L.tag === 'rev') S.revT = t;
          if (L.tag === 'cut') S.cutT = t;
        }
        S.legT += FRAME;
        const k = Math.min(1, S.legT / S.legDur);
        const nx = S.legFrom[0] + (S.legTo[0] - S.legFrom[0]) * k, ny = S.legFrom[1] + (S.legTo[1] - S.legFrom[1]) * k;
        dx = nx - off.x; dy = ny - off.y;
        moved = Math.abs(dx) + Math.abs(dy) > 1e-5;
        S.tag = L.tag;
        if (k >= 1) { S.li++; S.legFrom = null; }
      }
    }
    // 조이스틱: 획 사이에만 거리 맞춤
    const st = S.stroke;
    let my = 0;
    if (S.phase === 'lift' && st) {
      const d = P.foeDistance();
      if (d > st.dist + 0.1) my = 0.9;
      else if (d < st.dist - 0.25) my = -0.6;
    } else if (!st) {
      const d = P.foeDistance();
      if (d > 1.0 + wlen * 0.6) my = 0.9;
    }
    const inScale = hitStop > 0 ? 0.25 : 1;
    off.x += dx * inScale;
    off.y += dy * inScale;
    P.handHeld = S.held;
    P.inputActive = moved;
    if (pending.taps > 0 && P.alive && P.state === 'stand') { P.skill.thrust(); }
    pending.taps = 0;
    P.move.set(0, P.alive ? my : 0);
    // ── 물리 스텝 (멈칫이면 0.12 배) ──
    let scale = 1;
    if (hitStop > 0) { hitStop -= FRAME; scale = 0.12; }
    clashCd = Math.max(0, clashCd - FRAME);
    clashStopCd = Math.max(0, clashStopCd - FRAME);
    stepAcc += FRAME * scale;
    while (stepAcc >= DT - 1e-9) {
      stepAcc -= DT;
      G.step();
      sw.stepN++;
      // 떨림 계기 (플레이어 칼)
      if (P.sword && P.armed !== false) {
        const ws = P.sword.angvel(), q = P.sword.rotation();
        const b = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
        const bs = Math.abs(ws.x * b.x + ws.y * b.y + ws.z * b.z);
        if (bs > 60) acc.spinSteps++;
        acc.spinMax = Math.max(acc.spinMax, bs);
        const wu = P.bodies.uarmS.angvel(), wf = P.bodies.farmS.angvel();
        if (Math.max(Math.hypot(wu.x, wu.y, wu.z), Math.hypot(wf.x, wf.y, wf.z)) > 80) acc.armSpin++;
        const c = P.bodies.chest.translation();
        if (!Number.isFinite(c.x) || !Number.isFinite(ws.x)) acc.nan++;
        acc.steps++;
        // 빈손 쥠: 서 있음(stand · 두 손 칼 · muscle > 0.3 · 빈팔 > 0.3) 동안 쥔 스텝 · 쥠 참 → 거짓 = 놓침
        if (P.weaponCfg.twoHand && P.state === 'stand' && P.muscle > 0.3 && P.limbs.armO > 0.3) {
          const g = !!P.gripping;
          acc.gStand++;
          if (g) acc.gHeld++;
          if (gPrev === true && !g) acc.gDrop++;
          gPrev = g;
        } else gPrev = null;
      }
    }
    S.tPhase += FRAME;
    t += FRAME;
    if (P.state !== 'stand' || E.state !== 'stand') notStand += FRAME; else notStand = 0;
    if (notStand > 1.5) break;
  }
  sw.cur = null;
}

// ── 맞음 세기 (Combat.strike 감싸기, joint_range 와 같은 정의) ──
const sw = { stepN: 0, clashStep: -1e9, cur: null, P: null, acc: null };
const bladeClash = Combat.prototype.bladeClash;
Combat.prototype.bladeClash = function (world, pairs) { if (pairs.length) sw.clashStep = sw.stepN; return bladeClash.call(this, world, pairs); };
const strike = Combat.prototype.strike;
const qrot = (q, v) => new THREE.Vector3(...v).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
function guardDirRaw(x, y, oneHand) {
  // fighter.js guardDir 과 같은 기본 매핑 (한손 칼끝 접기 전) — 입력 예측 날 각에만 쓴다 (측정)
  const el = y <= 0.1 ? Math.max(-0.6, (y - 0.1) * 1.1) : Math.min(1.75, ((y - 0.1) / 0.5) * 1.65);
  const az = Math.max(-1.1, Math.min(1.3, (x - 0.05) * 1.7));
  const c = Math.cos(el);
  return new THREE.Vector3(c * Math.cos(az), Math.sin(el), c * Math.sin(az));
}
Combat.prototype.strike = function (pr, point, passing) {
  const att = pr.w.fighter, vic = pr.v.fighter;
  const key = `${att.index}:${pr.v.part}`;
  const fresh = !vic.hitCooldowns.has(key);
  const Sc = att.cache?.sword;
  const r = strike.call(this, pr, point, passing);
  const A = sw.acc, cur = sw.cur;
  if (!A || !cur || att !== sw.P) return r;
  if (fresh && r && Sc && vic.hitCooldowns.has(key) && pr.w.part === 'blade' && att.weaponCfg.edged) {
    const e = r.ephys * STRIKE.energyScale;
    const phase = cur.stroke?.kind === 'tap' && (cur.phase === 'tap' || (cur.phase === 'lift' && cur.sinceLift < 0.6)) ? 'tap' : cur.phase === 'lift' ? (cur.sinceLift < 0.35 ? 'post' : 'lift') : cur.tag || 'cut';
    cur.strokeHit || (A.strokeHits++, cur.strokeHit = true);
    if (r.type === 'stab') {
      A.stab.n++; A.stab.e += e;
      return r;
    }
    const ang = edgeAngleOf(Sc, r);
    if (ang == null) return r;
    const flat = ang > EDGE_FLAT;
    A.n++; A.e += e; if (flat) A.flat++;
    const al = Math.cos(ang / R2D);
    A.eq += al > STRIKE.edgeAlign ? e * (0.4 + 0.6 * ((al - STRIKE.edgeAlign) / (1 - STRIKE.edgeAlign))) : 0;
    A.v += r.speed;
    A.angs.push(ang);
    // 입력 때 (긋기 첫 0.1 s · 되긋기 꺾은 뒤 0.15 s 는 따로)
    let ph = phase;
    const nowT = sw.t();
    if (ph === 'cut' && cur.cutT != null && nowT - cur.cutT < 0.1) ph = 'early';
    if (ph === 'rev' && nowT - cur.revT > 0.15) ph = 'cut';
    const PH = (A.phase[ph] ||= [0, 0]); PH[0]++; if (flat) PH[1]++;
    // 갈래
    const hv = att.hitPointVel;
    const own = hv && hv.lengthSq() > 0.25 ? edgeAngleOf(Sc, { bladeAxis: r.bladeAxis, dir: hv.clone().normalize() }) : null;
    let cause = null;
    if (sw.stepN - sw.clashStep <= 15) cause = 'clash';
    else if (own == null || own <= EDGE_FLAT) cause = own == null ? 'rest' : 'foe';
    else if ((att.edgeMoving ?? 1) < 0.5) cause = 'rest';
    else if ((att.edgeLag ?? 0) > Math.PI / 4) cause = 'lag';
    else cause = 'aim';
    const CC = (A.cause[cause] ||= [0, 0]); CC[0]++; if (flat) CC[1]++;
    if (flat && att.corr?.win) A.flatCorrWin++;
    if (att.corr?.win) A.corrWin++;
    // 입력 예측 날 각: 손가락 속도로 겨눔이 도는 쪽
    const sk = att.skill;
    const vlen = sk.vel.length();
    if (vlen > SKILL.swingSpeed) {
      const h = 0.02;
      const oneHand = !!att.guardPose?.oneHand;
      const a0 = guardDirRaw(sk.aim.x, sk.aim.y, oneHand), a1 = guardDirRaw(sk.aim.x + sk.vel.x * h, sk.aim.y + sk.vel.y * h, oneHand);
      const da = a1.sub(a0).applyQuaternion(att.yaw);
      const angIn = edgeAngleOf(Sc, { bladeAxis: r.bladeAxis, dir: da.normalize() });
      if (angIn != null) { A.inN++; if (angIn > EDGE_FLAT) A.inFlat++; if (flat) { A.inNflat++; if (angIn <= EDGE_FLAT) A.inFixable++; } }
    }
    // 맞은 부위
    const pk = pr.v.part;
    const PK = (A.part[pk] ||= [0, 0]); PK[0]++; if (flat) PK[1]++;
    const sb = r.speed < 3 ? 0 : r.speed < 8 ? 1 : 2;
    A.sp[sb][0]++; if (flat) A.sp[sb][1]++;
  }
  return r;
};

const newAcc = () => ({ strokes: 0, strokeHits: 0, kind: {}, n: 0, flat: 0, e: 0, eq: 0, v: 0, angs: [], stab: { n: 0, e: 0 }, phase: {}, cause: {}, part: {}, sp: [[0, 0], [0, 0], [0, 0]], inN: 0, inFlat: 0, inNflat: 0, inFixable: 0, corrWin: 0, flatCorrWin: 0, spinSteps: 0, spinMax: 0, armSpin: 0, nan: 0, steps: 0, gStand: 0, gHeld: 0, gDrop: 0 });
let tNow = 0;
sw.t = () => tNow;
const origStep = Fighter.prototype.cacheState;
Fighter.prototype.cacheState = function (...a) { if (this === sw.P) tNow = this.fightT ?? tNow; return origStep.apply(this, a); };

const out = {};
for (const w of WEAPONS) {
  const per = {};
  const tot = newAcc();
  for (const foe of FOES) {
    const acc = newAcc();
    sw.acc = acc;
    for (let r = 0; r < ROUNDS; r++) runRound(w, foe, 1000 + SEED0 + r * 17 + FOES.indexOf(foe) * 101, acc, sw);
    per[foe] = acc;
    for (const k of ['strokes', 'strokeHits', 'n', 'flat', 'e', 'eq', 'v', 'inN', 'inFlat', 'inNflat', 'inFixable', 'corrWin', 'flatCorrWin', 'spinSteps', 'armSpin', 'nan', 'steps', 'gStand', 'gHeld', 'gDrop']) tot[k] += acc[k];
    tot.spinMax = Math.max(tot.spinMax, acc.spinMax);
    tot.angs.push(...acc.angs);
    tot.stab.n += acc.stab.n; tot.stab.e += acc.stab.e;
    for (const g of ['phase', 'cause', 'part', 'kind']) for (const [k, v] of Object.entries(acc[g])) { if (Array.isArray(v)) { const T = (tot[g][k] ||= [0, 0]); T[0] += v[0]; T[1] += v[1]; } else tot[g][k] = (tot[g][k] || 0) + v; }
    for (let i = 0; i < 3; i++) { tot.sp[i][0] += acc.sp[i][0]; tot.sp[i][1] += acc.sp[i][1]; }
  }
  const sum = (A) => {
    const s = [...A.angs].sort((x, y) => x - y);
    const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);
    return {
      hits: A.n, flatPct: pct(A.flat, A.n), angMed: s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null, eMean: A.n ? +(A.e / A.n).toFixed(1) : 0, eqMean: A.n ? +(A.eq / A.n).toFixed(1) : 0, vMean: A.n ? +(A.v / A.n).toFixed(2) : 0,
      strokes: A.strokes, hitRate: pct(A.strokeHits, A.strokes), stab: { n: A.stab.n, eMean: A.stab.n ? +(A.stab.e / A.stab.n).toFixed(1) : 0 },
      phase: Object.fromEntries(Object.entries(A.phase).map(([k, [n, f]]) => [k, `${n}:${pct(f, n)}%`])),
      cause: Object.fromEntries(Object.entries(A.cause).map(([k, [n, f]]) => [k, `${f}/${A.flat}`])),
      part: Object.fromEntries(Object.entries(A.part).map(([k, [n, f]]) => [k, `${n}:${pct(f, n)}%`])),
      speedBins: A.sp.map(([n, f]) => `${n}:${pct(f, n) ?? 0}%`).join(' '),
      inputFlatPct: pct(A.inFlat, A.inN), inputN: A.inN, flatButInputEdge: `${A.inFixable}/${A.inNflat}`, corrWinPct: pct(A.corrWin, A.n), flatInCorrWin: A.flatCorrWin,
      spinSteps: A.spinSteps, spinMax: Math.round(A.spinMax), armSpin: A.armSpin, nan: A.nan, steps: A.steps, kind: A.kind,
      gripHeldPct: A.gStand ? +((100 * A.gHeld) / A.gStand).toFixed(1) : null, gripDrops: A.gDrop,
    };
  };
  out[w] = { all: sum(tot), ...Object.fromEntries(Object.entries(per).map(([k, v]) => [k, sum(v)])) };
  if (!args.quiet) {
    const a = out[w].all;
    process.stderr.write(`${w}: 칼날 맞음 ${a.hits} · 칼 면 ${a.flatPct}% · J ${a.eMean} (× 날 ${a.eqMean}) · 맞힘률 ${a.hitRate}% (${a.strokes} 획) · 찌르기 ${a.stab.n} (${a.stab.eMean} J) · 팽이 ${a.spinSteps} (${a.spinMax}) · 폭발 ${a.armSpin} · NaN ${a.nan}\n`);
    if (a.gripHeldPct != null) process.stderr.write(`   빈손 쥔 몫 ${a.gripHeldPct}% · 놓침 ${a.gripDrops}\n`);
    process.stderr.write(`   갈래 ${JSON.stringify(a.cause)} · 때 ${JSON.stringify(a.phase)} · 입력 예측 날 각 칼 면 ${a.inputFlatPct}% (칼 면 중 입력으론 날 ${a.flatButInputEdge}) · 보정 창 ${a.corrWinPct}%\n`);
    for (const f of FOES) { const b = out[w][f]; process.stderr.write(`   ${f}: ${b.hits} 맞음 · 칼 면 ${b.flatPct}% · J ${b.eMean} · 맞힘률 ${b.hitRate}%\n`); }
  }
}
const edgeCfg = { edge: CONFIG.JOINTS.edge, playerEdge: CONFIG.JOINTS.playerEdge ?? null };
if (args.json) writeFileSync(args.json, JSON.stringify({ cfg: edgeCfg, foes: FOES, rounds: ROUNDS, secs: SECS, out }, null, 1));
console.log(JSON.stringify({ cfg: edgeCfg, out: Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { hits: v.all.hits, flatPct: v.all.flatPct, eMean: v.all.eMean, hitRate: v.all.hitRate, stab: v.all.stab.n }])) }));
