// 휘두르는 동안 몸 돌림 묶기 측정 (10/21 사장님 '1번 해' — config SWING_TURN · 시험 스위치)
//  플레이어(대본) 대 AI(normal · 여섯 무기). 플레이어는 간격(1.45~1.8 m)만 지키고 서 있다가, AI 가 공격을 시작한 뒤(칼 드는 windup — 이어 베기는 다시 들어오는 approach ·
//  그 뒤 긋기는 0.1 s 남짓) DODGE s 에 옆으로 0.4 s 비킨다(스틱 옆 끝 — 이베리아는 옆 박차기 첫 걸음 · 왼 · 오른 번갈아). 비킨 뒤 바로 탭 찌르기 한 번(되받기).
//  DODGE=none 은 비키지 않고 0.15 + 0.4 s 에 탭만 · DODGE=circle 은 늘 옆으로 돌며(2.5 s 마다 방향 바꿈) 같은 때에 탭. AI 공격(들어옴 → 긋기 → 따라 긋기) 하나마다: 그동안(+0.3 s) 플레이어가 입은 칼날 상처 ·
//  긋기 시작 때 AI 정면과 '플레이어 쪽' 사이 각(°) · 탭 뒤 0.8 s 안 AI 가 입은 상처.
//  TURN=off | 30 | 60 (°/s) · FROM=windup | approach | strike · DASH=1(비킬 때 sideDash 직접) · WALKSIDE=0|1 · FWDDEG=<°> · REACT=<s> · BURST=<옆 박차기 m/s> · TWIST=<허리 한도 rad> · DODGE=none | circle | 0 | 0.15 | 0.3 · WEAPON · SEEDS · OPPS · SECS(판 길이, 기본 20) · OUT
import { newRound, DT } from './harness_m.mjs';
import { SWING_TURN, GAIT, AI_REACT } from '../../src/config.js';
import { writeFileSync } from 'node:fs';
const OPP = ['longsword', 'uchigatana', 'zweihander', 'qinggang', 'rapier', 'flamberge'];
const turn = process.env.TURN ?? 'off', from = process.env.FROM ?? 'windup', dodgeEnv = process.env.DODGE ?? 'none', W = process.env.WEAPON ?? 'zweihander', out = process.env.OUT;
const seeds = (process.env.SEEDS ?? '901,902,903').split(',').map(Number), opps = (process.env.OPPS ?? OPP.join(',')).split(',');
const DASH = process.env.DASH === '1'; // 비킬 때 옆 박차기 명령(gait.sideDash — 이베리아만 · 사람의 두 번 누름과 같은 몫)
const SECS = +(process.env.SECS ?? 20), circle = dodgeEnv === 'circle', dodge = dodgeEnv === 'none' || circle ? null : +dodgeEnv;
Object.assign(SWING_TURN, turn === 'off' ? { on: false } : { on: true, rate: +turn, from });
if (process.env.BURST) GAIT.burstSideV = +process.env.BURST; // 옆 박차기 첫 걸음 목표 빠르기(m/s, 판 값 1.5 — 이베리아만)
if (process.env.TWIST) GAIT.maxTwist = +process.env.TWIST; // 발 안 옮기고 허리로 도는 한도(rad, 판 값 0.9)
if (process.env.WALKSIDE) GAIT.burstWalkSide = +process.env.WALKSIDE; // 옆 누르면 첫 걸음 박차기(판 값 1)
if (process.env.FWDDEG) GAIT.burstFwdDeg = +process.env.FWDDEG; // 비스듬히 앞으로 박차기 각(°, 판 값 30)
if (process.env.REACT) Object.assign(AI_REACT, { on: +process.env.REACT > 0, face: +process.env.REACT || AI_REACT.face }); // AI 반응 시간 s(판 값 0.2 · 0 = 끔)
const angTo = (E, P) => {
  const pe = E.bodies.pelvis.translation(), pp = P.bodies.pelvis.translation(), f = E.forward();
  const vx = pp.x - pe.x, vz = pp.z - pe.z;
  return +((Math.acos(Math.max(-1, Math.min(1, (f.x * vx + f.z * vz) / Math.hypot(vx, vz)))) * 180) / Math.PI).toFixed(1);
};
const rows = [];
for (const seed of seeds) for (const opp of opps) {
  const t0 = Date.now();
  const G = newRound({ weapon: W, weapon2: opp, seed });
  const P = G.player, E = G.enemy, ai = G.ai;
  P.schoolFootwork = true; P.schoolParry = true; P.skill.autoGuard = true;
  const units = []; let cur = null, lastPh = '', side = 1;
  G.onWound = (att, vic, r) => {
    const sev = r.severity ?? 0;
    for (const u of units) {
      const until = (u.tE ?? u.tA + 1.5) + 0.3;
      if (vic === P && att === E && G.t >= u.tA && G.t <= until) { u.hit = true; u.sev += sev; }
      if (vic === E && att === P && u.tapT > 0 && G.t >= u.tapT && G.t <= u.tapT + 0.8) { u.counter = true; u.csev += sev; }
    }
  };
  G.before = () => {
    const t = G.t, d = P.foeDistance();
    const ph = ai.mode === 'attack' ? ai.phase : ai.mode;
    if (ph !== lastPh) {
      if ((ph === 'windup' || (ph === 'approach' && lastPh !== 'windup')) && P.alive && E.alive) { cur = { tA: t, tS: null, tE: null, hit: false, sev: 0, counter: false, csev: 0, angS: null, angE: null, tapT: null, side }; units.push(cur); side = -side; }
      if (ph === 'strike' && cur && cur.tS == null) { cur.tS = t; cur.angS = angTo(E, P); }
      if (lastPh === 'strike' && cur && cur.tE == null) { cur.tE = t; cur.angE = angTo(E, P); }
      lastPh = ph;
    }
    let mx = circle ? (Math.floor(t / 2.5) % 2 ? -1 : 1) : 0, my = d < 1.45 ? -0.5 : d > 1.8 ? 0.45 : 0; // circle = 늘 옆으로 돈다(2.5 s 마다 방향 바꿈 · 간격은 지킴)
    if (cur) {
      const age = t - cur.tA, at = dodge ?? 0.15;
      if (dodge != null && age >= at && age < at + 0.4) {
        mx = cur.side; my = 0;
        if (cur.p0 == null) { const pp = P.bodies.pelvis.translation(); cur.p0 = { x: pp.x, z: pp.z }; cur.r0 = E.right(); if (DASH) cur.dash = P.gait?.sideDash?.(cur.side) ?? false; }
        if ((P.gait?.fastK ?? 1) > 1) cur.fast = true;
      }
      if (cur.p0 && cur.lat == null && age >= at + 0.4) { const pp = P.bodies.pelvis.translation(); cur.lat = +Math.abs((pp.x - cur.p0.x) * cur.r0.x + (pp.z - cur.p0.z) * cur.r0.z).toFixed(3); }
      if (cur.tapT == null && age >= at + 0.4) cur.tapT = P.skill.thrust() ? t : -1;
      if (age > 2.5) cur = null;
    }
    if (!P.alive || P.state !== 'stand') { mx = 0; my = 0; }
    P.move.set(mx, my); P.stickX = mx; P.stickY = my;
  };
  let end = SECS;
  for (let i = 0; i < SECS / DT; i++) { G.step(); if ((!P.alive || !E.alive) && end === SECS) end = G.t + 0.5; if (G.t >= end) break; }
  const U = units.filter((u) => u.tS != null);
  rows.push({ turn, from, dash: DASH, walkSide: GAIT.burstWalkSide, fwdDeg: GAIT.burstFwdDeg, react: AI_REACT.on ? AI_REACT.face : 0, burst: GAIT.burstSideV, twist: GAIT.maxTwist, dodge: dodgeEnv, weapon: W, seed, opp, dur: +G.t.toFixed(2), pAlive: P.alive, eAlive: E.alive, attacks: U.length,
    hits: U.filter((u) => u.hit).length, sev: +U.reduce((s, u) => s + u.sev, 0).toFixed(3),
    counters: U.filter((u) => u.counter).length, csev: +U.reduce((s, u) => s + u.csev, 0).toFixed(3), taps: U.filter((u) => u.tapT > 0).length,
    dashes: U.filter((u) => u.dash).length, fast: U.filter((u) => u.fast).length, lat: U.filter((u) => u.lat != null).map((u) => u.lat),
    angS: U.map((u) => u.angS), angE: U.filter((u) => u.angE != null).map((u) => u.angE), appr: U.map((u) => +(u.tS - u.tA).toFixed(2)), ms: Date.now() - t0 });
  console.log(JSON.stringify({ ...rows.at(-1), angS: undefined, angE: undefined, appr: undefined, lat: undefined }));
  G.eventQueue.free?.(); G.world.free?.();
}
if (out) writeFileSync(out, JSON.stringify(rows));
