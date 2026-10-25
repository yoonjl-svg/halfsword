// ─────────────────────────────────────────────────────────────
//  이탈리아 비기 — 거침없이 나아가 찌르기 (안다레 리솔루토) · 사람 먼저 (사장님 10/22 — docs/strike/italian_risoluto_2026-10-22.md)
//
//  원전: 파브리스 『Lo Schermo, overo Scienza d'Arme』(1606) 둘째 책 — 결연히 나아가기(andare di risolutione).
//   [155] 「상대 칼이 움직이면 내 칼에 묶인 듯 보이고, 하나가 다른 하나에 따라붙지 않고는 가지 못하게, 두 칼이 늘 붙어 있게」 ·
//   [156] 「팔을 굳게 두고 상대 칼날을 놓지 말고 따라 미끄러져 몸까지」 · 「내 칼끝이 조금 위, 더 강하게」 · 「칼날에 가까울수록 좋되 닿지는 말 것」.
//  사장님 확인(10/22): '칼로 상대 칼을 누른 채 다가간다 = 칼이 서로 긁히며 얽혀 있는데(막기나 휘두름 x) 내가 앞으로 나아가는 상황' · '덮음은 모양으로 재고 사람 먼저'.
//
//  덮음(모양 — 닿음이 아님): 우리 물리에서 칼끼리 닿음은 0.3 s 를 잘 못 넘기고 긁히는 동안 끊겼다 이어진다(natural_bind_2026-10-11.md) →
//   내 칼의 손 쪽 절반(강한 쪽 — 칼날 0 ~ 0.5) 선분과 상대 칼의 칼끝 쪽 절반(약한 쪽 — 0.5 ~ 1) 선분 사이 가장 가까운 거리 ≤ SECRET.risolutoCover.
//  덮인 채 나아가기 = 덮음 · 나도 상대도 휘두르는 중이 아님(school_passive.js swingingNow — 나는 손 휘두르기 · 막기 단추도 아님) ·
//   스틱이 앞(상대 쪽 90° 부채꼴 — fighter.js 밀치기 걸쇠와 같은 기하 stickY > |stickX|) · 가슴 사이가 줄어듦(지난 스텝보다 가까움).
//  창: 덮인 채 나아가기가 SECRET.risolutoHold 초 이어지면 비기 창(SECRET.playerWindow — 금색 '!') · 그 안의 탭 하나가 리솔루토 찌르기(skill.js secret · main.js).
//   두 번째 길(SECRET.risolutoBeat): 덮인 채 나아가기가 risolutoBeatMin 초 넘게 이어지던 중 상대가 칼을 내거나(휘두름 시작) 덮음이 풀리면
//   (내가 휘두르거나 스틱을 놓은 게 아닐 때) 곧장 창 — 원전 [156] 「상대가 박자를 내면 그것을 잡아, 멈추지 않고 몸까지」.
//  10/23 넓은 판정 (사장님 10/23 00:1x '리솔루토 발동 거의 안 되더라 칼이 붙어 있는 상황에 대한 판정을 더 광범위하고 유연하게' — 기본 · 10/22 판은 `?risoWide=0`):
//   덮음에 칼 어느 부위든 맞닿음 · 0.07 m(risolutoAnyPart — bladesNear) · 덮음 끊김 0.2 s(risolutoGrace) 너그러움으로 모아서 셈 · 가슴 사이 줄어듦 뺌(risolutoClosing 0) ·
//   다 붙음 창(risolutoClose — 맞닿기 거리 밖에서 안으로 든 순간) · 상대 박자 창(risolutoBeat) 기본 켬. 노리는 운전 30 판 창 판당 0.07 → 2.27 (문서 §9)
//  10/25 칼끝 얽힘 창 (사장님 10/25 01:0x '칼끝이 얽히자마자 그 순간부터 쓸 수 있게' — 기본 · 10/24 판은 `?risoTouch=0` · 문서 §14):
//   덮인 채 나아가기가 새로 선 그 스텝(칼끼리 어느 부위든 실제 맞닿음 · 0.07 m — 칼끝끼리 · 칼끝이 상대 칼 몸에 엇걸림도)에 곧장 창 · 셈 시간 없음 · 덮인 채 나아가기 한 번에 한 번.
//   10/24 판에서 첫 닿음을 늦춘 것 = 이어짐 0.6 s(risolutoHold) 하나 — 부위 · 가슴 사이 조건은 10/23 에 이미 풂 · 다 붙음 창은 13:4x 간격 조건(맞닿기 거리)과 같은 자리라 늘 막힘.
//  AI 는 쓰지 않는다(SECRET.aiOpenSchools — ai.js 는 TRADITIONS.italian.secret 옛 비기를 보고, 그마저 닫힘). 시뮬 도구엔 PlayerSecretWatch 가 없어 AI 끼리 판 그대로.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, SCHOOL_PASSIVE } from './config.js';
import { segDist } from './skill.js';
import { swingingNow } from './school_passive.js';
import { iaiTipSpeed, ART_MIN } from './secret_instant.js';

const _a0 = new THREE.Vector3();
const _a1 = new THREE.Vector3();
const _b0 = new THREE.Vector3();
const _b1 = new THREE.Vector3();
const _c = new THREE.Vector3();
const _u = new THREE.Vector3();
const D2R = Math.PI / 180;

/**
 * 런지 최소 간격 (m — 10/24 13:2x 사장님 '그럼 오히려 간격이 약간 있어야 쓸 수 있게 해 너무 가까우면 못쓰게' · 13:4x 대안 ③ '맞닿는 거리만 막기'):
 *  = 맞닿기 거리(무기 실측 measure.contact — 칼이 제대로 들어가는 거리). 레이피어 1.72 · 달타냥 1.64 · 발리사르다 1.76 m(10/25 찌르기 잣대 — `?itMeasure=old` 면 전 줄 1.54 · 1.39 · 1.51). 새 수 없음.
 *  (13:2x 첫 식 '맞붙는 거리 clinch + 런지 앞발 0.9' 는 같은 운전 창 판당 0.97 → 0 이라 버림 · 앞발 0.9 · 몸 미끄러짐은 그대로 — 런지 뒤 몸이 붙는 것은 사장님이 받아들임)
 */
export function lungeGap(me) {
  return me.swordArt?.measure?.contact ?? 0;
}

/** 런지를 쓸 수 있는 간격인가 (간격 조건 SECRET.risolutoGap · 런지 판 SECRET.risolutoLunge 일 때만 — 아니면 늘 true) */
export function lungeGapOk(me) {
  if (!SECRET.risolutoLunge || !SECRET.risolutoGap) return true;
  return me.foeDistance() >= lungeGap(me);
}

/** 덮음 거리 (m): 내 칼 손 쪽 절반 ↔ 상대 칼 칼끝 쪽 절반 가장 가까운 거리. 칼이 없으면 Infinity */
export function coverDist(me, foe) {
  if (!me?.armed || !foe?.armed || me.weaponBroken || foe.weaponBroken || me.weapon?.gun || foe.weapon?.gun) return Infinity;
  me.bladePoint(0, _a0);
  me.bladePoint(0.5, _a1);
  foe.bladePoint(0.5, _b0);
  foe.bladePoint(1, _b1);
  return segDist(_a0, _a1, _b0, _b1);
}

/**
 * 칼을 대지 않는 덮음 — 줄 막기 (시험 스위치 SECRET.risolutoLine — 기본 끔 · 감독 10/22 '파브리스는 칼을 찾지 않고 줄만 막고 들어가는 판도 허락'):
 *  ① 겨눔: 내 칼 방향(칼자루 → 칼끝)과 칼자루 → 상대 가슴 방향 사이 각 ≤ 곧은 선 최대 각 SCHOOL_PASSIVE.italian.tipMax(12° — 이미 있는 수) ·
 *  ② 줄 막기: 내 칼 손 쪽 절반 선분 ↔ (상대 칼끝 → 내 가슴) 선분 가장 가까운 거리 ≤ SECRET.risolutoCover(덮음과 같은 0.07 m) — 상대 칼끝이 지금 줄로 나를 찌르러 오는 길 위에 내 강한 쪽이 있음.
 *  원전 [153] 「sicuro, che la nimica non poteua ferire nel luogo, oue si trouaua」(상대 칼이 지금 줄에서는 칠 수 없음) · [157] 각진 자세에는 칼날을 따라가지 않고 곧은 줄로 [원문 영역] · 기하 [해석]
 */
export function lineCover(me, foe) {
  if (!me?.armed || !foe?.armed || me.weaponBroken || foe.weaponBroken || me.weapon?.gun || foe.weapon?.gun) return false;
  me.bladePoint(0, _a0);
  me.bladePoint(1, _a1);
  const ch = foe.bodies.chest.translation();
  _u.set(ch.x - _a0.x, ch.y - _a0.y, ch.z - _a0.z).normalize();
  _c.subVectors(_a1, _a0).normalize();
  if (_c.dot(_u) < Math.cos(SCHOOL_PASSIVE.italian.tipMax * D2R)) return false;
  me.bladePoint(0.5, _a1);
  foe.bladePoint(1, _b0);
  const mc = me.bodies.chest.translation();
  _b1.set(mc.x, mc.y, mc.z);
  return segDist(_a0, _a1, _b0, _b1) <= SECRET.risolutoCover;
}

/**
 * 칼끼리 어느 부위든 (10/23 넓은 판정 — SECRET.risolutoAnyPart · 사장님 '칼이 붙어 있는 상황에 대한 판정을 더 광범위하고 유연하게'):
 *  실제 칼끼리 맞닿음(combat.js 가 적는 feel.touching — 접촉 사건) 이거나, 두 칼날 전체(0 ~ 1) 선분 가장 가까운 거리 ≤ SECRET.risolutoCover(0.07 m — 덮음과 같은 수 · 새 문턱 없음)
 */
export function bladesNear(me, foe) {
  if (!me?.armed || !foe?.armed || me.weaponBroken || foe.weaponBroken || me.weapon?.gun || foe.weapon?.gun) return false;
  if (me.feel?.touching) return true;
  me.bladePoint(0, _a0);
  me.bladePoint(1, _a1);
  foe.bladePoint(0, _b0);
  foe.bladePoint(1, _b1);
  return segDist(_a0, _a1, _b0, _b1) <= SECRET.risolutoCover;
}

/** 나는 휘두르는 중이 아님 (긋기 · 탭 · 손잡이 찍기 · 비기 · 막아찌르기 · 손 휘두르기 · 막기 단추 — 막기 단추는 시험 SECRET.risolutoGuard 1 이면 셈에 넣음) */
export function meFree(me) {
  return !swingingNow(me) && !me.skill?.swinging && (!me.parryGuard?.held || !!SECRET.risolutoGuard);
}

/** 스틱이 앞 (상대 쪽 90° 부채꼴 — fighter.js closeStep 밂 걸쇠와 같은 기하) */
export function stickForward(me) {
  return (me.stickY ?? 0) > Math.abs(me.stickX ?? 0);
}

/**
 * 덮인 채 나아가기 셈 (PlayerSecretWatch 가 비기 when 'risoluto' 일 때 물리 스텝마다 부른다). 굴림 · 새 힘 없음.
 *  tick(dt) → null | { ev: 'risoluto', path: 'hold' | 'beat', held, why? } — 창을 열 때만 (창은 PlayerSecretWatch.openWindow)
 *  재기(판정엔 안 씀): runs = 끝난 덮인 채 나아가기 길이들 · ends = 끝난 까닭 셈 · opens = 길별 창 수
 */
export class RisolutoWatch {
  constructor(me, foe) {
    this.me = me;
    this.foe = foe;
    this.held = 0; // 덮인 채 나아가기가 이어진 시간 (s)
    this.gap = null; // 지난 스텝 가슴 사이 (m)
    this.d = Infinity; // 지금 덮음 거리 (재기 · 화면)
    this.on = false; // 지금 덮인 채 나아가는 중
    this.runs = [];
    this.ends = { foeSwing: 0, uncover: 0, meSwing: 0, stick: 0, gap: 0 };
    this.opens = { hold: 0, beat: 0, close: 0, touch: 0 };
    this.closeDone = false; // 다 붙음 창 (SECRET.risolutoClose): 이번 덮인 채 나아가기에서 이미 열었나
    this.touchDone = false; // 칼끝 얽힘 창 (SECRET.risolutoTouch — 10/25): 이번 덮인 채 나아가기에서 이미 셈했나 (열렸든 가까워 막혔든)
    this.lineSteps = 0; // 재기: 줄 막기로만 덮음이 된 스텝
    this.anySteps = 0; // 재기: 칼 어느 부위든(넓은 판정)으로만 덮음이 된 스텝
    this.off = 0; // 너그러움 (SECRET.risolutoGrace): 덮음 · 가슴 사이가 끊긴 지 지난 시간 — 이 동안은 셈을 쥔 채 기다림
    this.bridged = 0; // 재기: 너그러움으로 이어 붙인 끊김 수
    this.closeArmed = false; // 다 붙음: 맞닿기 거리 밖에 있었나 (들어오는 순간만)
  }

  reset() {
    if (this.held > 0) this.runs.push(this.held);
    this.held = 0;
    this.on = false;
    this.gap = null;
    this.closeDone = false;
    this.touchDone = false;
    this.off = 0;
  }

  /**
   * 10/23 넓은 판정 (사장님 '리솔루토 발동 거의 안 되더라 칼이 붙어 있는 상황에 대한 판정을 더 광범위하고 유연하게' — 옛 10/22 판 = `?risoWide=0`):
   *  덮음 = 손 쪽 ↔ 칼끝 쪽 0.07 m 또는 칼끼리 어느 부위든 맞닿음 · 0.07 m(risolutoAnyPart) · 덮음이나 가슴 사이가 risolutoGrace(0.2 s 반응) 안에 다시 이어지면 같은 덮인 채 나아가기로
   *  (그동안은 안 셈 — 붙은 시간을 모아서 셈) · 가슴 사이 줄어듦은 risolutoClosing 1 일 때만(기본 0 — 스틱 앞이면 됨) · 다 붙음 창 · 상대 박자 창 기본 켬.
   *  옛 판과 같은 길: risolutoAnyPart 0 · risolutoGrace 0 · risolutoClosing 1 · risolutoClose 0 · risolutoBeat 0 이면 10/22 판과 스텝마다 같다
   */
  tick(dt, canOpen) {
    const me = this.me;
    const foe = this.foe;
    const gap = me.foeDistance();
    if (gap > (me.swordArt?.measure?.contact ?? 0)) this.closeArmed = true; // 맞닿기 거리 밖 — 다음에 들어오는 순간이 '다 붙음'
    const closing = this.gap != null && gap < this.gap;
    this.gap = gap;
    const d = (this.d = coverDist(me, foe));
    let cover = d <= SECRET.risolutoCover;
    if (!cover && SECRET.risolutoAnyPart && bladesNear(me, foe)) {
      cover = true; // 칼 어느 부위든 맞닿음 · 가까움 (10/23 넓은 판정)
      this.anySteps++;
    }
    if (!cover && SECRET.risolutoLine && lineCover(me, foe)) {
      cover = true; // 칼을 대지 않는 덮음 (줄 막기 — 시험 스위치)
      this.lineSteps++;
    }
    const mine = meFree(me);
    const fwd = stickForward(me);
    const foeFree = !swingingNow(foe);
    const on = cover && mine && foeFree && fwd && (closing || !SECRET.risolutoClosing);
    if (on) {
      if (this.on && this.off > 0) this.bridged++;
      this.off = 0;
      this.held += dt;
      this.on = true;
      // 칼끝 얽힘 창 (10/25 사장님 '칼끝이 얽히자마자 그 순간부터 쓸 수 있게' — SECRET.risolutoTouch · `?risoTouch=0` = 10/24 판): 덮인 채 나아가기가 선 첫 스텝에 곧장 · 셈 시간 없음 ·
      //  덮인 채 나아가기 한 번에 한 번(같은 묶임에서 다시는 이어짐 · 상대 박자 창으로). 창이 이미 열려 있으면 그 창이 끝난 스텝에
      if (SECRET.risolutoTouch && canOpen && !this.touchDone) {
        this.touchDone = true;
        this.opens.touch++;
        return { ev: 'risoluto', path: 'touch', held: this.held };
      }
      if (canOpen && this.held >= SECRET.risolutoHold) {
        const held = this.held;
        this.runs.push(held);
        this.held = 0; // 창을 열면 다시 셈 (이어서 덮인 채 나아가면 또 risolutoHold 뒤)
        this.opens.hold++;
        return { ev: 'risoluto', path: 'hold', held };
      }
      // 다 붙음 창 (시험 SECRET.risolutoClose — 기본 끔 · 감독 10/22): 덮인 채 나아가다 맞닿기 거리(무기 실측 measure.contact — 칼이 제대로 들어가는 거리)에 든 순간 · 시간 조건 없음 · 덮인 채 나아가기 한 번에 한 번
      const contact = me.swordArt?.measure?.contact;
      if (SECRET.risolutoClose && canOpen && !this.closeDone && this.closeArmed && contact > 0 && gap <= contact) {
        this.closeArmed = false; // 다시 열려면 맞닿기 거리 밖으로 나갔다 들어와야 (닿은 '순간' — 10/23: 맞닿기 언저리에서 셈이 끊겼다 이어질 때마다 다시 열리지 않게)
        this.closeDone = true;
        const held = this.held;
        this.opens.close++;
        return { ev: 'risoluto', path: 'close', held };
      }
      return null;
    }
    if (!this.on) return null;
    // 덮인 채 나아가기가 끝남 — 까닭 (재기) · 두 번째 길
    const why = !mine ? 'meSwing' : !fwd ? 'stick' : !foeFree ? 'foeSwing' : !cover ? 'uncover' : 'gap';
    // 너그러움 (10/23): 덮음이 풀리거나 가슴 사이가 안 줄어든 것은 risolutoGrace 초까지 셈을 쥔 채 기다림 — 내가 휘두름 · 스틱을 놓음 · 상대 휘두름은 곧장 끝
    if ((why === 'uncover' || why === 'gap') && (this.off += dt) <= (SECRET.risolutoGrace ?? 0)) return null;
    this.off = 0;
    this.ends[why]++;
    const held = this.held;
    this.runs.push(held);
    this.held = 0;
    this.on = false;
    this.closeDone = false;
    this.touchDone = false;
    // 두 번째 길: 상대 박자(칼을 냄 · 칼을 빼 덮음이 풀림) — 내가 휘두르거나 스틱을 놓아 끝난 것은 아님
    if (SECRET.risolutoBeat && canOpen && held >= SECRET.risolutoBeatMin && (why === 'foeSwing' || why === 'uncover')) {
      this.opens.beat++;
      return { ev: 'risoluto', path: 'beat', held, why };
    }
    return null;
  }
}

/**
 * 잔상 (10/23 사장님 '잔상과 궤적도 비기에 걸맞는지 체크해' — docs/decisions.md 10/23 · 그림 docs/handoff/secret_trails): 비기는 결정타라 보통 칼질과 한눈에 달라 보이게 —
 *  다른 비기(고노센 · 모르트슐라크 · 격살)와 같은 비기 잔상(f.instantArc · kind 'combo' — sword_trail.js)을 찌르는 몫에 그린다.
 *  찌르는 몫 = 탭 찌르기가 뻗고 버티는 동안(skill.js updateThrust 의 thrustPush 와 같은 몫 — 겨누며 당기는 몫 · 거두는 몫은 빼고). 스텝마다 칼자루 · 칼끝 점.
 *  세기 = 칼끝 평균 빠르기 ÷ 같은 칼 고노센 칼끝 빠르기(iaiTipSpeed) — 고유 동작 잔상과 같은 식 · 바닥 ART_MIN(찌르기는 칼끝이 3~4 m/s 라 늘 바닥 0.3) ·
 *  그리는 밝기는 결정타 잔상 바닥 SECRET.secretArcMin(min — sword_trail.js)까지 올림.
 *  찌르기는 칼이 제 축을 따라 나가 칼자루 → 칼끝 띠가 거의 겹친다(넓이 0) → 마주 보는 띠(face 'line' — SECRET.secretStreak)로 칼이 지나간 줄(처음 칼자루 → 가장 멀리 간 칼끝)을 그린다. 물리 · 판정 무관(읽기만)
 */
export function risolutoTrail(f, run) {
  const tp = f.skill?.tap;
  const K = tp?.K;
  if (!tp || !K || tp.down || tp.t < K.aim || tp.t >= K.aim + K.extend + K.hold || !f.armed) return;
  const a = f.bladePoint(0, _a0);
  const b = f.bladePoint(1, _a1);
  let A = run.arc;
  if (!A) {
    A = run.arc = { id: (f.instantArc?.id ?? 0) + 1, kind: 'combo', share: ART_MIN, pts: [], ...(SECRET.secretStreak ? { face: 'line' } : {}), ...(SECRET.secretArcMin > 0 ? { min: SECRET.secretArcMin } : {}) };
    run.arcSum = 0;
    f.instantArc = A;
  }
  A.pts.push([a.x, a.y, a.z, b.x, b.y, b.z]);
  run.arcSum += f.tipVel?.length?.() ?? 0;
  A.share = Math.min(1, Math.max(ART_MIN, run.arcSum / A.pts.length / Math.max(1, iaiTipSpeed(f))));
}
