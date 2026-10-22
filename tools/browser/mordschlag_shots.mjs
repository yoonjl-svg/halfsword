// 독일 비기 죽음의 일격 (모르트슐라크) 화면 확인 — docs/strike/german_mordschlag_2026-10-22.md §6
//  실제 게임 화면(844×390 가로 폰)에서: 붙음 → 스틱을 놓았다가 새로 밂 → 누르기 1.5 s → 금빛 '!'(비기 창) → 캔버스를 끌어 공격 → 칼날을 거꾸로 쥠 →
//  칼자루를 세움 → 내리침 → 다시 세움 → 굳음. 시간은 playwright 가짜 시계로 한 프레임(1/60 s)씩 (tools/browser/shove_shots.mjs 와 같은 틀).
//  플레이어는 진짜 입력 길로만: 스틱 = 키보드 W · 공격 = 캔버스 마우스 끌기. 비기 칸은 개발 인자 `?skillNodes=all`. 상대(기본 상대)는 꼭두각시 — 걸어와 버팀.
//  찍는 것: 이름 붙은 순간마다 게임 카메라 · 옆 카메라 PNG 두 장 + 그 순간 JSON(가슴 거리 · 누르기 단계 · 누르기 셈 · 창 · 비기 단계 · 거꾸로 쥠 · 상대 상태 · 상처 수)
//  실행: npx vite --port 5179 --strictPort &   (끝나면 그 PID 만 끈다)
//        node tools/browser/mordschlag_shots.mjs http://127.0.0.1:5179 docs/handoff/mordschlag [무대=castle]
//  playwright 는 저장소 의존성에 없다(/home/user/halfsword/node_modules 에 있음). 크롬 경로 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = (process.argv[2] || 'http://127.0.0.1:5179').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/mordschlag';
const stage = process.argv[4] || 'castle';
const FRAME = 17;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
await page.clock.install({ time: new Date('2026-10-22T12:00:00') });
await page.clock.pauseAt(new Date('2026-10-22T12:00:01'));
await page.goto(`${base}/?foe=default&stage=${stage}&weapon=longsword&skillNodes=all`, { waitUntil: 'networkidle' });
for (let i = 0; i < 300 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
await page.clock.runFor(200);
await page.evaluate(() => {
  const g = window.game;
  g.config.ARENA.startGap = 1.3;
  const b = document.getElementById('btnStart');
  if (b) b.click();
});
for (let i = 0; i < 200 && !(await page.evaluate(() => window.game?.state === 'fight' && !!window.game.playerSecret)); i++) {
  await page.clock.runFor(100);
  if (i === 20) await page.getByText('여정 시작').click({ timeout: 2000 }).catch(() => {});
}
await page.evaluate(() => {
  const g = window.game;
  const ai = g.ai;
  window.__foeMove = 0;
  ai.update = () => ai.me.move.set(0, window.__foeMove);
  window.__rec = () => {
    const P = g.player, E = g.enemy, W = g.playerSecret;
    const r3 = (v) => +(+v).toFixed(3);
    return {
      t: r3(P.fightT), d: r3(P.foeDistance()), reach: r3(g.config.CLOSE.reach(P.weapon)),
      barge: P.barge?.phase ?? null, bargeEnd: P.bargeEnd, pressT: r3(W?.pressT ?? 0), open: !!W?.open, opened: W?.opened ?? 0, S: W?.S?.name ?? null,
      sec: P.skill.sec?.stage ?? null, grip: P.mordGrip ? r3(P.mordGrip.g) : null, aim: !!P.mordAim,
      foe: E.state, foeHits: g.stats.hits.length, errors: 0,
    };
  };
});
const frames = [];
let W = false;
const key = async (down) => {
  if (down === W) return;
  W = down;
  if (down) await page.keyboard.down('KeyW');
  else await page.keyboard.up('KeyW');
};
const frame = async () => {
  await page.clock.runFor(FRAME);
  const r = await page.evaluate(() => window.__rec());
  r.W = W;
  r.errors = errors.length;
  frames.push(r);
  return r;
};
let nShot = 0;
const shots = [];
const shot = async (name, r) => {
  nShot++;
  const stem = `${String(nShot).padStart(2, '0')}_${name}`;
  fs.writeFileSync(path.join(out, `${stem}.png`), await page.screenshot());
  await page.evaluate(() => {
    const g = window.game, T = g.THREE;
    const a = g.player.pelvisPos, b = g.enemy.pelvisPos;
    const m = new T.Vector3().addVectors(a, b).multiplyScalar(0.5);
    const d = new T.Vector3().subVectors(b, a).setY(0).normalize();
    const side = new T.Vector3(-d.z, 0, d.x);
    if (m.clone().addScaledVector(side, 2.6).setY(0).length() > 6.3) side.negate();
    g.__cam = { p: g.camera.position.clone(), q: g.camera.quaternion.clone() };
    g.freeCam = true;
    g.camera.position.copy(m).addScaledVector(side, 2.6).setY(1.35);
    g.camera.lookAt(m.x, 1.1, m.z);
  });
  await page.clock.runFor(FRAME);
  fs.writeFileSync(path.join(out, `${stem}_side.png`), await page.screenshot());
  await page.evaluate(() => {
    const g = window.game;
    g.camera.position.copy(g.__cam.p);
    g.camera.quaternion.copy(g.__cam.q);
    g.freeCam = false;
  });
  const rr = await frame();
  shots.push({ name, at: r, after: rr });
};
const until = async (fn, maxS) => {
  let r = frames[frames.length - 1] ?? (await frame());
  for (let t = 0; t < maxS && !fn(r); t += FRAME / 1000) r = await frame();
  return r;
};

let r = await until((x) => x.t >= 2.05, 5); // 판 시작 정지
// 붙기: 상대도 걸어와 붙은 뒤 버틴다
await page.evaluate(() => (window.__foeMove = 1));
await key(true);
r = await until((x) => x.d < x.reach - 0.05, 4);
await page.evaluate(() => (window.__foeMove = 0));
await shot('glued', r);
// 스틱을 놓았다 새로 밀고 버팀 (누르기가 끊기면 다시)
for (let k = 0; k < 6 && !r.open; k++) {
  await key(false);
  const t0 = r.t;
  r = await until((x) => x.t >= t0 + 0.12, 0.5);
  await key(true);
  r = await until((x) => x.open || (x.barge == null && x.t > t0 + 0.4), 3);
  if (k === 0 && r.barge === 'press') { const tp = r.t; r = await until((x) => x.t >= tp + 0.75 || x.open || !x.barge, 1.5); if (!r.open) await shot('pressing', r); r = await until((x) => x.open || !x.barge, 2); }
}
const opened = r.open;
if (opened) await shot('window', r);
// 공격 입력: 캔버스를 빠르게 끌기 (비기 입력과 같은 문턱 — 휘두르기만큼 빠른 끌기)
const X = 560, Y = 150;
await page.mouse.move(X, Y);
await page.mouse.down();
for (let i = 1; i <= 3; i++) { await page.mouse.move(X - 30 * i, Y + 25 * i); r = await frame(); }
await page.mouse.up();
const seen = new Set();
for (let t = 0; t < 3 && (r.sec || t < 0.2); t += FRAME / 1000) {
  r = await frame();
  if (r.sec && !seen.has(r.sec)) {
    seen.add(r.sec);
    if (r.sec === 'chamber') { await shot('flip', r); const t0 = r.t; r = await until((x) => x.t >= t0 + 0.25 || x.sec !== 'chamber', 1); if (r.sec === 'chamber') await shot('chamber', r); }
    else if (r.sec === 'strike') { const t0 = r.t; r = await until((x) => x.t >= t0 + 0.05 || x.sec !== 'strike', 0.5); await shot('strike', r); }
    else if (r.sec === 'follow') { const t0 = r.t; r = await until((x) => x.t >= t0 + 0.1, 0.5); await shot('follow', r); }
    else await shot(r.sec, r);
  }
}
r = await until((x) => !x.sec, 2);
await shot('after', r);
await key(false);
fs.writeFileSync(path.join(out, 'shots.json'), JSON.stringify({ opened, stages: [...seen], shots, errors, frames: frames.length }, null, 1));
console.log(JSON.stringify({ opened, stages: [...seen], shots: shots.map((s) => `${s.name}@${s.at.t}(${s.at.sec ?? s.at.barge ?? ''})`), foeHits: r.foeHits, foe: r.foe, errors }, null, 0));
await browser.close();
