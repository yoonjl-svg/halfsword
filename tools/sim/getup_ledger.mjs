// 일어서는 동안 몸 밖에서 받는 힘을 구간(누움 · 일어섬 · 선 뒤)마다 장부로 잰다. 재기만.
//   node tools/sim/getup_ledger.mjs [--root=<나무>] [--weapons=longsword,rapier,zweihander] [--n=4] [--mode=knock|kick] [--kick=150]
//   받침 · 걷기 밀기 · 닻(옛 판의 숨은 힘)과 선언된 밖 도움(config AID — honesty.mjs 갈래 aid)을 따로 찍는다.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? new URL('../..', import.meta.url).pathname));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const Hn = await import(u('tools/sim/honesty.mjs'));
const DT = H.DT, N = +(args.n ?? 4), MODE = String(args.mode ?? 'knock'), KICK = +(args.kick ?? 150);
const WEAPONS = String(args.weapons ?? 'longsword,rapier,zweihander').split(',');
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const snap = (L) => { const S = L.summary(); return { T: S.T, sup: S.cats.support?.Fy ?? 0, push: S.cats.push?.Fimp ?? 0, aT: S.anchorTiltNms ?? 0, aY: S.anchorYawNms ?? 0, lift: S.cats.aid?.Fy ?? 0, aidT: (S.aid?.torqueRate ?? 0) * S.T, pkN: S.aid?.peakN ?? 0, pkNm: S.aid?.peakNm ?? 0, Mg: S.Mg ?? null, gN: S.check.groundNShare, supportShare: S.supportShare }; };
function run(weapon, v) {
  const G = H.newRound({ walls: false, weapon, seed: 100 + v });
  G.park();
  const P = G.player;
  const settle = Math.round((2.0 + 0.11 * v) / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); G.step(); }
  const named = []; const seen = new Set();
  for (const [n, b] of [...Object.entries(P.bodies), ['sword', P.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); named.push([n, b]); }
  let mass = 0; for (const [, b] of named) mass += b.mass();
  if (MODE === 'knock') P.knockDown(true); else hitChest(P, KICK, [0, Math.PI, Math.PI / 2, -Math.PI / 2][v % 4]);
  P.move.set(0, 0); G.step();
  const L = Hn.attach(G.world, named, { fighter: P });
  Hn.hook(G, [L]);
  const ph = {}, pk = { N: 0, Nm: 0 }; let cur = P.state, last = snap(L), fellAt = cur !== 'stand' ? 0 : null, stoodAt = null, up = 0, minPel = 9, t = 0;
  const close = (name, now) => { const d = { T: now.T - last.T, sup: now.sup - last.sup, push: now.push - last.push, aT: now.aT - last.aT, aY: now.aY - last.aY, lift: now.lift - last.lift, aidT: now.aidT - last.aidT }; pk.N = Math.max(pk.N, now.pkN); pk.Nm = Math.max(pk.Nm, now.pkNm); const o = (ph[name] ||= { T: 0, sup: 0, push: 0, aT: 0, aY: 0, lift: 0, aidT: 0 }); for (const k of Object.keys(d)) o[k] += d[k]; last = now; };
  const n = Math.round(14 / DT);
  for (let i = 0; i < n; i++) {
    P.move.set(0, 0); G.step(); t = (i + 1) * DT;
    minPel = Math.min(minPel, P.bodies.pelvis.translation().y);
    if (P.state !== cur) { close(cur, snap(L)); cur = P.state; }
    if (P.state !== 'stand') { up = 0; if (fellAt == null) fellAt = t; } else if (fellAt != null) { up += DT; if (up >= 2 && stoodAt == null) { stoodAt = t - 2; break; } }
  }
  close(cur, snap(L));
  try { G.world.free(); } catch { /* */ }
  return { fellAt, stoodAt, minPel, ph, pk, Mg: mass * 9.81 };
}
for (const w of WEAPONS) {
  const rs = []; for (let v = 0; v < N; v++) rs.push(run(w, v));
  const stood = rs.filter((r) => r.stoodAt != null);
  const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
  console.log(`${w} · ${MODE}${MODE === 'kick' ? ' ' + KICK : ''} · 일어섬 ${stood.length}/${N} · 걸린 시간 가운데값 ${med(stood.map((r) => r.stoodAt - (r.fellAt ?? 0)))?.toFixed(2)} s · 골반 가장 낮은 높이 가운데값 ${med(rs.map((r) => r.minPel)).toFixed(2)} m`);
  console.log(`   선언된 도움 스텝 최고: 드는 힘 ${Math.max(...rs.map((r) => r.pk.N)).toFixed(0)} N (체중 ${(rs[0].Mg).toFixed(0)} N) · 세우는 토크 ${Math.max(...rs.map((r) => r.pk.Nm)).toFixed(0)} N·m`);
  for (const name of ['down', 'getup', 'kneel', 'stand']) {
    const xs = rs.map((r) => r.ph[name] ? { ...r.ph[name], Mg: r.Mg } : null).filter(Boolean); if (!xs.length) continue;
    const T = xs.reduce((s, x) => s + x.T, 0);
    const lift = xs.reduce((s, x) => s + x.lift / x.Mg, 0) / T, aidT = xs.reduce((s, x) => s + x.aidT, 0) / T; const sup = xs.reduce((s, x) => s + x.sup / x.Mg, 0) / T, push = xs.reduce((s, x) => s + x.push, 0) / T, aT = xs.reduce((s, x) => s + x.aT, 0) / T, aY = xs.reduce((s, x) => s + x.aY, 0) / T;
    console.log(`   ${name.padEnd(6)} 평균 ${(T / xs.length).toFixed(2)} s · 받침 ÷ 체중 ${(100 * sup).toFixed(1)} % · 밀기 ${push.toFixed(0)} N · 닻 기울기 ${aT.toFixed(1)} N·m · 닻 yaw ${aY.toFixed(1)} N·m · 선언된 도움: 드는 힘 ÷ 체중 ${(100 * lift).toFixed(1)} % · 세우는 토크 ${aidT.toFixed(1)} N·m`);
  }
}
