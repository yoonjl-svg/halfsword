// 그리기 보간 점검 (RENDER.interp, R0 render): 수동 프레임 시계로 프레임 길이 패턴별(60 Hz 흔들림·90·144·60 Hz·맞아서 멈칫)로
//  팔 베기(조른하우) 동안 칼 겉모습(swordGroup)의 프레임당 회전각(과 벽시계 1 ms 당 회전각의 들쭉날쭉함), 물리 자세와의 차이(뒤처짐),
//  프레임당 물리 스텝 수, 프레임 벽시계를 잰다. 겉모습이 매끄러우면 '1 ms 당 회전각' 이 이웃 프레임끼리 비슷하다 (roughnessT 작다)
//  켬/끔은 game.config.RENDER.interp 를 실행 중에 바꿔 같은 판에서 비교한다 (물리는 두 쪽 다 같다 — 겉모습만 다르다)
//  실행: vite 개발 서버를 띄운 뒤 (npm run dev) playwright 가 설치된 곳에서
//    node tools/browser/interp_check.mjs http://127.0.0.1:5183 [--out=결과.json] [--settle=100]
//  크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';

const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith('--')) || 'http://127.0.0.1:5173';
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const OUT = opt('out', '');
const SETTLE = +opt('settle', 100); // 긋기 뒤 지켜보는 프레임 수
const W = 360;
const H = 640;
// 패드 자리 (film_wholebody.cjs 와 같다): 오른쪽 어깨 위 → 왼쪽 아래 (조른하우, 12 m/s)
const CH = [0.42, 0.42];
const END = [-0.4, -0.42];
const V = 12;
// 프레임 길이 패턴 (ms): 이름 → 프레임 i 의 길이
const PATTERNS = {
  A_jitter60: (i) => (i % 2 ? 21.3 : 12.0), // 평균 16.65 ms, 스텝 수 1/3/1/3 로 흔들린다 (프레임 딸꾹질)
  B_90hz: () => 1000 / 90,
  C_144hz: () => 1000 / 144,
  D_60hz: () => 1000 / 60,
  E_hit60: () => 1000 / 60, // 상대를 1.55 m 에 세워 실제로 맞힌다 → 멈칫(hitStop, 시간 0.12배) 동안의 계단
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.addInitScript(() => {
  try {
    localStorage.setItem('gladiator-settings', JSON.stringify({ trail: false, guardNames: false, sound: false }));
  } catch {}
  // 수동 프레임 시계: __manual 을 켜면 rAF 콜백을 모아 두고 __pump(n, dtMs) 가 가짜 시계로 돌린다 (film_wholebody.cjs 와 같다)
  const orig = window.requestAnimationFrame.bind(window);
  window.__rafQ = [];
  window.__now = 0;
  window.__manual = false;
  window.requestAnimationFrame = (cb) => {
    if (window.__manual) {
      window.__rafQ.push(cb);
      return 1;
    }
    return orig((t) => {
      window.__now = t;
      cb(t);
    });
  };
  window.__pump = (n, dtMs) => {
    for (let i = 0; i < n; i++) {
      const q = window.__rafQ;
      window.__rafQ = [];
      window.__now += dtMs;
      window.__dt = dtMs;
      const t0 = performance.now();
      for (const cb of q) cb(window.__now);
      window.__wall = performance.now() - t0;
      window.__afterFrame?.();
    }
  };
});
await page.goto(`${base}/?weapon=longsword&foeWeapon=longsword&foe=default&emo=0`, { waitUntil: 'load' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 60000 });
await page.waitForTimeout(800);
await page.click('#btnStart');
await page.waitForFunction(() => window.game.state === 'fight' || (window.game.state === 'draw' && window.game.draw.stage === 'choose' && window.game.draw.t > 0.6), null, { timeout: 30000 });
if ((await page.evaluate(() => window.game.state)) === 'draw') {
  await page.locator('#draw .wcard[data-i="0"]').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 30000 });
}
await page.waitForTimeout(300);
await page.evaluate(() => (window.__manual = true));
await page.waitForFunction(() => window.__rafQ.length > 0, null, { timeout: 60000, polling: 100 });

// 판 차리기: 상대는 더미(AI 끔, 칼 안 부딪힘, 안 죽음), 나도 안 죽음. 기록기 준비
const setup = await page.evaluate(() => {
  const g = window.game;
  const P = g.player;
  const E = g.enemy;
  g.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.die = () => {};
  const h = g.config.SKILL.homeGuard;
  P.handOffset.set(h[0], h[1]);
  const T = g.THREE;
  const R = (window.__rec = { on: false, rows: [], lastSim: g.stats.simTime, lastQ: null });
  const pq = new T.Quaternion();
  window.__afterFrame = () => {
    const sim = g.stats.simTime;
    const steps = Math.round((sim - R.lastSim) / g.config.PHYSICS.timestep);
    R.lastSim = sim;
    const q = P.swordGroup.quaternion;
    const dDeg = R.lastQ ? (R.lastQ.angleTo(q) * 180) / Math.PI : 0;
    R.lastQ = (R.lastQ || new T.Quaternion()).copy(q);
    if (!R.on) return;
    const r = P.sword.rotation();
    const lag = (q.angleTo(pq.set(r.x, r.y, r.z, r.w)) * 180) / Math.PI; // 겉모습 ↔ 물리 자세 차이
    R.rows.push({ dt: +window.__dt.toFixed(2), steps, dDeg: +dDeg.toFixed(3), lag: +lag.toFixed(3), tipV: +P.tipVel.length().toFixed(2), wall: +window.__wall.toFixed(2) });
  };
  return { interp: g.config.RENDER.interp, dist: +P.foeDistance().toFixed(2), weapon: P.weapon.id, foe: E.weapon.id };
});
console.log('setup', JSON.stringify(setup));

const ppm = Math.max(320, H) / (await page.evaluate(() => game.config.INPUT.touchSensitivity));
const finger = { x: Math.round(W * 0.72), y: Math.round(H * 0.55) };
const send = (type, x, y) =>
  page.evaluate(([type, x, y]) => {
    const e = { type, pointerId: 7, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: window.__now };
    const I = game.input;
    if (type === 'pointerdown') I.onDown(e);
    else if (type === 'pointermove') I.onMove(e);
    else I.onUp(e);
  }, [type, x, y]);
let fi = 0;
let dtOf = () => 1000 / 60;
const frame = () => page.evaluate((dt) => window.__pump(1, dt), dtOf(fi++));
const handNow = () => page.evaluate(() => [game.player.handOffset.x, game.player.handOffset.y]);
const drag = async (dx, dy, v) => {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  const x0 = finger.x;
  const y0 = finger.y;
  for (let t = 0; ; ) {
    t += dtOf(fi);
    const u = Math.min(1, t / T);
    finger.x = x0 + dx * u * ppm;
    finger.y = y0 - dy * u * ppm;
    await send('pointermove', finger.x, finger.y);
    await frame();
    if (u >= 1) break;
  }
};
// 상대를 두 가슴 사이 dist 로 옮긴다 (film_wholebody.cjs)
const placeFoe = (dist) =>
  page.evaluate((dist) => {
    const g = window.game;
    const P = g.player;
    const E = g.enemy;
    for (let k = 0; k < 3; k++) {
      const a = P.bodies.chest.translation();
      const b = E.bodies.chest.translation();
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const sx = ((b.x - a.x) / L) * (dist - L);
      const sz = ((b.z - a.z) / L) * (dist - L);
      for (const { rb } of E.meshes) {
        const t = rb.translation();
        rb.setTranslation({ x: t.x + sx, y: t.y, z: t.z + sz }, true);
      }
      const t = E.anchor.translation();
      E.anchor.setTranslation({ x: t.x + sx, y: t.y, z: t.z + sz }, true);
      if (E.gait?.active) E.gait.exit();
      window.__pump(k < 2 ? 60 : 90, 1000 / 60);
    }
    return +P.foeDistance().toFixed(2);
  }, dist);

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const summarize = (rows) => {
  const swing = rows.filter((r) => r.tipV > 4);
  const d = swing.map((r) => r.dDeg);
  const d2 = [];
  for (let i = 1; i < d.length; i++) d2.push(Math.abs(d[i] - d[i - 1]));
  const w = swing.map((r) => r.dDeg / r.dt); // 벽시계 1 ms 당 회전각 (프레임 길이가 달라도 매끄러우면 이웃끼리 비슷하다)
  const w2 = [];
  for (let i = 1; i < w.length; i++) w2.push(Math.abs(w[i] - w[i - 1]));
  const hist = {};
  for (const r of rows) hist[r.steps] = (hist[r.steps] || 0) + 1;
  const stop = rows.filter((r) => r.steps === 0 && r.tipV > 1); // 시간이 안 간 프레임 (144 Hz 의 빈 프레임, 멈칫)
  return {
    frames: rows.length,
    stepsHist: hist,
    swingFrames: swing.length,
    tipVmax: Math.max(0, ...rows.map((r) => r.tipV)),
    drawnDeg_mean: +mean(d).toFixed(2),
    drawnDeg_max: +Math.max(0, ...d).toFixed(2),
    roughness: +(mean(d2) / (mean(d) || 1)).toFixed(3), // 이웃 프레임 회전각 차이 / 평균 (프레임 길이가 고른 패턴에서 계단이면 크다)
    roughnessT: +(mean(w2) / (mean(w) || 1)).toFixed(3), // 이웃 프레임 '1 ms 당 회전각' 차이 / 평균 (프레임 길이가 흔들려도 매끄러우면 작다)
    frozenSwing: swing.filter((r) => r.dDeg < 0.01).length, // 칼이 빠른데 겉모습이 안 움직인 프레임
    stopFrames: stop.length,
    stopMoved: stop.filter((r) => r.dDeg >= 0.01).length, // 시간이 안 간 프레임인데 겉모습이 움직였다 (보간)
    lag_mean: +mean(swing.map((r) => r.lag)).toFixed(2),
    lag_max: +Math.max(0, ...rows.map((r) => r.lag)).toFixed(2),
    perStepDeg_max: +Math.max(0, ...swing.filter((r) => r.steps > 0).map((r) => r.dDeg / r.steps)).toFixed(2),
    wall_ms: +mean(rows.map((r) => r.wall)).toFixed(2),
  };
};

const report = { url: base, cut: { ch: CH, end: END, v: V }, setup, runs: {} };
for (const [pname, pat] of Object.entries(PATTERNS)) {
  report.runs[pname] = {};
  for (const interp of [true, false]) {
    await page.evaluate((on) => (game.config.RENDER.interp = on), interp);
    dtOf = () => 1000 / 60;
    fi = 0;
    // 손을 홈 자세로 되돌리고 상대 위치를 맞춘다 (E: 1.55 m — 실제로 맞는다. 나머지: 처음 간격 그대로, 안 닿는다)
    const dist = await placeFoe(pname.startsWith('E') ? 1.55 : setup.dist);
    await page.evaluate(() => {
      const h = game.config.SKILL.homeGuard;
      game.player.handOffset.set(h[0], h[1]);
    });
    for (let i = 0; i < 30; i++) await frame();
    // 준비 자세로 (1.2 m/s), 잠깐 머묾
    dtOf = pat;
    fi = 0;
    finger.x = Math.round(W * 0.72);
    finger.y = Math.round(H * 0.55);
    await send('pointerdown', finger.x, finger.y);
    const h = await handNow();
    await drag(CH[0] - h[0], CH[1] - h[1], 1.2);
    for (let i = 0; i < 16; i++) await frame();
    // 기록 시작 → 긋기 → 떼기 → 지켜보기
    await page.evaluate(() => {
      window.__rec.rows = [];
      window.__rec.on = true;
    });
    const h1 = await handNow();
    await drag(END[0] - h1[0], END[1] - h1[1], V);
    await send('pointerup', finger.x, finger.y);
    for (let i = 0; i < SETTLE; i++) await frame();
    const rows = await page.evaluate(() => ((window.__rec.on = false), window.__rec.rows));
    const hits = await page.evaluate(() => game.stats.hits.length);
    const s = { interp, dist, hits, ...summarize(rows) };
    report.runs[pname][interp ? 'on' : 'off'] = { ...s, rows };
    console.log(pname.padEnd(11), interp ? 'on ' : 'off', JSON.stringify(s));
    dtOf = () => 1000 / 60;
    for (let i = 0; i < 30; i++) await frame();
  }
}
report.errors = errors;
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report));
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ZERO console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
