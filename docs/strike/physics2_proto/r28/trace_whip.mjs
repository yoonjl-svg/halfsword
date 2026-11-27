// r28 A1 — 휘둘린 탭 찌르기 한 판을 스텝마다 찍음 (읽기만 — 몸에 아무것도 걸지 않음 · 원래 함수를 감싸 값을 적을 뿐)
//  node trace_whip.mjs --root=<나무> --seed=4801 --w=rapier --gap=<골반 간격 m> [--pelvisGap=<m>] [--post=1.5] [--n=60] [--json=파일]
//   지문 장면 = --seed=4801 --gap=1.701 (fp_compare 와 같음: 팔 닿음 1.791 + 0.11 − 0.2) · 관문 줄 = 그 줄의 seed · gap 을 --gap · --pelvisGap 둘 다에
//  칸 (스텝마다 · 탭 = 0):
//   tip     칼끝 자리 (세계 x y z)          tipV  칼끝 빠르기 m/s
//   aLine   칼 축과 명령한 찌르기 선(h0 → 목표점, 몸 yaw 틀)이 이루는 각 °      aDir 칼 축과 명령한 칼 방향(thrustPose.dir)의 각 °
//   hand    손(칼자루) 가슴 yaw 틀 [앞 위 옆]   cmd  명령 손 목표(thrustPose.hand) 같은 틀   ikT  armIK 가 받은 목표의 어깨 거리 · 팔이 닿는 한(dMax) 밖이면 '밖'
//   twR     anatSoft 가 재는 실제 위팔 돌림 ° (띠 = JOINTS.twist ± zone 밖이면 '*')   tq  그 스텝 anatSoft 되돌림 스프링 토크 N·m (같은 식)
//   극축 sin  어깨 → 목표 방향과 팔꿈치 극(IK_POLE)의 사잇각 sin (0 이면 기본 팔꿈치 방향이 정해지지 않음)   한도 안 돌림 수 = 같은 풀이로 돌림 한 바퀴(2°) 가운데 위팔 돌림이 사람 한도 안 · 팔꿈치 아래인 것
//   twC     armIK 가 명령한 위팔 돌림 ° (같은 정의 · 명령 틀)   swv  팔꿈치 돌림 명령 swivelTh °   wfix 손목 교정 wristFixDeg °   ph 찌르기 시계 tp.t
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const { Fighter } = await import(pathToFileURL(join(ROOT, 'src/fighter.js')).href);
const { Skill } = await import(pathToFileURL(join(ROOT, 'src/skill.js')).href);
const { JOINTS } = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
const THREE = await import(pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href);
const M = makeMeasure(H);
const seed = +(args.seed ?? 4801), w = String(args.w ?? 'rapier'), gap = +(args.gap ?? 1.701), pg = args.pelvisGap != null ? +args.pelvisGap : undefined, N = +(args.n ?? 60);
const HD = Math.PI / 180, V = (o) => new THREE.Vector3(o.x, o.y, o.z), Q = (o) => new THREE.Quaternion(o.x, o.y, o.z, o.w);
let P = null; const rec = {}; let line = null;
// 위팔 돌림 (anatSoft (2) 와 같은 식): u = 위팔 x 축 · zU = 위팔 z 축 · down = 가슴 −y — 들림 120° 넘으면 null
function twistOf(u, zU, down, side) { if (u.dot(down) <= Math.cos(120 * HD)) return null; const r = new THREE.Vector3(0, 0, side).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(down, u)); return side * Math.atan2(new THREE.Vector3().crossVectors(r, zU).dot(u), r.dot(zU)); }
const oSoft = Fighter.prototype.anatSoft;
Fighter.prototype.anatSoft = function () {
  if (this === P) { const up = this.bodies.uarmS, ch = this.bodies.chest; const qu = Q(up.rotation()), qc = Q(ch.rotation());
    const u = new THREE.Vector3(1, 0, 0).applyQuaternion(qu), zU = new THREE.Vector3(0, 0, 1).applyQuaternion(qu), down = new THREE.Vector3(0, -1, 0).applyQuaternion(qc);
    const tw = twistOf(u, zU, down, this.side); let tq = 0;
    if (tw != null) { const lo = (JOINTS.twist[0] + JOINTS.zone) * HD, hi = (JOINTS.twist[1] - JOINTS.zone) * HD; const ex = tw < lo ? lo - tw : tw > hi ? hi - tw : 0;
      if (ex !== 0) { const wu = up.angvel(), wc = ch.angvel(); const wTw = this.side * ((wu.x - wc.x) * u.x + (wu.y - wc.y) * u.y + (wu.z - wc.z) * u.z); tq = this.side * (JOINTS.kTwist * ex - (Math.sign(wTw) === -Math.sign(ex) ? JOINTS.dTwist * wTw : 0)); } }
    rec.twR = tw == null ? NaN : tw / HD; rec.tq = tq; }
  return oSoft.call(this);
};
const oIK = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (target, alignDir = null) {
  const r = oIK.call(this, target, alignDir);
  if (this === P && this._ikMain) { const qt = this.jointByName.uarmS.target; const u = new THREE.Vector3(1, 0, 0).applyQuaternion(qt), z = new THREE.Vector3(0, 0, 1).applyQuaternion(qt);
    const tw = twistOf(u, z, new THREE.Vector3(0, -1, 0), this.side); rec.twC = tw == null ? NaN : tw / HD; rec.swv = (this.swivelTh || 0) / HD; rec.full = !!this.armFull;
    const c = this.bodies.chest.translation(); const T = V(target).sub(V(c)).applyQuaternion(Q(this.bodies.chest.rotation()).invert()); rec.ikT = T;
    // 같은 풀이(armIK · elbowSwivel 꼴)로 이 목표에 팔꿈치 돌림 한 바퀴(2°)를 다 봄: 사람 한도(JOINTS.twist) 안 · 팔꿈치가 어깨 → 손 줄 아래(armOk ①)인 돌림이 몇 개인가
    const S = new THREE.Vector3(0, 0.1, this.side * 0.2), D = T.clone().sub(S), a = 0.3, b = 0.27; const d = Math.min(Math.max(D.length(), 0.08), a + b - 0.005); const Dn = D.clone().normalize();
    const pole = new THREE.Vector3(-0.25, -1, this.side * 0.5).normalize(); const pD = pole.clone().addScaledVector(Dn, -pole.dot(Dn)); rec.poleSin = pD.length(); pD.normalize(); const q = new THREE.Vector3().crossVectors(Dn, pD);
    const al = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d)))); let ok = 0; rec.ikD = D.length();
    for (let k = 0; k < 180; k++) { const th = k * 2 * HD; const p = pD.clone().multiplyScalar(Math.cos(th)).addScaledVector(q, Math.sin(th)); if (p.y > 0) continue; const u = Dn.clone().multiplyScalar(Math.cos(al)).addScaledVector(p, Math.sin(al));
      const y = Dn.clone().multiplyScalar(d).addScaledVector(u, -a); y.addScaledVector(u, -y.dot(u)); const z = new THREE.Vector3().crossVectors(u, y.normalize()).normalize(); const tw = twistOf(u, z, new THREE.Vector3(0, -1, 0), this.side);
      if (tw == null || (tw / HD >= JOINTS.twist[0] && tw / HD <= JOINTS.twist[1])) ok++; }
    rec.okN = ok; }
  return r;
};
const oUT = Skill.prototype.updateThrust;
Skill.prototype.updateThrust = function (dt) { const tp = this.tap; const r = oUT.call(this, dt);
  if (this.f === P && tp) { const h = this.thrustPose.hand; rec.cmd = h.slice(); rec.ph = tp.t; rec.dir = this.thrustPose.dir.slice();
    if (this.tap && !tp.down && !tp.vital && !tp.abort) { const Pt = this.thrustTarget(new THREE.Vector3()); const d = [Pt.x - tp.h0[0], Pt.y - tp.h0[1], Pt.z - tp.h0[2]]; const L = Math.hypot(...d); rec.line = d.map((x) => x / L); } // 찌르기 선 = h0 → 목표점 (updateThrust 의 _q 와 같은 셈 · 같은 스텝의 가슴 · yaw)
    rec.h0 = tp.h0; }
  return r; };
const rows = []; const f = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const res = M.runThrust(seed, w, { gap, pelvisGap: pg, post: +(args.post ?? 1.5), raw: true,
  onTap: (G, Pl) => { P = Pl; },
  onStep: (G, Pl, E, i) => { if (i >= N) return; const tipW = Pl.bladePoint(1, new THREE.Vector3()); const tv = V(Pl.sword.velocityAtPoint(tipW)).length();
    const yawI = Pl.yaw.clone().invert(); const c = V(Pl.bodies.chest.translation()); const hand = V(H.handPos(Pl)).sub(c).applyQuaternion(yawI);
    const b = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(Pl.sword.rotation())).applyQuaternion(yawI);
    const ang = (v) => (v ? Math.acos(Math.max(-1, Math.min(1, b.dot(new THREE.Vector3(...v).normalize())))) / HD : NaN);
    rows.push({ okN: rec.okN, poleSin: rec.poleSin, i, ph: rec.ph, tip: [tipW.x, tipW.y, tipW.z], tipV: tv, aLine: ang(rec.line), aDir: ang(rec.dir), hand: hand.toArray(), cmd: rec.cmd, ikD: rec.ikD, ikT: rec.ikT?.toArray(), full: rec.full, twR: rec.twR, tq: rec.tq, twC: rec.twC, swv: rec.swv, wfix: Pl.wristFixDeg, line: rec.line }); } });
const hits = res.hits.filter((k) => k >= res.o).map((k) => k - res.o);
const band = [JOINTS.twist[0] + JOINTS.zone, JOINTS.twist[1] - JOINTS.zone];
console.log(`trace_whip seed ${seed} ${w} gap ${gap} pelvisGap ${pg ?? '-'} · 탭 ok ${res.ok} · 맞음 스텝 ${JSON.stringify(hits.slice(0, 4))} · 위팔 돌림 띠 [${band}]° (밖 = 되돌림 스프링) · 사람 한도 [${JOINTS.twist}]°`);
console.log('스텝 | ph | 칼끝 x y z | v | aLine° aDir° | 손(가슴 yaw) | 명령 손 | ikT(가슴) 어깨→목표 m 밖 | 극축 sin · 한도 안 돌림 수/180 | 실제돌림° | 스프링 N·m | 명령돌림° | swivel° | wfix°');
for (const r of rows) console.log(`${String(r.i).padStart(3)} | ${f(r.ph, 3)} | ${r.tip.map((x) => f(x)).join(' ')} | ${f(r.tipV, 1)} | ${f(r.aLine, 0)} ${f(r.aDir, 0)} | ${r.hand.map((x) => f(x)).join(' ')} | ${r.cmd ? r.cmd.map((x) => f(x)).join(' ') : '-'} | ${r.ikT ? r.ikT.map((x) => f(x)).join(' ') : '-'} ${f(r.ikD)} ${r.full ? '밖' : '안'} | ${f(r.poleSin)} ${r.okN} | ${f(r.twR, 0)}${r.twR < band[0] || r.twR > band[1] ? '*' : ''} | ${f(r.tq, 1)} | ${f(r.twC, 0)} | ${f(r.swv, 0)} | ${f(r.wfix, 0)}`);
let pk = 0, pki = -1; for (const r of rows) if (r.tipV > pk) { pk = r.tipV; pki = r.i; }
const zs = rows.map((r) => r.tip[2]); console.log(`칼끝 가장 빠름 ${f(pk, 1)} m/s @ ${pki} · 칼끝 z 폭 ${f(Math.max(...zs) - Math.min(...zs))} m`);
if (args.json) writeFileSync(String(args.json), JSON.stringify({ seed, w, gap, pg, hits, rows }));
