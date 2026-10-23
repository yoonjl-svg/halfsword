// 베르나르도 복식 v2 (10/23 — 사장님 10/23 '줄이면서 디자인 개선' · 앞 · 3/4 · 뒤 · 싸우는 화면을 보고 내린 여섯 가지)
//  v1(src/outfit_bernardo.js — 전달본 올리비에 그대로)과 같은 몸 · 같은 판금 13 부위 · 투구 없음 · 얼굴(피부 · 코 · 턱) · 칼(티소나)은 그대로. 바뀐 것:
//   ① 목에 밝은 누빔 깃 띠 · 곱슬머리는 귀 뒤 · 어깨 뒤로 — 검은 머리 · 수염(0x1e1d1a)이 먹빛 갑옷(0x393b38)에 묻히지 않게
//   ② 몸통: 가로 테를 겹친 통 대신 가슴판 한 장 + 배 쇠띠 셋 + 짧은 흰 겉옷(앞판 · 뒤판 — 옆이 트여 갑옷이 보임) · 허리띠
//   ③ 넓적다리 상자 판 · 황토빛 단 → 어두운 사슬 치마(아랫단 톱니 · 놋쇠 고리) + 겉옷 자락(앞 · 뒤 — 다리마다 따로 붙어 걸음에 갈라짐)
//   ④ 작은 무릎 덮개(사슬 치마에 매달림 — 사슬이 다 부서질 때 같이 떨어진다)
//   ⑤ 망토: 맑고 짙은 금빛 · v1 과 같은 어깨(인물 오른어깨 = 앞에서 보아 왼쪽)에 짧게(허리 아래까지) · 굵은 주름 둘(골 둘) · 짙은 금빛 안감 · 앞 끝 놋쇠 브로치 · 넓적다리 뒤 황토빛 없앰
//   ⑥ 겉옷 가슴에 레온 왕국의 보랏빛 선 사자 하나(평면 실루엣 · 문장의 오른쪽(+Z)을 봄) — 보라는 사자에만
//  판금(look.armor 'plate'): 부위마다 판금 메쉬 = 그 부위에 바로 붙인 메쉬(outfits.js decorateOutfit) — 겉옷 · 망토 · 깃 · 허리띠는 몸 바탕 메쉬에 매단
//   천 층(artoriaCloth)이라 판금이 아니다(덮은 곳 · 닳음 · 부서져 날아감에서 빠지고, 판이 다 부서져도 남는다). 테 · 놋쇠 고리 · 무릎 덮개는 판의 자식이라 판과 같이 움직이고 떨어진다.
//  삼각형(tools/sim/look_tris.mjs — 몸 하나 · 칼 뺌): v1 52,000 → v2 21,567 — 곱슬 · 수염 가닥 수와 관 마디 · 면 수, 테 · 리벳 해상도를 줄였다. 좌표: +X 앞 · +Y 위 · +Z 오른쪽
export function createBernardoOutfitV2(h) {
  const { THREE, bake, box, cyl, ball, addMerged, artoriaCloth, quietFace, taperedTube } = h;
  const IRON = 0x484b46, EDGE = 0x858575, BRASS = 0x9c7b36, MAIL = 0x50534e, LEATHER = 0x4a3526;
  const TABARD = 0xe6e0d0, TABARD_HEM = 0xc9c0aa, LION = 0x8b45b5, GOLD = 0xb08a2c, GOLD_IN = 0x846421, COLLAR = 0xc9ad80;
  const metal = { metalness: 0.68, roughness: 0.52, steel: 0.75, side: THREE.DoubleSide };
  const mailMat = { metalness: 0.6, roughness: 0.6, steel: 0.55, side: THREE.DoubleSide, vertexColors: true };
  const cloth = { metalness: 0, roughness: 0.97, side: THREE.DoubleSide };
  const shaded = { ...cloth, vertexColors: true };
  const add = (g, p, c = IRON, m = metal) => addMerged(g, p, c, m);
  const curve = (p, r = 0.0018, n = 12, radial = 4) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p.map(v => new THREE.Vector3(...v))), n, r, radial, false);
  function mesh(p, ix, cols) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(p.flatMap((_, i) => i % 3 === 0 ? [p[i + 2], p[i + 1]] : []), 2));
    if (cols) g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(ix);
    g.computeVertexNormals();
    return g;
  }
  // 줄 [y, 앞뒤 반지름 d, 좌우 반지름 w, 앞 밀림 x] 의 각도 a 자리 (a = 0 앞 · π/2 오른쪽 · π 뒤)
  function point(row, a) {
    const [y, d, w, x = 0] = row, c = Math.cos(a);
    return [x + d * Math.sign(c) * Math.pow(Math.abs(c), 0.78), y, w * Math.sin(a)];
  }
  /** 줄들을 이은 겉면. tint(j, i) 가 있으면 꼭짓점 밝기(재질 색에 곱함 — 주름 · 누빔 · 사슬 줄) */
  function shell(rows, a0 = -Math.PI, a1 = Math.PI, N = 16, tint = null) {
    const p = [], ix = [], cols = tint ? [] : null;
    for (let j = 0; j < rows.length; j++) for (let i = 0; i <= N; i++) {
      p.push(...point(rows[j], a0 + (a1 - a0) * i / N));
      if (tint) {
        const k = tint(j, i);
        cols.push(k, k, k);
      }
      if (j < rows.length - 1 && i < N) {
        const k = j * (N + 1) + i;
        ix.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
      }
    }
    return mesh(p, ix, cols);
  }
  const rim = (row, a0 = -Math.PI, a1 = Math.PI, r = 0.0019, n = 16, radial = 3) => curve(Array.from({ length: n + 1 }, (_, i) => point(row, a0 + (a1 - a0) * i / n)), r, n, radial);
  /** y 자리의 줄 (rows 는 y 가 커지는 차례) */
  function rowAt(rows, y) {
    let k = 0;
    while (k < rows.length - 2 && y > rows[k + 1][0]) k++;
    const a = rows[k], b = rows[k + 1], t = (y - a[0]) / (b[0] - a[0]);
    return a.map((v, i) => v + ((b[i] ?? 0) - v) * t);
  }
  const grow = (row, o) => [row[0], row[1] + o, row[2] + o, row[3] ?? 0];
  /** 겉옷 판: 줄 [y, d, w, x, 반폭] — 줄마다 반폭(z)에 맞춰 각도 폭을 정한다. back 이면 뒤판(π 둘레) */
  function panel(rows, back = false, N = 8) {
    const p = [], ix = [];
    rows.forEach((row, j) => {
      const s = Math.asin(Math.min(0.97, row[4] / row[2]));
      for (let i = 0; i <= N; i++) {
        p.push(...point(row, (back ? Math.PI : 0) - s + 2 * s * i / N));
        if (j < rows.length - 1 && i < N) {
          const k = j * (N + 1) + i;
          ix.push(k, k + N + 1, k + 1, k + 1, k + N + 1, k + N + 2);
        }
      }
    });
    return mesh(p, ix);
  }
  function base(g, rows, N = 16) {
    for (const c of g.children.slice(1)) c.visible = false;
    g.children[0].geometry.dispose();
    g.children[0].geometry = shell(rows, -Math.PI, Math.PI, N);
  }

  // ── 머리: 얼굴은 v1 그대로 · 곱슬은 귀 뒤로 넘겨 어깨 뒤로 떨어지게 · 가닥 수와 관 마디를 줄임 ──
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
    // 정수리 위로 넘긴 물결 머리 — 머리선은 두 눈 위 · 끝은 뒤통수 아래로 (뒤 곱슬과 이어짐)
    for (let i = 0; i < 16; i++) {
      const z = (i - 7.5) * 0.0126, a = Math.abs(z) / 0.105, y = 0.062 - 0.020 * a + 0.007 * Math.sin(i * 2.2);
      locks[i % 3].push(taperedTube([[0.088 - 0.028 * a, y, z], [0.060, 0.085 - 0.032 * a + 0.011 * Math.sin(i * 1.8), z + 0.010 * Math.sin(i * 1.4)], [-0.002, 0.108 - 0.055 * a ** 1.4, z * 1.10 + 0.005 * Math.cos(i * 1.4)], [-0.066, 0.083 - 0.035 * a, z * 1.10], [-0.098, -0.004, z * 1.05]], [0.001, 0.0125, 0.0135, 0.0125, 0.003], 14, 5));
    }
    // 곱슬: 귀 위에서 시작해 뒤로 쓸려 내려간다 — 옆 가닥일수록 더 뒤로(어깨 앞에 얹히지 않게). 목덜미는 숱 많게 · 끝은 고르지 않게 말림
    for (let i = 0; i < 30; i++) {
      const a = 1.5 + i / 29 * (Math.PI * 2 - 3.0), x = 0.103 * Math.cos(a) - 0.012, z = 0.104 * Math.sin(a);
      const len = 0.145 + 0.045 * (0.5 + 0.5 * Math.sin(i * 2.3)), back = 0.016 + 0.05 * Math.abs(Math.sin(a)), path = [];
      for (let j = 0; j < 9; j++) {
        const t = j / 8, w = 0.011 * Math.sin(t * Math.PI * 3.3 + i * 0.9);
        path.push([x - back * t + w * Math.cos(a), 0.035 - len * t, z * (1 + 0.10 * t) + w * Math.sin(a)]);
      }
      locks[i % 3].push(taperedTube(path, [0.011, 0.0135, 0.0135, 0.0125, 0.0115, 0.0125, 0.009, 0.007, 0.001], 16, 5));
    }
    // 턱을 두르는 이어진 수염 바탕 + 굽은 가닥(부피와 결) — v1 과 같은 자리 · 마디만 줄임
    const beardRows = [[-0.107, 0.067, 0.049, 0.016], [-0.093, 0.095, 0.074, 0.007], [-0.065, 0.101, 0.087, 0], [-0.041, 0.093, 0.091, 0]];
    add(g, [shell(beardRows, -1.72, 1.72, 24)], look.hair, cloth);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const t = i / 5, z = side * (0.081 - 0.059 * t), x = 0.047 + 0.049 * t, y = 0.014 - 0.063 * t;
        beard[i % 3].push(taperedTube([[x, y, z], [x + 0.012, y - 0.034, z * 0.98], [x + 0.008, y - 0.060, z * 0.86], [x - 0.008, y - 0.079, z * 0.73]], [0.008, 0.013, 0.012, 0.001], 10, 5));
      }
      for (let i = 0; i < 5; i++) {
        const z = side * (0.008 + i * 0.014), x = 0.107 - 0.020 * (i / 4) ** 2;
        beard[(i + 1) % 3].push(taperedTube([[x, -0.057, z], [x + 0.004, -0.080, z], [x - 0.013, -0.104, z * 0.84], [x - 0.030, -0.116 + 0.014 * i / 4, z * 0.69]], [0.009, 0.012, 0.009, 0.001], 10, 5));
      }
      beard[0].push(taperedTube([[0.119, -0.035, side * 0.003], [0.117, -0.038, side * 0.019], [0.102, -0.046, side * 0.040]], [0.007, 0.009, 0.004], 8, 5));
      detail.push(curve([[0.092, 0.038, side * 0.020], [0.099, 0.041, side * 0.036], [0.091, 0.035, side * 0.053]], 0.003, 8));
    }
    for (let i = 0; i < 3; i++) {
      const o = add(g, [...locks[i], ...beard[i]], [look.hair, 0x272622, 0x302d26][i], cloth);
      o.name = 'bernardo-curls-and-beard-' + i;
    }
    add(g, detail, look.hair, cloth);
    add(g, [curve([[0.110, -0.048, -0.014], [0.113, -0.049, 0], [0.110, -0.048, 0.014]], 0.0017, 8)], 0x704534, cloth);
  }

  // ── 가슴: 가슴판 한 장 · 흰 겉옷 앞판(사자) · 뒤판 · 누빔 깃 띠 · 금빛 망토 ──
  const chestRows = [[-0.146, 0.103, 0.138, 0], [-0.095, 0.119, 0.151, 0], [0.018, 0.137, 0.176, -0.008], [0.091, 0.125, 0.170, -0.008], [0.142, 0.073, 0.107, -0.005]];
  // 겉옷은 가슴의 가장 넓은 곳에서 곧게 떨어진다 (판에 바짝 붙지 않게) — [y, d, w, x, 반폭]
  const tabardChest = [[-0.158, 0.134, 0.168, 0, 0.104], [-0.060, 0.146, 0.182, -0.004, 0.102], [0.018, 0.151, 0.190, -0.008, 0.100], [0.091, 0.139, 0.184, -0.008, 0.092], [0.124, 0.104, 0.142, -0.006, 0.075]];
  function plateShell(rows, N = 24) {
    // 가운데 능선이 살짝 선 가슴판 (앞 ±0.5 rad 안에서만 앞으로 6 mm)
    const geo = shell(rows, -Math.PI, Math.PI, N), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getZ(i), p.getX(i)), k = Math.max(0, 1 - Math.abs(a) / 0.5), y = p.getY(i);
      if (y < 0.12) p.setX(i, p.getX(i) + 0.006 * k * Math.min(1, (0.12 - y) / 0.05));
    }
    geo.computeVertexNormals();
    return geo;
  }
  function lion() {
    // 문장의 선 사자(rampant) — (u 오른쪽 = +Z 덱스터, v 위) 1 = 사자 키. 조각을 겹쳐 한 실루엣 (같은 색 · 같은 면이라 겹친 자리가 보이지 않는다)
    const ell = (cx, cy, rx, ry, rot = 0, n = 12, jag = 0) => Array.from({ length: n }, (_, i) => {
      const t = i / n * Math.PI * 2, r = 1 + (i % 2 ? jag : 0), x = rx * r * Math.cos(t), y = ry * r * Math.sin(t);
      return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
    });
    const limb = (pts, w0, w1) => {
      const out = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
        const wa = (w0 + (w1 - w0) * i / (pts.length - 1)) / 2, wb = (w0 + (w1 - w0) * (i + 1) / (pts.length - 1)) / 2;
        out.push([[ax + nx * wa, ay + ny * wa], [bx + nx * wb, by + ny * wb], [bx - nx * wb, by - ny * wb], [ax - nx * wa, ay - ny * wa]]);
        if (i > 0) out.push(ell(ax, ay, wa, wa, 0, 8));
      }
      return out;
    };
    return [
      ell(0.02, 0.45, 0.14, 0.26, -0.40), // 몸통 (위가 앞으로 기욺)
      ell(0.10, 0.70, 0.17, 0.16, -0.2, 16, 0.28), // 갈기
      ell(0.20, 0.82, 0.10, 0.085, 0, 12), // 머리
      [[0.25, 0.88], [0.37, 0.87], [0.38, 0.80], [0.27, 0.775]], // 윗주둥이
      [[0.25, 0.78], [0.35, 0.755], [0.33, 0.715], [0.23, 0.73]], // 벌린 아래턱
      [[0.15, 0.90], [0.17, 0.96], [0.22, 0.955], [0.23, 0.90]], // 귀
      ...limb([[0.16, 0.68], [0.29, 0.79], [0.39, 0.90]], 0.085, 0.055), // 높이 든 앞발
      [[0.37, 0.94], [0.45, 0.99], [0.42, 0.93], [0.48, 0.93], [0.42, 0.89], [0.46, 0.85], [0.38, 0.86]],
      ...limb([[0.15, 0.57], [0.29, 0.61], [0.40, 0.69]], 0.08, 0.05), // 낮은 앞발
      [[0.39, 0.73], [0.47, 0.765], [0.43, 0.70], [0.49, 0.68], [0.42, 0.66], [0.46, 0.62], [0.38, 0.655]],
      ell(-0.04, 0.27, 0.10, 0.12, -0.3), // 디딘 뒷다리 허벅지
      ...limb([[-0.03, 0.24], [0.04, 0.13], [-0.04, 0.04]], 0.10, 0.06),
      [[-0.10, 0.07], [0.06, 0.07], [0.14, 0.035], [0.11, 0.0], [0.16, -0.01], [0.06, -0.02], [-0.10, -0.01]],
      ...limb([[0.06, 0.30], [0.20, 0.31], [0.24, 0.17]], 0.10, 0.06), // 든 뒷발
      [[0.21, 0.20], [0.32, 0.18], [0.29, 0.14], [0.34, 0.11], [0.26, 0.115], [0.20, 0.14]],
      ...limb([[-0.10, 0.25], [-0.24, 0.27], [-0.32, 0.40], [-0.30, 0.56], [-0.22, 0.66]], 0.05, 0.035), // 꼬리
      ell(-0.19, 0.725, 0.045, 0.085, -0.5, 10, 0.2), // 꼬리 끝 술
    ];
  }
  function cape(g) {
    // 망토: t 0 어깨 → 1 아랫단 · s 0 앞 끝 → 1 등 가운데 너머. 위 끝은 목 둘레를 따라 어깨 위를 넘고, 앞 끝은 쇄골의 브로치에서 옆 뒤로 비스듬히 내려간다
    const layer = artoriaCloth(g, 'bernardo-gold-mantle'), R = 10, C = 20;
    const fold = (t, s) => (0.006 + 0.045 * t) * Math.sin(Math.PI * 4 * s + 0.6);
    const at = (t, s, inset = 0) => {
      const e = 1 - (1 - Math.min(1, t / 0.22)) ** 2, f = fold(t, s) - inset, front = 1.05 + 0.75 * Math.min(1, t / 0.35);
      const y = 0.155 - (0.47 + 0.09 * s + 0.015 * Math.sin(s * 9)) * t;
      return point([y, 0.095 + 0.090 * e + 0.04 * t + f, 0.135 + 0.090 * e + 0.03 * t + f, -0.008], front + (3.45 - front) * s);
    };
    for (const [inset, color] of [[0, GOLD], [0.005, GOLD_IN]]) {
      const p = [], ix = [], cols = [];
      for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) {
        const t = j / R, s = i / C, k = 1 - 0.5 * (0.5 - 0.5 * Math.sin(Math.PI * 4 * s + 0.6)) * Math.min(1, 0.25 + t);
        p.push(...at(t, s, inset));
        cols.push(k, k, k);
        if (j < R && i < C) {
          const q = j * (C + 1) + i;
          ix.push(q, q + 1, q + C + 1, q + 1, q + C + 2, q + C + 1);
        }
      }
      add(layer, [mesh(p, ix, cols)], color, shaded);
    }
    // 두께가 보이게: 어깨 위 접힌 단 · 앞 끝 단 · 아랫단
    add(layer, [
      curve(Array.from({ length: 17 }, (_, i) => at(0, i / 16)), 0.006, 16),
      curve(Array.from({ length: 11 }, (_, i) => at(i / 10, 0)), 0.0035, 12),
      curve(Array.from({ length: 17 }, (_, i) => at(1, i / 16)), 0.0035, 16),
    ], GOLD_IN, cloth);
    // 앞 끝 놋쇠 브로치 (오른쇄골)
    const [bx, by, bz] = at(0.03, 0), psi = Math.atan2(bz, bx);
    add(layer, [cyl(0.016, 0.016, 0.006, 12, false, [bx + 0.004 * Math.cos(psi), by, bz + 0.004 * Math.sin(psi)], [0, -psi, -Math.PI / 2]), ball(0.006, 6, 4, [bx + 0.008 * Math.cos(psi), by, bz + 0.008 * Math.sin(psi)])], BRASS, metal);
  }
  function chest(g) {
    base(g, chestRows.map(([y, d, w, x]) => [y, d - 0.012, w - 0.012, x]), 20);
    // 판금 (이 부위에 바로 붙인 메쉬 = 판금 — 가슴판이 첫 판이라 금(plateCrack)이 이 판의 앞에 붙는다)
    const plate = add(g, [plateShell(chestRows)]);
    plate.name = 'bernardo-breastplate';
    add(plate, [rim(chestRows[0], -Math.PI, Math.PI, 0.0022, 20), rim(chestRows.at(-1), -Math.PI, Math.PI, 0.0022, 16)], EDGE);
    // 천 층 (판금 아님)
    const layer = artoriaCloth(g, 'bernardo-tabard');
    add(layer, [panel(tabardChest), panel(tabardChest, true)], TABARD, cloth);
    // 레온의 사자 — 겉옷 앞판 겉면에 2.5 mm 띄워 굽혀 붙인다 (키 0.145 m · 가슴 아래쪽 — 겨눈 팔뚝 밑으로 보이게)
    const S = 0.145, y0 = -0.125, du = -0.075;
    add(layer, lion().map(poly => {
      const tris = THREE.ShapeUtils.triangulateShape(poly.map(([u, v]) => new THREE.Vector2(u, v)), []);
      return mesh(poly.flatMap(([u, v]) => {
        const y = y0 + v * S, z = (u + du) * S, [, d, w, x0] = rowAt(tabardChest, y);
        return [x0 + d * Math.pow(Math.sqrt(Math.max(0, 1 - (z / w) ** 2)), 0.78) + 0.0025, y, z];
      }), tris.flat());
    }), LION, cloth);
    // 밝은 누빔 깃 띠 — 수염 아래 · 갑옷 위에서 얼굴 테두리가 된다 (세로 누빔 골은 꼭짓점 밝기로)
    const collarRows = [[0.122, 0.112, 0.148, -0.006], [0.140, 0.096, 0.120, -0.006], [0.162, 0.080, 0.094, -0.005], [0.184, 0.068, 0.076, -0.004]];
    add(layer, [shell(collarRows, -Math.PI, Math.PI, 36, (j, i) => (i % 4 < 2 ? 1 : 0.84))], COLLAR, shaded);
    add(layer, [rim(collarRows.at(-1), -Math.PI, Math.PI, 0.005, 24, 4)], 0xb39466, cloth);
    cape(g);
  }
  function shoulder(g) {
    const rows = [[-0.04, 0.088, 0.090, 0], [0.045, 0.096, 0.103, 0], [0.117, 0.072, 0.083, 0], [0.148, 0.031, 0.038, 0], [0.155, 0.004, 0.006, 0]];
    const cap = add(g, [shell(rows)], IRON);
    cap.name = 'bernardo-low-pauldron';
    add(cap, [rim(rows[0])], EDGE);
    for (let i = 0; i < 3; i++) {
      const y = 0.003 - i * 0.041, r = 0.091 - i * 0.008, lame = [[y - 0.045, r - 0.009, r - 0.008, 0], [y, r, r, 0]], o = add(g, [shell(lame)], IRON);
      add(o, [rim(lame[0])], EDGE);
    }
    add(g, [shell([[-0.151, 0.047, 0.048, 0], [-0.109, 0.054, 0.056, 0], [-0.075, 0.061, 0.064, 0]])], IRON);
  }
  // ── 배: 쇠띠 셋(옆에서 보임) · 겉옷 앞판 · 뒤판 ──
  function abdomen(g) {
    base(g, [[-0.082, 0.092, 0.127, 0], [0, 0.088, 0.120, 0], [0.080, 0.099, 0.134, 0]]);
    for (let i = 0; i < 3; i++) {
      const top = 0.082 - i * 0.052, lame = [[top - 0.060, 0.109, 0.141, 0], [top, 0.104, 0.137, 0]], o = add(g, [shell(lame, -Math.PI, Math.PI, 20)]);
      add(o, [rim(lame[0], -Math.PI, Math.PI, 0.0019, 20)], EDGE);
    }
    const tab = [[-0.090, 0.126, 0.152, 0, 0.098], [0.000, 0.124, 0.150, 0, 0.098], [0.075, 0.126, 0.154, 0, 0.100]];
    add(artoriaCloth(g, 'bernardo-tabard'), [panel(tab, false, 6), panel(tab, true, 6)], TABARD, cloth);
  }
  // 사슬: 줄마다 밝기를 번갈아 (고리 줄의 결)
  const mailTint = (j) => (j % 2 ? 0.78 : 1);
  // ── 골반: 사슬 치마 윗단(판금 자리) · 허리띠 · 겉옷 ──
  function pelvis(g) {
    base(g, [[-0.101, 0.100, 0.148, 0], [0.024, 0.100, 0.140, 0], [0.078, 0.093, 0.129, 0]]);
    const ys = [-0.105, -0.078, -0.051, -0.024, 0.003, 0.030, 0.057, 0.085];
    add(g, [shell(ys.map((y, j) => [y, 0.112 - 0.008 * j / 7, 0.160 - 0.020 * j / 7, 0]), -Math.PI, Math.PI, 20, mailTint)], MAIL, mailMat).name = 'bernardo-mail-hips';
    const layer = artoriaCloth(g, 'bernardo-tabard');
    const tab = [[-0.100, 0.116, 0.152, 0, 0.108], [-0.020, 0.122, 0.156, 0, 0.104], [0.090, 0.121, 0.153, 0, 0.100]];
    add(layer, [panel(tab, false, 6), panel(tab, true, 6)], TABARD, cloth);
    add(layer, [shell([[0.052, 0.131, 0.159, 0], [0.088, 0.130, 0.157, 0]], -Math.PI, Math.PI, 20)], LEATHER, { ...cloth, roughness: 0.8 });
    add(layer, [box(0.008, 0.040, 0.034, [0.134, 0.070, -0.022]), box(0.006, 0.026, 0.022, [0.138, 0.070, -0.022])], BRASS, metal);
    add(layer, [box(0.005, 0.070, 0.018, [0.134, 0.030, -0.046], [0.12, 0, 0])], LEATHER, cloth);
  }
  // ── 넓적다리: 어두운 사슬 치마(톱니 아랫단 · 놋쇠 고리) · 무릎 덮개 · 겉옷 자락 앞뒤 ──
  function thigh(g, look, d) {
    const side = Math.sign(d?.pos?.[2] || 1), N = 20;
    const ys = [-0.078, -0.044, -0.010, 0.024, 0.058, 0.092, 0.126, 0.160, 0.215];
    const rows = ys.map((y, j) => { const k = 1 - j / (ys.length - 1); return [y, 0.084 + 0.009 * k, 0.082 + 0.008 * k, 0]; });
    const geo = shell(rows, -Math.PI, Math.PI, N, mailTint), p = geo.attributes.position, hem = [];
    for (let i = 0; i <= N; i++) {
      if (i % 2) p.setY(i, p.getY(i) + 0.011); // 톱니 아랫단
      hem.push([p.getX(i), p.getY(i), p.getZ(i)]);
    }
    geo.computeVertexNormals();
    const mail = add(g, [geo], MAIL, mailMat);
    mail.name = 'bernardo-mail-skirt';
    add(mail, [curve(hem, 0.0026, 40, 3)], BRASS);
    // 무릎 덮개: 앞 반구 + 바깥 날개 — 사슬 치마의 자식(덮은 곳 상자는 사슬 치마 그대로 · 사슬이 다 부서지면 같이 떨어진다)
    const cop = [[-0.240, 0.040, 0.044, 0.012], [-0.215, 0.061, 0.060, 0.014], [-0.180, 0.071, 0.066, 0.012], [-0.140, 0.065, 0.062, 0.006], [-0.108, 0.052, 0.056, 0.002]];
    const kc = add(mail, [shell(cop, -1.35, 1.35, 12), bake(new THREE.SphereGeometry(1, 8, 6), [0.012, -0.172, side * 0.058], [0, side * 0.35, 0], [0.034, 0.030, 0.008])], IRON, { ...metal, steel: 1, roughness: 0.42 });
    kc.name = 'bernardo-knee-cop';
    add(kc, [rim(cop.at(-1), -1.35, 1.35, 0.0026, 12), rim(cop[0], -1.35, 1.35, 0.0024, 12), curve(cop.map(r => [r[3] + r[1] + 0.003, r[0], 0]), 0.0022, 8, 3)], EDGE);
    // 겉옷 자락 (천 층): 앞판 · 뒤판을 다리마다 반쪽씩 — 안쪽 끝이 몸 가운데 줄에서 만나 선 자세에선 한 장의 치마로 보이고, 걸으면 가운데가 갈라진다.
    //  다리를 감싸는 통이면 반바지로 읽혀(사장님 10/23 ③) 평평하게 늘어뜨린다. 아랫단은 사슬 단보다 7 cm 위
    const layer = artoriaCloth(g, 'bernardo-tabard-skirt'), cloths = [], hems = [];
    for (const back of [false, true]) {
      cloths.push(skirtHalf(side, back, [0.215, 0.11, -0.005], 0));
      hems.push(skirtHalf(side, back, [0.008, -0.005], 0.0008));
    }
    add(layer, cloths, TABARD, cloth);
    add(layer, hems, TABARD_HEM, cloth);
  }
  /** 겉옷 자락 반쪽 (넓적다리 좌표 — 다리 가운데가 z 0, 몸 가운데 줄은 z = −side × 0.095) */
  function skirtHalf(side, back, ys, lift) {
    const p = [], ix = [], C = 6;
    ys.forEach((y, j) => {
      const flare = (0.215 - y) / 0.22, z0 = -0.093 * side, z1 = (0.048 + 0.012 * flare) * side;
      for (let i = 0; i <= C; i++) {
        const u = i / C;
        p.push((0.097 + 0.006 * flare + 0.010 * Math.sin(Math.PI * 0.9 * u) - 0.022 * u ** 4 + lift) * (back ? -1 : 1), y, z0 + (z1 - z0) * u); // 바깥 끝은 다리 옆으로 감겨 들어감
        if (j < ys.length - 1 && i < C) {
          const k = j * (C + 1) + i;
          ix.push(k, k + C + 1, k + 1, k + 1, k + C + 1, k + C + 2);
        }
      }
    });
    return mesh(p, ix);
  }
  function shin(g) {
    const rows = [[-0.185, 0.047, 0.043, 0], [-0.09, 0.054, 0.048, 0], [0.070, 0.063, 0.055, 0], [0.150, 0.063, 0.055, 0.002], [0.192, 0.057, 0.050, 0.003]];
    const greave = add(g, [shell(rows)]);
    add(greave, [rim(rows[0]), rim(rows.at(-1)), curve([[0.048, -0.182, 0], [0.060, -0.05, 0], [0.066, 0.150, 0], [0.060, 0.190, 0]], 0.002, 10, 3)], EDGE);
  }
  function forearm(g) {
    const rows = [[-0.127, 0.046, 0.046, 0], [-0.065, 0.047, 0.047, 0], [0.070, 0.059, 0.059, 0], [0.134, 0.060, 0.063, 0]];
    const brace = add(g, [shell(rows)]);
    add(brace, [rim(rows[0]), rim(rows.at(-1)), curve([[0.048, -0.12, 0], [0.051, 0, 0], [0.063, 0.129, 0]], 0.0017, 8, 3)], EDGE);
  }
  function foot(g) {
    const rows = [[-0.034, 0.113, 0.047, 0], [0, 0.127, 0.053, 0], [0.032, 0.090, 0.046, -0.015]];
    base(g, rows.map(([y, d, w, x]) => [y, d - 0.006, w - 0.006, x]));
    const sab = add(g, [shell(rows)]);
    add(sab, [0, 1].map(i => curve([[0.074 + i * 0.022, 0.023, -0.037], [0.079 + i * 0.022, 0.030, 0], [0.074 + i * 0.022, 0.023, 0.037]], 0.0016, 8, 3)), EDGE);
  }
  return {
    armorParts: new Set(['chest', 'abdomen', 'pelvis', 'uarmS', 'uarmO', 'farmS', 'farmO', 'thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']),
    head,
    chest,
    abdomen,
    pelvis,
    uarmS: shoulder,
    uarmO: shoulder,
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
