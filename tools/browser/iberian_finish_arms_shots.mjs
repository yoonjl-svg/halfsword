// 이베리아 마무리 공격 팔 관절 그림 (10/24 13:2x 사장님 '이베리아 마무리 공격도 팔 관절이 이상하게 꺾이지 않는지 확인해봐' — docs/strike/iberian_finish_arms_2026-10-24.md). 읽기만.
//  MOVE=spin  : 싱지르를 곧장 낸다(skill.secret — 공격 원과 같은 대본) · 멈춘 상대(칼 충돌 끔)를 칼끝 거리 + 0.3 m 에 · 단계(먼저 감기 · 감기 · 감은 채 · 놓음 · 받아 멈춤 · 따라 지나감 · 굳음)마다 찍음
//  MOVE=cleave: 상대를 쓰러뜨려(누움 — KNEEL=1 이면 무릎 꿇음) 1.1 m 앞에 두고 탭(skill.thrust) → 쪼개 내려치기(들기 · 힘 모으기 · 내려치기 · 끝)
//  칸마다 두 그림: 위 = 게임 카메라 · 아래 = 가까운 카메라(지금 몸 방향 기준 칼 든 쪽 앞 45° · 1.5 m · 가슴 높이 — 몸이 돌면 같이 돈다, 게임 카메라보다 1/60 s 뒤)
//  칸 위 글 = 그 프레임의 팔 각 (tools/sim/joint_range.mjs armAngles 를 node 에서 같은 몸 자세로 부름): 팔꿈치(+ 굽힘 · − 과신전) · 아래팔-칼 · 손목 굽힘 · 폄 · 굴림 · 들림 면 · 두 손 거리
//  시간은 playwright 가짜 시계로 한 프레임(1/60 s)씩 (finish_shots.mjs 와 같은 방식 — 느린 소프트웨어 그리기에서도 같은 순간)
//  실행: npx vite build --outDir <폴더> && node tools/pwa/build.mjs <폴더> && npx vite preview --outDir <폴더> --port 5507 --strictPort &
//        node tools/browser/iberian_finish_arms_shots.mjs http://127.0.0.1:5507 docs/handoff/iberian_finish_arms_2026-10-24
//        WEAPON=zweihander · MOVE=spin|cleave · START=langort (싱지르 낼 때 자세 — ai_techniques.js G) · DIR=0|1|-1 · KNEEL=1 · Q=주소에 더할 것 · NAME=그림 이름 · MAXF=12
//        쪼개 내려치기: GUARD=쟁기|지붕 (탭 때 자세) · DIST=1.1 (내 가슴 ↔ 누운 몸통 m) · FALL=toward|away|left|right (넘어진 쪽 — greatsword_finish.mjs gsTrial 과 같은 밀침)
//  끝 코드 0 = 움직임이 나갔고 콘솔 오류 0 (미리 보기 빌드의 서비스 워커 MIME 오류는 셈하지 않음)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { armAngles } from '../sim/joint_range.mjs';

const base = (process.argv[2] || 'http://127.0.0.1:5507').replace(/\/$/, '');
const out = process.argv[3] || 'docs/handoff/iberian_finish_arms_2026-10-24';
const WEAPON = process.env.WEAPON || 'zweihander';
const MOVE = process.env.MOVE || 'spin';
const START = process.env.START || 'langort';
const DIR = +(process.env.DIR ?? 0);
const KNEEL = process.env.KNEEL === '1';
const GUARD = process.env.GUARD || '쟁기';
const DIST = +(process.env.DIST ?? (KNEEL ? 1.5 : 1.1));
const FALL = process.env.FALL || '';
const FALLS = { toward: Math.PI, away: 0, left: Math.PI / 2, right: -Math.PI / 2 }; // tools/sim/down_hits.mjs FALLS
const MAXF = +(process.env.MAXF ?? 12);
const NAME = process.env.NAME || `${MOVE}_${WEAPON}${MOVE === 'spin' ? `_${START}${DIR ? `_d${DIR}` : ''}` : `${KNEEL ? '_kneel' : ''}_${GUARD === '지붕' ? 'roof' : 'plow'}_${DIST}${FALL ? '_' + FALL : ''}`}`;
const PADS = { tag: [0.02, 0.52], ochsR: [0.22, 0.26], langort: [0.0, 0.03], wechselR: [0.38, -0.44], ochsL: [-0.22, 0.26], 쟁기: [0.18, -0.28], 지붕: [0.02, 0.52] };
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(out, '_tmp_'));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 800, height: 450 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
page.on('console', (m) => m.type() === 'error' && !/service ?worker|MIME/i.test(m.text()) && errors.push(`console: ${m.text()}`));
await page.clock.install({ time: new Date('2026-10-24T12:00:00') });
await page.clock.pauseAt(new Date('2026-10-24T12:00:01'));
await page.goto(`${base}/?test=1&weapon=${WEAPON}&foe=isolde&stage=arena&slowMo=0&openSweep=0${process.env.Q ? '&' + process.env.Q : ''}`, { waitUntil: 'networkidle' });
for (let i = 0; i < 600 && !(await page.evaluate(() => !!window.game?.player?.sword)); i++) await page.waitForTimeout(100);
await page.clock.runFor(200);
const run = (ms) => page.clock.runFor(ms);
// 여정 시작 (테스트 경로 — 모든 칸) 또는 시작 단추
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /여정 시작/.test(x.textContent));
  (b ?? document.getElementById('btnStart'))?.click();
});
for (let i = 0; i < 400 && !(await page.evaluate(() => window.game?.state === 'fight' && window.game.stats?.simTime > 2.8)); i++) await run(51);
await page.evaluate(() => document.getElementById('foeIntro')?.classList.remove('show'));

// 몸 자세 읽기 → node 에서 armAngles (같은 식)
const readPose = () =>
  page.evaluate(() => {
    const g = window.game, p = g.player;
    const B = {};
    for (const k of ['chest', 'uarmS', 'farmS', 'uarmO', 'farmO']) {
      const b = p.bodies[k];
      if (!b) continue;
      const r = b.rotation(), t = b.translation(), w = b.angvel();
      B[k] = { r: { x: r.x, y: r.y, z: r.z, w: r.w }, t: { x: t.x, y: t.y, z: t.z }, w: { x: w.x, y: w.y, z: w.z } };
    }
    const sw = p.sword;
    const S = sw ? { r: sw.rotation(), t: sw.translation(), w: sw.angvel() } : null;
    const tq = p.jointByName.farmS.target, tu = p.jointByName.uarmS.target;
    const sec = p.skill.sec, I = p.ibSpin, tp = p.skill.tap;
    const ph = I ? (I.settle ? 'settle' : I.tp < I.pre ? 'pre' : I.free ? 'free' : I.t < I.r ? 'ramp' : 'wind') : sec ? (sec.stage === 'stiff' ? 'stiff' : 'follow') : tp?.down ? (tp.ended ? 'end' : tp.go ? 'strike' : tp.upDone ? 'charge' : 'raise') : 'idle';
    return { B, S: S && { r: { x: S.r.x, y: S.r.y, z: S.r.z, w: S.r.w }, t: { x: S.t.x, y: S.t.y, z: S.t.z }, w: { x: S.w.x, y: S.w.y, z: S.w.z } }, side: p.side, armed: p.armed, gripAlong: p.weaponCfg.gripAlong, twoHand: p.weaponCfg.twoHand, gripping: !!p.gripping, tq: { x: tq.x, y: tq.y, z: tq.z, w: tq.w }, tu: { x: tu.x, y: tu.y, z: tu.z, w: tu.w }, ph, t: g.stats.simTime, state: p.state };
  });
const fake = (P) => {
  const body = (o) => o && { rotation: () => o.r, translation: () => o.t, angvel: () => o.w };
  const bodies = {};
  for (const [k, v] of Object.entries(P.B)) bodies[k] = body(v);
  return { bodies, sword: body(P.S), armed: P.armed, side: P.side, jointByName: { farmS: { target: P.tq }, uarmS: { target: P.tu } } };
};
const qrot = (q, v) => {
  const { x, y, z, w } = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
};
const angles = (P) => {
  const a = armAngles(fake(P)) ?? {};
  if (P.S) {
    const zF = qrot(P.B.farmS.r, [0, 0, 1]), zS = qrot(P.S.r, [0, 0, 1]);
    a.roll = (Math.acos(Math.max(-1, Math.min(1, zF[0] * zS[0] + zF[1] * zS[1] + zF[2] * zS[2]))) * 180) / Math.PI;
    if (P.twoHand && P.B.farmO) {
      const g = qrot(P.S.r, [0, P.gripAlong, 0]), h = qrot(P.B.farmO.r, [0, -0.135, 0]);
      a.gripGap = Math.hypot(P.S.t.x + g[0] - P.B.farmO.t.x - h[0], P.S.t.y + g[1] - P.B.farmO.t.y - h[1], P.S.t.z + g[2] - P.B.farmO.t.z - h[2]);
    }
  }
  return a;
};
const label = (P, a) => `${P.ph} t${P.t.toFixed(2)}  elbow ${a.elbow?.toFixed(0)} (cmd ${a.elbowCmd?.toFixed(0)})  offElbow ${a.elbowO?.toFixed(0)}  forearm-blade ${a.wrist?.toFixed(0)}  wristFE ${a.wristFE?.toFixed(0)}  roll ${a.roll?.toFixed(0)}  shPlane ${a.shPlane?.toFixed(0) ?? '-'}  shRot ${a.shRot?.toFixed(0) ?? '-'}  hands ${a.gripGap != null ? (a.gripGap * 100).toFixed(0) + 'cm' : '-'}`;

const shots = [];
const shoot = async (P) => {
  const k = shots.length;
  await page.screenshot({ path: `${tmp}/g${k}.png` });
  // 가까운 카메라: 지금 몸 방향 기준 칼 든 쪽 앞 45° · 1.5 m · 가슴 높이 (몸이 돌면 같이 돈다 — 늘 두 팔 · 칼자루가 보이게)
  await page.evaluate(() => {
    const g = window.game, p = g.player;
    const ch = p.bodies.chest.translation();
    const fw = p.forward(), rg = p.right();
    const s = p.side >= 0 ? 1 : -1;
    g.freeCam = true;
    g.camera.position.set(ch.x + fw.x * 1.1 + rg.x * s * 1.05, ch.y + 0.2, ch.z + fw.z * 1.1 + rg.z * s * 1.05);
    g.camera.lookAt(ch.x + fw.x * 0.2, ch.y - 0.12, ch.z + fw.z * 0.2);
  });
  await run(17); // 한 프레임 그려 가까운 카메라를 화면에 (몸은 1/60 s 더 감 — 칸 글은 이 프레임의 각)
  const P2 = await readPose();
  const a = angles(P2);
  await page.screenshot({ path: `${tmp}/s${k}.png` });
  await page.evaluate(() => (window.game.freeCam = false));
  shots.push({ k, text: label(P2, a), a, ph: P2.ph, t: P2.t });
  console.log(`SHOT ${k} ${label(P2, a)}`);
};
let fired = false;
if (MOVE === 'spin') {
  // 멈춘 상대 · 칼 충돌 끔 · 기력 가득 · 칼끝 거리 + 0.3 m
  await page.evaluate(() => {
    const g = window.game, p = g.player, e = g.enemy;
    g.ai.update = () => e.move.set(0, 0);
    e.die = () => {};
    p.stamina.setInfinite?.(true);
    for (let i = 0; i < e.sword.numColliders(); i++) e.sword.collider(i).setCollisionGroups(0);
  });
  const pad = PADS[START];
  for (let t = 0; t < 1400; t += 17) {
    await page.evaluate((pad) => window.game.player.handOffset.set(pad[0], pad[1]), pad);
    await run(17);
  }
  await page.evaluate(() => {
    const g = window.game, p = g.player, e = g.enemy;
    const want = p.swordArt.measure.reach + 0.3;
    const pc = p.bodies.chest.translation(), ec = e.bodies.chest.translation();
    const fw = p.forward();
    const dx = pc.x + fw.x * want - ec.x, dz = pc.z + fw.z * want - ec.z;
    for (const { rb } of e.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); }
    const at = e.anchor.translation();
    e.anchor.setTranslation({ x: at.x + dx, y: at.y, z: at.z + dz }, true);
    if (e.gait) for (const k of ['F', 'B']) { const l = e.gait.legs[k]; for (const key of ['plant', 'hip', 'ankle', 'p0', 'p1', 'des', 'fp', 'pinC', 'pinT']) if (l[key]) { l[key].x += dx; l[key].z += dz; } }
  });
  for (let t = 0; t < 600; t += 17) {
    await page.evaluate((pad) => window.game.player.handOffset.set(pad[0], pad[1]), pad);
    await run(17);
  }
  fired = await page.evaluate((dir) => {
    const g = window.game, W = g.playerSecret;
    const ctx = { ev: 'spin' };
    if (dir) ctx.turnDir = dir;
    return !!g.player.skill.secret({ S: W.S, ctx });
  }, DIR);
  // 단계가 바뀐 첫 프레임 + 오래 가는 단계(감은 채 · 놓음 · 받아 멈춤 · 따라 · 굳음)는 가운데도
  let last = null, t0 = null, tEnd = null;
  const mids = { wind: 0.5, free: 0.5, settle: 0.5, follow: 0.5 };
  const seen = {};
  for (let f = 0; f < 400 && shots.length < MAXF; f++) {
    const P = await readPose();
    t0 ??= P.t;
    if (!seen[P.ph]) seen[P.ph] = { t: P.t, mid: false };
    const len = { ramp: 0.2, wind: 0.2, free: 0.15, settle: 0.2, follow: 0.3 }[P.ph];
    const atMid = mids[P.ph] && !seen[P.ph].mid && len && P.t - seen[P.ph].t >= len * mids[P.ph];
    if (P.ph !== last || atMid || (P.ph === 'stiff' && P.t - seen.stiff.t > 0.5 && !seen.stiff.mid)) {
      if (P.ph === last) seen[P.ph].mid = true;
      if (P.ph !== 'idle') await shoot(P);
    }
    last = P.ph;
    if (P.ph === 'stiff' && seen.stiff.mid) break;
    if (P.ph === 'idle' && t0 != null && P.t - t0 > 0.5) { tEnd ??= P.t; if (P.t - tEnd > 0.3) break; }
    await run(17);
  }
} else {
  // 쪼개 내려치기: 상대를 쓰러뜨려 1.1 m 앞에 · 쟁기 자세 · 탭
  await page.evaluate((kneel) => {
    const g = window.game, e = g.enemy;
    g.ai.update = () => {};
    if (kneel) { e.knockDown(false); e.setState('kneel'); } else { e.knockDown(true); e.downTime = 1e9; }
  }, KNEEL);
  if (FALL && !KNEEL) {
    // 넘어진 쪽으로 0.25 s 밀침 (greatsword_finish.mjs gsTrial — 가슴 · 머리에 같은 충격량, 흔들림 없이 가운데 값)
    for (let t = 0; t < 250; t += 17) {
      await page.evaluate((a) => { const e = window.game.enemy; for (const k of ['chest', 'head']) e.bodies[k].applyImpulse({ x: Math.cos(a) * 40 * (1 / 120) * 4 * 2, y: 0, z: Math.sin(a) * 40 * (1 / 120) * 4 * 2 }, true); }, FALLS[FALL]);
      await run(17);
    }
  }
  await run(2500);
  const dist = () => page.evaluate(() => { const g = window.game, c = g.player.bodies.chest.translation(); let m = Infinity; for (const k of ['chest', 'abdomen', 'pelvis']) { const p = g.enemy.bodies[k]?.translation(); if (p) m = Math.min(m, Math.hypot(p.x - c.x, p.z - c.z)); } return m; });
  await page.evaluate(() => { const mv = window.game.player.move; const set = mv.set.bind(mv); window.__walk = 0.3; mv.set = (x, y) => set(x * window.__walk, y * window.__walk); });
  const want = DIST;
  let d = await dist();
  for (let i = 0; i < 4 && Math.abs(d - want) > 0.08; i++) {
    const key = d > want ? 'KeyW' : 'KeyS';
    await page.keyboard.down(key);
    for (let t = 0; t < 6000; t += 51) { await run(51); d = await dist(); if (key === 'KeyW' ? d <= want + 0.04 : d >= want - 0.04) break; }
    await page.keyboard.up(key);
    await run(600);
    d = await dist();
  }
  await page.evaluate(() => (window.__walk = 1));
  const setPad = (xy) => page.evaluate((xy) => { const p = window.game.player, sk = p.skill; p.handOffset.set(xy[0], xy[1]); for (const k of ['prev', 'aim', 'aimRaw']) sk[k].set(xy[0], xy[1]); sk.anchor?.set(xy[0], xy[1]); sk.aimVel.set(0, 0); sk.vel.set(0, 0); sk.follow.set(0, 0); }, xy);
  for (let t = 0; t < 1200; t += 51) { await setPad(PADS[GUARD]); await run(51); }
  fired = await page.evaluate(() => { const p = window.game.player; p.skill.thrust(); return !!p.skill.tap?.down; });
  let last = null, n = 0, tEnd = null, tStrike = null;
  for (let f = 0; f < 500 && shots.length < MAXF; f++) {
    const P = await readPose();
    if (P.ph === 'strike') tStrike ??= P.t;
    const strikeTick = P.ph === 'strike' && P.t - tStrike > 0 && ((n++ % 4) === 0);
    if (P.ph === 'end') tEnd ??= P.t;
    const endTick = P.ph === 'end' && [0.25, 0.6].some((x) => P.t - tEnd >= x && P.t - tEnd < x + 0.017);
    if (P.ph !== last || strikeTick || endTick || (P.ph === 'raise' && f === 6)) await shoot(P);
    last = P.ph;
    if ((P.ph === 'end' && P.t - tEnd > 0.65) || (P.ph === 'idle' && f > 30)) break;
    await run(17);
  }
}
// 띠 그림: 칸 = 위 게임 카메라 · 아래 옆 카메라 · 칸 위 글
fs.writeFileSync(`${tmp}/meta.json`, JSON.stringify({ shots, title: `${WEAPON} · ${MOVE}${MOVE === 'spin' ? ` · start ${START} · dir ${DIR || 'sword side'}` : `${KNEEL ? ' · kneeling foe' : ' · downed foe'} · guard ${GUARD === '지붕' ? 'roof' : 'plow'} · ${DIST} m${FALL ? ' · fell ' + FALL : ''}`}` }));
const py = `
import sys, json
from PIL import Image, ImageDraw
d, outp = sys.argv[1], sys.argv[2]
meta = json.load(open(d + '/meta.json'))
S = meta['shots']
cols = 4
rows = (len(S) + cols - 1) // cols
w, h = Image.open(f"{d}/g0.png").size
cw, ch = int(w * 0.5), int(h * 0.5)
cell_h = ch * 2 + 34
out = Image.new('RGB', (cols * cw, rows * cell_h + 22), (16, 16, 16))
dr = ImageDraw.Draw(out)
dr.text((6, 4), meta['title'] + '  (top = game camera, bottom = close 3/4 camera 1/60 s later; elbow + flex / - hyperextension, deg)', fill=(255, 214, 90))
for i, s in enumerate(S):
    x, y = (i % cols) * cw, 22 + (i // cols) * cell_h
    t = s['text']
    dr.text((x + 4, y + 2), t[:70], fill=(255, 255, 255))
    dr.text((x + 4, y + 16), t[70:150], fill=(200, 220, 255))
    out.paste(Image.open(f"{d}/g{s['k']}.png").convert('RGB').resize((cw, ch)), (x, y + 34))
    out.paste(Image.open(f"{d}/s{s['k']}.png").convert('RGB').resize((cw, ch)), (x, y + 34 + ch))
out.save(outp, quality=82, method=6)
`;
if (shots.length) execFileSync('python3', ['-c', py, tmp, `${out}/${NAME}.webp`]);
fs.writeFileSync(`${out}/${NAME}.json`, JSON.stringify({ weapon: WEAPON, move: MOVE, start: START, dir: DIR, kneel: KNEEL, guard: GUARD, dist: DIST, fall: FALL, frames: shots.map((s) => ({ ph: s.ph, t: +s.t.toFixed(3), ...Object.fromEntries(Object.entries(s.a).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, +v.toFixed(k === 'gripGap' ? 3 : 1)])) })) }, null, 1));
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`나감 ${fired} · 칸 ${shots.length} · 콘솔 오류 ${errors.length}${errors.length ? ': ' + errors.slice(0, 4).join(' | ') : ''} → ${out}/${NAME}.webp`);
await browser.close();
process.exit(fired && errors.length === 0 ? 0 : 1);
