// 실제 손가락 확인의 바탕 (감사 가지 2026-11-22-3 harness/hlib.mjs 를 옮김 — tools/browser/input_suite.mjs 가 쓴다)
//  실제 페이지 + 실제 손가락 사건(CDP Input.dispatchTouchEvent) + 한 프레임씩 넘기는 가짜 시계 (tools/browser/mordschlag_real_check.mjs 와 같은 꼴)
//  boot({ base, school, cells, weapon, freezeFoe, settle, tearOff }) → { page, cdp, run, frames, down, move, moveSync, up, cancel, tap, swipe, drag, stick, stickUp, snap, SC, errors, close }
//  게임은 보통 길로 들어간다: 첫 화면 → 'Stage 1'(#newJourney) → 싸움. 스킬 칸과 무기는 대기실 저장에 미리 넣어 둔다(대기실에서 배우고 장착한 것과 같은 꼴).
//  손가락 도구에서 배운 것 (감사 가지 N-035 — 셋 다 틀렸다가 바로잡은 것):
//   ① CDP touchEnd 에는 '떼는 손가락'을 적는다. 남을 손가락을 적으면 그 손가락이 떼인다 · 빈 touchEnd 는 남은 손가락을 모두 뗀다 (포인터 사건 기록으로 확인)
//   ② 움직임 사건은 보낸 직후 페이지에 닿지 않는다 (24번 중 21 ~ 24번이 한 박자 늦음). 맞추지 않으면 기계가 바쁠 때 두 움직임이 한 프레임에 들어간다 →
//      빠르기를 재는 확인은 moveSync(페이지가 그 사건을 본 뒤 돌아옴)로 보내고 프레임을 넘긴다
//   ③ page.clock(가짜 시계)은 사건의 e.timeStamp 도 가짜로 만든다 — 누름 길이(탭 0.18 s · 길게 누름)는 넘긴 가짜 시간으로 재진다. 실제 시간으로 기다려도 길게 누름이 되지 않는다
//      (사건 사이에 시계를 넘기지 않으면 그 사건들은 같은 시각으로 찍힌다)
//  플레이라이트는 /opt/node22/lib/node_modules/playwright 를 절대 경로로 부른다 (저장소 node_modules 에 없음) · 크로미움은 PW_CHROMIUM 또는 /opt/pw-browsers/chromium
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function boot({ base, school = 'german', cells = [], weapon = 'longsword', freezeFoe = true, settle = 6000, tearOff = false }) {
  base = base.replace(/\/$/, '');
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
    await ctx.route((url) => !url.href.startsWith(base + '/'), (r) => r.abort()); // 바깥 주소(계정 서버 등)는 부르지 않는다
    await ctx.addInitScript(({ school, cells, weapon, tearOff }) => {
      if (localStorage.getItem('inputcheck.seeded')) return;
      const acquisitions = [...cells.map((id) => ({ receipt: `skill:${school}:${id}`, kind: 'skill' })), { receipt: `weapon:${weapon}`, kind: 'item' }];
      localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, acquisitions, coins: 100, heads: 0 }));
      localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon }));
      if (tearOff) localStorage.setItem('stillness.lobby.neck.v1', JSON.stringify({ version: 1, neck: null })); // 기본 목걸이(기력 무한)를 뺀 저장 — 대기실에서 사람도 할 수 있음
      localStorage.setItem('inputcheck.seeded', '1');
    }, { school, cells, weapon, tearOff });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
    await page.clock.install({ time: new Date('2026-11-22T12:00:00') });
    await page.clock.pauseAt(new Date('2026-11-22T12:00:01'));
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    const run = (ms) => page.clock.runFor(ms);
    // window.game 이 다 선 뒤 (감사 판 round_over #1 은 renderCap 이 서기 전에 손을 대 실패)
    for (let i = 0; i < 300 && !(await page.evaluate(() => !!(window.game?.player && window.game?.renderCap))); i++) await run(100);
    await page.evaluate(() => { window.__paint = false; window.game.renderCap.tick = () => window.__paint; }); // 그리기는 끈다 (셈만 — 소프트웨어 그래픽이 느려서)
    const tapSel = async (sel) => { const L = page.locator(sel).first(); if (!(await L.isVisible().catch(() => false))) return false; const b = await L.boundingBox({ timeout: 500 }).catch(() => null); if (!b) return false; await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); return true; };
    if (await page.locator('#noticeDialog').evaluate((d) => d.open).catch(() => false)) await tapSel('#confirmNotices');
    await run(2500);
    await tapSel('#newJourney');
    for (let i = 0; i < 400 && !(await page.evaluate(() => window.game?.state === 'fight')); i++) {
      await run(100);
      if (i % 20 === 5) for (const s of ['#confirmNotices', '#newJourney']) await tapSel(s).catch(() => {});
    }
    const state = await page.evaluate(() => window.game?.state);
    if (state !== 'fight') throw new Error('싸움에 닿지 못함: ' + state);
    if (freezeFoe) await page.evaluate(() => { const g = window.game; g.ai.update = () => g.enemy.move.set(0, 0); }); // 상대 AI 멈춤 (억지 — 상대가 끼어들지 않게)
    // 페이지가 실제로 본 사건 수 (DOM 에 닿은 것 — 손가락 연결 확인 · moveSync)
    await page.evaluate(() => { window.__ev = { down: 0, up: 0, cancel: 0, move: 0 }; const c = document.getElementById('game'); c.addEventListener('pointerdown', () => window.__ev.down++); window.addEventListener('pointermove', () => window.__ev.move++, true); window.addEventListener('pointerup', () => window.__ev.up++); window.addEventListener('pointercancel', () => window.__ev.cancel++); });
    const cdp = await ctx.newCDPSession(page);
    const pad = await page.locator('#moveStick').boundingBox();
    const SC = { x: pad.x + pad.width / 2, y: pad.y + pad.height / 2, r: pad.width / 2 };
    const pts = new Map(); // 닿아 있는 손가락 (id → 자리)
    const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.values()] });
    const down = async (id, x, y) => { pts.set(id, { x, y, id }); await send('touchStart'); };
    const move = async (id, x, y) => { pts.set(id, { x, y, id }); await send('touchMove'); };
    // moveSync: move 와 같되 페이지가 그 움직임을 본 뒤 돌아온다 (② — 안 보면 두 움직임이 한 프레임에 들어가 빠르기가 두 배로 읽힘). 돌려주는 값 = 기다린 횟수 (-1 = 못 봄)
    const moveSync = async (id, x, y) => { const n0 = await page.evaluate(() => window.__ev.move); await move(id, x, y); for (let i = 0; i < 80; i++) { if ((await page.evaluate(() => window.__ev.move)) > n0) return i; } return -1; };
    const up = async (id) => { const p = pts.get(id); pts.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [p] : [] }); }; // ① 떼는 손가락을 적음
    const cancel = async () => { pts.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); };
    await run(settle); // 판 시작 카메라 + 첫 자세
    const snap = () => page.evaluate(() => {
      const g = window.game, p = g.player, e = g.enemy, sk = p.skill, st = p.stamina, G = g.playerGuard, W = g.playerSecret;
      const tp = sk.tap;
      return {
        state: g.state, d: +p.foeDistance().toFixed(2), ps: p.state, es: e.state,
        tap: tp ? { down: !!tp.down, cleave: !!tp.cleave, head: !!tp.head, vital: !!tp.vital, it: !!tp.it, drive: !!tp.drive } : null,
        thrusts: sk.thrusts ?? 0, vital: sk.vitalThrusts ?? 0, swinging: !!sk.swinging, pom: !!sk.pom, flick: !!sk.flick,
        sec: sk.sec?.stage ?? null, secPhase: sk.secretPhase ?? null, secOpen: !!W?.open, secName: W?.S?.name ?? null,
        counts: st.counts ? { ...st.counts } : null, spent: st.spent ? Object.fromEntries(Object.entries(st.spent).map(([k, v]) => [k, +(+v).toFixed(2)])) : null,
        stam: +st.value.toFixed(1), exhausted: !!st.exhausted,
        hand: [+p.handOffset.x.toFixed(3), +p.handOffset.y.toFixed(3)], mv: [+p.move.x.toFixed(2), +p.move.y.toFixed(2)], run: !!p.run?.on, runHold: +(p.run?.hold ?? 0).toFixed(2),
        guard: G ? { held: !!G.held, broken: !!G.broken } : null, guardLit: !!document.getElementById('btnParry')?.classList.contains('on'), handHeld: !!p.handHeld, grip: !!p.handGrip, autoPick: !!p.autoPick,
        iai: !!p.iai, iaiDraw: !!p.iaiDraw, rdWind: !!p.rdWind, winding: !!sk.uniq?.winding,
        cue: (document.getElementById('techSlot')?.innerText ?? '').trim().replace(/\s+/g, ' '), guardName: (document.getElementById('guardName')?.innerText ?? '').trim(),
        shots: p.gun?.shots ?? p.shots ?? null, ev: { ...window.__ev },
      };
    });
    const frames = async (n, each) => { for (let i = 0; i < n; i++) { await run(17); if (each) await each(i); } };
    // 손짓 (칼 손가락 id 2 · 스틱 엄지 id 1 · 막기 엄지는 부르는 쪽이 id 3). 움직임은 moveSync — 빠르기가 프레임마다 고르게
    const tap = async (x = 620, y = 200) => { await down(2, x, y); await run(17); await up(2); await run(17); };
    const swipe = async (x0, y0, x1, y1, steps = 4) => { await down(2, x0, y0); await run(17); for (let k = 1; k <= steps; k++) { await moveSync(2, x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps); await run(17); } await up(2); await run(17); };
    const drag = async (x0, y0, x1, y1, steps = 40) => { await down(2, x0, y0); await run(17); await sleep(260); for (let k = 1; k <= steps; k++) { await moveSync(2, x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps); await run(17); } };
    const stick = async (fx, fy) => { if (!pts.has(1)) { await down(1, SC.x, SC.y); await run(17); } await move(1, SC.x + fx * SC.r, SC.y - fy * SC.r); await run(17); };
    const stickUp = async () => { if (pts.has(1)) { await up(1); await run(17); } };
    return { browser, page, cdp, run, frames, down, move, moveSync, up, cancel, tap, swipe, drag, stick, stickUp, snap, SC, errors, close: () => browser.close() };
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
}
