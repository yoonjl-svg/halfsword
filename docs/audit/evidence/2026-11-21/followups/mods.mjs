import fs from 'node:fs'; import { createRequire } from 'node:module';
const require = createRequire('../../../../../package.json');
const { SourceMapConsumer } = require('source-map-js');
const dir = process.argv[2]; const f = fs.readdirSync(dir).filter(x=>/^main-.*\.js$/.test(x)).sort((a,b)=>fs.statSync(dir+'/'+b).size-fs.statSync(dir+'/'+a).size)[0];
const code = fs.readFileSync(dir+'/'+f,'utf8'); const map = JSON.parse(fs.readFileSync(dir+'/'+f+'.map','utf8'));
const c = new SourceMapConsumer(map); const maps=[]; c.eachMapping(m=>maps.push(m)); 
const by={}; let tot=0;
for (let i=0;i<maps.length;i++){ const m=maps[i]; const nx=maps[i+1]; const len = (nx && nx.generatedLine===m.generatedLine)? nx.generatedColumn-m.generatedColumn : (code.split('\n')[m.generatedLine-1]?.length ?? 0)-m.generatedColumn; if(!m.source) continue; by[m.source]=(by[m.source]||0)+len; tot+=len; }
console.log(f, 'chars', code.length, 'attributed', tot);
const arr=Object.entries(by).sort((a,b)=>b[1]-a[1]);
const g={}; for(const [s,b] of arr){const k=s.includes('node_modules')?s.replace(/.*node_modules\//,'nm:').split('/').slice(0,2).join('/'):'src'; g[k]=(g[k]||0)+b;} console.log('groups',JSON.stringify(g));
for (const [s,b] of arr.filter(([s])=>!s.includes('node_modules')).slice(0,400)) console.log((b/1024).toFixed(1)+'K', s.replace(/^.*\/src\//,'src/'));
