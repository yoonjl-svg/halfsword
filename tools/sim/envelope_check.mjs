// ─────────────────────────────────────────────────────────────
//  envelope_check.mjs — 파이터 관절 각을 사람 봉투 정의로 재고, 범위 밖 스텝을 센다 (참고 수, 한도 아님)
//   모듈: import { sample, Counter, RANGES } from './envelope_check.mjs'
//     sample(f)  → { shElevS, shPlaneS, shElevO, shPlaneO, elbowS, elbowO, wrist, spineTwist, hipL, hipR, kneeL, kneeR,
//                    forearmRoll, bothAir, pen: { 'blade>chest': 깊이 m, … }, penMax }
//        각은 tools/motion/envelope.mjs anglesAt 와 같은 식 (몸통 틀 up = 허리→목, lat = 빈 어깨→칼 어깨). 그 모듈은 불러오면 파일을 쓰므로 식을 옮겨 적었다.
//        관절 자리 = tools/motion/lib/game_joints.mjs ANCHORS (반올림 없음), 파이터가 바라보는 틀로 돌려 (jointsOf 와 같음). 칼끝·폼멜 = game_joints 와 같은 식
//        forearmRoll = 아래팔 z(팔꿈치 경첩 축) ↔ 칼 면 법선 z 사이 각 (작업 L 손목 밧줄과 같은 정의), 판 처음 쥔 자세(fighter.js:413)가 0. 봉투에 칸이 없어 문헌 범위와 견준다
//        bothAir = 두 발 뒤꿈치·발끝이 다 땅에서 1 cm 넘게 뜸 (봉투 발 뜸 정의와 같음)
//        pen = 제 칼날(칼자루 끝 → 칼끝 선분)·칼 든 아래팔(farmS 캡슐)이 제 몸통(골반·배·가슴 상자)·넓적다리(캡슐)에 파고든 깊이 (m, 제 충돌체 모양)
//     new Counter()  .add(f) 스텝마다 → .table() 글 · .json()
//        센다: 봉투 'all' 범위(human_envelope.json, 클립 24벌 min~max) 밖, 설계 칸(아래팔-칼 > 163°, 척추 비틀림 −29~46° 밖),
//              문헌 칸(칼·빈 어깨 들림 면 −45~130°: 수평 벌림 45·모음 130, 들림 60~160° 표본만; 팔꿈치 > 150°: AAOS; 아래팔 돌림 > 80°: AAOS 엎침 80·뒤침 80),
//              두 발 뜸, 제 몸 뚫림 (깊이 > 1 cm: hs-diag live_common.mjs DECL.penTolM 과 같은 선언 — 상자·캡슐이 거칠어 1 cm 아래는 셈 않음)
//        서 있는 스텝(state 'stand')만, 판 시작 0.5 s 뒤부터 (live_common DECL.settleS 와 같은 선언: 몸이 처음 놓이는 동안). 칼을 놓치면 칼 칸은 건너뛴다
//   CLI (break_trace.mjs 처럼 다른 시뮬을 감싼다. 감싼 시뮬 stdout 은 한 글자도 바뀌지 않고, 표는 stderr 로 나간다):
//     node tools/sim/envelope_check.mjs live_battery.mjs [인자...]
//     node tools/sim/with_config.mjs BODY.humanLimits=true envelope_check.mjs fights12.mjs     (한도 켬·끔 견주기)
//     ENVELOPE_JSON=<파일> 이면 표를 json 으로도 쓴다
//  Fighter.prototype.cacheState 를 감싸 스텝마다 부른다 (cacheState 는 fighter.step 뒤·world.step 앞: 앞 스텝 적분이 끝난 자세)
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ANCHORS, PARTS } from '../motion/lib/game_joints.mjs';
import { isMain, simPath } from './is_main.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENV = JSON.parse(readFileSync(join(HERE, '..', 'motion', 'human_envelope.json'), 'utf8'));
const R2D = 180 / Math.PI;
const KEYS = ['shElevS', 'shPlaneS', 'shElevO', 'shPlaneO', 'elbowS', 'elbowO', 'wrist', 'spineTwist', 'hipL', 'hipR', 'kneeL', 'kneeR'];
// 범위 표 (도). env = 봉투 클립 범위 (참고), design/lit = 설계·문헌 칸
export const RANGES = {
  env: Object.fromEntries(KEYS.map((k) => [k, [ENV.all[k].min, ENV.all[k].max]])),
  extra: {
    'wrist>163': { key: 'wrist', lo: -Infinity, hi: 163, src: '설계 측정 칸: 아래팔-칼 > 163° (봉투 wrist 문헌 135~160° 무리)' },
    'spineTwist-29..46': { key: 'spineTwist', lo: -29, hi: 46, src: '설계·C3: 척추 비틀림 −29~46° (봉투 클립)' },
    // 수평 모음·벌림은 팔을 옆으로 든 자세의 값이라 들림 60~160° 표본만 본다 (hs-diag live_common RANGES.shoulderAcross 와 같은 선언: 낮은 팔의 들림 면은 뜻이 약하다)
    'shPlaneS-45..130': { key: 'shPlaneS', lo: -45, hi: 130, when: (s) => s.shElevS >= 60 && s.shElevS <= 160, src: 'C3·봉투 문헌: 칼 어깨 수평 벌림 약 45 · 수평 모음 약 130 (AAOS), 들림 60~160°' },
    'shPlaneO-45..130': { key: 'shPlaneO', lo: -45, hi: 130, when: (s) => s.shElevO >= 60 && s.shElevO <= 160, src: '같음 (빈 팔, H4)' },
    'elbowS>150': { key: 'elbowS', lo: -Infinity, hi: 150, src: 'C3·봉투 문헌: 팔꿈치 굽힘 150 (AAOS)' },
    'elbowO>150': { key: 'elbowO', lo: -Infinity, hi: 150, src: '같음 (빈 팔)' },
    'forearmRoll>80': { key: 'forearmRoll', lo: -Infinity, hi: 80, src: 'AAOS 아래팔 엎침 80 · 뒤침 80 (Greene & Heckman 1994), 작업 L HUMAN.forearmRoll 과 같은 정의. 봉투 칸 없음' },
  },
};
const PEN_TOL = 0.01; // m (위 머리글)
const SETTLE_S = 0.5; // s (위 머리글)
const AIR_M = 0.01; // m, 봉투 발 뜸 정의
const FOOT_REST_Y = 0.02; // 뒤꿈치·발끝 기준점의 선 자세 높이 (game_joints ANCHORS heel/toe y 0.02)

// ── 배열 벡터 ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.sqrt(dot(a, a));
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(nrm(a), nrm(b))))) * R2D;
const Qa = (r) => [r.x, r.y, r.z, r.w];
const Pa = (v) => [v.x, v.y, v.z];
const qinv = (a) => [-a[0], -a[1], -a[2], a[3]];
const qrot = (q, v) => {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
};

/** tools/motion/envelope.mjs anglesAt 그대로 (p = 관절 이름 → [x, y, z]) */
export function anglesAt(p) {
  const up = nrm(sub(p('neck'), p('waist')));
  let lat = sub(p('shS'), p('shO'));
  lat = nrm(sub(lat, up.map((v) => v * dot(lat, up))));
  const fwd = crs(up, lat);
  const F = dot(fwd, [1, 0, 0]) >= 0 ? fwd : fwd.map((v) => -v);
  const arm = (sh, el, side) => {
    const u = nrm(sub(p(el), p(sh)));
    const front = dot(u, F), out = dot(u, lat) * side;
    const elev = ang(u, up.map((v) => -v));
    return { elev, plane: elev > 20 && elev < 160 ? Math.atan2(front, out) * R2D : null };
  };
  const aS = arm('shS', 'elS', 1), aO = arm('shO', 'elO', -1);
  const elbow = (sh, el, h) => 180 - ang(sub(p(sh), p(el)), sub(p(h), p(el)));
  const wrist = p('tip') ? ang(sub(p('hS'), p('elS')), sub(p('tip'), p('pommel'))) : null;
  const yawOf = (a, b) => { const v = sub(p(a), p(b)); return Math.atan2(-v[0], v[2]) * R2D; };
  let twist = yawOf('shS', 'shO') - yawOf('hipR', 'hipL');
  twist = ((twist + 540) % 360) - 180;
  const trunkDown = up.map((v) => -v);
  const hip = (h, k) => ang(sub(p(k), p(h)), trunkDown);
  const knee = (h, k, a) => 180 - ang(sub(p(h), p(k)), sub(p(a), p(k)));
  return {
    shElevS: aS.elev, shPlaneS: aS.plane, shElevO: aO.elev, shPlaneO: aO.plane,
    elbowS: elbow('shS', 'elS', 'hS'), elbowO: elbow('shO', 'elO', 'hO'), wrist,
    spineTwist: twist, hipL: hip('hipL', 'kneeL'), hipR: hip('hipR', 'kneeR'),
    kneeL: knee('hipL', 'kneeL', 'ankleL'), kneeR: knee('hipR', 'kneeR', 'ankleR'),
  };
}

// ── 제 몸 뚫림: 점 → 충돌체 부호 거리 (안이면 음수) ──
const shapeCache = new WeakMap();
const bodyShape = new WeakMap();
/** 몸체의 첫 충돌체 모양 (상자 반길이 · 캡슐 반높이·반지름 · 공 반지름). 모양은 판 동안 바뀌지 않아 한 번 읽는다 */
function shapeOfBody(b) {
  let sh = bodyShape.get(b);
  if (!sh) {
    const c = b.collider(0);
    const s = c.shape;
    sh = { c, box: s.halfExtents ? [s.halfExtents.x, s.halfExtents.y, s.halfExtents.z] : null, hh: s.halfHeight ?? 0, r: s.radius ?? 0 };
    bodyShape.set(b, sh);
  }
  return sh;
}
/** 월드 점 → 몸체 충돌체 표면까지 부호 거리 (m, 안 = 음수). chain_corr 의 칼끝 겨눔 오차도 이것으로 잰다 */
export function partDist(b, p) {
  return sdist(shapeOfBody(b), Array.isArray(p) ? p : [p.x, p.y, p.z]);
}
function shapesOf(f) {
  let S = shapeCache.get(f);
  if (!S) {
    S = {};
    for (const n of ['pelvis', 'abdomen', 'chest', 'thighF', 'thighB', 'farmS']) {
      const b = f.bodies[n];
      if (!b || !b.numColliders()) continue;
      S[n] = shapeOfBody(b);
    }
    shapeCache.set(f, S);
  }
  return S;
}
function sdist(sh, pw) {
  const q = Qa(sh.c.rotation()), o = Pa(sh.c.translation());
  const l = qrot(qinv(q), sub(pw, o));
  if (sh.box) {
    const d = [Math.abs(l[0]) - sh.box[0], Math.abs(l[1]) - sh.box[1], Math.abs(l[2]) - sh.box[2]];
    const outside = len([Math.max(d[0], 0), Math.max(d[1], 0), Math.max(d[2], 0)]);
    return outside + Math.min(Math.max(d[0], d[1], d[2]), 0);
  }
  const y = Math.max(-sh.hh, Math.min(sh.hh, l[1]));
  return len([l[0], l[1] - y, l[2]]) - sh.r;
}
function segEnds(sh) {
  const q = Qa(sh.c.rotation()), o = Pa(sh.c.translation());
  return [add(o, qrot(q, [0, -sh.hh, 0])), add(o, qrot(q, [0, sh.hh, 0]))];
}
const VOLS = ['chest', 'abdomen', 'pelvis', 'thighF', 'thighB'];
/** 선분 a→b 를 n 점으로, 반지름 rad: 부피마다 최대 뚫림 깊이 (m, 0 = 안 닿음) */
function penSeg(S, a, b, rad, n, tag, out) {
  for (const v of VOLS) {
    const sh = S[v];
    if (!sh) continue;
    let dep = 0;
    for (let i = 0; i <= n; i++) {
      const p = add(a, mul(sub(b, a), i / n));
      dep = Math.max(dep, rad - sdist(sh, p));
    }
    out[`${tag}>${v}`] = dep;
  }
}

/** 한 스텝 표본 (읽기만) */
export function sample(f) {
  const B = f.bodies;
  const pos = {};
  for (const [name, [part, at]] of Object.entries(ANCHORS)) {
    const b = B[part];
    if (!b) continue;
    const home = PARTS[part];
    pos[name] = add(Pa(b.translation()), qrot(Qa(b.rotation()), [at[0] - home[0], at[1] - home[1], at[2] - home[2]]));
  }
  const armed = !!f.sword && f.armed !== false;
  let hilt = null;
  if (armed) {
    const sq = Qa(f.sword.rotation()), sp = Pa(f.sword.translation());
    const c = f.weaponCfg;
    hilt = add(sp, qrot(sq, [0, c.hiltLength, 0]));
    pos.tip = add(sp, qrot(sq, [0, c.hiltLength + c.bladeLength, 0]));
    pos.pommel = add(hilt, mul(nrm(sub(hilt, pos.tip)), 0.25));
  }
  // 클립 틀로 (x = 바라보는 앞, game_joints jointsOf 와 같은 돌림): anglesAt 의 앞 부호 맞춤이 x 앞을 가정한다 (상대 쪽 파이터는 heading π)
  const ch = Math.cos(f.heading ?? 0), sh = Math.sin(f.heading ?? 0);
  const loc = {};
  for (const [n, v] of Object.entries(pos)) loc[n] = [v[0] * ch - v[2] * sh, v[1], v[0] * sh + v[2] * ch];
  const s = anglesAt((n) => loc[n] ?? null);
  // 아래팔 돌림 (엎침·뒤침): 아래팔 몸 z(팔꿈치 경첩 축) ↔ 칼 면 법선(칼 몸 z) 사이 각 (0~180°, 부호 없음).
  //  작업 L 손목 밧줄(fighter.js HUMAN.forearmRoll, 경첩 축 W + e·z(아래팔) ↔ 칼 면 W + e·z(칼))과 같은 정의 — 쥔 자세(fighter.js:413)에서 0
  if (armed && B.farmS) {
    const zF = qrot(Qa(B.farmS.rotation()), [0, 0, 1]);
    const zS = qrot(Qa(f.sword.rotation()), [0, 0, 1]);
    s.forearmRoll = ang(zF, zS);
  } else s.forearmRoll = null;
  const footLow = (h, t) => Math.min(pos[h][1], pos[t][1]);
  s.bothAir = footLow('heelL', 'toeL') > FOOT_REST_Y + AIR_M && footLow('heelR', 'toeR') > FOOT_REST_Y + AIR_M;
  // 제 몸 뚫림
  const S = shapesOf(f);
  const pen = {};
  if (armed) penSeg(S, hilt, pos.tip, 0, 16, 'blade', pen);
  if (S.farmS) {
    const [a, b] = segEnds(S.farmS);
    penSeg(S, a, b, S.farmS.r, 8, 'farm', pen);
  }
  s.pen = pen;
  s.penMax = Math.max(0, ...Object.values(pen));
  return s;
}

/** 범위 밖 스텝 세기 (참고 수) */
export class Counter {
  constructor() {
    this.n = 0;
    this.out = {};
    this.max = {};
    this.seen = new WeakMap();
  }
  bump(k, v) {
    this.out[k] = (this.out[k] ?? 0) + 1;
    if (v != null) this.max[k] = Math.max(this.max[k] ?? -Infinity, v);
  }
  /** 한 스텝 (서 있고, 판 시작 0.5 s 뒤). 표본을 돌려준다 (null = 세지 않은 스텝) */
  add(f, dt = 1 / 120) {
    const t = (this.seen.get(f) ?? 0) + dt;
    this.seen.set(f, t);
    if ((f.fightT ?? t) < SETTLE_S || f.state !== 'stand') return null;
    const s = sample(f);
    this.addSample(s);
    return s;
  }
  addSample(s) {
    this.n++;
    for (const k of KEYS) {
      const v = s[k];
      if (v == null) continue;
      const [lo, hi] = RANGES.env[k];
      if (v < lo || v > hi) this.bump(`env:${k}`, v > hi ? v - hi : lo - v);
    }
    for (const [name, r] of Object.entries(RANGES.extra)) {
      const v = s[r.key];
      if (v == null || (r.when && !r.when(s))) continue;
      if (v < r.lo || v > r.hi) this.bump(name, v > r.hi ? v - r.hi : r.lo - v);
    }
    if (s.bothAir) this.bump('bothAir');
    for (const [k, d] of Object.entries(s.pen)) if (d > PEN_TOL) this.bump(`pen:${k}`, d);
  }
  total() {
    return Object.values(this.out).reduce((a, b) => a + b, 0);
  }
  /** 묶음 합: clip = 봉투 클립 범위(참고, 좁다) · rows = 설계·문헌 칸 · air = 두 발 뜸 · pen = 제 몸 뚫림 · viol = rows + air + pen */
  sums() {
    const o = { clip: 0, rows: 0, air: 0, pen: 0 };
    for (const [k, c] of Object.entries(this.out)) {
      if (k.startsWith('env:')) o.clip += c;
      else if (k.startsWith('pen:')) o.pen += c;
      else if (k === 'bothAir') o.air += c;
      else o.rows += c;
    }
    o.viol = o.rows + o.air + o.pen;
    return o;
  }
  json() {
    return { steps: this.n, total: this.total(), ...this.sums(), counts: { ...this.out }, maxOver: Object.fromEntries(Object.entries(this.max).map(([k, v]) => [k, +v.toFixed(k.startsWith('pen:') ? 3 : 1)])) };
  }
  table(title = '관절 범위 이탈 (참고 수, 한도 아님)') {
    const L = [`${title}: 센 스텝 ${this.n} (서 있음, 판 시작 ${SETTLE_S} s 뒤)`];
    const rows = [...KEYS.map((k) => [`env:${k}`, `봉투 클립 ${RANGES.env[k][0].toFixed(0)}~${RANGES.env[k][1].toFixed(0)}°`]), ...Object.entries(RANGES.extra).map(([k, r]) => [k, r.src]), ['bothAir', '두 발 뜸 (1 cm)'], ...['blade', 'farm'].flatMap((t) => VOLS.map((v) => [`pen:${t}>${v}`, `제 몸 뚫림 > ${PEN_TOL * 100} cm`]))];
    for (const [k, d] of rows) {
      const c = this.out[k] ?? 0;
      const m = this.max[k];
      L.push(`  ${k.padEnd(22)} ${String(c).padStart(7)} 스텝 (${this.n ? ((100 * c) / this.n).toFixed(2) : '0.00'} %)${m != null ? `  최대 넘음 ${k.startsWith('pen:') ? (m * 100).toFixed(1) + ' cm' : m.toFixed(1) + '°'}` : ''}  — ${d}`);
    }
    const u = this.sums();
    L.push(`  합 ${this.total()} (봉투 클립 ${u.clip} · 설계·문헌 칸 ${u.rows} · 두 발 뜸 ${u.air} · 제 몸 뚫림 ${u.pen})`);
    return L.join('\n');
  }
}

// ── CLI: 다른 시뮬을 감싸 센다 ──
if (isMain(import.meta.url)) {
  const { Fighter } = await import('../../src/fighter.js');
  const C = { all: new Counter(), P: new Counter(), E: new Counter() };
  const cache = Fighter.prototype.cacheState;
  Fighter.prototype.cacheState = function (...a) {
    const s = C.all.add(this);
    if (s) (this.index === 0 ? C.P : C.E).addSample(s);
    return cache.apply(this, a);
  };
  const [script, ...rest] = process.argv.slice(2);
  if (!script) {
    console.error('사용법: node tools/sim/envelope_check.mjs <시뮬.mjs> [인자...]');
    process.exit(2);
  }
  let done = false;
  const report = () => {
    if (done) return;
    done = true;
    let limits = 'n/a (BODY.humanLimits 없음)';
    try {
      const cfg = globalThis.__envCfg;
      if (cfg && cfg.BODY && 'humanLimits' in cfg.BODY) limits = String(cfg.BODY.humanLimits);
    } catch {}
    process.stderr.write(`\n──── envelope_check (${script}${rest.length ? ' ' + rest.join(' ') : ''}) · BODY.humanLimits ${limits} ────\n`);
    process.stderr.write(C.all.table('모든 파이터') + '\n');
    process.stderr.write(`  자리별 합: 0번(P) ${C.P.total()} / ${C.P.n} 스텝 · 1번(E) ${C.E.total()} / ${C.E.n} 스텝\n`);
    if (process.env.ENVELOPE_JSON) writeFileSync(process.env.ENVELOPE_JSON, JSON.stringify({ script, args: rest, limits, all: C.all.json(), P: C.P.json(), E: C.E.json() }, null, 1));
  };
  process.on('exit', report);
  globalThis.__envCfg = await import('../../src/config.js');
  process.argv = [process.argv[0], simPath(script), ...rest];
  await import(new URL('./' + script, import.meta.url));
  report();
}
