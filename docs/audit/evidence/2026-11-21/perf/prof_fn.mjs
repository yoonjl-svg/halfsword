import fs from 'node:fs';
function load(dir){const f=fs.readdirSync(dir).filter(x=>x.endsWith('.cpuprofile'))[0];const p=JSON.parse(fs.readFileSync(dir+'/'+f));
 const byId=new Map(p.nodes.map(n=>[n.id,n]));const parent=new Map();for(const n of p.nodes)for(const c of n.children||[])parent.set(c,n.id);
 const self=new Map();for(let i=0;i<p.samples.length;i++)self.set(p.samples[i],(self.get(p.samples[i])||0)+p.timeDeltas[i]);
 const key=(n)=>{const c=n.callFrame;let u=(c.url||'').replace(/^file:\/\/.*\/(wt_main|wt_old)\//,'');if(/rapier/.test(u)||u.startsWith('wasm'))u='rapier';return `${c.functionName||'(anon)'} ${u}:${c.lineNumber+1}`;};
 const S={},T={};let tot=0;
 for(const [id,t] of self){const n=byId.get(id);S[key(n)]=(S[key(n)]||0)+t;tot+=t;
  const seen=new Set();for(let x=id;x;x=parent.get(x)){const k=key(byId.get(x));if(seen.has(k))continue;seen.add(k);T[k]=(T[k]||0)+t;}}
 return {S,T,tot};}
const N=load(process.argv[2]),O=load(process.argv[3]);
const nm=(k)=>k.split(' ')[0]+' '+k.split(' ')[1].split(':')[0];
// old lookup by function+file (line shifts)
const oldBy=(M)=>{const r={};for(const k in M)r[nm(k)]=(r[nm(k)]||0)+M[k];return r};
const OS=oldBy(O.S),OT=oldBy(O.T);
for(const [lab,M,OM] of [['SELF',N.S,OS],['TOTAL',N.T,OT]]){console.log('== '+lab+' now(ms) | old(ms) | fn file:line');
 Object.entries(M).sort((a,b)=>b[1]-a[1]).slice(0,28).forEach(([k,v])=>console.log((v/1000).toFixed(0).padStart(6),((OM[nm(k)]||0)/1000).toFixed(0).padStart(6),k));}
// new-since: functions in file with self time in now but absent in old
console.log('== NEW-in-now functions (absent old) by TOTAL');
Object.entries(N.T).filter(([k])=>!(nm(k) in OT)).sort((a,b)=>b[1]-a[1]).slice(0,25).forEach(([k,v])=>console.log((v/1000).toFixed(0).padStart(6),k));
