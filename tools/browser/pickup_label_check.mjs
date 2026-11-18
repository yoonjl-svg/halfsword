// 떨어진 칼 줍기 — 실제 브라우저 입력 길 점검 (11/18 사장님 '줍기가 작동 안해' 조사 → [사장님 11/18 결정] 저절로 줍기 · 칼 팔 다침 한 줄 —
//  기록 docs/strike/pickup_fix_2026-11-18.md · docs/strike/auto_pickup_2026-11-18.md · src/pickup.js humanPickup)
//  시뮬 시험(tools/sim/auto_pickup.test.mjs)은 main.js 를 거치지 않는다 — 입력 버림(이동 · 공격 · 막기 — main.js playerInputFrame player.autoPick) · 막기 단추 글 ·
//  알림 줄(#emoMsg '칼 팔을 다쳐 칼을 쥘 수 없다') · 공격 조이스틱 켬(?atkStick=stick) 은 여기서만 본다. 판마다 상대 AI 를 세워 두고 내 칼을 떨군 바로 그 때 칼을 몸 기준 자리에 둠:
//   ① 앞 1.2 m (PICKUP.near 안) — 칼과 반대로 걷는 키(S)와 막기(F · 막기 단추)를 누른 채인데도 저절로 다가가 주움 · 그동안 막기 안 쥠 · 글 '줍기' · 다시 쥔 뒤 '막기' · 손 돌려줌
//   ② 뒤 2.3 m (near 밖) — 1.5 s 동안 시작 안 함 · 몸이 칼로 안 감 → 뒤로 걸어(S) near 안에 들면 저절로 → 키를 떼도 주움
//   ③ 칼 팔을 크게 다침(limbs.armS 0.1 < VITALS.dropSwordArm) — 알림 줄 한 번 · 글 '막기' 그대로 · 칼이 곁에 있어도 안 주움
//  판: 데스크톱(F 키) · 폰 가로(터치 · 막기 단추) · 폰 가로 + 공격 조이스틱 켬
//  실행 (저장소 뿌리): npx vite --host 127.0.0.1 --port 5191 --strictPort & → node tools/browser/pickup_label_check.mjs [주소 http://127.0.0.1:5191] [판 desk,touch,stick] [그림 폴더 — 주면 폰 판 그림 둘]
//  끝 코드 0 = 모두 맞음 · 페이지 오류 0. 환경 PW_CHROMIUM (크로미움 실행 파일 — 없으면 playwright 기본)
import fs from 'node:fs';
import { createRequire } from 'node:module';
// playwright 는 저장소 의존성에 없음 — 깔린 자리(NODE_PATH · 전역)에서 require 로 (ESM import 는 NODE_PATH 를 안 봄)
const { chromium } = createRequire(import.meta.url)('playwright');

const base = (process.argv[2] || 'http://127.0.0.1:5191').replace(/\/$/, '');
const cases = (process.argv[3] || 'desk,touch,stick').split(',');
const shots = process.argv[4] || null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const LINE = '칼 팔을 다쳐 칼을 쥘 수 없다';
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
    const st = () => page.evaluate(() => { const P = game.player, p = P.bodies.pelvis.translation(), s = P.sword.translation(); return { armed: P.armed, auto: !!P.autoPick, phase: P.pickup?.phase ?? null, d: Math.hypot(s.x - p.x, s.z - p.z), px: p.x, pz: p.z, held: !!game.playerGuard?.held, label: document.getElementById('btnParry').textContent }; });
    const simT = () => page.evaluate(() => game.stats.simTime);
    const waitSim = async (s) => { const t = await simT(); await page.waitForFunction((u) => game.stats.simTime > u, t + s, { timeout: 120000 }); };
    /** 칼을 떨군 바로 그 때 몸 기준 자리(dist m · 방향 a° — 0 = 앞 · 180 = 뒤)에 둠 (arm = 칼 팔 기능 · null 이면 그대로) → 멈출 때까지 */
    const drop = async (dist, a, arm = null) => {
      await page.evaluate(([dist, a, arm]) => {
        const P = game.player;
        if (arm != null) P.limbs.armS = arm;
        P.dropSword();
        const p = P.bodies.pelvis.translation(), F = P.forward(), R = P.right(), th = (a * Math.PI) / 180;
        P.sword.setTranslation({ x: p.x + (F.x * Math.cos(th) + R.x * Math.sin(th)) * dist, y: 0.15, z: p.z + (F.z * Math.cos(th) + R.z * Math.sin(th)) * dist }, true);
        P.sword.setLinvel({ x: 0, y: 0, z: 0 }, true); P.sword.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }, [dist, a, arm]);
    };
    let cdp = null;
    const block = async (on) => {
      if (!touch) return on ? page.keyboard.down('KeyF') : page.keyboard.up('KeyF');
      cdp ??= await ctx.newCDPSession(page);
      if (!on) return cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const bb = await page.locator('#btnParry').boundingBox();
      if (!bb) return fail('막기 단추가 안 보임');
      return cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 7 }] });
    };
    const shot = async (name) => { if (shots && kind === 'touch') await page.screenshot({ path: `${shots}/${name}.jpg`, type: 'jpeg', quality: 80 }); };
    const R = (report[kind] = {});
    // ① near 안 — 반대로 걷는 키 · 막기를 누른 채 저절로 주움
    await page.keyboard.down('KeyS');
    await block(true);
    await drop(1.2, 0);
    await page.waitForFunction(() => !!game.player.autoPick, null, { timeout: 60000, polling: 'raf' }).catch(() => fail('① 저절로 줍기가 시작 안 됨'));
    R.start = await st();
    await page.waitForFunction(() => game.player.pickup?.phase === 'bend', null, { timeout: 60000, polling: 'raf' }).catch(() => fail('① 굽힘이 시작 안 됨'));
    R.bend = await st();
    if (R.bend.held) fail('① 저절로 줍는 동안 막기를 쥠'); // (시작 스텝은 한 프레임 늦게 버림 — main.js 는 지난 스텝의 player.autoPick 을 봄)
    await shot('auto_pickup_bend');
    await page.waitForFunction(() => game.player.armed && !game.player.pickup, null, { timeout: 120000 }).catch(() => fail('① 줍지 않음'));
    await page.keyboard.up('KeyS');
    await block(false);
    await waitSim(0.3);
    R.after = await st();
    R.log = await page.evaluate(() => game.player.pickupLog?.map((l) => l.why) ?? null);
    if (R.start.label !== '줍기' && R.bend.label !== '줍기') fail(`① 단추 글 ${R.start.label} · ${R.bend.label} (줍기 여야)`);
    if (R.after.label !== '막기' || R.after.auto || !R.after.armed) fail(`① 다시 쥔 뒤 ${JSON.stringify(R.after)}`);
    if (R.log?.[0] !== 'ok') fail(`① 줍기 기록 ${JSON.stringify(R.log)}`);
    // ② near 밖 — 시작 안 함 → 걸어 들면 저절로
    await drop(2.3, 180);
    await waitSim(0.6);
    const s0 = await st();
    await waitSim(1.5);
    R.far = await st();
    if (R.far.auto || R.far.armed || Math.hypot(R.far.px - s0.px, R.far.pz - s0.pz) > 0.15 || !(R.far.d > 1.5)) fail(`② near 밖인데 ${JSON.stringify(R.far)}`);
    await page.keyboard.down('KeyS');
    await page.waitForFunction(() => !!game.player.autoPick, null, { timeout: 120000, polling: 'raf' }).catch(() => fail('② 걸어 들어도 시작 안 됨'));
    R.walkIn = await st();
    await page.keyboard.up('KeyS');
    await page.waitForFunction(() => game.player.armed && !game.player.pickup, null, { timeout: 120000 }).catch(() => fail('② 줍지 않음'));
    if (!(R.walkIn.d <= 1.6)) fail(`② 시작 거리 ${R.walkIn.d.toFixed(2)}`);
    // ③ 칼 팔 크게 다침 — 한 줄 · 못 주움
    await waitSim(0.3);
    await drop(0.8, 0, 0.1);
    await page.waitForFunction((t) => document.getElementById('emoMsg').classList.contains('show') && document.getElementById('emoMsg').textContent === t, LINE, { timeout: 60000, polling: 'raf' }).catch(() => fail('③ 알림 줄이 안 뜸'));
    await shot('arm_drop_line');
    R.line = await page.evaluate(() => ({ text: document.getElementById('emoMsg').textContent, emo: document.getElementById('emoMsg').dataset.emotion, notes: game.player.armDropNotes }));
    await waitSim(2);
    R.arm = await st();
    R.arm.notes = await page.evaluate(() => game.player.armDropNotes);
    if (R.line.text !== LINE || R.arm.notes !== 1) fail(`③ 줄 ${JSON.stringify(R.line)} · 셈 ${R.arm.notes}`);
    if (R.arm.armed || R.arm.auto || R.arm.label !== '막기') fail(`③ 다친 팔 ${JSON.stringify(R.arm)}`);
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
