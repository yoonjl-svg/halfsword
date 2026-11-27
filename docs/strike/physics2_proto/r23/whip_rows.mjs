// 찌르기 줄에서 '칼끝이 휘둘린' 줄 세기 — 관문 줄(rows)의 칼끝 가장 빠름(tipPk)이 문턱(기본 8 m/s)을 넘는 줄과 그 맞음.
//  부르기: node whip_rows.mjs [--thr=8] <바탕 json…> -- <판 2 json…> -- <판 3 json…>   (같은 씨앗 묶음끼리 · 사람 길은 씨앗 차례로 짝)
import fs from 'node:fs';
let THR = 8; const groups = [[]];
for (const a of process.argv.slice(2)) { const m = a.match(/^--thr=(.+)$/); if (m) THR = +m[1]; else if (a === '--') groups.push([]); else groups.at(-1).push(a); }
const R = groups.map((fl) => fl.flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')).rows));
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—');
console.log(`문턱 ${THR} m/s · 판 = ${groups.map((g, i) => i + 1).join(' · ')}`);
console.log('| 장면 · 길 · 무기 | 판 | valid | 휘둘린 줄 | 그 가운데 맞음 | 휘둘린 줄 칼끝 · 손 가운데 m/s | 나머지 줄 | 그 가운데 맞음 | 나머지 칼끝 · 손 가운데 | 맞은 스텝 가운데 (휘둘린 · 나머지) |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const scene of ['near', 'far']) for (const path of ['human', 'ai']) for (const w of ['rapier', 'longsword']) {
  R.forEach((rows, i) => {
    const v = rows.filter((r) => r.scene === scene && r.path === path && r.weapon === w && r.valid);
    if (!v.length) return;
    const hi = v.filter((r) => r.tipPk > THR), lo = v.filter((r) => !(r.tipPk > THR));
    const st = (a) => f(med(a.filter((r) => r.hit).map((r) => (r.tHit - (r.t0rel || 0)) * 120)), 0);
    console.log(`| ${scene} · ${path} · ${w} | ${i + 1} | ${v.length} | ${hi.length} | ${hi.filter((r) => r.hit).length} | ${f(med(hi.map((r) => r.tipPk)))} · ${f(med(hi.map((r) => r.handPk)))} | ${lo.length} | ${lo.filter((r) => r.hit).length} | ${f(med(lo.map((r) => r.tipPk)))} · ${f(med(lo.map((r) => r.handPk)))} | ${st(hi)} · ${st(lo)} |`);
  });
}
// 사람 길 가까운 찌르기: 바탕에서 휘둘린 줄이 다른 판에서 어떻게 됐나 (씨앗 차례 짝)
for (const w of ['rapier', 'longsword']) {
  const sel = R.map((rows) => rows.filter((r) => r.scene === 'near' && r.path === 'human' && r.weapon === w));
  const b = sel[0]; if (!b.length || sel.some((s) => s.length !== b.length)) continue;
  const wi = b.map((r, k) => (r.tipPk > THR ? k : -1)).filter((k) => k >= 0); const ni = b.map((r, k) => (r.tipPk > THR ? -1 : k)).filter((k) => k >= 0);
  console.log(`near · human · ${w}: 바탕에서 휘둘린 ${wi.length} 줄의 맞음 → ` + sel.map((s, i) => `판 ${i + 1} ${wi.filter((k) => s[k].hit).length}`).join(' · ') + ` | 나머지 ${ni.length} 줄의 맞음 → ` + sel.map((s, i) => `판 ${i + 1} ${ni.filter((k) => s[k].hit).length}`).join(' · '));
}
