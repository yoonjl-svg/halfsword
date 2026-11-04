// ─────────────────────────────────────────────────────────────
//  singir_fall.mjs — 싱지르(이베리아 비기 ibSpin)를 낸 뒤 내 몸이 넘어지는 까닭 재기 (11/05 · 기록 docs/strike/singir_fall_2026-11-05.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만). 판 = school_balance.mjs fightOne 그대로(사람 손가락 봇 대 숙련 3 AI · 자연 바인드 · 지금 기본값).
//   꽂개(probe — 읽기만): 내 몸의 넘어짐(서 있음 → 다른 상태)을 부른 곳으로 가른다 —
//    'tilt' 몸 기울기(fighter.updateState — fallTiltDeg) · 'feet' 발 밖 벗어남(offBalanceTime > fallDelay) · 'gauge' 휘청 게이지(맞은 에너지 × staggerPerJoule — 맞아서) ·
//    'legs' 다리 못 버팀 · 'head' 머리 둔타(applyWound) · 'sever' 다리 잘림 · 'buckle' 무릎 꺾기 · 'revive' 죽었다 되살아남(맞아서) · 그 밖.
//   싱지르 하나마다: 낸 때부터 1.6 실제 s 동안 차례(먼저 감기 pre · 돌기 spin · 받아 멈춤 settle · 따라 지나감 follow · 굳음 stiff · 뒤 after) ·
//    차례마다 몸 기울기 최대 · 발 밖 벗어남 최대 · 골반 수평 빠르기 최대 · 받은 맞음(에너지 · 부위) · 내 칼 ↔ 상대 몸 · 칼 닿음 · 넘어짐(그때 차례 · 까닭).
//  node tools/sim/singir_fall.mjs run [--cells=iberian:zweihander:longsword,...] [--seeds=1-12] [--dur=30] [--set=SECRET.ibSpin.x=1] [--exp=nospin|still|nohit|ropes] [--json=파일] [--trace]
//  node tools/sim/singir_fall.mjs agg <json ...>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { fightOne } from './school_balance.mjs';
import { CONFIG, THREE } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { armRopes } from '../../src/secret_instant.js';

const K = CONFIG.TIME.k;
const WIN = 1.6; // 싱지르 하나를 따라가는 실제 s
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));

/** --set=a.b=1,c=2 (이 프로세스 안 — school_balance applySets 와 같은 꼴) */
export function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}

/** 지금 비기 차례 (읽기만) */
function stageOf(P) {
  const run = P.skill.sec;
  const S = P.ibSpin;
  if (S) return S.tp < S.pre ? 'pre' : S.settle ? 'settle' : 'spin';
  if (run?.S?.do?.spin) return run.stage === 'spin' ? 'spin' : run.stage; // follow · stiff
  return 'after';
}

/** 넘어짐 까닭 (knockDown 직전 몸 상태 + 부른 곳) */
function fallWhy(P, stack) {
  if (stack.includes('revive')) return 'revive';
  if (stack.includes('buckleCheck') || stack.includes('whipKneel')) return 'buckle';
  if (/\bsever\b|\.sever /.test(stack)) return 'sever'; // 팔다리 잘림 (다리를 잃으면 서지 않음 — fighter.sever)
  if (stack.includes('applyWound')) return 'head';
  if (stack.includes('updateState')) {
    const tilt = P.tiltDeg() - THREE.MathUtils.radToDeg(P.hunch ?? 0);
    if (tilt > CONFIG.BODY.fallTiltDeg) return 'tilt';
    if (P.balance <= 0) return 'gauge';
    if (P.offBalanceTime > CONFIG.BALANCE.fallDelay) return 'feet';
    return 'legs';
  }
  return 'other';
}

/** 꽂개 하나 (판마다 새로) */
/**
 * 가르기 꽂개 (재기만 — 게임 값 아님 · 이 프로세스 안 · `--exp=a,b`): 싱지르 대본만 건드리므로 첫 싱지르 전까지 판은 바이트 같다(같은 씨앗 견줌).
 *  nospin = 싱지르를 안 냄(같은 때 원 입력이 보통 긋기로 — '안 냈으면' 견줌) · still = 대본 동안 내 몸 빠르기를 맞음 에너지 셈에서 뺌(내 몸이 칼에 들이받은 몫) ·
 *  nohit = 대본 동안 상대 칼이 내 몸에 낸 상처 · 휘청을 없앰(맞음 몫) · ropes = 대본 동안 손목 원뿔 · 칼 어깨 면 밧줄을 뗌(밧줄 몫 — 칼끝 돌려 빼기 고침과 같은 손)
 */
function expPatch(exp, G, P) {
  if (exp.has('nospin')) {
    const sec = P.skill.secret.bind(P.skill);
    P.skill.secret = (o) => {
      if (!o?.S?.do?.spin) return sec(o);
      if (P.state === 'stand' && P.alive && (P._wouldSpin == null || G.t - P._wouldSpin > WIN * K)) P._wouldSpin = G.t; // 냈을 때 (견줌 창의 시작)
      return false;
    };
  }
  if (exp.has('still')) {
    const an = G.combat.analyze.bind(G.combat);
    G.combat.analyze = (pr, point, S, Pp, ...rest) => {
      if (pr?.v?.fighter === P && P.ibSpin && Pp) Pp = { ...Pp, v: new THREE.Vector3(), w: new THREE.Vector3() };
      return an(pr, point, S, Pp, ...rest);
    };
  }
  if (exp.has('nohit')) {
    const aw = P.applyWound.bind(P);
    P.applyWound = (h) => (P.ibSpin ? undefined : aw(h));
  }
}
function makeProbe({ trace = false, exp = new Set() } = {}) {
  const spins = [];
  let G, P, A;
  let live = null; // 지금 따라가는 싱지르
  const falls = []; // 판 전체 내 넘어짐 (까닭 · 싱지르 창 안인가)
  const wounds = []; // 내가 받은 맞음 (게임 t)
  return {
    init(o) {
      ({ G, P, A } = o);
      expPatch(exp, G, P);
      // 넘어짐 까닭: knockDown · setState(되살아남) 를 감싼다 (몸 · 난수는 그대로 — 읽기만)
      const kd = P.knockDown.bind(P);
      P.knockDown = (heavy) => {
        if (P.state === 'stand') {
          const why = fallWhy(P, new Error().stack ?? '');
          const rec = { t: G.t, why, heavy: !!heavy, stage: stageOf(P), tilt: r2(P.tiltDeg()), bal: r2(P.balance), obt: r3(P.offBalanceTime), ob: r3(P.offBalance) };
          P._fallRec = rec;
        }
        return kd(heavy);
      };
      const ss = P.setState.bind(P);
      P.setState = (s) => {
        const was = P.state;
        ss(s);
        if (was === 'stand' && P.state !== 'stand' && P.state !== 'dead') {
          const rec = P._fallRec && G.t - P._fallRec.t < 1e-6 ? P._fallRec : { t: G.t, why: fallWhy(P, new Error().stack ?? ''), stage: stageOf(P), tilt: r2(P.tiltDeg()), bal: r2(P.balance) };
          P._fallRec = null;
          const last = wounds.filter((w) => G.t - w.t <= 0.5 * K);
          rec.recentHit = last.length ? { n: last.length, E: r2(last.reduce((s, w) => s + w.E, 0)), parts: [...new Set(last.map((w) => w.part))].join('/'), mine: r2(Math.max(...last.map((w) => w.mine ?? 0))), swing: last.some((w) => w.swing) } : null;
          falls.push(rec);
          if (live && G.t - live.t0 <= WIN * K) live.fall ??= { ...rec, dt: r3((G.t - live.t0) / K) };
        }
      };
      const pw = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, point, pr, ...rest) => {
        pw?.(att, vic, r, point, pr, ...rest);
        if (vic === P && att === A) {
          // 다가온 빠르기 중 내 몸이 낸 몫 (combat.js analyze 와 같은 스텝 전 상태 — 칼 v + w × r · 몸 부위 v + w × r): 1 에 가까우면 내 몸이 서 있는 칼에 들이받음
          let mine = null;
          let vb = null;
          let vv = null;
          const S = pr?.w?.state || att.cache?.sword;
          const Pp = pr ? vic.cache?.parts?.[pr.v.part] : null;
          if (S && Pp && point) {
            const va = new THREE.Vector3().copy(point).sub(S.com).cross(S.w).negate().add(S.v);
            const vp = new THREE.Vector3().copy(point).sub(Pp.com).cross(Pp.w).negate().add(Pp.v);
            const rel = va.clone().sub(vp);
            const sp = rel.length();
            if (sp > 1e-6) {
              const dir = rel.divideScalar(sp);
              mine = r2(-vp.dot(dir) / sp);
              vb = r2(va.length());
              vv = r2(vp.length());
            }
          }
          const w = { t: G.t, E: r.energy ?? 0, part: r.part ?? r.zone, type: r.type, sev: r.type === 'blunt' ? 0 : r.severity ?? 0, mine, vb, vv, swing: !!(A.skill?.swinging || A.skill?.tap || G.ai?.mode === 'attack'), q: P.ibSpin ? r2(P.ibSpin.q) : null, touched: P.ibSpin ? P.ibSpin.touchT != null : null };
          wounds.push(w);
          if (live && G.t - live.t0 <= WIN * K) live.hits.push({ dt: r3((G.t - live.t0) / K), stage: stageOf(P), E: r2(w.E), part: w.part, zone: r.zone, type: w.type, sev: r2(w.sev), mine, vb, vv, swing: w.swing, q: w.q, touched: w.touched, ai: G.ai?.mode ?? null });
        }
        if (vic === A && att === P && live && G.t - live.t0 <= WIN * K) live.dealt.push({ dt: r3((G.t - live.t0) / K), stage: stageOf(P), q: P.ibSpin ? r2(P.ibSpin.q) : null, free: P.ibSpin ? !!P.ibSpin.free : null, E: r2(r.energy ?? 0), part: r.part ?? r.zone, type: r.type, sev: r2(r.type === 'blunt' ? 0 : r.severity ?? 0) });
      };
    },
    step(cur) {
      if (exp.has('ropes')) {
        if (P.ibSpin && !P._ropesOff) (P._ropesOff = { grip: !!P.gripCone, sh: !!P.shoulderRopes }), armRopes(P, false);
        else if (!P.ibSpin && P._ropesOff) (P._ropesOff = null), P.alive && P.armed && armRopes(P, true);
      }
      const would = P._wouldSpin != null && P._wouldSpin !== live?.t0 ? P._wouldSpin : null;
      if ((cur?.name === 'ibSpin' && cur !== live?.cur) || would != null) {
        if (would == null) P._wouldSpin = null;
        live = { cur: would != null ? null : cur, t0: would ?? cur.t, d0: r3(would != null ? P.foeDistance() : cur.dist0), st: {}, hits: [], dealt: [], fall: null, steel: 0, steelStage: {}, done: null, minD: Infinity, foeAtk: 0 };
        spins.push(live);
      }
      if (!live || G.t - live.t0 > WIN * K) return;
      if (P.ibSpin && live.near == null) live.near = !!P.ibSpin.near;
      const sg = stageOf(P);
      const s = (live.st[sg] ??= { n: 0, tilt: 0, ob: 0, obt: 0, pv: 0, pw: 0, bal: 100, t0: r3((G.t - live.t0) / K) });
      s.n++;
      if (P.state === 'stand') {
        s.tilt = Math.max(s.tilt, P.tiltDeg());
        s.ob = Math.max(s.ob, P.offBalance ?? 0);
        s.obt = Math.max(s.obt, P.offBalanceTime ?? 0);
        const v = P.bodies.pelvis.linvel();
        s.pv = Math.max(s.pv, Math.hypot(v.x, v.z));
        s.pw = Math.max(s.pw, Math.abs(P.bodies.pelvis.angvel().y));
        s.bal = Math.min(s.bal, P.balance);
      }
      if (P.feel?.touching) {
        live.steel++;
        live.steelStage[sg] = (live.steelStage[sg] ?? 0) + 1;
      }
      live.minD = Math.min(live.minD, P.foeDistance());
      if (G.ai?.mode === 'attack' || A.skill?.swinging || A.skill?.tap) live.foeAtk++;
      if (P.ibSpinDone && !live.done) live.done = { why: P.ibSpinDone.why, q: r3(P.ibSpinDone.q), touchT: r3(P.ibSpinDone.touchT), blocked: !!P.ibSpinDone.blocked };
      if (!live.done && P.skill.sec?.spin) live.done = { why: P.skill.sec.spin.why, q: r3(P.skill.sec.spin.q), touchT: r3(P.skill.sec.spin.touchT), blocked: !!P.skill.sec.spin.blocked };
      if (trace && Math.floor(((G.t - live.t0) / K) * 20) !== Math.floor(((G.t - live.t0 - CONFIG.PHYSICS.timestep) / K) * 20)) {
        const pp = P.bodies.pelvis.translation();
        const v = P.bodies.pelvis.linvel();
        console.error('TR', ((G.t - live.t0) / K).toFixed(2), sg, P.state, 'tilt', P.tiltDeg().toFixed(0), 'ob', (P.offBalance ?? 0).toFixed(2), 'obt', (P.offBalanceTime ?? 0).toFixed(2), 'bal', P.balance.toFixed(0), 'pv', Math.hypot(v.x, v.z).toFixed(2), 'py', pp.y.toFixed(2), 'd', P.foeDistance().toFixed(2), 'steel', +!!P.feel?.touching, 'stF', +!!P.gait?.legs?.F?.stance, 'stB', +!!P.gait?.legs?.B?.stance, 'q', P.ibSpin ? P.ibSpin.q.toFixed(2) : '-', 'free', +!!P.ibSpin?.free, 'ai', G.ai?.mode ?? '-', G.ai?.phase ?? '-', 'atip', (A.tipVel?.length?.() ?? 0).toFixed(1), 'ptip', (P.tipVel?.length?.() ?? 0).toFixed(1), 'Apain', (A.pain ?? 0).toFixed(2));
      }
    },
    done() {
      return {
        falls: falls.map((f) => ({ t: r3(f.t / K), why: f.why, stage: f.stage, tilt: f.tilt, bal: f.bal, obt: f.obt, hit: f.recentHit })),
        spins: spins.map((x) => ({
          t: r3(x.t0 / K), d0: x.d0, near: x.near ?? null, minD: r3(x.minD), done: x.done, steel: x.steel, steelStage: x.steelStage, foeAtk: x.foeAtk,
          st: Object.fromEntries(Object.entries(x.st).map(([k, s]) => [k, { t0: s.t0, n: s.n, tilt: r2(s.tilt), ob: r3(s.ob), obt: r3(s.obt), pv: r2(s.pv), pw: r2(s.pw), bal: r2(s.bal) }])),
          hits: x.hits, dealt: x.dealt, fall: x.fall && { dt: x.fall.dt, why: x.fall.why, stage: x.fall.stage, tilt: x.fall.tilt, bal: x.fall.bal, obt: x.fall.obt, hit: x.fall.recentHit },
        })),
      };
    },
  };
}

export function runOne({ school = 'iberian', weapon, opp, seed, dur = 30, trace = false, exp = new Set() }) {
  const probe = makeProbe({ trace, exp });
  const r = fightOne({ school, weapon, opp, seed, dur, probe });
  const sp = r.fires.filter((f) => f.name === 'ibSpin');
  return { weapon, opp, seed, win: r.win, lose: r.lose, T: r.T, dealt: r.dealt, recv: r.recv, falls: r.falls, fires: sp, probe: r.probe };
}

// ── 묶음 ──
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const HIT = new Set(['gauge', 'head', 'sever', 'buckle', 'revive']);
export function summarize(runs) {
  const out = [];
  const cells = {};
  for (const r of runs) (cells[`${r.weapon}:${r.opp}`] ??= []).push(r);
  out.push('| 칸 (내 무기 · 상대) | 판 | 이김 · 짐 · 비김 | 준 · 받은 심각도/판 | 내 넘어짐/판 (몸 균형 · 맞아서) | 싱지르 낸 수 | 맞음 | 맞음당 심각도 | 1 s 안 넘어짐 (몸 균형 · 맞아서) | 1.6 s 안 넘어짐 |');
  out.push('|---|---:|---|---|---|---:|---:|---:|---|---:|');
  const all = [];
  for (const [k, rs] of Object.entries(cells)) {
    const n = rs.length;
    const W = rs.filter((r) => r.win).length;
    const L = rs.filter((r) => r.lose).length;
    const fb = rs.flatMap((r) => r.probe.falls);
    const fBal = fb.filter((f) => !HIT.has(f.why)).length;
    const fHit = fb.length - fBal;
    const fires = rs.flatMap((r) => r.fires);
    const sp = rs.flatMap((r) => r.probe.spins);
    all.push(...sp);
    const hit = fires.filter((f) => f.w > 0);
    const f1 = sp.filter((s) => s.fall && s.fall.dt <= 1);
    const f1b = f1.filter((s) => !HIT.has(s.fall.why)).length;
    out.push(`| ${k} | ${n} | ${W} · ${L} · ${n - W - L} | ${mean(rs.map((r) => r.dealt))?.toFixed(2)} · ${mean(rs.map((r) => r.recv))?.toFixed(2)} | ${(fb.length / n).toFixed(2)} (${(fBal / n).toFixed(2)} · ${(fHit / n).toFixed(2)}) | ${sp.length} | ${pct(hit.length, fires.length)} | ${mean(hit.map((f) => f.sev))?.toFixed(2) ?? '–'} | ${pct(f1.length, sp.length)} (${f1b} · ${f1.length - f1b}) | ${pct(sp.filter((s) => s.fall).length, sp.length)} |`);
  }
  // 넘어짐 까닭 × 차례
  const fl = all.filter((s) => s.fall);
  const by = {};
  for (const s of fl) {
    const k = `${s.fall.why}@${s.fall.stage}`;
    by[k] = (by[k] ?? 0) + 1;
  }
  out.push('', `싱지르 ${all.length} 번 · 1.6 s 안 넘어짐 ${fl.length} (1 s 안 ${fl.filter((s) => s.fall.dt <= 1).length})`, '', '| 까닭 @ 차례 | 수 | 낸 뒤 s (평균) |', '|---|---:|---:|');
  for (const [k, n] of Object.entries(by).sort((a, b) => b[1] - a[1])) out.push(`| ${k} | ${n} | ${mean(fl.filter((s) => `${s.fall.why}@${s.fall.stage}` === k).map((s) => s.fall.dt)).toFixed(2)} |`);
  // 차례마다 몸 (넘어진 것 · 안 넘어진 것)
  const stg = ['pre', 'spin', 'settle', 'follow', 'stiff', 'after'];
  out.push('', '| 차례 | 넘어짐 여부 | 수 | 기울기 최대 평균 | 발 밖 최대 평균 (m) | 골반 수평 빠르기 최대 평균 | 골반 돎 최대 평균 (rad/s) | 칼끼리 닿은 스텝 평균 |', '|---|---|---:|---:|---:|---:|---:|---:|');
  for (const g of stg) for (const fell of [true, false]) {
    const xs = all.filter((s) => !!s.fall === fell && s.st[g]);
    if (!xs.length) continue;
    out.push(`| ${g} | ${fell ? '넘어짐' : '안 넘어짐'} | ${xs.length} | ${mean(xs.map((s) => s.st[g].tilt)).toFixed(1)} | ${mean(xs.map((s) => s.st[g].ob)).toFixed(2)} | ${mean(xs.map((s) => s.st[g].pv)).toFixed(2)} | ${mean(xs.map((s) => s.st[g].pw)).toFixed(1)} | ${mean(xs.map((s) => s.steelStage[g] ?? 0)).toFixed(1)} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; });
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(summarize(runs));
  } else {
    applySets(arg('set', ''));
    const cells = arg('cells', 'iberian:zweihander:longsword').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = runOne({ school, weapon, opp, seed, dur: +arg('dur', 30), trace: rest.includes('--trace'), exp: new Set(arg('exp', '').split(',').filter(Boolean)) });
        runs.push(r);
        console.error(JSON.stringify({ c, seed, win: r.win, lose: r.lose, spins: r.probe.spins.length, fall: r.probe.spins.map((s) => s.fall && `${s.fall.why}@${s.fall.stage}+${s.fall.dt}`), ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), exp: arg('exp', ''), dur: +arg('dur', 30), cells, seeds, runs }));
    console.log(summarize(runs));
  }
}
