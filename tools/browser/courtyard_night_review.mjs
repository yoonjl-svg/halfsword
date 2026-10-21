// 밤의 봉인의 중정 들여오기 점검 (10/21 — docs/import/courtyard_night_2026-10-21.md): 빌드판(개발 서버)에서 수치 · 사진을 한 번에.
//  읽기만 — 게임 값을 바꾸지 않는다(사진을 위해 AI 를 멈추거나 카메라를 직접 두는 것은 그 페이지 안에서만).
//  모드 (--modes=cost,update,leak,journey,shots — 기본 cost,update,leak):
//   cost   : 무대마다 짓는 시간(ms, 네 바퀴 중 둘째 값) · 그리기 호출 · 삼각형(renderer.info, 판 시작 경기 화면) · 무대 빛 · 그림자 드리우는 메쉬 ·
//            무늬 메모리(어림) · 싸움 중 프레임 시간(AI 켬, 헤드리스 swiftshader — 무대끼리 견주기만)
//   update : 무대 update(dt) 한 번의 CPU 시간 · 힙에 쌓이는 바이트(가비지 — 프레임마다 새로 만드는 객체). 게임과 따로 지은 무대 하나로 잰다
//   leak   : 한 페이지에서 무대를 여러 바퀴 바꿔 GPU 자원(geometries · textures · programs) · 힙이 자라는지
//   journey: 여정 그대로(주소에 무대 · 상대 · 무기 없음) 밤의 산호 항구 → 이김 → 밤의 봉인의 중정(광기의 마야 · 세이버 · 프로필 그림) → 이김 → 밤의 잠든 습지
//   shots  : 문서 사진 (경기 화면 · 판 시작 훑기 · 급수정 물 · 연기 · 포격 자국 · 폰 844×390 배율 2)
//  실행: PW_CHROMIUM=<크롬> node tools/browser/courtyard_night_review.mjs <개발 서버 주소> <출력 폴더> [--modes=…] [--stages=…]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { STAGE_FOE } from '../../src/stages.js';

const base = (process.argv[2] || 'http://127.0.0.1:4581').replace(/\/$/, '');
const outDir = process.argv[3] || 'courtyard-night-review';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const MODES = arg('modes', 'cost,update,leak').split(',');
const STAGES = arg('stages', 'courtyard_night,courtyard,corsair_night,sluice_night,dayr_night').split(',');
fs.mkdirSync(outDir, { recursive: true });
const report = { errors: [], cost: [], update: [], leak: null, shots: [] };
const save = () => fs.writeFileSync(`${outDir}/review.json`, JSON.stringify(report, null, 1) + '\n');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const watch = (p, tag) => { p.on('pageerror', (e) => report.errors.push(`${tag}: ${e}`)); p.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${tag}: ${m.text()}`); }); };
const HIDE_UI = 'body > :not(#game){visibility:hidden!important}';
const foeWeapon = (stage) => CHARACTERS_BY_ID[STAGE_FOE[stage]]?.weapon ?? 'longsword';

/** 페이지 안: 무대가 더한 것(두 검객 밖)의 수 — 메쉬 · 삼각형 · 빛 · 그림자 드리우는 메쉬 · 투명 · 무늬 메모리 */
const STAGE_COUNT = () => {
  const fighter = new Set(); for (const g of game.fighterMeshes) g.traverse((o) => fighter.add(o));
  let meshes = 0, tris = 0, lights = 0, shadowLights = 0, casters = 0, casterTris = 0, transparent = 0, sprites = 0, points = 0; const tex = new Map();
  game.scene.traverseVisible((o) => {
    if (fighter.has(o)) return;
    if (o.isLight) { lights++; if (o.castShadow) shadowLights++; }
    if (o.isSprite) sprites++;
    if (o.isPoints) points++;
    if (!o.isMesh && !o.isPoints && !o.isSprite) return;
    const g = o.geometry, t = o.isMesh && !o.isSprite ? (g.index ? g.index.count : g.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1) : 0;
    if (o.isMesh) { meshes++; tris += t; if (o.castShadow) { casters++; casterTris += t; } }
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m) continue; if (m.transparent) transparent++;
      for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap', 'aoMap']) { const x = m[k]; if (x?.image) tex.set(x.uuid, { w: x.image.width, h: x.image.height, mip: x.generateMipmaps !== false }); }
    }
  });
  const texMB = [...tex.values()].reduce((s, x) => s + x.w * x.h * 4 * (x.mip ? 4 / 3 : 1), 0) / 1048576;
  return { meshes, tris: Math.round(tris), lights, shadowLights, casters, casterTris: Math.round(casterTris), transparent, sprites, points, textures: tex.size, texMB: +texMB.toFixed(1) };
};

async function openFight(stage, { viewport = { width: 844, height: 420 }, dpr = 1, mobile = false, clock = false, freeze = false } = {}) {
  const p = await browser.newPage({ viewport, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile || true });
  watch(p, stage);
  if (clock) { await p.clock.install({ time: new Date('2026-10-21T15:00:00Z') }); await p.clock.pauseAt(new Date('2026-10-21T15:00:01Z')); }
  await p.goto(`${base}/?stage=${stage}&weapon=longsword&foeWeapon=${foeWeapon(stage)}&emo=0`, { waitUntil: 'networkidle' });
  if (clock) {
    await p.evaluate(() => { game.renderCap.tick = () => false; });
    for (let i = 0; i < 400 && await p.evaluate(() => !window.game?.player?.sword); i++) await p.clock.runFor(50);
    await p.evaluate(() => document.getElementById('btnStart').click());
    for (let i = 0; i < 300 && await p.evaluate(() => game.state !== 'fight'); i++) await p.clock.runFor(16);
  } else {
    await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
    await p.getByText('여정 시작').click();
    await p.waitForFunction(() => game.state === 'fight', null, { timeout: 120000 });
  }
  if (freeze) await p.evaluate(() => { game.ai.update = () => {}; });
  return p;
}

try {
  // ── cost ──
  if (MODES.includes('cost')) {
    for (const stage of STAGES) {
      const p = await openFight(stage);
      // 판 시작 훑기(약 4 s)가 끝나고 싸움이 이어지는 동안 — 그리기 양은 경기 카메라에서, 프레임 시간은 AI 가 움직이는 1.5 s
      await p.waitForFunction(() => game.stats.simTime > 5, null, { timeout: 240000 });
      const r = await p.evaluate(() => new Promise((ok) => {
        const ts = []; const f = (t) => { ts.push(t); if (ts.length < 61) return requestAnimationFrame(f);
          const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b), info = game.renderInfo();
          ok({ calls: info.calls, triangles: info.triangles, geometries: info.geometries, textures: info.textures, programs: info.programs, frameMs: +d[d.length >> 1].toFixed(1), frameP90: +d[Math.floor(d.length * .9)].toFixed(1) });
        }; requestAnimationFrame(f);
      }));
      const s = await p.evaluate(STAGE_COUNT);
      // 그리기 한 번의 시간: AI 를 멈춘 경기 화면에서 render + gl.finish 를 25 번 (가운데 값). rAF 간격보다 덜 흔들린다 (같은 기계의 다른 일에 덜 휘둘림).
      //  일시정지(P)하면 게임이 그리지 않아 렌더러를 붙잡을 수 없다 — 멈추지 않고 AI 만 세운다
      await p.evaluate(() => { game.ai.update = () => {}; });
      const renderMs = await p.evaluate(() => new Promise((ok) => {
        // three 의 render 는 렌더러마다 붙는 함수라 원형(prototype)을 가로챌 수 없다 — 장면의 onBeforeRender 가 렌더러를 넘겨준다
        game.scene.onBeforeRender = function (r) { window.__renderer = r; delete this.onBeforeRender; };
        let tries = 0;
        const go = () => {
          if (!window.__renderer) { if (++tries > 30) ok(null); else requestAnimationFrame(go); return; }
          const r = window.__renderer, gl = r.getContext(), d = [];
          for (let i = 0; i < 25; i++) { const t0 = performance.now(); r.render(game.scene, game.camera); gl.finish(); d.push(performance.now() - t0); }
          d.sort((a, b) => a - b); ok(+d[d.length >> 1].toFixed(1));
        };
        requestAnimationFrame(go);
      }));
      report.cost.push({ stage, ...r, renderMs, stageOnly: s }); save(); console.log('cost', stage, renderMs, JSON.stringify(r), JSON.stringify(s));
      await p.close();
    }
    // 짓는 시간: 한 페이지에서 무대를 네 바퀴 바꾸며 game.stage.buildMs · warmMs (첫 바퀴는 데우기 — 둘째 ~ 넷째의 가운데 값)
    const p = await browser.newPage({ viewport: { width: 844, height: 420 } }); watch(p, 'build');
    await p.goto(`${base}/?stage=poseidon&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
    const times = await p.evaluate((ids) => { const out = {}; for (let lap = 0; lap < 4; lap++) for (const id of ids) { game.setStage(id); (out[id] ??= []).push([+game.stage.buildMs.toFixed(0), +game.stage.warmMs.toFixed(0)]); } return out; }, STAGES);
    for (const [id, a] of Object.entries(times)) {
      const b = a.slice(1).map((x) => x[0]).sort((x, y) => x - y), w = a.slice(1).map((x) => x[1]).sort((x, y) => x - y);
      const row = report.cost.find((x) => x.stage === id); if (row) Object.assign(row, { buildMs: b[1], warmMs: w[1], buildAll: a });
    }
    await p.close(); save(); console.log('build', JSON.stringify(times));
  }
  // ── update ──
  if (MODES.includes('update')) {
    const p = await browser.newPage({ viewport: { width: 640, height: 360 } }); watch(p, 'update');
    await p.goto(`${base}/?stage=poseidon&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
    for (const stage of STAGES) {
      const r = await p.evaluate(async (id) => {
        const T = game.THREE, { Stages } = await import('/src/stages.js');
        const scene = new T.Scene(), hemi = new T.HemisphereLight(), sun = new T.DirectionalLight(); scene.add(hemi, sun, sun.target);
        const st = new Stages(scene, { hemi, sun }); const a = st.build(id); a.onEvent = () => {};
        for (let i = 0; i < 3000; i++) a.update(1 / 60); // 데우기 — 최적화 단계가 다 올라온 뒤(약 50 s 어치)의 값을 잰다. 300 번이면 덜 데워져 숫자 계산마다 힙에 상자가 생긴다
        // 400 번씩 여덟 토막: 토막마다 gc 뒤 힙 차이 ÷ 400 (토막 안에서 청소가 돌면 작게 나오므로 가운데 값) · 시간은 전체 평균
        const N = 400, per = []; let spent = 0;
        for (let k = 0; k < 8; k++) {
          gc(); gc(); const h0 = performance.memory.usedJSHeapSize, t0 = performance.now();
          for (let i = 0; i < N; i++) a.update(1 / 60);
          spent += performance.now() - t0;
          per.push((performance.memory.usedJSHeapSize - h0) / N);
        }
        const ms = spent / (8 * N); per.sort((x, y) => x - y);
        st.clear(); gc();
        return { stage: id, updateMs: +ms.toFixed(4), heapBytesPerUpdate: Math.round(per[4]), heapAll: per.map(Math.round) };
      }, stage);
      report.update.push(r); save(); console.log('update', JSON.stringify(r));
    }
    await p.close();
  }
  // ── leak ──
  if (MODES.includes('leak')) {
    const p = await browser.newPage({ viewport: { width: 844, height: 420 } }); watch(p, 'leak');
    await p.goto(`${base}/?stage=courtyard&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
    const info = () => p.evaluate(() => { gc(); gc(); const r = game.renderInfo(); return { stage: game.stage.id, geometries: r.geometries, textures: r.textures, programs: r.programs, heapMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) }; });
    const ORDER = ['courtyard_night', 'corsair_night', 'courtyard', 'sluice_night', 'courtyard_night', 'poseidon'];
    const rows = [];
    for (let lap = 1; lap <= 3; lap++) for (const id of ORDER) {
      await p.evaluate((x) => game.setStage(x), id); await p.waitForTimeout(400);
      rows.push({ lap, ...(await info()) });
    }
    const at = (lap, id) => rows.find((x) => x.lap === lap && x.stage === id);
    const d = (k) => at(3, 'poseidon')[k] - at(1, 'poseidon')[k];
    report.leak = { rows, lap1to3AtPoseidon: { geometries: d('geometries'), textures: d('textures'), programs: d('programs'), heapMB: +d('heapMB').toFixed(1) } };
    save(); console.log('leak', JSON.stringify(report.leak.lap1to3AtPoseidon)); await p.close();
  }
  // ── journey ──  여정 그대로(주소에 stage · foe · weapon 없음 — 무기 카드 뽑기 있음): 밤의 산호 항구에서 시작해 이기면 → 밤의 봉인의 중정(광기의 마야 · 세이버) → 밤의 잠든 습지
  if (MODES.includes('journey')) {
    const p = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true }); watch(p, 'journey');
    p.setDefaultTimeout(300000);
    await p.goto(`${base}/?emo=0`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
    await p.evaluate(() => game.setStage('corsair_night'));
    const rows = [];
    for (let round = 0; round < 3; round++) {
      await p.locator('#btnStart').click();
      await p.waitForFunction(() => game.state === 'draw' && game.draw.t > 0.6, null, { timeout: 300000 });
      const foeWeapon = await p.evaluate(() => game.draw.ids[2]);
      await p.locator('#draw .wcard[data-i="0"]').tap();
      await p.waitForFunction(() => game.state === 'fight', null, { timeout: 300000 });
      const r = await p.evaluate(async () => {
        const { portraitSrc } = await import('/src/portraits.js');
        return { stage: game.stage.id, label: document.querySelector('#stageInfo .stg')?.textContent, foe: game.enemy.name, enemyWeapon: game.enemy.weapon?.id,
          intro: document.querySelector('#foeIntro b')?.textContent, epithet: document.querySelector('#foeIntro i')?.textContent, line: document.querySelector('#foeIntro span')?.textContent,
          story: !!game.scene.getObjectByName(game.stage.id + '-story'), obstacle: game.arenaObstacle?.colliderCount ?? 0, portrait: game.stage.id === 'courtyard_night' ? portraitSrc('samira_mad') : null }; // 프로필 그림은 밤의 중정 판만 본다
      });
      r.foeWeapon = foeWeapon;
      if (r.portrait) r.portraitStatus = (await p.request.get(`${base}/${r.portrait}`)).status();
      rows.push(r); console.log('journey', JSON.stringify(r));
      await p.evaluate(() => game.enemy.die('내려찍기')); // 부활하지 않는 원인 → 이긴 판 → '다음 여정'
      await p.waitForFunction(() => document.querySelector('#btnStart')?.offsetParent && /다음 여정/.test(document.querySelector('#btnStart').textContent), null, { timeout: 300000 });
    }
    report.journey = rows; save(); await p.close();
  }
  // ── shots ──
  if (MODES.includes('shots')) {
    const SHOT = arg('shot', 'courtyard_night');
    const shoot = async (p, file) => { await p.evaluate(() => { game.renderCap.tick = () => true; }); await p.clock.runFor(48); await p.screenshot({ path: `${outDir}/${file}`, timeout: 120000 }); await p.evaluate(() => { game.renderCap.tick = () => false; }); report.shots.push(file); save(); console.log('shot', file); };
    const VIEWS_ONLY = !!arg('viewsOnly', ''); // --viewsOnly=1: 고정 카메라 사진만 (고치기 전 · 뒤 견주기)
    // 판 시작 훑기: u 0.15 · 0.5 · 0.85 (가짜 시계 — 훑기 자리를 u 로 고정)
    if (!VIEWS_ONLY) {
      const p = await openFight(SHOT, { clock: true, freeze: true }); await p.addStyleTag({ content: HIDE_UI });
      for (const u of [0.15, 0.5, 0.85]) { await p.evaluate((x) => { game.camOpen.u = x; }, u); await shoot(p, `${SHOT}_sweep_${Math.round(u * 100)}.png`); }
      await p.evaluate(() => { game.camOpen.u = null; }); await p.clock.runFor(4600);
      await shoot(p, `${SHOT}_fight_start.png`);
      await p.close();
    }
    // 싸움 (AI 켬): 6 s · 12 s 뒤 경기 카메라 그대로 — 두 사람과 칼이 어둠에서 읽히는가
    if (!VIEWS_ONLY) {
      const p = await openFight(SHOT, { clock: true }); await p.addStyleTag({ content: HIDE_UI });
      await p.clock.runFor(6500); await shoot(p, `${SHOT}_fight_6s.png`);
      await p.clock.runFor(6000); await shoot(p, `${SHOT}_fight_12s.png`);
      await p.close();
    }
    // 폰 844×390 배율 2 (글자 그대로)
    if (!VIEWS_ONLY) {
      const p = await openFight(SHOT, { clock: true, viewport: { width: 844, height: 390 }, dpr: 2, mobile: true });
      await p.clock.runFor(6500); await shoot(p, `${SHOT}_phone_844x390.png`);
      await p.close();
    }
    // 고정 카메라: 급수정 물 · 연기 · 포격 자국 · 위에서 본 짜임 (game.freeCam — 카메라를 직접 둔다)
    {
      const p = await openFight(SHOT, { clock: true, freeze: true }); await p.addStyleTag({ content: HIDE_UI });
      await p.clock.runFor(4600);
      // 두 사람을 급수정 · 카메라 밖으로 옮긴다 (몸 · 칼 · 닻을 함께) — 가까이 찍는 자리를 몸이 가리지 않게
      await p.evaluate(() => {
        const shift = (f, x, z) => { const t0 = f.bodies.pelvis.translation(), dx = x - t0.x, dz = z - t0.z;
          for (const rb of new Set([...f.meshes.map((m) => m.rb), f.anchor])) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); rb.setLinvel({ x: 0, y: 0, z: 0 }, true); rb.setAngvel({ x: 0, y: 0, z: 0 }, true); } };
        shift(game.player, 2.5, -6.5); shift(game.enemy, 5, -6);
      });
      await p.clock.runFor(600);
      // 세상 좌표: 배경은 반 바퀴 돌아(TURN) 문루 · 계단 우물이 +x(마야 뒤) · 북쪽 회랑이 +z · 동쪽 채가 −x(내 뒤). 급수정의 깨진 지붕 귀퉁이 · 새는 물은 −x 쪽(내 시작 자리 쪽)
      const VIEWS = JSON.parse(arg('views', 'null')) ?? [
        ['leak', [-2.4, 1.3, 0.9], [-0.7, 0.85, 0.1]],
        ['cover_roof', [-2.9, 3.7, 2.6], [-0.3, 2.75, 0.4]],
        ['smoke_gate', [-4, 2, 2], [33, 7, 4]],
        ['smoke_wide', [6, 3, -6], [-14, 6, 16]],
        ['damage_arcade', [2, 2.4, 9], [18, 2.2, 26]],
        ['damage_arcade_hole', [-6, 2.2, 13], [-10.8, 2.8, 28]],
        ['damage_east', [-8, 2.2, 4], [-30, 2.5, -2]],
        ['well_rope', [8, 3.2, 3], [14.1, 1.5, -2]],
        ['top', [0, 62, 9], [0, 0, 0]],
      ];
      for (const [name, pos, look] of VIEWS) {
        await p.evaluate(([a, b]) => { game.freeCam = true; game.camera.position.set(...a); game.camera.lookAt(...b); game.camera.updateMatrixWorld(); }, [pos, look]);
        await shoot(p, `${SHOT}_${name}.png`);
      }
      await p.close();
    }
  }
} finally {
  save(); await browser.close();
  console.log(report.errors.length ? `오류 ${report.errors.length}:\n${report.errors.slice(0, 20).join('\n')}` : '페이지 오류 0');
}
