// ─────────────────────────────────────────────────────────────
//  권총 (??? 등급, 사장님 — "재미 삼아 최소 비용으로", 이런 무기는 더 늘리지 않는다)
//   · '찌르기'(탭)로 쏜다. 사람은 겨누는 동작 없이 지금 총신 방향(칼 축 = 몸체 +y, 레이저가 보여 준다)으로 바로 한 발 —
//     조준이 실력이다(사장님). AI 는 찌르기 동작으로 총구를 상대 가슴으로 겨누며 팔을 뻗고, 뻗는 구간(skill.thrustPush)에서 쏜다.
//     탄은 무한이지만 한 발 사이 간격(GUN.cooldown)이 길다.
//   · 맞으면 늘 같은 세기(GUN.energy)의 찌르기 상처 — 새 상처 종류는 만들지 않는다. 투구·판금은 총알을 막는 대신 그 자리에서 부서진다.
//     맨머리 한 발 = 즉사, 가슴 두 발. 쏘면 반동으로 총구가 튄다. 총신 방향으로 레이저(탄 길)를 그린다 — 사람은 겨누는 동작 없이 레이저 방향으로 바로 쏜다
//   · 근접전 불가: 무기 제원이 날 없음·둔기 배율 0 이라 몸을 쳐도 아무 효과가 없다 (weapons.js pistol).
//   · 이동이 빠르다(spec.moveMul, fighter.js 걷는 속도). 부서지지 않는다(fragility 0).
//   · 소리: 총소리·장전 소리만 (불꽃·연기 없음). GUN_HOOKS 로 main.js 가 이어 줄 수 있고, 없으면 window.game.sound 로 낸다.
//  매 물리 스텝 combat.js afterStep 이 updateGun 을, skill.js thrust 가 gunCanFire 를, ai.js 가 gunAI 를 부른다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ANATOMY, ARENA } from './config.js';

export const GUN = {
  energy: 80, // J: 맞으면 늘 이 세기의 찌르기 (사장님: 머리는 한 발에 즉사, 가슴은 두 발 — 투구·판금이 덮은 곳은 막히고 방어구가 부서진다). 가만히 선 상대 실측(tools/sim/gun_dummy.mjs): 머리 55 J 부터 즉사 · 가슴 1발 산다 · 2발 16초 뒤 죽음 · 3발 5초
  cooldown: 4, // 초: 한 발 쏜 뒤 다음 발까지 (장전 소리는 이게 끝날 때). 사장님: 6.5 → 4.5 → 4
  range: 25, // m: 총알이 닿는 거리
  armorBlunt: 0.25, // 투구·판금이 막으면(그리고 바로 부서지면) 몸에는 세기의 이 비율만 둔하게 전해진다
  laser: false, // 총신 방향으로 탄 길(레이저)을 그린다 (장전 중엔 흐리게). 꺼 둔다: 레이저는 외형 PM 의 gun_fx.js 가 희미하게 그린다 (두 겹으로 그리지 않게, 사장님 '레이저 희미하게')
  aiFirst: 1.5, // 초: AI 는 판이 열리고 이만큼 지나서야 첫 발을 쏜다
  maxWait: 0.6, // 초: 찌르기를 시작하고 이 안에 팔이 안 뻗어지면 그냥 그때 총구 방향으로 쏜다
  recoilBack: 0.5, // N·s: 쏠 때 총을 뒤로 미는 충격
  recoilUp: 0.2, // N·s: 총구를 위로 차 올리는 충격 (총구에 건다). 총신이 주먹 위에 있는 리볼버에서 총구가 약 18° 들렸다 0.8초에 제자리
  spread: 1, // 도: 서서 쏠 때 총알이 총신(레이저)에서 벗어나는 최대 각 — 레이저를 믿고 겨눌 수 있게 작게
  spreadMove: 3, // 도: 걷는 최고 속도로 달리며 쏘면 이만큼 더 벗어난다
};
/** main.js 가 소리를 이어 줄 자리: onShot(fighter, pos), onReload(fighter, pos) */
export const GUN_HOOKS = { onShot: null, onReload: null };

const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _l = new THREE.Vector3();

/** 총구 (월드): 칼 몸체 (spec.muzzleX, 손잡이+칼날 길이, 0) — 총신이 주먹 위로 올라와 있어 칼 축에서 비켜 있다 */
function muzzle(f, out) {
  const r = f.sword.rotation();
  const p = f.sword.translation();
  return out.set(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(p.x, p.y, p.z));
}

function state(f) {
  return (f.gun ??= { cool: 0, pending: -1, shots: 0, hits: 0, seed: (0x2545f491 ^ Math.imul(f.index + 1, 0x9e3779b9)) >>> 0 });
}
function rand(g) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}

/** 지금 쏠 수 있나 (skill.js thrust 가 묻는다). 쏠 수 있으면 이번 찌르기에 한 발을 건다 */
export function gunCanFire(f, { now = false } = {}) {
  const g = state(f);
  if (g.cool > 0 || g.pending >= 0) return false;
  g.pending = now ? GUN.maxWait : 0; // now: 겨누는 동작 없이 다음 스텝에 지금 총신(레이저) 방향으로 쏜다
  if (now) g.aim = 0; // 사람은 조준 보정 없음 (AI 는 gunAI 가 g.aim 을 난이도대로 정한다)
  return true;
}

/** 매 물리 스텝: 걸어 둔 한 발을 팔이 뻗을 때 쏘고, 장전 시간을 센다 */
export function updateGun(f, world, combat, dt) {
  const g = state(f);
  if (GUN.laser) updateLaser(f, g, world, combat);
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
  muzzle(f, _o); // 총구
  // AI 조준: 찌르기 동작만으로는 총신이 상대 가슴에서 15~23° 벗어난 채 쏜다(3 m 에서 가슴 폭은 ±4° — 거의 다 빗나갔다, 디렉터 12:38).
  //  AI 는 난이도 실력(level.skill: 쉬움 0.4 · 보통 0.7 · 어려움 0.85)만큼 총신을 상대 가슴 쪽으로 바로잡아 쏜다: 남는 오차 = (1 − (0.5 + 0.5·skill)).
  //  사람은 바로잡지 않는다 — 레이저를 보고 제 손으로 겨눈다
  if (g.aim > 0 && f.foe?.bodies?.chest) {
    const c = f.foe.bodies.chest.translation();
    // 가슴 몸체 중심보다 10 cm 아래(명치)를 노린다 — 가슴 중심을 노리면 남은 오차가 위로 튈 때 목·얼굴로 가서 첫 발에 즉사했다
    const to = new THREE.Vector3(c.x - _o.x, c.y - 0.1 - _o.y, c.z - _o.z).normalize();
    _d.lerp(to, g.aim).normalize();
  }
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
  const vi = hit ? info.get(hit.collider.handle) : null;
  // 어디에 맞았나 (검사 도구가 읽는다): 허공·땅벽·칼·몸
  const what = !hit ? 'air' : !vi ? 'world' : vi.kind === 'weapon' ? 'weapon' : 'body';
  g.what = g.what ?? {};
  g.what[what] = (g.what[what] ?? 0) + 1;
  if (what !== 'body' || vi.fighter === f) return; // 칼·땅·벽에 맞았거나 빗나갔다
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
  const plate = !helmet && zone !== 'neck' && !!vic.platedAt?.(vi.part, local);
  const E = GUN.energy * (f.weaponCfg.power ?? 1);
  if (helmet || plate) return armorStop(f, vi, vic, point, local, zone, helmet, E, combat);
  const A = ANATOMY[zone] ?? ANATOMY.chest;
  let guard = 1;
  if (zone !== 'head' && zone !== 'neck') guard = 0.55 + 0.45 * (vic.cloth[vi.part] ?? 1);
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

/**
 * 투구·판금이 총알을 막는다 — 대신 그 자리에서 부서진다 (사장님). 몸에는 둔한 충격(세기 × GUN.armorBlunt)만.
 *  투구: 내구도를 0 으로 → applyWound 가 벗겨/부숴 날린다. 판금: 그 부위 판의 내구도를 바닥으로 → wearPlate 가 판을 떼어 날린다
 */
function armorStop(f, vi, vic, point, local, zone, helmet, E, combat) {
  const Eb = E * GUN.armorBlunt;
  if (helmet) vic.helmetIntegrity = 0;
  else vic.plate[vi.part] = Math.min(vic.plate[vi.part], 1e-6);
  const res = {
    type: 'blunt',
    zone,
    energy: Eb,
    ephys: Eb,
    mFree: 0.01,
    severity: 0,
    pass: false,
    absorb: 100,
    bleedPerSev: 0,
    local,
    point,
    dir: _d.clone(),
    speed: 300,
    mEff: 0.01,
    t: 1,
    helmet,
    plate: !helmet,
    helmetBlunt: ANATOMY.helmet.blunt,
    bladeAxis: _d.clone(),
    gun: true,
    armorStopped: true,
  };
  state(f).hits++;
  vic.applyWound({ ...res, part: vi.part });
  vi.body.applyImpulseAtPoint({ x: _d.x * 0.6, y: _d.y * 0.6, z: _d.z * 0.6 }, { x: point.x, y: point.y, z: point.z }, true);
  combat.hooks.onWound?.(f, vic, res, point, { w: { fighter: f, kind: 'weapon', part: 'blade', body: f.sword }, v: vi });
  return res;
}

/**
 * 레이저(탄 길): 총구에서 총신 방향으로 처음 닿는 곳까지 붉은 선 + 끝에 점. 칼 그룹의 자식이라 총과 함께 움직인다.
 *  장전 중엔 흐리게 — 다시 쏠 수 있는지도 이걸로 보인다. 쏜 사람 자신의 몸·총은 건너뛴다
 */
function updateLaser(f, g, world, combat) {
  const group = f.swordGroup;
  if (!group) return;
  if (!g.laser) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.6, depthWrite: false });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1, 0.008).translate(0, 0.5, 0), mat);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), mat);
    beam.renderOrder = dot.renderOrder = 2;
    group.add(beam, dot);
    g.laser = { beam, dot, mat };
  }
  const L = g.laser;
  const show = f.alive && f.armed;
  L.beam.visible = L.dot.visible = show;
  if (!show) return;
  const r = f.sword.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  const dir = _l.set(0, 1, 0).applyQuaternion(_q);
  const o = muzzle(f, new THREE.Vector3());
  const hit = castRay(world, o, dir, (h) => combat.info.get(h)?.fighter !== f);
  const dist = hit ? hit.toi : GUN.range;
  const y0 = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength; // 총구 (칼 기준)
  const mx = f.weapon.muzzleX ?? 0;
  L.beam.position.set(mx, y0, 0);
  L.beam.scale.set(1, Math.max(0.01, dist), 1);
  L.dot.position.set(mx, y0 + dist, 0);
  L.dot.visible = !!hit;
  L.mat.opacity = g.cool > 0 ? 0.18 : 0.6;
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
  const p = muzzle(f, new THREE.Vector3());
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
  // 판이 열리자마자 쏘지 않는다: 첫 발 전 GUN.aiFirst 초 (예전엔 0.1초에 쏴 판이 시작하자마자 끝나기도 했다)
  if (ai.gunT == null) state(me).cool = Math.max(state(me).cool, GUN.aiFirst);
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
  if (d < 7 && (me.gun?.cool ?? 0) <= 0 && me.skill.thrust({ step: false, autoAim: true })) state(me).aim = 0.5 + 0.5 * (ai.level?.skill ?? 0.7);
}
