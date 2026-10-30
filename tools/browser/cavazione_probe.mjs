// 칼끝 돌려 빼기 (I9 — 사장님 10/30 '카바치오네 혹시 거리 제한이 있는가? … 한번도 안나감') 실제 입력 길 확인 — 브라우저 (Vite 개발 서버).
//  저장: 금화를 채워 진짜 배우기(skill_tree_store.js learnNode)로 이탈리아 I1 · I3 · I5 · I6 · I9 를 익힌 뒤 다시 불러옴(?skillNodes · ?uniqueStage 없음 — 익힌 칸 그대로).
//  판: 레이피어 · 상대 롱소드(AI 멈춤 — 막아찌르기가 늘 빗나가게 떨어져 섬) · 터치 기기(CDP 터치 사건 — 손가락 둘: 막기 단추 · 칼 쪽 화면 탭).
//  시도마다: 막기 단추 새 누름(→ 막아찌르기) → 그 끝(italian_opposition lastEnd · 상처 못 냄) → 끝에서 실제 DELAY 초 뒤 탭 — 막기 단추를 쥔 채(hold) · 먼저 떼고(release).
//  탭이 tapChain 에 닿은 때 판 상태(창 나이 · 막기 쥠 · busy 까닭 · 식힘 · 거리 …)와 결과(나감 · 보통 탭 찌르기)를 적는다.
//  실행: npx vite --port <빈 포트> --strictPort --host 127.0.0.1 &   (5173 · 5174 는 쓰지 않는다)
//        node tools/browser/cavazione_probe.mjs http://127.0.0.1:<포트> <결과 폴더>   · 주소 덧붙임 EXTRA='&cavHeld=0'(옛 판) · GAP=1.6(가슴 사이 m)
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5297';
const out = process.argv[3] || '.tmp/cav_browser';
fs.mkdirSync(out, { recursive: true });
const EXTRA = process.env.EXTRA || '';
const GAP = +(process.env.GAP || 1.6);
const DELAYS = (process.env.DELAYS || '0.3,0.6,0.9').split(',').map(Number); // 실제 초 (창 cavFrom 0.2 ~ cavTo 1.2)
const MODES = (process.env.MODES || 'release,holdKey,holdTouch').split(',');
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const url = `${base}/?weapon=rapier&foeWeapon=longsword&slowMo=0&camOpen=old${EXTRA}`;
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
// 진짜 배우기 (앞 칸부터 — 값을 치르고)
const learned = await page.evaluate(async () => {
  const P = await import('/src/lobby_progress.js');
  const S = await import('/src/skill_tree_store.js');
  P.setCoins(100000);
  P.setHeads(100);
  const r = {};
  for (const id of ['I1', 'I3', 'I5', 'I6', 'I9']) r[id] = S.learnNode('italian', id);
  return { r, now: [...S.readLearned().italian] };
});
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.evaluate((gap) => { game.config.ARENA.startGap = gap; game.config.ARENA.startHold = 0; }, GAP);
await page.getByText('여정 시작', { exact: true }).click();
await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 120000 });
await page.waitForFunction(() => window.game.stats.simTime > 1.0, null, { timeout: 180000 });
const kit = await page.evaluate(() => {
  const g = window.game;
  g.ai.update = () => {}; // 상대는 서 있기만 (막아찌르기가 늘 빗나가게)
  const uq = g.playerUnique;
  const f = g.player;
  const O = f.parryGuard?.opposition;
  const log = (window.cavLog = []);
  // tapChain 에 닿은 탭마다: 판 상태 · 결과
  const orig = uq.tapChain.bind(uq);
  uq.tapChain = function () {
    const E = O?.lastEnd;
    const cavE = uq.list.find((e) => e.tapKey === 'cav');
    const s = {
      clock: +O.guard.clock.toFixed(3), end: E ? { ...E } : null, age: E ? +(O.guard.clock - E.t).toFixed(3) : null, run: !!O.run,
      blocked: uq.blocked, busy: uq.busy(), held: g.playerGuard.held, broken: g.playerGuard.broken, tap: !!f.skill.tap, sec: !!f.skill.sec, pom: !!f.skill.pom,
      foe: f.foe?.state, exh: f.stamina.exhausted, cooling: cavE ? uq.cooling(cavE) : null, dist: +f.foeDistance().toFixed(3), iai: !!f.iai, iaiReq: !!f.iaiReq,
      firedBefore: uq.stats.fired?.cavazione ?? 0, snapBefore: uq.stats.snap ?? 0, secretOpen: !!g.playerSecret?.open,
    };
    const r = orig();
    s.r = r;
    s.fired = (uq.stats.fired?.cavazione ?? 0) - s.firedBefore;
    s.snap = (uq.stats.snap ?? 0) - s.snapBefore;
    s.normalTap = !r && !!f.skill.tap;
    s.cue = f.uniqueCue?.name ?? null;
    log.push(s);
    return r;
  };
  // 캔버스에 온 포인터 사건 (탭이 입력 길에 들었나)
  window.ptr = [];
  const cv = document.querySelector('canvas');
  for (const ev of ['pointerdown', 'pointerup']) window.addEventListener(ev, (e) => window.ptr.push({ ev, id: e.pointerId, type: e.pointerType, canvas: e.target === cv, ts: Math.round(e.timeStamp) }), true);
  return { tradition: f.swordArt.tradition, unique: uq?.list?.map((e) => e.name) ?? [], opposition: !!O, eligible: O?.eligible(), oppKit: f.skillKit ? [...(f.skillKit.f ?? [])] : null, cavFrom: g.config.UNIQUE_ASSIST.cavFrom, cavTo: g.config.UNIQUE_ASSIST.cavTo, cavHeld: g.config.UNIQUE_ASSIST.cavHeld, dist: f.foeDistance() };
});
console.log(JSON.stringify({ learned, kit }));
const cdp = await ctx.newCDPSession(page);
const bp = await page.locator('#btnParry').boundingBox();
if (!bp) throw Error('막기 단추 없음');
const P1 = { x: bp.x + bp.width / 2, y: bp.y + bp.height / 2, id: 1 };
const P2 = { x: 844 * 0.62, y: 420 * 0.3, id: 2 };
// CDP 터치 · 사건 시각(timestamp): 소프트웨어 GL 프레임이 길어 사건이 늦게 돌아도 누른 시간은 손가락 시각으로 (input.js 탭 문턱 tapMs 180 ms — e.timeStamp)
const touch = (type, pts, ts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p) => ({ x: p.x, y: p.y, id: p.id })), ...(ts ? { timestamp: ts } : {}) });
const TAP_S = 0.06; // 탭 누른 시간 (실제 s)
// 갈래: release = 막기 단추(터치)를 떼고 탭 · holdKey = 막기 F 키를 쥔 채 탭(터치 — PC 막기와 같은 G.held) ·
//  holdTouch = 막기 단추(터치 손가락)를 쥔 채 둘째 손가락 탭 — CDP 는 손가락 하나만 떼지 못해 둘째 손가락은 캔버스에 포인터 사건(pointerType 'touch')을 바로 보냄(input.js 부터 같은 길)
const parryDown = async (mode) => (mode === 'holdKey' ? page.keyboard.down('f') : touch('touchStart', [P1]));
const parryUp = async (mode) => (mode === 'holdKey' ? page.keyboard.up('f') : touch('touchEnd', []));
const tapNow = async (mode) => {
  if (mode === 'holdTouch') {
    await page.evaluate(([x, y, ms]) => {
      const cv = document.querySelector('canvas');
      const t0 = performance.now();
      const o = { pointerId: 77, pointerType: 'touch', isPrimary: false, clientX: x, clientY: y, bubbles: true, cancelable: true };
      cv.dispatchEvent(new PointerEvent('pointerdown', o));
      // 떼기는 ms 뒤 (사건 시각은 만든 때 — 실제 손가락처럼 짧게)
      const until = t0 + ms;
      while (performance.now() < until) { /* 짧게 기다림 */ }
      window.dispatchEvent(new PointerEvent('pointerup', o));
    }, [P2.x, P2.y, TAP_S * 1000]);
    return;
  }
  const t = Date.now() / 1000;
  await touch('touchStart', [P2], t);
  await touch('touchEnd', [], t + TAP_S);
};
// 다음 시도 전 다시 떨어져 서기 (멈춘 상대 — 탭 찌르기 걸음이 조금씩 다가감): S 키로 뒤로
const backOff = async () => {
  const d = await page.evaluate(() => game.player.foeDistance());
  if (d >= GAP - 0.1) return;
  await page.keyboard.down('s');
  try { await page.waitForFunction((g) => game.player.foeDistance() >= g, GAP, { timeout: 60000, polling: 'raf' }); } catch { /* 벽 */ }
  await page.keyboard.up('s');
  const t1 = await page.evaluate(() => game.stats.simTime);
  await page.waitForFunction((t) => game.stats.simTime > t + 0.6, t1, { timeout: 60000 });
};
const results = [];
for (const mode of MODES) {
  for (const delay of DELAYS) {
    await backOff();
    // 막기 새 누름 → 막아찌르기 → 끝
    const n0 = await page.evaluate(() => game.player.parryGuard.opposition.starts);
    const e0 = await page.evaluate(() => game.player.parryGuard.opposition.lastEnd?.t ?? -1);
    await parryDown(mode);
    await page.waitForFunction((n) => game.player.parryGuard.opposition.starts > n, n0, { timeout: 30000, polling: 'raf' });
    await page.waitForFunction((e) => (game.player.parryGuard.opposition.lastEnd?.t ?? -1) > e && !game.player.parryGuard.opposition.run, e0, { timeout: 30000, polling: 'raf' });
    const end = await page.evaluate(() => ({ ...game.player.parryGuard.opposition.lastEnd, dist: +game.player.foeDistance().toFixed(3) }));
    if (mode === 'release') await parryUp(mode);
    // 끝에서 실제 delay 초 (게임 시간 × 1.1) 뒤 탭
    await page.waitForFunction((d) => { const O = game.player.parryGuard.opposition; return O.guard.clock - O.lastEnd.t >= d; }, delay * 1.1, { timeout: 30000, polling: 'raf' });
    const L0 = await page.evaluate(() => window.cavLog.length);
    const p0 = await page.evaluate(() => window.ptr.length);
    await tapNow(mode);
    try {
      await page.waitForFunction((n) => window.cavLog.length > n, L0, { timeout: 8000, polling: 'raf' });
    } catch { /* 탭이 tapChain 에 안 닿음 — 아래 ptr 로 봄 */ }
    const rec = await page.evaluate(([n, p]) => ({ chain: window.cavLog.slice(n), ptr: window.ptr.slice(p), heldAfter: game.playerGuard.held }), [L0, p0]);
    if (mode !== 'release') await parryUp(mode);
    const res = { mode, delay, end, ...rec, fired: rec.chain.some((c) => c.fired > 0) };
    results.push(res);
    console.log(JSON.stringify(res));
    await page.screenshot({ path: `${out}/${mode}_${delay}.png` });
    // 다음 시도 전: 탭 찌르기 · 끌고 가는 칼 끝 · 몸 자유 · 식힘(3 s) 지남
    await page.waitForFunction(() => { const f = game.player; return !f.skill.tap && !f.iai && !(f.iaiHoldT > 0) && !(f.iaiFade > 0); }, null, { timeout: 30000, polling: 'raf' });
    const t1 = await page.evaluate(() => game.stats.simTime);
    await page.waitForFunction((t) => game.stats.simTime > t + 3.6, t1, { timeout: 120000 });
  }
}
fs.writeFileSync(`${out}/cavazione.json`, JSON.stringify({ url, learned, kit, results, errors }, null, 2));
console.log(JSON.stringify({ fired: results.filter((r) => r.fired).length, of: results.length, errors: errors.slice(0, 5) }));
await browser.close();
