// 광기의 아르토리아 — 검은 궁정 예복 v4-alter13 (샛별 저장소에서 가져옴 10/17 — 사장님 10/16~17 결정, 샛별 쪽 · docs/import/saetbyeol_round3_2026-10-17.md).
// 옷은 겉면 그림일 뿐: 원래 몸 · 관절 · AI 와 갑옷을 벗은 전투 상태(outfit_alter.js alterLook — 사장님 승인 예외)는 그대로
export function createArtoriaBallroomOutfit(h, originalHead) {
  const {THREE,addMerged,CLOTH,bake,reshapeMain,artoriaRoundedBox,clothNeck,isoldeLock,taperedTube}=h;
  const DRESS=0x25232b,FOLD=0x3d3540,SEAM=0x66555d,BOOT=0x29272d,IVORY=0xe0d1b2;
  const GOLD=0xa8905d,THREAD=0x786849,UNDER=0x66505a;
  const fabric={...CLOTH,roughness:.78,side:THREE.DoubleSide};
  const leather={...CLOTH,roughness:.63};
  const chestRows=[[-.165,.091,.136],[-.10,.100,.146],[-.035,.118,.166],[.035,.124,.169],[.10,.111,.171],[.137,.091,.158],[.18,.045,.049]];
  const waistRows=[[-.11,.106,.154],[-.065,.096,.137],[0,.085,.120],[.055,.089,.128],[.11,.096,.141]];
  const lerp=THREE.MathUtils.lerp;
  function radii(rows,y){
    for(let i=0;i<rows.length-1;i++)if(y<=rows[i+1][0]){
      const a=rows[i],b=rows[i+1],u=THREE.MathUtils.clamp((y-a[0])/(b[0]-a[0]),0,1),t=u*u*(3-2*u);
      return [lerp(a[1],b[1],t),lerp(a[2],b[2],t)];
    }
    return rows.at(-1).slice(1);
  }
  function point(rows,y,a,padding=0){
    const [rx,rz]=radii(rows,y),c=Math.cos(a),s=Math.sin(a);
    const r=1/Math.pow(Math.pow(Math.abs(c)/rx,2.35)+Math.pow(Math.abs(s)/rz,2.35),1/2.35);
    return [c*(r+padding),y,s*(r+padding)];
  }
  function surface(fn,rows=22,n=64){
    const vertices=[],uv=[],indices=[];
    for(let j=0;j<=rows;j++)for(let i=0;i<=n;i++){
      vertices.push(...fn(j/rows,i/n*Math.PI*2));uv.push(i/n,j/rows);
      if(j<rows&&i<n){const k=j*(n+1)+i;indices.push(k,k+n+1,k+1,k+1,k+n+1,k+n+2)}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  function main(g,geo,color){
    const m=g.children[0];if(geo)reshapeMain(m,geo);
    m.material.color.setHex(color);m.material.roughness=.85;m.material.metalness=0;
    for(const extra of g.children.slice(1))extra.visible=false;
    return m;
  }
  const line=(g,pts,color=SEAM,r=.0015)=>addMerged(g,[taperedTube(pts,pts.map(()=>r),pts.length*5,5)],color,CLOTH);
  const edge=(g,fn,color,r=.0017)=>line(g,Array.from({length:65},(_,i)=>fn(i/64*Math.PI*2)),color,r);
  function chest(g,look){
    main(g,surface((t,a)=>point(chestRows,lerp(-.165,.18,t),a)),look.skin);
    clothNeck(g,look);
    carcanet(g);
    addMerged(g,[-1,1].map(s=>bake(new THREE.SphereGeometry(.048,18,12),[0,.099,s*.19],null,[1,.94,1])),look.skin,CLOTH);
    // 완만한 V 궁정 목선과 짠 테 — 르네상스 예복에서 착안한 창작, 특정 옷 한 벌의 복원이 아니다 (사장님 '퍼프 소매 · 수평 가슴선 대신 가는 소매 · V 목선' — 샛별 쪽)
    const top=a=>Math.cos(a)>0?.005+.097*Math.pow(Math.abs(Math.sin(a)),1.1):.075;
    addMerged(g,[surface((t,a)=>point(chestRows,lerp(-.166,top(a),t),a,.003))],DRESS,fabric).name='artoria-ballroom-bodice';
    addMerged(g,[surface((t,a)=>point(chestRows,top(a)-t*.025,a,.006),4)],FOLD,fabric).name='artoria-court-neckline';
    edge(g,a=>point(chestRows,top(a),a,.008),GOLD,.0028);
    edge(g,a=>point(chestRows,top(a)-.022,a,.008),THREAD,.0016);
    // 짠 목선을 따라 작은 진주 알 — 크기는 조용하게
    addMerged(g,Array.from({length:25},(_,i)=>{
      const a=-1.22+i/24*2.44;return bake(new THREE.SphereGeometry(.0032,8,6),point(chestRows,top(a)-.012,a,.009));
    }),IVORY,CLOTH);
    // 앞가슴 장식판은 뾰족한 허리로 좁아진다. 짙은 포도주 비단은 이 안쪽 판과 속치마에만 — 큰 윤곽은 검정 그대로
    addMerged(g,[surface((t,a)=>{
      const angle=lerp(-.46,.46,a/(Math.PI*2)),y=lerp(-.165,top(angle)-.008,t);
      return point(chestRows,y,angle,.008);
    },14,24)],UNDER,fabric).name='artoria-court-stomacher';
    for(const side of [-1,1])line(g,Array.from({length:14},(_,i)=>point(chestRows,lerp(top(side*.46)-.008,-.165,i/13),side*.46,.01)),GOLD,.0023);
    for(const y of [-.035,-.09,-.145])ornament(g,(dy,z)=>{
      const a=Math.asin(z/.165);return point(chestRows,y+dy,a,.011);
    },.017,.019);
    // 옆머리는 이제 머리 뒤로 넘겨 땋는다 — 가슴에 따로 붙은 머리 끝 없음 (사장님 '옆머리를 뒤로 당겨 부드럽게 땋아' — 샛별 쪽)
  }
  // 짧은 궁정 목걸이 — 목 밑에 여유를 두고 드레스 목선보다 확실히 위에 (사장님 '첫 초커와 긴 사슬의 중간 높이' — 샛별 쪽). 빛 · 방어 효과 없음
  function carcanet(g){
    const jewel=new THREE.Group();jewel.name='artoria-court-necklace';g.add(jewel);
    const gold={metalness:.52,roughness:.42,steel:.6};
    // 정면에서 좁고 곧은 V (사장님 '가슴 V선보다 좁은 V자' — 샛별 쪽). 깊이는 가슴을 따르고 두 사슬 갈래는 드레스의 넓은 V 안쪽에 넉넉히
    const front=(t,side=1)=>{
      const y=lerp(.128,.176,t),z=side*.042*t,[rx,rz]=radii(chestRows,y);
      const x=rx*Math.pow(Math.max(0,1-Math.pow(Math.abs(z)/rz,2.35)),1/2.35)+.007;
      return [x,y,z];
    };
    for(const side of [-1,1]){
      const pts=Array.from({length:25},(_,i)=>front(i/24,side));
      addMerged(jewel,[taperedTube(pts,pts.map(()=>.0015),48,5)],0xb39761,gold);
    }
    // 목 뒤로 사슬을 잇는다 — 앞의 둥근 호는 V 가 대신한다
    const anchor=front(1),angle=Math.atan2(anchor[2],anchor[0]),radius=Math.hypot(anchor[0],anchor[2]);
    const back=Array.from({length:65},(_,i)=>{
      const a=lerp(angle,Math.PI*2-angle,i/64);
      return [Math.cos(a)*radius,.176,Math.sin(a)*radius];
    });
    addMerged(jewel,[taperedTube(back,back.map(()=>.0015),96,5)],0xb39761,gold);
    addMerged(jewel,[-1,1].flatMap(side=>[.38,.72].map(t=>
      bake(new THREE.SphereGeometry(.0042,10,8),front(t,side))
    )),0xe3d6ba,{...CLOTH,roughness:.48});
    const chain=Array.from({length:12},(_,i)=>point(chestRows,.128-i/11*.032,0,.008));
    addMerged(jewel,[taperedTube(chain,chain.map(()=>.0013),24,5)],0xb39761,gold);
    const center=point(chestRows,.113,0,.010);
    addMerged(jewel,[bake(new THREE.SphereGeometry(.0135,12,10),center,null,[.36,1.18,.88])],0xb39761,gold);
    addMerged(jewel,[bake(new THREE.OctahedronGeometry(.0095,1),[center[0]+.004,center[1],0],null,[.48,1.18,.87])],0x74303c,{metalness:.12,roughness:.31});
    addMerged(jewel,[bake(new THREE.SphereGeometry(.0055,12,10),point(chestRows,.093,0,.009),null,[.85,1.15,.85])],0xe3d6ba,{...CLOTH,roughness:.48});
  }
  // 네 잎 자수 — 떠 있는 금속 장식판이 아니라 실로
  function ornament(g,project,w,h){
    const pts=Array.from({length:33},(_,i)=>{
      const a=i/32*Math.PI*2,r=.72+.28*Math.cos(4*a);
      return project(Math.cos(a)*h*r,Math.sin(a)*w*r);
    });
    line(g,pts,THREAD,.0011);
    line(g,[project(-h*.3,0),project(h*.3,0)],GOLD,.0013);
  }
  function abdomen(g,look,d,groups){
    main(g,surface((t,a)=>point(waistRows,lerp(-.11,.11,t),a)),DRESS);
    addMerged(g,[surface((t,a)=>{
      const y=lerp(-.11,.11,t),angle=lerp(-.26-.2*t,.26+.2*t,a/(Math.PI*2));
      return point(waistRows,y,angle,.004);
    },14,24)],UNDER,fabric);
    for(const side of [-1,1])line(g,Array.from({length:14},(_,i)=>{
      const t=i/13;return point(waistRows,-.11+t*.22,side*(.26+.2*t),.006);
    }),GOLD,.0023);
    ornament(g,(dy,z)=>point(waistRows,.015+dy,Math.asin(z/.125),.006),.019,.030);
    // 절제된 V 허리띠가 몸판과 풍성한 치마를 가른다
    edge(g,a=>point(waistRows,-.092+.045*Math.abs(Math.sin(a)),a,.004),GOLD,.003);
    for(let i=0;i<4;i++)for(const side of [-1,1]){
      const y=.065-i*.033,p=point(waistRows,y,Math.PI+side*.18,.003),q=point(waistRows,y-.031,Math.PI-side*.18,.003);
      line(g,[p,q],FOLD,.0014);
    }
    courtCord(g,groups?.pelvis);
  }
  function skirtPoint(t,a,outer=false){
      const flare=Math.pow(t,.72),fold=Math.pow(t,.8)*(.012*Math.cos(a*12+.25)+.003*Math.cos(a*19));
      // 원래 무릎 굽힌 자세 · 앞으로 내딛는 부츠가 들어갈 앞 품을 넉넉히 — 원래 짧은 드레스는 이 다리 움직임을 감쌀 일이 없었다
      const rx=lerp(.103,.41+.05*Math.cos(a),flare)+.05*Math.sin(t*Math.PI)+fold+(outer?.007:0);
      const rz=lerp(.154,.399,flare)+fold+(outer?.007:0);
      // 옷단은 땅 · 뒷발에 닿지 않는다 — 걸음을 가로지르는 긴 끌림 자락 없음
      return [Math.cos(a)*rx,.118-.916*t+Math.pow(t,5)*.008*Math.cos(a*12),Math.sin(a)*rz];
  }
  function pelvis(g){
    main(g,artoriaRoundedBox(.208,.18,.312,.045),DRESS);
    const at=skirtPoint;
    const under=surface((t,a)=>at(t,a),28,96);
    const colors=[];
    for(let j=0;j<=28;j++)for(let i=0;i<=96;i++){
      const shade=.87+.13*Math.cos(i/96*Math.PI*24+.25);colors.push(shade,shade,shade);
    }
    under.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    addMerged(g,[under],UNDER,{...fabric,vertexColors:true}).name='artoria-ballroom-skirt';
    // 앞이 트인 검은 겉치마: 허리의 좁은 트임이 문양 비단 앞판 위로 넓어진다. 아래에 속치마가 온전히 있다
    const opening=t=>.12+.58*Math.pow(t,.68);
    const outerAt=(t,u)=>at(t,lerp(opening(t),Math.PI*2-opening(t),u),true);
    addMerged(g,[surface((t,a)=>outerAt(t,a/(Math.PI*2)),28,96)],DRESS,fabric).name='artoria-court-overskirt';
    for(const side of [-1,1]){
      line(g,Array.from({length:40},(_,i)=>at(i/39,side*opening(i/39),true)),GOLD,.0031);
      line(g,Array.from({length:40},(_,i)=>at(i/39,side*(opening(i/39)+.035),true)),THREAD,.0015);
    }
    line(g,Array.from({length:65},(_,i)=>outerAt(1,i/64)),GOLD,.0031);
    line(g,Array.from({length:65},(_,i)=>outerAt(.974,i/64)),THREAD,.0018);
    edge(g,a=>at(1,a),THREAD,.0022);
    // 드러난 비단 위에 작은 짠 문양이 세로로 되풀이된다. 대비 · 간격을 낮춰 앞치마처럼 읽히지 않게
    for(const t of [.30,.47,.64,.81])for(const side of (t<.4?[0]:[-1,1])){
      const center=side*.22;
      ornament(g,(dy,z)=>{
        const p=at(t-dy/.916,center+z/.28);p[0]+=.003;return p;
      },.020,.026);
    }
    // 치마 위에 길고 뾰족한 허리 — 궁정 몸판을 마무리
    const waistPoint=(t,u)=>{
      const y=.131-.084*t,z=(u*2-1)*.042*(1-t),st=Math.max(0,(.118-y)/.916);
      const angle=Math.asin(z/lerp(.154,.399,Math.pow(st,.72))),p=at(st,angle);
      return [p[0]+.011,y,z];
    };
    addMerged(g,[surface((t,a)=>waistPoint(t,a/(Math.PI*2)),8,20)],UNDER,fabric);
    for(const side of [0,1])line(g,Array.from({length:12},(_,i)=>waistPoint(i/11,side)),GOLD,.0021);
  }

  // 검은 꼬임 허리끈 — 전례복 위에 매는 끈에서 착안 (사장님 '고귀한 신분을 나타내는 검은 허리끈' — 샛별 쪽).
  // 그림뿐인 궁정 장신구 — 실제 교회 직위나 방어구가 아니다
  function courtCord(g,pelvisGroup){
    const holder=new THREE.Group();holder.name='artoria-black-cincture';g.add(holder);
    const cordMat={...CLOTH,roughness:.68},black=0x141219,thread=0x2b2730;
    // 끈의 가운데를 배 y=0 — 맞춘 몸판의 가장 잘록한 곳에 (사장님 '잘록한 허리로 올려' — 샛별 쪽 v4-alter13).
    // 전에는 치마 위쪽에 매여 약 7 cm 낮고 너무 넓었다
    const onBody=(t,a)=>{
      const y=.025-.916*t,waist=point(waistRows,y,a,.010);
      const skirtT=Math.max(0,(.118-(y+.16))/.916),p=skirtPoint(skirtT,a,true);
      p[0]+=.010*Math.cos(a);p[2]+=.010*Math.sin(a);p[1]=y;
      const blend=THREE.MathUtils.smoothstep(-y,.010,.042);
      return waist.map((v,i)=>lerp(v,p[i],blend));
    };
    function rope(points,r=.0055){
      const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
      const count=Math.max(32,Math.ceil(path.getLength()*200));
      addMerged(holder,[taperedTube(points,points.map(()=>r*.88),count,8)],black,cordMat);
      const frame=path.computeFrenetFrames(count,false),pieces=[];
      for(let strand=0;strand<3;strand++){
        const pts=Array.from({length:count+1},(_,i)=>{
          const phase=i/count*path.getLength()*Math.PI*2/.026+strand*Math.PI*2/3;
          return path.getPointAt(i/count).addScaledVector(frame.normals[i],Math.cos(phase)*r*.69).addScaledVector(frame.binormals[i],Math.sin(phase)*r*.69).toArray();
        });
        pieces.push(taperedTube(pts,pts.map(()=>r*.33),count,5));
      }
      addMerged(holder,pieces,thread,cordMat);
    }
    // 살짝 처진 고리 · 가운데에서 조금 비켜 맨 매듭 · 길이가 다른 두 끝과 술
    rope(Array.from({length:65},(_,i)=>{
      const a=i/64*Math.PI*2;return onBody(.012+.015*Math.max(0,Math.cos(a)),a);
    }));
    const knot=onBody(.028,-.54);
    rope(Array.from({length:25},(_,i)=>{
      const a=i/24*Math.PI*2;return [knot[0]+.009+.005*Math.sin(a),knot[1]+.011*Math.cos(a),knot[2]+.016*Math.sin(a)];
    }),.0065);
    for(const [end,side] of [[.35,-1],[.44,1]]){
      const angle=t=>-.54+side*.07*Math.sin(t*Math.PI*.75);
      const pts=Array.from({length:25},(_,i)=>{
        const t=i/24,p=onBody(lerp(.031,end,t),angle(t));p[0]+=.012*Math.sin(t*Math.PI);return p;
      });
      rope(pts,.005);
      const tip=pts.at(-1);
      addMerged(holder,[bake(new THREE.SphereGeometry(.009,12,10),[tip[0],tip[1]-.004,tip[2]],null,[.85,1.1,.85])],black,cordMat);
      const tassels=[];
      for(let i=0;i<10;i++){
        const a=i/10*Math.PI*2;
        tassels.push(taperedTube([
          [tip[0]+Math.cos(a)*.004,tip[1]-.008,tip[2]+Math.sin(a)*.004],
          [tip[0]+.007+Math.cos(a)*.010,tip[1]-.028,tip[2]+Math.sin(a)*.010],
          [tip[0]+.012+Math.cos(a)*.009,tip[1]-.048,tip[2]+Math.sin(a)*.009],
        ],[.0022,.0025,.0017],12,5));
      }
      addMerged(holder,tassels,thread,cordMat);
    }
    // 감은 끈은 허리를, 늘어진 끝은 치마를 따른다. 두 쪽의 그리기 변환을 섞어 몸통이 비틀려도 끈이 묻히지 않게.
    // 겉모습 꼭짓점만 휜다 — 몸 · 관절 · 시뮬은 건드리지 않는다
    if(pelvisGroup){
      const relative=new THREE.Matrix4(),rest=new THREE.Matrix4().makeTranslation(0,.16,0);
      const normalMatrix=new THREE.Matrix3(),v=new THREE.Vector3(),n=new THREE.Vector3();
      for(const mesh of holder.children){
        const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal;
        const original=position.array.slice(),normals=normal.array.slice();
        const weights=Array.from({length:position.count},(_,i)=>THREE.MathUtils.smoothstep(-original[i*3+1],.010,.042));
        if(!weights.some(w=>w>0))continue;
        mesh.frustumCulled=false;
        const update=()=>{
          relative.copy(g.matrixWorld).invert().multiply(pelvisGroup.matrixWorld).multiply(rest);
          normalMatrix.getNormalMatrix(relative);
          for(let i=0;i<position.count;i++){
            const k=i*3,w=weights[i];v.fromArray(original,k).applyMatrix4(relative);
            position.setXYZ(i,lerp(original[k],v.x,w),lerp(original[k+1],v.y,w),lerp(original[k+2],v.z,w));
            n.fromArray(normals,k).applyMatrix3(normalMatrix).normalize();
            n.set(lerp(normals[k],n.x,w),lerp(normals[k+1],n.y,w),lerp(normals[k+2],n.z,w)).normalize();
            normal.setXYZ(i,n.x,n.y,n.z);
          }
          position.needsUpdate=true;normal.needsUpdate=true;
        };
        mesh.onBeforeRender=update;mesh.onBeforeShadow=update;
      }
    }
  }

  function limb(g,look,upper=false,forearm=false){
    const old=g.children[0].geometry.parameters,{radius,height}=old;
    const geo=new THREE.CapsuleGeometry(radius,height+.014,8,24),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const t=THREE.MathUtils.clamp((p.getY(i)+height/2+radius)/(height+radius*2),0,1);
      const k=upper?lerp(.79,.98,t):lerp(.82,.96,t);
      p.setXYZ(i,p.getX(i)*k,p.getY(i),p.getZ(i)*k);
    }
    geo.computeVertexNormals();reshapeMain(g.children[0],geo);
    g.children[0].material.color.setHex(look.skin);g.children[0].material.metalness=0;
    if(forearm){
      for(const m of g.children.slice(1))if(m.material)m.material.color.setHex(look.skin);
      // 몸에 맞는 아래팔 소매, 손목에서 작은 상아색 주름으로 모인다
      const sleeve=surface((t,a)=>{
        const r=lerp(.044,.055,t);return [Math.cos(a)*r,-.104+t*.278,Math.sin(a)*r];
      },10,32);
      addMerged(g,[sleeve],DRESS,fabric).name='artoria-court-lower-sleeve';
      const cuff=surface((t,a)=>{
        const r=.045+.014*t+.004*t*Math.cos(a*12);return [Math.cos(a)*r,-.097-.041*t,Math.sin(a)*r];
      },5,48);
      addMerged(g,[cuff],IVORY,fabric);
      edge(g,a=>[Math.cos(a)*.048,-.098,Math.sin(a)*.048],GOLD,.0021);
    }
    if(upper){
      // 사장님이 퍼프 볼륨을 거절 (샛별 쪽): 팔을 따르는 좁은 소매 — 윤곽을 넓히는 모은 어깨 · 가로 띠 없음
      const at=(t,a)=>{
        const r=.047+.008*Math.sin(t*Math.PI);
        return [Math.cos(a)*r,.157-t*.33,Math.sin(a)*r];
      };
      // 소매를 이 팔의 보이는 겉면으로 쓴다. 바로 밑에 살갗 캡슐을 하나 더 두면 소매 끝에서 들쭉날쭉 겹친다
      const sleeve=main(g,surface(at,14,40),DRESS);
      sleeve.material.side=THREE.DoubleSide;sleeve.name='artoria-court-fitted-sleeve';
      line(g,Array.from({length:17},(_,i)=>{
        const p=at(i/16,Math.PI);p[0]-=.0015;return p;
      }),THREAD,.0013);
    }
  }

  function boot(g){
    const rows=[[-.229,.042,.044],[-.15,.047,.048],[-.04,.064,.060],[.10,.062,.058],[.205,.066,.061],[.285,.071,.065]];
    main(g,surface((t,a)=>point(rows,lerp(-.229,.285,t),a),22,48),BOOT);
    const cuff=addMerged(g,[surface((t,a)=>point(rows,.285-t*.029,a,.003),3,48)],FOLD,leather);cuff.name='artoria-knee-boot';
    edge(g,a=>point(rows,.285,a,.004),0x62545b,.0016);
    line(g,Array.from({length:18},(_,i)=>point(rows,-.217+i/17*.485,Math.PI,.002)),FOLD,.0013);
    // 발목의 부드러운 주름 — 정강이 판이 아니라 가죽 장화로 읽히게
    for(const y of [-.167,-.186])line(g,Array.from({length:9},(_,i)=>point(rows,y+.004*Math.cos(i/8*Math.PI),-.95+i/8*1.9,.002)),FOLD,.0012);
  }
  function foot(g){
    const geo=artoriaRoundedBox(.264,.078,.115,.027),p=geo.attributes.position;
    for(let i=0;i<p.count;i++){
      const toe=THREE.MathUtils.smoothstep(p.getX(i),.01,.132);
      p.setXYZ(i,p.getX(i)+toe*.014,p.getY(i)*(1-toe*.28),p.getZ(i)*(1-toe*.16));
    }
    geo.computeVertexNormals();main(g,geo,BOOT);g.children[0].material.roughness=.63;
    addMerged(g,[bake(artoriaRoundedBox(.255,.012,.112,.005),[.005,-.035,0]),
      bake(artoriaRoundedBox(.055,.023,.082,.008),[-.081,-.038,0])],0x19191e,leather);
  }
  function braidedHair(g,look){
    // 얼굴과 원래 앞머리 세 조각은 정확히 그대로 (사장님 '고유 앞머리는 그대로' — 샛별 쪽). 먼저 뒤 머리 덮개를 늘린다:
    // 땋음만으로는 옆에서 볼 때 뒤통수 아래가 비어 보였다
    const cap=g.children[4];
    if(cap?.isMesh){
      const geo=new THREE.SphereGeometry(.107,40,24,0,Math.PI*2,0,Math.PI*.84);
      const p=geo.attributes.position;
      for(let i=0;i<p.count;i++){
        const a=Math.atan2(p.getZ(i),p.getX(i)),t=Math.floor(i/41)/24;
        const rear=THREE.MathUtils.smoothstep(-Math.cos(a),0,.75);
        const theta=t*Math.PI*(.64+.20*rear-.23*Math.max(0,Math.cos(a)));
        p.setXYZ(i,.107*Math.sin(theta)*Math.cos(a),.107*Math.cos(theta),.107*Math.sin(theta)*Math.sin(a));
      }
      geo.computeVertexNormals();cap.geometry.dispose();cap.geometry=geo;
    }
    const oldHair=g.getObjectByName('artoria-hair');
    if(oldHair){g.remove(oldHair);oldHair.geometry.dispose();oldHair.material.dispose()}
    for(const child of [...g.children]){
      if(!child.isMesh||child.material?.color?.getHex()!==0x28797b)continue;
      child.geometry.computeBoundingBox();const box=child.geometry.boundingBox;
      const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
      if(Math.abs(center.x+.126)<.001&&Math.abs(center.y+.026)<.001&&Math.abs(size.z-.09)<.001){
        g.remove(child);child.geometry.dispose();child.material.dispose();
      }
    }
    const holder=new THREE.Group();holder.name='artoria-coronation-braids';g.add(holder);
    const fringe=[];
    for(const side of [-1,1])fringe.push(isoldeLock([[.015,.085,side*.055],[.087,.071,side*.06],[.106,.025,side*.082],[.081,-.023,side*.09]],[.052,.052,.035,.002],.015));
    fringe.push(isoldeLock([[.002,.099,-.01],[.084,.074,-.012],[.104,.037,.009]],[.045,.034,.003],.012));
    addMerged(holder,fringe,look.hair,{...CLOTH,roughness:.84});
    // 가늘게 쓸어 넘긴 결 — 이어진 머리 덮개가 모아 올린 머리로 읽히게. 두피 겉면에 놓여 땋은 올림머리 밑으로 사라진다
    const channels=[];
    for(const side of [-1,1])for(let row=0;row<8;row++){
      const pts=Array.from({length:25},(_,i)=>{
        const t=i/24,a=side*lerp(1.40,2.96,t),y=lerp(.065-row*.010,-.015-row*.008,t);
        const r=Math.sqrt(.107*.107-(y-.004)*(y-.004))+.0006;
        return [-.008+r*Math.cos(a),y,r*Math.sin(a)];
      });
      channels.push(taperedTube(pts,pts.map((_,i)=>.00065*Math.sin(Math.PI*(.1+.8*i/24))),36,4));
    }
    addMerged(holder,channels,new THREE.Color(look.hair).multiplyScalar(.87).getHex(),CLOTH);
    function plait(points,turns,startRadius,endRadius,backPlane=false){
      const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));
      const pieces=[];
      for(let strand=0;strand<3;strand++){
        const pts=[],radii=[];
        for(let i=0;i<=96;i++){
          const t=i/96,p=path.getPoint(t),tangent=path.getTangent(t).normalize();
          const n=backPlane?new THREE.Vector3(-1,0,0):new THREE.Vector3(p.x+.008,0,p.z);
          n.addScaledVector(tangent,-n.dot(tangent)).normalize();
          const across=new THREE.Vector3().crossVectors(tangent,n).normalize();
          const root=backPlane?1:lerp(.18,1,THREE.MathUtils.smoothstep(t,0,.12));
          const radius=lerp(startRadius,endRadius,t)*root,phase=t*Math.PI*2*turns+strand*Math.PI*2/3;
          p.addScaledVector(across,Math.sin(phase)*radius*.67);
          p.addScaledVector(n,Math.cos(phase*2)*radius*.33);
          pts.push(p.toArray());radii.push(radius*.74);
        }
        pieces.push(taperedTube(pts,radii,144,8));
      }
      addMerged(holder,pieces,look.hair,{...CLOTH,roughness:.84});
    }
    // 꽉 찬 작은 쪽진 머리가 뒤통수 아래를 덮는다. 머리 덮개와 겹쳐 — 장식 땋음이 빈 두피를 건너지 않아도 된다
    addMerged(holder,[bake(new THREE.SphereGeometry(1,28,20),[-.105,-.037,0],null,[.041,.058,.071])],look.hair,{...CLOTH,roughness:.84});
    for(const side of [-1,1]){
      // 양쪽에 서로 엮인 두 갈래: 금관 밑의 위 화관 땋음, 귀 뒤로 바짝 당겨 낮은 올림머리로 들어가는 아래 땋음
      plait([[.005,.070,side*.084],[-.038,.058,side*.094],[-.081,.043,side*.074],[-.111,.023,side*.043],[-.126,.010,0]],3.1,.013,.012);
      plait([[.008,.029,side*.101],[-.029,.003,side*.105],[-.070,-.025,side*.083],[-.103,-.058,side*.056],[-.129,-.075,side*.014]],3.2,.012,.013);
    }
    // 타원 화관 땋음과 접힌 땋음 둘이 올림머리 뒤를 채운다. 뒤쪽 고정 법선 — 타원 위 · 아래에서도 엮임이 흔들리지 않게
    const oval=Array.from({length:25},(_,i)=>{
      const a=i/24*Math.PI*2;return [-.133-.007*Math.cos(a),-.035+.047*Math.cos(a),.062*Math.sin(a)];
    });
    plait(oval,8,.013,.013,true);
    for(const side of [-1,1])plait([
      [-.148,.002,side*.018],[-.155,-.021,side*.035],[-.158,-.048,side*.026],
      [-.151,-.060,0],[-.151,-.036,-side*.018],[-.148,-.011,0],
    ],4,.011,.009,true);
    // 절제된 금빛 핀과 작은 진주 — 머리 모양을 예복 장신구와 잇는다
    const pins=[[-.129,.013,-.041],[-.129,.013,.041],[-.155,-.040,0]];
    addMerged(holder,pins.map(p=>bake(new THREE.SphereGeometry(.0048,10,8),p,null,[.5,1,1])),GOLD,{metalness:.4,roughness:.5});
    addMerged(holder,pins.map(p=>bake(new THREE.SphereGeometry(.0032,10,8),[p[0]-.0028,p[1],p[2]])),IVORY,CLOTH);
  }
  function crown(g){
    const holder=new THREE.Group();holder.name='artoria-lily-crown';g.add(holder);
    // 옆머리가 아니라 두개 덮개에 맞춘다. 사장님이 금관 전체를 작게 (샛별 쪽): 모든 비율을 그대로 72 % 로, 바닥은 덮개 위에 앉힌다
    holder.scale.setScalar(.72);holder.position.set(-.008,.025,0);
    // 절제된 광택 (사장님 '금관은 미세한 광택만' — 샛별 쪽 v4-alter13): 금빛 · 금속감은 그대로, 비스듬한 면의 반사만 조금 또렷하게 — 빛을 더하지 않는다
    const metal={metalness:.58,roughness:.35,steel:.66};
    const gold=0xb59a62,shade=0x897142,pearl=0xe4d8bd;
    const at=(a,y,r=.126)=>[Math.cos(a)*r,y,Math.sin(a)*r];
    const band=surface((t,a)=>at(a,.062+t*.030,.125+t*.003),4,64);
    addMerged(holder,[band],shade,{...metal,side:THREE.DoubleSide});
    const inlay=surface((t,a)=>at(a,.069+t*.015,.129),2,64);
    addMerged(holder,[inlay],0x402631,{...CLOTH,side:THREE.DoubleSide});
    for(const y of [.062,.091]){
      const pts=Array.from({length:97},(_,i)=>at(i/96*Math.PI*2,y,.13));
      addMerged(holder,[taperedTube(pts,pts.map(()=>.003),128,6)],gold,metal);
    }
    // 얇고 모서리를 깎은 백합 잎: 가운데는 높게, 옆 · 뒤는 낮게.
    // 창작한 궁정 금관 — 특정 역사 유물이라고 하지 않는다
    const angles=[0,.68,-.68,1.4,-1.4,2.15,-2.15,Math.PI];
    for(const a of angles){
      const front=Math.max(0,Math.cos(a)),height=.080+.055*front,width=.058+.012*front;
      const flower=new THREE.Shape();
      flower.moveTo(-.14,0);flower.lineTo(-.18,.22);
      flower.bezierCurveTo(-.52,.18,-.62,.52,-.42,.62);
      flower.bezierCurveTo(-.26,.59,-.24,.43,-.12,.40);
      flower.bezierCurveTo(-.30,.70,-.11,.86,0,1);
      flower.bezierCurveTo(.11,.86,.30,.70,.12,.40);
      flower.bezierCurveTo(.24,.43,.26,.59,.42,.62);
      flower.bezierCurveTo(.62,.52,.52,.18,.18,.22);
      flower.lineTo(.14,0);flower.closePath();
      const geo=new THREE.ExtrudeGeometry(flower,{depth:.035,bevelEnabled:true,bevelThickness:.018,bevelSize:.018,bevelSegments:2,steps:1,curveSegments:7});
      const pos=geo.attributes.position;
      for(let i=0;i<pos.count;i++){
        const u=pos.getX(i)*width,y=pos.getY(i)*height,n=pos.getZ(i)*width;
        pos.setXYZ(i,Math.cos(a)*(.129+n)-Math.sin(a)*u,.086+y,Math.sin(a)*(.129+n)+Math.cos(a)*u);
      }
      geo.computeVertexNormals();addMerged(holder,[geo],gold,metal);
      const stem=Array.from({length:12},(_,i)=>at(a,.094+i/11*(height-.018),.134));
      addMerged(holder,[taperedTube(stem,stem.map(()=>.0015),24,5)],shade,metal);
      addMerged(holder,[bake(new THREE.SphereGeometry(.0052,10,8),at(a,.088+height,.13))],pearl,{...CLOTH,roughness:.5});
      const setting=new THREE.Group();setting.position.fromArray(at(a,.078,.132));setting.rotation.y=-a;holder.add(setting);
      addMerged(setting,[bake(new THREE.SphereGeometry(.010,12,10),[0,0,0],null,[.35,1,.85])],gold,metal);
      addMerged(setting,[bake(new THREE.OctahedronGeometry(.0075,1),[.003,0,0],null,[.4,1,.82])],0x70313c,{metalness:.12,roughness:.34});
    }
    addMerged(holder,Array.from({length:32},(_,i)=>bake(new THREE.SphereGeometry(.0028,8,6),at(i/32*Math.PI*2,.092,.131))),pearl,CLOTH);
  }
  return {
    head(g,look){originalHead(g,look);braidedHair(g,look);crown(g)},chest,abdomen,pelvis,
    uarmS(g,l){limb(g,l,true)},uarmO(g,l){limb(g,l,true)},
    farmS(g,l){limb(g,l,false,true)},farmO(g,l){limb(g,l,false,true)},
    thighF(g,l){limb(g,l)},thighB(g,l){limb(g,l)},shinF:boot,shinB:boot,footF:foot,footB:foot,
  };
}
