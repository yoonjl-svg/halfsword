// r33 Q4 — AI 길 레이피어 탭 찌르기에서 골반 앞 빠르기가 어디서 나오나 (걸어 들어감인가 · 런지 걸음인가) — 읽기만 (몸에 힘 · 빠르기를 걸지 않음)
//  node lunge_ai.mjs --root=<나무> [--seeds=4001-4010] [--secs=30] [--json=파일]
//   장면 = AI 대 AI 레이피어 (tools/sim/wb_measure.mjs runThrustAI 와 같은 newRound) · 탭 = skill.thrusts 가 는 스텝 (wb_measure thrustDetect 와 같은 셈)
//   탭마다: 그때 골반 → 상대 골반 간격 · 탭 앞 0.25 s 와 탭 때 골반 앞 빠르기(상대 쪽) · 탭 뒤 0.6 s 안 골반 최고 · 그 최고 때 걸음 상태(walking · fastK · 런지 부탁 · lungeBrake) ·
//   탭 뒤 0.6 s 동안 가려는 속도(legIntent.want) 앞 몫 최고 · aLim 최고. 갈래: 탭 때 이미 ≥ 0.6 m/s = '걸어 들어감' · 최고가 런지 걸음 발이 떠 있는 동안 = '런지'.
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { seedList, q } = await imp('tools/sim/wb_measure.mjs');
const { DT } = H; const seeds = seedList(args.seeds ?? '4001-4010'); const SECS = +(args.secs ?? 30);
const ev = [];
for (const seed of seeds) {
  const G = H.newRound({ walls: true, seed, weapon: 'rapier', weapon2: 'rapier', AI2Class: H.AI }); const F = [G.player, G.enemy];
  const hist = new Map(F.map((f) => [f, []])); const th = new Map(F.map((f) => [f, f.skill?.thrusts ?? 0])); const open = [];
  for (let k = 0; k < Math.round(SECS / DT); k++) {
    G.step();
    for (const f of F) {
      if (!f.alive || !f.foe) continue; const p = f.bodies.pelvis.translation(), e = f.foe.bodies.pelvis.translation(); let ux = e.x - p.x, uz = e.z - p.z; const d = Math.hypot(ux, uz); ux /= d; uz /= d; const v = f.bodies.pelvis.linvel();
      const g = f.gait; const sw = g ? (!g.legs.F.stance && g.legs.F.kind === 'req' ? 1 : !g.legs.B.stance && g.legs.B.kind === 'req' ? 1 : 0) : 0; const it = f.legIntent;
      const s = { k, pv: v.x * ux + v.z * uz, d, walk: !!g?.walking, fast: (g?.fastK ?? 1) > 1, lunge: g?.req?.kind === 'lunge' && g.req.fwd > 0, swReq: !!sw, lb: !!g?.lungeBrake, want: it ? it.want.x * ux + it.want.z * uz : NaN, aLim: it?.aLim ?? NaN, st: f.state };
      const hs = hist.get(f); hs.push(s); if (hs.length > 40) hs.shift();
      const n = f.skill?.thrusts ?? 0; if (n > th.get(f) && !f.skill.tap?.down && f.state === 'stand') open.push({ f, seed, k0: k, pre: hs[0]?.pv ?? NaN, at: s.pv, gap: d, rows: [] }); th.set(f, n);
      for (const o of open) if (o.f === f && k - o.k0 < Math.round(0.6 / DT)) o.rows.push(s);
    }
  }
  try { G.world.free(); } catch { /* */ }
  for (const o of open) { if (o.rows.length < 60) continue; let b = o.rows[0]; for (const r of o.rows) if (r.pv > b.pv) b = r;
    ev.push({ seed: o.seed, gap: +o.gap.toFixed(2), pre: +o.pre.toFixed(2), at: +o.at.toFixed(2), pk: +b.pv.toFixed(2), tPk: +((b.k - o.k0) * DT).toFixed(3), pkWalk: b.walk, pkFast: b.fast, pkLunge: b.lunge, pkSwReq: b.swReq, pkLb: b.lb, wantMax: +Math.max(...o.rows.map((r) => r.want)).toFixed(2), aLimMax: +Math.max(...o.rows.map((r) => r.aLim)).toFixed(1), anyLunge: o.rows.some((r) => r.lunge), fell: o.rows.some((r) => r.st !== 'stand') }); }
}
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'); const med = (a) => q(a, 0.5);
const show = (name, E) => { if (!E.length) return console.log(`${name}: 0`); console.log(`${name}: ${E.length} 탭 · 간격 가운데 ${f2(med(E.map((e) => e.gap)))} m · 탭 앞 0.25 s 골반 ${f2(med(E.map((e) => e.pre)))} · 탭 때 ${f2(med(E.map((e) => e.at)))} · 탭 뒤 0.6 s 최고 ${f2(med(E.map((e) => e.pk)))} (90 % ${f2(q(E.map((e) => e.pk), 0.9))}) m/s @${f2(med(E.map((e) => e.tPk)))} s · 최고 때 걷는 중 ${E.filter((e) => e.pkWalk).length} · 빠른 디딤 ${E.filter((e) => e.pkFast).length} · 런지 발 떠 있음 ${E.filter((e) => e.pkSwReq && e.pkLunge).length} · lungeBrake ${E.filter((e) => e.pkLb).length} · 런지 부탁 있던 탭 ${E.filter((e) => e.anyLunge).length} · want 최고 가운데 ${f2(med(E.map((e) => e.wantMax)))} · aLim 최고 가운데 ${f2(med(E.map((e) => e.aLimMax)))} · 넘어짐 ${E.filter((e) => e.fell).length}`); };
console.log(`AI 대 AI 레이피어 · 씨앗 ${seeds[0]}-${seeds[seeds.length - 1]} · ${SECS} s`);
show('모든 탭', ev); show('간격 ≥ 2.05 m (관문 AI 먼 장면 금)', ev.filter((e) => e.gap >= 2.05)); show('  그 가운데 골반 최고 ≥ 1.0 m/s', ev.filter((e) => e.gap >= 2.05 && e.pk >= 1.0)); show('  그 가운데 탭 때 이미 ≥ 0.6 m/s (걸어 들어감)', ev.filter((e) => e.gap >= 2.05 && e.at >= 0.6));
if (args.json) writeFileSync(String(args.json), JSON.stringify(ev));
