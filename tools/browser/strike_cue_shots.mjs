// 칠 때 알림 (10/21 — src/strike_cue.js · docs/ui/hud_type_system_2026-10-10.md §18) 브라우저 스크린샷: 실제 게임을 테스트 경로로 띄워 진짜 이어 긋기 창을 연다.
//  우치가타나 · 상대 AI 멈춤 · 손을 높이 두고 아래로 터치 끌기(상대가 칼끝 밖이라 헛침) → 제비 베기(츠바메가에시) 창(game.playerUnique.ready)이 열리면
//  readyChain 을 바꿔 그 창을 잡아 두고(스크린샷이 경주가 되지 않게) 앞 긋기가 끝난 시각을 고정해 남은 시간 몫을 정한다 (hold = 창이 열린 뒤 지난 초).
//  찍는 것: 느낌표(보통 · 닫힐 즈음 · 비기 금빛 · 인데스) · 테두리(보통 · 비기 금빛) · 둘 다 · 알림 없는 앞 화면.
//   비기 창은 game.playerSecret 의 update 를 바꿔 open 을 직접 열고(0.6 s 에서 줄다가 멈춤), 인데스는 player.indesOpen · indesLeft 게터를 잠깐 붙인다
//   (인데스는 다른 가지에서 들어오는 중 — 이 바탕에는 게터가 없다).
//  실행 (저장소 뿌리에서): vite --port 5391 --strictPort &
//        node tools/browser/strike_cue_shots.mjs http://127.0.0.1:5391 [PNG 폴더 (기본 docs/ui/strike_cue_2026-10-21)]
//  화면 전체는 CSS 크기(844×390 — 폰에서 보는 크기), 머리 위 확대(_crop)는 기기 화소(dpr 2). 소프트웨어 GL 이라 느리다(판 하나 1~2 분)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = process.argv[2] || 'http://127.0.0.1:5391';
const dir = process.argv[3] || 'docs/ui/strike_cue_2026-10-21';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const report = { shots: [], errors: [] };

/** 싸움을 띄우고 AI 를 멈춘다 */
async function openFight(style) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push(`${style} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && report.errors.push(`${style} console ${m.text()}`));
  await page.goto(`${base}/?test=1&weapon=uchigatana&foe=heinrich&stage=poseidon&playerSecret=0&uniqueAssist=1&strikeCue=${style}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 240000 });
  await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {}); // 판 시작 가운데 소개가 내려간 뒤
  await page.evaluate(() => {
    window.game.ai.update = () => {};
  });
  return { ctx, page };
}

/** 진짜 이어 긋기 창: 손을 높이 두고 아래로 끌어 헛친다. 창이 열리면 readyChain 을 바꿔 잡아 둔다 (window.__cueHold = 열린 뒤 지난 초 · null = 놓음) */
async function realChain(page, hold) {
  for (let tryN = 0; tryN < 4; tryN++) {
    const from = [0.02, 0.52];
    await page.evaluate((from) => {
      const p = window.game.player, sk = p.skill;
      p.handOffset.set(from[0], from[1]);
      for (const v of [sk.prev, sk.anchor, sk.aim, sk.aimRaw]) v.set(from[0], from[1]);
      sk.aimVel.set(0, 0);
      sk.vel.set(0, 0);
      sk.follow.set(0, 0);
      sk.cutPending = false;
      sk.recovering = false;
      if (sk.uniq) sk.uniq.restPos = [from[0], from[1]];
    }, from);
    await page.waitForTimeout(1500);
    const got = await page.evaluate(
      ({ pts, v, hold }) =>
        new Promise((res) => {
          const cv = document.getElementById('game');
          const H = window.innerHeight;
          const scale = window.game.config.INPUT.touchSensitivity / Math.max(320, H);
          const gainY = 1.35;
          let x = window.innerWidth * 0.6, y = H * 0.5;
          const ev = (type) => new PointerEvent(type, { pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true });
          cv.dispatchEvent(ev('pointerdown'));
          const p = window.game.player, u = window.game.playerUnique;
          let fx = p.handOffset.x, fy = p.handOffset.y, i = 0, last = performance.now(), held = 0, after = 0;
          const tick = (now) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            if (i < pts.length) {
              const [tx, ty] = pts[i];
              const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy);
              const st = Math.min(d, v * Math.max(dt, 1 / 60));
              if (d > 1e-6) {
                fx += (dx / d) * st;
                fy += (dy / d) * st;
                x += (dx / d) * st / scale;
                y -= (dy / d) * st / scale / gainY;
                window.dispatchEvent(ev('pointermove'));
              }
              if (d - st < 1e-6) i++;
            } else if (held < 4) {
              if (++held === 4) window.dispatchEvent(ev('pointerup'));
            } else {
              if (u.ready) {
                const keep = u.ready;
                const e = u.list.find((q) => q.name === keep.name) ?? { U: { name: keep.name, nameKo: keep.nameKo } };
                const opened = { ...keep, t: u.t, simTime: window.game.stats.simTime, cue: window.game.strikeCue.state };
                window.__cueHold = hold;
                u.readyChain = (t) => {
                  if (window.__cueHold == null) return null;
                  if (u.last) u.last.tEnd = t - window.__cueHold; // 남은 시간 몫 고정 (strike_cue.js 가 last.tEnd 로 셈)
                  if (u.chainFrom) u.chainFrom.tEnd = -99; // 잇는 뒷몫 창은 쓰지 않는다
                  return e;
                };
                return res(opened);
              }
              if (++after > 40) return res(null);
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { pts: [[0.0, 0.14], [0.0, -0.5]], v: 4, hold },
    );
    if (got) return got;
  }
  return null;
}

/** 머리 위 느낌표 자리(CSS px) — 확대 자르기용 */
async function markRect(page) {
  await page.waitForFunction(() => window.game?.strikeCue && window.game.enemy?.cache?.parts?.head);
  return page.evaluate(() => {
    const g = window.game, s = g.strikeCue.sprite;
    const h = g.enemy.cache.parts.head.p;
    const v = new g.THREE.Vector3(...(s?.visible ? s.position.toArray() : [h.x, h.y + 0.3, h.z])).project(g.camera);
    const x = ((v.x + 1) / 2) * innerWidth, y = ((1 - v.y) / 2) * innerHeight;
    const w = 150, hh = 110;
    return { x: Math.max(0, Math.min(innerWidth - w, x - w / 2)), y: Math.max(0, Math.min(innerHeight - hh, y - hh * 0.62)), width: w, height: hh };
  });
}

/** want = { kind, maxFrac } 이면 알림이 그 창을 그 몫 아래로 그리고 있을 때까지 기다린다 (소프트웨어 GL 은 1~2 fps — 시간이 아니라 상태로 기다림) */
async function shot(page, name, { crop = false, note = '', want = null } = {}) {
  if (want) await page.waitForFunction(({ kind, maxFrac }) => { const s = window.game?.strikeCue?.state; return s && s.open && s.kind === kind && s.frac <= maxFrac && (s.shown || s.edge > 0) && s.alpha > 0; }, want, { timeout: 120000 });
  await page.waitForTimeout(500); // 나타남(0.08 s) · 몇 프레임 지나게
  const state = await page.evaluate(() => ({ cue: window.game.strikeCue.state, tint: window.game.screenTint.state, guard: document.getElementById('guardName')?.textContent ?? '' }));
  await page.screenshot({ path: `${dir}/${name}.png`, scale: 'css' });
  const row = { name, note, cue: state.cue, tintCue: +(state.tint.cue ?? 0).toFixed(3), guard: state.guard };
  if (crop) {
    const clip = await markRect(page);
    await page.screenshot({ path: `${dir}/${name}_crop.png`, clip });
    row.crop = `${name}_crop.png`;
  }
  report.shots.push(row);
  console.log(JSON.stringify(row));
  return row;
}

/** 비기 창을 직접 연다: 0.6 s 에서 줄다가 hold 초 남기고 멈춤 (null = 닫음) */
async function holdSecret(page, left) {
  await page.evaluate((left) => {
    const ps = window.game.playerSecret;
    window.__secretLeft = left;
    ps.update = (dt) => {
      if (window.__secretLeft == null) return void (ps.open = null);
      ps.open ??= { S: null, ctx: { ev: 'shot' }, t: 0.6 };
      ps.open.t = Math.max(window.__secretLeft, ps.open.t - dt);
    };
  }, left);
}

/** 인데스 창 흉내: player.indesOpen · indesLeft 게터 (0.6 s 에서 줄다가 left 초 남기고 멈춤 · null = 닫음) */
async function holdIndes(page, left) {
  await page.evaluate((left) => {
    const g = window.game, p = g.player;
    window.__indesLeft = left;
    window.__indesT0 = g.stats.simTime;
    Object.defineProperty(p, 'indesOpen', { configurable: true, get: () => window.__indesLeft != null });
    Object.defineProperty(p, 'indesLeft', { configurable: true, get: () => (window.__indesLeft == null ? null : Math.max(window.__indesLeft, 0.6 - (g.stats.simTime - window.__indesT0))) });
  }, left);
}

// ── 1. 느낌표 (기본) ──
{
  const { ctx, page } = await openFight('mark');
  await shot(page, 'mark_0_none', { note: '창 없음 — 알림 없음' });
  const opened = await realChain(page, 0.15);
  report.markOpened = opened;
  if (opened) {
    await shot(page, 'mark_1_chain', { crop: true, note: '이어 긋기 창 (진짜 발동) · 열린 뒤 0.15 s', want: { kind: 'chain', maxFrac: 0.8 } });
    await page.evaluate(() => (window.__cueHold = 0.5));
    await shot(page, 'mark_2_chain_late', { crop: true, note: '같은 창 · 닫히기 0.1 s 전 (흐려짐)', want: { kind: 'chain', maxFrac: 0.2 } });
    await page.evaluate(() => (window.__cueHold = null));
    await page.waitForTimeout(600);
  } else report.errors.push('mark: 이어 긋기 창이 열리지 않음');
  await holdSecret(page, 0.42);
  await shot(page, 'mark_3_secret_gold', { crop: true, note: '비기 입력 창 (직접 엶) · 금빛', want: { kind: 'secret', maxFrac: 0.8 } });
  await holdSecret(page, null);
  await page.waitForTimeout(400);
  await holdIndes(page, 0.24);
  await shot(page, 'mark_4_indes', { crop: true, note: '인데스 창 (게터 흉내)', want: { kind: 'indes', maxFrac: 0.8 } });
  await holdIndes(page, null);
  await ctx.close();
}

// ── 2. 테두리 ──
{
  const { ctx, page } = await openFight('edge');
  const opened = await realChain(page, 0.15);
  report.edgeOpened = opened;
  if (opened) {
    await shot(page, 'edge_1_chain', { note: '이어 긋기 창 (진짜 발동) · 테두리만', want: { kind: 'chain', maxFrac: 0.8 } });
    await page.evaluate(() => (window.__cueHold = null));
    await page.waitForTimeout(600);
  } else report.errors.push('edge: 이어 긋기 창이 열리지 않음');
  await holdSecret(page, 0.42);
  await shot(page, 'edge_2_secret_gold', { note: '비기 입력 창 · 금빛 테두리', want: { kind: 'secret', maxFrac: 0.8 } });
  await ctx.close();
}

// ── 3. 둘 다 ──
{
  const { ctx, page } = await openFight('both');
  const opened = await realChain(page, 0.15);
  report.bothOpened = opened;
  if (opened) await shot(page, 'both_1_chain', { crop: true, note: '이어 긋기 창 (진짜 발동) · 느낌표 + 테두리', want: { kind: 'chain', maxFrac: 0.8 } });
  else report.errors.push('both: 이어 긋기 창이 열리지 않음');
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify({ markOpened: report.markOpened, edgeOpened: report.edgeOpened, bothOpened: report.bothOpened, errors: report.errors }, null, 1));
