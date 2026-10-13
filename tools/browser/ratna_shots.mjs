// 라트나 위라세타쿤 그림 (docs/import/ratna_port_2026-10-14.md · docs/import/ratna/) — 상대로 세워 찍는다(내 인물은 감춤)
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/ratna_shots.mjs <주소> <출력 폴더> [갈래 …]
//  갈래 (없으면 모두):
//   views    정면 · 옆(원숭이 쪽 왼옆) · 뒤 — 지금 판(v4)과 샛별 v3, 상대 AI 를 끄고 판 시작 자세 '아래 탈류'(칼끝을 오른쪽 아래로 — 얼굴·몸을 가리지 않게)로 1.2 s 든 뒤 물리를 멈춰 (640×800)
//   close    얼굴·바지 가까이 (v3 · v4 같은 자리 같은 빛) — 얼굴 전/후 · 바지 전/후 (640×640)
//   duel     게임 카메라 그대로 폰 가로 844×390 (화면 배율 2) — 판 시작 1.0 s(가운데 소개 글) · 싸우는 중 6 s, 무대 여럿
//   monkey   원숭이 겹침 모음: 어깨 자리(샛별 v3)가 가장 깊이 겹친 자세 넷·기술 둘을 같은 자리에서 v3 · v4 로 (왼쪽 앞 3/4, 480×480)
//   route    실제 테스트 경로: test.html 에서 '상대' 줄의 라트나를 눌러 시작 → 싸움 25 s (라트나 AI 대 가만히 선 나) — 상대 이름·무기·유파·소개 글·왼쪽 위 줄을 읽고 찍는다.
//            이어 ?test=1&hero=ratna(라트나 겉모습의 나, 북부 대공의 검) 대 오마리 25 s — 라트나 옷에 상처 자국·절단이 붙는지 (콘솔 오류 0 이 관문)
//   (route 는 기본 묶음에 들지 않는다 — 갈래 이름을 적어야 돈다)
//  출력은 png (문서 그림은 tools/browser/ratna_sheets.py 가 묶어 webp 로)
//  playwright 는 저장소 의존성에 없다. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || '/tmp/ratna_shots';
const want = new Set(process.argv.slice(4));
const on = (k) => (!want.size && k !== 'route') || want.has(k);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const PADS = { langort: [0.0, 0.03], tag: [0.02, 0.52], tagR: [0.42, 0.42], tagL: [-0.4, 0.42], ochsL: [-0.22, 0.26], sideL: [-0.52, 0.06], wechselR: [0.38, -0.44] };

async function open(look, { stage = 'arena', viewport = { width: 640, height: 800 }, dpr = 1, mobile = false, ai = false, until = 1.2, extra = '' } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile });
  page.on('pageerror', (e) => errors.push(`pageerror (${look}): ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console (${look}): ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/?stage=${stage}&foe=ratna&look=${look}&weapon=longsword&foeWeapon=ice&emo=0${extra}`, { waitUntil: 'networkidle' }); // weapon= 은 상대에게도 번지므로 상대 무기를 따로 (라트나 = 북부 대공의 검)
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('싸움 시작').click({ timeout: 300000 });
  if (!ai) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, until, { timeout: 900000 });
  return page;
}
/** 상대(라트나)를 패드 자리로 옮겨 secs 동안 든다 (AI 꺼 둔 채) */
async function hold(page, pad, secs = 1.2) {
  const t0 = await page.evaluate((pad) => { const g = window.game; g.enemy.handOffset.set(pad[0], pad[1]); return g.stats.simTime; }, pad);
  await page.waitForFunction((t) => window.game.stats.simTime > t, t0 + secs, { timeout: 900000 });
}
/** 패드 길을 사람 손 빠르기로 따라가다 at 초에 멈춘다 (기술 한 장면 — 시뮬 도구 ratna_monkey_clear.mjs 의 기술 길과 같은 꼴) */
async function runPath(page, from, path, speed, at) {
  await hold(page, from, 0.8);
  await page.evaluate(({ from, path, speed }) => {
    const g = window.game;
    const pts = path.map((p) => p.slice());
    let cur = from.slice();
    g.__pathT = 0;
    g.ai.update = (dt) => {
      g.__pathT += dt;
      if (!pts.length) return;
      const [tx, ty] = pts[0];
      const dx = tx - cur[0], dy = ty - cur[1], dd = Math.hypot(dx, dy), st = speed * dt;
      if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
      else (cur = [tx, ty]), pts.shift();
      g.enemy.handOffset.set(cur[0], cur[1]);
    };
  }, { from, path, speed });
  await page.waitForFunction((at) => window.game.__pathT >= at, at, { timeout: 900000 });
}
async function freeze(page, hideHud = true) {
  await page.evaluate((hideHud) => {
    const g = window.game;
    g.world.step = () => {};
    g.ai.update = () => {};
    g.freeCam = true;
    for (const m of g.player.meshes) m.group.visible = false;
    if (g.player.swordGroup) g.player.swordGroup.visible = false;
    if (hideHud) {
      const st = document.createElement('style');
      st.textContent = 'body > :not(#game) { display: none !important; }';
      document.head.append(st);
    }
  }, hideHud);
}
/** 상대 몸 기준 카메라: 골반에서 앞 방향을 deg 만큼 돌린 쪽 dist m, 높이 h, 보는 점 높이 aim */
async function cam(page, deg, dist, h, aim, side = 0) {
  await page.evaluate(({ deg, dist, h, aim, side }) => {
    const g = window.game, T = g.THREE, E = g.enemy;
    const c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
    const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
    const right = new T.Vector3(0, 1, 0).cross(fw).negate(); // 상대의 오른쪽 (+z 몸 좌표)
    const at = new T.Vector3(c.x, aim, c.z).addScaledVector(right, side);
    const dir = fw.clone().applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    g.camera.position.copy(at).addScaledVector(dir, dist).setY(h);
    g.camera.lookAt(at);
  }, { deg, dist, h, aim, side });
  await nextFrames(page, 4);
}

if (on('views')) {
  for (const look of ['ratna:v4', 'ratna:v3']) {
    const page = await open(look);
    await hold(page, PADS.wechselR);
    await freeze(page);
    const tag = look.split(':')[1];
    for (const [name, deg] of [['front', 0], ['left', 90], ['back', 180]]) { // deg + = 상대의 왼쪽으로 돈 쪽 (y 축 오른손 돌림)
      await cam(page, deg, 2.3, 1.15, 0.95);
      await page.screenshot({ path: `${out}/views_${tag}_${name}.png` });
    }
    await page.close();
  }
}

if (on('close')) {
  for (const look of ['ratna:v3', 'ratna:v4']) {
    const page = await open(look, { viewport: { width: 640, height: 640 } });
    await hold(page, PADS.wechselR); // 칼끝을 오른쪽 아래로 떨군 자세 — 얼굴·바지를 가리지 않게
    await freeze(page);
    const tag = look.split(':')[1];
    const head = await page.evaluate(() => window.game.enemy.bodies.head.translation().y);
    await cam(page, 0, 0.62, head + 0.02, head - 0.02);
    await page.screenshot({ path: `${out}/close_${tag}_face.png` });
    await cam(page, 0, 1.25, 0.62, 0.55);
    await page.screenshot({ path: `${out}/close_${tag}_legs.png` });
    await page.close();
  }
}

if (on('duel')) {
  for (const stage of ['sacred_grove', 'corsair', 'castle']) {
    for (const look of ['ratna:v4', 'ratna:v3']) {
      const tag = look.split(':')[1];
      // 판 시작 소개 글: 화면 글자 시계는 그리는 프레임 시간이라(헤드리스 소프트웨어 그리기는 느려 물리보다 빨리 간다) 소개가 뜬 것을 보고 곧바로 찍는다
      if (stage === 'sacred_grove' && tag === 'v4') { // 소개 글은 한 장 (v4 · 신목의 숲)
        const page = await open(look, { stage, viewport: { width: 844, height: 390 }, dpr: 2, mobile: true, ai: true, until: 0.05 });
        await page.waitForFunction(() => document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 60000 });
        await page.screenshot({ path: `${out}/duel_${stage}_${tag}_intro.png` });
        await page.close();
      }
      const p2 = await open(look, { stage, viewport: { width: 844, height: 390 }, dpr: 2, mobile: true, ai: true, until: 6.0 });
      await p2.evaluate(() => { window.game.world.step = () => {}; window.game.ai.update = () => {}; });
      await nextFrames(p2, 4);
      await p2.screenshot({ path: `${out}/duel_${stage}_${tag}_fight.png` });
      const info = await p2.evaluate(() => {
        const g = window.game, c = g.camera.position, h = g.enemy.bodies.head.translation();
        const v = new g.THREE.Vector3(h.x, h.y, h.z).project(g.camera);
        return { dist: Math.hypot(c.x - h.x, c.y - h.y, c.z - h.z), sx: (v.x + 1) / 2, sy: (1 - v.y) / 2 };
      });
      console.log(`duel ${stage} ${tag}: camera→head ${info.dist.toFixed(2)} m · head on screen ${(info.sx * 844).toFixed(0)},${(info.sy * 390).toFixed(0)} css px`);
      writeFileSync(`${out}/duel_${stage}_${tag}_fight.head`, `${(info.sx * 844).toFixed(1)},${(info.sy * 390).toFixed(1)},${info.dist.toFixed(3)}`); // 얼굴 칸 자르기 (ratna_sheets.py)
      await p2.close();
    }
  }
}

if (on('monkey')) {
  // 어깨 자리(샛별 v3)가 가장 깊이 겹친 자세 넷 · 기술 둘 (tools/sim/ratna_monkey_clear.mjs 표에서): 레베스 준비 · 탈류 준비 · 머리 위 · 가로 레베스 / 분노의 베기 왼쪽 · 머리 위 돌려 베기
  const SCENES = [
    ['guard_revez', { pad: PADS.tagL }],
    ['guard_talho', { pad: PADS.tagR }],
    ['guard_altibaxo', { pad: PADS.tag }],
    ['guard_revezOriz', { pad: PADS.sideL }],
    ['tech_zornhauL', { from: PADS.tagL, path: [[-0.12, 0.14], PADS.wechselR], speed: 9, at: 0.158 }], // 시뮬에서 v3 자리 칼이 가장 깊던 때 (패드 9 m/s · 길 시작 0.158 s)
    ['tech_redondo', { from: PADS.tagR, path: [[0.52, 0.06], [0.0, 0.1], [-0.52, 0.06], [-0.3, 0.45], [0.3, 0.45], [0.52, 0.06], [0.0, 0.1], [-0.52, 0.06]], speed: 13, at: 0.925 }], // 같은 꼴 (13 m/s · 0.925 s)
  ];
  for (const look of ['ratna:v3', 'ratna:v4']) {
    const tag = look.split(':')[1];
    const page = await open(look, { viewport: { width: 480, height: 480 } }); // 겉모습마다 한 쪽 — 장면마다 물리를 다시 돌렸다 멈춘다
    await page.evaluate(() => { const g = window.game; g.__step = g.world.step; g.__hide = true; });
    for (const [name, s] of SCENES) {
      await page.evaluate(() => { const g = window.game; g.world.step = g.__step; g.freeCam = false; });
      if (s.pad) await hold(page, s.pad);
      else await runPath(page, s.from, s.path, s.speed, s.at);
      await freeze(page, name === SCENES[0][0]);
      await cam(page, 50, 1.25, 1.62, 1.42, -0.08); // 왼쪽 앞 50° — 원숭이·왼팔 쪽
      await page.screenshot({ path: `${out}/monkey_${tag}_${name}.png` });
      await page.evaluate(() => { window.game.ai.update = () => {}; }); // runPath 가 갈아 끼운 손 몰이를 걷는다
    }
    await page.close();
  }
}

if (on('route')) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => errors.push(`pageerror (route): ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console (route): ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`${base}/test.html`, { waitUntil: 'networkidle' });
  const foes = await page.$$eval('#foes .pick b', (els) => els.map((e) => e.textContent));
  await page.locator('#foes .pick', { hasText: '라트나 위라세타쿤' }).click();
  await page.locator('#weaponsRest .pick, #weaponsNew .pick', { hasText: '롱소드' }).first().click();
  const summary = await page.textContent('#summary');
  await page.screenshot({ path: `${out}/route_pick.png` });
  await page.click('#btnGo');
  await page.waitForURL(/index\.html\?/);
  const url = page.url();
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  const note = await page.textContent('#testRouteNote').catch(() => '');
  await page.click('#btnStart', { timeout: 300000 });
  await page.waitForFunction(() => document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 });
  const intro = await page.evaluate(() => [...document.querySelectorAll('#foeIntro b, #foeIntro i, #foeIntro span')].map((e) => e.textContent).join(' | '));
  await page.screenshot({ path: `${out}/route_intro.png` });
  await page.waitForFunction(() => window.game.state !== 'fight' || window.game.stats.simTime > 25, null, { timeout: 1800000 });
  const info = await page.evaluate(() => {
    const g = window.game, e = g.enemy;
    return { foe: e.name, weapon: e.weapon?.id, tradition: e.swordArt?.tradition, level: g.ai?.levelName ?? g.ai?.level, proficiency: g.ai?.proficiency, line: document.querySelector('#stageInfo .foe')?.textContent, state: g.state, simTime: +g.stats.simTime.toFixed(1), hits: g.stats.hits.length, playerWounds: g.player.wounds?.length, foeWounds: e.wounds?.length };
  });
  await page.screenshot({ path: `${out}/route_fight.png` });
  console.log('route foes:', foes.join(' · '), '| summary:', summary, '| url:', url.replace(base, ''), '| note:', note, '| intro:', intro, '|', JSON.stringify(info));
  await page.close();
  // 라트나 겉모습의 나 대 오마리 — 라트나 옷에 상처 자국
  const p2 = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p2.on('pageerror', (e) => errors.push(`pageerror (route hero): ${e}`));
  p2.on('console', (m) => { if (m.type() === 'error') errors.push(`console (route hero): ${m.text()}`); });
  await p2.goto(`${base}/index.html?test=1&weapon=ice&hero=ratna&foe=omari&stage=castle`, { waitUntil: 'networkidle' });
  await p2.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await p2.click('#btnStart', { timeout: 300000 });
  await p2.waitForFunction(() => window.game.state !== 'fight' || window.game.stats.simTime > 25, null, { timeout: 1800000 });
  const info2 = await p2.evaluate(() => {
    const g = window.game, P = g.player;
    let decals = 0;
    for (const m of Object.values(P.partMesh)) m?.traverse?.((o) => { if (o !== m && o.isMesh && o.userData?.kind) decals++; });
    return { me: P.name, weapon: P.weapon?.id, state: g.state, simTime: +g.stats.simTime.toFixed(1), wounds: P.wounds?.length, severed: P.wounds?.filter((w) => w.sever || w.stump).length ?? 0, decals, monkey: !!P.groups.chest.getObjectByName('ratna-monkey'), bag: !!P.groups.chest.getObjectByName('ratna-bag') };
  });
  await p2.evaluate(() => { window.game.world.step = () => {}; window.game.ai.update = () => {}; });
  await nextFrames(p2, 4);
  await p2.screenshot({ path: `${out}/route_hero.png` });
  console.log('route hero:', JSON.stringify(info2));
  await p2.close();
}

await browser.close();
console.log(out, errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
