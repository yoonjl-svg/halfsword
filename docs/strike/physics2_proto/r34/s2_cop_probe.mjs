// s2_cop_probe.mjs — 제자리 뜀(hop) 여섯째 시도 S2: 뛰는 한 발 디딤의 압력 중심 자리 · 세 관절 몫(수직 · 앞뒤 · 옆으로 나눠) · 무릎 굽힘 · 옆 힘. 재기만 한다(몸에 힘 · 빠르기를 걸지 않음).
//   cd <칸> && nice -n 15 node <이 파일> --root=<칸> --weapon=longsword --variants=400-403 [--from=1.5] --out=<결과.json>
//   장면 · 자리 잡기 · 넘어짐 규칙은 s1_motor_probe.mjs(= run_scenes.mjs hop)와 같음. 창 = 켜진 뒤 --from s ~ 6 s 의 뛰는 걸음 계획이 있는 한 발 디딤 스텝.
//   몫 = legRaw(자르기 앞 · 건 값과 같은 식)의 관절 토크 ÷ LEGS.limit(근력 몫 없음 · 관문의 무릎발목 줄과 같은 분모). legRaw 가 땅 힘에 선형이라
//   수직 몫(수평 힘 0 · 다리 무게 포함) + 앞뒤 몫(발 앞 축 성분) + 옆 몫(발 옆 축 성분) = 온 몫 으로 가른다.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const CFG = await import(u('src/config.js'));
for (const [k, v] of [['cost', 0], ['legVmax', 0], ['contactMax', 0.26]]) CFG.RUN[k] = v; // hop 장면과 같은 덮어씀
const H = await import(u('tools/sim/harness_m.mjs'));
const DT = H.DT, G0 = 9.81, LIM = CFG.LEGS.limit;
const WEAPON = String(args.weapon ?? 'longsword');
const [v0, v1] = String(args.variants ?? '400-400').split('-').map(Number);
const FROM = args.from != null ? +args.from : 1.5;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (a, p) => { if (!a.length) return null; const s = Float64Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
// 몫(부호 있음): 무릎 − = 폄 → 폄 한도 · 발목 z + = 발바닥 · − = 발등 · 엉덩이 z · x 는 대칭 한도
const shareOf = (R) => ({
  knee: R.k < 0 ? -R.k / LIM.kneeExt : R.k / LIM.kneeFlex,
  ankle: R.az > 0 ? R.az / LIM.anklePlantar : R.az / LIM.ankleDorsi,
  hip: Math.abs(R.hz) / LIM.hipFlex, abd: Math.abs(R.hx) / LIM.hipAbd, inv: Math.abs(R.ax) / LIM.ankleInv,
  kRaw: R.k, aRaw: R.az, hRaw: R.hz,
});

function one(variant) {
  const G = H.newRound({ walls: false, weapon: WEAPON, seed: 100 + variant });
  G.park();
  const P = G.player, D = P.legDrive;
  const settle = Math.round((2.0 + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); }
  let M = 0; { const seen = new Set(); for (const b of [...Object.values(P.bodies), P.sword]) if (b && !seen.has(b.handle)) { seen.add(b.handle); M += b.mass(); } }
  const Mg = M * G0;
  const calls = [];
  { const orig = D.legTorques.bind(D); D.legTorques = (Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring) => { const r = orig(Lg, c, Fx, Fy, Fz, ny, grav, str, ankleOn, spring); if (ankleOn) calls.push({ Lg, c: { x: c.x, y: c.y, z: c.z }, Fx, Fy, Fz, ny, str, raw: { ...Lg.raw } }); return r; }; }
  const rows = [];
  let tOn = null, fell = false, tFall = null, low = 0, tilt = 0;
  let prevAir = false, tiltTD = null; const hopTilt = [];
  for (let i = 0; i < Math.round(10.5 / DT); i++) {
    const t = i * DT;
    P.runReach = 1; P.move.set(0, 1); P.stickX = 0; P.stickY = 1;
    calls.length = 0;
    G.step();
    if (P.run?.on && tOn == null) tOn = t;
    const pp = P.bodies.pelvis.translation(), tl = P.tiltDeg();
    low = pp.y < 0.5 ? low + DT : 0; tilt = tl > 60 ? tilt + DT : 0;
    if (!fell && (P.state !== 'stand' || low > 0.25 || tilt > 0.25)) { fell = true; tFall = t; }
    if (fell) break;
    if (tOn == null) continue;
    if (t - tOn > 6) break;
    if (t - tOn < FROM - 1e-9) continue;
    const R = P.gait?.runG, RP = R?.plan ?? null;
    if (!R) continue;
    // 한 번 뜰 때 몸통 숙임 바뀜: 뜸(디딘 발 없음)으로 들어간 때 ~ 다음 뜸 들어간 때의 숙임(골반 위 축 각) 차
    const air = !P.gait.legs.F.stance && !P.gait.legs.B.stance;
    if (air && !prevAir) { if (tiltTD != null) hopTilt.push(Math.abs(tl - tiltTD)); tiltTD = tl; }
    prevAir = air;
    const d = D.dbg;
    if (!RP || !(d.on === 1) || !(d.N > 0)) continue;
    const cl = calls.filter((c) => c.Lg.k === RP.k).pop();
    if (!cl) continue;
    const Lg = cl.Lg, saved = { ...Lg.raw };
    const hx = Lg.hx, hz = Lg.hz, lx = Lg.lx, lz = Lg.lz;
    const Ff = cl.Fx * hx + cl.Fz * hz, Fl = cl.Fx * lx + cl.Fz * lz; // 발 앞 축 · 옆 축 성분
    const tot = shareOf(cl.raw);
    D.legRaw(Lg, cl.c, 0, cl.Fy, 0, cl.ny, true, cl.str, true); const ver = shareOf(Lg.raw);
    D.legRaw(Lg, cl.c, Ff * hx, 0, Ff * hz, 0, false, cl.str, true, false); const fwd = shareOf(Lg.raw);
    D.legRaw(Lg, cl.c, Fl * lx, 0, Fl * lz, 0, false, cl.str, true, false); const lat = shareOf(Lg.raw);
    Object.assign(Lg.raw, saved);
    const com = P.com;
    const copA = (cl.c.x - Lg.pa.x) * hx + (cl.c.z - Lg.pa.z) * hz, copB = (cl.c.x - Lg.pa.x) * lx + (cl.c.z - Lg.pa.z) * lz;
    const comA = (com.x - Lg.pa.x) * hx + (com.z - Lg.pa.z) * hz, comB = (com.x - Lg.pa.x) * lx + (com.z - Lg.pa.z) * lz;
    const hipA = (Lg.ph.x - Lg.pa.x) * hx + (Lg.ph.z - Lg.pa.z) * hz, hipB = (Lg.ph.x - Lg.pa.x) * lx + (Lg.ph.z - Lg.pa.z) * lz;
    const len = Lg.ph.distanceTo(Lg.pa), cK = Math.max(-1, Math.min(1, (Lg.lenT ** 2 + Lg.lenS ** 2 - len * len) / (2 * Lg.lenT * Lg.lenS)));
    const phi = Math.PI - Math.acos(cK);
    // 무릎 경첩 축(허벅지 z)과 발 옆 축이 어긋난 각(수평면에 내린 것)
    const q = Lg.qT, kz = { x: 2 * (q.x * q.z + q.w * q.y), y: 2 * (q.y * q.z - q.w * q.x), z: 1 - 2 * (q.x * q.x + q.y * q.y) };
    const kzl = Math.hypot(kz.x, kz.z) || 1, axMis = Math.asin(Math.max(-1, Math.min(1, (kz.x * lz - kz.z * lx) / kzl))) * 180 / Math.PI;
    // 땅 힘 줄이 무릎에서 떨어진 거리(무릎 팔 · 무릎 축에 수직인 평면)
    const Fv = { x: cl.Fx, y: cl.Fy, z: cl.Fz }, rk = { x: Lg.pk.x - cl.c.x, y: Lg.pk.y - cl.c.y, z: Lg.pk.z - cl.c.z };
    const Fm = Math.hypot(Fv.x, Fv.y, Fv.z), cr = { x: rk.y * Fv.z - rk.z * Fv.y, y: rk.z * Fv.x - rk.x * Fv.z, z: rk.x * Fv.y - rk.y * Fv.x };
    const kArm = Math.abs(cr.x * kz.x + cr.y * kz.y + cr.z * kz.z) / Math.max(1e-6, Fm);
    rows.push({ s: RP.t / RP.Tc, N: cl.Fy, Ff, Fl, copA, copB, comA, comB, hipA, hipB, phi, axMis, kArm, tot, ver, fwd, lat, side: d.side ?? 0, ts: d.trunkShare ?? 1, cut: !!d.capCut, out: Math.sign(copB) });
  }
  try { G.world.free(); } catch { /* */ }
  return analyse({ variant, rows, Mg, fell, tFall: tFall != null && tOn != null ? tFall - tOn : null, hopTilt });
}

function analyse(o) {
  const { rows, Mg } = o;
  const out = { variant: o.variant, weapon: WEAPON, from: FROM, fell: o.fell, tFall: r3(o.tFall), n: rows.length };
  const mid = rows.filter((x) => x.s >= 1 / 3 && x.s <= 1);
  const m = (a, f) => r3(mean(a.map(f)));
  const p99 = (a, f) => r3(pct(a.map(f), 0.99));
  // 압력 중심 · 무게중심 · 엉덩이 자리(발목 기준 · 발 틀 · 옆은 바깥(무게중심에서 먼 쪽) + 로 맞춤 = 압력 중심 옆 부호로)
  out.copA = m(rows, (x) => x.copA); out.copAmid = m(mid, (x) => x.copA); out.comA = m(rows, (x) => x.comA);
  out.copBout = m(rows, (x) => Math.abs(x.copB)); out.comBin = m(rows, (x) => -x.comB * x.out); out.hipBin = m(rows, (x) => -x.hipB * x.out);
  out.FfBW = m(rows, (x) => x.Ff / Mg); out.absFfBW = m(rows, (x) => Math.abs(x.Ff) / Mg); out.FlInBW = m(rows, (x) => -x.Fl * x.out / Mg); out.absFlBW = m(rows, (x) => Math.abs(x.Fl) / Mg);
  out.NBW = m(rows, (x) => x.N / Mg); out.Nmax = r3(Math.max(...rows.map((x) => x.N), 0) / Mg);
  out.phi99 = r3((pct(rows.map((x) => x.phi), 0.99) ?? NaN) * 180 / Math.PI); out.kArm99 = p99(rows, (x) => x.kArm); out.axMis = m(rows, (x) => Math.abs(x.axMis));
  out.side = m(rows, (x) => Math.abs(x.side)); out.trunkShare = m(rows, (x) => x.ts); out.capCut = m(rows, (x) => (x.cut ? 1 : 0));
  // 몫 99 % — 온 · 수직 · 앞뒤 · 옆 (무릎 폄 · 발목 발바닥 + / 발등 − 따로 · 엉덩이 굽힘폄 · 벌림)
  const sh = (key) => ({
    knee: p99(rows, (x) => x[key].knee), ankleP: p99(rows, (x) => Math.max(0, x[key].ankle)), ankleD: p99(rows, (x) => Math.max(0, -x[key].ankle)), hip: p99(rows, (x) => x[key].hip), abd: p99(rows, (x) => x[key].abd),
  });
  out.sh = { tot: sh('tot'), ver: sh('ver') };
  // 앞뒤 · 옆 몫의 평균(부호 있음 · 무릎 + = 폄 더함 · 발목 + = 발바닥 쪽)
  const sg = (key) => ({ knee: m(rows, (x) => -x[key].kRaw / LIM.kneeExt), ankle: m(rows, (x) => x[key].aRaw / LIM.anklePlantar), hip: m(rows, (x) => x[key].hRaw / LIM.hipFlex) });
  out.sgn = { ver: sg('ver'), fwd: sg('fwd'), lat: sg('lat'), tot: sg('tot') };
  // 디딤 때마다(계획 s 셋으로 나눔) 압력 중심 · 무릎 · 발목 99
  out.bySeg = [[0, 1 / 3], [1 / 3, 2 / 3], [2 / 3, 1.01]].map(([a, b]) => { const r = rows.filter((x) => x.s >= a && x.s < b); return { copA: m(r, (x) => x.copA), knee: p99(r, (x) => x.tot.knee), ankleD: p99(r, (x) => Math.max(0, -x.tot.ankle)), ankleP: p99(r, (x) => Math.max(0, x.tot.ankle)), NBW: m(r, (x) => x.N / Mg) }; });
  // 가장 나쁜 2 % 스텝(관절마다 온 몫 기준)에서 몫을 무엇이 내나: 그 스텝들의 평균 s · 압력 중심 · 수직 힘 · 무릎 굽힘 · 수직 / 앞뒤 / 옆 몫(부호 = 나쁜 쪽 +)
  const worst = (sel) => { const v = rows.map(sel.tot); const th = pct(v, 0.98); const r = rows.filter((x, i) => v[i] >= th); return { n: r.length, val: m(r, sel.tot), s: m(r, (x) => x.s), copA: m(r, (x) => x.copA), NBW: m(r, (x) => x.N / Mg), FfBW: m(r, (x) => x.Ff / Mg), phi: r3(mean(r.map((x) => x.phi)) * 180 / Math.PI), ver: m(r, sel.ver), fwd: m(r, sel.fwd), lat: m(r, sel.lat) }; };
  const KN = (k) => (x) => -x[k].kRaw / LIM.kneeExt, AD = (k) => (x) => -x[k].aRaw / LIM.ankleDorsi, AP = (k) => (x) => x[k].aRaw / LIM.anklePlantar, HP = (k) => (x) => Math.abs(x.tot.hRaw) > 0 ? Math.sign(x.tot.hRaw) * x[k].hRaw / LIM.hipFlex : 0;
  out.worst = {};
  for (const [nm, f] of [['knee', KN], ['ankleD', AD], ['ankleP', AP], ['hip', HP]]) out.worst[nm] = worst({ tot: f('tot'), ver: f('ver'), fwd: f('fwd'), lat: f('lat') });
  { const dA = []; for (let i = 1; i < rows.length; i++) if (rows[i].s > rows[i - 1].s) dA.push(Math.abs(rows[i].copA - rows[i - 1].copA)); out.dCop99 = p99(dA, (x) => x); out.dCopMean = m(dA, (x) => x); } // 압력 중심이 한 스텝에 옮긴 거리(같은 디딤 안)
  out.hopTilt = r3(mean(o.hopTilt)); out.hopTiltMax = r3(o.hopTilt.length ? Math.max(...o.hopTilt) : null);
  return out;
}

const res = [];
for (let v = v0; v <= v1; v++) { const r = one(v); res.push(r); console.log(JSON.stringify(r)); }
if (args.out) writeFileSync(String(args.out), JSON.stringify(res));
