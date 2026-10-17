// 다라이시 v7 기본 다듬기 (샛별 저장소에서 가져옴 10/17 — 사장님 10/16 결정, 샛별 쪽 · docs/import/saetbyeol_round3_2026-10-17.md). 흑의 얼터도 같이 쓴다.
// 모든 메쉬는 겉모습 · 부위 좌표 — 새 몸 · 질량 · 방어구 범위 · 제약 없음
export function createDaraishiFront(h) {
 const {THREE:T,artoriaCloth,addMerged,CLOTH,isoldeLock}=h;
 const ivory=0xe7dfcf,purple=0x433653,gold=0xc4ac78;
 const cloth={...CLOTH,roughness:.9,metalness:0,side:T.DoubleSide};
 const thread={...cloth,roughness:.77,metalness:.12};
 const line=(points,r=.0017)=>new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),Math.max(8,points.length*3),r,5,false);
 function frontSurface(g) {
  const {width:w,height:h,depth:d}=g.children[0].geometry.parameters,r=Math.min(.055,h/3);
  return (z,y,raise=.003)=>{
   const dy=Math.max(0,Math.abs(y)-(h/2-r)),dz=Math.max(0,Math.abs(z)-(d/2-r));
   const x=(w/2-r+Math.sqrt(Math.max(0,r*r-dy*dy-dz*dz)))*T.MathUtils.lerp(.96,1,T.MathUtils.clamp((y+h/2)/h,0,1));
   return [x+raise,y,z];
  };
 }
 function strip(path,width,surface,raise=.003) {
  const p=[],idx=[];
  for(let i=0;i<path.length;i++){
   const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const dz=-(b[1]-a[1])/len*width/2,dy=(b[0]-a[0])/len*width/2;
   for(const s of [-1,1])p.push(...surface(path[i][0]+s*dz,path[i][1]+s*dy,raise));
   if(i){const j=i*2;idx.push(j-2,j-1,j,j-1,j+1,j);}
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setIndex(idx);geo.computeVertexNormals();return geo;
 }
 function collar(y,a,raise=.003) {
  const rows=[[.254,.072,.082],[.19,.079,.092],[.16,.127,.188],[.119,.14,.208],[.037,.14,.211]];
  let j=0;while(j<rows.length-2&&y<rows[j+1][0])j++;
  const u=T.MathUtils.clamp((rows[j][0]-y)/(rows[j][0]-rows[j+1][0]),0,1),rx=T.MathUtils.lerp(rows[j][1],rows[j+1][1],u),rz=T.MathUtils.lerp(rows[j][2],rows[j+1][2],u);
  const c=Math.cos(a),s=Math.sin(a),r=(Math.abs(c/rx)**4+Math.abs(s/rz)**4)**-.25,f=1+.008*Math.cos(a*8+(j+u)*.25);
  return [(r*f+raise)*c,y,(r*f+raise)*s];
 }
 function torso(g,part,look) {
  g.children[0].material.color.setHex(ivory);
  const layer=artoriaCloth(g,'silver-wanderer-front-tailoring'),surface=frontSurface(g);
  const band=[],stems=[],knots=[],folds=[];
  const chest=part==='chest',top=chest ? .122 : .068,bottom=chest ? -.128 : -.02;
  // 가슴에서 허리띠까지 세로 가운데를 완만한 S 하나가 따라 내려간다 (v7-front2 — 사장님 '수직의 아지랑이 같은 곡선').
  // 배는 몸 부위 사이 4 mm 틈 뒤에서 같은 곡선을 잇는다
  const zAt=y=>look.daraishiFront>=2
   ?.018*Math.sin(2*Math.PI*(chest ? .122-y : .254+.068-y)/.342)
   :chest?-.047+(.122-y)/.25*.11:.063+(.068-y)*.12;
  const path=Array.from({length:25},(_,i)=>{const y=T.MathUtils.lerp(top,bottom,i/24);return [zAt(y),y]});
  band.push(strip(path,.022,surface,.0045));
  // 살짝 도드라진 짠 테와 그 그림자 — 앞섶이 실제로 겹친 것처럼
  addMerged(layer,[strip(path.map(([z,y])=>[z+.013,y]),.004,surface,.0025)],0xb7ad99,cloth);
  stems.push(line(path.map(([z,y])=>surface(z-.008,y,.006)),.0013));
  if(chest) {
   for(const side of [-1,1])stems.push(line(Array.from({length:18},(_,i)=>collar(.245-i/17*.174,side*.61)),.0017));
   // 손보다 위, 앞가슴 위쪽에 작은 끈 매듭 여밈 셋
   for(const y of [.077,.018,-.041]){
    const z=zAt(y);
    knots.push(line([[z-.028,y],[z-.018,y+.006],[z+.017,y+.005],[z+.025,y],[z+.016,y-.005],[z-.017,y-.005],[z-.028,y]].map(([u,v])=>surface(u,v,.007)),.0028));
    const knot=new T.SphereGeometry(.0057,8,5);knot.scale(.65,1,1.3);knot.translate(...surface(z-.028,y,.008));knots.push(knot);
   }
   // 짝지은 잎 몇 개 — 있던 팔각 꽃 장식과 어울리게, 문장 판을 더하지 않는다.
   // 굵은 자주 앞섶은 싸우는 거리에서도 읽힌다
   for(const y of [.102,.048,-.010,-.071])for(const side of [-1,1]){
    const stem=Array.from({length:7},(_,i)=>{const t=i/6,v=y+t*.018,z=zAt(look.daraishiFront>=2?v:y);return surface(z+side*(.001+.007*Math.sin(t*Math.PI)),v,.0068)});
    stems.push(line(stem,.00125));
   }
   // 얕은 천 주름이 허리띠 쪽으로 모인다 — 셔츠 위에만
   for(const [z0,z1,y0] of [[-.098,-.052,.025],[-.14,-.075,-.03],[.125,.103,-.015]]){
    const points=Array.from({length:17},(_,i)=>{const t=i/16;return [T.MathUtils.lerp(z0,z1,t),T.MathUtils.lerp(y0,-.116,t)]});
    folds.push(strip(points,.013,(z,y,raise)=>surface(z,y,.002+raise*Math.sin(Math.PI*(y-y0)/(-.116-y0))),.003));
   }
  }
  addMerged(layer,band,purple,cloth);addMerged(layer,stems,gold,thread);addMerged(layer,knots,0x88745d,cloth);addMerged(layer,folds,0xeee7d9,cloth);
  layer.userData={cosmetic:true,frontStudy:1,closures:chest?3:0,folds:chest?3:0};
 }
 function hair(g,look) {
  const layer=artoriaCloth(g,'silver-wanderer-front-lock');
  const points=[[.032,.104,-.026],[.077,.079,-.031],[.105,.040,-.052],[.109,-.004,-.066],[.103,-.049,-.060],[.095,-.081,-.044]];
  addMerged(layer,[isoldeLock(points,[.019,.022,.018,.014,.007,.001],.0038)],look.hair,{...cloth,roughness:.63});
  const glint=points.slice(1,5).map(([x,y,z])=>[x+.0035,y,z-.003]);
  addMerged(layer,[isoldeLock(glint,[.002,.003,.002,.0003],.001)],look.hairPalette?.glint??0x9994a0,{...cloth,roughness:.68});
  layer.userData={cosmetic:true,frontStudy:1,locks:1};
 }
 function closeNeck(g,look) {
  // 열린 겉옷 사이 빈 목으로 뒷머리가 보이던 것 (사장님 10/16 '목의 빈틈 수정' — 샛별 쪽):
  // 닫힌 셔츠 어깨판이 가슴과 실제 살갗 색 목에 함께 겹친다.
  // 겉모습 가슴 층에만 붙인다 — 충돌 · 방어구 그대로
  const layer=artoriaCloth(g,'silver-wanderer-neck'),p=[],idx=[],n=20;
  const rows=[[.108,.106,.165],[.135,.095,.133],[.169,.056,.061],[.169,.046,.046]];
  for(let j=0;j<rows.length;j++)for(let i=0;i<=n;i++){
   const a=i/n*Math.PI*2,[y,rx,rz]=rows[j];p.push(rx*Math.cos(a),y,rz*Math.sin(a));
   if(j&&i){const k=j*(n+1)+i;idx.push(k-n-2,k-1,k-n-1,k-n-1,k-1,k);}
  }
  const yoke=new T.BufferGeometry();yoke.setAttribute('position',new T.Float32BufferAttribute(p,3));yoke.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(p.length/3*2),2));yoke.setIndex(idx);yoke.computeVertexNormals();
  addMerged(layer,[yoke],ivory,cloth);
  const neck=new T.CylinderGeometry(.043,.052,.10,16);neck.translate(0,.177,0);
  addMerged(layer,[neck],look.skin,{...cloth,roughness:.82});
  layer.userData={cosmetic:true,neckClosure:true};
 }
 function slimSides(g) {
  // 머리에 붙은 옆머리의 옆 불룩함만 줄인다 (사장님 '옆머리는 형태를 유지하며 더 슬림하게').
  // 정수리 · 얼굴 · 가운데 뒤 땋음 · 승인된 앞머리 한 가닥은 그대로
  const layer=g.getObjectByName('silver-wanderer-hair');if(!layer)return;
  for(const mesh of layer.children){
   const geo=mesh.geometry,p=geo?.attributes.position;if(!p)continue;
   for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.abs(z);
    const weight=T.MathUtils.smoothstep(.075-y,0,.12)
      *(1-T.MathUtils.smoothstep(-y,.24,.38))*T.MathUtils.smoothstep(x,-.23,-.08);
    p.setZ(i,z-Math.sign(z)*Math.max(0,a-.075)*.4*weight);
   }
   geo.computeVertexNormals();geo.computeBoundingBox();geo.computeBoundingSphere();
  }
 }
 return (g,look,part)=>{
  if(![1,2].includes(look?.daraishiFront))return;
  if(part==='head'){if(look.daraishiFront>=2)slimSides(g);hair(g,look);}
  else if(part==='chest'||part==='abdomen'){torso(g,part,look);if(part==='chest'&&look.daraishiNeck)closeNeck(g,look);}
 };
}
