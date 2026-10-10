// 샛별 저장소에서 가져온 두 무대(얼어붙은 만 frozen_bay · 청람잔도 qinglan) 스모크 + 캡처 + 여정 한 바퀴 (10/10, docs/stages.md).
//  ① 무대마다 주소로 무대만 고정(?weapon=longsword&stage=<id>, foe 인자 없음 = 여정과 같은 짝짓기 STAGE_FOE) → 싸움 → 상대가 전용 짝인지,
//     콘솔 에러 0 → 캡처 두 장(전체 · 가운데 확대) docs/handoff/stage_sb_<tag>_{fight,close}.png
//  ② 같은 페이지에서 무대 소리 세부음(stageDetail) 알림 수를 적는다(검사 아님 — SwiftShader 는 게임 시간이 느려 첫 낙수·얼음 소리 전에 끝날 수 있다)
//  ③ 여정 한 바퀴: 주소 인자 없이(?weapon=longsword) 판을 열고 상대를 쓰러뜨려 '다음 상대' → STAGE_ORDER 열한 판 + 처음으로 돌아오기.
//     판마다 무대 id · 상대 이름, 그리고 GPU 모양·질감 수가 같은 무대에서 같은 값으로 돌아오는지
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/stages_sb_shots.mjs http://127.0.0.1:5173 [출력 폴더(기본 docs/handoff)]
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). SwiftShader 라 물리는 실제 시간보다 느리게 흐른다(실기기 성능 아님)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const out = process.argv[3] || 'docs/handoff';
const CASES = [
  { id: 'frozen_bay', tag: 'frozen_bay', foeName: '투야나 니콜라예바' },
  { id: 'qinglan', tag: 'qinglan_after', foeName: '김씨' }, // 다시 지은 꼴 (샛별 꼴 그대로였던 때의 캡처는 stage_sb_qinglan_before_*.png)
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
  const page = (await browser.newPage({ viewport: { width: 900, height: 600 }, deviceScaleFactor: 2 })); page.setDefaultTimeout(300000); // 바쁜 기계(SwiftShader)에선 누름 처리·캡처가 오래 걸린다
  const errors = [];
  watch(page, errors);
  await page.goto(`${base}/?weapon=longsword&stage=${c.id}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.evaluate(() => {
    window.__cues = [];
    const st = window.game.sound;
    const prev = st.stageEvent?.bind(st);
    st.stageEvent = (name, data) => { window.__cues.push({ name, kind: data?.kind }); return prev?.(name, data); };
  });
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 300000 });
  const sim0 = await page.evaluate(() => window.game.stats.simTime);
  await page.waitForTimeout(6000);
  await page.addStyleTag({ content: '#toast { opacity: 0 !important; }' }); // 판 알림은 게임 시간으로 걷혀 SwiftShader 에선 오래 남는다 — 사진에서만 감춤
  await page.screenshot({ path: `${out}/stage_sb_${c.tag}_close.png`, clip: { x: 225, y: 90, width: 450, height: 420 }, timeout: 180000 });
  await page.waitForTimeout(2500);
  const s = await page.evaluate(() => ({
    stage: window.game.stage.id, buildMs: Math.round(window.game.stage.buildMs), warmMs: Math.round(window.game.stage.warmMs),
    sim: +window.game.stats.simTime.toFixed(2), foeName: document.querySelector('#foeIntro b')?.textContent,
    foeWeapon: window.game.enemy.weapon.id, cues: window.__cues.length,
    nan: [window.game.player, window.game.enemy].some((f) => Object.values(f.bodies).some((b) => !Number.isFinite(b.translation().y))),
  }));
  await page.screenshot({ path: `${out}/stage_sb_${c.tag}_fight.png`, timeout: 180000 });
  if (s.stage !== c.id) errors.push(`stage ${s.stage} != ${c.id}`);
  if (s.foeName !== c.foeName) errors.push(`foe ${s.foeName} != ${c.foeName}`);
  if (!(s.sim > sim0)) errors.push(`fight did not run (${sim0} → ${s.sim})`);
  if (s.nan) errors.push('NaN body');
  console.log(c.id, JSON.stringify(s), errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}
// 여정 한 바퀴 (주소에 stage·foe 없음)
{
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  page.setDefaultTimeout(300000);
  const errors = [];
  watch(page, errors);
  await page.goto(`${base}/?weapon=longsword`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  const rows = [];
  for (let round = 0; round < 12; round++) {
    await page.locator('#btnStart').click({ timeout: 300000 }); // 판을 열 때 무대를 짓고 GPU 에 올리는 일이 누름 처리 안에서 끝난다 — 바쁜 기계에선 오래 걸린다
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 300000 });
    const r = await page.evaluate(() => {
      const i = window.game.renderInfo();
      return { stage: window.game.stage.id, foe: document.querySelector('#foeIntro b')?.textContent, geometries: i.geometries, textures: i.textures, buildMs: Math.round(window.game.stage.buildMs) };
    });
    rows.push(r);
    // 상대를 쓰러뜨린다: 원인 '내려찍기'는 부활하지 않는다(revive.js) → 이긴 판 → 결과 화면 단추 '다음 상대'
    await page.evaluate(() => window.game.enemy.die('내려찍기'));
    await page.waitForFunction(() => document.querySelector('#btnStart')?.offsetParent && /다음 상대/.test(document.querySelector('#btnStart').textContent), null, { timeout: 300000 });
  }
  console.log('\n| 판 | 무대 | 상대 | 모양 | 질감 | 짓기 ms |\n|---:|---|---|---:|---:|---:|');
  rows.forEach((r, i) => console.log(`| ${i + 1} | ${r.stage} | ${r.foe} | ${r.geometries} | ${r.textures} | ${r.buildMs} |`));
  const want = ['poseidon', 'clearing', 'temple', 'castle', 'poseidon_night', 'cathedral', 'loggia', 'corsair', 'sacred_grove', 'frozen_bay', 'qinglan', 'poseidon'];
  const got = rows.map((r) => r.stage);
  if (got.join() !== want.join()) errors.push(`order ${got.join()} != ${want.join()}`);
  if (rows[0].geometries !== rows[11].geometries) console.log(`(참고) 포세이돈 처음 ${rows[0].geometries}/${rows[0].textures} → 한 바퀴 뒤 ${rows[11].geometries}/${rows[11].textures}`);
  console.log('journey', errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
  fail += errors.length;
  await page.close();
}
await browser.close();
process.exit(fail ? 1 : 0);
