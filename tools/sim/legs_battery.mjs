// ─────────────────────────────────────────────────────────────
//  legs_battery.mjs — 다리 시험 묶음 (물리 2.0 · docs/strike/physics2_proto_round1_2026-11-24.md §6-1). 재기만 한다.
//
//   node tools/sim/legs_battery.mjs [--root=<트리>] [--n=8] [--offset=0] [--weapons=longsword,rapier,zweihander] [--only=stand,walk,…] [--fights=8] [--fightWeapons=a,b,…] [--secs=30] [--json=<파일>] [--quiet] [--nohonesty]
//
//  왜: 혼자 장면 한 번의 통과 · 넘어짐은 작은 차이로 뒤집힌다(시제품 셋 모두의 보고). 장면마다 시작 흔들림과 때를 바꿔 n 번 돌려 '안 넘어진 몫'으로 본다.
//  흔들림: 판 씨앗 · 자리 잡는 시간(2.0 s + 0.11 s × i) · 재기 0.5 s 앞에 가슴을 6 N·s 로 한 번 침(방향 137.5° × i). 모두 결정적 — 같은 인자면 같은 값.
//  넘어짐: 상태가 down · getup · dead · kneel 이 되거나, 골반이 0.5 m 아래로 0.25 s 넘게 내려가거나(서 있음인 채 주저앉음), 가슴이 60° 넘게 0.25 s 기울어짐(넘어짐 규칙을 지워도 잡히게).
//  통과: 안 넘어짐 + 시킨 일을 함 — 걷기류는 시킨 쪽으로 평균 빠르기 바닥(걷기 0.6 · 뒷걸음 0.4 · 옆걸음 0.25 m/s — 목표의 절반), 가다 서다 · 떠돌기 · 돌며 걷기는 걸은 길이 바닥, 돌기는 바라볼 쪽 오차 30° 안.
//  정직 먼저 (감사 11/24 대조 4): 이 도구는 구실만 잰다 — 숨은 받침을 다시 넣은 몸도 통과한다. 그래서 맨 앞에 같은 나무를 honesty.mjs 장부로 한 번 재서(서기 · 걷기) 몸 밖 관절 · 받침 · 밀기 · 쓰기 · 지문을 찍는다.
//  관문 판정은 짓는 동안 안 쓴 흔듦 묶음으로: --offset=100 --n=24 (기본 0 · 8 은 짓는 쪽 용).
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

/** 혼자 장면 한 번. drive(i, t, ctx) 가 스텝마다 입력을 건다. 돌려줌: { fell, tFall, sat, speed, net, tiltMax, tipMax, yMin, extra } */
function solo(weapon, variant0, secs, drive, opt = {}) {
  const variant = variant0 + OFFSET;
  const G = H.newRound({ walls: false, weapon, seed: 100 + variant });
  G.park();
  const P = G.player;
  if (STRENGTH != null) P.strength = STRENGTH; // 인물 힘 몫(숙련도 칸 — 싸움의 AI '보통' 몸은 0.65 · 혼자 장면 기본은 1)
  const R = rng(1000 + variant * 7919);
  const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  const ctx = { G, P, R, state: {}, FAM };
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
    yMin = Math.min(yMin, c.y);
    lowFor = c.y < 0.5 ? lowFor + DT : 0;
    const st = P.state;
    const tl = P.tiltDeg(); tiltFor = tl > 60 ? tiltFor + DT : 0;
    if (!fell && (st === 'down' || st === 'getup' || st === 'dead' || st === 'kneel' || lowFor > 0.25 || tiltFor > 0.25)) { fell = true; tFall = +(i * DT).toFixed(2); sat = st === 'stand'; }
    if (!fell) { tiltMax = Math.max(tiltMax, P.tiltDeg()); const tv = P.tipVel; if (tv) tipMax = Math.max(tipMax, Math.hypot(tv.x, tv.y, tv.z)); }
    if (fell && !opt.keepGoing) break;
  }
  const net = Math.hypot(cp.x - c0.x, cp.z - c0.z);
  const speed2 = half ? Math.hypot(cp.x - half.c.x, cp.z - half.c.z) / (secs / 2) : 0; // 뒤쪽 절반의 곧은 빠르기
  // 시킨 쪽으로 간 평균 빠르기 (재기 시작 때의 몸 앞 · 오른쪽 기준 — 장면 전체 시간으로 나눔)
  const dx = cp.x - c0.x, dz = cp.z - c0.z, along = { f: (dx * fwd0.x + dz * fwd0.z) / secs, r: (dx * -fwd0.z + dz * fwd0.x) / secs };
  const out = { fell, tFall, sat, net: +net.toFixed(3), speed: +speed2.toFixed(3), alongF: +along.f.toFixed(3), alongR: +along.r.toFixed(3), path: +path.toFixed(2), tiltMax: +tiltMax.toFixed(1), tipMax: +tipMax.toFixed(2), yMin: +yMin.toFixed(3), extra: ctx.state.extra ?? null, headErr: ctx.state.headErr ?? null };
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
  ctx.P.move.set(s.mv[0], s.mv[1]);
  faceAround(ctx, 0.5 * Math.sin(0.7 * t));
};
const reqEvery = (kind, o) => (i, t, c) => { // 1.6 s 마다 기술 걸음을 부탁 (걷는 조종 0.45 앞 · 부탁 앞뒤 0.3 s 는 조종 1 — AI 가 베며 내딛는 꼴)
  const s = c.state; s.ph ??= 0.4 + 0.8 * c.R(); const k = (t - s.ph) / 1.6, near = Math.abs(k - Math.round(k)) * 1.6 < 0.3 && t > s.ph - 0.3;
  c.P.move.set(0, near ? 1 : 0.45);
  if (t >= s.ph && Math.floor((t - s.ph) / 1.6) !== s.n) { s.n = Math.floor((t - s.ph) / 1.6); const ok = c.P.gait?.requestStep?.({ kind, ...o }); s.extra = (s.extra ?? 0) + (ok ? 1 : 0); }
};
const MORE = {
  slowwalk: { secs: 6, drive: (i, t, c) => c.P.move.set(0, 0.45), ok: (r) => !r.fell && r.alongF >= 0.15, speed: true },
  slowback: { secs: 6, drive: (i, t, c) => c.P.move.set(0, -0.45), ok: (r) => !r.fell && -r.alongF >= 0.1, speed: true },
  aistick: { secs: 14, drive: (i, t, c) => aiStick(c, t), ok: (r) => !r.fell && r.path >= 2 },
  reqpass: { secs: 10, drive: reqEvery('pass', { fwd: 0.6, duration: 0.4 }), ok: (r) => !r.fell && (r.extra ?? 0) >= 3 },
  reqlunge: { secs: 10, drive: reqEvery('lunge', { fwd: 0.6, duration: 0.4, accel: true }), ok: (r) => !r.fell && (r.extra ?? 0) >= 3 },
};
for (const fam of ['diagR']) { const S = stroke(fam); MORE['aistroke_' + fam] = { secs: 14, pre: S.pre, drive: (i, t, c) => { aiStick(c, t); S.step(c); }, ok: (r) => !r.fell && r.path >= 2, tip: true }; }
// 베며 내딛기 (AI 의 공격 들어가기 꼴 — 부탁 걸음과 베기가 겹침): 남은 첫 넘어짐 16 가운데 11 이 lunge · pass 부탁 + 다가가는 중, 끝에서 가슴이 골반보다 15 ~ 30° 더 숙어 있었음
for (const [nm, kind] of [['lungecut', 'lunge'], ['passcut', 'pass']]) { const S = stroke('diagR'), Rq = reqEvery(kind, { fwd: 0.6, duration: 0.4, accel: kind === 'lunge' }); MORE[nm] = { secs: 10, pre: S.pre, drive: (i, t, c) => { Rq(i, t, c); S.step(c); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 3, tip: true }; }
// 일어서기: 서 있는 몸을 쓰러뜨리고(knockDown — 게임 규칙의 쓰러짐) 14 s 안에 stand 로 돌아와, 밖 도움이 끝난 뒤 2 s 를 버티는가
let AID_AFTER = 0; try { AID_AFTER = (await import(u('src/config.js'))).AID?.after ?? 0; } catch { /* 옛 나무 */ } // 선언된 밖 도움이 선 뒤에도 이어지는 시간(있으면) — 버팀은 도움이 끝난 뒤부터 센다
SCENES.getup = { secs: 14, keepGoing: true, drive: (i, t, c) => { c.P.move.set(0, 0); const s = c.state; if (i === 0) c.P.knockDown(true); if (c.P.state === 'stand') { s.up = (s.up ?? 0) + DT; if (s.up > 2 + AID_AFTER && s.extra == null) s.extra = +(t - 2 - AID_AFTER).toFixed(2); } else s.up = 0; }, ok: (r) => r.extra != null }; // 일어선 때 = 선 상태가 된 때(도움이 끝난 뒤 2 s 를 버틴 판만)

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
for (const [k, v] of Object.entries(MORE)) if (args.more || ONLY?.has(k)) SCENES[k] = v; // 싸움 꼴 장면은 부를 때만
const names = Object.keys(SCENES).filter((k) => !ONLY || ONLY.has(k) || (args.more && k in MORE));
if (names.length) console.log(`다리 시험 묶음 · ${ROOT} · 장면마다 ${N} 번 · 흔듦 묶음 ${OFFSET} ~ ${OFFSET + N - 1} (통과 = 안 넘어짐 + 시킨 일을 함 · 가운데값: 넘어진 때 s · 빠르기 m/s · 시킨 쪽 빠르기 m/s · 걸은 길 m · 기울기 최고 ° · 칼끝 최고 m/s)`);
for (const w of WEAPONS) {
  for (const k of names) {
    const S = SCENES[k], rs = [];
    for (let i = 0; i < N; i++) rs.push(solo(w, i, S.secs, S.drive, { pre: S.pre, keepGoing: S.keepGoing }));
    const ok = rs.filter((r) => S.ok(r)).length;
    const row = { ok, n: N, notFell: rs.filter((r) => !r.fell).length, along: med(rs.filter((r) => !r.fell).map((r) => (k === 'back' ? -r.alongF : /^strafe/.test(k) ? Math.abs(r.alongR) : r.alongF))), path: med(rs.filter((r) => !r.fell).map((r) => r.path)), headErr: med(rs.filter((r) => r.headErr != null).map((r) => r.headErr)), tFall: med(rs.filter((r) => r.fell).map((r) => r.tFall)), sat: rs.filter((r) => r.fell && r.sat).length, speed: med(rs.filter((r) => !r.fell).map((r) => r.speed)), tilt: med(rs.map((r) => r.tiltMax)), tip: med(rs.filter((r) => !r.fell).map((r) => r.tipMax)), net: med(rs.map((r) => r.net)), extra: med(rs.filter((r) => r.extra != null).map((r) => r.extra)) };
    (report.solo[w] ||= {})[k] = row;
    if (!args.quiet) console.log(`  ${w.padEnd(11)} ${k.padEnd(18)} ${String(ok).padStart(2)}/${N} (안 넘어짐 ${row.notFell})  넘어진 때 ${f(row.tFall).padStart(5)}${row.sat ? ` (주저앉음 ${row.sat})` : ''} · 빠르기 ${f(row.speed).padStart(5)} · 시킨 쪽 ${f(row.along).padStart(5)} · 길 ${f(row.path, 1).padStart(5)} m · 기울기 ${f(row.tilt, 0).padStart(3)}° · 칼끝 ${f(row.tip, 1).padStart(5)}${k === 'turn' ? ` · 바라봄 오차 ${f(row.headErr, 0)}°` : ''}${k === 'getup' ? ` · 일어선 때 ${f(row.extra)}` : ''}`);
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
