// ─────────────────────────────────────────────────────────────
//  morg_weight.mjs — 모르겐슈테른이 무거워 휘두르기 어색하고 힘든가 (사장님 11/14 '모르겐슈테른이 혹시 너무 무거워서 휘두르기 어색하고 힘든가?')
//   기록: docs/strike/morg_weight_2026-11-14.md. 재기만 한다 — 게임 값(src)은 그대로(--row 는 이 프로세스 안에서만 손 표 줄을 바꿈).
//   견줌 무기: 롱소드 · 츠바이핸더 · 플랑베르주 · 냉동 참치 · 모르겐슈테른.
//
//  spec   스펙: 질량 · 손에서 무게 중심 · 손 둘레 관성(weapon_class.js weaponPhysics) · 손 ~ 끝 길이 · 쥠 · 손목 서보 상한(maxAimTorque) · 겨눔 강성 ·
//         칼 무게를 수평으로 버티는 데 드는 손목 힘(m·g·무게 중심 — 상한의 몇 %) · 상한 ÷ 손 둘레 관성(낼 수 있는 가장 큰 각가속도) · 베기 기력(cutCost × 무게 배율) · 손 표 줄
//  human  사람 손가락 봇(swing_feel.mjs 와 같은 입력 — 60 Hz 프레임마다 handOffset · handHeld · inputActive · 숙련 0.7 · corr · autoGuard): 멈춘 과녁 앞 허공에
//         감기(2 패드 m/s) → 0.6 s 쉼 → 긋기(--v 패드 m/s) → 0.15 s 댄 채 → 손가락 뗌(자세로 돌아감) 2.5 s. 길 둘(ober 내려베기 · zornR 사선).
//         잼: 칼끝(손 ~ 끝 — 모르겐슈테른은 쇠머리 끝) 최고 m/s · 긋기 시작 → 최고 s · 긋기 시작 → 칼이 섬(최고 뒤 칼끝 < 1.5 m/s) s ·
//         뗌 → 자세로 돌아옴(칼끝이 2.5 s 끝 선 자세 자리 0.10 m 안에 들어와 끝까지 머무는 첫 때) s · 그 선 자세가 긋기 전 자세에서 떨어진 거리 · 손목 상한에 붙은 몫(긋기 시작 ~ 칼이 섬 · |τ| ≥ 0.98 상한 — arm_arc_gauge 와 같은 잣대) · 그 획 기력 attack
//  ai     AI(숙련 2) 헛스윙 연습(src/whiff_drill.js — 제 칼끝 거리 밖에서 그 유파 기술로 허공을 벰) 대 가만한 사람 몸 · 씨앗 1 ~ 3 · 30 s.
//         칼마다: 낸 순간 → 칼끝 최고 s · 칼끝 최고 m/s · 낸 순간 → 칼이 섬 s · 낸 순간 → 다음 수를 고름(afterStrike — 길 + 지나감 기다림) s · 손목 상한에 붙은 몫 · 기력
//  fight  ai_reach_fight.mjs 와 같은 판(그 무기 AI 숙련 2 대 롱소드 AI 숙련 2 · 30 s · 씨앗 1 ~ 6 · 홀 = E 자리)에 공격 흐름 계기만 더함:
//         모드 · 공격 단계 시간 몫(간 보기 · 준비 · 다가감 · 베기 · 지나감 · 막기 · 물러남) · 기력 쉼 시간 · 공격 시작 · 칼 냄 · 칼 내기 전 접음(무엇으로 — 간 보기(포기) · 막기 · 물러남) ·
//         다가가다 접은 까닭(시간 넘음 · 상대가 멀어짐) · 다가감 동안 받은 상처 · 다가감에서 닿은 가장 가까운 거리 ↔ need · 간 보는 거리 p50 · 기력 p10
//
//  node tools/sim/morg_weight.mjs spec|human|ai [무기…] [--v=10] [--seeds=1-3]
//  node tools/sim/morg_weight.mjs fight [무기…] [--seeds=1-6] [--row=frozen_tuna:1.36,1.63,1.05,0.44] (--row 는 여럿 · 이 프로세스 안에서만 · 판 모듈을 읽기 전에 바꿈)
// ─────────────────────────────────────────────────────────────
import { isMain } from './is_main.mjs';
import { MEASURED, CUT_TIME_30 } from '../../src/weapon_measured.js'; // 유파 꾸러미(schools.js)보다 먼저 — --row 가 꾸러미에도 들게

// 판 · 몸 모듈은 load() 로 늦게 읽는다: 유파 꾸러미가 읽을 때 손 표를 한 번 굳히므로(schools.js schoolMeasure) --row 는 그 전에 바꿔야 한다
let newRound, DT, AI, THREE, CONFIG, seedRandom, getWeapon, weaponPhysics, WhiffDrill, STAMINA, SKILL, ARENA, _q, _r, _w;
export async function load() {
  if (newRound) return;
  ({ newRound, DT, AI, THREE, CONFIG, seedRandom } = await import('./harness_m.mjs'));
  ({ getWeapon } = await import('../../src/weapons.js'));
  ({ weaponPhysics } = await import('../../src/weapon_class.js'));
  ({ WhiffDrill } = await import('../../src/whiff_drill.js'));
  ({ STAMINA, SKILL, ARENA } = CONFIG);
  _q = new THREE.Quaternion(); _r = new THREE.Vector3(); _w = new THREE.Vector3();
}
/** 이 프로세스 안에서만 손 표 줄을 바꿈 (load() 전에 — 'id:a,b,c,d') */
export function setRow(spec) { const [w, v] = spec.split(':'); MEASURED[w] = v.split(',').map(Number); return MEASURED[w]; }
const WEAPONS5 = ['longsword', 'zweihander', 'flamberge', 'frozen_tuna', 'morgenstern'];
const argOf = (args, k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const seedList = (s) => { if (s.includes('-')) { const [a, b] = s.split('-').map(Number); return Array.from({ length: b - a + 1 }, (_, i) => a + i); } return s.split(',').map(Number); };
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return NaN; const n = b.length; return n % 2 ? b[(n - 1) / 2] : (b[n / 2 - 1] + b[n / 2]) / 2; };
const q = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * b.length))] : NaN; };
const f2 = (x) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(2));
const f1 = (x) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(1));
const pct = (a, b) => (b ? `${Math.round((100 * a) / b)} %` : '-');
const chestDist = (a, b) => { const p = a.bodies.chest.translation(), r = b.bodies.chest.translation(); return Math.hypot(p.x - r.x, p.z - r.z); };
/** 칼끝(손 ~ 끝) 빠르기 벡터 · 자리 */
function tipState(P) {
  const s = P.sword, rq = s.rotation(), lv = s.linvel(), av = s.angvel(), t = s.translation();
  _q.set(rq.x, rq.y, rq.z, rq.w);
  _r.set(0, P.weaponCfg.hiltLength + P.weaponCfg.bladeLength, 0).applyQuaternion(_q);
  _w.set(av.x, av.y, av.z);
  const v = new THREE.Vector3(lv.x, lv.y, lv.z).add(_w.clone().cross(_r));
  return { v, p: new THREE.Vector3(t.x + _r.x, t.y + _r.y, t.z + _r.z) };
}
/** 손목 상한에 붙었나 (arm_arc_gauge.mjs 와 같은 잣대) */
const wristSat = (P) => { const c = P.debug.wristCap || 0; return c > 0 && P.debug.wristTorque.length() >= 0.98 * c; };
/** 가슴 틀(가슴 자리 · 앞 방향)로 옮긴 점 — 자세 비교용 */
function inChest(P, p) {
  const c = P.bodies.chest.translation(), f = P.forward(new THREE.Vector3());
  const dx = p.x - c.x, dz = p.z - c.z;
  return new THREE.Vector3(dx * f.x + dz * f.z, p.y - c.y, -dx * f.z + dz * f.x);
}

// ── spec ─────────────────────────────────────────────────────────────
export function specRows(ids) {
  return ids.map((id) => {
    const w = getWeapon(id);
    const p = weaponPhysics(w);
    const G = newRound({ seed: 1, weapon: id, weapon2: id });
    const P = G.player, wc = P.weaponCfg;
    const cap = wc.maxAimTorque;
    const hold = p.mass * 9.81 * p.com;
    const r = { id, grip: w.grip, oneHand: !!w.oneHandStance, len: p.length, mass: p.mass, com: p.com, I: p.I, Ihand: P.swordIhand, cap, stiff: wc.aimStiffness, hold, holdPct: hold / cap, accMax: cap / P.swordIhand, weightK: P.stamina.weight, cutCost: STAMINA.cutCost * P.stamina.weight, row: MEASURED[id] ?? null, cut30: CUT_TIME_30[id] ?? null, mBlunt: w.mBlunt, power: w.power };
    G.world.free();
    return r;
  });
}
function printSpec(rows) {
  console.log('| 무기 | 쥠 | 손 ~ 끝 m | 질량 kg | 무게 중심 (손에서) m | 손 둘레 관성 kg·m² (몸에서 잰 값) | 손목 서보 상한 N·m | 수평 버팀 m·g·c N·m (상한의 몫) | 상한 ÷ 관성 rad/s² | 베기 기력 (무게 배율) | 손 표 줄 맞닿기 / 칼끝 / 붙음 · 베는 시간 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.id} | ${r.grip}${r.oneHand ? ' (한손 자세표)' : ''} | ${f2(r.len)} | ${f2(r.mass)} | ${f2(r.com)} | ${f2(r.I)} (${f2(r.Ihand)}) | ${r.cap} | ${f1(r.hold)} (${pct(r.hold, r.cap)}) | ${f1(r.accMax)} | ${f1(r.cutCost)} (× ${f2(r.weightK)}) | ${r.row ? `${r.row[0]} / ${r.row[1]} / ${r.row[2]}` : '-'} · ${r.cut30 ?? '-'} |`);
}

// ── human: 손가락 봇 획 ─────────────────────────────────────────────────────────────
const LINES = { ober: [[0.02, 0.52], [0.0, -0.45]], zornR: [[0.42, 0.42], [-0.4, -0.42]] };
const FRAME = 1 / 60;
export function humanStroke(id, line, v, seed = 1) {
  seedRandom(seed);
  const G = newRound({ walls: true, weapon: id, weapon2: 'longsword', seed });
  const P = G.player, E = G.enemy;
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  for (const f of [P, E]) f.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  const [A, B] = LINES[line];
  const legs = [[null, 2.6, 'settle'], [A, 2, 'wind'], [null, 0.6, 'pause'], [B, v, 'cut'], [null, 0.15, 'hold'], [null, 2.5, 'free']];
  let li = 0, legT = 0, from = null, dur = 0, t = 0, acc = 0, cutT = null, freeT = null, guardTip = null, endTip = null, spent0 = null;
  const R = { peak: 0, tPeak: null, tStop: null, tBack: null, backMin: 9, sat: 0, steps: 0, spent: 0, ok: true };
  const tr = []; // 긋기 시작부터 [u, 칼끝 빠르기, 손목 상한에 붙음]
  const back = []; // 뗀 뒤 [s, 칼끝 빠르기, 돌아올 자리까지]
  while (li < legs.length) {
    const [to, sp, tag] = legs[li];
    const off = P.handOffset;
    let moved = false;
    if (to == null) {
      if (legT === 0 && tag === 'free') freeT = t;
      legT += FRAME;
      if (legT >= sp) { li++; legT = 0; }
    } else {
      if (!from) { from = [off.x, off.y]; dur = Math.max(FRAME, Math.hypot(to[0] - off.x, to[1] - off.y) / sp); legT = 0; if (tag === 'cut') cutT = t; }
      legT += FRAME;
      const k = Math.min(1, legT / dur);
      const nx = from[0] + (to[0] - from[0]) * k, ny = from[1] + (to[1] - from[1]) * k;
      moved = Math.abs(nx - off.x) + Math.abs(ny - off.y) > 1e-5;
      off.x = nx; off.y = ny;
      if (k >= 1) { li++; from = null; legT = 0; }
    }
    P.handHeld = tag !== 'settle' && tag !== 'free';
    P.inputActive = moved;
    P.move.set(0, 0);
    acc += FRAME;
    while (acc >= DT - 1e-9) {
      acc -= DT;
      G.step();
      if (!P.sword || P.armed === false || P.state !== 'stand') { R.ok = false; continue; }
      const T = tipState(P), s = T.v.length();
      const tt = t + FRAME - acc;
      if (tag === 'settle') guardTip = inChest(P, T.p); // 손 뗀 채 선 자세의 칼끝 (돌아올 자리 — 마지막 스텝 값)
      if (tag === 'pause' && spent0 == null) spent0 = P.stamina.spent.attack;
      if (cutT != null) tr.push([tt - cutT, s, wristSat(P)]);
      if (freeT != null && guardTip) { endTip = inChest(P, T.p); back.push([tt - freeT, s, endTip.distanceTo(guardTip), endTip.clone()]); }
    }
    t += FRAME;
  }
  Object.assign(R, settleOf(tr, 0.6));
  // 자세로 돌아옴: 뗀 뒤 칼끝이 마지막 자리(2.5 s 끝 — 그 몸이 다시 선 자세) 0.10 m 안에 들어와 끝까지 머무는 첫 때 (선 자세의 흔들림은 0.1 m 안)
  for (const b of back) R.backMin = Math.min(R.backMin, b[2]);
  for (let i = back.length - 1; i >= 0; i--) { if (back[i][3].distanceTo(endTip) >= 0.1) break; R.tBack = back[i][0]; }
  R.backEnd = back.length ? { d: back[back.length - 1][2], s: back[back.length - 1][1] } : null; // 2.5 s 끝: 돌아올 자리까지 · 칼끝 빠르기
  R.guardTip = guardTip; R.endTip = endTip;
  R.spent = P.stamina.spent.attack - (spent0 ?? 0);
  G.world.free();
  return R;
}
/** 궤적 [u, 빠르기, 상한] 에서: 창 안 칼끝 최고 · 그때 · 최고 뒤 처음 1.5 m/s 아래(칼이 섬) · 그때까지 손목 상한에 붙은 몫 */
function settleOf(tr, win) {
  let ip = -1;
  for (let i = 0; i < tr.length; i++) if (tr[i][0] <= win && (ip < 0 || tr[i][1] > tr[ip][1])) ip = i;
  if (ip < 0) return { peak: 0, tPeak: null, tStop: null, sat: 0, steps: 0 };
  let is = -1;
  for (let i = ip + 1; i < tr.length; i++) if (tr[i][1] < 1.5) { is = i; break; }
  const end = is < 0 ? tr.length - 1 : is;
  let sat = 0;
  for (let i = 0; i <= end; i++) if (tr[i][2]) sat++;
  return { peak: tr[ip][1], tPeak: tr[ip][0], tStop: is < 0 ? null : tr[is][0], sat, steps: end + 1 };
}

// ── ai: 헛스윙 연습 ─────────────────────────────────────────────────────────────
export function aiDrill(id, seeds, secs = 30, prof = 2) {
  const L = [];
  for (const seed of seeds) {
    const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: id, persona: { proficiency: prof } });
    const P = G.player, E = G.enemy, ai = G.ai;
    ai.drill = new WhiffDrill();
    for (const f of [P, E]) f.die = () => {};
    let cur = null;
    const ss = ai.startStrike, as = ai.afterStrike;
    ai.startStrike = function () {
      const sp0 = E.stamina.spent.attack;
      const r = ss.apply(this, arguments);
      cur = { seed, drill: !!this.drillAtk, tech: this.tech?.name, t0: G.t, tAfter: null, spent: E.stamina.spent.attack - sp0, tr: [] };
      L.push(cur);
      return r;
    };
    ai.afterStrike = function () { if (cur && cur.tAfter == null) cur.tAfter = G.t - cur.t0; return as.apply(this, arguments); };
    for (let i = 0; i < Math.round(secs / DT); i++) {
      G.step();
      if (!cur || !E.sword) continue;
      const u = G.t - cur.t0;
      if (u > 1.5) { cur = null; continue; }
      cur.tr.push([u, tipState(E).v.length(), wristSat(E)]);
    }
    G.world.free();
  }
  for (const c of L) { Object.assign(c, settleOf(c.tr, 0.8)); delete c.tr; }
  return L;
}

// ── fight: 공격 흐름 계기 ─────────────────────────────────────────────────────────────
function monitor(ai, f, G, S) {
  const sa = ai.startAttack, ss = ai.startStrike, ab = ai.abortAttack, af = ai.afterStrike;
  ai.afterStrike = function () { S.out[this.hitLanded ? 'hit' : this.bound ? 'bound' : 'miss']++; return af.apply(this, arguments); }; // 칼 끝 가름 (ai.js afterStrike 'landed' · 'parried' · 'missed')
  ai.startAttack = function (tech, why) { const r = sa.apply(this, arguments); if (r && this.mode === 'attack') { S.atk++; S.why[why] = (S.why[why] ?? 0) + 1; this._minD = 9; } return r; };
  ai.startStrike = function () { S.strikes++; if (this._minD != null) S.reachD.push({ d: chestDist(this.me, this.foe), need: this.need }); return ss.apply(this, arguments); };
  ai.abortAttack = function () {
    if (this.phase === 'approach') {
      const hd = this.holdDist();
      const timeOut = this.attackT > 1.3; // 다가감 시간 한도(1.4 s · 쫓기면 3 s — 실제 s) 근처
      S.abortWhy[timeOut ? 'time' : this.d > hd + 0.5 ? 'far' : 'other']++;
      S.abortMin.push({ minD: this._minD, need: this.need });
    } else S.abortWhy[`phase:${this.phase}`] = (S.abortWhy[`phase:${this.phase}`] ?? 0) + 1;
    return ab.apply(this, arguments);
  };
  let prevMode = ai.mode, prevPhase = ai.phase;
  return {
    step() {
      const live = G.t > ARENA.startHold && f.alive && ai.foe.alive;
      if (!live) return;
      const k = ai.mode === 'attack' ? ai.phase : ai.mode;
      S.T[k] = (S.T[k] ?? 0) + DT;
      S.Tall += DT;
      if (ai.staminaRest) S.rest += DT;
      if (ai.mode === 'attack' && ai.phase === 'approach' && ai._minD != null) ai._minD = Math.min(ai._minD, chestDist(f, ai.foe));
      if (ai.mode === 'watch' && Math.round(G.t / DT) % 10 === 0) S.watchD.push(chestDist(f, ai.foe));
      if (Math.round(G.t / DT) % 10 === 0) S.stam.push(f.stamina.value);
      if (prevMode === 'attack' && ai.mode !== 'attack' && (prevPhase === 'ready' || prevPhase === 'guard' || prevPhase === 'approach')) S.leave[ai.mode] = (S.leave[ai.mode] ?? 0) + 1; // 칼을 내기 전 공격을 접음
      prevMode = ai.mode;
      prevPhase = ai.phase;
    },
    wound(vic) {
      if (vic !== f) return;
      S.hurt++;
      const k = ai.mode === 'attack' ? ai.phase : ai.mode;
      S.hurtIn[k] = (S.hurtIn[k] ?? 0) + 1;
    },
  };
}
const newS = () => ({ out: { hit: 0, bound: 0, miss: 0 }, T: {}, Tall: 0, rest: 0, atk: 0, why: {}, strikes: 0, abortWhy: { time: 0, far: 0, other: 0 }, abortMin: [], reachD: [], leave: {}, hurt: 0, hurtIn: {}, watchD: [], stam: [], fights: 0 });

export function fightFlow(weapon, { seeds = [1, 2, 3, 4, 5, 6], secs = 30, prof = 2, foe = 'longsword' } = {}) {
  const S = newS(), O = newS();
  for (const seed of seeds) {
    const subjE = seed % 2 === 1;
    const G = newRound({ seed, walls: true, weapon: subjE ? foe : weapon, weapon2: subjE ? weapon : foe, AI2Class: AI, difficulty: 'normal', persona: { proficiency: prof }, persona2: { proficiency: prof } });
    const aiS = subjE ? G.ai : G.ai2, aiO = subjE ? G.ai2 : G.ai;
    const fS = subjE ? G.enemy : G.player, fO = subjE ? G.player : G.enemy;
    const mS = monitor(aiS, fS, G, S), mO = monitor(aiO, fO, G, O);
    G.onWound = (att, vic) => { mS.wound(vic); mO.wound(vic); };
    for (let i = 0; i < Math.round(secs / DT); i++) {
      G.step();
      mS.step();
      mO.step();
      if (!fS.alive || !fO.alive) break;
    }
    S.fights++; O.fights++;
    G.world.free();
  }
  return { weapon, S, O };
}
function printFlow(R) {
  const KS = ['watch', 'ready', 'guard', 'approach', 'strike', 'follow', 'defend', 'withdraw', 'secret'];
  console.log(`| 무기 (판) | 공격 시작 / 판 | 칼 냄 / 판 (맞힘 · 막힘 · 헛침) | 칼 내기 전 접음: 간 보기 · 막기 · 물러남 | 다가가다 접은 까닭: 시간 넘음 · 멀어짐 · 그 밖 | 다가감에서 닿은 가장 가까운 거리 p50 ↔ need p50 | 시간 몫 ${KS.join(' · ')} | 기력 쉼 | 받은 상처 / 판 (다가감 · 준비 중) | 간 보는 거리 p50 | 기력 p10 |`);
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of R) for (const [S, who] of [[r.S, r.weapon], ...(r.weapon === 'longsword' ? [] : [[r.O, `(상대 롱소드 — ${r.weapon} 판)`]])]) {
    const n = S.fights;
    const sh = KS.map((k) => pct(S.T[k] ?? 0, S.Tall)).join(' · ');
    console.log(`| ${who} (${n}) | ${(S.atk / n).toFixed(1)} | ${(S.strikes / n).toFixed(1)} (${S.out.hit} · ${S.out.bound} · ${S.out.miss}) | ${S.leave.watch ?? 0} · ${S.leave.defend ?? 0} · ${S.leave.withdraw ?? 0} | ${S.abortWhy.time} · ${S.abortWhy.far} · ${S.abortWhy.other} | ${f2(med(S.abortMin.map((x) => x.minD)))} ↔ ${f2(med(S.abortMin.map((x) => x.need)))} | ${sh} | ${pct(S.rest, S.Tall)} | ${(S.hurt / n).toFixed(1)} (${(((S.hurtIn.approach ?? 0) + (S.hurtIn.ready ?? 0) + (S.hurtIn.guard ?? 0)) / n).toFixed(1)}) | ${f2(med(S.watchD))} | ${f1(q(S.stam, 0.1))} |`);
  }
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const args = rest.filter((x) => x.startsWith('--'));
  const ids0 = rest.filter((x) => !x.startsWith('--'));
  const ids = ids0.length ? ids0 : WEAPONS5;
  for (const a of args.filter((x) => x.startsWith('--row='))) console.log(`(이 프로세스만) 손 표 ${a.slice(6).split(':')[0]} = [${setRow(a.slice(6)).join(', ')}]`);
  await load();
  if (mode === 'spec') printSpec(specRows(ids));
  else if (mode === 'human') {
    const v = +argOf(args, 'v', '10');
    console.log(`사람 손가락 봇 · 긋기 ${v} 패드 m/s · 길 ober · zornR`);
    console.log('| 무기 | 길 | 칼끝 최고 m/s | 긋기 → 최고 s | 긋기 → 칼이 섬 s | 뗌 → 자세로 돌아옴 s | 돌아온 자세 ↔ 긋기 전 자세 칼끝 m | 손목 상한에 붙은 몫 (긋기 ~ 칼이 섬) | 그 획 기력 |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const id of ids) for (const line of Object.keys(LINES)) {
      const R = humanStroke(id, line, v);
      console.log(`| ${id} | ${line} | ${f1(R.peak)} | ${f2(R.tPeak)} | ${f2(R.tStop)} | ${R.tBack == null ? '> 2.5' : f2(R.tBack)} | ${R.backEnd ? f2(R.backEnd.d) : '-'} | ${pct(R.sat, R.steps)} | ${f1(R.spent)}${R.ok ? '' : ' (넘어짐)'} |`);
    }
  } else if (mode === 'ai') {
    const seeds = seedList(argOf(args, 'seeds', '1-3'));
    console.log(`AI 숙련 2 헛스윙 연습 · 씨앗 ${seeds.join(',')} · 30 s — 칼마다 가운데 [p10 ~ p90]`);
    console.log('| 무기 | 칼 (연습 칼) | 칼끝 최고 m/s | 낸 순간 → 최고 s | 낸 순간 → 칼이 섬 s | 낸 순간 → 다음 수 고름 s | 손목 상한에 붙은 몫 (칼마다 가운데) | 칼 하나 기력 | 기술 |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    const rowsZ = [];
    for (const id of ids) {
      const L = aiDrill(id, seeds);
      rowsZ.push([id, L.filter((s) => s.drill && s.tech === 'zornhau')]);
      const D = L.filter((s) => s.drill);
      const tech = {};
      for (const s of D) tech[s.tech] = (tech[s.tech] ?? 0) + 1;
      const g = (k) => `${f2(med(D.map((s) => s[k])))} [${f2(q(D.map((s) => s[k]), 0.1))} ~ ${f2(q(D.map((s) => s[k]), 0.9))}]`;
      console.log(`| ${id} | ${L.length} (${D.length}) | ${f1(med(D.map((s) => s.peak)))} [${f1(q(D.map((s) => s.peak), 0.1))} ~ ${f1(q(D.map((s) => s.peak), 0.9))}] | ${g('tPeak')} | ${g('tStop')} | ${g('tAfter')} | ${pct(med(D.map((s) => s.sat / Math.max(1, s.steps))), 1)} | ${f1(med(D.map((s) => s.spent)))} | ${Object.entries(tech).map(([k, n]) => `${k} ${n}`).join(' · ')} |`);
    }
    console.log('\n같은 기술만 — 분노의 베기(zornhau): 칼끝 최고 m/s · 낸 순간 → 최고 s · → 칼이 섬 s · → 다음 수 s · 손목 상한 몫 (칼 수)');
    for (const [id, Z] of rowsZ) console.log(`| ${id} | ${f1(med(Z.map((s) => s.peak)))} | ${f2(med(Z.map((s) => s.tPeak)))} | ${f2(med(Z.map((s) => s.tStop)))} | ${f2(med(Z.map((s) => s.tAfter)))} | ${pct(med(Z.map((s) => s.sat / Math.max(1, s.steps))), 1)} | ${Z.length} |`);
  } else if (mode === 'fight') {
    const seeds = seedList(argOf(args, 'seeds', '1-6'));
    printFlow(ids.map((w) => fightFlow(w, { seeds })));
  } else console.log('쓰는 법: morg_weight.mjs spec|human|ai|fight [무기…] (머리말)');
}
