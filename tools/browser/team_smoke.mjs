// 동시 대전 브라우저 스모크 (3단계 10/29 — docs/strike/team_fight_2026-10-29.md §11): 2:2 · 2:1 · 1:2 · 지켜보기 · 생사전 길(game.launchSaengsa 가짜 setup)
//  판마다: 페이지 에러 0 · 콘솔 에러 0 · 판이 끝남(한 편 전멸 — teamRun.M.over) · 화면 844×390 스크린샷(시작 · 한창 · 끝) · 편 막대 · 화살표 수 · 생사전 판 뒤 1:1 이 다시 열림
//  시계는 playwright 시계로 빨리 돌린다(그리기는 스크린샷 때만 — renderCap.tick). 사람 몸은 손대지 않는다(서 있기만 — 동료 · 상대 AI 가 판을 끝냄)
//  끝에 ?fps=1 읽기(실제 시계 · 그리기 켬): 1:1 과 2:2 를 같은 브라우저에서 몇 초씩 — 폰 값과 견줄 메모 (headless swiftshader 라 그리기 ms 는 폰과 다르다 · 물리 ms 를 본다)
//  실행: npx vite build && npx vite preview --port 4391 --strictPort &
//        node tools/browser/team_smoke.mjs http://127.0.0.1:4391 <스크린샷 폴더>
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:4173';
const out = process.argv[3] || 'team_smoke_out';
const only = (process.argv.find((a) => a.startsWith('--only=')) ?? '').slice(7).split(',').filter(Boolean);
const MAX_SIM = 240; // 판 하나 최대 게임 시간(s) — 넘으면 실패
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });

/** 생사전 가짜 setup (가지 wk/saengsa docs/design/saengsa_2026-10-29.md §8 꼴) — 지켜보기 · 체력 · 부상을 지고 들어옴 */
const SAENGSA_SETUP = {
  matchId: 'smoke-1', round: 1, seed: 5, mineSide: 'a', control: 'watch',
  entrants: { a: ['0-0', '0-1'], b: ['5-0', '5-1'] },
  sides: {
    a: [
      { key: '0-0', id: 'nameless', weapon: 'longsword', school: 'german', tier: 1, prof: { german: 2 }, lent: false, hp: 70, injuries: [{ part: 'leg', sev: 0.3, rests: 1 }], dead: false, cloth: 1 },
      { key: '0-1', id: 'nameless', weapon: 'rapier', school: 'italian', tier: 1, prof: { italian: 2 }, lent: false, hp: 100, injuries: [], dead: false, cloth: 3 },
    ],
    b: [
      { key: '5-0', id: 'nameless', weapon: 'longsword', school: 'german', tier: 1, prof: { german: 2 }, lent: false, hp: 100, injuries: [], dead: false, cloth: 5 },
      { key: '5-1', id: 'nameless', weapon: 'sabre', school: 'none', tier: 1, prof: { german: 1 }, lent: false, hp: 55, injuries: [{ part: 'arm', sev: 0.4, rests: 0 }], dead: false, cloth: 7 },
    ],
  },
};

const CASES = [
  { id: '2v2', q: '?test=1&weapon=longsword&team=2v2&emo=0', n: 4, human: true },
  { id: '2v1', q: '?test=1&weapon=longsword&team=2v1&emo=0', n: 3, human: true },
  { id: '1v2', q: '?test=1&weapon=longsword&team=1v2&emo=0', n: 3, human: true },
  { id: 'watch', q: '?test=1&weapon=longsword&team=watch&emo=0', n: 4, human: false },
  { id: 'saengsa', q: '?test=1&weapon=longsword&emo=0', n: 4, human: false, saengsa: SAENGSA_SETUP },
].filter((c) => !only.length || only.includes(c.id));

const rows = [];
for (const C of CASES) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const row = { id: C.id, shots: [] };
  const shot = async (name) => {
    await page.evaluate(() => { game.renderCap.tick = () => true; });
    await page.clock.runFor(80);
    const path = `${out}/${C.id}-${name}.png`;
    await page.screenshot({ path });
    row.shots.push(path);
    await page.evaluate(() => { game.renderCap.tick = () => false; });
  };
  const look = () => page.evaluate(() => {
    const R = game.teamRun;
    const hud = document.getElementById('teamHud');
    return {
      state: game.state,
      sim: +game.stats.simTime.toFixed(2),
      over: !!R?.M.over,
      winner: R?.M.winner ?? null,
      n: game.fighters.length,
      alive: game.fighters.map((f) => (f.alive ? 1 : 0)).join(''),
      settled: game.fighters.map((f) => (f.settled ? 1 : 0)).join(''),
      focus: R?.focus?.index ?? null,
      human: R?.human?.index ?? null,
      bars: hud && hud.style.display !== 'none' ? hud.querySelectorAll('.th-row').length : 0,
      arrows: hud ? [...hud.querySelectorAll('.th-arrow[data-kind="edge"]')].filter((a) => a.style.display !== 'none').length : 0,
      heads: hud ? [...hud.querySelectorAll('.th-arrow[data-kind="head"]')].filter((a) => a.style.display !== 'none').length : 0,
      switches: R ? game.fighters.map((f) => R.M.targeting?.get(f)?.switches ?? 0) : [],
      names: game.fighters.map((f) => `${f.name}/${f.weapon.id}/t${f.team}`),
    };
  });
  try {
    await page.clock.install({ time: new Date('2026-10-29T21:00:00+09:00') });
    await page.goto(base + '/' + C.q, { waitUntil: 'networkidle' });
    await page.clock.runFor(500);
    if (C.saengsa) {
      await page.evaluate((setup) => { window.__saengsa = 'pending'; game.launchSaengsa(setup).then((r) => (window.__saengsa = r)); }, C.saengsa);
    } else {
      await page.evaluate(() => document.getElementById('btnStart').click());
    }
    for (let i = 0; i < 200 && !(await page.evaluate(() => game.state === 'fight' && !!game.teamRun)); i++) await page.clock.runFor(50);
    await page.evaluate(() => { game.renderCap.tick = () => false; });
    row.start = await look();
    await page.clock.runFor(2500);
    await shot('start');
    let L = await look();
    let mid = false;
    while (!L.over && L.sim < MAX_SIM && !errors.length) {
      await page.clock.runFor(2000);
      L = await look();
      if (!mid && (L.alive.includes('0') || L.sim > 25)) (mid = true), await shot('mid');
    }
    row.end = L;
    if (L.over) {
      await page.clock.runFor(600);
      await shot('end');
      if (C.saengsa) {
        for (let i = 0; i < 40 && (await page.evaluate(() => window.__saengsa === 'pending')); i++) await page.clock.runFor(250);
        row.saengsa = await page.evaluate(() => window.__saengsa);
        row.after = await page.evaluate(() => ({ state: game.state }));
        // 생사전 판 뒤에 1:1 이 다시 열리나 (대기실 여정 · 방랑 — startFight 가 막히지 않게)
        await page.evaluate(() => document.getElementById('btnStart').click());
        for (let i = 0; i < 200 && !(await page.evaluate(() => game.state === 'fight')); i++) await page.clock.runFor(50);
        row.oneAfter = await page.evaluate(() => ({ state: game.state, n: game.fighters.length, teamRun: !!game.teamRun }));
      } else {
        for (let i = 0; i < 40 && (await page.evaluate(() => game.state === 'fight')); i++) await page.clock.runFor(250);
        row.after = await page.evaluate(() => ({ state: game.state, title: document.getElementById('menuTitle')?.textContent, sub: document.getElementById('menuSub')?.textContent, again: document.getElementById('btnStart')?.textContent }));
        await shot('result');
      }
    }
  } catch (e) {
    errors.push('harness: ' + e.message.split('\n')[0]);
  }
  row.errors = errors;
  const okSaengsa = !C.saengsa || (row.saengsa && ['a', 'b'].includes(row.saengsa.winner) && Object.keys(row.saengsa.fighters).length === C.n && Object.values(row.saengsa.fighters).every((f) => Number.isInteger(f.hp) && Array.isArray(f.injuries) && typeof f.alive === 'boolean'));
  const okAfter = !C.saengsa || (row.oneAfter?.state === 'fight' && row.oneAfter.n === 2 && !row.oneAfter.teamRun);
  row.ok = !errors.length && !!row.end?.over && row.start?.n === C.n && (row.start?.human != null) === C.human && row.start?.bars === C.n && okSaengsa && okAfter;
  rows.push(row);
  console.log(JSON.stringify(row));
  await page.close();
}

// ?fps=1 읽기 (실제 시계 · 그리기 켬): 1:1 · 2:2 — 판 시작 4 s 뒤부터 4 s 동안의 마지막 표
const fps = [];
if (!only.length || only.includes('fps')) {
  for (const [id, q] of [['1v1', '?test=1&weapon=longsword&foe=default&emo=0&fps=1'], ['2v2', '?test=1&weapon=longsword&team=2v2&emo=0&fps=1'], ['watch', '?test=1&weapon=longsword&team=watch&emo=0&fps=1']]) {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    try {
      await page.goto(base + '/' + q, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.getElementById('btnStart').click());
      if (id === '1v1') {
        await page.waitForFunction(() => game.state === 'fight' || (game.state === 'draw' && game.draw?.stage === 'choose' && game.draw.t > 0.6), null, { timeout: 60000 });
        if (await page.evaluate(() => game.state === 'draw')) await page.locator('#draw .wcard[data-i="0"]').click();
      }
      await page.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
      await page.waitForTimeout(4000);
      const samples = [];
      for (let i = 0; i < 4; i++) {
        await page.waitForTimeout(1000);
        samples.push(await page.evaluate(() => [...document.body.children].find((el) => el.textContent.startsWith('FPS '))?.textContent ?? ''));
      }
      fps.push({ id, n: await page.evaluate(() => game.fighters.length), last: samples.at(-1), errors });
      await page.screenshot({ path: `${out}/fps-${id}.png` });
    } catch (e) {
      fps.push({ id, error: e.message.split('\n')[0], errors });
    }
    await page.close();
  }
  for (const f of fps) console.log('FPS ' + JSON.stringify(f));
}
await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify({ rows, fps }, null, 2));
const bad = rows.filter((r) => !r.ok);
console.log(bad.length ? `FAIL ${bad.length}/${rows.length}: ${bad.map((r) => r.id).join(', ')}` : `PASS ${rows.length}/${rows.length} (페이지 에러 0 · 판 끝남)`);
process.exit(bad.length ? 1 : 0);
