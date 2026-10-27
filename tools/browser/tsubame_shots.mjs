// 사람 제비 베기 그림 (사장님 10/25 21:1x '해법 1~3 좋아' — 기록 docs/strike/tsubame_snap_2026-10-25.md · src/unique_assist.js tsuRuler · tsuSnap · tsuAim):
//  폰 가로 844 × 390 · 배율 2 · WebP. 打刀(일본 · 스킬트리 모두 — J9 제비 베기 열림) · 상대 이졸데 롱소드를 세워 둠(AI 멈춤 · 둘 다 상처 끔 시연).
//  손가락 봇 한 벌 = 재기 도구(tools/sim/schielhau_strike.mjs tsubameRun)와 같은 길: 지붕 → [0, 0.14] → 아래 [0, −0.5] → 곧장 위로 [0.06, −0.15] → 오른 황소 [0.22, 0.26]
//  (긋기 빠르기 4.5 패드 m/s · 아래 칼은 상대 몸을 지나가게 — 도구 --ghostDown 과 같음: 제비 베기가 나는 조건 '앞 칼 빗나감'). 가슴 사이 GAP(기본 1.15 m)에 서서 낸다.
//  제비 베기가 강화된 첫 스텝(꺾음)부터 STRIP(기본 0,0.025,0.05,0.075,0.1,0.15 s)마다 멈춰 옆 그림(두 가슴 줄에 수직 CAM m — 기본 2.3 · 칼 든 쪽) → 한 줄 띠(<판>_strip.webp) ·
//  첫 맞음 스텝 옆 · 게임 화면(<판>_hit_{side,game}).
//  판 = TAGS (기본 'before:&tsuRuler=0&tsuSnap=0&tsuAim=0,after:') · 맞음마다 부위 · 에너지 · 빠르기를 적음
//  npx vite build --outDir <tmp>/dist && node tools/pwa/build.mjs <tmp>/dist && npx vite preview --outDir <tmp>/dist --port 5567 --strictPort &
//  node tools/browser/tsubame_shots.mjs http://127.0.0.1:5567 <그림 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const base = process.argv[2] || 'http://127.0.0.1:5567';
const out = process.argv[3] || 'docs/handoff/tsubame_2026-10-25';
fs.mkdirSync(out, { recursive: true });
const TAGS = (process.env.TAGS || 'before:&tsuRuler=0&tsuSnap=0&tsuAim=0,after:').split(',').map((s) => s.split(':'));
const STRIP = (process.env.STRIP || '0,0.025,0.05,0.075,0.1,0.15').split(',').map(Number);
const GAP = +(process.env.GAP || 1.15);
const CAM = +(process.env.CAM || 2.3);
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] });
const errors = [];
const log = [];

async function open(extra) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${base}/?weapon=uchigatana&foe=isolde&foeWeapon=longsword&skillNodes=all&slowMo=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 90000 });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  return { ctx, page };
}

/** 멈춘 자세를 찍는다: side = 두 가슴 줄에 수직 CAM m (칼 든 쪽) · game = 게임 화면 그대로. png 이름을 돌려줌 */
async function shot(page, file, view) {
  await page.evaluate(([view, CAM]) => {
    const g = window.game;
    if (view === 'game') return;
    const p = g.player;
    const a = p.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    g.freeCam = true;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const s = -(p.side ?? 1);
    const cx = s * (dz / L), cz = -s * (dx / L);
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    g.camera.position.set(mx + cx * CAM, 1.05, mz + cz * CAM);
    g.camera.lookAt(mx, 0.9, mz);
  }, [view, CAM]);
  await page.waitForTimeout(350);
  const png = `${out}/${file}.png`;
  await page.screenshot({ path: png });
  await page.evaluate(() => {
    window.game.freeCam = false;
  });
  return png;
}
const webp = (png) => {
  execFileSync('python3', ['-I', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=86, method=6)', png, png.replace(/\.png$/, '.webp')]);
  fs.unlinkSync(png);
};
/** 띠: 옆 그림들을 가운데 자른 뒤 가로로 이어 붙임 (칸마다 위에 시간 글 없음 — 문서 표에 적음) */
const strip = (pngs, file) => {
  execFileSync('python3', ['-I', '-c', `
import sys
from PIL import Image
fs = sys.argv[2:]
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
cw = int(w * 0.5); x0 = (w - cw) // 2
crops = [im.crop((x0, 0, x0 + cw, h)) for im in ims]
S = Image.new('RGB', (cw * len(crops), h), (0, 0, 0))
for i, c in enumerate(crops): S.paste(c, (i * cw, 0))
S = S.resize((S.width // 2, S.height // 2))
S.save(sys.argv[1], 'WEBP', quality=86, method=6)
`, `${out}/${file}.webp`, ...pngs]);
  for (const p of pngs) fs.unlinkSync(p);
};

for (const [tag, extra] of TAGS) {
  const { ctx, page } = await open(extra ?? '');
  await page.evaluate(([STRIP, GAP]) => {
    const g = window.game, p = g.player, e = g.enemy, ps = g.playerSecret, orig = ps.update.bind(ps);
    g.ai.update = () => e.move.set(0, 0); // 상대를 그 자리에 세움 (시연)
    e.applyWound = () => {};
    p.applyWound = () => {};
    p.skill.autoGuard = true;
    const u = p.skill.uniq;
    if (u && !u._feed) {
      u._feed = u.feed.bind(u);
      u.feed = () => {}; // 손가락은 봇만 (화면 입력 0 이 손가락 빠르기를 흔들지 않게)
    }
    const DT = 1 / 120, FRAME = 2 * DT;
    const COMBO = { from: [0.02, 0.52], path: [[0.0, 0.14], [0.0, -0.5], [0.06, -0.15], [0.22, 0.26]] };
    const D = (window.drv = { want: null, phase: 'walk', q: [], n: 0, fx: 0, fy: 0, tTurn: null, k: 0, hit: null, hits: [], wait: 0 });
    const to = (pt, vel, held) => {
      const fr = [];
      let x = D.fx, y = D.fy;
      for (let k = 0; k < 400; k++) {
        const dx = pt[0] - x, dy = pt[1] - y, d = Math.hypot(dx, dy);
        if (d < 1e-6) break;
        const st = Math.min(d, vel * FRAME);
        x += (dx / d) * st;
        y += (dy / d) * st;
        fr.push([(dx / d) * st, (dy / d) * st, held]);
      }
      D.fx = x;
      D.fy = y;
      return fr;
    };
    const pw = g.combat.hooks.onWound;
    g.combat.hooks.onWound = (att, vic, r, ...rest) => {
      pw?.(att, vic, r, ...rest);
      if (att !== p || D.tTurn == null) return;
      const rec = { t: +(g.stats.simTime - D.tTurn).toFixed(3), part: rest[1]?.v?.part ?? null, zone: r.zone, E: +r.energy.toFixed(0), v: r.speed != null ? +r.speed.toFixed(1) : null, sev: +(r.severity ?? 0).toFixed(2), kin: !!p.iai };
      D.hits.push(rec);
      if (!D.hit) {
        D.hit = rec;
        D.hitWant = true;
      }
    };
    ps.update = (dt, busy) => {
      orig(dt, busy);
      const t = g.stats.simTime;
      const dist = p.foeDistance();
      if (D.phase === 'walk') {
        p.move.set(0, dist > GAP ? 0.5 : dist < GAP - 0.08 ? -0.4 : 0);
        p.stickY = p.move.y;
        if (Math.abs(dist - GAP) < 0.08) {
          D.wait += dt;
          if (D.wait > 0.6) {
            p.move.set(0, 0);
            p.stickY = 0;
            D.fx = p.handOffset.x;
            D.fy = p.handOffset.y;
            D.q = to(COMBO.from, 1.6, false);
            D.q.push(...Array(4).fill([0, 0, false]));
            for (const pt of COMBO.path) D.q.push(...to(pt, 4.5, true));
            D.q.push(...Array(10).fill([0, 0, false]));
            D.phase = 'combo';
          }
        } else D.wait = 0;
        return;
      }
      p.move.set(0, 0);
      if ((D.n++ & 1) === 0 && D.q.length) {
        const f = D.q.shift();
        u?._feed(f[0], f[1], FRAME, false);
        p.handOffset.x += f[0];
        p.handOffset.y += f[1];
        p.handHeld = f[2];
        if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) p.inputActive = true;
      }
      // 아래 칼은 빗나간 것으로 (도구 --ghostDown 과 같음): 제비 베기가 강화되기 전까지 내 칼 ↔ 상대 몸 안 부딪힘
      if (D.q.length && D.tTurn == null) p.instantGhost = Math.max(p.instantGhost ?? 0, 2);
      if (D.tTurn == null && u?.r?.e.name === 'tsubameGaeshi') D.tTurn = t;
      if (D.tTurn == null || D.want) return;
      if (D.hitWant) {
        D.hitWant = false;
        D.want = 'hit';
      } else if (D.k < STRIP.length && t - D.tTurn >= STRIP[D.k] - 1e-6) D.want = `s${D.k++}`;
      else if (D.k >= STRIP.length && !D.q.length && t - D.tTurn > 0.6) D.want = 'end';
      if (D.want) g.config.PHYSICS.maxStepsPerFrame = 0;
    };
  }, [STRIP, GAP]);
  const pngs = [];
  for (;;) {
    let k;
    try {
      k = await page.waitForFunction(() => window.drv.want, null, { timeout: +(process.env.SHOT_WAIT || 240000) }).then((h) => h.jsonValue());
    } catch {
      console.log(`시간 넘김 ${tag}`);
      break;
    }
    if (k === 'end') break;
    await page.waitForTimeout(200);
    const st = await page.evaluate(() => ({ t: +(window.game.stats.simTime - window.drv.tTurn).toFixed(3), kin: !!window.game.player.iai, gap: +window.game.player.foeDistance().toFixed(2) }));
    if (k === 'hit') {
      webp(await shot(page, `${tag}_hit_side`, 'side'));
      webp(await shot(page, `${tag}_hit_game`, 'game'));
      log.push(`${tag} hit ${JSON.stringify({ ...st, ...(await page.evaluate(() => window.drv.hit)) })}`);
    } else pngs.push(await shot(page, `${tag}_${k}`, 'side'));
    log.push(`${tag} ${k} ${JSON.stringify(st)}`);
    console.log(`SHOT ${tag} ${k} ${JSON.stringify(st)}`);
    await page.evaluate(() => {
      window.drv.want = null;
      window.game.config.PHYSICS.maxStepsPerFrame = 8;
    });
  }
  if (pngs.length) strip(pngs, `${tag}_strip`);
  log.push(`${tag} hits ${JSON.stringify(await page.evaluate(() => window.drv.hits))}`);
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/shots_log.txt`, [...log, ...errors.map((e) => 'ERR ' + e)].join('\n') + '\n');
console.log(log.join('\n'));
if (errors.length) console.log('오류', errors.slice(0, 5));
