// ─────────────────────────────────────────────────────────────
//  kote_pickup.mjs — 손목 치기 칼 떨굼 · 떨어진 칼 줍기 재기 (사장님 11/04 '코테는 칼을 더 자주 떨어트리게 해. 단 떨어진 무기를 줍는 동작을 신설하자' · 기록 docs/strike/kote_pickup_2026-11-05.md)
//   재기만 한다 — 게임 값은 --set 으로 이 프로세스 안에서만.
//  rate : 일본 손가락 봇(school_balance.mjs fightOne — 실제 Input 터치 길 · focus 'kote' = 유파 기술 몫이 모두 손목 치기) 대 AI.
//         손목 치기 긋기마다(그 긋기 동안 + 끝난 뒤 0.4 실제 s 의 닿음을 그 긋기에 매김) 탐침: 칼날이 상대 아래팔에 닿음(물리 닿음 — 에너지 · 식힘 무관) ·
//         상대 칼 손 쪽 절반과 새로 부딪힘(빠르기 vn · 들어감 · 자리 at) · 굴림 · 떨굼. 깔때기 = 낸 수 → 닿음(아래팔 또는 칼 손 쪽 절반) → 판정 문(10/24 · 11/05) → 굴림 → 떨굼
//    node tools/sim/kote_pickup.mjs rate [--cells=japanese:uchigatana:longsword,…] [--seeds=1-12] [--tech=0.6] [--dur=30] [--set=UNIQUE_ASSIST.koteDrop.p=1] [--json=파일]
//  agg  : node tools/sim/kote_pickup.mjs agg <json …>   (깔때기 표 — Markdown)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { CONFIG, THREE } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { strokeTechOf } from '../../src/unique_assist.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const UA = CONFIG.UNIQUE_ASSIST;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
/** --set=A.b.c=1,… (이 프로세스 안에서만 — school_balance applySets 와 같은 꼴) */
export function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const velAt = (st, point, out) => out.copy(point).sub(st.com).cross(st.w).negate().add(st.v); // combat.js velAt 과 같은 셈 (스텝 전 칼 상태)

const LIVE = 0.4; // 손목 치기가 '살아 있는' 동안 = 그 긋기 + 끝난 뒤 0.4 실제 s (두 판정 모두 같은 분모 — 닿음을 그 긋기에 매김)
/** 지금 살아 있는 손목 치기 긋기 기록(unique_assist.js skill.uniq cur/last — 긋기마다 한 객체) 또는 null */
function liveKote(P) {
  const u = P.skill?.uniq;
  if (!u || P.skill.tap || P.artTech) return null;
  if (u.cur) return u.cur.unique === 'kote' ? u.cur : strokeTechOf(P) === 'kote' && u.last?.unique === 'kote' ? u.last : null;
  const L = u.last;
  return L?.unique === 'kote' && L.tEnd != null && u.t - L.tEnd <= LIVE ? L : null;
}

/** 손목 치기 탐침을 판에 건다 (fightOne onRound): 칼날 ↔ 상대 아래팔 물리 닿음 · 칼끼리 새 부딪힘(koteSword 를 부르는 문 — 새 · 충격 > 0) · 굴림 — 모두 그때 살아 있는 손목 치기 긋기(sid)에 매김 */
export function koteProbe({ G, P, A, uq }) {
  const C = G.combat;
  const ev = [];
  const ids = new Map();
  const sidOf = (rec) => (rec ? ids.get(rec) ?? (ids.set(rec, ids.size + 1), ids.size) : null);
  const t = () => r3(G.t / K);
  const strike0 = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const hit = pr.w.fighter === P && pr.v.fighter === A && (pr.v.part === 'farmS' || pr.v.part === 'farmO');
    const cool = hit ? A.hitCooldowns.has(`${P.index}:${pr.v.part}`) : false;
    const tech = hit ? strokeTechOf(P) === 'kote' : false;
    const sid = hit ? sidOf(liveKote(P)) : null;
    const armed = A.armed;
    const r = strike0(pr, point, passing);
    let E = r?.energy;
    if (hit && armed && !r) { const S = P.cache?.sword, Q = A.cache?.parts?.[pr.v.part]; const a = S && Q ? C.analyze(pr, point, S, Q, true) : null; E = a?.energy; } // 판정이 안 난 닿음의 에너지 (예측 셈 — 상처 없음)
    if (hit && armed && sid) ev.push({ t: t(), sid, k: 'arm', part: pr.v.part, grip: !!A.gripping, r: !!r, E: r3(E), sev: r3(r?.severity), type: r?.type ?? null, cool, tech, passing: !!passing });
    return r;
  };
  const ks0 = C.koteSword.bind(C);
  C.koteSword = (Af, Bf, SA, SB, point, nrm, vn) => {
    for (const [att, vic, S, sg] of [[Af.fighter, Bf.fighter, SA, 1], [Bf.fighter, Af.fighter, SB, -1]]) {
      if (att !== P || vic !== A || !vic.armed || !vic.sword || !vic.weaponCfg) continue;
      const sid = sidOf(liveKote(P));
      if (!sid) continue;
      const into = sg * velAt(S, point, _v).dot(nrm);
      const q = vic.sword.rotation();
      const ax = _a.set(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      const o = vic.sword.translation();
      const at = (_v.copy(point).sub(new THREE.Vector3(o.x, o.y, o.z)).dot(ax) - vic.weaponCfg.hiltLength) / vic.weaponCfg.bladeLength;
      ev.push({ t: t(), sid, k: 'clash', vn: r3(vn), into: r3(into), at: r3(at), tech: strokeTechOf(P) === 'kote' });
    }
    return ks0(Af, Bf, SA, SB, point, nrm, vn);
  };
  const kr0 = C.koteRoll.bind(C);
  C.koteRoll = (att, vic, part, kind) => {
    const n0 = C.koteLog?.length ?? 0;
    const sid = att === P ? sidOf(liveKote(P)) : null;
    kr0(att, vic, part, kind);
    const L = C.koteLog ?? [];
    if (L.length > n0) ev.push({ t: t(), sid, k: 'roll', part, kind, drop: !!L.at(-1).drop });
  };
  return { ev, C, uq, ids };
}

/** 한 판 (손목 치기 몫 판) + 탐침 → 판 결과에 kote 칸 (긋기 sid 마다) */
export function rateOne({ school = 'japanese', weapon, opp, seed, dur, tech }) {
  let probe = null;
  const r = fightOne({ school, weapon, opp, seed, dur, tech, focus: 'kote', onRound: (o) => (probe = koteProbe(o)) });
  const K_ = UA.koteDrop;
  const bySid = new Map();
  for (const e of probe.ev) if (e.sid) (bySid.get(e.sid) ?? bySid.set(e.sid, []).get(e.sid)).push(e);
  r.kote = [...bySid.entries()].map(([sid, e]) => {
    const arm = e.filter((x) => x.k === 'arm' && (x.part === 'farmS' || x.grip));
    const half = e.filter((x) => x.k === 'clash' && x.at <= K_.swordHalf);
    const rolls = e.filter((x) => x.k === 'roll');
    return {
      sid, t: e[0].t,
      land: arm.length > 0 || half.length > 0, landArm: arm.length > 0, landHalf: half.length > 0,
      armE: arm.length ? r3(Math.max(...arm.map((x) => x.E ?? 0))) : null,
      armOld: arm.some((x) => x.r && x.tech), armNew: arm.some((x) => (x.E ?? 0) >= 2), armCut: arm.some((x) => x.r && x.type === 'cut' && x.sev > 0),
      halfVn: half.length ? Math.max(...half.map((x) => x.vn)) : null,
      halfOld: half.some((x) => x.tech && x.vn > 3 && x.into > 0.5), halfNew: half.some((x) => x.vn > 1.5 && x.into > 0.5),
      rolls: rolls.length, drops: rolls.filter((x) => x.drop).length,
      ev: e,
    };
  });
  r.koteStrokes = probe.uq?.stats?.fired?.kote ?? null; // 낸 손목 치기 (고유 공격 강화가 읽은 수)
  const log = probe.C.koteLog ?? [];
  r.koteRolls = log.length; // 판 전체 굴림 · 떨굼 (combat.koteLog)
  r.koteDrops = log.filter((x) => x.drop).length;
  r.unattributed = probe.ev.filter((x) => x.k === 'roll' && !x.sid).length; // 살아 있는 손목 치기 없이 난 굴림 (0 이어야)
  return r;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
/** 깔때기 묶음 */
export function funnel(runs) {
  const ks = runs.flatMap((r) => r.kote ?? []);
  const L = ks.filter((k) => k.land);
  const c = (a, f) => a.filter(f).length;
  return {
    runs: runs.length, strokes: runs.reduce((s, r) => s + (r.koteStrokes ?? 0), 0),
    land: L.length, landArm: c(L, (k) => k.landArm), landHalf: c(L, (k) => k.landHalf),
    armOld: c(L, (k) => k.armOld), armNew: c(L, (k) => k.armNew), halfOld: c(L, (k) => k.halfOld), halfNew: c(L, (k) => k.halfNew),
    gateOld: c(L, (k) => k.armOld || k.halfOld), gateNew: c(L, (k) => k.armNew || k.halfNew),
    rolled: c(L, (k) => k.rolls > 0), dropped: c(L, (k) => k.drops > 0),
    koteDrops: runs.reduce((s, r) => s + (r.koteDrops ?? 0), 0), dropFights: runs.filter((r) => (r.koteDrops ?? 0) > 0).length, unattr: runs.reduce((s, r) => s + (r.unattributed ?? 0), 0),
    win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length,
  };
}
export function funnelMarkdown(groups) {
  const out = ['| 묶음 | 판 | 낸 손목 치기 | 닿음 (아래팔 · 칼 손 쪽 절반) | 아래팔 | 칼 반쪽 | 10/24 문 통과 (아래팔 6 J · 기술 창 0.2 s / 칼 3 m/s) | 11/05 문 통과 (아래팔 2 J / 칼 1.5 m/s · 창 0.4 s) | 굴림 | 떨굼 | **떨굼 / 닿음** | 떨굼 / 낸 수 | 떨군 판 / 판 | 이김 · 짐 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [name, runs] of groups) {
    const F = funnel(runs);
    out.push(`| ${name} | ${F.runs} | ${F.strokes} | ${F.land} (${pct(F.land, F.strokes)}) | ${F.landArm} | ${F.landHalf} | ${F.gateOld} (${pct(F.gateOld, F.land)}) | ${F.gateNew} (${pct(F.gateNew, F.land)}) | ${F.rolled} | ${F.dropped}${F.unattr ? ` (+${F.unattr} 매김 없음)` : ''} | **${pct(F.dropped, F.land)}** | ${pct(F.dropped, F.strokes)} | ${F.dropFights} / ${F.runs} | ${F.win} · ${F.lose} |`);
  }
  return out.join('\n');
}

// ── 줍기 재기 ──
//  pick   : 사람 몸(손가락 봇 — fightOne) 칼을 판 시작 dropAt 실제 s 뒤에 떨굼(dropSword — 손목 치기 떨굼과 같은 길) → 봇은 react 실제 s 뒤 제 칼로 걸어가
//           (스틱 = 몸 틀 앞 · 옆 몫) 'block' 이면 주울 수 있을 때(단추 글 '줍기' — pickupReady) 막기 단추 · 'auto' 면 걷기만 · 0 = 줍기 끔(견줌 — 그대로 맞섬)
//  aipick : 상대 AI 칼을 dropAt 에 떨굼 · PICKUP.ai 1 이면 AI 가 걸어가 주움 (봇은 보통대로 침)
//  PK_TRACE=1 : 칼이 한 스텝에 0.1 m 넘게 옮긴 때 · 0.25 s 마다 줍기 상태를 stderr 로
//  --dropAt=none : 억지로 떨구지 않고 저절로 놓친 첫 때부터 (예: --set=UNIQUE_ASSIST.koteDrop.ai=1 + 일본 AI 상대 — AI 손목 치기가 나를 떨굼)
//  11/16 (줍기 거리 — docs/strike/pickup_reach_2026-11-16.md): --aim=grip|sword (사람 봇이 칼자루로 · 눈에 보이는 칼로 — 아래 pickOne) · --near=0.45 · --giveUp=0.6 · --focus=kote (aipick 에서 일본 봇이 손목 치기만)
//   둘째 표(whyMarkdown) = 칼이 멈춘 자리 · 누름 마디 · 첫 누름에 시작 · 누른 채 막힌 까닭(pickupReady 문 차례) · 쥘 때 손 ↔ 칼자루 · 시작 거리 · 내디딤
//  잰 것: 다시 쥠까지(실제 s) · 줍는 동작(굽힘 ~ 쥠) · 그동안 받은 칼날 심각도 · 의식 · 맞음 수 · 넘어짐 · 상대 공격 시작 수 · 한 스텝 칼 옮김 최대(순간이동 검사) ·
//         쥔 뒤 0.6 s(충돌을 켠 뒤) 제 칼 ↔ 제 몸통 · 허벅지 닿음(제 몸 충돌) · 쥔 뒤 0.6 s 칼이 상대에게 낸 판정(상처 · 둔타) · 값 깨짐(NaN) · 판 결과
import { pickupReady, canPickup, swordSettled, swordReachDist } from '../../src/pickup.js';
const _sb = new THREE.Vector3();
/** 골반에서 칼(칼자루 ~ 칼끝 선분 — 눈에 보이는 칼 전체)의 가장 가까운 점 (수평) → { x, z, d } (11/16 줍기 거리 재기) */
export function swordNearest(f) {
  const p = f.bodies.pelvis.translation(), a = f.sword.translation(), b = f.bladePoint(1, _sb);
  const ux = b.x - a.x, uz = b.z - a.z, L2 = ux * ux + uz * uz;
  const u = L2 > 1e-9 ? Math.min(1, Math.max(0, ((p.x - a.x) * ux + (p.z - a.z) * uz) / L2)) : 0;
  const x = a.x + ux * u, z = a.z + uz * u;
  return { x, z, d: Math.hypot(x - p.x, z - p.z), u };
}
/** 줍기 누름이 시작을 못 한 까닭 (pickupReady 의 문 차례 그대로 — 처음 막힌 문) (11/16) */
export function pickupWhyNot(f) {
  const PU = CONFIG.PICKUP;
  if (!f.alive) return 'dead';
  if (f.state !== 'stand') return 'down';
  if (f.revival) return 'revive';
  if (f.severedLimbs?.has('armS') || !(f.limbs.armS >= CONFIG.VITALS.dropSwordArm)) return 'arm';
  if (f.stamina?.exhausted) return 'tired';
  if (f.iai || f.rdWind) return 'busy';
  if (!swordSettled(f)) return 'settle';
  const d = swordReachDist(f);
  if (!Number.isFinite(d)) return 'high';
  if (d > PU.reach) return 'reach';
  return 'ok';
}
//  aim (사람 봇이 어디로 걷나 — 11/16 사장님 '칼 줍는 기능이 잘 안쓰게 돼' 재기):
//   'grip'  = 11/05 봇 그대로 — 칼자루까지 reach × 0.75 안으로 걸어가 단추 글이 '줍기'(pickupReady)일 때만 누름 (칼자루 자리를 아는 봇)
//   'sword' = 사람 흉내 — 눈에 보이는 칼(칼자루 ~ 칼끝)에서 가장 가까운 자리로 걸어가 그 자리가 골반 near m 안이면 섬 · 단추 글과 상관없이 막기 단추를 누른 채 ·
//             누른 채 giveUp 실제 s 지나도 줍기가 안 시작되면 칼자루 쪽으로 걸음(누른 채 — 사람이 '손잡이 쪽이구나' 알아차림)
export function pickOne({ school, weapon, opp, seed, dur = 20, tech = 0.35, dropAt = 6, mode = 'block', react = 0.22, who = 'P', window = 4, aim = 'grip', near = 0.45, giveUp = 0.6, focus = null }) {
  const PU = CONFIG.PICKUP;
  const keep = { mode: PU.mode, ai: PU.ai };
  if (who === 'P') PU.mode = mode; else PU.ai = mode ? 1 : 0;
  let G, P, A, X, tOpen = null, td = null, ta = null, prevS = null, cons0 = null, armT = null, arrived = null, pressPrev = false, pDrop = null;
  const m = { seed, cell: `${school}:${weapon}:${opp}`, who, mode, aim, dropT: null, rearm: null, motion: null, sev: 0, cons: 0, hits: 0, falls: 0, foeAtk: 0, maxStep: 0, selfTouch: 0, attachWound: 0, nan: false, swordDist: null, log: null, end: null,
    land: null, tries: 0, triesOk: 0, firstWhy: null, failT: {}, failReach: [] }; // 11/16: land = 칼이 처음 멈춘(settle 밑 · 골반 밑) 때 몸 기준 자리 · tries = 누름 마디 · failT = 누른 채 못 시작한 실제 초 (까닭별) · failReach = 'reach' 로 막힌 누름 마디 첫 거리
  const own = () => ['pelvis', 'abdomen', 'chest', 'thighF', 'thighB'].map((k) => X.bodies[k].collider(0));
  const stick = (dx, dz, k) => { const d = Math.hypot(dx, dz) || 1, F = P.forward(), R = P.right(); return { sx: ((dx * R.x + dz * R.z) / d) * k, sy: ((dx * F.x + dz * F.z) / d) * k }; };
  const botHook = ({ t }) => {
    if (who !== 'P' || td == null || P.armed || !P.alive || !PU.mode) return null;
    if (t < td + react) return { sx: 0, sy: 0, guardPress: false };
    if (!canPickup(P)) return { sx: 0, sy: 0, guardPress: false };
    const p = P.bodies.pelvis.translation(), g = P.sword.translation();
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
    const blk = PU.mode === 'block';
    if (aim === 'sword') {
      if (P.pickup) return { sx: 0, sy: 0, guardPress: blk };
      const N = swordNearest(P);
      if (arrived == null && N.d <= near) arrived = t;
      if (arrived == null) return { ...stick(N.x - p.x, N.z - p.z, 0.9), guardPress: false };
      if (t - arrived < giveUp || d <= PU.reach * 0.75) return { sx: 0, sy: 0, guardPress: blk };
      return { ...stick(dx, dz, 0.6), guardPress: blk };
    }
    if (P.pickup || d <= PU.reach * 0.75) return { sx: 0, sy: 0, guardPress: blk && (!!P.pickup || pickupReady(P)) };
    return { ...stick(dx, dz, 0.9), guardPress: false };
  };
  const onRound = (o) => {
    ({ G, P, A } = o);
    X = who === 'P' ? P : A;
    const step0 = G.step;
    G.step = () => {
      if (tOpen == null && !P.openHold) tOpen = G.t;
      if (dropAt != null && td == null && tOpen != null && (G.t - tOpen) / K >= dropAt && X.alive && X.armed && X.state === 'stand' && P.alive && A.alive) {
        X.dropSword();
        td = G.t / K; m.dropT = r3(td); cons0 = X.consciousness;
        pDrop = { ...X.bodies.pelvis.translation() };
      }
      const wasArmed = X.armed, st0 = X.state, mode0 = G.ai.mode, cons1 = X.consciousness, tB = G.t;
      step0();
      if (dropAt == null && td == null && wasArmed && !X.armed && X.alive) { td = G.t / K; m.dropT = r3(td); cons0 = cons1; m.cause = (G.combat.koteLog ?? []).some((x) => x.drop && x.vic === X.index) ? 'kote' : 'arm'; pDrop = { ...X.bodies.pelvis.translation() }; } // 저절로 놓침 (AI 손목 치기 · 팔 다침)
      if (td == null) return;
      const s = X.sword.translation();
      if (![s.x, s.y, s.z].every(Number.isFinite)) m.nan = true;
      if (prevS && ta == null) m.maxStep = Math.max(m.maxStep, Math.hypot(s.x - prevS.x, s.y - prevS.y, s.z - prevS.z));
      if (process.env.PK_TRACE && prevS && Math.hypot(s.x - prevS.x, s.y - prevS.y, s.z - prevS.z) > 0.1) console.error('JUMP', r3(G.t / K), r3(Math.hypot(s.x - prevS.x, s.y - prevS.y, s.z - prevS.z)), 'phase', X.pickup?.phase ?? '-', 'armed', X.armed, X.state, 'foeD', r3(X.foeDistance()), 'swY', r3(s.y));
      if (process.env.PK_TRACE && ta == null && Math.round(G.t / K * 4) !== Math.round((G.t - 1 / 120) / K * 4)) { const p = X.bodies.pelvis.translation(); console.error('TR', r3(G.t / K), X.state, 'can', canPickup(X), 'ready', pickupReady(X), 'reach', r3(Math.hypot(s.x - p.x, s.z - p.z)), 'swY', r3(s.y), 'pelY', r3(p.y), 'v', r3(Math.hypot(X.sword.linvel().x, X.sword.linvel().y, X.sword.linvel().z)), 'mv', r3(X.move.x), r3(X.move.y), 'press', !!X.pickupPress, 'ph', X.pickup?.phase ?? '-', 'armS', r3(X.limbs.armS), 'exh', !!X.stamina.exhausted); }
      prevS = { x: s.x, y: s.y, z: s.z };
      if (m.swordDist == null && X.sword.linvel().y > -0.05 && G.t / K > td + 0.6) { const p = X.bodies.pelvis.translation(); m.swordDist = r3(Math.hypot(s.x - p.x, s.z - p.z)); }
      // 11/16: 칼이 처음 멈춘 때(줍기 문 settle 밑 · 칼자루가 골반 밑) 몸 기준 자리 — 칼자루 · 칼 무게중심 · 칼에서 가장 가까운 점 거리 · 떨군 때 골반 자리에서 칼자루(drop — 몸이 움직인 몫 뺌) · 칼자루 방향(0° = 앞 · + = 오른쪽)
      if (m.land == null && ta == null && !X.armed && swordSettled(X) && Number.isFinite(swordReachDist(X))) {
        const p = X.bodies.pelvis.translation(), c = X.sword.worldCom?.() ?? s, F = X.forward(), R = X.right(), gx = s.x - p.x, gz = s.z - p.z;
        m.land = { t: r3(G.t / K - td), grip: r3(Math.hypot(gx, gz)), com: r3(Math.hypot(c.x - p.x, c.z - p.z)), near: r3(swordNearest(X).d), drop: pDrop ? r3(Math.hypot(s.x - pDrop.x, s.z - pDrop.z)) : null, ang: Math.round((Math.atan2(gx * R.x + gz * R.z, gx * F.x + gz * F.z) * 180) / Math.PI) };
      }
      // 11/16: 누름 진단 — 누른 채(사람 = 봇 막기 단추 · AI = aiPickup 누름) 이 스텝에 줍기가 시작되지 않았으면 처음 막힌 문을 셈 · 누름 마디(눌렀다 뗌)마다 첫 까닭
      if (X.pickup && !X._pkSeen) { // 11/16: 줍기 시작 때 칼자루 방향(몸 기준 0° = 앞 · + = 오른쪽)
        X._pkSeen = true;
        const p = X.bodies.pelvis.translation(), F = X.forward(), R = X.right(), gx = s.x - p.x, gz = s.z - p.z;
        (m.startAng ??= []).push(Math.round((Math.atan2(gx * R.x + gz * R.z, gx * F.x + gz * F.z) * 180) / Math.PI));
      } else if (!X.pickup) X._pkSeen = false;
      const press = !!X.pickupPress && !X.armed && ta == null && X.alive;
      if (press && !pressPrev) { m.tries++; X._tryWhy = null; X._tryOk = false; }
      if (press) {
        if (X.pickup) { if (!X._tryOk) { X._tryOk = true; m.triesOk++; } if (m.firstWhy == null) m.firstWhy = 'ok'; }
        else {
          const why = pickupWhyNot(X);
          m.failT[why] = (m.failT[why] ?? 0) + (G.t - tB) / K;
          if (m.firstWhy == null) m.firstWhy = why;
          if (X._tryWhy == null) { X._tryWhy = why; if (why === 'reach') m.failReach.push(r3(swordReachDist(X))); }
        }
      }
      pressPrev = press;
      const inWin = ta == null && G.t / K <= td + window;
      if (inWin) {
        if (st0 === 'stand' && X.state !== 'stand' && X.alive) m.falls++;
        if (who === 'P' && G.ai.mode === 'attack' && mode0 !== 'attack') m.foeAtk++;
      }
      if (!wasArmed && X.armed && ta == null) { ta = G.t / K; m.rearm = r3(ta - td); armT = G.t; m.cons = r3(Math.max(0, cons0 - X.consciousness)); }
      if (armT != null && G.t - armT <= 0.6 * K && !X.pickup) for (const sc of X.swordColliders) for (const oc of own()) G.world.contactPair(sc, oc, (mf) => { for (let j = 0; j < mf.numContacts(); j++) if (mf.contactDist(j) < 0.002) m.selfTouch++; });
    };
    G.onWound = (att, vic, r) => {
      if (td == null) return;
      const t = G.t / K;
      if (vic === X && att !== X && (ta == null ? t <= td + window : false)) { m.sev += r.type === 'blunt' ? 0 : r.severity ?? 0; if ((r.severity ?? 0) > 0) m.hits++; }
      if (att === X && armT != null && G.t - armT <= 0.6 * K) { m.attachWound++; (m.attachW ??= []).push([r.zone, r.type, r3(r.energy), r3(r.severity), r3((G.t - armT) / K)]); }
      if (vic === X && att !== X && td != null && (ta == null ? G.t / K <= td + window : false)) (m.hitW ??= []).push([r.zone, r.type, r3(r.energy), r3(r.severity), r3(G.t / K - td)]);
    };
  };
  let r;
  try {
    r = fightOne({ school, weapon, opp, seed, dur, tech, onRound, botHook, ...(focus ? { focus } : {}) });
  } finally {
    PU.mode = keep.mode; PU.ai = keep.ai;
  }
  if (cons0 != null && m.rearm == null) m.cons = r3(Math.max(0, cons0 - X.consciousness));
  m.sev = r3(m.sev);
  for (const k in m.failT) m.failT[k] = r3(m.failT[k]);
  m.maxStep = r3(m.maxStep);
  m.log = X.pickupLog ?? null;
  m.motion = m.log?.find((x) => x.ok) ? r3((m.log.find((x) => x.ok).t1 - m.log.find((x) => x.ok).t0) / K) : null;
  m.end = { win: r.win, lose: r.lose, T: r.T, alive: X.alive, armed: X.armed };
  m.koteOnMe = (G.combat.koteLog ?? []).filter((x) => x.vic === X.index).map((x) => ({ t: r3(x.t / K), part: x.part, kind: x.kind, drop: x.drop })); // 나에게 난 손목 치기 굴림 (AI 손목 치기 — koteDrop.ai 1)
  return m;
}
export function pickMarkdown(groups) {
  const q = (a, p) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
  const f2 = (x) => (x == null ? '–' : x.toFixed(2));
  const out = ['| 묶음 | 판 | 떨굼 | 다시 쥠 | 다시 쥠까지 실제 s (가운데 · 90 %) | 줍는 동작 실제 s (가운데) | 떨굼 → 쥠(또는 4 s) 받은 심각도/판 | 받은 맞음/판 | 의식/판 | 넘어짐 | 상대 공격 시작/판 | 칼 한 스텝 최대 m | 제 몸 닿음 스텝 | 쥔 뒤 0.6 s 판정 | NaN | 떨어진 칼 거리 (가운데) | 나에게 손목 치기 굴림 · 떨굼 | 이김 · 짐 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [name, ms] of groups) {
    const D = ms.filter((x) => x.dropT != null), n = D.length || 1;
    const R = D.filter((x) => x.rearm != null);
    out.push(`| ${name} | ${ms.length} | ${D.length} | ${R.length} | ${f2(q(R.map((x) => x.rearm), 0.5))} · ${f2(q(R.map((x) => x.rearm), 0.9))} | ${f2(q(R.map((x) => x.motion), 0.5))} | ${f2(D.reduce((s, x) => s + x.sev, 0) / n)} | ${f2(D.reduce((s, x) => s + x.hits, 0) / n)} | ${f2(D.reduce((s, x) => s + (x.cons ?? 0), 0) / n)} | ${D.reduce((s, x) => s + x.falls, 0)} | ${f2(D.reduce((s, x) => s + x.foeAtk, 0) / n)} | ${f2(Math.max(0, ...D.map((x) => x.maxStep)))} | ${D.reduce((s, x) => s + x.selfTouch, 0)} | ${D.reduce((s, x) => s + x.attachWound, 0)} | ${D.filter((x) => x.nan).length} | ${f2(q(D.map((x) => x.swordDist), 0.5))} | ${ms.reduce((s, x) => s + (x.koteOnMe?.length ?? 0), 0)} · ${ms.reduce((s, x) => s + (x.koteOnMe?.filter((k) => k.drop).length ?? 0), 0)} | ${ms.filter((x) => x.end.win).length} · ${ms.filter((x) => x.end.lose).length} |`);
  }
  return out.join('\n');
}

/** 11/16 줍기 거리 재기 표: 칼이 멈춘 자리(몸 기준) · 누름 마디 · 첫 누름 성공 몫 · 누른 채 막힌 까닭(실제 초) · 줍기 기록의 그만둠 · 쥘 때 손 ↔ 칼자루 */
export function whyMarkdown(groups) {
  const q = (a, p) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
  const f2 = (x) => (x == null ? '–' : x.toFixed(2));
  const within = (a, r) => (a.length ? `${Math.round((100 * a.filter((x) => x <= r).length) / a.length)}%` : '–');
  const out = ['| 묶음 | 떨굼 | 멈춘 칼자루 거리 (가운데 · 90 %) | ≤ 0.6 · ≤ 0.9 m | 떨군 자리에서 (가운데 · ≤ 0.6 · ≤ 0.9) | 칼 무게중심 거리 (가운데) | 칼 가까운 점 (가운데) | 칼자루 방향 앞 · 옆 · 뒤 | 누름 마디 | 첫 누름에 시작 | 막힌 까닭 (누른 채 실제 s 합) | reach 로 막힌 마디 첫 거리 (가운데) | 그만둠 (줍기 기록) | 쥘 때 손 ↔ 칼자루 (가운데 · 90 %) | 시작 거리 (가운데 · 90 %) · 0.6 넘음 | 내디딤 | 시작 때 칼자루 앞 · 옆 · 뒤 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---|---:|---:|---:|---:|'];
  for (const [name, ms] of groups) {
    const D = ms.filter((x) => x.dropT != null);
    const L = D.map((x) => x.land).filter(Boolean);
    const g = L.map((x) => x.grip);
    const ang = L.map((x) => Math.abs(x.ang));
    const fail = {};
    for (const x of D) for (const [k, v] of Object.entries(x.failT ?? {})) fail[k] = (fail[k] ?? 0) + v;
    const first = D.filter((x) => x.firstWhy != null);
    const quit = {};
    for (const x of D) for (const e of x.log ?? []) if (!e.ok) quit[e.why] = (quit[e.why] ?? 0) + 1;
    const hand = D.flatMap((x) => (x.log ?? []).filter((e) => e.hand != null).map((e) => e.hand));
    const st = D.flatMap((x) => (x.log ?? []).filter((e) => e.hand != null)); // 쥔 줍기 (11/16 — 시작 거리 · 내디딤)
    const sa = D.flatMap((x) => (x.startAng ?? []).map(Math.abs));
    out.push(`| ${name} | ${D.length} | ${f2(q(g, 0.5))} · ${f2(q(g, 0.9))} | ${within(g, 0.6)} · ${within(g, 0.9)} | ${f2(q(L.map((x) => x.drop), 0.5))} · ${within(L.map((x) => x.drop).filter((x) => x != null), 0.6)} · ${within(L.map((x) => x.drop).filter((x) => x != null), 0.9)} | ${f2(q(L.map((x) => x.com), 0.5))} | ${f2(q(L.map((x) => x.near), 0.5))} | ${ang.filter((a) => a <= 45).length} · ${ang.filter((a) => a > 45 && a < 135).length} · ${ang.filter((a) => a >= 135).length} | ${D.reduce((s, x) => s + (x.tries ?? 0), 0)} | ${first.filter((x) => x.firstWhy === 'ok').length} / ${first.length} | ${Object.entries(fail).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ') || '–'} | ${f2(q(D.flatMap((x) => x.failReach ?? []), 0.5))} | ${Object.entries(quit).map(([k, v]) => `${k} ${v}`).join(' · ') || '–'} | ${f2(q(hand, 0.5))} · ${f2(q(hand, 0.9))} | ${f2(q(st.map((e) => e.reach), 0.5))} · ${f2(q(st.map((e) => e.reach), 0.9))} · ${st.filter((e) => e.reach > 0.6).length} | ${st.filter((e) => e.step > 0).length} | ${sa.filter((a) => a <= 45).length} · ${sa.filter((a) => a > 45 && a < 135).length} · ${sa.filter((a) => a >= 135).length} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const files = rest.filter((x) => !x.startsWith('--'));
    const groups = new Map();
    for (const p of files) { const J = JSON.parse(readFileSync(p, 'utf8')); const g = J.tag || p; groups.set(g, [...(groups.get(g) ?? []), ...J.runs]); }
    console.log(funnelMarkdown([...groups]));
  } else if (mode === 'rate') {
    applySets(arg('set', ''));
    const cells = arg('cells', 'japanese:uchigatana:longsword,japanese:uchigatana:uchigatana').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = rateOne({ school, weapon, opp, seed, dur: +arg('dur', 30), tech: +arg('tech', 0.6) });
        delete r.fires; delete r.wants; delete r.acts;
        r.cell = c;
        runs.push(r);
        console.error(JSON.stringify({ c, seed, kote: r.kote.length, land: r.kote.filter((k) => k.land).length, drops: r.kote.filter((k) => k.drops).length, ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set: arg('set', ''), cells, seeds, runs }));
    console.log(funnelMarkdown([[arg('tag', 'run'), runs]]));
  } else if (mode === 'pick' || mode === 'aipick') {
    applySets(arg('set', ''));
    const cells = arg('cells', 'german:longsword:longsword,japanese:uchigatana:longsword').split(',');
    const seeds = range(arg('seeds', '1-8'));
    const pm = arg('mode', 'block');
    const ms = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = pickOne({ school, weapon, opp, seed, dur: +arg('dur', 20), tech: +arg('tech', 0.35), dropAt: arg('dropAt', '6') === 'none' ? null : +arg('dropAt', 6), mode: pm === '0' ? 0 : pm, who: mode === 'pick' ? 'P' : 'A', aim: arg('aim', 'grip'), near: +arg('near', 0.45), giveUp: +arg('giveUp', 0.6), focus: arg('focus', null) });
        ms.push(r);
        console.error(JSON.stringify({ c, seed, rearm: r.rearm, sev: r.sev, falls: r.falls, ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), mode: pm, who: mode, runs: ms }));
    console.log(pickMarkdown([[arg('tag', `${mode} ${pm}`), ms]]));
    console.log('\n' + whyMarkdown([[arg('tag', `${mode} ${pm}`), ms]]));
  } else if (mode === 'pickagg') {
    const groups = new Map();
    for (const p of rest.filter((x) => !x.startsWith('--'))) { const J = JSON.parse(readFileSync(p, 'utf8')); const g = J.tag || p; groups.set(g, [...(groups.get(g) ?? []), ...J.runs]); }
    console.log(pickMarkdown([...groups]));
    console.log('\n' + whyMarkdown([...groups]));
  } else console.log('modes: rate | agg | pick | aipick | pickagg');
}
