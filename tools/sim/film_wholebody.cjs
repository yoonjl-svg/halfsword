// 온몸 베기 연속 사진 (docs/whole_body_strike.md 8장). 이해 단계의 motion/film.cjs·bigstrip.cjs 를 옮겼다.
//  실제 게임 페이지(이미 떠 있는 개발 서버)를 수동 프레임 시계로 넘기며, 입력은 손가락 궤적 길로 넣는다:
//  game.input.onDown/onMove/onUp 에 터치 이벤트를 프레임마다 넣으면 main.js frame() 이 폰과 똑같이 handOffset 으로 옮긴다.
//  세 줄: 폰 게임 카메라 / 옆(내 왼쪽에서) / 앞 비스듬히(상대 쪽에서). 8칸: 긋기 시작 뒤 0, 60, 120, 180, 240, 300, 400, 550 ms
//  (헛침·쏠림 장면은 1.2초 동안 10칸). 겹쳐 그리기: 칼끝 자취(빨강), 손 자취(노랑), 무게중심 바닥 점(하늘), 발 디딘 자리(초록).
//  칸 아래: 손 직선 이동(몸 기준), 무게중심 전진, 골반·가슴 각, 결심 단계, 멈칫. 맨 위: 넣은 손가락 궤적.
//  더미는 죽지 않는다(die 막음). 멈칫은 켠 채로 찍고 칸에 표시한다.
// 실행 (저장소 뿌리): node tools/sim/film_wholebody.cjs <장면> [hybrid|levitate] [--off] [--size=844x390] [--out=폴더] [--url=주소]
//   장면: zornhau-stand (어깨 지붕 → 왼쪽 아래 사선, 상대 1.55 m) · zornhau-step (같은 베기, 틈 2.0 m) · pflug-zornhau (쟁기에서 곧장 사선)
//         oberhau-stand (곧게 내려베기) · zwerch-stand (가로베기) · unterhau-stand (올려베기) · guard-change (황소 ↔ 왼쪽 황소)
//         miss (헛친 사선 베기, 상대 3.2 m, 1.2초 10칸) · camera-presets (사선 베기를 CAMERA.preset 마다, 카메라 구도 층이 생기기 전엔 지금 카메라 하나)
//         walk-<F|FR|R|BR|B|BL|L|FL> (조이스틱 끝까지 1.2초 걷고 놓는다, 상대 4 m: 걷기 시작·멈춤 8칸) · tap-thrust (탭 찌르기, 상대 1.9 m)
//         ai-step (AI 가 기술 걸음을 부탁한 순간부터 0.9초 동안 8칸, 찍히는 쪽 = AI. 플레이어는 가만히 선 더미, 상대 2.4 m)
//   --off: 설정 '온몸 베기'를 끈다 (전·후 비교의 '전'). 같은 시드·같은 입력
//   --fixoff: GAIT.fwdFix 를 끈다 (R1 걸음 방향 버그 고침의 '전')
//   주소: 기본 http://localhost:5174/ (이 작업 폴더의 개발 서버). 새 서버를 띄우지 않는다
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const opt = (k, d) => (args.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const pos = args.filter((a) => !a.startsWith('--'));
const SCENE = pos[0] || 'zornhau-stand';
const MODE = pos[1] || 'hybrid';
const OFF = args.includes('--off');
const FIXOFF = args.includes('--fixoff');
const [W, H] = opt('size', '844x390').split('x').map(Number);
const OUT = opt('out', process.env.OUTDIR || os.tmpdir());
const URL = opt('url', process.env.URL || 'http://localhost:5174/');
const TAG = `${SCENE}_${MODE === 'hybrid' ? 'hyb' : 'lev'}_${OFF ? 'off' : 'on'}${FIXOFF ? '_fixoff' : ''}_${W}x${H}`;
fs.mkdirSync(OUT, { recursive: true });

// 패드 자리 (guards.js 규약, wholebody.mjs 와 같다)
const PAD = { Pflug: [0.18, -0.28], Ochs: [0.22, 0.26], OchsL: [-0.22, 0.26], Tag: [0.02, 0.52], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], Wechsel: [0.38, -0.44], Alber: [0, -0.5], Side: [0.52, 0.03], SideL: [-0.52, 0.03] };
const CUT = (ch, end, dist, extra = {}) => ({ ch, end, dist, v: 12, ...extra });
const SCENES = {
  'zornhau-stand': CUT(PAD.ShR, PAD.WechselL, 1.55),
  'zornhau-step': CUT(PAD.ShR, PAD.WechselL, 2.0),
  'pflug-zornhau': CUT(null, PAD.WechselL, 1.55),
  'oberhau-stand': CUT(PAD.Tag, PAD.Alber, 1.55),
  'zwerch-stand': CUT(PAD.Side, PAD.SideL, 1.55),
  'unterhau-stand': CUT(PAD.Wechsel, PAD.OchsL, 1.55),
  'guard-change': CUT(PAD.Ochs, PAD.OchsL, 1.9, { v: 3 }),
  miss: CUT(PAD.ShR, PAD.WechselL, 3.2, { long: true }),
  'camera-presets': CUT(PAD.ShR, PAD.WechselL, 1.55, { presets: true }),
  'tap-thrust': { type: 'tap', dist: 1.9 },
  // (내디딘 발이 닿아 몸무게를 받는 것까지 보이게 0.9초까지 찍는다)
  'ai-step': { type: 'ai', dist: 2.4, shots: [0, 100, 200, 300, 400, 550, 700, 900] },
};
// 걷기 8방향: 조이스틱 (옆, 앞)
const DIRS = { F: [0, 1], FR: [0.707, 0.707], R: [1, 0], BR: [0.707, -0.707], B: [0, -1], BL: [-0.707, -0.707], L: [-1, 0], FL: [-0.707, 0.707] };
for (const [k, d] of Object.entries(DIRS)) SCENES[`walk-${k}`] = { type: 'walk', stick: d, dist: 4.0, holdMs: 1200, shots: [0, 150, 300, 500, 800, 1100, 1400, 1800] };
const SC = SCENES[SCENE];
if (!SC) {
  console.error('모르는 장면:', SCENE, '·', Object.keys(SCENES).join(' '));
  process.exit(1);
}
const SHOTS = SC.shots || (SC.long ? [0, 120, 240, 360, 480, 600, 720, 840, 1000, 1200] : [0, 60, 120, 180, 240, 300, 400, 550]);
const TYPE = SC.type || 'cut';

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await ctx.addInitScript(
    ([leg, whole]) => {
      try {
        localStorage.setItem('gladiator-settings', JSON.stringify({ legWeight: leg, wholeBody: whole, trail: false, guardNames: false, sound: false }));
      } catch {}
      // 수동 프레임 시계: __manual 을 켜면 rAF 콜백을 모아 두고 __pump(n, dtMs) 가 가짜 시계로 돌린다
      const orig = window.requestAnimationFrame.bind(window);
      window.__rafQ = [];
      window.__now = 0;
      window.__manual = false;
      window.requestAnimationFrame = (cb) => {
        if (window.__manual) {
          window.__rafQ.push(cb);
          return 1;
        }
        return orig((t) => {
          window.__now = t;
          cb(t);
        });
      };
      window.__pump = (n, dtMs) => {
        for (let i = 0; i < n; i++) {
          const q = window.__rafQ;
          window.__rafQ = [];
          window.__now += dtMs;
          window.__dt = dtMs;
          for (const cb of q) cb(window.__now);
          window.__afterFrame?.();
        }
      };
    },
    [MODE === 'hybrid', !OFF],
  );
  await page.goto(`${URL}?weapon=longsword&foeWeapon=longsword&foe=default&emo=0`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.game && window.game.player, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  if (FIXOFF) await page.evaluate(() => (game.config.GAIT.fwdFix = false));
  await page.tap('#btnStart');
  await page.waitForTimeout(400);
  await page.evaluate(() => (window.__manual = true));
  await page.waitForFunction(() => window.__rafQ.length > 0, null, { timeout: 60000, polling: 100 });

  const presets = SC.presets ? await page.evaluate(() => (game.config.CAMERA?.presets ? Object.keys(game.config.CAMERA.presets) : [null])) : [null];
  const report = { scene: SCENE, mode: MODE, whole: !OFF, fwdFix: !FIXOFF, size: [W, H], url: URL, shots: SHOTS, runs: [] };
  for (const preset of presets) {
    // ── 판 차리기: 더미(AI 끔, 칼 안 부딪힘, 안 죽음), 상대를 dist 에 세운다, 쟁기로 1.5초 ──
    const info = await page.evaluate(
      ([dist, preset, type]) => {
        const g = window.game;
        const P = g.player;
        const E = g.enemy;
        if (preset && g.config.CAMERA) g.config.CAMERA.preset = preset;
        // ai-step: AI 는 그대로 두고 플레이어를 더미로 (안 죽음, 안 넘어짐). 걸음만 보므로 AI 칼도 아무것에도 안 닿게 한다
        //  (닿으면 더미가 맞아 쓰러지고 AI 가 마무리로 넘어가 기술 걸음을 안 한다). 나머지: 상대가 더미
        window.__subj = type === 'ai' ? 'enemy' : 'player';
        if (type !== 'ai') g.ai.update = () => E.move.set(0, 0);
        const dummy = type === 'ai' ? P : E;
        for (let i = 0; i < dummy.sword.numColliders(); i++) dummy.sword.collider(i).setCollisionGroups(0);
        if (type === 'ai') {
          for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
          P.knockDown = () => {};
        }
        E.die = () => {};
        P.die = () => {};
        const h = g.config.SKILL.homeGuard;
        P.handOffset.set(h[0], h[1]);
        // 상대를 두 사람을 잇는 선 위로 옮겨 두 가슴 사이를 dist 로 맞춘다. 자세를 잡으며 가슴이 움직이므로 세 번 고쳐 맞춘다
        const log = [];
        for (let k = 0; k < 3; k++) {
          const a = P.bodies.chest.translation();
          const b = E.bodies.chest.translation();
          const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
          const sx = ((b.x - a.x) / L) * (dist - L);
          const sz = ((b.z - a.z) / L) * (dist - L);
          for (const { rb } of E.meshes) {
            const t = rb.translation();
            rb.setTranslation({ x: t.x + sx, y: t.y, z: t.z + sz }, true);
          }
          const t = E.anchor.translation();
          E.anchor.setTranslation({ x: t.x + sx, y: t.y, z: t.z + sz }, true);
          if (E.gait?.active) E.gait.exit(); // 딛은 발 자리를 옮긴 곳에서 다시 잡는다 (안 그러면 예전 발자리로 걸어 돌아간다)
          window.__pump(k < 2 ? 60 : 90, 1000 / 60);
          log.push(+P.foeDistance().toFixed(2));
        }
        return { d: +P.foeDistance().toFixed(2), log };
      },
      [SC.dist, preset, TYPE],
    );

    // ── 기록기: 프레임마다 칼끝·손·무게중심·발 (월드), 몸 기준 값 ──
    await page.evaluate(() => {
      const g = window.game;
      const P = window.__subj === 'enemy' ? g.enemy : g.player; // 찍히는 쪽
      const E = window.__subj === 'enemy' ? g.player : g.enemy;
      const T = g.THREE;
      const R = (window.__rec = { on: false, pts: { tip: [], hand: [], com: [], foot: [] }, rows: [], t0: 0, lastSim: g.stats.simTime });
      const a = P.bodies.pelvis.translation();
      const b = E.bodies.pelvis.translation();
      const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      R.fw = { x: (b.x - a.x) / L, z: (b.z - a.z) / L }; // 처음 두 사람을 잇는 방향 (앞)
      R.yaw0 = Math.atan2(-R.fw.z, R.fw.x);
      const yawOf = (rb) => {
        const r = rb.rotation();
        const v = new T.Vector3(1, 0, 0).applyQuaternion(new T.Quaternion(r.x, r.y, r.z, r.w));
        return Math.atan2(-v.z, v.x);
      };
      const com = () => {
        let M = 0;
        let x = 0;
        let z = 0;
        for (const n in P.bodies) {
          const m = P.bodies[n].mass();
          const c = P.bodies[n].worldCom();
          x += c.x * m;
          z += c.z * m;
          M += m;
        }
        return { x: x / M, y: 0.01, z: z / M };
      };
      const wrapD = (x) => Math.round((Math.atan2(Math.sin(x), Math.cos(x)) * 180) / Math.PI);
      window.__afterFrame = () => {
        if (!R.on || window.__dt === 0) return; // 시간이 안 가는 다시 그리기(다른 카메라로 찍기)는 기록하지 않는다
        const tip = P.bladePoint(1, new T.Vector3());
        const hd = P.bodies.farmS.translation();
        const c = com();
        R.pts.tip.push([tip.x, tip.y, tip.z]);
        R.pts.hand.push([hd.x, hd.y, hd.z]);
        R.pts.com.push([c.x, c.y, c.z]);
        const ms = window.__now - R.t0;
        const sim = g.stats.simTime;
        const stop = sim - R.lastSim < 0.5 / 60; // 이 프레임에 물리가 반도 안 돌았다 = 멈칫(또는 슬로)
        R.lastSim = sim;
        if (!R.h0) R.h0 = { x: hd.x, y: hd.y, z: hd.z, c };
        // 손 직선 이동은 몸 기준(처음 앞 방향 틀)으로: 몸이 나간 만큼은 뺀다
        const hx = hd.x - c.x - (R.h0.x - R.h0.c.x);
        const hz = hd.z - c.z - (R.h0.z - R.h0.c.z);
        const cm = P.commit;
        R.rows.push({
          ms: Math.round(ms),
          handChord: +Math.hypot(hx, hd.y - R.h0.y, hz).toFixed(2),
          comFwd: +((c.x - R.h0.c.x) * R.fw.x + (c.z - R.h0.c.z) * R.fw.z).toFixed(2),
          comDist: +Math.hypot(c.x - R.h0.c.x, c.z - R.h0.c.z).toFixed(2),
          feet: ['footF', 'footB'].map((k) => (P.gait?.legs?.[k === 'footF' ? 'F' : 'B']?.stance ? '■' : '□')).join(''),
          pelvis: wrapD(yawOf(P.bodies.pelvis) - R.yaw0),
          chest: wrapD(yawOf(P.bodies.chest) - R.yaw0),
          stage: cm && cm.on ? cm.stage : '-',
          stop,
          tipV: +P.tipVel.length().toFixed(1),
        });
        for (const k of ['footF', 'footB']) {
          const f = P.bodies[k].translation();
          if (f.y < 0.12) R.pts.foot.push([f.x, 0.01, f.z]);
        }
      };
    });

    // ── 손가락: 화면 오른쪽 가운데에 대고, 준비 자세로 1.2 m/s → 0.4초 머묾 → 긋기 (평균 v m/s) → 뗌 ──
    const trace = [];
    const ppm = Math.max(320, H) / (await page.evaluate(() => game.config.INPUT.touchSensitivity));
    const finger = { x: Math.round(W * 0.72), y: Math.round(H * 0.55) };
    const send = (type, x, y) =>
      page.evaluate(([type, x, y]) => {
        const e = { type, pointerId: 7, pointerType: 'touch', button: 0, clientX: x, clientY: y, timeStamp: window.__now };
        const I = game.input;
        if (type === 'pointerdown') I.onDown(e);
        else if (type === 'pointermove') I.onMove(e);
        else I.onUp(e);
      }, [type, x, y]);
    const frame = () => page.evaluate(() => window.__pump(1, 1000 / 60));
    const handNow = () => page.evaluate(() => [game.player.handOffset.x, game.player.handOffset.y]);
    // 궤적 한 다리: 패드 이동 (dx, dy) 를 빠르기 v 로, 프레임마다 손가락을 옮긴다
    const drag = async (dx, dy, v, onFrame) => {
      const T = (Math.hypot(dx, dy) / v) * 1000;
      const x0 = finger.x;
      const y0 = finger.y;
      for (let t = 1000 / 60; ; t += 1000 / 60) {
        const u = Math.min(1, t / T);
        finger.x = x0 + dx * u * ppm;
        finger.y = y0 - dy * u * ppm;
        trace.push([finger.x, finger.y]);
        await send('pointermove', finger.x, finger.y);
        await frame();
        if (onFrame) await onFrame();
        if (u >= 1) break;
      }
    };
    // 찍기: 긋기 시작 뒤 SHOTS ms 에 가장 가까운 (넘지 않은 첫) 프레임
    const shots = [];
    let next = 0;
    const views = ['game', 'side', 'front'];
    const shoot = async () => {
      const ms = await page.evaluate(() => window.__now - window.__rec.t0);
      if (next >= SHOTS.length || ms + 1 < SHOTS[next]) return;
      const cell = { want: SHOTS[next], ms: Math.round(ms), img: {}, ov: {} };
      for (const v of views) {
        const ov = await page.evaluate((v) => {
          const g = window.game;
          const P = window.__subj === 'enemy' ? g.enemy : g.player;
          const E = window.__subj === 'enemy' ? g.player : g.enemy;
          const cam = g.camera;
          const T = g.THREE;
          if (v !== 'game') {
            g.__saved = { p: cam.position.clone(), q: cam.quaternion.clone() };
            const a = P.bodies.pelvis.translation();
            const b = E.bodies.pelvis.translation();
            const mx = (a.x + b.x) / 2;
            const mz = (a.z + b.z) / 2;
            let dx = b.x - a.x;
            let dz = b.z - a.z;
            const L = Math.hypot(dx, dz) || 1;
            dx /= L;
            dz /= L;
            if (v === 'side') {
              // 내 왼쪽에서 (칼 든 팔 반대쪽), 두 사람 가운데를 본다
              cam.position.set(mx + dz * 3.6, 1.25, mz - dx * 3.6);
              cam.lookAt(mx, 1.05, mz);
            } else {
              // 앞 비스듬히: 상대 쪽 앞 왼쪽에서 내 가슴을 본다
              cam.position.set(a.x + dx * 1.6 + dz * 2.6, 1.55, a.z + dz * 1.6 - dx * 2.6);
              cam.lookAt(a.x + dx * 0.45, 1.15, a.z + dz * 0.45);
            }
            g.freeCam = true;
          }
          cam.updateMatrixWorld();
          const R = window.__rec;
          const px = (p) => {
            const q = new T.Vector3(p[0], p[1], p[2]).project(cam);
            return [Math.round(((q.x + 1) / 2) * innerWidth), Math.round(((1 - q.y) / 2) * innerHeight)];
          };
          const o = {};
          for (const k of ['tip', 'hand', 'com', 'foot']) o[k] = R.pts[k].map(px);
          return o;
        }, v);
        if (v !== 'game') await page.evaluate(() => window.__pump(1, 0)); // 새 카메라로 한 번 그린다 (시간은 안 간다)
        const fn = path.join(OUT, `film_${TAG}${preset ? '_' + preset : ''}_${String(cell.want).padStart(4, '0')}_${v}.png`);
        await page.screenshot({ path: fn, timeout: 180000 }); // 컴퓨터가 바쁘면 소프트웨어 GL 그리기가 30초를 넘는다
        if (v !== 'game')
          await page.evaluate(() => {
            const g = window.game;
            g.freeCam = false;
            g.camera.position.copy(g.__saved.p);
            g.camera.quaternion.copy(g.__saved.q);
          });
        cell.img[v] = fn;
        cell.ov[v] = ov;
      }
      cell.row = await page.evaluate(() => window.__rec.rows[window.__rec.rows.length - 1] || null);
      shots.push(cell);
      next++;
    };
    const startRec = () =>
      page.evaluate(() => {
        window.__rec.on = true;
        window.__rec.t0 = window.__now;
      });
    const nowMs = () => page.evaluate(() => window.__now - window.__rec.t0);
    const until = SHOTS[SHOTS.length - 1] + 20;
    const finish = async (extra) => {
      for (let i = 0; i < 400 && next < SHOTS.length; i++) {
        if (extra) await extra();
        await frame();
        await shoot();
        if ((await nowMs()) > until) break;
      }
    };
    let h1 = [0, 0];
    let cutStart = 0;
    let stepInfo = null;
    trace.push([finger.x, finger.y]);
    if (TYPE === 'walk') {
      // 조이스틱 (input.stickMove = 화면 왼쪽 조이스틱이 넣는 값) 을 holdMs 동안 끝까지 민 뒤 놓는다
      await startRec();
      await shoot();
      await page.evaluate((d) => (game.input.stickMove = { x: d[0], y: d[1] }), SC.stick);
      await finish(async () => {
        if ((await nowMs()) >= SC.holdMs) await page.evaluate(() => (game.input.stickMove = { x: 0, y: 0 }));
      });
    } else if (TYPE === 'tap') {
      // 화면을 톡: 누르고 tapMs 안에 뗀다 → input.taps → main.js 가 skill.thrust()
      await startRec();
      await shoot();
      await send('pointerdown', finger.x, finger.y);
      await frame();
      await send('pointerup', finger.x, finger.y);
      await finish();
    } else if (TYPE === 'ai') {
      // AI 가 기술 걸음을 부탁해 받아들여진 순간부터 찍는다 (최대 25초 기다림)
      await page.evaluate(() => {
        const E = game.enemy;
        const orq = E.gait.requestStep.bind(E.gait);
        window.__req = null;
        E.gait.requestStep = (o) => {
          const ok = orq(o);
          if (ok && !window.__req) window.__req = { ...o, t: window.__now };
          return ok;
        };
      });
      for (let i = 0; i < 25 * 60; i++) {
        await frame();
        if (await page.evaluate(() => !!window.__req)) break;
      }
      stepInfo = await page.evaluate(() => window.__req);
      await startRec();
      await shoot();
      await finish();
    } else {
      await send('pointerdown', finger.x, finger.y);
      if (SC.ch) {
        const h = await handNow();
        await drag(SC.ch[0] - h[0], SC.ch[1] - h[1], 1.2);
        for (let i = 0; i < 24; i++) await frame();
      }
      cutStart = trace.length - 1;
      h1 = await handNow();
      await startRec();
      await shoot();
      await drag(SC.end[0] - h1[0], SC.end[1] - h1[1], SC.v, shoot);
      await send('pointerup', finger.x, finger.y);
      await finish();
    }
    const rows = await page.evaluate(() => window.__rec.rows);
    const hits = await page.evaluate(() => game.stats.hits.slice(-3));
    const summ = {
      preset,
      setup: info,
      d0: info.d,
      handChordMax: Math.max(...rows.map((r) => r.handChord)),
      comFwdMax: Math.max(...rows.map((r) => r.comFwd)),
      comDistEnd: rows.length ? rows[rows.length - 1].comDist : null,
      stepReq: stepInfo,
      pelvisRange: [Math.min(...rows.map((r) => r.pelvis)), Math.max(...rows.map((r) => r.pelvis))],
      chestRange: [Math.min(...rows.map((r) => r.chest)), Math.max(...rows.map((r) => r.chest))],
      tipVmax: Math.max(...rows.map((r) => r.tipV)),
      stopFrames: rows.filter((r) => r.stop).length,
      stages: [...new Set(rows.map((r) => r.stage))].join(''),
      hits,
    };
    console.log(TAG, preset || '', JSON.stringify(summ));

    // ── 한 장으로 묶기 ──
    const cw = Math.min(300, Math.round(2400 / SHOTS.length));
    const ch = Math.round((cw * H) / W);
    const sx = cw / W;
    const poly = (a, col, w = 2) => (a.length > 1 ? `<polyline fill="none" stroke="${col}" stroke-width="${w}" points="${a.map((p) => `${(p[0] * sx).toFixed(1)},${(p[1] * sx).toFixed(1)}`).join(' ')}"/>` : '');
    const dots = (a, col, r = 2.5) => a.map((p) => `<circle cx="${(p[0] * sx).toFixed(1)}" cy="${(p[1] * sx).toFixed(1)}" r="${r}" fill="${col}"/>`).join('');
    const img = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
    const tr = trace.map((p) => [p[0] - trace[0][0], p[1] - trace[0][1]]);
    const minX = Math.min(...tr.map((p) => p[0]));
    const minY = Math.min(...tr.map((p) => p[1]));
    const trSvg = `<svg width="170" height="120" style="background:#222;border:1px solid #444"><g transform="translate(${15 - minX * 0.3},${15 - minY * 0.3}) scale(0.3)">${`<polyline fill="none" stroke="#888" stroke-width="5" points="${tr.slice(0, cutStart + 1).map((p) => p.join(',')).join(' ')}"/>`}${`<polyline fill="none" stroke="#fc4" stroke-width="7" points="${tr.slice(cutStart).map((p) => p.join(',')).join(' ')}"/>`}<circle cx="${tr[tr.length - 1][0]}" cy="${tr[tr.length - 1][1]}" r="10" fill="#fc4"/></g></svg>`;
    let html = `<html><head><meta charset="utf-8"></head><body style="margin:0;background:#111;color:#eee;font:12px sans-serif"><div style="display:flex;gap:10px;padding:4px;align-items:center">${trSvg}<div><b>${SCENE}</b> · ${MODE} · 온몸 베기 ${OFF ? '끔' : '켬'} · 걸음 방향 고침(GAIT.fwdFix) ${FIXOFF ? '끔' : '켬'}${stepInfo ? ` · AI 걸음 부탁 ${stepInfo.kind} ${stepInfo.fwd} m` : ''}${preset ? ' · 구도 ' + preset : ''} · ${W}×${H} · 상대 ${info.d} m · ${SC.v ? `긋기 ${SC.v} m/s (회색 = 준비 자세로 옮기기, 노랑 = 긋기)` : TYPE === 'walk' ? `조이스틱 (${SC.stick}) ${SC.holdMs} ms 민 뒤 놓음` : TYPE === 'tap' ? '화면 톡 (탭 찌르기)' : 'AI 기술 걸음 부탁부터'}<br>줄: 폰 게임 카메라 · 옆(내 왼쪽) · 앞 비스듬히 · 빨강 칼끝 · 노랑 손 · 하늘 무게중심 바닥 점 · 초록 발 · hits: ${hits.join(' | ') || '-'}</div></div><table cellspacing="2">`;
    for (const v of views) {
      html += '<tr>';
      for (const c of shots) {
        const o = c.ov[v];
        html += `<td style="vertical-align:top"><div>${v} ${c.ms} ms${c.row?.stop ? ' <span style="color:#f66">멈칫</span>' : ''}</div><div style="position:relative;width:${cw}px;height:${ch}px"><img width="${cw}" height="${ch}" src="${img(c.img[v])}"><svg width="${cw}" height="${ch}" style="position:absolute;left:0;top:0">${dots(o.foot, '#3d6', 2)}${poly(o.com, '#6cf', 2)}${poly(o.hand, '#fc4', 2)}${poly(o.tip, '#f44', 2)}</svg></div>`;
        if (v === 'side' && c.row) html += `<div style="font-size:11px;color:#bbb">손 ${c.row.handChord} m · 몸 ${c.row.comFwd} m (이동 ${c.row.comDist}) · 발 ${c.row.feet}<br>골반 ${c.row.pelvis}° 가슴 ${c.row.chest}° · 결심 ${c.row.stage} · 칼끝 ${c.row.tipV} m/s</div>`;
        html += '</td>';
      }
      html += '</tr>';
    }
    html += '</table></body></html>';
    const p2 = await ctx.newPage();
    await p2.setViewportSize({ width: shots.length * (cw + 2) + 8, height: 3 * (ch + 22) + 200 });
    await p2.setContent(html);
    const strip = path.join(OUT, `strip_${TAG}${preset ? '_' + preset : ''}.png`);
    await p2.screenshot({ path: strip, fullPage: true });
    await p2.close();
    for (const c of shots) for (const v of views) fs.unlinkSync(c.img[v]); // 칸 사진은 묶음에 들어갔다
    report.runs.push({ ...summ, strip, rows });
    console.log('연속 사진:', strip);
    if (presets.length > 1) {
      await page.evaluate(() => (window.__rec.on = false));
      await page.reload({ waitUntil: 'load' }); // 다음 구도는 새 판에서
      await page.waitForFunction(() => window.game && window.game.player, null, { timeout: 60000 });
      await page.waitForTimeout(600);
      await page.tap('#btnStart');
      await page.waitForTimeout(300);
      await page.evaluate(() => (window.__manual = true));
      await page.waitForFunction(() => window.__rafQ.length > 0, null, { timeout: 60000, polling: 100 });
    }
  }
  report.pageErrors = errors;
  if (errors.length) console.log('페이지 오류:', errors.join(' | '));
  fs.writeFileSync(path.join(OUT, `film_${TAG}.json`), JSON.stringify(report, null, 1));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
