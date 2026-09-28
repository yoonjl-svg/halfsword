// ─────────────────────────────────────────────────────────────
//  배경 6: 밤의 포세이돈 신전 — 하인리히 재등장(흑화). 포세이돈 신전(arena.js)과 같은 자리를 밤으로 변주한다.
//   arena.js 가 지은 것을 그대로 두고 그 위에 밤을 얹는다: 하늘(별·낮은 달·달 쪽 구름)과 바다 색을 바꾸고, 빛을 달빛으로,
//   안개를 짙푸르게. 그리고 밤 소품만 더한다 — 결투 자리 네 귀퉁이의 쇠 화로, 석상 앞의 횃대 둘, 찢어진 검은 천을 건 장대 둘,
//   화로에서 오르는 불티. 불빛은 실제 조명 대신 신전 조각의 꼭짓점 색에 구워 넣는다 (폰에서 가볍게).
//  arena.js 는 건드리지 않는다 (디렉터 파일 최소 수정). 여기서 arena 의 메쉬를 찾는 기준: 하늘 = BackSide 구, 바다 = y −25 의 MeshBasic.
//  물리와는 무관한 그림만 만든다. 카메라가 도는 반지름(10.5m) 안에는 arena 가 둔 낮은 것만 있다 (화로는 12m 밖).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { buildArena } from './arena.js';
import { rng, h3, _c, _v, Kit, box, cyl, limb, canvasTex, pointGlow, bakeLight } from './stage_kit.js';

const C = {
  iron: 0x2a2a2e,
  ironLit: 0x3a3632,
  wood: 0x4a3a2c,
  cloth: 0x15131a, // 찢어진 검은 천
  rope: 0x6a5a44,
  ember: 0xff5a1a,
};

/** 밤하늘: 짙푸른 하늘에 별, 바다 위 낮은 달과 달빛에 물든 구름, 수평선 아래는 바다 띠 */
function nightSkyTexture(moonAz) {
  const r = rng(77);
  return canvasTex(512, 256, (g, w, h) => {
    const hz = h * 0.5;
    const gr = g.createLinearGradient(0, 0, 0, hz);
    gr.addColorStop(0, '#060912');
    gr.addColorStop(0.5, '#0d1424');
    gr.addColorStop(0.85, '#182338');
    gr.addColorStop(1, '#233047');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, hz);
    g.fillStyle = '#0f1826'; // 수평선 아래 (바다 띠: 바다 메쉬가 덮지만 틈이 보일 때를 위해)
    g.fillRect(0, hz, w, h - hz);
    // 별 (천정 쪽은 촘촘하고 수평선 가까이는 드물다)
    for (let i = 0; i < 1100; i++) {
      const y = Math.pow(r(), 1.6) * hz * 0.92;
      const x = r() * w;
      const a = 0.25 + r() * 0.75;
      const s = r() < 0.08 ? 1.6 : 1;
      g.fillStyle = `rgba(${225 + r() * 30},${228 + r() * 27},${240},${a})`;
      g.fillRect(x, y, s, s);
    }
    const mx = ((((0.5 - moonAz / (Math.PI * 2)) % 1) + 1) % 1) * w;
    const my = h * 0.4;
    // 구름: 낮게 깔린 층구름은 검푸르고, 달 가까운 것은 밑면이 옅게 빛난다
    for (let i = 0; i < 60; i++) {
      const y = h * (0.28 + Math.pow(r(), 0.7) * 0.2);
      const x = r() * w;
      const dx = Math.min(Math.abs(x - mx), w - Math.abs(x - mx)) / w;
      const lit = Math.max(0, 1 - dx * 5);
      const wdt = 40 + r() * 140;
      g.fillStyle = `rgba(${18 + lit * 90},${24 + lit * 95},${40 + lit * 110},${0.35 + r() * 0.35})`;
      g.beginPath();
      g.ellipse(x, y, wdt, 3 + r() * 7, 0, 0, Math.PI * 2);
      g.fill();
      if (lit > 0.3) {
        g.fillStyle = `rgba(${120 + lit * 80},${135 + lit * 80},${170 + lit * 70},${0.12 + lit * 0.2})`;
        g.beginPath();
        g.ellipse(x, y + 3, wdt * 0.8, 1.5 + r() * 2.5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 달: 바다 위 낮게. 달무리와 수평선 쪽 밝은 띠
    for (const ux of [mx, mx - w, mx + w]) {
      let rg = g.createRadialGradient(ux, my, 0, ux, my, 90);
      rg.addColorStop(0, 'rgba(200,214,240,0.55)');
      rg.addColorStop(0.25, 'rgba(160,180,220,0.18)');
      rg.addColorStop(1, 'rgba(120,140,190,0)');
      g.fillStyle = rg;
      g.fillRect(ux - 90, my - 90, 180, 180);
      g.save();
      g.translate(ux, hz - 2);
      g.scale(1, 0.14);
      rg = g.createRadialGradient(0, 0, 0, 0, 0, 150);
      rg.addColorStop(0, 'rgba(170,190,225,0.35)');
      rg.addColorStop(1, 'rgba(170,190,225,0)');
      g.fillStyle = rg;
      g.fillRect(-150, -150, 300, 300);
      g.restore();
      g.fillStyle = '#e9edf3';
      g.beginPath();
      g.arc(ux, my, 7, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(190,198,210,0.6)'; // 달 얼룩
      g.beginPath();
      g.arc(ux - 2, my + 1.5, 2.2, 0, Math.PI * 2);
      g.arc(ux + 2.5, my - 2, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}
function dotTexture() {
  return canvasTex(32, 32, (x, w, h) => {
    const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
  });
}

/**
 * 밤의 포세이돈 신전을 만든다. 반환: { update(dt), excite(amount), sunOffset, fighterLight }
 *  lights: main.js 의 { hemi, sun } — 달빛으로 바꾼다
 */
export function buildPoseidonNight(scene, lights = {}) {
  const r = rng(909);
  const K = new Kit(1213);
  const before = new Set(scene.children);
  const day = buildArena(scene); // 낮 신전을 그대로 짓고
  const added = scene.children.filter((o) => !before.has(o));

  // ── 하늘·바다·빛·안개를 밤으로 ──
  const moonDir = new THREE.Vector3(7, 4.2, -2.6); // 바다 위 낮은 달 (기본 화면에서 석상 오른쪽 뒤)
  const sunOffset = { x: moonDir.x, y: moonDir.y, z: moonDir.z };
  const FOG = 0x0d121c;
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.Fog(FOG, 30, 260);
  if (lights.hemi) {
    lights.hemi.color.set(0x2a3850); // 별빛·달빛 하늘
    lights.hemi.groundColor.set(0x17130f);
    lights.hemi.intensity = 0.85;
  }
  if (lights.sun) {
    lights.sun.color.set(0xaebfe0); // 달빛
    lights.sun.intensity = 0.55;
    lights.sun.position.set(sunOffset.x, sunOffset.y, sunOffset.z);
  }
  const sky = added.find((o) => o.isMesh && o.material?.side === THREE.BackSide);
  if (sky) {
    sky.material.map?.dispose();
    sky.material.map = nightSkyTexture(Math.atan2(moonDir.z, moonDir.x));
    sky.material.needsUpdate = true;
  }
  const sea = added.find((o) => o.isMesh && o.material?.isMeshBasicMaterial && o.position.y === -25);
  if (sea) sea.material.color.set(0x2c3a4e); // 물결 질감·꼭짓점 색(먼 바다의 은빛 띠 = 달빛 길)에 곱한다
  for (const o of added) {
    if (o.isPoints) {
      o.material.color.set(0xbfc6d4); // 먼지는 달빛에 희미하게
      o.material.opacity = 0.28;
    }
  }

  // ── 밤 소품 자리 ──
  const braziers = [
    [9.2, 9.2],
    [-9.2, 9.2],
    [9.2, -9.2],
    [-9.2, -9.2],
  ]; // 결투 자리(반지름 6.5) 밖 12~13m, 카메라 반지름(10.5) 밖
  const stands = [
    [14.0, -1.4],
    [8.2, -9.6],
  ]; // 석상(11.6, −6) 양옆의 횃대
  const glowPts = [
    ...braziers.map(([x, z]) => ({ x, y: 1.35, z, r: 11, c: [2.4, 1.1, 0.3] })), // 밤이라 세게 (달빛에 곱해지므로)
    ...stands.map(([x, z]) => ({ x, y: 2.5, z, r: 7.5, c: [2.0, 0.95, 0.3] })),
  ];
  const glow = pointGlow(glowPts);

  // 불빛을 신전 조각(대리석·기둥·바위·모래)의 꼭짓점 색에 구워 넣는다. 색 속성이 없는 메쉬(모래)에는 흰색을 깔고 켠다
  for (const o of added) {
    if (!o.isMesh || o === sky || o === sea || o.isInstancedMesh) continue;
    const g = o.geometry;
    if (!g?.attributes?.position || o.material?.isMeshBasicMaterial) continue;
    if (!g.attributes.color) {
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
      o.material.vertexColors = true;
      o.material.needsUpdate = true;
    }
    bakeLight(g, glow);
  }

  // ── 쇠 화로 넷: 세 다리 위 넓은 쇠 대접, 잉걸불 ──
  for (const [x, z] of braziers) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      limb(K, 'iron', [x + Math.cos(a) * 0.6, 0, z + Math.sin(a) * 0.6], [x + Math.cos(a) * 0.22, 1.0, z + Math.sin(a) * 0.22], 0.04, 0.03, C.iron, {}, 5);
    }
    K.put('iron', new THREE.CylinderGeometry(0.62, 0.36, 0.4, 14, 1, true), C.iron, [x, 1.15, z]);
    K.put('iron', new THREE.TorusGeometry(0.62, 0.03, 4, 14), C.ironLit, [x, 1.35, z], [Math.PI / 2, 0, 0]);
    K.put('embers', new THREE.CircleGeometry(0.55, 14), C.ember, [x, 1.26, z], [-Math.PI / 2, 0, 0], 1, { vary: 0.3, noise: 0.25 });
    // 화로 밑에 떨어진 재
    K.put('ash', new THREE.CircleGeometry(0.9, 12), 0x3a3634, [x, 0.012, z], [-Math.PI / 2, r() * 3, 0], 1, { noise: 0.2, rough: 0.04 });
  }

  // ── 석상 앞 횃대 둘: 높은 쇠 기둥 위 작은 불 바구니 ──
  for (const [x, z] of stands) {
    K.put('iron', cyl(0.05, 0.07, 2.4, 6), C.iron, [x, 1.2, z]);
    K.put('iron', new THREE.CylinderGeometry(0.22, 0.12, 0.28, 10, 1, true), C.iron, [x, 2.45, z]);
    K.put('embers', new THREE.CircleGeometry(0.16, 10), C.ember, [x, 2.5, z], [-Math.PI / 2, 0, 0], 1, { vary: 0.3 });
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      limb(K, 'iron', [x + Math.cos(a) * 0.3, 0, z + Math.sin(a) * 0.3], [x, 0.5, z], 0.03, 0.025, C.iron, {}, 4); // 받침 다리
    }
  }

  // ── 찢어진 검은 천을 건 장대 둘 (경기장 서쪽, 하인리히가 걸어 둔 것) ──
  for (const [x, z, lean] of [
    [-11.5, 6.2, 0.06],
    [-11.5, -6.2, -0.05],
  ]) {
    const H = 4.2;
    limb(K, 'wood', [x, 0, z], [x + lean * H, H, z], 0.06, 0.035, C.wood, { vary: 0.15 }, 6);
    K.put('wood', box(1.3, 0.05, 0.05), C.wood, [x + lean * H, H - 0.1, z], [0, 0, 0], 1, { vary: 0.15 }); // 가로대
    // 천: 가로대에 걸려 늘어진 조각 (아래가 찢어져 길이가 다르다)
    const strips = [
      [-0.55, 2.6],
      [-0.2, 3.3],
      [0.15, 2.1],
      [0.5, 2.9],
    ];
    for (const [dz, len] of strips) {
      K.put('cloth', box(0.05, len, 0.32, 1, 3, 1), C.cloth, [x + lean * H + 0.05, H - 0.15 - len / 2, z + dz], [0, 0, 0.03 + r() * 0.03], 1, { vary: 0.12, noise: 0.1, rough: 0.05 });
    }
    limb(K, 'iron', [x + lean * H, H - 0.15, z - 0.65], [x + lean * H - 0.3, H - 0.55, z - 0.65], 0.012, 0.012, C.rope, {}, 3); // 매듭 끈
  }

  const std = (p) => new THREE.MeshStandardMaterial({ vertexColors: true, ...p });
  const meshes = [
    K.mesh('iron', std({ roughness: 0.55, metalness: 0.6 }), { light: glow }),
    K.mesh('wood', std({ roughness: 0.9 }), { light: glow }),
    K.mesh('cloth', std({ roughness: 1 }), { light: glow }),
    K.mesh('ash', std({ roughness: 1 })),
    K.mesh('embers', new THREE.MeshBasicMaterial({ vertexColors: true })),
  ];
  for (const m of meshes) if (m) scene.add(m);

  // ── 불꽃 (화로 셋씩, 횃대 둘씩): 인스턴싱 원뿔, 매 프레임 일렁인다 ──
  const flames = [];
  for (const [x, z] of braziers) for (let i = 0; i < 3; i++) flames.push({ x: x + (i - 1) * 0.18, y: 1.28, z: z + ((i % 2) - 0.5) * 0.16, s: 1.0 - Math.abs(i - 1) * 0.28, ph: r() * 6 });
  for (const [x, z] of stands) for (let i = 0; i < 2; i++) flames.push({ x, y: 2.52, z, s: 0.5 - i * 0.18, ph: r() * 6 });
  const flameGeo = new THREE.ConeGeometry(0.17, 0.75, 7);
  flameGeo.translate(0, 0.375, 0);
  const flameMesh = new THREE.InstancedMesh(
    flameGeo,
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    flames.length * 2,
  );
  for (let i = 0; i < flames.length; i++) {
    flameMesh.setColorAt(i * 2, _c.set(0xff7a22));
    flameMesh.setColorAt(i * 2 + 1, _c.set(0xffd27a));
  }
  scene.add(flameMesh);

  // ── 불티: 화로에서 올라 바람에 흩어진다 ──
  const SPARKS = 240;
  const sr = rng(31);
  const spos = new Float32Array(SPARKS * 3);
  const sage = new Float32Array(SPARKS);
  const sseed = new Float32Array(SPARKS * 2);
  for (let i = 0; i < SPARKS; i++) {
    sage[i] = sr();
    sseed[i * 2] = sr();
    sseed[i * 2 + 1] = sr();
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ size: 0.05, map: dotTexture(), transparent: true, opacity: 0.9, depthWrite: false, color: 0xffa040, blending: THREE.AdditiveBlending, fog: false }));
  sparks.frustumCulled = false;
  scene.add(sparks);

  const fm = new THREE.Matrix4();
  const fq = new THREE.Quaternion();
  const fsc = new THREE.Vector3();
  let t = 0;
  let gust = 0;
  const step = (dt) => {
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const w = 1 + 0.18 * Math.sin(t * 11 + f.ph) + 0.1 * Math.sin(t * 23 + f.ph * 2) + gust * 0.35;
      for (let k = 0; k < 2; k++) {
        const s = f.s * (k ? 0.55 : 1);
        fsc.set(s * (1 + 0.1 * Math.sin(t * 17 + f.ph)), s * w, s);
        fq.setFromAxisAngle(_v.set(Math.sin(t * 3 + f.ph), 0, Math.cos(t * 2.3 + f.ph)).normalize(), 0.12 * Math.sin(t * 7 + f.ph) + gust * 0.35);
        fm.compose(_v.set(f.x, f.y, f.z), fq, fsc);
        flameMesh.setMatrixAt(i * 2 + k, fm);
      }
    }
    flameMesh.instanceMatrix.needsUpdate = true;
    // 불티: 나이 0→1 동안 화로 위로 오르며 옆으로 흩어진다. 큰 타격이면 더 많이·더 세게
    for (let i = 0; i < SPARKS; i++) {
      sage[i] += dt * (0.35 + sseed[i * 2] * 0.3 + gust * 0.5);
      if (sage[i] > 1) sage[i] -= 1;
      const a = sage[i];
      const b = braziers[i % braziers.length];
      const ang = sseed[i * 2 + 1] * Math.PI * 2 + t * 0.4;
      const spread = a * (0.5 + gust * 1.6);
      spos[i * 3] = b[0] + Math.cos(ang) * spread + Math.sin(t * 5 + i) * 0.08;
      spos[i * 3 + 1] = 1.35 + a * (2.6 + gust * 2.5);
      spos[i * 3 + 2] = b[1] + Math.sin(ang) * spread;
    }
    sparkGeo.attributes.position.needsUpdate = true;
  };
  step(0);

  return {
    sunOffset,
    // 밤: 캐릭터는 화로의 따뜻한 빛으로 채우고 달빛 테두리로 떼어 놓는다
    fighterLight: { color: 0xffc493, rimColor: 0xaabfe6, rim: 1.5, level: 0.44 },
    /** 큰 타격: 불꽃이 크게 일렁이고 불티가 흩어지고, 낮 신전의 먼지도 흩날린다 */
    excite(amount) {
      gust = Math.min(1, gust + amount * 0.5);
      day.excite?.(amount);
    },
    update(dt) {
      t += dt;
      gust = Math.max(0, gust - dt * 0.5);
      day.update?.(dt);
      step(dt);
    },
  };
}
