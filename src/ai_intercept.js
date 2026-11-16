// ─────────────────────────────────────────────────────────────
//  막기 2.0 STEP B — 가로막기 · 덮는 맞받기 (11/17 · config AI_INTERCEPT · 기록 docs/strike/ai_intercept_2026-11-17.md · 기본 끔)
//
//  눈: 위협 읽기와 같은 늦게 본 모습(ai.js update 의 sense.seen — 반응 지연)에서 상대 칼끝 · 타격점(칼날 0.7) 자리와 빠르기만 읽는다.
//   둥근 칼 읽기(AI_ARC — ai.js arcHit)와 같은 순간 회전(ω = (칼끝 − 타격점) × 빠르기 차 ÷ 길이²)으로 칼날 선분(손잡이 끝 0 ~ 칼끝 1)이
//   horizon 까지 지나갈 자리를 물리 세 스텝(1/40 s)마다 내다본다 (AI_ARC 끔이면 점마다 곧은 줄). 칼끝 · 타격점이 내 몸통(어깨 반 너비 ARM.shoulder 0.2 m · 높이 −1.3 ~ 0.75)에 드는 때 = 닿는 때.
//  ① 가로막기 (막기): 손 자리 후보마다 내 칼(손 목표 · 칼끝 방향 = fighter.padCommand · 유파 막기 자리 몸꼴이면 그 몸꼴)이 상대 칼이 쓸고 갈 면을
//   닿는 때보다 먼저 가로지르는가(선분 ↔ 삼각형 둘). 가로지르면 점수 = qual × 질 − 늦음:
//    늦음 = max(0, 반응 지연 + 손 옮김(패드 거리 ÷ 막기 손 빠르기) − 가로지르는 때) · 질 = (1 − |내 자리 − ⅙| − |상대 자리 − ⅚|) × 직각(sin) —
//    ⅙ · ⅚ = 칼을 셋으로 나눈 손잡이 쪽 ⅓(forte) · 끝 ⅓(foible) 의 가운데. 가장 큰 후보로 손을 보낸다 (없으면 옛 정한 자리).
//   후보 = 유파 막기 자리 여섯(그 줄 몸꼴째 — 고르면 막기 줄 defLine 이 그 줄) + 패드 칸(AI_INTERCEPT.grid 간격 · 몸꼴 없이 — icpFree).
//   찌르기(위협 thrust)는 칼이 제 줄을 따라 와 쓸고 가는 면이 없다 — 칼끝이 지나는 줄에서 내 칼이 thrustR 안이면 가로지름 (질 × (1 − 거리 ÷ thrustR)).
//  ② 덮는 맞받기 (Versetzen): 맞받아 베기 칼을 고를 때 — 유파 맞받기 목록(줄마다 모두) + 꾸러미의 베기 — 그 칼 길(지금 손 → 길 점들, 패드 여덟 칸)의 어느 칸이
//   상대 칼 면을 닿는 때 전에 가로지르면 그 칼을 먼저(위 ① 과 같은 질이 큰 것 · 같으면 길에서 이른 것 · 준비 자세가 가까운 것). 준비 자세 0.3 m 안 문은 옛 맞받기와 같다.
//  ③ 덮는 베기 (내 공격 고르기): 내 칼 길이 상대 칼이 지금 있는 자리를 가로지르는 기술의 무게를 띠 기울기만큼 올림 (아래 strikeCoverPrep — 굴림 없음).
//  ① ② 는 띠 기울기만큼 굴림(위협 하나 · 맞받기 하나에 한 번) — 안 나오면 옛 길. 손 · 서보 · 거르기 · 빠르기 · 힘은 그대로.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { AI_INTERCEPT, AI_ARC, PHYSICS, ARM, realS } from './config.js';
import { tiltOf } from './ai_plan.js';
import { padDist } from './ai_techniques.js';

const LINES = ['highL', 'highR', 'highC', 'lowL', 'lowR', 'thrust'];
const H_STEPS = 3; // 길 표본 = 물리 세 스텝 (1/40 s) — 풀이 해상도 (값이 아님)
const NS = 8; // 맞받기 칼 길 표본 칸 — 풀이 해상도
const U_MID = 0.7; // 타격점 = 칼날 0.7 (fighter.js trackBlade 와 같은 자리)
const FORTE = 1 / 6; // 손잡이 쪽 ⅓ 의 가운데
const FOIBLE = 5 / 6; // 끝 ⅓ 의 가운데
// 닿는 때 = 상대 칼끝 · 타격점이 내 몸통(가슴 축에서 어깨 반 너비 ARM.shoulder 0.2 m 안 · 높이 −1.3 ~ 0.75 — 곧은 줄 눈과 같은 높이)에 드는 칸.
//  위협 읽기의 원통(0.55 m)은 칼이 오는지 보는 넉넉한 눈이라 그 안에 내 칼 · 손이 있다 — 가로지름은 그보다 안쪽, 몸에 닿기 전이면 됨
const bodyR2 = () => ARM.shoulder[2] * ARM.shoulder[2];

// ── 상대 칼 길 (늦게 본 모습 한 장에서) ──
const P = { K: 0, h: 0, kHit: 0, b: new Float64Array(0), t: new Float64Array(0) };

/** 상대 칼날 선분(0 = 손잡이 끝 · 1 = 칼끝)이 지나갈 자리 — P.b · P.t (k = 0 … K) · P.kHit = 내 몸통에 처음 드는 칸 (없으면 K) */
export function foePath(s, c) {
  const h = PHYSICS.timestep * H_STEPS;
  const K = Math.max(1, Math.round(AI_ARC.horizon / h));
  if (P.b.length < 3 * (K + 1)) {
    P.b = new Float64Array(3 * (K + 1));
    P.t = new Float64Array(3 * (K + 1));
  }
  P.K = K;
  P.h = h;
  const kb = 1 / (1 - U_MID);
  const ex = s.tx - s.mx, ey = s.ty - s.my, ez = s.tz - s.mz;
  const bx = s.tx - ex * kb, by = s.ty - ey * kb, bz = s.tz - ez * kb; // 손잡이 끝 (칼날 0)
  const dvx = s.tvx - s.mvx, dvy = s.tvy - s.mvy, dvz = s.tvz - s.mvz;
  const e2 = ex * ex + ey * ey + ez * ez;
  let screw = false, ax = 0, ay = 0, az = 0, ox = 0, oy = 0, oz = 0, drift = 0, c1 = 1, s1 = 0;
  if (AI_ARC.on && e2 > 1e-6) {
    const wx = (ey * dvz - ez * dvy) / e2, wy = (ez * dvx - ex * dvz) / e2, wz = (ex * dvy - ey * dvx) / e2;
    const w2 = wx * wx + wy * wy + wz * wz;
    if (w2 >= 1e-9) {
      const wn = Math.sqrt(w2);
      screw = true;
      ax = wx / wn;
      ay = wy / wn;
      az = wz / wn;
      ox = s.mx + (wy * s.mvz - wz * s.mvy) / w2;
      oy = s.my + (wz * s.mvx - wx * s.mvz) / w2;
      oz = s.mz + (wx * s.mvy - wy * s.mvx) / w2;
      drift = s.mvx * ax + s.mvy * ay + s.mvz * az;
      c1 = Math.cos(wn * h);
      s1 = Math.sin(wn * h);
    }
  }
  const vbx = s.tvx - dvx * kb, vby = s.tvy - dvy * kb, vbz = s.tvz - dvz * kb; // 곧은 줄: 칼날 0 의 빠르기 (강체 빠르기 마당을 칼 축으로 늘임)
  let cs = 1, sn = 0;
  const R2 = bodyR2();
  P.kHit = K;
  for (let k = 0; k <= K; k++) {
    const t = k * h;
    const i = 3 * k;
    if (screw) {
      for (let p = 0; p < 2; p++) {
        const qx = (p ? s.tx : bx) - ox, qy = (p ? s.ty : by) - oy, qz = (p ? s.tz : bz) - oz;
        const qa = (qx * ax + qy * ay + qz * az) * (1 - cs) + drift * t;
        const A = p ? P.t : P.b;
        A[i] = ox + qx * cs + (ay * qz - az * qy) * sn + ax * qa;
        A[i + 1] = oy + qy * cs + (az * qx - ax * qz) * sn + ay * qa;
        A[i + 2] = oz + qz * cs + (ax * qy - ay * qx) * sn + az * qa;
      }
      const cn = cs * c1 - sn * s1;
      sn = sn * c1 + cs * s1;
      cs = cn;
    } else {
      P.b[i] = bx + vbx * t;
      P.b[i + 1] = by + vby * t;
      P.b[i + 2] = bz + vbz * t;
      P.t[i] = s.tx + s.tvx * t;
      P.t[i + 1] = s.ty + s.tvy * t;
      P.t[i + 2] = s.tz + s.tvz * t;
    }
    if (P.kHit === K && k > 0) {
      for (let p = 0; p < 2; p++) {
        const w = p ? 1 : U_MID; // 칼끝 · 타격점 (곧은 줄 눈과 같은 두 점)
        const x = P.b[i] + (P.t[i] - P.b[i]) * w - c.x;
        const z = P.b[i + 2] + (P.t[i + 2] - P.b[i + 2]) * w - c.z;
        if (x * x + z * z > R2) continue;
        const y = P.b[i + 1] + (P.t[i + 1] - P.b[i + 1]) * w - c.y;
        if (y < -1.3 || y > 0.75) continue;
        P.kHit = k;
        break;
      }
    }
  }
  return P;
}

// ── 내 칼 선분 ↔ 상대 칼 면 ──
const X = { tau: 0, uMe: 0, uFoe: 0, sin: 0, d: 0 };

/** 선분 (a, a + e) 이 삼각형 v0 v1 v2 를 지나는가 (Möller–Trumbore) → [선분 자리, 무게 1, 무게 2] 또는 null */
const _mt = [0, 0, 0];
function segTri(a, e, A0, i0, A1, i1, A2, i2) {
  const v0x = A0[i0], v0y = A0[i0 + 1], v0z = A0[i0 + 2];
  const e1x = A1[i1] - v0x, e1y = A1[i1 + 1] - v0y, e1z = A1[i1 + 2] - v0z;
  const e2x = A2[i2] - v0x, e2y = A2[i2 + 1] - v0y, e2z = A2[i2 + 2] - v0z;
  const px = e[1] * e2z - e[2] * e2y, py = e[2] * e2x - e[0] * e2z, pz = e[0] * e2y - e[1] * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det;
  const tx = a[0] - v0x, ty = a[1] - v0y, tz = a[2] - v0z;
  const u = (tx * px + ty * py + tz * pz) * inv;
  if (u < 0 || u > 1) return null;
  const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
  const v = (e[0] * qx + e[1] * qy + e[2] * qz) * inv;
  if (v < 0 || u + v > 1) return null;
  const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
  if (tt < 0 || tt > 1) return null;
  _mt[0] = tt;
  _mt[1] = u;
  _mt[2] = v;
  return _mt;
}

/** 선분 둘 (a, a + e) · (p, p + f) 사이 가장 가까운 거리와 두 자리 (Ericson 5.1.9) */
const _sd = [0, 0, 0];
function segSeg(a, e, p, f) {
  const rx = a[0] - p[0], ry = a[1] - p[1], rz = a[2] - p[2];
  const A = e[0] * e[0] + e[1] * e[1] + e[2] * e[2];
  const E = f[0] * f[0] + f[1] * f[1] + f[2] * f[2];
  const F = f[0] * rx + f[1] * ry + f[2] * rz;
  const C = e[0] * rx + e[1] * ry + e[2] * rz;
  const B = e[0] * f[0] + e[1] * f[1] + e[2] * f[2];
  const den = A * E - B * B;
  let s = den > 1e-12 ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0;
  let t = E > 1e-12 ? (B * s + F) / E : 0;
  if (t < 0) {
    t = 0;
    s = A > 1e-12 ? Math.min(1, Math.max(0, -C / A)) : 0;
  } else if (t > 1) {
    t = 1;
    s = A > 1e-12 ? Math.min(1, Math.max(0, (B - C) / A)) : 0;
  }
  const dx = a[0] + e[0] * s - p[0] - f[0] * t, dy = a[1] + e[1] * s - p[1] - f[1] * t, dz = a[2] + e[2] * s - p[2] - f[2] * t;
  _sd[0] = Math.sqrt(dx * dx + dy * dy + dz * dz);
  _sd[1] = s;
  _sd[2] = t;
  return _sd;
}

const _f = [0, 0, 0];
const _p = [0, 0, 0];
/** 내 칼 선분 (a, a + e) 이 상대 칼 면을 kEnd 칸까지 처음 가로지르는 자리 → X (없으면 false). thrust = 찌르기 (칼끝 줄 thrustR) */
function crossFirst(a, e, kEnd, thrust) {
  const { b, t, h } = P;
  for (let k = 1; k <= kEnd; k++) {
    const i0 = 3 * (k - 1), i1 = 3 * k;
    let sig = -1, lam = 0, uMe = 0, d = 0;
    if (thrust) {
      _p[0] = t[i0];
      _p[1] = t[i0 + 1];
      _p[2] = t[i0 + 2];
      _f[0] = t[i1] - t[i0];
      _f[1] = t[i1 + 1] - t[i0 + 1];
      _f[2] = t[i1 + 2] - t[i0 + 2];
      const r = segSeg(a, e, _p, _f);
      if (r[0] < AI_INTERCEPT.thrustR) {
        sig = 1;
        lam = r[2];
        uMe = r[1];
        d = r[0];
      }
    } else {
      let m = segTri(a, e, b, i0, t, i0, t, i1); // (손잡이 끝 앞, 칼끝 앞, 칼끝 뒤): (σ, λ) = (0,0) (1,0) (1,1)
      if (m) {
        uMe = m[0];
        sig = m[1] + m[2];
        lam = m[2];
      } else if ((m = segTri(a, e, b, i0, t, i1, b, i1))) { // (손잡이 끝 앞, 칼끝 뒤, 손잡이 끝 뒤): (0,0) (1,1) (0,1)
        uMe = m[0];
        sig = m[1];
        lam = m[1] + m[2];
      }
    }
    if (sig < 0) continue;
    // 그 때 상대 칼 방향 · 직각
    const fx = t[i0] + (t[i1] - t[i0]) * lam - b[i0] - (b[i1] - b[i0]) * lam;
    const fy = t[i0 + 1] + (t[i1 + 1] - t[i0 + 1]) * lam - b[i0 + 1] - (b[i1 + 1] - b[i0 + 1]) * lam;
    const fz = t[i0 + 2] + (t[i1 + 2] - t[i0 + 2]) * lam - b[i0 + 2] - (b[i1 + 2] - b[i0 + 2]) * lam;
    const cx = e[1] * fz - e[2] * fy, cy = e[2] * fx - e[0] * fz, cz = e[0] * fy - e[1] * fx;
    const nn = Math.sqrt((e[0] * e[0] + e[1] * e[1] + e[2] * e[2]) * (fx * fx + fy * fy + fz * fz));
    X.tau = (k - 1 + lam) * h;
    X.uMe = uMe;
    X.uFoe = sig;
    X.sin = nn > 1e-12 ? Math.sqrt(cx * cx + cy * cy + cz * cz) / nn : 0;
    X.d = d;
    return true;
  }
  return false;
}

// ── 내 칼: 패드 · 몸꼴 → 세상 선분 ──
const _mH = new THREE.Vector3();
const _mD = new THREE.Vector3();
const _a = [0, 0, 0];
const _e = [0, 0, 0];
/** 손 자리 후보 → 내 칼 선분 (_a 칼날 0 · _e 칼날 0 → 1). cover = 막기 자리 몸꼴 { hand, dir } (몸 틀) 이면 그것 */
function myBlade(me, pad, cover, c) {
  const H = _mH;
  const D = _mD;
  if (cover) {
    H.set(cover.hand[0], cover.hand[1], cover.hand[2]);
    D.set(cover.dir[0], cover.dir[1], cover.dir[2]);
  } else me.padCommand(pad[0], pad[1], H, D);
  H.applyQuaternion(me.yaw);
  D.applyQuaternion(me.yaw);
  const hl = me.weaponCfg.hiltLength, bl = me.weaponCfg.bladeLength;
  _a[0] = c.x + H.x + D.x * hl;
  _a[1] = c.y + H.y + D.y * hl;
  _a[2] = c.z + H.z + D.z * hl;
  _e[0] = D.x * bl;
  _e[1] = D.y * bl;
  _e[2] = D.z * bl;
}

/** 후보 목록 (처음 한 번 — 꾸러미 막기 자리 · 몸꼴 · 패드 칸) */
function candidates(ai) {
  if (ai.icpCands) return ai.icpCands;
  const covers = ai.icpCovers ? Object.fromEntries(Object.entries(ai.icpCovers).filter(([k]) => LINES.includes(k)).map(([k, o]) => {
    const el = (o.blade[0] * Math.PI) / 180, az = (o.blade[1] * Math.PI) / 180;
    return [k, { hand: o.hand, dir: [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)] }];
  })) : {};
  const slots = LINES.map((line) => ({ line, pad: (ai.school.parry[line] || ai.school.pose.point).slice(), cover: covers[line] ?? null, free: false }));
  const g = AI_INTERCEPT.grid;
  const grid = [];
  const n = Math.floor(0.6 / g + 1e-9);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const pad = [i * g, j * g];
    if (Math.hypot(pad[0], pad[1]) > 0.6 + 1e-9) continue;
    if (slots.some((q) => !q.cover && padDist(q.pad, pad) < 1e-6)) continue;
    grid.push({ line: null, pad, cover: null, free: true });
  }
  return (ai.icpCands = { slots, grid });
}

/** 띠 기울기 굴림 (k = AI_INTERCEPT.aim · counter) — 몫이 0 이면 굴리지 않음 · 1 이상이면 늘 */
function roll(ai, k) {
  const p = k * tiltOf(ai.proficiency ?? 2);
  return p >= 1 || (p > 0 && Math.random() < p);
}

/** ① 막기로 정한 때 (respond · 패시브 막기): 이 막기를 가로막기로 할지 한 번 굴림 */
export function icpArm(ai) {
  ai.icpPad = null;
  ai.icpFree = false;
  ai.icp = !!ai.me.armed && roll(ai, AI_INTERCEPT.aim);
  const S = (ai.stats.icp ??= icpStats());
  S.arm++;
  if (ai.icp) S.on++;
}

export function icpStats() {
  return { arm: 0, on: 0, aim: 0, none: 0, free: 0, slot: 0, lineChange: 0, late: 0, cvTry: 0, cvPick: 0, cvSame: 0, stPick: 0, stCover: 0 };
}

/**
 * ① 막는 동안 매 스텝 (위협이 보일 때): 늦게 본 모습 s 로 상대 칼 길을 내다보고 가장 좋은 손 자리 → ai.icpPad · ai.icpFree · (막기 자리면) ai.defLine.
 *  가로지르는 후보가 없으면 손대지 않는다(앞 겨눔 · 없으면 옛 정한 자리). 돌려줌: 겨눴으면 true
 */
export function icpAim(ai, s, th) {
  const me = ai.me;
  const c = me.bodies.chest.translation();
  foePath(s, c);
  const kEnd = P.kHit;
  const L = ai.level;
  const lag = L.reaction + realS(0.04) * ai.anger; // ai.js update 의 sense.seen 지연과 같은 셈
  const spd = Math.max(1e-3, L.parrySpeed);
  const hx = me.handOffset.x, hy = me.handOffset.y;
  const { slots, grid } = candidates(ai);
  const thrust = !!th.thrust;
  let best = null, bestS = -Infinity, bestLate = 0, bestLine = null;
  const judge = (q, line) => {
    myBlade(me, q.pad, q.cover, c);
    if (!crossFirst(_a, _e, kEnd, thrust)) return;
    const travel = Math.hypot(q.pad[0] - hx, q.pad[1] - hy) / spd;
    const late = Math.max(0, lag + travel - X.tau);
    let Q = Math.max(0, 1 - Math.abs(X.uMe - FORTE) - Math.abs(X.uFoe - FOIBLE)) * X.sin;
    if (thrust) Q *= 1 - X.d / AI_INTERCEPT.thrustR;
    const sc = AI_INTERCEPT.qual * Q - late;
    if (sc > bestS) {
      bestS = sc;
      best = q;
      bestLate = late;
      bestLine = line;
    }
  };
  // 읽은 줄의 막기 자리를 먼저 (같은 점수면 그 줄)
  for (const q of slots) if (q.line === th.line) judge(q, q.line);
  for (const q of slots) if (q.line !== th.line) judge(q, q.line);
  for (const q of grid) judge(q, th.line);
  const S = (ai.stats.icp ??= icpStats());
  if (!best) {
    S.none++;
    return false;
  }
  S.aim++;
  if (bestLate > 0) S.late++;
  if (best.free) S.free++;
  else S.slot++;
  if (bestLine !== ai.defLine) S.lineChange++;
  ai.icpPad = best.pad;
  ai.icpFree = best.free;
  ai.defLine = bestLine;
  return true;
}

/**
 * ② 덮는 맞받기 (Versetzen): 맞받아 벨 칼(유파 맞받기 목록 모두 + 꾸러미 베기) 가운데 그 칼 길이 상대 칼 면을 닿기 전에 가로지르는 것 — 질(①과 같은 셈)이 큰 것 · 같으면 길에서 이른 것 · 준비 자세가 가까운 것.
 *  굴림이 안 나오거나 그런 칼이 없으면 null (옛 맞받기 고르기 그대로). hand = 지금 손 패드
 */
export function coverTech(ai, th, hand) {
  if (!roll(ai, AI_INTERCEPT.counter)) return null;
  const s = ai.lastSeen;
  if (!s) return null;
  const me = ai.me;
  const c = me.bodies.chest.translation();
  foePath(s, c);
  const kEnd = P.kHit;
  const S = (ai.stats.icp ??= icpStats());
  S.cvTry++;
  const names = (ai.icpCounterNames ??= [...new Set([...Object.values(ai.school.counter ?? {}).flat(), ...ai.school.tech.filter((t) => t.kind === 'cut').map((t) => t.name)])]);
  const thrust = !!th.thrust;
  let best = null, bestQ = -1, bestSig = Infinity, bestD = Infinity;
  const pad = [0, 0];
  for (const n of names) {
    const t = ai.techNow(ai.school.techByName[n]);
    if (!t) continue;
    const cd = padDist(hand, t.from);
    if (!(cd < 0.3)) continue; // 옛 맞받기와 같은 문 (준비 자세가 너무 멀면 제때 못 친다)
    // 길 = 지금 손 → 길 점들 · 길이 따라 NS 칸
    const pts = [hand, ...t.path];
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += padDist(pts[i - 1], pts[i]);
    if (!(total > 1e-6)) continue;
    for (let j = 1; j <= NS; j++) {
      let want = (total * j) / NS;
      let i = 1;
      for (; i < pts.length - 1; i++) {
        const seg = padDist(pts[i - 1], pts[i]);
        if (want <= seg) break;
        want -= seg;
      }
      const a = pts[i - 1], b = pts[i];
      const seg = padDist(a, b) || 1;
      const k = Math.min(1, want / seg);
      pad[0] = a[0] + (b[0] - a[0]) * k;
      pad[1] = a[1] + (b[1] - a[1]) * k;
      myBlade(me, pad, null, c);
      if (!crossFirst(_a, _e, kEnd, thrust)) continue;
      const sig = j / NS;
      let Q = Math.max(0, 1 - Math.abs(X.uMe - FORTE) - Math.abs(X.uFoe - FOIBLE)) * X.sin;
      if (thrust) Q *= 1 - X.d / AI_INTERCEPT.thrustR;
      if (Q > bestQ || (Q === bestQ && (sig < bestSig || (sig === bestSig && cd < bestD)))) {
        best = t;
        bestQ = Q;
        bestSig = sig;
        bestD = cd;
      }
      break;
    }
  }
  if (best) S.cvPick++;
  return best;
}

// ── ③ 덮는 베기 (내 공격 고르기 — 11/17 '공격과 막기 통합'): 상대 칼이 지금 있는 자리(늦게 본 모습 — 자세의 칼은 느려 늦게 봐도 거의 그 자리)를
//  내 칼 길(준비 자세 → 길 점들, 패드 여덟 칸)이 쓸고 가는 면이 가로지르면, 그 기술을 고를 무게를 1 + strike × 띠 기울기 × 질(① 과 같은 셈)로 —
//  몸만 보고 베던 칼이 상대 칼 줄을 지나 들어가게(마주 친 칼이 칼끼리 만나 막기 2.0 겨루기에 들게). 굴림을 더하지 않는다(무게만)
const _sb = new Float64Array(3 * (NS + 1)); // 내 칼 길 표본: 칼날 0
const _st = new Float64Array(3 * (NS + 1)); // 칼끝
const _fa = [0, 0, 0];
const _fe = [0, 0, 0];
const _pp = [0, 0];
const _fw = new THREE.Vector3();
/** 고르기 한 번에 한 번: 상대 칼 선분(늦게 본 모습) · 기울기 → 준비물 (안 쓰면 null) */
export function strikeCoverPrep(ai, s) {
  if (!(AI_INTERCEPT.strike > 0) || !s || s.armed === false || !ai.me.armed) return null;
  const k = AI_INTERCEPT.strike * tiltOf(ai.proficiency ?? 2);
  if (!(k > 0)) return null;
  const kb = 1 / (1 - U_MID);
  const ex = s.tx - s.mx, ey = s.ty - s.my, ez = s.tz - s.mz;
  _fa[0] = s.tx - ex * kb;
  _fa[1] = s.ty - ey * kb;
  _fa[2] = s.tz - ez * kb;
  _fe[0] = ex * kb;
  _fe[1] = ey * kb;
  _fe[2] = ez * kb;
  // 칠 때는 내딛는다 — 내 가슴을 칼이 닿는 거리(M.contact)까지 앞으로 옮겨 놓고 본다 (내 걸음 뜻 · 지금 거리 어림 ai.d)
  const c = ai.me.bodies.chest.translation();
  const f = ai.me.forward(_fw);
  const step = Math.max(0, (ai.d ?? 0) - (ai.M?.contact ?? 0));
  return { k, c: { x: c.x + f.x * step, y: c.y, z: c.z + f.z * step } };
}
/** 그 기술의 칼 길이 상대 칼을 가로지르는 질 0 ~ 1 (안 가로지르면 0) */
export function strikeCoverQ(ai, prep, t) {
  if (!prep || !t?.path?.length || t.kind === 'thrust') return 0;
  const me = ai.me;
  const pts = [t.from, ...t.path];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += padDist(pts[i - 1], pts[i]);
  if (!(total > 1e-6)) return 0;
  for (let j = 0; j <= NS; j++) {
    let want = (total * j) / NS;
    let i = 1;
    for (; i < pts.length - 1; i++) {
      const seg = padDist(pts[i - 1], pts[i]);
      if (want <= seg) break;
      want -= seg;
    }
    const a = pts[i - 1], b = pts[i];
    const k = Math.min(1, want / (padDist(a, b) || 1));
    _pp[0] = a[0] + (b[0] - a[0]) * k;
    _pp[1] = a[1] + (b[1] - a[1]) * k;
    myBlade(me, _pp, null, prep.c);
    const q = 3 * j;
    _sb[q] = _a[0];
    _sb[q + 1] = _a[1];
    _sb[q + 2] = _a[2];
    _st[q] = _a[0] + _e[0];
    _st[q + 1] = _a[1] + _e[1];
    _st[q + 2] = _a[2] + _e[2];
    if (j === 0) continue;
    const i0 = q - 3, i1 = q;
    let m = segTri(_fa, _fe, _sb, i0, _st, i0, _st, i1); // 내 칼 면: (σ, λ) = (0,0) (1,0) (1,1)
    let uMe;
    if (m) uMe = m[1] + m[2];
    else if ((m = segTri(_fa, _fe, _sb, i0, _st, i1, _sb, i1))) uMe = m[1];
    else continue;
    const uFoe = m[0];
    // 직각: 그 칸 내 칼 방향 ↔ 상대 칼
    const dx = _st[i1] - _sb[i1], dy = _st[i1 + 1] - _sb[i1 + 1], dz = _st[i1 + 2] - _sb[i1 + 2];
    const cx = dy * _fe[2] - dz * _fe[1], cy = dz * _fe[0] - dx * _fe[2], cz = dx * _fe[1] - dy * _fe[0];
    const nn = Math.sqrt((dx * dx + dy * dy + dz * dz) * (_fe[0] * _fe[0] + _fe[1] * _fe[1] + _fe[2] * _fe[2]));
    const sin = nn > 1e-12 ? Math.sqrt(cx * cx + cy * cy + cz * cz) / nn : 0;
    return Math.max(0, 1 - Math.abs(uMe - FORTE) - Math.abs(uFoe - FOIBLE)) * sin;
  }
  return 0;
}
