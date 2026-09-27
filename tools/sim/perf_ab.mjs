// 성능 A/B (docs/whole_body_strike.md 10장): 온몸 베기 켬(A) / 끔(B)을 한 프로세스 안에서 번갈아 잰다.
//  컴퓨터를 다른 일과 나눠 쓰므로 차례대로 잰 가운데값은 믿을 수 없다 → 같은 판 두 벌(같은 시드)을 블록마다 번갈아 돌리고
//  블록끼리 짝지은 비(A/B)의 평균과 95% 신뢰 구간을 본다. 합격: 평균 ≤ 1.03, 신뢰 구간 위쪽 ≤ 1.05
//  할당: "새로 더한 스텝당 할당 0개" — THREE.Vector3·Quaternion 생성 수(생성자 가로채기)와 JS 힙 할당(가비지 수집이 끼지 않은
//  짧은 창의 힙 증가, --expose-gc 필요)을 켬·끔으로 견준다. 차이가 0이면 합격
// 실행 (저장소 뿌리): node --expose-gc tools/sim/hybrid.mjs perf_ab.mjs [블록 수=10] [블록당 스텝=2000]
//   A/B 로 켜고 끌 스위치: 기본 WHOLE.on. 다른 것: SWITCH=WHOLE.commit (그 층만 켬/끔, WHOLE.on 은 켠 채)
//   결과: 요약을 찍고 JSON 을 OUT(없으면 OUTDIR 또는 임시 폴더의 perf_ab_<모드>.json)에 남긴다
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { newRound, THREE, AI, CONFIG, DT } from './harness_m.mjs';
import { Fighter } from '../../src/fighter.js';

const NB = +(process.argv[2] || 10);
const NS = +(process.argv[3] || 2000);
const [SW_G, SW_K] = (process.env.SWITCH || 'WHOLE.on').split('.');
const MODE = CONFIG.BODY.weightMode;
const setSwitch = (v) => (CONFIG[SW_G][SW_K] = v);

/**
 * AI 대 AI 한 판 (플레이어 쪽도 보통 AI). 한쪽이 죽으면 다음 시드로 새 판.
 *  두 벌이 같은 장면을 지나도록 난수(Math.random)와 무기 파손 난수 번호(Fighter._breakCount, 프로세스 전역)를 벌마다 따로 쥔다
 */
function arena(seed0) {
  const S = { seed: seed0, G: null, steps: 0, rand: Math.random, bc: 0 };
  S.fresh = () => {
    Fighter._breakCount = S.bc;
    S.G = newRound({ seed: S.seed++, AI2Class: AI });
    S.G.player.skill.level = 0.7;
    S.bc = Fighter._breakCount;
    S.rand = Math.random;
  };
  S.run = (n) => {
    const r0 = Math.random;
    Math.random = S.rand;
    for (let i = 0; i < n; i++) {
      if (!S.G || !S.G.player.alive || !S.G.enemy.alive || S.G.t > 45) S.fresh();
      S.G.step();
    }
    S.rand = Math.random;
    Math.random = r0;
    S.steps += n;
  };
  return S;
}

const X = arena(101);
const Y = arena(101);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => Math.sqrt(a.reduce((s, x) => s + (x - mean(a)) ** 2, 0) / Math.max(1, a.length - 1));

// ── 1) 시간 ──
//  두 벌(X, Y)이 같은 장면을 나란히 지난다. 블록마다 켬을 맡는 벌과 먼저 도는 쪽을 바꾼다: 벌 자체의 차이(먼저 만든 쪽의 JIT 등)와
//  순서 효과가 켬·끔 양쪽에 고르게 들어가 지워진다. 처음 한 블록은 데우기로 버린다.
//  시간은 이 프로세스가 쓴 CPU 시간 (다른 일이 CPU 를 빼앗아 간 시간은 들어가지 않는다. 벽시계는 컴퓨터를 나눠 쓰면 크게 흔들린다)
const ta = [];
const tb = [];
for (let b = -1; b < NB; b++) {
  const onS = (b + 2) % 2 ? Y : X;
  const offS = onS === X ? Y : X;
  const order = Math.floor((b + 2) / 2) % 2 ? ['off', 'on'] : ['on', 'off'];
  const t = {};
  for (const w of order) {
    setSwitch(w === 'on');
    const c0 = process.cpuUsage();
    (w === 'on' ? onS : offS).run(NS);
    const c1 = process.cpuUsage(c0);
    t[w] = (c1.user + c1.system) / 1000 / NS;
  }
  if (b < 0) continue;
  ta.push(t.on);
  tb.push(t.off);
}
const ratios = ta.map((x, i) => x / tb[i]);
const T975 = [12.71, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086];
const ci = (T975[Math.min(T975.length, ratios.length - 1) - 1] || 2) * (sd(ratios) / Math.sqrt(ratios.length));
const time = { msPerStepA: +mean(ta).toFixed(4), msPerStepB: +mean(tb).toFixed(4), ratios: ratios.map((r) => +r.toFixed(3)), ratioMean: +mean(ratios).toFixed(3), ci95: [+(mean(ratios) - ci).toFixed(3), +(mean(ratios) + ci).toFixed(3)] };
time.pass = time.ratioMean <= 1.03 && time.ci95[1] <= 1.05;

// ── 2) 할당: THREE 생성 수 ──
//  Quaternion 생성자는 this.isQuaternion = true, Vector3 는 this.x = … 를 먼저 한다 → 원형에 세터를 두어 첫 대입을 센다
//  (세터가 제 속성을 새로 만들어 두므로 그 뒤 읽기·쓰기는 보통 속성이다. 세는 동안만 켠다: 느려지므로 시간 측정과 따로)
const cnt = { v3: 0, q: 0, on: false };
Object.defineProperty(THREE.Quaternion.prototype, 'isQuaternion', {
  configurable: true,
  get: () => true,
  set(v) {
    if (cnt.on) cnt.q++;
    Object.defineProperty(this, 'isQuaternion', { value: v, writable: true, enumerable: true, configurable: true });
  },
});
Object.defineProperty(THREE.Vector3.prototype, 'x', {
  configurable: true,
  get: () => undefined,
  set(v) {
    if (cnt.on) cnt.v3++;
    Object.defineProperty(this, 'x', { value: v, writable: true, enumerable: true, configurable: true });
  },
});
const countRun = (S, sw, n) => {
  setSwitch(sw);
  cnt.v3 = cnt.q = 0;
  cnt.on = true;
  S.run(n);
  cnt.on = false;
  return { v3: cnt.v3 / n, q: cnt.q / n };
};
// 새 판 두 벌 (같은 시드): 스텝 수가 같으면 같은 장면을 지난다
const CA = arena(202);
const CB = arena(202);
setSwitch(true);
CA.run(300);
setSwitch(false);
CB.run(300);
const cA = countRun(CA, true, 1500);
const cB = countRun(CB, false, 1500);
const three = { perStepA: { v3: +cA.v3.toFixed(2), q: +cA.q.toFixed(2) }, perStepB: { v3: +cB.v3.toFixed(2), q: +cB.q.toFixed(2) } };
three.diff = { v3: +(cA.v3 - cB.v3).toFixed(3), q: +(cA.q - cB.q).toFixed(3) };
three.pass = three.diff.v3 === 0 && three.diff.q === 0;
delete THREE.Quaternion.prototype.isQuaternion;
delete THREE.Vector3.prototype.x;

// ── 3) 할당: JS 힙 (스텝당 바이트) ──
//  창마다 gc() 로 비우고 짧은 창(10스텝)의 힙 증가를 잰다. 같은 창 번호끼리는 같은 장면이므로 짝지은 차이의 가운데값을 본다.
//  힙 수치는 JIT·인라인 캐시 때문에 같은 코드끼리도 조금 흔들린다 → 끔 두 벌(B, C)끼리의 차이를 잡음 바닥으로 함께 잰다.
//  합격: |켬 − 끔| ≤ 2 × max(|끔 − 끔|, 256 B)
let heap = null;
if (typeof global.gc === 'function') {
  const W = 10;
  // 창 종류 셋을 돌아가며: (X 켬, Y 끔), (X 끔, Y 켬), (X 끔, Y 끔). 앞의 둘을 평균해 벌 차이를 지우고, 셋째(같은 코드끼리)로 잡음을 본다
  const X2 = arena(303);
  const Y2 = arena(303);
  setSwitch(false);
  X2.run(300);
  Y2.run(300);
  const kinds = [[], [], []];
  for (let k = 0; k < 180; k++) {
    const kind = k % 3;
    const onX = kind === 0;
    const onY = kind === 1;
    const d = {};
    for (const [nm, S, on] of k % 2 ? [['Y', Y2, onY], ['X', X2, onX]] : [['X', X2, onX], ['Y', Y2, onY]]) {
      setSwitch(on);
      global.gc();
      const h0 = process.memoryUsage().heapUsed;
      S.run(W);
      d[nm] = (process.memoryUsage().heapUsed - h0) / W;
    }
    kinds[kind].push(kind === 1 ? d.Y - d.X : d.X - d.Y); // 켬 − 끔 (셋째는 X − Y)
  }
  const med = (a) => {
    const s = a.slice().sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  const m0 = med(kinds[0]);
  const m1 = med(kinds[1]);
  heap = { windows: kinds[0].length, onMinusOff_XonYoff: Math.round(m0), onMinusOff_XoffYon: Math.round(m1), diffAB: Math.round((m0 + m1) / 2), noiseBC: Math.round(med(kinds[2])) };
  heap.pass = Math.abs(heap.diffAB) <= 2 * Math.max(Math.abs(heap.noiseBC), 256);
}

const out = { mode: MODE, switch: `${SW_G}.${SW_K}`, blocks: NB, stepsPerBlock: NS, dt: DT, time, three, heap };
console.log('시간 (A = 켬, B = 끔)', JSON.stringify(time));
console.log('THREE 생성 / 스텝', JSON.stringify(three));
console.log('힙 할당 / 스텝', heap ? JSON.stringify(heap) : '(--expose-gc 없이 돌려 건너뜀)');
const f = process.env.OUT || path.join(process.env.OUTDIR || os.tmpdir(), `perf_ab_${MODE}.json`);
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('결과 파일:', f);
