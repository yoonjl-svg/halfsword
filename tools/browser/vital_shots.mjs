// 약한 자세 겨눔 확인 그림 (10/12, docs/import/saetbyeol_vital_2026-10-12.md) — 작게 몇 장만
//  ① 목 가로 베기: 나를 무릎 꿇린 채(다리 힘 0.2 + 가벼운 넘어짐) 상대 AI 가 치는 순간 (AI 급소 공격 — vitalStrike, 갈래 ?vitalAi=1)
//  ② 급소 찌르기: 무릎 꿇은 상대(AI 멈춤)에게 탭 한 번 — 간격 맞추기 뒤 목·얼굴·머리 점으로 뻗는 순간
//  주소 스위치를 그대로 붙여 같은 장면을 견준다 (켬 · `&vital=0` = 끔)
//  실행: vite 개발 서버(디렉터 5173·5174 말고 내 포트)를 띄운 뒤
//    node tools/browser/vital_shots.mjs http://127.0.0.1:5291 docs/handoff/vital_target
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). SwiftShader 라 물리는 실제 시간보다 느리다(실기기 성능 아님)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5291').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/vital_target';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.evaluate(() => document.getElementById('btnStart')?.click());
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.addStyleTag({ content: '#toast { opacity: 0 !important; }' });
  return { page, errors };
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 70 });
const simT = (page) => page.evaluate(() => window.game.stats.simTime);
async function waitFor(page, fn, secs) {
  const t0 = await simT(page);
  const w0 = Date.now();
  while (!(await page.evaluate(fn)) && (await simT(page)) < t0 + secs && Date.now() - w0 < 90000) await page.waitForTimeout(80);
  return page.evaluate(fn);
}
const Q = '/?test=1&weapon=longsword&hero=player&foe=isolde&stage=cathedral';

// ① AI 목 가로 베기 (나를 무릎 꿇린다) — 이 갈래는 추천 기본 끔이라 켬 그림은 &vitalAi=1
for (const [tag, q] of [['on', '&vitalAi=1'], ['off', '&vital=0']]) {
  const { page, errors } = await open(Q + q);
  await waitFor(page, () => false, 2.5);
  await page.evaluate(() => {
    const p = window.game.player;
    p.limbs.legF = p.limbs.legB = 0.2;
    p.knockDown(false);
    window.__hits = [];
    const g = window.game;
    const C = g.combat;
    const orig = C.strike.bind(C);
    C.strike = (pr, point, passing) => {
      const r = orig(pr, point, passing);
      if (r && pr.w.fighter === g.enemy && pr.v?.fighter === g.player) window.__hits.push({ zone: r.zone, type: r.type, sev: +r.severity.toFixed(2) });
      return r;
    };
  });
  // 첫 공격이 나가는 순간 (켬: 급소 공격 vitalStrike · 끔: 아무 공격 strike)
  const ok = tag === 'on' ? await waitFor(page, () => !!window.game.ai.vitalStrike, 20) : await waitFor(page, () => window.game.ai.phase === 'strike' && window.game.ai.mode === 'attack' && window.game.player.state !== 'stand', 14);
  await waitFor(page, () => false, 0.12);
  await shot(page, `ai_neckcut_${tag}`);
  await waitFor(page, () => false, 1.0);
  const s = await page.evaluate(() => ({ vital: window.game.ai.vitalStrike ?? null, tech: window.game.ai.tech?.name, me: window.game.player.state, hits: window.__hits.slice(0, 3), decap: window.game.player.decapitated }));
  console.log('ai_neckcut', tag, ok, JSON.stringify(s), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}

// ② 급소 찌르기 (상대를 무릎 꿇린다, AI 멈춤)
for (const [tag, q] of [['on', ''], ['off', '&vital=0']]) {
  const { page, errors } = await open(Q + q);
  await waitFor(page, () => false, 2.4);
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => {};
    g.enemy.move.set(0, 0);
    const mv = g.player.move;
    const set = mv.set.bind(mv);
    mv.set = (x, y) => set(x * 0.3, y * 0.3);
  });
  const gap = () => page.evaluate(() => { const a = window.game.player.bodies.chest.translation(); const b = window.game.enemy.bodies.chest.translation(); return Math.hypot(a.x - b.x, a.z - b.z); });
  {
    const t0 = await simT(page);
    await page.keyboard.down('KeyW');
    while ((await gap()) > 1.6 && (await simT(page)) < t0 + 8) await page.waitForTimeout(100);
    await page.keyboard.up('KeyW');
  }
  await page.evaluate(() => {
    const g = window.game;
    g.enemy.limbs.legF = g.enemy.limbs.legB = 0.2;
    g.enemy.knockDown(false);
    window.__hits = [];
    const C = g.combat;
    const orig = C.strike.bind(C);
    C.strike = (pr, point, passing) => {
      const r = orig(pr, point, passing);
      if (r && pr.w.fighter === g.player && pr.v?.fighter === g.enemy) window.__hits.push({ zone: r.zone, type: r.type, sev: +r.severity.toFixed(2) });
      return r;
    };
  });
  await waitFor(page, () => window.game.enemy.state === 'kneel', 4);
  await waitFor(page, () => false, 0.4);
  await page.evaluate(() => window.game.player.skill.thrust());
  await waitFor(page, () => window.game.player.skill.thrustPush, 3);
  await waitFor(page, () => false, 0.1);
  await shot(page, `tap_vital_${tag}`);
  await waitFor(page, () => false, 1.2);
  const s = await page.evaluate(() => ({ foe: window.game.enemy.state, vitalThrusts: window.game.player.skill.vitalThrusts ?? 0, range: window.game.player.skill.lastVitalRange ?? null, hits: window.__hits.slice(0, 3) }));
  console.log('tap_vital', tag, JSON.stringify(s), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}
await browser.close();
process.exit(fail ? 1 : 0);
