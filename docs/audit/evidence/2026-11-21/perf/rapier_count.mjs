// node rapier_count.mjs <tree root (with tools/sim/jelly_harness.mjs)>
const root=process.argv[2];
const H=await import(root+'/tools/sim/jelly_harness.mjs');
const {RAPIER,newRound,DT,AI}=H;
const seedRand=(seed)=>{let s=seed*9301+49297;Math.random=()=>((s=(s*9301+49297)%233280)/233280);};
seedRand(3);
const G=newRound({walls:true,seed:3});G.player.skill.level=0.7;G.ai2=new AI(G.player,G.enemy,'normal');
const w=G.world;
const out={};
out.world={bodies:w.bodies.len?.()??w.bodies.len, colliders:w.colliders.len(), impulseJoints:w.impulseJoints.len(), multibodyJoints:w.multibodyJoints?.len?.()};
const ip=w.integrationParameters;out.params={dt:ip.dt,iters:ip.numSolverIterations,addIters:ip.numAdditionalFrictionIterations,internalPgs:ip.numInternalPgsIterations,minIsland:ip.minIslandSize,maxCcd:ip.maxCcdSubsteps,erp:ip.contactErp??ip.normalizedAllowedLinearError};
const jt={};w.impulseJoints.forEach(j=>{const t=j.type;jt[t]=(jt[t]||0)+1});out.jointTypes=jt;
let dyn=0,kin=0,fix=0,ccd=0,sleepOK=0;const bt={};
w.bodies.forEach(b=>{if(b.isDynamic())dyn++;else if(b.isKinematic())kin++;else fix++;if(b.isCcdEnabled())ccd++;if(b.canSleep?.())sleepOK++;});
out.bodyKinds={dyn,kin,fix,ccd,sleepOK};
const flags={hooks:0,events:0,sensor:0,groups:{}};
w.colliders.forEach(c=>{if(c.activeHooks()) flags.hooks++; if(c.activeEvents()) flags.events++; if(c.isSensor()) flags.sensor++; const g=c.collisionGroups(); flags.groups[g]=(flags.groups[g]||0)+1;});
out.colliderFlags=flags;
out.perFighter={bodies:Object.keys(G.player.bodies).length,swordColliders:G.player.swordColliders?.length};
// wrap hot methods
const counts={};const wrapProto=(cls,name)=>{for(const m of Object.getOwnPropertyNames(cls.prototype)){if(m==='constructor')continue;const d=Object.getOwnPropertyDescriptor(cls.prototype,m);if(typeof d.value!=='function')continue;const o=d.value;cls.prototype[m]=function(...a){const k=name+'.'+m;counts[k]=(counts[k]||0)+1;return o.apply(this,a)}}};
wrapProto(RAPIER.RigidBody,'RB');wrapProto(RAPIER.Collider,'Col');wrapProto(RAPIER.ImpulseJoint,'IJ');wrapProto(RAPIER.UnitImpulseJoint??RAPIER.ImpulseJoint,'UIJ');wrapProto(RAPIER.World,'World');wrapProto(RAPIER.ColliderSet,'ColSet');wrapProto(RAPIER.RigidBodySet,'RBSet');wrapProto(RAPIER.ImpulseJointSet,'IJSet');
// hook invocations
const hk=G.combat.physicsHooks;let hookCalls=0;const hn={};
for(const k of Object.keys(hk)){if(typeof hk[k]==='function'){const o=hk[k].bind(hk);hk[k]=(...a)=>{hookCalls++;hn[k]=(hn[k]||0)+1;return o(...a)}}}
const eq=G.eventQueue;let evs=0;
for(let i=0;i<120;i++)G.step(); // warm
for(const k in counts)delete counts[k];hookCalls=0;for(const k in hn)delete hn[k];
const N=600;for(let i=0;i<N;i++)G.step();
const per=Object.entries(counts).map(([k,v])=>[k,+(v/N).toFixed(2)]).sort((a,b)=>b[1]-a[1]);
out.crossingsPerStep=+per.reduce((s,[,v])=>s+v,0).toFixed(1);out.top=per.slice(0,22);out.hookCallsPerStep=+(hookCalls/N).toFixed(2);out.hookNames=hn;
console.log(JSON.stringify(out));
