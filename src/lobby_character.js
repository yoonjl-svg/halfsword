import * as THREE from 'three';
import { getWeapon } from './weapons.js';
import { createLobbyRig } from './lobby_rig.js';
import { CAMERA } from './config.js';

// 돌림판 값 (사장님 확인 전 — 확인표 1933): 놓을 때 빠르기는 마지막 0.1 s 손가락 움직임 · 그 뒤 0.08 s 넘게 멈췄다 놓으면 관성 없음 ·
//  관성은 tau 초 시정수로 줄어 stop 아래면 선다 — 더 도는 각 = 빠르기 × tau(반 바퀴/s 로 튕기면 약 36° · 상한 max = 한 바퀴/s 면 72°) · 방향키 한 번 = step
export const TURN = Object.freeze({ window: 0.1, still: 0.08, tau: 0.2, stop: 0.1, max: 2 * Math.PI, step: Math.PI / 8, ease: 14 });

// 대기실 첫 칸의 캐릭터 미리보기 (샛별 저장소 817db21c · b73a9c82 · 3b280a1b 에서 들여옴). 따로 된 WebGL 그리개 하나 — 돌리거나 크기·장착이 바뀔 때만 그린다.
// 10/16 (사장님 03:5x '캐릭터쪽 해상도 너무 낮던데. 좋아지게 할 방법은 없어?' — docs/import/lobby_fix_2026-10-16.md §5): 화소 비 1 → 기기 화소 비(min(devicePixelRatio, 3)) + 계단 펴기(MSAA).
//  data-calls · data-ratio · data-fov(화각 — 10/17) = 시험 도구가 읽는 값
// 10/16 08:3x (사장님 ''드래그하여 회전' 문구 지우고 360도 회전은 안되나? 스테이지에서 보는 것처럼' — docs/import/ui_fix_2026-10-16.md §5): 돌림판(턴테이블).
//  끄는 동안은 손가락 그대로(칸 너비 = 한 바퀴 · 막는 각 없음 — 몇 바퀴든) · 놓을 때 손가락이 움직이고 있었으면 그 빠르기로 조금 더 돌다 선다(관성 TURN) ·
//  그리기는 화면 한 장에 한 번(requestAnimationFrame 으로 모음) · 멈추면 그리지 않는다. 좌우 방향키 22.5° · Home 정면도 부드럽게 돌아간다. 돌림판 축 = 골반.
//  data-angle(도 — 돌린 만큼 그대로, 360 을 넘을 수 있다) · data-turning(돌고 있나) · data-frames(그린 수) = 시험 도구가 읽는 값
// 10/16 08:4x (사장님 '무기 장착도 정교해져야 돼. 지금 나뭇가지 장착해보면 전투 때 모습과 달라.' — 같은 문서 §6): 몸 = lobby_rig.js — 싸움과 같은 Fighter 를 따로 된 작은 물리 세계에
//  세워 판에서 가만히 선 자세(그 무기의 쥠 · 겨눔 · 주먹 · 두손 빈손)까지 돌린 것. 전에는 메뉴 뒤 판 플레이어의 겉모습을 복제해 칼팔을 내리고 무기 모형을 손에 고정 각으로 붙였다.
//  자세 잡기는 장착을 바꿀 때만(화면 한 장에 몇 ms 씩 나눠) · 그동안 지난 모습을 둔다 · 세운 몸은 대기실을 닫을 때까지 내려 둠(장착을 오가도 다시 안 만듦) ·
//  잡은 자세는 이번 실행 동안 기억(같은 무기·책이면 대기실을 다시 열어도 물리 없이 바로).
//  data-rig = 'settling' | 'ready' · data-equipped · data-armor = 시험 도구가 읽는 값. 시험·사진 도구는 container.lobbyPreview(아래 돌려주는 것)로 아무 무기나 걸어 본다
// 10/17 (사장님 '해상도 안좋고 엉성해보임 … 장비 장착 후 다른 각도로 돌리면 크기도 마구 달라져' → (가) 칼끝은 칸 끝에서 자름 · '전투 시 보는 모습을 가장 똑같이 재현해'
//  — docs/import/lobby_preview_2026-10-17.md): 그리개 · 빛 · 그림자 = 싸움 화면 그대로(아래 BATTLE) · 카메라 = 싸움 카메라가 내 몸을 보는 자리(거리 · 높이 — 원근이 같다)를
//  돌림판 축 둘레로 돌린다(몸 · 빛 · 그림자는 그 자리 — 싸움 무대에서 내 몸 둘레를 걸어 도는 것과 같다) · 틀은 몸 키(세운 뼈대)로 한 번만 정한다(무기 · 투구 · 각과 무관).
//  전: 정사영 · ACES 톤 매핑 · 빛 약 2 배 · 그림자 없음 · 돌린 각마다 무기 상자 폭에 맞춰 물러남(나뭇가지 90° 에서 몸 −31 %).
const poses = new Map(); // 잡은 자세 — 이번 실행 동안 (열쇠 poseKey)
const poseKey = (s) => JSON.stringify([s.weapon, s.schoolFootwork ?? null, s.schoolParry ?? null, s.skill?.level ?? null, s.skill?.corr ?? null]);
// 싸움 화면 값 그대로 (main.js 의 hemi · sun · sun.shadow · 그리개 — 첫 무대 포세이돈 = 메뉴 뒤 무대의 빛. 해 방향 = stages.js DEFAULT_SUN_OFFSET (4, 9, 3) — 몸은 +x 를 본다(판 첫 자리와 같음)).
//  무대마다 빛이 다르지만 미리보기는 기본 무대 하나로 고정한다. 바꾸면 main.js 와 같이
export const BATTLE = Object.freeze({
  sky: 0xe3e6e8, ground: 0x716c63, hemi: 1.2, // 반구광 (구름 낀 하늘빛 + 모래에 되비친 빛)
  sun: 0xffe7cb, sunI: 1.7, sunDir: Object.freeze([4, 9, 3]), // 해
  shadowMap: 1024, shadowBox: 4, shadowNear: 1, shadowFar: 25, // 해 그림자 (PCFShadowMap · 반지름 기본 1 — 그림자 결이 싸움과 같다)
});
// 틀 (사장님 확인 전 — docs/import/lobby_preview_2026-10-17.md §7): 카메라 쪽 발끝 바닥(축에서 footR m — 겨눈 자세의 발끝이 0.48~0.56 m)부터
//  세운 뼈대 머리 꼭대기(축 위 1.72 m)까지가 칸 높이의 fill 몫 · 그 아래 여백 feet 몫 — 몸 키 · 카메라 자리만으로 정해 무기 · 투구 · 각과 무관하다.
//  shadow = 발밑 그림자 진하기 — 싸움 화면 모래 위 그림자 밝기 비 0.694(그림자 진 곳 ÷ 안 진 곳, 화면 값)를 잰 그대로: 카드 바탕을 1 − 0.694 만큼 어둡게
export const VIEW = Object.freeze({ fill: 0.8, feet: 0.05, footR: 0.5, shadow: 0.31 });
/**
 * 카메라 숙임 · 화각: 높이 Hc 의 카메라에서 수평 D0 의 바닥 점(높이 0)과 수평 D1 의 머리 점(높이 H)을 칸 세로 자리 feet · feet + fill 에 놓는다.
 *  카메라가 수평 아래로 p 만큼 숙이면 내려다보는 각 a 인 점의 화면 세로 = tan(p − a) / tan(반화각) → 두 점이 같은 반화각을 갖는 p (이분법)
 */
function aim(D0, D1, Hc, H, feet, fill) {
  const a0 = Math.atan2(Hc, D0), a1 = Math.atan2(Hc - H, D1), n0 = 2 * feet - 1, n1 = 2 * (feet + fill) - 1;
  const f = (p) => Math.tan(p - a1) * n0 - Math.tan(p - a0) * n1;
  let lo = a1, hi = a0;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (f(lo) * f(m) <= 0) hi = m; else lo = m; }
  const p = (lo + hi) / 2;
  return { pitch: p, fov: THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(p - a0) / n0)) };
}

/** game: main.js — lobbyRigSpec(무기 id) 로 다음 판 플레이어와 같은 몸 값을 준다 */
export function createLobbyCharacter(container, game) {
  const scene = new THREE.Scene(), model = new THREE.Group(); // model = 몸을 붙이는 곳 (돌리지 않는다 — 카메라가 돈다)
  scene.add(model);
  // 빛 · 그림자 = 싸움 화면 그대로 (BATTLE — main.js 의 hemi · sun). 해 겨눔 = 돌림판 축 발밑 (싸움: 해 = 따라가는 점 + 방향 · 겨눔 = 그 점 바닥)
  const hemi = new THREE.HemisphereLight(BATTLE.sky, BATTLE.ground, BATTLE.hemi);
  const sun = new THREE.DirectionalLight(BATTLE.sun, BATTLE.sunI);
  sun.position.set(...BATTLE.sunDir);
  sun.castShadow = true;
  sun.shadow.mapSize.set(BATTLE.shadowMap, BATTLE.shadowMap);
  const box = BATTLE.shadowBox;
  Object.assign(sun.shadow.camera, { left: -box, right: box, top: box, bottom: -box, near: BATTLE.shadowNear, far: BATTLE.shadowFar });
  // 발밑 그림자 받이: 보이지 않는 바닥 — 그림자 자리만 카드 바탕을 VIEW.shadow 만큼 어둡게. 몸은 싸움처럼 그림자를 드리우기만 한다(받지 않음)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2 * box, 2 * box), new THREE.ShadowMaterial({ opacity: VIEW.shadow, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(hemi, sun, sun.target, floor);
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 30); // 화각은 몸 키를 알면 다시 (frameBody)
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // 바탕만 투명(카드가 비침) — 나머지는 싸움 그리개와 같게
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  renderer.setPixelRatio(ratio); renderer.setClearColor(0, 0);
  container.dataset.ratio = String(ratio);
  renderer.outputColorSpace = THREE.SRGBColorSpace; // 톤 매핑 없음(기본값) — 싸움 그리개와 같다
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // 돌릴 때는 몸 · 해가 제자리라 그림자 지도를 다시 그리지 않는다 — 몸 · 장착이 바뀔 때만 (shade)
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const events = new AbortController();
  container.dataset.turning = 'false';
  const listen = (type, fn) => container.addEventListener(type, fn, { signal: events.signal });
  // 카메라 자리: 싸움 카메라가 내 무게중심을 보는 수평 거리 √(back² + shoulder²) = 3.04 m · 높이 height 2.3 m (config CAMERA — 서 있을 때)를 축 둘레 angle 에.
  //  angle 0 = 정면(몸이 보는 +x 쪽) · 늘면 몸이 화면 오른쪽으로 도는 것처럼 보인다(전: 몸을 돌림 — 보이는 방향은 같다). 싸움의 어깨 너머 자리 = angle 약 163°
  const D = Math.hypot(CAMERA.back, CAMERA.shoulder), HC = CAMERA.height;
  let frames = 0, angle = 0, tilt = null; // tilt = { pitch, fov } — 몸 키로 한 번 (frameBody)
  const shade = () => { renderer.shadowMap.needsUpdate = true; };
  const render = () => {
    container.dataset.angle = String(Math.round(THREE.MathUtils.radToDeg(angle)));
    if (tilt) { camera.position.set(D * Math.cos(angle), HC, D * Math.sin(angle)); camera.lookAt(0, HC - D * Math.tan(tilt.pitch), 0); }
    renderer.render(scene, camera);
    container.dataset.calls = String(renderer.info.render.calls);
    container.dataset.frames = String(++frames);
  };
  /** 틀을 한 번 정한다: 몸 키 = 발바닥 ~ 세운 뼈대 머리 꼭대기(fighter.js 부위 자리 — 무기 · 투구 · 자세 · 각과 무관, 모든 겉모습이 같다) */
  function frameBody(f) {
    const stand = f.localPos.head.y + f.headR;
    tilt = aim(D - VIEW.footR, D, HC, stand, VIEW.feet, VIEW.fill);
    camera.fov = tilt.fov; camera.updateProjectionMatrix();
    container.dataset.fov = tilt.fov.toFixed(1);
  }

  // ── 몸: current = 보이는 것 { rig, group, key, placed } · pending = 자세를 잡는 중인 것 ──
  let current = null, pending = null, armor = 'kettle', settleRaf = 0, gone = false;
  const applyArmor = () => { const h = current?.rig.fighter.helmetGroup; if (h) h.visible = armor === 'kettle'; };
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return false;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix(); // 세로 화각 그대로 — 칸 폭은 보이는 가로만 바꾼다 (칼끝이 옆으로 뻗으면 칸 끝에서 잘린다)
    return true;
  };
  // 이 미리보기에서 세운 몸은 내려 둔다(live — 장착을 오가도 몸을 다시 만들지 않음 · 열쇠 poseKey · 넷까지, 넘치면 오래된 것부터 풂)
  const live = new Map();
  function park(entry) {
    model.remove(entry.group);
    if (entry.key == null) { entry.rig.dispose(); return; } // 처음 맨손 모습(자리 지킴)은 버린다
    live.delete(entry.key); live.set(entry.key, entry);
    while (live.size > 4) { const [k, e] = live.entries().next().value; live.delete(k); e.rig.dispose(); }
  }
  function present(next) {
    if (current && current !== next) park(current);
    live.delete(next.key);
    current = next;
    if (!next.placed) { const p = next.rig.pelvis(); next.group.position.set(-p.x, 0, -p.z); next.placed = true; } // 돌림판 축 = 골반
    model.add(next.group);
    if (!tilt) frameBody(next.rig.fighter);
    applyArmor(); shade(); render();
  }
  /** 무기 id(없으면 맨손)의 몸을 세운다 — 자세를 잡을 동안은 지난 모습 그대로, 잡으면 바꿔 끼운다. 몸을 못 만들면 던진다(지난 모습 그대로) */
  function build(id) {
    const spec = game.lobbyRigSpec(id ?? null), k = poseKey(spec);
    const parked = live.get(k);
    if (parked || current?.key === k) { // 이미 세운 몸 — 그대로 다시 보인다 (자세를 잡는 중이던 다른 몸은 버림)
      if (pending) { pending.rig.dispose(); pending = null; }
      if (settleRaf) cancelAnimationFrame(settleRaf), settleRaf = 0;
      if (parked) present(parked);
      container.dataset.rig = 'ready';
      return;
    }
    const group = new THREE.Group(), rig = createLobbyRig(spec.RAPIER, group, spec);
    if (pending) pending.rig.dispose();
    if (settleRaf) cancelAnimationFrame(settleRaf), settleRaf = 0;
    pending = null;
    const done = () => {
      if (rig.armed && !poses.has(k)) poses.set(k, rig.snapshot());
      present({ rig, group, key: k });
      container.dataset.rig = 'ready';
    };
    if (rig.settled || (poses.has(k) && rig.restore(poses.get(k)))) return done();
    pending = { rig, key: k };
    container.dataset.rig = 'settling';
    if (!current) { const g = new THREE.Group(); present({ rig: createLobbyRig(spec.RAPIER, g, { ...spec, weapon: null }), group: g, key: null }); } // 처음: 자세를 잡는 동안 맨손 모습
    const run = () => {
      settleRaf = 0;
      if (gone || pending?.rig !== rig) return;
      if (rig.settle()) { pending = null; done(); } else settleRaf = requestAnimationFrame(run);
    };
    run();
  }

  // ── 돌림판: angle = 지금 각 · spin = 관성 빠르기(라디안/초) · goal = 방향키가 가는 각 · 그리기는 tick 한 곳 (화면 한 장에 한 번) ──
  let drag = null, spin = 0, goal = null, raf = 0, last = 0, dirty = false;
  const now = () => performance.now() / 1000;
  const turning = () => !!drag || spin !== 0 || goal != null;
  const tick = () => {
    raf = 0;
    const t = now(), dt = Math.min(0.05, last ? t - last : 0); last = t;
    if (!drag && spin) {
      angle += spin * dt; spin *= Math.exp(-dt / TURN.tau); dirty = true;
      if (Math.abs(spin) < TURN.stop) spin = 0;
    }
    if (!drag && goal != null) {
      const d = goal - angle, k = 1 - Math.exp(-TURN.ease * dt);
      angle = Math.abs(d) < 1e-3 ? goal : angle + d * k; dirty = true;
      if (angle === goal) goal = null;
    }
    if (dirty) { dirty = false; render(); }
    container.dataset.turning = String(turning());
    if (turning()) raf = requestAnimationFrame(tick); else last = 0;
  };
  const wake = () => { container.dataset.turning = String(turning() || dirty); if (!raf) raf = requestAnimationFrame(tick); };
  listen('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    drag = { id: e.pointerId, x: e.clientX, samples: [[now(), angle]] }; spin = 0; goal = null;
    container.setPointerCapture(e.pointerId); container.focus({ preventScroll: true }); wake();
  });
  listen('pointermove', e => {
    if (drag?.id !== e.pointerId) return;
    angle += (e.clientX - drag.x) / Math.max(1, container.clientWidth) * Math.PI * 2; // 칸 너비 = 한 바퀴 — 막는 각 없음
    drag.x = e.clientX; dirty = true;
    const t = now(); drag.samples.push([t, angle]);
    while (drag.samples.length > 2 && t - drag.samples[0][0] > TURN.window) drag.samples.shift();
    wake();
  });
  const release = e => {
    if (drag?.id !== e.pointerId) return;
    const t = now(), s = drag.samples, [t0, a0] = s[0], [t1, a1] = s[s.length - 1];
    // 놓을 때 손가락이 움직이고 있었으면 그 빠르기로 (마지막 window 초) — 멈췄다 놓으면(still 초 넘게) 그 자리에 선다
    spin = t - t1 <= TURN.still && t1 - t0 > 1e-3 ? THREE.MathUtils.clamp((a1 - a0) / (t1 - t0), -TURN.max, TURN.max) : 0;
    if (Math.abs(spin) < TURN.stop) spin = 0;
    drag = null; wake();
  };
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(type, release);
  listen('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    spin = 0;
    const from = goal ?? angle;
    goal = e.key === 'Home' ? Math.round(angle / (Math.PI * 2)) * Math.PI * 2 : from + (e.key === 'ArrowLeft' ? -1 : 1) * TURN.step; // Home = 가까운 쪽으로 정면
    wake();
  });
  const observer = new ResizeObserver(() => { if (resize()) render(); }); observer.observe(container); resize();
  let weaponId = null;
  const api = { setWeapon(id) {
    build(id); // 몸을 못 만들면 여기서 던진다 — 지난 모습 · 장착 표시 그대로 (lobby.js equip 가 알림)
    weaponId = id || null;
    container.dataset.equipped = id || '';
    container.setAttribute('aria-label', `캐릭터 360도 보기. ${id ? getWeapon(id).nameKo + ' 장착.' : '맨손.'} 드래그 또는 좌우 방향키로 회전, Home으로 정면`);
  }, setArmor(id) {
    armor = id === 'kettle' ? 'kettle' : null;
    applyArmor(); shade(); // 투구를 쓰고 벗으면 그림자도
    container.dataset.armor = id || '';
    if (current) render();
  }, turnTo(deg) { // 시험·사진 도구: 돌림판을 그 각(도)에 바로 세우고 한 번 그린다 (관성 · 방향키 움직임은 멈춤)
    spin = 0; goal = null; angle = THREE.MathUtils.degToRad(deg);
    render();
  }, refresh() {
    // 스킬북을 사거나 봉인하면 보법(걸음 자세)이 바뀔 수 있다 — 같은 몸 값이면 아무것도 안 한다
    const k = poseKey(game.lobbyRigSpec(weaponId));
    if (k !== (pending?.key ?? current?.key)) build(weaponId);
  }, dispose() {
    gone = true;
    if (raf) cancelAnimationFrame(raf);
    if (settleRaf) cancelAnimationFrame(settleRaf);
    pending?.rig.dispose(); current?.rig.dispose(); for (const e of live.values()) e.rig.dispose(); live.clear(); pending = current = null;
    floor.geometry.dispose(); floor.material.dispose(); sun.shadow.dispose(); // 그림자 받이 바닥 · 그림자 지도는 이 미리보기 것 — 그리개보다 먼저 푼다
    observer.disconnect(); events.abort(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    // geometry/material은 게임과 공유하는 것이 있어 dispose하지 않는다 (이 그리개의 GL 자원은 위 문맥과 함께 사라진다).
    scene.clear();
    delete container.lobbyPreview;
  } };
  Object.defineProperty(api, 'fighter', { get: () => current?.rig.fighter ?? null }); // 시험 도구: 보이는 몸 (판의 플레이어와 자세 맞대기 — ui_fix_smoke)
  container.lobbyPreview = api; // 시험·사진 도구: 아무 무기나 걸어 본다 (tools/browser/uifix_weapon_capture.mjs)
  return api;
}
