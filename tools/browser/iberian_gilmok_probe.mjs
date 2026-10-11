// 이베리아 비기 v6 길목 지키기 플레이어 확인 (10/11 — docs/strike/iberian_secret_v6_2026-10-11.md). iberian_flow_probe.mjs 를 고쳐 씀. 읽기만.
//  두 대본 (상대 AI 는 살아 있다 — 멈추지 않음):
//   press — 맞붙은 거리에서 계속 휘두르는 플레이어: 닿는 거리 안쪽까지 걸어 든 뒤 SIM 초(기본 20) 동안 0.35 s 마다 좌우로 끌기(휘두르기), 멀어지면 W. 창이 열린 수(playerSecret.opened)·낸 수를 센다.
//      판 gilmok · flow(v5) 를 같은 대본으로 견준다.
//   hold — 간격 밖에서 버티다 상대가 들어올 때(판 gilmok 만): S 로 물러나 칼끝 거리 밖에 선다 → '길목 지키기 준비'가 뜬 때 · 창이 열린 때를 적고 → 창에서 끌기 한 번으로 낸다.
//      준비 · 창 · 한 칼 세 순간을 멈춰 찍고, 물리 스텝마다 칼끝 빠르기를 적는다.
//  실행: npx vite build && npx vite preview --port 4195 --strictPort &
//        hold 의 낼 때: FIRE=window(창이 열린 순간, 기본) | early | right | late (사장님 결정 10/11 13:2x — 준비가 켜진 뒤 언제든 낼 수 있음) · RIGHT_D=1.75
//        node tools/browser/iberian_gilmok_probe.mjs http://127.0.0.1:4195 <폴더> <press|hold> [gilmok|flow] [SIM 초 20]
//  내놓는 것: <폴더>/ibgil_<대본>_<판>.json · ibgil_hold_<n>.png · 콘솔 SUMMARY · ERRORS. 끝 코드 0 = 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4195';
const dir = process.argv[3] || '.';
const mode = process.argv[4] || 'press';
const ver = process.argv[5] || 'gilmok';
const SIM = +(process.argv[6] || 20);
const FIRE = process.env.FIRE || 'window'; // hold 대본에서 낼 때 (아래)
const RIGHT_D = +(process.env.RIGHT_D || 1.75);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`${base}/?weapon=zweihander&foeWeapon=longsword&ibSecret=${ver}&slowMo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 120000 });
const S = await page.evaluate(() => {
  const g = window.game;
  const p = g.player;
  const rec = (window.__rec = []);
  const step0 = p.step.bind(p);
  p.step = (dt) => {
    step0(dt);
    const sec = p.skill.sec;
    const ps = g.playerSecret;
    const c = p.bodies.chest.translation(); const tp = p.tipPrev ?? p.bladePoint(1); const r = p.right(new g.THREE.Vector3()); const fwv = p.forward(new g.THREE.Vector3()); const rx = tp.x - c.x, rz = tp.z - c.z; rec.push({ cx: +c.x.toFixed(3), cz: +c.z.toFixed(3), x: +(p.side * (rx * r.x + rz * r.z)).toFixed(3), y: +(tp.y - c.y).toFixed(3), fw: +(rx * fwv.x + rz * fwv.z).toFixed(3), t: +g.stats.simTime.toFixed(4), v: +p.tipVel.length().toFixed(3), st: sec?.stage ?? null, n: sec?.cur?.name ?? (sec ? sec.S.name : null), d: +p.foeDistance().toFixed(2), arm: !!ps?.gilArm?.armed, open: !!ps?.open, cue: document.getElementById('techCue')?.textContent?.slice(0, 40) ?? '' });
  };
  const rq = p.gait.requestStep.bind(p.gait); window.__req = []; p.gait.requestStep = (o) => { const r = rq(o); window.__req.push({ t: +g.stats.simTime.toFixed(3), kind: o.kind, fwd: o.fwd, ok: r, seg: p.skill.sec?.cur?.name ?? null, moveY: +p.move.y.toFixed(2) }); return r; }; // 10/11 v6 6차: 디딤이 실제로 나가나
  const M = p.swordArt.measure;
  return { S: g.playerSecret.S?.name, reach: M.reach, contact: M.contact };
});
if (process.env.EDGE) await page.evaluate((e) => (window.game.config.SECRET.gilmokEdge = e), process.env.EDGE); // EDGE=cut: 길목 경계 스위치 (10/11 v6 6차)
console.log(`판 ${ver} 비기 ${S.S} reach ${S.reach.toFixed(2)} contact ${S.contact.toFixed(2)} 대본 ${mode}`);
const swipe = (dx, dy, id = 81) =>
  page.evaluate(
    async ([dx, dy, id]) => {
      const cv = document.getElementById('game');
      let x = 640, y = 150;
      const o = () => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 });
      cv.dispatchEvent(new PointerEvent('pointerdown', o()));
      for (let i = 0; i < 8; i++) {
        x += dx;
        y += dy;
        window.dispatchEvent(new PointerEvent('pointermove', o()));
        await new Promise((r) => setTimeout(r, 20));
      }
      window.dispatchEvent(new PointerEvent('pointerup', o()));
    },
    [dx, dy, id],
  );
const sim = () => page.evaluate(() => window.game.stats.simTime);
const freeze = (on) => page.evaluate((on) => { const g = window.game; if (on && g.state === 'fight') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); if (!on && g.state === 'paused') window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })); document.getElementById('menu').style.visibility = on ? 'hidden' : ''; }, on);
const shoot = async (k, label) => {
  await freeze(true);
  const info = await page.evaluate(() => {
    const g = window.game, f = g.player, o = g.enemy;
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx, s = -f.side;
    const R = 3.4;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    g.freeCam = true;
    g.camera.position.set(mx + rx * s * R, 1.4, mz + rz * s * R);
    g.camera.lookAt(mx, 1.1, mz);
    const sec = f.skill.sec;
    return { t: +g.stats.simTime.toFixed(3), n: sec?.cur?.name ?? sec?.stage ?? null, v: +f.tipVel.length().toFixed(2), d: +f.foeDistance().toFixed(2), arm: !!g.playerSecret.gilArm?.armed, open: !!g.playerSecret.open };
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/ibgil_${mode}_${k}.png` });
  await page.evaluate(() => (window.game.freeCam = false));
  await freeze(false);
  console.log(`SHOT ${k} ${label} ${JSON.stringify(info)}`);
};
const out = { ver, mode, reach: S.reach, contact: S.contact };
if (mode === 'press') {
  await page.keyboard.down('KeyW');
  await page.waitForFunction((r) => window.game.player.foeDistance() < r - 0.3, S.reach, { timeout: 120000 }).catch(() => {});
  await page.keyboard.up('KeyW');
  const t0 = await sim();
  const o0 = await page.evaluate(() => window.game.playerSecret.opened);
  let n = 0;
  while ((await sim()) - t0 < SIM) {
    const st = await page.evaluate((r) => ({ d: window.game.player.foeDistance(), alive: window.game.player.alive && window.game.enemy.alive, fight: window.game.state === 'fight' }), S.reach);
    if (!st.alive || !st.fight) break;
    if (st.d > S.contact) await page.keyboard.down('KeyW');
    else await page.keyboard.up('KeyW');
    await swipe(n % 2 ? 14 : -14, n % 3 ? 6 : -6);
    n++;
    await page.waitForTimeout(150);
  }
  await page.keyboard.up('KeyW');
  const t1 = await sim();
  const r = await page.evaluate(() => ({ opened: window.game.playerSecret.opened, fired: Object.values(window.game.player.skill.secretStats ?? {}).reduce((a, b) => a + (b.fired ?? 0), 0) }));
  Object.assign(out, { simT: t1 - t0, swipes: n, opened: r.opened - o0, fired: r.fired });
  const rec = await page.evaluate(() => window.__rec);
  const R = rec.filter((x) => x.t >= t0 && x.t <= t1);
  const inside = R.filter((x) => x.d < S.reach).length / Math.max(1, R.length);
  const armT = R.filter((x) => x.arm).length / 120;
  out.insideShare = inside;
  out.armT = armT;
  console.log(`SUMMARY press ${ver}: ${out.simT.toFixed(1)} s · 휘두르기 ${n} · 창 ${out.opened} · 낸 ${out.fired} · 칼끝 거리 안 몫 ${(100 * inside).toFixed(0)} % · 준비 켜진 시간 ${armT.toFixed(1)} s`);
} else {
  // hold: 칼끝 거리 밖으로 물러나 버틴다
  await page.keyboard.down('KeyS');
  await page.waitForFunction((r) => window.game.player.foeDistance() > r + 0.6, S.reach, { timeout: 60000 }).catch(() => {});
  await page.keyboard.up('KeyS');
  const t0 = await sim();
  let armAt = null, openAt = null, fired = false, k = 0, fireAt = null, cutShot = false, lowShot = false, windShot = false;
  while ((await sim()) - t0 < 60) {
    const st = await page.evaluate(() => { const g = window.game; const ps = g.playerSecret; const s = g.player.skill.sec; return { arm: !!ps.gilArm?.armed, open: !!ps.open, d: g.player.foeDistance(), sec: s ? { st: s.stage, n: s.cur?.name ?? null } : null, t: g.stats.simTime, alive: g.player.alive && g.enemy.alive, w: g.enemy.wounds?.length ?? 0, w0: window.__w0 ?? null, wind: ps.gilPose?.windT ?? 0, low: ps.gilPose?.guard?.name ?? null, hand: [+g.player.handOffset.x.toFixed(2), +g.player.handOffset.y.toFixed(2)] }; });
    if (!st.alive) break;
    // 너무 붙으면(준비 전) 다시 물러남
    if (!st.arm && !st.open && !fired && st.d < S.reach + 0.2) await page.keyboard.down('KeyS');
    else await page.keyboard.up('KeyS');
    if (st.arm && armAt == null) armAt = st.t;
    // 10/11 v6 5차: 준비 중 손을 떼고 있으면 낮은 자세로 쉼 → 상대가 다가오면 옆 자세로 감음 — 두 모습을 찍는다
    if (st.arm && armAt != null && !lowShot && st.t - armAt > 1.2 && !(st.wind > 0)) {
      lowShot = true;
      await shoot(++k, `준비 — 낮은 자세(${st.low}) 손 ${JSON.stringify(st.hand)}`);
    }
    if (st.arm && !windShot && st.wind > 0) {
      windShot = true;
      await page.waitForTimeout(250);
      await shoot(++k, `준비 — 상대가 다가와 옆 자세로 감음 손 ${JSON.stringify(st.hand)}`);
    }
    if (st.open && openAt == null) openAt = st.t;
    // 낼 때 (사장님 결정 10/11 13:2x — 준비가 켜진 뒤 언제든): FIRE=window(전과 같음 — 창이 열린 순간) · early(상대가 칼끝 거리 reach 보다 0.5 m 넘게 멀 때) ·
    //  right(상대 가슴 ≤ RIGHT_D — 기본 1.75 = 이 한 칼의 가운데 선 칼끝 앞 1.6 m(§17 측정) + 0.15) · late(창 끝 무렵 — 창이 열리고 0.42 s, 유예 0.5 s 끝 무렵)
    const can = (st.arm || st.open) && !fired && !st.sec;
    const go = !can ? false : FIRE === 'early' ? st.arm && st.d > S.reach + 0.5 && armAt != null && st.t - armAt > 0.3 : FIRE === 'right' ? st.d <= RIGHT_D : FIRE === 'late' ? st.open && st.t - openAt >= 0.42 : st.open;
    if (go) {
      await page.evaluate(() => { window.__fireT = window.game.stats.simTime; window.__w0 = window.game.enemy.wounds?.length ?? 0; });
      await swipe(-14, 0);
      fired = true;
      fireAt = st.t;
      console.log(`FIRE ${FIRE}: 상대 가슴 ${st.d.toFixed(2)} m · 준비 ${st.arm} · 창 ${st.open}`);
    }
    if (fired && st.w0 != null && st.w > st.w0 && !cutShot) { // 한 칼이 닿은 순간 (상대 상처가 늘어난 첫 순간)
      cutShot = true;
      await shoot(++k, '한 칼이 닿은 순간');
    }
    if (fired && !st.sec && st.t - fireAt > 0.3) break;
    await page.waitForTimeout(15);
  }
  await page.keyboard.up('KeyS');
  const rec = await page.evaluate(() => ({ rec: window.__rec, fireT: window.__fireT ?? null }));
  const hit = await page.evaluate(() => ({ wounds: (window.game.enemy.wounds?.length ?? 0) - (window.__w0 ?? 0), E: (window.game.enemy.wounds ?? []).slice(window.__w0 ?? 0).map((w) => `${w.part}:${(+w.severity).toFixed(2)}`), landed: Object.values(window.game.player.skill.secretStats ?? {}).reduce((a, b) => a + (b.landed ?? 0), 0) }));
  console.log(`HIT 한 칼 뒤 상대 상처 ${hit.wounds} (${hit.E.join(",")} 부위:세기) · 비기 맞힘 ${hit.landed}`);
  Object.assign(out, { armAt, openAt, t0, fireT: rec.fireT, hit });
  const R = rec.fireT ? rec.rec.filter((x) => x.t >= rec.fireT - 0.3 && x.t <= rec.fireT + 1.5) : [];
  out.series = R;
  const run = R.filter((x) => x.st && x.st !== 'stiff');
  const segs = [];
  for (const x of R) {
    const key = x.st === 'stiff' ? 'stiff' : x.st ? x.n : 'off';
    if (!segs.length || segs[segs.length - 1].key !== key) segs.push({ key, t0: x.t, t1: x.t, vmax: 0 });
    const s = segs[segs.length - 1];
    s.t1 = x.t;
    s.vmax = Math.max(s.vmax, x.v);
  }
  { const RQ = await page.evaluate(() => window.__req.filter((q) => q.t >= (window.__fireT ?? 0) - 0.05)); console.log('REQ ' + JSON.stringify(RQ)); const O = R.find((x) => x.t >= rec.fireT); if (O) console.log(`OPEN 낸 때 칼끝 옆 ${O.x} · 높이 ${O.y} · 앞 ${O.fw} · 빠르기 ${O.v} m/s`); const C0 = await page.evaluate(() => null); }
  console.log('SEGS ' + segs.map((s) => `${s.key} ${(s.t1 - s.t0).toFixed(2)}s 최고 ${s.vmax.toFixed(1)}`).join(' | '));
  { const RR = R.filter((x) => x.st === 'strike' && /gilmok/.test(x.n ?? '')); for (let q = 1; q < RR.length; q++) if (RR[q - 1].x * RR[q].x <= 0 && RR[q - 1].x !== RR[q].x) { { const F0 = R.find((x) => x.t >= rec.fireT); console.log(`MID 가운데 선: 칼끝 앞 ${RR[q].fw.toFixed(2)} m · 높이 ${RR[q].y.toFixed(2)} m · 상대 가슴 ${RR[q].d.toFixed(2)} m · ${RR[q].n} · 낸 뒤 ${(RR[q].t - rec.fireT).toFixed(2)} s · 몸 옮김 ${F0 ? Math.hypot(RR[q].cx - F0.cx, RR[q].cz - F0.cz).toFixed(2) : "-"} m`); } break; } } // 10/11 v6 5차
  console.log(`SUMMARY hold: 물러선 뒤 준비까지 ${armAt != null ? (armAt - t0).toFixed(2) : '-'} s · 창까지 ${openAt != null ? (openAt - t0).toFixed(2) : '-'} s · 비기 ${run.length} 스텝 · 칼끝 최고 ${run.length ? Math.max(...run.map((x) => x.v)).toFixed(1) : '-'} m/s`);
}
fs.writeFileSync(`${dir}/ibgil_${mode}_${ver}.json`, JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
