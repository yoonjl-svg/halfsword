// 밤 다섯째 얼터의 겉모습 (샛별 저장소에서 가져옴 10/17 — docs/import/saetbyeol_round3_2026-10-17.md). 겉모습만 — +X 얼굴 쪽 · +Y 위 · +Z 입은 사람의 오른쪽
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function mesh(parent,geo,color,name){
 const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,roughness:.86,side:T.DoubleSide}));
 m.name=name;m.castShadow=true;parent.add(m);return m;
}
export function decorateFifthAlter(g,look,part){
 if(look.alter==='chanda'&&part==='head'){
  const veil=new T.Group();veil.name='chanda-white-face-veil';g.add(veil);
  const n=18,rows=14,p=[],ix=[],colors=[];
  // 찬다: 눈 아래에서 묶어 턱 밑까지 늘어지는 얇은 천 한 장 (사장님 10/16 '짧고 얇은 흰 가림천' — 샛별 쪽).
  // 늘어진 길이 · 주름 깊이를 반으로 줄이고 끈도 가늘게 — 껍데기가 아니라 가벼운 천으로 보이게
  for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
   const u=i/n,v=j/rows,a=u*2-1;
   const z=a*(.102-.020*Math.sin(v*Math.PI*.75));
   const y=.008-.16*v-.007*(1-a*a)+v**5*(.009*a*a+.0045*Math.sin(u*9+.3));
   const fold=Math.sin(u*Math.PI*6+.35)*(.00075+.005*v*v);
   const x=.088+.055*(1-a*a)+.013*v+.0045*Math.sin(v*Math.PI)+fold;
   p.push(x,y,z);
   const shade=.94+.045*Math.cos(u*Math.PI*6+.35);colors.push(shade,shade,shade);
   if(i<n&&j<rows){const k=j*(n+1)+i;ix.push(k,k+1,k+n+1,k+1,k+n+2,k+n+1)}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(ix);geo.computeVertexNormals();
  const cloth=mesh(veil,geo,0xf1ece1,'chanda-hanging-white-cloth');
  Object.assign(cloth.material,{roughness:1,vertexColors:true,transparent:true,opacity:.90,depthWrite:false});cloth.castShadow=false;
  const tie=new T.CatmullRomCurve3([[.092,.008,-.101],[.015,.017,-.116],[-.095,.022,-.072],[-.119,.022,.015],[-.072,.02,.095],[.018,.016,.116],[.092,.008,.101]].map(v=>new T.Vector3(...v)));
  mesh(veil,new T.TubeGeometry(tie,32,.00115,4,false),0xd4ccbc,'veil-head-tie');
  for(const pts of [[[-.117,.022,.014],[-.125,.002,.03],[-.122,-.079,.033]],[[-.117,.022,.014],[-.127,-.008,.006],[-.125,-.10,-.008]]]){
   mesh(veil,new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(v=>new T.Vector3(...v))),8,.0012,4,false),0xd4ccbc,'veil-tie-tail');
  }
 }
 if(look.alter==='renji'&&part==='head'){
  // 김씨: 원래 앞머리 · 삿갓은 그대로, 챙 아래로 길고 고르지 않은 머리 가닥이 내려온다
  const pieces=[];
  for(let i=0;i<15;i++){
   const a=1.03+i/14*4.22,x=Math.cos(a)*.106,z=Math.sin(a)*.105;
   const len=.25+.10*(.5+.5*Math.sin(i*2.7));
   const curve=new T.CatmullRomCurve3([new T.Vector3(x,.012,z),new T.Vector3(x*1.1,-.10,z*1.08),new T.Vector3(x*1.08-.025,-len*.75,z*1.20),new T.Vector3(x-.04,-len,z*1.28+.018*Math.sin(i))]);
   const geo=new T.TubeGeometry(curve,9,.013+(i%3)*.002,5,false);
   // 끝을 가늘게 — 밧줄처럼 둥근 끝이 아니라 넓은 머리 가닥으로
   const p=geo.attributes.position;
   for(let j=0;j<p.count;j++){const row=Math.floor(j/6),t=row/9,c=curve.getPointAt(t),s=1-.92*t**3;p.setXYZ(j,c.x+(p.getX(j)-c.x)*s,c.y+(p.getY(j)-c.y)*s,c.z+(p.getZ(j)-c.z)*s)}
   geo.computeVertexNormals();pieces.push(geo);
  }
  const joined=mergeGeometries(pieces);pieces.forEach(p=>p.dispose());
  mesh(g,joined,0x24201f,'renji-loose-long-hair');
 }
 if(look.alter==='renji'&&part==='pelvis'){
  const old=g.getObjectByName('renji-sheathed-sword');if(!old)return;
  // 감싼 칼은 이제 손에 든다 (renji_sword_wrap.js drawBrothersSword). 허리의 칼집은 감춘다 — 두 자루로 보이거나 빈 칼집이 남지 않게
  old.visible=false;
 }
}
