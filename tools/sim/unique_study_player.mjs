// 고유 공격 실험 C (2026-10-20 감독 — docs/strike/unique_attack_study_result_2026-10-20.md) — 플레이어 강화 세기(UNIQUE_ASSIST.enhance 0 · 1 · 2) (설계서 §4 C, 절반 규모) · SCHOOL · ENH · SEEDS · OPPS · DELAYS · OUT
//  손가락 봇: 유파 고리 긋기(고유 공격이 여는 바탕 동작) 60 % · 다른 기본 긋기 40 % · 그은 뒤 40 % 되긋기(잇기 조건) · 공격 결정의 15 % 는 탭 찌르기.
//  막기: 상대 칼이 빠르게 움직이면 반응 지연 뒤 0.6~1.0 s 막기 단추(유파 막기). 이동: 1.35~1.85 m 간격 유지.
import { newRound, DT, AI } from './harness_m.mjs';
import { SKILL, UNIQUE_ASSIST as UA } from '../../src/config.js';
import { PlayerUniqueAssist, PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { TECH, G as PAD } from '../../src/ai_techniques.js';
import { traditionOf } from '../../src/schools.js';
import { WEAPONS } from '../../src/weapons.js';
import { observeHealth } from './chinese_benefit_model.mjs';
import { flowGuard } from './japanese_flow_model.mjs';
import { writeFileSync } from 'node:fs';
const SCH = { german: 'longsword', italian: 'rapier', iberian: 'zweihander', japanese: 'monohoshizao', chinese: 'qinggang' };
const OPP = ['longsword', 'uchigatana', 'zweihander', 'qinggang', 'rapier', 'flamberge'];
const school = process.env.SCHOOL, enh = +(process.env.ENH ?? 1), out = process.env.OUT;
const seeds = (process.env.SEEDS ?? '801,802,803').split(',').map(Number), opps = (process.env.OPPS ?? OPP.join(',')).split(',');
const delays = (process.env.DELAYS ?? '0.12,0.22').split(',').map(Number);
const W = SCH[school]; if (!W) throw new Error('school ' + school);
const trad = traditionOf(WEAPONS[W]);
const FRAME = 2 * DT;
const BASE = [...TECH.map((t) => ({ name: t.name, from: t.from, path: t.path })), { name: 'langortDown', from: PAD.langort, path: [[0.02, -0.22]] }];
const ringNames = new Set();
for (const e of PLAYER_UNIQUE[trad] ?? []) for (const c of e.on ?? []) { if (c.tech) ringNames.add(c.tech); if (c.pad === 'langort' && c.dir === 'down') ringNames.add('langortDown'); if (c.prev && TECH.find((t) => t.name === c.prev)) ringNames.add(c.prev); }
const RING = BASE.filter((b) => ringNames.has(b.name)), OTHER = BASE.filter((b) => !ringNames.has(b.name));
// 걸음 명령 (10/21 강화동작 · 명령): 그 걸음 기술의 기본 동작을 그을 때 절반은 스틱을 옆(동방은 앞)으로 민 채 — 손을 시작 자리로 옮기는 동안부터 0.8 s
const STEP_CMD = {};
for (const e of PLAYER_UNIQUE[trad] ?? []) if (e.role === 'step') for (const c of e.on ?? []) if (c.tech) STEP_CMD[c.tech] = e.stick;
const rows = [];
for (const seed of seeds) for (const opp of opps) for (const delay of delays) {
  const t0 = Date.now();
  let rs = (seed * 7919 + Math.round(delay * 1000)) >>> 0; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  SKILL.parryAssist = 0;
  const Gm = newRound({ weapon: W, weapon2: opp, seed });
  const D = Gm.player, A = Gm.enemy;
  D.skill.corr = SKILL.corr; D.skill.corrTip = SKILL.corrTip; D.skill.autoGuard = true; D.schoolFootwork = true; D.schoolParry = true;
  const Guard = flowGuard('base'), guard = new Guard(D, A); D.stamina.controller = guard;
  const ua0 = UA.on, en0 = UA.enhance; UA.on = 1; UA.enhance = enh;
  const uq = new PlayerUniqueAssist(D, { stage: 4 });
  const hD = observeHealth(D, () => Gm.t), hA = observeHealth(A, () => Gm.t);
  // 손가락 행동 줄: 프레임마다 {dx, dy, held}
  let cmd = null, queue = [], fx = D.handOffset.x, fy = D.handOffset.y, nextAtk = 2.6, due = Infinity, heldUntil = 0, lastMotion = -1, notice = false, strokes = 0, taps = 0;
  const to = (p, v, held) => { const fr = []; let x = fx, y = fy; for (let k = 0; k < 400; k++) { const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, v * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, held]); } fx = x; fy = y; return fr; };
  const stroke = (b, back) => { let fr = to(b.from, 1.6, false); fr.push(...Array(4).fill([0, 0, false])); for (const p of b.path) fr.push(...to(p, 4, true)); if (back) { fr.push(...Array(3).fill([0, 0, true])); fr.push(...to(b.from, 4, true)); } fr.push(...Array(6).fill([0, 0, false])); return fr; };
  let step = 0;
  Gm.before = () => {
    const t = Gm.t, dist = D.foeDistance();
    const motion = dist < 2.2 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (motion) { lastMotion = t; if (!notice && !guard.held && due === Infinity && !queue.length) { due = t + delay + rnd() * 0.08; notice = true; } } else if (t - lastMotion > 0.3) notice = false;
    if (t >= due) { heldUntil = t + 0.6 + rnd() * 0.4; due = Infinity; }
    guard.held = t < heldUntil && !queue.length && !D.skill.tap; guard.broken = !!(D.skill.tap || D.skill.pom || queue.length);
    if (!guard.held && !queue.length && t >= nextAtk && dist < 2.0 && D.alive && D.armed && !D.stamina.exhausted) {
      if (rnd() < 0.15) { if (D.skill.thrust()) taps++; }
      else { const b = rnd() < 0.6 && RING.length ? RING[Math.floor(rnd() * RING.length)] : OTHER[Math.floor(rnd() * OTHER.length)]; queue = stroke(b, rnd() < 0.4); strokes++; if (STEP_CMD[b.name] && rnd() < 0.5) cmd = { until: t + 0.8, x: STEP_CMD[b.name] === 'side' ? (rnd() < 0.5 ? -1 : 1) : 0, y: STEP_CMD[b.name] === 'fwd' ? 1 : 0 }; }
      nextAtk = t + 1.0 + rnd() * 0.6;
    }
    guard.step(DT); D.inputActive = guard.active;
    if ((step++ & 1) === 0) {
      const f = queue.shift() ?? [0, 0, false];
      const u = D.skill.uniq; u?.feed(f[0], f[1], FRAME, false);
      if (!(u ? u.holdsHand ?? u.running : false)) { D.handOffset.x += f[0]; D.handOffset.y += f[1]; }
      D.handHeld = f[2]; if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) D.inputActive = true;
      if (!queue.length) { fx = D.handOffset.x; fy = D.handOffset.y; }
    }
    if (D.stamina.exhausted || !D.alive) D.move.set(0, 0); else if (cmd && t < cmd.until) D.move.set(cmd.x, cmd.y); else D.move.set(0.18 * Math.sin(t * 0.65 + seed), dist < 1.35 ? -0.55 : dist > 1.85 ? 0.45 : 0);
    D.stickX = D.move.x; D.stickY = D.move.y;
  };
  let end = 30;
  for (let i = 0; i < 30 / DT; i++) { Gm.step(); hD.step?.(DT, guard); hA.step?.(DT); if ((!D.alive || !A.alive) && end === 30) end = Gm.t + 0.5; if (Gm.t >= end) break; }
  const fD = hD.finish ? hD.finish() : hD, fA = hA.finish ? hA.finish() : hA;
  UA.on = ua0; UA.enhance = en0;
  const sev = (l) => +l.reduce((s, h) => s + (h.severity ?? 0), 0).toFixed(3);
  rows.push({ school, enh, seed, opp, delay, dur: +Gm.t.toFixed(2), pAlive: D.alive, eAlive: A.alive,
    recvSev: sev(fD.applied), recvLimb: +(fD.limbLost ?? 0).toFixed(3), recvConc: +(fD.concussion ?? 0).toFixed(3), recvBleed: +(fD.bleedAdded ?? 0).toFixed(4),
    dealtSev: sev(fA.applied), dealtLimb: +(fA.limbLost ?? 0).toFixed(3), dealtConc: +(fA.concussion ?? 0).toFixed(3), dealtBleed: +(fA.bleedAdded ?? 0).toFixed(4),
    recvT: fD.applied.map((h) => [+h.t.toFixed(2), +(h.severity ?? 0).toFixed(3)]), dealtT: fA.applied.map((h) => [+h.t.toFixed(2), +(h.severity ?? 0).toFixed(3)]),
    strokes, taps, fired: { ...(uq.stats?.fired ?? {}) }, ms: Date.now() - t0 });
  console.log(JSON.stringify({ ...rows.at(-1), recvT: undefined, dealtT: undefined }));
  Gm.eventQueue.free?.(); Gm.world.free?.();
}
if (out) writeFileSync(out, JSON.stringify(rows));
