// 사람 고노센 준비 웅크림 그림 (사장님 10/25 23:0x '플레이어도 고노센 준비가 되면 웅크리게 해.' — SECRET.gnsCrouch · src/secret_instant.js iaiReadyPosePlayer ·
//  docs/strike/school_secret_2026-10-09.md §19). 게임 함수 그대로 — 상대 AI 만 멈춰 세운다(그림용 과녁). 폰 가로 844 × 390 · 게임 카메라 + 옆 카메라.
//  장면: ① 준비 전(서서 기다림) ② 준비 · 손을 쉼(웅크림 · 칼 왼 허리 — 화면 '고노센 준비') ③ 준비된 채 옆으로 걷기(웅크림 그대로) ④ 준비된 채 손가락으로 칼을 끔(손은 사람 것 · 몸은 웅크림)
//   ⑤ ?gnsCrouch=0 (전 판 — 표시만). 장마다 몸 웅크림 무게 iaiReadyW · 손 덧씌우기 thrustPose.w · 골반 높이 · 화면 안 몸 자리(머리 · 발 · 칼끝 px)를 적는다.
//  실행 (저장소 뿌리에서): npx vite build && npx vite preview --port 5590 --strictPort --host 127.0.0.1 &
//        node tools/browser/gonosen_crouch_shots.mjs http://127.0.0.1:5590 [그림 폴더 — 기본 docs/handoff/gonosen_crouch_2026-10-25]
//  내놓는 것: crouch_sheet.webp(다섯 장 · 게임 카메라) · crouch_side.webp(옆 카메라 셋) · crouch.json. 끝 코드 0 = 콘솔 에러 0 · 웅크림 무게가 맞음
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = (process.argv[2] || 'http://127.0.0.1:5590').replace(/\/$/, '');
const dir = process.argv[3] || 'docs/handoff/gonosen_crouch_2026-10-25';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errors = [];
const report = {};
const shots = { game: [], side: [] };

async function open(extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.goto(`${base}/?test=1&weapon=monohoshizao&hero=player&foe=isolde&stage=poseidon${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret?.S, null, { timeout: 120000 });
  // 그림용 과녁: 상대 AI 를 멈춰 세움 (발 0 · 칼 그대로) — 사람 몸 · 준비 셈은 게임 그대로
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => { g.enemy.move.set(0, 0); g.enemy.stickX = g.enemy.stickY = 0; };
  });
  await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
  return page;
}
const probe = (page) =>
  page.evaluate(() => {
    const g = window.game, p = g.player, T = g.THREE;
    const px = (v) => { const q = new T.Vector3(v.x, v.y, v.z).project(g.camera); return [Math.round(((q.x + 1) / 2) * innerWidth), Math.round(((1 - q.y) / 2) * innerHeight)]; };
    const head = p.bodies.head.translation(), pel = p.bodies.pelvis.translation(), tip = p.bladePoint(1, new T.Vector3());
    const feet = ['footL', 'footR'].map((k) => p.bodies[k]?.translation()).filter(Boolean);
    return {
      sim: +g.stats.simTime.toFixed(2), armed: !!g.playerSecret.iaiArm.armed, crouchW: +(p.iaiReadyW ?? 0).toFixed(2), handW: +p.skill.thrustPose.w.toFixed(2),
      pelvisY: +pel.y.toFixed(3), d: +p.foeDistance().toFixed(2),
      px: { head: px(head), tip: px(tip), feet: feet.map(px) },
      cue: [...document.querySelectorAll('.tech-cue, #techCue, [data-kind=secretArm]')].map((e) => e.textContent.trim()).filter(Boolean).slice(0, 2),
    };
  });
const waitFor = async (page, pred, ms) => {
  const t0 = Date.now();
  let r = await probe(page);
  while (!pred(r) && Date.now() - t0 < ms) {
    await page.waitForTimeout(100);
    r = await probe(page);
  }
  return r;
};
const sideShot = async (page, name) => {
  await page.evaluate(() => {
    const g = window.game, a = g.player.bodies.chest.translation(), b = g.enemy.bodies.chest.translation();
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    g.freeCam = true;
    g.camera.position.set(a.x - (dz / L) * 2.6 + (dx / L) * 0.6, 1.25, a.z + (dx / L) * 2.6 + (dz / L) * 0.6);
    g.camera.lookAt(a.x + (dx / L) * 0.6, 0.95, a.z + (dz / L) * 0.6);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/_${name}.png` });
  shots.side.push(name);
  await page.evaluate(() => (window.game.freeCam = false));
  await page.waitForTimeout(150);
};
const gameShot = async (page, name, label) => {
  await page.screenshot({ path: `${dir}/_${name}.png` });
  shots.game.push([name, label]);
};

{
  const page = await open();
  // ① 준비 전: 판 시작 카메라가 자리 잡은 뒤(게임 시간 2.6 s) 칼을 한 번 천천히 옮겨 준비 셈을 0 으로 — 웅크리기 전 서 있는 모습
  await waitFor(page, (x) => x.sim > 2.6, 240000);
  await page.evaluate(() => { window.game.player.stickY = 0; window.game.playerSecret.iaiArm.consume(); });
  await waitFor(page, (x) => x.crouchW === 0 && !x.armed, 60000); // 웅크림이 다 풀린 뒤 (gnsCrouchOut) — 다시 쌓이기 전(2 s)
  report.before = await probe(page);
  await gameShot(page, 'g1_before', '① 준비 전 (서 있음)');
  let r = await waitFor(page, (x) => x.armed && x.crouchW > 0.98 && x.handW > 0.98, 240000);
  report.ready = r;
  await gameShot(page, 'g2_ready', `② 준비 · 손 쉼 (웅크림 ${r.crouchW} · 손 ${r.handW})`);
  await sideShot(page, 's2_ready');
  // ③ 준비된 채 옆으로 걷기 (D — 스틱 오른쪽)
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  r = await probe(page);
  report.walk = r;
  await gameShot(page, 'g3_walk', `③ 준비된 채 걷기 (준비 ${r.armed ? '유지' : '풀림'} · 웅크림 ${r.crouchW})`);
  await sideShot(page, 's3_walk');
  await page.keyboard.up('KeyD');
  await page.waitForTimeout(600);
  // ④ 손가락으로 칼을 천천히 끔 (휘두름 문턱 아래) — 손은 사람 것 · 몸 웅크림 · 준비 그대로.
  //  소프트웨어 GL 은 화면 한 장이 길어(벽 시계 수백 ms) 진짜 손가락 끌기는 한 물리 스텝에 몰려 휘두름이 된다 → 물리 스텝마다 손 목표를 조금씩(0.3 m/s) 옮기는 사람 흉내로
  await page.evaluate(() => {
    const g = window.game, ps = g.playerSecret, orig = ps.update.bind(ps);
    window.__steer = 0;
    ps.update = (dt, busy) => {
      const p = g.player;
      if (window.__steer > 0) { window.__steer -= dt; p.handOffset.x += 0.12 * dt; p.handOffset.y += 0.28 * dt; p.inputActive = true; p.handHeld = true; }
      orig(dt, busy);
    };
    window.__steer = 0.8;
  });
  await page.waitForFunction(() => !(window.__steer > 0), null, { timeout: 120000 });
  r = await probe(page);
  report.steer = r;
  await gameShot(page, 'g4_steer', `④ 칼을 끔 (준비 ${r.armed ? '유지' : '풀림'} · 웅크림 ${r.crouchW} · 손 ${r.handW})`);
  await sideShot(page, 's4_steer');
  await page.context().close();
}
{
  const page = await open('&gnsCrouch=0');
  const r = await waitFor(page, (x) => x.armed && x.sim > report.ready.sim, 240000); // 같은 게임 시간 언저리(카메라 같은 자리)에서
  report.off = await probe(page);
  await gameShot(page, 'g5_off', `⑤ ?gnsCrouch=0 (전 판 — 표시만 · 준비 ${r.armed ? '됨' : '안 됨'})`);
  await page.context().close();
}
await browser.close();

// 그림 묶기 (PIL — 이름표 · 한 장)
const py = `
import sys, json
from PIL import Image, ImageDraw, ImageFont
d = sys.argv[1]; spec = json.loads(sys.argv[2])
def font(sz):
    for p in ['/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc']:
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
F = font(18)
def sheet(items, out, cols):
    ims = [Image.open(f"{d}/_{n}.png").convert('RGB') for n, _ in items]
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    S = Image.new('RGB', (w * cols, (h + 30) * rows), (16, 16, 18))
    dr = ImageDraw.Draw(S)
    for i, (im, (n, lab)) in enumerate(zip(ims, items)):
        x, y = (i % cols) * w, (i // cols) * (h + 30)
        S.paste(im, (x, y + 30)); dr.text((x + 8, y + 5), lab, fill=(235, 235, 235), font=F)
    S.save(f"{d}/{out}", 'WEBP', quality=80, method=6)
sheet(spec['game'], 'crouch_sheet.webp', 2)
sheet([(n, n) for n in spec['side']], 'crouch_side.webp', 3)
`;
execFileSync('python3', ['-I', '-c', py, dir, JSON.stringify(shots)], { stdio: 'inherit' });
for (const n of [...shots.game.map((g) => g[0]), ...shots.side]) fs.rmSync(`${dir}/_${n}.png`, { force: true });
fs.writeFileSync(`${dir}/crouch.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
const ok = report.ready?.crouchW > 0.98 && report.ready?.handW > 0.98 && report.walk?.armed && report.walk?.crouchW > 0.9 && report.steer?.handW === 0 && report.steer?.crouchW > 0.9 && !(report.off?.crouchW > 0);
console.log(errors.length ? `콘솔 에러 ${errors.length}\n  ${errors.join('\n  ')}` : '콘솔 에러 0', ok ? 'PASS' : 'FAIL (웅크림 무게)');
process.exit(errors.length || !ok ? 1 : 0);
