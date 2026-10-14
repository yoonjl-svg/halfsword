// ─────────────────────────────────────────────────────────────
//  말레이곰 석상만 따로 그리기 (잠든 습지 무대와 같은 해·반구광 색과 세기, 게임과 같은 렌더러 설정)
//   ?view=ortho   : 정면 직교 — 사진과 같은 구도(정수리~발바닥 = ph 픽셀, 발바닥 줄 sy, 몸 가운데 cx). 받침은 ?plinth=0 으로 숨김
//   ?view=front   : 정면, 약간 아래에서 긴 렌즈 (받침까지)   ?view=quarter : 앞 왼쪽 35°   ?view=side : 곰 왼쪽 옆   ?view=back
//   ?view=face    : 머리 가까이   ?view=strip : 앞 · 앞 왼쪽 · 옆 · 뒤 넷을 한 장에
//   ?view=lens    : 가까이 보기 — yaw(도, 0 = 정면 · + = 곰 왼쪽) · eye · look(카메라·볼 곳 높이, 곰 키 몫 — 0 = 발바닥) · span(틀 높이, 곰 키 몫) · fov
//   ?w=&h= 캔버스 크기 · ?bearH= 곰 키(m, 기본 BEAR_HEIGHT) · ?bg=rrggbb 바탕 · ?ground=0 땅 없음
//   ?albedo=1 : 빛 없이 꼭짓점 색만 (두 톤 무늬 경계를 빛·그늘에 흔들리지 않게 잴 때 — 곰 2b)
//   결과: window.shot = { done, url(webp), triangles }
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildSluiceBear, BEAR_HEIGHT, BEAR_PLINTH } from '../../src/stage_sluice_bear.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 640;
const Hc = +q.get('h') || 800;
const height = +q.get('bearH') || BEAR_HEIGHT;
const view = q.get('view') || 'front';
const P = BEAR_PLINTH.height;

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, Hc);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(q.get('bg') ? `#${q.get('bg')}` : 0x94a58e); // 무대 하늘색
// 무대(stage_sluice.js)와 같은 빛: 반구광 0xdde7d4/0x807664 1.23 · 해 0xffedd0 1.42. 해 방향도 무대에서 곰이 받는 쪽(곰 오른쪽 앞 위)
scene.add(new THREE.HemisphereLight(0xdde7d4, 0x807664, 1.23));
const sun = new THREE.DirectionalLight(0xffedd0, 1.42);
sun.position.set(-7.2, 11, 6.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 5, bottom: -1, near: 1, far: 40 });
scene.add(sun);
if (q.get('ground') !== '0') {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5e5a45, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);
}

const { group, triangleCount } = buildSluiceBear(scene, { position: [0, 0, 0], rotationY: 0, height });
if (q.get('plinth') === '0') group.getObjectByName('sluice-sun-bear-plinth').visible = false;
if (q.get('albedo') === '1') {
  const bear = group.getObjectByName('sluice-sun-bear');
  bear.material.dispose();
  bear.material = new THREE.MeshBasicMaterial({ vertexColors: true });
}

/** 긴 렌즈 원근 카메라: 방향(dir, 수평)·눈높이·틀 높이 span 을 주면 그 틀이 꽉 차는 거리에 둔다 */
function lens(dirX, dirZ, eyeY, lookY, span, aspect, fov = 12) {
  const cam = new THREE.PerspectiveCamera(fov, aspect, 0.5, 400);
  const dist = span / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const d = new THREE.Vector3(dirX, 0, dirZ).normalize().multiplyScalar(dist);
  cam.position.set(d.x, eyeY, d.z);
  cam.lookAt(0, lookY, 0);
  return cam;
}
const total = P + height;
const VIEWS = {
  front: (a) => lens(0, 1, P + height * 0.38, total * 0.5, total * 1.12, a),
  quarter: (a) => lens(-Math.sin(0.61), Math.cos(0.61), P + height * 0.45, total * 0.5, total * 1.12, a),
  side: (a) => lens(1, 0, P + height * 0.45, total * 0.5, total * 1.12, a),
  back: (a) => lens(0.3, -1, P + height * 0.5, total * 0.5, total * 1.12, a),
  face: (a) => lens(0, 1, P + height * 0.86, P + height * 0.9, height * 0.36, a, 14),
  lens: (a) => {
    const yaw = THREE.MathUtils.degToRad(+q.get('yaw') || 0);
    return lens(Math.sin(yaw), Math.cos(yaw), P + height * +(q.get('eye') ?? 0.5), P + height * +(q.get('look') ?? 0.5), height * +(q.get('span') ?? 0.4), a, +q.get('fov') || 14);
  },
};

if (view === 'ortho') {
  const ph = +q.get('ph') || 449;
  const sy = +q.get('sy') || 492;
  const cx = +q.get('cx') || 347;
  const k = ph / height; // 픽셀 / m
  const camera = new THREE.OrthographicCamera(-cx / k, (W - cx) / k, P + sy / k, P + (sy - Hc) / k, 0.1, 100);
  camera.position.set(0, 0, 30);
  camera.lookAt(0, 0, 0);
  renderer.render(scene, camera);
} else if (view === 'strip') {
  const names = ['front', 'quarter', 'side', 'back'];
  const cw = Math.floor(W / names.length);
  renderer.setScissorTest(true);
  renderer.autoClear = true;
  names.forEach((n, i) => {
    renderer.setViewport(i * cw, 0, cw, Hc);
    renderer.setScissor(i * cw, 0, cw, Hc);
    renderer.render(scene, VIEWS[n](cw / Hc));
  });
  renderer.setScissorTest(false);
} else {
  renderer.render(scene, (VIEWS[view] || VIEWS.front)(W / Hc));
}
window.shot = { done: true, url: renderer.domElement.toDataURL('image/webp', +q.get('qual') || 0.9), triangles: triangleCount };
