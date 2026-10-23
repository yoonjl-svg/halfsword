// ─────────────────────────────────────────────────────────────
//  iberian_spin_share.mjs — 싱지르 빠르기 몫(고노센 칼끝 빠르기의 %) · 몸 기울기 · 골반 이동 재기 (10/24 사장님 02:5x
//   '속도가 너무 과도하게 헛돌아. 몸이 종잇장처럼 날라다니듯 기울어. … 지금 고노센의 몇%지?' — src/iberian_spin.js · docs/strike/iberian_spin_2026-10-22.md §13)
//
//  node tools/sim/iberian_spin_share.mjs [--weapons=zweihander,flamberge,tizona] [--sides=nat,rev] [--targets=none,stand] [--gaps=2.0,2.3] [--starts=tag,ochsR,langort,wechselR,ochsL] [--walk=0.6]
//                                        [--set=share=0,upright=0,...] [--rows] [--json=파일]
//   side nat = 칼 든 쪽이 정하는 쪽(공격 입력 판 · 10/22 그대로) · rev = 그 반대(레베스 — 10/23 reverse)
//   target none = 상대를 8 m 앞에(몸꼴 · 빠르기만) · stand = 서 있는 과녁(칼 충돌 끔 · 죽지 않음 — gaps 마다)
//   --set = SECRET.ibSpin 칸을 이 도구 안에서만 바꿈 (전후 견줌 — 판 값은 그대로)
//   잰 것 (낸 때 ~ 비기 끝 + 0.6 s, 물리 스텝마다):
//    빠르기 — 칼끝 최고(대본이 도는 동안 · 낸 때 ~ 끝) · 가로지를 때 칼끝(칼을 놓은 뒤 칼 가로 각 ±15° — iberian_spin.mjs probe 와 같은 셈) · 각각 고노센 칼끝 빠르기(secret_instant.js iaiTipSpeed)의 몫
//    기울기 — 몸 기울기 = 골반 점 → 머리 점 줄이 세로에서 벗어난 각(iberian_spin_form.mjs 와 같은 셈) · 가슴 기울기 = 가슴 몸체 위 축의 세로에서 벗어난 각. 때: 돌기(대본) · 받아 멈춤(settle) · 그 뒤(따라 지나감 · 굳음 · 끝 + 0.6 s)
//    골반 — 낸 때 → 대본 끝 · 비기 끝 + 0.6 s 의 수평 자리 옮김(m) · 그동안 간 길 · 대본이 끝난 뒤 골반 수평 빠르기 최고(m/s) · 넘어짐
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { iaiTipSpeed } from '../../src/secret_instant.js';
import { G as PADS } from '../../src/ai_techniques.js';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const { SKILL, SECRET } = CONFIG;
for (const kv of list('set', '')) {
  const [k, v] = kv.split('=');
  if (!(k in SECRET.ibSpin)) throw new Error(`SECRET.ibSpin.${k}?`);
  SECRET.ibSpin[k] = Number.isFinite(+v) ? +v : v;
}
const D2 = 180 / Math.PI;
const WALK = +arg("walk", 0); // 낼 때 앞으로 다가서던 스틱 (0 = 서서 냄)
const WALK_T = 0.6; // 그 걸음 시간 (s — 낸 때 앞 0.6 s)

function run(w, start, side, target, gap) {
  const G = newRound({ seed: 7, weapon: w, weapon2: 'longsword', gap: target === 'none' ? 8 : gap, walls: false });
  const P = G.player, E = G.enemy;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  G.ai.update = () => E.move.set(0, 0);
  E.die = () => {};
  if (target !== 'guard') for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  const W = new PlayerSecretWatch(P, E, { locked: false });
  const pad = PADS[start];
  if (!pad) throw new Error(`자세 ${start}?`);
  const v0 = iaiTipSpeed(P);
  const r = { w, start, side, target, gap: target === 'none' ? null : gap, v0, fired: false, tipSpin: 0, tipAll: 0, cross: null, tilt: { spin: 0, settle: 0, after: 0 }, chestTilt: { spin: 0, settle: 0, after: 0 }, move: null, path: 0, vAfter: 0, drop: 0, y0: null, fell: false, cuts: 0, why: null, T: null };
  let t0 = null, tEnd = null, p0 = null, last = null, pFin = null, wasSpin = false, finT = null;
  const w0 = G.wounds.length;
  const _u = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    P.move.set(0, t0 == null && WALK && G.t > 2.6 - WALK_T ? WALK : 0); // --walk: 낼 때 다가서던 걸음 (iberian_spin.mjs duel 봇처럼 — 낸 뒤는 0)
    if (t0 != null) return;
    if (G.t > 1.2) P.handOffset.set(pad[0], pad[1]); // 자세를 잡고 (2.6 s 까지)
    if (G.t > 2.6) {
      const nat = P.side >= 0 ? 1 : -1;
      const ctx = { ev: 'spin', turnDir: side === 'rev' ? -nat : nat };
      r.fired = P.skill.secret({ S: W.S, ctx });
      t0 = G.t;
      const pp = P.bodies.pelvis.translation();
      p0 = { x: pp.x, z: pp.z };
      r.y0 = pp.y;
      last = { ...p0 };
      if (!r.fired) tEnd = G.t;
      else r.T = P.ibSpin?.T ?? null;
    }
  };
  const after = () => {
    if (t0 == null || !r.fired) return;
    const sec = P.skill.sec;
    const S = P.ibSpin;
    const ph = S ? (S.settle ? 'settle' : 'spin') : 'after';
    if (wasSpin && !S && pFin == null) {
      const pp = P.bodies.pelvis.translation();
      pFin = { x: pp.x - p0.x, z: pp.z - p0.z };
      finT = G.t;
      r.why = P.skill.sec?.spin?.why ?? null;
    }
    wasSpin = !!S;
    if (!sec && tEnd == null) tEnd = G.t;
    if (tEnd != null && G.t - tEnd > 0.6) return;
    const pp = P.bodies.pelvis.translation();
    const hd = P.bodies.head.translation();
    r.path += Math.hypot(pp.x - last.x, pp.z - last.z);
    last = { x: pp.x, z: pp.z };
    const tilt = Math.atan2(Math.hypot(hd.x - pp.x, hd.z - pp.z), hd.y - pp.y) * D2;
    const cr = P.bodies.chest.rotation();
    _u.set(0, 1, 0).applyQuaternion(_q.set(cr.x, cr.y, cr.z, cr.w));
    const ct = Math.acos(Math.max(-1, Math.min(1, _u.y))) * D2;
    r.tilt[ph] = Math.max(r.tilt[ph], tilt);
    r.drop = Math.max(r.drop, r.y0 - pp.y);
    r.chestTilt[ph] = Math.max(r.chestTilt[ph], ct);
    if (ph === 'after') {
      const pv = P.bodies.pelvis.linvel();
      r.vAfter = Math.max(r.vAfter, Math.hypot(pv.x, pv.z));
    }
    if (P.state !== 'stand') r.fell = true;
    if (!P.armed) return;
    const v = P.tipVel.length();
    r.tipAll = Math.max(r.tipAll, sec ? v : 0);
    if (S && !S.settle && !S.free) r.tipSpin = Math.max(r.tipSpin, v);
    if (!r.cross && sec && (!S || S.free)) {
      const tp = P.bladePoint(1), b0 = P.bladePoint(0), fw = P.forward(), rg = P.right();
      const dx = tp.x - b0.x, dz = tp.z - b0.z;
      const yaw = Math.atan2(dx * rg.x + dz * rg.z, dx * fw.x + dz * fw.z) * D2;
      if (Math.abs(yaw) < 15) r.cross = { v: +v.toFixed(1), ty: +tp.y.toFixed(2), t: +(G.t - t0).toFixed(2) };
    }
  };
  while (G.t < 9 && (tEnd == null || G.t < tEnd + 0.65)) {
    G.step();
    after();
  }
  const pp = P.bodies.pelvis.translation();
  r.move = { fin: pFin ? +Math.hypot(pFin.x, pFin.z).toFixed(2) : null, end: p0 ? +Math.hypot(pp.x - p0.x, pp.z - p0.z).toFixed(2) : null };
  r.cuts = G.wounds.slice(w0).filter((x) => x.att === P && x.vic === E && x.severity > 0).length;
  for (const k of ['tilt', 'chestTilt']) for (const p of Object.keys(r[k])) r[k][p] = Math.round(r[k][p]);
  r.path = +r.path.toFixed(2);
  r.vAfter = +r.vAfter.toFixed(2);
  r.drop = +r.drop.toFixed(2);
  r.tipSpin = +r.tipSpin.toFixed(1);
  r.tipAll = +r.tipAll.toFixed(1);
  r.v0 = +v0.toFixed(1);
  G.world.free();
  return r;
}

const WEAPONS = list('weapons', 'zweihander,flamberge,tizona');
const SIDES = list('sides', 'nat,rev');
const TARGETS = list('targets', 'none,stand');
const GAPS = list('gaps', '2.0,2.3').map(Number);
const STARTS = list('starts', 'tag,ochsR,langort,wechselR,ochsL');
const all = [];
for (const w of WEAPONS)
  for (const side of SIDES)
    for (const target of TARGETS)
      for (const gap of target === 'none' ? [null] : GAPS)
        for (const s of STARTS) {
          const r = run(w, s, side, target, gap);
          all.push(r);
          if (args.rows) console.log(JSON.stringify(r));
        }
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const max = (a) => a.reduce((s, x) => Math.max(s, x), -Infinity);
const pc = (x, v0) => `${Math.round((100 * x) / v0)} %`;
console.log(`설정: ${JSON.stringify(Object.fromEntries(Object.entries(SECRET.ibSpin).filter(([k]) => ['share', 'time', 'ramp', 'track', 'cap', 'upright', 'lean', 'advance', 'settle', 'torso', 'reverse'].includes(k))))}`);
console.log('| 무기 | 쪽 | 판 | 고노센 칼끝 m/s | 한 바퀴 s | 칼끝 최고 — 돌기 (m/s · 고노센의 %) | 칼끝 최고 — 낸 때 ~ 끝 | 가로지를 때 칼끝 평균 · 최고 (8 m 앞) | 가로지를 때 칼끝 평균 · 최고 (과녁 앞) | 몸 기울기 최고 평균 · 최대 — 돌기 · 받아 멈춤 · 그 뒤 (°) | 가슴 기울기 최대 — 돌기 · 받아 멈춤 · 그 뒤 | 골반 옮김 평균 · 최대 — 대본 끝 · 비기 끝 + 0.6 s (m) | 골반 간 길 평균 · 최대 | 그 뒤 골반 빠르기 최고 평균 · 최대 (m/s) | 골반 내려앉음 평균 · 최대 (m) | 넘어짐 | 상처 판 (과녁) |');
console.log('|' + '---|'.repeat(17));
const by = new Map();
for (const r of all.filter((x) => x.fired)) {
  const k = `${r.w}|${r.side}`;
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(r);
}
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
for (const [k, rs] of by) {
  const [w, side] = k.split('|');
  const v0 = rs[0].v0;
  const crN = rs.filter((r) => r.target === 'none' && r.cross).map((r) => r.cross.v);
  const crS = rs.filter((r) => r.target !== 'none' && r.cross).map((r) => r.cross.v);
  const tl = (p) => `${f1(mean(rs.map((r) => r.tilt[p])))} · ${max(rs.map((r) => r.tilt[p]))}`;
  const ct = (p) => max(rs.map((r) => r.chestTilt[p]));
  const tg = rs.filter((r) => r.target !== 'none');
  console.log(`| ${w} | ${side === 'rev' ? '반대' : '칼 든 쪽'} | ${rs.length} | ${f1(v0)} | ${f2(rs[0].T)} | ${f1(max(rs.map((r) => r.tipSpin)))} · ${pc(max(rs.map((r) => r.tipSpin)), v0)} | ${f1(max(rs.map((r) => r.tipAll)))} · ${pc(max(rs.map((r) => r.tipAll)), v0)} | ${crN.length ? `${f1(mean(crN))} · ${f1(max(crN))} (${pc(mean(crN), v0)} · ${pc(max(crN), v0)})` : '-'} | ${crS.length ? `${f1(mean(crS))} · ${f1(max(crS))} (${pc(mean(crS), v0)} · ${pc(max(crS), v0)})` : '-'} | ${tl('spin')} · ${tl('settle')} · ${tl('after')} | ${ct('spin')} · ${ct('settle')} · ${ct('after')} | ${f2(mean(rs.map((r) => r.move.fin ?? 0)))} · ${f2(max(rs.map((r) => r.move.fin ?? 0)))} — ${f2(mean(rs.map((r) => r.move.end)))} · ${f2(max(rs.map((r) => r.move.end)))} | ${f2(mean(rs.map((r) => r.path)))} · ${f2(max(rs.map((r) => r.path)))} | ${f2(mean(rs.map((r) => r.vAfter)))} · ${f2(max(rs.map((r) => r.vAfter)))} | ${f2(mean(rs.map((r) => r.drop)))} · ${f2(max(rs.map((r) => r.drop)))} | ${rs.filter((r) => r.fell).length} | ${tg.filter((r) => r.cuts).length} / ${tg.length} |`);
}
const nf = all.filter((x) => !x.fired).length;
if (nf) console.log(`못 냄 ${nf}`);
if (args.json) writeFileSync(args.json, JSON.stringify(all, null, 1));
