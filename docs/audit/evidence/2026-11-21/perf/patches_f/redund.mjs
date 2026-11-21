// node redund.mjs <tree> [steps=600] : per-step body reads, repeat reads under invalidation policies, call sites
const root=process.argv[2],N=+(process.argv[3]||600);
const H=await import(root+'/tools/sim/jelly_harness.mjs');const {RAPIER,newRound,AI}=H;
const seedRand=(seed)=>{let s=seed*9301+49297;Math.random=()=>((s=(s*9301+49297)%233280)/233280);};
seedRand(3);const G=newRound({walls:true,seed:3});G.player.skill.level=0.7;G.ai2=new AI(G.player,G.enemy,'normal');
const READS=new Set(['translation','rotation','linvel','angvel','worldCom']);
const RBPURE=new Set('isValid dominanceGroup additionalSolverIterations softCcdPrediction translation rotation nextTranslation nextRotation gravityScale linvel velocityAtPoint angvel mass effectiveInvMass invMass localCom worldCom invPrincipalInertia principalInertia principalInertiaLocalFrame effectiveWorldInvInertia effectiveAngularInertia isCcdEnabled numColliders collider isEnabled bodyType isSleeping isMoving isFixed isKinematic isDynamic linearDamping angularDamping userForce userTorque'.split(' '));
let on=false,g=0,cntW={},cntC={},cntJ={},cntRB={},reads={},site={};const pol={P1:{},P2:{},P3:{}};const ep={P1:0,P2:0,P3:0};
const bodyE=new Map();const last={P1:new Map(),P2:new Map(),P3:new Map()};let inStep=0;
const bump=(ps)=>{for(const p of ps)ep[p]++;};
const isPureName=(m)=>/^(is|get|for|cast|intersect|project|contact|timing|len|contains|body[12]$|type$|frame|anchor[12]$|limits|translation|rotation|parent|friction|restitution|density|mass|volume|collision|solver|active|shape|half|radius|round|vertices|indices|heightfield|raw|drain|joint(Type|Frame|Anchor|Contacts|LimitsEnabled|LimitsMin|LimitsMax|Body)|rb(Translation|Rotation|Linvel|Angvel))/.test(m)&&!/^set/.test(m);
const wrap=(P,kind)=>{for(const m of Object.getOwnPropertyNames(P)){if(m==='constructor')continue;const d=Object.getOwnPropertyDescriptor(P,m);if(typeof d.value!=='function')continue;const o=d.value;
 P[m]=function(...a){ if(!on) return o.apply(this,a);
  if(kind==='RB'){ if(READS.has(m)){reads[m]=(reads[m]||0)+1; if(!inStep){const s=new Error().stack.split('\n')[2].trim().replace(/^at /,'').replace(/\(?file:.*\/src\//,'').replace(/\)$/,'');site[m+' '+s]=(site[m+' '+s]||0)+1;
      for(const p of ['P1','P2','P3']){const k=(bodyE.get(this)||0)+'|'+ep[p];let L=last[p].get(this);if(!L){L={};last[p].set(this,L);} if(L[m]===k){pol[p][m]=(pol[p][m]||0)+1;} L[m]=k;}}}
    else if(!RBPURE.has(m)){cntRB[m]=(cntRB[m]||0)+1;bodyE.set(this,(bodyE.get(this)||0)+1);} return o.apply(this,a);}
  if(kind==='World'){ if(m==='step'){inStep++;bump(['P1','P2','P3']);const r=o.apply(this,a);bump(['P1','P2','P3']);inStep--;return r;} if(!isPureName(m)){cntW[m]=(cntW[m]||0)+1;bump(['P2','P3']);} return o.apply(this,a);}
  if(kind==='C'){ if(!isPureName(m)){cntC[m]=(cntC[m]||0)+1;bump(['P2','P3']);} return o.apply(this,a);}
  if(kind==='J'){ if(!isPureName(m)){cntJ[m]=(cntJ[m]||0)+1;bump(['P3']);} return o.apply(this,a);}
  return o.apply(this,a);}}};
wrap(RAPIER.RigidBody.prototype,'RB');wrap(RAPIER.World.prototype,'World');wrap(RAPIER.Collider.prototype,'C');
for(const c of ['RigidBodySet','ColliderSet','ImpulseJointSet','MultibodyJointSet'])wrap(RAPIER[c].prototype,'World');
for(const c of ['ImpulseJoint','UnitImpulseJoint','RevoluteImpulseJoint'])wrap(RAPIER[c].prototype,'J');
let rawJ;G.world.impulseJoints.forEach(j=>{rawJ=Object.getPrototypeOf(j.rawSet)});wrap(rawJ,'J');
for(let i=0;i<120;i++)G.step();on=true;for(let i=0;i<N;i++)G.step();on=false;
const per=(o)=>Object.fromEntries(Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+(v/N).toFixed(2)]));
console.log(JSON.stringify({steps:N,reads:per(reads),repeatP1_stepAndOwnMutators:per(pol.P1),repeatP2_plusWorldColliderMut:per(pol.P2),repeatP3_plusJointCalls:per(pol.P3),rbMutators:per(cntRB),worldNonPure:per(cntW),colliderNonPure:per(cntC),jointNonPure:per(cntJ)},null,0));
console.log('TOP SITES');Object.entries(site).sort((a,b)=>b[1]-a[1]).slice(0,40).forEach(([k,v])=>console.log((v/N).toFixed(2).padStart(6),k));
