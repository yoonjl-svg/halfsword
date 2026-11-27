// 빈팔 선 자세 지문 (읽기만): ROOT=<나무> node offarm_fp.mjs <출력 json> — 무기 · 겨눔 자리마다 서서 5 초 둔 뒤 마지막 1 초 평균(그 1 초 위팔 목표 흔들림 · 같은 스텝 같은 목표를 옛 셈으로 푼 것과 가장 큰 차도) 빈팔 근육 목표(uarmO · farmO target 사원수)
//  롱소드 · 츠바이핸더: 패드 가운데 + 8 방향(arm_reach_audit DIRS × 0.8) · 레이피어: 가운데(빈손 = 유파 빈팔 길). 상대는 3 m 앞에 서 있기만.
//  FPSEED=<수> (기본 1) · FPGAP=<m> (기본 3) — 같은 칸을 조금 바꿔 다시 재면 흔들림(11/27 읽기 지적 · 씨앗만으로는 바이트 같음 → 간격을 1 mm 옮김)
//  둘을 맞대려면: node offarm_fp.mjs --cmp <앞 json> <뒤 json> → 자리마다 위팔 · 아래팔 목표 각 차(°)
import { readFileSync, writeFileSync } from 'node:fs';
const HD = 180 / Math.PI;
if (process.argv[2] === '--cmp') {
  const a = JSON.parse(readFileSync(process.argv[3])), b = JSON.parse(readFileSync(process.argv[4]));
  const ang = (p, q) => 2 * Math.acos(Math.min(1, Math.abs(p[0] * q[0] + p[1] * q[1] + p[2] * q[2] + p[3] * q[3]))) * HD;
  let mx = 0;
  for (const k of Object.keys(a)) {
    const du = ang(a[k].u, b[k].u), df = ang(a[k].f, b[k].f);
    mx = Math.max(mx, du, df);
    console.log(`${k.padEnd(22)} 빈 위팔 ${du.toFixed(3)}° · 빈 아래팔 ${df.toFixed(3)}° | 마지막 1 초 흔들림 앞 ${a[k].sp} · 뒤 ${b[k].sp}° | 같은 목표 옛 셈과 가장 큰 차 앞 ${a[k].dOld} · 뒤 ${b[k].dOld}° | 손 쪽 |pDir| ${a[k].pd}`);
  }
  console.log(`가장 큰 차 ${mx.toFixed(3)}° (자리 ${Object.keys(a).length})`);
  process.exit(0);
}
const root = process.env.ROOT;
const H = await import(root + '/tools/sim/harness_m.mjs');
const { setPad } = await import(root + '/tools/sim/corr_lib.mjs');
const { THREE } = H;
const S2 = Math.SQRT1_2 * 0.8;
const DIRS = { mid: [0, 0], up: [0, 0.8], upRight: [S2, S2], right: [0.8, 0], downRight: [S2, -S2], down: [0, -0.8], downLeft: [-S2, -S2], left: [-0.8, 0], upLeft: [-S2, S2] };
// 옛 셈(처음부터 pole 쪽 — 11/27 앞 offArmIK)으로 같은 목표의 위팔 목표를 세어 지금 목표와 맞댐: 같은 입력 → 같은 출력이면 0
const { Fighter } = await import(root + '/src/fighter.js');
const orig = Fighter.prototype.offArmIK;
Fighter.prototype.offArmIK = function (t, ...r) { (this._fpT ||= new THREE.Vector3()).copy(t); const q = this.bodies.chest.rotation(), c = this.bodies.chest.translation(); (this._fpQ ||= new THREE.Quaternion()).set(q.x, q.y, q.z, q.w); (this._fpC ||= new THREE.Vector3()).set(c.x, c.y, c.z); return orig.call(this, t, ...r); };
function oldU(P) {
  const T = P._fpT.clone().sub(P._fpC).applyQuaternion(P._fpQ.clone().invert()).sub(new THREE.Vector3(0, 0.1, -P.side * 0.2));
  const a = 0.3, b = 0.275, d = Math.min(Math.max(T.length(), 0.08), a + b - 0.005), Dn = T.normalize();
  const pD = new THREE.Vector3(-0.25, -1, -P.side * 0.5).normalize(); pD.addScaledVector(Dn, -pD.dot(Dn)); if (pD.lengthSq() < 1e-6) pD.set(0, -1, 0); pD.normalize();
  const al = Math.acos(Math.min(1, Math.max(-1, (a * a + d * d - b * b) / (2 * a * d))));
  const u = Dn.clone().multiplyScalar(Math.cos(al)).addScaledVector(pD, Math.sin(al));
  const fore = Dn.clone().multiplyScalar(d).sub(u.clone().multiplyScalar(a));
  const xA = fore.addScaledVector(u, -fore.dot(u)).normalize(), yA = u.clone().negate(), zA = new THREE.Vector3().crossVectors(xA, yA).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, yA, zA));
}
const qa = (p, q) => 2 * Math.acos(Math.min(1, Math.abs(p.dot(q)))) * HD;
const out = {};
for (const [weapon, dirs] of [['longsword', Object.keys(DIRS)], ['zweihander', Object.keys(DIRS)], ['rapier', ['mid']]]) for (const d of dirs) {
  const G = H.newRound({ weapon, weapon2: 'longsword', seed: +(process.env.FPSEED || 1), gap: +(process.env.FPGAP || 3) });
  const P = G.player;
  G.ai.update = () => G.enemy.move.set(0, 0);
  P.skill.autoGuard = true;
  setPad(P, DIRS[d]);
  const J = P.jointByName;
  let sp = 0, q0 = null, dOld = 0;
  const su = [0, 0, 0, 0], sf = [0, 0, 0, 0];
  const acc = (s4, q) => { const sg = q.w < 0 ? -1 : 1; s4[0] += sg * q.x; s4[1] += sg * q.y; s4[2] += sg * q.z; s4[3] += sg * q.w; };
  for (let i = 0; i < 720; i++) {
    G.step();
    if (i === 600) q0 = J.uarmO.target.clone();
    if (i > 600) { sp = Math.max(sp, qa(q0, J.uarmO.target)); dOld = Math.max(dOld, qa(oldU(P), J.uarmO.target)); acc(su, J.uarmO.target); acc(sf, J.farmO.target); }
  }
  const u = new THREE.Quaternion(...su).normalize(), f = new THREE.Quaternion(...sf).normalize(); // 마지막 1 초 평균 (선 자세의 숨 · 흔들림을 고름)
  const ud = new THREE.Vector3(0, -1, 0).applyQuaternion(u);
  const pole = new THREE.Vector3(-0.25, -1, -P.side * 0.5).normalize();
  const ch = P.bodies.chest, r = ch.rotation(), c = ch.translation();
  const hand = P.bodies.farmO.translation();
  const T = new THREE.Vector3(hand.x - c.x, hand.y - c.y, hand.z - c.z).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w).invert()).sub(new THREE.Vector3(0, 0.1, -P.side * 0.2)).normalize();
  out[`${weapon}:${d}`] = { u: [u.x, u.y, u.z, u.w], f: [f.x, f.y, f.z, f.w], ud: [ud.x, ud.y, ud.z].map((x) => +x.toFixed(2)).join(','), pd: +pole.addScaledVector(T, -pole.dot(T)).length().toFixed(2), state: P.state, sp: +sp.toFixed(3), dOld: +dOld.toFixed(4) };
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('자리', Object.keys(out).length);
