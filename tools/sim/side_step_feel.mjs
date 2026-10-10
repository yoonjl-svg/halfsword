// 옆걸음 조작감 (10/10 이베리아·중국 걸음 1 단계 — docs/strike/school_gait_iberian_chinese_2026-10-10.md): 플레이어 스틱을 옆 끝까지 2.5 s 밀었을 때
//  몸이 얼마나 많이·고르게 옆으로 가나를 유파 걸음 끔/켬으로 견준다. 상대는 제자리에 세운다(AI 멈춤). 시작 정지 → 앞으로 밀어 상대 가슴 2.5·2.9 m →
//  0.8 s 쉼 → 왼(또는 오른) 끝까지 2.5 s. 가까움 둘 × 왼/오른 = 네 번 평균. 판마다 쉰 자리에서 시작한다(player_gait_feel 은 뒤→앞→왼→오른을 잇달아 밀어
//  '오른'이 '왼'에서 방향을 뒤집는 몫을 먹는다 — 이 도구는 옆만 따로).
//  칸: 2.5 s 간 길(골반 수평 경로 m) · 상대 둘레 돈 각(°) · 상대 거리 변화(m, + = 멀어짐 — 직선 옆걸음이 원 밖으로 새는지) · 옆 빠르기 평균(0.5 s 뒤, m/s) ·
//   변동(옆 빠르기 표준편차/평균 — 작을수록 매끄러움) · 반 빠르기 시간(s) · 걷는 몫 · walk 걸음 수(판마다)·빈도(/s) · 걸음당 옆(m, 디딘 발이 옆으로 옮긴 거리) ·
//   엇갈림(디딘 발이 딛고 있던 발 너머)·일찍 디딤(정한 시간 85 % 전)·catch 수(네 판 합) · reachSlow 몫(한 발로 설 때 엉덩이가 딛은 발보다 GAIT.reachSlow 넘게
//   앞선 시간 몫) · 첫 걸음이 뒤따르는 발(가는 쪽 반대 발)인 판 수 / 4
//  읽기만 — 물리·난수는 게임 그대로, 판 하나는 결정적. 걸음 시작 때 want 를 보려고 Gait.prototype.target 을 감싼다(값은 바꾸지 않음).
//  실행: node tools/sim/side_step_feel.mjs [무기id ...]   (기본 zweihander longsword qinggang)
//  손잡이(값 고르기용, src 그대로): GAIT_JSON='{"iberian":{"crossSide":0}}' → 그 유파 걸음 칸 덮음 · CONFIG_JSON='{"sideFactor":0.403}' → GAIT 전역 덮음 · ONLY1=1 → 켬만
import { newRound, DT, THREE } from './harness_m.mjs';
import { GAIT } from '../../src/config.js';
import { Gait } from '../../src/gait.js';
import { TRADITIONS } from '../../src/schools.js';
if (process.env.GAIT_JSON) for (const [t, o] of Object.entries(JSON.parse(process.env.GAIT_JSON))) TRADITIONS[t].gait = { ...(TRADITIONS[t].gait ?? {}), ...o };
if (process.env.CONFIG_JSON) for (const [k, v] of Object.entries(JSON.parse(process.env.CONFIG_JSON))) GAIT[k] = v;
const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['zweihander', 'longsword', 'qinggang'];
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
// target() 첫 부름(walk 걸음 시작)마다: want 의 옆 몫 · 뒤따르는 발인가 · 엇갈림 표시
let rec = null;
const T0 = Gait.prototype.target;
Gait.prototype.target = function (l, want, fwd, rgt, remain) {
  const first = l.t === 0 && l.kind === 'walk';
  T0.call(this, l, want, fwd, rgt, remain);
  if (rec && first && this.f === rec.who) {
    const wl = want.x * rgt.x + want.z * rgt.z;
    const sp = Math.hypot(want.x, want.z);
    rec.latF.push(sp > 0.05 ? Math.abs(wl) / sp : 0);
    rec.trail.push(l.side * Math.sign(wl) < 0 ? 1 : 0);
    rec.cross.push(l.cross ? 1 : 0);
  }
};

function run(id, school, near, mx) {
  const keep = GAIT.school;
  GAIT.school = school;
  const G = newRound({ walls: true, seed: 7, weapon: id, weapon2: 'longsword' });
  G.ai.update = () => G.enemy.move.set(0, 0);
  const P = G.player;
  const g = P.gait;
  let t = 0;
  const st = { F: true, B: true };
  const steps = [];
  const open = {};
  const step = (x, y, log) => {
    P.move.set(x, y);
    G.step();
    t += DT;
    if (!g?.active || !log) return;
    for (const k of ['F', 'B']) {
      const l = g.legs[k];
      if (st[k] && !l.stance) open[k] = { x: l.ankle.x, z: l.ankle.z, kind: l.kind, t0: t, T: l.T };
      else if (!st[k] && l.stance && open[k]) {
        const o = open[k];
        P.right(_r);
        const lat = (l.plant.x - o.x) * _r.x + (l.plant.z - o.z) * _r.z;
        const o2 = g.legs[k === 'F' ? 'B' : 'F'];
        const cross = ((l.plant.x - o2.plant.x) * _r.x + (l.plant.z - o2.plant.z) * _r.z) * l.side < 0;
        steps.push({ kind: o.kind, lat: lat * Math.sign(mx), cross, early: t - o.t0 < 0.85 * o.T, dur: t - o.t0 });
        open[k] = null;
      }
      st[k] = l.stance;
    }
  };
  while (t < 2.3) step(0, 0);
  const t1 = t;
  while (P.foeDistance() > near && t - t1 < 8) step(0, 1);
  for (let i = 0; i < 0.8 / DT; i++) step(0, 0);
  const d0 = P.foeDistance();
  const E = G.enemy.bodies.pelvis.translation();
  const p0 = P.bodies.pelvis.translation();
  const ang0 = Math.atan2(p0.z - E.z, p0.x - E.x);
  rec = { who: P, latF: [], trail: [], cross: [] };
  const vs = [];
  let arc = 0;
  let prev = { x: p0.x, z: p0.z };
  let walkT = 0;
  let rsT = 0;
  const HOLD = 2.5;
  for (let i = 0; i < HOLD / DT; i++) {
    step(mx, 0, true);
    const v = P.bodies.pelvis.linvel();
    P.right(_r);
    const vl = (v.x * _r.x + v.z * _r.z) * Math.sign(mx);
    if (t - t1 > 0) vs.push(vl);
    const p = P.bodies.pelvis.translation();
    arc += Math.hypot(p.x - prev.x, p.z - prev.z);
    prev = { x: p.x, z: p.z };
    if (g.walking) walkT += DT;
    {
      const sw = !g.legs.F.stance ? g.legs.F : !g.legs.B.stance ? g.legs.B : null;
      const stl = sw === g.legs.F ? g.legs.B : g.legs.F;
      if (sw && sw.kind !== 'req' && stl.stance) {
        const ah = ((stl.hip.x - stl.plant.x) * _r.x + (stl.hip.z - stl.plant.z) * _r.z) * Math.sign(mx);
        if (ah > GAIT.reachSlow) rsT += DT;
      }
    }
  }
  const p1 = P.bodies.pelvis.translation();
  const ang1 = Math.atan2(p1.z - E.z, p1.x - E.x);
  let dAng = ang1 - ang0;
  dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
  const dd = P.foeDistance() - d0;
  // 고른 몫(0.5 s 뒤): 옆 빠르기 평균·변동(표준편차/평균)
  const s = vs.slice(Math.round(0.5 / DT));
  const m = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) * (b - m), 0) / s.length);
  const peak = Math.max(...vs);
  const rise = (vs.findIndex((v) => v >= 0.5 * peak) + 1) * DT;
  const r = rec;
  rec = null;
  GAIT.school = keep;
  const wk = steps.filter((x) => x.kind === 'walk');
  return {
    rs: rsT / HOLD, first: r.trail[0] ?? NaN, arc, angDeg: Math.abs(dAng) * 57.3, dd, m, cv: sd / m, rise, walkShare: walkT / HOLD,
    nWalk: wk.length, nAll: steps.length, catches: steps.filter((x) => x.kind === 'catch').length,
    latMean: wk.reduce((a, b) => a + b.lat, 0) / Math.max(1, wk.length),
    cad: wk.length / Math.max(0.01, walkT), cross: wk.filter((x) => x.cross).length, early: wk.filter((x) => x.early).length,
    latFHi: r.latF.filter((x) => x > 0.5).length / Math.max(1, r.latF.length), trailShare: r.trail.reduce((a, b) => a + b, 0) / Math.max(1, r.trail.length),
  };
}
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
console.log(`옆걸음 조작감 · 스틱 옆 끝까지 2.5 s · 상대 세움 · 가까움 2.5/2.9 m × 왼/오른 = 4 번 평균 · sideFactor ${GAIT.sideFactor} · moveSpeed ${GAIT.moveSpeed}`);
console.log('| 무기 | 유파 걸음 | 2.5 s 간 길 m | 상대 둘레 돈 각 ° | 상대 거리 변화 m | 옆 빠르기 평균 m/s | 변동 (sd/평균) | 반 빠르기 s | 걷는 몫 | walk 걸음 수 · 빈도 /s | 걸음당 옆 m | 엇갈림 · 일찍 디딤 · catch | reachSlow 몫 | 첫 걸음 = 뒤따르는 발 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const id of ids) {
  for (const school of (process.env.ONLY1 ? [1] : [0, 1])) {
    const rs = [];
    for (const near of [2.5, 2.9]) for (const mx of [-1, 1]) rs.push(run(id, school, near, mx));
    const M = (k) => rs.reduce((a, b) => a + b[k], 0) / rs.length;
    const S = (k) => rs.reduce((a, b) => a + b[k], 0);
    console.log(`| ${id} | ${school ? '켬' : '끔'} | ${f2(M('arc'))} | ${M('angDeg').toFixed(1)} | ${f2(M('dd'))} | ${f2(M('m'))} | ${f2(M('cv'))} | ${f2(M('rise'))} | ${f2(M('walkShare'))} | ${(S('nWalk') / 4).toFixed(1)} · ${f2(M('cad'))} | ${f2(M('latMean'))} | ${S('cross')} · ${S('early')} · ${S('catches')} | ${f2(M('rs'))} | ${S('first')}/4 |`);
  }
}
