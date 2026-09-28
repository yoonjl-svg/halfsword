// 무기 유형표 (docs/weapon_types.md): 무기마다 몸 틀 × 싸움 방식과, 판정에 쓴 질량 분포를 찍는다.
//   node tools/sim/weapon_classes.mjs
import { WEAPON_LIST } from '../../src/weapons.js';
import { weaponPhysics, FRAME_KO, STYLE_KO } from '../../src/weapon_class.js';

console.log('| 무기 | 등급 | 몸 틀 | 싸움 방식 | 길이 m | 질량 kg | 무게중심 m | 관성 kg·m² |');
console.log('|---|---|---|---|---|---|---|---|');
for (const w of WEAPON_LIST) {
  const p = weaponPhysics(w);
  console.log(`| ${w.nameKo.split(' (')[0]}${w.id === 'excalibur_replica' ? ' (복제품)' : ''} | ${w.tier} | ${FRAME_KO[w.frame]} | ${STYLE_KO[w.style]} | ${p.length.toFixed(2)} | ${p.mass.toFixed(2)} | ${p.com.toFixed(2)} | ${p.I.toFixed(3)} |`);
}
