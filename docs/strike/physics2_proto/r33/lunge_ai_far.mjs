// r33 짓기 2 — AI 찌르기가 거리에 맞춘 런지 걸음(skill.js farLunge · tap.far)으로 나가는지 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//  node lunge_ai_far.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4001-4010] [--secs=30] [--json=파일]
//   장면 = AI 대 AI 같은 무기 (H.newRound · AI2Class H.AI · 벽 있음 — lunge_ai.mjs 와 같은 틀) · 탭 = skill.thrusts 가 는 스텝(쓰러진 상대 찍기 빼고)
//   탭마다: tap.far(칸 걸음 m) · 가슴 사이 거리(foeDistance) · 탭 뒤 0.8 s 안 무게중심 앞 빠르기 최고(상대 쪽) · 탭 뒤 1.5 s 안 넘어짐(state 가 stand 아님) · 탭 뒤 1.0 s 안 그 상대에 상처
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { seedList, q } = await imp('tools/sim/wb_measure.mjs');
const { DT } = H; const seeds = seedList(args.seeds ?? '4001-4010'); const SECS = +(args.secs ?? 30); const WS = String(args.w ?? 'rapier,longsword').split(',');
const ev = [];
for (const W of WS) for (const seed of seeds) {
  const G = H.newRound({ walls: true, seed, weapon: W, weapon2: W, AI2Class: H.AI }); const F = [G.player, G.enemy];
  const wounds = []; { const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, ...x) => { ow?.(A, Vc, ...x); wounds.push({ k: kNow, A, Vc }); }; }
  let kNow = 0; const th = new Map(F.map((f) => [f, f.skill?.thrusts ?? 0])); const open = [];
  for (let k = 0; k < Math.round(SECS / DT); k++) {
    kNow = k; G.step();
    for (const f of F) {
      if (!f.alive || !f.foe) continue;
      const n = f.skill?.thrusts ?? 0;
      if (n > th.get(f) && !f.skill.tap?.down && f.state === 'stand') { const p = f.bodies.pelvis.translation(), e = f.foe.bodies.pelvis.translation(); let ux = e.x - p.x, uz = e.z - p.z; const d = Math.hypot(ux, uz);
        open.push({ f, W, seed, k0: k, ux: ux / d, uz: uz / d, far: f.skill.tap?.far?.step ?? 0, dist: +f.foeDistance().toFixed(2), walk: !!f.gait?.walking, cpk: -Infinity, fell: false }); }
      th.set(f, n);
      for (const o of open) { if (o.f !== f) continue; const dk = k - o.k0; if (dk < Math.round(0.8 / DT) && f.comVel) o.cpk = Math.max(o.cpk, f.comVel.x * o.ux + f.comVel.z * o.uz); if (dk < Math.round(1.5 / DT) && f.state !== 'stand') o.fell = true; }
    }
  }
  try { G.world.free(); } catch { /* */ }
  for (const o of open) ev.push({ W: o.W, seed: o.seed, far: o.far, dist: o.dist, walk: o.walk, cpk: +o.cpk.toFixed(2), fell: o.fell, hit: wounds.some((w) => w.A === o.f && w.Vc === o.f.foe && w.k >= o.k0 && w.k - o.k0 < Math.round(1.0 / DT)) });
}
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
console.log(`AI 대 AI · 씨앗 ${seeds[0]}-${seeds[seeds.length - 1]} · ${SECS} s`);
console.log('무기 | 갈래 | 탭 | 가슴 거리 가운데 | 무게중심 최고 가운데 (90 %) | 상처 1 s 안 | 넘어짐 1.5 s 안');
for (const W of WS) for (const [name, E] of [['모든 탭', ev.filter((e) => e.W === W)], ['먼 칸 0.6 m', ev.filter((e) => e.W === W && e.far === 0.6)], ['먼 칸 0.9 m', ev.filter((e) => e.W === W && e.far === 0.9)], ['칸 밖 · 거리 ≥ 1.9 m', ev.filter((e) => e.W === W && !e.far && e.dist >= 1.9)]]) {
  if (!E.length) { console.log(`${W} | ${name} | 0`); continue; }
  console.log(`${W} | ${name} | ${E.length} | ${f2(q(E.map((e) => e.dist), 0.5))} | ${f2(q(E.map((e) => e.cpk), 0.5))} (${f2(q(E.map((e) => e.cpk), 0.9))}) | ${E.filter((e) => e.hit).length} | ${E.filter((e) => e.fell).length}`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(ev));
