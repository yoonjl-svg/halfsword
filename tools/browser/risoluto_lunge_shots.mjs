// 안다레 리솔루토 런지 (10/24 사장님 '런지로 진행해. 단 런지 동작이 고노센처럼 빠르게 나가야 의미가 있어' — docs/strike/italian_risoluto_2026-10-22.md §10) 브라우저 그림.
//  폰 가로 844 × 390 · 배율 2 · 레이피어(또는 WEAPON=dartagnan) · 상대 인물 이졸데(롱소드). 운전은 risoluto_shots.mjs 와 같은 노리는 사람 흉내(손을 상대 칼끝 쪽 위로 · 스틱 앞) ·
//  창(금색 '!')이 열리면 화면 톡(진짜 탭 입력) → 그림마다 물리를 멈추고 찍는다:
//   ① lunge_hit — 찌르는 토막(칼끝이 가장 깊이 든 스텝 · 비기 잔상) ② lunge_mid — 굳음 0.15 s (앞발이 길게 내딛어 닿는 무렵 · 골반 낮춤 · 팔은 겨눈 채)
//   ③ recovery — 굳음 0.45 s (칼 · 발 조작이 안 듣는 몫 — 14:0x 전 판은 뒷발을 끌어붙여 자세로 · 지금은 굳음 뒤 앞발을 거둠: 아래 SIDE=1)
//  STILL_FOE=1 = 상대 AI 를 그 자리 자세에 세워 둔 시연(상대가 치지 않음 — 그림용, 측정 아님) · WALL=벽시계 ms · 찍은 PNG 는 같은 이름 .webp 로 바꿔 둠(파이썬 PIL)
//  10/24 13:2x · 13:4x 간격 조건 그림: SCENE=near — 걸어 들어가다 창 조건이 찼지만 런지 최소 간격(13:4x 맞닿기 거리 measure.contact)보다 가까워 창이 안 뜬 스텝(near_no_window — 금색 '!' 없음)을 찍고 끝 ·
//   SCENE=far — 칼이 붙으면 스틱을 CREEP(기본 0.2)만 밀어 천천히 들어가 간격이 있는 채 창이 뜨게(간격 조건을 아는 사람 흉내) → 톡 → 런지 그림 셋 (파일 이름 앞에 far_)
//  10/25 01:0x 칼끝 얽힘 창 그림: SCENE=touch — 같은 운전으로 걸어 들어가다 칼끼리 처음 닿은 스텝에 창(ctx.path 'touch')이 뜨면 그 스텝을 찍음(touch_open — 금색 '!') →
//   톡 → 런지가 나간 것만 적고(그림 없음) 끝. 다른 길(이어짐 · 상대 박자)로 뜬 창은 찍지 않고 기다림 · 그때 두 칼 가장 가까운 자리(칼날 0 손 쪽 ~ 1 칼끝)를 적음
//  npx vite build --outDir <tmp>/dist && npx vite preview --outDir <tmp>/dist --port 5513 --strictPort &  →  node tools/browser/risoluto_lunge_shots.mjs http://127.0.0.1:5513 <그림 폴더> [쿼리 덧붙임]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.argv[2] || 'http://127.0.0.1:5513';
const out = process.argv[3] || 'docs/handoff/risoluto_lunge_2026-10-24';
const extra = process.argv[4] || '';
const W = process.env.WEAPON || 'rapier';
const SCENE = process.env.SCENE || '';
const CREEP = SCENE === 'far' ? +(process.env.CREEP || 0.2) : 0;
const PFX = SCENE === 'far' ? 'far_' : SCENE === 'touch' ? 'touch_' : '';
// 10/24 14:0x SIDE=1 — 옆에서 본 그림(게임 카메라는 뒤라 런지 깊이가 안 보임 · cn_combo_probe.mjs 와 같은 옆 카메라): side_guard(창이 뜬 때 — 겨눔) · side_hit(찌르는 토막) ·
//  side_lunge(앞발이 딛고 몸이 다 실려 앞발을 거두기 바로 전 — 런지 자세 · ?risoRecover=0 이면 굳음 0.45 s) · side_recovered(그 0.6 s 뒤 — 되돌아옴)
const SIDE = process.env.SIDE === '1';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(`${base}/?weapon=${W}&foe=isolde&foeWeapon=longsword&skillNodes=all&slowMo=0${extra}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 90000 });
console.log(`secret ${await page.evaluate(() => window.game.playerSecret.S?.name ?? null)} · weapon ${W}`);
if (process.env.STILL_FOE === '1') await page.evaluate(() => { const g = window.game; g.ai.update = () => { g.enemy.move.set(0, 0); }; });
// NOHURT=1: 시연 — 상대가 상처를 받지 않게(applyWound 를 비움) 해 런지 뒤 상대가 쓰러지지 않은 채 되돌아오기를 보임 (그림용 · 측정 아님)
if (process.env.NOHURT === '1') await page.evaluate(() => { window.game.enemy.applyWound = () => {}; });
await page.evaluate(({ SCENE, CREEP, SIDE }) => {
  const g = window.game, T = g.THREE, ps = g.playerSecret, orig = ps.update.bind(ps);
  const P = (window.drv = { tgt: [0.1, 0.05], shots: { open: false, lunge_hit: false, lunge_mid: false, recovery: false, near_no_window: false, side_hit: false, side_lunge: false, side_recovered: false }, want: null, info: {}, recAt: null });
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
      let fwd = !p.skill.sec && (!ps.open || SCENE === 'near' || SCENE === 'touch') && p.foeDistance() > p.swordArt.measure.clinch ? 1 : 0; // 런지 · 굳음 동안 · 창이 보이면 스틱을 놓음 (near: 창이 떠도 치지 않고 계속 들어감)
      if (fwd && CREEP && ps.riso && (ps.riso.on || ps.riso.d < 0.2)) fwd = CREEP; // far: 칼이 붙으면 천천히
      p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
    }
    const blocked0 = (ps.riso?.gapBlocked ?? 0) + (ps.riso?.gapClosed ?? 0);
    orig(dt, busy);
    if (SCENE === 'near') {
      // 창 조건이 찼으나 가까워 안 뜸 · 뜬 창이 가까워져 꺼짐 — 그 스텝을 찍음 (near 는 창이 떠도 치지 않음)
      if ((ps.riso?.gapBlocked ?? 0) + (ps.riso?.gapClosed ?? 0) > blocked0 && !P.shots.near_no_window && !P.want) { P.want = 'near_no_window'; g.config.PHYSICS.maxStepsPerFrame = 0; }
      return;
    }
    const freeze = (k) => { if (!P.shots[k] && !P.want) { P.want = k; g.config.PHYSICS.maxStepsPerFrame = 0; } };
    const sec = p?.skill.sec;
    if (SCENE === 'touch' && ps.open && ps.open.ctx?.path !== 'touch' && !P.shots.open) { P.skipped = (P.skipped ?? 0) + 1; ps.open = null; } // 칼끝 얽힘 창만 찍음 (다른 길로 뜬 창은 닫고 기다림)
    if (SCENE === 'touch' && ps.open && !P.shots.open && !P.want) {
      // 그때 두 칼 가장 가까운 자리 (칼날 0 손 쪽 ~ 1 칼끝 — 칼끝끼리 · 칼끝이 상대 칼 몸에 엇걸림을 보임)
      const a0 = p.bladePoint(0, v()), a1 = p.bladePoint(1, v()), b0 = e.bladePoint(0, v()), b1 = e.bladePoint(1, v());
      let best = [Infinity, 0, 0];
      for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { const d = a0.clone().lerp(a1, i / 40).distanceTo(b0.clone().lerp(b1, j / 40)); if (d < best[0]) best = [d, i / 40, j / 40]; }
      P.info.touch = { d: +best[0].toFixed(3), mine: best[1], foe: best[2], gap: +p.foeDistance().toFixed(2), contact: +p.swordArt.measure.contact.toFixed(2), touching: !!p.feel?.touching, skipped: P.skipped ?? 0 };
    }
    if (ps.open) { ps.open.t = Math.max(ps.open.t, 5); freeze('open'); } // 소프트웨어 GL 은 느려 창이 사진 · 톡 사이에 닫히지 않게 (그림에서만)
    if (SIDE) {
      if (sec?.lunge && p.iai?.kind === 'combo' && p.iai.cutting) freeze('side_hit');
      const oldStep = !g.config.SECRET.risolutoStep?.recover; // ?risoRecover=0 (14:0x 전 — 앞발을 거두지 않음): 런지 자세는 굳음 0.45 s 에 찍고 0.6 s 뒤를 되돌아옴으로
      if (P.recAt == null && (p.lungeRecovered || (oldStep && sec?.lunge && sec.stage === 'stiff' && sec.t >= 0.45))) { P.recAt = g.stats.simTime; freeze('side_lunge'); }
      if (P.recAt != null && g.stats.simTime >= P.recAt + 0.6) freeze('side_recovered');
      return;
    }
    if (sec?.lunge && p.iai?.kind === 'combo' && p.iai.cutting) freeze('lunge_hit');
    if (sec?.lunge && sec.stage === 'stiff' && sec.t >= 0.15) freeze('lunge_mid');
    if (sec?.lunge && sec.stage === 'stiff' && sec.t >= 0.45) freeze('recovery');
  };
}, { SCENE, CREEP, SIDE });
const t0 = Date.now();
const state = () => page.evaluate(() => {
  const g = window.game, p = g.player, e = g.enemy, sec = p.skill.sec, pl = p.bodies.pelvis.translation(), ch = p.bodies.chest.translation(), L = p.gait?.legs;
  const fp = (k) => (L?.[k] ? [+L[k].plant.x.toFixed(2), +L[k].plant.z.toFixed(2)] : null);
  return {
    want: window.drv.want, sim: +g.stats.simTime.toFixed(2), d: +p.foeDistance().toFixed(2), minGap: g.playerSecret.riso ? +p.swordArt.measure.contact.toFixed(2) : null, gapBlocked: g.playerSecret.riso?.gapBlocked ?? 0, gapClosed: g.playerSecret.riso?.gapClosed ?? 0, open: g.playerSecret.open?.ctx ?? null, stage: sec?.stage ?? null, st: sec ? +sec.t.toFixed(2) : null,
    lunge: !!sec?.lunge, res: sec?.lungeRes ? { hit: sec.lungeRes.hit, part: sec.lungeRes.part, type: sec.lungeRes.type, E: Math.round(sec.lungeRes.energy), slide: +(sec.lungeRes.slide ?? 0).toFixed(2), blocked: sec.lungeRes.blocked } : null,
    pelvisY: +pl.y.toFixed(2), tilt: +((Math.atan2(Math.hypot(ch.x - pl.x, ch.z - pl.z), ch.y - pl.y) * 180) / Math.PI).toFixed(1), feet: { F: fp('F'), B: fp('B') }, draw: !!p.gait?.drawPending,
    foeArm: e.flowRecovery ? +(e.flowRecovery.until - e.stamina.time).toFixed(2) : null, alive: [p.alive, e.alive], foeState: e.state, fight: g.state,
  };
});
let st = await state(), tapped = false;
while (Date.now() - t0 < +(process.env.WALL ?? 300000) && st.fight === 'fight' && st.alive[0]) {
  await page.waitForTimeout(80);
  st = await state();
  if (st.want) {
    const k = st.want;
    await page.waitForTimeout(250); // 그리기 한 번 (물리는 멈춤)
    const sideCam = SIDE && (k === 'open' || k.startsWith('side_'));
    if (sideCam) {
      // 옆 카메라: 두 가슴 가운데에서 그 줄에 수직으로 3.2 m · 높이 1.1 m · 다리까지 보이게 0.75 m 를 봄
      await page.evaluate(() => {
        const g = window.game, a = g.player.bodies.chest.translation(), b = g.enemy.bodies.chest.translation();
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
        g.freeCam = true;
        g.camera.position.set(mx - (dz / L) * 3.2, 1.1, mz + (dx / L) * 3.2);
        g.camera.lookAt(mx, 0.75, mz);
      });
      await page.waitForTimeout(300);
    }
    if (SCENE === 'touch' && k !== 'open') { /* 칼끝 얽힘 그림은 창 하나만 — 런지는 적기만 */ } else if (k !== 'open' || sideCam || SCENE === 'touch') {
      const png = `${out}/${PFX}${sideCam && k === 'open' ? 'side_guard' : k}.png`;
      await page.screenshot({ path: png });
      if (sideCam) await page.evaluate(() => { window.game.freeCam = false; });
      execFileSync('python3', ['-I', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=88, method=6)', png, png.replace(/\.png$/, '.webp')]);
      fs.unlinkSync(png);
    }
    console.log(`SHOT ${k} ${JSON.stringify(st)}${k === 'open' && SCENE === 'touch' ? ` touch ${JSON.stringify(await page.evaluate(() => window.drv.info.touch ?? null))}` : ''}`);
    await page.evaluate((k) => { window.drv.shots[k] = true; window.drv.want = null; window.game.config.PHYSICS.maxStepsPerFrame = 8; }, k);
    if (k === 'open' && !tapped) {
      tapped = true;
      // 진짜 입력: 칼 쪽 화면을 톡 (pointerdown → pointerup, 끌지 않음 — input.js 톡)
      await page.evaluate(async () => {
        const cv = document.getElementById('game');
        const o = { pointerId: 77, pointerType: 'touch', clientX: 620, clientY: 200, bubbles: true, isPrimary: true, button: 0 };
        cv.dispatchEvent(new PointerEvent('pointerdown', o));
        await new Promise((r) => setTimeout(r, 40));
        cv.dispatchEvent(new PointerEvent('pointerup', o));
      });
    }
    if (k === 'recovery' || k === 'near_no_window' || k === 'side_recovered' || (SCENE === 'touch' && k === 'lunge_mid')) break;
  }
}
await page.waitForTimeout(400);
console.log(`END ${JSON.stringify(await state())} wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`ERRORS ${JSON.stringify(errors)}`);
await browser.close();
