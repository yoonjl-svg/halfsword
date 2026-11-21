import fs from 'node:fs';
const dir=process.argv[2],target=process.argv[3];
const p=JSON.parse(fs.readFileSync(dir+'/'+fs.readdirSync(dir).filter(x=>x.endsWith('.cpuprofile'))[0]));
const byId=new Map(p.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
const self=new Map();for(let i=0;i<p.samples.length;i++)self.set(p.samples[i],(self.get(p.samples[i])||0)+p.timeDeltas[i]/1000);
const key=(n)=>{const c=n.callFrame;let u=(c.url||'');if(/rapier/.test(u)||u.startsWith('wasm'))return 'rapier:'+(c.functionName||'anon');u=u.replace(/^file:\/\/.*\/P4\/w[a-z0-9]*\//,'');return `${c.functionName||'(anon)'} ${u}:${c.lineNumber+1}`;};
const tot=(n)=>{let t=self.get(n.id)||0;for(const c of n.children||[])t+=tot(byId.get(c));return t;};
const C={};for(const n of p.nodes){if(key(n)!==target)continue;const pa=byId.get(parent.get(n.id));const k=key(pa);C[k]=(C[k]||0)+tot(n);}
Object.entries(C).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(v.toFixed(0).padStart(6),k));
