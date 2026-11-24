// ─────────────────────────────────────────────────────────────
//  legs_trace.mjs — 다리 시험 묶음(legs_battery.mjs)의 한 판을 그대로 다시 돌리며 스텝마다 걸음 · 균형 값을 적는다. 재기만 한다.
//
//   node tools/sim/legs_trace.mjs --scene=wander [--weapon=longsword] [--variant=0 | --variants=0-7] [--strength=0.65] [--cfg=GAIT.hFrac:0.9,…] [--rows] [--raw] [--every=6] [--from=-0.5] [--to=99] [--csv=<파일>] [--quiet]
//
//  장면 · 흔들림(판 씨앗 100 + i · 자리 잡는 시간 2.0 + 0.11 i s · 재기 0.5 s 앞 가슴 6 N·s) · 넘어짐 규칙은 legs_battery.mjs 와 같은 식이다
//   (그 도구는 고치지 않는다 — 장면 표를 여기 그대로 옮겨 적었다. 묶음 도구의 넘어진 때와 이 도구의 넘어진 때가 같아야 한다).
//  적는 것(스텝마다): 때 · 다리마다 걸음 꼴(S 딛음 / 걸음 꼴 + 진행 몫) · 무게중심 자리 · 속도 · 캡처 점(무게중심 + 속도 ÷ ω) · 바란 압력 중심 · 실제 압력 중심(발 접촉 충격량으로) ·
//   받침 다각형 여유(캡처 점이 받침 안이면 + · 밖이면 −) · 발 자리 · 내딛는 발 목표 · 골반 · 가슴 기울기와 몸통 각속도 · 골반 높이와 목표 · 바란 땅 반력(N · Fx · Fz · 몸통 토크)과 잘린 거리 · 다리 토크 한도 닿음.
//  요약: 처음 벌어진 일의 차례(이상 징후마다 처음 때) · 걸음 사건(뗌 · 디딤 · 디딤 오차) · 넘어진 때와 까닭.
//  좌표: 앞 · 오른쪽은 그 스텝의 heading 틀(f.forward · f.right). 자리는 무게중심 기준(m).
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
if (args.cfg) { const { applyCfg } = await import(u('tools/sim/cfg_override.mjs')); console.log('덮어씀(재기 전용):', JSON.stringify(applyCfg(String(args.cfg)))); } // config 수 덮어쓰기 (tools/sim/cfg_override.mjs — 이 도구 판에서만)
const H = await import(u('tools/sim/harness_m.mjs'));
let FAM = null;
try { FAM = (await import(u('tools/sim/corr_lib.mjs'))).FAM; } catch { /* 옛 트리 */ }
FAM ||= { diagR: { ch: [0.42, 0.42], end: [-0.4, -0.42], v: 12 }, vert: { ch: [0.02, 0.52], end: [0, -0.5], v: 12 }, horizR: { ch: [0.52, 0.03], end: [-0.52, 0.03], v: 12 } };
const { LEGS, BALANCE, BODY } = H.CONFIG;
const DT = H.DT;
const G9 = 9.81;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ── 아래 장면 표는 legs_battery.mjs 와 글자 그대로 같다 ──
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const stroke = (fam) => {
  const F = FAM[fam];
  return { pre: ({ P }) => P.handOffset.set(F.ch[0], F.ch[1]), step: (ctx) => {
    const { P, state } = ctx; state.tgt ??= F.end; state.hold ??= 0;
    const off = P.handOffset, dx = state.tgt[0] - off.x, dy = state.tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
    if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else { off.set(state.tgt[0], state.tgt[1]); state.hold += DT; if (state.hold > 0.6) { state.hold = 0; state.tgt = state.tgt === F.end ? F.ch : F.end; } }
  } };
};
const wander = (ctx, t) => {
  const s = ctx.state;
  if (s.until == null || t >= s.until) { s.until = t + 0.5 + 0.9 * ctx.R(); if (ctx.R() < 0.25) s.mv = [0, 0]; else { const a = ctx.R() * Math.PI * 2; s.mv = [Math.cos(a), Math.sin(a)]; } }
  ctx.P.move.set(s.mv[0], s.mv[1]);
};
const faceAround = (ctx, ang) => { const p = ctx.P.bodies.pelvis.translation(); ctx.G.faceP = { x: p.x + 60 * Math.cos(ang), y: 1, z: p.z + 60 * Math.sin(ang) }; };
const SCENES = {
  stand: { secs: 8, drive: (i, t, c) => c.P.move.set(0, 0) },
  walk: { secs: 6, drive: (i, t, c) => c.P.move.set(0, 1) },
  back: { secs: 6, drive: (i, t, c) => c.P.move.set(0, -1) },
  strafeR: { secs: 6, drive: (i, t, c) => c.P.move.set(1, 0) },
  strafeL: { secs: 6, drive: (i, t, c) => c.P.move.set(-1, 0) },
  stopgo: { secs: 16, drive: (i, t, c) => { const k = Math.floor(t / 2) % 4, go = t % 2 < 1.2, d = [[0, 1], [0, -1], [1, 0], [-1, 0]][k]; c.P.move.set(go ? d[0] : 0, go ? d[1] : 0); } },
  wander: { secs: 20, drive: (i, t, c) => wander(c, t) },
  turn: { secs: 12, drive: (i, t, c) => { c.P.move.set(0, 0); const k = Math.floor(t / 2); faceAround(c, (k % 2 ? 1 : 0) * (Math.PI / 2) * (k % 4 < 2 ? 1 : -1)); } },
  circle: { secs: 10, drive: (i, t, c) => { c.P.move.set(0.7, 0.5); faceAround(c, 0.6 * t); } },
  kick40: { secs: 5, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; } },
  kick80: { secs: 5, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 80, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; } },
  walkkick: { secs: 6, drive: (i, t, c) => { c.P.move.set(0, 1); if (i === Math.round((1.5 + 1.0 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; } },
};
for (const fam of ['diagR', 'vert', 'horizR']) {
  const S = stroke(fam);
  SCENES['stroke_' + fam] = { secs: 9, pre: S.pre, drive: (i, t, c) => { c.P.move.set(0, 0); S.step(c); } };
  SCENES['walkstroke_' + fam] = { secs: 12, pre: S.pre, drive: (i, t, c) => { wander(c, t); S.step(c); } };
}

// 싸움 꼴 장면 (묶음 도구 physics-2 09eda777 판의 --more 장면과 같은 식): 기술이 부탁한 걸음을 1.6 s 마다 · AI 간격 잡기 꼴 조종
{
  const aiStick = (ctx, t) => {
    const s = ctx.state;
    if (s.until == null || t >= s.until) { s.until = t + 0.2 + 0.5 * ctx.R(); const m = [0, 0.21, 0.45, 0.45, 0.75, 1][Math.floor(ctx.R() * 6)]; const d = [[0, 1], [0, 1], [0, -1], [0, -1], [1, 0], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]][Math.floor(ctx.R() * 10)]; s.mv = [d[0] * m, d[1] * m]; }
    ctx.P.move.set(s.mv[0], s.mv[1]);
    faceAround(ctx, 0.5 * Math.sin(0.7 * t));
  };
  const reqEvery = (kind, o) => (i, t, c) => {
    const s = c.state; s.ph ??= 0.4 + 0.8 * c.R(); const k = (t - s.ph) / 1.6, near = Math.abs(k - Math.round(k)) * 1.6 < 0.3 && t > s.ph - 0.3;
    c.P.move.set(0, near ? 1 : 0.45);
    if (t >= s.ph && Math.floor((t - s.ph) / 1.6) !== s.n) { s.n = Math.floor((t - s.ph) / 1.6); const ok = c.P.gait?.requestStep?.({ kind, ...o }); s.extra = (s.extra ?? 0) + (ok ? 1 : 0); }
  };
  SCENES.slowwalk = { secs: 6, drive: (i, t, c) => c.P.move.set(0, 0.45) };
  SCENES.slowback = { secs: 6, drive: (i, t, c) => c.P.move.set(0, -0.45) };
  SCENES.aistick = { secs: 14, drive: (i, t, c) => aiStick(c, t) };
  SCENES.reqpass = { secs: 10, drive: reqEvery('pass', { fwd: 0.6, duration: 0.4 }) };
  SCENES.reqlunge = { secs: 10, drive: reqEvery('lunge', { fwd: 0.6, duration: 0.4, accel: true }) };
  const S = stroke('diagR');
  SCENES.aistroke_diagR = { secs: 14, pre: S.pre, drive: (i, t, c) => { aiStick(c, t); S.step(c); } };
}

// 묶음에 없는 덧 장면 (자취 도구만): --scene=move --move=x,y [--secs=8] — 조종 입력을 그 값으로 고정 (빠르기 훑기 · 제자리 걸음 살피기)
if (args.move) { const mv = String(args.move).split(',').map(Number); SCENES.move = { secs: +(args.secs ?? 8), drive: (i, t, c) => c.P.move.set(mv[0], mv[1]) }; }

// ── 재는 쪽 ──
const FOOT_HX = 0.12, FOOT_HZ = 0.05, FOOT_HY = 0.035;
const crs = (ox, oz, ax, az, bx, bz) => (ax - ox) * (bz - oz) - (az - oz) * (bx - ox);
/** 점들의 볼록 껍질 (단조 사슬) */
function hull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && crs(lo[lo.length - 2][0], lo[lo.length - 2][1], lo[lo.length - 1][0], lo[lo.length - 1][1], q[0], q[1]) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && crs(up[up.length - 2][0], up[up.length - 2][1], up[up.length - 1][0], up[up.length - 1][1], q[0], q[1]) <= 0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}
/** 점에서 껍질까지 부호 있는 거리: 안이면 + (가장 가까운 변까지) · 밖이면 − */
function margin(h, x, z) {
  if (!h.length) return -9;
  if (h.length === 1) return -Math.hypot(x - h[0][0], z - h[0][1]);
  let inside = h.length >= 3, best = Infinity;
  for (let i = 0; i < h.length; i++) {
    const a = h[i], b = h[(i + 1) % h.length];
    if (h.length >= 3 && crs(a[0], a[1], b[0], b[1], x, z) < 0) inside = false;
    const ex = b[0] - a[0], ez = b[1] - a[1], l2 = ex * ex + ez * ez;
    const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - a[0] - ex * t, z - a[1] - ez * t));
  }
  return inside ? best : -best;
}
const qv = (q, x, y, z) => { // 쿼터니언으로 벡터 돌리기
  const ix = q.w * x + q.y * z - q.z * y, iy = q.w * y + q.z * x - q.x * z, iz = q.w * z + q.x * y - q.y * x, iw = -q.x * x - q.y * y - q.z * z;
  return [ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y, iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z, iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x];
};
const tiltOf = (b) => { const u = qv(b.rotation(), 0, 1, 0); return (Math.acos(Math.max(-1, Math.min(1, u[1]))) * 180) / Math.PI; };

/** 발 하나의 땅 접촉: 법선 충격량 합 ÷ dt (읽기 교정 6/7) 과 그 가운데 점 */
function footContact(world, col) {
  let imp = 0, sx = 0, sz = 0;
  world.contactPairsWith(col, (other) => {
    const b = other.parent();
    if (!b || !b.isFixed()) return;
    world.contactPair(col, other, (m, flipped) => {
      const c1 = flipped ? other : col;
      const t = c1.translation(), r = c1.rotation();
      for (let i = 0, n = m.numContacts(); i < n; i++) {
        const j = m.contactImpulse(i), lp = m.localContactPoint1(i);
        if (!lp || !(j > 0)) continue;
        const w = qv(r, lp.x, lp.y, lp.z);
        imp += j; sx += j * (w[0] + t.x); sz += j * (w[2] + t.z);
      }
    });
  });
  return { N: ((imp / DT) * 6) / 7, x: imp > 0 ? sx / imp : 0, z: imp > 0 ? sz / imp : 0 };
}

function run(scene, weapon, variant, opt = {}) {
  const S = SCENES[scene];
  if (!S) throw new Error('장면 없음: ' + scene + ' (' + Object.keys(SCENES).join(' ') + ')');
  const G = H.newRound({ walls: false, weapon, seed: 100 + variant });
  G.park();
  const P = G.player;
  if (args.strength != null) P.strength = +args.strength; // 인물 힘 몫(재기 전용 — 싸움의 AI 몸은 숙련도 2 '보통' = PROF_BODY.strength 0.65 로 선다 · 묶음 도구의 혼자 장면은 1)
  const R = rng(1000 + variant * 7919);
  const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  const ctx = { G, P, R, state: {}, FAM };
  if (S.pre) S.pre(ctx);
  const n = Math.round(S.secs / DT);
  const rows = [], events = [], first = {}, predErr = [[], []];
  const mark = (k, t, note) => { if (first[k] == null) first[k] = { t: +t.toFixed(3), note }; };
  const D = P.legDrive, GT = P.gait;
  const cols = { F: P.bodies.footF.collider(0), B: P.bodies.footB.collider(0) };
  const prev = { F: { stance: true }, B: { stance: true }, state: 'stand', sat: {}, airFor: 0, outFor: 0, slipFor: { F: 0, B: 0 } };
  const satKeys = ['hipF', 'kneeF', 'ankleF', 'hipB', 'kneeB', 'ankleB'];
  const satOf = () => Object.fromEntries(satKeys.map((k) => [k, D.legs[k.slice(-1)].stat[k.slice(0, -1)].sat]));
  prev.sat = satOf();
  const M = P.totalMass + (P.armed && P.sword ? P.sword.mass() : 0);
  let fell = false, tFall = null, why = null, lowFor = 0;

  const sample = (t) => {
    const fx = Math.cos(P.heading), fz = -Math.sin(P.heading), rx = -fz, rz = fx; // 앞 = f.forward · 오른쪽 = f.right = (−fz, 0, fx)
    const com = P.com, cv = P.comVel;
    if (!com || !cv) return null;
    const w0 = P.capW || 3.3;
    const cpx = com.x + cv.x / w0, cpz = com.z + cv.z / w0;
    const loc = (x, z) => [(x - com.x) * fx + (z - com.z) * fz, (x - com.x) * rx + (z - com.z) * rz];
    const pel = P.bodies.pelvis, pp = pel.translation();
    // 발: 실제 접촉 · 발바닥 네 귀
    const pts = [], foot = {};
    let Nsum = 0, cxs = 0, czs = 0;
    for (const k of ['F', 'B']) {
      const b = P.bodies['foot' + k], t0 = b.translation(), r0 = b.rotation(), v0 = b.linvel();
      const c = footContact(G.world, cols[k]);
      const sole = qv(r0, 0, -FOOT_HY, 0);
      const l = GT.legs[k];
      foot[k] = { N: c.N, x: sole[0] + t0.x, y: sole[1] + t0.y, z: sole[2] + t0.z, vh: Math.hypot(v0.x, v0.z), stance: l.stance, kind: l.kind, u: l.T > 0 ? l.t / l.T : 0, p1x: l.p1.x, p1z: l.p1.z, on: D.legs[k].on };
      if (c.N > 0.02 * M * G9) {
        Nsum += c.N; cxs += c.N * c.x; czs += c.N * c.z;
        for (const [a, bb] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) { const w = qv(r0, a * FOOT_HX, -FOOT_HY, bb * FOOT_HZ); pts.push([w[0] + t0.x, w[2] + t0.z]); }
      }
    }
    const hl = hull(pts);
    const mg = margin(hl, cpx, cpz);
    const copR = Nsum > 0 ? [cxs / Nsum, czs / Nsum] : null;
    const copC = D.copOk ? [D.cop.x, D.cop.z] : null;
    const sat = satOf();
    const satNow = satKeys.filter((k) => sat[k] > prev.sat[k]);
    prev.sat = sat;
    const wT = D.wTrunk;
    const it = P.legIntent;
    const row = {
      t: +t.toFixed(4), st: P.state, walking: GT.walking ? 1 : 0, pend: GT.pend || '',
      legF: foot.F.stance ? 'S' : foot.F.kind[0] + foot.F.u.toFixed(2).slice(1), legB: foot.B.stance ? 'S' : foot.B.kind[0] + foot.B.u.toFixed(2).slice(1),
      vF: cv.x * fx + cv.z * fz, vR: cv.x * rx + cv.z * rz, wantF: it ? it.want.x * fx + it.want.z * fz : 0, wantR: it ? it.want.x * rx + it.want.z * rz : 0,
      comY: com.y, pelY: pp.y, hT: GT.h,
      cp: loc(cpx, cpz), copC: copC ? loc(copC[0], copC[1]) : null, copR: copR ? loc(copR[0], copR[1]) : null, margin: mg,
      footF: loc(foot.F.x, foot.F.z), footB: loc(foot.B.x, foot.B.z), NF: foot.F.N, NB: foot.B.N, Nsum,
      tgt: !foot.F.stance ? loc(foot.F.p1x, foot.F.p1z) : !foot.B.stance ? loc(foot.B.p1x, foot.B.p1z) : null,
      tiltP: tiltOf(pel), tiltC: P.tiltDeg(), wT: Math.hypot(wT.x, wT.z), wY: wT.y,
      N: D.dbg.N, Ff: D.dbg.Fx * fx + D.dbg.Fz * fz, Fr: D.dbg.Fx * rx + D.dbg.Fz * rz, Mp: D.dbg.Mx * rx + D.dbg.Mz * rz, Mr: D.dbg.Mx * fx + D.dbg.Mz * fz, My: D.dbg.My, clip: D.dbg.clipped, capDist: D.capDist,
      swMp: D.swM.x * rx + D.swM.z * rz, swMr: D.swM.x * fx + D.swM.z * fz, pull: D.dbg.pull || 0,
      armMp: D.armM ? D.armM.x * rx + D.armM.z * rz : 0, armMr: D.armM ? D.armM.x * fx + D.armM.z * fz : 0, armMy: D.armM ? D.armM.y : 0, swMy: D.swM.y,
      raw: ['F', 'B'].map((k) => { const w = D.legs[k].raw; return w ? `${w.hx.toFixed(0)},${w.hy.toFixed(0)},${w.hz.toFixed(0)} ${w.k.toFixed(0)} ${w.ax.toFixed(0)},${w.ay.toFixed(0)},${w.az.toFixed(0)}` : ''; }).join(' / '), str: D.strengthOf('F'), lam: D.dbg.lam ?? 1, lamR: D.dbg.lamR ?? 1,
      swErr: (() => { const l = !foot.F.stance ? GT.legs.F : !foot.B.stance ? GT.legs.B : null; return l && l.relOk ? Math.hypot(l.des.x - l.ankle.x, l.des.y - l.ankle.y, l.des.z - l.ankle.z) : 0; })(),
      off: P.offBalance, bal: P.balance, sat: satNow.join('+'),
      yawErr: (() => { const ax = qv(pel.rotation(), 1, 0, 0); const psi = Math.atan2(-ax[2], ax[0]); const want = it ? it.yaw : P.heading; return (Math.atan2(Math.sin(want - psi), Math.cos(want - psi)) * 180) / Math.PI; })(),
      twist: (() => { const a = qv(pel.rotation(), 1, 0, 0), c = qv(P.bodies.chest.rotation(), 1, 0, 0); const d = Math.atan2(-c[2], c[0]) - Math.atan2(-a[2], a[0]); return (Math.atan2(Math.sin(d), Math.cos(d)) * 180) / Math.PI; })(), // 가슴 yaw − 골반 yaw (허리가 실제로 틀어진 각)
      faceErr: (() => { const ft = P.faceTarget; if (!ft) return 0; const ax = qv(pel.rotation(), 1, 0, 0); const psi = Math.atan2(-ax[2], ax[0]); const want = Math.atan2(-(ft.z - pp.z), ft.x - pp.x) + (P.pelvisYawOffset || 0); return (Math.atan2(Math.sin(want - psi), Math.cos(want - psi)) * 180) / Math.PI; })(),
    };
    // 걸음 사건
    for (const k of ['F', 'B']) {
      const f = foot[k];
      if (!f.stance && GT.legs[k].capX != null) (prev[k].caps ||= []).push([f.u, GT.legs[k].capX, GT.legs[k].capZ, GT.legs[k].capCx, GT.legs[k].capCz, GT.legs[k].capVx, GT.legs[k].capVz]);
      if (prev[k].stance && !f.stance) events.push({ t: row.t, ev: `뗌 ${k} ${f.kind} T=${GT.legs[k].T.toFixed(2)} 목표(앞,옆)=${loc(f.p1x, f.p1z).map((x) => x.toFixed(2))} 캡처=${row.cp.map((x) => x.toFixed(2))} 다른 발 하중=${(foot[k === 'F' ? 'B' : 'F'].N / (M * G9)).toFixed(2)}` });
      if (!prev[k].stance && f.stance) {
        const err = Math.hypot(f.x - Math.cos(GT.legs[k].yaw1) * 0 - prev[k].p1x - 0.05 * Math.cos(GT.legs[k].yaw1), f.z - prev[k].p1z + 0.05 * Math.sin(GT.legs[k].yaw1));
        events.push({ t: row.t, ev: `디딤 ${k} ${prev[k].kind} u=${prev[k].u.toFixed(2)} 목표 어긋남=${err.toFixed(3)} 발(앞,옆)=${loc(f.x, f.z).map((x) => x.toFixed(2))} 캡처=${row.cp.map((x) => x.toFixed(2))} 속도(앞,옆)=${row.vF.toFixed(2)},${row.vR.toFixed(2)}` });
        if (err > 0.1) mark('디딤이 목표에서 0.10 m 넘게 어긋남', t, `${k} ${err.toFixed(2)} m`);
        // 내다본 캡처 점(뗄 때 · 가운데 · 끝)이 디딜 때의 실제 캡처 점에서 어긋난 거리 (앞, 옆 — + 면 내다본 것이 더 앞 · 오른쪽)
        const cs = prev[k].caps;
        if (cs && cs.length > 2) {
          const pick = (u) => cs.reduce((a, b) => (Math.abs(b[0] - u) < Math.abs(a[0] - u) ? b : a));
          const d = [0, 0.5, 0.85].map((u) => { const c = pick(u); return `${((c[1] - cpx) * fx + (c[2] - cpz) * fz).toFixed(2)},${((c[1] - cpx) * rx + (c[2] - cpz) * rz).toFixed(2)}`; });
          const c0 = pick(0);
          if (t >= 0) for (const [i, u] of [[0, 0], [1, 0.5]]) { const c = pick(u); predErr[i].push(Math.hypot(c[1] - cpx, c[2] - cpz)); }
          events.push({ t: row.t, ev: `   내다본 캡처 점 − 실제 (앞,옆): 뗄 때 ${d[0]} · 가운데 ${d[1]} · 끝 ${d[2]} | 뗄 때 내다본 무게중심 − 실제 앞 ${((c0[3] - com.x) * fx + (c0[4] - com.z) * fz).toFixed(2)} · 속도 − 실제 앞 ${((c0[5] - cv.x) * fx + (c0[6] - cv.z) * fz).toFixed(2)} 옆 ${((c0[5] - cv.x) * rx + (c0[6] - cv.z) * rz).toFixed(2)}` });
        }
      }
      prev[k] = { stance: f.stance, kind: f.kind, u: f.u, p1x: f.p1x, p1z: f.p1z, caps: f.stance ? null : prev[k].caps };
      // 딛은 발 미끄러짐
      prev.slipFor[k] = f.stance && f.N > 0.1 * M * G9 && f.vh > 0.3 ? prev.slipFor[k] + DT : 0;
      if (prev.slipFor[k] > 0.05) mark('딛은 발이 0.3 m/s 넘게 미끄러짐 (0.05 s)', t, k);
    }
    if (P.state !== prev.state) { events.push({ t: row.t, ev: `상태 ${prev.state} → ${P.state}` }); prev.state = P.state; }
    // 이상 징후 — 처음 때
    if (t >= 0) {
      prev.airFor = Nsum < 0.05 * M * G9 ? prev.airFor + DT : 0;
      if (prev.airFor > 0.08) mark('두 발 모두 땅을 못 누름 (0.08 s)', t);
      prev.outFor = mg < -0.25 ? prev.outFor + DT : 0;
      if (prev.outFor > 0.15) mark('캡처 점이 받침 밖 0.25 m 넘게 (0.15 s)', t, mg.toFixed(2));
      if (mg < -0.45) mark('캡처 점이 받침 밖 0.45 m 넘게', t, mg.toFixed(2));
      if (row.tiltP > 20) mark('골반 기울기 20° 넘음', t, row.tiltP.toFixed(0));
      if (row.tiltC > 30) mark('가슴 기울기 30° 넘음', t, row.tiltC.toFixed(0));
      if (row.tiltC > 45) mark('가슴 기울기 45° 넘음', t, row.tiltC.toFixed(0));
      if (pp.y < GT.h - 0.1) mark('골반이 목표보다 0.10 m 낮음', t, `${pp.y.toFixed(2)} / ${GT.h.toFixed(2)}`);
      if (pp.y < 0.7) mark('골반 0.70 m 아래', t);
      const sp = Math.hypot(cv.x, cv.z), ws = it ? Math.hypot(it.want.x, it.want.z) : 0;
      if (sp > ws + 0.8) mark('무게중심이 가려는 빠르기보다 0.8 m/s 넘게 빠름', t, `${sp.toFixed(2)} / ${ws.toFixed(2)}`);
      if (Math.abs(row.yawErr) > 35) mark('골반 yaw 오차 35° 넘음', t, row.yawErr.toFixed(0));
      if (satNow.length) mark('다리 토크 한도 닿음', t, satNow.join('+'));
      if (P.offBalance > BALANCE.fallRange) mark('offBalance 가 넘어짐 범위 넘음', t, P.offBalance.toFixed(2));
      for (const k of ['F', 'B']) {
        const o = foot[k === 'F' ? 'B' : 'F'];
        if (foot[k].stance && o.stance) { const d = Math.hypot(foot[k].x - o.x, foot[k].z - o.z); if (d > 0.85) mark('두 발 사이 0.85 m 넘음', t, d.toFixed(2)); if (d < 0.12) mark('두 발 사이 0.12 m 아래', t, d.toFixed(2)); }
      }
    }
    return row;
  };

  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); const r = sample((i - settle) * DT); if (r) rows.push(r); }
  for (let i = 0; i < n; i++) {
    S.drive(i, i * DT, ctx);
    // 넘어짐 까닭 (updateState 가 이번 스텝에 볼 값 — 스텝 앞)
    const pre = { tilt: P.tiltDeg() - (P.hunch || 0) * 57.2958, bal: P.balance, obt: P.offBalanceTime, st: P.state };
    G.step();
    const r = sample(i * DT);
    if (r) rows.push(r);
    const y = P.bodies.pelvis.translation().y;
    lowFor = y < 0.5 ? lowFor + DT : 0;
    const st = P.state;
    if (!fell && (st === 'down' || st === 'getup' || st === 'dead' || lowFor > 0.25)) {
      fell = true; tFall = +(i * DT).toFixed(2);
      why = lowFor > 0.25 && st === 'stand' ? '골반 0.5 m 아래 0.25 s (주저앉음)' : pre.tilt > BODY.fallTiltDeg ? `가슴 기울기 ${pre.tilt.toFixed(0)}° > ${BODY.fallTiltDeg}` : pre.obt > BALANCE.fallDelay ? `발 밖으로 벗어난 채 ${pre.obt.toFixed(2)} s (offBalance > ${BALANCE.fallRange})` : pre.bal <= 0 ? '균형 수치 0' : '그 밖(다리가 못 버팀 등)';
      break;
    }
  }
  try { G.world.free(); } catch { /* */ }
  return { scene, weapon, variant, fell, tFall, why, rows, events, first, secs: S.secs, predErr };
}

// ── 찍기 ──
const f2 = (x) => (x == null ? '    -' : (x >= 0 ? ' ' : '') + x.toFixed(2));
const p2 = (v) => (v ? `${f2(v[0])},${f2(v[1])}` : '    -,    -');
function printRows(R, every, from, to) {
  console.log('    때   다리F 다리B 걷 | 속도 앞   옆 (가려는 앞  옆) | 캡처 점 앞,옆 | 바란 압중   | 실제 압중   | 여유  | 발F 앞,옆   | 발B 앞,옆   | 목표 앞,옆  | 하중F 하중B | 골반y  목표 | 기울 골/가 각속 | N   F앞 F옆 M숙임 M옆  My | 내딛: 힘 반작용M 어긋남 | 잘림 | 팔M 숙임 옆 yaw · 내딛 yaw | yaw 오차° 각속 허리 틀림° | 한도  (M숙임 + = 앞으로 숙은 몸통을 세우는 쪽)' + (args.raw ? ' | 자르기 앞 토크 F / B: 엉덩이 x 벌림,y 돌림,z 굽힘 · 무릎 · 발목 x,y,z (한도 = LEGS.limit × 힘 몫)' : ''));
  for (let i = 0; i < R.rows.length; i++) {
    const r = R.rows[i];
    if (r.t < from || r.t > to || i % every) continue;
    console.log(`${r.t.toFixed(3).padStart(7)} ${r.legF.padEnd(5)} ${r.legB.padEnd(5)} ${r.walking}${String(r.pend).padEnd(1)} | ${f2(r.vF)} ${f2(r.vR)} (${f2(r.wantF)} ${f2(r.wantR)}) | ${p2(r.cp)} | ${p2(r.copC)} | ${p2(r.copR)} | ${f2(r.margin)} | ${p2(r.footF)} | ${p2(r.footB)} | ${p2(r.tgt)} | ${(r.NF / 9.81).toFixed(0).padStart(4)} ${(r.NB / 9.81).toFixed(0).padStart(4)}kg | ${r.pelY.toFixed(3)} ${r.hT.toFixed(3)} | ${r.tiltP.toFixed(0).padStart(3)} ${r.tiltC.toFixed(0).padStart(3)} ${r.wT.toFixed(1).padStart(4)} | ${r.N.toFixed(0).padStart(4)} ${r.Ff.toFixed(0).padStart(4)} ${r.Fr.toFixed(0).padStart(4)} ${r.Mp.toFixed(0).padStart(4)} ${r.Mr.toFixed(0).padStart(4)} ${r.My.toFixed(0).padStart(4)} | ${r.pull.toFixed(0).padStart(4)} ${r.swMp.toFixed(0).padStart(4)} ${r.swErr.toFixed(3)} | ${r.clip.toFixed(2)} | ${(r.armMp || 0).toFixed(0).padStart(4)} ${(r.armMr || 0).toFixed(0).padStart(4)} ${(r.armMy || 0).toFixed(0).padStart(4)} ${(r.swMy || 0).toFixed(0).padStart(4)} | ${r.yawErr.toFixed(0).padStart(4)} ${r.wY.toFixed(1).padStart(5)} ${r.twist.toFixed(0).padStart(4)} | ${r.sat}${args.raw ? ' | λ' + r.lam.toFixed(2) + ',' + r.lamR.toFixed(2) + ' ' + r.raw : ''}`);
  }
}
function summary(R) {
  const m = R.rows.filter((r) => r.t >= 0);
  const med = (a) => { if (!a.length) return 0; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
  const out = [`${R.scene} · ${R.weapon} · 흔들림 ${R.variant}: ${R.fell ? `넘어짐 ${R.tFall} s — ${R.why}` : '안 넘어짐'}`];
  out.push(`  가운데값: 속도 ${med(m.map((r) => Math.hypot(r.vF, r.vR))).toFixed(2)} m/s · 가슴 기울기 ${med(m.map((r) => r.tiltC)).toFixed(0)}° (최고 ${Math.max(...m.map((r) => r.tiltC)).toFixed(0)}°) · 골반 기울기 ${med(m.map((r) => r.tiltP)).toFixed(0)}° · 캡처 점 여유 ${med(m.map((r) => r.margin)).toFixed(2)} m (최저 ${Math.min(...m.map((r) => r.margin)).toFixed(2)}) · 골반 높이 최저 ${Math.min(...m.map((r) => r.pelY)).toFixed(2)} · 한 발 디딤 몫 ${(m.filter((r) => r.legF !== 'S' || r.legB !== 'S').length / Math.max(1, m.length)).toFixed(2)} · 걸음 ${R.events.filter((e) => e.t >= 0 && e.ev.startsWith('뗌')).length} 번`);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  out.push(`  내다본 캡처 점 어긋남 평균: 뗄 때 ${mean(R.predErr[0]).toFixed(3)} m · 가운데 ${mean(R.predErr[1]).toFixed(3)} m (걸음 ${R.predErr[0].length}) · 디딤 어긋남 평균 ${mean(R.events.filter((e) => e.t >= 0 && e.ev.startsWith('디딤')).map((e) => +(e.ev.match(/목표 어긋남=([0-9.]+)/)?.[1] ?? 0))).toFixed(3)} m`);
  const fs = Object.entries(R.first).sort((a, b) => a[1].t - b[1].t);
  out.push('  처음 벌어진 차례: ' + (fs.length ? fs.map(([k, v]) => `[${v.t.toFixed(2)}] ${k}${v.note ? ' (' + v.note + ')' : ''}`).join(' → ') : '없음'));
  return out.join('\n');
}

const scene = String(args.scene ?? 'walk'), weapon = String(args.weapon ?? 'longsword');
const vs = args.variants ? (() => { const [a, b] = String(args.variants).split('-').map(Number); const o = []; for (let i = a; i <= (b ?? a); i++) o.push(i); return o; })() : [+(args.variant ?? 0)];
for (const v of vs) {
  const R = run(scene, weapon, v);
  console.log(summary(R));
  if (!args.quiet && vs.length === 1) {
    const from = +(args.from ?? (R.fell ? R.tFall - 2.5 : -0.5)), to = +(args.to ?? 1e9);
    console.log('  걸음 사건:');
    for (const e of R.events) if (e.t >= from && e.t <= to) console.log(`   [${e.t.toFixed(3)}] ${e.ev}`);
    if (args.rows) printRows(R, +(args.every ?? 6), from, to);
  }
  if (args.csv) {
    const keys = Object.keys(R.rows[0]);
    const flat = (x) => (Array.isArray(x) ? x.map((y) => y.toFixed(4)).join(';') : typeof x === 'number' ? +x.toFixed(4) : x ?? '');
    writeFileSync(String(args.csv).replace('%v', v), keys.join(',') + '\n' + R.rows.map((r) => keys.map((k) => flat(r[k])).join(',')).join('\n'));
  }
}
