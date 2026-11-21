// node heap_alloc.mjs <tree root> [fights=6] [secs=10]: sampling allocation profile incl. collected objects, bytes/step + top sites
import inspector from 'node:inspector/promises';
const root=process.argv[2],N=+(process.argv[3]||6),SECS=+(process.argv[4]||10);
const H=await import(root+'/tools/sim/jelly_harness.mjs');const {newRound,DT,AI}=H;
const seedRand=(seed)=>{let s=seed*9301+49297;Math.random=()=>((s=(s*9301+49297)%233280)/233280);};
const ss=new inspector.Session();ss.connect();await ss.post('HeapProfiler.enable');
let steps=0;
for(let seed=1;seed<=N;seed++){seedRand(seed);const G=newRound({walls:true,seed});G.player.skill.level=0.7;G.ai2=new AI(G.player,G.enemy,'normal');
 for(let i=0;i<120;i++)G.step();
 if(seed===1)await ss.post('HeapProfiler.startSampling',{samplingInterval:4096,includeObjectsCollectedByMajorGC:true,includeObjectsCollectedByMinorGC:true});
 const n=Math.round(SECS/DT);for(let i=0;i<n;i++){G.step();steps++;}}
const {profile}=await ss.post('HeapProfiler.stopSampling');
const by={};let tot=0;const walk=(n)=>{const c=n.callFrame;const k=`${c.functionName||'(anon)'} ${(c.url||'').replace(/^file:\/\/.*\/(wt_main|wt_old)\//,'')}:${c.lineNumber+1}`;by[k]=(by[k]||0)+n.selfSize;tot+=n.selfSize;n.children.forEach(walk)};walk(profile.head);
console.log(JSON.stringify({tree:root.split('/').pop(),steps,totalMB:+(tot/1048576).toFixed(1),bytesPerStep:Math.round(tot/steps)}));
Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,16).forEach(([k,v])=>console.log((v/steps).toFixed(0).padStart(6),'B/step',k));
