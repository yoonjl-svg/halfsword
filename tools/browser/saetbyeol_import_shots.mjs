// 샛별 저장소에서 가져온 새 무기 넷·새 인물 넷 스모크 + 캡처 (10/10, docs/import/saetbyeol_new_2026-10-10.md).
//  판마다 주소로 고정: 플레이어 무기(weapon=, 카드 뽑기 건너뜀) · 상대(foe=) · 무대(stage=, 우리 무대 — 문서 §무대 짝 제안) → 싸움 7초 →
//  상대 이름·무기·유파·기운 확인, 콘솔 에러 0 → 캡처 두 장(전체 · 가운데 확대). 끝으로 test.html 목록에 새 무기·인물이 뜨는지.
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/saetbyeol_import_shots.mjs http://127.0.0.1:5173 [출력 폴더(기본 docs/handoff)]
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). SwiftShader 라 물리는 실제 시간보다 느리게 흐른다(실기기 성능 아님)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || 'docs/handoff';
const CASES = [
  { tag: 'artoria_ganjiang', weapon: 'ganjiang', hero: 'player', foe: 'artoria', stage: 'loggia', foeWeapon: 'excalibur', aura: ['ganjiang', 'excalibur'] },
  { tag: 'samira_moye', weapon: 'moye', hero: 'player', foe: 'samira', stage: 'cathedral', foeWeapon: 'pistol', aura: ['moye'] },
  { tag: 'renji_sain', weapon: 'sain', hero: 'player', foe: 'renji', stage: 'temple', foeWeapon: 'morgenstern', aura: [] },
  { tag: 'eira_ice', weapon: 'ice', hero: 'player', foe: 'eira', stage: 'castle', foeWeapon: 'rapier', aura: [] },
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
let fail = 0;
const watch = (page, errors) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
};
for (const c of CASES) {
  const page = await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 });
  const errors = [];
  watch(page, errors);
  await page.goto(`${base}/?test=1&weapon=${c.weapon}&hero=${c.hero}&foe=${c.foe}&stage=${c.stage}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
  const sim0 = await page.evaluate(() => window.game.stats.simTime);
  await page.waitForTimeout(5000);
  await page.addStyleTag({ content: '#toast { opacity: 0 !important; }' }); // 판 알림('Battle')은 게임 시간으로 걷혀서 SwiftShader 에선 오래 남는다 — 사진에서만 감춤
  await page.screenshot({ path: `${out}/saetbyeol_import_${c.tag}_close.png`, clip: { x: 225, y: 90, width: 450, height: 420 } });
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => {
    const auraOf = (f) => { let w = null; f.meshes.find((m) => m.kind === 'weapon')?.group.traverse((o) => { if (o.userData?.legendaryAura) w = o.userData.legendaryAura.weapon; else if (o.isPointLight && !w) w = 'light'; }); return w; };
    return {
      stage: window.game.stage.id, sim: +window.game.stats.simTime.toFixed(2),
      myWeapon: window.game.player.weapon.id, foeWeapon: window.game.enemy.weapon.id, foeName: document.querySelector('#foeIntro b')?.textContent,
      tradition: window.game.ai?.art?.tradition ?? window.game.ai?.school?.tradition,
      auras: [auraOf(window.game.player), auraOf(window.game.enemy)].filter(Boolean),
      nan: [window.game.player, window.game.enemy].some((f) => Object.values(f.bodies).some((b) => !Number.isFinite(b.translation().y))),
      foeHelmet: window.game.enemy.helmetType ?? null, foeHelmetPieces: Object.keys(window.game.enemy.helmetGroup?.userData?.pieces ?? {}).join(',') || null,
      foeGunCooldownK: window.game.enemy.gunCooldownK ?? null,
    };
  });
  await page.screenshot({ path: `${out}/saetbyeol_import_${c.tag}_fight.png` });
  if (s.stage !== c.stage) errors.push(`stage ${s.stage} != ${c.stage}`);
  if (s.myWeapon !== c.weapon) errors.push(`my weapon ${s.myWeapon} != ${c.weapon}`);
  if (s.foeWeapon !== c.foeWeapon) errors.push(`foe weapon ${s.foeWeapon} != ${c.foeWeapon}`);
  if (!(s.sim > sim0)) errors.push(`fight did not run (${sim0} → ${s.sim})`);
  if (s.nan) errors.push('NaN body');
  console.log(c.tag, JSON.stringify(s), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}
// 무대 검객 후보 (stages.js STAGE_FOE_EXTRA): 여정 길(foe 인자 없음)로 붉은 회랑을 여러 번 열어 본디 짝(토메)과 후보(아르토리아)가 둘 다 나오는지
{
  const seen = {};
  for (let i = 0; i < 6; i++) {
    const page = await browser.newPage({ viewport: { width: 480, height: 640 } });
    const errors = [];
    watch(page, errors);
    await page.goto(`${base}/?weapon=longsword&stage=loggia`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
    await page.getByText('싸움 시작').click();
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 60000 });
    const name = await page.evaluate(() => document.querySelector('#foeIntro b')?.textContent);
    seen[name] = (seen[name] ?? 0) + 1;
    fail += errors.length;
    if (errors.length) console.log('loggia', errors.join('\n  '));
    await page.close();
  }
  console.log('붉은 회랑 여섯 번 연 상대:', JSON.stringify(seen));
}
// test.html 목록
{
  const page = await browser.newPage({ viewport: { width: 480, height: 1400 } });
  const errors = [];
  watch(page, errors);
  await page.goto(`${base}/test.html`, { waitUntil: 'networkidle' });
  const txt = await page.evaluate(() => document.body.innerText);
  const want = ['간장', '막야', '사인검', '아이스', '아르토리아', '마야 라토르', '김씨', '투야나 니콜라예바'];
  const missing = want.filter((w) => !txt.includes(w));
  if (missing.length) errors.push('test.html 에 없음: ' + missing.join(', '));
  await page.screenshot({ path: `${out}/saetbyeol_import_test_list.png`, fullPage: true });
  console.log('test.html', missing.length ? '' : `8/8 보임`, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}
await browser.close();
process.exit(fail ? 1 : 0);
