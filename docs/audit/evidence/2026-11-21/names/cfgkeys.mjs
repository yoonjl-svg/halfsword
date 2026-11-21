import path from 'node:path';
import fs from 'node:fs';
const root=process.argv[2];
const f=path.resolve(root,'src/config.js');
const m=await import(f);
const out=[];
function walk(o,p,exp){
  for(const [k,v] of Object.entries(o)){
    const pp=p?p+'.'+k:k;
    if(v&&typeof v==='object'&&!Array.isArray(v)) walk(v,pp,exp);
    else out.push({path:pp,key:k,type:Array.isArray(v)?'array':typeof v,val:typeof v==='function'?'fn':JSON.stringify(v)});
  }
}
for(const [e,v] of Object.entries(m)){
  if(v&&typeof v==='object'&&!Array.isArray(v)) walk(v,e); else out.push({path:e,key:e,type:typeof v,val:typeof v==='function'?'fn':JSON.stringify(v)});
}
fs.writeFileSync('cfg_leaves.json',JSON.stringify(out));
console.log(out.length, Object.keys(m).length);
