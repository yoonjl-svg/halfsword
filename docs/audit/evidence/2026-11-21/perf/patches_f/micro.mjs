// node micro.mjs <tree>: which calls change body reads (translation/rotation/linvel/angvel/worldCom) immediately, on which body
const R=(await import(process.argv[2]+'/node_modules/@dimforge/rapier3d-compat/rapier.mjs')).default;await R.init({});
const mk=()=>{const w=new R.World({x:0,y:-9.81,z:0});const A=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,1,0).setLinvel(.3,.1,0).setAngvel({x:.2,y:.5,z:.1}));w.createCollider(R.ColliderDesc.cuboid(.1,.2,.1).setTranslation(.05,0,0),A);
 const B=w.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,1.5,0));w.createCollider(R.ColliderDesc.ball(.1),B);
 const J=w.createImpulseJoint(R.JointData.spherical({x:0,y:.25,z:0},{x:0,y:-.25,z:0}),A,B,true);w.step();return {w,A,B,J};};
const rd=(b)=>JSON.stringify([b.translation(),b.rotation(),b.linvel(),b.angvel(),b.worldCom()]);
const ops={
 applyImpulse:({A})=>A.applyImpulse({x:1,y:0,z:0},true), applyTorqueImpulse:({A})=>A.applyTorqueImpulse({x:0,y:1,z:0},true),
 applyImpulseAtPoint:({A})=>A.applyImpulseAtPoint({x:1,y:0,z:0},{x:0,y:1.2,z:0},true),
 setLinvel:({A})=>A.setLinvel({x:2,y:0,z:0},true), setAngvel:({A})=>A.setAngvel({x:0,y:2,z:0},true),
 setTranslation:({A})=>A.setTranslation({x:.5,y:1,z:0},true), setRotation:({A})=>A.setRotation({x:0,y:.6,z:0,w:.8},true),
 addForce:({A})=>A.addForce({x:50,y:0,z:0},true), addTorque:({A})=>A.addTorque({x:0,y:50,z:0},true),
 addForceAtPoint:({A})=>A.addForceAtPoint({x:50,y:0,z:0},{x:0,y:1.3,z:0},true), resetForces:({A})=>{A.addForce({x:9,y:0,z:0},true);A.resetForces(true)},
 resetTorques:({A})=>A.resetTorques(true), wakeUp:({A})=>A.wakeUp(), sleep:({A})=>A.sleep(),
 setAdditionalMass:({A})=>A.setAdditionalMass(2,true),
 jointConfigureMotor_raw:({J})=>J.rawSet.jointConfigureMotor(J.handle,3,0.3,0,500,20),
 jointConfigureMotorPosition_raw:({J})=>J.rawSet.jointConfigureMotorPosition(J.handle,4,0.3,500,20),
 jointSetLimits_raw:({J})=>J.rawSet.jointSetLimits(J.handle,5,-.1,.1),
 colliderSetMass:({w,A})=>A.collider(0).setMass(3),
 createCollider_onA:({w,A})=>w.createCollider(R.ColliderDesc.ball(.2).setTranslation(.3,0,0),A),
 removeJoint:({w,J})=>w.removeImpulseJoint(J,true),
 step:({w})=>w.step(),
};
const res={};
for(const [k,f] of Object.entries(ops)){const s=mk();const a0=rd(s.A),b0=rd(s.B);f(s);const a1=rd(s.A),b1=rd(s.B);
 const fld=(x,y)=>{const X=JSON.parse(x),Y=JSON.parse(y);return ['t','r','v','w','com'].filter((_,i)=>JSON.stringify(X[i])!==JSON.stringify(Y[i])).join(',')||'-'};
 res[k]={A:fld(a0,a1),B:fld(b0,b1)};}
for(const [k,v] of Object.entries(res))console.log(k.padEnd(32),'A changed:',v.A.padEnd(14),'B(jointed) changed:',v.B);
