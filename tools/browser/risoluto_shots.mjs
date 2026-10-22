// 이탈리아 거침없이 나아가 찌르기 (안다레 리솔루토 — 10/22 · docs/strike/italian_risoluto_2026-10-22.md) 브라우저 그림.
//  card  — 대기실 '스킬' 이탈리아 I4 상세 카드(익힐 수 있는 상태 — 준비 중이 아님) · 넘침 px (모든 화면 넘침 점검은 skill_tree_layout.mjs)
//  fight — 레이피어 · 상대 인물 AI 와 싸움: 운전(tools/sim/risoluto_play.mjs 와 같은 노리는 사람 흉내 — 물리 스텝마다 손을 상대 칼끝 쪽 위로 · 스틱 앞)을 물리 스텝에 걸고
//          ① 덮인 채 나아가는 중 ② 창(금색 '!') ③ 화면 톡 = 진짜 탭 입력 뒤 찌르는 중 — 그림마다 물리를 잠깐 멈추고 찍는다. 창이 안 열리면 그 사실을 적고 끝(억지로 열지 않음)
//  STILL_FOE=1 = 상대 AI 를 자세에 세워 둔 시연(상대가 치지 않음 — 그림용, 측정 아님) · WALL=벽시계 ms
//  npx vite --port 5391 --strictPort --host 127.0.0.1 &  →  node tools/browser/risoluto_shots.mjs http://127.0.0.1:5391 <PNG 폴더> card|fight [쿼리 덧붙임 예 '&risoBeat=1&foe=isolde']
import { chromium } from 'playwright';
import fs from 'node:fs';
import { titleToLobby } from './to_lobby.mjs';
const base = process.argv[2] || 'http://127.0.0.1:5391';
const out = process.argv[3] || 'docs/handoff/risoluto';
const mode = process.argv[4] || 'fight';
const extra = process.argv[5] || '';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
const watch = (p) => { p.on('pageerror', (e) => errors.push('pageerror ' + e)); p.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(m.text()); }); };

if (mode === 'card') {
  const SAVE = { version: 1, coins: 2000, heads: 40, titles: [], title: '여행자', acquisitions: ['I1', 'I3', 'I2', 'I7', 'I8'].map((id) => ({ receipt: `skill:italian:${id}`, kind: 'skill', paid: { coins: 100, heads: 0 } })) };
  for (const [w, h] of [[844, 390], [680, 360]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce', deviceScaleFactor: 2, hasTouch: true });
    await ctx.route('https://*.supabase.co/**', (r) => r.abort());
    await ctx.addInitScript((save) => { if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', '1'); localStorage.clear(); localStorage.setItem('stillness.lobby.progress.v1', save); } }, JSON.stringify(SAVE));
    const p = await ctx.newPage();
    watch(p);
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player, null, { timeout: 90000 });
    if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
    await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 30000 });
    await titleToLobby(p);
    await p.evaluate(() => { const d = document.querySelector('#gameEntrance').shadowRoot.getElementById('treeDialog'); if (d?.open) document.querySelector('#gameEntrance').shadowRoot.getElementById('closeTree').click(); });
    await p.locator('#tabSkills').click();
    await p.locator('.school-tabs [data-school=italian]').click();
    await p.waitForTimeout(100);
    const r = await p.evaluate(async () => {
      const root = document.querySelector('#gameEntrance').shadowRoot;
      root.querySelector('.tree-node[data-node="I4"]').click();
      const box = root.querySelector('.node-detail'), icon = root.getElementById('nodeIcon');
      await icon.decode().catch(() => {});
      return { over: box.scrollHeight - box.clientHeight, title: root.getElementById('nodeTitle')?.textContent ?? null, state: root.querySelector('.tree-node[data-node="I4"]')?.dataset.state };
    });
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${out}/card_I4_${w}x${h}.png` });
    console.log(`CARD ${w}x${h} ${JSON.stringify(r)}`);
    await ctx.close();
  }
} else {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  watch(page);
  await page.goto(`${base}/?weapon=rapier&foe=isolde&foeWeapon=longsword&skillNodes=all&slowMo=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 90000 });
  const S = await page.evaluate(() => window.game.playerSecret.S?.name ?? null);
  console.log(`secret ${S}`);
  // STILL_FOE=1: 상대 AI 를 그 자리 자세에 세워 둔 시연 (상대가 치지 않음 — 창 · 찌르기 그림용, 측정 아님)
  if (process.env.STILL_FOE === '1') await page.evaluate(() => { const g = window.game; g.ai.update = () => { g.enemy.move.set(0, 0); }; });
  // 운전: 물리 스텝마다 (playerSecret.update 바로 앞 — main.js 물리 고리 안) 손 · 스틱 · 손가락 닿음
  await page.evaluate(() => {
    const g = window.game, T = g.THREE, ps = g.playerSecret, orig = ps.update.bind(ps);
    const P = (window.drv = { tgt: [0.1, 0.05], shots: { cover: false, open: false, thrust: false }, log: [] });
    const v = () => new T.Vector3();
    ps.update = (dt, busy) => {
      const p = g.player, e = g.enemy;
      if (p && e && !p.skill.sec && p.armed && e.armed) {
        const a0 = p.bladePoint(0, v()), a1 = p.bladePoint(0.5, v()), b0 = e.bladePoint(0.5, v()), b1 = e.bladePoint(1, v());
        const d1 = a1.clone().sub(a0), d2 = b1.clone().sub(b0), r = a0.clone().sub(b0);
        const A = d1.dot(d1), E = d2.dot(d2), F = d2.dot(r), C = d1.dot(r), B = d1.dot(d2), den = A * E - B * B;
        let s = den > 1e-9 ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0; let t = (B * s + F) / E;
        if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -C / A)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (B - C) / A)); }
        const dv = b0.clone().addScaledVector(d2, t).sub(a0.clone().addScaledVector(d1, s)).applyQuaternion(p.yaw.clone().invert());
        if (p.foeDistance() < 3) P.tgt = [Math.max(-0.5, Math.min(0.5, P.tgt[0] + dv.z * 4 * dt)), Math.max(-0.3, Math.min(0.45, P.tgt[1] + (dv.y + 0.03) * 4 * dt))];
        const off = p.handOffset, dx = P.tgt[0] - off.x, dy = P.tgt[1] - off.y, dd = Math.hypot(dx, dy), st = 0.6 * dt;
        if (dd > st) { off.x += (dx / dd) * st; off.y += (dy / dd) * st; } else off.set(P.tgt[0], P.tgt[1]);
        p.inputActive = dd > 1e-4;
      }
      if (p) {
        p.handHeld = !p.skill.sec;
        const fwd = p.skill.secretPhase !== 'stiff' && p.foeDistance() > p.swordArt.measure.clinch ? 1 : 0;
        p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
      }
      orig(dt, busy);
      // 사진 때: 물리 멈춤 (main.js 물리 고리 — maxStepsPerFrame 0)
      const R = ps.riso;
      const freeze = (k) => { if (!P.shots[k] && !P.want) { P.want = k; g.config.PHYSICS.maxStepsPerFrame = 0; } };
      if (R?.on && R.held > 0.3) freeze('cover');
      if (ps.open) { ps.open.t = Math.max(ps.open.t, 5); freeze('open'); } // 소프트웨어 GL 은 느려 창이 사진 · 톡 사이에 닫히지 않게 (시험에서만)
      if (p.skill.sec?.stage === 'riso' && p.skill.thrustPush) freeze('thrust');
    };
  });
  const t0 = Date.now();
  const state = () => page.evaluate(() => { const g = window.game, R = g.playerSecret.riso; return { want: window.drv.want, sim: +g.stats.simTime.toFixed(2), d: +g.player.foeDistance().toFixed(2), cover: R ? +R.d.toFixed(3) : null, held: R ? +R.held.toFixed(2) : null, open: g.playerSecret.open?.ctx ?? null, stage: g.player.skill.sec?.stage ?? null, alive: [g.player.alive, g.enemy.alive], fight: g.state, runs: R?.runs.length, opens: R?.opens, stats: g.player.skill.secretStats, foeArm: g.enemy.flowRecovery ? +(g.enemy.flowRecovery.until - g.enemy.stamina.time).toFixed(2) : null }; });
  let st = await state(), tapped = false;
  while (Date.now() - t0 < +(process.env.WALL ?? 240000) && st.fight === 'fight' && st.alive[0] && st.alive[1]) {
    await page.waitForTimeout(80);
    st = await state();
    if (st.want) {
      await page.waitForTimeout(250); // 그리기 한 번 (물리는 멈춤)
      await page.screenshot({ path: `${out}/fight_${st.want}.png` });
      console.log(`SHOT ${st.want} ${JSON.stringify(st)}`);
      const k = st.want;
      await page.evaluate((k) => { window.drv.shots[k] = true; window.drv.want = null; window.game.config.PHYSICS.maxStepsPerFrame = 8; }, k);
      if (k === 'open' && !tapped) {
        tapped = true;
        // 진짜 입력: 칼 쪽 화면을 톡 (pointerdown → pointerup, 끌지 않음 — input.js 톡)
        await page.evaluate(async () => {
          const cv = document.getElementById('game');
          const o = { pointerId: 77, pointerType: 'touch', clientX: 620, clientY: 210, bubbles: true, isPrimary: true, button: 0 };
          cv.dispatchEvent(new PointerEvent('pointerdown', o));
          await new Promise((r) => setTimeout(r, 40));
          cv.dispatchEvent(new PointerEvent('pointerup', o));
        });
      }
      if (k === 'thrust') break;
    }
  }
  await page.waitForTimeout(600);
  console.log(`END ${JSON.stringify(await state())} wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
console.log(`ERRORS ${JSON.stringify(errors)}`);
await browser.close();
