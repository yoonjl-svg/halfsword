// r23 진단: AI 내려베기 한 획의 때들 (휘두르기 켜짐 · 칼 나감(strike) · 걸음 부탁 · 앞발 뜸 · 디딤 · 맞음).
//  node diag_cut.mjs --root=<나무> --seeds=4001-4010 [--json=파일]  — 관문(wb_gate)과 같은 싸움 · 같은 획 고르기 · 같은 strokeWB
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure, seedList, q } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const M = makeMeasure(H); const DT = M.DT;
const DESC = new Set(['zornhau', 'zornhauL', 'oberhau']);
const out = [];
for (const s of seedList(args.seeds ?? '4001-4010')) {
  const G = H.newRound({ walls: true, seed: s, weapon: 'longsword', weapon2: 'longsword', AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
  const T = new Map(); // f → { strikeAt: [], reqAt: [] }
  for (const f of ais.keys()) { const rec = { strike: [], req: [], n: 0, kd: [], ph: [] }; T.set(f, rec); const g = f.gait; if (g?.requestStep) { const o = g.requestStep.bind(g); g.requestStep = (opt) => { const ok = o(opt); if (ok) rec.req.push({ i: rec.n, kind: opt?.kind, fwd: opt?.fwd }); return ok; }; } }
  const det = (f, i, prev, st) => {
    const rec = T.get(f); rec.n = i + 1; const ai = ais.get(f); const Lg = f.gait?.legs; rec.kd[i] = Lg ? `${Lg.F.stance ? '-' : Lg.F.kind}/${Lg.B.stance ? '-' : Lg.B.kind}` : '?'; rec.ph[i] = `${ai.mode}:${ai.phase}:${(f.move?.y ?? 0).toFixed(2)}`; if (ai.phase === 'strike' && st.prevPh !== 'strike') rec.strike.push(i); st.prevPh = ai.phase;
    const swOn = !!f.skill?.swinging && !st.prevSw; st.prevSw = !!f.skill?.swinging;
    const tech = ai.tech; const tn = tech?.name;
    const busy = !!f.skill?.tap || !!f.skill?.swinging, busyOn = busy && !st.prevBusy; st.prevBusy = busy; const other = busyOn && (tech == null || tech !== st.evTech) ? { o: i, kind: 'other' } : null;
    if (tech !== st.lastTech) { st.lastTech = tech; st.armed = M.STICH.has(tn) || DESC.has(tn) ? tn : null; }
    let ev = null; if (st.armed && swOn && f.state === 'stand') { ev = { o: i, kind: M.STICH.has(st.armed) ? 'thrust' : 'cut', tech: st.armed, desc: DESC.has(st.armed) }; st.armed = null; st.evTech = tech; }
    return ev ?? other;
  };
  for (const { f, line, ev, hits } of M.fightRaw(G, ais, 30, det)) {
    const rec = T.get(f);
    for (let j = 0; j < ev.length; j++) {
      const e = ev[j]; if (e.kind !== 'cut' || !e.desc) continue; const nx = ev[j + 1]?.o ?? Infinity;
      const r = M.strokeWB(line, e.o, hits, 'cut', nx);
      const sk = rec.strike.filter((i) => i >= e.o - 2 && i < Math.min(nx, e.o + 180)); const rq = rec.req.filter((x) => x.i >= e.o - 30 && x.i < Math.min(nx, e.o + 180));
      const iS = sk[0] ?? null; const t0 = e.o + Math.round(r.t0rel / 1000 / DT);
      const hit = r.hit ? t0 + Math.round(r.tHit / DT) : null;
      let lift = null; { const a = Math.max(1, t0 - 36), lend = Math.min(line.length - 3, (hit ?? t0 + 180) + 24); for (let i = a; i <= lend && lift == null; i++) for (const k of ['F', 'B']) if (M.offRun(line, i, 'on' + k)) { lift = i; break; } }
      out.push({ liftRel: lift != null ? (lift - e.o) * DT : null, liftKind: lift != null ? rec.kd[lift + 2] : null, liftPh: lift != null ? rec.ph[lift] : null, seed: s, tech: e.tech, fell: r.fell, hit: r.hit, footGap: r.footGap, tHit: r.tHit, t0rel: r.t0rel, strikeRel: iS != null ? (iS - e.o) * DT : null, hitFromStrike: hit != null && iS != null ? (hit - iS) * DT : null, req: rq.map((x) => ({ t: (x.i - e.o) * DT, kind: x.kind, fwd: x.fwd })), landFromStrike: hit != null && iS != null && r.footGap != null ? (hit + Math.round(r.footGap / DT) - iS) * DT : null });
    }
  }
}
const h = out.filter((r) => r.hit && r.footGap != null && !r.fell);
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');
console.log('desc strokes', out.length, 'hit+gap', h.length, 'blade-first', (h.filter((r) => r.footGap > 0).length / h.length).toFixed(2), 'med gap', f3(q(h.map((r) => r.footGap), 0.5)));
for (const k of ['strikeRel', 'hitFromStrike', 'landFromStrike', 'tHit']) console.log(k, 'p10', f3(q(h.map((r) => r[k]), 0.1)), 'med', f3(q(h.map((r) => r[k]), 0.5)), 'p90', f3(q(h.map((r) => r[k]), 0.9)));
console.log('with step req', h.filter((r) => r.req.length).length, 'req rel strike med', f3(q(h.filter((r) => r.req.length && r.strikeRel != null).map((r) => r.req[r.req.length - 1].t - r.strikeRel), 0.5)));
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
