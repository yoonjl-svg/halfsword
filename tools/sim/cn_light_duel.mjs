// 동방 보법 '가벼운 발' — 실제 판 계기 (10/15 — docs/strike/cn_light_feet_2026-10-15.md §3-C · §3-D): 무기 X(AI) 대 롱소드(AI) 판을 motion_lab.mjs duel 의 'main' 인자와 같은 차림
//  (본판 길 — SKILL.motionLib 그대로 켬 · 인물 꾸러미 SCHOOLS[X] · 씨앗 1000+s(X 가 플레이어 자리)·2000+s(X 가 상대 자리) · 벽 · 보통 난이도 · 40 s 시한)으로 돌려
//  끔(GAIT.cnLight 0)·켬(1 — 기본)을 견준다. 판마다 결정적이고, 같은 씨앗·같은 갈래면 motion_lab duel <X> <N> main 과 같은 판이다(이 도구는 읽기만 — 승패를 함께 찍어 맞춰 봄).
//  잰다(판 하나 = 누가 죽을 때까지 또는 40 s):
//   승·패·무 (X 쪽) · 판 길이 · 걸은 거리 — 걷는 동안 골반 수평 이동(스텝마다 골반 수평 자리 차): 서 있고(stand) 걸음이 '걷는 중'(gait.walking — 걸러진 가려는 빠르기가 걷기 문턱 위)이며
//    기술 걸음(requestStep — gait.req · 떠 있는 발이 'req'·'draw')도 자세 고치기('settle')도 아닐 때만 — 서 있는 동안 흔들림·자세 고치기·기술(공격) 걸음은 뺀다(기력 설계안 §1·§5 의 걷기 비용 잣대)
//    → 분당 m (판 길이 합으로 나눔 — 판마다 분당 m 의 중앙 [10~90 %] 도) · 같은 잣대의 롱소드 쪽 · 걷는 시간 비율
//   클린치 시간 비율 — 두 몸 다 살아 있는 동안 가슴-가슴 거리 < X 의 measure.clinch(청강검 1.04 m), 그리고 근접 밀치기(barge)·누르기(closeW > 0.05)가 어느 쪽에든 켜진 시간
//   X 넘어짐 · X 가 받은 상처 수
//  D — 기력 셈(기력 코드는 없다 — 설계안 docs/design/stamina_2026-10-15.md §1 식만): 걷기 = 0.6 m 마다 1 × 유파 배율 · 베기 = 12 × 무게(√(칼 질량 ÷ 1.60) 을 0.75~1.5 로 자름, 칼 질량 = 런타임 fighter.swordMass) ·
//   회복 15/s(0.6 s 쉰 뒤) — 걷기 비용은 회복을 멈추지 않음. 배율 1 · 0.75 · 0.5(동방 후보)와 일본 1.5 를 이 판에서 잰 분당 걸은 거리로 셈 → 1 대비 아낀(더 쓴) 양을 '분당 베기 몇 번'으로.
//   0 → 80 걸으며 회복 시간(설계안 §4 셈 = 0.6 + 80 ÷ (15 − 빠르기 ÷ 0.6 × 배율)) — 앞 끝 1.8 · 뒤 끝 1.26 · 옆 0.72 m/s(설계안 값) 와 CLD_SPEEDS 로 준 잰 빠르기
//  실행: node tools/sim/cn_light_duel.mjs [무기 qinggang] [자리마다 판 수 24] [갈래 off,on] (CLD_ROWS=1 → 판마다 줄 · CLD_SPEEDS=앞,뒤,옆 m/s · CLD_JP=일본 분당 m — D 표의 일본 줄)
//   칸 없는 유파(롱소드·우치가타나)는 끔·켬이 같은 판이라 갈래 하나만 돌려도 된다(예: node tools/sim/cn_light_duel.mjs uchigatana 24 off)
//   CLD_SEED0=24 → 씨앗 1025~1048 · 2025~2048 (motion_lab duel 의 DUEL_SEED0 과 같은 뜻 — 새 48 판, 기본 0)
//   넘어짐 까닭(X): steady_check.mjs 와 같은 셈(knockDown·applyWound·updateState 를 감싸 적기만) — gauge 휘청임 게이지 · footing 발 디딤 잃음 · tilt 기울기 · head 머리 맞아 주저앉음 · legs · sever
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { Fighter } from '../../src/fighter.js';
import { WEAPONS } from '../../src/weapons.js';
import { SCHOOLS } from '../../src/schools.js';
import { wilson } from './corr_lib.mjs';

const { GAIT, BALANCE, BODY } = CONFIG;
const SEED0 = +process.env.CLD_SEED0 || 0;

// ── 넘어짐 까닭 적기 (steady_check.mjs 와 같은 셈 — 원래 함수를 같은 인자로 부르기만) ──
const _q = new THREE.Quaternion();
const _u = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
function fallTiltOf(f) {
  const r = f.bodies.chest.rotation();
  _u.set(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(_u.dot(f.anchorUp || UP), -1, 1))) - THREE.MathUtils.radToDeg(f.hunch || 0);
}
const FP = Fighter.prototype;
const origKD = FP.knockDown;
const origUS = FP.updateState;
const origAW = FP.applyWound;
FP.updateState = function (dt) {
  this._kdCtx = 'state';
  try {
    return origUS.call(this, dt);
  } finally {
    this._kdCtx = null;
  }
};
FP.applyWound = function (h) {
  const c = this._kdCtx;
  this._kdCtx = 'wound';
  try {
    return origAW.call(this, h);
  } finally {
    this._kdCtx = c;
  }
};
FP.knockDown = function (heavy = true) {
  const before = this.state;
  let cause = null;
  if (this._kdLog && (before === 'stand' || (heavy && (before === 'getup' || before === 'kneel')))) {
    const ctx = this._kdCtx;
    if (ctx === 'state') {
      const fl = [];
      if (this.balance <= 0) fl.push('gauge');
      if (this.offBalanceTime > BALANCE.fallDelay) fl.push('footing');
      if (fallTiltOf(this) > BODY.fallTiltDeg) fl.push('tilt');
      if (!fl.length && this.legsCannotSupport) fl.push('legs');
      cause = fl.join('+') || 'state?';
    } else if (ctx === 'wound') cause = this.missingLeg ? 'sever' : 'head';
    else cause = this.legsCannotSupport ? 'legs' : 'other';
  }
  const r = origKD.call(this, heavy);
  if (cause && this.state !== before) this._kdLog.push(cause);
  return r;
};
const [id = 'qinggang', nArg = '24', armArg = 'off,on'] = process.argv.slice(2);
if (!WEAPONS[id]) throw new Error(`무기 없음: ${id}`);
const N = +nArg || 24;
const ARMS = armArg.split(',').map((a) => ({ off: 0, on: 1 })[a]);
if (ARMS.some((a) => a == null)) throw new Error(`갈래는 off,on 가운데: ${armArg}`);
const ROWS = process.env.CLD_ROWS === '1';
const CN0 = GAIT.cnLight;
const school = SCHOOLS[id] ? id : 'longsword'; // motion_lab duel 'main' 과 같은 꾸러미 고르기

// 공격 수 (읽기만 — 기력 설계안 '공격 한 번' AI 정의: 기술 하나, 이어 치기도 각자 하나 · 비기 하나): X 의 AI 가 낸 베기·찌르기·비기를 센다 → D 표의 견줄 몫(공격 기력 [셈])
let atk = null;
const SA0 = AI.prototype.startAttack;
AI.prototype.startAttack = function (tech, why, opt) {
  const ok = SA0.call(this, tech, why, opt);
  if (ok && atk && atk.ai === this && this.mode === 'attack' && this.tech === tech) atk[tech.kind === 'thrust' ? 'thrust' : 'cut']++;
  return ok;
};
const SG0 = AI.prototype.secretGo;
AI.prototype.secretGo = function (S, ctx) {
  const ok = SG0.call(this, S, ctx);
  if (ok && atk && atk.ai === this) atk.secret++;
  return ok;
};

/** 이번 스텝에 걸은 거리로 세나: 서 있고 · 걷는 중 · 기술 걸음·끌어붙임·자세 고치기 아님 */
function walkingNow(F) {
  const g = F.gait;
  if (F.state !== 'stand' || !g?.active || !g.walking || g.req) return false;
  for (const k of ['F', 'B']) {
    const l = g.legs[k];
    if (!l.stance && (l.kind === 'req' || l.kind === 'draw' || l.kind === 'settle')) return false;
  }
  return true;
}
function newTrack(F) {
  const p = F.bodies.pelvis.translation();
  return { F, x: p.x, z: p.z, dist: 0, walkT: 0, path: 0 };
}
function track(T) {
  const p = T.F.bodies.pelvis.translation();
  const ds = Math.hypot(p.x - T.x, p.z - T.z);
  T.x = p.x;
  T.z = p.z;
  if (T.F.state === 'stand') T.path += ds;
  if (walkingNow(T.F)) {
    T.dist += ds;
    T.walkT += DT;
  }
}

function fight(arm, s, xFirst) {
  GAIT.cnLight = arm;
  const seed = (xFirst ? 1000 : 2000) + s + SEED0;
  const x = { weapon: id, persona: { school } };
  const y = { weapon: 'longsword', persona: { school: 'longsword' } };
  const P = xFirst ? x : y;
  const E = xFirst ? y : x;
  const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
  const X = xFirst ? G.player : G.enemy;
  const Y = xFirst ? G.enemy : G.player;
  atk = { ai: xFirst ? G.ai2 : G.ai, cut: 0, thrust: 0, secret: 0 };
  X._kdLog = [];
  const clinch = X.swordArt.measure.clinch;
  const tx = newTrack(X);
  const ty = newTrack(Y);
  let clinchT = 0;
  let closeT = 0;
  let falls = 0;
  let prev = X.state;
  let res = 'D';
  let t = 0;
  let nan = false;
  for (let i = 0; i < 40 / DT; i++) {
    G.step();
    t += DT;
    track(tx);
    track(ty);
    if (prev === 'stand' && (X.state === 'down' || X.state === 'getup')) falls++; // motion_lab duel 넘어짐 계기와 같은 셈
    prev = X.state;
    if (X.alive && Y.alive) {
      if (X.foeDistance() < clinch) clinchT += DT;
      if (X.barge || Y.barge || X.closeW > 0.05 || Y.closeW > 0.05) closeT += DT;
    }
    const v = X.sword.linvel();
    if (![v.x, v.y, v.z].every(Number.isFinite)) {
      nan = true;
      break;
    }
    const xd = X.state === 'dead';
    const yd = Y.state === 'dead';
    if (xd || yd) {
      res = xd && yd ? 'D' : yd ? 'W' : 'L';
      break;
    }
  }
  const got = G.wounds.filter((w) => w.vic === X).length;
  const A = atk;
  atk = null;
  GAIT.cnLight = CN0;
  return { seed, xFirst, res, t, nan, xDist: tx.dist, xWalkT: tx.walkT, xPath: tx.path, yDist: ty.dist, clinchT, closeT, falls, got, swordMass: X.swordMass, light: X.gait?.P.light ?? null, clinch, cuts: A.cut, thrusts: A.thrust, secrets: A.secret, kd: X._kdLog };
}

const f2 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const f1 = (v) => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(1));
const qOf = (a, p) => {
  const b = a.filter(Number.isFinite).sort((u, v) => u - v);
  if (!b.length) return null;
  const i = (b.length - 1) * p;
  return b[Math.floor(i)] + (b[Math.ceil(i)] - b[Math.floor(i)]) * (i - Math.floor(i));
};
const pctW = (k, n) => {
  const [lo, hi] = wilson(k, n);
  return `${Math.round((100 * k) / n)} % (95 % ${Math.round(100 * lo)}~${Math.round(100 * hi)})`;
};

console.log(`# 가벼운 발 실제 판 — ${id} AI 대 롱소드 AI · 꾸러미 ${school} · 자리마다 ${N} 판 (씨앗 ${1001 + SEED0}~${1000 + N + SEED0} X 플레이어 자리 · ${2001 + SEED0}~${2000 + N + SEED0} X 상대 자리) · 40 s 시한 · motion_lab duel main 과 같은 차림`);
const sums = {};
for (const arm of ARMS) {
  const R = [];
  for (let s = 1; s <= N; s++) for (const xFirst of [true, false]) R.push(fight(arm, s, xFirst));
  const n = R.length;
  const W = R.filter((r) => r.res === 'W').length;
  const L = R.filter((r) => r.res === 'L').length;
  const D = n - W - L;
  const T = R.reduce((a, r) => a + r.t, 0);
  const xd = R.reduce((a, r) => a + r.xDist, 0);
  const yd = R.reduce((a, r) => a + r.yDist, 0);
  const xw = R.reduce((a, r) => a + r.xWalkT, 0);
  const xp = R.reduce((a, r) => a + r.xPath, 0);
  const cl = R.reduce((a, r) => a + r.clinchT, 0);
  const cs = R.reduce((a, r) => a + r.closeT, 0);
  const per = R.map((r) => (r.xDist / r.t) * 60);
  const cuts = R.reduce((a, r) => a + r.cuts, 0);
  const thrusts = R.reduce((a, r) => a + r.thrusts, 0);
  const secrets = R.reduce((a, r) => a + r.secrets, 0);
  sums[arm] = { n, W, L, D, T, xPerMin: (xd / T) * 60, yPerMin: (yd / T) * 60, swordMass: R[0].swordMass, light: R[0].light, per, cutPerMin: (cuts / T) * 60, thrustPerMin: (thrusts / T) * 60, secretPerMin: (secrets / T) * 60 };
  const key = R.map((r) => `${r.seed}${r.res}${r.t.toFixed(4)}`).join(',');
  console.log(`\n## ${arm ? '켬 (기본)' : '끔 (`GAIT.cnLight=0`)'} — light ${R[0].light ?? '없음'} · ${n} 판 · 판 열쇠 ${key.length > 0 ? hashOf(key) : '-'}${R.some((r) => r.nan) ? ' · NaN 있음' : ''}\n`);
  console.log(`- 승 ${W} · 패 ${L} · 무 ${D} → X 승률 ${pctW(W, n)} · 패 ${pctW(L, n)} · 판 길이 평균 ${f1(T / n)} s (합 ${f1(T / 60)} 분)`);
  console.log(`- X 걸은 거리(걷는 동안 골반 수평 이동 — 기술 걸음·자세 고치기·서 있는 흔들림 뺌): 합 ${f1(xd)} m → **분당 ${f1((xd / T) * 60)} m** (판마다 분당 중앙 ${f1(qOf(per, 0.5))} [10~90 % ${f1(qOf(per, 0.1))}~${f1(qOf(per, 0.9))}]) · 걷는 시간 ${f1((100 * xw) / T)} % · (참고: 서 있는 동안 골반 길이 전부 분당 ${f1((xp / T) * 60)} m)`);
  console.log(`- 롱소드(Y) 걸은 거리 같은 잣대: 분당 ${f1((yd / T) * 60)} m`);
  console.log(`- 클린치 시간 비율(두 몸 살아 있는 동안 가슴-가슴 < ${f2(R[0].clinch)} m): ${f1((100 * cl) / T)} % · 근접 밀치기·누르기 켜진 시간: ${f1((100 * cs) / T)} %`);
  const kd = {};
  for (const r of R) for (const c of r.kd) kd[c] = (kd[c] ?? 0) + 1;
  console.log(`- X 넘어짐 합 ${R.reduce((a, r) => a + r.falls, 0)} (motion_lab 셈 — 서 있다 down·getup) · 까닭 ${Object.entries(kd).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'} · X 받은 상처 합 ${R.reduce((a, r) => a + r.got, 0)}`);
  console.log(`- X 공격(AI 기술 하나 = 한 번 · 이어 치기도 각자): 베기 분당 ${f1((cuts / T) * 60)} · 찌르기 ${f1((thrusts / T) * 60)} · 비기 ${f2((secrets / T) * 60)}`);
  if (ROWS) for (const r of R) console.log(`  씨앗 ${r.seed} ${r.res} ${f1(r.t)} s · X ${f1(r.xDist)} m (${f1((r.xDist / r.t) * 60)} m/분) · Y ${f1(r.yDist)} m · 클린치 ${f1(r.clinchT)} s · 넘어짐 ${r.falls}`);
}

/** 짧은 열쇠 (판 결과 묶음이 같은지 보기 — 결정적 FNV-1a) */
function hashOf(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── D: 기력 셈 (설계안 §1 · §4 식) ──
const arm = ARMS.includes(1) ? 1 : ARMS[0];
const S = sums[arm];
const mass = S.swordMass;
const wt = Math.min(1.5, Math.max(0.75, Math.sqrt(mass / 1.6)));
const cut = 12 * wt;
const perStep = 0.6; // m — 걷기 한 걸음
const regen = 15;
const wait = 0.6;
const ks = S.light ? [1, 0.75, 0.5] : [1, 1.5];
console.log(`\n## D — 기력 셈 (설계안 §1 식 · ${arm ? '켬' : '끔'} 판에서 잰 X 분당 ${f1(S.xPerMin)} m · 칼 질량 ${f2(mass)} kg → 무게 ${f2(wt)} · 베기 ${f2(cut)})\n`);
console.log('| 걷기 배율 | 분당 걷기 기력 | 1 대비 아낀 양 /분 (− = 더 씀) | = 베기 몇 번 /분 | 판 평균 길이(' + f1(S.T / S.n) + ' s) 한 판에 | 0 → 80 회복 앞 끝 1.8 m/s | 뒤 끝 1.26 | 옆 0.72 |');
console.log('|---|---|---|---|---|---|---|---|');
const rec80 = (v, k) => {
  const net = regen - (v / perStep) * k;
  return net > 0 ? wait + 80 / net : Infinity;
};
for (const k of ks) {
  const cost = (S.xPerMin / perStep) * k;
  const save = (S.xPerMin / perStep) * (1 - k);
  const perGame = (save * (S.T / S.n)) / 60;
  console.log(`| ${k} | ${f1(cost)} | ${f1(save)} | ${f2(save / cut)} | ${f1(perGame)} (베기 ${f2(perGame / cut)}) | ${f1(rec80(1.8, k))} s | ${f1(rec80(1.26, k))} s | ${f1(rec80(0.72, k))} s |`);
}
console.log(`- 서 있을 때 0 → 80: ${f1(wait + 80 / regen)} s`);
// 견줄 몫: 같은 판 X 의 공격 기력 [셈 — 베기 12 × 무게 · 찌르기 7 × 무게 · 비기 35, 막아 받기 3 × 무게는 안 셈] · 1 대비 베기 한 번/분을 아끼려면(더 쓰려면) 분당 몇 m 걸어야 하나
const atkCost = S.cutPerMin * cut + S.thrustPerMin * 7 * wt + S.secretPerMin * 35;
const walk1 = S.xPerMin / perStep;
console.log(`- 견줄 몫 [셈]: X 공격 기력 분당 ${f1(atkCost)} (베기 ${f1(S.cutPerMin)} · 찌르기 ${f1(S.thrustPerMin)} · 비기 ${f2(S.secretPerMin)} 번/분 — 막아 받기 뺌) · 걷기(배율 1) ${f1(walk1)} → 걷기 몫 ${f1((100 * walk1) / (walk1 + atkCost))} %`);
for (const k of ks) if (k !== 1) console.log(`- 배율 ${k}: 1 대비 베기 한 번/분 = 분당 ${f1((cut * perStep) / Math.abs(1 - k))} m 걸을 때 (이 판 ${f1(S.xPerMin)} m → ${f2(((S.xPerMin / perStep) * Math.abs(1 - k)) / cut)} 번)`);
if (process.env.CLD_SPEEDS) {
  const [vf, vb, vs] = process.env.CLD_SPEEDS.split(',').map(Number);
  console.log(`- 잰 빠르기(CLD_SPEEDS 앞 ${vf} · 뒤 ${vb} · 옆 ${vs} m/s)로 0 → 80: ${ks.map((k) => `배율 ${k} → ${f1(rec80(vf, k))} · ${f1(rec80(vb, k))} · ${f1(rec80(vs, k))} s`).join(' / ')}`);
}
GAIT.cnLight = CN0;
