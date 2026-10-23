// 롤랑 복식 — 상아빛 굽은 판금 · 포도주색 망토 · 닫힌 면갑 투구와 말총 (샛별 저장소 전달본 977c2a43 의 마지막 판 — 그쪽 'returned_king_v2').
//  들여오기 기록 docs/import/wander_heroes_import_2026-10-23.md · 옛 시안(v1 · 왕관 · 붉은 깃털)은 들이지 않았다.
//  모든 메쉬는 원래 몸 부위에 얹는다 — 뼈대 크기 · 충돌체 · 모터 · 질량 · 유파 동작은 건드리지 않는다.
//  무겁다(몸 하나 약 9.7 만 삼각형 — 하인리히의 25 배 · 덩굴 새김 · 말총 · 금테 줄이 대부분). 자리 표는 docs/import/wander_heroes_import_2026-10-23.md §6
//   (사장님 10/23 19:0x '롤랑은 네 말대로 개선해' — 개선안대로 다시 만드는 일은 다른 작업. 이 파일은 전달본 모양 그대로)
//  좌표: +X 앞 · +Y 위 · +Z 오른쪽 (다른 복식 모듈과 같다)
export function createRolandOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, artoriaCloth, taperedTube } = h;
  const IVORY = 0xd7cfba, GOLD = 0xad8848, LIGHT = 0xd0b678, DARK = 0x443a2a, WINE = 0x541f2a;
  const metal = { metalness: 0.73, roughness: 0.34, steel: 0.9 }, cloth = { roughness: 0.96, metalness: 0, side: THREE.DoubleSide };
  const add = (g, p, c = IVORY, m = metal) => addMerged(g, p, c, m);
  const v = p => new THREE.Vector3(...p);
  function mesh(pos, uv, idx) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  function curve(points, r = 0.002, n = 18) {
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v)), n, r, 5, false);
  }
  // 고리 단면 줄 rows: [높이, 앞뒤 반지름, 옆 반지름, 앞으로 민 만큼] — 높이 y 의 단면을 이웃 줄 사이에서 고른다
  function sample(rows, y) {
    let i = 0;
    while (i < rows.length - 2 && y > rows[i + 1][0]) i++;
    const a = rows[i], b = rows[i + 1], t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    return a.map((x, j) => THREE.MathUtils.lerp(x, b[j], t));
  }
  function surface(rows, y, z, lift = 0) {
    const [, d, w, x = 0] = sample(rows, y), u = Math.min(1, Math.abs(z) / w);
    return [x + d * Math.pow(Math.max(0, 1 - u * u), 0.4) + lift, y, z];
  }
  function shell(rows, start = -Math.PI, end = Math.PI, segs = 32) {
    const p = [], uv = [], ix = [];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i <= segs; i++) {
      const [y, d, w, x = 0] = rows[j], a = start + (end - start) * i / segs, c = Math.cos(a);
      p.push(x + d * Math.sign(c) * Math.pow(Math.abs(c), 0.8), y, w * Math.sin(a));
      uv.push(i / segs, j / (rows.length - 1));
      if (j < rows.length - 1 && i < segs) {
        const n = j * (segs + 1) + i;
        ix.push(n, n + segs + 1, n + 1, n + 1, n + segs + 1, n + segs + 2);
      }
    }
    return mesh(p, uv, ix);
  }
  function ring(rows, y, start = -Math.PI, end = Math.PI, r = 0.0022) {
    const [, d, w, x = 0] = sample(rows, y), p = [];
    for (let i = 0; i <= 32; i++) {
      const a = start + (end - start) * i / 32, c = Math.cos(a);
      p.push([x + d * Math.sign(c) * Math.pow(Math.abs(c), 0.8), y, w * Math.sin(a)]);
    }
    return curve(p, r, 32);
  }
  function patch(yz, fn) {
    // 평평한 삼각형이 굽은 판을 뚫고 들어가지 않게, 잘게 나눈 점을 판 겉면(fn)에 올린다 — 방패 · 성 · 새김 무늬에 꼭 필요하다
    const cy = yz.reduce((a, p) => a + p[0], 0) / yz.length, cz = yz.reduce((a, p) => a + p[1], 0) / yz.length, p = [], uv = [], ix = [];
    const span = Math.max(...yz.map(([y, z]) => Math.hypot(y - cy, z - cz))), N = span > 0.02 ? 7 : 3;
    for (let k = 0; k < yz.length; k++) {
      const a = yz[k], b = yz[(k + 1) % yz.length], ids = [];
      for (let i = 0; i <= N; i++) {
        ids[i] = [];
        for (let j = 0; j <= N - i; j++) {
          const u = i / N, w = j / N, y = cy + (a[0] - cy) * u + (b[0] - cy) * w, z = cz + (a[1] - cz) * u + (b[1] - cz) * w;
          ids[i][j] = p.length / 3;
          p.push(...fn(y, z));
          uv.push(z, y);
        }
      }
      for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
        ix.push(ids[i][j], ids[i + 1][j], ids[i][j + 1]);
        if (j < N - i - 1) ix.push(ids[i + 1][j], ids[i + 1][j + 1], ids[i][j + 1]);
      }
    }
    return mesh(p, uv, ix);
  }
  function edge(yz, fn, r = 0.002) {
    return curve([...yz, yz[0]].map(([y, z]) => fn(y, z)), r, yz.length * 4);
  }
  function leaf(y, z, dy, dz, fn) {
    return patch([[y, z], [y + dy * 0.35 - dz * 0.20, z + dz * 0.35 + dy * 0.20], [y + dy, z + dz], [y + dy * 0.35 + dz * 0.20, z + dz * 0.35 - dy * 0.20]], fn);
  }
  function laurel(g, fn, y0, z0, length, side = 1, scale = 1) {
    // 아칸서스 덩굴 새김: 흐르는 줄기 · 말린 끝 · 짝지은 작은 잎 (판마다 여러 번 — 삼각형을 많이 먹는 장식)
    const stem = [], leaves = [], curls = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      stem.push(fn(y0 + length * t, z0 + side * 0.016 * scale * Math.sin(t * Math.PI * 2)));
    }
    for (let i = 0; i < 5; i++) {
      const t = (i + 0.3) / 5, y = y0 + length * t, z = z0 + side * 0.016 * scale * Math.sin(t * Math.PI * 2), s = (i % 2 ? 1 : -1) * side;
      const spiral = [];
      for (let j = 0; j <= 20; j++) {
        const a = j / 20 * Math.PI * 1.6, r = 0.012 * scale * (1 - j / 25);
        spiral.push(fn(y + 0.008 * scale + r * Math.sin(a), z + s * (0.013 * scale - r * Math.cos(a))));
      }
      curls.push(curve([fn(y, z), ...spiral], 0.00095 * scale, 22));
      leaves.push(leaf(y, z, 0.017 * scale, -s * 0.012 * scale, fn), leaf(y + 0.011 * scale, z + s * 0.004 * scale, 0.011 * scale, s * 0.010 * scale, fn));
    }
    add(g, [curve(stem, 0.0011 * scale, 24), ...curls, ...leaves], GOLD, { ...metal, side: THREE.DoubleSide });
  }
  // 아주 얕게 눌러 낸 골 — 골 양옆 판은 넓고 고요하게 둔다
  function flute(geo, depth = 0.004, count = 8) {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z);
      if (r < 0.001) continue;
      const d = depth * Math.pow(Math.max(0, Math.cos(count * a)), 6);
      p.setX(i, x + x / r * d);
      p.setZ(i, z + z / r * d);
    }
    geo.computeVertexNormals();
    return geo;
  }
  function beading(g, rows, y, count = 20) {
    const beads = [];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI + (i + 0.5) / count * Math.PI * 2, [, d, w, x = 0] = sample(rows, y);
      beads.push(ball(0.0022, 6, 4, [x + d * Math.cos(a), y, w * Math.sin(a)]));
    }
    add(g, beads, LIGHT);
  }
  function mail(g, y, radius = 0.047) {
    const links = [];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 16; i++) {
      const a = (i + (row % 2) * 0.5) / 16 * Math.PI * 2;
      links.push(bake(new THREE.TorusGeometry(0.0045, 0.0009, 3, 7), [Math.cos(a) * radius, y - row * 0.0065, Math.sin(a) * radius], [0, Math.PI / 2 - a, row % 2 ? 0.35 : -0.35]));
    }
    add(g, links, 0x69675c, { metalness: 0.65, roughness: 0.52, steel: 0.6 });
  }
  function rosette(g, x, y, z, r = 0.022) {
    add(g, [cyl(r, r, 0.007, 20, false, [x, y, z], [0, 0, Math.PI / 2])], GOLD);
    add(g, [cyl(r * 0.78, r * 0.78, 0.008, 20, false, [x + 0.003, y, z], [0, 0, Math.PI / 2])], DARK);
    const p = [];
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      p.push(bake(ball(r * 0.23, 6, 4), [x + 0.010, y + Math.cos(a) * r * 0.48, z + Math.sin(a) * r * 0.48], null, [0.35, 1, 1]));
    }
    p.push(ball(r * 0.20, 8, 5, [x + 0.010, y, z]));
    add(g, p, LIGHT);
  }
  function castle(g, fn, y, z, s = 1) {
    const gold = [], dark = [];
    for (const k of [-1, 0, 1]) {
      const w = 0.012 * s, h = (k === 0 ? 0.040 : 0.030) * s, Y = y + h / 2, Z = z + k * 0.022 * s;
      gold.push(patch([[y, Z - w / 2], [y, Z + w / 2], [y + h, Z + w / 2], [y + h, Z - w / 2]], fn));
      for (const a of [-1, 1]) gold.push(patch([[y + h, Z + a * w * 0.35 - 0.002 * s], [y + h + 0.006 * s, Z + a * w * 0.35 - 0.002 * s], [y + h + 0.006 * s, Z + a * w * 0.35 + 0.002 * s], [y + h, Z + a * w * 0.35 + 0.002 * s]], fn));
      const f = (Y, Z) => {
        const p = fn(Y, Z);
        p[0] += 0.001;
        return p;
      };
      dark.push(patch([[y + 0.004 * s, Z - 0.003 * s], [y + 0.019 * s, Z - 0.003 * s], [y + 0.023 * s, Z], [y + 0.019 * s, Z + 0.003 * s], [y + 0.004 * s, Z + 0.003 * s]], f));
    }
    gold.push(patch([[y, z - 0.033 * s], [y + 0.010 * s, z - 0.033 * s], [y + 0.010 * s, z + 0.033 * s], [y, z + 0.033 * s]], fn));
    add(g, gold, LIGHT, { ...metal, side: THREE.DoubleSide });
    add(g, dark, DARK, { ...metal, side: THREE.DoubleSide });
  }
  function base(g, rows) {
    for (const c of g.children.slice(1)) c.visible = false;
    const m = g.children[0], geo = shell(rows);
    m.geometry.dispose();
    m.geometry = geo;
  }
  function cape(g) {
    const layer = artoriaCloth(g, 'roland-cape'), p = [], uv = [], ix = [], colors = [], R = 24, C = 32;
    const at = (t, u) => {
      const w = 0.165 + 0.132 * Math.sin(Math.min(1, t * 1.9) * Math.PI / 2), fold = Math.cos(u * Math.PI * 5 + 0.3 * u);
      return [-0.137 - 0.132 * t - 0.023 * fold * (0.2 + 0.8 * t), 0.14 - 1.19 * t + 0.017 * Math.cos(u * 8) * t * t, u * w];
    };
    for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) {
      const t = j / R, u = i / C * 2 - 1;
      p.push(...at(t, u));
      uv.push(i / C, t);
      const c = new THREE.Color(WINE).multiplyScalar(0.66 + 0.27 * (1 + Math.cos(u * Math.PI * 5 + 0.3 * u)) / 2);
      colors.push(c.r, c.g, c.b);
      if (j < R && i < C) {
        const n = j * (C + 1) + i;
        ix.push(n, n + 1, n + C + 1, n + 1, n + C + 2, n + C + 1);
      }
    }
    const geo = mesh(p, uv, ix);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    add(layer, [geo], 0xffffff, { ...cloth, vertexColors: true }).name = 'roland-wine-cape';
    const trim = [];
    for (const t of [0.905, 0.96, 0.982]) trim.push(curve(Array.from({ length: 33 }, (_, i) => {
      const p = at(t, i / 16 - 1);
      p[0] -= 0.002;
      return p;
    }), 0.002, 32));
    for (let k = -4; k <= 4; k++) {
      const u = k * 0.20, pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = i / 16 * Math.PI * 2;
        const p = at(0.932 + 0.016 * Math.cos(a), u + 0.035 * Math.sin(a));
        p[0] -= 0.002;
        pts.push(p);
      }
      trim.push(curve(pts, 0.0015, 16));
    }
    add(layer, trim, 0x997b49, cloth);
  }
  function helmet(g) {
    const helm = new THREE.Group();
    helm.name = 'roland-closed-helmet';
    helm.userData.pieces = {};
    g.add(helm);
    g.userData.helmet = helm;
    const piece = (id, p, c = IVORY, m = metal) => {
      const group = new THREE.Group();
      group.name = 'royal-helm-' + id;
      helm.add(group);
      helm.userData.pieces[id] = group;
      const o = add(group, p, c, m);
      if (o) o.userData.base = { color: c, roughness: m.roughness };
      return group;
    };
    const rows = [[-0.117, 0.079, 0.058, 0], [-0.095, 0.100, 0.079, -0.007], [-0.04, 0.115, 0.103, -0.008], [0.025, 0.119, 0.111, -0.008], [0.08, 0.103, 0.104, -0.012], [0.12, 0.073, 0.075, -0.015], [0.147, 0.010, 0.013, -0.025]];
    piece('bowl', [flute(shell(rows), 0.0025, 6)], IVORY);
    // 면갑은 평평한 판 하나가 아니라 얼굴을 따라 굽은 띠 여러 줄로
    const visor = [[-0.116, 0.099, 0.050, 0.003], [-0.091, 0.124, 0.073, 0.004], [-0.035, 0.151, 0.099, 0.004], [0.022, 0.155, 0.104, 0.002], [0.068, 0.138, 0.099, 0], [0.092, 0.116, 0.087, -0.003]];
    const f = (y, z) => surface(visor, y, z, 0.002);
    piece('visor', [shell(visor, -Math.PI / 2, Math.PI / 2, 48)], IVORY, { ...metal, side: THREE.DoubleSide });
    const rim = [curve(visor.map(([y, , w]) => f(y, -w)), 0.0025), curve(visor.map(([y, , w]) => f(y, w)), 0.0025), ring(visor, -0.116, -Math.PI / 2, Math.PI / 2, 0.0025), curve([f(-0.108, 0), f(-0.035, 0), f(0.024, 0), f(0.084, 0)], 0.0022)];
    const brow = [];
    for (let i = 0; i <= 24; i++) {
      const z = (i / 12 - 1) * 0.097;
      brow.push(f(0.055 + 0.009 * Math.abs(z) / 0.097, z));
    }
    rim.push(curve(brow, 0.0032, 24));
    piece('trim', rim, GOLD);
    const slit = [];
    for (const s of [-1, 1]) slit.push(patch([[0.043, s * 0.006], [0.045, s * 0.087], [0.025, s * 0.093], [0.018, s * 0.006]], (y, z) => {
      const p = f(y, z);
      p[0] += 0.002;
      return p;
    }));
    piece('slit', slit, 0x111210, { ...cloth });
    const vents = [];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
      const y = -0.019 - i * 0.012, z = s * (0.047 - i * 0.005);
      vents.push(curve([f(y, z), f(y - 0.007, z + s * 0.003)], 0.0016, 2));
    }
    piece('vents', vents, 0x332c24, cloth);
    for (const s of [-1, 1]) {
      const hinge = piece('hinge' + s, [cyl(0.016, 0.016, 0.007, 16, false, [0.002, 0.025, s * 0.112], [Math.PI / 2, 0, 0])], GOLD);
      const p = [];
      for (let i = 0; i < 6; i++) p.push(ball(0.0025, 6, 4, [0.002 + Math.cos(i * Math.PI / 3) * 0.010, 0.025 + Math.sin(i * Math.PI / 3) * 0.010, s * 0.117]));
      add(hinge, p, LIGHT);
    }
    // 왕관 · 붉은 깃털 없음(샛별 쪽 사용자 고침): 투구 빛깔에 가까운 상아색 말총을 흐트러지게 — 가닥마다 끝이 가늘고 길이가 다르다(68 가닥 + 잔가닥 17).
    //  투구 파손 조각 'crest'(config.js ARMOR.helmets.royal_close shed)는 왕관이 아니라 이 말총이다
    const mane = [[], [], []], noise = (i, k) => (Math.sin(i * k + 1.7) + 1) / 2;
    for (let i = 0; i < 68; i++) {
      const s = i % 2 ? 1 : -1, r = noise(i, 2.399), q = noise(i, 1.73), z = s * (0.025 + 0.112 * r), height = 0.183 + 0.073 * q;
      const tail = 0.012 + 0.125 * noise(i, 1.31), back = -0.20 - 0.13 * noise(i, 2.13), rootZ = (noise(i, 3.7) - 0.5) * 0.105;
      const pts = [[-0.035, 0.124, rootZ], [-0.075, height * 0.87, rootZ * 0.6 + z * 0.35], [-0.146, height, z * 0.76], [back + 0.035, tail + 0.059, z * 1.15], [back, tail, z * (0.8 + 0.4 * q)]];
      mane[i % 3].push(taperedTube(pts, [0.004, 0.006 + (i % 3) * 0.0015, 0.006, 0.003, 0.0004], 24, 5));
      if (i % 4 === 0) mane[2].push(taperedTube([pts[1], [-0.108, height + 0.026, z * 0.65], [-0.196, height * 0.79, z * 1.3], [back - 0.028, tail + 0.039, z * 1.4]], [0.0018, 0.0028, 0.0015, 0.0002], 22, 4));
    }
    const hair = piece('crest', mane[0], 0xc9c3b0, cloth);
    hair.name = 'royal-helm-ivory-horsehair';
    add(hair, mane[1], 0xb7b19e, cloth);
    add(hair, mane[2], 0xd9d3c2, cloth);
    const cheek = piece('engraving', [], GOLD); // 뺨 새김 — 아래에서 채운다 · 제 파손 조각
    for (const s of [-1, 1]) laurel(cheek, (y, z) => f(y, z), -0.082, s * 0.061, 0.070, s, 0.46);
  }
  function shoulderPoint(parent, side) {
    // 짧고 단단한 네모뿔 꼭지 하나 — 견갑을 따라 움직이고 함께 부서지며, 막는 곳은 늘리지 않는다
    const z = side * 0.012;
    const point = add(parent, [bake(new THREE.ConeGeometry(0.026, 0.065, 4), [0, 0.181, z], [0, Math.PI / 4, 0])], IVORY);
    point.name = 'royal-shoulder-simple-point';
    add(point, [cyl(0.026, 0.029, 0.008, 8, false, [0, 0.152, z]), cyl(0.021, 0.025, 0.005, 8, false, [0, 0.159, z])], GOLD);
  }
  function shoulder(g, side = 1) {
    const cap = [[-0.021, 0.088, 0.092, 0], [0.019, 0.100, 0.104, 0], [0.084, 0.094, 0.096, 0], [0.134, 0.056, 0.061, 0], [0.173, 0.009, 0.012, 0]];
    const geo = flute(shell(cap), 0.003, 10), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), a = Math.atan2(p.getZ(i), p.getX(i));
      p.setY(i, y + (1 - THREE.MathUtils.clamp((y + 0.021) / 0.155, 0, 1)) * 0.016 * Math.cos(2 * a));
    }
    geo.computeVertexNormals();
    const capMesh = add(g, [geo]);
    shoulderPoint(capMesh, side);
    const edgePts = [];
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * Math.PI * 2;
      edgePts.push([0.089 * Math.cos(a), -0.021 + 0.016 * Math.cos(2 * a), 0.093 * Math.sin(a)]);
    }
    add(g, [curve(edgePts, 0.0023, 40)], GOLD);
    // 겹친 가는 판 둘, 그 아래 길게 좁아지는 위팔 판 — 타이어 같은 고리는 없다
    for (let i = 0; i < 2; i++) {
      const y = -0.026 - i * 0.032, r = 0.084 - i * 0.009, rows = [[y - 0.038, r - 0.009, r - 0.008, 0], [y, r, r, 0]];
      add(g, [flute(shell(rows), 0.002, 8)]);
      add(g, [ring(rows, y - 0.036, -Math.PI, Math.PI, 0.0015)], GOLD);
    }
    const arm = [[-0.147, 0.047, 0.047, 0], [-0.101, 0.055, 0.055, 0], [-0.074, 0.065, 0.065, 0]];
    add(g, [flute(shell(arm), 0.002, 8)]);
    mail(g, -0.140);
    const f = (y, z) => surface(cap, y, z, 0.004);
    castle(g, f, 0.025, 0, 0.86);
    for (const s of [-1, 1]) laurel(g, f, 0.002, s * 0.055, 0.085, s, 0.52);
    const rivets = [];
    for (const z of [-0.065, -0.036, 0, 0.036, 0.065]) rivets.push(ball(0.0025, 6, 4, surface(cap, -0.009, z, 0.004)));
    add(g, rivets, LIGHT);
  }
  function forearm(g) {
    const rows = [[-0.126, 0.046, 0.046, 0], [-0.087, 0.048, 0.048, 0], [0.035, 0.057, 0.056, 0], [0.101, 0.061, 0.060, 0], [0.127, 0.068, 0.064, 0]];
    add(g, [flute(shell(rows), 0.0018, 10)]);
    add(g, [ring(rows, -0.125), ring(rows, 0.121), ring(rows, 0.111)], GOLD);
    beading(g, rows, 0.116, 16);
    const f = (y, z) => surface(rows, y, z, 0.002);
    add(g, [curve([f(-0.115, 0), f(-0.02, 0), f(0.104, 0)], 0.002)], GOLD);
    for (const s of [-1, 1]) laurel(g, f, -0.060, s * 0.022, 0.125, s, 0.5);
    const elbow = [[-0.005, 0.052, 0.054, 0], [0.020, 0.065, 0.068, -0.006], [0.055, 0.051, 0.054, 0]];
    add(g, [bake(flute(shell(elbow), 0.0025, 6), [0, 0.117, 0])]);
  }
  function thigh(g) {
    const layer = artoriaCloth(g, 'royal-skirt');
    add(layer, [shell([[-0.195, 0.071, 0.071, 0], [0.20, 0.078, 0.077, 0]])], WINE, cloth);
    const rows = [[-0.169, 0.075, 0.064, 0.004], [-0.10, 0.084, 0.069, 0.003], [0.05, 0.092, 0.077, 0.002], [0.185, 0.090, 0.080, 0]];
    add(g, [flute(shell(rows, -Math.PI * 0.65, Math.PI * 0.65), 0.0025, 8)], IVORY, { ...metal, side: THREE.DoubleSide });
    const f = (y, z) => surface(rows, y, z, 0.003), edgePath = [[-0.16, -0.052], [-0.168, 0], [-0.16, 0.052], [0.15, 0.067], [0.18, 0], [0.15, -0.067]];
    add(g, [edge(edgePath, f)], GOLD);
    for (const s of [-1, 1]) laurel(g, f, -0.135, s * 0.025, 0.225, s, 0.58);
    for (let i = 0; i < 2; i++) {
      const y = 0.155 - i * 0.051, r = 0.098 - i * 0.004, w = 0.084 - i * 0.003, short = [[y - 0.049, r - 0.003, w - 0.002, 0], [y, r, w, 0]];
      const geo = shell(short, -Math.PI * 0.52, Math.PI * 0.52), p = geo.attributes.position;
      for (let j = 0; j < p.count; j++) p.setY(j, p.getY(j) - 0.015 * (1 - Math.min(1, Math.abs(p.getZ(j)) / 0.084)));
      geo.computeVertexNormals();
      add(g, [geo], IVORY, { ...metal, side: THREE.DoubleSide });
      const edgePts = [];
      for (let j = 0; j <= 24; j++) {
        const a = -Math.PI * 0.52 + j / 24 * Math.PI * 1.04;
        edgePts.push([r * Math.cos(a), y - 0.047 - 0.015 * (1 - Math.abs(Math.sin(a))), w * Math.sin(a)]);
      }
      add(g, [curve(edgePts, 0.002, 24)], GOLD);
    }
  }
  function shin(g) {
    const rows = [[-0.185, 0.048, 0.044, 0], [-0.14, 0.050, 0.044, 0], [-0.03, 0.061, 0.052, -0.002], [0.10, 0.065, 0.056, -0.002], [0.15, 0.057, 0.052, 0]];
    add(g, [flute(shell(rows), 0.0022, 8)]);
    const f = (y, z) => surface(rows, y, z, 0.004);
    for (const s of [-1, 1]) add(g, [curve([f(-0.17, s * 0.023), f(-0.04, s * 0.033), f(0.13, s * 0.036)], 0.002)], GOLD);
    add(g, [curve([f(-0.177, 0), f(-0.03, 0), f(0.14, 0)], 0.003), ring(rows, -0.181)], GOLD);
    // 무릎은 둥근 공 대신 뾰족하게 이어진 무릎 판
    const knee = [[-0.044, 0.061, 0.050, 0.018], [-0.015, 0.079, 0.067, 0.014], [0.028, 0.073, 0.058, 0.012], [0.055, 0.052, 0.040, 0.010]];
    add(g, [bake(flute(shell(knee), 0.003, 8), [0, 0.165, 0])]);
    const kf = (y, z) => {
      const p = surface(knee, y - 0.165, z, 0.006);
      p[1] = y;
      return p;
    };
    const shield = [[0.217, 0], [0.188, 0.046], [0.143, 0.044], [0.120, 0], [0.143, -0.044], [0.188, -0.046]];
    add(g, [patch(shield, kf)], IVORY, { ...metal, side: THREE.DoubleSide });
    add(g, [edge(shield, kf, 0.0018)], GOLD);
    for (const s of [-1, 1]) laurel(g, kf, 0.139, s * 0.017, 0.060, s, 0.39);
    add(g, [curve([kf(0.125, 0), kf(0.169, 0), kf(0.211, 0)], 0.0018)], GOLD);
  }
  function foot(g) {
    const base = g.children[0], old = base.geometry;
    base.geometry = bake(new THREE.SphereGeometry(1, 20, 12), [0, -0.009, 0], null, [0.117, 0.028, 0.047]);
    old.dispose();
    const p = [], uv = [], ix = [], rings = [[-0.115, 0.045, 0.032], [-0.066, 0.052, 0.057], [0, 0.051, 0.061], [0.075, 0.045, 0.042], [0.137, 0.029, 0.023], [0.151, 0.012, 0.016]], N = 16;
    for (let j = 0; j < rings.length; j++) for (let i = 0; i <= N; i++) {
      const [x, w, h] = rings[j], a = i / N * Math.PI;
      p.push(x, -0.017 + Math.sin(a) * (h + 0.014), w * Math.cos(a));
      uv.push(i / N, j / rings.length);
      if (j < rings.length - 1 && i < N) {
        const n = j * (N + 1) + i;
        ix.push(n, n + N + 1, n + 1, n + 1, n + N + 1, n + N + 2);
      }
    }
    const toe = [[-0.017, -0.012]];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI - i / 16 * Math.PI;
      toe.push([-0.017 + Math.sin(a) * 0.030, 0.012 * Math.cos(a)]);
    }
    toe.push([-0.017, 0.012]);
    add(g, [mesh(p, uv, ix), patch(toe, (y, z) => [0.151, y, z])], IVORY, { ...metal, side: THREE.DoubleSide });
    const trims = [];
    for (const x of [-0.057, -0.017, 0.023, 0.063, 0.102]) {
      const r = rings.findIndex(a => a[0] > x), a = rings[r - 1], b = rings[r], t = (x - a[0]) / (b[0] - a[0]), w = a[1] + (b[1] - a[1]) * t, h = a[2] + (b[2] - a[2]) * t + 0.014;
      trims.push(curve(Array.from({ length: 17 }, (_, i) => [x, -0.016 + Math.sin(i / 16 * Math.PI) * h, w * Math.cos(i / 16 * Math.PI)]), 0.0014, 16));
    }
    add(g, trims, GOLD);
  }
  return {
    armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']),
    head: helmet,
    neck(g) {
      add(g, [shell([[-0.04, 0.060, 0.060, 0], [0.020, 0.061, 0.064, 0], [0.037, 0.065, 0.067, 0]])], DARK);
    },
    chest(g) {
      const rows = [[-0.148, 0.102, 0.140, 0], [-0.092, 0.123, 0.153, -0.005], [-0.015, 0.142, 0.180, -0.006], [0.065, 0.134, 0.184, -0.009], [0.115, 0.104, 0.165, -0.010], [0.142, 0.076, 0.113, -0.009]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.009, w - 0.009, x]));
      cape(g);
      const geo = shell(rows, -Math.PI, Math.PI, 48), pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), z = pos.getZ(i);
        if (x > 0) pos.setX(i, x + 0.009 * Math.exp(-Math.abs(z) * 75));
      }
      geo.computeVertexNormals();
      add(g, [geo]);
      const f = (y, z) => surface(rows, y, z, 0.004 + 0.009 * Math.exp(-Math.abs(z) * 75));
      add(g, [curve([f(0.107, -0.143), f(0.070, -0.090), f(0.060, 0), f(0.070, 0.090), f(0.107, 0.143)], 0.003), ring(rows, -0.145)], GOLD);
      const gorget = [[-0.006, 0.104, 0.104, 0], [0.016, 0.090, 0.091, 0], [0.057, 0.066, 0.066, 0]], gorgetGeo = shell(gorget);
      gorgetGeo.translate(0, 0.115, 0);
      add(g, [gorgetGeo]);
      add(g, [bake(ring(gorget, 0.016), [0, 0.115, 0]), bake(ring(gorget, 0.055), [0, 0.115, 0])], GOLD);
      const shield = [[0.050, -0.035], [0.054, 0], [0.050, 0.035], [-0.027, 0.030], [-0.061, 0], [-0.027, -0.030]];
      add(g, [patch(shield, (y, z) => f(y, z))], WINE, { ...metal, side: THREE.DoubleSide });
      add(g, [edge(shield, (y, z) => f(y, z), 0.0024)], GOLD);
      castle(g, (y, z) => {
        const p = f(y, z);
        p[0] += 0.002;
        return p;
      }, -0.016, 0, 0.70);
      for (const s of [-1, 1]) {
        laurel(g, f, -0.106, s * 0.056, 0.174, s, 0.88);
        add(g, [curve([f(-0.135, s * 0.014), f(-0.090, s * 0.094), f(-0.014, s * 0.139), f(0.076, s * 0.141)], 0.002)], GOLD);
        const p = f(0.096, s * 0.126);
        rosette(g, ...p, 0.022);
      }
      add(g, [curve([f(-0.145, 0), f(-0.105, 0), f(-0.072, 0)], 0.002)], GOLD);
    },
    abdomen(g) {
      const rows = [[-0.082, 0.101, 0.136, 0], [-0.031, 0.094, 0.130, 0], [0.034, 0.098, 0.134, 0], [0.079, 0.108, 0.143, 0]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.006, w - 0.006, x]));
      for (let i = 0; i < 2; i++) {
        const y = 0.079 - i * 0.078, slice = [sample(rows, y - 0.085), sample(rows, y)];
        slice[0][0] = y - 0.085;
        slice[1][0] = y;
        const geo = shell(slice), p = geo.attributes.position;
        for (let j = 0; j < p.count; j++) {
          if (p.getX(j) > 0) p.setY(j, p.getY(j) - 0.014 * (1 - Math.min(1, Math.abs(p.getZ(j)) / 0.14)));
        }
        geo.computeVertexNormals();
        add(g, [geo]);
        const pts = [];
        for (let j = 0; j <= 32; j++) {
          const a = -Math.PI + j / 32 * Math.PI * 2, c = Math.cos(a);
          pts.push([slice[0][1] * Math.sign(c) * Math.pow(Math.abs(c), 0.8), y - 0.084 - (c > 0 ? 0.014 * (1 - Math.abs(Math.sin(a))) : 0), slice[0][2] * Math.sin(a)]);
        }
        add(g, [curve(pts, 0.0017, 32)], GOLD);
      }
    },
    pelvis(g) {
      const rows = [[-0.10, 0.111, 0.159, 0], [-0.025, 0.107, 0.147, 0], [0.056, 0.098, 0.133, 0], [0.080, 0.099, 0.133, 0]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.005, w - 0.005, x]));
      add(g, [shell(rows)]);
      const belt = [[-0.003, 0.113, 0.150, 0], [0.023, 0.110, 0.144, 0]];
      add(g, [shell(belt)], 0x463727, cloth);
      add(g, [ring(belt, -0.002), ring(belt, 0.022)], GOLD);
      add(g, [box(0.009, 0.033, 0.033, [0.117, 0.011, -0.011])], GOLD);
      add(g, [box(0.010, 0.021, 0.022, [0.122, 0.011, -0.011])], DARK);
      for (const s of [-1, 1]) {
        const f = (y, z) => surface(rows, y, z, 0.003);
        laurel(g, f, -0.078, s * 0.098, 0.115, s, 0.45);
        for (let i = 0; i < 3; i++) add(g, [ball(0.0028, 6, 4, f(0.011, s * (0.051 + i * 0.019)))], LIGHT);
      }
    },
    uarmS(g) {
      shoulder(g, 1);
    },
    uarmO(g) {
      shoulder(g, -1);
    },
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
