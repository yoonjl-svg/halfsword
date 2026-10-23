// 싱지르 공격 원 판 · 몸 곧게 브라우저 확인 · 그림 (10/24 — src/attack_circle.js · secret.js spinCircle · main.js circleGo · src/iberian_spin.js upright · docs/strike/iberian_spin_2026-10-22.md §13 · §14). 읽기만.
//  테스트 경로(모든 칸)로 무기를 들고, 상대 AI 를 멈춰 내 앞 칼끝 거리 + GAP 자리로 옮긴다 → 무장(금색 '!') →
//   MODE=circle (기본): 칼 쪽 화면(오른쪽)을 손가락으로 원 그리듯 한 바퀴(CIRCLE° · 게임 DUR 초 · 반지름 RPX px) 끈다 → 싱지르가 나가는지 · 그린 쪽으로 도는지
//    (그 앞에 무장 동안 곧게 끌기 한 번 → 보통 베기가 나가고 싱지르는 안 나가는지 · 무장은 획이 끝난 뒤 풀리는지)
//   MODE=direct: 무장 창을 곧장 쓴다(공격 입력 하나와 같은 길 — 10/22 판 그림용 · Q=ibShare=0&ibUpright=0 과 함께 '전' 그림)
//  그림 = 옆 카메라 · 돌기 ½ · 한 바퀴 끝(받아 멈춤) · 끝난 뒤 0.6 s (굳음) → 띠 그림 WebP (칸마다 몸 기울기 · 골반 옮김을 적음)
//  실행 (저장소 뿌리에서): npx vite --port 5417 --strictPort &
//        node tools/browser/singir_circle_shots.mjs http://127.0.0.1:5417 [그림 폴더 (기본 docs/handoff/singir_2026-10-24)]
//        WEAPON=flamberge · FOE=isolde · GAP=0.3 · MODE=circle|direct · DIR=ccw|cw · Q=주소에 더할 것 · NAME=그림 이름 · NOSHOT=1
//  끝 코드 0 = 확인 모두 맞음 · 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] || 'http://127.0.0.1:5417';
const dir = process.argv[3] || 'docs/handoff/singir_2026-10-24';
const WEAPON = process.env.WEAPON || 'flamberge';
const GAP = +(process.env.GAP ?? 0.3);
const MODE = process.env.MODE || 'circle';
const SENSE = process.env.DIR === 'cw' ? -1 : 1;
const CIRCLE = +(process.env.CIRCLE ?? 400);
const DUR = +(process.env.DUR ?? 0.8);
const RPX = +(process.env.RPX ?? 60);
const NOSHOT = process.env.NOSHOT === '1';
const NAME = process.env.NAME || `${MODE}_${WEAPON}`;
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last;
  window.__timeK = 1;
  const clock = () => { const t = pn(); acc += (t - last) * window.__timeK; last = t; return acc; };
  performance.now = clock;
  window.requestAnimationFrame = (cb) => raf(() => cb(clock()));
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`${base}/?test=1&weapon=${WEAPON}&foe=${process.env.FOE ?? 'isolde'}&stage=poseidon&slowMo=0${process.env.Q ? '&' + process.env.Q : ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 120000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.8, null, { timeout: 400000 });
await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
const info0 = await page.evaluate(() => {
  const g = window.game, p = g.player, e = g.enemy;
  g.settings.fpsCap = false;
  g.ai.update = () => e.move.set(0, 0); // 멈춘 상대
  e.handOffset.set(0, -0.5);
  e.die = () => {};
  p.stamina.setInfinite?.(true);
  for (let i = 0; i < e.sword.numColliders(); i++) e.sword.collider(i).setCollisionGroups(0); // 그림용 과녁
  const W = g.playerSecret;
  const rec = (window.__rec = []);
  const step0 = p.step.bind(p);
  p.step = (dt) => {
    step0(dt);
    const S = p.ibSpin;
    const pp = p.bodies.pelvis.translation(), hd = p.bodies.head.translation();
    rec.push({ t: g.stats.simTime, open: W.open?.ctx?.ev ?? null, armed: !!W.spinArm?.armed, sec: p.skill.sec?.stage ?? null, spin: !!S, settle: !!S?.settle, q: S ? S.q : null, dir: S ? S.dir : null, swing: !!p.skill.swinging, x: pp.x, z: pp.z, tilt: (Math.atan2(Math.hypot(hd.x - pp.x, hd.z - pp.z), hd.y - pp.y) * 180) / Math.PI });
  };
  return { S: W.S?.name, input: g.config.SECRET.ibSpin.input, share: g.config.SECRET.ibSpin.share, upright: g.config.SECRET.ibSpin.upright, reach: p.swordArt.measure.reach, side: p.side };
});
console.log(`비기 ${info0.S} · 조작 ${info0.input} · share ${info0.share} · upright ${info0.upright} · 칼끝 거리 ${info0.reach.toFixed(2)} m · 칼 든 쪽 ${info0.side}`);
const place = () => page.evaluate((want) => {
  const g = window.game, p = g.player, e = g.enemy;
  const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
  const fw = p.forward();
  const dx = pc.x + fw.x * want - ec.x, dz = pc.z + fw.z * want - ec.z;
  for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
  const at = e.anchor.translation();
  e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
  if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]) { l[key].x += dx; l[key].z += dz; } }
}, info0.reach + GAP);
const waitArm = async () => {
  await page.evaluate(() => (window.__timeK = 1));
  await page.waitForFunction(() => !window.game.player.skill.sec, null, { timeout: 60000, polling: 200 });
  for (let k = 0; ; k++) {
    await place(); // 칼끝 거리 + GAP 자리로 (내 몸이 돌거나 밀렸으면 다시)
    const ok = await page.waitForFunction(() => window.game.playerSecret.open?.ctx?.ev === 'spin' && !window.game.player.skill.sec, null, { timeout: 30000, polling: 200 }).then(() => true).catch(() => false);
    if (ok) return;
    const s = await page.evaluate(() => { const g = window.game, p = g.player, W = g.playerSecret; return { d: p.foeDistance(), reach: p.swordArt.measure.reach, armT: W.spinArm.t, armed: W.spinArm.armed, sec: p.skill.sec?.stage ?? null, sw: p.skill.swinging, state: p.state, ex: p.stamina.exhausted, hand: [p.handOffset.x, p.handOffset.y] }; });
    console.log(`  무장 기다림 ${k}: ${JSON.stringify(s)}`);
    if (k >= 6) throw new Error('무장 안 됨');
  }
};
let shots = [];
let fire0 = null;
const shoot = async (k, label) => {
  const s = await page.evaluate(() => { const r = window.__rec[window.__rec.length - 1]; return r; });
  const mv = fire0 ? Math.hypot(s.x - fire0.x, s.z - fire0.z) : 0;
  shots.push({ k, label, q: s.q, sec: s.sec, tilt: s.tilt, mv });
  console.log(`SHOT ${k} ${label} · 단계 ${s.sec} · 진행 ${s.q?.toFixed(2) ?? '-'} · 기울기 ${s.tilt.toFixed(0)}° · 골반 옮김 ${mv.toFixed(2)} m`);
  if (NOSHOT) return;
  const k0 = await page.evaluate(() => { const k = window.__timeK; window.__timeK = 0.003; return k; });
  await page.evaluate(() => {
    const g = window.game, f = g.player, o = g.enemy;
    const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
    let fx = a.x - b.x, fz = a.z - b.z;
    const L = Math.hypot(fx, fz) || 1;
    fx /= L; fz /= L;
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    g.freeCam = true;
    g.camera.position.set(mx + fz * 3.6, 2.2, mz - fx * 3.6);
    g.camera.lookAt(mx, 1.0, mz);
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/_s${k}.png` });
  await page.evaluate(() => (window.game.freeCam = false));
  await page.evaluate((k) => (window.__timeK = k), k0);
};
const strip = (name, title) => {
  if (NOSHOT || !shots.length) return;
  fs.writeFileSync(`${dir}/_shots.json`, JSON.stringify({ shots, title }, null, 1));
  const py = `
import sys, json
from PIL import Image, ImageDraw
d, name = sys.argv[1], sys.argv[2]
meta = json.load(open(d + '/_shots.json'))
ims = [Image.open(f"{d}/_s{s['k']}.png").convert('RGB') for s in meta['shots']]
w, h = ims[0].size
cw, ch = int(w * 0.62), int(h * 0.62)
out = Image.new('RGB', (len(ims) * cw, ch + 40), (16, 16, 16))
dr = ImageDraw.Draw(out)
dr.text((6, 3), meta['title'], fill=(255, 214, 90))
for i, (im, s) in enumerate(zip(ims, meta['shots'])):
    x = i * cw
    out.paste(im.resize((cw, ch)), (x, 40))
    dr.text((x + 6, 20), f"{s['label']}  tilt {s['tilt']:.0f} deg  pelvis {s['mv']:.2f} m", fill=(255, 255, 255))
out.save(f"{d}/{name}.webp", quality=80, method=6)
`;
  execFileSync('python3', ['-c', py, dir, name]);
  for (const f of fs.readdirSync(dir)) if (f.startsWith('_')) fs.unlinkSync(`${dir}/${f}`);
  shots = [];
};
const checks = {};
const touch = (type, x, y, id = 71) => page.evaluate(([type, x, y, id]) => {
  const cv = document.getElementById('game');
  const ev = new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true, button: 0 });
  (type === 'pointerdown' ? cv : window).dispatchEvent(ev);
}, [type, x, y, id]);
const gt = () => page.evaluate(() => performance.now());
const K = +(process.env.DRAW_K ?? 0.1); // 그리는 동안 화면 시계 배 (소프트웨어 GL — 늦출수록 게임 시간에 표본이 촘촘)

if (MODE === 'circle') {
  // ① 무장 동안 곧은 끌기 → 보통 베기 · 싱지르 안 나감 · 획이 끝난 뒤 무장 풀림
  await waitArm();
  const n0 = await page.evaluate(() => window.__rec.length);
  await page.evaluate((K) => (window.__timeK = K), K);
  await touch('pointerdown', 560, 120);
  const ts = await gt();
  for (;;) {
    const u = Math.min(1, ((await gt()) - ts) / 200);
    await touch('pointermove', 560 + 180 * u, 120 + 140 * u);
    if (u >= 1) break;
    await page.waitForTimeout(6);
  }
  await touch('pointerup', 740, 260);
  await page.evaluate(() => (window.__timeK = 1));
  await page.waitForTimeout(1500);
  const r1 = await page.evaluate((n) => window.__rec.slice(n), n0);
  checks.swipe = { swing: r1.some((r) => r.swing), spin: r1.some((r) => r.spin), disarmed: r1.length > 0 && !r1[r1.length - 1].armed };
  console.log(`① 곧은 끌기: 보통 휘두름 ${checks.swipe.swing} · 싱지르 ${checks.swipe.spin} · 획 뒤 무장 풀림 ${checks.swipe.disarmed}`);
}

// ② 싱지르 (원 그리기 또는 곧장)
await waitArm();
const nA = await page.evaluate(() => window.__rec.length);
if (MODE === 'circle') {
  await page.evaluate((K) => (window.__timeK = K), K);
  const cx = 640, cy = 200;
  const at = (a) => [cx + RPX * Math.cos((a * Math.PI) / 180), cy - RPX * Math.sin((a * Math.PI) / 180)];
  await touch('pointerdown', ...at(0));
  const t0 = await gt();
  for (;;) {
    const u = Math.min(1, ((await gt()) - t0) / (DUR * 1000));
    await touch('pointermove', ...at(SENSE * CIRCLE * u));
    if (u >= 1 || (await page.evaluate(() => !!window.game.player.ibSpin))) break;
    await page.waitForTimeout(6);
  }
  await touch('pointerup', ...at(SENSE * CIRCLE));
} else {
  await page.evaluate(() => { const g = window.game; const o = g.playerSecret.fire(); g.player.skill.secret(o); });
}
const fired = await page.waitForFunction(() => !!window.game.player.ibSpin, null, { timeout: 30000, polling: 'raf' }).then(() => true).catch(() => false);
let res = { fired };
if (fired) {
  fire0 = await page.evaluate(() => { const p = window.game.player.bodies.pelvis.translation(); return { x: p.x, z: p.z }; });
  await page.evaluate(() => (window.__timeK = 0.08));
  await page.waitForFunction(() => { const S = window.game.player.ibSpin; return !S || S.q >= 0.5; }, null, { timeout: 120000, polling: 'raf' });
  await shoot(1, 'spin 1/2');
  await page.waitForFunction(() => { const S = window.game.player.ibSpin; return !S || S.settle || S.q >= 1; }, null, { timeout: 120000, polling: 'raf' });
  await shoot(2, 'turn end');
  await page.waitForFunction(() => !window.game.player.ibSpin, null, { timeout: 120000, polling: 'raf' });
  const tE = await page.evaluate(() => window.game.stats.simTime);
  await page.waitForFunction((t) => window.game.stats.simTime >= t + 0.6, tE, { timeout: 120000, polling: 'raf' });
  await shoot(3, 'after 0.6 s');
  await page.evaluate(() => (window.__timeK = 1));
  await page.waitForFunction(() => !window.game.player.skill.sec, null, { timeout: 120000, polling: 200 });
  const r = await page.evaluate((n) => window.__rec.slice(n), nA);
  const sp = r.filter((x) => x.spin);
  res.dir = sp[0]?.dir ?? null;
  res.spinSteps = sp.length;
  res.qMax = Math.max(0, ...sp.map((x) => x.q ?? 0));
  res.spinT = sp.length ? +(sp[sp.length - 1].t - sp[0].t).toFixed(2) : 0;
  console.log(`  대본 스텝 ${res.spinSteps} · 진행 최고 ${res.qMax.toFixed(2)} · 대본 시간 ${res.spinT} s`);
  res.tiltMax = Math.max(...r.filter((x) => x.sec).map((x) => x.tilt));
  const last = r.filter((x) => x.sec).pop();
  res.move = last ? Math.hypot(last.x - fire0.x, last.z - fire0.z) : null;
  strip(NAME, `${WEAPON} · ${MODE} · share ${info0.share} · upright ${info0.upright}`);
}
checks.spin = res;
console.log(`② 싱지르: 나감 ${res.fired} · 도는 쪽 ${res.dir} (바란 쪽 ${MODE === 'circle' ? SENSE : '칼 든 쪽'}) · 몸 기울기 최대 ${res.tiltMax?.toFixed(0)}° · 골반 옮김 ${res.move?.toFixed(2)} m`);
console.log(`콘솔 에러 ${errors.length}${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
const ok = errors.length === 0 && res.fired && (MODE !== 'circle' || (res.dir === SENSE && checks.swipe?.swing && !checks.swipe?.spin && checks.swipe?.disarmed));
process.exit(ok ? 0 : 1);
