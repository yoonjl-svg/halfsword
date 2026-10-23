// 망토 흔들림 그림 (10/24 — src/cape_sway.js · docs/handoff/cape_sway_2026-10-24/)
//  ?look=<인물> 로 상대를 세우고 AI 끼리처럼 싸우게 한 채(내 쪽은 손 · 발 입력 없음 — 상대 AI 만 움직임), 카메라를 상대 등 뒤 비스듬히(망토가 보이게) 붙여 따라간다.
//  망토 아랫단 흔들림 각(묶은 뒤)이 문턱(뒤 · 옆 · 비틀림 가운데 가장 큰 것 ≥ --min 도)을 넘는 프레임에 물리 · 흔들림 셈을 멈추고 찍는다(흔들린 꼴).
//  이어 같은 프레임에서 뼈만 쉬는 꼴(돌림 0)로 되돌려 한 장 더(쉬는 꼴 — 그 전 단단한 망토와 같음). 폰 가로 844 × 390 · 화면 배율 2 · 화면 글은 감춤.
//  실행: vite 개발 서버를 띄운 뒤
//    node tools/browser/cape_sway_shots.mjs http://127.0.0.1:5414 <출력 폴더> [인물 …] [--seed=<n>] [--min=<도>]
//  출력: <인물>_sway.png · <인물>_rest.png · <인물>_angles.json(찍은 프레임의 각 · 게임 시간). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const base = (process.argv[2] || 'http://127.0.0.1:5414').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/cape_sway_2026-10-24';
const ids = process.argv.slice(4).filter((a) => !a.startsWith('--'));
const heroes = ids.length ? ids : ['bernardo', 'roland', 'artoria'];
const seedArg = process.argv.find((a) => a.startsWith('--seed='));
const minDeg = +(process.argv.find((a) => a.startsWith('--min='))?.slice(6) ?? 6);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const nextFrames = (page, n = 3) => page.evaluate((n) => new Promise((ok) => { const f = () => (--n <= 0 ? ok() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);

for (const id of heroes) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(`${id} pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${id} console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${id} http ${r.status()}: ${r.url()}`); });
  if (seedArg) await page.addInitScript((seed) => { let x = seed; Math.random = () => ((x = (x * 9301 + 49297) % 233280) / 233280); }, +seedArg.slice(7));
  await page.goto(`${base}/?stage=arena&look=${id}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 600000 });
  await page.getByText('여정 시작').click({ timeout: 300000 });
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.5, null, { timeout: 900000 });
  await page.addStyleTag({ content: 'body > :not(#game), #moveStick, #moveKnob { display: none !important; visibility: hidden !important; }' });
  // 카메라: 상대 골반 뒤 비스듬히(150°) 2.6 m · 높이 +0.35 — 프레임마다 따라감 · 흔들림 각을 문턱과 견줌
  const shot = await page.evaluate((minDeg) => new Promise((ok) => {
    const g = window.game, T = g.THREE, E = g.enemy;
    g.freeCam = true;
    const ctls = [];
    E.groups.chest.traverse((o) => { if (o.userData.capeSway) ctls.push(o.userData.capeSway); });
    const fw = new T.Vector3(), at = new T.Vector3(), cam = new T.Vector3();
    let smooth = null;
    const t0 = g.stats.simTime;
    const tick = () => {
      const c = E.bodies.pelvis.translation(), r = E.bodies.pelvis.rotation();
      fw.set(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w)).setY(0).normalize().applyAxisAngle(new T.Vector3(0, 1, 0), (150 * Math.PI) / 180);
      at.set(c.x, c.y - 0.05, c.z);
      cam.copy(at).addScaledVector(fw, 2.6).setY(c.y + 0.35);
      smooth = smooth ? smooth.lerp(cam, 0.15) : cam.clone();
      g.camera.position.copy(smooth);
      g.camera.lookAt(at);
      const a = ctls[0]?.out, d = 180 / Math.PI;
      const big = a ? Math.max(-a.z * d, Math.abs(a.x) * d, Math.abs(a.y) * d) : 0;
      if ((big >= minDeg && g.stats.simTime > t0 + 1.5) || g.stats.simTime > t0 + 40) {
        g.world.step = () => {}; // 물리를 멈춘다
        for (const ctl of ctls) {
          ctl.realBones = ctl.bones;
          ctl.bones = ctl.bones.map(() => ({ quaternion: new T.Quaternion() })); // 흔들림 셈은 돌아도 진짜 뼈는 이 꼴에 멈춤
        }
        ok({ simTime: g.stats.simTime, deg: a ? { fwdBack: a.z * d, side: a.x * d, twist: a.y * d } : null, big });
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), minDeg);
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/${id}_sway.png` });
  await page.evaluate(() => {
    const E = window.game.enemy;
    E.groups.chest.traverse((o) => { for (const b of o.userData.capeSway?.realBones ?? []) b.quaternion.identity(); });
  });
  await nextFrames(page, 4);
  await page.screenshot({ path: `${out}/${id}_rest.png` });
  writeFileSync(`${out}/${id}_angles.json`, JSON.stringify(shot, null, 1));
  console.log(id, JSON.stringify(shot));
  await page.close();
}
await browser.close();
console.log(errors.length ? 'ERRORS:\n  ' + errors.join('\n  ') : 'ZERO console errors');
process.exit(errors.length ? 1 : 0);
