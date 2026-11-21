// 싸움 중 멈춤 = 모두 멈춤 — 실제 화면 확인 (11/21 감사 N-011 · 사장님 11/21 '멈춤 동안 멈춰.' · 기록 docs/strike/perf_2026-11-21.md)
//  시험 경로 1:1 판을 열어 싸우다 일시정지 → 멈춘 동안: 그린 수(renderer.info.render.frame) · 보는 시계(game.viewNow) · 무대 시계(game.stageT) · 게임 시간(stats.simTime)이
//  그대로인지(들어선 때 한 장만 그림) · 멈춘 동안 화면 크기를 바꾸면 한 장 더 그리고 다시 쉼 · 풀면 다시 흐르고 멈춘 시간만큼 앞으로 튀지 않는지 (보는 · 무대 시계가 풀린 뒤 흐른 만큼만 감)
//  실행: npx vite --port 5291 --strictPort &   node tools/browser/pause_freeze.mjs http://127.0.0.1:5291
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:5291';
const HOLD = 4000; // 멈춰 두는 실제 ms
const RUN = 2500; // 푼 뒤 보는 실제 ms
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(base + '/?test=1&weapon=longsword&foe=default&emo=0', { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 120000 });
await page.evaluate(() => document.getElementById('btnStart').click());
await page.waitForFunction(() => game.state === 'fight' && game.stats.simTime > 2, null, { timeout: 120000 });
const snap = () => page.evaluate(() => ({ frame: game.renderInfo().frame, view: game.viewNow(), stage: game.stageT(), sim: game.stats.simTime, state: game.state, wall: performance.now() }));
const s0 = await snap();
await page.evaluate(() => document.getElementById('btnPause').click());
await page.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
await page.waitForTimeout(800); // 들어선 한 장
const p0 = await snap();
await page.waitForTimeout(HOLD);
const p1 = await snap();
await page.setViewportSize({ width: 800, height: 380 }); // 멈춘 동안 화면 크기 바뀜 → 캔버스가 지워져 한 장 더
await page.waitForTimeout(1200);
const p2 = await snap();
await page.waitForTimeout(1500);
const p3 = await snap();
await page.evaluate(() => document.getElementById('btnResume').click());
const r0 = await snap();
await page.waitForTimeout(RUN);
const r1 = await snap();
await browser.close();

const rows = [];
const check = (name, ok, info) => rows.push({ name, ok: !!ok, info });
check('싸움 중 그림이 돎', p0.frame > s0.frame, `${s0.frame} → ${p0.frame}`);
check('멈춘 동안 그리지 않음', p1.frame === p0.frame, `${(p1.wall - p0.wall).toFixed(0)} ms 동안 그림 ${p1.frame - p0.frame}`);
check('멈춘 동안 보는 시계 그대로', p1.view === p0.view, `${(p1.view - p0.view).toFixed(3)} ms`);
check('멈춘 동안 무대 시계 그대로', p1.stage === p0.stage, `${(p1.stage - p0.stage).toFixed(4)} s`);
check('멈춘 동안 게임 시간 그대로', p1.sim === p0.sim, `${(p1.sim - p0.sim).toFixed(4)} s`);
check('화면 크기가 바뀌면 한 장 더', p2.frame - p1.frame >= 1 && p2.frame - p1.frame <= 2, `그림 ${p2.frame - p1.frame}`);
check('그 뒤 다시 쉼', p3.frame === p2.frame && p3.view === p0.view && p3.stage === p0.stage, `그림 ${p3.frame - p2.frame} · 보는 시계 ${(p3.view - p0.view).toFixed(3)} ms`);
const runWall = r1.wall - r0.wall;
check('풀면 다시 그림', r1.frame > p3.frame, `그림 ${r1.frame - p3.frame}`);
check('풀면 보는 시계가 풀린 뒤 흐른 만큼만 (멈춘 시간을 건너뛰지 않음)', r1.view - p3.view > 0 && r1.view - p3.view <= runWall + 50, `보는 ${(r1.view - p3.view).toFixed(0)} ms · 벽 ${runWall.toFixed(0)} ms (멈춤 ${(r0.wall - p0.wall).toFixed(0)} ms)`);
check('풀면 무대 시계도 그만큼만', r1.stage - p3.stage > 0 && r1.stage - p3.stage <= runWall / 1000 + 0.15, `${(r1.stage - p3.stage).toFixed(3)} s`);
check('페이지 에러 0', errors.length === 0, errors.slice(0, 2).join(' | '));
for (const r of rows) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name} — ${r.info}`);
const bad = rows.filter((r) => !r.ok).length;
console.log(bad ? `pause_freeze FAIL ${bad}` : 'pause_freeze PASS');
process.exit(bad ? 1 : 0);
