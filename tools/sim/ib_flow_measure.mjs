// ─────────────────────────────────────────────────────────────
//  ib_flow_measure.mjs — 이베리아 B5 '흐르는 긋기'(config IB_FLOW · fighter.js updateIbFlow) 가 사람 손에 쓸모 있나 (사장님 10/27 '흐르는 긋기는 플레이어에게 유용한가?')
//   재기만 한다 — 게임 값은 건드리지 않는다. 0 번 자리 사람 몸(츠바이핸더 · 플람베르주)을 손가락 봇이 긋는다(ib_feel · schielhau_strike playerFight 와 같은 입력 길:
//   60 Hz 프레임마다 handOffset 이동 · handHeld · inputActive · 숙련 0.7 · corr · corrTip · autoGuard). 스킬트리 = 이베리아 칸 모두 익힘(kitFromNodes) —
//   on = 그대로 · off = 같은 몫에서 ibFlow 만 끔(kitOff 가 B5 를 꺼진 칸으로 읽음). 같은 씨앗 · 같은 손가락 대본.
//   pair  = 허공 두 칼 (상대는 6 m 밖에 선 몸): 감기(1.2 패드 m/s — 휘두르기 문턱 1.5 아래) → 1 s 쉼 → 칼 1 A→B → 쉼 PAUSE → 칼 2 B→C → 손가락을 C 에 댄 채 1.5 s.
//           칼 2 를 잰다: 흐름 켜짐 · 칼끝 최고(m/s — 칼날 끝 점 velocityAtPoint) · 칼 1 손가락 멈춤 → 칼 2 칼끝 최고까지(이어 오기 s) ·
//           지나침(손가락이 C 에 멈춘 뒤 칼 축이 마지막 자리를 휘두른 쪽으로 넘어간 가장 큰 각 ° — ib_feel 과 같은 정의 · cm = 칼끝 점이 마지막 칼끝 자리에서 휘두른 쪽으로 가장 멀리 간 거리) ·
//           멈춤(손가락 멈춤 → 칼끝 < 1.5 m/s 0.1 s) · 쉼 0 은 칼 1 이 아직 날아가는 중이라 지나침 · 최고가 칼 1 몫과 섞인다(묶을 땐 0.1 ~ 0.5 를 씀)
//   손가락 빠르기 꼴: --ease=mj(기본 — 최소 저크: 천천히 떠서 가운데서 가장 빠르고 천천히 멈춤 · 사람 손) | lin(고른 빠르기 — 옛 봇들). 느린 감기(< 1.5)는 늘 lin
//           길(세 점): zwerch 가로 왕복 · diag 오른 위 → 왼 아래 → 오른 위 · oberUnter 정수리 → 아래 → 오른 위 · 쉼 0 ~ 0.5 s(창 안) · 0.8 · 1.2 s(창 밖 — 효과 없어야 함)
//   chain = 이어 긋기 연습 30 s: 상대 still(서 있는 몸 · 칼 아래) · walk(칼을 아래에 둔 채 걷기만 하는 AI) · 맞는 쪽 상처 끔(판정은 재고 몸엔 안 검 — 칼마다 같은 몸).
//           봇: 한 벌 = 느리게 첫 자리로(1.2 패드 m/s) → 0.3 s → 3 ~ 5 칼(다음 자리는 지금 자리에서 0.6 패드 m 넘게 떨어진 자세 점 · 빠르기 3.5 ~ 6 패드 m/s · 칼 사이 쉼 0 ~ 0.5 s, 손가락 댄 채)
//           → 손 떼고 1.0 ~ 1.6 s. 걸음 = 그 무기 간격 띠(weapon_measured.js). 고유 공격 강화는 main.js 처럼 익힌 칸 모두(PlayerUniqueAssist names).
//           칼마다: 흐름 켜짐(긋는 동안 + 멈춘 뒤 0.3 s 안 ibFlowOn) · 칼끝 최고 · 이어 오기(앞 칼 손가락 멈춤 → 이 칼 칼끝 최고) · 첫 몸 맞음 칼끝 빠르기 · 판정 에너지 · 심각도
//   fight = 사람 싸움 (playerFight 꼴): 손가락 봇 대 치고 막는 AI(숙련 PROF · OPPS) · 30 s · 칠 때 15 % 탭 찌르기 · 나머지 1 ~ 3 칼 이어 긋기(쉼 0 ~ 0.4 s) ·
//           상대 칼이 가까이서 빠르면 반응 지연 뒤 0.6 ~ 1.0 s 막기 단추(PlayerParryGuard). 승 · 패 · 무 · 준 / 받은 칼날 상처 심각도 합 · 흐름 켜진 칼 몫
//           감기는 playerFight 처럼 1.6 패드 m/s(휘두르기 문턱 위) · 4 프레임 쉼 뒤 긋기 — 사람이 빨리 감고 곧장 긋는 꼴(감기도 '앞 휘두르기'로 읽힌다)
//  견줌 시험(이 실행 안에서만 — src 값은 그대로): --brake=0.8(IB_FLOW.brake) · --flowWrist=1.2(흐름 켜진 동안 손목 힘 wristK × 수 — 지금 판엔 없는 몫) ·
//   --hz=120(pair 만 — 손가락 프레임 빠르기. 60 Hz 는 물리 두 스텝에 한 번 손가락이 움직여 휘두르기 문턱 1.5 m/s 근처에서 휘두르기 표시가 깜빡인다)
//  사용법: node tools/sim/ib_flow_measure.mjs pair|chain|fight [--w=zweihander] [--seeds=8] [--seed0=1] [--speeds=4,8] [--pauses=0,0.1,0.2,0.3,0.4,0.5,0.8,1.2] [--pats=zwerch,diag,oberUnter]
//          [--foes=still,walk] [--dur=30] [--opps=longsword,uchigatana,rapier] [--prof=3] [--delay=0.15] [--ease=mj|lin] [--json=.tmp/파일]// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { getWeapon } from '../../src/weapons.js';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const MODE = pos[0] ?? 'pair';
const WID = args.w ?? 'zweihander';
const NS = +(args.seeds ?? 8), S0 = +(args.seed0 ?? 1);
const SEEDS = Array.from({ length: NS }, (_, i) => S0 + i);
const FRAME = 1 / +(args.hz ?? 60); // 손가락이 들어오는 화면 프레임 (main.js frame — 60 Hz 면 물리 두 스텝에 한 번)
const EASE = args.ease ?? 'mj'; // 손가락 빠르기 꼴 (fingerTo)
const { SKILL } = CONFIG;
const KIT_ON = kitFromNodes('iberian', allNodeIds('iberian'));
const KIT_OFF = { ...KIT_ON, ibFlow: false };
const kitOf = (on) => (on ? KIT_ON : KIT_OFF);
const spec = getWeapon(WID);
const REACH_LEN = spec.hiltLength + spec.bladeLength; // 손 ~ 칼끝 (m)

const _q = new THREE.Quaternion(), _o = new THREE.Vector3();
const axisOf = (P, out = new THREE.Vector3()) => { const q = P.sword.rotation(); return out.set(0, 1, 0).applyQuaternion(_q.set(q.x, q.y, q.z, q.w)); };
const tipVel = (P) => { const p = P.bladePoint(1, _o); const v = P.sword.velocityAtPoint({ x: p.x, y: p.y, z: p.z }); return new THREE.Vector3(v.x, v.y, v.z); };
const deg = (r) => (r * 180) / Math.PI;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const p50 = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const f = (x, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : '—');
const lcg = (seed) => { let s = (seed * 7919 + 17) >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };

// 견줌 시험 (이 실행 안에서만 — src 값은 그대로): --brake=0.8 = IB_FLOW.brake 를 이 실행에서만 바꿈 · --flowWrist=1.15 = 흐름 켜진 동안 손목 힘(wristK) × 수 (지금 판엔 없는 몫)
if (args.brake != null) CONFIG.IB_FLOW.brake = +args.brake;
const FLOW_WRIST = +(args.flowWrist ?? 1);
function setupPlayer(P) {
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  if (FLOW_WRIST !== 1) {
    const base = P.wristK ?? 1, step0 = P.step.bind(P);
    P.step = (dt) => { P.wristK = base * (P.ibFlowOn ? FLOW_WRIST : 1); step0(dt); };
  }
}
/** 손가락 프레임 줄: 지금 자리(st)에서 p 로 평균 v 패드 m/s. EASE mj = 사람 손 꼴(최소 저크 — 천천히 떠서 가운데서 가장 빠르고(평균의 1.875 배) 천천히 멈춤) · lin = 고른 빠르기(옛 봇들) */
function fingerTo(st, p, v, held, ease = EASE) {
  const fr = [];
  if (ease === 'mj') {
    const dx = p[0] - st.x, dy = p[1] - st.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return fr;
    const n = Math.max(1, Math.round(d / v / FRAME));
    let s0 = 0;
    for (let i = 1; i <= n; i++) {
      const u = i / n, s = u * u * u * (10 - 15 * u + 6 * u * u);
      fr.push([dx * (s - s0), dy * (s - s0), held]);
      s0 = s;
    }
    st.x = p[0]; st.y = p[1];
    return fr;
  }
  for (let k = 0; k < 400; k++) {
    const dx = p[0] - st.x, dy = p[1] - st.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) break;
    const s = Math.min(d, v * FRAME);
    st.x += (dx / d) * s; st.y += (dy / d) * s;
    fr.push([(dx / d) * s, (dy / d) * s, held]);
  }
  return fr;
}
const hold = (n, held) => Array.from({ length: Math.max(0, Math.round(n)) }, () => [0, 0, held]);

// ───────── pair: 허공 두 칼 ─────────
const PAIRS = {
  zwerch: [[0.52, 0.06], [-0.5, 0.06], [0.52, 0.06]],
  diag: [[0.42, 0.42], [-0.38, -0.38], [0.42, 0.42]],
  oberUnter: [[0.02, 0.52], [0.0, -0.45], [0.42, 0.4]],
};
function pairTrial(pat, v, pause, on, seed = 1) {
  const G = newRound({ walls: false, weapon: WID, weapon2: 'longsword', seed, gap: 6, kit: kitOf(on) });
  const P = G.player, E = G.enemy;
  setupPlayer(P);
  for (const x of [P, E]) x.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  try {
    const [A, B, C] = PAIRS[pat];
    const st = { x: 0, y: 0 };
    const tag = []; // 프레임마다 갈래
    let fr = [];
    const push = (list, t) => { for (const x of list) { fr.push(x); tag.push(t); } };
    push(hold(2.6 / FRAME, false), 'settle');
    let ok = true;
    // 쉰 자세 손가락 자리에서 감기 (handOffset 은 첫 스텝 뒤에야 알 수 있어 settle 끝에 만든다)
    let li = 0, t = 0, acc = 0;
    let c1s = null, c1e = null, c2s = null, c2e = null;
    const R = { pat, v, pause, on, flow1: 0, flow2: 0, tip1: 0, tip2: 0, tPeak2: null, rec: null, over: 0, overCm: 0, stop: null };
    const samples = [];
    let dirPeak = null, below = 0;
    while (t < 12) {
      if (li >= fr.length) {
        if (tag[li - 1] === 'settle') {
          st.x = P.handOffset.x; st.y = P.handOffset.y;
          push(fingerTo(st, A, 1.2, true, "lin"), 'wind');
          push(hold(1.0 / FRAME, true), 'rest');
          push(fingerTo(st, B, v, true), 'c1');
          push(hold(pause / FRAME, true), 'p');
          push(fingerTo(st, C, v, true), 'c2');
          push(hold(1.5 / FRAME, true), 'hold');
        } else break;
      }
      const [dx, dy, held] = fr[li];
      const tg = tag[li];
      if (tg === 'c1' && c1s == null) c1s = t;
      if (tg !== 'c1' && c1s != null && c1e == null) c1e = t;
      if (tg === 'c2' && c2s == null) c2s = t;
      if (tg !== 'c2' && c2s != null && c2e == null) c2e = t;
      P.handOffset.x += dx; P.handOffset.y += dy;
      P.handHeld = held;
      P.inputActive = Math.abs(dx) + Math.abs(dy) > 1e-5;
      P.move.set(0, 0);
      acc += FRAME;
      while (acc >= DT - 1e-9) {
        acc -= DT;
        G.step();
        if (!P.sword || P.state !== 'stand') { ok = false; continue; }
        const tt = t + FRAME - acc;
        const tv = tipVel(P), sp = tv.length();
        if (c1s != null && c2s == null) { R.tip1 = Math.max(R.tip1, sp); if (P.ibFlowOn) R.flow1 = 1; }
        if (c2s != null && (c2e == null || tt < c2e + 0.4)) {
          if (sp > R.tip2) { R.tip2 = sp; R.tPeak2 = tt - c2s; dirPeak = tv.clone().normalize(); }
        }
        if (c2s != null && (c2e == null || tt < c2e + 0.3) && P.ibFlowOn) R.flow2 = 1;
        if (c2e != null && tt >= c2e) {
          samples.push([axisOf(P), P.bladePoint(1, new THREE.Vector3())]);
          if (R.stop == null) { below = sp < 1.5 ? below + DT : 0; if (below >= 0.1) R.stop = tt - c2e - 0.1; }
        }
      }
      t += FRAME;
      li++;
    }
    R.ok = ok;
    if (c1e != null && c2s != null && R.tPeak2 != null) R.rec = c2s + R.tPeak2 - c1e;
    if (samples.length && dirPeak) {
      const [a, ta] = samples[samples.length - 1];
      for (const [b, tb] of samples) {
        if (b.clone().sub(a).dot(dirPeak) > 0) R.over = Math.max(R.over, deg(Math.acos(Math.max(-1, Math.min(1, a.dot(b))))));
        if (tb.clone().sub(ta).dot(dirPeak) > 0) R.overCm = Math.max(R.overCm, 100 * tb.distanceTo(ta));
      }
    }
    return R;
  } finally { G.world.free(); }
}

// ───────── chain · fight 공통: 이어 긋기 손가락 ─────────
const WP = [[0.42, 0.4], [-0.42, 0.4], [0.52, 0.06], [-0.5, 0.06], [0.4, -0.4], [-0.4, -0.4], [0.02, 0.52], [0.0, -0.45]];
function nextWp(rnd, x, y) {
  let c = WP.filter((p) => Math.hypot(p[0] - x, p[1] - y) > 0.6); // 몸을 가로지르는 칼 (0.6 패드 m 넘게)
  if (!c.length) c = WP; // 가운데에서 (첫 자리로 갈 때) — 아무 자세 점
  return c[Math.floor(rnd() * c.length)];
}
/** 한 벌: 첫 자리로(windV · windHeld) → 쉼 → K 칼(쉼 pauseMax 안). 칼마다 { s: 시작 프레임, e: 끝 프레임, pause } 표를 붙인다 */
function chainFrames(rnd, st, K, pauseMax, windV, windHeld, windPause) {
  const fr = [];
  const cuts = [];
  let p = nextWp(rnd, st.x, st.y);
  fr.push(...fingerTo(st, p, windV, windHeld, windV < 1.5 ? "lin" : EASE));
  fr.push(...hold(windPause / FRAME, windHeld));
  for (let k = 0; k < K; k++) {
    const pause = k === 0 ? null : rnd() * pauseMax;
    if (k > 0) fr.push(...hold(pause / FRAME, true));
    p = nextWp(rnd, st.x, st.y);
    const j = [p[0] + (rnd() - 0.5) * 0.08, p[1] + (rnd() - 0.5) * 0.08];
    const v = 3.5 + rnd() * 2.5;
    const s = fr.length;
    fr.push(...fingerTo(st, j, v, true));
    cuts.push({ s, e: fr.length, pause, v: +v.toFixed(2), k });
  }
  return { fr, cuts };
}

/** 칼을 아래에 둔 채 걷기만 하는 AI (schielhau_strike.mjs LowFoe 와 같은 꼴) */
const LOW = [0, -0.5];
class LowFoe extends AI {
  startAttack() { return false; }
  respond() { return false; }
  moveHand() { this.me.handOffset.set(LOW[0], LOW[1]); }
}
function holdLow(x, xy) {
  x.handOffset.set(xy[0], xy[1]);
  const sk = x.skill;
  for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) sk[k]?.set(xy[0], xy[1]);
  for (const k of ['aimVel', 'vel', 'follow']) sk[k]?.set(0, 0);
}

/** 칼 기록 묶음 (chain · fight) */
function cutTracker(P) {
  const cuts = [];
  let cur = null, lastEnd = null;
  return {
    cuts,
    start(t, meta) { cur = { t0: t, tEnd: null, prevEnd: lastEnd, flow: 0, tip: 0, tPeak: null, hit: null, sev: 0, n: 0, ...meta }; cuts.push(cur); },
    end(t) { if (cur) { cur.tEnd = t; lastEnd = t; } },
    breakChain() { lastEnd = null; },
    step(t) {
      if (!cur) return;
      const sp = tipVel(P).length();
      const live = cur.tEnd == null || t < cur.tEnd + 0.4;
      if (live && sp > cur.tip) { cur.tip = sp; cur.tPeak = t - cur.t0; }
      if ((cur.tEnd == null || t < cur.tEnd + 0.3) && P.ibFlowOn) cur.flow = 1;
    },
    wound(r) {
      if (!cur) return;
      const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
      cur.sev += sv; cur.n++;
      if (!cur.hit) cur.hit = { type: r.type, zone: r.zone, sev: r.severity ?? 0, energy: r.energy, tip: P.tipVel.length() };
    },
  };
}

// ───────── chain: 이어 긋기 연습 ─────────
function chainRun(foe, seed, on, dur = 30) {
  const G = newRound({ walls: true, weapon: WID, weapon2: 'longsword', seed, kit: kitOf(on), AIClass: foe === 'walk' ? LowFoe : AI });
  const P = G.player, D = G.enemy;
  setupPlayer(P);
  if (foe !== 'walk') G.ai.update = () => {};
  D.applyWound = () => {}; // 맞는 쪽 상처 끔 — 판정만 잼
  for (const x of [P, D]) x.die = () => {};
  const uq = new PlayerUniqueAssist(P, { names: KIT_ON.unique });
  const rnd = lcg(seed);
  const [CONTACT, REACH] = MEASURED[WID] ?? MEASURED.longsword;
  const tr = cutTracker(P);
  let queue = [], qTag = [], nextChain = 2.6, stepN = 0;
  const st = { x: 0, y: 0 };
  G.before = () => {
    const t = G.t, dist = P.foeDistance();
    if (!queue.length && t >= nextChain) {
      st.x = P.handOffset.x; st.y = P.handOffset.y;
      const K = 3 + Math.floor(rnd() * 3);
      const { fr, cuts } = chainFrames(rnd, st, K, 0.5, 1.2, true, 0.3);
      fr.push(...hold(6, false));
      queue = fr; qTag = Array(fr.length).fill(null);
      for (const c of cuts) { qTag[c.s] = { ...(qTag[c.s] ?? {}), start: c }; qTag[c.e] = { ...(qTag[c.e] ?? {}), end: true }; }
      tr.breakChain();
      nextChain = Infinity;
    }
    if ((stepN++ & 1) === 0) {
      const tg = qTag.shift();
      const fq = queue.shift() ?? [0, 0, false];
      if (tg?.end) tr.end(t);
      if (tg?.start) tr.start(t, { k: tg.start.k, pause: tg.start.pause, v: tg.start.v });
      const u = P.skill.uniq;
      u?.feed(fq[0], fq[1], FRAME, false);
      if (!(u ? (u.holdsHand ?? u.running) : false)) { P.handOffset.x += fq[0]; P.handOffset.y += fq[1]; }
      P.handHeld = fq[2];
      P.inputActive = Math.abs(fq[0]) + Math.abs(fq[1]) > 1e-5;
      if (!queue.length && nextChain === Infinity) nextChain = t + 1.0 + rnd() * 0.6;
    }
    const fwd = queue.length && dist > CONTACT ? 0.6 : dist < CONTACT + 0.1 ? -0.55 : dist > REACH + 0.1 ? 0.45 : 0;
    P.move.set(0, fwd); P.stickX = 0; P.stickY = fwd;
  };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => { pw?.(att, vic, r, ...rest); if (att === P && vic === D) tr.wound(r); };
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      if (foe !== 'walk') holdLow(D, LOW);
      G.step();
      tr.step(G.t);
    }
    return { foe, seed, on, cuts: tr.cuts, fired: { ...(uq.stats?.fired ?? {}) } };
  } finally { G.world.free(); }
}

// ───────── fight: 사람 싸움 ─────────
function fightRun(opp, seed, on, { dur = 30, prof = 3, delay = 0.15 } = {}) {
  const G = newRound({ walls: true, seed, weapon: WID, weapon2: opp, persona: { proficiency: prof }, kit: kitOf(on) });
  applyWeaponMeasure(G.ai, opp);
  const P = G.player, A = G.enemy;
  setupPlayer(P);
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(P, { names: KIT_ON.unique });
  const rnd = lcg(seed * 31 + Math.round(delay * 1000));
  const [CONTACT, REACH] = MEASURED[WID] ?? MEASURED.longsword;
  const tr = cutTracker(P);
  let queue = [], qTag = [], nextAtk = 2.6, due = Infinity, heldUntil = 0, lastMotion = -1, notice = false, stepN = 0, taps = 0;
  const st = { x: 0, y: 0 };
  G.before = () => {
    const t = G.t, dist = P.foeDistance();
    const motion = A.armed && dist < 2.4 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (motion) { lastMotion = t; if (!notice && !guard.held && due === Infinity && !queue.length) { due = t + delay + rnd() * 0.1; notice = true; } } else if (t - lastMotion > 0.3) notice = false;
    if (t >= due) { due = Infinity; heldUntil = t + 0.6 + rnd() * 0.4; }
    guard.held = t < heldUntil && !queue.length && !P.skill.tap;
    guard.broken = !!(P.skill.tap || P.skill.pom || queue.length);
    if (!guard.held && !queue.length && t >= nextAtk && dist < REACH + 0.3 && P.alive && P.armed && !P.stamina.exhausted) {
      if (rnd() < 0.15) { if (P.skill.thrust()) taps++; }
      else {
        st.x = P.handOffset.x; st.y = P.handOffset.y;
        const r = rnd(), K = r < 0.4 ? 1 : r < 0.75 ? 2 : 3;
        const { fr, cuts } = chainFrames(rnd, st, K, 0.4, 1.6, false, 4 * FRAME); // 감기는 playerFight 처럼 1.6 패드 m/s · 손 뗀 채 · 4 프레임 쉼
        fr.push(...hold(6, false));
        queue = fr; qTag = Array(fr.length).fill(null);
        for (const c of cuts) { qTag[c.s] = { ...(qTag[c.s] ?? {}), start: c }; qTag[c.e] = { ...(qTag[c.e] ?? {}), end: true }; }
        tr.breakChain();
      }
      nextAtk = t + 1.0 + rnd() * 0.6;
    }
    guard.step(DT);
    P.inputActive = guard.active;
    if ((stepN++ & 1) === 0) {
      const tg = qTag.shift();
      const fq = queue.shift() ?? [0, 0, false];
      if (tg?.end) tr.end(t);
      if (tg?.start) tr.start(t, { k: tg.start.k, pause: tg.start.pause, v: tg.start.v });
      const u = P.skill.uniq;
      u?.feed(fq[0], fq[1], FRAME, false);
      if (!(u ? (u.holdsHand ?? u.running) : false)) { P.handOffset.x += fq[0]; P.handOffset.y += fq[1]; }
      P.handHeld = fq[2];
      if (Math.abs(fq[0]) + Math.abs(fq[1]) > 1e-5) P.inputActive = true;
    }
    const fwd = P.stamina.exhausted || !P.alive ? 0 : queue.length && dist > CONTACT ? 0.6 : dist < CONTACT + 0.1 ? -0.55 : dist > REACH + 0.25 ? 0.45 : 0;
    P.move.set(0.18 * Math.sin(t * 0.65 + seed), fwd);
    P.stickX = P.move.x; P.stickY = P.move.y;
  };
  let dealt = 0, recv = 0;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (att === A && vic === P) recv += sv;
    if (att === P && vic === A) { dealt += sv; tr.wound(r); }
  };
  let end = dur;
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      tr.step(G.t);
      if ((!P.alive || !A.alive) && end === dur) end = G.t + 0.5;
      if (G.t >= end) break;
    }
    return { opp, seed, on, win: !A.alive && P.alive, lose: !P.alive && A.alive, dealt, recv, taps, t: G.t, cuts: tr.cuts.map((c) => ({ k: c.k, flow: c.flow, tip: c.tip, sev: c.sev })), fired: { ...(uq.stats?.fired ?? {}) } };
  } finally { G.world.free(); }
}

// ───────── 묶음 · 출력 ─────────
function cutSummary(cuts) {
  const ch = cuts.filter((c) => c.k > 0), first = cuts.filter((c) => c.k === 0);
  const hits = (l) => l.filter((c) => c.hit && c.hit.type !== 'blunt' && c.hit.sev > 0);
  const H = hits(ch);
  return {
    n: cuts.length, chained: ch.length, flowChained: mean(ch.map((c) => c.flow)), flowFirst: mean(first.map((c) => c.flow)),
    rec: mean(ch.filter((c) => c.prevEnd != null && c.tPeak != null).map((c) => c.t0 + c.tPeak - c.prevEnd)),
    tPeak: mean(ch.filter((c) => c.tPeak != null).map((c) => c.tPeak)), tip: mean(ch.map((c) => c.tip)),
    hitRate: ch.length ? H.length / ch.length : NaN, hitTip: mean(H.map((c) => c.hit.tip)), hitE: mean(H.map((c) => c.hit.energy)), hitSev: mean(H.map((c) => c.hit.sev)), sevPerCut: mean(ch.map((c) => c.sev)),
    bladeHitsAll: hits(cuts).length, sevAll: cuts.reduce((s, c) => s + c.sev, 0),
  };
}

const out = { mode: MODE, w: WID };
if (MODE === 'pair') {
  const speeds = String(args.speeds ?? '4,8').split(',').map(Number);
  const pauses = String(args.pauses ?? '0,0.1,0.2,0.3,0.4,0.5,0.8,1.2').split(',').map(Number);
  const pats = String(args.pats ?? Object.keys(PAIRS).join(',')).split(',');
  const rows = [];
  for (const v of speeds) for (const pause of pauses) for (const pat of pats) for (const on of [false, true]) rows.push(pairTrial(pat, v, pause, on));
  out.rows = rows;
  console.log(`${WID} pair (손 ~ 칼끝 ${REACH_LEN.toFixed(2)} m) — 칼 2 : 흐름 · 칼끝 최고 m/s · 칼끝 최고까지(칼 2 시작) s · 이어 오기(칼 1 멈춤 → 칼 2 최고) s · 지나침 ° / cm · 멈춤 s   [off → on]`);
  for (const v of speeds) for (const pause of pauses) {
    const g = (on) => rows.filter((r) => r.v === v && r.pause === pause && r.on === on && r.ok);
    const a = g(false), b = g(true);
    const m = (l, k) => mean(l.map((r) => r[k]).filter((x) => x != null));
    console.log(`  v ${v} 쉼 ${pause.toFixed(1)}: 흐름(칼 1 · 홀로 벤 칼) on ${f(m(b, 'flow1'), 2)} · 흐름(칼 2) ${f(m(a, 'flow2'), 2)}→${f(m(b, 'flow2'), 2)} · 칼끝 ${f(m(a, 'tip2'))}→${f(m(b, 'tip2'))} (${f(100 * (m(b, 'tip2') / m(a, 'tip2') - 1), 1)} %) · 최고까지 ${f(m(a, 'tPeak2'), 3)}→${f(m(b, 'tPeak2'), 3)} · 이어 오기 ${f(m(a, 'rec'), 3)}→${f(m(b, 'rec'), 3)} (${f(1000 * (m(b, 'rec') - m(a, 'rec')), 0)} ms) · 지나침 ${f(m(a, 'over'), 1)}→${f(m(b, 'over'), 1)}° / ${f(m(a, 'overCm'), 1)}→${f(m(b, 'overCm'), 1)} cm · 멈춤 ${f(m(a, 'stop'), 3)}→${f(m(b, 'stop'), 3)}`);
  }
} else if (MODE === 'chain') {
  const foes = String(args.foes ?? 'still,walk').split(',');
  const dur = +(args.dur ?? 30);
  out.runs = [];
  for (const foe of foes) {
    const sum = {};
    for (const on of [false, true]) {
      const runs = SEEDS.map((s) => chainRun(foe, s, on, dur));
      out.runs.push(...runs.map((r) => ({ ...r, cuts: r.cuts.map((c) => ({ ...c })) })));
      sum[on] = cutSummary(runs.flatMap((r) => r.cuts));
      sum[on].hitsPer30 = (sum[on].bladeHitsAll / runs.length) * (30 / dur);
      sum[on].sevPer30 = (sum[on].sevAll / runs.length) * (30 / dur);
    }
    out[foe] = sum;
    console.log(`${WID} chain foe=${foe} (${SEEDS.length} 씨앗 × ${dur} s) [off → on]`);
    const a = sum.false, b = sum.true;
    console.log(`  칼 ${a.n}/${b.n} · 이은 칼 ${a.chained}/${b.chained} · 흐름 켜짐(이은 칼) ${f(a.flowChained)}→${f(b.flowChained)} · (첫 칼) ${f(a.flowFirst)}→${f(b.flowFirst)}`);
    console.log(`  이어 오기 ${f(a.rec, 3)}→${f(b.rec, 3)} s (${f(1000 * (b.rec - a.rec), 0)} ms) · 칼끝 최고까지 ${f(a.tPeak, 3)}→${f(b.tPeak, 3)} · 칼끝 최고 ${f(a.tip)}→${f(b.tip)} (${f(100 * (b.tip / a.tip - 1), 1)} %)`);
    console.log(`  이은 칼 맞힘률 ${f(a.hitRate)}→${f(b.hitRate)} · 맞을 때 칼끝 ${f(a.hitTip)}→${f(b.hitTip)} m/s (${f(100 * (b.hitTip / a.hitTip - 1), 1)} %) · 에너지 ${f(a.hitE, 0)}→${f(b.hitE, 0)} J · 심각도 ${f(a.hitSev, 3)}→${f(b.hitSev, 3)} · 칼당 심각도 ${f(a.sevPerCut, 3)}→${f(b.sevPerCut, 3)}`);
    console.log(`  30 s 당 칼날 맞음 ${f(a.hitsPer30, 1)}→${f(b.hitsPer30, 1)} · 심각도 합 ${f(a.sevPer30, 2)}→${f(b.sevPer30, 2)}`);
  }
} else if (MODE === 'fight') {
  const opps = String(args.opps ?? 'longsword,uchigatana,rapier').split(',');
  const o = { dur: +(args.dur ?? 30), prof: +(args.prof ?? 3), delay: +(args.delay ?? 0.15) };
  out.runs = [];
  for (const opp of opps) for (const s of SEEDS) for (const on of [false, true]) {
    const r = fightRun(opp, s, on, o);
    out.runs.push(r);
    console.log(JSON.stringify({ ...r, cuts: undefined, nCuts: r.cuts.length, flow: +mean(r.cuts.map((c) => c.flow)).toFixed(2), dealt: +r.dealt.toFixed(3), recv: +r.recv.toFixed(3), t: +r.t.toFixed(1) }));
  }
  for (const on of [false, true]) {
    const R = out.runs.filter((r) => r.on === on);
    const C = R.flatMap((r) => r.cuts);
    console.log(`${on ? 'on ' : 'off'}: ${R.length} 판 · 승 ${R.filter((r) => r.win).length} 패 ${R.filter((r) => r.lose).length} 무 ${R.filter((r) => !r.win && !r.lose).length} · 준 ${f(mean(R.map((r) => r.dealt)), 3)} 받은 ${f(mean(R.map((r) => r.recv)), 3)} · 칼 ${C.length} · 흐름 켜진 칼 ${f(mean(C.map((c) => c.flow)))} (첫 칼 ${f(mean(C.filter((c) => c.k === 0).map((c) => c.flow)))} · 이은 칼 ${f(mean(C.filter((c) => c.k > 0).map((c) => c.flow)))}) · 칼끝 최고 ${f(mean(C.map((c) => c.tip)))}`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify(out));
