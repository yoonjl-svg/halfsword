// 무리 싸움 판단 바탕 재기 (11/18 — docs/design/team_sense_2026-11-18.md §2): 2:2 · 2:1 · 셋 따로(ffa3) AI 판의 '편 싸움 판단'이 지금 얼마나 있나.
//  재기 전용 도구 — 게임 코드는 읽기만 한다. 한 과정에서 판을 차례로 돌린다 (자식 과정 없음 — 기계를 나눠 쓰므로).
//  AI = aiAtProficiency(무기만 가진 시트 — 무명 검객 꼴, 숙련도 p) · 한 판의 넷은 같은 숙련도(판마다 --profs 를 돌아가며) · 섞인 무기(team_fights.mjs 와 같은 loadout) ·
//   겉모습 모두 같음(투구 없음) · 벽 있음 · 한 편 전멸(ffa3 = 하나 남음) 또는 maxSecs.
//  ffa3 = 셋이 저마다 따로인 판 — 게임에는 없는 판이다(Fighter 편은 0 · 1 만 · 편 전멸도 두 편). 이 도구만 몸을 세운 뒤 f.team 을 자리 번호로 바꿔 흉내 낸다
//   (셋 이상 판의 ffa 비트는 자리마다라 물리는 그대로 · sameSide 가 자기만 같은 편 → 상대 고르기 · 상대 목록이 셋 따로).
//  쓰임: node tools/sim/team_sense.mjs [판 수/모드 48] [maxSecs 90] [--modes=2v2,2v1,ffa3] [--profs=2,4,6] [--sides=6:5] [--lever=none] [--json] [--out=파일]
//   --sides=A:B  편마다 숙련도 (2:2 는 A 편을 판마다 0 편 · 1 편 번갈아 · 2:1 은 A = 혼자) — sideAWinPct (ffa3 는 쓰지 않음)
//  재는 것 (뜻은 docs/design/team_sense_2026-11-18.md §2 표 — 아래 주석과 같음):
//   표본(20 Hz — 6 스텝마다, 판이 살아 있는 동안):
//    focus      같은 편 둘(서 있음)이 같은 상대를 겨눈 몫 (상대도 둘 이상 서 있을 때 — 2:2 만 뜻이 있음)
//    coEngage   같은 편 둘이 같은 상대에게 '닿는 거리'(제 칼끝 reach + 0.5 m) 안에 함께 있는 몫 (같은 편 둘 · 그 상대 서 있음)
//    pincer     coEngage 표본에서 그 상대 자리에서 본 두 몸 사이 각 (°) — 가운데 · ≥ 90° 몫 · ≥ 135° 몫
//    backExp    서 있는 몸 표본 가운데 2.5 m 안에 서 있는 적이 등 뒤(바라보는 쪽에서 120° 넘게)에 있는 몫
//    outnum     서 있는 적 둘 이상이 4 m 안에 있는 몸 표본: 둘 다 앞(±60°) 몫 · 두 적 사이 각 가운데 · ≤ 45°(한 줄) 몫 · ≥ 120°(집게) 몫
//    blocked    내 상대와 나 사이에 같은 편 몸이 있는 몫 (같은 편이 나보다 상대에 가깝지 않고 · 나 → 상대 선분에서 0.5 m 안)
//    ambushOpp  기습 기회: 내 편이 아닌 다른 몸과 붙은(그 몸을 겨눔 · 제 닿는 거리 안) 적이 4 m 안 · 그 적의 앞(±60°) 밖에 내가 있는 표본 —
//               그 동안 내가 그 적을 겨눈 몫(uptake) · 그 적에게 닿는 거리 안인 몫(close)
//   사건:
//    hits       다른 편 산 몸에 난 상처 — unattended(맞은 몸이 친 몸을 겨누지 않음) · busy(맞은 몸이 다른 몸과 붙어 있음 = 기습) · blind(busy 이고 친 몸이 맞은 몸 앞 ±60° 밖) · onDown(맞은 몸이 서 있지 않음)
//    attacks    AI 공격 시작(꼴이 attack 으로) — coAtk(같은 편이 0.6 s 안에 같은 상대에게 공격을 시작했거나 공격 중) · intoBusy(그 상대가 다른 몸과 붙어 있음)
//    switches   상대 바꿈 / 산 분 · 까닭(gone 죽음 · attacked 나를 침 · held 더 나은 상대가 1.2 s)
//    help       같은 편이 쓰러짐(서 있지 않음 — 산 채) 또는 피 0.75 밑으로: 3 s 안에 서 있던 동료가 그 몸을 친(겨눈) 적을 겨눔 · 그 적의 닿는 거리 안에 듦 · 쓰러진 몸이 다시 베임
//    mate       같은 편 상처 (산 몸) / 판 · 심각도 0.5 넘음 · 그 칼에 죽음
//   상처 = 심각도 HIT_SEV(0.05) 넘는 것만 (닿기만 한 심각도 0 은 뺌 — team_fights.mjs 의 '상처'는 이것까지 셈)
//    pairOneWaits 같은 편 둘이 같은 상대를 겨눴는데 하나만 닿는 거리 (다른 하나는 뒤에서 기다림) 몫 — coEngage 와 같은 바탕
import { RAPIER, THREE, CONFIG, AI, newMatch, DT } from './jelly_harness.mjs';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { Combat } from '../../src/combat.js';
import { setSupportFloor } from '../../src/gait.js';
import { createMatch, stepMatch, orderControllers, pairFoe } from '../../src/match.js';
import { targetable, reachOf } from '../../src/targeting.js';
import { aiAtProficiency } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const flag = (k, d) => { const a = args.find((x) => x === `--${k}` || x.startsWith(`--${k}=`)); return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true; };
const N = +(pos[0] ?? 48);
const MAX = +(pos[1] ?? 90);
const MODES = String(flag('modes', '2v2,2v1,ffa3')).split(',');
const PROFS = String(flag('profs', '2,4,6')).split(',').map(Number);
const LEVER_OFF = flag('lever', '') === 'none'; // --lever=none: 숙련도 레버(TEAM_FIGHT.lever 줄 세우기 · 피하기)를 끈 판 (재기 전용 — 까닭 가르기)
if (LEVER_OFF) for (const v of Object.values(CONFIG.TEAM_FIGHT.lever)) if (v && typeof v === 'object' && 'on' in v) v.on = false;
const SIDES = flag('sides', null) ? String(flag('sides')).split(':').map(Number) : null; // --sides=6:5 — 편마다 숙련도 (A:B · 판마다 A 편을 0 편 · 1 편으로 번갈아 — 자리 쏠림 없게). 2:1 은 A = 혼자(자리 1) 고정
const WEAPONS = ['longsword', 'zweihander', 'rapier', 'sabre', 'uchigatana', 'estoc'];
const loadout = (seed, count) => Array.from({ length: count }, (_, i) => WEAPONS[(seed * 7 + i * 5) % WEAPONS.length]);
const SAMPLE = 6; // 6 스텝 = 20 Hz
const HIT_SEV = 0.05; // 상처로 세는 심각도 (그 밑 = 닿기만 한 것 — 같은 편끼리 부딪힘이 대부분)
const deg = (r) => (r * 180) / Math.PI;

// ── 셋 따로 판 (ffa3) — newMatch 와 같은 세계 · 세모 자리 · 편을 자리 번호로 (재기 전용) ──
function newFfa(count, { seed, weapons, aiOf }) {
  const { PHYSICS, ARENA } = CONFIG;
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = PHYSICS.timestep;
  world.integrationParameters.numSolverIterations = 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const floor = world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  setSupportFloor(world, floor);
  const nw = 32;
  const R = ARENA.radius + 0.25;
  for (let i = 0; i < nw; i++) {
    const a = (i / nw) * Math.PI * 2;
    const half = R * Math.tan(Math.PI / nw) + 0.05;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a);
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.2, 0.6, half).setTranslation(Math.cos(a) * R, 0.6, Math.sin(a) * R).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }).setCollisionGroups(GROUND_GROUPS), ground);
  }
  const scene = new THREE.Scene();
  const r = ARENA.startGap / (2 * Math.sin(Math.PI / count)); // 이웃 사이 = startGap
  const fighters = [];
  for (let i = 0; i < count; i++) {
    const a = Math.PI + (2 * Math.PI * i) / count; // 자리 0 = −x (1:1 의 자리 0 과 같은 쪽)
    fighters.push(new Fighter(RAPIER, world, scene, colliderInfo, { index: i, team: i % 2, name: `F${i}`, x: r * Math.cos(a), z: r * Math.sin(a), heading: Math.PI - a, look: LOOKS.enemy, breakSeed: seed, weapon: weapons[i], ffa: true }));
  }
  for (const f of fighters) f.team = f.index; // 셋 따로 (재기 전용 — 물리 비트는 ffa 자리마다라 그대로)
  const M0 = { fighters };
  const order = orderControllers(fighters.map((f) => ({ me: f }))).map((c) => c.me.index);
  const ais = [];
  for (const i of order) { const a = aiOf(i); ais[i] = new AI(fighters[i], pairFoe(fighters[i], M0), a.level, a.persona); }
  const combat = new Combat(colliderInfo, { onWound: () => {}, onClash: () => {} });
  const G = createMatch({ world, eventQueue, combat, fighters, controllers: order.map((i) => ais[i]) });
  Object.assign(G, { ais });
  const hooks = { afterControl: () => G.before?.(G.t) };
  G.step = () => stepMatch(G, DT, hooks);
  return G;
}

const chest = (f) => f.bodies.chest.translation();
const hd = (a, b) => { const p = chest(a), q = chest(b); return Math.hypot(q.x - p.x, q.z - p.z); };
/** a 의 바라보는 쪽에서 b 까지 각 (rad, 0 ~ π) */
const offFacing = (a, b) => {
  const p = chest(a), q = chest(b), F = a.forward(new THREE.Vector3());
  const x = q.x - p.x, z = q.z - p.z, d = Math.hypot(x, z) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (x * F.x + z * F.z) / d)));
};
/** o 자리에서 본 a · b 사이 각 (rad) */
const angAt = (o, a, b) => {
  const c = chest(o), p = chest(a), q = chest(b);
  const ax = p.x - c.x, az = p.z - c.z, bx = q.x - c.x, bz = q.z - c.z;
  return Math.acos(Math.max(-1, Math.min(1, (ax * bx + az * bz) / ((Math.hypot(ax, az) * Math.hypot(bx, bz)) || 1))));
};
const standing = (f) => f.alive && !f.revival && f.state === 'stand';
const engaged = (a, x) => hd(a, x) <= reachOf(a) + 0.5; // 닿는 거리
const isAtk = (f) => !!f.aiCtl && (f.aiCtl.mode === 'attack' || !!f.aiCtl.secretRun);
/** x 가 a 아닌 다른 몸과 붙어 있나 (그 몸을 겨눔 · 서로 닿는 거리) */
const busyWithOther = (x, a) => !!x.foe && x.foe !== a && targetable(x.foe) && engaged(x, x.foe);

function fight(mode, seed, prof, sideA = null) {
  let s = seed * 9301 + 49297;
  Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const count = mode === '2v1' || mode === 'ffa3' ? 3 : 4;
  const weapons = loadout(seed, count);
  const profOf = (i) => (sideA == null ? prof : (i % 2 === sideA ? SIDES[0] : SIDES[1])); // --sides: 자리 홀짝 = 편
  const aiOf = (i) => aiAtProficiency({ ai: { persona: {} }, weapon: weapons[i] }, profOf(i));
  const G = mode === 'ffa3' ? newFfa(count, { seed, weapons, aiOf }) : newMatch({ count, ai: 'all', seed, walls: true, weapons, looks: Array(count).fill(LOOKS.enemy), aiOf });
  const F = G.fighters;
  const mates = (f) => F.filter((g) => g !== f && g.team === f.team);
  const foes = (f) => F.filter((g) => g.team !== f.team);
  const C = { samples: 0, pairS: 0, focus: 0, coS: 0, co: 0, solo: 0, pincer: [], fS: 0, back: 0, outS: 0, outFront: 0, outSep: [], blockS: 0, blocked: 0, oppS: 0, oppUp: 0, oppClose: 0,
    hits: 0, unatt: 0, busy: 0, blind: 0, onDown: 0, atk: 0, coAtk: 0, intoBusy: 0, mate: 0, mateSevere: 0, mateKill: 0, helpEv: 0, helpSwitch: 0, helpClose: 0, helpHitAgain: 0, downEv: 0, aliveMin: 0 };
  const wasAlive = new Map();
  const lastAtk = new Map(); // 싸움꾼 → { t, foe } 마지막 공격 시작
  const prevMode = new Map();
  const prevStand = new Map(F.map((f) => [f, true]));
  const prevBlood = new Map(F.map((f) => [f, f.blood]));
  const watches = []; // 동료 돕기 창 { b(다친 몸), x(그 적), mates, until, sw:Set, close:Set, hitAgain, down }
  G.combat.hooks.onWound = (att, vic, r) => {
    if (!wasAlive.get(vic) || att === vic || (r?.severity ?? 0) < HIT_SEV) return; // 심각도 0 의 닿음(몸 · 칼 부딪힘)은 빼고 상처만
    if (att.team === vic.team) { C.mate++; if ((r?.severity ?? 0) >= 0.5) C.mateSevere++; if (!vic.alive) C.mateKill++; return; }
    C.hits++;
    if (vic.state !== 'stand') C.onDown++;
    if (vic.foe !== att) C.unatt++;
    if (vic.state === 'stand' && busyWithOther(vic, att)) { C.busy++; if (offFacing(vic, att) > Math.PI / 3) C.blind++; }
    for (const w of watches) if (w.b === vic && G.t <= w.until) w.hitAgain = true;
  };
  G.before = () => { for (const f of F) wasAlive.set(f, f.alive); };
  const n = Math.round(MAX / DT);
  const live = () => (mode === 'ffa3' ? F.filter((f) => f.alive).length > 1 : !G.over);
  let i = 0;
  for (; i < n && live(); i++) {
    G.step();
    for (const f of F) if (f.alive) C.aliveMin += DT / 60;
    // 사건: AI 공격 시작
    for (const f of F) {
      const m = f.aiCtl?.mode;
      const was = prevMode.get(f);
      prevMode.set(f, m);
      if (!f.alive || m !== 'attack' || was === 'attack' || !f.foe) continue;
      C.atk++;
      const x = f.foe;
      if (mates(f).some((g) => g.alive && g.foe === x && (isAtk(g) || (lastAtk.get(g)?.foe === x && G.t - lastAtk.get(g).t <= 0.6)))) C.coAtk++;
      if (busyWithOther(x, f)) C.intoBusy++;
      lastAtk.set(f, { t: G.t, foe: x });
    }
    // 사건: 동료가 쓰러짐 · 피 0.75 밑으로
    for (const b of F) {
      const st = standing(b), was = prevStand.get(b);
      const down = was && !st && b.alive && !b.revival;
      const hurt = prevBlood.get(b) >= 0.75 && b.blood < 0.75 && b.alive;
      prevStand.set(b, st);
      prevBlood.set(b, b.blood);
      if (!(down || hurt)) continue;
      const ms = mates(b).filter(standing);
      if (!ms.length) continue;
      const fx = foes(b).filter(standing);
      const x = fx.filter((g) => g.foe === b).sort((p, q) => hd(p, b) - hd(q, b))[0] ?? fx.sort((p, q) => hd(p, b) - hd(q, b))[0];
      if (!x) continue;
      watches.push({ b, x, ms, until: G.t + 3, sw: new Set(), close: new Set(), hitAgain: false, down });
      if (down) C.downEv++;
    }
    for (const w of watches) {
      if (G.t > w.until || w.done) continue;
      for (const a of w.ms) if (a.alive) { if (a.foe === w.x) w.sw.add(a); if (engaged(a, w.x)) w.close.add(a); }
    }
    for (const w of watches) if (!w.done && G.t > w.until) {
      w.done = true;
      C.helpEv += w.ms.length;
      C.helpSwitch += w.sw.size;
      C.helpClose += w.close.size;
      if (w.down && w.hitAgain) C.helpHitAgain++;
    }
    if (i % SAMPLE) continue;
    C.samples++;
    // 표본
    for (const a of F) {
      if (!standing(a)) continue;
      const fs = foes(a).filter(standing);
      if (!fs.length) continue;
      C.fS++;
      if (fs.some((x) => hd(a, x) <= 2.5 && offFacing(a, x) > (2 * Math.PI) / 3)) C.back++;
      const near = fs.filter((x) => hd(a, x) <= 4).sort((p, q) => hd(a, p) - hd(a, q));
      if (near.length >= 2) {
        C.outS++;
        if (offFacing(a, near[0]) <= Math.PI / 3 && offFacing(a, near[1]) <= Math.PI / 3) C.outFront++;
        C.outSep.push(deg(angAt(a, near[0], near[1])));
      }
      const x = a.foe;
      const ms = mates(a).filter(standing);
      if (x && standing(x) && ms.length) {
        C.blockS++;
        const p = chest(a), q = chest(x), dx = q.x - p.x, dz = q.z - p.z, L = Math.hypot(dx, dz) || 1;
        if (ms.some((b) => { const c = chest(b); const t = ((c.x - p.x) * dx + (c.z - p.z) * dz) / L; const perp = Math.abs((c.x - p.x) * dz - (c.z - p.z) * dx) / L; return t > 0 && t < L && perp < 0.5; })) C.blocked++;
      }
      // 기습 기회 (다른 몸과 붙은 적 · 4 m 안 · 그 적 앞 ±60° 밖)
      for (const y of fs) {
        if (hd(a, y) > 4 || !busyWithOther(y, a) || offFacing(y, a) <= Math.PI / 3) continue;
        C.oppS++;
        if (a.foe === y) C.oppUp++;
        if (engaged(a, y)) C.oppClose++;
        break;
      }
    }
    // 같은 편 둘
    for (const t of new Set(F.map((f) => f.team))) {
      const pair = F.filter((f) => f.team === t && standing(f));
      if (pair.length < 2) continue;
      const [a, b] = pair;
      const fs = foes(a).filter(standing);
      if (!fs.length) continue;
      if (fs.length >= 2) { C.pairS++; if (a.foe === b.foe) C.focus++; }
      C.coS++;
      const x = fs.find((y) => engaged(a, y) && engaged(b, y));
      if (x) { C.co++; C.pincer.push(deg(angAt(x, a, b))); }
      else if (fs.some((y) => (engaged(a, y) && b.foe === y) || (engaged(b, y) && a.foe === y))) C.solo++; // 둘이 같은 상대를 겨눴는데 하나만 닿는 거리 — 다른 하나는 뒤에서 기다림
    }
  }
  for (const w of watches) if (!w.done) { w.done = true; C.helpEv += w.ms.length; C.helpSwitch += w.sw.size; C.helpClose += w.close.size; if (w.down && w.hitAgain) C.helpHitAgain++; }
  const sw = { n: 0, gone: 0, attacked: 0, held: 0 };
  for (const f of F) { const st = G.targeting?.get(f); if (!st) continue; sw.n += st.switches; for (const k of ['gone', 'attacked', 'held']) sw[k] += st.why[k]; }
  const alive = F.filter((f) => f.alive);
  const winner = mode === 'ffa3' ? (alive.length === 1 ? alive[0].index : null) : G.winner;
  return { mode, seed, prof, sideA, aWon: sideA == null ? null : winner === sideA, t: +G.t.toFixed(2), over: mode === 'ffa3' ? alive.length <= 1 : G.over, winner, sw, ...C };
}

const rows = [];
const t0 = Date.now();
for (const mode of MODES) for (let k = 0; k < N; k++) {
  const prof = SIDES ? -1 : PROFS[k % PROFS.length];
  const sideA = SIDES ? (mode === '2v1' ? 1 : k % 2) : null;
  const r = fight(mode, k + 1, prof, sideA);
  rows.push(r);
  process.stderr.write(`${mode} #${k + 1} p${prof} ${r.t}s (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? +(b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2).toFixed(1) : null; };
function summary(R, label) {
  const S = (k) => R.reduce((s, r) => s + r[k], 0);
  const cat = (k) => R.flatMap((r) => r[k]);
  const am = S('aliveMin');
  const pin = cat('pincer'), sep = cat('outSep');
  return {
    label, fights: R.length, medianSec: med(R.map((r) => r.t)), unfinished: R.filter((r) => !r.over).length,
    focusPct: pct(S('focus'), S('pairS')), coEngagePct: pct(S('co'), S('coS')), pairOneWaitsPct: pct(S('solo'), S('coS')),
    pincerMedDeg: med(pin), pincerGe90Pct: pct(pin.filter((x) => x >= 90).length, pin.length), pincerGe135Pct: pct(pin.filter((x) => x >= 135).length, pin.length),
    backExposedPct: pct(S('back'), S('fS')),
    outnumberedSamplesPct: pct(S('outS'), S('fS')), outBothFrontPct: pct(S('outFront'), S('outS')), outSepMedDeg: med(sep), outSepLe45Pct: pct(sep.filter((x) => x <= 45).length, sep.length), outSepGe120Pct: pct(sep.filter((x) => x >= 120).length, sep.length),
    blockedByMatePct: pct(S('blocked'), S('blockS')),
    ambushOppPct: pct(S('oppS'), S('fS')), ambushUptakePct: pct(S('oppUp'), S('oppS')), ambushClosePct: pct(S('oppClose'), S('oppS')),
    hitsPerAliveMin: +(S('hits') / Math.max(1e-9, am)).toFixed(2), hitUnattendedPct: pct(S('unatt'), S('hits')), hitBusyPct: pct(S('busy'), S('hits')), hitBlindBusyPct: pct(S('blind'), S('hits')), hitOnDownPct: pct(S('onDown'), S('hits')),
    attacksPerAliveMin: +(S('atk') / Math.max(1e-9, am)).toFixed(2), coAttackPct: pct(S('coAtk'), S('atk')), attackIntoBusyPct: pct(S('intoBusy'), S('atk')),
    switchesPerAliveMin: +(R.reduce((s, r) => s + r.sw.n, 0) / Math.max(1e-9, am)).toFixed(2), switchWhy: ['gone', 'attacked', 'held'].map((k) => `${k} ${R.reduce((s, r) => s + r.sw[k], 0)}`).join(' · '),
    helpEvents: S('helpEv'), helpSwitchPct: pct(S('helpSwitch'), S('helpEv')), helpClosePct: pct(S('helpClose'), S('helpEv')), downEvents: S('downEv'), downedHitAgainPct: pct(S('helpHitAgain'), S('downEv')),
    mateWoundsPerFight: +(S('mate') / Math.max(1, R.length)).toFixed(2), mateSevere: S('mateSevere'), mateKills: S('mateKill'),
    ...(SIDES ? { sideAWinPct: pct(R.filter((r) => r.aWon).length, R.length), sideA: SIDES[0], sideB: SIDES[1] } : {}),
    wins: (() => { const w = {}; for (const r of R) w[r.winner ?? 'none'] = (w[r.winner ?? 'none'] ?? 0) + 1; return w; })(),
  };
}
const out = [];
for (const mode of MODES) {
  const R = rows.filter((r) => r.mode === mode);
  out.push(summary(R, SIDES ? `${mode} ${SIDES.join(' vs ')}` : `${mode} all`));
  if (!SIDES) for (const p of PROFS) out.push(summary(R.filter((r) => r.prof === p), `${mode} p${p}`));
}
console.log(`무리 싸움 판단 바탕 — 모드마다 ${N} 판 · 최대 ${MAX} s · ${SIDES ? `편 숙련 ${SIDES.join(' 대 ')}` : `숙련도 ${PROFS.join('/')} 돌아가며`}${LEVER_OFF ? ' · 숙련도 레버 끔' : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const o of out) console.log(JSON.stringify(o));
if (flag('json', false)) for (const r of rows) console.log(JSON.stringify({ ...r, pincer: undefined, outSep: undefined }));
const OUT = flag('out', null);
if (OUT) writeFileSync(OUT, JSON.stringify({ N, MAX, MODES, PROFS, summary: out, rows: rows.map((r) => ({ ...r, pincer: undefined, outSep: undefined })) }, null, 1));
