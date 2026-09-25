// ─────────────────────────────────────────────────────────────
//  게임 본체: 화면 준비 → 물리 세계 → 매 프레임 반복(게임 루프)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import * as CONFIG from './config.js';
import { PHYSICS, ARENA, DAMAGE } from './config.js';
import { Fighter, GROUND_GROUPS } from './fighter.js';
import { Input } from './input.js';
import { AI } from './ai.js';
import { Particles, Sound } from './effects.js';

await RAPIER.init();

// ── 설정 (브라우저에 저장) ──
const DEFAULTS = { difficulty: 'normal', pixel: false, blood: true, sound: true, invertTilt: false };
const settings = { ...DEFAULTS };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem('gladiator-settings') || '{}'));
} catch {
  /* 저장소를 못 쓰면 기본값으로 */
}
const saveSettings = () => {
  try {
    localStorage.setItem('gladiator-settings', JSON.stringify(settings));
  } catch {
    /* 무시 */
  }
};

// ── 화면(Three.js) ──
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a1f18);
scene.fog = new THREE.Fog(0x2a1f18, 9, 26);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
camera.position.set(0, 1.5, 5.5);

scene.add(new THREE.HemisphereLight(0xffe8c4, 0x3a2a1e, 0.9));
const sun = new THREE.DirectionalLight(0xfff0d8, 1.8);
sun.position.set(3, 8, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -2, near: 1, far: 20 });
scene.add(sun, sun.target);

buildArena(scene);

function buildArena(scene) {
  // 모래 바닥
  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(12, 48),
    new THREE.MeshStandardMaterial({ color: 0xb89a6e, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  scene.add(sand);
  // 경기장 벽(뒤쪽 반원)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 0.9 });
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    const r = 9;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6 + (i % 2) * 0.3, 0.6), wallMat);
    block.position.set(Math.cos(a) * r, 0.8, Math.sin(a) * r);
    block.lookAt(0, 0.8, 0);
    block.receiveShadow = true;
    scene.add(block);
  }
  // 좌우 끝 기둥
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a7760, roughness: 0.8 });
  for (const x of [-ARENA.halfLength - 0.4, ARENA.halfLength + 0.4]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 2.6, 12), pillarMat);
    p.position.set(x, 1.3, -0.6);
    p.castShadow = true;
    scene.add(p);
  }
}

// ── 화면 크기 / 픽셀 모드 ──
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (settings.pixel) {
    // 작은 해상도로 그린 뒤 크게 늘리면 도트 그래픽처럼 보인다
    const px = Math.max(3, Math.round(h / 180));
    renderer.setPixelRatio(1);
    renderer.setSize(Math.ceil(w / px), Math.ceil(h / px), false);
    canvas.classList.add('pixel');
  } else {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    canvas.classList.remove('pixel');
  }
  camera.aspect = w / h;
  camera.fov = w / h < 1.2 ? 55 : 40;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── 물리 세계와 등장인물 ──
const particles = new Particles(scene);
const sound = new Sound();
const input = new Input(canvas);

let world, eventQueue, colliderInfo, player, enemy, ai;
const fighterMeshes = [];

function newRound() {
  // 이전 판 정리
  for (const g of fighterMeshes) scene.remove(g);
  fighterMeshes.length = 0;
  if (world) world.free();
  if (eventQueue) eventQueue.free();
  particles.clear();

  world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  eventQueue = new RAPIER.EventQueue(true);
  colliderInfo = new Map();

  // 바닥 + 좌우 보이지 않는 벽
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  for (const s of [-1, 1]) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 3, 3).setTranslation(s * (ARENA.halfLength + 0.2), 3, 0).setCollisionGroups(GROUND_GROUPS),
      ground,
    );
  }

  const before = new Set(scene.children);
  player = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 0,
    name: '나',
    x: -ARENA.startGap / 2,
    facing: 1,
    colors: { cloth: 0x2f4f7f, limb: 0x3b3f47, skin: 0xd6a57c, metal: 0x9aa3ad, boot: 0x3a2618, grip: 0x4a2e1a },
  });
  enemy = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 1,
    name: '상대',
    x: ARENA.startGap / 2,
    facing: -1,
    colors: { cloth: 0x7f2a22, limb: 0x47403b, skin: 0xc79470, metal: 0x6f6a62, boot: 0x2a1a10, grip: 0x2a1a10 },
  });
  for (const c of scene.children) if (!before.has(c)) fighterMeshes.push(c);
  ai = new AI(enemy, player, settings.difficulty);
  roundOver = false;
  roundOverTime = 0;
  hitStop = 0;
}

// ── 타격 판정 ──
let hitStop = 0; // 큰 타격 때 아주 잠깐 느려지는 연출
let shake = 0;
let clashCooldown = 0;
const _p = new THREE.Vector3();

function contactPoint(h1, h2, fallback) {
  const c1 = world.getCollider(h1);
  const c2 = world.getCollider(h2);
  let found = null;
  world.contactPair(c1, c2, (manifold) => {
    if (!found && manifold.numSolverContacts() > 0) {
      const p = manifold.solverContactPoint(0);
      if (p) found = new THREE.Vector3(p.x, p.y, p.z);
    }
  });
  return found || fallback;
}

// 디버그용 통계 (브라우저 콘솔에서 game.stats 로 확인)
const stats = { events: 0, bodyContacts: 0, maxSpeed: 0, hits: [], clashes: 0, simTime: 0 };
function processContacts() {
  eventQueue.drainContactForceEvents((e) => {
    stats.events++;
    const h1 = e.collider1();
    const h2 = e.collider2();
    const a = colliderInfo.get(h1);
    const b = colliderInfo.get(h2);
    if (!a || !b || a.fighter === b.fighter) return;

    if (a.kind === 'weapon' && b.kind === 'weapon') {
      // 칼과 칼이 부딪힘 → 불꽃 + 쇳소리
      const rel = a.fighter.hitPointVel.distanceTo(b.fighter.hitPointVel);
      if (rel > 2.5 && clashCooldown <= 0) {
        clashCooldown = 0.09;
        stats.clashes++;
        const p = contactPoint(h1, h2, a.fighter.bladePoint(0.6));
        particles.sparks(p, rel);
        sound.clash(rel);
      }
      return;
    }
    const weapon = a.kind === 'weapon' ? a : b.kind === 'weapon' ? b : null;
    const victim = weapon === a ? b : a;
    if (!weapon || victim.kind === 'weapon') return;
    const attacker = weapon.fighter;
    const target = victim.fighter;
    if (target.hitCooldowns.has(victim.part)) return;

    const point = contactPoint(h1, h2, toVec(victim.body.translation()));
    // 칼날의 어느 지점에 맞았는지 → 그 지점의 속도 추정
    const grip = toVec(attacker.sword.translation());
    const tip = attacker.bladePoint(1, _p);
    const along = THREE.MathUtils.clamp(point.clone().sub(grip).dot(tip.clone().sub(grip).normalize()) / 1.2, 0, 1);
    const bladeVel = attacker.hitPointVel.clone().multiplyScalar(along / 0.7).lerp(attacker.tipVel, Math.max(0, along - 0.7) / 0.3);
    const pv = victim.body.linvel();
    const rel = bladeVel.clone().sub(new THREE.Vector3(pv.x, pv.y, pv.z));
    const speed = rel.length();
    stats.bodyContacts++;
    stats.maxSpeed = Math.max(stats.maxSpeed, speed);
    if (speed < DAMAGE.minSpeed) return;

    let dmg = (speed - DAMAGE.minSpeed) * DAMAGE.perSpeed * (DAMAGE.parts[victim.kind] ?? 1);
    if (weapon.part !== 'blade') dmg *= 0.4; // 칼자루/손잡이로 친 경우
    const bladeDir = tip.clone().sub(grip).normalize();
    if (rel.clone().normalize().dot(bladeDir) > 0.7) dmg *= DAMAGE.stabBonus; // 찌르기
    if (dmg < 1) return;

    target.hitCooldowns.set(victim.part, DAMAGE.hitCooldown);
    const dealt = target.takeHit(victim.kind, dmg);
    stats.hits.push(`${attacker.name}->${victim.part} ${dealt.toFixed(1)}`);
    // 맞은 부위를 칼이 움직이던 방향으로 밀어준다
    const imp = rel.clone().normalize().multiplyScalar(Math.min(25, dealt * 0.5));
    victim.body.applyImpulse({ x: imp.x, y: imp.y, z: imp.z }, true);

    particles.blood(point, rel, dealt);
    sound.hit(dealt);
    if (dealt > 18) {
      hitStop = 0.07;
      shake = Math.min(0.25, dealt / 150);
    }
  });
}

const toVec = (v) => new THREE.Vector3(v.x, v.y, v.z);

// ── UI ──
const $ = (id) => document.getElementById(id);
const menu = $('menu');
const hud = $('hud');
const topButtons = $('topButtons');
const toast = $('toast');
const hint = $('hint');
const moveButtons = $('moveButtons');
let state = 'menu'; // menu | fight | paused
let roundOver = false;
let roundOverTime = 0;

$('howto').innerHTML = input.isTouchDevice
  ? '<li>화면을 손가락으로 끌면 칼이 따라 움직여요.</li><li>폰을 운전대처럼 좌우로 기울이면 걸어요.</li><li>◎ 버튼: 지금 각도를 "똑바로"로 다시 맞춰요.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점!</li>'
  : '<li>화면을 클릭하면 마우스가 잠기고, 마우스로 칼을 휘둘러요.</li><li>A / D (또는 ← / →) 로 이동해요.</li><li>Esc 로 마우스 잠금 해제, P 로 일시정지.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점!</li>';

function refreshSettingsUI() {
  document.querySelectorAll('[data-setting]').forEach((el) => {
    const key = el.dataset.setting;
    if (el.classList.contains('seg')) {
      el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === settings[key]));
    } else {
      el.classList.toggle('on', !!settings[key]);
    }
  });
  particles.bloodOn = settings.blood;
  sound.on = settings.sound;
  input.invertTilt = settings.invertTilt;
}
document.querySelectorAll('[data-setting]').forEach((el) => {
  const key = el.dataset.setting;
  if (el.classList.contains('seg')) {
    el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        settings[key] = b.dataset.v;
        if (key === 'difficulty' && ai) ai.setLevel(settings.difficulty);
        saveSettings();
        refreshSettingsUI();
      }),
    );
  } else {
    el.addEventListener('click', () => {
      settings[key] = !settings[key];
      saveSettings();
      refreshSettingsUI();
      if (key === 'pixel') resize();
    });
  }
});
refreshSettingsUI();

function showToast(text, ms = 1200) {
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(showToast.t);
  if (ms) showToast.t = setTimeout(() => toast.classList.remove('show'), ms);
}

function showHint(text, ms = 3500) {
  hint.textContent = text;
  hint.classList.add('show');
  clearTimeout(showHint.t);
  showHint.t = setTimeout(() => hint.classList.remove('show'), ms);
}

async function startFight() {
  sound.unlock();
  // 폰이면 전체화면 + 가로 고정 시도 (지원 안 하면 조용히 넘어감)
  if (input.isTouchDevice) {
    try {
      await document.documentElement.requestFullscreen?.();
      await screen.orientation?.lock?.('landscape');
    } catch {
      /* 무시 */
    }
    const ok = await input.enableTilt();
    setTimeout(() => {
      if (!ok || !input.tiltActive) {
        moveButtons.classList.add('show');
        showHint('기울기 센서를 쓸 수 없어서 이동 버튼을 켰어요.');
      } else {
        input.calibrateTilt();
      }
    }, 800);
  }
  $('rotate').classList.add('enabled');
  menu.classList.remove('show');
  hud.classList.add('show');
  topButtons.classList.add('show');
  $('btnCalib').style.display = input.isTouchDevice ? '' : 'none';
  input.enabled = true;
  newRound();
  state = 'fight';
  showToast('싸워라!');
  showHint(input.isTouchDevice ? '끌어서 칼 휘두르기 · 기울여서 걷기' : '클릭해서 마우스 잠금 · A/D 이동');
}

function pause() {
  if (state !== 'fight') return;
  state = 'paused';
  input.enabled = false;
  document.exitPointerLock?.();
  $('menuTitle').textContent = '일시정지';
  $('menuSub').textContent = '설정을 바꾸거나 계속할 수 있어요.';
  $('btnStart').textContent = '처음부터 다시';
  $('btnResume').style.display = '';
  showMenu();
}

function showMenu() {
  document.activeElement?.blur?.();
  menu.classList.add('show');
  menu.querySelector('.card').scrollTop = 0;
}

function resume() {
  menu.classList.remove('show');
  state = 'fight';
  input.enabled = true;
  last = performance.now();
}

$('btnStart').addEventListener('click', startFight);
$('btnResume').addEventListener('click', resume);
$('btnPause').addEventListener('click', pause);
$('btnCalib').addEventListener('click', () => {
  input.calibrateTilt();
  showHint('지금 각도를 기준으로 맞췄어요.', 1500);
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'KeyP') return;
  if (state === 'fight') pause();
  else if (state === 'paused' && !roundOver) resume();
});
for (const [id, dir] of [
  ['btnLeft', -1],
  ['btnRight', 1],
]) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    input.buttonMove = dir;
  });
  const stop = () => (input.buttonMove = 0);
  b.addEventListener('pointerup', stop);
  b.addEventListener('pointercancel', stop);
  b.addEventListener('pointerleave', stop);
}

function updateHud() {
  $('hpP').style.width = `${player.hp}%`;
  $('hpE').style.width = `${enemy.hp}%`;
  $('balP').style.width = `${Math.max(0, player.balance)}%`;
  $('balE').style.width = `${Math.max(0, enemy.balance)}%`;
}

function checkRoundEnd(dt) {
  if (!roundOver) {
    if (!enemy.alive || !player.alive) {
      roundOver = true;
      const win = !enemy.alive;
      showToast(win ? '승리!' : '패배...', 0);
    }
    return;
  }
  roundOverTime += dt;
  if (roundOverTime > 3.5 && state === 'fight') {
    state = 'paused';
    input.enabled = false;
    document.exitPointerLock?.();
    toast.classList.remove('show');
    const win = !enemy.alive;
    $('menuTitle').textContent = win ? '승리!' : '패배...';
    $('menuSub').textContent = win ? '상대를 쓰러뜨렸어요. 난이도를 올려볼까요?' : '다시 도전해 보세요. 칼을 크게, 빠르게!';
    $('btnStart').textContent = '다시 싸우기';
    $('btnResume').style.display = 'none';
    showMenu();
  }
}

// ── 카메라: 두 사람 사이를 비추고 거리에 맞춰 줌 ──
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (!player) return;
  const a = player.pelvisPos;
  const b = enemy.pelvisPos;
  const midX = (a.x + b.x) / 2;
  const gap = Math.abs(a.x - b.x);
  const portrait = camera.aspect < 1.2;
  const dist = (portrait ? 6.5 : 4.4) + gap * 0.55;
  camTarget.set(midX, 1.0, 0);
  const k = 1 - Math.exp(-dt * 4);
  camera.position.x += (midX - camera.position.x) * k;
  camera.position.y += (1.65 - camera.position.y) * k;
  camera.position.z += (dist - camera.position.z) * k;
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  camera.lookAt(camTarget);
  sun.position.set(midX + 3, 8, 5);
  sun.target.position.set(midX, 0, 0);
}

// ── 게임 루프 ──
let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  if (state === 'fight' && player) {
    // 손 목표 갱신 (입력 → 플레이어)
    const d = input.consumeHandDelta();
    if (player.alive) {
      player.handOffset.x += d.x * player.facing;
      player.handOffset.y += d.y;
    }
    player.moveInput = player.alive ? input.move : 0;

    // 타격 순간 살짝 멈칫 + 판이 끝나면 슬로모션
    let scale = 1;
    if (hitStop > 0) {
      hitStop -= dt;
      scale = 0.15;
    }
    if (roundOver) scale = Math.min(scale, 0.35);
    acc += dt * scale;
    let steps = 0;
    while (acc >= PHYSICS.timestep && steps < PHYSICS.maxStepsPerFrame) {
      ai.update(PHYSICS.timestep);
      player.step(PHYSICS.timestep);
      enemy.step(PHYSICS.timestep);
      world.step(eventQueue);
      processContacts();
      clashCooldown -= PHYSICS.timestep;
      stats.simTime += PHYSICS.timestep;
      acc -= PHYSICS.timestep;
      steps++;
    }
    if (steps === PHYSICS.maxStepsPerFrame) acc = 0;
    player.syncMeshes();
    enemy.syncMeshes();
    particles.update(dt * scale);
    updateHud();
    checkRoundEnd(dt);
  }
  updateCamera(dt);
  renderer.render(scene, camera);
}

// 메뉴 뒤 배경으로 보일 첫 판을 미리 만들어 둔다
newRound();
player.syncMeshes();
enemy.syncMeshes();
requestAnimationFrame(frame);

// 디버그/튜닝용: 브라우저 콘솔에서 game.player.hp = 100 처럼 만져볼 수 있다
window.game = {
  get player() {
    return player;
  },
  get enemy() {
    return enemy;
  },
  get world() {
    return world;
  },
  get ai() {
    return ai;
  },
  stats,
  config: CONFIG,
  AI,
  settings,
};
