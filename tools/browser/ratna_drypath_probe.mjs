// ─────────────────────────────────────────────────────────────
//  ratna_drypath_probe.mjs — 라트나 '마른 길을 아는 AI' 브라우저 측정 (docs/import/ratna_drypath_2026-10-14.md §4-2)
//   테스트 경로 그대로: index.html?test=1&weapon=longsword&hero=player&foe=<인물>&stage=<무대> · 헤드리스 · 화면 배율 1
//  실행: 개발 서버를 띄운 뒤  node tools/browser/ratna_drypath_probe.mjs <주소> <출력 폴더> <갈래> [시드…]
//   갈래 dry    라트나 · 잠든 습지: 같은 시드로 전(AI 의 표식만 뺌 — 노드 대조 C 로 옛 길과 결정이 같음을 본 판) / 후. 플레이어 POL=still|circle · SECS 초(기본 40)
//               (circle = 라트나가 2.3 m 안이면 물러나고 3.4 m 밖이면 다가가며 늘 오른쪽 옆걸음 0.5 — 플레이어 스틱을 move.set 에서 바꿔 친다)
//   갈래 same   결정 흔적 해시: ① 같은 판 두 번(결정적인가) ② 라트나 · 기본 무대 표식 있음/뺌 ③ 하인리히 · 잠든 습지 ④ 라트나 · 잠든 습지 전/후(달라야 함) — SAME_SECS 초
//   갈래 shots  그림: 후 판에서 '라트나 발밑 젖음 0 · 상대 발밑 젖음 > 0.5 · 거리 < 3.2 m · 공격 꼴 아님'인 순간 물리를 멈추고 경기 카메라 그대로 찍는다 (SW×SH, NSHOT 장)
//  결정적으로: 판을 여는 같은 자바스크립트 차례 안에서 Math.random 을 시드로 바꾸고, requestAnimationFrame 시각을 가짜 시계(한 화면 = STEP_MS)로 넘긴다.
//   한 화면 물리 스텝 상한만 STEPS_CAP 으로 올린다(고정 스텝·스텝 차례는 그대로 — 그리기를 덜 해 빨리 돈다). 판 시작 정지 2 s 는 빼고 센다
//  playwright 는 저장소 의존성에 없다. 크롬 경로는 PW_CHROMIUM (기본 /opt/pw-browsers/chromium)
// ─────────────────────────────────────────────────────────────
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const base = (process.argv[2] || 'http://127.0.0.1:5173').replace(/\/$/, '');
const out = process.argv[3] || path.join(tmpdir(), 'ratna_drypath');
const mode = process.argv[4] || 'dry';
const seeds = process.argv.slice(5).map(Number).filter(Boolean);
const POL = process.env.POL || 'still';
const SECS = +(process.env.SECS || 40);
const STEP_MS = +(process.env.STEP_MS || 100); // 가짜 시계 한 화면 (100 ms — main.js 가 dt 를 0.1 s 에서 자른다 · 템포 1.1 → 물리 0.11 s, 스텝 상한은 아래 STEPS_CAP 으로 올림)
const VIEW = { width: +(process.env.W || 640), height: +(process.env.H || 360) };
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function openPage(foe, stage, viewport = VIEW) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.addInitScript((stepMs) => {
    const real = window.requestAnimationFrame.bind(window);
    let vt = 0, lastReal = null;
    window.requestAnimationFrame = (cb) => real((t) => { if (t !== lastReal) { lastReal = t; vt += stepMs; } cb(vt); });
  }, STEP_MS);
  await page.goto(`${base}/index.html?test=1&weapon=longsword&hero=player&foe=${foe}&stage=${stage}&emo=0`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword && document.getElementById('btnStart'), null, { timeout: 600000 });
  await page.evaluate(async (cap) => {
    window.__wet = (await import('/src/wetland_ground.js')).wetlandWetness;
    window.game.config.PHYSICS.maxStepsPerFrame = cap; // 한 화면에 물리 스텝을 더 (고정 스텝·차례는 그대로 — 그리기만 덜 한다)
  }, +(process.env.STEPS_CAP || 24));
  return page;
}

/** 판 하나를 시드로 연다: 같은 자바스크립트 차례 안에서 시드 → 시작 단추 → (표식 뺌) → 정책·기록 갈고리 */
async function startRound(page, { seed, flagOff, policy, limit = 1e9 }) {
  await page.evaluate(({ seed, flagOff, policy, limit }) => {
    let a = seed >>> 0;
    Math.random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const btn = document.getElementById('btnStart');
    btn.click();
    const g = window.game, ai = g.ai, P = g.player, E = g.enemy, wet = window.__wet;
    if (flagOff) ai.persona = { ...ai.persona, terrainSense: undefined }; // 전: 표식만 뺀 같은 AI (노드 대조 C — HEAD 와 결정 흔적이 같다)
    const R = (window.__rec = { t: 0, n: 0, wetR: 0, wetP: 0, hiR: 0, hiP: 0, nearT: 0, touchT: 0, stuck: 0, stuckT: 0, flips: 0, nearMoveT: 0, back: 0, dist: 0, hash: 0, slowT: 0, prev: null, sense: ai.drySense, path: [] });
    // 정해진 플레이어 입력 (스틱): still = 가만히 · circle = 라트나가 2.3 m 안이면 물러나고 3.4 m 밖이면 다가가며 늘 오른쪽 옆걸음 0.5
    const mv = P.move, set0 = mv.set.bind(mv);
    mv.set = () => {
      const p = P.bodies.pelvis.translation(), e = E.bodies.pelvis.translation(), d = Math.hypot(e.x - p.x, e.z - p.z);
      const fy = policy === 'circle' ? (d < 2.3 ? -0.8 : d > 3.4 ? 0.5 : 0) : 0;
      const fx = policy === 'circle' ? 0.5 : 0;
      return set0(P.alive ? fx : 0, P.alive ? fy : 0);
    };
    const DT = g.config.PHYSICS.timestep, hold = g.config.ARENA.startHold;
    const up = ai.update.bind(ai);
    let simT = 0;
    ai.update = (dt) => {
      up(dt);
      simT += dt;
      if (!P.alive || !E.alive || simT < hold || R.t >= limit - 1e-9) return;
      const pe = E.bodies.pelvis.translation(), pp = P.bodies.pelvis.translation();
      const wr = wet(pe.x, pe.z), wp = wet(pp.x, pp.z);
      R.t += DT; R.n++;
      R.wetR += wr * DT; R.wetP += wp * DT;
      if (wr > 0.3) R.hiR += DT;
      if (wp > 0.3) R.hiP += DT;
      const dx = pp.x - pe.x, dz = pp.z - pe.z, dd = Math.hypot(dx, dz) || 1e-6;
      let b = 0; for (const k of [0.8, 1.6, 2.4]) b += wet(pp.x + (dx / dd) * k, pp.z + (dz / dd) * k) / 3;
      R.back += b * DT; R.dist += dd * DT;
      const rb = Math.hypot(pe.x, pe.z), m = Math.hypot(E.move.x, E.move.y);
      if (rb < 1.8) {
        R.nearT += DT; if (rb < 1.25) R.touchT += DT;
        const v = E.bodies.pelvis.linvel();
        if (m > 0.3 && E.state === 'stand') {
          R.nearMoveT += DT;
          if (Math.hypot(v.x, v.z) < 0.15) { R.slowT += DT; if (R.slowT >= 0.5 && R.slowT - DT < 0.5) R.stuck++; if (R.slowT >= 0.5) R.stuckT += DT; } else R.slowT = 0;
          if (R.prev && R.prev[0] * E.move.x + R.prev[1] * E.move.y < 0) R.flips++;
        } else R.slowT = 0;
      } else R.slowT = 0;
      R.prev = m > 0.2 ? [E.move.x, E.move.y] : null;
      if (R.n % 12 === 0) R.path.push([+pe.x.toFixed(2), +pe.z.toFixed(2), +pp.x.toFixed(2), +pp.z.toFixed(2)]);
      // 결정 흔적 (스틱 · 손 목표 · 꼴) — 같은 판인지 견줄 때
      const s = `${E.move.x.toFixed(6)},${E.move.y.toFixed(6)},${E.handOffset.x.toFixed(6)},${E.handOffset.y.toFixed(6)},${ai.mode},${ai.phase};`;
      let h = R.hash | 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; R.hash = h;
    };
  }, { seed, flagOff, policy, limit });
}

/** 판 끝 또는 SECS 초까지 (판이 끝나면 다음 판을 같은 시드 +1 로 이어 연다) — 합친 기록 */
async function runFor(page, opts, secs = SECS) {
  const tot = { t: 0, wetR: 0, wetP: 0, hiR: 0, hiP: 0, nearT: 0, touchT: 0, stuck: 0, stuckT: 0, flips: 0, nearMoveT: 0, back: 0, dist: 0, attacks: 0, aborted: 0, landed: 0, rounds: 0, hashes: [], senses: [], path: [], wounds: { P: 0, E: 0 } };
  let r = 0;
  while (tot.t < secs - 0.05) {
    const left = secs - tot.t;
    await startRound(page, { ...opts, seed: opts.seed * 100 + r, limit: left });
    r++;
    await page.waitForFunction((left) => { const R = window.__rec, g = window.game; return R.t >= left - 1e-6 || !g.player.alive || !g.enemy.alive || g.state !== 'fight'; }, left, { timeout: 3600000, polling: 200 });
    const rec = await page.evaluate(() => { const R = window.__rec, g = window.game; return { ...R, prev: null, attacks: g.ai.stats.attacks, aborted: g.ai.stats.aborted, landed: g.ai.stats.landed, wP: g.player.wounds?.length ?? 0, wE: g.enemy.wounds?.length ?? 0 }; });
    for (const k of ['t', 'wetR', 'wetP', 'hiR', 'hiP', 'nearT', 'touchT', 'stuck', 'stuckT', 'flips', 'nearMoveT', 'back', 'dist', 'attacks', 'aborted', 'landed']) tot[k] += rec[k];
    tot.rounds++; tot.hashes.push((rec.hash >>> 0).toString(16)); tot.senses.push(rec.sense); tot.path.push(rec.path);
    tot.wounds.P += rec.wP; tot.wounds.E += rec.wE;
    // 판이 끝났으면 결과 메뉴가 뜰 때까지 조금 — 시작 단추가 다시 보이면 다음 판
    if (tot.t < secs - 0.05) await page.waitForFunction(() => window.game.state !== 'fight' || !window.game.player.alive || !window.game.enemy.alive, null, { timeout: 60000 });
    if (tot.t < secs - 0.05) await page.waitForFunction(() => { const b = document.getElementById('btnStart'); return b && b.offsetParent !== null; }, null, { timeout: 120000 });
  }
  return tot;
}
const fmt = (S) => `라트나 젖음 평균 ${(S.wetR / S.t).toFixed(3)} · >0.3 ${((100 * S.hiR) / S.t).toFixed(1)} % | 상대 젖음 평균 ${(S.wetP / S.t).toFixed(3)} · >0.3 ${((100 * S.hiP) / S.t).toFixed(1)} % · 등 뒤 ${(S.back / S.t).toFixed(3)} · 거리 ${(S.dist / S.t).toFixed(2)} | 공격 ${S.attacks} (거둠 ${S.aborted} · 칼 나감 ${S.attacks - S.aborted} · 맞힘 ${S.landed}) · 판 ${S.rounds} | 석상 1.8 m 안 ${S.nearT.toFixed(1)} s · 1.25 m 안 ${S.touchT.toFixed(1)} s · 끼임 ${S.stuck} 번 ${S.stuckT.toFixed(1)} s · 떨림 ${S.flips} 번 (밀며 근처 ${S.nearMoveT.toFixed(1)} s) | 세기 ${S.senses.join(',')} · 흔적 ${S.hashes.join(',')}`;

if (mode === 'dry') {
  const page = await openPage('ratna', 'sluice');
  const res = { off: [], on: [] };
  for (const seed of seeds.length ? seeds : [1, 2, 3]) {
    for (const [k, flagOff] of [['off', true], ['on', false]]) {
      const t0 = Date.now();
      const S = await runFor(page, { seed, flagOff, policy: POL });
      res[k].push(S);
      console.log(`시드 ${seed} ${k === 'off' ? '전' : '후'} ${S.t.toFixed(1)} s (${((Date.now() - t0) / 1000).toFixed(0)} s 걸림): ${fmt(S)}`);
    }
  }
  for (const k of ['off', 'on']) {
    const A = res[k].reduce((a, S) => { for (const key of Object.keys(S)) if (typeof S[key] === 'number') a[key] = (a[key] ?? 0) + S[key]; a.hashes.push(...S.hashes); a.senses.push(...S.senses); return a; }, { hashes: [], senses: [] });
    console.log(`합 ${k === 'off' ? '전' : '후'} ${A.t.toFixed(1)} s: ${fmt(A)}`);
  }
  writeFileSync(`${out}/dry_${POL}.json`, JSON.stringify(res));
  await page.close();
}
if (mode === 'same') {
  const secs = +(process.env.SAME_SECS || 20);
  const rows = [];
  const once = async (foe, stage, flagOff, seed = 7) => { const page = await openPage(foe, stage); const S = await runFor(page, { seed, flagOff, policy: POL }, secs); await page.close(); return S; };
  const a1 = await once('ratna', 'sluice', false), a2 = await once('ratna', 'sluice', false);
  rows.push(`① 라트나 · 습지 · 같은 판 두 번: ${a1.hashes.join(',')} / ${a2.hashes.join(',')} → ${a1.hashes.join() === a2.hashes.join() ? '같음' : '다름'} (세기 ${a1.senses.join(',')})`);
  const b1 = await once('ratna', 'arena', false), b2 = await once('ratna', 'arena', true);
  rows.push(`② 라트나 · 기본 무대(arena) · 표식 있음/뺌: ${b1.hashes.join(',')} / ${b2.hashes.join(',')} → ${b1.hashes.join() === b2.hashes.join() ? '같음' : '다름'} (세기 ${b1.senses.join(',')} · 공격 ${b1.attacks}/${b2.attacks})`);
  const c1 = await once('heinrich', 'sluice', false), c2 = await once('heinrich', 'sluice', true);
  rows.push(`③ 하인리히 · 습지 · 그대로/표식 칸 지움: ${c1.hashes.join(',')} / ${c2.hashes.join(',')} → ${c1.hashes.join() === c2.hashes.join() ? '같음' : '다름'} (세기 ${c1.senses.join(',')} · 공격 ${c1.attacks}/${c2.attacks})`);
  const d1 = await once('ratna', 'sluice', true);
  rows.push(`④ 라트나 · 습지 · 표식 뺌(전) 흔적 ${d1.hashes.join(',')} ↔ 표식 있음(후) ${a1.hashes.join(',')} → ${d1.hashes.join() === a1.hashes.join() ? '같음' : '다름'} (켜진 판만 달라야 한다)`);
  console.log(rows.join('\n'));
}
if (mode === 'shots') {
  // 경기 카메라 그대로 — 후(마른 길 켬)에서 '라트나 마른 땅(젖음 0) · 상대 웅덩이(젖음 > 0.5) · 거리 < 3.2 m' 인 순간에 멈춰 찍는다
  let shot = 0;
  for (const seed of seeds.length ? seeds : [1, 2, 3, 4, 5, 6]) {
    const page = await openPage('ratna', 'sluice', { width: +(process.env.SW || 960), height: +(process.env.SH || 540) });
    await startRound(page, { seed: seed * 100, flagOff: false, policy: process.env.SHOT_POL || 'circle' });
    const found = await page.waitForFunction(() => { const g = window.game, w = window.__wet; if (!g.player.alive || !g.enemy.alive || window.__rec.t > 38) return 'end'; const pe = g.enemy.bodies.pelvis.translation(), pp = g.player.bodies.pelvis.translation(); const d = Math.hypot(pe.x - pp.x, pe.z - pp.z); return w(pp.x, pp.z) > 0.5 && w(pe.x, pe.z) === 0 && d < 3.2 && window.__rec.t > 3 && g.ai.mode !== 'attack' ? 'hit' : false; }, null, { timeout: 1800000, polling: 'raf' }).then((h) => h.jsonValue());
    if (found === 'hit') {
      await page.evaluate(() => { const g = window.game; g.world.step = () => {}; g.ai.update = () => {}; });
      await page.waitForTimeout(400);
      const info = await page.evaluate(() => { const g = window.game, w = window.__wet, pe = g.enemy.bodies.pelvis.translation(), pp = g.player.bodies.pelvis.translation(); return { t: +window.__rec.t.toFixed(1), ratna: [+pe.x.toFixed(2), +pe.z.toFixed(2), +w(pe.x, pe.z).toFixed(2)], player: [+pp.x.toFixed(2), +pp.z.toFixed(2), +w(pp.x, pp.z).toFixed(2)] }; });
      await page.screenshot({ path: `${out}/shot_${seed}.png` });
      console.log('shot', seed, JSON.stringify(info));
      shot++;
    }
    await page.close();
    if (shot >= +(process.env.NSHOT || 3)) break;
  }
}
console.log(errors.length ? `오류 ${errors.length}:\n${[...new Set(errors)].slice(0, 20).join('\n')}` : '콘솔 오류 0 · HTTP 400 이상 0');
await browser.close();
