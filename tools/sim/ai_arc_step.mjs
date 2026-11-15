// ─────────────────────────────────────────────────────────────
//  ai_arc_step.mjs — ① 둥근 칼 읽기의 내다보는 칸 견줌 (11/15 사장님 '0.05 s 칸이 무엇을 바꾸나 · 가장 좋은 수는?' → 물리 한 스텝 1/120 s 로 · 기록 docs/strike/ai_arc_2026-11-15.md)
//  판 여섯(긴 칼 · 짧은 칼 섞음 · 숙련 5 · 20 s)에서 AI 가 둥근 눈을 부른 때의 늦게 본 칼 모습을 그대로 적어 두고, 같은 모습을 칸 1/120 s 와 0.055 s(실제 0.05 s)로 내다봐 견줌:
//  ① 잡음 — 둘 다 · 1/120 만(0.05 칸이 원통 0.55 m 를 건너뛴 것) · 0.05 만 ② 값 — 1000 번 내다보는 데 드는 ms (같은 기계 · 같은 모습 되풀이) · 판 한 스텝마다 더 드는 몫
//  node tools/sim/ai_arc_step.mjs
// ─────────────────────────────────────────────────────────────
import { newRound, AI, CONFIG } from './harness_m.mjs';

const H = CONFIG.AI_ARC.horizon;
/** ai.js arcHit 과 같은 셈 (칸 dt) — 처음 든 시각 또는 -1 */
export function predict(s, c, dt) {
  const sp = Math.hypot(s.tvx, s.tvy, s.tvz);
  if (sp < 3.5) return -1;
  const ex = s.tx - s.mx, ey = s.ty - s.my, ez = s.tz - s.mz;
  const e2 = ex * ex + ey * ey + ez * ez;
  if (e2 < 1e-6 || (ex * s.tvx + ey * s.tvy + ez * s.tvz) / (Math.sqrt(e2) * sp) > 0.75) return -1;
  const dvx = s.tvx - s.mvx, dvy = s.tvy - s.mvy, dvz = s.tvz - s.mvz;
  const wx = (ey * dvz - ez * dvy) / e2, wy = (ez * dvx - ex * dvz) / e2, wz = (ex * dvy - ey * dvx) / e2;
  const w2 = wx * wx + wy * wy + wz * wz;
  if (w2 < 1e-9) return -1;
  const wn = Math.sqrt(w2);
  const ax = wx / wn, ay = wy / wn, az = wz / wn;
  const ox = s.mx + (wy * s.mvz - wz * s.mvy) / w2, oy = s.my + (wz * s.mvx - wx * s.mvz) / w2, oz = s.mz + (wx * s.mvy - wy * s.mvx) / w2;
  const drift = s.mvx * ax + s.mvy * ay + s.mvz * az;
  const n = Math.max(1, Math.round(H / dt));
  const c1 = Math.cos(wn * dt), s1 = Math.sin(wn * dt);
  let cs = 1, sn = 0;
  for (let k = 1; k <= n; k++) {
    const cn = cs * c1 - sn * s1;
    sn = sn * c1 + cs * s1;
    cs = cn;
    const t = k * dt;
    for (let p = 0; p < 2; p++) {
      const qx = (p ? s.mx : s.tx) - ox, qy = (p ? s.my : s.ty) - oy, qz = (p ? s.mz : s.tz) - oz;
      const qa = (qx * ax + qy * ay + qz * az) * (1 - cs) + drift * t;
      const hx = ox + qx * cs + (ay * qz - az * qy) * sn + ax * qa - c.x;
      const hz = oz + qz * cs + (ax * qy - ay * qx) * sn + az * qa - c.z;
      if (hx * hx + hz * hz > 0.3025) continue;
      const hy = oy + qy * cs + (az * qx - ax * qz) * sn + ay * qa - c.y;
      if (hy < -1.3 || hy > 0.75) continue;
      return t;
    }
  }
  return -1;
}

const K = ['tx', 'ty', 'tz', 'mx', 'my', 'mz', 'tvx', 'tvy', 'tvz', 'mvx', 'mvy', 'mvz'];
const FIGHTS = [['zweihander', 'hwando', 1], ['zweihander', 'qinggang', 2], ['longsword', 'zweihander', 3], ['flamberge', 'uchigatana', 4], ['rapier', 'hwando', 5], ['kriegsmesser', 'monohoshizao', 6]];
const rec = [];
let steps = 0, checks = 0, tStep = 0;
for (const [w1, w2, seed] of FIGHTS) {
  const G = newRound({ seed, walls: true, weapon: w1, weapon2: w2, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  for (const ai of [G.ai, G.ai2]) {
    const f = ai.arcHit;
    ai.arcHit = function (s, c) {
      checks++;
      const o = { c: { x: c.x, y: c.y, z: c.z } };
      for (const k of K) o[k] = s[k];
      rec.push(o);
      return f.call(this, s, c);
    };
  }
  const t0 = performance.now();
  while (G.t < 20 && G.player.alive && G.enemy.alive) { G.step(); steps++; }
  tStep += performance.now() - t0;
  G.world.free();
}
const fine = CONFIG.PHYSICS.timestep, coarse = CONFIG.realS(0.05);
let both = 0, onlyFine = 0, onlyCoarse = 0, none = 0, lead = 0;
for (const o of rec) {
  const a = predict(o, o.c, fine), b = predict(o, o.c, coarse);
  if (a >= 0 && b >= 0) both++, (lead += b - a);
  else if (a >= 0) onlyFine++;
  else if (b >= 0) onlyCoarse++;
  else none++;
}
const time = (dt) => {
  const R = 20;
  const t0 = performance.now();
  let x = 0;
  for (let r = 0; r < R; r++) for (const o of rec) x += predict(o, o.c, dt);
  return { ms: ((performance.now() - t0) / (R * rec.length)) * 1000, x };
};
time(fine); time(coarse); // 데움
const tf = time(fine), tc = time(coarse);
const hits = both + onlyFine;
console.log(`판 ${FIGHTS.length} · 스텝 ${steps} · 둥근 눈을 부른 때 ${checks} (스텝당 ${(checks / steps).toFixed(3)})`);
console.log(`잡음 — 둘 다 ${both} · 1/120 만 ${onlyFine} (0.05 칸이 건너뜀 · 1/120 잡음의 ${((100 * onlyFine) / Math.max(1, hits)).toFixed(1)} %) · 0.05 만 ${onlyCoarse} · 둘 다 안 잡음 ${none} · 둘 다 잡은 때 0.05 가 늦게 본 몫 가운데 ${(lead / Math.max(1, both)).toFixed(4)} s(게임)`);
console.log(`값 — 1000 번 내다보기: 1/120 ${tf.ms.toFixed(3)} ms · 0.05 ${tc.ms.toFixed(3)} ms · 판 한 스텝(물리 포함) ${(tStep / steps).toFixed(3)} ms · 스텝당 더 드는 몫 1/120 ${((tf.ms / 1000) * (checks / steps)).toFixed(4)} ms (${((100 * (tf.ms / 1000) * (checks / steps)) / (tStep / steps)).toFixed(2)} %)`);
