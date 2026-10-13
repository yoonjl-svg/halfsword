// 플랑베르주 브라우저 확인 + 그림 (10/14, docs/import/flamberge_port_2026-10-14.md)
//  ① 카드 앞면: ?cards=flamberge,zweihander 로 첫 카드에 플랑베르주 → 고르고 뒤집힌 순간 멈춤(game.draw.hold) → 글 넘침·등급 글자 확인 · 화면 크기 셋(가로만)
//  ② 경기 화면: 테스트 경로(?test=1&weapon=flamberge&hero=player&foe=…&stage=…) → 싸움 시작 → 처음 자세(간 보기) → CDP 터치로 실제 휘두르기 셋
//     (내려 긋기 · 가로 긋기 · 올려 긋기) → 휘두르는 중간 · 맞붙은 순간 캡처. 유파·틀·쥠(빈손이 칼자루를 쥔 몫, 손~쥘 자리 거리)·자세 이름·콘솔 오류를 센다.
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/flamberge_shots.mjs http://127.0.0.1:5173 [출력 폴더(기본 docs/import/flamberge)]
//   PNG 로 찍는다(webp 로 바꾸기는 따로). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). SwiftShader 라 게임 시간이 실제보다 느리게 흐른다(실기기 성능 아님)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'docs/import/flamberge';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console: ${m.text()}`));
  page.on('requestfailed', (r) => errors.push(`${tag} requestfailed: ${r.url()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${tag} http ${r.status()}: ${r.url()}`));
};

// ── ① 카드 앞면 ──
for (const [w, h] of [[844, 390], [568, 320], [1280, 800]]) { // 폰 가로 · 작은 폰 가로(낮은 카드 배치) · PC — 세로 화면은 '돌려 주세요'라 뺀다
  const touch = w < 1000;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch }); // PC 는 1배 (SwiftShader 가 2560×1600 을 그리면 게임 시간이 너무 느리다)
  watch(page, `card ${w}x${h}`);
  await page.goto(`${base}/?stage=castle&foe=isolde&cards=flamberge,zweihander`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  if (touch) await page.tap('#btnStart');
  else await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 90000 });
  await page.evaluate(() => document.querySelector('#draw .wcard').click());
  await page.waitForFunction(() => window.game.draw.t > 1.35 || window.game.state === 'fight', null, { timeout: 180000, polling: 50 });
  await page.evaluate(() => { window.game.draw.hold = true; });
  const cards = await page.evaluate(() => [...document.querySelectorAll('#draw .wcard')].map((card) => {
    const f = card.querySelector('.wface').getBoundingClientRect();
    const d = card.querySelector('.wdesc').getBoundingClientRect();
    const a = card.querySelector('.wabil').getBoundingClientRect();
    const desc = card.querySelector('.wdesc');
    const lh = parseFloat(getComputedStyle(desc).lineHeight) || parseFloat(getComputedStyle(desc).fontSize) * 1.4;
    return {
      name: card.querySelector('.wname').textContent, sub: card.querySelector('.wsub').textContent, tier: card.querySelector('.wtier').textContent, data: card.dataset.tier,
      descLines: Math.round(desc.offsetHeight / lh), descPx: getComputedStyle(desc).fontSize,
      overflow: Math.max(d.bottom, a.bottom) > f.bottom + 0.5 || Math.max(d.right, a.right) > f.right + 0.5,
      tierColor: getComputedStyle(card.querySelector('.wtier')).color,
    };
  }));
  console.log(`card ${w}x${h}`, JSON.stringify(cards));
  if (!cards[0].name.includes('플랑베르주')) errors.push(`card ${w}x${h}: 첫 카드가 플랑베르주가 아님 (${cards[0].name})`);
  if (cards.some((c) => c.overflow)) errors.push(`card ${w}x${h}: 글 넘침`);
  await page.screenshot({ path: `${out}/card_${w}x${h}.png` });
  await page.close();
}

// ── ② 경기 화면: 테스트 경로로 플랑베르주를 들고 실제로 휘두른다 ──
const W = 844, H = 390;
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
watch(page, 'fight');
const foe = process.env.FOE || 'isolde';
const stage = process.env.STAGE || 'castle';
await page.goto(`${base}/?test=1&weapon=flamberge&hero=player&foe=${foe}&stage=${stage}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
await page.tap('#btnStart');
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
await page.addStyleTag({ content: '#toast { opacity: 0 !important; }' }); // 판 알림은 게임 시간으로 걷혀 SwiftShader 에선 오래 남는다 — 사진에서만 감춤
// 쥠·자세 표본: 매 화면 빈손이 쥐었나 · 손~쥘 자리 거리 · 자세 이름
await page.evaluate(() => {
  const g = window.game;
  const T = g.THREE;
  window.__fl = { n: 0, held: 0, dist: [], guards: {}, tipMax: 0 };
  const tick = () => {
    const p = g.player;
    if (g.state === 'fight' && p?.alive) {
      const s = p.sword.translation(), r = p.sword.rotation();
      const q = new T.Quaternion(r.x, r.y, r.z, r.w);
      const want = new T.Vector3(0, p.weaponCfg.gripAlong, 0).applyQuaternion(q).add(new T.Vector3(s.x, s.y, s.z));
      const fo = p.bodies.farmO, fr = fo.rotation(), ft = fo.translation();
      const hand = new T.Vector3(0, -0.135, 0).applyQuaternion(new T.Quaternion(fr.x, fr.y, fr.z, fr.w)).add(new T.Vector3(ft.x, ft.y, ft.z));
      window.__fl.n++;
      if (p.gripping) window.__fl.held++;
      window.__fl.dist.push(hand.distanceTo(want));
      const gname = document.querySelector('#guardName b')?.textContent;
      if (gname) window.__fl.guards[gname] = (window.__fl.guards[gname] ?? 0) + 1;
      window.__fl.tipMax = Math.max(window.__fl.tipMax, p.tipVel?.length?.() ?? 0);
    }
    requestAnimationFrame(tick);
  };
  tick();
});
const simAt = () => page.evaluate(() => window.game.stats.simTime);
const waitSim = async (dt) => {
  const t0 = await simAt();
  await page.waitForFunction((t) => window.game.stats.simTime >= t, t0 + dt, { timeout: 300000, polling: 50 }); // 컨테이너가 바쁘면 SwiftShader 게임 시간이 아주 느리다
};
// 판 시작 정지(2 s) 동안 상대도 가만히 — 처음 자세
await waitSim(1.6);
await page.screenshot({ path: `${out}/fight_guard.png` });
const art = await page.evaluate(() => {
  const p = window.game.player;
  const a = p.swordArt;
  return { weapon: p.weapon.id, tier: p.weapon.tier, frame: a.frame, style: a.style, tradition: a.tradition, restGuard: a.restGuard, gripAlong: p.weaponCfg.gripAlong, hilt: p.weaponCfg.hiltLength, blade: p.weaponCfg.bladeLength, mass: +p.swordMass.toFixed(3), Ihand: +p.swordIhand.toFixed(3), com: +p.swordCom.toFixed(3), twistScale: +p.twistScale.toFixed(2), guard: document.querySelector('#guardName b')?.textContent ?? null, foe: window.game.enemy.weapon.id, aiTradition: window.game.ai?.art?.tradition ?? null };
});
console.log('fight art', JSON.stringify(art));
if (art.weapon !== 'flamberge') errors.push(`내 무기 ${art.weapon}`);
if (art.tradition !== 'iberian' || art.frame !== 'heavy' || art.style !== 'cut') errors.push(`유파·틀 ${art.tradition}/${art.frame}/${art.style}`);
// CDP 터치 긋기: 칼 쪽(오른쪽) 화면에서 [시작 x, y] → [끝 x, y], ms 동안
const cdp = await ctx.newCDPSession(page);
const swipe = async (x0, y0, x1, y1, ms, steps = 10) => {
  const T0 = Date.now() / 1000;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }], timestamp: T0 });
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * u, y: y0 + (y1 - y0) * u, id: 1 }], timestamp: T0 + (ms * u) / 1000 });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: T0 + (ms + 20) / 1000 });
};
await waitSim(0.6); // 시작 정지 끝
const shots = [
  ['fight_cut_down', [W * 0.78, H * 0.18, W * 0.52, H * 0.78, 160]], // 내려 긋기 (오른 위 → 왼 아래)
  ['fight_cut_across', [W * 0.85, H * 0.45, W * 0.5, H * 0.45, 160]], // 가로 긋기
  ['fight_cut_up', [W * 0.55, H * 0.8, W * 0.82, H * 0.22, 160]], // 올려 긋기
];
for (const [tag, [x0, y0, x1, y1, ms]] of shots) {
  // 감기: 반대쪽으로 천천히 끌어 칼을 들고
  await swipe(x1, y1, x0, y0, 420, 8);
  await waitSim(0.35);
  await swipe(x0, y0, x1, y1, ms, 10);
  await waitSim(0.12);
  await page.screenshot({ path: `${out}/${tag}.png` });
  await waitSim(0.8);
}
await waitSim(2.5);
await page.screenshot({ path: `${out}/fight_late.png` });
const fin = await page.evaluate(() => {
  const f = window.__fl;
  const d = [...f.dist].sort((a, b) => a - b);
  const q = (p) => +(d[Math.min(d.length - 1, Math.floor(p * d.length))] ?? NaN).toFixed(3);
  const g = window.game;
  const nan = [g.player, g.enemy].some((x) => Object.values(x.bodies).some((b) => !Number.isFinite(b.translation().y)));
  return { frames: f.n, heldShare: +(f.held / Math.max(1, f.n)).toFixed(3), distP50: q(0.5), distP90: q(0.9), guards: f.guards, sim: +g.stats.simTime.toFixed(2), player: `${g.player.state}/${g.player.blood.toFixed(2)}`, enemy: `${g.enemy.state}/${g.enemy.blood.toFixed(2)}`, broken: g.player.weaponBroken, nan, render: g.renderInfo() };
});
console.log('fight end', JSON.stringify(fin));
if (fin.nan) errors.push('NaN body');
await browser.close();
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : '콘솔 오류 0');
process.exit(errors.length ? 1 : 0);
