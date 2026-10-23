// 방랑 흐름 점검 (10/23 — docs/import/wander_heroes_import_2026-10-23.md §7): 폰 가로 844 × 390 · 화면 배율 2 · 첫 화면 → 여정 → 정지 → 대기실 길(to_lobby.mjs).
//  ① 잠김: 새 저장 — 방랑 단추가 흐리고(aria-disabled) 누르면 위 알림 줄에 열리는 조건 · 단추 밑 글 없음
//  ② 옛 저장 인정 + 대기실 알림 창: 이어하기 지점 포세이돈 · 깬 수 30(한 바퀴 돈 옛 저장) → 대기실에 처음 들어올 때 알림 창 한 번 → 확인 → 다시 열어도 안 뜸 · 단추 새 색
//  ③ 30 무대 처음 깸: 29 무대를 깬 저장 · 지점 마지막 무대 → 그 판을 이김(상대 쓰러뜨림은 연결 확인용으로 강제) → 결과 창 위 알림 창 → 확인
//  ④ 방랑: 대기실 '방랑' → 이김 · 보상 → '다음 방랑'(2 번 판) → 정지 '재대결'(같은 상대 · 카드부터 · 금화 그대로) → 대기실 → '방랑 이어가기'(같은 대면) → 짐 → '방랑 종료' · '대기실'만 → 대기실 '방랑'
//  ⑤ 특별 보상: 대성당 · 롤랑 판을 저장에 넣고 이어 감 → 이김 → '금화 +… (왕의 금고 +200 포함)' (10/24 02:4x — 전 '(특별 보상 금화 +400 포함)')
//  ⑥ 세 인물: 롤랑 · 백린의 전사 · 베르나르도를 ?foe=<id> 로 세워 앞 3/4 에서 한 장씩
//  10/24 (사장님 00:3x — 알림 창 글은 앞 두 문단 · 알림 창 '확인' · 승리 창 '다음 방랑' = 대기실 방랑 단추 색): ② ③ 글 두 문단 · '아르토리아' 없음 ·
//   두 '확인' · '다음 방랑'의 바탕 · 테(안쪽 그림자) · 글 색 = ② 의 대기실 방랑 단추 계산값 · 여정 결과 창 '다음 여정' · 정지 창 '처음부터 다시'는 금색 그대로
//  10/24 (사장님 01:1x — 방랑 전용 상대 알림 창): 판을 열 때마다 알림 창이 떴는지 본다(toFight) — 여정 판 · 방랑 전용이 아닌 상대 · 같은 대면을 다시 연 판은 없음 · 방랑 전용 상대의 첫 판은 있음.
//   ⑤ 롤랑(카드 고르기 판): 창 글 · 이름 · 소개 대사 · 프로필 그림 · 확인 색 → 확인 → 카드 → 대기실 → '방랑 이어가기' → 창 다시 안 뜸 · ⑦ 백린의 전사(이미 고른 무기 — 싸움 전에 창)
//  10/24 (사장님 02:4x): 알림 창 장면 글 '낯선 발걸음 소리가 들린다.' = 아래 대사와 같은 계산 색 · 글자 크기 · 굵기(굵은 제목 아님) · 차례(장면 글 → 이름 → 대사) ·
//   알림 창 '확인' 크기(높이 · 폭 · 패딩 · 글자 크기 · 줄 높이 · 최소 폭) = ② 대기실 방랑 알림 창 '확인' 계산값 · 청동 그대로 ·
//   정지 창 단추 '재대결'(③ 여정 · ④ 방랑 — 전 '처음부터 다시') · '특별 보상' 글 없음
//  10/24 (사장님 03:0x · 04:3x — 숫자): 여정 낮 · 밤 이기면 +10 ~ 25(③ 밤 무대) · 방랑 이기면 +20 ~ 50(④ · 1 · 2승째 연승 보너스 없음) · ⑤ 롤랑 1승째 '금화 +N (왕의 금고 +200 포함)' ·
//   ⑦ 백린 3승째 '금화 +N (연승 보너스 +M 포함) · 머리 +10 (빼앗은 수급 +10 포함)'(M = 올림(판 금화 × 15 %)) · ⑧ 베르나르도 4승째 '금화 +N (왕의 금고 +200 · 연승 보너스 +M 포함)'(20 %)
//   그림 journey_pause · wander_reward · wander_win_white_scale · wander_win_vault_streak
//  실행: vite 개발 서버를 띄운 뒤  node tools/browser/wander_flow_check.mjs http://127.0.0.1:5173 <그림 폴더>
//  출력: 그림 폴더에 PNG · 끝에 결과 줄(어긋나면 exit 1). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import { titleToLobby, departTitle, lobbyFromBattle } from './to_lobby.mjs';
import { UPDATE_NOTES } from '../../src/update_notes.js';
import { STAGE_ORDER } from '../../src/stages.js';
import { WANDER_EXCLUSIVE, WANDER_BONUS } from '../../src/wander_rules.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

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
/** 방랑 전용 상대 알림 창 (10/24) — 떠 있는 동안 읽는 값 */
const encounterState = (page) => page.evaluate(() => {
  const $ = (id) => document.getElementById(id), img = $('encounterFoeImg');
  return { shown: $('wanderEncounter').classList.contains('show'), state: window.game.state, title: $('encounterTitle').textContent, name: $('encounterName').textContent, quote: $('encounterQuote').textContent,
    portrait: !$('encounterFoe').hidden && img.complete && img.naturalWidth > 0, src: img.getAttribute('src') ?? '', side: $('wanderEncounter').querySelector('.card').classList.contains('foe-shown'), draw: $('draw').className };
});
const encounterImg = (page) => page.waitForFunction(() => { const i = document.getElementById('encounterFoeImg'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 30000 }).catch(() => {});
/** 카드 고르기면 첫 카드 → 싸움까지. 방랑 전용 상대 알림 창이 뜨면 확인을 누르고 간다 — 돌려줌: 창이 떴나 (10/24) */
async function toFight(page) {
  await page.waitForFunction(() => ['draw', 'fight', 'encounter'].includes(window.game.state), null, { timeout: 120000 });
  const met = await page.evaluate(() => window.game.state === 'encounter');
  if (met) {
    await page.locator('#btnEncounter').click();
    await page.waitForFunction(() => ['draw', 'fight'].includes(window.game.state), null, { timeout: 120000 });
  }
  if (await page.evaluate(() => window.game.state) === 'draw') {
    await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6, null, { timeout: 120000 });
    await page.locator('#draw .wcard[data-i="0"]').click();
  }
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
  return met;
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
/** 단추 색 셋 (바탕 · 테 = 안쪽 그림자 · 글) — 10/24 '방랑 단추와 같은 색' 견주기 */
const lookOf = (el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, line: c.boxShadow, fg: c.color }; };
const sameLook = (a, b) => !!a && !!b && a.bg === b.bg && a.line === b.line && a.fg === b.fg;
const looks = (page, id) => page.evaluate(`(${lookOf})(document.getElementById('${id}'))`);
/** 단추 크기 (10/24 02:4x '확인 박스는 대기실에서 쓰던 다른 확인 박스와 크기 맞춰') — 계산값 · 그린 크기(px, 소수 둘째 자리) */
const sizeOf = (el) => { const c = getComputedStyle(el), r = el.getBoundingClientRect(), q = (v) => Math.round(v * 100) / 100; return { w: q(r.width), h: q(r.height), pad: c.padding, fs: c.fontSize, lh: c.lineHeight, fw: c.fontWeight, minW: c.minWidth, radius: c.borderRadius }; };
const SIZE_KEYS = ['w', 'h', 'pad', 'fs', 'lh', 'fw', 'minW', 'radius'];
const sameSize = (a, b) => !!a && !!b && SIZE_KEYS.every((k) => a[k] === b[k]);
const sizeText = (a) => `${a.w}×${a.h} · 패딩 ${a.pad} · 글 ${a.fs}/${a.lh} · 최소 폭 ${a.minW}`;
let lobbyOkSize = null; // ② 대기실 방랑 알림 창 '확인'의 크기 (⑤ ⑦ 이 견줌)
/** 방랑 전용 상대 알림 창 글 꼴 (10/24 02:4x — 장면 글 = 아래 대사와 같은 색 · 크기) · 단추 크기 · 오른쪽 끝 맞춤 */
const encounterStyle = (page) => page.evaluate(`(() => {
  const st = (id) => { const e = document.getElementById(id), c = getComputedStyle(e); return { tag: e.tagName, color: c.color, fs: c.fontSize, fw: c.fontWeight, lh: c.lineHeight, top: e.getBoundingClientRect().top }; };
  const btn = document.getElementById('btnEncounter'), body = btn.closest('.card-body');
  return { title: st('encounterTitle'), name: st('encounterName'), line: st('encounterLine'), quote: st('encounterQuote'),
    ok: (${sizeOf})(btn), right: Math.round(body.getBoundingClientRect().right - btn.getBoundingClientRect().right) };
})()`);
/** 장면 글 · 단추 점검 (⑤ ⑦ 같이) */
function checkEncounterLook(tag, e) {
  const same = (a, b) => a.color === b.color && a.fs === b.fs && a.fw === b.fw;
  check(same(e.title, e.line) && same(e.title, e.quote) && e.title.tag !== 'H1', `${tag} 장면 글 = 대사 꼴 (색 ${e.title.color} · 크기 ${e.title.fs} · 굵기 ${e.title.fw} · ${e.title.tag} — 대사 ${e.line.color} · ${e.line.fs} · ${e.line.fw})`);
  check(e.title.top < e.name.top && e.name.top < e.line.top, `${tag} 차례: 장면 글 → 이름 → 대사`);
  check(sameSize(e.ok, lobbyOkSize), `${tag} '확인' 크기 = 대기실 알림 창 '확인' (${sizeText(e.ok)} — 대기실 ${lobbyOkSize ? sizeText(lobbyOkSize) : '없음'})`);
  check(Math.abs(e.right) <= 1, `${tag} '확인' 오른쪽 끝 맞춤 (틈 ${e.right} px — 대기실 창처럼)`);
}
/** 결과 창 금화 줄의 금화 수 */
const coinsOf = (reward) => Number(reward.match(/금화 \+(\d+)/)?.[1] ?? NaN);
const noticeOk = (text) => text.split('\n').length === 2 && !/아르토리아|롤랑|베르나르도|백린/.test(text) && /방랑이 열렸습니다/.test(text);
let wanderLook = null; // ② 대기실 방랑 단추의 계산값 (③ ④ 가 견줌)
const lobbyState = (page) => shadow(page, `const b = r.getElementById('lobbyWander'); return { text: b.textContent, locked: b.getAttribute('aria-disabled'), status: r.getElementById('lobbyStatus').textContent, dialog: r.getElementById('wanderDialog').open, hint: !!r.querySelector('.wander-hint'), bg: getComputedStyle(b).backgroundColor, depart: getComputedStyle(r.getElementById('lobbyDepart')).backgroundColor };`);
/** 대기실 단추 누르고 싸움(또는 카드)까지 */
async function lobbyGo(page, id) {
  await shadow(page, `r.getElementById(arg).click();`, id);
  await page.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight', 'paused', 'encounter'].includes(window.game?.state), null, { timeout: 120000 });
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
  check(noticeOk(text), `② 알림 글 두 문단 · 방랑 전용 상대 줄 없음 (${text.split('\n').length} 문단)`);
  const dlg = await shadow(page, `const look = ${lookOf}; return { ok: look(r.getElementById('closeWander')), wander: look(r.getElementById('lobbyWander')) };`);
  wanderLook = dlg.wander;
  lobbyOkSize = await shadow(page, `return (${sizeOf})(r.getElementById('closeWander'));`);
  notes.push(`대기실 알림 창 '확인' 크기: ${sizeText(lobbyOkSize)}`);
  check(lobbyOkSize.minW === '72px' && lobbyOkSize.w >= 72, `② 대기실 알림 창 '확인' 크기 ${sizeText(lobbyOkSize)}`);
  check(sameLook(dlg.ok, dlg.wander), `② 알림 창 '확인' 색 = 방랑 단추 (바탕 ${dlg.ok.bg} · 테 ${dlg.ok.line} · 글 ${dlg.ok.fg})`);
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
  check(!(await toFight(page)), '③ 여정 판: 방랑 전용 상대 알림 창 없음');
  // 여정(스테이지 모드) 정지 창 '재대결' (사장님 10/24 02:4x — 전 '처음부터 다시') → 계속하기
  await page.waitForTimeout(1500);
  await page.evaluate(() => document.getElementById('btnPause').click());
  await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 30000 });
  const pause3 = await menuText(page);
  check(pause3.title === '일시정지' && pause3.start === '재대결' && pause3.lobby, `③ 여정 정지 창: '${pause3.title}' · 단추 '${pause3.start}' · 대기실 (무대 줄 '${pause3.stage}')`);
  await page.screenshot({ path: `${out}/journey_pause.png` });
  await page.locator('#btnResume').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
  await finish(page, true);
  const r3 = await menuText(page);
  check(/^금화 \+\d+$/.test(r3.reward) && coinsOf(r3.reward) >= 10 && coinsOf(r3.reward) <= 25, `③ 여정 이김 (${last}${/_night$/.test(last) ? ' — 밤 무대' : ''}): 보상 '${r3.reward}' — 낮 · 밤 +10 ~ 25 (10/24 03:0x)`);
  await page.waitForFunction(() => document.getElementById('wanderNotice').classList.contains('show'), null, { timeout: 30000 }).catch(() => {});
  const shown = await page.evaluate(() => document.getElementById('wanderNotice').classList.contains('show'));
  check(shown, `③ 마지막 무대(${last}) 이김 → 결과 창 위 방랑 알림 창`);
  const text3 = await page.evaluate(() => document.getElementById('wanderNoticeText').textContent);
  check(noticeOk(text3), `③ 알림 글 두 문단 · 방랑 전용 상대 줄 없음`);
  const ok3 = await looks(page, 'btnWanderNotice'), next3 = await looks(page, 'btnStart');
  check(sameLook(ok3, wanderLook), `③ 알림 창 '확인' 색 = 방랑 단추 (바탕 ${ok3.bg})`);
  check(next3.bg === 'rgb(217, 164, 65)' && !sameLook(next3, wanderLook), `③ 뒤 여정 결과 창 '${await page.evaluate(() => document.getElementById('btnStart').textContent)}' 금색 그대로 (${next3.bg})`);
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
  let met = await toFight(page);
  let foe = (await progress(page)).wander.run.foe;
  check(met === WANDER_EXCLUSIVE.includes(foe), `④ 방랑 1 판 상대 ${foe}: 알림 창 ${met ? '뜸' : '없음'} (방랑 전용 ${WANDER_EXCLUSIVE.includes(foe) ? '맞음' : '아님'})`);
  let m = await menuText(page);
  check(/^방랑 1 · /.test(m.stage), `④ 방랑 1 판 무대 줄 '${m.stage}'`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/wander_fight.png` });
  await finish(page, true);
  m = await menuText(page);
  p = await progress(page);
  check(m.title === '승리' && /^방랑 1 · /.test(m.sub) && m.start === '다음 방랑' && m.lobby, `④ 이김: '${m.sub}' · 보상 '${m.reward}' · 단추 '${m.start}' · 대기실`);
  check(p.wander.run.status === 'won' && p.coins > coins0 && p.coins - coins0 === Number(m.reward.match(/금화 \+(\d+)/)?.[1]), `④ 저장: 판 won · 금화 ${coins0} → ${p.coins}`);
  { const extra = WANDER_BONUS[foe]?.coins ?? 0, base = coinsOf(m.reward) - extra;
    check(base >= 20 && base <= 50 && !/특별 보상|연승 보너스/.test(m.reward) && (extra ? m.reward.includes(`(왕의 금고 +${extra} 포함)`) : !/왕의 금고/.test(m.reward)), `④ 방랑 1승째 금화 = +20 ~ 50${extra ? ` + 왕의 금고 ${extra}` : ''} · 연승 보너스 없음 (무대 ${p.wander.run.stage} · 상대 ${foe} · '${m.reward}')`); }
  const win4 = await looks(page, 'btnStart'), lobby4 = await looks(page, 'btnLobby');
  check(sameLook(win4, wanderLook), `④ '다음 방랑' 색 = 방랑 단추 (바탕 ${win4.bg} · 테 ${win4.line})`);
  check(lobby4.bg === 'rgba(0, 0, 0, 0)' && !sameLook(lobby4, wanderLook), `④ '대기실' 단추 그대로 (부 단추 · 바탕 ${lobby4.bg})`);
  await page.screenshot({ path: `${out}/wander_win.png` });
  // 다음 방랑 → 2 번 판
  await page.locator('#btnStart').click();
  met = await toFight(page);
  m = await menuText(page);
  p = await progress(page);
  const foe2 = p.wander.run.foe, coins2 = p.coins;
  check(met === WANDER_EXCLUSIVE.includes(foe2), `④ 방랑 2 판 상대 ${foe2}: 알림 창 ${met ? '뜸' : '없음'}`);
  check(/^방랑 2 · /.test(m.stage) && p.wander.run.round === 2, `④ 다음 방랑: '${m.stage}' · 상대 ${foe2}`);
  // 정지 → 재대결 (기본 — 일반 여정과 같게): 같은 상대 · 카드부터 · 금화 그대로
  await page.evaluate(() => document.getElementById('btnPause').click());
  await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 30000 });
  const pauseSub = await page.evaluate(() => document.getElementById('menuSub').textContent);
  const pause4 = await looks(page, 'btnStart');
  const pauseStart4 = await page.evaluate(() => document.getElementById('btnStart').textContent);
  check(pause4.bg === 'rgb(217, 164, 65)', `④ 정지 창 '${pauseStart4}' 금색 그대로 (${pause4.bg})`);
  check(pauseStart4 === '재대결', `④ 방랑 정지 창 단추 '${pauseStart4}' (여정과 같은 단추 — 10/24 02:4x)`);
  await page.locator('#btnStart').click();
  await page.waitForFunction(() => ['draw', 'fight'].includes(window.game.state), null, { timeout: 120000 });
  p = await progress(page);
  const st = await page.evaluate(() => window.game.state);
  check(p.wander.run.foe === foe2 && p.wander.run.round === 2 && p.coins === coins2 && p.wander.run.status === 'active', `④ 재대결: 같은 상대 ${p.wander.run.foe} · 2 번 판 · 금화 그대로 · ${st === 'draw' ? '카드부터' : '대기실 무기로 바로'} · 정지 창 '${pauseSub}'`);
  check(!(await toFight(page)), '④ 재대결: 같은 대면 — 알림 창 다시 없음');
  // 싸우는 도중 대기실 → 방랑 이어가기 → 같은 대면
  await lobbyFromBattle(page);
  s = await lobbyState(page);
  check(s.text === '방랑 이어가기', `④ 싸움 도중 대기실 → 단추 '${s.text}' (금화 ${(await progress(page)).coins} = ${coins2})`);
  await page.screenshot({ path: `${out}/lobby_wander_continue.png` });
  await lobbyGo(page, 'lobbyWander');
  met = await toFight(page);
  p = await progress(page);
  m = await menuText(page);
  check(!met, '④ 이어가기: 같은 대면 — 알림 창 다시 없음');
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
  // 방랑 전용 상대 알림 창 (10/24): 카드 고르기 전에 — 창 글 · 이름 · 소개 대사 · 프로필 · 확인 색
  await page.waitForFunction(() => window.game.state === 'encounter', null, { timeout: 30000 }).catch(() => {});
  await encounterImg(page);
  let e = await encounterState(page);
  const R = CHARACTERS_BY_ID.roland;
  check(e.shown && e.state === 'encounter' && !/show/.test(e.draw), `⑤ 롤랑 판: 카드 고르기 전에 알림 창 (state ${e.state} · 카드 '${e.draw}')`);
  check(e.title === '낯선 발걸음 소리가 들린다.' && e.name === R.name && e.quote === `“${R.lines.intro[0]}”`, `⑤ 창 글 '${e.title}' · 이름 '${e.name}' · 대사 ${e.quote}`);
  check(e.portrait && e.side && /roland/.test(e.src), `⑤ 프로필 그림 ${e.src} (패배 창과 같은 칸 · 왼쪽)`);
  const okE = await looks(page, 'btnEncounter');
  check(sameLook(okE, wanderLook), `⑤ 알림 창 '확인' 색 = 방랑 단추 (바탕 ${okE.bg})`);
  checkEncounterLook('⑤', await encounterStyle(page));
  await page.screenshot({ path: `${out}/encounter_roland.png` });
  await page.locator('#btnEncounter').click();
  await page.waitForFunction(() => window.game.state === 'draw', null, { timeout: 30000 }).catch(() => {});
  check(await page.evaluate(() => window.game.state === 'draw' && !document.getElementById('wanderEncounter').classList.contains('show')) && (await progress(page)).wander.run.encounterSeen === true, '⑤ 확인 → 창 닫힘 · 카드 고르기 · 저장 encounterSeen');
  // 같은 대면을 다시 열면 (대기실 → 방랑 이어가기) 창 없음
  await lobbyFromBattle(page);
  await lobbyGo(page, 'lobbyWander');
  check(!(await toFight(page)), '⑤ 대기실 → 방랑 이어가기: 같은 대면 — 알림 창 다시 없음');
  const foe = await page.evaluate(() => window.game.enemy.name);
  const vit = await page.evaluate(() => ({ v: window.game.enemy.vitality, blood: window.game.enemy.blood, me: window.game.player.vitality }));
  check(vit.v === 1.1 && vit.blood === 1 && vit.me === 1, `⑤ 롤랑 버티는 힘 ${vit.v} (사장님 10/24 '체력 +10%') · 피 ${vit.blood * 100} % 에서 시작 · 나 ${vit.me}`);
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/wander_fight_roland.png` });
  await finish(page, true);
  const m = await menuText(page);
  check(foe === '롤랑' && /^금화 \+\d+ \(왕의 금고 \+200 포함\)$/.test(m.reward) && coinsOf(m.reward) - 200 >= 20 && coinsOf(m.reward) - 200 <= 50 && !/특별 보상/.test(m.reward), `⑤ 롤랑 1승째 이김: 보상 '${m.reward}' (+20 ~ 50 + 왕의 금고 200)`);
  const gap = await page.evaluate(() => { const b = document.querySelector('#menuReward .bonus'), prev = b?.previousElementSibling; return b && prev ? Math.round(b.getBoundingClientRect().left - prev.getBoundingClientRect().right) : null; });
  check(gap >= 3, `⑤ 괄호 앞 틈 ${gap} px`);
  await page.screenshot({ path: `${out}/wander_reward.png` });
  await ctx.close();
}

// ⑦ 방랑 전용 상대 알림 창 — 백린의 전사 · 무기를 이미 고른 판(카드 없이 싸움): 싸움 전에 창 (10/24)
{
  const run = { id: 'check-white', round: 3, wins: 2, stage: 'qinglan', foe: 'white_scale', foeWeapon: 'muramasa', status: 'active', weapon: 'longsword', cards: ['longsword', 'rapier'], lastWeapon: 'longsword', headTaken: false };
  const seed = {
    'stillness.journey.checkpoint.v1': { version: 1, stage: 'poseidon' },
    'stillness.lobby.progress.v1': progressSeed({ wander: { cleared: STAGE_ORDER, unlocked: true, legacyChecked: true, noticeSeen: true, run } }),
  };
  const { ctx, page } = await open(seed);
  await titleToLobby(page, '#continueJourney');
  await lobbyGo(page, 'lobbyWander');
  await page.waitForFunction(() => window.game.state === 'encounter', null, { timeout: 30000 }).catch(() => {});
  await encounterImg(page);
  const e = await encounterState(page), W = CHARACTERS_BY_ID.white_scale;
  check(e.shown && e.name === W.name && e.quote === `“${W.lines.intro[0]}”` && e.portrait && /white_scale/.test(e.src), `⑦ 백린의 전사(고른 무기 판): 싸움 전에 알림 창 · '${e.name}' · ${e.quote} · 그림 ${e.src}`);
  checkEncounterLook('⑦', await encounterStyle(page));
  await page.screenshot({ path: `${out}/encounter_white_scale.png` });
  await page.locator('#btnEncounter').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 }).catch(() => {});
  check(await page.evaluate(() => window.game.state === 'fight' && window.game.enemy.name === '백린의 전사' && window.game.enemy.vitality === 1), '⑦ 확인 → 카드 없이 싸움 (백린의 전사 · 버티는 힘 1 그대로)');
  // 백린의 전사 이김 (이 방랑 3승째 · 목은 안 벰): '금화 +N (연승 보너스 +M 포함) · 머리 +10 (빼앗은 수급 +10 포함)' (사장님 10/24 02:4x · 03:0x)
  const heads0 = (await progress(page)).heads, coins7 = (await progress(page)).coins;
  await page.waitForTimeout(1500);
  await finish(page, true);
  const m7 = await menuText(page), p7 = await progress(page);
  { const mm = m7.reward.match(/^금화 \+(\d+) \(연승 보너스 \+(\d+) 포함\) · 머리 \+10 \(빼앗은 수급 \+10 포함\)$/), n = +mm?.[1], k = +mm?.[2], base = n - k;
    check(!!mm && base >= 20 && base <= 50 && k === Math.ceil((base * 15) / 100) && !/특별 보상|왕의 금고/.test(m7.reward), `⑦ 백린의 전사 3승째 이김: 보상 '${m7.reward}' (판 금화 ${base} · 연승 보너스 15 % 올림 ${k})`);
    check(p7.coins - coins7 === n && p7.wander.run.reward.streak === k && p7.wander.run.wins === 3, `⑦ 저장 금화 ${coins7} → ${p7.coins} · 판 보상 연승 보너스 ${p7.wander.run.reward.streak} · 연승 ${p7.wander.run.wins}`); }
  check(p7.heads === heads0 + 10 && p7.wander.run.reward.heads === 10, `⑦ 저장 머리 ${heads0} → ${p7.heads} (빼앗은 수급 10 · 참수 없음)`);
  await page.screenshot({ path: `${out}/wander_win_white_scale.png` });
  await ctx.close();
}

// ⑧ 왕의 금고 + 연승 보너스 (10/24 03:0x · 04:3x): 베르나르도 · 이 방랑 4승째(연승 3 뒤) · 무기 고름 · 알림 창 이미 봄 → 이김 → '금화 +N (왕의 금고 +200 · 연승 보너스 +M 포함)' (M = 올림(판 금화 × 20 %))
{
  const run = { id: 'check-bernardo', round: 4, wins: 3, stage: 'castle', foe: 'bernardo', foeWeapon: 'tizona', status: 'active', weapon: 'longsword', cards: ['longsword', 'rapier'], lastWeapon: 'longsword', headTaken: false, encounterSeen: true };
  const seed = {
    'stillness.journey.checkpoint.v1': { version: 1, stage: 'poseidon' },
    'stillness.lobby.progress.v1': progressSeed({ coins: 100, wander: { cleared: STAGE_ORDER, unlocked: true, legacyChecked: true, noticeSeen: true, run } }),
  };
  const { ctx, page } = await open(seed);
  await titleToLobby(page, '#continueJourney');
  await lobbyGo(page, 'lobbyWander');
  check(!(await toFight(page)), '⑧ 베르나르도 판(알림 창 이미 봄): 창 없이 싸움');
  const stage8 = (await menuText(page)).stage;
  await page.waitForTimeout(1500);
  await finish(page, true);
  const m8 = await menuText(page), p8 = await progress(page);
  const mm = m8.reward.match(/^금화 \+(\d+) \(왕의 금고 \+200 · 연승 보너스 \+(\d+) 포함\)$/), n = +mm?.[1], k = +mm?.[2], base = n - 200 - k;
  check(!!mm && base >= 20 && base <= 50 && k === Math.ceil((base * 20) / 100) && /^방랑 4 · /.test(stage8), `⑧ 베르나르도 4승째 이김 ('${stage8}'): 보상 '${m8.reward}' (판 금화 ${base} · 연승 보너스 20 % 올림 ${k} · 왕의 금고 200)`);
  check(p8.coins === 100 + n && p8.wander.run.wins === 4 && p8.wander.run.reward.streak === k, `⑧ 저장 금화 100 → ${p8.coins} · 연승 ${p8.wander.run.wins}`);
  await page.screenshot({ path: `${out}/wander_win_vault_streak.png` });
  // 다시 열기: 같은 판을 또 셈하지 않음 (새로고침 → 대기실 → 금화 그대로)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 120000 });
  check((await progress(page)).coins === p8.coins, `⑧ 새로고침 뒤 금화 그대로 ${(await progress(page)).coins}`);
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
