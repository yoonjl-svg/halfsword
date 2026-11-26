// ─────────────────────────────────────────────────────────────
//  catch_probe.mjs — 받아 딛기 탐침 (물리 2.0 넷째 판 · 버팀 묶음 · docs/strike/physics2_notes/r4_balance.md). 재기만 한다 — 몸에는 묶음과 같은 시험 충격만 건다.
//
//   node tools/sim/catch_probe.mjs [--root=<나무>] [--scene=kick80|kick40|walkkick|kick2] [--weapon=rapier] [--variants=100-123] [--cfg=GAIT.catchT:0.3,…] [--steps] [--rows=<흔듦 번호>] [--from=-0.05] [--to=1.2]
//
//  왜: legs_battery.mjs 의 밀림 장면(kick40 · kick80 · walkkick · kick2)은 통과 수만 준다. 이 탐침은 같은 판(판 씨앗 100 + i · 자리 잡기 2.0 + 0.11 i s · 0.5 s 앞 가슴 6 N·s · 같은 난수)을
//   그대로 다시 돌려 판마다 '치는 쪽(몸 앞 기준 °) · 넘어짐과 까닭 · 받아 딛기 수 · 무게중심 빠르기 최고'를 한 줄로, --steps 면 걸음마다
//   '뗀 때 · 발 · 걸음 꼴 · 정한 시간 → 실제로 뜬 시간 · 디딜 때 캡처 점에 못 미친 거리(밀리는 쪽 몫) · 디딘 뒤 0.1 s 동안 발이 미끄러진 거리 · 디딜 때 빠르기'를 찍는다.
//   --rows=<번호> 는 그 판의 스텝마다 값(친 때 기준 from ~ to s).
//  넘어짐 규칙은 묶음과 같다(상태가 바뀜 · 골반 0.5 m 밑 0.25 s · 가슴 60° 0.25 s). 까닭은 게임 규칙(fighter.js updateState)의 어느 줄이 넘겼는지로 가른다.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
if (args.cfg) { const { applyCfg } = await import(u('tools/sim/cfg_override.mjs')); console.log('덮어씀(재기 전용):', JSON.stringify(applyCfg(String(args.cfg)))); }
const H = await import(u('tools/sim/harness_m.mjs'));
const { BALANCE, BODY } = H.CONFIG;
const DT = H.DT;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
  return { x: ax * c - az * s, z: az * c + ax * s };
}
// 장면: 친 스텝 번호 · 세기 · 조종 (legs_battery.mjs 의 같은 이름 장면과 같은 식)
const SC = {
  kick40: { secs: 5, J: 40, at: (ph) => [Math.round((0.3 + 0.7 * ph) / DT)], mv: [0, 0] },
  kick80: { secs: 5, J: 80, at: (ph) => [Math.round((0.3 + 0.7 * ph) / DT)], mv: [0, 0] },
  walkkick: { secs: 6, J: 40, at: (ph) => [Math.round((1.5 + 1.0 * ph) / DT)], mv: [0, 1] },
  kick2: { secs: 5, J: 40, at: (ph) => { const a = Math.round((0.3 + 0.7 * ph) / DT); return [a, a + Math.round(0.4 / DT)]; }, mv: [0, 0] },
};
const scene = String(args.scene ?? 'kick80'), S = SC[scene];
if (!S) throw new Error('장면: ' + Object.keys(SC).join(' | '));
const weapon = String(args.weapon ?? 'rapier');
const [v0, v1] = String(args.variants ?? '100-123').split('-').map(Number);
const ROWS = args.rows != null ? +args.rows : null, FROM = +(args.from ?? -0.05), TO = +(args.to ?? 1.2);
const f2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(d));

function run(variant) {
  const G = H.newRound({ walls: false, weapon, seed: 100 + variant });
  G.park();
  const P = G.player, g = P.gait;
  const R = rng(1000 + variant * 7919);
  const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  const ph = R(), ang = R() * Math.PI * 2;
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); }
  const hits = S.at(ph), n = Math.round(S.secs / DT);
  let fell = false, tFall = null, why = '', lowFor = 0, tiltFor = 0, vMax = 0, dir = null, tHit = null;
  const steps = [], open = {}, prev = { F: true, B: true };
  const rows = [];
  for (let i = 0; i < n; i++) {
    P.move.set(S.mv[0], S.mv[1]);
    if (hits.includes(i)) { const d = hitChest(P, S.J, ang); if (!dir) { dir = d; tHit = i * DT; } }
    // 넘어지기 바로 앞 스텝의 규칙 값 (updateState 가 이 스텝에 넘길 까닭)
    const pre = { off: P.offBalanceTime, bal: P.balance, sit: P.sitTime ?? 0 };
    G.step();
    const t = i * DT, c = P.com, cv = P.comVel, w0 = P.legDrive?.w0 || P.capW || 3;
    if (tHit != null && c && cv) {
      const sp = Math.hypot(cv.x, cv.z);
      if (!fell) vMax = Math.max(vMax, sp);
      const cpx = c.x + cv.x / w0, cpz = c.z + cv.z / w0;
      for (const k of ['F', 'B']) {
        const l = g.legs[k];
        if (prev[k] && !l.stance) open[k] = { k, kind: l.kind, t0: t - tHit, T: l.T, v0: sp };
        else if (!prev[k] && l.stance && open[k]) {
          const o = open[k]; open[k] = null;
          o.dur = t - tHit - o.t0;
          // 못 미친 거리: (캡처 점 − 새 발바닥 가운데) 의 밀리는 쪽 몫 (+ = 발이 캡처 점에 못 미침)
          o.miss = (cpx - l.pinC.x) * dir.x + (cpz - l.pinC.z) * dir.z;
          o.side = -(cpx - l.pinC.x) * dir.z + (cpz - l.pinC.z) * dir.x;
          o.v1 = sp; o.px = l.pinC.x; o.pz = l.pinC.z; o.at = i; o.slip = 0; o.leg = l;
          o.goal = Math.hypot(l.p1.x - l.plant.x, l.p1.z - l.plant.z); // 디딘 자리가 정한 자리에서 벗어난 거리
          steps.push(o);
        }
        prev[k] = l.stance;
      }
      for (const o of steps) if (i - o.at > 0 && i - o.at <= Math.round(0.1 / DT) && o.leg.stance) { const a = P.bodies[o.leg.foot].translation(); o.slip = Math.max(o.slip, Math.hypot(a.x - o.fx0, a.z - o.fz0) || 0); } else if (i === o.at) { const a = P.bodies[o.leg.foot].translation(); o.fx0 = a.x; o.fz0 = a.z; }
      if (ROWS === variant && t - tHit >= FROM && t - tHit <= TO) {
        const d = P.legDrive.dbg, L = g.legs, sw = !L.F.stance ? L.F : !L.B.stance ? L.B : null;
        const al = (x, z) => x * dir.x + z * dir.z;
        rows.push(`${f2(t - tHit, 3).padStart(6)} ${L.F.stance ? 'S' : L.F.kind[0] + f2(L.F.t / L.F.T, 2)}`.padEnd(13) + `${L.B.stance ? 'S' : L.B.kind[0] + f2(L.B.t / L.B.T, 2)}`.padEnd(7)
          + ` v ${f2(al(cv.x, cv.z))} cp ${f2(al(cpx - c.x, cpz - c.z))} out ${f2(P.legDrive.capDist)} off ${f2(P.offBalance)}/${f2(P.offBalanceTime)} pel ${f2(P.bodies.pelvis.translation().y)} tilt ${f2(P.tiltDeg(), 0)}`
          + ` | F ${f2(al(L.F.ankle.x - c.x, L.F.ankle.z - c.z))} N${f2(L.F.N, 0)} B ${f2(al(L.B.ankle.x - c.x, L.B.ankle.z - c.z))} N${f2(L.B.N, 0)}`
          + (sw ? ` | 목표 ${f2(al(sw.p1.x - c.x, sw.p1.z - c.z))} 길 ${f2(al(sw.des.x - c.x, sw.des.z - c.z))} 발목 ${f2(al(sw.ankle.x - c.x, sw.ankle.z - c.z))} y ${f2(sw.soleY, 3)} 힘 ${f2(d.pull, 0)}` : '')
          + ` | on ${d.on} N ${f2(d.N, 0)} F ${f2(al(d.Fx, d.Fz), 0)} 잘림 ${f2(d.clipped)}`);
      }
    }
    const y = P.bodies.pelvis.translation().y;
    lowFor = y < 0.5 ? lowFor + DT : 0;
    tiltFor = P.tiltDeg() > 60 ? tiltFor + DT : 0;
    const st = P.state;
    if (!fell && (st !== 'stand' || lowFor > 0.25 || tiltFor > 0.25)) {
      fell = true; tFall = t - (tHit ?? 0);
      why = st === 'stand' ? (lowFor > 0.25 ? '주저앉음(상태는 서 있음)' : '가슴 60°') : pre.off + DT > BALANCE.fallDelay ? '발 밖으로 달아남' : pre.bal <= 0 ? '균형 값 0' : pre.sit + DT > (BALANCE.sitDelay ?? Infinity) ? '주저앉음(규칙)' : `가슴 기울기 ${BODY.fallTiltDeg}°`;
      if (ROWS !== variant) break;
    }
  }
  try { G.world.free(); } catch { /* */ }
  return { variant, deg: ((ang * 180) / Math.PI) % 360, fell, tFall, why, vMax, steps, rows };
}

console.log(`받아 딛기 탐침 · ${ROOT} · ${scene} · ${weapon} · 흔듦 ${v0} ~ ${v1}`);
let ok = 0, nAll = 0;
for (let v = v0; v <= v1; v++) {
  const r = run(v); nAll++; if (!r.fell) ok++;
  const cs = r.steps.filter((s) => s.kind === 'catch').length;
  console.log(`  #${String(v).padStart(3)} 치는 쪽 ${f2(r.deg, 0).padStart(3)}° ${r.fell ? `넘어짐 ${f2(r.tFall)} s 뒤 (${r.why})` : '버팀'.padEnd(8)} · 걸음 ${r.steps.length} (받아 딛기 ${cs}) · 빠르기 최고 ${f2(r.vMax)} m/s`);
  if (args.steps || ROWS === v) for (const s of r.steps) console.log(`        ${f2(s.t0).padStart(5)} s ${s.k} ${s.kind.padEnd(6)} 정한 ${f2(s.T)} → 뜬 ${f2(s.dur)} s · 못 미침 ${f2(s.miss).padStart(5)} (옆 ${f2(s.side).padStart(5)}) m · 정한 자리와 ${f2(s.goal)} m · 미끄러짐 ${f2(s.slip)} m · 빠르기 ${f2(s.v0)} → ${f2(s.v1)} m/s`);
  if (ROWS === v) for (const l of r.rows) console.log('      ' + l);
}
console.log(`  버팀 ${ok}/${nAll}`);
