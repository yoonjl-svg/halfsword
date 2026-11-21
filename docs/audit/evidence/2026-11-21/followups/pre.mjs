import fs from 'node:fs';
const s = fs.readFileSync('sw.js','utf8'); const m = s.match(/const FILES = (\[.*\]);/); const F = JSON.parse(m[1]);
const MB = (b)=> (b/1048576).toFixed(2);
console.log('files', F.length, 'MB', MB(F.reduce((a,f)=>a+f.bytes,0)));
const grp = (keyf)=>{const g={}; for(const f of F){const k=keyf(f); g[k]??={n:0,b:0}; g[k].n++; g[k].b+=f.bytes;} return Object.entries(g).sort((a,b)=>b[1].b-a[1].b).map(([k,v])=>`${k}: ${v.n} files ${MB(v.b)} MB`);};
console.log('BY FOLDER\n'+grp(f=>f.path.includes('/')?f.path.split('/')[0]+(f.path.split('/').length>2?'/'+f.path.split('/')[1]:''):'(root)').join('\n'));
console.log('BY EXT\n'+grp(f=>f.path.split('.').pop()).join('\n'));
const bySha={}; for(const f of F) (bySha[f.sha256]??=[]).push(f);
console.log('DUPES'); let dupMB=0; for(const [h,a] of Object.entries(bySha)) if(a.length>1){ dupMB+=a[0].bytes*(a.length-1); console.log(MB(a[0].bytes),'MB x',a.length, a.map(x=>x.path).join(' | '));} console.log('wasted dup MB',MB(dupMB));
console.log('TOP15\n'+[...F].sort((a,b)=>b.bytes-a.bytes).slice(0,15).map(f=>MB(f.bytes)+' '+f.path).join('\n'));
// webp twins
const set=new Set(F.map(f=>f.path)); const tw=F.filter(f=>/\.(png|jpe?g)$/.test(f.path)&&set.has(f.path.replace(/\.(png|jpe?g)$/,'.webp'))); console.log('PNG/JPG with webp twin precached', tw.length, MB(tw.reduce((a,f)=>a+f.bytes,0)),'MB'); tw.slice(0,10).forEach(f=>console.log(' ',f.path, MB(f.bytes)));
