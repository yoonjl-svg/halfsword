// ─────────────────────────────────────────────────────────────
//  getup_trace.mjs — 일어서기 한 판의 때 차례 (물리 2.0 넷째 판 · 버팀 묶음). 재기만 한다.
//
//   node tools/sim/getup_trace.mjs [--root=<나무>] [--weapon=rapier] [--variant=100] [--every=0.1] [--secs=14] [--cfg=AID.after:1.5,…]
//
//  legs_battery.mjs 의 getup 장면과 같은 판(판 씨앗 100 + i · 자리 잡기 2.0 + 0.11 i s · 0.5 s 앞 가슴 6 N·s · 재기 첫 스텝에 knockDown(true))을 다시 돌려
//   every 초마다 '때 · 상태 · 상태 시간 · 골반 높이 · 다리의 높이 목표 · 가슴 기울기 · 주저앉음 시계 · 이 스텝에 driveAid 가 건 드는 힘 ÷ 체중 · 기울기 토크 · yaw 토크'를 찍는다.
//  끝 줄: 선 상태로 넘어간 때들 · 다시 넘어간 때와 까닭 · 선 뒤 AID.after 창의 드는 힘 평균 ÷ 체중.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
if (args.cfg) { const { applyCfg } = await import(u('tools/sim/cfg_override.mjs')); console.log('덮어씀(재기 전용):', JSON.stringify(applyCfg(String(args.cfg)))); }
const H = await import(u('tools/sim/harness_m.mjs'));
const { AID, BALANCE, BODY } = H.CONFIG;
const DT = H.DT;
const weapon = String(args.weapon ?? 'rapier'), variant = +(args.variant ?? 100), EVERY = +(args.every ?? 0.1), SECS = +(args.secs ?? 14);
const f2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(d));
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const G = H.newRound({ walls: false, weapon, seed: 100 + variant });
G.park();
const P = G.player;
const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); }
// driveAid 가 건 힘 · 토크 받아 적기 (aid_ledger.mjs 와 같은 자리)
const pel = P.bodies.pelvis, oT = pel.addTorque, oF = pel.addForce, oD = P.driveAid;
let inside = false, T = { x: 0, y: 0, z: 0 }, F = 0;
pel.addTorque = function (t, w) { if (inside) { T.x += t.x; T.y += t.y; T.z += t.z; } return oT.call(this, t, w); };
pel.addForce = function (v, w) { if (inside) F += v.y; return oF.call(this, v, w); };
P.driveAid = function () { inside = true; T = { x: 0, y: 0, z: 0 }; F = 0; try { return oD.call(this); } finally { inside = false; } };
let mg = 0; { const seen = new Set(); for (const b of Object.values(P.bodies)) if (b && !seen.has(b.handle)) { seen.add(b.handle); mg += b.mass(); } mg *= 9.81; }
const n = Math.round(SECS / DT), ev = Math.max(1, Math.round(EVERY / DT));
let prev = P.state; const events = []; let aftN = 0, aftLift = 0, aftPk = 0;
console.log(`일어서기 자취 · ${ROOT} · ${weapon} · 흔듦 ${variant} · AID.after ${AID.after} s`);
for (let i = 0; i < n; i++) {
  P.move.set(0, 0);
  if (i === 0) P.knockDown(true);
  const pre = { off: P.offBalanceTime, bal: P.balance, sit: P.sitTime ?? 0, tilt: P.tiltDeg() };
  G.step();
  const t = i * DT, st = P.state, y = pel.translation().y;
  if (st === 'stand' && P.stateTime < AID.after) { aftN++; aftLift += F / mg; aftPk = Math.max(aftPk, F / mg); }
  if (st !== prev) {
    const why = prev === 'stand' ? (pre.off + DT > BALANCE.fallDelay ? '발 밖으로 달아남' : pre.bal <= 0 ? '균형 값 0' : pre.sit + DT > (BALANCE.sitDelay ?? Infinity) ? '주저앉음(규칙)' : `가슴 기울기(${f2(pre.tilt, 0)}° · 문턱 ${BODY.fallTiltDeg}°)`) : '';
    events.push(`${f2(t)} s ${prev} → ${st}${why ? ' (' + why + ')' : ''} · 골반 ${f2(y)} m`);
    prev = st;
  }
  if (i % ev === 0) console.log(`  ${f2(t).padStart(6)} ${st.padEnd(6)} ${f2(P.stateTime).padStart(5)} · 골반 ${f2(y)} · 다리 목표 ${f2(P.legIntent?.h)} · 기울기 ${f2(P.tiltDeg(), 0).padStart(3)}° · 주저앉음 ${f2(P.sitTime ?? 0)} · 드는 힘 ${f2((100 * F) / mg, 0).padStart(3)} % · 기울기 토크 ${f2(Math.hypot(T.x, T.z), 0).padStart(4)} · yaw ${f2(T.y, 0).padStart(4)} N·m`);
}
for (const e of events) console.log('  ' + e);
console.log(`  선 뒤 AID.after 창: 드는 힘 평균 체중의 ${f2((100 * aftLift) / Math.max(1, aftN), 1)} % · 최고 ${f2(100 * aftPk, 1)} % (${aftN} 스텝)`);
