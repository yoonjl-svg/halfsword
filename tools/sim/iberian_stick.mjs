// ─────────────────────────────────────────────────────────────
//  iberian_stick.mjs — 이베리아 휘감아 돌기 스틱 판 재기 (10/23 — src/stick_turn.js · secret.js PlayerSecretWatch.spinStick · docs/strike/iberian_spin_2026-10-22.md §10)
//
//  (--once: 걷기 흉내를 옮김 한 번만 — 옮김 하나당 잘못 나갈 몫)
//  node tools/sim/iberian_stick.mjs drives [--n=400] [--fps=60,30] [--turn=180] [--time=0.6] [--path=1] [--rate=0] [--from=0]   ·   drives --variants [--fps=60]  (판 값과 막기 후보 견줌 한 표)
//     몸 없이 몸짓 읽기만: 걷기 흉내 스틱 운전(무장이 내내 켜진 셈)으로 잘못 나간 몫 · 일부러 돌린 운전으로 나간 몫.
//     엄지 자리(원값 — 조이스틱 반지름 1 · 40 px 눈금으로 반올림) → input.js attachStick 과 같은 데드존 사상 → stickTurnStep. 키보드는 여덟 방향 단위 벡터.
//     잘못 나감 = 한 운전(6 s) 안에 한 번이라도 참 · 분당 수는 참이 되면 셈을 비우고 이어 셈
//  node tools/sim/iberian_stick.mjs sway [--weapons=zweihander,flamberge] [--foes=still,isolde,tome,minami] [--times=0.3,0.45,0.6] [--turn=200] [--seeds=1-2]
//     몸 흔들림: 무장(금색 '!') 뒤 스틱을 엄지로 밀어(0.06 s) 반 바퀴를 times 초에 돌려 낸다 — 그동안 몸은 스틱대로 걷는다(main.js 와 같이 move = 스틱).
//     잰 것: 몸짓 시작 → 낸 때 골반이 간 거리 · 상대 가슴 거리 바뀜 · 몸짓 동안 무장이 풀린 몫 · 낸 뒤 맞힘(칼날 상처) · 견줌 = 같은 때 곧장 낸 판(공격 입력 판)
//     still = 멈춘 롱소드 상대(칼 충돌 켠 채) · 그 밖 = 인물 AI(characters.js). 무장 기다리는 봇은 iberian_spin.mjs duel 과 같다(가까우면 물러서고 멀면 다가섬 ·
//     무장되면 칼끝 거리 + 0.6 m 안까지 다가선 뒤 몸짓)
// ─────────────────────────────────────────────────────────────
import { stickTurnState, stickTurnStep, stickTurnClear, STICK_DEAD } from '../../src/stick_turn.js';

const MODE = process.argv[2];
if (!['drives', 'sway'].includes(MODE)) throw new Error('첫 인자: drives | sway');
const args = {};
for (const a of process.argv.slice(3)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const range = (s) => {
  const out = [];
  for (const p of String(s).split(',')) {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(+p);
  }
  return out;
};
const R = Math.PI / 180;

/** 결정적 난수 */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 엄지 원값 → input.move (input.js attachStick 과 같은 사상: 반지름 1 로 자름 · 40 px 눈금 · 데드존 0.15 안 0 · 밖은 0 ~ 1 로 다시 폄) */
function stickOut(x, y) {
  let m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  x = Math.round(x * 40) / 40;
  y = Math.round(y * 40) / 40;
  m = Math.hypot(x, y);
  const k = m < STICK_DEAD ? 0 : (m - STICK_DEAD) / (1 - STICK_DEAD) / m;
  return [x * k, y * k];
}

/** 엄지 길 만들기 (프레임마다 원값 한 점) */
class Trace {
  constructor(fps, rnd) {
    this.dt = 1 / fps;
    this.rnd = rnd;
    this.s = [];
    this.p = [0, 0];
    this.wob = 0;
    this.once = false; // 참이면 옮김 한 번만 (옮김 하나당 잘못 나갈 몫)
    this.moves = 0;
  }
  more() {
    if (this.once) return this.moves++ < 1;
    return this.s.length * this.dt < 6;
  }
  U(a, b) {
    return a + (b - a) * this.rnd();
  }
  N() {
    return Math.sqrt(-2 * Math.log(this.rnd() + 1e-12)) * Math.cos(2 * Math.PI * this.rnd());
  }
  frames(dur) {
    return Math.max(1, Math.round(dur / this.dt));
  }
  push(x, y) {
    this.p = [x, y];
    this.s.push([x, y]);
  }
  /** 한 자리에 dur (엄지 떨림: 각 OU σ° · τ 0.25 s · 크기 ±0.04) */
  hold(aDeg, r, dur, sig = 6) {
    const n = this.frames(dur);
    const k = Math.exp(-this.dt / 0.25);
    for (let i = 0; i < n; i++) {
      this.wob = this.wob * k + sig * Math.sqrt(1 - k * k) * this.N();
      const a = (aDeg + this.wob) * R;
      const rr = r + 0.04 * this.N();
      this.push(rr * Math.cos(a), rr * Math.sin(a));
    }
  }
  /** 곧은 길 (부드럽게 — smoothstep) */
  line(x, y, dur) {
    const [x0, y0] = this.p;
    const n = this.frames(dur);
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const e = u * u * (3 - 2 * u);
      this.push(x0 + (x - x0) * e, y0 + (y - y0) * e);
    }
  }
  /** 둥근 길: 지금 각에서 delta° 만큼 반지름 r 로 (부드럽게) · 각 떨림 σ° */
  arc(delta, r, dur, sig = 1.5) {
    const a0 = Math.atan2(this.p[1], this.p[0]) / R;
    const n = this.frames(dur);
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      const e = u * u * (3 - 2 * u);
      const a = (a0 + delta * e + sig * this.N()) * R;
      const rr = r + 0.03 * this.N();
      this.push(rr * Math.cos(a), rr * Math.sin(a));
    }
  }
  release(dur) {
    for (let i = 0; i < this.frames(dur); i++) this.push(0, 0);
  }
  /** 키보드: 여덟 방향 상태 (dx, dy ∈ −1 · 0 · 1) 를 dur 동안 */
  key(dx, dy, dur) {
    const m = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < this.frames(dur); i++) this.push(dx / m, dy / m);
  }
}

const polar = (aDeg, r) => [r * Math.cos(aDeg * R), r * Math.sin(aDeg * R)];

// 걷기 흉내 운전 (무장 동안 보통 걷기 — 6 s) · kb = 키보드
const WALK = {
  // 상대 둘레 돌기: 옆으로 쥔 채(앞뒤로 조금 기욺 · 엄지 떨림) · 가끔 놓았다가 반대쪽
  strafe(T) {
    let side = T.rnd() < 0.5 ? 1 : -1;
    while (T.more()) {
      T.hold((side > 0 ? 0 : 180) + T.U(-30, 30), T.U(0.7, 1), T.U(1.2, 3), 8);
      T.release(T.U(0.08, 0.3));
      side = -side;
    }
  },
  // 둘레 돌기 방향 바꿈: 놓지 않고 곧게 반대 옆으로 (가운데에서 앞뒤로 ε 떨어진 길)
  strafeFlip(T) {
    let side = T.rnd() < 0.5 ? 1 : -1;
    T.hold(side > 0 ? 0 : 180, 0.9, T.U(0.3, 1));
    while (T.more()) {
      side = -side;
      const e = T.U(-0.35, 0.35);
      T.line(side * 0.9, e, T.U(0.06, 0.3));
      T.hold(Math.atan2(e, side * 0.9) / R, 0.9, T.U(0.4, 1.2), 6);
    }
  },
  // 앞뒤 오가기: 앞 ↔ 뒤 를 곧게 (가운데에서 옆으로 ε 떨어진 길)
  fwdBack(T) {
    let up = 1;
    T.hold(90, 0.9, T.U(0.3, 1));
    while (T.more()) {
      up = -up;
      const e = T.U(-0.35, 0.35);
      T.line(e, up * 0.9, T.U(0.06, 0.3));
      T.hold(Math.atan2(up * 0.9, e) / R, 0.9, T.U(0.3, 1), 6);
    }
  },
  // 앞에서 뒤로 휙 당김: 한두 프레임에 가운데를 건너 (ε ±0.15)
  flick(T) {
    let up = 1;
    T.hold(90, 0.95, T.U(0.4, 1));
    while (T.more()) {
      up = -up;
      const e = T.U(-0.15, 0.15);
      T.line(e, up * 0.95, T.dt * (T.rnd() < 0.5 ? 1 : 2));
      T.hold(Math.atan2(up * 0.95, e) / R + T.U(-10, 10), 0.95, T.U(0.3, 0.9), 6);
    }
  },
  // 비켜 서기 둥글게: 옆 → 앞(또는 뒤)을 둘러 → 반대 옆 (테두리를 따라 — 끝 각 ±20°)
  sideArc(T) {
    let a = T.rnd() < 0.5 ? 0 : 180;
    T.hold(a, 0.9, T.U(0.3, 1));
    while (T.more()) {
      const to = (a < 90 ? 180 : 0) + T.U(-20, 20);
      const cur = Math.atan2(T.p[1], T.p[0]) / R;
      let d = to - cur;
      const viaFront = T.rnd() < 0.7; // 앞으로 둘러 가는 쪽이 흔하다고 봄
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      // 앞(90°)을 지나도록 쪽을 고름
      const mid = cur + d / 2;
      const front = Math.sin(mid * R) > 0;
      if (front !== viaFront) d = d > 0 ? d - 360 : d + 360;
      T.arc(d, T.U(0.7, 1), T.U(0.15, 0.5));
      a = to;
      T.hold(to, 0.9, T.U(0.3, 1), 6);
    }
  },
  // 앞뒤 둥글게: 앞 → 옆을 둘러 → 뒤 (끝 각 ±20°)
  fwdArc(T) {
    let up = 1;
    T.hold(90, 0.9, T.U(0.3, 1));
    while (T.more()) {
      up = -up;
      const to = up * 90 + T.U(-20, 20);
      const cur = Math.atan2(T.p[1], T.p[0]) / R;
      let d = to - cur;
      while (d > 180) d -= 360;
      while (d < -180) d += 360;
      if (T.rnd() < 0.5) d = d > 0 ? d - 360 : d + 360;
      if (Math.abs(d) > 230) d = d > 0 ? d - 360 : d + 360;
      T.arc(d, T.U(0.7, 1), T.U(0.15, 0.5));
      T.hold(to, 0.9, T.U(0.3, 1), 6);
    }
  },
  // 대각 지그재그로 다가섬: 앞 왼 ↔ 앞 오른 (곧게)
  zigzag(T) {
    let s = 1;
    T.hold(90 + 45 * s, 0.9, T.U(0.3, 0.8));
    while (T.more()) {
      s = -s;
      const [x, y] = polar(90 + 45 * s + T.U(-10, 10), 0.9);
      T.line(x, y, T.U(0.1, 0.3));
      T.hold(90 + 45 * s, 0.9, T.U(0.3, 0.8), 6);
    }
  },
  // 떠돌기: 각 빠르기가 OU(σ ω° /s · τ 0.4 s)로 떠돎 · 가끔 놓음
  wander(T, w = 120) {
    let a = T.U(0, 360);
    let om = 0;
    const k = Math.exp(-T.dt / 0.4);
    while (T.once || T.more()) {
      if (T.rnd() < 0.3 * T.dt) {
        T.release(T.U(0.1, 0.4));
        continue;
      }
      if (T.once && T.s.length * T.dt > 1) break;
      om = om * k + w * Math.sqrt(1 - k * k) * T.N();
      a += om * T.dt;
      const r = 0.85 + 0.1 * T.N();
      T.push(...polar(a, r));
    }
  },
  wanderFast(T) {
    WALK.wander(T, 240);
  },
  // 키보드: 앞 → 옆 → 뒤 굴리기 (W → WA → A → AS → S, 상태마다 0.08 ~ 0.3 s) · 다시 앞으로
  kbRoll(T) {
    let up = 1;
    T.key(0, 1, T.U(0.3, 1));
    while (T.more()) {
      const sx = T.rnd() < 0.5 ? 1 : -1;
      up = -up;
      T.key(sx, -up, T.U(0.08, 0.3));
      T.key(sx, 0, T.U(0.08, 0.3));
      T.key(sx, up, T.U(0.08, 0.3));
      T.key(0, up, T.U(0.3, 1));
    }
  },
  // 키보드: 앞 ↔ 뒤 (놓고 누름 · 한 프레임에 바꿔 누름 · 둘 다 눌림 = 0)
  kbFlip(T) {
    let up = 1;
    T.key(0, 1, T.U(0.3, 1));
    while (T.more()) {
      up = -up;
      const r = T.rnd();
      if (r < 0.33) T.release(T.U(0.03, 0.1));
      else if (r < 0.66) T.key(0, 0, T.dt);
      T.key(0, up, T.U(0.3, 1));
    }
  },
  // 키보드: 옆 ↔ 옆
  kbSide(T) {
    let s = 1;
    T.key(1, 0, T.U(0.3, 1));
    while (T.more()) {
      s = -s;
      if (T.rnd() < 0.5) T.release(T.U(0.03, 0.1));
      T.key(s, 0, T.U(0.3, 1));
    }
  },
  // 키보드: 둘레 돌며 앞뒤 고침 (D ↔ WD · SD — 옆 ±45°)
  kbStrafe(T) {
    const s = T.rnd() < 0.5 ? 1 : -1;
    while (T.more()) {
      T.key(s, 0, T.U(0.2, 0.8));
      T.key(s, T.rnd() < 0.5 ? 1 : -1, T.U(0.1, 0.4));
    }
  },
  // 키보드: 아무렇게나 걷기 — 0.12 ~ 0.6 s 마다 이웃 방향(±45° · ±90°) 또는 놓음
  kbWalk(T) {
    const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    let i = Math.floor(T.rnd() * 8);
    while (T.more()) {
      const r = T.rnd();
      if (r < 0.1) {
        T.release(T.U(0.05, 0.3));
      } else {
        const step = [1, -1, 2, -2][Math.floor(T.rnd() * 4)];
        i = (i + step + 8) % 8;
        T.key(D[i][0], D[i][1], T.U(0.12, 0.6));
      }
    }
  },
};
const KB = new Set(['kbRoll', 'kbFlip', 'kbSide', 'kbStrafe', 'kbWalk']);

// 일부러 돌리는 운전: 엄지를 밀고(0.06 s — 반지름 방향이라 각이 안 바뀜) 둥글게 돌리고 놓음
const AIM = (turn, dur, sig = 1.5) => (T) => {
  T.release(0.2);
  const a0 = T.U(0, 360);
  const dir = T.rnd() < 0.5 ? 1 : -1;
  T.line(...polar(a0, T.U(0.75, 1)), 0.06);
  T.arc(dir * (turn + T.U(-10, 10)), T.U(0.7, 1), dur, sig);
  T.release(0.3);
};
const KB_AIM = (dur) => (T) => {
  // 놓았다가 W(조금 쥐고) → WD → D → SD → S (상태마다 dur / 4)
  const D = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1]];
  const flip = T.rnd() < 0.5 ? -1 : 1;
  T.release(0.2);
  T.key(0, 1, T.U(0.05, 0.2));
  for (let i = 1; i < D.length; i++) T.key(D[i][0] * flip, D[i][1], dur / 4);
  T.release(0.3);
};
// 걷던 스틱을 놓지 않고 곧장 돌림 (쥐고 0.4 ~ 1 s 걷다가 그 자리에서 반 바퀴)
const WALK_AIM = (turn, dur) => (T) => {
  const a0 = T.U(0, 360);
  const dir = T.rnd() < 0.5 ? 1 : -1;
  T.line(...polar(a0, 0.9), 0.06);
  T.hold(a0, 0.9, T.U(0.4, 1), 4);
  T.arc(dir * (turn + T.U(-10, 10)), T.U(0.7, 1), dur);
  T.release(0.3);
};
const DELIB = {
  half30: AIM(200, 0.3),
  half45: AIM(200, 0.45),
  half60: AIM(200, 0.6),
  full30: AIM(360, 0.3),
  full45: AIM(360, 0.45),
  full60: AIM(360, 0.6),
  exact45: AIM(180, 0.45, 0), // 딱 반 바퀴 (±10° 흩뜨림 포함)
  short45: AIM(160, 0.45), // 반 바퀴에 못 미침 (나가면 안 됨)
  walkHalf30: WALK_AIM(200, 0.3),
  walkHalf45: WALK_AIM(200, 0.45),
  kbHalf30: KB_AIM(0.3),
  kbHalf45: KB_AIM(0.45),
  kbHalf60: KB_AIM(0.6),
};

function runTrace(samples, dt, opt) {
  const st = stickTurnState();
  let fires = 0;
  for (const [x, y] of samples) {
    if (stickTurnStep(st, dt, x, y, opt)) {
      fires++;
      stickTurnClear(st);
    }
  }
  return fires;
}

// 견줌 판 (--variants): 판 값 · 가운데 건너뜀 끔 · 0.4 s · 느린 흐름 안 셈 · 가운데에서 밀어 시작 · 270° · 360°
const VARIANTS = {
  '판 값': {},
  'path 0': { path: false },
  '0.4 s': { time: 0.4 },
  'rate 1': { rate: true },
  'from 1': { from: true },
  '270°': { need: 270 * R },
  '360°': { need: 360 * R },
};

function variants() {
  const N = +arg('n', 400);
  const fps = +list('fps', '60')[0];
  const base = { time: 0.6, need: 180 * R, path: true, rate: false, from: false };
  const names = Object.keys(VARIANTS);
  const rate = (name, gen, opt) => {
    let any = 0;
    for (let i = 0; i < N; i++) {
      const T = new Trace(fps, rng(1000 * fps + i * 7919 + name.length * 131));
      T.once = !!args.once;
      if (WALK[name]) T.release(0.2); // 걷기 흉내는 서 있다가(스틱 놓음) 시작 — 무장을 기다리던 자리
      gen(T);
      const S = name.startsWith('kb') ? T.s : T.s.map(([x, y]) => stickOut(x, y));
      if (runTrace(S, T.dt, opt)) any++;
    }
    return ((any / N) * 100).toFixed(1);
  };
  console.log(`${fps} fps · 운전마다 ${N} 번 · 칸 = 걷기 흉내는 잘못 나간 판(${args.once ? '옮김 한 번' : '6 s 안에 한 번이라도'}) % · 일부러 돌림은 나간 몫 %`);
  console.log('| 운전 | ' + names.join(' | ') + ' |');
  console.log('|---|' + names.map(() => '---|').join(''));
  for (const [k, g] of [...Object.entries(WALK), ...Object.entries(DELIB)]) console.log(`| ${k} | ` + names.map((n) => rate(k, g, { ...base, ...VARIANTS[n] })).join(' | ') + ' |');
}

function drives() {
  if (args.variants) return variants();
  const N = +arg('n', 400);
  const FPS = list('fps', '60,30').map(Number);
  const opt = { time: +arg('time', 0.6), need: +arg('turn', 180) * R, path: arg('path', '1') !== '0', rate: arg('rate', '0') === '1', from: arg('from', '0') === '1' };
  console.log(`몸짓: ${opt.need / R}° · ${opt.time} s · path ${opt.path ? 1 : 0} · 운전마다 ${N} 번`);
  const row = (name, gen, fps) => {
    let any = 0;
    let fires = 0;
    let secs = 0;
    for (let i = 0; i < N; i++) {
      const T = new Trace(fps, rng(1000 * fps + i * 7919 + name.length * 131));
      if (WALK[name]) T.release(0.2);
      gen(T);
      const S = KB.has(name) || name.startsWith('kb') ? T.s : T.s.map(([x, y]) => stickOut(x, y));
      const f = runTrace(S, T.dt, opt);
      fires += f;
      if (f) any++;
      secs += T.s.length * T.dt;
    }
    return { any: any / N, perMin: (fires / secs) * 60 };
  };
  console.log('\n| 걷기 흉내 (6 s · 무장 내내) | ' + FPS.map((f) => `${f} fps 잘못 나간 판 · 분당`).join(' | ') + ' |');
  console.log('|---|' + FPS.map(() => '---|').join(''));
  for (const [k, g] of Object.entries(WALK)) console.log(`| ${k} | ` + FPS.map((f) => { const r = row(k, g, f); return `${(r.any * 100).toFixed(1)} % · ${r.perMin.toFixed(2)}`; }).join(' | ') + ' |');
  console.log('\n| 일부러 돌림 | ' + FPS.map((f) => `${f} fps 나간 몫`).join(' | ') + ' |');
  console.log('|---|' + FPS.map(() => '---|').join(''));
  for (const [k, g] of Object.entries(DELIB)) console.log(`| ${k} | ` + FPS.map((f) => `${(row(k, g, f).any * 100).toFixed(1)} %`).join(' | ') + ' |');
}

async function sway() {
  const { newRound, DT, CONFIG } = await import('./harness_m.mjs');
  const { PlayerSecretWatch } = await import('../../src/secret.js');
  const { CHARACTERS } = await import('../../src/characters.js');
  const { SKILL, SECRET } = CONFIG;
  const BY = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
  const WEAPONS = list('weapons', 'zweihander,flamberge');
  const FOES = list('foes', 'still,isolde,tome,minami');
  const TIMES = list('times', '0.3,0.45,0.6').map(Number);
  const TURN = +arg('turn', 200);
  const SEEDS = range(arg('seeds', '1-2'));
  const out = [];
  for (const w of WEAPONS) for (const foe of FOES) for (const seed of SEEDS) {
    out.push(swayRun(w, foe, seed, 0, 1, 0)); // 견줌: 곧장 냄 (몸짓 시간 0 — 공격 입력 판과 같은 때)
    for (const T of TIMES) for (const dir of [1, -1]) for (const a0 of [0, 90, 180, 270]) out.push(swayRun(w, foe, seed, T, dir, a0));
  }
  // 묶어 적기
  const groups = new Map();
  for (const r of out) {
    const k = `${r.w} · ${r.T ? `${r.T} s` : '곧장(공격 입력 판)'}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  console.log(`\n반 바퀴 ${TURN}° (±0) · 엄지 밀기 0.06 s · 상대 ${FOES.join(',')} · 시드 ${SEEDS.join(',')}`);
  console.log('| 무기 · 몸짓 시간 | 판 | 무장 풀림 (몸짓 동안) | 낸 몫 | 골반 간 거리 평균 · 최대 (m) | 상대 가슴 거리 바뀜 평균 · 최소 · 최대 (m) | 낸 때 거리 < 칼끝 거리 | 맞힘 |');
  console.log('|---|---|---|---|---|---|---|---|');
  const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  for (const [k, rs] of groups) {
    const ok = rs.filter((r) => r.fired);
    const tr = ok.map((r) => r.travel);
    const dd = ok.map((r) => r.dd);
    console.log(`| ${k} | ${rs.length} | ${rs.filter((r) => r.lost).length} | ${ok.length} | ${mean(tr).toFixed(2)} · ${Math.max(0, ...tr).toFixed(2)} | ${mean(dd) >= 0 ? '+' : ''}${mean(dd).toFixed(2)} · ${Math.min(...dd).toFixed(2)} · ${Math.max(...dd).toFixed(2)} | ${ok.filter((r) => r.inside).length} | ${ok.filter((r) => r.hit).length} |`);
  }
  if (args.json) (await import('node:fs')).writeFileSync(args.json, JSON.stringify(out, null, 1));

  function swayRun(w, foeId, seed, T, dir, a0) {
    const ch = foeId === 'still' ? null : BY[foeId];
    if (foeId !== 'still' && !ch) throw new Error(`인물 ${foeId}?`);
    const opts = ch ? { seed, weapon: w, weapon2: ch.weapon, difficulty: ch.ai.level, persona: ch.ai.persona, look2: ch.look, revive: ch.revive } : { seed, weapon: w, weapon2: 'longsword', gap: 3.2 };
    const G = newRound(opts);
    const P = G.player, E = G.enemy;
    P.skill.corr = SKILL.corr;
    P.skill.corrTip = SKILL.corrTip;
    P.skill.autoGuard = true;
    if (!ch) G.ai.update = () => E.move.set(0, 0);
    const W = new PlayerSecretWatch(P, E, { locked: false });
    const M = P.swordArt.measure;
    const res = { w, foe: foeId, seed, T, dir, a0, fired: false, lost: false, travel: 0, dd: 0, inside: false, hit: false };
    let g = null; // 몸짓 { t0, p0, d0, k }
    let fireT = null;
    const w0 = G.wounds.length;
    const setStick = (x, y) => {
      P.move.set(x, y);
      P.stickX = x;
      P.stickY = y;
    };
    G.before = () => {
      W.update(DT, !!P.skill.sec);
      const d = P.foeDistance();
      if (fireT != null || P.skill.sec) return setStick(0, 0);
      const armed = W.open?.ctx?.ev === 'spin';
      if (!g) {
        if (armed && G.t > 2.6 && d > M.reach + 0.6) {
          setStick(0, 0.6); // 무장된 채 칼끝 거리 + 0.6 m 안까지 다가섬 (iberian_spin.mjs duel 의 FIRE 0.6 과 같은 봇)
          return;
        }
        if (armed && G.t > 2.6) { // 판 시작 발 묶임(startHold 2 s) 뒤
          // 몸짓 시작
          const p = P.bodies.pelvis.translation();
          g = { t0: G.t, p0: { x: p.x, z: p.z }, d0: d, k: 0 };
          if (T === 0) {
            g.k = Infinity;
          }
        } else {
          setStick(0, armed ? 0 : d < M.reach + 0.1 ? -1 : d > M.reach + 0.8 ? 0.6 : 0); // 무장 기다리기 (iberian_spin.mjs duel 과 같은 봇)
          return;
        }
      }
      // 몸짓: 0 ~ 0.06 s 엄지를 a0 쪽으로 밂 · 그 뒤 T 초에 dir × TURN° · 다 돌면 그 자리
      const u = G.t - g.t0;
      let x = 0, y = 0;
      if (T > 0) {
        const r = Math.min(1, u / 0.06) * 0.9;
        const v = Math.min(1, Math.max(0, (u - 0.06) / T));
        const e = v * v * (3 - 2 * v);
        const a = (a0 + dir * TURN * e) * R;
        [x, y] = stickOut(r * Math.cos(a), r * Math.sin(a));
      }
      if (!armed && !res.fired) {
        res.lost = true;
        fireT = G.t;
        return setStick(0, 0);
      }
      setStick(x, y);
      const go = T === 0 ? armed : W.spinStick(DT, { x, y }, !P.stamina.exhausted && P.alive);
      if (go) {
        const p = P.bodies.pelvis.translation();
        res.travel = Math.hypot(p.x - g.p0.x, p.z - g.p0.z);
        res.dd = d - g.d0;
        res.inside = d < M.reach;
        const o = W.fire();
        res.fired = !!o && P.skill.secret(o);
        fireT = G.t;
        setStick(0, 0);
      } else if (u > T + 0.5) {
        fireT = G.t; // 다 돌았는데 안 나감 (몸짓 읽기 실패)
      }
    };
    while (G.t < 25 && P.alive && E.alive && (fireT == null || G.t < fireT + 1.2)) G.step();
    if (res.fired) res.hit = G.wounds.slice(w0).some((x) => x.att === P && x.vic === E && x.severity > 0 && x.t >= fireT);
    G.world.free();
    return res;
  }
}

if (MODE === 'drives') drives();
else await sway();
