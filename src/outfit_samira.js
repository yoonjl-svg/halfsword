// 사미라 미르자 v2 — 앙가르카(겹여밈 긴 웃옷) + 추리다르(발목까지 붙는 바지) + 끝이 뾰족한 가죽 장화 (사장님 디자인 리뷰 10/10 21:0x,
//  docs/characters/new_four_review_2026-10-10.md §3). v1(장밋빛 제복 crown_rose_uniform)은 보관 — ?look=samira:v1.
//  사장님 말 "다리가 짧아 보이고 몸통이 넓적해서 여캐 느낌이 반감" → 옷의 선·색만으로:
//   ① 허리선 올림: 가슴 밑(서 있을 때 1.20 m)에 짙은 띠(파트카) — v1 허리띠(1.10 m)보다 10 cm 위. 띠 아래부터 치마 자락이 퍼진다
//   ② 세로 선: 가슴의 겹여밈 선(목 → 옆구리) · 배~골반 앞 가운데 금빛 여밈 선 · 띠 끝 두 가닥이 아래로 · 웃옷 자락 옆트임 금선(허리~무릎)
//   ③ 다리 한 줄: 무릎 위 자락 밑으로 바지·장화가 거의 같은 짙은 색 — v1 의 흰 바지 + 무릎·정강이 검은 띠(다리를 세 도막으로 끊던 가로줄) 없앰
//   ④ 몸통 덜 넓적: 견장·어깨 판·가슴 X 띠·허리 주머니를 뺌, 가슴 겉면을 위(어깨) → 아래(가슴 밑)로 좁힘(아래 82 %), 배는 가슴 밑에서 가장 가늘다
//  겉모습만: 대표 메쉬(상처가 붙는 겉면)는 같은 메쉬·같은 종류·같은 치수 값(geometry.parameters)으로 꼴만 바꾼다 — 몸·질량·관절·충돌체·손 구체 그대로.
//  +X 앞 · +Y 위 · +Z 오른쪽 (부위 좌표). 머리는 v1 과 같다(roseUniformHead — 높이 묶은 땋은 머리).
//  v3 (opts.v3, 사장님 10/10 23:5x '빨강 단일톤 — 흰 악세서리·디테일로 포인트, 치마 조금 더 짧게'): 왼어깨에 걸쳐 앞뒤로 늘어뜨린 흰 두파타 ·
//   흰 선 깃 · 자락 옷단 위 흰 수 띠 · 소매 끝 흰 띠 · 흰 팔찌 둘 · 진주 귀걸이 · 자락 5 cm 짧게(옷단 0.585 → 0.635 m). 다리는 v2 그대로 짙게.
export function createSamiraOutfit(h, opts = {}) {
  const V3 = !!opts.v3 || !!opts.v4;
  // v4 (opts.v4, 사장님 10/11 00:4x '상체를 슬림하게 해선지 종종 팔이 상체와 떨어져 움직이는 모습이 나와'): v3 그대로 + 어깨만 되돌림 —
  //  가슴 위끝 앞뒤 폭 0.315 → 0.34 m(가슴 밑 폭은 v2·v3 와 같은 0.252 m 로 두어 허리 가늘기 그대로) · 처진 어깨 4 → 1.5 cm ·
  //  어깨 관절 자리(가슴 좌표 0, 0.10, ±0.2)에 몸판 색 둥근 어깨(삼각근) — 팔이 어느 쪽으로 돌아도 관절 둘레를 덮어 틈이 안 보인다. 소매도 v1 굵기(0.92 → 0.98)로
  const V4 = !!opts.v4;
  const WHITE = 0xefece4; // v3 흰 포인트 (두파타·수 띠·팔찌) — 순백 대신 아주 옅은 상아
  const { THREE, bake, box, cyl, ball, addMerged, CLOTH, artoriaCloth, sleeveVolume, clothNeck, taperedTube, reshapeMain, roseUniformHead } = h;
  const CRIMSON = 0x922e40; // v1 장밋빛 제복과 같은 색 — 인물 색은 그대로
  const CRIMSON_DEEP = 0x6e2131; // 겹친 자락 그늘
  const GOLD = 0xb39a5f; // 가라앉은 금빛 단(밝은 금 대신 — 우리 세계의 차분한 색)
  const SASH = 0x33232c; // 가슴 밑 띠 — 짙은 자두색
  const LEG = 0x2c2530; // 추리다르(바지)
  const BOOT = 0x231d25; // 장화 — 바지와 거의 같은 색(다리 한 줄)
  const SEAL = 0x8a1f27; // 붉은 봉인(칭호 '붉은 봉인의 전령')
  const fabric = (g) => artoriaCloth(g, 'samira-fabric');
  const DS = { ...CLOTH, side: THREE.DoubleSide };

  /** 둥근 상자(세분 많게): 아래로 갈수록 taperBottom 배 · 가슴 볼륨 bust */
  function softBox(w, hgt, d, radius, taperBottom = 1, seg = 8) {
    const geo = new THREE.BoxGeometry(w, hgt, d, seg, seg, seg), p = geo.attributes.position;
    const core = new THREE.Vector3(w / 2 - radius, hgt / 2 - radius, d / 2 - radius);
    const v = new THREE.Vector3(), near = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      near.set(THREE.MathUtils.clamp(v.x, -core.x, core.x), THREE.MathUtils.clamp(v.y, -core.y, core.y), THREE.MathUtils.clamp(v.z, -core.z, core.z));
      v.sub(near).normalize().multiplyScalar(radius).add(near);
      const s = THREE.MathUtils.lerp(taperBottom, 1, (v.y + hgt / 2) / hgt);
      p.setXYZ(i, v.x * s, v.y, v.z * s);
    }
    return geo;
  }
  /** 몸통 대표 메쉬를 다시 깎되 숨긴 기본 장식(누빔 줄·옷깃·허리띠)은 지우지 않고 감춘다 (v1 과 같은 방식) */
  function torsoMain(g, geo) {
    const main = g.children[0];
    reshapeMain(main, geo);
    main.material.color.setHex(CRIMSON); main.material.roughness = 0.9; main.material.metalness = 0;
    for (const extra of g.children.slice(1)) if (extra !== main) extra.visible = false;
    return main;
  }
  const line = (g, pts, color, r = 0.0022) => addMerged(fabric(g), [taperedTube(pts, pts.map(() => r), pts.length * 6, 5)], color, CLOTH);
  // v3 흰 두파타(숄): 왼어깨(−z)에 걸쳐 앞·뒤로 늘어진 넓은 천 한 장. 가슴 도막은 어깨를 넘는 한 가닥, 배·골반 도막은 앞뒤 두 가닥으로 이어 받는다
  const DUP_W = 0.066;
  function dupatta(g, front, back, overShoulder, yTop = 0.08, yBot = -0.08, zTop = -0.085, zBot = -0.078, ends = false) {
    const pieces = [];
    if (overShoulder) {
      const pts = [[front(-0.14, -0.08) + 0.008, -0.14, -0.08], [front(-0.06, -0.09) + 0.008, -0.06, -0.09], [front(0.03, -0.105) + 0.008, 0.03, -0.105],
        [0.1, 0.1, -0.125], [0.03, 0.135, -0.138], [-0.05, 0.13, -0.138], [-0.104, 0.07, -0.128],
        [back(0.0) - 0.006, 0.0, -0.118], [back(-0.14) - 0.006, -0.14, -0.108]];
      pieces.push(h.isoldeLock(pts, Array(pts.length).fill(DUP_W), 0.004));
    } else {
      const f = [0, 0.5, 1].map((u) => { const y = yTop + (yBot - yTop) * u, z = zTop + (zBot - zTop) * u; return [front(y) + 0.008, y, z]; });
      const b = [0, 0.5, 1].map((u) => { const y = yTop + (yBot - yTop) * u, z = zTop - 0.03 + (zBot - zTop) * u; return [back(y) - 0.008, y, z]; });
      pieces.push(h.isoldeLock(f, [DUP_W, DUP_W, DUP_W * 0.96], 0.004), h.isoldeLock(b, [DUP_W, DUP_W, DUP_W * 0.96], 0.004));
      if (ends) for (const [x, y, z] of [f[2], b[2]]) for (const dz of [-0.02, 0, 0.02]) pieces.push(cyl(0.004, 0.006, 0.02, 6, false, [x, y - 0.012, z + dz]));
    }
    addMerged(fabric(g), pieces, WHITE, DS).name = 'samira-dupatta';
    if (overShoulder) line(g, [[front(-0.14, -0.08) + 0.011, -0.14, -0.08 + DUP_W / 2], [front(-0.06, -0.09) + 0.011, -0.06, -0.09 + DUP_W / 2], [front(0.03, -0.105) + 0.011, 0.03, -0.105 + DUP_W / 2]], GOLD, 0.0016);
  }

  // ── 가슴: 위(어깨) → 아래(가슴 밑)로 좁아지는 몸판 + 겹여밈 선 + 낮은 선 깃 + 가슴 밑 띠 ──
  const CH_W = 0.22, CH_H = 0.28, CH_D = V4 ? 0.34 : 0.315, CH_TAPER = V4 ? 0.252 / 0.34 : 0.8;
  const chS = (y) => THREE.MathUtils.lerp(CH_TAPER, 1, (y + CH_H / 2) / CH_H);
  const bust = (y, z) => Math.exp(-Math.pow((y - 0.012) / 0.07, 2) - Math.pow((Math.abs(z) - 0.068) / 0.058, 2));
  const chestFront = (y, z) => (CH_W / 2) * chS(y) + bust(y, z) * 0.016 + 0.003; // 몸판 앞면 x (가운데 쪽 |z| < 0.11 에서)
  function chest(g, look) {
    const geo = softBox(CH_W, CH_H, CH_D, 0.06, CH_TAPER), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (p.getX(i) > 0.02) p.setX(i, p.getX(i) + bust(p.getY(i), p.getZ(i)) * 0.016);
      // 처진 어깨선: 목 옆에서 어깨 끝으로 위끝을 낮춘다(위로 갈수록) — 네모난 어깨 모서리가 덜 넓적해 보이게
      const y = p.getY(i), up = THREE.MathUtils.smoothstep(y, 0.03, 0.14), out = Math.max(0, (Math.abs(p.getZ(i)) - 0.05) / 0.11);
      p.setY(i, y - (V4 ? 0.015 : 0.04) * up * Math.pow(out, 1.4));
    }
    geo.computeVertexNormals();
    torsoMain(g, geo);
    clothNeck(g, look);
    if (V4) {
      // 둥근 어깨: 관절 중심에 두어 위팔이 앞·위·옆으로 돌아도 위팔 뿌리와 몸판 사이를 메운다(겉모습만, 충돌체 아님)
      addMerged(fabric(g), [-1, 1].map((s) => bake(new THREE.SphereGeometry(0.056, 16, 12), [0, 0.1, s * 0.192], null, [1, 0.92, 1])), CRIMSON, { ...CLOTH, roughness: 0.9 });
    }
    // 낮은 선 깃(반다갈라) + 금빛 테
    addMerged(fabric(g), [cyl(0.055, 0.062, 0.034, 18, true, [0, 0.163, 0])], V3 ? WHITE : CRIMSON, DS);
    addMerged(fabric(g), [cyl(0.0555, 0.0555, 0.004, 18, true, [0, 0.181, 0])], GOLD, CLOTH);
    // 앙가르카 겹여밈: 목 왼쪽에서 오른쪽 옆구리로 휘어 내려가는 자락 끝 — 겹친 자락(짙은 그늘 면) + 금빛 단
    const edge = [[0.165, -0.03], [0.12, 0.0], [0.06, 0.04], [0.0, 0.075], [-0.06, 0.098], [-0.12, 0.108]];
    const flap = [];
    for (let i = 0; i < edge.length - 1; i++) {
      const [y0, z0] = edge[i], [y1, z1] = edge[i + 1];
      // 여밈선 오른쪽(+z)으로 2.2 cm 너비의 겹친 천 띠 — 몸판 앞면에 얹는다
      const quad = [[y0, z0], [y1, z1], [y1, z1 + 0.022], [y0, z0 + 0.022]];
      const pos = [], idx = [0, 1, 2, 0, 2, 3];
      for (const [y, z] of quad) pos.push(chestFront(y, z) + 0.001, y, z);
      const piece = new THREE.BufferGeometry();
      piece.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      piece.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
      piece.setIndex(idx); piece.computeVertexNormals(); flap.push(piece);
    }
    addMerged(fabric(g), flap, CRIMSON_DEEP, DS);
    line(g, edge.map(([y, z]) => [chestFront(y, z) + 0.003, y, z]), GOLD, 0.0026);
    // 옆구리 매듭 끈 두 쌍 (앙가르카는 옆에서 끈으로 여민다)
    const tieAt = [[-0.07, 0.102], [-0.112, 0.11]];
    addMerged(fabric(g), tieAt.map(([y, z]) => ball(0.006, 8, 6, [chestFront(y, z) + 0.004, y, z])), GOLD, CLOTH);
    addMerged(fabric(g), tieAt.flatMap(([y, z]) => [-1, 1].map((s) =>
      taperedTube([[chestFront(y, z) + 0.004, y, z], [chestFront(y, z) + 0.006, y - 0.02, z + s * 0.006], [chestFront(y, z) + 0.006, y - 0.038, z + s * 0.008]], [0.0018, 0.0016, 0.0012], 10, 4))), GOLD, CLOTH);
    if (V3) dupatta(g, (y, z) => chestFront(y, z), (y) => -(CH_W / 2) * chS(y) - 0.004, true);
    // 어깨 솔기(세로로 읽히는 가는 선만 — 견장 없음)
    for (const s of [-1, 1]) line(g, [[0.06, 0.138, s * 0.15], [0.0, 0.142, s * 0.158], [-0.06, 0.138, s * 0.15]], CRIMSON_DEEP, 0.0018);
  }

  // ── 배(1.06~1.20 m): 가슴 밑 띠 바로 아래가 가장 가늘고 엉덩이로 퍼진다. 앞 가운데 금빛 여밈 선 + 띠 매듭·봉인 ──
  const AB_W = 0.19, AB_H = 0.16, AB_D = 0.265, AB_FLARE = 1.12;
  const abFront = (y) => (AB_W / 2) * THREE.MathUtils.lerp(AB_FLARE, 1, (y + AB_H / 2) / AB_H) + 0.003;
  function abdomen(g) {
    torsoMain(g, softBox(AB_W, AB_H, AB_D, 0.04, AB_FLARE));
    // 가슴 밑 띠(서 있을 때 1.20 m 언저리): 배 도막 위끝. 가슴 도막 아래끝과 겹쳐 등뼈가 휘어도 틈이 안 보인다
    const sashY = 0.066;
    const band = new THREE.CylinderGeometry(1, 1, 0.034, 32, 1, true); band.scale(0.1, 1, 0.137); band.translate(0, sashY, 0);
    addMerged(fabric(g), [band], SASH, DS);
    const rims = [sashY + 0.018, sashY - 0.018].map((y) => { const r = new THREE.CylinderGeometry(1, 1, 0.003, 32, 1, true); r.scale(0.1015, 1, 0.1385); r.translate(0, y, 0); return r; });
    addMerged(fabric(g), rims, GOLD, DS);
    // 매듭 + 붉은 봉인(금테) — 앞 가운데에서 조금 오른쪽
    const kz = 0.045;
    addMerged(fabric(g), [bake(new THREE.SphereGeometry(0.017, 10, 8), [0.102, sashY, kz], null, [0.6, 1, 1.15])], SASH, CLOTH);
    addMerged(fabric(g), [cyl(0.015, 0.015, 0.006, 16, false, [0.115, sashY, kz], [0, 0, Math.PI / 2])], SEAL, { roughness: 0.55, metalness: 0 });
    addMerged(fabric(g), [cyl(0.017, 0.017, 0.004, 16, true, [0.114, sashY, kz], [0, 0, Math.PI / 2])], GOLD, { ...DS, roughness: 0.6, metalness: 0.2 });
    // 띠 끝 두 가닥: 매듭에서 아래로 (골반 도막이 이어 받는다)
    for (const dz of [-0.008, 0.012]) addMerged(fabric(g), [taperedTube([[0.105, sashY - 0.01, kz + dz], [abFront(0) + 0.006, 0, kz + dz * 1.4], [abFront(-0.08) + 0.007, -0.08, kz + dz * 1.8]], [0.009, 0.0085, 0.0085], 12, 4)], SASH, CLOTH);
    // 앞 가운데 여밈 선(금) — 띠 아래부터 골반으로 이어진다
    line(g, [[abFront(0.045), 0.045, -0.004], [abFront(-0.02), -0.02, -0.004], [abFront(-0.082), -0.082, -0.004]], GOLD);
    if (V3) dupatta(g, abFront, (y) => -abFront(y), false, 0.085, -0.082, -0.08, -0.077);
  }

  // ── 골반: 웃옷 자락 윗단(서 있을 때 1.06 → 0.80 m, 엉덩이에서 살짝 퍼짐) + 앞 가운데 금선 + 띠 끝 ──
  function pelvis(g) {
    torsoMain(g, softBox(0.19, 0.17, 0.28, 0.045, 1.06));
    const rows = 5, sides = 40, top = 0.086, bot = -0.17;
    const geo = new THREE.CylinderGeometry(1, 1, top - bot, sides, rows, true), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (top - (p.getY(i) + (top + bot) / 2)) / (top - bot); // 0 위 → 1 아래
      const a = Math.atan2(p.getZ(i), p.getX(i));
      const rx = 0.1 + t * 0.046, rz = 0.142 + t * 0.055, fold = 1 + t * 0.022 * Math.cos(a * 12);
      p.setXYZ(i, p.getX(i) * rx * fold, p.getY(i) + (top + bot) / 2, p.getZ(i) * rz * fold);
    }
    geo.computeVertexNormals();
    addMerged(fabric(g), [geo], CRIMSON, DS).name = 'samira-peplum';
    const fx = (y) => { const t = (top - y) / (top - bot); return (0.1 + t * 0.046) * (1 + t * 0.022) + 0.003; };
    line(g, [[fx(0.08), 0.08, -0.004], [fx(-0.04), -0.04, -0.004], [fx(-0.165), -0.165, -0.004]], GOLD);
    const kz = 0.045;
    for (const dz of [-0.008, 0.012]) addMerged(fabric(g), [taperedTube([[fx(0.085) + 0.004, 0.085, kz + dz * 1.8], [fx(-0.03) + 0.006, -0.03, kz + dz * 2.1], [fx(-0.12) + 0.007, -0.12, kz + dz * 2.3]], [0.0085, 0.0082, 0.008], 12, 4)], SASH, CLOTH);
    addMerged(fabric(g), [-0.008, 0.012].map((dz) => cyl(0.0095, 0.012, 0.022, 8, false, [fx(-0.13) + 0.007, -0.13, kz + dz * 2.3])), GOLD, CLOTH); // 띠 끝 술
    if (V3) dupatta(g, fx, (y) => -fx(y), false, 0.086, -0.16, -0.077, -0.072, true); // 두파타 끝: 엉덩이 아래(서 있을 때 0.81 m)에서 술
  }

  // ── 허벅지: 웃옷 자락(무릎 위까지, 옆트임) — 다리마다 한 쪽. 트임 가장자리·옷단에 금선 ──
  //  서 있을 때 0.92 → 0.585 m(무릎 위 한 뼘). 옆(바깥) 40° 를 비워 트임 사이로 짙은 바지가 보인다 — 허리에서 무릎까지 세로 선
  function thigh(g, look, d) {
    const side = Math.sign(d?.pos?.[2] || 1);
    const main = g.children[0];
    // 바지 허벅지: 무릎 쪽으로 가늘어지고 끝 반구를 늘여 정강이와 겹친다 (무릎이 구슬처럼 끊겨 보이지 않게)
    limb(main, (t) => 1.02 - t * 0.2, 1, 1.5);
    main.material.color.setHex(LEG); main.material.roughness = 0.9;
    const top = 0.205, bot = V3 ? -0.08 : -0.13, rt = 0.098, rb = V3 ? 0.121 : 0.128, slit = 0.4; // 트임 반각(rad) · v3 자락 5 cm 짧게
    const t0 = (side > 0 ? 0 : Math.PI) + slit, span = Math.PI * 2 - slit * 2;
    const geo = new THREE.CylinderGeometry(rt, rb, top - bot, 30, 4, true, t0, span), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = Math.atan2(p.getX(i), p.getZ(i)), fold = 1 + 0.03 * Math.cos(a * 7) * ((top - (p.getY(i) + (top + bot) / 2)) / (top - bot));
      p.setXYZ(i, p.getX(i) * fold * 1.05, p.getY(i) + (top + bot) / 2, p.getZ(i) * fold);
    }
    geo.computeVertexNormals();
    addMerged(fabric(g), [geo], CRIMSON, DS).name = 'samira-kurta';
    // 트임 가장자리 금선 두 줄 (위 → 옷단)
    const edgePts = (theta) => [0, 0.5, 1].map((u) => {
      const y = top - u * (top - bot), r = rt + u * (rb - rt) + 0.002;
      return [Math.sin(theta) * r * 1.05, y, Math.cos(theta) * r];
    });
    for (const th of [t0, t0 + span]) line(g, edgePts(th), GOLD, 0.002);
    // 옷단 금선 (트임 사이는 비움)
    const hem = new THREE.CylinderGeometry(rb + 0.002, rb + 0.002, 0.006, 30, 1, true, t0, span);
    hem.scale(1.05, 1, 1); hem.translate(0, bot + 0.004, 0);
    addMerged(fabric(g), [hem], GOLD, DS);
    if (V3) {
      // 옷단 위 흰 수 띠(1.6 cm) — 자락 끝을 밝게 끊어 다리(짙은 색)와 갈린다
      const band = new THREE.CylinderGeometry(rb + 0.0025, rb + 0.0018, 0.016, 30, 1, true, t0, span);
      band.scale(1.05, 1, 1); band.translate(0, bot + 0.017, 0);
      addMerged(fabric(g), [band], WHITE, DS);
    }
  }
  // ── 정강이: 추리다르(발목으로 가늘게, 발목 위 잔주름 두 겹) + 장화 목 ──
  /** 팔다리 대표 메쉬를 같은 치수 캡슐로 다시 만들고 길이 방향 t(0 위 → 1 아래)마다 굵기 배율, 끝 반구 늘임 */
  function limb(main, profile, capTop = 1, capBottom = 1) {
    const { radius, height } = main.geometry.parameters;
    const geo = new THREE.CapsuleGeometry(radius, height, 6, 16), p = geo.attributes.position;
    geo.computeBoundingBox();
    const min = geo.boundingBox.min.y, max = geo.boundingBox.max.y, hh = height / 2;
    for (let i = 0; i < p.count; i++) {
      const t = (max - p.getY(i)) / (max - min);
      let y = p.getY(i);
      if (y > hh) y = hh + (y - hh) * capTop; else if (y < -hh) y = -hh + (y + hh) * capBottom;
      const s = profile(t);
      p.setXYZ(i, p.getX(i) * s, y, p.getZ(i) * s * 0.96);
    }
    geo.computeVertexNormals();
    reshapeMain(main, geo);
  }
  function shin(g) {
    const main = g.children[0];
    // 추리다르: 무릎(허벅지 끝 굵기에 맞춤) → 종아리 → 발목으로 가늘게
    limb(main, (t) => (t < 0.3 ? 1.06 - t * 0.1 : 1.03 - (t - 0.3) * 0.5), 1.4, 1);
    main.material.color.setHex(LEG); main.material.roughness = 0.9;
    // 장화 목: 발목 ~ 종아리 아래 (바지와 거의 같은 색 — 가로 띠로 읽히지 않게 윗단만 아주 얇게)
    addMerged(fabric(g), [cyl(0.047, 0.043, 0.13, 16, true, [0, -0.15, 0])], BOOT, { ...DS, roughness: 0.6 });
    addMerged(fabric(g), [cyl(0.0475, 0.0475, 0.004, 16, true, [0, -0.086, 0])], 0x3a2f38, CLOTH);
  }
  // ── 발: 코가 가늘고 살짝 들린 가죽 장화(주티 결) — 발끝이 길어 보인다 ──
  function foot(g) {
    const main = g.children[0], { width, height, depth } = main.geometry.parameters;
    const geo = new THREE.BoxGeometry(width, height, depth, 10, 3, 4), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const u = Math.max(0, x / (width / 2)); // 0 가운데 → 1 발끝
      const back = Math.max(0, -x / (width / 2));
      const zs = 1 - 0.62 * Math.pow(u, 1.6) - 0.12 * Math.pow(back, 3);
      const yTop = y > 0 ? 1 - 0.55 * Math.pow(u, 1.3) : 1;
      const lift = Math.pow(u, 4) * 0.012; // 발끝이 조금 들림
      p.setXYZ(i, x + Math.pow(u, 2) * 0.012, y * yTop + lift, z * zs);
    }
    geo.computeVertexNormals();
    reshapeMain(main, geo);
    main.material.color.setHex(BOOT); main.material.roughness = 0.55;
    addMerged(fabric(g), [box(0.2, 0.01, 0.09, [-0.012, -0.034, 0])], 0x1a161c, CLOTH); // 밑창
  }
  // ── 팔: 붙는 긴 소매 + 손목 금빛 단 ──
  function upperArm(g) {
    const m = g.children[0].material; m.color.setHex(CRIMSON); m.roughness = 0.9; m.metalness = 0;
    sleeveVolume(g, V4 ? 0.98 : 0.92, V4 ? 0.94 : 0.9);
  }
  function forearm(g) {
    const m = g.children[0].material; m.color.setHex(CRIMSON); m.roughness = 0.9; m.metalness = 0;
    sleeveVolume(g, 0.92, 0.86);
    addMerged(fabric(g), [cyl(0.0415, 0.0425, 0.016, 16, true, [0, -0.088, 0])], GOLD, DS);
    addMerged(fabric(g), [cyl(0.04, 0.041, 0.008, 16, true, [0, -0.074, 0])], V3 ? WHITE : CRIMSON_DEEP, DS);
    if (V3) {
      addMerged(fabric(g), [cyl(0.0405, 0.0415, 0.012, 16, true, [0, -0.072, 0])], WHITE, DS); // 소매 끝 흰 띠
      // 흰 팔찌 둘 (손목, 손 구체 위)
      addMerged(fabric(g), [-0.101, -0.109].map((y) => bake(new THREE.TorusGeometry(0.035, 0.0032, 6, 20), [0, y, 0], [Math.PI / 2, 0, 0])), WHITE, { roughness: 0.45, metalness: 0 });
    }
  }
  function head(g, look) {
    roseUniformHead(g, look);
    if (!V3) return;
    // 진주 귀걸이: 귓불 아래 작은 흰 구슬 + 금 고리
    addMerged(g, [-1, 1].map((s) => ball(0.0068, 10, 8, [-0.006, -0.036, s * 0.098])), WHITE, { roughness: 0.35, metalness: 0 });
    addMerged(g, [-1, 1].map((s) => bake(new THREE.TorusGeometry(0.0045, 0.0012, 4, 10), [-0.006, -0.026, s * 0.097], [0, 0, 0])), GOLD, { roughness: 0.5, metalness: 0.3 });
  }
  return {
    head,
    chest, abdomen, pelvis,
    uarmS: upperArm, uarmO: upperArm,
    farmS: forearm, farmO: forearm,
    thighF: thigh, thighB: thigh,
    shinF: shin, shinB: shin,
    footF: foot, footB: foot,
  };
}
