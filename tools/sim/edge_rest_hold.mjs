// ─────────────────────────────────────────────────────────────
//  edge_rest_hold.mjs — 감는 자리에서 쥔 시간 → 출발 날 어긋남 (10/22 유파 공통 과제 — docs/strike/edge_rest_hold_2026-10-22.md)
//   사람 손가락 길(corr_lib inputPump — main.js 와 같은 입력 · 보정 v2 · 0.7 · playerEdge 'goal')로 감는 자리에 손을 옮기고(3 m/s) H ms 쥔 뒤 긋는다. 허공(칼 충돌 끔).
//   잰 값 (긋기 시작 = 손가락이 끝 쪽으로 움직이기 시작한 스텝):
//    쥔 끝 칼 면 ↔ 쉼 목표(칼 면 오른쪽) 각 · 쥔 끝 날 세우기 섞기(edgeMoving) · 쥔 끝 칼날 70 % 점 빠르기
//    출발 날 어긋남 = 긋기 시작 뒤 칼날 70 % 점이 처음 3 m/s 를 넘은 스텝의 칼 면 ↔ (칼 축 × 그 점 속도⊥) 각 (양날 — 0~90°)
//    맞춤 시간 = 긋기 시작부터 그 어긋남이 20° 밑으로 처음 내려온 때 (ms) · 앞 0.15 s 움직이는 칼(≥ 3 m/s) 어긋남 평균
//  node tools/sim/edge_rest_hold.mjs [--weapons=longsword,uchigatana,rapier,qinggang,zweihander] [--holds=0,150,300,600,1000] [--fams=hor,dDown,vDown] [--v=12,5] [--abl=…(iberian_flat 와 같은 시험 몇 개)] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { Input } from '../../src/input.js';
import { inputPump, feedTrace, stroke, setPad, setCorr, pacer, PAD } from './corr_lib.mjs';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const list = (k, d) => String(args[k] ?? d).split(',').filter(Boolean);
const WEAPONS = list('weapons', 'longsword,uchigatana,rapier,qinggang,zweihander');
const HOLDS = list('holds', '0,150,300,600,1000').map(Number);
const FAMS = list('fams', 'hor,dDown,vDown');
const VS = list('v', '12,5').map(Number);
const ABL = list('abl', '');
// 시험 (이 도구 안에서만): rest=… 은 config EDGE_REST (이 과제의 시험 스위치) 의 칸을 켠다 — 예 rest=pre · rest=kick · rest=pre+kick
for (const a of ABL) {
  const [k, v] = a.split('=');
  if (k === 'rest') {
    if (!CONFIG.EDGE_REST) throw new Error('이 트리에 EDGE_REST 가 없다');
    CONFIG.EDGE_REST.on = true;
    for (const x of v.split('+')) {
      if (!(x in CONFIG.EDGE_REST)) throw new Error(`EDGE_REST.${x}?`);
      CONFIG.EDGE_REST[x] = CONFIG.EDGE_REST[x] === false ? true : CONFIG.EDGE_REST[x];
    }
    CONFIG.EDGE_REST.modes = v.split('+');
  } else if (CONFIG.EDGE_REST && typeof CONFIG.EDGE_REST[k] === 'number') CONFIG.EDGE_REST[k] = Number(v); // 예 preV=4 · kickK=2 · kickT=0.2
  else throw new Error(`모르는 시험 ${a}`);
}
const F = {
  hor: { ch: PAD.Side, end: PAD.SideL },
  horL: { ch: PAD.SideL, end: PAD.Side },
  dDown: { ch: PAD.ShR, end: PAD.WechselL },
  dUp: { ch: PAD.Wechsel, end: PAD.OchsL },
  vDown: { ch: PAD.Tag, end: PAD.Alber },
  vUp: { ch: PAD.Alber, end: PAD.Tag },
};
const R2D = 180 / Math.PI;
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const deps = { Input, CONFIG, DT };
const rows = [];
for (const w of WEAPONS) for (const fam of FAMS) for (const v of VS) for (const hold of HOLDS) {
  const G = newRound({ walls: false, gap: 2.2, seed: 100, weapon: w, weapon2: 'longsword' });
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  P.skill.level = 0.7;
  setCorr(CONFIG, P, CONFIG.SKILL.corr, CONFIG.SKILL.corrTip);
  setPad(P, PAD.Pflug);
  inputPump(G, deps, { pace: pacer('60', 100) });
  const S = [];
  const snap = () => {
    const r = P.sword.rotation();
    const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
    const axis = Y.clone().applyQuaternion(q), face = Z.clone().applyQuaternion(q);
    const hp = P.hitPointVel.clone(); hp.addScaledVector(axis, -hp.dot(axis));
    const n = new THREE.Vector3().crossVectors(axis, hp);
    const mis = n.length() > 1e-4 ? Math.acos(Math.min(1, Math.abs(face.dot(n.normalize())))) * R2D : null;
    const rest = Z.clone().applyQuaternion(P.yaw); rest.addScaledVector(axis, -rest.dot(axis));
    const restA = rest.length() > 1e-4 ? Math.acos(Math.min(1, Math.abs(face.dot(rest.normalize())))) * R2D : null;
    S.push({ v70: hp.length(), mis, restA, mov: P.edgeMoving ?? 0, lag: (P.edgeLag ?? 0) * R2D, held: !!P.handHeld });
  };
  const step = () => { G.step(); snap(); };
  const runUntil = (qq) => { let g = 0; while (!qq.done && g++ < 2000) step(); };
  for (let i = 0; i < Math.round(1.5 / DT); i++) step();
  const f = F[fam];
  const o0 = [P.handOffset.x, P.handOffset.y];
  runUntil(feedTrace(G, stroke(f.ch[0] - o0[0], f.ch[1] - o0[1], 3, { lift: false, hold })));
  const k0 = S.length; // 긋기 시작 (다음 스텝부터 손가락이 끝으로 움직임)
  const atHold = S[k0 - 1];
  const cur = [P.handOffset.x, P.handOffset.y];
  runUntil(feedTrace(G, stroke(f.end[0] - cur[0], f.end[1] - cur[1], v, { lift: true, down: false })));
  for (let i = 0; i < Math.round(0.4 / DT); i++) step();
  let kFirst = null, kAlign = null, sum = 0, n = 0, peak = 0;
  for (let k = k0; k < S.length; k++) {
    const s = S[k];
    if (s.v70 > peak) peak = s.v70;
    if (s.v70 >= 3 && s.mis != null) {
      if (kFirst == null) kFirst = k;
      if ((k - k0) * DT <= 0.15) { sum += s.mis; n++; }
      if (kAlign == null && s.mis < 20) kAlign = k;
    }
  }
  rows.push({ weapon: w, fam, v, hold, restA: atHold.restA, movHold: atHold.mov, v70Hold: atHold.v70, misFirst: kFirst != null ? S[kFirst].mis : null, tFirst: kFirst != null ? (kFirst - k0) * DT * 1000 : null, tAlign: kAlign != null ? (kAlign - k0) * DT * 1000 : null, misMean15: n ? sum / n : null, peak });
  G.world.free();
}
// 표: 무기 × 쥔 시간 (무리 · 빠르기 평균)
const mean = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const f0 = (x, d = 0) => (x == null ? '—' : x.toFixed(d));
console.log(`| 무기 | 무리 | 쥔 ms | 쥔 끝 칼 면 ↔ 쉼 목표 | 쥔 끝 섞기 | 출발 날 어긋남 | 맞춤 시간 (< 20°) | 앞 0.15 s 어긋남 평균 | 칼날 70 % 최고 |`);
console.log('|---|---|---|---|---|---|---|---|---|');
for (const w of WEAPONS) for (const fam of FAMS) for (const hold of HOLDS) {
  const R = rows.filter((r) => r.weapon === w && r.fam === fam && r.hold === hold);
  console.log(`| ${w} | ${fam} | ${hold} | ${f0(mean(R.map((r) => r.restA)))}° | ${f0(mean(R.map((r) => r.movHold)), 2)} | ${f0(mean(R.map((r) => r.misFirst)))}° | ${f0(mean(R.map((r) => r.tAlign)))} ms | ${f0(mean(R.map((r) => r.misMean15)))}° | ${f0(mean(R.map((r) => r.peak)), 1)} m/s |`);
}
if (args.json) writeFileSync(args.json, JSON.stringify({ abl: ABL, rows }));
