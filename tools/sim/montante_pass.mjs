// ─────────────────────────────────────────────────────────────
//  montante_pass.mjs — 이베리아 자세표 지나는 자리 점검 (10/10 '빌린 자리 8 → 원전 꼴' — docs/motion/iberian_montante_2026-10-10.md §16)
//   플레이어 몸(본판 길 — 생성자가 유파 자세표를 입힘)으로 읽기만 한다. 물리·난수에 손대지 않는다.
//   ① 자세마다 1.4 s 들고(1.0~1.4 s 평균): 손 오차 cm · 칼끝 방향 오차 ° · 빈손 쥔 몫 % · 제 몸 뚫림 최대 cm(칼날 → 몸통·넓적다리, envelope_check 와 같은 식)
//      + 정적: 칼 손~칼 어깨 · 빈손(쥘 자리)~빈 어깨 거리 m (가슴 돌림 반영, 팔 길이 0.565 · 빈팔 0.575 와 견줌)
//   ② 기술 길마다(AI 손 빠르기 11 패드 m/s, motion_lab swings 와 같은 따라가기): 걸린 s · 칼날 70 % 최고 m/s · 베기 지표 J(같은 식) · 날 세움 곱 J ·
//      빈손 놓침 수 · 빈손 쥔 몫 % · 제 몸 뚫림 최대 cm · 길 위 섞인 칼끝 방향 길이 최소(guards.js guardAt 의 섞음 — 0.35 아래면 가장 가까운 자세로 튐)
//   node tools/sim/montante_pass.mjs [무기=zweihander] [--poses=0] [--swings=0] [--json=<파일>]
// ─────────────────────────────────────────────────────────────
import { newRound, DT, THREE } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { WEAPONS } from '../../src/weapons.js';
import { STRIKE } from '../../src/config.js';
import { GUARD_BASE } from '../../src/guards.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { sample } from './envelope_check.mjs';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const id = pos[0] || 'zweihander';
const W = WEAPONS[id];
if (!W) throw new Error(`무기 없음: ${id}`);
const art = resolveSwordArt(W, null);
const q4 = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const deg = (a) => (a * 180) / Math.PI;
const D2R = Math.PI / 180;
const out = { id, poses: [], swings: [] };

function solo() {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  return { G, P: G.player };
}
function setPad(P, x, y) {
  P.handOffset.set(x, y);
  P.skill.aimRaw?.set?.(x, y);
}
function pointState(f, t) {
  const c = f.weaponCfg;
  const p = f.sword.translation();
  const q = q4(f.sword.rotation());
  const pt = new THREE.Vector3(0, c.hiltLength + t * c.bladeLength, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
  const u = f.sword.velocityAtPoint(pt);
  const v = new THREE.Vector3(u.x, u.y, u.z);
  const s = v.length();
  if (!c.edged) return { s, q: 1 };
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const perp = v.clone().addScaledVector(axis, -v.dot(axis));
  const pl = perp.length();
  const align = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
  return { s, q: align > STRIKE.edgeAlign ? 0.4 + 0.6 * ((align - STRIKE.edgeAlign) / (1 - STRIKE.edgeAlign)) : 0 };
}
function mFreeAt(f, t) {
  const c = f.weaponCfg;
  const { m, I, frame } = f.swordProps;
  const d = c.hiltLength + t * c.bladeLength - f.swordCom;
  const rn = new THREE.Vector3(0, d, 0).cross(new THREE.Vector3(1, 0, 0)).applyQuaternion(frame.clone().invert());
  return 1 / (1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / I.z);
}
const live = (f) => f.state === 'stand' && f.armed !== false && !!f.sword;
const penOf = (f) => {
  const s = sample(f);
  let m = 0;
  for (const [k, d] of Object.entries(s.pen)) if (k.startsWith('blade>')) m = Math.max(m, d);
  return m;
};
// 섞인 칼끝 방향 길이 (guards.js guardAt 과 같은 무게 — SIGMA 0.15, 마무리 없음)
function blendLen(T, x, y) {
  let w0 = 0;
  const d = [0, 0, 0];
  for (const g of T) {
    const w = Math.exp(-((x - g.pad[0]) ** 2 + (y - g.pad[1]) ** 2) / 0.0225);
    w0 += w;
    for (let k = 0; k < 3; k++) d[k] += g.dir[k] * w;
  }
  return Math.hypot(...d) / w0;
}

const { P: P0 } = solo();
const T = P0.guardPose.table ?? GUARD_BASE;
const along = -(P0.weaponCfg.gripAlong ?? -0.24);
console.log(`${id} (${art.tradition}) 지나는 자리 점검 — 손 사이 ${along.toFixed(2)} m`);

if (args.poses !== '0') {
  console.log('\n| # | 자리 | 손 [앞,위,옆] | 칼끝 [올림,옆] | 손 오차 cm | 칼끝 오차 ° | 빈손 쥔 % | 뚫림 cm | 칼손~어깨 m | 쥘 자리~빈 어깨 m |');
  console.log('|---|---|---|---|---|---|---|---|---|---|');
  for (let i = 0; i < GUARD_BASE.length; i++) {
    const { G, P } = solo();
    const g = T[i];
    const pd = GUARD_BASE[i].pad;
    setPad(P, pd[0], pd[1]);
    let hE = 0, aE = 0, k = 0, held = 0, pen = 0;
    for (let t = 0; t < 1.4; t += DT) {
      G.step();
      if (t > 1.0) {
        const s = P.sword.translation();
        hE += P.handTarget.distanceTo(new THREE.Vector3(s.x, s.y, s.z));
        const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q4(P.sword.rotation()));
        const gp = P.guardPose;
        aE += deg(ax.angleTo(new THREE.Vector3(gp.dir[0], gp.dir[1], gp.dir[2]).applyQuaternion(P.yaw)));
        held += P.gripping ? 1 : 0;
        pen = Math.max(pen, penOf(P));
        k++;
      }
    }
    // 정적 닿기: 어깨는 가슴 돌림(chestYaw, + = 칼 든 어깨가 뒤로)만큼 돈다
    const cy = g.chestYaw;
    const shS = [-0.2 * Math.sin(cy), 0.1, 0.2 * Math.cos(cy)], shO = [0.2 * Math.sin(cy), 0.1, -0.2 * Math.cos(cy)];
    const grip = [g.hand[0] - along * g.dir[0], g.hand[1] - along * g.dir[1], g.hand[2] - along * g.dir[2]];
    const dS = Math.hypot(g.hand[0] - shS[0], g.hand[1] - shS[1], g.hand[2] - shS[2]);
    const dO = Math.hypot(grip[0] - shO[0], grip[1] - shO[1], grip[2] - shO[2]);
    const el = deg(Math.asin(Math.max(-1, Math.min(1, g.dir[1])))), az = deg(Math.atan2(g.dir[2], g.dir[0]));
    const row = { i, name: g.name, hand: g.hand, blade: [+el.toFixed(0), +az.toFixed(0)], handErr: +((100 * hE) / k).toFixed(1), tipErr: +(aE / k).toFixed(1), held: +((100 * held) / k).toFixed(0), pen: +(100 * pen).toFixed(1), reachS: +dS.toFixed(3), reachO: +dO.toFixed(3) };
    out.poses.push(row);
    console.log(`| ${i} | ${g.name} | ${g.hand.map((v) => v.toFixed(2)).join(', ')} | ${row.blade.join(', ')} | ${row.handErr} | ${row.tipErr} | ${row.held} | ${row.pen} | ${row.reachS} | ${row.reachO} |`);
  }
}

if (args.swings !== '0') {
  const SPS = String(args.speeds ?? '9,11,13').split(',').map(Number); // 패드 m/s 여럿 — 한 번 휘두름은 때(박자)에 따라 흔들려 평균을 낸다
  const list = art.school.tech.filter((t) => t.path && t.from);
  console.log(`\n기술 길 (${SPS.join('·')} 패드 m/s 평균) — 칼날 70 % 최고 · 지표 J = ½·m(0.7)·v²·2·mCut (motion_lab swings 와 같은 식) · 놓침은 합`);
  console.log('| 기술 | 시간 s | 최고 m/s | 지표 J | ×날 J | 빈손 놓침 | 빈손 쥔 % | 뚫림 cm | 섞인 방향 최소 |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const tech of list) {
   const acc = [];
   for (const SP of SPS) {
    const { G, P } = solo();
    setPad(P, tech.from[0], tech.from[1]);
    for (let t = 0; t < 0.8; t += DT) G.step();
    const pts = tech.path.map((p) => p.slice());
    let cur = [tech.from[0], tech.from[1]];
    let t = 0, peak = 0, peakQ = 0, done = null, drops = 0, held = 0, k = 0, pen = 0, minLen = 1;
    let prevG = !!P.gripping;
    const mEff = mFreeAt(P, 0.7) + 0.3;
    while (t < 3) {
      if (pts.length) {
        const [tx, ty] = pts[0];
        const dx = tx - cur[0], dy = ty - cur[1];
        const dd = Math.hypot(dx, dy);
        const st = SP * DT;
        if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
        else (cur = [tx, ty]), pts.shift();
        if (!pts.length) done = t;
        minLen = Math.min(minLen, blendLen(T, cur[0], cur[1]));
      }
      setPad(P, cur[0], cur[1]);
      G.step();
      t += DT;
      const s = pointState(P, 0.7);
      if (s.s > peak) (peak = s.s), (peakQ = s.q);
      if (live(P)) {
        const g = !!P.gripping;
        if (prevG && !g) drops++;
        prevG = g;
        held += g ? 1 : 0;
        k++;
        pen = Math.max(pen, penOf(P));
      }
      if (done != null && t > done + 0.6) break;
    }
    const e = 0.5 * mEff * peak * peak * 2 * (W.power ?? 1) * (W.edged ? W.mCut : W.mBlunt);
    acc.push({ time: done ?? -1, peak, J: e, Jq: e * peakQ, drops, held: held / Math.max(1, k), pen, minLen });
   }
    const av = (k) => acc.reduce((a, r) => a + r[k], 0) / acc.length;
    const row = { tech: tech.name, time: +av('time').toFixed(2), peak: +av('peak').toFixed(1), J: +av('J').toFixed(0), Jq: +av('Jq').toFixed(0), drops: acc.reduce((a, r) => a + r.drops, 0), held: +(100 * av('held')).toFixed(0), pen: +(100 * Math.max(...acc.map((r) => r.pen))).toFixed(1), minLen: +Math.min(...acc.map((r) => r.minLen)).toFixed(2) };
    out.swings.push(row);
    console.log(`| ${row.tech} | ${row.time} | ${row.peak} | ${row.J} | ${row.Jq} | ${row.drops} | ${row.held} | ${row.pen} | ${row.minLen} |`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
