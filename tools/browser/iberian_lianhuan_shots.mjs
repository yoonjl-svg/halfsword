// 이베리아 호 안쪽 비기 · 중국 연환삼격 이음새 고리 (10/10 04:4x 2단계) 캡처. 콘솔 에러 0.
//  docs/handoff/iberian_inside_sweep.png — 상대 츠바이핸더(이베리아)가 호 안쪽으로 들어온 나를 비켜 서며 크게 가로로 베는 순간 (가로 길 70 %)
//  docs/handoff/iberian_inside_shove.png — 그 베기가 내 칼에 막혀 나를 밀어낸 뒤 (막힘 0.25 s 뒤)
//  docs/handoff/lianhuan_loops.png — 상대 청강검(중국) 연환삼격 둘째 이음새 고리가 끝난 순간 · 상대 앞 비스듬한 카메라(고리는 상대 몸 앞 면에 그려진다)
//  이베리아 장면에서는 시험만 나(플레이어)의 상처를 끈다(막힘이 나올 때까지 여러 번 받게 — 상대 동작·물리는 그대로)
//  노란 선 = 시험만 덧그린 상대 칼끝 자취(물리 스텝마다 — 게임 화면에는 없음). 원하는 순간 물리 스텝 안에서 일시정지(P)로 멈춰 찍는다(메뉴는 가림).
//  비기가 오래 안 나오면 직접 낸다(조건 판정만 건너뜀 — 실행은 그대로).
//  실행: npx vite build && npx vite preview --port 4187 --strictPort &
//        node tools/browser/iberian_lianhuan_shots.mjs http://127.0.0.1:4187 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4187';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
async function open(q) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.evaluate(() => (window.game.config.SECRET.instantArcLife = 8));
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.combat, null, { timeout: 60000 });
  // 시험만: 기술 이름 알림을 가리고, 물리 스텝마다 상대 칼끝 자취를 적고, 조건(__pauseIf)이 차는 스텝에서 일시정지
  await page.evaluate(() => {
    document.getElementById('techCue').style.visibility = 'hidden';
    const g = window.game;
    window.__trace = [];
    window.__traceOn = false;
    window.__pauseIf = null;
    const c = g.combat;
    const o = c.afterStep.bind(c);
    c.afterStep = (...a) => {
      const r = o(...a);
      const e = g.enemy;
      if (window.__traceOn && e?.sword) window.__trace.push(e.bladePoint(1, new g.THREE.Vector3()));
      const P = window.__pauseIf;
      if (P && g.state === 'fight' && P(g)) {
        window.__pauseIf = null;
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
      }
      return r;
    };
  });
  return page;
}
const probe = (page) =>
  page.evaluate(() => {
    const g = window.game;
    const e = g.enemy;
    const I = e.iai;
    const run = g.ai.secretRun;
    const t = g.ai.tech;
    return { sim: +g.stats.simTime.toFixed(2), state: g.state, d: +g.player.foeDistance().toFixed(2), pAlive: g.player.alive, pState: g.player.state, aiStage: run?.stage ?? null, secret: run?.S.name ?? null, sweepU: I?.kind === 'sweep' ? +(I.u ?? 0).toFixed(2) : null, eRes: e.instantResult ? { hit: e.instantResult.hit, blocked: e.instantResult.blocked, E: Math.round(e.instantResult.energy) } : null, tech: run ? t?.name ?? null : null, inLoop: !!(run && t?.pre && g.ai.path.length > t.path.length), fired: g.ai.stats.secrets?.[g.ai.secret?.name]?.fired ?? 0, trace: window.__trace.length };
  });
// 멈춘 장면을 찍는다: cam 'side' = 두 사람 줄에 수직(높이 h, 거리 back) · 'game' = 게임 카메라. 노란 칼끝 자취 덧그림 → 찍고 → 지우고 → 이어 감
async function shoot(page, path, cam = 'side', h = 1.6, back = 3.6) {
  await page.evaluate(
    ([cam, h, back]) => {
      const g = window.game;
      document.getElementById('menu').style.visibility = 'hidden';
      if (cam === 'front') {
        // 상대 앞 면을 비스듬히 (상대 앞 1.8 m · 옆 3.0 m — 고리가 내 몸에 가리지 않게)
        const a = g.player.bodies.chest.translation();
        const b = g.enemy.bodies.chest.translation();
        const dx = b.x - a.x, dz = b.z - a.z;
        const L = Math.hypot(dx, dz) || 1;
        g.freeCam = true;
        g.camera.position.set(b.x - (dx / L) * 1.8 + (dz / L) * 3.0, h, b.z - (dz / L) * 1.8 - (dx / L) * 3.0);
        g.camera.lookAt(b.x, 1.35, b.z);
      }
      if (cam === 'side') {
        const a = g.player.bodies.chest.translation();
        const b = g.enemy.bodies.chest.translation();
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        const dx = b.x - a.x, dz = b.z - a.z;
        const L = Math.hypot(dx, dz) || 1;
        g.freeCam = true;
        g.camera.position.set(mx - (dz / L) * back, h, mz + (dx / L) * back);
        g.camera.lookAt(mx, 1.0, mz);
      }
    },
    [cam, h, back],
  );
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const g = window.game;
    g.camera.updateMatrixWorld();
    const cv = document.createElement('canvas');
    cv.id = '__ov';
    cv.width = innerWidth;
    cv.height = innerHeight;
    Object.assign(cv.style, { position: 'fixed', left: 0, top: 0, pointerEvents: 'none', zIndex: 50 });
    document.body.appendChild(cv);
    const x = cv.getContext('2d');
    x.strokeStyle = 'rgba(255,215,60,0.95)';
    x.lineWidth = 2.5;
    x.beginPath();
    window.__trace.forEach((p, i) => {
      const q = p.clone().project(g.camera);
      const sx = (q.x * 0.5 + 0.5) * innerWidth;
      const sy = (-q.y * 0.5 + 0.5) * innerHeight;
      if (i) x.lineTo(sx, sy);
      else x.moveTo(sx, sy);
    });
    x.stroke();
  });
  await page.screenshot({ path });
  await page.evaluate(() => {
    document.getElementById('__ov')?.remove();
    document.getElementById('menu').style.visibility = '';
    window.game.freeCam = false;
    if (window.game.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  });
}
async function waitFor(page, pred, ms, step = 60) {
  const t0 = Date.now();
  let r = await probe(page);
  while (!pred(r) && Date.now() - t0 < ms && (r.state === 'fight' || r.state === 'paused')) {
    await page.waitForTimeout(step);
    r = await probe(page);
  }
  return r;
}
// ① 이베리아 (ONLY=lianhuan 이면 건너뜀): 내가 걸어 들어가 상대 칼 호 안쪽으로 → 휩쓸기 가로 길 70 % 에서 멈춰 찍음 · 막히면 0.25 s 뒤 멈춰 찍음
if (process.env.ONLY !== 'lianhuan') {
  const page = await open('?weapon=longsword&foeWeapon=zweihander');
  // 시험만: 나(플레이어)는 상처를 받지 않는다 — 막힘 장면이 나올 때까지 여러 번 받아 보게 (상대 동작·물리 그대로)
  await page.evaluate(() => (window.game.player.applyWound = () => {}));
  let shotSweep = false;
  let shotShove = false;
  for (let k = 0; k < 16 && !(shotSweep && shotShove); k++) {
    // 휩쓸기가 시작되면 칼끝 자취를 새로 · 가로 길 70 %(맞음·막힘 전) 에서 멈춤 · 막힘이면 0.25 s 뒤 멈춤
    await page.evaluate(
      ([wantSweep]) => {
        const g = window.game;
        window.__traceOn = false;
        let blockT = null;
        window.__pauseIf = (g) => {
          const I = g.enemy.iai;
          if (I?.kind === 'sweep' && !window.__traceOn) {
            window.__trace = [];
            window.__traceOn = true;
          }
          if (wantSweep && I?.kind === 'sweep' && (I.u ?? 0) >= 0.3 + 0.7 * 0.6 && !I.blocked) return (window.__shot = 'sweep');
          const R = g.enemy.instantResult;
          if (R?.blocked && blockT == null) blockT = g.stats.simTime;
          if (blockT != null && g.stats.simTime - blockT >= 0.25) return (window.__shot = 'shove');
          if (R && !R.blocked && !I) return (window.__shot = 'done'), false;
          return false;
        };
        window.__shot = null;
      },
      [!shotSweep],
    );
    const f0 = (await probe(page)).fired;
    await page.keyboard.down('KeyW');
    let r = await waitFor(page, (x) => x.state === 'paused' || x.fired > f0 || !x.pAlive || x.d < 1.5, 90000);
    await page.keyboard.up('KeyW');
    if (r.state !== 'paused' && r.fired <= f0) r = await waitFor(page, (x) => x.state === 'paused' || x.fired > f0 || !x.pAlive, 15000);
    if (!r.pAlive || (r.state !== 'fight' && r.state !== 'paused')) break;
    if (r.state !== 'paused' && r.fired <= f0 && r.d < 2.0) {
      await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
      out['forced' + k] = true;
    }
    r = await waitFor(page, (x) => x.state === 'paused', 10000, 30);
    let shot = await page.evaluate(() => window.__shot);
    if (r.state === 'paused' && shot === 'sweep') {
      out.sweep = r;
      await shoot(page, `${dir}/iberian_inside_sweep.png`, 'side', 2.6, 3.4);
      shotSweep = true;
      r = await waitFor(page, (x) => x.state === 'paused' || x.eRes != null, 10000, 30);
      shot = await page.evaluate(() => window.__shot);
    }
    if (r.state === 'paused' && shot === 'shove' && !shotShove) {
      out.shove = r;
      await shoot(page, `${dir}/iberian_inside_shove.png`, 'side', 2.0, 3.6);
      shotShove = true;
    } else if (r.state === 'paused') await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })));
    r = await waitFor(page, (x) => x.eRes != null, 5000);
    out['try' + k] = r.eRes;
    await page.evaluate(() => (window.__pauseIf = null));
    // 물러섰다 다시
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyS');
    await waitFor(page, (x) => x.aiStage == null, 8000);
  }
  await page.context().close();
}
// ② 중국 연환삼격: 비기 시작부터 칼끝 자취 → 둘째 이음새 고리(요략 → 탄복자)가 끝나는 스텝에서 멈춤
{
  const page = await open('?weapon=longsword&foeWeapon=qinggang');
  await page.evaluate(() => {
    window.game.player.applyWound = () => {}; // 시험만: 비기가 나올 때까지 내가 죽지 않게 (상대 동작·물리 그대로)
    window.__pauseIf = (g) => {
      const run = g.ai.secretRun;
      if (run?.S.name === 'lianhuanSanji' && !window.__traceOn) {
        window.__trace = [];
        window.__traceOn = true;
      }
      const t = g.ai.tech;
      return !!(run && t?.name === 'lianhuanTanfu' && g.ai.path.length <= t.path.length);
    };
  });
  let r = await waitFor(page, (x) => x.state === 'paused', 150000);
  let forced = false;
  if (r.state !== 'paused') {
    await page.keyboard.down('KeyW');
    await waitFor(page, (x) => x.d < 2.0, 60000);
    await page.keyboard.up('KeyW');
    forced = await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
    r = await waitFor(page, (x) => x.state === 'paused', 20000);
  }
  out.lianhuan = { ...r, forced };
  await shoot(page, `${dir}/lianhuan_loops.png`, 'front', 1.9);
  await page.context().close();
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
