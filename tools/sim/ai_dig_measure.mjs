// ─────────────────────────────────────────────────────────────
//  ai_dig_measure.mjs — 짧은 칼 파고들기 재기 (11/14 사장님 '짧은 무기 파고들기는 동방이 내 기대치보다 약한 면과도 연결되어 중요해 …' · 시제품 src/dig_proto.js ·
//   값 config DIG_PROTO · 기록 docs/strike/ai_dig_2026-11-14.md). 사장님 11/14 'ai의 변화 재는 거 최소로 해' — 짧은 칼 넷 × 롱소드 AI · 숙련 5 · 씨앗 1 ~ 6 · 30 s · 벽 ·
//   홀수 씨앗 = 짧은 칼이 E 자리 · 짝수 = P 자리.
//  wall   — 지금 벽: 공격마다 시작 거리 · 다가감에서 가장 가까운 거리 · 칼 낸 거리 · 칠 거리(need) · 접은 까닭 · 다가가는 동안 내 다가섬 ↔ 롱소드 물러섬 · 간 보는 거리 · 다가가다 맞음
//  speed  — 걸음 빠르기 (스틱 끝 앞 · 뒤 · 옆 — 몸이 실제로 낸 골반 빠르기 · 게임 m/s) · AI 스틱 길(ai.js moveFeet toStick) · 박찬 앞 걸음 · 달림(시제품 C)
//  human  — 사람(손가락 봇 — tools/sim/school_balance.mjs · 독일 롱소드 · 스킬트리 모두) 대 짧은 칼 AI(숙련 5): 같은 계기
//  cmp    — 안 (지금 · A · B · C · A+B · A+C) × 짧은 칼 넷: 들어간 수 · 낸 칼 · 맞힌 칼 · 다가가다 맞음 · 사냥 겹 · 이김 · 짐 · 비김
//  node tools/sim/ai_dig_measure.mjs wall|speed|human|cmp [--weapons=hwando,qinggang,frozen_tuna,morgenstern] [--seeds=1-6] [--prof=5] [--dur=30] [--vars=now,A,B,C,AB,AC] [--json=파일]
//  node tools/sim/ai_dig_measure.mjs agg <json ...>   (cmp 조각을 모아 표)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG, DT, THREE } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const { DIG_PROTO, GAIT, BODY } = CONFIG;
const args = process.argv.slice(2);
const mode = args[0] ?? 'wall';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const p50 = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
export const VARS = { now: {}, A: { ai: 1 }, B: { step: 1 }, C: { run: 1 }, AB: { ai: 1, step: 1 }, AC: { ai: 1, run: 1 } };
const VAR_KO = { now: '지금', A: 'A', B: 'B', C: 'C', AB: 'A + B', AC: 'A + C' };
const WKO = { hwando: '환도 (동방)', qinggang: '청강검 (동방)', frozen_tuna: '냉동 참치 (무유파)', morgenstern: '모르겐슈테른 (무유파)' };

export function withDig(over, fn) {
  const keep = { ...DIG_PROTO };
  Object.assign(DIG_PROTO, { ai: 0, step: 0, run: 0 }, over);
  try { return fn(); } finally { Object.assign(DIG_PROTO, keep); }
}

/** 계기: 짧은 칼 AI(ai · 몸 me) 와 상대 몸 foe — G.step 을 감싸 스텝마다 읽음 (판 결과는 같다 — 읽기만) */
export function instrument(G, ai, me, foe) {
  const S = { atk: 0, entered: 0, strikes: 0, hits: 0, binds: 0, fold: { watch: 0, defend: 0, withdraw: 0, other: 0 }, foldTime: 0, d0: [], dmin: [], dStrike: [], need: [], hurtIn: 0, close: 0, recede: 0, apT: 0, holdMe: [], holdFoe: [], recvN: 0, dealtN: 0, recv: 0, dealt: 0 };
  let cur = null;
  const sa = ai.startAttack, ss = ai.startStrike, af = ai.afterStrike;
  ai.startAttack = function (...a) {
    const was = this.mode === 'attack' ? this.atkSeq : -1;
    const r = sa.apply(this, a);
    if (r && this.mode === 'attack' && !this.secretRun && this.atkSeq !== was && !a[2]?.chain) {
      S.atk++;
      cur = { d0: this.d, dmin: this.d, struck: false };
    }
    return r;
  };
  ai.startStrike = function (...a) {
    S.strikes++;
    if (cur && !cur.struck) {
      cur.struck = true;
      S.entered++;
      S.dStrike.push(this.d);
      S.need.push(this.need ?? NaN);
    }
    return ss.apply(this, a);
  };
  ai.afterStrike = function (...a) {
    if (this.hitLanded) S.hits++;
    else if (this.bound) S.binds++;
    return af.apply(this, a);
  };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (vic === me) {
      if (sv > 0) S.recvN++;
      S.recv += sv;
      if (ai.mode === 'attack' && (ai.phase === 'windup' || ai.phase === 'approach')) S.hurtIn++;
    }
    if (vic === foe) {
      if (sv > 0) S.dealtN++;
      S.dealt += sv;
    }
  };
  let pm = ai.mode, pp = ai.phase;
  const step = G.step.bind(G);
  G.step = () => {
    step();
    const fa = foe.aiCtl;
    if (ai.mode === 'watch') S.holdMe.push(ai.d);
    if (fa?.mode === 'watch') S.holdFoe.push(fa.d);
    if (cur && ai.mode === 'attack' && (ai.phase === 'approach' || ai.phase === 'windup')) {
      cur.dmin = Math.min(cur.dmin, ai.d);
      const a = me.bodies.pelvis.translation(), b = foe.bodies.pelvis.translation();
      const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
      const ux = dx / L, uz = dz / L;
      const va = me.bodies.pelvis.linvel(), vb = foe.bodies.pelvis.linvel();
      S.close += (va.x * ux + va.z * uz) * DT;
      S.recede += (vb.x * ux + vb.z * uz) * DT;
      S.apT += DT;
    }
    if (pm === 'attack' && ai.mode !== 'attack' && cur) {
      if (!cur.struck) {
        const k = ai.mode in S.fold ? ai.mode : 'other';
        S.fold[k]++;
        if (pp === 'approach' && ai.attackT > CONFIG.realS(1.3)) S.foldTime++;
      }
      S.d0.push(cur.d0);
      S.dmin.push(cur.dmin);
      cur = null;
    }
    pm = ai.mode;
    pp = ai.phase;
  };
  return S;
}

/** 한 판: 짧은 칼 AI(weapon · 숙련 prof) 대 롱소드 AI(숙련 foeProf) — 홀수 씨앗은 짧은 칼이 E 자리 */
export function fightOne({ weapon, seed, prof = 5, foeProf = prof, dur = 30 }) {
  const subjE = seed % 2 === 1;
  const G = newRound({ walls: true, seed, weapon: subjE ? 'longsword' : weapon, weapon2: subjE ? weapon : 'longsword', AI2Class: AI, persona: { proficiency: subjE ? prof : foeProf }, persona2: { proficiency: subjE ? foeProf : prof } });
  const me = subjE ? G.enemy : G.player;
  const foe = subjE ? G.player : G.enemy;
  const ai = subjE ? G.ai : G.ai2;
  const S = instrument(G, ai, me, foe);
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(me) && !out(foe)) G.step();
  const r = { weapon, seed, T: +G.t.toFixed(2), win: out(foe) && !out(me), lose: out(me) && !out(foe), hunt: foe.cnHunt?.n ?? 0, dig: { ...(ai.stats.dig ?? {}) }, digP: { ...(ai.stats.digP ?? {}) }, foeDigP: { ...(foe.aiCtl?.stats.digP ?? {}) }, digs: me.gait?.digs ?? 0, foeDigs: foe.gait?.digs ?? 0, ...S };
  G.world.free();
  return r;
}

/** 판들을 한 줄로 모음 */
export function sumRows(rs) {
  const n = rs.length;
  const sum = (f) => rs.reduce((s, r) => s + f(r), 0);
  const all = (f) => rs.flatMap(f);
  return {
    n, W: sum((r) => (r.win ? 1 : 0)), L: sum((r) => (r.lose ? 1 : 0)),
    atk: sum((r) => r.atk) / n, entered: sum((r) => r.entered) / n, strikes: sum((r) => r.strikes) / n, hits: sum((r) => r.hits) / n, binds: sum((r) => r.binds) / n,
    fold: { watch: sum((r) => r.fold.watch), defend: sum((r) => r.fold.defend), withdraw: sum((r) => r.fold.withdraw), other: sum((r) => r.fold.other) }, foldTime: sum((r) => r.foldTime),
    hurtIn: sum((r) => r.hurtIn) / n, recvN: sum((r) => r.recvN) / n, dealtN: sum((r) => r.dealtN) / n, recv: sum((r) => r.recv) / n, dealt: sum((r) => r.dealt) / n,
    d0: p50(all((r) => r.d0)), dmin: p50(all((r) => r.dmin)), dStrike: p50(all((r) => r.dStrike)), need: p50(all((r) => r.need)),
    close: sum((r) => r.close), recede: sum((r) => r.recede), apT: sum((r) => r.apT), holdMe: p50(all((r) => r.holdMe)), holdFoe: p50(all((r) => r.holdFoe)),
    hunt: sum((r) => r.hunt) / n, dash: sum((r) => r.digP?.dash ?? 0), runT: sum((r) => r.digP?.runT ?? 0), stepIn: sum((r) => r.digP?.stepIn ?? 0), cross: sum((r) => r.digP?.cross ?? 0), keep: sum((r) => r.digP?.keep ?? 0), wall: sum((r) => r.digP?.wall ?? 0),
    foeDash: sum((r) => r.foeDigP?.dash ?? 0), foeRunT: sum((r) => r.foeDigP?.runT ?? 0),
    digRec: sum((r) => r.dig?.recover ?? 0),
  };
}

function wallTable(rows) {
  const L = ['| 짧은 칼 AI (숙련 5) 대 롱소드 AI (숙련 5) | 판 | 공격 시작 / 판 | 들어간 수 / 판 | 칼 냄 / 판 (맞힘 · 막힘) | 칼 내기 전 접음 6 판 합: 간 보기 · 막기 · 물러남 · 그 밖 (그 가운데 다가감 시간 넘음) | 공격 시작 · 다가감 가장 가까이 · 칼 낸 거리 · 칠 거리 p50 m | 다가가는 동안 내 다가섬 ↔ 롱소드 물러섬 m (물러섬 몫) | 간 보는 거리 p50 나 · 롱소드 m | 다가가다 맞음 / 판 | 준 · 받은 칼날 상처 / 판 | 이김 · 짐 · 비김 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [w, tag, s] of rows) L.push(`| ${WKO[w] ?? w}${tag ? ` · ${tag}` : ''} | ${s.n} | ${f2(s.atk)} | ${f2(s.entered)} | ${f2(s.strikes)} (${f2(s.hits)} · ${f2(s.binds)}) | ${s.fold.watch} · ${s.fold.defend} · ${s.fold.withdraw} · ${s.fold.other} (${s.foldTime}) | ${f2(s.d0)} · ${f2(s.dmin)} · ${f2(s.dStrike)} · ${f2(s.need)} | ${f2(s.close)} ↔ ${f2(s.recede)} (${s.close > 0 ? Math.round((100 * s.recede) / s.close) : '-'} %) | ${f2(s.holdMe)} · ${f2(s.holdFoe)} | ${f2(s.hurtIn)} | ${f2(s.dealtN)} · ${f2(s.recvN)} | ${s.W} · ${s.L} · ${s.n - s.W - s.L} |`);
  return L.join('\n');
}

function cmpTable(rows) {
  const L = ['| 짧은 칼 | 안 | 판 | 공격 / 판 | 들어간 수 / 판 (첫 칼을 냄) | 낸 칼 / 판 (이어 친 칼 포함) | 맞힌 칼 / 판 | 다가가다 맞음 / 판 | 준 · 받은 칼날 상처 / 판 | 사냥 겹 / 판 | 이김 · 짐 · 비김 | 시제품 쓰임 6 판 합: 박참(나 · 롱소드) · 달린 s(나 · 롱소드) · 걸음 실린 칼 · 건넘 · 붙어 이어 침 · 울타리/지친 상대 몰아침 |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const [w, v, s] of rows) L.push(`| ${WKO[w] ?? w} | ${VAR_KO[v] ?? v} | ${s.n} | ${f2(s.atk)} | ${f2(s.entered)} | ${f2(s.strikes)} | ${f2(s.hits)} | ${f2(s.hurtIn)} | ${f2(s.dealtN)} · ${f2(s.recvN)} | ${w === 'hwando' || w === 'qinggang' ? f2(s.hunt) : '-'} | ${s.W} · ${s.L} · ${s.n - s.W - s.L} | ${s.dash} · ${s.foeDash} · ${f2(s.runT)} · ${f2(s.foeRunT)} · ${s.stepIn} · ${s.cross} · ${s.keep} · ${s.wall} |`);
  return L.join('\n');
}

/** 걸음 빠르기: E 몸을 스틱으로 몬다 (AI 끔) — 3 s 동안 마지막 1 s 의 골반 빠르기 앞뒤 · 옆 몫 (게임 m/s) */
function speedRun(stick, { run = 0, dash = 0, weapon = 'hwando' } = {}) {
  return withDig({ run, step: dash }, () => {
    const G = newRound({ walls: false, seed: 1, weapon: 'longsword', weapon2: weapon, gap: 8 });
    G.ai.update = () => {};
    const E = G.enemy;
    E.humanInput = true; // 사람 몸처럼 (박차기 조건 — gait humanInput)
    let peak = 0;
    const acc = [];
    let k = 0;
    while (E.feetHeld || k++ < Math.round(1.5 / DT)) {
      E.move.set(0, 0);
      G.step();
    }
    const st0 = E.stamina.value;
    const p0 = { ...E.bodies.pelvis.translation() };
    let d06 = NaN;
    for (let i = 0; i < Math.round(2.5 / DT); i++) {
      if (i === Math.round(0.6 / DT)) { const p = E.bodies.pelvis.translation(); d06 = Math.hypot(p.x - p0.x, p.z - p0.z); }
      E.move.set(stick[0], stick[1]);
      G.step();
      const v = E.bodies.pelvis.linvel();
      const f = E.forward(new THREE.Vector3());
      peak = Math.max(peak, Math.abs(v.x * f.x + v.z * f.z));
      if (i * DT > 1.5) acc.push(Math.hypot(v.x, v.z));
    }
    const r = { v: mean(acc), peak, d06, stam: E.stamina.value - st0, digs: E.gait?.digs ?? 0 };
    G.world.free();
    return r;
  });
}

if (isMain(import.meta.url)) {
  const weapons = arg('weapons', 'hwando,qinggang,frozen_tuna,morgenstern').split(',');
  const seeds = range(arg('seeds', '1-6'));
  const prof = +arg('prof', 5);
  const dur = +arg('dur', 30);
  if (mode === 'wall') {
    const rows = [];
    for (const w of weapons) {
      const rs = seeds.map((seed) => withDig({}, () => fightOne({ weapon: w, seed, prof, dur })));
      for (const r of rs) console.error(JSON.stringify({ w: r.weapon, seed: r.seed, T: r.T, win: r.win, lose: r.lose, atk: r.atk, strikes: r.strikes, hits: r.hits }));
      rows.push([w, '', sumRows(rs)]);
    }
    const ref = seeds.map((seed) => withDig({}, () => fightOne({ weapon: 'longsword', seed, prof, dur })));
    rows.push(['longsword', '견줌 (롱소드끼리)', sumRows(ref)]);
    console.log(wallTable(rows));
  } else if (mode === 'speed') {
    const L = ['| 걸음 (서 있다가 스틱 끝 2.5 s · 환도 몸) | 버틴 골반 빠르기 m/s (게임 · 끝 1 s) | 처음 0.6 s 에 간 거리 m | 박찬 걸음 |', '|---|---|---|---|'];
    for (const [name, st, o] of [['앞', [0, 1], {}], ['뒤', [0, -1], {}], ['옆', [1, 0], {}], ['앞 — 박찬 첫 걸음 (시제품 B)', [0, 1], { dash: 1 }], ['앞 — 달림 (시제품 C · 기력 50 위)', [0, 1], { run: 1 }]]) {
      const r = speedRun(st, o);
      L.push(`| ${name} | ${f2(r.v)} | ${f2(r.d06)} | ${r.digs} |`);
    }
    L.push(`| (셈) 걷는 앞 GAIT.moveSpeed · 뒤 × backFactor · 옆 × sideFactor | ${f2(GAIT.moveSpeed)} · ${f2(GAIT.moveSpeed * GAIT.backFactor)} · ${f2(GAIT.moveSpeed * GAIT.sideFactor)} | | |`);
    L.push(`| (셈) AI 다가감 스틱 0.25 ~ 0.45 → 앞 빠르기 · AI 간 보기 물러섬 스틱 끝 (toStick ÷ BODY.moveSpeed ${BODY.moveSpeed} · 뒤 × 0.75) → 뒤 빠르기 | ${f2(0.25 * GAIT.moveSpeed)} ~ ${f2(0.45 * GAIT.moveSpeed)} · ${f2(GAIT.moveSpeed * GAIT.backFactor)} | | |`);
    console.log(L.join('\n'));
  } else if (mode === 'human') {
    const { fightOne: botFight } = await import('./school_balance.mjs');
    const vars = arg('vars', 'now').split(',');
    const rows = [];
    for (const w of weapons) for (const v of vars) {
      const rs = [];
      for (const seed of seeds) withDig(VARS[v], () => {
        let S = null, ai = null, A = null, P = null;
        const res = botFight({ school: 'german', weapon: 'longsword', opp: w, seed, dur, onRound: ({ G, P: p, A: a }) => { ai = G.ai; A = a; P = p; S = instrument(G, G.ai, a, p); } });
        const out = (f) => !f.alive || f.state === 'dead';
        rs.push({ weapon: w, seed, win: out(P) && !out(A), lose: out(A) && !out(P), hunt: P.cnHunt?.n ?? 0, digP: { ...(ai.stats.digP ?? {}) }, foeDigP: {}, ...S });
        void res;
      });
      rows.push([w, VAR_KO[v] ?? v, sumRows(rs)]);
      console.error(w, v, JSON.stringify(rows.at(-1)[2]));
    }
    console.log(wallTable(rows).replace('롱소드 AI (숙련 5)', '사람 손가락 봇 (독일 롱소드)'));
  } else if (mode === 'cmp') {
    const vars = arg('vars', 'now,A,B,C,AB,AC').split(',');
    const out = [];
    for (const w of weapons) for (const v of vars) {
      const rs = seeds.map((seed) => withDig(VARS[v], () => fightOne({ weapon: w, seed, prof, dur })));
      out.push({ w, v, rs });
      console.error(w, v, JSON.stringify(sumRows(rs)));
    }
    const js = arg('json', '');
    if (js) writeFileSync(js, JSON.stringify(out));
    console.log(cmpTable(out.map((o) => [o.w, o.v, sumRows(o.rs)])));
  } else if (mode === 'agg') {
    const files = args.slice(1).filter((x) => !x.startsWith('--'));
    const all = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
    const order = Object.keys(VARS);
    all.sort((a, b) => (a.w === b.w ? order.indexOf(a.v) - order.indexOf(b.v) : weapons.indexOf(a.w) - weapons.indexOf(b.w)));
    console.log(cmpTable(all.map((o) => [o.w, o.v, sumRows(o.rs)])));
  }
}
