// ─────────────────────────────────────────────────────────────
//  떨어진 칼 줍기 (사장님 11/04 '코테는 칼을 더 자주 떨어트리게 해. 단 떨어진 무기를 줍는 동작을 신설하자.
//   무기 주위로 가서 막기 버튼을 누르거나 혹은 주위로 가면 자동으로 줍게, 적은 추가 비용으로 개발이 가능한가?' — config PICKUP · 기록 docs/strike/kote_pickup_2026-11-05.md)
//
//  칼을 놓친 몸(fighter.dropSword — 손목 치기 떨굼 · 칼 팔을 크게 다침 · 판 이어하기)이 땅에 떨어진 제 칼 곁에 서면:
//   · 사람: PICKUP.mode 'block' = 막기 단추(f.pickupPress — main.js · 재는 도구 손가락 봇) · 'auto' = 곁에 가면 저절로
//   · AI: PICKUP.ai = aiPickup 이 제 칼로 걸어가 곁에서 같은 누름
//  흐름 (실제 초 — 시간 사다리):
//   bend (PICKUP.bend 0.4 s): 칼 쪽으로 몸을 돌리며(f.pickup.face — fighter.updateHeading) 웅크리고(f.pickW → secret_instant.js stanceTick 'pickup' — 골반 낮춤 · 몸통 숙임)
//        칼 손 목표를 칼자루로(pickupHand — fighter.driveSword). 손이 칼자루 grab 안에 오거나 bend 가 차면 쥔다
//   lift (PICKUP.lift 0.2 s): 일어서며 칼이 손으로 올라온다 — 부활 때 칼이 돌아오는 길 그대로(revive.js startSwordReturn · flySword: 충돌 끔 · 중력 끔 · 스텝마다 빠르기로
//        손목 자리 · 쥐는 자세까지) → attachSword(생성자와 같은 손목 관절 · 손목 원뿔 · armed · 칼끝 추정 리셋) → 칼 충돌 그룹을 되돌림
//  그동안 칼은 상처를 내지도 막지도 못한다(armed 거짓 · 날아오는 칼은 충돌 없음). 넘어지면(state ≠ stand) 그만두고 칼은 땅에 남는다(lift 중이면 마저 쥔다 — 이미 손 앞).
//  f.pickupLog = [{ t0, t1, ok, why, reach, hand }] — 재는 도구가 읽는다
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { PICKUP, VITALS, realS } from './config.js';
import { startSwordReturn, flySword, attachSword } from './revive.js';

const _g = new THREE.Vector3();
const _h = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));

/** 이 몸이 줍기를 쓰나: AI 가 모는 몸 = PICKUP.ai · 사람 = PICKUP.mode */
export function pickupOn(f) {
  return f.aiControlled ? !!PICKUP.ai : !!PICKUP.mode;
}

/** 주울 수 있는 몸 · 칼인가 (칼은 땅에 있고 그 칼을 다시 쥘 수 있는 팔) */
export function canPickup(f) {
  if (!f.alive || f.armed || !f.sword || f.revival || f.state !== 'stand') return false;
  if (f.flexWeapon) return false; // 휘는 마디 무기(채찍): 마디 강체가 따로 놀아 손잡이만 손으로 옮기면 마디 관절이 늘어난다
  if (f.severedLimbs?.has('armS') || !(f.limbs.armS >= VITALS.dropSwordArm)) return false; // 칼 팔을 잃었거나 칼을 쥘 힘이 없다(주워도 곧 놓침)
  if (f.stamina?.exhausted) return false;
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
  return pickupOn(f) && canPickup(f) && swordSettled(f) && swordReachDist(f) <= PICKUP.reach;
}

/** fighter.step (updateState 뒤) 에서: 줍기를 시작하거나 한 스텝 진행 */
export function pickupTick(f, dt) {
  let P = f.pickup;
  if (!P) {
    f.pickW = 0;
    if (!pickupReady(f)) return;
    const press = f.aiControlled || PICKUP.mode === 'block' ? !!f.pickupPress : true;
    if (!press) return;
    P = f.pickup = { phase: 'bend', t: 0, T: realS(PICKUP.bend), wHand: 0, g: gripPoint(f, new THREE.Vector3()), face: null, sword: null, saved: null, t0: f.fightT, reach: swordReachDist(f), hand: null };
  }
  if (P.phase === 'bend') {
    if (!canPickup(f) || swordReachDist(f) > PICKUP.reach * 1.5) return pickupEnd(f, false, !f.alive ? 'dead' : f.state !== 'stand' ? 'down' : 'lost');
    P.t += dt;
    f.pickW = 1;
    P.wHand = smooth(P.t / P.T);
    gripPoint(f, P.g);
    P.face = P.g;
    const hd = wristOf(f, _h).distanceTo(P.g);
    if (hd > PICKUP.grab && P.t < P.T) return;
    // 쥔다: 칼 충돌 그룹을 적어 두고(날아오는 동안 0 — 부활과 같은 길) 손목으로 올린다
    P.hand = +hd.toFixed(3);
    P.saved = f.swordColliders.map((c) => [c, c.collisionGroups()]); // (attachSword 의 V.groups 는 부활 유령 칸 — 줍기는 쓰지 않음)
    P.sword = startSwordReturn(f);
    P.sword.fly = realS(PICKUP.lift);
    P.sword.arc = 0;
    P.phase = 'lift';
    P.t = 0;
    P.face = null;
    f.pickW = 0; // 일어선다 (stanceTick outTime 으로 풀림)
  }
  if (P.phase === 'lift') {
    if (!f.alive || f.severedLimbs?.has('armS')) return pickupEnd(f, false, 'dead');
    P.t += dt;
    P.wHand = 1 - smooth(P.t / P.sword.fly); // 손은 쥔 자리에서 자세 자리로 (칼은 손목을 따라온다)
    flySword(f, P, dt); // 다 오면 attachSword (P.sword = null · armed)
    if (!P.sword) pickupEnd(f, true, 'ok');
  }
}

/** 줍기 끝: ok 면 칼 충돌 그룹을 되돌림. 아니면(넘어짐 · 죽음 · 칼이 멀어짐) 칼은 땅에 — 올리던 칼이면 충돌 · 중력을 되돌려 떨어뜨린다 */
function pickupEnd(f, ok, why) {
  const P = f.pickup;
  if (P.saved) for (const [col, g] of P.saved) if (col.isEnabled() && !f.colliderInfo?.get(col.handle)?.detached) col.setCollisionGroups(g); // 파손으로 떼어 낸 부품은 그대로 (revive.js ghost 와 같은 거름)
  if (!ok && P.sword) f.sword.setGravityScale(1, true);
  (f.pickupLog ??= []).push({ t0: +P.t0.toFixed(3), t1: +f.fightT.toFixed(3), ok, why, reach: +P.reach.toFixed(3), hand: P.hand });
  f.pickup = null;
  f.pickW = 0;
}

/** fighter.driveSword 에서 (팔 목표를 월드로 옮긴 뒤 · 팔 IK 전): 줍는 동안 칼 손 목표를 칼자루 쪽으로 wHand 만큼 */
export function pickupHand(f, target) {
  const P = f.pickup;
  if (P && P.wHand > 0) target.lerp(P.g, P.wHand);
}

/**
 * AI 줍기 (PICKUP.ai — ai.js update 끝에서): 칼을 놓쳤고 주울 수 있으면 제 칼로 걸어가(스틱 = 몸 틀 앞 · 옆 몫) 곁에 서면 누른다(사람 'block' 과 같은 길).
 *  줍는 동안은 발을 멈춘다. 칼이 아직 떨어지는 중이거나(빠름) 못 줍는 칼이면 아무것도 안 함(오늘처럼 물러남)
 */
export function aiPickup(ai) {
  const me = ai.me;
  if (!PICKUP.ai) return;
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
