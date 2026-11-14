// ─────────────────────────────────────────────────────────────
//  school_balance.mjs — 유파 밸런스 재기 (사장님 11/04 00:xx '필요하면 체리픽 해. 우리 도구로 재봐. (재기의 목적: 유파밸런스 조절)' · 기록 docs/strike/school_balance_2026-11-04.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만). 사람 몸(0 번)을 손가락 봇이 게임과 같은 입력 길로 조작한다:
//    실제 src/input.js Input 에 터치 사건(누름 · 끌기 · 뗌 — 844 × 390 화면)을 넣고 main.js playerInputFrame 과 같은 차례로 읽는다
//    (비기 창 · 원 · 스틱 · 미리 받기 · 막기 단추 · 고유 공격 feed · 길게 누름 · 손 목표 · 탭). 몸은 그 유파 스킬트리를 모두 익힘(kitFromNodes — 비기 포함).
//   상대 = 치고 막는 AI (숙련 3 — special_balance.mjs fightRun 과 같은 몸) · 무기 = 칸의 상대 무기 · 자연 바인드 · 그 밖 모두 지금 기본값.
//   봇 (사람 손가락 · 0.22 실제 s 늦게 본 상대 — 거리 · 상대 공격 · 내 창/무장 · 칼 닿음): 0.35 실제 s 마다 하나 고름 —
//    유파 기술 몫 TECH(0.35) · 탭 찌르기 0.2 · 나머지 기본 긋기(열 가지 — 시작 자리 가우스 σ 0.06 · 길 점 ± 0.04 · 3 ~ 5.5 패드 m/s = special_balance 손가락 봇과 같은 손) ·
//    상대가 쳐 오면(본 뒤) 0.6 몫 막기 단추 0.6 s(이탈리아는 그 가운데 비껴서며 찌르기 · 동방은 비기가 남았으면 막기 + 앞 스틱 = 격살) · 칼끼리 닿음을 느끼면(이탈리아) 0.25 ~ 0.95 s 뒤 탭 (85 %)
//   기술 하나(낸 것 — fire)마다: 이름(비기 · 끌고 가는 칼 tech · 강화 · 탭 · 기본 긋기) · 맞음(칼날 상처 > 0) · 심각도 합 · 에너지 가장 큰 것 ·
//    낸 뒤 1 실제 s 안에 상대 쓰러짐(죽음 · 기절) · 낸 뒤 1 실제 s 안에 내가 받은 심각도 · 맞음 · 넘어짐 · 판 = 이김 · 짐 · 준 · 받은 심각도
//  node tools/sim/school_balance.mjs fight [--cells=german:longsword:longsword,...] [--seeds=1-24] [--dur=30] [--tech=0.35] [--set=SECRET.sweepCap=0] [--tag=이름] [--json=파일]
//  node tools/sim/school_balance.mjs agg <json ...>   (칸마다 판 표 + 기술 표 — Markdown)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { PlayerSecretWatch, secretLeft } from '../../src/secret.js';
import { PlayerUniqueAssist, strokeTechOf } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { Input } from '../../src/input.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { TECH_BY_NAME, G as PAD } from '../../src/ai_techniques.js';
import { TRADITIONS } from '../../src/schools.js';
import { LOOKS } from '../../src/looks.js';
import { isMain } from './is_main.mjs';
import { closeInputGate, closeInputApply } from '../../src/close_hold.js'; // 붙은 거리 규칙 (11/14 — main.js playerInputFrame 과 같은 차례)

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const FR = 1 / 60; // 입력 프레임 (실제 s — main.js rAF 한 번)
const REACT = 0.22; // 사람 반응 (실제 s — 늦게 봄)
const TRACE = !!process.env.SB_TRACE; // 진단 줄 (0.25 s 마다 몸 · 손 · 창)
const TRACE2 = !!process.env.SB_TRACE2; // 진단 줄 (기술 긋기가 읽힌 꼴)
const UA = CONFIG.UNIQUE_ASSIST;
const DE_BOT = process.env.SB_DE_BOT !== '0'; // 11/14 독일 봇 (파고들기 · 밀치기 · 겹치기 → 붙음) — SB_DE_BOT=0 = 옛 독일 봇 (다른 유파 봇은 그대로)
const GAIT_STAND = CONFIG.GAIT.burstStandV; // 박차기의 '서 있음' 골반 빠르기
/** --set=SECRET.sweepCap=0,UNIQUE_ASSIST.x=1 — 이 프로세스 안에서만 (bind_on_measure.mjs applySets 와 같은 꼴) */
function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
function rng(seed) {
  let s = seed >>> 0;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  r.g = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  return r;
}
// 브라우저 껍데기 (Input 이 읽는 것만 — 판 물리 동안은 걷어 낸다)
const canvas = { addEventListener() {} };
const win = { innerWidth: 844, innerHeight: 390, addEventListener() {}, location: { search: '' } };
function inputEnv(fn) {
  const had = Object.hasOwn(globalThis, 'window');
  const old = globalThis.window;
  globalThis.window = win;
  try {
    return fn();
  } finally {
    if (had) globalThis.window = old;
    else delete globalThis.window;
  }
}
globalThis.document ??= { pointerLockElement: null };
globalThis.matchMedia ??= () => ({ matches: true });

/** 유파 칸: 유파 · 내 무기 · 상대 무기 (기본 칸 = 유파 대표 커먼 무기 대 롱소드 AI · 거울) */
export const CELLS = ['german:longsword:longsword', 'german:sabre:longsword', 'italian:rapier:longsword', 'iberian:zweihander:longsword', 'japanese:uchigatana:longsword', 'chinese:hwando:longsword', 'none:morgenstern:longsword', 'italian:rapier:rapier', 'iberian:zweihander:zweihander', 'japanese:uchigatana:uchigatana', 'chinese:hwando:hwando', 'german:sabre:sabre', 'none:morgenstern:morgenstern'];
const BASIC = ['zornhau', 'zornhauL', 'oberhau', 'zwerch', 'zwerchL', 'unterhau', 'unterhauL', 'stichPflug', 'stichOchs', 'stichPflugL'];
const TSU = (() => {
  const u = TRADITIONS.japanese.unique.find((x) => x.name === 'tsubameGaeshi');
  return { from: u.from, path: u.path };
})();
const KOTE = { from: PAD.langort, path: [[0.02, -0.22]] };

/** 한 판 */
export function fightOne({ school, weapon, opp, seed, dur = 30, tech = 0.35, sjit = 0.06, jit = 0.04, spd = [3, 5.5], focus = null, secret = true, drop = [], probe = null, onRound = null, botHook = null, attrib = 'new' }) { // probe = 재기 꽂개 (rapier_defence.mjs) · onRound · botHook = 코테 · 줍기 재기 (kote_pickup.mjs) · attrib 'old' = 11/04 기술 기록 셈 (step_input — 늦게 읽힌 긋기 이름 바꿈)
  const rnd = rng(seed * 7919 + 101);
  const kit = kitFromNodes(school, allNodeIds(school)); // 무유파는 null (나무 없음 — 고유 · 비기 없음)
  const G = newRound({ seed, weapon, weapon2: opp, walls: true, ...(kit ? { kit } : {}), look: LOOKS.player, look2: LOOKS.enemy, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  applyWeaponMeasure(G.ai, opp);
  const P = G.player;
  const A = G.enemy;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  P.canShove = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set([...(kit?.unique ?? [])].filter((n) => !drop.includes(n))) }); // drop = 안 익힌 고유 공격 (견줌 — --drop=imbroccata)
  const W = new PlayerSecretWatch(P, A, { locked: !kit?.secret || !secret }); // secret false = 비기 안 익힘 (견줌 — --secret=0)
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  const input = inputEnv(() => new Input(canvas, new URLSearchParams('')));
  input.enabled = true;
  onRound?.({ G, P, A, uq, guard, W });
  const M = P.swordArt.measure;
  const secretName = W.S?.name ?? null;
  const ALTIB = school === 'iberian' && CONFIG.SECRET.iberianSecret === 'altib'; // 11/11 이베리아 자리 바꿈 판 (비기 알티바슈 포르트 · 특수 공격 싱지르)
  // ── 손가락 (화면 px) ──
  let x = 620;
  let y = 180;
  let hand = false;
  const ev = (kind, dx = 0, dy = 0) => {
    if (kind === 'pointerdown') (x = 620), (y = 180);
    const base = { pointerId: 1, pointerType: 'touch', button: 0, timeStamp: Math.max(1, (G.t / K) * 1000), type: kind, clientX: x, clientY: y };
    if (kind === 'pointerdown') inputEnv(() => input.onDown(base)), (hand = true);
    else if (kind === 'pointerup') inputEnv(() => input.onUp(base)), (hand = false);
    else {
      const sc = CONFIG.INPUT.touchSensitivity / 390;
      x += dx / sc;
      y -= dy / (sc * input.mobileIntent.verticalGain);
      inputEnv(() => input.onMove({ ...base, clientX: x, clientY: y }));
    }
  };
  /** 긋기 프레임 (패드 m 옮김): 시작 자리(+ 가우스)로 천천히 · 4 프레임 멈춤 · 길 점마다 ± jit · 3 ~ 5.5 패드 m/s (special_balance 손가락 봇과 같은 손) */
  const strokeQ = (S) => {
    let hx = P.handOffset.x;
    let hy = P.handOffset.y;
    const q = [];
    const to = (p, v) => {
      for (let j = 0; j < 500; j++) {
        const dx = p[0] - hx;
        const dy = p[1] - hy;
        const d = Math.hypot(dx, dy);
        if (d < 1e-7) break;
        const s = Math.min(d, v * FR);
        q.push([(dx / d) * s, (dy / d) * s]);
        hx += (dx / d) * s;
        hy += (dy / d) * s;
      }
    };
    to([S.from[0] + rnd.g() * sjit, S.from[1] + rnd.g() * sjit], CONFIG.SKILL.recoverSpeed);
    q.push(...Array.from({ length: 4 }, () => [0, 0]));
    const v = spd[0] + rnd() * (spd[1] - spd[0]);
    for (const p of S.path) to([p[0] + (rnd() * 2 - 1) * jit, p[1] + (rnd() * 2 - 1) * jit], v);
    return q;
  };
  const stroke = (name, o = {}) => ({ kind: 'stroke', q: strokeQ(o.S ?? TECH_BY_NAME[name]), want: o.want ?? null, side: o.side ?? null, fwd: o.fwd ?? null, base: name });
  // ── 봇 결정 ──
  const hist = [];
  const sense = () => {
    const C = uq.touch;
    return { t: G.t / K, dist: P.foeDistance(), attack: G.ai.mode === 'attack' || !!A.skill.tap || !!A.skill.swinging, window: !!W.open, spin: !!W.spinArm?.armed, iai: !!W.iaiArm?.armed, left: secretLeft(P), touch: C && !C.cut ? C : null, whiff: P.schoolPassive?.stats.indes.whiff ?? 0 };
  };
  let act = null;
  let nextDec = 0;
  let lastWhiff = 0; // 11/14 독일 봇: 본 상대 헛침 셈
  let touchSeen = null;
  let cavTapAt = null;
  const wants = {};
  const acts = {};
  // 낸 뜻마다 게임이 읽은 것 (11/05 — docs/strike/step_input_2026-11-05.md §1): 봇 한 번(act) 동안 unique_assist 가 낸 고유 공격(stats.fired 늘어난 것) — 기술 기록(fires)의 이름과 따로
  const reads = [];
  const readEnd = (A) => {
    if (!A?.fired0) return;
    const fired = Object.entries(uq.stats.fired).flatMap(([k, v]) => Array.from({ length: v - (A.fired0[k] ?? 0) }, () => k));
    reads.push({ t: r3(A.t), kind: A.kind, want: A.want ?? null, base: A.base ?? null, side: A.side ?? null, fwd: A.fwd ?? null, fired });
    A.fired0 = null;
  };
  let prevAct = null;
  const begin = (a) => {
    if (hand) ev('pointerup');
    readEnd(prevAct);
    readEnd(act);
    act = { ...a, t: G.t / K, fired0: { ...uq.stats.fired } };
    acts[a.kind] = (acts[a.kind] ?? 0) + 1;
    if (a.want) wants[a.want] = (wants[a.want] ?? 0) + 1;
    if (['stroke', 'tap', 'hold', 'circle', 'bind', 'sideTap'].includes(a.kind)) ev('pointerdown');
  };
  const side = () => (rnd() < 0.5 ? -0.9 : 0.9);
  // focus 'step' (걸음 공격 견줌): 기술 몫 = 반은 그 유파 걸음 명령(스틱 옆 · 앞) · 반은 같은 바탕 긋기(스틱 없음 — want '<바탕>Plain')
  const STEP = { german: ['zwerch', 'zwerchAbtritt', 'side'], iberian: ['zornhau', 'talhoRodeado', 'side'], japanese: ['zornhauL', 'hirakiGiri', 'side'], chinese: ['zwerch', 'chebuYaoji', 'fwd'] }[school];
  const schoolTech = (S) => {
    const L = S.left > 0 && !!secretName;
    if (focus === 'step' && STEP) return rnd() < 0.5 ? stroke(STEP[0], { ...(STEP[2] === 'side' ? { side: side() } : { fwd: 1 }), want: STEP[1] }) : stroke(STEP[0], { fwd: 0, want: `${STEP[0]}Plain` });
    if (school === 'german') {
      if (DE_BOT) {
        // 11/14 독일 봇 (더티복싱 재기 — 파고들기 · 밀치기 · 모르트슐라크를 실제로 씀 · DE_BOT 끔 = 옛 독일 봇): 칼 거리 밖이면 반은 파고들기(서서 앞으로 세게 — 들어가 밀치기까지) ·
        //  칼 거리 안이면 넷에 하나 밀치기(걸어 들어가며 밂 1.4 s) · 나머지는 옛 넷(가로베기 · 곁눈 베기 · 겹치기 + 버팀 · 모르트슐라크 붙음)
        if (S.dist > M.contact + 0.1 && rnd() < 0.5) return { kind: 'dig', seconds: 1.2, want: 'dig' };
        if (S.dist <= M.contact + 0.1 && rnd() < 0.25) return { kind: 'close', seconds: 1.4, want: 'shove' };
      }
      const n = Math.floor(rnd() * (L ? 4 : 3));
      if (n === 0) return stroke('zwerch', { side: side(), want: 'zwerchAbtritt' });
      if (n === 1) return stroke('zornhau', { want: 'schielhau' });
      if (n === 2) return { ...stroke('zornhau', { want: 'duplieren' }), bindAfter: 1.0, ...(DE_BOT ? { thenClose: !!L } : {}) }; // 긋고 맞댄 채 버팀 (겹치기 자동 — 맞댐 0.6 s) · 11/14 봇: 비기가 남았으면 겹치기 뒤 붙음(모르트슐라크 이음)
      return { kind: 'close', seconds: 2.8, want: secretName }; // 죽음의 일격 — 0.8 m 안 2 s
    }
    if (school === 'italian') {
      if (L && rnd() < 0.3) return { kind: 'bind', seconds: 1.4, fwd: 0.8, want: secretName }; // 덮인 채 나아가기 (리솔루토 창)
      return stroke(rnd() < 0.5 ? 'oberhau' : 'stichOchs', { want: 'imbroccata' });
    }
    if (school === 'iberian') {
      if (L && S.dist > M.reach && rnd() < 0.35) return { kind: 'wait', seconds: 1.6, fwd: -0.3, want: secretName }; // 칼끝 거리 밖 무장 → 원 (11/11 'altib' 판: → 길게 눌러 메기)
      // 11/11 'altib' 판 (SECRET.iberianSecret — 사장님 자리 바꿈): 고유 공격 몫의 반 = 싱지르 특수 공격(원 0.8 s — 칼끝 거리 + 0.3 안에서 · 전 비기 봇과 같은 손 · 그 밖이면 다가감) · 반 = 나선 걸음 베기 (정수리 가르기는 비기 — 무장 창에서만)
      if (ALTIB) return rnd() < 0.5 ? (S.dist <= M.reach + 0.3 ? { kind: 'circle', seconds: 0.8, want: 'cingir' } : { kind: 'move', seconds: 0.35, fwd: 0.9 }) : stroke('zornhau', { side: side(), want: 'talhoRodeado' });
      return rnd() < 0.5 ? { kind: 'hold', seconds: 4, fwd: 0.6, want: 'redondo', releaseAt: M.contact + rnd() * (M.reach + 0.15 - M.contact) } : stroke('zornhau', { side: side(), want: 'talhoRodeado' });
    }
    if (school === 'japanese') {
      if (focus === 'kote') return stroke('kote', { S: KOTE, want: 'kote' }); // focus 'kote' (11/05 손목 치기 떨굼 재기 — kote_pickup.mjs): 유파 기술 몫은 모두 손목 치기
      if (L && rnd() < 0.3) return { kind: 'wait', seconds: S.iai ? 0.8 : 2.4, fwd: 0, want: secretName }; // 아무것도 안 함 2 s → 고노센 준비
      const n = Math.floor(rnd() * 3);
      return n === 0 ? stroke('kote', { S: KOTE, want: 'kote' }) : n === 1 ? stroke('zornhauL', { side: side(), want: 'hirakiGiri' }) : stroke('tsubame', { S: TSU, want: 'tsubameGaeshi' });
    }
    if (school === 'chinese') {
      const n = Math.floor(rnd() * 3);
      return n === 0 ? { kind: 'retreatTap', seconds: 0.15 + rnd() * 0.2, want: 'lianchi' } : n === 1 ? stroke('zwerch', { fwd: 1, want: 'chebuYaoji' }) : stroke('zwerch', { fwd: 0.25, want: 'yaoji' });
    }
    return null;
  };
  const decide = (S) => {
    if (S.window && ['german', 'italian', 'japanese'].includes(school)) return { kind: 'tap', seconds: 0.07, want: secretName };
    // 11/14 독일 봇: 상대 헛침을 봤고(그 순간 창 — 헛침 셈이 늘었음) 칼 거리 밖이면 파고듦 (70 %)
    if (DE_BOT && school === 'german' && S.whiff > lastWhiff) {
      lastWhiff = S.whiff;
      if (S.dist > M.contact && rnd() < 0.7) return { kind: 'dig', seconds: 1.2, want: 'dig' };
    }
    if (S.spin && school === 'iberian') return ALTIB ? { kind: 'hold', seconds: 4, fwd: 0.6, want: secretName, releaseAt: M.contact + rnd() * (M.reach + 0.15 - M.contact) } : { kind: 'circle', seconds: 0.8, want: secretName }; // 11/11 'altib' 판: 무장 창 → 길게 눌러 메고 걸어 들어가 뗌 (전 판 정수리 가르기 봇과 같은 손)
    if (S.attack && S.dist < M.reach + 0.8) {
      if (school === 'italian' && rnd() < 0.35) return { kind: 'sideTap', seconds: 0.4, side: side(), tapAt: 0.03 + rnd() * 0.08, want: 'inquartata' };
      if (school === 'chinese' && S.left > 0 && rnd() < 0.5) return { kind: 'guard', seconds: 0.65, fwd: 1, want: secretName };
      if (rnd() < 0.6) return { kind: 'guard', seconds: 0.6, fwd: S.dist < M.contact ? -0.5 : 0 };
    }
    if (S.dist > M.reach + 0.55) return { kind: 'move', seconds: 0.5, fwd: 0.9 };
    if (rnd() < tech) {
      const a = schoolTech(S);
      if (a) return a;
    }
    if (rnd() < 0.2) return { kind: 'tap', seconds: 0.07 };
    return stroke(BASIC[Math.floor(rnd() * BASIC.length)]);
  };
  const circlePt = (z) => [0.15 * (Math.cos(z * Math.PI * 2 * 1.35) - 1), 0.15 * Math.sin(z * Math.PI * 2 * 1.35)];
  let activeStart = null;
  const frame = () => {
    const t = G.t / K;
    if (TRACE && Math.floor(t * 4) !== Math.floor((t - FR) * 4)) console.error('TR', t.toFixed(2), P.state, 'sw', +!!P.skill.swinging, 'act', act?.kind ?? '-', act?.want ?? '', 'wind', +!!uq.winding, 'hold', uq.hold?.st ?? '-', 'st', P.stamina.value.toFixed(0), 'd', P.foeDistance().toFixed(2), 'hand', P.handOffset.x.toFixed(2), P.handOffset.y.toFixed(2), 'tilt', P.tiltDeg?.().toFixed(0), 'win', +!!W.open, 'arm', +!!W.spinArm?.armed);
    const seen = hist.findLast((s) => s.t <= t - REACT + 1e-8);
    const busy = P.stamina.exhausted || !!P.skill.secretPhase;
    if (!P.openHold && activeStart == null) activeStart = G.t;
    // 칼끝 돌려 빼기 손 (이탈리아 — 칼끼리 새 닿음을 느끼면 0.25 ~ 0.95 s 뒤 탭 · 85 % — special_balance cavTouch 와 같은 손)
    if (school === 'italian' && seen?.touch && seen.touch !== touchSeen) {
      touchSeen = seen.touch;
      if (rnd() < 0.85) cavTapAt = t + 0.25 + rnd() * 0.7 - REACT;
    }
    if (cavTapAt != null && t >= cavTapAt && !act && !busy) {
      cavTapAt = null;
      begin({ kind: 'tap', seconds: 0.07, want: 'cavazione' });
    }
    if (school === 'iberian' && seen?.spin && act?.kind === 'move') readEnd(act), (act = null), (nextDec = t); // 무장 표시를 보면 걸음을 멈추고 원 (사람 — 창이 열린 동안)
    if (activeStart != null && P.alive && A.alive && !busy && !act && t >= nextDec && seen) {
      begin(decide(seen));
      nextDec = t + 0.35;
    }
    let guardPress = false;
    let sx = 0.14 * Math.sin(t * 0.65 + seed);
    let sy = seen ? (seen.dist > M.contact + 0.18 ? 0.7 : seen.dist < 0.7 ? -0.4 : 0) : 0;
    if (act) {
      const age = t - act.t;
      guardPress = act.kind === 'guard';
      if (act.side != null) sx = act.side;
      if (act.fwd != null) sy = act.fwd;
      let done = false;
      if (act.kind === 'stroke') {
        if (TRACE2 && act.want && uq.cur && uq.cur !== act.seenCur) (act.seenCur = uq.cur), console.error('ST', act.want, act.base, '->', uq.cur.tech, uq.cur.unique ?? '-', 'pad', uq.cur.pad, 'stick', P.stickX.toFixed(2), P.stickY.toFixed(2), 'tech', strokeTechOf(P), 'busy', uq.busy(), 'on', UA.on, 'sec', !!P.skill.sec, 'pom', !!P.skill.pom, 'vr', !!P.skill.vitalRange, 'brk', !!P.weaponBroken, 'fin', P.finish?.amt, 'blk', uq.blocked, P.state, 'tap', !!P.skill.tap, 'cool', uq.coolLeft?.(act.want));
        if (act.q.length && !busy) {
          const [dx, dy] = act.q.shift();
          ev('pointermove', dx, dy);
        }
        if (!act.q.length) {
          if (act.bindAfter && !act.bindT) act.bindT = t;
          done = !act.bindAfter || t - act.bindT >= act.bindAfter;
          if (act.bindAfter && !done) sy = 0.3;
          if (done && act.thenClose) { if (hand) ev('pointerup'); prevAct = act; act = { kind: 'close', seconds: 2.0, want: secretName, t, fired0: act.fired0 }; acts.close = (acts.close ?? 0) + 1; done = false; } // 11/14 독일 봇: 겹치기 뒤 붙음 (모르트슐라크 이음)
        }
      } else if (act.kind === 'circle') {
        const z = Math.min(1, age / act.seconds);
        const pt = circlePt(z);
        const pv = act.prev ?? [0, 0];
        if (!busy) ev('pointermove', pt[0] - pv[0], pt[1] - pv[1]);
        act.prev = pt;
        done = z >= 1;
      } else if (act.kind === 'bind') {
        // 상대 칼 쪽으로 손을 천천히 (칼끼리 덮음 — 칼 0.25 자리 → 상대 칼 0.65 자리 · 0.6 패드 m/s)
        const a = P.bladePoint(0.25, new THREE.Vector3());
        const b = A.bladePoint(0.65, new THREE.Vector3());
        const d = b.sub(a).applyQuaternion(P.yaw.clone().invert());
        const want = [Math.max(-0.5, Math.min(0.5, P.handOffset.x + d.z * 0.2)), Math.max(-0.3, Math.min(0.45, P.handOffset.y + (d.y + 0.03) * 0.2))];
        const dx = want[0] - P.handOffset.x;
        const dy = want[1] - P.handOffset.y;
        const dd = Math.hypot(dx, dy);
        const k = dd ? Math.min(1, (0.6 * FR) / dd) : 0;
        if (!busy) ev('pointermove', dx * k, dy * k);
        done = age >= act.seconds;
      } else if (act.kind === 'hold') {
        // 정수리 가르기: 누른 채(끌지 않음) 감고 걸어 들어가 releaseAt 안이면 뗌 · 4 s 넘으면 뗌
        sy = P.foeDistance() < M.contact + 0.1 ? 0 : 0.6;
        if (uq.winding && P.foeDistance() <= act.releaseAt) done = true;
        if (age > act.seconds || (!uq.winding && age > UA.rdHoldTime / K + 0.4)) done = true;
      } else if (act.kind === 'close') {
        sy = P.foeDistance() > 0.7 ? 0.9 : 0.3; // 붙어 있음 (0.8 m 안)
        done = age >= act.seconds || !!W.open;
      } else if (act.kind === 'dig') {
        // 11/14 파고들기 (독일 봇): 서 있을 때까지 스틱 0(두 발 땅 · 골반 거의 멈춤 — 박차기의 '서 있음' · 0.5 s 까지) → 곧장 앞 1.0 (가슴 사이 1.0 m 안이 되면 밀치기가 남)
        const g = P.gait;
        if (!act.go && (age > 0.5 || (g && g.legs.F.stance && g.legs.B.stance && !g.walking && Math.hypot(g.vf.x, g.vf.z) < GAIT_STAND))) act.go = age;
        sx = 0;
        sy = act.go != null ? 1 : 0;
        done = age >= act.seconds || !!W.open;
      } else if (act.kind === 'sideTap') {
        sy = 0;
        if (!act.tapped && age >= act.tapAt) {
          ev('pointerup'); // 짧은 톡 (누름 → 곧 뗌 = 탭)
          act.tapped = true;
        }
        done = age >= act.seconds;
      } else if (act.kind === 'retreatTap') {
        sx = 0;
        sy = -0.8;
        if (age >= act.seconds) {
          ev('pointerdown');
          act = { kind: 'tap', seconds: 0.07, t, want: act.want, fired0: act.fired0 };
        }
      } else if (act.kind === 'wait') {
        sx = 0;
        done = age >= act.seconds || !!W.open;
      } else done = age >= (act.seconds ?? 0.5);
      if (done && act) {
        if (hand) ev('pointerup');
        prevAct = act; // 읽힘은 다음 뜻이 시작될 때 닫음 (늦은 스틱 — 긋기가 끝나 가며 읽힌 것까지)
        act = null;
        nextDec = Math.max(nextDec, t + 0.25);
      }
    }
    if (P.openHold) (sx = 0), (sy = 0), (guardPress = false);
    if (botHook) { const o = botHook({ t, sx, sy, guardPress, seen }); if (o) ({ sx, sy, guardPress } = { sx, sy, guardPress, ...o }); } // 재는 도구 손 (kote_pickup.mjs — 칼을 놓치면 칼로 걸어가 줍기) · 없으면 그대로
    // ── main.js playerInputFrame 과 같은 차례 ──
    const d = input.consumeHandDelta();
    let taps = input.consumeTaps();
    if (P.stamina.exhausted) (d.x = 0), (d.y = 0), (taps = 0);
    const closeGate = closeInputGate(P, W); // 붙은 거리 규칙 (11/14 — main.js 와 같은 차례)
    let secBusy = busy || closeGate.lock;
    const swipe = Math.hypot(d.x, d.y) / FR >= CONFIG.SKILL.swingSpeed;
    input.stickMove = { x: sx, y: sy };
    const atkWin = !!W.open && !W.stickOwns() && !W.circleOwns() && !W.holdOwns();
    const stickGo = !!W.spinStick(FR, input.move, !secBusy && P.alive && closeGate.secretOk);
    const circleGo = !!W.spinCircle(FR, d, hand, !secBusy && P.alive && closeGate.secretOk);
    if (uq.cingirE && !closeGate.near && uq.circleTick(FR, d, hand, !secBusy && P.alive)) secBusy = true; // 11/11 싱지르 특수 공격 (main.js 와 같은 차례)
    const gilReady = !!W.S?.do?.gilmok && !!W.gilArm?.armed;
    const secArm = !(CONFIG.SECRET.secretHold && (P.skill.tap || P.skill.pom));
    if ((((atkWin || gilReady) && (taps > 0 || (swipe && !W.S?.do?.tapOnly))) || stickGo || circleGo) && !secBusy && P.alive && secArm && closeGate.secretOk) {
      const o = W.open ? W.fire() : W.fireArmed();
      if (o) o.dir = [d.x, d.y];
      if (P.skill.secret(o)) secBusy = true;
    }
    if (P.alive && (closeGate.lock || !secBusy) && closeInputApply(P, closeGate, d, taps, swipe, FR)) taps = 0; // 붙은 거리 규칙 (11/14 — 묶임 · 칼자루만)
    if (!secBusy && P.alive && (taps > 0 || swipe) && W.canBuffer()) W.buffer([d.x, d.y]);
    const bufHold = !secBusy && !!W.bufferHold;
    if (secBusy || bufHold) taps = 0;
    guard.held = guardPress;
    P.pickupPress = guardPress; // 떨어진 칼 줍기 'block' (main.js playerInputFrame 과 같은 차례 — 막기 단추 = 줍기 누름)
    if (guard.broken && (!guard.held || (!P.skill.swinging && !P.skill.tap && !swipe && taps === 0))) guard.broken = false;
    if (guard.held && !bufHold && (swipe || taps > 0)) guard.broken = true;
    const guardHold = guard.held && !guard.broken && !secBusy;
    uq.feed(d.x, d.y, FR, guardHold || bufHold || guard.held, guardHold || bufHold);
    if (uq.holdE) {
      const hs0 = input.holdState();
      const hs = closeGate.lock || closeGate.near ? { ...hs0, down: false } : hs0; // 붙은 거리 규칙 (11/14 — main.js 와 같음)
      uq.holdInput(hs.down && !P.stamina.exhausted, hs.still, !!W.open, W.holdOwns());
    }
    const winding = !!uq.winding;
    if (P.alive && !secBusy && !guardHold && !bufHold && !winding) (P.handOffset.x += d.x), (P.handOffset.y += d.y);
    P.handHeld = hand;
    P.inputActive = !secBusy && !bufHold && !winding && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    const pr = input.press;
    P.handGrip = pr ? pr.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx) : P.inputActive;
    if (taps > 0 && P.alive) P.skill.thrust();
    const m = input.move;
    const feet = P.alive && !P.stamina.exhausted && P.skill.secretPhase !== 'stiff';
    P.move.set(feet ? m.x : 0, feet ? m.y : 0);
    P.stickX = feet ? m.x : 0;
    P.stickY = feet ? m.y : 0;
  };
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    if (W.queued && !P.skill.sec && P.alive) {
      const o = W.fire();
      if (o) P.skill.secret(o);
    }
    guard.step(DT);
    if (guard.active) (P.inputActive = true), (P.handHeld = true);
  };
  // ── 기술 기록 ──
  const fires = [];
  let cur = null;
  let swingId = null; // 긋기 하나 = 봇 긋기 한 번 (모서리에서 손 빠르기가 문턱 밑으로 잠깐 내려가도 같은 기술 — 손가락 한 획)
  let wasSwing = false;
  const attackNow = () => {
    if (P.skill.sec) return P.skill.sec.special ? { id: P.skill.sec, name: P.skill.sec.special, cls: 'snap' } : { id: P.skill.sec, name: P.skill.sec.S?.name ?? secretName ?? 'secret', cls: 'secret' }; // 11/11 싱지르 특수 공격 = 특수 공격 칸
    if (P.iai?.tech) return P.iai.secret ? { id: P.iai, name: P.iai.secret, cls: 'secret' } : { id: P.iai, name: P.iai.tech, cls: 'snap' }; // 11/11 비기 알티바슈 포르트 (운동학 칼 · f.iai.secret)
    if (P.skill.tap) return { id: P.skill.tap, name: strokeTechOf(P) ?? 'tap', cls: 'tap' };
    if (P.skill.swinging && swingId) return { id: swingId, name: strokeTechOf(P) ?? 'basic', cls: 'swing' }; // 봇 긋기 동안의 휘두름만 (막기 단추 · 자동 막기가 손을 옮겨 휘두름이 서는 것은 낸 기술이 아님)
    return null;
  };
  const wounds = { dealt: 0, recv: 0, dealtN: 0, recvN: 0, consD: 0, consR: 0 };
  const cons = { P: P.consciousness, A: A.consciousness }; // 의식 (둔타 · 머리 — 칼날 심각도에 안 잡히는 피해: 스텝 전 값과 견줌)
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    const who = vic === P ? 'P' : 'A';
    const dc = Math.max(0, cons[who] - vic.consciousness);
    cons[who] = vic.consciousness;
    if (att === A && vic === P) {
      wounds.recv += sv;
      wounds.consR += dc;
      if (sv > 0 || dc > 0.05) wounds.recvN++;
      for (const f of fires) if (G.t - f.t <= K + 1e-9) (f.recv1 += sv), (f.consR1 += dc), (f.recvN1 += sv > 0 || dc > 0.05 ? 1 : 0);
      return;
    }
    if (att !== P || vic !== A) return;
    wounds.dealt += sv;
    wounds.consD += dc;
    if (sv > 0) wounds.dealtN++;
    const f = cur && G.t - cur.t <= 1.5 * K ? cur : null;
    if (!f) return;
    f.contacts++;
    if (sv > 0 || dc > 0.05) f.wounds++;
    f.cons += dc;
    f.sev += sv;
    f.Emax = Math.max(f.Emax, r.energy ?? 0);
    f.types[r.type] = (f.types[r.type] ?? 0) + 1;
  };
  const stand0 = { P: P.state, A: A.state };
  const falls = { P: 0, A: 0 };
  let end = null;
  const tEnd = () => (activeStart ?? 0) + dur * K;
  let nextFrame = 0;
  let exhT = 0;
  const brk = { P: null, A: null };
  let armedA = A.armed;
  let disarms = 0; // 칼 부러짐 (판 시작부터 실제 s) — 부러진 칼은 고유 공격이 안 남 (unique_assist busy)
  probe?.init?.({ G, P, A, uq, W, guard }); // 읽기만 (난수 · 몸 그대로)
  try {
    while (activeStart == null || G.t < tEnd()) {
      if (G.t / K >= nextFrame - 1e-8) {
        frame();
        nextFrame += FR;
      }
      cons.P = P.consciousness;
      cons.A = A.consciousness;
      G.step();
      if (activeStart != null && P.stamina.exhausted) exhT += DT;
      if (P.weaponBroken && brk.P == null) brk.P = r3((G.t - (activeStart ?? 0)) / K);
      if (A.weaponBroken && brk.A == null) brk.A = r3((G.t - (activeStart ?? 0)) / K);
      const sw = !!P.skill.swinging;
      if (sw && !wasSwing) swingId = act?.kind === 'stroke' ? act : null;
      wasSwing = sw;
      const a = attackNow();
      if (a && a.id !== cur?.id && cur && cur.name === 'basic' && cur.contacts === 0 && G.t - cur.t < 0.15 * K) Object.assign(cur, { id: a.id, name: a.name, cls: a.cls }); // 긋기가 곧 강화 탭 · 끌고 가는 칼로 바뀜 (위에서 내려 찌르기 등 — 한 기술)
      else if (a && a.id !== cur?.id) {
        cur = { id: a.id, t: G.t, name: a.name, cls: a.cls, dist0: P.foeDistance(), base: act?.base ?? act?.kind ?? null, want: act?.want ?? null, stick: [r3(P.stickX), r3(P.stickY)], dis1: false, contacts: 0, wounds: 0, sev: 0, cons: 0, Emax: 0, types: {}, recv1: 0, consR1: 0, recvN1: 0, fall1: false, kill1: false, st0: P.stamina.value };
        fires.push(cur);
        if (fires.length > 1) fires[fires.length - 2].st1 ??= P.stamina.value;
      } else if (a && cur && (cur.name === 'basic' || cur.name === 'tap') && a.name !== cur.name && G.t - cur.t < 0.3 * K) cur.name = a.name; // 강화 · 걸음 기술 이름이 몇 스텝 늦게 섬
      else if (attrib !== 'old' && a && cur && a.id === cur.id && a.cls === 'swing' && cur.name === 'basic' && a.name !== 'basic') {
        // 같은 봇 긋기인데 게임이 기술로 읽은 것이 0.3 s 넘어 늦음 (11/05 고침 — 시작 자리로 가는 손이 휘두르기(skill.swinging — 기력 박자로 빨라 보임)로 잡혀 기록이 거기서 'basic' 으로 열렸음:
        //  걸음 공격 읽힘이 15 ~ 33 % 로 적혔던 몫의 대부분). 기록을 읽힌 때로 옮기고 그 전 몫(가는 손)은 버림 · `--attrib=old` = 전 판
        Object.assign(cur, { name: a.name, t: G.t, dist0: P.foeDistance(), stick: [r3(P.stickX), r3(P.stickY)], contacts: 0, wounds: 0, sev: 0, cons: 0, Emax: 0, types: {}, recv1: 0, consR1: 0, recvN1: 0, fall1: false, kill1: false, dis1: false, st0: P.stamina.value });
      }
      probe?.step?.(cur, act);
      for (const who of ['P', 'A']) {
        const f = who === 'P' ? P : A;
        if (stand0[who] === 'stand' && f.state !== 'stand' && f.state !== 'dead') {
          falls[who]++;
          if (who === 'P') for (const x of fires) if (G.t - x.t <= K + 1e-9) x.fall1 = true;
        }
        stand0[who] = f.state;
      }
      if (!A.alive) for (const x of fires) if (!x.kill1 && G.t - x.t <= K + 1e-9 && x.contacts > 0) x.kill1 = true;
      if (armedA && !A.armed && A.alive) {
        disarms++;
        for (const x of fires) if (G.t - x.t <= K + 1e-9) x.dis1 = true; // 칼 떨굼 (손목 치기 등)
      }
      armedA = A.armed;
      if (activeStart != null) hist.push(sense()), hist.length > 120 && hist.shift();
      if ((!P.alive || !A.alive) && end == null) end = G.t + 0.5;
      if (end != null && G.t >= end) break;
    }
    readEnd(prevAct);
    readEnd(act);
    const T = ((Math.min(G.t, tEnd()) - (activeStart ?? 0)) / K);
    return {
      school, weapon, opp, seed, T: r3(T),
      win: !A.alive && P.alive, lose: !P.alive && A.alive,
      dealt: r3(wounds.dealt), recv: r3(wounds.recv), dealtN: wounds.dealtN, recvN: wounds.recvN, consD: r3(wounds.consD), consR: r3(wounds.consR), falls, exh: r3(exhT / K / Math.max(1e-6, T)),
      secretFired: fires.filter((f) => f.cls === 'secret').length, brk, disarms,
      secretLeft: secretLeft(P), wants, acts, reads, altib: uq.stats.altib ?? null, // 11/11 알티바슈 포르트: 낸 수 · 남은 기력 몫(k) · 뗀 까닭
      aiStats: { altib: G.ai.stats.altib ?? null, cingir: G.ai.stats.cingir ?? null, specials: G.ai.stats.specials ?? null },
      fires: fires.map((f) => ({ t: r3(f.t / K), name: f.name, cls: f.cls, d: r3(f.dist0), c: f.contacts, w: f.wounds, sev: r3(f.sev), cons: r3(f.cons), E: r3(f.Emax), ty: f.types, r1: r3(f.recv1), cr1: r3(f.consR1), rn1: f.recvN1, f1: f.fall1, k1: f.kill1, dis1: f.dis1, base: f.base, want: f.want, stick: f.stick, st: r3(f.st0 - (f.st1 ?? P.stamina.value)) })),
      ...(probe?.done ? { probe: probe.done(fires) } : {}),
    };
  } finally {
    G.world.free();
  }
}

// ── 묶음 · 표 ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const f1 = (x, k = 2) => (x == null ? '–' : x.toFixed(k));
/** 판 묶음 → 칸 표 줄 */
export function cellRow(runs) {
  const n = runs.length;
  const T = runs.reduce((s, r) => s + r.T, 0);
  return { n, win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length, dealt: mean(runs.map((r) => r.dealt)), recv: mean(runs.map((r) => r.recv)), consD: mean(runs.map((r) => r.consD ?? 0)), consR: mean(runs.map((r) => r.consR ?? 0)), fallsP: mean(runs.map((r) => r.falls.P)), fallsA: mean(runs.map((r) => r.falls.A)), T: T / n, exh: mean(runs.map((r) => r.exh ?? 0)), secret: mean(runs.map((r) => r.secretFired ?? 0)) };
}
/** 기술마다 (판 묶음 안 모든 낸 것) */
export function techRows(runs) {
  const T = runs.reduce((s, r) => s + r.T, 0);
  const by = {};
  for (const r of runs) for (const f of r.fires) (by[f.name] ??= []).push(f);
  return Object.entries(by).map(([name, fs]) => {
    const hit = fs.filter((f) => f.w > 0);
    return { name, n: fs.length, perMin: (fs.length / T) * 60, hit: hit.length / fs.length, contact: fs.filter((f) => f.c > 0).length / fs.length, sevHit: mean(hit.map((f) => f.sev)), consHit: mean(hit.map((f) => f.cons ?? 0)), Ehit: mean(fs.filter((f) => f.c > 0).map((f) => f.E)), Emax: Math.max(0, ...fs.map((f) => f.E ?? 0)), kill1: fs.filter((f) => f.k1).length / fs.length, recv1: mean(fs.map((f) => f.r1)), hitBack1: fs.filter((f) => f.rn1 > 0).length / fs.length, fall1: fs.filter((f) => f.f1).length / fs.length };
  }).sort((a, b) => b.n - a.n);
}
export function aggMarkdown(runs) {
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = [];
  out.push('| 칸 (유파 · 무기 · 상대) | 판 | 이김 | 짐 | 비김 | 준 심각도/판 | 받은 심각도/판 | 준 의식/판 | 받은 의식/판 | 내 넘어짐/판 | 상대 넘어짐/판 | 지침 몫 | 비기 낸 수/판 | 판 길이 s |');
  out.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
  for (const [k, rs] of Object.entries(cells)) {
    const c = cellRow(rs);
    out.push(`| ${k} | ${c.n} | ${c.win} | ${c.lose} | ${c.n - c.win - c.lose} | ${f1(c.dealt)} | ${f1(c.recv)} | ${f1(c.consD)} | ${f1(c.consR)} | ${f1(c.fallsP)} | ${f1(c.fallsA)} | ${pct(c.exh * 100, 100)} | ${f1(c.secret)} | ${f1(c.T, 1)} |`);
  }
  for (const [k, rs] of Object.entries(cells)) {
    out.push('', `### ${k}`, '', '| 기술 | 낸 수 | 분당 | 몸 닿음 | 맞음 | 맞음당 심각도 | 맞음당 의식 | 닿음당 J | 가장 큰 J | 1 s 안 쓰러뜨림 | 1 s 안 받은 심각도 | 1 s 안 맞받음 | 1 s 안 넘어짐 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const t of techRows(rs)) out.push(`| ${t.name} | ${t.n} | ${f1(t.perMin, 1)} | ${pct(t.contact * t.n, t.n)} | ${pct(t.hit * t.n, t.n)} | ${f1(t.sevHit)} | ${f1(t.consHit)} | ${f1(t.Ehit, 0)} | ${f1(t.Emax, 0)} | ${pct(t.kill1 * t.n, t.n)} | ${f1(t.recv1)} | ${pct(t.hitBack1 * t.n, t.n)} | ${pct(t.fall1 * t.n, t.n)} |`);
  }
  const R = readsMarkdown(runs);
  if (R) out.push('', R);
  return out.join('\n');
}
/**
 * 낸 뜻 → 게임이 읽은 것 (11/05 — 판 결과의 reads · 봇 한 번 동안 unique_assist 가 낸 고유 공격): 칸마다 고유 공격 이름 하나씩 —
 *  뜻 = 봇이 그 이름을 내려 한 수 · 읽힘 = 그 가운데 게임이 그 이름을 낸 수 · 뜻 없이 = 봇이 다른 것(기본 긋기 · 다른 기술 · 막기 등)을 하려 한 수 가운데 그 이름이 난 수 (긋기 · 탭인 뜻 수 중)
 */
export function readsMarkdown(runs) {
  const cells = {};
  for (const r of runs) if (r.reads) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(...r.reads);
  const out = [];
  for (const [k, rd] of Object.entries(cells)) {
    const names = new Set(rd.flatMap((x) => x.fired));
    for (const x of rd) if (x.want && rd.some((y) => y.fired.includes(x.want))) names.add(x.want);
    const strokeLike = rd.filter((x) => ['stroke', 'tap', 'sideTap', 'retreatTap'].includes(x.kind));
    const rows = [...names].map((n) => {
      const want = rd.filter((x) => x.want === n);
      const other = strokeLike.filter((x) => x.want !== n);
      return `| ${k} | ${n} | ${want.length} | ${want.filter((x) => x.fired.includes(n)).length} (${pct(want.filter((x) => x.fired.includes(n)).length, want.length)}) | ${other.filter((x) => x.fired.includes(n)).length} / ${other.length} (${pct(other.filter((x) => x.fired.includes(n)).length, other.length)}) |`;
    });
    if (rows.length) out.push(...rows);
  }
  if (!out.length) return '';
  return ['### 낸 뜻 → 게임이 읽은 고유 공격', '', '| 칸 | 고유 공격 | 뜻 | 읽힘 | 뜻 없이 남 (다른 긋기 · 탭 가운데) |', '|---|---|---:|---:|---:|', ...out].join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(aggMarkdown(runs));
  } else {
    applySets(arg('set', ''));
    const cells = arg('cells', CELLS.join(',')).split(',');
    const seeds = range(arg('seeds', '1-24'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = fightOne({ school, weapon, opp, seed, dur: +arg('dur', 30), tech: +arg('tech', 0.35), focus: arg('focus', null), secret: arg('secret', '1') !== '0', drop: arg('drop', '').split(',').filter(Boolean), attrib: arg('attrib', 'new') });
        runs.push(r);
        console.error(JSON.stringify({ c, seed, win: r.win, lose: r.lose, T: r.T, dealt: r.dealt, recv: r.recv, fires: r.fires.length, ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set: arg('set', ''), cells, seeds, runs }));
    console.log(aggMarkdown(runs));
  }
}
