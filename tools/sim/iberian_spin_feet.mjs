// ─────────────────────────────────────────────────────────────
//  iberian_spin_feet.mjs — 싱지르 발디딤 재기 (10/24 12:5x 사장님 '싱지르 캡쳐 화면에서 3번째 프레임 같은 발디딤 이상하지 않어?' —
//   src/iberian_spin.js · docs/strike/iberian_spin_2026-10-22.md §17). 읽기만 (판 값 그대로 · --set 은 이 도구 안에서만).
//
//  node tools/sim/iberian_spin_feet.mjs [--weapons=zweihander,flamberge,tizona] [--inputs=direct,circle] [--starts=langort,ochsR,wechselR]
//                                       [--r=80] [--a0=180] [--dirs=ccw,cw] [--targets=stand] [--set=feet=0,...] [--rows] [--trace]
//   판 = iberian_spin_circle.mjs runCircle 과 같은 길 (무장 → 곧장 또는 공격 원) · 물리 스텝마다 두 발 · 골반을 적는다.
//   칸 (발목 = gait sense 의 발목 점 · 몸 기준 = 그때 heading 의 앞 · 오른쪽 · 'F' = 칼 든 쪽 발):
//    낼 때 · 한 바퀴 끝(받아 멈춤 첫 스텝 = 브라우저 그림 'turn end' 칸) · 받아 멈춤 끝(대본이 끝난 첫 스텝 = 'turn end + 0.2 s') · 끝난 뒤 0.6 s —
//     앞뒤 = 칼 든 발 − 다른 발 (몸 앞 +) · 옆 = 두 발 옆 거리 (칼 든 발이 제 쪽에 있으면 + · − 면 엇갈림)
//     골반 앞 = 골반 − 두 발 가운데 (몸 앞 +) · 발 방향 = 발 − heading (°, 칼 든 쪽으로 + )
//     무릎 = 허벅지 · 정강이 세로 축 사이 ° · 기울기 = 엉덩이 → 발목 줄이 세로에서 벗어난 ° · 무게 가운데 여유 = 몸 · 칼 무게 가운데가 디딘 발바닥 껍질 안 가장자리까지 (m · − 밖)
//    --trace = 위 칸을 0.04 s 마다 (낼 때 ~ 끝난 뒤 0.6 s) · feet 판이면 축발이 옮겨 딛는 거리도
//    도는 동안 (ramp ~ 받아 멈춤): 옆 최소 (− = 엇갈림) · 엇갈린 스텝 몫 · 두 발바닥 사이 최소 (m — 발 상자 가장자리 사이 · − = 겹침)
//    디딘 발 미끄러짐: 디딘 채 발바닥 가운데가 딛은 자리에서 벗어난 최대 (m) — 축발 (도는 동안) · 도는 발 (딛은 뒤 ~ 끝난 뒤 0.6 s)
//    상대 (target stand): 한 바퀴 끝 골반 높이 − 선 높이 · 두 발 옆 거리
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';
import { THREE, CONFIG } from './harness_m.mjs';
import { runCircle } from './iberian_spin_circle.mjs';

const { SECRET, BODY } = CONFIG;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const R2D = 180 / Math.PI;
const FOOT_HL = 0.12; // 발 상자 반 길이 (fighter.js partDefs foot — 있는 몸 수)
const FOOT_HW = 0.05; // 발 상자 반 너비
const _q = new THREE.Quaternion();
const _x = new THREE.Vector3();

/** 2D 선분 사이 최소 거리 (xz) */
function segDist(a0, a1, b0, b1) {
  const d = (p, s0, s1) => {
    const vx = s1.x - s0.x;
    const vz = s1.z - s0.z;
    const L = vx * vx + vz * vz;
    const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - s0.x) * vx + (p.z - s0.z) * vz) / L)) : 0;
    return Math.hypot(p.x - s0.x - t * vx, p.z - s0.z - t * vz);
  };
  const cross = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const c1 = cross(a0, a1, b0);
  const c2 = cross(a0, a1, b1);
  const c3 = cross(b0, b1, a0);
  const c4 = cross(b0, b1, a1);
  if (c1 * c2 < 0 && c3 * c4 < 0) return 0;
  return Math.min(d(a0, b0, b1), d(a1, b0, b1), d(b0, a0, a1), d(b1, a0, a1));
}

/** 한 순간의 발디딤 (몸 기준) */
export function footSnap(P) {
  const G = P.gait;
  const h = P.heading;
  const fx = Math.cos(h);
  const fz = -Math.sin(h);
  const rx = Math.sin(h);
  const rz = Math.cos(h);
  const s = P.side >= 0 ? 1 : -1;
  const F = G.legs.F.ankle;
  const B = G.legs.B.ankle;
  const pel = P.bodies.pelvis.translation();
  const dx = F.x - B.x;
  const dz = F.z - B.z;
  const mx = (F.x + B.x) / 2;
  const mz = (F.z + B.z) / 2;
  const seg = (k) => {
    const b = P.bodies[G.legs[k].foot];
    const r = b.rotation();
    _x.set(1, 0, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
    const L = Math.hypot(_x.x, _x.z) || 1;
    const t = b.translation();
    const ux = (_x.x / L) * FOOT_HL;
    const uz = (_x.z / L) * FOOT_HL;
    return [{ x: t.x - ux, z: t.z - uz }, { x: t.x + ux, z: t.z + uz }];
  };
  const [a0, a1] = seg('F');
  const [b0, b1] = seg('B');
  // 무릎 굽힘 (허벅지 · 정강이 세로 축 사이 °) · 다리 기울기 (엉덩이 → 발목: 세로에서 벗어난 각 ° · 기운 쪽 = 몸 기준 앞 +x · 칼 든 쪽 +z 의 단위 몫)
  const axis = (b) => {
    const r = b.rotation();
    return new THREE.Vector3(0, 1, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w));
  };
  const knee = (k) => (axis(P.bodies[G.legs[k].thigh]).angleTo(axis(P.bodies[G.legs[k].shin])) * R2D);
  const tilt = (k) => {
    const L = G.legs[k];
    const vx = L.ankle.x - L.hip.x;
    const vy = L.ankle.y - L.hip.y;
    const vz = L.ankle.z - L.hip.z;
    const hz = Math.hypot(vx, vz);
    return { deg: Math.atan2(hz, -vy) * R2D, f: hz > 1e-6 ? (vx * fx + vz * fz) / hz : 0, r: hz > 1e-6 ? (s * (vx * rx + vz * rz)) / hz : 0 };
  };
  const tF = tilt('F');
  const tB = tilt('B');
  // 무게 가운데 (몸 · 칼) 가 디딘 발바닥 (볼록 껍질) 안에 있나 — 가장자리까지 거리 (m · + 안 · − 밖)
  let M = 0, cx = 0, cz = 0;
  for (const b of [...Object.values(P.bodies), P.sword]) {
    if (!b) continue;
    const m = b.mass();
    const c = b.worldCom();
    M += m;
    cx += m * c.x;
    cz += m * c.z;
  }
  cx /= M;
  cz /= M;
  const pts = [];
  for (const [k, [p0, p1]] of [['F', [a0, a1]], ['B', [b0, b1]]]) {
    if (!G.legs[k].stance) continue;
    const ux = p1.x - p0.x;
    const uz = p1.z - p0.z;
    const L = Math.hypot(ux, uz) || 1;
    const nx = (-uz / L) * FOOT_HW;
    const nz = (ux / L) * FOOT_HW;
    for (const p of [p0, p1]) pts.push({ x: p.x + nx, z: p.z + nz }, { x: p.x - nx, z: p.z - nz });
  }
  const margin = hullMargin(pts, cx, cz);
  return {
    lon: dx * fx + dz * fz, // 칼 든 발 − 다른 발 (몸 앞 +)
    lat: s * (dx * rx + dz * rz), // 옆 (칼 든 발이 제 쪽 + · − 엇갈림)
    pelFwd: (pel.x - mx) * fx + (pel.z - mz) * fz, // 골반 − 두 발 가운데 (몸 앞 +)
    pelLat: s * ((pel.x - mx) * rx + (pel.z - mz) * rz),
    yawF: s * wrap(G.legs.F.footYaw - h) * R2D, // 발 방향 − heading (칼 든 쪽 +)
    yawB: s * wrap(G.legs.B.footYaw - h) * R2D,
    gap: segDist(a0, a1, b0, b1) - 2 * FOOT_HW, // 두 발바닥 가장자리 사이 (− = 겹침)
    stF: G.legs.F.stance,
    stB: G.legs.B.stance,
    kneeF: knee('F'),
    kneeB: knee('B'),
    tiltF: tF,
    tiltB: tB,
    same: tF.f * tB.f + tF.r * tB.r, // 두 다리 기운 쪽이 같은가 (1 = 같은 쪽 · −1 = 마주 벌림 — 'A' 꼴)
    margin,
    width: Math.hypot(dx, dz), // 두 발목 사이 (m)
    pelY: pel.y, // 골반 높이
    gaitH: G.h, // 걸음 골반 높이 목표
  };
}

/** 점들의 볼록 껍질 안에서 (x, z) 의 가장자리까지 거리 (+ 안 · − 밖) */
function hullMargin(pts, x, z) {
  if (pts.length < 3) return -9;
  const P = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  const cr = (o, a, b) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lo = [];
  for (const p of P) {
    while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up = [];
  for (const p of [...P].reverse()) {
    while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  const H = lo.slice(0, -1).concat(up.slice(0, -1)); // 반시계
  let m = Infinity;
  let inside = true;
  for (let i = 0; i < H.length; i++) {
    const a = H[i];
    const b = H[(i + 1) % H.length];
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const d = cr(a, b, { x, z }) / L; // + = 왼쪽 (안)
    if (d < 0) inside = false;
    m = Math.min(m, Math.abs(d));
  }
  if (inside) return m;
  // 밖: 껍질까지 거리
  let o = Infinity;
  for (let i = 0; i < H.length; i++) o = Math.min(o, segDist({ x, z }, { x, z }, H[i], H[(i + 1) % H.length]));
  return -o;
}

/** 판 하나 + 발디딤 기록 */
export function runFeet(w, start, input, c, target = 'stand', trace = false) {
  const rec = { trace: [], fire: null, end: null, fin: null, after: null, spin: { latMin: 9, cross: 0, n: 0, gapMin: 9, yawSkew: 0 }, slide: { pivot: 0, swing: 0, swingAfter: 0 }, foe: null, why: null, q: null, steps: 0 };
  let pin = null; // 디딘 자리 { F, B } (발바닥 가운데 xz)
  let tEnd0 = null;
  let swingDown = false;
  let sk = null;
  const sole = (P, k) => P.bodies[P.gait.legs[k].foot].translation();
  const r = runCircle(w, start, input, c, target, ({ P, E, G, tFire, tEnd }) => {
    if (tFire == null) return;
    const S = P.ibSpin;
    if (!rec.fire) {
      rec.fire = footSnap(P);
      const p0 = P.bodies.pelvis.translation();
      rec.p0 = { x: p0.x, z: p0.z };
      pin = { F: null, B: null };
      sk = S?.sk ?? null;
    }
    if (P.state !== 'stand' || !P.gait?.active) return;
    if (trace && rec.steps % 5 === 0 && (!rec.after || !tEnd0)) {
      const f = footSnap(P);
      const ph = S ? (S.tp < S.pre ? 'pre' : S.settle ? 'settle' : S.free ? 'free' : 'spin') : P.skill.sec?.stage ?? 'after';
      const foe = E.bodies.chest.translation();
      const pel = P.bodies.pelvis.translation();
      const toFoe = Math.atan2(-(foe.z - pel.z), foe.x - pel.x);
      rec.trace.push({ t: +(G.t - tFire).toFixed(3), ph, q: S ? +S.q.toFixed(2) : null, hFoe: Math.round(wrap(P.heading - toFoe) * R2D), ...f });
    }
    // 디딘 발 미끄러짐
    for (const k of ['F', 'B']) {
      const st = P.gait.legs[k].stance;
      const p = sole(P, k);
      if (!st) {
        pin[k] = null;
        continue;
      }
      if (!pin[k]) pin[k] = { x: p.x, z: p.z };
      const d = Math.hypot(p.x - pin[k].x, p.z - pin[k].z);
      if (S && !S.settle && k === S.pk) rec.slide.pivot = Math.max(rec.slide.pivot, d);
      else if (k === sk && (S?.settle || !S)) {
        if (S) rec.slide.swing = Math.max(rec.slide.swing, d);
        else rec.slide.swingAfter = Math.max(rec.slide.swingAfter, d);
      }
    }
    if (S && S.tp >= S.pre) {
      const f = footSnap(P);
      rec.spin.n++;
      rec.spin.latMin = Math.min(rec.spin.latMin, f.lat);
      if (f.lat < 0) rec.spin.cross++;
      rec.spin.gapMin = Math.min(rec.spin.gapMin, f.gap);
      rec.q = S.q;
      if (S.feet?.step && rec.stepLen == null) rec.stepLen = Math.hypot(S.feet.P1.x - S.feet.step.f0.x, S.feet.P1.z - S.feet.step.f0.z); // 축발이 옮겨 딛는 거리 (feet)
      if (S.settle && !rec.end) {
        rec.end = footSnap(P);
        rec.why = S.settle.why;
        if (E?.gait?.legs) {
          const ea = E.gait.legs.F.ankle;
          const eb = E.gait.legs.B.ankle;
          rec.foe = { drop: +(E.bodies.pelvis.translation().y - BODY.standHeight).toFixed(3), width: +Math.hypot(ea.x - eb.x, ea.z - eb.z).toFixed(3) };
        }
      }
    }
    if (!S && rec.end) {
      const pp = P.bodies.pelvis.translation();
      const mv = Math.hypot(pp.x - rec.p0.x, pp.z - rec.p0.z); // 낼 때부터 골반 옮김 (m)
      if (tEnd0 == null) rec.fin = { ...footSnap(P), move: mv }; // 대본이 끝난 첫 스텝 (받아 멈춤 끝 — 옮겨 딛는 걸음까지 끝남)
      tEnd0 ??= G.t;
      if (!rec.after && G.t >= tEnd0 + 0.6) rec.after = { ...footSnap(P), move: mv };
    }
    rec.steps++;
  });
  rec.after ??= null;
  return { ...r, feet: rec };
}

const CLI = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (CLI) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (!m) throw new Error(`알 수 없는 인자 ${a}`);
    args[m[1]] = m[2] ?? true;
  }
  const arg = (k, d) => (args[k] === undefined ? d : args[k]);
  const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
  for (const kv of list('set', '')) {
    const [k, v] = kv.split('=');
    if (!(k in SECRET.ibSpin)) throw new Error(`SECRET.ibSpin.${k}?`);
    SECRET.ibSpin[k] = Number.isFinite(+v) ? +v : v;
  }
  const rows = [];
  for (const w of list('weapons', 'zweihander,flamberge,tizona'))
    for (const target of list('targets', 'stand'))
      for (const s of list('starts', 'langort,ochsR,wechselR'))
        for (const input of list('inputs', 'direct,circle'))
          for (const c of input === 'circle'
            ? list('r', '80').flatMap((rp) => list('a0', '180').flatMap((a0) => list('dirs', 'ccw,cw').map((dir) => ({ r: +rp, T: 0.8, a0: +a0, dir, close: 380 }))))
            : list('dirs', 'ccw,cw').map((dir) => ({ dir }))) {
            const r = runFeet(w, s, input, c, target, !!args.trace);
            rows.push(r);
            if (args.trace) {
              console.log(`# ${w} ${s} ${input} ${r.c}`);
              console.log('t | 단계 | q | heading−상대° | 앞뒤 | 옆 | 발목 사이 | 골반 앞 | 무릎 F · B ° | 기울기 F · B ° | 같은 쪽 | 무게 가운데 여유 | 디딤 F B');
              for (const x of r.feet.trace) console.log([x.t.toFixed(2), x.ph, x.q ?? '-', x.hFoe, x.lon.toFixed(2), x.lat.toFixed(2), x.width.toFixed(2), x.pelFwd.toFixed(2), `${x.kneeF.toFixed(0)} · ${x.kneeB.toFixed(0)}`, `${x.tiltF.deg.toFixed(0)} · ${x.tiltB.deg.toFixed(0)}`, x.same.toFixed(2), x.margin.toFixed(3), `${+x.stF}${+x.stB}`].join(' | '));
            }
            if (args.rows) console.log(JSON.stringify({ w, s, input, c: r.c, cuts: r.cuts, stepLen: r.feet.stepLen ?? null, why: r.feet.why, q: r.feet.q, fire: r.feet.fire, end: r.feet.end, fin: r.feet.fin, after: r.feet.after, spin: r.feet.spin, slide: r.feet.slide, foe: r.feet.foe }));
          }
  const F = rows.filter((r) => r.fired && r.feet.end);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const f2 = (x) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(2) : '-');
  const f0 = (x) => (Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(0) : '-');
  const mm = (a, k) => `${f2(mean(a.map((x) => x[k])))} (${f2(Math.min(...a.map((x) => x[k])))} ~ ${f2(Math.max(...a.map((x) => x[k])))})`;
  console.log(`설정: ${JSON.stringify(Object.fromEntries(Object.entries(SECRET.ibSpin).filter(([k]) => ['share', 'upright', 'advance', 'feet', 'handRest', 'lid', 'floor', 'settle'].includes(k))))} · 판 ${rows.length} · 낸 판 ${F.length} · 넘어짐 ${rows.filter((r) => r.fell).length}`);
  console.log('| 때 | 앞뒤 (칼 든 발 − 다른 발) | 옆 (− 엇갈림) | 골반 앞 (− 발 가운데 뒤) | 칼 든 발 방향 ° | 다른 발 방향 ° | 발바닥 사이 |');
  console.log('|---|---|---|---|---|---|---|');
  for (const [name, k] of [['낼 때', 'fire'], ['한 바퀴 끝', 'end'], ['받아 멈춤 끝', 'fin'], ['끝난 뒤 0.6 s', 'after']]) {
    const a = F.map((r) => r.feet[k]).filter(Boolean);
    console.log(`| ${name} (${a.length}) | ${mm(a, 'lon')} | ${mm(a, 'lat')} | ${mm(a, 'pelFwd')} | ${f0(mean(a.map((x) => x.yawF)))} | ${f0(mean(a.map((x) => x.yawB)))} | ${mm(a, 'gap')} |`);
  }
  const sp = F.map((r) => r.feet.spin);
  console.log(`\n도는 동안: 옆 최소 평균 ${f2(mean(sp.map((x) => x.latMin)))} · 최소 ${f2(Math.min(...sp.map((x) => x.latMin)))} m · 엇갈린 판 ${sp.filter((x) => x.cross > 0).length} / ${F.length} · 엇갈린 스텝 몫 ${((100 * sp.reduce((a, x) => a + x.cross, 0)) / Math.max(1, sp.reduce((a, x) => a + x.n, 0))).toFixed(1)} % · 발바닥 사이 최소 평균 ${f2(mean(sp.map((x) => x.gapMin)))} · 최소 ${f2(Math.min(...sp.map((x) => x.gapMin)))} m`);
  const sl = F.map((r) => r.feet.slide);
  console.log(`디딘 발 미끄러짐 최대 (평균 · 최대): 축발 도는 동안 ${f2(mean(sl.map((x) => x.pivot)))} · ${f2(Math.max(...sl.map((x) => x.pivot)))} m · 도는 발 받아 멈춤 ${f2(mean(sl.map((x) => x.swing)))} · ${f2(Math.max(...sl.map((x) => x.swing)))} · 끝난 뒤 ${f2(mean(sl.map((x) => x.swingAfter)))} · ${f2(Math.max(...sl.map((x) => x.swingAfter)))} m`);
  const fo = F.map((r) => r.feet.foe).filter(Boolean);
  if (fo.length) console.log(`상대 (한 바퀴 끝): 골반 − 선 높이 평균 ${f2(mean(fo.map((x) => x.drop)))} · 최저 ${f2(Math.min(...fo.map((x) => x.drop)))} m · 두 발 거리 평균 ${f2(mean(fo.map((x) => x.width)))} · 최대 ${f2(Math.max(...fo.map((x) => x.width)))} m · 맞음 있는 판 ${F.filter((r) => r.cuts > 0).length} / ${F.length}`);
  console.log(`끝 까닭 done · blocked: ${F.filter((r) => r.feet.why === 'done').length} · ${F.filter((r) => r.feet.why === 'blocked').length}`);
  const st = F.map((r) => r.feet.stepLen).filter((x) => x != null);
  if (st.length) console.log(`축발 옮겨 딛기 (feet): ${st.length} 판 · 거리 평균 ${f2(mean(st))} · ${f2(Math.min(...st))} ~ ${f2(Math.max(...st))} m`);
}
