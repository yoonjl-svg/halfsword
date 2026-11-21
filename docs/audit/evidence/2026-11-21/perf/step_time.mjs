// ms per G.step() for 1v1 AI-vs-AI (fights12 setup). run from $M: node $S/C_raw/step_time.mjs [fights=16] [secs=20]
import { newRound, DT, AI } from '../../../../tools/sim/jelly_harness.mjs' /* 본판 워크트리의 tools/sim 을 가리키게 고쳐 쓴다 */;
const N=+(process.argv[2]||16), SECS=+(process.argv[3]||20);
const seedRand=(seed)=>{let s=seed*9301+49297;Math.random=()=>((s=(s*9301+49297)%233280)/233280);};
const per=[]; const all=[];
for(let seed=1;seed<=N;seed++){seedRand(seed);const G=newRound({walls:true,seed});G.player.skill.level=0.7;G.ai2=new AI(G.player,G.enemy,'normal');
 const n=Math.round(SECS/DT);const t=[];for(let i=0;i<n;i++){const a=performance.now();G.step();const b=performance.now();if(i>=120)t.push(b-a);}
 t.sort((x,y)=>x-y);const m=t.reduce((s,x)=>s+x,0)/t.length;per.push(m);all.push(...t);}
all.sort((x,y)=>x-y);const mean=all.reduce((s,x)=>s+x,0)/all.length;
console.log(JSON.stringify({fights:N,secs:SECS,meanMs:+mean.toFixed(3),medianMs:+all[all.length>>1].toFixed(3),p95:+all[Math.floor(all.length*.95)].toFixed(3),p99:+all[Math.floor(all.length*.99)].toFixed(3),perFightMean:per.map(x=>+x.toFixed(2))}));
