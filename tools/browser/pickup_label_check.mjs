// 떨어진 칼 줍기 — 실제 브라우저 입력 길 점검 (11/18 사장님 '줍기가 작동 안해' 조사 — 기록 docs/strike/pickup_fix_2026-11-18.md)
//  시뮬 시험(tools/sim/kote_pickup.test.mjs)은 main.js 를 거치지 않는다 — 막기 단추 글(updateParryLabel) · F 키 · 막기 단추 누르고 있기(parryHold → player.pickupPress) ·
//  공격 조이스틱 켬(?atkStick=stick) 은 여기서만 본다. 판마다 상대 AI 를 세워 두고(칼을 놓친 몸을 쫓지 않게) 내 칼을 떨군 뒤(fighter.dropSword — 손목 치기 떨굼과 같은 길)
//  칼을 몸 앞 0.7 m 에 놓아(떨어진 거리의 흩어짐을 빼고) ① 단추 글 '줍기' ② 누르고 있으면 주움(pickupLog ok) ③ 다시 쥔 뒤 글 '막기' 를 본다.
//  이어서 칼 팔을 크게 다친 몸(limbs.armS < VITALS.dropSwordArm — 11/05 설계: 칼을 쥘 힘이 없는 팔은 못 주움)은 글이 '막기' 그대로이고 눌러도 줍지 않는지.
//  판: 데스크톱(마우스 · F 키) · 폰 가로(터치 · 막기 단추) · 폰 가로 + 공격 조이스틱 켬
//  실행 (저장소 뿌리): npx vite --host 127.0.0.1 --port 5191 --strictPort & → node tools/browser/pickup_label_check.mjs [주소 http://127.0.0.1:5191] [판 desk,touch,stick]
//  끝 코드 0 = 모두 맞음 · 페이지 오류 0. 환경 PW_CHROMIUM (크로미움 실행 파일 — 없으면 playwright 기본)
import { createRequire } from 'node:module';
// playwright 는 저장소 의존성에 없음 — 깔린 자리(NODE_PATH · 전역)에서 require 로 (ESM import 는 NODE_PATH 를 안 봄)
const { chromium } = createRequire(import.meta.url)('playwright');

const base = (process.argv[2] || 'http://127.0.0.1:5191').replace(/\/$/, '');
const cases = (process.argv[3] || 'desk,touch,stick').split(',');
const IGNORED = /deprecated parameters for the initialization function|unsupported MIME type/; // 라파이어 초기화 경고 · 미리 보기 판의 sw.js 없음 (게임과 무관)
const fails = [];
const report = {};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  for (const kind of cases) {
    const touch = kind !== 'desk';
    const errors = [];
    const ctx = await browser.newContext(touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 720 } });
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
    page.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`console ${m.text().slice(0, 300)}`); });
    const fail = (msg) => fails.push(`${kind}: ${msg}`);
    await page.goto(`${base}/?weapon=longsword&foeWeapon=longsword&slowMo=0&emo=0${kind === 'stick' ? '&atkStick=stick' : ''}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
    await page.evaluate(() => { game.config.ARENA.startGap = 2.6; game.config.ARENA.startHold = 0; });
    await page.getByText('여정 시작', { exact: true }).click();
    await page.waitForFunction(() => window.game?.state === 'fight', null, { timeout: 180000 });
    await page.waitForFunction(() => game.stats.simTime > 3, null, { timeout: 300000 });
    await page.evaluate(() => { const g = window.game; g.ai.update = () => { g.enemy.move.set(0, 0); g.enemy.stickX = g.enemy.stickY = 0; }; });
    if (kind === 'stick' && !(await page.evaluate(() => document.body.classList.contains('atkstick')))) fail('공격 조이스틱이 안 켜짐');
    const label = () => page.evaluate(() => document.getElementById('btnParry').textContent);
    const simT = () => page.evaluate(() => game.stats.simTime);
    const waitSim = async (s) => { const t = await simT(); await page.waitForFunction((u) => game.stats.simTime > u, t + s, { timeout: 120000 }); };
    /** 칼을 떨구고(arm = 칼 팔 기능 · null 이면 그대로) 멈춘 뒤 몸 앞 0.7 m 에 둠 */
    const drop = async (arm) => {
      await page.evaluate((arm) => { const P = game.player; if (arm != null) P.limbs.armS = arm; P.dropSword(); }, arm);
      await waitSim(1.5);
      await page.evaluate(() => {
        const P = game.player, p = P.bodies.pelvis.translation(), s = P.sword.translation(), F = P.forward();
        P.sword.setTranslation({ x: p.x + F.x * 0.7, y: s.y, z: p.z + F.z * 0.7 }, true);
        P.sword.setLinvel({ x: 0, y: 0, z: 0 }, true); P.sword.setAngvel({ x: 0, y: 0, z: 0 }, true);
      });
      await waitSim(0.4);
    };
    let cdp = null;
    const press = async (on) => {
      if (!touch) return on ? page.keyboard.down('KeyF') : page.keyboard.up('KeyF');
      cdp ??= await ctx.newCDPSession(page);
      if (!on) return cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const bb = await page.locator('#btnParry').boundingBox();
      if (!bb) return fail('막기 단추가 안 보임');
      const x = bb.x + bb.width / 2, y = bb.y + bb.height / 2;
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id ?? null, [x, y]);
      if (hit !== 'btnParry') fail(`막기 단추 자리에 다른 것 (${hit})`);
      return cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 7 }] });
    };
    const R = (report[kind] = {});
    // ① ~ ③ 다칠 데 없는 팔 — 주움
    R.before = await label();
    await drop(null);
    R.near = await label();
    if (R.before !== '막기' || R.near !== '줍기') fail(`단추 글 ${R.before} → ${R.near} (막기 → 줍기 여야)`);
    await press(true);
    await page.waitForFunction(() => game.player.armed && !game.player.pickup, null, { timeout: 120000 }).catch(() => fail('누르고 있어도 줍지 않음'));
    await press(false);
    await waitSim(0.2);
    R.log = await page.evaluate(() => game.player.pickupLog ?? null);
    R.after = await label();
    if (!R.log?.[0]?.ok) fail(`줍기 기록 ${JSON.stringify(R.log)}`);
    if (R.after !== '막기') fail(`다시 쥔 뒤 단추 글 ${R.after}`);
    // ④ 칼 팔을 크게 다친 몸 — 글 '막기' 그대로 · 눌러도 안 주움 (11/05 설계)
    await drop(0.1);
    R.armLabel = await label();
    await press(true);
    await waitSim(1.0);
    await press(false);
    R.armArmed = await page.evaluate(() => game.player.armed);
    R.armLog = (await page.evaluate(() => game.player.pickupLog?.length ?? 0));
    if (R.armLabel !== '막기' || R.armArmed || R.armLog !== 1) fail(`다친 팔: 글 ${R.armLabel} · 쥠 ${R.armArmed} · 기록 ${R.armLog} (막기 · false · 1 이어야)`);
    R.errors = errors;
    for (const e of errors) fail(e);
    console.log(kind, JSON.stringify(R));
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(fails.length ? `FAIL ${fails.length}\n${fails.join('\n')}` : 'PASS');
process.exit(fails.length ? 1 : 0);
