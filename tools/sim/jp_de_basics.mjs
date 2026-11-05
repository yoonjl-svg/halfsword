// ─────────────────────────────────────────────────────────────
//  jp_de_basics.mjs — 일본 · 독일 롱소드 기본 공격이 약한 까닭 재기 (사장님 11/05 '다음 조사 시작해' · 목적 = 유파 밸런스 · 기록 docs/strike/jp_de_basics_2026-11-05.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만). 싸움 = school_balance.mjs fightOne 그대로(사람 손가락 봇 · 실제 Input 터치 길 · 숙련 3 AI · 자연 바인드).
//   꽂개 둘을 단다 (둘 다 읽기만 — 난수 · 몸 · 칼 그대로 · 판 결과는 school_balance 와 바이트 같음):
//    ① rapier_defence.mjs makeProbe — 낸 것마다 결과(맞음 · 몸 닿음만 · 막힘 · 헛침) · AI 첫 반응 · 때 · 거리 · 첫 몸 닿음 꼴
//    ② 이 파일의 deepProbe — combat.analyze 를 감싸 내 칼 → 상대 몸 닿음을 **모두**(판정 문턱 6 J 밑 · 같은 부위 식힘 포함) 적는다:
//       날 맞춤(edgeAlign — 칼 움직임의 칼 축에 수직인 몫이 날 쪽으로 향한 cos · 0.6 넘어야 베기) · 베기 질(quality) · 빠르기 · 칼 유효 질량 · 판정 J · 실효 J · 문턱 · 심각도 · 부위 · 칼날 자리 ·
//       둔타가 된 까닭(납작 — 날이 안 섬 · 문턱 밑 — 베기 · 찌르기였지만 실효 J 가 문턱 밑 · 칼자루 · 6 J 밑 무시)
//       낸 때 기력(값 · 단계 · 공격 박자) · 판마다 거리 몫(시간) · AI 꼴 몫 · 독일 죽음의 일격 붙음(0.8 m 안 이어진 시간) · 일본 고노센 준비 · 창
//  node tools/sim/jp_de_basics.mjs fight --cells=japanese:uchigatana:longsword,... [--seeds=1-24] [--set=A.b=1,...] [--secret=0] [--drop=x] [--tag=이름] [--json=파일]
//  node tools/sim/jp_de_basics.mjs agg <json ...> [--by=name|cls|kind]   (Markdown 표)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { CONFIG, THREE, DT } from './harness_m.mjs';
import { fightOne, cellRow } from './school_balance.mjs';
import { makeProbe, respBefore, kindOf, applySets } from './rapier_defence.mjs';
import { isMain } from './is_main.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { setJapaneseGait, setJapanesePlayerWalk } from '../../src/schools.js';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const WIN = 1.0; // 낸 것 하나의 창 (실제 s — 다음 낸 것이 먼저 오면 거기까지 · rapier_defence 와 같음)
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const X = new THREE.Vector3(1, 0, 0);
const _e = new THREE.Vector3();
const _p = new THREE.Vector3();
const _p2 = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** 깊은 꽂개 — init · step · done (fightOne probe 꼴) */
export function deepProbe() {
  let G = null;
  let P = null;
  let A = null;
  let W = null;
  let M = null;
  const recs = new Map();
  let R = null;
  const live = () => R && G.t - R.t0 <= WIN * K + 1e-9 && !R.closed;
  // 판 몫 (게임 스텝마다)
  const F = { steps: 0, dist: { clinch: 0, inside: 0, mid: 0, edge: 0, far: 0 }, aiMode: {}, close: { runs: [], cur: 0, maxRun: 0 }, iai: { armedSteps: 0, arms: 0, was: false }, windows: 0, wasOpen: false, mord: { pressMax: 0 } };
  // AI 공격마다 (AI 가 베기 단계 strike 에 든 때 · AI 탭 찌르기 시작) — 1 실제 s 창: 내 막기 단추 · 그때 내 뜻 · 결과(내 몸 칼날 상처 · 둔타 · 칼끼리 닿음)
  const AT = [];
  let aRec = null;
  let prevPhase = null;
  let prevTap = null;
  // 내 넘어짐마다 — 그때 거리 · 내 뜻 · AI 꼴 · 밀치기(AI · 나) · 기력 · 0.5 s 안 받은 맞음
  const FALLS = [];
  let prevState = null;
  let lastHit = null;
  // 죽음의 일격 붙기 뜻(close)마다 — 0.8 m 안 이어진 가장 긴 시간 · 가장 가까움 · AI 꼴 · 창
  const CL = [];
  let cRec = null;
  let guardObj = null;
  return {
    init(o) {
      ({ G, P, A, W } = o);
      guardObj = o.guard ?? null;
      M = P.swordArt.measure;
      const ow = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, point, pr) => {
        ow?.(att, vic, r, point, pr);
        if (att !== A || vic !== P) return;
        lastHit = { t: G.t, sev: r.type === 'blunt' ? 0 : r.severity ?? 0, E: r.energy, ty: r.type, z: r.zone };
        if (aRec && G.t - aRec.t0 <= WIN * K + 1e-9) {
          aRec.n++;
          if (r.type !== 'blunt' && r.severity > 0) (aRec.sev += r.severity), aRec.cutN++;
          else aRec.bluntN++;
          aRec.bodyT ??= r3((G.t - aRec.t0) / K);
          if (aRec.w.length < 3) aRec.w.push([r.type, r.zone, r3(r.energy), r3(r.severity), r3(r.speed), r3(r.eff), r3(r.thr)]); // [종류 · 부위 · 판정 J · 심각도 · 빠르기 · 실효 · 문턱]
        }
      };
      const oc = G.combat.hooks.onClash;
      G.combat.hooks.onClash = (point, sp, info) => {
        oc?.(point, sp, info);
        const mine = (info.a === P && info.b === A) || (info.a === A && info.b === P);
        if (mine && aRec && G.t - aRec.t0 <= WIN * K + 1e-9) aRec.clashT ??= r3((G.t - aRec.t0) / K);
      };
      const an0 = G.combat.analyze.bind(G.combat);
      G.combat.analyze = (pr, point, S, Pp, predicting = false) => {
        const r = an0(pr, point, S, Pp, predicting);
        if (predicting || !live() || pr.w.fighter !== P || pr.v.fighter !== A) return r;
        R.anN++;
        if (!r) return r;
        // 날 맞춤 (combat.analyze 와 같은 식 — 결과에는 없어서 다시 셈): 칼 움직임의 칼 축 수직 몫이 날(x 축) 쪽으로 향한 cos
        const edge = _e.copy(X).applyQuaternion(S.q);
        const perp = _p.copy(r.dir).addScaledVector(r.bladeAxis, -r.dir.dot(r.bladeAxis));
        const pl = perp.length();
        const eA = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
        const along = r.dir.dot(r.bladeAxis);
        const HL = P.weaponCfg.hiltLength;
        const local = _p2.set(point.x - S.p.x, point.y - S.p.y, point.z - S.p.z).applyQuaternion(_q.copy(S.q).invert());
        const onBlade = pr.w.part === 'blade' && local.y > HL - 0.01;
        const why = r.type !== 'blunt' ? r.type : !onBlade ? 'hilt' : r.thr != null ? 'under' : along > CONFIG.STRIKE.stabAlign ? 'tipNot' : 'flat';
        const key = pr.v.part;
        const c = { ty: r.type, why, eA: r3(eA), al: r3(along), sp: r3(r.speed), mF: r3(r.mFree), mE: r3(r.mEff), E: r3(r.energy), eff: r3(r.eff), thr: r3(r.thr), sev: r3(r.severity), z: r.zone, t: r3(r.t), part: key, minE: r.energy < CONFIG.STRIKE.minEnergy, cd: A.hitCooldowns.has(`${P.index}:${key}`), at: r3((G.t - R.t0) / K) };
        // 같은 부위를 지나가는 칼(가르는 중)은 스텝마다 analyze 가 불린다 — 부위마다 처음 · 가장 센 것만
        const prev = R.parts[key];
        if (!prev) R.parts[key] = { first: c, best: c, n: 1 };
        else {
          prev.n++;
          if ((c.E ?? 0) > (prev.best.E ?? 0)) prev.best = c;
        }
        return r;
      };
    },
    step(cur, act) {
      if (!G) return;
      F.steps++;
      const d = P.foeDistance();
      const b = d < 0.8 ? 'clinch' : d < M.contact ? 'inside' : d < M.reach ? 'mid' : d < M.reach + 0.55 ? 'edge' : 'far';
      F.dist[b]++;
      const am = G.ai.mode ?? '-';
      F.aiMode[am] = (F.aiMode[am] ?? 0) + 1;
      // 독일 죽음의 일격 붙음 (secret.js pressTick 'close' 와 같은 판단 — 가슴 사이 ≤ mordCloseN · 둘 다 서 있음)
      const n = CONFIG.SECRET.mordCloseN ?? 0.8;
      const close = P.state === 'stand' && A.alive && A.state === 'stand' && d <= n;
      if (close) F.close.cur++;
      else if (F.close.cur > 0) {
        F.close.runs.push(F.close.cur);
        F.close.cur = 0;
      }
      if (W?.pressMax > F.mord.pressMax) F.mord.pressMax = W.pressMax;
      // 일본 고노센 준비 · 창
      const ar = !!W?.iaiArm?.armed;
      if (ar) F.iai.armedSteps++;
      if (ar && !F.iai.was) F.iai.arms++;
      F.iai.was = ar;
      const op = !!W?.open;
      if (op && !F.wasOpen) F.windows++;
      F.wasOpen = op;
      // AI 공격 시작
      const ph = G.ai.phase;
      const tap = A.skill.tap ?? null;
      if ((ph === 'strike' && prevPhase !== 'strike') || (tap && tap !== prevTap)) {
        aRec = { t0: G.t, d: r3(d), guard: !!guardObj?.held, pAct: act?.kind ?? null, pSwing: !!P.skill.swinging, tap: !!tap, n: 0, sev: 0, cutN: 0, bluntN: 0, clashT: null, bodyT: null, pState: P.state, w: [], tech: G.ai.tech?.name ?? null };
        AT.push(aRec);
      }
      prevPhase = ph;
      prevTap = tap;
      // 내 넘어짐
      if (prevState === 'stand' && P.state !== 'stand' && P.state !== 'dead') {
        FALLS.push({ t: r3(G.t / K), to: P.state, d: r3(d), pAct: act?.kind ?? null, want: act?.want ?? null, aiMode: G.ai.mode, aiPhase: ph, aiBarge: !!A.barge, pBarge: !!P.barge, st: r3(P.stamina.value), hit: lastHit && G.t - lastHit.t <= 0.5 * K ? { ...lastHit, t: undefined, ago: r3((G.t - lastHit.t) / K) } : null, sw: !!P.skill.swinging, jolt: r3(P.jolt), aSw: !!A.skill.swinging });
      }
      prevState = P.state;
      // 붙기 뜻
      if (act?.kind === 'close' && cRec?.act !== act) {
        cRec = { act, t0: G.t, minD: d, run: 0, maxRun: 0, modes: {}, aiBarge: 0, pBarge: 0, opened: false, steps: 0, fell: false };
        CL.push(cRec);
      }
      if (cRec && cRec.act === act) {
        cRec.steps++;
        cRec.minD = Math.min(cRec.minD, d);
        cRec.run = close ? cRec.run + 1 : 0;
        cRec.maxRun = Math.max(cRec.maxRun, cRec.run);
        cRec.modes[G.ai.mode] = (cRec.modes[G.ai.mode] ?? 0) + 1;
        if (A.barge) cRec.aiBarge++;
        if (P.barge) cRec.pBarge++;
        if (W?.open) cRec.opened = true;
        if (P.state !== 'stand') cRec.fell = true;
      }
      if (cur && !recs.has(cur)) {
        if (R) R.closed = true;
        R = { t0: G.t, anN: 0, parts: {}, closed: false, st0: P.stamina.value, lvl: P.stamina.level, aspd: P.stamina.attackSpeed, kind: act?.kind ?? null, aiState: A.state, pState: P.state, aiSw: !!A.skill.swinging || !!A.skill.tap };
        recs.set(cur, R);
      }
    },
    done(fires) {
      if (F.close.cur > 0) F.close.runs.push(F.close.cur);
      const per = (x) => r3(x / Math.max(1, F.steps));
      const runsS = F.close.runs.map((s) => (s * DT) / K);
      return {
        fires: fires.map((f) => {
          const Q = recs.get(f);
          if (!Q) return null;
          const parts = Object.values(Q.parts);
          const best = parts.map((p) => p.best).sort((a, b) => (b.E ?? 0) - (a.E ?? 0))[0] ?? null;
          const first = parts.map((p) => p.first).sort((a, b) => a.at - b.at)[0] ?? null;
          return { st0: r3(Q.st0), lvl: Q.lvl, aspd: r3(Q.aspd), kind: Q.kind, aiSw: Q.aiSw, pState: Q.pState, nParts: parts.length, best, first, parts: parts.slice(0, 6).map((p) => ({ ...p.best, n: p.n })) };
        }),
        fight: {
          dist: Object.fromEntries(Object.entries(F.dist).map(([k, v]) => [k, per(v)])),
          aiMode: Object.fromEntries(Object.entries(F.aiMode).map(([k, v]) => [k, per(v)])),
          close: { n: runsS.length, max: r3(Math.max(0, ...runsS)), over1: runsS.filter((s) => s >= 1).length, over1_5: runsS.filter((s) => s >= 1.5).length, over2: runsS.filter((s) => s >= 2).length, tot: r3(runsS.reduce((s, x) => s + x, 0)) },
          mordPressMax: r3((F.mord.pressMax ?? 0) / K),
          iai: { armedFrac: per(F.iai.armedSteps), arms: F.iai.arms },
          windows: F.windows,
          aiAtk: AT.map((a) => ({ ...a, t0: r3(a.t0 / K), sev: r3(a.sev) })),
          falls: FALLS,
          closeActs: CL.map((c) => ({ t0: r3(c.t0 / K), minD: r3(c.minD), maxRun: r3((c.maxRun * DT) / K), dur: r3((c.steps * DT) / K), modes: Object.fromEntries(Object.entries(c.modes).map(([k, v]) => [k, r3(v / Math.max(1, c.steps))])), aiBarge: r3(c.aiBarge / Math.max(1, c.steps)), pBarge: r3(c.pBarge / Math.max(1, c.steps)), opened: c.opened, fell: c.fell })),
          reach: r3(M.reach), contact: r3(M.contact), swings: P.skill.swings ?? null, cutSteps: P.skill.cutSteps ?? 0,
        },
      };
    },
  };
}

/** 두 꽂개를 함께 (차례: rapier_defence 먼저 — 감싸기 차례는 결과에 상관없음) */
function bothProbe() {
  const a = makeProbe();
  const b = deepProbe();
  return {
    init(o) { a.init(o); b.init(o); },
    step(cur, act) { a.step(cur, act); b.step(cur, act); },
    done(fires) { const pa = a.done(fires); const pb = b.done(fires); return { base: pa, deep: pb.fires, fight: pb.fight }; },
  };
}

// ── 묶음 · 표 ──
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const q = (a, p) => {
  const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const mean = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const f2 = (x, k = 2) => (x == null ? '–' : x.toFixed(k));

/** 판 묶음 → 낸 것 하나하나 (fires + base + deep 합침) */
export function flatFires(runs) {
  const out = [];
  for (const r of runs) {
    const pb = r.probe?.base ?? [];
    const pd = r.probe?.deep ?? [];
    r.fires.forEach((f, i) => {
      if (!pb[i] || !pd[i]) return;
      out.push({ ...f, ...pb[i], deep: pd[i], cell: `${r.school}:${r.weapon}:${r.opp}` });
    });
  }
  return out;
}
const OUTS = ['hit', 'hitAfterClash', 'touch', 'blocked', 'whiff'];
const WHY = ['cut', 'stab', 'flat', 'under', 'tipNot', 'hilt'];
export function deepRows(runs, by = 'name') {
  const all = flatFires(runs);
  const key = by === 'kind' ? kindOf : by === 'cls' ? (p) => p.cls : (p) => p.name;
  const g = {};
  for (const p of all) (g[key(p)] ??= []).push(p);
  return Object.entries(g).map(([k, ps]) => {
    const n = ps.length;
    const outs = Object.fromEntries(OUTS.map((o) => [o, ps.filter((p) => p.out === o).length]));
    const withC = ps.filter((p) => p.deep.best);
    const counted = withC.filter((p) => !p.deep.best.minE); // 판정 문턱(6 J) 넘은 닿음이 있었던 것
    const why = Object.fromEntries(WHY.map((w) => [w, counted.filter((p) => p.deep.best.why === w).length]));
    const bestE = withC.map((p) => p.deep.best.E);
    const rb = {};
    for (const p of ps) rb[respBefore(p)] = (rb[respBefore(p)] ?? 0) + 1;
    const hitBy = {};
    for (const p of ps) { const b = respBefore(p); (hitBy[b] ??= [0, 0])[1]++; if (p.out === 'hit' || p.out === 'hitAfterClash') hitBy[b][0]++; }
    const cuts = counted.filter((p) => p.deep.best.why === 'cut');
    return {
      key: k, n, outs, withC: withC.length, minEonly: withC.length - counted.length, counted: counted.length, why,
      E50: q(bestE, 0.5), E75: q(bestE, 0.75), E90: q(bestE, 0.9), Emean: mean(bestE),
      sp50: q(withC.map((p) => p.deep.best.sp), 0.5), mF50: q(withC.map((p) => p.deep.best.mF), 0.5),
      eA50: q(withC.filter((p) => p.deep.best.why !== 'stab').map((p) => p.deep.best.eA), 0.5), eAok: withC.filter((p) => p.deep.best.eA > CONFIG.STRIKE.edgeAlign).length,
      cutEff50: q(cuts.map((p) => p.deep.best.eff), 0.5), cutThr50: q(cuts.map((p) => p.deep.best.thr), 0.5), cutSevPos: cuts.filter((p) => p.deep.best.sev > 0).length,
      underN: why.under, underEff: q(counted.filter((p) => p.deep.best.why === 'under').map((p) => p.deep.best.eff), 0.5), underThr: q(counted.filter((p) => p.deep.best.why === 'under').map((p) => p.deep.best.thr), 0.5),
      zones: withC.reduce((o, p) => ((o[p.deep.best.z] = (o[p.deep.best.z] ?? 0) + 1), o), {}),
      t50: q(withC.map((p) => p.deep.best.t), 0.5),
      st0: q(ps.map((p) => p.deep.st0), 0.5), tired: ps.filter((p) => p.deep.lvl > 0).length, aspd: mean(ps.map((p) => p.deep.aspd)),
      d0: q(ps.map((p) => p.d0), 0.5), d0hit: q(ps.filter((p) => p.out === 'hit' || p.out === 'hitAfterClash').map((p) => p.d0), 0.5), dClose: q(ps.map((p) => (p.d0 != null && p.dMin != null ? p.d0 - p.dMin : null)), 0.5),
      tContact: q(ps.map((p) => Math.min(p.body ?? Infinity, p.clash ?? Infinity)).filter(Number.isFinite), 0.5), tipMax: q(ps.map((p) => p.tipMax), 0.5),
      rb, hitBy, sev: mean(ps.filter((p) => p.w > 0).map((p) => p.sev)), aiSw: ps.filter((p) => p.deep.aiSw).length,
      clashTP: q(ps.map((p) => p.clashTP), 0.5), gapMin: q(ps.map((p) => p.gapMin), 0.5),
    };
  }).sort((a, b) => b.n - a.n);
}
const RESP = ['none', 'defending', 'noRead', 'striking', 'noGuard', 'void', 'parry', 'counter', 'passiveAtk', 'other'];
export function deepMarkdown(runs, by = 'name') {
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = [];
  out.push('| 칸 | 판 | 이김 | 짐 | 비김 | 준 심각도/판 | 받은 심각도/판 | 준 의식/판 | 내 넘어짐/판 | 판 길이 s | 거리 몫 (붙음 · 안 · 가운데 · 끝 · 멂) | AI 꼴 몫 | 0.8 m 안 이어짐 (가장 긺 가운데 · 1 s 넘음/판 · 2 s 넘음/판) | 고노센 준비 몫 · 준비 수/판 | 창/판 | 비기/판 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---:|---:|');
  for (const [k, rs] of Object.entries(cells)) {
    const c = cellRow(rs);
    const fs = rs.map((r) => r.probe?.fight).filter(Boolean);
    const dm = ['clinch', 'inside', 'mid', 'edge', 'far'].map((b) => pct(mean(fs.map((f) => f.dist[b])) * 100, 100)).join(' · ');
    const modes = {};
    for (const f of fs) for (const [m, v] of Object.entries(f.aiMode)) modes[m] = (modes[m] ?? 0) + v / fs.length;
    const am = Object.entries(modes).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, v]) => `${m} ${pct(v * 100, 100)}`).join(' · ');
    out.push(`| ${k} | ${c.n} | ${c.win} | ${c.lose} | ${c.n - c.win - c.lose} | ${f2(c.dealt)} | ${f2(c.recv)} | ${f2(c.consD)} | ${f2(c.fallsP)} | ${f2(c.T, 1)} | ${dm} | ${am} | ${f2(q(fs.map((f) => f.close.max), 0.5))} · ${f2(mean(fs.map((f) => f.close.over1)))} · ${f2(mean(fs.map((f) => f.close.over2)))} | ${pct(mean(fs.map((f) => f.iai.armedFrac)) * 100, 100)} · ${f2(mean(fs.map((f) => f.iai.arms)))} | ${f2(mean(fs.map((f) => f.windows)))} | ${f2(c.secret)} |`);
  }
  for (const [k, rs] of Object.entries(cells)) {
    const rows = deepRows(rs, by);
    out.push('', `### ${k} — 결과 · 거리 · 기력`, '', '| 기술 | 낸 수 | 맞음 | 칼 닿은 뒤 맞음 | 몸 닿음만 | 막힘 | 헛침 | 맞음당 심각도 | 낸 거리 (맞은 것) | 몸 사이 줄어듦 | 첫 닿음 s | 칼끝 가장 빠름 | 낸 때 기력 (지침 몫 · 공격 박자) | 낸 때 AI 치는 중 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const t of rows) out.push(`| ${t.key} | ${t.n} | ${pct(t.outs.hit, t.n)} | ${pct(t.outs.hitAfterClash, t.n)} | ${pct(t.outs.touch, t.n)} | ${pct(t.outs.blocked, t.n)} | ${pct(t.outs.whiff, t.n)} | ${f2(t.sev)} | ${f2(t.d0)} (${f2(t.d0hit)}) | ${f2(t.dClose)} | ${f2(t.tContact)} | ${f2(t.tipMax, 1)} | ${f2(t.st0, 0)} (${pct(t.tired, t.n)} · ${f2(t.aspd)}) | ${pct(t.aiSw, t.n)} |`);
    out.push('', `### ${k} — 몸 닿음 꼴 (낸 것마다 가장 센 닿음 · 판정 문턱 밑 포함)`, '', '| 기술 | 몸에 닿음 (6 J 밑만) | 베기 · 찌르기 · 납작 · 문턱 밑 · 칼끝 아님 · 칼자루 (6 J 넘은 것) | 판정 J (50 · 75 · 90 %) | 빠르기 m/s | 칼 유효 질량 kg | 날 맞춤 가운데 (0.6 넘음) | 칼날 자리 | 베기 실효 J · 문턱 (심각도 > 0) | 문턱 밑: 실효 · 문턱 | 부위 |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|');
    for (const t of rows) out.push(`| ${t.key} | ${t.withC} (${t.minEonly}) | ${WHY.map((w) => t.why[w]).join(' · ')} | ${f2(t.E50, 0)} · ${f2(t.E75, 0)} · ${f2(t.E90, 0)} | ${f2(t.sp50, 1)} | ${f2(t.mF50)} | ${f2(t.eA50)} (${pct(t.eAok, t.withC)}) | ${f2(t.t50)} | ${f2(t.cutEff50, 0)} · ${f2(t.cutThr50, 0)} (${t.cutSevPos}/${t.why.cut}) | ${f2(t.underEff, 0)} · ${f2(t.underThr, 0)} | ${Object.entries(t.zones).sort((a, b) => b[1] - a[1]).map(([z, c]) => `${z} ${c}`).join(' · ')} |`);
    out.push('', `### ${k} — 닿기 전 AI 첫 반응 (몫 · 그 반응일 때 맞음)`, '', `| 기술 | ${RESP.join(' | ')} |`, `|---|${RESP.map(() => '---:').join('|')}|`);
    for (const t of rows) out.push(`| ${t.key} | ${RESP.map((b) => (t.rb[b] ? `${pct(t.rb[b], t.n)} (${pct(t.hitBy[b][0], t.hitBy[b][1])})` : '–')).join(' | ')} |`);
  }
  return out.join('\n');
}

const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(deepMarkdown(runs, arg('by', 'name')));
  } else {
    applySets(arg('set', ''));
    // --wset=uchigatana.mCut=1.4 — 무기 값(weapons.js 명세)을 이 프로세스 안에서만 (몸을 만들 때 weaponCfg 로 옮겨 담음 — 판 시작 전에 바꿈)
    for (const kv of arg('wset', '').split(',').filter(Boolean)) {
      const [path, v] = kv.split('=');
      const [w, k] = path.split('.');
      WEAPONS[w][k] = +v;
    }
    // --jpGait=old (10/29 전 판 일본 걸음) · --jpWalk=1 (일본 걸음 빠르기 배율 — 판 값 0.70) — 견줌만 (main.js ?jpGait · ?jpWalk 와 같은 함수)
    if (arg('jpGait', null)) setJapaneseGait(arg('jpGait'));
    if (arg('jpWalk', null)) setJapaneseGait(arg('jpWalk'));
    if (arg('jpPlayerWalk', null)) setJapanesePlayerWalk(arg('jpPlayerWalk')); // 사람 몸만 (AI 일본 그대로)
    const cells = arg('cells', 'japanese:uchigatana:longsword,german:longsword:longsword').split(',');
    const seeds = range(arg('seeds', '1-24'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = fightOne({ school, weapon, opp, seed, dur: +arg('dur', 30), tech: +arg('tech', 0.35), secret: arg('secret', '1') !== '0', drop: arg('drop', '').split(',').filter(Boolean), probe: bothProbe(), attrib: arg('attrib', 'new') });
        runs.push(r);
        console.error(JSON.stringify({ c, seed, win: r.win, lose: r.lose, T: r.T, dealt: r.dealt, recv: r.recv, fires: r.fires.length, ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set: arg('set', ''), wset: arg('wset', ''), jpGait: arg('jpGait', ''), jpWalk: arg('jpWalk', ''), jpPlayerWalk: arg('jpPlayerWalk', ''), cells, seeds, runs }));
    console.log(deepMarkdown(runs, arg('by', 'name')));
  }
}
