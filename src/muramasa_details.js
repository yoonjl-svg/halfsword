// 무라마사 — 10/21 승인 시안. 적갈색 감개·검은 각형 츠바·불규칙한 하몬 (샛별 저장소 29e543555 · d46e09b96 · 82818cc3d 에서 들여옴).
// 이 외장은 도공 개인의 고유 장식 복원이 아닌 게임용 코시라에다. 질량 · 콜라이더는 weapons.js 가 정한다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { swordKit, metalMat } from './weapon_looks.js';

export const MURAMASA_COLORS = { grip: 0x28272a, hilt: 0x28272b, blade: 0xaeb5bd };
// 사장님 확정: 날 길이는 등 밑동~칼끝의 직선, 소리(휨)는 그 직선~등의 최대 수직 거리.
//  10/21 23:3x 날 0.70 → 0.68 m(휨 2 cm 그대로) · 23:4x 총 1.12 → 1.05 kg (덜어 낸 몫은 칼날 — weapons.js muramasa)
//  10/25 손맛 개편(가볍고 빠르게 — 날 길이 · 휨 그대로): 총 1.05 → 0.85 kg · 손 쪽 부품 질량 parts(츠카 · 카시라 · 츠바 + 하바키 kg) · 칼날 = 나머지 0.43 kg ·
//   칼날 그림도 얇고 좁게(두께 3.5 → 3 mm · 반폭 15 → 13.5 mm) — 사장님 10/25 23:2x '무라마사는 길이 그대로, 무게만 가볍게 해' (부품 나눔 · 그림 두께는 사장님 확인 전)
//  10/27 21:1x 사장님 '맞을 때 칼 힘이 너무 약한데? 좀만 더 무겁게 · 휘두름 관성 0.09 ~ 0.095 · 칼 힘 10 ~ 20 % 크게': 총 0.85 → 0.92 kg — 더한 70 g 은 칼날(0.43 → 0.50 kg) · 손 쪽 그대로
export const MURAMASA_PROFILE = { length: .68, sori: .020, mass: .92, parts: { grip: .23, kashira: .06, tsuba: .13 }, colliderHalfWidth: .024, drawHalfWidth: .0135 };
const kit = swordKit({
  blade: { edge: 'single', width: t => 1-.28*t, thick: .003, ridge: .3,
    hamon: true, hamonWave: (_t,y) => .31+.105*Math.sin(y*51)+.045*Math.sin(y*123+.8)+.023*Math.sin(y*89),
    curve: 0, tip: 'kissaki', tipLen: .05, overshoot: 0, segs: 52 },
  grip: { style: 'plain', color: MURAMASA_COLORS.grip },
  pommel: { style: 'cap', color: MURAMASA_COLORS.hilt },
});
function add(g,geo,mat,pos=[0,0,0]){const m=new THREE.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;g.add(m);return m;}
function tsuba() {
  const g=new THREE.Group(),shape=new THREE.Shape(),x=.039,z=.031,r=.010;
  shape.moveTo(-x+r,-z);shape.lineTo(x-r,-z);shape.quadraticCurveTo(x,-z,x,-z+r);
  shape.lineTo(x,z-r);shape.quadraticCurveTo(x,z,x-r,z);shape.lineTo(-x+r,z);
  shape.quadraticCurveTo(-x,z,-x,z-r);shape.lineTo(-x,-z+r);shape.quadraticCurveTo(-x,-z,-x+r,-z);
  const hole=new THREE.Path();hole.absellipse(0,0,.013,.0045,0,Math.PI*2,true);shape.holes.push(hole);
  const geo=new THREE.ExtrudeGeometry(shape,{depth:.007,bevelEnabled:true,bevelThickness:.001,bevelSize:.001,bevelSegments:1,curveSegments:4});
  geo.rotateX(Math.PI/2);geo.translate(0,.0035,0);
  add(g,geo,metalMat(0x28272b,{rough:.46,metal:.72}));
  return g;
}
export function muramasaPartMesh(...args){
  if(args[0]===2&&!args[1])return tsuba();
  // 칼날 그림은 drawHalfWidth(10/25 13.5 mm — 전 우치가타나 칼날 반폭 15 mm)로 그린다 — 콜라이더 상자만 휨을 덮으려고 넓혔다(weapons.js colliderHalfWidth).
  if(args[1])args[2]=[...args[2].slice(0,1),MURAMASA_PROFILE.drawHalfWidth,...args[2].slice(2)];
  const m=kit(...args);
  if(args[1]){
    // 이 칼날만 휜다. 단면 · 하몬은 그대로 두고, 휨은 칼끝 어긋남 설정이나 가운데 줄이 아니라
    //  실제 칼등에서 잰다. 길이는 콜라이더 상자(shape)에서 읽으므로 날 길이를 따라간다.
    const [,hx,hy]=args[2],L=hy*2,dx=.3*hx,spanY=Math.sqrt(L*L-dx*dx);
    const tTip=1-.05/L,apex=-.7*hx,p=m.geometry.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=Math.max(0,Math.min(1,(p.getY(i)+hy)/L));
      const rawBack=-hx*(1-.28*Math.min(t,tTip));
      const s=Math.max(0,(t-tTip)/(1-tTip));
      const back=rawBack+(apex-rawBack)*s*s*s;
      const target=-hx+dx*t+4*MURAMASA_PROFILE.sori*L/spanY*t*(1-t);
      // 공용 하몬 이음매가 모인 칼끝 밖으로 0.5 mm 튀어나온다. 여기서 닫아
      //  이음매까지 포함한 실제 칼끝 · 칼등이 치수를 따르게 한다.
      const x=t>1-1e-7?target:Math.max(back,p.getX(i))+target-back;
      p.setXYZ(i,x,-hy+t*spanY,t>1-1e-7?0:p.getZ(i));
    }
    p.needsUpdate=true;m.geometry.computeVertexNormals();
    m.geometry.computeBoundingBox();m.geometry.computeBoundingSphere();
    // 양면의 하몬 경계가 같다 — 무라마사에 흔한 특징.
    //  담금질 띠만 조금 더 희게 하고, 칼몸은 붉은 빛이 아니라 강철 그대로 둔다.
    const colors=m.geometry.attributes.color;
    for(let i=0;i<colors.count;i++)if(colors.getX(i)>1.29)colors.setXYZ(i,1.43,1.45,1.48);
    colors.needsUpdate=true;
  }
  return m;
}
export function muramasaDecorate(group){
  const bronze=metalMat(0x9b7c51,{rough:.38}),iron=metalMat(0x2b292c,{rough:.45});
  add(group,new THREE.BoxGeometry(.034,.030,.011),bronze,[0,this.hiltLength+.012,0]);
  const fuchi=add(group,new THREE.CylinderGeometry(.0148,.0148,.008,14),iron,[0,.061,0]);fuchi.scale.z=1.2;
  for(const y of[.056,-.232]){const band=add(group,new THREE.CylinderGeometry(.015,.015,.0028,14),bronze,[0,y,0]);band.scale.z=1.2;}
  const cloth=new THREE.MeshStandardMaterial({color:0x793c37,roughness:.88,metalness:0});
  const geos=[],start=-.225,end=.045,pitch=.033;
  // 납작한 나선 띠 둘이 타원 츠카에 붙어 감긴다 (곧은 상자로 감으면 옆에서 떠 보였다).
  for(const direction of [-1,1]){
    const verts=[],N=144,rings=[];
    for(let i=0;i<=N;i++){
      const y=start+(end-start)*i/N,a=direction*(y-start)/pitch*Math.PI*2+(direction===-1?Math.PI:0);
      const relief=direction===1?.00055:0;
      rings.push([[-1,0],[1,0],[1,1],[-1,1]].map(([side,out])=>[
        Math.cos(a)*(.0141+relief+out*.0008),
        Math.max(start,Math.min(end,y+side*.0055)),
        Math.sin(a)*(.0175+relief+out*.0008)]));
    }
    const tri=(a,b,c)=>direction===1?verts.push(...a,...b,...c):verts.push(...a,...c,...b);
    for(let i=1;i<rings.length;i++)for(let j=0;j<4;j++){
      const a=rings[i-1][j],b=rings[i][j],c=rings[i][(j+1)%4],d=rings[i-1][(j+1)%4];tri(a,b,c);tri(a,c,d);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();geos.push(geo);
  }
  add(group,mergeGeometries(geos),cloth);for(const geo of geos)geo.dispose();
}
