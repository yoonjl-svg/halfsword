// 찬다 · 병마용 그림과 브라우저 점검 (docs/import/chanda_terra_port_2026-10-14.md · docs/import/chanda_terra/)
//  실행: 개발 서버를 띄운 뒤 (자기 포트 — 5173·5174 는 쓰지 않는다)
//    node tools/browser/chanda_terra_shots.mjs <주소> <출력 폴더> [갈래 …]
//  갈래 (없으면 views · knee · duel · line):
//   views   정면 · 왼옆 · 뒤 — 찬다 v1(샛별)·v2(우리) · 병마용 v1(샛별)·v2(우리). 상대 AI 를 끄고 판 시작 자세로 1.2 s 든 뒤 물리를 멈춰 (640×800)
//   detail  병마용 잔선 덜기 전/후 가까이 — 머리(머리 홈·얼굴 새김) · 가슴(엮은 끈) · 다리(솔기), v1 · v2 같은 자리 (640×640)
//   knee    찬다 무릎 전/후: 앞으로 디딘 다리 무릎을 굽힌 겨눔(동방 탄복세 — 칼자루를 오른 허리에)과 싸우는 중 무릎을 크게 굽힌 순간을 앞에서 가까이 (v1 · v2)
//   duel    결투 거리 — 게임 카메라 그대로 폰 가로 844×390(화면 배율 1): 판 시작 1.0 s · 싸우는 중 6 s (두 인물 · 무대 하나)
//   line    병마용 판 시작 소개 — 이름 · 칭호 · 대사 + 대사 아래 줄 출처(『사기』·『설원』) · 결과 창 부제의 대사·출처 (844×390)
//   prof    숙련도 확인: ?foe=chanda · ?foe=terracotta 를 30 s × 3 판씩(내 인물은 가만히) — AI 가 쓴 기술 이름을 모아 동방 고유 동작이 체보요격·좌익격 안인지, 비기 0 인지
//           (갈래 이름 뒤에 :chanda · :terracotta 를 붙이면 그 인물만 — 예: prof:chanda)
//   clay    병마용 몸 규칙 브라우저 점검: 같은 판에서 내 목·팔(사람)과 병마용 목·팔을 합성 상처로 자른 뒤 피 켬/끔 두 장 — 단면 색(사람 검붉은 살/회색, 흙은 흙빛 그대로)·출혈·목소리 호출
//  출력은 png (문서 그림은 tools/browser/chanda_terra_sheets.py 가 묶어 webp 로). 모든 장면에서 콘솔 오류·HTTP 400 이상을 모아 끝에 적는다
//  playwright 는 저장소 의존성에 없다. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium). 화면 배율은 1 (헤드리스 비용)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = (process.argv[2] || 'http://127.0.0.1:5400').replace(/\/$/, '');
const out = process.argv[3] || '/tmp/chanda_terra_shots';
const want = new Set(process.argv.slice(4));
const on = (k) => (!want.size && ['views', 'knee', 'duel', 'line'].includes(k)) || want.has(k);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const log = [];
const say = (s) => { console.log(s); log.push(s); };
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const PADS = { langort: [0.0, 0.03], pflugR: [0.32, -0.18], sideR: [0.52, 0.06], wechselR: [0.38, -0.44] };
const FOE = { chanda: { weapon: 'moye', pad: PADS.sideR }, terracotta: { weapon: 'ganjiang', pad: PADS.pflugR } };

function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`pageerror (${tag}): ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console (${tag}): ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()} (${tag}): ${r.url()}`); });
  page.on('request', (r) => { if (!r.url().startsWith(base) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) errors.push(`바깥 요청 (${tag}): ${r.url()}`); });
}
/** 상대 id(·판)로 판을 연다. look = 'chanda:v1' 꼴이면 그 판, 아니면 지금 판 */
async function open(look, { stage = 'arena', viewport = { width: 640, height: 800 }, ai = false, until = 1.2, extra = '' } = {}) {
  const id = look.split(':')[0];
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  watch(page, look);
  const lk = look.includes(':') ? `&look=${look}` : '';
  await page.goto(`${base}/?stage=${stage}&foe=${id}${lk}&weapon=longsword&foeWeapon=${FOE[id].weapon}&emo=0${extra}`, { waitUntil: 'networkidle' }); // weapon= 은 상대에게도 번지므로 상대 무기를 따로
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  if (!ai) await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction((t) => window.game.state === 'fight' && window.game.stats.simTime > t, until, { timeout: 900000 });
  return page;
}
async function hold(page, pad, secs = 1.2) {
  const t0 = await page.evaluate((pad) => { const g = window.game; g.enemy.handOffset.set(pad[0], pad[1]); return g.stats.simTime; }, pad);
  await page.waitForFunction((t) => window.game.stats.simTime > t, t0 + secs, { timeout: 900000 });
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
    const right = new T.Vector3(0, 1, 0).cross(fw).negate();
    const at = new T.Vector3(c.x, aim, c.z).addScaledVector(right, side);
    const dir = fw.clone().applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    g.camera.position.copy(at).addScaledVector(dir, dist).setY(h);
    g.camera.lookAt(at);
  }, { deg, dist, h, aim, side });
  await nextFrames(page, 4);
}
/** 상대 몸 부위(part) 가운데를 보는 카메라: 골반 앞 방향을 deg 만큼 돌린 쪽 dist m · 높이 +dh m (가까이 찍기) */
async function camAt(page, part, deg, dist, dh) {
  await page.evaluate(({ part, deg, dist, dh }) => {
    const g = window.game, T = g.THREE, E = g.enemy;
    const c = E.bodies[part].translation(), r = E.bodies.pelvis.rotation();
    const fw = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize();
    const at = new T.Vector3(c.x, c.y, c.z);
    const dir = fw.clone().applyAxisAngle(new T.Vector3(0, 1, 0), (deg * Math.PI) / 180);
    g.camera.position.copy(at).addScaledVector(dir, dist);
    g.camera.position.y += dh;
    g.camera.lookAt(at);
  }, { part, deg, dist, dh });
  await nextFrames(page, 4);
}
/** 상대의 몸·옷 삼각형 · 메쉬 수 · 칼 삼각형 · 메쉬 수 (지금 보이는 것 — 그림자 그리기 빼고, 컬링 전) */
async function count(page) {
  return page.evaluate(() => {
    const g = window.game, E = g.enemy;
    const tri = (root) => { let t = 0, m = 0; root.traverse((o) => { if (o.isMesh && o.visible !== false) { const geo = o.geometry; t += (geo.index ? geo.index.count : geo.attributes.position.count) / 3; m++; } }); return { t, m }; };
    let body = { t: 0, m: 0 };
    for (const grp of Object.values(E.groups)) { const r = tri(grp); body.t += r.t; body.m += r.m; }
    const sw = E.swordGroup ? tri(E.swordGroup) : { t: 0, m: 0 };
    return { body, sword: sw };
  });
}

if (on('views')) {
  for (const look of ['chanda:v1', 'chanda:v2', 'terracotta:v1', 'terracotta:v2']) {
    const [id, tag] = look.split(':');
    const page = await open(look);
    await hold(page, FOE[id].pad);
    const n = await count(page);
    say(`views ${look}: 몸·옷 ${n.body.t} 삼각형 · 메쉬 ${n.body.m} / 칼 ${n.sword.t} · ${n.sword.m} / 합 ${n.body.t + n.sword.t} · ${n.body.m + n.sword.m}`);
    await freeze(page);
    for (const [name, deg] of [['front', 0], ['left', 90], ['back', 180]]) {
      await cam(page, deg, 1.75, 1.1, 0.92);
      await page.screenshot({ path: `${out}/views_${id}_${tag}_${name}.png` });
    }
    await page.close();
  }
}

if (on('detail')) {
  for (const look of ['terracotta:v1', 'terracotta:v2']) {
    const tag = look.split(':')[1];
    const page = await open(look, { viewport: { width: 640, height: 640 } });
    await hold(page, FOE.terracotta.pad);
    await freeze(page);
    await camAt(page, 'head', 15, 0.42, 0.04);
    await page.screenshot({ path: `${out}/detail_${tag}_head.png` });
    await camAt(page, 'chest', 12, 0.55, 0.04);
    await page.screenshot({ path: `${out}/detail_${tag}_chest.png` });
    await camAt(page, 'shinF', 25, 0.7, 0.12);
    await page.screenshot({ path: `${out}/detail_${tag}_legs.png` });
    await page.close();
  }
}

if (on('knee')) {
  for (const look of ['chanda:v1', 'chanda:v2']) {
    const tag = look.split(':')[1];
    const page = await open(look, { viewport: { width: 640, height: 640 } });
    await hold(page, PADS.pflugR, 1.4); // 탄복세: 앞다리 무릎이 굽은 겨눔
    await freeze(page);
    const knee = await page.evaluate(() => { const g = window.game, s = g.enemy.bodies.shinF.translation(); return s.y + 0.21; });
    await cam(page, 0, 1.0, knee + 0.05, knee, 0);
    await page.screenshot({ path: `${out}/knee_${tag}_guard_front.png` });
    await cam(page, 35, 1.0, knee + 0.05, knee, 0);
    await page.screenshot({ path: `${out}/knee_${tag}_guard_34.png` });
    await page.close();
    // 무릎을 크게 굽힌 순간: 무릎 꿇기(일어서는 중 자세)
    const p2 = await open(look, { viewport: { width: 640, height: 640 } });
    await p2.evaluate(() => { const g = window.game; g.enemy.setState('getup'); g.enemy.downTime = 0; g.enemy.kneelTime = 99; });
    const t0 = await p2.evaluate(() => window.game.stats.simTime);
    await p2.waitForFunction((t) => window.game.stats.simTime > t, t0 + 1.2, { timeout: 900000 });
    await freeze(p2);
    const k2 = await p2.evaluate(() => { const g = window.game, s = g.enemy.bodies.shinF.translation(); return s.y; });
    await cam(p2, 0, 1.3, k2 + 0.35, k2 + 0.1, 0);
    await p2.screenshot({ path: `${out}/knee_${tag}_kneel_front.png` });
    await p2.close();
  }
}

if (on('duel')) {
  for (const id of ['chanda', 'terracotta']) {
    const p1 = await open(id, { stage: 'castle', viewport: { width: 844, height: 390 }, ai: true, until: 0.05 });
    await p1.waitForFunction(() => document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 60000 });
    await p1.screenshot({ path: `${out}/duel_${id}_start.png` });
    await p1.close();
    const p2 = await open(id, { stage: 'castle', viewport: { width: 844, height: 390 }, ai: true, until: 6.0 });
    await p2.evaluate(() => { window.game.world.step = () => {}; window.game.ai.update = () => {}; });
    await nextFrames(p2, 4);
    await p2.screenshot({ path: `${out}/duel_${id}_fight.png` });
    const info = await p2.evaluate(() => {
      const g = window.game, c = g.camera.position, h = g.enemy.bodies.head.translation();
      return { dist: Math.hypot(c.x - h.x, c.y - h.y, c.z - h.z), render: g.renderInfo() };
    });
    say(`duel ${id}: 카메라→머리 ${info.dist.toFixed(2)} m · 그리기 ${info.render.calls} · 삼각형 ${info.render.triangles}`);
    await p2.close();
  }
}

if (on('line')) {
  // 판 시작 소개 — 대사가 정해지는 randomLine 은 Math.random 을 쓴다. 출처가 『사기』·『설원』 둘 다 나오게 두 번 연다
  const seen = new Map();
  for (let k = 0; k < 8 && seen.size < 2; k++) {
    const p = await open('terracotta', { stage: 'castle', viewport: { width: 844, height: 390 }, ai: true, until: 0.05 });
    await p.waitForFunction(() => document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 60000 });
    const t = await p.evaluate(() => ({ name: document.querySelector('#foeIntro b').textContent, epithet: document.querySelector('#foeIntro i').textContent, line: document.querySelector('#foeIntro span').textContent, src: document.querySelector('#foeIntro small')?.textContent ?? null, style: (() => { const s = document.querySelector('#foeIntro small'); if (!s) return null; const cs = getComputedStyle(s); return `${cs.fontSize} · ${cs.fontWeight} · ${cs.color}`; })() }));
    if (!seen.has(t.src)) {
      seen.set(t.src, t);
      say(`line 소개: ${t.name} · ${t.epithet} · ${t.line} / 출처 줄 '${t.src}' (${t.style})`);
      await p.screenshot({ path: `${out}/line_intro_${seen.size}.png` });
    }
    await p.close();
  }
  // 결과 창: 병마용이 이긴 판(내가 죽음) — 내 목을 합성 상처로 베어 판을 끝내고 결과 창 부제를 본다
  const p = await open('terracotta', { stage: 'castle', viewport: { width: 844, height: 390 }, ai: true, until: 2.5 });
  await p.evaluate(() => { const g = window.game; g.player.die('목'); });
  await p.waitForFunction(() => document.getElementById('menuSub')?.textContent.includes('병마용'), null, { timeout: 120000 });
  await nextFrames(p, 4);
  const sub = await p.evaluate(() => ({ text: document.getElementById('menuSub').innerText, src: document.querySelector('#menuSub small')?.textContent ?? null }));
  say(`line 결과 창: ${sub.text.replace(/\n/g, ' / ')} (출처 줄 '${sub.src}')`);
  await p.screenshot({ path: `${out}/line_result.png` });
  await p.close();
}

if (on('prof') || want.has('prof:chanda') || want.has('prof:terracotta')) {
  for (const id of ['chanda', 'terracotta'].filter((x) => on('prof') || want.has(`prof:${x}`))) {
    const page = await browser.newPage({ viewport: { width: 320, height: 180 }, deviceScaleFactor: 1 }); // 그림을 쓰지 않으니 작게 (소프트웨어 그리기가 느려 판 시계가 늦게 간다)
    watch(page, `prof ${id}`);
    // ?foe=<id> (무기 카드 뽑기를 건너뛰려고 weapon= 을 주고, 그 값이 상대에게 번지지 않게 상대 무기는 시트 무기 그대로 foeWeapon= 으로)
    await page.goto(`${base}/?stage=arena&foe=${id}&weapon=longsword&foeWeapon=${FOE[id].weapon}&emo=0`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
    for (let round = 1; round <= 3; round++) {
      if (round === 1) await page.getByText('여정 시작').click({ timeout: 300000 });
      else await page.evaluate(() => document.getElementById('btnStart').click());
      await page.waitForFunction(() => window.game.state === 'fight' && window.game.player.fightT < 1 && window.game.enemy.alive && window.game.player.alive, null, { timeout: 900000 });
      // 내 인물은 가만히 (입력 없음) — AI 의 기술 고르기만 본다. 30 s 동안 기술 이름·비기 기록 (판 시계 = player.fightT)
      await page.evaluate(() => {
        const g = window.game, ai = g.ai, up = ai.update.bind(ai);
        g.__tech = {};
        g.__secret = 0;
        let last = null, lastSecret = false;
        ai.update = (dt) => {
          up(dt);
          const name = ai.feint?.name ?? ai.tech?.name ?? null;
          const key = ai.mode === 'attack' || ai.feint ? name : null;
          if (key && key !== last) g.__tech[key] = (g.__tech[key] || 0) + 1;
          last = key;
          const sec = !!ai.secretRun || ai.mode === 'secret';
          if (sec && !lastSecret) g.__secret++;
          lastSecret = sec;
        };
      });
      await page.waitForFunction(() => window.game.player.fightT > 30 || !window.game.enemy.alive || !window.game.player.alive, null, { timeout: 1800000 });
      const r = await page.evaluate(() => {
        const g = window.game, ai = g.ai;
        return { t: +g.player.fightT.toFixed(1), tech: g.__tech, secret: g.__secret, prof: ai.persona?.proficiency, aiProf: ai.proficiency, level: ai.levelName, secretArmed: !!ai.secret, tradition: g.enemy.swordArt?.tradition, weapon: g.enemy.weapon?.id, packUnique: (ai.school?.tech || []).map((t) => t.name).filter((n) => ['chebuYaoji', 'zuoyi', 'yaoji', 'lianchi'].includes(n)), alive: [g.player.alive, g.enemy.alive] };
      });
      say(`prof ${id} 판 ${round}: ${r.t} s · 무기 ${r.weapon} · 유파 ${r.tradition} · 실력 ${r.level} · 숙련도 ${JSON.stringify(r.prof)} · 비기 장착 ${r.secretArmed} · 꾸러미 고유 ${JSON.stringify(r.packUnique)} · 쓴 기술 ${JSON.stringify(r.tech)} · 비기 ${r.secret} · 산 사람(나·상대) ${JSON.stringify(r.alive)}`);
      writeFileSync(`${out}/prof_${id}_${round}.json`, JSON.stringify(r, null, 1));
      // 판을 끝낸다 (결과 창이 뜰 때까지) — 다음 판은 '다시 겨루기'
      await page.evaluate(() => { const g = window.game; if (g.state === 'fight' && g.player.alive && g.enemy.alive) g.player.die('기절'); });
      await page.waitForFunction(() => window.game.state === 'paused', null, { timeout: 120000 });
    }
    await page.close();
  }
}

if (on('clay')) {
  // ① 실전: 내 자리에도 AI(롱소드 · hard)를 붙여 병마용(시트 그대로)과 싸우게 한다 — main.js onWound 의 흙 몸 갈래(흙 알갱이 · 잔금 · 마른 타격음 · 칼에 피 안 묻음)를 진짜 타격으로 본다
  {
    const page = await open('terracotta', { stage: 'castle', viewport: { width: 320, height: 180 }, ai: true, until: 0.2 }); // 싸우는 동안은 작게 (그리기가 느리면 판 시계가 늦다) — 찍을 때 키운다
    await page.evaluate(() => {
      const g = window.game;
      const ai2 = new g.AI(g.player, g.enemy, 'hard');
      const up = g.ai.update.bind(g.ai);
      g.ai.update = (dt) => { up(dt); ai2.update(dt); };
      const c = (g.__c = { clayChips: 0, blood: 0, clay: 0, cut: 0, stab: 0, bone: 0, blunt: 0, hurtSilent: 0, deathSilent: 0, clayBreak: 0, decapitate: 0, sever: 0 });
      for (const k of ['clayChips', 'blood']) { const f = g.particles[k].bind(g.particles); g.particles[k] = (...a) => { c[k]++; return f(...a); }; }
      for (const k of ['clay', 'cut', 'stab', 'bone', 'blunt', 'clayBreak', 'decapitate', 'sever']) { const f = g.sound[k].bind(g.sound); g.sound[k] = (...a) => { c[k]++; return f(...a); }; }
      for (const k of ['hurt', 'death']) { const f = g.sound[k].bind(g.sound); g.sound[k] = (v, ...a) => { if (v === 'silent') c[`${k}Silent`]++; return f(v, ...a); }; }
      g.__maxBleed = 0;
      const vit = g.enemy.updateVitals.bind(g.enemy);
      g.enemy.updateVitals = (dt) => { vit(dt); g.__maxBleed = Math.max(g.__maxBleed, g.enemy.bleed, 1 - g.enemy.blood); };
    });
    await page.waitForFunction(() => window.game.player.fightT > 40 || !window.game.enemy.alive || !window.game.player.alive, null, { timeout: 2400000 });
    const t0 = await page.evaluate(() => window.game.stats.simTime);
    await page.waitForFunction((t) => window.game.stats.simTime > t, t0 + 1.0, { timeout: 600000 });
    const r = await page.evaluate(() => {
      const g = window.game, E = g.enemy, P = g.player, decals = {};
      for (const grp of Object.values(E.groups)) grp.traverse((o) => { if (o.userData?.kind) decals[o.userData.kind] = (decals[o.userData.kind] || 0) + 1; });
      return { t: +P.fightT.toFixed(1), calls: g.__c, maxBleedOr1mBlood: g.__maxBleed, enemy: { state: E.state, cause: E.causeOfDeath, decap: !!E.decapitated, wounds: E.wounds.length, severed: E.severed?.length ?? 0 }, player: { state: P.state, cause: P.causeOfDeath, bladeBlood: P.bladeBlood ?? 0 }, enemyDecals: decals };
    });
    say(`clay 실전: ${JSON.stringify(r)}`);
    // 병마용 몸통을 가까이 — 벤 자리의 잔금(흙 몸 자국)을 본다
    await page.setViewportSize({ width: 480, height: 480 });
    await freeze(page, true);
    await page.evaluate(() => { const g = window.game; for (const m of g.player.meshes) m.group.visible = true; if (g.player.swordGroup) g.player.swordGroup.visible = true; });
    await page.evaluate(() => {
      const g = window.game, T = g.THREE, c = g.enemy.bodies.chest.translation(), p = g.player.bodies.chest.translation();
      const toP = new T.Vector3(p.x - c.x, 0, p.z - c.z).normalize(); // 사람 쪽(맞은 쪽)에서
      g.camera.position.set(c.x + toP.x * 0.75, c.y + 0.35, c.z + toP.z * 0.75);
      g.camera.lookAt(new T.Vector3(c.x, c.y - 0.1, c.z));
    });
    await nextFrames(page, 6);
    await page.screenshot({ path: `${out}/clay_fight.png` });
    await page.close();
  }
  // ② 같은 판에서 사람(나)과 병마용의 팔·목을 합성 상처로 자른다 → 피 켬/끔. 단면 색 · 출혈 · 소리 호출 수를 읽고 두 몸의 목 단면을 가까이 찍는다
  for (const blood of [true, false]) {
    const page = await open('terracotta', { stage: 'castle', viewport: { width: 480, height: 480 }, until: 1.0 });
    const r = await page.evaluate((blood) => {
      const g = window.game, T = g.THREE, P = g.player, E = g.enemy;
      g.particles.bloodOn = blood;
      const calls = { hurt: 0, death: 0, decapitate: 0, sever: 0, clayBreak: 0 };
      for (const k of Object.keys(calls)) { const f = g.sound[k]?.bind(g.sound); if (f) g.sound[k] = (...a) => { calls[k]++; return f(...a); }; }
      const cut = (f, part, zone, local) => f.applyWound({ part, zone, type: 'cut', severity: 1.3, energy: 150, local: new T.Vector3(...local), dir: new T.Vector3(0, 0, 1), pass: true, passing: true, bleedPerSev: zone === 'neck' ? 0.2 : 0.012 });
      const elbow = (f) => { const a = f.jointByName.farmO.joint.anchor2(); return [a.x, a.y, a.z]; };
      cut(E, 'farmO', 'arm', elbow(E)); // 팔꿈치 (빈손 팔) 먼저 — 목이 떨어지면 판이 끝난다
      cut(P, 'farmO', 'arm', elbow(P));
      cut(E, 'chest', 'neck', [0.05, 0.19, 0]);
      cut(P, 'chest', 'neck', [0.05, 0.19, 0]);
      g.__calls = calls;
      return { E: { bleed: E.bleed, blood: E.blood, state: E.state, decap: !!E.decapitated, severed: E.severed?.length ?? 0 }, P: { bleed: +P.bleed.toFixed(3), state: P.state, decap: !!P.decapitated, severed: P.severed?.length ?? 0 } };
    }, blood);
    const t0 = await page.evaluate(() => window.game.stats.simTime);
    await page.waitForFunction((t) => window.game.stats.simTime > t, t0 + 0.6, { timeout: 600000 });
    const st = await page.evaluate(() => {
      const g = window.game, res = [];
      for (const [who, f] of [['사람', g.player], ['흙', g.enemy]]) for (const grp of Object.values(f.groups)) grp.traverse((o) => { if (o.name === 'decapStump' || o.name === 'limbStump') res.push(`${who} ${o.name} ${o.children.map((c) => c.material.color.getHexString()).join('/')}`); });
      return { res, calls: g.__calls, red: g.particles.list.filter((p) => [0x8a0000, 0x7a0000].includes(p.color.getHex())).length };
    });
    say(`clay 피 ${blood ? '켬' : '끔'}: ${JSON.stringify(r)} · 단면 ${JSON.stringify(st.res)} · 소리 호출 ${JSON.stringify(st.calls)} · 붉은 입자 ${st.red}`);
    await freeze(page, true);
    await page.evaluate(() => { const g = window.game; for (const m of g.player.meshes) m.group.visible = true; if (g.player.swordGroup) g.player.swordGroup.visible = true; });
    for (const [who, key] of [['human', 'player'], ['clay', 'enemy']]) {
      await page.evaluate((key) => {
        const g = window.game, T = g.THREE, f = g[key];
        const q = f.bodies.chest.rotation(), c = f.bodies.chest.translation();
        const up = new T.Vector3(0, 1, 0).applyQuaternion(new T.Quaternion(q.x, q.y, q.z, q.w));
        const at = new T.Vector3(c.x, c.y, c.z).addScaledVector(up, 0.17); // 목 단면 자리 (가슴 몸 기준 y 0.17)
        g.camera.position.copy(at).addScaledVector(up, 0.42).add(new T.Vector3(0.12, 0.25, 0.12));
        g.camera.lookAt(at);
      }, key);
      await nextFrames(page, 4);
      await page.screenshot({ path: `${out}/clay_blood_${blood ? 'on' : 'off'}_${who}.png` });
    }
    await page.close();
  }
}

await browser.close();
say(errors.length ? `오류 ${errors.length}:\n  ${errors.join('\n  ')}` : '콘솔 오류 0 · HTTP 400 이상 0 · 바깥 요청 0');
writeFileSync(`${out}/log.txt`, log.join('\n') + '\n');
