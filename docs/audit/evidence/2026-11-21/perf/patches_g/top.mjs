import fs from 'node:fs';
const dir=process.argv[2],K=+(process.argv[3]||25);
let S={},T={},tot=0;
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.cpuprofile'))){const p=JSON.parse(fs.readFileSync(dir+'/'+f));
 const byId=new Map(p.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
 const self=new Map();for(let i=0;i<p.samples.length;i++)self.set(p.samples[i],(self.get(p.samples[i])||0)+p.timeDeltas[i]/1000);
 const key=(n)=>{const c=n.callFrame;let u=(c.url||'');if(/rapier/.test(u)||u.startsWith('wasm'))return 'rapier:'+(c.functionName||'anon');u=u.replace(/^file:\/\/.*\/P4\/w[a-z0-9]*\//,'');return `${c.functionName||'(anon)'} ${u}:${c.lineNumber+1}`;};
 for(const [id,t] of self){const n=byId.get(id);const k=key(n);S[k]=(S[k]||0)+t;tot+=t;const seen=new Set();for(let x=id;x;x=parent.get(x)){const kk=key(byId.get(x));if(seen.has(kk))continue;seen.add(kk);T[kk]=(T[kk]||0)+t;}}}
console.log('total ms',tot.toFixed(0));
for(const [l,M] of [['SELF',S],['TOTAL',T]]){console.log('== '+l);Object.entries(M).filter(([k])=>!process.argv[4]||k.includes(process.argv[4])).sort((a,b)=>b[1]-a[1]).slice(0,K).forEach(([k,v])=>console.log(v.toFixed(0).padStart(7),(100*v/tot).toFixed(1).padStart(5)+'%',k));}
