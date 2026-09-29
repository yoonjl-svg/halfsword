// ─────────────────────────────────────────────────────────────
//  우리 캐릭터 동작 기록 (동작 연구 PM) — 비교 화면(tools/motion/viewer.html)에 기준 동작과 겹쳐 보기용
//
//   node tools/motion/record_game.mjs                → docs/motion/records/game_<베기>.json (지금 게임의 팔 베기, 상대 치움)
//   node tools/motion/record_game.mjs zornhau 0.3    → 베기 하나, 휘두르는 시간 0.3초
//
//  실제 src/ 게임 코드를 헤드리스로 돌린다(tools/sim/harness_m.mjs). src/ 는 바꾸지 않는다.
//  플레이어 손가락(handOffset)을 AI 기술 길(ai_techniques.js TECH: 시작 자세 → 경유점 → 끝 자세)대로 움직인다
//  — weapon_measure.mjs 와 같은 방식. 준비 0.5초 동안 시작 자세를 들고, 그다음 휘두른다.
//  랙돌 관절 자리(몸체 자세 × 관절 기준점)를 매 스텝 적는다. 좌표는 클립과 같다:
//   휘두르기 시작 때 골반 밑 땅이 원점, x 앞 · y 위 · z 칼 든 쪽.
//  시각 0 = 휘두르기 시작 − 0.2초 (클립의 감기 끝 tw 와 맞추려면 비교 화면에서 시간 정렬을 쓴다)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { newRound, DT, THREE } from '../sim/harness_m.mjs';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { JOINTS, BONES } from './lib/body.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'motion', 'records');
const args = process.argv.slice(2);
const MAP = { zornhau: 'zornhau', oberhau: 'oberhau', zwerchhau: 'zwerch', mittelhau: 'zwerch', unterhau: 'unterhau' };
const cuts = args[0] ? [args[0]] : Object.keys(MAP);
const SWING = args[1] ? +args[1] : 0.35; // weapon_measure.mjs 가 롱소드에서 가장 잘 휘두른 값
const CHAMBER = 0.5;
const PRE = 0.2;
const POST = 0.9;

// 관절 기준점: 어느 몸체에 붙었고, 처음 자세에서 월드 어디였나 (fighter.js partDefs·jointDefs, s = +1 오른손)
const PARTS = {
  pelvis: [0, 0.97, 0], abdomen: [0, 1.13, 0], chest: [0, 1.33, 0], head: [0, 1.62, 0],
  uarmS: [0.15, 1.43, 0.2], farmS: [0.435, 1.43, 0.2], uarmO: [0, 1.28, -0.2], farmO: [0, 0.99, -0.2],
  thighF: [0, 0.715, 0.095], shinF: [0, 0.29, 0.095], footF: [0.05, 0.045, 0.095],
  thighB: [0, 0.715, -0.095], shinB: [0, 0.29, -0.095], footB: [0.05, 0.045, -0.095],
};
// 게임은 칼 든 쪽 발(z+)이 F, 반대 발이 B. 오른손잡이면 F = 오른발
const ANCHORS = {
  hipC: ['pelvis', [0, 0.93, 0]], waist: ['abdomen', [0, 1.06, 0]], chest: ['chest', [0, 1.33, 0]], neck: ['head', [0, 1.5, 0]], head: ['head', [0, 1.62, 0]],
  shS: ['uarmS', [0, 1.43, 0.2]], elS: ['farmS', [0.3, 1.43, 0.2]], hS: ['farmS', [0.565, 1.43, 0.2]],
  shO: ['uarmO', [0, 1.43, -0.2]], elO: ['farmO', [0, 1.13, -0.2]], hO: ['farmO', [0, 0.87, -0.2]],
  hipL: ['thighB', [0, 0.93, -0.095]], kneeL: ['shinB', [0, 0.5, -0.095]], ankleL: ['footB', [0, 0.08, -0.095]], heelL: ['footB', [-0.07, 0.02, -0.095]], toeL: ['footB', [0.17, 0.02, -0.095]],
  hipR: ['thighF', [0, 0.93, 0.095]], kneeR: ['shinF', [0, 0.5, 0.095]], ankleR: ['footF', [0, 0.08, 0.095]], heelR: ['footF', [-0.07, 0.02, 0.095]], toeR: ['footF', [0.17, 0.02, 0.095]],
};

function record(cutId) {
  const tech = TECH_BY_NAME[MAP[cutId]];
  const G = newRound({ weapon: 'longsword', seed: 1 });
  G.park();
  const f = G.player;
  const path = [tech.from, ...tech.path];
  const frames = [];
  let origin = null;
  let yaw0 = 0;
  const lerp = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  const total = CHAMBER + SWING + POST;
  for (let t = 0; t < total; t += DT) {
    if (t < CHAMBER) f.handOffset.set(tech.from[0], tech.from[1]);
    else {
      const u = Math.min(1, (t - CHAMBER) / SWING);
      const [a, b, w] = u < 0.5 ? [path[0], path[1], u * 2] : [path[1], path[2], (u - 0.5) * 2];
      const p = lerp(a, b, w);
      f.handOffset.set(p[0], p[1]);
    }
    f.move.set(0, 0);
    G.step();
    if (t < CHAMBER - PRE - 1e-9) continue;
    if (!origin) {
      const p = f.bodies.pelvis.translation();
      origin = new THREE.Vector3(p.x, 0, p.z);
      const fw = f.forward();
      yaw0 = Math.atan2(fw.z, fw.x);
    }
    const toLocal = (v) => {
      const d = v.clone().sub(origin);
      const c = Math.cos(-yaw0), s = Math.sin(-yaw0);
      return [d.x * c - d.z * s, d.y, d.x * s + d.z * c];
    };
    const J = [];
    for (const name of JOINTS) {
      let w;
      if (name === 'tip') w = f.bladePoint(1, new THREE.Vector3());
      else if (name === 'pommel') {
        const tip = f.bladePoint(1, new THREE.Vector3());
        const hilt = f.bladePoint(0, new THREE.Vector3());
        w = hilt.clone().add(hilt.clone().sub(tip).normalize().multiplyScalar(0.25));
      } else {
        const [part, at] = ANCHORS[name];
        const b = f.bodies[part];
        const r = b.rotation();
        const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
        const home = PARTS[part];
        const local = new THREE.Vector3(at[0] - home[0], at[1] - home[1], at[2] - home[2]);
        const tr = b.translation();
        w = local.applyQuaternion(q).add(new THREE.Vector3(tr.x, tr.y, tr.z));
      }
      const l = toLocal(w);
      J.push(+l[0].toFixed(3), +l[1].toFixed(3), +l[2].toFixed(3));
    }
    frames.push({ t: +(t - (CHAMBER - PRE)).toFixed(4), J });
  }
  // 칼끝 속도·손 속도 (가운데 차분)
  const n = frames.length;
  const jIdx = (name) => JOINTS.indexOf(name) * 3;
  const speed = (name) =>
    frames.map((_, i) => {
      const a = frames[Math.max(0, i - 1)].J, b = frames[Math.min(n - 1, i + 1)].J, k = jIdx(name);
      const dt = (Math.min(n - 1, i + 1) - Math.max(0, i - 1)) * DT;
      return +(Math.hypot(b[k] - a[k], b[k + 1] - a[k + 1], b[k + 2] - a[k + 2]) / dt).toFixed(2);
    });
  const tip = speed('tip');
  const hand = speed('hS');
  const peakI = tip.indexOf(Math.max(...tip));
  return {
    format: 'stillness-motion-record/1',
    id: `game_${cutId}`,
    cut: cutId,
    source: `지금 게임 (src/ ${new Date().toISOString().slice(0, 10)}), 헤드리스, 플레이어 손가락을 AI 기술 '${tech.name}' 길로 ${SWING}s 에 긋기, 상대 치움, skill 0.7, 롱소드`,
    hz: Math.round(1 / DT),
    marks: { swingStart: PRE, tipPeak: frames[peakI].t },
    summary: { tipPeak: Math.max(...tip), handPeak: Math.max(...hand), tipPeakT: frames[peakI].t },
    joints: JOINTS,
    bones: BONES,
    data: { n, cols: { t: frames.map((f) => f.t), 'speed.tip': tip, 'speed.hand': hand, J: frames.flatMap((f) => f.J) } },
  };
}

mkdirSync(OUT, { recursive: true });
const list = [];
for (const c of cuts) {
  const r = record(c);
  writeFileSync(join(OUT, `${r.id}.json`), JSON.stringify(r));
  list.push({ id: r.id, cut: r.cut, file: `${r.id}.json`, source: r.source, summary: r.summary });
  console.log(`${r.id.padEnd(20)} 칼끝 최고 ${r.summary.tipPeak} m/s (t ${r.summary.tipPeakT}s) · 손 ${r.summary.handPeak} m/s · ${r.data.n} 표본`);
}
if (!args[0]) writeFileSync(join(OUT, 'index.json'), JSON.stringify({ format: 'stillness-motion-records/1', records: list }, null, 1));
