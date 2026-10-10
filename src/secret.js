// ─────────────────────────────────────────────────────────────
//  유파 비기 — 조건 판정 공용 (AI·플레이어 같은 함수)
//
//  10/9 사장님 23:3x '인간 플레이어로서는 비기를 아예 못 쓰겠어' → 플레이어 비기 (docs/strike/player_secret_2026-10-09.md).
//  비기의 조건(상대 사건을 지금 모습으로 봄 · cond)을 ai.js 에만 두면 플레이어 쪽이 따로 베껴야 한다 → 여기 한 곳에 두고
//  ai.js(secretScan·secretCond)와 플레이어 창(PlayerSecretWatch, main.js)이 함께 부른다. 난수 없음.
//
//  view = 판정하는 쪽의 간격 { reach(내 간격 끝), foeReach(상대 칼 닿는 거리 추정), clinch } — AI 는 this.M·this.foeReach,
//   플레이어는 검술 풀이의 measure(같은 꾸러미 값)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, SKILL } from './config.js';
import { TRADITIONS } from './schools.js';
import { Senses } from './ai_sense.js';
import { segDist } from './skill.js';

const clamp = THREE.MathUtils.clamp;
const _r = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** 칸 값: 문자열이면 SECRET 의 열쇠 (schools.js 는 수를 갖지 않는다) */
export function secretVal(v) {
  return typeof v === 'string' ? SECRET[v] : v;
}

/** threat() 와 같은 셈을 지금 모습 s 로 (위협 번호는 건드리지 않는다): { line, thrust, sp, E(칼끝 추정 에너지 ½·m·v²), high(상대 손이 높음) } 또는 null */
export function threatNow(sense, foe, s, c, r, d, foeReach) {
  if (d > foeReach + 0.9) return null;
  let hit = null;
  for (let k = 0; k < 2; k++) {
    const px = k ? s.mx : s.tx;
    const py = k ? s.my : s.ty;
    const pz = k ? s.mz : s.tz;
    const vx = k ? s.mvx : s.tvx;
    const vy = k ? s.mvy : s.tvy;
    const vz = k ? s.mvz : s.tvz;
    const sp = Math.hypot(vx, vy, vz);
    if (sp < 3.5) continue;
    const rx = px - c.x;
    const ry = py - c.y;
    const rz = pz - c.z;
    const vh2 = vx * vx + vz * vz;
    const tc = clamp(vh2 > 1e-3 ? -(rx * vx + rz * vz) / vh2 : 0, 0, 0.45);
    const hx = rx + vx * tc;
    const hy = ry + vy * tc;
    const hz = rz + vz * tc;
    if (Math.hypot(hx, hz) > 0.55 || hy < -1.3 || hy > 0.75) continue;
    if (!hit || tc < hit.tc) hit = { tc, hx, hy, hz, vx, vy, vz, sp };
  }
  if (!hit) return null;
  const lat = hit.hx * r.x + hit.hz * r.z;
  const bx = s.tx - s.mx;
  const by = s.ty - s.my;
  const bz = s.tz - s.mz;
  const along = (bx * hit.vx + by * hit.vy + bz * hit.vz) / ((Math.hypot(bx, by, bz) || 1) * hit.sp);
  const thrust = along > 0.75;
  let line;
  if (thrust) line = 'thrust';
  else {
    const ch = sense.seen(0.15); // 어디서 칼을 들었었나 (threat 와 같은 0.15 s 앞 — 반응 지연만 뺐다)
    if (ch.hy > 0.15) line = ch.hx > 0.15 ? 'highL' : ch.hx < -0.15 ? 'highR' : 'highC';
    else if (ch.hy < -0.2) line = ch.hx >= 0 ? 'lowL' : 'lowR';
    else if (hit.hy > -0.1) line = lat > 0.12 ? 'highR' : lat < -0.12 ? 'highL' : 'highC';
    else line = lat >= 0 ? 'lowR' : 'lowL';
  }
  const m = foe.swordProps?.m ?? 1.5;
  const v2 = s.tvx * s.tvx + s.tvy * s.tvy + s.tvz * s.tvz;
  return { line, thrust, sp: hit.sp, E: 0.5 * m * v2, high: s.hy > 0.15 };
}

/** 상대 칼끝 추정 에너지 ½·m·v² 의 최고 (지금부터 span 초 앞까지, 지금 모습 — 반응 지연 0) */
export function foeRecentTipE(sense, foe, span) {
  const B = sense.buf;
  const N = B.length;
  let best = 0;
  for (let b = 0; b <= Math.min(N - 1, Math.round(span * 120)); b++) {
    const s = B[(sense.head - b + N * 2) % N];
    if (s.t < 0) break;
    const v2 = s.tvx * s.tvx + s.tvy * s.tvy + s.tvz * s.tvz;
    if (v2 > best) best = v2;
  }
  return 0.5 * (foe.swordProps?.m ?? 1.5) * best;
}

/**
 * 치명적인 칼인가 — 궤적 (10/10 사장님 '치명성을 J 로 판단하는 게 이상하다. 목을 노리는 궤적 같은 걸로는?' → 디렉터 안 승인):
 *  들어오는 상대 칼끝(지금 모습 s)의 위치·속도로 앞 SECRET.lethalLook 초를 곧게 내다본 선분이 내 머리(공 r 0.1)·목(가슴 → 머리 사이 점, r 0.06)
 *  겉에서 얼마나 가까이 지나나(ctx.lethalD, m)와 칼끝 빠르기(ctx.tipSp, m/s)를 ctx 에 적는다. 판정은 secretCond (lethalDist·lethalSpeed)
 */
function lethalPath(ctx, s, me) {
  const T = SECRET.lethalLook;
  const ax = s.tx;
  const ay = s.ty;
  const az = s.tz;
  const bx = ax + s.tvx * T;
  const by = ay + s.tvy * T;
  const bz = az + s.tvz * T;
  const h = me.bodies.head.translation();
  const ch = me.bodies.chest.translation();
  const nx = ch.x + (h.x - ch.x) * 0.6;
  const ny = ch.y + (h.y - ch.y) * 0.6;
  const nz = ch.z + (h.z - ch.z) * 0.6;
  const dHead = segPoint(ax, ay, az, bx, by, bz, h.x, h.y, h.z) - 0.1;
  const dNeck = segPoint(ax, ay, az, bx, by, bz, nx, ny, nz) - 0.06;
  ctx.lethalD = Math.min(dHead, dNeck);
  ctx.tipSp = Math.hypot(s.tvx, s.tvy, s.tvz);
}

/** 선분 a–b 와 점 p 사이 거리 */
function segPoint(ax, ay, az, bx, by, bz, px, py, pz) {
  const ux = bx - ax;
  const uy = by - ay;
  const uz = bz - az;
  const L2 = ux * ux + uy * uy + uz * uz;
  const t = L2 > 1e-9 ? clamp(((px - ax) * ux + (py - ay) * uy + (pz - az) * uz) / L2, 0, 1) : 0;
  return Math.hypot(ax + ux * t - px, ay + uy * t - py, az + uz * t - pz);
}

/**
 * 상대 사건 (S.when 의 threat·foeRaise·foeCharge·foeRecover) 을 지금 모습 s0 로 본다. { on, ctx } — 사건이 없거나 S 가 상대 사건 비기가 아니면 on false.
 *  ctx: threat 면 threatNow 의 값, 아니면 { ev: 'raise' | 'recover', tipE? }
 */
export function secretEvent(S, sense, foe, s0, c, r, d0, foeReach, me = null, ex = null) {
  const W = [].concat(S.when);
  if (W.includes('inside')) return insideEvent(s0, c, d0, ex);
  if (W.includes('threat')) {
    const ctx = threatNow(sense, foe, s0, c, r, d0, foeReach);
    if (ctx && S.cond?.lethal && me) lethalPath(ctx, s0, me);
    return { on: !!ctx, ctx };
  }
  if (!(W.includes('foeRecover') || W.includes('foeRaise') || W.includes('foeCharge'))) return { on: false, ctx: null };
  const dx = s0.cx - c.x;
  const dz = s0.cz - c.z;
  // preThreat 의 raising·charging 과 같은 꼴 — 지금 모습으로. 거리 창(cond.window)이 있는 비기(일본)는 preThreat 의 '가까움' 문턱 대신 그 창이 거리를 맡는다
  const closing = Math.max(0, -(s0.vx * dx + s0.vz * dz) / d0);
  const raising = W.includes('foeRaise') && s0.hvy > 1.6 && s0.hy > 0.05;
  const charging = W.includes('foeCharge') && closing > 0.9;
  let on = (raising || charging) && (!!S.cond?.window || d0 < foeReach + closing * 0.4 + 0.3);
  // 결심한 공격만 (cond.commit — 10/9 사장님 '발동은 좀 줄되'): 들어 올림이면 손이 commit 패드 m/s 이상으로 움직일 때만(달려듦은 그대로)
  if (on && S.cond?.commit && !charging && Math.hypot(s0.hvx, s0.hvy) < secretVal(S.cond.commit)) on = false;
  if (on) return { on, ctx: { ev: 'raise' } };
  // seize 의 recovering 과 같은 꼴(방금 크게 휘두르고 손이 멎음) — 늦지 않게 지금 모습으로 (일본은 들어 올림 다음 차례의 보조 사건)
  if (W.includes('foeRecover') && sense.recentHandSpeed(0, 0.6) > 3.5 && Math.hypot(s0.hvx, s0.hvy) < 1.8) {
    return { on: true, ctx: { ev: 'recover', tipE: foeRecentTipE(sense, foe, 0.6) } }; // 진짜 헛스윙인가 — 그 휘두름의 칼끝 추정 에너지 (cond.whiff)
  }
  return { on: false, ctx: null };
}

/**
 * 이베리아 '호 안쪽' 사건 (10/10 04:4x 사장님 — 전 BindCount 맺힘 셋을 바꿈): 상대 몸통(가슴)이 내 칼 호 안쪽까지 밀고 들어옴 —
 *  거리 d0 < 내 reach − SECRET.iberianInside 이고, 상대가 다가오는 중(가슴이 나 쪽으로 SECRET.iberianInsideClosing m/s 넘게)이거나 그 거리에 SECRET.iberianInsideDwell 초 머묾.
 *  ex = { reach, dt, st } — st.insideT 에 머문 시간을 센다 (AI secretEv · 플레이어 창 ev 칸, 같은 셈). 굴림 없음
 */
function insideEvent(s0, c, d0, ex) {
  if (!ex || !(ex.reach > 0)) return { on: false, ctx: null };
  const st = ex.st;
  const inside = d0 < ex.reach - SECRET.iberianInside;
  st.insideT = inside ? (st.insideT ?? 0) + (ex.dt ?? 0) : 0;
  if (!inside) return { on: false, ctx: null };
  const closing = Math.max(0, -(s0.vx * (s0.cx - c.x) + s0.vz * (s0.cz - c.z)) / d0);
  const on = closing > SECRET.iberianInsideClosing || st.insideT >= SECRET.iberianInsideDwell;
  return on ? { on, ctx: { ev: 'inside', closing, dwell: st.insideT } } : { on: false, ctx: null };
}

/** 비기 조건 (cond) — 굴림 없음. view = { reach, foeReach, clinch } */
export function secretCond(S, ctx, d, view) {
  const C = S.cond;
  if (!C) return true;
  if (C.lethal && !(ctx && ctx.tipSp >= SECRET.lethalSpeed && ctx.lethalD <= SECRET.lethalDist)) return false; // 10/10: J 문턱(옛 lethalJ 247) 대신 궤적 — 칼끝 길이 내 머리·목 곁을 지남 (lethalPath)
  if (C.armed && SECRET.iai && !view.armed) return false; // 일본 발도: 발도 대기에서만 (IaiArm)
  if (C.armed && SECRET.iai && view.contact != null && d > view.contact + SECRET.iaiStep + SECRET.iaiMargin) return false; // 발도가 닿는 거리: 내디딤(iaiStep) 뒤 맞닿기 + 여유 안
  if (C.whiff && ctx?.ev === 'recover' && !(ctx.tipE >= secretVal(C.whiff))) return false; // 일본 보조 사건(헛침): 상대가 헛친 칼이 제대로 휘두른 칼이었나
  if (C.window) {
    // 일본 後の先 창: 상대 공격은 명백히 안 닿고(상대 칼 닿는 거리 foeReach + 여유 밖) 내 後の先 은 닿는다(내 간격 끝 + 기술 reach + 강한 내딛음 몫 안)
    if (!(C.armed && SECRET.iai) && (d <= view.foeReach + SECRET.japaneseFoeMargin || d > view.reach + SECRET.japaneseReach + SECRET.japaneseFar)) return false; // (발도는 아래 대기·닿는 거리가 창을 맡는다)
  }
  if (C.line && !C.line.includes(ctx?.line)) return false;
  if (C.range === 'counter' && !(d < view.reach + 0.3 && d > view.clinch + 0.1)) return false; // ai.js counterRange 와 같은 식
  if (C.dist) {
    const w = secretVal(C.dist);
    if (d < view.reach + w[0] || d > view.reach + w[1]) return false;
  }
  return true;
}

/**
 * 중국 연환삼격 조건 (10/10 01:2x 사장님 '쉬었다가 들어가며' → 정확한 값): 내 공격 없이 SECRET.chineseRest 초 이상 지난 뒤 들어가며 친 첫 칼이
 *  맞았나 (cond.landed 면 맞물림 제외). rest = 그 칼을 시작하기 전 내 공격 없이 지난 시간 (s). AI(secretFirstHit)·플레이어 창이 같은 함수
 */
export function firstHitOk(S, rest, landed, bound) {
  if (S.cond?.rest != null && !(rest >= secretVal(S.cond.rest))) return false;
  return landed || (!S.cond?.landed && bound);
}

/**
 * 이베리아 맺힘 셈 (10/10 01:2x 사장님 '내 베기가 피해를 주지 못하고 칼끼리만 부딪힌 횟수가 3 회가 되면 다음 공격이 비기' — 세는 법 디렉터 정의):
 *  내 베기 공격이 상대 칼과 닿고(맺힘·막힘) 상처를 못 내고 끝나면 +1 · 내 공격이 상처를 내면 0 · SECRET.iberianReset 초 동안 내 칼이 상대 칼에
 *  닿지 않으면 0 · 헛친 베기(아무것도 안 닿음)는 그대로 · 비기를 내면 0. n ≥ SECRET.iberianBinds 면 ready. AI·플레이어 같은 셈
 */
export class BindCount {
  constructor() {
    this.n = 0;
    this.quiet = 0; // 내 칼이 상대 칼에 닿지 않은 시간
  }
  /** 매 스텝: 칼끼리 닿아 있나 */
  tick(dt, touching) {
    this.quiet = touching ? 0 : this.quiet + dt;
    if (this.quiet >= SECRET.iberianReset) this.n = 0;
  }
  /** 내 베기 공격 하나가 끝남 */
  strike(landed, bound) {
    if (landed) this.n = 0;
    else if (bound) this.n++;
  }
  get ready() {
    return this.n >= SECRET.iberianBinds;
  }
  reset() {
    this.n = 0;
  }
}

/**
 * 일본 발도 대기 (10/10 02:4x 사장님 '뒤로 몇 초 이상 물러서면?'): 상대 간격 밖(상대 칼 닿는 거리 밖)에 SECRET.iaiArmTime 초 이상 계속 머물면 armed.
 *  간격 안으로 들어가거나 공격·막기(busy)면 풀린다. AI 는 이때 웅크린 발도 대기 자세(secret_instant.js iaiReadyPose), 플레이어는 '고노센 준비' 표시만.
 *  고노센(cond.armed)은 armed 일 때만 — SECRET.iai 일 때. AI·플레이어 같은 셈
 */
export class IaiArm {
  constructor() {
    this.t = 0;
    this.armed = false;
  }
  tick(dt, outside, busy) {
    if (busy) {
      this.t = 0;
      this.armed = false;
      return;
    }
    if (outside) {
      this.t += dt;
      this.grace = SECRET.iaiArmGrace;
      this.armed = this.t >= SECRET.iaiArmTime;
      return;
    }
    // 간격 안: 대기 자세는 iaiArmGrace 초 뒤에 풀린다 (달려드는 상대가 간격 안으로 막 들어온 순간을 받을 수 있게)
    if (this.armed && (this.grace -= dt) > 0) return;
    this.t = 0;
    this.armed = false;
  }
}

/** 두 칼이 닿아 있나: 칼끼리 부딪힘(combat.bladeClash 가 적는 fighter.feel.touching — 실제 접촉 충격) 또는 ai.js checkBind 와 같은 기하(칼날 0.1 지점 ~ 칼끝 선분 사이 < 0.07 m) */
export function bladesTouch(me, foe) {
  if (!me.armed || !foe.armed) return false;
  if (me.feel?.touching) return true;
  if (!me.tipPrev || !foe.tipPrev) return false;
  return segDist(me.bladePoint(0.1, _a), me.tipPrev, foe.bladePoint(0.1, _b), foe.tipPrev) < 0.07;
}

/**
 * 이베리아 멈추지 않는 흐름의 수 (10/11 — schools.js IBERIAN_SECRET do.flow, AI ai.js secretGo · 플레이어 skill.js secret 같은 함수). 난수 없음.
 *  hand = 지금 손 패드 [x, y] · dir = 지금 칼(손)이 움직이는 쪽 [x, y] (플레이어는 비기를 낸 끌기, 없으면 걸러진 손 목표 속도 — 크기는 안 봄) · D = do 칸.
 *  첫 쪽 s(+1 오른쪽 = 탈류부터 · −1 왼쪽 = 레베스부터)는 지금 흐름이 정한다 — 칼을 그대로 그쪽으로 떨어뜨려 감고(피 복Ⅰ) 거기서 올린다:
 *   ① 올려 베는 중(dir 위로)이면 그 올려베기를 첫 수로 이어 끝까지 · ② 옆·아래로 가는 중이면 그 쪽으로 · ③ 멈춰 있으면 손이 있는 쪽, 가운데면 오른쪽(피 단Ⅰ 탈류부터).
 *  내려 베는 중이면 꺾지 않고 곧장 그 쪽 아래로, 아니면 바깥 옆([s × 0.5, …])을 돌아 떨어진다.
 *  수 = 한 방향 한 토막 (떨어뜨림 → 올려베기 → 떨어뜨림 → 올려베기 … → 머리 위로 넘김 → 둘러 베는 큰 한 칼). 토막 끝마다 gate(flowGate — 실제 칼이 그 자리에 갔나)가 있어
 *   손 목표가 먼저 끝나도 칼이 따라오기 전엔 다음 토막을 열지 않는다 — 무거운 칼이 명령을 못 따라와 번갈아 베기가 한쪽에서 뭉개지던 것(탐침: 칼끝 옆 폭 0.23 m)을 막는다.
 *  토막 = { name, nameKo, from, pre: [](이음새 물레 점 없음 — 앞 토막 끝에서 곧장), path, gate?, open, kind, reach, base }
 */
export function montanteFlowSeq(hand, dir, D) {
  const hx = hand[0];
  const hy = hand[1];
  const len = Math.hypot(dir?.[0] ?? 0, dir?.[1] ?? 0);
  const ux = len > 1e-6 ? dir[0] / len : 0;
  const uy = len > 1e-6 ? dir[1] / len : 0;
  const side = (v) => (v < 0 ? -1 : 1);
  const P = (o, s) => o[s].slice();
  const rising = uy > 0.5; // ① 올려 베는 중
  let s;
  if (rising) s = Math.abs(ux) > 0.2 ? -side(ux) : side(hx); // 올라가는 쪽의 반대가 시작 쪽
  else if (Math.abs(ux) > 0.3) s = side(ux); // ② 그 쪽으로 가는 중
  else s = Math.abs(hx) > 0.1 ? side(hx) : 1; // ③ 멈춰 있음
  const seq = [];
  let at = [hx, hy];
  const push = (t) => {
    seq.push({ kind: 'cut', reach: 0, base: 1, ...t, from: at.slice(), pre: [] });
    at = t.path[t.path.length - 1].slice();
  };
  const fall = (sd, path) => push({ name: sd > 0 ? 'flowFallR' : 'flowFallL', nameKo: sd > 0 ? '오른쪽으로 떨어뜨림 (altibaxo)' : '왼쪽으로 떨어뜨림 (altibaxo de revez)', path, gate: { low: sd }, open: 'H' });
  const rise = (sd, path) => push({ name: sd > 0 ? 'flowTalhoBaixo' : 'flowRevezBaixo', nameKo: sd > 0 ? '올려 탈류 (talho de baxo)' : '올려 레베스 (revez de baxo)', path, gate: { cross: -sd }, open: sd > 0 ? 'LL' : 'LR' }); // 빈틈 = unterhau · unterhauL
  const mid = (sd) => [sd * D.riseMid, -0.08];
  // 첫 토막: 지금 손에서 곧장 (순간이동·멈춤 없음)
  if (rising) {
    rise(s, hy > -0.08 || hx * s < 0 ? [P(D.high, -s)] : [mid(s), P(D.high, -s)]); // 이미 올라가는 중 — 가운데 점을 지났으면 높이 비낌으로 곧장
  } else {
    if (uy < -0.3 || Math.hypot(hx - D.low[s][0], hy - D.low[s][1]) < 0.15) fall(s, [P(D.low, s)]); // 내려 베는 중(또는 이미 아래) — 꺾지 않고 그 쪽 아래로
    else fall(s, [[s * D.fall[0], Math.min(0.1, Math.max(-0.2, hy * 0.5))], P(D.low, s)]); // 옆·멈춤 — 바깥 옆을 돌아 떨어뜨림
    rise(s, [mid(s), P(D.high, -s)]);
  }
  let cur = s;
  for (let i = 1; i < (D.rise ?? 2); i++) {
    const n = -cur;
    fall(n, [[n * D.fall[0], D.fall[1]], P(D.low, n)]); // 앞 토막 끝(높이 비낌, n 쪽)에서 그 쪽으로 떨어뜨려 감고
    rise(n, [mid(n), P(D.high, -n)]); // 거기서 올림
    cur = n;
  }
  // 큰 한 칼: 마지막 올려베기 끝(높이 비낌, c 쪽)에서 머리 위로 넘겨 어깨 뒤로 그 쪽 옆에 떨어뜨리고(피 복Ⅱ 「pass it over the head and behind the shoulders, such that it falls over the left arm」)
  //  몸 가운데 높이로 반대쪽 끝까지 둘러 벤다(circling — 피 복Ⅱ 「circling revez」·단Ⅺ·복Ⅺ 「revez orizontal cingido」 · 고 규칙 9 「in mittlerer Höhe」). 길 = redondo 앞 절반 · zwerch(L) 줄
  const c = -cur;
  push({ name: c > 0 ? 'flowOverR' : 'flowOverL', nameKo: '머리 위로 넘김', path: [[c * D.over[0], D.over[1]], P(D.side, c)], gate: { side: c, behind: true }, open: 'H' });
  push({ name: c > 0 ? 'flowTalhoCingido' : 'flowRevezCingido', nameKo: c > 0 ? '둘러 베는 탈류 (talho cingido)' : '둘러 베는 레베스 (revez cingido)', path: [D.cutMid.slice(), P(D.side, -c)], open: c > 0 ? 'UL' : 'UR' }); // 빈틈 = zwerch · zwerchL
  return seq;
}

/** 흐름 토막 문을 기다리는 최대 (s) — 따라 지나감(손이 끝 자세에 닿은 뒤 칼이 지나가길 기다림)의 바탕 시간과 같은 값 (ai.js follow timer 0.3 · skill.js follow run.t ≥ 0.3).
 *  탐침(tools/sim/iberian_flow_probe.mjs): 0.5 면 막힌 토막에서 칼끝이 0 가까이 멎은 채 0.5 s 씩 서 흐름이 끊겨 보였다(플레이어 2.4~2.7 s) — 0.3 (1.6~1.9 s) */
export const FLOW_GATE_MAX = 0.3;
const _gc = new THREE.Vector3();
const _gr = new THREE.Vector3();
const _gf = new THREE.Vector3();
/**
 * 흐름 토막 문 (montanteFlowSeq 의 gate): 실제 칼끝(물리)이 그 토막의 끝 자리에 갔나 — 몸 기준(가슴 원점), 문턱은 모두 0(가슴 높이 · 몸 가운데 · 가슴 앞뒤):
 *  low: s — 칼끝이 s 쪽(칼 든 쪽 +)이고 가슴보다 아래 (그 쪽으로 떨어졌다) · cross: s — 칼끝이 s 쪽이고 가슴보다 위 (올려 벤 칼이 반대쪽으로 건너갔다) ·
 *  behind(+ side: s) — 칼끝이 가슴보다 뒤(이고 s 쪽) (머리 위로 넘겨 어깨 뒤로 그 쪽에 떨어졌다). AI·플레이어 같은 함수.
 *  그 토막이 상대 몸을 맞혔으면 부른 쪽이 기다리지 않고 넘긴다 — 맞은 칼은 문 자리에 못 가지만 흐름은 멈추지 않는다(피 복Ⅶ 「in each step you must give a blow」).
 *  (칼끼리 닿음으로 넘기는 것은 재 보고 뺐다 — 붙은 거리에선 상대 칼이 늘 곁에 있어 문이 바로 열려 토막이 0.1 s 로 뭉개졌다)
 */
export function flowGate(f, g) {
  const tp = f.tipPrev ?? f.bladePoint(1, _gc);
  const c = f.bodies.chest.translation();
  f.right(_gr);
  f.forward(_gf);
  const rx = tp.x - c.x;
  const ry = tp.y - c.y;
  const rz = tp.z - c.z;
  const lat = f.side * (rx * _gr.x + rz * _gr.z);
  const fw = rx * _gf.x + rz * _gf.z;
  if (g.low != null) return lat * g.low > 0 && ry < 0;
  if (g.cross != null) return lat * g.cross > 0 && ry > 0;
  if (g.behind) return fw < 0 && (g.side == null || lat * g.side > 0);
  return true;
}

/** 내 베기 사건 비기(combo·firstHit)의 거리: 이어 치기 거리 안 (ai.js secretCombo·secretFirstHit 와 같은 식) */
export function chainRange(d, view) {
  return d <= view.reach + 0.1 && d >= view.clinch - 0.5;
}

// ─────────────────────────────────────────────────────────────
//  플레이어 비기 창 (main.js 가 물리 스텝마다 부른다 — 시뮬 도구에는 없다)
//   내 무기 유파의 비기 조건이 차면 SECRET.playerWindow 초 동안 창이 열린다. 그 안에 공격 입력이 오면 main.js 가
//   player.skill.secret(fire()) 로 완벽 실행. 창을 놓치면 보통 공격. 횟수 제한 없음.
//  사건: 상대 사건은 AI 와 같은 눈(Senses — 지금 모습 seen(0))과 같은 함수(secretEvent·secretCond).
//   내 베기 사건은 플레이어 휘두름(skill.swinging 이 켜졌다 꺼진 한 덩이 = 베기 한 번)으로 센다:
//   combo(이베리아) = 쉼(SECRET.playerChainGap 초) 없이 이어진 베기 수 · firstHit(중국) = 쉬었다가 들어가며 친 첫 베기가 맞음(상대 아픔 +0.05 — AI 와 같은 눈, 막힘 제외)
// ─────────────────────────────────────────────────────────────
export class PlayerSecretWatch {
  constructor(me, foe) {
    this.me = me;
    this.foe = foe;
    this.S = playerSecretOf(me);
    this.sense = new Senses(me, foe);
    this.ev = { armed: true, off: 0 };
    this.open = null; // 열린 창 { S, ctx, t }
    this.combo = 0;
    this.binds = new BindCount(); // 이베리아 맺힘 셈 (10/10)
    this.iaiArm = new IaiArm(); // 일본 발도 대기 (10/10 02:4x — 플레이어는 표시만)
    this.gap = Infinity; // 마지막 베기 끝에서 지난 시간
    this.swing = null; // 지금 베기 { first, landed }
    this.prevFoePain = foe.pain;
    this.opened = 0; // 창이 열린 수 (재기)
  }

  /** 판정 쪽 간격 (검술 풀이의 꾸러미 값 — AI 와 같은 수) */
  view() {
    const art = this.me.swordArt;
    const M = art.measure;
    return { reach: M.reach, clinch: M.clinch, contact: M.contact, foeReach: art.measureFor(this.foe.weapon).reach + 0.05, armed: this.iaiArm.armed };
  }

  /** 매 물리 스텝. busy = 플레이어 비기 실행 중(창을 새로 열지 않는다) */
  update(dt, busy) {
    const me = this.me;
    const foe = this.foe;
    this.sense.record(dt);
    if (this.open && (this.open.t -= dt) <= 0) this.open = null;
    const S = this.S;
    const painUp = foe.pain > this.prevFoePain + 0.05;
    this.prevFoePain = foe.pain;
    if (!S || !me.alive || !foe.alive || !me.armed || me.state !== 'stand') {
      this.open = null;
      this.swing = null;
      this.combo = 0;
      this.iaiArm.tick(0, false, true);
      return;
    }
    const c = me.bodies.chest.translation();
    const s0 = this.sense.seen(0);
    const dx = s0.cx - c.x;
    const dz = s0.cz - c.z;
    const d0 = Math.max(0.01, Math.hypot(dx, dz));
    const V = this.view();
    // 내 베기 덩이
    const sw = me.skill.swinging && !busy;
    if (sw && !this.swing) this.swing = { first: this.gap > SECRET.playerChainGap, rest: this.gap, landed: false, bound: false, w0: foe.wounds?.length ?? 0 };
    if (this.swing && painUp) this.swing.landed = true;
    const touch = bladesTouch(me, foe);
    if (this.swing && touch) this.swing.bound = true; // 칼 맞물림 (ai.js checkBind 와 같은 기하)
    if (S.when === 'bindCount') this.binds.tick(dt, touch);
    if (S.do?.instant) this.iaiArm.tick(dt, d0 > V.foeReach, sw || busy);
    if (!sw && this.swing) {
      // 베기 하나가 끝났다
      const w = this.swing;
      this.swing = null;
      this.combo = this.gap > SECRET.playerChainGap ? 1 : this.combo + 1;
      this.gap = 0;
      if (S.when === 'bindCount') {
        this.binds.strike(SECRET.iberianHurt === 'wound' ? (foe.wounds?.length ?? 0) > w.w0 : w.landed, w.bound); // '피해' = 벤 상처(iberianHurt 'wound') 또는 아픔 +0.05
        if (!busy && !this.open && this.binds.ready) this.openWindow(null, SECRET.iberianWindow); // 셋째 맺힘 → 다음 공격 입력이 비기 (창 iberianWindow)
      }
      if (!busy && !this.open && chainRange(d0, V)) {
        if (S.when === 'combo' && this.combo >= SECRET.comboN && (!S.cond?.touch || w.landed || w.bound)) this.openWindow(null); // (10/10 이베리아는 bindCount 로 바뀜 — 옛 길)
        if (S.when === 'firstHit' && firstHitOk(S, w.rest, w.landed, w.bound)) this.openWindow(null);
      }
    } else if (!sw) this.gap += dt;
    if (me.jolt > 0.5) this.combo = 0; // 맞아 흔들림 = 끊김
    if (busy) return;
    // 상대 사건 (AI secretScan 과 같은 꼴: 사건 한 번에 한 번, 0.3 s 그치면 다시 건다)
    const r = me.right(_r);
    const E = this.ev;
    const { on, ctx } = secretEvent(S, this.sense, foe, s0, c, r, d0, V.foeReach, me, { reach: V.reach, dt, st: E }); // ex: 이베리아 호 안쪽 (reach · 머문 시간)
    if (!on) {
      E.off += dt;
      if (E.off > 0.3) E.armed = true;
      return;
    }
    E.off = 0;
    if (!E.armed || s0.state !== 'stand' || this.open) return;
    if (!secretCond(S, ctx, d0, V)) return;
    E.armed = false;
    this.openWindow(ctx);
  }

  openWindow(ctx, t = SECRET.playerWindow) {
    this.open = { S: this.S, ctx, t };
    this.opened++;
  }

  /** 창 안의 공격 입력: 열린 창을 닫고 그 비기 { S, ctx } 를 돌려준다 (없으면 null) */
  fire() {
    const o = this.open;
    this.open = null;
    if (o) {
      this.combo = 0;
      this.binds.reset(); // 비기를 내면 0
    }
    return o;
  }
}

/** 플레이어 무기의 유파 비기 (내 무기 전통 = 검술 풀이 tradition — schoolOf(w.id)). 스위치(SKILL.schoolArt·schoolSecret·playerSecret)가 꺼졌거나 무유파면 null */
export function playerSecretOf(f) {
  if (!(SKILL.schoolArt && SKILL.schoolSecret && SKILL.playerSecret) || f.weapon?.gun) return null;
  return TRADITIONS[f.swordArt?.tradition]?.secret ?? null;
}
