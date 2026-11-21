import fs from 'node:fs';
const load=(d)=>{const f=fs.readdirSync(d).find(x=>x.endsWith('.cpuprofile')); const p=JSON.parse(fs.readFileSync(d+'/'+f)); const nodes=new Map(p.nodes.map(n=>[n.id,n])); const m={}; let tot=0;
 for(let i=0;i<p.samples.length;i++){const n=nodes.get(p.samples[i]); const cf=n.callFrame; const file=(cf.url.replace(/^.*(wt_main)\//,'')||'(native)'); const k=(cf.functionName||'(anon)')+' '+(/wasm/.test(cf.url)?'wasm':file)+':'+(cf.lineNumber+1); m[k]=(m[k]||0)+(p.timeDeltas[i]||0); tot+=p.timeDeltas[i]||0;} return {m,tot};};
const D={2:load(process.argv[2]+'/prof2'),4:load(process.argv[2]+'/prof4'),6:load(process.argv[2]+'/prof6')};
console.log('total ms', Object.entries(D).map(([n,d])=>n+':'+(d.tot/1000).toFixed(0)).join(' '));
const keys=new Set([...Object.keys(D[2].m),...Object.keys(D[6].m)]); const rows=[];
for(const k of keys){const a=D[2].m[k]||0,b=D[4].m[k]||0,c=D[6].m[k]||0; if(c<60000) continue; rows.push({k,a:a/1000,b:b/1000,c:c/1000,r:(c+1)/(a+1)});}
rows.sort((x,y)=>(y.c-y.a*3)-(x.c-x.a*3));
console.log('fn  ms@2 ms@4 ms@6  ratio6/2 (3=linear 9=quadratic)  [sorted by excess over linear]');
for(const r of rows.slice(0,22)) console.log(`${r.a.toFixed(0)} ${r.b.toFixed(0)} ${r.c.toFixed(0)} x${r.r.toFixed(1)}  ${r.k.replace(/node_modules\//,'')}`);
