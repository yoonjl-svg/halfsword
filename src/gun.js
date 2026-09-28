// ─────────────────────────────────────────────────────────────
//  권총 (??? 등급, 사장님 — "재미 삼아 최소 비용으로", 이런 무기는 더 늘리지 않는다)
//   · '찌르기'(탭)로 쏜다: 찌르기 동작이 총구를 상대 가슴으로 겨누며 팔을 뻗고, 뻗는 구간(skill.thrustPush)에 들어서면
//     총신 방향(칼 축 = 몸체 +y)으로 한 발. 탄은 무한이지만 한 발 사이 간격(GUN.cooldown)이 길다.
//   · 맞으면 늘 같은 세기(GUN.energy)의 찌르기 상처 — 새 상처 종류는 만들지 않는다. 투구는 총알을 못 막는다(머리 한 발 = 즉사). 쏘면 반동으로 총구가 튄다.
//   · 근접전 불가: 무기 제원이 날 없음·둔기 배율 0 이라 몸을 쳐도 아무 효과가 없다 (weapons.js pistol).
//   · 이동이 빠르다(spec.moveMul, fighter.js 걷는 속도). 부서지지 않는다(fragility 0).
//   · 소리: 총소리·장전 소리만 (불꽃·연기 없음). GUN_HOOKS 로 main.js 가 이어 줄 수 있고, 없으면 window.game.sound 로 낸다.
//  매 물리 스텝 combat.js afterStep 이 updateGun 을, skill.js thrust 가 gunCanFire 를, ai.js 가 gunAI 를 부른다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ANATOMY, ARENA } from './config.js';

export const GUN = {
  energy: 80, // J: 맞으면 늘 이 세기의 찌르기 (사장님: 머리는 한 발에 즉사, 가슴은 두 발). 가만히 선 상대 실측(tools/sim/gun_dummy.mjs): 머리 55 J 부터 즉사 · 가슴 1발 산다 · 2발 16초 뒤 죽음 · 3발 5초
  cooldown: 4.5, // 초: 한 발 쏜 뒤 다음 발까지 (장전 소리는 이게 끝날 때). 사장님: 재미를 위해 줄인다 (6.5 → 4.5)
  range: 25, // m: 총알이 닿는 거리
  maxWait: 0.6, // 초: 찌르기를 시작하고 이 안에 팔이 안 뻗어지면 그냥 그때 총구 방향으로 쏜다
  recoilBack: 0.5, // N·s: 쏠 때 총을 뒤로 미는 충격
  recoilUp: 0.7, // N·s: 총구를 위로 차 올리는 충격 (총구에 건다 → 총구가 들린다)
  spread: 2.5, // 도: 서서 쏠 때 총알이 총신에서 벗어나는 최대 각
  spreadMove: 5, // 도: 걷는 최고 속도로 달리며 쏘면 이만큼 더 벗어난다 (도망치며 쏘면 잘 안 맞는다)
};
/** main.js 가 소리를 이어 줄 자리: onShot(fighter, pos), onReload(fighter, pos) */
export const GUN_HOOKS = { onShot: null, onReload: null };

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _l = new THREE.Vector3();

function state(f) {
  return (f.gun ??= { cool: 0, pending: -1, shots: 0, hits: 0, seed: (0x2545f491 ^ Math.imul(f.index + 1, 0x9e3779b9)) >>> 0 });
}
function rand(g) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}

/** 지금 쏠 수 있나 (skill.js thrust 가 묻는다). 쏠 수 있으면 이번 찌르기에 한 발을 건다 */
export function gunCanFire(f) {
  const g = state(f);
  if (g.cool > 0 || g.pending >= 0) return false;
  g.pending = 0;
  return true;
}

/** 매 물리 스텝: 걸어 둔 한 발을 팔이 뻗을 때 쏘고, 장전 시간을 센다 */
export function updateGun(f, world, combat, dt) {
  const g = state(f);
  if (g.cool > 0) {
    g.cool -= dt;
    if (g.cool <= 0) sound('onReload', f);
  }
  if (g.pending < 0) return;
  g.pending += dt;
  if (!f.alive || !f.armed) return void (g.pending = -1);
  if (!f.skill?.thrustPush && g.pending < GUN.maxWait) return;
  g.pending = -1;
  g.cool = GUN.cooldown;
  g.shots++;
  fire(f, world, combat);
}

function fire(f, world, combat) {
  const sw = f.sword;
  const r = sw.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  _d.set(0, 1, 0).applyQuaternion(_q); // 총신 방향
  // 탄 퍼짐: 총신에서 무작위로 조금 벗어난다 (전용 난수 — Math.random 과 분리). 몸이 빠를수록 더 벗어난다
  const g = state(f);
  const pv = f.bodies.pelvis.linvel();
  const run = Math.min(1, Math.hypot(pv.x, pv.z) / 2.3);
  const cone = ((GUN.spread + GUN.spreadMove * run) * Math.PI) / 180;
  const a = Math.sqrt(rand(g)) * cone;
  const phi = rand(g) * Math.PI * 2;
  const u = _l.set(1, 0, 0).applyQuaternion(_q); // 총신에 수직인 두 축
  const v = new THREE.Vector3().crossVectors(_d, u);
  _d.multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a) * Math.cos(phi)).addScaledVector(v, Math.sin(a) * Math.sin(phi)).normalize();
  f.bladePoint(1, _o); // 총구
  sound('onShot', f);
  // 반동: 총구를 뒤·위로 차 올린다 (총구에 건 충격 — 손목이 받아 내며 총구가 들린다). 팔에도 충격이 전해진다
  const up = _l.set(0, 1, 0).addScaledVector(_d, -_d.y).normalize(); // 총신에 수직인 위쪽
  sw.applyImpulseAtPoint(
    { x: -_d.x * GUN.recoilBack + up.x * GUN.recoilUp, y: -_d.y * GUN.recoilBack + up.y * GUN.recoilUp, z: -_d.z * GUN.recoilBack + up.z * GUN.recoilUp },
    { x: _o.x, y: _o.y, z: _o.z },
    true,
  );
  f.takeJolt?.(GUN.recoilBack + GUN.recoilUp);
  const info = combat.info;
  const hit = castRay(world, _o, _d, (h) => info.get(h)?.fighter !== f);
  if (!hit) return;
  const vi = info.get(hit.collider.handle);
  if (!vi || vi.kind === 'weapon' || !vi.fighter || vi.fighter === f) return; // 칼·땅·벽에 맞았다
  bulletHit(f, vi, _o.clone().addScaledVector(_d, hit.toi), _d.clone(), combat);
}

/** 총알 한 발이 몸 부위(vi = colliderInfo 항목)의 point 에 dir 방향으로 맞았다: 늘 같은 세기의 찌르기 상처 (검사 도구도 부른다) */
export function bulletHit(f, vi, point, dir, combat) {
  const vic = vi.fighter;
  if (vic.state === 'dead') return null;
  _d.copy(dir);
  const b = vi.body;
  const bp = b.translation();
  const br = b.rotation();
  const local = point.clone().sub(_l.set(bp.x, bp.y, bp.z)).applyQuaternion(_q.set(br.x, br.y, br.z, br.w).invert());
  const zone = vi.kind === 'head' ? (local.y < -0.05 ? 'neck' : 'head') : vi.kind === 'chest' ? (local.y > 0.11 ? 'neck' : 'chest') : vi.kind;
  const helmet = zone === 'head' && vic.hasHelmet && local.y > -0.01;
  // 투구는 총알을 막지 못한다 (사장님: 머리에 제대로 맞으면 바로 죽는다) — 투구 표시(찌그러짐·긁힘)만 남는다
  const A = ANATOMY[zone] ?? ANATOMY.chest;
  let guard = 1;
  if (zone !== 'head' && zone !== 'neck') guard = 0.55 + 0.45 * (vic.cloth[vi.part] ?? 1);
  const E = GUN.energy * (f.weaponCfg.power ?? 1);
  const thr = A.stab * guard;
  const opened = E > thr;
  const res = {
    type: opened ? 'stab' : 'blunt',
    zone,
    energy: E,
    ephys: E,
    mFree: 0.01,
    severity: opened ? (E - thr) / 60 : 0,
    pass: opened,
    absorb: A.absorb ?? 100,
    bleedPerSev: (ANATOMY[zone] || ANATOMY.chest).bleed,
    local,
    point,
    dir: _d.clone(),
    speed: 300,
    mEff: 0.01,
    t: 1,
    helmet,
    helmetBlunt: helmet ? ANATOMY.helmet.blunt + (1 - ANATOMY.helmet.blunt) * (1 - vic.helmetIntegrity) : 1,
    bladeAxis: _d.clone(),
    gun: true,
  };
  state(f).hits++;
  vic.applyWound({ ...res, part: vi.part });
  // 맞은 몸이 살짝 밀린다 (총알 운동량은 작다 — 사람이 날아가지 않게 0.6 N·s 만)
  b.applyImpulseAtPoint({ x: _d.x * 0.6, y: _d.y * 0.6, z: _d.z * 0.6 }, { x: point.x, y: point.y, z: point.z }, true);
  combat.hooks.onWound?.(f, vic, res, point, { w: { fighter: f, kind: 'weapon', part: 'blade', body: f.sword }, v: vi });
  return res;
}

/** 광선 하나: 가장 가까이 맞은 콜라이더 { collider, toi } (없으면 null). 쏜 사람 자신의 콜라이더는 건너뛴다 */
function castRay(world, o, d, pred) {
  // RAPIER.Ray 는 origin·dir 만 담는 순수 객체라, 같은 모양의 객체를 넘기면 된다 (RAPIER 모듈을 따로 불러오지 않는다)
  const ray = { origin: { x: o.x, y: o.y, z: o.z }, dir: { x: d.x, y: d.y, z: d.z } };
  const hit = world.castRay(ray, GUN.range, true, undefined, undefined, undefined, undefined, (c) => pred(c.handle));
  if (!hit) return null;
  return { collider: hit.collider, toi: hit.timeOfImpact ?? hit.toi };
}

function sound(kind, f) {
  const p = f.bladePoint(1, new THREE.Vector3());
  const hook = GUN_HOOKS[kind];
  if (hook) return hook(f, p);
  const snd = globalThis.window?.game?.sound;
  if (!snd?.ctx || !snd._on) return;
  (kind === 'onShot' ? gunshotSound : reloadSound)(snd, p);
}

// ── 소리 (sound.js 의 이벤트·묶음을 그대로 빌려 쓴다: 전체 음량·끄기·먹먹함을 따른다) ──
/** 총소리: 짧고 센 잡음 터짐 + 낮은 "쿵" + 경기장에 울리는 꼬리 */
export function gunshotSound(snd, pos) {
  const c = snd.ctx;
  const ev = snd.event({ bus: snd.metalBus, gain: 1.2, prio: 3, pos });
  const t = c.currentTime;
  const nb = snd._noiseBuf();
  const src = c.createBufferSource();
  src.buffer = nb;
  const hp = c.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 1800;
  hp.Q.value = 0.5;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1.6, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  src.connect(hp).connect(g).connect(ev.input);
  src.start(t, Math.random() * 3);
  src.stop(t + 0.62);
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  const og = c.createGain();
  og.gain.setValueAtTime(0.9, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(og).connect(ev.input);
  o.start(t);
  o.stop(t + 0.21);
  ev.srcs.push(src, o);
  ev.end = t + 0.62;
}
/** 장전 소리: 슬라이드를 당겼다 놓는 쇳소리 두 번 "철-컥" */
export function reloadSound(snd, pos) {
  const c = snd.ctx;
  const ev = snd.event({ bus: snd.metalBus, gain: 0.5, prio: 1, pos });
  const t0 = c.currentTime;
  const nb = snd._noiseBuf();
  for (const [dt, f, amp] of [[0, 3200, 0.9], [0.13, 2400, 1.1]]) {
    const t = t0 + dt;
    const src = c.createBufferSource();
    src.buffer = nb;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 6;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    src.connect(bp).connect(g).connect(ev.input);
    src.start(t, Math.random() * 3);
    src.stop(t + 0.07);
    ev.srcs.push(src);
  }
  ev.end = t0 + 0.25;
}

/**
 * 권총 AI (ai.js 가 무기가 총이면 매 스텝 이것만 부른다): 간격을 벌려 도망 다니며 쏜다.
 *  3.2 m 보다 가까우면 물러나고(벽이 가까우면 옆으로 돈다), 5 m 보다 멀면 다가간다. 쏠 수 있고 7 m 안이면 찌르기(=발사).
 */
export function gunAI(ai, dt) {
  const me = ai.me;
  const d = ai.d;
  ai.gunT = (ai.gunT ?? 0) + dt;
  let fwd = d < 3.2 ? -1 : d > 5 ? 0.8 : 0;
  let side = Math.sin(ai.gunT * 0.9) * 0.6; // 옆으로 흔들며 움직인다 (가만히 서 있지 않게)
  const p = me.bodies.pelvis.translation();
  const rr = Math.hypot(p.x, p.z);
  if (fwd < 0 && rr > ARENA.radius - 1.3) {
    // 벽을 등졌다: 뒤로 못 가니 옆으로 크게 돌아 빠져나간다
    fwd = 0;
    side = (ai.gunSide ??= Math.sign(ai.foeLat || 1) * -1);
  } else ai.gunSide = null;
  me.move.set(side, fwd);
  const pose = ai.school.pose.point ?? ai.school.pose.cover;
  ai.hand.set(pose[0], pose[1]);
  ai.handSpeed = 1.2;
  ai.moveHand(dt);
  if (d < 7 && (me.gun?.cool ?? 0) <= 0) me.skill.thrust({ step: false });
}
