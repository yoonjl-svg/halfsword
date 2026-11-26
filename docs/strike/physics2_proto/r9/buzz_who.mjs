import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const w = String(args.weapon ?? 'zweihander'); const DT = 1 / 120; const ctx = {};
for (const seed of [1, 2]) {
  const G = H.newRound({ walls: true, seed, weapon: w, AI2Class: H.AI }); const prev = new Map(); let shown = 0;
  for (let i = 0; i < Math.round(20 / DT); i++) { G.step();
    for (const f of [G.player, G.enemy]) { const tag = f === G.player ? 'P' : 'E'; const get = (b, k) => { const v = b.angvel(); const p = prev.get(tag + k); prev.set(tag + k, { x: v.x, y: v.y, z: v.z }); return p && (v.x * p.x + v.y * p.y + v.z * p.z) < 0 ? Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z) / 2 : 0; };
      const ou = get(f.bodies.uarmS, 'u'), of = get(f.bodies.farmS, 'f');
      if (ou > 5 && of < 1) { const key = `${f.state} · 팔 ${f.limbs?.armS?.toFixed?.(1)} · 뗀 토막 ${[...(f.detachedParts ?? [])].join('/') || '-'} · 칼 ${f.armed ? '쥠' : '놓음'} · 근육 ${f.muscle?.toFixed?.(2)}`; (ctx[key] ||= { n: 0, first: `씨앗 ${seed} ${tag} t ${(i * DT).toFixed(2)}` }).n++; } } }
}
console.log(Object.entries(ctx).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `  ${v.n} 스텝: ${k} (처음 ${v.first})`).join('\n') || '  없음');
