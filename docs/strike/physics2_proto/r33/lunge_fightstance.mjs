// r33 짓기 1 (d) — 싸움 중 탭 찌르기를 낼 때의 선 자세 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//  node lunge_fightstance.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4001-4004] [--secs=30] [--json=파일]
//   장면 = AI 대 AI 같은 무기 (lunge_ai.mjs 와 같은 newRound) · 탭 = skill.thrusts 가 는 스텝(쓰러진 상대 찍기 빼고 · 서 있을 때)
//   탭마다: 상대 쪽을 앞으로 두 발 앞뒤 간격(gait.frontLeg 의 앞발 − 뒷발 · 발바닥 가운데 pinC) · 옆 간격 · 무게중심 − 뒷발(d) · 걷는 중 · 상대 가슴까지 − 무기 팔 닿음(MEASURED contact) · 거리에 맞춘 런지(tap.far) 칸
//   더해 서 있는 모든 몸을 0.5 s 마다 같은 셈으로 (싸움 중 선 자세의 바탕 분포 — 나란한 자세(앞뒤 < 0.1 m)가 나오는가)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { seedList, q } = await imp('tools/sim/wb_measure.mjs'); const { MEASURED } = await imp('src/weapon_measured.js');
const { DT } = H; const seeds = seedList(args.seeds ?? '4001-4004'); const SECS = +(args.secs ?? 30); const WS = String(args.w ?? 'rapier,longsword').split(',');
const geo = (f) => { const p = f.bodies.pelvis.translation(), e = f.foe.bodies.pelvis.translation(); let ux = e.x - p.x, uz = e.z - p.z; const d = Math.hypot(ux, uz); ux /= d; uz /= d; const fw = { x: ux, z: uz };
  const L = f.gait.legs; const fr = f.gait.frontLeg(fw); const A = L[fr].pinC, B = L[fr === 'F' ? 'B' : 'F'].pinC; const c = f.com;
  return { spread: (A.x - B.x) * ux + (A.z - B.z) * uz, side: Math.abs((A.x - B.x) * -uz + (A.z - B.z) * ux), d: c ? (c.x - B.x) * ux + (c.z - B.z) * uz : NaN, walk: !!f.gait.walking, two: L.F.stance && L.B.stance, over: f.foeDistance() - (MEASURED[f.weapon?.id]?.[0] ?? NaN) }; };
const taps = [], samp = [];
for (const W of WS) for (const seed of seeds) {
  const G = H.newRound({ walls: true, seed, weapon: W, weapon2: W, AI2Class: H.AI }); const F = [G.player, G.enemy];
  const th = new Map(F.map((f) => [f, f.skill?.thrusts ?? 0]));
  for (let k = 0; k < Math.round(SECS / DT); k++) {
    G.step();
    for (const f of F) {
      if (!f.alive || !f.foe || !f.gait?.active) { th.set(f, f.skill?.thrusts ?? 0); continue; }
      const n = f.skill?.thrusts ?? 0;
      if (n > th.get(f) && !f.skill.tap?.down && f.state === 'stand') taps.push({ W, seed, k, ...geo(f), far: f.skill.tap?.far ? f.skill.tap.far.step : 0, req: f.gait.req?.kind === 'lunge' ? +f.gait.req.fwd.toFixed(2) : 0 });
      th.set(f, n);
      if (k % Math.round(0.5 / DT) === 0 && f.state === 'stand') samp.push({ W, ...geo(f) });
    }
  }
  try { G.world.free(); } catch { /* */ }
}
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const dist = (name, E) => { if (!E.length) return console.log(`${name}: 0`); const qq = (k) => `${f2(q(E.map((e) => e[k]), 0.1))} / ${f2(q(E.map((e) => e[k]), 0.5))} / ${f2(q(E.map((e) => e[k]), 0.9))}`;
  console.log(`${name}: ${E.length} | 앞뒤 간격 10/50/90 % ${qq('spread')} m · 나란함(|앞뒤| < 0.1) ${E.filter((e) => Math.abs(e.spread) < 0.1).length} · 옆 ${qq('side')} · 무게중심 − 뒷발 ${qq('d')} · d < 0.05 ${E.filter((e) => e.d < 0.05).length} · 걷는 중 ${E.filter((e) => e.walk).length} · 두 발 디딤 ${E.filter((e) => e.two).length} · 가슴 거리 − 팔 닿음 ${qq('over')} · 먼 런지 칸 0.6/0.9 ${E.filter((e) => e.far === 0.6).length}/${E.filter((e) => e.far === 0.9).length}`); };
console.log(`AI 대 AI 같은 무기 · 씨앗 ${seeds[0]}-${seeds[seeds.length - 1]} · ${SECS} s`);
for (const W of WS) { dist(`${W} 탭 때`, taps.filter((e) => e.W === W)); dist(`${W} 서 있는 0.5 s 표본`, samp.filter((e) => e.W === W)); }
if (args.json) writeFileSync(String(args.json), JSON.stringify({ taps, samp }));
