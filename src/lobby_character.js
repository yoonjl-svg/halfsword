import * as THREE from 'three';
import { getWeapon } from './weapons.js';
import { createLobbyRig } from './lobby_rig.js';

// 돌림판 값 (사장님 확인 전 — 확인표 1933): 놓을 때 빠르기는 마지막 0.1 s 손가락 움직임 · 그 뒤 0.08 s 넘게 멈췄다 놓으면 관성 없음 ·
//  관성은 tau 초 시정수로 줄어 stop 아래면 선다 — 더 도는 각 = 빠르기 × tau(반 바퀴/s 로 튕기면 약 36° · 상한 max = 한 바퀴/s 면 72°) · 방향키 한 번 = step
export const TURN = Object.freeze({ window: 0.1, still: 0.08, tau: 0.2, stop: 0.1, max: 2 * Math.PI, step: Math.PI / 8, ease: 14 });

// 대기실 첫 칸의 캐릭터 미리보기 (샛별 저장소 817db21c · b73a9c82 · 3b280a1b 에서 들여옴). 따로 된 WebGL 그리개 하나 — 돌리거나 크기·장착이 바뀔 때만 그린다.
// 10/16 (사장님 03:5x '캐릭터쪽 해상도 너무 낮던데. 좋아지게 할 방법은 없어?' — docs/import/lobby_fix_2026-10-16.md §5): 화소 비 1 → 기기 화소 비(min(devicePixelRatio, 3)) + 계단 펴기(MSAA).
//  data-calls · data-ratio = 시험 도구가 읽는 값
// 10/16 08:3x (사장님 ''드래그하여 회전' 문구 지우고 360도 회전은 안되나? 스테이지에서 보는 것처럼' — docs/import/ui_fix_2026-10-16.md §5): 돌림판(턴테이블).
//  끄는 동안은 손가락 그대로(칸 너비 = 한 바퀴 · 막는 각 없음 — 몇 바퀴든) · 놓을 때 손가락이 움직이고 있었으면 그 빠르기로 조금 더 돌다 선다(관성 TURN) ·
//  그리기는 화면 한 장에 한 번(requestAnimationFrame 으로 모음) · 멈추면 그리지 않는다. 좌우 방향키 22.5° · Home 정면도 부드럽게 돌아간다. 돌림판 축 = 골반.
//  data-angle(도 — 돌린 만큼 그대로, 360 을 넘을 수 있다) · data-turning(돌고 있나) · data-frames(그린 수) = 시험 도구가 읽는 값
// 10/16 08:4x (사장님 '무기 장착도 정교해져야 돼. 지금 나뭇가지 장착해보면 전투 때 모습과 달라.' — 같은 문서 §6): 몸 = lobby_rig.js — 싸움과 같은 Fighter 를 따로 된 작은 물리 세계에
//  세워 판에서 가만히 선 자세(그 무기의 쥠 · 겨눔 · 주먹 · 두손 빈손)까지 돌린 것. 전에는 메뉴 뒤 판 플레이어의 겉모습을 복제해 칼팔을 내리고 무기 모형을 손에 고정 각으로 붙였다.
//  자세 잡기는 장착을 바꿀 때만(화면 한 장에 몇 ms 씩 나눠) · 그동안 지난 모습을 둔다 · 세운 몸은 대기실을 닫을 때까지 내려 둠(장착을 오가도 다시 안 만듦) ·
//  잡은 자세는 이번 실행 동안 기억(같은 무기·책이면 대기실을 다시 열어도 물리 없이 바로).
//  data-rig = 'settling' | 'ready' · data-equipped · data-armor = 시험 도구가 읽는 값. 시험·사진 도구는 container.lobbyPreview(아래 돌려주는 것)로 아무 무기나 걸어 본다
const poses = new Map(); // 잡은 자세 — 이번 실행 동안 (열쇠 poseKey)
const poseKey = (s) => JSON.stringify([s.weapon, s.schoolFootwork ?? null, s.schoolParry ?? null, s.skill?.level ?? null, s.skill?.corr ?? null]);
// 틀 맞춤 (사장님 확인 전 — 확인표 1936): 인물 축척 = SCALE_HEIGHT(m)가 칸에 들어오게(세운 롱소드까지 — 샛별 쪽 값 그대로 · 무기가 더 높으면 그 높이) ·
//  돌려서 칼이 옆으로 뻗으면 보이는 폭에 맞춰 화면 가운데를 옮기고(가로) 조금 물러난다 — 많아야 ZOOM_OUT 배(그 너머 칼끝은 칸 밖) · 발밑은 칸 높이의 FEET 몫
const SCALE_HEIGHT = 2.16, ZOOM_OUT = 1.6, FEET = 0.08, SIDE_MARGIN = 0.06;
const _box = new THREE.Box3(), _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();

/** game: main.js — lobbyRigSpec(무기 id) 로 다음 판 플레이어와 같은 몸 값을 준다 */
export function createLobbyCharacter(container, game) {
  const scene = new THREE.Scene(), model = new THREE.Group();
  scene.add(model);
  const hemi = new THREE.HemisphereLight(0xfff2d7, 0x493827, 2.4);
  const key = new THREE.DirectionalLight(0xffe5bc, 3.0); key.position.set(4, 5, 3);
  const rim = new THREE.DirectionalLight(0xf3e9d8, 1.5); rim.position.set(-3, 3, -4);
  scene.add(hemi, key, rim);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  renderer.setPixelRatio(ratio); renderer.setClearColor(0, 0);
  container.dataset.ratio = String(ratio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const events = new AbortController();
  container.dataset.turning = 'false';
  const listen = (type, fn) => container.addEventListener(type, fn, { signal: events.signal });
  let frames = 0;
  const render = () => {
    container.dataset.angle = String(Math.round(THREE.MathUtils.radToDeg(model.rotation.y)));
    fit(); // 돌린 각마다 틀 (점 수백 개 — 그릴 때만)
    renderer.render(scene, camera);
    container.dataset.calls = String(renderer.info.render.calls);
    container.dataset.frames = String(++frames);
  };

  // ── 몸: current = 보이는 것 { rig, group, height } · pending = 자세를 잡는 중인 것 ──
  let current = null, pending = null, armor = 'kettle', settleRaf = 0, gone = false;
  // 보이는 메쉬의 상자 (돌림판 틀 — 골반이 축) → 높이 · 바닥 모서리 점들(x, z) — 몸 · 무기 따로: 돌린 각마다 화면 가로 폭을 셈 (fit)
  function measure(next) {
    model.updateMatrixWorld(true); _inv.copy(model.matrixWorld).invert();
    const weapon = new Set();
    next.rig.fighter.swordGroup?.traverse((o) => weapon.add(o));
    let top = 0;
    const body = [], gear = [];
    next.group.traverseVisible((o) => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      _box.copy(o.geometry.boundingBox).applyMatrix4(_m.multiplyMatrices(_inv, o.matrixWorld));
      top = Math.max(top, _box.max.y);
      (weapon.has(o) ? gear : body).push(_box.min.x, _box.min.z, _box.max.x, _box.min.z, _box.min.x, _box.max.z, _box.max.x, _box.max.z);
    });
    next.height = top; next.points = new Float32Array(body); next.gear = new Float32Array(gear);
  }
  const applyArmor = () => { const h = current?.rig.fighter.helmetGroup; if (h) h.visible = armor === 'kettle'; };
  let aspect = 1;
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return false;
    renderer.setSize(w, h, false); aspect = w / h;
    return true;
  };
  // 틀: 카메라는 +x 에서 수평으로 본다(화면 오른쪽 = −z). 돌린 각 θ 에서 점 (x, z) 의 화면 가로 = sinθ·x − cosθ·z
  const fit = () => {
    const display = Math.max(current?.height ?? 0, SCALE_HEIGHT), base = display * .55;
    const sn = Math.sin(model.rotation.y), cs = Math.cos(model.rotation.y);
    const span = (P, r) => { for (let i = 0; i < P.length; i += 2) { const x = sn * P[i] - cs * P[i + 1]; if (x < r[0]) r[0] = x; if (x > r[1]) r[1] = x; } return r; };
    const b = current?.points?.length ? span(current.points, [Infinity, -Infinity]) : [-.3, .3]; // 몸
    const all = current?.gear?.length ? span(current.gear, [b[0], b[1]]) : b; // 몸 + 무기
    const half = Math.min(base * ZOOM_OUT, Math.max(base, ((all[1] - all[0]) / 2 + SIDE_MARGIN) / aspect, .62 / aspect)); // 기본 축척 — 칼이 옆으로 뻗으면 그 폭까지 물러남(상한 ZOOM_OUT)
    // 화면 가운데 = 보이는 폭 가운데 — 다 못 담으면 몸은 늘 칸 안에 두고 칼끝 쪽을 자른다
    const hw = half * aspect, lo = b[1] + SIDE_MARGIN - hw, hi = b[0] - SIDE_MARGIN + hw;
    const cx = lo <= hi ? THREE.MathUtils.clamp((all[0] + all[1]) / 2, lo, hi) : (b[0] + b[1]) / 2;
    const cy = half * (1 - 2 * FEET); // 발밑에 칸 높이의 FEET 몫 (아래 틀 장식에 발이 안 가리게)
    camera.position.set(5, 0, 0); camera.lookAt(0, 0, 0);
    camera.left = cx - half * aspect; camera.right = cx + half * aspect;
    camera.top = cy + half; camera.bottom = cy - half; camera.updateProjectionMatrix();
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
    if (!next.points) { const p = next.rig.pelvis(); next.group.position.set(-p.x, 0, -p.z); } // 돌림판 축 = 골반
    model.add(next.group);
    if (!next.points) measure(next);
    applyArmor(); render();
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
      model.rotation.y += spin * dt; spin *= Math.exp(-dt / TURN.tau); dirty = true;
      if (Math.abs(spin) < TURN.stop) spin = 0;
    }
    if (!drag && goal != null) {
      const d = goal - model.rotation.y, k = 1 - Math.exp(-TURN.ease * dt);
      model.rotation.y = Math.abs(d) < 1e-3 ? goal : model.rotation.y + d * k; dirty = true;
      if (model.rotation.y === goal) goal = null;
    }
    if (dirty) { dirty = false; render(); }
    container.dataset.turning = String(turning());
    if (turning()) raf = requestAnimationFrame(tick); else last = 0;
  };
  const wake = () => { container.dataset.turning = String(turning() || dirty); if (!raf) raf = requestAnimationFrame(tick); };
  listen('pointerdown', e => {
    if (e.button !== 0 || drag) return;
    drag = { id: e.pointerId, x: e.clientX, samples: [[now(), model.rotation.y]] }; spin = 0; goal = null;
    container.setPointerCapture(e.pointerId); container.focus({ preventScroll: true }); wake();
  });
  listen('pointermove', e => {
    if (drag?.id !== e.pointerId) return;
    model.rotation.y += (e.clientX - drag.x) / Math.max(1, container.clientWidth) * Math.PI * 2; // 칸 너비 = 한 바퀴 — 막는 각 없음
    drag.x = e.clientX; dirty = true;
    const t = now(); drag.samples.push([t, model.rotation.y]);
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
    const from = goal ?? model.rotation.y;
    goal = e.key === 'Home' ? Math.round(model.rotation.y / (Math.PI * 2)) * Math.PI * 2 : from + (e.key === 'ArrowLeft' ? -1 : 1) * TURN.step; // Home = 가까운 쪽으로 정면
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
    applyArmor();
    container.dataset.armor = id || '';
    if (current) render();
  }, refresh() {
    // 스킬북을 사거나 봉인하면 보법(걸음 자세)이 바뀔 수 있다 — 같은 몸 값이면 아무것도 안 한다
    const k = poseKey(game.lobbyRigSpec(weaponId));
    if (k !== (pending?.key ?? current?.key)) build(weaponId);
  }, dispose() {
    gone = true;
    if (raf) cancelAnimationFrame(raf);
    if (settleRaf) cancelAnimationFrame(settleRaf);
    pending?.rig.dispose(); current?.rig.dispose(); for (const e of live.values()) e.rig.dispose(); live.clear(); pending = current = null;
    observer.disconnect(); events.abort(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    // geometry/material은 게임과 공유하는 것이 있어 dispose하지 않는다 (이 그리개의 GL 자원은 위 문맥과 함께 사라진다).
    scene.clear();
    delete container.lobbyPreview;
  } };
  Object.defineProperty(api, 'fighter', { get: () => current?.rig.fighter ?? null }); // 시험 도구: 보이는 몸 (판의 플레이어와 자세 맞대기 — ui_fix_smoke)
  container.lobbyPreview = api; // 시험·사진 도구: 아무 무기나 걸어 본다 (tools/browser/uifix_weapon_capture.mjs)
  return api;
}
