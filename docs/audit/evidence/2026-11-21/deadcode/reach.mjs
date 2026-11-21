import fs from 'fs'; import path from 'path';
const root=process.argv[2]; const entries=process.argv.slice(3);
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`\\])\/\/.*$/gm,'$1');
const all=[];(function w(d){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())w(p);else if(f.name.endsWith('.js'))all.push(p);}})(path.join(root,'src'));
const deps=new Map(); // file -> [{to,dyn}]
function res(from,spec){ if(!spec.startsWith('.'))return null; let p=path.resolve(path.dirname(from),spec); for(const c of [p,p+'.js',p+'/index.js']) if(fs.existsSync(c)&&fs.statSync(c).isFile())return c; return null;}
for(const f of all){const t=strip(fs.readFileSync(f,'utf8'));const out=[];
 for(const m of t.matchAll(/(?:import|export)\s*(?:[^'"`;]*?\sfrom\s*)?['"]([^'"]+)['"]/g)){const r=res(f,m[1]);if(r)out.push({to:r,dyn:false});}
 for(const m of t.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)){const r=res(f,m[1]);if(r)out.push({to:r,dyn:true});}
 for(const m of t.matchAll(/new URL\(\s*['"]([^'"]+)['"]\s*,\s*import\.meta\.url/g)){const r=res(f,m[1]);if(r)out.push({to:r,dyn:true});}
 deps.set(f,out);}
function reach(starts,skipDyn){const seen=new Set();const st=[...starts];while(st.length){const f=st.pop();if(seen.has(f))continue;seen.add(f);for(const d of deps.get(f)||[]){if(skipDyn&&d.dyn)continue;st.push(d.to);}}return seen;}
const E=entries.map(e=>path.resolve(root,e));
const R=reach(E,false), RS=reach(E,true);
const lines=f=>fs.readFileSync(f,'utf8').split('\n').length;
const un=all.filter(f=>!R.has(f)).map(f=>[path.relative(root,f),lines(f)]).sort((a,b)=>b[1]-a[1]);
console.log('TOTAL',all.length,'reach',R.size,'unreach',un.length,'lines',un.reduce((a,b)=>a+b[1],0));
for(const [f,n] of un)console.log('UNREACH',n,f);
const dynOnly=all.filter(f=>R.has(f)&&!RS.has(f)).map(f=>[path.relative(root,f),lines(f)]).sort((a,b)=>b[1]-a[1]);
console.log('DYNONLY',dynOnly.length,dynOnly.reduce((a,b)=>a+b[1],0));for(const [f,n] of dynOnly)console.log('DYN',n,f);
