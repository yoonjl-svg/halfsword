// ─────────────────────────────────────────────────────────────
//  reach.mjs — 팔(칼 든 채)만으로 닿는 거리 재기 (r20 · 가까움 · 멂의 기준). 재기만 한다.
//   사람 탭 찌르기 장면(wb_measure runThrust)에서 과녁을 4 m 밖에 두고 걸음 없이(thrust({step:false})) 찌른다.
//   팔 닿음 R = 탭 뒤 1.2 s 안 칼끝의 (칼끝 − 탭 때 골반) · 앞(탭 때 과녁 쪽) 의 최고. 걸음 있는 오늘 탭(step 기본)도 같은 셈으로 적는다.
//   몸통 앞 두께 = 상대 가슴 · 배 충돌 모양의 앞쪽 반 두께(골반 중심 → 몸 앞면, 수평).
//  node docs/strike/physics2_proto/r20/reach.mjs --root=<나무> [--seeds=4901-4920] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
import { makeMeasure, seedList, q } from '../../../../tools/sim/wb_measure.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const M = makeMeasure(H);
const seeds = seedList(args.seeds ?? '4901-4920');
const out = {};
for (const weapon of ['rapier', 'longsword']) {
  for (const step of [false, true]) {
    const R = [];
    for (const s of seeds) {
      let body = null;
      const { ok, line, o } = M.runThrust(s, weapon, { gap: 4.0, post: 1.2, step, raw: true, onTap: (G, P, E) => { if (body) return; const B = E.bodies; const t = B.pelvis.translation(); let front = 0; for (const k of ['chest', 'abdomen', 'pelvis']) { const rb = B[k]; if (!rb) continue; for (let i = 0; i < rb.numColliders(); i++) { const c = rb.collider(i); const aabb = c.computeAabb ? null : null; const sh = c.shape; const p = c.translation(); const half = sh.halfExtents ? Math.max(sh.halfExtents.x, sh.halfExtents.z) : (sh.radius ?? 0) + (sh.halfHeight && false ? sh.halfHeight : 0); front = Math.max(front, Math.abs(p.x - t.x) + half); } } body = front; } });
      if (!ok) continue; const L0 = line[o]; let ux = L0.fx - L0.px, uz = L0.fz - L0.pz; const d = Math.hypot(ux, uz); ux /= d; uz /= d;
      let best = -9; for (let i = o; i < line.length; i++) best = Math.max(best, (line[i].tipx - L0.px) * ux + (line[i].tipz - L0.pz) * uz);
      R.push({ seed: s, reach: best, body });
    }
    const a = R.map((r) => r.reach); const k = `${weapon}_${step ? 'tap' : 'arm'}`;
    out[k] = { n: R.length, min: Math.min(...a), p10: q(a, 0.1), med: q(a, 0.5), p90: q(a, 0.9), max: Math.max(...a), body: q(R.map((r) => r.body), 0.5) };
    console.log(`${k.padEnd(16)} n ${R.length} · 칼끝 앞 닿음 가운데 ${out[k].med.toFixed(3)} m · 10-90 % ${out[k].p10.toFixed(3)} ~ ${out[k].p90.toFixed(3)} · 가장 큰 ${out[k].max.toFixed(3)} · 몸통 앞 두께 ${out[k].body.toFixed(3)} m`);
  }
}
if (args.json) writeFileSync(String(args.json), JSON.stringify({ seeds: args.seeds ?? '4901-4920', out }, null, 1));
