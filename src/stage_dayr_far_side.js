// 건너편 숙소 회랑: 어느 편인지 가리지 않고 베인 사람 — 엎드린 한 사람 (사장님 10/16 — 샛별 쪽). 쓰러진 사람은 모두 셋 (앉은 사람은 사장님이 거절해 뺐다)
import * as T from 'three';
import {workshop} from './stage_night_second.js';

export const DAYR_FAR_SIDE={
 prone:{position:[-9.2,0,14.0],yaw:2.0},
 lanterns:[[-14.85,.10,17.10],[-8.45,0,14.65]]
};
const blob=(w,s,c,p,rot)=>w.put(new T.SphereGeometry(1,10,7),c,p,rot,s);
function head(w,p,rot,wrap){
 const g=new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(1,1,1));
 function part(geo,color,pos,scale){geo.scale(...scale);geo.translate(...pos);geo.applyMatrix4(g);w.put(geo,color);}
 part(new T.SphereGeometry(1,10,7),0xa88c72,[0,0,0],[.135,.165,.13]);
 part(new T.SphereGeometry(1,10,6),wrap,[0,.105,-.025],[.155,.085,.145]);
 part(new T.BoxGeometry(1,1,1),0xb1967c,[0,-.015,.132],[.033,.055,.041]);
 for(const s of [-1,1])part(new T.BoxGeometry(1,1,1),0x493c35,[s*.055,.020,.122],[.041,.009,.011]);
 for(let i=0;i<3;i++)part(new T.TorusGeometry(1,.035,4,14),i%2?wrap:0xb2a58e,[0,.095+i*.026,-.024],[.15,.045,.14]);
}
function body(root,index,layout,pose){
 const g=new T.Group();g.name=`dayr-fallen-conspirator-${index}`;g.position.set(...layout.position);g.rotation.y=layout.yaw;
 g.userData={visualOnly:true,combatant:false,pose,identity:pose==='prone'?'undetermined':'unknown'};root.add(g);return g;
}
export function addDayrFarSide(root){
 const skin=0xa88c72;
 const prone=body(root,3,DAYR_FAR_SIDE.prone,'prone'),w=workshop(prone,172301);
 // 먼지 묻은 평범한 여행옷 · 닫힌 주머니 · 정체를 알려 주는 칼은 드러나지 않음
 const outer=0xada087,inner=0x484b49;
 blob(w,[.235,.15,.37],outer,[0,.21,0]);blob(w,[.22,.13,.22],outer,[.02,.18,.40]);
 w.box([.40,.035,.075],0x635440,[.01,.31,.26]);
 for(const [hip,knee,ankle] of [
  [[-.13,.19,.44],[-.22,.12,.86],[-.19,.075,1.34]],
  [[.14,.19,.44],[.36,.13,.83],[.46,.08,1.16]]
 ]){w.rod(hip,knee,.095,inner);w.rod(knee,ankle,.065,inner);blob(w,[.085,.07,.15],0x544536,[ankle[0],ankle[1],ankle[2]+.06]);}
 for(const [shoulder,elbow,hand] of [
  [[-.20,.22,-.21],[-.34,.10,-.50],[-.28,.055,-.98]],
  [[.19,.22,-.23],[.40,.10,-.17],[.25,.055,-.54]]
 ]){w.rod(shoulder,elbow,.068,outer);w.rod(elbow,hand,.052,inner);blob(w,[.055,.038,.085],skin,hand);}
 head(w,[-.03,.15,-.47],[Math.PI/2,0,-.30],0xb4a991);
 blob(w,[.11,.09,.15],0x68533b,[.23,.22,.20]);
 w.finish('dayr-unidentified-fallen-traveller');
 const goods=workshop(root,172302);
 // 흩어진 짐은 조금만 — 장비를 다 갖춘 둘째 모의 탁자가 아니다
 blob(goods,[.29,.14,.22],0x7f6c51,[-8.14,.16,13.45],[0,.35,.25]);
 goods.box([.37,.035,.34],0x5c493a,[-8.02,.17,13.25],[.10,.35,.28]);
 goods.put(new T.CylinderGeometry(.075,.075,.38,10),0xa3957d,[-7.86,.08,13.48],[0,0,Math.PI/2]);
 blob(goods,[.14,.20,.10],0x79634a,[-15.02,.31,17.59],[0,0,.6]);
 goods.rod([-15.15,.39,17.60],[-15.29,.40,17.54],.028,0x574936);
 goods.finish('dayr-far-side-belongings');
 return {prone};
}
