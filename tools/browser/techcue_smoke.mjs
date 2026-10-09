// 유파 기술 알림(#techCue, 10/9) 브라우저 확인: 상대 무기를 정해 싸움을 띄우고 #techCue 가 보이는 순간 스크린샷 한 장. 설정 끔/켬도 본다
//  실행: npx vite build && npx vite preview --port 4173 --strictPort &
//        node tools/browser/techcue_smoke.mjs http://127.0.0.1:4173 <스크린샷 폴더> ['?weapon=longsword&foeWeapon=monohoshizao'] [벽시계 한도 ms]
//  소프트웨어 GL 은 느리다(벽 10 s ≈ 게임 1~2 s) — 한도를 넉넉히. playwright 는 저장소 의존성에 없다 (npm i --no-save playwright)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const shotDir = process.argv[3] || '.';
const q = process.argv[4] || '?weapon=longsword&foeWeapon=monohoshizao';
const wallMax = +(process.argv[5] || 240000);
fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 480, height: 840 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + '/' + q, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
// 메뉴: 알림 칸이 있고 설정 줄이 보이며 켬이 기본, 메뉴 동안엔 숨김
const pre = await page.evaluate(() => ({
  el: !!document.getElementById('techCue'),
  row: [...document.querySelectorAll('#menu [data-setting="techCue"]')].map((el) => `${el.closest('.row').innerText.trim()}:${el.classList.contains('on') ? 'on' : 'off'}:${el.offsetWidth ? 'visible' : 'hidden'}`),
  menuShown: document.getElementById('techCue').classList.contains('show'),
}));
console.log('PRE ' + JSON.stringify(pre));
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
const t0 = Date.now();
let found = null;
const seen = [];
let lastCue = null;
while (Date.now() - t0 < wallMax) {
  await page.waitForTimeout(120);
  const r = await page.evaluate(() => {
    const el = document.getElementById('techCue');
    const c = window.game.enemy?.techCue;
    return { show: el.classList.contains('show'), op: +getComputedStyle(el).opacity, text: el.innerText.replace(/\s+/g, ' ').trim(), cue: c ? `${c.text}/${c.kind}` : null, cueT: c?.t ?? null, sim: +window.game.stats.simTime.toFixed(2), state: window.game.state, eAlive: !!window.game.enemy?.alive, passives: window.game.ai?.stats?.passives ?? null };
  });
  if (r.cue && r.cueT !== lastCue) { lastCue = r.cueT; seen.push(`${r.cue}@${r.sim}`); }
  if (r.show && r.op > 0.6) {
    found = r;
    await page.screenshot({ path: `${shotDir}/techcue.png` });
    break;
  }
  if (r.state !== 'fight') { found = { ended: r }; break; }
}
console.log('FOUND ' + JSON.stringify(found) + ` wall ${((Date.now() - t0) / 1000).toFixed(0)}s`);
// 설정 끔/켬 + 일시정지: 같은 꼴의 알림을 직접 적어 숨김/보임을 본다 (AI 를 건드리지 않는 화면 쪽 확인)
const tog = await page.evaluate(async () => {
  const g = window.game;
  const el = document.getElementById('techCue');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  if (g.state !== 'fight' || !g.enemy?.alive) return { skipped: g.state };
  g.settings.techCue = false;
  g.enemy.techCue = { text: '시험 끔', kind: 'passive', schoolKo: '일본', t: -1 };
  await wait(500);
  out.offShown = el.classList.contains('show');
  g.settings.techCue = true;
  g.enemy.techCue = { text: '시험 켬', kind: 'unique', schoolKo: '일본', t: -2 };
  await wait(500);
  out.onShown = el.classList.contains('show');
  out.onText = el.innerText.replace(/\s+/g, ' ');
  const b = el.getBoundingClientRect();
  out.box = [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)];
  return out;
});
console.log('TOGGLE ' + JSON.stringify(tog));
console.log('SEEN ' + JSON.stringify(seen.slice(0, 30)));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
