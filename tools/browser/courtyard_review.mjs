// 봉인의 중정 디자인 리뷰 (10/17 — docs/design/courtyard_review_2026-10-17.md): 빌드판에서 사진 · 수치를 한 번에.
//  읽기만 — 게임 값을 바꾸지 않는다(사진을 위해 AI 를 멈추거나 카메라를 직접 두는 것은 그 페이지 안에서만).
//  모드 (--modes=compare,phones,positions,mask,details,cost,sound — 기본 모두):
//   compare   : 같은 틀로 찍은 무대 견주기 (844×390, 화면 글자 숨김) — 경기 카메라(판 시작 자리) · 고정 넓은 각 A(내 뒤) · B(상대 뒤) · C(지평선)
//               무대: corsair · courtyard · sluice · dayr · dayr_night · loggia (마야가 지금 나오는 붉은 회랑)
//   phones    : 중정 경기 화면(글자 그대로) 844×390 · 667×375 · 1280×720 + 판 시작 훑기 가운데(u 0.5)
//   positions : 두 사람을 정해 둔 자리로 옮겨 경기 카메라 그대로 찍기 (중정: 급수정에 등을 붙임 · 돌 너머 상대 · 옆에서 붙음 · 구운 그늘 안 / 비교: 습지 석상에 등)
//   mask      : 판 시작 경기 화면에서 가운데 장애물(급수정 · 습지 석상)이 덮는 화면 몫 — 장애물만 단색으로 그려 센다
//   details   : 위에서 본 짜임 · 붉은 밀랍과 전령 가방(가까이 · 경기 카메라 자리에서) · 봉인된 문 · 계단 우물 · 잔잔할 때 ↔ 돌풍 한가운데
//   cost     : 그리기 양 · 짓는 시간 · 무늬 메모리(어림) — corsair · courtyard · sluice · dayr · dayr_night · loggia (가짜 시계 없이)
//   sound     : 무대 바탕 소리 크기 — 실제 무대 소리 코드(game.sound 의 StageDetailSound)를 OfflineAudioContext 로 12 s 그려 RMS · 세부음 꼭짓값
//  실행: PW_CHROMIUM=<크롬> node tools/browser/courtyard_review.mjs <빌드판 주소> <출력 폴더> [--modes=…]
import fs from 'node:fs';
import { chromium } from 'playwright';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { STAGE_FOE } from '../../src/stages.js';

const base = (process.argv[2] || 'http://127.0.0.1:4471').replace(/\/$/, '');
const outDir = process.argv[3] || '/tmp/courtyard-review';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const MODES = arg('modes', 'compare,phones,positions,mask,details,cost,sound').split(',');
fs.mkdirSync(outDir, { recursive: true });
const report = { errors: [], compare: [], phones: [], positions: [], mask: [], cost: [], sound: [] };
const save = () => fs.writeFileSync(`${outDir}/review.json`, JSON.stringify(report, null, 1) + '\n');

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const watch = (p, tag) => { p.on('pageerror', (e) => report.errors.push(`${tag}: ${e}`)); p.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${tag}: ${m.text()}`); }); };
const HIDE_UI = 'body > :not(#game){visibility:hidden!important}';

/** 주소로 판을 열고 판 시작 훑기가 끝날 때까지 (가짜 시계). freeze: AI 를 멈춰 두 사람이 시작 자리에 선 채 */
async function openFight(stage, { foe = null, viewport = { width: 844, height: 390 }, freeze = true, settle = 4200 } = {}) {
  const p = await browser.newPage({ viewport, hasTouch: true });
  watch(p, `${stage}/${foe ?? 'stage'}`);
  await p.clock.install({ time: new Date('2026-10-17T15:00:00Z') }); await p.clock.pauseAt(new Date('2026-10-17T15:00:01Z'));
  // &weapon=longsword 는 상대 무기까지 롱소드로 정한다(main.js FIXED_WEAPON 이 인물 무기보다 앞) — 상대 무기는 그 인물 시트 무기로 따로 준다(마야 = 권총)
  const foeWeapon = CHARACTERS_BY_ID[foe ?? STAGE_FOE[stage]]?.weapon ?? 'longsword';
  await p.goto(`${base}/?stage=${stage}&weapon=longsword&foeWeapon=${foeWeapon}&emo=0${foe ? `&foe=${foe}` : ''}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => { game.renderCap.tick = () => false; document.getElementById('btnStart').click(); });
  for (let i = 0; i < 300 && await p.evaluate(() => game.state !== 'fight'); i++) await p.clock.runFor(16);
  if (freeze) await p.evaluate(() => { game.ai.update = () => {}; });
  if (settle) await p.clock.runFor(settle);
  return p;
}
async function shot(p, file) {
  await p.evaluate(() => { game.renderCap.tick = () => true; }); await p.clock.runFor(48);
  await p.screenshot({ path: `${outDir}/${file}`, timeout: 120000 });
  await p.evaluate(() => { game.renderCap.tick = () => false; });
}
/** 페이지 안: 두 사람을 (x, z) 로 옮긴다 (몸 · 칼 · 닻을 함께) */
async function place(p, [px, pz], [ex, ez]) {
  await p.evaluate(([a, b]) => {
    const shift = (f, x, z) => { const t0 = f.bodies.pelvis.translation(), dx = x - t0.x, dz = z - t0.z;
      for (const rb of new Set([...f.meshes.map((m) => m.rb), f.anchor])) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); rb.setLinvel({ x: 0, y: 0, z: 0 }, true); rb.setAngvel({ x: 0, y: 0, z: 0 }, true); } };
    shift(game.player, ...a); shift(game.enemy, ...b);
  }, [[px, pz], [ex, ez]]);
}

try {
  // ── compare ──
  if (MODES.includes('compare')) {
    const STAGES = (arg('stages', 'corsair,courtyard,sluice,dayr,dayr_night,loggia')).split(',');
    const VIEWS = { wideA: [[-9.6, 3.6, 3.8], [6, 1.4, -0.5], 62], wideB: [[9.6, 3.6, -3.8], [-6, 1.4, 0.5], 62], horizon: [[-7, 1.7, 0.6], [30, 5.5, 0], 62] };
    for (const stage of STAGES) {
      const p = await openFight(stage, { foe: stage === 'loggia' ? 'samira' : null });
      await p.addStyleTag({ content: HIDE_UI });
      await shot(p, `cmp_fight_${stage}.png`);
      const row = { stage, cam: await p.evaluate(() => game.camera.position.toArray().map((v) => +v.toFixed(2))), foe: await p.evaluate(() => game.enemy.name) };
      for (const [name, [pos, look, fov]] of Object.entries(VIEWS)) {
        await p.evaluate(([pos, look, fov]) => { game.freeCam = true; game.camera.position.set(...pos); game.camera.lookAt(...look); game.camera.fov = fov; game.camera.updateProjectionMatrix(); }, [pos, look, fov]);
        await shot(p, `cmp_${name}_${stage}.png`);
      }
      report.compare.push(row); save(); console.log('compare', stage);
      await p.close();
    }
  }
  // ── phones ──
  if (MODES.includes('phones')) {
    for (const [w, h] of [[844, 390], [667, 375], [1280, 720]]) {
      const p = await openFight('courtyard', { viewport: { width: w, height: h } });
      await shot(p, `phone_${w}x${h}.png`);
      report.phones.push({ w, h, cam: await p.evaluate(() => game.camera.position.toArray().map((v) => +v.toFixed(2))) });
      await p.close();
    }
    // 판 시작 훑기 가운데 (무대를 보여 주는 때)
    const p = await openFight('courtyard', { settle: 0 });
    await p.evaluate(() => { game.camOpen.u = 0.5; }); await p.clock.runFor(200);
    await shot(p, 'phone_sweep_mid.png');
    await p.evaluate(() => { game.camOpen.u = 0.12; }); await p.clock.runFor(200);
    await shot(p, 'phone_sweep_start.png');
    await p.close(); save(); console.log('phones ok');
  }
  // ── positions ──
  if (MODES.includes('positions')) {
    // [이름, 내 자리, 상대 자리] — 급수정 충돌 겉: 세상 x ±0.85 · z ±1.1 (받침), 길잡이 반지름 1.45
    const CASES = [
      ['back_to_well', [-1.25, 0.2], [-3.2, 0.6]], // 급수정에 등을 붙이고 바깥을 보며 싸움 → 카메라가 돌에 막혀 등 바로 뒤로 당겨진다
      ['back_to_well_side', [0.3, 1.45], [0.6, 3.5]],
      ['across_well_gun', [-2.4, 0.3], [2.6, -0.2]], // 돌 너머 총 거리 — 숨었을 때 보이는 것
      ['beside_well', [-1.6, 1.9], [0.6, 2.3]], // 급수정 옆에서 칼 닿는 거리
      ['in_baked_shade', [-4.6, 0.4], [-2.2, 2.0]], // 상대가 바닥에 구운 급수정 그늘(세상 x −3.1 ~ 1.1 · z −1.3 ~ 5.1 쪽 평행사변형) 안 — 급수정은 실제 그림자를 드리우지 않아 몸은 햇빛 그대로
      ['bear_back', [-1.12, 0.25], [-3.1, 0.6], 'sluice'], // (비교) 잠든 습지 석상(받침 반지름 0.86 · 보호 원 1.18 m)에 등을 붙임 — 같은 카메라 함수
      ['bear_back_side', [0.15, 1.12], [0.4, 3.1], 'sluice'],
    ];
    for (const [name, a, b, stage = 'courtyard'] of CASES) {
      const p = await openFight(stage);
      await place(p, a, b); await p.clock.runFor(1600);
      await shot(p, `pos_${name}.png`);
      const info = await p.evaluate(() => { const c = game.camera.position, m = game.player.com ?? game.player.bodies.pelvis.translation();
        return { cam: [c.x, c.y, c.z].map((v) => +v.toFixed(2)), camToMe: +Math.hypot(c.x - m.x, c.z - m.z).toFixed(2), me: [m.x, m.z].map((v) => +v.toFixed(2)) }; });
      report.positions.push({ name, a, b, ...info }); save(); console.log('position', name, JSON.stringify(info));
      await p.close();
    }
  }
  // ── mask: 판 시작 경기 화면에서 가운데 장애물이 덮는 화면 몫 (장애물만 단색으로 그려 화소를 센다) — 중정 급수정 ↔ 잠든 습지 석상 ──
  if (MODES.includes('mask')) {
    for (const [stage, name] of [['courtyard', 'courtyard-cover'], ['sluice', 'sluice-sun-bear-statue']]) {
      const p = await openFight(stage);
      await p.addStyleTag({ content: HIDE_UI });
      const share = await p.evaluate(async (name) => {
        const T = game.THREE, target = game.scene.getObjectByName(name);
        if (!target) return null;
        const keep = new Set(); target.traverse((o) => keep.add(o)); for (let o = target; o; o = o.parent) keep.add(o);
        const undo = [];
        game.scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isSprite || o.isLine) && !keep.has(o)) { undo.push([o, o.visible]); o.visible = false; } });
        const mat = new T.MeshBasicMaterial({ color: 0xff0000 }), mats = [];
        target.traverse((o) => { if (o.isMesh) { mats.push([o, o.material]); o.material = mat; } });
        const bg = game.scene.background, fog = game.scene.fog; game.scene.background = new T.Color(0); game.scene.fog = null;
        game.renderCap.tick = () => true; // 그리기는 아래 clock.runFor 에서 (가짜 시계가 멈춰 있어 여기서 화면 갱신을 기다리면 안 끝난다)
        window.__undoMask = () => { for (const [o, v] of undo) o.visible = v; for (const [o, m] of mats) o.material = m; game.scene.background = bg; game.scene.fog = fog; };
        return true;
      }, name);
      await p.clock.runFor(64);
      const buf = await p.screenshot({ path: `${outDir}/mask_${stage}.png` });
      const frac = await p.evaluate(async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, im.width, im.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 80 && d[i + 2] < 80) n++; return n / (d.length / 4); }, buf.toString('base64'));
      report.mask = report.mask ?? []; report.mask.push({ stage, name, found: share, screenShare: +frac.toFixed(3) }); save(); console.log('mask', stage, frac.toFixed(3));
      await p.close();
    }
  }
  // ── details: 무대 짜임 · 이야기 소품 · 계단 우물 (고정 카메라, 화면 글자 숨김) ──
  if (MODES.includes('details')) {
    // 세상 좌표: 배경이 −90° 돌아 있어 무대 파일의 (x, z) → 세상 (−z, x). 봉인된 문 x ≈ 22.3 · 전령 가방 (20.8, 4.9) · 계단 우물 가운데 (1, −21)
    const VIEWS = [
      ['plan', [0, 62, 0], [0, 0, 0], 55, [1, 0, 0]], // 위에서 본 짜임 (결투장 반지름 9.19 m) — 화면 위 = +x(마야 · 봉인된 문 쪽)
      ['seal_close', [18.3, 1.25, 6.2], [20.5, 0.12, 4.6], 50], // 붉은 밀랍 · 전령 가방 가까이
      ['seal_from_fight', [-5.75, 2.31, 2.73], [21, 0.2, 4.7], 55], // 경기 카메라 자리에서 그 소품 쪽 (보이나)
      ['gate', [12.5, 2.2, 1.0], [22.3, 3.2, 0], 58], // 봉인된 문 (마야 뒤)
      ['stepwell', [9.5, 7.5, -9.5], [1, -1.5, -21], 60], // 계단 우물 (바오리)
    ];
    const p = await openFight('courtyard');
    await p.addStyleTag({ content: HIDE_UI });
    for (const [name, pos, look, fov, up = [0, 1, 0]] of VIEWS) {
      await p.evaluate(([pos, look, fov, up]) => { game.freeCam = true; game.camera.position.set(...pos); game.camera.up.set(...up); game.camera.lookAt(...look); game.camera.fov = fov; game.camera.far = Math.max(game.camera.far, 400); game.camera.updateProjectionMatrix(); }, [pos, look, fov, up]);
      await shot(p, `detail_${name}.png`);
    }
    await p.close();
    // 돌풍 한가운데(땅 먼지 투명도 = 0.10 + 돌풍 × 0.3 이 0.36 넘을 때) ↔ 잔잔할 때 — 같은 경기 카메라, 바람이 화면에서 읽히나
    const q = await openFight('courtyard');
    await q.addStyleTag({ content: HIDE_UI });
    const dustOp = () => q.evaluate(() => game.scene.getObjectByName('courtyard-ground-dust').material.opacity);
    for (let i = 0; i < 160 && await dustOp() > 0.11; i++) await q.clock.runFor(125);
    await shot(q, 'detail_calm.png');
    const calm = await dustOp();
    for (let i = 0; i < 200 && await dustOp() < 0.36; i++) await q.clock.runFor(125);
    await shot(q, 'detail_gust.png');
    report.gust = { calmOpacity: +calm.toFixed(3), gustOpacity: +(await dustOp()).toFixed(3) }; save();
    await q.close(); console.log('details ok', JSON.stringify(report.gust));
  }
  // ── cost ──
  if (MODES.includes('cost')) {
    const STAGES = (arg('costStages', 'corsair,courtyard,sluice,dayr,dayr_night,loggia')).split(',');
    for (const stage of STAGES) {
      const p = await browser.newPage({ viewport: { width: 844, height: 420 }, deviceScaleFactor: 1 });
      watch(p, `cost ${stage}`);
      await p.goto(`${base}/?stage=${stage}&weapon=longsword&foeWeapon=${CHARACTERS_BY_ID[STAGE_FOE[stage]]?.weapon ?? 'longsword'}&emo=0`, { waitUntil: 'networkidle' });
      await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
      await p.evaluate(() => { document.getElementById('btnStart').click(); });
      await p.waitForFunction(() => game.state === 'fight', null, { timeout: 90000 });
      await p.evaluate(() => { game.ai.update = () => {}; });
      await p.waitForFunction(() => game.stats.simTime > 4.2, null, { timeout: 180000 });
      await p.keyboard.press('KeyP');
      const r = await p.evaluate(() => new Promise((ok) => {
        let n = 0; const ts = [];
        const f = (t) => { ts.push(t); if (++n < 30) return requestAnimationFrame(f);
          const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b);
          const info = game.renderInfo();
          const fighter = new Set(); for (const g of game.fighterMeshes) g.traverse((o) => fighter.add(o));
          let stageMeshes = 0, stageTris = 0, transparent = 0, points = 0; const tex = new Map(), byMesh = [];
          game.scene.traverse((o) => {
            if (fighter.has(o)) return;
            if (o.isMesh || o.isPoints) {
              const g = o.geometry; const tris = o.isMesh ? (g.index ? g.index.count : g.attributes.position.count) / 3 : 0;
              stageMeshes += o.isMesh ? 1 : 0; points += o.isPoints ? 1 : 0; stageTris += tris * (o.isInstancedMesh ? o.count : 1);
              if (o.isMesh) byMesh.push([o.name || o.parent?.name || '?', Math.round(tris * (o.isInstancedMesh ? o.count : 1)), !!o.castShadow]);
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              for (const m of mats) { if (!m) continue; if (m.transparent) transparent++; for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap', 'alphaMap', 'aoMap']) { const t = m[k]; if (t?.image) tex.set(t.uuid, { name: k, w: t.image.width, h: t.image.height, mip: t.generateMipmaps !== false }); } }
            }
          });
          const texBytes = [...tex.values()].reduce((s, t) => s + t.w * t.h * 4 * (t.mip ? 4 / 3 : 1), 0);
          // 중정 땅 먼지(Points, 크기 3.5 — 거리로 줄어드는 점): 화면에 덮는 화소 합 ÷ 화면 화소 = 겹쳐 그리는 몫 (어림 — gl_PointSize = size × 화면 높이/2 ÷ 거리)
          let dustCover = null;
          const dust = game.scene.getObjectByName('courtyard-ground-dust');
          if (dust) {
            const T = game.THREE, cam = game.camera, v = new T.Vector3(), a = dust.geometry.attributes.position, H = innerHeight * Math.min(devicePixelRatio, 2), W = innerWidth * Math.min(devicePixelRatio, 2);
            let px = 0; dust.updateMatrixWorld(true);
            for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(dust.matrixWorld).applyMatrix4(cam.matrixWorldInverse); if (v.z > -0.1) continue; const s = dust.material.size * (H / 2) / -v.z; const q = v.clone().applyMatrix4(cam.projectionMatrix); if (Math.abs(q.x) > 1.2 || Math.abs(q.y) > 1.2) continue; px += Math.min(s, 2048) ** 2; }
            dustCover = +(px / (W * H)).toFixed(2);
          }
          byMesh.sort((x, y) => y[1] - x[1]);
          ok({ topMeshes: byMesh.slice(0, 6), dustCover, calls: info.calls, triangles: info.triangles, geometries: info.geometries, textures: info.textures, programs: info.programs, stageMeshes, stageTris, transparent, points,
            stageTextures: [...tex.values()].map((t) => `${t.w}x${t.h}`), stageTexMB: +(texBytes / 1048576).toFixed(1), frameMs: +d[d.length >> 1].toFixed(1) });
        };
        requestAnimationFrame(f);
      }));
      report.cost.push({ stage, ...r }); save(); console.log('cost', stage, JSON.stringify(r));
      await p.close();
    }
    // 짓는 시간: 한 페이지에서 무대를 네 바퀴 바꾸며 game.stage.buildMs (첫 바퀴는 데우기라 빼고 중앙값)
    const p = await browser.newPage({ viewport: { width: 844, height: 420 } });
    watch(p, 'build');
    await p.goto(`${base}/?stage=poseidon&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
    const times = await p.evaluate((ids) => { const out = {}; for (let lap = 0; lap < 4; lap++) for (const id of ids) { game.setStage(id); (out[id] ??= []).push([+game.stage.buildMs.toFixed(0), +game.stage.warmMs.toFixed(0)]); } return out; }, STAGES);
    for (const [id, a] of Object.entries(times)) {
      const b = a.slice(1).map((x) => x[0]).sort((x, y) => x - y), w = a.slice(1).map((x) => x[1]).sort((x, y) => x - y);
      const row = report.cost.find((r) => r.stage === id); if (row) { row.buildMs = b[1]; row.warmMs = w[1]; row.buildAll = a; }
    }
    await p.close(); save(); console.log('build', JSON.stringify(times));
  }
  // ── sound ──
  if (MODES.includes('sound')) {
    const p = await browser.newPage({ viewport: { width: 844, height: 390 } });
    watch(p, 'sound');
    await p.goto(`${base}/?stage=courtyard&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.sound, null, { timeout: 90000 });
    const rows = await p.evaluate(async () => {
      const S = game.sound, D = S._details(), Cls = D.constructor;
      const STAGES = { corsair: ['riggingCreak', 'waterLap', 'gullCall'], courtyard: ['courtyardCloth', 'courtyardRing', 'courtyardDrip'], sluice: ['sluiceDrip', 'jungleRustle', 'jungleBird'], dayr: ['caravanRing'], dayr_night: ['caravanRing'], loggia: ['clothRustle'], dunhuang: ['dunhuangWood'], etna: ['etnaCrust'] };
      const out = [];
      for (const [stage, kinds] of Object.entries(STAGES)) {
        const sr = 48000, off = new OfflineAudioContext(2, sr * 16, sr);
        const master = off.createGain(); master.connect(off.destination);
        const fake = { ctx: off, master, on: true, _noiseBuf: S._noiseBuf, _where: () => ({ pan: 0, near: 1 }) };
        const s = new Cls(fake, D.makeRng);
        s.setStage(stage); s.ambience();
        // 세부음: 4 s · 8 s · 12 s 에 세기 1 로 하나씩 (고르기 · 간격 규칙은 실제 코드 그대로)
        kinds.forEach((kind, i) => off.suspend(4 + i * 4).then(() => { s.event({ kind, amp: 1, pos: { x: 0, y: 1, z: 0 }, seed: 1, time: 0 }); off.resume(); }));
        const buf = await off.startRendering();
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        const rms = (a0, a1) => { let q = 0, n = 0; for (let i = a0 * sr; i < a1 * sr; i++) { q += (L[i] * L[i] + R[i] * R[i]) / 2; n++; } return 10 * Math.log10(q / n + 1e-20); };
        const peak = (a0, a1) => { let m = 0; for (let i = a0 * sr; i < a1 * sr; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i])); return 20 * Math.log10(m + 1e-20); };
        out.push({ stage, bedRmsDb: +rms(2, 3.9).toFixed(1), bedPeakDb: +peak(2, 3.9).toFixed(1), events: kinds.map((kind, i) => ({ kind, peakDb: +peak(4 + i * 4, 7.9 + i * 4).toFixed(1), rmsDb: +rms(4 + i * 4, 5.5 + i * 4).toFixed(1) })), accepted: s.stats.accepted, rejected: s.stats.rejected });
      }
      return out;
    });
    report.sound = rows; save(); for (const r of rows) console.log('sound', JSON.stringify(r));
    await p.close();
  }
} finally { save(); await browser.close(); }
console.log(JSON.stringify({ errors: report.errors.length, compare: report.compare.length, phones: report.phones.length, positions: report.positions.length, cost: report.cost.length, sound: report.sound.length }));
