// 뒤랑달 그림 (10/24 — docs/import/durandal_import_2026-10-24.md · docs/handoff/durandal_2026-10-24/). 게임 코드는 읽기만.
//  ① 카드 앞면: ?cards=durandal,longsword 로 카드 뽑기 화면 → 뒤랑달 카드를 골라 앞면이 펼쳐진 때 (이름 · 등급 '레전드' · 두 줄 설명 · 썸네일).
//     844 × 390 · 568 × 320 · 1280 × 800 에서 글 넘침을 보고, 폰 가로(844 × 390 · 화면 배율 2)만 찍는다.
//  ② 롤랑이 든 뒤랑달: ?foe=roland&foeWeapon=durandal(시트 무기 — ?weapon= 이 상대 무기까지 고정해서 적어 준다) · 상대 AI 를 멈춘 채 1.2 s 서 있게 한 뒤 물리를 멈추고 앞 3/4 · 칼 가까이 두 장(내 인물은 감춤).
//     이어 새 판에서 AI 를 켠 채 싸우는 장면 한 장. 화면 글은 감춤.
//  ③ 썸네일 넷 견줌: 대검 넷(뒤랑달 · 츠바이핸더 · 티소나 · 플랑베르주)의 카드 썸네일을 한 장에.
//  대기실 아이템 칸에는 나오지 않는다(시작 무기 LOBBY_ITEMS = 나뭇가지 · 드루이드의 채찍) — 그 그림은 없다.
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/durandal_shots.mjs http://127.0.0.1:5410 [출력 폴더(기본 docs/handoff/durandal_2026-10-24)] [--only=card,roland,thumbs]
//  출력(WebP · 폰 가로 844 × 390 · 화면 배율 2): card.webp · roland_threeq.webp · roland_blade.webp · roland_fight.webp · thumbs_greatswords.webp
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). 끝 코드 0 = 콘솔 오류 0 · 글 넘침 없음
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const base = (pos[0] || 'http://127.0.0.1:5410').replace(/\/$/, '');
const out = pos[1] || 'docs/handoff/durandal_2026-10-24';
const only = new Set((process.argv.find((a) => a.startsWith('--only='))?.slice(7) ?? 'card,roland,thumbs').split(','));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const report = {};
const W = 844, H = 390;
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const toWebp = (png, name) => { execFileSync('python3', ['-I', '-c', "import sys\nfrom PIL import Image\nImage.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'WEBP', quality=82, method=6)", png, `${out}/${name}.webp`]); fs.rmSync(png); };
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${tag} console ${m.text()}`));
  page.on('response', (r) => r.status() >= 400 && errors.push(`${tag} http ${r.status()} ${r.url()}`));
};

// ① 카드 앞면
for (const [w, h] of only.has('card') ? [[844, 390], [568, 320], [1280, 800]] : []) {
  const touch = w < 1000;
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w === W ? 2 : 1, hasTouch: touch, isMobile: touch });
  watch(page, `card ${w}x${h}`);
  await page.goto(`${base}/?stage=cathedral&foe=isolde&cards=durandal,longsword`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  if (touch) await page.tap('#btnStart'); else await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 600000 });
  await page.evaluate(() => document.querySelector('#draw .wcard').click());
  await page.waitForFunction(() => window.game.draw.t > 1.35 || window.game.state === 'fight', null, { timeout: 600000, polling: 50 });
  await page.evaluate(() => { window.game.draw.hold = true; });
  const c = await page.evaluate(() => {
    const card = document.querySelector('#draw .wcard'), f = card.querySelector('.wface').getBoundingClientRect(), d = card.querySelector('.wdesc').getBoundingClientRect();
    const img = card.querySelector('img');
    return { name: card.querySelector('.wname').textContent, tier: card.querySelector('.wtier').textContent, desc: card.querySelector('.wdesc').textContent, img: img ? img.getAttribute('src') : null, imgOk: img ? img.complete && img.naturalWidth > 0 : null, overflow: d.bottom > f.bottom + 0.5 || d.right > f.right + 0.5 };
  });
  report[`card_${w}x${h}`] = c;
  if (!c.name.includes('뒤랑달') || c.tier !== '레전드' || c.overflow) errors.push(`card ${w}x${h} ${JSON.stringify(c)}`);
  if (w === W) { await page.screenshot({ path: `${out}/_card.png` }); toWebp(`${out}/_card.png`, 'card'); }
  await page.close();
}

// ② 롤랑이 든 뒤랑달
async function open(fight) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  watch(page, fight ? 'roland fight' : 'roland');
  await page.goto(`${base}/?stage=cathedral&foe=roland&weapon=longsword&foeWeapon=durandal&emo=0`, { waitUntil: 'networkidle' }); // ?weapon= 은 상대 무기도 고정하므로(main.js FIXED_WEAPON) 롤랑 무기는 시트 값(뒤랑달)을 주소에 적는다
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  if (!fight) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, fight ? 4.5 : 1.2, { timeout: 900000 });
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  return page;
}
if (only.has('roland')) {
  const page = await open(false);
  report.roland = await page.evaluate(() => {
    const g = window.game, E = g.enemy;
    g.world.step = () => {};
    g.freeCam = true;
    for (const m of g.player.meshes) m.group.visible = false;
    if (g.player.swordGroup) g.player.swordGroup.visible = false;
    const aura = E.meshes.find((m) => m.kind === 'weapon')?.group.getObjectByName('legendaryAura');
    return { weapon: E.weapon.id, mass: +E.sword.mass().toFixed(3), school: E.swordArt.tradition, gripping: E.gripping, aura: !!aura, name: g.currentFoe?.name ?? null };
  });
  if (report.roland.weapon !== 'durandal' || report.roland.school !== 'iberian' || !report.roland.aura) errors.push(`roland ${JSON.stringify(report.roland)}`);
  // 카메라: 칼 축에 수직인 수평 방향(롤랑 앞쪽)에서 — 칼 전체가 화면을 가로지르게 · 가까이 한 장은 코등이 ~ 폼멜(칼 위 t −0.08)
  for (const [name, t, dist, up] of [['roland_threeq', 0.3, 2.9, 0.2], ['roland_blade', -0.06, 0.85, 0.12]]) {
    await page.evaluate(({ t, dist, up }) => {
      const g = window.game, T = g.THREE, E = g.enemy;
      const a = E.bladePoint(1), b = E.bladePoint(-0.3), axis = new T.Vector3(a.x - b.x, 0, a.z - b.z).normalize();
      const c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
      const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
      const side = new T.Vector3(-axis.z, 0, axis.x);
      if (side.dot(fw) < 0) side.negate(); // 롤랑 앞쪽에서
      side.lerp(fw, 0.35).normalize(); // 조금 앞으로 돌려 몸도 보이게
      const p = E.bladePoint(t);
      const at = t > 0 ? new T.Vector3((p.x + c.x) / 2, (p.y + c.y + 0.25) / 2, (p.z + c.z) / 2) : new T.Vector3(p.x, p.y, p.z);
      g.camera.position.copy(at).addScaledVector(side, dist).setY(at.y + up);
      g.camera.lookAt(at);
    }, { t, dist, up });
    await nextFrames(page, 4);
    await page.screenshot({ path: `${out}/_${name}.png` });
    toWebp(`${out}/_${name}.png`, name);
  }
  await page.close();
}
if (only.has('roland')) {
  const page = await open(true);
  report.rolandFight = await page.evaluate(() => {
    const g = window.game, T = g.THREE;
    g.world.step = () => {};
    g.freeCam = true;
    const e = g.enemy.bodies.pelvis.translation(), p = g.player.bodies.pelvis.translation();
    const toP = new T.Vector3(p.x - e.x, 0, p.z - e.z).normalize();
    const at = new T.Vector3(e.x, e.y + 0.05, e.z).addScaledVector(toP, 0.45);
    const view = toP.clone().applyAxisAngle(new T.Vector3(0, 1, 0), 1.1);
    g.camera.position.copy(at).addScaledVector(view, 3.0).setY(e.y + 0.45);
    g.camera.lookAt(at);
    return { t: +g.stats.simTime.toFixed(2), weapon: g.enemy.weapon.id, gripping: g.enemy.gripping, broken: g.enemy.weaponBroken };
  });
  if (report.rolandFight.weapon !== 'durandal') errors.push(`roland fight ${JSON.stringify(report.rolandFight)}`);
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/_roland_fight.png` });
  toWebp(`${out}/_roland_fight.png`, 'roland_fight');
  await page.close();
}

// ③ 썸네일 넷 (카드에 쓰는 public/ui/weapons/<id>.webp 그대로 · 이름 아래 — 파일을 data URL 로 넣어 서버 요청 없이)
if (only.has('thumbs')) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  watch(page, 'thumbs');
  const ids = [['durandal', '뒤랑달'], ['zweihander', '츠바이핸더'], ['tizona', '티소나'], ['flamberge', '플랑베르주']];
  await page.setContent(`<html><body style="margin:0;background:#2a2a33;display:flex;gap:6px;justify-content:center;align-items:center;height:${H}px;font-family:sans-serif;color:#e8e2d0">${ids.map(([id, ko]) => `<figure style="margin:0;text-align:center"><img src="data:image/webp;base64,${fs.readFileSync(`public/ui/weapons/${id}.webp`).toString('base64')}" style="width:200px;height:200px"><figcaption style="font-size:18px">${ko}</figcaption></figure>`).join('')}</body></html>`);
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 60000 });
  await page.screenshot({ path: `${out}/_thumbs.png` });
  toWebp(`${out}/_thumbs.png`, 'thumbs_greatswords');
  await page.close();
}
await browser.close();
fs.writeFileSync(`${out}/shots.json`, JSON.stringify({ report, errors }, null, 1) + '\n');
console.log(JSON.stringify(report));
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
