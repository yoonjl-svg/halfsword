// 봉인의 중정 고침 점검 (10/17 — docs/design/courtyard_fix_2026-10-17.md): 고치기 전 · 고친 빌드판에서 문서 사진과 잰 값을 한 번에.
//  읽기만 — 게임 값을 바꾸지 않는다(사진을 위해 AI 를 멈추거나 두 사람을 옮기거나 카메라를 직접 두는 것은 그 페이지 안에서만).
//  모드 (--modes=details,shade,topside,gust — 기본 모두):
//   details : 봉인된 문(가까이 · 경기 카메라 자리에서 좁은 시야) · 계단 우물 · 위에서 본 짜임 · 같은 경기 카메라의 잔잔할 때 ↔ 돌풍 한가운데 · 카드 고르기 뒷면
//   shade   : 마야를 급수정 그늘 안 · 밖에 세우고 같은 고정 카메라에서 마야 화소 밝기 평균(마야만 단색으로 그린 가림막으로 셈) — 그늘에 든 몸이 실제로 어두워지나.
//             발밑 바닥 띠 밝기도 함께(바닥이 어두우면 그 자리가 정말 그늘 안)
//   topside : 내 쪽 높은 데서 비스듬히 본 급수정과 그 그림자(전: 바닥에 그린 그늘은 화면 오른쪽 앞 · 뒤: 실제 그림자는 화면 왼쪽 안으로 길게)
//   gust    : 바탕 소리를 OfflineAudioContext 로 두 번 그려(돌풍을 보낸 판 ↔ 안 보낸 판 — 같은 씨앗 · 같은 흔들림 때) 돌풍 한가운데 RMS 차 = 돌풍이 키운 몫
//  --layout=before|after (기본 after): 문 · 계단 우물 · 그늘 자리. 고치기 전 빌드판(1930074)은 before — 문이 마야 뒤 북쪽 회랑, 그린 그늘이 판 시작 내 자리 쪽
//  실행: PW_CHROMIUM=<크롬> node tools/browser/courtyard_fix_shots.mjs <빌드판 주소> <출력 폴더> [--modes=…] [--layout=after]
//  마야는 권총(&foeWeapon=pistol — 주소의 weapon=longsword 가 상대 무기까지 정하므로 따로 준다)
import fs from 'node:fs';
import { chromium } from 'playwright';

const base = (process.argv[2] || 'http://127.0.0.1:4471').replace(/\/$/, '');
const outDir = process.argv[3] || '/tmp/courtyard-fix';
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const MODES = arg('modes', 'details,shade,topside,gust').split(',');
const AFTER = arg('layout', 'after') !== 'before';
fs.mkdirSync(outDir, { recursive: true });
const report = { layout: AFTER ? 'after' : 'before', errors: [], details: {}, shade: null, gust: null };
// 이번에 안 돌리는 모드의 지난 결과는 그대로 둔다(같은 배치 · 같은 폴더일 때)
try { const prev = JSON.parse(fs.readFileSync(`${outDir}/fix_shots.json`, 'utf8')); if (prev.layout === report.layout) for (const k of ['details', 'shade', 'gust']) if (!MODES.includes(k)) report[k] = prev[k]; } catch { /* 처음 */ }
const save = () => fs.writeFileSync(`${outDir}/fix_shots.json`, JSON.stringify(report, null, 1) + '\n');
const URL_FIGHT = `${base}/?stage=courtyard&weapon=longsword&foeWeapon=pistol&emo=0`;
const HIDE_UI = 'body > :not(#game){visibility:hidden!important}';
// 자리 (세상 좌표, m): 문 가운데 · 계단 우물을 내려다보는 카메라 · 급수정 그늘 안 / 밖의 마야 · 고정 카메라(마야에서 떨어진 몫)
const L = AFTER
  ? { gate: [33.5, 1], well: [[8, 9, 1], [21, -2, 1]], shadeIn: [5.2, -2.9], shadeOut: [5.2, 0.6], shadeCam: [-2.5, 2.8] } // 우물은 두 차양 사이로 내려다봄 · 해 20° · 카메라 뒤 오른쪽 → 급수정 그림자는 +x −z 쪽
  : { gate: [22.3, 0], well: [[9.5, 7.5, -9.5], [1, -1.5, -21]], shadeIn: [-1.6, 2.9], shadeOut: [1.2, 2.9], shadeCam: [-4.2, 2.2] }; // 그린 그늘(높이 2.9 m 덩어리 · 해 34° (5, 7, −9))은 급수정에서 −x +z 쪽 약 4.3 m

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const watch = (p, tag) => { p.on('pageerror', (e) => report.errors.push(`${tag}: ${e}`)); p.on('console', (m) => { if (m.type() === 'error') report.errors.push(`${tag}: ${m.text()}`); }); };

/** 가짜 시계로 판을 열고 판 시작 훑기가 끝날 때까지. freeze: AI 를 멈춰 두 사람이 시작 자리에 선 채 */
async function openFight(tag, { freeze = true } = {}) {
  const p = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
  watch(p, tag);
  await p.clock.install({ time: new Date('2026-10-17T15:00:00Z') }); await p.clock.pauseAt(new Date('2026-10-17T15:00:01Z'));
  await p.goto(URL_FIGHT, { waitUntil: 'networkidle' });
  await p.evaluate(() => { game.renderCap.tick = () => false; document.getElementById('btnStart').click(); });
  for (let i = 0; i < 300 && await p.evaluate(() => game.state !== 'fight'); i++) await p.clock.runFor(16);
  if (freeze) await p.evaluate(() => { game.ai.update = () => {}; });
  await p.clock.runFor(4200);
  await p.addStyleTag({ content: HIDE_UI });
  return p;
}
const shot = async (p, file) => { await p.evaluate(() => { game.renderCap.tick = () => true; }); await p.clock.runFor(48); const buf = await p.screenshot({ path: `${outDir}/${file}` }); await p.evaluate(() => { game.renderCap.tick = () => false; }); return buf; };
const freeCam = (p, pos, look, fov = 55, up = [0, 1, 0]) => p.evaluate(([pos, look, fov, up]) => { game.freeCam = true; game.camera.position.set(...pos); game.camera.up.set(...up); game.camera.lookAt(...look); game.camera.fov = fov; game.camera.far = 700; game.camera.updateProjectionMatrix(); }, [pos, look, fov, up]);
/** 두 사람을 (x, z) 로 옮긴다 — 몸 전체를 같이 옮기고 속도를 0 으로 */
const place = (p, me, foe) => p.evaluate(([me, foe]) => {
  const shift = (f, x, z) => { const t0 = f.bodies.pelvis.translation(), dx = x - t0.x, dz = z - t0.z;
    for (const rb of new Set([...f.meshes.map((m) => m.rb), f.anchor])) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); rb.setLinvel({ x: 0, y: 0, z: 0 }, true); rb.setAngvel({ x: 0, y: 0, z: 0 }, true); } };
  if (me) shift(game.player, ...me); if (foe) shift(game.enemy, ...foe);
}, [me, foe]);

try {
  if (MODES.includes('details')) {
    const p = await openFight('details');
    const [gx, gz] = L.gate;
    await freeCam(p, [gx - 12, 2.4, gz + 0.4], [gx, 3.2, gz], 50); await shot(p, 'gate_close.png');
    await freeCam(p, [-5.75, 2.31, 2.73], [gx, 3.0, gz], 30); await shot(p, 'gate_from_fight_zoom.png'); // 판 시작 경기 카메라 자리 · 좁은 시야(문 쪽)
    await freeCam(p, L.well[0], L.well[1], 60); await shot(p, 'stepwell.png');
    await freeCam(p, [0, 62, 0], [0, 0, 0], 55, [1, 0, 0]); await shot(p, 'plan.png'); // 화면 위 = +x(마야 쪽)
    await p.close();
    // 돌풍: 땅 먼지 투명(0.10 + 돌풍 × 0.3 — 두 빌드판 같음)으로 때를 잡아 같은 경기 카메라에서 잔잔할 때 ↔ 한가운데
    const q = await openFight('wind');
    const dustOp = () => q.evaluate(() => game.scene.getObjectByName('courtyard-ground-dust').material.opacity);
    for (let i = 0; i < 160 && await dustOp() > 0.11; i++) await q.clock.runFor(125);
    await shot(q, 'wind_calm.png'); report.details.calmDust = +(await dustOp()).toFixed(3);
    for (let i = 0; i < 200 && await dustOp() < 0.385; i++) await q.clock.runFor(125);
    await shot(q, 'wind_gust.png'); report.details.gustDust = +(await dustOp()).toFixed(3);
    await q.close();
    // 카드 뒷면: 주소에 weapon 을 주지 않으면 판 앞 카드 고르기가 뜬다
    const c = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true });
    watch(c, 'cardback');
    await c.clock.install({ time: new Date('2026-10-17T15:00:00Z') }); await c.clock.pauseAt(new Date('2026-10-17T15:00:01Z'));
    await c.goto(`${base}/?stage=courtyard&emo=0`, { waitUntil: 'networkidle' });
    await c.evaluate(() => { game.renderCap.tick = () => true; document.getElementById('btnStart').click(); });
    for (let i = 0; i < 400 && await c.evaluate(() => !(game.state === 'draw' && game.draw.stage === 'choose' && game.draw.t > 0.8)); i++) await c.clock.runFor(16);
    await c.clock.runFor(200);
    await c.screenshot({ path: `${outDir}/cardback_draw.png` });
    report.details.cardBack = await c.evaluate(() => document.getElementById('draw')?.dataset.back ?? null);
    await c.close();
    console.log('details', JSON.stringify(report.details)); save();
  }
  if (MODES.includes('shade')) {
    const p = await openFight('shade');
    const res = {};
    for (const [name, foe] of [['in', L.shadeIn], ['out', L.shadeOut]]) {
      await place(p, [-5.5, -6.5], foe); // 나는 화면 밖으로 비킨다
      await p.clock.runFor(1500);
      const [ox, oz] = L.shadeCam;
      await freeCam(p, [foe[0] + ox, 1.9, foe[1] + oz], [foe[0], 1.1, foe[1]], 45);
      await p.evaluate(() => { game.renderCap.tick = () => true; }); await p.clock.runFor(400); // 그늘 몫이 부드럽게 옮겨 갈 때(0.08 s)를 넉넉히
      const frame = await p.screenshot({ path: `${outDir}/maya_${name}.png` });
      // 가림막: 마야만 초록, 나머지 숨김 · 하늘 검정
      await p.evaluate(() => {
        const { THREE } = window.game, keep = new Set(game.enemy.meshes.map((m) => m.group)), undo = [], scene = game.scene;
        undo.push(((bg, fog) => () => Object.assign(scene, { background: bg, fog }))(scene.background, scene.fog));
        scene.background = new THREE.Color(0); scene.fog = null;
        for (const o of scene.children) { if (keep.has(o)) continue; const v = o.visible; undo.push(() => (o.visible = v)); o.visible = false; }
        const m = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        for (const g of keep) g.traverse((o) => { if (o.isMesh) { const was = o.material; undo.push(() => (o.material = was)); o.material = m; } });
        window.__undoMask = () => undo.reverse().forEach((f) => f());
      });
      await p.clock.runFor(48);
      const mask = await p.screenshot();
      await p.evaluate(() => { window.__undoMask(); game.renderCap.tick = () => false; });
      res[name] = await p.evaluate(async ([fb, mb]) => {
        const load = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); const cv = new OffscreenCanvas(im.width, im.height), x = cv.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height); };
        const F = await load(fb), M = await load(mb), w = F.width, h = F.height;
        const Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        let s = 0, n = 0, minX = w, maxX = 0, maxY = 0;
        for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = (y * w + x) * 4; if (M.data[i + 1] > 160 && M.data[i] < 90 && M.data[i - 4 + 1] > 160 && M.data[i + 4 + 1] > 160) { s += Y(F.data, i); n++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); } }
        // 발밑 바닥 띠: 마야 상자 바로 아래 14 화소 · 좌우 30 화소 넓게
        let fs = 0, fn = 0;
        for (let y = Math.min(h - 1, maxY + 4); y < Math.min(h, maxY + 18); y++) for (let x = Math.max(0, minX - 30); x < Math.min(w, maxX + 30); x++) { const i = (y * w + x) * 4; fs += Y(F.data, i); fn++; }
        return { mayaY: +(s / Math.max(1, n)).toFixed(1), pixels: n, floorY: +(fs / Math.max(1, fn)).toFixed(1) };
      }, [frame.toString('base64'), mask.toString('base64')]);
      res[name].at = foe;
    }
    report.shade = { ...res, ratio: +(res.in.mayaY / res.out.mayaY).toFixed(3) };
    console.log('shade', JSON.stringify(report.shade)); save();
    await p.close();
  }
  if (MODES.includes('topside')) {
    const p = await openFight('topside');
    await freeCam(p, [-7, 11, 0], [1.5, 0, 0], 60); await shot(p, 'topside.png');
    await p.close(); console.log('topside ok');
  }
  if (MODES.includes('gust')) {
    const p = await browser.newPage({ viewport: { width: 844, height: 390 } });
    watch(p, 'gust');
    await p.goto(URL_FIGHT, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.game?.sound, null, { timeout: 90000 });
    report.gust = await p.evaluate(async () => {
      const S = game.sound, D = S._details(), Cls = D.constructor, sr = 48000, gustAt = 4.5, dur = 4.6;
      async function render(withGust) {
        const off = new OfflineAudioContext(2, sr * 11, sr);
        const master = off.createGain(); master.connect(off.destination);
        const fake = { ctx: off, master, on: true, _noiseBuf: S._noiseBuf, _where: () => ({ pan: 0, near: 1 }) };
        const s = new Cls(fake, D.makeRng);
        s.setStage('courtyard'); s.ambience();
        let accepted = null;
        if (withGust) off.suspend(gustAt).then(() => { accepted = s.event({ kind: 'courtyardGust', amp: 1, duration: dur, seed: 1, time: 0 }); off.resume(); });
        const buf = await off.startRendering();
        const A = buf.getChannelData(0), B = buf.getChannelData(1);
        const rms = (a0, a1) => { let q = 0, n = 0; for (let i = Math.floor(a0 * sr); i < a1 * sr; i++) { q += (A[i] * A[i] + B[i] * B[i]) / 2; n++; } return 10 * Math.log10(q / n + 1e-20); };
        return { accepted, peak: rms(gustAt + dur * 0.38, gustAt + dur * 0.62) };
      }
      const a = await render(false), b = await render(true);
      return { accepted: b.accepted, noGustDb: +a.peak.toFixed(1), gustDb: +b.peak.toFixed(1), riseDb: +(b.peak - a.peak).toFixed(1) };
    });
    console.log('gust', JSON.stringify(report.gust)); save();
    await p.close();
  }
} finally {
  save();
  console.log(JSON.stringify({ layout: report.layout, errors: report.errors.length, first: report.errors.slice(0, 3) }));
  await browser.close();
}
