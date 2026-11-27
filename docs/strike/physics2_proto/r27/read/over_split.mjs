// Among reliable non-contact-change samples with delivered/limit > 1: is the explicit drive alone over the limit? what does the motor add (sign vs drive)?
// Usage: node over_split.mjs <probe dir> old new4
import { readFileSync } from 'node:fs';
const [dir, ...tags] = process.argv.slice(2);
const load = (f) => { try { return readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
for (const tag of tags) {
  let n = 0, explOver = 0, explAt = 0, motorSame = 0, motorOpp = 0; const mAdd = [];
  for (const sc of ['fight', 'lunge', 'walk', 'back', 'strafe', 'stand']) for (const l of load(`${dir}/${tag}_${sc}.ab.jsonl`)) {
    if ((l.state ?? 'stand') !== 'stand' || !l.reg || l.cc) continue;
    l.J.forEach((j, ji) => {
      const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
      if (!good) return;
      for (const a of Object.values(j.ax)) { if (!(a[5] > 1)) continue; n++;
        const e = a[4], mR = a[1], t = a[9], lim = a[10];
        if (Math.abs(e) > lim * 1.0001) explOver++; else if (Math.abs(e) >= 0.999 * lim) explAt++;
        if (Math.sign(mR) === Math.sign(t)) { motorSame++; mAdd.push(Math.abs(mR)); } else motorOpp++; }
    });
  }
  mAdd.sort((a, b) => a - b);
  console.log(`${tag}: over>1 samples ${n} · explicit alone over limit ${explOver} · explicit at limit (>=0.999) ${explAt} · motor pushes same way ${motorSame} (median |motor| ${mAdd[mAdd.length >> 1]?.toFixed(2)} N·m) · motor opposite ${motorOpp}`);
}
