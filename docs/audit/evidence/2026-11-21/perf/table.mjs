import fs from 'node:fs';
const stages=(process.argv[2]||'').split(',');const cfgs=['tiny4','tiny1'];
const L=(s)=>{const p=`./P_raw/${s}`;return fs.existsSync(p)?JSON.parse(fs.readFileSync(p)).summary:null};
const allocRate=(f)=>{const j=JSON.parse(fs.readFileSync('./P_raw/'+f));const h=j.raw.heap,d=j.raw.d;let up=0;for(let i=1;i<h.length;i++)if(h[i]>h[i-1])up+=h[i]-h[i-1];const sec=d.reduce((a,b)=>a+b,0)/1000;return (up/1048576/sec).toFixed(1)};
console.log('| stage | calls start/max | tris k | prog | lights | shadow | pts | transp mats | heap MB (min-max) | gc ms/5s | alloc MB/s | tiny4: main ms/frame, fps, speed% | tiny4 phys ms/step | tiny1: main ms/frame, fps | tiny1 phys ms/step | main CPU ms per sim-second t4 / t1 |');
console.log('|'+'---|'.repeat(16));
for(const st of stages){const a=L(`${st}_tiny4.json`),b=L(`${st}_tiny1.json`);if(!a&&!b){console.log(`| ${st} | missing |`);continue}
 const x=a||b,sc=x.scene;
  // net delta, not alloc; computed below from raw
 const per=(s)=>s?(s.physMs/s.steps).toFixed(2):'-';
 const cps=(s)=>s?(s.mainThread.taskMsPerFrame*s.fpsAvg/(s.gameSpeed/100)).toFixed(0):'-';
 console.log(`| ${st} | ${x.calls}/${x.callsMax} | ${(x.tris/1000).toFixed(0)}(${(x.trisMax/1000).toFixed(0)}) | ${x.programs} | ${sc.lights} | ${sc.shadowLights.length} | ${sc.points} | ${sc.transparentMats} | ${x.heapMinMB}-${x.heapMaxMB} | ${x.gc5s.gcMs} (${x.gc5s.minor}/${x.gc5s.major}) | ${allocRate(`${st}_${a?'tiny4':'tiny1'}.json`)} | ${a?`${a.mainThread.taskMsPerFrame}, ${a.fpsAvg}, ${a.gameSpeed}`:'-'} | ${per(a)} | ${b?`${b.mainThread.taskMsPerFrame}, ${b.fpsAvg}`:'-'} | ${per(b)} | ${cps(a)} / ${cps(b)} |`);}
