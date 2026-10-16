// 첫 화면·공지 점검 — 게임 주소(/) 위에서 (샛별 저장소 start_screen_smoke.mjs 는 시안 쪽 따로 된 쪽(start-pixel.html)을 봤다 — 그 쪽은 들여오지 않아 같은 점검을 게임 첫 화면에 맞춤, docs/import/lobby_port_2026-10-16.md §6)
//  공지 다섯 · 글자 색 셋·크기 셋 · 화면에 들어온 공지만 읽음 · '지난 업데이트 숨김' 기억 · 깨진 저장 되살림 · 픽셀 제목·단추 크기 · 아래 줄 세 칸 · 화면 크기 · 움직임 줄이기 · 저장 막힘
//  npm run build && npx vite preview --port 5201 →  node tools/browser/title_smoke.mjs http://127.0.0.1:5201 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.argv[2]||'http://127.0.0.1:5201';
const out=process.argv[3]||'/tmp/title-smoke';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PW_CHROMIUM||'/opt/pw-browsers/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']});
const key='stillness.title.notices.v1',results=[],errors=[],N=5;
const IGNORED=/deprecated parameters for the initialization function/;
const check=(name,data={})=>results.push({check:name,...data});
const watch=page=>{page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'&&!IGNORED.test(m.text()))errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});};
const S='document.querySelector("#gameEntrance").shadowRoot';
const inRoot=(page,body,arg)=>page.evaluate(new Function('arg',`const root=${S};${body}`),arg);
const ready=page=>page.waitForFunction(()=>document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase==='ready',null,{timeout:20000});
const open=async(page)=>{await page.goto(`${base}/`,{waitUntil:'networkidle'});await page.locator('#noticeDialog').waitFor({state:'attached',timeout:30000});await page.evaluate(()=>document.fonts.ready);};
const shot=(page,name)=>page.screenshot({path:`${out}/${name}.png`});
async function newPage(opts){const ctx=await browser.newContext(opts);await ctx.route('https://*.supabase.co/**',r=>{errors.push('auth server called: '+r.request().url());r.abort();});const p=await ctx.newPage();watch(p);return p;}
async function readAll(page){
 for(let i=0;i<30;i++){
  const done=await page.locator('#noticeList').evaluate(el=>{el.scrollTop+=Math.max(30,el.clientHeight/2);return el.scrollTop+el.clientHeight>=el.scrollHeight-1;});
  await page.waitForTimeout(45);if(done)break;
 }
}
async function bounds(page){
 const b=await inRoot(page,`const d=root.getElementById('noticeDialog'),r=d.getBoundingClientRect(),c=root.getElementById('confirmNotices').getBoundingClientRect(),l=root.querySelector('.hide-read').getBoundingClientRect(),f=root.querySelector('.notice-footer').getBoundingClientRect(),list=root.getElementById('noticeList');
  return {dialog:[r.left,r.top,r.right,r.bottom],confirm:[c.left,c.top,c.right,c.bottom],hideRead:[l.left,l.top,l.right,l.bottom],footerHeight:f.height,viewport:[innerWidth,innerHeight],scroll:list.scrollHeight>list.clientHeight};`);
 const c=b.confirm,l=b.hideRead;
 assert.ok(Math.abs((c[1]+c[3])-(l[1]+l[3]))<2,'notice controls should share one row');
 assert.ok(l[2]+10<=c[0],'notice label and confirm must not overlap');
 assert.ok(c[2]-c[0]<=80&&c[3]-c[1]>=32,'compact confirm remains usable');
 assert.ok(b.footerHeight<=64,'notice footer should give space back to the list');
 return b;
}
async function titleLayout(page){
 await page.waitForFunction(()=>document.querySelector('#gameEntrance').shadowRoot.querySelector('.title-korean[data-painted="true"] canvas'),null,{timeout:20000});
 const layout=await inRoot(page,`
  const wordmark=selector=>{
   const el=root.querySelector(selector),canvas=el.querySelector('canvas'),rect=canvas.getBoundingClientRect();
   const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,rows=[];
   for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]){rows.push(y);break;}
   return {text:el.textContent,inkHeight:(Math.max(...rows)-Math.min(...rows)+1)*rect.height/canvas.height,rendering:getComputedStyle(canvas).imageRendering};
  };
  const buttons=[...root.querySelectorAll('.start-actions button')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,width:r.width,height:r.height,left:r.left,right:r.right,top:r.top,bottom:r.bottom,background:s.backgroundColor,border:parseFloat(s.borderWidth)};});
  const footer=root.querySelector('.title-footer'),f=footer.getBoundingClientRect(),fb=[...footer.children].map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,right:r.right,bottom:r.bottom,width:r.width};});
  return {english:wordmark('h1'),korean:wordmark('.title-korean'),buttons,footer:{left:f.left,top:f.top,controls:fb},width:innerWidth,height:innerHeight};`);
 assert.equal(layout.korean.text,'적막');assert.match(layout.korean.rendering,/pixelated|crisp-edges/);
 assert.ok(layout.korean.inkHeight>24&&layout.korean.inkHeight<layout.english.inkHeight,JSON.stringify(layout));
 const compact=layout.width>layout.height&&layout.height<=500;
 const oldWidth=compact?250:layout.width<layout.height?Math.min(278,layout.width-72):278,oldHeight=compact?48:60;
 assert.deepEqual(layout.buttons.map(b=>b.text),['처음부터','이어하기']);
 for(const b of layout.buttons){
  assert.ok(Math.abs(b.width/oldWidth-.82)<.002&&Math.abs(b.height/oldHeight-.82)<.002,JSON.stringify(b));
  assert.ok(b.background.startsWith('rgb(')&&b.border>=4);
  assert.ok(b.left>=0&&b.right<=layout.width&&b.top>0&&b.bottom<layout.height,JSON.stringify(b));
 }
 assert.deepEqual(layout.footer.controls.map(c=>c.text),['공지사항','설정','계정 연결']);
 assert.ok(layout.footer.controls.every(c=>c.right<=layout.width&&c.bottom<=layout.height),JSON.stringify(layout.footer));
 assert.ok(layout.footer.left<layout.width*.1&&layout.footer.top>layout.height*.8);
 return layout;
}
try{
 const page=await newPage({viewport:{width:1280,height:720}});
 await open(page);
 assert.equal(await page.locator('#noticeDialog').evaluate(d=>d.open),true);assert.equal(await page.locator('.notice-entry').count(),N);
 let b=await bounds(page);check(`first launch: ${N} notices in the dialog`,b);await shot(page,'notices-desktop');
 // 10/16 글자 정돈 (docs/import/lobby_fix_2026-10-16.md §1 — src/entrance_type.css): 싸움 화면 규칙 — 창 제목 17·700 · 이름 14·700 · 설명 12·400 보조 · 표지 12·600 강조 · 글꼴 줄 --font-ui(Cinzel 먼저)
 //  10/16 08:3x 사장님 '공지사항 안의 글씨 더 작게 해' (docs/ui/uifix_2026-10-16.md §1): 공지 본문 · 날짜 줄만 한 단계 아래 10 (--fs-xs)
 const typography=await inRoot(page,`return Object.fromEntries(['.notice-header h2','.notice-count','.notice-entry h3','.notice-entry p','.notice-meta','.unread','.hide-read','.confirm-button'].map(selector=>{const s=getComputedStyle(root.querySelector(selector));return [selector,{size:s.fontSize,color:s.color,weight:s.fontWeight,family:s.fontFamily.split(',')[0].replace(/['"]/g,'').trim(),wordBreak:s.wordBreak}];}));`);
 const pick=(t,...k)=>Object.fromEntries(k.map(x=>[x,t[x]]));
 assert.deepEqual(pick(typography['.notice-header h2'],'size','color','weight'),{size:'17px',color:'rgb(243, 233, 216)',weight:'700'});
 assert.deepEqual(pick(typography['.notice-entry h3'],'size','color','weight'),{size:'14px',color:'rgb(243, 233, 216)',weight:'700'});
 assert.deepEqual(pick(typography['.notice-entry p'],'size','color','weight'),{size:'10px',color:'rgb(184, 168, 142)',weight:'400'});
 assert.deepEqual(pick(typography['.notice-meta'],'size','color','weight'),{size:'10px',color:'rgb(184, 168, 142)',weight:'400'});
 assert.equal(typography['.notice-count'].size,'12px');assert.equal(typography['.hide-read'].size,'12px');
 assert.deepEqual(pick(typography['.unread'],'color','weight'),{color:'rgb(217, 164, 65)',weight:'600'});
 assert.equal(typography['.confirm-button'].weight,'700');
 assert.ok(Object.values(typography).every(t=>t.family==='Cinzel'&&t.wordBreak==='keep-all'),JSON.stringify(typography));
 assert.equal(new Set(Object.values(typography).map(s=>s.size)).size,4); // 17 · 14 · 12 + 공지 안 10
 assert.equal(new Set(Object.values(typography).map(s=>s.color)).size,3);
 check('notices follow the battle HUD type rule (font stack Cinzel→Pretendard · sizes 12/14/17 + notice body/date one step down at 10 · weights 400/600/700 · three text colors · keep-all)',{typography});
 await page.evaluate(()=>localStorage.setItem('gladiator-settings','{"fpsCap":true,"prototype-sentinel":true}'));
 await page.locator('#hideRead').check();await page.locator('#confirmNotices').click();
 await page.waitForTimeout(850);await shot(page,'wind-transition-desktop');await ready(page);await shot(page,'title-desktop');
 const wm=await inRoot(page,`const el=root.querySelector('h1');return {fontReady:document.fonts.check('600 32px Cinzel','Stillness'),text:el.textContent,width:el.querySelector('canvas')?.width,rendering:getComputedStyle(el.querySelector('canvas')).imageRendering};`);
 assert.equal(wm.fontReady,true);assert.equal(wm.text,'Stillness');assert.ok(wm.width>100);assert.match(wm.rendering,/pixelated|crisp-edges/);
 const layout=await titleLayout(page);
 check('pixel Korean/English title, 18% smaller framed buttons, bottom-left footer of three',{wm,layout});
 const state=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.equal(state.hideRead,true);assert.ok(state.readIds.length>0&&state.readIds.length<=N);
 assert.equal(await page.evaluate(()=>localStorage.getItem('gladiator-settings')),'{"fpsCap":true,"prototype-sentinel":true}');check('notice reading preserves game settings');
 await page.reload({waitUntil:'networkidle'});
 const remaining=await page.locator('.notice-entry').evaluateAll(els=>els.map(el=>el.dataset.noticeId));
 if(state.readIds.length<N){assert.equal(remaining.length,N-state.readIds.length);assert.ok(remaining.every(id=>!state.readIds.includes(id)));await readAll(page);await page.locator('#confirmNotices').click();}
 await ready(page);check('hide-read preference persists; offscreen notices remain unread',{read:state.readIds,remaining});
 await page.reload({waitUntil:'networkidle'});await ready(page);assert.equal(await page.locator('#noticeDialog').evaluate(d=>d.open),false);check('all read: next launch goes straight to title');
 // 아래 줄에서 연 공지: 확인 = 창만 닫음 — 첫 화면 넘어감(phase notice → wind → ready)을 다시 틀지 않는다 (사장님 10/16 08:3x)
 await inRoot(page,`window.__phases=[];new MutationObserver(()=>window.__phases.push(root.getElementById('entrance').dataset.phase)).observe(root.getElementById('entrance'),{attributes:true,attributeFilter:['data-phase']});`);
 await page.locator('#openNotices').click();assert.equal(await page.locator('.notice-entry').count(),N);await page.locator('#hideRead').uncheck();await page.locator('#confirmNotices').click();await ready(page);
 await page.waitForTimeout(400);assert.equal(await page.locator('#noticeDialog').evaluate(d=>d.open),false);assert.deepEqual(await page.evaluate(()=>window.__phases),[]);
 assert.equal(await inRoot(page,`return root.getElementById('titleScreen').inert`),false);check('footer notices: 확인 only closes the dialog (no title intro replay — phase stays ready)');
await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.notice-entry').count(),N);check('reopen notices and turn hiding off');
 await page.evaluate(k=>localStorage.setItem(k,'{bad json'),key);await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.notice-entry').count(),N);check('invalid saved preference recovers');
 for(const [name,width,height] of [['phone-landscape',844,390],['phone-portrait',390,844],['small-landscape',568,320],['small-portrait',320,568]]){
  const mobile=await newPage({viewport:{width,height},deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await open(mobile);b=await bounds(mobile);
  assert.ok(b.dialog[0]>=0&&b.dialog[1]>=0&&b.dialog[2]<=width&&b.dialog[3]<=height,JSON.stringify(b));assert.ok(b.confirm[3]<=height);assert.equal(b.scroll,true);
  await mobile.locator('#confirmNotices').click();await ready(mobile);
  const t=await mobile.locator('h1.pixel-wordmark').boundingBox();assert.ok(t.x>=0&&t.x+t.width<=width+1,JSON.stringify(t));
  assert.equal(await mobile.locator('#continueJourney').isVisible(),true);
  const l=await titleLayout(mobile);
  check(`${name}: dialog, scrolling and title fit`,{width,height,...b,layout:l});await mobile.context().close();
 }
 const reduced=await newPage({viewport:{width:844,height:390},reducedMotion:'reduce'});await open(reduced);await reduced.locator('#confirmNotices').click();await ready(reduced);assert.equal(await reduced.locator('#titleScreen').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');check('reduced motion: immediate static title');
 const denied=await browser.newContext();await denied.route('https://*.supabase.co/**',r=>r.abort());const dp=await denied.newPage();watch(dp);await dp.addInitScript(()=>{Storage.prototype.getItem=()=>{throw new DOMException('denied','SecurityError');};Storage.prototype.setItem=()=>{throw new DOMException('denied','SecurityError');};});await open(dp);await dp.locator('#hideRead').check();await dp.locator('#confirmNotices').click();await ready(dp);check('storage denied: screen remains usable');
 assert.deepEqual(errors,[]);
}finally{fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,errors},null,2));await browser.close();}
console.log(`PASS ${results.length} title-screen checks; errors ${errors.length}`);
