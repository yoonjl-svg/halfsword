import fs from 'fs'; import path from 'path';
const root=process.argv[2];
function files(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(f.name!=='node_modules')files(p,o);}else if(/\.(m?js|html)$/.test(f.name))o.push(p);}return o;}
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`\\])\/\/.*$/gm,'$1');
const F=files(path.join(root,'src')).concat(files(path.join(root,'tools'))).map(f=>({f:path.relative(root,f),t:strip(fs.readFileSync(f,'utf8'))}));
const idx=new Map();for(const o of F){const s=new Set(o.t.match(/[A-Za-z_$][\w$]*/g)||[]);for(const w of s){if(!idx.has(w))idx.set(w,new Set());idx.get(w).add(o.f);}}
let n=0,tot=0;const out=[];
for(const o of F){if(!o.f.startsWith('src/'))continue;for(const m of o.t.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)){tot++;const fs_=idx.get(m[1]);if(fs_.size===1){n++;out.push(o.f+' '+m[1]);}}}
console.log('exports',tot,'referenced only in own file',n);console.log(out.join('\n'));
