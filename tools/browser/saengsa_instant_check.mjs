// 생사전 바로 시작 점검 · 사진 (사장님 11/12 — docs/design/saengsa_instant_2026-11-12.md): 폰 크기 844 × 390 · 390 × 844 마다 본판 빌드에서
//  ① 밤 10:30(?saengsaNow=2026-11-12T22:30) 대기실 생사전 칸(신청 받는 중) → '생사전 입장' = 신청 + 내 첫 경기 화면이 곧바로 열림 → 출전 고름 → 전투 입장
//     → (상대 쓰러짐을 넣어 결과를 빨리 냄 — 승패 균형 셈이 아님) 결과 · '다음 경기'(곧바로) → 둘째 경기 화면 → 대진표
//  ② 같은 저장으로 새벽 3:00 다시 열기(새로고침) — 대회 진행 중 · '생사전 입장'으로 이어 함 · 대진표에 내 경기 '입장 가능'
//  ③ 새 저장(대회 없음) 새벽 3:00 — '생사전 입장' 꺼짐 · 일정 알약 '다음 신청 · 밤 10시' · 안내 '신청은 밤 10시부터 새벽 2시까지입니다.'
//  세로 폰(390 × 844 터치)은 대기실 · 생사전 화면을 '폰을 가로로 돌려 주세요'(#rotate)가 덮는다(사장님 10/16 — 가로만) — 글 · 상태 점검은 그대로 하고, 칸 꼴은 터치 없는 390 × 844 로도 찍는다
//  빌드 → node node_modules/vite/bin/vite.js preview --port 4792 → PW_MODULE=<playwright index.mjs> node tools/browser/saengsa_instant_check.mjs http://127.0.0.1:4792 <사진 폴더>
const { chromium } = await import(process.env.PW_MODULE || 'playwright');
import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = (process.argv[2] || 'http://127.0.0.1:4792').replace(/\/$/, ''), out = process.argv[3] || 'dist/saengsa_instant_shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const IGNORED = /deprecated parameters for the initialization function/;
const SIZES = [['844x390', 844, 390, true], ['390x844', 390, 844, true], ['390x844_notouch', 390, 844, false]];
const FIXTURE = { weapons: ['longsword', 'rapier', 'uchigatana', 'kriegsmesser', 'hwando'], draft: { companions: ['nameless', 'nameless'], weapons: ['longsword', 'rapier', 'uchigatana'] } };
const errors = [], checks = [], saved = [];
const inRoot = (p, body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance').shadowRoot;${body}`));
const text = (p, id) => inRoot(p, `const e=root.getElementById('${id}');return e?e.textContent.trim():null;`);
const hidden = (p, id) => inRoot(p, `const e=root.getElementById('${id}');return !e||e.hidden||!e.getClientRects().length;`);
// 화면 밖으로 넘친 단추 · 칸 (덮개 Shadow root 안)
const OVER = `const W=innerWidth,H=innerHeight,out=[];for(const sel of ['#saengsaEnter','#sgLook','.sg-state','.sg-note','.sg-mf .primary','.sg-mf .secondary','#sgNextMatch','#sgDone','.sg-board']){for(const e of root.querySelectorAll(sel)){const r=e.getBoundingClientRect();if(!r.width||!r.height)continue;if(r.right>W+1||r.left<-1||r.top<-1)out.push(sel+' '+[r.left,r.top,r.right,r.bottom].map(Math.round).join(','));}}return out;`;

async function session(size, width, height, { qualified, touch }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: touch, hasTouch: touch, timezoneId: 'Asia/Seoul' });
  await ctx.route('https://*.supabase.co/**', (route) => route.abort());
  if (qualified) await ctx.addInitScript((f) => { // 정복자 호칭 · 무기 다섯 · 금화 (입장 조건 — 사장님 10/29 18:2x) · 고른 팀(무명 검객 둘 · 무기 배정)
    if (!localStorage.getItem('stillness.lobby.progress.v1')) localStorage.setItem('stillness.lobby.progress.v1', JSON.stringify({ version: 1, coins: 1000, acquisitions: f.weapons.map((id) => ({ receipt: `weapon:${id}`, kind: 'item' })), titles: [{ event: 'conqueror', name: '정복자', seen: true }], title: '정복자' }));
    if (!localStorage.getItem('stillness.saengsa.v1')) localStorage.setItem('stillness.saengsa.v1', JSON.stringify({ version: 1, current: null, draft: f.draft }));
  }, FIXTURE);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(`${size}: ${e}`));
  p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(`${size}: ${m.text()}`); });
  const tap = async (sel) => { // 덮개 Shadow root 안 단추 — 손가락 탭이 보이지 않음으로 막히는 때(헤드리스 터치)가 있어 DOM 누름으로 대신
    try { if (touch) await p.locator(sel).first().tap({ timeout: 3000 }); else await p.locator(sel).first().click({ timeout: 3000 }); }
    catch { const ok = await p.evaluate((q) => { const e = document.querySelector('#gameEntrance')?.shadowRoot?.querySelector(q); if (!e) return false; e.click(); return true; }, sel); assert.ok(ok, `${sel} 없음`); }
    await p.waitForTimeout(150);
  };
  const shot = async (name) => {
    await p.waitForTimeout(300);
    const path = `${out}/${name}_${size}.png`;
    await p.screenshot({ path });
    saved.push(path);
    const over = await inRoot(p, OVER);
    assert.deepEqual(over, [], `${size} ${name} 화면 밖`);
  };
  const toLobby = async (now) => {
    await p.goto(`${base}/?nosw=1&saengsaNow=${now}`, { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => { const r = document.querySelector('#gameEntrance')?.shadowRoot; return r?.getElementById('noticeDialog')?.open || r?.getElementById('entrance')?.dataset.phase === 'ready'; }, null, { timeout: 90000 });
    if (await inRoot(p, `return root.getElementById('noticeDialog').open;`)) await tap('#confirmNotices');
    await p.waitForFunction(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('enterLobby')?.disabled, null, { timeout: 90000 });
    await tap('#enterLobby');
    await p.waitForFunction(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('tabEvent'), null, { timeout: 90000 });
    await p.evaluate(() => document.fonts.ready);
    for (let i = 0; i < 5; i++) { // 처음 들어올 때의 알림 창을 닫는다
      const open = await inRoot(p, `const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`);
      if (!open) break;
      await tap(`#${open}`);
    }
    await tap('#tabEvent');
  };
  return { ctx, p, tap, shot, toLobby };
}

for (const [size, width, height, touch] of SIZES.filter(([n]) => !process.env.ONLY || process.env.ONLY.split(',').includes(n))) { // ONLY=844x390 — 한 크기만
  // ① 밤 10:30 — 열린 때 · 들어가면 곧장 첫 경기
  const { ctx, p, tap, shot, toLobby } = await session(size, width, height, { qualified: true, touch });
  await toLobby('2026-11-12T22:30');
  assert.equal(await text(p, 'saengsaState'), '신청 받는 중 · 새벽 2시까지');
  assert.equal(await text(p, 'sgNote'), '입장하면 이 팀으로 신청하고 곧바로 첫 경기를 치릅니다.');
  assert.equal(await inRoot(p, `return root.getElementById('saengsaEnter').disabled;`), false);
  await shot('2230_panel_open');
  await tap('#saengsaEnter');
  await p.waitForFunction(() => { const r = document.querySelector('#gameEntrance')?.shadowRoot; const m = r?.getElementById('sgMatch'); return m && !m.hidden && !r.getElementById('sgFight').hidden; }, null, { timeout: 30000 });
  const t0 = await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.saengsa.v1')).current);
  assert.equal(t0.day, '2026-11-13');
  assert.equal(t0.matches.filter((m) => m.result).length, 7, '16강 상대끼리 일곱은 신청 때 끝남');
  assert.equal(await text(p, 'sgMatchTitle'), '16강', '시각 없음');
  checks.push(`${size}: 22:30 입장 = 신청 + 내 16강 경기 화면이 곧바로 (상대끼리 7 경기 끝)`);
  await tap('button.sg-card[data-key="0-0"]');
  await tap('button.sg-card[data-key="0-1"]');
  await shot('2230_first_match');
  // 전투 입장 → 상대 쓰러짐을 넣어 결과를 빨리 (결과 · 저장 · 다음 경기 잇기 점검 — 승패 균형 셈 아님)
  await p.evaluate(() => { if (window.game?.renderCap) window.game.renderCap.tick = () => false; });
  await tap('#sgFight');
  await p.waitForFunction(() => window.game?.state === 'fight' && !!window.game.teamRun, null, { timeout: 60000 });
  await p.waitForTimeout(1500);
  await p.evaluate(() => { const side = window.game.teamRun.human?.team ?? 0; for (const f of window.game.fighters) if (f.team !== side) { f.canDie = true; f.setState('dead'); } });
  await p.waitForFunction(() => { const r = document.querySelector('#gameEntrance')?.shadowRoot; const d = r?.getElementById('sgDone'); return d && !d.hidden; }, null, { timeout: 60000 });
  await p.evaluate(() => { if (window.game?.renderCap) window.game.renderCap.tick = () => true; });
  assert.equal(await text(p, 'sgOutBig'), '승리', `${size} 결과 ${await text(p, 'sgOutLine')} · ${JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.saengsa.v1')).current.matches.filter((m) => m.result?.by === 'engine').map((m) => m.result.fighters)))}`);
  assert.equal(await hidden(p, 'sgNextMatch'), false, "결과 뒤 '다음 경기'");
  assert.equal(await text(p, 'sgNextMatch'), '다음 경기');
  await shot('2230_result_next');
  await tap('#sgNextMatch');
  await p.waitForFunction(() => { const r = document.querySelector('#gameEntrance')?.shadowRoot; return !r.getElementById('sgMatch').hidden && !r.getElementById('sgFight').hidden; }, null, { timeout: 10000 });
  assert.equal(await text(p, 'sgMatchTitle'), '8강');
  checks.push(`${size}: 결과 뒤 '다음 경기' → 8강 경기 화면 곧바로 (쉬는 시간 없음)`);
  await shot('2230_second_match');
  await tap('#sgMatchBack');
  assert.equal(await inRoot(p, `return root.querySelectorAll('.sg-m[data-state="ready"]').length;`), 1);
  await shot('2230_bracket');
  // ② 새벽 3:00 — 같은 저장 다시 열기: 진행 중인 대회를 이어 함
  await toLobby('2026-11-13T03:00');
  assert.equal(await text(p, 'saengsaState'), '대회 진행 중');
  assert.equal(await inRoot(p, `return root.getElementById('saengsaEnter').disabled;`), false);
  assert.equal(await text(p, 'sgNote'), '내 경기 · 8강 · 지금 싸울 수 있습니다.');
  await shot('0300_panel_running');
  await tap('#saengsaEnter');
  await p.waitForFunction(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.querySelector('.sg-m[data-state="ready"]'), null, { timeout: 30000 });
  assert.equal(await hidden(p, 'sgMatch'), true, '이어 하기는 대진표부터 (막 신청한 때만 경기 화면)');
  await shot('0300_bracket_continue');
  const t1 = await p.evaluate(() => JSON.parse(localStorage.getItem('stillness.saengsa.v1')).current);
  assert.equal(t1.matches.find((m) => m.round === 0 && (m.a === 0 || m.b === 0)).result?.by, 'engine', '22:30 에 싸운 내 16강 결과가 저장에 그대로');
  assert.equal(t1.matches.filter((m) => m.result).length, 8 + 3, '16강 여덟 · 8강 상대끼리 셋');
  checks.push(`${size}: 03:00 다시 열기 — 대회 진행 중 · 입장으로 이어 함 · 8강 내 경기 입장 가능`);
  await ctx.close();
  // ③ 새벽 3:00 — 대회 없는 새 저장: 닫힘
  const c = await session(size, width, height, { qualified: true, touch });
  await c.toLobby('2026-11-13T03:00');
  assert.equal(await text(c.p, 'saengsaState'), '다음 신청 · 밤 10시');
  assert.equal(await text(c.p, 'sgNote'), '신청은 밤 10시부터 새벽 2시까지입니다.');
  assert.equal(await inRoot(c.p, `return root.getElementById('saengsaEnter').disabled;`), true);
  assert.equal(await hidden(c.p, 'sgLook'), true);
  await c.shot('0300_panel_closed');
  checks.push(`${size}: 03:00 대회 없음 — 생사전 입장 꺼짐 · 다음 신청 밤 10시`);
  await c.ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/check.json`, JSON.stringify({ passed: errors.length === 0, checks, errors, saved }, null, 1));
console.log(JSON.stringify({ checks, errors, saved }, null, 1));
assert.deepEqual(errors, []);
