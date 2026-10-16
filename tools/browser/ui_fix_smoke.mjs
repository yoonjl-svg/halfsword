// 화면 고침 실제 흐름 점검 (사장님 10/16 08:3x · 08:4x — docs/import/ui_fix_2026-10-16.md §3~§5) — 배포판 + 미리 보기 서버, 인증 서버는 막음(부르면 실패)
//  ① 일시정지 → 대기실 (첫 화면·대기실 여정): 정지 창 '대기실' · 설정 줄 그대로 → 대기실('여정 이어가기') · 금화 · 대면 결과 · 이어하기 지점 그대로(사장님 08:4x '깎지 마')
//     → 다시 출발 = 같은 무대 · 같은 무기 (카드 없이)
//  ② 결과 창 — 이김: '승리' · '금화 +N' · 설정 줄 없음 · '다음 여정' · '대기실' → 대기실 금화 = 전 + N → 출발 = 다음 무대
//     짐: '패배' · '금화 −N'(또는 ±0) · '다시 겨루기'(같은 무대 — 진 판은 넘어가지 않음) · '대기실'
//  ③ 테스트 경로 · 주소 판: 정지 · 결과 창에 '대기실' 없음 · 결과 창 설정 줄 그대로 (메뉴 그대로)
//  ④ 대기실 캐릭터: '드래그하여 회전' 없음 · 천천히 반 칸 끌면 180°(멈췄다 놓으면 관성 없음) · 튕기면 더 돌다 섬 · 선 뒤로는 그리지 않음 · 막는 각 없음(몇 바퀴든) · Home = 가까운 정면
//  npm run build && npx vite preview --port 5230 →  node tools/browser/ui_fix_smoke.mjs http://127.0.0.1:5230 /tmp/<빈 폴더>
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
async function lobby(p, url) {
  if (url != null) await p.goto(base + url, { waitUntil: 'networkidle' });
  await title(p);
  await p.locator('#newJourney').click(); await p.locator('#characterView canvas').waitFor({ timeout: 20000 });
}
const inLobby = (p) => p.waitForFunction(() => !!document.querySelector('#gameEntrance')?.shadowRoot.querySelector('.lobby #characterView canvas') && document.documentElement.hasAttribute('data-start-open'), null, { timeout: 30000 });
const pick = async (p, i = 0) => { await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 30000 }); await p.locator(`#draw .wcard[data-i="${i}"]`).click(); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 30000 }); };
const depart = async (p) => { await p.locator('#lobbyDepart').click(); await p.waitForFunction(() => !document.getElementById('gameEntrance') && ['draw', 'fight'].includes(game.state), null, { timeout: 60000 }); };
const end = async (p, who) => { await p.evaluate((w) => game[w].die('기절', true), who); await p.waitForFunction(() => game.state === 'paused' && document.getElementById('menu').classList.contains('show'), null, { timeout: 40000 }); };
const menu = (p) => p.evaluate(() => {
  const vis = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && getComputedStyle(el).display !== 'none'; };
  return { title: document.getElementById('menuTitle').textContent, start: document.getElementById('btnStart').textContent, resume: vis('btnResume'), lobby: vis('btnLobby'), lobbyText: document.getElementById('btnLobby').textContent, fps: vis('fpsRow'), reward: vis('menuReward') ? document.getElementById('menuReward').textContent : null, test: vis('btnTestPick') };
});
const store = (p) => p.evaluate(() => ({ coins: JSON.parse(localStorage.getItem('stillness.lobby.progress.v1'))?.coins ?? 100, profile: localStorage.getItem('stillness.lobby.profile.v1'), checkpoint: localStorage.getItem('stillness.journey.checkpoint.v1') }));
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });

try {
  // ①② 첫 화면·대기실 여정
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await lobby(p, '/?title=1&cards=longsword,rapier');
    await depart(p); await pick(p, 0);
    const stage0 = await p.evaluate(() => game.stage.id);
    // ① 일시정지 → 대기실
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    const paused = await menu(p);
    assert.deepEqual({ ...paused, reward: undefined }, { title: '일시정지', start: '처음부터 다시', resume: true, lobby: true, lobbyText: '대기실', fps: true, reward: undefined, test: false });
    await shot(p, 'pause-journey');
    const before = await store(p);
    await p.locator('#btnLobby').click(); await inLobby(p);
    assert.equal(await p.evaluate(() => game.state), 'menu');
    assert.equal(await inRoot(p, `return root.getElementById('lobbyDepart').textContent`), '여정 이어가기');
    assert.deepEqual(await store(p), before); // 금화 · 대면 결과 · 이어하기 지점 그대로
    assert.equal(await inRoot(p, `return root.getElementById('lobbyCoins').textContent`), String(before.coins));
    await p.waitForTimeout(400); await shot(p, 'lobby-after-pause');
    await depart(p);
    assert.equal(await p.evaluate(() => game.state), 'fight'); // 고른 무기로 그 무대 시작부터 — 카드 없이
    assert.deepEqual(await p.evaluate(() => [game.stage.id, game.player.weapon.id]), [stage0, 'longsword']);
    checks.push({ check: 'pause → 대기실: menu has 대기실 + settings row; lobby opens as 여정 이어가기; coins · duel record · checkpoint unchanged; departing resumes the same stage with the same weapon', stage0, coins: before.coins });
    // ② 이긴 판 결과 창
    await end(p, 'enemy');
    const won = await menu(p);
    assert.equal(won.title, '승리'); assert.equal(won.start, '다음 여정'); assert.equal(won.lobby, true); assert.equal(won.lobbyText, '대기실'); assert.equal(won.fps, false); assert.equal(won.resume, false);
    assert.match(won.reward, /^금화 \+(\d+)$/);
    const gain = Number(won.reward.match(/\+(\d+)/)[1]);
    assert.ok(gain >= 5 && gain <= 15, won.reward);
    await shot(p, 'result-win');
    await p.locator('#btnLobby').click(); await inLobby(p);
    assert.equal(await inRoot(p, `return root.getElementById('lobbyCoins').textContent`), String(before.coins + gain));
    assert.equal(JSON.parse((await store(p)).checkpoint).stage !== stage0, true); // 이긴 순간 다음 무대로 적혀 있다
    await depart(p); await pick(p, 0);
    const stage1 = await p.evaluate(() => game.stage.id);
    assert.notEqual(stage1, stage0);
    checks.push({ check: 'win popup: 승리 · 금화 +N · no settings row · 다음 여정 + 대기실; 대기실 shows the new coins; departing opens the next stage', reward: won.reward, stage1 });
    // ② 진 판 결과 창
    await end(p, 'player');
    const lost = await menu(p);
    assert.equal(lost.title, '패배'); assert.equal(lost.start, '다시 겨루기'); assert.equal(lost.lobby, true); assert.equal(lost.fps, false);
    assert.match(lost.reward, /^금화 (−[1-5]|±0)$/);
    await shot(p, 'result-loss');
    await p.locator('#btnStart').click(); await pick(p, 0);
    assert.equal(await p.evaluate(() => game.stage.id), stage1); // 진 판은 넘어가지 않는다 — 같은 무대
    // 정지 창의 설정 줄은 그대로 (결과 창에서만 뺀다)
    await p.locator('#btnPause').click(); await p.waitForFunction(() => game.state === 'paused', null, { timeout: 10000 });
    assert.equal((await menu(p)).fps, true);
    await p.locator('#btnResume').click();
    checks.push({ check: 'loss popup: 패배 · 금화 −N · no settings row · 다시 겨루기 (same stage) + 대기실; the pause menu keeps the settings row', reward: lost.reward });
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
  // ④ 대기실 캐릭터 돌림판
  {
    const c = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, reducedMotion: 'reduce', hasTouch: true, isMobile: true }); await noAuth(c);
    const p = await c.newPage(); watch(p);
    await lobby(p, '/');
    assert.ok(!/드래그/.test(await inRoot(p, `return root.querySelector('.lobby').textContent`)), 'drag hint text is gone');
    assert.equal(await inRoot(p, `return root.querySelectorAll('.rotate-hint').length`), 0);
    const view = p.locator('#characterView'), box = await view.boundingBox(), cdp = await c.newCDPSession(p);
    const attr = async (k) => view.getAttribute(`data-${k}`);
    const rest = () => p.waitForFunction(() => document.querySelector('#gameEntrance').shadowRoot.getElementById('characterView').dataset.turning === 'false', null, { timeout: 10000 });
    const y = box.y + box.height * 0.5;
    const touch = async (xs, gap, hold) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: xs[0], y }] });
      for (const x of xs.slice(1)) { await p.waitForTimeout(gap); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] }); }
      if (hold) await p.waitForTimeout(hold);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const x0 = box.x + box.width * 0.2, w = box.width;
    // 천천히 반 칸 · 멈췄다 놓음 → 180° 그대로 (관성 없음)
    await touch([0, 0.1, 0.2, 0.3, 0.4, 0.5].map((f) => x0 + f * w), 40, 250); await rest();
    const slow = Number(await attr('angle'));
    assert.ok(Math.abs(slow - 180) <= 3, `slow half drag → ${slow}`);
    // 튕김 → 손가락이 간 만큼(+108°)보다 더 돌다 선다 · 선 뒤로는 그리지 않음
    const f0 = Number(await attr('frames'));
    await touch([0, 0.1, 0.2, 0.3].map((f) => x0 + f * w), 16, 0);
    await rest();
    const flick = Number(await attr('angle')), f1 = Number(await attr('frames'));
    assert.ok(flick - slow > 108 + 20, `flick coasts: ${slow} → ${flick}`);
    assert.ok(f1 - f0 >= 5, `rendered while turning: ${f0} → ${f1}`);
    await p.waitForTimeout(700);
    assert.equal(Number(await attr('frames')), f1, 'no renders at rest');
    // 막는 각 없음 — 두 바퀴 더(천천히)
    const a0 = Number(await attr('angle'));
    for (let k = 0; k < 2; k++) await touch([0, 0.25, 0.5, 0.75, 1].map((f) => box.x + 0.02 * w + f * w * 0.96), 40, 250), await rest();
    const two = Number(await attr('angle'));
    assert.ok(Math.abs(two - a0 - 2 * 0.96 * 360) <= 6, `two more turns: ${a0} → ${two}`);
    // Home = 가까운 정면 (360 의 배수)
    await view.focus(); await p.keyboard.press('Home'); await rest();
    const home = Number(await attr('angle'));
    assert.equal(((home % 360) + 360) % 360, 0, `home → ${home}`);
    await shot(p, 'lobby-turntable');
    checks.push({ check: 'lobby turntable: no drag hint; slow half drag = 180° with no coast; a flick coasts and stops; no renders at rest; no clamp (two more turns); Home = nearest front', slow, flick, two, home, frames: [f0, f1] });
    await c.close();
  }
  assert.deepEqual(errors, []);
} finally {
  fs.writeFileSync(`${out}/ui_fix.json`, JSON.stringify({ checks, errors }, null, 2));
  await browser.close();
}
console.log(`PASS ${checks.length} ui-fix checks; errors ${errors.length}`);
