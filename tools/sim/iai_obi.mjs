// ─────────────────────────────────────────────────────────────
//  iai_obi.mjs — 帯刀 대기 칼 자리 · 빈 칼집 재기 (사장님 11/14 결정 "권고대로 둘 다 진행해" — 기록 docs/strike/iai_obi_2026-11-14.md · src/iai_obi.js).
//   재기만 한다 — 게임 값은 --set 으로 이 프로세스 안에서만.
//  ready: 발도 대기에 들어 1.5 s — 사람 허리 대기(강제 iaiReadyPosePlayer standing) · AI 웅크린 대기(iaiReadyPose) × 무기:
//   칼날 시작(칼집 입) · 코등이 골반 틀 자리 · 칼 축 · 목표(대기 칼 자리)와 어긋남 · 칼집이 칼을 감싼 몫 · 칼날 ↔ 칼집 (칼날 점이 칼집 단면 밖으로 나온 가장 큰 몫)
//  saya: 칼집 뚫음 · 틈 — 동작 대본(서기 · 걷기 · 달리기 · 낮은 걸음 · 발도 대기 · 뽑기 · 잔심 · 다시 쥐기 · 밀치기 묶임 · 맞음 · 넘어짐 · 쓰러져 죽음)을 스텝마다:
//   칼집 겉(단면 둘레 점 — 칼집 그림과 같은 단면 줄)에서 ① 골반 · 배 상자(물리 몸)까지 가장 가까운 틈(+ = 떨어짐 · − = 뚫음) — 떠 보임은 쉬는 칼집(제자리 · 鞘引き)이 몸에서 떨어진 몫 ·
//   ② 다리(허벅지 · 정강이 캡슐) · 몸통(골반 · 배 · 가슴 상자) · 칼 든 팔 뚫음 깊이(겉 점이 그 몸 안으로 든 가장 큰 깊이) · ③ 겉모습 그림(골반 · 배 · 다리 · 옷 메쉬)을
//   칼집 축이 지나는가(다라이시 자락 뚫림 셈과 같은 꼴 — 축 선분 ↔ 삼각형) · 축에서 그림 겉까지 가장 가까움.
//   AI 대 AI 싸움(fight — 씨앗마다 30 s · 일본 칼 숙련 5 대 롱소드 숙련 3)도 같은 셈으로 (걸음 · 맞음 · 넘어짐 · 죽음 · 붙음이 저절로).
//  node tools/sim/iai_obi.mjs ready [--weapons=uchigatana,muramasa,kusanagi,monohoshizao] [--set=…] [--json=…]
//  node tools/sim/iai_obi.mjs saya [--weapons=…] [--looks=player,minami,…] [--set=…] [--json=…]
//  node tools/sim/iai_obi.mjs fight [--weapons=…] [--seeds=1-6] [--look=…] [--set=…] [--json=…]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE, AI } from './harness_m.mjs';
import { applySets } from './rapier_defence.mjs';
import { iaiReadyPose, iaiReadyPosePlayer, requestIai } from '../../src/secret_instant.js';
import { obiReady, obiSayaPose, sageoPoints } from '../../src/iai_obi.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
import { isMain } from './is_main.mjs';

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const tv = (t) => new THREE.Vector3(t.x, t.y, t.z);
const tq = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const R2D = 180 / Math.PI;
export const WEAPONS = ['uchigatana', 'muramasa', 'kusanagi', 'monohoshizao'];
/** 겉모습: player = 주인공(LOOKS.player) · 그 밖 = 인물 시트 look */
export function lookOf(id) {
  if (!id || id === 'player') return LOOKS.player;
  const c = CHARACTERS_BY_ID[id];
  if (!c) throw new Error(`인물 없음 ${id}`);
  return c.look;
}
/** 몸 f 의 골반 몸체 틀로 (월드 점 → [앞, 위, 칼 든 쪽 +]) */
function pelvisLocal(f, p) {
  const c = tv(f.bodies.pelvis.translation());
  const v = p.clone().sub(c).applyQuaternion(tq(f.bodies.pelvis.rotation()).invert());
  return [v.x, v.y, v.z * f.side];
}

// ── 몸 모양: 골반 · 배 = 기본 겉모습 그림 상자(fighter.js dressPart — 몸 상자 partDefs 보다 0.5 ~ 1.75 cm 큼 · 배는 허리띠 포함) · 그 밖 = 몸(partDefs 반 크기 · 캡슐 반 길이 · 반지름) ──
const BOX = { pelvis: [0.105, 0.09, 0.165], abdomen: [0.1175, 0.0775, 0.1675], chest: [0.11, 0.13, 0.18] };
const CAP = { thighF: [0.15, 0.065], thighB: [0.15, 0.065], shinF: [0.16, 0.05], shinB: [0.16, 0.05], uarmS: [0.105, 0.045], farmS: [0.095, 0.04], uarmO: [0.105, 0.045], farmO: [0.095, 0.04] };
const ALONG_X = new Set(['uarmS', 'farmS']);
const _l = new THREE.Vector3();
const _qi = new THREE.Quaternion();
/** 점 p(월드) ↔ 몸 조각의 부호 거리 (+ = 밖 · − = 안 깊이) */
function sdPart(f, name, p) {
  const b = f.bodies[name];
  if (!b) return Infinity;
  const t = b.translation();
  _l.set(p.x - t.x, p.y - t.y, p.z - t.z).applyQuaternion(_qi.copy(tq(b.rotation())).invert());
  if (BOX[name]) {
    const h = BOX[name];
    const qx = Math.abs(_l.x) - h[0], qy = Math.abs(_l.y) - h[1], qz = Math.abs(_l.z) - h[2];
    const o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
    return o + Math.min(Math.max(qx, qy, qz), 0);
  }
  const [hh, r] = CAP[name];
  // 캡슐 축: 팔(alongX) 은 몸체 x · 그 밖 y
  const a = ALONG_X.has(name) ? _l.x : _l.y;
  const c = Math.max(-hh, Math.min(hh, a));
  const d = ALONG_X.has(name) ? Math.hypot(_l.x - c, _l.y, _l.z) : Math.hypot(_l.x, _l.y - c, _l.z);
  return d - r;
}

/** 칼집 겉 점 (월드): 칼집 그림과 같은 단면 줄(prof.rows — 칼 원점 틀 x 가운데 · 반폭 · 반두께) · 칼집 틀(pose — 골반 틀) → 월드. rings × S 점 */
const _sp = { pos: new THREE.Vector3(), quat: new THREE.Quaternion(), follow: 0, k: 0, push: 0 };
export function sayaSurface(f, rings = 48, S = 16) { // 48 × 16 (11/14 — 16 × 8 은 칼집이 몸 상자 모서리를 비스듬히 지나는 곳을 건너뛰어 쉬는 틈을 0.7 ~ 1 cm 크게 읽었음)
  const P = obiSayaPose(f, _sp);
  const prof = f.obiSaya.prof;
  const R = prof.rows;
  const y0 = R[0].y;
  const pq = tq(f.bodies.pelvis.rotation());
  const pt = tv(f.bodies.pelvis.translation());
  const pts = [];
  const axis = [];
  for (let r = 0; r <= rings; r++) {
    const y = (r / rings) * (prof.len - 0.01);
    const s = Math.min(R.length - 1, ((Math.min(y, R.at(-1).y - y0)) / (R.at(-1).y - y0)) * (R.length - 1));
    const i = Math.min(R.length - 2, Math.floor(s));
    const w = s - i;
    const cx = R[i].cx + (R[i + 1].cx - R[i].cx) * w;
    const hw = R[i].hw + (R[i + 1].hw - R[i].hw) * w;
    const ht = R[i].ht + (R[i + 1].ht - R[i].ht) * w;
    const toW = (x, z) => new THREE.Vector3(x, y, z).applyQuaternion(P.quat).add(P.pos).applyQuaternion(pq).add(pt);
    axis.push(toW(cx, 0));
    for (let k = 0; k < S; k++) {
      const a = (k / S) * Math.PI * 2;
      pts.push(toW(cx + Math.cos(a) * hw, Math.sin(a) * ht));
    }
  }
  return { pts, axis, pose: P };
}

/** 한 스텝 셈: 칼집 겉 ↔ 몸 */
export function sayaMeasure(f) {
  const { pts, axis, pose } = sayaSurface(f);
  const m = { follow: pose.follow, k: pose.k, push: pose.push };
  const minOf = (names) => {
    let best = Infinity;
    let at = null;
    for (const n of names) for (const p of pts) { const d = sdPart(f, n, p); if (d < best) (best = d), (at = n); }
    return { d: best, at };
  };
  const torso = minOf(['pelvis', 'abdomen']);
  m.gap = torso.d; // 골반 · 배 겉까지 (− = 뚫음)
  m.gapAt = torso.at;
  m.chest = minOf(['chest']).d;
  const legs = minOf(['thighF', 'thighB', 'shinF', 'shinB']);
  m.leg = legs.d;
  m.legAt = legs.at;
  m.armS = minOf(['uarmS', 'farmS']).d;
  let g = Infinity;
  for (const p of pts) g = Math.min(g, p.y - (f.groundHeightAt?.(p.x, p.z) ?? 0));
  m.ground = g; // 땅 위 높이 가장 낮음 (− = 땅으로 듦 · 넘어짐 · 죽음)
  m.swing = pose.ground ?? 0; // 땅 때문에 눕힌 각 (도)
  m.axis = axis;
  // 사게오 끈 (11/14 — src/iai_obi.js sageoPoints): 끈 가운데 줄 점(월드) ↔ 골반 · 배 · 다리 · 가슴 · 땅 (끈 반지름 0.0035 를 뺀 겉 거리)
  const S = f.obiSaya;
  if (S?.cord) {
    const pts = sageoPoints(f, S, pose, Array.from({ length: 13 }, () => new THREE.Vector3()));
    const pq = tq(f.bodies.pelvis.rotation());
    const pt = tv(f.bodies.pelvis.translation());
    const W = pts.map((p) => p.clone().applyQuaternion(pq).add(pt));
    const mn = (names) => { let b = Infinity; for (const n of names) for (const p of W.slice(1, -1)) b = Math.min(b, sdPart(f, n, p) - 0.0035); return b; };
    let g2 = Infinity;
    for (const p of W) g2 = Math.min(g2, p.y - (f.groundHeightAt?.(p.x, p.z) ?? 0) - 0.0035);
    m.cord = { torso: mn(['pelvis', 'abdomen']), leg: mn(['thighF', 'thighB', 'shinF', 'shinB']), chest: mn(['chest']), ground: g2, len: W[0].distanceTo(W.at(-1)), axis: W };
  }
  return m;
}

/** 칼날 ↔ 칼집 (대기 동안 — 칼이 칼집 안으로 보이나): 칼날 축 점(칼날 시작 → 칼끝 · 날 쪽 · 등 쪽 점)이 칼집 단면(같은 높이 줄의 타원) 밖으로 나온 가장 큰 몫 (m) */
export function bladeOutside(f) {
  const P = obiSayaPose(f, _sp);
  const prof = f.obiSaya.prof;
  const R = prof.rows;
  const pq = tq(f.bodies.pelvis.rotation());
  const pt = tv(f.bodies.pelvis.translation());
  const toSaya = (w) => w.clone().sub(pt).applyQuaternion(pq.clone().invert()).sub(P.pos).applyQuaternion(P.quat.clone().invert());
  const q = tq(f.sword.rotation());
  if (f.obiEdge?.roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), f.obiEdge.roll)); // 날 위 그림 칼 (obiEdgeRoll — 칼집은 그림 칼을 감쌈)
  const o = tv(f.sword.translation());
  let worst = 0;
  for (const row of R) {
    for (const x of [row.cx - (row.hw - 0.005), row.cx + (row.hw - 0.005)]) { // 칼날 등 · 날 (칼집 반폭에서 덧댄 0.005 를 뺀 칼날 겉)
      const w = new THREE.Vector3(x, row.y, 0).applyQuaternion(q).add(o);
      const s = toSaya(w);
      // 칼집 틀: y 0 = 입 · 단면 줄은 칼 원점 틀 y — 입 기준 높이로
      const yy = s.y + R[0].y;
      const j = Math.max(0, Math.min(R.length - 1, Math.round(((yy - R[0].y) / (R.at(-1).y - R[0].y)) * (R.length - 1))));
      const rr = R[j];
      const ex = (s.x - rr.cx) / rr.hw;
      const ez = s.z / rr.ht;
      const e = Math.hypot(ex, ez);
      if (e > 1) worst = Math.max(worst, (e - 1) * Math.min(rr.hw, rr.ht));
      if (s.y < -0.01 || s.y > prof.len) worst = Math.max(worst, Math.max(-s.y, s.y - prof.len));
    }
  }
  return worst;
}

// ── 겉모습 그림 ↔ 칼집 축 (다라이시 자락 뚫림 셈과 같은 꼴) ──
const _tA = new THREE.Vector3(), _tB = new THREE.Vector3(), _tC = new THREE.Vector3();
/** 몸 그림 삼각형 (부위 그룹 틀 — 그룹 · 칼집 그룹은 뺌): [{ part, tris: Float32Array(9n) }] */
export function lookTris(f, parts = ['pelvis', 'abdomen', 'thighF', 'thighB', 'shinF', 'shinB', 'chest']) {
  const out = [];
  for (const part of parts) {
    const g = f.groups[part];
    if (!g) continue;
    g.position.set(0, 0, 0);
    g.quaternion.identity();
    g.updateMatrixWorld(true);
    const arr = [];
    g.traverse((o) => {
      if (!o.isMesh || !o.visible || /^iai-obi/.test(o.name)) return;
      for (let p = o.parent; p; p = p.parent) if (/^iai-obi/.test(p.name) || p.visible === false) return;
      const geo = o.geometry;
      const pos = geo?.attributes?.position;
      if (!pos) return;
      const idx = geo.index;
      const n = idx ? idx.count : pos.count;
      for (let i = 0; i + 2 < n; i += 3) {
        for (const [k, V] of [[0, _tA], [1, _tB], [2, _tC]]) V.fromBufferAttribute(pos, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld);
        arr.push(_tA.x, _tA.y, _tA.z, _tB.x, _tB.y, _tB.z, _tC.x, _tC.y, _tC.z);
      }
    });
    out.push({ part, tris: Float32Array.from(arr) });
  }
  return out;
}
/** 선분 ab ↔ 삼각형 지남 (Möller–Trumbore) */
function segTri(ax, ay, az, bx, by, bz, t, i) {
  const e1x = t[i + 3] - t[i], e1y = t[i + 4] - t[i + 1], e1z = t[i + 5] - t[i + 2];
  const e2x = t[i + 6] - t[i], e2y = t[i + 7] - t[i + 1], e2z = t[i + 8] - t[i + 2];
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det;
  const sx = ax - t[i], sy = ay - t[i + 1], sz = az - t[i + 2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return false;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return false;
  const w = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return w >= 0 && w <= 1;
}
/** 칼집 축(월드 점 줄)을 부위 그룹 틀로 옮겨 그림 삼각형과 견줌: { cross: 지나는 부위 이름 | null } */
export function lookCross(f, tris, axis) {
  const hits = [];
  for (const { part, tris: t } of tris) {
    const b = f.bodies[part];
    const qi = tq(b.rotation()).invert();
    const o = tv(b.translation());
    const L = axis.map((p) => p.clone().sub(o).applyQuaternion(qi));
    let hit = false;
    for (let s = 0; s + 1 < L.length && !hit; s++) {
      const A = L[s], B = L[s + 1];
      const mnx = Math.min(A.x, B.x) - 1e-3, mxx = Math.max(A.x, B.x) + 1e-3, mny = Math.min(A.y, B.y) - 1e-3, mxy = Math.max(A.y, B.y) + 1e-3, mnz = Math.min(A.z, B.z) - 1e-3, mxz = Math.max(A.z, B.z) + 1e-3;
      for (let i = 0; i < t.length; i += 9) {
        if (Math.max(t[i], t[i + 3], t[i + 6]) < mnx || Math.min(t[i], t[i + 3], t[i + 6]) > mxx) continue;
        if (Math.max(t[i + 1], t[i + 4], t[i + 7]) < mny || Math.min(t[i + 1], t[i + 4], t[i + 7]) > mxy) continue;
        if (Math.max(t[i + 2], t[i + 5], t[i + 8]) < mnz || Math.min(t[i + 2], t[i + 5], t[i + 8]) > mxz) continue;
        if (segTri(A.x, A.y, A.z, B.x, B.y, B.z, t, i)) { hit = true; break; }
      }
    }
    if (hit) hits.push(part);
  }
  return hits;
}

// ── 동작 대본 (브라우저 도구 tools/browser/iai_obi_shots.mjs 와 같은 몰기) ──
export const SCRIPT = [
  ['stand', 1.2], ['walk', 1.6], ['run', 1.6], ['lowwalk', 1.6], ['ready', 1.6], ['draw', 0], ['zanshin', 0], ['regrip', 0], ['back', 1.0], ['clinch', 2.5], ['hit', 1.2], ['fall', 2.5], ['dead', 3.0],
];
/**
 * 대본 한 판: 내 자리(P — AI 몸 표시 · 겉모습 look)를 스텝마다 몰고 상대(롱소드)는 서 있음. 동작마다 칼집 셈의 가장 값.
 *  { rows: { [동작]: { n, gapMin, gapMax(쉬는 칼집 — 대기 · 발도 뺌), leg, torso, chest, armS, ground(땅 위 가장 낮음), swing(땅 때문에 눕힌 각 °), follow, cross: { 부위: 스텝 수 } } }, worst }
 */
export function sayaScript({ weapon = 'uchigatana', look = 'player', seed = 1, visual = true, onStep = null } = {}) {
  const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed, gap: 7.0, look: lookOf(look), persona: { proficiency: 3 } });
  const P = G.player;
  const A = G.enemy;
  if (!P.obiSaya) { G.world.free(); return { none: true }; }
  P.aiControlled = true;
  G.ai.update = () => { A.move.set(0, 0); A.handOffset.set(0, 0); };
  const tris = visual ? lookTris(P) : null;
  const rows = {};
  let st = null;
  let t = 0;
  let fired = null;
  let doneDraw = false;
  const T = new THREE.Vector3();
  G.before = () => {
    const m = st;
    P.move.set(0, 0);
    if (m === 'walk') P.move.set(0, 0.45);
    else if (m === 'run') P.move.set(0, 1);
    else if (m === 'back') P.move.set(0, -0.6);
    else if (m === 'lowwalk') { iaiReadyPose(P, true, DT); P.move.set(0.55, 0); }
    else if (m === 'ready') iaiReadyPose(P, true, DT);
    else if (m === 'draw' && fired == null) { iaiReadyPose(P, true, DT); if (t > 1.2 && !P.iai && !P.iaiReq) { requestIai(P, {}); fired = t; } }
    else if (m === 'clinch') P.move.set(0, 0.8);
    // 대기 · 낮은 걸음 · 뽑기 앞이 아니면 발도 대기를 풂 (게임 AI 가 스텝마다 iaiReadyPose(…, false) 로 푸는 것과 같이)
    if (m !== 'lowwalk' && m !== 'ready' && !(m === 'draw' && fired == null)) iaiReadyPose(P, false, DT);
    if (m === 'hit' && fired == null && t > 0.3) { const c = P.bodies.chest; const p = c.translation(); const o = A.bodies.chest.translation(); T.set(p.x - o.x, 0, p.z - o.z).normalize(); c.applyImpulseAtPoint({ x: T.x * 70, y: 0, z: T.z * 70 }, { x: p.x, y: p.y + 0.1, z: p.z }, true); fired = t; }
    if (m === 'fall' && fired == null && t > 0.3) { P.knockDown(true); fired = t; }
    if (m === 'dead' && fired == null && t > 0.3) { P.die('obi-test', true); fired = t; }
  };
  // 판 시작 정지 동안 서 있기
  while (G.t < CONFIG.ARENA.startHold) G.step();
  for (const [name, dur] of SCRIPT) {
    st = name; t = 0; fired = null;
    const lim = name === 'draw' || name === 'zanshin' || name === 'regrip' || name === 'clinch' ? 8 : dur;
    let touch = null;
    const row = (rows[name] = { n: 0, gapMin: Infinity, gapMax: -Infinity, leg: Infinity, torso: Infinity, chest: Infinity, armS: Infinity, ground: Infinity, follow: 0, push: 0, swing: 0, cross: {}, cTorso: Infinity, cLeg: Infinity, cChest: Infinity, cGround: Infinity, cSpan: 0, cCross: {} });
    while (t < lim) {
      G.step();
      t += DT;
      P.syncMeshes?.(); // 그릴 때마다와 같이 (칼집 鞘引き · 감쌈 상태가 스텝마다 이어짐)
      // 단계: draw = 뽑는 동안 · zanshin = 굳음 · regrip = 풀기 · 다시 쥐기 (한 번 낸 발도를 셋으로 나눠 셈)
      let take = true;
      if (name === 'draw') { take = !!P.iai; if (fired != null && !P.iai && !P.iaiReq) break; }
      if (name === 'zanshin') { take = P.iaiHoldT > 0; if (!(P.iaiHoldT > 0)) break; }
      if (name === 'regrip') { take = P.iaiFade > 0 || P.iaiRegripT > 0; if (!take) break; }
      if (name === 'clinch') { take = P.foeDistance() < 0.7; if (take) touch ??= t; if (touch != null && t - touch > 1.2) break; }
      if (!take) continue;
      const m = sayaMeasure(P);
      row.n++;
      const resting = !(P.iaiObiW > 0) && !P.iai; // 쉬는 칼집 (대기 칼을 감싸지 않음 · 뽑는 중 아님)
      if (P.state !== 'dead' && P.state !== 'down') {
        row.gapMin = Math.min(row.gapMin, m.gap);
        if (resting || m.follow > 0) row.gapMax = Math.max(row.gapMax, m.gap);
      } else row.gapMin = Math.min(row.gapMin, m.gap);
      row.torso = Math.min(row.torso, m.gap);
      row.leg = Math.min(row.leg, m.leg);
      row.chest = Math.min(row.chest, m.chest);
      row.armS = Math.min(row.armS, m.armS);
      row.ground = Math.min(row.ground, m.ground);
      row.swing = Math.max(row.swing, m.swing);
      if (m.cord) {
        row.cTorso = Math.min(row.cTorso, m.cord.torso);
        row.cLeg = Math.min(row.cLeg, m.cord.leg);
        row.cChest = Math.min(row.cChest, m.cord.chest);
        row.cGround = Math.min(row.cGround, m.cord.ground);
        row.cSpan = Math.max(row.cSpan, m.cord.len);
        if (tris) for (const part of lookCross(P, tris, m.cord.axis)) row.cCross[part] = (row.cCross[part] ?? 0) + 1;
      }
      row.follow = Math.max(row.follow, m.follow);
      row.push = Math.max(row.push, m.push);
      if (tris) for (const part of lookCross(P, tris, m.axis)) row.cross[part] = (row.cross[part] ?? 0) + 1;
      onStep?.(name, P, m, tris); // 살펴보기 (재기 그대로)
    }
    // 잔심 · 다시 쥐기는 앞 단계가 낸 발도를 이어 셈 — draw 가 끝난 뒤 zanshin 이 곧 시작
    if (name === 'draw') doneDraw = true;
  }
  G.world.free();
  for (const r of Object.values(rows)) for (const k of ['gapMin', 'gapMax', 'leg', 'torso', 'chest', 'armS', 'ground', 'cTorso', 'cLeg', 'cChest', 'cGround', 'cSpan']) r[k] = Number.isFinite(r[k]) ? r3(r[k]) : null;
  return { rows, doneDraw };
}

/** AI 대 AI 한 판 (내 자리 일본 칼 숙련 5 · 상대 롱소드 숙련 3) — 스텝마다 칼집 셈 · 몸 상태별 */
export function sayaFight({ weapon = 'uchigatana', look = 'player', seed = 1, dur = 30, visual = false } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', look: lookOf(look), AI2Class: AI, persona: { proficiency: 3 }, persona2: { proficiency: 5 } });
  const P = G.player;
  const A = G.enemy;
  if (!P.obiSaya) { G.world.free(); return { none: true }; }
  const tris = visual ? lookTris(P) : null;
  const by = {};
  const add = (k, m) => {
    const r = (by[k] ??= { n: 0, gapMin: Infinity, gapMax: -Infinity, leg: Infinity, chest: Infinity, armS: Infinity, ground: Infinity, cross: 0, float15: 0, torsoIn: 0, legIn: 0, armIn: 0, groundIn: 0 }); // …In = 0.5 cm 넘게 든 스텝 수
    r.n++;
    r.gapMin = Math.min(r.gapMin, m.gap);
    r.gapMax = Math.max(r.gapMax, m.gap);
    if (m.gap > 0.015) r.float15++;
    r.leg = Math.min(r.leg, m.leg);
    r.chest = Math.min(r.chest, m.chest);
    r.armS = Math.min(r.armS, m.armS);
    if (m.gap < -0.005) r.torsoIn++;
    if (m.leg < -0.005) r.legIn++;
    if (m.armS < -0.005) r.armIn++;
    r.ground = Math.min(r.ground, m.ground);
    if (m.ground < -0.005) r.groundIn++;
    if (tris && lookCross(P, tris, m.axis).length) r.cross++;
  };
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      P.syncMeshes?.();
      if (i % 4) continue; // 30 Hz 표본
      const m = sayaMeasure(P);
      const k = P.state === 'dead' ? 'dead' : P.state === 'down' || P.state === 'getup' || P.state === 'kneel' ? 'down' : P.iai ? 'draw' : P.iaiHoldT > 0 || P.iaiFade > 0 || P.iaiRegripT > 0 ? 'zanshin' : (P.iaiObiW ?? 0) > 0 ? 'ready' : P.foeDistance() < 0.6 ? 'close' : 'fight';
      add(k, m);
      if (!A.alive && G.t > 5 && P.state === 'dead') break;
    }
    return { seed, by, win: !A.alive && P.alive, lose: !P.alive && A.alive };
  } finally {
    G.world.free();
  }
}

/** 대기 칼 자리 (사람 허리 대기 · AI 웅크린 대기) 한 판 */
export function readyShot({ weapon = 'uchigatana', mode = 'hip', seed = 1, look = 'player' } = {}) {
  const ai = mode === 'crouch';
  const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed, gap: 2.4, look: lookOf(look), persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0 && !ai) f.humanInput = true; } });
  const P = G.player;
  const A = G.enemy;
  G.ai.update = () => { A.move.set(0, 0); A.handOffset.set(0, 0); };
  if (ai) { P.aiControlled = true; G.before = () => iaiReadyPose(P, true, DT); }
  else { P.skill.corr = CONFIG.SKILL.corr; P.skill.corrTip = CONFIG.SKILL.corrTip; P.skill.autoGuard = true; G.before = () => iaiReadyPosePlayer(P, true, false, DT, true); }
  const tEnd = CONFIG.ARENA.startHold + 1.5;
  const e = [];
  while (G.t < tEnd) {
    G.step();
    if (G.t > tEnd - 0.5) {
      const q = tq(P.sword.rotation()), o = tv(P.sword.translation());
      const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      const M = pelvisLocal(P, o.clone().addScaledVector(ax, P.weaponCfg.hiltLength));
      const tsu = pelvisLocal(P, o.clone().addScaledVector(ax, P.weaponCfg.hiltLength - 0.006));
      const d = new THREE.Vector3(...pelvisLocal(P, tv(P.bodies.pelvis.translation()).add(ax)));
      const R = obiReady(P);
      const Rz = [R.M.x, R.M.y, R.M.z * P.side];
      const Dz = [R.D.x, R.D.y, R.D.z * P.side];
      P.syncMeshes?.();
      const out = P.obiSaya ? bladeOutside(P) : null;
      const fol = P.obiSaya ? obiSayaPose(P).follow : null;
      // 날 쪽 (칼 +x = 외날 날 — weapon_looks bladeGeometry): 칼 축에 수직인 위 쪽과의 cos (+1 = 날이 위 · 원전 「刃を上に」 · −1 = 아래)
      const ex = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const upP = new THREE.Vector3(0, 1, 0).addScaledVector(ax, -ax.y);
      const edge = upP.lengthSq() > 1e-6 ? ex.dot(upP.normalize()) : 0;
      e.push({ dm: Math.hypot(M[0] - Rz[0], M[1] - Rz[1], M[2] - Rz[2]), da: Math.acos(Math.min(1, d.x * Dz[0] + d.y * Dz[1] + d.z * Dz[2])) * R2D, M, tsu, yaw: Math.atan2(d.z, d.x) * R2D, el: Math.asin(Math.max(-1, Math.min(1, d.y))) * R2D, out, fol, edge });
    }
  }
  G.world.free();
  const L = e.at(-1);
  const mx = (k) => Math.max(...e.map((x) => x[k] ?? 0));
  const mn = (k) => Math.min(...e.map((x) => x[k] ?? 1));
  const has = e.some((x) => x.fol != null);
  return { weapon, mode, mouth: L.M.map(r3), tsuba: L.tsu.map(r3), yaw: r1(L.yaw), el: r1(L.el), dm: r3(mx('dm')), da: r1(mx('da')), bladeOut: has ? r3(mx('out')) : null, follow: has ? r3(mn('fol')) : null, edge: r3(L.edge), edgeMin: r3(mn('edge')) };
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  applySets(arg('set', ''));
  const range = (q) => String(q).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
  const weapons = arg('weapons', WEAPONS.join(',')).split(',');
  const json = arg('json', null);
  if (mode === 'ready') {
    const rows = [];
    for (const weapon of weapons) for (const m of arg('modes', 'hip,crouch').split(',')) {
      const r = readyShot({ weapon, mode: m, look: arg('look', 'player') });
      rows.push(r);
      console.log(`${weapon.padEnd(13)} ${m.padEnd(6)} | 칼집 입(골반 틀 앞 · 위 · 칼 든 쪽 +) ${JSON.stringify(r.mouth)} · 코등이 ${JSON.stringify(r.tsuba)} · 칼 축 yaw ${r.yaw}° el ${r.el}° | 목표와 어긋남 가장 ${r.dm} m · ${r.da}° | 칼집이 칼을 감싼 몫 가장 낮음 ${r.follow} · 칼날이 칼집 겉 밖으로 가장 ${r.bladeOut} m | 날 위 cos ${r.edge} (가장 낮음 ${r.edgeMin})`);
    }
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), rows }));
  } else if (mode === 'saya') {
    const out = [];
    for (const look of arg('looks', 'player').split(',')) for (const weapon of weapons) {
      const r = sayaScript({ weapon, look, visual: arg('visual', '1') !== '0' });
      out.push({ look, weapon, ...r });
      if (r.none) { console.log(`${look} ${weapon} | 칼집 없음`); continue; }
      for (const [k, v] of Object.entries(r.rows)) console.log(`${look.padEnd(16)} ${weapon.padEnd(13)} ${k.padEnd(8)} n ${String(v.n).padStart(4)} | 골반 · 배 틈 ${v.gapMin} ~ ${v.gapMax} m · 다리 ${v.leg} · 가슴 ${v.chest} · 칼 팔 ${v.armS} · 땅 ${v.ground} (눕힘 ${Math.round(v.swing)}°) | 끈 몸통 ${v.cTorso} · 다리 ${v.cLeg} · 가슴 ${v.cChest} · 땅 ${v.cGround} · 두 끝 ${v.cSpan} m · 끈 지남 ${JSON.stringify(v.cCross)} | 감쌈 ${r3(v.follow)} · 밀어냄 ${r3(v.push)} | 그림 지남 ${JSON.stringify(v.cross)}`);
    }
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), out }));
  } else if (mode === 'fight') {
    const out = [];
    for (const weapon of weapons) for (const seed of range(arg('seeds', '1-6'))) {
      const r = sayaFight({ weapon, seed, look: arg('look', 'player'), dur: +arg('dur', 30), visual: arg('visual', '0') !== '0' });
      out.push({ weapon, ...r });
      console.log(`${weapon.padEnd(13)} 씨앗 ${seed} ${r.win ? '이김' : r.lose ? '짐' : '비김'} | ${Object.entries(r.by).map(([k, v]) => `${k} ${v.n} 틈 ${r3(v.gapMin)}~${r3(v.gapMax)} 1.5cm↑ ${v.float15} 다리 ${r3(v.leg)} 가슴 ${r3(v.chest)} 칼 팔 ${r3(v.armS)}${v.torsoIn ? ` 몸통 듦 ${v.torsoIn}` : ''}${v.legIn ? ` 다리 듦 ${v.legIn}` : ''}${v.armIn ? ` 칼 팔 듦 ${v.armIn}` : ''} 땅 ${r3(v.ground)}${v.groundIn ? ` 땅 듦 ${v.groundIn}` : ''}${v.cross ? ` 지남 ${v.cross}` : ''}`).join(' | ')}`);
    }
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), out }));
  }
}
