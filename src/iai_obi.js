// ─────────────────────────────────────────────────────────────
//  帯刀 — 발도 대기 칼 자리 원전대로 · 무기를 따르는 빈 칼집 (사장님 11/14 결정 "권고대로 둘 다 진행해. 근대 칼집이 떠보이거나 시각적으로 물리적 오류를 일으킬까보ㅏ 걱정이야."
//   — 기록 docs/strike/iai_obi_2026-11-14.md · 확인표 3870 ~)
//  원전: 전일본검도연맹 거합 「指導上の留意点」 2025 作法 3② 帯刀 「右手で鍔がへそ前に来るように刀を帯びる」(코등이가 배꼽 앞) ·
//   解説 1본 「刃を上にしたまま、鞘引きとともに刀を抜き出し」(날은 위 · 칼집을 당기며 뽑음) · 「鯉口をへそ前に戻しながら」(鞘戻し — 칼집 입을 배꼽 앞으로)
//  ① 대기 칼 자리 (SECRET.iaiObi): 발도 대기(사람 허리 대기 · AI 웅크린 대기) 동안 칼은 허리띠에 찬 칼집 안 — 칼날 시작(칼 축 hiltLength · 칼집 입)이
//   골반 몸체 틀 SECRET.iaiObiMouth · 칼 축(칼끝 쪽)이 SECRET.iaiObiAxis. 골반을 따름(칼집은 허리띠에 참) — 덧씌우기 칸(thrustPose)의 칼 손 · 칼날을 스텝마다 이 자리에서 셈 ·
//   뽑는 길의 시작 자리(B)도 이 자리 (secret_instant.js startIai). 鞘戻し 점(fighter.js sayaMouthW)도 이 자리의 칼집 입 쥠(칼집 입 + iaiSayaKoi).
//  ② 빈 칼집 (SECRET.iaiObiSaya — 그림만: 물리 몸 · 판정 · 난수 없음): 일본 칼 넷을 쥔 몸의 골반 그림에 칼집 하나 —
//   쉴 때 = 칼집 입은 대기 칼 자리 그대로 · 축은 SECRET.iaiObiSayaAxis(왼 앞 허리 모서리에 닿게 — 사람 팔 · 손목이 대기 칼을 몸 가까이 이 각까지 못 들여
//   대기 칼 축 iaiObiAxis 보다 뒤로 13°) · 대기(대기 몫 iaiObiW) 동안은 칼을 감싸 지금 칼 자리를 따름(칼이 칼집 안으로 보이게 · 비킴 한도 iaiObiFollow 안 — 왼손이 칼집 입을 쥐고 받음) ·
//   鞘引き(왼손이 칼집 입을 쥔 채 왼 허리로)는 왼손을 따라 SECRET.iaiObiPull 축으로 · 鞘戻し 로 제자리 ·
//   어느 자리든 골반 · 배 · 가슴 그림 상자(기본 겉모습 + 겉 여유 SECRET.iaiObiSkin) · 허벅지 캡슐(그 인물 옷 그림의 윗반 굵기)에 든 몫만큼 바깥으로 밀어냄(몸 · 옷을 뚫지 않게 — 그림만).
//   꼴은 칼날 그림을 재서 짓는다(칼날이 칼집 안에 들어가게 — 휨 · 폭 · 두께를 따름). 광기의 다라이시 · 다라이시(자기 빈 검집 — outfit_silver_wanderer.js)와
//   김씨(허리에 찬 칼 — outfit_renji.js)는 자기 것을 쓰고 이 칼집을 달지 않음.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { SECRET } from './config.js';

const D2R = Math.PI / 180;
/** 帯刀 칼집을 다는 무기 (일본 유파 칼 넷 — weapons.js school 'japanese') */
export const OBI_IDS = Object.freeze(['uchigatana', 'muramasa', 'kusanagi', 'monohoshizao']);
/** 이 몸이 帯刀 대기 칼 자리 · 칼집을 쓰나 (스위치 SECRET.iaiObi · 일본 칼 넷) */
export function obiOn(f) {
  return !!SECRET.iaiObi && !!SECRET.iaiObiMouth && OBI_IDS.includes(f.weapon?.id);
}

const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _a = new THREE.Vector3();
const _d = new THREE.Vector3();
const _c = new THREE.Vector3();
/** 골반 틀 [앞, 위, 빈손 쪽 바깥] → 몸체 좌표 (z = 칼 든 쪽 +) */
export function obiPt(g, side, out = new THREE.Vector3()) {
  return out.set(g[0], g[1], -side * g[2]);
}
/** 축 (칼끝 쪽) — yaw ° 앞 0 → 칼 든 쪽 + · el ° 위 + (secret_instant.js dirOf 와 같은 셈 · 몸체 좌표) */
export function obiDir(A, side, out = new THREE.Vector3()) {
  const a = A.yaw * D2R;
  const e = A.el * D2R;
  return out.set(Math.cos(e) * Math.cos(a), Math.sin(e), side * Math.cos(e) * Math.sin(a));
}
/** ① 대기 칼 자리 (골반 몸체 틀 — 칼 목표): 칼집 입 M(칼날 시작) · 칼 축 D (칼끝 쪽) */
export function obiReady(f, M = new THREE.Vector3(), D = new THREE.Vector3()) {
  obiPt(SECRET.iaiObiMouth, f.side, M);
  obiDir(SECRET.iaiObiAxis, f.side, D);
  return { M, D };
}
/** ② 쉬는 칼집 (골반 몸체 틀): 칼집 입 = 대기 칼 자리의 칼집 입 · 축 = SECRET.iaiObiSayaAxis (없으면 대기 칼 축) */
export function obiRest(f, M = new THREE.Vector3(), D = new THREE.Vector3()) {
  obiPt(SECRET.iaiObiMouth, f.side, M);
  obiDir(SECRET.iaiObiSayaAxis ?? SECRET.iaiObiAxis, f.side, D);
  return { M, D };
}
/** 鞘引き 끝 (골반 몸체 틀): 왼손이 왼 허리 칼집 손 자리(SECRET.iaiSayaHip)에서 칼집 입 + iaiSayaKoi 를 쥠 → 칼집 입 M · 축 D */
export function obiPulled(f, M = new THREE.Vector3(), D = new THREE.Vector3()) {
  obiDir(SECRET.iaiObiPull, f.side, D);
  obiPt(SECRET.iaiSayaHip, f.side, M).addScaledVector(D, -(SECRET.iaiSayaKoi ?? 0.05));
  return { M, D };
}
/** 쉬는 칼집 입 쥠 (골반 몸체 틀 — 칼집 입 + 축 × iaiSayaKoi): 鞘戻し 점 (왼손이 칼집 입을 배꼽 앞 제자리로 돌려 놓는 자리) */
export function obiGrip(f, out = new THREE.Vector3()) {
  const { M, D } = obiRest(f, out, _d);
  return M.addScaledVector(D, SECRET.iaiSayaKoi ?? 0.05);
}
/** 골반 몸체 틀 점 → 월드 */
export function pelvisToWorld(f, v) {
  const r = f.bodies.pelvis.rotation();
  const t = f.bodies.pelvis.translation();
  return v.applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(_p.set(t.x, t.y, t.z));
}

/**
 * ① 대기 칼 자리를 덧씌우기 칸 꼴로 (thrustPose hand = 칼 원점(손) · dir = 칼날 — 가슴 원점 · 몸 헤딩 틀 f.yaw): 칼집 입 M(월드) − 축 × hiltLength = 칼 원점.
 *  hand · dir 배열에 넣음 (iaiReadyPose · iaiReadyPosePlayer · startIai 뽑는 자리)
 */
export function obiReadyInto(f, hand, dir) {
  const r = f.bodies.pelvis.rotation();
  const t = f.bodies.pelvis.translation();
  const qp = _q.set(r.x, r.y, r.z, r.w);
  const { M, D } = obiReady(f, _a, _d);
  M.applyQuaternion(qp).add(_p.set(t.x, t.y, t.z));
  D.applyQuaternion(qp);
  const c = f.bodies.chest.translation();
  M.addScaledVector(D, -f.weaponCfg.hiltLength).sub(_c.set(c.x, c.y, c.z));
  const yi = _qi.copy(f.yaw).invert();
  M.applyQuaternion(yi);
  D.applyQuaternion(yi);
  hand[0] = M.x;
  hand[1] = M.y;
  hand[2] = M.z;
  dir[0] = D.x;
  dir[1] = D.y;
  dir[2] = D.z;
}
/** 뽑는 길 시작 자리 B (startIai — 몸 헤딩 틀 yaw 쿼터니언 · 가슴 원점): { hand: [x, y, z], yaw °, el ° } — 대기 칼 자리 그대로 */
export function obiPathB(f) {
  const hand = [0, 0, 0];
  const dir = [0, 0, 0];
  obiReadyInto(f, hand, dir);
  return { hand, yaw: Math.atan2(dir[2], dir[0]) / D2R, el: Math.asin(Math.max(-1, Math.min(1, dir[1]))) / D2R };
}

// ── ② 빈 칼집 그림 ─────────────────────────────────────────────

/** 무기마다 칼집 빛깔 (그림만) — 칼자루 · 쇠붙이 색을 따름 [추정 — 그림으로 고름] */
const SAYA_LOOK = {
  uchigatana: { body: 0x17171a, fit: 0x2b2e33, rough: 0.32 }, // 검은 옻칠 · 쇠 (츠바 · 카시라 0x2b2e33)
  muramasa: { body: 0x2a1615, fit: 0x9b7c51, rough: 0.34 }, // 검붉은 옻칠 · 청동 (하바키 · 띠 0x9b7c51)
  kusanagi: { body: 0x1d3a37, fit: 0xb49b60, rough: 0.5 }, // 짙은 청록 · 금 (KUSANAGI_COLORS grip · gold)
  monohoshizao: { body: 0x141416, fit: 0xc9a14a, rough: 0.3 }, // 검은 옻칠 · 금 테 (츠바 금 테 0xc9a14a)
};

/**
 * 칼날 그림을 칼 원점 틀에서 재서 칼집 단면 줄을 짓는다: 칼날 시작(hiltLength)부터 칼끝까지 N 칸 — 칸마다 날 쪽 x 가운데(휨) · 반폭 · 반두께.
 *  칼집 = 그 줄을 감싼 겉(반폭 + 0.005 · 반두께 + 0.008 m — 날이 칼집 겉을 뚫지 않게) · 길이 = 칼끝 + 0.02 m (끝 쇠).
 */
function bladeProfile(swordGroup, bladeMesh, hilt, bladeLen, N = 18) {
  const lo = new Array(N + 1).fill(Infinity);
  const hi = new Array(N + 1).fill(-Infinity);
  const zz = new Array(N + 1).fill(0);
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  swordGroup.updateMatrixWorld(true);
  inv.copy(swordGroup.matrixWorld).invert();
  const root = bladeMesh ?? swordGroup;
  let yMax = hilt;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const pos = o.isMesh && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y < hilt - 1e-4) continue;
      yMax = Math.max(yMax, v.y);
    }
  });
  const span = Math.max(0.1, yMax - hilt);
  root.traverse((o) => {
    const pos = o.isMesh && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y < hilt - 1e-4) continue;
      const k = Math.max(0, Math.min(N, Math.round(((v.y - hilt) / span) * N)));
      lo[k] = Math.min(lo[k], v.x);
      hi[k] = Math.max(hi[k], v.x);
      zz[k] = Math.max(zz[k], Math.abs(v.z));
    }
  });
  // 빈 칸은 이웃 칸으로 메움 · 칼끝 칸은 좁아지니 칼집은 끝에서 조금만 좁힘(칼집 끝은 둥근 끝 쇠)
  for (let k = 0; k <= N; k++) {
    if (Number.isFinite(lo[k])) continue;
    const j = k > 0 ? k - 1 : k + 1;
    lo[k] = lo[j];
    hi[k] = hi[j];
    zz[k] = zz[j];
  }
  const rows = [];
  const w0 = (hi[0] - lo[0]) / 2;
  for (let k = 0; k <= N; k++) {
    const t = k / N;
    const cx = (lo[k] + hi[k]) / 2;
    const w = Math.max((hi[k] - lo[k]) / 2, w0 * (1 - 0.25 * t)); // 칼끝 쪽 좁아짐은 칼날 밑동 폭의 3/4 까지만 (칼집 끝이 바늘처럼 되지 않게)
    rows.push({ y: hilt + t * span, cx, hw: w + 0.005, ht: Math.max(zz[k], zz[0] * 0.6) + 0.008 });
  }
  if (!Number.isFinite(rows[0].cx)) return null;
  return { rows, len: span + 0.02, bladeLen };
}

/** 칼집 메쉬 (칼집 틀: 원점 = 칼집 입(칼날 시작) · +y = 칼끝 쪽 · +x = 날 쪽 · z = 칼 면) */
function sayaGroup(prof, look) {
  const g = new THREE.Group();
  g.name = 'iai-obi-saya';
  g.userData.visualOnly = true;
  const body = new THREE.MeshStandardMaterial({ color: look.body, roughness: look.rough, metalness: 0.05 });
  const fit = new THREE.MeshStandardMaterial({ color: look.fit, roughness: 0.38, metalness: 0.7 });
  const S = 10; // 단면 꼭짓점
  const R = prof.rows;
  const y0 = R[0].y;
  const len = prof.len;
  const rowAt = (y) => {
    const s = Math.max(0, Math.min(R.length - 1, ((y - y0) / (R.at(-1).y - y0)) * (R.length - 1)));
    const i = Math.min(R.length - 2, Math.floor(s));
    const w = s - i;
    const a = R[i];
    const b = R[i + 1];
    return { cx: a.cx + (b.cx - a.cx) * w, hw: a.hw + (b.hw - a.hw) * w, ht: a.ht + (b.ht - a.ht) * w };
  };
  // 몸 (끝은 둥근 끝 쇠 안으로 모임)
  const rings = 24;
  const pos = [];
  const idx = [];
  for (let r = 0; r <= rings; r++) {
    const y = (r / rings) * len;
    const q = rowAt(y0 + Math.min(y, R.at(-1).y - y0));
    const tip = Math.max(0, (y - (len - 0.03)) / 0.03); // 끝 3 cm 둥글게
    const sh = Math.sqrt(Math.max(0, 1 - tip * tip * 0.75));
    for (let s = 0; s < S; s++) {
      const a = (s / S) * Math.PI * 2;
      pos.push(q.cx + Math.cos(a) * q.hw * sh, y, Math.sin(a) * q.ht * sh);
    }
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < S; s++) {
      const a = r * S + s;
      const b = r * S + ((s + 1) % S);
      idx.push(a, a + S, b, b, a + S, b + S);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, body);
  m.castShadow = true;
  g.add(m);
  // 칼집 입 쇠(鯉口 — 짧은 고리) · 끝 쇠(鐺) · 끈 고리 혹(栗形 — 칼 면 바깥, 입에서 0.1 m)
  const q0 = rowAt(y0);
  const mouth = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.012, S), fit);
  mouth.scale.set(q0.hw + 0.0015, 1, q0.ht + 0.0015);
  mouth.position.set(q0.cx, 0.006, 0);
  g.add(mouth);
  const qe = rowAt(y0 + R.at(-1).y - y0);
  const end = new THREE.Mesh(new THREE.SphereGeometry(1, S, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), fit);
  end.scale.set(qe.hw * 0.62, 0.03, qe.ht * 0.62);
  end.position.set(qe.cx, len - 0.03, 0);
  g.add(end);
  const qk = rowAt(y0 + 0.1);
  const knob = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.022, 0.008), fit);
  knob.position.set(qk.cx - qk.hw * 0.35, 0.1, -(qk.ht + 0.002));
  g.add(knob);
  return g;
}

/**
 * 몸 f 에 빈 칼집을 단다 (fighter.js 생성자 — 무기 그림 뒤 · isolatedVisual 안): 골반 그림 그룹의 아이 · 그림만.
 *  다라이시(자기 빈 검집 — look.daraishiRevision · outfit silver_wanderer) · 김씨(허리 칼 renji-sheathed-sword 가 보임)는 달지 않음
 */
export function attachObiSaya(f, look) {
  f.obiSaya = null;
  if (!SECRET.iaiObiSaya || !obiOn(f) || !f.groups?.pelvis || !f.swordGroup) return null;
  if (ownScabbard(f, look)) return null;
  const prof = bladeProfile(f.swordGroup, f.bladeMesh, f.weaponCfg.hiltLength, f.weaponCfg.bladeLength);
  if (!prof) return null;
  const g = sayaGroup(prof, SAYA_LOOK[f.weapon.id] ?? SAYA_LOOK.uchigatana);
  f.groups.pelvis.add(g);
  const legR = { thighF: legRadius(f.groups.thighF), thighB: legRadius(f.groups.thighB) };
  f.obiSaya = { g, prof, k: 0, t: null, pulled: false, fw: 0, fPos: new THREE.Vector3(), fQuat: new THREE.Quaternion(), edge: f.weapon.id === 'monohoshizao' ? 1 : -1, legR }; // edge: 날 쪽 (obiSayaPose) · legR: 허벅지 그림 반지름 (obiPush)
  syncObiSaya(f);
  return g;
}
/**
 * 허벅지 그림(옷 — 하카마 · 자락 · 갑옷 포함)의 윗반 반지름: 허벅지 몸체 틀(축 = y)에서 엉덩이 쪽 반(y > −0.05)의 꼭짓점이 축에서 가장 먼 거리 —
 *  칼집을 그 굵기의 허벅지 캡슐 밖으로 밀어냄(obiPush — 다리를 들거나 비틀 때 칼집이 옷을 뚫지 않고 밀려남 · 다라이시 자락 셈의 교훈). 몸 캡슐 0.065 아래로는 안 내림 · 0.16 에서 자름
 */
function legRadius(group) {
  let r = 0.065;
  if (!group) return r;
  const v = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  group.updateMatrixWorld(true);
  inv.copy(group.matrixWorld).invert();
  group.traverse((o) => {
    const pos = o.isMesh && o.visible !== false && o.geometry?.attributes?.position;
    if (!pos) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      if (v.y > -0.05) r = Math.max(r, Math.hypot(v.x, v.z));
    }
  });
  return Math.min(0.16, r);
}
/** 자기 칼집 · 허리 칼이 있는 겉모습 (다라이시 빈 검집 · 김씨 허리 칼) */
export function ownScabbard(f, look) {
  if (look?.outfit && String(look.outfit).startsWith('silver_wanderer')) return true;
  if (look?.daraishiRevision != null || look?.daraishiScabbard != null) return true;
  const sw = f.groups?.pelvis?.getObjectByName?.('renji-sheathed-sword');
  return !!(sw && sw.visible !== false);
}

const _M0 = new THREE.Vector3();
const _D0 = new THREE.Vector3();
const _M1 = new THREE.Vector3();
const _D1 = new THREE.Vector3();
const _G0 = new THREE.Vector3();
const _G1 = new THREE.Vector3();
const _h = new THREE.Vector3();
const _x = new THREE.Vector3();
const _z = new THREE.Vector3();
const _mx = new THREE.Matrix4();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _sp = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);
/** 축 D 와 날 쪽(골반 위 · 아래 edge = ±1)으로 칼집 틀 쿼터니언 (x = 날 · y = 칼끝 쪽 · z = x × y) */
function frameQ(D, out, edge = 1) {
  _x.copy(_UP).addScaledVector(D, -D.y);
  if (_x.lengthSq() < 1e-8) _x.set(1, 0, 0);
  _x.normalize().multiplyScalar(edge < 0 ? -1 : 1);
  _z.crossVectors(_x, D);
  _mx.makeBasis(_x, D, _z);
  return out.setFromRotationMatrix(_mx);
}

/**
 * 왼손이 칼집을 쥔 몫 · 鞘引き 몫 (그림만 — 몸 필드를 읽기만):
 *  쥠 = 대기에서 낸 발도의 鞘引き(iai.saya) · 그 뒤 굳음 · 풀기(iaiOneHold — 鞘引き 한 판) · 다시 쥐기 앞 반(鞘戻し — iaiRegripVia · 몫 0.5 까지)
 *  (대기 동안 왼손은 칼집 입을 칼째 쥠 — 칼집이 칼을 감쌈 · obiSayaPose)
 *  鞘引き 몫 k = 왼손을 대기 쥠 자리 G0 → 왼 허리 G1 줄에 내린 몫 (쥘 때만 · 놓으면 0 으로 iaiRegrip 초에)
 */
export function obiSayaK(f) {
  const S = f.obiSaya;
  if (!S) return 0;
  const draw = !!f.iai?.saya;
  if (draw) S.pulled = true;
  const rg = f.iaiRegripT > 0 && f.iaiRegripVia ? 1 - f.iaiRegripT / Math.max(1e-6, f.iaiRegripDur || 1) : null;
  if (S.pulled && !draw && !f.iaiOneHold && !(f.iaiHoldT > 0) && !(f.iaiFade > 0) && (rg == null || rg > 0.5)) S.pulled = false;
  const hold = S.pulled && f.alive && f.limbs?.armO > 0.3 && f.bodies.farmO;
  let kT = 0;
  if (hold) {
    obiGrip(f, _G0);
    obiPt(SECRET.iaiSayaHip, f.side, _G1);
    const fo = f.bodies.farmO;
    const r = fo.rotation();
    const t = fo.translation();
    _h.set(0, -0.135, 0).applyQuaternion(_qa.set(r.x, r.y, r.z, r.w)).add(_sp.set(t.x, t.y, t.z));
    const pr = f.bodies.pelvis.rotation();
    const pt = f.bodies.pelvis.translation();
    _h.sub(_sp.set(pt.x, pt.y, pt.z)).applyQuaternion(_qa.set(pr.x, pr.y, pr.z, pr.w).invert());
    const seg = _G1.sub(_G0);
    kT = Math.max(0, Math.min(1, _h.sub(_G0).dot(seg) / Math.max(1e-6, seg.lengthSq())));
  }
  // 놓으면(쥠 끝 · 넘어짐 · 죽음) 제자리로 iaiRegrip 초에 (시계 = 기력 시계 stamina.time — 그림만)
  const now = f.stamina?.time ?? 0;
  const dt = S.t != null ? Math.max(0, now - S.t) : 0;
  S.t = now;
  S.k = hold ? kT : Math.max(0, S.k - dt / Math.max(1e-3, SECRET.iaiRegrip || 0.2));
  if (S.fw > 0 && (f.iai || f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0)) S.fw = Math.max(0, S.fw - dt / Math.max(1e-3, SECRET.iaiRegrip || 0.2)); // 감싼 몫을 걷음 (위 obiSayaPose)
  return S.k;
}

/**
 * 칼집 자리 (골반 몸체 틀): 제자리 ↔ 鞘引き 끝을 k 로 섞고, 대기 동안(iaiObiW — 대기 칼 자리 몫) 칼을 감싸 지금 칼 자리로 —
 *  지금 칼이 대기 칼 자리(obiReady)에서 SECRET.iaiObiFollow 한도(칼집 입 m · 축 °)를 넘게 벗어나면 넘은 만큼 덜 따르고 한도 두 배에서 안 따름(허리띠를 떠나 떠 보이지 않게) ·
 *  뽑기 · 굳음 · 풀기 동안은 감싼 자리를 그대로 두되 鞘引き 몫(k)만큼 · iaiRegrip 초에 걷음.
 *  끝으로 골반 · 배 상자를 뚫은 몫만큼 바깥으로 밀어냄(obiPush). out: { pos, quat } (칼집 틀 원점 = 칼집 입 · 골반 몸체 틀) — 시험 · 재기 도구도 같은 셈을 씀
 */
export function obiSayaPose(f, out = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), follow: 0, k: 0, push: 0 }) {
  const k = obiSayaK(f);
  obiRest(f, _M0, _D0);
  obiPulled(f, _M1, _D1);
  // 칼집 입은 골반 세로축 둘레로 돌아 감 (배꼽 앞 → 왼 허리 — 몸 모서리를 가로질러 뚫지 않게: 둘레 각 · 반지름 · 높이를 섞음)
  const a0 = Math.atan2(_M0.z, _M0.x), a1 = Math.atan2(_M1.z, _M1.x);
  const r0 = Math.hypot(_M0.x, _M0.z), r1 = Math.hypot(_M1.x, _M1.z);
  const ak = a0 + (a1 - a0) * k, rk = r0 + (r1 - r0) * k;
  out.pos.set(Math.cos(ak) * rk, _M0.y + (_M1.y - _M0.y) * k, Math.sin(ak) * rk);
  // 쉬는 칼집의 날 쪽 = 대기 칼의 날 쪽 (이 게임 대기 칼은 날이 아래 — 사람 모노호시자오 허리 대기만 위 · 감쌀 때 칼집이 칼 둘레로 반 바퀴 돌지 않게 · 아래에서 감쌀 때마다 고침)
  const edge = f.obiSaya?.edge ?? 1;
  frameQ(_D0, _qa, edge);
  frameQ(_D1, _qb, edge);
  out.quat.copy(_qa).slerp(_qb, k);
  out.k = k;
  out.follow = 0;
  out.push = 0;
  // 대기 동안 칼을 감쌈 (칼 원점 틀 → 골반 몸체 틀). 발도 · 굳음 · 풀기 동안은 감싼 자리를 그대로 두고(칼이 칼집 입에서 나감) 그 몫을 iaiRegrip 초에 걷음 — 鞘引き 가 칼집을 허리로 데려감
  const S = f.obiSaya;
  const busy = !!f.iai || !!f.iaiReq || f.iaiHoldT > 0 || f.iaiFade > 0;
  const sw = busy ? 0 : f.iaiObiW ?? 0;
  if (S && busy && S.fw > 0) {
    const w = S.fw * (1 - k); // 鞘引き 로 왼손이 칼집을 허리로 데려가는 만큼 감싼 자리를 놓음 (왼손 ↔ 칼집 입이 떨어지지 않게)
    out.pos.lerp(S.fPos, w);
    out.quat.slerp(S.fQuat, w);
    out.follow = w;
  } else if (S) S.fw = 0;
  if (sw > 0 && f.sword && f.armed) {
    const pr = f.bodies.pelvis.rotation();
    const pt = f.bodies.pelvis.translation();
    const qpi = _qs.set(pr.x, pr.y, pr.z, pr.w).invert();
    const r = f.sword.rotation();
    const t = f.sword.translation();
    const qw = _qw.set(r.x, r.y, r.z, r.w);
    const ql = _ql.copy(qpi).multiply(qw);
    const Ms = _ms.set(0, f.weaponCfg.hiltLength, 0).applyQuaternion(qw).add(_sp.set(t.x, t.y, t.z)).sub(_sp.set(pt.x, pt.y, pt.z)).applyQuaternion(qpi);
    const Ds = _ds.set(0, 1, 0).applyQuaternion(ql);
    // 비킴은 대기 칼 자리(칼 목표 — obiReady)에서 잼: 칼이 그 자리 곁이면 다 감쌈
    const R = obiReady(f, _mr, _dk);
    const L = SECRET.iaiObiFollow ?? { m: 0.06, deg: 20 };
    const dm = Ms.distanceTo(R.M);
    const da = Math.acos(Math.max(-1, Math.min(1, Ds.dot(R.D)))) / D2R;
    const over = Math.max(dm / L.m, da / L.deg);
    const w = sw * (over <= 1 ? 1 : Math.max(0, 2 - over)); // 한도 안 = 다 따름 · 한도 두 배에서 0
    if (w > 0) {
      out.pos.lerp(Ms, w);
      out.quat.slerp(ql, w);
      out.follow = w;
    }
    if (S) {
      S.fPos.copy(Ms);
      S.fQuat.copy(ql);
      S.fw = w;
      // 감싼 칼의 날 쪽(위 · 아래 — 칼 x 를 골반 위로 견줌)을 쉬는 칼집 날 쪽으로 (다 감쌌을 때만 · 0.5 넘게 기울 때만 바꿈)
      if (w >= 0.9) {
        const e = _ex.set(1, 0, 0).applyQuaternion(ql).dot(_x.copy(_UP).addScaledVector(Ds, -Ds.y).normalize());
        if (Math.abs(e) > 0.5) S.edge = e > 0 ? 1 : -1;
      }
    }
  }
  if (f.obiSaya) {
    _q0.copy(out.quat);
    out.ground = obiGround(f, out.pos, out.quat); // 땅 (넘어짐 · 죽음 — 누운 몸의 칼집이 땅으로 들지 않게 입을 축으로 눕힘)
    out.push = obiPush(f, out.pos, out.quat, _q0);
  }
  return out;
}

// 골반 · 배 · 가슴 상자 — 칼집 밀어냄: 기본 겉모습 그림 상자(fighter.js dressPart — 골반 0.21 × 0.18 × 0.33 · 배 0.22 × 0.155 × 0.32 + 허리띠 0.235 × 0.04 × 0.335)의 반 크기
//  (몸 상자 partDefs 골반 0.1 · 0.085 · 0.16 · 배 0.1 · 0.07 · 0.15 보다 0.5 ~ 1.75 cm 큼) + 겉 여유 SECRET.iaiObiSkin
const PELVIS_BOX = [0.105, 0.09, 0.165];
const ABDOMEN_BOX = [0.1175, 0.0775, 0.1675];
const CHEST_BOX = [0.12, 0.14, 0.185]; // 가슴 그림 상자 0.24 × 0.28 × 0.37 (몸 0.11 · 0.13 · 0.18) — 웅크려 숙인 가슴이 긴 칼집 위로 올 때
const _bc = new THREE.Vector3();
const _bq = new THREE.Quaternion();
const _bl = new THREE.Vector3();
const _bn = new THREE.Vector3();
const _bx = new THREE.Vector3();
const _bz = new THREE.Vector3();
const _bp = new THREE.Vector3();
const _bs = new THREE.Vector3();
/** 상자(반 크기 h · 가운데 c · 회전 q — 골반 틀) 부호 거리 · 바깥 쪽 (골반 틀) */
function boxSd(p, c, q, h, nOut) {
  _bl.copy(p).sub(c).applyQuaternion(_bq.copy(q).invert());
  const qx = Math.abs(_bl.x) - h[0], qy = Math.abs(_bl.y) - h[1], qz = Math.abs(_bl.z) - h[2];
  const mx = Math.max(qx, qy, qz);
  if (mx > 0) {
    nOut.set(Math.max(qx, 0) * Math.sign(_bl.x), Math.max(qy, 0) * Math.sign(_bl.y), Math.max(qz, 0) * Math.sign(_bl.z));
    const o = nOut.length();
    nOut.multiplyScalar(1 / Math.max(1e-9, o)).applyQuaternion(q);
    return o;
  }
  if (mx === qx) nOut.set(Math.sign(_bl.x) || 1, 0, 0);
  else if (mx === qy) nOut.set(0, Math.sign(_bl.y) || 1, 0);
  else nOut.set(0, 0, Math.sign(_bl.z) || 1);
  nOut.applyQuaternion(q);
  return mx;
}
/**
 * 칼집을 골반 · 배 · 가슴 상자 · 허벅지 캡슐(그림 윗반 굵기 legR) 밖으로 (골반 틀 pos · quat 를 고침): 칼집 축 점(단면 줄 가운데 — 칼날 길이 18 칸을 다시 넷으로 · 끝 쇠까지)에서 그 쪽 단면 반지름(타원 — 날 쪽 반폭 · 면 쪽 반두께) + 겉 여유 SECRET.iaiObiSkin 만큼
 *  상자 안으로 든 가장 깊은 몫을 그 상자 바깥 쪽으로 옮김 (열 번까지). 배 상자는 지금 배 몸체 자리(골반 틀로). 옮긴 길이(m)를 돌려줌
 */
export function obiPush(f, pos, quat, quat0 = null) {
  const S = f.obiSaya;
  const skin = SECRET.iaiObiSkin ?? 0.006;
  const pr = f.bodies.pelvis.rotation();
  const pt = f.bodies.pelvis.translation();
  const qpi = _qs.set(pr.x, pr.y, pr.z, pr.w).invert();
  const boxes = [[_zero, _ident, PELVIS_BOX]];
  for (const [name, H, C, Q] of [['abdomen', ABDOMEN_BOX, _ac, _aq], ['chest', CHEST_BOX, _cc, _cq]]) {
    const b = f.bodies[name];
    if (!b) continue;
    const at = b.translation();
    const ar = b.rotation();
    boxes.push([C.set(at.x - pt.x, at.y - pt.y, at.z - pt.z).applyQuaternion(qpi), Q.copy(qpi).multiply(_qw.set(ar.x, ar.y, ar.z, ar.w)), H]);
  }
  // 허벅지 캡슐 (축 = 허벅지 몸체 y · 반 길이 0.15 — fighter.js partDefs · 반지름 = 그림 윗반 반지름 legR) — 골반 틀
  const legs = [];
  for (const [name, A0, B0] of [['thighF', _la, _lb], ['thighB', _lc, _ld]]) {
    const b = f.bodies[name];
    if (!b) continue;
    const at = b.translation();
    const ar = b.rotation();
    const q = _lq.copy(qpi).multiply(_qw.set(ar.x, ar.y, ar.z, ar.w));
    const c = _lo.set(at.x - pt.x, at.y - pt.y, at.z - pt.z).applyQuaternion(qpi);
    A0.set(0, 0.15, 0).applyQuaternion(q).add(c);
    B0.set(0, -0.15, 0).applyQuaternion(q).add(c);
    legs.push([A0, B0, S.legR?.[name] ?? 0.065]);
  }
  // 땅 (골반 틀 — 위 방향 · 골반 원점의 땅 위 높이): 몸 상자에 밀려 땅으로 든 몫도 같은 셈으로 밀어냄 (평지 무대 0 · 지형 무대는 골반 아래 땅 높이)
  const ground = _gp;
  ground.up.set(0, 1, 0).applyQuaternion(qpi);
  ground.h = pt.y - (f.groundHeightAt?.(pt.x, pt.z) ?? 0);
  const solve = (g) => {
    let moved = 0;
    let worst = 0;
    for (let it = 0; it < 10; it++) {
      worst = sayaPen(S, pos, quat, boxes, legs, skin, _bs, g);
      if (worst <= 1e-5) break;
      pos.addScaledVector(_bs, worst + 0.001); // 1 mm 더 (골반 · 배 두 상자가 맞닿는 모서리에서 번갈아 밀리며 덜 빠지지 않게)
      moved += worst + 0.001;
    }
    return [moved, sayaPen(S, pos, quat, boxes, legs, skin, _bs, g)];
  };
  _po.copy(pos);
  _qs1.copy(quat);
  let [moved, left] = solve(ground);
  if (left <= 0.002) { S.turn = null; return moved; }
  const turnAt = (a) => {
    pos.copy(_po);
    quat.copy(quat0);
    obiGround(f, pos, quat, a, true);
    [moved, left] = solve(ground);
    return left <= 0.002;
  };
  if (quat0 && S.turn != null && turnAt(S.turn)) return moved; // 지난 스텝에 찾은 방향 그대로 (누워 있는 동안 같은 자리 — 셈 한 번)
  // 몸과 땅 사이에 끼임 (엎어지거나 왼쪽으로 누운 몸 — 배 앞 칼집 입이 몸 아래): 칼집을 골반 옆(칼집 쪽)으로 빼며 둘 다 비키는 자리를 찾음 (3 cm 씩 · 24 cm 까지)
  quat.copy(_qs1);
  _pl.set(0, 1, 0).applyQuaternion(quat).multiplyScalar(S.prof.len * 0.5).add(_po);
  const side = _pl.z < 0 ? -1 : 1;
  const ks = S.slideK ? [S.slideK, 1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8]; // 지난 스텝에 찾은 만큼부터
  for (const k of ks) {
    pos.copy(_po).add(_pl.set(0, 0, side * 0.03 * k));
    [moved, left] = solve(ground);
    if (left <= 0.002) { S.turn = null; S.slideK = k; return moved + 0.03 * k; }
  }
  S.slideK = 0;
  // 그래도 끼면(왼쪽으로 누운 몸 — 칼집 쪽이 땅): 칼집을 땅 위에 뉘인 채 수평 방향을 돌려 몸 밖 · 땅 위 자리를 찾음 (30° 씩 · 찾은 방향은 다음 스텝에 먼저)
  if (quat0) {
    for (const a of TURNS) {
      if (a === S.turn) continue;
      if (turnAt(a)) { S.turn = a; return moved; }
    }
  }
  S.turn = null;
  // 못 찾으면 몸을 먼저 — 땅 때문에 눕히기 전 칼집으로 되돌려 몸 밖으로만 (왼쪽으로 누운 몸: 칼집이 골반과 땅 사이 — 눕히면 골반을 지나고, 그대로면 몸 아래 땅으로 들어 몸에 가려짐)
  pos.copy(_po);
  if (quat0) quat.copy(quat0);
  return solve(null)[0];
}
const _q0 = new THREE.Quaternion();
const _qs1 = new THREE.Quaternion();
const TURNS = [30, -30, 60, -60, 90, -90, 120, -120, 150, -150, 180];
const _po = new THREE.Vector3();
const _pl = new THREE.Vector3();
/**
 * 칼집 겉(단면 줄 사이 넷 · 칼집 끝 쇠까지)이 몸 상자 · 허벅지 캡슐 안으로 가장 깊이 든 값 (m — 음수면 가장 가까운 틈) · nW = 그 곳 몸 바깥 쪽
 *  boxes = [[중심 · 돌림 · 반 크기]] · legs = [[축 끝 A · B · 반지름]] — 모두 골반 틀
 */
function sayaPen(S, pos, quat, boxes, legs, skin, nW, ground = null) {
  const R = S.prof.rows;
  _bx.set(1, 0, 0).applyQuaternion(quat);
  _bz.set(0, 0, 1).applyQuaternion(quat);
  let worst = -Infinity;
  nW.set(0, 0, 0);
  const SUB = 4; // 단면 줄 사이를 넷으로 (줄 간격 4 ~ 5 cm — 모서리를 비스듬히 지나는 곳을 놓치지 않게)
  for (let j = 0; j <= R.length * SUB; j++) {
    const i = Math.min(R.length - 1, Math.floor(j / SUB));
    const i2 = Math.min(R.length - 1, i + 1);
    const u = j / SUB - i;
    const a = R[i];
    const b = R[i2];
    const row = _row;
    row.cx = a.cx + (b.cx - a.cx) * u;
    row.hw = a.hw + (b.hw - a.hw) * u;
    row.ht = a.ht + (b.ht - a.ht) * u;
    const yy = Math.min(S.prof.len - 0.01, a.y + (b.y - a.y) * u - R[0].y + (j >= R.length * SUB ? S.prof.len - (R.at(-1).y - R[0].y) - 0.01 : 0)); // 마지막 = 끝 쇠(칼끝 너머 0.02 m)
    _bp.set(row.cx, yy, 0).applyQuaternion(quat).add(pos);
    for (const [c, q, h] of boxes) {
      const sd = boxSd(_bp, c, q, h, _bn);
      const rr = Math.hypot(row.hw * _bn.dot(_bx), row.ht * _bn.dot(_bz)) + skin;
      const pen = rr - sd;
      if (pen > worst) {
        worst = pen;
        nW.copy(_bn);
      }
    }
    for (const [A0, B0, LR] of legs) {
      _ls.subVectors(B0, A0);
      const v = Math.max(0, Math.min(1, _bn.subVectors(_bp, A0).dot(_ls) / Math.max(1e-9, _ls.lengthSq())));
      _bn.copy(A0).addScaledVector(_ls, v);
      _bn.subVectors(_bp, _bn);
      const d = _bn.length();
      if (d < 1e-6) continue;
      _bn.multiplyScalar(1 / d);
      const rr = Math.hypot(row.hw * _bn.dot(_bx), row.ht * _bn.dot(_bz)) + skin;
      const pen = rr + LR - d;
      if (pen > worst) {
        worst = pen;
        nW.copy(_bn);
      }
    }
    if (ground) {
      const rr = Math.hypot(row.hw * ground.up.dot(_bx), row.ht * ground.up.dot(_bz)) + skin;
      const pen = rr - (ground.h + _bp.dot(ground.up));
      if (pen > worst) {
        worst = pen;
        nW.copy(ground.up);
      }
    }
  }
  return worst;
}
const _gp = { up: new THREE.Vector3(), h: 0 };
/**
 * 땅 (11/14 — 넘어짐 · 죽음): 칼집은 골반 틀에 붙어 있어 누운 몸(위를 보고 누움)에서는 뒤 아래로 뻗은 칼집이 땅으로 듦(우치가타나 6 cm · 모노호시자오 64 cm — 첫 재기).
 *  칼집 끝(鐺)이 땅 위 (단면 반지름 + 겉 여유)에 오도록 칼집을 입을 축으로 돌려 눕힘 — 수평 방향(어디로 뻗나)은 그대로 · 아래로 기운 몫만 줄임.
 *  그림만 · 땅 높이는 몸이 쓰는 그대로(fighter.groundHeightAt — 평지 무대 0). 남은 작은 몫은 obiPush 가 땅 위로 밀어냄. 돌린 각(도)을 돌려줌
 */
function obiGround(f, pos, quat, turn = 0, force = false) {
  const S = f.obiSaya;
  if (!S) return 0;
  const R = S.prof.rows;
  S.gR ??= Math.max(...R.map((r) => Math.abs(r.cx) + Math.max(r.hw, r.ht)));
  const pr = f.bodies.pelvis.rotation();
  const pt = f.bodies.pelvis.translation();
  const qp = _gq.set(pr.x, pr.y, pr.z, pr.w);
  const Dl = _gl.set(0, 1, 0).applyQuaternion(quat);
  const D = _gd.copy(Dl).applyQuaternion(qp);
  const M = _gm.copy(pos).applyQuaternion(qp).add(_gt.set(pt.x, pt.y, pt.z));
  const L = S.prof.len;
  const gy = Math.max(f.groundHeightAt?.(M.x, M.z) ?? 0, f.groundHeightAt?.(M.x + D.x * L, M.z + D.z * L) ?? 0);
  const need = (S.gR + (SECRET.iaiObiSkin ?? 0.006) + gy - M.y) / L; // 칼집 끝이 땅 위에 남는 가장 작은 위 성분
  if (D.y >= need && !force) return 0;
  const yN = Math.min(0.9, Math.max(need, force ? Math.min(D.y, 0.9) : need));
  let h = Math.hypot(D.x, D.z);
  if (h < 1e-4) { D.set(0, 0, -1).applyQuaternion(qp); D.y = 0; h = Math.hypot(D.x, D.z) || 1; } // 곧장 아래면 골반 왼쪽으로 눕힘
  if (turn) D.applyAxisAngle(_UP, turn * D2R); // 수평 방향을 돌림 (obiPush — 몸과 땅 사이에 끼었을 때 땅 위로 뉘일 쪽 찾기)
  const c = Math.sqrt(1 - yN * yN) / h;
  const Dn = _gn.set(D.x * c, yN, D.z * c).applyQuaternion(qp.invert()); // 골반 틀
  const ang = Dl.angleTo(Dn);
  quat.premultiply(_gf.setFromUnitVectors(Dl, Dn));
  return ang / D2R;
}
const _gq = new THREE.Quaternion();
const _gf = new THREE.Quaternion();
const _gl = new THREE.Vector3();
const _gd = new THREE.Vector3();
const _gm = new THREE.Vector3();
const _gt = new THREE.Vector3();
const _gn = new THREE.Vector3();
const _zero = new THREE.Vector3();
const _row = { cx: 0, hw: 0, ht: 0 };
const _la = new THREE.Vector3();
const _lb = new THREE.Vector3();
const _lc = new THREE.Vector3();
const _ld = new THREE.Vector3();
const _lq = new THREE.Quaternion();
const _lo = new THREE.Vector3();
const _ls = new THREE.Vector3();
const _ident = new THREE.Quaternion();
const _ac = new THREE.Vector3();
const _aq = new THREE.Quaternion();
const _cc = new THREE.Vector3();
const _cq = new THREE.Quaternion();
const _qw = new THREE.Quaternion();
const _ql = new THREE.Quaternion();
const _ms = new THREE.Vector3();
const _ds = new THREE.Vector3();
const _dk = new THREE.Vector3();
const _mr = new THREE.Vector3();
const _ex = new THREE.Vector3();

const _pose = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), follow: 0, k: 0 };
/** 그릴 때마다 (fighter.js syncMeshes — 그림만): 칼집 그룹을 골반 그림 그룹 안 자리로 */
export function syncObiSaya(f) {
  const S = f.obiSaya;
  if (!S) return;
  const P = obiSayaPose(f, _pose);
  S.g.position.copy(P.pos);
  S.g.quaternion.copy(P.quat);
}
