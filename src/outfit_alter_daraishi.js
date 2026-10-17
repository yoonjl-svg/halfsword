// 광기의 다라이시 — 흑의 · 붉은 머리끈 (샛별 저장소에서 가져옴 10/17 — 사장님 10/16 승인, 샛별 쪽 · docs/import/saetbyeol_round3_2026-10-17.md).
//  겉모습만: 방어구 · 제약 · 질량 · 전투 규칙 없음
import * as T from 'three';

export const DARAISHI_RIBBON_RED=0xa04a4b; // 머리끈 · 허리 장식이 같은 붉은색 (사장님 10/16 '허리 청록 장식을 붉은 머리끈과 맞추고' — 샛별 쪽)

function addRedTie(g){
 const root=new T.Group();root.name='daraishi-red-hair-tie';root.userData={cosmetic:true,tails:2};g.add(root);
 const cloth=new T.MeshStandardMaterial({color:DARAISHI_RIBBON_RED,roughness:.94,metalness:0,side:T.DoubleSide});
 const add=(geo,p)=>{const m=new T.Mesh(geo,cloth);if(p)m.position.set(...p);m.castShadow=true;root.add(m);return m};
 add(new T.CylinderGeometry(.026,.027,.014,16,1,true),[-.236,-.158,0]);
 const knot=add(new T.SphereGeometry(1,8,6),[-.265,-.157,0]);knot.scale.set(.009,.012,.019);
 // 같은 매듭에서 나온 짧은 두 끝이 묶은 머리 뒤에 놓인다. 접힌 단면 · 고르지 않게 갈라진 끝이라 둥근 끈이 아니라 천으로 읽힌다
 for(const side of [-1,1]){
  const length=side<0?.127:.088,curve=new T.CatmullRomCurve3([
   new T.Vector3(-.267,-.163,side*.008),new T.Vector3(-.276,-.163-length*.35,side*.019),
   new T.Vector3(-.286,-.163-length*.76,side*.034),new T.Vector3(-.279,-.163-length,side*.046)]);
  const p=[],uv=[],idx=[],rows=12,cols=4;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const t=j/rows,u=i/cols,at=curve.getPoint(t),w=.017*(1-t*.26);
   p.push(at.x-.0028*Math.sin(u*Math.PI),at.y+(j===rows?[0,.003,-.003,.004,0][i]:0),at.z+(u-.5)*w);uv.push(u,t);
   if(j<rows&&i<cols){const n=j*(cols+1)+i;idx.push(n,n+cols+1,n+1,n+1,n+cols+1,n+cols+2);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();add(geo);
 }
}

export function decorateDaraishiAlter(g,part,palette,look={}){
 // 옛 v10 아래 자락처럼 색을 material.color 가 아니라 꼭짓점 색에 구운 옷감도 있다 — 그 색 견본만 정확히 바꾸고 살갗 · 머리는 건드리지 않는다
 const pairs=Object.entries(palette).map(([from,to])=>[new T.Color(+from),new T.Color(to)]);
 g.traverse(o=>{
  const a=o.geometry?.attributes.color;
  if(!a||!o.material?.vertexColors)return;
  for(let i=0;i<a.count;i++)for(const [old,next] of pairs){
   if(Math.abs(a.getX(i)-old.r)+Math.abs(a.getY(i)-old.g)+Math.abs(a.getZ(i)-old.b)<.0001){a.setXYZ(i,next.r,next.g,next.b);break;}
  }
  a.needsUpdate=true;
 });
 // 흑의 얼터만 머리 뒤에 붉은 끈. 거절된 탈옥 이야기의 끊어진 손목 족쇄(첫 얼터)는 안 가져옴
 if(look.daraishiBlack&&part==='head')addRedTie(g);
}
