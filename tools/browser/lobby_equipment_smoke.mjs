// 대기실 장착·배치 점검 (샛별 저장소 lobby_equipment_smoke.mjs 를 우리 판에 맞춤 — docs/import/lobby_port_2026-10-16.md §6)
//  우리 손댐: 무기 칸 = 나뭇가지 하나(롱소드 뺌) · 나뭇가지 설명 카드(weapons.js 이름·등급·설명 그대로) · 방어구 이름 '케틀 햇' · 첫 화면 아래 줄 세 칸
//  npm run build && npx vite preview --port 5201 →  node tools/browser/lobby_equipment_smoke.mjs http://127.0.0.1:5201 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getWeapon, TIER_LABEL } from '../../src/weapons.js';
const base=process.argv[2]||'http://127.0.0.1:5201',out=process.argv[3]||'/tmp/lobby-equipment';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const errors=[],checks=[];
const IGNORED=/deprecated parameters for the initialization function/;
const watch=p=>{p.on('pageerror',e=>errors.push(String(e)));p.on('console',m=>{if(m.type()==='error'&&!IGNORED.test(m.text()))errors.push(m.text());});p.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
const noAuth=async c=>c.route('https://*.supabase.co/**',r=>{errors.push('auth server called: '+r.request().url());r.abort();});
const title=async p=>{await p.waitForFunction(()=>window.game?.player,null,{timeout:60000});if(await p.locator('#noticeDialog').evaluate(d=>d.open))await p.locator('#confirmNotices').click();};
const state=async(p,equip,unequip,weapon)=>{assert.equal(await p.locator('#equipItem').isEnabled(),equip);assert.equal(await p.locator('#unequipItem').isEnabled(),unequip);assert.equal(await p.locator('#characterView').getAttribute('data-equipped'),weapon);};
const card=p=>p.locator('#itemDetail').evaluate(e=>{const r=e.getBoundingClientRect(),f=e.closest('.inventory-frame').getBoundingClientRect();return {hidden:e.hidden,name:e.querySelector('#itemName').textContent,rarity:e.querySelector('#itemRarity').textContent,description:e.querySelector('#itemDescription').textContent,inside:r.left>=f.left-.5&&r.right<=f.right+.5&&r.top>=f.top-.5&&r.bottom<=f.bottom+.5,overflow:e.scrollHeight>e.clientHeight+1};});
const shot=(p,name)=>p.screenshot({path:`${out}/${name}.png`});
const branch=getWeapon('tree_branch');
try{
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});await noAuth(c);const p=await c.newPage();watch(p);
 await p.goto(base+'/',{waitUntil:'networkidle'});await title(p);
 const style=sel=>p.locator(sel).evaluate(e=>{const s=getComputedStyle(e);return [s.fontFamily,s.fontSize,s.fontWeight,s.borderTopColor,s.borderTopWidth,s.clipPath,s.backgroundImage];});
 const footer=await p.locator('.title-footer button').evaluateAll(els=>els.map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent,width:r.width,height:r.height,x:r.x,y:r.y};}));
 assert.deepEqual(footer.map(f=>f.label),['공지사항','설정','계정 연결']);
 for(const f of footer){assert.equal(f.width,70);assert.equal(f.height,29);assert.equal(f.y,footer[0].y);}
 assert.ok(footer[1].x>footer[0].x&&footer[2].x>footer[1].x);
 await p.waitForFunction(()=>!document.querySelector('#gameEntrance').shadowRoot.getElementById('openAccount').disabled,null,{timeout:20000});
 await p.locator('#openAccount').tap();assert.equal(await p.locator('#accountEmail').isVisible(),true);await shot(p,'title-account');await p.locator('#closeAccount').tap();
 const titleButton=await style('#newJourney');await shot(p,'title-reference');await p.locator('#newJourney').tap();await p.locator('#characterView canvas').waitFor({timeout:20000});
 const lobbyButton=await style('#tabWeapons');assert.equal(lobbyButton[1],'12px');assert.equal(titleButton[1],'14px');assert.deepEqual(lobbyButton.filter((_,i)=>i!==1),titleButton.filter((_,i)=>i!==1));assert.equal(await p.locator('#lobbyBack').textContent(),'‹ 첫 화면으로');
 await state(p,false,false,'');assert.equal(await p.locator('.inventory-item').count(),1);assert.equal(await p.locator('.inventory-slot').count(),19);
 assert.equal(await p.locator('[data-weapon=longsword]').count(),0);
 const layout=await p.locator('.inventory-grid').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect(),item=e.firstElementChild.getBoundingClientRect(),root=e.getRootNode();return {columns:s.gridTemplateColumns.split(' ').length,rows:s.gridTemplateRows.split(' ').length,cell:[item.width,item.height],width:r.width,frame:root.querySelector('.portrait-card').getBoundingClientRect().toJSON(),panel:root.querySelector('.character-panel').getBoundingClientRect().toJSON(),depart:root.getElementById('lobbyDepart').getBoundingClientRect().toJSON()};});
 assert.equal(layout.columns,5);assert.equal(layout.rows,4);assert.ok(Math.abs(layout.cell[0]-layout.cell[1])<1);assert.ok(layout.cell[0]>43.3);
 assert.ok(Math.abs(layout.frame.width/layout.panel.width-.8)<.01);assert.ok(Math.abs(layout.frame.height/layout.panel.height-.8)<.01);assert.ok(layout.depart.y>=layout.frame.bottom&&layout.depart.bottom<=390);
 assert.equal((await card(p)).hidden,true);
 await shot(p,'lobby-phone');checks.push({name:'title button design shared, lobby text smaller; 80% character frame; 5×4 square grid; tree branch only (no longsword); departure below',layout});
 assert.equal(await p.locator('#lobbyRank').textContent(),'Lv.1 여행자');assert.equal(await p.locator('#lobbyCoins').textContent(),'100');
 assert.equal(await p.locator('.duel-record > span').textContent(),'대면 결과');
 const order=await p.locator('.profile-data dd').evaluateAll(els=>els.map(e=>e.id||e.className));assert.deepEqual(order,['lobbyRank','name-row','lobbySchool']);
 const menu=await p.locator('.lobby-tabs button').evaluateAll(els=>els.map(e=>({text:e.textContent,x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));
 assert.deepEqual(menu.map(m=>m.text),['무기','방어구','상점','스킬북']);assert.equal(menu[0].y,menu[1].y);assert.equal(menu[2].y,menu[3].y);assert.ok(menu[2].y>menu[0].y);
 await p.locator('#tabArmor').tap();assert.equal(await p.locator('.inventory-item').count(),1);assert.equal(await p.locator('.inventory-slot').count(),19);
 await p.locator('[data-armor=kettle] img').evaluate(img=>img.decode());await p.locator('button[data-armor=kettle]').tap();
 let k=await card(p);assert.deepEqual([k.hidden,k.name,k.rarity,k.description],[false,'케틀 햇','커먼','여행자의 필수품. 뒤집으면 요리를 할 수 있다.']);assert.ok(k.inside&&!k.overflow,JSON.stringify(k));
 assert.equal(await p.locator('[data-armor=kettle] img').getAttribute('alt'),'케틀 햇');
 assert.equal(await p.locator('#characterView').getAttribute('data-armor'),'kettle');await state(p,false,true,'');await shot(p,'armor-equipped');
 await p.locator('#unequipItem').tap();assert.equal(await p.locator('#characterView').getAttribute('data-armor'),'');await state(p,true,false,'');await shot(p,'armor-unequipped');
 assert.match(await p.locator('#equipmentStatus').textContent(),/장착 해제/);
 assert.equal(await p.evaluate(()=>game.player.helmetGroup.visible),true);
 await p.locator('#equipItem').tap();assert.match(await p.locator('#equipmentStatus').textContent(),/^케틀 햇 장착/);await p.locator('#tabWeapons').tap();await state(p,false,false,'');
 checks.push({name:'profile order, initial Lv1/traveler/100 coins, 2×2 menus, armor card 케틀 햇 · 커먼 · description, independent armor slot'});
 const bodies=await p.evaluate(()=>game.player.meshes.map(({rb})=>({position:rb.translation(),rotation:rb.rotation()})));
 await p.locator('[data-weapon=tree_branch]').tap();await state(p,true,false,'');
 k=await card(p);assert.deepEqual([k.hidden,k.name,k.rarity,k.description],[false,branch.nameKo,TIER_LABEL[branch.tier],branch.desc]);assert.ok(k.inside&&!k.overflow,JSON.stringify(k));
 assert.equal(k.rarity,'쓰레기');await shot(p,'branch-selected');
 await p.locator('#equipItem').tap();await state(p,false,true,'tree_branch');await shot(p,'branch-equipped');
 assert.equal(await p.locator('[data-weapon=tree_branch] .equipped-badge').isVisible(),true);
 assert.match(await p.locator('#characterView').getAttribute('aria-label'),/나뭇가지 장착/);
 await p.locator('#unequipItem').tap();await state(p,true,false,'');await shot(p,'unequipped');
 await p.locator('.inventory-slot').first().tap();await state(p,false,false,'');assert.equal((await card(p)).hidden,true);
 for(let i=0;i<8;i++){await p.locator('[data-weapon=tree_branch]').tap();await p.locator('#equipItem').tap();await p.locator('#unequipItem').tap();await p.locator('.inventory-slot').first().tap();}
 assert.deepEqual(await p.evaluate(()=>game.player.meshes.map(({rb})=>({position:rb.translation(),rotation:rb.rotation()}))),bodies);assert.equal(await p.evaluate(()=>game.stats.simTime),0);
 checks.push({name:'tree branch card = weapons.js nameKo · TIER_LABEL · desc; selection separate from equip; unequip/clear and repeated cycles; physics untouched'});
 await p.locator('[data-weapon=tree_branch]').tap();await p.locator('#equipItem').tap();
 const v=await p.locator('#characterView').boundingBox(),cdp=await c.newCDPSession(p),x=v.x+v.width*.1,y=v.y+v.height*.5;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+v.width*.25,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 assert.ok(Math.abs(Number(await p.locator('#characterView').getAttribute('data-angle'))-90)<3);await shot(p,'equipped-rotation');
 await p.reload({waitUntil:'networkidle'});await title(p);await p.locator('#newJourney').tap();await state(p,false,false,'tree_branch');assert.equal(await p.locator('#characterView').getAttribute('data-armor'),'kettle');
 await p.locator('#editName').tap();await p.locator('#playerNameInput').fill('방랑 검객');await p.locator('#nameForm button[type=submit]').tap();
 await p.locator('#lobbyBack').tap();await title(p);await p.locator('#newJourney').tap();await state(p,false,false,'tree_branch');assert.equal(await p.locator('#lobbyName').textContent(),'방랑 검객');
 assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('stillness.lobby.weapon.v1'),localStorage.getItem('stillness.lobby.armor.v1')]),['{"version":1,"weapon":"tree_branch"}','{"version":1,"armor":"kettle"}']);
 checks.push({name:'equipped weapon rotates with model; persistence (stillness.lobby.*) through reload/name edit/back navigation; selection resets'});
 await p.locator('#lobbyDepart').tap();await p.waitForFunction(()=>game.state==='draw',null,{timeout:60000});checks.push({name:'departure still enters existing journey card flow'});await c.close();
 for(const [name,width,height] of [['desktop',1280,720],['wide',1440,900],['portrait',390,844],['small-portrait',320,568],['small-landscape',568,320]]){
  const qc=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});await noAuth(qc);const q=await qc.newPage();watch(q);await q.goto(base+'/',{waitUntil:'networkidle'});await title(q);await q.locator('#newJourney').click();await q.locator('#characterView canvas').waitFor({timeout:20000});
  assert.ok(await q.locator('.lobby').evaluate(e=>e.scrollWidth<=e.clientWidth));await q.locator('#equipItem').scrollIntoViewIfNeeded();
  await q.locator('[data-weapon=tree_branch]').click();const kk=await card(q);assert.ok(kk.inside&&!kk.overflow,`${name} ${JSON.stringify(kk)}`);
  await q.locator('#equipItem').click();await state(q,false,true,'tree_branch');
  await q.locator('#lobbyDepart').scrollIntoViewIfNeeded();await q.locator('#lobbyDepart').click();await q.waitForFunction(()=>game.state==='draw',null,{timeout:60000});
  checks.push({name:`${name}: fits, item card inside the frame, equipment buttons and departure reachable`});await qc.close();
 }
 const denied=await browser.newContext({viewport:{width:844,height:390},reducedMotion:'reduce'});await noAuth(denied);
 await denied.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('denied');};Storage.prototype.setItem=()=>{throw Error('denied');};});
 const d=await denied.newPage();watch(d);await d.goto(base+'/',{waitUntil:'networkidle'});await title(d);await d.locator('#newJourney').click();await d.locator('[data-weapon=tree_branch]').click();await d.locator('#equipItem').click();await state(d,false,true,'tree_branch');
 await d.locator('#lobbyBack').click();await title(d);await d.locator('#newJourney').click();await state(d,false,false,'tree_branch');await denied.close();
 checks.push({name:'storage denied: equip still works and survives lobby remount within session'});assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/equipment.json`,JSON.stringify({checks,errors},null,2));await browser.close();}
console.log(`PASS ${checks.length} equipment/layout checks; errors ${errors.length}`);
