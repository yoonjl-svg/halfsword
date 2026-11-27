// r32 읽기 (시뮬레이션 없음 — wb_gate json 만): 다섯 묶음 모두에서 ① 사람 길 찌르기 줄 가운데 칼끝 가장 빠름 > 8 m/s 로 남은 줄 ② 바탕에서 안 휘둘린 가까운 사람 줄의 맞음(짝 지어 · 부호 검정)
//  node p3_all.mjs <나온 곳($S/r32b)> — 칸 om(오늘 본판) · a(가) · ab(가+나). r28/table.mjs 의 P3 은 둘째 줄 묶음 이름표가 '6001' 로 굳어 있어(실제는 셋째 묶음 = 5001) 여기서 묶음마다 다시 셈.
import { readFileSync } from 'node:fs';
const O = process.argv[2]; const BL = ['4001-4040', '4041-4080', '5001-5040', '6001-6040', '7001-7040'];
const rows = (n, b) => JSON.parse(readFileSync(`${O}/${n}/gate_${b}.json`, 'utf8')).rows.filter((r) => r.path === 'human');
const binom = (b, c) => { const n = b + c; if (!n) return 1; const k = Math.min(b, c); let p = 0, C = 1; for (let i = 0; i <= k; i++) { if (i > 0) C = C * (n - i + 1) / i; p += C; } return Math.min(1, 2 * p / 2 ** n); };
console.log('① 남은 줄 (사람 길 · near / far · 칼끝 가장 빠름 > 8 m/s) — 칸 a · ab 와, 바탕 om 의 장검');
for (const n of ['om', 'a', 'ab']) for (const b of BL) for (const x of rows(n, b).filter((r) => (r.scene === 'near' || r.scene === 'far') && r.tipPk > 8 && (n !== 'om' || r.weapon === 'longsword')))
  console.log(`  ${n} ${b} ${x.scene} ${x.weapon} 씨앗 ${x.seed}: 칼끝 ${x.tipPk.toFixed(2)} m/s @ ${x.tTip.toFixed(3)} s · 맞음 ${x.hit} · 넘어짐 ${x.fell}`);
for (const b of BL) for (const [w, s] of [['rapier', 5008], ['longsword', 5009]]) for (const n of ['om', 'a', 'ab']) for (const x of rows(n, b).filter((r) => r.scene === 'near' && r.weapon === w && r.seed === s && b === '5001-5040'))
  console.log(`  같은 줄 ${w} ${s} · ${n}: 칼끝 ${x.tipPk.toFixed(2)} m/s @ ${x.tTip.toFixed(3)} s · 맞음 ${x.hit}`);
console.log('\n② 가까운 사람 줄의 맞음 — 바탕(om)에서 안 휘둘린 레이피어 줄(칼끝 ≤ 8) · 장검 모든 줄 · 짝 = 무기 · 씨앗 · 줄 차례');
for (const n of ['a', 'ab']) { const tot = { rapier: [0, 0, 0, 0, 0], longsword: [0, 0, 0, 0, 0] }; let wh = [0, 0, 0];
  for (const b of BL) { const o = rows('om', b).filter((r) => r.scene === 'near'), c = rows(n, b).filter((r) => r.scene === 'near');
    for (const w of ['rapier', 'longsword']) { const oo = o.filter((r) => r.weapon === w), cc = c.filter((r) => r.weapon === w); let N = 0, ho = 0, hc = 0, bo = 0, co = 0, odd = oo.length !== cc.length ? ' (줄 수 다름 ' + oo.length + ' · ' + cc.length + ')' : '';
      for (let i = 0; i < Math.min(oo.length, cc.length); i++) { const r = oo[i], x = cc[i]; if (r.seed !== x.seed) { odd = ' (씨앗 어긋남)'; break; } if (w === 'rapier' && r.tipPk > 8) { wh[0]++; wh[1] += r.hit ? 1 : 0; wh[2] += x.hit ? 1 : 0; continue; } N++; ho += r.hit ? 1 : 0; hc += x.hit ? 1 : 0; if (r.hit && !x.hit) bo++; if (!r.hit && x.hit) co++; }
      console.log(`  ${n} ${b} ${w}: 줄 ${N} · 맞음 ${ho} → ${hc} · 바탕만 ${bo} · 칸만 ${co} · 양쪽 p ${binom(bo, co).toFixed(3)}${odd}`); const t = tot[w]; t[0] += N; t[1] += ho; t[2] += hc; t[3] += bo; t[4] += co; } }
  for (const w of ['rapier', 'longsword']) { const t = tot[w]; console.log(`  ${n} 다섯 묶음 합 ${w}: 줄 ${t[0]} · 맞음 ${t[1]} → ${t[2]} · 바탕만 ${t[3]} · 칸만 ${t[4]} · 양쪽 p ${binom(t[3], t[4]).toFixed(3)}`); }
  console.log(`  ${n} 바탕에서 휘둘린 레이피어 줄 ${wh[0]}: 맞음 ${wh[1]} → ${wh[2]}`); }
