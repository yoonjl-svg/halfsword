// 제비 베기 실제 빌드 게임 화면 그림 + 칼끝 길 (사장님 10/31 14:xx '제비 베기 경로가 좀 휘어보이던데') — 진짜 배우기(J1 · J6 · J7 · J9) 저장 · 打刀 · 상대 롱소드 멈춤
//  손가락 봇 = tools/sim/tsubame_trace.mjs 와 같은 길 · 아래 칼은 빗나감(instantGhost) · 꺾은 뒤 0.06 · 0.12 · 0.2 s 에 멈춰 게임 화면 · 칼끝 세계 자리를 스텝마다 적음
//  실행 (npm i --no-save playwright): npm run build → npx vite preview --port <빌드> --strictPort --host 127.0.0.1 & · npx vite --port <개발> --strictPort --host 127.0.0.1 &
//        node tools/browser/tsubame_path_probe.mjs http://127.0.0.1:<빌드> http://127.0.0.1:<개발> [폴더 (기본 .tmp/tsubame_path)] · TAGS='now:,old:&tsuAim=0' · GAP(1.45) · WAIT(ms)
//  칼끝은 tsu_game.json 에 [꺾은 뒤 s, 세계 x, y, z, 운동학 칼 1/0] — 그림은 tools/sim/tsubame_trace_plot.py 꼴로 옮겨 그림
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5395';
const dev = process.argv[3] || 'http://127.0.0.1:5392';
const out = process.argv[4] || '.tmp/tsubame_path';
fs.mkdirSync(out, { recursive: true });
const TAGS = (process.env.TAGS || 'now:,old:&tsuAim=0').split(',').map((s) => s.split(':'));
const SHOTS = [0.06, 0.12, 0.2];
const GAP = +(process.env.GAP || 1.45);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const dctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
const dpage = await dctx.newPage();
await dpage.goto(`${dev}/?weapon=uchigatana`, { waitUntil: 'networkidle' });
await dpage.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
const save = await dpage.evaluate(async () => {
  const P = await import('/src/lobby_progress.js');
  const S = await import('/src/skill_tree_store.js');
  P.setCoins(100000); P.setHeads(100);
  const r = {};
  for (const id of ['J1', 'J6', 'J7', 'J9']) r[id] = S.learnNode('japanese', id);
  const ls = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
  return { r, ls };
});
await dctx.close();
console.log(JSON.stringify(save.r));
const res = [];
for (const [tag, extra] of TAGS) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 1 });
  await ctx.addInitScript((ls) => { try { for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch { /* */ } }, save.ls);
  const page = await ctx.newPage();
  await page.goto(`${base}/?weapon=uchigatana&foeWeapon=longsword&slowMo=0&camOpen=old${extra || ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 180000 });
  await page.evaluate(() => { game.config.ARENA.startGap = 2.0; game.config.ARENA.startHold = 0; });
  await page.getByText('여정 시작', { exact: true }).click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 240000 });
  const kit = await page.evaluate(([SHOTS, GAP]) => {
    const g = window.game, p = g.player, e = g.enemy, u = p.skill.uniq;
    g.ai.update = () => e.move.set(0, 0);
    e.applyWound = () => {};
    if (!u) return { err: 'no uniq' };
    u._feed = u.feed.bind(u);
    u.feed = () => {};
    const FRAME = 2 / 120;
    const COMBO = { from: [0.02, 0.52], path: [[0.0, 0.14], [0.0, -0.5], [0.06, -0.15], [0.22, 0.26]] };
    const D = (window.drv = { phase: 'walk', q: [], n: 0, fx: 0, fy: 0, tTurn: null, tip: [], want: null, k: 0, wait: 0, hits: [] });
    const to = (pt, vel, held) => { const fr = []; let x = D.fx, y = D.fy; for (let k = 0; k < 400; k++) { const dx = pt[0] - x, dy = pt[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, vel * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, held]); } D.fx = x; D.fy = y; return fr; };
    const pw = g.combat.hooks.onWound;
    g.combat.hooks.onWound = (att, vic, r, ...rest) => { pw?.(att, vic, r, ...rest); if (att === p && D.tTurn != null) D.hits.push({ t: +(g.stats.simTime - D.tTurn).toFixed(3), zone: r.zone }); };
    const st0 = p.step.bind(p);
    const v = { x: 0, y: 0, z: 0 };
    p.step = function (dt) {
      const t = g.stats.simTime;
      const dist = p.foeDistance();
      if (D.phase === 'walk') {
        p.move.set(0, dist > GAP ? 0.5 : dist < GAP - 0.08 ? -0.4 : 0);
        if (Math.abs(dist - GAP) < 0.08) { D.wait += dt; if (D.wait > 0.6) { p.move.set(0, 0); D.fx = p.handOffset.x; D.fy = p.handOffset.y; D.q = to(COMBO.from, 1.6, false); D.q.push(...Array(4).fill([0, 0, false])); for (const pt of COMBO.path) D.q.push(...to(pt, 4.5, true)); D.q.push(...Array(10).fill([0, 0, false])); D.phase = 'combo'; D.f0 = u.stats.fired?.tsubameGaeshi ?? 0; } } else D.wait = 0;
        return st0(dt);
      }
      p.move.set(0, 0);
      if ((D.n++ & 1) === 0 && D.q.length) { const f = D.q.shift(); u._feed(f[0], f[1], FRAME, false); p.handOffset.x += f[0]; p.handOffset.y += f[1]; p.handHeld = f[2]; if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) p.inputActive = true; }
      if (D.q.length && D.tTurn == null) p.instantGhost = Math.max(p.instantGhost ?? 0, 2);
      const r = st0(dt);
      if (D.tTurn == null && ((u.stats.fired?.tsubameGaeshi ?? 0) > (D.f0 ?? 0) || u.r?.e.name === 'tsubameGaeshi' || p.iai?.tech === 'tsubameGaeshi')) D.tTurn = t;
      if (D.tTurn != null && t - D.tTurn < 0.4) { const b = p.bladePoint(1); D.tip.push([+(t - D.tTurn).toFixed(4), +b.x.toFixed(3), +b.y.toFixed(3), +b.z.toFixed(3), p.iai ? 1 : 0]); }
      if (D.tTurn != null && !D.want && D.k < SHOTS.length && t - D.tTurn >= SHOTS[D.k]) { D.want = `s${D.k++}`; g.config.PHYSICS.maxStepsPerFrame = 0; }
      return r;
    };
    return { tradition: p.swordArt?.tradition, unique: u.list.map((x) => x.name) };
  }, [SHOTS, GAP]);
  console.log(tag, JSON.stringify(kit));
  for (let i = 0; i < SHOTS.length; i++) {
    try { await page.waitForFunction(() => window.drv.want, null, { timeout: +(process.env.WAIT || 300000), polling: 100 }); } catch { console.log(tag, 'timeout', JSON.stringify(await page.evaluate(() => { const g = window.game, p = g.player, u = p.skill.uniq; return { phase: window.drv.phase, q: window.drv.q.length, n: window.drv.n, dist: +p.foeDistance().toFixed(2), sim: +g.stats.simTime.toFixed(2), r: u.r?.e?.name ?? null, cur: u.cur?.tech ?? null, last: u.last?.tech ?? null, lastLanded: u.last?.landed ?? null, fired: u.stats?.fired, cool: u.coolLeft?.('tsubameGaeshi'), hand: [+p.handOffset.x.toFixed(2), +p.handOffset.y.toFixed(2)] }; }))); break; }
    await page.waitForTimeout(250);
    const w = await page.evaluate(() => window.drv.want);
    await page.screenshot({ path: `${out}/${tag}_${w}.png` });
    await page.evaluate(() => { window.drv.want = null; window.game.config.PHYSICS.maxStepsPerFrame = 6; });
  }
  await page.waitForTimeout(1500);
  const D = await page.evaluate(() => ({ tip: window.drv.tip, hits: window.drv.hits }));
  res.push({ tag, ...D });
  console.log(tag, 'tip steps', D.tip.length, 'hits', JSON.stringify(D.hits));
  await ctx.close();
}
fs.writeFileSync(`${out}/tsu_game.json`, JSON.stringify(res));
await browser.close();
