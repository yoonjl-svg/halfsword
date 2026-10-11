// 중국 막기 연환 사람 확인 (10/12 — docs/strike/cn_combo_play_2026-10-12.md §6). parry_button_probe.mjs 를 고쳐 씀. 읽기만.
//  플레이어 청강검(중국) · 상대 AI(FOE, 기본 longsword). 플레이어는 맞닿기 + 0.2 m 까지 걸어 들고 화면의 '막기' 단추(#btnParry)를 진짜 포인터로 누른 채 버틴다.
//  대본:
//   react — 창이 열리면 열린 때부터 REACT 초(기본 0.25 — 사람이 보고 누르기까지 [추정]) 뒤 창이 남아 있으면 단추를 누른 채 칼 쪽 화면을 빠르게 끈다 (전 대본)
//   early — 미리 받기(SECRET.cnBuffer): 정한 자세로 막아 칼이 맞닿아 기다리는 동안(playerSecret.pc.pend) 곧장 끈다 — 사람이 '막혔다' 싶어 일찍 그은 꼴.
//           창이 열린 뒤에도 남아 있으면 react 처럼 한 번 더 (지금 대본과 같음)
//   shots — 잔상 그림: 청강검 플레이어 연환(표두세 자리 — 직접 냄)과 打刀 AI 고노센(발도 — 직접 냄)을 옆 카메라로 찍는다 (판정 건너뜀 · 실행은 그대로)
//  주소 덧붙임 QS (예 '&cnBuffer=0' · '&cnFast=0' · '&cnBongdu=0').
//  실행: npx vite build && npx vite preview --port 4231 --strictPort &
//        node tools/browser/cn_combo_probe.mjs http://127.0.0.1:4231 <폴더> <react|early|shots> [SIM 초 40]
//  내놓는 것: SUMMARY(막기 성공 · 정한 자세 · 창 · 미리 받음 · 미리 받아 낸 · 버림 · 낸 · 맞힘) · 그림(shots) · ERRORS. 끝 코드 0 = 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4231';
const dir = process.argv[3] || '.';
const mode = process.argv[4] || 'early';
const SIM = +(process.argv[5] || 40);
const REACT = +(process.env.REACT || 0.25);
const FOE = process.env.FOE || 'longsword';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
async function open(q) {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 320 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
  await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 120000 });
  return page;
}
const sim = (page) => page.evaluate(() => window.game.stats.simTime);
const swipe = (page, dx, dy, id = 81) =>
  page.evaluate(
    async ([dx, dy, id]) => {
      const cv = document.getElementById('game');
      let x = 420,
        y = 130;
      const o = () => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 });
      cv.dispatchEvent(new PointerEvent('pointerdown', o()));
      for (let i = 0; i < 6; i++) {
        x += dx;
        y += dy;
        window.dispatchEvent(new PointerEvent('pointermove', o()));
        await new Promise((r) => setTimeout(r, 16));
      }
      window.dispatchEvent(new PointerEvent('pointerup', o()));
    },
    [dx, dy, id],
  );
// 옆에서 보기 (secret_instant_shots.mjs 와 같은 카메라)
const sideShot = async (page, path) => {
  await page.evaluate(() => {
    const g = window.game;
    const a = g.player.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    const mx = (a.x + b.x) / 2,
      mz = (a.z + b.z) / 2;
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(mx - (dz / L) * 3.2, 1.7, mz + (dx / L) * 3.2);
    g.camera.lookAt(mx, 1.15, mz);
    document.getElementById('menu').style.visibility = 'hidden';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await page.evaluate(() => {
    window.game.freeCam = false;
    document.getElementById('menu').style.visibility = '';
  });
};

if (mode === 'shots') {
  // 잔상만 오래 (느린 소프트웨어 GL 에서 사진에 남게 — 시험만, secret_instant_shots.mjs 와 같은 꼴) · 찍는 동안 멈춤(P)
  const shoot = async (page, who, kind, path) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
      const st = await page.evaluate(([who, kind]) => {
        const f = who === 'me' ? window.game.player : window.game.enemy;
        return { k: f.instantArc?.kind ?? null, live: !!f.iai, n: f.instantArc?.pts?.length ?? 0 };
      }, [who, kind]);
      if (st.k === kind && !st.live && st.n > 0) {
        await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })));
        await sideShot(page, path);
        console.log(`SHOT ${who} ${kind} 조각 ${st.n} → ${path}`);
        return true;
      }
      await page.waitForTimeout(20);
    }
    return false;
  };
  const near = async (page) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      const d = await page.evaluate(() => window.game.player.foeDistance());
      if (d < 2.0) break;
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(60);
    }
    await page.keyboard.up('KeyW');
  };
  {
    const page = await open(`?weapon=qinggang&foeWeapon=longsword&slowMo=0${process.env.QS ?? ''}`);
    await page.evaluate(() => (window.game.config.SECRET.instantArcLife = 8));
    await near(page);
    const ok = await page.evaluate(() => {
      const g = window.game;
      return g.player.skill.secret({ S: g.playerSecret.S, ctx: { ev: 'parry', slot: 'pyodu' } });
    });
    console.log(`연환 냄 ${ok}`);
    await shoot(page, 'me', 'combo', `${dir}/cn_combo_arc.png`);
    await page.context().close();
  }
  {
    const page = await open(`?weapon=qinggang&foeWeapon=uchigatana&slowMo=0${process.env.QS ?? ''}`);
    await page.evaluate(() => (window.game.config.SECRET.instantArcLife = 8));
    await near(page);
    const ok = await page.evaluate(() => !window.game.ai.secretRun && window.game.ai.secretGo(window.game.ai.secret));
    console.log(`고노센 냄 ${ok}`);
    await shoot(page, 'foe', 'iai', `${dir}/iai_arc.png`);
    await page.context().close();
  }
  console.log(`ERRORS ${errors.length}${errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''}`);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
}

// 판을 여러 번 (한쪽이 죽으면 새 판 — 합친 시간이 SIM 초가 될 때까지, 판 수 최대 ROUNDS 8)
const ROUNDS = +(process.env.ROUNDS || 8);
const T = { sim: 0, ok: 0, slot: 0, windows: 0, bufN: 0, bufFired: 0, bufDrop: 0, fired: 0, hits: 0, blocked: 0, rejAtk: 0, wounds: 0, rounds: 0, opened: [], combo: [], lines: {} };
let swipes = 0;
let early = 0;
for (let round = 0; round < ROUNDS && T.sim < SIM; round++) {
const page = await open(`?weapon=qinggang&foeWeapon=${FOE}&slowMo=0${process.env.QS ?? ''}`);
const S = await page.evaluate(() => {
  const g = window.game;
  const p = g.player;
  const ps = g.playerSecret;
  const R = (window.__cc = { opened: [], combo: [], openAt: null, hits: 0, blocked: 0 });
  let wasOpen = false;
  let fireAt = null;
  let res = null;
  const step0 = p.step.bind(p);
  p.step = (dt) => {
    step0(dt);
    const t = g.stats.simTime;
    const open = ps?.open?.ctx?.ev === 'parry';
    if (open && !wasOpen) {
      R.openAt = t;
      R.opened.push({ t: +t.toFixed(3), slot: ps.open.ctx.slot, line: g.playerGuard.line });
    }
    if (!open) R.openAt = null;
    wasOpen = open;
    R.pend = !!ps?.pc?.pend;
    const sec = p.skill.sec;
    if (sec && fireAt == null) {
      fireAt = t;
      R.combo.push({ t: +t.toFixed(3), slot: sec.ctx?.slot ?? null, stage: sec.stage });
    }
    if (!sec) fireAt = null;
    if (p.instantResult && p.instantResult !== res) {
      res = p.instantResult;
      if (res.combo) (R.hits += res.hits ?? 0), (R.blocked += res.blocked ? 1 : 0);
    }
  };
  return { S: ps?.S?.name ?? null, contact: p.swordArt.measure.contact };
});
if (!round) console.log(`청강검 대 ${FOE} · 비기 ${S.S} · 대본 ${mode} · REACT ${REACT} · QS '${process.env.QS ?? ''}'`);
await page.evaluate(() => {
  const b = document.getElementById('btnParry');
  const r = b.getBoundingClientRect();
  b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'touch', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, isPrimary: false, button: 0 }));
});
const t0 = await sim(page);
let lastPendSwipe = -1;
while ((await sim(page)) - t0 < SIM - T.sim) {
  const st = await page.evaluate(() => ({ t: window.game.stats.simTime, d: window.game.player.foeDistance(), alive: window.game.player.alive && window.game.enemy.alive, fight: window.game.state === 'fight', openAt: window.__cc.openAt, open: !!window.game.playerSecret?.open, pend: window.__cc.pend, held: window.game.playerSecret?.bufferHold }));
  if (!st.alive || !st.fight) break;
  if (st.d > S.contact + 0.2) await page.keyboard.down('KeyW');
  else await page.keyboard.up('KeyW');
  if (mode === 'early' && st.pend && !st.held && st.t - lastPendSwipe > 0.3) {
    lastPendSwipe = st.t;
    await swipe(page, swipes % 2 ? 22 : -22, 4); // 칼이 맞닿아 있는 동안 일찍 긋기
    swipes++;
    early++;
  } else if (st.open && st.openAt != null && st.t - st.openAt >= REACT) {
    await swipe(page, swipes % 2 ? 22 : -22, 4); // 창이 열린 뒤 긋기 (전 대본)
    swipes++;
  }
  await page.waitForTimeout(30);
}
await page.keyboard.up('KeyW');
const t1 = await sim(page);
const r = await page.evaluate(() => {
  const g = window.game;
  const P = g.playerSecret?.pc ?? {};
  const st = Object.values(g.player.skill.secretStats ?? {});
  return { R: window.__cc, windows: g.playerSecret?.opened ?? 0, fired: st.reduce((a, b) => a + (b.fired ?? 0), 0), pc: { ok: P.ok ?? 0, slot: P.slot ?? 0, rejAtk: P.rejAtk ?? 0, bufN: P.bufN ?? 0, bufFired: P.bufFired ?? 0, bufDrop: P.bufDrop ?? 0 }, guard: g.playerGuard.stats.lines, wounds: g.player.wounds?.length ?? 0, alive: [g.player.alive, g.enemy.alive] };
});
T.rounds++;
T.sim += t1 - t0;
for (const k of ['ok', 'slot', 'rejAtk', 'bufN', 'bufFired', 'bufDrop']) T[k] += r.pc[k];
T.windows += r.windows;
T.fired += r.fired;
T.hits += r.R.hits;
T.blocked += r.R.blocked;
T.wounds += r.wounds;
T.opened.push(...r.R.opened);
T.combo.push(...r.R.combo);
for (const [k, v] of Object.entries(r.guard)) T.lines[k] = (T.lines[k] ?? 0) + v;
console.log(`ROUND ${round + 1}: ${(t1 - t0).toFixed(1)} s · 창 ${r.windows} · 낸 ${r.fired} · 미리 받아 낸 ${r.pc.bufFired} · 맞힌 수 ${r.R.hits} · 살아 있음 ${r.alive}`);
await page.context().close();
}
console.log(`OPENED ${JSON.stringify(T.opened)}`);
console.log(`COMBO ${JSON.stringify(T.combo)}`);
console.log(`GUARD 줄 ${JSON.stringify(T.lines)}`);
console.log(`SUMMARY ${mode} QS '${process.env.QS ?? ''}': 판 ${T.rounds} · ${T.sim.toFixed(1)} s · 막기 성공 ${T.ok} · 정한 자세 ${T.slot} · 창 ${T.windows} · 미리 받음 ${T.bufN} · 미리 받아 낸 ${T.bufFired} · 버림 ${T.bufDrop} · 낸 ${T.fired} · 맞힌 수 ${T.hits} · 막힌 연환 ${T.blocked} · 긋기 ${swipes} (일찍 ${early}) · 공격 중이라 거른 맞닿음 ${T.rejAtk} · 내 상처 ${T.wounds}`);
console.log(`ERRORS ${errors.length}${errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
