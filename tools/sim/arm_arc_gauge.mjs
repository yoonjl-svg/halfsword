// 팔 호 계측 (R2′ 팔 단계, 10/8 사장님 "팔의 호가 머리를 싣게"): 대본 베기(chain_ledger script 장면과 같은 손 목표 경로, corr_lib FAM)에서
//  칼이 얻는 운동 에너지가 어디서 오나 — 손목 겨눔 토크(driveSword 가 칼에 직접 주는 τ·ω) / 손이 칼자루를 끌어 주는 몫(어깨·팔꿈치·몸통이
//  손을 움직인 일 = 나머지) / 중력.  dKE/dt = P_손목 + P_손 + P_중력 (상대 없음·접촉 없음). 획 창 = 손 목표가 움직이기 시작 → 칼끝 최고 속도.
//  손목 포화 = 창 안에서 |τ| ≥ 0.98·상한 인 스텝 비율. 결정적(고정 박자).
//  실행: node tools/sim/arm_arc_gauge.mjs [--weapons=longsword,morgenstern,zweihander] [--fams=diagR,vert,horizR] [--strokes=6] [--cap=22] [--stiff=60] [--json]
import { newRound } from './harness_m.mjs';
import { DT, THREE } from './jelly_harness.mjs';
import { FAM } from './corr_lib.mjs';
import { getWeapon } from '../../src/weapons.js';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const weapons = String(args.weapons ?? 'longsword,morgenstern,zweihander').split(',');
const fams = String(args.fams ?? 'diagR,vert,horizR').split(',');
const STROKES = +(args.strokes ?? 6);
const CAP = args.cap != null ? +args.cap : null; // --cap=N : 시험할 무기들의 손목 토크 상한(weapons.js controlOverrides.maxAimTorque)을 이번 실행에만 바꾼다 (config WEAPON.maxAimTorque 는 무기표가 덮으므로 with_config 로는 안 바뀐다)
const STIFF = args.stiff != null ? +args.stiff : null; // --stiff=N : aimStiffness 도 같은 식
class Passive { update() {} }
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const G_ACC = 9.81;
const _q = new THREE.Quaternion(), _f = new THREE.Quaternion(), _w = new THREE.Vector3();
function swordKE(sw) {
  const m = sw.mass(); const v = sw.linvel(); const w = sw.angvel(); const I = sw.principalInertia(); const f = sw.principalInertiaLocalFrame(); const r = sw.rotation();
  _q.set(r.x, r.y, r.z, r.w).multiply(_f.set(f.x, f.y, f.z, f.w)).invert();
  _w.set(w.x, w.y, w.z).applyQuaternion(_q);
  return 0.5 * m * (v.x * v.x + v.y * v.y + v.z * v.z) + 0.5 * (I.x * _w.x * _w.x + I.y * _w.y * _w.y + I.z * _w.z * _w.z);
}
const out = [];
for (const weapon of weapons) {
  const rows = [];
  if (CAP != null) getWeapon(weapon).controlOverrides.maxAimTorque = CAP;
  if (STIFF != null) getWeapon(weapon).controlOverrides.aimStiffness = STIFF;
  for (const fam of fams) {
    const F = FAM[fam];
    const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed: 7, AIClass: Passive }); const P = G.player;
    G.park(); P.skill.level = 0.7;
    P.handOffset.set(F.ch[0], F.ch[1]);
    for (let i = 0; i < Math.round(1.5 / DT); i++) { P.move.set(0, 0); G.step(); }
    let tgt = F.end;
    for (let k = 0; k < STROKES; k++) {
      const from = [P.handOffset.x, P.handOffset.y];
      const dist = Math.hypot(tgt[0] - from[0], tgt[1] - from[1]);
      const n = Math.round((dist / F.v + 0.6) / DT);
      const sw = P.sword; const m = sw.mass();
      const ke0 = swordKE(sw);
      let Ew = 0, Eg = 0, sat = 0, steps = 0, tipMax = 0, iMax = 0, keMax = ke0, EwMax = 0, EgMax = 0, satMax = 0, tauMax = 0, capAt = 0;
      for (let i = 0; i < n; i++) {
        const off = P.handOffset;
        const dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
        if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(tgt[0], tgt[1]);
        P.move.set(0, 0);
        G.step();
        const w = sw.angvel(); const v = sw.linvel();
        const tau = P.debug.wristTorque; const cap = P.debug.wristCap || 0;
        Ew += (tau.x * w.x + tau.y * w.y + tau.z * w.z) * DT;
        Eg += -m * G_ACC * v.y * DT;
        steps++; if (cap > 0 && tau.length() >= 0.98 * cap) sat++;
        tauMax = Math.max(tauMax, tau.length()); capAt = cap;
        const tip = P.tipVel.length();
        if (tip > tipMax) { tipMax = tip; iMax = i; keMax = swordKE(sw); EwMax = Ew; EgMax = Eg; satMax = sat / steps; }
      }
      const Et = keMax - ke0; const Eh = Et - EwMax - EgMax;
      rows.push({ weapon, fam, k, dir: tgt === F.end ? 'fwd' : 'back', tipMax: +tipMax.toFixed(2), tAcc: +((iMax + 1) * DT).toFixed(3), Et: +Et.toFixed(1), Ew: +EwMax.toFixed(1), Eh: +Eh.toFixed(1), Eg: +EgMax.toFixed(1), sat: +satMax.toFixed(2), tauMax: +tauMax.toFixed(1), cap: +capAt.toFixed(1) });
      tgt = tgt === F.end ? F.ch : F.end;
    }
  }
  const sh = (r, k) => (r.Et > 1 ? r[k] / r.Et : NaN);
  const S = { weapon, n: rows.length, tipMax: med(rows.map((r) => r.tipMax)), tAcc: med(rows.map((r) => r.tAcc)), Et: med(rows.map((r) => r.Et)), wrist: med(rows.map((r) => sh(r, 'Ew'))), hand: med(rows.map((r) => sh(r, 'Eh'))), grav: med(rows.map((r) => sh(r, 'Eg'))), sat: med(rows.map((r) => r.sat)), tauMax: med(rows.map((r) => r.tauMax)), cap: med(rows.map((r) => r.cap)) };
  out.push({ summary: S, rows });
  console.log(`${weapon.padEnd(12)} 획 ${S.n}: 칼끝 최고 중앙 ${S.tipMax.toFixed(1)} m/s · 가속 ${(S.tAcc * 1000).toFixed(0)} ms · 얻은 KE ${S.Et.toFixed(0)} J · 몫 손목 ${(S.wrist * 100).toFixed(0)} % / 손(팔 호) ${(S.hand * 100).toFixed(0)} % / 중력 ${(S.grav * 100).toFixed(0)} % · 손목 포화 ${(S.sat * 100).toFixed(0)} % 스텝 · |τ| 최고 ${S.tauMax.toFixed(1)} / 상한 ${S.cap.toFixed(1)} N·m`);
  if (args.json) console.log(JSON.stringify(rows));
}
