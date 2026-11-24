// ─────────────────────────────────────────────────────────────
//  legs_battery.mjs — 다리 시험 묶음 (물리 2.0 · docs/strike/physics2_proto_round1_2026-11-24.md §6-1). 재기만 한다.
//
//   node tools/sim/legs_battery.mjs [--root=<트리>] [--n=8] [--weapons=longsword,rapier,zweihander] [--only=stand,walk,…] [--fights=8] [--secs=30] [--json=<파일>] [--quiet]
//
//  왜: 혼자 장면 한 번의 통과 · 넘어짐은 작은 차이로 뒤집힌다(시제품 셋 모두의 보고). 장면마다 시작 흔들림과 때를 바꿔 n 번 돌려 '안 넘어진 몫'으로 본다.
//  흔들림: 판 씨앗 · 자리 잡는 시간(2.0 s + 0.11 s × i) · 재기 0.5 s 앞에 가슴을 6 N·s 로 한 번 침(방향 137.5° × i). 모두 결정적 — 같은 인자면 같은 값.
//  넘어짐: 상태가 down · getup · dead 가 되거나, 골반이 0.5 m 아래로 0.25 s 넘게 내려감(서 있음인 채 주저앉음 — 넘어짐 규칙에 높이가 없어 따로 본다).
//  싸움: AI 대 AI. '스스로 넘어짐' = 넘어지기 앞 1.5 s 안에 받은 상처가 없는 넘어짐. 일어섬 = 넘어진 뒤 stand 로 돌아와 2 s 버팀.
//  이 도구는 몸에 시험 충격(가슴 치기)만 건다. Fighter 의 공개 칸(move · handOffset · state · faceTarget)만 쓰므로 어느 트리에도 --root 로 돌 수 있다.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const N = +(args.n ?? 8);
const WEAPONS = String(args.weapons ?? 'longsword,rapier,zweihander').split(',');
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const FIGHTS = +(args.fights ?? 8), FSECS = +(args.secs ?? 30);

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

/** 혼자 장면 한 번. drive(i, t, ctx) 가 스텝마다 입력을 건다. 돌려줌: { fell, tFall, sat, speed, net, tiltMax, tipMax, yMin, extra } */
function solo(weapon, variant, secs, drive, opt = {}) {
  const G = H.newRound({ walls: false, weapon, seed: 100 + variant });
  G.park();
  const P = G.player;
  const R = rng(1000 + variant * 7919);
  const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  const ctx = { G, P, R, state: {}, FAM };
  if (opt.pre) opt.pre(ctx);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt && !opt.noNudge) hitChest(P, 6, variant * 2.39996); G.step(); }
  const c0 = comOf(P), n = Math.round(secs / DT);
  let fell = false, tFall = null, sat = false, lowFor = 0, path = 0, cp = c0, tiltMax = 0, tipMax = 0, yMin = Infinity, half = null;
  for (let i = 0; i < n; i++) {
    drive(i, i * DT, ctx);
    G.step();
    const c = comOf(P);
    path += Math.hypot(c.x - cp.x, c.z - cp.z); cp = c;
    if (i === (n >> 1)) half = { c, path };
    yMin = Math.min(yMin, c.y);
    lowFor = c.y < 0.5 ? lowFor + DT : 0;
    const st = P.state;
    if (!fell && (st === 'down' || st === 'getup' || st === 'dead' || lowFor > 0.25)) { fell = true; tFall = +(i * DT).toFixed(2); sat = st === 'stand' || st === 'kneel'; }
    if (!fell) { tiltMax = Math.max(tiltMax, P.tiltDeg()); const tv = P.tipVel; if (tv) tipMax = Math.max(tipMax, Math.hypot(tv.x, tv.y, tv.z)); }
    if (fell && !opt.keepGoing) break;
  }
  const net = Math.hypot(cp.x - c0.x, cp.z - c0.z);
  const speed2 = half ? Math.hypot(cp.x - half.c.x, cp.z - half.c.z) / (secs / 2) : 0; // 뒤쪽 절반의 곧은 빠르기
  const out = { fell, tFall, sat, net: +net.toFixed(3), speed: +speed2.toFixed(3), tiltMax: +tiltMax.toFixed(1), tipMax: +tipMax.toFixed(2), yMin: +yMin.toFixed(3), extra: ctx.state.extra ?? null };
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
  walk: { secs: 6, drive: (i, t, c) => c.P.move.set(0, 1), ok: (r) => !r.fell, speed: true },
  back: { secs: 6, drive: (i, t, c) => c.P.move.set(0, -1), ok: (r) => !r.fell, speed: true },
  strafeR: { secs: 6, drive: (i, t, c) => c.P.move.set(1, 0), ok: (r) => !r.fell, speed: true },
  strafeL: { secs: 6, drive: (i, t, c) => c.P.move.set(-1, 0), ok: (r) => !r.fell, speed: true },
  stopgo: { secs: 16, drive: (i, t, c) => { const k = Math.floor(t / 2) % 4, go = t % 2 < 1.2, d = [[0, 1], [0, -1], [1, 0], [-1, 0]][k]; c.P.move.set(go ? d[0] : 0, go ? d[1] : 0); }, ok: (r) => !r.fell },
  wander: { secs: 20, drive: (i, t, c) => wander(c, t), ok: (r) => !r.fell },
  turn: { secs: 12, drive: (i, t, c) => { c.P.move.set(0, 0); const k = Math.floor(t / 2); faceAround(c, (k % 2 ? 1 : 0) * (Math.PI / 2) * (k % 4 < 2 ? 1 : -1)); }, ok: (r) => !r.fell },
  circle: { secs: 10, drive: (i, t, c) => { c.P.move.set(0.7, 0.5); faceAround(c, 0.6 * t); }, ok: (r) => !r.fell }, // 걸으며 바라보는 쪽이 돈다
  kick40: { secs: 5, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, ok: (r) => !r.fell },
  kick80: { secs: 5, drive: (i, t, c) => { c.P.move.set(0, 0); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 80, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, ok: (r) => !r.fell },
  walkkick: { secs: 6, drive: (i, t, c) => { c.P.move.set(0, 1); if (i === Math.round((1.5 + 1.0 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, ok: (r) => !r.fell },
};
for (const fam of ['diagR', 'vert', 'horizR']) {
  const S = stroke(fam);
  SCENES['stroke_' + fam] = { secs: 9, pre: S.pre, drive: (i, t, c) => { c.P.move.set(0, 0); S.step(c); }, ok: (r) => !r.fell, tip: true };
  SCENES['walkstroke_' + fam] = { secs: 12, pre: S.pre, drive: (i, t, c) => { wander(c, t); S.step(c); }, ok: (r) => !r.fell, tip: true };
}
// 일어서기: 서 있는 몸을 쓰러뜨리고(knockDown — 게임 규칙의 쓰러짐) 12 s 안에 stand 로 돌아와 2 s 버티는가
SCENES.getup = { secs: 14, keepGoing: true, drive: (i, t, c) => { c.P.move.set(0, 0); const s = c.state; if (i === 0) c.P.knockDown(true); if (c.P.state === 'stand') { s.up = (s.up ?? 0) + DT; if (s.up > 2 && s.extra == null) s.extra = +t.toFixed(2); } else s.up = 0; }, ok: (r) => r.extra != null };

const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const f = (x, d = 2) => (x == null ? '-' : (+x).toFixed(d));
const report = { root: ROOT, n: N, solo: {}, fight: null };
const names = Object.keys(SCENES).filter((k) => !ONLY || ONLY.has(k));
if (names.length) console.log(`다리 시험 묶음 · ${ROOT} · 장면마다 ${N} 번 (안 넘어진 몫 · 넘어진 때 가운데값 s · 빠르기 가운데값 m/s · 기울기 최고 가운데값 ° · 칼끝 최고 가운데값 m/s)`);
for (const w of WEAPONS) {
  for (const k of names) {
    const S = SCENES[k], rs = [];
    for (let i = 0; i < N; i++) rs.push(solo(w, i, S.secs, S.drive, { pre: S.pre, keepGoing: S.keepGoing }));
    const ok = rs.filter((r) => S.ok(r)).length;
    const row = { ok, n: N, tFall: med(rs.filter((r) => r.fell).map((r) => r.tFall)), sat: rs.filter((r) => r.fell && r.sat).length, speed: med(rs.filter((r) => !r.fell).map((r) => r.speed)), tilt: med(rs.map((r) => r.tiltMax)), tip: med(rs.filter((r) => !r.fell).map((r) => r.tipMax)), net: med(rs.map((r) => r.net)), extra: med(rs.filter((r) => r.extra != null).map((r) => r.extra)) };
    (report.solo[w] ||= {})[k] = row;
    if (!args.quiet) console.log(`  ${w.padEnd(11)} ${k.padEnd(18)} ${String(ok).padStart(2)}/${N}  넘어진 때 ${f(row.tFall).padStart(5)}${row.sat ? ` (주저앉음 ${row.sat})` : ''} · 빠르기 ${f(row.speed).padStart(5)} · 기울기 ${f(row.tilt, 0).padStart(3)}° · 칼끝 ${f(row.tip, 1).padStart(5)}${k === 'getup' ? ` · 일어선 때 ${f(row.extra)}` : ''}`);
  }
}
// ── 싸움 ──
if ((!ONLY || ONLY.has('fight')) && FIGHTS > 0) {
  const F = { fights: FIGHTS, secs: FSECS, falls: 0, selfFalls: 0, sits: 0, rose: 0, dead: 0, wounds: 0, opened: 0, standShare: 0, firstSelf: [], minutes: 0 };
  for (let seed = 1; seed <= FIGHTS; seed++) {
    const G = H.newRound({ walls: true, seed, weapon: WEAPONS[0], AI2Class: H.AI });
    const fs = [G.player, G.enemy].map((x) => ({ f: x, prev: 'stand', lastWound: -9, lowFor: 0, downAt: null, upFor: 0, standSteps: 0, steps: 0, firstSelf: null, sat: false }));
    G.onWound = (att, vic) => { const e = fs.find((x) => x.f === vic); if (e) e.lastWound = G.t; };
    let nW0 = 0;
    const n = Math.round(FSECS / DT);
    for (let i = 0; i < n; i++) {
      G.step();
      for (const e of fs) {
        const st = e.f.state; if (st === 'dead') continue;
        e.steps++; if (st === 'stand') e.standSteps++;
        const y = e.f.bodies.pelvis.translation().y; e.lowFor = y < 0.5 ? e.lowFor + DT : 0;
        const fallNow = (e.prev === 'stand' && (st === 'down' || st === 'getup')) || (st === 'stand' && e.lowFor > 0.25 && !e.sat);
        if (st === 'stand' && e.lowFor > 0.25) { if (!e.sat) F.sits++; e.sat = true; } else if (y > 0.6) e.sat = false;
        if (fallNow) { F.falls++; const self = G.t - e.lastWound > 1.5; if (self) { F.selfFalls++; e.firstSelf ??= +G.t.toFixed(1); } e.downAt = G.t; e.upFor = 0; }
        if (e.downAt != null) { if (st === 'stand' && y > 0.6) { e.upFor += DT; if (e.upFor > 2) { F.rose++; e.downAt = null; } } else e.upFor = 0; }
        e.prev = st;
      }
      if (G.player.state === 'dead' || G.enemy.state === 'dead') { F.dead++; break; }
    }
    for (const e of fs) { F.standShare += e.standSteps / Math.max(1, e.steps) / (2 * FIGHTS); F.minutes += (e.steps * DT) / 60; if (e.firstSelf != null) F.firstSelf.push(e.firstSelf); }
    F.wounds += G.wounds.length; F.opened += G.wounds.filter((x) => x.type !== 'blunt' && x.severity > 0).length; nW0 += 0;
    try { G.world.free(); } catch { /* */ }
  }
  report.fight = { ...F, selfFallsPerMin: +(F.selfFalls / Math.max(1e-9, F.minutes)).toFixed(2), fallsPerMin: +(F.falls / Math.max(1e-9, F.minutes)).toFixed(2), standShare: +F.standShare.toFixed(3), firstSelfMed: med(F.firstSelf) };
  const X = report.fight;
  console.log(`  싸움 ${FIGHTS} 판 × ${FSECS} s (${WEAPONS[0]} · AI 대 AI): 넘어짐 ${F.falls} (분당 ${X.fallsPerMin}) · 그중 스스로 ${F.selfFalls} (분당 ${X.selfFallsPerMin} · 처음 때 가운데값 ${f(X.firstSelfMed, 1)} s) · 서 있음인 채 주저앉음 ${F.sits} · 다시 일어섬 ${F.rose}/${F.falls} · 서 있던 몫 ${(100 * X.standShare).toFixed(1)} % · 죽음 ${F.dead}/${FIGHTS} · 상처 ${F.wounds} (살을 가른 것 ${F.opened})`);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(report, null, 1));
