// ─────────────────────────────────────────────────────────────
//  u3_nudge.mjs (r34 · 뛰기 여섯째 진단 · 안 본 판) — 서 있는 몸에 run_scenes 와 같은 가슴 치기(6 N·s)를 자리 잡기 몇 초 뒤에 주고, 그 앞뒤 무게중심 빠르기 · 몸이 잠들었는지를 적는다. 재기만(치기는 run_scenes 의 시험 충격 그대로).
//   node u3_nudge.mjs --root=<칸> --weapon=zweihander --variant=100 --at=2.4,14   (at = 치는 때 s · 판 번호는 난수 씨앗 · 치는 쪽에만 씀)
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const DT = H.DT, v = +(args.variant ?? 100);
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
for (const at of String(args.at ?? '2.4,14').split(',').map(Number)) {
  const G = H.newRound({ walls: false, weapon: String(args.weapon ?? 'zweihander'), seed: 100 + v });
  G.park();
  const P = G.player, bodies = Object.values(P.bodies);
  const com = () => { let M = 0, vx = 0, vz = 0; for (const b of bodies) { const m = b.mass(), u = b.linvel(); M += m; vx += m * u.x; vz += m * u.z; } return Math.hypot(vx, vz) / M; };
  const sleeping = () => bodies.filter((b) => b.isSleeping?.()).length;
  const n = Math.round(at / DT), out = [];
  for (let i = 0; i < n + Math.round(0.6 / DT); i++) {
    P.move.set(0, 0);
    if (i === n) { out.push(`앞: v ${com().toFixed(4)} 잠든 몸 ${sleeping()}/${bodies.length} 상태 ${P.state}`); hitChest(P, 6, v * 2.39996); out.push(`친 바로 뒤: v ${com().toFixed(4)} 잠든 몸 ${sleeping()}`); }
    G.step();
    if (i === n + 1 || i === n + 12 || i === n + Math.round(0.5 / DT)) out.push(`+${((i - n) * DT).toFixed(3)} s: v ${com().toFixed(4)} 잠든 몸 ${sleeping()}`);
  }
  console.log(`치는 때 ${at} s · ${args.weapon ?? 'zweihander'} 판 ${v}: ` + out.join(' · '));
  try { G.world.free(); } catch { /* */ }
}
