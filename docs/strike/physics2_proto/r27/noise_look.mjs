// r27 C2 진단: 나머지 스텝의 > 1 표본에서 넘친 크기(|전달| − 한도, N·m)를 그 표본의 A/B 풀이 오차 띠와 견줌.
//  오차 띠 = 그 관절의 알려진 답 검산 오차 val.ej (A0 몫) × A0 (발목 6 · 그 밖 30 N·m — probe 의 검산 토크 크기). 띠 밖으로 넘친 표본만 '틀림없이 넘침'.
//  node noise_look.mjs <probe 폴더> <이름>...
import { readFileSync, existsSync } from 'node:fs';
const [dir, ...tags] = process.argv.slice(2);
const SC = ['fight', 'lunge', 'walk', 'back', 'strafe', 'stand'];
for (const tag of tags) {
  let n = 0, over = 0, sure = 0, sureG = {}, overG = {};
  const exc = [], band = [];
  for (const sc of SC) { const f = `${dir}/${tag}_${sc}.ab.jsonl`; if (!existsSync(f)) continue;
    for (const l of readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse)) {
      if ((l.state ?? 'stand') !== 'stand' || !l.reg || l.cc) continue;
      l.J.forEach((j, ji) => {
        const good = !(l.val && l.val.ej && l.val.ej[ji] > 0.05) && ((l.per?.[ji]?.[0] ?? 0) <= 0.5 || (l.per?.[ji]?.[3] ?? 0) <= 0.02);
        if (!good) return;
        const A0 = j.n.startsWith('foot') ? 6 : 30, eb = (l.val?.ej?.[ji] ?? 0) * A0;
        for (const [an, a] of Object.entries(j.ax)) {
          n++; if (!(a[5] > 1)) continue;
          const g = `${j.n.replace(/[FB]$/, '')}.${an}.${j.st ? 'S' : 'W'}`;
          over++; overG[g] = (overG[g] ?? 0) + 1;
          const x = Math.abs(a[9]) - a[10]; exc.push(x); band.push(eb);
          if (x > eb) { sure++; sureG[g] = (sureG[g] ?? 0) + 1; }
        }
      });
    } }
  const q = (a, p) => { const s = Float64Array.from(a).sort(); return s.length ? s[Math.floor(p * (s.length - 1))] : NaN; };
  console.log(`${tag}: 나머지 스텝 축 표본 ${n} · > 1 ${over} (${(100 * over / n).toFixed(2)}%) · 오차 띠 밖으로 넘침 ${sure} (${(100 * sure / n).toFixed(3)}%) · 넘친 크기 가운데 ${q(exc, 0.5).toFixed(2)} N·m · 오차 띠 가운데 ${q(band, 0.5).toFixed(2)} N·m`);
  console.log('   무리별 > 1 / 띠 밖: ' + Object.entries(overG).sort((a, b) => b[1] - a[1]).map(([g, c]) => `${g} ${c}/${sureG[g] ?? 0}`).join(' · '));
}
