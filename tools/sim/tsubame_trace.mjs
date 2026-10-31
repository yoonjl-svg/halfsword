// 제비 베기(일본 J9 특수 공격) 되돌림 칼 칼끝 길 재기 (사장님 10/31 14:xx '제비 베기 경로가 좀 휘어보이던데 점검해봐') — 재기만 · 게임 값은 길 견줌 갈래에서만 덮어씀
//  사람 打刀 · 상대 롱소드(멈춤 · 칼 아래 · 상처 안 걸림) · 가슴 사이 GAP · 손가락 = schielhau_strike.mjs tsubameRun 과 같은 길(지붕 → [0, 0.14] → 아래 [0, −0.5] → 곧장 위로) · 아래 칼은 상대 몸을 지나감(ghostDown)
//  끌고 가는 칼(제비 베기 강화가 켜진 스텝부터 운동학 칼이 끝나고 0.1 s)마다 칼끝 · 손(칼자루) 세계 자리 · 맞은 자리를 적음 →
//   휨: 칼끝 길 ↔ 처음 · 끝을 잇는 곧은 줄 가장 먼 거리(m) · 그 줄 길이에 대한 몫 · 꺾임(이웃 조각 방향 바뀜 가장 큰 °) · 손 패드 길(끌고 가는 길 점)
//  갈래 VARIANTS: now(지금 — 패드 [0.2, −0.2] → [0, 0.1]) · straight(곧은 사선 [0.06, −0.2] → [0.12, 0.1]) · old(10/25 전 길 — tsuAim 0)
//   · diag(손가락 사선 그대로 [0.06, −0.15] → [0.22, 0.26] + 몸통 띠 높이 옮김 tsuBand 그대로) · up(오른 아래 [0.18, −0.25] → 곧장 위 [0.15, 0.1] — 되돌아오지 않음)
//   · arc([0.15, −0.25] → [0.12, 0.05] → [0.18, 0.3] — 오른 아래로 비켜 돌아 위 · 끝은 손가락 사선 쪽)
//  node tools/sim/tsubame_trace.mjs [--variants=now,diag,old] [--seeds=3] [--gaps=1.15] [--json=파일]  (씨앗 1 = 손가락 길 그대로 · 2 부터 점마다 ± 0.04 흔들림)
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist, strokeTechOf, TSU_AIM } from '../../src/unique_assist.js';
import { TRADITIONS } from '../../src/schools.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const VARIANTS = arg('variants', 'now,diag,old').split(',');
const SEEDS = +arg('seeds', 3);
const GAPS = arg('gaps', '1.15').split(',').map(Number);
const UA = CONFIG.UNIQUE_ASSIST;
const BAND0 = TSU_AIM.band.path.map((p) => p.slice());
const U = TRADITIONS.japanese.unique.find((x) => x.name === 'tsubameGaeshi');
const LOW = [0, -0.5];
const r3 = (x) => +x.toFixed(3);

function run(variant, seed, GAP) {
  let rs = (seed * 7919 + 17) >>> 0;
  const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  const J = seed === 701 ? 0 : 0.04; // 첫 씨앗은 손가락 길 그대로 · 그 밖은 점마다 ± 0.04 패드 m 흔들림
  UA.tsuAim = variant === 'old' ? 0 : 1;
  const PATHS = { straight: [[0.06, -0.2], [0.12, 0.1]], diag: [[0.06, -0.15], [0.22, 0.26]], up: [[0.18, -0.25], [0.15, 0.1]], arc: [[0.15, -0.25], [0.12, 0.05], [0.18, 0.3]] };
  TSU_AIM.band.path = PATHS[variant] ?? BAND0.map((p) => p.slice());
  const G = newRound({ walls: true, seed, weapon: 'uchigatana', weapon2: 'longsword', gap: GAP + 0.3, AIClass: AI });
  const P = G.player;
  const D = G.enemy;
  G.ai.update = () => {};
  D.applyWound = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['tsubameGaeshi']) });
  const FRAME = 2 * DT;
  let fx = P.handOffset.x, fy = P.handOffset.y;
  const to = (p, vel, held) => {
    const fr = [];
    let x = fx, y = fy;
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, vel * FRAME);
      x += (dx / d) * st; y += (dy / d) * st;
      fr.push([(dx / d) * st, (dy / d) * st, held]);
    }
    fx = x; fy = y;
    return fr;
  };
  let queue = [];
  let started = false;
  const tr = { tip: [], hand: [], pad: [], hits: [], snapT: null, endT: null, fired: false };
  G.before = () => {
    if (!started && G.t > 1.2 && P.foeDistance() < GAP + 0.05) {
      started = true;
      queue = [...to(U.from, 1.6, false), ...Array(4).fill([0, 0, false])];
      for (const p of U.path) queue.push(...to([p[0] + (rnd() * 2 - 1) * J, p[1] + (rnd() * 2 - 1) * J], 4.5, true));
      queue.push(...Array(8).fill([0, 0, false]));
    }
    if ((G.stepN = (G.stepN ?? 0) + 1) % 2 === 1) {
      const f = queue.shift() ?? [0, 0, false];
      uq.feed(f[0], f[1], FRAME, false);
      if (!(uq.holdsHand ?? uq.running)) { P.handOffset.x += f[0]; P.handOffset.y += f[1]; }
      P.handHeld = f[2];
      if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) P.inputActive = true;
      if (!queue.length) { fx = P.handOffset.x; fy = P.handOffset.y; }
    }
    const dist = P.foeDistance();
    P.move.set(0, started ? 0 : dist > GAP ? 0.5 : 0);
    if (started && !tr.fired && queue.length && uq.r?.e.name !== 'tsubameGaeshi') P.instantGhost = Math.max(P.instantGhost ?? 0, 2); // 아래 칼은 빗나감 (제비 베기가 나는 조건)
  };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === P && strokeTechOf(P) === 'tsubameGaeshi') tr.hits.push({ zone: r.zone, part: rest[1]?.v?.part ?? null, E: r3(r.energy), t: r3(G.t - (tr.snapT ?? G.t)) });
  };
  const v = new THREE.Vector3();
  const h = new THREE.Vector3();
  try {
    while (G.t < 6) {
      G.step();
      const on = uq.r?.e.name === 'tsubameGaeshi';
      if (on && tr.snapT == null) tr.snapT = G.t;
      if (on) tr.fired = true;
      if (tr.snapT != null && tr.endT == null && !on && !P.iai) tr.endT = G.t;
      if (tr.snapT != null && (tr.endT == null || G.t - tr.endT < 0.1)) {
        // 세계 → 내 몸 기준 (x = 상대 쪽 · y = 위 · z = 칼 든 쪽 옆) — 판마다 같은 틀
        const c = P.bodies.chest.translation();
        const yaw = P.heading ?? 0;
        const loc = (p) => { const dx = p.x - c.x, dz = p.z - c.z; return [r3(dx * Math.cos(yaw) - dz * Math.sin(yaw)), r3(p.y), r3(dx * Math.sin(yaw) + dz * Math.cos(yaw))]; };
        tr.tip.push([r3(G.t - tr.snapT), ...loc(P.bladePoint(1, v)), P.iai ? 1 : 0]);
        tr.hand.push([r3(G.t - tr.snapT), ...loc(P.bladePoint(0, h))]);
        tr.pad.push([r3(G.t - tr.snapT), r3(P.handOffset.x), r3(P.handOffset.y)]);
      }
      if (tr.endT != null && G.t - tr.endT > 0.12) break;
    }
  } finally {
    G.world.free();
  }
  return tr;
}

// 휨 재기: 운동학 칼이 끄는 동안(iai 1)의 칼끝 길
function bend(tr) {
  const T = tr.tip.filter((p) => p[4]);
  if (T.length < 3) return null;
  const a = T[0].slice(1, 4), b = T[T.length - 1].slice(1, 4);
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...ab);
  let dev = 0, devAt = 0;
  for (const p of T) {
    const ap = [p[1] - a[0], p[2] - a[1], p[3] - a[2]];
    const t = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (L * L);
    const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
    const d = Math.hypot(p[1] - q[0], p[2] - q[1], p[3] - q[2]);
    if (d > dev) { dev = d; devAt = p[0]; }
  }
  let kink = 0, len = 0;
  for (let i = 2; i < T.length; i++) {
    const u = [T[i - 1][1] - T[i - 2][1], T[i - 1][2] - T[i - 2][2], T[i - 1][3] - T[i - 2][3]];
    const w = [T[i][1] - T[i - 1][1], T[i][2] - T[i - 1][2], T[i][3] - T[i - 1][3]];
    const nu = Math.hypot(...u), nw = Math.hypot(...w);
    len += nw;
    if (nu > 0.01 && nw > 0.01) kink = Math.max(kink, (Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (nu * nw)))) * 180) / Math.PI);
  }
  return { chord: r3(L), dev: r3(dev), devShare: r3(dev / L), devAt, kinkDeg: +kink.toFixed(1), pathLen: r3(len), steps: T.length, dur: r3(T[T.length - 1][0] - T[0][0]) };
}

const out = { gaps: GAPS, runs: [] };
for (const variant of VARIANTS) {
  for (const gap of GAPS) for (let s = 1; s <= SEEDS; s++) {
    const tr = run(variant, 700 + s, gap);
    const b = bend(tr);
    out.runs.push({ variant, seed: 700 + s, gap, fired: tr.fired, bend: b, hits: tr.hits, tip: tr.tip, hand: tr.hand, pad: tr.pad });
    console.log(variant, gap, 700 + s, JSON.stringify({ fired: tr.fired, bend: b && { dev: b.dev, devShare: b.devShare, kinkDeg: b.kinkDeg, dur: b.dur }, hits: tr.hits.map((x) => `${x.zone}@${x.t}`) }));
  }
}
UA.tsuAim = 1;
TSU_AIM.band.path = BAND0;
if (arg('json')) writeFileSync(arg('json'), JSON.stringify(out));
