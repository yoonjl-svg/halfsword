// 표기 방침 (10/10 — docs/text/naming_policy_2026-10-10.md) 브라우저 스모크: 콘솔 에러 0 + 자세 이름 HUD·기술 알림 새 표기 한 장.
//  내 무기 우치가타나(일본 — 자세 이름 HUD 에 일본 독음, ?iai=0·secret=0·playerSecret=0 으로 비기 알림이 덮지 않게) · 상대 청강검(중국 — 기술 알림에 '한글 독음 (漢字)').
//  기술 알림은 상대 AI 의 고유 동작 이름을 자료(uniqueByName)에서 그대로 꺼내 ai.setTechCue 로 적는다 (난수·싸움과 상관없는 표시만).
//   10/14 03:3x 부터 상대 기술 알림은 화면 어디에도 안 뜬다(docs/ui/hud_type_system_2026-10-10.md §15) — 그 이름·꼬리표 자료를 '내 기술' 알림(② — player.uniqueCue)으로
//   옮겨 띄운다(꼬리표만 '내'). ② 는 마지막 기술이 계속 보이므로 한 번만 띄우면 된다
//  실행: npx vite build && npx vite preview --port 4188 --strictPort &
//        node tools/browser/text_policy_shot.mjs http://127.0.0.1:4188 docs/handoff/text_policy_hud.png
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:4188';
const out = process.argv[3] || 'text_policy_hud.png';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`${base}/?weapon=uchigatana&foeWeapon=qinggang&iai=0&secret=0&playerSecret=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
// 자세 이름 HUD 가 뜰 때까지 (쉬는 자세 — 손대지 않으면 곧 뜬다)
await page.waitForFunction(() => document.getElementById('guardName')?.classList.contains('show'), null, { timeout: 60000 }).catch(() => {});
// 사진만을 위해 상대 AI 를 세운다 (ai.update 를 빈 함수로 — 상대가 들어와 판이 끝나거나 경직 알림이 덮지 않게). 표시 확인용이라 싸움 결과와 상관없다
await page.evaluate(() => (window.game.ai.update = () => {}));
await page.waitForTimeout(6000); // 상대 소개 글이 걷힐 때까지
await page.waitForFunction(() => document.getElementById('guardName')?.classList.contains('show'), null, { timeout: 60000 }).catch(() => {});
const names = await page.evaluate(() => [...window.game.ai.uniqueByName.values()].map((u) => u.nameKo ?? u.feint?.name ?? u.name));
// 속임수 이름은 열쇠로도 쓰인다 (strikeCue: uniqueByName.get(feint.name)) — 새 표기로 찾아지는지 보고, 그 이름을 띄운다
const feintKey = await page.evaluate(() => {
  const ai = window.game.ai;
  const U = [...ai.uniqueByName.values()].find((u) => u.feint);
  return U ? { name: U.feint.name, found: ai.uniqueByName.get(U.feint.name) === U } : null;
});
const pick = feintKey?.name ?? names[0];
// 고른 이름을 ② 에 (첫 줄 = 괄호 앞 한국어 이름) — 또렷이 보일 때까지 기다린다
const head = String(pick ?? '').split('(')[0].trim();
await page.evaluate((t) => {
  const g = window.game;
  g.ai.setTechCue(t, 'unique');
  g.player.uniqueCue = { ...g.enemy.techCue, who: 'me', t: Math.random() };
}, pick);
await page
  .waitForFunction((h) => { const el = document.querySelector('#techSlot .slot'); return el.classList.contains('show') && el.innerText.includes(h) && +getComputedStyle(el).opacity > 0.9; }, head, { timeout: 60000, polling: 50 })
  .catch(() => console.log('NOTE: ② 에 이름이 또렷이 뜨지 않았다'));
const hud = await page.evaluate(() => ({ guard: document.getElementById('guardName').innerText.replace(/\s+/g, ' ').trim(), cue: document.getElementById('techCue').innerText.replace(/\s+/g, ' ').trim() }));
await page.screenshot({ path: out });
console.log(JSON.stringify({ uniqueNames: names, feintKey, hud, errors }, null, 1));
console.log(errors.length ? `콘솔 에러 ${errors.length}` : '콘솔 에러 0');
await browser.close();
process.exit(errors.length || (feintKey && !feintKey.found) ? 1 : 0);
