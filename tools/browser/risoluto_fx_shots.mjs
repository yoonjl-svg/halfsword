// 안다레 리솔루토 런지 연출 그림 (사장님 10/25 14:0x '리솔루토 쓰는 순간 비기인 줄 모르겠더라' → 안 1 결정 — ① 카메라가 런지를 따라 앞으로 ② 찌르는 줄 빛줄기 ·
//  docs/strike/italian_risoluto_2026-10-22.md §15 · 그림 docs/handoff/risoluto_fx_2026-10-25). 읽기만 — 게임 함수 그대로, 화면 시계만 손으로 넘긴다.
//  게임 카메라 · 폰 가로 844 × 390. 런지를 낸 프레임부터 화면 시계 1/60 s 씩 넘기며 프레임마다 찍어 띠 그림(webp)과 낱장 둘(빛줄기 가장 짙을 때 · 카메라 가장 밀렸을 때)을 낸다.
//  MODE=staged (기본): 테스트 경로(?test=1 — 스킬트리 칸 모두 켬) · 레이피어 · 상대 AI 를 멈춰 가슴 사이 GAP(기본 맞닿기 + 0.3 m — 런지 간격 조건 안 · 몸 미끄러짐 0.3 m)에 세우고
//   (상대 칼 낮게 · 충돌 끔 — 그림용 과녁) 비기 창을 직접 열어 곧장 낸다(fire → skill.secret — main.js 입력 길과 같은 함수). secret_trail_shots.mjs 와 같은 칸.
//  MODE=play: 사장님 테스트 경로 그대로(?test=1&weapon=rapier&hero=player&foe=random&stage=random) · 상대 AI 그대로 싸움 — 사람 흉내 운전(risoluto_lunge_shots.mjs 와 같음:
//   손을 상대 칼끝 쪽 위로 · 스틱 앞)으로 칼이 붙어 창(금색 '!')이 저절로 열리면 화면 톡(진짜 탭 입력) → 그 프레임부터 찍음. 창이 안 열리면 WALL ms 뒤 그 사실을 적고 끝(억지로 열지 않음)
//  실행 (저장소 뿌리에서): npx vite --port 5584 --strictPort --host 127.0.0.1 &
//        node tools/browser/risoluto_fx_shots.mjs http://127.0.0.1:5584 <그림 폴더> <이름 꼬리 before|after|…> [쿼리 덧붙임 — before 는 '&risoCam=0&risoStreak=0']
//        SET='{"risoCam":0.9}' (SECRET 칸 덮어쓰기 — 견주기) · WHO=foe (staged — 상대가 런지: 쿼리에 '&foeWeapon=rapier') · FRAMES=낱장 폴더(기본 <그림 폴더>/_frames_<꼬리> · 끝나면 지움 — KEEP=1 이면 남김) · STAGE · FOE (staged 기본 poseidon · isolde) · GAP (m) · WALL (play 벽시계 ms, 기본 600000)
//  재는 것: 프레임마다 런지 카메라 밀림(m) · 비기 호 · 섬광 · 반짝임 메쉬 · 화면 길이 px(빛줄기 S → E · 10/23 'line' 띠 어림 · 반짝임 가로 팔 끝끼리) · 빛줄기 길이 len(m)
//  내놓는 것: <꼬리>_strip.webp (12 장 띠 · 장마다 프레임 번호 · 런지 뒤 시간 · 카메라 밀림 m · 빛줄기 사각형 수) · <꼬리>_streak.webp · <꼬리>_push.webp (낱장) · fx_<꼬리>.json. 끝 코드 0 = 콘솔 에러 0
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = (process.argv[2] || 'http://127.0.0.1:5584').replace(/\/$/, '');
const dir = process.argv[3] || 'docs/handoff/risoluto_fx_2026-10-25';
const tag = process.argv[4] || 'after';
const extra = process.argv[5] || '';
const MODE = process.env.MODE || 'staged';
const tmp = process.env.FRAMES || `${dir}/_frames_${tag}`;
fs.mkdirSync(tmp, { recursive: true });
fs.mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
await ctx.route('https://*.supabase.co/**', (r) => r.abort());
// 손으로 넘기는 화면 시계 (secret_trail_shots.mjs 와 같음): __manual 이면 브라우저 프레임 하나에 __stepN 이 남았을 때만 1/60 s
await ctx.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window);
  const pn = performance.now.bind(performance);
  let last = pn(), acc = last, lastTs = -1;
  window.__manual = false;
  window.__stepN = 0;
  window.__ticks = 0;
  const clock = () => {
    const t = pn();
    if (!window.__manual) acc += t - last;
    last = t;
    return acc;
  };
  performance.now = clock;
  window.requestAnimationFrame = (cb) =>
    raf((ts) => {
      if (ts !== lastTs) {
        lastTs = ts;
        if (window.__manual && window.__stepN > 0) {
          acc += 1000 / 60;
          window.__stepN--;
          window.__ticks++;
        }
      }
      cb(clock());
    });
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
page.on('console', (m) => m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text()) && errors.push(m.text()));
const route = MODE === 'play' ? `?test=1&weapon=rapier&hero=player&foe=random&stage=random` : `?test=1&weapon=rapier&hero=player&foe=${process.env.FOE ?? 'isolde'}&stage=${process.env.STAGE ?? 'poseidon'}`;
await page.goto(`${base}/${route}${extra}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
await page.getByText('여정 시작').click();
await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret?.S, null, { timeout: 120000 });
await page.waitForFunction(() => window.game.stats.simTime > 2.8, null, { timeout: 400000 });
await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
if (process.env.SET) await page.evaluate((o) => Object.assign(window.game.config.SECRET, o), JSON.parse(process.env.SET)); // 견주기: SET='{"risoStreakWidth":0.14}' (SECRET 칸 덮어쓰기)
const info = await page.evaluate(() => ({ S: window.game.playerSecret.S?.name, foe: window.game.enemy.name, foeWeapon: window.game.enemy.weapon?.id, stage: window.game.stage.id }));
console.log(`MODE ${MODE} ${JSON.stringify(info)}`);

const step = async () => {
  const t0 = await page.evaluate(() => window.__ticks);
  await page.evaluate(() => (window.__stepN = 1));
  await page.waitForFunction((t0) => window.__ticks > t0, t0, { timeout: 60000, polling: 'raf' });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // 그 프레임이 그려진 뒤
};

let fired = false;
if (MODE === 'play') {
  // 사람 흉내 운전 (risoluto_lunge_shots.mjs 와 같은 식): 물리 스텝마다 손을 상대 칼끝 쪽 위로 · 스틱 앞 (맞붙는 거리 밖에서만) · 창이 열리면 화면 시계를 세운다
  await page.evaluate(() => {
    const g = window.game, T = g.THREE, ps = g.playerSecret, orig = ps.update.bind(ps);
    const P = (window.drv = { tgt: [0.1, 0.05], open: null });
    const v = () => new T.Vector3();
    g.settings.fpsCap = false;
    ps.update = (dt, busy) => {
      const p = g.player, e = g.enemy;
      if (p && e && !p.skill.sec && p.armed && e.armed) {
        const a0 = p.bladePoint(0, v()), a1 = p.bladePoint(0.5, v()), b0 = e.bladePoint(0.5, v()), b1 = e.bladePoint(1, v());
        const d1 = a1.clone().sub(a0), d2 = b1.clone().sub(b0), r = a0.clone().sub(b0);
        const A = d1.dot(d1), E = d2.dot(d2), F = d2.dot(r), C = d1.dot(r), B = d1.dot(d2), den = A * E - B * B;
        let s = den > 1e-9 ? Math.min(1, Math.max(0, (B * F - C * E) / den)) : 0;
        let t = (B * s + F) / E;
        if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -C / A)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (B - C) / A)); }
        const dv = b0.clone().addScaledVector(d2, t).sub(a0.clone().addScaledVector(d1, s)).applyQuaternion(p.yaw.clone().invert());
        if (p.foeDistance() < 3) P.tgt = [Math.max(-0.5, Math.min(0.5, P.tgt[0] + dv.z * 4 * dt)), Math.max(-0.3, Math.min(0.45, P.tgt[1] + (dv.y + 0.03) * 4 * dt))];
        const off = p.handOffset, dx = P.tgt[0] - off.x, dy = P.tgt[1] - off.y, dd = Math.hypot(dx, dy), st = 0.6 * dt;
        if (dd > st) { off.x += (dx / dd) * st; off.y += (dy / dd) * st; } else off.set(P.tgt[0], P.tgt[1]);
        p.inputActive = dd > 1e-4;
      }
      if (p) {
        p.handHeld = !p.skill.sec;
        const fwd = !p.skill.sec && !ps.open && p.foeDistance() > p.swordArt.measure.clinch ? 1 : 0;
        p.move.set(0, fwd);
        p.stickX = 0;
        p.stickY = fwd;
      }
      orig(dt, busy);
      if (ps.open && !P.open) {
        P.open = { ...ps.open.ctx, gap: +p.foeDistance().toFixed(2), sim: +g.stats.simTime.toFixed(2) };
        ps.open.t = Math.max(ps.open.t, 5); // 소프트웨어 GL 은 느려 창이 톡 전에 닫히지 않게 (그림에서만)
        window.__manual = true; // 화면 시계를 세움 (톡까지)
      }
    };
  });
  const t0 = Date.now();
  let st = null;
  while (Date.now() - t0 < +(process.env.WALL ?? 600000)) {
    await page.waitForTimeout(150);
    st = await page.evaluate(() => ({ open: window.drv.open, fight: window.game.state, alive: [window.game.player.alive, window.game.enemy.alive] }));
    if (st.open || st.fight !== 'fight' || !st.alive[0] || !st.alive[1]) break;
  }
  console.log(`PLAY ${JSON.stringify(st)} wall ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (!st?.open) {
    console.log('창이 열리지 않음 — 그림 없음');
    await browser.close();
    process.exit(2);
  }
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  // 진짜 입력: 칼 쪽 화면을 톡 (pointerdown → pointerup, 끌지 않음 — input.js 톡) · 화면 시계는 선 채 (톡은 프레임 입력 길에서 받는다)
  await page.evaluate(async () => {
    const cv = document.getElementById('game');
    const o = { pointerId: 77, pointerType: 'touch', clientX: 620, clientY: 200, bubbles: true, isPrimary: true, button: 0 };
    cv.dispatchEvent(new PointerEvent('pointerdown', o));
    await new Promise((r) => setTimeout(r, 40));
    cv.dispatchEvent(new PointerEvent('pointerup', o));
  });
  for (let i = 0; i < 6 && !fired; i++) {
    await step();
    fired = await page.evaluate(() => !!window.game.player.skill.sec?.lunge);
  }
} else {
  // 상대를 멈추고 거리에 세운다 (secret_trail_shots.mjs 와 같은 칸)
  const want = await page.evaluate((GAP) => {
    const g = window.game, p = g.player, e = g.enemy;
    g.settings.fpsCap = false;
    g.ai.update = () => e.move.set(0, 0);
    e.handOffset.set(0, -0.5);
    for (let i = 0; i < e.sword.numColliders(); i++) e.sword.collider(i).setCollisionGroups(0);
    const M = p.swordArt.measure;
    const want = GAP > 0 ? GAP : M.contact + 0.3;
    const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
    const fw = p.forward();
    const dx = pc.x + fw.x * want - ec.x, dz = pc.z + fw.z * want - ec.z;
    for (const { rb } of e.meshes) {
      const t = rb.translation();
      rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true);
    }
    const at = e.anchor.translation();
    e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
    if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const q of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[q]) { l[q].x += dx; l[q].z += dz; } }
    return want;
  }, +(process.env.GAP ?? 0));
  console.log(`GAP ${want.toFixed(2)}`);
  await page.waitForTimeout(1200); // 자리 잡기 (실시간)
  await page.evaluate(() => (window.__manual = true));
  await step();
  fired = await page.evaluate((who) => {
    const g = window.game;
    g.playerSecret.openWindow({ ev: 'risoluto', path: 'touch', held: 0 }, 0.6);
    const o = g.playerSecret.fire();
    // WHO=foe: 상대(레이피어 — 쿼리 '&foeWeapon=rapier')가 같은 비기 칸으로 런지를 낸다 (AI 는 지금 리솔루토를 쓰지 않음 — 빛줄기가 누구의 런지든 그려지고 카메라는 안 움직이는지 보려고)
    window.__who = who;
    if (who === 'foe') return !!(o && g.enemy.swordArt?.tradition === 'italian' && g.enemy.skill.secret(o));
    return !!(o && g.player.skill.secret(o));
  }, process.env.WHO || 'player');
}
console.log(`FIRED ${fired}`);

// 프레임 재기: 비기 호 · 섬광 메쉬(빛줄기는 이 둘에 함께 그린다) · 런지 카메라 · 카메라 자리
const measure = () =>
  page.evaluate(() => {
    const g = window.game, sc = g.scene, p = g.player;
    const amax = (name) => {
      const m = sc.getObjectByName(name);
      if (!m?.visible) return { n: 0, a: 0 };
      const c = m.geometry.attributes.color.array, n = m.geometry.drawRange.count;
      let a = 0;
      for (let i = 0; i < n; i++) a = Math.max(a, c[i * 4 + 3]);
      return { n: n / 6, a: +a.toFixed(3) };
    };
    const S = g.config.SECRET;
    // 화면 길이 (폰 가로 px): 런지 빛줄기 S(런지를 시작한 스텝 칼날 밑동) → 가장 멀리 간 칼끝 E · 10/23 'line' 띠(처음 찌르는 토막 칼자루 → 같은 E — 어림) · 끝 반짝임 가로 팔 끝끼리
    const who = window.__who === 'foe' ? g.enemy : p;
    const A = who.instantArc;
    let px = null;
    if (A?.lunge && A.pts?.length) {
      const V = g.THREE.Vector3;
      const S0 = new V(...A.lunge);
      let E = null, dd = -1;
      for (const q of A.pts) {
        const d = (q[3] - S0.x) ** 2 + (q[4] - S0.y) ** 2 + (q[5] - S0.z) ** 2;
        if (d > dd) [dd, E] = [d, new V(q[3], q[4], q[5])];
      }
      const sc = (v) => {
        const c = v.clone().project(g.camera);
        return [((c.x + 1) / 2) * innerWidth, ((1 - c.y) / 2) * innerHeight];
      };
      const len = (a, b) => +Math.hypot(a[0] - b[0], a[1] - b[1]).toFixed(1);
      const R = new V().setFromMatrixColumn(g.camera.matrixWorld, 0).multiplyScalar((S.risoStreakWidth ?? 0.12) * (S.risoGlintK ?? 4));
      px = { streak: len(sc(S0), sc(E)), line: len(sc(new V(A.pts[0][0], A.pts[0][1], A.pts[0][2])), sc(E)), glint: len(sc(E.clone().add(R)), sc(E.clone().sub(R))), len: +Math.sqrt(dd).toFixed(2) };
    }
    const cp = g.camPush;
    const push = cp && cp.t >= 0 ? (cp.t < S.risoCamIn ? g.THREE.MathUtils.smoothstep(cp.t, 0, S.risoCamIn) : 1 - g.THREE.MathUtils.smoothstep(cp.t, S.risoCamIn, S.risoCamIn + S.risoCamOut)) * S.risoCam : 0;
    const c = g.camera.position;
    return { tick: window.__ticks, sim: +g.stats.simTime.toFixed(3), st: p.skill.sec?.stage ?? null, arc: amax('secretArc'), flash: amax('secretFlash'), glint: amax('secretGlint'), push: +push.toFixed(3), cam: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)], px, hits: g.stats.hits.length };
  });
const frames = [];
const tick0 = await page.evaluate(() => window.__ticks);
for (let i = 0; i < 70; i++) {
  if (i > 0) await step();
  const m = await measure();
  m.i = i;
  m.ms = Math.round(((m.tick - tick0) * 1000) / 60);
  m.file = `${tmp}/${tag}_${String(i).padStart(2, '0')}.png`;
  await page.screenshot({ path: m.file });
  frames.push(m);
  if (i > 50 && !m.st && m.arc.n === 0 && m.flash.n === 0) break;
}
const hits = await page.evaluate(() => window.game.stats.hits.slice(-2));
// 띠: 런지 프레임부터 0.9 s 까지 고르게 12 장 (런지 순간 쪽을 촘촘히 — 0 · 2 · 4 · 6 · 9 · 12 · 16 · 20 · 26 · 33 · 42 · 54 프레임)
const want = [0, 2, 4, 6, 9, 12, 16, 20, 26, 33, 42, 54];
const pick = want.map((k) => frames[Math.min(k, frames.length - 1)]).filter((f, k, a) => a.indexOf(f) === k);
const streakAt = frames.reduce((b, f) => (f.flash.n > (b?.flash.n ?? -1) || (f.flash.n === b?.flash.n && f.flash.a > b.flash.a) ? f : b), null);
const pushAt = frames.reduce((b, f) => (f.push > (b?.push ?? -1) ? f : b), null);
fs.writeFileSync(`${tmp}/${tag}_pick.json`, JSON.stringify({ pick, streak: streakAt?.file, push: pushAt?.push > 0 ? pushAt.file : null })); // 카메라가 안 밀린 판(before · 상대 런지)은 밀림 낱장 없음
const py = `
import sys, json
from PIL import Image, ImageDraw
d = json.load(open(sys.argv[1])); tag = sys.argv[2]; out = sys.argv[3]; label = sys.argv[4]
pick = d['pick']
ims = [Image.open(p['file']).convert('RGB') for p in pick]
w, h = ims[0].size
sw, sh = w // 2, h // 2
cols = 4
rows = (len(ims) + cols - 1) // cols
im = Image.new('RGB', (cols * sw, rows * (sh + 16) + 18), (16, 16, 16))
dr = ImageDraw.Draw(im)
dr.text((4, 3), label, fill=(255, 255, 255))
for k, (fr, p) in enumerate(zip(ims, pick)):
    x, y = (k % cols) * sw, (k // cols) * (sh + 16) + 18
    im.paste(fr.resize((sw, sh)), (x, y + 16))
    dr.text((x + 4, y + 2), f"+{p['ms']} ms  {p['st'] or '-'}  cam push {p['push']:.2f} m  streak {'on' if p['flash']['n'] else '-'}  glint {p['glint']['a']:.2f}", fill=(255, 214, 90))
im.save(f"{out}/{tag}_strip.webp", quality=82, method=6)
for key in ('streak', 'push'):
    if d.get(key):
        Image.open(d[key]).convert('RGB').save(f"{out}/{tag}_{key}.webp", quality=88, method=6)
`;
const label = `${tag} | ${MODE} | stage ${info.stage} | foe weapon ${info.foeWeapon} | 844x390 game camera${extra ? ' | ' + extra : ''}${process.env.SET ? ' | ' + process.env.SET : ''}`; // 띠 글은 영문만 (그림 글꼴에 한글 없음)
execFileSync('python3', ['-I', '-c', py, `${tmp}/${tag}_pick.json`, tag, dir, label]);
const row = { tag, mode: MODE, extra, ...info, fired, frames: frames.length, streakFrames: frames.filter((f) => f.flash.n > 0).length, pushMax: Math.max(0, ...frames.map((f) => f.push)), streakAt: streakAt?.i ?? null, pushAt: pushAt?.i ?? null, hits, px: frames.filter((f) => f.px).reduce((b, f) => (!b || f.px.len > b.len + 1e-6 ? f.px : b), null), per: frames.map(({ i, ms, st, arc, flash, glint, push, cam, px }) => ({ i, ms, st, arc, flash, glint, push, cam, px })) };
fs.writeFileSync(`${dir}/fx_${tag}.json`, JSON.stringify(row, null, 1));
console.log(JSON.stringify({ ...row, per: undefined }));
if (!process.env.KEEP) fs.rmSync(tmp, { recursive: true, force: true });
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
