// r24 A0 — 같은 씨앗 가까움: 두 나무(기준 = 본판 · 시험 = 이 나무)를 같은 장면 · 같은 씨앗으로 돌려 스텝마다 견준다.
//  장면 (상대는 멀리 치움 · 롱소드 · 씨앗 1 · 2): 먼저 3 s 가만히 섬(자리 잡기 — honesty.mjs 장면과 같음), 그 뒤
//   stand 3 s · walk(앞 1) 3 s · lunge(0.25 s 에 런지 부탁 0.6 m) 3 s · cut(위에서 아래로 내려베기 12 m/s — 손 자리는 자리 잡기 앞에 둠) 2 s
//  자리 잡기 3 s 는 시험 나무도 엔진 모터 근육으로 돈다(--settleEngine — 이 파일의 engineLeg: 본판 driveJoints 의 다리 줄 그대로) → 장면 첫 스텝의 상태가 비트까지 같고,
//   장면에 들어서며 그 모터를 거의 끔(굳기 0 · 감쇠 1e-9 — 0 · 0 은 Rapier 가 축을 굳힘). 그래서 이 줄은 '같은 상태에서 1.5 s 동안 두 근육 셈이 얼마나 갈리나'를 잰다.
//  재는 것 (장면 앞 1.5 s): 골반 자리 차이(최대 ≤ 1 cm) · 다리 관절 6 개의 상대 회전 차이 각(관절마다 스텝 가운데값의 최대 ≤ 3°) ·
//   발 닿음(엔진 접촉 — 발 몸과 고정 몸) 바뀜 스텝이 수가 같고 서로 2 스텝 안.
//  쓰는 법:
//   node same_seed.mjs rec <나무> <나옴.json> [--settleEngine]  (한 나무 기록)
//   node same_seed.mjs cmp <기준.json> <시험.json> [--curve]      (견줌 · PASS/FAIL 줄)
//   node same_seed.mjs rec <기준 나무> <json> --perturb=1e-4   (바닥: 같은 셈 · 아주 작은 흔듦 하나)
//   node same_seed.mjs run <기준 나무> <시험 나무> <나옴 폴더>      (기준은 그대로 · 시험은 --settleEngine 으로 · 차례로 · 그리고 견줌)
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const [mode, a1, a2, a3] = process.argv.slice(2);
const SCENES = ['stand', 'walk', 'lunge', 'cut'];
const SEEDS = [1, 2];
const LEG = ['thighF', 'shinF', 'footF', 'thighB', 'shinB', 'footB'];
const WIN = 1.5;
const SETTLE = 3;
const SETTLE_ENGINE = process.argv.includes('--settleEngine');
const PGS_SCENE = +(process.argv.find((a) => a.startsWith('--pgsScene='))?.slice(11) ?? 0); // 바닥 재기: 장면에 들어서며 엔진 안쪽 반복 수만 바꿈 (같은 엔진 모터 · 풀이 세부만 다름)
const ENG_J = (process.argv.find((a) => a.startsWith('--engineJoints='))?.slice(15) ?? '').split(','); // 진단 (r24 첫 판 · 읽기 뒤 셈이 여섯 관절 한꺼번에 풀리면서 쓰지 않음): 이 관절들은 장면에서도 엔진 모터로
const PERTURB = +(process.argv.find((a) => a.startsWith('--perturb='))?.slice(10) ?? 0); // 바닥 재기: 장면 첫 스텝에 골반에 이 크기(N·m·s)의 비틀기 충격 하나 — 같은 근육 셈에서도 갈림이 얼마나 자라나

/** 본판 driveJoints 의 다리 줄(엔진 모터)을 그대로 — 자리 잡기 동안만 시험 나무의 legMuscle 을 이것으로 */
function engineLeg(THREE, j, k, d, maxErr, inv) {
  const raw = j.joint.rawSet;
  if (!j._mm) { j._mm = 1; if (j.type === 'hinge') raw.jointConfigureMotorModel(j.joint.handle, 3, 1); else for (const a of [3, 4, 5]) raw.jointConfigureMotorModel(j.joint.handle, a, 1); }
  const trv = (q, out) => { const w = Math.min(1, Math.abs(q.w)), sg = q.w < 0 ? -1 : 1, s = Math.sqrt(1 - w * w); if (s < 1e-6) return out.set(0, 0, 0); const a = 2 * Math.acos(w); return out.set(q.x, q.y, q.z).multiplyScalar((sg * a) / s); };
  const rv = trv(new THREE.Quaternion().copy(j.restInv).multiply(j.target), new THREE.Vector3());
  const p = j.parent.rotation(), c = j.child.rotation();
  const cur = trv(new THREE.Quaternion().copy(j.restInv).multiply(new THREE.Quaternion(p.x, p.y, p.z, p.w).invert().multiply(new THREE.Quaternion(c.x, c.y, c.z, c.w))), new THREE.Vector3());
  const prev = j.prevRV || (j.prevRV = rv.clone());
  const cl = (x, a) => Math.max(-a, Math.min(a, x));
  if (j.type === 'hinge') raw.jointConfigureMotor(j.joint.handle, 3, cur.z + cl(rv.z - cur.z, maxErr), cl((rv.z - prev.z) * inv, 15), k, d);
  else [['x', 3], ['y', 4], ['z', 5]].forEach(([ax, a]) => raw.jointConfigureMotor(j.joint.handle, a, cur[ax] + cl(rv[ax] - cur[ax], maxErr), cl((rv[ax] - prev[ax]) * inv, 15), k, d));
  prev.copy(rv);
}

async function rec(tree, out) {
  const H = await import(pathToFileURL(join(tree, 'tools/sim/harness_m.mjs')).href);
  const DT = H.DT;
  for (const kv of (process.argv.find((a) => a.startsWith('--legs='))?.slice(7) ?? '').split(',').filter(Boolean)) { const [k, v] = kv.split('='); H.CONFIG.LEGS[k] = +v; } // 시험용: LEGS 값 바꿔 보기 (--legs=muscleLag=0.5)
  let settling = false;
  if (SETTLE_ENGINE) {
    const { Fighter } = await import(pathToFileURL(join(tree, 'src/fighter.js')).href);
    // r24 읽기 뒤: 근육 셈이 관절마다 준비(legMusclePrep) + 여섯 관절 한꺼번에(legMuscleSolve) 로 나뉨 — 자리 잡는 동안은 둘 다 엔진 모터로 바꿔 끼움 (ENG_J 부분 끼움은 이제 없음)
    const own = Fighter.prototype.legMusclePrep, ownSolve = Fighter.prototype.legMuscleSolve;
    Fighter.prototype.legMusclePrep = function (j, k, d, maxErr, inv) {
      if (settling) return engineLeg(H.THREE, j, k, d, maxErr, inv);
      if (j._mm === 1) { j._mm = 2; const raw = j.joint.rawSet; for (const a of j.type === 'hinge' ? [3] : [3, 4, 5]) raw.jointConfigureMotor(j.joint.handle, a, 0, 0, 0, 1e-9); }
      return own.call(this, j, k, d, maxErr, inv);
    };
    Fighter.prototype.legMuscleSolve = function () { if (!settling) return ownSolve.call(this); };
  }
  const res = {};
  for (const sc of SCENES) for (const seed of SEEDS) {
    const G = H.newRound({ walls: false, weapon: 'longsword', seed });
    G.park();
    const P = G.player;
    const W = G.world;
    const fixed = [];
    W.forEachCollider((c) => { const b = c.parent(); if (b && b.isFixed()) fixed.push(c); });
    const footCols = ['footF', 'footB'].map((n) => { const b = P.bodies[n], cs = []; for (let i = 0; i < b.numColliders(); i++) cs.push(b.collider(i)); return cs; });
    const touch = (cs) => { let on = 0; for (const c of cs) for (const g of fixed) W.contactPair(c, g, (m) => { if (m.numContacts() > 0) on = 1; }); return on; };
    const secs = sc === 'cut' ? 2 : 3;
    const n = Math.round(secs / DT);
    const rows = [];
    const vert = { ch: [0.02, 0.52], end: [0, -0.5], v: 12 };
    if (sc === 'cut') P.handOffset.set(vert.ch[0], vert.ch[1]);
    settling = true;
    for (let i = 0; i < Math.round(SETTLE / DT); i++) { P.move.set(0, 0); G.step(); }
    settling = false;
    if (PGS_SCENE) W.integrationParameters.numInternalPgsIterations = PGS_SCENE;
    for (let i = 0; i < n; i++) {
      const t = i * DT;
      if (i === 0 && PERTURB) P.bodies.pelvis.applyTorqueImpulse({ x: PERTURB, y: PERTURB, z: PERTURB }, true);
      P.move.set(0, sc === 'walk' ? 1 : 0);
      if (sc === 'lunge' && i === Math.round(0.25 / DT)) P.gait?.requestStep?.({ kind: 'lunge', fwd: 0.6, duration: 0.4, accel: true });
      if (sc === 'cut' && t >= 0.1) { const off = P.handOffset, dx = vert.end[0] - off.x, dy = vert.end[1] - off.y, d = Math.hypot(dx, dy), st = vert.v * DT; if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(vert.end[0], vert.end[1]); }
      G.step();
      const p = P.bodies.pelvis.translation();
      const q = LEG.map((nm) => { const j = P.jointByName[nm]; const qp = j.parent.rotation(), qc = j.child.rotation(); const r = new H.THREE.Quaternion(qp.x, qp.y, qp.z, qp.w).invert().multiply(new H.THREE.Quaternion(qc.x, qc.y, qc.z, qc.w)); return [r.x, r.y, r.z, r.w]; });
      // 관절 빠르기(자식 몸 틀 — 엉덩이 = 허벅지 · 발목 = 발 · 무릎 z) · 명시 근육 토크(j.musC — 있는 나무만) — A3 떨림 재기용
      const w = LEG.map((nm) => { const j = P.jointByName[nm]; const a = j.child.angvel(), b = j.parent.angvel(), r = j.child.rotation(); const v = new H.THREE.Vector3(a.x - b.x, a.y - b.y, a.z - b.z).applyQuaternion(new H.THREE.Quaternion(r.x, r.y, r.z, r.w).invert()); return [v.x, v.y, v.z]; });
      const tq = LEG.map((nm) => { const m = P.jointByName[nm].musC; return m && !settling ? [m.x, m.y, m.z] : null; });
      rows.push({ p: [p.x, p.y, p.z], q, c: footCols.map(touch), w, tq });
    }
    res[`${sc}:${seed}`] = { dt: DT, rows };
  }
  writeFileSync(out, JSON.stringify(res));
}

const angDeg = (a, b) => { const d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]); return (2 * Math.acos(Math.min(1, d)) * 180) / Math.PI; };
const med = (v) => { const s = [...v].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const toggles = (rows, k, nmax) => { const out = []; for (let i = 1; i < nmax; i++) if (rows[i].c[k] !== rows[i - 1].c[k]) out.push(i); return out; };

function cmp(bf, tf, curve) {
  const B = JSON.parse(readFileSync(bf, 'utf8')), T = JSON.parse(readFileSync(tf, 'utf8'));
  let allOk = true;
  const lines = [];
  lines.push('장면:씨앗      골반 최대 cm (넘은 첫 스텝)  관절 가운데값 최대 ° [관절] (3° 넘은 첫 스텝)  닿음 바뀜 수 기준/시험 · 최대 어긋남 스텝  판정');
  for (const key of Object.keys(B)) {
    const b = B[key].rows, t = T[key].rows, nW = Math.min(b.length, t.length, Math.round(WIN / B[key].dt));
    let pMax = 0, pFirst = -1;
    const jd = LEG.map(() => []);
    let jFirst = -1;
    const cv = [];
    for (let i = 0; i < nW; i++) {
      const dp = Math.hypot(b[i].p[0] - t[i].p[0], b[i].p[1] - t[i].p[1], b[i].p[2] - t[i].p[2]) * 100;
      if (dp > pMax) pMax = dp;
      if (dp > 1 && pFirst < 0) pFirst = i;
      let jm = 0;
      LEG.forEach((_, k) => { const d = angDeg(b[i].q[k], t[i].q[k]); jd[k].push(d); if (d > jm) jm = d; });
      if (jm > 3 && jFirst < 0) jFirst = i;
      if (i % 12 === 11) cv.push(`${((i + 1) * B[key].dt).toFixed(1)}s ${dp.toFixed(2)}cm/${jm.toFixed(1)}°`);
    }
    const jMed = jd.map(med);
    const jw = jMed.indexOf(Math.max(...jMed));
    let cOk = true, cShift = 0;
    const cn = [];
    for (const k of [0, 1]) {
      const tb = toggles(b, k, nW), tt = toggles(t, k, nW);
      cn.push(`${tb.length}/${tt.length}`);
      if (tb.length !== tt.length) { cOk = false; continue; }
      tb.forEach((s, i) => { cShift = Math.max(cShift, Math.abs(s - tt[i])); });
    }
    if (cShift > 2) cOk = false;
    const ok = pMax <= 1 && jMed[jw] <= 3 && cOk;
    allOk &&= ok;
    lines.push(`${key.padEnd(10)} ${pMax.toFixed(2).padStart(6)} (${pFirst < 0 ? '-' : pFirst})`.padEnd(40) + `${jMed[jw].toFixed(2).padStart(6)} [${LEG[jw]}] (${jFirst < 0 ? '-' : jFirst})`.padEnd(42) + `${cn.join(' ')} · ${cShift}`.padEnd(22) + (ok ? 'PASS' : 'FAIL'));
    if (curve) lines.push('   갈림 곡선(골반 cm/관절 최대 °): ' + cv.join(' · '));
  }
  lines.push(`A0 ${allOk ? 'PASS' : 'FAIL'}`);
  console.log(lines.join('\n'));
  return allOk;
}

if (mode === 'rec') await rec(a1, a2);
else if (mode === 'cmp') cmp(a1, a2, process.argv.includes('--curve'));
else if (mode === 'run') {
  mkdirSync(a3, { recursive: true });
  const me = new URL(import.meta.url).pathname;
  for (const [tr, nm] of [[a1, 'base'], [a2, 'test']]) execFileSync('nice', ['-n', '15', 'node', me, 'rec', tr, join(a3, nm + '.json'), ...(nm === 'test' ? ['--settleEngine'] : [])], { stdio: 'inherit' });
  cmp(join(a3, 'base.json'), join(a3, 'test.json'), true);
} else console.log('쓰는 법: rec <나무> <json> | cmp <기준> <시험> [--curve] | run <기준 나무> <시험 나무> <폴더>');
