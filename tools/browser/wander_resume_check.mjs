// 방랑 정지 창 · 몸 상태 이어받기 점검 (사장님 10/30 01:1x '방랑과 생사전은 일시정지 후엔 재개랑 대기실로 가기만 · 이어하면 그 상황 그대로' — wander_rules.js WANDER.resumeState)
//  개발 서버(또는 빌드)를 띄우고: node tools/browser/wander_resume_check.mjs http://127.0.0.1:<port> <사진 폴더> [resume 0|1|default — default = 주소에 스위치 없음(기본 켬 · 사장님 10/30 08:2x)]
//  ① 방랑을 연 저장(30 무대 깸 · 대기실 무기 나뭇가지 — 카드 없이 바로 싸움)으로 첫 화면 → 대기실 → '방랑'
//  ② 싸움을 playwright 시계로 몇 초(내 몸은 서 있기만 — 상대가 상처를 냄) → 정지: '재대결' 없음 · '재개' · '대기실' 있음
//  ③ '대기실' → '방랑 이어가기' → 새 판 첫 모습의 피 · 상처 · 기력이 떠날 때와 같은가 (resume 1) · 처음 몸인가 (resume 0)
//  ④ 싸움 도중 새로고침 → 다시 '방랑 이어가기' → 2 초마다 적은 몸으로 서는가 (resume 1)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5393', out = process.argv[3] || 'dist/wander_resume', resume = process.argv[4] ?? 'default';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
await ctx.route('https://*.supabase.co/**', (route) => route.abort());
const p = await ctx.newPage();
const errors = [], log = [], saved = [];
const step = (m) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${m}`);
p.on('crash', () => errors.push('page crashed'));
const IGNORED = /deprecated parameters for the initialization function/;
p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
const url = `${base}/?title=1${resume === 'default' ? '' : `&wanderResume=${resume}`}`;
const run = (ms) => p.clock.runFor(ms);
const until = async (fn, step = 100, max = 600) => { for (let i = 0; i < max; i++) { if (await p.evaluate(fn)) return true; await run(step); } return false; };
const inRoot = (body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance')?.shadowRoot;${body}`));
const render = (on) => p.evaluate((v) => { if (window.game?.renderCap) window.game.renderCap.tick = () => v; }, on);
const shot = async (name, fight = false) => { if (fight) { await render(true); await run(80); } else await run(250); const path = `${out}/${name}.png`; try { await p.screenshot({ path, timeout: 20000 }); saved.push(path); } catch (e) { errors.push(`사진 ${name}: ${e.message.split('\n')[0]}`); } if (fight) await render(false); }; // 싸움 그리기가 무거우면 사진만 건너뜀
const body = (f) => ({ blood: +f.blood.toFixed(4), wounds: f.wounds.length, parts: f.wounds.map((w) => w.part).join(','), stamina: +(f.stamina?.value ?? 0).toFixed(1), broken: !!f.weaponBroken, alive: f.alive });
const bodies = () => p.evaluate(() => { const b = (f) => ({ blood: +f.blood.toFixed(4), wounds: f.wounds.length, parts: f.wounds.map((w) => w.part).join(','), stamina: +(f.stamina?.value ?? 0).toFixed(1), broken: !!f.weaponBroken, alive: f.alive }); return { state: window.game.state, player: b(window.game.player), enemy: b(window.game.enemy) }; });
void body;

async function toLobby(first) {
  if (first) {
    await p.goto(`${base}/?title=1`);
    await p.evaluate(() => {
      const stages = ['x']; void stages;
      localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, coins: 300, heads: 0, acquisitions: [], titles: [], title: '', wander: { cleared: [], unlocked: true, legacyChecked: true, noticeSeen: true, run: null } }));
      localStorage.setItem('stillness.lobby.weapon.v1', JSON.stringify({ version: 1, weapon: 'tree_branch' }));
    });
  }
  await p.goto(url, { waitUntil: 'domcontentloaded' });
  await until(() => { const r = document.querySelector('#gameEntrance')?.shadowRoot; return r?.getElementById('noticeDialog')?.open || r?.getElementById('entrance')?.dataset.phase === 'ready'; }, 100, 1500);
  if (await inRoot(`return root.getElementById('noticeDialog')?.open;`)) { await p.locator('#confirmNotices').first().tap(); await run(200); }
  await until(() => { const b = document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('enterLobby'); return b && !b.disabled; }, 100, 1500);
  await p.locator('#enterLobby').first().tap();
  await until(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('lobbyWander'), 100, 600);
  for (let i = 0; i < 5; i++) {
    const id = await inRoot(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`);
    if (!id) break;
    await p.locator(`#${id}`).first().tap();
    await run(150);
  }
}
async function enterWander(tag) {
  const label = await inRoot(`return root.getElementById('lobbyWander').textContent;`);
  for (let i = 0; i < 5; i++) { // 남은 알림 창을 닫고
    const id = await inRoot(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`);
    if (!id) break;
    await p.evaluate((x) => document.querySelector('#gameEntrance').shadowRoot.getElementById(x).click(), id);
    await run(150);
  }
  await inRoot(`root.getElementById('lobbyWander').click();`);
  for (let i = 0; i < 200; i++) { // 판이 서는 첫 순간을 잡는다 (20 ms 씩 — 첫 모습을 재려고) · 방랑 전용 상대 알림 창이면 확인
    await run(20);
    if (await p.evaluate(() => document.getElementById('encounter')?.classList.contains('show'))) await p.evaluate(() => document.getElementById('btnEncounter')?.click());
    if (await p.evaluate(() => window.game?.state === 'fight')) break;
  }
  if (!(await until(() => window.game?.state === 'fight', 100, 600))) throw new Error(`${tag}: 싸움이 안 열림`);
  await render(false);
  return label;
}

try {
  await p.clock.install({ time: new Date('2026-10-30T02:00:00+09:00') });
  step('lobby');
  await toLobby(true);
  step('enter wander');
  await enterWander('first');
  step('fighting');
  // 상대가 상처를 낼 때까지 (내 몸은 서 있기만)
  let L = await bodies();
  for (let i = 0; i < 60 && L.player.alive && L.player.wounds < 2 && L.player.blood > 0.9; i++) { await run(1000); L = await bodies(); } // 상처 둘 또는 피 0.9 밑까지 (판이 끝나기 전)
  await run(500);
  await shot('w1_fight', true); // 사진을 찍는 동안에도 싸움 시계가 조금 흐를 수 있어 먼저 찍고 잰다
  await p.evaluate(() => document.getElementById('btnPause').click());
  const leave = await bodies(); // 멈춘 몸 (정지 동안은 흐르지 않음)
  step('pause ' + JSON.stringify(leave.player));
  await run(200);
  const menu = await p.evaluate(() => ({ title: document.getElementById('menuTitle').textContent, restart: !document.getElementById('btnStart').hidden, resume: getComputedStyle(document.getElementById('btnResume')).display !== 'none', lobby: !document.getElementById('btnLobby').hidden }));
  await shot('w2_pause', true);
  await p.evaluate(() => document.getElementById('btnLobby').click());
  await run(800);
  await until(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('lobbyWander'), 100, 300);
  const saved1 = await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).wander.run?.resume ?? null);
  await shot('w3_lobby');
  step('continue');
  const label = await enterWander('continue');
  const back = await bodies();
  await shot('w4_continue', true);
  log.push({ step: 'pause → lobby → continue', resume, menu, lobbyButton: label, leave, savedPlayer: saved1 && { blood: +saved1.player.blood.toFixed(4), wounds: saved1.player.wounds.length }, back,
    same: Math.abs(back.player.blood - leave.player.blood) < 0.03 && back.player.parts === leave.player.parts && Math.abs(back.enemy.blood - leave.enemy.blood) < 0.03 && back.enemy.parts === leave.enemy.parts });
  // ④ 싸움 도중 새로고침
  await run(3000);
  const before = await bodies();
  await run(2500); // 2 초마다 적음
  const atReload = await bodies();
  const saved2 = await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.lobby.progress.v1')).wander.run?.resume ?? null);
  step('reload');
  await toLobby(false);
  await enterWander('reload');
  const after = await bodies();
  await shot('w5_after_reload', true);
  log.push({ step: 'reload mid-fight → continue', resume, before, atReload, savedPlayer: saved2 && { blood: +saved2.player.blood.toFixed(4), wounds: saved2.player.wounds.length }, after,
    sameAsSaved: !!saved2 && Math.abs(after.player.blood - saved2.player.blood) < 0.05 && after.player.wounds === saved2.player.wounds.length && after.player.parts === saved2.player.wounds.map((w) => w.part).join(',') }); // 피는 이어받은 출혈로 첫 몇 프레임에도 조금 줄어듦 (저장 사본의 wounds 는 목록)
} catch (e) {
  errors.push('harness: ' + e.message.split('\n')[0]);
}
await browser.close();
fs.writeFileSync(`${out}/wander_resume.json`, JSON.stringify({ saved, log, errors }, null, 1));
for (const l of log) console.log(JSON.stringify(l));
console.log(errors.length ? errors.join('\n') : 'no page errors');
