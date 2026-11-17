// ③ 자세 → 칼길 화면 점검 (11/17 — src/guard_line.js · config GUARD_LINE · 기록 docs/design/guard_line_2026-11-17.md §10)
//  폰 흉내(playwright devices 'iPhone 13 landscape') · 상대 AI(숙련 6) 가 공격 직전 자세 박자(ai.glBeat)로 손을 자세로 옮긴 끝 — 그 자세에서 칼이 나가기 직전 —
//   화면 시계를 세우고 옆에서 본 그림을 남김 (카메라는 game.freeCam 으로 두 몸 사이 옆 4 m · 그림만 — 게임 값 그대로). 사람 자리는 서 있기만(입력 없음)
//  실행 (저장소 뿌리): npx vite --port 5177 --strictPort --host 127.0.0.1 & → node tools/browser/guard_line_shots.mjs [주소 http://127.0.0.1:5177] [그림 폴더 docs/design/guard_line_2026-11-17]
//   환경: PW_CHROMIUM(크로미움 실행 파일 — 없으면 playwright 기본) · K(화면 시계 배 — 기본 0.25)
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium, devices } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] || 'http://127.0.0.1:5177';
const outDir = process.argv[3] || 'docs/design/guard_line_2026-11-17';
const K = +(process.env.K || 0.25);
fs.mkdirSync(outDir, { recursive: true });
const launch = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] };
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM;
const browser = await chromium.launch(launch);
const shot = (page, path) => page.screenshot({ path, scale: 'css', type: 'jpeg', quality: 80 });
const report = [];

// 무기 (유파) 셋 — 독일 롱소드 · 이탈리아 레이피어 · 일본 우치가타나
const CASES = [
  { tag: 'german', weapon: 'longsword' },
  { tag: 'italian', weapon: 'rapier' },
  { tag: 'japanese', weapon: 'uchigatana' },
];

for (const C of CASES) {
  const { defaultBrowserType, ...dev } = devices['iPhone 13 landscape'];
  void defaultBrowserType;
  const ctx = await browser.newContext({ ...dev });
  await ctx.addInitScript((K0) => {
    const raf = window.requestAnimationFrame.bind(window);
    const pn = performance.now.bind(performance);
    let last = pn(), acc = last;
    window.__timeK = K0;
    const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
    performance.now = clock;
    window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
  }, K);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/?weapon=${C.weapon}&foeWeapon=${C.weapon}&foe=default&foeProficiency=6&slowMo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
  await page.evaluate(() => { game.config.ARENA.startHold = 0; });
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 240000 });
  // 공격 직전 자세 박자의 끝 (손이 자세에 닿음 · 박자 남은 시간 < 0.06 s) — 화면 시계를 세움
  let got = null;
  try {
    await page.waitForFunction(() => {
      const ai = window.game.ai;
      const B = ai?.glBeat;
      if (!B || B.t > 0.06) return false;
      window.__timeK = 0;
      return true;
    }, null, { timeout: 180000, polling: 'raf' });
    got = await page.evaluate(() => {
      const g = window.game, ai = g.ai, E = g.enemy, P = g.player;
      const a = E.skill.aim;
      const pe = E.bodies.pelvis.translation(), pp = P.bodies.pelvis.translation();
      // 옆 카메라: 두 몸 가운데에서 둘을 잇는 줄에 직각으로 4 m · 가슴 높이
      const mx = (pe.x + pp.x) / 2, mz = (pe.z + pp.z) / 2;
      const dx = pe.x - pp.x, dz = pe.z - pp.z, n = Math.hypot(dx, dz) || 1;
      g.freeCam = true;
      g.camera.position.set(mx - (dz / n) * 4, 1.35, mz + (dx / n) * 4);
      g.camera.lookAt(mx, 1.1, mz);
      return { guard: ai.guard?.name, why: ai.glBeat?.why, aim: [+a.x.toFixed(3), +a.y.toFixed(3)], pad: ai.guard?.pad, d: +ai.d.toFixed(2), names: ai.art?.names?.length ?? null };
    });
    await page.waitForTimeout(600); // 세운 시계로 새 카메라 그림이 한 번 그려지게
    await shot(page, `${outDir}/${C.tag}_${got.guard}.jpg`);
    // 이어서: 그 자세에서 고른 기술 (시계를 다시 돌려 공격이 시작될 때까지)
    await page.evaluate(() => { window.__timeK = 0.1; window.game.freeCam = false; });
    await page.waitForFunction(() => window.game.ai.mode === 'attack' || !window.game.ai.glBeat, null, { timeout: 60000, polling: 'raf' });
    got.tech = await page.evaluate(() => ({ mode: window.game.ai.mode, tech: window.game.ai.tech?.name, open: window.game.ai.tech?.open }));
  } catch (e) {
    got = { error: String(e).slice(0, 200) };
  }
  report.push({ ...C, ...got, errors });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${outDir}/report.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
