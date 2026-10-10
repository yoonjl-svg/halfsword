// 동작 라이브러리 점검 (src/motion_library.js, docs/weapon_motions.md)
//   node tools/sim/hybrid.mjs motion_lab.mjs poses <무기id>          자세표: 자세마다 손·칼끝이 목표에 얼마나 붙나 (지금 표 vs 라이브러리 표)
//   node tools/sim/hybrid.mjs motion_lab.mjs swings <무기id> [기술…]   기술마다 혼자 휘둘러: 걸린 시간, 칼날 70% 최고 속도, 베기 지표(J), 날 세움
//   node tools/sim/hybrid.mjs motion_lab.mjs duel <무기id> <자리마다 판 수> [off|on]   롱소드 상대 실제 승패 (ability_test 와 같은 판)
//  라이브러리를 켜는 곳은 이 도구뿐이다(게임 기본은 꺼짐).
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { WEAPONS } from '../../src/weapons.js';
import { SCHOOLS, SCHOOL_ART, TRADITIONS, CHINESE_TECHK_B, traditionOf } from '../../src/schools.js';
import { mergeUnique } from '../../src/sword_art.js';
import { STRIKE, GAIT, SKILL, SECRET } from '../../src/config.js';
// 유파 자료 (10/9 ②③ — 켜는 곳은 이 도구뿐, src 기본은 끔): SCHOOL_ART=1 → SKILL.schoolArt 1.
//  SCHOOL_ART_PARTS=weights,rest,counter (켤 몫만, 없으면 셋 다) · SCHOOL_REST=langort (일본·중국 쉴 자세 안 A) · SCHOOL_TECHK=B (중국 가중치 안 B)
if (process.env.SCHOOL_ART === '1') {
  SKILL.schoolArt = 1;
  const parts = process.env.SCHOOL_ART_PARTS ? process.env.SCHOOL_ART_PARTS.split(/[,|]/) : null;
  if (parts) for (const k of Object.keys(SCHOOL_ART)) SCHOOL_ART[k] = parts.includes(k);
}
if (process.env.SCHOOL_REST) for (const t of ['japanese', 'chinese']) TRADITIONS[t].rest = process.env.SCHOOL_REST;
if (process.env.SCHOOL_TECHK === 'B') TRADITIONS.chinese.techK = CHINESE_TECHK_B;
// 유파 고유 동작 (10/9 — 옛 이름 newTech): SCHOOL_UNIQUE=이름,이름 = 고유 동작 켬 묶음을 이것으로 딱 맞춘다(적은 것만 ai 켬, 나머지 유파 고유 동작은 모두 끔 — 'none' = 모두 끔).
//  독일 고유 동작은 상대(롱소드 AI)도 독일이라 전역으로 켜면 양쪽이 같이 바뀐다 → 독일 이름은 전역으로 켜지 않고 duel 의 시험 쪽(X) 꾸러미에만 더한다(아래 uqX).
//  SCHOOL_NEWTECH=이름 (옛 손잡이) = 적은 것만 더 켬(나머지는 src 기본 그대로)
const UQ_SET = process.env.SCHOOL_UNIQUE ? process.env.SCHOOL_UNIQUE.split(',') : null;
const uqX = [];
if (UQ_SET) for (const [tn, t] of Object.entries(TRADITIONS)) for (const x of t.unique ?? []) {
  const on = UQ_SET.includes(x.name);
  if (tn === 'german') { if (on) uqX.push(x); continue; } // 독일: 전역 ai 는 그대로(끔) — 시험 쪽에만
  x.ai = on;
}
// 기술 걸음 (10/9 비껴 들어가 베기): STEP_WHEN=strike|approach = 유파 고유 동작의 step.when 을 모두 이것으로 (재기용), STEP_OFF=1 = step 칸을 모두 지움(같은 길, 걸음만 없음)
if (process.env.STEP_WHEN || process.env.STEP_OFF === '1') for (const t of Object.values(TRADITIONS)) for (const x of t.unique ?? []) {
  if (!x.step) continue;
  if (process.env.STEP_OFF === '1') delete x.step;
  else x.step = { ...x.step, when: process.env.STEP_WHEN };
}
if (process.env.SCHOOL_NEWTECH) {
  const names = process.env.SCHOOL_NEWTECH.split(',');
  for (const t of Object.values(TRADITIONS)) for (const x of [...(t.unique ?? []), ...(t.spare ?? [])]) if (names.includes(x.name)) x.ai = true;
}
// 고유 동작 상황 선호 (10/9 13:xx — docs/strike/passive_fire_2026-10-09.md): UNIQUE_FIT=0 = 모든 유파 고유 동작의 fit 칸을 지운다(양쪽 AI 모두 — 대조용)
if (process.env.UNIQUE_FIT === '0') for (const t of Object.values(TRADITIONS)) for (const x of t.unique ?? []) delete x.fit;
// 패시브 고유 동작 (10/9 — docs/strike/school_passive_2026-10-09.md): duel 의 시험 쪽(X) AI 만 패시브 목록을 갈아 끼운다(상대 롱소드 AI 는 그대로).
//  SCHOOL_PASSIVE=off(없음)|all(유파 기본, 없을 때와 같음)|이름,이름(유파 기본 가운데 그것만) · SCHOOL_PASSIVE_GERMAN=1 = 독일 셋(ai:false)을 시험 쪽에만 켬
//  SCHOOL_RITIRATA=0 = 이탈리아 물러남 자세(Ritirata, 유파 withdraw 값)를 전 값(독일 황소 · 쟁기·긴 자세)으로 — 기준선 대조
const PASSIVE_SET = process.env.SCHOOL_PASSIVE ?? null;
const PASSIVE_GERMAN = process.env.SCHOOL_PASSIVE_GERMAN === '1';
if (process.env.SCHOOL_RITIRATA === '0') {
  const old = { pressed: 'ochsR', calm: ['pflugR', 'langort'] };
  TRADITIONS.italian.withdraw = old;
  for (const k of Object.keys(SCHOOLS)) if (SCHOOLS[k].tradition === 'italian') SCHOOLS[k] = { ...SCHOOLS[k], withdraw: old };
}
/** 시험 쪽 AI 의 패시브 목록 (환경 변수가 없으면 null = 손대지 않음) */
function passiveList(ai) {
  if (PASSIVE_SET == null && !PASSIVE_GERMAN) return null;
  const tn = ai.art.tradition;
  let list = (TRADITIONS[tn]?.passives ?? []).filter((x) => x.ai !== false || (PASSIVE_GERMAN && tn === 'german'));
  if (PASSIVE_SET === 'off') list = [];
  else if (PASSIVE_SET && PASSIVE_SET !== 'all') list = list.filter((x) => PASSIVE_SET.split(',').includes(x.name));
  return list;
}
// 유파 비기 (10/9 유파 설계 v3 — docs/strike/school_secret_2026-10-09.md): SCHOOL_SECRET=off = 시험 쪽(X) AI 만 비기 없음(상대 롱소드 AI 는 그대로) ·
//  alloff = 양쪽 모두 끔(SKILL.schoolSecret 0) · SECRET_LETHAL=수 = 독일 문턱 lethalJ 를 이 값으로 · SECRET_JSON = SECRET 칸 덮기 (재기용, 양쪽)
const SECRET_X_OFF = process.env.SCHOOL_SECRET === 'off';
if (process.env.SCHOOL_SECRET === 'alloff') SKILL.schoolSecret = 0;
if (process.env.SECRET_LETHAL) SECRET.lethalJ = +process.env.SECRET_LETHAL;
if (process.env.SECRET_JSON) Object.assign(SECRET, JSON.parse(process.env.SECRET_JSON));
// SECRET_DO_JSON = '{"iberian":{"powerFrom":3,"path":[…]}}' — 유파 비기 do 칸 덮기 (재기용, 양쪽)
if (process.env.SECRET_DO_JSON) for (const [t, o] of Object.entries(JSON.parse(process.env.SECRET_DO_JSON))) if (TRADITIONS[t]?.secret) TRADITIONS[t].secret = { ...TRADITIONS[t].secret, do: { ...TRADITIONS[t].secret.do, ...o } };
// 헛친 칼 계기 (10/9 비기 후속 — 일본 後の先 '진짜 헛스윙' 문턱): 공격마다 칼끝 추정 에너지 최고를 재고, 맞힘도 맞물림도 없이 끝난 공격(afterStrike 'missed')만 모은다. 읽기만
const missE = { X: [], Y: [] };
// 한 칼 최고 상처 (10/9 비기 후속): 한 번의 공격(startAttack 하나)이 낸 상처 가운데 가장 센 것 — 한 칼이 여러 부위를 스쳐 생기는 약한 덤 상처를 빼고 '그 칼의 파괴력'을 본다. 시험 쪽만
const swingMax = {};
function swFlush(ai) {
  const w = ai._sw;
  ai._sw = null;
  if (w && w.max > 0 && ai._swOn) (swingMax[w.tn] ??= []).push(w.max);
}
{
  const sa = AI.prototype.startAttack;
  AI.prototype.startAttack = function (...a) {
    swFlush(this);
    const ok = sa.apply(this, a);
    if (ok) this._pkE = 0;
    return ok;
  };
  // 닿기까지 시간 (10/9 4차 — 사장님 '비기는 통상보다 훨씬 빨라야'): 칼이 나간 때(startStrike)·비기를 낸 때(secretGo)에 시계를 찍고, 그 공격의 첫 상처까지 ms
  const ss = AI.prototype.startStrike;
  AI.prototype.startStrike = function (...a) {
    this._ssT = this.sense.t;
    this._hitDone = false;
    return ss.apply(this, a);
  };
  const sg = AI.prototype.secretGo;
  AI.prototype.secretGo = function (...a) {
    const t = this.sense.t;
    const ok = sg.apply(this, a);
    if (ok) this._fireT = t;
    return ok;
  };
  const af = AI.prototype.afterStrike;
  AI.prototype.afterStrike = function (...a) {
    if (!this.hitLanded && !this.bound && this._missTo) this._missTo.push(this._pkE ?? 0);
    return af.apply(this, a);
  };
} // 비기 수 갈아 끼우기 (재기용, 예: '{"italianDist":[0,0.2]}')
if (process.env.HEIGHT_RATE) GAIT.heightRate = +process.env.HEIGHT_RATE; // 점검: 골반 높이를 바꾸는 최고 빠르기 (런지 몸 낮춤)
import { GUARD_BASE } from '../../src/guards.js';
import { applyMotionLibrary, motionFor, MOTION, installFlow } from '../../src/motion_library.js';
MOTION.lib = false; // 점검 도구: 본판 스위치(10/8 기본 켬)를 끄고 아래에서 직접 입힌다 → 끔/켬 A/B 그대로. duel 의 'main' 은 본판 길(스위치 켬, 생성자가 입힘)을 그대로 잰다
for (const k of (process.env.MOTION_SKIP ?? '').split(',').filter(Boolean)) MOTION.skip.add(k);
if (process.env.USE_PARRY === '1') MOTION.useParry = true;
if (process.env.COVER_IN) MOTION.coverIn = +process.env.COVER_IN;
if (process.env.COVER_OUT) MOTION.coverOut = +process.env.COVER_OUT;
import { TECH } from '../../src/ai_techniques.js';
import { wilson } from './ref_duel.mjs';
import { registerPoleWeapons } from './pole_specs.mjs';
if (process.env.EXTRA === 'pole') registerPoleWeapons(WEAPONS); // 자루 무기 시제품(proto_staff·proto_spear)도 잰다

const [mode, id = 'longsword', ...rest] = process.argv.slice(2);
const W = WEAPONS[id];
if (!W) throw new Error(`무기 없음: ${id}`);
const q4 = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const deg = (a) => (a * 180) / Math.PI;

/** 칼날 t 지점 속도와 날 세움 (weapon_tempo.mjs pointState 와 같은 식) */
function pointState(f, t) {
  const c = f.weaponCfg;
  const p = f.sword.translation();
  const q = q4(f.sword.rotation());
  const pt = new THREE.Vector3(0, c.hiltLength + t * c.bladeLength, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
  const u = f.sword.velocityAtPoint(pt);
  const v = new THREE.Vector3(u.x, u.y, u.z);
  const s = v.length();
  if (!c.edged) return { s, q: 1 };
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const perp = v.clone().addScaledVector(axis, -v.dot(axis));
  const pl = perp.length();
  const align = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
  return { s, q: align > STRIKE.edgeAlign ? 0.4 + 0.6 * ((align - STRIKE.edgeAlign) / (1 - STRIKE.edgeAlign)) : 0 };
}
/** 칼날 t 지점에서 날 방향으로 민 유효 질량 (weapon_tempo.mjs mFreeAt 과 같은 식) */
function mFreeAt(f, t) {
  const c = f.weaponCfg;
  const { m, I, frame } = f.swordProps;
  const d = c.hiltLength + t * c.bladeLength - f.swordCom;
  const rn = new THREE.Vector3(0, d, 0).cross(new THREE.Vector3(1, 0, 0)).applyQuaternion(frame.clone().invert());
  return 1 / (1 / m + (rn.x * rn.x) / I.x + (rn.y * rn.y) / Math.max(I.y, 1e-6) + (rn.z * rn.z) / I.z);
}
function soloRound(lib) {
  const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
  G.park();
  const P = G.player;
  if (lib && process.env.LIB !== '0') applyMotionLibrary(P, { overlay: process.env.NO_OVERLAY !== '1' });
  if (process.env.TWIST_MUL) P.twistScale *= +process.env.TWIST_MUL; // 점검: 날 세우기 힘 배율
  return { G, P };
}
function setPad(P, x, y) {
  P.handOffset.set(x, y);
  P.skill.aimRaw?.set?.(x, y);
}

if (mode === 'poses') {
  // 자세마다 1.2초 들고 있게 한 뒤: 손(칼 원점)이 손 목표에서 몇 cm, 칼 축이 칼끝 목표 방향에서 몇 도 벗어났나
  const rows = [];
  for (const lib of [false, true]) {
    const { G, P } = soloRound(lib);
    const n = GUARD_BASE.length;
    for (let i = 0; i < n; i++) {
      const pd = GUARD_BASE[i].pad;
      setPad(P, pd[0], pd[1]);
      let hErr = 0;
      let aErr = 0;
      let k = 0;
      for (let t = 0; t < 1.4; t += DT) {
        G.step();
        if (t > 1.0) {
          const s = P.sword.translation();
          hErr += P.handTarget.distanceTo(new THREE.Vector3(s.x, s.y, s.z));
          const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q4(P.sword.rotation()));
          const gp = P.guardPose;
          const want = new THREE.Vector3(gp.dir[0], gp.dir[1], gp.dir[2]).applyQuaternion(P.yaw);
          aErr += deg(ax.angleTo(want));
          k++;
        }
      }
      rows.push({ lib, i, name: P.guardPose.table?.[i]?.name ?? '(바탕 표)', near: P.guardPose.nearest, hand: ((100 * hErr) / k).toFixed(1), ang: (aErr / k).toFixed(1) });
    }
  }
  const byI = {};
  for (const r of rows) (byI[r.i] ||= {})[r.lib ? 'on' : 'off'] = r;
  console.log(`${id} (${motionFor(W).frame}·${motionFor(W).style}) — 자세마다 손 오차 cm / 칼끝 방향 오차 ° (1.0~1.4초 평균)`);
  console.log('| 패드 | 지금 표 | 손 | 칼끝 | 라이브러리 표 | 손 | 칼끝 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const i of Object.keys(byI)) {
    const a = byI[i].off;
    const b = byI[i].on;
    console.log(`| ${i} | ${a.name} | ${a.hand} | ${a.ang} | ${b.name} | ${b.hand} | ${b.ang} |`);
  }
} else if (mode === 'swings') {
  // 기술 길을 AI 손 빠르기(패드 m/s)로 따라간다: 시작 자세에서 0.8초 기다린 뒤 길을 따라가고 0.6초 더 본다
  const SP = +(process.env.PAD_SPEED ?? 11); // 패드 m/s — AI 보통 난이도 strikeSpeed (config.js AI_LEVELS.normal)
  const only = rest.filter((x) => !x.startsWith('-'));
  const m = motionFor(W);
  const list = (only.length ? m.tech.filter((t) => only.includes(t.name)) : m.tech).concat();
  console.log(`${id} (${m.frame}·${m.style}) — 기술별: 걸린 시간 · 칼날 70% 최고 속도 · 베기 지표 J(날 세움 곱) · 쳐낸 베기 수(칼날 속도 봉우리 ≥ 6 m/s)`);
  console.log('| 기술 | 종류 | 길이(패드 m) | 시간 s | 최고 속도 m/s | 지표 J | ×날 세움 J | 봉우리 (속도×날 세움) |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const tech of list) {
    for (const lib of [true]) {
      const { G, P } = soloRound(lib);
      setPad(P, tech.from[0], tech.from[1]);
      for (let t = 0; t < 0.8; t += DT) G.step();
      const pts = tech.path.map((p) => p.slice());
      let cur = [tech.from[0], tech.from[1]];
      let len = 0;
      let prev = cur;
      for (const p of pts) (len += Math.hypot(p[0] - prev[0], p[1] - prev[1])), (prev = p);
      let t = 0;
      let peak = 0;
      let peakQ = 0;
      let peaks = 0;
      const peakList = [];
      let rising = false;
      let last = 0;
      let done = null;
      const mEff = mFreeAt(P, 0.7) + 0.3;
      while (t < 3) {
        if (pts.length) {
          const [tx, ty] = pts[0];
          const dx = tx - cur[0];
          const dy = ty - cur[1];
          const dd = Math.hypot(dx, dy);
          const st = SP * DT;
          if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
          else (cur = [tx, ty]), pts.shift();
          if (!pts.length) done = t;
        }
        setPad(P, cur[0], cur[1]);
        G.step();
        t += DT;
        const s = pointState(P, 0.7);
        if (s.s > peak) (peak = s.s), (peakQ = s.q);
        if (s.s > last) rising = true;
        else if (rising && last >= 6) (peaks++, peakList.push(`${last.toFixed(1)}×${s.q.toFixed(1)}`), (rising = false));
        last = s.s;
        if (done != null && t > done + 0.6) break;
      }
      const e = 0.5 * mEff * peak * peak * 2 * (W.power ?? 1) * (W.edged ? W.mCut : W.mBlunt);
      console.log(`| ${tech.name} | ${tech.kind} | ${len.toFixed(2)} | ${done?.toFixed(2) ?? '-'} | ${peak.toFixed(1)} | ${e.toFixed(0)} | ${(e * peakQ).toFixed(0)} | ${peaks} (${peakList.join(' ')}) |`);
    }
  }
} else if (mode === 'duel') {
  const N = +rest[0] || 6;
  const mainPath = rest[1] === 'main'; // 본판 길: MOTION.lib 켬 → Fighter·AI 생성자가 입힌다(자세표 바탕 = 무기별 표, 유파 = libSchool 병합). 끔(off)과 나란히 재는 데 쓴다
  if (mainPath) MOTION.lib = true;
  const on = rest[1] === 'on' || rest[1] === 'tech' || rest[1] === 'table' || mainPath; // on = 둘 다, tech = 기술 목록만, table = 자세표만
  const useTech = rest[1] === 'on' || rest[1] === 'tech';
  const useTable = rest[1] === 'on' || rest[1] === 'table';
  const m = motionFor(W);
  const skipTech = (process.env.SKIP_TECH ?? '').split(',').filter(Boolean);
  if (skipTech.length) m.tech = m.tech.filter((t) => !skipTech.includes(t.name));
  // AI 유파: 무기 꾸러미(없으면 롱소드)에 라이브러리 기술·속임수를 끼운다 — schools.js 는 건드리지 않는다
  const key = `${id}__lib`;
  const base = SCHOOLS[id] ?? SCHOOLS.longsword;
  SCHOOLS[key] = { ...base, id: key, tech: m.tech, techByName: Object.fromEntries(m.tech.map((t) => [t.name, t])), feints: m.feints, ...(m.counter ? { counter: m.counter } : {}), ...(useTable && m.parry && process.env.NO_PARRY !== '1' ? { parry: { ...base.parry, ...m.parry } } : {}) };
  const school0 = useTech || !useTable ? null : key; void school0;
  // 기술만: 라이브러리 기술 목록 · 자세표만: 자세표 + 그 표의 막기 자리 · 켬: 둘 다
  if (!useTech && useTable) SCHOOLS[key] = { ...base, id: key, ...(m.parry && process.env.NO_PARRY !== '1' ? { parry: { ...base.parry, ...m.parry } } : {}) };
  let school = useTech || useTable ? key : SCHOOLS[id] ? id : 'longsword'; // main: 유파 그대로(생성자 libSchool 이 더한다)
  if ((uqX.length || process.env.UQ_XPACK === '1') && traditionOf(W) === 'german') { // UQ_XPACK=1: 더할 것 없이 시험 쪽 꾸러미만 따로 만든다(대조군) // 독일 고유 동작: 시험 쪽 꾸러미에만 (상대 롱소드 꾸러미는 그대로)
    const k2 = `${school}__uq`;
    SCHOOLS[k2] = { ...mergeUnique(SCHOOLS[school], uqX), id: k2 };
    school = k2;
  }
  let Wn = 0, L = 0, D = 0, nan = 0, tSum = 0, tN = 0;
  // 기질 계기 (10/9 유파 기질 — docs/strike/school_temper_2026-10-09.md): 시험 쪽(X) AI 가 간 볼 때(mode 'watch')의 겉으로 보이는 버릇. 읽기만 한다(난수·물리에 손대지 않음)
  //  간 보기 시간·거리 칸(0.05 m, 중앙값용 — 평균은 상대가 쓰러졌을 때 등 멀리 선 몇 초에 끌려간다) · 옆걸음 시간(|move.x| > 0.05)·|move.x| 합 ·
  //  간 보기가 이어지는 동안 자세 바뀐 수(막기·공격 뒤 돌아오며 바뀐 것은 뺌) · 간격 끝(상대 칼 닿는 거리 foeReach + 0.5 m) 안에 든 때부터 첫 공격까지 걸린 시간
  //  간격 가까이(상대 칼 닿는 거리 + 1 m 안)에서 간 볼 때 상대 칼 닿는 거리 밖에 둔 여유(d − foeReach)의 시간 평균 — 성격 margin 이 바로 보이는 값
  const tmp = { wT: 0, cT: 0, cX: 0, gN: 0, rT: 0, rN: 0, rCut: 0, nT: 0, nD: 0, hist: new Array(200).fill(0) };
  const used = {};
  const feintUsed = {};
  const counterUsed = {};
  const pasFired = {};
  const pasRolls = {};
  let pasSkipped = 0;
  let pasList = null;
  let uqTrad = null; // 고유 동작 줄 (10/9 13:xx)
  // 비기·에너지 계기 (10/9 유파 비기): 시험 쪽 비기 stats.secrets 합 · 비기 동안 X 가 낸 상처 에너지(combat J) · 기술별 맞힘 에너지(상처 J) ·
  //  맞은 칼의 칼끝 추정 에너지 ½·m·v²(때린 쪽 칼끝 속도의 0.2 s 안 최고, 양쪽) — 독일 비기 문턱 lethalJ 를 고르는 분포. 읽기만 (난수·물리 무관)
  const secAgg = {};
  const secWound = {};
  let secName = null;
  let XAm = null;
  const techE = {};
  const geo = {}; // 닿는 순간 기하 (기술별)
  const offHit = { X: 0, Y: 0, Xall: 0 }; // 빈팔 맞음 계기 (10/10 빈팔 고증): 시험 쪽 빈팔(uarmO·farmO)에 난 상처 수 · 상대 빈팔 · 시험 쪽 모든 상처
  const falls = { all: 0, secret: 0, stance: 0 }; // 넘어짐 계기 (10/10 자세) — stance: 비기 자세(f.secretStance) 동안·뒤 1 s
  const breaks = { me: 0, foe: 0 }; // 칼 부러짐 계기 (10/10 2단계): 시험 쪽 · 상대
  const seqT = {}; // 여러 수 비기(연환삼격) 수마다 걸린 시간 (s): 수 이름 → [합, n] — 다음 수 시작 또는 비기 끝까지
  const hitMs = {}; // 기술별 칼 나감 → 첫 상처 ms (비기는 낸 때 → 첫 상처도)
  const estAll = [];
  const woundAll = [];
  // 기술 걸음 계기 (10/9 비껴 들어가 베기 — docs/strike/school_step_2026-10-09.md): step 칸 있는 기술과 같은 길의 공용 동작(대조)을 친 때마다
  //  ① 시작(걸음 받은 때, 없으면 베기 시작)과 ② 닿는 때(맞힘·맺힘 첫 프레임, 없으면 손이 길 끝에 닿은 때)의 '상대 칼 줄에서 내 가슴까지 수평 거리'(m)와
  //  '상대 정면과 상대→나 방향의 각'(도), 결과(맞힘/막힘/헛침 — 그 베기가 끝날 때 ai 의 hitLanded·bound, ai.js afterStrike 와 같은 가름), 걸음 받음/부탁(ai.js stats.techStep), 걸음 받은 뒤(대조는 베기 시작 뒤) 1 s 안 넘어짐. 넷째 줄 — 그 기술이 꾸러미에 없으면 찍지 않는다
  const stepRec = {}; // 이름 → newRec()
  let stepNames = null; // 잴 이름: step 기술 + 같은 길의 공용 동작
  const stepAgg = {};
  const newRec = () => ({ n: 0, off0: 0, ang0: 0, off1: 0, ang1: 0, falls: 0, steps: 0, landed: 0, parried: 0, missed: 0, lat: 0, fwd: 0 });
  const startOf = (me, nm, o, a, t0) => { // 시작 자리: 가슴 위치·몸 오른쪽·앞
    const c = me.bodies.chest.translation();
    return { name: nm, off0: o, ang0: a, done: false, t0, cx: c.x, cz: c.z, r: me.right(new THREE.Vector3()), f: me.forward(new THREE.Vector3()) };
  };
  const _sa = new THREE.Vector3(), _sb = new THREE.Vector3(), _sf = new THREE.Vector3();
  const lineOff = (me, foe) => { // 상대 칼(자루 → 칼끝) 수평 줄에서 내 가슴까지 거리, 상대 정면과 상대→나 사이 각(도)
    const c = me.bodies.chest.translation();
    foe.bladePoint(0, _sa);
    foe.bladePoint(1, _sb);
    const dx = _sb.x - _sa.x, dz = _sb.z - _sa.z;
    const L2 = dx * dx + dz * dz;
    const off = L2 < 1e-6 ? Math.hypot(c.x - _sa.x, c.z - _sa.z) : Math.abs((c.x - _sa.x) * dz - (c.z - _sa.z) * dx) / Math.sqrt(L2);
    const fp = foe.bodies.chest.translation();
    foe.forward(_sf);
    const ang = Math.abs(Math.atan2(_sf.x * (c.z - fp.z) - _sf.z * (c.x - fp.x), _sf.x * (c.x - fp.x) + _sf.z * (c.z - fp.z))) * 180 / Math.PI;
    return [off, ang];
  };
  for (let s = 1; s <= N; s++) {
    for (const xFirst of [true, false]) {
      const seed = (xFirst ? 1000 : 2000) + s + (+process.env.DUEL_SEED0 || 0); // DUEL_SEED0=24: 시드 25~48 (새 48 판, 기본 0)
      const x = { weapon: id, persona: { school } };
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const P = xFirst ? x : y;
      const E = xFirst ? y : x;
      const G = newRound({ walls: true, seed, weapon: P.weapon, weapon2: E.weapon, difficulty: 'normal', persona: E.persona, AI2Class: AI, difficulty2: 'normal', persona2: P.persona });
      const X = xFirst ? G.player : G.enemy;
      const Y = xFirst ? G.enemy : G.player;
      const XA = xFirst ? G.ai2 : G.ai;
      const pl = XA ? passiveList(XA) : null;
      if (pl) XA.passives = pl;
      if (XA && !pasList) pasList = XA.passives.map((x) => x.name);
      if (XA && !uqTrad) uqTrad = XA.art.tradition; // 고유 동작 줄
      if (XA && SECRET_X_OFF) XA.secret = null; // 대조: 시험 쪽만 비기 없음
      const YA = xFirst ? G.ai : G.ai2;
      if (XA) XA._missTo = missE.X;
      if (XA) XA._swOn = true;
      if (YA) YA._missTo = missE.Y;
      if (XA && !secName) secName = XA.secret?.name ?? '-';
      if (XA && !XAm) XAm = { ...XA.M };
      const tipRing = new Map([[X, []], [Y, []]]); // 칼끝 추정 에너지 최근 0.2 s
      G.onWound = (att, vic, r, _pt, pr) => {
        { const pt = pr?.v?.part; const oa = pt === 'uarmO' || pt === 'farmO'; if (vic === X) { offHit.Xall++; if (oa) offHit.X++; } else if (oa) offHit.Y++; }
        const est = Math.max(0, ...(tipRing.get(att) ?? [0]));
        estAll.push(est);
        woundAll.push(r.energy);
        if (att !== X || !XA) return;
        const sr = XA.secretRun;
        if (sr) (secWound[sr.S.name] ??= []).push(r.energy);
        if (XA.mode === 'attack' && ['oberhau', 'zornhau', 'zornhauL', 'talhoReves'].includes(XA.tech?.name) || (sr && XA.mode === 'attack')) {
          // 닿는 순간 기하 (10/9 3차): 가슴 거리 · 칼 팔꿈치 굽힘(위팔·아래팔 길이 축 사이 각) · 닿는 칼끝 속도 / 이 공격의 칼끝 최고 속도
          const ua = new THREE.Vector3(1, 0, 0).applyQuaternion(q4(X.bodies.uarmS.rotation()));
          const fa = new THREE.Vector3(1, 0, 0).applyQuaternion(q4(X.bodies.farmS.rotation()));
          const elb = deg(ua.angleTo(fa));
          const pkV = Math.sqrt((2 * (XA._pkE ?? 0)) / (X.swordProps?.m ?? 1.5));
          const ratio = pkV > 0 ? X.tipVel.length() / pkV : 0;
          const G2 = (geo[`${XA.tech?.name ?? '?'}${sr ? '★' : ''}`] ??= { n: 0, d: 0, elb: 0, r: 0, rel: 0, relN: 0 });
          G2.n++; G2.d += XA.d; G2.elb += elb; G2.r += ratio;
          if (sr?.releaseD != null) { G2.rel += sr.releaseD; G2.relN++; }
        }
        if (sr && process.env.SECRET_SEG === '1') console.log(`  [비기 상처] ${sr.S.name} ${XA.phase} 남은 길 ${XA.path.length} ${r.type} ${r.energy.toFixed(0)} J 칼끝 ${(0.5 * (X.swordProps?.m ?? 1.5) * X.tipVel.lengthSq()).toFixed(0)} J · 거리 ${XA.d.toFixed(2)} (contact ${XA.M.contact.toFixed(2)} reach ${XA.M.reach.toFixed(2)})`); // 비기 상처가 길 어디서 났나 (점검)
        // 순간 베기 (10/10 — secret_instant.js): 비기를 낸 그 스텝 끝에 상처가 난다 — 'goNoSenInstant★' 로 세고 낸 때 → 상처 ms 를 잰다
        const inst = !!(sr?.instant && sr.stage === 'instant');
        const tn = inst ? `${sr.S.name}Instant★` : XA.mode === 'attack' ? `${XA.tech?.name ?? '?'}${sr ? '★' : ''}` : `(${XA.mode})`;
        if (inst && !sr.instHitDone && XA._fireT != null) {
          sr.instHitDone = true;
          const H = (hitMs[tn] ??= { n: 0, ms: 0, fire: 0, fn: 0, v: 0 });
          const ms = (XA.sense.t - XA._fireT) * 1000;
          H.n++; H.ms += ms; H.fire += ms; H.fn++;
        }
        if (XA.mode === 'attack' && XA.phase !== 'windup' && XA.phase !== 'approach' && !XA._hitDone && XA._ssT != null) {
          XA._hitDone = true;
          const H = (hitMs[tn] ??= { n: 0, ms: 0, fire: 0, fn: 0, v: 0 });
          H.n++;
          H.ms += (XA.sense.t - XA._ssT) * 1000;
          H.v += X.tipVel.length();
          if (sr && XA._fireT != null) { H.fire += (XA.sense.t - XA._fireT) * 1000; H.fn++; }
        }
        (techE[tn] ??= []).push(r.energy);
        if (XA.mode === 'attack' || inst) {
          XA._sw ??= { tn, max: 0 };
          XA._sw.max = Math.max(XA._sw.max, r.energy);
        }
      };
      if (process.env.TWIST_MUL) X.twistScale *= +process.env.TWIST_MUL; // 점검: 날 세우기 힘 배율 (라이브러리와 별개)
      if (process.env.FORCE_FLOW === '1') installFlow(X); // 점검: 무기 쪽에만 흐름(이어 베기) — 두손 보통 틀(카타나 대리 = 롱소드)에 켜면 어떻게 되나
      if (useTable) applyMotionLibrary(X, { overlay: process.env.NO_OVERLAY !== '1', flow: process.env.NO_FLOW !== '1', noTwist: process.env.NOTWIST === '1', ai: XA, cover: process.env.COVER === '1' });
      let res = 'D';
      let lastTech = null;
      if (XA && !stepNames) {
        const T = XA.school.tech;
        const same = (a, b) => a.from === b.from && JSON.stringify(a.path) === JSON.stringify(b.path);
        stepNames = T.filter((t) => t.step).flatMap((t) => [t.name, ...T.filter((u) => !u.step && same(u, t)).map((u) => u.name)]);
      }
      let cur = null; // 지금 재는 베기 { name, off0, ang0, done }
      let stepN0 = 0, fallUntil = -1, fallName = null;
      let gPrev = null, wPrev = false, rIn = -1; // 기질 계기: 지난 스텝 자세 이름·간 보기였나 · 간격 끝 안에 든 시각(없으면 −1)
      let xPrevState = X.state; // 넘어짐 계기 (10/10 자세): 시험 쪽이 서 있다가 쓰러지거나 무릎 꿇은 수 · 비기 동안·직후(1 s) 몫
      for (let i = 0; i < 40 / DT; i++) {
        G.step();
        if (xPrevState === 'stand' && (X.state === 'down' || X.state === 'getup')) {
          falls.all++;
          if (XA?.secretRun || (XA && XA._secEnd != null && G.t - XA._secEnd < 1)) falls.secret++;
          if (X.secretStance || (X._stEnd != null && G.t - X._stEnd < 1)) falls.stance++;
        }
        if (X.secretStance) X._stEnd = G.t;
        { const run = XA?.secretRun; const tn = run && XA.secret?.do?.seq ? XA.tech?.name : null; // 수 바뀜 = 다음 수 시작
          if (XA && XA._seqCur && XA._seqCur.n !== tn) { const A = (seqT[XA._seqCur.n] ??= [0, 0]); A[0] += G.t - XA._seqCur.t; A[1]++; XA._seqCur = null; }
          if (XA && tn && !XA._seqCur) XA._seqCur = { n: tn, t: G.t }; }
        if (XA?.secretRun) XA._secEnd = G.t;
        xPrevState = X.state;
        if (X.weaponBroken && !X._brkSeen) { X._brkSeen = true; breaks.me++; }
        if (X.foe?.weaponBroken && !X.foe._brkSeen) { X.foe._brkSeen = true; breaks.foe++; }
        for (const [f, ring] of tipRing) { // 칼끝 추정 에너지 ½·m·v² (0.2 s = 24 스텝)
          const v = f.tipVel;
          const e = 0.5 * (f.swordProps?.m ?? 1.5) * (v.x * v.x + v.y * v.y + v.z * v.z);
          ring.push(e);
          if (ring.length > 24) ring.shift();
          const A = f === X ? XA : f === Y ? (xFirst ? G.ai : G.ai2) : null;
          if (A && A.mode === 'attack') A._pkE = Math.max(A._pkE ?? 0, e);
        }
        if (XA) { // 기질 계기 (읽기만)
          const d = XA.d, w = XA.mode === 'watch';
          if (w && G.t > 2) {
            tmp.wT += DT; tmp.hist[Math.min(199, Math.floor(d * 20))] += DT;
            if (d < XA.foeReach + 1) { tmp.nT += DT; tmp.nD += (d - XA.foeReach) * DT; }
            const mx = Math.abs(X.move.x);
            if (mx > 0.05) tmp.cT += DT;
            tmp.cX += mx * DT;
          }
          const gn = XA.guard?.name ?? null;
          if (w && wPrev && G.t > 2 && gPrev && gn && gn !== gPrev) tmp.gN++;
          gPrev = gn; wPrev = w;
          const edge = XA.foeReach + 0.5;
          if (rIn < 0 && w && d < edge) rIn = G.t;
          else if (rIn >= 0 && XA.mode === 'attack') { tmp.rT += G.t - rIn; tmp.rN++; rIn = -1; }
          else if (rIn >= 0 && d > edge + 0.3) { tmp.rCut++; rIn = -1; } // 치지 않고 다시 멀어짐
        }
        if (stepNames?.length && XA) {
          const nm = XA.tech?.name;
          if ((XA.techStepN ?? 0) !== stepN0) { // 기술 걸음을 다리가 받았다 → 시작 자리를 여기서
            stepN0 = XA.techStepN;
            fallUntil = G.t + 1;
            fallName = nm;
            (stepRec[nm] ??= newRec()).steps++;
            const [o, a] = lineOff(X, Y);
            cur = startOf(X, nm, o, a, XA.attackT);
          }
          if (fallUntil > 0 && X.state !== 'stand') { (stepRec[fallName] ??= newRec()).falls++; fallUntil = -1; }
          if (fallUntil > 0 && G.t > fallUntil) fallUntil = -1;
          const live = cur && XA.mode === 'attack' && XA.tech?.name === cur.name && XA.attackT >= cur.t0;
          if (cur && !live) { // 이 베기가 끝났다(다른 기술·다른 마음) → 결과를 센다 (닿기 전에 거뒀으면 세지 않는다)
            if (cur.done) { const R = stepRec[cur.name]; R[cur.hl ? 'landed' : cur.bd ? 'parried' : 'missed']++; }
            cur = null;
          }
          if (!cur && XA.mode === 'attack' && XA.phase === 'strike' && stepNames.includes(nm)) {
            const [o, a] = lineOff(X, Y);
            cur = startOf(X, nm, o, a, XA.attackT);
            if (fallUntil < 0) { fallUntil = G.t + 1; fallName = nm; } // 대조(공용 동작)도 베기 시작 뒤 1 s 넘어짐을 센다
          }
          if (cur && !cur.done && (XA.hitLanded || XA.bound || XA.phase === 'follow')) {
            const [o, a] = lineOff(X, Y);
            const R = (stepRec[cur.name] ??= newRec());
            R.n++; R.off0 += cur.off0; R.ang0 += cur.ang0; R.off1 += o; R.ang1 += a;
            const c = X.bodies.chest.translation(); // 시작부터 닿을 때까지 가슴이 옮긴 거리 — 시작 때 몸 기준 옆(오른쪽 +)·앞
            const sg = Math.sign(XA.tech?.step?.lat ?? 1) || 1; // 기술 걸음 쪽을 + 로 (공용 동작은 오른쪽 +)
            R.lat += sg * ((c.x - cur.cx) * cur.r.x + (c.z - cur.cz) * cur.r.z);
            R.fwd += (c.x - cur.cx) * cur.f.x + (c.z - cur.cz) * cur.f.z;
            cur.done = true;
          }
          if (cur?.done) { cur.hl = XA.hitLanded; cur.bd = XA.bound; }
        }
        const tn = XA?.tech?.name;
        if (tn && tn !== lastTech && XA.phase === 'strike') used[tn] = (used[tn] ?? 0) + 1;
        if (tn && tn !== lastTech && XA.phase === 'strike' && XA.feint) feintUsed[XA.feint.name] = (feintUsed[XA.feint.name] ?? 0) + 1; // 속임수(가짜 기술 이름으로 위에 세어진 것 가운데)
        if (tn && tn !== lastTech && XA.phase === 'strike' && XA.why === 'counter') counterUsed[tn] = (counterUsed[tn] ?? 0) + 1; // 맞받아 베기로 고른 것
        lastTech = XA?.phase === 'strike' ? tn : null;
        const v = X.sword.linvel();
        if (![v.x, v.y, v.z].every(Number.isFinite)) { nan++; break; }
        const xd = X.state === 'dead';
        const yd = Y.state === 'dead';
        if (xd || yd) {
          res = xd && yd ? 'D' : yd ? 'W' : 'L';
          tSum += G.t;
          tN++;
          break;
        }
      }
      if (XA) swFlush(XA);
      if (res === 'W') Wn++;
      else if (res === 'L') L++;
      else D++;
      for (const [k, v] of Object.entries(XA?.stats.passives ?? {})) pasFired[k] = (pasFired[k] ?? 0) + v;
      for (const [k, v] of Object.entries(XA?.stats.passiveRolls ?? {})) pasRolls[k] = (pasRolls[k] ?? 0) + v;
      pasSkipped += XA?.stats.passiveSkipped ?? 0;
      for (const [k, v] of Object.entries(XA?.stats.secrets ?? {})) {
        const A = (secAgg[k] ??= { fired: 0, landed: 0, E: 0, Emax: 0 });
        A.fired += v.fired;
        A.landed += v.landed;
        A.E += v.E;
        A.Emax = Math.max(A.Emax, v.Emax);
        A.blocked = (A.blocked ?? 0) + (v.blocked ?? 0);
      }
      for (const [k, v] of Object.entries(XA?.stats.techStep ?? {})) {
        const A = (stepAgg[k] ??= { req: 0, ok: 0 });
        for (const f of Object.keys(A)) A[f] += v[f] ?? 0;
      }
    }
  }
  const n = 2 * N;
  const [lo, hi] = wilson(Wn, n);
  const pc = (v) => `${Math.round(100 * v)}%`;
  const top = Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, process.env.USED_ALL === '1' ? 99 : 14).map(([k, v]) => `${k} ${v}`).join(', ');
  console.log(`${id} 라이브러리 ${mainPath ? '본판(켬)' : on ? (useTech && useTable ? '켬' : useTech ? '기술만' : '자세표만') : '끔'} (${m.frame}·${m.style}) 승 ${Wn} 패 ${L} 무 ${D} / ${n} · 승률 ${pc(Wn / n)} (95% ${pc(lo)}~${pc(hi)}) · 평균 종료 ${tN ? (tSum / tN).toFixed(1) : '-'}s · NaN ${nan} · 쓴 기술: ${top}`);
  console.log(`  넘어짐 (시험 쪽 서 있다 쓰러짐·무릎): 모두 ${falls.all} · 비기 동안·뒤 1 s ${falls.secret} · 비기 자세 동안·뒤 1 s ${falls.stance}`);
  console.log(`  칼 부러짐: 시험 쪽 ${breaks.me} · 상대 ${breaks.foe}`);
  console.log(`  빈팔 맞음 (uarmO·farmO 상처): 시험 쪽 ${offHit.X} / 시험 쪽 모든 상처 ${offHit.Xall} · 상대(롱소드) ${offHit.Y}`);
  if (Object.keys(seqT).length) console.log(`  비기 수마다 시간 (s, 다음 수 시작·끝까지): ${Object.entries(seqT).map(([k, [t, n]]) => `${k} ${(t / n).toFixed(2)} (n${n})`).join(' · ')}`);
  const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '-';
  console.log(`  속임수: ${fmt(feintUsed)} · 맞받아 베기: ${fmt(counterUsed)}`); // 둘째 줄 (10/9 고유 동작 단계 — 첫 줄은 전과 같다)
  // 셋째 줄 (10/9 패시브 단계): 시험 쪽 패시브 — 이름 낸 수/굴린 수, 기술 없음 건너뜀
  console.log(`  패시브 [${(pasList ?? []).join(',') || '없음'}]: ${(pasList ?? []).map((k) => `${k} ${pasFired[k] ?? 0}/${pasRolls[k] ?? 0}`).join(', ') || '-'}${pasSkipped ? ` · 건너뜀 ${pasSkipped}` : ''}`);
  // 고유 동작 줄 (10/9 13:xx 패시브 확정 — docs/strike/passive_fire_2026-10-09.md): 시험 쪽 유파 고유 동작(길·속임수, 켠 것)이 칼을 낸 수
  const uqT = TRADITIONS[uqTrad]?.unique ?? [];
  console.log(`  고유 동작 [${uqTrad ?? '-'}]: ${uqT.filter((u) => !u.counter && u.ai !== false).map((u) => (u.feint ? `${u.name} ${feintUsed[u.feint.name] ?? 0}` : `${u.name} ${used[u.name] ?? 0}`)).join(', ') || '-'}`);
  // 비기 줄 (10/9 유파 비기): 이름 낸/맞힘 · 비기 동안 낸 상처 에너지(combat J) 평균·최대 (상처 수) · 맞힌 비기의 칼끝 추정 에너지(½·m·v²) 평균·최대
  {
    const A = secAgg[secName] ?? { fired: 0, landed: 0, E: 0, Emax: 0 };
    const W = secWound[secName] ?? [];
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
    const mx = (a) => (a.length ? Math.max(...a) : 0);
    console.log(`  비기 [${secName ?? '-'}]: ${secName && secName !== '-' ? `낸 ${A.fired} / 맞힘 ${A.landed}${A.blocked ? ` · 막혀 밀어냄 ${A.blocked}` : ''} · 상처 에너지 평균 ${avg(W).toFixed(0)} J · 최대 ${mx(W).toFixed(0)} J (상처 ${W.length}) · 칼끝 추정 평균 ${A.landed ? (A.E / A.landed).toFixed(0) : '-'} J · 최대 ${A.Emax.toFixed(0)} J` : '-'}`);
    // 기술별 맞힘 에너지 (상처 J): 상처 수 많은 순 12 + 비기(★)·真向(oberhau)·altibaixo 는 늘
    const rows = Object.entries(techE).sort((a, b) => b[1].length - a[1].length);
    const keep = new Set(rows.slice(0, 12).map(([k]) => k));
    for (const [k] of rows) if (k.endsWith('★') || k === 'oberhau' || k === 'altibaixo') keep.add(k);
    console.log(`  맞힘 에너지 (상처 J 평균/최대 n): ${rows.filter(([k]) => keep.has(k)).map(([k, a]) => `${k} ${avg(a).toFixed(0)}/${mx(a).toFixed(0)} n${a.length}`).join(', ') || '-'}`);
    const swRows = Object.entries(swingMax).filter(([k]) => k.endsWith('★') || ['oberhau', 'zornhau', 'altibaixo', 'zornhauL', 'stichPflug', 'passataSotto'].includes(k));
    console.log(`  한 칼 최고 상처 (J 평균/최대 n칼): ${swRows.sort((a, b) => b[1].length - a[1].length).map(([k, a]) => `${k} ${avg(a).toFixed(0)}/${mx(a).toFixed(0)} n${a.length}`).join(', ') || '-'}`);
    const hm = Object.entries(hitMs).filter(([k, h]) => k.endsWith('★') || h.n >= 5).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    console.log(`  닿기까지 (칼 나감 → 첫 상처 ms · 그때 칼끝 m/s, 비기는 낸 때 → 첫 상처 ms): ${hm.map(([k, h]) => `${k} ${(h.ms / h.n).toFixed(0)} ms · ${(h.v / h.n).toFixed(1)} m/s${h.fn ? ` · 낸 때부터 ${(h.fire / h.fn).toFixed(0)} ms` : ''} (n${h.n})`).join(' | ') || '-'}`);
    console.log(`  닿는 순간 (거리 m · 칼 팔꿈치 굽힘 ° · 칼끝 속도/그 공격 최고 · 터뜨린 때 닿을 거리): ${Object.entries(geo).sort((a, b) => b[1].n - a[1].n).map(([k, g]) => `${k} ${(g.d / g.n).toFixed(2)} m · ${(g.elb / g.n).toFixed(0)}° · ${(g.r / g.n).toFixed(2)}${g.relN ? ` · 터뜨림 ${(g.rel / g.relN).toFixed(2)}` : ''} (n${g.n})`).join(' | ') || '-'} · 맞닿기 ${XAm?.contact?.toFixed(2) ?? '-'} reach ${XAm?.reach?.toFixed(2) ?? '-'}`);
    const pq = (a, q) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(q * b.length))] : 0; };
    console.log(`  헛친 칼 칼끝 추정 ½mv² (공격 최고, 맞힘·맞물림 없음): 시험 쪽 n ${missE.X.length} p50 ${pq(missE.X, 0.5).toFixed(0)} · p75 ${pq(missE.X, 0.75).toFixed(0)} J · 상대(롱소드) n ${missE.Y.length} p25 ${pq(missE.Y, 0.25).toFixed(0)} · p50 ${pq(missE.Y, 0.5).toFixed(0)} · p75 ${pq(missE.Y, 0.75).toFixed(0)} J`);
    console.log(`  에너지 분포 (맞은 칼 양쪽 n ${estAll.length}): 칼끝 추정 ½mv² p50 ${pq(estAll, 0.5).toFixed(0)} · p75 ${pq(estAll, 0.75).toFixed(0)} · p90 ${pq(estAll, 0.9).toFixed(0)} J · 상처 J p50 ${pq(woundAll, 0.5).toFixed(0)} · p75 ${pq(woundAll, 0.75).toFixed(0)} · p90 ${pq(woundAll, 0.9).toFixed(0)}`);
  }
  // 기질 줄 (10/9 유파 기질): 간 보는 거리 중앙값 · 옆걸음 비율(|move.x| > 0.05)·평균 |move.x| · 간 보는 1 분당 자세 바꿈 · 간격 끝 안에 든 뒤 첫 공격까지(초, n · 치지 않고 물러난 수)
  let med = 0;
  for (let i = 0, acc = 0; i < tmp.hist.length; i++) if ((acc += tmp.hist[i]) >= tmp.wT / 2) { med = (i + 0.5) / 20; break; }
  console.log(`  기질: 간 보기 거리 ${tmp.wT ? med.toFixed(2) : '-'} m (간격 가까이 여유 ${tmp.nT ? (tmp.nD / tmp.nT).toFixed(2) : '-'} m, ${tmp.wT ? pc(tmp.nT / tmp.wT) : '-'}) · 옆걸음 ${tmp.wT ? pc(tmp.cT / tmp.wT) : '-'} (|x| ${tmp.wT ? (tmp.cX / tmp.wT).toFixed(2) : '-'}) · 자세 바꿈 ${tmp.wT ? (tmp.gN / (tmp.wT / 60)).toFixed(1) : '-'}/분 · 간격 끝 → 첫 공격 ${tmp.rN ? (tmp.rT / tmp.rN).toFixed(2) : '-'} s (n ${tmp.rN}, 물러남 ${tmp.rCut}) · 간 보기 ${tmp.wT.toFixed(0)} s`);
  if (stepNames?.length) {
    // 넷째 줄 (10/9 기술 걸음): 이름 쓴 수 · 걸음 받음/부탁 · 결과 맞힘/막힘/헛침 · 칼 줄 거리 시작→닿을 때(m) · 상대 정면 각 시작→닿을 때(도) · 걸음(대조는 베기 시작) 뒤 1 s 넘어짐 · 시작→닿을 때 가슴 옮김(시작 때 몸 기준, 걸음 쪽 +)
    const f2 = (v) => v.toFixed(2);
    const cell = (k) => {
      const R = stepRec[k];
      const A = stepAgg[k];
      const geo = R?.n ? ` · 줄 ${f2(R.off0 / R.n)}→${f2(R.off1 / R.n)} m · 각 ${(R.ang0 / R.n).toFixed(0)}→${(R.ang1 / R.n).toFixed(0)}° · 가슴 옮김 옆 ${f2(R.lat / R.n)} 앞 ${f2(R.fwd / R.n)} m (n ${R.n})` : '';
      const st = (A ? ` · 걸음 받음 ${A.ok}/${A.req}` : '') + ` · 1 s 안 넘어짐 ${R?.falls ?? 0}` + (R?.n ? ` · 맞힘/막힘/헛침 ${R.landed}/${R.parried}/${R.missed}` : '');
      return `${k} ${used[k] ?? 0}${st}${geo}`;
    };
    console.log(`  기술 걸음: ${stepNames.map(cell).join(' | ')}`);
  }
} else if (mode === 'tap') {
  // 탭 찌르기 한 번 (상대는 치움): 칼끝이 내 가슴에서 앞으로 가장 멀리 간 거리, 그때까지 걸린 시간, 칼끝 최고 속도, 몸 낮춤.
  //  자세(패드)마다 한 번씩: 쟁기·긴 자세·황소. 라이브러리 끔/켬(켬이면 무기 방식의 덧씌우기 — 찌르기 방식은 런지)
  console.log(`${id} (${motionFor(W).frame}·${motionFor(W).style}) — 탭 찌르기: 칼끝 최대 앞 거리 m · 걸린 초 · 칼끝 최고 속도 m/s · 가슴 최대 낮춤 cm · 왕복 초(뻗은 거리의 80%를 되돌아오기까지)`);
  console.log('| 자세 | 끔: 거리 | 초 | 속도 | 낮춤 | 왕복 | 켬: 거리 | 초 | 속도 | 낮춤 | 왕복 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [nm, pad] of [['쟁기', [0.18, -0.28]], ['긴 자세', [0.0, 0.03]], ['황소', [0.22, 0.26]]]) {
    const cells = [];
    for (const lib of [false, true]) {
      // 상대를 치우면 찌를 대상(foe)이 없어 탭이 안 나간다 → 가만히 세워 둔다(AI 끔). 시작 간격이 칼끝 거리보다 멀다
      const G = newRound({ walls: false, weapon: id, weapon2: 'longsword', seed: 7 });
      G.ai.update = () => {};
      const P = G.player;
      if (lib) applyMotionLibrary(P);
      setPad(P, pad[0], pad[1]);
      for (let t = 0; t < 1.0; t += DT) G.step();
      const gap = P.bodies.chest.translation();
      const fc = P.foe.bodies.chest.translation();
      if (nm === '쟁기' && !lib) console.log(`(가슴 사이 거리 ${Math.hypot(gap.x - fc.x, gap.z - fc.z).toFixed(2)} m)`);
      const c0 = P.bodies.chest.translation();
      const fwd = P.forward(new THREE.Vector3());
      const y0 = c0.y;
      P.skill.thrust();
      let best = 0, tBest = 0, vmax = 0, low = 0, d0 = null, tBack = null;
      for (let t = 0; t < 1.5; t += DT) {
        G.step();
        const tip = P.bladePoint(1, new THREE.Vector3());
        const d = tip.clone().sub(new THREE.Vector3(c0.x, c0.y, c0.z)).dot(fwd);
        if (d0 === null) d0 = d;
        if (t <= 0.9 && d > best) (best = d), (tBest = t);
        if (tBack === null && t > tBest && best > d0 + 0.05 && d < best - 0.8 * (best - d0)) tBack = t;
        if (t > 0.9) continue; // 거리·속도·낮춤은 예전처럼 0.9초 안에서만 (왕복만 1.5초까지 본다)
        const pt = P.bladePoint(1, new THREE.Vector3());
        const u = P.sword.velocityAtPoint(pt);
        vmax = Math.max(vmax, Math.hypot(u.x, u.y, u.z));
        low = Math.max(low, y0 - P.bodies.chest.translation().y);
      }
      cells.push(`${best.toFixed(2)} | ${tBest.toFixed(2)} | ${vmax.toFixed(1)} | ${(low * 100).toFixed(0)} | ${tBack === null ? '-' : tBack.toFixed(2)}`);
    }
    console.log(`| ${nm} | ${cells[0]} | ${cells[1]} |`);
  }
} else if (mode === 'parry') {
  // 막기 자리 찾기 (롱소드 유파 parry 표를 고른 방법과 같다: 공격 줄 × 자세를 물리로 부딪쳐 본다).
  //  자세표가 바뀌면 "어느 패드가 어느 줄을 막나"도 바뀐다 → 몸 틀 표마다 다시 찾아야 한다(10라운드 규칙 발견, docs/weapon_motions.md).
  //  막는 쪽 = 이 무기(라이브러리 켬/끔), 치는 쪽 = 롱소드(스크립트로 기술 길을 11 m/s 로). 간격 1.45·1.6 m, 패드 14 곳
  const lib = rest[0] !== 'off';
  const LINES = [['highL', 'zornhau'], ['highR', 'zornhauL'], ['highC', 'oberhau'], ['lowL', 'unterhau'], ['lowR', 'unterhauL'], ['thrust', 'stichPflug']];
  const SPD = 11;
  const res = {};
  for (const [line, tn] of LINES) {
    const tech = TECH.find((t) => t.name === tn);
    const rows = [];
    for (let i = 0; i < GUARD_BASE.length; i++) {
      let hit = 0, eSum = 0, clash = 0;
      const GAPS = process.env.PARRY_WIDE === '1' ? [1.3, 1.45, 1.6, 1.75] : [1.45, 1.6];
      const SEEDS = process.env.PARRY_WIDE === '1' ? [7, 8, 9] : [7];
      for (const [gap, seed] of GAPS.flatMap((g) => SEEDS.map((sd) => [g, sd]))) {
        const G = newRound({ walls: false, weapon: 'longsword', weapon2: id, seed, gap });
        G.ai.update = () => {};
        const A = G.player;
        const D = G.enemy;
        if (lib) applyMotionLibrary(D);
        const pd = GUARD_BASE[i].pad;
        setPad(D, pd[0], pd[1]);
        setPad(A, tech.from[0], tech.from[1]);
        for (let t = 0; t < 0.8; t += DT) G.step();
        const pts = tech.path.map((q) => q.slice());
        let cur = tech.from.slice();
        const w0 = G.wounds.length;
        const c0 = G.clashes ?? 0;
        for (let t = 0; t < 1.0; t += DT) {
          if (pts.length) {
            const [tx, ty] = pts[0];
            const dx = tx - cur[0], dy = ty - cur[1], dd = Math.hypot(dx, dy), st = SPD * DT;
            if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
            else (cur = [tx, ty]), pts.shift();
          }
          setPad(A, cur[0], cur[1]);
          if (tech.kind === 'thrust' && t < DT) A.skill.thrust({ step: false });
          G.step();
        }
        const ws = G.wounds.slice(w0).filter((w) => w.att === A);
        if (ws.length) hit++;
        eSum += ws.reduce((a, w) => a + (w.energy ?? w.E ?? 0), 0);
        clash += (G.clashes ?? 0) - c0;
      }
      rows.push({ i, hit, eSum, clash });
    }
    rows.sort((a, b) => a.hit - b.hit || b.clash - a.clash || a.eSum - b.eSum);
    res[line] = rows;
    const nm = (i) => {
      const { G: g2, P } = soloRound(lib);
      void g2;
      return P.guardPose.table?.[i]?.name ?? GUARD_BASE[i].name;
    };
    console.log(`${line} (${tn}): 가장 잘 막은 자세 ${rows.slice(0, 3).map((r) => `${nm(r.i)}[패드 ${GUARD_BASE[r.i].pad}] 맞음 ${r.hit} 칼부딪침 ${r.clash}`).join(' · ')}`);
  }
  const pick = Object.fromEntries(Object.entries(res).map(([k, rows]) => [k, GUARD_BASE[rows[0].i].pad]));
  console.log(`parry 표 제안 (${id}, 라이브러리 ${lib ? '켬' : '끔'}): ${JSON.stringify(pick)}`);
} else {
  console.log('모드: poses | swings | duel | tap | parry');
}
void TECH;
