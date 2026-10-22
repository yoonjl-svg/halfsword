// 독일 죽음의 일격 (모르트슐라크) 탐침 — 동작만 (docs/strike/german_mordschlag_2026-10-22.md §3)
//  가만히 선 상대(AI 없음 · 손 자리 GUARDS) 앞 가슴 거리 GAPS 에서 플레이어(독일 무기)가 비기를 곧장 낸다(창 · 조건 없이 skill.secret).
//  잰다: 손목 ↔ 쥔 자리 어긋남(관절이 버티나) · 칼 각속도 최고 · 코등이 최고 빠르기 · 칼자루가 머리를 쳤나(에너지) · 칼날 맞음 · 내 칼 ↔ 내 몸통 닿음 · NaN · 상대 상태.
//  실행: node tools/sim/mordschlag_probe.mjs [무기=longsword] [판=reverse|hilt] [가슴 거리 목록=0.6,0.7,0.8]
//   환경 변수: GUARDS=home,high,low(상대 손 자리) · FOE=longsword(상대 무기) · MORD_JSON='{"tech":"zornhau"}' 또는 '{"kin":0.6,"aim":"pull","power":"finish"}'(10/22 밤 고칠 안 — 문서 §11) · OVER=1(넘어 들어감 규칙) · TRACE=1(0.034 s 마다 자취 · 손목 굽힘 · 굴림 · 닿은 몸) · NOSELF=1(시험: 내 칼 ↔ 내 몸통 충돌 끔)
import { newRound, DT, THREE } from './harness_m.mjs';
import { SECRET, SKILL } from '../../src/config.js';
import { TRADITIONS } from '../../src/schools.js';

const W = process.argv[2] || 'longsword';
const MODE = process.argv[3] || 'reverse';
const GAPS = (process.argv[4] || '0.6,0.7,0.8').split(',').map(Number);
const GUARDS = (process.env.GUARDS || 'home,high,low').split(',');
SECRET.mord.grip = MODE;
if (process.env.MORD_JSON) Object.assign(SECRET.mord, JSON.parse(process.env.MORD_JSON));
if (process.env.OVER) SECRET.mordOver = 1;
class Still {
  constructor(me) { this.me = me; }
  update() { this.me.move.set(0, 0); }
}
const PADS = { home: SKILL.homeGuard, high: [0.02, 0.45], low: [0.05, -0.35], kron: [0.02, 0.4] };
const rows = [];
const q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
for (const gap of GAPS) for (const gd of GUARDS) {
  const G = newRound({ weapon: W, weapon2: process.env.FOE || 'longsword', seed: 7, gap, walls: false, AIClass: Still });
  const P = G.player, E = G.enemy;
  P.skill.corr = SKILL.corr; P.skill.corrTip = SKILL.corrTip; P.skill.autoGuard = true; P.canShove = true;
  const hits = [];
  G.combat.hooks.onWound = (att, vic, r, pt, pr) => { if (att === P && P.skill.sec) hits.push({ part: pr?.w?.part, zone: r.zone, type: r.type, E: +r.energy.toFixed(1), st: P.skill.sec.stage }); };
  const S = TRADITIONS.german.playerSecret;
  let fired = false, tFire = 0, maxErr = 0, maxW = 0, maxHilt = 0, nan = false, torso = 0, foeSw = 0, endT = null, Emin = 'stand', prevX = null, prevE = null, maxEnd = 0, endPath = 0, endT0 = 0, prevG = null, Pmin = 'stand', tilt = 0, handX = Infinity;
  const stages = {};
  const torsoCols = ['chest', 'abdomen', 'pelvis'].map((k) => P.bodies[k].collider(0));
  G.before = () => {
    P.move.set(0, 0); P.stickX = P.stickY = 0;
    if (!fired) { P.handOffset.x = SKILL.homeGuard[0]; P.handOffset.y = SKILL.homeGuard[1]; }
    E.handOffset.x = PADS[gd][0]; E.handOffset.y = PADS[gd][1];
  };
  for (let i = 0; i < 6 / DT; i++) {
    G.step();
    if (!fired && G.t > 2.4) {
      fired = P.skill.secret({ S, ctx: { ev: 'press' } }); tFire = G.t;
      if (process.env.NOSELF) for (const c of P.swordColliders) c.setCollisionGroups(c.collisionGroups() & ~256); // 시험: 내 칼 ↔ 내 몸통 충돌 끔 (torsoBit(0) = 256)
    }
    if (E.state !== 'stand') Emin = E.state;
    if (fired && P.skill.sec) {
      const st = P.skill.sec.stage;
      stages[st] = (stages[st] ?? 0) + DT;
      const fa = P.bodies.farmS, sw = P.sword, sq = q(sw.rotation());
      const wr = new THREE.Vector3(0.13, 0, 0).applyQuaternion(q(fa.rotation())).add(fa.translation());
      const gp = new THREE.Vector3(0, P.mordGrip ? P.mordGrip.g : 0, 0).applyQuaternion(sq).add(sw.translation());
      maxErr = Math.max(maxErr, wr.distanceTo(gp));
      const w = sw.angvel(); maxW = Math.max(maxW, Math.hypot(w.x, w.y, w.z));
      const cross = new THREE.Vector3(0, P.weaponCfg.hiltLength - 0.015, 0).applyQuaternion(sq).add(sw.translation());
      // 코등이 · 칼자루 끝(폼멜 공 밑) 빠르기 — 자리 차이 ÷ 스텝 (운동학 길은 몸 속도가 가슴 속도라 velocityAtPoint 로는 못 잰다)
      const pe = new THREE.Vector3(0, -0.15, 0).applyQuaternion(sq).add(sw.translation());
      const gNow = P.mordGrip; // 쥠을 바꾼 스텝(칼 몸 순간이동)은 빠르기로 읽지 않는다
      if (st === 'strike' || st === 'instant') { const c0 = P.bodies.chest.translation(); handX = Math.min(handX, new THREE.Vector3(wr.x - c0.x, wr.y - c0.y, wr.z - c0.z).applyQuaternion(P.yaw.clone().invert()).x); } // 손목이 가슴 앞(+) · 뒤(−)로 가장 들어온 자리 (몸 틀 m)
      if (P.state !== 'stand') Pmin = P.state;
      const cq = q(P.bodies.chest.rotation()), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cq);
      tilt = Math.max(tilt, Math.acos(Math.min(1, up.y)) * 180 / Math.PI);
      if ((st === 'strike' || st === 'follow' || st === 'instant') && prevX && prevE && gNow === prevG) {
        maxHilt = Math.max(maxHilt, cross.distanceTo(prevX) / DT);
        maxEnd = Math.max(maxEnd, pe.distanceTo(prevE) / DT);
        if (P.iai || st === 'strike' || st === 'follow') { endPath += pe.distanceTo(prevE); endT0 += DT; }
      }
      prevX = cross; prevE = pe; prevG = gNow;
      if (![wr.x, gp.x, w.x].every(Number.isFinite)) nan = true;
      for (const tc of torsoCols) for (const sc of P.swordColliders) G.world.contactPair(tc, sc, (m) => { if (m.numContacts() > 0) torso++; });
      for (const ec of E.swordColliders) for (const sc of P.swordColliders) G.world.contactPair(ec, sc, (m) => { if (m.numContacts() > 0 && (st === 'strike' || st === 'follow')) foeSw++; });
      if (process.env.TRACE && Math.round(G.t / DT) % 2 === 0) {
        const c = P.bodies.chest.translation(), yi = P.yaw.clone().invert();
        const L = (v) => new THREE.Vector3(v.x, v.y, v.z).sub(c).applyQuaternion(yi);
        const at = (y) => L(new THREE.Vector3(0, y, 0).applyQuaternion(sq).add(sw.translation()));
        const f2 = (v) => `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
        const v = sw.velocityAtPoint(cross);
        const fq = q(fa.rotation()), bw = new THREE.Vector3(0, 1, 0).applyQuaternion(sq);
        const zF = new THREE.Vector3(0, 0, 1).applyQuaternion(fq), xF = new THREE.Vector3(1, 0, 0).applyQuaternion(fq), zS = new THREE.Vector3(0, 0, 1).applyQuaternion(sq);
        const deg = (x) => (Math.acos(Math.max(-1, Math.min(1, x))) * 180 / Math.PI).toFixed(0);
        const aimT = P.debug.aim, ang = deg(bw.dot(aimT));
        let cs = '';
        for (const [k, b] of Object.entries(P.bodies)) for (const sc of P.swordColliders) G.world.contactPair(b.collider(0), sc, (m) => { if (m.numContacts() > 0) cs += 'my' + k + ','; });
        for (const [k, b] of Object.entries(E.bodies)) for (const sc of P.swordColliders) G.world.contactPair(b.collider(0), sc, (m) => { if (m.numContacts() > 0) cs += k + ','; });
        process.stdout.write(`fe${(Math.asin(Math.max(-1, Math.min(1, bw.dot(zF)))) * 180 / Math.PI).toFixed(0)} roll${deg(zS.dot(zF))} flexH${deg(-bw.dot(xF))} err${ang} T${P.debug.wristTorque.length().toFixed(0)}/${P.debug.wristCap.toFixed(0)} [${cs}] `);
        console.log(`t${(G.t - tFire).toFixed(3)} ${st.padEnd(8)} hand ${f2(L(wr))} cross ${f2(at(P.weaponCfg.hiltLength - 0.015))} v${Math.hypot(v.x, v.y, v.z).toFixed(1)} pom ${f2(at(-0.12))} tip ${f2(at(P.weaponCfg.hiltLength + P.weaponCfg.bladeLength))} head ${f2(L(E.bodies.head.translation()))} aim${P.mordAim ? '−' : '+'}`);
      }
    }
    if (fired && !P.skill.sec && endT == null) endT = +(G.t - tFire).toFixed(2);
    if (endT != null && G.t > tFire + endT + 0.3) break;
  }
  const head = hits.filter((h) => h.zone === 'head' && h.part === 'hilt');
  const R = P.instantResult;
  rows.push({ W, MODE, gap, gd, fired, endT, maxErr: +maxErr.toFixed(3), maxW: +maxW.toFixed(1), maxHiltV: +maxHilt.toFixed(2), maxEndV: +maxEnd.toFixed(1), avgEndV: endT0 ? +(endPath / endT0).toFixed(1) : 0, ...(R?.mord ? { kinT: +R.T.toFixed(3), pullD: +R.pullD.toFixed(2), wPart: R.wPart, hy: R.hy, blocked: R.blocked } : {}), torsoSteps: torso, foeSwordSteps: foeSw, nan, headHilt: head.map((h) => `${h.E}J@${h.st}`).join(' '), hits: hits.map((h) => `${h.part[0]}>${h.zone}:${h.type[0]}${h.E}@${h.st}`).join(' '), Estate: Emin, Pstate: Pmin, chestTiltMax: +tilt.toFixed(0), handXmin: +handX.toFixed(2), stages: Object.fromEntries(Object.entries(stages).map(([k, v]) => [k, +v.toFixed(2)])) });
  console.log(JSON.stringify(rows.at(-1)));
  G.world.free?.();
}
