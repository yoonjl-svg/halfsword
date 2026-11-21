const H=await import(process.argv[2]+'/tools/sim/jelly_harness.mjs');let s=3*9301+49297;Math.random=()=>((s=(s*9301+49297)%233280)/233280);
const G=H.newRound({walls:true,seed:3});G.ai2=new H.AI(G.player,G.enemy,'normal');const out=[];
for(let i=0;i<+(process.argv[3]||1200);i++){G.step();if(i%100===0)for(const f of [G.player,G.enemy])for(const k in f.bodies){const b=f.bodies[k];const t=b.translation(),v=b.linvel();out.push(t.x,t.y,t.z,v.x,v.y,v.z)}}
console.log((await import("node:crypto")).createHash("sha256").update(JSON.stringify(out)).digest("hex").slice(0,16));
