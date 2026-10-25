// 이탈리아 찌르기 그림 (10/25 08:0x 사장님 '이탈리아 찌르기 손봐' — docs/strike/italian_thrust_2026-10-25.md · 판 THRUST.itLunge).
//  폰 가로 844 × 390 · 배율 2 · WebP. 물리를 멈추고(PHYSICS.maxStepsPerFrame 0) 옆 카메라(두 가슴 줄에 수직 3.2 m — wrist_audit_shots.mjs 와 같은 자리)와 게임 화면 그대로를 찍는다. 화면 글자 · 단추는 숨김(그림만).
//   tap        — 사람 레이피어 1번 자세(프리마 — 패드 [0.02, 0.52]) 탭 찌르기: 상대(롱소드 · 세워 둠 · 손 FOE_PAD 기본 바보 [0, −0.5] — 칼 내린 상대 · 상처 끔 시연)와 가슴 사이를
//                TAP_GAP(기본 2.1 m)으로 천천히 맞춰 그 간격(± 0.05 m)에 60 스텝 든 뒤 톡 → 내 칼이 상대 몸에 처음 판정을 낸 뒤 둘째 스텝 · 없으면 가장 뻗은 때(뻗고 버티기 끝 — 이탈리아 찌르기는 런지가 끝나 뻗은 채 머묾이 풀린 때)에 멈춤 (<판>_tap_{side,game})
//   imbroccata — AI 레이피어(토메 — 숙련도 2 · 위에서 내려 찌르기 열림)의 임브로카타: 나(롱소드)는 손 FOE_PAD(기본 바보)로 서 있고 · 상처 끔 시연
//                — 내가 걸어 가슴 사이를 IMB_GAP(기본 1.7 m — 레이피어 맞닿기 1.54 + 기술 reach 언저리)으로 맞춘 때 — 임브로카타를 내게 함(ai.startAttack) → 상대 칼이 내 몸에 처음 판정을 낸
//                뒤 둘째 스텝 · 없으면 상대 탭이 가장 뻗은 때에 멈춤 (<판>_imb_{side,game}) — 맞출 때까지 상대 AI 는 꺼 두고(제 자세로 섬) 그때 다시 켬
//   판: TAGS='이름:쿼리,…' (기본 before:&itThrust=0 — 10/25 아침 판 · after: — 지금 기본)
//  npx vite build --outDir <tmp>/dist && node tools/pwa/build.mjs <tmp>/dist && npx vite preview --outDir <tmp>/dist --port 5583 --strictPort &
//  node tools/browser/italian_thrust_shots.mjs http://127.0.0.1:5583 docs/handoff/italian_thrust_2026-10-25 [tap,imbroccata]   (SHOT_WAIT=ms)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.argv[2] || 'http://127.0.0.1:5583';
const out = process.argv[3] || 'docs/handoff/italian_thrust_2026-10-25';
const what = (process.argv[4] || 'tap,imbroccata').split(',');
const TAGS = process.env.TAGS ? process.env.TAGS.split(',').map((x) => [x.split(':')[0], x.slice(x.indexOf(':') + 1)]) : [['before', '&itThrust=0'], ['after', '']];
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
const log = [];

async function open(weapon, extra, foe, foeWeapon) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${base}/?weapon=${weapon}&foe=${foe}&foeWeapon=${foeWeapon}&skillNodes=all&slowMo=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 90000 });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.evaluate(() => {
    const g = window.game;
    g.enemy.applyWound = () => {}; // 상처 끔 (시연 — 쓰러지지 않게)
    g.player.applyWound = () => {};
  });
  return { ctx, page };
}

/** 물리가 멈춘 그 자세: side = 두 가슴 줄에 수직 3.2 m · game = 게임 화면 그대로 */
async function shot(page, file, view) {
  await page.evaluate((view) => {
    const g = window.game;
    if (view === 'game') return;
    const p = g.player;
    const a = p.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    g.freeCam = true;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const s = -(p.side ?? 1);
    const cx = s * (dz / L), cz = -s * (dx / L);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    g.camera.position.set(mx + cx * 3.2, 1.1, mz + cz * 3.2);
    g.camera.lookAt(mx, 0.85, mz);
  }, view);
  await page.waitForTimeout(350);
  const png = `${out}/${file}.png`;
  await page.screenshot({ path: png });
  execFileSync('python3', ['-I', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=86, method=6)', png, png.replace(/\.png$/, '.webp')]);
  fs.unlinkSync(png);
  await page.evaluate(() => {
    window.game.freeCam = false;
  });
}

/** 장면 하나: setup(page 안 — 스텝마다 부를 drive 를 window.drv.fn 에) → 멈추면 옆 · 게임 화면 */
async function scene(tag, weapon, extra, foe, foeWeapon, src, arg) {
  const { ctx, page } = await open(weapon, extra, foe, foeWeapon);
  await page.evaluate(
    ([src, arg]) => {
      const g = window.game, p = g.player, e = g.enemy, ps = g.playerSecret, orig = ps.update.bind(ps);
      const fn = new Function('g', 'p', 'e', 'D', 'arg', src);
      const D = (window.drv = { want: null, n: 0, hit: null, info: {} });
      // 몸 접촉 기록: 찌르는 쪽 칼 → 맞는 쪽 몸 (판정이 난 접촉만 — combat.strike 결과)
      const C = g.combat, os = C.strike.bind(C);
      C.strike = (pr, point, passing) => {
        const r = os(pr, point, passing);
        if (r && D.att && pr.w.fighter === D.att && pr.v?.fighter && pr.v.fighter !== D.att && D.armed && !D.hit) D.hit = { part: pr.v.part, type: r.type, e: +r.energy.toFixed(1), sp: +r.speed.toFixed(1) };
        return r;
      };
      ps.update = (dt, busy) => {
        orig(dt, busy);
        if (D.want) return;
        D.n++;
        if (fn(g, p, e, D, arg)) {
          D.want = 'shot';
          g.config.PHYSICS.maxStepsPerFrame = 0;
        }
      };
    },
    [src, arg],
  );
  try {
    await page.waitForFunction(() => window.drv.want, null, { timeout: +(process.env.SHOT_WAIT || 180000) });
  } catch {
    const dbg = await page.evaluate(() => ({ n: window.drv.n, info: window.drv.info, gap: window.game.player.foeDistance() }));
    console.log(`장면 시간 넘김 ${tag} ${JSON.stringify(dbg)}`);
    await ctx.close();
    return;
  }
  await page.waitForTimeout(250);
  const v = await page.evaluate(() => ({ hit: window.drv.hit, gap: +window.game.player.foeDistance().toFixed(2), ...window.drv.info }));
  await shot(page, `${tag}_side`, 'side');
  await shot(page, `${tag}_game`, 'game');
  log.push(`${tag} ${JSON.stringify(v)}`);
  console.log(`SHOT ${tag} ${JSON.stringify(v)}`);
  await ctx.close();
}

// 사람 1번 자세 탭: 걸어 들어가 TAP_GAP 에서 1.0 s(120 스텝) 붙잡고 톡 → 첫 몸 접촉 다음 스텝 · 없으면 뻗은 채 머묾이 끝나는 스텝
const TAP = `
  if (!D.init) { D.init = 1; g.ai.update = () => e.move.set(0, 0); p.skill.autoGuard = true; }
  const pad = [0.02, 0.52], fp = arg.foePad;
  e.handOffset.set(fp[0], fp[1]); for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) e.skill[k]?.set?.(fp[0], fp[1]);
  if (!D.fired) {
    const d = p.foeDistance(), mv = Math.max(-0.5, Math.min(0.5, (d - arg.gap) * 2.5)), at = Math.abs(d - arg.gap) < 0.05; // 그 간격으로 천천히 맞춤 (전 · 후 같은 자리에서 톡)
    p.move.set(0, at ? 0 : mv); p.stickX = 0; p.stickY = at ? 0 : mv;
    p.handOffset.set(pad[0], pad[1]); for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) p.skill[k]?.set?.(pad[0], pad[1]);
    if (at) D.atN = (D.atN ?? 0) + 1; // 그 간격에 든 스텝 수 (흔들려 잠깐 벗어나도 셈은 이어짐)
    if (at && D.atN > 60) { D.info.d0 = +p.foeDistance().toFixed(2); D.att = p; D.armed = true; D.fired = p.skill.thrust(); D.tapT = g.stats.simTime; D.info.lunge = p.skill.tap?.it?.fwd ?? null; }
    return false;
  }
  p.move.set(0, 0); p.stickY = 0;
  if (D.hit) { D.k = (D.k ?? 0) + 1; if (D.k >= 2) D.info.t = +(g.stats.simTime - D.tapT).toFixed(2); return D.k >= 2; }
  // 닿지 않으면 가장 뻗은 때 — 뻗고 버티기 끝 (이탈리아 찌르기는 런지가 끝나 뻗은 채 머묾이 풀린 때 — 걷던 발을 기다린 런지 부탁 · 몸 가속 · skill.js itLungeOn 과 같은 셈)
  const tp = p.skill.tap, gt = p.gait, K = tp?.K;
  const lungeOn = !!gt && (!!gt.lungeBrake || (gt.req?.kind === 'lunge' && !!gt.req.accel && gt.req.fwd > 0));
  if (!tp || (tp.t >= K.aim + K.extend + K.hold - 1e-5 && !(tp.it && !tp.it.landed && lungeOn))) { D.info.t = +(g.stats.simTime - D.tapT).toFixed(2); return true; }
  return false;`;

// AI 임브로카타: 나는 손을 떼고 섬 · 상대 AI 가 맞닿기 거리 + 기술 reach 안에서 볼 때 임브로카타를 시작하게 함 → 첫 몸 접촉 다음 스텝 · 없으면 상대 탭 끝
const IMB = `
  const ai = g.ai;
  if (!D.init) { D.init = 1; p.skill.autoGuard = true; D.aiUpd = ai.update.bind(ai); ai.update = () => e.move.set(0, 0); } // 맞출 때까지 상대는 제 자세로 섬
  const fp = arg.foePad; p.handOffset.set(fp[0], fp[1]); for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) p.skill[k]?.set?.(fp[0], fp[1]);
  if (!D.started) {
    // 내가 걸어 가슴 사이를 arg.gap 으로 맞춰 그 간격에 60 스텝 들면 상대 AI 를 다시 켜고 그때 임브로카타 (전 · 후 같은 간격에서)
    const d = p.foeDistance(), mv = Math.max(-0.5, Math.min(0.5, (d - arg.gap) * 2.5)), at = Math.abs(d - arg.gap) < 0.05;
    p.move.set(0, at ? 0 : mv); p.stickX = 0; p.stickY = at ? 0 : mv;
    const t = ai.uniqueByName?.get('imbroccata') ?? ai.school?.tech?.find?.((x) => x.name === 'imbroccata');
    D.info.has = !!t;
    if (at) D.atN = (D.atN ?? 0) + 1;
    if (t && at && D.atN > 60 && e.state === 'stand') { ai.update = D.aiUpd; D.started = ai.startAttack(t, 'open', { noFeint: true }); D.att = e; }
    return false;
  }
  p.move.set(0, 0); p.stickX = p.stickY = 0;
  if (ai.mode === 'attack' && ai.tech?.name === 'imbroccata' && ai.phase === 'strike' && !D.armed) { D.armed = true; D.tapT = g.stats.simTime; D.info.d0 = +e.foeDistance().toFixed(2); D.info.lunge = e.skill.tap?.it?.fwd ?? null; D.info.head = !!e.skill.tap?.head; }
  if (D.started && ai.mode !== 'attack' && !D.armed) { D.started = false; return false; }
  if (!D.armed) return false;
  if (D.hit) { D.k = (D.k ?? 0) + 1; if (D.k >= 2) D.info.t = +(g.stats.simTime - D.tapT).toFixed(2); return D.k >= 2; }
  const tp = e.skill.tap, gt = e.gait, K = tp?.K;
  const lungeOn = !!gt && (!!gt.lungeBrake || (gt.req?.kind === 'lunge' && !!gt.req.accel && gt.req.fwd > 0));
  if (!tp || (tp.t >= K.aim + K.extend + K.hold - 1e-5 && !(tp.it && !tp.it.landed && lungeOn))) { D.info.t = +(g.stats.simTime - D.tapT).toFixed(2); return true; }
  return false;`;

for (const [pf, ex] of TAGS) {
  const foePad = (process.env.FOE_PAD || '0,-0.5').split(',').map(Number); // 맞는 쪽 손 (기본 바보 — 칼을 내린 상대 · 봇 시험 '칼 내린 상대'와 같음)
  if (what.includes('tap')) await scene(`${pf}_tap`, process.env.WEAPON || 'rapier', ex, 'isolde', 'longsword', TAP, { gap: +(process.env.TAP_GAP || 2.1), foePad });
  if (what.includes('imbroccata')) await scene(`${pf}_imb`, 'longsword', ex, 'tome', 'rapier', IMB, { gap: +(process.env.IMB_GAP || 1.7), foePad });
}
fs.writeFileSync(`${out}/shots_log.txt`, log.join('\n') + '\n');
if (errors.length) console.log('오류', errors.slice(0, 5));
await browser.close();
