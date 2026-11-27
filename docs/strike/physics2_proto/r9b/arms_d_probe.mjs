// arm_real 'D 두 팔 엇갈림' 판을 그대로 돌려 두 팔 겉 틈을 명령 자세 · 실제 몸 두 쪽에서 잼 (재기만):
//   node arms_d_probe.mjs --root=<나무> [--cells=balisarda:left,rapier:left] [--csv=<폴더>]
//  실제 = arm_reach_audit.mjs armReachSample 의 arms (시험이 읽는 값 그대로)
//  명령 = 실제 가슴에 두 위팔 · 아래팔 근육 목표(uarm*.target · farm*.target — 가슴 틀 · 위팔 틀)를 얹은 운동학 팔:
//    어깨 = ARM.shoulder (빈팔은 z 반대) · 위팔 0.30 (칼 팔 +x · 빈팔 −y 축) · 아래팔 팔꿈치 → 손목 0.275 — 겉 틈 셈(캡슐 · 칼 팔 위팔 바깥 2/3 · 손목 6 cm 뺌)은 armReachSample 과 같음
//  스텝마다(손 댄 뒤): 명령 · 실제 손목 · 팔꿈치 (월드) · 두 틈 → csv. 요약: 2 cm 넘게 겹친 스텝 몫 · 가장 깊은 겹침 · 겹친 스텝에서 명령도 겹쳤나 · 손목 · 팔꿈치 따라감 오차
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const A = await import(u('tools/sim/arm_reach_audit.mjs'));
const { CONFIG, THREE } = await import(u('tools/sim/harness_m.mjs'));
const { ARM } = CONFIG;
const PEN = A.PEN, SETTLE = A.SETTLE;
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
// 두 선분 사이 가장 가까운 거리
function segSeg(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  if (a <= 1e-12 && e <= 1e-12) return r.length();
  if (a <= 1e-12) { s = 0; t = Math.min(1, Math.max(0, f / e)); }
  else { const c = d1.dot(r); if (e <= 1e-12) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else { const b = d1.dot(d2), den = a * e - b * b; s = den !== 0 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); } } }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
function gap(pS, pO) {
  const cut = (a, b, m) => a.clone().lerp(b, Math.max(0, 1 - m / a.distanceTo(b)));
  const upOut = pS.sh.clone().lerp(pS.el, 1 / 3);
  const sF = cut(pS.elF, pS.wr, 0.06), oF = cut(pO.elF, pO.wr, 0.06);
  let m = Infinity;
  for (const [a, b, ra] of [[upOut, pS.el, 0.045], [pS.elF, sF, 0.04]]) for (const [c, d, rb] of [[pO.sh, pO.el, 0.045], [pO.elF, oF, 0.04]]) m = Math.min(m, segSeg(a, b, c, d) - ra - rb);
  return m;
}
function actPts(f, side) {
  const B = f.bodies, ub = side === 'S' ? B.uarmS : B.uarmO, fb = side === 'S' ? B.farmS : B.farmO;
  const ax = side === 'S' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const ua = ax.clone().applyQuaternion(Q(ub.rotation())), fa = ax.clone().applyQuaternion(Q(fb.rotation()));
  const uc = V(ub.translation()), fc = V(fb.translation());
  return { sh: uc.clone().addScaledVector(ua, -0.15), el: uc.clone().addScaledVector(ua, 0.15), elF: fc.clone().addScaledVector(fa, -0.135), wr: fc.clone().addScaledVector(fa, 0.135) };
}
function cmdPts(f, side) {
  const J = f.jointByName, ch = f.bodies.chest, qc = Q(ch.rotation()), c = V(ch.translation());
  const s = side === 'S' ? 1 : -1;
  const sh = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], s * f.side * ARM.shoulder[2]).applyQuaternion(qc).add(c);
  const ax = side === 'S' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const qu = qc.clone().multiply(J['uarm' + side].target), qf = qu.clone().multiply(J['farm' + side].target);
  const ua = ax.clone().applyQuaternion(qu), fa = ax.clone().applyQuaternion(qf);
  const el = sh.clone().addScaledVector(ua, 0.3);
  return { sh, el, elF: el.clone().addScaledVector(fa, 0.005), wr: el.clone().addScaledVector(fa, 0.275) };
}
const cells = String(args.cells ?? 'balisarda:left,rapier:left').split(',').map((x) => x.split(':'));
const f3 = (v) => [v.x, v.y, v.z].map((x) => x.toFixed(3)).join(' ');
for (const [weapon, dir] of cells) {
  const rows = [];
  let P = null, G = null;
  const on = A.runDir({ weapon, dir, mode: 'slow', onRound: (r) => {
    G = r.G; P = r.P;
    const st = G.step.bind(G);
    G.step = (...a) => {
      const out = st(...a);
      if (G.t < SETTLE) return out;
      const s = A.armReachSample(P);
      if (!s) return out;
      const aS = actPts(P, 'S'), aO = actPts(P, 'O'), cS = cmdPts(P, 'S'), cO = cmdPts(P, 'O');
      rows.push({ t: G.t, act: s.arms, act2: gap(aS, aO), cmd: gap(cS, cO), aS, aO, cS, cO,
        eS: cS.el.distanceTo(aS.el), wS: cS.wr.distanceTo(aS.wr), eO: cO.el.distanceTo(aO.el), wO: cO.wr.distanceTo(aO.wr), shS: cS.sh.distanceTo(aS.sh), shO: cO.sh.distanceTo(aO.sh) });
      return out;
    };
  } });
  const n = rows.length, mean = (a, k) => a.reduce((x, r) => x + r[k], 0) / Math.max(1, a.length);
  const ovA = rows.filter((r) => r.act < -PEN), ovC = rows.filter((r) => r.cmd < -PEN);
  const both = ovA.filter((r) => r.cmd < -PEN).length;
  const minA = Math.min(...rows.map((r) => r.act)), minC = Math.min(...rows.map((r) => r.cmd));
  const near = ovA.length ? ovA : rows.filter((r) => r.act < 0);
  console.log(`${weapon} ${dir}: 시험 몫 frac.arms ${on.frac.arms.toFixed(3)} (스텝 ${on.n}) | 내 스텝 ${n} · 실제 2 cm 넘게 겹침 ${ovA.length} (${(ovA.length / n).toFixed(3)}) · 가장 깊이 ${(-minA * 100).toFixed(1)} cm · 실제 셈 맞춤(내 셈 − 시험 셈 가장 큰) ${Math.max(...rows.map((r) => Math.abs(r.act2 - r.act))).toFixed(4)} m`);
  console.log(`   명령 2 cm 넘게 겹침 ${ovC.length} (${(ovC.length / n).toFixed(3)}) · 가장 깊이 ${(-minC * 100).toFixed(1)} cm · 실제 겹친 스텝 가운데 명령도 겹침 ${both}/${ovA.length} · 그 스텝의 명령 틈 평균 ${(mean(ovA, 'cmd') * 100).toFixed(1)} cm`);
  console.log(`   따라감 오차(cm, 모든 스텝 평균 / 실제 겹친 스텝 평균): 칼 팔꿈치 ${(mean(rows, 'eS') * 100).toFixed(1)} / ${(mean(near, 'eS') * 100).toFixed(1)} · 칼 손목 ${(mean(rows, 'wS') * 100).toFixed(1)} / ${(mean(near, 'wS') * 100).toFixed(1)} · 빈 팔꿈치 ${(mean(rows, 'eO') * 100).toFixed(1)} / ${(mean(near, 'eO') * 100).toFixed(1)} · 빈 손목 ${(mean(rows, 'wO') * 100).toFixed(1)} / ${(mean(near, 'wO') * 100).toFixed(1)} · 어깨 자리 차이 ${(mean(rows, 'shS') * 100).toFixed(1)} · ${(mean(rows, 'shO') * 100).toFixed(1)}`);
  if (args.csv) writeFileSync(join(String(args.csv), `armsD_${weapon}_${dir}.csv`), 't,act,cmd,' + ['aS', 'aO', 'cS', 'cO'].flatMap((k) => ['el', 'wr'].flatMap((p) => ['x', 'y', 'z'].map((x) => `${k}_${p}${x}`))).join(',') + '\n' +
    rows.map((r) => [r.t.toFixed(4), r.act.toFixed(4), r.cmd.toFixed(4), ...['aS', 'aO', 'cS', 'cO'].flatMap((k) => f3(r[k].el).split(' ').concat(f3(r[k].wr).split(' ')))].join(',')).join('\n') + '\n');
}
