// r23 읽기 지적 1 · 7 — 관문 json 의 AI 길 찌르기(탭 찌르기 · 레이피어 / 장검)와 사람 길 먼 찌르기: 장면마다 손 → 앞발(handFoot) 가운데 · 10 % · 90 % · 맞음 / 쓸 만한 판
//  node ai_tap.mjs <이름>=<gate json> ...   (시뮬레이션 없음)
import { readFileSync } from 'node:fs';
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const f = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');
console.log('| 묶음 | 길 · 무기 · 장면 | handFoot 가운데 (10 % · 90 %) · n | 맞음 / 쓸 만한 판 | 넘어짐 |');
console.log('|---|---|---|---|---|');
for (const a of process.argv.slice(2)) {
  const [name, p] = a.split('=');
  const R = JSON.parse(readFileSync(p, 'utf8')).rows;
  for (const path of ['ai', 'human']) for (const w of ['rapier', 'longsword']) for (const sc of ['far', 'farClose', 'mid', 'near']) {
    const all = R.filter((r) => r.path === path && r.weapon === w && r.scene === sc); if (!all.length) continue;
    const v = all.filter((r) => r.valid); const hf = v.map((r) => r.handFoot);
    console.log(`| ${name} | ${path} · ${w} · ${sc} | ${f(q(hf, 0.5))} (${f(q(hf, 0.1))} · ${f(q(hf, 0.9))}) · ${hf.filter((x) => x != null && Number.isFinite(x)).length} | ${v.filter((r) => r.hit).length} / ${v.length} | ${all.filter((r) => r.fell).length} / ${all.length} |`);
  }
}
