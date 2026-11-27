// 가까운 찌르기(사람 길) 맞음이 왜 줄었나 — 관문 줄(rows)을 씨앗 짝으로 봄. 부르기: node near_why.mjs <바탕 json…> -- <첫 고침 json…> -- <읽기 뒤 json…>
import fs from 'node:fs';
const groups = [[]];
for (const a of process.argv.slice(2)) a === '--' ? groups.push([]) : groups.at(-1).push(a);
const names = ['바탕', '첫 고침', '읽기 뒤'];
const med = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : '—');
const load = (fl) => fl.flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')).rows);
const R = groups.map(load);
for (const scene of ['near', 'far']) for (const path of ['human', 'ai']) for (const w of ['rapier', 'longsword']) {
  const sel = R.map((rows) => rows.filter((r) => r.scene === scene && r.path === path && r.weapon === w));
  if (!sel[0].length) continue;
  console.log(`\n## ${scene} · ${path} · ${w}`);
  console.log('| 판 | 줄 | valid | 맞음 | 맞음/valid | gap 가운데 | 탭→맞음 | 손 가장 빠름 | 칼끝 가장 빠름 | 골반 간 거리 | 골반 가장 빠름 | closing | 넘어짐 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  sel.forEach((rows, i) => {
    const v = rows.filter((r) => r.valid);
    const h = v.filter((r) => r.hit);
    console.log(`| ${names[i]} | ${rows.length} | ${v.length} | ${h.length} | ${f(h.length / v.length, 2)} | ${f(med(v.map((r) => r.gap)))} | ${f(med(h.map((r) => r.tHit - (r.t0rel || 0))))} | ${f(med(v.map((r) => r.handPk)), 2)} | ${f(med(v.map((r) => r.tipPk)), 2)} | ${f(med(v.map((r) => r.pelTravel)))} | ${f(med(v.map((r) => r.pelPk)), 2)} | ${f(med(v.map((r) => r.closing)))} | ${rows.filter((r) => r.fell).length} |`);
  });
  if (path !== 'human') continue;
  // 씨앗 짝(사람 길은 씨앗마다 한 줄씩이라 차례로 짝): 바탕에서 맞고 읽기 뒤에 안 맞은 줄
  const key = (r, k) => `${r.seed}:${k}`;
  const idx = (rows) => { const m = new Map(); const c = {}; for (const r of rows) { c[r.seed] = (c[r.seed] || 0) + 1; m.set(key(r, c[r.seed]), r); } return m; };
  const A = idx(sel[0]); const C = idx(sel[2] || []);
  const lost = []; const kept = []; const gained = [];
  for (const [k, a] of A) { const c = C.get(k); if (!c || !a.valid || !c.valid) continue; if (a.hit && !c.hit) lost.push([a, c]); else if (a.hit && c.hit) kept.push([a, c]); else if (!a.hit && c.hit) gained.push([a, c]); }
  const line = (nm, P) => console.log(`  ${nm} ${P.length} 줄 — gap ${f(med(P.map((p) => p[0].gap)))} → ${f(med(P.map((p) => p[1].gap)))} · 손 ${f(med(P.map((p) => p[0].handPk)), 2)} → ${f(med(P.map((p) => p[1].handPk)), 2)} · 칼끝 ${f(med(P.map((p) => p[0].tipPk)), 2)} → ${f(med(P.map((p) => p[1].tipPk)), 2)} · 골반 간 ${f(med(P.map((p) => p[0].pelTravel)))} → ${f(med(P.map((p) => p[1].pelTravel)))} · 골반 빠름 ${f(med(P.map((p) => p[0].pelPk)), 2)} → ${f(med(P.map((p) => p[1].pelPk)), 2)} · tEnd ${f(med(P.map((p) => p[0].tEnd)))} → ${f(med(P.map((p) => p[1].tEnd)))} · 바탕 탭→맞음 ${f(med(P.map((p) => p[0].tHit - (p[0].t0rel || 0))))}`);
  line('바탕 맞음 → 읽기 뒤 안 맞음', lost); line('둘 다 맞음', kept); line('바탕 안 맞음 → 읽기 뒤 맞음', gained);
  // gap 띠마다 맞음 비율
  const bands = [[0, 1.5], [1.5, 1.7], [1.7, 1.9], [1.9, 9]];
  for (const [lo, hi] of bands) console.log(`  gap ${lo} ~ ${hi} m: ` + sel.map((rows, i) => { const v = rows.filter((r) => r.valid && r.gap >= lo && r.gap < hi); return `${names[i]} ${v.filter((r) => r.hit).length}/${v.length}`; }).join(' · '));
}
