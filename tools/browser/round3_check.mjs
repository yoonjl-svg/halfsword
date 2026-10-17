// 샛별 저장소 셋째 들여오기 점검 (10/17 — docs/import/saetbyeol_round3_2026-10-17.md): 새 밤 넷 · 봉인의 중정 · 얼터 여섯 · 황약사의 검.
//  그쪽 점검 도구(night_fifth · night_seventh · yue_apparitions · royal_messenger · courtyard · chwisaeng)를 우리 판에 맞춰 하나로 모았다:
//   얼터 숙련도는 우리 규칙(사장님 10/16 22:3x '모든 얼터에 숙련도+1') — 숙련도만 원본 +1(상한 5), 그 숙련도에서의 AI 는 원본과 같다.
//  ① 자료: 얼터 여섯 · 무대 짝 · 여정 순서(그대로) · 무기 · 겉모습 판
//  ② 실제 판 (빌드판 — npm run build 뒤 vite preview): 주소로 열기 → 싸움 몇 초 → 정지 · 계속 → 콘솔 오류 0 · 무대마다 소품 · 소리 표시
//  ③ 낮 ↔ 밤 · 중정 오가기 네 바퀴 — 자원 수(꼴 · 무늬 · 셰이더)가 바퀴마다 같다 (새는 것 없음)
//  ④ 첫 화면 'Stage 1' → 곧바로 여정 (tools/browser/to_lobby.mjs departTitle)
//  ⑤ (--same-as=<옛 빌드 주소>) 낮 무대 · 원래 밤 무대가 옛 빌드와 같은 그림인가 — 같은 주소 · 같은 시계 · 같은 카메라 · 싸움꾼 숨김, 화면 바이트 비교
//  실행: PW_CHROMIUM=<크롬> node tools/browser/round3_check.mjs <빌드판 주소> [결과.json] [--only=etna_night,courtyard,…] [--shots=<폴더>] [--same-as=<옛 빌드 주소>]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { CHARACTERS_BY_ID as C, aiAtProficiency } from '../../src/characters.js';
import { STAGE_IDS, STAGE_FOE, STAGE_ORDER, STAGE_NAME_KO } from '../../src/stages.js';
import { WEAPONS, WEAPON_LIST, RETIRED_WEAPONS } from '../../src/weapons.js';
import { terrainForStage } from '../../src/etna_ground.js';
import { departTitle } from './to_lobby.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:4417').replace(/\/$/, '');
const out = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : '/tmp/round3-check.json';
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const only = arg('only')?.split(',');
const shots = arg('shots');
const sameAs = arg('same-as')?.replace(/\/$/, '');
if (shots) fs.mkdirSync(shots, { recursive: true });
const report = { errors: [], data: {}, runtime: [], transitions: [], title: null, same: [] };
const save = () => fs.writeFileSync(out, JSON.stringify(report, null, 1) + '\n');

// ── ① 자료 ──
const ALTERS = ['chanda', 'renji', 'terracotta', 'silver_wanderer', 'samira', 'artoria'];
for (const id of ALTERS) {
  const a = C[id + '_mad'], b = C[id];
  assert.ok(a && a.mad && a.variantOf === id, id);
  assert.equal(a.ai.proficiency, Math.min(5, b.ai.proficiency + 1), `${id} 숙련도 +1`);
  for (let p = 1; p <= 5; p++) {
    const x = aiAtProficiency(a, p), y = aiAtProficiency(b, p);
    if (id === 'renji') { // 형의 칼을 든다 — 유파 꾸러미 이름만 다르고 실력 숫자 · 성향 · 유파 숙련도 표는 같다
      assert.equal(x.level, y.level); assert.deepEqual(x.persona.level, y.persona.level);
      assert.deepEqual(x.persona.pers, y.persona.pers); assert.deepEqual(x.persona.proficiency, y.persona.proficiency);
    } else assert.deepEqual(x, y, `${id} 숙련도 ${p}`);
  }
  assert.equal(a.weapon, id === 'renji' ? 'brothers_sword' : b.weapon);
}
assert.equal(C.chanda.epithet, '식물학자'); assert.equal(C.chanda_mad.epithet, '식물학자');
assert.equal(C.artoria.look.armor, 'plate'); assert.equal(C.artoria_mad.look.armor, null);
assert.equal(C.silver_wanderer.lookVersion, 'v7-silver-c'); assert.equal(C.silver_wanderer.look.hair, 0x93877e);
assert.equal(C.silver_wanderer_mad.look.hair, C.silver_wanderer.look.hair); assert.equal(C.silver_wanderer_mad.look.daraishiBlack, 1);
const PAIRS = { etna_night: 'chanda_mad', qinglan_night: 'renji_mad', dunhuang_night: 'terracotta_mad', dayr_night: 'silver_wanderer_mad', courtyard: 'samira' };
for (const [s, f] of Object.entries(PAIRS)) { assert.ok(STAGE_IDS.includes(s), s); assert.equal(STAGE_FOE[s], f); assert.ok(!STAGE_ORDER.includes(s), `${s} 는 여정 순서 밖`); }
// 여정 순서는 우리 판 그대로 (사장님 10/16 19:4x 낮 다섯 · 밤 다섯)
assert.deepEqual(STAGE_ORDER, ['poseidon', 'clearing', 'castle', 'loggia', 'cathedral', 'poseidon_night', 'clearing_night', 'castle_night', 'loggia_night', 'cathedral_night',
  'corsair', 'sluice', 'etna', 'qinglan', 'sacred_grove', 'corsair_night', 'sluice_night', 'sacred_grove_night', 'temple_night', 'frozen_bay_night', 'temple', 'frozen_bay', 'dunhuang', 'dayr']);
assert.equal(terrainForStage('etna_night'), terrainForStage('etna')); assert.equal(terrainForStage('qinglan_night'), null);
const w = WEAPONS.brothers_sword;
assert.equal(w.nameKo, '황약사의 검'); assert.equal(w.tier, 'epic'); assert.equal(w.power, 1.1); assert.equal(w.mBlunt, 1.6);
assert.equal(w.mCut, 0); assert.equal(w.mThrust, 0); assert.equal(w.fragility, 0); assert.equal(w.fragile, false); assert.equal(w.ability, '취생몽사: 몽롱한 일격');
assert.ok(WEAPON_LIST.some((x) => x.id === 'brothers_sword') && !RETIRED_WEAPONS.has('brothers_sword'), '카드 뽑기 목록');
report.data = { alters: ALTERS.length, proficiencyPairs: ALTERS.length * 5, pairs: PAIRS, names: Object.fromEntries(Object.keys(PAIRS).map((s) => [s, STAGE_NAME_KO[s]])),
  proficiency: Object.fromEntries(ALTERS.map((id) => [id, [C[id].ai.proficiency, C[id + '_mad'].ai.proficiency]])), stageOrder: STAGE_ORDER.length };
save();

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const watch = (p, tag) => { p.on('pageerror', (e) => report.errors.push(`${tag}: ${e}`)); p.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${tag}: ${m.text()}`); }); };
async function openFight(stage, foe, foeWeapon, { viewport = { width: 960, height: 540 }, render = false } = {}) {
  const p = await browser.newPage({ viewport, hasTouch: true });
  watch(p, `${stage}/${foe}`);
  await p.clock.install({ time: new Date('2026-10-17T18:00:00Z') }); await p.clock.pauseAt(new Date('2026-10-17T18:00:01Z'));
  await p.goto(`${base}/?stage=${stage}&foe=${foe}&weapon=longsword&foeWeapon=${foeWeapon}&emo=0`, { waitUntil: 'networkidle' });
  await p.evaluate((r) => { game.renderCap.tick = () => r; document.getElementById('btnStart').click(); }, render);
  for (let i = 0; i < 200 && await p.evaluate(() => game.state !== 'fight'); i++) await p.clock.runFor(16);
  assert.equal(await p.evaluate(() => game.state), 'fight', `${stage} 싸움 시작`);
  await p.evaluate(() => { window.detailEvents = []; const o = game.sound.stageEvent.bind(game.sound); game.sound.stageEvent = (n, d) => { if (n === 'stageDetail') detailEvents.push(d.kind); return o(n, d); }; });
  return p;
}
// 정지 → 1 초 동안 그림 시간(probe)이 멈추고 → 계속하면 다시 흐른다
async function pauseResume(p, probe) {
  await p.evaluate(() => document.getElementById('btnPause').click()); await p.clock.runFor(32);
  const s0 = await p.evaluate(() => game.state), a = await p.evaluate(probe);
  await p.clock.runFor(1000); const b = await p.evaluate(probe);
  await p.evaluate(() => document.getElementById('btnResume').click()); await p.clock.runFor(600);
  const c = await p.evaluate(probe), s1 = await p.evaluate(() => game.state);
  assert.equal(s0, 'paused'); assert.deepEqual(a, b, '정지 동안 멈춤'); assert.notDeepEqual(b, c, '계속하면 흐름'); assert.notEqual(s1, 'paused');
  return { paused: s0, resumed: s1 };
}
const enemyPos = () => { const t = game.enemy.bodies.pelvis.translation(); return [t.x, t.y, t.z]; };
const finite = (o) => JSON.stringify(o, (k, v) => (typeof v === 'number' && !Number.isFinite(v) ? 'NaN' : v)).indexOf('NaN') < 0;
async function shot(p, name) {
  if (!shots) return;
  await p.evaluate(() => { game.renderCap.tick = () => true; }); await p.clock.runFor(48);
  await p.screenshot({ path: `${shots}/${name}.png` });
}

// ── ② 실제 판 ──
const CASES = [
  ['etna_night', 'chanda_mad', 'moye', 14000, async (p) => {
    const before = await p.evaluate(() => Array.from(game.scene.getObjectByName('etna-geothermal-steam').geometry.attributes.position.array.slice(0, 30)));
    await p.clock.runFor(500);
    const d = await p.evaluate(() => { const r = game.scene.getObjectByName('etna_night-story'), f = game.enemy;
      return { hour: r.userData.hour, stories: r.userData.stories.length, geothermal: { vents: r.userData.geothermal.ventCount, particles: r.userData.geothermal.particles },
        terrain: game.terrain?.id ?? null, enemyTerrain: f.terrain?.id ?? null, veil: !!f.groups.head.getObjectByName('chanda-white-face-veil'), helmet: f.helmetType,
        steam: Array.from(game.scene.getObjectByName('etna-geothermal-steam').geometry.attributes.position.array.slice(0, 30)) }; });
    assert.equal(d.hour, 3); assert.ok(d.stories >= 2); assert.deepEqual(d.geothermal, { vents: 12, particles: 120 }); assert.equal(d.terrain, 'etna'); assert.equal(d.enemyTerrain, 'etna');
    assert.ok(d.veil); assert.equal(d.helmet, null); assert.notDeepEqual(d.steam, before); d.steamMoves = true; delete d.steam;
    return d; }, ['etnaCrust'], [], () => Array.from(game.scene.getObjectByName('etna-geothermal-steam').geometry.attributes.position.array.slice(0, 6))],
  ['qinglan_night', 'renji_mad', 'brothers_sword', 14000, async (p) => {
    const d = await p.evaluate(() => { const r = game.scene.getObjectByName('qinglan_night-story'), f = game.enemy;
      return { hour: r.userData.hour, stories: r.userData.stories.length, swords: r.userData.abandonedSwords.length, swordsInside: r.userData.abandonedSwords.filter((s) => s.insideArena).length,
        hair: !!f.groups.head.getObjectByName('renji-loose-long-hair'), waistSwordHidden: !(f.groups.pelvis.getObjectByName('renji-sheathed-sword')?.visible ?? false),
        weapon: f.weapon.id, wrap: !!f.sword && game.scene.getObjectByName('wrapped-sword-overlapping-cloth') != null, helmet: f.helmetType, terrain: game.terrain?.id ?? null }; });
    assert.equal(d.hour, 3); assert.equal(d.swords, 7); assert.equal(d.swordsInside, 3); assert.ok(d.hair); assert.ok(d.waistSwordHidden); assert.equal(d.weapon, 'brothers_sword');
    assert.ok(d.wrap); assert.equal(d.helmet, 'kasa'); assert.equal(d.terrain, null);
    return d; }, ['springDrip'], ['cliffBird'], () => game.enemy.bodies.pelvis.translation().x + game.player.bodies.pelvis.translation().x * 7],
  ['dunhuang_night', 'terracotta_mad', 'goujian', 14000, async (p) => {
    const d = await p.evaluate(() => { const r = game.scene.getObjectByName('dunhuang_night-story'), f = game.enemy, g = game.scene.getObjectByName('yue-apparitions').userData;
      return { hour: r.userData.hour, colliders: r.userData.addedColliders, face: f.groups.head.getObjectByName('terracotta-pale-human-face')?.userData.opacity,
        cloak: !!f.groups.chest.getObjectByName('yue-commanders-white-cloak-chest'), ghosts: { count: g.count, pairs: g.duelPairs, walkers: g.walkers, spears: g.marchingSpears, banners: g.marchingBanners, draws: g.draws, colliders: g.colliders },
        oldProps: ['yue-ghost-banner', 'opened-guardian-cart', 'homeward-votive-boat', 'terracotta-bronze-face-repair'].filter((n) => game.scene.getObjectByName(n)), helmet: f.helmetType }; });
    assert.equal(d.hour, 3); assert.equal(d.colliders, 0); assert.equal(d.face, 0.88); assert.ok(d.cloak);
    assert.deepEqual(d.ghosts, { count: 20, pairs: 8, walkers: 4, spears: 3, banners: 0, draws: 32, colliders: 0 }); assert.deepEqual(d.oldProps, []);
    return d; }, ['dunhuangWood'], [], () => game.scene.getObjectByName('yue-apparitions').userData.time],
  ['dayr_night', 'silver_wanderer_mad', 'monohoshizao', 14000, async (p) => {
    const d = await p.evaluate(() => { const r = game.scene.getObjectByName('dayr_night-story'), f = game.enemy, c = game.scene.getObjectByName('dayr-assassin-caravan');
      const v = new game.THREE.Vector3(); let minR = Infinity; c.updateMatrixWorld(true);
      c.traverse((o) => { const a = o.geometry?.attributes.position; if (!a) return; for (let i = 0; i < a.count; i += 7) { v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld); minR = Math.min(minR, Math.hypot(v.x, v.z)); } });
      return { hour: r.userData.hour, stories: r.userData.stories.length, sunHidden: !game.scene.getObjectByName('dayr-setting-sun').visible, caravan: { camels: c.userData.camels, fallen: c.userData.fallen }, minR: +minR.toFixed(2),
        blood: game.scene.getObjectByName('dayr-blood-aftermath')?.userData, shackle: Object.values(f.groups).some((g) => g.getObjectByName('daraishi-broken-wrist-shackle')),
        tie: f.groups.head.getObjectByName('daraishi-red-hair-tie')?.userData.tails, front: !!f.groups.chest.getObjectByName('silver-wanderer-front-tailoring'), weapon: f.weapon.id }; });
    assert.equal(d.hour, 3); assert.ok(d.sunHidden); assert.deepEqual(d.caravan, { camels: 3, fallen: 3 }); assert.ok(d.minR > 10.5, '대상단 소품은 결투장 밖');
    assert.equal(d.shackle, false); assert.equal(d.tie, 2); assert.ok(d.front); assert.equal(d.weapon, 'monohoshizao');
    return d; }, ['caravanRing'], [], () => game.scene.getObjectByName('dayr-caravan-camel-0').getObjectByName('dayr-camel-head').quaternion.toArray()],
  ['courtyard', 'samira', 'pistol', 18000, async (p) => {
    const d = await p.evaluate(() => ({ foeName: game.enemy.name, weapon: game.enemy.weapon.id, shots: game.enemy.gun?.shots ?? 0, terrain: game.terrain, sound: game.sound.stage,
      obstacle: game.arenaObstacle && { colliders: game.arenaObstacle.colliderCount, seekSight: !!game.arenaObstacle.navigation.seekSight, radius: game.arenaObstacle.navigation.radius },
      env: !!game.scene.getObjectByName('courtyard-environment'), dispatch: !!game.enemy.groups.pelvis.getObjectByName('maya-open-dispatch-case') }));
    assert.equal(d.foeName, '마야 라토르'); assert.equal(d.weapon, 'pistol'); assert.ok(d.shots > 0, '마야가 실제로 쏜다'); assert.equal(d.terrain, null); assert.equal(d.sound, 'courtyard');
    assert.deepEqual(d.obstacle, { colliders: 9, seekSight: true, radius: 1.45 }); assert.ok(d.env); assert.equal(d.dispatch, false);
    return d; }, [], [], () => game.scene.getObjectByName('courtyard-ground-dust').geometry.attributes.position.array.slice(0, 6).join()],
  ['courtyard', 'samira_mad', 'pistol', 6000, async (p) => {
    const d = await p.evaluate(() => ({ dispatch: !!game.enemy.groups.pelvis.getObjectByName('maya-open-dispatch-case'), weapon: game.enemy.weapon.id }));
    assert.ok(d.dispatch); assert.equal(d.weapon, 'pistol');
    return d; }, [], [], () => game.scene.getObjectByName('courtyard-ground-dust').geometry.attributes.position.array.slice(0, 6).join()],
  ['corsair', 'artoria_mad', 'excalibur', 8000, async (p) => {
    await p.evaluate(() => { game.renderCap.tick = () => true; }); await p.clock.runFor(200); // 허리끈 휨(onBeforeRender)까지 그려 본다
    const d = await p.evaluate(() => { const f = game.enemy, has = (part, n) => !!f.groups[part].getObjectByName(n);
      return { plate: Object.keys(f.plate || {}).length, plateGait: (f.plateGait || []).length, helmet: f.helmetType, bodice: has('chest', 'artoria-ballroom-bodice'), skirt: has('pelvis', 'artoria-ballroom-skirt'),
        crown: has('head', 'artoria-lily-crown'), braids: has('head', 'artoria-coronation-braids'), necklace: has('chest', 'artoria-court-necklace'), cincture: has('abdomen', 'artoria-black-cincture'),
        boots: ['shinF', 'shinB'].every((k) => has(k, 'artoria-knee-boot')), finite: f.meshes.every((m) => m.group.matrixWorld.elements.every(Number.isFinite)), render: game.renderInfo().calls > 0 }; });
    assert.equal(d.plate, 0); assert.equal(d.plateGait, 0); assert.equal(d.helmet, null);
    for (const k of ['bodice', 'skirt', 'crown', 'braids', 'necklace', 'cincture', 'boots', 'finite', 'render']) assert.ok(d[k], k);
    return d; }, [], [], () => game.enemy.bodies.pelvis.translation().x + game.player.bodies.pelvis.translation().x * 7],
  ['dayr', 'silver_wanderer', 'monohoshizao', 6000, async (p) => {
    const d = await p.evaluate(() => { const f = game.enemy;
      return { front: !!f.groups.chest.getObjectByName('silver-wanderer-front-tailoring'), neck: !!f.groups.chest.getObjectByName('silver-wanderer-neck'), lock: !!f.groups.head.getObjectByName('silver-wanderer-front-lock'),
        tie: !!f.groups.head.getObjectByName('daraishi-red-hair-tie'), night: !!game.scene.getObjectByName('dayr_night-story'), sunVisible: game.scene.getObjectByName('dayr-setting-sun').visible }; });
    assert.ok(d.front && d.neck && d.lock); assert.equal(d.tie, false); assert.equal(d.night, false); assert.ok(d.sunVisible);
    return d; }, [], [], () => game.enemy.bodies.pelvis.translation().x + game.player.bodies.pelvis.translation().x * 7],
];
try {
  for (const [stage, foe, weapon, ms, inspect, wantEvents, banEvents, probe] of CASES) {
    if (only && !only.includes(stage) && !only.includes(foe)) continue;
    const p = await openFight(stage, foe, weapon);
    const t0 = Date.now();
    await p.clock.runFor(1500);
    const pause = await pauseResume(p, probe); // 정지 · 계속은 판 초반에 (판이 끝나면 결과 창도 '정지' 상태라 섞이지 않게)
    for (let i = 0; i < ms / 500; i++) { await p.clock.runFor(500); assert.ok(finite(await p.evaluate(enemyPos)), `${stage} ${i}`); }
    const d = await inspect(p);
    d.pause = pause;
    d.events = [...new Set(await p.evaluate(() => detailEvents))];
    for (const k of wantEvents) assert.ok(d.events.includes(k), `${stage} 소리 ${k}`);
    for (const k of banEvents) assert.ok(!d.events.includes(k), `${stage} 소리 ${k} 없음`);
    d.state = await p.evaluate(() => game.state); d.stageId = await p.evaluate(() => game.stage.id); d.wallSec = Math.round((Date.now() - t0) / 1000);
    assert.equal(d.stageId, stage);
    await shot(p, `${stage}-${foe}`);
    report.runtime.push({ stage, foe, ...d }); save(); console.log(stage, foe, 'ok', JSON.stringify(d.events));
    await p.close();
  }
  // ── ③ 오가기 (자원 새는 것) ──
  if (!only || only.includes('transitions')) {
    const p = await browser.newPage({ viewport: { width: 960, height: 540 } }); watch(p, 'transitions');
    await p.clock.install({ time: new Date('2026-10-17T18:00:00Z') }); await p.clock.pauseAt(new Date('2026-10-17T18:00:01Z'));
    await p.goto(`${base}/?stage=etna&foe=chanda&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
    await p.evaluate(() => { game.renderCap.tick = () => true; game.freeCam = true; game.camera.position.set(3, 4, 10); game.camera.lookAt(0, 1, 0); }); await p.clock.runFor(160);
    const ids = ['etna', 'etna_night', 'qinglan', 'qinglan_night', 'dunhuang', 'dunhuang_night', 'dayr', 'dayr_night', 'courtyard', 'loggia'];
    for (let lap = 0; lap < 4; lap++) for (const id of ids) {
      await p.evaluate((id) => { game.setStage(id); game.scene.traverse((m) => { if (m.isMesh || m.isPoints) m.frustumCulled = false; }); }, id); await p.clock.runFor(64);
      const row = await p.evaluate(() => { const r = game.renderInfo(); return { stage: game.stage.id, geometries: r.geometries, textures: r.textures, programs: r.programs,
        stories: game.scene.children.filter((x) => x.name.endsWith('-story')).length, courtyard: game.scene.children.filter((x) => x.name === 'courtyard-environment').length, obstacle: game.arenaObstacle?.colliderCount ?? 0 }; });
      assert.equal(row.stories, id.endsWith('_night') ? 1 : 0, `${id} 이야기 묶음`); assert.equal(row.courtyard, id === 'courtyard' ? 1 : 0); assert.equal(row.obstacle, id === 'courtyard' ? 9 : 0);
      if (lap > 1) assert.deepEqual(row, report.transitions.find((r) => r.lap === lap - 1 && r.stage === id).row, `${id} 바퀴 ${lap} 자원 수`);
      report.transitions.push({ lap, stage: id, row });
    }
    save(); console.log('transitions ok', report.transitions.length); await p.close();
  }
  // ── ④ 첫 화면 → Stage 1 → 곧바로 여정 ──
  if (!only || only.includes('title')) {
    const p = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true }); watch(p, 'title');
    await p.goto(`${base}/`, { waitUntil: 'networkidle' });
    await p.locator('#noticeDialog').waitFor({ state: 'attached', timeout: 30000 });
    if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
    const state = await departTitle(p, '#newJourney');
    report.title = { state, stage: await p.evaluate(() => game.stage.id) };
    assert.ok(['draw', 'fight'].includes(state)); assert.equal(report.title.stage, STAGE_ORDER[0]);
    save(); console.log('title ok', JSON.stringify(report.title)); await p.close();
  }
  // ── ④-2 황약사의 검 카드: 이어하기 지점(청람잔도 · 내 카드 둘 = 황약사의 검 · 롱소드)으로 첫 화면 '이어하기' → 곧바로 카드 고르기 → 뒤집기 → 그 칼로 싸움 ──
  if (!only || only.includes('card')) {
    const p = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, reducedMotion: 'reduce' }); watch(p, 'card');
    await p.addInitScript(() => { localStorage.setItem('stillness.journey.checkpoint.v1', JSON.stringify({ version: 1, stage: 'qinglan', foe: 'renji', foeWeapon: 'morgenstern', cards: ['brothers_sword', 'longsword'], lastWeapon: null })); });
    await p.goto(`${base}/`, { waitUntil: 'networkidle' });
    await p.locator('#noticeDialog').waitFor({ state: 'attached', timeout: 30000 });
    if (await p.locator('#noticeDialog').evaluate((d) => d.open)) await p.locator('#confirmNotices').click();
    assert.equal(await departTitle(p, '#continueJourney'), 'draw');
    await p.waitForFunction(() => game.draw.stage === 'choose' && game.draw.t >= 0.6, null, { timeout: 60000 });
    await p.locator('#draw .wcard').nth(0).dispatchEvent('click');
    await p.waitForFunction(() => game.draw.stage === 'reveal' && game.draw.t >= 1.35, null, { timeout: 60000 }); await p.evaluate(() => { game.draw.hold = true; }); await p.waitForTimeout(150);
    const card = await p.evaluate(async () => { const el = document.querySelectorAll('#draw .wcard')[0], q = (s) => el.querySelector(s).textContent;
      const img = await fetch('ui/weapons/brothers_sword.webp'); return { tier: el.dataset.tier, name: q('.wname'), sub: q('.wsub'), rank: q('.wtier'), desc: q('.wdesc'), ability: q('.wabil'),
        thumb: el.querySelector('.wthumb').style.backgroundImage.includes('ui/weapons/brothers_sword.webp'), thumbStatus: img.status, thumbType: img.headers.get('content-type'), flipped: el.classList.contains('flipped') }; });
    assert.equal(card.tier, 'epic'); assert.equal(card.name, '황약사의 검'); assert.equal(card.sub, ''); assert.equal(card.rank, '에픽'); assert.equal(card.ability, '(취생몽사: 몽롱한 일격)');
    assert.equal(card.desc, '흰 천으로 감싼 검. 오랫동안 풀지 않은 듯 단단히 매여 있다.\n“번뇌는 기억력 때문이라더군.”'); assert.ok(card.thumb); assert.equal(card.thumbStatus, 200); assert.ok(/webp/.test(card.thumbType));
    if (shots) await p.screenshot({ path: `${shots}/card-brothers_sword.png` });
    await p.evaluate(() => { game.draw.hold = false; }); await p.waitForFunction(() => game.state === 'fight', null, { timeout: 60000 });
    card.fight = await p.evaluate(() => ({ id: game.player.weapon.id, tier: game.player.weapon.tier, power: game.player.weapon.power, blunt: game.player.weapon.mBlunt, fragility: game.player.weapon.fragility, stage: game.stage.id }));
    assert.deepEqual(card.fight, { id: 'brothers_sword', tier: 'epic', power: 1.1, blunt: 1.6, fragility: 0, stage: 'qinglan' });
    report.card = card; save(); console.log('card ok', JSON.stringify(card)); await p.close();
  }
  // ── ④-3 무대 사진 (--shots): 판 시작 전 메뉴 뒤 무대를 정해 둔 자리에서 (싸움꾼은 시작 자리에 선 채, 화면 글자는 숨김) ──
  if (shots && (!only || only.includes('overview'))) {
    const VIEWS = [['dayr_night', 'silver_wanderer_mad', [3.5, 2.6, -8.5], [8.3, 0.6, -16.5]], ['dayr_night', 'silver_wanderer_mad', [-2.5, 2.2, 7.5], [-9.2, 0.2, 14]],
      ['courtyard', 'samira', [5.8, 2.3, 4.6], [0, 1.6, 0]], ['dunhuang_night', 'terracotta_mad', [4.5, 2.6, 6], [13, 1.2, -3]], ['qinglan_night', 'renji_mad', [7.5, 2.2, 5.5], [4.3, 0.4, 2.8]],
      ['etna_night', 'chanda_mad', [6.5, 3.2, 5.5], [13.4, 1.4, -4]]];
    let i = 0;
    for (const [stage, foe, pos, look] of VIEWS) {
      const p = await browser.newPage({ viewport: { width: 960, height: 540 } }); watch(p, `overview ${stage}`);
      await p.clock.install({ time: new Date('2026-10-17T18:00:00Z') }); await p.clock.pauseAt(new Date('2026-10-17T18:00:01Z'));
      await p.goto(`${base}/?stage=${stage}&foe=${foe}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
      await p.addStyleTag({ content: 'body > :not(#game){visibility:hidden!important}' });
      await p.evaluate(([pos, look]) => { game.renderCap.tick = () => false; game.freeCam = true; game.camera.position.set(...pos); game.camera.lookAt(...look); game.camera.fov = 55; game.camera.updateProjectionMatrix(); }, [pos, look]);
      await p.clock.runFor(1500); // 무대 움직임만 흘리고 그리기는 끈 채로 (소프트웨어 GL 에서 그림이 밀리면 사진이 늦는다) — 마지막 몇 장만 그린다
      await p.evaluate(() => { game.renderCap.tick = () => true; }); await p.clock.runFor(48);
      await p.screenshot({ path: `${shots}/overview-${stage}-${i++}.png`, timeout: 90000 }); await p.close();
    }
  }
  // ── ⑤ 옛 빌드와 같은 그림 ──
  if (sameAs) {
    const VIEWS = [['qinglan', 'renji', 'morgenstern'], ['etna', 'chanda', 'moye'], ['dayr', 'silver_wanderer', 'monohoshizao'], ['castle_night', 'isolde_mad', 'longsword'], ['sluice_night', 'ratna_mad', 'ice']];
    const pick = arg('views')?.split(',');
    for (const [stage, foe, weapon] of VIEWS.filter(([s]) => !pick || pick.includes(s))) {
      const pics = [];
      for (const host of [sameAs, base]) {
        const p = await browser.newPage({ viewport: { width: 960, height: 540 } }); watch(p, `same ${host} ${stage}`);
        await p.clock.install({ time: new Date('2026-10-17T18:00:00Z') }); await p.clock.pauseAt(new Date('2026-10-17T18:00:01Z'));
        await p.goto(`${host}/?stage=${stage}&foe=${foe}&weapon=longsword&foeWeapon=${weapon}&emo=0`, { waitUntil: 'networkidle' });
        await p.addStyleTag({ content: 'body > :not(#game){visibility:hidden!important}' });
        await p.evaluate(() => { game.renderCap.tick = () => false; game.freeCam = true; for (const g of game.fighterMeshes) g.visible = false; game.camera.position.set(7, 3.2, 9); game.camera.lookAt(0, 1.2, 0); game.camera.fov = 55; game.camera.updateProjectionMatrix(); });
        await p.clock.runFor(800);
        await p.evaluate(() => { for (const g of game.fighterMeshes) g.visible = false; game.renderCap.tick = () => true; }); await p.clock.runFor(32);
        const buf = await p.screenshot({ timeout: 90000 }); pics.push(buf);
        if (shots) fs.writeFileSync(`${shots}/same-${stage}-${host === base ? 'new' : 'old'}.png`, buf);
        await p.close();
      }
      const h = pics.map((b) => crypto.createHash('sha256').update(b).digest('hex').slice(0, 12));
      // 바이트가 다르면 화소 차이도 적는다 (PNG 를 브라우저에서 풀어 견줌 — 몇 화소 · 가장 큰 채널 차이)
      let diff = null;
      if (h[0] !== h[1]) {
        const q = await browser.newPage();
        diff = await q.evaluate(async ([a, b]) => {
          const load = async (s) => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = new OffscreenCanvas(im.width, im.height), x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data; };
          const A = await load(a), B = await load(b); let pixels = 0, max = 0;
          for (let i = 0; i < A.length; i += 4) { const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2])); if (d) { pixels++; max = Math.max(max, d); } }
          return { pixels, of: A.length / 4, maxChannel: max };
        }, pics.map((b) => b.toString('base64')));
        await q.close();
      }
      report.same.push({ stage, old: h[0], new: h[1], identical: h[0] === h[1], diff }); save(); console.log('same', stage, h[0] === h[1], JSON.stringify(diff));
    }
  }
  assert.deepEqual(report.errors, []);
  report.pass = true;
} finally { save(); await browser.close(); }
console.log(JSON.stringify({ pass: report.pass, runtime: report.runtime.length, transitions: report.transitions.length, title: report.title, same: report.same, errors: report.errors.length }));
