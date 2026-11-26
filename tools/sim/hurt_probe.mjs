// ─────────────────────────────────────────────────────────────
//  hurt_probe.mjs — 다친 몸 · 비탈 · 낮은 자세 장면(legs_battery.mjs 의 구멍 메우기 장면 가운데 그 묶음)의 한 판을 그대로 다시 돌리며
//   스텝마다 다리가 '바란 관절 토크 ÷ 낼 수 있는 토크'를 적는다. 재기만 한다 (물리 2.0 넷째 판 · docs/strike/physics2_notes/r4_hurt.md).
//
//   node tools/sim/hurt_probe.mjs --scene=legwound2 [--root=<나무>] [--weapon=longsword] [--variant=0 | --variants=0-7] [--rows] [--hip] [--every=12] [--from=0] [--to=99]
//
//  장면 · 흔들림(판 씨앗 100 + i · 자리 잡는 시간 2.0 + 0.11 i s · 재기 0.5 s 앞 가슴 6 N·s) · 넘어짐 규칙은 legs_battery.mjs 와 같은 식이다 (그 도구는 고치지 않는다 — 장면 줄을 여기 옮겨 적었다).
//  적는 것: 때 · 상태 · 골반의 땅 위 높이와 목표 · 다리마다 [걸음 꼴 · 무릎 굽힘 ° · 접촉 하중 N · 무릎 · 엉덩이 · 발목이 바란 토크 ÷ 한도] · 바란 수직 힘 · 무게중심 빠르기 · 캡처 점이 받침 밖으로 나간 거리 · 가슴 기울기.
//  요약: 넘어진 때 · 관절마다 한도에 닿은 스텝 몫 · 바란 토크 ÷ 한도의 평균과 최고 · 발이 미끄러진 길(딛은 발의 수평 이동 합).
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const CFG = await import(u('src/config.js'));
const opt_ = async (p) => { try { return await import(u(p)); } catch { return {}; } };
const FM = await opt_('src/fighter.js'), CM = await opt_('src/combat.js'), LK = await opt_('src/looks.js'), TG = await opt_('src/etna_ground.js'), GM = await opt_('src/gait.js');
let FAM = null;
try { FAM = (await import(u('tools/sim/corr_lib.mjs'))).FAM; } catch { /* 옛 나무 */ }
FAM ||= { diagR: { ch: [0.42, 0.42], end: [-0.4, -0.42], v: 12 }, vert: { ch: [0.02, 0.52], end: [0, -0.5], v: 12 }, horizR: { ch: [0.52, 0.03], end: [-0.52, 0.03], v: 12 } };
const DT = H.DT, LEGS = CFG.LEGS, AIDC = CFG.AID ?? null, AID_AFTER = CFG.AID?.after ?? 0;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const V3 = (x = 0, y = 0, z = 0) => new H.THREE.Vector3(x, y, z);

// ── 아래 장면 줄은 legs_battery.mjs 와 같은 식 ──
function hitChest(P, J, ang) {
  const q = P.bodies.pelvis.rotation();
  const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y);
  const l = Math.hypot(fx, fz) || 1, ax = fx / l, az = fz / l, c = Math.cos(ang), s = Math.sin(ang);
  P.bodies.chest.applyImpulse({ x: (ax * c - az * s) * J, y: 0, z: (az * c + ax * s) * J }, true);
}
const fwdOf = (P) => { const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y), l = Math.hypot(fx, fz) || 1; return { x: fx / l, z: fz / l }; };
const pelOf = (P) => P.bodies.pelvis.translation();
const hOf = (P) => { const p = P.bodies.pelvis.translation(); return p.y - (P.terrain ? P.terrain.heightAt(p.x, p.z) : 0); };
const faceAround = (ctx, ang) => { const p = ctx.P.bodies.pelvis.translation(); ctx.G.faceP = { x: p.x + 60 * Math.cos(ang), y: 1, z: p.z + 60 * Math.sin(ang) }; };
const stroke = (fam) => {
  const F = FAM[fam];
  return { pre: ({ P }) => P.handOffset.set(F.ch[0], F.ch[1]), step: (ctx) => {
    const { P, state } = ctx; state.tgt ??= F.end; state.hold ??= 0;
    const off = P.handOffset, dx = state.tgt[0] - off.x, dy = state.tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
    if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else { off.set(state.tgt[0], state.tgt[1]); state.hold += DT; if (state.hold > 0.6) { state.hold = 0; state.tgt = state.tgt === F.end ? F.ch : F.end; } }
  } };
};
class Dummy { constructor(me) { this.me = me; this.stats = {}; } update() { const m = this.me.scriptMove; this.me.move.set(m ? m[0] : 0, m ? m[1] : 0); this.me.stickX = m ? m[0] : 0; this.me.stickY = m ? m[1] : 0; } }
function terrainRound(o) {
  H.seedRandom(o.seed);
  const RAPIER = H.RAPIER, T = TG.ETNA_TERRAIN, world = new RAPIER.World({ x: 0, y: CFG.PHYSICS.gravity, z: 0 });
  world.timestep = DT; world.integrationParameters.numSolverIterations = 6;
  const eventQueue = new RAPIER.EventQueue(true), colliderInfo = new Map(), scene = new H.THREE.Scene();
  const env = TG.createTerrainGround(RAPIER, world, FM.GROUND_GROUPS, T, { radius: CFG.ARENA.radius, walls: false });
  GM.setSupportFloor(world, env.floor);
  const player = new FM.Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: o.x, z: o.z, heading: o.heading, terrain: T, look: LK.LOOKS.player, weapon: o.weapon, breakSeed: o.seed });
  const enemy = new FM.Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: 0, z: -25, heading: Math.PI, terrain: T, look: LK.LOOKS.enemy, weapon: o.weapon, breakSeed: o.seed });
  player.skill.level = 0.7;
  const combat = new CM.Combat(colliderInfo, { onWound: () => {}, onClash: () => {} });
  const G = { world, eventQueue, player, enemy, combat, t: 0, parkEnemy: true, clashes: 0, wounds: [], faceP: { x: o.x + 100 * Math.cos(o.heading), y: 1, z: o.z - 100 * Math.sin(o.heading) } };
  G.step = () => { player.foe = null; enemy.foe = null; player.faceTarget = G.faceP; enemy.faceTarget = player.bodies.pelvis.translation(); enemy.move.set(0, 0); if (G.before) G.before(G.t); player.step(DT); enemy.step(DT); player.cacheState(); enemy.cacheState(); world.step(eventQueue, combat.physicsHooks); combat.afterStep(world, eventQueue); G.t += DT; };
  G.park = () => {};
  return G;
}
const wound = (P, part, zone, severity, energy = 40, bleed = CFG.ANATOMY?.[zone]?.bleed ?? 0.015) => P.applyWound({ part, zone, type: 'cut', severity, energy, local: V3(), bleedPerSev: bleed, dir: V3(1, 0, 0) });
const hurtWalk = (apply, check, floor) => ({ secs: 8, drive: (i, t, c) => { if (i === 0) apply(c.P, c); c.P.move.set(0, t < 2 ? 0 : 1); if (i === 60) (c.state.chk ??= {}).on = !!check(c.P); }, ok: (r) => !r.fell && !!r.chk?.on && r.alongF >= floor });
const SC = {};
SC.stand = { secs: 8, drive: (i, t, c) => c.P.move.set(0, 0), ok: (r) => !r.fell && r.net < 0.3 };
SC.walk = { secs: 6, drive: (i, t, c) => c.P.move.set(0, 1), ok: (r) => !r.fell && r.alongF >= 0.6 };
SC.legwound = hurtWalk((P) => wound(P, 'thighF', 'leg', 0.5), (P) => Math.abs(P.limbs.legF - 0.65) < 0.01, 0.4);
SC.legwound9 = hurtWalk((P) => wound(P, 'thighB', 'leg', 0.9), (P) => Math.abs(P.limbs.legB - 0.37) < 0.01, 0.35);
SC.legwound2 = hurtWalk((P) => { wound(P, 'thighF', 'leg', 0.8); wound(P, 'shinB', 'leg', 0.8); }, (P) => Math.abs(P.legHealth - 0.44) < 0.01, 0.3);
SC.weakbody = hurtWalk((P) => { P.strength = 0.85; }, (P) => P.strength === 0.85, 0.6);
SC.bleedwalk = hurtWalk((P) => { P.blood = 0.55; }, (P) => P.vigor < 0.6 && P.muscle < 0.7, 0.35);
SC.gutwound = hurtWalk((P) => wound(P, 'abdomen', 'pelvis', 1.5, 30, 0), (P) => P.hunch > 0.35, 0.4);
SC.armsever = hurtWalk((P) => P.sever({ joint: 'uarmO', kind: 'shoulder', dist: 0 }, { severity: 1.1, energy: 110, bleedPerSev: CFG.ANATOMY?.arm?.bleed ?? 0.012 }), (P) => !!P.severedLimbs?.has('armO'), 0.4);
SC.kneel = { secs: 12, keepGoing: true, drive: (i, t, c) => { const s = c.state, P = c.P, K = (s.chk ??= { yMin: 9, bad: 0 }); if (i === 0) P.limbs.legF = P.limbs.legB = 0.1; P.move.set(0, 0); if (P.state === 'kneel') { s.t0 ??= t; s.extra = +((s.extra ?? 0) + DT).toFixed(4); } const ang = s.t0 != null && t > s.t0 + 2 ? 2.0 : 0; faceAround(c, ang); if (s.t0 != null && t > s.t0 + 0.5) { if (P.state !== 'kneel' || P.tiltDeg() > 60) K.bad++; K.yMin = Math.min(K.yMin, +pelOf(P).y.toFixed(3)); } const f0 = fwdOf(P), a = Math.atan2(f0.z, f0.x); s.aux = +(Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))) * 180 / Math.PI).toFixed(1); }, ok: (r) => (r.extra ?? 0) >= 5 && r.chk && r.chk.bad === 0 && r.chk.yMin >= 0.4 && (r.aux ?? 99) <= 35 };
{ const S = stroke('diagR'), O = CFG.OKORI ?? { turn: 0.35, lean: 0.05, drop: 0.03, front: 0.15 }; SC.okori = { secs: 9, pre: S.pre, drive: (i, t, c) => { const P = c.P, on = t % 1.5 < 0.6, sg = Math.floor(t / 1.5) % 2 ? -1 : 1; P.move.set(0, 0); P.okoriBody = on ? { pelvisYaw: sg * O.turn, chestYaw: sg * O.turn, pitch: O.lean, drop: O.drop } : null; P.okoriFront = on ? O.front : 0; if (on) c.state.extra = (c.state.extra ?? 0) + 1; S.step(c); }, ok: (r) => !r.fell && (r.extra ?? 0) > 0 }; }
SC.pickup = { secs: 10, opt: { low: 0.3, tilt: 100 }, pre: (c) => { c.P.humanInput = true; }, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) P.dropSword(); P.move.set(0, 0); if (!P.armed && !P.pickup && !P.autoPick && t > 0.5) { const p = pelOf(P), g = P.sword.translation(), dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz), F = P.forward(V3()), R = P.right(V3()); if (d > 1.2) P.move.set(((dx * R.x + dz * R.z) / d) * 0.6, ((dx * F.x + dz * F.z) / d) * 0.6); } if (!s.got && P.armed && P.pickupLog?.[0]?.ok) s.got = true; if (s.got && P.state === 'stand' && pelOf(P).y > 0.6) s.extra = +((s.extra ?? 0) + DT).toFixed(4); }, ok: (r) => !r.fell && (r.extra ?? 0) >= 2 };
const riseTrack = (c, t) => { const s = c.state, P = c.P; if (P.state === 'stand' && hOf(P) > 0.6) { s.up = (s.up ?? 0) + DT; if (s.up > 2 + AID_AFTER && s.extra == null) s.extra = +(t - 2 - AID_AFTER).toFixed(2); } else { if (s.extra == null && (s.up ?? 0) > 0.1) s.aux = (s.aux ?? 0) + 1; s.up = 0; } };
const roseOnce = (r) => r.extra != null && !(r.aux > 0);
const RISE = { keepGoing: true };
SC.getup = { secs: 14, keepGoing: true, drive: (i, t, c) => { c.P.move.set(0, 0); const s = c.state; if (i === 0) c.P.knockDown(true); if (c.P.state === 'stand') { s.up = (s.up ?? 0) + DT; if (s.up > 2 + AID_AFTER && s.extra == null) s.extra = +(t - 2 - AID_AFTER).toFixed(2); } else s.up = 0; }, ok: (r) => r.extra != null };
SC.getupface = { secs: 14, ...RISE, drive: (i, t, c) => { const P = c.P; if (i === 0) P.knockDown(true); faceAround(c, 2.4); P.move.set(0, P.state === 'stand' ? 0.45 : 0); riseTrack(c, t); }, ok: roseOnce };
SC.buckle = { secs: 10, ...RISE, drive: (i, t, c) => { const P = c.P, s = c.state; s.ph ??= 0.8 + 0.8 * c.R(); P.move.set(0, t < s.ph ? 1 : 0); if (!s.fired && t >= s.ph) { s.fired = true; P.buckleKneel = CFG.UNIQUE_ASSIST?.buckle?.kneel ?? null; P.knockDown(false); } if (s.fired) riseTrack(c, t); }, ok: roseOnce };
SC.revive = { secs: 14, ...RISE, opt: { round: { revive2: { count: 1 } } }, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) { P.limbs.legF = P.limbs.legB = 0.3; P.blood = 0.5; P.die('출혈'); (s.chk ??= {}).rev = !!P.revival; } P.move.set(0, 0); if (s.chk?.rev) riseTrack(c, t); }, ok: (r) => !!r.chk?.rev && roseOnce(r) };
const layDown = (E) => { E.knockDown(true); E.downTime = 1e9; };
const nearDowned = (c, ready) => { const P = c.P; if (ready(P)) { P.move.set(0, 0); return true; } P.move.set(0, P.foeDistance() > 0.9 ? 0.4 : -0.3); return false; };
{ const S = stroke('vert'); SC.finishpose = { secs: 10, opt: { duo: 1.3 }, pre: S.pre, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) layDown(c.E); P.move.set(0, 0); if (t > 1.2 && pelOf(c.E).y < 0.35 && (s.at || nearDowned(c, (p) => !!p.finish?.on))) { s.at = true; S.step(c); } if ((P.finish?.amt ?? 0) > 0.99) s.extra = (s.extra ?? 0) + 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 120 }; }
SC.finishwalk = { secs: 10, opt: { duo: (w) => ({ zweihander: 3.2 }[w] ?? 2.4) }, pre: (c) => { c.P.humanInput = true; }, drive: (i, t, c) => { const P = c.P, s = c.state; if (i === 0) layDown(c.E); P.move.set(0, 0); if (t > 2 && pelOf(c.E).y < 0.35 && !P.skill.tap && (s.extra ?? 0) < 4 && nearDowned(c, (p) => !!p.finish?.canStart) && i % 60 === 0 && P.skill.thrust() && P.skill.tap?.down) s.extra = (s.extra ?? 0) + 1; if (P.skill.tap?.walking) s.aux = (s.aux ?? 0) + 1; if ((P.finish?.amt ?? 0) > 0.99) (s.chk ??= {}).fin = 1; }, ok: (r) => !r.fell && (r.extra ?? 0) >= 1 && (r.aux ?? 0) >= 10 && !!r.chk?.fin };
const SLOPE = (v) => [{ x: v & 4 ? 1.5 : -1.5, z: 2.5, heading: Math.PI / 2 }, { x: v & 4 ? -1.5 : 1.5, z: -3, heading: -Math.PI / 2 }, { x: -3, z: v & 4 ? 1 : -1, heading: 0 }, { x: 3, z: v & 4 ? -2 : 0.5, heading: Math.PI }][v % 4];
const onSlope = (c) => { const p = pelOf(c.P), K = (c.state.chk ??= { terr: !!c.P.terrain, g0: c.P.terrain?.heightAt(p.x, p.z) ?? 0 }); K.dy = +(((c.P.terrain?.heightAt(p.x, p.z) ?? 0) - K.g0)).toFixed(2); };
const TERR = { opt: { terrain: SLOPE } };
SC.slopestand = { secs: 8, ...TERR, drive: (i, t, c) => { c.P.move.set(0, 0); onSlope(c); }, ok: (r) => !r.fell && !!r.chk?.terr && r.net < 0.3 };
SC.slopewalk = { secs: 5, ...TERR, drive: (i, t, c) => { c.P.move.set(0, 1); onSlope(c); c.state.extra = Math.abs(c.state.chk.dy); }, ok: (r) => !r.fell && !!r.chk?.terr && r.alongF >= 0.5 };
SC.slopestopgo = { secs: 16, ...TERR, drive: (i, t, c) => { const k = Math.floor(t / 2) % 4, go = t % 2 < 1.2, d = [[0, 1], [0, -1], [1, 0], [-1, 0]][k]; c.P.move.set(go ? d[0] : 0, go ? d[1] : 0); onSlope(c); }, ok: (r) => !r.fell && !!r.chk?.terr && r.path >= 3 };
SC.slopeturn = { secs: 12, ...TERR, drive: (i, t, c) => { const s = c.state; c.P.move.set(0, 0); onSlope(c); s.base ??= (() => { const f0 = fwdOf(c.P); return Math.atan2(f0.z, f0.x); })(); const k = Math.floor(t / 2), ang = s.base + (k % 2 ? 1 : 0) * (Math.PI / 2) * (k % 4 < 2 ? 1 : -1); faceAround(c, ang); if (t % 2 > 2 - 1.5 * DT) { const f0 = fwdOf(c.P), a = Math.atan2(f0.z, f0.x), e = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang))) * 180 / Math.PI; s.headErr = Math.max(s.headErr ?? 0, e); } }, ok: (r) => !r.fell && !!r.chk?.terr && r.headErr != null && r.headErr <= 30 };
SC.slopekick = { secs: 5, ...TERR, pre: (c) => { c.state.ph = c.R(); c.state.ang = c.R() * Math.PI * 2; }, drive: (i, t, c) => { c.P.move.set(0, 0); onSlope(c); if (i === Math.round((0.3 + 0.7 * c.state.ph) / DT)) hitChest(c.P, 40, c.state.ang); }, ok: (r) => !r.fell && !!r.chk?.terr };
SC.slopegetup = { secs: 14, ...RISE, ...TERR, drive: (i, t, c) => { c.P.move.set(0, 0); onSlope(c); if (i === 0) c.P.knockDown(true); riseTrack(c, t); }, ok: (r) => !!r.chk?.terr && roseOnce(r) };

// ── 한 판 (legs_battery.mjs solo 와 같은 차례) + 스텝마다 적기 ──
const f = (x, d = 2) => (x == null || !isFinite(x) ? '-' : (+x).toFixed(d));
function run(name, weapon, variant, show) {
  const S = SC[name];
  if (!S) throw new Error('장면 없음: ' + name + ' (' + Object.keys(SC).join(' ') + ')');
  const opt = { pre: S.pre, keepGoing: S.keepGoing, ...S.opt };
  const G = opt.terrain ? terrainRound({ weapon, seed: 100 + variant, ...opt.terrain(variant) }) : H.newRound({ walls: false, weapon, seed: 100 + variant, ...(opt.duo ? { AIClass: Dummy, gap: typeof opt.duo === 'function' ? opt.duo(weapon) : opt.duo } : {}), ...(opt.round || {}) });
  if (!opt.duo) G.park();
  const P = G.player, R = rng(1000 + variant * 7919);
  const settle = Math.round(((opt.settle ?? 2.0) + 0.11 * variant) / DT), nudgeAt = settle - Math.round(0.5 / DT);
  const ctx = { G, P, E: opt.duo ? G.enemy : null, R, state: {}, FAM };
  const LOW = opt.low ?? 0.5, TILT = opt.tilt ?? 60;
  if (opt.pre) opt.pre(ctx);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); if (i === nudgeAt) hitChest(P, 6, variant * 2.39996); G.step(); }
  const c0 = { ...pelOf(P) }, n = Math.round(S.secs / DT), fwd0 = fwdOf(P);
  let fell = false, tFall = null, why = '', lowFor = 0, tiltFor = 0, path = 0, cp = c0;
  const lim = LEGS?.limit, LD = P.legDrive;
  const acc = { n: 0, F: { k: 0, h: 0, a: 0, ks: 0, hs: 0, as: 0, kmax: 0, hmax: 0 }, B: { k: 0, h: 0, a: 0, ks: 0, hs: 0, as: 0, kmax: 0, hmax: 0 }, slip: 0, aidLift: 0, aidN: 0 };
  const prevFoot = {};
  const every = +(args.every ?? 12), from = +(args.from ?? 0), to = +(args.to ?? 99);
  for (let i = 0; i < n; i++) {
    S.drive(i, i * DT, ctx);
    G.step();
    const c = pelOf(P), t = i * DT;
    path += Math.hypot(c.x - cp.x, c.z - cp.z); cp = { x: c.x, y: c.y, z: c.z };
    const gy = P.terrain ? P.terrain.heightAt(c.x, c.z) : 0;
    lowFor = c.y - gy < LOW ? lowFor + DT : 0;
    const st = P.state, tl = P.tiltDeg(); tiltFor = tl > TILT ? tiltFor + DT : 0;
    // 다리마다: 바란 토크 ÷ 한도 (새 다리 나무만 — legDrive 가 없으면 건너뜀)
    const legs = {};
    if (LD && lim && st === 'stand') {
      acc.n++;
      for (const k of ['F', 'B']) {
        const L = LD.legs[k], g = P.gait?.legs?.[k], str = LD.strengthOf(k), A = acc[k];
        const kr = L.raw.k < 0 ? -L.raw.k / (lim.kneeExt * str) : L.raw.k / (lim.kneeFlex * str);
        const hr = Math.max(Math.abs(L.raw.hx) / (lim.hipAbd * str), Math.abs(L.raw.hz) / (lim.hipFlex * str), Math.abs(L.raw.hy) / (lim.hipRot * str));
        const ar = Math.max(L.raw.az > 0 ? L.raw.az / (lim.anklePlantar * str) : -L.raw.az / (lim.ankleDorsi * str), Math.abs(L.raw.ax) / (lim.ankleInv * str));
        const len = L.ph.distanceTo(L.pa), cs = Math.max(-1, Math.min(1, (L.lenT * L.lenT + L.lenS * L.lenS - len * len) / (2 * L.lenT * L.lenS))), phi = (Math.PI - Math.acos(cs)) * 180 / Math.PI;
        legs[k] = { kind: g ? (g.stance ? 'S' : g.kind) : '?', on: L.on, phi, N: g?.N ?? 0, kr, hr, ar, str, rawK: L.raw.k, hx: L.raw.hx, hy: L.raw.hy, hz: L.raw.hz };
        if (g?.stance && L.on) {
          A.k += kr; A.h += hr; A.a += ar; A.kmax = Math.max(A.kmax, kr); A.hmax = Math.max(A.hmax, hr);
          if (kr > 1) A.ks++; if (hr > 1) A.hs++; if (ar > 1) A.as++; A.cnt = (A.cnt ?? 0) + 1;
          const ft = P.bodies['foot' + k].translation(), pf = prevFoot[k];
          if (pf) acc.slip += Math.hypot(ft.x - pf.x, ft.z - pf.z);
          prevFoot[k] = { x: ft.x, z: ft.z };
        } else prevFoot[k] = null;
      }
    }
    // 선언된 밖 도움(Fighter.driveAid ⓐ ① 드는 힘)을 같은 식으로 다시 세어 본다 (읽기만 — 꿇은 · 일어서는 동안)
    if ((st === 'kneel' || st === 'getup') && AIDC && P.aidMg) {
      const pv = P.bodies.pelvis.linvel();
      const want = gy + CFG.BODY.standHeight * (1 - AIDC.kneelDrop * P.kneelAmount);
      const F = Math.max(0, Math.min(AIDC.liftMax * P.aidMg, AIDC.kLift * (want - c.y) - AIDC.dLift * pv.y));
      acc.aidLift += F / P.aidMg; acc.aidN++; acc.aidPeak = Math.max(acc.aidPeak ?? 0, F / P.aidMg);
    }
    if (show && i % every === 0 && t >= from && t <= to) {
      const cv = P.comVel, d = LD?.dbg;
      const lg = (k) => { const l = legs[k]; return l ? `${k}:${String(l.kind).padEnd(5)}${l.on ? '*' : ' '} 무릎 ${f(l.phi, 0).padStart(3)}° 하중 ${f(l.N, 0).padStart(4)} 무릎토크 ${f(l.rawK, 0).padStart(5)} ÷한도 ${f(l.kr)} 엉 ${f(l.hr)}${args.hip ? ` (벌림 ${f(l.hx, 0)} · 돌림 ${f(l.hy, 0)} · 굽힘 ${f(l.hz, 0)} N·m)` : ''} 발목 ${f(l.ar)}` : `${k}: -`; };
      console.log(`  t ${f(t).padStart(5)} ${st.padEnd(5)} 골반 ${f(c.y - gy)} 목표 ${f((P.gait?.h ?? 0) - gy)} 바란N ${f(d?.N, 0).padStart(4)} v ${f(cv ? Math.hypot(cv.x, cv.z) : 0)} 캡밖 ${f(LD?.capDist)} 기울 ${f(tl, 0).padStart(2)}° 근육 ${f(P.muscle)} | ${lg('F')} | ${lg('B')}`);
    }
    if (!fell && (st === 'down' || st === 'getup' || st === 'dead' || st === 'kneel' || lowFor > 0.25 || tiltFor > 0.25)) { fell = true; tFall = +t.toFixed(2); why = st !== 'stand' ? '상태 ' + st : lowFor > 0.25 ? '주저앉음(골반 ' + f(c.y - gy) + ')' : '가슴 기울기'; }
    if (fell && !opt.keepGoing) break;
  }
  const dx = cp.x - c0.x, dz = cp.z - c0.z;
  const r = { fell, tFall, net: Math.hypot(dx, dz), alongF: (dx * fwd0.x + dz * fwd0.z) / S.secs, path, extra: ctx.state.extra ?? null, aux: ctx.state.aux ?? null, chk: ctx.state.chk ?? null, headErr: ctx.state.headErr ?? null };
  const ok = S.ok(r);
  const sm = (k) => { const A = acc[k], c = A.cnt || 1; return `${k} 무릎 ${f(A.k / c)} (최고 ${f(A.kmax)} · 넘음 ${f(100 * A.ks / c, 0)} %) 엉덩이 ${f(A.h / c)} (최고 ${f(A.hmax)} · 넘음 ${f(100 * A.hs / c, 0)} %) 발목 ${f(A.a / c)} (넘음 ${f(100 * A.as / c, 0)} %)`; };
  console.log(`${name} · ${weapon} · #${variant}: ${ok ? '통과' : '실패'} ${fell ? `넘어짐 ${tFall} s — ${why}` : '안 넘어짐'} · 시킨 쪽 ${f(r.alongF)} m/s · 길 ${f(path, 1)} · 끝 자리 ${f(r.net)} m · 셈 ${JSON.stringify({ extra: r.extra, aux: r.aux, chk: r.chk, headErr: r.headErr })}`);
  if (LD && lim) console.log(`    바란 토크 ÷ 한도 (딛은 발 · 평균): ${sm('F')} | ${sm('B')} · 딛은 발이 끌린 길 ${f(acc.slip)} m`);
  if (acc.aidN) console.log(`    꿇은 · 일어서는 동안 드는 힘 ÷ 체중: 평균 ${f(100 * acc.aidLift / acc.aidN, 1)} % · 최고 ${f(100 * acc.aidPeak, 1)} % (${f(acc.aidN * DT, 1)} s)`);
  try { G.world.free(); } catch { /* */ }
  return { ok, r };
}
const name = String(args.scene ?? 'legwound2'), weapon = String(args.weapon ?? 'longsword');
let vs = [+(args.variant ?? 0)];
if (args.variants) { const [a, b] = String(args.variants).split('-').map(Number); vs = []; for (let v = a; v <= (b ?? a); v++) vs.push(v); }
let pass = 0;
for (const v of vs) if (run(name, weapon, v, !!args.rows).ok) pass++;
if (vs.length > 1) console.log(`${name} · ${weapon}: ${pass}/${vs.length}`);
