import fs from 'fs'; import path from 'path';
const root=process.argv[2];
function files(d,o=[]){if(!fs.existsSync(d))return o;for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory()){if(f.name!=='node_modules')files(p,o);}else if(/\.(m?js|html)$/.test(f.name))o.push(p);}return o;}
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`\\])\/\/.*$/gm,'$1');
const S=files(path.join(root,'src')).map(f=>({f:path.relative(root,f),raw:fs.readFileSync(f,'utf8'),t:strip(fs.readFileSync(f,'utf8'))}));
const T=files(path.join(root,'tools')).concat(files(root).filter(f=>path.dirname(f)===root)).map(f=>({f:path.relative(root,f),t:strip(fs.readFileSync(f,'utf8'))}));
const ALL=S.concat(T); const big=ALL.map(o=>o.t).join('\n');
const cnt={};for(const m of big.matchAll(/[A-Za-z_$][\w$]*/g))cnt[m[0]]=(cnt[m[0]]||0)+1;
const out=[];
for(const o of S){const L=o.raw.split('\n');for(let i=0;i<L.length;i++){const m=L[i].match(/^export\s+(?:async\s+)?(function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/);if(!m)continue;const n=m[2];
 // count of occurrences outside this definition: total - 1 (the def)
 const c=cnt[n]-1; if(c>0)continue;
 // size: for function/class estimate by brace match
 let d=0,seen=false,j=i;for(;j<L.length;j++){const s=L[j].replace(/\/\/.*/,'').replace(/'[^']*'|"[^"]*"|`[^`]*`/g,'');for(const ch of s){if(ch==='{'||ch==='['||ch==='('){d++;seen=true}else if(ch==='}'||ch===']'||ch===')')d--;}if(seen&&d<=0)break;if(!seen&&/;\s*$/.test(s))break;}
 out.push([j-i+1,o.f+':'+(i+1),n]);}}
out.sort((a,b)=>b[0]-a[0]);console.log('N',out.length,'lines',out.reduce((a,b)=>a+b[0],0));for(const r of out)console.log(r.join('\t'));
