// 대기실 몸(src/lobby_rig.js) ↔ 실제 판의 플레이어 — 무기를 든 겨눔 자세가 같은가 (docs/import/ui_fix_2026-10-16.md §6)
//  판: harness_m newRound(플레이어 = 그 무기 · 상대 롱소드 · 상대 AI 멈춤 — 둘 다 판 시작 자리에 서 있기만) · 대기실 몸: 상대 없는 작은 세계에 같은 Fighter
//  둘 다 같은 검술 층 값(main.js newRound 의 플레이어 — 보정 0.7 · corr · autoGuard)으로 t 초 서 있은 뒤, 골반 기준 몸 틀(앞 x · 위 y · 오른쪽 z)에서 잰다:
//   손목(아래팔 끝 = 칼 원점) · 칼끝 · 칼날 축 · 칼 면 · 몸 부위 14 곳 · 골반 높이. 자세가 서는 때 = 손목·칼끝이 0.1 s 동안 1 mm 안으로 움직이는 마지막 고비 뒤 첫 때
//   (판 시작 발 묶임 RIG.hold 뒤 자세 고쳐 딛기로 다시 움직이므로 그 뒤만 본다)
//  node tools/sim/lobby_rig_probe.mjs [무기,무기,…] [초]     (기본 나뭇가지 · 롱소드 · 츠바이핸더 · RIG.settle 6 s — 발 묶임 2 s 뒤 자세 고쳐 딛기까지)
import { newRound, RAPIER, THREE, CONFIG, DT } from './harness_m.mjs';
import { LOOKS } from '../../src/looks.js';
import { createLobbyRig, RIG } from '../../src/lobby_rig.js';

const ids = (process.argv[2] || 'tree_branch,longsword,zweihander').split(',');
const T = +(process.argv[3] || RIG.settle);
const skill = { level: 0.7, corr: CONFIG.SKILL.corr, corrTip: CONFIG.SKILL.corrTip, autoGuard: true };
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
function pose(f) {
  const pv = V(f.bodies.pelvis.translation()), inv = f.yaw.clone().invert();
  const loc = (p) => p.clone().sub(pv).applyQuaternion(inv);
  const sq = Q(f.sword.rotation());
  const parts = {};
  for (const [k, b] of Object.entries(f.bodies)) parts[k] = loc(V(b.translation()));
  return {
    pelvisY: pv.y,
    wrist: loc(new THREE.Vector3(0.13, 0, 0).applyQuaternion(Q(f.bodies.farmS.rotation())).add(V(f.bodies.farmS.translation()))),
    tip: loc(f.bladePoint(1)),
    axis: new THREE.Vector3(0, 1, 0).applyQuaternion(sq).applyQuaternion(inv),
    flat: new THREE.Vector3(0, 0, 1).applyQuaternion(sq).applyQuaternion(inv),
    parts,
  };
}
const deg = (a, b) => THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));
const cm = (a, b) => +(a.distanceTo(b) * 100).toFixed(2);
const r3 = (v) => [v.x, v.y, v.z].map((x) => +x.toFixed(3));
const rows = [];
for (const id of ids) {
  // 판 (상대 AI 멈춤)
  const G = newRound({ weapon: id, weapon2: 'longsword', seed: 7 });
  Object.assign(G.player.skill, skill);
  G.ai.update = () => {};
  const steps = Math.round(T / DT);
  for (let i = 0; i < steps; i++) G.step();
  const fight = pose(G.player);
  G.world.free();
  // 대기실 몸 — 0.1 s 마다 움직임을 재며
  const t0 = performance.now();
  const rig = createLobbyRig(RAPIER, new THREE.Group(), { look: LOOKS.player, weapon: id, skill });
  const build = performance.now() - t0;
  let prev = pose(rig.fighter), still = null, stepMs = 0;
  const trace = [];
  for (let k = 1; k * 0.1 <= T + 1e-9; k++) {
    const s0 = performance.now();
    rig.step(Math.round(0.1 / DT));
    stepMs += performance.now() - s0;
    const p = pose(rig.fighter);
    const move = Math.max(cm(p.wrist, prev.wrist), cm(p.tip, prev.tip));
    trace.push([+(k * 0.1).toFixed(1), move]);
    if (move >= 0.1) still = null; else if (still == null) still = +(k * 0.1).toFixed(1);
    if (Math.abs(k * 0.1 - T) < 1e-6) rows.push({ id, rigAtT: p });
    prev = p;
  }
  const lobby = rows.find((r) => r.id === id && r.rigAtT).rigAtT;
  const partDiff = Math.max(...Object.keys(fight.parts).map((k) => cm(fight.parts[k], lobby.parts[k])));
  const out = {
    weapon: id, t: T, still,
    wristCm: cm(fight.wrist, lobby.wrist), tipCm: cm(fight.tip, lobby.tip),
    axisDeg: +deg(fight.axis, lobby.axis).toFixed(2), flatDeg: +deg(fight.flat, lobby.flat).toFixed(2),
    partsMaxCm: partDiff, pelvisYcm: +((fight.pelvisY - lobby.pelvisY) * 100).toFixed(2),
    fight: { wrist: r3(fight.wrist), tip: r3(fight.tip) }, lobby: { wrist: r3(lobby.wrist), tip: r3(lobby.tip) },
    buildMs: +build.toFixed(1), stepMsPer0_1s: +(stepMs / trace.length).toFixed(2),
    moveCmPer0_1s: trace.filter(([t]) => [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 5.5, 6].includes(t)),
  };
  rig.dispose();
  console.log(JSON.stringify(out));
}
