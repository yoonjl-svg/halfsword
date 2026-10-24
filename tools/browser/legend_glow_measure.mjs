// 레전드 기운이 보는 사람에게 얼마나 눈에 띄나 — 켬 · 끔 같은 장면 사진 (10/24 사장님 '엑스칼리버를 기준으로 비슷하게 눈에 띄는 정도가 되게 일괄 맞춰')
//  무기 × 보기(mine = 내가 든 칼 · foe = 상대가 든 칼 — 둘 다 게임 카메라 · side = 내가 든 칼 옆 1.25 m 가까이 · sidefar = 같은 각 4.3 m) 마다 판을 한 번 열고, 판 시작 자세에서 물리 · AI 를 멈춘 뒤
//  무대를 차례로 바꿔(game.setStage) 같은 자세 · 같은 카메라로 기운 끔 한 장 + 켬 여러 장(기운 시계 AURA_VIEW.t 를 바꿔 숨 · 일렁임 · 티끌 한살이를 고루)을 찍는다.
//  찍는 동안은 화면 시계를 멈춰(requestAnimationFrame 의 시각을 고정 — 무대 횃불 · 바다 · 먼지도 멈춤) 켬 · 끔 차이가 기운 몫만 남게 한다.
//  보이는 칼날 자리(칼날 메쉬만 자홍 단색으로 한 장 — mask)와 칼날 자리(화면 px — 칼날 시작 · 끝 · 칼날 가운데의 m 당 px · meta.json)도 남긴다.
//  수치는 tools/browser/legend_glow_metrics.py 가 셈한다.
//  실행: vite 빌드를 preview 로 띄운 뒤
//    node tools/browser/legend_glow_measure.mjs http://127.0.0.1:<포트> <출력 폴더> [--weapons=excalibur,…] [--stages=poseidon,castle,cathedral,poseidon_night]
//         [--views=mine,foe,side,sidefar] [--samples=4] [--dsf=1] [--sheet(끔 · 켬만 — 견줌 판 그림용)] [--tune=<프로필 덮어쓰기 json 파일 — ?auraTune>]
//  폰 가로 844 × 390 · 화면 배율 --dsf(기본 1 — 재기 · 견줌 판 그림은 2). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const opt = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const base = (pos[0] || 'http://127.0.0.1:5587').replace(/\/$/, '');
const out = pos[1] || 'out/legend_glow';
const LEGENDS = ['excalibur', 'kusanagi', 'moye', 'ganjiang', 'durandal', 'balisarda'];
const weapons = opt('weapons', LEGENDS.join(',')).split(',');
const stageList = opt('stages', 'poseidon,castle,cathedral,poseidon_night').split(',');
const views = opt('views', 'mine,foe,side,sidefar').split(',');
const samples = +opt('samples', 4);
const sheetOnly = process.argv.includes('--sheet'); // 견줌 판 그림만: 끔 · 켬만 찍고 mask · 끔 두 번째는 건너뜀
const dsf = +opt('dsf', 1); // 화면 배율 (재기는 1 — 화면 px 그대로 · 견줌 판 그림은 2)
const tunePath = opt('tune', '');
const tune = tunePath ? fs.readFileSync(tunePath, 'utf8').trim() : '';
// 견줌 갈래 (값 맞추기용): { "<무기 id>" | "*": [{ name, look: { gain, glow, lightGain, … }, motes: null | { n, size, alpha, color, rim, far } }] }
//  한 판 안에서 기운의 look(aura.js 가 그릴 때마다 읽는 값)을 바꿔 갈래마다 켬 사진을 찍는다. 끔 · mask 사진은 같이 쓴다(offKey). 티끌 수는 판을 세울 때의 수까지
const variantsPath = opt('variants', '');
const VARIANTS = variantsPath ? JSON.parse(fs.readFileSync(variantsPath, 'utf8')) : null;
const W = 844, H = 390;
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const meta = fs.existsSync(`${out}/meta.json`) ? JSON.parse(fs.readFileSync(`${out}/meta.json`, 'utf8')) : {};
meta._tune = tune || null;
meta._samples = samples;
meta._dsf = dsf;
const frames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
// 기운 시계 견본: 숨(1.3 rad/s) · 일렁임(0.9) · 티끌 한살이(0.22 ~ 0.38 /s)를 고루 지나는 시각들
const sampleT = (k) => 40 + k * 1.37;

for (const w of weapons) {
  for (const view of views) {
    const mineW = view === 'foe' ? 'longsword' : w;
    const foeW = view === 'foe' ? w : 'longsword';
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: dsf, hasTouch: true, isMobile: true });
    page.on('pageerror', (e) => errors.push(`${w}/${view} pageerror: ${e}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${w}/${view} console: ${m.text()}`));
    // 화면 시계 고정 손잡이: window.__freeze 가 숫자면 rAF 가 그 시각을 넘긴다(dt = 0 — 물리 · 무대 움직임 · 기운 시계 모두 멈춤)
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__freeze = null;
      window.__lastTs = 0;
      window.requestAnimationFrame = (cb) => raf((ts) => { window.__lastTs = ts; cb(window.__freeze ?? ts); });
    });
    const q = new URLSearchParams({ stage: stageList[0], foe: 'isolde', weapon: mineW, foeWeapon: foeW, openSweep: '0', emo: '0' });
    if (tune) q.set('auraTune', tune);
    await page.goto(`${base}/?${q}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 300000 });
    await page.tap('#btnStart');
    await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 300000, polling: 20 });
    await page.evaluate(() => {
      const g = window.game;
      g.ai.update = () => {}; // 상대는 판 시작 자세 그대로
      if (g.settings) { g.settings.trail = false; g.settings.fpsCap = false; }
    });
    await page.addStyleTag({ content: 'body > :not(#game) { visibility: hidden !important; } #game { visibility: visible !important; }' });
    await page.waitForFunction(() => window.game.stats.simTime >= 1.6, null, { timeout: 300000, polling: 50 });
    await page.evaluate(() => {
      const g = window.game;
      g.world.step = () => {}; // 몸 · 칼이 그 자리에 선다
      g.freeCam = true; // 카메라는 지금 게임 카메라 자리 그대로
    });
    if (view === 'side' || view === 'sidefar') {
      // 칼 옆 (legend_aura_shots 와 같은 자리 잡기 — 칼날 가운데를 화면 가운데로, 칼 든 쪽 옆 · 상대는 감춤)
      //  side = 1.25 m 가까이 · sidefar = 4.3 m(게임 카메라 ~ 칼 거리 — 무기마다 자세가 달라도 같은 각 · 같은 거리로 견줌)
      await page.evaluate((R) => {
        const g = window.game, T = g.THREE, f = g.player, o = g.enemy;
        const ent = f.meshes.find((m) => m.kind === 'weapon');
        ent.group.updateMatrixWorld(true);
        const c = new T.Vector3(0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength * 0.5, 0).applyMatrix4(ent.group.matrixWorld);
        const tip = new T.Vector3(0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyMatrix4(ent.group.matrixWorld);
        const axis = tip.clone().sub(c).normalize();
        const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
        let fx = a.x - b.x, fz = a.z - b.z;
        const L = Math.hypot(fx, fz) || 1;
        fx /= L; fz /= L;
        const dir = new T.Vector3(-fz * f.side, 0, fx * f.side);
        dir.addScaledVector(axis, -dir.dot(axis)).normalize();
        dir.y += 0.15;
        dir.normalize();
        for (const m of o.meshes) m.group.visible = false;
        g.camera.position.copy(c).addScaledVector(dir, R);
        g.camera.lookAt(c);
        g.camera.updateMatrixWorld(true);
      }, view === 'side' ? 1.25 : 4.3);
    }
    await frames(page, 4);
    for (const stage of stageList) {
      await page.evaluate(() => { window.__freeze = null; });
      if ((await page.evaluate(() => window.game.stage.id)) !== stage) {
        await page.evaluate((s) => window.game.setStage(s), stage);
        await page.waitForTimeout(1500); // 무대 그림 · 빛이 자리 잡도록 (몸은 멈춘 채)
      }
      await frames(page, 3);
      await page.evaluate(() => { window.__freeze = window.__lastTs; });
      await frames(page, 3);
      const info = await page.evaluate((view) => {
        const g = window.game, T = g.THREE;
        const f = view === 'foe' ? g.enemy : g.player;
        const ent = f.meshes.find((m) => m.kind === 'weapon');
        ent.group.updateMatrixWorld(true);
        g.camera.updateMatrixWorld(true);
        const hilt = f.weaponCfg.hiltLength, L = f.weaponCfg.bladeLength;
        const toPx = (v) => { const p = v.clone().project(g.camera); return [(p.x + 1) / 2 * innerWidth, (1 - p.y) / 2 * innerHeight, p.z]; };
        const a = new T.Vector3(0, hilt, 0).applyMatrix4(ent.group.matrixWorld);
        const b = new T.Vector3(0, hilt + L, 0).applyMatrix4(ent.group.matrixWorld);
        const mid = a.clone().lerp(b, 0.5);
        const right = new T.Vector3().setFromMatrixColumn(g.camera.matrixWorld, 0).normalize();
        const m0 = toPx(mid), m1 = toPx(mid.clone().addScaledVector(right, 0.1));
        let aura = null;
        ent.group.traverse((o) => { if (o.userData.legendaryAura) aura = o.userData.legendaryAura; });
        return { stage: g.stage.id, weapon: f.weapon.id, a: toPx(a), b: toPx(b), pxPerM: Math.hypot(m1[0] - m0[0], m1[1] - m0[1]) / 0.1, camDist: g.camera.position.distanceTo(mid), aura };
      }, view);
      const key = `${w}_${view}_${stage}`;
      const shot = async (name) => { await frames(page, 2); await page.screenshot({ path: `${out}/${key}_${name}.png` }); };
      await page.evaluate(() => { window.game.auraView.on = false; window.game.auraView.t = 40; });
      await shot('off');
      if (!sheetOnly) {
        // 보이는 칼날 자리: 칼날 메쉬만 잠깐 자홍 단색으로(몸 · 코등이에 가린 곳은 안 칠해짐) — 셈은 이 자리 둘레만 본다
        await page.evaluate((view) => {
          const g = window.game, f = view === 'foe' ? g.enemy : g.player;
          window.__maskSave = f.bladeMesh.material;
          f.bladeMesh.material = new g.THREE.MeshBasicMaterial({ color: 0xff00ff, fog: false, toneMapped: false });
        }, view);
        await shot('mask');
        await page.evaluate((view) => {
          const g = window.game, f = view === 'foe' ? g.enemy : g.player;
          f.bladeMesh.material.dispose();
          f.bladeMesh.material = window.__maskSave;
        }, view);
      }
      const vlist = VARIANTS ? VARIANTS[w] ?? VARIANTS['*'] ?? [{ name: '' }] : [{ name: '' }];
      for (const v of vlist) {
        const look = await page.evaluate(({ view, v }) => {
          const g = window.game, f = view === 'foe' ? g.enemy : g.player;
          let A = null, P = null;
          f.meshes.find((m) => m.kind === 'weapon').group.traverse((o) => { if (o.userData.legendaryAura) A = o; });
          const L = A.userData.legendaryAura.look;
          window.__baseLook ??= JSON.parse(JSON.stringify(L));
          Object.assign(L, JSON.parse(JSON.stringify(window.__baseLook)), v.look || {});
          if ('motes' in v) L.motes = v.motes;
          A.traverse((o) => { if (o.isPoints) P = o; });
          const haze = A.children.find((o) => o.isMesh)?.material.uniforms;
          if (haze) haze.uColor.value.setRGB(...L.color); // 아지랑이 색도 바꿔 볼 수 있다 (칼날 발광 · 점 조명 색은 판을 세울 때 — ?auraTune)
          if (P && L.motes) {
            const u = P.material.uniforms, mo = L.motes;
            u.uSize.value = mo.size; u.uAlpha.value = mo.alpha; u.uFarMix.value = mo.far;
            u.uColor.value.setRGB(...mo.color); u.uRim.value.setRGB(...mo.rim);
            P.geometry.setDrawRange(0, mo.n);
          }
          return JSON.parse(JSON.stringify(L));
        }, { view, v });
        const vkey = v.name ? `${w}~${v.name}_${view}_${stage}` : key;
        for (let k = 0; k < samples; k++) {
          await page.evaluate((t) => { window.game.auraView.on = true; window.game.auraView.t = t; }, sampleT(k));
          await frames(page, 2);
          await page.screenshot({ path: `${out}/${vkey}_on${k}.png` });
        }
        if (v.name) meta[vkey] = { ...info, aura: { ...info.aura, look }, weapon: `${w}~${v.name}`, offKey: key, view, samples, dsf };
      }
      await page.evaluate(() => { window.game.auraView.on = false; });
      if (!sheetOnly) await shot('off2'); // 같은 장면이 그대로인지(끔 두 장의 차이 = 0 이어야)
      await page.evaluate(() => { window.game.auraView.on = true; window.game.auraView.t = null; });
      meta[key] = { ...info, view, samples, dsf };
      console.log(key, info.aura?.tone ?? 'no aura', `blade ${Math.hypot(info.b[0] - info.a[0], info.b[1] - info.a[1]).toFixed(0)} px · ${info.pxPerM.toFixed(0)} px/m · cam ${info.camDist.toFixed(2)} m`);
      if (info.weapon !== w) errors.push(`${key}: weapon ${info.weapon}`);
      if (!info.aura) errors.push(`${key}: no aura`);
      if (info.stage !== stage) errors.push(`${key}: stage ${info.stage}`);
    }
    await page.close();
    fs.writeFileSync(`${out}/meta.json`, JSON.stringify(meta, null, 1));
  }
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : '콘솔 오류 0');
process.exit(errors.length ? 1 : 0);
