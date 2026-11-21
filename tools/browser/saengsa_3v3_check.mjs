// 생사전 3:3 한 바퀴 (사장님 11/20 '생사전에서 3:3 쓸게.' — config SAENGSA.entrantsMax 3 · 기록 docs/strike/many_fighters_2026-11-20.md §8)
//  시험 페이지 빌드(/saengsa/ — 저장 가르기 · 시간 제한 없음)를 휴대폰 가로 화면(844 × 390 · 터치)으로 띄우고 playwright 시계로 빨리 돌린다 (틀은 saengsa_engine_e2e.mjs):
//   ① 신청(나 · 무명 검객 둘) → 첫 경기 화면 · 상대끼리 16 강 경기는 빠른 셈으로 끝남 — 그 결과의 나선 사람 수(셋 대 셋인가)
//   ② 무기 배정 → 세 사람 모두 고름(고르기 글 · 전투 입장 단추) → 실제 3:3 판: 싸움꾼 여섯 · 머리 위 체력 칸 · 화면 밖 화살표 · 상대 머리 위 세모
//      (내 몸은 서 있기만 — 동료 · 상대 AI 가 판을 끝냄)
//   ③ 판 끝 → 생사전 결과 화면(승리 · 패배 글) · 저장된 결과(엔진 · 나선 사람 셋 대 셋 · 여섯의 체력 · 부상) · 대진표로 · 페이지 오류 0
//  빌드: npx vite build --config tools/saengsa_page/vite.config.mjs --base=./ --outDir <site>/saengsa --emptyOutDir
//  띄우기: python3 -m http.server <port> --directory <site>  →  node tools/browser/saengsa_3v3_check.mjs http://127.0.0.1:<port> <사진 폴더>
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = (process.argv[2] || 'http://127.0.0.1:5392').replace(/\/$/, ''), out = process.argv[3] || 'dist/saengsa_3v3';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
await ctx.route('https://*.supabase.co/**', (route) => route.abort());
const p = await ctx.newPage();
const errors = [], log = [], saved = [];
const IGNORED = /deprecated parameters for the initialization function/;
p.on('pageerror', (e) => errors.push(String(e.stack || e).split('\n').slice(0, 3).join(' | ')));
p.on('console', (m) => { if (m.type() === 'error' && !IGNORED.test(m.text())) errors.push(m.text()); });
await p.clock.install({ time: new Date('2026-11-20T23:00:00+09:00') });
const run = (ms) => p.clock.runFor(ms);
const until = async (fn, step = 100, max = 600) => { for (let i = 0; i < max; i++) { if (await p.evaluate(fn)) return true; await run(step); } return false; };
const inRoot = (body) => p.evaluate(new Function(`const root=document.querySelector('#gameEntrance').shadowRoot;${body}`));
const tap = async (sel) => { await p.locator(sel).first().waitFor({ state: 'visible', timeout: 20000 }); await p.locator(sel).first().tap(); await run(60); };
const render = (on) => p.evaluate((v) => { if (window.game?.renderCap) window.game.renderCap.tick = () => v; }, on);
const shot = async (name, fight = false) => { if (fight) { await render(true); await run(80); } else await run(250); const path = `${out}/${name}.png`; await p.screenshot({ path }); saved.push(path); if (fight) await render(false); };
const save = () => p.evaluate(() => JSON.parse(localStorage.getItem('stillness.saengsa.v1')));
/** 판 모습: 싸움꾼 · 머리 위 체력 칸 · 화면 밖 화살표 · 머리 위 세모 */
const look = () => p.evaluate(() => {
  const R = window.game.teamRun, hud = document.getElementById('teamHud');
  const vis = (sel) => [...document.querySelectorAll(sel)].filter((e) => !e.hidden).length;
  const arrows = (kind) => (hud ? [...hud.querySelectorAll(`.th-arrow[data-kind="${kind}"]`)].filter((a) => a.style.display !== 'none').length : 0);
  return {
    state: window.game.state, over: !!R?.M.over, winner: R?.M.winner ?? null, sim: +window.game.stats.simTime.toFixed(1), human: R?.human?.index ?? null,
    n: window.game.fighters.length, teams: window.game.fighters.map((f) => f.team).join(''), alive: window.game.fighters.map((f) => (f.alive ? 1 : 0)).join(''),
    names: window.game.fighters.map((f) => `${f.shortName ?? f.name}/${f.weapon.id}`),
    hp: vis('#staminaHud .hp-cells'), stamina: vis('#staminaHud .stamina-bar'), edge: arrows('edge'), head: arrows('head'),
  };
});

try {
  await p.goto(`${base}/saengsa/`, { waitUntil: 'domcontentloaded' });
  if (!(await until(() => !!document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('saengsaHost')?.offsetParent, 100, 1500))) throw new Error('대기실 생사전 칸이 안 뜸');
  for (let i = 0; i < 4; i++) {
    const id = await inRoot(`const d=[...root.querySelectorAll('dialog[open]')][0];return d?d.querySelector('.dialog-actions button')?.id??null:null;`);
    if (!id) break;
    await tap(`#${id}`);
  }
  // ① 신청 (동료 = 무명 검객 둘) → 첫 경기 화면이 곧바로 (11/12 바로 시작)
  await tap('.sg-slot[data-slot="1"]'); await tap('.sg-pick[data-id="nameless"]'); await tap('.sg-pick[data-id="nameless"]'); await tap('#sgPickOk');
  await tap('#saengsaEnter');
  await until(() => !!document.querySelector('#gameEntrance').shadowRoot.querySelector('.sg-m[data-state="ready"]'), 100, 300);
  if (await inRoot(`return !root.getElementById('sgMatch').hidden;`)) await tap('#sgMatchBack');
  await shot('s1_bracket');
  const s0 = await save();
  const quick = s0.current.matches.filter((m) => m.result?.by === 'quick');
  log.push({ step: 'quick', results: quick.length, entrants: quick.map((m) => `${m.result.entrants.a.length}:${m.result.entrants.b.length}`).join(' '), deaths: quick.reduce((n, m) => n + Object.values(m.result.fighters).filter((f) => !f.alive).length, 0) });
  // ② 내 경기: 무기 배정 → 셋 모두 고름
  const m1 = await inRoot(`return root.querySelector('.sg-m[data-state="ready"]').dataset.match;`);
  await tap(`.sg-m[data-match="${m1}"]`);
  await tap('#sgArmBtn');
  for (const [slot, w] of [[0, 'longsword'], [1, 'rapier'], [2, 'uchigatana']]) await tap(`#sgArmRows .sg-chip-btn[data-slot="${slot}"][data-weapon="${w}"]`);
  await tap('#sgArmOk');
  const pickUi = [];
  for (const k of ['0-0', '0-1', '0-2']) {
    await tap(`button.sg-card[data-key="${k}"]`);
    pickUi.push(await inRoot(`return { picked: root.querySelectorAll('.sg-card[aria-pressed="true"]').length, fight: !root.getElementById('sgFight').disabled, hint: root.getElementById('sgHint').textContent };`));
  }
  log.push({ step: 'pick', pickUi });
  await shot('s2_pick_three');
  await tap('#sgFight');
  if (!(await until(() => window.game?.state === 'fight' && !!window.game.teamRun, 50, 800))) throw new Error('판이 서지 않음');
  await render(false);
  await run(1500);
  const start = await look();
  await shot('s3_fight_start', true);
  let L = start, mid = false, maxEdge = start.edge, maxHead = start.head, maxHp = start.hp;
  while (!L.over && L.sim < 300) {
    await run(2000);
    L = await look();
    maxEdge = Math.max(maxEdge, L.edge); maxHead = Math.max(maxHead, L.head); maxHp = Math.max(maxHp, L.hp);
    if (!mid && L.sim > 14) { mid = true; await shot('s4_fight_mid', true); }
  }
  if (L.over) await shot('s5_fight_end', true);
  log.push({ step: 'fight', start, end: L, maxEdge, maxHead, maxHp });
  // ③ 생사전 결과 화면 · 저장
  await until(() => window.game?.state !== 'fight', 250, 80);
  const doneShown = await until(() => !document.querySelector('#gameEntrance').shadowRoot.getElementById('sgDone').hidden, 100, 150);
  await shot('s6_result');
  const outcome = await inRoot(`return { big: root.getElementById('sgOutBig').textContent, line: root.getElementById('sgOutLine').textContent, done: !root.getElementById('sgDone').hidden, next: !root.getElementById('sgNextMatch')?.hidden };`);
  const s1 = await save();
  const r = s1.current.matches.find((m) => m.id === m1).result;
  log.push({ step: 'result', doneShown, outcome, by: r?.by, winner: r?.winner, entrants: r && `${r.entrants.a.length}:${r.entrants.b.length}`,
    fighters: r && Object.fromEntries(Object.entries(r.fighters).map(([k, v]) => [k, `${v.hp}/${v.alive ? '삶' : '죽음'}/${v.injuries.map((i) => `${i.part}${i.sev}`).join(',')}`])) });
  await tap('#sgDone');
  await shot('s7_bracket_after');
  const ok = log[0].results >= 7 && log[0].entrants.split(' ').every((x) => x === '3:3') && pickUi[2].fight && start.n === 6 && start.human === 0 && start.teams === '010101'
    && L.over && doneShown && r?.by === 'engine' && r.entrants.a.length === 3 && r.entrants.b.length === 3 && Object.keys(r.fighters).length === 6 && maxHp >= 3 && maxEdge >= 1 && maxHead >= 1;
  log.push({ step: 'verdict', ok });
} catch (e) {
  errors.push('harness: ' + e.message.split('\n')[0]);
}
await browser.close();
fs.writeFileSync(`${out}/saengsa_3v3.json`, JSON.stringify({ saved, log, errors }, null, 1));
for (const l of log) console.log(JSON.stringify(l));
console.log(errors.length ? errors.join('\n') : 'no page errors');
process.exit(errors.length || !log.at(-1)?.ok ? 1 : 0);
