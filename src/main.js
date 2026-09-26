// ─────────────────────────────────────────────────────────────
//  게임 본체: 화면 준비 → 물리 세계 → 매 프레임 반복(게임 루프)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import * as CONFIG from './config.js';
import { PHYSICS, ARENA, CAMERA } from './config.js';
import { Fighter, GROUND_GROUPS } from './fighter.js';
import { GUARDS } from './guards.js';
import { InputTrail } from './trail.js';
import { Input, attachStick } from './input.js';
import { LOOKS } from './looks.js';
import { AI } from './ai.js';
import { CHARACTERS_BY_ID, randomCharacter } from './characters.js';
import { Particles, haptic, stickDecal, rebuildDecal } from './effects.js';
import { Sound } from './sound.js';
import { Combat } from './combat.js';
import { buildArena } from './arena.js';

await RAPIER.init();

// ── 설정 (브라우저에 저장) ──
const DEFAULTS = { difficulty: 'normal', pixel: false, blood: true, sound: true, invertTilt: false, moveMode: 'stick', skill: '0.7', guardNames: true, trail: true };
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

// ── 상대 캐릭터 고르기 (테스트/데모용 최소 기능. 정식 선택 UI는 나중에) ──
//  ?foe=<id>     : characters.js의 특정 캐릭터로 고정
//  ?foe=random   : 판마다 무작위로 다른 캐릭터 (아무것도 없을 때의 기본값)
//  ?foe=default  : 예전처럼 LOOKS.enemy + 무작위 성격의 "기본 상대" (메뉴의 난이도 설정을 따른다)
const foeParam = new URLSearchParams(location.search).get('foe') || 'random';
const foeRandomEachRound = foeParam === 'random';
let currentFoe = null; // 이번 판에 고른 캐릭터 (없으면 기본 상대)
function pickFoe() {
  if (foeRandomEachRound) return randomCharacter(currentFoe?.id); // 같은 상대가 두 번 연속 나오지 않게
  if (foeParam && CHARACTERS_BY_ID[foeParam]) return CHARACTERS_BY_ID[foeParam];
  return currentFoe; // 고정 지정이 없으면 같은 상대를 계속 쓴다
}

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

const arena = buildArena(scene); // 중세 마상시합장 (arena.js)

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
const trail = new InputTrail(canvas); // 방금 조작한 흔적 (반투명 선)
input.trail = trail;

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

  currentFoe = pickFoe();
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
    name: currentFoe ? currentFoe.name : '상대',
    x: ARENA.startGap / 2,
    heading: Math.PI,
    look: currentFoe ? currentFoe.look : LOOKS.enemy,
  });
  for (const c of scene.children) if (!before.has(c)) fighterMeshes.push(c);
  // 캐릭터를 골랐으면 그 캐릭터가 설계된 난이도(level)와 성격(persona)을 그대로 쓴다.
  //  캐릭터가 없으면(기본 상대) 예전처럼 메뉴의 난이도 설정 + 무작위 성격을 쓴다
  ai = currentFoe ? new AI(enemy, player, currentFoe.ai.level, currentFoe.ai.persona) : new AI(enemy, player, settings.difficulty);
  player.skill.level = +settings.skill;
  player.skill.autoGuard = true; // 베고 나면 기본 자세로 돌아간다 (AI는 스스로 자세를 고른다)
  combat = new Combat(colliderInfo, { onWound, onClash });
  roundOver = false;
  roundOverTime = 0;
  camFollow.copy(player.pelvisPos);
  hitStop = 0;
}

// ── 타격감 ──
let hitStop = 0; // 큰 타격 때 아주 잠깐 멈칫하는 연출
let clashCooldown = 0;
let clashStopCooldown = 0; // 칼끼리 부딪혀 멈칫한 뒤 다시 멈칫하기까지 (초)
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
  // 흔적 (몸 표면에 붙어서 같이 움직인다)
  const mesh = vic.partMesh[pr.v.part];
  const group = vic.groups[pr.v.part];
  if (mesh && group) {
    // 몸 기준 좌표 → 겉면 메쉬 기준 좌표 (팔처럼 겉모습이 따로 돌려진 부위가 있다)
    group.updateMatrixWorld(true);
    const toMesh = new THREE.Matrix4().copy(mesh.matrixWorld).invert().multiply(group.matrixWorld);
    const local = r.local.clone().applyMatrix4(toMesh);
    const q = new THREE.Quaternion();
    const rr = pr.v.body.rotation();
    q.set(rr.x, rr.y, rr.z, rr.w).invert();
    const bladeLocal = r.bladeAxis.clone().applyQuaternion(q).transformDirection(toMesh);
    const clothed = r.zone !== 'head' && r.zone !== 'neck';
    const sev = r.severity;
    if (r.helmet && vic.helmetGroup) {
      // 투구: 긁힘, 세면 찌그러짐 (벗겨지면 투구와 함께 날아간다)
      const dome = vic.helmetGroup.children[0];
      const p = r.local.clone().applyMatrix4(new THREE.Matrix4().copy(dome.matrixWorld).invert().multiply(group.matrixWorld));
      stickDecal(dome, p, bladeLocal, 'scratch', 0.03, Math.min(0.16, 0.04 + e / 1200));
      if (e > 60) stickDecal(dome, p, null, 'dent', 0.03 + Math.min(0.05, e / 4000), 0.03 + Math.min(0.05, e / 4000));
    } else if (!opened) {
      if (e > 15) stickDecal(mesh, local, null, 'bruise', 0.05 + Math.min(0.08, e / 1500), 0.05 + Math.min(0.08, e / 1500));
    } else if (settings.blood) {
      const len = Math.min(0.24, 0.06 + sev * 0.14);
      if (r.type === 'stab') stickDecal(mesh, local, null, 'stab', 0.05 + sev * 0.02, 0.05 + sev * 0.02);
      else stickDecal(mesh, local, bladeLocal, clothed ? 'tear' : 'cut', 0.035 + Math.min(0.03, sev * 0.02), len);
      // 피가 옷에 번진다 (상처에서 계속 흐르는 만큼)
      const wound = vic.wounds[vic.wounds.length - 1];
      if (wound && wound.part === pr.v.part && !wound.soak) wound.soak = stickDecal(mesh, local, null, 'soak', 0.04, 0.04);
    } else {
      stickDecal(mesh, local, bladeLocal, 'bruise', 0.03, 0.08);
    }
  }
  if (opened) att.bloodyBlade(0.08 + r.severity * 0.15);
  // 소리
  if (r.helmet) sound.helmet(e);
  if (r.type === 'cut') sound.cut(e, r.pass);
  else if (r.type === 'stab') sound.stab(e);
  else sound.blunt(e);
  if (e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg') && !r.helmet) sound.bone(e);
  // 멈칫: 재질에 따라. 살을 깨끗이 가르면 짧게, 박히거나 뼈·투구에 걸리면 길게 (최대 0.1초 — 조작이 늦게 느껴지지 않게)
  const bone = e > 70 && (r.zone === 'head' || r.zone === 'arm' || r.zone === 'leg');
  const stopT = r.pass ? Math.min(0.06, e / 2000) : r.stuck || bone || r.helmet ? Math.min(0.1, e / 900) : Math.min(0.08, e / 1200);
  hitStop = Math.max(hitStop, stopT);
  // 손맛: 칼의 타격 중심(스위트 스팟, 코등이에서 약 58cm)에 맞으면 손이 울리지 않고, 칼끝·칼 밑동에 맞으면 손이 찌릿하다
  //  (손을 축으로 도는 강체에서 한 점을 치면 축(손)이 받는 충격 = 1 − a·b/k²)
  const sting = att.swordSting(r.t);
  // 카메라가 칼이 지나간 방향으로 밀린다 (내가 맞으면 더 크게, 내가 칠 땐 손이 받은 충격만큼)
  kickCamera(r.dir, Math.min(1.6, e / 120) * (vic === player ? 1.4 : 0.4 + 0.4 * sting));
  if (vic === player) haptic(e / 120);
  else if (att === player) haptic((e / 120) * (0.4 + 0.6 * sting));
  if (!vic.alive) slowMo = 1.6;
  arena.excite(vic.alive ? Math.min(0.6, e / 250) : 1); // 관중이 들썩인다
}

function onClash(point, speed, touch) {
  // 소리: 새로 부딪힌 순간(또는 맞댄 채 다시 세게 친 순간)에만 "쨍". 맞댄 채 미끄러지는 동안은 긁히는 소리(updateBindSound)
  //  touch.vn = 부딪히기 직전 맞닿는 방향 속도(부딪히는 세기), touch.vt = 칼날을 따라 스치는 속도 (combat.js bladeClash)
  if (touch && (touch.fresh || touch.vn > 3)) sound.clash(touch.vn, touch.vt);
  // 연출의 세기는 "부딪히기 직전" 속도로 정한다 (부딪힌 뒤 속도엔 튕겨 나온 몫이 섞여 있다)
  const impact = touch ? (touch.fresh || touch.vn > 3 ? touch.vn : 0) : speed;
  if (clashCooldown > 0) return;
  if (impact < 2.5) {
    // 세게 부딪히진 않았지만 칼날을 따라 빠르게 긁으면 불꽃만 조금
    if (touch && touch.vt > 5) {
      clashCooldown = 0.12;
      particles.sparks(point, touch.vt * 0.4);
    }
    return;
  }
  clashCooldown = 0.09;
  stats.clashes++;
  particles.sparks(point, impact);
  // 세게 부딪힐 때만 잠깐 멈칫 (칼끼리 맞대고 밀 때마다 멈추면 끊겨 보인다)
  if (impact > 6 && clashStopCooldown <= 0) {
    hitStop = Math.max(hitStop, Math.min(0.08, impact / 200));
    clashStopCooldown = 0.5;
  }
  kickCamera(new THREE.Vector3((Math.random() - 0.5), 0.3, (Math.random() - 0.5)).normalize(), Math.min(0.6, impact / 25));
  haptic(Math.min(1, impact / 15));
}

// 칼을 휘두르면 바람 소리 (칼마다 하나씩 계속 돌면서 칼끝 속도를 따라간다)
const whooshState = new Map();
function updateWhoosh(f, dt) {
  // 판이 바뀌어도 같은 소리 고리를 다시 쓴다 (나/상대 한 개씩)
  let st = whooshState.get(f.index);
  if (!st) whooshState.set(f.index, (st = { loop: null }));
  if (!st.loop) st.loop = sound.whooshLoop();
  st.loop?.set(f.armed ? f.tipVel.length() : 0);
}
/** 싸움 화면이 아닐 때(메뉴·일시정지)는 바람 소리·긁는 소리를 끈다 */
function muteWhoosh() {
  for (const st of whooshState.values()) st.loop?.set(0);
  sound.scrape(0, 0);
}
// 칼끼리 맞대고 밀며 미끄러지는 동안 계속 나는 "지이익" (바인드)
function updateBindSound() {
  const b = combat.bladeContact;
  if (combat.binding) sound.scrape(b.slide, b.press);
  else sound.scrape(0, 0);
}

// 상처에서 떨어지는 핏방울
const _wp = new THREE.Vector3();
function updateDrips(f, dt) {
  for (const w of f.wounds) {
    // 옷에 번지는 핏자국: 흘린 피만큼 커진다 (가끔씩 다시 투사)
    if (w.soak) {
      w.soaked = (w.soaked || 0) + w.bleed * dt;
      const size = Math.min(0.26, 0.04 + Math.sqrt(w.soaked) * 0.9);
      if (size > w.soak.userData.w * 1.12) rebuildDecal(w.soak, size, size * 1.3);
    }
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
        if (key === 'difficulty' && ai && !currentFoe) ai.setLevel(settings.difficulty); // 캐릭터를 골랐으면 그 캐릭터의 난이도를 따로 지킨다
        if (key === 'skill' && player) player.skill.level = +settings.skill;
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

// 이번 상대 소개 (이름 · 별명 · 한마디). 큰 글씨 알림(toast)과 따로, 작게 잠깐 보여 준다
function showFoeIntro(ch) {
  const el = $('foeIntro');
  clearTimeout(showFoeIntro.t);
  if (!ch) return el.classList.remove('show');
  el.querySelector('b').textContent = ch.name;
  el.querySelector('i').textContent = ch.epithet;
  el.querySelector('span').textContent = `“${ch.taunt}”`;
  // "싸워라!"가 사라진 다음에 띄운다 (같은 자리에 겹치지 않게)
  showFoeIntro.t = setTimeout(() => {
    el.classList.add('show');
    showFoeIntro.t = setTimeout(() => el.classList.remove('show'), 3500);
  }, 1300);
}

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
  showFoeIntro(currentFoe);
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
  sound.unlock(); // 폰이 전화·잠금 등으로 소리를 멈췄으면 다시 켠다
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
// 싸우는 도중 전화·잠금·다른 앱 때문에 소리가 멈췄으면(아이폰은 'interrupted'), 다음에 화면을 만질 때 다시 켠다.
// (일시정지 → 계속하기를 누르지 않아도 되게. 시작 버튼을 누르기 전에는 소리 장치를 만들지 않는다: sound.ctx 가 있을 때만)
for (const ev of ['touchend', 'pointerup', 'keydown']) {
  window.addEventListener(ev, () => sound.ctx && sound.unlock(), { passive: true });
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && sound.ctx) sound.unlock(); // (손을 대지 않아도 되는 브라우저는 여기서 바로 다시 켜진다)
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
//  흔들림은 "스프링에 매단 카메라"로 계산한다: 충격이 오면 그 방향으로 밀렸다가 부드럽게 제자리로.
//  (예전처럼 매 프레임 무작위로 떨지 않는다)
const camShake = { o: new THREE.Vector3(), v: new THREE.Vector3() };
function kickCamera(dir, strength) {
  camShake.v.addScaledVector(dir, strength);
}
const camTarget = new THREE.Vector3();
const camFollow = new THREE.Vector3();
const camLook = new THREE.Vector3();
const camDir = new THREE.Vector3(1, 0, 0);
const _cd = new THREE.Vector3();
function updateCamera(dt) {
  if (!player || window.game?.freeCam) return; // freeCam: 디버그용으로 카메라를 직접 조종
  // 흔들리는 골반 대신 몸 전체 무게중심을 부드럽게 따라간다
  const a = camFollow.lerp(player.com || player.pelvisPos, 1 - Math.exp(-dt * CAMERA.follow));
  const b = enemy.com || enemy.pelvisPos;
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
  // 발걸음: 디딜 때 살짝 내려앉음
  if (player.footstep > 0) {
    camShake.v.y -= CAMERA.stepBob * 12 * player.footstep;
    player.footstep = 0;
  }
  // 스프링 흔들림 적분 (단단함 170, 감쇠 13)
  const h = Math.min(dt, 1 / 30);
  camShake.v.addScaledVector(camShake.o, -170 * h).multiplyScalar(Math.max(0, 1 - 13 * h));
  camShake.o.addScaledVector(camShake.v, h);
  camera.position.add(camShake.o);
  camera.lookAt(camLook);
  camera.position.sub(camShake.o); // 다음 프레임 따라가기는 흔들림 없는 위치 기준
  sun.position.set(a.x + 4, 9, a.z + 3);
  sun.target.position.set(a.x, 0, a.z);
}

// ── 지금 검술 자세 이름 (자세가 바뀌면 잠깐 보여 준다) ──
const guardName = $('guardName');
let guardShown = -1;
let guardTimer = 0;
function updateGuardName(dt) {
  const g = settings.guardNames && player.guardWeight() > 0.5 && player.alive ? player.guardPose.nearest : -1;
  if (g !== guardShown && g >= 0) {
    guardShown = g;
    guardName.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = GUARDS[g].name;
    const d = document.createElement('span');
    d.textContent = GUARDS[g].desc;
    guardName.append(b, d);
    guardName.classList.add('show');
    guardTimer = 1.6;
  }
  if (g < 0) guardShown = -1;
  guardTimer -= dt;
  if (guardTimer <= 0) guardName.classList.remove('show');
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
    // 멈칫하는 동안엔 손가락 움직임도 느리게 반영한다 (멈칫이 끝나는 순간 손이 휙 튀지 않게)
    const inScale = hitStop > 0 ? 0.25 : 1;
    if (player.alive) {
      player.handOffset.x += d.x * inScale;
      player.handOffset.y += d.y * inScale;
    }
    // 검술 층의 "자세로 돌아가기"가 알아야 할 것: 손가락이 화면에 닿아 있는지, 지금 움직였는지
    player.handHeld = input.activeTouch !== null;
    player.inputActive = Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    const m = input.move;
    player.move.set(player.alive ? m.x : 0, player.alive ? m.y : 0);
    updateGuardName(dt);
    // 마우스로 조작할 땐 손가락 흔적 대신 오른쪽 아래 원판에 손 위치의 흔적을 그린다
    const mouseMode = !input.isTouchDevice;
    if (mouseMode && player.alive) trail.addPad(player.skill.aim.x, player.skill.aim.y, now / 1000);

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
      player.foe = enemy;
      enemy.foe = player;
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
      clashStopCooldown -= PHYSICS.timestep;
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
    updateBindSound();
    particles.update(dt * scale);
    arena.update(dt);
    updateHud();
    checkRoundEnd(dt);
  } else muteWhoosh();
  updateCamera(dt);
  renderer.render(scene, camera);
  trail.enabled = settings.trail && state === 'fight';
  trail.draw(now / 1000, !input.isTouchDevice);
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
  trail,
  stats,
  config: CONFIG,
  THREE,
  camera,
  freeCam: false,
  renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  AI,
  settings,
  sound, // 예: game.sound.clash(8) 로 소리 확인, game.sound.stats
};
