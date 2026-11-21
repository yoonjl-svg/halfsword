import fs from 'node:fs';
const f=fs.readdirSync(process.argv[2]).filter(x=>x.endsWith('.cpuprofile'))[0];
const p=JSON.parse(fs.readFileSync(process.argv[2]+'/'+f));
const byId=new Map(p.nodes.map(n=>[n.id,n]));const self=new Map();
const dt=p.timeDeltas;for(let i=0;i<p.samples.length;i++)self.set(p.samples[i],(self.get(p.samples[i])||0)+dt[i]);
const by={};let tot=0;
for(const [id,t] of self){const n=byId.get(id);let u=n.callFrame.url||'';let k=u?u.replace(/^file:\/\/.*\/(wt_main|wt_old)\//,''):'('+n.callFrame.functionName+')';
 if(/rapier/.test(u)||u.startsWith('wasm'))k='rapier(wasm+js glue)';
 by[k]=(by[k]||0)+t;tot+=t;}
const rows=Object.entries(by).sort((a,b)=>b[1]-a[1]).slice(0,22);
console.log('total ms',(tot/1000).toFixed(0));rows.forEach(([k,v])=>console.log((100*v/tot).toFixed(1).padStart(5)+'%',(v/1000).toFixed(0).padStart(6)+'ms',k));
