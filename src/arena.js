// ─────────────────────────────────────────────────────────────
//  배경: 중세 마상시합장
//   흰 회반죽 + 나무 뼈대 벽, 나무 발코니 관중석과 관중, 문장 깃발, 모래 바닥, 울타리, 소품
//  폰에서도 가볍게: 같은 재질끼리 하나로 합치고(merge), 관중은 인스턴싱으로 한 번에 그린다.
//  그림(질감)은 전부 캔버스에 코드로 그린다 → 파일 없음.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA } from './config.js';

function rng(seed) {
  let x = seed;
  return () => ((x = (x * 16807) % 2147483647) / 2147483647);
}

function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  t.anisotropy = 4;
  return t;
}

// 모래: 얼룩, 발자국, 자갈
function sandTexture() {
  const r = rng(7);
  return canvasTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = '#cdb58c';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        const v = Math.floor(170 + r() * 60);
        g.fillStyle = `rgba(${v},${v - 18},${v - 50},${0.25 + r() * 0.3})`;
        g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3);
      }
      // 발자국/긁힌 자국
      for (let i = 0; i < 60; i++) {
        const x = r() * w;
        const y = r() * h;
        g.save();
        g.translate(x, y);
        g.rotate(r() * Math.PI);
        g.fillStyle = 'rgba(120,95,60,0.18)';
        g.beginPath();
        g.ellipse(0, 0, 5 + r() * 4, 11 + r() * 6, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
      for (let i = 0; i < 180; i++) {
        const v = Math.floor(110 + r() * 70);
        g.fillStyle = `rgb(${v},${v - 5},${v - 15})`;
        g.beginPath();
        g.arc(r() * w, r() * h, 1 + r() * 2.5, 0, Math.PI * 2);
        g.fill();
      }
    },
    [10, 10],
  );
}

// 회반죽 벽 (얼룩과 금)
function plasterTexture() {
  const r = rng(11);
  return canvasTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = '#e8e1d2';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const v = Math.floor(205 + r() * 40);
        g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.35)`;
        g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6);
      }
      g.strokeStyle = 'rgba(120,110,95,0.25)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        let x = r() * w;
        let y = r() * h;
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) g.lineTo((x += (r() - 0.5) * 30), (y += r() * 20));
        g.stroke();
      }
      // 아래쪽 흙 튄 자국
      const gr = g.createLinearGradient(0, h * 0.75, 0, h);
      gr.addColorStop(0, 'rgba(150,120,80,0)');
      gr.addColorStop(1, 'rgba(150,120,80,0.45)');
      g.fillStyle = gr;
      g.fillRect(0, h * 0.75, w, h * 0.25);
    },
    [3, 1],
  );
}

// 나무결
function woodTexture(base = '#8a6541') {
  const r = rng(3);
  return canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = `rgba(40,25,10,${0.08 + r() * 0.15})`;
      g.lineWidth = 1 + r() * 2;
      g.beginPath();
      const y = r() * h;
      g.moveTo(0, y);
      g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 8, w * 0.6, y + (r() - 0.5) * 8, w, y + (r() - 0.5) * 6);
      g.stroke();
    }
  });
}

// 문장 깃발 무늬
function bannerTexture(kind) {
  return canvasTex(64, 160, (g, w, h) => {
    const band = (c1, c2, n) => {
      for (let i = 0; i < n; i++) {
        g.fillStyle = i % 2 ? c2 : c1;
        g.fillRect((i * w) / n, 0, w / n + 1, h);
      }
    };
    if (kind === 'cross') {
      g.fillStyle = '#f2efe6';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#b3201c';
      g.fillRect(w / 2 - 7, 0, 14, h);
      g.fillRect(0, h * 0.32, w, 14);
    } else if (kind === 'lion') {
      g.fillStyle = '#b3201c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#e1b02c';
      for (const y of [40, 95]) {
        g.beginPath();
        g.ellipse(w / 2, y, 16, 20, 0, 0, Math.PI * 2);
        g.fill();
        g.fillRect(w / 2 - 20, y - 6, 8, 18);
        g.fillRect(w / 2 + 12, y - 10, 8, 16);
      }
    } else if (kind === 'check') {
      for (let y = 0; y < 10; y++)
        for (let x = 0; x < 4; x++) {
          g.fillStyle = (x + y) % 2 ? '#2d58a8' : '#f2efe6';
          g.fillRect((x * w) / 4, (y * h) / 10, w / 4 + 1, h / 10 + 1);
        }
    } else {
      band('#e1b02c', '#1f1f1f', 5);
    }
    // 아래쪽 뾰족한 끝
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.moveTo(0, h);
    g.lineTo(w / 2, h - 22);
    g.lineTo(w, h);
    g.fill();
  });
}

/** 여러 상자/원기둥을 한 메쉬로 합쳐서 그리기 부담을 줄인다 */
class Batch {
  constructor() {
    this.geos = [];
  }
  add(geo, pos, rotY = 0, rotX = 0, rotZ = 0) {
    const g = geo.clone();
    g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, rotZ)));
    g.translate(pos.x, pos.y, pos.z);
    this.geos.push(g);
  }
  mesh(material, shadow = false) {
    const m = new THREE.Mesh(mergeGeometries(this.geos, false), material);
    m.castShadow = shadow;
    m.receiveShadow = true;
    return m;
  }
}

/**
 * 경기장을 만든다. 반환: { update(dt), excite(amount) } — 관중 들썩임
 */
export function buildArena(scene) {
  const r = rng(42);
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.9 });
  const darkWood = new THREE.MeshStandardMaterial({ map: woodTexture('#4a3420'), roughness: 0.95 });
  const plaster = new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 1 });

  // ── 하늘 (위는 파랗고 지평선은 옅게) ──
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 24, 12),
    new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      fog: false,
      map: canvasTex(8, 128, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, '#6d9ad1');
        gr.addColorStop(0.5, '#b9d0e6');
        gr.addColorStop(1, '#e9e3d6');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
      }),
    }),
  );
  scene.add(sky);

  // ── 모래 바닥 ──
  const sand = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 1 }));
  sand.rotation.x = -Math.PI / 2;
  sand.receiveShadow = true;
  scene.add(sand);
  // 자갈
  const pebbles = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.03, 0), new THREE.MeshStandardMaterial({ color: 0x8c8374, roughness: 1 }), 220);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 220; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * ARENA.radius;
    const s = 0.4 + r() * 1.6;
    m4.compose(new THREE.Vector3(Math.cos(a) * d, 0.01, Math.sin(a) * d), new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * 3, r() * 3, 0)), new THREE.Vector3(s, s * 0.6, s));
    pebbles.setMatrixAt(i, m4);
  }
  pebbles.receiveShadow = true;
  scene.add(pebbles);

  // ── 나무 울타리 (X자 버팀목) ──
  const fence = new Batch();
  const R = ARENA.radius + 0.15;
  const posts = 36;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const a2 = ((i + 1) / posts) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * R, 0.6, Math.sin(a) * R);
    fence.add(new THREE.BoxGeometry(0.14, 1.2, 0.14), p, -a);
    const mid = new THREE.Vector3(((Math.cos(a) + Math.cos(a2)) / 2) * R, 0, ((Math.sin(a) + Math.sin(a2)) / 2) * R);
    const len = 2 * R * Math.sin(Math.PI / posts);
    const yaw = -(a + a2) / 2 + Math.PI / 2;
    fence.add(new THREE.BoxGeometry(len, 0.1, 0.07), mid.clone().setY(1.12), yaw);
    fence.add(new THREE.BoxGeometry(len, 0.08, 0.06), mid.clone().setY(0.35), yaw);
    // X자 버팀목
    const diag = Math.hypot(len, 0.75);
    const ang = Math.atan2(0.75, len);
    fence.add(new THREE.BoxGeometry(diag, 0.06, 0.05), mid.clone().setY(0.74), yaw, 0, ang);
    fence.add(new THREE.BoxGeometry(diag, 0.06, 0.05), mid.clone().setY(0.74), yaw, 0, -ang);
  }
  scene.add(fence.mesh(wood, true));

  // ── 바깥 벽: 흰 회반죽 + 드러난 나무 뼈대(하프팀버) ──
  const WR = 11;
  const WH = 4.2;
  const segs = 28;
  const wallSegs = new Batch();
  const timber = new Batch();
  const gallery = new Batch();
  const roof = new Batch();
  const seats = [];
  const gateAt = 7; // 이 칸은 성문
  for (let i = 0; i < segs; i++) {
    const a = ((i + 0.5) / segs) * Math.PI * 2;
    const len = 2 * WR * Math.sin(Math.PI / segs) + 0.05;
    const yaw = -a + Math.PI / 2;
    const c = new THREE.Vector3(Math.cos(a) * WR, WH / 2, Math.sin(a) * WR);
    const inward = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a));
    if (i === gateAt) {
      // 성문: 두 기둥 + 위 들보 + 어두운 문
      for (const s of [-1, 1]) {
        const side = new THREE.Vector3(Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2)).multiplyScalar(s * len * 0.38);
        wallSegs.add(new THREE.BoxGeometry(len * 0.24, WH, 0.6), c.clone().add(side), yaw);
      }
      wallSegs.add(new THREE.BoxGeometry(len * 0.55, 1.4, 0.6), c.clone().setY(WH - 0.7), yaw);
      const door = new THREE.Mesh(new THREE.BoxGeometry(len * 0.52, WH - 1.4, 0.2), darkWood);
      door.position.copy(c).setY((WH - 1.4) / 2).addScaledVector(inward, -0.15);
      door.rotation.y = yaw;
      scene.add(door);
    } else {
      wallSegs.add(new THREE.BoxGeometry(len, WH, 0.5), c, yaw);
    }
    // 나무 뼈대: 기둥, 가로 들보, 사선 버팀
    const face = c.clone().addScaledVector(inward, 0.27);
    const tang = new THREE.Vector3(Math.cos(a + Math.PI / 2), 0, Math.sin(a + Math.PI / 2));
    timber.add(new THREE.BoxGeometry(0.18, WH, 0.06), face.clone().addScaledVector(tang, len / 2), yaw);
    for (const y of [0.35, WH * 0.55, WH - 0.1]) timber.add(new THREE.BoxGeometry(len, 0.16, 0.06), face.clone().setY(y), yaw);
    if (i !== gateAt && i % 2 === 0) {
      const dl = Math.hypot(len * 0.5, WH * 0.45);
      timber.add(new THREE.BoxGeometry(dl, 0.12, 0.05), face.clone().setY(WH * 0.32).addScaledVector(tang, -len * 0.2), yaw, 0, Math.atan2(WH * 0.45, len * 0.5));
    }
    // 발코니(관람석): 벽 위에 나무 바닥 + 난간 + 지붕
    const gp = new THREE.Vector3(Math.cos(a) * (WR - 0.9), WH, Math.sin(a) * (WR - 0.9));
    gallery.add(new THREE.BoxGeometry(len, 0.12, 2.1), gp, yaw);
    gallery.add(new THREE.BoxGeometry(len, 0.08, 0.08), gp.clone().setY(WH + 0.95).addScaledVector(inward, 1.0), yaw);
    gallery.add(new THREE.BoxGeometry(len, 0.07, 0.07), gp.clone().setY(WH + 0.5).addScaledVector(inward, 1.0), yaw);
    gallery.add(new THREE.BoxGeometry(0.09, 1.0, 0.09), gp.clone().setY(WH + 0.5).addScaledVector(inward, 1.0).addScaledVector(tang, len / 2), yaw);
    gallery.add(new THREE.BoxGeometry(0.12, 2.4, 0.12), gp.clone().setY(WH + 1.2).addScaledVector(inward, 0.95).addScaledVector(tang, len / 2), yaw);
    // 지붕 (안쪽으로 기울어진 판자)
    roof.add(new THREE.BoxGeometry(len + 0.05, 0.08, 2.6), gp.clone().setY(WH + 2.55).addScaledVector(inward, 0.1), yaw, -0.28);
    // 관중 자리 (문 위 제외)
    if (i !== gateAt) {
      for (let k = 0; k < 5; k++) {
        const along = (k / 4 - 0.5) * len * 0.85;
        const row = r() < 0.5 ? 0.35 : -0.25;
        seats.push(gp.clone().addScaledVector(tang, along + (r() - 0.5) * 0.2).addScaledVector(inward, row).setY(WH + 0.06));
      }
    }
  }
  scene.add(wallSegs.mesh(plaster, false));
  scene.add(timber.mesh(darkWood));
  scene.add(gallery.mesh(wood));
  scene.add(roof.mesh(new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 1 })));

  // ── 관중 (몸통 + 머리, 인스턴싱) ──
  const n = seats.length;
  const bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.45, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.9 }), n);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), n);
  const cloth = [0x8a2a24, 0x2c4f8f, 0x3d6b35, 0xc9a13a, 0x6b3f7a, 0xd8d0bf, 0x5a4a3a, 0x9a5a2a];
  const skins = [0xe0b08a, 0xc99570, 0xa9745a, 0xeac4a2];
  const crowd = seats.map((p, i) => ({ p, phase: r() * 10, speed: 2 + r() * 3 }));
  crowd.forEach((c, i) => {
    bodies.setColorAt(i, new THREE.Color(cloth[Math.floor(r() * cloth.length)]));
    heads.setColorAt(i, new THREE.Color(skins[Math.floor(r() * skins.length)]));
  });
  scene.add(bodies, heads);
  let excitement = 0.1;

  // ── 문장 깃발: 발코니 난간에 걸린 긴 깃발 + 지붕 위 삼각기 ──
  const kinds = ['cross', 'lion', 'check', 'stripe'];
  const bannerMats = kinds.map((k) => new THREE.MeshStandardMaterial({ map: bannerTexture(k), side: THREE.DoubleSide, transparent: true, roughness: 0.9 }));
  const flags = [];
  for (let i = 0; i < segs; i++) {
    if (i === gateAt) continue;
    const a = ((i + 0.5) / segs) * Math.PI * 2;
    const inward = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a));
    const gp = new THREE.Vector3(Math.cos(a) * (WR - 1.93), WH - 0.55, Math.sin(a) * (WR - 1.93));
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.5, 1, 6), bannerMats[i % kinds.length]);
    b.position.copy(gp);
    b.lookAt(gp.clone().add(inward));
    scene.add(b);
    flags.push({ mesh: b, base: b.geometry.attributes.position.array.slice(), phase: r() * 6 });
  }
  // 지붕 위 깃대와 삼각기
  const poles = new Batch();
  for (let i = 0; i < segs; i += 4) {
    const a = (i / segs) * Math.PI * 2;
    const p = new THREE.Vector3(Math.cos(a) * (WR + 0.2), WH + 3.6, Math.sin(a) * (WR + 0.2));
    poles.add(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 6), p);
    const pen = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.45, 6, 1), bannerMats[(i / 4) % kinds.length]);
    pen.position.copy(p).add(new THREE.Vector3(0, 0.8, 0));
    pen.geometry.translate(0.5, 0, 0);
    scene.add(pen);
    flags.push({ mesh: pen, base: pen.geometry.attributes.position.array.slice(), phase: r() * 6, pennant: true });
  }
  scene.add(poles.mesh(darkWood));

  // ── 소품: 무기 거치대, 통, 짚단 (울타리 바깥) ──
  const props = new Batch();
  const straw = new Batch();
  for (const [ang, kind] of [[0.35, 'rack'], [0.55, 'barrel'], [2.4, 'barrel'], [2.55, 'straw'], [3.9, 'rack'], [4.1, 'straw'], [5.3, 'barrel']]) {
    const p = new THREE.Vector3(Math.cos(ang) * (ARENA.radius + 1.3), 0, Math.sin(ang) * (ARENA.radius + 1.3));
    if (kind === 'barrel') {
      props.add(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), p.clone().setY(0.4));
      props.add(new THREE.CylinderGeometry(0.3, 0.3, 0.8, 12), p.clone().add(new THREE.Vector3(0.65, 0.4, 0.1)));
    } else if (kind === 'straw') {
      straw.add(new THREE.BoxGeometry(1.0, 0.5, 0.6), p.clone().setY(0.25), ang);
      straw.add(new THREE.BoxGeometry(1.0, 0.5, 0.6), p.clone().setY(0.75).add(new THREE.Vector3(0.1, 0, 0.05)), ang + 0.2);
    } else {
      const yaw = -ang + Math.PI / 2;
      props.add(new THREE.BoxGeometry(1.4, 0.08, 0.08), p.clone().setY(1.1), yaw);
      props.add(new THREE.BoxGeometry(1.4, 0.08, 0.08), p.clone().setY(0.3), yaw);
      const tang = new THREE.Vector3(Math.cos(ang + Math.PI / 2), 0, Math.sin(ang + Math.PI / 2));
      for (const s of [-0.65, 0.65]) props.add(new THREE.BoxGeometry(0.08, 1.3, 0.08), p.clone().setY(0.65).addScaledVector(tang, s), yaw);
      // 세워 둔 칼과 창
      for (let k = 0; k < 4; k++) props.add(new THREE.BoxGeometry(0.03, 1.5, 0.01), p.clone().setY(0.85).addScaledVector(tang, -0.45 + k * 0.3), yaw, 0, 0.12);
    }
  }
  scene.add(props.mesh(darkWood, true));
  scene.add(straw.mesh(new THREE.MeshStandardMaterial({ color: 0xd8b85a, roughness: 1 }), true));

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3(1, 1, 1);
  const _p = new THREE.Vector3();
  let t = 0;
  return {
    /** 큰 타격이 나오면 관중이 들썩인다 */
    excite(amount) {
      excitement = Math.min(1, excitement + amount);
    },
    update(dt) {
      t += dt;
      excitement = Math.max(0.1, excitement - dt * 0.25);
      crowd.forEach((c, i) => {
        const jump = Math.max(0, Math.sin(t * c.speed + c.phase)) * 0.18 * excitement;
        _p.copy(c.p).setY(c.p.y + 0.42 + jump);
        _m.compose(_p, _q, _s);
        bodies.setMatrixAt(i, _m);
        _p.y += 0.45;
        _m.compose(_p, _q, _s);
        heads.setMatrixAt(i, _m);
      });
      bodies.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
      // 깃발 펄럭임
      for (const f of flags) {
        const pos = f.mesh.geometry.attributes.position;
        const a = pos.array;
        for (let i = 0; i < a.length; i += 3) {
          const k = f.pennant ? a[i] : 0.75 - f.base[i + 1];
          a[i + 2] = f.base[i + 2] + Math.sin(t * 3 + f.phase + (f.pennant ? f.base[i] : f.base[i + 1]) * 4) * 0.05 * Math.max(0, k);
        }
        pos.needsUpdate = true;
      }
    },
  };
}
