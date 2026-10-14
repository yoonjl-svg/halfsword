// ─────────────────────────────────────────────────────────────
//  lava_finish_probe.mjs — 화산섬 '용암 속 마무리' 브라우저 확인 (docs/import/volcano_port_2026-10-14.md '용암 속 마무리' · 사장님 결정 10/14 23:0x 안 ①)
//   테스트 경로 그대로: index.html?test=1&weapon=longsword&hero=player&foe=<인물>&stage=etna&emo=0 · 헤드리스 · 화면 배율 1
//  실행: 개발 서버를 띄운 뒤  node tools/browser/lava_finish_probe.mjs <주소> <출력 폴더> [인물:시드 …]   (기본 heinrich:1 chanda:2 bran:3)
//  판마다: 상대 AI 만 끈 채(몸은 그대로 — 스틱 0) 플레이어를 내리막으로 걸려(바라보는 곳만 시험 장치 · 스틱 앞 1) 용암에 들어가 무릎 꿇게 하고(위치·피해를 넣지 않음),
//   처음 덴 뒤 2 s 에 AI 를 켠다 → 플레이어가 죽거나 AI 를 켠 뒤 LIMIT 초(물리 시간, 기본 300 — 시험 장치의 관찰 시간)까지.
//   기록: 닿음 · AI 켬 · 끝남(원인) · AI 화상 · 가슴 수평 거리 최소 · AI 골반 최대 z · 마무리 갈래(lavaFinishOpen) 켜진 시간 · 콘솔·페이지 오류 · HTTP 400 이상
//  결정적으로: 판을 여는 같은 자바스크립트 차례 안에서 Math.random 을 시드로 바꾸고, requestAnimationFrame 시각을 가짜 시계(한 화면 = STEP_MS)로 넘긴다.
//   그리기는 PAINT_EVERY 화면에 한 번만(물리 스텝·차례는 그대로 — 그리기를 덜 해 빨리 돈다). SHOT=1 이면 AI 가 마무리 갈래로 칠 때 한 장 찍는다(첫 판만)
//  playwright 는 저장소 의존성에 없다. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || path.join(tmpdir(), 'lava_finish');
const runs = (process.argv.length > 4 ? process.argv.slice(4) : ['heinrich:1', 'chanda:2', 'bran:3']).map((a) => { const [foe, seed] = a.split(':'); return { foe, seed: +seed || 1 }; });
const LIMIT = +(process.env.LIMIT || 300);
const STEP_MS = +(process.env.STEP_MS || 100); // 가짜 시계 한 화면 (main.js 가 dt 를 0.1 s 에서 자른다 · 템포 1.1 → 물리 0.11 s)
const PAINT_EVERY = +(process.env.PAINT_EVERY || 10);
const VIEW = { width: +(process.env.W || 844), height: +(process.env.H || 390) };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const rows = [];

for (const [n, run] of runs.entries()) {
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.addInitScript((stepMs) => {
    const real = window.requestAnimationFrame.bind(window);
    let vt = 0, lastReal = null;
    window.requestAnimationFrame = (cb) => real((t) => { if (t !== lastReal) { lastReal = t; vt += stepMs; } cb(vt); });
  }, STEP_MS);
  await page.goto(`${base}/index.html?test=1&weapon=longsword&hero=player&foe=${run.foe}&stage=etna&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 600000 });
  await page.evaluate(async ({ seed, limit, paintEvery, shot }) => {
    const nav = await import('/src/terrain_navigation.js');
    window.game.config.PHYSICS.maxStepsPerFrame = 24; // 한 화면에 물리 스텝을 더 (고정 스텝·차례는 그대로)
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    document.getElementById('btnStart').click();
    const g = window.game, ai = g.ai, P = g.player, E = g.enemy;
    const R = (window.__rec = { t: 0, contact: null, aiOn: null, end: null, cause: null, minD: Infinity, eMaxZ: -Infinity, finT: 0, burned: false, done: false, shotAt: null, foeName: E.name, foeWeapon: E.weapon?.id, pState: null, pZ: null });
    // 그리기 거르기: PAINT_EVERY 화면에 한 번 (찍을 때는 매 화면)
    let k = 0;
    const tick0 = g.renderCap.tick.bind(g.renderCap);
    g.renderCap.tick = (dt, fps) => { tick0(dt, fps); return window.__paintAll || ++k % paintEvery === 0; };
    // 플레이어: 덴 적이 없는 동안만 바라보는 곳을 내리막 먼 점(시작 자리 → 물가 너머 (−1.5, 5.6) 을 지나는 줄 — 시뮬 도구 faceP 와 같은 시험 장치)으로 두고
    //  스틱 앞 1 로 걸어 들어간다(판 시작 정지 2 s 뒤부터). 덴 뒤엔 스틱 0 · 바라보는 곳은 main.js 가 매 스텝 주는 상대 골반 그대로
    let faceReal = P.faceTarget;
    const faceFix = { x: P.bodies.pelvis.translation().x + (-1.5 - P.bodies.pelvis.translation().x) * 3, y: 0, z: 5.6 * 3 };
    Object.defineProperty(P, 'faceTarget', { configurable: true, get: () => (R.contact === null ? faceFix : faceReal), set: (v) => { faceReal = v; } });
    const mv = P.move, set0 = mv.set.bind(mv);
    mv.set = () => set0(0, P.alive && R.contact === null && R.t > 2.2 ? 1 : 0);
    const up = ai.update.bind(ai);
    ai.update = (dt) => {
      R.t += dt;
      if (R.aiOn === null) E.move.set(0, 0); // AI 끔 (몸은 그대로 — 판 시작 정지와 같은 꼴)
      else up(dt);
      if (P.lavaBurn && R.contact === null) R.contact = R.t;
      if (R.aiOn === null && R.contact !== null && R.t - R.contact > 2) R.aiOn = R.t;
      if (R.aiOn === null || R.done) return;
      const pc = P.bodies.chest.translation(), ec = E.bodies.chest.translation();
      const d = Math.hypot(ec.x - pc.x, ec.z - pc.z);
      R.minD = Math.min(R.minD, d);
      R.eMaxZ = Math.max(R.eMaxZ, E.bodies.pelvis.translation().z);
      const fin = nav.lavaFinishOpen(ai);
      if (fin) R.finT += dt;
      if (E.lavaBurn) R.burned = true;
      if (shot && R.shotAt === null && fin && ai.mode === 'attack' && ai.phase === 'strike' && d < 1.5) { R.shotAt = R.t - R.aiOn; window.__paintAll = true; }
      R.pState = P.state;
      R.pZ = P.bodies.pelvis.translation().z;
      if (!P.alive) { R.done = true; R.end = R.t - R.aiOn; R.cause = P.causeOfDeath ?? null; }
      else if (R.t - R.aiOn > limit) R.done = true;
    };
  }, { seed: run.seed, limit: LIMIT, paintEvery: PAINT_EVERY, shot: process.env.SHOT === '1' && n === 0 });
  const t0 = Date.now();
  let shotTaken = false;
  for (;;) {
    const rec = await page.waitForFunction(() => { const R = window.__rec; return (R.done || (R.shotAt !== null && !window.__shotDone)) && R; }, null, { timeout: 3600000, polling: 200 }).then((h) => h.jsonValue());
    if (!rec.done && !shotTaken) {
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${out}/lava_finish_${run.foe}_${run.seed}.png` });
      shotTaken = true;
      await page.evaluate(() => { window.__shotDone = true; window.__paintAll = false; });
      continue;
    }
    if (rec.done) break;
  }
  const rec = await page.evaluate(() => { const R = window.__rec, g = window.game; return { ...R, attacks: g.ai.stats.attacks, wounds: g.player.wounds?.length ?? 0, eState: g.enemy.state, eLegs: [g.enemy.limbs.legF, g.enemy.limbs.legB] }; });
  rows.push({ ...run, ...rec, wall: (Date.now() - t0) / 1000 });
  console.log(`${run.foe}:${run.seed} (${rec.foeName} · ${rec.foeWeapon}) 플레이어 닿음 ${rec.contact?.toFixed(1)} s · AI 켬 ${rec.aiOn?.toFixed(1)} s · ${rec.end !== null ? `켠 뒤 ${rec.end.toFixed(1)} s 에 끝남 (${rec.cause})` : `${LIMIT} s 안에 못 끝냄 (플레이어 ${rec.pState} z ${rec.pZ?.toFixed(2)})`} · AI 화상 ${rec.burned} · 가슴 수평 최소 ${(rec.minD ?? NaN).toFixed(3)} m · AI 골반 최대 z ${(rec.eMaxZ ?? NaN).toFixed(3)} · 마무리 갈래 ${rec.finT.toFixed(1)} s · 공격 ${rec.attacks} · 상처 ${rec.wounds}${rec.shotAt !== null ? ` · 그림 ${rec.shotAt.toFixed(1)} s` : ''} (${((Date.now() - t0) / 1000).toFixed(0)} s 걸림)`);
  await page.close();
}
writeFileSync(`${out}/lava_finish.json`, JSON.stringify(rows, null, 1));
console.log(errors.length ? `오류 ${errors.length}:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : '콘솔 오류 0 · HTTP 400 이상 0');
await browser.close();
