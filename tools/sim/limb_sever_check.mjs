// 팔·다리 절단 검사 (설계 docs/strike/limb_sever_design_2026-10-07.md §5-3). 결정적. 실패하면 exit 1.
//  ① 합성 상처로 팔꿈치·어깨·무릎·엉덩이를 각각 자르고: 관절 제거·부위 detached·몸값 감소·속도 보존(자르는 순간 Δv 0)
//  ② 600 프레임 동안 떨어진 몸체에 힘·충격량 호출 0, 떨어진 부위 관절(수동)에 모터 설정 호출 0, NaN 0
//  ③ 다리 상실: 600 프레임 뒤에도 서지 않음(getup·stand 0), 부활(revive) 뒤에도 누움·limbs 유지 · 팔 상실: armed false 인데 칼은 아래팔과 함께(쥠 관절 살아 있음), 칼·부위 접촉은 combat.pairOf null
//  ④ 조건 미달(찌르기·약함·관절에서 멂·박힘·passing 아님)이면 절단 0
//  ⑤ 'on' 배터리: fights12 와 같은 36 판 — 절단 사건/판, 사망·넘어짐, NaN
// 실행: node tools/sim/limb_sever_check.mjs [--sets=3]
import { newRound, THREE, DT, AI, CONFIG } from './jelly_harness.mjs';
import { newRound as newRoundM } from './harness_m.mjs'; // 합성 장면: 부활 시트(revive2)를 받는 쪽
import { ANATOMY } from '../../src/config.js';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const SETS = +(args.sets ?? 3);
let fails = 0; const say = (ok, name, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
class Passive { update() {} }
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
function round(opts = {}) { seedRand(7); const G = newRoundM({ walls: false, seed: 7, AIClass: Passive, ...opts }); G.park(); for (let i = 0; i < 120; i++) G.step(); return G; }
function wound(f, part, local, patch = {}) {
  const zone = part.startsWith('u') || part.startsWith('f') ? 'arm' : 'leg';
  return { part, zone, type: 'cut', severity: 1.5, energy: 150, pass: true, passing: true, stuck: false, helmet: false, plate: false, local: local.clone(), dir: new THREE.Vector3(0, -1, 0), bleedPerSev: ANATOMY[zone].bleed, helmetBlunt: 1, plateBlunt: 1, ...patch };
}
const v3 = (v) => new THREE.Vector3(v.x, v.y, v.z);
const anchorOwn = (f, name) => v3(f.jointByName[name].joint.anchor2());
function spyBodies(f, names) {
  const calls = { force: 0, motor: 0 };
  for (const n of names) { const b = f.bodies[n]; for (const m of ['addForce', 'addForceAtPoint', 'addTorque', 'applyImpulse', 'applyImpulseAtPoint', 'applyTorqueImpulse']) { const o = b[m].bind(b); b[m] = (...a) => { calls.force++; return o(...a); }; } }
  return calls;
}
function spyMotors(f, handles) {
  const calls = { motor: 0 }; const raw = f.uprightJoint.rawSet;
  for (const m of ['jointConfigureMotor', 'jointConfigureMotorPosition', 'jointConfigureMotorVelocity', 'jointConfigureMotorModel']) { const o = raw[m]; if (typeof o !== 'function') continue; raw[m] = function (h, ...a) { if (handles.has(h)) calls.motor++; return o.call(this, h, ...a); }; }
  return calls;
}
const nanFree = (f) => Object.values(f.bodies).every((b) => { const p = b.translation(), v = b.linvel(); return [p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite); });

const MODE = String(args.mode ?? 'on'); // --mode=off: ⑤ 배터리만 끈 채로 (전후표용)
CONFIG.COMBAT.limbSever = 'on';
const CASES = MODE === 'off' ? [] : [
  { name: 'elbow', part: 'farmS', joint: 'farmS', parts: ['farmS'], limb: 'armS' },
  { name: 'shoulder', part: 'uarmO', joint: 'uarmO', parts: ['uarmO', 'farmO'], limb: 'armO' },
  { name: 'knee', part: 'shinF', joint: 'shinF', parts: ['shinF', 'footF'], limb: 'legF' },
  { name: 'hip', part: 'thighB', joint: 'thighB', parts: ['thighB', 'shinB', 'footB'], limb: 'legB' },
];
for (const C of CASES) {
  const G = round({ revive2: { count: 1 } }); const P = G.player;
  const mass0 = P.totalMass; const expectLost = C.parts.reduce((s, p) => { const b = P.bodies[p]; let m = 0; for (let i = 0; i < b.numColliders(); i++) m += b.collider(i).mass(); return s + m; }, 0);
  const vel0 = Object.fromEntries(C.parts.map((p) => [p, { v: v3(P.bodies[p].linvel()), w: v3(P.bodies[p].angvel()) }]));
  const inner = C.parts.slice(1);
  const h = wound(P, C.part, anchorOwn(P, C.joint));
  P.applyWound(h);
  const sev = P.severed?.at(-1);
  say(!!sev && sev.joint === C.joint, `${C.name}: 절단 발생`, sev ? `${sev.kind} dist ${sev.dist.toFixed(3)}` : '없음');
  say(P.jointByName[C.joint].joint === null && !P.joints.includes(P.jointByName[C.joint]), `${C.name}: 관절 제거·근육 목록에서 빠짐`);
  say(C.parts.every((p) => P.detachedParts?.has(p)), `${C.name}: 부위 detached ${C.parts.join('+')}`);
  say(inner.every((p) => P.jointByName[p].joint && P.jointByName[p].passive && !P.joints.includes(P.jointByName[p])), `${C.name}: 안쪽 관절 수동 재생성 ${inner.join('+') || '(없음)'}`);
  say(close(mass0 - P.totalMass, expectLost, 1e-6), `${C.name}: 몸값 −${expectLost.toFixed(2)} kg`, `${mass0.toFixed(2)} → ${P.totalMass.toFixed(2)}`);
  say(C.parts.every((p) => { const b = P.bodies[p]; return v3(b.linvel()).distanceTo(vel0[p].v) < 1e-9 && v3(b.angvel()).distanceTo(vel0[p].w) < 1e-9; }), `${C.name}: 자르는 순간 속도 보존`);
  say(P.limbs[C.limb] === 0, `${C.name}: limbs.${C.limb} = 0`);
  say(P.wounds.at(-1)?.stump === true && P.wounds.at(-1)?.limb === C.name, `${C.name}: 단면 상처(${P.wounds.at(-1)?.part})`);
  const det = C.parts.every((p) => { const b = P.bodies[p]; for (let i = 0; i < b.numColliders(); i++) if (!G.combat.info.get(b.collider(i).handle)?.detached) return false; return true; });
  say(det, `${C.name}: colliderInfo.detached`);
  const spyF = spyBodies(P, C.parts); const spyM = spyMotors(P, new Set(inner.map((p) => P.jointByName[p].joint.handle)));
  const states = new Set();
  for (let i = 0; i < 600; i++) { G.step(); states.add(P.state); }
  say(spyF.force === 0, `${C.name}: 떨어진 몸체에 힘·충격량 호출 0 (600 프레임)`, `${spyF.force}`);
  say(spyM.motor === 0, `${C.name}: 수동 관절 모터 설정 0`, `${spyM.motor}`);
  say(nanFree(P), `${C.name}: NaN 0`);
  if (C.limb.startsWith('leg')) {
    say(!states.has('getup') && !states.has('stand') && P.state === 'down', `${C.name}: 서지 않음(600 프레임 상태 ${[...states].join('/')})`);
    say(P.missingLeg === true && !P.gait.active, `${C.name}: gait 꺼짐·missingLeg`);
    // 부활: 피를 다 흘린 죽음 → tryRevive → 누운 채 되살아남
    const left0 = P.revive.left; P.die('피');
    say(P.revival != null && P.revive.left === left0 - 1, `${C.name}: 부활 시작(참수 아님)`);
    const R = P.revive; const need = Math.round((R.lie + R.kneel + R.rise + R.linger + R.fade + 2) / DT);
    const st2 = new Set(); for (let i = 0; i < need; i++) { G.step(); st2.add(P.state); }
    say(P.revival == null && P.state === 'down' && !st2.has('stand') && !st2.has('getup'), `${C.name}: 부활 끝 — 누운 채(상태 ${[...st2].join('/')})`, `blood ${P.blood.toFixed(2)}`);
    say(P.limbs[C.limb] === 0, `${C.name}: 부활 뒤에도 limbs.${C.limb} = 0`);
  } else {
    const sw = C.limb === 'armS';
    if (sw) {
      say(P.armed === false && !!P.gripJoint, `${C.name}: armed false · 쥠 관절 살아 있음(칼은 아래팔과 함께)`);
      const hand = () => new THREE.Vector3(0.13, 0, 0).applyQuaternion(new THREE.Quaternion().copy(P.bodies.farmS.rotation())).add(v3(P.bodies.farmS.translation()));
      const d0 = hand().distanceTo(v3(P.sword.translation()));
      for (let i = 0; i < 120; i++) G.step();
      say(Math.abs(hand().distanceTo(v3(P.sword.translation())) - d0) < 0.03, `${C.name}: 120 프레임 뒤에도 칼이 아래팔을 따라감`, `Δ ${(hand().distanceTo(v3(P.sword.translation())) - d0).toFixed(3)} m`);
      const E = G.enemy; const pr = G.combat.pairOf(P.swordColliders[0].handle, E.bodies.chest.collider(0).handle);
      say(pr === null, `${C.name}: 잘린 팔의 칼 ↔ 상대 가슴 pairOf null(상처 없음)`);
      const pr2 = G.combat.pairOf(E.swordColliders[0].handle, P.bodies.farmS.collider(0).handle);
      say(pr2 === null, `${C.name}: 상대 칼 ↔ 떨어진 아래팔 pairOf null`);
    } else {
      say(P.gripping === false && P.limbs.armO === 0, `${C.name}: 빈손 쥠 해제`);
    }
    say(P.state === 'stand', `${C.name}: 팔 상실 뒤에도 서 있음(${P.state})`);
  }
}
// ④ 조건 미달
if (MODE !== 'off') {
  const G = round(); const P = G.player; const a = anchorOwn(P, 'farmS');
  const far = a.clone().add(new THREE.Vector3(0.5, 0, 0));
  for (const [label, patch] of [['찌르기', { type: 'stab' }], ['약함 0.99', { severity: 0.99 }], ['관절에서 멂', { local: far }], ['박힘', { stuck: true }], ['passing 아님', { passing: false }], ['pass 아님', { pass: false }]]) {
    const n0 = P.severed?.length ?? 0; P.applyWound(wound(P, 'farmS', a, patch));
    say((P.severed?.length ?? 0) === n0 && P.jointByName.farmS.joint, `조건 미달 ${label}: 절단 0`);
  }
  const n0 = P.severed?.length ?? 0; P.applyWound(wound(P, 'farmS', a, { severity: 1.0 }));
  say((P.severed?.length ?? 0) === n0 + 1, `경계 심각도 1.0: 절단 1`);
}
// ⑤ 'on' 배터리 (--mode=off 면 off 배터리)
{
  CONFIG.COMBAT.limbSever = MODE;
  const out = []; let severs = 0, nan = 0;
  for (let seed = 1; seed <= 12 * SETS; seed++) {
    seedRand(seed);
    const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7; G.ai2 = new AI(P, E, 'normal');
    let downs = 0; const prev = { P: 'stand', E: 'stand' };
    for (let i = 0; i < 30 / DT; i++) { G.step(); for (const [k, f] of [['P', P], ['E', E]]) { if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) downs++; prev[k] = f.state; } }
    const sv = [...(P.severed || []).map((s) => 'P:' + s.kind), ...(E.severed || []).map((s) => 'E:' + s.kind)];
    severs += sv.length; if (!nanFree(P) || !nanFree(E)) nan++;
    out.push({ seed, end: `${P.state}/${E.state}`, downs, sv });
  }
  const dead = out.filter((o) => o.end.includes('dead')).length;
  console.log(`'${MODE}' 배터리 ${out.length} 판: 절단 ${severs} 건(판당 ${(severs / out.length).toFixed(2)}, 판 ${out.filter((o) => o.sv.length).length}개) · dead ${dead}/${out.length} · downs/판 ${(out.reduce((s, o) => s + o.downs, 0) / out.length).toFixed(2)} · NaN 판 ${nan}`);
  console.log(out.filter((o) => o.sv.length).map((o) => `${o.seed}:${o.sv.join(',')}(${o.end})`).join('  '));
  say(nan === 0, '배터리 NaN 0');
}
console.log(fails ? `실패 ${fails}` : '모두 통과');
process.exit(fails ? 1 : 0);
