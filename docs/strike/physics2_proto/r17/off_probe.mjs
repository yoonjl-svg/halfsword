// arm_real D 판(runDir 손가락 · slow)에서 빈손 비킴 ② (offArmSchool → offYieldWant) 의 들어감 · 나감을 스텝마다 찍음 (재기만):
//   node off_probe.mjs --root=<inst_off.py 로 고리 넣은 나무> [--cells=balisarda:left,rapier:left] [--csv=<폴더>]
//  g0 = 비킴 전 빈손 자리 P0 에서 본 틈(지난 스텝 칼 팔 IK 자세 _swGeo) · want = 비킴이 바란 옮김 · gW = P0 + want 의 틈 · y = 따라간 옮김(swivelTau) · gY = P0 + y 의 틈
//  gNow = 같은 빈손 자리를 이 스텝 칼 팔 IK 자세로 본 틈 · cmd = 명령 자세 틈(arms_d_probe 셈) · act = 실제 몸 틈 (시험 셈)
import { pathToFileURL } from 'node:url';
import { join, resolve, dirname } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const A = await import(u('tools/sim/arm_reach_audit.mjs'));
const { CONFIG, THREE } = await import(u('tools/sim/harness_m.mjs'));
const { ARM, SKILL } = CONFIG;
const PEN = A.PEN, SETTLE = A.SETTLE;
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);
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
function cmdPts(f, side) {
  const J = f.jointByName, ch = f.bodies.chest, qc = Q(ch.rotation()), c = V(ch.translation());
  const s = side === 'S' ? 1 : -1;
  const sh = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], s * f.side * ARM.shoulder[2]).applyQuaternion(qc).add(c);
  const ax = side === 'S' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, -1, 0);
  const qu = qc.clone().multiply(J['uarm' + side].target), qf = qu.clone().multiply(J['farm' + side].target);
  const ua = ax.clone().applyQuaternion(qu), fa = ax.clone().applyQuaternion(qf);
  const el = sh.clone().addScaledVector(ua, 0.3);
  return { sh, el, elF: el.clone().addScaledVector(fa, 0.005), wr: el.clone().addScaledVector(fa, 0.275), qc, c };
}
const cells = String(args.cells ?? 'balisarda:left,rapier:left').split(',').map((x) => x.split(':'));
const f2 = (x) => (x * 100).toFixed(2);
for (const [weapon, dir] of cells) {
  const rows = [];
  let P = null, G = null, cur = null, nOff = 0, offWhy = {};
  globalThis.__OYH = {
    pre(f, P0, want, g, opg) { if (f !== P) return; const gg = { S: g.S.clone(), E: g.E.clone(), W: g.W.clone() };
      cur = { P0: P0.clone(), want: want.clone(), geo: gg, opg, g0: opg(gg, P0, f.side), gW: opg(gg, P0.clone().add(want), f.side) }; },
    post(f, Pf, y) { if (f !== P || !cur) return; cur.Pf = Pf.clone(); cur.y = y.clone(); cur.gY = cur.opg(cur.geo, Pf, f.side); },
    off(f, on, ok) { if (f !== P) return; nOff++; const k = `on${+on}ok${+ok}`; offWhy[k] = (offWhy[k] || 0) + 1; cur = null; },
  };
  const on = A.runDir({ weapon, dir, mode: 'slow', onRound: (r) => {
    G = r.G; P = r.P;
    const st = G.step.bind(G);
    G.step = (...a) => {
      cur = null;
      const out = st(...a);
      if (G.t < SETTLE) return out;
      const s = A.armReachSample(P);
      if (!s) return out;
      const cS = cmdPts(P, 'S'), cO = cmdPts(P, 'O');
      const row = { t: G.t, act: s.arms, cmd: gap(cS, cO), h: !!cur };
      if (cur && cur.Pf) {
        const g = P._swGeo; row.gNow = cur.opg({ S: g.S.clone(), E: g.E.clone(), W: g.W.clone() }, cur.Pf, P.side);
        // 명령 빈 손목 (가슴 틀) − 바란 빈손 자리 Pf : 빈팔 IK 가 목표에 닿았나 (뻗음 끝 0.57 m 넘으면 못 닿음)
        const wO = cO.wr.clone().sub(cO.c).applyQuaternion(cO.qc.clone().invert());
        row.reachErr = wO.distanceTo(cur.Pf); row.Pd = cur.Pf.distanceTo(new THREE.Vector3(0, 0.1, -P.side * 0.2));
        // 칼 팔 IK 자세(이 스텝) vs 명령 칼 팔 (가슴 틀 팔꿈치 · 손목 차)
        const eS = cS.el.clone().sub(cS.c).applyQuaternion(cS.qc.clone().invert()), wS = cS.wr.clone().sub(cS.c).applyQuaternion(cS.qc.clone().invert());
        row.swE = eS.distanceTo(g.E); row.swW = wS.distanceTo(g.W);
        Object.assign(row, { g0: cur.g0, gW: cur.gW, gY: cur.gY, want: cur.want.length(), y: cur.y.length(), wv: cur.want.toArray().map((x) => +x.toFixed(3)).join(' '), P0: cur.P0.toArray().map((x) => +x.toFixed(3)).join(' ') });
      }
      rows.push(row);
      return out;
    };
  } });
  const n = rows.length, ov = rows.filter((r) => r.cmd < -PEN), ovh = ov.filter((r) => r.h && r.Pf !== undefined || r.g0 !== undefined);
  const mean = (a, k) => a.reduce((x, r) => x + (r[k] ?? 0), 0) / Math.max(1, a.length);
  const cnt = (a, fn) => a.filter(fn).length;
  console.log(`${weapon} ${dir}: 스텝 ${n} · 시험 몫 ${on.frac.arms.toFixed(3)} · 명령 2 cm 넘게 ${ov.length} (${(ov.length / n).toFixed(3)}) · 비킴 안 돈 스텝(전체) ${nOff} ${JSON.stringify(offWhy)} · 겹친 스텝 중 비킴 돈 ${ovh.length}`);
  if (ovh.length) {
    console.log(`  겹친 스텝 평균(cm): g0 ${f2(mean(ovh, 'g0'))} · gW ${f2(mean(ovh, 'gW'))} · gY ${f2(mean(ovh, 'gY'))} · gNow ${f2(mean(ovh, 'gNow'))} · cmd ${f2(mean(ovh, 'cmd'))} · act ${f2(mean(ovh, 'act'))} · |want| ${f2(mean(ovh, 'want'))} · |y| ${f2(mean(ovh, 'y'))} · 빈손 닿음 오차 ${f2(mean(ovh, 'reachErr'))} · 어깨→목표 ${f2(mean(ovh, 'Pd'))} · 칼 팔꿈치/손목 IK↔명령 ${f2(mean(ovh, 'swE'))}/${f2(mean(ovh, 'swW'))}`);
    console.log(`  겹친 스텝 가름: 바람 없음(g0 ≥ gap) ${cnt(ovh, (r) => r.g0 >= SKILL.armClear.gap)} · 바람이 gap 못 엶(gW < gap · yield 끝) ${cnt(ovh, (r) => r.g0 < SKILL.armClear.gap && r.gW < SKILL.armClear.gap)} · 바람은 엶 · 따라감 모자람(gY < gap) ${cnt(ovh, (r) => r.gW >= SKILL.armClear.gap && r.gY < SKILL.armClear.gap)} · 지난 자세로는 엶 · 이 스텝 칼 팔로 닫힘(gY ≥ gap > gNow) ${cnt(ovh, (r) => r.gY >= SKILL.armClear.gap && r.gNow < SKILL.armClear.gap)} · 모형은 엶 · 명령은 겹침(gNow ≥ gap) ${cnt(ovh, (r) => r.gNow >= SKILL.armClear.gap)} · 빈손 못 닿음(> 2 cm) ${cnt(ovh, (r) => r.reachErr > 0.02)}`);
  }
  if (args.csv) { const K = ['t', 'act', 'cmd', 'g0', 'gW', 'gY', 'gNow', 'want', 'y', 'reachErr', 'Pd', 'swE', 'swW', 'wv', 'P0'];
    writeFileSync(join(String(args.csv), `off_${weapon}_${dir}.csv`), K.join(',') + '\n' + rows.map((r) => K.map((k) => typeof r[k] === 'number' ? +r[k].toFixed(4) : (r[k] ?? '')).join(',')).join('\n') + '\n'); }
}
