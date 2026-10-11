// 샛별 가져오기 2차 확인 그림 (10/12, docs/import/saetbyeol_round2_2026-10-12.md) — 작게 몇 장만
//  ① 리볼버: 마야(id samira, 권총) 대 나(롱소드) — 겨눔 레이저가 상반신 둘레에 있는가 · 콘솔 에러 0
//  ② 내려찍기: 상대를 크게 넘어뜨리고(AI 멈춤) 탭 한 번 — 주소 스위치(?finishMode=power25 등)를 그대로 붙여 같은 장면을 견준다
//  ③ voices.html: 듣기 화면이 뜨는가 (버튼 수 · 콘솔 에러 0)
//  실행: vite 개발 서버(디렉터 5173·5174 말고 내 포트)를 띄운 뒤
//    node tools/browser/sb_import2_shots.mjs http://127.0.0.1:5291 docs/handoff/sb_import2
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). SwiftShader 라 물리는 실제 시간보다 느리다(실기기 성능 아님)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5291').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/sb_import2';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => r.status() >= 400 && errors.push(`http ${r.status()}: ${r.url()}`));
  await page.goto(base + url, { waitUntil: 'networkidle' });
  return { page, errors };
}
async function fight(page) {
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.evaluate(() => document.getElementById('btnStart')?.click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.addStyleTag({ content: '#toast { opacity: 0 !important; }' });
}
const simT = (page) => page.evaluate(() => window.game.stats.simTime);
async function waitSim(page, secs) {
  const t0 = await simT(page);
  while ((await simT(page)) < t0 + secs) await page.waitForTimeout(200);
}

// ① 리볼버
{
  const { page, errors } = await open('/?test=1&weapon=longsword&hero=player&foe=samira&stage=cathedral');
  await fight(page);
  await waitSim(page, 3.5);
  await page.screenshot({ path: `${out}/revolver_aim.png` });
  const s = await page.evaluate(() => {
    const e = window.game.enemy;
    return { foe: e.weapon.id, k: e.gunCooldownK ?? 1, ammo: e.gun?.ammo ?? null, what: e.gun?.what ?? null, sim: +window.game.stats.simTime.toFixed(1) };
  });
  console.log('revolver', JSON.stringify(s), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}

// ② 내려찍기 (같은 장면, 스위치만 다르게)
for (const [tag, q] of [['kill', ''], ['power25', '&finishMode=power25']]) {
  const { page, errors } = await open(`/?test=1&weapon=longsword&hero=player&foe=isolde&stage=cathedral${q}`);
  await fight(page);
  await waitSim(page, 2.4);
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => {};
    g.enemy.knockDown(true);
    g.enemy.downTime = 1e9;
    window.__hits = [];
    const C = g.combat;
    const orig = C.strike.bind(C);
    C.strike = (pr, point, passing) => {
      const r = orig(pr, point, passing);
      if (r && pr.w.fighter === g.player && pr.v?.fighter === g.enemy && (r.type === 'stab' || r.finish)) window.__hits.push({ part: pr.v.part, type: r.type, finish: !!r.finish, power: r.finishPower ?? 1, sev: +r.severity.toFixed(2), eff: r.eff == null ? null : +r.eff.toFixed(0), thr: r.thr });
      return r;
    };
  });
  await waitSim(page, 2.5);
  // 찍기 자세(finish.on)가 켜질 때까지 천천히 걸어간다 (W 키 × 0.3 — finish_shots.mjs 와 같은 꾀), 켜지면 멈춰 선다
  await page.evaluate(() => {
    const mv = window.game.player.move;
    const set = mv.set.bind(mv);
    mv.set = (x, y) => set(x * 0.3, y * 0.3);
  });
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 200 && !(await page.evaluate(() => window.game.player.finish.on)); i++) await page.waitForTimeout(100);
  await page.keyboard.up('KeyW');
  await waitSim(page, 0.6);
  const tapped =await page.evaluate(() => window.game.player.skill.thrust() && !!window.game.player.skill.tap?.down);
  // 찍기 시작(go)까지 기다렸다 한 장, 끝난 뒤 한 장
  for (let i = 0; i < 150 && !(await page.evaluate(() => !!window.game.player.skill.tap?.go || !window.game.player.skill.tap)); i++) await page.waitForTimeout(100);
  await page.screenshot({ path: `${out}/plunge_${tag}_go.png` });
  await waitSim(page, 2.5);
  await page.screenshot({ path: `${out}/plunge_${tag}_after.png` });
  const s = await page.evaluate(() => ({ alive: window.game.enemy.alive, cause: window.game.enemy.causeOfDeath ?? null, hits: window.__hits.slice(0, 3) }));
  console.log('plunge', tag, 'tap→찍기', tapped, JSON.stringify(s), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}

// ③ 듣기 화면
{
  const { page, errors } = await open('/voices.html');
  await page.waitForFunction(() => document.querySelectorAll('#characters button').length > 0, null, { timeout: 30000 });
  const n = await page.evaluate(() => ({ cards: document.querySelectorAll('#characters section').length, buttons: document.querySelectorAll('#characters button').length }));
  await page.screenshot({ path: `${out}/voices_page.png` });
  console.log('voices', JSON.stringify(n), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}
await browser.close();
console.log(fail ? `FAIL ${fail}` : 'OK');
process.exit(fail ? 1 : 0);
