// 방랑 흐름 점검 (10/23 — docs/import/wander_heroes_import_2026-10-23.md §7): 폰 가로 844 × 390 · 화면 배율 2 · 첫 화면 → 여정 → 정지 → 대기실 길(to_lobby.mjs).
//  ① 잠김: 새 저장 — 방랑 단추가 흐리고(aria-disabled) 누르면 위 알림 줄에 열리는 조건 · 단추 밑 글 없음
//  ② 옛 저장 인정 + 대기실 알림 창: 이어하기 지점 포세이돈 · 깬 수 30(한 바퀴 돈 옛 저장) → 대기실에 처음 들어올 때 알림 창 한 번 → 확인 → 다시 열어도 안 뜸 · 단추 새 색
//  ③ 30 무대 처음 깸: 29 무대를 깬 저장 · 지점 마지막 무대 → 그 판을 이김(상대 쓰러뜨림은 연결 확인용으로 강제) → 결과 창 위 알림 창 → 확인
//  ④ 방랑: 대기실 '방랑' → 이김 · 보상 → '다음 대면'(2 번 판) → 정지 '처음부터 다시'(같은 상대 · 카드부터 · 금화 그대로) → 대기실 → '방랑 이어가기'(같은 대면) → 짐 → '방랑 종료' · '대기실'만 → 대기실 '방랑'
//  ⑤ 특별 보상: 대성당 · 롤랑 판을 저장에 넣고 이어 감 → 이김 → '금화 +… (특별 보상 금화 +250 포함)'
//  ⑥ 세 인물: 롤랑 · 백린의 전사 · 베르나르도를 ?foe=<id> 로 세워 앞 3/4 에서 한 장씩
//  실행: vite 개발 서버를 띄운 뒤  node tools/browser/wander_flow_check.mjs http://127.0.0.1:5173 <그림 폴더>
//  출력: 그림 폴더에 PNG · 끝에 결과 줄(어긋나면 exit 1). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import { titleToLobby, departTitle, lobbyFromBattle } from './to_lobby.mjs';
import { UPDATE_NOTES } from '../../src/update_notes.js';
import { STAGE_ORDER } from '../../src/stages.js';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/wander_import';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [], fails = [], notes = [];
const check = (ok, what) => { (ok ? notes : fails).push(`${ok ? 'OK ' : 'FAIL '}${what}`); console.log(ok ? 'OK  ' : 'FAIL', what); };
const NOTICES = { hideRead: true, readIds: UPDATE_NOTES.map((n) => n.id) };
// 다른 알림 창(스킬트리 옮김 · 인장 → 금화)이 방랑 알림 창을 가리지 않게 — 이미 본 것으로 넣는다
const TREE = { v: 1, at: '2026-10-21', books: 0, coins: 0, heads: 0, bonus: 500, notice: false };
const progressSeed = (extra = {}) => ({ version: 1, coins: 500, heads: 0, acquisitions: [], titles: [], title: '여행자', tree: TREE, ...extra });
const BASE = { 'stillness.lobby.sealCoins.v1': { version: 1, converted: 0, at: '2026-10-16', notice: false }, 'stillness.lobby.progress.v1': progressSeed() };

/** 새 문맥: seed = 처음 한 번만 넣을 저장 { 열쇠: 값 } (다시 읽기에는 그대로 둔다) */
async function open(seed = {}) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  await ctx.addInitScript(([seed, notices]) => {
    if (sessionStorage.getItem('wanderSeeded')) return;
    localStorage.clear();
    localStorage.setItem('stillness.title.notices.v1', JSON.stringify(notices));
    for (const [k, v] of Object.entries(seed)) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
    sessionStorage.setItem('wanderSeeded', '1');
  }, [{ ...BASE, ...seed }, NOTICES]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.locator('#newJourney').waitFor({ state: 'attached', timeout: 120000 });
  await page.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 120000 });
  return { ctx, page };
}
const shadow = (page, fn, arg) => page.evaluate(([src, arg]) => { const r = document.querySelector('#gameEntrance').shadowRoot; return new Function('r', 'arg', src)(r, arg); }, [fn, arg]);
const progress = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1') || 'null'));
/** 카드 고르기면 첫 카드 → 싸움까지 */
async function toFight(page) {
  await page.waitForFunction(() => ['draw', 'fight'].includes(window.game.state), null, { timeout: 120000 });
  if (await page.evaluate(() => window.game.state) === 'draw') {
    await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 120000 });
    await page.locator('#draw .wcard[data-i="0"]').click();
  }
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
}
/** 판을 끝낸다 (연결 확인용 — 승률 자료 아님) → 결과 창이 뜰 때까지 */
async function finish(page, win) {
  await page.evaluate((win) => { const g = window.game; (win ? g.enemy : g.player).die('출혈', true); }, win);
  await page.waitForFunction(() => document.getElementById('menu').classList.contains('show') && /승리|패배/.test(document.getElementById('menuTitle').textContent), null, { timeout: 180000 });
}
const menuText = (page) => page.evaluate(() => ({
  title: document.getElementById('menuTitle').textContent, sub: document.getElementById('menuSub').textContent,
  reward: document.getElementById('menuReward').hidden ? '' : document.getElementById('menuReward').textContent,
  start: document.getElementById('btnStart').hidden ? null : document.getElementById('btnStart').textContent,
  lobby: !document.getElementById('btnLobby').hidden, stage: document.querySelector('#stageInfo .stg').textContent,
}));
const lobbyState = (page) => shadow(page, `const b = r.getElementById('lobbyWander'); return { text: b.textContent, locked: b.getAttribute('aria-disabled'), status: r.getElementById('lobbyStatus').textContent, dialog: r.getElementById('wanderDialog').open, hint: !!r.querySelector('.wander-hint'), bg: getComputedStyle(b).backgroundColor, depart: getComputedStyle(r.getElementById('lobbyDepart')).backgroundColor };`);
/** 대기실 단추 누르고 싸움(또는 카드)까지 */
async function lobbyGo(page, id) {
  await shadow(page, `r.getElementById(arg).click();`, id);
  await page.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight', 'paused'].includes(window.game?.state), null, { timeout: 120000 });
}

// ① 잠김
{
  const { ctx, page } = await open();
  await titleToLobby(page);
  let s = await lobbyState(page);
  check(s.locked === 'true' && s.text === '방랑' && !s.hint, `① 잠김: 단추 '${s.text}' aria-disabled=${s.locked} · 단추 밑 글 없음`);
  await page.screenshot({ path: `${out}/lobby_locked.png` });
  await shadow(page, `r.getElementById('lobbyWander').click();`);
  s = await lobbyState(page);
  check(/모든 무대를 깨면 열립니다\. \(깬 무대 \d+\/30\)/.test(s.status), `① 잠김 누름 → 알림 줄 '${s.status}'`);
  await page.screenshot({ path: `${out}/lobby_locked_tap.png` });
  check(!s.dialog, '① 알림 창 없음');
  await ctx.close();
}

// ② 옛 저장 인정 (한 바퀴) + 대기실 알림 창
{
  const seed = { 'stillness.journey.checkpoint.v1': { version: 1, stage: 'poseidon', lastWeapon: 'longsword' }, 'stillness.journeyClears.v1': '30' };
  const { ctx, page } = await open(seed);
  await titleToLobby(page, '#continueJourney');
  let s = await lobbyState(page);
  check(s.dialog, '② 옛 저장(지점 포세이돈 · 깬 수 30) → 대기실 알림 창');
  const text = await shadow(page, `return r.getElementById('wanderText').textContent;`);
  notes.push('알림 글: ' + text.replace(/\n/g, ' / '));
  await page.screenshot({ path: `${out}/popup_lobby.png` });
  await shadow(page, `r.getElementById('closeWander').click();`);
  s = await lobbyState(page);
  const p = await progress(page);
  check(!s.dialog && p.wander.noticeSeen === true && p.wander.unlocked === true, '② 확인 → 창 닫힘 · 저장 noticeSeen · 열림');
  check(s.locked === 'false' && s.text === '방랑', `② 열린 단추 '${s.text}' 색 ${s.bg} (Stage 입장 ${s.depart})`);
  await page.screenshot({ path: `${out}/lobby_wander_button.png` });
  // 다시 열기 → 알림 창 없음
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 120000 });
  await titleToLobby(page, '#continueJourney');
  s = await lobbyState(page);
  check(!s.dialog, '② 다시 열어 대기실 → 알림 창 다시 안 뜸');
  await ctx.close();
}

// ③ 30 무대 처음 깸 → 결과 창 위 알림 창, 이어서 ④ 방랑 흐름
{
  const last = STAGE_ORDER.at(-1);
  const seed = {
    'stillness.journey.checkpoint.v1': { version: 1, stage: last },
    'stillness.journeyClears.v1': '29',
    'stillness.lobby.progress.v1': progressSeed({ wander: { cleared: STAGE_ORDER.slice(0, -1), unlocked: false, legacyChecked: true } }),
  };
  const { ctx, page } = await open(seed);
  await departTitle(page, '#continueJourney');
  await toFight(page);
  await finish(page, true);
  await page.waitForFunction(() => document.getElementById('wanderNotice').classList.contains('show'), null, { timeout: 30000 }).catch(() => {});
  const shown = await page.evaluate(() => document.getElementById('wanderNotice').classList.contains('show'));
  check(shown, `③ 마지막 무대(${last}) 이김 → 결과 창 위 방랑 알림 창`);
  await page.screenshot({ path: `${out}/popup_first_clear.png` });
  await page.locator('#btnWanderNotice').click();
  let p = await progress(page);
  check(p.wander.unlocked && p.wander.noticeSeen && !(await page.evaluate(() => document.getElementById('wanderNotice').classList.contains('show'))), '③ 확인 → 닫힘 · 저장 열림 · noticeSeen');
  // ④ 대기실 → 방랑
  await page.locator('#btnLobby').click();
  await page.locator('#lobbyPortraitImg').waitFor({ state: 'attached', timeout: 60000 });
  let s = await lobbyState(page);
  check(!s.dialog && s.locked === 'false' && s.text === '방랑', `④ 대기실: 알림 창 없음 · 단추 '${s.text}'`);
  const coins0 = (await progress(page)).coins;
  await lobbyGo(page, 'lobbyWander');
  await toFight(page);
  let m = await menuText(page);
  check(/^방랑 1 · /.test(m.stage), `④ 방랑 1 판 무대 줄 '${m.stage}'`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/wander_fight.png` });
  await finish(page, true);
  m = await menuText(page);
  p = await progress(page);
  check(m.title === '승리' && /^방랑 1 · /.test(m.sub) && m.start === '다음 대면' && m.lobby, `④ 이김: '${m.sub}' · 보상 '${m.reward}' · 단추 '${m.start}' · 대기실`);
  check(p.wander.run.status === 'won' && p.coins > coins0 && p.coins - coins0 === Number(m.reward.match(/금화 \+(\d+)/)?.[1]), `④ 저장: 판 won · 금화 ${coins0} → ${p.coins}`);
  await page.screenshot({ path: `${out}/wander_win.png` });
  // 다음 대면 → 2 번 판
  await page.locator('#btnStart').click();
  await toFight(page);
  m = await menuText(page);
  p = await progress(page);
  const foe2 = p.wander.run.foe, coins2 = p.coins;
  check(/^방랑 2 · /.test(m.stage) && p.wander.run.round === 2, `④ 다음 대면: '${m.stage}' · 상대 ${foe2}`);
  // 정지 → 처음부터 다시 (기본 — 일반 여정과 같게): 같은 상대 · 카드부터 · 금화 그대로
  await page.evaluate(() => document.getElementById('btnPause').click());
  await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 30000 });
  const pauseSub = await page.evaluate(() => document.getElementById('menuSub').textContent);
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => ['draw', 'fight'].includes(window.game.state), null, { timeout: 120000 });
  p = await progress(page);
  const st = await page.evaluate(() => window.game.state);
  check(p.wander.run.foe === foe2 && p.wander.run.round === 2 && p.coins === coins2 && p.wander.run.status === 'active', `④ 처음부터 다시: 같은 상대 ${p.wander.run.foe} · 2 번 판 · 금화 그대로 · ${st === 'draw' ? '카드부터' : '대기실 무기로 바로'} · 정지 창 '${pauseSub}'`);
  await toFight(page);
  // 싸우는 도중 대기실 → 방랑 이어가기 → 같은 대면
  await lobbyFromBattle(page);
  s = await lobbyState(page);
  check(s.text === '방랑 이어가기', `④ 싸움 도중 대기실 → 단추 '${s.text}' (금화 ${(await progress(page)).coins} = ${coins2})`);
  await page.screenshot({ path: `${out}/lobby_wander_continue.png` });
  await lobbyGo(page, 'lobbyWander');
  await toFight(page);
  p = await progress(page);
  m = await menuText(page);
  check(p.wander.run.foe === foe2 && /^방랑 2 · /.test(m.stage) && p.coins === coins2, `④ 이어가기: 같은 대면(${p.wander.run.foe}) · '${m.stage}'`);
  // 짐 → 방랑 종료
  await finish(page, false);
  m = await menuText(page);
  p = await progress(page);
  check(m.title === '패배' && / · 방랑 종료$/.test(m.sub) && m.start === null && m.lobby && p.wander.run.status === 'lost', `④ 짐: '${m.sub}' · 보상 '${m.reward}' · 다음 단추 없음 · 대기실만`);
  await page.screenshot({ path: `${out}/wander_defeat.png` });
  await page.locator('#btnLobby').click();
  await page.locator('#lobbyPortraitImg').waitFor({ state: 'attached', timeout: 60000 });
  s = await lobbyState(page);
  check(s.text === '방랑', `④ 진 뒤 대기실 단추 '${s.text}' (다시 들어가면 새 조합)`);
  await ctx.close();
}

// ⑤ 특별 보상 (대성당 · 롤랑)
{
  const run = { id: 'check-roland', round: 1, wins: 0, stage: 'cathedral', foe: 'roland', foeWeapon: 'zweihander', status: 'active', weapon: null, cards: null, lastWeapon: null, headTaken: false };
  const seed = {
    'stillness.journey.checkpoint.v1': { version: 1, stage: 'poseidon' },
    'stillness.lobby.progress.v1': progressSeed({ coins: 100, wander: { cleared: STAGE_ORDER, unlocked: true, legacyChecked: true, noticeSeen: true, run } }),
  };
  const { ctx, page } = await open(seed);
  await titleToLobby(page, '#continueJourney');
  const s = await lobbyState(page);
  check(s.text === '방랑 이어가기', `⑤ 저장된 롤랑 판 → '${s.text}'`);
  await lobbyGo(page, 'lobbyWander');
  await toFight(page);
  const foe = await page.evaluate(() => window.game.enemy.name);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/wander_fight_roland.png` });
  await finish(page, true);
  const m = await menuText(page);
  check(foe === '롤랑' && /\(특별 보상 금화 \+250 포함\)/.test(m.reward), `⑤ 롤랑 이김: 보상 '${m.reward}'`);
  const gap = await page.evaluate(() => { const b = document.querySelector('#menuReward .bonus'), prev = b?.previousElementSibling; return b && prev ? Math.round(b.getBoundingClientRect().left - prev.getBoundingClientRect().right) : null; });
  check(gap >= 3, `⑤ 괄호 앞 틈 ${gap} px`);
  await page.screenshot({ path: `${out}/wander_reward.png` });
  await ctx.close();
}

// ⑥ 세 인물 (싸움 화면 · 앞 3/4 · 물리 멈춤 — 겉모습만)
for (const [id, weapon] of [['roland', 'zweihander'], ['white_scale', 'muramasa'], ['bernardo', 'tizona']]) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${id} pageerror: ` + e));
  await page.goto(`${base}/?stage=cathedral&foe=${id}&foeWeapon=${weapon}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 2.2, null, { timeout: 900000 });
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  await page.evaluate(() => {
    const g = window.game, T = g.THREE, E = g.enemy;
    g.world.step = () => {};
    g.freeCam = true;
    for (const m of g.player.meshes) m.group.visible = false;
    if (g.player.swordGroup) g.player.swordGroup.visible = false;
    const c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
    const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), -0.6);
    const at = new T.Vector3(c.x, c.y + 0.15, c.z);
    g.camera.position.copy(at).addScaledVector(fw, 2.6).setY(c.y + 0.45);
    g.camera.lookAt(at);
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/hero_${id}.png` });
  check(true, `⑥ ${id} 그림`);
  await ctx.close();
}

await browser.close();
console.log('\n' + (fails.length ? `FAIL ${fails.length}` : `PASS ${notes.filter((n) => n.startsWith('OK')).length}`) + ' · 콘솔 오류 ' + errors.length);
for (const e of errors) console.log('  ' + e);
for (const n of notes) if (!n.startsWith('OK')) console.log('  ' + n);
process.exit(fails.length || errors.length ? 1 : 0);
