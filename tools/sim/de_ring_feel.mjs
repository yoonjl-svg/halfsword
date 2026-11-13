// ─────────────────────────────────────────────────────────────
//  de_ring_feel.mjs — 칼 씨름 1] (링엔 암 슈베르트 — 11/14 · config DE_DIRTY.ring · docs/strike/de_dirty_2026-11-14.md) 몸 길 재기
//   재기만 한다(게임 값은 이 프로세스 안에서만). 사람 몸(0 번 — humanInput · 독일 롱소드 · 스킬트리 모두)이 가슴 사이 ~0.9 m 에서 상대(AI 끔 · 서 있음 · 기력 지침)를 민다 →
//   묶임 안 칼 씨름 → 줄마다(0.05 s): 가슴 사이 · 상대 골반 물러남 · 상대 두 손(칼 손 · 빈손)의 몸통 옆 바깥 거리(상대 몸 틀 — 몸통 가운데에서 옆으로) · 상대 칼끝 높이 · 무너짐 시계
//  node tools/sim/de_ring_feel.mjs [--ring=1] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, CONFIG, THREE } from './harness_m.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k;
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
/** 몸 틀(가슴 — 앞 x · 옆 z) 손 자리: 몸통 가운데에서 옆(+ = 그 몸 오른쪽 · 칼 쪽) */
function sideOf(f, part) {
  const c = f.bodies.chest.translation();
  const r = f.bodies.chest.rotation();
  const p = f.bodies[part].translation();
  _v.set(p.x - c.x, p.y - c.y, p.z - c.z).applyQuaternion(_q.set(r.x, r.y, r.z, r.w).invert());
  return { fwd: +_v.x.toFixed(3), up: +_v.y.toFixed(3), side: +(_v.z * (f.side ?? 1)).toFixed(3) };
}
const PARTS = ['head', 'chest', 'abdomen', 'pelvis', 'uarmS', 'farmS', 'uarmO', 'farmO', 'thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'];
/** 두 몸의 마디 가운데 · 칼(손 → 칼끝) — 그림용 (세계 좌표) */
function poseOf(f) {
  const o = {};
  for (const k of PARTS) { const t = f.bodies[k].translation(); o[k] = [+t.x.toFixed(3), +t.y.toFixed(3), +t.z.toFixed(3)]; }
  const h = f.sword.translation();
  const tip = f.bladePoint(1, new THREE.Vector3());
  o.hilt = [+h.x.toFixed(3), +h.y.toFixed(3), +h.z.toFixed(3)];
  o.tip = [+tip.x.toFixed(3), +tip.y.toFixed(3), +tip.z.toFixed(3)];
  return o;
}
export function ringRun({ ring = 1, gap = 0.85, seed = 4, weapon = 'longsword', dur = 2.0, foeStamina = -10, poseAt = null, again = false } = {}) { // again: 칼 씨름 뒤에도 스틱을 앞으로 밂 (무너진 상대에게 다시 밀치기 — 11/14 사장님 '또 나가야')
  const keep = { ...CONFIG.DE_DIRTY };
  CONFIG.DE_DIRTY.ring = ring ? 1 : 0;
  const G = newRound({ weapon, seed, gap, kit: kitFromNodes('german', allNodeIds('german')), onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  try {
    G.ai.update = () => {};
    const P = G.player, A = G.enemy;
    P.canShove = true;
    for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.4) / CONFIG.PHYSICS.timestep); i++) G.step();
    A.stamina.value = foeStamina; // 지침 (0 아래)
    const rows = [];
    const poses = [];
    let tRing = null, tPress = null, end = null, ringFrame = null, againInfo = null, shoves0 = null;
    const T = dur * K;
    for (let t = 0; t <= T + 1e-9; t += CONFIG.PHYSICS.timestep) {
      const push = tRing == null || again ? 0.9 : 0; // 칼 씨름 뒤엔 스틱을 놓음 (again 이면 계속 밂 — 쿨타임 안 새 밀치기가 무너진 상대를 더 밂)
      P.move.set(0, push); P.stickX = 0; P.stickY = push;
      A.stamina.value = Math.min(A.stamina.value, foeStamina);
      G.step();
      if (tPress == null && P.barge?.phase === 'press') tPress = t / K;
      if (tRing == null && A.ringHit) {
        tRing = t / K;
        const R = A.ringHit;
        ringFrame = { x0: R.x0, z0: R.z0, dx: R.dx, dz: R.dz };
      }
      if (poseAt && tRing != null) for (const at of poseAt) if (!poses.some((q) => q.at === at) && t / K >= tRing + at - 1e-9) poses.push({ at, P: poseOf(P), A: poseOf(A), ring: !!A.ringHit });
      if (!end && P.bargeEnd && !P.barge && tPress != null) end = P.bargeEnd;
      if (again && tRing != null && !againInfo && P.barge && P.shoves > shoves0) againInfo = { shoves: P.shoves - shoves0, hold: P.barge.hold, ringHit: !!A.ringHit, t: +(t / K - tRing).toFixed(3) };
      if (tRing != null && shoves0 == null) shoves0 = P.shoves;
      const ti = Math.round(t / K / 0.05);
      if (Math.abs(t / K - ti * 0.05) < CONFIG.PHYSICS.timestep / K / 2) {
        const tip = A.bladePoint(1, new THREE.Vector3());
        rows.push({ t: +(ti * 0.05).toFixed(2), d: +P.foeDistance().toFixed(3), ring: !!A.ringHit, moved: A.ringHit?.moved != null ? +A.ringHit.moved.toFixed(3) : null, handS: sideOf(A, 'farmS'), handO: sideOf(A, 'farmO'), tipY: +tip.y.toFixed(3), foeState: A.state });
      }
    }
    const after = rows.filter((r) => tRing != null && r.t >= tRing);
    if (poseAt && tRing == null && rows.length) poses.push({ at: 0, P: poseOf(P), A: poseOf(A), ring: false });
    return { ring, tPress, tRing, end, ringFrame, poses, again: againInfo, contact: P.swordArt.measure.contact, d0: rows[0]?.d, dRing: after[0]?.d ?? null, dMax: after.length ? Math.max(...after.map((r) => r.d)) : null, fell: rows.some((r) => r.foeState !== 'stand'), indesRing: P.schoolPassive?.stats.indes.ring ?? 0, rows };
  } finally {
    G.world.free();
    Object.assign(CONFIG.DE_DIRTY, keep);
  }
}
if (isMain(import.meta.url)) {
  const arg = (k, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const out = [ringRun({ ring: 1, poseAt: [0, 0.2, 0.4, 0.6] }), ringRun({ ring: 0 })];
  for (const r of out) {
    console.log(`칼 씨름 ${r.ring ? '켬' : '끔'} — 누르기 ${r.tPress} s · 칼 씨름 ${r.tRing} s · 밀치기 끝 ${r.end} · 가슴 사이 시작 ${r.d0} → 그때 ${r.dRing} → 가장 멀리 ${r.dMax} (칼 거리 contact ${r.contact.toFixed(2)}) · 상대 넘어짐 ${r.fell} · 그 순간 창 ${r.indesRing}`);
    const show = r.rows.filter((x) => r.tRing == null || (x.t >= r.tRing - 0.1 && x.t <= r.tRing + 0.8));
    for (const x of show.filter((_, i) => i % 2 === 0).slice(0, 10)) console.log(`  ${x.t.toFixed(2)} s d ${x.d} 물러남 ${x.moved ?? '–'} · 칼 손 옆 ${x.handS.side} 앞 ${x.handS.fwd} · 빈손 옆 ${x.handO.side} 앞 ${x.handO.fwd} · 칼끝 높이 ${x.tipY} · 무너짐 ${x.ring}`);
  }
  const json = arg('json', null);
  if (json) writeFileSync(json, JSON.stringify(out));
}
