// 물리 2.0 시험 페이지 점검: 본판과 같은 출처 · 같은 브라우저 프로필에서 시험 페이지가 본 게임 저장 · 서비스 워커를 건드리지 않는지 본다
//  준비: 배포와 같은 꼴의 dist(본판 + dist/physics2)를 하위 경로로 띄운다 — docs/strike/physics2_trial_page_2026-11-25.md §4
//  node tools/physics2_page/isolation_check.mjs <뿌리 주소 예 http://127.0.0.1:4188/halfsword/> <그림 폴더> [깨진 시험 페이지 폴더 이름]
//   셋째 인자(예 physics2broken): 저장 가르기 글을 일부러 깨뜨린 사본을 그 이름으로 같은 뿌리에 두면, 지킴 글이 그 페이지를 멈추는지도 본다
//  보는 것: 본판은 지금 다리 · 시험 페이지는 새 다리 · 시험 페이지가 본판 열쇠를 못 읽음 · 본판 열쇠가 하나도 안 바뀜(시험 페이지의 clear() 뒤에도) ·
//   서비스 워커 등록 수 그대로 · 서비스 워커가 시험 페이지 요청에 답한 것 0 · 시험 페이지에 매니페스트 없음 · 표시가 첫 화면에서도 보임 ·
//   탭 사이 알림 이름에 앞붙임 · 싸움까지 들어감 · 콘솔 에러 0. 하나라도 어긋나면 FAIL · 종료 코드 1
//  playwright 는 저장소 의존성에 없다(기계에 깔린 것을 쓴다). 계정 서버(*.supabase.co)는 막고 돈다
import { createRequire } from 'node:module';
import fs from 'node:fs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const base = process.argv[2];
const out = process.argv[3];
const brokenDir = process.argv[4] || null;
fs.mkdirSync(out, { recursive: true });
const PREFIX = 'stillness.p2trial.';
const IGNORED = /deprecated parameters for the initialization function/;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
const errors = [];
let trialFromSw = 0;
let trialResponses = 0;
const watch = (p, tag) => {
  p.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text()) && !/supabase|ERR_FAILED/.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
  p.on('response', (r) => { if (r.status() >= 400) errors.push(`${tag} http ${r.status()}: ${r.url()}`); if (tag === 'trial') { trialResponses++; if (r.fromServiceWorker()) trialFromSw++; } });
};
// 원래 저장을 그대로 읽는다(시험 페이지 안에서는 덮인 Storage 가 아니라 원래 함수를 프레임 밖에서 가져와 쓴다)
const rawDump = (p) => p.evaluate(() => {
  const f = document.createElement('iframe'); f.style.display = 'none'; document.body.appendChild(f);
  const S = f.contentWindow.Storage.prototype; const ls = window.localStorage; const o = {};
  const n = Object.getOwnPropertyDescriptor(S, 'length').get.call(ls);
  for (let i = 0; i < n; i++) { const k = S.key.call(ls, i); o[k] = S.getItem.call(ls, k); }
  f.remove(); return o;
});
const swInfo = (p) => p.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).map((r) => r.scope), controlled: !!navigator.serviceWorker.controller }));
const result = {};

// 1) 본판을 연다 — 서비스 워커가 깔리고, 본판 저장이 생긴다. 싸움에 들어가 저장이 더 쌓이게 한다
const main = await ctx.newPage(); watch(main, 'main');
await main.goto(base + '?weapon=longsword', { waitUntil: 'networkidle' });
await main.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
result.mainTitle = await main.title();
result.mainHasNewLegs = await main.evaluate(() => !!window.game.player.legDrive);
await main.getByText('여정 시작').click();
await main.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
await main.waitForTimeout(4000);
await main.evaluate(() => localStorage.setItem('stillness.probe.mainOnly', 'main-value-1'));
await main.evaluate(() => navigator.serviceWorker.ready.then(() => true));
await main.waitForTimeout(3000);
result.swAfterMain = await swInfo(main);
const before = await rawDump(main);
result.mainKeysBefore = Object.keys(before).sort();
await main.screenshot({ path: `${out}/1_main.png` });

// 2) 같은 프로필로 시험 페이지의 고르기 화면 → 시작 → 싸움
const t = await ctx.newPage(); watch(t, 'trial');
await t.goto(base + 'physics2/test.html', { waitUntil: 'networkidle' });
result.trialPickTitle = await t.title();
await t.screenshot({ path: `${out}/2_trial_pick.png` });
result.trialPickBadge = await t.evaluate(() => document.getElementById('p2TrialBadge')?.textContent || null);
result.trialChannelName = await t.evaluate(() => { const c = new BroadcastChannel('probe'); const n = c.name; c.close(); return n; });
result.trialStorageFlag = await t.evaluate(() => window.__stillnessP2TrialStorage);
// 시험 페이지가 본판 저장을 읽을 수 있나 (읽히면 안 된다)
result.trialReadsMainProbe = await t.evaluate(() => localStorage.getItem('stillness.probe.mainOnly'));
// '시작' 단추 (없으면 주소로)
const startBtn = t.locator('#start, button:has-text("시작")').first();
if (await startBtn.count()) await Promise.all([t.waitForNavigation({ waitUntil: 'networkidle' }), startBtn.click()]);
else await t.goto(base + 'physics2/index.html?test=1&weapon=longsword&hero=player&foe=random&stage=random', { waitUntil: 'networkidle' });
result.trialFightUrl = t.url().replace(base, '');
await t.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
result.trialTitle = await t.title();
result.trialHasNewLegs = await t.evaluate(() => !!window.game.player.legDrive);
// 싸움으로 들어간다 (메뉴 단추가 있으면 누른다)
for (const label of ['다음 판', '여정 시작', '시작']) {
  const b = t.getByText(label, { exact: false }).first();
  if (await t.evaluate(() => window.game.state) === 'fight') break;
  if (await b.count() && await b.isVisible().catch(() => false)) { await b.click().catch(() => {}); await t.waitForTimeout(1500); }
}
await t.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 }).catch(() => {});
result.trialState = await t.evaluate(() => window.game.state);
await t.waitForTimeout(8000);
await t.evaluate(() => { localStorage.setItem('stillness.probe.trialOnly', 'trial-value-1'); localStorage.removeItem('stillness.probe.mainOnly'); });
result.trialWeapon = await t.evaluate(() => window.game.player?.weapon?.id);
result.trialSim = await t.evaluate(() => +window.game.stats.simTime.toFixed(1));
result.trialBadge = await t.evaluate(() => document.getElementById('p2TrialBadge')?.textContent || null);
result.swOnTrial = await swInfo(t);
result.trialManifest = await t.evaluate(() => !!document.querySelector('link[rel="manifest"]'));
await t.screenshot({ path: `${out}/3_trial_fight.png` });
// 시험 페이지의 clear() 가 본판 저장을 지우지 않는지
const trialKeysSeen = await t.evaluate(() => { const ks = []; for (let i = 0; i < localStorage.length; i++) ks.push(localStorage.key(i)); return ks; });
result.trialKeysSeenInside = trialKeysSeen.sort();
await t.evaluate(() => localStorage.clear());
const after = await rawDump(t);

// 2-1) 시험판 첫 화면(공지 · 첫 화면이 앞에 떠 있는 동안)에서도 표시가 보이는가
const t2 = await ctx.newPage(); watch(t2, 'trial');
await t2.goto(base + 'physics2/', { waitUntil: 'networkidle' });
await t2.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
await t2.waitForTimeout(1500);
result.trialTitleScreen = await t2.evaluate(() => { const b = document.getElementById('p2TrialBadge'); return { startOpen: document.documentElement.hasAttribute('data-start-open'), badgeVisibility: b ? getComputedStyle(b).visibility : null }; });
await t2.screenshot({ path: `${out}/4_trial_title.png` });
await t2.close();

// 3) 견준다
const after2 = await rawDump(t);
const mainAfter = Object.fromEntries(Object.entries(after2).filter(([k]) => !k.startsWith(PREFIX)));
const changed = [];
for (const k of new Set([...Object.keys(before), ...Object.keys(mainAfter)])) if (before[k] !== mainAfter[k]) changed.push(k);
result.mainKeysChangedByTrial = changed;
result.trialKeysLeftAfterClear = Object.keys(after).filter((k) => k.startsWith(PREFIX));
result.trialResponses = trialResponses;
result.trialFromServiceWorker = trialFromSw;

// 4) 본판을 다시 연다 — 여전히 지금 게임이고 제 저장을 그대로 본다
await main.reload({ waitUntil: 'networkidle' });
await main.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
result.mainAfterReload = await main.evaluate(() => ({ title: document.title, newLegs: !!window.game.player.legDrive, probe: localStorage.getItem('stillness.probe.mainOnly'), badge: !!document.getElementById('p2TrialBadge') }));
result.swAtEnd = await swInfo(main);
// 5) 저장 가르기 글이 깨진 사본: 지킴 글이 페이지를 멈추고, 게임이 뜨지 않고, 앞붙임 없는 열쇠가 새로 생기지 않는다
if (brokenDir) {
  const snap = await rawDump(main);
  const b = await ctx.newPage();
  const bErr = [];
  b.on('pageerror', (e) => bErr.push(String(e)));
  await b.goto(base + brokenDir + '/test.html', { waitUntil: 'load' }).catch(() => {});
  await b.waitForTimeout(2500);
  const pick = await b.evaluate(() => ({ text: document.body?.innerText?.slice(0, 80) || '', flag: window.__stillnessP2TrialStorage ?? null }));
  await b.goto(base + brokenDir + '/index.html?test=1&weapon=longsword&hero=player&foe=random&stage=random', { waitUntil: 'load' }).catch(() => {});
  await b.waitForTimeout(6000);
  const idx = await b.evaluate(() => ({ text: document.body?.innerText?.slice(0, 80) || '', game: typeof window.game, flag: window.__stillnessP2TrialStorage ?? null }));
  await b.screenshot({ path: `${out}/5_broken.png` });
  const snap2 = await rawDump(main);
  const diff = [...new Set([...Object.keys(snap), ...Object.keys(snap2)])].filter((k) => snap[k] !== snap2[k]);
  result.broken = { pick, idx, keysChanged: diff, guardErrors: bErr.filter((e) => /storage split did not run/.test(e)).length };
  await b.close();
}
result.errors = errors;
console.log(JSON.stringify(result, null, 1));
await browser.close();
const ok = result.mainHasNewLegs === false && result.trialHasNewLegs === true && result.trialReadsMainProbe === null && changed.length === 0
  && result.mainAfterReload.probe === 'main-value-1' && result.mainAfterReload.newLegs === false && result.swAtEnd.regs.length === result.swAfterMain.regs.length
  && result.trialManifest === false && !!result.trialBadge && errors.length === 0
  && result.trialState === 'fight' && result.trialFromServiceWorker === 0 && result.trialResponses > 0
  && result.trialTitleScreen.badgeVisibility === 'visible' && result.trialChannelName === PREFIX + 'probe' && result.trialStorageFlag === 'on'
  && (!brokenDir || (result.broken.idx.game === 'undefined' && result.broken.keysChanged.length === 0 && result.broken.guardErrors >= 1 && /저장 가르기/.test(result.broken.idx.text)));
console.log(ok ? 'PASS' : 'FAIL');
process.exit(ok ? 0 : 1);
