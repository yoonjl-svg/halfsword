// r29 재는 사본: 칸 ll_13_125 를 베껴 ll_13_125_cnt 를 만들고 그 legs_vmc.js 에만 세는 줄을 넣는다 (커밋하는 src 에는 없음).
//  셈: 일곱 자르기 부름마다 (디딘 다리 = legTorques 의 ankleOn 참 · 내딛는 다리 = 거짓) × 축 일곱으로
//   [부름 수 · wE > 0 · wE ≥ eccW(배율 다 참) · 잘림(한도에 닿음) · 잘림이며 wE > 0 · 잘림이며 wE ≥ eccW]   wE = 잘리는 토크 쪽의 늘어나는 빠르기(토크 ≥ 0 이면 w · 아니면 −w)
//  globalThis.__llCnt 에 쌓고, cnt_dump.mjs(--import)가 끝날 때 json 으로 적는다.
//  쓰는 법: S=<scratch> node mk_cnt.mjs [바탕 칸=ll_13_125]
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const S = process.env.S; if (!S) throw new Error('S=<scratch>');
const src = process.argv[2] ?? 'll_13_125', C = join(S, 'p2/r6/mx/cells'), D = join(C, src + '_cnt');
if (existsSync(D)) execFileSync('rm', ['-rf', D]);
execFileSync('cp', ['-a', join(C, src), D]);
const f = join(D, 'src/legs_vmc.js');
let s = readFileSync(f, 'utf8');
const once = (a, b) => { const n = s.split(a).length - 1; if (n !== 1) throw new Error(`'${a.slice(0, 50)}' ${n} 번`); s = s.replace(a, b); };
once('const clampLeg = (t, w, lo, hi, str) => clamp(t, -legLimit(lo, str, -w), legLimit(hi, str, w));',
`const clampLeg = (t, w, lo, hi, str) => clamp(t, -legLimit(lo, str, -w), legLimit(hi, str, w));
const _CN = (globalThis.__llCnt ??= { ph: 0, a: new Float64Array(2 * 7 * 6) });
function clampLegC(id, t, w, lo, hi, str) {
  const r = clampLeg(t, w, lo, hi, str), wE = t >= 0 ? w : -w, a = _CN.a, o = (_CN.ph * 7 + id) * 6, sat = r !== t;
  a[o]++; if (wE > 0) a[o + 1]++; if (wE >= LEGS.eccW) a[o + 2]++;
  if (sat) { a[o + 3]++; if (wE > 0) a[o + 4]++; if (wE >= LEGS.eccW) a[o + 5]++; }
  return r;
}`);
once('    const lim = LEGS.limit;\n', '    const lim = LEGS.limit;\n    _CN.ph = ankleOn ? 0 : 1;\n');
const calls = [['_b.x, L.wH.x', 0], ['_b.y, L.wH.y', 1], ['_b.z, L.wH.z', 2], ['s0, L.wK', 3], ['_b.x, L.wA.x', 4], ['_b.y, L.wA.y', 5], ['_b.z, L.wA.z', 6]];
for (const [k, id] of calls) once(`clampLeg(${k},`, `clampLegC(${id}, ${k},`);
writeFileSync(f, s);
console.log(`${D}: 세는 자르기 ${calls.length} 곳 · ${execFileSync('grep', ['-c', 'clampLegC(', f], { encoding: 'utf8' }).trim()} 줄`);
