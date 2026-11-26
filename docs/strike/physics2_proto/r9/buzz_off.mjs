import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root)); const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const w = String(args.weapon ?? 'longsword'); const part = String(args.part ?? 'uarmO'); const DT = 1 / 120; const ctx = {}; let tot = 0, all = 0;
for (const seed of [1, 2]) {
  const G = H.newRound({ walls: true, seed, weapon: w, AI2Class: H.AI }); const prev = new Map();
  for (let i = 0; i < Math.round(20 / DT); i++) { G.step();
    for (const f of [G.player, G.enemy]) { if (f.state === 'dead') continue; const tag = f === G.player ? 'P' : 'E'; const b = part === 'sword' ? f.sword : f.bodies[part]; if (!b) continue; const v = b.angvel(); const p = prev.get(tag); prev.set(tag, { x: v.x, y: v.y, z: v.z }); all++;
      if (!p || (v.x * p.x + v.y * p.y + v.z * p.z) >= 0) continue; const o = Math.hypot(v.x - p.x, v.y - p.y, v.z - p.z) / 2; if (o < 1) continue; tot++;
      const key = `${f.state} · 쥠 ${f.gripping ? '예' : '아니오'} · 빈팔 ${f.limbs?.armO?.toFixed?.(1)} · 칼팔 ${f.limbs?.armS?.toFixed?.(1)} · 놓인 팔 ${f.armsPlaced?.() ? '예' : '아니오'} · 칼 ${f.armed ? '쥠' : '놓음'} · 뗀 ${[...(f.detachedParts ?? [])].join('/') || '-'} · 기술 ${f.skill?.tap?.name ?? f.skill?.tech ?? '-'} · 칼 상태 ${f.skill?.phase ?? f.skill?.stroke?.phase ?? '-'}`;
      (ctx[key] ||= { n: 0, o: 0 }); ctx[key].n++; ctx[key].o += o; } }
}
console.log(`${w} ${part}: 뒤집힌 스텝 ${tot}/${all} (${(100 * tot / all).toFixed(1)} %)`);
console.log(Object.entries(ctx).sort((a, b) => b[1].n - a[1].n).slice(0, 10).map(([k, v]) => `  ${v.n} 스텝 · 평균 ${(v.o / v.n).toFixed(1)} rad/s: ${k}`).join('\n'));
