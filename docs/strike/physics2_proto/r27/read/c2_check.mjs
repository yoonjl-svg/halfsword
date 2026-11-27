// Independent C2 recompute: over-limit shares and excess-impulse share, old vs new, with the filter split out.
// Usage: node c2_check.mjs <probe dir> old new4
import { readFileSync } from 'node:fs';
const [dir, ...tags] = process.argv.slice(2);
const SC = ['fight', 'lunge', 'walk', 'back', 'strafe', 'stand'];
const load = (f) => { try { return readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const mk = () => ({ n: 0, o1: 0, o125: 0, ex: 0, tot: 0, o1lim: 0 });
const pc = (a, b) => (b ? (100 * a / b).toFixed(2) : '-');
const show = (A) => `${pc(A.o1, A.n)} / ${pc(A.o125, A.n)} / ${pc(A.ex, A.tot)} (n ${A.n})`;
for (const tag of tags) {
  const R = {}; const g = (k) => (R[k] ||= mk());
  let mism = 0, lines = 0, notStand = 0, notReg = 0;
  for (const sc of SC) for (const l of load(`${dir}/${tag}_${sc}.ab.jsonl`)) {
    lines++;
    if ((l.state ?? 'stand') !== 'stand') { notStand++; continue; }
    if (!l.reg) { notReg++; continue; }
    l.J.forEach((j, ji) => {
      const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
      const part = l.cc ? 'cc' : 'ot';
      for (const [an, a] of Object.entries(j.ax)) {
        const t = a[9], lim = a[10], ratio = a[5];
        if (lim > 0 && Math.abs(Math.abs(t) / lim - ratio) > 2e-4 + 1e-3 * ratio) mism++;
        for (const k of [`${good ? 'good' : 'dropped'}.${part}`, `all.${part}`, ...(good ? [`good.${part}.${sc === 'fight' ? 'fight' : 'other'}`] : [])]) {
          const A = g(k); A.n++; if (ratio > 1) A.o1++; if (ratio > 1.25) A.o125++; A.ex += Math.max(0, Math.abs(t) - lim); A.tot += Math.abs(t);
        }
      }
    });
  }
  console.log(`== ${tag}: lines ${lines} · not stand ${notStand} · not reg ${notReg} · ratio!=|t|/lim ${mism}`);
  for (const k of Object.keys(R).sort()) console.log(`  ${k.padEnd(18)} >1 / >1.25 / excess-impulse %: ${show(R[k])}`);
}
