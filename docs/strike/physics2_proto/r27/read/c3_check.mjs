// Independent C3 recompute: joint-speed sign flips / strict alternations per 1000 axis-steps (stand+walk+lunge),
// plus (new tree) step-to-step jitter of the motor cut: d_eff/d and spring-cut alternations.
// Usage: node c3_check.mjs <probe dir> old new4
import { readFileSync } from 'node:fs';
const [dir, ...tags] = process.argv.slice(2);
const load = (f) => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
for (const tag of tags) {
  let pairs = 0, flips = 0, trip = 0, alt = 0;
  let mPairs = 0, dTog = 0, dTrip = 0, dAlt = 0, dAltBig = 0, kTog = 0, kAlt = 0, cutSteps = 0;
  const perScene = {};
  for (const sc of ['stand', 'walk', 'lunge', 'back', 'strafe', 'fight']) {
    const ser = new Map(), mser = new Map();
    for (const l of load(`${dir}/${tag}_${sc}.sp.jsonl`)) for (const [n, J] of Object.entries(l.J)) {
      J.w.forEach((w, i) => { const k = `${l.wid}:${l.who}:${n}:${i}`; (ser.get(k) ?? ser.set(k, []).get(k)).push([l.s, w]); });
      if (J.mo) J.mo.forEach((m, i) => { const k = `${l.wid}:${l.who}:${n}:${i}`; (mser.get(k) ?? mser.set(k, []).get(k)).push([l.s, m[0], m[1]]); });
    }
    let sp = 0, sf = 0, sa = 0, st = 0;
    for (const v of ser.values()) { v.sort((a, b) => a[0] - b[0]);
      for (let x = 1; x < v.length; x++) { if (v[x][0] !== v[x - 1][0] + 1) continue; sp++;
        const a = v[x - 1][1], b = v[x][1]; if (Math.abs(a) > 0.5 && Math.abs(b) > 0.5 && Math.sign(a) !== Math.sign(b)) sf++;
        if (x >= 2 && v[x - 1][0] === v[x - 2][0] + 1) { st++; const c = v[x - 2][1]; if (Math.abs(a) > 0.5 && Math.abs(b) > 0.5 && Math.abs(c) > 0.5 && Math.sign(c) !== Math.sign(a) && Math.sign(a) !== Math.sign(b)) sa++; } } }
    perScene[sc] = `${(1000 * sf / sp).toFixed(2)}‰ flips · ${(1000 * sa / st).toFixed(2)}‰ alt (pairs ${sp})`;
    if (['stand', 'walk', 'lunge'].includes(sc)) { pairs += sp; flips += sf; trip += st; alt += sa; }
    for (const v of mser.values()) { v.sort((a, b) => a[0] - b[0]);
      for (let x = 0; x < v.length; x++) { if (v[x][2] < 1) cutSteps++;
        if (x < 1 || v[x][0] !== v[x - 1][0] + 1) continue; mPairs++;
        if ((v[x][2] < 1) !== (v[x - 1][2] < 1)) dTog++;
        if (v[x][1] !== v[x - 1][1]) kTog++;
        if (x >= 2 && v[x - 1][0] === v[x - 2][0] + 1) { dTrip++;
          const [c, a, b] = [v[x - 2][2], v[x - 1][2], v[x][2]];
          if ((c < 1) !== (a < 1) && (a < 1) !== (b < 1)) dAlt++;              // cut / not / cut (or reverse)
          if (Math.abs(a - c) > 0.5 && Math.abs(b - a) > 0.5 && Math.sign(a - c) !== Math.sign(b - a)) dAltBig++; // d_eff/d swings > 0.5 up-down-up
          const [kc, ka, kb] = [v[x - 2][1], v[x - 1][1], v[x][1]]; if (kc !== ka && ka !== kb) kAlt++; } } }
  }
  console.log(`== ${tag}: stand+walk+lunge flips ${flips}/${pairs} = ${(1000 * flips / pairs).toFixed(2)}‰ · strict alternations ${alt}/${trip} = ${(1000 * alt / trip).toFixed(2)}‰`);
  for (const [sc, s] of Object.entries(perScene)) console.log(`   ${sc}: ${s}`);
  if (mPairs) console.log(`   motor axis-steps (all scenes) pairs ${mPairs} · damping-cut steps ${cutSteps} · damping cut on/off toggles ${(1000 * dTog / mPairs).toFixed(2)}‰ · cut/not/cut alternations ${(1000 * dAlt / dTrip).toFixed(2)}‰ (${dAlt}) · d_eff/d swing >0.5 up-down-up ${(1000 * dAltBig / dTrip).toFixed(2)}‰ (${dAltBig}) · spring-cut toggles ${(1000 * kTog / mPairs).toFixed(2)}‰ · spring cut/not/cut ${(1000 * kAlt / dTrip).toFixed(2)}‰ (${kAlt})`);
}
