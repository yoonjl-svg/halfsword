// ─────────────────────────────────────────────────────────────
//  swing_feel.mjs — 휘두름 손맛 계기 (10/10 20:4x 몬탄테 중간 쥠 '대검의 맛' — docs/motion/iberian_montante_2026-10-10.md §15)
//   플레이어 손가락 길(player_edge.mjs 와 같은 입력: 60 Hz 프레임마다 handOffset 이동 · handHeld · inputActive)로 정해진 긋기를 허공에 한다.
//   상대(롱소드)는 멈춘 과녁, 처음 거리 그대로(닿지 않게 다가가지 않음). 숙련 0.7 · corr·autoGuard 켬 (main.js 와 같게). 읽기만 한다.
//   획 하나: 감는 자리 A 로 느리게(2 패드 m/s) → 0.6 s 쉼 → A→B 긋기(v 패드 m/s) → 0.15 s 댄 채(--follow) → B→A 되긋기(같은 v) → 0.8 s 손 댄 채 둠.
//   잰다 (칼 몸의 칼끝 점 속도 — 칼 원점 + (hiltLength + bladeLength) 칼 축):
//     칼끝 최고 = 긋기 시작 ~ 되긋기 시작 사이 최고 m/s (손가락 길은 0.1~0.15 s 에 끝나고 칼은 그 뒤에 따라온다) · 닿기 = 긋기 시작 → 칼끝 최고까지 s
//     되돌림 = 되긋기 시작 → 칼끝 속도의 '되긋기 쪽' 몫(긋기 최고 때 칼끝 속도 방향의 반대)이 그 획 긋기 최고의 50 % 를 넘을 때까지 s
//     멈춤 = 되긋기 끝(손가락 멈춤) → 칼끝 < 1.5 m/s 까지 s (휘두른 칼이 서는 데 걸리는 시간)
//     휘두름 묵직함 = 칼끝 최고 때 칼 운동 에너지 ½Iω² + ½mv² (부품 합 질량·관성, J)
//   긋기 길 7 개(player_edge 의 LINES) × 빠르기 3 개(6 · 10 · 14 패드 m/s) = 21 획, 한 판 하나씩 (씨앗 = 획 번호)
//
//   node tools/sim/swing_feel.mjs [무기=zweihander] [--speeds=6,10,14] [--json=<파일>]
//   쥠 꼴 비교: MONTANTE_HAND=old|mid|guard node tools/sim/swing_feel.mjs zweihander
// ─────────────────────────────────────────────────────────────
import { newRound, THREE, CONFIG, DT, seedRandom } from './harness_m.mjs';
import { weaponPhysics } from '../../src/weapon_class.js';
import { getWeapon } from '../../src/weapons.js';
import { writeFileSync } from 'node:fs';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const WID = pos[0] || 'zweihander';
const SPEEDS = String(args.speeds ?? '6,10,14').split(',').map(Number);
const FRAME = 1 / 60;
const FOLLOW = +(args.follow ?? 0.15); // 긋기 끝 → 되긋기 사이 (손가락 댄 채 멈춤, s)
const { SKILL } = CONFIG;
const LINES = {
  ober: [[0.02, 0.52], [0.0, -0.45]],
  zornR: [[0.42, 0.42], [-0.4, -0.42]],
  zornL: [[-0.4, 0.42], [0.38, -0.44]],
  zwerchR: [[0.52, 0.06], [-0.5, 0.06]],
  zwerchL: [[-0.5, 0.06], [0.52, 0.06]],
  unterR: [[0.38, -0.44], [-0.3, 0.26]],
  unterL: [[-0.4, -0.42], [0.3, 0.26]],
};
const spec = getWeapon(WID);
const phys = weaponPhysics(spec);
const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _r = new THREE.Vector3();

function tipVel(P) {
  const s = P.sword;
  const q = s.rotation(), lv = s.linvel(), av = s.angvel();
  _q.set(q.x, q.y, q.z, q.w);
  _r.set(0, P.weaponCfg.hiltLength + P.weaponCfg.bladeLength, 0).applyQuaternion(_q);
  _w.set(av.x, av.y, av.z);
  return new THREE.Vector3(lv.x, lv.y, lv.z).add(_w.clone().cross(_r));
}
function kinE(P) {
  // 칼 원점 기준이 아니라 무게중심 기준: ½ m v_com² + ½ I_com ω⊥² (휘두름 축 관성 — 축 돌림 몫은 작아 뺌)
  const s = P.sword;
  const q = s.rotation(), lv = s.linvel(), av = s.angvel();
  _q.set(q.x, q.y, q.z, q.w);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(_q);
  _r.copy(ax).multiplyScalar(phys.com);
  _w.set(av.x, av.y, av.z);
  const vc = new THREE.Vector3(lv.x, lv.y, lv.z).add(_w.clone().cross(_r));
  const wPerp = _w.clone().sub(ax.clone().multiplyScalar(_w.dot(ax)));
  const Icom = phys.I - phys.mass * phys.com * phys.com;
  return 0.5 * phys.mass * vc.lengthSq() + 0.5 * Icom * wPerp.lengthSq();
}

function trial(lineKey, v, seed) {
  seedRandom(seed);
  const G = newRound({ walls: true, weapon: WID, weapon2: 'longsword', seed });
  const P = G.player, E = G.enemy;
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  for (const f of [P, E]) f.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  const [A, B] = LINES[lineKey];
  // 다리: [목표, 빠르기, 이름] — wait 은 [null, 초, 이름]
  const legs = [[null, 2.6, 'settle'], [A, 2, 'wind'], [null, 0.6, 'pause'], [B, v, 'cut'], [null, FOLLOW, 'follow'], [A, v, 'rev'], [null, 0.8, 'hold']];
  let li = 0, legT = 0, from = null, dur = 0, t = 0, stepAcc = 0;
  const R = { pre: 0, peak: 0, tPeak: null, dirPeak: null, revT: null, back: null, stop: null, ePeak: 0, revEnd: null, ok: true };
  let cutT = null;
  while (li < legs.length && t < 8) {
    const [to, sp, tag] = legs[li];
    const off = P.handOffset;
    let moved = false;
    if (to == null) {
      legT += FRAME;
      if (legT >= sp) { li++; legT = 0; from = null; }
    } else {
      if (!from) {
        from = [off.x, off.y];
        dur = Math.max(FRAME, Math.hypot(to[0] - off.x, to[1] - off.y) / sp);
        legT = 0;
        if (tag === 'cut') cutT = t;
        if (tag === 'rev') R.revT = t;
      }
      legT += FRAME;
      const k = Math.min(1, legT / dur);
      const nx = from[0] + (to[0] - from[0]) * k, ny = from[1] + (to[1] - from[1]) * k;
      moved = Math.abs(nx - off.x) + Math.abs(ny - off.y) > 1e-5;
      off.x = nx; off.y = ny;
      if (k >= 1) { li++; from = null; if (tag === 'rev') R.revEnd = t + FRAME; }
    }
    P.handHeld = tag !== 'settle';
    P.inputActive = moved;
    P.move.set(0, 0);
    stepAcc += FRAME;
    while (stepAcc >= DT - 1e-9) {
      stepAcc -= DT;
      G.step();
      if (!P.sword || P.armed === false || P.state !== 'stand') { R.ok = false; continue; }
      const tv = tipVel(P), sp2 = tv.length();
      const tt = t + FRAME - stepAcc;
      if (cutT == null && tag === 'pause') R.pre = sp2; // 긋기 바로 전 칼끝 (가라앉았나)
      if (cutT != null && R.revT == null) {
        if (sp2 > R.peak) { R.peak = sp2; R.tPeak = tt - cutT; R.dirPeak = tv.clone().normalize(); R.ePeak = kinE(P); }
      } else if (R.revT != null && R.back == null && R.dirPeak) {
        if (-tv.dot(R.dirPeak) > 0.5 * R.peak) R.back = tt - R.revT;
      }
      if (R.revEnd != null && R.stop == null && tt >= R.revEnd && sp2 < 1.5) R.stop = tt - R.revEnd;
    }
    t += FRAME;
  }
  return R;
}

const rows = [];
let seed = 1;
for (const v of SPEEDS) for (const k of Object.keys(LINES)) rows.push({ line: k, v, ...trial(k, v, seed++) });
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const out = { weapon: WID, hand: process.env.MONTANTE_HAND || 'mid', I: +phys.I.toFixed(3), com: +phys.com.toFixed(3), bySpeed: {} };
for (const v of SPEEDS) {
  const r = rows.filter((x) => x.v === v && x.ok);
  const backs = r.filter((x) => x.back != null).map((x) => x.back), stops = r.filter((x) => x.stop != null).map((x) => x.stop);
  out.bySpeed[v] = {
    n: r.length, tipPeak: +mean(r.map((x) => x.peak)).toFixed(2), tipPeakMax: +Math.max(...r.map((x) => x.peak)).toFixed(2), tPeak: +mean(r.map((x) => x.tPeak)).toFixed(3),
    ePeak: +mean(r.map((x) => x.ePeak)).toFixed(1), pre: +mean(r.map((x) => x.pre)).toFixed(2), back: +med(backs).toFixed(3), backN: backs.length, stop: +med(stops).toFixed(3), stopN: stops.length,
  };
  const o = out.bySpeed[v];
  console.log(`${WID} [${out.hand}] 패드 ${v} m/s (${o.n} 획): 칼끝 최고 평균 ${o.tipPeak} · 최대 ${o.tipPeakMax} m/s · 닿기(긋기 → 최고) ${o.tPeak} s · 최고 때 칼 운동 에너지 ${o.ePeak} J · 되돌림 p50 ${o.back} s (${o.backN}) · 멈춤 p50 ${o.stop} s (${o.stopN}) · (긋기 전 칼끝 ${o.pre} m/s)`);
}
if (args.json) writeFileSync(args.json, JSON.stringify({ out, rows }, null, 1));
