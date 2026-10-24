// 이탈리아 거침없이 나아가 찌르기 (안다레 리솔루토) — 노리는 사람 손맛 측정 (10/22 — docs/strike/italian_risoluto_2026-10-22.md). 판정 · 실행은 게임 함수 그대로(읽기만).
//  운전(노리는 사람 흉내): 칼끝 쪽 절반이 보이면 내 칼 손 쪽 절반을 그 위로 옮긴다(손 빠르기 V 패드 m/s — 휘두르기 문턱 SKILL.swingSpeed 1.5 아래, 칼 위로 3 cm 를 노림) ·
//   스틱 앞으로 걸어 들어감(맞붙는 거리 clinch 에서 멈춤) · 창(금색 '!')이 열리면 REACT 초 뒤 탭 하나(main.js 와 같은 차례: 프레임 머리 fire → skill.secret) · 그 밖엔 치지 않음.
//  상대 = 인물 AI(시트 숙련도 · 성격).
//  실행: node tools/sim/risoluto_play.mjs [T 0.6] [두 번째 길 0|1] [씨앗 3] [초 30] [무기 rapier,dartagnan] [인물 isolde,tome,omari,minami,liao] [V 0.6] [REACT 0.25]
//  시험 스위치 (환경 변수 — 판 기본은 그대로, 감독 10/22 비교):
//   RISO_CLOSE=1 '다 붙었을 때' 창(SECRET.risolutoClose) · RISO_LINE=1 칼을 대지 않는 덮음(줄 막기 — SECRET.risolutoLine) · RISO_COVER=수 덮음 거리
//   RISO_GUARD=1 막기 단추를 누른 채 걸어 들어감(SECRET.risolutoGuard — 운전: 가슴 사이 3 m 안에서 누르고 쥠 · 손은 막기 단추가 쥠 · 탭은 같은 엄지라 단추를 놓고 · 비기가 끝나면 다시 누름) ·
//   RISO_OPP=0 막아찌르기 끔(SKILL.itOpposition) · RISO_PLAIN=1 대조(같은 때의 보통 탭 — 팔 늦춤 · 비기 배율 끔)
//   10/24 런지(기본 — SECRET.risolutoLunge): RISO_LUNGE=0 = 10/23 판(탭 찌르기 · 팔 늦춤 0.4 · 굳음 0.4 — main.js ?risoLunge=0 과 같은 값) · RISO_SHARE=수 칼끝 빠르기 몫 · RISO_GLIDE=0 붙은 칼 미끄러짐 끔
//   10/24 13:2x 런지 간격 조건(기본 — SECRET.risolutoGap): RISO_GAP=0 = 조건 없음 · 운전 갈래 RISO_STOP=1(창이 보이면 섬) · RISO_CREEP=수(칼이 붙으면 스틱을 그 몫만 — 천천히 밀고 들어감) ·
//    RISO_DUMP=1(열린 창 한 줄씩 'WIN 무기 인물 길 가슴사이 맞닿기 맞붙기' — 대안 셈용) · 실제로 열린 창 · 가까워 안 뜸(gapBlocked) · 뜬 뒤 닫힘(gapClosed) · 열린 때 가슴 사이 · 맞붙는 거리 밖 여유
//    런지 재기: 칼끝 빠르기(찌르는 스텝의 칼끝 옮김 ÷ 스텝 — 같은 칼 고노센 칼끝 iaiTipSpeed 와 견줌) · 맞힘마다 에너지 · 심각도 · 굳음 동안(되돌아오는 몫) 입은 상처 ·
//    몸(비기를 낸 때부터 굳음이 끝날 때까지 골반 옮김 · 몸통 기울기 최대 · 골반 가장 낮음 · 넘어짐/주저앉음 — 낸 뒤 1.5 s 안에 서 있지 않음) · 런지 막힘(떨어졌다 다시 닿음) · 붙은 칼 따라 미끄러짐
//   10/24 14:0x 런지 되돌아오기(기본 — SECRET.risolutoStep.recover): RISO_OLDSTEP=1 = 14:0x 전 걸음(뒷발 끌어붙임 · 앞발 거둠 없음 — main.js ?risoRecover=0 과 같은 값) ·
//    되돌아오기 재기: 앞발을 거둔 번 수 · 런지 시작부터 걸린 때 · 거둔 길이 · 상대가 살아 있을 때 가슴 사이(거둘 때 → 0.6 s 뒤)
//   10/25 01:0x 칼끝 얽힘 창(기본 — SECRET.risolutoTouch): RISO_TOUCH=0 = 10/24 판(이어짐 0.6 s 를 기다림) ·
//    재기: 칼끼리 처음 가까워진 때(어느 부위든 0.07 · 맞닿음 — 0.2 s 넘게 떨어졌다 다시 붙은 때도) 가슴 사이 p10 · p50 · p90 · 그때 막은 조건 · 열린 창 가슴 사이 p10 · p50 · p90 · 탭 때 창이 이미 닫힘(tapLost)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch, bladesTouch } from '../../src/secret.js';
import { coverDist, meFree, stickForward, lungeGap } from '../../src/italian_risoluto.js';
import { swingingNow } from '../../src/school_passive.js';
import { segDist } from '../../src/skill.js';
import { iaiTipSpeed } from '../../src/secret_instant.js';
import * as THREE from 'three';

const [Targ = '0.6', beatArg = '0', seedsArg = '3', simArg = '30', wArg = 'rapier,dartagnan', fArg = 'isolde,tome,omari,minami,liao', vArg = '0.6', rArg = '0.25'] = process.argv.slice(2);
const E = process.env;
CONFIG.SECRET.risolutoHold = +Targ;
if (beatArg !== '-') CONFIG.SECRET.risolutoBeat = +beatArg ? 1 : 0; // '-' = 판 값 그대로
if (E.RISO_COVER) CONFIG.SECRET.risolutoCover = +E.RISO_COVER;
if (E.RISO_CLOSE === '1') CONFIG.SECRET.risolutoClose = 1;
if (E.RISO_LINE === '1') CONFIG.SECRET.risolutoLine = 1;
// 10/23 넓은 판정 묶음 RISO_WIDE=1 (칼 어느 부위든 · 너그러움 0.2 · 가슴 사이 조건 뺌 · 다 붙음 · 상대 박자) · RISO_WIDE=0 (10/22 판) — 낱낱이: RISO_ANY · RISO_GRACE · RISO_CLOSING · RISO_CLOSE · 두 번째 길 인자
if (E.RISO_WIDE === '1') Object.assign(CONFIG.SECRET, { risolutoAnyPart: 1, risolutoGrace: 0.2, risolutoClosing: 0, risolutoClose: 1, risolutoBeat: 1 });
if (E.RISO_WIDE === '0') Object.assign(CONFIG.SECRET, { risolutoAnyPart: 0, risolutoGrace: 0, risolutoClosing: 1, risolutoClose: 0, risolutoBeat: 0, risolutoTouch: 0 });
if (E.RISO_ANY) CONFIG.SECRET.risolutoAnyPart = +E.RISO_ANY;
if (E.RISO_GRACE) CONFIG.SECRET.risolutoGrace = +E.RISO_GRACE;
if (E.RISO_CLOSING) CONFIG.SECRET.risolutoClosing = +E.RISO_CLOSING;
if (E.RISO_CLOSE === '0') CONFIG.SECRET.risolutoClose = 0;
if (E.RISO_BEAT) CONFIG.SECRET.risolutoBeat = +E.RISO_BEAT;
const GUARD = E.RISO_GUARD === '1';
if (GUARD) CONFIG.SECRET.risolutoGuard = 1;
if (E.RISO_OPP === '0') CONFIG.SKILL.itOpposition = 0;
// 대조 RISO_PLAIN=1: 같은 때의 보통 탭 찌르기 — 상대 팔 늦춤 끔(FLOW_RECOVERY.seconds 0) · 비기 배율 1 (AI 비기는 닫혀 있어 사람 쪽만 바뀜)
const PLAIN = E.RISO_PLAIN === '1';
if (PLAIN) { CONFIG.FLOW_RECOVERY.seconds = 0; CONFIG.SECRET.risolutoArmSlow = 0; CONFIG.SECRET.power = 1; CONFIG.SECRET.hitMul = 1; }
if (E.RISO_LUNGE === '0') Object.assign(CONFIG.SECRET, { risolutoLunge: 0, risolutoArmSlow: PLAIN ? 0 : null, risolutoStiff: null }); // 10/23 판
if (E.RISO_SHARE) CONFIG.SECRET.risolutoShare = +E.RISO_SHARE;
if (E.RISO_GLIDE) CONFIG.SECRET.risolutoGlide = +E.RISO_GLIDE; // 0 = 붙은 칼 따라 미끄러짐 끔 (연환과 같은 막힘)
if (E.RISO_GAP) CONFIG.SECRET.risolutoGap = +E.RISO_GAP; // 10/24 13:2x 런지 간격 조건 — 0 = 간격 조건 없음 (12:1x 판)
if (E.RISO_TOUCH) CONFIG.SECRET.risolutoTouch = +E.RISO_TOUCH; // 10/25 01:0x 칼끝 얽힘 창 — 0 = 10/24 판 (이어짐 0.6 s 를 기다림)
const STOP = E.RISO_STOP === '1';
const CREEP = +E.RISO_CREEP || 0; // 운전: 칼끼리 가까운 동안 스틱을 이 몫만 (천천히 밀고 들어감 — 간격 조건 판을 아는 사람 흉내 · 0 = 늘 1) // 운전: 창(금색 '!')이 보이면 스틱을 놓고 선다 (간격 조건 판을 아는 사람 흉내 — 기본은 늘 같은 운전)
if (E.RISO_OLDSTEP === '1') CONFIG.SECRET.risolutoStep = { slide: 'iaiStep', foot: 'italianStep', draw: 1, room: 0 }; // 10/24 14:0x 전 걸음 (뒷발 끌어붙임 · 몸 가속 · 따라감 배율 · 앞발 거둠 없음)
if (E.RISO_ROOM) CONFIG.SECRET.risolutoStep = { ...CONFIG.SECRET.risolutoStep, room: +E.RISO_ROOM }; // 0 = 앞발 런지 걸음을 가슴 사이로 줄이지 않음 (늘 italianStep)
const LUNGE = !!CONFIG.SECRET.risolutoLunge;
const SEEDS = +seedsArg, SIM = +simArg, V = +vArg, REACT = +rArg;
const weapons = wArg.split(','), foes = fArg.split(',');
const v3 = () => new THREE.Vector3();
const a0 = v3(), a1 = v3(), b0 = v3(), b1 = v3(), pa = v3(), pb = v3(), _d1 = v3(), _d2 = v3(), _r = v3();
/** 두 선분 가장 가까운 점 (운전이 '눈으로 보는' 상대 칼 — pa 내 쪽 · pb 상대 쪽) */
function closest(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r), c = _d1.dot(_r), b = _d1.dot(_d2), den = a * e - b * b;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  pa.copy(p1).addScaledVector(_d1, s); pb.copy(p2).addScaledVector(_d2, t);
}
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };
const KEYS = ['rounds', 'win', 'winFar', 'winHold', 'winClose', 'winBeat', 'winTouch', 'touch', 'tapLost', 'gapBlocked', 'gapClosed', 'hold', 'close', 'beat', 'fired', 'landed', 'blocked', 'whiff', 'hit', 'armSlow', 'dealt', 'taken', 'pDead', 'fDead', 'foeFirst', 'opp', 'oppCover', 'oppWin', 'lineSteps', 'recHit', 'recSev', 'win6Hit', 'win6Sev', 'fall', 'lBlock', 'glide', 'touchMiss', 'kill1'];
// 런지 재기 (10/24): 맞힘마다 에너지 · 심각도 · 칼끝 빠르기 몫 · 몸 (모든 판 모음)
const L = { first: [], firstRound: [], gapHit: [], gapMiss: [], firstN: 0, firstMf: 0, firstFf: 0, firstFw: 0, firstGap: 0, firstAll: 0, recDelay: [], recBack: [], recGap0: [], recGap: [], winGap: [], winMargin: [], coverFar: 0, coverAll: 0, E: [], sev: [], tipShare: [], maxShare: [], tipV: [], tipMax: [], stepV: [], gon: [], pel: [], tilt: [], pelLow: [], slide: [], foot: [], gap0: [], gapMin: [], clinch: 0, zone: {} };
// 막은 조건 (가슴 사이 2.6 m 안 · 둘 다 서 있음 · 비기 실행 아님 — 셈 창일 뿐 판 규칙 아님): 스텝마다 조건 하나하나 · 칼끼리 가까운(어느 부위든) 때 무엇이 막았나 · 끊겼다 0.2 s 안에 다시 붙은 수
const B = { allWide: 0, base: 0, any: 0, cover: 0, mf: 0, ff: 0, fw: 0, cl: 0, all: 0, aCover: 0, aMf: 0, aFf: 0, aFw: 0, aCl: 0, aOnly: 0, rejoin: 0, onEnds: 0 };
const c0 = new THREE.Vector3(), c1 = new THREE.Vector3(), c2 = new THREE.Vector3(), c3 = new THREE.Vector3();
/** 칼끼리 어느 부위든 (칼날 0 ~ 1 두 선분) 가장 가까운 거리 · 실제 맞닿음이면 0 */
const anyDist = (me, foe) => (!me.armed || !foe.armed ? Infinity : me.feel?.touching ? 0 : segDist(me.bladePoint(0, c0), me.bladePoint(1, c1), foe.bladePoint(0, c2), foe.bladePoint(1, c3)));
const rows = [];
for (const w of weapons) for (const id of foes) {
  const C = CHARACTERS_BY_ID[id];
  const R = { w, id, runs: [], ends: { foeSwing: 0, uncover: 0, meSwing: 0, stick: 0, gap: 0 } };
  for (const k of KEYS) R[k] = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const G = newRound({ weapon: w, weapon2: C.weapon, seed, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
    const p = G.player, e = G.enemy;
    p.skill.level = 0.7; p.skill.autoGuard = true; p.canShove = true;
    const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, e);
    if (ps.S?.when !== 'risoluto') throw new Error(`${w}: 리솔루토가 아님 (${ps.S?.name})`);
    let firstSeen = false, nearOn = false, nearOff = -9, tgt = [0.1, 0.05], due = null, seenOpen = 0, run = null, openT = null, oppSeen = 0, lastHurt = -1, gapPrev = null, wasOn = false, offT = -9, recEnd = -9;
    G.onWound = (att, vic, r) => {
      if (vic === p) {
        R.taken += r.severity ?? 0; if ((r.severity ?? 0) > 0) lastHurt = G.t; if (run && !run.hitFoe && (r.severity ?? 0) > 0) run.foeFirst = true;
        // 되돌아오는 몫의 위험: 비기 굳음(런지 0.6 s · 10/23 판 0.4 s) 동안 · 찌르기가 끝난 뒤 0.6 s 창(두 판을 같은 길이로 견줌)
        if ((r.severity ?? 0) > 0 && run && p.skill.sec?.stage === 'stiff') { R.recHit++; R.recSev += r.severity; }
        if ((r.severity ?? 0) > 0 && G.t <= recEnd) { R.win6Hit++; R.win6Sev += r.severity; }
      }
      if (att === p && p.skill.sec?.risoluto) {
        R.dealt += r.severity ?? 0; if (run) { run.wound = true; run.hitFoe = true; }
        L.E.push(r.energy); L.sev.push(r.severity ?? 0); L.zone[`${r.zone}:${r.type}`] = (L.zone[`${r.zone}:${r.type}`] ?? 0) + 1;
      }
    };
    G.before = (t) => {
      // ① 입력 (프레임 머리 — main.js 와 같은 차례): 창이 열린 뒤 REACT 초에 탭 하나
      if (ps.opened !== seenOpen) {
        seenOpen = ps.opened;
        if (ps.open) {
          due = t + REACT; openT = t;
          R.win++; R[{ hold: 'winHold', close: 'winClose', beat: 'winBeat', touch: 'winTouch' }[ps.open.ctx?.path] ?? 'winHold']++; L.winGap.push(p.foeDistance()); // 실제로 열린 창 (간격 조건을 지난 것) · 그때 가슴 사이
          if (E.RISO_DUMP === '1') console.log(`WIN ${w} ${id} ${ps.open.ctx?.path} ${p.foeDistance().toFixed(3)} ${p.swordArt.measure.contact.toFixed(3)} ${p.swordArt.measure.clinch.toFixed(3)}`); // 열린 창 한 줄 (대안 셈용)
          L.winMargin.push(p.foeDistance() - p.swordArt.measure.clinch); // 맞붙는 거리 밖 여유 (런지 앞발을 그만큼까지 줄이는 대안의 셈)
          if (p.foeDistance() >= lungeGap(p)) R.winFar++; // 런지 최소 간격(13:4x 맞닿기 거리) 밖에서 열린 창 (간격 조건 끔 판에서 셈 — 켬 판은 모두)
        }
      }
      if (due != null && t >= due) {
        due = null;
        if (GUARD) pg.held = false; // 폰: 막기 단추와 칼 쪽 화면이 같은 엄지 — 톡 하려면 단추를 놓음
        if (ps.open && !p.skill.secretPhase && p.alive) {
          const o = ps.fire();
          if (!o) R.tapLost++; // 같은 스텝에 간격이 모자라 창이 닫힘 (fire null)
          if (o && p.skill.secret(o)) { R.fired++; const pl = p.bodies.pelvis.translation(); run = { touch: false, wound: false, hitFoe: false, foeFirst: lastHurt >= openT, openT, pain0: e.pain, pained: false, t0: t, pel0: [pl.x, pl.z], tilt: 0, low: pl.y, gap0: p.foeDistance(), gapMin: p.foeDistance(), tipV: 0, gon: iaiTipSpeed(p), stiffAt: null, fallChk: t + 1.5, fell: false, rec0: p.lungeRecovered ?? null, recT: null, recGap0: null, sev0: e.wounds?.length ?? 0 }; } // 상대 칼 먼저: 창이 열린 뒤 내 찌르기가 맞기 전에 내가 상처(심각도 > 0)를 입음
        } else if (!ps.open && p.alive && !p.skill.secretPhase) R.tapLost++; // 탭 때 창이 이미 닫힘 (가까워짐 · 판 상태)
      }
      ps.update(DT, !!p.skill.sec);
      // 막기 단추 운전: 3 m 안에서 누르고 쥠 (비기 실행 · 굳음 동안은 놓아 둠 → 끝나면 다시 누름 = 새 누름)
      if (GUARD) pg.held = !p.skill.sec && p.foeDistance() < 3;
      pg.step(DT);
      if (pg.opposition.starts !== oppSeen) {
        oppSeen = pg.opposition.starts;
        R.opp++;
        if (coverDist(p, e) <= CONFIG.SECRET.risolutoCover || ps.riso.on) R.oppCover++; // 덮인 채(또는 칼끼리 덮인 꼴)에서 막아찌르기가 먼저 나감
        if (ps.open) R.oppWin++;
      }
      // ② 손: 막기 단추가 쥐는 동안 · 비기 실행 · 굳음 동안은 손을 대지 않음 (main.js 가 칼 입력을 막음)
      if (!GUARD && !p.skill.sec && p.armed && e.armed) {
        p.bladePoint(0, a0); p.bladePoint(0.5, a1); e.bladePoint(0.5, b0); e.bladePoint(1, b1);
        closest(a0, a1, b0, b1);
        const dv = pb.clone().sub(pa).applyQuaternion(p.yaw.clone().invert()); // 몸 틀: x 앞 · y 위 · z 칼 든 쪽
        if (p.foeDistance() < 3) tgt = [Math.max(-0.5, Math.min(0.5, tgt[0] + dv.z * 4 * DT)), Math.max(-0.3, Math.min(0.45, tgt[1] + (dv.y + 0.03) * 4 * DT))];
        const off = p.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, dd = Math.hypot(dx, dy), st = V * DT;
        if (dd > st) { off.x += (dx / dd) * st; off.y += (dy / dd) * st; } else off.set(tgt[0], tgt[1]);
        p.inputActive = dd > 1e-4;
      } else p.inputActive = GUARD ? pg.active : false;
      p.handHeld = !p.skill.sec;
      // ③ 발: 앞으로 (맞붙는 거리에서 멈춤) · 굳음 동안 스틱이 안 들음
      let fwd = p.skill.secretPhase !== 'stiff' && !(STOP && ps.open) && p.foeDistance() > p.swordArt.measure.clinch ? 1 : 0;
      if (fwd && CREEP && anyDist(p, e) <= CONFIG.SECRET.risolutoCover) fwd = CREEP;
      if (ps.riso.on && !p.skill.sec) { L.coverAll++; if (p.foeDistance() >= lungeGap(p)) L.coverFar++; } // 덮인 채 나아가는 스텝 가운데 런지 최소 간격 밖
      p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
      // 막힘: 리솔루토 찌르기 동안 칼끼리 닿고 상처를 못 냄 · 상대 칼 먼저: 창이 열린 뒤 내 찌르기가 맞기 전에 내가 상처를 입음
      if (run && p.skill.sec?.risoluto && bladesTouch(p, e)) run.touch = true;
      if (run && e.pain > run.pain0 + 0.05) run.pained = true;
      if (run && p.skill.sec?.stage === 'stiff' && run.stiffAt == null) { run.stiffAt = t; recEnd = t + 0.6; } // 찌르기가 끝남 → 되돌아오는 몫
      if (run && !p.skill.sec) {
        const hit = run.wound || run.pained;
        const res = run.res;
        // 맞힘(상처 · 아픔 +0.05) · 막힘(10/23 판: 칼끼리 닿고 못 맞힘 · 런지: 붙은 칼에서 떨어졌다 다시 닿음 — 런지 막힘 판정) · 헛침(아무것도 안 닿음)
        (hit ? L.gapHit : L.gapMiss).push(run.gap0); // 낸 때 가슴 사이 — 맞힘 · 못 맞힘
        if (hit) R.hit++; else if (LUNGE ? res?.blocked : run.touch) R.blocked++; else R.whiff++;
        if (!hit && run.touch) R.touchMiss++;
        if (res?.blocked) R.lBlock++;
        if (res?.glided > 0) R.glide++;
        if (run.foeFirst) R.foeFirst++;
        if (run.wound && !e.alive) R.kill1++; // 그 찌르기로 상대가 죽음 (찌르기 셈이 끝날 때 죽어 있음)
        const pl = p.bodies.pelvis.translation();
        L.pel.push(Math.hypot(pl.x - run.pel0[0], pl.z - run.pel0[1])); L.tilt.push(run.tilt); L.pelLow.push(run.low);
        if (res?.tipV > 0) { L.tipV.push(res.tipV); L.tipMax.push(res.tipVmax); L.gon.push(run.gon); L.tipShare.push(res.tipV / run.gon); L.maxShare.push(res.tipVmax / run.gon); }
        if (run.tipV > 0) L.stepV.push(run.tipV);
        if (res) { L.slide.push(res.slide ?? 0); L.foot.push(res.foot ?? 0); }
        L.gap0.push(run.gap0); L.gapMin.push(run.gapMin); if (run.gapMin < p.swordArt.measure.clinch) L.clinch++;
        run.done = true;
        doneRuns.push(run);
        run = null;
      }
      // 막은 조건 셈 (판정과 같은 함수 — 읽기만)
      const gNow = p.foeDistance(), closing = gapPrev != null && gNow < gapPrev; gapPrev = gNow;
      const R0 = ps.riso;
      if (R0.on && !wasOn && t - offT <= 0.2) B.rejoin++;
      if (!R0.on && wasOn) { offT = t; B.onEnds++; }
      wasOn = R0.on;
      // 10/25 칼끼리 처음 가까워진 때 (어느 부위든 0.07 · 맞닿음 — 0.2 s 넘게 떨어졌다 다시 붙은 때도 '처음')
      if (p.state === 'stand' && e.state === 'stand' && !p.skill.sec && p.armed && e.armed) {
        const near = anyDist(p, e) <= CONFIG.SECRET.risolutoCover;
        if (near && !nearOn && t - nearOff > 0.2) {
          L.first.push(gNow);
          if (!firstSeen) { firstSeen = true; L.firstRound.push(gNow); } // 판마다 처음

          const mf = meFree(p), ff = !swingingNow(e), fw = stickForward(p), gk = gNow >= lungeGap(p);
          L.firstN++; if (!mf) L.firstMf++; if (!ff) L.firstFf++; if (!fw) L.firstFw++; if (!gk) L.firstGap++; if (mf && ff && fw && gk) L.firstAll++;
        }
        if (!near && nearOn) nearOff = t;
        nearOn = near;
      } else if (nearOn) { nearOn = false; nearOff = t; }
      if (gNow <= 2.6 && p.state === 'stand' && e.state === 'stand' && !p.skill.sec && p.armed && e.armed) {
        B.base++;
        const any = anyDist(p, e) <= CONFIG.SECRET.risolutoCover, cov = coverDist(p, e) <= CONFIG.SECRET.risolutoCover, mf = meFree(p), ff = !swingingNow(e), fw = stickForward(p);
        if (any) B.any++; if (cov) B.cover++; if (mf) B.mf++; if (ff) B.ff++; if (fw) B.fw++; if (closing) B.cl++;
        if (cov && mf && ff && fw && closing) B.all++;
        if ((cov || any) && mf && ff && fw) B.allWide++; // 넓은 판정 조건 모두 (너그러움 빼고)
        if (any) {
          if (!cov) B.aCover++; if (!mf) B.aMf++; if (!ff) B.aFf++; if (!fw) B.aFw++; if (!closing) B.aCl++;
          if (!cov && mf && ff && fw) B.aOnly++; // 부위만 아니면 다 됨
        }
      }
    };
    const doneRuns = [];
    let tipPrev = null, after = 0;
    for (let i = 0; i < SIM / DT; i++) {
      const lunging = !!(run && p.iai?.kind === 'combo');
      G.step();
      // 런지 재기 (스텝 뒤): 칼끝 빠르기(이 스텝에 칼끝이 옮긴 거리 ÷ 스텝 — 런지 실행 중 가장 빠른 스텝) · 몸통 기울기 · 골반 높이
      const tip = p.bladePoint(1, new THREE.Vector3());
      if (run && lunging && tipPrev) run.tipV = Math.max(run.tipV, tip.distanceTo(tipPrev) / DT);
      tipPrev = tip;
      if (run && !run.done) {
        run.res ??= p.skill.sec?.lungeRes ?? null;
        const ch = p.bodies.chest.translation(), pl = p.bodies.pelvis.translation();
        const dy = ch.y - pl.y, dh = Math.hypot(ch.x - pl.x, ch.z - pl.z);
        run.tilt = Math.max(run.tilt, (Math.atan2(dh, dy) * 180) / Math.PI);
        run.low = Math.min(run.low, pl.y);
        if (e.alive) run.gapMin = Math.min(run.gapMin, p.foeDistance()); // 가슴 사이 가장 가까움 (런지 뒤 상대 몸에 부딪나 — 맞붙는 거리 clinch 와 견줌)
      }
      for (const r of doneRuns) if (!r.fellChecked && G.t <= r.fallChk && p.alive && p.state !== 'stand') { r.fell = true; r.fellChecked = true; R.fall++; }
      // 10/24 14:0x 되돌아오기 재기: 앞발을 거두기 시작한 때(p.lungeRecovered 가 새로 섬) · 그때 · 0.6 s 뒤 가슴 사이 (런지 시작부터 2 s 안 · 상대가 살아 있을 때만 셈)
      for (const r of [...doneRuns, ...(run ? [run] : [])]) {
        if (r.recT == null && p.lungeRecovered && p.lungeRecovered !== r.rec0 && G.t <= r.t0 + 2) { r.recT = G.t; r.recGap0 = p.foeDistance(); r.recAlive = e.alive; L.recDelay.push(G.t - r.t0); L.recBack.push(p.lungeRecovered.back ?? 0); }
        if (r.recT != null && r.recGap == null && G.t >= r.recT + 0.6) { r.recGap = p.foeDistance(); if (r.recAlive && e.alive) { L.recGap0.push(r.recGap0); L.recGap.push(r.recGap); } }
      }
      if (!p.alive) break;
      if (!e.alive && (!run || ++after > 1 / DT)) break; // 상대가 죽어도 내 찌르기 셈(굳음 끝)까지는 마저 (판 수는 그대로 — 그 뒤엔 칠 상대가 없음)
    }
    R.rounds++;
    if (!p.alive) R.pDead++;
    if (!e.alive) R.fDead++;
    const W = ps.riso;
    R.runs.push(...W.runs);
    R.gapBlocked += W.gapBlocked ?? 0; R.gapClosed += W.gapClosed ?? 0;
    R.hold += W.opens.hold; R.beat += W.opens.beat; R.close += W.opens.close ?? 0; R.touch += W.opens.touch ?? 0; R.lineSteps += W.lineSteps ?? 0;
    for (const k of Object.keys(R.ends)) R.ends[k] += W.ends[k];
    const st = p.skill.secretStats.andareRisoluto ?? { landed: 0, armSlow: 0 };
    R.landed += st.landed; R.armSlow += st.armSlow ?? 0;
    G.world.free();
  }
  rows.push(R);
}
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const S = CONFIG.SECRET;
const tags = [PLAIN && '대조: 팔 늦춤 · 비기 배율 끔', S.risolutoAnyPart && '칼 어느 부위든', S.risolutoGrace && `너그러움 ${S.risolutoGrace} s`, !S.risolutoClosing && '가슴 사이 조건 없음', S.risolutoClose && '다 붙음 창', S.risolutoLine && '줄 막기 덮음', GUARD && '막기 단추 쥔 채', CONFIG.SKILL.itOpposition ? '' : '막아찌르기 끔'].filter(Boolean);
console.log(`${tags.length ? `[${tags.join(' · ')}] ` : ''}T ${S.risolutoHold} s · 두 번째 길 ${S.risolutoBeat ? '켬' : '끔'} · 덮음 ${S.risolutoCover} m · 씨앗 ${SEEDS} × ${SIM} s · 손 ${V} · 탭 반응 ${REACT} s`);
console.log('| 무기 | 상대 | 판 | 덮인 채 나아가기 ≥0.2 s (판당) | 길이 p50 · max | 창 이어짐 · 다 붙음 · 상대 박자 | 탭 | 맞힘 | 막힘 | 상대 칼 먼저 | 준 심각도 | 입은 심각도 | 내 죽음 · 상대 죽음 | 막아찌르기 (덮인 꼴 · 창 중) | 끝난 까닭 (상대 휘두름 · 덮음 풀림 · 가슴 사이 · 스틱 · 내 휘두름) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const T = { runs: [] };
for (const k of KEYS) T[k] = 0;
for (const R of rows) {
  const big = R.runs.filter((x) => x >= 0.2);
  console.log(`| ${R.w} | ${CHARACTERS_BY_ID[R.id].name} | ${R.rounds} | ${big.length} (${f1(big.length / R.rounds)}) | ${f2(q(big, 0.5))} · ${f2(q(big, 1))} | ${R.hold} · ${R.close} · ${R.beat} | ${R.fired} | ${R.landed} | ${R.blocked} | ${R.foeFirst} | ${f1(R.dealt)} | ${f1(R.taken)} | ${R.pDead} · ${R.fDead} | ${R.opp} (${R.oppCover} · ${R.oppWin}) | ${R.ends.foeSwing} · ${R.ends.uncover} · ${R.ends.gap} · ${R.ends.stick} · ${R.ends.meSwing} |`);
  T.runs.push(...big); for (const k of KEYS) T[k] += R[k];
}
const win = T.win; // 실제로 열린 창 (10/24 간격 조건 전에는 이어짐 + 다 붙음 + 상대 박자와 같음)
console.log(`| 합 | | ${T.rounds} | ${T.runs.length} (${f2(T.runs.length / T.rounds)}) | ${f2(q(T.runs, 0.5))} · ${f2(q(T.runs, 1))} | ${T.hold} · ${T.close} · ${T.beat} | ${T.fired} | ${T.landed} | ${T.blocked} | ${T.foeFirst} | ${f1(T.dealt)} | ${f1(T.taken)} | ${T.pDead} · ${T.fDead} | ${T.opp} (${T.oppCover} · ${T.oppWin}) | |`);
console.log(`[10/24 13:2x 런지 간격 조건 ${S.risolutoLunge && S.risolutoGap ? '켬' : '끔'}${STOP ? ' · 운전: 창이 보이면 섬' : ''}] 실제로 열린 창 ${T.win} (판당 ${f2(T.win / T.rounds)} — 이어짐 ${T.winHold} · 다 붙음 ${T.winClose} · 상대 박자 ${T.winBeat} · 칼끝 얽힘 ${T.winTouch}) · 창 조건이 찼으나 가까워 안 뜸 ${T.gapBlocked} · 뜬 뒤 가까워져 닫힘 ${T.gapClosed} · 열린 때 가슴 사이 p50 ${f2(q(L.winGap, 0.5))} (${f2(q(L.winGap, 0))} ~ ${f2(q(L.winGap, 1))}) m · 그 가운데 런지 최소 간격(맞닿기 거리) 밖 ${T.winFar}`);
{
  const m = L.winMargin, n = (x) => m.filter((v) => v >= x).length;
  console.log(`  열린 창의 맞붙는 거리 밖 여유 (가슴 사이 − clinch) p50 ${f2(q(m, 0.5))} · 최대 ${f2(q(m, 1))} m — 여유 ≥ 0.25(chineseStep) ${n(0.25)} · ≥ 0.45(이탈리아 걸음 보폭 maxStride) ${n(0.45)} · ≥ 0.5(이탈리아 베기 걸음 cutStep) ${n(0.5)} · ≥ 0.6(iaiStep) ${n(0.6)} · ≥ 0.9(italianStep) ${n(0.9)} / ${m.length} · 덮인 채 나아가는 스텝 가운데 런지 최소 간격(맞닿기 거리) 밖 ${L.coverFar} / ${L.coverAll}${CREEP ? ` · 운전: 칼이 붙으면 스틱 ${CREEP}` : ''}`);
}
{
  const g = L.winGap, F = L.first, pc = (x) => `${x} (${Math.round((100 * x) / Math.max(1, L.firstN))} %)`;
  console.log(`[10/25 칼끝 얽힘 창 ${S.risolutoTouch ? '켬' : '끔'}] 창 셈(간격 조건 전): 칼끝 얽힘 ${T.touch} · 이어짐 ${T.hold} · 다 붙음 ${T.close} · 상대 박자 ${T.beat} → 열린 창 ${T.win} · 가까워 안 뜸 ${T.gapBlocked} · 뜬 뒤 닫힘 ${T.gapClosed} · 탭 때 창이 이미 닫힘 ${T.tapLost} · 런지 ${T.fired} · 맞힘 ${T.hit} · 그 찌르기로 죽임 ${T.kill1}`);
  console.log(`  열린 때 가슴 사이 p10 · p50 · p90 ${f2(q(g, 0.1))} · ${f2(q(g, 0.5))} · ${f2(q(g, 0.9))} m · 칼끼리 처음 가까워진 때 ${L.firstN} 번 — 가슴 사이 p10 · p50 · p90 ${f2(q(F, 0.1))} · ${f2(q(F, 0.5))} · ${f2(q(F, 0.9))} m · 그때 막은 것: 맞닿기 거리 안 ${pc(L.firstGap)} · 상대 휘두름 ${pc(L.firstFf)} · 내 휘두름 ${pc(L.firstMf)} · 스틱 ${pc(L.firstFw)} · 다 됨 ${pc(L.firstAll)}`);
  const R_ = L.firstRound, H = L.gapHit, M = L.gapMiss;
  console.log(`  판마다 처음 칼끼리 가까워진 때 가슴 사이 p10 · p50 · p90 ${f2(q(R_, 0.1))} · ${f2(q(R_, 0.5))} · ${f2(q(R_, 0.9))} m (${R_.length} 판) · 런지 낸 때 가슴 사이 — 맞힘 ${H.length} p50 ${f2(q(H, 0.5))} (${f2(q(H, 0))} ~ ${f2(q(H, 1))}) · 못 맞힘 ${M.length} p50 ${f2(q(M, 0.5))} (${f2(q(M, 0))} ~ ${f2(q(M, 1))}) m`);
}
console.log(`판당: 창 ${f2(win / T.rounds)} · 탭 ${f2(T.fired / T.rounds)} · 맞힘 ${f2(T.landed / T.rounds)} · 막힘 ${f2(T.blocked / T.rounds)} · 준 심각도 ${f2(T.dealt / T.rounds)} · 상대 칼 먼저 ${T.fired ? Math.round((100 * T.foeFirst) / T.fired) : '-'} % (탭 중) · 막아찌르기 ${f2(T.opp / T.rounds)} (덮인 꼴 ${T.oppCover} · 창 중 ${T.oppWin}) · 줄 막기 스텝 ${T.lineSteps}`);
const all = rows.flatMap((R) => R.runs);
const pb_ = (x) => `${((100 * x) / Math.max(1, B.base)).toFixed(1)} %`, pa_ = (x) => `${((100 * x) / Math.max(1, B.any)).toFixed(0)} %`;
console.log(`막은 조건 (가슴 사이 2.6 m 안 ${(B.base * DT).toFixed(1)} s): 칼끼리 가까움(어느 부위든 0.07 · 맞닿음) ${pb_(B.any)} · 덮음(손 쪽 ↔ 칼끝 쪽) ${pb_(B.cover)} · 나 안 휘두름 ${pb_(B.mf)} · 상대 안 휘두름 ${pb_(B.ff)} · 스틱 앞 ${pb_(B.fw)} · 가슴 사이 줄어듦 ${pb_(B.cl)} · 옛 조건 모두 ${pb_(B.all)} · 넓은 조건 모두 ${pb_(B.allWide)}`);
console.log(`  칼끼리 가까운 ${(B.any * DT).toFixed(1)} s 가운데 막은 것: 부위(손 쪽 ↔ 칼끝 쪽 아님) ${pa_(B.aCover)} · 내 휘두름 · 막기 ${pa_(B.aMf)} · 상대 휘두름 ${pa_(B.aFf)} · 스틱 ${pa_(B.aFw)} · 가슴 사이 안 줄어듦 ${pa_(B.aCl)} · (부위만 걸림 ${pa_(B.aOnly)}) · 셈이 끊긴 뒤 0.2 s 안에 다시 붙음 ${B.rejoin} / ${B.onEnds}`);
console.log(`찌르기 결과: 맞힘 ${T.hit} · 막힘 ${T.blocked} · 헛침 ${T.whiff} (판당 ${f2(T.hit / T.rounds)} · ${f2(T.blocked / T.rounds)} · ${f2(T.whiff / T.rounds)})`);
// 10/24 런지 재기
const mean_ = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
console.log(`[${LUNGE ? `런지 · 칼끝 몫 ${S.risolutoShare} · 팔 늦춤 ${S.risolutoArmSlow ?? CONFIG.FLOW_RECOVERY.seconds} s · 굳음 ${S.risolutoStiff ?? S.stiff.italian} s` : `10/23 탭 찌르기 · 팔 늦춤 ${S.risolutoArmSlow ?? CONFIG.FLOW_RECOVERY.seconds} s · 굳음 ${S.risolutoStiff ?? S.stiff.italian} s`}]`);
console.log(`  칼끝 빠르기 (런지 찌르는 토막 · 쓸린 자리 조각 — 월드 m/s): 평균 p50 ${f1(q(L.tipV, 0.5))} · 가장 빠른 조각 p50 ${f1(q(L.tipMax, 0.5))} · 같은 칼 고노센 ${f1(q(L.gon, 0.5))} → 몫 평균 p50 ${f2(q(L.tipShare, 0.5))} (${f2(q(L.tipShare, 0))} ~ ${f2(q(L.tipShare, 1))}) · 가장 빠른 조각 p50 ${f2(q(L.maxShare, 0.5))} (${f2(q(L.maxShare, 0))} ~ ${f2(q(L.maxShare, 1))}) · ${L.tipV.length} 번 · 참고: 스텝 끝 자리로 잰 칼끝 p50 ${f1(q(L.stepV, 0.5))}`);
console.log(`  맞힘 상처 ${L.E.length} 개: 에너지 p50 ${f1(q(L.E, 0.5))} · p90 ${f1(q(L.E, 0.9))} · 최대 ${f1(q(L.E, 1))} J · 심각도 p50 ${f2(q(L.sev, 0.5))} · 평균 ${f2(mean_(L.sev))} · 최대 ${f2(q(L.sev, 1))} · 찌르기 하나당 준 심각도 ${f2(T.dealt / Math.max(1, T.fired))} · 그 찌르기로 상대가 죽음 ${T.kill1} / ${T.fired}`);
console.log(`  맞은 곳: ${Object.entries(L.zone).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
console.log(`  되돌아오는 몫 위험: 굳음 동안 입은 상처 ${T.recHit} 번 · 심각도 ${f2(T.recSev)} · 찌르기가 끝난 뒤 0.6 s 안 ${T.win6Hit} 번 · 심각도 ${f2(T.win6Sev)} (찌르기 ${T.fired})`);
console.log(`  몸: 골반 옮김 p50 ${f2(q(L.pel, 0.5))} · 최대 ${f2(q(L.pel, 1))} m · 몸통 기울기 p50 ${f1(q(L.tilt, 0.5))} · 최대 ${f1(q(L.tilt, 1))}° · 골반 가장 낮음 ${f2(q(L.pelLow, 0))} m · 몸 미끄러짐 p50 ${f2(q(L.slide, 0.5))} m · 낸 뒤 1.5 s 안 서 있지 않음 ${T.fall} / ${T.fired}`);
console.log(`  런지 막힘 ${T.lBlock} · 붙은 칼 따라 미끄러짐 ${T.glide} · 칼끼리 닿고 못 맞힘 ${T.touchMiss}`);
console.log(`  되돌아오기(앞발 거둠): ${L.recDelay.length} / ${T.fired} 번 · 런지 시작부터 p50 ${f2(q(L.recDelay, 0.5))} s · 거둔 길이 p50 ${f2(q(L.recBack, 0.5))} m · (상대가 살아 있던 ${L.recGap.length} 번) 가슴 사이 거둘 때 p50 ${f2(q(L.recGap0, 0.5))} → 0.6 s 뒤 p50 ${f2(q(L.recGap, 0.5))} m (${f2(q(L.recGap, 0))} ~ ${f2(q(L.recGap, 1))})`);
console.log(`  걸음: 낸 때 가슴 사이 p50 ${f2(q(L.gap0, 0.5))} m · 몸 미끄러짐 p50 ${f2(q(L.slide, 0.5))} · 최대 ${f2(q(L.slide, 1))} · 앞발 런지 걸음 p50 ${f2(q(L.foot, 0.5))} · 최대 ${f2(q(L.foot, 1))} m · 그 뒤 가슴 사이 가장 가까움 p50 ${f2(q(L.gapMin, 0.5))} · 가장 작음 ${f2(q(L.gapMin, 0))} m · 맞붙는 거리 안으로 든 찌르기 ${L.clinch} / ${L.gapMin.length}`);
console.log(`덮인 채 나아가기 길이 (모든 판 · 0 초 넘는 것 ${all.length}): p50 ${f2(q(all, 0.5))} · p90 ${f2(q(all, 0.9))} · ≥0.4 ${all.filter((x) => x >= 0.4).length} · ≥0.6 ${all.filter((x) => x >= 0.6).length} · ≥1.5 ${all.filter((x) => x >= 1.5).length}`);
