// ─────────────────────────────────────────────────────────────
//  무기 겉모습 도구 (보여 주기만 한다 — 물리 콜라이더·질량·판정에는 전혀 영향이 없다)
//
//  칼이 "뭉툭한 막대"로 보이던 원인은 세 가지였다:
//   1) 칼날이 상자꼴이거나 끝이 평평한 마개로 잘려 있었다 — 칼끝(찌르는 끝)이 없었다.
//   2) 장면에 반사 환경이 없어, 강철을 강철답게(하늘·모래가 비치는 거울면) 칠할 수 없었다 —
//      metalness 를 올리면 새까매지고, 내리면 회색 플라스틱이 됐다.
//   3) 자루·코등이·폼멜이 상자와 공 그대로였다.
//  여기서 셋 다 푼다: 무기 전용 반사 환경(장면 전체 조명은 그대로), 날 세움 면·피홈·칼끝이 있는
//  칼날 단면, 가죽 감은 손잡이·바퀴형 폼멜·끝 장식 코등이. weapons.js 의 무기 스펙이 swordKit()
//  으로 조합해 partMesh 로 넘긴다.
//
//  콜라이더와 겉보기 약속(~1cm): 칼몸·자루·코등이는 콜라이더에서 ~1cm 안이다. 예외는 칼끝 한 곳 —
//  콜라이더는 끝까지 폭이 같은 상자라, 뾰족한 칼끝을 그리면 상자 모서리 쪽이 1.5~2cm 비게 된다
//  (꼭짓점은 상자 끝을 1cm 넘겨 그려 양쪽 어긋남을 나눈다). 난수는 쓰지 않는다(시뮬 재현성).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// ── 무기 전용 반사 환경 ──
// 작은 등장방형(equirect) 데이터 텍스처를 직접 칠한다: 위는 하늘, 수평선 바로 위는 경기장 나무 벽,
// 아래는 모래, 그리고 해(main.js 의 sun 방향과 같은 쪽). three.js 가 처음 그릴 때 알아서 PMREM 으로
// 바꿔 거칠기별 반사를 만든다. DOM 이 필요 없어 헤드리스 시뮬에서도 그대로 만들어진다.
let envTex = null;
export function weaponEnv() {
  if (envTex) return envTex;
  const W = 128;
  const H = 64;
  const data = new Uint8Array(W * H * 4);
  const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const skyTop = hex(0x7ea5cf);
  const skyLow = hex(0xe2eaf0);
  const wall = hex(0x5e4b3a);
  const sandNear = hex(0xa39a8c); // 모래를 그대로(누렇게) 비추면 칼날 면이 나무판처럼 보여서, 반사용은 회갈색으로 낮춘다
  const sandFar = hex(0x5f5a52);
  const sun = new THREE.Vector3(4, 9, 3).normalize();
  const d = new THREE.Vector3();
  for (let j = 0; j < H; j++) {
    const el = (j / (H - 1)) * Math.PI - Math.PI / 2; // DataTexture 는 첫 줄이 아래(uv.y=0)
    for (let i = 0; i < W; i++) {
      const phi = ((i + 0.5) / W - 0.5) * Math.PI * 2;
      d.set(Math.cos(el) * Math.cos(phi), Math.sin(el), Math.cos(el) * Math.sin(phi));
      let c;
      if (el >= 0) {
        c = mix(skyLow, skyTop, Math.min(1, el / 1.2) ** 0.8);
        if (el < 0.2) c = mix(wall, c, (el / 0.2) ** 2.5); // 경기장 둘레 나무 벽·관중석
        const s = d.dot(sun);
        if (s > 0.9) c = mix(c, [255, 250, 236], Math.min(1, (s - 0.9) / 0.08) ** 2); // 해와 햇무리
      } else {
        c = mix(sandNear, sandFar, Math.min(1, -el / 1.0));
      }
      const o = (j * W + i) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
  envTex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = THREE.SRGBColorSpace;
  envTex.magFilter = THREE.LinearFilter;
  envTex.minFilter = THREE.LinearFilter;
  envTex.needsUpdate = true;
  return envTex;
}

// 등급별 마감: 등급이 높을수록 더 곱게 갈아 거울처럼 비친다. 쓰레기는 녹슬고 흐릿하다.
//  (레전드에 자체 발광은 없다 — 진짜 엑스칼리버의 표식은 aura.js 오라 하나뿐이어야 한다)
export const FINISH = {
  trash: { blade: 0.62, hilt: 0.75, metal: 0.55, env: 0.5 },
  common: { blade: 0.3, hilt: 0.42, metal: 0.9, env: 1.0 },
  rare: { blade: 0.22, hilt: 0.34, metal: 0.92, env: 1.1 },
  epic: { blade: 0.15, hilt: 0.28, metal: 0.94, env: 1.2, sheen: 0x9fd8e8 },
  legend: { blade: 0.1, hilt: 0.22, metal: 0.95, env: 1.3 },
};
const finishOf = (tier) => FINISH[tier] ?? FINISH.common;

/** 반사 환경을 받는 금속 재질 (장식용 메쉬에도 쓴다) */
export function metalMat(color, { rough = 0.35, metal = 0.9, env = 1, ...rest } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMap: weaponEnv(), envMapIntensity: env, ...rest });
}

// ═════════════════════════════════════════════════════════════
//  칼날 지오메트리
// ═════════════════════════════════════════════════════════════
/**
 * 날 세움 면·피홈·칼끝이 있는 칼날. hx/hy/hz 는 콜라이더 상자 반치수(그대로 물려받는다), y=-hy 가 자루 쪽.
 *  o.edge      'double'(양날) | 'single'(외날, 날은 +x 쪽)
 *  o.width(t)  칼몸 반폭 배율 (t=0 자루 쪽 ~ 1 칼끝 구간 시작), 기본 1 − 0.35t
 *  o.edgeX(t), o.backX(t)  외날의 날·등 x 위치를 직접 줄 때 (m, 등은 음수)
 *  o.thick     밑동 반두께(m) — 콜라이더보다 얇게 두어 날이 서 보이게 한다
 *  o.tip       'spear'(양날 창끝) | 'needle'(바늘) | 'round'(둥근 끝) | 'kissaki'(카타나 끝) | 'clip'(세이버 끝)
 *  o.tipLen    칼끝 구간 길이(m),  o.overshoot 꼭짓점이 콜라이더 끝을 넘는 길이(m)
 *  o.apex      외날 칼끝 꼭짓점의 x (반폭 배율, −1 등 ~ +1 날)
 *  o.curve     칼끝에서 등 쪽(−x)으로 휘는 양(m, 곡도)
 *  o.bevel     날 세움 면 폭(m) — 이 좁은 면이 빛을 따로 받아 "선 날"로 읽힌다
 *  o.fuller    { to, width, depth }  피홈: 자루에서 t=to 까지, 반폭 배율 width, 반두께 배율 depth
 *  o.ridge     외날 등마루(시노기) 위치 — 등에서 날까지의 비율 (0 이면 등이 두꺼운 쐐기)
 *  o.hamon     외날 날 쪽 흰 담금질 무늬(하몬)
 */
export function bladeGeometry(hx, hy, hz, o = {}) {
  const double = o.edge !== 'single';
  const width = o.width ?? ((t) => 1 - 0.35 * t);
  const thick0 = o.thick ?? Math.min(hz, hx * 0.2);
  const tipLen = o.tipLen ?? Math.min(0.1, hy * 0.25);
  const over = o.overshoot ?? 0.01;
  const tip = o.tip ?? (double ? 'spear' : 'kissaki');
  const curve = o.curve ?? 0;
  const y0 = -hy;
  const yApex = hy + over;
  const yTip = yApex - tipLen;
  const segBody = o.segs ?? 20;
  const segTip = 12;

  // 칼몸(t) 에서의 날·등 x
  const bodyEdge = (t) => (o.edgeX ? o.edgeX(t) : hx * width(t));
  const bodyBack = (t) => (o.backX ? o.backX(t) : -hx * width(t));
  const tTip = (yTip - y0) / (2 * hy);

  // y 위치에서의 단면 매개변수: 날 x(xe), 등 x(xb), 반두께(th), 칼끝 진행도(s)
  const at = (y) => {
    const t = Math.min(1, (y - y0) / (2 * hy));
    let xe = bodyEdge(Math.min(t, tTip));
    let xb = bodyBack(Math.min(t, tTip));
    let th = thick0 * (1 - 0.35 * Math.min(t, tTip)); // 칼끝으로 갈수록 얇아진다(distal taper)
    let s = 0;
    if (y > yTip) {
      s = (y - yTip) / tipLen;
      const e0 = xe;
      const b0 = xb;
      if (double) {
        const p = tip === 'needle' ? 1 : tip === 'round' ? 2.6 : 1.35;
        const k = 1 - s ** p;
        xe = e0 * k;
        xb = b0 * k;
        th *= 1 - s ** (p + 0.3);
      } else {
        const ax = (o.apex ?? (tip === 'clip' ? 0.15 : -0.7)) * hx;
        if (tip === 'clip') {
          // 세이버: 등이 칼끝 쪽으로 비스듬히 깎여 내려오고(가짜 날), 날은 끝에서만 살짝 올라간다
          xb = b0 + (ax - b0) * s ** 1.15;
          xe = e0 + (ax - e0) * s ** 2.4;
        } else {
          // 키사키: 날이 둥근 호를 그리며 올라가 등 쪽 꼭짓점에서 만난다, 등은 거의 곧다
          xe = ax + (e0 - ax) * Math.sqrt(Math.max(0, 1 - s * s));
          xb = b0 + (ax - b0) * s ** 3;
        }
        th *= 1 - s ** 1.8;
      }
    }
    const u = (y - y0) / (yApex - y0);
    const bend = -curve * u * u;
    return { xe: xe + bend, xb: xb + bend, th, s, t, bend };
  };

  // 단면 점 (한 바퀴, 같은 개수). 각 점에 색 배율(날 쪽은 밝게, 피홈 안은 어둡게)을 같이 준다.
  const EDGE = 1.1;
  const GROOVE = 0.86;
  const HAMON = [1.3, 1.31, 1.33];
  const ring = (y) => {
    const { xe, xb, th, s, t } = at(y);
    const pts = [];
    const cols = [];
    const P = (x, z, c) => {
      pts.push([x, y, z]);
      cols.push(Array.isArray(c) ? c : [c, c, c]);
    };
    if (double) {
      const w = (xe - xb) / 2;
      const cx = (xe + xb) / 2;
      const b = Math.min(o.bevel ?? 0.0035, w * 0.3);
      const te = th * 0.3;
      // 피홈: 자루 쪽에서 to 까지, 끝에서 서서히 사라진다
      const F = o.fuller;
      let fo = 0;
      let fi = 0;
      let fd = 0;
      if (F && s === 0) {
        const fade = Math.max(0, Math.min(1, (F.to - t) / 0.08));
        fo = w * F.width * fade;
        fi = fo * 0.7;
        fd = th * (F.depth ?? 0.45) * fade;
      }
      P(cx + w, 0, EDGE);
      P(cx + w - b, te, EDGE);
      P(cx + fo, th, 1);
      P(cx + fi, th - fd, fd > 0 ? GROOVE : 1);
      P(cx - fi, th - fd, fd > 0 ? GROOVE : 1);
      P(cx - fo, th, 1);
      P(cx - w + b, te, EDGE);
      P(cx - w, 0, EDGE);
      P(cx - w + b, -te, EDGE);
      P(cx - fo, -th, 1);
      P(cx - fi, -th + fd, fd > 0 ? GROOVE : 1);
      P(cx + fi, -th + fd, fd > 0 ? GROOVE : 1);
      P(cx + fo, -th, 1);
      P(cx + w - b, -te, EDGE);
    } else {
      const span = xe - xb;
      const b = Math.min(o.bevel ?? 0.003, span * 0.2);
      const te = th * 0.28;
      const r = o.ridge ?? 0;
      const xs = xb + span * r; // 등마루(시노기)
      const tb = r > 0 ? th * 0.72 : th; // 칼등(무네) 두께
      // 하몬(담금질 무늬) 경계: 날에서 폭의 35% 안쪽, 물결치며(자루→칼끝) 칼끝에선 날을 따라 돈다
      const hamonW = span * (0.3 + 0.07 * Math.sin(y * 55) + 0.04 * Math.sin(y * 131));
      const xh = Math.max(xs + 0.001, xe - b - Math.max(0.002, hamonW));
      const zOn = (x) => te + ((x - (xe - b)) / (xs - (xe - b) || 1)) * (th - te); // 날 세움 면~등마루 사이 평면의 두께
      const hamon = o.hamon ? HAMON : 1;
      P(xe, 0, o.hamon ? HAMON : EDGE);
      P(xe - b, te, o.hamon ? HAMON : EDGE);
      P(xh, zOn(xh), hamon);
      P(xh - 0.0015, zOn(xh - 0.0015), 1);
      P(xs, th, 1);
      P(xb, tb, 0.95);
      P(xb, -tb, 0.95);
      P(xs, -th, 1);
      P(xh - 0.0015, -zOn(xh - 0.0015), 1);
      P(xh, -zOn(xh), hamon);
      P(xe - b, -te, o.hamon ? HAMON : EDGE);
    }
    return { pts, cols };
  };

  const ys = [];
  for (let i = 0; i <= segBody; i++) ys.push(y0 + ((yTip - y0) * i) / segBody);
  for (let i = 1; i <= segTip; i++) ys.push(yTip + (tipLen * i) / segTip);
  const rings = ys.map(ring);

  const pos = [];
  const col = [];
  const tri = (a, ca, b, cb, c, cc) => {
    pos.push(...a, ...b, ...c);
    col.push(...ca, ...cb, ...cc);
  };
  const n = rings[0].pts.length;
  for (let r = 1; r < rings.length; r++) {
    const A = rings[r - 1];
    const B = rings[r];
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      tri(A.pts[k], A.cols[k], B.pts[k], B.cols[k], B.pts[k2], B.cols[k2]);
      tri(A.pts[k], A.cols[k], B.pts[k2], B.cols[k2], A.pts[k2], A.cols[k2]);
    }
  }
  // 자루 쪽 마개 (칼날 밑동 단면)
  const base = rings[0];
  const c0 = base.pts.reduce((a, p) => [a[0] + p[0] / n, a[1] + p[1] / n, a[2] + p[2] / n], [0, 0, 0]);
  for (let k = 0; k < n; k++) tri(c0, [1, 1, 1], base.pts[(k + 1) % n], base.cols[(k + 1) % n], base.pts[k], base.cols[k]);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals(); // 인덱스 없는 삼각형 → 면마다 각진 법선: 날 세움 면이 또렷한 선으로 빛난다
  return geo;
}

// ═════════════════════════════════════════════════════════════
//  자루 부품
// ═════════════════════════════════════════════════════════════
const shadowed = (m) => {
  m.traverse?.((c) => {
    if (c.isMesh) c.castShadow = true;
  });
  return m;
};

/** 손잡이: 가죽·끈을 감은 둥근 자루 (콜라이더 상자 안에 들어가는 원기둥), 양끝 금속 테(페룰) */
function gripMesh(hx, hy, hz, color, style, F, metalColor) {
  const g = new THREE.Group();
  const r0 = Math.min(hx, hz) * 0.98;
  const len = hy * 2;
  const pts = [];
  const N = 48;
  const ridges = style === 'plain' ? 0 : Math.max(4, Math.round(len / (style === 'wire' ? 0.004 : 0.009)));
  for (let i = 0; i <= N; i++) {
    const v = i / N;
    const y = -hy + len * v;
    const swell = 1 + 0.06 * Math.sin(v * Math.PI); // 가운데가 살짝 불룩
    const bump = ridges ? (style === 'wire' ? 0.0007 : 0.0011) * Math.abs(Math.sin(v * ridges * Math.PI)) : 0;
    pts.push(new THREE.Vector2(r0 * 0.9 * swell + bump, y));
  }
  const geo = new THREE.LatheGeometry(pts, 14);
  const mat =
    style === 'metal' || style === 'wire'
      ? metalMat(color, { rough: F.hilt + 0.05, metal: 0.85, env: F.env })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0 });
  const grip = new THREE.Mesh(geo, mat);
  if (hz !== hx) grip.scale.z = hz / hx; // 타원 단면(츠카 등)
  g.add(grip);
  if (style !== 'plain') {
    const fm = metalMat(metalColor, { rough: F.hilt, metal: 0.9, env: F.env });
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.CylinderGeometry(r0 * 1.02, r0 * 1.02, 0.008, 14), fm);
      f.position.y = s * (hy - 0.004);
      if (hz !== hx) f.scale.z = hz / hx;
      g.add(f);
    }
  }
  return shadowed(g);
}

/** 폼멜 (콜라이더는 공 — 겉모습은 바퀴·배·마개 모양) */
function pommelMesh(r, color, style, F) {
  const mat = metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env });
  const g = new THREE.Group();
  if (style === 'wheel') {
    // 바퀴형(휠) 폼멜: 칼날 면과 나란한 두꺼운 원반, 테두리를 비스듬히 깎고 가운데 볼록한 단추
    const R = r * 1.12;
    const h = r * 0.46;
    const prof = [
      [0, -h],
      [R * 0.62, -h],
      [R * 0.7, -h * 0.72],
      [R, -h * 0.32],
      [R, h * 0.32],
      [R * 0.7, h * 0.72],
      [R * 0.62, h],
      [0, h],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const disc = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), mat);
    disc.rotation.x = Math.PI / 2; // 원반 면이 z(칼날 면 방향)를 본다
    g.add(disc);
    for (const s of [-1, 1]) {
      const boss = new THREE.Mesh(new THREE.SphereGeometry(r * 0.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      boss.rotation.x = (s * Math.PI) / 2;
      boss.position.z = s * h * 0.95;
      boss.scale.y = 0.45;
      g.add(boss);
    }
  } else if (style === 'pear' || style === 'scent') {
    // 배 모양 / 향수병 마개 모양 폼멜 (자루 끝에서 아래로)
    const prof =
      style === 'pear'
        ? [[0, r * 1.05], [r * 0.45, r * 0.95], [r * 0.95, r * 0.2], [r * 0.85, -r * 0.55], [r * 0.35, -r * 0.95], [0, -r * 1.05]]
        : [[0, r * 1.05], [r * 0.4, r * 1.0], [r * 0.55, r * 0.6], [r * 1.0, r * 0.15], [r * 0.9, -r * 0.35], [r * 0.45, -r * 0.6], [r * 0.5, -r * 0.85], [r * 0.2, -r * 1.05], [0, -r * 1.08]];
    g.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 18), mat));
  } else if (style === 'disc') {
    // 납작한 원반(검 폼멜) — 칼날 면과 나란히, 가장자리를 둥글게
    const d = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, r * 0.7, 20), mat);
    d.rotation.x = Math.PI / 2;
    g.add(d);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.14, 6, 24), mat);
    g.add(rim);
  } else if (style === 'cap') {
    // 자루 끝 마개(카시라·세이버 등쇠 끝): 낮고 둥근 캡
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 16, 10), mat);
    c.scale.set(1, 0.7, 1.05);
    g.add(c);
  } else {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat));
  }
  // 슴베 끝을 두드려 박은 작은 단추 (자루 끝)
  if (style !== 'cap') {
    const peen = new THREE.Mesh(new THREE.SphereGeometry(r * 0.2, 10, 6), mat);
    peen.position.y = -r * (style === 'wheel' ? 1.1 : 1.05);
    peen.scale.y = 0.6;
    g.add(peen);
  }
  return shadowed(g);
}

/** 코등이 (콜라이더는 상자 — 겉모습은 끝이 장식된 팔각 막대, 원반 츠바, 컵 등) */
function guardMesh(shape, color, style, F) {
  const g = new THREE.Group();
  const mat = metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env });
  if (style === 'none') return g;
  if (shape[0] === 'ball' || style === 'cup') {
    // 레이피어 컵: 칼날 쪽이 둥글게 덮인 사발 (손 쪽으로 열림), 가장자리에 말린 테
    const r = shape[1];
    const cup = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env, side: THREE.DoubleSide }));
    cup.position.y = -r * 0.45;
    g.add(cup);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * Math.sin(Math.PI * 0.46), 0.0035, 6, 32), mat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = cup.position.y + r * Math.cos(Math.PI * 0.46);
    g.add(rim);
    return shadowed(g);
  }
  const [, hx, hy, hz] = shape;
  if (style === 'disc') {
    // 츠바: 둥근 쇠 원반 + 테두리
    const R = Math.max(hx, hz) * 1.1;
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(R, R, hy * 2, 28), mat));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R, hy * 0.9, 6, 32), mat);
    rim.rotation.x = Math.PI / 2;
    g.add(rim);
    return shadowed(g);
  }
  if (style === 'block') {
    // 이미터·짧은 랑게트: 작은 금속 덩어리
    const b = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(hx, hz) * 1.05, Math.min(hx, hz) * 0.95, hy * 2, 14), mat);
    g.add(b);
    return shadowed(g);
  }
  // 막대형 코등이 (x 방향): 가운데가 두툼하고 끝으로 가늘어지는 팔각 단면, 끝에 둥근 장식(피니얼),
  //  가운데엔 칼날 밑동을 감싸는 방패꼴(에퀴송). curved 면 양끝이 칼날 쪽으로 살짝 굽는다.
  const rc = Math.min(hy, hz);
  const sides = 8;
  const segs = 16;
  const pos = [];
  const ringAt = (u) => {
    const x = -hx * 0.9 + hx * 1.8 * u;
    const a = Math.abs(x) / hx;
    const r = rc * (1 - 0.3 * a);
    const lift = style === 'curved' ? 0.014 * a * a : 0;
    const pts = [];
    for (let k = 0; k < sides; k++) {
      const ang = (k / sides) * Math.PI * 2 + Math.PI / sides;
      pts.push([x, Math.cos(ang) * r * (hy / rc) + lift, Math.sin(ang) * r * (hz / rc)]);
    }
    return pts;
  };
  let prev = ringAt(0);
  const q = (p0, p1, p2, p3) => pos.push(...p0, ...p1, ...p2, ...p0, ...p2, ...p3);
  for (let i = 1; i <= segs; i++) {
    const cur = ringAt(i / segs);
    for (let k = 0; k < sides; k++) q(prev[k], cur[k], cur[(k + 1) % sides], prev[(k + 1) % sides]);
    prev = cur;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, metalMat(color, { rough: F.hilt, metal: 0.9, env: F.env, side: THREE.DoubleSide })));
  for (const s of [-1, 1]) {
    const lift = style === 'curved' ? 0.014 * 0.81 : 0;
    const fin = new THREE.Mesh(new THREE.SphereGeometry(rc * 0.95, 12, 8), mat);
    fin.position.set(s * hx * 0.9, lift, 0);
    fin.scale.set(1.15, hy / rc, hz / rc);
    g.add(fin);
  }
  const esc = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), mat);
  esc.scale.set(rc * 1.35, hy * 1.25, hz * 1.02);
  esc.position.y = hy * 0.15;
  g.add(esc);
  return shadowed(g);
}

// ═════════════════════════════════════════════════════════════
//  조합: 무기 스펙의 partMesh 로 넘긴다
// ═════════════════════════════════════════════════════════════
/**
 * fighter.js 가 부품마다 partMesh(idx, isBlade, shape, color, matOpts, look, tier) 를 부른다.
 * 칼 네 부품 순서(buildParts)는 [자루(0), 폼멜(1), 코등이(2), 칼날(3)].
 *  o.blade   bladeGeometry 옵션, 또는 o.bladeMesh(shape, color, matOpts) 로 직접 (라이트세이버 플라스마)
 *  o.grip    { style: 'leather'|'cord'|'wire'|'metal'|'plain', color? }
 *  o.pommel  { style: 'wheel'|'pear'|'scent'|'disc'|'cap'|'ball', color? }
 *  o.guard   { style: 'bar'|'curved'|'disc'|'cup'|'block'|'none', color? }
 */
export function swordKit(o) {
  return (idx, isBlade, shape, color, matOpts, look, tier) => {
    const F = finishOf(tier);
    if (isBlade) {
      if (o.bladeMesh) return o.bladeMesh(shape, color, matOpts);
      if (shape[0] !== 'box') return undefined;
      const [, hx, hy, hz] = shape;
      const mat = new THREE.MeshStandardMaterial({
        color,
        vertexColors: true,
        roughness: F.blade,
        metalness: F.metal,
        envMap: weaponEnv(),
        envMapIntensity: F.env,
        side: THREE.DoubleSide,
        ...(F.sheen ? { emissive: F.sheen, emissiveIntensity: 0.06 } : {}),
      });
      const m = new THREE.Mesh(bladeGeometry(hx, hy, hz, o.blade), mat);
      m.castShadow = true;
      return m;
    }
    const metalColor = o.metal ?? look?.hilt ?? 0x9aa3ad;
    if (idx === 0 && shape[0] === 'box' && o.grip) {
      const [, hx, hy, hz] = shape;
      return gripMesh(hx, hy, hz, o.grip.color ?? color, o.grip.style ?? 'leather', F, o.pommel?.color ?? metalColor);
    }
    if (idx === 1 && shape[0] === 'ball' && o.pommel) return pommelMesh(shape[1], o.pommel.color ?? color, o.pommel.style ?? 'wheel', F);
    if (idx === 2 && o.guard) return guardMesh(shape, o.guard.color ?? color, o.guard.style ?? 'bar', F);
    return undefined;
  };
}
