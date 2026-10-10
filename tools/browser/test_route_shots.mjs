// 테스트 전용 경로 확인 (10/10, docs/test_route_2026-10-10.md): test.html 세로·가로 캡처 → 츠바이핸더 + 토메로 세 판(이김·짐·이김, 판 넘기기) →
//  다시 test.html(기억한 고름 확인) → 우치가타나 + 마르그레테로 한 판 → '테스트 고르기로' 단추 → 인자 없는 본판이 그대로인지. 콘솔 에러 0.
//  실행: npx vite build && npx vite preview --port 4297 --strictPort &
//        node tools/browser/test_route_shots.mjs http://127.0.0.1:4297 docs/handoff
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4297';
const dir = process.argv[3] || '.';
const WAIT = +(process.env.WAIT_MS || 180000);
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const fails = [];
const log = (...a) => console.log(...a);
const check = (ok, msg) => {
  if (!ok) fails.push(msg);
  log(ok ? '  ok ' : '  FAIL ', msg);
};
function watch(page) {
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console ' + m.text());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`);
  });
}
// 인물마다 드는 무기 (characters.js weapon — 브란은 10% 확률로 주운 커먼 칼)
const OWN = { '오소리 브란': 'tree_branch', '이졸데 반 아커러': 'longsword', '랴오 쓰위엔': 'qinggang', '하인리히 도른': 'excalibur_replica', '마르그레테 슈바르츠': 'longsword', '토메 비달': 'rapier', 오마리: 'zweihander', 미나미: 'monohoshizao' };
const shot = (page, name, full = false) => page.screenshot({ path: `${dir}/test_route_${name}.png`, fullPage: full });

// ── 1. test.html: 세로 390×844 · 가로 844×390 ──
async function pickerLayout(w, h, name) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  watch(page);
  await page.goto(`${base}/test.html`, { waitUntil: 'networkidle' });
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    weapons: document.querySelectorAll('#weaponsNew .pick, #weaponsRest .pick').length,
    newOnes: [...document.querySelectorAll('#weaponsNew .pick')].map((b) => b.dataset.id),
    heroes: [...document.querySelectorAll('#heroes .pick')].map((b) => b.dataset.id),
    minH: Math.min(...[...document.querySelectorAll('.pick, #btnGo')].map((b) => b.getBoundingClientRect().height)),
  }));
  log(name, JSON.stringify(m));
  check(m.sw <= m.iw, `${name}: 가로 스크롤 없음 (${m.sw} <= ${m.iw})`);
  check(m.minH >= 44, `${name}: 누르는 칸 44 px 이상 (최소 ${m.minH.toFixed(0)})`);
  await shot(page, name);
  await shot(page, `${name}_full`, true);
  await ctx.close();
  return m;
}
const lay = await pickerLayout(390, 844, 'picker_portrait');
check(lay.weapons === 17 && lay.newOnes.join() === 'zweihander,uchigatana', '무기 17종 · 오늘 바뀐 무기 묶음 = 츠바이핸더·우치가타나');
check(lay.heroes[0] === 'player' && lay.heroes.includes('tome'), `캐릭터 = 기본 주인공 + 인물 (${lay.heroes.join(',')})`);
await pickerLayout(844, 390, 'picker_landscape');

// ── 2. 게임 쪽: 한 판 시작 → 상태 읽기 ──
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
const page = await ctx.newPage();
watch(page);
const state = () =>
  page.evaluate(() => {
    const g = window.game;
    return { stage: g.stage.id, pinned: g.stage.pinned, pw: g.player.weapon.id, pname: g.player.name, helm: g.player.helmetType, plate: Object.keys(g.player.plate).length, foe: g.enemy.name, fw: g.enemy.weapon.id, state: g.state, url: location.search };
  });
async function fightOnce(label) {
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('menu').classList.contains('show'), null, { timeout: WAIT });
  await page.click('#btnStart');
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: WAIT });
  await page.waitForTimeout(2500);
  const s = await state();
  log(label, JSON.stringify(s));
  await shot(page, label);
  return s;
}
async function endRound(label, who) {
  await page.evaluate((w) => window.game[w].die('목'), who);
  await page.waitForFunction(() => window.game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: WAIT });
  const menu = await page.evaluate(() => ({ title: document.getElementById('menuTitle').textContent, start: document.getElementById('btnStart').textContent, back: !!document.getElementById('btnTestPick'), note: document.getElementById('testRouteNote')?.textContent }));
  log(label, JSON.stringify(menu));
  await shot(page, label);
  return menu;
}

await page.goto(`${base}/test.html`, { waitUntil: 'networkidle' });
await page.click('#weaponsNew .pick[data-id="zweihander"]');
await page.click('#heroes .pick[data-id="tome"]');
await page.click('#btnGo');
await page.waitForURL(/index\.html\?/, { timeout: WAIT });
check(/test=1&weapon=zweihander&hero=tome&foe=random&stage=random/.test(page.url()), `시작 주소 ${page.url().replace(base, '')}`);
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: WAIT });
await shot(page, 'z_menu');
// 앞에서 본 플레이어 (겉모습 확인용 — 카메라만 잠깐 옮긴다)
const rounds = [];
rounds.push(await fightOnce('z_round1'));
await page.evaluate(() => {
  const g = window.game;
  g.freeCam = true;
  const p = g.player.pelvisPos;
  g.camera.position.set(p.x + 1.9, 1.5, p.z + 0.9);
  g.camera.lookAt(p.x, 1.1, p.z);
});
await page.waitForTimeout(300);
await shot(page, 'z_round1_hero_front');
await page.evaluate(() => (window.game.freeCam = false));
const m1 = await endRound('z_round1_result_win', 'enemy');
rounds.push(await fightOnce('z_round2'));
const m2 = await endRound('z_round2_result_lose', 'player');
rounds.push(await fightOnce('z_round3'));
for (const [i, r] of rounds.entries()) {
  check(r.pw === 'zweihander' && r.pname === '토메 비달' && r.helm === null, `판 ${i + 1}: 플레이어 츠바이핸더 · 이름 토메 비달 · 투구 없음 (${r.pw} ${r.pname} ${r.helm})`);
  check(r.foe !== '토메 비달' && OWN[r.foe] && (OWN[r.foe] === r.fw || (r.foe === '오소리 브란' && r.fw !== 'zweihander')), `판 ${i + 1}: 상대 ${r.foe} 는 자기 무기 ${r.fw}`);
  check(r.pinned === null, `판 ${i + 1}: 무대 ${r.stage} (고정 아님)`);
}
check(rounds[1].stage !== rounds[0].stage && rounds[2].stage !== rounds[1].stage, `무대가 판마다 바뀜 (이겨도·져도): ${rounds.map((r) => r.stage).join(' → ')}`);
check(rounds[1].foe !== rounds[0].foe && rounds[2].foe !== rounds[1].foe, `상대가 판마다 바뀜: ${rounds.map((r) => r.foe).join(' → ')}`);
check(m1.start === '다음 판 (무작위)' && m2.start === '다음 판 (무작위)' && m1.back && m2.back, `결과 메뉴: '${m1.start}' · 테스트 고르기로 단추`);

// 일시정지 메뉴의 '테스트 고르기로' → test.html (기억한 고름)
await page.click('#btnPause');
await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: WAIT });
await shot(page, 'z_pause_menu');
await page.click('#btnTestPick');
await page.waitForURL(/test\.html/, { timeout: WAIT });
const remembered = await page.evaluate(() => [...document.querySelectorAll('.pick[aria-pressed="true"]')].map((b) => b.dataset.id));
check(remembered.join() === 'zweihander,tome', `test.html 이 마지막 고름을 기억 (${remembered.join()})`);

// ── 3. 우치가타나 + 마르그레테 한 판 ──
await page.click('#weaponsNew .pick[data-id="uchigatana"]');
await page.click('#heroes .pick[data-id="margarethe"]');
await shot(page, 'picker_uchigatana_selected');
await page.click('#btnGo');
await page.waitForURL(/index\.html\?/, { timeout: WAIT });
const u = await fightOnce('u_round1');
check(u.pw === 'uchigatana' && u.pname === '마르그레테 슈바르츠' && u.helm === 'horned' && u.plate > 0, `우치가타나 · 마르그레테 겉모습(뿔 투구·판금 ${u.plate}곳)`);
check(u.foe !== '마르그레테 슈바르츠' && (OWN[u.foe] === u.fw || u.foe === '오소리 브란'), `상대 ${u.foe} 는 자기 무기 ${u.fw}`);
await ctx.close();

// ── 4. 인자 없는 본판: 지금 그대로 ──
const ctx2 = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
const p2 = await ctx2.newPage();
watch(p2);
await p2.goto(`${base}/index.html`, { waitUntil: 'networkidle' });
await p2.waitForFunction(() => window.game?.player?.sword, null, { timeout: WAIT });
const plain = await p2.evaluate(() => ({ stage: window.game.stage.id, pname: window.game.player.name, helm: window.game.player.helmetType, foe: window.game.enemy.name, fw: window.game.enemy.weapon.id, back: !!document.getElementById('btnTestPick') }));
log('plain', JSON.stringify(plain));
check(plain.stage === 'poseidon' && plain.pname === '나' && plain.helm === 'kettle' && plain.foe === '하인리히 도른' && !plain.back, '본판: 포세이돈 · 나(케틀햇) · 하인리히 · 테스트 단추 없음');
await ctx2.close();

await browser.close();
log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
log(fails.length ? `FAILS ${fails.length}` : 'ALL CHECKS OK');
process.exit(errors.length || fails.length ? 1 : 0);
