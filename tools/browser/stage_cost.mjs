// 무대별 그리기 양 비교: 그리기 호출 · 삼각형 · 투명 면(투명 재질을 쓰는 보이는 물체 수) · 프레임 시간(헤드리스 참고치)
//  폰 가로(844×420), 경기 카메라 그대로, 두 사람은 가만히 겨눈 자세. 물리·카메라를 멈추고 잰다.
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/stage_cost.mjs http://127.0.0.1:5173 [무대 id ...]
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
const base = process.argv[2] || 'http://127.0.0.1:5173';
const ids = process.argv.slice(3).length ? process.argv.slice(3) : ['poseidon', 'clearing', 'temple', 'castle', 'poseidon_night', 'cathedral', 'loggia', 'corsair', 'sacred_grove', 'frozen_bay', 'qinglan'];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const rows = [];
let errs = 0;
for (const id of ids) {
  const page = await browser.newPage({ viewport: { width: 844, height: 420 }, deviceScaleFactor: 1 });
  page.on('pageerror', () => errs++);
  await page.goto(`${base}/?stage=${id}&weapon=longsword&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
  await page.getByText('싸움 시작').click();
  await page.evaluate(() => { window.game.ai.update = () => {}; });
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.stats.simTime > 1.0, null, { timeout: 90000 });
  await page.keyboard.press('KeyP');
  await page.evaluate(() => { window.game.freeCam = true; });
  const r = await page.evaluate(() => new Promise((ok) => {
    const ts = [];
    const f = (t) => {
      ts.push(t);
      if (ts.length <= 40) return requestAnimationFrame(f);
      const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b);
      let scene = null; window.game.player.meshes[0].group.traverseAncestors((o) => { if (o.isScene) scene = o; });
      let transparent = 0, stageTransparent = 0, instances = 0;
      scene.traverseVisible((o) => {
        if (!o.isMesh && !o.isPoints && !o.isSprite) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        if (mats.some((m) => m && m.transparent && m.visible !== false)) transparent++;
        if (o.isInstancedMesh) instances += o.count;
      });
      const info = window.game.renderInfo();
      ok({ calls: info.calls, triangles: info.triangles, transparent, instances, fog: scene.fog ? (scene.fog.isFogExp2 ? `Exp2 ${scene.fog.density}` : `${scene.fog.near}-${scene.fog.far}`) : 'none', frameMs: +d[d.length >> 1].toFixed(1) });
    };
    requestAnimationFrame(f);
  }));
  rows.push({ id, ...r });
  console.log(id, JSON.stringify(r));
  await page.close();
}
await browser.close();
console.log('\n| 무대 | 그리기 호출 | 삼각형 | 투명 물체 | 인스턴스 | 안개 | 프레임 ms(헤드리스) |\n|---|---:|---:|---:|---:|---|---:|');
for (const r of rows) console.log(`| ${r.id} | ${r.calls} | ${r.triangles} | ${r.transparent} | ${r.instances} | ${r.fog} | ${r.frameMs} |`);
console.log(errs ? `pageerrors ${errs}` : 'ZERO page errors');
