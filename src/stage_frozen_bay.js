// 얼어붙은 만 (`frozen_bay`) — 투야나 니콜라예바(id eira, 전 이름 에이라 린드)의 무대. 샛별 저장소에서 가져옴(b17a3c3, 기준 5a4e96c).
//  우리 쪽에서 더한 것(무대 리뷰 10/10 — 폰 화면에서 남색 사제복이 먹청색 얼음에 묻히고 결투장 경계가 없었다): duelGround() —
//  눈을 쓸어 둔 밝은 회청 결투 자리 + 쓸어 모은 눈 둑 고리(경계) + 앞 바닥의 납작한 눈 무더기·얼어붙은 갈대 + 선착장 등불 + 바닥을 스치는 가루눈.
//  샛별 기록 이름은 '새벽의 얼음만'. 화면 이름은 사장님 말(10/10 20:4x)대로 '얼어붙은 만'. 물가는 stage_frozen_bay_shore.js, 소리는 stage_detail_sound.js·sound.js.
//  싸우는 바닥·물리는 그대로(장식만). 그림자: 물가 나무(wood)만 드리운다. docs/stages.md '얼어붙은 만'
// East-Siberian inland lake, winter predawn. Visual ice only: no physics changes.
import * as THREE from 'three';
import { Kit, canvasTex, rng, box } from './stage_kit.js';
import { buildFrozenBayShore } from './stage_frozen_bay_shore.js';

function iceTexture() {
  const r = rng(101071);
  const tex = canvasTex(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#325568'; ctx.fillRect(0, 0, w, h);
    // Broad cloudy frost and stretched crystal grain; cracks are separate geometry.
    for (let i = 0; i < 145; i++) {
      const x = r() * w, y = r() * h, rad = 20 + r() * 145;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, i % 3 ? 'rgba(191,218,224,.10)' : 'rgba(5,24,39,.16)');
      grad.addColorStop(1, 'rgba(130,163,180,0)'); ctx.fillStyle = grad;
      ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let i = 0; i < 2300; i++) {
      ctx.strokeStyle = `rgba(198,224,230,${.015 + r() * .045})`;
      ctx.lineWidth = .4 + r() * 1.1; const x = r() * w, y = r() * h;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4 + r() * 40, y + 1 + r() * 7); ctx.stroke();
    }
  });
  tex.repeat.set(12, 12);
  return tex;
}

function iceDetails(scene) {
  const k = new Kit(101033), r = rng(100879);
  const ribbon = (bin, a, b, width, y, color) => {
    const dx = b[0] - a[0], dz = b[1] - a[1], d = Math.hypot(dx, dz);
    if (d < .001) return;
    const x = -dz / d * width / 2, z = dx / d * width / 2;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0]-x,y,a[1]-z, b[0]-x,y,b[1]-z, a[0]+x,y,a[1]+z,
      b[0]-x,y,b[1]-z, b[0]+x,y,b[1]+z, a[0]+x,y,a[1]+z,
    ], 3));
    g.computeVertexNormals(); k.put(bin, g, color); g.dispose();
  };
  const fracture = (x, z, angle, steps, length, width, branch = true) => {
    for (let i = 0; i < steps; i++) {
      angle += (r() - .5) * .7;
      const b = [x + Math.cos(angle) * length * (.65 + r() * .7), z + Math.sin(angle) * length * (.65 + r() * .7)];
      ribbon('crackDepth', [x+.035,z+.023], [b[0]+.035,b[1]+.023], width * 4, .004, 0x142e41);
      ribbon('crack', [x,z], b, width, .008, 0xb2cbd5);
      if (branch && i % 4 === 2) fracture(x, z, angle + (r() > .5 ? 1 : -1) * .8, 3, length * .5, width * .55, false);
      [x,z] = b;
    }
  };
  fracture(-18, -10, .62, 17, 2.1, .026);
  fracture(-16, 9, -.38, 14, 2.4, .02);
  fracture(3, -23, 1.28, 20, 2.2, .018);
  fracture(17, -16, 1.8, 16, 2.5, .027);
  // Subdued, layered circles resemble bubbles trapped beneath clear ice, not snowflakes.
  const disk = new THREE.CircleGeometry(1, 10); disk.rotateX(-Math.PI / 2);
  for (let cluster = 0; cluster < 30; cluster++) {
    const x = (r() - .5) * 36, z = (r() - .5) * 36;
    for (let n = 0; n < 4; n++) {
      const radius = .02 + r() * .065;
      k.put('bubble', disk, n % 2 ? 0x668eaa : 0x759cae,
        [x + (r()-.5)*.6, .006, z + (r()-.5)*.65], undefined, [radius, 1, radius * .85]);
    }
  }
  disk.dispose();
  for (const name of ['crackDepth', 'crack', 'bubble']) {
    const mesh = k.mesh(name, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .48, side: THREE.DoubleSide }));
    mesh.name = `frozen-bay-${name}`; scene.add(mesh);
  }
  for (const bin of Object.values(k.bins)) for (const g of bin) g.dispose();
}

/** 결투 자리 (우리 쪽에서 더함): 반지름 7.3 m 안은 얇게 남긴 눈(밝은 회청, 빗자루 결), 그 둘레에 쓸어 모은 눈 둑 고리(높이 0.3 m 안팎 — 카메라 궤도 안이라 납작하게),
 *  둑 밖 얼음엔 납작한 눈 무더기·쓸린 눈 결, 조금 먼 곳에 얼어붙은 갈대 무리. 물리는 그대로(장식만) */
function duelGround(scene) {
  const r = rng(101081);
  // ① 쓸어 둔 눈 바닥: 원판 하나, 가장자리는 투명하게 녹아 얼음으로 (질감 알파) — 투명 물체 하나
  const snowTex = canvasTex(512, 512, (g, w, h) => {
    const cx = w / 2, R = w / 2;
    const grad = g.createRadialGradient(cx, cx, 0, cx, cx, R);
    grad.addColorStop(0, 'rgba(176,193,206,1)'); grad.addColorStop(0.78, 'rgba(168,186,200,1)'); grad.addColorStop(0.9, 'rgba(150,172,190,.75)'); grad.addColorStop(1, 'rgba(120,150,172,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) { // 빗자루로 둥글게 쓴 결
      const rad = r() * R * 0.9, a0 = r() * Math.PI * 2, len = 0.15 + r() * 0.5;
      g.strokeStyle = r() < 0.5 ? `rgba(214,226,234,${0.12 + r() * 0.15})` : `rgba(110,136,158,${0.08 + r() * 0.1})`;
      g.lineWidth = 1 + r() * 2.5;
      g.beginPath(); g.arc(cx, cx, rad, a0, a0 + len); g.stroke();
    }
  });
  snowTex.wrapS = snowTex.wrapT = THREE.ClampToEdgeWrapping;
  const snow = new THREE.Mesh(new THREE.CircleGeometry(8.6, 48), new THREE.MeshStandardMaterial({ map: snowTex, transparent: true, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 }));
  snow.rotation.x = -Math.PI / 2; snow.position.y = 0.01; snow.receiveShadow = true; snow.renderOrder = 1; snow.name = 'frozen-bay-duel-snow'; scene.add(snow);
  // ② 눈 둑 고리 (+ 둑 밖 눈 무더기·갈대) — 꼭짓점 색 한 재질
  const k = new Kit(101083);
  const ring = [], N = 72;
  const bank = (a) => 7.35 + 0.18 * Math.sin(a * 5 + 1) + 0.1 * Math.sin(a * 13);
  const height = (a) => 0.2 + 0.08 * Math.sin(a * 7 + 0.4) + 0.05 * Math.sin(a * 17);
  const prof = [[-0.55, 0], [-0.22, 0.75], [0.05, 1], [0.35, 0.7], [0.75, 0]]; // 둑 단면 (안쪽 → 바깥, 높이 비)
  for (let i = 0; i < N; i++) for (let j = 0; j < prof.length - 1; j++) {
    const P = (ii, jj) => { const a = (ii / N) * Math.PI * 2, d = bank(a) + prof[jj][0]; return [Math.cos(a) * d, prof[jj][1] * height(a), Math.sin(a) * d]; };
    ring.push(...P(i, j), ...P(i, j + 1), ...P(i + 1, j), ...P(i + 1, j), ...P(i, j + 1), ...P(i + 1, j + 1));
  }
  const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3)); rg.computeVertexNormals();
  k.put('snow', rg, 0xc9d5de, undefined, undefined, 1, { vary: 0, noise: 0.05 }); rg.dispose();
  const lump = new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  for (let i = 0; i < 26; i++) { // 둑 밖 납작한 눈 무더기 (8.5~15 m)
    const a = r() * Math.PI * 2, d = 8.5 + r() * 6.5, s = 0.25 + r() * 0.45;
    k.put('snow', lump, 0xa3b5c4, [Math.cos(a) * d, -0.02, Math.sin(a) * d], [0, r() * 3, 0], [s * (1 + r()), 0.05 + r() * 0.08, s], { vary: 0.08, noise: 0.05 });
  }
  for (let i = 0; i < 40; i++) { // 바람에 쓸린 눈 결 (얇고 긴 띠)
    const a = r() * Math.PI * 2, d = 8.6 + r() * 9;
    k.put('snow', box(0.12 + r() * 0.25, 0.012, 1.2 + r() * 2.8), 0xa9bccb, [Math.cos(a) * d, 0.004, Math.sin(a) * d], [0, 0.6 + (r() - 0.5) * 0.3, 0], 1, { vary: 0.1, noise: 0 });
  }
  frozenReeds(k, r);
  lump.dispose();
  const mesh = k.mesh('snow', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { cast: false, receive: true });
  mesh.name = 'frozen-bay-duel-bank'; scene.add(mesh);
  const reeds = k.mesh('reed', new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), { cast: false, receive: true });
  if (reeds) { reeds.name = 'frozen-bay-reeds'; scene.add(reeds); }
  for (const bin of Object.values(k.bins)) for (const g of bin) g.dispose();
}
/** 얼어붙은 갈대 무리 (11~17 m, 키 0.3~0.7 m — 카메라 궤도 밖) */
function frozenReeds(k, r) {
  for (let c = 0; c < 9; c++) {
    const a = r() * Math.PI * 2, d = 11 + r() * 6, cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    for (let i = 0; i < 9; i++) {
      const x = cx + (r() - 0.5) * 1.4, z = cz + (r() - 0.5) * 1.4, h = 0.3 + r() * 0.4;
      k.put('reed', box(0.02, h, 0.02), r() < 0.5 ? 0x8b7f63 : 0x6f6852, [x, h / 2, z], [(r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5], 1, { vary: 0.15, noise: 0 });
    }
  }
}

/** 바닥을 스치는 낮은 가루눈: 점 260 개, 0~0.6 m 높이에서 바람 따라 흘러간다 (투명 물체 하나) */
function powder(scene) {
  const n = 260, r = rng(101087);
  const pos = new Float32Array(n * 3), seed = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * 30; pos[i * 3 + 1] = r() * 0.6; pos[i * 3 + 2] = (r() - 0.5) * 30; seed[i] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe8eef3, size: 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
  pts.name = 'frozen-bay-powder'; pts.frustumCulled = false; scene.add(pts);
  return (dt, time) => {
    for (let i = 0; i < n; i++) {
      let x = pos[i * 3] + dt * (1.6 + seed[i] * 1.4), y = pos[i * 3 + 1];
      if (x > 15) x -= 30;
      y = 0.05 + 0.25 * (0.5 + 0.5 * Math.sin(time * (0.8 + seed[i]) + seed[i] * 40)) * seed[i] * 2;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] += dt * 0.35 * Math.sin(time * 0.3 + seed[i] * 9);
    }
    g.attributes.position.needsUpdate = true;
  };
}

/** 선착장 등불 (가까운 따뜻한 점 하나): 빛나는 재질만 — 진짜 빛은 달지 않는다 */
function pierLantern(scene, pierPos) {
  const grp = new THREE.Group(); grp.name = 'frozen-bay-lantern';
  const frame = new THREE.MeshStandardMaterial({ color: 0x2c2d2f, roughness: 0.6, metalness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0xffb35c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), glow);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.12, 4), frame); cap.position.y = 0.19; cap.rotation.y = Math.PI / 4;
  const hook = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.22, 0.02), frame); hook.position.y = 0.36;
  grp.add(body, cap, hook);
  // 선착장 오른쪽 앞 기둥 머리(stage_frozen_bay_shore.js agedPier: 기둥 (1.03 + 기욺, 1.4, -2.37), 선착장 -0.1 rad 돌림)
  const lx = 1.09, lz = -2.37, c = Math.cos(-0.1), s = Math.sin(-0.1);
  grp.position.set(pierPos.x + lx * c + lz * s, 1.58, pierPos.z - lx * s + lz * c); // 기둥 머리 눈 덮개(1.40 + 0.045) 위
  scene.add(grp);
}

function dawnSky(scene) {
  const tex = canvasTex(8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0, '#182b49'); g.addColorStop(.35, '#354a67');
    g.addColorStop(.47, '#85909c'); g.addColorStop(.50, '#c8a7a9');
    g.addColorStop(.535, '#9eafb9'); g.addColorStop(1, '#8195a5');
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(240, 32, 16), new THREE.MeshBasicMaterial({
    map: tex, side: THREE.BackSide, depthWrite: false, fog: false,
  }));
  sky.name = 'frozen-bay-dawn'; scene.add(sky);
}

export function buildFrozenBay(scene, { hemi, sun }) {
  scene.background = new THREE.Color(0x8b9dab);
  scene.fog = new THREE.Fog(0x91a3b1, 62, 205);
  hemi.color.setHex(0xb4cde6); hemi.groundColor.setHex(0x41566b); hemi.intensity = 1.9;
  sun.color.setHex(0xf0c4b7); sun.intensity = .85;
  const sunOffset = { x: 18, y: 5, z: -10 };
  dawnSky(scene);
  const ice = new THREE.Mesh(new THREE.CircleGeometry(205, 80), new THREE.MeshStandardMaterial({
    color: 0xffffff, map: iceTexture(), roughness: .62, metalness: .02,
  }));
  ice.rotation.x = -Math.PI / 2; ice.receiveShadow = true; ice.name = 'frozen-bay-ice'; scene.add(ice);
  iceDetails(scene);
  const shore = buildFrozenBayShore(scene);
  duelGround(scene);
  pierLantern(scene, shore.pierPos);
  const drift = powder(scene);
  const r = rng(101073); let time = 0, nextIce = 7, nextPier = 19;
  const stage = {
    sunOffset,
    fighterLight: { color: 0xc8dbed, rimColor: 0xe7c8cf, rim: 1.35, level: .55 }, // rim 1.1 → 1.35 (무대 리뷰 10/10: 남색 옷 윤곽)
    stats: shore.stats,
    excite() {}, // Combat impacts must not manufacture thermal ice cracks or booms.
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      time += Math.min(dt, .1);
      drift(Math.min(dt, .1), time);
      if (time >= nextIce) {
        stage.onEvent?.('stageDetail', { kind: 'lakeIceBoom', amp: .85, pos: { x: 40, y: 0, z: -5 }, seed: 10071, time });
        nextIce = time + 31 + r() * 16;
      }
      if (time >= nextPier) {
        stage.onEvent?.('stageDetail', { kind: 'frozenPierCreak', amp: .68, pos: shore.pierPos, seed: 10073, time });
        nextPier = time + 28 + r() * 14;
      }
    },
  };
  return stage;
}
