// 이베리아 옆걸음·중국 활 자세 캡처 (10/10 — docs/strike/school_gait_iberian_chinese_2026-10-10.md). 콘솔 에러 0.
//  전/후 × 플레이어·AI. '전' = 이 가지 전의 걸음 값을 그 몸의 gait.P 에 덮어(엇갈림 0.08·옆 보폭 0.5·옆 빠르기 없음·가는 쪽 발 먼저 없음·골반 0.885/0.96 /
//  중국 활 자세·간수세 낮춤 없음) 같은 빌드에서 찍는다 — gait.update 는 무기·조종이 바뀔 때만 P 를 다시 고르므로 덮은 값이 그대로 간다.
//  이베리아: 옆으로 가는 walk 걸음의 발이 떠 있는 때(40~70 %) 일시정지(P) → 뒤에서(두 발이 옆으로 벌어지는 것·엇갈림이 보이게).
//   플레이어 = W 로 다가간 뒤 D(오른쪽 옆) · AI = 츠바이핸더 AI 가 간 보기에서 옆으로 돌 때.
//  중국: 앞으로 내딛는 기술 걸음(req)을 디딘 뒤 0.08~0.2 s 일시정지 → 옆에서. 플레이어 = 다가간 뒤 베기 걸음과 같은 부탁(lunge 0.5 + 끌어붙임 — 플레이어 베기 걸음
//   'pass' 가 follow 안에서 바뀌는 꼴)을 1.5 s 마다 · AI = 청강검 AI 의 베기 걸음(cutStep).
//  표두격(chinese_bow_pyodu, AI 만): 청강검 AI 가 표두격(oberhau, 豹頭擊)을 골라 베기 걸음을 디딘 뒤 0.12~0.3 s — 활 자세 버팀이 가장 긴 기술. 시험만 AI 기술 선호를 표두격으로 몰아준다.
//  시험만: 찍는 몸이 죽지 않게 상처를 끈다(걸음·물리 그대로).
//  실행: npx vite build && npx vite preview --port 4189 --strictPort &
//        node tools/browser/iberchina_shots.mjs http://127.0.0.1:4189 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4189';
const dir = process.argv[3] || '.';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const out = {};
const BEFORE = {
  iberian: { crossSide: 0.08, crossFwd: 0.12, guardHeight: 0.885, walkHeight: 0.96, sideStride: 0.5, sideLead: false, sideMul: 0 },
  chinese: { bow: null, guardLow: null },
};
async function open(q) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  await page.evaluate(() => (document.getElementById('techCue').style.visibility = 'hidden'));
  return page;
}
async function arm(page, who, want, before) {
  await page.evaluate(([who, want, before]) => {
    const g = window.game;
    const f = g[who];
    g.player.applyWound = () => {};
    g.enemy.applyWound = () => {};
    const c = g.combat;
    const o = c.afterStep.bind(c);
    g._shot = null;
    c.afterStep = (...a) => {
      const res = o(...a);
      const G = f.gait;
      if (g._shot || !G?.active || f.state !== 'stand') return res;
      if (before && !G._before) {
        // 전 걸음 값을 덮는다 (P 가 GAIT 를 프로토타입으로 둔 객체 — 덮은 열쇠만 바뀜)
        const P = Object.create(Object.getPrototypeOf(G.P));
        Object.assign(P, G.P, before);
        G.P = P;
        G._before = true;
      }
      const sw = !G.legs.F.stance ? G.legs.F : !G.legs.B.stance ? G.legs.B : null;
      let ok = false;
      let u = null;
      if (want === 'side') {
        if (!sw || sw.kind !== 'walk') return res;
        u = sw.t / sw.T;
        ok = u > 0.4 && u < 0.7 && Math.abs(f.move.x) > 0.15 && Math.abs(f.move.x) > Math.abs(f.move.y);
      } else if (want === 'pyodu') {
        // 표두격(oberhau) 베기 걸음을 디딘 뒤 0.12~0.3 s (AI 가 고른 기술 이름으로)
        ok = g.ai?.tech?.name === 'oberhau' && G.lastTDKind === 'req' && G.sinceTD > 0.12 && G.sinceTD < 0.3;
      } else {
        ok = G.lastTDKind === 'req' && G.sinceTD > 0.08 && G.sinceTD < 0.2;
      }
      if (!ok) return res;
      const pv = f.bodies.pelvis.translation();
      const fa = G.legs.F.stance ? G.legs.F.plant : G.legs.F.ankle;
      const fb = G.legs.B.stance ? G.legs.B.plant : G.legs.B.ankle;
      g._shot = { who, want, tech: who === 'enemy' ? g.ai?.tech?.name ?? null : null, before: !!before, kind: sw?.kind ?? null, cross: !!sw?.cross, u: u == null ? null : +u.toFixed(2), pelvisY: +pv.y.toFixed(3), feet: +Math.hypot(fa.x - fb.x, fa.z - fb.z).toFixed(2), bowW: +(G.bowW || 0).toFixed(2), d: +f.foeDistance().toFixed(2), tradition: G.P?.tradition ?? null, sim: +g.stats.simTime.toFixed(2) };
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP' }));
      return res;
    };
  }, [who, want, before ?? null]);
}
async function waitShot(page, ms, onTick) {
  const t0 = Date.now();
  for (;;) {
    const s = await page.evaluate(() => ({ shot: window.game._shot, state: window.game.state, d: window.game.player.foeDistance() }));
    if (s.shot && s.state === 'paused') return s.shot;
    if (Date.now() - t0 > ms || (s.state !== 'fight' && s.state !== 'paused')) return null;
    if (onTick) await onTick(s);
    await page.waitForTimeout(80);
  }
}
// view 'side' = 두 사람 줄에 수직(옆) · 'back' = 찍는 몸 뒤에서 상대 쪽으로
async function shoot(page, who, path, view) {
  await page.evaluate(([who, view]) => {
    const g = window.game;
    const f = g[who];
    const o = who === 'enemy' ? g.player : g.enemy;
    document.getElementById('menu').style.visibility = 'hidden';
    const a = o.bodies.chest.translation();
    const b = f.bodies.pelvis.translation();
    const dx = b.x - a.x, dz = b.z - a.z;
    const L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    if (view === 'back') g.camera.position.set(b.x + (dx / L) * 2.4, 0.9, b.z + (dz / L) * 2.4);
    else g.camera.position.set(b.x - (dz / L) * 2.6, 0.75, b.z + (dx / L) * 2.6);
    g.camera.lookAt(b.x, 0.45, b.z);
  }, [who, view]);
  await page.waitForTimeout(300);
  await page.screenshot({ path });
}
const CASES = [
  { key: 'iberian_side', weapon: 'zweihander', want: 'side', view: 'back', trad: 'iberian' },
  { key: 'chinese_bow', weapon: 'qinggang', want: 'bow', view: 'side', trad: 'chinese' },
  { key: 'chinese_bow_pyodu', weapon: 'qinggang', want: 'pyodu', view: 'side', trad: 'chinese', aiOnly: true }, // 표두격 내려치기 (AI)
];
for (const C of CASES) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(C.key)) continue;
  for (const phase of ['before', 'after']) {
    const bv = phase === 'before' ? BEFORE[C.trad] : null;
    // AI
    {
      const page = await open(`?weapon=longsword&foeWeapon=${C.weapon}`);
      await arm(page, 'enemy', C.want, bv);
      // 표두격 장면: 시험만 — AI 의 표두격(oberhau) 선호를 크게 해 자주 고르게 한다(48 판에 10 번뿐이라)
      if (C.want === 'pyodu') await page.evaluate(() => { const P = window.game.ai.pers.techPref; for (const k of Object.keys(P)) P[k] = k === 'oberhau' ? 30 : 0.05; });
      const s = await waitShot(page, 300000);
      if (s) await shoot(page, 'enemy', `${dir}/${C.key}_${phase}_ai.png`, C.view);
      out[`${C.key}_${phase}_ai`] = s;
      await page.context().close();
    }
    // 플레이어
    if (!C.aiOnly) {
      const page = await open(`?weapon=${C.weapon}&foeWeapon=longsword`);
      await arm(page, 'player', C.want, bv);
      await page.keyboard.down('KeyW');
      let near = false;
      let lastAsk = 0;
      const s = await waitShot(page, 240000, async (st) => {
        if (!near && st.d < 2.8) {
          near = true;
          await page.keyboard.up('KeyW');
          if (C.want === 'side') await page.keyboard.down('KeyD');
        }
        if (near && C.want === 'bow' && Date.now() - lastAsk > 1500) {
          lastAsk = Date.now();
          await page.evaluate(() => window.game.player.gait.requestStep({ kind: 'lunge', fwd: 0.5, hold: 0.3, draw: true }));
        }
      });
      if (s) await shoot(page, 'player', `${dir}/${C.key}_${phase}_player.png`, C.view);
      out[`${C.key}_${phase}_player`] = s;
      await page.context().close();
    }
  }
}
console.log('OUT ' + JSON.stringify(out));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
