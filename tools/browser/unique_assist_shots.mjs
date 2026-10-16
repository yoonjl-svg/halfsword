// 플레이어 고유 동작 (10/13 이어 주기 → 10/14 강화 — src/unique_assist.js · docs/strike/unique_player_2026-10-13.md) 브라우저 확인.
//  10/14: 테스트 경로는 기본 끔이라 test.html 경우엔 &uniqueAssist=1 을 붙인다. 긋기마다 걸음 수 · 이음(뒷몫) 수 · 긋기 끝 몸 덧씌우기(가슴 돌림 °)도 적는다.
//   PNG 는 손을 뗀 곧바로(SHOT_WAIT ms, 기본 0 — 걸음·몸 꼴이 남아 있을 때) 찍는다
//  실제 게임(index.html)을 띄워 터치 포인터 사건(pointerdown·move·up, pointerType 'touch')으로 긋는다 — 입력 길(input.js → main.js → 검술 층)이 그대로 돈다.
//  긋기 시작 자리에 손을 놓는 것만 game.player.handOffset 으로 한다(시험 편의). 상대 AI 는 멈춰 둔다(game.ai.update 비움).
//  주소 경우마다: 해금 단계 · 붙었나 · 긋기마다 발동한 고유 동작 · 내 기술 알림 칸(#techSlot) 글 · 발동했으면 PNG.
//   10/14 03:1x 부터 ② 는 마지막 기술이 계속 보인다(시간으로 안 사라짐) — 그래서 칸 글(cue)만으로는 이 긋기가 낸 알림인지 모른다.
//   cueNew = 이 긋기 동안 새 알림이 왔나(player.uniqueCue 가 바뀜). 안 걸린 긋기의 cue 는 앞 긋기의 기술이 남아 있는 것이다
//   (docs/ui/hud_type_system_2026-10-10.md §15)
//  실행: npx vite --port <빈 포트> --strictPort &   (5173·5174 는 쓰지 않는다)
//        node tools/browser/unique_assist_shots.mjs http://127.0.0.1:<포트> <PNG 폴더>
import { chromium } from 'playwright';
import fs from 'node:fs';
const base = process.argv[2] || 'http://127.0.0.1:5291';
const shotDir = process.argv[3] || '.';
fs.mkdirSync(shotDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const G = { tagR: [0.42, 0.42], tag: [0.02, 0.52], sideR: [0.52, 0.06], langort: [0.0, 0.03], pflugR: [0.18, -0.28], ochsR: [0.22, 0.26], tagL: [-0.4, 0.42], wechselR: [0.38, -0.44] };
// 긋기: 손을 놓을 패드 · 손가락이 갈 점들(패드 m) · 이름
const STROKES = {
  zornhau: { from: G.tagR, to: [[0.12, 0.14], [-0.4, -0.42]] },
  zwerch: { from: G.sideR, to: [[0.0, 0.1], [-0.52, 0.06]] },
  oberhauUp: { from: G.tag, to: [[0.0, 0.14], [0.0, -0.5], [0.02, 0.3]] },
  langortDown: { from: G.langort, to: [[0.02, -0.22]], v: 1 }, // 짧은 긋기: 소프트웨어 GL 프레임(≈100 ms)에서 4 m/s 면 한 프레임에 끝나 버린다 → 프레임당 0.1 m (게임 물리 시간으로는 휘두르기 문턱 위)
  zornhauL: { from: G.tagL, to: [[-0.1, 0.14], [0.38, -0.44]] },
  unterhau: { from: G.wechselR, to: [[0.04, -0.08], [-0.22, 0.26]] },
};
const CASES = [
  { label: 'test-longsword', q: '?test=1&weapon=longsword&uniqueAssist=1', strokes: ['zornhau', 'zwerch', 'oberhauUp'] },
  { label: 'test-zweihander', q: '?test=1&weapon=zweihander&playerSecret=0&uniqueAssist=1', strokes: ['oberhauUp', 'zwerch', 'unterhau'] }, // 이베리아 길목 준비(멀리 서 있으면 켜짐)가 긋기를 비기로 가져가지 않게 — 비기가 먼저인 것은 test-zweihander-secret
  { label: 'test-zweihander-secret', q: '?test=1&weapon=zweihander&uniqueAssist=1', strokes: ['oberhauUp'] },
  { label: 'test-uchigatana', q: '?test=1&weapon=uchigatana&playerSecret=0&uniqueAssist=1', strokes: ['zornhauL', 'langortDown'] },
  { label: 'test-default', q: '?test=1&weapon=longsword', strokes: ['zwerch'] }, // 테스트 경로 기본 = 끔 (10/14 02:0x)
  { label: 'main-stage4', q: '?weapon=longsword&uniqueStage=4', strokes: ['zornhau'] },
  { label: 'main-default', q: '?weapon=longsword', strokes: ['zornhau', 'zwerch'] },
  { label: 'main-stage3', q: '?weapon=longsword&uniqueStage=3', strokes: ['zornhau', 'zwerch'] }, // 10/16 인장 없앰: 전 '?clears=60'(독일 인장 둘 = 1·2 단계) → 고유자세 책까지(넷 모두 — 3 급 책 하나)
  { label: 'test-off', q: '?test=1&weapon=longsword&uniqueAssist=0', strokes: ['zornhau', 'zwerch'] },
];
const out = [];
const PIX = process.env.PIX === '1'; // 픽셀 모드(?pixel=1) — 소프트웨어 GL 프레임(≈100 ms)은 거의 줄지 않았다 (기본 끔)
for (const C of CASES) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(C.label)) continue;
  if (PIX) C.q += '&pixel=1';
  const ctx = await browser.newContext({ viewport: { width: 844, height: 420 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${base}/${C.q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight', null, { timeout: 90000 });
  await page.waitForFunction(() => window.game.stats.simTime > 2.4, null, { timeout: 180000 }); // 판 시작 정지 지나기
  const info = await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => {}; // 상대는 서 있기만
    const u = g.playerUnique;
    return { tradition: g.player.swordArt.tradition, stage: u?.stage ?? null, attached: !!g.player.skill.uniq, open: u?.list?.map((e) => e.name) ?? [] };
  });
  const row = { case: C.label, ...info, strokes: [], errors };
  for (const name of C.strokes) {
    const S = STROKES[name];
    await page.evaluate((from) => {
      const g = window.game;
      const p = g.player;
      const sk = p.skill;
      p.handOffset.set(from[0], from[1]);
      for (const v of [sk.prev, sk.anchor, sk.aim, sk.aimRaw]) v.set(from[0], from[1]);
      sk.aimVel.set(0, 0);
      sk.vel.set(0, 0);
      sk.follow.set(0, 0);
      sk.cutPending = false;
      sk.recovering = false;
      if (p.skill.uniq) p.skill.uniq.restPos = [from[0], from[1]];
    }, S.from);
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => ({ fired: { ...(window.game.playerUnique?.stats?.fired ?? {}) }, cueRef: window.game.player.uniqueCue?.t ?? null }));
    // 터치 긋기: 프레임마다 한 번 pointermove (게임이 읽는 프레임 시간 기준 4 m/s 패드) → 끝에서 잠깐 쥐고 뗌
    const frameMs = await page.evaluate(
      ({ pts, v }) =>
        new Promise((res) => {
          const cv = document.getElementById('game');
          const H = window.innerHeight;
          const scale = window.game.config.INPUT.touchSensitivity / Math.max(320, H);
          const gainY = 1.35; // 폰 touch 세로 이득 (mobile_intent.js 기본)
          let x = window.innerWidth * 0.6;
          let y = H * 0.5;
          const id = 77;
          const ev = (type) => new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true });
          cv.dispatchEvent(ev('pointerdown'));
          const p = window.game.player;
          let fx = p.handOffset.x;
          let fy = p.handOffset.y;
          let i = 0;
          let last = performance.now();
          let hold = 0;
          const dts = [];
          const tick = (now) => {
            const dt = Math.min(0.1, (now - last) / 1000);
            dts.push(now - last);
            last = now;
            if (i < pts.length) {
              const [tx, ty] = pts[i];
              const dx = tx - fx;
              const dy = ty - fy;
              const d = Math.hypot(dx, dy);
              const st = Math.min(d, v * Math.max(dt, 1 / 60));
              if (d > 1e-6) {
                fx += (dx / d) * st;
                fy += (dy / d) * st;
                x += ((dx / d) * st) / scale;
                y -= ((dy / d) * st) / scale / gainY;
                window.dispatchEvent(ev('pointermove'));
              }
              if (d - st < 1e-6) i++;
            } else if (++hold > 3) {
              window.dispatchEvent(ev('pointerup'));
              return res(dts.reduce((a, b) => a + b, 0) / dts.length);
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { pts: S.to, v: S.v ?? 4 },
    );
    const shotWait = +(process.env.SHOT_WAIT ?? 0);
    const early = shotWait >= 0 ? await page.screenshot({ path: `${shotDir}/_tmp.png` }).then(() => true) : false;
    const bodyEnd = await page.evaluate(() => {
      const ub = window.game.player.skill.uniqBody;
      return ub ? +((ub.chestYaw * 180) / Math.PI).toFixed(1) : 0;
    });
    await page.waitForTimeout(400);
    const r = await page.evaluate(({ fired: f0, cueRef }) => {
      const g = window.game;
      const u = g.playerUnique;
      const fired = Object.entries(u?.stats?.fired ?? {})
        .filter(([k, n]) => n > (f0[k] ?? 0))
        .map(([k]) => k);
      const el = [...document.querySelectorAll('#techSlot .slot')].find((e) => e.classList.contains('show'));
      const cueNew = (g.player.uniqueCue?.t ?? null) !== cueRef; // 이 긋기 동안 새 알림 (아니면 cue 는 앞 기술이 남은 것)
      return { fired, ends: u?.stats?.ends ?? {}, steps: u?.stats?.steps ?? 0, power: u?.stats?.power ?? 0, cueNew, cue: el ? { who: el.dataset.who, kind: el.dataset.kind, text: el.innerText.replace(/\s+/g, ' ').trim() } : null, techs: u?.stats?.techs ?? {} };
    }, before);
    let png = null;
    if (r.fired.length) {
      png = `${shotDir}/${C.label}_${name}.png`;
      if (early) fs.renameSync(`${shotDir}/_tmp.png`, png);
      else await page.screenshot({ path: png });
    }
    if (fs.existsSync(`${shotDir}/_tmp.png`)) fs.unlinkSync(`${shotDir}/_tmp.png`);
    row.strokes.push({ name, frameMs: +frameMs.toFixed(1), bodyEnd, ...r, png });
  }
  if (C.label === 'main-default') {
    await page.screenshot({ path: `${shotDir}/${C.label}_nofire.png` });
  }
  out.push(row);
  console.log(JSON.stringify(row));
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${shotDir}/unique_assist_shots${process.env.ONLY ? '_' + process.env.ONLY.replace(/,/g, '+') : ''}.json`, JSON.stringify(out, null, 1));
