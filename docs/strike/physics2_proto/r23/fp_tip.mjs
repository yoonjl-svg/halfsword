// 지문 장면(가까운 찌르기)의 칼끝 길을 스텝마다 찍음 — fp_compare.mjs 가 적은 json 들. 부르기: node fp_tip.mjs <장면 이름> <json…>
import fs from 'node:fs';
const [scene, ...files] = process.argv.slice(2);
const S = files.map((p) => JSON.parse(fs.readFileSync(p, 'utf8')).scenes[scene]);
const sp = (r) => Math.hypot(r[3], r[4], r[5]);
console.log('맞음 스텝:', S.map((s) => JSON.stringify(s.hits)).join(' · '));
console.log('스텝 | ' + files.map((_, i) => `판 ${i + 1}: 칼끝 x y z m · 빠르기 m/s · 앞발 뒷발 닿음`).join(' | '));
for (let i = 0; i < 60; i += 2) console.log(String(i).padStart(3) + ' | ' + S.map((s) => { const r = s.rows[i]; return `${r[0].toFixed(2)} ${r[1].toFixed(2)} ${r[2].toFixed(2)} · ${sp(r).toFixed(1).padStart(5)} · ${r[9]}${r[10]}`; }).join(' | '));
console.log('칼끝 가장 빠름:', S.map((s) => { let m = 0, k = 0; s.rows.forEach((r, i) => { if (sp(r) > m) { m = sp(r); k = i; } }); return `${m.toFixed(1)} m/s @ 스텝 ${k}`; }).join(' · '));
console.log('칼끝 옆으로 가장 멀리 (z 폭):', S.map((s) => { const z = s.rows.slice(0, 60).map((r) => r[2]); return (Math.max(...z) - Math.min(...z)).toFixed(2) + ' m'; }).join(' · '));
