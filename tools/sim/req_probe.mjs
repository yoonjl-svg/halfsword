// ─────────────────────────────────────────────────────────────
//  req_probe.mjs — 기술이 부탁한 걸음(gait.requestStep) 하나하나를 따라가며 잰다 (물리 2.0 넷째 판 · docs/strike/physics2_notes/r4_req.md). 재기만 한다.
//
//   node tools/sim/req_probe.mjs [--root=<나무>] [--weapons=longsword,rapier,zweihander] [--n=8] [--offset=0] [--only=<꼴 이름,…>] [--json=<파일>] [--rows]
//   node tools/sim/req_probe.mjs --compare=<기준.json>,<견줄.json>      (두 나무를 같은 씨앗으로 잰 --json 둘을 견줌)
//
//  왜: 묶음(legs_battery.mjs)의 reqpass · reqlunge · lungecut · passcut 은 requestStep() 이 true 를 돌려준 수만 센다 — 발이 실제로 떴는지 · 어느 발이 얼마나 갔는지는 안 본다.
//  재는 것(부탁마다): 받았나 · 1 s 안에 'req' 걸음이 떴나 · 뜬 발이 그때 앞발인가 뒷발인가(골반 앞쪽으로 더 나가 있는 발 = 앞발) · 뗀 자리 → 디딘 자리의 수평 거리와 앞 · 옆 몫(뗄 때의 몸 틀) ·
//   부탁 → 뗌 시간 · 발 뜬 시간 · 부탁 뒤 1 s 동안 골반이 앞으로 간 거리(몸이 실렸나) · 그 뒤 다음 부탁까지 안 넘어졌나.
//  판 세우기 · 흔듦 · 넘어짐 규칙은 legs_battery.mjs 와 같은 식(판 씨앗 100 + i · 자리 잡는 시간 2.0 + 0.11 i s · 재기 0.5 s 앞 가슴 6 N·s · 골반 0.5 m 밑 0.25 s · 가슴 60° 0.25 s).
//  Fighter 의 공개 칸(move · gait.requestStep · gait.legs[k].stance · kind · bodies)만 쓰므로 --root 로 어느 나무(지금 게임 · 새 다리)에도 돈다.
//  견줌(--compare): 꼴 × 무기마다 기준 나무의 '많이 나온 발'과 그 발 걸음 길이의 가운데값을 과녁으로 — 견줄 나무의 부탁 가운데 (1 s 안에 뜸 + 같은 발 + 길이가 과녁의 ± 30 % 안)인 몫.
//   기준 나무 스스로의 그 몫(천장)도 같이 찍는다 — 걷는 중에는 기준 나무도 발 고르기가 갈린다.
//  다섯째 판에서 더한 것 (docs/strike/physics2_notes/r5_e2.md — 예전 꼴 · 예전 칸의 셈은 그대로):
//   ① 부탁 → 런지 발 뗌 시간의 가장 긴 값(줄 끝 '뗌 최대') ② 칼과 발의 때: 부탁마다 런지 발이 디딘 때(tLand) · 칼끝이 몸 앞쪽으로 가는 빠르기가 가장 컸던 때(tPeak — 부탁 ~ 디딤 뒤 0.6 s 창 · 빠르기 크기의 꼭대기 tAll 은 겨누며 칼끝을 돌리는 몫이 섞여 견줌용으로만 적는다) ·
//    선 과녁에 처음 상처를 낸 때(tHit) → 칼 닿음 − 발 디딤(blade = (tHit 있으면 tHit · 없으면 tPeak) − tLand). 팔 명령이 같이 나가는 꼴(t_ 로 시작 — 탭 찌르기 skill.thrust)에서만 뜻이 있다.
//   ③ 팔 명령 꼴: t_tap(선 채 탭 · 과녁 30 m 앞 — 닿지 않음) · t_wtap(걷다 탭) · t_tapHit(선 채 탭 · 과녁이 닿는 거리) · t_wtapHit(걸어 들어가다 닿을 거리에서 탭 — 판마다 첫 탭만).
//    과녁 = AI 없이 선 대본 몸. 사람 탭과 같은 들머리(humanInput · skill.thrust()).
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return b[b.length >> 1]; };
const f2 = (x) => (x == null ? '   -' : (+x).toFixed(2));

if (args.compare) { compare(...String(args.compare).split(',')); process.exit(0); }

const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const N = +(args.n ?? 8), OFFSET = +(args.offset ?? 0);
const WEAPONS = String(args.weapons ?? 'longsword,rapier,zweihander').split(',');
const ONLY = args.only ? new Set(String(args.only).split(',')) : null;
const H = await import(u('tools/sim/harness_m.mjs'));
let CFG = {}; try { CFG = await import(u('src/config.js')); } catch { /* */ }
const DT = H.DT, PUSH = CFG.SECRET?.stepPush ?? 2, BIG = CFG.SECRET?.italianStep ?? 0.9;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const fwdOf = (P) => { const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y), l = Math.hypot(fx, fz) || 1; return { x: fx / l, z: fz / l }; };
function hitChest(P, J, ang) { const f = fwdOf(P), c = Math.cos(ang), s = Math.sin(ang); P.bodies.chest.applyImpulse({ x: (f.x * c - f.z * s) * J, y: 0, z: (f.z * c + f.x * s) * J }, true); }
const footXZ = (P, k) => { const t = P.bodies['foot' + k].translation(); return { x: t.x, z: t.z }; };
const pelXZ = (P) => { const t = P.bodies.pelvis.translation(); return { x: t.x, z: t.z }; };
/** 골반 앞쪽으로 더 나가 있는 발 */
const frontKey = (P) => { const f = fwdOf(P), a = footXZ(P, 'F'), b = footXZ(P, 'B'); return (a.x - b.x) * f.x + (a.z - b.z) * f.z >= 0 ? 'F' : 'B'; };

/** 대본 과녁 (팔 명령 꼴): AI 없이 가만히 선 몸 */
class Dummy { constructor(me) { this.me = me; this.stats = {}; } update() { this.me.move.set(0, 0); this.me.stickX = 0; this.me.stickY = 0; } }
const chestGap = (G) => { const a = G.player.bodies.chest.translation(), b = G.enemy.bodies.chest.translation(); return Math.hypot(a.x - b.x, a.z - b.z); };
const tipSpeed = (P) => { const v = P.tipVel; return v ? Math.hypot(v.x, v.y, v.z) : 0; };

// ── 꼴: stick(t, ph, k) = 조종 [옆, 앞] · period = 부탁 사이(s) · reqs(P) = 한 주기 안의 부탁들 [{ at: 주기 시작 뒤 s, o: requestStep 인자 }] ──
const pulse = (t, ph, period) => { const k = (t - ph) / period; return Math.abs(k - Math.round(k)) * period < 0.3 && t > ph - 0.3; }; // 묶음 reqEvery 와 같은 꼴: 부탁 앞뒤 0.3 s 는 조종 끝까지
/** 옆 몫이 있는 기술 걸음의 발 고르기 — ai.js techStepRequest 와 같은 셈(비껴 가는 쪽 발이 앞발이면 lunge 아니면 pass) */
const sideKind = (P, lat) => { const fk = frontKey(P), g = P.gait; return Math.sign(g.legs[fk].side) === Math.sign(lat) ? 'lunge' : 'pass'; };
const CASES = {
  // 선 채(조종 0) — 사람 탭 찌르기 · 폼멜 걸음 · 줍기 반걸음 · AI 後の先 · 런지 되돌아오기
  i_lunge6: { period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: 0.6 } }] },
  i_pass6: { period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'pass', fwd: 0.6 } }] },
  i_tap: { period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: 0.45, duration: 0.3, push: PUSH } }] }, // 선 몸의 탭 찌르기 (skill.js:319 — 걸음 사다리 0.45 · 0.3 s · push 2)
  i_step3: { period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: 0.3, duration: 0.3 } }] }, // 폼멜 걸음 · 찌르기 걸음 0.3 (skill.js:321 · 544)
  i_retreat: { period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'retreat', fwd: -0.45, side: 0, duration: 0.3 } }] }, // AI 後の先 백스텝 (ai.js:4106)
  i_sideret: { period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'retreat', fwd: 0, side: 0.3, duration: 0.35 } }] }, // 몸 빼기 (secret_instant.js:2446)
  i_diag: { period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: 0.3, side: -0.3, duration: 0.3, push: PUSH } }] }, // 줍기 반걸음 꼴 (pickup.js:153)
  i_riso: { period: 3, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: BIG, side: 0, duration: 0.35, push: PUSH, accel: true } }, { at: 0.7, o: { kind: 'lunge', fwd: -0.5, side: 0, duration: 0.4, push: PUSH, accel: true } }] }, // 리솔루토 런지 + 앞발 되돌림 (skill.js:1012)
  i_two: { period: 3, stick: () => [0, 0], reqs: () => [{ at: 0, o: { kind: 'pass', fwd: 0.3, duration: 0.3 } }, { at: 0.4, o: { kind: 'lunge', fwd: 0.6, duration: 0.4 } }] }, // 0.4 s 사이 부탁 둘 (박자 걸음 → 베기 걸음 · 기다리던 부탁이 덮이는 꼴)
  b_small: { period: 1.6, stick: () => [0, -0.3], reqs: () => [{ at: 0, o: { kind: 'retreat', fwd: -0.15, side: 0, duration: 0.3 } }] }, // 뒤 스틱 −0.3 과 함께 준 작은 백스텝
  // 걷는 중(앞 0.45 · 부탁 앞뒤 0.3 s 는 1 — AI 가 베며 내딛는 꼴)
  w_lunge6: { period: 1.6, stick: (t, ph) => [0, pulse(t, ph, 1.6) ? 1 : 0.45], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: 0.6, duration: 0.4, accel: true } }] }, // 묶음 reqlunge 와 같은 부탁
  w_pass6: { period: 1.6, stick: (t, ph) => [0, pulse(t, ph, 1.6) ? 1 : 0.45], reqs: () => [{ at: 0, o: { kind: 'pass', fwd: 0.6, duration: 0.4 } }] }, // 묶음 reqpass
  w_lunge45: { period: 1.6, stick: (t, ph) => [0, pulse(t, ph, 1.6) ? 1 : 0.45], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: 0.45, duration: 0.3 } }] }, // AI 찌르기 걸음 (ai.js:4692 — 걷는 중이면 push 없음)
  w_pass3: { period: 1.6, stick: (t, ph) => [0, pulse(t, ph, 1.6) ? 1 : 0.45], reqs: () => [{ at: 0, o: { kind: 'pass', fwd: 0.3, duration: 0.3 } }] }, // 사람 베기 걸음 (skill.js:1455)
  w_retreat: { period: 1.6, stick: () => [0, 0.45], reqs: () => [{ at: 0, o: { kind: 'retreat', fwd: -0.5, side: 0, duration: 0.3 } }] }, // 다가가다 백스텝
  b_retreat: { period: 1.6, stick: () => [0, -0.45], reqs: () => [{ at: 0, o: { kind: 'retreat', fwd: -0.45, side: 0, duration: 0.3 } }] }, // 물러나며 백스텝
  w_sideR: { period: 1.6, stick: () => [0, 0.45], reqs: (P) => [{ at: 0, o: { kind: sideKind(P, 0.45), fwd: 0.3, side: 0.45, duration: 0.35 } }] }, // 비껴 딛기 오른쪽 (ai.js:4715)
  w_sideL: { period: 1.6, stick: () => [0, 0.45], reqs: (P) => [{ at: 0, o: { kind: sideKind(P, -0.45), fwd: 0.3, side: -0.45, duration: 0.35 } }] },
  d_lunge6: { period: 1.6, stick: () => [0.7, 0.45], reqs: () => [{ at: 0, o: { kind: 'lunge', fwd: 0.6, duration: 0.4 } }] }, // 비스듬히 걷는 중
  d_pass6: { period: 1.6, stick: () => [0.7, 0.45], reqs: () => [{ at: 0, o: { kind: 'pass', fwd: 0.6, duration: 0.4 } }] },
  // ── 팔 명령이 같이 나가는 꼴 (다섯째 판 — 칼과 발의 때): 사람 탭 찌르기 skill.thrust() 가 팔(겨눔 → 뻗기)과 런지 걸음 부탁을 함께 낸다. duo = 과녁까지 처음 간격(m) · far = 과녁을 그만큼 더 앞으로 치움(닿지 않게) ──
  t_tap: { arm: true, duo: 3, far: 30, period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, act: (P) => P.skill.thrust() }] }, // 선 채 탭 (묶음 tapthrust 의 탭 · 닿지 않음 → 칼끝 빠르기 꼭대기)
  t_wtap: { arm: true, duo: 3, far: 30, period: 1.6, stick: (t, ph) => [0, pulse(t, ph, 1.6) ? 1 : 0.45], reqs: () => [{ at: 0, act: (P) => P.skill.thrust() }] }, // 걷다 탭 (w_lunge45 와 같은 조종)
  t_tapHit: { arm: true, duo: (P) => P.swordArt.measure.reach + 0.15, once: true, period: 2.4, stick: () => [0, 0], reqs: () => [{ at: 0, act: (P) => P.skill.thrust() }] }, // 선 채 탭 · 과녁이 런지로 닿는 거리 (베기 닿는 간격 + 0.15 = 걸음 사다리 0.3 의 절반 — 두 나무에서 상처가 가장 자주 난 값) · 판마다 첫 탭만
  t_wtapHit: { arm: true, duo: 6, once: true, period: 99, stick: () => [0, 0.45], trigger: (P, G) => chestGap(G) <= P.swordArt.measure.reach + 0.6, reqs: () => [{ at: 0, act: (P) => P.skill.thrust() }] }, // 6 m 밖에서 걸어 들어가다(조종 0.45) 닿는 간격 + 걸음 사다리 0.6 안에 들면 탭 · 판마다 한 번
};

/** 한 판. 돌려줌: { fell, tFall, reqs: [{ t, kind, ok, lifted, dtLift, leg, role, roleAsk, dist, dF, dR, T, up }] } */
function run(weapon, variant0, C) {
  const variant = variant0 + OFFSET, secs = 10;
  const G = C.arm ? H.newRound({ walls: false, weapon, seed: 100 + variant, AIClass: Dummy, gap: 3 }) : H.newRound({ walls: false, weapon, seed: 100 + variant });
  if (!C.arm) G.park();
  const P = G.player, R = rng(1000 + variant * 7919);
  if (C.arm) {
    // 과녁을 꼴이 정한 간격으로 옮긴다 (처음 3 m 에서 앞으로) · far 면 그만큼 더 — 바라볼 곳은 과녁 그대로(곧은 앞)
    const gap = (typeof C.duo === 'function' ? C.duo(P) : C.duo) + (C.far ?? 0);
    for (const { rb } of G.enemy.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + gap - 3, y: t.y, z: t.z }, true); }
    P.humanInput = true;
  }
  const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); }
  const ph = 0.3 + 0.6 * R(), n = Math.round(secs / DT), out = [], done = new Set();
  let fell = false, tFall = null, lowFor = 0, tiltFor = 0, cur = null; // cur = 걸음을 기다리거나 따라가는 부탁
  let trigAt = null, wn = 0; // trigger 꼴: 조건이 처음 선 때 · 이미 본 상처 수
  const prev = { F: null, B: null };
  for (let i = 0; i < n && !fell; i++) {
    const t = i * DT, mv = C.stick(t, ph, P, G);
    P.move.set(mv[0], mv[1]);
    if (C.arm) { P.stickX = mv[0]; P.stickY = mv[1]; }
    if (C.trigger && trigAt == null && t >= ph && C.trigger(P, G)) trigAt = t;
    if (C.trigger ? trigAt != null : t >= ph) {
      const k = C.trigger ? 0 : Math.floor((t - ph) / C.period), t0 = C.trigger ? trigAt : ph + k * C.period;
      for (const [j, q] of C.reqs(P).entries()) {
        const key = k + ':' + j;
        if (t >= t0 + q.at && !done.has(key) && !(C.once && done.size > 0 && k > 0)) {
          done.add(key);
          const o = q.act ? { kind: 'lunge' } : typeof q.o === 'function' ? q.o(P) : { ...q.o };
          const foeUp = !C.arm || (G.enemy.state === 'stand' && G.enemy.alive);
          const ok = q.act ? !!q.act(P, G) : !!P.gait?.requestStep?.(o);
          if (q.act) { o.fwd = P.gait?.req?.fwd ?? null; o.side = P.gait?.req?.side ?? 0; }
          cur = { t: +t.toFixed(3), kind: o.kind, fwd: o.fwd, side: o.side ?? 0, ok, lifted: false, dtLift: null, leg: null, role: null, roleAsk: null, _fa: frontKey(P), dist: null, dF: null, dR: null, T: null, body: null, up: true, _open: ok && (!q.act || !!P.gait?.req), _b0: pelXZ(P), _bf: fwdOf(P),
            tLand: null, tPeak: null, vPeak: 0, tAll: null, vAll: 0, tHit: null, blade: null, gap: C.arm ? +chestGap(G).toFixed(2) : null, _arm: !!C.arm && ok, _foeUp: foeUp };
          out.push(cur);
        }
      }
    }
    G.step();
    // 칼과 발의 때 (팔 명령 꼴만): 칼끝 빠르기 꼭대기 — 부탁 ~ (디뎠으면 디딤 뒤 0.6 s · 아직이면 부탁 뒤 1.6 s) 창 · 선 과녁에 낸 첫 상처
    if (cur && cur._arm) {
      const dtq = t + DT - cur.t;
      if (dtq <= (cur.tLand != null ? cur.tLand + 0.6 : 1.6)) {
        const v = tipSpeed(P); if (v > cur.vAll) { cur.vAll = +v.toFixed(2); cur.tAll = +dtq.toFixed(3); } // 칼끝 빠르기 크기의 꼭대기 (겨누며 칼끝을 돌리는 몫이 섞인다 — 견줌용으로만 적음)
        const tv = P.tipVel, vf = tv ? tv.x * cur._bf.x + tv.z * cur._bf.z : 0; if (vf > cur.vPeak) { cur.vPeak = +vf.toFixed(2); cur.tPeak = +dtq.toFixed(3); } // 칼끝이 (부탁 때의) 몸 앞쪽으로 가는 빠르기의 꼭대기 = 찌르기가 나가는 때
      }
      for (; wn < G.wounds.length; wn++) { const w = G.wounds[wn]; if (w.att === P && cur.tHit == null && cur._foeUp && dtq <= 1.6) cur.tHit = +dtq.toFixed(3); }
    } else wn = G.wounds.length;
    // 걸음 뜸 · 디딤 (스텝 뒤의 걸음 상태로)
    const g = P.gait;
    for (const k of ['F', 'B']) {
      const l = g.legs[k], now = l.stance ? null : l.kind;
      if (now === 'req' && prev[k] !== 'req' && cur && cur._open && !cur.lifted && t - cur.t <= 1) {
        const fr = frontKey(P);
        cur.lifted = true; cur.dtLift = +(t - cur.t).toFixed(3); cur.leg = k; cur.role = k === fr ? 'front' : 'rear'; cur.roleAsk = k === cur._fa ? 'front' : 'rear';
        cur._p0 = footXZ(P, k); cur._f = fwdOf(P); cur._tl = t; cur._k = k;
      }
      if (prev[k] === 'req' && now !== 'req' && cur && cur.lifted && cur._k === k && cur.dist == null) {
        const p1 = footXZ(P, k), dx = p1.x - cur._p0.x, dz = p1.z - cur._p0.z;
        cur.dist = +Math.hypot(dx, dz).toFixed(3); cur.dF = +(dx * cur._f.x + dz * cur._f.z).toFixed(3); cur.dR = +(dx * -cur._f.z + dz * cur._f.x).toFixed(3); cur.T = +(t - cur._tl).toFixed(3);
        cur.tLand = +(t - cur.t).toFixed(3); // 부탁 → 런지 발 디딤
      }
      prev[k] = now;
    }
    for (const r of out) if (r._b0 && t - r.t >= 1) { const p = pelXZ(P); r.body = +((p.x - r._b0.x) * r._bf.x + (p.z - r._b0.z) * r._bf.z).toFixed(3); r._b0 = null; } // 부탁 뒤 1 s 동안 골반이 (부탁 때의) 앞으로 간 거리
    const y = P.bodies.pelvis.translation().y, st = P.state;
    lowFor = y < 0.5 ? lowFor + DT : 0; tiltFor = P.tiltDeg() > 60 ? tiltFor + DT : 0;
    if (st === 'down' || st === 'getup' || st === 'dead' || st === 'kneel' || lowFor > 0.25 || tiltFor > 0.25) { fell = true; tFall = +t.toFixed(2); if (cur) cur.up = false; }
  }
  for (const r of out) if (r._arm && r.tLand != null && (r.tHit ?? r.tPeak) != null) r.blade = +((r.tHit ?? r.tPeak) - r.tLand).toFixed(3); // 칼 닿음(없으면 칼끝 빠르기 꼭대기) − 런지 발 디딤
  for (const r of out) for (const k of Object.keys(r)) if (k[0] === '_') delete r[k];
  try { G.world.free(); } catch { /* */ }
  return { fell, tFall, reqs: out };
}

const report = { root: ROOT, n: N, offset: OFFSET, cases: {} };
console.log(`부탁 걸음 탐침 · ${ROOT} · 꼴마다 ${N} 판 · 흔듦 묶음 ${OFFSET} ~ ${OFFSET + N - 1}`);
console.log('  무기         꼴          부탁  받음  뜸(1 s 안)  앞발/뒷발   길이 가운데 [최소 ~ 최대] m   앞 몫   옆 몫   뗌까지 s  몸 앞 1 s  넘어진 판   | 뗌 최대 s · (팔 명령 꼴) 칼 − 발 가운데 [최소 ~ 최대] s · |칼 − 발| 가운데 · 닿은 탭 수');
for (const w of WEAPONS) for (const [name, C] of Object.entries(CASES)) {
  if (ONLY && !ONLY.has(name)) continue;
  const runs = []; for (let i = 0; i < N; i++) runs.push(run(w, i, C));
  const rq = runs.flatMap((r, i) => r.reqs.map((q, j) => ({ ...q, run: i + OFFSET, idx: j })));
  const lifted = rq.filter((q) => q.lifted), d = lifted.filter((q) => q.dist != null);
  (report.cases[name] ||= {})[w] = { fellRuns: runs.filter((r) => r.fell).length, tFall: runs.map((r) => r.tFall), reqs: rq };
  console.log(`  ${w.padEnd(11)}  ${name.padEnd(10)}  ${String(rq.length).padStart(3)}   ${String(rq.filter((q) => q.ok).length).padStart(3)}   ${String(lifted.length).padStart(3)}         ${String(lifted.filter((q) => q.role === 'front').length).padStart(2)}/${String(lifted.filter((q) => q.role === 'rear').length).padEnd(2)}      ${f2(med(d.map((q) => q.dist)))} [${d.length ? f2(Math.min(...d.map((q) => q.dist))) : "   -"} ~ ${d.length ? f2(Math.max(...d.map((q) => q.dist))) : "   -"}]        ${f2(med(d.map((q) => q.dF)))}   ${f2(med(d.map((q) => q.dR)))}   ${f2(med(lifted.map((q) => q.dtLift)))}      ${f2(med(rq.filter((q) => q.body != null).map((q) => q.body)))}     ${runs.filter((r) => r.fell).length}/${N}        | ${lifted.length ? f2(Math.max(...lifted.map((q) => q.dtLift))) : '   -'}${bladeTail(rq)}`);
  if (args.rows) for (const q of rq) console.log(`      #${q.run}.${q.idx} t ${q.t} ${q.kind} ${q.ok ? '받음' : '거절'} ${q.lifted ? `뜸 +${q.dtLift} s ${q.leg}(${q.role}) 길이 ${q.dist} 앞 ${q.dF} 옆 ${q.dR} T ${q.T}` : '안 뜸'}${q.blade != null ? ` · 디딤 +${q.tLand} 칼끝 앞 빠르기 꼭대기 +${q.tPeak} (${q.vPeak} m/s · 크기 꼭대기 +${q.tAll} ${q.vAll} m/s) 간격 ${q.gap}${q.tHit != null ? ` 상처 +${q.tHit}` : ''} 칼 − 발 ${q.blade}` : ''} · 몸 ${q.body}${q.up ? '' : ' · 넘어짐'}`);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(report));
/** 줄 끝: 칼 − 발 (팔 명령 꼴만) */
function bladeTail(rq) {
  const b = rq.filter((q) => q.blade != null).map((q) => q.blade);
  if (!b.length) return '';
  return ` · ${f2(med(b))} [${f2(Math.min(...b))} ~ ${f2(Math.max(...b))}] · ${f2(med(b.map(Math.abs)))} · ${rq.filter((q) => q.tHit != null).length}/${b.length}`;
}

/** 두 나무의 --json 을 견줌: 꼴 × 무기마다 기준의 많이 나온 발 · 그 발 걸음 길이 가운데값 → 견줄 나무의 맞는 몫 */
function compare(fa, fb) {
  const A = JSON.parse(readFileSync(fa, 'utf8')), B = JSON.parse(readFileSync(fb, 'utf8'));
  const lo = Math.max(A.offset, B.offset), hi = Math.min(A.offset + A.n, B.offset + B.n);
  console.log(`부탁 걸음 견줌 · 기준 ${A.root} · 견줄 ${B.root} · 같이 잰 흔듦 묶음 ${lo} ~ ${hi - 1}`);
  console.log('  (맞음 = 1 s 안에 뜸 + 기준의 많이 나온 발 + 길이가 기준 가운데값의 ± 30 % 안 · 부탁 수는 기준이 받은 부탁)');
  console.log('  꼴          무기         기준: 뜸  앞/뒤  길이    스스로 맞음 | 견줄: 받음  뜸  앞/뒤  길이    같은 발   맞음        넘어진 판(기준 → 견줄)   몸 앞 1 s m(기준 → 견줄)');
  const tot = { n: 0, hit: 0, foot: 0, lift: 0, self: 0 }, byCase = {};
  for (const name of Object.keys(A.cases)) for (const w of Object.keys(A.cases[name])) {
    const a0 = A.cases[name][w], b = B.cases[name]?.[w]; if (!b) continue;
    const a = { ...a0, reqs: a0.reqs.filter((q) => q.run >= lo && q.run < hi), fellRuns: a0.tFall.slice(lo - A.offset, hi - A.offset).filter((x) => x != null).length }; // 두 나무가 같이 잰 판(같은 씨앗)만
    const la = a.reqs.filter((q) => q.lifted), nf = la.filter((q) => q.role === 'front').length, role = nf * 2 >= la.length ? 'front' : 'rear';
    const ref = med(la.filter((q) => q.role === role && q.dist != null).map((q) => q.dist));
    const hit = (q) => q.lifted && q.role === role && q.dist != null && ref != null && Math.abs(q.dist - ref) <= 0.3 * ref;
    const n = a.reqs.filter((q) => q.ok).length, lb = b.reqs.filter((q) => q.lifted);
    const sa = a.reqs.filter(hit).length, sb = b.reqs.filter(hit).length, fb2 = lb.filter((q) => q.role === role).length;
    tot.n += n; tot.hit += sb; tot.foot += fb2; tot.lift += lb.length; tot.self += sa;
    const c = (byCase[name] ||= { n: 0, hit: 0, self: 0 }); c.n += n; c.hit += sb; c.self += sa;
    console.log(`  ${name.padEnd(10)}  ${w.padEnd(11)}  ${String(la.length).padStart(3)}/${String(n).padEnd(3)} ${String(nf).padStart(2)}/${String(la.length - nf).padEnd(2)}  ${f2(ref)}    ${String(sa).padStart(3)}/${String(n).padEnd(3)}   |      ${String(b.reqs.filter((q) => q.ok).length).padStart(3)}  ${String(lb.length).padStart(3)}  ${String(lb.filter((q) => q.role === 'front').length).padStart(2)}/${String(lb.filter((q) => q.role === 'rear').length).padEnd(2)}  ${f2(med(lb.filter((q) => q.role === role && q.dist != null).map((q) => q.dist)))}    ${String(fb2).padStart(3)}/${String(n).padEnd(3)}  ${String(sb).padStart(3)}/${String(n).padEnd(3)} ${(100 * sb / Math.max(1, n)).toFixed(0).padStart(3)} %   ${a.fellRuns} → ${b.fellRuns}   ${f2(med(a.reqs.filter((q) => q.body != null).map((q) => q.body)))} → ${f2(med(b.reqs.filter((q) => q.body != null).map((q) => q.body)))}`);
  }
  console.log('  ── 꼴마다 (세 무기 합): 맞음 견줄 / 기준 스스로 / 부탁');
  for (const [k, c] of Object.entries(byCase)) console.log(`  ${k.padEnd(10)}  ${String(c.hit).padStart(3)} / ${String(c.self).padStart(3)} / ${String(c.n).padEnd(3)}  ${(100 * c.hit / Math.max(1, c.n)).toFixed(0).padStart(3)} %  (기준 스스로 ${(100 * c.self / Math.max(1, c.n)).toFixed(0)} %)`);
  console.log(`  합계: 부탁 ${tot.n} · 견줄 나무 뜸 ${tot.lift} (${(100 * tot.lift / tot.n).toFixed(1)} %) · 같은 발 ${tot.foot} (${(100 * tot.foot / tot.n).toFixed(1)} %) · 맞음 ${tot.hit} (${(100 * tot.hit / tot.n).toFixed(1)} %) · 기준 스스로 맞음 ${tot.self} (${(100 * tot.self / tot.n).toFixed(1)} %)`);
}
