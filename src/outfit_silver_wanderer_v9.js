// 다라이시 v9 — 겉모습 v7 과 v8 의 절충 (look.daraishiRevision 9, 우리 판).
//  사장님 10/14 13:4x "원래가 더 보랏빛도 많고 장식적이고 아름다운 거 같애. 현재와 원래의 절충점 찾아봐. 이 캐릭터는 복식 고증에 집착할 필요 없어."
//  · v8 에서 지킨 것: 한 벌로 읽히는 카바의 길이와 겹침 — 가슴 사선에서 몸 가운데 2 cm 오른쪽으로 곧게 내려가는 앞섶 선 · 앞뒤·좌우 같은
//    종아리 중간(0.30 m) 옷단 · 옆트임 · 자락 꼴과 스키닝(outfit_silver_wanderer_qaba.js 그대로) · 허리 천 띠(캄마르반드) · 바지·장화 · 검집 자리
//  · v7 에서 되살린 것: ① 보랏빛을 넓게 — 겉감(가슴·배·엉덩이·자락)과 위 소매를 보라로, 흰색은 안옷(가슴 V · 아래 소매 · 바지)과 포인트로
//    ② 장식 — 폰 결투 거리에서 보이는 굵기(금빛 선 1.0~1.5 cm · 띠 1.8~4.4 cm · 꽃 3.2 cm): 옷단·앞섶 테는 금빛 선 두 줄 사이 짙은 보라 띠,
//    옷단 띠 위에 금빛 덩굴 물결과 팔각 꽃(금)·마름모(은) · 망토 단·깃 앞 가장자리·깃 윗단 금빛 띠 · 위 소매 끝 띠 · 허리 띠 금빛 가장자리와
//    띠 끝 금빛 술 · 장화 목 금빛 고리. v6 의 1~2 mm 잔선(관 반지름 0.8~2.8 mm)은 여전히 만들지 않는다 — 가장 가는 것이 덩굴 물결 9 mm
//  · 자락의 테·문양은 겉감과 함께 꼭짓점 색 한 장으로 칠해 스키닝한다(다리마다 그리기 하나 — v8 은 둘). 다른 부위의 장식도 부위마다 꼭짓점 색 한 메쉬
//  · 겉모습만: 몸·질량·관절·충돌체·손 구체 그대로(물리 해시 같음). 값은 모두 사장님 확인 전(docs/strike/owner_defaults_table.md 1320~)
//  +X 앞 · +Y 위 · +Z 오른쪽 (부위 좌표). 자락 높이는 서 있을 때 세계 높이(qaba 모듈과 같다)
import { createDaraishiQaba } from './outfit_silver_wanderer_qaba.js';

/** v9 색 — 겉감은 v7 자락 보라(#665976)보다 조금 맑고 밝게, 망토(#433653)와 명도가 갈리게 */
export const DARAISHI_V9 = {
  coat: 0x66528a, // 겉감 보라 (L* 약 39 · 망토 25)
  band: 0x34263f, // 테 바탕 짙은 보라 (L* 약 17)
  gold: 0xcfb57b, // 옅은 금빛 — 선·덩굴·팔각 꽃 (L* 약 74)
  silver: 0xd8d6e0, // 은빛 — 마름모·꽃술
  inner: 0xe9e9e5, // 안옷 흰색 (v7·v8 흰 셔츠와 같은 색)
  trouser: 0xdddae2, // 바지 — 안옷 흰빛 (보라 겉감 아래 v7 처럼 흰 바지)
  sash: 0x2f2338, // 캄마르반드 — 망토보다 짙은 가지색
  mantle: 0x433653, // 망토·선 깃·위 소매 어깨 덮개 (v1~v8 PURPLE 그대로)
};

/** 테·문양 조각 도구 — v9 와 v10(outfit_silver_wanderer_v10.js 의 아래 자락)이 같이 쓴다. 꼭짓점 색 칠하기 · 판 · 팔각 꽃 · 마름모 · 팔각형 · 옷단 띠 문양 */
export function daraishiOrnaments(THREE) {
  const C = DARAISHI_V9;
  const paintHex = (geo, hex) => {
    const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(a, i * 3);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(a, 3));
    return geo;
  };
  /** 2D 다각형(평면 좌표 [u, v])을 surface(u, v) → [x, y, z] 로 붙인 판 — 볼록하지 않아도 된다 */
  function panel(points, surface) {
    const idx = THREE.ShapeUtils.triangulateShape(points.map(([u, v]) => new THREE.Vector2(u, v)), []).flat();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(points.flatMap(([u, v]) => surface(u, v)), 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(points.flat(), 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  /** 팔각 꽃 (별 끝 8 · 안쪽 반지름 0.55) — 가운데 점에서 부채꼴로 */
  function rosette(surface, R) {
    const pos = [...surface(0, 0)], uv = [0.5, 0.5], idx = [];
    for (let k = 0; k < 16; k++) {
      const a = (k * Math.PI) / 8, r = k % 2 ? R * 0.55 : R;
      pos.push(...surface(Math.cos(a) * r, Math.sin(a) * r)); uv.push(0.5 + Math.cos(a) / 2, 0.5 + Math.sin(a) / 2);
      idx.push(0, 1 + k, 1 + ((k + 1) % 16));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  const lozenge = (surface, hu, hv) => panel([[hu, 0], [0, hv], [-hu, 0], [0, -hv]], surface);
  const octagon = (surface, r) => panel(Array.from({ length: 8 }, (_, k) => [Math.cos((k * Math.PI) / 4) * r, Math.sin((k * Math.PI) / 4) * r]), surface);
  /**
   * 옷단 띠 문양: 가운데 높이 yc 에서 각 s0 → s1 사이에 금빛 덩굴 물결(폭 9 mm · 진폭 9 mm — 꽃 자리마다 가운데 선을 지남)과
   *  금빛 팔각 꽃(지름 3.2 cm · 꽃술 짙은 보라)·은 마름모를 번갈아 약 6.8 cm 마다(조각마다 고르게 나눔). [조각, 색] 을 out 에 넣는다.
   *  P(a, y, mm) = 겉면에서 mm 띄운 점(자세 좌표) · rAt(a) = 그 높이 단면의 반지름 (각 너비 = 길이 ÷ 반지름)
   */
  function hemOrnament(P, rAt, s0, s1, yc, out) {
    // 각 → 겉면 길이 표 (가운데 높이에서)
    const n = 64, as = [], ss = [0];
    let prev = P(s0, yc, 0);
    for (let i = 0; i <= n; i++) {
      const a = s0 + ((s1 - s0) * i) / n; as.push(a);
      if (i) { const p = P(a, yc, 0); ss.push(ss[i - 1] + Math.hypot(p[0] - prev[0], p[2] - prev[2])); prev = p; }
    }
    const len = ss[n];
    const angleAt = (s) => {
      let i = 1;
      while (i < n && ss[i] < s) i++;
      const u = (s - ss[i - 1]) / Math.max(1e-9, ss[i] - ss[i - 1]);
      return as[i - 1] + (as[i] - as[i - 1]) * THREE.MathUtils.clamp(u, 0, 1);
    };
    const count = Math.max(2, Math.round(len / 0.068)), step = len / count;
    // 덩굴: 0 → len 을 칸 2.2 cm 안팎으로, 법선 쪽으로 ±4.5 mm
    const A = 0.009, W = 0.009, k = Math.PI / step, cells = Math.max(8, Math.round(len / 0.022));
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= cells; i++) {
      const s = (len * i) / cells, ph = k * (s - step / 2);
      const dv = A * Math.sin(ph), slope = A * k * Math.cos(ph), nl = Math.hypot(1, slope);
      for (const sgn of [-1, 1]) {
        const ds = (-slope / nl) * (W / 2) * sgn, dvv = (1 / nl) * (W / 2) * sgn;
        pos.push(...P(angleAt(THREE.MathUtils.clamp(s + ds, 0, len)), yc + dv + dvv, 5)); uv.push(i / cells, (sgn + 1) / 2);
      }
      if (i < cells) { const m = i * 2; idx.push(m, m + 2, m + 1, m + 1, m + 2, m + 3); }
    }
    const vine = new THREE.BufferGeometry();
    vine.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    vine.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    vine.setIndex(idx); vine.computeVertexNormals();
    out.push([vine, C.gold]);
    for (let i = 0; i < count; i++) {
      const s = step * (i + 0.5), a = angleAt(s), r = rAt(a);
      const at = (mm) => (u, v) => P(a + u / r, yc + v, mm);
      if (i % 2 === 0) {
        out.push([rosette(at(5.8), 0.016), C.gold]);
        out.push([octagon(at(6.4), 0.0058), C.band]);
      } else out.push([lozenge(at(5.8), 0.013, 0.009), C.silver]);
    }
  }
  return { paintHex, panel, rosette, lozenge, octagon, hemOrnament };
}

export function createDaraishiV9(h) {
  const { THREE, addMerged, CLOTH, artoriaCloth, hangingClothShading } = h;
  const C = DARAISHI_V9;
  const thread = { ...CLOTH, metalness: 0.12, roughness: 0.73, side: THREE.DoubleSide, vertexColors: true };
  const layer = (g) => artoriaCloth(g, 'silver-wanderer-v9');
  const { paintHex, panel, lozenge, hemOrnament } = daraishiOrnaments(THREE); // 판·마름모·옷단 띠 문양 (v10 아래 자락과 같이 쓴다)
  /** [조각, 색] 목록을 칠해 부위 장식 층에 한 메쉬로 (꼭짓점 색 — 색이 여럿이어도 그리기 하나) */
  const addPainted = (g, pieces, opts = thread) => addMerged(layer(g), pieces.map(([geo, hex]) => paintHex(geo, hex)), 0xffffff, opts);

  // ════════ 자락 (다리마다 한 장 — qaba 모듈 leg 가 부른다. 좌표는 골반 기준 자세 좌표) ════════
  //  옷단 테(아래부터): 금빛 선 1.2 cm · 짙은 보라 띠 4.4 cm(덩굴 물결 + 팔각 꽃·마름모) · 금빛 선 1.2 cm — 모두 6.8 cm
  //  앞섶 테(가장자리부터): 금빛 선 1.1 cm · 짙은 보라 띠 2.8 cm(은 마름모) · 금빛 선 1.1 cm — 모두 5.0 cm, 옷단 테 윗선에서 멈춰 액자처럼 만난다
  //  트임 테: 양쪽 금빛 선 1.5 cm. 겉면에서 띄우는 높이: 띠 바탕 3 mm · 금빛 선 4.5 mm · 덩굴 5 mm · 꽃 5.8 mm · 꽃술 6.4 mm
  //  (폰 결투 거리 — 상대 키가 화면 약 110 css px, 1 css px ≈ 1.6 cm: 옷단 테 ≈ 4 css px · 앞섶 테 ≈ 3 css px · 금빛 선 ≈ 0.7 css px(화면 배율 2 에서 1.5 화소) · 꽃 ≈ 2 css px)
  const HEM_W = 0.068, HEM_LINE = 0.012, FRONT_W = 0.05, FRONT_LINE = 0.011, SLIT_LINE = 0.015;
  const CHEST_W = 0.038, CHEST_LINE = 0.010; // 가슴·배 앞섶 테: 금빛 선 1.0 cm · 짙은 보라 띠 1.8 cm · 금빛 선 1.0 cm
  function legDress(api, { info, fF, fB, slitF, slitB, segs }) {
    const { strip, section, lineAt, radiusAt, COAT_ROWS, HEM_Y, SLIT_TOP, HIP_Y } = api;
    const lift = (mm) => (y) => 1 + mm / 1000 / lineAt(y).rx;
    /** 각 fa(y) 에서 단면 겉면을 따라 w m 간 자리의 각 (+ 각이 커지는 쪽) — 납작한 안쪽 사분면에서도 너비가 맞게 길이를 적분 */
    const toward = (fa, w) => (y) => {
      const dir = Math.sign(w), target = Math.abs(w), da = 0.002 * dir;
      let a = fa(y), d = 0, [px, pz] = section(a, y, info.outer);
      for (let i = 0; i < 2000; i++) {
        const [x, z] = section(a + da, y, info.outer), dd = Math.hypot(x - px, z - pz);
        if (d + dd >= target) return a + (da * (target - d)) / dd;
        d += dd; a += da; px = x; pz = z;
      }
      return a;
    };
    const P = (a, y, mm) => { const [x, zo] = section(a, y, info.outer, lift(mm)(y)); return [x, y - info.pelvisY, info.legZ + info.side * zo]; };
    const out = [];
    const top = HEM_Y + HEM_W;
    // 옷단 테 — 앞 조각(앞섶 → 트임) · 뒤 조각(트임 → 뒤 가장자리)
    for (const [a0, a1] of [[fF, slitF], [slitB, fB]]) {
      out.push([strip([top, HEM_Y], segs, a0, a1, info, lift(3)), C.band]);
      out.push([strip([HEM_Y + HEM_LINE, HEM_Y], segs, a0, a1, info, lift(4.5)), C.gold]);
      out.push([strip([top, top - HEM_LINE], segs, a0, a1, info, lift(4.5)), C.gold]);
    }
    // 앞섶 테 — 바깥 금빛 선은 옷단까지 이어 내려 옷단 금빛 선과 만난다
    const frontRows = [...COAT_ROWS.filter((y) => y > top + 0.01), top];
    out.push([strip(frontRows, 2, fF, toward(fF, FRONT_W), info, lift(3)), C.band]);
    out.push([strip([...frontRows, HEM_Y + HEM_LINE, HEM_Y], 1, fF, toward(fF, FRONT_LINE), info, lift(4.5)), C.gold]);
    out.push([strip(frontRows, 1, toward(fF, FRONT_W - FRONT_LINE), toward(fF, FRONT_W), info, lift(4.5)), C.gold]);
    // 앞섶 띠 위 은 마름모 — 6.5 cm 마다 (엉덩이 쪽 4 cm 아래부터 옷단 테 윗선 3 cm 위까지)
    for (let y = HIP_Y - 0.04; y > top + 0.03; y -= 0.065) {
      const a = toward(fF, FRONT_W / 2)(y), r = radiusAt(a, y, info.outer);
      out.push([lozenge((u, v) => P(a + u / r, y + v, 5.8), 0.0075, 0.012), C.silver]);
    }
    // 트임 테
    const slitRows = COAT_ROWS.filter((y) => y <= SLIT_TOP + 1e-6);
    out.push([strip(slitRows, 1, toward(slitF, -SLIT_LINE), slitF, info, lift(4.5)), C.gold]);
    out.push([strip(slitRows, 1, slitB, toward(slitB, SLIT_LINE), info, lift(4.5)), C.gold]);
    // 옷단 띠 문양: 덩굴 물결(폭 9 mm · 진폭 9 mm)이 꽃 자리마다 가운데 선을 지나고, 꽃은 금빛 팔각(지름 3 cm) · 은 마름모를 번갈아
    const yc = HEM_Y + HEM_W / 2;
    for (const [a0, a1] of [[toward(fF, FRONT_W + 0.012), toward(slitF, -(SLIT_LINE + 0.012))], [toward(slitB, SLIT_LINE + 0.012), toward(fB, -0.03)]]) {
      hemOrnament(P, (a) => radiusAt(a, yc, info.outer), a0(yc), a1(yc), yc, out);
    }
    return out;
  }
  /** 장화 목 윗단 금빛 고리 1.3 cm (정강이 좌표 L(y)) */
  function bootCuff(api, l, L) {
    addMerged(l, [paintHex(api.ringLoft([[L(0.2205), 0.0604], [L(0.214), 0.0612], [L(0.2075), 0.0608]], 14), C.gold)], 0xffffff, thread);
  }

  // ════════ 골반 통: 앞섶 테(자락 앞섶 테와 같은 자리 · 같은 짜임) + 캄마르반드 띠 끝 둘(금빛 술) ════════
  function hipDress(api, l) {
    const { hipGrid, hipAngleAtZ, ribbon, hipFront } = api;
    const E = 0.02; // 겉자락 앞 가장자리 — 몸 가운데 2 cm 오른쪽
    const band = (z0, z1, mm) => hipGrid((j) => hipAngleAtZ(j, z0), (j) => hipAngleAtZ(j, z1), 1, 1 + mm / 1000 / 0.12);
    const pieces = [
      [band(E - FRONT_W, E, 3), C.band], [band(E - FRONT_LINE, E, 4.5), C.gold], [band(E - FRONT_W, E - FRONT_W + FRONT_LINE, 4.5), C.gold],
    ];
    // 띠 끝: 왼 앞 매듭에서 엉덩이 위로 (v8 과 같은 자리) — 끝 1.6 cm 는 금빛 술(띠 위로 1.5 mm)
    const tail = (pts, widths, dx = 0) => ribbon(pts.map(([y, z]) => [hipFront(y, z) + dx, y, z]), widths);
    const T1 = [[0.058, -0.068], [0.0, -0.072], [-0.052, -0.079]], T2 = [[0.056, -0.088], [0.01, -0.095], [-0.027, -0.102]];
    pieces.push([tail(T1, [0.03, 0.032, 0.029]), C.sash], [tail(T2, [0.027, 0.029, 0.026]), C.sash]);
    pieces.push([tail([[-0.036, -0.0768], [-0.052, -0.079]], [0.0299, 0.029], 0.0015), C.gold], [tail([[-0.011, -0.099], [-0.027, -0.102]], [0.0273, 0.026], 0.0015), C.gold]);
    const mesh = addMerged(l, pieces.map(([geo, hex]) => paintHex(geo, hex)), 0xffffff, thread);
    hangingClothShading(mesh.material);
  }

  // ════════ 가슴·배: 대표 메쉬(detail 모듈 soften 의 둥근 상자) 겉면을 앞에서 쏜 광선으로 찾아 붙인다 (qaba 모듈 surfaceBand 와 같은 방식) ════════
  /** 앞에서 쏜 광선이 닿은 겉면 점을 그 면의 법선 쪽으로 mm 띄운 [x, y, z] — 위로 눕는 둥근 윗단에서도 겉면과 겹쳐 깜빡이지 않게(x 로만 띄우면 겹친다) */
  function probe(main) {
    const mesh = new THREE.Mesh(main.geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), o = new THREE.Vector3(), dir = new THREE.Vector3(-1, 0, 0);
    const surf = (y, z, mm) => {
      ray.set(o.set(1, y, z), dir);
      const hit = ray.intersectObject(mesh, false)[0];
      if (!hit) return [mm / 1000, y, z];
      const n = hit.face.normal, k = (n.x < 0 ? -1 : 1) * (mm / 1000); // 앞(+x)을 보는 쪽으로
      return [hit.point.x + n.x * k, y + n.y * k, z + n.z * k];
    };
    return { surf, done: () => mesh.material.dispose() };
  }
  /** 길(path — [y, z] 점)을 따라 법선 쪽 o0 → o1 사이 띠 (겉면에서 mm 띄움). 법선 = 길 방향을 시계 반대로 90°(가는 쪽의 왼쪽 아래 — 겉자락 쪽) */
  function pathBand(surf, path, o0, o1, mm, n) {
    const curve = new THREE.CatmullRomCurve3(path.map(([y, z]) => new THREE.Vector3(0, y, z)));
    const pts = curve.getSpacedPoints(n), pos = [], uv = [], idx = [];
    pts.forEach((pt, i) => {
      const tan = curve.getTangentAt(Math.min(1, i / n)), ny = -tan.z, nz = tan.y, len = Math.hypot(ny, nz) || 1;
      for (const o of [o0, o1]) {
        const y = pt.y + (o * ny) / len, z = pt.z + (o * nz) / len;
        pos.push(...surf(y, z, mm)); uv.push(o === o0 ? 0 : 1, i / n);
      }
      if (i < n) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return { geo, curve };
  }
  /** 길 위 거리 s(0~1 비율)·법선 쪽 o 자리에 놓는 작은 판 — 판의 u 는 길 방향, v 는 법선 쪽 */
  function onPath(surf, curve, t, o, mm) {
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t), ty = tan.y, tz = tan.z, ny = -tz, nz = ty;
    return (u, v) => surf(p.y + u * ty + (o + v) * ny, p.z + u * tz + (o + v) * nz, mm);
  }
  // 겉자락 앞섶(v8 CHEST_PATH 를 목 쪽으로 2.6 cm 늘임 — 가슴 상자 윗단 밑까지): 목 왼쪽 깃 안 → 1.36 m 에서 몸 가운데 → 가슴 밑 2 cm 오른쪽
  const CHEST_PATH = [[0.138, -0.082], [0.127, -0.0735], [0.112, -0.062], [0.09, -0.042], [0.06, -0.017], [0.03, 0.0], [0.0, 0.012], [-0.05, 0.019], [-0.125, 0.02]];
  // 속자락 앞섶(V 의 오른쪽 가장자리 — 겉자락 길을 몸 가운데로 비춘 것, 1.36 m 에서 겉자락 밑으로 들어간다)
  const INNER_PATH = [[0.138, 0.082], [0.127, 0.0735], [0.112, 0.062], [0.09, 0.042], [0.06, 0.017], [0.03, 0.0]];
  // 망토(선 깃·짧은 어깨 망토 — outfit_silver_wanderer.js chest 의 drape 와 같은 단면): 높이 y 의 각 a 자리, 겉면에서 offset
  const MANTLE_ROWS = [[0.254, 0.072, 0.082], [0.19, 0.079, 0.092], [0.16, 0.127, 0.188], [0.119, 0.14, 0.208], [0.037, 0.14, 0.211]];
  function mantle(y, a, offset) {
    let j = 0;
    while (j < MANTLE_ROWS.length - 2 && y < MANTLE_ROWS[j + 1][0]) j++;
    const u = THREE.MathUtils.clamp((MANTLE_ROWS[j][0] - y) / (MANTLE_ROWS[j][0] - MANTLE_ROWS[j + 1][0]), 0, 1);
    const rx = THREE.MathUtils.lerp(MANTLE_ROWS[j][1], MANTLE_ROWS[j + 1][1], u), rz = THREE.MathUtils.lerp(MANTLE_ROWS[j][2], MANTLE_ROWS[j + 1][2], u);
    const c = Math.cos(a), s = Math.sin(a), r = (Math.abs(c / rx) ** 4 + Math.abs(s / rz) ** 4) ** -0.25, f = 1 + 0.008 * Math.cos(a * 8 + (j + u) * 0.25);
    return [(r * f + offset) * c, y, (r * f + offset) * s];
  }
  function mantleBand(rowsY, a0f, a1f, segs, offset) {
    const pos = [], uv = [], idx = [];
    rowsY.forEach((y, j) => {
      const a0 = a0f(y), a1 = a1f(y);
      for (let i = 0; i <= segs; i++) { pos.push(...mantle(y, a0 + ((a1 - a0) * i) / segs, offset)); uv.push(i / segs, j / (rowsY.length - 1)); }
    });
    for (let j = 0; j < rowsY.length - 1; j++) for (let i = 0; i < segs; i++) {
      const n = j * (segs + 1) + i, m = n + segs + 1;
      idx.push(n, n + 1, m, n + 1, m + 1, m);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    return geo;
  }
  const MANTLE_OPEN = 0.58; // 망토 앞 트인 반각 (drape start)
  /** 망토 겉면에서 각 a 자리의 반지름 (각 너비 = 길이 ÷ 반지름) */
  const mantleR = (y, a) => { const [x, , z] = mantle(y, a, 0); return Math.hypot(x, z); };
  function chest(g) {
    const { surf, done } = probe(g.children[0]), pieces = [];
    // 안옷 V: 겉자락 앞섶과 속자락 앞섶 사이(1.36 m 에서 만남 → 목 둘레까지) — 흰 안옷, 겉면에서 2 mm
    const zo = (y) => { // 겉자락 길의 z (y 0.03 ~ 0.138, 점 사이 직선)
      for (let i = 0; i < 5; i++) {
        const [ya, za] = CHEST_PATH[i], [yb, zb] = CHEST_PATH[i + 1];
        if (y <= ya && y >= yb) return za + ((zb - za) * (ya - y)) / (ya - yb);
      }
      return y > CHEST_PATH[0][0] ? CHEST_PATH[0][1] : 0;
    };
    {
      // 가슴 상자 둥근 윗단(꺾인 면)에 걸치는 0.13 까지 — 그 위 윗면은 아래 윗면 판이 2.5 mm 로 덮는다(겹치는 곳은 윗면 판이 앞)
      const rows = 8, cols = 6, pos = [], uv = [], idx = [];
      for (let j = 0; j <= rows; j++) {
        const y = 0.03 + ((0.13 - 0.03) * j) / rows, z0 = zo(y) - 0.002, z1 = -zo(y) + 0.002;
        for (let i = 0; i <= cols; i++) { const z = z0 + ((z1 - z0) * i) / cols; pos.push(...surf(y, z, 2)); uv.push(i / cols, j / rows); }
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const n = j * (cols + 1) + i, m = n + cols + 1; idx.push(n, m, n + 1, n + 1, m, m + 1); }
      const v = new THREE.BufferGeometry();
      v.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      v.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      v.setIndex(idx); v.computeVertexNormals();
      pieces.push([v, C.inner]);
    }
    {
      // 가슴 상자 윗면 중 선 깃 앞 트임으로 보이는 곳(목 앞 — x −0.03 ~ 0.112 · z ±0.085)도 흰 안옷으로: 보라 윗면이 하늘빛을 받아 V 위에 띠로 비치지 않게.
      //  줄 x 는 둥근 상자(soften 5 칸)의 꺾인 모서리(x 0.1039 — 앞 꺾인 면과 윗 꺾인 면이 만나는 곳)를 지나게 골라 판이 모서리를 가로질러 파묻히지 않게
      //  위에서 쏜 광선으로 윗면(둥근 모서리 포함)을 찾아 그 면의 법선 쪽으로 2.5 mm — V 판(2 mm)보다 위, 앞섶 테 바탕(3 mm)보다 아래(겹치는 곳에서 깜빡이지 않게)
      const mesh = new THREE.Mesh(g.children[0].geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      mesh.updateMatrixWorld(true);
      const ray = new THREE.Raycaster(), o = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
      const XS = [-0.03, 0.01, 0.045, 0.072, 0.09, 0.1039, 0.112], rows = XS.length - 1, cols = 6, pos = [], uv = [], idx = [];
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
        const x = XS[j], z = -0.085 + (0.17 * i) / cols;
        ray.set(o.set(x, 1, z), down);
        const hit = ray.intersectObject(mesh, false)[0], n = hit?.face.normal, k = n && n.y < 0 ? -0.0025 : 0.0025;
        pos.push(...(hit ? [x + n.x * k, hit.point.y + n.y * k, z + n.z * k] : [x, 0.1425, z])); uv.push(i / cols, j / rows);
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const n = j * (cols + 1) + i, m = n + cols + 1; idx.push(n, n + 1, m, n + 1, m + 1, m); }
      mesh.material.dispose();
      const top = new THREE.BufferGeometry();
      top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      top.setIndex(idx); top.computeVertexNormals();
      pieces.push([top, C.inner]);
    }
    // 겉자락 앞섶 테: 금빛 선(가장자리) · 짙은 보라 띠 · 금빛 선 — 모두 3.8 cm, 겉자락 쪽으로
    const base = pathBand(surf, CHEST_PATH, 0, CHEST_W, 3, 24);
    pieces.push([base.geo, C.band], [pathBand(surf, CHEST_PATH, 0, CHEST_LINE, 4.5, 24).geo, C.gold], [pathBand(surf, CHEST_PATH, CHEST_W - CHEST_LINE, CHEST_W, 4.5, 24).geo, C.gold]);
    for (const t of [0.2, 0.42, 0.64, 0.86]) pieces.push([lozenge(onPath(surf, base.curve, t, CHEST_W / 2, 5.8), 0.011, 0.0068), C.silver]);
    // 속자락 앞섶(V 오른쪽)에도 금빛 선 1.0 cm — 속자락 쪽(길의 오른쪽 = 법선 반대)
    pieces.push([pathBand(surf, INNER_PATH, -CHEST_LINE, 0, 4.5, 10).geo, C.gold]);
    // 망토: 아랫단 금빛 띠 2.4 cm · 앞 가장자리 금빛 띠 1.4 cm(양쪽) · 선 깃 윗단 금빛 띠 1.2 cm
    const O = 0.0035, open = MANTLE_OPEN, back = Math.PI * 2 - MANTLE_OPEN;
    pieces.push([mantleBand([0.061, 0.037], () => open, () => back, 48, O), C.gold]);
    pieces.push([mantleBand([0.254, 0.242], () => open, () => back, 40, O), C.gold]);
    const edgeRows = [0.254, 0.235, 0.21, 0.19, 0.175, 0.16, 0.14, 0.119, 0.09, 0.061, 0.037];
    pieces.push([mantleBand(edgeRows, () => open, (y) => open + 0.014 / mantleR(y, open), 1, O + 0.0005), C.gold]);
    pieces.push([mantleBand(edgeRows, (y) => back - 0.014 / mantleR(y, back), () => back, 1, O + 0.0005), C.gold]);
    addPainted(g, pieces);
    done();
  }
  /** 배: 앞섶 테가 가슴 밑에서 띠까지 · 캄마르반드(짙은 가지색 띠 + 위아래 금빛 가장자리 + 팔각 꽃 + 왼 앞 매듭) */
  function abdomen(g, rosette8) {
    const { surf, done } = probe(g.children[0]), pieces = [];
    const path = [[0.066, 0.02], [0.02, 0.02], [-0.025, 0.02]];
    pieces.push([pathBand(surf, path, 0, CHEST_W, 3, 4).geo, C.band], [pathBand(surf, path, 0, CHEST_LINE, 4.5, 4).geo, C.gold], [pathBand(surf, path, CHEST_W - CHEST_LINE, CHEST_W, 4.5, 4).geo, C.gold]);
    done();
    // 띠 몸통(높이 8.5 cm 그대로 — v8 과 같은 둥근 상자) 위아래 어깨(앞면이 위·아래면으로 꺾이는 면, 높이 약 1.3 cm)를 금빛 가장자리로:
    //  띠 상자를 옆에서 쏜 광선으로 찾아 1.2 mm 띄운 고리 둘
    const sash = h.bake(h.artoriaRoundedBox(0.25, 0.085, 0.355, 0.022), [0, -0.06, 0]);
    const sashProbe = new THREE.Mesh(sash, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    sashProbe.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(), o = new THREE.Vector3(), dir = new THREE.Vector3();
    const edgeRing = (rowsY) => {
      const segs = 40, pos = [], uv = [], idx = [];
      rowsY.forEach((y, j) => {
        for (let i = 0; i <= segs; i++) {
          const a = (i / segs) * Math.PI * 2;
          dir.set(-Math.cos(a), 0, -Math.sin(a)); o.set(Math.cos(a) * 0.4, y, Math.sin(a) * 0.4);
          ray.set(o, dir);
          const hit = ray.intersectObject(sashProbe, false)[0], r = hit ? Math.hypot(hit.point.x, hit.point.z) + 0.0012 : 0.12;
          pos.push(Math.cos(a) * r, y, Math.sin(a) * r); uv.push(i / segs, j);
        }
      });
      for (let i = 0; i < segs; i++) { const n = i, m = i + segs + 1; idx.push(n, m, n + 1, n + 1, m, m + 1); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx); geo.computeVertexNormals();
      return geo;
    };
    const top = edgeRing([-0.06 + 0.035, -0.06 + 0.0222]), low = edgeRing([-0.06 - 0.0222, -0.06 - 0.035]);
    sashProbe.material.dispose();
    pieces.push([sash, C.sash], [top, C.gold], [low, C.gold]);
    pieces.push([h.bake(h.ball(0.02, 10, 6), [0.128, -0.079, -0.082], null, [0.55, 0.85, 1.15]), C.sash]);
    addPainted(g, pieces);
    rosette8(g); // 팔각 꽃(금빛 2.7 cm · 은빛 1.8 cm · 청록 구슬) — 크기·자리 v8 그대로 (detail 모듈 재질)
  }
  /** 위 소매(겉옷 반소매 — 대표 메쉬는 outfit_silver_wanderer.js 가 보라로 칠한다): 망토 어깨 덮개(v1 꼴·색 그대로) · 덮개 아랫단 띠 1.6 cm 는 금빛으로(v1~v8 은 덮개와 같은 보라),
   *  팔꿈치 위 소매 끝에 금빛 선 1.0 cm + 짙은 보라 띠 2.0 cm — 그 밑으로 흰 안옷 소매(아래팔, v7 그대로)가 나온다. 한 메쉬(꼭짓점 색) */
  function upperArm(g) {
    addPainted(g, [
      [h.bake(h.ball(0.072, 20, 12, null, null, [0, Math.PI * 2, 0, Math.PI * 0.59]), [0, 0.098, 0], null, [1, 1.02, 1.04]), C.mantle],
      [h.cyl(0.073, 0.07, 0.016, 20, true, [0, 0.074, 0]), C.gold],
      [h.cyl(0.0622, 0.0606, 0.02, 20, true, [0, -0.108, 0]), C.band],
      [h.cyl(0.0637, 0.0628, 0.01, 20, true, [0, -0.093, 0]), C.gold],
    ]);
  }
  const qaba = createDaraishiQaba(h, { coat: C.coat, trouser: C.trouser, legDress, hipDress, bootCuff }); // 자락·골반 통 꼴과 바지 통·장화는 v8 그대로
  return { qaba, chest, abdomen, upperArm, C };
}
