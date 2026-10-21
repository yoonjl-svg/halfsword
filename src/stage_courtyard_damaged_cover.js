// 밤의 봉인의 중정 — 포격에 한쪽 지붕이 깨진 급수정과 새는 물 (샛별 저장소에서 가져옴 10/21, stage_courtyard_night.js 가 부른다).
// 낮 급수정 꼴(stage_courtyard_cover.js buildCourtyardCover)을 그대로 지으며 지붕 한 귀퉁이 · 물받이 한 쪽만 실제로 잘라 낸다.
// 충돌체(COURTYARD_COVER_SHAPES 9)는 낮과 같다 — 깨진 지붕 귀퉁이(높이 2.44 m 위)에도 돌 충돌은 남는다(docs/import/courtyard_night_2026-10-21.md 판단 거리)
import * as THREE from 'three';
import {buildCourtyardCover} from './stage_courtyard_cover.js';
import {rng,box,canvasTex} from './stage_kit.js';

// 급수정 자기 좌표에서 평면 x + z = limit(잔물결을 더한 고르지 않은 금) 바깥 삼각형을 잘라 내고, 처음 조각 좌표로 되돌린다.
//  실제로 없어진 삼각형 + 거친 깨진 면(cap) — 멀쩡한 지붕을 어두운 판으로 가리는 것이 아니다
function fracture(geometry,toCover,limit){
  const g=geometry.index?geometry.toNonIndexed():geometry.clone();g.applyMatrix4(toCover);
  const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;
  const outside=[],normals=[],tex=[],cuts=[];
  const signed=v=>v.p.x+v.p.z-limit+.028*Math.sin(v.p.y*37)+.018*Math.sin((v.p.x-v.p.z)*23);
  const mix=(a,b,t)=>({p:a.p.clone().lerp(b.p,t),n:a.n.clone().lerp(b.n,t).normalize(),uv:a.uv.clone().lerp(b.uv,t)});
  const push=v=>{outside.push(...v.p.toArray());normals.push(...v.n.toArray());tex.push(...v.uv.toArray());};
  for(let i=0;i<p.count;i+=3){
    const tri=Array.from({length:3},(_,j)=>({p:new THREE.Vector3().fromBufferAttribute(p,i+j),n:new THREE.Vector3().fromBufferAttribute(n,i+j),uv:uv?new THREE.Vector2().fromBufferAttribute(uv,i+j):new THREE.Vector2()}));
    const poly=[];
    for(let j=0;j<3;j++){
      const a=tri[j],b=tri[(j+1)%3],da=signed(a),db=signed(b);
      if(da<=0)poly.push(a);
      if((da<=0)!==(db<=0)){const hit=mix(a,b,da/(da-db));poly.push(hit);cuts.push(hit.p);}
    }
    for(let j=1;j<poly.length-1;j++){push(poly[0]);push(poly[j]);push(poly[j+1]);}
  }
  const inverse=toCover.clone().invert();
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(outside,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));result.applyMatrix4(inverse);
  const unique=[...new Map(cuts.map(v=>[v.toArray().map(x=>x.toFixed(5)).join(','),v])).values()];
  let cap=null;
  if(unique.length>=3){
    const center=unique.reduce((v,p)=>v.add(p),new THREE.Vector3()).divideScalar(unique.length);
    unique.sort((a,b)=>Math.atan2(a.y-center.y,(a.x-a.z-center.x+center.z)/Math.SQRT2)-Math.atan2(b.y-center.y,(b.x-b.z-center.x+center.z)/Math.SQRT2));
    const coords=[];
    for(let j=0;j<unique.length;j++)coords.push(...center.toArray(),...unique[j].toArray(),...unique[(j+1)%unique.length].toArray());
    const capNormals=[];for(let i=0;i<coords.length;i+=3)capNormals.push(Math.SQRT1_2,0,Math.SQRT1_2);
    cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(coords.length/3*2).fill(0),2));cap.setAttribute('normal',new THREE.Float32BufferAttribute(capNormals,3));cap.applyMatrix4(inverse);
  }
  g.dispose();return {surface:result,cap};
}

function brokenBasin(g){
  // 속 빈 물받이 그릇은 두고, 좁은 부채꼴 한 조각만 떼어 내 돌 벽 단면만 막는다
  const points=g.parameters.points,start=Math.PI/4+.42,end=Math.PI/4-.42;
  const surface=new THREE.LatheGeometry(points,24,start,Math.PI*2-.84);
  const triangles=THREE.ShapeUtils.triangulateShape(points,[]),coords=[];
  for(const [a,flip]of [[start,false],[end,true]])for(const ids of triangles){
    for(const i of flip?[...ids].reverse():ids){const p=points[i];coords.push(p.x*Math.sin(a),p.y,p.x*Math.cos(a));}
  }
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));cap.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(coords.length/3*2).fill(0),2));cap.computeVertexNormals();
  return {surface,cap};
}

/**
 * 깨진 급수정을 K 에 짓는다 (K 의 지금 자리 = 급수정 자리). 반환 { cutPrimitives: 잘라 낸 조각 수 }.
 *  Kit.putM 을 잠깐 가로챈다 — put 도 limb(돔 갈빗대 · 출수구 관)도 모두 putM 을 지나므로, 지붕 높이(2.44 m 위) 조각은 어느 길로 와도 같은 금에서 잘린다
 *  (10/21 리뷰: put 만 가로채던 판은 limb 로 지은 돔 갈빗대 둘이 깨진 귀퉁이 위 허공에 떠 있었다)
 */
export function buildDamagedCourtyardCover(K,P){
  const original=K.putM,origin=K.frame.clone().invert();
  let cuts=0;
  K.putM=function(bin,g,color,m,opt={}){
    if(bin!=='cover')return original.call(this,bin,g,color,m,opt);
    const local=m.clone(); // m 은 Kit 의 공용 임시 행렬일 수 있다 — 아래 putM 을 두 번 부르기 전에 떠 둔다
    const toCover=origin.clone().multiply(this.frame).multiply(local);
    const bounds=new THREE.Box3().setFromBufferAttribute(g.attributes.position).applyMatrix4(toCover);
    const roof=bounds.min.y>2.44;
    const basin=g.type==='LatheGeometry'&&bounds.min.y>.80&&bounds.max.y<1.02&&bounds.min.z>.4;
    if(!roof&&!basin)return original.call(this,bin,g,color,local,opt);
    const cut=basin?brokenBasin(g):fracture(g,toCover,1.20);cuts++;
    let value;
    if(cut.surface.attributes.position.count)value=original.call(this,bin,cut.surface,color,local,opt);
    cut.surface.dispose();
    // 깨진 면: 속 빈 관(limb · 열린 원기둥)은 단면이 거의 안 보여 막지 않는다
    if(cut.cap&&!g.parameters?.openEnded)original.call(this,bin,cut.cap,0xd3b397,local,{...opt,vary:.06,noise:.025});
    cut.cap?.dispose();
    return value;
  };
  try{buildCourtyardCover(K,P);}finally{K.putM=original;}
  // 떨어진 지붕 조각 넷 — 받침돌에 붙여 둔다(지금 길잡이 반지름 COURTYARD_NAVIGATION 1.45 m 안)
  for(const [x,z,w,d,h,a]of [[.79,.85,.29,.17,.075,.3],[.62,.98,.20,.15,.045,-.25],[.9,.67,.18,.12,.052,.6],[.2,.89,.09,.07,.025,.3]]){
    K.put('cover',box(w,h,d),0xbda08b,[x,h/2+.014,z],[0,a,0],1,{rough:.015,vary:.08,noise:.02});
  }
  return {cutPrimitives:cuts};
}

/** 깨진 물받이에서 새는 물 (세상 좌표 parent 에 — 급수정 충돌체와 같은 −90° 돌림): 젖은 자국 · 금 · 바닥 웅덩이 · 떨어지는 물방울 · 파문. 반환 { update(dt, onDrip), root } */
export function damagedCoverLeak(parent){
  const root=new THREE.Group();root.name='courtyard-damaged-cover-water';root.rotation.y=-Math.PI/2;parent.add(root);
  const r=rng(211041),wetMat=new THREE.MeshStandardMaterial({color:0x5d574f,roughness:.25,metalness:.08,transparent:true,opacity:.38,depthWrite:false});
  const patch=(points,mat,z)=>{const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const m=new THREE.Mesh(new THREE.ShapeGeometry(s),mat);m.position.z=z;root.add(m);return m;};
  patch([[.09,.83],[.20,.84],[.23,.71],[.20,.58],[.26,.41],[.23,.27],[.13,.27],[.15,.43],[.10,.65]],wetMat,.607);
  // 벽을 타고 내려온 금 — 빛을 받는 어두운 재질(10/21 리뷰: 빛을 받지 않는 MeshBasic 이면 밤의 어두운 돌보다 밝아 흰 줄로 보였다)
  const crackMat=new THREE.MeshStandardMaterial({color:0x1e1714,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  patch([[.34,1.90],[.30,1.73],[.36,1.58],[.29,1.42],[.34,1.25],[.30,1.07],[.32,.99],[.28,1.07],[.32,1.25],[.27,1.42],[.34,1.58],[.28,1.73],[.32,1.90]],crackMat,.609);
  const puddlePoints=[];
  for(let i=0;i<18;i++){const a=i/18*Math.PI*2,rad=.8+r()*.2;puddlePoints.push([.15+Math.cos(a)*.27*rad,1.15+Math.sin(a)*.38*rad]);}
  const s=new THREE.Shape();puddlePoints.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
  const puddleMap=canvasTex(64,64,(c,w,h)=>{const g=c.createRadialGradient(32,32,3,32,32,31);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(.6,'rgba(255,255,255,.7)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.fillRect(0,0,w,h);});
  const puddleGeo=new THREE.ShapeGeometry(s),pp=puddleGeo.attributes.position,pu=puddleGeo.attributes.uv;
  for(let i=0;i<pp.count;i++)pu.setXY(i,(pp.getX(i)-.15)/.54+.5,(pp.getY(i)+1.15)/.76+.5);
  const puddle=new THREE.Mesh(puddleGeo,new THREE.MeshStandardMaterial({map:puddleMap,color:0x535a55,roughness:.14,metalness:.12,transparent:true,opacity:.50,depthWrite:false}));puddle.rotation.x=-Math.PI/2;puddle.position.y=.019;puddle.name='courtyard-leak-puddle';root.add(puddle);
  // 받침돌 윗면을 가로지르는 짧고 옅은 물줄기 둘
  for(const [x,z,w,d]of [[.15,.76,.055,.17],[.18,.84,.045,.10]]){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),wetMat);m.rotation.x=-Math.PI/2;m.position.set(x,.263,z);root.add(m);}
  const dropGeo=new THREE.SphereGeometry(.012,5,4),dropMat=new THREE.MeshBasicMaterial({color:0x9bafae,transparent:true,opacity:.68});
  const drops=[],ripples=[];
  for(let i=0;i<8;i++){const mesh=new THREE.Mesh(dropGeo,dropMat);mesh.visible=false;mesh.name='courtyard-water-drop';root.add(mesh);drops.push({mesh,age:0,active:false});}
  const ringGeo=new THREE.RingGeometry(.018,.024,16);
  for(let i=0;i<4;i++){const mesh=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0x829691,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));mesh.rotation.x=-Math.PI/2;root.add(mesh);ripples.push({mesh,age:1});}
  // 물방울이 나오는 곳 둘: 출수구 끝(물받이 물 높이로 떨어짐) · 깨진 물받이 가장자리(바닥으로 떨어지며 앞으로 조금 튐 vz)
  const sources=[{x:0,y:1.198,z:.716,ground:.891,vz:0,next:.1},{x:.20,y:.938,z:.79,ground:.022,vz:.61,next:.2}];
  const soundPoint=new THREE.Vector3(),state={emitted:0,impacts:0,time:0};let time=0,nextSound=1.4;
  root.userData=state; // 점검 도구가 읽는다 — 프레임마다 새 객체를 만들지 않고 이 객체를 고쳐 쓴다
  const update=(dt,onDrip)=>{
    time+=dt;
    for(let k=0;k<sources.length;k++){
      const source=sources[k];
      if(time<source.next)continue;
      source.next=time+.26+r()*.62;
      let d=null;for(let j=0;j<drops.length;j++)if(!drops[j].active){d=drops[j];break;}
      if(d){d.age=0;d.active=true;d.source=source;d.mesh.visible=true;state.emitted++;}
    }
    for(let k=0;k<drops.length;k++){const d=drops[k];if(!d.active)continue;d.age+=dt;const s=d.source,t=d.age,y=s.y-4.9*t*t;
      d.mesh.position.set(s.x,y,s.z+s.vz*t);d.mesh.scale.set(.75,1.2+t*5,.75);
      if(y>s.ground)continue;d.active=false;d.mesh.visible=false;state.impacts++;
      let ripple=ripples[0];for(let j=0;j<ripples.length;j++)if(ripples[j].age>.6){ripple=ripples[j];break;}
      ripple.age=0;ripple.mesh.position.set(s.x,s.ground+.002,s.z+s.vz*Math.sqrt((s.y-s.ground)/4.9));
      if(s.vz&&time>nextSound){nextSound=time+2.0+r()*2.1;soundPoint.copy(ripple.mesh.position);root.localToWorld(soundPoint);onDrip?.({x:soundPoint.x,y:soundPoint.y,z:soundPoint.z});}
    }
    for(let k=0;k<ripples.length;k++){const q=ripples[k];q.age+=dt;const u=q.age/.6;q.mesh.scale.setScalar(1+u*4);q.mesh.material.opacity=u<1?.24*(1-u):0;}
    state.time=time;
  };
  return {update,root};
}
