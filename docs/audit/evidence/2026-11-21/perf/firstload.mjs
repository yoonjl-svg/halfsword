// first-load: requests, bytes (transfer, uncompressed from vite dev is NOT representative -> run against vite preview of dist), time to first game frame & title visible. node firstload.mjs <base> <rate>
import { chromium } from './P_pw/node_modules/playwright/index.mjs';
const [base, rateS='4', url='/'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--no-sandbox'] });
const ctx = await browser.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:3, isMobile:true, hasTouch:true, serviceWorkers:'block' });
const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate',{rate:+rateS});
const reqs=[]; let bytes=0, enc=0;
page.on('response', async (r)=>{ try{ const b=await r.body(); bytes+=b.length; const h=r.headers(); reqs.push({u:r.url().replace(base,''),n:b.length,ce:h['content-encoding']||''}); }catch{} });
const t0=Date.now();
await page.goto(base+url,{waitUntil:'commit'});
await page.waitForFunction(()=>window.game?.renderInfo?.().frame>0,null,{timeout:180000}); const tFrame=Date.now()-t0;
await page.waitForLoadState('networkidle'); const tIdle=Date.now()-t0;
const nav=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];const paints=Object.fromEntries(performance.getEntriesByType('paint').map(p=>[p.name,Math.round(p.startTime)]));return {dcl:Math.round(n.domContentLoadedEventEnd),load:Math.round(n.loadEventEnd),paints,heap:performance.memory?.usedJSHeapSize/1048576}});
reqs.sort((a,b)=>b.n-a.n);
console.log(JSON.stringify({rate:+rateS,url,requests:reqs.length,bodyMB:+(bytes/1048576).toFixed(2),tFirstGameFrameMs:tFrame,tNetworkIdleMs:tIdle,...nav,top:reqs.slice(0,8)}));
await browser.close();
