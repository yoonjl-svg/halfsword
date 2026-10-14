// 월왕구천검 브라우저 확인 + 그림 (10/14, docs/import/goujian_port_2026-10-14.md)
//  ① 카드 앞면: ?cards=goujian,qinggang 로 첫 카드에 월왕구천검 → 고르고 뒤집힌 뒤 멈춤(game.draw.hold) → 이름·등급 글자·설명·능력 줄·글 넘침 · 화면 크기 셋(가로만)
//  ② 쥔 모습: ?weapon=goujian&foeWeapon=longsword (플레이어가 월왕구천검) → 싸움 시작 → 판 시작 정지 동안 앞 · 옆(칼 든 쪽) · 쥔 손 가까이 (game.freeCam)
//     유파·틀·방식·쉴 자세(swordArt)·질량·관성과 디버그 줄 game.woundRage(피를 잠깐 0.725 로 두면 d 0.5 · 배율 1.15 인지)를 적는다. 콘솔 오류를 센다.
//  실행: 개발 서버를 띄운 뒤  node tools/browser/goujian_shots.mjs http://127.0.0.1:<포트> [출력 폴더(기본 docs/import/goujian)]
//   PNG 로 찍는다(webp 로 바꾸기는 따로). 화면 배율 1 (헤드리스 SwiftShader — 게임 시간이 실제보다 느리게 흐른다). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'docs/import/goujian';
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
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  watch(page, `card ${w}x${h}`);
  await page.goto(`${base}/?stage=castle&foe=isolde&cards=goujian,qinggang`, { waitUntil: 'networkidle' });
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
    const abil = card.querySelector('.wabil');
    const lh = (el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.4;
    const thumb = getComputedStyle(card.querySelector('.wthumb')).backgroundImage;
    return {
      name: card.querySelector('.wname').textContent, sub: card.querySelector('.wsub').textContent, tier: card.querySelector('.wtier').textContent, data: card.dataset.tier,
      desc: desc.textContent, abil: abil.textContent, descLines: Math.round(desc.offsetHeight / lh(desc)), abilLines: abil.textContent ? Math.round(abil.offsetHeight / lh(abil)) : 0, descPx: getComputedStyle(desc).fontSize,
      overflow: Math.max(d.bottom, a.bottom) > f.bottom + 0.5 || Math.max(d.right, a.right) > f.right + 0.5,
      room: Math.round(f.bottom - Math.max(d.bottom, a.bottom)),
      thumb: (thumb.match(/ui\/weapons\/([a-z_]+)\.webp/) || [])[1] ?? null,
      tierColor: getComputedStyle(card.querySelector('.wtier')).color,
    };
  }));
  const size = await page.evaluate(() => { const d = getComputedStyle(document.getElementById('draw')); return `${d.getPropertyValue('--cw')}×${d.getPropertyValue('--ch')}`; });
  console.log(`card ${w}x${h} (${size})`, JSON.stringify(cards));
  if (cards[0].name !== '월왕구천검' || cards[0].thumb !== 'goujian') errors.push(`card ${w}x${h}: 첫 카드가 월왕구천검이 아님 (${cards[0].name} · ${cards[0].thumb})`);
  if (cards[0].abil !== '(와신상담: 다칠수록 공격력 증폭)') errors.push(`card ${w}x${h}: 능력 줄 '${cards[0].abil}'`);
  if (cards.some((c) => c.overflow)) errors.push(`card ${w}x${h}: 글 넘침`);
  await page.screenshot({ path: `${out}/card_${w}x${h}.png` });
  await page.close();
}

// ── ② 쥔 모습: 플레이어가 월왕구천검을 들고 판 시작 자세 ──
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
watch(page, 'hold');
await page.goto(`${base}/?stage=castle&foe=isolde&weapon=goujian&foeWeapon=longsword`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
await page.tap('#btnStart');
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
await page.addStyleTag({ content: '#toast, #techCue { opacity: 0 !important; }' }); // 판 알림은 게임 시간으로 걷혀 SwiftShader 에선 오래 남는다 — 사진에서만 감춤
await page.waitForFunction(() => window.game.stats.simTime >= 1.2, null, { timeout: 300000, polling: 50 }); // 판 시작 정지(2 s) 안 — 둘 다 처음 자세
const art = await page.evaluate(() => {
  const g = window.game;
  const p = g.player;
  const a = p.swordArt;
  const before = g.woundRage;
  const blood = p.blood;
  p.blood = 0.725; // d 0.5 — 디버그 줄이 읽는지만 본다 (바로 되돌림)
  const hurt = g.woundRage;
  p.blood = blood;
  return { weapon: p.weapon.id, tier: p.weapon.tier, school: p.weapon.school, frame: a.frame, style: a.style, tradition: a.tradition, restGuard: a.restGuard, hilt: p.weaponCfg.hiltLength, blade: p.weaponCfg.bladeLength, mass: +p.swordMass.toFixed(3), Ihand: +p.swordIhand.toFixed(3), com: +p.swordCom.toFixed(3), guard: document.querySelector('#guardName b')?.textContent ?? null, foe: g.enemy.weapon.id, woundRage: before, woundRageAtBlood0725: hurt };
});
console.log('hold art', JSON.stringify(art));
if (art.weapon !== 'goujian') errors.push(`내 무기 ${art.weapon}`);
if (art.tradition !== 'chinese') errors.push(`유파 ${art.tradition}`);
if (art.woundRage?.[0]?.mult !== 1 || art.woundRageAtBlood0725?.[0]?.mult !== 1.15 || art.woundRageAtBlood0725?.[1]?.mult !== 1) errors.push(`디버그 줄 ${JSON.stringify(art.woundRageAtBlood0725)}`);
const shot = async (view, path) => {
  await page.evaluate((view) => {
    const g = window.game;
    const f = g.player, o = g.enemy;
    const b = f.bodies.chest.translation();
    const a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const rx = -fz, rz = fx;
    const s = f.side; // 칼 든 쪽
    for (const m of o.meshes) m.group.visible = view !== 'front'; // 앞에서 볼 때만 상대를 감춘다 (사이에 서서 가린다)
    g.freeCam = true;
    if (view === 'hands') {
      const h = f.sword.translation(); // 칼 원점 = 칼 든 손
      const R = 0.75;
      g.camera.position.set(h.x + rx * s * R + fx * 0.2, h.y + 0.15, h.z + rz * s * R + fz * 0.2);
      g.camera.lookAt(h.x + fx * 0.25, h.y + 0.05, h.z + fz * 0.25);
    } else if (view === 'front') {
      const R = 2.3;
      g.camera.position.set(b.x + fx * R + rx * s * 0.35, 1.4, b.z + fz * R + rz * s * 0.35);
      g.camera.lookAt(b.x + fx * 0.3, 1.1, b.z + fz * 0.3);
    } else {
      const R = 2.5;
      g.camera.position.set(b.x + rx * s * R + fx * 0.3, 1.35, b.z + rz * s * R + fz * 0.3);
      g.camera.lookAt(b.x + fx * 0.3, 1.12, b.z + fz * 0.3);
    }
  }, view);
  await page.waitForTimeout(400);
  await page.screenshot({ path });
};
await shot('front', `${out}/hold_front.png`);
await shot('side', `${out}/hold_side.png`);
await shot('hands', `${out}/hold_hands.png`);
await page.evaluate(() => { const g = window.game; for (const m of g.enemy.meshes) m.group.visible = true; g.freeCam = false; });
const fin = await page.evaluate(() => {
  const g = window.game;
  const nan = [g.player, g.enemy].some((x) => Object.values(x.bodies).some((b) => !Number.isFinite(b.translation().y)));
  return { sim: +g.stats.simTime.toFixed(2), player: `${g.player.state}/${g.player.blood.toFixed(2)}`, enemy: `${g.enemy.state}/${g.enemy.blood.toFixed(2)}`, nan, render: g.renderInfo() };
});
console.log('hold end', JSON.stringify(fin));
if (fin.nan) errors.push('NaN body');
await browser.close();
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : '콘솔 오류 0');
process.exit(errors.length ? 1 : 0);
