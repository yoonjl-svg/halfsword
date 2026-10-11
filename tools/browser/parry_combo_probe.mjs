// 막기 연환 플레이어 확인 (10/11 — docs/strike/parry_combo_secret_2026-10-11.md). iberian_gilmok_probe.mjs 를 고쳐 씀. 읽기만.
//  대본 (상대 AI 는 살아 있다):
//   slot  — 정한 자세로 막기: 손가락을 화면에 댄 채(쉴 자세로 돌아가지 않게) 손을 정한 자리 패드에 두고 버틴다(물리 스텝마다 손 목표를 그 패드로 — 입력 끌기 대신).
//           상대가 쳐 온 칼이 내 칼에 맞닿아 창이 열리면, 열린 때부터 REACT 초(기본 0.25 — 사람이 보고 누르기까지 [추정]) 뒤에 창이 아직 열려 있으면 낸다
//           (main.js 공격 입력과 같은 함수 — playerSecret.fire() → player.skill.secret()). 창 · 연격 두 순간을 멈춰 찍는다.
//   other — 다른 꼴로 막기: 같은 대본, 손은 정한 자리가 아닌 패드(중국 긴 자세 · 독일 쟁기)
//   press — 맞붙어 계속 휘두르기: 닿는 거리까지 걸어 든 뒤 0.35 s 마다 좌우로 끌기 (창이 자주 안 터지는지)
//   QS='&deSecret=parry&bind=1': 주소에 덧붙임 (10/11 자연 바인드 — docs/strike/natural_bind_2026-10-11.md) · 대본 kron = 롱소드 왕관 자리 [0.02, 0.4] 로 막기 · 칼 맞닿음이 0.3 s 넘으면 덩이 두 개까지 'bind' 로 멈춰 찍는다(덩이 길이는 BINDS 줄)
//   DEMO_MIN=s: 독일 deBindMin 을 그 판만 바꿔 장치(창 → 한 수 · 차오름)를 본다 — 판정 값이 아님
//  실행: npx vite build && npx vite preview --port 4197 --strictPort &
//        node tools/browser/parry_combo_probe.mjs http://127.0.0.1:4197 <폴더> <qinggang|longsword> <slot|other|press> [SIM 초 40]
//  내놓는 것: <폴더>/pcombo_<무기>_<대본>_<n>.png · 콘솔 SUMMARY(막기 성공 · 정한 자세 · 창 · 낸 · 맞힘 · 창 놓침 · 맞닿음 길이) · ERRORS. 끝 코드 0 = 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4197';
const dir = process.argv[3] || '.';
const weapon = process.argv[4] || 'qinggang';
const mode = process.argv[5] || 'slot';
const SIM = +(process.argv[6] || 40);
const REACT = +(process.env.REACT || 0.25);
const PADS = { qinggang: { slot: [0.02, 0.52], other: [0.0, 0.03] }, longsword: { slot: [0.22, 0.26], other: [0.18, -0.28], kron: [0.02, 0.4] } };
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.addInitScript(() => {
  window.__vib = 0;
  try {
    Object.defineProperty(navigator, 'vibrate', { value: () => (window.__vib++, true), configurable: true });
  } catch {
    /* 생략 */
  }
});
await page.goto(`${base}/?weapon=${weapon}&foeWeapon=longsword&slowMo=0${process.env.QS ?? ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.6, null, { timeout: 120000 });
const pad = PADS[weapon]?.[mode] ?? null;
if (process.env.DEMO_MIN != null) await page.evaluate((v) => (window.game.config.SECRET.deBindMin = v), +process.env.DEMO_MIN); // 장치 보기 전용: 독일 창 문턱을 바꿔 본다 (기본값 아님 — 기록 §플레이어)
const S = await page.evaluate(
  ([pad, REACT]) => {
    const g = window.game;
    const p = g.player;
    const ps = g.playerSecret;
    const R = (window.__pc = { opened: [], fired: 0, missed: 0, shots: [], combo: [], pause: null, binds: [], bindShots: 0 });
    let tRun = -1;
    let tGap = 0;
    let tHilt = false;
    let openAt = null;
    let fireAt = null;
    let wasOpen = false;
    const step0 = p.step.bind(p);
    p.step = (dt) => {
      if (pad && !p.skill.sec) {
        p.handOffset.x = pad[0];
        p.handOffset.y = pad[1];
        p.handHeld = true; // 손가락을 댄 채 (쉴 자세로 돌아가지 않음)
      }
      step0(dt);
      const t = g.stats.simTime;
      // 칼 맞닿음 덩이 (4 스텝 틈까지 한 덩이) — 0.3 s 를 넘는 순간 한 번 멈춰 찍는다(덩이 2 개까지)
      if (p.feel?.touching) {
        if (tRun < 0) (tRun = 0), (tHilt = false);
        tRun += dt;
        tGap = 0;
        if (p.feel.hilt || g.enemy.feel?.hilt) tHilt = true;
        if (tRun >= 0.3 && tRun - dt < 0.3 && R.bindShots < 2 && !R.pause) (R.bindShots++), (R.pause = 'bind');
      } else if (tRun >= 0 && ++tGap > 4) {
        R.binds.push({ s: +tRun.toFixed(3), hilt: tHilt });
        tRun = -1;
      }
      const open = ps.open?.ctx?.ev === 'parry';
      if (open && !wasOpen) {
        openAt = t;
        R.opened.push({ t: +t.toFixed(3), slot: ps.open.ctx.slot, cue: document.getElementById('techCue')?.textContent?.slice(0, 40) ?? '' });
        if (!R.openShot) (R.openShot = 1), (R.pause = 'open');
      }
      if (!open && wasOpen && fireAt == null && openAt != null && t - openAt < REACT) R.missed++;
      wasOpen = open;
      if (open && openAt != null && t - openAt >= REACT && !p.skill.sec) {
        const o = ps.fire();
        if (o && p.skill.secret(o)) {
          R.fired++;
          fireAt = t;
          R.combo.push({ t: +t.toFixed(3), slot: o.ctx.slot, held: +(o.ctx.held ?? 0).toFixed(3) });
        }
        openAt = null;
      }
      const sec = p.skill.sec;
      if (sec && fireAt != null) {
        const c = R.combo[R.combo.length - 1];
        c.moves ??= {};
        const n = sec.cur?.name ?? sec.stage;
        c.moves[n] = Math.max(c.moves[n] ?? 0, +p.tipVel.length().toFixed(2));
        if (R.openShot && !R.comboShot && t - fireAt > 0.12) (R.comboShot = 1), (R.pause = 'combo');
      }
      if (!sec && fireAt != null) fireAt = null;
    };
    return { S: ps.S?.name, reach: p.swordArt.measure.reach, contact: p.swordArt.measure.contact };
  },
  [mode === 'press' ? null : pad, REACT],
);
console.log(`무기 ${weapon} 비기 ${S.S} 대본 ${mode} 패드 ${JSON.stringify(pad)} REACT ${REACT}`);
const sim = () => page.evaluate(() => window.game.stats.simTime);
const pauseKey = () => page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' })));
const swipe = (dx, dy, id = 81) =>
  page.evaluate(
    async ([dx, dy, id]) => {
      const cv = document.getElementById('game');
      let x = 640,
        y = 150;
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
// 한 번 찍기: 그 스텝에 멈춰(P) 찍고 다시 감
let k = 0;
const shotIf = async () => {
  const want = await page.evaluate(() => window.__pc.pause);
  if (!want) return;
  await page.evaluate(() => {
    window.__pc.pause = null;
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
    document.getElementById('menu').style.visibility = 'hidden';
  });
  await page.waitForTimeout(200);
  const f = `${dir}/pcombo_${weapon}_${mode}_${++k}.png`;
  await page.screenshot({ path: f });
  const info = await page.evaluate(() => ({ t: window.game.stats.simTime.toFixed(2), cue: document.getElementById('techCue')?.textContent?.slice(0, 50), sec: window.game.player.skill.sec?.cur?.name ?? null }));
  await page.evaluate(() => {
    window.__pc.shots.push(1);
    document.getElementById('menu').style.visibility = '';
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
  });
  console.log(`SHOT ${k} ${want} ${JSON.stringify(info)} → ${f}`);
};
void pauseKey;
const t0 = await sim();
let n = 0;
while ((await sim()) - t0 < SIM) {
  const st = await page.evaluate(() => ({ d: window.game.player.foeDistance(), alive: window.game.player.alive && window.game.enemy.alive, fight: window.game.state === 'fight' || window.game.state === 'paused' }));
  if (!st.alive || !st.fight) break;
  if (mode === 'press') {
    if (st.d > S.contact) await page.keyboard.down('KeyW');
    else await page.keyboard.up('KeyW');
    await swipe(n % 2 ? 14 : -14, n % 3 ? 6 : -6);
    n++;
    await page.waitForTimeout(150);
  } else {
    // 상대가 쳐 오게 간격 안쪽(맞닿기 + 0.2)까지만 다가선다
    if (st.d > S.contact + 0.2) await page.keyboard.down('KeyW');
    else await page.keyboard.up('KeyW');
    await page.waitForTimeout(60);
  }
  await shotIf();
}
await page.keyboard.up('KeyW');
const t1 = await sim();
const r = await page.evaluate(() => {
  const g = window.game;
  const P = g.playerSecret.pc ?? {};
  const st = Object.values(g.player.skill.secretStats ?? {});
  return { tbinds: window.__pc.binds, R: window.__pc, rej: { edges: P.edges ?? 0, atk: P.rejAtk ?? 0, slow: P.rejSlow ?? 0, hurt: P.rejHurt ?? 0 }, ok: P.ok ?? 0, slot: P.slot ?? 0, parryBinds: P.parryBinds ?? [], binds: (P.binds ?? []).length, windows: g.playerSecret.opened, landed: st.reduce((a, b) => a + (b.landed ?? 0), 0), fired: st.reduce((a, b) => a + (b.fired ?? 0), 0), vib: window.__vib };
});
const pb = [...r.parryBinds].sort((a, b) => a - b);
const q = (f) => (pb.length ? pb[Math.min(pb.length - 1, Math.floor(f * pb.length))].toFixed(2) : '-');
console.log(`EDGES ${JSON.stringify(r.rej)}`);
{ const b = r.tbinds.map((x) => x.s).sort((a, c) => a - c); const q2 = (f) => (b.length ? (b[Math.min(b.length - 1, Math.floor(f * b.length))] * 1000).toFixed(0) : '-'); console.log(`BINDS n ${b.length} p50 ${q2(0.5)} · p75 ${q2(0.75)} · p90 ${q2(0.9)} · 최대 ${q2(1)} ms · 0.3 s 넘음 ${b.filter((x) => x >= 0.3).length} (코등이 ${r.tbinds.filter((x) => x.s >= 0.3 && x.hilt).length})`); }
console.log(`OPENED ${JSON.stringify(r.R.opened)}`);
console.log(`COMBO ${JSON.stringify(r.R.combo)}`);
console.log(
  `SUMMARY ${weapon} ${mode}: ${(t1 - t0).toFixed(1)} s · 막기 성공 ${r.ok} · 정한 자세 ${r.slot} · 창 ${r.windows} · 낸 ${r.fired} · 맞힘 ${r.landed} · 창 놓침(REACT ${REACT} s 전에 닫힘) ${r.R.missed} · 진동 ${r.vib}${mode === 'press' ? ` · 휘두르기 ${n}` : ''} · 막기 맞닿음 길이 (n ${pb.length}) p50 ${q(0.5)} · p75 ${q(0.75)} · p90 ${q(0.9)} · 최대 ${pb.length ? pb[pb.length - 1].toFixed(2) : '-'} s`,
);
console.log(`ERRORS ${errors.length}${errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
