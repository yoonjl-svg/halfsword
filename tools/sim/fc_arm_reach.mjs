// ─────────────────────────────────────────────────────────────
//  fc_arm_reach.mjs — 손가락 긋기 팔 힘 '손 목표에 닿을 때까지' 재기 (사장님 11/08 '1로 해봐' · 기록 docs/strike/fc_arm_reach_2026-11-08.md) — 재기만 · 게임 값은 이 프로세스 안에서만
//   제비 베기 곧은 길 판(tsubame_trace.mjs traceRun 'line' — 가만히 선 상대 · 손가락 그대로)을 가슴 사이 · 씨앗 넓혀 판마다:
//    앞지름 — 내려 베는 동안(손가락이 패드 0.1 밑으로 긋기 시작한 뒤 · 꺾기 전) 손목(아래팔 앞끝)이 손 목표(fighter.handTarget)를 그 빠르기 방향으로 가장 앞질러 간 거리 (m · 몸 틀 · − = 늘 뒤)
//    꺾을 때 손목 ↔ 손 목표 거리 · 띠 옮김(bandDy) · tsubame_snap.test.mjs '곧은 길 꼴' 잣대 모두(칼끝 · 잔상 devShare < 0.12 · 꺾임 < 15° · 손목 · 굴림 · 날 앞장 ≥ 80 % · 첫 맞음 몸통 날)
//  node tools/sim/fc_arm_reach.mjs [--fc=팔 힘,감도] [--gaps=1.1,1.15,1.2,1.25,1.3] [--seeds=6] [--s0=0] [-v]   (씨앗 = 700 + s0 + 1 ~ — 701 = 손가락 길 그대로 · 그 밖 ± 0.04 흔들림)
// ─────────────────────────────────────────────────────────────
import { CONFIG, THREE, DT } from './harness_m.mjs';
import { traceRun, bend, bendTrail } from './tsubame_trace.mjs';
import { HUMAN } from '../../src/fighter.js';
import { isMain } from './is_main.mjs';

const r3 = (x) => +x.toFixed(3);
function wrist(f) {
  const fa = f.bodies.farmS;
  const r = fa.rotation();
  const t = fa.translation();
  return new THREE.Vector3(t.x + 0.13 * (1 - 2 * (r.y * r.y + r.z * r.z)), t.y + 0.13 * 2 * (r.x * r.y + r.w * r.z), t.z + 0.13 * 2 * (r.x * r.z - r.w * r.y));
}

/** 한 판: 앞지름 · 꺾을 때 손목 ↔ 손 목표 · 띠 옮김 · 시험 잣대 못 넘은 까닭 (빈 배열 = 모두 넘음) */
export function reachRun(seed, gap) {
  const k = CONFIG.STRIKE.edgeAlign;
  let prevT = null;
  let down = false;
  let snapped = false;
  let ahead = -9;
  let snapD = null;
  const tr = traceRun('line', seed, gap, {
    onStep(G, P) {
      if (P.iai) snapped = true;
      if (snapped) return;
      const inv = P.yaw.clone().invert();
      const c = P.bodies.chest.translation();
      const C = new THREE.Vector3(c.x, c.y, c.z);
      const T = P.handTarget.clone().sub(C).applyQuaternion(inv);
      const W = wrist(P).sub(C).applyQuaternion(inv);
      if (P.handOffset.y < 0.1 && G.t > 1.2 && P.skill.swinging) down = true;
      if (down && prevT) {
        const vt = T.clone().sub(prevT).multiplyScalar(1 / DT);
        if (vt.length() > 0.3) ahead = Math.max(ahead, W.clone().sub(T).dot(vt.normalize()));
        snapD = W.distanceTo(T);
      }
      prevT = T;
    },
  });
  const why = [];
  if (!tr.fired) why.push('안 남');
  else {
    const b = bend(tr);
    const t = bendTrail(tr);
    if (!(b && b.devShare < 0.12 && b.kinkDeg < 15)) why.push('칼끝');
    if (!(t && t.devShare < 0.12 && t.kinkDeg < 15)) why.push('잔상');
    const W = tr.wr.filter((w) => w && w[1]);
    if (!W.every((w) => w[3] <= 1)) why.push('손목');
    if (!W.every((w) => w[2] <= HUMAN.forearmRoll + 1)) why.push('굴림');
    if (!(W.filter((w) => w[5] > k).length >= 0.8 * W.length)) why.push('날 앞장');
    const h = tr.hits[0];
    if (!(h && ['pelvis', 'abdomen', 'chest'].includes(h.part) && h.edge > k)) why.push(`첫 맞음 ${h?.part ?? '없음'}`);
  }
  return { seed, gap, ahead: r3(ahead), snapD: snapD == null ? null : r3(snapD), bandDy: tr.bandDy, bandFrom: tr.bandFrom, why };
}

if (isMain(import.meta.url)) {
  const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (arg('fc')) {
    const [a, g] = arg('fc').split(',').map(Number);
    Object.assign(CONFIG.SKILL.fingerCut, { arm: a, gain: g });
  }
  const gaps = arg('gaps', '1.1,1.15,1.2,1.25,1.3').split(',').map(Number);
  const seeds = +arg('seeds', 6);
  const s0 = +arg('s0', 0);
  const rows = [];
  for (const gap of gaps) for (let s = 1 + s0; s <= seeds + s0; s++) rows.push(reachRun(700 + s, gap));
  const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  const why = {};
  for (const r of rows) for (const w of r.why) why[w.split(' ')[0]] = (why[w.split(' ')[0]] ?? 0) + 1;
  const fc = CONFIG.SKILL.fingerCut;
  console.log(`팔 힘 ${fc.arm} · 감도 ${fc.gain}: 판 ${rows.length} · 시험 잣대 모두 넘음 ${rows.filter((r) => !r.why.length).length} · 못 넘은 까닭 ${JSON.stringify(why)} · 손 앞지름 가운데 ${med(rows.map((r) => r.ahead))} m · 앞지름 > 0.03 m 판 ${rows.filter((r) => r.ahead > 0.03).length} · 꺾을 때 손목 ↔ 손 목표 가운데 ${med(rows.map((r) => r.snapD))} m · 띠 옮김 ${rows.filter((r) => r.bandDy).length}`);
  if (process.argv.includes('-v')) for (const r of rows) console.log('  ', JSON.stringify(r));
}
