import fs from 'node:fs';
const dir=process.argv[2],target=process.argv[3];
const p=JSON.parse(fs.readFileSync(dir+'/'+fs.readdirSync(dir).filter(x=>x.endsWith('.cpuprofile'))[0]));
const byId=new Map(p.nodes.map(n=>[n.id,n]));
const self=new Map();for(let i=0;i<p.samples.length;i++)self.set(p.samples[i],(self.get(p.samples[i])||0)+p.timeDeltas[i]/1000);
const key=(n)=>{const c=n.callFrame;let u=(c.url||'');if(/rapier/.test(u)||u.startsWith('wasm'))return 'rapier:'+(c.functionName||'anon');u=u.replace(/^file:\/\/.*\/P4\/w[a-z0-9]*\//,'');return `${c.functionName||'(anon)'} ${u}:${c.lineNumber+1}`;};
const tot=(n)=>{let t=self.get(n.id)||0;for(const c of n.children||[])t+=tot(byId.get(c));return t;};
const K={},L={};let all=0;
const walk=(n,inT)=>{const k=key(n);const isT=k===target;
 if(isT&&!inT){all+=tot(n);for(const c of n.children||[]){const cn=byId.get(c);const ck=key(cn);K[ck]=(K[ck]||0)+tot(cn);}
   for(const pt of n.positionTicks||[]){L[pt.line]=(L[pt.line]||0)+pt.ticks;}}
 for(const c of n.children||[])walk(byId.get(c),inT||isT);};
walk(byId.get(p.nodes[0].id),false);
console.log(target,'total',all.toFixed(0));
Object.entries(K).sort((a,b)=>b[1]-a[1]).slice(0,+(process.argv[4]||20)).forEach(([k,v])=>console.log(v.toFixed(0).padStart(6),k));
console.log('self line ticks:',Object.entries(L).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([l,t])=>l+':'+t).join(' '));
