// 등 뒤 알림 화살표 브라우저 점검 (11/18 무리 싸움 판단 P3 — [사장님 11/18 결정 7] · src/team_hud.js · src/team_sense.js backThreat · 기록 docs/strike/team_sense_p3_2026-11-18.md):
//  1:2 판(사람 몸은 서 있기만) — 시험만: 나를 겨눠 치는 AI 반대쪽으로 사람 몸을 돌려 등 뒤 공격을 만들고, 카메라를 판 밖 하늘로 옮겨(game.freeCam) 모든 몸을 화면 밖(가장자리 화살표 길)으로 둠.
//  스텝마다 backThreat 와 같은 셈(나를 겨눔 · 공격 꼴 · 칼끝 + 0.5 안 · 바라보는 쪽에서 90° 넘게 뒤)이 서는 때(cond)와 화살표 data-warn 이 '1' 인 때(warn)를 함께 셈 —
//  끝 코드 0 = cond 가 한 번 넘게 섰고 그때마다 warn · cond 없이 warn 없음 · 페이지 오류 0.
//  실행: npm run build && npx vite preview --port 4391 --strictPort & → node tools/browser/team_back_arrow_check.mjs http://127.0.0.1:4391
//  playwright 는 저장소 의존성에 없다 (team_smoke.mjs 와 같음 — 크롬 PW_CHROMIUM · 기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:4391').replace(/\/$/, '');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.clock.install({ time: new Date('2026-11-18T21:00:00+09:00') });
await page.goto(base + '/?team=1v2&test=1&weapon=longsword&emo=0', { waitUntil: 'networkidle' });
await page.clock.runFor(500);
for (let i = 0; i < 200 && !(await page.evaluate(() => !!window.game?.renderCap)); i++) await page.clock.runFor(100);
await page.evaluate(() => document.getElementById('btnStart').click());
for (let i = 0; i < 400 && !(await page.evaluate(() => game.state === 'fight' && !!game.teamRun)); i++) await page.clock.runFor(50);
await page.evaluate(() => { game.renderCap.tick = () => false; });
let samples = 0, cond = 0, warn = 0, both = 0;
for (let i = 0; i < 1200; i++) {
  await page.evaluate(() => {
    const H = game.teamRun?.human;
    if (!H?.alive) return;
    game.freeCam = true;
    game.camera.position.set(0, 30, 40);
    game.camera.lookAt(0, 30, 80);
    game.camera.updateMatrixWorld();
    const p = H.bodies.chest.translation();
    for (const g of game.fighters) if (g !== H && g.alive && g.foe === H && g.aiCtl?.mode === 'attack') { const q = g.bodies.chest.translation(); H.heading = Math.atan2(-(p.z - q.z), p.x - q.x); break; }
  });
  await page.clock.runFor(50);
  const r = await page.evaluate(() => {
    const H = game.teamRun?.human;
    if (!H || !H.alive || game.teamRun.M.over) return null;
    const p = H.bodies.chest.translation();
    let c = false;
    for (const g of game.fighters) {
      if (g === H || !g.alive || g.foe !== H || g.aiCtl?.mode !== 'attack') continue;
      const q = g.bodies.chest.translation(), x = q.x - p.x, z = q.z - p.z, d = Math.hypot(x, z);
      if (d <= (g.aiCtl?.M?.reach ?? 1.8) + 0.5 && (x * Math.cos(H.heading) - z * Math.sin(H.heading)) / d < 0) c = true;
    }
    return { c, w: [...document.querySelectorAll('#teamHud .th-arrow')].some((a) => a.dataset.warn === '1') };
  });
  if (!r) break;
  samples++;
  if (r.c) cond++;
  if (r.w) warn++;
  if (r.c && r.w) both++;
}
await browser.close();
const ok = !errors.length && cond > 0 && both === cond && warn === cond;
console.log(JSON.stringify({ samples, cond, warn, both, errors }));
console.log(ok ? 'PASS 등 뒤 알림 — 등 뒤 공격마다 화살표 깜빡 · 그 밖엔 없음' : 'FAIL');
process.exit(ok ? 0 : 1);
