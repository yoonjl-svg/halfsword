// r27 C2 진단: 나머지 스텝(cc 아님)에서 전달 ÷ 한도 > 1 인 믿을 표본이 어떤 것인지 — 넘친 정도 · 구동 몫(명시 ÷ 한도) · 그 관절 모터 축의 여유 · 실제 모터.
//  node over_look.mjs <probe 폴더> <이름> [장면...]
import { readFileSync, existsSync } from 'node:fs';
const [dir, tag, ...sc0] = process.argv.slice(2);
const SC = sc0.length ? sc0 : ['fight', 'lunge', 'walk', 'back', 'strafe', 'stand'];
const q = (a, p) => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const over = [], eSh = [], zeroRoom = { y: 0, n: 0 }, bins = { '1.00-1.02': 0, '1.02-1.05': 0, '1.05-1.10': 0, '1.10-1.25': 0, '>1.25': 0 };
let n = 0, sat = 0, satOver = 0; const satR = [];
for (const s of SC) { const f = `${dir}/${tag}_${s}.ab.jsonl`; if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse)) {
    if ((l.state ?? 'stand') !== 'stand' || !l.reg || l.cc) continue;
    l.J.forEach((j, ji) => {
      const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
      if (!good) return;
      for (const [an, a] of Object.entries(j.ax)) {
        n++;
        const r = a[5];
        if (Math.abs(a[4]) / a[10] >= 0.999) { sat++; satR.push(r); if (r > 1) satOver++; } if (!(r > 1)) continue;
        over.push(r); const es = Math.abs(a[4]) / a[10]; eSh.push(es);
        const b = r > 1.25 ? '>1.25' : r > 1.1 ? '1.10-1.25' : r > 1.05 ? '1.05-1.10' : r > 1.02 ? '1.02-1.05' : '1.00-1.02'; bins[b]++;
        if (j.mo) { zeroRoom.n++; if (j.mo.some((m) => (m[0] >= 0 ? m[1] : m[2]) < 1e-6)) zeroRoom.y++; }
      }
    });
  } }
console.log(`${tag} 나머지 스텝 축 표본 ${n} · > 1 ${over.length} (${(100 * over.length / n).toFixed(2)}%) · 넘친 정도 나눔: ` + Object.entries(bins).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(`  > 1 표본의 구동 몫(|명시| ÷ 한도) 가운데 ${q(eSh, 0.5).toFixed(3)} · 10 % ${q(eSh, 0.1).toFixed(3)} · 90 % ${q(eSh, 0.9).toFixed(3)} · 구동 몫 ≥ 0.99 인 것 ${eSh.filter((x) => x >= 0.99).length}` + (zeroRoom.n ? ` · 그 관절에 여유 0 인 모터 축이 있던 것 ${zeroRoom.y} / ${zeroRoom.n}` : ''));
console.log(`  구동이 한도에 닿은(|명시| ÷ 한도 ≥ 0.999) 표본 ${sat} · 그 가운데 > 1 ${satOver} (${(100 * satOver / Math.max(1, sat)).toFixed(1)}%) · 전달 ÷ 한도 10 % ${q(satR, 0.1).toFixed(3)} 가운데 ${q(satR, 0.5).toFixed(3)} 90 % ${q(satR, 0.9).toFixed(3)}`);
