import fs from 'fs'; import path from 'path';
const root=process.argv[2]; const rows=fs.readFileSync(process.argv[3],'utf8').trim().split('\n').map(l=>l.split('\t')).filter(r=>r[2]==='0');
function files(d,o=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,f.name);if(f.isDirectory())files(p,o);else if(/\.(m?js|html)$/.test(f.name)&&!p.endsWith('src/config.js'))o.push(p);}return o;}
const strip=s=>s.replace(/\/\*[\s\S]*?\*\//g,'').replace(/(^|[^:'"`\\])\/\/.*$/gm,'$1');
const F=files(path.join(root,'src')).map(f=>({f:path.relative(root,f),t:strip(fs.readFileSync(f,'utf8'))}));
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const out=[];
for(const r of rows){const leaf=r[0].split('.').pop(); if(!/^[A-Za-z_$][\w$]*$/.test(leaf)){out.push([...r.slice(0,2),'-',' nonident'].join('\t'));continue;}
 const re=new RegExp('(\\.\\s*'+esc(leaf)+'\\b|[{,]\\s*'+esc(leaf)+'\\s*[,}=]|[\'"`]'+esc(leaf)+'[\'"`]|\\b'+esc(leaf)+'\\s*=\\s*[A-Za-z_$])','g'); let n=0;const fl=[];
 for(const o of F){if(!o.t.includes(leaf))continue;const m=o.t.match(re);if(m){n+=m.length;fl.push(path.basename(o.f)+':'+m.length);}}
 out.push([r[0],r[1],n,fl.slice(0,5).join(',')].join('\t'));}
console.log(out.join('\n'));
