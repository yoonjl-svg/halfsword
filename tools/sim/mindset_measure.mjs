// ─────────────────────────────────────────────────────────────
//  mindset_measure.mjs — 유파 마음가짐 (가칭 · 11/18 — 설계 docs/design/school_mindset_2026-11-18.md · 기록 docs/strike/school_mindset_2026-11-18.md)
//   '명확히 반영'을 재는 도구 (설계 §4 잣대): 유파 AI 하나 대 같은 중립 상대 하나 — 다섯 유파 모두 같은 상대.
//   중립 상대 = 무유파 AI (롱소드 · 기질 · 플랜 · 칸 몫 모두 무유파 — 이 도구 판에서만 꾸러미 'mindset_none' = 롱소드 꾸러미의 유파를 'none' 으로) · 같은 숙련도.
//   그 유파 대표 무기 둘 × 씨앗 × 자리 둘 (재는 쪽이 플레이어 자리 · 상대 자리) · 두 자리 겉모습 같게 (LOOKS.enemy) · 실력 이름은 숙련도 표 (게임과 같음).
//   한 판 = dur 게임 초 또는 한쪽이 쓰러질 때까지. 재는 것은 재는 쪽(유파 AI)의 행동 — 이김 · 짐은 참고.
//
//   항목마다 지표 (모두 두 몸이 서 있고 칼을 쥔 동안):
//    선공   open  : 고요한 때(상대가 공격 · 막기 꼴이 아니고 마지막 공격이 0.4 s 넘게 지남) 새로 연 주고받기 가운데 재는 쪽이 연 몫 ★
//           first : 첫 주고받기를 재는 쪽이 연 판 몫 · t1 : 재는 쪽 첫 공격 때 (s)
//    거리   gap   : 재는 쪽이 간 보기 · 물러남 꼴인 동안 (가슴 사이 − 상대 칼끝 거리) 가운데 값 m ★ · close : 가슴 사이 1 m 안 몫
//    집요함 follow: 상대가 물러나는 동안(0.3 m/s 넘게 — 재는 쪽 간 보기 · 물러남 꼴) 재는 쪽이 따라 다가간 빠르기 ÷ 상대가 물러난 빠르기 ★
//           press : 상대가 약할 때(지침 · 피를 더 흘림 · 물러남) 공격을 여는 빠르기 ÷ 아닐 때 빠르기
//    일격   big   : 칼을 낸 공격 가운데 큰 칼 몫 — 머리 · 어깨 위(준비 자리 높이 ≥ 0.35)에서 내리는 베기(빠른 칼 아님) · 비기 ★
//           chain : 이어 치기 몫 (낮을수록 일격) · eHit : 맞힌 칼 하나의 판정 에너지 J (무기 몫이 섞임 — 참고)
//    횡보   lat   : 간 보기 · 물러남 꼴 걸음 가운데 옆(상대 쪽 줄에 수직) 몫 ★ · orbit : 상대 둘레를 돈 빠르기 °/s
//   ★ = 판정 지표 (다섯 유파 순위가 점수 순위와 같고 5 점 · 1 점 차가 구간 밖으로 뚜렷해야 — 같은 점수는 어느 쪽이든)
//
//  node tools/sim/mindset_measure.mjs run [--schools=german,…] [--seeds=1-30] [--dur=40] [--prof=4] [--json=out.json] [--resume] [--shard=i/n] [--cfg=PATH:수,…]
//   판 5 개마다 --json 파일을 갈아 씀 (컨테이너가 다시 서도 남게) · --resume 이면 그 파일에 있는 판(번호 k)은 건너뜀 (옵션은 같게)
//  node tools/sim/mindset_measure.mjs agg a.json … [--before=b.json,…] [--md]   항목 표 (유파마다 지표 · 순위 · 95 % 구간 · 합격)
//  node tools/sim/mindset_measure.mjs rr [--seeds=1-12] [--dur=60] [--prof=4] [--json=..] [--resume] [--shard=i/n]   다섯 유파 맞대결 (짝 열 × 무기 넷 × 씨앗 × 자리 엇갈림)
//  node tools/sim/mindset_measure.mjs rragg a.json …                              5 × 5 표 (줄 쪽 이김 몫 — 이김 + 비김 ½)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { newRound, AI, DT } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { applyCfgArgs } from './cfg_override.mjs';
import { AI_PROFICIENCY } from '../../src/config.js';
import { LOOKS } from '../../src/looks.js';
import { SCHOOLS as PKGS } from '../../src/schools.js';
import { huntN } from '../../src/cn_hunt.js';

export const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
export const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };
export const WEAPONS = { german: ['longsword', 'kriegsmesser'], italian: ['rapier', 'pappenheimer'], iberian: ['zweihander', 'flamberge'], japanese: ['uchigatana', 'monohoshizao'], chinese: ['hwando', 'qinggang'] };
/** 설계 §2 점수 (도구가 순위를 견줄 잣대 — 게임 값은 config MINDSET) */
export const SCORE = {
  initiative: { german: 5, italian: 2, iberian: 4, japanese: 1, chinese: 3 },
  distance: { german: 1, italian: 5, iberian: 4, japanese: 2, chinese: 3 },
  tenacity: { german: 2, italian: 4, iberian: 3, japanese: 1, chinese: 5 },
  decisive: { german: 3, italian: 2, iberian: 5, japanese: 4, chinese: 1 },
  lateral: { german: 2, italian: 1, iberian: 5, japanese: 3, chinese: 4 },
};
export const AXIS_KO = { initiative: '선공', distance: '거리', tenacity: '집요함', decisive: '일격', lateral: '횡보' };

// 중립 상대 꾸러미 (이 프로세스 안에서만): 롱소드 꾸러미 그대로 · 유파만 무유파 — 기질(NONE_TEMPER) · 플랜(무유파) · 고유 동작 · 패시브 · 비기 · 칸 몫 모두 무유파 몫
const NEUTRAL = 'mindset_none';
if (!PKGS[NEUTRAL]) PKGS[NEUTRAL] = { ...PKGS.longsword, id: NEUTRAL, tradition: 'none' };

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => s.split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
const out = (f) => !f.alive || f.state === 'dead';
const ATK = new Set(['attack', 'secret']);
const CALM = new Set(['watch', 'withdraw']);
/** 상대 몸짓에 답한 칼 (공격 이유 ai.why): 맞받기 · 되받기 · 달려듦 맞받기 · 偏閃奏進(칼을 봄) · 헛친 뒤 · 파고들기 · 붙어 밂 · 들어옴 · 칼 듦 — 먼저 친 칼이 아님 */
export const ANSWER = new Set(['counter', 'riposte', 'stop', 'dive', 'recover', 'dig', 'press', 'stepin', 'windup', 'follow']);
/** 먼저 친 칼 (공격 이유): 참다 · 칼끝 비킴 · 다침 · 기우뚱 · 유도 끝 들어감 · 비스듬히 들어감 · 쳐내며 들어감 — 쓰러진 상대(finish) · 이어 치기 · 비기는 어느 쪽도 아님 */
export const FIRST = new Set(['patience', 'open', 'weak', 'offbalance', 'lure', 'slant', 'beat']);
const GAP_BIN = 0.05; // 거리 띠 (m)
const GAP_LO = -2; // 띠 시작 (m — 상대 칼끝에서)
const GAP_N = 100;
const WIN = 0.2; // 걸음 창 (s — 골반 자리 차 · 걸음 출렁임을 거름)
const MOVE_MIN = 0.04; // 창 하나에 이만큼(m) 넘게 움직였으면 걸음 (0.2 m/s)
/** 큰 칼 (일격 지표 — 칼을 낸 기술): 머리 · 어깨 높이(준비 자리 ≥ 0.35)에서 크게 드는 칼 (베기 · 높이 든 찌르기 — 빠른 칼 아님) · 비기는 따로 셈 */
export const bigTech = (t) => !t.fast && (t.from?.[1] ?? 0) >= 0.35;

/** 상대 상태 (재는 도구의 참 값 — 게임 AI 가 읽는 것과 같은 표식 · 문턱만 도구 몫): 판 하나에 한 칸씩 [시간 · 고요 · 거리 합 · 연 주고받기 나 · 상대 · 낸 칼 · 큰 칼 · 옆 · 앞뒤 · 준 심각도] */
export const FSTATES = ['base', 'disarmed', 'tired', 'bleed', 'leg', 'arm', 'cool'];
const SK = { T: 0, calmT: 1, gapSum: 2, openS: 3, openN: 4, strikes: 5, big: 6, lat: 7, rad: 8, sev: 9, sLat: 10, sRad: 11, pro: 12, ans: 13, watchT: 14, gapW: 15, contT: 16, gapC: 17 };
const SN = 18;
const VULN = ['disarmed', 'tired', 'cool']; // 상대 약한 틈 (집요함 몫 재기 — 칼 떨어짐 · 지침 · 본 특수 공격 · 비기 뒤)
const loss = (f) => 1 - f.blood + f.bleed * 8;

/**
 * 상태 들임 (재기 전용 — 집요함 반응 재기): 처음 맞닿은 뒤 상대 몸을 그 상태로 묶음 (매 스텝) — bleed 피를 더 흘림(피 0.75 아래 · 초당 0.012) · tired 탈진 ·
 *  leg 두 다리 기능 0.35 · arm 칼 팔 기능 0.5 (칼은 쥠) · disarmed 칼 떨어뜨림(한 번 — 주우면 끝) · cool 4 s 마다 '특수 공격이 나감' 몸 셈 (상대 몸은 아무 일도 안 함)
 */
function induceState(O, k, t) {
  if (k === 'bleed') { O.blood = Math.min(O.blood, 0.75); O.bleed = Math.max(O.bleed, 0.012); }
  else if (k === 'tired') O.stamina.exhaustLeft = Math.max(O.stamina.exhaustLeft, 0.5);
  else if (k === 'leg') { O.limbs.legF = Math.min(O.limbs.legF, 0.35); O.limbs.legB = Math.min(O.limbs.legB, 0.35); }
  else if (k === 'arm') O.limbs.armS = Math.min(O.limbs.armS, 0.5);
  else if (k === 'disarmed') { if (!O.induced && O.armed) { O.dropSword(); O.induced = true; } }
  else if (k === 'cool') { if (!(t < (O.inducedT ?? -Infinity))) { O.specialN = (O.specialN ?? 0) + 1; O.inducedT = t + 4; } }
}

/** 판 하나 (재는 쪽 = school 의 무기 weapon · 상대 = 중립) · ten1 = 재기 전용 — 재는 쪽 집요함을 1 로 (폭 0 · 게임 값은 그대로) · induce = 재기 전용 상태 들임 */
export function measureFight({ school, weapon, wi = 0, seed, swap, dur = 40, prof = 4, ten1 = false, induce = null }) {
  const lv = AI_PROFICIENCY.levels[prof];
  const lk = LOOKS.enemy;
  const subj = { proficiency: prof };
  const neut = { proficiency: prof, school: NEUTRAL };
  // persona = 상대(E) 자리 AI · persona2 = 플레이어(P) 자리 AI — swap 이면 재는 쪽이 E 자리
  const G = newRound({
    seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, look: lk, look2: lk,
    weapon: swap ? 'longsword' : weapon, weapon2: swap ? weapon : 'longsword', AI2Class: AI, difficulty: lv, difficulty2: lv,
    persona: swap ? subj : neut, persona2: swap ? neut : subj,
  });
  const A = swap ? G.ai : G.ai2; // 재는 쪽 AI
  const B = swap ? G.ai2 : G.ai; // 중립 AI
  if (ten1 && A.mind) A.mind = { ...A.mind, band: 0 }; // 재기 전용: 집요함 1 (상대 상태로 옮기지 않음)
  const F = A.me, O = B.me;
  const foeTip = B.M.reach; // 상대 칼끝 거리 (가슴 사이 — 중립 롱소드 간격표)
  const r = {
    school, weapon, seed, swap, ten1, induce, T: 0, result: 'draw', standT: 0, engT: 0,
    open: [0, 0], openP: [0, 0], pro: 0, ans: 0, first: null, t1: null, atk: [0, 0], starts: 0, inThreat: 0,
    calmT: 0, gapH: new Array(GAP_N).fill(0), gapCH: new Array(GAP_N).fill(0), closeT: 0,
    strikes: 0, big: 0, chain: 0, secrets: 0, techs: {}, whys: {}, hits: 0, eHit: 0, sevDealt: 0, sevTaken: 0, sevVuln: 0, vulnT: 0,
    latW: 0, radW: 0, latA: 0, radA: 0, orbit: 0, sLat: 0, sRad: 0, sLatA: 0, sRadA: 0,
    st: Array.from({ length: FSTATES.length }, () => new Array(SN).fill(0)),
  };
  const lastAtk = [-9, -9];
  let eng = false; // 처음 맞닿음(가슴 사이 < 상대 칼끝 + 0.6) 뒤부터 간 보기 지표를 셈 — 판 시작의 걸어 들어감은 빼고
  const prevMode = [A.mode, B.mode];
  let act = [0]; // 지금 상대 상태 번호들 (없으면 base)
  const seen = { sp: -Infinity, se: -Infinity, nSp: O.specialN ?? 0, nSe: O.secretUsed ?? 0 };
  const add = (k, v) => { for (const i of act) r.st[i][k] += v; };
  // 칼을 낸 공격 (startStrike — 비기 · 이어 치기 · 흐름 포함)
  const ss = A.startStrike;
  A.startStrike = function (...a) {
    const t = this.tech;
    if (t && !this.feint) {
      r.strikes++;
      const sec = !!this.secretRun;
      if (sec) r.secrets++;
      const bg = sec || bigTech(t);
      if (bg) r.big++;
      if (this.chain > 0) r.chain++;
      r.techs[t.name] = (r.techs[t.name] ?? 0) + 1;
      if (eng) { add(SK.strikes, 1); if (bg) add(SK.big, 1); }
    }
    return ss.apply(this, a);
  };
  G.onWound = (att, vic, w) => {
    const sv = w.type === 'blunt' ? 0 : w.severity ?? 0;
    if (att === F && vic === O && sv > 0) {
      r.hits++; r.eHit += w.energy ?? 0; r.sevDealt += sv;
      add(SK.sev, sv);
      if (act.some((i) => VULN.includes(FSTATES[i]))) r.sevVuln += sv;
    }
    if (att === O && vic === F) r.sevTaken += sv;
  };
  // 0.1 s 창 (몸 흔들림 · 걸음 출렁임을 거른 걸음 고르기 — 가슴 자리 차)
  const W = Math.max(1, Math.round(WIN / DT));
  let w0 = null; // 창 시작 { a, ux, uz, ok, calm, wall, act }
  const n = Math.round(dur / DT);
  for (let i = 0; i < n; i++) {
    G.step();
    const t = G.t;
    if (out(F) || out(O)) break;
    const both = F.state === 'stand' && O.state === 'stand' && F.armed; // 상대 칼 떨어짐도 셈 (그 상태 재기)
    const modes = [A.mode, B.mode];
    const pa = F.bodies.chest.translation(), pb = O.bodies.chest.translation();
    let ux = pb.x - pa.x, uz = pb.z - pa.z;
    const d = Math.hypot(ux, uz) || 1e-6;
    ux /= d; uz /= d;
    if (!eng && both && d < foeTip + 0.6) eng = true;
    if (eng && induce) induceState(O, induce, t);
    // 상대 상태 (참 값)
    if ((O.specialN ?? 0) !== seen.nSp) (seen.nSp = O.specialN), (seen.sp = t);
    if ((O.secretUsed ?? 0) !== seen.nSe) (seen.nSe = O.secretUsed), (seen.se = t);
    act = [];
    if (!O.armed) act.push(1);
    if (O.stamina.exhausted || O.stamina.level >= 1 || huntN(O) > 0) act.push(2);
    if (O.bleed > 0.005 && loss(O) > loss(F) + 0.05) act.push(3);
    if (O.legHealth < 0.75) act.push(4);
    if ((O.limbs?.armS ?? 1) < 0.75) act.push(5);
    if (t - seen.sp < 6.6 || t - seen.se < 11) act.push(6);
    if (!act.length) act.push(0);
    // 공격 꼴에 새로 들어감 = 주고받기 하나를 엶 (이어 치기는 공격 꼴 안이라 세지 않음)
    for (let k = 0; k < 2; k++) {
      const ai = k ? B : A;
      if (ATK.has(modes[k]) && !ATK.has(prevMode[k])) {
        r.atk[k]++;
        if (k === 0 && r.t1 == null) r.t1 = +t.toFixed(2);
        const other = k ? 0 : 1;
        const calm = CALM.has(modes[other]) && t - lastAtk[other] > 0.4;
        const why0 = ai.mode === 'secret' ? 'secret' : ai.why ?? '?';
        if (both && calm) {
          r.open[k]++;
          if (!ANSWER.has(why0)) {
            // 먼저 침 = 상대가 고요하고(공격 · 막기 꼴 아님 · 마지막 공격 0.4 s 넘게 지남) 상대 몸짓에 답한 칼이 아님(ANSWER — 맞받기 · 헛친 뒤 · 들어옴 · 칼 봄 …)
            r.openP[k]++;
            if (eng) add(k ? SK.openN : SK.openS, 1);
            if (r.first == null) r.first = k === 0 ? 1 : 0;
          }
        }
        if (k === 0) {
          const why = ai.mode === 'secret' ? 'secret' : ai.why ?? '?';
          r.whys[why] = (r.whys[why] ?? 0) + 1;
          if (both && !(ai.chain > 0)) {
            r.starts++;
            if (FIRST.has(why)) { r.pro++; if (eng) add(SK.pro, 1); } else if (ANSWER.has(why)) { r.ans++; if (eng) add(SK.ans, 1); }
            if (d < foeTip && O.armed && !ATK.has(modes[1])) r.inThreat++; // 상대 칼끝 안에서 (상대가 칼을 쥐고 공격 중이 아님 — 준비된 칼 앞) 연 공격
          }
        }
      }
      if (ATK.has(modes[k])) lastAtk[k] = t;
    }
    const okNow = both && eng;
    if (okNow) {
      r.standT += DT;
      r.engT += DT;
      add(SK.T, DT);
      if (act.some((j) => VULN.includes(FSTATES[j]))) r.vulnT += DT;
      if (d < 1.0) r.closeT += DT;
      if (CALM.has(modes[0]) && !A.staminaRest) { // 기력 쉼(물러나 숨 고르기)은 빼고 — 고른 거리 · 고른 걸음만
        r.calmT += DT;
        // 횡보 — AI 가 고른 걸음 (스틱 옆 · 앞뒤 — 고요한 꼴 · 울타리 띠 밖은 따로: 울타리 빠짐은 몸을 지키는 걸음)
        const mx = Math.abs(F.move.x), my = Math.abs(F.move.y);
        r.sLatA += mx; r.sRadA += my;
        const pp0 = F.bodies.pelvis.translation();
        if (Math.hypot(pp0.x, pp0.z) <= 4.6) { r.sLat += mx; r.sRad += my; add(SK.sLat, mx); add(SK.sRad, my); }
        const g = d - foeTip;
        r.gapH[Math.max(0, Math.min(GAP_N - 1, Math.floor((g - GAP_LO) / GAP_BIN)))]++;
        add(SK.calmT, DT);
        add(SK.gapSum, g * DT);
        if (modes[0] === 'watch') {
          add(SK.watchT, DT); add(SK.gapW, g * DT);
          if (Math.abs(F.move.y) < 0.1) { add(SK.contT, DT); add(SK.gapC, g * DT); r.gapCH[Math.max(0, Math.min(GAP_N - 1, Math.floor((g - GAP_LO) / GAP_BIN)))]++; } // 고른 거리: 간 보며 앞뒤로 가려 하지 않는 때(스틱 앞뒤 < 0.1) — 제 거리에 만족해 선 자리
        }
      }
    }
    // 창 이어 붙이기: 창 안 모든 스텝이 okNow · 고요(watch · withdraw) 여야
    if (w0) { w0.ok &&= okNow; w0.calm &&= CALM.has(modes[0]) && !A.staminaRest; }
    if (i % W === 0) {
      if (w0) {
        const pq = F.bodies.pelvis.translation();
        const ax = pq.x - w0.a.x, az = pq.z - w0.a.z;
        const rad = ax * w0.ux + az * w0.uz; // + = 내가 다가감
        const lat = -ax * w0.uz + az * w0.ux;
        if (w0.ok && w0.calm && Math.hypot(ax, az) >= MOVE_MIN) {
          // 횡보: 고요한 꼴 걸음 가운데 옆 몫 (울타리 띠 안 창은 따로 — 울타리 빠짐은 몸을 지키는 걸음)
          r.latA += Math.abs(lat); r.radA += Math.abs(rad);
          if (!w0.wall) {
            r.latW += Math.abs(lat); r.radW += Math.abs(rad); r.orbit += Math.abs(lat) / d;
            for (const j of w0.act) { r.st[j][SK.lat] += Math.abs(lat); r.st[j][SK.rad] += Math.abs(rad); }
          }
        }
      }
      const pp = F.bodies.pelvis.translation();
      w0 = { a: { x: pp.x, z: pp.z }, ux, uz, ok: okNow, calm: CALM.has(modes[0]), wall: Math.hypot(pp.x, pp.z) > 4.6, act: act.slice() };
    }
    prevMode[0] = modes[0]; prevMode[1] = modes[1];
  }
  r.T = +G.t.toFixed(2);
  r.result = out(O) && !out(F) ? 'win' : out(F) && !out(O) ? 'lose' : 'draw';
  for (const k of ['eHit', 'sevDealt', 'sevTaken', 'sevVuln']) r[k] = +r[k].toFixed(3);
  for (const k of ['standT', 'engT', 'calmT', 'closeT', 'vulnT', 'latW', 'radW', 'latA', 'radA', 'orbit', 'sLat', 'sRad', 'sLatA', 'sRadA']) r[k] = +r[k].toFixed(4);
  r.st = r.st.map((a) => a.map((v) => +v.toFixed(4)));
  G.world.free();
  return r;
}

/** 전체 판 목록 (순서 고정 — 샤딩 · 이어 재기 번호) */
export function planFights({ schools, seeds }) {
  const list = [];
  for (const school of schools) WEAPONS[school].forEach((weapon, wi) => { for (const seed of seeds) for (const swap of [false, true]) list.push({ school, weapon, wi, seed, swap }); });
  return list;
}

// ───────────── 모음 ─────────────
const sum = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
const histMedian = (h) => {
  const tot = h.reduce((a, b) => a + b, 0);
  if (!tot) return NaN;
  let c = 0;
  for (let i = 0; i < h.length; i++) { c += h[i]; if (c >= tot / 2) return GAP_LO + (i + 0.5) * GAP_BIN; }
  return NaN;
};
/** 상대 상태 j 칸 합 (판 묶음) */
const stSum = (rs, j) => { const a = new Array(SN).fill(0); for (const r of rs) for (let k = 0; k < SN; k++) a[k] += r.st[j][k] ?? 0; return a; };
/** 상태 안 행동 지표 (값 · 표본 넉넉한가) — 네 항목 하나씩 */
export const SM = {
  open: { axis: 'initiative', v: (a) => a[SK.pro] / (a[SK.pro] + a[SK.ans]), ok: (a) => a[SK.pro] + a[SK.ans] >= 8 },
  gap: { axis: 'distance', v: (a) => a[SK.gapC] / a[SK.contT], ok: (a) => a[SK.contT] >= 2 },
  big: { axis: 'decisive', v: (a) => a[SK.big] / a[SK.strikes], ok: (a) => a[SK.strikes] >= 6 },
  lat: { axis: 'lateral', v: (a) => a[SK.sLat] / (a[SK.sLat] + a[SK.sRad]), ok: (a) => a[SK.sLat] + a[SK.sRad] >= 50 },
};
/** 점 잣대 — 행동 지표가 점수 1 점마다 움직이기로 한 폭 (설계 잣대: 먼저 친 칼 몫 10 %p · 거리 0.1 m · 큰 칼 몫 10 %p · 옆 몫 12.5 %p — 횡보 목표 줄과 같은 폭).
 *  반응 크기를 '점'으로 고르게 재는 자 (다섯 유파에 같은 자 — 바탕 지표의 유파 사이 기울기는 표본에 따라 흔들려 자로 쓰지 않음) */
export const SM_SCALE = { open: 0.1, gap: 0.1, big: 0.1, lat: 0.125 };
export function smSlopes() {
  return { ...SM_SCALE };
}
/** 상태마다 지표 차 (상태 − 바탕) — [상태][지표] = 점 (표본 모자라면 NaN) */
function stDelta(rs, slopes) {
  const base = stSum(rs, 0);
  return FSTATES.slice(1).map((_, i) => { const a = stSum(rs, i + 1); return Object.fromEntries(Object.entries(SM).map(([m, D]) => [m, D.ok(a) && D.ok(base) ? (D.v(a) - D.v(base)) / slopes[m] : NaN])); });
}
/** 반응 크기 (점): 상태마다 네 지표 차의 절댓값 평균 — 상태에 머문 시간으로 무게 · pairs 가 있으면 같은 판 집요함 1 의 차를 뺀 몫 (집요함이 만든 몫만) */
export function reactSize(rs, slopes, rs1 = null) {
  const D = stDelta(rs, slopes), D1 = rs1 ? stDelta(rs1, slopes) : null;
  let w = 0, sw = 0; // 상태 시간 무게
  FSTATES.slice(1).forEach((_, i) => {
    const T = stSum(rs, i + 1)[SK.T];
    const xs = Object.keys(SM).map((m) => (D1 ? D[i][m] - D1[i][m] : D[i][m])).filter(Number.isFinite);
    if (!xs.length || !(T > 0)) return;
    w += T; sw += T * (xs.reduce((p, x) => p + Math.abs(x), 0) / xs.length);
  });
  return w ? sw / w : NaN;
}
/** 상태마다 미는 쪽 (config MINDSET.react 와 같은 뜻 — [선공, 거리, 일격, 횡보] · cool = 본 특수 · 비기 뒤) */
const DIR = { disarmed: [1, -1, 0, 0], tired: [1, -1, 0, 0], bleed: [-1, 1, 0, 0], leg: [0, 0, 0, 1], arm: [0, 0, 1, 0], cool: [1, 0, 1, 0] };
const SMK = ['open', 'gap', 'big', 'lat'];
/** 정한 쪽으로 옮긴 크기 (점 · 부호 있음 — 상태마다 미는 쪽 지표의 차 × 쪽 평균 · 상태 시간 무게): 우연(표본) 흔들림은 평균 0 으로 지워짐 · rs1 이 있으면 같은 판 집요함 1 의 차를 뺌 */
export function reactDir(rs, slopes, rs1 = null) {
  const D = stDelta(rs, slopes), D1 = rs1 ? stDelta(rs1, slopes) : null;
  let w = 0, sw = 0;
  FSTATES.slice(1).forEach((st, i) => {
    const T = stSum(rs, i + 1)[SK.T];
    const xs = SMK.map((m, k) => (DIR[st][k] ? (D1 ? D[i][m] - D1[i][m] : D[i][m]) * DIR[st][k] : NaN)).filter(Number.isFinite);
    if (!xs.length || !(T > 0)) return;
    w += T; sw += T * (xs.reduce((p, x) => p + x, 0) / xs.length);
  });
  return w ? sw / w : NaN;
}
/** 상태별 지표 차 표 (Markdown 칸 — 점) */
export function stateTable(rows, slopes, rows1 = null) {
  const L = [`| 유파 (집요함) | ${FSTATES.slice(1).map((x) => `${x} (시간 %)`).join(' | ')} |`, `|---|${FSTATES.slice(1).map(() => '---').join('|')}|`];
  for (const s of SCHOOLS) {
    const rs = rows.filter((r) => r.school === s);
    let rs1 = rows1?.filter((r) => r.school === s);
    if (rows1 && !rs1.length && SCORE.tenacity[s] === 1) rs1 = rs; // 집요함 1 = 제 판이 그대로 '집요함 1'
    if (!rs.length) continue;
    const D = stDelta(rs, slopes), D1 = rs1?.length ? stDelta(rs1, slopes) : null;
    const tot = stSum(rs, 0)[SK.T] + FSTATES.slice(1).reduce((p, _, i) => p + stSum(rs, i + 1)[SK.T], 0);
    const cells = FSTATES.slice(1).map((_, i) => {
      const T = stSum(rs, i + 1)[SK.T];
      const f = (m) => { const x = D1 ? D[i][m] - D1[i][m] : D[i][m]; return Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(1)}` : '·'; };
      return `${(100 * T / Math.max(1e-9, tot)).toFixed(0)} % — 선 ${f('open')} · 거 ${f('gap')} · 일 ${f('big')} · 횡 ${f('lat')}`;
    });
    L.push(`| ${KO[s]} (${SCORE.tenacity[s]}) | ${cells.join(' | ')} |`);
  }
  return L.join('\n');
}
/** 지표 (판 묶음 → 수) — 판을 다시 뽑아 구간을 잴 수 있게 함수로 */
export const METRICS = {
  open: { axis: 'initiative', ko: '먼저 친 몫 — 모든 때', f: (rs) => { const a = sum(rs, (r) => r.openP[0]), b = sum(rs, (r) => r.openP[1]); return a / Math.max(1, a + b); }, fmt: (x) => `${(100 * x).toFixed(1)} %`, info: true },
  openAll: { info: true, axis: 'initiative', ko: '고요한 때 연 주고받기 몫 (답한 칼 포함)', f: (rs) => { const a = sum(rs, (r) => r.open[0]), b = sum(rs, (r) => r.open[1]); return a / Math.max(1, a + b); }, fmt: (x) => `${(100 * x).toFixed(1)} %` },
  openB: { axis: 'initiative', ko: '먼저 친 칼 몫 — 바탕 (상대 상태 이상 없을 때 · 내 공격 가운데 먼저 친 칼 ÷ 먼저 친 칼 + 받아 친 칼)', f: (rs) => SM.open.v(stSum(rs, 0)), fmt: (x) => `${(100 * x).toFixed(1)} %`, main: true },
  firstAll: { info: true, axis: 'initiative', ko: '먼저 친 칼 몫 — 모든 때', f: (rs) => sum(rs, (r) => r.pro) / Math.max(1, sum(rs, (r) => r.pro + r.ans)), fmt: (x) => `${(100 * x).toFixed(1)} %` },
  openX: { info: true, axis: 'initiative', ko: '주고받기를 먼저 연 몫 — 바탕 (둘 다 고요한 때 답하지 않고 연 것 가운데 내 몫)', f: (rs) => { const a = stSum(rs, 0); return a[SK.openS] / Math.max(1, a[SK.openS] + a[SK.openN]); }, fmt: (x) => `${(100 * x).toFixed(1)} %` },
  first: { info: true, axis: 'initiative', ko: '첫 주고받기를 연 판', f: (rs) => { const q = rs.filter((r) => r.first != null); return sum(q, (r) => r.first) / Math.max(1, q.length); }, fmt: (x) => `${(100 * x).toFixed(0)} %` },
  t1: { info: true, axis: 'initiative', ko: '첫 공격까지 s (가운데)', f: (rs) => { const q = rs.filter((r) => r.t1 != null).map((r) => r.t1).sort((a, b) => a - b); return q.length ? q[Math.floor(q.length / 2)] : NaN; }, fmt: (x) => x.toFixed(1), lowIsHigh: true },
  gap: { info: true, axis: 'distance', ko: '공격하지 않는 동안 상대 칼끝 밖 거리 가운데 m — 모든 때', f: (rs) => { const h = new Array(GAP_N).fill(0); for (const r of rs) for (let i = 0; i < GAP_N; i++) h[i] += r.gapH[i]; return histMedian(h); }, fmt: (x) => x.toFixed(2) },
  gapB: { axis: 'distance', ko: '고른 거리 — 간 보며 앞뒤로 가려 하지 않을 때(스틱 앞뒤 < 0.1 — 제 거리에 만족해 선 때) 상대 칼끝 밖 m 평균 — 바탕', f: (rs) => SM.gap.v(stSum(rs, 0)), fmt: (x) => x.toFixed(2), main: true },
  gapC: { info: true, axis: 'distance', ko: '고른 거리 가운데 m — 모든 때', f: (rs) => { const h = new Array(GAP_N).fill(0); for (const r of rs) for (let i = 0; i < GAP_N; i++) h[i] += r.gapCH?.[i] ?? 0; return histMedian(h); }, fmt: (x) => x.toFixed(2) },
  gapW: { info: true, axis: 'distance', ko: '간 보는 동안 거리 평균 m (다가가는 중 포함) — 바탕', f: (rs) => { const a = stSum(rs, 0); return a[SK.gapW] / a[SK.watchT]; }, fmt: (x) => x.toFixed(2) },
  close: { info: true, axis: 'distance', ko: '1 m 안 몫', f: (rs) => sum(rs, (r) => r.closeT) / Math.max(1e-9, sum(rs, (r) => r.engT)), fmt: (x) => `${(100 * x).toFixed(1)} %`, lowIsHigh: true },
  big: { info: true, axis: 'decisive', ko: '큰 칼 몫 (낸 칼 가운데) — 모든 때', f: (rs) => sum(rs, (r) => r.big) / Math.max(1, sum(rs, (r) => r.strikes)), fmt: (x) => `${(100 * x).toFixed(1)} %` },
  eAtk: { info: true, axis: 'decisive', ko: '낸 칼 하나 판정 에너지 J (무기 몫 섞임)', f: (rs) => sum(rs, (r) => r.eHit) / Math.max(1, sum(rs, (r) => r.strikes)), fmt: (x) => x.toFixed(1) },
  inThreat: { info: true, axis: 'decisive', ko: '상대 칼끝 안에서 연 공격 몫', f: (rs) => sum(rs, (r) => r.inThreat) / Math.max(1, sum(rs, (r) => r.starts)), fmt: (x) => `${(100 * x).toFixed(1)} %` },
  chain: { info: true, axis: 'decisive', ko: '이어 치기 몫', f: (rs) => sum(rs, (r) => r.chain) / Math.max(1, sum(rs, (r) => r.strikes)), fmt: (x) => `${(100 * x).toFixed(1)} %`, lowIsHigh: true },
  bigB: { axis: 'decisive', ko: '큰 칼 몫 (머리 · 어깨 위에서 내리는 베기 · 비기 — 낸 칼 가운데) — 바탕', f: (rs) => SM.big.v(stSum(rs, 0)), fmt: (x) => `${(100 * x).toFixed(1)} %`, main: true },
  lat: { info: true, axis: 'lateral', ko: '고른 걸음 옆 몫 (스틱 — 고요한 꼴 · 울타리 띠 밖) — 모든 때', f: (rs) => sum(rs, (r) => r.sLat) / Math.max(1e-9, sum(rs, (r) => r.sLat + r.sRad)), fmt: (x) => `${(100 * x).toFixed(1)} %` },
  latBody: { info: true, axis: 'lateral', ko: '몸 걸음 옆 몫 (골반 0.2 s 창 — 몸 흔들림 · 돌아섬 · 밀림 섞임) — 모든 때', f: (rs) => sum(rs, (r) => r.latW) / Math.max(1e-9, sum(rs, (r) => r.latW + r.radW)), fmt: (x) => `${(100 * x).toFixed(1)} %` },
  latB: { axis: 'lateral', ko: '고른 걸음 옆 몫 (스틱 옆 ÷ 옆 + 앞뒤 — 고요한 꼴 · 울타리 띠 밖 · 스킬 걸음은 공격 · 막기 꼴이라 빠짐) — 바탕', f: (rs) => SM.lat.v(stSum(rs, 0)), fmt: (x) => `${(100 * x).toFixed(1)} %`, main: true },
  latA: { info: true, axis: 'lateral', ko: '고른 걸음 옆 몫 (울타리 띠 포함)', f: (rs) => sum(rs, (r) => r.sLatA) / Math.max(1e-9, sum(rs, (r) => r.sLatA + r.sRadA)), fmt: (x) => `${(100 * x).toFixed(1)} %` },
  vuln: { info: true, axis: 'tenacity', ko: '몫 — 상대 약한 틈(칼 떨어짐 · 지침 · 본 특수 · 비기 뒤)에 준 상처 몫 ÷ 그 틈 시간 몫', f: (rs) => (sum(rs, (r) => r.sevVuln) / Math.max(1e-9, sum(rs, (r) => r.sevDealt))) / Math.max(1e-9, sum(rs, (r) => r.vulnT) / Math.max(1e-9, sum(rs, (r) => r.engT))), fmt: (x) => x.toFixed(2) },
  win: { info: true, axis: 'tenacity', ko: '중립 상대 이김 몫 (이김 + 비김 ½)', f: (rs) => sum(rs, (r) => (r.result === 'win' ? 1 : r.result === 'draw' ? 0.5 : 0)) / Math.max(1, rs.length), fmt: (x) => `${(100 * x).toFixed(1)} %` },
};

/** 씨앗 고정 난수 (구간 재뽑기 — 결과가 늘 같게) */
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
/** 판을 다시 뽑아 95 % 구간 */
export function boot(rs, f, B = 400) {
  const rnd = lcg(12345);
  const v = [];
  for (let b = 0; b < B; b++) { const q = rs.map(() => rs[Math.floor(rnd() * rs.length)]); const x = f(q); if (Number.isFinite(x)) v.push(x); }
  if (!v.length) return [NaN, NaN];
  v.sort((a, b) => a - b);
  return [v[Math.floor(0.025 * v.length)], v[Math.floor(0.975 * v.length)]];
}

/** 항목 판정: 잰 순위가 점수 순위와 맞나(같은 점수는 어느 쪽이든) · 5 점 대 1 점 구간이 겹치지 않나 */
export function judge(axis, vals, cis, lowIsHigh = false) {
  const S = SCORE[axis];
  const key = (s) => (lowIsHigh ? -vals[s] : vals[s]);
  let orderOk = true;
  const bad = [];
  for (const a of SCHOOLS) for (const b of SCHOOLS) if (S[a] > S[b] && !(key(a) > key(b))) { orderOk = false; bad.push(`${KO[a]}(${S[a]}) ≤ ${KO[b]}(${S[b]})`); }
  const hi = SCHOOLS.find((s) => S[s] === 5), lo = SCHOOLS.find((s) => S[s] === 1);
  const gapOk = lowIsHigh ? cis[hi][1] < cis[lo][0] : cis[hi][0] > cis[lo][1];
  return { orderOk, gapOk, pass: orderOk && gapOk, bad: [...new Set(bad)] };
}

/** 항목 표 (Markdown) — before 가 있으면 한 칸에 '전 → 뒤' */
export function aggTable(rows, before = null, ten1 = null) {
  const by = (rs) => Object.fromEntries(SCHOOLS.map((s) => [s, rs.filter((r) => r.school === s)]));
  const A = by(rows), Bf = before ? by(before) : null;
  const L = [];
  const head = ['항목 · 지표', ...SCHOOLS.map((s) => KO[s]), '판정'];
  L.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
  const verdicts = {};
  const row = (label, axis, f, fmt0, { main = false, info = false, lowIsHigh = false, bfF = null } = {}) => {
    const S = SCORE[axis];
    const fmt = (x) => (Number.isFinite(x) ? fmt0(x) : '–');
    const vals = {}, cis = {}, bv = {};
    for (const s of SCHOOLS) {
      vals[s] = A[s].length ? f(A[s], s) : NaN;
      cis[s] = A[s].length ? boot(A[s], (q) => f(q, s)) : [NaN, NaN];
      if (Bf) bv[s] = Bf[s].length ? (bfF ?? f)(Bf[s], s) : NaN;
    }
    const rank = (v) => { const order = SCHOOLS.filter((s) => Number.isFinite(v[s])).sort((a, b) => (lowIsHigh ? v[a] - v[b] : v[b] - v[a])); return Object.fromEntries(order.map((s, i) => [s, i + 1])); };
    const rk = rank(vals), brk = Bf ? rank(bv) : null;
    const J = judge(axis, vals, cis, lowIsHigh);
    let jb = null;
    if (Bf) { const bcis = Object.fromEntries(SCHOOLS.map((s) => [s, Bf[s].length ? boot(Bf[s], (q) => (bfF ?? f)(q, s)) : [NaN, NaN]])); jb = judge(axis, bv, bcis, lowIsHigh); }
    if (main) verdicts[axis] = { label, ...J, before: jb, vals, cis };
    const cell = (s) => `${Bf ? `${fmt(bv[s])} (${brk[s] ?? '-'}) → ` : ''}**${fmt(vals[s])}** (${rk[s] ?? '-'}) [${fmt(cis[s][0])} ~ ${fmt(cis[s][1])}]`;
    const verdict = info ? '참고' : `${Bf ? `${jb.pass ? '합격' : '불합격'} → ` : ''}${J.pass ? '**합격**' : '**불합격**'}${J.orderOk ? '' : ' (순위)'}${J.orderOk && !J.gapOk ? ' (5·1 겹침)' : ''}`;
    L.push(`| ${main ? '★ ' : ''}${AXIS_KO[axis]} · ${label}${lowIsHigh ? ' (낮을수록 높음)' : ''} — 점수 ${SCHOOLS.map((s) => S[s]).join(' · ')} | ${SCHOOLS.map(cell).join(' | ')} | ${verdict} |`);
  };
  for (const [, M] of Object.entries(METRICS)) {
    if (M.axis === 'tenacity') continue;
    row(M.ko, M.axis, M.f, M.fmt, M);
  }
  // 집요함 (11/18 사장님 '상대의 상태에 반응하는 정도'): 상태마다 네 행동 지표가 바탕에서 움직인 폭 (점 — 점수 1 점마다 지표가 움직이는 폭 smSlopes 로 나눔)
  const slopes = smSlopes(rows);
  const pct = (x) => `${(100 * x).toFixed(1)} %`;
  row('반응 크기 (상대 상태마다 네 지표가 바탕에서 움직인 폭 · 절댓값 — 점 · 상태 시간 무게)', 'tenacity', (q) => reactSize(q, slopes), (x) => x.toFixed(2), { info: !!ten1 });
  row('정한 쪽 반응 (상태마다 미는 쪽으로 움직인 크기 — 점 · 부호)', 'tenacity', (q) => reactDir(q, slopes), (x) => x.toFixed(2), { main: !ten1, info: !!ten1 });
  if (ten1) {
    const key = (r) => `${r.school}|${r.weapon}|${r.seed}|${r.swap}`;
    const T1 = new Map(ten1.map((r) => [key(r), r]));
    const P = Object.fromEntries(SCHOOLS.map((s) => [s, A[s].map((r) => ({ r, r1: T1.get(key(r)) })).filter((p) => p.r1)]));
    // 집요함 1 인 유파(일본)는 그 자체가 '집요함 1' — 같은 판이 그대로라 제 판을 짝으로 (차 0)
    for (const s of SCHOOLS) if (!P[s].length && SCORE.tenacity[s] === 1) P[s] = A[s].map((r) => ({ r, r1: r }));
    const pf = (f) => (q, s) => f(P[s].length === A[s].length ? q.map((r) => ({ r, r1: T1.get(key(r)) ?? (SCORE.tenacity[s] === 1 ? r : undefined) })).filter((p) => p.r1) : P[s]);
    row('반응 크기 — 집요함 1 로 묶은 같은 AI(같은 판)와의 차 · 절댓값 (점)', 'tenacity', pf((ps) => reactSize(ps.map((p) => p.r), slopes, ps.map((p) => p.r1))), (x) => x.toFixed(2), { info: true });
    row('정한 쪽 반응 — 집요함 1 로 묶은 같은 AI 와의 차를 상태마다 미는 쪽으로 (점 · 부호 — 우연 흔들림은 0 으로 지워짐)', 'tenacity', pf((ps) => reactDir(ps.map((p) => p.r), slopes, ps.map((p) => p.r1))), (x) => x.toFixed(2), { main: true });
    row('몫 — 이김 몫 차 (집요함 그대로 − 집요함 1)', 'tenacity', pf((ps) => (ps.reduce((a, p) => a + (p.r.result === 'win' ? 1 : p.r.result === 'draw' ? 0.5 : 0) - (p.r1.result === 'win' ? 1 : p.r1.result === 'draw' ? 0.5 : 0), 0)) / Math.max(1, ps.length)), (x) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)} 점`, { info: true });
    row('몫 — 약한 틈에 준 상처 몫 차 (그대로 − 집요함 1)', 'tenacity', pf((ps) => { const f = (k) => sum(ps, (p) => p[k].sevVuln) / Math.max(1e-9, sum(ps, (p) => p[k].sevDealt)); return f('r') - f('r1'); }), (x) => `${x >= 0 ? '+' : ''}${(100 * x).toFixed(1)} 점`, { info: true });
  }
  for (const k of ['vuln', 'win']) row(METRICS[k].ko, 'tenacity', METRICS[k].f, METRICS[k].fmt, METRICS[k]);
  const n = SCHOOLS.map((s) => `${KO[s]} ${A[s].length}`).join(' · ');
  const wl = SCHOOLS.map((s) => { const rs = A[s]; const W = rs.filter((r) => r.result === 'win').length, Lo = rs.filter((r) => r.result === 'lose').length; return `${KO[s]} ${W} · ${rs.length - W - Lo} · ${Lo}`; }).join(' / ');
  L.push('', `판 수: ${n} · 중립 상대에게 이김 · 비김 · 짐: ${wl}`);
  L.push('', `점 잣대 (점수 1 점 = 지표 폭): 선공 먼저 친 칼 몫 ${pct(slopes.open)} · 거리 ${slopes.gap.toFixed(2)} m · 일격 큰 칼 몫 ${pct(slopes.big)} · 횡보 옆 몫 ${pct(slopes.lat)}`);
  L.push('', '상대 상태마다 (상태 − 바탕, 점) — 선공 · 거리 · 일격 · 횡보' + (ten1 ? ' · 집요함 1 의 같은 차를 뺀 값' : ''), '', stateTable(rows, slopes, ten1));
  const lt = verdicts.lateral;
  if (lt) L.push('', `횡보 목표 몫 (1 점 0 % · 5 점 50 % — 바탕): ${SCHOOLS.map((s) => `${KO[s]} 목표 ${(12.5 * (SCORE.lateral[s] - 1)).toFixed(1)} % · 잼 ${pct(lt.vals[s])}`).join(' / ')}`);
  return { md: L.join('\n'), verdicts };
}

// ───────────── 집요함 상태 들임 표 ─────────────
/** 상태 들임 판들 → 유파 × 상태: 집요함 그대로 − 집요함 1 의 네 지표 차 (점 — 같은 상태 · 같은 판 짝) · 정한 쪽 반응 (미는 쪽 평균 · 부호) · 이김 몫 차 */
export function induceTable(runs) {
  const slopes = smSlopes();
  const states = [...new Set(runs.map((r) => r.induce))];
  const L = [`| 유파 (집요함 · 폭) | ${states.map((x) => `${x}: 선 · 거 · 일 · 횡 (점) → 정한 쪽`).join(' | ')} | 정한 쪽 평균 [95 %] | 이김 몫 차 |`, `|---|${states.map(() => '---').join('|')}|---|---|`];
  const out = {};
  for (const s of SCHOOLS) {
    const rs = runs.filter((r) => r.school === s);
    if (!rs.length) continue;
    const one = SCORE.tenacity[s] === 1;
    const cell = (q) => {
      // 그 상태 판 전체(맞닿은 뒤)의 지표 — 들인 상태가 판 내내라 상태 칸을 모두 합침
      const all = (x) => { const a = new Array(SN).fill(0); for (const r of x) for (let j = 0; j < FSTATES.length; j++) for (let k = 0; k < SN; k++) a[k] += r.st[j][k] ?? 0; return a; };
      return all(q);
    };
    const dirOf = (st, q, q1) => {
      const a = cell(q), b = cell(q1);
      const ds = SMK.map((m) => (SM[m].ok(a) && SM[m].ok(b) ? (SM[m].v(a) - SM[m].v(b)) / slopes[m] : NaN));
      const dd = ds.map((x, k) => (DIR[st][k] ? x * DIR[st][k] : NaN)).filter(Number.isFinite);
      return { ds, dir: dd.length ? dd.reduce((p, x) => p + x, 0) / dd.length : NaN };
    };
    const cells = [], dirs = [];
    for (const st of states) {
      const q = rs.filter((r) => r.induce === st && !r.ten1), q1 = one ? q : rs.filter((r) => r.induce === st && r.ten1);
      const { ds, dir } = dirOf(st, q, q1);
      dirs.push({ st, q, q1 });
      cells.push(`${ds.map((x) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(1)}` : '·')).join(' · ')} → **${Number.isFinite(dir) ? dir.toFixed(2) : '·'}**`);
    }
    // 정한 쪽 평균과 구간 (판 다시 뽑기 — 상태마다 그대로 · 집요함 1 판을 따로 뽑음)
    const meanDir = (sets) => { const v = sets.map(({ st, q, q1 }) => dirOf(st, q, q1).dir).filter(Number.isFinite); return v.length ? v.reduce((p, x) => p + x, 0) / v.length : NaN; };
    const m = meanDir(dirs);
    const rnd = lcg(777);
    const bs = [];
    for (let b = 0; b < 200; b++) {
      const pick = (x) => x.map(() => x[Math.floor(rnd() * x.length)]);
      bs.push(meanDir(dirs.map(({ st, q, q1 }) => { const qq = pick(q); return { st, q: qq, q1: one ? qq : pick(q1) }; })));
    }
    bs.sort((a, b) => a - b);
    const win = (x) => x.reduce((p, r) => p + (r.result === 'win' ? 1 : r.result === 'draw' ? 0.5 : 0), 0) / Math.max(1, x.length);
    const q0 = rs.filter((r) => !r.ten1), q1 = one ? q0 : rs.filter((r) => r.ten1);
    out[s] = { dir: m, ci: [bs[5], bs[194]] };
    L.push(`| ${KO[s]} (${SCORE.tenacity[s]} · ±${(SCORE.tenacity[s] - 1) * 0.5}) | ${cells.join(' | ')} | **${m.toFixed(2)}** [${bs[5].toFixed(2)} ~ ${bs[194].toFixed(2)}] | ${((win(q0) - win(q1)) * 100).toFixed(1)} 점 |`);
  }
  const J = judge('tenacity', Object.fromEntries(SCHOOLS.map((s) => [s, out[s]?.dir ?? NaN])), Object.fromEntries(SCHOOLS.map((s) => [s, out[s]?.ci ?? [NaN, NaN]])));
  L.push('', `판정 (정한 쪽 평균 순위 = 집요함 순위 · 5 점 대 1 점 구간 안 겹침): ${J.pass ? '합격' : '불합격'}${J.bad.length ? ` — 어긋남 ${J.bad.join(' · ')}` : ''}`);
  L.push('', `점 잣대: 선공 먼저 친 칼 몫 ${(100 * slopes.open).toFixed(0)} %p · 거리 ${slopes.gap} m · 일격 큰 칼 몫 ${(100 * slopes.big).toFixed(0)} %p · 횡보 옆 몫 ${(100 * slopes.lat).toFixed(1)} %p = 1 점`);
  return L.join('\n');
}

// ───────────── 맞대결 (5 × 5) ─────────────
export const RR_PAIRS = [];
for (let i = 0; i < SCHOOLS.length; i++) for (let j = i + 1; j < SCHOOLS.length; j++) RR_PAIRS.push([SCHOOLS[i], SCHOOLS[j]]);

export function planRR({ seeds }) {
  const list = [];
  for (const [a, b] of RR_PAIRS) {
    let ci = 0;
    for (const wa of WEAPONS[a]) for (const wb of WEAPONS[b]) { for (const seed of seeds) list.push({ a, b, wa, wb, seed, swap: (ci + seed) % 2 === 1 }); ci++; }
  }
  return list;
}

/** 맞대결 한 판: a 유파 무기 wa 대 b 유파 무기 wb · swap 이면 a 가 E 자리 · 같은 숙련도 · 같은 겉모습 */
export function rrFight({ a, b, wa, wb, seed, swap }, dur = 60, prof = 4) {
  const lv = AI_PROFICIENCY.levels[prof];
  const lk = LOOKS.enemy;
  const G = newRound({ seed: seed * 100 + (swap ? 1 : 0), walls: true, look: lk, look2: lk, weapon: swap ? wb : wa, weapon2: swap ? wa : wb, AI2Class: AI, difficulty: lv, difficulty2: lv, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const FA = swap ? G.enemy : G.player, FB = swap ? G.player : G.enemy;
  while (G.t < dur && !out(FA) && !out(FB)) G.step();
  const res = out(FB) && !out(FA) ? 'a' : out(FA) && !out(FB) ? 'b' : 'draw';
  const T = +G.t.toFixed(2);
  G.world.free();
  return { a, b, wa, wb, seed, swap, res, T };
}

export function rrTable(runs) {
  const share = (x, y) => {
    let k = 0, n = 0;
    for (const r of runs) {
      if (r.a === x && r.b === y) { n++; k += r.res === 'a' ? 1 : r.res === 'draw' ? 0.5 : 0; }
      if (r.a === y && r.b === x) { n++; k += r.res === 'b' ? 1 : r.res === 'draw' ? 0.5 : 0; }
    }
    return n ? [k / n, n] : [NaN, 0];
  };
  const L = [`| 줄 쪽 이김 몫 (이김 + 비김 ½) | ${SCHOOLS.map((s) => KO[s]).join(' | ')} | 평균 |`, `|---|${SCHOOLS.map(() => '---').join('|')}|---|`];
  for (const x of SCHOOLS) {
    const cells = [];
    let tk = 0, tn = 0;
    for (const y of SCHOOLS) {
      if (x === y) { cells.push('-'); continue; }
      const [p, n] = share(x, y);
      cells.push(n ? `${(100 * p).toFixed(0)} % (${n})` : '·');
      if (n) { tk += p * n; tn += n; }
    }
    L.push(`| ${KO[x]} | ${cells.join(' | ')} | **${tn ? ((100 * tk) / tn).toFixed(1) : '-'} %** |`);
  }
  const D = runs.filter((r) => r.res === 'draw').length;
  L.push('', `판 ${runs.length} · 비김 ${D} (${((100 * D) / Math.max(1, runs.length)).toFixed(1)} %) · 평균 끝 ${(runs.reduce((s, r) => s + r.T, 0) / Math.max(1, runs.length)).toFixed(1)} s`);
  return L.join('\n');
}

// ───────────── 실행 ─────────────
const save = (path, runs) => { writeFileSync(`${path}.tmp`, JSON.stringify(runs)); renameSync(`${path}.tmp`, path); };
function runList(all, fn, label) {
  const [si, sn] = arg('shard', '1/1').split('/').map(Number);
  if (!(sn >= 1 && si >= 1 && si <= sn)) throw new Error('--shard=i/n 은 1 ≤ i ≤ n');
  const mine = all.map((f, k) => ({ f, k })).filter(({ k }) => k % sn === si - 1);
  const path = arg('json', null);
  const runs = path && args.includes('--resume') && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  const done = new Set(runs.map((r) => r.k));
  console.error(`${label}: 전체 ${all.length} 판 · 이 샤드 ${mine.length} 판 (${si}/${sn})${done.size ? ` · 이어 재기 ${done.size} 판 있음` : ''}`);
  let since = 0;
  for (const { f, k } of mine) {
    if (done.has(k)) continue;
    const r = { k, ...fn(f) };
    runs.push(r);
    console.error(`[${k + 1}/${all.length}] ${JSON.stringify(f)} → ${r.result ?? r.res} @${r.T}s`);
    if (path && ++since >= 5) { save(path, runs); since = 0; }
  }
  if (path) save(path, runs);
  return runs;
}

if (isMain(import.meta.url)) {
  const files = () => args.slice(1).filter((a) => !a.startsWith('--'));
  if (mode === 'agg') {
    const rows = files().flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    const bf = arg('before', null);
    const before = bf ? bf.split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8'))) : null;
    const t1 = arg('ten1', null);
    const ten1 = t1 ? t1.split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8'))) : null;
    const { md, verdicts } = aggTable(rows, before, ten1);
    console.log(md);
    console.log('');
    for (const [ax, v] of Object.entries(verdicts)) console.log(`${AXIS_KO[ax]} (${v.label}): ${v.before ? `전 ${v.before.pass ? '합격' : '불합격'} → ` : ''}${v.pass ? '합격' : '불합격'}${v.bad.length ? ` — 어긋남 ${v.bad.join(' · ')}` : ''}${v.orderOk && !v.gapOk ? ' — 5 · 1 구간 겹침' : ''}`);
  } else if (mode === 'induce') {
    // 집요함 반응 재기: 상태마다 같은 판을 집요함 그대로 · 집요함 1 로 (일본은 그대로만 — 집요함 1 이 곧 제 판)
    applyCfgArgs();
    const dur = +arg('dur', 20), prof = +arg('prof', 4);
    const schools = arg('schools', SCHOOLS.join(',')).split(',');
    const states = arg('states', 'bleed,tired,leg,arm,disarmed,cool').split(',');
    const list = [];
    for (const f of planFights({ schools, seeds: range(arg('seeds', '1-4')) })) for (const induce of states) for (const ten1 of SCORE.tenacity[f.school] === 1 ? [false] : [false, true]) list.push({ ...f, induce, ten1 });
    const runs = runList(list, (f) => measureFight({ ...f, dur, prof }), '집요함 상태 들임');
    console.log(induceTable(runs));
  } else if (mode === 'induceagg') {
    console.log(induceTable(files().flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  } else if (mode === 'rragg') {
    console.log(rrTable(files().flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  } else if (mode === 'rr') {
    applyCfgArgs();
    const dur = +arg('dur', 60), prof = +arg('prof', 4);
    const runs = runList(planRR({ seeds: range(arg('seeds', '1-12')) }), (f) => rrFight(f, dur, prof), '맞대결');
    console.log(rrTable(runs));
  } else {
    applyCfgArgs();
    const schools = arg('schools', SCHOOLS.join(',')).split(',');
    for (const s of schools) if (!SCHOOLS.includes(s)) throw new Error(`unknown school: ${s}`);
    const dur = +arg('dur', 40), prof = +arg('prof', 4);
    const ten1 = args.includes('--ten1'); // 재기 전용: 재는 쪽 집요함 1 (폭 0)
    const runs = runList(planFights({ schools, seeds: range(arg('seeds', '1-30')) }), (f) => measureFight({ ...f, dur, prof, ten1 }), `마음가짐 재기${ten1 ? ' (집요함 1)' : ''}`);
    console.log(aggTable(runs).md);
  }
}
