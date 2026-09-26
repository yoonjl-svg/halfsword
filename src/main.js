// ─────────────────────────────────────────────────────────────
//  게임 본체: 화면 준비 → 물리 세계 → 매 프레임 반복(게임 루프)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import * as CONFIG from './config.js';
import { PHYSICS, ARENA, CAMERA } from './config.js';
import { Fighter, GROUND_GROUPS } from './fighter.js';
import { Input, attachStick } from './input.js';
import { LOOKS } from './looks.js';
import { AI } from './ai.js';
import { Particles, Sound, haptic, addWoundMark } from './effects.js';
import { Combat } from './combat.js';

await RAPIER.init();

// ── 설정 (브라우저에 저장) ──
const DEFAULTS = { difficulty: 'normal', pixel: false, blood: true, sound: true, invertTilt: false, moveMode: 'stick' };
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
scene.background = new THREE.Color(0xb8c9d9);
scene.fog = new THREE.Fog(0xb8c9d9, 16, 40);

const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 100);
camera.position.set(-3.5, CAMERA.height, 0.5);

scene.add(new THREE.HemisphereLight(0xfff2dc, 0x6a5540, 1.1));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.0);
sun.position.set(4, 9, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 25 });
scene.add(sun, sun.target);

buildArena(scene);

function buildArena(scene) {
  // 모래 바닥
  const sand = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({ color: 0xc9ae84, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  scene.add(sand);

  // 나무 울타리 (실제 벽 위치와 같음)
  const wood = new THREE.MeshStandardMaterial({ color: 0x9a7650, roughness: 0.9 });
  const R = ARENA.radius + 0.15;
  const posts = 32;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 0.12), wood);
    post.position.set(Math.cos(a) * R, 0.575, Math.sin(a) * R);
    post.castShadow = true;
    scene.add(post);
    // 가로대 두 줄 (다음 기둥까지)
    const a2 = ((i + 1) / posts) * Math.PI * 2;
    const len = 2 * R * Math.sin(Math.PI / posts);
    for (const y of [0.55, 1.0]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.06), wood);
      rail.position.set(((Math.cos(a) + Math.cos(a2)) / 2) * R, y, ((Math.sin(a) + Math.sin(a2)) / 2) * R);
      rail.rotation.y = -(a + a2) / 2 + Math.PI / 2;
      scene.add(rail);
    }
  }

  // 바깥 돌벽
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd8cfbf, roughness: 0.95 });
  const segs = 36;
  const WR = 12;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2 + (i % 3) * 0.2, 0.8), wallMat);
    block.position.set(Math.cos(a) * WR, 1.6, Math.sin(a) * WR);
    block.lookAt(0, 1.6, 0);
    block.receiveShadow = true;
    scene.add(block);
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
  camera.fov = w / h < 1.2 ? CAMERA.fov + 15 : CAMERA.fov;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── 물리 세계와 등장인물 ──
const particles = new Particles(scene);
const sound = new Sound();
const input = new Input(canvas);

let world, eventQueue, colliderInfo, player, enemy, ai, combat;
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

  // 바닥 + 원형 울타리 벽
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  const n = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / n) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.2, 0.6, half)
        .setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setCollisionGroups(GROUND_GROUPS),
      ground,
    );
  }

  const before = new Set(scene.children);
  player = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 0,
    name: '나',
    x: -ARENA.startGap / 2,
    heading: 0,
    look: LOOKS.player,
  });
  enemy = new Fighter(RAPIER, world, scene, colliderInfo, {
    index: 1,
    name: '상대',
    x: ARENA.startGap / 2,
    heading: Math.PI,
    look: LOOKS.enemy,
  });
  for (const c of scene.children) if (!before.has(c)) fighterMeshes.push(c);
  ai = new AI(enemy, player, settings.difficulty);
  combat = new Combat(colliderInfo, { onWound, onClash });
  roundOver = false;
  roundOverTime = 0;
  hitStop = 0;
}

// ── 타격감 ──
let hitStop = 0; // 큰 타격 때 아주 잠깐 멈칫하는 연출
let shake = 0;
let clashCooldown = 0;
let slowMo = 0; // 결정타 슬로모션 남은 시간

// 디버그용 통계 (브라우저 콘솔에서 game.stats 로 확인)
const stats = { hits: [], clashes: 0, simTime: 0, passes: 0 };

/** combat.js가 상처를 만들 때마다 부른다: 피, 자국, 소리, 진동, 멈칫 */
function onWound(att, vic, r, point, pr) {
  const tag = `${att.name}->${r.zone}:${r.type}${r.pass ? '(관통)' : ''} ${r.energy.toFixed(0)}J 심각도${r.severity.toFixed(2)}`;
  stats.hits.push(tag);
  if (r.pass) stats.passes++;
  const e = r.energy;
  const opened = r.type !== 'blunt' && r.severity > 0;
  // 피: 벤 방향으로 흩뿌림
  if (opened) particles.blood(point, r.dir, 6 + r.severity * 40, r.speed);
  // 상처 자국 (부위에 붙어서 같이 움직인다)
  const group = vic.groups[pr.v.part];
  if (group) {
    const q = new THREE.Quaternion();
    const rr = pr.v.body.rotation();
    q.set(rr.x, rr.y, rr.z, rr.w).invert();
    const bladeLocal = r.bladeAxis.clone().applyQuaternion(q);
    addWoundMark(group, r.local, bladeLocal, r.type, r.type === 'blunt' ? e / 150 : r.severity, settings.blood);
  }
  // 소리
  if (r.helmet) sound.clash(Math.min(20, e / 6));
  if (r.type === 'cut') sound.cut(e, r.pass);
  else if (r.type === 'stab') sound.stab(e);
  else sound.blunt(e);
  if (e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg') && !r.helmet) sound.bone(e);
  // 멈칫 + 흔들림 (에너지에 비례)
  hitStop = Math.max(hitStop, Math.min(0.12, e / 900));
  shake = Math.max(shake, Math.min(0.35, e / 400));
  if (att === player || vic === player) haptic(e / 120);
  if (!vic.alive) slowMo = 1.6;
}

function onClash(point, speed) {
  if (speed < 2.5 || clashCooldown > 0) return;
  clashCooldown = 0.09;
  stats.clashes++;
  particles.sparks(point, speed);
  sound.clash(speed);
  shake = Math.max(shake, Math.min(0.15, speed / 80));
  haptic(Math.min(1, speed / 15));
}

// 칼을 빠르게 휘두르면 바람 소리
const whooshState = new Map();
function updateWhoosh(f, dt) {
  const st = whooshState.get(f) || { cd: 0, prev: 0 };
  const sp = f.tipVel.length();
  st.cd -= dt;
  if (sp > 9 && st.prev <= 9 && st.cd <= 0) {
    sound.whoosh(sp);
    st.cd = 0.3;
  }
  st.prev = sp;
  whooshState.set(f, st);
}

// 상처에서 떨어지는 핏방울
const _wp = new THREE.Vector3();
function updateDrips(f, dt) {
  for (const w of f.wounds) {
    if (w.bleed < 0.001) continue;
    if (Math.random() < w.bleed * dt * 900) {
      const g = f.groups[w.part];
      if (g) particles.drip(g.localToWorld(_wp.copy(w.local)));
    }
  }
}

// ── UI ──
const $ = (id) => document.getElementById(id);
const menu = $('menu');
const hud = $('hud');
const topButtons = $('topButtons');
const toast = $('toast');
const hint = $('hint');
attachStick(input, $('moveStick'), $('moveKnob'));
let state = 'menu'; // menu | fight | paused
let roundOver = false;
let roundOverTime = 0;

$('howto').innerHTML = input.isTouchDevice
  ? '<li>화면을 손가락으로 끌면 칼이 따라 움직여요. 좌우로 끌면 가로베기, 위아래로 끌면 내려치기.</li><li>폰을 앞뒤로 기울이면 전진·후퇴, 좌우로 기울이면 옆걸음.</li><li>◎ 버튼: 지금 각도를 "똑바로"로 다시 맞춰요.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점!</li>'
  : '<li>화면을 클릭하면 마우스가 잠기고, 마우스로 칼을 휘둘러요.</li><li>W A S D (또는 방향키) 로 걸어요.</li><li>Esc 로 마우스 잠금 해제, P 로 일시정지.</li><li>칼을 빠르게 휘둘러야 세게 들어가요. 머리가 약점!</li>';

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
  input.useTilt = settings.moveMode === 'tilt';
  document.body.classList.toggle('touch', input.isTouchDevice);
  document.body.classList.toggle('moveStick', settings.moveMode !== 'tilt');
  applyMoveMode();
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

// 이동 방식에 맞게 조이스틱 / 영점 버튼을 보이거나 숨긴다
function applyMoveMode() {
  const touch = input.isTouchDevice;
  const tilt = settings.moveMode === 'tilt';
  $('moveStick').classList.toggle('show', touch && !tilt && state !== 'menu');
  $('btnCalib').style.display = touch && tilt ? '' : 'none';
  if (touch && tilt && state !== 'menu' && !input.tiltActive) input.enableTilt();
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
    if (settings.moveMode === 'tilt') {
      const ok = await input.enableTilt();
      setTimeout(() => {
        if (!ok || !input.tiltActive) {
          settings.moveMode = 'stick';
          saveSettings();
          refreshSettingsUI();
          showHint('기울기 센서를 쓸 수 없어서 조이스틱으로 바꿨어요.');
        } else {
          input.calibrateTilt();
        }
      }, 800);
    }
  }
  $('rotate').classList.add('enabled');
  menu.classList.remove('show');
  hud.classList.add('show');
  topButtons.classList.add('show');
  input.enabled = true;
  newRound();
  state = 'fight';
  applyMoveMode();
  showToast('싸워라!');
  showHint(
    !input.isTouchDevice
      ? '클릭해서 마우스 잠금 · WASD 이동'
      : settings.moveMode === 'tilt'
        ? '끌어서 칼 휘두르기 · 앞뒤/좌우로 기울여서 걷기'
        : '왼쪽 아래 조이스틱으로 걷기 · 나머지 화면을 끌어서 칼 휘두르기',
  );
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
// 체력 게이지 대신: 피를 흘리거나 아프면 화면 가장자리가 붉게 물든다 (하프 소드처럼 숫자 없음)
function updateHud() {
  const lost = THREE.MathUtils.clamp((1 - player.blood) / 0.5, 0, 1);
  const pulse = player.bleed > 0.002 ? 0.15 * (0.5 + 0.5 * Math.sin(performance.now() / 180)) : 0;
  const v = Math.min(1, lost * 0.85 + Math.min(1, player.pain) * 0.35 + pulse);
  $('vignette').style.opacity = v.toFixed(3);
  $('vignette').style.filter = player.consciousness < 0.6 ? `blur(${(0.6 - player.consciousness) * 6}px)` : '';
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
    const loser = win ? enemy : player;
    const cause = { 목: '목을 베였다', 머리: '머리에 치명상', 출혈: '과다 출혈', 기절: '기절' }[loser.causeOfDeath] || '쓰러졌다';
    $('menuTitle').textContent = win ? '승리!' : '패배...';
    $('menuSub').textContent = `${win ? '상대' : '나'}: ${cause}. ` + (win ? '난이도를 올려볼까요?' : '칼날을 세워 크게 휘둘러 보세요.');
    $('btnStart').textContent = '다시 싸우기';
    $('btnResume').style.display = 'none';
    showMenu();
  }
}

// ── 카메라: 내 캐릭터 오른쪽 어깨 너머에서 상대를 바라본다 ──
const camTarget = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camDir = new THREE.Vector3(1, 0, 0);
const _cd = new THREE.Vector3();
function updateCamera(dt) {
  if (!player || window.game?.freeCam) return; // freeCam: 디버그용으로 카메라를 직접 조종
  const a = player.pelvisPos;
  const b = enemy.pelvisPos;
  // 나 → 상대 방향 (너무 붙어 있으면 이전 방향 유지)
  _cd.set(b.x - a.x, 0, b.z - a.z);
  if (_cd.length() > 0.3) camDir.lerp(_cd.normalize(), 1 - Math.exp(-dt * 3)).normalize();
  const right = _cd.set(-camDir.z, 0, camDir.x);
  camTarget
    .copy(a)
    .addScaledVector(camDir, -CAMERA.back)
    .addScaledVector(right, CAMERA.shoulder)
    .setY(CAMERA.height);
  // 경기장 바깥 돌벽을 뚫고 나가지 않게
  const r = Math.hypot(camTarget.x, camTarget.z);
  if (r > 10.5) camTarget.multiplyScalar(10.5 / r).setY(CAMERA.height);
  const k = 1 - Math.exp(-dt * 6);
  camera.position.lerp(camTarget, k);
  const look = _cd.copy(a).addScaledVector(camDir, CAMERA.lookAhead).setY(1.1);
  camLook.lerp(look, k);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.5);
  }
  camera.lookAt(camLook);
  sun.position.set(a.x + 4, 9, a.z + 3);
  sun.target.position.set(a.x, 0, a.z);
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
      player.handOffset.x += d.x;
      player.handOffset.y += d.y;
    }
    const m = input.move;
    player.move.set(player.alive ? m.x : 0, player.alive ? m.y : 0);

    // 타격 순간 살짝 멈칫 + 판이 끝나면 슬로모션
    let scale = 1;
    if (hitStop > 0) {
      hitStop -= dt;
      scale = 0.12;
    }
    if (slowMo > 0) {
      slowMo -= dt;
      scale = Math.min(scale, 0.25); // 결정타 슬로모션
    } else if (roundOver) scale = Math.min(scale, 0.5);
    acc += dt * scale;
    let steps = 0;
    while (acc >= PHYSICS.timestep && steps < PHYSICS.maxStepsPerFrame) {
      player.faceTarget = enemy.bodies.pelvis.translation();
      enemy.faceTarget = player.bodies.pelvis.translation();
      ai.update(PHYSICS.timestep);
      player.step(PHYSICS.timestep);
      enemy.step(PHYSICS.timestep);
      player.cacheState();
      enemy.cacheState();
      world.step(eventQueue, combat.physicsHooks);
      combat.afterStep(world, eventQueue);
      clashCooldown -= PHYSICS.timestep;
      stats.simTime += PHYSICS.timestep;
      acc -= PHYSICS.timestep;
      steps++;
    }
    if (steps === PHYSICS.maxStepsPerFrame) acc = 0;
    player.syncMeshes();
    enemy.syncMeshes();
    for (const f of [player, enemy]) {
      updateWhoosh(f, dt * scale);
      updateDrips(f, dt * scale);
    }
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

// 디버그/튜닝용: 브라우저 콘솔에서 game.player.blood, game.config.WEAPON.mass = 3 처럼 만져볼 수 있다
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
  get combat() {
    return combat;
  },
  stats,
  config: CONFIG,
  THREE,
  camera,
  freeCam: false,
  AI,
  settings,
};
