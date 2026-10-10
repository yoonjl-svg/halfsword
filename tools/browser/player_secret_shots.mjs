// 플레이어 비기 (10/9 23:5x — docs/strike/player_secret_2026-10-09.md) 브라우저 확인: 싸움을 띄우고
//  ① 내 무기 유파의 비기 창이 열려 흐린 '비기' 꼬리표가 뜬 순간 PNG ② 그 창 안에 공격 입력(화면 톡 = 찌르기 입력)을 넣어 비기가 실행되는 순간 PNG.
//  창이 저절로(상대 사건) 열리길 natural 벽시계 한도만큼 기다리고, 안 열리면 창을 직접 연다(game.playerSecret.openWindow — 플레이어가 휘두르지 않는
//  자동 시험이라 이베리아·중국(내 베기 사건)은 늘 이쪽). 실행 단계(back·hold·strike·follow·stiff)와 결정타 연출 수, 콘솔 에러를 적는다.
//  실행: npx vite build && npx vite preview --port 4173 --strictPort &
//        node tools/browser/player_secret_shots.mjs http://127.0.0.1:4173 <PNG 폴더> [무기 id (기본 monohoshizao)] [natural 벽시계 ms (기본 90000)]
//  소프트웨어 GL 은 느리다(벽 10 s ≈ 게임 1~2 s). playwright 는 저장소 의존성에 없다 (npm i --no-save playwright)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:4173';
const shotDir = process.argv[3] || '.';
const weapon = process.argv[4] || 'monohoshizao';
const naturalMax = +(process.argv[5] || 90000);
fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true }); // 폰 가로 (세로면 '가로로 돌려주세요' 가림막)
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
await page.goto(`${base}/?weapon=${weapon}&foeWeapon=longsword`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.getByText('싸움 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 60000 });
const S = await page.evaluate(() => window.game.playerSecret.S?.name ?? null);
console.log(`WEAPON ${weapon} secret ${S}`);
const probe = () =>
  page.evaluate(() => {
    const g = window.game;
    // 10/10 글자 체계: 내 비기 알림은 #secretSlot(R3) — 창 열림은 가운데 #stateCue(C)에도, 경직은 #stateCue. 보이는 칸 하나를 읽는다 (없으면 R3)
    const el = [...document.querySelectorAll('#secretSlot, #stateCue, #techSlot')].find((e) => e.classList.contains('show')) ?? document.getElementById('secretSlot');
    return {
      sim: +g.stats.simTime.toFixed(2),
      state: g.state,
      open: !!g.playerSecret?.open,
      opened: g.playerSecret?.opened ?? 0,
      stage: g.player.skill.sec?.stage ?? null,
      bursts: g.player.skill.secretBursts,
      stats: g.player.skill.secretStats,
      cue: { slot: el.id, show: el.classList.contains('show'), kind: el.dataset.kind, who: el.dataset.who, op: +getComputedStyle(el).opacity, text: el.innerText.replace(/\s+/g, ' ').trim() },
      d: +g.player.foeDistance().toFixed(2),
      dropped: g.player.skill.secretDropped ?? 0,
      pain: +g.player.pain.toFixed(2),
      dc: g.player.skill.sec ? +g.player.skill.secretDistAtHit().toFixed(2) : null,
      reach: +g.player.swordArt.measure.reach.toFixed(2),
    };
  });
// ① 창 기다리기 (저절로) → 안 열리면 직접
const t0 = Date.now();
let r = await probe();
let how = 'natural';
while (!r.open && Date.now() - t0 < naturalMax && r.state === 'fight') {
  await page.waitForTimeout(100);
  r = await probe();
}
if (!r.open) {
  how = 'forced';
  // 닿을 만한 거리까지 기다렸다가 연다 (AI 가 다가온다)
  const t1 = Date.now();
  const W = await page.evaluate(() => ({ when: [].concat(window.game.playerSecret.S?.when ?? []), reach: window.game.player.swordArt.measure.reach }));
  const near = W.when.includes('combo') || W.when.includes('firstHit') ? W.reach + 0.1 : 2.4; // 내 베기 사건 비기는 이어 치기 거리에서 (저절로 열릴 때와 같은 거리)
  while (r.d > near && Date.now() - t1 < 60000 && r.state === 'fight') {
    await page.waitForTimeout(150);
    r = await probe();
  }
  await page.evaluate(() => window.game.playerSecret.openWindow(null));
  r = await probe();
}
// 소프트웨어 GL 은 게임 시간이 벽시계의 ~1/10 로 흐르고 스크린샷이 몇 초 걸린다 → 창(0.5 s)이 사진·톡 사이에 닫히지 않게 시험에서만 창 시간을 늘린다
await page.evaluate(() => {
  if (window.game.playerSecret.open) window.game.playerSecret.open.t = 5;
});
// 꼬리표가 보일 때까지 (전환 0.15 s)
for (let k = 0; k < 20 && !(r.cue.show && r.cue.kind === 'secretReady' && r.cue.op > 0.5); k++) {
  await page.waitForTimeout(100);
  r = await probe();
}
await page.screenshot({ path: `${shotDir}/player_secret_${weapon}_1_ready.png` });
console.log(`READY ${how} wall ${((Date.now() - t0) / 1000).toFixed(0)}s ` + JSON.stringify(r));
// ② 창 안에 공격 입력: 칼 쪽 화면을 톡 (찌르기 입력)
//  손가락 톡 = pointerdown → pointerup (pointerType touch, 끌지 않음 — input.js 의 톡 판정). 캔버스에 바로 보낸다 (헤드리스 터치 흉내는 일시정지 단추 등에 걸릴 수 있다)
await page.evaluate(async () => {
  const cv = document.getElementById('game');
  const o = { pointerId: 77, pointerType: 'touch', clientX: 620, clientY: 210, bubbles: true, isPrimary: true, button: 0 };
  cv.dispatchEvent(new PointerEvent('pointerdown', o));
  await new Promise((r) => setTimeout(r, 40));
  cv.dispatchEvent(new PointerEvent('pointerup', o));
});
const stages = [];
let lastStage;
let shot2 = null;
const t2 = Date.now();
while (Date.now() - t2 < 60000) {
  await page.waitForTimeout(60);
  r = await probe();
  if (lastStage !== r.stage) {
    lastStage = r.stage;
    stages.push(`${r.stage} @sim ${r.sim} d ${r.d} dc ${r.dc} pain ${r.pain} drop ${r.dropped}`);
  }
  if (!shot2 && (r.stage === 'strike' || r.stage === 'follow') && (r.cue.op > 0.6 || r.stage === 'follow')) {
    shot2 = r;
    await page.screenshot({ path: `${shotDir}/player_secret_${weapon}_2_strike.png` });
  }
  if (stages.length > 1 && r.stage === null) break;
}
console.log('STRIKE ' + JSON.stringify(shot2));
console.log('STAGES ' + JSON.stringify(stages));
console.log('END ' + JSON.stringify(await probe()));
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length || !shot2 ? 1 : 0);
