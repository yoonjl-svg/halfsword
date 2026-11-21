// node wasm_count.mjs <tree> [steps=600]: (1) JS API calls per step by method (as rapier_count) (2) raw wasm-bindgen calls per step (every call into wasm incl. vector getters/free)
const root=process.argv[2],N=+(process.argv[3]||600);
const H=await import(root+'/tools/sim/jelly_harness.mjs');const {RAPIER,newRound,AI}=H;
const seedRand=(seed)=>{let s=seed*9301+49297;Math.random=()=>((s=(s*9301+49297)%233280)/233280);};
seedRand(3);const G=newRound({walls:true,seed:3});G.player.skill.level=0.7;G.ai2=new AI(G.player,G.enemy,'normal');
let on=false;const api={},raw={};
const wrapP=(P,tag,store)=>{if(!P||P.__w)return;P.__w=1;for(const m of Object.getOwnPropertyNames(P)){if(m==='constructor'||m.startsWith('__'))continue;const d=Object.getOwnPropertyDescriptor(P,m);
 if(typeof d.value==='function'){const o=d.value;P[m]=function(...a){if(on){const k=tag+'.'+m;store[k]=(store[k]||0)+1;}return o.apply(this,a)}}
 else if(d.get){const og=d.get;Object.defineProperty(P,m,{...d,get(){if(on){const k=tag+'.'+m;store[k]=(store[k]||0)+1;}return og.call(this)}})}}};
for(const c of ['RigidBody','Collider','ImpulseJoint','UnitImpulseJoint','World','RigidBodySet','ColliderSet','ImpulseJointSet','EventQueue'])wrapP(RAPIER[c].prototype,c,api);
const w=G.world,b=G.player.bodies.pelvis;let j;w.impulseJoints.forEach(x=>j=x);
const rv=b.rawSet.rbTranslation(b.handle),rq=b.rawSet.rbRotation(b.handle);
const raws={RawRigidBodySet:b.rawSet,RawColliderSet:w.colliders.raw,RawImpulseJointSet:j.rawSet,RawPipeline:w.physicsPipeline.raw,RawNarrow:w.narrowPhase.raw,RawBroad:w.broadPhase.raw,RawIslands:w.islands.raw,RawEventQueue:G.eventQueue?.raw,RawVector:rv,RawRotation:rq};
for(const [k,o] of Object.entries(raws))if(o)wrapP(Object.getPrototypeOf(o),k,raw);
for(let i=0;i<120;i++)G.step();on=true;for(let i=0;i<N;i++)G.step();on=false;
const per=(o)=>Object.entries(o).map(([k,v])=>[k,+(v/N).toFixed(2)]).sort((a,b)=>b[1]-a[1]);
const sum=(o)=>+(Object.values(o).reduce((s,v)=>s+v,0)/N).toFixed(1);
console.log(JSON.stringify({apiPerStep:sum(api),rawWasmPerStep:sum(raw),apiTop:per(api).slice(0,14),rawTop:per(raw).slice(0,14),rb:per(raw).filter(([k])=>k.startsWith("RawRigidBodySet.rb"))}));
