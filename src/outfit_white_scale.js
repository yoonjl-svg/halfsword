// 백린의 전사(가칭) 복식 — 은빛 비늘 갑옷(갑찰) · 검은 뿔 투구 · 가면 · 붉은 끈 (샛별 저장소 전달본 977c2a43 그대로 — 그쪽 'white_scale' v1).
//  들여오기 기록 docs/import/wander_heroes_import_2026-10-23.md. 몽골 출신은 설정의 몫이고 복식을 따로 해석하지 않았다 — 어느 한 유물을 되살린 것이 아닌 상상의 갑옷이다.
//  모든 메쉬는 원래 몸 부위에 얹는다 — 뼈대 크기 · 충돌체 · 모터 · 질량 · 유파 동작은 건드리지 않는다.
//  v1(whiteScaleRevision 없음)은 전달본 모양 그대로(꼭짓점 해시 같음 · 몸 하나 121,398 삼각형 — 하인리히의 31 배). 자리 표는 들여오기 기록 §6.
//  v2(whiteScaleRevision 2 — 사장님 10/23 19:0x '백린의 전사는 디자인 바꾸지 말고 줄이기만 해')는 '── v2' 줄(스위치 lite · 따로 된 함수)과 cord · bead · ring 의 v2 마디 값으로만 다르다: 같은 모양 · 같은 색을 적은 삼각형으로
//   (비늘 줄은 긴 띠 조각 · 치마 판의 끈 · 구멍 구슬은 띠 · 비단 무늬는 작은 무늬 그림 · 비늘 리벳 없음 · 뿔 · 관 마디 덜기 — 몸 하나 26,648 삼각형).
//   전후 그림 docs/handoff/hero_models_2026-10-23/white_scale_*.webp (tools/browser/white_scale_shots.mjs) · 결정 docs/decisions.md 10/23 · 확인표 2315 ~ 2317
//  좌표: +X 앞 · +Y 위 · +Z 오른쪽
export function createWhiteScaleOutfit(h) {
  const { THREE, bake, box, cyl, ball, addMerged, artoriaCloth, artoriaRoundedBox, taperedTube, clothNeck } = h;
  const SILVER = 0xc3c4b7, PALE = 0xd6d5c8, STEEL = 0x8e958d, INK = 0x242827, RED = 0x79282d, GOLD = 0xa38953, LEATHER = 0x473c30;
  const metal = { metalness: 0.63, roughness: 0.41, steel: 0.8 }, cloth = { metalness: 0, roughness: 0.95, side: THREE.DoubleSide };
  const add = (g, a, c = SILVER, m = metal) => addMerged(g, a, c, m), V = p => new THREE.Vector3(...p);
  const curve = (p, r = 0.002, n = 16, radial = 4) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(V)), n, r, radial, false);
  let lite = false; // ── v2 지금 꾸미는 부위가 v2 인가 (맨 아래 부위 함수 감싸기가 look.whiteScaleRevision 으로 켠다 — v1 길은 그대로)
  // ── v2 끈 · 줄(관): v1 은 마디 n · 면 4 그대로, v2 는 마디 nLite · 면 radial(기본 3 — 폰 결투 거리에서 반지름 1 ~ 3 mm 관은 1 화소 안팎)
  const cord = (p, r, n, nLite, radial = 3) => (lite ? curve(p, r, nLite, radial) : curve(p, r, n));
  // ── v2 작은 구슬 · 징(반지름 2 ~ 3 mm): 팔면체(삼각형 8)
  const bead = (r, ws, hs, p) => (lite ? ball(r, 4, 2, p) : ball(r, ws, hs, p));
  function mesh(p, uv, ix) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(ix);
    g.computeVertexNormals();
    return g;
  }
  function profile(rows, y) {
    let i = 0;
    while (i < rows.length - 2 && y > rows[i + 1][0]) i++;
    const a = rows[i], b = rows[i + 1], t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
    return a.map((v, j) => THREE.MathUtils.lerp(v, b[j], t));
  }
  const at = (rows, y, a, lift = 0) => {
    const [, d, w, x = 0] = profile(rows, y);
    return [x + (d + lift) * Math.cos(a), y, (w + lift) * Math.sin(a)];
  };
  function shell(rows, a0 = -Math.PI, a1 = Math.PI, N = 32) {
    const p = [], uv = [], ix = [];
    for (let j = 0; j < rows.length; j++) for (let i = 0; i <= N; i++) {
      p.push(...at(rows, rows[j][0], a0 + (a1 - a0) * i / N));
      uv.push(i / N, j / (rows.length - 1));
      if (j < rows.length - 1 && i < N) {
        const n = j * (N + 1) + i;
        ix.push(n, n + N + 1, n + 1, n + 1, n + N + 1, n + N + 2);
      }
    }
    return mesh(p, uv, ix);
  }
  function ring(rows, y, a0 = -Math.PI, a1 = Math.PI, r = 0.002, lift = 0, keep = false) {
    if (lite && !keep) {
      // ── v2: 한 바퀴에 몸통 24 마디 · 팔다리 16 마디(마디 사이로 처지는 몫 1.3 mm · 1 mm 아래 — 겉면에 묻히지 않는다) · 면 3 (keep = v1 그대로 — 얼굴 앞 챙 금테)
      const [, d, w] = profile(rows, y), n = Math.max(3, Math.ceil((Math.max(d, w) > 0.09 ? 24 : 16) * (a1 - a0) / (Math.PI * 2)));
      return curve(Array.from({ length: n + 1 }, (_, i) => at(rows, y, a0 + (a1 - a0) * i / n, lift)), r, n, 3);
    }
    return curve(Array.from({ length: 33 }, (_, i) => at(rows, y, a0 + (a1 - a0) * i / 32, lift)), r, 32);
  }
  // ── v2 납작한 끈: 겉면에 누운 띠(마디마다 삼각형 2). q = [y, 각, 띄움] 점 목록(rows 겉면 기준) · r = 반 폭(m). 겉면 쪽이 앞면
  function strap(rows, q, r) {
    const p = [], uv = [], ix = [], P = q.map(([y, a, lift]) => V(at(rows, y, a, lift)));
    for (let i = 0; i < q.length; i++) {
      const [y, a, lift] = q[i];
      const n = V(at(rows, y, a, lift + 0.01)).sub(P[i]).normalize();
      const t = P[Math.min(i + 1, q.length - 1)].clone().sub(P[Math.max(i - 1, 0)]).normalize();
      const s = new THREE.Vector3().crossVectors(t, n).normalize().multiplyScalar(r);
      p.push(...P[i].clone().add(s).toArray(), ...P[i].clone().sub(s).toArray());
      uv.push(0, i / (q.length - 1), 1, i / (q.length - 1));
      if (i < q.length - 1) {
        const k = i * 2;
        ix.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    return mesh(p, uv, ix);
  }
  function base(g, rows) {
    const m = g.children[0];
    for (const c of g.children.slice(1)) c.visible = false;
    m.geometry.dispose();
    m.geometry = shell(rows);
  }
  const scaleOutline = [[-0.49, 0.48], [0.49, 0.48], [0.49, -0.16], [0.37, -0.39], [0, -0.53], [-0.37, -0.39], [-0.49, -0.16]];
  function scale(rows, y, a, w, H, lift) {
    const p = at(rows, y, a, lift + 0.002), uv = [0.5, 0.5], ix = [], N = scaleOutline.length;
    for (const k of [0.82, 1]) for (const [u, v] of scaleOutline) {
      p.push(...at(rows, y + v * H * k, a + u * w * k, lift + (k < 1 ? 0.0025 : 0)));
      uv.push(u + 0.5, v + 0.5);
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      ix.push(0, 1 + i, 1 + j, 1 + i, 1 + N + i, 1 + N + j, 1 + i, 1 + N + j, 1 + j);
    }
    return mesh(p, uv, ix);
  }
  function lamellar(g, rows, top, bottom, bands, cols, a0 = -Math.PI, a1 = Math.PI, { color = SILVER, laces = false } = {}) {
    if (lite) return lamellarStrips(g, rows, top, bottom, bands, cols, a0, a1, { color, laces });
    const piles = [[], [], []], stitches = [], rivets = [], step = (top - bottom) / (bands - 1), dw = (a1 - a0) / cols;
    // 아랫줄부터 — 윗줄이 아랫줄을 덮고, 덮은 가장자리는 실제로 비스듬히 깎였다 (비늘 하나 = 삼각형 21 · 판마다 수백 장)
    for (let row = bands - 1; row >= 0; row--) for (let col = 0; col < cols; col++) {
      const y = top - row * step, a = a0 + (col + 0.5 + (row % 2 ? 0.17 : -0.17)) * dw;
      if (a < a0 + dw * 0.25 || a > a1 - dw * 0.25) continue;
      const offset = 0.004 + (bands - row) * 0.0003;
      piles[(col + row * 2) % 3].push(scale(rows, y, a, dw * 0.95, step * 1.48, offset));
      if (row % 2 === 0 && col % 2 === 0) rivets.push(ball(0.0018, 5, 3, at(rows, y + step * 0.32, a, offset + 0.003)));
      if (laces && col % 3 === 1 && row < bands - 1) {
        stitches.push(curve([at(rows, y + step * 0.28, a - dw * 0.15, offset + 0.004), at(rows, y - step * 0.30, a + dw * 0.15, offset + 0.006)], 0.0013, 2));
      }
    }
    add(g, piles[0], color);
    add(g, piles[1], color === SILVER ? PALE : color);
    add(g, piles[2], color === SILVER ? 0xabb1a9 : color);
    add(g, rivets, STEEL);
    add(g, stitches, RED, cloth);
  }
  // ── v2 비늘 줄 = 긴 띠 조각: 줄마다 비늘 STRIP_RUN 장씩 한 조각 · 조각은 v1 처럼 세 무더기(메쉬 셋 — v1 무더기와 같은 판금 조각 · 같은 덮은 곳)에 돌려 담는다.
  //  비늘 자리 · 너비 · 높이 · 겹침 · 엇갈림 · 사이 틈 · 테두리 꼴(scaleOutline 일곱 점)은 v1 그대로. 비늘 하나 = 삼각형 5(v1 21 — 안쪽 깎인 테 · 가운데 점을 뺌).
  //  색 = 비늘마다 v1 의 세 은빛 차례 그대로(꼭짓점 색) · 깎인 테 몫 = 비늘 가운데에서 가장자리로 기운 법선 + 아래 끝이 2 mm 들린 기와 기울기.
  //  리벳(v1 비늘 둘에 하나 — 반지름 1.8 mm)은 없다. 엮은 끈은 납작한 띠
  const STRIP_RUN = 4;
  function lamellarStrips(g, rows, top, bottom, bands, cols, a0, a1, { color, laces }) {
    const tones = color === SILVER ? [SILVER, PALE, 0xabb1a9] : [color, color, color];
    const piles = [[], [], []], stitches = [], step = (top - bottom) / (bands - 1), dw = (a1 - a0) / cols;
    let piece = 0;
    for (let row = bands - 1; row >= 0; row--) {
      const y = top - row * step, offset = 0.004 + (bands - row) * 0.0003;
      let run = [];
      const flush = () => {
        if (run.length) piles[piece++ % 3].push(lamellaStrip(rows, y, run, dw * 0.95, step * 1.48, offset));
        run = [];
      };
      for (let col = 0; col < cols; col++) {
        const a = a0 + (col + 0.5 + (row % 2 ? 0.17 : -0.17)) * dw;
        if (a < a0 + dw * 0.25 || a > a1 - dw * 0.25) {
          flush();
          continue;
        }
        run.push([a, tones[(col + row * 2) % 3]]);
        if (run.length === STRIP_RUN) flush();
        if (laces && col % 3 === 1 && row < bands - 1) stitches.push(strap(rows, [[y + step * 0.28, a - dw * 0.15, offset + 0.004], [y - step * 0.30, a + dw * 0.15, offset + 0.006]], 0.0013));
      }
      flush();
    }
    for (const pile of piles) add(g, pile, 0xffffff, { ...metal, vertexColors: true });
    add(g, stitches, RED, cloth);
  }
  const _tone = new THREE.Color(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _d = new THREE.Vector3();
  function lamellaStrip(rows, y, run, w, H, lift) {
    const p = [], uv = [], ix = [], col = [];
    run.forEach(([a, tone], k) => {
      for (const [u, v] of scaleOutline) {
        p.push(...at(rows, y + v * H, a + u * w, lift + 0.002 * (0.48 - v)));
        uv.push(u + 0.5, v + 0.5);
        _tone.setHex(tone);
        col.push(_tone.r, _tone.g, _tone.b);
      }
      const b = k * 7; // 윗변 네모(위 두 점 · 옆 모서리 둘) + 아래 끝 다섯모(옆 모서리에서 부채꼴)
      ix.push(b, b + 1, b + 2, b, b + 2, b + 6, b + 6, b + 2, b + 3, b + 6, b + 3, b + 4, b + 6, b + 4, b + 5);
    });
    const geo = mesh(p, uv, ix);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    // 비늘마다: 가운데(일곱 점 평균)에서 바깥으로 법선을 0.3 만큼(약 17°) 기울인다 — 비늘 하나하나가 빛을 따로 받는다 (더 기울이면 가까이서 금속 반사가 번쩍여 v1 보다 반짝인다)
    const P = geo.attributes.position, N = geo.attributes.normal;
    for (let k = 0; k < run.length; k++) {
      _c.set(0, 0, 0);
      for (let i = 0; i < 7; i++) _c.add(_d.fromBufferAttribute(P, k * 7 + i));
      _c.multiplyScalar(1 / 7);
      for (let i = k * 7; i < k * 7 + 7; i++) {
        _n.fromBufferAttribute(N, i);
        _d.fromBufferAttribute(P, i).sub(_c);
        _d.addScaledVector(_n, -_d.dot(_n)).normalize();
        _n.addScaledVector(_d, 0.3).normalize();
        N.setXYZ(i, _n.x, _n.y, _n.z);
      }
    }
    return geo;
  }
  function ribbon(g, rows, side = 1) {
    const p = [], uv = [], ix = [];
    for (let i = 0; i <= 24; i++) for (let edge = 0; edge < 2; edge++) {
      const t = i / 24, y = 0.125 - 0.256 * t, a = (side > 0 ? 0 : Math.PI) + (-0.88 + 1.56 * t) + (edge ? 1 : -1) * 0.16;
      p.push(...at(rows, y, a, 0.017 + 0.002 * Math.sin(t * 7 * Math.PI) + (edge ? 0 : 0.001)));
      uv.push(edge, t);
      if (i < 24 && edge === 0) {
        const n = i * 2;
        ix.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
      }
    }
    add(g, [mesh(p, uv, ix)], RED, cloth);
    const cords = [];
    for (const edge of [-1, 1]) cords.push(cord(Array.from({ length: 25 }, (_, i) => {
      const t = i / 24;
      return at(rows, 0.125 - 0.256 * t, (side > 0 ? 0 : Math.PI) - 0.88 + 1.56 * t + edge * 0.16, 0.017);
    }), 0.0014, 24, 12));
    add(g, cords, 0x9e4c45, cloth);
  }
  function stud(g, p, r = 0.008) {
    add(g, [bake(lite ? ball(r, 8, 5) : ball(r, 10, 6), p, null, [0.36, 1, 1])], GOLD);
    add(g, [lite ? ball(r * 0.27, 5, 3, [p[0] + r * 0.4, p[1], p[2]]) : ball(r * 0.27, 7, 4, [p[0] + r * 0.4, p[1], p[2]])], INK);
  }
  function helmet(g) {
    const helm = new THREE.Group();
    helm.name = 'white-scale-kabuto';
    helm.userData.pieces = {};
    g.add(helm);
    g.userData.helmet = helm;
    function piece(id, geos, color = SILVER, mat = metal, pivot = [0, 0, 0]) {
      const group = new THREE.Group();
      group.name = 'white-scale-helm-' + id;
      group.position.set(...pivot);
      helm.add(group);
      helm.userData.pieces[id] = group;
      for (const geo of geos) geo.translate(-pivot[0], -pivot[1], -pivot[2]);
      const m = add(group, geos, color, mat);
      if (m) m.userData.base = { color, roughness: mat.roughness };
      return group;
    }
    const bowl = [[-0.023, 0.110, 0.115, -0.012], [0.034, 0.113, 0.119, -0.015], [0.085, 0.096, 0.100, -0.018], [0.123, 0.066, 0.072, -0.019], [0.145, 0.020, 0.027, -0.02]];
    piece('bowl', [shell(bowl)], INK, metal);
    const ribs = [], studs = [];
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      ribs.push(cord(bowl.map(([y]) => at(bowl, y, a, 0.002)), 0.002, 12, 6));
      for (const y of [0.008, 0.043, 0.078]) studs.push(bead(0.0025, 6, 4, at(bowl, y, a, 0.005)));
    }
    piece('ribs', ribs, STEEL);
    piece('rivets', studs, GOLD);
    piece('crest', [cyl(0.025, 0.032, 0.013, 12, false, [-0.02, 0.148, 0])], GOLD);
    // 넓게 퍼지며 겹친 목가리개(시코로) — 얼굴 트임은 좁게
    const nape = [[-0.115, 0.147, 0.160, -0.020], [-0.069, 0.133, 0.144, -0.020], [-0.025, 0.117, 0.125, -0.020], [0.010, 0.114, 0.121, -0.020]];
    const neckGuard = piece('nape', [shell(nape, 0.68, Math.PI * 2 - 0.68)], INK, { ...metal, side: THREE.DoubleSide });
    lamellar(neckGuard, nape, -0.006, -0.102, 5, 27, 0.67, Math.PI * 2 - 0.67, { laces: true });
    add(neckGuard, [ring(nape, -0.113, 0.67, Math.PI * 2 - 0.67, 0.003)], RED, cloth);
    // 챙과 막힌 가면(멘포) — 눈은 빛나는 등이 아니라 그늘진 구멍
    const brow = [[-0.002, 0.117, 0.110, 0], [0.020, 0.150, 0.117, 0], [0.038, 0.130, 0.109, 0]];
    piece('peak', [shell(brow, -Math.PI * 0.49, Math.PI * 0.49)], INK, { ...metal, side: THREE.DoubleSide });
    piece('brow-trim', [ring(brow, 0.019, -Math.PI * 0.49, Math.PI * 0.49, 0.0022, 0, true)], GOLD); // ── v2 도 v1 그대로: 얼굴 앞을 가로지르는 금테(프로필 그림에도 한 줄로 남는 꼴)
    const mask = [[-0.118, 0.066, 0.048, 0.027], [-0.093, 0.092, 0.074, 0.020], [-0.058, 0.114, 0.087, 0.011], [-0.021, 0.120, 0.091, 0.008], [0.004, 0.116, 0.092, 0.007]];
    const maskGroup = piece('mask', [shell(mask, -Math.PI * 0.58, Math.PI * 0.58)], 0x434947, { ...metal, side: THREE.DoubleSide });
    const nose = bake(new THREE.ConeGeometry(0.016, 0.047, 4), [0.135, -0.026, 0], [0, 0, -Math.PI / 2], [1, 1, 0.72]);
    add(maskGroup, [nose], 0x67716b);
    const lips = [cord([[0.127, -0.067, -0.032], [0.141, -0.062, 0], [0.127, -0.067, 0.032]], 0.0033, 12, 6), cord([[0.117, -0.089, -0.025], [0.130, -0.094, 0], [0.117, -0.089, 0.025]], 0.0018, 12, 6)];
    add(maskGroup, lips, 0x101613);
    for (const s of [-1, 1]) {
      add(maskGroup, [cord([[0.103, -0.028, s * 0.064], [0.120, -0.042, s * 0.046], [0.129, -0.048, s * 0.027]], 0.0016, 12, 5)], STEEL);
      stud(maskGroup, [0.081, -0.064, s * 0.080], 0.008);
    }
    // 눈 띠 뒤를 어두운 판으로 막고, 챙이 깊은 그늘을 드리운다
    const eyeBand = [[-0.007, 0.115, 0.099, 0.002], [0.018, 0.119, 0.102, 0.002]];
    piece('eyes', [shell(eyeBand, -Math.PI / 2, Math.PI / 2)], 0x101613, cloth);
    for (const [s, id] of [[1, 'hornR'], [-1, 'hornL']]) {
      const pts = [[0.002, 0.105, s * 0.070], [0.007, 0.185, s * 0.130], [0.001, 0.218, s * 0.223], [-0.012, 0.204, s * 0.300], [-0.033, 0.278 + (s > 0 ? 0.012 : 0), s * 0.377]];
      // ── v2 뿔: 길이 마디 36 → 16 · 둘레 면 10 → 7 (휘는 길 · 굵기 · 끝 그대로)
      const horn = piece(id, [lite ? taperedTube(pts, [0.027, 0.025, 0.018, 0.011, 0.0008], 16, 7) : taperedTube(pts, [0.027, 0.025, 0.018, 0.011, 0.0008], 36, 10)], 0x242822, { ...metal, metalness: 0.16, roughness: 0.66 }, pts[0]);
      const rim = cyl(0.032, 0.033, 0.015, 16, true, pts[0]);
      rim.translate(-pts[0][0], -pts[0][1], -pts[0][2]);
      add(horn, [rim], GOLD);
      // 결을 따라 가는 줄 둘 — 매끈한 플라스틱 뿔처럼 보이지 않게
      const lines = [];
      for (const k of [-1, 1]) {
        const p = pts.map((p, i) => [p[0] - 0.009 * k * (1 - i / 4), p[1] + 0.003, p[2] + s * 0.005 * k * (1 - i / 4)]).map(p => p.map((x, j) => x - pts[0][j]));
        lines.push(cord(p, 0.0011, 32, 10));
      }
      add(horn, lines, 0x4b4937, cloth);
    }
    const tie = piece('ties', [], RED, cloth);
    for (const s of [-1, 1]) add(tie, [cord([[0.015, -0.017, s * 0.112], [0.087, -0.105, s * 0.061], [0.102, -0.126, 0]], 0.0032, 18, 12, 4)], RED, cloth);
  }
  function shoulder(g) {
    // 넓게 늘어진 어깨 판(소데): 납작한 위판 · 겹친 줄 사이 뚜렷한 단 · 끈으로 묶은 받침. 팔과 관절 자리는 그대로
    const rows = [[-0.115, 0.069, 0.093, 0], [-0.020, 0.069, 0.099, 0], [0.070, 0.070, 0.100, 0], [0.126, 0.064, 0.083, 0], [0.156, 0.039, 0.049, 0]];
    base(g, [[-0.190, 0.048, 0.050, 0], [-0.110, 0.057, 0.063, 0], ...rows.slice(1).map(([y, d, w, x]) => [y, d - 0.009, w - 0.009, x]), [0.177, 0.006, 0.008, 0]]);
    const cap = add(g, [shell(rows)], INK);
    lamellar(cap, rows, 0.132, -0.099, 9, 18, -Math.PI, Math.PI, { laces: true });
    add(cap, [ring(rows, -0.114, -Math.PI, Math.PI, 0.003), ring(rows, 0.120, -Math.PI, Math.PI, 0.0025)], STEEL);
    const binding = [], fasteners = [];
    for (const s of [-1, 1]) {
      binding.push(cord([at(rows, 0.130, s * 0.8, 0.013), at(rows, 0.063, s * 0.8, 0.017), at(rows, -0.103, s * 0.8, 0.014)], 0.0032, 20, 8, 4));
      for (const y of [0.126, 0.064, -0.020]) fasteners.push(bead(0.003, 6, 4, at(rows, y, s * 0.8, 0.017)));
    }
    add(cap, binding, RED, cloth);
    add(cap, fasteners, GOLD);
    const mount = artoriaCloth(g, 'white-scale-sode-mount');
    add(mount, [cord([[0.014, 0.165, -0.032], [0.030, 0.172, 0], [0.014, 0.165, 0.032]], 0.005, 12, 6, 4), cord([[0.005, 0.163, 0], [0.025, 0.171, -0.016], [0.028, 0.156, 0], [0.025, 0.171, 0.016], [0.005, 0.163, 0]], 0.003, 16, 8)], RED, cloth);
    const under = artoriaCloth(g, 'white-scale-elbow-fabric');
    const cuff = [[-0.191, 0.047, 0.050, 0], [-0.148, 0.055, 0.060, 0], [-0.090, 0.058, 0.064, 0]];
    add(under, [shell(cuff)], 0x303632, cloth);
    brocade(under, cuff, -0.176, -0.100, 4, 18, 0x303632);
  }
  function brocade(g, rows, bottom, top, bands, cols, ground) {
    if (lite) return brocadeBand(g, rows, bottom, top, bands, cols, ground);
    const pattern = [], dw = Math.PI * 2 / cols, dy = (top - bottom) / bands;
    for (let r = 0; r < bands; r++) for (let c = 0; c < cols; c++) {
      const y = bottom + (r + 0.5) * dy, a = (c + 0.5 + (r % 2) * 0.5) * dw;
      pattern.push(curve([at(rows, y - dy * 0.35, a, 0.003), at(rows, y, a - dw * 0.28, 0.003), at(rows, y + dy * 0.35, a, 0.003), at(rows, y, a + dw * 0.28, 0.003), at(rows, y - dy * 0.35, a, 0.003)], 0.0009, 4));
    }
    add(g, pattern, 0x666652, cloth);
  }
  // ── v2 비단 무늬 = 무늬 그림 한 장을 입힌 띠: v1 의 마름모 관(마름모 하나 = 삼각형 32)과 같은 자리 · 크기 · 엇갈림의 마름모 테를 작은 그림(한 칸 × 두 단 · 32 × 64 화소)에 그려
  //  v1 무늬가 놓인 띠(같은 rows · 같은 띄움 3 mm) 하나에 되풀이해 입힌다. 그림 = 밑 천 색(ground) 바탕 + 무늬 색 테(v1 관 굵기 1.8 mm · 칸 크기는 그 자리의 실제 크기).
  //  띠는 불투명이라 밑 천과 같은 색 바탕으로 덮는다 · 그림은 꾸미는 동안(따로 된 난수 안) 처음 쓸 때 한 번 만들어 모든 백린이 같이 쓴다(지우지 않음 — 네 장 · 한 장 8 KB)
  const brocadeTiles = new Map();
  function brocadeTile(ground, ink, cw, ch, half) {
    const key = [ground, ink, cw.toFixed(5), ch.toFixed(5)].join(':');
    if (brocadeTiles.has(key)) return brocadeTiles.get(key);
    const W = 32, Hh = 64, SS = 4, data = new Uint8Array(W * Hh * 4);
    const rgb = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255], G = rgb(ground), I = rgb(ink);
    const hx = 0.28 * cw, hy = 0.35 * ch, len2 = hx * hx + hy * hy;
    // 그림 한 장 안의 마름모 가운데(m): 아랫단 칸 가운데 · 윗단은 반 칸 엇갈려 칸 경계 — 위아래 · 옆 이웃 장의 것까지
    const centres = [[0.5, 0.5], [0, 1.5], [1, 1.5], [0.5, 2.5], [0, -0.5], [1, -0.5]].map(([u, v]) => [u * cw, v * ch]);
    const nearEdge = (x, y) => {
      for (const [cx, cy] of centres) {
        const dx = Math.abs(x - cx), dy = Math.abs(y - cy);
        const t = THREE.MathUtils.clamp(((dx - hx) * -hx + dy * hy) / len2, 0, 1); // 테 한 변 (hx, 0) → (0, hy) 에서 가장 가까운 점
        const ex = dx - hx * (1 - t), ey = dy - hy * t;
        if (ex * ex + ey * ey <= half * half) return true;
      }
      return false;
    };
    for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
      let hit = 0;
      for (let sj = 0; sj < SS; sj++) for (let si = 0; si < SS; si++) if (nearEdge((i + (si + 0.5) / SS) / W * cw, (j + (sj + 0.5) / SS) / Hh * 2 * ch)) hit++;
      const k = hit / (SS * SS), o = (j * W + i) * 4;
      for (let c = 0; c < 3; c++) data[o + c] = Math.round(G[c] + (I[c] - G[c]) * k);
      data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, W, Hh);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    brocadeTiles.set(key, tex);
    return tex;
  }
  function brocadeBand(g, rows, bottom, top, bands, cols, ground) {
    const dw = Math.PI * 2 / cols, dy = (top - bottom) / bands, [, d, w] = profile(rows, (top + bottom) / 2);
    const tex = brocadeTile(ground, 0x666652, ((d + w) / 2 + 0.003) * dw, dy, 0.0009);
    // 띠 세로 칸: 무늬 아래 · 위 끝과 그 사이 rows 의 꺾이는 높이(겉면을 그대로 따른다) · 둘레 칸 = 무늬 칸 수(칸마다 한 마디)
    const ys = [bottom, ...rows.map(([y]) => y).filter((y) => y > bottom + 1e-4 && y < top - 1e-4), top], N = cols;
    const p = [], uv = [], ix = [];
    for (let j = 0; j < ys.length; j++) for (let i = 0; i <= N; i++) {
      const a = -Math.PI + Math.PI * 2 * i / N;
      p.push(...at(rows, ys[j], a, 0.003));
      uv.push((a + Math.PI) / dw, (ys[j] - bottom) / (2 * dy)); // 그림 한 장 = 한 칸 × 두 단 (마름모 가운데: 아랫단 a = (칸 + 0.5) · 칸 폭)
      if (j < ys.length - 1 && i < N) {
        const n = j * (N + 1) + i;
        ix.push(n, n + N + 1, n + 1, n + 1, n + N + 1, n + N + 2);
      }
    }
    add(g, [mesh(p, uv, ix)], 0xffffff, { ...cloth, map: tex });
  }
  function bracer(g) {
    const rows = [[-0.117, 0.047, 0.047, 0], [-0.060, 0.050, 0.049, 0], [0.040, 0.057, 0.056, 0], [0.114, 0.058, 0.057, 0]];
    const backing = add(g, [shell(rows)], 0x383b31, cloth);
    brocade(backing, rows, -0.103, 0.075, 6, 20, 0x383b31);
    const slats = [];
    for (let i = -2; i <= 2; i++) slats.push(shell([[-0.099, 0.053, 0.051, 0], [0.075, 0.063, 0.060, 0]], i * 0.35 - 0.12, i * 0.35 + 0.12, 3));
    const brace = add(g, slats, 0x4d5751);
    const edges = [], rivets = [];
    for (let i = -2; i <= 2; i++) {
      for (const edge of [-0.12, 0.12]) edges.push(lite ? strap(rows, [[-0.094, i * 0.35 + edge, 0.007], [0.069, i * 0.35 + edge, 0.007]], 0.0009) : curve([at(rows, -0.094, i * 0.35 + edge, 0.007), at(rows, 0.069, i * 0.35 + edge, 0.007)], 0.0009, 2));
      for (const y of [-0.090, 0.064]) rivets.push(bead(0.002, 6, 4, at(rows, y, i * 0.35, 0.009)));
    }
    add(brace, edges, STEEL);
    add(brace, rivets, GOLD);
    add(g, [ring(rows, -0.082, -Math.PI, Math.PI, 0.004, 0.009), ring(rows, 0.060, -Math.PI, Math.PI, 0.004, 0.009)], RED, cloth);
    lamellar(g, rows, 0.111, 0.084, 2, 18, -Math.PI, Math.PI, { laces: true });
    const pattern = [];
    for (let row = 0; row < 4; row++) for (let i = -2; i <= 2; i++) {
      const q = [[-0.060 + row * 0.032, Math.PI + i * 0.26, 0.003], [-0.048 + row * 0.032, Math.PI + i * 0.26 + 0.13, 0.003], [-0.036 + row * 0.032, Math.PI + i * 0.26, 0.003]];
      pattern.push(lite ? strap(rows, q, 0.001) : curve(q.map(([y, a, lift]) => at(rows, y, a, lift)), 0.001, 2));
    }
    add(g, pattern, 0x8d7f60, cloth);
  }
  function skirtPanel(g, rows, a0, a1) {
    const structuralRows = rows.map(([y, ...r]) => [Math.min(y, 0.178), ...r]);
    const panel = add(g, [shell(structuralRows, a0, a1, 9)], INK, { ...metal, side: THREE.DoubleSide });
    const trim = [cord(structuralRows.map(([y]) => at(structuralRows, y, a0, 0.002)), 0.0022, 14, 4), cord(structuralRows.map(([y]) => at(structuralRows, y, a1, 0.002)), 0.0022, 14, 4), ring(structuralRows, structuralRows[0][0], a0, a1, 0.0022)];
    const lames = [], edges = [], lacing = [], holes = [];
    for (let row = 0; row < 5; row++) {
      const y = rows.at(-1)[0] - 0.012 - row * 0.063, edge = y - 0.062;
      const section = [edge, y - 0.020, y].map(Y => {
        const [, d, w, x] = profile(rows, Y);
        return [Y, d + 0.004, w + 0.004, x];
      });
      lames.push(shell(section, a0 + 0.025, a1 - 0.025, lite ? 6 : 12));
      edges.push(ring(section, edge, a0 + 0.025, a1 - 0.025, 0.0013, 0.0005));
      for (let j = 0; j < 6; j++) {
        const a = a0 + (j + 0.5) / 6 * (a1 - a0);
        if (lite) {
          // ── v2 끈 한 쌍(구멍 둘에서 내려오는 붉은 끈 둘) → 붉은 띠 하나(폭 6.4 mm ≈ 두 끈이 덮은 붉은 몫) · 그 위 끝 구멍 구슬 둘 → 짙은 띠 하나(두 구멍 폭)
          holes.push(strap(rows, [[y - 0.0082, a, 0.0062], [y - 0.0118, a, 0.0062]], 0.0046));
          lacing.push(strap(rows, [[y - 0.009, a, 0.006], [y - 0.049, a, 0.0065]], 0.0032));
          continue;
        }
        for (const sign of [-1, 1]) {
          const aa = a + sign * 0.023;
          holes.push(ball(0.0018, 5, 3, at(rows, y - 0.010, aa, 0.0055)));
          lacing.push(curve([at(rows, y - 0.009, aa, 0.006), at(rows, y - 0.031, aa + sign * 0.009, 0.008), at(rows, y - 0.049, aa, 0.006)], 0.0015, 4));
        }
      }
    }
    add(panel, lames, 0x303633);
    add(panel, edges, 0x68706a);
    add(panel, holes, 0x111815, lite ? cloth : metal);
    add(panel, lacing, RED, cloth);
    add(g, trim, STEEL);
  }
  function thigh(g) {
    const fabric = artoriaCloth(g, 'white-scale-trousers');
    const pants = [[-0.235, 0.057, 0.060, 0], [-0.19, 0.068, 0.070, 0], [0.10, 0.078, 0.083, 0], [0.19, 0.074, 0.078, 0]];
    add(fabric, [shell(pants)], 0x252d2c, cloth);
    brocade(fabric, pants, -0.226, -0.155, 4, 20, 0x252d2c);
    // 나뉜 갑옷 치마 판(넷)은 저마다 제 다리를 따른다 — 두 다리를 잇는 통 고리는 없다
    const rows = [[-0.155, 0.133, 0.164, 0], [-0.085, 0.126, 0.149, 0], [0.060, 0.105, 0.113, 0], [0.205, 0.087, 0.085, 0]];
    skirtPanel(g, rows, -1.38, -0.12);
    skirtPanel(g, rows, 0.12, 1.38);
    skirtPanel(g, rows, 1.62, 3.02);
    skirtPanel(g, rows, -3.02, -1.62);
  }
  function shin(g) {
    const rows = [[-0.183, 0.050, 0.047, 0], [-0.08, 0.056, 0.053, 0], [0.075, 0.057, 0.054, 0], [0.170, 0.051, 0.049, 0]];
    add(g, [shell(rows)], LEATHER, cloth);
    const plates = [];
    for (let i = -1; i <= 1; i++) plates.push(shell([[-0.169, 0.056, 0.051, 0], [0.139, 0.063, 0.058, 0]], i * 0.44 - 0.16, i * 0.44 + 0.16, 4));
    add(g, plates, 0x4d5751);
    const pattern = [];
    for (let row = 0; row < 8; row++) for (const a of [-0.44, 0, 0.44]) {
      const y = -0.145 + row * 0.035, q = [[y, a - 0.10, 0.012], [y + 0.010, a, 0.014], [y, a + 0.10, 0.012]];
      pattern.push(lite ? strap(rows, q, 0.0012) : curve(q.map(([qy, qa, lift]) => at(rows, qy, qa, lift)), 0.0012, 3));
    }
    add(g, pattern, 0x948e75, cloth);
    const welt = artoriaCloth(g, 'white-scale-knee-wrap');
    add(welt, [shell([[0.132, 0.058, 0.056, 0], [0.172, 0.059, 0.057, 0], [0.193, 0.051, 0.049, 0]])], 0x333a34, cloth);
    brocade(welt, [[0.132, 0.058, 0.056, 0], [0.193, 0.051, 0.049, 0]], 0.138, 0.183, 3, 18, 0x333a34);
    const ties = [];
    for (const y of [-0.136, -0.052, 0.058, 0.132]) ties.push(ring(rows, y, -Math.PI, Math.PI, 0.003, 0.009));
    add(g, ties, 0x282b26, cloth);
    for (const s of [-1, 1]) add(g, [cord([at(rows, 0.13, s * 0.7, 0.009), at(rows, -0.167, s * 0.7, 0.009)], 0.0016, 16, 1)], GOLD);
  }
  function foot(g) {
    const m = g.children[0];
    m.geometry.dispose();
    m.geometry = bake(artoriaRoundedBox(0.252, 0.083, 0.110, 0.025), [0.006, -0.001, 0]);
    m.material.color.setHex(LEATHER);
    const fabric = artoriaCloth(g, 'white-scale-boots');
    add(fabric, [bake(artoriaRoundedBox(0.260, 0.016, 0.116, 0.007), [0.006, -0.034, 0])], 0x222521, cloth);
    add(fabric, [cord([[0.119, 0.009, -0.040], [0.131, 0.028, 0], [0.119, 0.009, 0.040]], 0.0015, 14, 6)], 0x9a8461, cloth);
  }
  const parts = {
    head: helmet,
    chest(g, look) {
      const lining = artoriaCloth(g, 'white-scale-neck-lining');
      clothNeck(lining, look);
      const collar = [[0.120, 0.078, 0.105, 0], [0.180, 0.066, 0.078, 0], [0.220, 0.060, 0.068, 0]];
      add(lining, [shell(collar)], INK, cloth);
      const rows = [[-0.143, 0.109, 0.148, 0], [-0.070, 0.126, 0.169, 0], [0.038, 0.135, 0.182, -0.004], [0.103, 0.119, 0.165, -0.004], [0.147, 0.073, 0.105, 0]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.008, w - 0.008, x]));
      add(g, [shell(rows)], INK);
      lamellar(g, rows, 0.104, -0.128, 11, 28, -Math.PI, Math.PI, { laces: false });
      const yoke = add(g, [shell([[0.105, 0.120, 0.165, -0.004], [0.135, 0.096, 0.131, -0.002], [0.150, 0.073, 0.106, 0]])], INK);
      add(yoke, [ring(rows, 0.107, -Math.PI, Math.PI, 0.0028, 0.004)], STEEL);
      const knots = [];
      for (const side of [-1, 1]) for (const a of [0.65, 1.1, 2.1, 2.5]) knots.push(cord([at(rows, 0.106, side * a - 0.035, 0.008), at(rows, 0.130, side * a, 0.008), at(rows, 0.106, side * a + 0.035, 0.008)], 0.0022, 5, 4));
      add(yoke, knots, RED, cloth);
      add(g, [ring(rows, -0.140, -Math.PI, Math.PI, 0.0035), ring(rows, 0.117, -Math.PI, Math.PI, 0.003)], GOLD);
      ribbon(g, rows, 1);
      ribbon(g, rows, -1);
      for (const s of [-1, 1]) {
        const y = 0.127, pts = [];
        for (let i = 0; i <= 8; i++) {
          const a = 0.17 + i / 8 * 1.0;
          pts.push(at(rows, y - 0.026 * Math.sin(a), s * a, 0.005));
        }
        add(g, [cord(pts, 0.006, 16, 12, 4)], LEATHER, cloth);
      }
    },
    abdomen(g) {
      const rows = [[-0.086, 0.103, 0.140, 0], [0.001, 0.102, 0.140, 0], [0.081, 0.111, 0.150, 0]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.007, w - 0.007, x]));
      add(g, [shell(rows)], INK);
      lamellar(g, rows, 0.071, -0.067, 7, 25, -Math.PI, Math.PI, { laces: true });
    },
    pelvis(g) {
      const rows = [[-0.088, 0.113, 0.165, 0], [0.009, 0.110, 0.154, 0], [0.086, 0.104, 0.145, 0]];
      base(g, rows.map(([y, d, w, x]) => [y, d - 0.007, w - 0.007, x]));
      add(g, [shell(rows)], INK);
      const belt = [[-0.031, 0.124, 0.166, 0], [0.047, 0.117, 0.158, 0]];
      add(g, [shell(belt)], LEATHER, cloth);
      add(g, [ring(belt, -0.028, -Math.PI, Math.PI, 0.003), ring(belt, -0.010, -Math.PI, Math.PI, 0.003), ring(belt, 0.044, -Math.PI, Math.PI, 0.003)], RED, cloth);
      add(g, [box(0.010, 0.039, 0.051, [0.127, 0.016, -0.013])], GOLD);
      add(g, [box(0.011, 0.024, 0.036, [0.132, 0.016, -0.013])], 0x302a22, cloth);
      const rivets = [];
      for (let i = -5; i <= 5; i++) if (i !== 0) rivets.push(bead(0.003, 6, 4, at(belt, 0.016, i * 0.20, 0.005)));
      add(g, rivets, GOLD);
      const layer = artoriaCloth(g, 'white-scale-belt-ties');
      const band = [[-0.020, 0.129, 0.170, 0], [0.005, 0.128, 0.168, 0], [0.031, 0.124, 0.164, 0]];
      add(layer, [shell(band)], 0x59473a, cloth);
      for (const y of [-0.013, 0.0, 0.017, 0.026]) add(layer, [ring(band, y, -Math.PI, Math.PI, 0.0014)], 0x8b7360, cloth);
      const knot = [];
      for (const side of [-1, 1]) knot.push(cord([[0.135, 0.012, 0], [0.149, 0.021, side * 0.027], [0.145, -0.004, side * 0.033], [0.136, 0.007, 0]], 0.004, 18, 9, 4));
      add(layer, knot, RED, cloth);
      for (const s of [-1, 1]) add(layer, [cord([[0.134, 0.012, s * 0.059], [0.141, -0.054, s * 0.083], [0.127, -0.123, s * 0.095]], 0.007, 15, 8, 4)], RED, cloth);
    },
    uarmS: shoulder,
    uarmO: shoulder,
    farmS: bracer,
    farmO: bracer,
    thighF: thigh,
    thighB: thigh,
    shinF: shin,
    shinB: shin,
    footF: foot,
    footB: foot,
  };
  // ── v2: outfits.js decorateOutfit 이 fn(그룹, look, d, groups) 로 부른다 — 부를 때마다 look.whiteScaleRevision 을 읽어 줄인 판 스위치를 켜고 끈다 (v1 길은 그대로)
  const outfit = { armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'thighF', 'thighB', 'shinF', 'shinB']) };
  for (const [k, fn] of Object.entries(parts)) {
    outfit[k] = (g, look, d, groups) => {
      lite = look?.whiteScaleRevision >= 2;
      return fn(g, look, d, groups);
    };
  }
  return outfit;
}
