// 흘림 뒤 상대(공격자)가 얼마나 늦게 돌아오나 — 흘려 받기 켬·끔 같은 판 맞대기 (10/17 03:3x 사장님 '1번부터 재 보면서' — docs/strike/ukenagashi_talho_2026-10-17.md §12-3). 읽기만
//  막는 쪽 = 플레이어(우치가타나 · 일본 막기 책 · 막기 단추 누른 채 — 맞아도 다치지 않음, 치지 않음) · 치는 쪽 = AI 보통(제 판단대로 다가와 친다)
//  씨앗마다: 켬으로 돌려 첫 흘림 시각 tF 를 찾고, 같은 씨앗을 끔으로 tF + WIN 까지 돌린다(둘은 tF 까지 똑같다 — 그 순간 미는 힘만 다름)
//  tF 뒤 재는 것:
//   end   = 그 공격이 끝났다고 AI 가 보는 때(afterStrike — 칼끝이 6 m/s 밑으로 멈춤 등)까지
//   front = 상대 칼끝이 제 몸 앞(막을 자리: 앞 0.35 m 넘게 · 옆 0.45 m 안 · 가슴 −0.6 ~ +0.7 m)으로 돌아와 0.1 s 머물 때까지
//   next  = 다음 공격을 시작할 때까지
//   dtip  = 켬·끔 칼끝 자리 차이 (+0.1 · 0.2 · 0.3 · 0.5 · 0.8 s)
//  SEEDS=1-40 ATK=longsword GAP=2.2 TMAX=120 WIN=1.5 OUT=<json>
//  COUNT=1: 맞대기 없이 씨앗마다 TMAX 초를 켬으로만 돌려 칼끼리 새로 닿음 · 흘림 수만 센다 (실전 흘림 빈도 — docs/design/parry_reading_research_2026-10-17.md)
//  node tools/sim/flow_recover.mjs
import { newRound, DT } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { NAGASHI, SKILL } from '../../src/config.js';
import { PlayerParryGuard } from '../../src/parry_button.js';

const [s0, s1] = (process.env.SEEDS ?? '1-40').split('-').map(Number);
const ATK = process.env.ATK ?? 'longsword';
const GAP = +(process.env.GAP ?? 2.2);
const TMAX = +(process.env.TMAX ?? 120);
const WIN = +(process.env.WIN ?? 1.5);
const MARKS = [0.1, 0.2, 0.3, 0.5, 0.8];

function run(seed, on, stopAt) {
  NAGASHI.on = on ? 1 : 0;
  SKILL.parryAssist = 0;
  const Gm = newRound({ weapon: 'uchigatana', weapon2: ATK, seed, gap: GAP });
  const D = Gm.player, A = Gm.enemy, ai = Gm.ai;
  D.skill.corr = SKILL.corr;
  D.skill.corrTip = SKILL.corrTip;
  D.skill.autoGuard = true;
  D.applyWound = () => {};
  const guard = new PlayerParryGuard(D, A);
  guard.held = true;
  Gm.before = () => {
    guard.step(DT);
    D.inputActive = guard.active;
  };
  let flowT = null, fresh = 0, flows = 0;
  const prev = Gm.combat.hooks.onClash;
  Gm.combat.hooks.onClash = (point, sp, info) => {
    prev?.(point, sp, info);
    if (info.fresh) fresh++;
    if (info.nagashi) {
      flows++;
      if (flowT == null) flowT = Gm.t;
    }
  };
  const ends = [], starts = [];
  const as0 = ai.afterStrike.bind(ai);
  ai.afterStrike = (d) => (ends.push(Gm.t), as0(d));
  let lastMode = ai.mode;
  const track = [];
  const _t = new THREE.Vector3();
  while (Gm.t < TMAX && A.alive && D.alive) {
    Gm.step();
    if (ai.mode === 'attack' && lastMode !== 'attack') starts.push(Gm.t);
    lastMode = ai.mode;
    const tip = A.bladePoint(1, _t);
    const c = A.bodies.chest.translation(), cd = D.bodies.chest.translation();
    let fx = cd.x - c.x, fz = cd.z - c.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const dx = tip.x - c.x, dz = tip.z - c.z;
    track.push({ t: Gm.t, x: tip.x, y: tip.y, z: tip.z, fwd: dx * fx + dz * fz, lat: -dx * fz + dz * fx, h: tip.y - c.y, mode: ai.mode, phase: ai.phase });
    if (stopAt != null ? Gm.t >= stopAt : flowT != null && Gm.t >= flowT + WIN) break;
  }
  Gm.world.free();
  return { flowT, fresh, flows, ends, starts, track };
}

function after(r, tF) {
  const inFront = (p) => p.fwd > 0.35 && Math.abs(p.lat) < 0.45 && p.h > -0.6 && p.h < 0.7;
  let front = null, run0 = null;
  for (const p of r.track) {
    if (p.t < tF) continue;
    if (inFront(p)) {
      if (run0 == null) run0 = p.t;
      if (p.t - run0 >= 0.1) { front = run0 - tF; break; }
    } else run0 = null;
  }
  const end = r.ends.find((t) => t >= tF - 1e-9);
  const next = r.starts.find((t) => t > tF + 1e-9);
  return { front, end: end != null ? end - tF : null, next: next != null ? next - tF : null };
}

const out = [];
if (process.env.COUNT) {
  let F = 0, Nn = 0;
  for (let seed = s0; seed <= s1; seed++) {
    const r = run(seed, true, TMAX);
    F += r.fresh;
    Nn += r.flows;
    out.push({ seed, fresh: r.fresh, flows: r.flows });
    console.log(`seed ${seed}: 칼끼리 새로 닿음 ${r.fresh} · 흘림 ${r.flows}`);
  }
  console.log(`합: 칼끼리 새로 닿음 ${F} · 흘림 ${Nn} (${Nn ? (F / Nn).toFixed(1) : '—'} 번에 1 번)`);
  if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
  process.exit(0);
}
for (let seed = s0; seed <= s1; seed++) {
  const on = run(seed, true, null);
  if (on.flowT == null) {
    out.push({ seed, flow: false, fresh: on.fresh });
    console.log(`seed ${seed}: 흘림 없음 (칼끼리 새로 닿음 ${on.fresh})`);
    continue;
  }
  const off = run(seed, false, on.flowT + WIN);
  const tF = on.flowT;
  const a = after(on, tF), b = after(off, tF);
  const at = (r, t) => r.track.find((p) => p.t >= t - 1e-9);
  const dtip = MARKS.map((m) => {
    const p = at(on, tF + m), q = at(off, tF + m);
    return p && q ? +Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z).toFixed(3) : null;
  });
  const p0 = at(on, tF);
  const row = { seed, flow: true, tF: +tF.toFixed(3), freshBefore: on.fresh, mode: p0?.mode, phase: p0?.phase, on: a, off: b, dtip };
  out.push(row);
  const f = (v) => (v == null ? '—' : v.toFixed(3));
  console.log(`seed ${seed}: tF ${tF.toFixed(2)} (${p0?.mode}/${p0?.phase}) | 공격 끝 켬 ${f(a.end)} · 끔 ${f(b.end)} | 몸 앞으로 켬 ${f(a.front)} · 끔 ${f(b.front)} | 다음 공격 켬 ${f(a.next)} · 끔 ${f(b.next)} | 칼끝 차이 ${dtip.map((d) => (d == null ? '—' : d.toFixed(2))).join(' ')}`);
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
