// 이베리아 비기 '휘감아 돌기 (싱지르)' 브라우저 연속 그림 (10/22 — docs/strike/iberian_spin_2026-10-22.md · src/iberian_spin.js). 읽기만.
//  테스트 경로(모든 칸 — 비기 칸 포함)로 츠바이핸더를 들고, 상대 AI 를 멈춰 내 앞 칼끝 거리 + GAP 자리로 옮긴다 → 무장(금색 '!') →
//  끌기 한 번으로 낸다. 화면 시계를 늦춰(requestAnimationFrame 시각을 __timeK 배로 — 게임 코드는 그대로) 돌기 진행 q 가 0 · ¼ · ½ · ¾ 를 넘는 때 ·
//  한 바퀴 끝 · 칼이 앞을 가로지르는 때 · 경직에 멈춰 찍는다.
//  찍는 눈: 게임 카메라(카메라가 돌지 않는지) + 옆 카메라(freeCam — 몸놀림). 낱장을 띠 그림 두 장(JPEG — 저장소 크기)으로 묶고(파이썬 PIL) 낱장은 지운다.
//  실행 (저장소 뿌리에서): npx vite --port 5393 --strictPort &
//        node tools/browser/iberian_spin_shots.mjs http://127.0.0.1:5393 [그림 폴더 (기본 docs/handoff/iberian_spin)] [무기 (기본 zweihander)]
//        FOE=인물 id (기본 isolde — 판금 없는 상대) · GAP=칼끝 거리 밖 몫 (기본 0.3 m) · WIND_YAW=도는 동안 칼 가로 각 시험 · NOSHOT=1 찍지 않고 재기 · DEBUG=1 끝 무렵 칼 자취
//  끝 코드 0 = 콘솔 에러 0. 소프트웨어 GL 이라 느리다(1~3 분)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] || 'http://127.0.0.1:5393';
const dir = process.argv[3] || 'docs/handoff/iberian_spin';
const weapon = process.argv[4] || 'zweihander';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 1 });
// 화면 시계 늦추기 (찍는 동안만 — 물리 스텝 수가 시계를 따라 준다)
//  (performance.now 도 같은 시계로 — 일시정지를 풀 때 main.js resume 이 performance.now 로 화면 시각을 다시 잡는다)
await ctx.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
});
if (process.env.FOE_SWORD === '1') await ctx.addInitScript(() => (window.__foeSword = 'off'));
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/?test=1&weapon=${weapon}&foe=${process.env.FOE ?? "isolde"}&stage=poseidon&slowMo=0`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 120000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.8, null, { timeout: 400000 });
await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
const info0 = await page.evaluate(() => {
  const g = window.game;
  g.settings.fpsCap = false; // 화면 갱신 상한 끔 — 시계를 세운 동안에도 그리기는 매 프레임 (옆 카메라가 그려지게)
  g.ai.update = () => g.enemy.move.set(0, 0); // 멈춘 상대 (걷던 명령이 남지 않게)
  g.enemy.handOffset.set(0, -0.5); // 멈춘 상대는 칼을 낮게 (바보 자세)
  if (!/^(0|off)$/.test(String(window.__foeSword ?? ''))) for (let i = 0; i < g.enemy.sword.numColliders(); i++) g.enemy.sword.collider(i).setCollisionGroups(0); // 그림용 과녁: 상대 칼 충돌 끔 (tools/sim/iberian_flat.mjs pad 'stand' 과 같음 — 멈춘 칼에 막힌 그림이 되지 않게. FOE_SWORD=1 이면 켠 채)
  const p = g.player;
  // 재기: 물리 스텝마다 칼끝 · 돌기 진행 (읽기만)
  const rec = (window.__rec = []);
  const step0 = p.step.bind(p);
  p.step = (dt) => {
    step0(dt);
    const S = p.ibSpin, sec = p.skill.sec;
    const tp = p.bladePoint(1), b0 = p.bladePoint(0), D = tp.clone().sub(b0).normalize(), fw = p.forward(), rg = p.right();
    rec.push({ t: g.stats.simTime, q: S ? S.q : null, free: !!S?.free, st: sec?.stage ?? null, tip: p.tipVel.length(), ty: tp.y, byaw: (Math.atan2(D.x * rg.x + D.z * rg.z, D.x * fw.x + D.z * fw.z) * 180) / Math.PI, d: p.foeDistance(), h: p.heading });
  };
  return { S: g.playerSecret.S?.name, reach: p.swordArt.measure.reach };
});
console.log(`비기 ${info0.S} · 칼끝 거리 ${info0.reach.toFixed(2)} m`);
const st = () => page.evaluate(() => { const g = window.game; const p = g.player; const S = p.ibSpin; return { t: g.stats.simTime, d: p.foeDistance(), open: !!g.playerSecret.open, arm: !!g.playerSecret.spinArm?.armed, q: S ? S.q : null, sec: p.skill.sec?.stage ?? null, rec: window.__rec.length }; });
// 상대를 내 앞 칼끝 거리 + GAP 자리로 옮긴다 (멈춘 상대 — 몸 · 닻 · 걸음 딛은 자리를 함께 평행 이동, secret_instant.js shiftFighter 와 같은 칸).
//  나는 판 시작 자리(무대 가운데 가까이) 그대로 — 물러서다 무대 돌벽에 감은 칼이 걸리면 칼이 튀어 그림이 엉뚱해진다(첫 시험들)
const GAP = +(process.env.GAP ?? 0.3);
if (process.env.WIND_YAW) await page.evaluate((y) => (window.game.config.SECRET.ibSpin.wind.yaw = y), +process.env.WIND_YAW); // 시험: 도는 동안 칼 가로 각
await page.evaluate((want) => {
  const g = window.game, p = g.player, e = g.enemy;
  const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
  const fw = p.forward();
  const dx = pc.x + fw.x * want - ec.x, dz = pc.z + fw.z * want - ec.z;
  for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
  const at = e.anchor.translation();
  e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
  if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]) { l[key].x += dx; l[key].z += dz; } }
}, info0.reach + GAP);
await page.waitForTimeout(300);
// 무장을 기다린다
for (let i = 0; i < 120; i++) {
  const s = await st();
  if (s.open) break;
  if (i % 10 === 0) console.log(`기다림 ${s.t.toFixed(1)} s · 상대 가슴 ${s.d.toFixed(2)} m · 무장 ${s.arm}`);
  await page.waitForTimeout(500);
}
await page.waitForFunction(() => window.game.playerSecret.open?.ctx?.ev === 'spin', null, { timeout: 60000 });
const shots = [];
const NOSHOT = process.env.NOSHOT === '1'; // 점검: 찍지 않고 재기만
// 찍기: 일시정지(P)를 쓰지 않는다 — 멈춤 · 풀기를 섞은 앞 시험들에서 칼이 머리 위로 넘어간 판이 있었다(무대 벽 탓인지 멈춤 탓인지 가르지 못해 피함).
//  대신 화면 시계를 거의 세워(__timeK 0.003 — 찍는 동안 물리 1~2 스텝) 게임 카메라 · 옆 카메라를 찍고 시계를 되돌린다
const shoot = async (k, label, side) => {
  if (NOSHOT) return;
  const k0 = await page.evaluate(() => { const k = window.__timeK; window.__timeK = 0.003; return k; });
  const s = await st();
  await page.screenshot({ path: `${dir}/_g${k}.png` });
  if (side) {
    await page.evaluate(() => {
      const g = window.game, f = g.player, o = g.enemy;
      const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
      let fx = a.x - b.x, fz = a.z - b.z;
      const L = Math.hypot(fx, fz) || 1;
      fx /= L; fz /= L;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      g.freeCam = true;
      g.camera.position.set(mx + fz * 3.6, 2.6, mz - fx * 3.6); // 싸움 줄의 왼쪽 옆 · 조금 위에서
      g.camera.lookAt(mx, 0.9, mz);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dir}/_s${k}.png` });
    await page.evaluate(() => (window.game.freeCam = false));
  }
  shots.push({ k, label, ...s });
  console.log(`SHOT ${k} ${label} · 진행 ${s.q == null ? '-' : s.q.toFixed(2)} · 단계 ${s.sec} · 상대 가슴 ${s.d.toFixed(2)} m`);
  await page.evaluate((k) => (window.__timeK = k), k0);
};
// 무장 그림 (머리 위 '!' · 오른쪽 위 비기 이름)
await shoot(0, '무장 — 금색 !', true);
// 낸다: 칼 쪽 화면 끌기 한 번
await page.evaluate(async () => {
  const cv = document.getElementById('game');
  let x = 640, y = 150;
  const o = () => ({ pointerId: 81, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 });
  cv.dispatchEvent(new PointerEvent('pointerdown', o()));
  for (let i = 0; i < 6; i++) {
    x -= 16;
    window.dispatchEvent(new PointerEvent('pointermove', o()));
    await new Promise((r) => setTimeout(r, 16));
  }
  window.dispatchEvent(new PointerEvent('pointerup', o()));
});
await page.evaluate(() => (window.__timeK = 0.08));
await page.waitForFunction(() => !!window.game.player.ibSpin, null, { timeout: 60000, polling: 'raf' });
const marks = [0.02, 0.25, 0.5, 0.75];
for (let i = 0; i < marks.length; i++) {
  await page.waitForFunction((m) => { const S = window.game.player.ibSpin; return !S || S.q >= m; }, marks[i], { timeout: 120000, polling: 'raf' });
  await shoot(i + 1, `돌기 ${Math.round(marks[i] * 100)} %`, true);
}
await page.waitForFunction(() => !window.game.player.ibSpin, null, { timeout: 120000, polling: 'raf' });
await shoot(5, '한 바퀴 끝 (칼을 놓아 가로로 치는 중)', true);
await page.waitForFunction(() => { const r = window.__rec[window.__rec.length - 1]; return !r || r.st !== 'follow' || Math.abs(r.byaw) < 25; }, null, { timeout: 120000, polling: 'raf' });
await shoot(6, '칼이 앞을 가로지름', true);
await page.waitForFunction(() => window.game.player.skill.sec?.stage === 'stiff' || !window.game.player.skill.sec, null, { timeout: 120000, polling: 'raf' });
await shoot(7, '경직 (끝 자세)', true);
const rec = await page.evaluate(() => window.__rec);
if (process.env.DEBUG) for (const r of rec.filter((r) => r.st && (r.st !== 'spin' || r.q > 0.85)).filter((_, i) => i % 3 === 0).slice(0, 16)) console.log(`DBG ${r.st} q ${r.q == null ? '-' : r.q.toFixed(2)} 칼 가로 ${r.byaw.toFixed(0)}° 칼끝 높이 ${r.ty.toFixed(2)} 빠르기 ${r.tip.toFixed(1)} d ${r.d.toFixed(2)}`);
const run = rec.filter((r) => r.st);
const spin = run.filter((r) => r.q != null);
const tipMax = Math.max(...run.map((r) => r.tip));
const cross = run.find((r) => r.st === 'follow' && Math.abs(r.byaw) < 15);
const wounds = await page.evaluate(() => (window.game.enemy.wounds ?? []).map((w) => `${w.part}:${(+w.severity).toFixed(2)}`));
console.log(`SUMMARY 돌기 ${spin.length ? (spin[spin.length - 1].t - spin[0].t).toFixed(2) : '-'} s · 칼끝 최고 ${tipMax.toFixed(1)} m/s · 가로지를 때 칼끝 ${cross ? cross.tip.toFixed(1) : '-'} m/s 높이 ${cross ? cross.ty.toFixed(2) : '-'} m · 상대 상처 ${wounds.join(' ') || '없음'}`);
fs.writeFileSync(`${dir}/_shots.json`, JSON.stringify({ weapon, shots, tipMax, cross }, null, 1));
// 띠 그림 두 장 (게임 카메라 · 옆 카메라) — 낱장은 지운다
const py = `
import sys, json
from PIL import Image, ImageDraw
d = sys.argv[1]; weapon = sys.argv[2]
meta = json.load(open(d + '/_shots.json'))
for kind, name in (('g', 'game'), ('s', 'side')):
    ims = [Image.open(f"{d}/_{kind}{s['k']}.png").convert('RGB') for s in meta['shots']]
    w, h = ims[0].size
    sw, sh = w // 2, h // 2
    cols = 4
    rows = (len(ims) + cols - 1) // cols
    out = Image.new('RGB', (cols * sw, rows * (sh + 18)), (16, 16, 16))
    dr = ImageDraw.Draw(out)
    for i, (im, s) in enumerate(zip(ims, meta['shots'])):
        x, y = (i % cols) * sw, (i // cols) * (sh + 18)
        out.paste(im.resize((sw, sh)), (x, y + 18))
        q = '-' if s['q'] is None else f"{s['q']:.2f}"
        dr.text((x + 4, y + 3), f"{s['k']}  q {q}  {s['sec'] or ''}  d {s['d']:.2f}", fill=(255, 214, 90))
    out.save(f"{d}/spin_{weapon}_{name}.jpg", quality=84, optimize=True)
`;
execFileSync('python3', ['-c', py, dir, weapon]);
for (const f of fs.readdirSync(dir)) if (f.startsWith('_')) fs.unlinkSync(`${dir}/${f}`);
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
