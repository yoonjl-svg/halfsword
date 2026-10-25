// 사람 내려 긋기 프레임 띠 (10/25 19:0x 사장님 '이탈리아 내려 긋기의 문제를 살펴보고 수정해' — docs/strike/wrist_audit_2026-10-24.md §15 · 그림 docs/handoff/it_downcut_2026-10-25/).
//  폰 가로 844 × 390 · 배율 2 · WebP. 상대(이졸데 · 롱소드)를 세워 두고(AI 끔 · 칼 아래 · 둘 다 상처 끔 시연) 가슴 사이 GAP(기본 1.4 m)까지 걸어 들어가 0.8 s 쉰 뒤
//  봇 손놀림(tools/sim 표준 판 · flex_reach · whip_duel 과 같은 꼴): 손가락을 대고 TECH(기본 zornhau)의 시작 자리로 1.6 패드 m/s 감기 · 4 프레임 멈춤 · V(기본 4.5) 패드 m/s 로 긋기 · 손가락 뗌.
//  긋기 시작부터 T(기본 0,0.08,0.16,0.24,0.32,0.4 s)마다 물리를 멈추고 옆 카메라(두 가슴 줄에 수직 2.3 m) · 게임 화면을 찍는다 → <판>_<무기>_<기술>_<t ms>_{side,game}.webp · 잰 값 log.
//  판 = TAGS (기본 'before:&cutPronate=0,after:') · WEAPONS(기본 rapier,pappenheimer,sabre)
//  npx vite build --outDir <폴더>/dist && npx vite preview --outDir <폴더>/dist --port 5589 --strictPort &
//  node tools/browser/it_downcut_shots.mjs http://127.0.0.1:5589 docs/handoff/it_downcut_2026-10-25   → 띠 python3 -I tools/browser/it_downcut_sheet.py <그림 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
const base = process.argv[2] || 'http://127.0.0.1:5589';
const out = process.argv[3] || 'docs/handoff/it_downcut_2026-10-25';
fs.mkdirSync(out, { recursive: true });
const TAGS = (process.env.TAGS || 'before:&cutPronate=0,after:').split(',').map((s) => { const i = s.indexOf(':'); return [s.slice(0, i), s.slice(i + 1)]; });
const WEAPONS = (process.env.WEAPONS || 'rapier,pappenheimer,sabre').split(',');
const TECHS = (process.env.TECH || 'zornhau').split(',');
const GAP = +(process.env.GAP || 1.4);
const V = +(process.env.V || 4.5);
const TS = (process.env.T || '0,0.08,0.16,0.24,0.32,0.4').split(',').map(Number);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
const log = [];

async function open(weapon, extra) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${base}/?weapon=${weapon}&foe=isolde&foeWeapon=longsword&skillNodes=all&slowMo=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 90000 });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => { g.enemy.move.set(0, 0); g.enemy.handOffset.set(0, -0.5); }; // 상대를 세워 둠 · 칼 아래 (시연)
    g.enemy.applyWound = () => {};
    g.player.applyWound = () => {};
  });
  return { ctx, page };
}

async function shot(page, file, view) {
  await page.evaluate((view) => {
    const g = window.game;
    if (view === 'game') return;
    const p = g.player;
    const a = p.bodies.chest.translation(), b = g.enemy.bodies.chest.translation();
    g.freeCam = true;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const s = -(p.side ?? 1);
    const cx = s * (dz / L), cz = -s * (dx / L);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    g.camera.position.set(mx + cx * 2.3, 1.35, mz + cz * 2.3);
    g.camera.lookAt(mx, 1.2, mz);
  }, view);
  await page.waitForTimeout(350);
  const png = `${out}/${file}.png`;
  await page.screenshot({ path: png });
  execFileSync('python3', ['-I', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=86, method=6)', png, png.replace(/\.png$/, '.webp')]);
  fs.unlinkSync(png);
  await page.evaluate(() => { window.game.freeCam = false; });
}

for (const [tag, extra] of TAGS) for (const w of WEAPONS) for (const tn of TECHS) {
  const T = TECH_BY_NAME[tn];
  const { ctx, page } = await open(w, extra);
  await page.evaluate(([from, path, gap, v, ts]) => {
    const g = window.game, p = g.player, ps = g.playerSecret, orig = ps.update.bind(ps);
    const FR = 2 * g.config.PHYSICS.timestep; // 봇 손가락 프레임 (tools/sim 과 같음)
    const D = (window.drv = { st: 'walk', t: 0, q: [], i: 0, t0: null, want: null, ts: [...ts], shots: [], fx: 0, fy: 0, step: 0 });
    const to = (P, sp) => { const fr = []; let x = D.fx, y = D.fy; for (let k = 0; k < 400; k++) { const dx = P[0] - x, dy = P[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const s = Math.min(d, sp * FR); x += (dx / d) * s; y += (dy / d) * s; fr.push([(dx / d) * s, (dy / d) * s, 0]); } D.fx = x; D.fy = y; return fr; };
    ps.update = (dt, busy) => {
      orig(dt, busy);
      D.t += dt;
      if (D.st === 'walk') {
        const go = p.foeDistance() > gap && D.t < 8;
        p.move.set(0, go ? 1 : 0); p.stickX = 0; p.stickY = go ? 1 : 0;
        if (!go) { D.st = 'rest'; D.t = 0; }
        return;
      }
      p.move.set(0, 0); p.stickX = 0; p.stickY = 0;
      if (D.st === 'rest') {
        if (D.t > 0.8) {
          D.st = 'go'; D.fx = p.handOffset.x; D.fy = p.handOffset.y;
          D.q = to(from, 1.6);
          for (let i = 0; i < 4; i++) D.q.push([0, 0, 0]);
          for (const P of path) D.q.push(...to(P, v).map((f) => [f[0], f[1], 1]));
        }
        return;
      }
      if ((D.step++ & 1) === 0) {
        const f = D.q.shift();
        if (f) {
          if (f[2] === 1 && D.t0 == null) D.t0 = g.stats.simTime;
          p.handOffset.x += f[0]; p.handOffset.y += f[1];
        }
        D.held = !!f;
      }
      p.handHeld = !!D.held; p.inputActive = !!D.held; // 손가락을 댄 채 끔 (main.js 가 화면마다 적는 값을 스텝마다 덮음)
      if (D.t0 != null && D.ts.length && g.stats.simTime - D.t0 >= D.ts[0] - 1e-6) {
        D.want = D.ts.shift();
        g.config.PHYSICS.maxStepsPerFrame = 0;
      }
    };
  }, [T.from, T.path, GAP, V, TS]);
  for (let k = 0; k < TS.length; k++) {
    let t;
    for (let wait = 0; wait < 600 && t == null; wait++) {
      t = await page.evaluate(() => window.drv.want);
      if (t == null) {
        if (process.env.DEBUG && wait % 10 === 0) console.log(await page.evaluate(() => JSON.stringify({ st: window.drv.st, t: +window.drv.t.toFixed(2), q: window.drv.q.length, t0: window.drv.t0, gap: +window.game.player.foeDistance().toFixed(2), sim: +window.game.stats.simTime.toFixed(2) })));
        await page.waitForTimeout(1000);
      }
    }
    if (t == null) { console.log(`시간 넘김 ${tag} ${w}`); break; }
    await page.waitForTimeout(200);
    const v = await page.evaluate(() => {
      const g = window.game, p = g.player, e = g.enemy, T3 = g.THREE;
      const c = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
      const L = Math.hypot(ec.x - c.x, ec.z - c.z), ux = (ec.x - c.x) / L, uz = (ec.z - c.z) / L;
      const fw = (q) => +((q.x - c.x) * ux + (q.z - c.z) * uz).toFixed(2);
      const a = p.bladePoint(0.7, new T3.Vector3()), b = p.bladePoint(1, new T3.Vector3());
      return { gap: +p.foeDistance().toFixed(2), p70: [fw(a), +a.y.toFixed(2)], tip: [fw(b), +b.y.toFixed(2)], fix: +(p.wristFixDeg || 0).toFixed(0), swivel: +((p.swivelTh || 0) * 57.3).toFixed(0), idle: +p.bodyPose.idle.toFixed(2) };
    });
    const ms = String(Math.round(t * 1000)).padStart(3, '0');
    await shot(page, `${tag}_${w}_${tn}_${ms}_side`, 'side');
    await shot(page, `${tag}_${w}_${tn}_${ms}_game`, 'game');
    log.push(`${tag} ${w} ${tn} t=${t} ${JSON.stringify(v)}`);
    console.log(`SHOT ${tag} ${w} ${tn} t=${t} ${JSON.stringify(v)}`);
    await page.evaluate(() => { window.drv.want = null; window.game.config.PHYSICS.maxStepsPerFrame = 8; });
  }
  await ctx.close();
}
fs.writeFileSync(`${out}/shots_log.txt`, log.join('\n') + '\n' + (errors.length ? `오류 ${errors.length}\n${errors.join('\n')}\n` : '콘솔 오류 0\n'));
console.log(errors.length ? `오류 ${errors.length}` : '콘솔 오류 0');
await browser.close();
