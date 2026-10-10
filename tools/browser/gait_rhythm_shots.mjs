// 걸음 리듬·일본 낮춤 옆모습 캡처 (10/10 — docs/strike/school_gait_design_2026-10-10.md §12). 콘솔 에러 0.
//  ① 레이피어 플레이어 물러나기 연속: 상대(롱소드)는 멈춰 세우고(AI 끔) 플레이어 스틱을 뒤로 0.6 만큼(아날로그 스틱 반쯤 — follow 짝걸음이 켜지는 빠르기) 민다.
//     물러나기 시작 0.3 s 뒤부터 0.08 s 간격으로 일시정지(P)해 옆에서 한 장씩(같은 카메라 자리) → gait_rhythm_{before|after}_NN.png. before = 짝걸음 끔(gait.P.pair = null, main 걸음).
//     이어서 놓고 멈추는 순간들(놓은 뒤 0.1·0.3·0.6 s) → gait_rhythm_{before|after}_stop_N.png
//  ② 일본 낮춤: 우치가타나 플레이어 대기(멈춘 뒤 1.5 s)·걷기(앞으로 0.5 스틱)·물러나기(뒤로 0.6 스틱), AI 우치가타나 간 보기 — 옆에서.
//     before = 어제 높이(gait.P.guardHeight 0.875 · walkHeight 0.93 을 그 몸에 덮음), after = 빌드 기본값 → japanese_low_{before|after}_{idle|walk|back|ai}.png
//  찍는 몸의 상처는 끈다(걸음·물리 그대로). 화면 왼쪽 위에 무엇·시각을 적는다.
//  실행: npx vite build && npx vite preview --port 4189 --strictPort &
//        node tools/browser/gait_rhythm_shots.mjs http://127.0.0.1:4189 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4189';
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
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  await page.evaluate(() => {
    document.getElementById('techCue').style.visibility = 'hidden';
    const lab = document.createElement('div');
    lab.id = 'shotLabel';
    lab.style.cssText = 'position:fixed;left:8px;top:6px;z-index:99;font:600 15px sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:4px';
    document.body.appendChild(lab);
    const g = window.game;
    g.player.applyWound = () => {};
    g.enemy.applyWound = () => {};
    // 스틱 덮기: g._ovr = {x, y} 이면 플레이어 스틱을 그 값으로
    const mv = g.player.move;
    const set0 = mv.set.bind(mv);
    mv.set = (x, y) => (g._ovr ? set0(g._ovr.x, g._ovr.y) : set0(x, y));
    // 일시정지 갈고리: g._at = [sim 시각...] 에 닿으면 멈춤
    const c = g.combat;
    const o = c.afterStep.bind(c);
    g._at = [];
    c.afterStep = (...a) => {
      const res = o(...a);
      if (g._at.length && g.stats.simTime >= g._at[0]) {
        g._at.shift();
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
      }
      return res;
    };
  });
  return page;
}
// 그 몸의 걸음 값(gait.P)에 덮기 — gait.js 가 P 를 다시 골라도(무기·조종이 바뀔 때) 덮은 값이 남게 P 자리에 갈고리를 둔다
async function overP(page, who, o) {
  await page.evaluate(
    ([who, o]) => {
      const G = window.game[who].gait;
      let cur = null;
      const wrap = (v) => {
        const p = Object.create(v);
        Object.assign(p, o);
        return p;
      };
      cur = wrap(G.P);
      Object.defineProperty(G, 'P', { configurable: true, get: () => cur, set: (v) => (cur = wrap(v)) });
    },
    [who, o],
  );
}
const sim = (page) => page.evaluate(() => window.game.stats.simTime);
async function waitState(page, st, ms = 60000) {
  await page.waitForFunction((st) => window.game.state === st, st, { timeout: ms });
}
async function resume(page) {
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })));
  await waitState(page, 'fight');
}
async function camSide(page, who, fix) {
  return page.evaluate(([who, fix]) => {
    const g = window.game;
    const f = g[who];
    const o = who === 'enemy' ? g.player : g.enemy;
    document.getElementById('menu').style.visibility = 'hidden';
    const a = o.bodies.chest.translation();
    const b = fix || f.bodies.pelvis.translation();
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(b.x - (dz / L) * 2.8, 0.75, b.z + (dx / L) * 2.8);
    g.camera.lookAt(b.x, 0.5, b.z);
    return { x: b.x, y: b.y, z: b.z };
  }, [who, fix]);
}
async function label(page, text) {
  await page.evaluate((t) => (document.getElementById('shotLabel').textContent = t), text);
}
const info = (page, who) =>
  page.evaluate((who) => {
    const f = window.game[who];
    const G = f.gait;
    const p = f.bodies.pelvis.translation();
    return { pelvisY: +p.y.toFixed(3), F: G.legs.F.stance ? 'down' : 'air', B: G.legs.B.stance ? 'down' : 'air', follow: !!G.follow, pair: !!G.pairOn, d: +f.foeDistance().toFixed(2), gh: G.P.guardHeight, wh: G.P.walkHeight };
  }, who);
// 상대를 멈춰 세우고 플레이어를 상대 가슴 near m 까지 다가가게 한 뒤 쉰다
async function approach(page, near, rest = 1.0) {
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => g.enemy.move.set(0, 0);
  });
  await page.evaluate(() => (window.game._ovr = { x: 0, y: 1 }));
  await page.waitForFunction((n) => window.game.player.foeDistance() < n, near, { timeout: 60000 });
  await page.evaluate(() => (window.game._ovr = { x: 0, y: 0 }));
  const t = await sim(page);
  await page.waitForFunction((t) => window.game.stats.simTime > t, t + rest, { timeout: 60000 });
}

// ① 레이피어 물러나기 연속
for (const mode of ['before', 'after']) {
  if (process.env.ONLY && process.env.ONLY !== 'rapier') break;
  const page = await open('?weapon=rapier&foeWeapon=longsword');
  if (mode === 'before') await overP(page, 'player', { pair: null });
  await approach(page, 2.5);
  const t0 = await sim(page);
  const N = 9;
  const ts = Array.from({ length: N }, (_, i) => t0 + 0.3 + 0.08 * i);
  const rel = t0 + 0.3 + 0.08 * N + 0.02;
  await page.evaluate((ts) => (window.game._at = ts.slice()), ts);
  await page.evaluate(() => (window.game._ovr = { x: 0, y: -0.6 }));
  const seq = [];
  let fix = null;
  for (let i = 0; i < N; i++) {
    await waitState(page, 'paused');
    if (!fix) fix = await camSide(page, 'player');
    else await camSide(page, 'player', fix);
    const s = await info(page, 'player');
    const tt = (await sim(page)) - t0;
    await label(page, `레이피어 플레이어 물러나기 (${mode === 'before' ? '전 — 고른 셔플' : '후 — 짝걸음'}) t = +${tt.toFixed(2)} s · 앞발 ${s.F === 'down' ? '딛음' : '듦'} · 뒷발 ${s.B === 'down' ? '딛음' : '듦'}`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/gait_rhythm_${mode}_${String(i + 1).padStart(2, '0')}.png` });
    seq.push({ t: +tt.toFixed(2), ...s });
    await resume(page);
  }
  // 놓고 멈춤
  await page.waitForFunction((t) => window.game.stats.simTime >= t, rel, { timeout: 60000 });
  await page.evaluate(() => (window.game._ovr = { x: 0, y: 0 }));
  const tr = await sim(page);
  const st = [0.1, 0.3, 0.6].map((x) => tr + x);
  await page.evaluate((ts) => (window.game._at = ts.slice()), st);
  for (let i = 0; i < st.length; i++) {
    await waitState(page, 'paused');
    await camSide(page, 'player', fix);
    const s = await info(page, 'player');
    const tt = (await sim(page)) - tr;
    await label(page, `레이피어 놓고 멈춤 (${mode === 'before' ? '전' : '후'}) 놓은 뒤 +${tt.toFixed(2)} s · 앞발 ${s.F === 'down' ? '딛음' : '듦'} · 뒷발 ${s.B === 'down' ? '딛음' : '듦'}`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/gait_rhythm_${mode}_stop_${i + 1}.png` });
    seq.push({ stop: +tt.toFixed(2), ...s });
    await resume(page);
  }
  out[`rapier_${mode}`] = seq;
  await page.context().close();
}

// ② 일본 낮춤
const OLD = { guardHeight: 0.875, walkHeight: 0.93 };
for (const mode of ['before', 'after']) {
  if (process.env.ONLY && process.env.ONLY !== 'japanese') break;
  // 플레이어
  {
    const page = await open('?weapon=uchigatana&foeWeapon=longsword');
    if (mode === 'before') await overP(page, 'player', OLD);
    await approach(page, 2.6, 1.5);
    const res = {};
    // 대기
    let t = await sim(page);
    await page.evaluate((t) => (window.game._at = [t]), t + 0.05);
    await waitState(page, 'paused');
    const fix = await camSide(page, 'player');
    res.idle = await info(page, 'player');
    await label(page, `우치가타나 플레이어 대기 (${mode === 'before' ? '전' : '후'}) 골반 ${res.idle.pelvisY} m`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/japanese_low_${mode}_idle.png` });
    await resume(page);
    // 물러나기
    await page.evaluate(() => (window.game._ovr = { x: 0, y: -0.6 }));
    t = await sim(page);
    await page.evaluate((t) => (window.game._at = [t]), t + 0.7);
    await waitState(page, 'paused');
    await camSide(page, 'player', fix);
    res.back = await info(page, 'player');
    await label(page, `우치가타나 플레이어 물러나기 (${mode === 'before' ? '전' : '후'}) 골반 ${res.back.pelvisY} m`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/japanese_low_${mode}_back.png` });
    await resume(page);
    // 걷기 (앞으로)
    await page.evaluate(() => (window.game._ovr = { x: 0, y: 0.5 }));
    t = await sim(page);
    await page.evaluate((t) => (window.game._at = [t]), t + 0.8);
    await waitState(page, 'paused');
    await camSide(page, 'player');
    res.walk = await info(page, 'player');
    await label(page, `우치가타나 플레이어 걷기 (${mode === 'before' ? '전' : '후'}) 골반 ${res.walk.pelvisY} m`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${dir}/japanese_low_${mode}_walk.png` });
    out[`japanese_player_${mode}`] = res;
    await page.context().close();
  }
  // AI (간 보기 — 발도 대기 웅크림이 아닐 때를 기다린다)
  {
    const page = await open('?weapon=longsword&foeWeapon=uchigatana');
    if (mode === 'before') await overP(page, 'enemy', OLD);
    await page.evaluate(() => {
      const g = window.game;
      g._aiHook = true;
      const c = g.combat;
      const o = c.afterStep.bind(c);
      g._aiShot = null;
      c.afterStep = (...a) => {
        const res = o(...a);
        const f = g.enemy;
        const G = f.gait;
        if (g._aiShot || !G?.active || f.state !== 'stand' || g.stats.simTime < 4) return res;
        const sw = !G.legs.F.stance ? G.legs.F : !G.legs.B.stance ? G.legs.B : null;
        if (!sw || f.secretStance || sw.kind !== 'walk' || sw.t / sw.T < 0.4 || sw.t / sw.T > 0.7) return res;
        g._aiShot = { pelvisY: +f.bodies.pelvis.translation().y.toFixed(3), follow: !!G.follow };
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
        return res;
      };
    });
    try {
      await waitState(page, 'paused', 120000);
      await camSide(page, 'enemy');
      const s = await page.evaluate(() => window.game._aiShot);
      await label(page, `우치가타나 AI 걷기 (${mode === 'before' ? '전' : '후'}, 발도 대기 아님) 골반 ${s.pelvisY} m`);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${dir}/japanese_low_${mode}_ai.png` });
      out[`japanese_ai_${mode}`] = s;
    } catch (e) {
      out[`japanese_ai_${mode}`] = 'timeout';
    }
    await page.context().close();
  }
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
