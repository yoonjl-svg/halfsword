// 컴파일판/공개판의 실제 화면·저장·동선을 확인한다. 개인 저장 대신 새 브라우저 문맥을 쓴다.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.argv[2] || 'http://127.0.0.1:5281';
const out = process.argv[3] || new URL('./', import.meta.url).pathname;
await fs.mkdir(`${out}/screens`, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [], checks = [], KEY = 'stillness.journey.checkpoint.v1';
const press = (p, selector) => p.locator(selector)[p.__mobile ? 'tap' : 'click']();
const shot = (p, name) => p.screenshot({ path: `${out}/screens/${name}.png` });
async function open({ saved, blocked = false, mobile = true } = {}) {
  const context = await browser.newContext({ viewport: mobile ? { width: 844, height: 390 } : { width: 1280, height: 720 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  await context.route('https://*.supabase.co/**', route => { errors.push('unexpected auth request'); return route.abort(); });
  await context.addInitScript(({ key, saved, blocked }) => {
    if (saved !== undefined) localStorage.setItem(key, saved);
    if (blocked) {
      Storage.prototype.getItem = () => { throw new Error('test storage blocked'); };
      Storage.prototype.setItem = () => { throw new Error('test storage blocked'); };
    }
  }, { key: KEY, saved, blocked });
  const p = await context.newPage(); p.__mobile = mobile;
  p.on('pageerror', e => errors.push(e.message));
  p.on('response', r => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
  await p.goto(base + '/'); await title(p);
  return { p, context };
}
async function title(p) {
  await p.locator('#confirmNotices').waitFor({ state: 'attached', timeout: 90000 });
  if (await p.locator('#noticeDialog').evaluate(d => d.open)) await press(p, '#confirmNotices');
  await p.waitForFunction(() => {
    const r = document.querySelector('#gameEntrance')?.shadowRoot;
    return r?.getElementById('entrance')?.dataset.phase === 'ready' && !r.getElementById('newJourney').disabled;
  }, null, { timeout: 90000 });
}
const labels = p => p.locator('.start-actions button').allTextContents();
const savedAt = p => p.evaluate(key => localStorage.getItem(key), KEY);
async function lobby(p) {
  await press(p, '#enterLobby');
  await p.locator('#lobbyDepart').waitFor({ state: 'visible' });
  for (const id of ['closeTree', 'closeWander', 'closeTitle']) if (await p.locator('#' + id).isVisible()) await press(p, '#' + id);
  assert.equal(await p.locator('#lobbyDepart').textContent(), 'Stage');
}
async function depart(p, selector) {
  await press(p, selector);
  await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(game.state), null, { timeout: 90000 });
}
async function back(p) {
  await p.evaluate(() => document.getElementById('btnPause').click());
  await p.waitForFunction(() => game.state === 'paused');
  await press(p, '#btnLobby');
  await p.locator('#lobbyBack').waitFor({ state: 'visible' });
  for (const id of ['closeTree', 'closeWander', 'closeTitle']) if (await p.locator('#' + id).isVisible()) await press(p, '#' + id);
  await press(p, '#lobbyBack'); await title(p);
}
try {
  {
    const { p, context } = await open();
    assert.deepEqual(await labels(p), ['Stage', '대기실']); await shot(p, '01-new-title');
    assert.equal(await savedAt(p), null);
    await lobby(p); assert.equal(await savedAt(p), null);
    assert.equal(await p.evaluate(() => game.stats.simTime), 0);
    await p.locator('#lobbyPortraitImg').evaluate(i => i.decode()); await shot(p, '03-lobby');
    await press(p, '#lobbyBack'); await title(p);
    assert.deepEqual(await labels(p), ['Stage', '대기실']);
    await depart(p, '#newJourney');
    const checkpoint = await savedAt(p); assert.equal(JSON.parse(checkpoint).stage, 'poseidon');
    await back(p); assert.deepEqual(await labels(p), ['이어가기', '대기실']); await shot(p, '02-continue-title');
    await lobby(p); assert.equal(await savedAt(p), checkpoint);
    await depart(p, '#lobbyDepart'); assert.equal(await savedAt(p), checkpoint);
    checks.push('fresh title/lobby creates no checkpoint; Stage starts poseidon; round-trip changes first label; lobby Stage resumes unchanged cards/weapon');
    await context.close();
  }
  {
    const checkpoint = JSON.stringify({ version: 1, stage: 'clearing', foe: null, foeWeapon: null, weapon: null, cards: null });
    const { p, context } = await open({ saved: checkpoint, mobile: false });
    assert.deepEqual(await labels(p), ['이어가기', '대기실']);
    await lobby(p); assert.equal(await savedAt(p), checkpoint);
    await press(p, '#lobbyBack'); await title(p);
    await depart(p, '#newJourney'); assert.equal(JSON.parse(await savedAt(p)).stage, 'clearing');
    checks.push('desktop existing later-stage save: both lobby access and first-button continue preserve stage');
    await context.close();
  }
  for (const saved of ['{broken', JSON.stringify({ version: 1, stage: 'missing_stage' })]) {
    const { p, context } = await open({ saved });
    assert.deepEqual(await labels(p), ['Stage', '대기실']);
    await lobby(p); await depart(p, '#lobbyDepart');
    assert.equal(JSON.parse(await savedAt(p)).stage, 'poseidon');
    checks.push('invalid save falls back to Stage and can start via lobby'); await context.close();
  }
  {
    const { p, context } = await open({ blocked: true });
    assert.deepEqual(await labels(p), ['Stage', '대기실']);
    await lobby(p); await depart(p, '#lobbyDepart'); await back(p);
    assert.deepEqual(await labels(p), ['이어가기', '대기실']);
    await depart(p, '#newJourney'); checks.push('blocked persistent storage: fresh lobby departure and same-session continuation work');
    await context.close();
  }
  assert.deepEqual(errors, []);
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ base, checks, errors, scope: 'real browser, mobile emulation and desktop; not physical iPhone' }, null, 2));
  console.log(JSON.stringify({ checks: checks.length, errors }));
} finally { await browser.close(); }
