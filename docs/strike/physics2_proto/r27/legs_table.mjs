// r27 C5 다리 묶음 표: node legs_table.mjs <옛.json> <새.json> — 장면마다 통과 수 · 합계 · 걷기류 빠르기(speed · 시킨 쪽 along)
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')).solo.longsword);
let ta = 0, tb = 0, na = 0;
const rows = [];
for (const k of Object.keys(a)) { const x = a[k], y = b[k] ?? {}; ta += x.ok; tb += y.ok ?? 0; na += x.n; rows.push(`${k} ${x.ok}/${x.n} → ${y.ok}/${y.n}` + (x.ok !== y.ok ? ' *' : '')); }
console.log(`다리 묶음 (기본 ${Object.keys(a).length} 장면 · 롱소드 · n 8): 합계 ${ta}/${na} → ${tb}/${na}`);
console.log('  ' + rows.join(' · '));
for (const k of ['walk', 'back', 'strafeL', 'strafeR', 'strafe', 'slowwalk', 'slowback']) if (a[k]) console.log(`  빠르기 ${k}: speed ${a[k].speed} → ${b[k]?.speed} · 시킨 쪽 ${a[k].along} → ${b[k]?.along} m/s`);
