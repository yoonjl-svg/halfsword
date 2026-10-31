// 겹치기 자동 실제 빌드 점검 (사장님 10/31 16:xx '겹치기는 추가 커맨드 없이 일정 조건 충족하면 자동으로' — 시제품 `?dupAuto=bind|clash2` · 기록 docs/strike/duplieren_auto_2026-10-31.md)
//  빌드(dist)를 정적 서버로 · 롱소드 대 롱소드 · `?skillNodes=G7`(그 칸만 익힌 판) · 상대 멈춤 · 시작 가슴 사이 GAP(1.15 m — 띠 안).
//  칼끼리 닿음만 손으로 놓음(bladeTouch 참 — 실제로 맞대려면 손가락 봇이 필요해 이 점검은 연결만 봄) → 주소 값이 config 에 들어갔나 · 쌓임이 차나 · 자세 칸 '겹치기 · 맞물림' ·
//  운동학 칼(iai tech duplieren)이 나가나 · 낸 수 · 페이지 오류 · 판 둘(주소 없음 = 지금 판: 안 나감)
//  실행: npm run build → python3 -m http.server <포트> --directory dist --bind 127.0.0.1 &  · node tools/browser/duplieren_auto_probe.mjs http://127.0.0.1:<포트> [폴더 (기본 .tmp/dup_auto_browser)]
import fs from 'node:fs';
// playwright: 저장소에 없으면 전역 설치(npm root -g)에서 (PW_MODULE 로 바꿈)
const { chromium } = await import('playwright').catch(() => import(process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs'));
const base = process.argv[2] || 'http://127.0.0.1:5411';
const out = process.argv[3] || '.tmp/dup_auto_browser';
fs.mkdirSync(out, { recursive: true });
const GAP = +(process.env.GAP || 1.15);
const CASES = [
  ['bind', '&dupAuto=bind&dupStackS=0.6&dupBandMax=1.4'],
  ['off', ''],
  ['clash2', '&dupAuto=clash2&dupClashT=1.2'],
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const res = {};
for (const [tag, extra] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/?weapon=longsword&foeWeapon=longsword&skillNodes=G7&slowMo=0&camOpen=old${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 240000 });
  await page.evaluate((gap) => { game.config.ARENA.startGap = gap; game.config.ARENA.startHold = 0; }, GAP);
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 0.6, null, { timeout: 240000 });
  const kit = await page.evaluate(() => {
    const g = window.game, p = g.player, e = g.enemy, u = p.skill.uniq;
    const UA = g.config.UNIQUE_ASSIST;
    g.ai.update = () => e.move.set(0, 0);
    if (!u) return { err: 'no uniq' };
    const L = (window.dupLog = { st: [], cue: [], guard: new Set(), iai: 0, t0: g.stats.simTime, pulse: 0 });
    // 칼끼리 닿음: bind = 늘 닿음 · clash2 = 0.15 s 닿고 0.35 s 떨어짐 되풀이 (둘째 닿음에 나가야 함)
    u.bladeTouch = () => (UA.dupAuto === 'clash2' ? ((g.stats.simTime - L.t0) % 0.5) < 0.15 : true);
    const st0 = p.step.bind(p);
    p.step = function (dt) {
      const r = st0(dt);
      L.st.push(+(u.dupA?.st ?? 0).toFixed(3));
      if (u.dupCue) L.cue.push(u.dupCue.sub);
      if (p.iai?.tech === 'duplieren') L.iai++;
      const gn = document.getElementById('guardName')?.textContent;
      if (gn) L.guard.add(gn);
      return r;
    };
    return { dupAuto: UA.dupAuto, dupStackS: UA.dupStackS, dupBandMax: UA.dupBandMax, dupClashT: UA.dupClashT, tempo: g.tempo, unique: u.list.map((x) => x.name), dupE: !!u.dupE, dist: +p.foeDistance().toFixed(3) };
  });
  // 게임 시간으로 SIM 초 (느린 기계 — 그림 그리기가 느려 벽시계로는 못 잼)
  await page.waitForFunction((s) => window.game.stats.simTime - window.dupLog.t0 >= s || window.dupLog.iai > 30, +(process.env.SIM || 2.5), { timeout: 900000, polling: 250 });
  const got = await page.evaluate(() => {
    const g = window.game, u = g.player.skill.uniq, L = window.dupLog;
    return { simT: +(g.stats.simTime - L.t0).toFixed(2), stMax: Math.max(0, ...L.st), cueSteps: L.cue.length, guardTexts: [...L.guard].slice(0, 8), iaiSteps: L.iai, fired: u.stats.fired?.duplieren ?? 0, autoFired: u.stats.autoFired ?? 0, dist: +g.player.foeDistance().toFixed(3) };
  });
  await page.screenshot({ path: `${out}/${tag}.png` });
  res[tag] = { kit, got, errors: errors.slice(0, 5) };
  console.log(tag, JSON.stringify(res[tag]));
  await ctx.close();
}
fs.writeFileSync(`${out}/result.json`, JSON.stringify(res, null, 1));
await browser.close();
