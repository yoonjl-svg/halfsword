// 밤의 봉인의 중정 — 광기의 마야(samira_mad)의 무대 (샛별 저장소에서 가져옴 10/21 — 사장님 10/21 디자인 · 성능 리뷰 뒤 승인, docs/import/courtyard_night_2026-10-21.md).
// 낮 무대 stage_courtyard.js 를 바탕으로 한 밤 판(낮 파일은 그대로). 이야기: 봉인된 중정에서 평화 사절단의 비밀회담이 열렸다 → 명령서가 늦게 닿았다 →
//  잘못된 교전이 큰 전쟁으로 번졌다. 새벽 3 시, 포격에 무너진 사암 중정 · 검은 연기 기둥 셋 · 한쪽 지붕이 깨진 급수정에서 이따금 새는 물.
// 바닥 · 급수정 충돌체(9) · 시작 자리 · 결투 규칙은 낮 중정과 같다(arena_obstacle.js). 무너진 돌 · 연기는 결투장 · 카메라 둘레 밖에만(stage_courtyard_ruins_detail.js)
// 여정: 둘째 밤 묶음 밤의 산호 항구 다음 · 밤의 잠든 습지 앞 (17 번째 — stages.js STAGE_ORDER)
import * as THREE from 'three';
import { warGate, warArchitecture, ruinedPavilion, warTraces, blackWarSmoke } from './stage_courtyard_ruins_detail.js';
import { courtyardCoverTexture, COURTYARD_NAVIGATION } from './stage_courtyard_cover.js';
import { buildDamagedCourtyardCover, damagedCoverLeak } from './stage_courtyard_damaged_cover.js';
import { obstacleBlocksRay } from './arena_obstacle.js';
import { ARENA } from './config.js';
import { Kit, box, cyl, limb, canvasTex, rng } from './stage_kit.js';

// 낮 중정과 같은 장밋빛 · 황토 사암 (stage_courtyard.js) — 밤빛 · 그을음은 빛 · 바닥 무늬 · 꼭짓점 색이 맡는다
const P = { stone:0xc28d70, pale:0xd8ab8e, rose:0xa0634f, dark:0x5c4540,
  recess:0x5c4842, wood:0x553a30, iron:0x363130, rope:0x9a7a5e, cloth:0xc8883e, turmeric:0xcf9e4e, madder:0xa63a2e, seal:0x9e1f26 };
const WELL = { x:-21, z:-1, hx:8, hz:10, depth:6.25 };
// 배경 돌림 (10/17 목록 5): 배경 좌표의 서쪽(−x — 계단 우물 · 봉인된 문)이 마야 뒤(세상 +x)에 오게 반 바퀴. 전 −π/2(북쪽 큰 문이 마야 뒤)
const TURN = Math.PI;
const toWorld = (x, z) => [x * Math.cos(TURN) + z * Math.sin(TURN), -x * Math.sin(TURN) + z * Math.cos(TURN)];
const toLocal = (x, z) => [x * Math.cos(TURN) - z * Math.sin(TURN), x * Math.sin(TURN) + z * Math.cos(TURN)];
// 큰 문의 자리 (목록 5): 북쪽 회랑 가운데(0, −24.4 · 남쪽을 봄)에 있던 문루 · 자로카 · 차트리를 그대로 들어 계단 우물 너머 서쪽 담(−35.6, −1 · 동쪽을 봄)에 둔다
const GATE = { pos: [-11.2, 0, -1], turn: Math.PI / 2 };
const gateToLocal = (x, y, z) => [x * Math.cos(GATE.turn) + z * Math.sin(GATE.turn) + GATE.pos[0], y, -x * Math.sin(GATE.turn) + z * Math.cos(GATE.turn) + GATE.pos[2]];
// 달 (밤 판): 낮 해와 같은 방위(세상에서 판 시작 카메라의 뒤 · 오른쪽 — 내 등 · 마야 앞 · 문루 · 계단 우물 먼 벽이 빛을 받는다)에 높이 38° · 차가운 회청빛 0.7.
//  해보다 높아 급수정 그림자가 낮보다 짧다(두 사람 시작 자리 밖). 하늘의 달 원판도 이 방향에 둔다(buildCourtyardNight)
const SUN = { elevationDeg: 38, toward: [-0.88, 0.47], dist: 20, color: 0xb6bdc9, intensity: .7 };
const SUN_EL = THREE.MathUtils.degToRad(SUN.elevationDeg);
const SUN_W = (() => { const [a, b] = SUN.toward, n = Math.hypot(a, b); return new THREE.Vector3(Math.cos(SUN_EL) * a / n, Math.sin(SUN_EL), Math.cos(SUN_EL) * b / n); })(); // 세상: 땅 → 해 단위 벡터
// 하늘 · 안개 · 반구광 (밤 판): 새벽 3 시 — 검푸른 하늘 꼭대기 · 연기 너머 흐린 지평선 · 낮보다 먼 안개(44 ~ 180 m — 결투장 둘레의 무너진 건물이 읽히게)
const SKY = { horizon: 0x181c25, zenith: 0x03050b, glow: 0x333c49, below: 0x15171c, fog: 0x252833, fogNear: 44, fogFar: 180, hemiSky: 0x788494, hemiGround: 0x302c2c, hemi: .65 };
// 바람: 낮 중정과 같은 방향(마야 뒤에서 화면 오른쪽 아래로 — 세상 방향) · 같은 돌풍 때(9~17 s 마다 3.8~5.4 s, 세기 곡선 sin²). 밤에는 땅 먼지를 옅게(update)
const WIND_W = (() => { const n = Math.hypot(-0.6, 0.8); return { x: -0.6 / n, z: 0.8 / n }; })();
const WIND_L = (() => { const [x, z] = toLocal(WIND_W.x, WIND_W.z); return { x, z }; })();
const GUST = { first: 4, gapMin: 9, gapRand: 8, durMin: 3.8, durRand: 1.6, fogNear: 8, fogFar: 45 }; // 돌풍 한가운데 안개가 이만큼(m) 가까워진다 — 결투장 띠(9.2 m) 밖만
// 땅을 스치는 모래 줄 (목록 7): 무릎 아래 낮은 띠라 싸움 읽기를 가리지 않는다. 투명 = 잔잔할 때 calm · 돌풍 한가운데 calm + gust [사장님 확인 전]
const STREAKS = { n: 44, radius: 17, calm: 0.05, gust: 0.3, speedCalm: 0.6, speedGust: 6.5 };
// 이 무대 전용 그림자 상자 — 낮 중정 값 그대로(까닭은 stage_courtyard.js SHADOW). 급수정만 달그림자를 드리운다 · 받는 것(바닥 · 띠)은 드리우지 않아 bias 0.
//  낮의 해(20°)보다 달이 높아(38°) 같은 상자에 그림자가 넉넉히 든다. 지도 1024² · snap: 그림자 가장자리가 기어다니지 않게
const SHADOW = { left: -11, right: 11, top: 7.5, bottom: -6.5, near: SUN.dist - 17, far: SUN.dist + 17, mapSize: 1024, bias: 0, normalBias: 0, snap: true };
// 그늘에 든 몸 (낮 중정과 같은 셈): 몸 점에서 달 쪽으로 쏜 광선 넷(가운데 + 0.025 rad 둘레 — 부드러운 가장자리)이 급수정에 막힌 몫만큼 달빛을 덜 받는다
const SHADE_RAYS = (() => {
  const u = new THREE.Vector3(0, 1, 0).cross(SUN_W).normalize(), v = SUN_W.clone().cross(u).normalize();
  return [[0, 0], [0.025, 0], [-0.025, 0], [0, 0.025]].map(([a, b]) => SUN_W.clone().addScaledVector(u, a).addScaledVector(v, b).normalize());
})();

// 바닥 무늬는 모두 미터 단위로 놓고 한 번 구워 둔다. 밤 판은 낮의 해 그늘 대신 그을음 · 포탄 자국을 굽는다(급수정은 실제 그림자 — 굽지 않는다)
function stoneTexture() {
  const r=rng(161017);
  return canvasTex(512,512,(c,w,h)=>{
    c.fillStyle='#e2d3c4';c.fillRect(0,0,w,h);
    for(let row=0;row<8;row++)for(let col=-1;col<5;col++){
      const x=col*128+(row%2)*64,y=row*64;
      c.fillStyle=`rgba(112,74,52,${.025+r()*.055})`;c.fillRect(x+1,y+1,126,62);
      c.fillStyle='rgba(64,40,30,.15)';c.fillRect(x,y,128,1.6);c.fillRect(x,y,1,64);
      c.fillStyle='rgba(255,238,220,.15)';c.fillRect(x+1,y+2,125,1);
    }
    for(let i=0;i<3000;i++){
      c.fillStyle=`rgba(92,60,44,${.025+r()*.07})`;
      c.fillRect(r()*w,r()*h,1+r()*7,.5+r()*1.2);
    }
  });
}
// 급수정 겉의 그을음 · 금 — 무늬만 바꾼다(치수 · 충돌 꼴은 낮과 같다)
function scarredCoverTexture(){
  const t=courtyardCoverTexture(),c=t.image.getContext('2d'),r=rng(211032);
  for(let i=0;i<9;i++){
    const x=r()*512,y=r()*512,rad=35+r()*95,g=c.createRadialGradient(x,y,0,x,y,rad);
    g.addColorStop(0,'rgba(24,22,22,.32)');g.addColorStop(1,'rgba(24,22,22,0)');c.fillStyle=g;c.fillRect(x-rad,y-rad,rad*2,rad*2);
  }
  for(let i=0;i<5;i++){
    let x=r()*512,y=r()*512;c.strokeStyle='rgba(45,35,30,.40)';c.lineWidth=1.1;c.beginPath();c.moveTo(x,y);
    for(let j=0;j<4;j++){x+=(r()-.55)*38;y+=12+r()*18;c.lineTo(x,y);}c.stroke();
  }
  t.needsUpdate=true;return t;
}
function pavingTexture() {
  // 1536² → 1024² (10/17 목록 8 — 리뷰: 같은 카메라 · 폰 배율 2 에서 화소 차 0.3~0.4 %, GPU 약 7 MB 덜함)
  const r=rng(161018),N=1024,unit=N/80;
  const tex=canvasTex(N,N,(c,w,h)=>{
    c.fillStyle='#a8806a';c.fillRect(0,0,w,h);
    c.translate(w/2,h/2);c.scale(unit,unit);
    const poly=(pts,color)=>{c.beginPath();pts.forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.closePath();c.fillStyle=color;c.fill();};
    // 사람 크기의 고르지 않은 장밋빛 · 황토 사암 판석 — 거대한 네모 바닥 타일이 아니다 (10/17: 빛깔 31~38° → 16~24° · 채도 23~30 % · 밝기 64~73 % → 56~64 % — 빛을 줄여 화면 바닥은 더 어둡다)
    for(let row=-60;row<61;row++){
      const z=row*.66;let x=-41+(row%2)*.5;
      while(x<41){
        const width=.72+r()*.56,ch=.035+r()*.07;
        poly([[x+.025,z+.02],[x+width-.025,z+.02],[x+width-.02,z+.61-ch],[x+width-ch,z+.63],[x+.02,z+.62]],`hsl(${16+r()*8},${23+r()*7}%,${56+r()*8}%)`);
        if(r()<.13){c.strokeStyle='rgba(70,44,34,.22)';c.lineWidth=.014;c.beginPath();c.moveTo(x+width*.22,z);c.lineTo(x+width*.45,z+.2);c.lineTo(x+width*.38,z+.4);c.stroke();}
        x+=width;
      }
    }
    // 좁은 띠돌이 우물 · 회랑 문턱의 윤곽을 그린다 — 솟은 충돌 턱 없음. 바람이 벽 가까운 이음매를 메우고 가운데는 읽히게 둔다
    for(const [x,z,ww,dd]of [[-12.5,-1,.32,21],[-21,-11.5,17,.32],[-21,9.5,17,.32],[0,-20.6,55,.35],[23.9,0,.35,40],[-31.6,-1,.32,21]]){
      c.fillStyle='rgba(116,74,54,.3)';c.fillRect(x-ww/2,z-dd/2,ww,dd);
    }
    for(let i=0;i<140;i++){
      const x=-34+r()*66,z=-29+r()*54;
      if(Math.hypot(x,z)<10&&r()<.9)continue;
      const rad=.7+r()*2.4,g=c.createRadialGradient(x,z,0,x,z,rad);
      g.addColorStop(0,'rgba(204,150,102,.4)');g.addColorStop(1,'rgba(204,150,102,0)');c.fillStyle=g;c.fillRect(x-rad,z-rad,rad*2,rad*2);
    }
    // 남쪽 들머리에서 계단 우물 북쪽 가를 돌아 봉인된 문 앞 너른 단으로 이어지는 닳은 길 · 물가로 가는 갈래
    c.lineCap='round';c.lineJoin='round';
    for(const [alpha,width]of [[.045,3.6],[.06,1.9]]){
      c.strokeStyle=`rgba(226,180,144,${alpha})`;c.lineWidth=width;
      c.beginPath();c.moveTo(8,26);c.bezierCurveTo(7,8,-2,-10,-13,-13.4);c.bezierCurveTo(-20,-13.6,-27,-13.4,-30.6,-9);c.quadraticCurveTo(-31.8,-5,-31.8,-1);c.stroke();
      c.beginPath();c.moveTo(6,8);c.quadraticCurveTo(-2,5,-12,6);c.stroke();
    }
    // 갓 생긴 그을음과 사방으로 튄 돌 조각 자국 — 포탄이 떨어진 자리(낮의 해 그늘은 그리지 않는다). 결투장 안 둘은 무늬만 — 바닥은 평평하다
    //  k: 짙기 — 결투장 안 둘은 절반(10/21 리뷰: 경기 화면에서 짙은 둥근 얼룩이 떠 있는 물체의 그림자처럼 보였다)
    for(const [x,z,rad,k=1]of [[-10.4,-15.5,2.6],[-11.1,9.2,2.7],[12.1,-9.5,2.2],[16.2,-24.4,4.4],[27.1,13,4.2],[-33.2,-4.4,4.6],[4,-4.5,1.6,.5],[-3,5,1.4,.5]]){
      const g=c.createRadialGradient(x,z,.25,x,z,rad);g.addColorStop(0,`rgba(24,20,19,${.68*k})`);g.addColorStop(.45,`rgba(46,33,27,${.4*k})`);g.addColorStop(1,'rgba(40,33,28,0)');c.fillStyle=g;c.fillRect(x-rad,z-rad,rad*2,rad*2);
      for(let i=0;i<14;i++){const a=i/14*Math.PI*2,rr=rad*(.5+r()*.7);c.strokeStyle='rgba(39,29,24,.42)';c.lineWidth=.025+r()*.025;c.beginPath();c.moveTo(x+Math.cos(a)*.4,z+Math.sin(a)*.4);c.lineTo(x+Math.cos(a+.05)*rr,z+Math.sin(a+.05)*rr);c.stroke();}
    }
    for(const [x,z,rad]of [[-12.15,5.6,.6],[-11.8,6.65,.48],[-10.3,2.4,.6]]){
      const g=c.createRadialGradient(x,z,0,x,z,rad);g.addColorStop(0,'rgba(44,30,28,.42)');g.addColorStop(1,'rgba(44,30,28,0)');c.fillStyle=g;c.fillRect(x-rad,z-rad,rad*2,rad*2);
    }
  });
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;return tex;
}
function arch(K,x,y,z,w,h,depth=.55,color=P.pale) {
  // 내쌓기 여러 잎 아치: 짧은 아치 받침과 살짝 물결진 꼭대기
  K.put('stone',box(.28,h*.55,depth),color,[x-w/2-.12,y+h*.275,z]);
  K.put('stone',box(.28,h*.55,depth),color,[x+w/2+.12,y+h*.275,z]);
  for(let i=0;i<20;i++){
    const a=Math.PI*i/20,b=Math.PI*(i+1)/20,mid=(a+b)/2;
    const yy=Math.sin(mid)*h*.45+h*.55;
    const scallop=.035*Math.cos(mid*10);
    K.put('stone',box(w*Math.PI/40+.055,.23,depth),color,
      [x+Math.cos(mid)*(w/2+scallop),y+yy,z],[0,0,Math.atan2(h*.45*Math.cos(mid),-w*.5*Math.sin(mid))],1,{vary:.06,noise:.02});
  }
}
function column(K,x,y,z,h=4.4) {
  K.put('stone',box(.84,.27,.84),P.pale,[x,y+.135,z]);
  K.put('stone',cyl(.22,.29,h-.65,8),P.stone,[x,y+h/2,z]);
  K.put('stone',box(.52,.18,.52),P.rose,[x,y+h-.55,z]);
  K.put('stone',box(.92,.25,.92),P.pale,[x,y+h-.27,z]);
  for(const sign of [-1,1])K.put('stone',box(.62,.22,.34),P.stone,[x+sign*.36,y+h-.55,z],[0,0,-sign*.48]);
}
function pavilion(K,x,y,z,scale=1) {
  K.push([x,y,z],0,scale);
  for(const xx of [-1.1,1.1])for(const zz of [-1.1,1.1])column(K,xx,0,zz,2.6);
  K.put('stone',box(3.2,.22,3.2),P.pale,[0,2.65,0]);
  K.put('stone',new THREE.SphereGeometry(1.55,12,6,0,Math.PI*2,0,Math.PI/2),P.rose,[0,2.75,0],[0,0,0],[1,.68,1]);
  K.put('stone',cyl(.08,.24,.45,8),P.pale,[0,3.98,0]);
  K.pop();
}
/** 포격에 부서진 큰 문루 (문 좌표 — 낮 중정처럼 남쪽을 보던 자리로 적고 GATE 로 옮겨 놓는다): 무너진 탑 · 부러진 문짝 · 남은 자로카 하나 (warGate) */
function gatehouse(K) { warGate(K,P,{arch}); }
function architecture(K) {
  // 부서진 문짝에 남은 붉은 봉인 천 두 자락 · 깨진 밀랍 한 조각 (문 좌표) — 비밀회담을 닫아 두었던 봉인
  K.push(GATE.pos,GATE.turn);gatehouse(K);
  K.put('cloth',box(.17,2.1,.035),0x6e2428,[-1.4,2.3,-22.36],[0,0,-.5]);
  K.put('cloth',box(.17,1.7,.035),0x7b282b,[-.65,1.8,-22.36],[0,0,.55]);
  K.put('seal',cyl(.3,.3,.07,12),0x7c242b,[-.9,2.0,-22.31],[Math.PI/2,0,.15]);K.pop();
  warArchitecture(K,P,{column,arch,room,pavilion});
}
/** 북쪽 회랑 한 칸 뒤의 방: 안벽 · 문설주 · 상인방 · 문짝 · 문살 · 디딤돌 */
function room(K,xx,odd) {
  K.put('interior',box(3.7,3.9,.18),0x987260,[xx,2.15,-27.72]);
  for(const dx of [-1.35,1.35])K.put('stone',box(.95,3.9,.5),P.stone,[xx+dx,2.15,-26.2]);
  K.put('stone',box(3.7,.95,.5),P.stone,[xx,3.72,-26.2]);
  K.put('wood',box(1.4,2.6,.14),odd?0x755041:0x493832,[xx,.18+1.3,-27.55]);
  for(let k=0;k<5;k++)K.put('wood',box(.018,2.5,.03),0x392a25,[xx-.56+k*.28,1.48,-27.46]);
  K.put('stone',box(1.85,.16,1.8),P.pale,[xx,.26,-26.5]);
}
function surroundings(K) {
  const r=rng(161022);
  // 담장 밖으로 충적지와 낮은 바위 어깨가 이어진다
  for(let i=0;i<36;i++){
    const a=i/36*Math.PI*2,rad=69+r()*85;
    K.put('earth',new THREE.SphereGeometry(1,9,4,0,Math.PI*2,0,Math.PI/2),i%3?0xa47c62:0x987260,
      [Math.cos(a)*rad,-.12,Math.sin(a)*rad],[0,r()*6.28,0],[11+r()*22,1.3+r()*5,9+r()*18],{rough:.1,vary:.13});
  }
  // 열린 들머리에서 같은 높이로 나가는 옅고 고르지 않은 대상 길
  for(let j=0;j<27;j++){
    const z=26+j*2.7,x=8+Math.sin(j*.14)*7;
    K.put('road',new THREE.CircleGeometry(4.2+r()*.8,9),0xc39a78,[x,-.075,z],[-Math.PI/2,0,r()*6.28],[1,1.55,1],{vary:.035,noise:.02});
    if(j<26)for(const side of [-1,1]){
      const nextX=8+Math.sin((j+1)*.14)*7+side*1.35,xx=x+side*1.35;
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([xx-.055,-.068,z,xx+.055,-.068,z,nextX+.055,-.068,z+2.7,xx-.055,-.068,z,nextX+.055,-.068,z+2.7,nextX-.055,-.068,z+2.7],3));g.setIndex([0,2,1,3,5,4]);g.computeVertexNormals();
      K.put('road',g,0xab8a6e);
    }
  }
  // 담 밖 땅 위에 낮은 집 몇 채 — 사람 크기의 눈금이자 공용 우물 안뜰이 있는 까닭. 떠 있는 배경 건물 벽 없음
  for(const [x,z,w,d,h]of [[-46,-37,9,8,4.6],[-57,-42,12,8,3.7],[-43,37,10,9,3.8],[37,47,8,7,3.1],[47,54,11,9,4.3],[-49,14,8,6,3.2]]){
    K.put('stone',box(w,h,d),0xa97c60,[x,h/2-.1,z], [0,0,0],1,{rough:.045});
    K.put('stone',box(w+.5,.3,d+.5),P.pale,[x,h,z]);
    for(const side of [-1,1])K.put('shade',box(.7,1,.06),0x56403a,[x+side*w*.23,h*.65,z+d/2+.04]);
    K.put('wood',box(1.4,2,.09),0x5e4234,[x,1,z+d/2+.06]);
  }
  // 돌무더기 · 마른 덤불은 담장 바깥 발치에 — 결투 원판 위가 아니다. 흩는 자리는 고정된 난수라 늘 같다
  for(let i=0;i<68;i++){
    const side=i%2?-1:1,x=side*(36+r()*18),z=-32+r()*70;
    K.put('earth',new THREE.DodecahedronGeometry(.15+r()*.38,0),0xb48a6c,[x,.05,z],[r(),r()*6.28,r()],[1.5,.6,1],{vary:.17});
    if(i%4===0)for(let k=0;k<4;k++)limb(K,'wood',[x,0,z],[x+(r()-.5)*.7,.4+r()*.45,z+(r()-.5)*.7],.025,.007,0x7f6a50);
  }
}
/** 우물 두레박 틀 (낮 중정 workingYard 의 그 부분만 — 밤엔 물구유 · 손수레 · 그늘나무 자리를 포격 자국이 대신한다): 가장자리에 선 기둥 둘과
 *  우물 쪽으로 내민 팔 · 도르래 — 두레박 줄(buildCourtyardNight 의 rope)이 허공에서 시작하지 않게 */
function wellFrame(K) {
  for(const z of [1.15,2.85])limb(K,'wood',[-12.85,0,z],[-12.85,2.55,z],.075,.06,P.wood);
  K.put('wood',box(.16,.16,2.0),P.wood,[-12.85,2.5,2.0]);
  K.put('wood',box(1.75,.13,.13),P.wood,[-13.65,2.48,2.0]);
  K.put('iron',new THREE.TorusGeometry(.12,.03,5,12),P.iron,[-14.1,2.36,2.0],[0,Math.PI/2,0]);
}

function stepwell(K) {
  const {x,z,hx,hz}=WELL;
  // 네모난 단 넷 — 꺾이는 계단이 층계참 사이를 내려간다. 그린 구멍이 아니라 모든 디딤판 · 물 · 아래 회랑이 실제 메쉬
  for(let level=0;level<4;level++){
    const y=-level*1.55,a=hx-level*1.35,b=hz-level*1.35;
    const stone=level<2?P.stone:0x7a8478;
    for(const side of [-1,1]){
      K.put('stone',box(.68,.22,b*2),P.pale,[x+side*a,y-.11,z]);
      K.put('stone',box(a*2,.22,.68),P.pale,[x,y-.11,z+side*b]);
      K.put('stone',box(.4,1.55,b*2),stone,[x+side*(a-.14),y-.9,z]);
      K.put('stone',box(a*2,1.55,.4),stone,[x,y-.9,z+side*(b-.14)]);
      // 나란히 꺾이는 계단 — 바오리 특유의 각진 리듬
      for(let flight=0;flight<3;flight++)for(let step=0;step<8;step++){
        const sy=y-(step+1)*1.55/8,sh=1.55-(step+1)*1.55/8+.22,dir=(flight+level)%2?1:-1;
        const zz=z+(flight-1)*(b*.62)+dir*(step-3.5)*.27;
        K.put('stone',box(1.12,sh,.29),step%3?stone:P.pale,[x+side*(a-.78),sy-sh/2,zz]);
      }
      for(let step=0;step<8;step++){
        const sy=y-(step+1)*1.55/8,sh=1.55-(step+1)*1.55/8+.22;
        K.put('stone',box(a*2-2.7,sh,.18),stone,[x,sy-sh/2,z+side*(b-.45-step*.13)]);
      }
      // 드러난 깊은 돌에 남은 물때 자국
      K.put('shade',box(.025,.14,b*2-.4),0x63705f,[x+side*(a-.36),y-1.18,z]);
    }
  }
  // 먼 벽의 쑥 들어간 아래 아케이드 — 이제 마야 뒤(경기 화면) 계단 우물 너머로 맨 윗단이 보인다
  for(let level=0;level<3;level++)for(let bay=-2;bay<=2;bay++){
    K.push([x-hx-.25,-level*1.65,z+bay*3.5],Math.PI/2);
    K.put('shade',box(2.8,1.5,.08),P.recess,[0,-.75,0]);
    arch(K,0,-1.5,.15,1.8,1.35,.25,0x9d8274);K.pop();
  }
  // 우물 너머 너른 단의 두 귀퉁이 차트리 — 가운데의 봉인된 문루를 양쪽에서 감싼다 (10/17: 문루 앞을 막던 정자 하나를 두 귀퉁이로). 꼭대기에 붉은 깃발 깃대
  pavilion(K,-31.3,0,-9.6,1.05);
  ruinedPavilion(K,P,-31.3,7.6,1.05);
  // 우물 가까운 북쪽 귀퉁이에도 작은 차트리 — 경기 화면에서 마야 오른쪽으로 우물의 네모를 짚어 준다(구멍은 낮은 카메라에서 잘 안 보인다).
  //  남쪽 귀퉁이는 비운다: 판 시작 화면에서 급수정 바로 뒤에 겹쳐 붐볐다(리뷰 §2-3 의 '급수정 뒤 돔')
  ruinedPavilion(K,P,-11.6,-12.4,.9);
  // 먼 쪽 가장자리에만 부서진 난간 — 들머리 쪽은 눈에 열려 있게
  for(const zz of [-8,-4,3,7]){
    K.put('stone',box(.55,.9,.55),P.pale,[x-hx,.45,z+zz]);
    K.put('stone',box(.2,.2,2.9),P.stone,[x-hx,.75,z+zz+1.4]);
  }
}
function clayJar(K,x,y,z,s=1,tilt=0) {
  K.push([x,y,z],0,s);
  const points=[[.13,0],[.27,.08],[.36,.32],[.34,.54],[.22,.67],[.17,.7],[.17,.8],[.22,.83]].map(p=>new THREE.Vector2(...p));
  K.put('pot',new THREE.LatheGeometry(points,10),0x956650,[0,0,0],[0,0,tilt]);
  K.put('shade',cyl(.16,.16,.008,10),0x3d2e2a,[0,.79,0]);K.pop();
}
function traces(K) {
  // 서늘한 우물로 서둘러 떠난 흔적 — 사람으로 붐비는 장터가 아니다 (10/17: 바닥에서 2 cm 뜬 항아리 · 가방을 바닥에 붙임)
  clayJar(K,-12.15,0,5.6,1.15);clayJar(K,-11.8,0,6.65,.85);
  clayJar(K,-13.25,-.2,7.5,.65,.7);
  for(const [x,z,a] of [[-11.1,7.2,.3],[-10.7,7.65,-.2],[-12.0,8.6,.8]]){
    K.put('wood',new THREE.SphereGeometry(1,8,4),0x534034,[x,.06,z],[0,a,0],[.11,.055,.25]);
    limb(K,'rope',[x-.08,.13,z],[x+.08,.13,z+.07],.025,.025,0x8c6c54);
  }
  // 닳은 전령 가방과 누가 봐도 붉은 밀랍 두 조각 — 글 판은 없다. 10/17: 봉인된 문 앞(20 m 밖)에서 결투장 띠 가까이 우물가(약 10.5 m)로 옮김
  K.push([-15.2,0,23.2]);
  K.put('wood',box(.62,.34,.46),0x70443b,[4.9,.17,-20.8],[0,.28,0],1,{rough:.035});
  K.put('wood',box(.64,.045,.28),0x805649,[4.92,.35,-20.72],[.15,.28,0]);
  K.put('iron',box(.08,.09,.035),0x9f875d,[4.88,.23,-20.56]);
  for(let i=0;i<12;i++){
    const a=Math.PI*i/12,b=Math.PI*(i+1)/12;
    limb(K,'rope',[4.9+Math.cos(a)*.38,.16+Math.sin(a)*.28,-21.03],[4.9+Math.cos(b)*.38,.16+Math.sin(b)*.28,-21.03],.02,.02,0x4d3730);
  }
  K.put('cloth',box(.46,.016,.3),0xccb8a0,[4.5,.008,-20.25],[0,-.35,0]);
  for(const [x,z]of [[4.52,-20.22],[4.84,-20.1]])K.put('wax',cyl(.065,.075,.025,6),0x942e31,[x,.03,z]);
  // 부서진 밀랍 가장자리와 눌린 자국 — 흩어진 동전과 갈린다
  for(const [xx,zz]of [[4.52,-20.22],[4.84,-20.1]]){
    K.put('wax',box(.018,.008,.072),0x652729,[xx,.046,zz],[0,.4,0]);
    K.put('wax',box(.063,.008,.013),0x652729,[xx,.046,zz],[0,.4,0]);
    K.put('wax',cyl(.024,.029,.018,3),0x9d3a35,[xx+.09,.009,zz+.02],[0,.7,0]);
  }
  K.pop();
}
/** 격자 천(PlaneGeometry — 차양 · 깃발)의 꼭짓점 법선을 이웃 꼭짓점의 차이로 바로 셈한다 (객체를 만들지 않음).
 *  10/21 리뷰: 프레임마다 부르던 computeVertexNormals 가 이 무대 update 가비지의 대부분이었다(힙 표본) — 모양 · 빛은 같다 */
function gridNormals(geometry) {
  const {widthSegments:gx,heightSegments:gy}=geometry.parameters,p=geometry.attributes.position.array,n=geometry.attributes.normal.array,row=gx+1;
  for(let iy=0;iy<=gy;iy++)for(let ix=0;ix<=gx;ix++){
    const r=(iy*row+(ix<gx?ix+1:ix))*3,l=(iy*row+(ix>0?ix-1:ix))*3,u=((iy>0?iy-1:iy)*row+ix)*3,d=((iy<gy?iy+1:iy)*row+ix)*3,o=(iy*row+ix)*3;
    // 가로(+x) × 세로(+y — 격자 줄 번호가 커질수록 y 가 작아진다) = 앞(+z)
    const ax=p[r]-p[l],ay=p[r+1]-p[l+1],az=p[r+2]-p[l+2],bx=p[u]-p[d],by=p[u+1]-p[d+1],bz=p[u+2]-p[d+2];
    const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx,k=1/(Math.sqrt(nx*nx+ny*ny+nz*nz)||1);
    n[o]=nx*k;n[o+1]=ny*k;n[o+2]=nz*k;
  }
  geometry.attributes.normal.needsUpdate=true;
}
/** 바람에 흔들리는 천: 기둥 둘 사이 밧줄에 매단 차양. yaw 로 돌려 우물가를 따라 세운다(10/17 — 기둥 하나가 계단 우물 구멍 위 허공에 서 있었다) */
function cloth(parent,x,y,z,width,length,phase,color,yaw=0) {
  const group=new THREE.Group();group.position.set(x,y,z);group.rotation.y=yaw;parent.add(group);
  const g=new THREE.PlaneGeometry(width,length,14,10);
  const m=new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(g,m);mesh.name='courtyard-wind-cloth';mesh.rotation.x=-Math.PI*.27;group.add(mesh);
  const mk=new Kit(5);
  limb(mk,'rope',[-width/2,.9,-1],[width/2,.9,-1],.025,.025,P.rope);
  for(const side of [-1,1])limb(mk,'rope',[side*width/2,-y,-1],[side*width/2,1,-1],.07,.055,P.wood);
  const posts=mk.mesh('rope',new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));group.add(posts);for(const geo of mk.bins.rope)geo.dispose();
  const rest=g.attributes.position.array.slice();return {group,mesh,rest,phase,length};
}
/** 차트리 꼭대기의 붉은 깃발 (10/17 목록 6 · 7): 바람이 화면에서 읽히는 표 — 돌풍 때 크게 나부낀다. 깃대 쪽 끝이 원점, 바람 아래로 뻗는다 */
function flag(parent,[x,y,z],yaw,size=1) {
  const len=2.0*size,g=new THREE.PlaneGeometry(len,1.25*size,12,6);g.translate(len/2,-.62*size,0);
  const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:P.madder,roughness:.95,side:THREE.DoubleSide}));
  mesh.name='courtyard-wind-flag';mesh.position.set(x,y,z);mesh.rotation.y=yaw;parent.add(mesh);
  return {mesh,rest:g.attributes.position.array.slice(),len};
}
/** 땅을 스치는 모래 줄 (목록 7): 바람 방향으로 눕힌 낮은 세로 띠 STREAKS.n 장(한 메쉬 · 꼭짓점 투명). 돌풍에 맞춰 빨라지고 진해진다 */
function sandStreaks(world,r) {
  const n=STREAKS.n,pos=new Float32Array(n*12),col=new Float32Array(n*16),uv=new Float32Array(n*8),idx=[];
  for(let i=0;i<n;i++){uv.set([0,0,1,0,1,1,0,1],i*8);idx.push(i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3);}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(col,4));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(idx);
  const map=canvasTex(128,32,(c,w,h)=>{
    const gx=c.createLinearGradient(0,0,w,0);gx.addColorStop(0,'rgba(255,255,255,0)');gx.addColorStop(.3,'rgba(255,255,255,1)');gx.addColorStop(.75,'rgba(255,255,255,.8)');gx.addColorStop(1,'rgba(255,255,255,0)');
    c.fillStyle=gx;c.fillRect(0,0,w,h);
    c.globalCompositeOperation='destination-in';
    const gy=c.createLinearGradient(0,h,0,0);gy.addColorStop(0,'rgba(0,0,0,1)');gy.addColorStop(.6,'rgba(0,0,0,.5)');gy.addColorStop(1,'rgba(0,0,0,0)');
    c.fillStyle=gy;c.fillRect(0,0,w,h);
  });
  map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map,vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  mesh.name='courtyard-sand-streaks';mesh.frustumCulled=false;world.add(mesh);
  // 밤 빛깔: 빛을 받지 않는 재질(MeshBasic)이라 낮 빛깔(0xe0ae80) 그대로면 어두운 바닥 위에서 빛나는 띠로 보였다(10/21 리뷰) — 밤 바닥보다 조금 밝은 정도로
  const tint=new THREE.Color(0x625850);
  const spawn=(s,anywhere)=>{
    // 바람 위쪽 반원에서 새로 들어온다 (처음에는 아무 데나). 계단 우물 구멍(세상 x 13~29 · z −9~11) 위는 건너뛴다
    for(let k=0;k<12;k++){
      const a=r()*Math.PI*2,d=STREAKS.radius*Math.sqrt(r());
      let x=Math.cos(a)*d,z=Math.sin(a)*d;
      if(!anywhere&&x*WIND_W.x+z*WIND_W.z>-STREAKS.radius*.3){x-=WIND_W.x*STREAKS.radius*1.2;z-=WIND_W.z*STREAKS.radius*1.2;}
      if(x>12.5&&x<29.5&&z>-9.5&&z<11.5)continue;
      Object.assign(s,{x,z,len:1.4+r()*2.4,h:.12+r()*.24,y:.015+r()*.05,speed:.7+r()*.6,age:anywhere?r()*3:0,life:2.2+r()*2.5});return s;
    }
    return Object.assign(s,{x:0,z:-STREAKS.radius,len:1.5,h:.15,y:.02,speed:1,age:0,life:3});
  };
  const items=Array.from({length:n},()=>spawn({},true));
  return {mesh,update(dt,gust){
    const v=STREAKS.speedCalm+(STREAKS.speedGust-STREAKS.speedCalm)*gust,alpha=STREAKS.calm+STREAKS.gust*gust;
    for(let i=0;i<n;i++){
      const s=items[i];
      s.age+=dt;s.x+=WIND_W.x*v*s.speed*dt;s.z+=WIND_W.z*v*s.speed*dt;
      if(s.age>s.life||s.x*s.x+s.z*s.z>(STREAKS.radius+4)**2)spawn(s,false);
      const fade=Math.sin(Math.PI*Math.min(1,s.age/s.life))**2,a=alpha*fade;
      const x0=s.x-WIND_W.x*s.len,z0=s.z-WIND_W.z*s.len;
      // 프레임마다 새 배열을 만들지 않고 버퍼에 바로 쓴다
      const o=i*12,top=s.y+s.h;
      pos[o]=x0;pos[o+1]=s.y;pos[o+2]=z0;pos[o+3]=s.x;pos[o+4]=s.y;pos[o+5]=s.z;pos[o+6]=s.x;pos[o+7]=top;pos[o+8]=s.z;pos[o+9]=x0;pos[o+10]=top;pos[o+11]=z0;
      for(let k=0,c=i*16;k<4;k++,c+=4){col[c]=tint.r;col[c+1]=tint.g;col[c+2]=tint.b;col[c+3]=a;}
    }
    g.attributes.position.needsUpdate=true;g.attributes.color.needsUpdate=true;
  }};
}

export function buildCourtyardNight(scene,{hemi,sun}) {
  const sunOffset={x:SUN_W.x*SUN.dist,y:SUN_W.y*SUN.dist,z:SUN_W.z*SUN.dist};
  scene.background=new THREE.Color(SKY.horizon);scene.fog=new THREE.Fog(SKY.fog,SKY.fogNear,SKY.fogFar);
  const fog=scene.fog;
  hemi.color.setHex(SKY.hemiSky);hemi.groundColor.setHex(SKY.hemiGround);hemi.intensity=SKY.hemi;
  sun.color.setHex(SUN.color);sun.intensity=SUN.intensity;sun.position.set(sunOffset.x,sunOffset.y,sunOffset.z);
  // 두 묶음: root = 배경 좌표(반 바퀴 돌림 TURN — 건물 · 우물 · 소품 · 천) · world = 세상 좌표(하늘 · 모래폭풍 · 먼지 · 모래 줄 — 해 · 바람 방향을 세상에서 바로 적는다)
  const root=new THREE.Group();root.name='courtyard-environment';root.rotation.y=TURN;scene.add(root);
  const world=new THREE.Group();world.name='courtyard-sky-and-wind';scene.add(world);
  const K=new Kit(161016),r=rng(161019);
  // 입력 꼴은 Kit 가 복사 · 합칠 동안만 잡아 둔다
  const raw=K.put.bind(K);K.put=(bin,g,color,pos,rot,scale,opt)=>{const result=raw(bin,g,color,pos,rot,scale,bin==='stone'?{uv:'box',uvScale:1/3,...opt}:opt);g.dispose();return result;};
  const {x,z,hx,hz}=WELL;
  // 판석은 담장 밑에서 끝난다. 흙은 그 밑으로 · 밖으로 거의 같은 높이로 이어진다 — 솟은 네모 판의 가장자리가 아니다
  const floorRects=[[-34,x-hx,-29,25],[x+hx,31,-29,25],[x-hx,x+hx,-29,z-hz],[x-hx,x+hx,z+hz,25]];
  // 긴 바닥 삼각형을 나눈다: 가깝게 비스듬히 보면 렌더러에서 늘어진 무늬 쐐기가 보였다 (CPU 광선 · UV 는 맞았는데도)
  for(const [x0,x1,z0,z1]of floorRects)K.put('floor',box(x1-x0,.16,z1-z0,Math.ceil((x1-x0)/3),1,Math.ceil((z1-z0)/3)),0xffffff,[(x0+x1)/2,-.08,(z0+z1)/2],[0,0,0],1,{vary:0,noise:0});
  for(const g of K.bins.floor){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+40)/80,(40-p.getZ(i))/80);}
  K.put('shade',box(16,.2,20),0x40534a,[x,-6.5,z]);
  for(const [x0,x1,z0,z1]of [[-210,-34,-210,210],[31,210,-210,210],[-34,31,-210,-29],[-34,31,25,210]])
    K.put('earth',box(x1-x0,.5,z1-z0),0xb08468,[(x0+x1)/2,-.35,(z0+z1)/2],[0,0,0],1,{vary:.025,noise:.015});
  architecture(K);stepwell(K);traces(K);surroundings(K);wellFrame(K);warTraces(K,P);
  // 급수정: 세상에서 늘 같은 방향(배경을 어떻게 돌려도 — 충돌체 COURTYARD_COVER_SHAPES · 시작 자리 · 총수 우회가 세상 좌표라서)
  K.push([0,0,0],-Math.PI/2-TURN);buildDamagedCourtyardCover(K,P);K.pop();
  for(let i=0;i<75;i++){
    const a=r()*Math.PI*2,rad=12+r()*22,px=Math.cos(a)*rad,pz=Math.sin(a)*rad;
    if(px<x-hx||px>30||pz<-28||pz>24||(px<x+hx&&pz>z-hz&&pz<z+hz))continue;
    K.put('sand',new THREE.CircleGeometry(.4+r()*1.4,7),0xc8946a,[px,.012,pz],[-Math.PI/2,0,r()*6.28],[1,.5+r()*.4,1],{vary:.1});
  }
  const stoneMap=stoneTexture();
  const materials={
    cover:new THREE.MeshStandardMaterial({vertexColors:true,color:0xc6b9af,map:scarredCoverTexture(),roughness:.95}),
    stone:new THREE.MeshStandardMaterial({vertexColors:true,map:stoneMap,roughness:1}),
    floor:new THREE.MeshStandardMaterial({vertexColors:true,map:pavingTexture(),roughness:.98}),
  };
  for(const name of ['wood','iron','rope','cloth','pot','wax','seal','sand','shade','earth','interior','road','foliage'])materials[name]=new THREE.MeshStandardMaterial({vertexColors:true,roughness:name==='iron'?.8:name==='wax'?.55:1,side:['cloth','pot'].includes(name)?THREE.DoubleSide:THREE.FrontSide});
  materials.sand.transparent=true;materials.sand.opacity=.14;materials.sand.depthWrite=false;
  for(const [bin,mat]of Object.entries(materials)){
    // 급수정만 달그림자를 드리운다(낮 중정 목록 3 과 같은 약속) — 받지는 않는다(bias 0 그림자 상자에서 제 그림자 여드름이 없게). 나머지는 받기만
    const mesh=K.mesh(bin,mat,{cast:bin==='cover',receive:bin!=='cover',light:bin==='stone'?(xx,yy,zz)=>{
      let d=Math.min(0,yy)*.07;
      if(yy>.2&&yy<4.5&&Math.abs(xx)<31&&zz<-21.7&&zz>-29)d-=.4*THREE.MathUtils.smoothstep(-zz,21.7,26.2);
      if(yy>.2&&yy<4.3&&xx>25.8&&Math.abs(zz)<22)d-=.36*THREE.MathUtils.smoothstep(xx,25.8,29.2);
      return [d,d,d*.92];
    }:null});
    if(mesh){mesh.name='courtyard-'+bin;root.add(mesh);}else mat.dispose();
    for(const g of K.bins[bin]??[])g.dispose();
  }
  // 새벽 3 시 하늘: 검푸른 꼭대기 · 연기 너머 흐린 지평선 · 달 쪽만 조금 밝게 (세상 좌표 — 달 방향 SUN_W 그대로)
  const skyGeo=new THREE.SphereGeometry(230,32,16),skyColors=[];
  const cH=new THREE.Color(SKY.horizon),cZ=new THREE.Color(SKY.zenith),cG=new THREE.Color(SKY.glow),cB=new THREE.Color(SKY.below),d=new THREE.Vector3(),col=new THREE.Color();
  for(let i=0;i<skyGeo.attributes.position.count;i++){
    d.fromBufferAttribute(skyGeo.attributes.position,i).normalize();
    if(d.y<0)col.copy(cH).lerp(cB,THREE.MathUtils.smoothstep(-d.y,0,.15));
    else{
      col.copy(cH).lerp(cZ,THREE.MathUtils.smoothstep(d.y,.02,.75));
      const s=Math.max(0,d.dot(SUN_W));col.lerp(cG,(.55*s**8+.22*s**2)*(1-.5*THREE.MathUtils.smoothstep(d.y,.1,.8)));
    }
    skyColors.push(col.r,col.g,col.b);
  }
  skyGeo.setAttribute('color',new THREE.Float32BufferAttribute(skyColors,3));
  const sky=new THREE.Mesh(skyGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false}));sky.name='courtyard-sky';world.add(sky);
  const moon=new THREE.Mesh(new THREE.SphereGeometry(2.3,16,10),new THREE.MeshBasicMaterial({color:0xa6acb3,fog:false}));moon.position.copy(SUN_W).multiplyScalar(185);moon.name='courtyard-moon';world.add(moon);
  const starPositions=[];
  for(let i=0;i<100;i++){const a=r()*Math.PI*2,y=.2+r()*.75,rad=Math.sqrt(1-y*y);starPositions.push(Math.cos(a)*rad*205,y*205,Math.sin(a)*rad*205);}
  const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
  const stars=new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0x8c929b,size:.14,transparent:true,opacity:.4,fog:false,depthWrite:false}));stars.name='courtyard-faint-stars';world.add(stars);
  const smoke=blackWarSmoke(root);
  const leak=damagedCoverLeak(world);
  const ring=new THREE.Mesh(new THREE.RingGeometry(ARENA.radius-.05,ARENA.radius+.07,96),new THREE.MeshStandardMaterial({color:0x9a6f5a,roughness:1,side:THREE.DoubleSide}));
  ring.name='courtyard-duel-boundary';ring.rotation.x=-Math.PI/2;ring.position.y=.014;ring.receiveShadow=true;world.add(ring);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(5.1,9.1,12,12),new THREE.MeshStandardMaterial({color:0x426c65,roughness:.7,metalness:.04}));
  water.name='courtyard-well-water';water.rotation.x=-Math.PI/2;water.position.set(x,-6.23,z);root.add(water);
  // 우물가에 남은 차양 한 자락 — 낮 중정의 차양 둘 가운데 하나가 그을린 채 작게 찢겨 남았다. 우물 가장자리를 따라 세워(yaw) 기둥이 구멍 위에 서지 않게
  const cloths=[cloth(root,-11.8,3.6,5.1,2.0,.9,0,0x765c41,Math.PI/2)]; // 기둥은 우물 가장자리 돌(x −12.8) 위 — 천 아랫단도 경기장 카메라 벽(10.5 m)에서 1 m 넘게 떨어진다
  // 찢긴 붉은 깃발 하나 — 우물 너머 성한 귀퉁이 차트리 꼭대기에 매달려 남았다(문루 깃발 · 다른 귀퉁이 깃대는 포격에 없어졌다). 바람 아래로 뻗는다
  const flagYaw=Math.atan2(-WIND_L.z,WIND_L.x);
  const banners=[flag(root,[-31.3,4.4,-9.6],flagYaw,.33)];
  // 바람이 천 · 먼지와 함께 두레박 줄 · 문 고리도 흔든다
  const rope=new THREE.Group();rope.name='courtyard-well-rope';rope.position.set(-14.1,2.32,2.0);
  const cord=new THREE.Mesh(cyl(.018,.018,7.9,6),new THREE.MeshStandardMaterial({color:P.rope,roughness:1}));cord.position.y=-3.95;rope.add(cord);
  const bucket=new THREE.Mesh(cyl(.20,.15,.33,8,true),new THREE.MeshStandardMaterial({color:0x584638,side:THREE.DoubleSide,roughness:.9}));bucket.position.y=-7.85;rope.add(bucket);root.add(rope);
  const gateRing=new THREE.Mesh(new THREE.TorusGeometry(.16,.028,6,16),new THREE.MeshStandardMaterial({color:0x74604d,metalness:.6,roughness:.7}));gateRing.name='courtyard-gate-ring';
  gateRing.position.set(...gateToLocal(.4,1.65,-22.18));gateRing.rotation.y=GATE.turn;root.add(gateRing);
  // 땅 먼지 (세상 좌표 — 바람 WIND_W 를 따라). 밤: 빛을 받지 않는 점이라 모래 줄처럼 빛깔을 어둡게(0x6e6052 — 낮 0xd8a878) · 투명도도 낮보다 옅게(update)
  const dustN=90,dustData=[],dustPos=new Float32Array(dustN*3);
  for(let i=0;i<dustN;i++)dustData.push({x:r()*66-31,z:r()*54-25,y:.04+r()*.20,speed:1+r()*2.5,phase:r()*6.28});
  const dustMap=canvasTex(64,64,(c,w,h)=>{const a=c.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);a.addColorStop(0,'rgba(226,186,140,.32)');a.addColorStop(.45,'rgba(226,186,140,.14)');a.addColorStop(1,'rgba(226,186,140,0)');c.fillStyle=a;c.fillRect(0,0,w,h);});
  dustMap.wrapS=dustMap.wrapT=THREE.ClampToEdgeWrapping;
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));
  const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({map:dustMap,color:0x6e6052,size:3.5,opacity:.18,transparent:true,depthWrite:false}));dust.name='courtyard-ground-dust';dust.frustumCulled=false;world.add(dust);
  const streaks=sandStreaks(world,rng(161028));
  // 이야기 묶음 (다른 밤 무대처럼 '<무대 id>-story' — 보이는 것은 없고 점검 도구가 읽는다)
  const story=new THREE.Group();story.name='courtyard_night-story';story.userData={hour:3,visualOnly:true,well:{...WELL},gate:gateToLocal(0,0,-22.3),clearRadius:ARENA.radius,
    stories:['봉인된 문 안에서 평화 사절단의 비밀회담이 열렸다.','명령서가 늦게 닿아 잘못된 교전이 벌어졌고, 싸움은 큰 전쟁으로 번졌다.','새벽 3 시의 포격에 회랑과 담장이 무너지고 검은 연기가 오른다. 급수정 한쪽 지붕이 깨져 물이 샌다.']};scene.add(story);
  let time=0,nextGust=GUST.first,gustStart=-100,gustDuration=GUST.durMin,gustCalled=false,ringCalled=false,nextDrip=7;
  // 새는 물이 땅에 닿을 때 (소리 — 프레임마다 새 함수를 만들지 않게 한 번만 짓는다)
  const onLeakDrip=pos=>stage.onEvent?.('stageDetail',{kind:'courtyardDrip',amp:.12,pos,seed:211041,time});
  const windRng=rng(161020),wp=new THREE.Vector3();
  // 캐릭터 빛 (밤 판 — 다른 밤 무대 beginNight 의 { 0xc7bec8 · 테 0x9dc9d7 · 1.25 · 0.50 } 와 비슷하게): 따뜻한 회색 바탕 · 차가운 테두리 빛 —
  //  어두운 사암 앞에서 두 사람의 윤곽과 칼이 읽히게
  const stage={sunOffset,shadow:SHADOW,nightHour:3,fighterLight:{color:0xd5c2b1,rimColor:0xc1c9d7,rim:1.15,level:.52},
    stats:{wellDepth:6.25,clearRadius:ARENA.radius,dustParticles:dustN,sandStreaks:STREAKS.n,sunElevationDeg:SUN.elevationDeg,smokePuffs:smoke.puffs,smokeSites:smoke.sites},excite(){},
    // 급수정 그늘에 든 몸 (낮 중정과 같은 셈 — fighter_light.js 가 캐릭터 재질마다 부른다): 그 점의 달빛 몫 0~1
    fighterShade(px,py,pz){let lit=0;for(const v of SHADE_RAYS)if(!obstacleBlocksRay(COURTYARD_NAVIGATION,px,py,pz,v.x,v.y,v.z,14))lit++;return lit/SHADE_RAYS.length;},
    update(dt){
      if(!Number.isFinite(dt)||dt<=0)return;const step=Math.min(dt,.1);time+=step;smoke.update(time+7);
      leak.update(step,onLeakDrip);
      if(time>=nextGust){
        gustStart=nextGust;nextGust+=GUST.gapMin+windRng()*GUST.gapRand;gustDuration=GUST.durMin+windRng()*GUST.durRand;gustCalled=false;ringCalled=false;
        stage.emit?.('stageDetail',{kind:'courtyardGust',amp:1,duration:gustDuration,seed:161029,time});
      }
      const age=time-gustStart,u=age/gustDuration,gust=u>=0&&u<=1?Math.sin(u*Math.PI)**2:0;
      for(let m=0;m<cloths.length;m++){
        const c=cloths[m],p=c.mesh.geometry.attributes.position,a=p.array;
        for(let i=0;i<p.count;i++){
          const xx=c.rest[i*3],yy=c.rest[i*3+1],free=(c.length/2-yy)/c.length;
          a[i*3+2]=free*(.1+gust*.6)*Math.sin(xx*2.6-time*3.1+c.phase)+free*free*gust*.3;
        }p.needsUpdate=true;gridNormals(c.mesh.geometry);
      }
      for(let n=0;n<banners.length;n++){
        const banner=banners[n],p=banner.mesh.geometry.attributes.position,rest=banner.rest,len=banner.len,ph=n*1.7;
        const a=p.array;
        for(let i=0;i<p.count;i++){const xx=rest[i*3],yy=rest[i*3+1],k=xx/len;a[i*3+2]=len*k*(.06+gust*.21)*Math.sin(xx/len*6.8-time*(5+gust*4)+ph)+k*k*.04*len*Math.sin(yy/len*8-time*3+ph);a[i*3+1]=yy-len*k*k*(.16-gust*.12);}
        p.needsUpdate=true;gridNormals(banner.mesh.geometry);
      }
      rope.rotation.z=.006*Math.sin(time*.6)+gust*.025;gateRing.rotation.y=GATE.turn+gust*.18*Math.sin(time*4);
      for(let i=0;i<dustN;i++){
        const q=dustData[i],v=(.18+gust*2.2)*q.speed*step;q.x+=WIND_W.x*v;q.z+=WIND_W.z*v;
        if(q.x<-31)q.x+=66;else if(q.x>35)q.x-=66;
        if(q.z<-25)q.z+=54;else if(q.z>29)q.z-=54;
        dustPos[i*3]=q.x;dustPos[i*3+1]=q.y+.06*Math.sin(time+q.phase);dustPos[i*3+2]=q.z+Math.sin(time*.2+q.phase)*.35;
      }
      dustGeo.attributes.position.needsUpdate=true;dust.material.opacity=.045+gust*.08;
      streaks.update(step,gust);
      fog.near=SKY.fogNear-GUST.fogNear*gust;fog.far=SKY.fogFar-GUST.fogFar*gust; // 돌풍 한가운데 먼 쪽이 더 흐려진다 (결투장 띠 안은 그대로)
      water.position.y=-6.23+Math.sin(time*.8)*.007;
      if(gust>.65&&!gustCalled){gustCalled=true;cloths[0].group.getWorldPosition(wp);stage.onEvent?.('stageDetail',{kind:'courtyardCloth',amp:.45+gust*.25,pos:{x:wp.x,y:wp.y,z:wp.z},seed:161020,time});}
      if(age>gustDuration*.88&&!ringCalled){ringCalled=true;rope.getWorldPosition(wp);stage.onEvent?.('stageDetail',{kind:'courtyardRing',amp:.36,pos:{x:wp.x,y:.5,z:wp.z},seed:161022,time});}
      if(time>=nextDrip){const [wx,wz]=toWorld(WELL.x,WELL.z);stage.onEvent?.('stageDetail',{kind:'courtyardDrip',amp:.32,pos:{x:wx,y:-6,z:wz},seed:161021,time});nextDrip+=13+windRng()*7;}
      stage.wind.time=time;stage.wind.gust=gust;stage.wind.nextGust=nextGust; // 새 객체를 만들지 않고 고쳐 쓴다
    }};
  stage.wind={time:0,gust:0,nextGust};stage.emit=(name,data)=>stage.onEvent?.(name,data);
  stage.update(.001);return stage;
}
