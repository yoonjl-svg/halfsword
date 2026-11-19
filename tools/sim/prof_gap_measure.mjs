// ─────────────────────────────────────────────────────────────
//  prof_gap_measure.mjs — 숙련도 차이만 있는 같은 유파 거울 맞대결 (숙련도 격차 재기 · 목표 — 2:4 · 4:6 = 65 ~ 85 %, 2:6 = 85 ~ 95 %, 한 칸 차이 = 55 ~ 75 % (사장님 11/16 '목표 승률 모두 ok'))
//  유파 다섯(독일 · 이탈리아 · 이베리아 · 일본 · 동방) × 짝 여덟(1:2 · 2:3 · 3:4 · 4:5 · 5:6 · 2:4 · 4:6 · 2:6) = 칸 40.
//  칸마다 판 12 = 유파 대표 무기 둘 × 씨앗 1 ~ 3 × 자리 둘 (높은 쪽이 플레이어 자리 또는 상대 자리). 두 쪽 모두 같은 무기 · 같은 AI 클래스 · 숙련도만 다르다.
//  몸 값(힘 · 버티는 힘)은 게임과 같이 AI 가 숙련도별 몸 값 표 config PROF_BODY 에서 넣음(ai.js setLevel — 11/17 E · 전 숙련도 6 만 PROF6_VITALITY 를 이 도구가 넣음).
//  사장님 결정: '60초에도 승부 안 나면 비김으로 기록해. 2:6도 넣고 4갈래 동시 실행해.' · 목표 '65~85, 85~95 이렇게 해.'
//  기록 — 결과 hi(높은 쪽 이김) · lo(낮은 쪽 이김) · draw(60 s 까지 둘 다 서 있음 · 동시에 쓰러짐도 비김). 타이브레이크 없음.
//  판마다: 칸 · 짝 · 무기 · 씨앗 · 자리 · 결과 · 끝 시각 · 서로 준 상처 수 · 끝 피 · 비밀 기술 낸 수 · 쓰러진 까닭.
//  node tools/sim/prof_gap_measure.mjs [--schools=german,italian,…] [--pairs=1:2,2:4,…] [--seeds=1-3] [--dur=60] [--shard=i/n] [--json=path]
//  node tools/sim/prof_gap_measure.mjs agg a.json b.json …   ·  4 갈래 동시 실행: --shard=1/4 … --shard=4/4 (네 개 모두 옵션을 같게 — 옵션으로 만든 전체 목록 번호를 n 으로 나눔)
//   --look=enemy : 두 자리 모두 같은 겉모습 LOOKS.enemy (11/17 — 감독 '겉모습 같게'. 안 주면 옛 판 그대로 — 자리마다 기본 겉모습)
//   --cfg=PATH:수,… : config 수 덮어쓰기 (재기 전용 · 게임 값은 그대로 — cfg_override.mjs · 예: --cfg=AI_LEVELS.normal.strikeSpeed:12)
//   --vit=v0,v1,…,v6 · --str=s0,…,s6 : 몸 값 표 PROF_BODY.vitality · strength 를 통째로 (재기 전용 · 숙련도 0 ~ 6 일곱 수 — 11/17 E 찾기)
//   --resume : --json 파일이 있으면 그 판들(판 번호 k)은 건너뛰고 이어 잼 (판 10 개마다 파일을 씀 — 11/18)
//  ── 단계 덜어 보기 (11/18 — 기록 docs/strike/stage_ablation_2026-11-18.md · 모두 재기 전용 · 안 주면 판 그대로 · 낮은 쪽은 늘 그대로):
//   --dropHi=G3,G5 : 높은 쪽 AI 의 칸 몫에서 이 칸들을 뺌 (그 AI 를 만드는 동안만 config AI_KIT.ladder 에서 빼고 곧 되돌림 — 실력 이름 · 띠 · 몸은 그대로)
//   --levelHi=normal : 높은 쪽 실력 이름 (easy · normal · hard · expert — 판 동안만 AI_PLAN.levels[높은 숙련도] 를 바꿈 · 낮은 쪽 숙련도 칸은 그대로)
//   --bandHi=2 : 높은 쪽 플랜 띠 0 ~ 3 (판 동안만 AI_PLAN.bands[높은 숙련도] 를 바꿈 — 띠는 늘 제 숙련도로 읽으므로 낮은 쪽은 그대로)
//   --techHi=schielhau:1.4,… : 높은 쪽 AI 꾸러미에서 그 기술의 고르는 무게 base 를 이 값으로 ('…:1.4:nofit' = 상황 선호 fit 칸도 뺌) — 고침 안의 효과를 미리 재는 용 (꾸러미는 새 객체 · 게임 값 그대로)
//   --keepBaseHi=schielhau : 높은 쪽 AI 꾸러미에서 그 강화동작이 가져간 바탕 기술(sword_art.js 의 plain — 곁눈 베기면 분노의 베기)을 따로 되살림 — 강화동작 무게는 제 몫(더한 바탕 무게를 뺌) · 바탕 이름은 바탕 기술로 · 기술 취향은 강화동작 것을 복사 (재기 전용 — '바탕을 남기고 강화동작은 제자리에서만' 안을 미리 재는 용)
//   --noThrustFollowHi=schielhau : 높은 쪽 AI 가 그 기술 뒤 이어 치기(why 'follow')를 찌르기로 열지 않음 (startAttack 을 거절 → 옛 길대로 물러남) — 고침 안의 효과를 미리 재는 용
//   --levelHiSet=read:0.35,… : 높은 쪽 AI 의 실력 숫자(ai.level — setLevel 이 이름 표에서 복사한 것) 몇 칸만 덮음 (만든 뒤 · 몸 값은 그대로) — 실력 이름 가운데 어느 숫자인가를 가르는 용
//   --passiveHi=seguirRoda:0.45,… : 높은 쪽 AI 의 유파 패시브(반응 버릇 — schools.js *_PASSIVES) 굴림 몫 p 를 이 값으로 (만든 뒤 그 AI 의 패시브 목록만 새 객체로 · 0 = 그 패시브 안 냄)
//   --gwHi=0.64 : 높은 쪽 몸의 '검술 자세 지도를 따르는 몫'(fighter.guardWeight — 옛 보정은 skill.level × 1.6 · 1 에서 자름)만 이 값으로 (skill.level 의 이어 베기 몫은 그대로) — 실력 숫자 skill 가르기 용
//   --cfgHi=PATH:수,… : config 수를 높은 쪽 AI 의 매 스텝 판단(ai.update) 동안만 바꿈 (--cfg 와 같은 꼴 · 낮은 쪽 · 몸 · 판정은 그대로 — 플랜 값 한 칸이 높은 쪽에 주는 몫을 재는 용)
//   --stats : 판 기록에 두 쪽 AI 의 stats 요약(hiStats · loStats — 배열은 줄임) · 기력 장부(hiStam · loStam — 갈래마다 쓴 기력 spent · 횟수 counts) · 무릎 꺾기 굴림(buckle — 곁눈 베기 G6 · combat.buckleLog 수) + 흔적(hiTrace · loTrace — 공격마다 기술 이름 · 까닭 · 거리 ·
//             그 칼 동안 준 상처 · 받은 상처 · 끝난 뒤 0.8 s 안에 받은 상처 · 칼 부딪힘 · 그때 상대 꼴 · 그때 상대 칼(vs) · 이어 친 앞 칼(from) / 꼴마다 머문 시간 · 꼴마다 받은 상처). 읽기만 (난수 · 몸에 손대지 않음)
//            11/19 흔적에 bw — 뒤 박차기 헛침 경직(burst_whiff.js): 내가 굳음 · 도구 눈으로 다시 가른 헛 굳음(박찬 걸음 · 칼끝 거리 · 상처 · 칼 부딪힘) · 상대 굳음 창과 그 창에 벰 · 독일 뒤 칼과 굳음 (읽기만)
//   --gns : 판 기록에 높은 쪽 고노센 깔때기 흔적 gns (11/19 · 읽기만 — tools/sim/gns_funnel.mjs gnsProbe · 요약은 node tools/sim/gns_funnel.mjs a.json)
//   node tools/sim/prof_gap_measure.mjs trace a.json … [--lo] [--vs] [--top=14] : --stats 로 잰 판 기록의 요약 (11/18 · 읽기만) — hi 몫 · 꼴 몫 · 꼴마다 준 · 받은 상처 ·
//             기술마다 판당 수 · 맞힘 · 맞음 · 끝난 뒤 0.8 s 안 맞음 · 칼 부딪힘 몫 · 거리 · 칼 시간 · 그때 상대 꼴 · 까닭 (--lo = 낮은 쪽 흔적 · --vs = 칼을 열 때 상대 칼 · 이어 친 칼의 앞 칼)
//  출력 — 합산 hi 몫 = (승 + 무 ½) / 판 수 · 95 % 윌슨 구간 · 승 / 무 / 패 · 평균 끝 시각 · 유파별 hi 몫 (무 수)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { newRound, AI, DT } from './harness_m.mjs';
import { wilson } from './ref_duel.mjs';
import { isMain } from './is_main.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { AI_PROFICIENCY, PROF_BODY, AI_KIT, AI_PLAN, AI_LEVELS } from '../../src/config.js';
import { LOOKS } from '../../src/looks.js';
import { applyCfgArgs } from './cfg_override.mjs';
import * as CFG from '../../src/config.js';
import { gnsProbe } from './gns_funnel.mjs';

/** --cfgHi 풀이: 'A.b.c:1,…' → [[객체, 열쇠, 새 값]] (cfg_override.mjs applyCfg 와 같은 규칙 — 없는 칸 · 수 아닌 값은 멈춤) */
function resolveCfg(spec) {
  return (spec ?? '').split(',').filter(Boolean).map((kv) => {
    const i = kv.lastIndexOf(':');
    const keys = kv.slice(0, i).split('.');
    const v = +kv.slice(i + 1);
    let o = CFG;
    for (const k of keys.slice(0, -1)) { o = o?.[k]; if (o == null || typeof o !== 'object') throw new Error(`unknown cfg: ${kv}`); }
    const last = keys[keys.length - 1];
    if (!(i > 0) || !Number.isFinite(v) || !(last in o) || typeof o[last] !== 'number') throw new Error(`--cfgHi 칸 · 값: ${kv}`);
    return [o, last, v];
  });
}

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };

export const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };
export const PAIR_ORDER = ['1:2', '2:3', '3:4', '4:5', '5:6', '2:4', '4:6', '2:6'];

/** 짝의 목표 구간 (%) — 한 칸 차이 55 ~ 75 (사장님 11/16 '목표 승률 모두 ok') · 2:4 · 4:6 65 ~ 85 · 2:6 85 ~ 95 */
export function targetOf(key) {
  const [lo, hi] = key.split(':').map(Number);
  if (hi - lo === 1) return { t: [55, 75], label: '55 ~ 75 %' };
  if (key === '2:4' || key === '4:6') return { t: [65, 85], label: '65 ~ 85 %' };
  if (key === '2:6') return { t: [85, 95], label: '85 ~ 95 %' };
  return null;
}

const outOf = (f) => !f.alive || f.state === 'dead';
const secretsFired = (ai) => Object.values(ai?.stats?.secrets ?? {}).reduce((s, x) => s + (x.fired || 0), 0);

/** 전체 판 목록 (순서 고정 — 샤딩 번호는 이 목록의 순서) */
export function planFights({ schools, pairs, seeds }) {
  const list = [];
  for (const school of schools) for (const key of pairs) {
    const [lo, hi] = key.split(':').map(Number);
    WEAPONS[school].forEach((weapon, wi) => {
      for (const seed of seeds) for (const swap of [false, true]) list.push({ school, lo, hi, weapon, wi, seed, swap });
    });
  }
  return list;
}

/** 한 판: swap=false 면 높은 쪽이 플레이어 자리, true 면 상대 자리. 같은 무기 · 씨앗은 무기 · 씨앗 · 자리마다 다른 값 */
export function measureFight(f, dur, opt = {}) {
  // 단계 덜어 보기 (11/18 · 재기 전용): 높은 쪽 실력 이름 · 띠는 그 숙련도 칸을 판 동안만 바꾸고 끝에 되돌림 (낮은 쪽은 다른 칸을 읽어 그대로)
  const { hi } = f;
  const saved = { level: AI_PLAN.levels[hi], band: AI_PLAN.bands[hi] };
  if (opt.levelHi != null) AI_PLAN.levels[hi] = opt.levelHi;
  if (opt.bandHi != null) AI_PLAN.bands[hi] = opt.bandHi;
  try {
    return measureFight0(f, dur, opt);
  } finally {
    AI_PLAN.levels[hi] = saved.level;
    AI_PLAN.bands[hi] = saved.band;
  }
}

/** 높은 쪽 AI 클래스 (재기 전용): --dropHi = 만드는 동안만 그 유파 사다리에서 칸을 빼고 되돌림(무기가 바뀌어 칸 몫을 다시 셀 때 kitRefresh 도 같게) ·
 *  --techHi = 만든 뒤 꾸러미의 그 기술 base(· fit) 를 바꾼 새 꾸러미로 · --noThrustFollowHi = 그 기술 뒤 찌르기 이어 치기를 거절 */
function hiClass(school, { dropHi: drop, techHi, noThrustFollowHi: noTF, keepBaseHi: keepB } = {}) {
  if (!drop?.size && !techHi?.size && !noTF?.size && !keepB?.size) return AI;
  const cut = () => {
    const L = AI_KIT.ladder[school];
    if (!drop?.size) return () => {};
    AI_KIT.ladder[school] = L.map((st) => st.filter((id) => !drop.has(id)));
    return () => { AI_KIT.ladder[school] = L; };
  };
  return class HiAI extends AI {
    constructor(...a) {
      const back = cut();
      try { super(...a); } finally { back(); }
      if (keepB?.size) {
        const S = this.school;
        const tech = [];
        const by = { ...S.techByName };
        for (const t of S.tech) {
          if (keepB.has(t.name) && t.plain) {
            const E = { ...t, base: Math.max(0.01, t.base - t.plain.base) };
            delete E.plain;
            tech.push(E, t.plain);
            by[t.name] = E;
            by[t.plain.name] = t.plain;
            this.pers.techPref[t.plain.name] ??= this.pers.techPref[t.name];
          } else tech.push(t);
        }
        this.school = { ...S, tech, techByName: by };
      }
      if (techHi?.size) {
        const S = this.school;
        const rep = new Map();
        const tech = S.tech.map((t) => {
          const o = techHi.get(t.name);
          if (!o) return t;
          const t2 = { ...t, base: o.base };
          if (o.nofit) delete t2.fit;
          rep.set(t, t2);
          return t2;
        });
        this.school = { ...S, tech, techByName: Object.fromEntries(Object.entries(S.techByName).map(([k, v]) => [k, rep.get(v) ?? v])) };
      }
    }
    startAttack(tech, why, o = {}) {
      if (noTF?.size && why === 'follow' && tech?.kind === 'thrust' && noTF.has(this.tech?.name)) return false;
      return super.startAttack(tech, why, o);
    }
    kitRefresh() {
      const back = cut();
      try { return super.kitRefresh(); } finally { back(); }
    }
  };
}

/** stats 요약 (--stats): 배열은 줄임 — 특수 공격 끝 specRuns 는 이름마다 수 · 평균 동작 / 풀림 초 · 다른 배열은 길이 */
function compactStats(st) {
  const walk = (v, k) => {
    if (Array.isArray(v)) {
      if (k === 'specRuns') {
        const o = {};
        for (const r of v) { const x = (o[r.name] ??= { n: 0, motion: 0, free: 0 }); x.n++; x.motion += r.motion; x.free += r.free; }
        for (const x of Object.values(o)) { x.motion = +(x.motion / x.n).toFixed(3); x.free = +(x.free / x.n).toFixed(3); }
        return o;
      }
      return { len: v.length };
    }
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== 'function').map(([kk, x]) => [kk, walk(x, kk)]));
    if (typeof v === 'number' && !Number.isInteger(v)) return Number.isFinite(v) ? +v.toFixed(3) : null;
    return v;
  };
  return walk(st, '');
}

/**
 * 공격 흔적 (--stats · 읽기만): ai.startAttack 을 감싸 공격마다 기록을 열고, 매 스텝 끝(poll)에 꼴 · 공격 끝을 봄.
 *  열쇠 = 비기 중 'secret:<길>' · 패시브가 낸 칼 'passive:<이름>' · 속임 'feint:<이름>' · 아니면 기술 이름 (첫 poll 에서 정함 — 패시브 이름은 startAttack 뒤에 적히므로)
 *  비기 꼴('secret')로 들어가면 startAttack 없이도 'secretMode' 기록을 엶. 상처: 내가 낸 것 = 열린 기록(또는 닫힌 지 0.3 s 안) · 받은 것 = 열린 기록 took · 닫힌 지 0.8 s 안 after · 그 밖 꼴마다
 */
function traceAI(G, ai, me, other) {
  const T = { modeT: {}, atk: {}, dealtBy: {}, tookBy: {}, n: 0, dWatch: 0, nWatch: 0 };
  let cur = null, last = null, prevMode = ai.mode;
  // vs = 이 칼을 열 때 상대 칼 — 'during:<상대 기술>'(상대 칼이 아직 나가는 중) · 'after:<상대 기술>'(끝난 지 1.0 s 안) · '-' (흔적 짝 T.peer 가 있을 때 · 첫 poll 에서 정함)
  const vsNow = () => { const P = T.peer; if (!P) return '-'; if (P.curKey()) return `during:${P.curKey()}`; return P.last && G.t - P.last.end <= 1.0 ? `after:${P.last.key}` : '-'; };
  const open = (key0) => {
    cur = { seq: ai.atkSeq, key: key0, fixed: false, t0: G.t, d: ai.d, foeMode: other?.mode ?? '-', clash0: G.clashes, dealt: 0, took: 0, vs: vsNow(), from: last && G.t - last.end <= 0.3 ? last.key : '-' };
  };
  const close = () => {
    if (!cur) return;
    const A = (T.atk[cur.key] ??= { n: 0, dealt: 0, took: 0, after: 0, clash: 0, dSum: 0, tSum: 0, foe: {}, why: {}, vs: {}, from: {} });
    A.n++; A.dealt += cur.dealt; A.took += cur.took; A.clash += G.clashes - cur.clash0 > 0 ? 1 : 0; A.dSum += cur.d; A.tSum += G.t - cur.t0;
    A.foe[cur.foeMode] = (A.foe[cur.foeMode] ?? 0) + 1;
    A.why[cur.why ?? '-'] = (A.why[cur.why ?? '-'] ?? 0) + 1;
    const v = (A.vs[cur.vs] ??= [0, 0]); v[0]++; v[1] += cur.dealt; // [수, 이 칼이 낸 상처]
    if (cur.why?.startsWith('chain:')) A.from[cur.from] = (A.from[cur.from] ?? 0) + 1; // 이어 친 칼의 앞 칼
    last = { A, end: G.t, key: cur.key };
    cur = null;
  };
  // 뒤 박차기 흔적 (독일 — gait.backBurstAi 를 감쌈 · 읽기만): 건 때 거리 · 상대 칼끝 어림 · 다가오는 빠르기 → 닿는 칼이었나(d − 다가옴 × 0.3 ≤ 칼끝 어림 + 0.05) · 건 뒤 0.8 s 안에 맞았나
  const bursts = [];
  const gait = me.gait;
  const bb0 = gait?.backBurstAi;
  if (bb0) gait.backBurstAi = function () {
    const ok = bb0.call(this);
    if (ok) bursts.push({ t: G.t, reach: ai.d - Math.max(0, ai.foeClosing ?? 0) * 0.3 <= ai.foeReach + 0.05, w0: me.wounds.length });
    return ok;
  };
  T.burstDone = () => {
    const o = { n: bursts.length, reach: 0, clean: 0, reachClean: 0 };
    for (const b of bursts) {
      const hit = G.wounds.some((w) => w.vic === me && w.severity > 0 && w.t > b.t && w.t <= b.t + 0.8);
      if (b.reach) o.reach++;
      if (!hit) o.clean++;
      if (b.reach && !hit) o.reachClean++;
    }
    if (bb0) gait.backBurstAi = bb0;
    return o;
  };
  T.curKey = () => cur?.key ?? null;
  Object.defineProperty(T, 'last', { get: () => last });
  const keyNow = () => (ai.secretRun ? `secret:${ai.secretRun.stage ?? '?'}` : ai.passiveAtk ? `passive:${ai.passiveAtk}` : ai.feint ? `feint:${ai.feint.name}` : ai.tech?.name ?? '?');
  const orig = ai.startAttack;
  ai.startAttack = function (tech, why, o = {}) {
    const seq0 = this.atkSeq;
    const ok = orig.call(this, tech, why, o);
    if (ok && this.atkSeq !== seq0) { close(); open(null); cur.why = (o.chain ? 'chain:' : '') + (why ?? '-'); }
    return ok;
  };
  // 뒤 박차기 헛침 경직 흔적 (11/19 — burst_whiff.js · 읽기만 · 판 결과 그대로): 내 굳음 — 도구 눈으로 다시 가름(박찬 걸음 · 칼끝 거리 · 상처 · 칼 부딪힘)해 어긋나면 '헛 굳음' ·
  //  상대 굳음 창 — 그 창 안에 내가 벰 · 독일 띠 높음 뒤 칼(deNach) — 낸 때 · 칼이 나간 때 상대가 굳었나 · 굳은 동안 벰 · 굳음 시작에서 칼이 나갈 때까지 초
  const ob = other?.me; // 상대 몸 (other = 상대 AI)
  const hd = (a, b) => { const p = a.bodies.chest.translation(), q = b.bodies.chest.translation(); return Math.hypot(q.x - p.x, q.z - p.z); };
  const BW = { trig: 0, falseTrig: 0, falseWhy: {}, win: 0, winHit: 0, nach: 0, nachStiffFire: 0, nachStiffStrike: 0, nachHit: 0, nachHitStiff: 0, delay: 0, delayN: 0 };
  let atk0 = null, prevMy = false, prevFoe = false, foeWin = null, nachRec = null;
  const ss0 = ai.startStrike;
  ai.startStrike = function () { atk0 = { t: G.t, d: hd(me, ob), reach: me.swordArt?.measure?.reach ?? 1.8, w: G.wounds.length, c: G.clashes, burst: false }; return ss0.call(this); };
  const bwPoll = () => {
    const og = ob?.gait;
    if (atk0 && og && ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow') && og.fastK > 1 && og.fastDir < 0 && !og.fastSide) atk0.burst = true;
    const my = me.bwStiffT > 0;
    if (my && !prevMy) {
      BW.trig++;
      const why = !atk0 ? 'noAtk' : !atk0.burst ? 'noBurst' : atk0.d > atk0.reach ? 'far' : G.wounds.slice(atk0.w).some((w) => w.att === me && w.vic === ob) ? 'wound' : G.clashes > atk0.c ? 'clash' : null;
      if (why) { BW.falseTrig++; BW.falseWhy[why] = (BW.falseWhy[why] ?? 0) + 1; }
    }
    prevMy = my;
    const fs = (ob?.bwStiffT ?? 0) > 0;
    if (fs && !prevFoe) foeWin = { t0: G.t, w: G.wounds.length, hit: false };
    if (foeWin && G.wounds.slice(foeWin.w).some((w) => w.att === me && w.vic === ob && w.severity > 0)) foeWin.hit = true;
    if (!fs && prevFoe && foeWin) { BW.win++; if (foeWin.hit) BW.winHit++; foeWin = null; }
    prevFoe = fs;
    const N = ai.deNach;
    if (N?.fired && (!nachRec || nachRec.N !== N)) {
      nachRec = { N, seq: N.seq, w: G.wounds.length, strike: false, hitStiff: false };
      BW.nach++;
      if (fs) BW.nachStiffFire++;
    }
    if (nachRec) {
      if (!nachRec.strike && ai.mode === 'attack' && ai.atkSeq === nachRec.seq && ai.phase === 'strike') {
        nachRec.strike = true;
        if (fs) { BW.nachStiffStrike++; if (foeWin) (BW.delay += G.t - foeWin.t0), BW.delayN++; }
      }
      const nw = G.wounds.slice(nachRec.w).filter((w) => w.att === me && w.vic === ob && w.severity > 0);
      if (nw.length && fs) nachRec.hitStiff = true;
      if (!(ai.mode === 'attack' && ai.atkSeq === nachRec.seq) && G.t > (nachRec.t1 ??= G.t + 0.3)) {
        if (nw.length) BW.nachHit++;
        if (nachRec.hitStiff) BW.nachHitStiff++;
        nachRec = null;
      }
    }
  };
  T.poll = () => {
    bwPoll();
    const m = ai.mode;
    T.modeT[m] = (T.modeT[m] ?? 0) + DT;
    if (m === 'watch') { T.dWatch += ai.d; T.nWatch++; }
    if (m === 'secret' && prevMode !== 'secret' && !(cur && cur.seq === ai.atkSeq)) { close(); open('secretMode'); cur.fixed = true; cur.why = 'secret'; }
    if (cur && !cur.fixed) { cur.key = keyNow(); cur.fixed = true; cur.vs = vsNow(); }
    if (cur && ((m !== 'attack' && m !== 'secret') || ai.atkSeq !== cur.seq)) close();
    prevMode = m;
  };
  T.wound = (att, vic) => {
    if (att === me) {
      if (cur) cur.dealt++;
      else if (last && G.t - last.end <= 0.3) last.A.dealt++;
      T.dealtBy[ai.mode] = (T.dealtBy[ai.mode] ?? 0) + 1;
    } else if (vic === me) {
      if (cur) cur.took++;
      else if (last && G.t - last.end <= 0.8) last.A.after++;
      T.tookBy[ai.mode] = (T.tookBy[ai.mode] ?? 0) + 1;
    }
  };
  T.done = () => {
    close();
    for (const A of Object.values(T.atk)) { A.d = +(A.dSum / A.n).toFixed(3); A.t = +(A.tSum / A.n).toFixed(3); delete A.dSum; delete A.tSum; }
    for (const k of Object.keys(T.modeT)) T.modeT[k] = +T.modeT[k].toFixed(2);
    const out = { modeT: T.modeT, atk: T.atk, dealtBy: T.dealtBy, tookBy: T.tookBy, burst: T.burstDone(), bw: { ...BW, delay: BW.delayN ? +(BW.delay / BW.delayN).toFixed(3) : null, stats: me.bwStats ? { ...me.bwStats, log: undefined } : null }, dWatch: T.nWatch ? +(T.dWatch / T.nWatch).toFixed(3) : null, contact: +ai.M.contact.toFixed(3), reach: +(ai.M.reach ?? 0).toFixed(3) };
    ai.startAttack = orig;
    ai.startStrike = ss0;
    return out;
  };
  return T;
}

function measureFight0(f, dur, opt) {
  const { school, lo, hi, weapon, wi, seed, swap } = f;
  const rngSeed = seed * 100 + wi * 10 + (swap ? 1 : 0);
  const lk = opt.look ? LOOKS[opt.look] : null; // --look=enemy: 두 자리 같은 겉모습 (11/17)
  const HiAI = hiClass(school, opt); // --dropHi · --techHi · --noThrustFollowHi (재기 전용 · 없으면 AI 그대로)
  // persona = 상대(E) 자리 AI · persona2 = 플레이어 자리 AI (ai2)
  const G = newRound({
    seed: rngSeed, walls: true, weapon, weapon2: weapon, AIClass: swap ? HiAI : AI, AI2Class: swap ? AI : HiAI, ...(lk ? { look: lk, look2: lk } : {}),
    // 실력 등급: 게임과 같게 숙련도 표의 이름을 넘김(main.js · characters.js aiAtProficiency — AI 가 AI_PLAN.levels 로 바꿈) · 11/17 고침: 전엔 harness 기본 'normal' 이라 모든 숙련도가 보통 숫자
    difficulty: AI_PROFICIENCY.levels[swap ? hi : lo], difficulty2: AI_PROFICIENCY.levels[swap ? lo : hi],
    persona: { proficiency: swap ? hi : lo }, persona2: { proficiency: swap ? lo : hi },
  });
  const hiF = swap ? G.enemy : G.player;
  const loF = swap ? G.player : G.enemy;
  const aiHi = swap ? G.ai : G.ai2;
  const aiLo = swap ? G.ai2 : G.ai;
  // 몸 값: AI 가 PROF_BODY[숙련도] 를 넣었음 (ai.js setLevel — 게임과 같음)

  // --passiveHi (재기 전용): 높은 쪽 패시브 굴림 몫만 (패시브 객체는 유파 표와 함께 쓰므로 그 AI 목록만 새 객체로)
  if (opt.passiveHi?.size) {
    for (const n of opt.passiveHi.keys()) if (!aiHi.passives.some((x) => x.name === n)) throw new Error(`--passiveHi: 높은 쪽에 없는 패시브 ${n} (있는 것: ${aiHi.passives.map((x) => x.name).join(', ')})`);
    aiHi.passives = aiHi.passives.map((x) => (opt.passiveHi.has(x.name) ? { ...x, p: opt.passiveHi.get(x.name) } : x));
  }
  // --gwHi (재기 전용): 높은 쪽 몸의 자세 지도 몫만 (인스턴스 덮기 — 낮은 쪽 · 사람 그대로)
  if (opt.gwHi != null) hiF.guardWeight = () => opt.gwHi;
  // --levelHiSet (재기 전용): 높은 쪽 실력 숫자 몇 칸만 (힘 strength 은 몸 값이라 받지 않음)
  if (opt.levelHiSet?.length) {
    for (const [k, v] of opt.levelHiSet) aiHi.level[k] = v;
    if (opt.levelHiSet.some(([k]) => k === 'skill')) hiF.skill.level = aiHi.level.skill;
  }
  // --cfgHi (재기 전용): 높은 쪽 판단 스텝 동안만 config 칸을 바꾸고 곧 되돌림
  if (opt.cfgHi?.length) {
    const up = aiHi.update;
    aiHi.update = function (dt) {
      const old = opt.cfgHi.map(([o, k, v]) => { const x = o[k]; o[k] = v; return x; });
      try { return up.call(this, dt); } finally { opt.cfgHi.forEach(([o, k], i) => { o[k] = old[i]; }); }
    };
  }
  const dealt = new Map([[hiF, 0], [loF, 0]]);
  // --stats (11/18 · 읽기만): 두 쪽 공격 흔적
  const trH = opt.stats ? traceAI(G, aiHi, hiF, aiLo) : null;
  const trL = opt.stats ? traceAI(G, aiLo, loF, aiHi) : null;
  if (trH) (trH.peer = trL), (trL.peer = trH);
  // --gns (11/19 · 읽기만): 높은 쪽 고노센 깔때기 흔적 (gns_funnel.mjs)
  const gP = opt.gns ? gnsProbe({ G, aiHi, aiLo, hiF, loF, dt: DT }) : null;
  G.onWound = (att, vic, r) => {
    if (r.severity > 0 && dealt.has(att)) dealt.set(att, dealt.get(att) + 1);
    if (r.severity > 0 && trH) trH.wound(att, vic), trL.wound(att, vic);
    if (gP) gP.wound(att, vic, r);
  };

  if (trH || gP) while (G.t < dur && !outOf(hiF) && !outOf(loF)) G.step(), trH?.poll(), trL?.poll(), gP?.poll();
  else while (G.t < dur && !outOf(hiF) && !outOf(loF)) G.step();
  const hOut = outOf(hiF), lOut = outOf(loF);
  const result = lOut && !hOut ? 'hi' : hOut && !lOut ? 'lo' : 'draw';
  const rec = {
    school, lo, hi, weapon, seed, swap, result,
    endT: +G.t.toFixed(2),
    hiWounds: dealt.get(hiF), loWounds: dealt.get(loF),
    hiBlood: +hiF.blood.toFixed(3), loBlood: +loF.blood.toFixed(3),
    hiSecrets: secretsFired(aiHi), loSecrets: secretsFired(aiLo),
    hiCause: hiF.causeOfDeath ?? null, loCause: loF.causeOfDeath ?? null, // 쓰러진 까닭 (출혈 · 기절 · 목 · 머리 … — 11/17 E: 버티는 힘이 닿는 몫을 보려고 · 읽기만)
    ...(trH ? { hiStats: compactStats(aiHi.stats), loStats: compactStats(aiLo.stats), buckle: (G.combat.buckleLog ?? []).reduce((o, b) => {
      const side = b.att === hiF.index ? 'hi' : 'lo';
      const k = `${side}${b.hit ? 'Hit' : 'Roll'}`;
      o[k] = (o[k] ?? 0) + 1;
      if (b.hit && G.wounds.some((w) => w.att === (side === 'hi' ? hiF : loF) && w.severity > 0 && w.t > b.t + 0.05 && w.t <= b.t + 1.5)) o[`${side}Follow`] = (o[`${side}Follow`] ?? 0) + 1; // 꿇린 뒤 1.5 s 안에 그 쪽이 다시 벰
      return o;
    }, {}), hiStam: compactStats({ spent: hiF.stamina?.spent, counts: hiF.stamina?.counts }), loStam: compactStats({ spent: loF.stamina?.spent, counts: loF.stamina?.counts }), hiTrace: trH.done(), loTrace: trL.done(), hiLevel: aiHi.levelName, hiKit: aiHi.kit ? [...aiHi.kit.unique].concat(Object.keys(aiHi.kit).filter((k) => aiHi.kit[k] === true)) : null } : {}),
    ...(gP ? { gns: gP.done() } : {}),
  };
  G.world.free();
  return rec;
}

/** 판 기록을 한 번에 갈아 씀 (임시 파일 → 이름 바꿈 — 쓰는 중에 멈춰도 옛 파일이 남게) */
const saveRuns = (out, runs) => { writeFileSync(`${out}.tmp`, JSON.stringify(runs)); renameSync(`${out}.tmp`, out); };

const pct = (x) => `${x.toFixed(1)} %`;
/** 기록 배열 → Markdown 표 (짝마다 한 줄 · 합산 · 유파별) */
export function aggTable(rows) {
  const keys = [...new Set(rows.map((r) => `${r.lo}:${r.hi}`))];
  keys.sort((a, b) => (PAIR_ORDER.indexOf(a) < 0 ? 99 : PAIR_ORDER.indexOf(a)) - (PAIR_ORDER.indexOf(b) < 0 ? 99 : PAIR_ORDER.indexOf(b)) || a.localeCompare(b));
  const schools = SCHOOLS.filter((s) => rows.some((r) => r.school === s));
  const head = ['짝 (낮:높)', '목표', '합산 hi 몫 (승+무½)', '95 % 구간', '승 · 무 · 패', '평균 끝 (s)', ...schools.map((s) => KO[s])];
  const L = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const key of keys) {
    const rs = rows.filter((r) => `${r.lo}:${r.hi}` === key);
    const n = rs.length;
    const W = rs.filter((r) => r.result === 'hi').length, D = rs.filter((r) => r.result === 'draw').length, Lo = rs.filter((r) => r.result === 'lo').length;
    const k = W + D / 2;
    const p = (100 * k) / n;
    const [wl, wh] = wilson(k, n).map((v) => 100 * v);
    const tg = targetOf(key);
    const out = tg && (p < tg.t[0] || p > tg.t[1]) ? ' 밖' : '';
    const meanT = rs.reduce((s, r) => s + r.endT, 0) / n;
    const cells = schools.map((s) => {
      const ss = rs.filter((r) => r.school === s);
      if (!ss.length) return '-';
      const ks = ss.filter((r) => r.result === 'hi').length + ss.filter((r) => r.result === 'draw').length / 2;
      const ds = ss.filter((r) => r.result === 'draw').length;
      return `${((100 * ks) / ss.length).toFixed(0)} % (무 ${ds})`;
    });
    L.push(`| ${key} | ${tg ? tg.label : '-'} | ${pct(p)}${out} | ${wl.toFixed(1)} ~ ${wh.toFixed(1)} % | ${W} · ${D} · ${Lo} (${n}) | ${meanT.toFixed(1)} | ${cells.join(' | ')} |`);
  }
  return L.join('\n');
}

/** --stats 판 기록 → 흔적 요약 글 (trace 갈래 · 읽기만) */
export function traceTable(rows, side = 'hi', top = 14) {
  const n = rows.length;
  const W = rows.filter((r) => r.result === 'hi').length, D = rows.filter((r) => r.result === 'draw').length;
  const [wl, wh] = wilson(W + D / 2, n).map((v) => 100 * v);
  const mean = (k) => rows.reduce((a, r) => a + (r[k] ?? 0), 0) / n;
  const L = [`hi 몫 ${((100 * (W + D / 2)) / n).toFixed(1)} % [${wl.toFixed(1)} ~ ${wh.toFixed(1)}] · 승 ${W} · 무 ${D} · ${n} 판 · 끝 ${mean('endT').toFixed(1)} s · 상처 hi→lo ${mean('hiWounds').toFixed(2)} · lo→hi ${mean('loWounds').toFixed(2)} · 비기 hi ${mean('hiSecrets').toFixed(2)} · lo ${mean('loSecrets').toFixed(2)}`];
  const T = rows.map((r) => r[`${side}Trace`]).filter(Boolean);
  if (!T.length) return L.join('\n');
  const N = T.length;
  const sumInto = (o, src) => { for (const [k, v] of Object.entries(src ?? {})) o[k] = (o[k] ?? 0) + v; return o; };
  const modeT = {}, dealtBy = {}, tookBy = {};
  for (const t of T) sumInto(modeT, t.modeT), sumInto(dealtBy, t.dealtBy), sumInto(tookBy, t.tookBy);
  const tot = Object.values(modeT).reduce((a, v) => a + v, 0);
  L.push(`[${side}] 꼴 몫 ${Object.entries(modeT).sort((a, b) => b[1] - a[1]).map(([m, v]) => `${m} ${((100 * v) / tot).toFixed(0)} %`).join(' · ')} · 간 보기 거리 ${(T.reduce((a, t) => a + (t.dWatch ?? 0), 0) / N).toFixed(2)} m · 맞닿기 ${(T.reduce((a, t) => a + t.contact, 0) / N).toFixed(2)} m`);
  const BU = T.reduce((o, t) => { for (const k of ['n', 'reach', 'clean', 'reachClean']) o[k] += t.burst?.[k] ?? 0; return o; }, { n: 0, reach: 0, clean: 0, reachClean: 0 });
  const BWs = T.reduce((o, t) => { for (const k of ['trig', 'falseTrig', 'win', 'winHit', 'nach', 'nachStiffFire', 'nachStiffStrike', 'nachHit', 'nachHitStiff']) o[k] += t.bw?.[k] ?? 0; return o; }, { trig: 0, falseTrig: 0, win: 0, winHit: 0, nach: 0, nachStiffFire: 0, nachStiffStrike: 0, nachHit: 0, nachHitStiff: 0 });
  if (BWs.trig || BWs.win || BWs.nach) L.push(`뒤 박차기 헛침 경직 — 내가 굳음 판당 ${(BWs.trig / N).toFixed(2)} (헛 굳음 ${BWs.falseTrig}) · 상대 굳음 창 판당 ${(BWs.win / N).toFixed(2)} · 그 창에 벰 ${BWs.win ? ((100 * BWs.winHit) / BWs.win).toFixed(0) : '-'} % · 뒤 칼 판당 ${(BWs.nach / N).toFixed(2)} · 낼 때 굳음 ${BWs.nachStiffFire} · 칼이 나갈 때 굳음 ${BWs.nachStiffStrike} · 맞힘 ${BWs.nachHit} (굳은 동안 ${BWs.nachHitStiff})`);
  if (BU.n) L.push(`뒤 박차기 판당 ${(BU.n / N).toFixed(2)} · 닿는 칼에 건 몫 ${((100 * BU.reach) / BU.n).toFixed(0)} % · 건 뒤 0.8 s 안 안 맞음 ${((100 * BU.clean) / BU.n).toFixed(0)} % · 닿는 칼을 비낌(닿는 칼 · 안 맞음) ${((100 * BU.reachClean) / BU.n).toFixed(0)} %`);
  L.push(`준 상처 (판당) ${Object.entries(dealtBy).map(([m, v]) => `${m} ${(v / N).toFixed(2)}`).join(' · ')} | 받은 상처 ${Object.entries(tookBy).map(([m, v]) => `${m} ${(v / N).toFixed(2)}`).join(' · ')}`);
  const A = {};
  for (const t of T) for (const [k, a] of Object.entries(t.atk)) {
    const x = (A[k] ??= { n: 0, dealt: 0, took: 0, after: 0, clash: 0, d: 0, t: 0, foe: {}, why: {}, vs: {}, from: {} });
    x.n += a.n; x.dealt += a.dealt; x.took += a.took; x.after += a.after; x.clash += a.clash; x.d += a.d * a.n; x.t += a.t * a.n;
    sumInto(x.foe, a.foe); sumInto(x.why, a.why); sumInto(x.from, a.from);
    for (const [m, [c, h]] of Object.entries(a.vs ?? {})) { const y = (x.vs[m] ??= [0, 0]); y[0] += c; y[1] += h; }
  }
  L.push('| 기술 | 판당 | 맞힘 /수 | 맞음 /수 | 뒤 0.8 s 맞음 /수 | 부딪힘 | 거리 m | 칼 s | 상대 꼴 % | 까닭 % |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const [k, x] of Object.entries(A).sort((a, b) => b[1].n - a[1].n).slice(0, top)) {
    const pc = (v) => ((100 * v) / x.n).toFixed(0);
    const top4 = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, v]) => `${m} ${pc(v)}`).join(' ');
    L.push(`| ${k} | ${(x.n / N).toFixed(2)} | ${pc(x.dealt)} | ${pc(x.took)} | ${pc(x.after)} | ${pc(x.clash)} | ${(x.d / x.n).toFixed(2)} | ${(x.t / x.n).toFixed(2)} | ${top4(x.foe)} | ${top4(x.why)} |`);
  }
  // 상대 칼에 답한 칼 (--vs): 'after:<상대 기술>' 마다 판당 수 · 맞힘 — 상대 어느 칼의 끝을 벌했나 · 이어 친 칼의 앞 칼
  if (args.includes('--vs')) {
    const V = {};
    for (const x of Object.values(A)) for (const [m, [c, h]] of Object.entries(x.vs)) { const y = (V[m] ??= [0, 0]); y[0] += c; y[1] += h; }
    L.push(`이 쪽 칼을 열 때 상대 칼 (판당 수 · 맞힘 %): ${Object.entries(V).sort((a, b) => b[1][0] - a[1][0]).slice(0, 12).map(([m, [c, h]]) => `${m} ${(c / N).toFixed(2)} (${((100 * h) / c).toFixed(0)})`).join(' · ')}`);
    const F = {};
    for (const [k, x] of Object.entries(A)) for (const [m, c] of Object.entries(x.from)) F[`${m}→${k}`] = (F[`${m}→${k}`] ?? 0) + c;
    L.push(`이어 친 칼 (앞 → 뒤 · 판당): ${Object.entries(F).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([m, c]) => `${m} ${(c / N).toFixed(2)}`).join(' · ')}`);
  }
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  if (mode === 'trace') {
    const side = args.includes('--lo') ? 'lo' : 'hi';
    const top = +arg('top', '14');
    for (const p of args.slice(1).filter((a) => !a.startsWith('--'))) console.log(`\n## ${p}\n${traceTable(JSON.parse(readFileSync(p, 'utf8')), side, top)}`);
  } else if (mode === 'agg') {
    const rows = args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(aggTable(rows));
  } else {
    const schools = arg('schools', SCHOOLS.join(',')).split(',');
    for (const s of schools) if (!SCHOOLS.includes(s)) throw new Error(`unknown school: ${s}`);
    const pairs = arg('pairs', PAIR_ORDER.join(',')).split(',');
    for (const p of pairs) {
      const [lo, hi] = p.split(':').map(Number);
      if (!(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && hi > lo && hi <= 6)) throw new Error(`bad pair: ${p} (lo:hi, 1 ≤ lo < hi ≤ 6)`);
    }
    const seeds = range(arg('seeds', '1-3'));
    const dur = +arg('dur', '60');
    const look = arg('look', null);
    if (look && !LOOKS[look]) throw new Error(`unknown look: ${look}`);
    applyCfgArgs(); // config 수 덮어쓰기 (재기 전용)
    for (const [k, key] of [['vit', 'vitality'], ['str', 'strength']]) {
      const v = arg(k, null);
      if (v == null) continue;
      const xs = v.split(',').map(Number);
      if (xs.length !== PROF_BODY[key].length || !xs.every((x) => x > 0)) throw new Error(`--${k}= 는 양수 ${PROF_BODY[key].length} 개 (숙련도 0 ~ 6)`);
      PROF_BODY[key].splice(0, xs.length, ...xs);
    }
    console.error(`몸 값 PROF_BODY vitality [${PROF_BODY.vitality.join(', ')}] · strength [${PROF_BODY.strength.join(', ')}]`);
    const shard = arg('shard', '1/1').split('/').map(Number);
    const [si, sn] = shard;
    if (!(sn >= 1 && si >= 1 && si <= sn)) throw new Error('--shard=i/n 은 1 ≤ i ≤ n');
    const all = planFights({ schools, pairs, seeds });
    const mine = all.map((f, k) => ({ f, k })).filter(({ k }) => k % sn === si - 1);
    console.error(`전체 ${all.length} 판 · 이 샤드 ${mine.length} 판 (${si}/${sn})`);
    // --json 은 판 10 개마다 그때까지를 씀(11/18 — 컨테이너가 다시 서도 남게) · --resume 이면 그 파일에 이미 있는 판(번호 k)은 건너뜀 (옵션은 같게)
    // 단계 덜어 보기 (11/18 · 재기 전용 — 머리 글 참고)
    const dropHi = new Set((arg('dropHi', '') || '').split(',').filter(Boolean));
    const known = new Set(Object.values(AI_KIT.ladder).flat(2));
    for (const id of dropHi) if (!known.has(id)) throw new Error(`--dropHi: 사다리에 없는 칸 ${id}`);
    const levelHi = arg('levelHi', null);
    if (levelHi != null && !AI_LEVELS[levelHi]) throw new Error(`--levelHi: 모르는 이름 ${levelHi}`);
    const bandHiS = arg('bandHi', null);
    const bandHi = bandHiS == null ? null : +bandHiS;
    if (bandHi != null && !(Number.isInteger(bandHi) && bandHi >= 0 && bandHi <= 3)) throw new Error('--bandHi 는 0 ~ 3');
    const techHi = new Map((arg('techHi', '') || '').split(',').filter(Boolean).map((x) => {
      const [n, b, f] = x.split(':');
      if (!(+b > 0)) throw new Error(`--techHi=이름:무게[:nofit] — ${x}`);
      return [n, { base: +b, nofit: f === 'nofit' }];
    }));
    const noThrustFollowHi = new Set((arg('noThrustFollowHi', '') || '').split(',').filter(Boolean));
    const keepBaseHi = new Set((arg('keepBaseHi', '') || '').split(',').filter(Boolean));
    const levelHiSet = (arg('levelHiSet', '') || '').split(',').filter(Boolean).map((x) => {
      const [k, v] = x.split(':');
      if (!(k in AI_LEVELS.normal) || k === 'strength' || !Number.isFinite(+v)) throw new Error(`--levelHiSet=칸:수 — ${x}`);
      return [k, +v];
    });
    if (levelHiSet.length) console.error(`높은 쪽 실력 숫자: ${levelHiSet.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
    const passiveHi = new Map((arg('passiveHi', '') || '').split(',').filter(Boolean).map((x) => { const [n, v] = x.split(':'); if (!(+v >= 0)) throw new Error(`--passiveHi=이름:몫 — ${x}`); return [n, +v]; }));
    if (passiveHi.size) console.error(`높은 쪽 패시브 몫: ${[...passiveHi].map(([n, v]) => `${n} ${v}`).join(' · ')}`);
    const gwS = arg('gwHi', null);
    const gwHi = gwS == null ? null : +gwS;
    if (gwHi != null && !(gwHi >= 0 && gwHi <= 1)) throw new Error('--gwHi 는 0 ~ 1');
    if (gwHi != null) console.error(`높은 쪽 자세 지도 몫: ${gwHi}`);
    const cfgHi = resolveCfg(arg('cfgHi', ''));
    if (cfgHi.length) console.error(`높은 쪽 판단 동안만 cfg: ${arg('cfgHi', '')}`);
    const stats = args.includes('--stats');
    const gns = args.includes('--gns');
    if (keepBaseHi.size) console.error(`높은 쪽 바탕 기술 되살림: ${[...keepBaseHi].join(', ')}`);
    if (dropHi.size || levelHi || bandHi != null || techHi.size || noThrustFollowHi.size) console.error(`높은 쪽만: 칸 뺌 [${[...dropHi].join(', ')}] · 실력 이름 ${levelHi ?? '그대로'} · 띠 ${bandHi ?? '그대로'} · 기술 무게 [${[...techHi].map(([n, o]) => `${n} ${o.base}${o.nofit ? ' nofit' : ''}`).join(', ')}] · 찌르기 이어 치기 막음 [${[...noThrustFollowHi].join(', ')}]`);
    const out = arg('json', null);
    const runs = out && args.includes('--resume') && existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : [];
    const done = new Set(runs.map((r) => r.k));
    if (done.size) console.error(`이어 재기: ${done.size} 판 있음`);
    for (const { f, k } of mine) {
      if (done.has(k)) continue;
      const r = { k, ...measureFight(f, dur, { look, dropHi, levelHi, bandHi, stats, gns, techHi, noThrustFollowHi, keepBaseHi, cfgHi, levelHiSet, passiveHi, gwHi }) };
      runs.push(r);
      console.error(`[${k + 1}/${all.length}] ${f.school} ${f.lo}:${f.hi} w${f.wi} s${f.seed} ${f.swap ? 'swap' : 'std'} → ${r.result} @${r.endT}s`);
      if (out && runs.length % 10 === 0) saveRuns(out, runs);
    }
    if (out) saveRuns(out, runs);
    console.log(aggTable(runs));
  }
}
