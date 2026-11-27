// kcheck.mjs 나옴 요약: 축마다 (디딤 S / 뜸 W) 모델 K_ii ÷ 엔진 참값 K_ii 의 가운데값 · p10 · p90 , 모델 < 참값 몫 (흔들림 위험).  node kc_sum.mjs <kc.jsonl>...
import fs from 'fs';
const q = (v, p) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const g = {};
for (const f of process.argv.slice(2)) for (const l of fs.readFileSync(f, 'utf8').trim().split('\n')) {
  if (!l) continue;
  const r = JSON.parse(l);
  r.J.forEach((a, i) => { const t = r.Kt[i][i], m = r.K[i][i]; if (!(t > 1e-6)) return; const k = `${a[2] ? 'S' : 'W'} ${a[0].slice(0, -1)} ${'xyz'[a[1]]}`; (g[k] ||= []).push(m / t); });
}
console.log('축          n     모델/참값 p10   p50   p90   모델<참값 몫');
for (const [k, v] of Object.entries(g).sort()) console.log(k.padEnd(12), String(v.length).padStart(4), q(v, 0.1).toFixed(2).padStart(12), q(v, 0.5).toFixed(2).padStart(6), q(v, 0.9).toFixed(2).padStart(6), (v.filter((x) => x < 1).length / v.length).toFixed(2).padStart(10));
