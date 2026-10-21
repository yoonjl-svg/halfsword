// 이탈리아 보법 — 거리 벌리기 계기 (10/21 사장님 '레이피어는 거리를 벌리며 싸우는 게 중요한데 지금 보법이 약간 모자란 거 같아 … 보폭을 약간 줄이는 대신 속도를 빠르게 해. 수치를 제안해봐').
//  재기만 — 판 값은 그대로이고, 갈래(아래 VARIANTS)는 이 프로세스 안에서만 schools.js 칸을 바꿨다 되돌린다. 판 하나는 결정적(seed 7 · 1/120 s).
//  플레이어가 스틱을 끝까지(또는 반) 민 대본에서: 간 거리 0.5 · 1 · 1.5 · 2 m 에 닿는 때 · 3 s 평균 빠르기 · 셋째 디딤 뒤 고른 빠르기 ·
//   디딤마다(walk·catch) 간격 · 몸이 간 거리(골반, 가는 쪽 몫) — 짧은 디딤(박자 걸음 빠른 몫 fastK > 1) · 긴 디딤(보통)으로 나눠 평균 · 초당 디딤 ·
//   걷기 기력(spent.move — 0.62 m 마다 1.4) · 같은 동안 회복 · 1 m 당 기력(막기 안 쥠 = 걷기 − 회복 · 막기 쥠 = 걷기만 — 막는 동안 회복이 멈춤).
//  대본: CB 가까이 뒤 끝 3 s(상대 가슴 2.3 m 에 서 있음 — 몸이 벌어지며 follow 문턱 밖으로) · CP 가까이 뒤 끝 3 s(상대가 2.3 m 를 지키며 따라옴) ·
//   CH 가까이 뒤 반(0.5) 3 s(따라옴 — 짝걸음) · FB 혼자 뒤 끝 3 s · FF 혼자 앞 끝 3 s · CS 가까이 옆 끝 3 s(서 있는 상대) · CT 가까이 뒤 톡 0.3 s 뒤 놓음 1.2 s
//  갈래: cur = 지금 판 · nobook = 보법 책 없음(기본 걸음 — 박자 걸음 없음) · 's=a,b,c' = setItalianStride(짧은 · 긴 계수 · 짧은 디딤 몸 빠르기) · 'w=f,b' = setItalianWalk(앞 · 뒤 빠르기 배율) ·
//   'a=k' = 짧은 디딤 몸 가속 한도 × k(rhythm.accel) · ';' 로 잇기 (예 's=0.72,0.99,1.3;w=1.15,1.15') · 갈래끼리는 '|'
//  실행: node tools/sim/it_gait_open.mjs [무기들 rapier,longsword] [갈래들 cur] [대본들 CB,CP,CH,FB,FF,CS,CT]   ·   IGO_ROWS=1 → 디딤 줄
import { newRound, DT, THREE } from './harness_m.mjs';
import { Gait } from '../../src/gait.js';
import { TRADITIONS, traditionOf, setItalianStride, setItalianWalk } from '../../src/schools.js';
import { STAMINA } from '../../src/config.js';
import { getWeapon } from '../../src/weapons.js';

const IDS = (process.argv[2] || 'rapier,longsword').split(',');
const VARS = (process.argv[3] || 'cur').split('|');
const SCN = (process.argv[4] || 'CB,CP,CH,FB,FF,CS,CT').split(',');
const ROWS = process.env.IGO_ROWS === '1';
// 출발 자리: 가까이 대본은 지키는 가슴 거리 × 다가간 스틱(쉬는 자세의 발 자리가 달라짐 — gait_even_feel 과 같은 아홉 갈래) · 혼자 대본은 쉼 길이 셋
const STARTS_NEAR = (process.env.IGO_STARTS ?? '2.0,2.3,2.6x0.35,0.5,0.8').split('x').map((a) => a.split(',').map(Number));
const NEAR = STARTS_NEAR[0].flatMap((keep) => STARTS_NEAR[1].map((approach) => ({ keep, approach, rest: 1.2 })));
const FAR = [1.0, 1.2, 1.4].map((rest) => ({ keep: 2.3, approach: 0.5, rest }));
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();

const SCRIPTS = {
  CB: { name: '가까이 뒤 끝 3 s (상대 서 있음)', foe: 'still', seq: [[0, -1, 3]] },
  CP: { name: '가까이 뒤 끝 3 s (상대 따라옴)', foe: 'keep', seq: [[0, -1, 3]] },
  CH: { name: '가까이 뒤 반 3 s (상대 따라옴)', foe: 'keep', seq: [[0, -0.5, 3]] },
  FB: { name: '혼자 뒤 끝 3 s', foe: 'far', seq: [[0, -1, 3]] },
  FF: { name: '혼자 앞 끝 3 s', foe: 'far', seq: [[0, 1, 3]] },
  CS: { name: '가까이 옆 끝 3 s (상대 서 있음)', foe: 'still', seq: [[1, 0, 3]] },
  CT: { name: '가까이 뒤 톡 0.3 s → 놓음', foe: 'still', tap: true, seq: [[0, -1, 0.3], [0, 0, 1.2]] },
  CR: { name: '가까이 뒤 끝 1.5 s → 놓음 1 s (상대 따라옴)', foe: 'keep', seq: [[0, -1, 1.5], [0, 0, 1]] },
  CA: { name: '가까이 뒤 ↔ 앞 끝 0.75 s 씩 3 s (상대 서 있음)', foe: 'still', seq: [[0, -1, 0.75], [0, 1, 0.75], [0, -1, 0.75], [0, 1, 0.75]] },
};

// 갈래 칸 되돌리기 — 지금 판 값을 그대로 적어 두었다가 판마다 되돌린다
const g = TRADITIONS.italian.gait;
const SNAP = { rhythm: { ...g.rhythm }, strideK: g.strideK, pairStride: g.even.pair.stride, foreMul: g.foreMul, backMul: g.backMul }; // 앞 · 뒤 배율도 판 값(10/21 이탈리아 backMul 'flat')
function reset() {
  for (const k of Object.keys(g.rhythm)) if (!(k in SNAP.rhythm)) delete g.rhythm[k];
  Object.assign(g.rhythm, SNAP.rhythm);
  g.strideK = SNAP.strideK;
  g.even.pair.stride = SNAP.pairStride;
  setItalianWalk('1');
  if (SNAP.foreMul != null) g.foreMul = SNAP.foreMul;
  if (SNAP.backMul != null) g.backMul = SNAP.backMul;
}
function apply(v) {
  reset();
  const o = { nobook: false };
  for (const part of v.split(';').filter(Boolean)) {
    if (part === 'cur') continue;
    if (part === 'nobook') o.nobook = true;
    else if (part.startsWith('s=')) {
      if (!setItalianStride(part.slice(2))) throw new Error(`못 읽음 ${part}`);
    } else if (part.startsWith('w=')) {
      if (!setItalianWalk(part.slice(2))) throw new Error(`못 읽음 ${part}`);
    } else if (part.startsWith('p=')) g.even.pair.stride = +part.slice(2); // 가까이 짝걸음 보폭 상한(m) — setItalianStride 가 0.28 × 긴 계수 ÷ 0.7 로 정한 값을 덮음(s= 뒤에 둠)
    else if (part.startsWith('a=')) g.rhythm.accel = +part.slice(2); // 짧은 디딤(박자 걸음 빠른 몫) 몸 가속 한도 배율 — fighter.js driveBalance fastAcc (독일 간격 잡기 chase.accel 1.5 와 같은 칸)
    else throw new Error(`모르는 갈래 ${part}`);
  }
  return o;
}

let rec = null;
// 걸음이 가려는 속도를 얼마나 바꾸나: update 들어갈 때 · 나올 때 가려는 속도 크기(빠른 디딤 몸 빠르기 × · 붙잡기 반사 뒤 느림 slow · reachSlow 가 섞인 값)
const U0 = Gait.prototype.update;
Gait.prototype.update = function (dt, want, fwd, rgt) {
  const a = Math.hypot(want.x, want.z);
  const r = U0.call(this, dt, want, fwd, rgt);
  if (rec && this.f === rec.who && rec.on) {
    rec.wIn += a;
    rec.wOut += Math.hypot(want.x, want.z);
    rec.slowSum += this.slow > 0 ? 1 - 0.6 * (this.slow >= 1 ? 1 : this.slow ** 3 * (10 - 15 * this.slow + 6 * this.slow ** 2)) : 1;
    rec.nU++;
  }
  return r;
};
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  B0.call(this, l, kind, T);
  if (!rec || this.f !== rec.who) return;
  rec.open[l.k] = { t: rec.t, kind, fastK: this.fastK };
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  const kind = l.kind;
  TD0.call(this, l, speed);
  if (!rec || this.f !== rec.who) return;
  const b = rec.open[l.k];
  rec.open[l.k] = null;
  const p = this.f.bodies.pelvis.translation();
  rec.tds.push({ t: rec.t, k: l.k, kind, fast: !!(b && b.fastK > 1), px: p.x, pz: p.z, follow: !!this.follow });
};

function run(id, v, scn, start) {
  reset(); // 다가가기 · 쉼은 지금 판 걸음으로(갈래끼리 출발 자리가 같게) — 갈래는 스틱을 밀기 바로 전에 건다
  const S = SCRIPTS[scn];
  const KEEP = start.keep;
  const G = newRound({ walls: S.foe !== 'far', seed: 7, weapon: id, weapon2: 'longsword' });
  const P = G.player;
  const E = G.enemy;
  if (S.foe === 'far') G.park();
  let foeMode = 'approach';
  G.ai.update = () => {
    if (foeMode === 'keep') E.move.set(0, clamp(2 * (P.foeDistance() - KEEP), -1, 1));
    else E.move.set(0, 0);
  };
  let t = 0;
  const st = { falls: 0, levT: 0 };
  let prevSt = P.state;
  const step = (mx, my) => {
    P.move.set(mx, my);
    G.step();
    t += DT;
    if (!rec) return;
    rec.t = t;
    if (prevSt === 'stand' && P.state === 'down') st.falls++;
    prevSt = P.state;
    if (P.gait.active && P.gait.levC > 0.3) st.levT += DT;
  };
  while (t < 2.3) step(0, 0); // 시작 정지 (ARENA.startHold)
  if (S.foe !== 'far') {
    const t1 = t;
    while (P.foeDistance() > KEEP + 0.3 && t - t1 < 10) step(0, start.approach);
  }
  for (let i = 0, n = Math.round(start.rest / DT); i < n; i++) step(0, 0); // 쉼 — 박자 셈이 처음부터 · 자세 고치기 끝
  if (S.foe === 'keep') foeMode = 'keep';
  const o = apply(v);
  if (o.nobook) P.schoolFootwork = false;
  P.gait._art = null; // 걸음 칸을 다시 고름(gait.js update — gaitParams)
  const [mx0, my0] = S.seq[0];
  P.forward(_f);
  P.right(_r);
  const d = my0 !== 0 ? { x: _f.x * Math.sign(my0), z: _f.z * Math.sign(my0) } : { x: _r.x * Math.sign(mx0), z: _r.z * Math.sign(mx0) };
  P.stamina.value = 30; // 회복이 위 끝(100)에 막히지 않게(3 s × 21 = 63 — 30 + 63 < 100 · 0 밑 지침 단계로도 안 감)
  const sp0 = P.stamina.spent.move;
  const rc0 = P.stamina.recovered;
  const v0 = P.stamina.value;
  const gap0 = P.foeDistance();
  rec = { who: P, t, tds: [], open: { F: null, B: null }, on: true, wIn: 0, wOut: 0, slowSum: 0, nU: 0 };
  const t0 = t;
  const p0 = { ...P.bodies.pelvis.translation() };
  const along = (p) => (p.x - p0.x) * d.x + (p.z - p0.z) * d.z;
  const marks = [0.25, 0.5, 1, 1.5, 2];
  const hit = {};
  const smp = [];
  let t1 = t0;
  for (const [mx, my, dur] of S.seq) {
    rec.on = !!(mx || my);
    for (let i = 0, n = Math.round(dur / DT); i < n; i++) {
      step(mx, my);
      const a = along(P.bodies.pelvis.translation());
      for (const m of marks) if (hit[m] == null && a >= m) hit[m] = t - t0;
      smp.push([t - t0, a]);
    }
    if (mx || my) t1 = t;
  }
  const r = rec;
  rec = null;
  const pEnd = P.bodies.pelvis.translation();
  const res = {
    dist: along(pEnd),
    distStick: smp.filter(([tt]) => tt <= t1 - t0 + 1e-9).pop()?.[1] ?? NaN,
    dur: t1 - t0,
    hit,
    spent: P.stamina.spent.move - sp0,
    recov: P.stamina.recovered - rc0,
    dv: P.stamina.value - v0,
    gap0,
    gap1: P.foeDistance(),
    st,
    r,
    t0,
    t1,
    d,
    p0,
    smp,
  };
  reset();
  return res;
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
function analyse(R) {
  const { r, t0, t1, d } = R;
  const along = (a, b) => (b.px - a.px) * d.x + (b.pz - a.pz) * d.z;
  const all = r.tds.filter((x) => x.t > t0 && x.t <= t1 + 0.05 && (x.kind === 'walk' || x.kind === 'catch'));
  const rows = all.map((a, i) => ({ ...a, iv: i ? a.t - all[i - 1].t : NaN, body: i ? along(all[i - 1], a) : NaN }));
  const steady = rows.slice(2);
  const S = steady.filter((x) => x.fast);
  const L = steady.filter((x) => !x.fast);
  // 고른 빠르기: 셋째 디딤 ~ 스틱 끝
  const ts = rows[2]?.t;
  const sm = R.smp.filter(([tt]) => ts != null && tt >= ts - t0 && tt <= t1 - t0);
  const vSteady = sm.length > 2 ? (sm[sm.length - 1][1] - sm[0][1]) / (sm[sm.length - 1][0] - sm[0][0]) : NaN;
  const span = steady.length > 1 ? steady[steady.length - 1].t - steady[0].t : NaN;
  return {
    n: rows.length,
    rate: steady.length > 1 ? (steady.length - 1) / span : NaN,
    vAvg: R.distStick / R.dur,
    vSteady,
    wRatio: r.wIn > 0 ? r.wOut / r.wIn : NaN,
    wIn: r.nU ? r.wIn / r.nU : NaN,
    slowK: r.nU ? r.slowSum / r.nU : NaN,
    sLen: mean(S.map((x) => x.body)),
    sIv: mean(S.map((x) => x.iv)),
    nS: S.length,
    lLen: mean(L.map((x) => x.body)),
    lIv: mean(L.map((x) => x.iv)),
    nL: L.length,
    allLen: mean(steady.map((x) => x.body)),
    catches: r.tds.filter((x) => x.t > t0 && x.kind === 'catch').length,
    rows,
  };
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '-');
const fin = (a) => a.filter(Number.isFinite);
const M = (a) => mean(fin(a));
const rng = (a) => (fin(a).length ? `${f2(Math.min(...fin(a)))}~${f2(Math.max(...fin(a)))}` : '-');
const per = STAMINA.stepCosts;
console.log(`이탈리아 보법 거리 벌리기 계기 · 플레이어 · seed 7 · 물리 시간(게임 화면은 템포 1.1 배 빠름) · 걷기 기력 ${per.default}/0.62 m(이탈리아·독일) — 1 m 당 ${(per.default / STAMINA.stepDistance).toFixed(2)} · 가까이 대본 출발 ${NEAR.length} 갈래 평균(지키는 거리 ${STARTS_NEAR[0].join('·')} × 다가간 스틱 ${STARTS_NEAR[1].join('·')}) · 혼자 대본 쉼 1.0·1.2·1.4 s 평균`);
console.log('| 대본 | 무기 | 갈래 | 0.5 · 1 · 1.5 m 닿는 때 s (1 m 범위) | 스틱 동안 간 m · 평균 m/s | 고른 빠르기 m/s (가려는 속도 · 걸음이 곱한 몫 · 붙잡기 뒤 느림 몫) | 초당 디딤 | 짧은 디딤: 몸 m · 간격 s (수) | 긴 디딤: 몸 m · 간격 s (수) | 모든 디딤 몸 m | 1 m 당 기력 (막기 안 쥠 / 쥠) | 놓은 뒤 더 간 m | 넘어짐 · 붙잡기 s · catch (합) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const detail = [];
for (const scn of SCN) {
  for (const id of IDS) {
    const it = traditionOf(getWeapon(id)) === 'italian';
    for (const v of it ? VARS : ['cur']) {
      const starts = SCRIPTS[scn].foe === 'far' ? FAR : NEAR;
      const L = starts.map((start) => {
        const R = run(id, v, scn, start);
        return { R, A: analyse(R) };
      });
      const g = (fn) => L.map(fn);
      const m = g(({ R }) => R.distStick);
      const perM = (fn) => M(L.map((x) => (x.R.distStick > 0.05 ? fn(x.R) / x.R.distStick : NaN)));
      const sum = (fn) => L.reduce((a, x) => a + fn(x), 0);
      console.log(`| ${scn} ${SCRIPTS[scn].name} | ${id} | ${it ? v : '-'} | ${[0.5, 1, 1.5].map((k) => f2(M(g(({ R }) => R.hit[k] ?? NaN)))).join(' · ')} (${rng(g(({ R }) => R.hit[1] ?? NaN))}) | ${f2(M(m))} · ${f2(M(g(({ A }) => A.vAvg)))} | ${f2(M(g(({ A }) => A.vSteady)))} (목표 ${f2(M(g(({ A }) => A.wIn)))} · 걸음 뒤 × ${f2(M(g(({ A }) => A.wRatio)))} · 느림 × ${f2(M(g(({ A }) => A.slowK)))}) | ${f2(M(g(({ A }) => A.rate)))} | ${f3(M(g(({ A }) => A.sLen)))} · ${f3(M(g(({ A }) => A.sIv)))} (${sum(({ A }) => A.nS)}) | ${f3(M(g(({ A }) => A.lLen)))} · ${f3(M(g(({ A }) => A.lIv)))} (${sum(({ A }) => A.nL)}) | ${f3(M(g(({ A }) => A.allLen)))} | ${f2(perM((R) => R.spent - R.recov))} / ${f2(perM((R) => R.spent))} | ${f2(M(g(({ R }) => R.dist - R.distStick)))} | ${sum(({ R }) => R.st.falls)} · ${f2(sum(({ R }) => R.st.levT))} · ${sum(({ A }) => A.catches)} |`);
      if (ROWS) {
        const { R, A } = L[Math.floor(L.length / 2)];
        detail.push(`\n#### ${scn} · ${id} · ${v} (가운데 출발)\n| 디딤 | 시각 s | 간격 s | 발 | 꼴 | 몸 m | 짧은 | follow |\n|---|---|---|---|---|---|---|---|`);
        A.rows.forEach((x, i) => detail.push(`| ${i + 1} | ${f2(x.t - R.t0)} | ${f3(x.iv)} | ${x.k} | ${x.kind} | ${f3(x.body)} | ${x.fast ? 'S' : 'L'} | ${x.follow ? 'f' : ''} |`));
      }
    }
  }
}
if (detail.length) console.log(detail.join('\n'));
