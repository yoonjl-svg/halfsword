// probe13.mjs — the window loses focus while the guard thumb is down (blur event sent by script = forced). After the thumb lifts:
//  is the guard off, and does the guard button still look lit?  Then: all fingers lifted, 'resume' tapped, fingers pressed again — does everything work?
import { boot } from './hlib.mjs';
const H = await boot({ base: process.argv[2] });
const g = await H.page.locator('#btnParry').boundingBox();
const lit = () => H.page.evaluate(() => document.getElementById('btnParry').classList.contains('on'));
const held = () => H.page.evaluate(() => !!window.game.playerGuard?.held);
await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.frames(20);
const before = { lit: await lit(), held: await held() };
await H.page.evaluate(() => window.dispatchEvent(new Event('blur'))); await H.frames(10);
const st = (await H.snap()).state;
await H.up(3); await H.frames(5);
const afterLift = { lit: await lit() };
const rb = H.page.locator('#btnResume'); let resumed = false;
if (await rb.isVisible().catch(() => false)) { const b = await rb.boundingBox(); await H.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); resumed = true; }
await H.frames(40);
const afterResume = { state: (await H.snap()).state, lit: await lit(), held: await held() };
await H.down(3, g.x + g.width / 2, g.y + g.height / 2); await H.frames(20);
const pressAgain = { lit: await lit(), held: await held() };
await H.up(3); await H.frames(10);
const released = { lit: await lit(), held: await held() };
await H.stick(0, 0.8); await H.frames(20); const mv = (await H.snap()).mv; await H.stickUp();
const a = await H.snap(); await H.tap(620, 200); await H.frames(40); const b = await H.snap();
console.log(JSON.stringify({ forced: 'blur event sent by script', before, stateAfterBlur: st, afterLift, resumed, afterResume, pressAgain, released, stickAfter: mv, tapAfter: b.counts.thrust - a.counts.thrust }));
await H.close();
