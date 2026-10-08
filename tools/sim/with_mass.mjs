// 무기 부품 질량 변형 감싸기(겉모습 그대로, 질량·관성만): node tools/sim/with_mass.mjs [--weapon=morgenstern] --parts=0.54,0.072,1.71 <tools/sim 스크립트> [인자…]
//  --parts 는 buildParts 부품 차례대로의 질량(kg), 비우면 그대로(예: --parts=,,1.5 는 셋째 부품만). 관성은 같은 비율로. 10/8 모르겐슈테른 무게 −10 % 결정에 쓴 표: docs/decisions.md 10/8 14:30
import { WEAPONS } from '../../src/weapons.js';
import path from 'node:path';
const args = process.argv.slice(2); const opt = {};
while (args.length && args[0].startsWith('--')) { const [k, v] = args.shift().slice(2).split('='); opt[k] = v; }
const spec = WEAPONS[opt.weapon ?? 'morgenstern']; if (!spec) throw new Error('무기 없음: ' + opt.weapon); const orig = spec.buildParts.bind(spec);
const want = String(opt.parts ?? '').split(',').map((x) => (x === '' ? undefined : +x)); // 부품 차례대로의 질량(kg); 빈 칸은 그대로
spec.buildParts = (look) => { const parts = orig(look); parts.forEach((p, i) => { const m0 = p[2][0], m1 = want[i] ?? m0, f = m1 / m0; p[2][0] = m1; p[2][2] *= f; p[2][3] *= f; }); return parts; };
{ const parts = spec.buildParts({}); const tot = parts.reduce((s, p) => s + p[2][0], 0); const com = parts.reduce((s, p) => s + p[2][0] * p[1], 0) / tot; const I = parts.reduce((s, p) => s + p[2][0] * p[1] * p[1] + p[2][2], 0); console.log(`질량 변형(${opt.weapon ?? 'morgenstern'}): 부품 ${parts.map((p) => p[2][0].toFixed(3)).join(' · ')} kg → 전체 ${tot.toFixed(2)} kg, 무게중심(손 기준) ${com.toFixed(3)} m, 손 기준 관성 ≈ ${I.toFixed(3)} kg·m²`); }
const [script, ...rest] = args; const abs = path.resolve(path.dirname(new URL(import.meta.url).pathname), script);
process.argv = [process.argv[0], abs, ...rest];
await import(abs);
