// 베르나르도 복식 — 볕에 그을린 맨얼굴: 먹빛 리벳 갑옷 · 낮은 겹견갑 · 짧은 황토빛 외짝 망토 · 곱슬 중단발 · 턱수염
//  (샛별 저장소 전달본 977c2a43 의 마지막 판 — 그쪽에선 롤랑의 벗 '올리비에'(옛 이름 검은 왕) 'olivier_v4'. 사장님 10/23 19:0x '지금의 올리비에를 베르나르도로 바꾸자' — 겉모습은 그대로.
//   옛 시안 v1 ~ v3(검은 왕 · 면갑 투구)은 들이지 않았다 · 샛별 쪽 왕실 시안 'bernardo'(면갑을 올린 투구)와는 다른 인물 — 들여오기 기록 docs/import/wander_heroes_import_2026-10-23.md)
//  상아빛 왕(롤랑)의 둥근 금장 판금과 일부러 다르게 지은 마디 갑옷. 머리에는 투구도 방어도 없다 · 눈은 기본 크기(looks.js stockEyes).
//  모든 메쉬는 원래 몸 부위에 얹는다 — 뼈대 크기 · 충돌체 · 모터 · 질량 · 유파 동작은 건드리지 않는다. 좌표: +X 앞 · +Y 위 · +Z 오른쪽
export function createBernardoOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, artoriaCloth, quietFace, taperedTube } = h;
  const IRON = 0x484b46, EDGE = 0x858575, BRASS = 0x887548, CLOTH = 0x89763c, LEATHER = 0x34352e;
  const metal = { metalness: 0.68, roughness: 0.52, steel: 0.75, side: THREE.DoubleSide }, cloth = { metalness: 0, roughness: 0.97, side: THREE.DoubleSide };
  const add = (g, p, c = IRON, m = metal) => addMerged(g, p, c, m);
  const curve = (p, r = 0.0018, n = 20) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(v => new THREE.Vector3(...v))), n, r, 5, false);
  function mesh(p, ix) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(p.flatMap((_, i) => i % 3 === 0 ? [p[i + 2], p[i + 1]] : []), 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    return g;
  }
  function point(row, a) {
    const [y, d, w, x = 0] = row, c = Math.cos(a);
    return [x + d * Math.sign(c) * Math.pow(Math.abs(c), 0.78), y, w * Math.sin(a)];
  }
  function shell(rows, a0 = -Math.PI, a1 = Math.PI, N = 32) {
    const p = [], ix = [];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i <= N; i++) {
      p.push(...point(rows[j], a0 + (a1 - a0) * i / N));
      if (j < rows.length - 1 && i < N) {
        const k = j * (N + 1) + i;
        ix.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
      }
    }
    return mesh(p, ix);
  }
  const rim = (row, a0 = -Math.PI, a1 = Math.PI, r = 0.0017) => curve(Array.from({ length: 33 }, (_, i) => point(row, a0 + (a1 - a0) * i / 32)), r, 32);
  function base(g, rows) {
    for (const c of g.children.slice(1)) c.visible = false;
    g.children[0].geometry.dispose();
    g.children[0].geometry = shell(rows);
  }
  function dots(g, points, color = EDGE, r = 0.002) {
    add(g, points.map(p => ball(r, 6, 4, p)), color);
  }
  function head(g, look) {
    quietFace(g, look, 'omari');
    for (const eye of g.children.slice(1, 3)) {
      eye.scale.set(1, 1, 1);
      eye.material.color.setHex(0x241c17);
    }
    const face = g.children[0], p = face.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), x = p.getX(i), z = p.getZ(i);
      if (y < -0.035) {
        p.setZ(i, z * (1 + 0.14 * Math.min(1, (-y - 0.035) / 0.055)));
        if (x > 0) p.setX(i, x + 0.005);
      }
    }
    p.needsUpdate = true;
    face.geometry.computeVertexNormals();
    const nose = g.children[3];
    nose.geometry.dispose();
    nose.geometry = bake(new THREE.SphereGeometry(1, 10, 8), null, null, [0.016, 0.021, 0.013]);
    nose.position.set(0.101, -0.012, 0);
    const locks = [[], [], []], beard = [[], [], []], detail = [];
    // 정수리 위로 넘긴 물결 머리 — 머리선은 두 눈 위에 둔다
    for (let i = 0; i < 22; i++) {
      const z = (i - 10.5) * 0.009, a = Math.abs(z) / 0.105, y = 0.062 - 0.020 * a + 0.007 * Math.sin(i * 1.6);
      locks[i % 3].push(taperedTube([[0.088 - 0.028 * a, y, z], [0.060, 0.085 - 0.032 * a + 0.011 * Math.sin(i * 1.3), z + 0.009 * Math.sin(i)], [-0.002, 0.108 - 0.055 * a ** 1.4, z * 1.10 + 0.005 * Math.cos(i)], [-0.064, 0.085 - 0.035 * a, z * 1.10], [-0.091, 0.008, z * 1.05]], [0.001, 0.011, 0.012, 0.011, 0.002], 26, 8));
    }
    // 중단발 곱슬: 귀 뒤로 넘기고, 목덜미는 숱 많게, 끝은 고르지 않게 말림
    for (let i = 0; i < 41; i++) {
      const a = 0.72 + i / 40 * (Math.PI * 2 - 1.44), x = 0.103 * Math.cos(a) - 0.012, z = 0.104 * Math.sin(a), len = 0.145 + 0.045 * (0.5 + 0.5 * Math.sin(i * 2.3));
      const path = [];
      for (let j = 0; j < 9; j++) {
        const t = j / 8, w = 0.010 * Math.sin(t * Math.PI * 3.3 + i * 0.9);
        path.push([x - 0.016 * t + w * Math.cos(a), 0.035 - len * t, z * (1 + 0.17 * t) + w * Math.sin(a)]);
      }
      locks[i % 3].push(taperedTube(path, [0.010, 0.012, 0.012, 0.011, 0.010, 0.011, 0.008, 0.006, 0.001], 28, 6));
    }
    // 턱을 두르는 이어진 수염 바탕 — 굽은 가닥들이 부피와 결을 주되, 입을 덮거나 염소수염처럼 떠 있지 않게
    const beardRows = [[-0.107, 0.067, 0.049, 0.016], [-0.093, 0.095, 0.074, 0.007], [-0.065, 0.101, 0.087, 0], [-0.041, 0.093, 0.091, 0]];
    add(g, [shell(beardRows, -1.72, 1.72, 32)], look.hair, cloth);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const t = i / 5, z = side * (0.081 - 0.059 * t), x = 0.047 + 0.049 * t, y = 0.014 - 0.063 * t;
        beard[i % 3].push(taperedTube([[x, y, z], [x + 0.012, y - 0.034, z * 0.98], [x + 0.008, y - 0.060, z * 0.86], [x - 0.008, y - 0.079, z * 0.73]], [0.008, 0.013, 0.012, 0.001], 22, 6));
      }
      for (let i = 0; i < 5; i++) {
        const z = side * (0.008 + i * 0.014), x = 0.107 - 0.020 * (i / 4) ** 2;
        beard[(i + 1) % 3].push(taperedTube([[x, -0.057, z], [x + 0.004, -0.080, z], [x - 0.013, -0.104, z * 0.84], [x - 0.030, -0.116 + 0.014 * i / 4, z * 0.69]], [0.009, 0.012, 0.009, 0.001], 18, 6));
      }
      beard[0].push(taperedTube([[0.119, -0.035, side * 0.003], [0.117, -0.038, side * 0.019], [0.102, -0.046, side * 0.040]], [0.007, 0.009, 0.004], 18, 6));
      detail.push(curve([[0.092, 0.038, side * 0.020], [0.099, 0.041, side * 0.036], [0.091, 0.035, side * 0.053]], 0.003, 12));
    }
    for (let i = 0; i < 3; i++) {
      const o = add(g, [...locks[i], ...beard[i]], [look.hair, 0x272622, 0x302d26][i], cloth);
      o.name = 'bernardo-curls-and-beard-' + i;
    }
    add(g, detail, look.hair, cloth);
    add(g, [curve([[0.110, -0.048, -0.014], [0.113, -0.049, 0], [0.110, -0.048, 0.014]], 0.0017, 10)], 0x704534, cloth);
  }
  function cape(g) {
    const layer = artoriaCloth(g, 'bernardo-short-ochre-mantle'), p = [], ix = [], cols = [], R = 20, C = 22;
    const at = (t, u) => [-0.157 - 0.112 * t - 0.014 * Math.cos(u * 12) * (0.3 + 0.7 * t), 0.126 - 0.71 * t + 0.028 * Math.sin(u * 3) * t, u * (0.147 + 0.073 * t) + 0.055];
    for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) {
      const t = j / R, u = i / C * 2 - 1;
      p.push(...at(t, u));
      const c = new THREE.Color(CLOTH).multiplyScalar(0.77 + 0.20 * (1 + Math.cos(u * 12)) / 2);
      cols.push(c.r, c.g, c.b);
      if (j < R && i < C) {
        const k = j * (C + 1) + i;
        ix.push(k, k + 1, k + C + 1, k + 1, k + C + 2, k + C + 1);
      }
    }
    const geo = mesh(p, ix);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    add(layer, [geo], 0xffffff, { ...cloth, vertexColors: true });
    for (const t of [0.94, 0.985]) add(layer, [curve(Array.from({ length: 25 }, (_, i) => {
      const p = at(t, i / 12 - 1);
      p[0] -= 0.001;
      return p;
    }), 0.0015, 24)], 0x5e522e, cloth);
  }
  const chestRows = [[-0.146, 0.103, 0.138, 0], [-0.095, 0.119, 0.151, 0], [0.018, 0.137, 0.176, -0.008], [0.091, 0.125, 0.170, -0.008], [0.142, 0.073, 0.107, -0.005]];
  function chest(g) {
    base(g, chestRows.map(([y, d, w, x]) => [y, d - 0.012, w - 0.012, x]));
    cape(g);
    const body = add(g, [shell(chestRows)], LEATHER, { ...metal, metalness: 0.25, roughness: 0.72 });
    body.name = 'bernardo-riveted-brigandine';
    // 곧게 겹친 쇠띠 넷이 넓고 고요한 면을 남긴다(롤랑의 덩굴 새김과 다르게). 무리 지은 리벳이 속에 숨은 판을 말한다
    for (let j = 0; j < 4; j++) {
      const y = 0.105 - j * 0.066;
      const sample = Y => {
        let k = 0;
        while (k < chestRows.length - 2 && Y > chestRows[k + 1][0]) k++;
        const a = chestRows[k], b = chestRows[k + 1], t = (Y - a[0]) / (b[0] - a[0]);
        return [Y, a[1] + (b[1] - a[1]) * t + 0.006, a[2] + (b[2] - a[2]) * t + 0.006, a[3] + (b[3] - a[3]) * t];
      };
      const row = [sample(y - 0.065), sample(y - 0.032), sample(y)], plate = add(g, [shell(row, -1.26, 1.26, 32)]);
      const edge = Array.from({ length: 25 }, (_, i) => {
        const a = -1.26 + i / 24 * 2.52, p = point(row[0], a);
        p[1] -= 0.012 * Math.cos(a);
        return p;
      });
      add(plate, [curve(edge, 0.0014, 24)], EDGE);
      dots(plate, [-1, -0.5, 0, 0.5, 1].flatMap(a => [-0.007, 0.007].map(dy => {
        const p = point(row[2], a);
        p[0] += 0.002;
        p[1] -= 0.013 + dy;
        return p;
      })));
    }
    add(g, [shell([[0.126, 0.082, 0.105, 0], [0.177, 0.059, 0.066, 0]])], IRON);
    add(g, [rim([0.177, 0.060, 0.067, 0])], EDGE);
    // 왕의 방패 대신 실용 걸쇠 하나 · 왼어깨에 황토빛 망토 자락
    const clothLayer = artoriaCloth(g, 'bernardo-shoulder-fall');
    add(clothLayer, [shell([[0.055, 0.137, 0.176, -0.012], [0.137, 0.091, 0.117, -0.012]], 1.0, 2.8, 24)], CLOTH, cloth);
    add(g, [cyl(0.019, 0.019, 0.006, 16, false, [0.121, 0.088, 0.112], [0, 0, Math.PI / 2])], BRASS);
    dots(g, [[0.126, 0.088, 0.112]], EDGE, 0.006);
  }
  function shoulder(g, side) {
    const rows = [[-0.04, 0.088, 0.090, 0], [0.045, 0.096, 0.103, 0], [0.117, 0.072, 0.083, 0], [0.148, 0.031, 0.038, 0], [0.155, 0.004, 0.006, 0]];
    const cap = add(g, [shell(rows)], IRON);
    cap.name = 'bernardo-low-pauldron';
    add(cap, [rim(rows[0])], EDGE);
    for (let i = 0; i < 3; i++) {
      const y = 0.003 - i * 0.041, r = 0.091 - i * 0.008, rows = [[y - 0.045, r - 0.009, r - 0.008, 0], [y, r, r, 0]], o = add(g, [shell(rows)], IRON);
      add(o, [rim(rows[0])], EDGE);
      dots(o, [-1, 1].map(s => [r * 0.85, y - 0.015, s * r * 0.48]));
    }
    add(g, [shell([[-0.151, 0.047, 0.048, 0], [-0.109, 0.054, 0.056, 0], [-0.075, 0.061, 0.064, 0]])], IRON);
  }
  function abdomen(g) {
    const rows = [[-0.082, 0.100, 0.135, 0], [0, 0.096, 0.128, 0], [0.080, 0.107, 0.142, 0]];
    base(g, rows.map(([y, d, w, x]) => [y, d - 0.008, w - 0.008, x]));
    for (let i = 0; i < 3; i++) {
      const y = 0.079 - i * 0.053, r = 0.104 - (i === 1 ? 0.005 : 0);
      add(g, [shell([[y - 0.055, r, 0.135, 0], [y, r + 0.004, 0.138, 0]])]);
      add(g, [rim([y - 0.054, r + 0.001, 0.136, 0])], EDGE);
    }
  }
  function pelvis(g) {
    const rows = [[-0.101, 0.107, 0.155, 0], [0.024, 0.107, 0.147, 0], [0.078, 0.100, 0.136, 0]];
    base(g, rows.map(([y, d, w, x]) => [y, d - 0.007, w - 0.007, x]));
    add(g, [shell(rows)]);
    add(g, [shell([[-0.014, 0.113, 0.151, 0], [0.025, 0.113, 0.150, 0]])], 0x493a2c, cloth);
    add(g, [box(0.011, 0.034, 0.041, [0.119, 0.005, -0.021])], BRASS);
    add(g, [box(0.012, 0.021, 0.027, [0.124, 0.005, -0.021])], LEATHER);
  }
  function forearm(g) {
    const rows = [[-0.127, 0.046, 0.046, 0], [-0.065, 0.047, 0.047, 0], [0.070, 0.059, 0.059, 0], [0.134, 0.060, 0.063, 0]];
    add(g, [shell(rows)]);
    for (const row of [rows[0], rows.at(-1)]) add(g, [rim(row)], EDGE);
    add(g, [curve([[0.048, -0.12, 0], [0.051, 0, 0], [0.063, 0.129, 0]], 0.0017)], EDGE);
    dots(g, [-0.110, -0.05, 0.015, 0.08, 0.119].map(y => [0.057, y, 0.022]));
  }
  function thigh(g) {
    const layer = artoriaCloth(g, 'bernardo-ochre-skirt');
    add(layer, [shell([[-0.102, 0.073, 0.071, 0], [0.20, 0.083, 0.081, 0]])], CLOTH, cloth);
    for (let i = 0; i < 3; i++) {
      const y = 0.195 - i * 0.087, r = 0.092 - i * 0.003, rows = [[y - 0.105, r - 0.008, 0.077 - i * 0.003, 0], [y, r, 0.083 - i * 0.003, 0]], plate = add(g, [shell(rows, -1.45, 1.45, 28)]);
      add(plate, [rim(rows[0], -1.45, 1.45)], EDGE);
      dots(plate, [-1, 1].map(s => [r * 0.85, y - 0.018, s * 0.039]));
    }
  }
  function shin(g) {
    const rows = [[-0.185, 0.047, 0.043, 0], [-0.09, 0.054, 0.048, 0], [0.070, 0.063, 0.055, 0], [0.152, 0.058, 0.051, 0]];
    add(g, [shell(rows)]);
    add(g, [rim(rows[0]), curve([[0.048, -0.182, 0], [0.060, -0.05, 0], [0.066, 0.147, 0]], 0.002)], EDGE);
    add(g, [shell([[0.112, 0.061, 0.050, 0.006], [0.160, 0.078, 0.060, 0.009], [0.204, 0.060, 0.045, 0.005]])]);
  }
  function foot(g) {
    const rows = [[-0.034, 0.113, 0.047, 0], [0, 0.127, 0.053, 0], [0.032, 0.090, 0.046, -0.015]];
    base(g, rows.map(([y, d, w, x]) => [y, d - 0.006, w - 0.006, x]));
    add(g, [shell(rows)]);
    for (let i = 0; i < 3; i++) add(g, [curve([[0.070 + i * 0.017, 0.023, -0.037], [0.075 + i * 0.017, 0.030, 0], [0.070 + i * 0.017, 0.023, 0.037]], 0.0015)], EDGE);
  }
  return {
    armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']),
    head,
    chest,
    abdomen,
    pelvis,
    uarmS: g => shoulder(g, 1),
    uarmO: g => shoulder(g, -1),
    farmS: forearm,
    farmO: forearm,
    thighF: thigh,
    thighB: thigh,
    shinF: shin,
    shinB: shin,
    footF: foot,
    footB: foot,
  };
}
