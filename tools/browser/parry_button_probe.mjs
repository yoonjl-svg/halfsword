// 막기 버튼 플레이어 확인 (10/11 — docs/strike/player_parry_button_2026-10-11.md). parry_combo_probe.mjs 를 고쳐 씀. 읽기만.
//  대본 (상대 롱소드 AI 는 살아 있다 — 플레이어는 맞닿기 + 0.2 m 까지만 걸어 들고 기다린다):
//   none   — 버튼 없이: 손가락을 대지 않는다 (손은 유파 쉴 자세)
//   button — 화면의 '막기' 단추(#btnParry)를 진짜 포인터로 누른 채 둔다 (pointerdown 만 — 떼지 않음).
//            막기 연환 창이 열리면 열린 때부터 REACT 초(기본 0.25 — 사람이 보고 누르기까지 [추정]) 뒤 창이 남아 있으면 단추를 누른 채 칼 쪽 화면을 빠르게 끈다
//            (진짜 입력 길 — main.js 의 '누른 채 휘두르기 → 막기를 놓고 공격, 창이 열려 있으면 비기').
//  재는 것: 상대 공격(ai.afterStrike 한 번 = 한 수)마다 맞힘·막힘(칼끼리 맞물리고 안 맞음)·헛침 · 내 상처 수 · 막기 버튼이 정한 줄·자리 이름 ·
//           막기 연환 창·낸·맞힘·수마다 칼끝 최고 m/s.
//  QS='&parryAssist=0' 처럼 주소 뒤에 붙일 것 (10/12 막기 거듦 전/후 — docs/strike/parry_assist_2026-10-12.md). SUMMARY 끝에 그 기록의 셈(칼날 상처 없음 + 칼 맞물림 = 받아냄, 칼날 상처 = 베임)도 낸다
//  실행: npx vite build && npx vite preview --port 4198 --strictPort &
//        node tools/browser/parry_button_probe.mjs http://127.0.0.1:4198 <폴더> <qinggang|longsword|…> <none|button> [SIM 초 40]
//  내놓는 것: <폴더>/pbtn_<무기>_<대본>_<n>.png (막기 자세 · 창 · 둘째 수) · 콘솔 SUMMARY · ERRORS. 끝 코드 0 = 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4198';
const dir = process.argv[3] || '.';
const weapon = process.argv[4] || 'qinggang';
const mode = process.argv[5] || 'button';
const SIM = +(process.argv[6] || 40);
const REACT = +(process.env.REACT || 0.25);
const LAG = process.env.LAG != null ? +process.env.LAG : null; // 막기 버튼이 위협을 몇 초 전 모습으로 읽나 (재기 전용 — 기본 0, AI 보통 눈 = 0.26)
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
// &uniqueStage=2: 보법·막기 책 — 10/16 08:1x 인장 없앰부터 주소 판도 산 책을 읽어(새 브라우저 = 책 없음), 그 전 주소 판처럼 플레이어 유파 걸음·막기를 켠다
await page.goto(`${base}/?weapon=${weapon}&foeWeapon=longsword&slowMo=0&uniqueStage=2${process.env.QS ?? ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerGuard, null, { timeout: 60000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 120000 });
const S = await page.evaluate(
  ([mode, LAG]) => {
    const g = window.game;
    const p = g.player;
    const ai = g.ai;
    const pg = g.playerGuard;
    const ps = g.playerSecret;
    if (LAG != null) pg.lag = LAG;
    const R = (window.__pb = { strikes: [], w0: p.wounds?.length ?? 0, blood0: p.blood, opened: [], combo: [], pause: null, shots: 0, defendSeen: false, openAt: null });
    const as0 = ai.afterStrike.bind(ai);
    ai.afterStrike = (d) => {
      const wl = p.wounds?.length ?? 0;
      const cut = (p.wounds ?? []).slice(R.wLast ?? R.w0).some((w) => w.type !== 'blunt');
      R.wLast = wl;
      if (!ai.strikeTallied) R.strikes.push({ cut, t: +g.stats.simTime.toFixed(2), r: ai.hitLanded ? 'landed' : ai.bound ? 'parried' : 'missed', guard: pg.active ? pg.line : null, gmode: pg.active ? pg.mode : null, dOff: pg.active ? +Math.hypot(p.handOffset.x - pg.padOf(pg.line)[0], p.handOffset.y - pg.padOf(pg.line)[1]).toFixed(2) : null, dAim: pg.active ? +Math.hypot(p.skill.aim.x - p.handOffset.x, p.skill.aim.y - p.handOffset.y).toFixed(2) : null, why: pg.active ? null : `${p.state}${p.armed ? '' : ' 칼없음'}${p.skill.sec ? ' 비기' : ''}${p.skill.tap ? ' 찌름' : ''}${pg.broken ? ' 풀림' : ''}${pg.held ? '' : ' 안누름'}` });
      return as0(d);
    };
    let wasOpen = false;
    let fireAt = null;
    const step0 = p.step.bind(p);
    p.step = (dt) => {
      step0(dt);
      const t = g.stats.simTime;
      if (mode === 'button' && pg.mode === 'defend' && !R.defendSeen && pg.timer < 0.45) {
        R.defendSeen = true;
        R.pause = 'defend';
      }
      const open = ps?.open?.ctx?.ev === 'parry';
      if (open && !wasOpen) {
        R.openAt = t;
        R.opened.push({ t: +t.toFixed(3), slot: ps.open.ctx.slot, guard: pg.line, cue: document.getElementById('techCue')?.textContent?.slice(0, 40) ?? '' });
        if (R.shots < 2) R.pause = 'open';
      }
      if (!open) R.openAt = null;
      wasOpen = open;
      const sec = p.skill.sec;
      if (sec && fireAt == null) {
        fireAt = t;
        R.combo.push({ t: +t.toFixed(3), name: sec.S?.name, slot: sec.ctx?.slot ?? null, moves: {} });
      }
      if (sec && fireAt != null) {
        const c = R.combo[R.combo.length - 1];
        const n = sec.cur?.name ?? sec.stage;
        c.moves[n] = Math.max(c.moves[n] ?? 0, +p.tipVel.length().toFixed(2));
        if (R.shots < 3 && R.shots >= 1 && t - fireAt > 0.2 && !c.shot) (c.shot = 1), (R.pause = 'combo');
      }
      if (!sec) fireAt = null;
    };
    return { S: ps?.S?.name ?? null, contact: p.swordArt.measure.contact, tr: p.swordArt.tradition };
  },
  [mode, LAG],
);
console.log(`무기 ${weapon} (${S.tr}) 비기 ${S.S} 대본 ${mode} REACT ${REACT} LAG ${LAG ?? 0}`);
const sim = () => page.evaluate(() => window.game.stats.simTime);
if (mode === 'button') {
  await page.evaluate(() => {
    const b = document.getElementById('btnParry');
    const r = b.getBoundingClientRect();
    b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'touch', clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, isPrimary: false, button: 0 }));
  });
}
const swipe = (dx, dy, id = 81) =>
  page.evaluate(
    async ([dx, dy, id]) => {
      const cv = document.getElementById('game');
      let x = 560,
        y = 160;
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
let k = 0;
const shotIf = async () => {
  const want = await page.evaluate(() => window.__pb.pause);
  if (!want) return;
  await page.evaluate(() => {
    window.__pb.pause = null;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    document.getElementById('menu').style.visibility = 'hidden';
  });
  await page.waitForTimeout(200);
  const f = `${dir}/pbtn_${weapon}_${mode}_${++k}.png`;
  await page.screenshot({ path: f });
  const info = await page.evaluate(() => ({ t: window.game.stats.simTime.toFixed(2), guardName: document.getElementById('guardName')?.textContent, cue: document.getElementById('techCue')?.textContent?.slice(0, 50), sec: window.game.player.skill.sec?.cur?.name ?? null, line: window.game.playerGuard.line, mode: window.game.playerGuard.mode }));
  await page.evaluate(() => {
    window.__pb.shots++;
    document.getElementById('menu').style.visibility = '';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  });
  console.log(`SHOT ${k} ${want} ${JSON.stringify(info)} → ${f}`);
};
const t0 = await sim();
let swipes = 0;
while ((await sim()) - t0 < SIM) {
  const st = await page.evaluate(() => ({ t: window.game.stats.simTime, d: window.game.player.foeDistance(), alive: window.game.player.alive && window.game.enemy.alive, fight: window.game.state === 'fight' || window.game.state === 'paused', openAt: window.__pb.openAt, open: !!window.game.playerSecret?.open }));
  if (!st.alive || !st.fight) break;
  if (st.d > S.contact + 0.2) await page.keyboard.down('KeyW');
  else await page.keyboard.up('KeyW');
  if (mode === 'button' && st.open && st.openAt != null && st.t - st.openAt >= REACT) {
    await swipe(swipes % 2 ? 22 : -22, 4); // 누른 채 휘두르기 → 창이 열려 있으면 비기
    swipes++;
  }
  await page.waitForTimeout(40);
  await shotIf();
}
await page.keyboard.up('KeyW');
const t1 = await sim();
const r = await page.evaluate(() => {
  const g = window.game;
  const R = window.__pb;
  const pg = g.playerGuard;
  const st = Object.values(g.player.skill.secretStats ?? {});
  const P = g.playerSecret?.pc ?? {};
  return { R, wounds: (g.player.wounds?.length ?? 0) - R.w0, blood: +(R.blood0 - g.player.blood).toFixed(3), alive: [g.player.alive, g.enemy.alive], guard: pg.stats, windows: g.playerSecret?.opened ?? 0, fired: st.reduce((a, b) => a + (b.fired ?? 0), 0), landed: st.reduce((a, b) => a + (b.landed ?? 0), 0), pc: { ok: P.ok ?? 0, slot: P.slot ?? 0, edges: P.edges ?? 0, rejAtk: P.rejAtk ?? 0 } };
});
const c = { landed: 0, parried: 0, missed: 0 };
for (const s of r.R.strikes) c[s.r]++;
const n = r.R.strikes.length;
const held = r.R.strikes.filter((s) => s.guard);
const pa = { ok: held.filter((s) => !s.cut && s.r === 'parried').length, cut: held.filter((s) => s.cut).length };
const byGuard = {};
for (const s of r.R.strikes) {
  const key = s.guard ? `${s.gmode}:${s.guard}` : `-${s.why ?? ''}`;
  byGuard[key] ??= { landed: 0, parried: 0, missed: 0 };
  byGuard[key][s.r]++;
}
console.log(`STRIKES ${JSON.stringify(r.R.strikes)}`);
console.log(`BYGUARD ${JSON.stringify(byGuard)}`);
console.log(`GUARD ${JSON.stringify(r.guard)}`);
console.log(`OPENED ${JSON.stringify(r.R.opened)}`);
console.log(`COMBO ${JSON.stringify(r.R.combo)}`);
console.log(`PC ${JSON.stringify(r.pc)}`);
console.log(
  `SUMMARY ${weapon} ${mode}: ${(t1 - t0).toFixed(1)} s · 상대 수 ${n} · 맞음 ${c.landed} · 막음 ${c.parried} · 헛침 ${c.missed} · 막아 낸 비율 ${n ? ((100 * c.parried) / n).toFixed(0) : '-'} % (막음/(맞음+막음) ${c.landed + c.parried ? ((100 * c.parried) / (c.landed + c.parried)).toFixed(0) : '-'} %) · 내 상처 ${r.wounds} · 피 ${r.blood} · 살아 있음 ${r.alive} · 창 ${r.windows} · 낸 ${r.fired} · 맞힘 ${r.landed} · 휘두르기 ${swipes} · 버튼이 쥔 수 ${held.length} 중 받아냄 ${pa.ok} · 베임 ${pa.cut} → ${pa.ok + pa.cut ? ((100 * pa.ok) / (pa.ok + pa.cut)).toFixed(0) : '-'} %`,
);
console.log(`ERRORS ${errors.length}${errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
