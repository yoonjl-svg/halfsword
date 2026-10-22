// 비기 다섯의 잔상 · 궤적 연속 그림 (10/23 사장님 '잔상과 궤적도 비기에 걸맞는지 체크해' — docs/decisions.md 10/23 · 그림 docs/handoff/secret_trails). 읽기만.
//  테스트 경로(?test=1 — 스킬트리 칸이 모두 켜짐)로 그 유파 무기를 들고, 상대 AI 를 멈춰 비기마다 알맞은 거리에 세운 뒤(상대 칼은 낮게 · 충돌 끔 — 그림용 과녁),
//  비기 창을 직접 열어(game.playerSecret.openWindow) 곧장 낸다(fire → skill.secret — main.js 입력 길과 같은 함수). 판정 · 실행 · 잔상은 게임 함수 그대로.
//  화면 시계를 손으로 넘긴다: requestAnimationFrame 한 번에 1/60 s 씩(performance.now 도 같은 시계 — 잔상 남는 시간 instantArcLife 가 화면 시간이라 같이 멈춘다).
//  비기를 낸 프레임부터 잔상이 다 사라질 때까지 프레임마다 게임 카메라를 찍고, 잔상 호가 다 그려진 프레임에 옆 카메라를 한 장 더 찍는다.
//  프레임마다 재는 것: 비기 호(secretArc 메쉬 — 사각형 수 · 가장 짙은 불투명도) · 흰 섬광(secretFlash) · 보통 띠(swordTrail) · 화면 번쩍(#secretFlash) · f.instantArc(kind · share).
//  물리 스텝마다 재는 것: 칼끝(bladePoint 1) · 잔상 끝 점(호의 마지막 조각 칼끝 쪽 — 모르트슐라크는 칼자루 끝) 빠르기.
//  실행 (저장소 뿌리에서): npx vite --port 5477 --strictPort --host 127.0.0.1 &
//        node tools/browser/secret_trail_shots.mjs http://127.0.0.1:5477 [그림 폴더 (기본 docs/handoff/secret_trails)] [이름 꼬리 (기본 before)] [비기들 gonosen,mord,riso,spin,gyeoksal — gyeoksalLung 격살 허파 찌르기도 있음]
//        FOE=인물 id (기본 isolde — 판금 없는 상대) · STAGE=무대 (기본 poseidon — 다섯 비기를 같은 바탕에서 견주려고) · KEEP=1 낱장을 남김
//  내놓는 것: <비기>_<꼬리>_game.jpg (연속 그림 띠) · <비기>_<꼬리>_side.jpg (옆 카메라) · trails_<꼬리>.json (표의 수). 끝 코드 0 = 콘솔 에러 0. 소프트웨어 GL 이라 느리다(비기 하나 1~2 분)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = (process.argv[2] || 'http://127.0.0.1:5477').replace(/\/$/, '');
const dir = process.argv[3] || 'docs/handoff/secret_trails';
const tag = process.argv[4] || 'before';
const only = (process.argv[5] || 'gonosen,mord,riso,spin,gyeoksal').split(',');
const FOE = process.env.FOE ?? 'isolde';
const STAGE = process.env.STAGE ?? 'poseidon';
const tmp = `${dir}/_frames_${tag}`;
fs.mkdirSync(tmp, { recursive: true });

// 비기마다: 무기 · 창 사건(ctx) · 상대 가슴까지 거리(검술 풀이 measure — contact 맞닿기 · reach 칼끝 거리)
const CASES = {
  gonosen: { weapon: 'uchigatana', ctx: { ev: 'iai' }, gap: (M) => M.contact + 0.35 },
  mord: { weapon: 'longsword', ctx: { ev: 'press' }, gap: () => 0.8 },
  riso: { weapon: 'rapier', ctx: { ev: 'risoluto', path: 'hold', held: 0.6 }, gap: (M) => M.reach - 0.1 },
  spin: { weapon: 'zweihander', ctx: { ev: 'spin' }, gap: (M) => M.reach + 0.3 },
  gyeoksal: { weapon: 'qinggang', ctx: { ev: 'gyeoksal', slot: 'geojeong', stance: 'geojeong' }, gap: (M) => M.contact + 0.15 },
  gyeoksalLung: { weapon: 'qinggang', ctx: { ev: 'gyeoksal', slot: 'bongdu', stance: 'bongdu' }, gap: (M) => M.contact + 0.15 }, // 격살 봉두 → 허파 찌르기 (찌르는 줄)
};

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const table = [];

for (const key of only) {
  const C = CASES[key];
  if (!C) continue;
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  // 손으로 넘기는 화면 시계: __manual 이면 브라우저 프레임 하나에 __stepN 이 남았을 때만 1/60 s (rAF 를 부르는 곳이 여럿이어도 프레임 시각이 바뀔 때 한 번)
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
  page.on('pageerror', (e) => errors.push(`${key} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text()) && errors.push(`${key} ${m.text()}`));
  await page.goto(`${base}/?test=1&weapon=${C.weapon}&hero=player&foe=${FOE}&stage=${STAGE}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret?.S, null, { timeout: 120000 });
  await page.waitForFunction(() => window.game.stats.simTime > 2.8, null, { timeout: 400000 });
  await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
  // 상대를 멈추고 거리에 세운다 (몸 · 닻 · 걸음 딛은 자리를 함께 평행 이동 — iberian_spin_shots.mjs 와 같은 칸)
  const info = await page.evaluate(
    ({ gapSrc }) => {
      const g = window.game, p = g.player, e = g.enemy;
      g.settings.fpsCap = false;
      g.ai.update = () => e.move.set(0, 0);
      e.handOffset.set(0, -0.5);
      for (let i = 0; i < e.sword.numColliders(); i++) e.sword.collider(i).setCollisionGroups(0);
      const M = p.swordArt.measure;
      const want = new Function('M', `return (${gapSrc})(M)`)(M);
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
      return { S: g.playerSecret.S?.name, nameKo: g.playerSecret.S?.nameKo, want, contact: M.contact, reach: M.reach, stage: g.stage.id };
    },
    { gapSrc: C.gap.toString() },
  );
  await page.waitForTimeout(1200); // 자리 잡기 (실시간)
  // 물리 스텝마다 칼끝 · 잔상 끝 점 (combat.afterStep 뒤 — 운동학 비기는 그 끝 runInstants 에서 칼을 놓는다)
  await page.evaluate(() => {
    const g = window.game, p = g.player, cb = g.combat;
    const rec = (window.__rec = []);
    const a0 = cb.afterStep.bind(cb);
    let prevTip = null, prevEnd = null, prevN = 0;
    cb.afterStep = (...args) => {
      const r = a0(...args);
      const tip = p.bladePoint(1);
      const A = p.instantArc;
      const n = A?.pts?.length ?? 0;
      let vEnd = null;
      if (A && n && (n !== prevN || prevEnd == null)) {
        const q = A.pts[n - 1];
        const e = new g.THREE.Vector3(q[3], q[4], q[5]);
        if (prevEnd && n > prevN) vEnd = e.distanceTo(prevEnd) / (1 / 120);
        prevEnd = e;
      }
      prevN = n;
      const tp = p.skill.tap, K = tp?.K;
      const cut = p.iai ? (p.iai.kind === 'iai' ? p.iai.u >= p.iai.ab : !!p.iai.cutting) : !!(tp && K && tp.t >= K.aim && tp.t < K.aim + K.extend + K.hold) || !!p.ibSpin?.free;
      rec.push({ t: g.stats.simTime, st: p.skill.sec?.stage ?? null, v: prevTip ? tip.distanceTo(prevTip) / (1 / 120) : 0, vEnd, cut, arc: A ? { id: A.id, kind: A.kind ?? null, share: A.share ?? 1, n } : null });
      prevTip = tip;
      return r;
    };
    window.__arc0 = p.instantArc?.id ?? 0;
    window.__wounds0 = g.stats.hits.length;
  });
  // 프레임 재기
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
      const A = p.instantArc;
      return {
        tick: window.__ticks, sim: +g.stats.simTime.toFixed(3), st: p.skill.sec?.stage ?? null,
        arc: amax('secretArc'), flash: amax('secretFlash'), trail: amax('swordTrail'),
        screen: +(+getComputedStyle(document.getElementById('secretFlash')).opacity).toFixed(2),
        kind: A && A.id !== window.__arc0 ? A.kind ?? null : null, share: A && A.id !== window.__arc0 ? +(A.share ?? 1).toFixed(2) : null,
      };
    });
  const step = async () => {
    const t0 = await page.evaluate(() => window.__ticks);
    await page.evaluate(() => (window.__stepN = 1));
    await page.waitForFunction((t0) => window.__ticks > t0, t0, { timeout: 60000, polling: 'raf' });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); // 그 프레임이 그려진 뒤
  };
  await page.evaluate(() => (window.__manual = true));
  await step();
  const fired = await page.evaluate((cx) => {
    const g = window.game;
    g.playerSecret.openWindow(cx, 0.6);
    const o = g.playerSecret.fire();
    return !!(o && g.player.skill.secret(o));
  }, C.ctx);
  // 옆 카메라 (시계가 서 있는 동안 — 찍고 나면 게임 카메라로 되돌린다)
  const sideFile = `${tmp}/${key}_side.png`;
  let sideAt = null;
  const sideShot = async (m) => {
    await page.evaluate(() => {
      const g = window.game, f = g.player, o = g.enemy;
      const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
      let fx = a.x - b.x, fz = a.z - b.z;
      const L = Math.hypot(fx, fz) || 1;
      fx /= L;
      fz /= L;
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      window.__camKeep = { p: g.camera.position.clone(), q: g.camera.quaternion.clone() };
      g.freeCam = true;
      g.camera.position.set(mx + fz * 3.4, 1.9, mz - fx * 3.4);
      g.camera.lookAt(mx, 1.0, mz);
    });
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.screenshot({ path: sideFile });
    await page.evaluate(() => {
      const g = window.game;
      g.camera.position.copy(window.__camKeep.p);
      g.camera.quaternion.copy(window.__camKeep.q);
      g.freeCam = false;
    });
    sideAt = m?.i ?? null;
  };
  const frames = [];
  let best = null, gone = 0;
  for (let i = 0; i < 90; i++) {
    await step();
    const m = await measure();
    m.i = i;
    const file = `${tmp}/${key}_${String(i).padStart(2, '0')}.png`;
    await page.screenshot({ path: file });
    m.file = file;
    const prev = frames[frames.length - 1];
    frames.push(m);
    if (m.arc.n > 0 && (!best || m.arc.n >= best.arc.n)) best = m;
    // 옆 카메라: 잔상 호가 다 그려진 프레임(비기가 도는 단계 — instant · riso · spin — 를 벗어난 첫 프레임) · 호가 없으면 칼을 놓아 가로지르는 첫 프레임(싱지르 follow)
    if (sideAt == null && ((m.arc.n > 0 && !['instant', 'riso', 'spin'].includes(m.st)) || (!m.kind && m.st === 'follow'))) await sideShot(m);
    const busy = m.st && m.st !== 'stiff';
    gone = !busy && m.arc.n === 0 && m.trail.n === 0 ? gone + 1 : 0;
    if (i > 12 && gone >= 4) break;
  }
  if (sideAt == null) await sideShot(null);
  const rec = await page.evaluate(() => window.__rec);
  const hits = await page.evaluate(() => window.game.stats.hits.slice(window.__wounds0));
  const run = rec.filter((r) => r.st && r.st !== 'stiff');
  const arcRows = rec.filter((r) => r.arc && r.arc.id !== 0);
  const lastArc = [...arcRows].reverse()[0]?.arc ?? null;
  const vmax = Math.max(0, ...run.map((r) => r.v));
  const cutV = run.filter((r) => r.cut).map((r) => r.v);
  const endV = run.filter((r) => r.vEnd != null).map((r) => r.vEnd);
  const arcFrames = frames.filter((f) => f.arc.n > 0);
  const row = {
    key, S: info.S, nameKo: info.nameKo, weapon: C.weapon, stage: info.stage, gap: +info.want.toFixed(2), fired,
    kind: frames.find((f) => f.kind)?.kind ?? '보통 띠만', share: frames.find((f) => f.share != null)?.share ?? null,
    arcAlphaMax: Math.max(0, ...frames.map((f) => f.arc.a)), flashAlphaMax: Math.max(0, ...frames.map((f) => f.flash.a)), trailAlphaMax: Math.max(0, ...frames.map((f) => f.trail.a)), screenMax: Math.max(0, ...frames.map((f) => f.screen)),
    arcFrames: arcFrames.length, arcSec: +(arcFrames.length / 60).toFixed(2), arcQuadsMax: best?.arc.n ?? 0,
    tipMax: +vmax.toFixed(1), cutTipMax: cutV.length ? +Math.max(...cutV).toFixed(1) : 0, arcEndMax: endV.length ? +Math.max(...endV).toFixed(1) : 0, arcN: lastArc?.n ?? 0,
    hits, sideAt,
  };
  table.push(row);
  console.log(JSON.stringify(row));
  // 띠 그림: 비기를 낸 뒤 프레임 중 무언가 보이는 프레임(잔상 · 보통 띠) 고르게 12 장 + 처음 한 장 (낱장 크기 절반 · 줄마다 4 장)
  //  (보이는 프레임이 6 장보다 적으면 — 잔상이 없는 비기 — 비기가 도는 동안 프레임에서 고르게)
  let vis = frames.filter((f) => f.arc.n > 0 || f.trail.n > 0 || f.flash.n > 0);
  if (vis.length < 6) vis = frames.filter((f) => f.st);
  const pick = [frames[0], ...(vis.length > 11 ? Array.from({ length: 11 }, (_, k) => vis[Math.round((k * (vis.length - 1)) / 10)]) : vis)].filter((f, k, a) => f && a.indexOf(f) === k);
  fs.writeFileSync(`${tmp}/${key}_pick.json`, JSON.stringify(pick));
  const py = `
import sys, json
from PIL import Image, ImageDraw
pick = json.load(open(sys.argv[1])); out_game = sys.argv[2]; side = sys.argv[3]; out_side = sys.argv[4]
ims = [Image.open(p['file']).convert('RGB') for p in pick]
w, h = ims[0].size
sw, sh = w // 2, h // 2
cols = 4
rows = (len(ims) + cols - 1) // cols
out = Image.new('RGB', (cols * sw, rows * (sh + 16)), (16, 16, 16))
dr = ImageDraw.Draw(out)
for k, (im, p) in enumerate(zip(ims, pick)):
    x, y = (k % cols) * sw, (k // cols) * (sh + 16)
    out.paste(im.resize((sw, sh)), (x, y + 16))
    dr.text((x + 4, y + 2), f"f{p['i']} {p['st'] or '-'} arc {p['arc']['n']}q a{p['arc']['a']:.2f}  flash a{p['flash']['a']:.2f}  trail a{p['trail']['a']:.2f}", fill=(255, 214, 90))
out.save(out_game, quality=82, optimize=True)
Image.open(side).convert('RGB').save(out_side, quality=86, optimize=True)
`;
  execFileSync('python3', ['-c', py, `${tmp}/${key}_pick.json`, `${dir}/${key}_${tag}_game.jpg`, sideFile, `${dir}/${key}_${tag}_side.jpg`]);
  if (best) fs.copyFileSync(best.file, `${tmp}/${key}_best.png`);
  await ctx.close();
}
// 표: 같은 꼬리의 지난 줄에 이번 줄을 덮어 합친다 (비기 몇만 다시 찍을 때)
const jf = `${dir}/trails_${tag}.json`;
let old = [];
try {
  old = JSON.parse(fs.readFileSync(jf, 'utf8'));
} catch {}
const merged = Object.keys(CASES).map((k) => table.find((r) => r.key === k) ?? old.find((r) => r.key === k)).filter(Boolean);
fs.writeFileSync(jf, JSON.stringify(merged, null, 1));
if (!process.env.KEEP) fs.rmSync(tmp, { recursive: true, force: true });
console.log('ERRORS ' + JSON.stringify(errors));
await browser.close();
process.exit(errors.length ? 1 : 0);
