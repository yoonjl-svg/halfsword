// ─────────────────────────────────────────────────────────────
//  무기 겉모습 견줌 그림 (10/25 파펜하이머 들임 — docs/import/pappenheimer_import_2026-10-25.md):
//  weapons.js 의 무기 모델을 fighter.js · weapon_thumbs_page.js 와 같은 순서로 조립해(buildParts → partMesh → decorate) 찍는다.
//   ?mode=hilt&ids=pappenheimer      코등이 가까이 (원근 · 3/4 · 칼날 위로) — 한 장에 무기 하나
//   ?mode=lineup&ids=rapier,dartagnan,pappenheimer&ppm=190
//                                    게임 크기 견줌: 칼을 세워 나란히 · 1 m = ppm 화소(폰 가로 844 × 390 · 화면 배율 2 에서 내 인물 자리 ≈ 190 · 상대 자리 ≈ 75)
//                                    · 그 작은 그림을 화소 그대로 키운 판(?zoom=3)을 함께 낸다
//  배경은 붉은 회랑 바닥 빛(#b3a593 — 게임 화면에서 뽑은 색), 빛은 무기 카드 그림과 같은 하늘 · 해 · 뒷빛(윤 빛 없음).
//   ?alt=<모듈>&altId=<id> = 그 무기 겉모습(partMesh)을 다른 모듈 것으로 바꿔 찍음 (고치기 전 그림)
//  결과는 window.look = { done, list: [{ name, url, w, h }] } — tools/browser/pappenheimer_shots.mjs 가 읽는다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { WEAPONS, weaponMatOpts } from '../../src/weapons.js';
import { LOOKS } from '../../src/looks.js';

const params = new URLSearchParams(location.search);
const mode = params.get('mode') || 'hilt';
const ids = (params.get('ids') || 'pappenheimer').split(',');
const BG = params.get('bg') || '#b3a593';
// ?alt=<모듈 경로>&altId=pappenheimer : 그 모듈의 '…PartMesh' 함수를 그 무기 겉모습으로 끼워 찍음 (들여온 겉모습을 고치기 전 · 후 견줌 — 판 값은 그대로)
if (params.get('alt')) {
  const m = await import(/* @vite-ignore */ params.get('alt'));
  const fn = Object.values(m).find((v) => typeof v === 'function' && /PartMesh$/.test(v.name));
  WEAPONS[params.get('altId') || 'pappenheimer'].partMesh = fn;
}

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(new THREE.Color(BG), 1);

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xe3e6e8, 0x716c63, 1.3));
const key = new THREE.DirectionalLight(0xffe7cb, 1.8);
key.position.set(-2, 4, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0xc8d4e0, 0.6);
rim.position.set(3, -1, -2);
scene.add(rim);

function shapeMesh(s, color, matOpts) {
  let geo;
  if (s[0] === 'box') geo = new THREE.BoxGeometry(s[1] * 2, s[2] * 2, s[3] * 2);
  else if (s[0] === 'ball') geo = new THREE.SphereGeometry(s[1], 16, 12);
  else geo = new THREE.CapsuleGeometry(s[2], s[1] * 2, 4, 10);
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...(matOpts || {}) }));
}
function buildWeapon(spec, look) {
  const group = new THREE.Group();
  const finish = spec.finishTier ?? spec.tier;
  spec.buildParts(look).forEach(([shape, y, , color, isBlade], pi) => {
    const opts = weaponMatOpts(spec.material, isBlade, finish);
    const mesh = spec.partMesh?.(pi, isBlade, shape, color ?? 0x888888, opts, look, finish) ?? shapeMesh(shape, color ?? 0x888888, opts);
    mesh.position.y = y;
    mesh.visible = color != null;
    group.add(mesh);
  });
  spec.decorate?.(group, look);
  return group;
}
const shot = (name) => {
  const c = renderer.domElement;
  return { name, url: c.toDataURL('image/png'), w: c.width, h: c.height };
};

const list = [];
if (mode === 'hilt') {
  // 코등이 가까이: 칼날을 위로 · 방호판 면이 보이게 3/4(y 축 35°) · 조금 위에서
  renderer.setSize(1000, 1100);
  for (const id of ids) {
    const spec = WEAPONS[id];
    const w = buildWeapon(spec, LOOKS.player);
    w.rotation.set(0.12, +(params.get('ry') ?? 0.62), 0);
    scene.add(w);
    const cam = new THREE.PerspectiveCamera(30, 1000 / 1100, 0.01, 10);
    const at = new THREE.Vector3(0, +(params.get('cy') ?? 0.06), 0);
    cam.position.set(0, at.y + 0.05, +(params.get('dist') ?? 0.62));
    cam.lookAt(at);
    renderer.render(scene, cam);
    list.push(shot(`hilt_${id}`));
    scene.remove(w);
  }
} else {
  // 게임 크기 견줌: 무기를 세워(칼날 위) 손 자리를 한 줄에 · 칼날 축 30° 돌림(날 면과 두께가 함께) · 정사영 1 m = ppm 화소
  const ppm = +(params.get('ppm') ?? 190);
  const gap = 0.32; // 무기 사이 (m)
  const W = Math.round((ids.length * gap + 0.12) * ppm), H = Math.round(1.32 * ppm);
  renderer.setSize(W, H);
  const holders = ids.map((id, k) => {
    const w = buildWeapon(WEAPONS[id], LOOKS.player);
    w.rotation.set(0, 0.52, 0);
    w.position.set((k - (ids.length - 1) / 2) * gap, 0, 0);
    scene.add(w);
    return w;
  });
  const hw = W / ppm / 2, hh = H / ppm / 2, cy = 0.44;
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.01, 20);
  cam.position.set(0, cy, 5);
  cam.lookAt(0, cy, 0);
  renderer.render(scene, cam);
  list.push(shot(`lineup_${ppm}`));
  for (const h of holders) scene.remove(h);
}
window.look = { done: true, list };
