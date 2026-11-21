// 흐름 확인 (감사 가지 2026-11-22 N-031 고쳐 적음 — 감사의 q3_cards.mjs · q2_hitch.mjs 흐름을 옮김)
//  첫 화면(공지 → Stage) → 여정 → 카드 → 싸움 → 판 끝(목 베임 — 게임의 죽음 길) → 결과 창 '다음 여정' → 무기 카드 → 다음 무대 (기본 4번) → 진 판 → '재대결'
//  판정은 둘뿐: ① 흐름이 시간 안에 끝난다(무대가 3번 넘게 실제로 바뀜 포함) ② 페이지 오류 + 콘솔 오류 = 0.
//   값 · 글자 · 공지 수 · 무대 이름은 단언하지 않는다 (값에 묶은 확인은 3주 만에 여섯이 낡았다 — 감사 가지 보고 3에 더함).
//   판 끝은 감사와 같게 목 베임(fighter.die('목') — 싸움의 목 베기가 부르는 죽음 길)으로 내고, 그 뒤는 사람과 같은 단추 · 카드 누름
//  요약(알림용 — 판정에 안 씀): 거친 무대 · 오류 수 · 넘어갈 때마다 가장 긴 프레임 간격(단추 → 카드 / 카드 → 싸움 2 초).
//  스스로: `npm run -s build`(배포 빌드 — 개발 서버 아님) → dist 를 이 안의 작은 정적 서버로 127.0.0.1 빈 포트에 띄움 → 헤드리스 크로미움 → 둘 다 닫음
//   node tools/browser/flow_smoke.mjs [--changes=4] [--timeout=420] [--no-build] [--dpr=1] [--out=<결과 json>] [--dist=<폴더>]
//   --no-build: 이미 만든 dist 를 그대로 (같은 커밋에서 여러 번 돌릴 때) · --dpr: 화면 배율 (844×390 · 기본 1 — 헤드리스에서 2 는 두 배 넘게 느림)
//   --out: 결과 json (실패하면 같은 이름 .fail.png 도). 끝 코드 0 = 통과 · 1 = 실패 · 2 = 빌드 실패
//   플레이라이트는 /opt/node22/lib/node_modules/playwright 를 절대 경로로 부른다 (저장소 node_modules 에 없음) · 크로미움은 PW_CHROMIUM 또는 /opt/pw-browsers/chromium
//  헤드리스 소프트웨어 그래픽이라 프레임 ms 는 폰 값이 아니다 (감사 보고 2 — 견주기만).
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (name, dflt) => { const a = process.argv.find((s) => s === `--${name}` || s.startsWith(`--${name}=`)); return a == null ? dflt : a.includes('=') ? a.slice(a.indexOf('=') + 1) : true; };
const CHANGES = Math.max(3, +arg('changes', 4)); // 무대 바뀜 횟수 (3 아래로는 안 내림)
const TIMEOUT_S = +arg('timeout', 420); // 흐름 전체 제한 (넘으면 실패)
const STEP_MS = 120000; // 한 걸음 기다림 제한
const DIST = path.resolve(ROOT, arg('dist', 'dist'));
const OUT = arg('out', null);
const SETTLE_MS = 2000; // 싸움이 열린 뒤 프레임을 더 받는 시간 (감사 q3 와 같게)

// ── 1. 배포 빌드 ──
if (!arg('no-build', false)) {
  const b = spawnSync('npm', ['run', '-s', 'build'], { cwd: ROOT, encoding: 'utf8' });
  if (b.status !== 0) { console.log('FAIL build', b.status, (b.stdout + b.stderr).split('\n').slice(-12).join('\n')); process.exit(2); }
}
if (!fs.existsSync(path.join(DIST, 'index.html'))) { console.log('FAIL dist 없음:', DIST, '(--no-build 이면 먼저 npm run -s build)'); process.exit(2); }

// ── 2. 정적 서버 (의존성 없음 · 127.0.0.1 · 빈 포트) ──
const MIME = { html: 'text/html; charset=utf-8', js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', webmanifest: 'application/manifest+json', wasm: 'application/wasm', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', glb: 'model/gltf-binary', bin: 'application/octet-stream' };
const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400).end(); return; }
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(DIST, path.normalize(rel));
  if (!file.startsWith(DIST + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

// ── 3. 브라우저 · 오류 · 프레임 기록 ──
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
let step = 'start', finished = false;
const pageErrors = [], consoleErrors = [], badResponses = [], outside = [];
const t0 = Date.now();
async function shutdown(code) {
  await browser.close().catch(() => {});
  await new Promise((ok) => server.close(ok));
  process.exit(code);
}
const watchdog = setTimeout(() => {
  if (finished) return;
  console.log(`FAIL 시간 초과 ${TIMEOUT_S}s — 걸음 '${step}' · 페이지 오류 ${pageErrors.length} · 콘솔 오류 ${consoleErrors.length}`);
  for (const e of [...pageErrors, ...consoleErrors].slice(0, 5)) console.log('  ', e);
  shutdown(1);
}, TIMEOUT_S * 1000);

const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: +arg('dpr', 1), isMobile: true, hasTouch: true });
// 바깥 주소(계정 연결 인증 서버 등)는 부르지 않는다 — 불렀으면 요약에 적는다 (판정은 콘솔 · 페이지 오류로만)
await ctx.route((url) => !url.href.startsWith(base), (r) => { outside.push(r.request().url()); r.abort(); });
const page = await ctx.newPage();
page.on('pageerror', (e) => pageErrors.push(`[${step}] ${String(e).slice(0, 300)}`));
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`[${step}] ${m.text().slice(0, 300)}`); });
page.on('response', (r) => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.url()}`); });
await page.addInitScript(() => {
  const R = (window.__flow = { t: [], st: [], marks: [] });
  const f = (now) => { R.t.push(now); R.st.push(window.game ? window.game.state : '-'); requestAnimationFrame(f); };
  requestAnimationFrame(f);
  window.__mark = (k) => R.marks.push([k, performance.now()]);
});
const mark = (k) => page.evaluate((k) => window.__mark(k), k);
const until = (fn, argv) => page.waitForFunction(fn, argv, { timeout: STEP_MS });
// 실패했을 때 어디서 멈췄는지 (판정에 안 씀): 게임 상태 · 첫 화면 단계 · 열린 창 · 결과 단추
const diag = () => page.evaluate(() => {
  const g = window.game, root = document.querySelector('#gameEntrance')?.shadowRoot, b = document.getElementById('btnStart');
  const open = [...document.querySelectorAll('dialog[open]'), ...(root ? root.querySelectorAll('dialog[open]') : [])].map((d) => d.id);
  return { state: g?.state, stage: g?.stage?.id, entrance: root?.getElementById('entrance')?.dataset.phase ?? null, open, cards: document.querySelectorAll('#draw .wcard').length, btnStart: b && { text: b.textContent, hidden: b.hidden } };
});

// ── 4. 흐름 ──
const endMs = []; // 판 끝 → 결과 단추까지 걸린 실제 ms (알림용)
const rounds = []; // { kind, from, to, i, cards, wallMs } — 표시 때는 window.__flow.marks 의 click:i · cards:i · card:i 로 프레임 창을 자른다
async function pickCardAndFight(r) {
  // 카드 고르기(여정의 보통 길) — 대기실에서 무기를 장착한 판이면 카드 없이 곧바로 싸움
  await until(() => window.game?.state === 'fight' || (window.game?.state === 'draw' && document.querySelector('#draw .wcard:not(.foe)')));
  if (await page.evaluate(() => window.game.state === 'draw')) {
    r.cards = true; await mark(`cards:${rounds.length}`);
    await page.waitForTimeout(300);
    await mark(`card:${rounds.length}`);
    // 막 뜬 카드는 누름을 받지 않는다(main.js pickCard — 두 번 누른 손가락 막기) → 사람처럼 다시 누른다
    for (let n = 0; n < 20; n++) {
      await page.locator('#draw .wcard:not(.foe)').first().click();
      const took = await page.waitForFunction(() => window.game.state !== 'draw' || window.game.draw.stage !== 'choose', null, { timeout: 2000 }).then(() => true, () => false);
      if (took) break;
    }
    await until(() => window.game.state === 'fight');
  }
  r.to = await page.evaluate(() => window.game.stage.id);
  await page.waitForTimeout(SETTLE_MS);
}
async function endRound(win) {
  const w0 = Date.now();
  // 판 끝: 목 베임으로 죽음(fighter.die — 싸움의 목 베기와 같은 길 · 되살아남 없음). 흙 몸(목이 떨어져야 죽음)이면 목을 먼저 뗀다
  await page.evaluate((w) => {
    const g = window.game, f = w ? g.enemy : g.player;
    if (!(g.player.alive && g.enemy.alive)) return;
    if (!f.canDie) f.decapitate?.(1, 0);
    f.die('목', true);
  }, win);
  // 결과 창: 3.5 초 뒤 '다음 여정'(이김) · '재대결'(짐) 단추
  await until(() => window.game.state === 'paused' && document.getElementById('btnStart') && !document.getElementById('btnStart').hidden && getComputedStyle(document.getElementById('btnStart')).display !== 'none');
  await page.waitForTimeout(800);
  endMs.push(Date.now() - w0);
}
async function round(kind, clickFn) {
  const from = await page.evaluate(() => window.game.stage.id);
  const r = { kind, from, i: rounds.length, w0: Date.now() };
  await mark(`click:${rounds.length}`);
  await clickFn();
  await pickCardAndFight(r);
  r.wallMs = Date.now() - r.w0; delete r.w0;
  rounds.push(r);
}

try {
  step = 'load';
  await page.goto(base, { waitUntil: 'load' });
  await until(() => window.game?.player);
  step = 'notices';
  // 처음 들어오는 사람: 공지 창 → 확인 → 첫 화면 (공지 수 · 글자는 보지 않는다)
  await page.locator('#noticeDialog').waitFor({ state: 'visible', timeout: STEP_MS }).catch(() => {});
  if (await page.locator('#noticeDialog').evaluate((d) => d.open).catch(() => false)) await page.locator('#confirmNotices').click();
  await until(() => document.querySelector('#gameEntrance')?.shadowRoot?.getElementById('entrance')?.dataset.phase === 'ready');
  step = 'title→journey';
  await round('firstStart', () => page.locator('#newJourney').click());
  await until(() => !document.getElementById('gameEntrance'));
  for (let k = 1; k <= CHANGES; k++) {
    step = `win ${k}`;
    await endRound(true);
    step = `next ${k}`;
    await round('stageChange', () => page.locator('#btnStart').click());
  }
  step = 'lose';
  await endRound(false);
  step = 'rematch';
  await round('rematch', () => page.locator('#btnStart').click());
  step = 'done';
} catch (e) {
  finished = true; clearTimeout(watchdog);
  console.log(`FAIL 걸음 '${step}': ${String(e.message || e).split('\n')[0].slice(0, 300)}`);
  console.log('  지금:', JSON.stringify(await diag().catch((x) => String(x))));
  for (const x of [...pageErrors, ...consoleErrors].slice(0, 5)) console.log('  ', x);
  if (OUT) await page.screenshot({ path: path.resolve(String(OUT).replace(/\.json$/, '') + '.fail.png') }).catch(() => {});
  await shutdown(1);
}
finished = true; clearTimeout(watchdog);

// ── 5. 요약 (알림용) ──
const R = await page.evaluate(() => window.__flow);
const gap = (lo, hi) => { let m = 0; for (let j = 1; j < R.t.length; j++) if (R.t[j] > lo && R.t[j] <= hi) m = Math.max(m, R.t[j] - R.t[j - 1]); return Math.round(m); };
const at = (k) => R.marks.find((m) => m[0] === k)?.[1];
const lines = rounds.map((r) => {
  const c = at(`click:${r.i}`), cards = at(`cards:${r.i}`), card = at(`card:${r.i}`) ?? c;
  const iF = R.t.findIndex((t, j) => t > card && R.st[j] === 'fight');
  const fightT = iF >= 0 ? R.t[iF] : card;
  r.longestMs = gap(c, fightT + SETTLE_MS);
  r.toCardsMs = cards != null ? gap(c, cards) : null; // 단추 → 카드가 뜰 때까지
  r.toFightMs = gap(card, fightT + SETTLE_MS); // 카드 고름(카드 없으면 단추) → 싸움 2 초
  const where = r.cards ? `단추→카드 ${r.toCardsMs} · 카드→싸움 ${r.toFightMs}` : `단추→싸움 ${r.toFightMs}`;
  return `  ${r.kind.padEnd(11)} ${String(r.from).padEnd(16)} → ${String(r.to).padEnd(16)} 가장 긴 프레임 간격 ${String(r.longestMs).padStart(5)} ms (${where}) · 걸음 ${(r.wallMs / 1000).toFixed(0)}s`;
});
const secs = ((Date.now() - t0) / 1000).toFixed(0);
const visited = [...new Set(rounds.map((r) => r.to))];
const stageChanges = rounds.filter((r) => r.kind === 'stageChange' && r.from !== r.to).length;
const errN = pageErrors.length + consoleErrors.length;
console.log(`flow_smoke ${base} · ${secs}s · 무대 ${visited.join(' → ')} (바뀜 ${stageChanges})`);
console.log(lines.join('\n'));
console.log(`  판 끝 → 결과 단추 ${endMs.map((x) => (x / 1000).toFixed(0) + 's').join(' · ')}`);
console.log(`페이지 오류 ${pageErrors.length} · 콘솔 오류 ${consoleErrors.length} · 400 넘는 응답 ${badResponses.length} · 바깥 주소 ${outside.length}`);
for (const e of [...pageErrors, ...consoleErrors, ...badResponses].slice(0, 8)) console.log('  ', e);
if (OUT) fs.writeFileSync(path.resolve(OUT), JSON.stringify({ base, secs: +secs, endMs, visited, stageChanges, rounds, pageErrors, consoleErrors, badResponses, outside }, null, 1));
// 무대가 실제로 바뀌었는지는 흐름의 일부 (값이 아님 — 다음 여정이 같은 무대를 다시 열면 흐름이 끊긴 것)
const ok = errN === 0 && stageChanges >= 3;
console.log(ok ? 'PASS 흐름 끝남 · 오류 0' : `FAIL ${errN ? `오류 ${errN}` : ''}${stageChanges < 3 ? ` 무대 바뀜 ${stageChanges} < 3` : ''}`);
await shutdown(ok ? 0 : 1);
