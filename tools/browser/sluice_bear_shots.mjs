// 잠든 습지 말레이곰 석상 렌더 (게임 모델 그대로 — 사진은 쓰지 않는다): docs/import/sluice/bear_*.webp
//  ortho  : 사장님 사진과 같은 구도(정면 직교, 685×512, 정수리 y 43 · 발바닥 y 492 · 몸 가운데 x 347 — 받침·땅 숨김) → 비율 맞대기용
//  front  : 정면 약간 아래에서 긴 렌즈(받침까지) · views : 앞 · 앞 왼쪽 35° · 옆 · 뒤 · face : 머리 가까이
//  실행: vite 개발 서버를 띄운 뒤 node tools/browser/sluice_bear_shots.mjs http://127.0.0.1:5173 [곰 키 m] [이름 꼬리]
//   (곰 키를 주면 그 키로, 이름 꼬리를 주면 bear_<보기>_<꼬리>.webp 로 — 크기 비교용)
//  곰 2(돌 석상, 10/14): node tools/browser/sluice_bear_shots.mjs <개발 서버> --stone → bear_stone_*.webp
//   ortho · face · views · detail(가슴 양각·음각 홈·끌 자국 / 정수리 골 / 발·받침의 닳음·깨짐·이끼·지의류 / 오른 귀 깨짐) ·
//   game(경기 화면 1280×800, 상대 하인리히, AI 멈춤, 2.5 초) · pixel(도트 모드 2.6 초) · game6(AI 그대로 · 플레이어 가만히 6 초 — 키 3.2 m 귀 자리 확인)
//  곰 2b(이마 경계 곡선 · 얼굴 판 둘레 · 짙은 돌 밝힘, 10/14): node tools/browser/sluice_bear_shots.mjs <개발 서버> --face2 → bear_stone_face2_*.webp
//   ortho · face · game(2.5 초) · pixel(도트 모드 2.6 초) · game_cmp(경기 화면·도트 모드의 곰 둘레 2 배, 전/후 — 전 = 저장소의 bear_stone_game.webp ·
//   bear_stone_pixel.webp: 곰 2 를 같은 카메라로 찍은 것. --stone 을 다시 돌리면 그 둘이 바뀌므로 비교는 그 전에)
//  playwright 는 저장소 의존성에 없다 (npm i --no-save playwright). 크롬 경로는 PW_CHROMIUM
import { chromium } from 'playwright';
import fs from 'node:fs';

const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const stone = process.argv.includes('--stone');
const face2 = process.argv.includes('--face2');
const rest = process.argv.slice(3).filter((a) => a !== '--stone' && a !== '--face2');
const bearH = rest[0] ? `&bearH=${+rest[0]}` : '';
const tail = rest[1] ? `_${rest[1]}` : '';
const outDir = new URL('../../docs/import/sluice/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
const shots = face2
  ? [
      ['stone_face2_ortho', 'view=ortho&plinth=0&ground=0&w=685&h=512'],
      ['stone_face2_face', 'view=face&w=480&h=480'],
    ]
  : stone
  ? [
      ['stone_ortho', 'view=ortho&plinth=0&ground=0&w=685&h=512'],
      ['stone_face', 'view=face&w=480&h=480'],
      ['stone_views', 'view=strip&w=1440&h=450'],
    ]
  : [
      ['ortho', 'view=ortho&plinth=0&ground=0&w=685&h=512'],
      ['front', 'view=front&w=640&h=800'],
      ['views', 'view=strip&w=1440&h=450'],
      ['face', 'view=face&w=480&h=480'],
    ];
// 가까이 보기 넷 (2×2 한 장): 가슴 앞 왼쪽(양각 판 · 음각 홈 · 끌 자국) · 정수리 위 앞(정수리 골 · 오른 귀 깨짐) · 발과 받침(닳은 발가락 · 깨짐 · 이끼 · 지의류) · 오른 귀 옆
const DETAIL = [
  'view=lens&yaw=-32&eye=0.78&look=0.74&span=0.34',
  'view=lens&yaw=12&eye=1.7&look=0.95&span=0.22',
  'view=lens&yaw=24&eye=0.12&look=0.02&span=0.36',
  'view=lens&yaw=-50&eye=0.95&look=0.92&span=0.2',
];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  p.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
};
watch(page);
await page.route('**/*', (r) => (r.request().url().startsWith(base) || r.request().url().startsWith('data:') ? r.continue() : r.abort())); // 바깥 요청 막기
const save = (name, dataUrl) => {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  fs.writeFileSync(new URL(`bear_${name}${tail}.webp`, outDir), buf);
  console.log(`bear_${name}${tail}.webp ${(buf.length / 1024).toFixed(1)} KB`);
};
const render = async (qs) => {
  await page.goto(`${base}/tools/browser/sluice_bear.html?${qs}${bearH}`);
  await page.waitForFunction(() => window.shot?.done, null, { timeout: 120000 });
  return page.evaluate(() => window.shot);
};
/** 그림 여럿을 한 장으로 (브라우저 캔버스): cols 칸씩, 칸 사이 gap px, 결과 webp */
const compose = async (urls, cols, gap = 6, quality = 0.88) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  return page.evaluate(async ([list, c, g, q]) => {
    const imgs = await Promise.all(list.map((u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; })));
    const w = imgs[0].width;
    const h = imgs[0].height;
    const rows = Math.ceil(imgs.length / c);
    const cv = document.createElement('canvas');
    cv.width = c * w + (c - 1) * g;
    cv.height = rows * h + (rows - 1) * g;
    const x = cv.getContext('2d');
    x.fillStyle = '#16181a';
    x.fillRect(0, 0, cv.width, cv.height);
    imgs.forEach((im, i) => x.drawImage(im, (i % c) * (w + g), Math.floor(i / c) * (h + g)));
    return cv.toDataURL('image/webp', q);
  }, [urls, cols, gap, quality]);
};
/** 그림 여럿에서 같은 칸(crop = [x, y, w, h])을 잘라 k 배로 키워 한 장으로 (cols 칸씩) — 전/후 맞대기 */
const composeCrop = async (urls, cols, crop, k, gap = 6, quality = 0.88) => {
  await page.setContent('<!doctype html><html><body></body></html>');
  return page.evaluate(async ([list, c, [cx, cy, cw, ch], kk, g, q]) => {
    const imgs = await Promise.all(list.map((u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u; })));
    const w = cw * kk;
    const h = ch * kk;
    const rows = Math.ceil(imgs.length / c);
    const cv = document.createElement('canvas');
    cv.width = c * w + (c - 1) * g;
    cv.height = rows * h + (rows - 1) * g;
    const x = cv.getContext('2d');
    x.imageSmoothingEnabled = false; // 도트 모드 칸이 뭉개지지 않게
    x.fillStyle = '#16181a';
    x.fillRect(0, 0, cv.width, cv.height);
    imgs.forEach((im, i) => x.drawImage(im, cx, cy, cw, ch, (i % c) * (w + g), Math.floor(i / c) * (h + g), w, h));
    return cv.toDataURL('image/webp', q);
  }, [urls, cols, crop, k, gap, quality]);
};
for (const [name, qs] of shots) {
  const s = await render(qs);
  save(name, s.url);
  if (name.endsWith('ortho')) console.log(`  삼각형 ${s.triangles}`);
}
// 경기 화면 (무대 빛·안개 그대로): 판을 시작해 정한 게임 시간에 멈추고 일시정지 창을 숨겨 찍는다 → data URL (png)
const gameShot = async (query, t, ai) => {
  const g = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  watch(g);
  await g.goto(`${base}/?stage=sluice&foe=heinrich&weapon=longsword&emo=0${query}`, { waitUntil: 'networkidle' });
  await g.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await g.click('#btnStart'); // 메뉴 첫 단추 ('싸움 시작' → '여정 시작', 사장님 10/14 11:0x)
  if (!ai) await g.evaluate(() => { window.game.ai.update = () => {}; });
  await g.waitForFunction((tt) => window.game.state === 'fight' && window.game.stats.simTime >= tt, t, { timeout: 240000, polling: 50 });
  await g.keyboard.press('KeyP');
  await g.evaluate(() => document.getElementById('menu').classList.remove('show'));
  await g.waitForTimeout(400);
  const png = await g.screenshot();
  await g.close();
  return `data:image/png;base64,${png.toString('base64')}`;
};
if (face2) {
  const after = await gameShot('', 2.5, false);
  save('stone_face2_game', await compose([after], 1, 0, 0.82));
  const afterPx = await gameShot('&pixel=1', 2.6, false);
  save('stone_face2_pixel', await compose([afterPx], 1, 0, 0.82));
  const prev = (n) => `data:image/webp;base64,${fs.readFileSync(new URL(n, outDir)).toString('base64')}`;
  save('stone_face2_game_cmp', await composeCrop([prev('bear_stone_game.webp'), after, prev('bear_stone_pixel.webp'), afterPx], 4, [490, 30, 200, 300], 2));
}
if (stone) {
  const cells = [];
  for (const qs of DETAIL) cells.push((await render(`${qs}&w=560&h=420`)).url);
  save('stone_detail', await compose(cells, 2));
  const game = async (name, query, t, ai) => save(name, await compose([await gameShot(query, t, ai)], 1, 0, 0.82));
  await game('stone_game', '', 2.5, false);
  await game('stone_pixel', '&pixel=1', 2.6, false);
  await game('stone_game6', '', 6, true);
}
console.log(errors.length ? `에러:\n${errors.join('\n')}` : '콘솔 에러 0');
await browser.close();
if (errors.length) process.exit(1);
