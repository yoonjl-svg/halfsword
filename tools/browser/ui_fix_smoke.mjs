// 화면 고침 실제 흐름 점검 (사장님 10/16 08:3x · 08:4x — docs/import/ui_fix_2026-10-16.md §3~§5) — 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  ① 첫 화면 'Stage 1' → 곧바로 카드 (사장님 10/17 11:2x — 대기실을 거치지 않음) · 일시정지 → 대기실: 정지 창 '대기실' · 설정 줄 그대로 → 대기실('Stage 입장') · 금화 · 대면 결과 · 이어하기 지점 그대로(사장님 08:4x '깎지 마')
//     → 다시 출발 = 같은 무대 · 같은 무기 (카드 없이)
//  ② 결과 창 — 이김: '승리' · '금화 +N' · 설정 줄 없음 · '다음 여정' · '대기실' → 대기실 금화 = 전 + N → 출발 = 다음 무대
//     짐: '패배' · '금화 −N'(또는 ±0) · '다시 겨루기'(같은 무대 — 진 판은 넘어가지 않음) · '대기실'
//     14:0x (같은 문서 §11): 금화 줄은 늘든 줄든 같은 강조 색 · 위 부제와 빈 줄 하나(부제 한 줄 높이) · 앞에 대기실 금화 그림 / 패배 글 = 첫 줄 진 까닭 · 다음 줄 “대사”(이름 없이)
//     14:4x (같은 문서 §12): 결과 창 부제에서 대사를 뺌 — 진 까닭 한 줄뿐(승리 창과 같은 꼴) · 상대 대사는 결과 창이 뜨기 전 싸움 화면에만
//     10/17 22:1x (docs/design/portrait_ui_2026-10-17.md §4): 패배 창 = 상대 프로필(왼쪽) + 그 오른쪽 “승리 대사” · 부제는 진 까닭 한 줄 그대로 · 금화 줄은 그 위 글(대사)과 빈 줄 하나 · 10/18 01:4x 싸움 화면 대사는 뺌
//  ③ 테스트 경로 · 주소 판: 정지 · 결과 창에 '대기실' 없음 · 결과 창 설정 줄 그대로 (메뉴 그대로)
//  ④ 대기실 캐릭터: '드래그하여 회전' 없음 · 10/17 22:1x 돌림판 3D 미리보기를 정사각 프로필 그림으로 바꿈(docs/design/portrait_ui_2026-10-17.md) — 그림이 뜨고 출발 단추 위 · 끌어도 아무 일 없음
//  ⑤ 대기실 무기 = 싸움 무기 (08:4x — 같은 문서 §6): 나뭇가지를 장착하고 출발하면 그 무기로 싸움 (10/17 전: 대기실 몸 ↔ 판의 플레이어 손목 · 칼끝 · 칼날 축 — 대기실 몸이 없어짐)
//  10/17: ④ ⑤ 의 대기실도 첫 화면 → 곧바로 카드 → 정지 → '대기실' 로 연다 (tools/browser/to_lobby.mjs)
//  npm run build && npx vite preview --port 5230 →  node tools/browser/ui_fix_smoke.mjs http://127.0.0.1:5230 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { departTitle, titleToLobby } from './to_lobby.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js'; // 패배 창 대사가 그 상대의 승리 대사인지 (10/18)
const base = process.argv[2] || 'http://127.0.0.1:5230', out = process.argv[3] || '/tmp/ui-fix';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [], checks = [];
const IGNORED = /deprecated parameters for the initialization function/;
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); }); };
const noAuth = (c) => c.route('https://*.supabase.co/**', (r) => { errors.push('auth server called: ' + r.request().url()); r.abort(); });
const inRoot = (p, body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance')?.shadowRoot;${body}`));
async function title(p) {
  await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
  if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
  await p.waitForFunction(() => document.querySelector('#gameEntrance')?.shadowRoot.getElementById('entrance')?.dataset.phase === 'ready', null, { timeout: 20000 });
}
async function lobby(p, url) { // 첫 화면 → 곧바로 여정 → 정지 → 대기실 (url 없으면 지금 첫 화면에서)
  if (url != null) await p.goto(base + url, { waitUntil: 'networkidle' });
  await title(p);
  return titleToLobby(p);
}
const inLobby = (p) => p.waitForFunction(() => !!document.querySelector('#gameEntrance')?.shadowRoot.querySelector('.lobby #lobbyPortraitImg') && document.documentElement.hasAttribute('data-start-open'), null, { timeout: 30000 }); // 10/17: 3D 미리보기 그리개 → 프로필 그림
const pick = async (p, i = 0) => { await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 30000 }); await p.locator(`#draw .wcard[data-i="${i}"]`).click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 }); };
const depart = async (p) => { await p.locator('#lobbyDepart').click(); await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(game.state), null, { timeout: 60000 }); };
const end = async (p, who) => { await p.evaluate((w) => game[w].die('기절', true), who); await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 40000 }); };
const menu = (p) => p.evaluate(() => {
  const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && getComputedStyle(el).display !== 'none'; };
  return { title: document.getElementById('menuTitle').textContent, start: document.getElementById('btnStart').textContent, resume: vis('btnResume'), lobby: vis('btnLobby'), lobbyText: document.getElementById('btnLobby').textContent, fps: vis('fpsRow'), reward: vis('menuReward') ? document.getElementById('menuReward').textContent : null, test: vis('btnTestPick') };
});
// 결과 창 꼴 (14:0x): 부제 줄들 · 금화 줄 색 · 그림 · 부제 아래 끝과 금화 줄 위 끝 사이 틈(= 빈 줄 하나 = 부제 한 줄 높이)
//  그림 = 매끈한 금화 · 주머니 그림 (10/16 15:3x ⑦ — docs/import/item_art_2026-10-16.md): 실제로 읽혔나(256 px) · 꾸밈(빈 alt · aria-hidden) · 14 px
const look = (p) => p.evaluate(async () => {
  const sub = document.getElementById('menuSub'), fl = document.getElementById('menuFoeLine'), above = fl && !fl.hidden ? fl : sub; // 10/17: 패배 창은 대사 줄이 금화 줄 바로 위
  const rw = document.getElementById('menuReward'), s = above.getBoundingClientRect(), r = rw.getBoundingClientRect(), imgs = [...rw.querySelectorAll('img')];
  await Promise.all(imgs.map((i) => i.decode().catch(() => {})));
  return { lines: sub.innerText.split('\n'), color: getComputedStyle(rw).color, icons: imgs.map((i) => i.getAttribute('class')), hidden: imgs.every((i) => i.getAttribute('aria-hidden') === 'true' && i.getAttribute('alt') === ''), loaded: imgs.every((i) => i.complete && i.naturalWidth === 256), size: imgs.map((i) => i.getBoundingClientRect().width), svg: rw.querySelectorAll('svg').length, gap: r.top - s.bottom, line: parseFloat(getComputedStyle(sub).lineHeight) };
});
const ACCENT = 'rgb(217, 164, 65)'; // --c-accent
const store = (p) => p.evaluate(() => ({ coins: JSON.parse(localStorage.getItem('stillness.lobby.progress.v1'))?.coins ?? 100, profile: localStorage.getItem('stillness.lobby.profile.v1'), checkpoint: localStorage.getItem('stillness.journey.checkpoint.v1') }));
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });

try {
  // ①② 첫 화면·대기실 여정
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + '/?title=1&cards=longsword,rapier', { waitUntil: 'networkidle' }); await title(p);
    assert.equal(await departTitle(p), 'draw'); // 첫 화면 'Stage 1' → 곧바로 카드 (덮개 걷힘 · 대기실 없음)
    await pick(p, 0);
    const stage0 = await p.evaluate(() => game.stage.id);
    // ① 일시정지 → 대기실
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    const paused = await menu(p);
    assert.deepEqual({ ...paused, reward: undefined }, { title: '일시정지', start: '처음부터 다시', resume: true, lobby: true, lobbyText: '대기실', fps: true, reward: undefined, test: false });
    await shot(p, 'pause-journey');
    const before = await store(p);
    await p.locator('#btnLobby').click(); await inLobby(p);
    assert.equal(await p.evaluate(() => game.state), 'menu');
    assert.equal(await inRoot(p, `return root.getElementById('lobbyDepart').textContent`), 'Stage 입장');
    assert.deepEqual(await store(p), before); // 금화 · 대면 결과 · 이어하기 지점 그대로
    assert.equal(await inRoot(p, `return root.getElementById('lobbyCoins').textContent`), String(before.coins));
    await p.waitForTimeout(400); await shot(p, 'lobby-after-pause');
    await depart(p);
    assert.equal(await p.evaluate(() => game.state), 'fight'); // 고른 무기로 그 무대 시작부터 — 카드 없이
    assert.deepEqual(await p.evaluate(() => [game.stage.id, game.player.weapon.id]), [stage0, 'longsword']);
    checks.push({ check: 'title Stage 1 → straight to the card draw (no lobby); pause → 대기실: menu has 대기실 + settings row; lobby opens as Stage 입장; coins · duel record · checkpoint unchanged; departing resumes the same stage with the same weapon', stage0, coins: before.coins });
    // ② 이긴 판 결과 창
    await end(p, 'enemy');
    const won = await menu(p);
    assert.equal(won.title, '승리'); assert.equal(won.start, '다음 여정'); assert.equal(won.lobby, true); assert.equal(won.lobbyText, '대기실'); assert.equal(won.fps, false); assert.equal(won.resume, false);
    assert.match(won.reward, /^금화 \+(\d+)$/);
    const gain = Number(won.reward.match(/\+(\d+)/)[1]);
    assert.ok(gain >= 5 && gain <= 15, won.reward);
    const wonLook = await look(p);
    assert.equal(wonLook.lines.length, 1); assert.equal(wonLook.color, ACCENT); assert.deepEqual(wonLook.icons, ['coin-icon']); assert.ok(wonLook.hidden);
    assert.ok(wonLook.loaded, JSON.stringify(wonLook)); assert.deepEqual(wonLook.size, [14]); assert.equal(wonLook.svg, 0); // 매끈한 금화 그림이 실제로 읽힘 (옛 도트 svg 없음)
    assert.ok(Math.abs(wonLook.gap - wonLook.line) < 0.6, JSON.stringify(wonLook)); // 빈 줄 하나
    await shot(p, 'result-win');
    await p.locator('#btnLobby').click(); await inLobby(p);
    assert.equal(await inRoot(p, `return root.getElementById('lobbyCoins').textContent`), String(before.coins + gain));
    assert.equal(JSON.parse((await store(p)).checkpoint).stage !== stage0, true); // 이긴 순간 다음 무대로 적혀 있다
    await depart(p); await pick(p, 0);
    const stage1 = await p.evaluate(() => game.stage.id);
    assert.notEqual(stage1, stage0);
    checks.push({ check: 'win popup: 승리 · 금화 +N (accent · coin icon · one blank line above) · no settings row · 다음 여정 + 대기실; 대기실 shows the new coins; departing opens the next stage', reward: won.reward, look: wonLook, stage1 });
    // ② 진 판 결과 창 — 14:4x 상대 대사는 싸움 화면에만 → 10/17 22:1x 패배 창에도 상대 프로필과 같은 대사 → 10/18 01:4x '싸움 화면쪽은 빼': 대사는 패배 창에만
    await p.evaluate(() => { const el = document.getElementById('foeIntro'); window.__foeShown = []; new MutationObserver(() => { if (el.classList.contains('show')) window.__foeShown.push(el.querySelector('span').textContent); }).observe(el, { attributes: true, attributeFilter: ['class'], subtree: true, childList: true, characterData: true }); });
    const foeName = await p.evaluate(() => game.enemy.name);
    await p.evaluate(() => game.player.die('기절', true));
    await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 150000 }); // 결과 창은 게임 시간 3.5 s 뒤 (그대로)
    const fightShown = await p.evaluate(() => window.__foeShown);
    const lost = await menu(p);
    assert.equal(lost.title, '패배'); assert.equal(lost.start, '다시 겨루기'); assert.equal(lost.lobby, true); assert.equal(lost.fps, false);
    assert.match(lost.reward, /^금화 (−[1-5]|±0)$/);
    const lostLook = await look(p);
    assert.deepEqual(lostLook.lines, ['기절했다']); // 부제 = 진 까닭 한 줄 (14:4x) — 대사는 10/17 부터 따로 된 줄(#menuFoeLine · 프로필 오른쪽)
    const foeBlock = await p.evaluate(() => ({ shown: !document.getElementById('menuFoe').hidden, src: document.getElementById('menuFoeImg').getAttribute('src'), quote: document.getElementById('menuFoeLine').hidden ? null : document.getElementById('menuFoeQuote').textContent }));
    const foeCh = Object.values(CHARACTERS_BY_ID).find((c) => c.name === foeName), said = foeBlock.quote;
    assert.equal(foeBlock.shown, true); assert.match(foeBlock.src, /^ui\/portraits\/[a-z_]+\.webp$/); assert.match(said, /^“[^“”]+”$/);
    assert.ok([...(foeCh?.lines?.win ?? []), foeCh?.taunt].includes(said.slice(1, -1)), `${foeName}: ${said}`); // 그 상대의 승리 대사 하나
    assert.ok(!fightShown.includes(said), `fight screen showed ${fightShown}`); // 싸움 화면엔 안 뜸 (10/18 01:4x)
    assert.equal(lostLook.lines.length, wonLook.lines.length);
    assert.equal(lostLook.color, wonLook.color); assert.deepEqual(lostLook.icons, ['coin-icon']); assert.ok(lostLook.loaded && lostLook.hidden); // 잃어도 같은 색 · 같은 금화 그림
    assert.ok(Math.abs(lostLook.gap - lostLook.line) < 0.6, JSON.stringify(lostLook));
    await shot(p, 'result-loss');
    await p.locator('#btnStart').click(); await pick(p, 0);
    assert.equal(await p.evaluate(() => game.stage.id), stage1); // 진 판은 넘어가지 않는다 — 같은 무대
    // 정지 창의 설정 줄은 그대로 (결과 창에서만 뺀다)
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    assert.equal((await menu(p)).fps, true);
    await p.locator('#btnResume').click();
    checks.push({ said, foe: foeBlock.src, check: 'loss popup: no foe line on the fight screen (10/18) · 패배 · cause line + foe profile with one of its win lines to its right · 금화 −N in the same accent color with the coin icon after one blank line · no settings row · 다시 겨루기 (same stage) + 대기실; the pause menu keeps the settings row', reward: lost.reward, look: lostLook });
    await c.close();
  }
  // ③ 테스트 경로 · 주소 판 — 메뉴 그대로
  for (const [name, url] of [['test route', '/?test=1&weapon=longsword&stage=castle&foe=isolde'], ['URL fight', '/?weapon=longsword&stage=castle&foe=default']]) {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await p.goto(base + url, { waitUntil: 'networkidle' }); await p.waitForFunction(() => window.game?.player, null, { timeout: 60000 });
    assert.equal(await p.locator('#gameEntrance').count(), 0);
    await p.locator('#btnStart').click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 });
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    const paused = await menu(p);
    assert.equal(paused.lobby, false); assert.equal(paused.fps, true);
    await p.locator('#btnResume').click();
    await end(p, 'enemy');
    const won = await menu(p);
    assert.equal(won.lobby, false); assert.equal(won.fps, true); assert.equal(won.reward, null);
    checks.push({ check: `${name}: no 대기실 in the pause or result menu; the result keeps its settings row`, paused, won });
    await c.close();
  }
  // ④ 대기실 캐릭터 (10/17 22:1x 사장님 '캐릭터 미리보기를 없애고 정사각형의 프로필 사진 들어갈 자리' — 전: 돌림판 3D 미리보기 · 끌기 180° · 튕김 · 막는 각 없음 · Home)
  //  이제: 끌기 안내 없음 · 돌림판 없음 · 정사각 프로필 그림(플레이어 low)이 뜨고 출발 단추 위 · 끌어도 아무 일 없음(판 몸 그대로)
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true, isMobile: true }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    assert.equal(await lobby(p, '/'), 'draw');
    assert.ok(!/드래그/.test(await inRoot(p, `return root.querySelector('.lobby').textContent`)), 'drag hint text is gone');
    assert.equal(await inRoot(p, `return root.querySelectorAll('.rotate-hint, #characterView, .character-view canvas').length`), 0);
    const pf = await inRoot(p, `const f=root.getElementById('lobbyPortrait'),i=f.querySelector('img'),r=f.getBoundingClientRect(),d=root.getElementById('lobbyDepart').getBoundingClientRect();return {id:f.dataset.portrait,src:i.getAttribute('src'),w:i.naturalWidth,box:[r.width,r.height],gap:d.top-r.bottom}`);
    assert.deepEqual([pf.id, pf.src, pf.w], ['player', 'ui/portraits/player.webp', 768], JSON.stringify(pf));
    assert.ok(Math.abs(pf.box[0] - pf.box[1]) < 0.5 && pf.gap >= 0, JSON.stringify(pf));
    const bodies = await p.evaluate(() => game.player.meshes.map(({ rb }) => ({ p: rb.translation(), q: rb.rotation() })));
    const box = await p.locator('#lobbyPortrait').boundingBox(), cdp = await c.newCDPSession(p), y = box.y + box.height * 0.5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width * 0.2, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + box.width * 0.7, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.deepEqual(await p.evaluate(() => game.player.meshes.map(({ rb }) => ({ p: rb.translation(), q: rb.rotation() }))), bodies);
    await shot(p, 'lobby-portrait');
    checks.push({ check: 'lobby character: no drag hint, no turntable; square player profile picture (original reduced to 768²) above the departure button; dragging it changes nothing', pf });
    await c.close();
  }
  // ⑤ 대기실 무기 = 싸움 무기 (전: 대기실 3D 몸 ↔ 판의 플레이어 손목 · 칼끝 · 칼날 축 — 10/17 대기실 몸이 없어져 장착한 무기로 싸우는지만 본다)
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    assert.equal(await lobby(p, '/?title=1&cards=longsword,rapier'), 'draw');
    await p.locator('[data-weapon=tree_branch]').click(); await p.locator('#equipItem').click();
    await depart(p);
    assert.equal(await p.evaluate(() => [game.state, game.player.weapon.id].join()), 'fight,tree_branch');
    checks.push({ check: 'lobby weapon = fight weapon: the branch equipped in the lobby is the weapon of the journey fight (no card draw)' });
    await c.close();
  }
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/ui_fix.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${checks.length} ui-fix checks; errors ${errors.length}`);
