// ─────────────────────────────────────────────────────────────
//  run_probe.mjs — 뛰기 · 파고들기 · 뒤 박차기 탐침 (물리 2.0 넷째 판 · docs/strike/physics2_notes/r4_run.md). 재기만 한다.
//
//   node tools/sim/run_probe.mjs --scene=run [--root=<나무>] [--weapon=longsword] [--variant=0 | --variants=0-7] [--cfg=GAIT.legVmax:9,…] [--win=0.5] [--rows] [--every=6] [--from=0] [--to=99]
//   장면: run · runbreak · dighuman · digai · backburstai · walk · back (조종은 legs_battery.mjs 의 같은 이름 장면과 글자 그대로 같다 — 그 도구는 고치지 않는다)
//
//  묻는 것: 빠르기가 어디서 막히나. 창(--win s)마다 평균을 찍는다 —
//   시킨 빠르기(다리 구동에 넘어간 가려는 속도 · 앞 몫) · 무게중심 앞 빠르기 · 가속 한도 · 바란 수평 힘(앞 몫) ÷ 마찰 한도(μ N) · 딛은 발 수(0 · 1 · 2 인 스텝 몫) ·
//   압력 중심이 잘린 스텝 몫 · 마찰 원뿔에 잘린 스텝 몫 · 관절 한도에 닿은 스텝 몫(엉덩이 · 무릎 · 발목 — 딛은 다리 쪽이 큼) · 내딛는 발 어긋남(목표 − 발목) ·
//   디딤 수(박자) · 한 걸음 길이 · 날기(fly) 스텝 몫 · 두 발 모두 뜬 스텝 몫 · 골반 높이 · 가슴 기울기 · 뛰는 동안 건 선언된 밀기(Fighter.runAid — 있으면).
//  판마다 한 줄 요약: 넘어짐 · 골반 최고 빠르기(vTop) · 무게중심 앞 최고(vfTop) · 뒤 최고(vbTop) · 뛴 시간 · 날기 시간(flyT) · 두 발 모두 뜬 시간(airT) · 날며 디딘 걸음 수(flySteps) · 골반 빠르기가 1.9 · 2.5 · 4 · 5 m/s 를 넘은 시간(above).
//  넘어짐 규칙은 legs_battery.mjs 와 같다(상태가 stand 아님 · 골반 0.5 m 밑 0.25 s · 가슴 60° 넘게 0.25 s).
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
if (args.cfg) { const { applyCfg } = await import(u('tools/sim/cfg_override.mjs')); console.log('덮어씀(재기 전용):', JSON.stringify(applyCfg(String(args.cfg)))); }
const H = await import(u('tools/sim/harness_m.mjs'));
const DT = H.DT;
const { LEGS } = H.CONFIG;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const fwdOf = (P) => { const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y), l = Math.hypot(fx, fz) || 1; return { x: fx / l, z: fz / l }; };
const vFwd = (P) => { const v = P.bodies.pelvis.linvel(), f = fwdOf(P); return v.x * f.x + v.z * f.z; };
const pelPitch = (P) => { const q = P.bodies.pelvis.rotation(); const ux = 2 * (q.x * q.y - q.w * q.z), uz = 2 * (q.y * q.z + q.w * q.x), f = fwdOf(P); return (Math.asin(Math.max(-1, Math.min(1, ux * f.x + uz * f.z))) * 180) / Math.PI; }; // 골반 위 축이 앞으로 기운 각(°)
const stickTo = (P, x, y) => { P.move.set(x, y); P.stickX = x; P.stickY = y; };
const every = (c, t, period, t0, fn, key = 'k') => { const k = Math.floor((t - t0) / period); if (t >= t0 && k !== c.state[key]) { c.state[key] = k; fn(k); } };
// ── 아래 조종은 legs_battery.mjs 의 같은 이름 장면과 같다 ──
const SCENES = {
  walk: { secs: 6, drive: (i, t, c) => c.P.move.set(0, 1) },
  back: { secs: 6, drive: (i, t, c) => c.P.move.set(0, -1) },
  run: { secs: 9, drive: (i, t, c) => { const P = c.P, s = c.state; P.runReach = 1; stickTo(P, 0, 1); if (P.run?.on) s.extra = +((s.extra ?? 0) + DT).toFixed(4); } },
  runbreak: { secs: 9, drive: (i, t, c) => { const P = c.P, s = c.state; if (!s.broke) { P.runReach = 1; stickTo(P, 0, 1); if (P.run?.on) { s.extra = +((s.extra ?? 0) + DT).toFixed(4); if (s.extra >= 1.5) { P.runBreak = true; s.broke = t; } } } else { P.runReach = 0; stickTo(P, 0, t - s.broke < 1.5 ? -1 : 0); } } },
  dighuman: { secs: 10, settle: 3.5, pre: (c) => { c.P.humanInput = true; }, drive: (i, t, c) => { const s = c.state; c.P.move.set(0, t % 3.3 < 1.3 ? 1 : 0); s.extra = c.P.gait?.digs ?? 0; } },
  digai: { secs: 10, pre: (c) => { c.P.aiControlled = true; }, drive: (i, t, c) => { const s = c.state, g = c.P.gait; c.P.move.set(0, t % 2 > 1 ? 1 : 0.45); every(c, t, 2, 1, () => { if (g?.deDigAi?.()) s.extra = (s.extra ?? 0) + 1; }); s.digSteps = g?.digSteps ?? 0; } },
  backburstai: { secs: 10, pre: (c) => { c.P.aiControlled = true; }, drive: (i, t, c) => { const s = c.state, g = c.P.gait, v = t % 2; c.P.move.set(0, v < 1 ? 0.75 : -1); every(c, t, 2, 1, () => { if (g?.backBurstAi?.()) { s.extra = (s.extra ?? 0) + 1; s.t0 = t; } }); if (s.t0 != null && t - s.t0 <= 0.7 && vFwd(c.P) <= -0.5) { s.hit = (s.hit ?? 0) + 1; s.t0 = null; } } },
};
const scene = String(args.scene ?? 'run');
const S = SCENES[scene];
if (!S) { console.error('장면: ' + Object.keys(SCENES).join(' · ')); process.exit(1); }
const weapon = String(args.weapon ?? 'longsword');
const WIN = +(args.win ?? 0.5), EVERY = +(args.every ?? 6), FROM = +(args.from ?? 0), TO = +(args.to ?? 99);
const secs = +(args.secs ?? S.secs);
const vr = args.variants ? String(args.variants).split('-').map(Number) : [+(args.variant ?? 0), +(args.variant ?? 0)];
const f = (x, d = 2) => (x == null || Number.isNaN(x) ? '-' : (+x).toFixed(d));

function one(variant) {
  const G = H.newRound({ walls: false, weapon, seed: 100 + variant });
  G.park();
  const P = G.player;
  const ctx = { G, P, R: rng(1000 + variant * 7919), state: {} };
  const settle = Math.round(((S.settle ?? 2.0) + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  if (S.pre) S.pre(ctx);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); }
  const n = Math.round(secs / DT);
  let fell = false, tFall = null, why = '', lowFor = 0, tiltFor = 0, vTop = 0, vfTop = 0, vbTop = 0, runT = 0, flyT = 0, airT = 0, flySteps = 0;
  const above = { 1.9: 0, 2.5: 0, 4: 0, 5: 0 }; // 골반 수평 빠르기가 그 값을 넘은 시간(s)
  const M = P.totalMass + (P.armed && P.sword ? P.sword.mass() : 0), Mg = M * 9.81;
  const mkW = () => ({ n: 0, want: 0, v: 0, aLim: 0, Fx: 0, Fcap: 0, N: 0, on0: 0, on1: 0, on2: 0, clip: 0, slip: 0, fly: 0, air: 0, y: 0, tilt: 0, err: 0, errMax: 0, td: 0, strideSum: 0, strideN: 0, aid: 0, run: 0, stand: 0 });
  let W = mkW(), lastPlant = null;
  const prevSt = { F: true, B: true };
  const rows = [];
  let clip0 = 0, slip0 = 0;
  P.legDrive?.resetStats?.();
  const flush = (t) => {
    if (!W.n) return;
    const sm = P.legDrive?.summary?.() ?? {};
    const sat = (j) => f(100 * Math.max(sm[j + 'F']?.satShare ?? 0, sm[j + 'B']?.satShare ?? 0), 0);
    const k = 1 / W.n, ks = 1 / Math.max(1, W.stand);
    rows.push(`${f(t - W.n * DT, 1).padStart(5)}~${f(t, 1).padEnd(4)} ${f(W.run * k, 1)} | 시킴 ${f(W.want * ks).padStart(5)} 몸 ${f(W.v * k).padStart(5)} 가속한도 ${f(W.aLim * ks, 1).padStart(4)} | 바란 앞 힘 ${f(W.Fx * ks, 0).padStart(5)} N (마찰 한도 ${f(W.Fcap * ks, 0)}) N ${f((W.N * ks) / Mg, 2)}Mg | 발 0·1·2: ${f(100 * W.on0 * ks, 0)}·${f(100 * W.on1 * ks, 0)}·${f(100 * W.on2 * ks, 0)} % | 잘림 압력중심 ${f(100 * W.clip * ks, 0)} 마찰 ${f(100 * W.slip * ks, 0)} % | 한도 엉·무·발 ${sat('hip')}·${sat('knee')}·${sat('ankle')} % | 발 어긋남 ${f((W.err / Math.max(1, W.n)) * 100, 1)} (최고 ${f(W.errMax * 100, 1)}) cm | 디딤 ${W.td} (${f(W.td / (W.n * DT), 1)}/s) 걸음 ${f(W.strideN ? W.strideSum / W.strideN : NaN)} m | 날기 ${f(100 * W.fly * k, 0)} 공중 ${f(100 * W.air * k, 0)} % | 골반 ${f(W.y * k)} 기울기 ${f(W.tilt * k, 0)}° | 밀기 ${f(W.aid * k, 0)} N`);
    W = mkW();
    P.legDrive?.resetStats?.(); clip0 = slip0 = 0;
  };
  const per = [];
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    S.drive(i, t, ctx);
    G.step();
    const g = P.gait, D = P.legDrive ?? { rem: { x: 0, y: 0, z: 0 } }, d = D.dbg ?? { N: 0, Fx: 0, Fz: 0, on: -1, clipN: 0, slipN: 0, clipped: 0 }, it = P.legIntent, fw = fwdOf(P);
    const pv = P.bodies.pelvis.linvel(), pp = P.bodies.pelvis.translation();
    const cv = P.comVel ?? pv;
    const vh = Math.hypot(pv.x, pv.z), vf = cv.x * fw.x + cv.z * fw.z;
    vTop = Math.max(vTop, vh); vfTop = Math.max(vfTop, vf); vbTop = Math.min(vbTop, vf);
    for (const k in above) if (vh > +k) above[k] += DT;
    const stand = P.state === 'stand';
    W.n++;
    if (P.run?.on) { W.run++; runT += DT; }
    W.v += vf; W.y += pp.y; const tl = P.tiltDeg(); W.tilt += tl;
    if (g?.fly) { W.fly++; flyT += DT; }
    if (g?.flyAir) { W.air++; airT += DT; }
    W.aid += P.runAid ?? 0;
    if (stand && it) {
      W.stand++;
      W.want += it.want.x * fw.x + it.want.z * fw.z; W.aLim += it.aLim;
      W.Fx += d.Fx * fw.x + d.Fz * fw.z; W.N += d.N; W.Fcap += LEGS.mu * d.N;
      if (d.on === 0) W.on0++; else if (d.on === 1) W.on1++; else W.on2++;
      W.clip += d.clipN - clip0; W.slip += d.slipN - slip0; clip0 = d.clipN; slip0 = d.slipN;
    }
    for (const k of ['F', 'B']) {
      const l = g?.legs?.[k]; if (!l) continue;
      if (!l.stance && l.des && l.relOk) { const e = Math.hypot(l.des.x - l.ankle.x, l.des.y - l.ankle.y, l.des.z - l.ankle.z); W.err += e; W.errMax = Math.max(W.errMax, e); }
      if (l.stance && !prevSt[k]) { W.td++; if (g.fly) flySteps++; if (lastPlant) { W.strideSum += Math.abs((l.plant.x - lastPlant.x) * fw.x + (l.plant.z - lastPlant.z) * fw.z); W.strideN++; } lastPlant = { x: l.plant.x, z: l.plant.z }; }
      prevSt[k] = l.stance;
    }
    lowFor = pp.y < 0.5 ? lowFor + DT : 0; tiltFor = tl > 60 ? tiltFor + DT : 0;
    if (!fell && (!stand || lowFor > 0.25 || tiltFor > 0.25)) { fell = true; tFall = +t.toFixed(2); why = !stand ? P.state : lowFor > 0.25 ? '주저앉음' : '가슴 60°'; }
    const pit = (x, z) => -x * fw.z + z * fw.x; // 오른쪽 축(= 앞 × 위 … (−fz, 0, fx)) 둘레 몫: + = 윗몸을 뒤로 젖히는 쪽? (부호는 견줌용)
    if (args.rows && i % EVERY === 0 && t >= FROM && t <= TO) {
      const L = (k) => { const l = g.legs[k]; return l.stance ? 'S' + f(l.tLand, 2) : l.kind[0] + f(l.t / l.T, 2); };
      per.push(`${f(t, 3)} ${P.run?.on ? 'R' : '-'}${g.fly ? 'F' : '-'}${g.flyAir ? 'A' : '-'} F:${L('F')} B:${L('B')} 시킴 ${f(it ? it.want.x * fw.x + it.want.z * fw.z : 0)} 몸 ${f(vf)} 골반 ${f(pp.y)}/${f(g.h)} 기울기 ${f(tl, 0)} on${d.on} N ${f(d.N / Mg)} Fx ${f(d.Fx * fw.x + d.Fz * fw.z, 0)} 잘림 ${f(d.clipped)} rem ${f(Math.hypot(D.rem.x, D.rem.z), 0)}/${f(D.rem.y, 0)} 밀기 ${f(P.runAid ?? 0, 0)} cad ${f(1 / g.stepT, 1)} fastK ${f(g.fastK, 1)} | 숙임쪽 토크: 바람 ${f(pit(d.Mx, d.Mz), 0)} 다리반작용 ${f(D.swM ? pit(D.swM.x, D.swM.z) : 0, 0)} 팔 ${f(D.armM ? pit(D.armM.x, D.armM.z) : 0, 0)} 잘린엉덩이 ${f(D.lostHip ? pit(D.lostHip.x, D.lostHip.z) : 0, 0)} 엉덩이raw F ${f(D.legs?.F.raw.hz, 0)} B ${f(D.legs?.B.raw.hz, 0)} 무릎raw F ${f(D.legs?.F.raw.k, 0)} B ${f(D.legs?.B.raw.k, 0)} 당김 ${f(d.pull, 0)} 골반숙임 ${f(pelPitch(P), 0)}°`);
    }
    if ((i + 1) % Math.round(WIN / DT) === 0) flush((i + 1) * DT);
    if (fell && !args.keep) { flush((i + 1) * DT); break; }
  }
  flush(n * DT);
  const out = { variant, fell, tFall, why, vTop: +vTop.toFixed(2), vfTop: +vfTop.toFixed(2), vbTop: +vbTop.toFixed(2), runT: +runT.toFixed(2), flyT: +flyT.toFixed(2), airT: +airT.toFixed(2), flySteps, above: Object.fromEntries(Object.entries(above).map(([k, v]) => [k, +v.toFixed(2)])), extra: ctx.state.extra ?? null, hit: ctx.state.hit ?? null, digSteps: ctx.state.digSteps ?? null };
  try { G.world.free(); } catch { /* */ }
  return { out, rows, per };
}
console.log(`뛰기 탐침 · ${ROOT} · ${scene} · ${weapon}`);
for (let v = vr[0]; v <= vr[1]; v++) {
  const r = one(v);
  console.log(`#${v} ${JSON.stringify(r.out)}`);
  if (!args.quiet) { console.log('   때(s)      뛰는몫 | …'); for (const l of r.rows) console.log('  ' + l); }
  if (args.rows) for (const l of r.per) console.log('    ' + l);
}
