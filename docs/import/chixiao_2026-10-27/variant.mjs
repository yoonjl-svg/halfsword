// 비교 도구만: 제품 URL·기본값에 시험 스위치를 넣지 않는다.
import fs from 'node:fs';
import { WEAPONS } from '../../../src/weapons.js';
const w=WEAPONS.chixiao, mode=process.env.CHIXIAO_CASE||'final';
if(mode==='legacy'){
 const p=JSON.parse(fs.readFileSync(new URL('./before/specs.json',import.meta.url))).weapons.chixiao.parts;
 w.buildParts=()=>structuredClone(p);w.partCollider=undefined;
}else if(mode==='box')w.partCollider=undefined;
else if(mode==='forward'){
 const build=w.buildParts.bind(w),mass=[.08,.06,.06,1.10];
 w.buildParts=()=>build().map((p,i)=>{const q=structuredClone(p),scale=mass[i]/q[2][0];q[2][0]*=scale;q[2][2]*=scale;q[2][3]*=scale;return q;});
}
