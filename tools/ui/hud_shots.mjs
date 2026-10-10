// 게임 화면 글자(HUD) 지금 모습 캡처 + 목업 캡처 (10/10 HUD 글자 체계 — docs/ui/hud_type_system_2026-10-10.md)
//  게임 코드는 건드리지 않는다. 싸움을 실제로 띄워 찍고, 띄우기 어려운 알림(내 비기·경직·결과·감정)은 DOM 에 직접 넣어 찍는다
//  (넣은 순간 게임 루프가 지우지 않게 그 요소의 classList.remove 만 이 페이지 안에서 막는다 — 찍은 장면마다 'injected' 를 적는다).
//  실행: npx vite build && npx vite preview --port 4317 --strictPort &
//        node tools/ui/hud_shots.mjs before  http://127.0.0.1:4317 docs/ui     → hud_before_{portrait,landscape}_<장면>.png + hud_bg_<방향>.png(글자 없는 배경) + 잰 값 JSON
//        node tools/ui/hud_shots.mjs mockup  - docs/ui                          → tools/ui/hud_mockup.html 을 배경 위에 얹어 hud_mockup_{portrait,landscape}.png
//  저장소에 넣을 때는 PNG 를 256 색으로 줄였다 (PIL quantize MEDIANCUT · 디더 없음 — 21 MB → 9 MB).
//  띄우기는 tools/browser/*.mjs 와 같다 (설치된 Chromium + swiftshader GL). 소프트웨어 GL 은 느리다 — 장면 하나에 수십 초.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MODE = process.argv[2] || 'before';
const base = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : 'http://127.0.0.1:4317';
const dir = process.argv[4] || 'docs/ui';
const ONLY = (process.env.ORIENT || 'portrait,landscape').split(',');
fs.mkdirSync(dir, { recursive: true });
const here = path.dirname(fileURLToPath(import.meta.url));
const VIEW = { portrait: { width: 390, height: 844 }, landscape: { width: 844, height: 390 } };
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const metrics = {};

async function newPage(o) {
  const ctx = await browser.newContext({ viewport: VIEW[o], hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${o} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${o} ${m.text()}`));
  return page;
}

// 글자 요소의 자리·글꼴·색을 잰다 (보이는 것만)
const MEASURE = () => {
  const sel = ['#guardName b', '#guardName span', '#techCue b', '#techCue small', '#toast', '#emoMsg', '#hint', '#foeIntro b', '#foeIntro i', '#foeIntro span', '#foeIntro em', '#topButtons', '#moveStick', '.drawRow'];
  const out = {};
  for (const s of sel) {
    const el = document.querySelector(s);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    const cs = getComputedStyle(el);
    let op = 1;
    for (let p = el; p && p !== document.body; p = p.parentElement) op *= +getComputedStyle(p).opacity;
    out[s] = { box: [r.left, r.top, r.width, r.height].map(Math.round), font: `${cs.fontWeight} ${cs.fontSize}`, color: cs.color, op: +op.toFixed(2), text: el.innerText?.slice(0, 40) };
  }
  return out;
};

async function openFight(o, q) {
  const page = await newPage(o);
  await page.goto(`${base}/${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  // 세로 터치 화면은 실제로 '폰을 가로로 돌려주세요'(#rotate)가 덮는다 — 세로 HUD 를 보려고 그 안내만 숨긴다 (안내 자체는 'rotate' 장면에서 따로 찍는다)
  if (o === 'portrait') await page.addStyleTag({ content: '#rotate.enabled{display:none!important}' }).then((h) => h.evaluate((el) => (el.id = '__norotate')));
  return page;
}

async function shot(page, o, name, note) {
  const file = path.join(dir, `hud_before_${o}_${name}.png`);
  await page.screenshot({ path: file });
  metrics[`${o}_${name}`] = { note, ...(await page.evaluate(MEASURE)) };
  console.log('SHOT', file, note);
}

// 요소를 지금 모습 그대로 붙잡는다 (게임 루프가 show 를 떼지 못하게) — 이 캡처 페이지 안에서만
const PIN = `window.__pin = (id) => { const el = document.getElementById(id); el.classList.remove = () => {}; return el; };`;

async function before(o) {
  // 1) 무기 뽑기: 상대 소개(이름·칭호·한마디) + 안내 em + 카드 세 장
  let page = await openFight(o, '?stage=poseidon&cards=excalibur,qinggang&foeWeapon=rapier');
  await page.waitForTimeout(600);
  await shot(page, o, 'menu', 'real: 처음 메뉴(.overlay .card — 제목·.sub·.row·.seg·.toggle·.primary·.howto)');
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'draw' && window.game.draw.stage === 'choose', null, { timeout: 90000 });
  await page.evaluate(() => (window.game.draw.hold = true));
  await page.waitForTimeout(1200);
  await shot(page, o, 'draw', 'real: 무기 뽑기 (foeIntro b·i·span·em + 카드 뒷면·번호 배지)');
  // 1b) 카드 앞면: 첫 카드를 골라 셋 다 뒤집힌 뒤 멈춘다 (레전드·에픽·레어 — ?cards=excalibur,qinggang&foeWeapon=rapier)
  await page.evaluate(() => (window.game.draw.hold = false));
  await page.waitForTimeout(1500); // 막 뜬 카드는 고르지 못한다 (DRAW_T.ready — 게임 시간)
  await page.locator('.wcard').first().click();
  await page.waitForFunction(() => window.game.draw.stage !== 'choose', null, { timeout: 5000 }).catch(async () => {
    await page.waitForTimeout(3000);
    await page.locator('.wcard').first().click();
  });
  await page.waitForFunction(() => window.game.draw.foe, null, { timeout: 90000 });
  await page.evaluate(() => (window.game.draw.hold = true));
  await page.waitForTimeout(900);
  await shot(page, o, 'cards', 'real: 카드 앞면 (.wwho·.wname·.wsub·.wtier·.wdesc·.wabil, 등급 색)');
  await page.context().close();

  // 2) 싸움 시작 순간: Battle(toast) + 조작 안내(hint) + 상대 소개 — 무기 고정(?weapon)이라 뽑기 없이 바로
  page = await openFight(o, '?stage=poseidon&weapon=longsword');
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForTimeout(150);
  await shot(page, o, 'start', 'real: Battle toast + hint + foeIntro');

  // 3) 싸움 중: 자세 이름(실제 자세표 글) + 상대 패시브 알림(실제 경로 enemy.techCue) + 감정 알림(DOM 직접)
  await page.waitForFunction(() => window.game.player.fightT > 2.4, null, { timeout: 120000 });
  await page.evaluate(PIN);
  await page.evaluate(() => {
    const g = window.game;
    g.enemy.techCue = { text: 'Indes (맞받기)', kind: 'passive', schoolKo: '독일', t: -11 };
  });
  await page.waitForFunction(() => document.getElementById('techCue').classList.contains('show'), null, { timeout: 30000 });
  await page.evaluate(() => {
    const g = window.game;
    __pin('techCue');
    const gn = __pin('guardName');
    const info = g.player.swordArt.names[3] ?? { name: '황소 (Ochs)', desc: '칼자루는 머리 옆, 칼끝은 상대 얼굴 · 찌르기 준비' };
    gn.innerHTML = `<b>${info.name}</b><span>${info.desc}</span>`;
    gn.classList.add('show');
    const em = __pin('emoMsg');
    em.textContent = '분노가 폭발한다';
    em.dataset.emotion = 'anger';
    em.classList.add('show');
    for (const id of ['toast', 'hint', 'foeIntro']) document.getElementById(id).classList.remove('show');
  });
  await page.waitForTimeout(500);
  await shot(page, o, 'fight', 'real: techCue passive(enemy.techCue 경로) · injected: guardName 글(실제 자세표), emoMsg');

  // 4) 상대 비기 (실제 경로 kind secret) — 자세 이름 그대로
  await page.evaluate(() => {
    const el = document.getElementById('techCue');
    delete el.classList.remove; // 다시 게임이 쓰게
    window.game.enemy.techCue = { text: 'Versetzen (받아 베기)', kind: 'secret', schoolKo: '독일', t: -12 };
  });
  await page.waitForFunction(() => document.getElementById('techCue').dataset.kind === 'secret', null, { timeout: 30000 });
  await page.evaluate(() => { __pin('techCue'); document.getElementById('emoMsg').style.opacity = '0'; });
  await page.waitForTimeout(400);
  await shot(page, o, 'foe_secret', 'real: techCue secret(상대) · injected: guardName');

  // 5) 내 비기 창(secretReady) · 고노센 준비(secretArm) · 경직(stiff) — DOM 직접 (같은 칸에 섞여 뜨는 모습)
  for (const [kind, text, tag] of [
    ['secretReady', 'Versetzen (받아 베기)', '내 독일 · 비기'],
    ['secretArm', '고노센 준비', '내 일본 · 비기'],
    ['stiff', '경직', '상대 독일 · 비기 뒤'],
  ]) {
    await page.evaluate(([kind, text, tag]) => {
      const el = document.getElementById('techCue');
      el.innerHTML = `<b>${text}</b><small>${tag}</small>`;
      el.dataset.kind = kind;
      el.dataset.who = tag.startsWith('내') ? 'me' : 'foe';
      el.classList.add('show');
    }, [kind, text, tag]);
    await page.waitForTimeout(400);
    await shot(page, o, `cue_${kind}`, `injected: techCue data-kind=${kind}`);
  }

  // 6) 판 끝: 결과(toast 패배) + 상대 승리 대사(foeIntro 재사용) — DOM 직접
  await page.evaluate(() => {
    const t = __pin('toast');
    t.textContent = '패배';
    t.classList.add('show');
    const f = __pin('foeIntro');
    f.querySelector('b').textContent = '하인리히';
    f.querySelector('i').textContent = '';
    f.querySelector('span').textContent = '“은화! 은화 어딨어!”';
    f.querySelector('em').textContent = '';
    f.classList.add('show');
    const c = document.getElementById('techCue');
    c.classList.toggle('show', false);
    c.style.opacity = '0';
    document.getElementById('guardName').style.opacity = '0';
  });
  await page.waitForTimeout(500);
  await shot(page, o, 'result', 'injected: toast 패배 + foeIntro 승리 대사');

  // 6b) 일시정지 창 (실제 단추) → 판 끝 결과 창(같은 .card 에 결과 글 — DOM 직접)
  await page.evaluate(() => {
    for (const id of ['toast', 'foeIntro']) document.getElementById(id).style.opacity = '0';
  });
  await page.locator('#btnPause').click();
  await page.waitForTimeout(500);
  await shot(page, o, 'pause', 'real: 일시정지 창');
  await page.evaluate(() => {
    document.getElementById('menuTitle').textContent = '패배';
    document.getElementById('menuSub').textContent = '목을 베였다 · 하인리히: “은화! 은화 어딨어!”';
    document.getElementById('btnStart').textContent = '다시 싸우기';
    document.getElementById('btnResume').style.display = 'none';
  });
  await page.waitForTimeout(300);
  await shot(page, o, 'result_card', 'injected: 결과 창 글(menuTitle·menuSub·btnStart)');
  if (o === 'portrait') {
    await page.evaluate(() => (document.getElementById('__norotate').sheet.disabled = true));
    await page.waitForTimeout(200);
    await shot(page, o, 'rotate', 'real: #rotate 안내 (세로 터치 화면에서 실제로 뜨는 것)');
    await page.evaluate(() => (document.getElementById('__norotate').sheet.disabled = false));
  }
  await page.locator('#btnResume').evaluate((b) => (b.style.display = ''));
  await page.locator('#btnResume').click();
  await page.waitForTimeout(500);
  for (const id of ['toast', 'foeIntro']) await page.evaluate((id) => (document.getElementById(id).style.opacity = ''), id);

  // 7) 글자 없는 배경 (목업 바탕): 글자 요소만 숨기고 일시정지 버튼·조이스틱은 둔다
  await page.evaluate(() => {
    for (const id of ['guardName', 'techCue', 'toast', 'emoMsg', 'hint', 'foeIntro']) document.getElementById(id).style.visibility = 'hidden';
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dir, `hud_bg_${o}.png`) });
  metrics[`${o}_bg`] = await page.evaluate(MEASURE);
  await page.context().close();

  // 8) 겹침: 개울가 브란(분노로 시작) 판의 시작 — Battle + 안내 + 소개 + 감정 + 상대 패시브 + 자세 이름이 한꺼번에
  page = await openFight(o, '?stage=clearing&weapon=longsword');
  await page.getByText('싸움 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.evaluate(PIN);
  await page.evaluate(() => {
    for (const id of ['toast', 'hint', 'foeIntro', 'emoMsg', 'guardName', 'techCue']) __pin(id);
    const em = document.getElementById('emoMsg');
    if (!em.classList.contains('show')) { em.textContent = '오소리 브란의 분노가 폭발한다'; em.dataset.emotion = 'anger'; em.classList.add('show'); }
    const c = document.getElementById('techCue');
    c.innerHTML = '<b>Nachreisen (따라 들어가기)</b><small>독일 · 패시브</small>';
    c.dataset.kind = 'passive';
    c.classList.add('show');
    const g = window.game;
    const info = g.player.swordArt.names[0];
    const gn = document.getElementById('guardName');
    gn.innerHTML = `<b>${info.name}</b><span>${info.desc}</span>`;
    gn.classList.add('show');
  });
  await page.waitForTimeout(400);
  await shot(page, o, 'overlap', 'real: toast·hint·foeIntro(시작) · injected: emoMsg(브란 시작 분노와 같은 글), techCue passive, guardName');
  await page.context().close();
}

async function mockup(o) {
  // hud = 모든 역할 한 화면(hud_mockup_<방향>.png) · map 화면 지도 · cards 카드 화면 · menu 창 · swatch 오렌지 후보
  for (const scene of (process.env.SCENES || 'hud,map,cards,menu,swatch').split(',')) {
    const page = await newPage(o);
    const url = pathToFileURL(path.join(here, 'hud_mockup.html')).href + `?o=${o}&scene=${scene}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(400);
    const file = path.join(dir, scene === 'hud' ? `hud_mockup_${o}.png` : `hud_mockup_${o}_${scene}.png`);
    await page.screenshot({ path: file });
    console.log('SHOT', file);
    metrics[`mockup_${o}_${scene}`] = await page.evaluate(() =>
      Object.fromEntries([...document.querySelectorAll('[data-role]')].map((el) => {
        const r = el.getBoundingClientRect();
        return [el.dataset.role, [r.left, r.top, r.width, r.height].map(Math.round)];
      })),
    );
    await page.context().close();
  }
}

for (const o of ONLY) await (MODE === 'mockup' ? mockup(o) : before(o));
fs.writeFileSync(path.join(process.env.METRICS_DIR || dir, `hud_${MODE}_metrics.json`), JSON.stringify(metrics, null, 1));
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
