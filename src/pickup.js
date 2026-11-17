// ─────────────────────────────────────────────────────────────
//  떨어진 칼 줍기 (사장님 11/04 '코테는 칼을 더 자주 떨어트리게 해. 단 떨어진 무기를 줍는 동작을 신설하자.
//   무기 주위로 가서 막기 버튼을 누르거나 혹은 주위로 가면 자동으로 줍게, 적은 추가 비용으로 개발이 가능한가?' — config PICKUP · 기록 docs/strike/kote_pickup_2026-11-05.md)
//
//  칼을 놓친 몸(fighter.dropSword — 손목 치기 떨굼 · 칼 팔을 크게 다침 · 판 이어하기)이 땅에 떨어진 제 칼 곁에 서면:
//   · 사람: PICKUP.mode 'block' = 막기 단추(f.pickupPress — main.js · 재는 도구 손가락 봇) · 'auto' = 곁에 가면 저절로
//   · AI: PICKUP.ai = aiPickup 이 제 칼로 걸어가 곁에서 같은 누름
//  흐름 (실제 초 — 시간 사다리):
//   bend (PICKUP.bend 0.4 s): 칼 쪽으로 몸을 돌리며(f.pickup.face — fighter.updateHeading · 쥘 때까지) 웅크리고(f.pickW → secret_instant.js stanceTick 'pickup' — 골반 낮춤 · 몸통 숙임)
//        칼 손 목표를 칼자루로(pickupHand — fighter.driveSword). 손이 칼자루 grab 안에 오거나 bend 가 차면 쥔다
//        11/16 칼자루가 PICKUP.stepFrom(0.6 m) 넘게 멀면 웅크리며 칼 쪽으로 반걸음 PICKUP.step(0.3 m) 내디딤(앞쪽 칼 = 앞발 · 뒤쪽 칼 = 뒷발) — 손이 닿을 때까지 bend + stepWait 까지 (아래 pickupStep)
//   lift (PICKUP.lift 0.2 s): 일어서며 칼이 손으로 올라온다 — 부활 때 칼이 돌아오는 길 그대로(revive.js startSwordReturn · flySword: 충돌 끔 · 중력 끔 · 스텝마다 빠르기로
//        손목 자리 · 쥐는 자세까지) → attachSword(생성자와 같은 손목 관절 · 손목 원뿔 · armed · 칼끝 추정 리셋) → 칼 충돌 그룹을 되돌림
//   settle: 쥔 칼이 상대 몸 · 칼 · 제 몸통과 겹치지 않을 때 칼 충돌을 켠다(늦어도 PICKUP.settleMax) — 켜는 순간 겹친 칼이 튀지 않게
//  그동안 칼은 상처를 내지도 막지도 못한다(armed 거짓 · 날아오는 칼 · 쥔 직후 칼은 충돌 없음). 넘어지면(state ≠ stand) 그만두고 칼은 땅에 남는다(lift 중이면 마저 쥔다 — 이미 손 앞).
//  f.pickupLog = [{ t0 시작 · t1 다시 쥠 · t2 칼 충돌 켬 (게임 초 fightT), ok, why, reach 시작 때 칼자루 거리, hand 쥘 때 손 ↔ 칼자루, step 내디딘 걸음 m (11/16) }] — 재는 도구가 읽는다
// ─────────────────────────────────────────────────────────────
import { guarded, rethrowRapier } from './rapier_guard.js'; // 11/17 Rapier 콜백 예외 드러내기
import * as THREE from 'three';
import { PICKUP, VITALS, SECRET, realS } from './config.js';
import { startSwordReturn, flySword, attachSword, holdRot } from './revive.js';
const _rg = {}; // Rapier 콜백 예외 통 (11/17 — rapier_guard.js: 콜백 안 예외를 적고 엔진 부름 뒤 node 에서 다시 던짐)

const _g = new THREE.Vector3();
const _h = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const LOSE = 0.3; // 굽히는 동안 칼자루가 reach + 이만큼 넘게 멀어지면 그만둠 (m — 걸음 사다리 한 칸 · 11/16 전 reach × 1.5)
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));


/** 주울 수 있는 몸 · 칼인가 (칼은 땅에 있고 그 칼을 다시 쥘 수 있는 팔) */
export function canPickup(f) {
  if (!f.alive || f.armed || !f.sword || f.revival || f.state !== 'stand') return false;
  if (f.flexWeapon) return false; // 휘는 마디 무기(채찍): 마디 강체가 따로 놀아 손잡이만 손으로 옮기면 마디 관절이 늘어난다
  if (f.severedLimbs?.has('armS') || !(f.limbs.armS >= VITALS.dropSwordArm)) return false; // 칼 팔을 잃었거나 칼을 쥘 힘이 없다(주워도 곧 놓침)
  if (f.stamina?.exhausted) return false;
  if (f.iai || f.rdWind) return false; // 비기 · 특수 공격 대본이 몸 · 칼을 쥔 동안(놓친 채 남은 대본)은 기다림
  const col = f.swordColliders?.[0];
  return !!col && !f.colliderInfo?.get(col.handle)?.detached; // 잘린 팔과 함께 간 칼(잔해)
}

/** 칼자루(쥐는 자리 = 칼 몸체 원점 — 손목 관절 자리) 월드 자리 */
export function gripPoint(f, out = _g) {
  const p = f.sword.translation();
  return out.set(p.x, p.y, p.z);
}

/** 칼 손 손목(아래팔 앞끝 — revive.js wristOf 와 같은 자리) */
function wristOf(f, out) {
  const b = f.bodies.farmS;
  const r = b.rotation();
  const t = b.translation();
  return out.set(0.13, 0, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_r.set(t.x, t.y, t.z));
}

/** 골반에서 칼자루까지 수평 거리 (칼자루가 골반보다 높으면 Infinity — 아직 손에서 떨어지는 중이거나 누가 들고 있음) */
export function swordReachDist(f) {
  const p = f.bodies.pelvis.translation();
  const g = gripPoint(f);
  return g.y < p.y ? Math.hypot(g.x - p.x, g.z - p.z) : Infinity;
}

/** 떨어진 칼이 멈췄나 (칼 빠르기 < settle) */
export function swordSettled(f) {
  const v = f.sword.linvel();
  return Math.hypot(v.x, v.y, v.z) < PICKUP.settle;
}

/** 지금 줍기를 시작할 수 있나 (단추 누름 · 저절로 판정은 부르는 쪽) */
export function pickupReady(f) {
  return canPickup(f) && swordSettled(f) && swordReachDist(f) <= PICKUP.reach;
}

/** fighter.step (updateState 뒤) 에서: 줍기를 시작하거나 한 스텝 진행 */
export function pickupTick(f, dt) {
  let P = f.pickup;
  if (!P) {
    f.pickW = 0;
    if (!pickupReady(f)) return;
    if (!f.pickupPress) return;
    P = f.pickup = { phase: 'bend', t: 0, T: realS(PICKUP.bend), wHand: 0, g: gripPoint(f, new THREE.Vector3()), face: null, sword: null, saved: null, t0: f.fightT, reach: swordReachDist(f), hand: null };
  }
  if (f.revival) return revivalHandoff(f); // 줍다가 쓰러져 부활이 시작됨: 칼은 부활 길(revive.js — 일어설 때 손으로 날아옴)에 맡긴다
  if (P.phase === 'bend') {
    if (!canPickup(f) || swordReachDist(f) > PICKUP.reach + LOSE) return pickupEnd(f, false, !f.alive ? 'dead' : f.state !== 'stand' ? 'down' : 'lost'); // 칼이 시작 문 밖 걸음 사다리 한 칸(0.3) 넘게 멀어짐(밀림 · 칼을 참) — 0.6 판의 × 1.5 = 0.9 와 같은 수 · 0.9 판 1.2 (× 1.5 = 1.35 면 내디딘 손도 0.5 m 넘게 못 미침)
    P.t += dt;
    f.pickW = 1;
    P.wHand = smooth(P.t / P.T);
    gripPoint(f, P.g);
    P.face = P.g;
    if (P.step == null) pickupStep(f, P);
    const hd = wristOf(f, _h).distanceTo(P.g);
    if (hd > PICKUP.grab && P.t < P.T + (P.step > 0 ? realS(PICKUP.stepWait) : 0)) return; // 내디딘 줍기는 손이 닿을 때까지 stepWait 실제 초 더 (시간 사다리 0.4 + 0.2 = 0.6)
    P.step ??= 0;
    // 쥔다: 칼 충돌 그룹을 적어 두고(날아오는 동안 0 — 부활과 같은 길) 손목으로 올린다
    P.hand = +hd.toFixed(3);
    P.saved = f.swordColliders.map((c) => [c, c.collisionGroups()]); // (attachSword 의 V.groups 는 부활 유령 칸 — 줍기는 쓰지 않음)
    P.sword = startSwordReturn(f);
    P.sword.fly = realS(PICKUP.lift);
    P.sword.arc = 0;
    P.sword.hold = holdRot(f, new THREE.Quaternion()); // 쥐는 자세를 지금 정해 둠 (보간 끝이 고정 — 뒤집힘 없음)
    P.phase = 'lift';
    P.t = 0;
    P.face = P.g.clone(); // 올리는 동안도 쥔 자리 쪽을 본다: 몸이 돌면 쥐는 자세(revive.js holdRot — 몸 방향 기준)가 돌아 땅 자세 ↔ 쥐는 자세 사이 구면 보간이 반대쪽으로 뒤집혀 칼이 한 스텝에 0.4 m 튐(재기 11/05)
    f.pickW = 0; // 일어선다 (stanceTick outTime 으로 풀림)
  }
  if (P.phase === 'lift') {
    if (!f.alive || f.severedLimbs?.has('armS')) return pickupEnd(f, false, 'dead');
    P.t += dt;
    P.wHand = 1 - smooth(P.t / P.sword.fly); // 손은 쥔 자리에서 자세 자리로 (칼은 손목을 따라온다)
    flySword(f, P, dt); // 다 오면 attachSword (P.sword = null · armed)
    if (P.sword) return;
    P.phase = 'settle';
    P.t = 0;
    P.t1 = f.fightT;
    P.wHand = 0;
    P.face = null; // 쥐었다 — 다시 상대 쪽으로
  }
  if (P.phase === 'settle') {
    // 쥔 칼은 아직 충돌이 꺼져 있다(날아오던 칼): 칼이 상대 몸 · 칼 · 제 몸통에 겹친 채 충돌을 켜면 한 스텝에 밀려 튄다(상대 다리에 30 J 둔타 — 재기 11/05) →
    //  원래 충돌 그룹으로 부딪힐 것과 겹치지 않을 때 켠다. 늦어도 settle 실제 초 뒤엔 켠다(그동안 칼은 베지도 막지도 못함)
    P.t += dt;
    if (P.t < realS(PICKUP.settleMax) && swordOverlaps(f, P.saved)) return;
    pickupEnd(f, true, P.t < realS(PICKUP.settleMax) ? 'ok' : 'ok-forced');
  }
}

/**
 * 11/16 내디딤 ([사장님 11/16 결정] '지금 칼 줍는 기능이 잘 안쓰게 돼. 활성화되는 거리를 늘려.' — reach 0.6 → 0.9 · 기록 docs/strike/pickup_reach_2026-11-16.md):
 *  칼자루가 PICKUP.stepFrom(0.6 m — 11/05 웅크린 손이 칼자루 바로 위까지 닿던 거리) 넘게 멀면 웅크리며 칼 쪽으로 반걸음 PICKUP.step(0.3 m — 걸음 사다리) 내디딘다 —
 *  손이 칼자루까지 늘어나거나 칼이 멀리서 손으로 날아오지 않게. gait 기술 걸음(몸이 따라 실림): 칼이 앞쪽 반이면 'lunge'(앞발) · 뒤쪽 반이면 'retreat'(뒷발 — 돌아서기 전에 몸을 칼 쪽으로)
 *  · 몸 기준 앞 · 옆 몫으로 칼자루 쪽 · 몸 따라감 SECRET.stepPush(2.0 — 비기 걸음과 같은 수 · 없으면 골반이 0.15 m 남짓만 옮아 뒤쪽 칼은 손이 못 미침). 걸음을 못 받으면(앞으로 내딛는데 스틱이 물러남 · 발이 묶임) 다음 스텝에 다시 — 굽힘이 다 차면 그만(P.step 0)
 *  P.step: null = 아직 정하지 않음(기다림) · 0 = 안 내디딤 · > 0 = 내디딘 걸음 m
 */
function pickupStep(f, P) {
  if (!(PICKUP.step > 0) || !f.gait?.active) return (P.step = 0);
  const p = f.bodies.pelvis.translation();
  const dx = P.g.x - p.x, dz = P.g.z - p.z, d = Math.hypot(dx, dz);
  if (!(d > PICKUP.stepFrom)) return (P.step = 0);
  if (P.t >= P.T) return (P.step = 0);
  const F = f.forward(_f), R = f.right(_r);
  const fx = (dx * F.x + dz * F.z) / d, sx = (dx * R.x + dz * R.z) / d;
  if (f.gait.requestStep({ kind: fx >= 0 ? 'lunge' : 'retreat', fwd: PICKUP.step * fx, side: PICKUP.step * sx, duration: 0.3, push: SECRET.stepPush })) P.step = PICKUP.step;
}

/**
 * 줍는 중 부활이 시작됨 (revive.js tryRevive — 유령이 지금 칼 충돌 그룹을 적어 둠): 올리던 · 막 쥔 칼은 충돌이 0 이었으므로 부활 기록의 칼 그룹을 원래 값으로 고치고
 *  지금은 부활 유령 칼(땅하고만)로 둔다 — 부활이 끝나면 원래대로. 올리던 칼은 중력을 되돌려 떨어뜨림(부활이 일어설 때 다시 손으로 부른다)
 */
function revivalHandoff(f) {
  const P = f.pickup;
  if (P.saved) {
    for (const e of f.revival.groups ?? []) { const s = P.saved.find(([c]) => c === e[0]); if (s) e[1] = s[1]; }
    for (const [col, g] of P.saved) if (col.isEnabled() && !f.colliderInfo?.get(col.handle)?.detached) col.setCollisionGroups((g & 0xffff0000) | 1); // revive.js ghostSword 와 같은 꼴 (땅 비트 1)
  }
  if (P.sword) f.sword.setGravityScale(1, true);
  (f.pickupLog ??= []).push({ t0: +P.t0.toFixed(3), t1: +f.fightT.toFixed(3), t2: +f.fightT.toFixed(3), ok: false, why: 'revive', reach: +P.reach.toFixed(3), hand: P.hand, step: P.step ?? 0 });
  f.pickup = null;
  f.pickW = 0;
}

/** 쥔 칼(충돌 꺼짐)이 원래 그룹이면 부딪힐 것과 겹쳐 있나 (칼 몸체는 뺌) */
function swordOverlaps(f, saved) {
  let hit = false;
  for (const [col, g] of saved) {
    if (!col.isEnabled() || f.colliderInfo?.get(col.handle)?.detached) continue;
    f.world.intersectionsWithShape(col.translation(), col.rotation(), col.shape, guarded(_rg, () => ((hit = true), false), false), undefined, g, undefined, f.sword);
    rethrowRapier(_rg);
    if (hit) return true;
  }
  return false;
}

/** 줍기 끝: ok 면 칼 충돌 그룹을 되돌림. 아니면(넘어짐 · 죽음 · 칼이 멀어짐) 칼은 땅에 — 올리던 칼이면 충돌 · 중력을 되돌려 떨어뜨린다 */
function pickupEnd(f, ok, why) {
  const P = f.pickup;
  if (P.saved) for (const [col, g] of P.saved) if (col.isEnabled() && !f.colliderInfo?.get(col.handle)?.detached) col.setCollisionGroups(g); // 파손으로 떼어 낸 부품은 그대로 (revive.js ghost 와 같은 거름)
  if (!ok && P.sword) f.sword.setGravityScale(1, true);
  (f.pickupLog ??= []).push({ t0: +P.t0.toFixed(3), t1: +(P.t1 ?? f.fightT).toFixed(3), t2: +f.fightT.toFixed(3), ok, why, reach: +P.reach.toFixed(3), hand: P.hand, step: P.step ?? 0 }); // t1 = 다시 쥔 때 · t2 = 칼 충돌을 켠 때
  f.pickup = null;
  f.pickW = 0;
}

/** fighter.driveSword 에서 (팔 목표를 월드로 옮긴 뒤 · 팔 IK 전): 줍는 동안 칼 손 목표를 칼자루 쪽으로 wHand 만큼 */
export function pickupHand(f, target) {
  const P = f.pickup;
  if (P && P.wHand > 0) target.lerp(P.g, P.wHand);
}

/**
 * AI 줍기 (ai.js update 끝에서): 칼을 놓쳤고 주울 수 있으면 제 칼로 걸어가(스틱 = 몸 틀 앞 · 옆 몫) 곁에 서면 누른다(사람 'block' 과 같은 길).
 *  줍는 동안은 발을 멈춘다. 칼이 아직 떨어지는 중이거나(빠름) 못 줍는 칼이면 아무것도 안 함(오늘처럼 물러남)
 */
export function aiPickup(ai) {
  const me = ai.me;
  me.pickupPress = false;
  if (me.armed) return;
  if (me.pickup) {
    me.move.set(0, 0);
    me.stickX = me.stickY = 0;
    return;
  }
  if (!canPickup(me) || !swordSettled(me)) return;
  const p = me.bodies.pelvis.translation();
  const g = gripPoint(me);
  const dx = g.x - p.x;
  const dz = g.z - p.z;
  const d = Math.hypot(dx, dz);
  if (d <= PICKUP.reach * 0.85) {
    me.move.set(0, 0);
    me.stickX = me.stickY = 0;
    me.pickupPress = true;
    return;
  }
  const F = me.forward(_f);
  const R = me.right(_r);
  const k = Math.min(1, 0.35 + (d - PICKUP.reach * 0.85) / 0.6); // 다가갈수록 늦춤 (지나치지 않게)
  me.move.set(((dx * R.x + dz * R.z) / d) * k, ((dx * F.x + dz * F.z) / d) * k);
  me.stickX = me.move.x;
  me.stickY = me.move.y;
}
