// 생사전 규칙 (사장님 10/29 14:1x · 14:2x · 14:5x — 설계 docs/design/saengsa_2026-10-29.md): 대진표 만들기 · 경기 시각 · 상대끼리 경기 저절로 끝내기 · 기권 · 출전 고르기 ·
//  빠른 셈 · 결과 적기 · 쉬는 동안 회복 · 왕의 하사품.
//  순수 함수 — 인물 · 무기 자료는 부르는 쪽이 넘긴다(src/saengsa_roster.js · 시험 tools/sim/saengsa.test.mjs 는 가짜 자료). 값은 config.js SAENGSA 한 곳.
//  대회 t = { v, day, seed, signedAt, teams: [{ mine, members: [사람] }], matches: [경기], status 'active' | 'done', champion, endedAt, chests }
//   사람 = { key '팀-자리', id(인물 id · 'player'), weapon, school(그 무기 유파), tier(무기 등급), prof { german … chinese, none }, lent(내 무기를 빌림), hp, injuries [부상], dead }
//   부상 = { part 'arm' | 'leg' | 'torso' | 'head', sev(상처 심각도 — combat.js 와 같은 잣대), rests(다친 뒤 쉰 수) } · 중상 = sev ≥ SAENGSA.seriousAt
//   팀 0 = 내 팀(자리 0 = 나) · 대진표 자리는 씨앗으로 섞는다 · 첫 대진 경기만 a · b(팀 번호)를 적고, 다음 대진은 앞 두 경기의 이긴 팀(sidesOf).
//  경기 = { id 'r<대진>m<번호>', round, index, a, b, result } · 결과 = { at(저장 시각), winner 'a' | 'b', entrants { a: [key], b: [key] }, fighters { key: { hp, injuries, alive } },
//   by 'quick' | 'engine' | 'forfeit', seed, ver, pre { a: [사람], b: [사람] } } — seed · entrants · pre(경기 전 두 팀) · ver 는 2단계 다시보기 몫(사장님 10/29 14:5x — 같은 씨앗 · 같은 판으로 다시 셈).
//   2단계 엔진(실제 2:2 싸움)도 같은 꼴을 돌려준다(matchSetup → 엔진 → finishMine · 설계 §8).
import { SAENGSA } from './config.js';
import { roundAt, restUntil, startAt, signupWindow, windowOf, shiftDay } from './saengsa_clock.js';

export const SCHOOLS5 = Object.freeze(['german', 'italian', 'iberian', 'japanese', 'chinese']);
export const INJURY_PARTS = Object.freeze(['arm', 'leg', 'torso', 'head']);
/** 저장한 결과의 판 (다시보기가 같은 셈인지 가린다 — 빠른 셈 · 엔진 셈이 바뀌면 올린다) */
export const SAENGSA_VER = 'saengsa-1';

// ── 씨앗 난수 (게임 난수 Math.random 을 건드리지 않는다) ──
/** 글 · 수 묶음 → 32 비트 씨앗 (FNV-1a) */
export function hash32(...xs) {
  let h = 0x811c9dc5;
  for (const ch of xs.join('|')) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** 씨앗 → [0, 1) 난수 (mulberry32) */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOne = (r, list) => list[Math.min(list.length - 1, Math.floor(r() * list.length))];
function shuffle(r, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 대진표 팀 수 = SAENGSA.teams 를 2 의 거듭제곱으로 내림 (2 이상) */
export const bracketTeams = (cfg = SAENGSA) => 2 ** Math.floor(Math.log2(Math.max(2, Math.floor(cfg.teams) || 2)));
/** 대진 수 (16 팀 = 4: 16강 · 8강 · 4강 · 결승) */
export const roundsOf = (teamCount) => Math.round(Math.log2(teamCount));

/**
 * 신청 → 대회 하나 (씨앗이 같으면 바이트까지 같은 대회).
 *  companions: 동료 인물 id 둘 · roster: 상대 팀을 뽑을 인물 id 목록(내 동료는 뺀다 — 모자라면 상대 팀끼리 겹친다 · 한 팀 안에서는 안 겹침)
 *  lend: { weapon, to: 팀 자리 0 ~ 2 } | null — 빌려 준 사람은 늘 그 무기 · 나머지는 drawWeapon(rnd) 무작위
 *  weaponInfo(id) → { school, tier } · profOf(인물 id) → { german … chinese, none }
 */
export function createTournament({ day, seed, at, companions, roster, lend = null, drawWeapon, weaponInfo, profOf, cfg = SAENGSA }) {
  const n = bracketTeams(cfg), size = cfg.teamSize, r = rng(seed);
  const fighter = (team, slot, id, lendWeapon = null) => {
    const weapon = lendWeapon ?? drawWeapon(r);
    const { school, tier } = weaponInfo(weapon);
    return { key: `${team}-${slot}`, id, weapon, school, tier, prof: { ...profOf(id) }, lent: !!lendWeapon, hp: cfg.hpMax, injuries: [], dead: false };
  };
  const mineIds = ['player', ...companions].slice(0, size);
  const teams = [{ mine: true, members: mineIds.map((id, s) => fighter(0, s, id, lend && lend.to === s ? lend.weapon : null)) }];
  // 상대 팀: 팀장(첫 자리)은 로스터가 닿는 데까지 서로 다르게 · 나머지 자리는 가장 덜 쓴 인물부터(같으면 씨앗으로) — 한 팀 안에서는 겹치지 않는다
  const order = shuffle(r, roster.filter((id) => !mineIds.includes(id)));
  const used = new Map(order.map((id) => [id, 0]));
  const lineup = Array.from({ length: n - 1 }, (_, i) => [order[i % order.length]]);
  for (const [id] of lineup) used.set(id, used.get(id) + 1);
  for (let s = 1; s < size; s++) {
    for (const l of lineup) {
      const free = order.filter((id) => !l.includes(id));
      const from = free.length ? free : order;
      const least = Math.min(...from.map((id) => used.get(id)));
      const id = pickOne(r, from.filter((x) => used.get(x) === least));
      l.push(id);
      used.set(id, used.get(id) + 1);
    }
  }
  lineup.forEach((ids, i) => teams.push({ mine: false, members: ids.map((id, s) => fighter(i + 1, s, id)) }));
  const seats = shuffle(r, teams.map((_, i) => i)); // 대진표 자리 → 팀 번호
  const matches = [];
  for (let rd = 0; rd < roundsOf(n); rd++) {
    for (let i = 0; i < n >> (rd + 1); i++) matches.push({ id: `r${rd}m${i}`, round: rd, index: i, a: rd ? null : seats[2 * i], b: rd ? null : seats[2 * i + 1], result: null });
  }
  return { v: 1, day, seed: seed >>> 0, signedAt: at, teams, matches, status: 'active', champion: null, endedAt: null, chests: null };
}

// ── 대진표 읽기 ──
export const matchById = (t, id) => t.matches.find((m) => m.id === id) ?? null;
const matchAt = (t, round, index) => t.matches.find((m) => m.round === round && m.index === index) ?? null;
/** 이 경기의 두 팀 [a, b] (팀 번호 · 아직 모르면 null) */
export function sidesOf(t, m) {
  if (!m.round) return [m.a, m.b];
  return [winnerOf(t, matchAt(t, m.round - 1, 2 * m.index)), winnerOf(t, matchAt(t, m.round - 1, 2 * m.index + 1))];
}
/** 이긴 팀 번호 (끝나지 않았으면 null) */
export function winnerOf(t, m) {
  if (!m?.result) return null;
  return sidesOf(t, m)[m.result.winner === 'a' ? 0 : 1];
}
/** 대진표 자리 차례의 팀 번호 (첫 대진 a, b, a, b … — 화면의 '1번 팀' … 이름) */
export const seatOrder = (t) => t.matches.filter((m) => m.round === 0).flatMap((m) => [m.a, m.b]);
/** 그 팀이 이 대진(round) 앞에서 마지막으로 결과를 저장한 시각 (없으면 null) */
function lastResultAt(t, team, round) {
  let at = null;
  for (const m of t.matches) if (m.round < round && m.result && sidesOf(t, m).includes(team)) at = Math.max(at ?? -Infinity, m.result.at);
  return at;
}
/** 이 경기를 시작할 수 있는 시각 = max(대진 시각, 두 팀 저마다 마지막 결과 + 쉬는 시간) · 두 팀을 아직 모르면 null */
export function readyAt(t, m, cfg = SAENGSA) {
  const [A, B] = sidesOf(t, m);
  if (A == null || B == null) return null;
  let at = roundAt(t.day, m.round, cfg);
  for (const team of [A, B]) {
    const last = lastResultAt(t, team, m.round);
    if (last != null) at = Math.max(at, restUntil(last, cfg));
  }
  return at;
}
/** 내 경기 마감 = 다음 신청 창이 열리는 때(대회 날 밤 10시 — 사장님 10/29 14:5x). 이때까지 하지 않은 내 경기는 기권 */
export const deadlineOf = (t, cfg = SAENGSA) => windowOf(shiftDay(t.day, 1), cfg).from;
/** 내 팀이 든 경기인가 */
export const isMine = (t, m) => sidesOf(t, m).includes(0);
/**
 * 경기 상태: 'done' 끝 · 'wait' 앞 경기를 기다림 · 'soon' 시각 전(또는 쉬는 중) · 'ready' 내 경기 — 지금 싸울 수 있음 · 'due' 다음 셈(advance)에 끝남(상대끼리 · 마감 지난 내 경기)
 */
export function matchState(t, m, now, cfg = SAENGSA) {
  if (m.result) return 'done';
  const at = readyAt(t, m, cfg);
  if (at == null) return 'wait';
  if (now < at) return 'soon';
  return isMine(t, m) && now < deadlineOf(t, cfg) ? 'ready' : 'due';
}
/** 내 팀이 떨어졌나 */
export const myTeamOut = (t) => !!t && t.matches.some((m) => m.result && sidesOf(t, m).includes(0) && winnerOf(t, m) !== 0);
/** 내 팀의 다음 경기 (졌거나 대회가 끝났으면 null) */
export function myMatch(t) {
  if (!t || t.status === 'done' || myTeamOut(t)) return null;
  return t.matches.find((m) => !m.result && isMine(t, m)) ?? null;
}

// ── 부상 ──
/** 중상인가 (대회 동안 낫지 않음) */
export const isSerious = (inj, cfg = SAENGSA) => inj.sev >= cfg.seriousAt;
/** 부상 더하기: 같은 부위에 이미 있으면 더 깊은 쪽 심각도로 · 쉰 수는 0 부터 */
function addInjury(list, part, sev) {
  const out = list.map((i) => ({ ...i }));
  const old = out.find((i) => i.part === part);
  if (old) { old.sev = Math.max(old.sev, sev); old.rests = 0; } else out.push({ part, sev, rests: 0 });
  return out;
}
/** 2단계: 실제 싸움 상처(fighter.wounds — { part, severity }) → 부상 (woundMin 아래 긁힘은 뺌 · 몸 부위 → 넷) */
const WOUND_PART = { head: 'head', neck: 'head', chest: 'torso', abdomen: 'torso', pelvis: 'torso', uarmS: 'arm', uarmO: 'arm', farmS: 'arm', farmO: 'arm', thighF: 'leg', thighB: 'leg', shinF: 'leg', shinB: 'leg', footF: 'leg', footB: 'leg' };
export function injuriesFromWounds(prior, wounds, cfg = SAENGSA) {
  let out = (prior ?? []).map((i) => ({ ...i }));
  for (const w of wounds ?? []) {
    const part = WOUND_PART[w.part];
    if (part && w.severity >= cfg.woundMin) out = addInjury(out, part, w.severity);
  }
  return out;
}
/** 한 번 쉼 (이긴 팀 — 경기와 경기 사이): 살아 있는 사람 체력 + restHeal · 경상은 쉰 수 + 1 → lightRests 이면 나음 · 중상은 그대로 (사장님 10/29 14:5x) */
function rest(members, cfg) {
  for (const f of members) {
    if (f.dead) continue;
    f.hp = Math.min(cfg.hpMax, f.hp + cfg.restHeal);
    f.injuries = f.injuries.map((i) => (isSerious(i, cfg) ? i : { ...i, rests: i.rests + 1 })).filter((i) => isSerious(i, cfg) || i.rests < cfg.lightRests);
  }
}

// ── 빠른 셈 ──
/** 한 사람의 힘 (config SAENGSA.quick): 그 무기 유파 숙련도 · 무기 등급 · 남은 체력 · 부상(경상 · 중상) */
export function power(f, cfg = SAENGSA) {
  if (!f || f.dead) return 0;
  const q = cfg.quick;
  const prof = f.prof?.[f.school] ?? 0;
  const hpK = q.hpFloor + (1 - q.hpFloor) * Math.max(0, Math.min(cfg.hpMax, f.hp)) / cfg.hpMax;
  const injK = (f.injuries ?? []).reduce((k, i) => k * (isSerious(i, cfg) ? q.injuryK.serious : q.injuryK.light), 1);
  return (q.profBase + q.profStep * prof) * (q.tierK[f.tier] ?? 1) * hpK * injK;
}
/** 나서는 쪽의 힘 (둘이면 합 × pairK) */
export function sidePower(list, cfg = SAENGSA) {
  const sum = list.reduce((s, f) => s + power(f, cfg), 0);
  return list.length > 1 ? sum * cfg.quick.pairK : sum;
}
/** a 쪽이 이길 확률 */
export function winChance(a, b, cfg = SAENGSA) {
  const pa = sidePower(a, cfg) ** cfg.quick.sharp, pb = sidePower(b, cfg) ** cfg.quick.sharp;
  return pa + pb > 0 ? pa / (pa + pb) : 0.5;
}
/**
 * 빠른 셈 한 판 (씨앗 고정 — 같은 입력 · 같은 씨앗이면 늘 같은 결과): sides { a: [사람], b: [사람] } → { winner, fighters: { key: { hp, injuries, alive } } }
 *  진 쪽은 loseDmg · 이긴 쪽은 winDmg × (0.5 + 0.5 × 팽팽함) 만큼 체력을 잃고 · 경기마다 injury 확률로 새 부상 하나(심각도 injurySev) · 체력 0 = 죽음.
 *  이긴 쪽은 적어도 한 사람이 산다(모두 0 이 되면 남은 체력이 가장 많던 사람이 체력 1 로)
 */
export function quickResolve(sides, seed, cfg = SAENGSA) {
  const q = cfg.quick, r = rng(seed);
  const pa = winChance(sides.a, sides.b, cfg);
  const winner = r() < pa ? 'a' : 'b';
  const close = 1 - Math.abs(2 * pa - 1);
  const fighters = {};
  for (const side of ['a', 'b']) {
    const won = side === winner;
    const [lo, hi] = won ? q.winDmg : q.loseDmg;
    for (const f of sides[side]) {
      const dmg = Math.round((lo + (hi - lo) * r()) * (won ? 0.5 + 0.5 * close : 1));
      let injuries = (f.injuries ?? []).map((i) => ({ ...i }));
      if (r() < (won ? q.injury.win : q.injury.lose)) {
        const part = pickOne(r, INJURY_PARTS);
        injuries = addInjury(injuries, part, Math.round((q.injurySev[0] + (q.injurySev[1] - q.injurySev[0]) * r()) * 100) / 100);
      }
      const hp = Math.max(0, f.hp - dmg);
      fighters[f.key] = { hp, injuries, alive: hp > 0 };
    }
  }
  const team = sides[winner];
  if (team.length && team.every((f) => !fighters[f.key].alive)) {
    const best = team.reduce((x, y) => (y.hp > x.hp ? y : x));
    fighters[best.key] = { ...fighters[best.key], hp: 1, alive: true };
  }
  return { winner, fighters };
}
/** 상대 팀이 내보낼 사람 (가린 채 고름 — 내 고름을 보지 않는다 · 사장님 10/29 14:5x): 체력 aiPairHp 이상이 둘 이상이면 가장 센 둘 · 아니면 가장 센 하나 */
export function aiPick(members, cfg = SAENGSA) {
  const alive = members.filter((f) => !f.dead).sort((x, y) => power(y, cfg) - power(x, cfg) || (x.key < y.key ? -1 : 1));
  const fit = alive.filter((f) => f.hp >= cfg.aiPairHp);
  return (fit.length >= 2 ? fit.slice(0, cfg.entrantsMax) : alive.slice(0, 1)).map((f) => f.key);
}

// ── 결과 적기 ──
/**
 * 결과를 대회에 적는다: 경기 결과(다시보기 몫 seed · ver · 경기 전 두 팀 pre 와 함께) · 두 팀 사람 상태(체력 · 부상 · 죽음) ·
 *  이긴 팀은 다음 경기까지 한 번 쉰다(rest) · 결승이면 대회 끝
 */
export function applyResult(t, m, { winner, fighters, entrants, by = 'quick' }, at, cfg = SAENGSA) {
  const [A, B] = sidesOf(t, m);
  const pre = { a: structuredClone(t.teams[A].members), b: structuredClone(t.teams[B].members) };
  m.result = { at, winner, entrants: { a: [...entrants.a], b: [...entrants.b] }, fighters: structuredClone(fighters), by, seed: hash32(t.seed, m.id), ver: SAENGSA_VER, pre };
  for (const team of [A, B]) {
    for (const f of t.teams[team].members) {
      const o = fighters[f.key];
      if (!o) continue;
      f.hp = o.hp; f.injuries = o.injuries.map((i) => ({ ...i })); f.dead = !o.alive;
    }
  }
  const W = winner === 'a' ? A : B;
  if (m.round < roundsOf(t.teams.length) - 1) rest(t.teams[W].members, cfg);
  else { t.status = 'done'; t.champion = W; t.endedAt = at; }
  return m.result;
}
const membersOf = (t, team, keys) => keys.map((k) => t.teams[team].members.find((f) => f.key === k)).filter(Boolean);
/**
 * 지금까지 끝날 경기를 저절로 끝낸다 (대진 차례대로): 상대끼리 경기 = 빠른 셈(결과 시각 = 그 경기를 시작할 수 있던 시각) ·
 *  마감(deadlineOf)까지 하지 않은 내 경기 = 기권(결과 시각 = 마감과 시작할 수 있던 시각 중 늦은 쪽 · 체력 · 부상 그대로). 돌려줌: 끝낸 경기 수
 */
export function advance(t, now, cfg = SAENGSA) {
  if (!t || t.status === 'done') return 0;
  const deadline = deadlineOf(t, cfg);
  const dueAt = (m) => {
    const at = readyAt(t, m, cfg);
    if (at == null) return Infinity;
    return isMine(t, m) ? Math.max(at, deadline) : at;
  };
  let n = 0;
  for (;;) {
    const m = t.matches.find((x) => !x.result && dueAt(x) <= now);
    if (!m) break;
    const [A, B] = sidesOf(t, m), at = dueAt(m);
    if (isMine(t, m)) {
      const mineSide = A === 0 ? 'a' : 'b';
      applyResult(t, m, { winner: mineSide === 'a' ? 'b' : 'a', fighters: {}, entrants: { a: [], b: [] }, by: 'forfeit' }, at, cfg);
    } else {
      const entrants = { a: aiPick(t.teams[A].members, cfg), b: aiPick(t.teams[B].members, cfg) };
      const res = quickResolve({ a: membersOf(t, A, entrants.a), b: membersOf(t, B, entrants.b) }, hash32(t.seed, m.id), cfg);
      applyResult(t, m, { ...res, entrants, by: 'quick' }, at, cfg);
    }
    n++;
    if (t.status === 'done') break;
  }
  return n;
}
/** 내가 고른 사람이 맞나 (내 팀 · 살아 있음 · 1 ~ entrantsMax · 겹치지 않음) */
export function validPicks(t, picks, cfg = SAENGSA) {
  if (!Array.isArray(picks) || picks.length < 1 || picks.length > cfg.entrantsMax || new Set(picks).size !== picks.length) return false;
  return picks.every((k) => t.teams[0].members.some((f) => f.key === k && !f.dead));
}
/**
 * 내 경기 판 (2단계 엔진에 넘기는 꼴 — 설계 §8): { matchId, round, seed, mineSide, sides: { a: [사람], b: [사람] }, entrants: { a, b }, control }
 *  control = 'player'(내가 나섬 — 내 몸은 내가 · 함께 나선 동료는 AI) · 'watch'(동료만 — 지켜봄) (사장님 10/29 14:2x · 14:5x).
 *  상대 고름은 여기서(내 고름과 무관 — 가린 채 함께 고르고 입장 때 함께 보임). 지금 싸울 수 없으면(내 경기가 아님 · 시각 전 · 마감 뒤 · 고름이 틀림) null
 */
export function matchSetup(t, m, picks, now, cfg = SAENGSA) {
  if (!m || m.result || myMatch(t)?.id !== m.id || matchState(t, m, now, cfg) !== 'ready' || !validPicks(t, picks, cfg)) return null;
  const [A, B] = sidesOf(t, m), mineSide = A === 0 ? 'a' : 'b', foe = mineSide === 'a' ? B : A;
  const entrants = { [mineSide]: [...picks], [mineSide === 'a' ? 'b' : 'a']: aiPick(t.teams[foe].members, cfg) };
  const team = (side) => (side === 'a' ? A : B);
  return {
    matchId: m.id, round: m.round, seed: hash32(t.seed, m.id), mineSide, entrants,
    sides: { a: structuredClone(membersOf(t, team('a'), entrants.a)), b: structuredClone(membersOf(t, team('b'), entrants.b)) },
    control: picks.includes('0-0') ? 'player' : 'watch',
  };
}
/** 내 경기 결과 적기 (엔진 결과 — 없으면 빠른 셈). 저장 시각 = now (쉬는 시간이 여기서부터 — 사장님 10/29) · 돌려줌: 경기 결과 · 판이 틀리면 null */
export function finishMine(t, m, picks, now, engineResult = null, cfg = SAENGSA) {
  const setup = matchSetup(t, m, picks, now, cfg);
  if (!setup) return null;
  const res = engineResult ?? quickResolve(setup.sides, setup.seed, cfg);
  return applyResult(t, m, { winner: res.winner, fighters: res.fighters, entrants: setup.entrants, by: engineResult ? 'engine' : 'quick' }, now, cfg);
}

// ── 대회 자리 · 하사품 · 일정 ──
/** 내 팀이 오른 자리: 'champion' 우승 · 'final' 준우승 · 'semi' 4강 · 'first' 그 앞 · null 아직 */
export function placeOf(t) {
  if (!t) return null;
  if (t.champion === 0) return 'champion';
  const R = roundsOf(t.teams.length);
  const lost = t.matches.find((m) => m.result && sidesOf(t, m).includes(0) && winnerOf(t, m) !== 0);
  if (!lost) return null;
  return lost.round === R - 1 ? 'final' : lost.round === R - 2 ? 'semi' : 'first';
}
/** 열 수 있는 왕의 하사품 수 (대회가 끝났을 때 · 우승 셋 · 준우승 하나 — 사장님 10/29 14:5x) */
export const chestCount = (t, cfg = SAENGSA) => (t?.status === 'done' ? cfg.chests[placeOf(t)] ?? 0 : 0);
/** 하사품 열기 (씨앗 고정): 하사품마다 표(chestTable)에서 무게로 한 줄 → [{ kind, amount }] — 이미 열었거나 없으면 null */
export function openChests(t, cfg = SAENGSA) {
  const n = chestCount(t, cfg);
  if (!n || t.chests) return null;
  const table = cfg.chestTable, total = table.reduce((s, x) => s + x.weight, 0);
  return Array.from({ length: n }, (_, i) => {
    let u = rng(hash32(t.seed, 'chest', i))() * total;
    const row = table.find((x) => (u -= x.weight) < 0) ?? table[table.length - 1];
    return { kind: row.kind, amount: row.amount };
  });
}
/** 새로 신청할 수 있나: 신청 창이 열렸고 · 대회가 없거나 끝났거나 내 팀이 떨어졌고 · 그 창의 대회에 이미 들지 않았을 때 */
export function canSignUp(now, t, cfg = SAENGSA) {
  const w = signupWindow(now, cfg);
  return w.open && (!t || t.status === 'done' || myTeamOut(t)) && t?.day !== w.day;
}
/**
 * 일정 상태 (대기실 칸 · 생사전 화면 머리줄): kind
 *  'signup' 신청 받는 중(until 창 닫힘) · 'waiting' 신청함 · 첫 대진 전(startAt) · 'running' 대회 진행 중 · 'done' 내 대회 끝 · 'closed' 신청 창 밖(opensAt 다음 창)
 */
export function scheduleState(now, t, cfg = SAENGSA) {
  const w = signupWindow(now, cfg);
  if (t && t.status !== 'done' && !myTeamOut(t)) {
    const s = startAt(t.day, cfg);
    return now < s ? { kind: 'waiting', startAt: s } : { kind: 'running' };
  }
  if (canSignUp(now, t, cfg)) return { kind: 'signup', until: w.to, day: w.day };
  if (t && t.day === w.day && w.open) return { kind: 'waiting', startAt: startAt(t.day, cfg) };
  if (t && t.status !== 'done') return { kind: 'running' };
  return { kind: t ? 'done' : 'closed', opensAt: w.open ? signupWindow(w.to, cfg).from : w.from };
}
