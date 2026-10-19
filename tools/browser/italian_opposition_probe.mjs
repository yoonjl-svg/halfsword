// Real browser input + scripted physical swing, not human balance evidence. Use Vite dev server.
// PW_CHROMIUM=/path/chromium BROWSER_INPUT=keyboard|touch node tools/browser/italian_opposition_probe.mjs <base> <out>
// A missed/late contact may time out; the failed trace is retained instead of weakening the game gates.
import {chromium} from 'playwright';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:5173';
const out=process.argv[3]||'/tmp/italian-opposition-browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const results=[];
for(const mobile of [process.env.BROWSER_INPUT!=='keyboard']){
const page=await browser.newPage({viewport:{width:1280,height:720},hasTouch:mobile,isMobile:mobile});const errors=[];
page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto(base+'/?weapon=rapier&foeWeapon=longsword&uniqueStage=2&stage=castle&slowMo=0&camOpen=old',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.game?.player?.sword);
await page.evaluate(()=>{game.config.ARENA.startGap=1.4;});
await page.getByText('여정 시작',{exact:true}).click();await page.waitForFunction(()=>window.game.state==='fight');
await page.evaluate(async()=>{
 const {TECH}=await import('/src/ai_techniques.js');const g=game,a=g.enemy,p=g.player,tech=TECH.find(t=>t.name==='zwerchL');
 g.config.ARENA.startHold=0;p.fightT=a.fightT=4;p.skill.corr=g.config.SKILL.corr;p.skill.corrTip=g.config.SKILL.corrTip;
 const r=window.probe={t:0,ph:0,at:0,ready:false,go:false,captured:false,contacts:0,events:[]};
 const old=g.combat.hooks.onClash;g.combat.hooks.onClash=(...args)=>{old?.(...args);r.contacts++;r.events.push({t:r.t,age:g.playerGuard.clock-g.playerGuard.opposition.pressed,vn:args[2]?.vn,attack:a.stamina.attackId,injury:g.playerGuard.clock-g.playerGuard.opposition.lastInjury,approach:new g.THREE.Vector3().copy(p.bodies.chest.translation()).sub(a.bladePoint(1,new g.THREE.Vector3())).dot(a.tipVel)});};
 const pad=(x,y)=>{a.handOffset.set(x,y);a.skill.aimRaw.set(x,y);};
 const move=(v,sp,dt)=>{let o=a.handOffset,d=Math.hypot(v[0]-o.x,v[1]-o.y),step=sp*dt;if(d<=step){pad(...v);return true;}pad(o.x+(v[0]-o.x)*step/d,o.y+(v[1]-o.y)*step/d);};
 let pts;
 g.ai.update=dt=>{r.t+=dt;a.move.set(0,0);
 if(r.ph===0&&r.t>.6)r.ph=1;
 else if(r.ph===1&&move(tech.from,3,dt)){r.ph=2;r.at=r.t;}
 else if(r.ph===2&&r.go){r.ph=3;pts=tech.path.map(x=>[...x]);a.stamina.attack('cut');}
 else if(r.ph===3&&move(pts[0],11,dt)&&(pts.shift(),!pts.length)){r.ph=4;}
 if(r.ph===2&&r.t-r.at>.15)r.ready=true;
 const mod=g.playerGuard.opposition;if(mod.run){r.captured=true;g.config.PHYSICS.maxStepsPerFrame=0;}
 };
});
await page.waitForFunction(()=>probe.ready,{},{timeout:30000});
let cdp;
await page.evaluate(()=>{document.getElementById('btnParry').addEventListener('pointerdown',()=>{probe.go=true;},{once:true});window.addEventListener('keydown',e=>{if(e.code==='KeyF')probe.go=true;});});
if(mobile){cdp=await page.context().newCDPSession(page);const b=await page.locator('#btnParry').boundingBox();if(!b)throw Error('no touch parry button');await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});}
else await page.keyboard.down('f');
await page.waitForFunction(()=>game.playerGuard.held);

try{await page.waitForFunction(()=>probe.captured,null,{timeout:25000});}catch(e){const fail=await page.evaluate(()=>({r:probe,start:game.playerGuard.opposition.lastStart,held:game.playerGuard.held,p:game.player.state,gap:game.player.foeDistance(),eligible:game.playerGuard.opposition.eligible(),broken:game.playerGuard.broken}));fs.writeFileSync(`${out}/failed.json`,JSON.stringify(fail,null,2));throw e;}
await page.waitForTimeout(100);
await page.screenshot({path:`${out}/${mobile?'touch':'keyboard'}.png`});
const snap=await page.evaluate(()=>({input:game.playerGuard.held,starts:game.playerGuard.opposition.starts,start:game.playerGuard.opposition.lastStart,pose:game.player.skill.thrustPose,hud:document.getElementById('guardName')?.textContent,probe,spent:game.player.stamina.spent}));
if(mobile)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else await page.keyboard.up('f');
await page.evaluate(()=>game.config.PHYSICS.maxStepsPerFrame=8);
await page.waitForFunction(()=>!game.playerGuard.held&&!game.playerGuard.opposition.run);
results.push({mobile,...snap,errors,cancelledOnRelease:true});await page.close();
}
fs.writeFileSync(`${out}/browser.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));await browser.close();
