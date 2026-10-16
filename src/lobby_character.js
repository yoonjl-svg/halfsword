import * as THREE from 'three';
import { buildLobbyWeapon, disposeLobbyWeapon } from './lobby_weapon.js';
import { getWeapon } from './weapons.js';

// 돌림판 값 (사장님 확인 전 — 확인표 1933): 놓을 때 빠르기는 마지막 0.1 s 손가락 움직임 · 그 뒤 0.08 s 넘게 멈췄다 놓으면 관성 없음 ·
//  관성은 tau 초 시정수로 줄어 stop 아래면 선다 — 더 도는 각 = 빠르기 × tau(반 바퀴/s 로 튕기면 약 36° · 상한 max = 한 바퀴/s 면 72°) · 방향키 한 번 = step
export const TURN = Object.freeze({ window: 0.1, still: 0.08, tau: 0.2, stop: 0.1, max: 2 * Math.PI, step: Math.PI / 8, ease: 14 });

// 대기실 첫 칸의 캐릭터 미리보기 (샛별 저장소 817db21c · b73a9c82 · 3b280a1b): 메뉴 뒤에 세워 둔 실제 플레이어(Fighter)의 겉모습만 복제한다.
// 전투의 몸·관절·자세·공유 자원은 변경하지 않는다. 따로 된 WebGL 그리개 하나 — 돌리거나 크기·장착이 바뀔 때만 그린다.
// 10/16 (사장님 03:5x '캐릭터쪽 해상도 너무 낮던데. 좋아지게 할 방법은 없어?' — docs/import/lobby_fix_2026-10-16.md §5): 화소 비 1 → 기기 화소 비(min(devicePixelRatio, 3)) + 계단 펴기(MSAA).
//  그리는 때는 그대로(돌리거나 크기·장착이 바뀔 때만) — 그리기 호출 수는 같고 한 번 그릴 때 칠하는 화소만 는다. data-calls · data-ratio = 시험 도구가 읽는 값
// 10/16 08:3x (사장님 ''드래그하여 회전' 문구 지우고 360도 회전은 안되나? 스테이지에서 보는 것처럼' — docs/import/ui_fix_2026-10-16.md §5): 돌림판(턴테이블).
//  끄는 동안은 손가락 그대로(칸 너비 = 한 바퀴 · 막는 각 없음 — 몇 바퀴든) · 놓을 때 손가락이 움직이고 있었으면 그 빠르기로 조금 더 돌다 선다(관성 TURN) ·
//  그리기는 화면 한 장에 한 번(requestAnimationFrame 으로 모음) · 멈추면 그리지 않는다. 좌우 방향키 22.5° · Home 정면도 부드럽게 돌아간다.
//  data-angle(도 — 돌린 만큼 그대로, 360 을 넘을 수 있다) · data-turning(돌고 있나) · data-frames(그린 수) = 시험 도구가 읽는 값
export function createLobbyCharacter(container, fighter) {
  const scene = new THREE.Scene(), model = new THREE.Group();
  let swordArm = null, weapon = null, helmet = null;
  scene.add(model);
  for (const { rb, group, kind } of fighter.meshes) {
    if (kind === 'loose' || kind === 'weapon') continue;
    const copy = group.clone(true), p = rb.translation(), q = rb.rotation();
    if (group === fighter.groups.head) {
      const index = group.children.indexOf(fighter.helmetGroup);
      if (index >= 0) helmet = copy.children[index];
    }
    copy.position.set(p.x, p.y, p.z); copy.quaternion.set(q.x, q.y, q.z, q.w);
    // 로비에서는 빈손을 내린다. 복제한 칼팔 두 조각만 어깨에서 함께 회전한다.
    if (group === fighter.groups.uarmS || group === fighter.groups.farmS) {
      const pelvis = fighter.bodies.pelvis, pr = pelvis.rotation(), pt = pelvis.translation();
      const facing = new THREE.Quaternion(pr.x, pr.y, pr.z, pr.w);
      const shoulder = fighter.localPos.uarmS.clone(); shoulder.x = 0;
      shoulder.sub(fighter.localPos.pelvis).applyQuaternion(facing).add(new THREE.Vector3(pt.x, pt.y, pt.z));
      const drop = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1).applyQuaternion(facing), -Math.PI / 2);
      copy.position.sub(shoulder).applyQuaternion(drop).add(shoulder); copy.quaternion.premultiply(drop);
    }
    if (group === fighter.groups.farmS) copy.traverse(part => {
      // 칼에 붙은 주먹은 복제하지 않으므로 원래 손 메시를 다시 보인다.
      if (part.isMesh && part.geometry.type === 'SphereGeometry' && Math.abs((part.geometry.parameters.radius ?? 0) - .042) < .002 && part.position.y < -.1) part.visible = true;
    });
    copy.visible = true; model.add(copy);
    if (group === fighter.groups.farmS) swordArm = copy;
  }
  const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3());
  for (const part of model.children) part.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  const height = bounds.max.y - bounds.min.y;
  const hemi = new THREE.HemisphereLight(0xfff2d7, 0x493827, 2.4);
  const key = new THREE.DirectionalLight(0xffe5bc, 3.0); key.position.set(4, 5, 3);
  const rim = new THREE.DirectionalLight(0xf3e9d8, 1.5); rim.position.set(-3, 3, -4);
  scene.add(hemi, key, rim);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 30);
  // 세운 롱소드까지 들어오는 축척(샛별 쪽 값 그대로 — 무기 칸에서 롱소드는 뺐지만 인물 크기를 같게 둔다). 장착/해제 때 인물 크기는 바뀌지 않는다.
  const displayHeight = Math.max(height, 2.16);
  // 바라보는 높이 0.46 h — 발밑에 화면 높이의 8 % 남김(아래 틀 장식에 발이 안 가리게 · 10/16 회전 안내 줄을 지우며 칸이 아래로 길어짐)
  camera.position.set(5, displayHeight * .51, 0); camera.lookAt(0, displayHeight * .46, 0);
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
    renderer.render(scene, camera);
    container.dataset.calls = String(renderer.info.render.calls);
    container.dataset.frames = String(++frames);
  };
  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    const aspect = w / h, half = Math.max(displayHeight * .55, .62 / aspect);
    camera.left = -half * aspect; camera.right = half * aspect;
    camera.top = half; camera.bottom = -half; camera.updateProjectionMatrix(); render();
  };
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
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  return { setWeapon(id) {
    // 먼저 새 모델을 만들어 실패 시 기존 장착 표시를 보존한다.
    const next = id ? buildLobbyWeapon(id) : null;
    if (weapon) disposeLobbyWeapon(weapon);
    weapon = next;
    if (weapon) {
      weapon.position.copy(new THREE.Vector3(.13, 0, 0).applyQuaternion(swordArm.quaternion).add(swordArm.position));
      weapon.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), .2)
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
      model.add(weapon);
    }
    container.dataset.equipped = id || '';
    container.setAttribute('aria-label', `캐릭터 360도 보기. ${id ? getWeapon(id).nameKo + ' 장착.' : '맨손.'} 드래그 또는 좌우 방향키로 회전, Home으로 정면`);
    render();
  }, setArmor(id) {
    if (helmet) helmet.visible = id === 'kettle';
    container.dataset.armor = id || '';
    render();
  }, dispose() {
    if (raf) cancelAnimationFrame(raf);
    if (weapon) disposeLobbyWeapon(weapon);
    observer.disconnect(); events.abort(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    // geometry/material은 게임과 공유하므로 dispose하지 않는다.
    scene.clear();
  } };
}
