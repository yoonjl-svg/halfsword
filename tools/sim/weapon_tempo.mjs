// 무기별 연속 휘두르기 템포 — 칼을 세웠다가 다시 휘두르는 비용이 무기마다 얼마나 다른가
//  상대를 치운 뒤(park) 플레이어 손 목표를 두 자세 사이로 왕복시킨다(패드 13m/s, 스크립트 입력).
//  한 번 휘두르는 시간(반 주기) T 를 0.9 → 0.3초로 줄여 가며, 휘두를 때마다 칼날 70% 지점의 최고 속도와
//  그 속도의 판정 에너지 추정치(0.5 × (칼 유효 질량 + 팔 0.3kg) × v² × 2 × power × mCut = 베기 실효 J)를 잰다.
//   쌍 1: 지붕 ↔ 바보 (위에서 내려베기 · 아래에서 올려베기)
//   쌍 2: 어깨 지붕 ↔ 왼쪽 바꿈 (사선 내려베기 · 되돌아 올려베기)
//  "지속 템포" = 베기 실효가 느린 왕복(0.9초)의 80% 이상 남는 가장 짧은 T → 초당 휘두름 = 1/T
//  --loop : 왕복 대신 손 목표를 자세 지도 위 타원(지붕 → 오른 어깨 → 오른 아래 → 바보 → 왼 아래 → 왼 어깨 → 지붕)으로
//           멈추지 않고 돌린다(물레 베기, 반 바퀴 = T초). 칼이 멈췄다 되돌아가지 않고 관성을 이어 가는 "연속 동작"의 물리 한계
// 사용법: node tools/sim/weapon_tempo.mjs [무기id...] [--loop]
import { newRound, DT, THREE } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { STRIKE } from '../../src/config.js';

const PAIRS = {
  '지붕↔바보': [[0.02, 0.52], [0.0, -0.5]],
  '어깨↔왼바꿈': [[0.42, 0.42], [-0.4, -0.42]],
};
const PERIODS = [0.9, 0.7, 0.55, 0.45, 0.38, 0.32];
const SP = 13; // 손 목표 빠르기 (패드 m/s)

/** 칼 원점에서 칼날 t 지점까지, 날 방향으로 민 강체 유효 질량 (props 기준, combat.freeMass 와 같은 식) */
function mFreeAt(f, t) {
  const c = f.weaponCfg;
  const { m, I, frame } = f.swordProps;
  const d = c.hiltLength + t * c.bladeLength - f.swordCom;
  const rn = new THREE.Vector3(0, d, 0).cross(new THREE.Vector3(1, 0, 0)).applyQuaternion(frame.clone().invert());
  return 1 / (1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / I.z);
}

function pointSpeed(f, t) {
  const c = f.weaponCfg;
  const p = f.sword.translation();
  const q = f.sword.rotation();
  const pt = new THREE.Vector3(0, c.hiltLength + t * c.bladeLength, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).add(new THREE.Vector3(p.x, p.y, p.z));
  const v = f.sword.velocityAtPoint(pt);
  return Math.hypot(v.x, v.y, v.z);
}

/** 물레 베기: 손 목표가 타원을 따라 멈추지 않고 돈다 (반 바퀴 = T초). 반 바퀴마다 칼날 70% 최고 속도 */
export function loopRun(id, T) {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  const at = (a) => [0.42 * Math.sin(a), 0.5 * Math.cos(a)]; // a=0 지붕, π/2 오른쪽, π 바보, 3π/2 왼쪽
  P.handOffset.set(...at(0));
  for (let i = 0; i < 1.5 / DT; i++) {
    P.move.set(0, 0);
    G.step();
  }
  const halfSteps = Math.round(T / DT);
  const peaks = [];
  let a = 0;
  for (let k = 0; k < 10; k++) {
    let peak = 0;
    for (let i = 0; i < halfSteps; i++) {
      a += (Math.PI / halfSteps);
      P.handOffset.set(...at(a));
      P.move.set(0, 0);
      G.step();
      peak = Math.max(peak, pointSpeed(P, 0.7));
    }
    peaks.push(peak);
  }
  const c = P.weaponCfg;
  const v = peaks.slice(2).reduce((x, y) => x + y, 0) / (peaks.length - 2);
  const mEff = mFreeAt(P, 0.7) + STRIKE.armAssist;
  return { v, eCut: 0.5 * mEff * v * v * STRIKE.energyScale * c.power * (c.edged ? c.mCut : c.mBlunt) };
}

export function tempoRun(id, pair, T) {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  const [A, B] = PAIRS[pair];
  P.handOffset.set(A[0], A[1]);
  for (let i = 0; i < 1.5 / DT; i++) {
    P.move.set(0, 0);
    G.step();
  }
  const halfSteps = Math.round(T / DT);
  const peaks = [];
  let tgt = B;
  for (let k = 0; k < 10; k++) {
    let peak = 0;
    for (let i = 0; i < halfSteps; i++) {
      const off = P.handOffset;
      const dx = tgt[0] - off.x;
      const dy = tgt[1] - off.y;
      const d = Math.hypot(dx, dy);
      const st = SP * DT;
      if (d > st) {
        off.x += (dx / d) * st;
        off.y += (dy / d) * st;
      } else off.set(tgt[0], tgt[1]);
      P.move.set(0, 0);
      G.step();
      peak = Math.max(peak, pointSpeed(P, 0.7));
    }
    peaks.push(peak);
    tgt = tgt === B ? A : B;
  }
  const c = P.weaponCfg;
  const v = peaks.slice(2).reduce((a, b) => a + b, 0) / (peaks.length - 2); // 처음 두 번은 출발 과도기라 뺀다
  const mEff = mFreeAt(P, 0.7) + STRIKE.armAssist;
  const eCut = 0.5 * mEff * v * v * STRIKE.energyScale * c.power * (c.edged ? c.mCut : c.mBlunt);
  return { v, eCut, nan: !Number.isFinite(v) };
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv.includes('--loop')) {
  const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  console.log(`물레 베기(타원을 멈추지 않고 돈다) · 반 바퀴 T = ${PERIODS.join(' / ')}초 · 칸 = 칼날 70% 최고 속도 m/s · 베기 실효 J`);
  for (const id of ids.length ? ids : Object.keys(WEAPONS)) {
    const rs = PERIODS.map((T) => loopRun(id, T));
    const e0 = rs[0].eCut;
    let sustain = PERIODS[0];
    for (let i = 0; i < PERIODS.length; i++) if (rs[i].eCut >= 0.8 * e0) sustain = PERIODS[i];
    console.log(`${id.padEnd(18)} 물레      ${rs.map((r) => `${r.v.toFixed(1)}·${r.eCut.toFixed(0)}`).join('  ')}  | 지속 템포 T=${sustain}s (초당 ${(1 / sustain).toFixed(1)}번)`);
  }
} else if (import.meta.url === `file://${process.argv[1]}`) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(WEAPONS);
  console.log(`손 목표 ${SP}m/s 왕복 · 반 주기 T = ${PERIODS.join(' / ')}초 · 칸 = 칼날 70% 최고 속도 m/s · 베기 실효 J (날 없는 무기는 mBlunt)`);
  const out = [];
  for (const id of ids) {
    for (const pair of Object.keys(PAIRS)) {
      const rs = PERIODS.map((T) => tempoRun(id, pair, T));
      const e0 = rs[0].eCut;
      let sustain = PERIODS[0];
      for (let i = 0; i < PERIODS.length; i++) if (rs[i].eCut >= 0.8 * e0) sustain = PERIODS[i];
      const cells = rs.map((r) => `${r.v.toFixed(1)}·${r.eCut.toFixed(0)}`).join('  ');
      console.log(`${id.padEnd(18)} ${pair.padEnd(8)} ${cells}  | 지속 템포 T=${sustain}s (초당 ${(1 / sustain).toFixed(1)}번)`);
      out.push({ id, pair, v: rs.map((r) => +r.v.toFixed(2)), e: rs.map((r) => +r.eCut.toFixed(1)), sustain });
    }
  }
  console.log(JSON.stringify(out));
}
