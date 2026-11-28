// 두 json 을 견줌: 다른 잎의 경로를 적음 (swordSplit 칸은 따로 셈)
import fs from 'fs';
const [a, b] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
const out = [];
const walk = (x, y, p) => {
  if (x && y && typeof x === 'object' && typeof y === 'object') { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], p + '.' + k); return; }
  if (JSON.stringify(x) !== JSON.stringify(y)) out.push(p);
};
walk(a, b, '');
const ss = out.filter((p) => /swordSplit/.test(p)), rest = out.filter((p) => !/swordSplit/.test(p));
console.log(`다른 잎 ${out.length} (swordSplit ${ss.length} · 나머지 ${rest.length})${rest.length ? ' : ' + rest.slice(0, 10).join(' ') : ''}`);
