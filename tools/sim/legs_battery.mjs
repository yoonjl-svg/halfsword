// ─────────────────────────────────────────────────────────────
//  legs_battery.mjs — 다리 시험 묶음 (물리 2.0 · docs/strike/physics2_proto_round1_2026-11-24.md §6-1). 재기만 한다.
//
//   node tools/sim/legs_battery.mjs [--root=<트리>] [--n=8] [--offset=0] [--weapons=longsword,rapier,zweihander] [--only=stand,walk,…] [--more] [--holes] [--fights=8] [--fightWeapons=a,b,…] [--secs=30] [--json=<파일>] [--quiet] [--runs] [--nohonesty] [--stick0]
//   --more = 부를 때만 도는 장면(MORE) 전부 · --holes = 그 가운데 구멍 메우기 장면(HOLES — 11/24 저녁 · 기록 docs/strike/physics2_notes/s7_battery_holes.md)만. 기본 묶음(19 장면 · 합계 432)은 그대로.
//   --runs = 판마다 한 줄(통과 · 넘어진 때 · 셈 — 왜 실패했나 볼 때). 구멍 메우기 장면은 줄 끝에 그 장면의 확인 셈(그 일이 일어난 판 수)이 붙는다.
//
//  왜: 혼자 장면 한 번의 통과 · 넘어짐은 작은 차이로 뒤집힌다(시제품 셋 모두의 보고). 장면마다 시작 흔들림과 때를 바꿔 n 번 돌려 '안 넘어진 몫'으로 본다.
//  흔들림: 판 씨앗 · 자리 잡는 시간(2.0 s + 0.11 s × i) · 재기 0.5 s 앞에 가슴을 6 N·s 로 한 번 침(방향 137.5° × i). 모두 결정적 — 같은 인자면 같은 값.
//  넘어짐: 상태가 down · getup · dead · kneel 이 되거나, 골반이 0.5 m 아래로 0.25 s 넘게 내려가거나(서 있음인 채 주저앉음), 가슴이 60° 넘게 0.25 s 기울어짐(넘어짐 규칙을 지워도 잡히게).
//  통과: 안 넘어짐 + 시킨 일을 함 — 걷기류는 시킨 쪽으로 평균 빠르기 바닥(걷기 0.6 · 뒷걸음 0.4 · 옆걸음 0.25 m/s — 목표의 절반), 가다 서다 · 떠돌기 · 돌며 걷기는 걸은 길이 바닥, 돌기는 바라볼 쪽 오차 30° 안.
//  정직 먼저 (감사 11/24 대조 4): 이 도구는 구실만 잰다 — 숨은 받침을 다시 넣은 몸도 통과한다. 그래서 맨 앞에 같은 나무를 honesty.mjs 장부로 한 번 재서(서기 · 걷기) 몸 밖 관절 · 받침 · 밀기 · 쓰기 · 지문을 찍는다.
//  관문 판정은 짓는 동안 안 쓴 흔듦 묶음으로: --offset=100 --n=24 (기본 0 · 8 은 짓는 쪽 용).
//  일어서기(getup): 통과 = 정말 쓰러졌다(선 상태를 떠남) + 쓰러진 뒤 stand 로 돌아와 버틴 창(2 s + AID.after — 선언된 도움이 끝난 뒤 2 s 까지) 내내 선 상태 · 골반이 쓰러지기 앞 선 높이의 65 % 위 · 가슴 기울기 45° 안.
//   '일어선 때' = 쓰러진 뒤 상태가 stand 가 된 때(s — 그 선 상태로 버틴 창을 채운 판만). 줄 끝: 쓰러진 판 수 · 버틴 창이 시작된 때(서자마자 몸이 낮거나 기울어 있으면 일어선 때보다 늦다) · 그 창의 골반 최저 · 기울기 최고.
//  다시 판정한 부를 때만 장면 (11/24 검토 · 줄 끝에 그 셈이 붙는다):
//   reqpass · reqlunge · lungecut · passcut — 받은 부탁(requestStep 이 true)이 아니라 실제로 뜬 걸음: 받은 뒤 1 s 안에 kind 'req' 걸음이 뜬 부탁 3 번 넘게. 런지 둘(reqlunge · lungecut)은 그 절반 넘게를 앞발이 디뎌야 한다. 줄 끝 = 받은 부탁 · 뜬 걸음(앞발 · 뒷발) · 그 발이 앞으로 간 거리 가운데값.
//   aistroke_diagR — 걸은 길이 아니라 조종 따르기: 대본이 건 조종 쪽으로 골반이 실제로 간 거리 합 1.0 m 넘게 (제자리에서 베기만 하는 몸은 0 언저리). --stick0 = 조종을 0 으로 묶어 이 판정이 실패하는지 보는 검증용.
//   slowwalk · slowback — 시킨 쪽 빠르기 0.38 ~ 1.2 · 0.25 ~ 0.85 m/s (지금 게임 값의 절반 ~ 1.5 배 · 예전 바닥 0.15 · 0.1 · 천장 없음).
//  싸움: AI 대 AI. '스스로 넘어짐' = 넘어지기 앞 1.5 s 안에 받은 상처가 없는 넘어짐. 일어섬 = 넘어진 뒤 stand 로 돌아와 2 s 버팀.
//  이 도구는 몸에 시험 충격(가슴 치기)만 건다. Fighter 의 공개 칸(move · handOffset · state · faceTarget)만 쓰므로 어느 트리에도 --root 로 돌 수 있다.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const N = +(args.n ?? 8);
const WEAPONS = String(args.weapons ?? 'longsword,rapier,zweihander').split(',');
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const STRENGTH = args.strength != null ? +args.strength : null; // --strength=0.65: 혼자 장면을 그 인물 힘 몫으로 (싸움 장면에는 안 걸림 — 싸움은 게임이 정한 값 그대로)
const FIGHTS = +(args.fights ?? 8), FSECS = +(args.secs ?? 30), OFFSET = +(args.offset ?? 0);
const FW = String(args.fightWeapons ?? WEAPONS[0]).split(',');

const H = await import(u('tools/sim/harness_m.mjs'));
let FAM = null;
try { FAM = (await import(u('tools/sim/corr_lib.mjs'))).FAM; } catch { /* 옛 트리 */ }
FAM ||= { diagR: { ch: [0.42, 0.42], end: [-0.4, -0.42], v: 12 }, vert: { ch: [0.02, 0.52], end: [0, -0.5], v: 12 }, horizR: { ch: [0.52, 0.03], end: [-0.52, 0.03], v: 12 } };
const DT = H.DT;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

/** 가슴을 J N·s 로 한 번 친다. ang = 몸 앞(골반 +x) 기준 각(rad) — 0 이면 뒤에서 앞으로 밂 */
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  // 골반 +x 의 수평 방향
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const comOf = (P) => { const t = P.bodies.pelvis.translation(); return { x: t.x, y: t.y, z: t.z }; };
/** 골반 앞(+x)의 수평 단위 벡터 */
const fwdOf = (P) => { const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y), l = Math.hypot(fx, fz) || 1; return { x: fx / l, z: fz / l }; };

/** 대본 상대 (두 몸 장면): AI 없이 가만히 선 몸 — 장면이 E.scriptMove = [옆, 앞] 을 두면 그 스틱으로 걷는다(move · stickX · stickY 를 AI 처럼 같이 둠) */
class Dummy { constructor(me) { this.me = me; this.stats = {}; } update() { const m = this.me.scriptMove; this.me.move.set(m ? m[0] : 0, m ? m[1] : 0); this.me.stickX = m ? m[0] : 0; this.me.stickY = m ? m[1] : 0; } }
/** 혼자 장면 한 번. drive(i, t, ctx) 가 스텝마다 입력을 건다. 돌려줌: { fell, tFall, sat, speed, net, tiltMax, tipMax, yMin, extra }
 *  opt (없으면 예전 그대로): duo = 두 몸 판의 처음 간격 m 또는 (무기) => m (상대 = Dummy · 멀리 치우지 않음 · ctx.E) · round = newRound 인자 덧붙임 · settle = 자리 잡는 시간 s (기본 2.0) ·
 *   low = 주저앉음으로 보는 골반 높이 m (기본 0.5) · tilt = 넘어짐으로 보는 가슴 기울기 ° (기본 60) — 일부러 웅크리는 장면(줍기 · 런지 자세)만 바꿈 ·
 *   terrain = (variant) => { x, z, heading } 지형 무대(화산섬 비탈) 판의 시작 자리 — 골반 높이는 그 자리 땅 위로 잰다 */
function solo(weapon, variant0, secs, drive, opt = {}) {
  const variant = variant0 + OFFSET;
  const G = opt.terrain ? terrainRound({ weapon, seed: 100 + variant, ...opt.terrain(variant) }) : H.newRound({ walls: false, weapon, seed: 100 + variant, ...(opt.duo ? { AIClass: Dummy, gap: typeof opt.duo === 'function' ? opt.duo(weapon) : opt.duo } : {}), ...(opt.round || {}) });
  if (!opt.duo) G.park();
  const P = G.player;
  if (STRENGTH != null) P.strength = STRENGTH; // 인물 힘 몫(숙련도 칸 — 싸움의 AI '보통' 몸은 0.65 · 혼자 장면 기본은 1)
  const R = rng(1000 + variant * 7919);
  const settle = Math.round(((opt.settle ?? 2.0) + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  const ctx = { G, P, E: opt.duo ? G.enemy : null, R, state: {}, FAM };
  const LOW = opt.low ?? 0.5, TILT = opt.tilt ?? 60;
  if (opt.pre) opt.pre(ctx);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt && !opt.noNudge) hitChest(P, 6, variant * 2.39996); G.step(); }
  const c0 = comOf(P), n = Math.round(secs / DT);
  let fell = false, tFall = null, sat = false, lowFor = 0, tiltFor = 0, path = 0, cp = c0, tiltMax = 0, tipMax = 0, yMin = Infinity, half = null;
  const fwd0 = fwdOf(P);
  for (let i = 0; i < n; i++) {
    drive(i, i * DT, ctx);
    G.step();
    const c = comOf(P);
    path += Math.hypot(c.x - cp.x, c.z - cp.z); cp = c;
    if (i === (n >> 1)) half = { c, path };
    const gy = P.terrain ? P.terrain.heightAt(c.x, c.z) : 0; // 지형 무대: 그 자리 땅 위 높이로 (평지는 0)
    yMin = Math.min(yMin, c.y - gy);
    lowFor = c.y - gy < LOW ? lowFor + DT : 0;
    const st = P.state;
    const tl = P.tiltDeg(); tiltFor = tl > TILT ? tiltFor + DT : 0;
    if (!fell && (st === 'down' || st === 'getup' || st === 'dead' || st === 'kneel' || lowFor > 0.25 || tiltFor > 0.25)) { fell = true; tFall = +(i * DT).toFixed(2); sat = st === 'stand'; }
    if (!fell) { tiltMax = Math.max(tiltMax, P.tiltDeg()); const tv = P.tipVel; if (tv) tipMax = Math.max(tipMax, Math.hypot(tv.x, tv.y, tv.z)); }
    if (fell && !opt.keepGoing) break;
  }
  const net = Math.hypot(cp.x - c0.x, cp.z - c0.z);
  const speed2 = half ? Math.hypot(cp.x - half.c.x, cp.z - half.c.z) / (secs / 2) : 0; // 뒤쪽 절반의 곧은 빠르기
  // 시킨 쪽으로 간 평균 빠르기 (재기 시작 때의 몸 앞 · 오른쪽 기준 — 장면 전체 시간으로 나눔)
  const dx = cp.x - c0.x, dz = cp.z - c0.z, along = { f: (dx * fwd0.x + dz * fwd0.z) / secs, r: (dx * -fwd0.z + dz * fwd0.x) / secs };
  const out = { fell, tFall, sat, net: +net.toFixed(3), speed: +speed2.toFixed(3), alongF: +along.f.toFixed(3), alongR: +along.r.toFixed(3), path: +path.toFixed(2), tiltMax: +tiltMax.toFixed(1), tipMax: +tipMax.toFixed(2), yMin: +yMin.toFixed(3), extra: ctx.state.extra ?? null, headErr: ctx.state.headErr ?? null, aux: ctx.state.aux ?? null, chk: ctx.state.chk ?? null };
  try { G.world.free(); } catch { /* */ }
  return out;
}

// ── 입력 꼴 ──
const stroke = (fam) => {
  const F = FAM[fam];
  return { pre: ({ P }) => P.handOffset.set(F.ch[0], F.ch[1]), step: (ctx) => {
    const { P, state } = ctx; state.tgt ??= F.end; state.hold ??= 0;
    const off = P.handOffset, dx = state.tgt[0] - off.x, dy = state.tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
    if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else { off.set(state.tgt[0], state.tgt[1]); state.hold += DT; if (state.hold > 0.6) { state.hold = 0; state.tgt = state.tgt === F.end ? F.ch : F.end; } }
  } };
};
const wander = (ctx, t) => { // 0.5 ~ 1.4 s 마다 걷는 쪽을 바꾼다 (넷에 하나는 멈춤)
  const s = ctx.state;
  if (s.until == null || t >= s.until) { s.until = t + 0.5 + 0.9 * ctx.R(); if (ctx.R() < 0.25) s.mv = [0, 0]; else { const a = ctx.R() * Math.PI * 2; s.mv = [Math.cos(a), Math.sin(a)]; } }
  ctx.P.move.set(s.mv[0], s.mv[1]);
};
const faceAround = (ctx, ang) => { const p = ctx.P.bodies.pelvis.translation(); ctx.G.faceP = { x: p.x + 60 * Math.cos(ang), y: 1, z: p.z + 60 * Math.sin(ang) }; };

const SCENES = {
  stand: { secs: 8, drive: (i, t, c) => c.P.move.set(0, 0), ok: (r) => !r.fell && r.net < 0.3 },
  walk: { secs: 6, drive: (i, t, c) => c.P.move.set(0, 1), ok: (r) => !r.fell && r.alongF >= 0.6, speed: true },
  back: { secs: 6, drive: (i, t, c) => c.P.move.set(0, -1), ok: (r) => !r.fell && -r.alongF >= 0.4, speed: true },
  strafeR: { secs: 6, drive: (i, t, c) => c.P.move.set(1, 0), ok: (r) => !r.fell && Math.abs(r.alongR) >= 0.25 && Math.abs(r.alongR) > Math.abs(r.alongF), speed: true },
  strafeL: { secs: 6, drive: (i, t, c) => c.P.move.set(-1, 0), ok: (r) => !r.fell && Math.abs(r.alongR) >= 0.25 && Math.abs(r.alongR) > Math.abs(r.alongF), speed: true },
  stopgo: { secs: 16, drive: (i, t, c) => { const k = Math.floor(t / 2) % 4, go = t % 2 < 1.2, d = [[0, 1], [0, -1], [1, 0], [-1, 0]][k]; c.P.move.set(go ? d[0] : 0, go ? d[1] : 0); }, ok: (r) => !r.fell && r.path >= 3 },
  wander: { secs: 20, drive: (i, t, c) => wander(c, t), ok: (r) => !r.fell && r.path >= 4 },
  turn: { secs: 12, drive: (i, t, c) => { c.P.move.set(0, 0); const k = Math.floor(t / 2), ang = (k % 2 ? 1 : 0) * (Math.PI / 2) * (k % 4 < 2 ? 1 : -1); faceAround(c, ang); if (t % 2 > 2 - 1.5 * DT) { const f0 = fwdOf(c.P), e = Math.abs(Math.atan2(Math.sin(Math.atan2(f0.z, f0.x) - ang), Math.cos(Math.atan2(f0.z, f0.x) - ang))) * 180 / Math.PI; c.state.headErr = Math.max(c.state.headErr ?? 0, e); } }, ok: (r) => !r.fell && r.headErr != null && r.headErr <= 30 }, // 2 s 마다 바라볼 쪽이 90° 바뀜 — 창 끝마다 골반 앞이 그 쪽 30° 안
  circle: { secs: 10, drive: (i, t, c) => { c.P.move.set(0.7, 0.5); faceAround(c, 0.6 * t); }, ok: (r) => !r.fell && r.path >= 3 }, // 걸으며 바라보는 쪽이 돈다
  kick40: { secs: 5, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, ok: (r) => !r.fell },
  kick80: { secs: 5, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 80, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, ok: (r) => !r.fell },
  walkkick: { secs: 6, drive: (i, t, c) => { c.P.move.set(0, 1); if (i === Math.round((1.5 + 1.0 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, ok: (r) => !r.fell },
};
for (const fam of ['diagR', 'vert', 'horizR']) {
  const S = stroke(fam);
  SCENES['stroke_' + fam] = { secs: 9, pre: S.pre, drive: (i, t, c) => { c.P.move.set(0, 0); S.step(c); }, ok: (r) => !r.fell, tip: true };
  SCENES['walkstroke_' + fam] = { secs: 12, pre: S.pre, drive: (i, t, c) => { wander(c, t); S.step(c); }, ok: (r) => !r.fell && r.path >= 2, tip: true };
}
// ── 싸움 꼴 장면 (11/24 — 싸움에서 16 몸 모두 6 ~ 13 s 에 처음 넘어짐: 그 앞 1.4 s 에 있던 것 = AI 간격 잡기 조종(크기 0 · 0.21 · 0.45 · 1 이 0.2 ~ 0.7 s 마다 바뀜) · 기술이 부탁한 걸음(pass · lunge 0.3 ~ 0.6 m))
//    기본 묶음에는 안 든다(앞 판과 합계를 견줄 수 있게) — --more 를 주거나 --only 에 이름을 적으면 돈다.
const aiStick = (ctx, t) => { // AI 간격 잡기 꼴 조종: 0.2 ~ 0.7 s 마다 크기 · 쪽을 바꿈 (앞뒤가 옆보다 잦음) · 바라보는 쪽은 천천히 흔들림
  const s = ctx.state;
  if (s.until == null || t >= s.until) { s.until = t + 0.2 + 0.5 * ctx.R(); const m = [0, 0.21, 0.45, 0.45, 0.75, 1][Math.floor(ctx.R() * 6)]; const d = [[0, 1], [0, 1], [0, -1], [0, -1], [1, 0], [-1, 0], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]][Math.floor(ctx.R() * 10)]; s.mv = [d[0] * m, d[1] * m]; }
  if (STICK0) ctx.P.move.set(0, 0); else ctx.P.move.set(s.mv[0], s.mv[1]);
  faceAround(ctx, 0.5 * Math.sin(0.7 * t));
};
const footXZ = (P, k) => { const p = P.bodies['foot' + k].translation(); return { x: p.x, z: p.z }; };
/** 부탁 걸음 따라가기 (스텝마다 부름 — 재기만): 받은 부탁마다 ① 1 s 안에 kind 'req' 걸음이 실제로 떴나 ② 뜬 발이 앞발인가(뜨기 바로 앞 스텝의 두 발 자리를 몸 앞쪽으로 견줌 — 다리 이름표 F · B 가 아니라 자리) ③ 그 발이 디딜 때까지 몸 앞쪽(뜰 때의 골반 앞)으로 간 거리.
 *  state.rq = { open: 아직 안 뜬 부탁을 받은 때, n: 뜬 수, front · rear: 앞발 · 뒷발 수, tr: 간 거리들 } — 받은 수(requestStep 이 true 를 돌려준 수)는 예전 그대로 state.extra */
const reqTrack = (c, t) => {
  const g = c.P.gait, q = (c.state.rq ??= { open: null, pk: {}, fp: null, sw: {}, n: 0, front: 0, rear: 0, tr: [] });
  if (!g?.legs) return q;
  const pos = { F: footXZ(c.P, 'F'), B: footXZ(c.P, 'B') }, f = fwdOf(c.P);
  for (const k of ['F', 'B']) {
    const l = g.legs[k], cur = l.stance ? null : l.kind;
    if (cur === 'req' && q.pk[k] !== 'req' && q.open != null && t - q.open <= 1 + 1e-9) { // 이 발이 부탁 걸음으로 막 떴다
      const o = k === 'F' ? 'B' : 'F', a = q.fp ?? pos, front = (a[k].x - a[o].x) * f.x + (a[k].z - a[o].z) * f.z >= 0;
      q.n++; if (front) q.front++; else q.rear++;
      q.sw[k] = { p0: a[k], f }; q.open = null;
    }
    if (cur == null && q.sw[k]) { const w = q.sw[k]; q.tr.push(+((pos[k].x - w.p0.x) * w.f.x + (pos[k].z - w.p0.z) * w.f.z).toFixed(3)); q.sw[k] = null; }
    q.pk[k] = cur;
  }
  if (q.open != null && t - q.open > 1) q.open = null; // 1 s 안에 안 뜬 부탁은 버림 (받는 척만 한 부탁)
  q.fp = pos;
  return q;
};
const reqEvery = (kind, o) => (i, t, c) => { // 1.6 s 마다 기술 걸음을 부탁 (걷는 조종 0.45 앞 · 부탁 앞뒤 0.3 s 는 조종 1 — AI 가 베며 내딛는 꼴)
  const s = c.state; s.ph ??= 0.4 + 0.8 * c.R(); const k = (t - s.ph) / 1.6, near = Math.abs(k - Math.round(k)) * 1.6 < 0.3 && t > s.ph - 0.3;
  c.P.move.set(0, near ? 1 : 0.45);
  const q = reqTrack(c, t);
  if (t >= s.ph && Math.floor((t - s.ph) / 1.6) !== s.n) { s.n = Math.floor((t - s.ph) / 1.6); const ok = c.P.gait?.requestStep?.({ kind, ...o }); s.extra = (s.extra ?? 0) + (ok ? 1 : 0); if (ok) q.open = t; }
  s.aux = q.n; s.chk = { front: q.front, rear: q.rear, tr: q.tr };
};
/** 부탁 걸음 장면의 통과 (11/24 검토 — 예전에는 requestStep 이 true 를 돌려준 수만 셌다: 받는 척만 하고 안 딛는 몸도 통과): 안 넘어짐 + 받은 부탁 가운데 실제로 뜬 걸음 3 번 넘게.
 *  런지 장면(lunge)은 뜬 걸음의 절반 넘게를 앞발이 디뎌야 한다 (지금 게임의 런지 = 앞발이 0.6 m 쯤 나감 · 뒷발이 지나 딛으면 pass 다) */
const reqDid = (lunge) => (r) => !r.fell && (r.aux ?? 0) >= 3 && (!lunge || 2 * (r.chk?.front ?? 0) >= (r.aux ?? 0));
const sum = (a) => a.reduce((x, y) => x + y, 0);
const REQJ = { // 줄 끝 · JSON 에 붙는 셈: 받은 부탁 · 실제로 뜬 걸음(앞발 · 뒷발) · 그 발이 앞으로 간 거리 가운데값
  more: (rs) => ({ reqAccepted: sum(rs.map((r) => r.extra ?? 0)), reqStepped: sum(rs.map((r) => r.aux ?? 0)), reqFront: sum(rs.map((r) => r.chk?.front ?? 0)), reqRear: sum(rs.map((r) => r.chk?.rear ?? 0)), reqTravel: med(rs.flatMap((r) => r.chk?.tr ?? [])) }),
  tail: (x) => ` · 받은 부탁 ${x.reqAccepted} · 실제로 뜬 부탁 걸음 ${x.reqStepped} (앞발 ${x.reqFront} · 뒷발 ${x.reqRear}) · 그 발이 앞으로 간 거리 가운데값 ${f(x.reqTravel)} m`,
};
const STICK0 = !!args.stick0; // 판정 검증용: aistick · aistroke 장면의 조종을 0 으로 묶는다(조종을 무시하는 몸 흉내 — 판정은 대본의 조종으로 그대로 함)
/** 조종 따르기 (스텝마다 조종을 정하기 앞에 부름 — 재기만): 앞 스텝에 대본이 건 조종 쪽(그때의 골반 앞 · 오른쪽 기준)으로 골반이 실제로 간 거리를 더한다.
 *  state.fol = { d: 조종 쪽으로 간 거리 합 m, on: 조종이 0 이 아니던 시간 s } — 제자리에서 베며 흔들리는 몸은 d 가 0 언저리, 조종을 따라 걷는 몸만 쌓인다. 조종을 정한 뒤 followSet 으로 그 스텝의 조종을 적어 둔다 */
const stickFollow = (c) => {
  const p = pelOf(c.P), F = (c.state.fol ??= { d: 0, on: 0, p: null, f: null, mv: null });
  if (F.p && F.mv) { const m = Math.hypot(F.mv[0], F.mv[1]); if (m > 0) { F.d += ((p.x - F.p.x) * (F.f.x * F.mv[1] - F.f.z * F.mv[0]) + (p.z - F.p.z) * (F.f.z * F.mv[1] + F.f.x * F.mv[0])) / m; F.on += DT; } }
  F.p = { x: p.x, z: p.z }; F.f = fwdOf(c.P); F.mv = null;
  return F;
};
const FOLLOW_MIN = 1.0; // 조종 쪽으로 간 거리 바닥(m · 14 s). 잰 값(흔듦 0 ~ 7 · 세 무기 24 판): 지금 게임 1.65 ~ 5.69 m (무기별 가운데값 2.9 ~ 3.8) · 조종을 0 으로 묶은 같은 몸 −0.28 ~ 0.39 m (걸은 길은 1.3 ~ 2.8 m — 옛 판정은 24 판 가운데 7 판을 통과시킴)
const MORE = {
  // 느린 걷기 · 뒷걸음 (조종 0.45): 바닥 = 지금 게임 값(0.73 ~ 0.84 · 0.48 ~ 0.56 m/s)의 절반쯤 · 천장 = 1.5 배쯤 — 너무 느린 몸도, 조종보다 훨씬 빨리 미끄러지는 몸도 통과가 아니다 (11/24 검토: 예전 바닥 0.15 · 0.1 은 게임 값의 1/5 · 천장 없음)
  slowwalk: { secs: 6, drive: (i, t, c) => c.P.move.set(0, 0.45), ok: (r) => !r.fell && r.alongF >= 0.38 && r.alongF <= 1.2, speed: true },
  slowback: { secs: 6, drive: (i, t, c) => c.P.move.set(0, -0.45), ok: (r) => !r.fell && -r.alongF >= 0.25 && -r.alongF <= 0.85, speed: true },
  aistick: { secs: 14, drive: (i, t, c) => aiStick(c, t), ok: (r) => !r.fell && r.path >= 2 },
  reqpass: { secs: 10, drive: reqEvery('pass', { fwd: 0.6, duration: 0.4 }), ok: reqDid(false), ...REQJ },
  reqlunge: { secs: 10, drive: reqEvery('lunge', { fwd: 0.6, duration: 0.4, accel: true }), ok: reqDid(true), ...REQJ },
};
// 베며 AI 조종 따르기: 통과 = 안 넘어짐 + 조종 쪽으로 실제로 간 거리 FOLLOW_MIN 넘게 (11/24 검토 — 예전 '걸은 길 2 m' 는 제자리에서 베기만 해도 골반 흔들림으로 채워졌다)
for (const fam of ['diagR']) { const S = stroke(fam); MORE['aistroke_' + fam] = { secs: 14, pre: S.pre, drive: (i, t, c) => { const F = stickFollow(c); aiStick(c, t); F.mv = [c.state.mv[0], c.state.mv[1]]; c.state.aux = +F.d.toFixed(3); S.step(c); }, ok: (r) => !r.fell && (r.aux ?? 0) >= FOLLOW_MIN, tip: true, more: (rs) => ({ follow: med(rs.map((r) => r.aux ?? 0)), followMin: Math.min(...rs.map((r) => r.aux ?? 0)) }), tail: (x) => ` · 조종 쪽으로 간 거리 가운데값 ${f(x.follow)} m (가장 작은 판 ${f(x.followMin)} · 바닥 ${FOLLOW_MIN})${STICK0 ? ' · 조종 0 으로 묶음(--stick0)' : ''}` }; }
// 베며 내딛기 (AI 의 공격 들어가기 꼴 — 부탁 걸음과 베기가 겹침): 남은 첫 넘어짐 16 가운데 11 이 lunge · pass 부탁 + 다가가는 중, 끝에서 가슴이 골반보다 15 ~ 30° 더 숙어 있었음
for (const [nm, kind] of [['lungecut', 'lunge'], ['passcut', 'pass']]) { const S = stroke('diagR'), Rq = reqEvery(kind, { fwd: 0.6, duration: 0.4, accel: kind === 'lunge' }); MORE[nm] = { secs: 10, pre: S.pre, drive: (i, t, c) => { Rq(i, t, c); S.step(c); }, ok: reqDid(kind === 'lunge'), tip: true, ...REQJ }; }
// ── 구멍 메우기 장면 (11/24 저녁 — docs/strike/physics2_notes/s7_battery_holes.md): 세 사람이 읽어 낸 '몸을 움직이는데 장면이 없던 것'. 모두 MORE(부를 때만) · --holes 면 이 묶음만.
//    원칙 ① 게임이 쓰는 그 들머리를 그대로 부른다(gait.requestStep · takeStep · deDigAi · skill.thrust · stickY(밀치기) · runReach(뛰기) · applyWound · sever · knockDown · die · pickupPress · ringThrow · requestInstant …).
//         ② 그 일이 실제로 일어났는지 센다(extra = 첫째 셈 · aux = 둘째 셈 · chk = 그 밖의 표시) — 가만히 서 있거나 거절된 부탁은 통과가 아님.
//         ③ 두 몸 장면(opt.duo): 상대는 대본 몸(Dummy). 재는 것은 늘 시험받는 몸(P)의 넘어짐.
//    공정함: 지금 게임이 세 무기 모두 7/8 넘게 통과한 장면만 남김 (뺀 것 · 까닭은 위 기록 §2).
let CFG = {}; try { CFG = await import(u('src/config.js')); } catch { /* */ }
const opt_ = async (p) => { try { return await import(u(p)); } catch { return {}; } };
const SI = await opt_('src/secret_instant.js'), DD = await opt_('src/de_dirty.js'), AO = await opt_('src/arena_obstacle.js');
const PUSH = CFG.SECRET?.stepPush ?? 2, V3 = (x = 0, y = 0, z = 0) => new H.THREE.Vector3(x, y, z);
const pelOf = (P) => P.bodies.pelvis.translation();
/** 골반의 땅 위 높이 (지형 무대는 그 자리 땅 높이를 뺌) */
const hOf = (P) => { const p = P.bodies.pelvis.translation(); return p.y - (P.terrain ? P.terrain.heightAt(p.x, p.z) : 0); };
const FM = await opt_('src/fighter.js'), CM = await opt_('src/combat.js'), LK = await opt_('src/looks.js'), TG = await opt_('src/etna_ground.js'), GM = await opt_('src/gait.js');
/** 지형 무대(화산섬 비탈 — 평균 10° · 굴곡 · src/etna_ground.js) 판: harness_m.newRound 와 같은 차례로 세우되 바닥 = createTerrainGround · 몸에 terrain 을 넘김 (main.js newRound 의 지형 갈래 · tools/sim/jelly_harness.mjs 와 같음).
 *  상대는 멀리(z −25) 세워 두고 AI 없음 · 용암 화상은 걸지 않음(땅만 봄) · 바라볼 곳 = 시작 방향 앞 100 m */
function terrainRound(o) {
  H.seedRandom(o.seed);
  const RAPIER = H.RAPIER, T = TG.ETNA_TERRAIN, world = new RAPIER.World({ x: 0, y: CFG.PHYSICS.gravity, z: 0 });
  world.timestep = DT; world.integrationParameters.numSolverIterations = 6;
  const eventQueue = new RAPIER.EventQueue(true), colliderInfo = new Map(), scene = new H.THREE.Scene();
  const env = TG.createTerrainGround(RAPIER, world, FM.GROUND_GROUPS, T, { radius: CFG.ARENA.radius, walls: false });
  GM.setSupportFloor(world, env.floor);
  const player = new FM.Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: o.x, z: o.z, heading: o.heading, terrain: T, look: LK.LOOKS.player, weapon: o.weapon, breakSeed: o.seed });
  const enemy = new FM.Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: 0, z: -25, heading: Math.PI, terrain: T, look: LK.LOOKS.enemy, weapon: o.weapon, breakSeed: o.seed });
  player.skill.level = 0.7;
  const combat = new CM.Combat(colliderInfo, { onWound: () => {}, onClash: () => {} });
  const G = { world, eventQueue, player, enemy, combat, t: 0, parkEnemy: true, clashes: 0, wounds: [], faceP: { x: o.x + 100 * Math.cos(o.heading), y: 1, z: o.z - 100 * Math.sin(o.heading) } };
  G.step = () => { player.foe = null; enemy.foe = null; player.faceTarget = G.faceP; enemy.faceTarget = player.bodies.pelvis.translation(); enemy.move.set(0, 0); if (G.before) G.before(G.t); player.step(DT); enemy.step(DT); player.cacheState(); enemy.cacheState(); world.step(eventQueue, combat.physicsHooks); combat.afterStep(world, eventQueue); G.t += DT; };
  G.park = () => {};
  return G;
}
const stickTo = (P, x, y) => { P.move.set(x, y); P.stickX = x; P.stickY = y; }; // AI · 사람 길이 같이 두는 두 칸 (move = 걷기 · stickX/Y = 밀치기 · 뛰기가 읽는 스틱)
/** 뗀 걸음을 kind 별로 센다 (스텝마다 부름 — gait.legs[k].stance · kind 는 옛 · 새 나무 모두 있는 칸): state.sw = { walk, req, draw, catch, settle } */
const countSteps = (c) => { const g = c.P.gait, s = c.state; if (!g?.legs) return; s.sw ??= {}; s.pk ??= {}; for (const k of ['F', 'B']) { const l = g.legs[k], cur = l.stance ? null : l.kind; if (cur && cur !== s.pk[k]) s.sw[cur] = (s.sw[cur] ?? 0) + 1; s.pk[k] = cur; } };
const every = (c, t, period, t0, fn, key = 'k') => { const k = Math.floor((t - t0) / period); if (t >= t0 && k !== c.state[key]) { c.state[key] = k; fn(k); } };
/** 기술 걸음을 부탁하고 받은 수를 센다 (extra). take = 뜬 발 이어받기(takeStep) */
const ask = (c, o, take) => { const g = c.P.gait, ok = !!(take ? g?.takeStep?.(o) : g?.requestStep?.(o)); c.state.extra = (c.state.extra ?? 0) + (ok ? 1 : 0); return ok; };
/** 통과: 안 넘어짐 + 부탁을 n 번 넘게 받음 + 받은 부탁이 (마지막 하나 빼고) 실제 걸음으로 뜸 */
const reqOk = (n) => (r) => !r.fell && (r.extra ?? 0) >= n && (r.aux ?? 0) >= (r.extra ?? 0) - 1;
const REQ = { cnt: '받은 부탁', auxName: '뜬 부탁 걸음' };
/** 상처 (combat.strike 가 부르는 그 함수 · 출혈 값은 그 부위 ANATOMY) */
const wound = (P, part, zone, severity, energy = 40, bleed = CFG.ANATOMY?.[zone]?.bleed ?? 0.015) => P.applyWound({ part, zone, type: 'cut', severity, energy, local: V3(), bleedPerSev: bleed, dir: V3(1, 0, 0) });
/** 토막을 J N·s 로 한 번 침 (몸 앞 기준 각 ang) */
const hitPart = (P, part, J, ang) => { const f = fwdOf(P), c = Math.cos(ang), s = Math.sin(ang); P.bodies[part].applyImpulse({ x: (f.x * c - f.z * s) * J, y: 0, z: (f.z * c + f.x * s) * J }, true); };
/** 골반의 몸 앞쪽 빠르기 (m/s — 뒤로 가면 음수) */
const vFwd = (P) => { const v = P.bodies.pelvis.linvel(), f = fwdOf(P); return v.x * f.x + v.z * f.z; };
const HOLES = {};

// ─ 기술 걸음의 빠진 꼴 ─
// 선 채(조종 0) 받은 부탁이 실제로 발을 떼는가 (사람 선 채 찌르기 탭 · 폼멜 걸음 · 줍기 걸음 · AI 後の先 — skill.js:319 · 544 · pickup.js:153 · ai.js:4106)
HOLES.idlereq = { secs: 10, ...REQ, drive: (i, t, c) => { const s = c.state; c.P.move.set(0, 0); countSteps(c); s.ph ??= 0.3 + 0.6 * c.R(); every(c, t, 2.4, s.ph, (k) => ask(c, { kind: k % 2 ? 'pass' : 'lunge', fwd: 0.6 })); s.aux = s.sw?.req ?? 0; }, ok: reqOk(3) };
/** 선 채 시작하는 기술 걸음: period 마다 그 스텝부터 hold s 동안만 스틱 앞 y, 같은 스텝에 부탁 (AI 가 간 보다 치는 첫 걸음 · 사람 선 채 베기 — ai.js:4696 · skill.js:1455) */
const standReq = (mk, y = 0.5, hold = 0.3, period = 2.5) => (i, t, c) => { const s = c.state; s.ph ??= 0.3 + 0.6 * c.R(); const v = t - s.ph, on = v >= 0 && v % period < hold; c.P.move.set(0, on ? y : 0); countSteps(c); every(c, t, period, s.ph, (k) => ask(c, mk(c, k))); s.aux = s.sw?.req ?? 0; };
HOLES.standpass = { secs: 10, ...REQ, drive: standReq(() => ({ kind: 'pass', fwd: 0.6, hold: 0.3 })), ok: reqOk(3) };
HOLES.standlunge = { secs: 10, ...REQ, drive: standReq(() => ({ kind: 'lunge', fwd: 0.6, hold: 0.3 })), ok: reqOk(3) };
// 몸이 실리는 찌르기 런지 (push 2 — 선 몸의 탭 찌르기 · AI 찌르기: 이탈리아는 잰 런지 0.6 까지, 다른 유파는 걸음 사다리 0.45 · 0.3 s — skill.js:319-322 · ai.js:4692-4696) · 스틱은 탭이 덮는 0.63 을 0.25 s
HOLES.thrustlunge = { secs: 10, ...REQ, drive: standReq((c) => (c.P.swordArt?.tradition === 'italian' ? { kind: 'lunge', fwd: 0.6, hold: 0.3, push: PUSH } : { kind: 'lunge', fwd: 0.45, hold: 0.3, duration: 0.3, push: PUSH }), 0.63, 0.25), ok: reqOk(3) };
// 런지를 딛고 스틱을 놓은 채 섬 (벌어진 자세로 선 몸 — 닿지 않는 발 · 뜬 발 받아 딛기 가지): 걷다 lunge 0.6 → 디딜 무렵 스틱 0
const lungeStop = (i, t, c) => { const s = c.state; s.ph ??= 0.2 + 0.5 * c.R(); const v = t - s.ph; c.P.move.set(0, v >= 0 && v % 2.5 < 0.9 ? 0.6 : 0); countSteps(c); every(c, t, 2.5, s.ph + 0.45, () => ask(c, { kind: 'lunge', fwd: 0.6, duration: 0.35 })); s.aux = s.sw?.req ?? 0; };
HOLES.lungestop = { secs: 10, ...REQ, drive: lungeStop, ok: reqOk(3) };
{ const S = stroke('diagR'); HOLES.lungestopcut = { secs: 10, ...REQ, pre: S.pre, drive: (i, t, c) => { lungeStop(i, t, c); S.step(c); }, ok: reqOk(3), tip: true }; }
// 큰 런지 + 런지 자세 (이탈리아 비기 '거침없이 나아가 찌르기' — schools.js:690 · secret_instant.js startLunge): 앞발 0.9 m · 0.35 s · push 2 · 골반 0.22 m 낮춤. 스틱은 AI 공격 꼴(−0.21 → 벨 때 0.3 s 동안 1)
HOLES.biglunge = { secs: 10, ...REQ, opt: { low: 0.4 }, drive: (i, t, c) => { const s = c.state; s.ph ??= 0.5 + 0.6 * c.R(); const v = t - s.ph; c.P.move.set(0, v >= 0 && v % 2.4 < 0.3 ? 1 : -0.21); countSteps(c); every(c, t, 2.4, s.ph, () => { SI.startLunge?.(c.P); ask(c, { kind: 'lunge', fwd: CFG.SECRET?.italianStep ?? 0.9, side: 0, duration: 0.35, push: PUSH }); }); if ((c.P.secretStance?.drop ?? 0) > 0.15) (s.chk ??= {}).low = 1; s.aux = s.sw?.req ?? 0; }, ok: (r) => reqOk(3)(r) && !!r.chk?.low };
// 리솔루토 꼴 (안다레 리솔루토 — config risolutoStep · skill.js:1012): 선 채 런지 0.9 · push 2 · accel → 0.7 s 뒤 앞발을 뒤로 되돌림(lunge fwd −0.5 · accel). 부탁 둘이 한 벌
HOLES.risoluto = { secs: 10, ...REQ, drive: (i, t, c) => { const s = c.state; c.P.move.set(0, 0); countSteps(c); s.ph ??= 0.3 + 0.5 * c.R(); every(c, t, 3, s.ph, () => ask(c, { kind: 'lunge', fwd: CFG.SECRET?.italianStep ?? 0.9, side: 0, duration: 0.35, push: PUSH, accel: true }), 'k1'); every(c, t, 3, s.ph + 0.7, () => ask(c, { kind: 'lunge', fwd: -0.5, side: 0, duration: 0.4, push: PUSH, accel: true }), 'k2'); s.aux = s.sw?.req ?? 0; }, ok: reqOk(5) };
// 옆 몫이 있는 기술 걸음 (비껴 딛기 — ai.js techStepRequest 와 같은 셈: 비껴 가는 쪽 발이 앞발이면 lunge 아니면 pass · 스틱 옆 1 · 앞 0.3 → 뒤 −0.21)
HOLES.sidereq = { secs: 10, ...REQ, drive: (i, t, c) => { const s = c.state, P = c.P; s.ph ??= 0.5 + 0.6 * c.R(); const v = t - s.ph, k = Math.floor(v / 2.2), w = v - k * 2.2, sg = k % 2 ? -1 : 1; if (v >= 0 && w < 0.4) P.move.set(sg, 0.3); else if (v >= 0 && w < 0.9) P.move.set(0, -0.21); else P.move.set(0, 0.3); countSteps(c); every(c, t, 2.2, s.ph, (kk) => { const lat = kk % 2 ? -0.45 : 0.45, g = P.gait, lead = Math.sign(g.legs[g.frontLeg(P.forward(V3()))].side) === Math.sign(lat); ask(c, { kind: lead ? 'lunge' : 'pass', fwd: 0.45, side: lat, duration: 0.35 }); }); s.aux = s.sw?.req ?? 0; }, ok: reqOk(3) };
// 그 밖의 꼴: 뒤로 딛기(retreat — AI 後の先) · 옆 몸 빼기 · 비스듬한 런지(push 2) · 런지 되돌아오기(lunge fwd 음수 · accel — skill.js:1012) — 선 채 2 s 마다 차례로
HOLES.reqmix = { secs: 10, ...REQ, drive: (i, t, c) => { const s = c.state; c.P.move.set(0, 0); countSteps(c); s.ph ??= 0.3 + 0.5 * c.R(); const Q = [{ kind: 'retreat', fwd: -0.45, side: 0, duration: 0.3 }, { kind: 'retreat', fwd: 0, side: 0.3, duration: 0.35 }, { kind: 'lunge', fwd: 0.3, side: -0.3, duration: 0.3, push: PUSH }, { kind: 'lunge', fwd: -0.4, side: 0, duration: 0.4, push: PUSH, accel: true }]; every(c, t, 2, s.ph, (k) => ask(c, { ...Q[k % 4] })); s.aux = s.sw?.req ?? 0; }, ok: reqOk(4) };
// 뒷발 끌어붙임(draw) · follow 안 pass → lunge 바꿈(passAs) — AI 베기 걸음 cutStep(ai.js:4683-4688). 두 몸(상대 3 m): 앞 0.35 ↔ 뒤 0.35 로 느리게, 앞 구간 0.3 s 째에 lunge·draw 와 pass 를 번갈아. 끌어붙임 · passAs 셈은 그 칸이 있는 유파(세 무기 가운데 레이피어)만 통과에 넣음
HOLES.drawstep = { secs: 12, ...REQ, auxName: '끌어붙인 걸음', opt: { duo: 3.0 }, drive: (i, t, c) => { const s = c.state, v = t % 2, g = c.P.gait, K = (s.chk ??= {}); K.dr = !!(g?.P?.cutStep?.draw || g?.P?.passAs?.draw); c.P.move.set(0, v < 1 ? 0.35 : -0.35); countSteps(c); every(c, t, 2, 0.3, (k) => { const pass = k % 2 === 1; if (ask(c, pass ? { kind: 'pass', fwd: 0.6, hold: 0.3 } : { kind: 'lunge', fwd: 0.45, hold: 0.3, draw: true }) && pass && g.follow && g.req?.kind === 'lunge') K.passAs = (K.passAs ?? 0) + 1; }); if (g?.follow) K.follow = (K.follow ?? 0) + 1; s.aux = s.sw?.draw ?? 0; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 4 && (!r.chk?.dr || ((r.aux ?? 0) >= 3 && (r.chk.passAs ?? 0) >= 1)) };
// 뜬 발 이어받기 (takeStep — 겹치기 앞 박차기 secret_instant.js dupBurstStart): 걷는 중 발이 뜬 스텝에 그 걸음을 0.22 s 런지로 바꿈 (force · minT) — 몸 미끄러짐은 없이 발 쪽만
HOLES.takestep = { secs: 10, ...REQ, auxName: '이어받은 걸음', drive: (i, t, c) => { const s = c.state, P = c.P, g = P.gait; P.move.set(0, 0.45); s.ph ??= 1 + 0.5 * c.R(); const k = Math.floor((t - s.ph) / 2); if (t >= s.ph && k !== s.k && g?.legs) { const sw = !g.legs.F.stance ? g.legs.F : !g.legs.B.stance ? g.legs.B : null; if (sw && sw.kind === 'walk' && sw.t < 0.5 * sw.T) { s.k = k; if (ask(c, { kind: 'lunge', fwd: 0.4, duration: 0.22, minT: 0.22, accel: true, force: true }, true) && sw.kind === 'req') s.aux = (s.aux ?? 0) + 1; } } }, ok: (r) => !r.fell && (r.extra ?? 0) >= 3 && (r.aux ?? 0) >= 3 };
// AI 가 베며 들어가는 진짜 스틱 꼴 (ai.js:4486-4536): −0.21 로 서다 → 벨 때 0.3 s 동안 앞 1 + pass 0.6 부탁 → 발이 뜬 채 −0.5 → −0.21
const aiPulse = (i, t, c) => { const s = c.state; s.ph ??= 0.9 * c.R(); const v = (t + s.ph) % 1.8, k = Math.floor((t + s.ph) / 1.8); c.P.move.set(0, v >= 0.9 && v < 1.2 ? 1 : v >= 1.2 && v < 1.5 ? -0.5 : -0.21); countSteps(c); if (v >= 0.9 && v < 1.2 && s.k !== k && ask(c, { kind: 'pass', fwd: 0.6, hold: 0.3 })) s.k = k; s.aux = s.sw?.req ?? 0; };
HOLES.aipulse = { secs: 10, ...REQ, drive: aiPulse, ok: reqOk(4) };
{ const S = stroke('diagR'); HOLES.aipulsecut = { secs: 10, ...REQ, pre: S.pre, drive: (i, t, c) => { aiPulse(i, t, c); S.step(c); }, ok: reqOk(4), tip: true }; }

// ─ 걷기 · 돌기 · 조종의 빠진 꼴 ─
// 걸으며 바라볼 쪽이 한 번에 90° 바뀜 (상대가 옆으로 지나감 · 상대 바꿈) — 3 s 마다 같은 쪽으로
HOLES.walkturn = { secs: 12, cnt: '빨리 돈 스텝', drive: (i, t, c) => { const s = c.state; s.ph ??= 2.5 * c.R(); s.dir ??= c.R() < 0.5 ? 1 : -1; c.P.move.set(0, 1); const u2 = t + s.ph, ang = Math.floor(u2 / 3) * (Math.PI / 2) * s.dir; faceAround(c, ang); if (Math.abs(c.P.gait?.headRate ?? 0) > 2) s.extra = (s.extra ?? 0) + 1; if (u2 % 3 > 3 - 1.5 * DT && u2 > 3) { const f0 = fwdOf(c.P), a = Math.atan2(f0.z, f0.x), e = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))) * 180 / Math.PI; s.headErr = Math.max(s.headErr ?? 0, e); } }, ok: (r) => !r.fell && r.path >= 4 && (r.extra ?? 0) > 0 && (r.headErr ?? 0) <= 45 };
// 다 가라앉아 5 s 선 몸의 첫 걸음 (무게 먼저 옮기기) → 걷기
HOLES.quietstart = { secs: 4, speed: true, opt: { settle: 5 }, drive: (i, t, c) => c.P.move.set(0, 1), ok: (r) => !r.fell && r.alongF >= 0.5 };
// 스틱 비스듬히 끝까지 (1, 1) — 크기 1.41 (싸움의 비스듬한 조종) · 3 s 마다 반대쪽
HOLES.diagstick = { secs: 9, drive: (i, t, c) => { const k = Math.floor(t / 3) % 3, d = [[1, 1], [-1, -1], [-1, 1]][k]; c.P.move.set(d[0], d[1]); }, ok: (r) => !r.fell && r.path >= 4 };
// 벽으로 걸어 들어감 (walls — 12 m 앞 벽에 몸이 닿은 채 2 s 넘게 밀기 · 칼은 머리 위로: 긴 칼끝이 먼저 벽에 걸려 몸이 못 닿는 판을 없앰)
HOLES.wallwalk = { secs: 14, cnt: '벽 곁 스텝', opt: { round: { walls: true } }, pre: (c) => c.P.handOffset.set(0.02, 0.52), drive: (i, t, c) => { c.P.move.set(0, 1); const p = pelOf(c.P); if (Math.hypot(p.x, p.z) > (CFG.ARENA?.radius ?? 6.5) - 0.6) c.state.extra = (c.state.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 240 };
// 판 시작 정지(발 묶임 — feetHeld) 동안 가슴을 40 N·s 로 맞음: 걸음 없이(균형 걸음만) 버티는가
HOLES.holdkick = { secs: 4, cnt: '묶인 채 맞음', opt: { settle: 0.3 }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.2 + 0.6 * c.state.ph) / DT)) { if (c.P.feetHeld) c.state.extra = 1; hitChest(c.P, 40, c.state.ang); } }, ok: (r) => !r.fell && r.extra === 1 };
// 선 채 가슴을 40 N·s 로 0.4 s 사이 두 번 (같은 쪽 — 받아 딛는 발이 뜬 동안 또 밀림)
HOLES.kick2 = { secs: 5, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, drive: (i, t, c) => { c.P.move.set(0, 0); const a = Math.round((0.3 + 0.7 * c.state.ph) / DT); if (i === a || i === a + Math.round(0.4 / DT)) hitChest(c.P, 40, c.state.ang); }, ok: (r) => !r.fell };
// 뛰기 (run.js — 스틱 끝 runReach 1 을 2 s 버팀 → 걷기 × 2.5): 뛰는 상태가 켜지고, 시킨 쪽 평균 빠르기가 뛰는 값의 절반(1.9 m/s)을 넘는가
HOLES.run = { secs: 9, speed: true, cnt: '뛴 시간', auxName: '최고 빠르기', drive: (i, t, c) => { const P = c.P, s = c.state; P.runReach = 1; stickTo(P, 0, 1); if (P.run?.on) s.extra = +((s.extra ?? 0) + DT).toFixed(4); const v = P.bodies.pelvis.linvel(); s.aux = Math.max(s.aux ?? 0, +Math.hypot(v.x, v.z).toFixed(2)); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 3 && r.alongF >= 1.9 };
// 뛰다 끊고(공격 입력 runBreak) 스틱을 뒤로 꺾음 — 줄며 돌아섬
HOLES.runbreak = { secs: 9, cnt: '뛴 시간', auxName: '최고 빠르기', drive: (i, t, c) => { const P = c.P, s = c.state; if (!s.broke) { P.runReach = 1; stickTo(P, 0, 1); if (P.run?.on) { s.extra = +((s.extra ?? 0) + DT).toFixed(4); if (s.extra >= 1.5) { P.runBreak = true; s.broke = t; } } } else { P.runReach = 0; stickTo(P, 0, t - s.broke < 1.5 ? -1 : 0); } const v = P.bodies.pelvis.linvel(); s.aux = Math.max(s.aux ?? 0, +Math.hypot(v.x, v.z).toFixed(2)); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 1.5 && (r.aux ?? 0) >= 2.5 };
const DIGV = 1.9; // 파고들기 구실 바닥(m/s): 박찬 걸음의 몸 빠르기 GAIT.burstSpeed 2.5 의 3/4 쯤 — 보통 걷기 끝 빠르기(롱소드 1.8)보다 빨라야 '박찼다'
// 독일 파고들기 — 사람 길 (humanInput · 가라앉아 선 몸이 스틱 앞 끝 → 앞 두 걸음 박참). 독일 무기만 dig 가 걸림(다른 무기는 '사람 표시 몸의 서다 걷기') · 구실 확인: 앞 빠르기 최고가 박찬 빠르기 2.5 m/s 의 DIGV 넘음
HOLES.dighuman = { secs: 10, cnt: '파고든 수', auxName: '앞 빠르기 최고', opt: { settle: 3.5 }, pre: (c) => { c.P.humanInput = true; }, drive: (i, t, c) => { const s = c.state; c.P.move.set(0, t % 3.3 < 1.3 ? 1 : 0); s.extra = c.P.gait?.digs ?? 0; (s.chk ??= {}).de = c.P.swordArt?.tradition === 'german'; s.aux = Math.max(s.aux ?? 0, +vFwd(c.P).toFixed(2)); }, ok: (r) => !r.fell && r.path >= 2 && (!r.chk?.de || ((r.extra ?? 0) >= 2 && (r.aux ?? 0) >= DIGV)) };
// 독일 파고들기 — AI 길 (걷는 중 gait.deDigAi() — ai_plan_de.js · ai_plan_cn.js): 앞 0.45 ↔ 1 로 걸으며 2 s 마다. 독일 무기만 걸림
HOLES.digai = { secs: 10, cnt: '받은 명령', auxName: '앞 빠르기 최고', pre: (c) => { c.P.aiControlled = true; }, drive: (i, t, c) => { const s = c.state, g = c.P.gait, K = (s.chk ??= {}); K.de = c.P.swordArt?.tradition === 'german'; c.P.move.set(0, t % 2 > 1 ? 1 : 0.45); every(c, t, 2, 1, () => { if (g?.deDigAi?.()) s.extra = (s.extra ?? 0) + 1; }); K.digSteps = g?.digSteps ?? 0; s.aux = Math.max(s.aux ?? 0, +vFwd(c.P).toFixed(2)); }, ok: (r) => !r.fell && r.path >= 3 && (!r.chk?.de || ((r.extra ?? 0) >= 3 && r.chk.digSteps >= 3 && (r.aux ?? 0) >= DIGV)) };
// 뒤 박차기 — AI 길 (앞으로 걷다 gait.backBurstAi() + 스틱 뒤 끝 — ai_plan_de.js:311 · 328 · 348). 독일 무기만 걸림 · 구실 확인: 명령 뒤 0.7 s 안에 몸이 실제로 0.5 m/s 넘게 물러남
HOLES.backburstai = { secs: 10, cnt: '받은 명령', auxName: '물러난 박차기', pre: (c) => { c.P.aiControlled = true; }, drive: (i, t, c) => { const s = c.state, g = c.P.gait, v = t % 2; (s.chk ??= {}).de = c.P.swordArt?.tradition === 'german'; c.P.move.set(0, v < 1 ? 0.75 : -1); every(c, t, 2, 1, () => { if (g?.backBurstAi?.()) { s.extra = (s.extra ?? 0) + 1; s.t0 = t; } }); if (s.t0 != null && t - s.t0 <= 0.7 && vFwd(c.P) <= -0.5) { s.aux = (s.aux ?? 0) + 1; s.t0 = null; } }, ok: (r) => !r.fell && r.path >= 3 && (!r.chk?.de || ((r.extra ?? 0) >= 3 && (r.aux ?? 0) >= 3)) };

// ─ 다친 몸 · 몸 상태 ─
/** 상처를 입은 채 2 s 서고 6 s 걷기. 통과 = 안 넘어짐 + 시킨 쪽 빠르기 바닥 + 그 상태가 실제로 걸림(chk.on) */
const hurtWalk = (apply, check, floor) => ({ secs: 8, speed: true, drive: (i, t, c) => { if (i === 0) apply(c.P, c); c.P.move.set(0, t < 2 ? 0 : 1); if (i === 60) (c.state.chk ??= {}).on = !!check(c.P); }, ok: (r) => !r.fell && !!r.chk?.on && r.alongF >= floor });
HOLES.legwound = hurtWalk((P) => wound(P, 'thighF', 'leg', 0.5), (P) => Math.abs(P.limbs.legF - 0.65) < 0.01, 0.4); // 한 다리 기능 0.65
HOLES.legwound9 = hurtWalk((P) => wound(P, 'thighB', 'leg', 0.9), (P) => Math.abs(P.limbs.legB - 0.37) < 0.01, 0.35); // 한 다리 0.37
HOLES.legwound2 = hurtWalk((P) => { wound(P, 'thighF', 'leg', 0.8); wound(P, 'shinB', 'leg', 0.8); }, (P) => Math.abs(P.legHealth - 0.44) < 0.01, 0.3); // 두 다리 0.44 (0.25 위 — 규칙상 계속 서는 몸)
HOLES.weakbody = hurtWalk((P) => { P.strength = 0.85; }, (P) => P.strength === 0.85, 0.6); // 인물 힘 0.85 (인물 표의 가장 약한 몸 — 다리 근력 몫에 곱해짐)
HOLES.bleedwalk = hurtWalk((P) => { P.blood = 0.55; }, (P) => P.vigor < 0.6 && P.muscle < 0.7, 0.35); // 피 0.55 → vigor 0.54 → 근육
HOLES.gutwound = hurtWalk((P) => wound(P, 'abdomen', 'pelvis', 1.5, 30, 0), (P) => P.hunch > 0.35, 0.4); // 배 상처 웅크림 0.45 rad (출혈 0 — 웅크림만)
// 싸움 중 빈손 팔이 어깨에서 잘림 (sever — 떨어진 팔은 그 자리에 남음)
HOLES.armsever = hurtWalk((P) => P.sever({ joint: 'uarmO', kind: 'shoulder', dist: 0 }, { severity: 1.1, energy: 110, bleedPerSev: CFG.ANATOMY?.arm?.bleed ?? 0.012 }), (P) => !!P.severedLimbs?.has('armO'), 0.4);
// 무릎 꿇고 버팀 (두 다리 평균 0.25 밑 → kneel 상태로 남음): 꿇은 채 골반 0.4 m 위 · 꿇은 지 2 s 뒤 바라볼 쪽이 115° 돌아도 몸이 따라 도는가(끝 오차 35° 안)
HOLES.kneel = { secs: 12, keepGoing: true, cnt: '꿇은 시간', auxName: '바라봄 오차', drive: (i, t, c) => { const s = c.state, P = c.P, K = (s.chk ??= { yMin: 9, bad: 0 }); if (i === 0) P.limbs.legF = P.limbs.legB = 0.1; P.move.set(0, 0); if (P.state === 'kneel') { s.t0 ??= t; s.extra = +((s.extra ?? 0) + DT).toFixed(4); } const ang = s.t0 != null && t > s.t0 + 2 ? 2.0 : 0; faceAround(c, ang); if (s.t0 != null && t > s.t0 + 0.5) { if (P.state !== 'kneel' || P.tiltDeg() > 60) K.bad++; K.yMin = Math.min(K.yMin, +pelOf(P).y.toFixed(3)); } const f0 = fwdOf(P), a = Math.atan2(f0.z, f0.x); s.aux = +(Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))) * 180 / Math.PI).toFixed(1); }, ok: (r) => (r.extra ?? 0) >= 5 && r.chk && r.chk.bad === 0 && r.chk.yMin >= 0.4 && (r.aux ?? 99) <= 35 };
// 걸음 가운데 탈진 (기력 바닥 → 조종 0 · 기술 걸음 지움 · 발 묶임): 걷다 런지를 부탁하고 0.15 s 뒤 기력을 다 씀
HOLES.exhaust = { secs: 6, cnt: '탈진 시간', drive: (i, t, c) => { const s = c.state, P = c.P; s.ph ??= 0.8 + 0.6 * c.R(); P.move.set(0, 1); if (!s.asked && t >= s.ph) s.asked = !!P.gait?.requestStep?.({ kind: 'lunge', fwd: 0.6, duration: 0.4, accel: true }); if (!s.spent && t >= s.ph + 0.15) { s.spent = true; P.stamina.spend('attack', 500); } if (P.stamina.exhausted) s.extra = +((s.extra ?? 0) + DT).toFixed(4); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 1 };
// 멍함 (머리 둔타 뒤 — 조종에 제멋대로 움찔이 섞임): 8 s 떠돎
HOLES.daze = { secs: 8, drive: (i, t, c) => { if (i === 0) c.P.daze = 1; c.P.move.set(0, 0); }, ok: (r) => !r.fell && r.path >= 1 };
// 오코리 (AI 공격 예비 동작 — ai_measure.js okoriBody 가 두는 칸 그대로: 몸 감기 · 숙임 · 낮춤 · 무게 앞발로 15 %) + 베기
{ const S = stroke('diagR'), O = CFG.OKORI ?? { turn: 0.35, lean: 0.05, drop: 0.03, front: 0.15 }; HOLES.okori = { secs: 9, cnt: '켠 스텝', pre: S.pre, tip: true, drive: (i, t, c) => { const P = c.P, on = t % 1.5 < 0.6, sg = Math.floor(t / 1.5) % 2 ? -1 : 1; P.move.set(0, 0); P.okoriBody = on ? { pelvisYaw: sg * O.turn, chestYaw: sg * O.turn, pitch: O.lean, drop: O.drop } : null; P.okoriFront = on ? O.front : 0; if (on) c.state.extra = (c.state.extra ?? 0) + 1; S.step(c); }, ok: (r) => !r.fell && (r.extra ?? 0) > 0 }; }
// 헛침 경직 (burst_whiff.js bwAtkEnd 가 두는 칸 그대로: 굳음 1.2 s — 숙임 · 돌림 · 낮춤 + 비틀 걸음 0.4 s)
HOLES.whiffstiff = { secs: 9, cnt: '굳은 스텝', drive: (i, t, c) => { const P = c.P, s = c.state; P.move.set(0, 0); every(c, t, 2.8, 0.4 + 0.5 * (s.ph ??= c.R()), (k) => { P.bwStiffT = CFG.BURST_WHIFF?.stiff ?? 1.2; P.bwDrag = { dir: [k % 2 ? -1 : 1, 0] }; P.bwEnd = { tgt: null, t: P.fightT ?? 0 }; }); if ((P.bwBody?.pitch ?? 0) > 0.1) s.extra = (s.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 100 };

// ─ 발 · 다리에 닿는 것 ─
// 딛은 다리 토막에 건 충격 (칼이 다리를 가를 때 combat 이 그 토막에 거는 끌림 · 되튐 충격량 크기): 정강이 15 · 허벅지 25 · 발 10 N·s 를 1.2 s 마다
HOLES.leghit = { secs: 6, pre: (c) => { c.state.ang = c.R() * Math.PI * 2; c.state.ph = 0.3 + 0.5 * c.R(); }, drive: (i, t, c) => { c.P.move.set(0, 0); every(c, t, 1.2, c.state.ph, (k) => { const [p, J] = [['shinF', 15], ['thighF', 25], ['footF', 10], ['shinB', 15]][k % 4]; hitPart(c.P, p, J, c.state.ang + k * 2.4); }); }, ok: (r) => !r.fell };
// 걷는 중 딛은 쪽 정강이를 15 N·s 로 (낮은 베기 꼴) — 1.5 s 마다
HOLES.walkleghit = { secs: 8, speed: true, cnt: '친 수', pre: (c) => { c.state.ang = c.R() * Math.PI * 2; c.state.ph = 1 + 0.5 * c.R(); }, drive: (i, t, c) => { const s = c.state, g = c.P.gait; c.P.move.set(0, 1); const k = Math.floor((t - s.ph) / 1.5); if (t >= s.ph && k !== s.k && g?.legs) { const L = g.legs.F.stance && !g.legs.B.stance ? 'F' : g.legs.B.stance && !g.legs.F.stance ? 'B' : null; if (L) { s.k = k; hitPart(c.P, 'shin' + L, 15, s.ang + k * 2.4); s.extra = (s.extra ?? 0) + 1; } } }, ok: (r) => !r.fell && (r.extra ?? 0) >= 3 && r.alongF >= 0.5 };
// 휩쓸기 막힘 꼴 (secret_instant.js:1234-1247 — 가슴 30 + 골반 20 N·s 를 한 스텝에 같은 쪽으로)
HOLES.sweepblock = { secs: 5, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) { hitPart(c.P, 'chest', 30, c.state.ang); hitPart(c.P, 'pelvis', 20, c.state.ang); } }, ok: (r) => !r.fell };
// 떨어진 상대 칼을 내 발 길에 눕혀 놓고 밟고 지나감 (발은 남의 칼과 부딪힘 — self_contact.js · 제 칼은 지나감): 앞으로 2 s · 뒤로 2 s. 발 ↔ 칼 닿은 스텝이 있어야 통과
HOLES.swordstep = { secs: 7, cnt: '칼 밟은 스텝', opt: { duo: 5.2 }, drive: (i, t, c) => { const P = c.P, E = c.E, s = c.state; if (i === 0) E.dropSword(); P.move.set(0, t < 1.5 ? 0 : t < 3.5 ? 1 : t < 4 ? 0 : t < 6 ? -1 : 0); if (i === Math.round(1.4 / DT)) { const ft = P.bodies.footF.translation(), f = fwdOf(P), q = new H.THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(f.x, 0, f.z)); E.sword.setTranslation({ x: ft.x + f.x * 0.25, y: 0.03, z: ft.z + f.z * 0.25 }, true); E.sword.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true); E.sword.setLinvel({ x: 0, y: 0, z: 0 }, true); E.sword.setAngvel({ x: 0, y: 0, z: 0 }, true); } if (t > 1.5) { let hit = false; for (const fk of ['footF', 'footB']) for (const sc of E.swordColliders ?? []) c.G.world.contactPair(P.bodies[fk].collider(0), sc, (m) => { if (m.numContacts() > 0) hit = true; }); if (hit) s.extra = (s.extra ?? 0) + 1; } }, ok: (r) => !r.fell && (r.extra ?? 0) >= 3 && r.path >= 3 };
// 걷다가 칼을 놓침 (dropSword — 손목 치기 · 칼 팔 부상): 받칠 무게 · 팔 균형이 한 스텝에 바뀜 → 빈손으로 계속 걷다 섬
HOLES.dropsword = { secs: 7, speed: true, cnt: '빈손 시간', drive: (i, t, c) => { const P = c.P, s = c.state; s.ph ??= 1 + c.R(); P.move.set(0, t < 5 ? 1 : 0); if (!s.done && t >= s.ph) { s.done = true; P.dropSword(); } if (!P.armed) s.extra = +((s.extra ?? 0) + DT).toFixed(4); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 4 && r.alongF >= 0.5 };
// 무대 가운데 장애물(잠든 습지 석상 — arena_obstacle.js configureStageObstacle)로 걸어 들어감: 몸 · 발이 돌에 막힌 채 3 s 넘게 밀기 (칼은 머리 위로)
HOLES.obstacle = { secs: 8, cnt: '돌 곁 스텝', pre: (c) => { c.P.handOffset.set(0.02, 0.52); c.state.ob = AO.configureStageObstacle?.(H.RAPIER, c.G.world, 'sluice', FM.GROUND_GROUPS) ?? null; }, drive: (i, t, c) => { const p = pelOf(c.P), s = c.state; c.P.move.set(0, 1); c.G.faceP = { x: 0, y: 1, z: 0 }; if (s.ob && Math.hypot(p.x, p.z) < (s.ob.navigation?.radius ?? 0.9) + 0.5) s.extra = (s.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 360 };
// 떨어진 칼 줍기 (pickup.js — 사람 저절로 줍기 humanPickup: 칼 곁 1.5 m 안이면 걸어가 웅크려(골반 0.4 m 낮춤 · 몸통 60° 숙임 · 멀면 반걸음) 쥠. 칼이 더 멀리 굴렀으면 장면이 1.2 m 안까지 걸어감): 내내 선 상태 + 다시 쥠 + 쥔 뒤 2 s 버팀
HOLES.pickup = { secs: 10, cnt: '쥔 뒤 버틴 시간', opt: { low: 0.3, tilt: 100 }, pre: (c) => { c.P.humanInput = true; }, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) P.dropSword(); P.move.set(0, 0); if (!P.armed && !P.pickup && !P.autoPick && t > 0.5) { const p = pelOf(P), g = P.sword.translation(), dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz), F = P.forward(V3()), R = P.right(V3()); if (d > 1.2) P.move.set(((dx * R.x + dz * R.z) / d) * 0.6, ((dx * F.x + dz * F.z) / d) * 0.6); } if (!s.got && P.armed && P.pickupLog?.[0]?.ok) s.got = true; if (s.got && P.state === 'stand' && pelOf(P).y > 0.6) s.extra = +((s.extra ?? 0) + DT).toFixed(4); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 2 };

// ─ 넘어진 뒤 · 일어서기의 빠진 꼴 ─
/** 일어섬 따라가기 (getup 장면과 같은 잣대 + 골반 0.6 m 위): 선 채 밖 도움이 끝난 뒤 2 s 를 버틴 때 = extra · 그 앞에 섰다가 다시 무너진 수 = aux */
const riseTrack = (c, t) => { const s = c.state, P = c.P; if (P.state === 'stand' && hOf(P) > 0.6) { s.up = (s.up ?? 0) + DT; if (s.up > 2 + AID_AFTER && s.extra == null) s.extra = +(t - 2 - AID_AFTER).toFixed(2); } else { if (s.extra == null && (s.up ?? 0) > 0.1) s.aux = (s.aux ?? 0) + 1; s.up = 0; } };
const roseOnce = (r) => r.extra != null && !(r.aux > 0);
const RISE = { keepGoing: true, cnt: '일어선 때', auxName: '다시 무너짐' };
// 쓰러진 동안 상대가 돌아가 있음: 일어선 순간 바라볼 쪽이 몸과 137° 다름 + 곧장 걷기(0.45)
HOLES.getupface = { secs: 14, ...RISE, drive: (i, t, c) => { const P = c.P; if (i === 0) P.knockDown(true); faceAround(c, 2.4); P.move.set(0, P.state === 'stand' ? 0.45 : 0); riseTrack(c, t); }, ok: roseOnce };
// 무릎 꺾임 (knockDown(false) — 휘청임 게이지 0 · 머리 둔타 · 곁눈 베기 무릎 꺾기 0.6 s): 걷던 몸이 곧장 무릎 꿇기로 → 한 번에 일어서 버팀
HOLES.buckle = { secs: 10, ...RISE, drive: (i, t, c) => { const P = c.P, s = c.state; s.ph ??= 0.8 + 0.8 * c.R(); P.move.set(0, t < s.ph ? 1 : 0); if (!s.fired && t >= s.ph) { s.fired = true; P.buckleKneel = CFG.UNIQUE_ASSIST?.buckle?.kneel ?? null; P.knockDown(false); } if (s.fired) riseTrack(c, t); }, ok: roseOnce };
// 부활 (revive.js — 죽은 몸처럼 1.9 s 누웠다 무릎 → 일어섬 · 다리 0.7 · 피 0.7 까지만 되찾음): 다친 몸(다리 0.3 · 피 0.5)이 죽은 뒤 되살아나 버티는가
HOLES.revive = { secs: 14, ...RISE, opt: { round: { revive2: { count: 1 } } }, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) { P.limbs.legF = P.limbs.legB = 0.3; P.blood = 0.5; P.die('출혈'); (s.chk ??= {}).rev = !!P.revival; } P.move.set(0, 0); if (s.chk?.rev) riseTrack(c, t); }, ok: (r) => !!r.chk?.rev && roseOnce(r) };

// ─ 두 몸 장면 (상대 = 대본 몸) ─
/** 붙는 장면: 두 몸 모두 칼을 머리 위(지붕 자세 패드)로 들어 칼끝에 서로 막히지 않게 (칼끝이 가슴에 걸려 못 붙는 판을 없앰 — 재는 것은 붙은 뒤의 다리) */
const highGuard = (c) => { c.P.handOffset.set(0.02, 0.52); c.E.handOffset.set(0.02, 0.52); };
// 유파 걸음 follow (이탈리아 = 레이피어 — 상대 2.8 m 안에서 느리게: 앞발 먼저 · 뒷발 따라붙음 · 짝걸음). 다른 무기는 '상대 곁 느린 앞뒤 걸음'
HOLES.followfb = { secs: 10, cnt: 'follow 스텝', opt: { duo: 2.4 }, drive: (i, t, c) => { const v = t % 2.5, g = c.P.gait; c.P.move.set(0, v < 0.9 ? 0.4 : v < 1.25 ? 0 : v < 2.15 ? -0.4 : 0); if (g?.follow) c.state.extra = (c.state.extra ?? 0) + 1; (c.state.chk ??= {}).fw = g?.P?.footwork === 'follow'; }, ok: (r) => !r.fell && r.path >= 1.2 && (!r.chk?.fw || (r.extra ?? 0) >= 300) };
HOLES.followside = { secs: 10, cnt: 'follow 스텝', opt: { duo: 2.4 }, drive: (i, t, c) => { const v = t % 2.5, g = c.P.gait; c.P.move.set(v < 0.9 ? 0.45 : v < 1.25 ? 0 : v < 2.15 ? -0.45 : 0, 0.1); if (g?.follow) c.state.extra = (c.state.extra ?? 0) + 1; (c.state.chk ??= {}).fw = g?.P?.footwork === 'follow'; }, ok: (r) => !r.fell && r.path >= 1.2 && (!r.chk?.fw || (r.extra ?? 0) >= 300) };
// 사람 탭 찌르기 (skill.thrust — 선 채 런지 + 몸 싣기 push 2 + 스틱 앞 0.63 덮음): 탭 → 0.9 s 뒤 1 s 동안 뒤 0.45 로 물러남(간격 되돌림) → 다시
HOLES.tapthrust = { secs: 10, cnt: '나간 탭', auxName: '뜬 부탁 걸음', opt: { duo: 3.0 }, pre: (c) => { c.P.humanInput = true; }, drive: (i, t, c) => { const s = c.state, P = c.P; s.ph ??= 0.3 + 0.4 * c.R(); const v = t - s.ph, w = v % 2.4; P.move.set(0, v >= 0 && w >= 0.9 && w < 1.9 ? -0.45 : 0); countSteps(c); every(c, t, 2.4, s.ph, () => { if (P.skill.thrust()) s.extra = (s.extra ?? 0) + 1; }); s.aux = s.sw?.req ?? 0; }, ok: reqOk(3) };
// 근접 밀치기 (closeStep — 닿는 거리에서 스틱 앞: 딛기 걸음 → 누르기 동안 다리로 400 N) · 상대는 서 있는 대본 몸
HOLES.barge = { secs: 9, cnt: '누른 시간', auxName: '밀치기 수', opt: { duo: 1.7 }, pre: (c) => { highGuard(c); c.P.canShove = true; }, drive: (i, t, c) => { const P = c.P, s = c.state, v = t % 4.5; stickTo(P, 0, v < 3.2 ? 1 : 0); if (P.barge?.phase === 'press') s.extra = +((s.extra ?? 0) + DT).toFixed(4); s.aux = P.shoves ?? 0; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 0.3 && (r.aux ?? 0) >= 1 };
// 같은 밀치기 — 사람 몸(humanInput: 시작 거리 1 m · 묶임 1.2 s → 상대가 맞밂 holdPushBack)
HOLES.bargeheld = { secs: 9, cnt: '누른 시간', auxName: '밀치기 수', opt: { duo: 1.7 }, pre: (c) => { highGuard(c); c.P.canShove = true; c.P.humanInput = true; }, drive: (i, t, c) => { const P = c.P, s = c.state, v = t % 4.5; stickTo(P, 0, v < 3.2 ? 1 : 0); if (P.barge?.phase === 'press') s.extra = +((s.extra ?? 0) + DT).toFixed(4); if (P.barge?.hold > 0) (s.chk ??= {}).hold = 1; s.aux = P.shoves ?? 0; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 0.3 && (r.aux ?? 0) >= 1 && !!r.chk?.hold };
// 밀치기를 당함: 상대(대본 몸 — 사람 표시 · canShove)가 걸어와 나를 누름 · 나는 서서 버팀(묶인 동안 내 몸도 맞밂)
HOLES.barged = { secs: 9, cnt: '눌린 시간', auxName: '상대 밀치기 수', opt: { duo: 1.7 }, pre: (c) => { highGuard(c); c.E.canShove = true; c.E.humanInput = true; }, drive: (i, t, c) => { const P = c.P, E = c.E, s = c.state, v = t % 4.5; P.move.set(0, 0); E.scriptMove = v < 3.2 ? [0, 1] : null; if (E.barge?.phase === 'press') s.extra = +((s.extra ?? 0) + DT).toFixed(4); s.aux = E.shoves ?? 0; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 0.3 && (r.aux ?? 0) >= 1 };
// 밀쳐내기 (shove — 가슴 사이 0.75 m 안에서 스틱 뒤: 두 가슴에 320 N 힘 쌍): 다가가 붙은 뒤 물러남을 되풀이
HOLES.shove = { secs: 10, cnt: '밀쳐낸 스텝', opt: { duo: 1.6 }, pre: highGuard, drive: (i, t, c) => { const P = c.P, s = c.state, d = P.foeDistance(); s.mode ??= 0; if (s.mode === 0) { P.move.set(0, 0.6); if (d < 0.62) s.mode = 1; } else { P.move.set(0, -1); if (d > 1.0) s.mode = 0; } if (P.state === 'stand' && d <= 0.75 && P.move.y < 0 && P.muscle >= 0.5) s.extra = (s.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 20 };
// 밀쳐내기를 당함: 상대(대본 몸)가 다가와 붙은 뒤 물러나며 밀쳐냄 — 상대 스텝이 내 가슴에 건 320 N 이 그대로 남음(내 스텝의 힘 지우기 뒤). 나는 서 있음
HOLES.shoved = { secs: 10, cnt: '밀쳐진 스텝', opt: { duo: 1.6 }, pre: highGuard, drive: (i, t, c) => { const P = c.P, E = c.E, s = c.state, d = P.foeDistance(); P.move.set(0, 0); s.mode ??= 0; if (s.mode === 0) { E.scriptMove = [0, 0.6]; if (d < 0.62) s.mode = 1; } else { E.scriptMove = [0, -1]; if (d > 1.0) s.mode = 0; } if (E.state === 'stand' && d <= 0.75 && s.mode === 1 && E.muscle >= 0.5) s.extra = (s.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 20 };
// 두 몸이 마주 걸어와 부딪힘 (팔 · 몸끼리 닿음 + 붙으면 shove 의 닿음 몫) — 2.5 s 걷고 1.5 s 섬. 둘 다 칼을 머리 위(지붕 자세)로 들어 칼끝에 서로 막히지 않게. 가슴 사이 1 m 안에 든 스텝이 있어야 통과
HOLES.bump = { secs: 9, cnt: '붙은 스텝', auxName: '가장 가까운 거리', opt: { duo: 2.0 }, pre: (c) => { c.P.handOffset.set(0.02, 0.52); c.E.handOffset.set(0.02, 0.52); }, drive: (i, t, c) => { const go = t % 4 < 2.5 ? 0.6 : 0, d = c.P.foeDistance(), s = c.state; c.P.move.set(0, go); c.E.scriptMove = go ? [0, go] : null; if (d < 1.0) s.extra = (s.extra ?? 0) + 1; s.aux = Math.min(s.aux ?? 9, +d.toFixed(2)); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 120 };
// 칼 씨름 밀침 (de_dirty.js ringThrow — 온몸 빠르기에 1.96 m/s 를 더함 · 1.2 s 동안 스틱 0): 밀린 몸을 받아 딛어 세움
HOLES.ringthrow = { secs: 6, cnt: '밀린 스텝', opt: { duo: 1.2 }, pre: (c) => { c.state.ph = c.R(); }, drive: (i, t, c) => { const P = c.P, s = c.state; P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * s.ph) / DT)) DD.ringThrow?.(c.E, P); if (P.ringHit) s.extra = (s.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 30 };
// 비기 순간 내딛음 (secret_instant.js requestInstant → shiftFighter: 온몸 · 칼 · 걸음 자리를 상대 쪽으로 0.6 m 까지 평행 이동): 옮겨진 뒤 버팀
HOLES.instant = { secs: 8, cnt: '미끄러진 수', auxName: '미끄러진 길', opt: { duo: 3.2 }, drive: (i, t, c) => { const P = c.P, s = c.state; P.move.set(0, 0); s.ph ??= 0.3 + 0.5 * c.R(); every(c, t, 2.5, s.ph, () => { SI.requestInstant?.(P); s.pend = true; }); if (s.pend && P.instantResult) { s.pend = false; if (P.instantResult.ok && P.instantResult.step > 0.05) { s.extra = (s.extra ?? 0) + 1; s.aux = +((s.aux ?? 0) + P.instantResult.step).toFixed(3); } } }, ok: (r) => !r.fell && (r.extra ?? 0) >= 2 && (r.aux ?? 0) >= 0.6 };
// (뺌 — 진짜 베기를 맞는 두 몸 장면 'takecut': 상대 대본 몸이 닿는 거리에서 가로 베기를 하면 한 번에 250 ~ 900 J 가 들어가 게임 규칙(휘청임 게이지 0 · 머리 둔타 · 죽음)이 지금 게임도 1.4 ~ 2.7 s 에 넘어뜨림 — 롱소드 0/4 · 츠바이핸더는 안 닿는 판이 절반. 다리가 아니라 규칙을 재는 장면이라 공정하지 않음. 토막 충격량 몫은 leghit · walkleghit · sweepblock 이 잼)
/** 상대를 쓰러뜨려 눕혀 둔다 (게임 규칙의 쓰러짐 · 일어나지 않게) */
const layDown = (E) => { E.knockDown(true); E.downTime = 1e9; };
/** 누운 상대 곁으로: 마무리가 열릴 때까지(ready(P) 참) 스틱 0.4 로 다가감(너무 붙었으면 0.3 으로 물러남) — 상대 몸이 어디로 쓰러지든 같은 일을 재게. 열렸으면 true (스틱 0) */
const nearDowned = (c, ready) => { const P = c.P; if (ready(P)) { P.move.set(0, 0); return true; } P.move.set(0, P.foeDistance() > 0.9 ? 0.4 : -0.3); return false; };
// 쓰러진 상대 앞 마무리 자세 (finish.js — 숙임 · 낮춤 · 발 묶임) + 내려베기 되풀이 · 마무리 자세가 안 열리는 자리면 열릴 때까지 다가감
{ const S = stroke('vert'); HOLES.finishpose = { secs: 10, cnt: '마무리 자세 스텝', tip: true, opt: { duo: 1.3 }, pre: S.pre, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) layDown(c.E); P.move.set(0, 0); if (t > 1.2 && pelOf(c.E).y < 0.35 && (s.at || nearDowned(c, (p) => !!p.finish?.on))) { s.at = true; S.step(c); } if ((P.finish?.amt ?? 0) > 0.99) s.extra = (s.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 120 }; }
// 쓰러진 상대에게 걸어 들어가 마무리 탭 (사람 — skill.thrust: 누운 몸이 닿는 곳 밖이면 스틱 앞 0.63 을 덮어 걸어 들어가 내려찍음) · 간격 2.4 m (대검 츠바이핸더는 쪼개 내려치기가 멀리 닿아 3.2 m — 2.4 면 걷지 않고 닿음)
HOLES.finishwalk = { secs: 10, cnt: '마무리 탭', auxName: '걸어 들어간 스텝', opt: { duo: (w) => ({ zweihander: 3.2 }[w] ?? 2.4) }, pre: (c) => { c.P.humanInput = true; }, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) layDown(c.E); P.move.set(0, 0); if (t > 2 && pelOf(c.E).y < 0.35 && !P.skill.tap && (s.extra ?? 0) < 4 && nearDowned(c, (p) => !!p.finish?.canStart) && i % 60 === 0 && P.skill.thrust() && P.skill.tap?.down) s.extra = (s.extra ?? 0) + 1; if (P.skill.tap?.walking) s.aux = (s.aux ?? 0) + 1; if ((P.finish?.amt ?? 0) > 0.99) (s.chk ??= {}).fin = 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 1 && (r.aux ?? 0) >= 10 && !!r.chk?.fin };
// 누운 몸 위로 걸어 지나감 (정강이 · 허벅지는 남의 몸과 부딪힘): 상대 자리를 0.5 m 넘어가야 통과
HOLES.walkover = { secs: 7, cnt: '넘어간 거리', opt: { duo: 2.2 }, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) { layDown(c.E); s.x0 = pelOf(P).x; s.f = fwdOf(P); } c.G.faceP = { x: s.x0 + 100 * s.f.x, y: 1, z: 100 * s.f.z }; P.move.set(0, t < 1 ? 0 : 0.6); const e = pelOf(c.E), p = pelOf(P); s.extra = +(((p.x - e.x) * s.f.x + (p.z - e.z) * s.f.z)).toFixed(2); }, ok: (r) => !r.fell && (r.extra ?? -9) >= 0.5 };

// ─ 지형 무대 (화산섬 비탈 — 발 높이 · 비탈 면 다루기): 평지 장면의 꼴을 비탈 위에서. 판마다 오르막 · 내리막 · 가로(두 쪽)를 돌아가며 ─
const SLOPE = (v) => [{ x: v & 4 ? 1.5 : -1.5, z: 2.5, heading: Math.PI / 2 }, { x: v & 4 ? -1.5 : 1.5, z: -3, heading: -Math.PI / 2 }, { x: -3, z: v & 4 ? 1 : -1, heading: 0 }, { x: 3, z: v & 4 ? -2 : 0.5, heading: Math.PI }][v % 4];
const onSlope = (c) => { const p = pelOf(c.P), K = (c.state.chk ??= { terr: !!c.P.terrain, g0: c.P.terrain?.heightAt(p.x, p.z) ?? 0 }); K.dy = +(((c.P.terrain?.heightAt(p.x, p.z) ?? 0) - K.g0)).toFixed(2); };
const TERR = { opt: { terrain: SLOPE } };
HOLES.slopestand = { secs: 8, ...TERR, drive: (i, t, c) => { c.P.move.set(0, 0); onSlope(c); }, ok: (r) => !r.fell && !!r.chk?.terr && r.net < 0.3 };
HOLES.slopewalk = { secs: 5, speed: true, cnt: '땅 높이 바뀜(크기 m)', ...TERR, drive: (i, t, c) => { c.P.move.set(0, 1); onSlope(c); c.state.extra = Math.abs(c.state.chk.dy); }, ok: (r) => !r.fell && !!r.chk?.terr && r.alongF >= 0.5 };
HOLES.slopestopgo = { secs: 16, ...TERR, drive: (i, t, c) => { const k = Math.floor(t / 2) % 4, go = t % 2 < 1.2, d = [[0, 1], [0, -1], [1, 0], [-1, 0]][k]; c.P.move.set(go ? d[0] : 0, go ? d[1] : 0); onSlope(c); }, ok: (r) => !r.fell && !!r.chk?.terr && r.path >= 3 };
HOLES.slopeturn = { secs: 12, ...TERR, drive: (i, t, c) => { const s = c.state; c.P.move.set(0, 0); onSlope(c); s.base ??= (() => { const f0 = fwdOf(c.P); return Math.atan2(f0.z, f0.x); })(); const k = Math.floor(t / 2), ang = s.base + (k % 2 ? 1 : 0) * (Math.PI / 2) * (k % 4 < 2 ? 1 : -1); faceAround(c, ang); if (t % 2 > 2 - 1.5 * DT) { const f0 = fwdOf(c.P), a = Math.atan2(f0.z, f0.x), e = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))) * 180 / Math.PI; s.headErr = Math.max(s.headErr ?? 0, e); } }, ok: (r) => !r.fell && !!r.chk?.terr && r.headErr != null && r.headErr <= 30 };
HOLES.slopekick = { secs: 5, ...TERR, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, drive: (i, t, c) => { c.P.move.set(0, 0); onSlope(c); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, ok: (r) => !r.fell && !!r.chk?.terr };
HOLES.slopegetup = { secs: 14, ...RISE, ...TERR, drive: (i, t, c) => { c.P.move.set(0, 0); onSlope(c); if (i === 0) c.P.knockDown(true); riseTrack(c, t); }, ok: (r) => !!r.chk?.terr && roseOnce(r) };
for (const [k, v] of Object.entries(HOLES)) MORE[k] = v;
// 일어서기: 서 있는 몸을 쓰러뜨리고(knockDown — 게임 규칙의 쓰러짐) 14 s 안에 stand 로 돌아와, 버틴 창(2 s + AID.after — 선언된 밖 도움이 끝난 뒤 2 s 까지)을 버티는가.
//  통과 (11/24 검토): ① 몸이 정말 쓰러졌다(선 상태를 떠난 적이 있다 — knockDown 을 무시한 몸은 통과가 아님) ② 버틴 창 내내 선 상태 + 골반이 쓰러지기 앞 선 높이의 GETUP_H 배 위 + 가슴 기울기 GETUP_TILT° 안.
//  일어선 때 = 쓰러진 뒤 상태가 stand 가 된 때 (그 선 상태가 끊기지 않고 버틴 창을 채운 판만). 버틴 창이 시작된 때 = 그 선 상태 안에서 ② 가 끊기지 않고 이어지기 시작한 때
//   — 서자마자 ② 가 맞으면 일어선 때와 같고, 선 상태가 됐는데 아직 몸이 낮거나 기울어 있으면(또는 창 안에서 ② 가 깨지면) 그만큼 늦다. 선 상태를 떠나면 둘 다 처음부터.
const AID = CFG.AID ?? null; // 나무가 선언한 밖 도움의 상한(config AID — 없는 나무는 null)
const AID_AFTER = AID?.after ?? 0; // 선언된 밖 도움이 선 뒤에도 이어지는 시간(있으면) — 버팀은 도움이 끝난 뒤 2 s 까지 센다
const GETUP_H = 0.65, GETUP_TILT = 45;
SCENES.getup = { secs: 14, keepGoing: true, drive: (i, t, c) => {
  c.P.move.set(0, 0); const s = c.state, P = c.P, K = (s.chk ??= { went: 0, h0: null, win: null, hMin: null, tiltMax: null, broke: 0 });
  if (i === 0) { K.h0 = +hOf(P).toFixed(3); P.knockDown(true); }
  if (P.state !== 'stand') { K.went = 1; s.up = 0; s.t0 = null; return; }
  if (!K.went) return; // 아직 쓰러진 적이 없다 — 서 있기만 한 시간은 버틴 것으로 안 센다
  s.t0 ??= t; // 이번에 선 상태가 된 때
  const h = hOf(P), tl = P.tiltDeg();
  if (h > GETUP_H * K.h0 && tl < GETUP_TILT) {
    if (!s.up) { s.w0 = t; s.hMin = h; s.tMax = tl; } else { s.hMin = Math.min(s.hMin, h); s.tMax = Math.max(s.tMax, tl); }
    s.up = (s.up ?? 0) + DT;
    if (s.up > 2 + AID_AFTER && s.extra == null) { const w = t - 2 - AID_AFTER; s.extra = +(w - (s.w0 - s.t0)).toFixed(2); K.win = +w.toFixed(2); K.hMin = +s.hMin.toFixed(3); K.tiltMax = +s.tMax.toFixed(1); } // 버틴 창이 선 때부터 끊기지 않았으면 예전 값 그대로(t − 버팀)
  } else { if (s.extra == null && (s.up ?? 0) > 0) K.broke++; s.up = 0; }
}, ok: (r) => r.extra != null && !!r.chk?.went,
  more: (rs) => ({ wentDown: rs.filter((r) => r.chk?.went).length, holdSecs: 2 + AID_AFTER, holdStart: med(rs.filter((r) => r.chk?.win != null).map((r) => r.chk.win)), holdPelvisMin: med(rs.filter((r) => r.chk?.hMin != null).map((r) => r.chk.hMin)), holdPelvisShare: med(rs.filter((r) => r.chk?.hMin != null).map((r) => r.chk.hMin / r.chk.h0)), holdTiltMax: med(rs.filter((r) => r.chk?.tiltMax != null).map((r) => r.chk.tiltMax)), holdBroke: sum(rs.map((r) => r.chk?.broke ?? 0)) }),
  tail: (x) => ` · 쓰러진 판 ${x.wentDown}/${N} · 버틴 창 ${f(x.holdSecs, 1)} s 이 시작된 때 ${f(x.holdStart)} · 그 창의 골반 최저 ${f(x.holdPelvisMin)} m (쓰러지기 앞 높이의 ${x.holdPelvisShare == null ? '-' : (100 * x.holdPelvisShare).toFixed(0) + ' %'} — 바닥 ${100 * GETUP_H} %) · 기울기 최고 ${f(x.holdTiltMax, 0)}° (천장 ${GETUP_TILT}°)${x.holdBroke ? ` · 창이 깨져 다시 센 수 ${x.holdBroke}` : ''}` };

const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
/** 정직 먼저: 같은 나무를 honesty.mjs 장부(이 저장소 판 — 재는 쪽이 고른 도구)로 서기 4 s · 걷기 4 s 재서 찍는다. 돌려줌: { ok, lines } */
async function honestyFirst() {
  const Hn = await import(pathToFileURL(join(HERE, 'honesty.mjs')).href);
  let base = null; try { base = JSON.parse(readFileSync(join(HERE, '../../docs/strike/physics2_baseline/solo_2026-11-24.json'), 'utf8')); } catch { /* 기준 없음 */ }
  const lines = []; let ok = true;
  for (const [kind, mv] of [['stand', [0, 0]], ['walk', [0, 1]]]) {
    const G = H.newRound({ walls: false, weapon: WEAPONS[0], seed: 7 });
    G.park();
    const P = G.player;
    for (let i = 0; i < Math.round(3 / DT); i++) { P.move.set(0, 0); G.step(); }
    const named = []; const seen = new Set(); for (const [n, b] of [...Object.entries(P.bodies), ['sword', P.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); named.push([n, b]); }
    const L = Hn.attach(G.world, named, { fighter: P });
    Hn.hook(G, [L]);
    for (let i = 0; i < Math.round(4 / DT); i++) { P.move.set(mv[0], mv[1]); G.step(); }
    const S = L.summary(), c = S.cats, v = (k, q) => c[k]?.[q] ?? 0;
    const bad = [];
    if (S.externalJoints.length) bad.push(`몸 밖 관절 ${S.externalJoints.length}`);
    if (Math.abs(S.supportShare) > 0.005) bad.push(`받침 ${(100 * S.supportShare).toFixed(1)} %`);
    if (v('push', 'Fimp') > 1) bad.push(`밀기 ${v('push', 'Fimp').toFixed(0)} N·s`);
    if (v('other', 'Fimp') + v('unpaired', 'Fimp') > 1) bad.push(`짝 없는 힘 ${(v('other', 'Fimp') + v('unpaired', 'Fimp')).toFixed(0)} N·s`);
    if (v('write', 'Fimp') > 0) bad.push(`속도 쓰기 ${v('write', 'Fimp').toFixed(0)} N·s`);
    if (S.place.calls) bad.push(`자리 놓기 ${S.place.calls}`);
    if (v('mass', 'Fimp') > 0) bad.push(`질량 바뀜 ${v('mass', 'Fimp').toFixed(0)} N·s`);
    if (S.check.foreignNs > 0) bad.push(`땅 아닌 것 닿음 ${S.check.foreignNs.toFixed(0)} N·s`);
    if (Math.abs(S.check.groundNShare - 1) > 0.02) bad.push(`땅 법선 ÷ 체중 ${(100 * S.check.groundNShare).toFixed(1)} %`);
    if (S.torque.yawExcessRate > 1) bad.push(`yaw 엔진 한도 넘는 몫 ${S.torque.yawExcessRate.toFixed(1)} N·m`);
    if (S.torque.tiltResRate > (kind === 'stand' ? 12 : 24)) bad.push(`숨은 기울기 토크 ${S.torque.tiltResRate.toFixed(1)} N·m`);
    const virt = Object.keys(S.virtualActuators || {}).filter((k) => k !== 'offhand');
    if (virt.length) bad.push(`관절을 건너뛰는 힘 쌍 ${virt.join(',')}`);
    const b0 = base?.find((x) => x.title.split(' ')[0] === kind), fp = b0 ? Hn.diffFingerprint(b0, S) : null;
    if (bad.length) ok = false;
    lines.push(`  정직 ${kind}: ${bad.length ? '불합격 — ' + bad.join(' · ') : '통과'} (받침 ${(100 * S.supportShare).toFixed(1)} % · 땅 법선 ${(100 * S.check.groundNShare).toFixed(1)} % · 숨은 기울기 ${S.torque.tiltResRate.toFixed(1)} N·m · 엔진이 봐준 비틀림 ${(S.torque.yawOverCoulombRate ?? 0).toFixed(1)} N·m)${S.aid && (S.aid.forceNs > 0 || S.aid.torqueRate > 0) ? ` · 선언된 밖 도움: 세우는 토크 평균 ${S.aid.torqueRate.toFixed(1)} (최고 ${S.aid.peakNm.toFixed(0)}) N·m · 드는 힘 ÷ 체중 ${(100 * S.aid.liftShare).toFixed(1)} %` : ''}${fp ? ` · 기준 판과 지문 차이 ${fp.length} 줄` : ''}`);
    if (fp && kind === 'stand') for (const d of fp.slice(0, 30)) lines.push(`      ${d.slice(0, 150)}`);
    try { G.world.free(); } catch { /* */ }
  }
  return { ok, lines };
}
const f = (x, d = 2) => (x == null ? '-' : (+x).toFixed(d));
const report = { root: ROOT, n: N, offset: OFFSET, solo: {}, fight: null, honesty: null };
if (!args.nohonesty) { const hf = await honestyFirst(); report.honesty = hf; console.log(`정직 먼저 (honesty.mjs · ${WEAPONS[0]}): ${hf.ok ? '통과' : '불합격 — 아래 통과 몫은 정직한 몸의 것이 아니다'}`); for (const l of hf.lines) console.log(l); }
for (const [k, v] of Object.entries(MORE)) if (args.more || ONLY?.has(k) || (args.holes && k in HOLES)) SCENES[k] = v; // 싸움 꼴 장면은 부를 때만
const names = Object.keys(SCENES).filter((k) => (args.holes && !ONLY && !args.more ? k in HOLES : !ONLY || ONLY.has(k) || (args.more && k in MORE) || (args.holes && k in HOLES)));
if (names.length) console.log(`다리 시험 묶음 · ${ROOT} · 장면마다 ${N} 번 · 흔듦 묶음 ${OFFSET} ~ ${OFFSET + N - 1} (통과 = 안 넘어짐 + 시킨 일을 함 · 가운데값: 넘어진 때 s · 빠르기 m/s · 시킨 쪽 빠르기 m/s · 걸은 길 m · 기울기 최고 ° · 칼끝 최고 m/s)`);
for (const w of WEAPONS) {
  for (const k of names) {
    const S = SCENES[k], rs = [];
    for (let i = 0; i < N; i++) rs.push(solo(w, i, S.secs, S.drive, { pre: S.pre, keepGoing: S.keepGoing, ...S.opt }));
    const ok = rs.filter((r) => S.ok(r)).length;
    const row = { ok, n: N, notFell: rs.filter((r) => !r.fell).length, along: med(rs.filter((r) => !r.fell).map((r) => (k === 'back' || k === 'slowback' ? -r.alongF : /^strafe/.test(k) ? Math.abs(r.alongR) : r.alongF))), path: med(rs.filter((r) => !r.fell).map((r) => r.path)), headErr: med(rs.filter((r) => r.headErr != null).map((r) => r.headErr)), tFall: med(rs.filter((r) => r.fell).map((r) => r.tFall)), sat: rs.filter((r) => r.fell && r.sat).length, speed: med(rs.filter((r) => !r.fell).map((r) => r.speed)), tilt: med(rs.map((r) => r.tiltMax)), tip: med(rs.filter((r) => !r.fell).map((r) => r.tipMax)), net: med(rs.map((r) => r.net)), extra: med(rs.filter((r) => r.extra != null).map((r) => r.extra)) };
    if (S.cnt) { row.did = rs.filter((r) => r.extra != null && r.extra !== 0).length; row.aux = med(rs.filter((r) => r.aux != null).map((r) => r.aux)); row.oks = rs.map((r) => (S.ok(r) ? 1 : 0)).join(''); } // 구멍 메우기 장면: 그 일이 일어난 판 수 · 둘째 셈 · 판마다 통과
    if (S.more) { Object.assign(row, S.more(rs)); row.oks ??= rs.map((r) => (S.ok(r) ? 1 : 0)).join(''); } // 다시 판정한 장면(11/24 검토): 그 장면의 확인 셈을 줄 끝 · JSON 에 붙임 (옛 칸 이름은 그대로)
    (report.solo[w] ||= {})[k] = row;
    if (args.runs) for (const [i, r] of rs.entries()) console.log(`      #${i + OFFSET} ${S.ok(r) ? '통과' : '실패'} ${JSON.stringify({ fell: r.fell, tFall: r.tFall, alongF: r.alongF, path: r.path, yMin: r.yMin, tilt: r.tiltMax, extra: r.extra, aux: r.aux, chk: r.chk, headErr: r.headErr })}`); // --runs: 판마다 한 줄 (왜 실패했나 볼 때)
    if (!args.quiet) console.log(`  ${w.padEnd(11)} ${k.padEnd(18)} ${String(ok).padStart(2)}/${N} (안 넘어짐 ${row.notFell})  넘어진 때 ${f(row.tFall).padStart(5)}${row.sat ? ` (주저앉음 ${row.sat})` : ''} · 빠르기 ${f(row.speed).padStart(5)} · 시킨 쪽 ${f(row.along).padStart(5)} · 길 ${f(row.path, 1).padStart(5)} m · 기울기 ${f(row.tilt, 0).padStart(3)}° · 칼끝 ${f(row.tip, 1).padStart(5)}${k === 'turn' ? ` · 바라봄 오차 ${f(row.headErr, 0)}°` : ''}${k === 'getup' ? ` · 일어선 때 ${f(row.extra)}` : ''}${S.cnt ? ` · ${S.cnt} ${f(row.extra)} (${row.did}/${N} 판)${S.auxName ? ` · ${S.auxName} ${f(row.aux)}` : ''}` : ''}${S.tail ? S.tail(row) : ''}`);
  }
}
// ── 싸움 ──
if ((!ONLY || ONLY.has('fight')) && FIGHTS > 0) {
  const F = { fights: FIGHTS, secs: FSECS, falls: 0, selfFalls: 0, sits: 0, rose: 0, dead: 0, wounds: 0, opened: 0, standShare: 0, upShare: 0, neverFell: 0, firstSelf: [], minutes: 0 };
  for (let seed = 1; seed <= FIGHTS; seed++) {
    const G = H.newRound({ walls: true, seed: seed + OFFSET, weapon: FW[(seed - 1) % FW.length], weapon2: FW[seed % FW.length], AI2Class: H.AI });
    const fs = [G.player, G.enemy].map((x) => ({ f: x, prev: 'stand', lastWound: -9, lowFor: 0, downAt: null, upFor: 0, standSteps: 0, upSteps: 0, steps: 0, firstSelf: null, firstFall: null, sat: false }));
    G.onWound = (att, vic) => { const e = fs.find((x) => x.f === vic); if (e) e.lastWound = G.t; };
    let nW0 = 0;
    const n = Math.round(FSECS / DT);
    for (let i = 0; i < n; i++) {
      G.step();
      for (const e of fs) {
        const st = e.f.state; if (st === 'dead') continue;
        e.steps++; if (st === 'stand') e.standSteps++;
        const y = e.f.bodies.pelvis.translation().y; e.lowFor = y < 0.5 ? e.lowFor + DT : 0;
        if (y > 0.7 && e.f.tiltDeg() < 45) e.upSteps++; // 몸으로 본 '서 있음'(상태 이름과 무관 · 골반 0.7 m 위 · 가슴 기울기 45° 안)
        const fallNow = (e.prev === 'stand' && (st === 'down' || st === 'getup')) || (st === 'stand' && e.lowFor > 0.25 && !e.sat);
        if (st === 'stand' && e.lowFor > 0.25) { if (!e.sat) F.sits++; e.sat = true; } else if (y > 0.6) e.sat = false;
        if (fallNow) { F.falls++; const self = G.t - e.lastWound > 1.5; e.firstFall ??= +G.t.toFixed(1); if (self) { F.selfFalls++; e.firstSelf ??= +G.t.toFixed(1); } e.downAt = G.t; e.upFor = 0; }
        if (e.downAt != null) { if (st === 'stand' && y > 0.6) { e.upFor += DT; if (e.upFor > 2) { F.rose++; e.downAt = null; } } else e.upFor = 0; }
        e.prev = st;
      }
      if (G.player.state === 'dead' || G.enemy.state === 'dead') { F.dead++; break; }
    }
    for (const e of fs) { F.upShare += e.upSteps / Math.max(1, e.steps) / (2 * FIGHTS); if (e.firstFall == null) F.neverFell++; F.standShare += e.standSteps / Math.max(1, e.steps) / (2 * FIGHTS); F.minutes += (e.steps * DT) / 60; if (e.firstSelf != null) F.firstSelf.push(e.firstSelf); }
    F.wounds += G.wounds.length; F.opened += G.wounds.filter((x) => x.type !== 'blunt' && x.severity > 0).length; nW0 += 0;
    try { G.world.free(); } catch { /* */ }
  }
  report.fight = { ...F, selfFallsPerMin: +(F.selfFalls / Math.max(1e-9, F.minutes)).toFixed(2), fallsPerMin: +(F.falls / Math.max(1e-9, F.minutes)).toFixed(2), standShare: +F.standShare.toFixed(3), upShare: +F.upShare.toFixed(3), firstSelfMed: med(F.firstSelf) };
  const X = report.fight;
  console.log(`  싸움 ${FIGHTS} 판 × ${FSECS} s (${FW.join(' · ')} · AI 대 AI · 씨앗 ${1 + OFFSET} ~): 넘어짐 ${F.falls} (분당 ${X.fallsPerMin}) · 그중 스스로 ${F.selfFalls} (분당 ${X.selfFallsPerMin} · 처음 때 가운데값 ${f(X.firstSelfMed, 1)} s) · 서 있음인 채 주저앉음 ${F.sits} · 다시 일어섬 ${F.rose}/${F.falls} · 서 있던 몫 ${(100 * X.standShare).toFixed(1)} % (몸으로 본 몫 ${(100 * X.upShare).toFixed(1)} % · 한 번도 안 넘어진 몸 ${F.neverFell}/${2 * FIGHTS}) · 죽음 ${F.dead}/${FIGHTS} · 상처 ${F.wounds} (살을 가른 것 ${F.opened})`);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(report, null, 1));
