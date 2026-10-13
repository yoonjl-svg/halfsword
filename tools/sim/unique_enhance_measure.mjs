// ─────────────────────────────────────────────────────────────
//  unique_enhance_measure.mjs — 플레이어 고유 동작 '전(10/13 이어 주기) · 새(10/14 강화) · 끔' 을 같은 조건으로 잰다 (docs/strike/unique_player_2026-10-13.md '10/14 강화 방식')
//   이 트리의 src 를 그대로 돌린다. '전' 은 10/13 판 트리(예: origin/main 을 따로 꺼낸 곳)에 이 파일을 넣고 같은 인자로 돌린다 —
//   손가락 넣기는 main.js 와 같은 차례(feed → 손 목표를 쥔 동작이 없으면 손가락을 더함: 새 판 holdsHand 거짓 · 10/13 판은 running 동안 쥠).
//   변형: off = 붙이지 않음(지금 본판 테스트 경로 기본과 같음) · on = 단계 4 로 붙임 (그 트리의 판 — 전 또는 새)
//  ① 손맛 (stand): 유파마다 같은 손가락 대본(기본 긋기 13 + 앞 긋기 끝에서 곧장 반대로 반쯤 다시 긋기)을 off·on 에서 돌려
//     손가락이 닿아 있는 프레임의 손 목표(handOffset) 차이 · 칼끝(가슴 기준 몸 방향 틀) 차이를 잰다
//  ② 대결 (ai): 같은 씨앗·같은 상대(롱소드 AI normal)·같은 손가락 봇(유파 고리 긋기에 치우친 대본, 잇는 긋기·탭 찌르기 포함)으로 짧은 판(secs 초, 먼저 죽으면 끝)
//     승·패·비김 · 플레이어 칼날 맞음 가운데 칼 면(날 각 > 45° — joint_range edgeAngleOf, player_edge 와 같은 정의, 찌르기 뺌) 비율 · 발동 수
//  실행: node tools/sim/unique_enhance_measure.mjs [feel|duel|all] [--rounds=6] [--secs=30] [--schools=german,...] [--variants=off,on] [--seed0=0] [--json=<파일>]
//  src 는 읽기만 (하니스 몫: 상대 AI · 손가락 봇). 멈칫(hitStop)은 넣지 않는다 (세 변형 모두 같음)
// ─────────────────────────────────────────────────────────────
import { newRound, THREE, CONFIG, DT, seedRandom } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { PlayerUniqueAssist, PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { TECH, G as PADS } from '../../src/ai_techniques.js';
import { edgeAngleOf, EDGE_FLAT } from './joint_range.mjs';
import { rng } from './live_common.mjs';
import { writeFileSync } from 'node:fs';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const MODE = pos[0] || 'all';
const ROUNDS = +(args.rounds ?? 6);
const SECS = +(args.secs ?? 30);
const SEED0 = +(args.seed0 ?? 0); // 대결 씨앗 밀기 (다른 묶음: --seed0=1000)
const FRAME = 2 * DT;
const WEAPON = { german: 'longsword', italian: 'rapier', iberian: 'zweihander', japanese: 'uchigatana', chinese: 'qinggang' };
const SCHOOLS = args.schools ? String(args.schools).split(',') : Object.keys(WEAPON);
const UA = CONFIG.UNIQUE_ASSIST;
// 시험 손잡이 (쪼개 보기): --ua=enhance=0.5,endPower=1 (CONFIG.UNIQUE_ASSIST 덮어쓰기) · --nobody (표의 몸 꼴 뺌) · --nostep (걸음 부탁 안 함)
for (const kv of String(args.ua ?? '').split(',').filter(Boolean)) {
  const [k, v] = kv.split('=');
  UA[k] = +v;
}
if (args.nobody) for (const L of Object.values(PLAYER_UNIQUE)) for (const e of L) delete e.body, delete e.body2;
const BASE = [...TECH.map((t) => ({ name: t.name, from: t.from, path: t.path })), { name: 'langortDown', from: PADS.langort, path: [[0.02, -0.22]] }];
const out = { feel: {}, duel: {} };

/** 플레이어 붙이기·손가락 프레임 (main.js 차례) */
function rig(G, variant) {
  const P = G.player;
  P.skill.level = 0.7;
  P.skill.autoGuard = true;
  const uq = variant === 'on' ? new PlayerUniqueAssist(P, { stage: 4 }) : null;
  if (uq && args.nostep) uq.askStep = () => false;
  const R = { G, P, uq, fx: P.handOffset.x, fy: P.handOffset.y, fired: 0, steps: 0 };
  R.frame = (dx, dy, held, move = 0, tap = false) => {
    const u = P.skill.uniq;
    u?.feed(dx, dy, FRAME, false);
    const holds = u ? u.holdsHand ?? u.running : false;
    if (P.alive && !holds) {
      P.handOffset.x += dx;
      P.handOffset.y += dy;
    }
    P.handHeld = held;
    P.inputActive = Math.abs(dx) + Math.abs(dy) > 1e-5;
    if (tap && P.alive && P.state === 'stand') P.skill.thrust();
    P.move.set(0, P.alive ? move : 0);
    G.step();
    G.step();
  };
  return R;
}

/** 날 각: 칼날 방향(칼 몸 x) ↔ 칼날 70 % 지점 속도(hitPointVel)의 칼 축 수직 몫 (°, 그 속도 > 3 m/s 일 때만) */
function edgeAng(f) {
  const v = f.hitPointVel;
  if (!v || v.length() < 3) return null;
  const q = f.sword.rotation();
  const Q = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(Q);
  const e = new THREE.Vector3(1, 0, 0).applyQuaternion(Q);
  const p = v.clone().addScaledVector(ax, -v.dot(ax));
  if (p.length() < 1e-3) return null;
  return (Math.acos(Math.min(1, Math.abs(p.normalize().dot(e)))) * 180) / Math.PI;
}
// ── ① 손맛 (긋기마다 새 판 — 앞 긋기의 걸음·몸 차이가 다음 긋기로 번지지 않게) ──
function feelRun(school, variant, b) {
  seedRandom(11);
  const G = newRound({ walls: true, weapon: WEAPON[school], weapon2: 'longsword', seed: 11, gap: 2.0 });
  G.ai.update = () => G.enemy.move.set(0, 0);
  G.enemy.handOffset.set(0, 0.03);
  const R = rig(G, variant);
  const P = G.player;
  const H = [];
  const T = [];
  const A = [];
  const busy = [];
  const yawInv = new THREE.Quaternion();
  let on = false;
  const st0 = G.step;
  G.step = () => {
    st0();
    if (!on) return;
    A.push(edgeAng(P));
    busy.push(!!R.uq?.running);
  };
  const fr = (dx, dy, held) => {
    R.frame(dx, dy, held);
    if (!on) return;
    const s = P.sword.translation();
    const c = P.bodies.chest.translation();
    yawInv.copy(P.yaw).invert();
    const tip = new THREE.Vector3(s.x - c.x, s.y - c.y, s.z - c.z).applyQuaternion(yawInv);
    H.push([P.handOffset.x, P.handOffset.y]);
    T.push([tip.x, tip.y, tip.z]);
  };
  const wait = (s, held) => {
    for (let i = 0; i < s / FRAME; i++) fr(0, 0, held);
  };
  const to = (p, v) => {
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - R.fx;
      const dy = p[1] - R.fy;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, v * FRAME);
      R.fx += (dx / d) * st;
      R.fy += (dy / d) * st;
      fr((dx / d) * st, (dy / d) * st, true);
    }
  };
  wait(2.2, false);
  const sk = P.skill;
  P.handOffset.set(b.from[0], b.from[1]);
  for (const k of ['prev', 'anchor', 'aim', 'aimRaw']) sk[k].set(b.from[0], b.from[1]);
  sk.aimVel.set(0, 0);
  sk.vel.set(0, 0);
  sk.follow.set(0, 0);
  sk.cutPending = false;
  sk.recovering = false;
  R.fx = b.from[0];
  R.fy = b.from[1];
  wait(0.6, false);
  on = true; // 긋기부터 손을 뗄 때까지 (손가락이 닿은 프레임)
  for (const p of b.path) to(p, 4);
  const e = b.path[b.path.length - 1];
  to([(b.from[0] + e[0]) / 2, (b.from[1] + e[1]) / 2], 4); // 곧장 반대로 반쯤 다시 긋기 (잇는 동작의 뒷몫 자리)
  wait(0.15, true);
  return { H, T, A, busy, fired: Object.values(R.uq?.stats.fired ?? {}).reduce((x, y) => x + y, 0) };
}
if (MODE === 'feel' || MODE === 'all') {
  console.log('## ① 손맛: 같은 손가락 긋기(기본 13 + 곧장 반쯤 되긋기, 긋기마다 새 판) — 손가락이 닿은 프레임의 손 목표 차이(패드 m) · 칼끝 차이(가슴 기준 몸 방향 틀, m) — on 대 off, 발동한 긋기만');
  const T0 = { n: 0, s2: 0, mx: 0, t2: 0, tmx: 0, strokes: 0 };
  const EA = { on: [], off: [] };
  for (const school of SCHOOLS) {
    const A = { n: 0, s2: 0, mx: 0, t2: 0, tmx: 0, strokes: 0 };
    for (const b of BASE) {
      const on = feelRun(school, 'on', b);
      if (!on.fired) continue;
      const off = feelRun(school, 'off', b);
      A.strokes++;
      for (let i = 0; i < Math.min(off.H.length, on.H.length); i++) {
        const d = Math.hypot(off.H[i][0] - on.H[i][0], off.H[i][1] - on.H[i][1]);
        const dt = Math.hypot(off.T[i][0] - on.T[i][0], off.T[i][1] - on.T[i][1], off.T[i][2] - on.T[i][2]);
        A.n++;
        A.s2 += d * d;
        A.mx = Math.max(A.mx, d);
        A.t2 += dt * dt;
        A.tmx = Math.max(A.tmx, dt);
      }
      for (let i = 0; i < Math.min(off.A.length, on.A.length); i++) {
        if (!on.busy[i] || on.A[i] == null || off.A[i] == null) continue;
        EA.on.push(on.A[i]);
        EA.off.push(off.A[i]);
      }
    }
    for (const k of Object.keys(T0)) T0[k] = k.endsWith('mx') ? Math.max(T0[k], A[k]) : T0[k] + A[k];
    const r = { strokes: A.strokes, frames: A.n, handRms: Math.sqrt(A.s2 / Math.max(1, A.n)), handMax: A.mx, tipRms: Math.sqrt(A.t2 / Math.max(1, A.n)), tipMax: A.tmx };
    out.feel[school] = r;
    console.log(`${school}: 손 목표 차이 RMS ${r.handRms.toFixed(4)} · 최대 ${r.handMax.toFixed(3)} · 칼끝 차이 RMS ${r.tipRms.toFixed(3)} · 최대 ${r.tipMax.toFixed(3)} (발동 긋기 ${A.strokes}, ${A.n} 프레임)`);
  }
  const r = { strokes: T0.strokes, frames: T0.n, handRms: Math.sqrt(T0.s2 / Math.max(1, T0.n)), handMax: T0.mx, tipRms: Math.sqrt(T0.t2 / Math.max(1, T0.n)), tipMax: T0.tmx };
  out.feel.all = r;
  console.log(`합: 손 목표 차이 RMS ${r.handRms.toFixed(4)} · 최대 ${r.handMax.toFixed(3)} · 칼끝 차이 RMS ${r.tipRms.toFixed(3)} · 최대 ${r.tipMax.toFixed(3)} (발동 긋기 ${r.strokes}, ${r.frames} 프레임)`);
  const ea = (xs) => ({ n: xs.length, mean: xs.length ? +(xs.reduce((x, y) => x + y, 0) / xs.length).toFixed(2) : null, flatPct: xs.length ? +((100 * xs.filter((x) => x > EDGE_FLAT).length) / xs.length).toFixed(1) : null });
  out.feel.edge = { on: ea(EA.on), off: ea(EA.off) };
  console.log(`날 각 (on 이 고유 동작 중인 스텝 · 칼날 속도 > 3 m/s): on ${out.feel.edge.on.mean}° 칼 면 ${out.feel.edge.on.flatPct} % / 같은 스텝 off ${out.feel.edge.off.mean}° 칼 면 ${out.feel.edge.off.flatPct} % (${EA.on.length} 스텝)`);
}

// ── ② 대결 ──
const sw = { P: null, acc: null };
const strike0 = Combat.prototype.strike;
Combat.prototype.strike = function (pr, point, passing) {
  const att = pr.w.fighter;
  const vic = pr.v.fighter;
  const key = `${att.index}:${pr.v.part}`;
  const fresh = !vic.hitCooldowns.has(key);
  const Sc = att.cache?.sword;
  const r = strike0.call(this, pr, point, passing);
  const A = sw.acc;
  if (!A || att !== sw.P) return r;
  if (fresh && r && Sc && vic.hitCooldowns.has(key) && pr.w.part === 'blade' && att.weaponCfg.edged) {
    if (r.type === 'stab') {
      A.stab++;
      return r;
    }
    const ang = edgeAngleOf(Sc, r);
    if (ang == null) return r;
    A.hits++;
    if (ang > EDGE_FLAT) A.flat++;
    if (sw.P.skill.uniq?.running) {
      A.uHits++;
      if (ang > EDGE_FLAT) A.uFlat++;
    }
  }
  return r;
};
/** 손가락 봇 한 획 (rand 결정적): 유파 고리 긋기에 치우침 · 잇는 긋기 · 탭 찌르기(뒤 가로 긋기) */
function makeStroke(rand, school) {
  const trig = (PLAYER_UNIQUE[school] ?? []).flatMap((e) => e.on.map((c) => c.tech ?? (c.pad === 'langort' ? 'langortDown' : null))).filter(Boolean);
  const u = rand();
  if (u < 0.15) return { tap: true, after: rand() < 0.5 ? [rand() < 0.5 ? -0.45 : 0.45, 0.06] : null, gap: 0.3 + 0.6 * rand() };
  const name = u < 0.6 && trig.length ? trig[Math.floor(rand() * trig.length)] : BASE[Math.floor(rand() * BASE.length)].name;
  const b = BASE.find((x) => x.name === name);
  return { b, v: 3 + 4 * rand(), cont: rand() < 0.4, gap: 0.3 + 0.6 * rand(), dist: 0.9 + 0.5 * rand() };
}
function duelRound(school, variant, seed) {
  seedRandom(seed);
  const G = newRound({ walls: true, weapon: WEAPON[school], weapon2: 'longsword', seed });
  const R = rig(G, variant);
  const P = G.player;
  const E = G.enemy;
  sw.P = P;
  const rand = rng(seed * 7919 + 13);
  const legs = [];
  let t = 0;
  let winner = null;
  const wlen = P.weaponCfg.hiltLength + P.weaponCfg.bladeLength;
  let st = null;
  while (t < SECS) {
    if (!legs.length) {
      st = makeStroke(rand, school);
      if (st.tap) {
        legs.push({ wait: 0.08, held: true, tap: true }, { wait: 0.5, held: false });
        if (st.after) legs.push({ to: st.after, v: 4, held: true });
      } else {
        legs.push({ to: st.b.from, v: 1.1, held: true }, { wait: 0.08, held: true });
        for (const p of st.b.path) legs.push({ to: p, v: st.v, held: true });
        if (st.cont) {
          const e = st.b.path[st.b.path.length - 1];
          legs.push({ to: [(st.b.from[0] + e[0]) / 2, (st.b.from[1] + e[1]) / 2], v: st.v, held: true });
        }
        legs.push({ wait: 0.1, held: true });
      }
      legs.push({ wait: st.gap, held: false, approach: true });
    }
    const L = legs[0];
    let dx = 0;
    let dy = 0;
    let tap = false;
    if (L.to) {
      const ex = L.to[0] - R.fx;
      const ey = L.to[1] - R.fy;
      const d = Math.hypot(ex, ey);
      const s = Math.min(d, L.v * FRAME);
      if (d > 1e-6) {
        dx = (ex / d) * s;
        dy = (ey / d) * s;
        R.fx += dx;
        R.fy += dy;
      }
      if (d - s < 1e-6) legs.shift();
    } else {
      if (L.tap && !L.done) (tap = true), (L.done = true);
      L.wait -= FRAME;
      if (L.wait <= 0) legs.shift();
    }
    // 손가락 자리는 손 목표에서 다시 잡는다 (자세로 돌아가기가 손 목표를 옮긴 뒤 — 사람도 화면의 칼을 보고 긋는다)
    if (!L.held) {
      R.fx = P.handOffset.x;
      R.fy = P.handOffset.y;
    }
    const dist = P.foeDistance();
    const want = st?.dist ? st.dist * (0.6 + 0.4 * wlen) : 1.2;
    const move = L.approach ? (dist > want + 0.1 ? 0.9 : dist < want - 0.25 ? -0.6 : 0) : 0;
    R.frame(dx, dy, !!L.held, move, tap);
    t += FRAME;
    if (!P.alive || !E.alive) {
      winner = !P.alive && !E.alive ? 'draw' : P.alive ? 'P' : 'E';
      break;
    }
  }
  return { winner: winner ?? 'time', fired: Object.values(R.uq?.stats.fired ?? {}).reduce((a, b) => a + b, 0), chained: R.uq?.stats.ends?.chained ?? 0, t };
}
if (MODE === 'duel' || MODE === 'all') {
  console.log(`\n## ② 대결: 유파마다 ${ROUNDS} 판 × ${SECS} s (같은 씨앗) — 상대 롱소드 AI normal · 손가락 봇`);
  for (const variant of String(args.variants ?? 'off,on').split(',')) {
    const tot = { P: 0, E: 0, draw: 0, time: 0, hits: 0, flat: 0, uHits: 0, uFlat: 0, stab: 0, fired: 0, chained: 0, n: 0 };
    for (const school of SCHOOLS) {
      const acc = { P: 0, E: 0, draw: 0, time: 0, hits: 0, flat: 0, uHits: 0, uFlat: 0, stab: 0, fired: 0, chained: 0, n: 0 };
      sw.acc = acc;
      for (let r = 0; r < ROUNDS; r++) {
        const o = duelRound(school, variant, 5000 + SEED0 + r * 31 + SCHOOLS.indexOf(school) * 7);
        acc[o.winner]++;
        acc.fired += o.fired;
        acc.chained += o.chained;
        acc.n++;
      }
      sw.acc = null;
      for (const k of Object.keys(tot)) tot[k] += acc[k];
      (out.duel[variant] ??= {})[school] = acc;
      console.log(`${variant} ${school}: 승 ${acc.P} · 패 ${acc.E} · 비김 ${acc.draw + acc.time} · 칼날 맞음 ${acc.hits} · 칼 면 ${acc.hits ? ((100 * acc.flat) / acc.hits).toFixed(1) : '-'} % (강화·이어 주기 중 ${acc.uFlat}/${acc.uHits}) · 찌르기 ${acc.stab} · 발동 ${acc.fired} · 이음 ${acc.chained}`);
    }
    (out.duel[variant] ??= {}).all = tot;
    const dec = tot.P + tot.E;
    console.log(`${variant} 합: 승 ${tot.P} · 패 ${tot.E} · 비김 ${tot.draw + tot.time} / ${tot.n} 판 → 승률(가른 판) ${dec ? ((100 * tot.P) / dec).toFixed(1) : '-'} % · 칼 면 ${tot.hits ? ((100 * tot.flat) / tot.hits).toFixed(1) : '-'} % (${tot.flat}/${tot.hits}) · 발동 ${tot.fired}`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify({ cfg: { rounds: ROUNDS, secs: SECS, enhance: UA.enhance ?? null }, out }, null, 1));
