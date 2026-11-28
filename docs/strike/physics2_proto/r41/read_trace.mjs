// 읽는 쪽 확인: near 장면에서 칼끝 장부의 깊이 d 를 엔진 질의(containsPoint · projectPoint · castRay)로 따로 재어 맞댐. 힘 · 자리를 건드리지 않음.
// node trace.mjs --root=. --w=rapier --seeds=4001-4010 [--fp=10] --json=out
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { makeMeasure, seedList, rng } = await imp('tools/sim/wb_measure.mjs');
const THREE = await imp('node_modules/three/build/three.module.js'); const CM = await imp('src/combat.js'); const { Combat, PIERCE } = CM;
if (args.fp != null) PIERCE.FP = +args.fp;
const M = makeMeasure(H);
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } };
const W = String(args.w ?? 'rapier');
const q3 = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w); const v3 = (v) => new THREE.Vector3(v.x, v.y, v.z);
let rec = null; let k = 0; let on = false; let pair = null;
const oPS = Combat.prototype.pierceStep;
Combat.prototype.pierceStep = function (world, p, dt) {
  const att = p.pr.w.fighter;
  if (!on || att !== pair[0]) return oPS.call(this, world, p, dt);
  const was = p.entered;
  oPS.call(this, world, p, dt);
  if (!p.entered) return;
  const sw = p.pr.w.body, vb = p.pr.v.body, vcol = world.getCollider(p.pr.vc);
  const cfg = att.weaponCfg; const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q3(sw.rotation()));
  const tip = v3(sw.translation()).addScaledVector(ax, cfg.hiltLength + cfg.bladeLength);
  const inside = vcol.containsPoint(tip);
  const pj = vcol.projectPoint(tip, false); const depthSurf = pj ? (inside ? 1 : -1) * tip.distanceTo(v3(pj.point)) : null; // 칼끝이 겉 밑 몇 m (안 +)
  // 칼 축을 따라 칼끝 → 손잡이 쪽으로 몇 m 가 그 토막 안인가 (칼날이 토막을 꿰고 있나)
  let inLen = 0; const N = 60, L = cfg.bladeLength; for (let i = 0; i < N; i++) { const pt = tip.clone().addScaledVector(ax, -L * (i + 0.5) / N); if (vcol.containsPoint(pt)) inLen += L / N; }
  const R = rec.cur;
  if (!p.__e) { R.list.push(p.__e = { part: p.pr.v.part, k0: k, Lexit: p.Lexit, Eb: p.Eb && [p.Eb.x, p.Eb.y, p.Eb.z], steps: [], wasAtOn: was }); }
  const e = p.__e;
  const tb = tip.clone().sub(v3(vb.translation())).applyQuaternion(q3(vb.rotation()).invert());
  e.steps.push({ dk: k - e.k0, d: +p.d.toFixed(4), s: +p.s.toFixed(3), J: +p.J.toFixed(4), pierced: p.pierced, inside, depthSurf: depthSurf == null ? null : +depthSurf.toFixed(4), inLen: +inLen.toFixed(3), tb: [+tb.x.toFixed(4), +tb.y.toFixed(4), +tb.z.toFixed(4)], end: p.end ?? null });
};
const oPE = Combat.prototype.pierceEnd;
Combat.prototype.pierceEnd = function (p, why) { oPE.call(this, p, why); if (on && rec?.cur && p.entered) { const e = p.__e; if (e) e.end = why; } };
const out = [];
for (const s of seedList(args.seeds ?? '4001-4010')) {
  rec = { cur: { seed: s, list: [] } }; on = false; k = 0;
  const R0 = rng(s * 7 + 1); let gn = null; for (const w of ['rapier', 'longsword']) { for (let q = 0; q < 3; q++) R0(); const g0 = BODY.reach[w] + BODY.front - (0.05 + 0.30 * R0()); if (w === W) gn = g0; }
  const onTap = (G, P, E) => { pair = [P, E]; on = true; const C = G.combat; const o = C.afterStep.bind(C); C.afterStep = function (w, q) { o(w, q); k++; }; };
  M.runThrust(s, W, { gap: gn, pelvisGap: gn, post: 3.2, wb: true, onTap });
  out.push(rec.cur);
  const L = rec.cur.list; console.log(`seed ${s} · 장부 ${L.length} · ` + L.map((e) => `${e.part} dMax ${Math.max(...e.steps.map((x) => x.d)).toFixed(3)} Lexit ${e.Lexit?.toFixed(3)} 끝 ${e.end ?? '-'}`).join(' | '));
}
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
