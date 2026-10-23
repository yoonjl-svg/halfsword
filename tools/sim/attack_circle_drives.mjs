// ─────────────────────────────────────────────────────────────
//  attack_circle_drives.mjs — 공격 원 그리기 몸짓 읽기 재기 (10/24 — src/attack_circle.js · 싱지르 공격 원 판 · docs/strike/iberian_spin_2026-10-22.md §14)
//   몸 없이 몸짓 읽기만: 손가락(화면 px) 길을 흉내 내어 main.js 와 같은 손 움직임(터치 = mobile_intent — 폰 가로 높이 390 px · 세로 1.35 배 · 마우스 0.0045 m/px)으로 바꿔 넣는다.
//   ① 일부러 그린 원 — 한 바퀴 시간 · 반지름 · 닫는 각(넘침 · 모자람) · 빠르기 흔들림 · 반지름 흔들림 · 가운데 흐름 · 손 떨림
//   ② 보통 공격 — 곧은 긋기 · 휜 긋기(60 ~ 270°) · 오가기(V · U) · 작은 원(자세 비틀기) · 마우스 쉼 없이 움직이기(6 s)
//  node tools/sim/attack_circle_drives.mjs [--n=400] [--times=0.6,1.5] [--r=0.15] [--inner=0.5] [--dev=touch,mouse]
// ─────────────────────────────────────────────────────────────
import { circleState, circleStep } from '../../src/attack_circle.js';
import { INPUT, SECRET } from '../../src/config.js';
import { mapMobileHandDelta } from '../../src/mobile_intent.js';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const N = +arg('n', 400);
const TIMES = String(arg('times', '0.6,1.5')).split(',').map(Number);
const RMIN = +arg('r', SECRET.ibSpin.circleR);
const DEVS = String(arg('dev', 'touch,mouse')).split(',');
const INNER = args.inner != null ? +args.inner : SECRET.ibSpin.circleInner; // 가운데 문턱 (반지름의 몫 — 판 값 SECRET.ibSpin.circleInner)
const F = 1 / 60;
const H = 390; // 폰 가로 화면 높이 (CSS px)

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
const gauss = (R) => Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());

/** px 길 (프레임마다 [x, y, down]) → 몸짓 읽기. 참이 된 적 있나 */
function run(frames, dev, time) {
  const st = circleState();
  const o = { time, need: 2 * Math.PI, rMin: RMIN, gap: SECRET.ibSpin.circleGap, ...(INNER != null ? { inner: INNER } : {}) };
  let prev = null;
  let hit = false;
  for (const [x, y, down] of frames) {
    let dx = 0;
    let dy = 0;
    if (prev && down && prev[2]) {
      if (dev === 'touch') {
        const d = mapMobileHandDelta({ dx: x - prev[0], dy: y - prev[1], height: H, sensitivity: INPUT.touchSensitivity, pointerType: 'touch', verticalGain: 1.35 });
        dx = d.x;
        dy = d.y;
      } else {
        dx = (x - prev[0]) * INPUT.mouseSensitivity;
        dy = -(y - prev[1]) * INPUT.mouseSensitivity;
      }
    }
    if (circleStep(st, F, dx, dy, dev === 'mouse' ? true : down, o)) hit = true;
    prev = [x, y, down];
  }
  return hit;
}

/** 일부러 그린 원 (px · 화면 y 아래로): 한 바퀴 T s · 반지름 r px · 닫는 각 close° · 손 떨림 · 빠르기 · 반지름 흔들림 */
function circle(R, { T, r, close, dir = 1, wob = 0.25, rw = 0.2, drift = 0.15, jit = 1.5, lead = 0.06, tail = 0.1 }) {
  const fr = [];
  const ph = R() * 2 * Math.PI;
  const a0 = R() * 2 * Math.PI;
  let x = 400, y = 200;
  // 들머리: 손가락이 닿고 잠깐 (lead s) 원 둘레 쪽으로 움직임
  const n = Math.round(((T * close) / 360) / F);
  const cx = x - r * Math.cos(a0);
  const cy = y + r * Math.sin(a0);
  const dcx = drift * r * gauss(R);
  const dcy = drift * r * gauss(R);
  for (let i = 0; i < Math.round(lead / F); i++) fr.push([x + gauss(R) * jit, y + gauss(R) * jit, true]);
  let a = a0;
  for (let i = 0; i <= n; i++) {
    const u = i / Math.max(1, n);
    const w = 1 + wob * Math.sin(2 * Math.PI * u * 1.3 + ph);
    a += (dir * (close * Math.PI) / 180 / n) * w * (i ? 1 : 0);
    const rr = r * (1 + rw * Math.sin(2 * Math.PI * u * 2 + ph * 0.7));
    fr.push([cx + dcx * u + rr * Math.cos(a) + gauss(R) * jit, cy + dcy * u - rr * Math.sin(a) + gauss(R) * jit, true]);
  }
  for (let i = 0; i < Math.round(tail / F); i++) fr.push([...fr[fr.length - 1].slice(0, 2), true]);
  fr.push([...fr[fr.length - 1].slice(0, 2), false]);
  return fr;
}

/** 보통 긋기 하나 (px): 곧은 · 휜(turn°) — 길이 len px · dur s · 끝에 뗌 */
function stroke(R, { len, dur, turn = 0, jit = 1.5 }) {
  const fr = [];
  const n = Math.max(2, Math.round(dur / F));
  const h0 = R() * 2 * Math.PI;
  let x = 400, y = 200, h = h0;
  const step = len / n;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const e = u * u * (3 - 2 * u); // 빠르게 시작해 늦추는 긋기의 빠르기 꼴(부드럽게)
    void e;
    h = h0 + ((turn * Math.PI) / 180) * u;
    x += Math.cos(h) * step;
    y += Math.sin(h) * step;
    fr.push([x + gauss(R) * jit, y + gauss(R) * jit, true]);
  }
  fr.push([x, y, false]);
  return fr;
}

/** 오가기 (V · U): 한 획에 갔다 돌아옴 · 꺾임 둥글기 bend° */
function backForth(R, { len, dur, bend }) {
  const a = stroke(R, { len, dur: dur / 2, turn: bend / 2 });
  a.pop();
  const [x0, y0] = a[a.length - 1];
  const h = Math.atan2(a[a.length - 1][1] - a[a.length - 3][1], a[a.length - 1][0] - a[a.length - 3][0]) + Math.PI - ((bend / 2) * Math.PI) / 180;
  const n = Math.round(dur / 2 / F);
  for (let i = 1; i <= n; i++) {
    const u = i / n;
    const hh = h + ((bend / 2) * Math.PI * u) / 180;
    a.push([x0 + Math.cos(hh) * len * u + gauss(R), y0 + Math.sin(hh) * len * u + gauss(R), true]);
  }
  a.push([...a[a.length - 1].slice(0, 2), false]);
  return a;
}

/** 마우스 쉼 없이 (6 s): 손 목표를 자세 사이로 옮기며 가끔 휘두름 — OU 빠르기 σ px/s */
function mouseWander(R, { sigma, dur = 6 }) {
  const fr = [];
  let x = 400, y = 200, vx = 0, vy = 0;
  const tau = 0.25;
  for (let i = 0; i < Math.round(dur / F); i++) {
    vx += (-vx / tau) * F + sigma * Math.sqrt((2 * F) / tau) * gauss(R);
    vy += (-vy / tau) * F + sigma * Math.sqrt((2 * F) / tau) * gauss(R);
    // 화면 가운데로 끌림 (손 목표가 칼 닿는 둘레 안)
    vx += (400 - x) * 0.8 * F;
    vy += (200 - y) * 0.8 * F;
    x += vx * F;
    y += vy * F;
    fr.push([x, y, true]);
  }
  return fr;
}

const rate = (gen, dev, time, seed0) => {
  let k = 0;
  for (let i = 0; i < N; i++) {
    const R = rng(seed0 + i * 7919);
    if (run(gen(R), dev, time)) k++;
  }
  return (100 * k) / N;
};
const pick = (R, a, b) => a + (b - a) * R();

const DELIBERATE = [];
for (const T of [0.4, 0.6, 0.8, 1.0, 1.2, 1.4]) DELIBERATE.push([`원 한 바퀴 ${T} s (닫음 370 ~ 400° · 반지름 30 ~ 80 px)`, (R) => circle(R, { T, r: pick(R, 30, 80), close: pick(R, 370, 400), dir: R() < 0.5 ? 1 : -1 })]);
DELIBERATE.push(['원 0.8 s · 딱 닫음 355 ~ 365°', (R) => circle(R, { T: 0.8, r: pick(R, 30, 80), close: pick(R, 355, 365), dir: R() < 0.5 ? 1 : -1 })]);
DELIBERATE.push(['원 0.8 s · 덜 닫음 330 ~ 350°', (R) => circle(R, { T: 0.8, r: pick(R, 30, 80), close: pick(R, 330, 350), dir: R() < 0.5 ? 1 : -1 })]);
DELIBERATE.push(['원 0.8 s · 작게 (반지름 15 ~ 25 px)', (R) => circle(R, { T: 0.8, r: pick(R, 15, 25), close: pick(R, 370, 400), dir: R() < 0.5 ? 1 : -1 })]);
DELIBERATE.push(['원 0.8 s · 크게 흔들림 (빠르기 ±50 % · 반지름 ±35 %)', (R) => circle(R, { T: 0.8, r: pick(R, 30, 80), close: pick(R, 370, 400), wob: 0.5, rw: 0.35, dir: R() < 0.5 ? 1 : -1 })]);
const NORMAL = [
  ['곧은 긋기 (100 ~ 300 px · 0.1 ~ 0.3 s)', (R) => stroke(R, { len: pick(R, 100, 300), dur: pick(R, 0.1, 0.3) })],
  ['휜 긋기 60 ~ 120°', (R) => stroke(R, { len: pick(R, 150, 350), dur: pick(R, 0.15, 0.35), turn: (R() < 0.5 ? 1 : -1) * pick(R, 60, 120) })],
  ['휜 긋기 120 ~ 200°', (R) => stroke(R, { len: pick(R, 200, 400), dur: pick(R, 0.2, 0.45), turn: (R() < 0.5 ? 1 : -1) * pick(R, 120, 200) })],
  ['크게 휜 긋기 200 ~ 270°', (R) => stroke(R, { len: pick(R, 250, 450), dur: pick(R, 0.25, 0.6), turn: (R() < 0.5 ? 1 : -1) * pick(R, 200, 270) })],
  ['크게 휜 긋기 270 ~ 320°', (R) => stroke(R, { len: pick(R, 300, 500), dur: pick(R, 0.3, 0.7), turn: (R() < 0.5 ? 1 : -1) * pick(R, 270, 320) })],
  ['오가기 V (꺾임 0 ~ 40°)', (R) => backForth(R, { len: pick(R, 120, 250), dur: pick(R, 0.25, 0.5), bend: pick(R, 0, 40) })],
  ['오가기 U (꺾임 120 ~ 180°)', (R) => backForth(R, { len: pick(R, 120, 250), dur: pick(R, 0.3, 0.6), bend: pick(R, 120, 180) })],
  ['자세 비틀기 작은 원 (반지름 8 ~ 20 px · 0.4 s)', (R) => circle(R, { T: 0.4, r: pick(R, 8, 20), close: pick(R, 370, 720), dir: R() < 0.5 ? 1 : -1, jit: 0.8 })],
];
const MOUSE = [
  ['마우스 쉼 없이 6 s (σ 300 px/s)', (R) => mouseWander(R, { sigma: 300 })],
  ['마우스 쉼 없이 6 s (σ 800 px/s — 휘두르듯)', (R) => mouseWander(R, { sigma: 800 })],
];

console.log(`몸짓 ${N} 번씩 · 가운데 문턱 ${INNER} · 반지름 하한 ${RMIN} m (터치 폰 가로 390 px: ${(RMIN / (INPUT.touchSensitivity / H)).toFixed(0)} px · 마우스 ${(RMIN / INPUT.mouseSensitivity).toFixed(0)} px) · 멈춤 ${SECRET.ibSpin.circleGap} s`);
for (const dev of DEVS) {
  console.log(`\n### ${dev === 'touch' ? '터치 (오른쪽 끌기)' : '마우스 (잠김)'} — 나간 몫 %\n`);
  console.log('| 몸짓 | ' + TIMES.map((t) => `${t} s`).join(' | ') + ' |');
  console.log('|---|' + TIMES.map(() => '---|').join(''));
  let s = 1;
  for (const [name, gen] of [...DELIBERATE, ...NORMAL, ...(dev === 'mouse' ? MOUSE : [])]) {
    console.log(`| ${name} | ` + TIMES.map((t) => rate(gen, dev, t, s * 100003).toFixed(1)).join(' | ') + ' |');
    s++;
  }
}
