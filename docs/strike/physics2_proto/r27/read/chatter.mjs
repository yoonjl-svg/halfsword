// Sustained period-2 chatter of d_eff/d (new tree): runs where d_eff/d goes up-down-up... with swing > 0.5 every step.
// Usage: node chatter.mjs <probe dir> new4
import { readFileSync } from 'node:fs';
const [dir, tag] = process.argv.slice(2);
const load = (f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
for (const sc of ['stand', 'walk', 'back', 'strafe', 'lunge', 'fight']) {
  const mser = new Map(); let n = 0;
  for (const l of load(`${dir}/${tag}_${sc}.sp.jsonl`)) for (const [nm, J] of Object.entries(l.J)) if (J.mo) J.mo.forEach((m, i) => { n++; const k = `${l.wid}:${l.who}:${nm}:${i}:${l.state}`; (mser.get(k) ?? mser.set(k, []).get(k)).push([l.s, m[1], m[0]]); });
  const runs = [0, 0, 0, 0]; let longest = 0, where = '', kRuns = 0, kLong = 0;
  for (const [k, v] of mser) { v.sort((a, b) => a[0] - b[0]); let r = 0, kr = 0;
    for (let x = 2; x < v.length; x++) {
      const ok = v[x][0] === v[x - 1][0] + 1 && v[x - 1][0] === v[x - 2][0] + 1;
      const a = v[x - 2][1], b = v[x - 1][1], c = v[x][1];
      const flip = ok && Math.abs(b - a) > 0.5 && Math.abs(c - b) > 0.5 && Math.sign(b - a) !== Math.sign(c - b);
      if (flip) { r++; if (r > longest) { longest = r; where = `${k} step ${v[x][0]}`; } } else { if (r >= 1) runs[Math.min(3, r >= 8 ? 3 : r >= 4 ? 2 : r >= 2 ? 1 : 0)]++; r = 0; }
      const kf = ok && v[x - 2][2] !== v[x - 1][2] && v[x - 1][2] !== v[x][2];
      if (kf) { kr++; kLong = Math.max(kLong, kr); } else { if (kr >= 4) kRuns++; kr = 0; }
    } }
  console.log(`${sc}: motor axis-steps ${n} · d_eff/d up-down chatter runs: len1 ${runs[0]} · 2-3 ${runs[1]} · 4-7 ${runs[2]} · >=8 ${runs[3]} · longest ${longest + 2} steps at ${where} · spring-cut chatter runs >=4: ${kRuns} (longest ${kLong + 2})`);
}
