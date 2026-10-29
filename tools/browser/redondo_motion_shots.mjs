// 풍차 베기(이베리아 B4) 감기 꼴 셋 브라우저 연속 그림 (사장님 10/29 20:0x '머리 위로 칼을 돌리는 동작이 너무 빠르고 조악 … 천천히 큰 동작으로 돌리거나 어깨에 얹는 고정 준비동작으로' ·
//  기록 docs/strike/redondo_hold_2026-10-29.md §8 · src/iberian_redondo.js windSpec). 읽기만 — 게임 값은 주소(?rdWind= · ?rdSteady=)로만 고른다.
//  테스트 경로(모든 칸)로 츠바이핸더를 들고 상대 AI 를 멈춰 내 앞 칼끝 거리 + GAP 자리로 옮긴 뒤, 칼 쪽 화면을 끌지 않고 누른 채(길게 누름) 감기 → 감기 꼴마다 정한 때에 뗌.
//  화면 시계를 늦춰(requestAnimationFrame · performance.now 를 __timeK 배 — 게임 코드는 그대로) 정한 때마다 시계를 거의 세우고 옆 · 3/4 두 눈으로 찍는다.
//  찍는 때: 누르기 전 · 감기 0.15 s · 섞기 끝 · (도는 꼴) 한 바퀴의 ¼ · ½ · ¾ / (어깨 꼴) 얹고 0.3 · 0.6 · 0.9 s · 감은 셈 1 넘겨 뗀 뒤 벰 첫 자리 · 벰 끝.
//  판 시작 5.5 s 뒤(정지 · 첫 자세 걸음 끝) · 비기 창(싱지르 무장)은 끔 · 손가락은 누른 채(게임과 같음 — handHeld)
//  낱장은 감기 꼴 × 눈마다 띠 그림 한 장으로 묶고(파이썬 PIL — redondo_motion_strip.py) 낱장은 지운다.
//  실행 (저장소 뿌리에서): npx vite --port 5397 --strictPort &
//        node tools/browser/redondo_motion_shots.mjs http://127.0.0.1:5397 [그림 폴더 (기본 docs/handoff/redondo_motion_2026-10-29)] [무기 (기본 zweihander)] [꼴들 (기본 spin,slowSpin,shoulder)]
//        FOE=인물 id (기본 isolde) · GAP=칼끝 거리 밖 몫 (기본 0.3 m) · STEADY=0 이면 휘청 고침 끔(?rdSteady=0 — 고치기 전 견줌) · TIMED=1 감기 시작부터 시각으로만 찍음(넘어져도) · KEEP=1 낱장 남김
//  844×390 · 끝 코드 0 = 콘솔 에러 0. 소프트웨어 GL 이라 느리다(꼴마다 1~3 분)
//  10/30 내려침 견줌 (사장님 00:1x '궤적이 8자 모양 … 바로 내려치는 게 아닌가?' · 기록 §8-9): 꼴에 ':내려침 길'을 붙이면(slowSpin:direct · slowSpin:chamber) ?rdRelease= 로 고름 ·
//   RELSHOTS=1 이면 감기 넷(섞기 끝 · 바퀴 ¼ · ½ · ¾) + 내려침 넷(드는 길 가운데 · 벰 첫 자리 · 벰 가운데 · 벰 끝) · SHOTS_JSON=적을 이름(기본 _shots.json) · 띠 그림 이름 redondo_release_<길>_<눈>.png
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const base = process.argv[2] || 'http://127.0.0.1:5397';
const dir = process.argv[3] || 'docs/handoff/redondo_motion_2026-10-29';
const weapon = process.argv[4] || 'zweihander';
const modes = (process.argv[5] || 'spin,slowSpin,shoulder').split(',');
const steady = process.env.STEADY ?? '1';
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox'] });
const errors = [];
const summary = [];
for (const mode of modes) {
  const [windMode, rel] = mode.split(':'); // 감기 꼴 · 내려침 길 (없으면 기본)
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
  page.on('pageerror', (e) => errors.push(`${mode} pageerror ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${mode} ${m.text()}`));
  await page.goto(`${base}/?test=1&weapon=${weapon}&foe=${process.env.FOE ?? 'isolde'}&stage=poseidon&slowMo=0&rdWind=${windMode}&rdSteady=${steady}${rel ? `&rdRelease=${rel}` : ''}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 120000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerUnique, null, { timeout: 120000 });
  await page.waitForFunction(() => window.game?.stats?.simTime > 5.5, null, { timeout: 400000 }); // 판 시작 정지 · 첫 자세 걸음이 끝난 뒤 (그 걸음 가운데 누르면 걸음 위에서 감기 시작)
  await page.waitForFunction(() => !document.getElementById('foeIntro')?.classList.contains('show'), null, { timeout: 120000 }).catch(() => {});
  const info = await page.evaluate((want) => {
    const g = window.game;
    g.settings.fpsCap = false;
    g.ai.update = () => g.enemy.move.set(0, 0);
    g.enemy.handOffset.set(0, -0.5);
    // 비기 창 끔 (멈춘 상대가 칼끝 거리 밖에 1.5 s 넘게 있으면 싱지르가 무장 — 그 창이 열린 동안은 길게 눌러도 감지 않음 · 이 그림은 감기만 봄)
    if (g.playerSecret) { g.playerSecret.update = () => {}; g.playerSecret.open = null; }
    const p = g.player, e = g.enemy;
    const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
    const fw = p.forward();
    const gap = p.swordArt.measure.reach + want;
    const dx = pc.x + fw.x * gap - ec.x, dz = pc.z + fw.z * gap - ec.z;
    for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
    const at = e.anchor.translation();
    e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
    if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]) { l[key].x += dx; l[key].z += dz; } }
    // 재기: 물리 스텝마다 (읽기만)
    const rec = (window.__rec = []);
    const step0 = p.step.bind(p);
    p.step = (dt) => {
      step0(dt);
      const W = p.rdWind, I = p.iai;
      const c = p.bodies.chest.rotation();
      const up = { x: 2 * (c.x * c.y - c.w * c.z), y: 1 - 2 * (c.x * c.x + c.z * c.z), z: 2 * (c.y * c.z + c.w * c.x) };
      // 내려침 몫 (10/30): 드는 이음(맞힘 없는 앞 토막들) · 벰 토막들 안 어디쯤 (0 ~ 1)
      let lf = null, cf = null;
      if (I?.moves?.[0]?.rd && I.segs?.length) {
        const c0 = Math.max(0, I.segs.findIndex((sg) => sg.cut));
        const LT = I.segs.slice(0, c0).reduce((a, sg) => a + sg.T, 0);
        const CT = I.segs.slice(c0).reduce((a, sg) => a + sg.T, 0);
        const e = I.t - (I.segT0 ?? 0);
        lf = LT > 0 ? e / LT : 1;
        cf = CT > 0 ? (e - LT) / CT : 1;
      }
      rec.push({ t: g.stats.simTime, w: W ? { t: W.t, k: W.k, turns: W.turns } : null, rd: !!I?.moves?.[0]?.rd, si: I?.si ?? null, cut: !!I?.segs?.[I?.si]?.cut, lf, cf, tip: p.tipVel.length(), tilt: (Math.acos(Math.max(-1, Math.min(1, up.y))) * 180) / Math.PI, st: p.stamina.value });
    };
    const U = g.playerUnique;
    return { holdE: U?.holdE?.name ?? null, mode: g.config.UNIQUE_ASSIST.rdWindMode, release: g.config.UNIQUE_ASSIST.rdRelease, steady: g.config.UNIQUE_ASSIST.rdSteady, reach: p.swordArt.measure.reach, tempo: g.tempo ?? 1.1 };
  }, +(process.env.GAP ?? 0.3));
  console.log(`${mode}: 길게 누름 ${info.holdE} · 꼴 ${info.mode} · 내려침 ${info.release} · 휘청 고침 ${info.steady} · 칼끝 거리 ${info.reach.toFixed(2)} m`);
  if (!info.holdE) throw new Error('풍차 베기가 열리지 않음 (테스트 경로 칸)');
  await page.waitForTimeout(300);
  const shots = [];
  const shoot = async (k, label) => {
    const k0 = await page.evaluate(() => { const k = window.__timeK; window.__timeK = 0.003; return k; });
    const r = await page.evaluate(() => window.__rec[window.__rec.length - 1]);
    const alive = await page.evaluate(() => !!window.game.player);
    if (!alive) throw new Error('판이 바뀜 (플레이어 없음)');
    for (const [view, place] of [['side', 0], ['q34', 1]]) {
      await page.evaluate((place) => {
        const g = window.game, f = g.player, o = g.enemy;
        const b = f.bodies.chest.translation(), a = o.bodies.chest.translation();
        let fx = a.x - b.x, fz = a.z - b.z;
        const L = Math.hypot(fx, fz) || 1;
        fx /= L; fz /= L;
        g.freeCam = true;
        if (place === 0) {
          // 옆 (칼 든 쪽 반대 — 왼쪽 옆 · 가슴 높이에서 조금 위) · 내 몸 가운데
          g.camera.position.set(b.x + fz * 3.3 + fx * 0.2, 1.6, b.z - fx * 3.3 + fz * 0.2);
          g.camera.lookAt(b.x + fx * 0.2, 1.45, b.z + fz * 0.2);
        } else {
          // 3/4 (앞 왼쪽 45° · 위에서)
          const s = Math.SQRT1_2;
          const vx = fx * s + fz * s, vz = fz * s - fx * s;
          g.camera.position.set(b.x + vx * 3.5, 2.1, b.z + vz * 3.5);
          g.camera.lookAt(b.x, 1.5, b.z);
        }
      }, place);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${dir}/_${mode}_${view}_${k}.png`, timeout: 180000 }); // 소프트웨어 GL · 바쁜 기계에선 30 s 를 넘기도 함
    }
    await page.evaluate(() => (window.game.freeCam = false));
    shots.push({ k, label, t: r?.t, w: r?.w, tilt: r?.tilt });
    console.log(`  SHOT ${k} ${label} · 감기 ${r?.w ? `t ${r.w.t.toFixed(2)} k ${r.w.k.toFixed(2)} 셈 ${r.w.turns.toFixed(2)}` : '-'} · 가슴 기울기 ${r?.tilt?.toFixed(1)}°`);
    await page.evaluate((k) => (window.__timeK = k), k0);
  };
  if (!process.env.RELSHOTS) await shoot(0, 'guard'); // 내려침 견줌은 감기 넷 · 내려침 넷만
  // 길게 누름 (칼 쪽 화면 · 끌지 않음)
  await page.evaluate(() => {
    const cv = document.getElementById('game');
    cv.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'touch', clientX: 640, clientY: 150, bubbles: true, isPrimary: true, button: 0 }));
  });
  await page.evaluate(() => (window.__timeK = 0.1));
  await page.waitForFunction(() => !!window.game.player.rdWind, null, { timeout: 120000, polling: 'raf' });
  const spec = await page.evaluate(() => { const W = window.game.player.rdWind; return { kind: W.M.kind, windIn: W.M.windIn, loopT: W.M.loopT, woundT: W.M.woundT }; });
  const atW = async (cond, arg) => page.waitForFunction(cond, arg, { timeout: 180000, polling: 'raf' });
  if (process.env.TIMED) {
    // 시각으로만 (휘청 고치기 전 견줌 — 넘어지면 감기가 그만둬져 감은 셈 · 벰을 기다릴 수 없음): 감기 시작부터 게임 초
    const t0 = await page.evaluate(() => window.game.stats.simTime);
    for (const [i, dt] of [[1, 0.15], [2, 0.3], [3, 0.45], [4, 0.6], [5, 0.8], [6, 1.05], [7, 1.4]]) {
      await atW((t) => window.game.stats.simTime >= t, t0 + dt);
      await shoot(i, `wind +${(dt / info.tempo).toFixed(2)}s`);
    }
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, pointerType: 'touch', clientX: 640, clientY: 150, bubbles: true, isPrimary: true, button: 0 })));
    const rec = await page.evaluate(() => window.__rec);
    const wind = rec.filter((r) => r.t >= t0 && r.t <= t0 + 1.4);
    const s = { mode, steady: info.steady, timed: true, tiltRange: +(Math.max(...wind.map((r) => r.tilt)) - Math.min(...wind.map((r) => r.tilt))).toFixed(1), tiltMax: +Math.max(...wind.map((r) => r.tilt)).toFixed(1), shots };
    summary.push(s);
    console.log(`SUMMARY ${mode} (시각): 가슴 기울기 최고 ${s.tiltMax}° · 폭 ${s.tiltRange}°`);
    await ctx.close();
    continue;
  }
  if (process.env.RELSHOTS) {
    // 내려침 견줌 (10/30): 감기 넷 → 한 바퀴 넘겨 뗌 → 드는 길 가운데 · 벰 첫 자리 · 벰 가운데 · 벰 끝
    await atW((t) => (window.game.player.rdWind?.t ?? 9) >= t, spec.windIn);
    const t0 = await page.evaluate(() => window.game.player.rdWind.turns);
    await shoot(1, 'circle');
    for (const [i, q] of [[2, 0.25], [3, 0.5], [4, 0.75]]) {
      await atW((m) => (window.game.player.rdWind?.turns ?? 99) >= m, t0 + q);
      await shoot(i, `circle +${q}`);
    }
    await atW(() => (window.game.player.rdWind?.turns ?? 9) >= 1.05);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, pointerType: 'touch', clientX: 640, clientY: 150, bubbles: true, isPrimary: true, button: 0 })));
    await atW(() => { const r = window.__rec[window.__rec.length - 1]; return r?.rd && (r.lf >= 0.5 || r.cut); });
    await shoot(5, 'release: lift');
    await atW(() => { const r = window.__rec[window.__rec.length - 1]; return r?.rd && r.cut; });
    await shoot(6, 'cut start');
    await atW(() => { const r = window.__rec[window.__rec.length - 1]; return !r?.rd || r.cf >= 0.5; });
    await shoot(7, 'mid cut');
    await atW(() => { const r = window.__rec[window.__rec.length - 1]; return !r?.rd; });
    await shoot(8, 'cut end');
    const rec = await page.evaluate(() => window.__rec);
    const strike = rec.filter((r) => r.rd);
    const tRel = strike[0]?.t;
    const tCut = strike.find((r) => r.cut)?.t;
    const wounds = await page.evaluate(() => (window.game.enemy.wounds ?? []).map((w) => `${w.part}:${(+w.severity).toFixed(2)}`));
    const s = { mode, wind: windMode, release: info.release, steady: info.steady, tag: `release_${info.release}`, liftSec: tRel != null && tCut != null ? +((tCut - tRel) / info.tempo).toFixed(3) : null, strikeSec: strike.length ? +((strike.at(-1).t - strike[0].t) / info.tempo).toFixed(3) : null, tipStrikeMax: +Math.max(...strike.map((r) => r.tip)).toFixed(1), tiltStrikeMax: +Math.max(...strike.map((r) => r.tilt)).toFixed(1), wounds, shots };
    summary.push(s);
    console.log(`SUMMARY ${mode}: 뗌 → 벰 ${s.liftSec} s · 내려침 ${s.strikeSec} s · 칼끝 최고 ${s.tipStrikeMax} m/s · 가슴 기울기 최고 ${s.tiltStrikeMax}° · 상대 상처 ${wounds.join(' ') || '없음'}`);
    await ctx.close();
    continue;
  }
  await atW((t) => (window.game.player.rdWind?.t ?? 9) >= t, 0.15);
  await shoot(1, 'wind 0.15s');
  await atW((t) => (window.game.player.rdWind?.t ?? 9) >= t, spec.windIn);
  await shoot(2, 'blend end');
  if (spec.kind === 'spin') {
    const t0 = await page.evaluate(() => window.game.player.rdWind.turns);
    for (const [i, q] of [[3, 0.25], [4, 0.5], [5, 0.75]]) {
      await atW((m) => (window.game.player.rdWind?.turns ?? 99) >= m, t0 + q);
      await shoot(i, `turn +${q}`);
    }
  } else {
    for (const [i, dt] of [[3, 0.3], [4, 0.6], [5, 0.9]]) {
      await atW((t) => (window.game.player.rdWind?.t ?? 9) >= t, spec.windIn + dt);
      await shoot(i, `rest +${dt}s`);
    }
  }
  // 한 바퀴(감은 셈 1) 넘긴 뒤 뗌
  await atW(() => (window.game.player.rdWind?.turns ?? 9) >= 1.05);
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, pointerType: 'touch', clientX: 640, clientY: 150, bubbles: true, isPrimary: true, button: 0 })));
  await atW(() => { const r = window.__rec[window.__rec.length - 1]; return r?.rd && r.cut; });
  await shoot(6, 'strike');
  await atW(() => { const r = window.__rec[window.__rec.length - 1]; return !r?.rd; });
  await shoot(7, 'strike end');
  const rec = await page.evaluate(() => window.__rec);
  const wind = rec.filter((r) => r.w);
  const strike = rec.filter((r) => r.rd);
    const s = { mode, steady: info.steady, windSec: wind.length ? +((wind.at(-1).t - wind[0].t) / info.tempo).toFixed(2) : null, tipWindMax: +Math.max(...wind.filter((r) => r.w.k >= 1).map((r) => r.tip)).toFixed(1), tipBlendMax: +Math.max(...wind.filter((r) => r.w.k < 1).map((r) => r.tip)).toFixed(1), tiltRange: +(Math.max(...wind.map((r) => r.tilt)) - Math.min(...wind.map((r) => r.tilt))).toFixed(1), tipStrikeMax: +Math.max(...strike.map((r) => r.tip)).toFixed(1), drain: +(wind[0].st - wind.at(-1).st).toFixed(1), shots };
  const wounds = await page.evaluate(() => (window.game.enemy.wounds ?? []).map((w) => `${w.part}:${(+w.severity).toFixed(2)}`));
  s.wounds = wounds;
  summary.push(s);
  console.log(`SUMMARY ${mode}: 감기 칼끝 최고 ${s.tipWindMax} m/s · 섞는 동안 ${s.tipBlendMax} · 가슴 기울기 폭 ${s.tiltRange}° · 벰 칼끝 최고 ${s.tipStrikeMax} · 감는 기력 ${s.drain} · 상대 상처 ${wounds.join(' ') || '없음'}`);
  await ctx.close();
}
await browser.close();
const shotsJson = process.env.SHOTS_JSON || '_shots.json';
fs.writeFileSync(`${dir}/${shotsJson}`, JSON.stringify({ weapon, steady, summary }, null, 1));
// 띠 그림 (감기 꼴 × 눈 — 낱장 8 장씩)
execFileSync(process.env.PYTHON || '/usr/bin/python3', ['tools/browser/redondo_motion_strip.py', dir, modes.join(','), steady === '0' ? 'nofix' : '', shotsJson], { stdio: 'inherit' });
if (!process.env.KEEP) for (const f of fs.readdirSync(dir)) if (/^_.*\.png$/.test(f)) fs.unlinkSync(`${dir}/${f}`);
if (errors.length) {
  console.log(`콘솔 에러 ${errors.length}:\n${errors.slice(0, 10).join('\n')}`);
  process.exit(1);
}
