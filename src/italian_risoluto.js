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
//   두 번째 길(SECRET.risolutoBeat — 기본 끔): 덮인 채 나아가기가 risolutoBeatMin 초 넘게 이어지던 중 상대가 칼을 내거나(휘두름 시작) 덮음이 풀리면
//   (내가 휘두르거나 스틱을 놓은 게 아닐 때) 곧장 창 — 원전 [156] 「상대가 박자를 내면 그것을 잡아, 멈추지 않고 몸까지」.
//  AI 는 쓰지 않는다(SECRET.aiOpenSchools — ai.js 는 TRADITIONS.italian.secret 옛 비기를 보고, 그마저 닫힘). 시뮬 도구엔 PlayerSecretWatch 가 없어 AI 끼리 판 그대로.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET, SCHOOL_PASSIVE } from './config.js';
import { segDist } from './skill.js';
import { swingingNow } from './school_passive.js';

const _a0 = new THREE.Vector3();
const _a1 = new THREE.Vector3();
const _b0 = new THREE.Vector3();
const _b1 = new THREE.Vector3();
const _c = new THREE.Vector3();
const _u = new THREE.Vector3();
const D2R = Math.PI / 180;

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
    this.opens = { hold: 0, beat: 0, close: 0 };
    this.closeDone = false; // 다 붙음 창 (시험 SECRET.risolutoClose): 이번 덮인 채 나아가기에서 이미 열었나
    this.lineSteps = 0; // 재기: 줄 막기로만 덮음이 된 스텝
  }

  reset() {
    if (this.held > 0) this.runs.push(this.held);
    this.held = 0;
    this.on = false;
    this.gap = null;
    this.closeDone = false;
  }

  tick(dt, canOpen) {
    const me = this.me;
    const foe = this.foe;
    const gap = me.foeDistance();
    const closing = this.gap != null && gap < this.gap;
    this.gap = gap;
    const d = (this.d = coverDist(me, foe));
    let cover = d <= SECRET.risolutoCover;
    if (!cover && SECRET.risolutoLine && lineCover(me, foe)) {
      cover = true; // 칼을 대지 않는 덮음 (줄 막기 — 시험 스위치)
      this.lineSteps++;
    }
    const mine = meFree(me);
    const fwd = stickForward(me);
    const foeFree = !swingingNow(foe);
    const on = cover && mine && foeFree && fwd && closing;
    if (on) {
      this.held += dt;
      this.on = true;
      if (canOpen && this.held >= SECRET.risolutoHold) {
        const held = this.held;
        this.runs.push(held);
        this.held = 0; // 창을 열면 다시 셈 (이어서 덮인 채 나아가면 또 risolutoHold 뒤)
        this.opens.hold++;
        return { ev: 'risoluto', path: 'hold', held };
      }
      // 다 붙음 창 (시험 SECRET.risolutoClose — 기본 끔 · 감독 10/22): 덮인 채 나아가다 맞닿기 거리(무기 실측 measure.contact — 칼이 제대로 들어가는 거리)에 든 순간 · 시간 조건 없음 · 덮인 채 나아가기 한 번에 한 번
      const contact = me.swordArt?.measure?.contact;
      if (SECRET.risolutoClose && canOpen && !this.closeDone && contact > 0 && gap <= contact) {
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
    this.ends[why]++;
    const held = this.held;
    this.runs.push(held);
    this.held = 0;
    this.on = false;
    this.closeDone = false;
    // 두 번째 길: 상대 박자(칼을 냄 · 칼을 빼 덮음이 풀림) — 내가 휘두르거나 스틱을 놓아 끝난 것은 아님
    if (SECRET.risolutoBeat && canOpen && held >= SECRET.risolutoBeatMin && (why === 'foeSwing' || why === 'uncover')) {
      this.opens.beat++;
      return { ev: 'risoluto', path: 'beat', held, why };
    }
    return null;
  }
}
