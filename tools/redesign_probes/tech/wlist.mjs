// 무기 목록 요약. 실행: node tools/redesign_probes/tech/wlist.mjs  (SNAP=<다른 체크아웃 경로> 로 바꿀 수 있다)
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const SNAP = process.env.SNAP ? pathToFileURL(resolve(process.env.SNAP) + '/') : new URL('../../../', import.meta.url); // 저장소 루트
const W = await import(new URL('src/weapons.js', SNAP));
const list = W.WEAPONS || W.default || Object.values(W).find((x) => Array.isArray(x));
const ids = Object.keys(W).join(',');
console.log('exports', ids);
const arr = Array.isArray(list) ? list : Object.values(list);
for (const s of arr) {
  const parts = s.buildParts?.({}) || [];
  const m = parts.reduce((a, p) => a + p[2][0], 0);
  const blade = parts.find((p) => p[4]);
  console.log(String(s.id).padEnd(14), s.tier?.padEnd?.(8), 'L', s.bladeLength, 'HL', s.hiltLength, 'mass', m.toFixed(2), 'blade', JSON.stringify(blade?.[0]), 'fragile', s.fragile, 'frag', s.fragility, 'power', s.power, 'mat', s.material, 'ignoreArmor', !!s.ignoreArmor);
}
