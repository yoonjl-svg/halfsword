// 손목 검사 그림 (10/24 15:5x 사장님 '손목 고침에 새 작업자 붙이고 다른 동작에서도 저런지 검사해' — docs/strike/wrist_audit_2026-10-24.md · tools/sim/wrist_audit.mjs).
//  폰 가로 844 × 390 · 배율 2 · WebP. 물리를 멈추고(PHYSICS.maxStepsPerFrame 0) 옆 카메라(두 가슴 줄에 수직 3.2 m — risoluto_lunge_shots.mjs 와 같은 자리)와
//  손 가까이(칼 손에서 0.9 m — 아래팔 · 칼이 이루는 면에 수직)로 찍는다. 화면 글자 · 단추는 숨김(그림만).
//   lunge  — 안다레 리솔루토 런지: 상대를 세워 두고(STILL · 상처 끔 시연) 가슴 사이 2.2 m 까지 걸어 들어가 창을 열고 낸다 → lunge_hit(맞힌 스텝) · lunge_hold(굳음 0.3 s) ·
//            lunge_hold_hand(같은 때 손 가까이). 전 = 쿼리 `&thrustArm=0` (파일 이름 앞 before_ · 후 after_)
//   guards — GUARDS='무기:자세 이름 일부,…' 의 자세를 손 목표로 1.4 s 붙잡고 옆 · 손 가까이 (guard_<무기>_<번호>_{side,hand}) · SWIVEL=1 이면 시험 `&elbowSwivel=1` 로 한 번 더 (swivel_…)
//   10/24 17:2x (팔꿈치 돌림 켬 · 비정상 손목 교정 — 기록 §9): 전 = 쿼리 `&elbowSwivel=0&wristGuard=0` (파일 이름 앞 before_) · 후 = 기본 (after_)
//   pair     — GUARDS 자세를 전 · 후 둘 다 (before_guard_… · after_guard_…)
//   tap      — 탭 찌르기: 가슴 사이 1.8 m 에 서서 TAP_PAD(기본 황소 [0.22, 0.26])를 1.0 s 붙잡고 톡 → 뻗어 머무는 때(hold 첫 스텝) 옆 · 손 가까이 (tap_{side,hand})
//   gyeoksal — 동방 격살(청강검): 가슴 사이 1.4 m 에서 GK_STANCE(기본 eogeo — 팔 깎기) → 굳음 0.2 s 옆 · 손 가까이 (gyeoksal_{side,hand})
//   close    — 바짝 붙음: 롱소드가 가슴 사이 CLOSE_GAP(기본 0.95 m)까지 걸어 들어가 CLOSE_GUARD(기본 황소) 자리를 1.2 s 붙잡음 → 옆 · 손 가까이 (close_{side,hand})
//  npx vite build --outDir <tmp>/dist && node tools/pwa/build.mjs <tmp>/dist && npx vite preview --outDir <tmp>/dist --port 5567 --strictPort &
//  node tools/browser/wrist_audit_shots.mjs http://127.0.0.1:5567 <그림 폴더> [lunge|guards|pair|tap|gyeoksal|close]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { GUARD_BASE } from '../../src/guards.js';
const base = process.argv[2] || 'http://127.0.0.1:5567';
const out = process.argv[3] || 'docs/handoff/wrist_audit_2026-10-24';
const what = (process.argv[4] || 'lunge').split(',');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'] }); // risoluto_lunge_shots.mjs 와 같은 실행 파일
const errors = [];
const log = [];

async function open(weapon, extra = '') {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('https://*.supabase.co/**', (r) => r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror ' + e));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/supabase|Failed to load resource/.test(m.text())) errors.push(m.text());
  });
  await page.goto(`${base}/?weapon=${weapon}&foe=isolde&foeWeapon=longsword&skillNodes=all&slowMo=0${extra}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.game?.player?.sword, null, { timeout: 90000 });
  await page.getByText('여정 시작').click();
  await page.waitForFunction(() => window.game.state === 'fight' && window.game.playerSecret, null, { timeout: 90000 });
  await page.addStyleTag({ content: '* { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  await page.evaluate(() => {
    const g = window.game;
    g.ai.update = () => g.enemy.move.set(0, 0); // 상대를 그 자리에 세움 (시연)
    g.enemy.applyWound = () => {}; // 상대 상처 끔 (시연 — 쓰러지지 않게)
    g.player.applyWound = () => {};
  });
  return { ctx, page };
}

/** 물리가 멈춘 그 자세를 찍는다: side = 옆 카메라 · hand = 손 가까이 */
async function shot(page, file, view) {
  await page.evaluate((view) => {
    const g = window.game;
    const T = g.THREE;
    const p = g.player;
    const a = p.bodies.chest.translation();
    const b = g.enemy.bodies.chest.translation();
    g.freeCam = true;
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    const s = -(p.side ?? 1); // 칼 든 쪽에서 (칼 팔이 몸에 가리지 않게)
    const cx = s * (dz / L), cz = -s * (dx / L); // 두 가슴 줄에 수직인 가로 방향
    if (view === 'side') {
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      g.camera.position.set(mx + cx * 3.2, 1.1, mz + cz * 3.2);
      g.camera.lookAt(mx, 0.85, mz);
    } else if (view === 'pside') {
      // 자세 그림: 내 몸 가운데(가슴 앞 0.3 m)를 옆에서 2.4 m
      const fx = dx / L, fz = dz / L;
      g.camera.position.set(a.x + fx * 0.3 + cx * 2.4, 1.2, a.z + fz * 0.3 + cz * 2.4);
      g.camera.lookAt(a.x + fx * 0.3, 0.95, a.z + fz * 0.3);
    } else {
      // 손 가까이: 칼 손(칼 원점)과 팔꿈치 사이 · 칼자루 쪽을 옆(같은 가로 방향)에서 1.0 m · 조금 위
      const sw = p.sword.translation();
      const fa = p.bodies.farmS.translation();
      const C = new T.Vector3((sw.x * 2 + fa.x) / 3, (sw.y * 2 + fa.y) / 3, (sw.z * 2 + fa.z) / 3);
      g.camera.position.set(C.x + cx * 1.0, C.y + 0.18, C.z + cz * 1.0);
      g.camera.lookAt(C);
    }
  }, view);
  await page.waitForTimeout(350);
  const png = `${out}/${file}.png`;
  await page.screenshot({ path: png });
  execFileSync('python3', ['-I', '-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).save(sys.argv[2], "WEBP", quality=86, method=6)', png, png.replace(/\.png$/, '.webp')]);
  fs.unlinkSync(png);
  await page.evaluate(() => {
    window.game.freeCam = false;
  });
}

/** 지금 칼 손목 값 (wrist_audit.mjs wristSample 과 같은 식 — 손 면 dev · 아래팔-칼 · 손 앞 몫) */
const READ = () => {
  const g = window.game, T = g.THREE, p = g.player, e = g.enemy;
  const Q = (r) => new T.Quaternion(r.x, r.y, r.z, r.w);
  const V = (t) => new T.Vector3(t.x, t.y, t.z);
  const ch = p.bodies.chest;
  const S = new T.Vector3(0, 0.1, (p.side ?? 1) * 0.2).applyQuaternion(Q(ch.rotation())).add(V(ch.translation()));
  const qf = Q(p.bodies.farmS.rotation());
  const W = new T.Vector3(0.13, 0, 0).applyQuaternion(qf).add(V(p.bodies.farmS.translation()));
  const fc = V(e.bodies.chest.translation());
  const fwd = new T.Vector3(fc.x - ch.translation().x, 0, fc.z - ch.translation().z).normalize();
  const fx = new T.Vector3(1, 0, 0).applyQuaternion(qf);
  const qs = Q(p.sword.rotation());
  const xS = new T.Vector3(1, 0, 0).applyQuaternion(qs), yS = new T.Vector3(0, 1, 0).applyQuaternion(qs);
  let dev = 90 - (Math.atan2(fx.dot(yS), fx.dot(xS)) * 180) / Math.PI;
  if (dev > 180) dev -= 360;
  const wrist = (Math.acos(Math.max(-1, Math.min(1, fx.dot(yS)))) * 180) / Math.PI;
  const uq = Q(p.bodies.uarmS.rotation());
  const ux = new T.Vector3(1, 0, 0).applyQuaternion(uq);
  const elbow = (Math.acos(Math.max(-1, Math.min(1, ux.dot(fx)))) * 180) / Math.PI;
  return { dev: +dev.toFixed(0), wrist: +wrist.toFixed(0), elbow: +elbow.toFixed(0), along: +(W.clone().sub(S).dot(fwd) / 0.57).toFixed(2), gap: +p.foeDistance().toFixed(2) };
};

async function lungeScene(tag, extra) {
  const { ctx, page } = await open(process.env.WEAPON || 'rapier', extra);
  await page.evaluate(() => {
    const g = window.game, p = g.player, e = g.enemy, ps = g.playerSecret, orig = ps.update.bind(ps);
    const D = (window.drv = { want: null, done: {}, t0: null, fired: false, hitSeen: false });
    ps.update = (dt, busy) => {
      orig(dt, busy);
      const sec = p.skill.sec;
      if (!D.fired) {
        const go = p.foeDistance() > 2.25;
        p.move.set(0, go ? 1 : 0);
        p.stickX = 0;
        p.stickY = go ? 1 : 0;
        if (!go) {
          D.t0 ??= g.stats.simTime;
          if (g.stats.simTime - D.t0 > 0.6) {
            ps.openWindow({ ev: 'risoluto', path: 'close', held: 0.6 });
            D.fired = p.skill.secret(ps.fire());
          }
        }
        return;
      }
      p.move.set(0, 0);
      p.stickX = p.stickY = 0;
      const freeze = (k) => {
        if (!D.done[k] && !D.want) {
          D.want = k;
          g.config.PHYSICS.maxStepsPerFrame = 0;
        }
      };
      if (D.hitSeen) freeze('lunge_hit'); // 맞힌 스텝 다음 스텝(그 자리가 그려진 몸)
      if (p.iai?.hitM) D.hitSeen = true;
      if (sec?.lunge && sec.stage === 'stiff' && sec.t >= 0.3) freeze('lunge_hold');
    };
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    await page.waitForTimeout(80);
    const k = await page.evaluate(() => window.drv.want);
    if (!k) continue;
    await page.waitForTimeout(250);
    const v = await page.evaluate(READ);
    await shot(page, `${tag}_${k}`, 'side');
    if (k === 'lunge_hold') await shot(page, `${tag}_${k}_hand`, 'hand');
    log.push(`${tag} ${k} ${JSON.stringify(v)}`);
    console.log(`SHOT ${tag} ${k} ${JSON.stringify(v)}`);
    await page.evaluate((k) => {
      window.drv.done[k] = true;
      window.drv.want = null;
      window.game.config.PHYSICS.maxStepsPerFrame = 8;
    }, k);
    if (k === 'lunge_hold') break;
  }
  await ctx.close();
}

async function guardScene(weapon, names, extra = '', pfx = 'guard') {
  const { ctx, page } = await open(weapon, extra);
  let table = await page.evaluate(() => (window.game.player.guardPose.table ?? []).map((G) => ({ name: G.name, pad: G.pad })));
  if (!table.length) table = GUARD_BASE.map((G) => ({ name: G.name, pad: G.pad })); // 롱소드류: 바탕 표 (wrist_audit.mjs guardsRun 과 같음)
  for (const [i, nm] of names.entries()) {
    const G = table.find((x) => x.name.includes(nm));
    if (!G) {
      console.log(`자세 없음 ${weapon} ${nm}`);
      continue;
    }
    await page.evaluate((pad) => {
      const g = window.game, p = g.player, ps = g.playerSecret;
      if (!ps._orig) ps._orig = ps.update.bind(ps);
      const t0 = g.stats.simTime;
      window.drv = { want: null };
      ps.update = (dt, busy) => {
        ps._orig(dt, busy);
        p.move.set(0, 0);
        p.handOffset.set(pad[0], pad[1]);
        const sk = p.skill;
        for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) sk[k]?.set?.(pad[0], pad[1]);
        if (g.stats.simTime - t0 > 1.4 && !window.drv.want) {
          window.drv.want = 'g';
          g.config.PHYSICS.maxStepsPerFrame = 0;
        }
      };
    }, G.pad);
    await page.waitForFunction(() => window.drv.want, null, { timeout: 120000 });
    await page.waitForTimeout(250);
    const v = await page.evaluate(READ);
    const tag = `${pfx}_${weapon}_${i + 1}`;
    await shot(page, `${tag}_side`, 'pside');
    await shot(page, `${tag}_hand`, 'hand');
    log.push(`${tag} ${G.name} ${JSON.stringify(v)}`);
    console.log(`SHOT ${tag} ${G.name} ${JSON.stringify(v)}`);
    await page.evaluate(() => {
      window.game.config.PHYSICS.maxStepsPerFrame = 8;
    });
  }
  await ctx.close();
}

/** 대본 한 장면: drive(page 안에서 스텝마다 — 걸어 들어가고 · 내고 · 멈출 때 window.drv.want 를 세움) → 멈춘 자세를 옆 · 손 가까이 */
async function scene(weapon, extra, tag, drive, arg) {
  const { ctx, page } = await open(weapon, extra);
  await page.evaluate(
    ([src, arg]) => {
      const g = window.game, p = g.player, ps = g.playerSecret, orig = ps.update.bind(ps);
      const fn = new Function('g', 'p', 'ps', 'D', 'arg', src);
      const D = (window.drv = { want: null, n: 0 });
      ps.update = (dt, busy) => {
        orig(dt, busy);
        if (D.want) return;
        D.n++;
        if (fn(g, p, ps, D, arg)) {
          D.want = 'shot';
          g.config.PHYSICS.maxStepsPerFrame = 0;
        }
      };
    },
    [drive, arg],
  );
  try {
    await page.waitForFunction(() => window.drv.want, null, { timeout: 120000 });
  } catch (e) {
    const dbg = await page.evaluate(() => ({ n: window.drv.n, t0: window.drv.t0, gap: window.game.player.foeDistance(), state: window.game.state, p: window.game.player.state }));
    console.log(`장면 시간 넘김 ${tag} ${JSON.stringify(dbg)}`);
    await ctx.close();
    return;
  }
  await page.waitForTimeout(250);
  const v = await page.evaluate(READ);
  await shot(page, `${tag}_side`, 'pside');
  await shot(page, `${tag}_hand`, 'hand');
  log.push(`${tag} ${JSON.stringify(v)}`);
  console.log(`SHOT ${tag} ${JSON.stringify(v)}`);
  await ctx.close();
}
const HOLD = (pad) => `p.handOffset.set(${pad[0]}, ${pad[1]}); for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) p.skill[k]?.set?.(${pad[0]}, ${pad[1]});`;
const WALK = (gap) => `const go = p.foeDistance() > ${gap}; p.move.set(0, go ? 1 : 0); p.stickX = 0; p.stickY = go ? 1 : 0;`;
const BEFORE = '&elbowSwivel=0&wristGuard=0'; // 10/24 17:2x 전 판

if (what.includes('tap')) {
  const pad = (process.env.TAP_PAD || '0.22,0.26').split(',').map(Number);
  const drive = `if (!D.fired) { ${WALK(1.85)} ${HOLD(pad)} if (!go) { D.t0 ??= D.n; if (D.n - D.t0 > 120) D.fired = p.skill.thrust(); } return false; }
    p.move.set(0, 0); p.stickY = 0; const tp = p.skill.tap; return !!tp && tp.t >= tp.K.aim + tp.K.extend;`;
  for (const [pf, ex] of [['before', BEFORE], ['after', '']]) await scene(process.env.WEAPON || 'longsword', ex, `${pf}_tap`, drive);
}
if (what.includes('gyeoksal')) {
  const st = process.env.GK_STANCE || 'eogeo';
  const drive = `if (!D.fired) { ${WALK(1.4)} if (!go) { D.t0 ??= D.n; if (D.n - D.t0 > 72) D.fired = p.skill.secret({ S: ps.S, ctx: { slot: '${st}', stance: '${st}' } }); } return false; }
    p.move.set(0, 0); p.stickY = 0; if (!p.iai && p.skill.sec?.stage === 'stiff') D.s = (D.s ?? 0) + 1; return (D.s ?? 0) >= 24;`;
  for (const [pf, ex] of [['before', BEFORE], ['after', '']]) await scene('qinggang', ex, `${pf}_gyeoksal`, drive);
}
if (what.includes('close')) {
  const nm = process.env.CLOSE_GUARD || '황소';
  const G = GUARD_BASE.find((x) => x.name.includes(nm));
  const gap = +(process.env.CLOSE_GAP || 0.95); // 걸어 들어가 멈출 가슴 사이 (밀치기에 밀려 0.85 m 안으로는 잘 안 들어감)
  // 두 칼 부딪힘 끔 (전 판은 황소에서 앞 · 아래로 누운 칼이 상대 몸 · 칼에 걸려 1.2 ~ 1.5 m 에서 못 들어감 — 두 판을 같은 거리에서 보려고 · 자세 그림)
  const drive = `if (!D.init) { D.init = 1; for (const f of [g.enemy, p]) for (let i = 0; i < f.sword.numColliders(); i++) f.sword.collider(i).setCollisionGroups(0); } ${WALK(gap)} ${HOLD(G.pad)} if (!go) D.t0 ??= D.n; return D.t0 != null && D.n - D.t0 > 144;`;
  for (const [pf, ex] of [['before', BEFORE], ['after', '']]) await scene('longsword', ex, `${pf}_close`, drive);
}
if (what.includes('lunge')) {
  await lungeScene('before', '&thrustArm=0');
  await lungeScene('after', '');
}
if (what.includes('guards')) {
  const spec = (process.env.GUARDS || 'rapier:프리마,rapier:세콘다,rapier:3번 자세 (테르차),longsword:황소,longsword:옆 지킴,longsword:바보,sabre:황소,qinggang:옆 자세,uchigatana:흘려 받기,zweihander:허리 뒤').split(',');
  const by = new Map();
  for (const s of spec) {
    const [w, n] = s.split(':');
    if (!by.has(w)) by.set(w, []);
    by.get(w).push(n);
  }
  for (const [w, ns] of by) await guardScene(w, ns);
  if (process.env.SWIVEL === '1') for (const [w, ns] of by) await guardScene(w, ns, '&elbowSwivel=1', 'swivel'); // 시험 JOINTS.elbowSwivel 켬 (같은 자세 · 같은 손 자리)
}
if (what.includes('pair')) {
  const spec = (process.env.GUARDS || 'rapier:프리마,rapier:세콘다,longsword:황소,qinggang:황소,sabre:왼 황소,uchigatana:흘려 받기,zweihander:어깨 메기,tizona:허리 뒤').split(',');
  const by = new Map();
  for (const s of spec) {
    const [w, n] = s.split(':');
    if (!by.has(w)) by.set(w, []);
    by.get(w).push(n);
  }
  for (const [w, ns] of by) await guardScene(w, ns, BEFORE, 'before_guard');
  for (const [w, ns] of by) await guardScene(w, ns, '', 'after_guard');
}
fs.writeFileSync(`${out}/shots_log.txt`, log.join('\n') + '\n');
console.log(`ERRORS ${JSON.stringify(errors)}`);
await browser.close();
