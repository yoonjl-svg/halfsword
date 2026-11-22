// q3_cards.mjs <baseUrl> <outJson> [stageChanges=4] : same as q2_hitch but through the weapon-card step of the journey
//  (no ?weapon= pin). Longest frame in two windows per round start:
//   A = [start-button click, cards shown + 1.5 s]   B = [card click, first fight frame + 2 s]
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, out, nChS = '4'] = process.argv.slice(2);
const NCH = +nChS;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
await page.addInitScript(() => {
  const R = (window.__fr = { t: [], st: [], marks: [] });
  const f = (now) => { R.t.push(now); R.st.push(window.game ? window.game.state : '-'); requestAnimationFrame(f); };
  requestAnimationFrame(f);
  window.__mark = (k) => R.marks.push([k, performance.now()]);
});
await page.goto(`${base}/?fps=1&emo=0&cards=longsword,rapier`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.evaluate(() => { const c = document.querySelector('canvas'); c.width = 8; c.height = 4; });
await page.waitForTimeout(2500);
const info = () => page.evaluate(() => { const g = window.game; return { stage: g.stage.id, buildMs: +g.stage.buildMs.toFixed(1), warmMs: +(g.stage.warmMs || 0).toFixed(1), programs: g.renderInfo().programs }; });
const events = [];
async function start(kind, clickFn) {
  const before = await info();
  await page.evaluate((k) => window.__mark('start:' + k), kind);
  await clickFn();
  await page.waitForFunction(() => window.game.state === 'draw' && document.querySelector('#draw .wcard:not(.foe)'), null, { timeout: 240000 });
  await page.evaluate(() => window.__mark('cards'));
  await page.waitForTimeout(1500);
  const mid = await info();
  await page.evaluate(() => window.__mark('card'));
  await page.locator('#draw .wcard:not(.foe)').first().click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
  await page.waitForTimeout(3000);
  const after = await info();
  events.push({ kind, from: before.stage, to: after.stage, before, mid, after });
}
async function endRound(win) {
  await page.evaluate((w) => { const g = window.game; if (g.player.alive && g.enemy.alive) (w ? g.enemy : g.player).die('목', true); }, win);
  await page.waitForFunction(() => window.game.state === 'paused' && document.getElementById('btnStart') && !document.getElementById('btnStart').hidden, null, { timeout: 240000 });
  await page.waitForTimeout(+(process.env.RESULT_WAIT_MS ?? 1500)); // how long the result window stays up before the button is pressed
}
await start('firstStart', () => page.getByText('여정 시작').click());
for (let i = 0; i < NCH; i++) { await endRound(true); await start('stageChange', () => page.click('#btnStart')); }
await endRound(false); await start('sameStage', () => page.click('#btnStart'));
const R = await page.evaluate(() => window.__fr);
const dts = R.t.map((t, i) => (i ? t - R.t[i - 1] : 0));
const marks = (p) => R.marks.filter((m) => m[0].startsWith(p));
const S0 = marks('start:'), C0 = marks('cards'), K0 = marks('card').filter((m) => m[0] === 'card');
events.forEach((e, i) => {
  const a0 = S0[i][1], a1 = C0[i][1] + 1500, b0 = K0[i][1];
  const iF = R.t.findIndex((t, j) => t > b0 && R.st[j] === 'fight'); const b1 = R.t[iF] + 2000;
  const mx = (lo, hi) => { let m = 0; for (let j = 1; j < R.t.length; j++) if (R.t[j] > lo && R.t[j] <= hi) m = Math.max(m, dts[j]); return +m.toFixed(0); };
  e.A_longest = mx(a0, a1); e.B_longest = mx(b0, b1);
  console.log(`${e.kind.padEnd(11)} ${e.from}->${e.to} A(start->cards) ${e.A_longest}ms  B(card->fight) ${e.B_longest}ms  build ${e.mid.buildMs} warm ${e.mid.warmMs} prog ${e.before.programs}->${e.mid.programs}->${e.after.programs}`);
});
if (errors.length) console.log('ERR', errors.slice(0, 3));
fs.writeFileSync(out, JSON.stringify({ events, errors, raw: R }, null, 1));
await browser.close();
