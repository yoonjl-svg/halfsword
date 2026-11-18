// ─────────────────────────────────────────────────────────────
//  lethality_study.mjs — 칼이 얼마나 치명적인가 (11/18 — 사장님 '물리 변화에 의해 공격이 다 세진 거 같은데 맞나. 한방 킬이나 참수가 더 자주 나오는 듯한데' ·
//   기록 docs/strike/lethality_2026-11-18.md). 재기만 한다 — 게임 값은 건드리지 않는다 (--cfg 는 이 도구 판에서만 바꿈).
//  옛 판(11/16 · 11/17 앞)에서도 돌게 이 파일 하나와 harness_m · ai_ring_measure · is_main · src 만 읽는다 (cfg_override.mjs 없는 판이 있어 덮어쓰기를 안에 둠).
//   옛 판 일터에 이 파일을 베껴 넣어 돌린다: cp tools/sim/lethality_study.mjs <일터>/tools/sim/
//
//  run : AI 대 AI 같은 유파 거울 (유파 다섯 × 대표 무기 둘 × 씨앗 × 자리 둘 · 두 자리 LOOKS.enemy · 같은 숙련도 · 60 s · 벽) — strike_physics.mjs runFight 와 같은 판 · 같은 씨앗
//        (seed × 100 + 무기 번호 × 10 + 자리) · 숙련 6 은 두 몸 모두 버팀 PROF6_VITALITY (prof_gap_measure 와 같은 뜻)
//  bot : 사람 손가락 봇(0 번 자리 — special_balance.mjs fightRun 꼴에서 특수 공격 · 고유 강화를 뺀 판: 기본 긋기 열셋 · 15 % 탭 찌르기 · 3 ~ 5.5 패드 m/s ·
//        시작 자리 흔들림 σ 0.06 · 상대 칼이 빠르게 오면 0.15 ~ 0.25 s 뒤 반은 막기 단추 · 반은 맞받아 긋기) 대 AI (같은 무기 · 같은 숙련도) · 60 s
//  판마다 상처 기록(onWound — 맞힌 쪽 · 꼴 · 부위 · 심각도 · 판정 에너지 · 칼날 자리 t · 친 쪽 골반이 상대 쪽으로 드는 빠르기 · 가름 · 가르는 길 · 박힘 · 참수) · 죽음(까닭 · 때 · 그 앞 받은 상처 수)
//  칼이 몸을 지남 · 박힘 · 멈춤: 가르는 길(물리 걸이가 칼을 몸 속으로 보냄)에서 판정 에너지 > 흡수면 지남(계속 휘둘러 감) · ≤ 흡수면 박힘 · 튕긴 길은 멈춤
//  죽음 까닭: 참수(목 '목' + decapitated) · 목 치명(참수 아님) · 머리 치명('머리') · 출혈('출혈') · 기절('기절') · 비김(60 s 둘 다 섬)
//  한 칼 죽음(정의): 진 쪽이 죽을 때까지 받은 칼날 상처(베기 · 찌르기 · 심각도 > 0)가 하나뿐이고 그것으로 죽음 — 즉사 한 칼(그 첫 상처가 목 · 머리 즉사) · 출혈 한 칼(그 하나로 피가 다 빠짐) · 기절은 뺌
//   첫 칼 즉사 = 판 전체의 첫 칼날 상처(어느 쪽이든)가 곧 즉사 결정타 (가장 좁은 뜻)
//   첫 피 승 = 판의 첫 칼날 상처를 낸 쪽이 이김 (넓은 뜻 '첫 칼이 판을 정함')
//  node tools/sim/lethality_study.mjs run [--prof=4] [--seeds=1-12] [--schools=…] [--shard=i/n] [--json=out.json] [--cfg=PATH:수,…] [--dur=60]
//  node tools/sim/lethality_study.mjs bot [--prof=4] [--seeds=1-6] [--shard=i/n] [--json=out.json] [--cfg=…]
//  node tools/sim/lethality_study.mjs agg a.json …                        (한 묶음 자세한 표)
//  node tools/sim/lethality_study.mjs cf a.json …                         (지금 머리 판 상처마다 거꾸로 셈 — 걸음 운동량 0 · 0.5 kg · 칼날 무게 끔 · 목엔 걸음 몫 안 셈 등의 첫째 차수)
//  node tools/sim/lethality_study.mjs cmp 이름=a.json,b.json 이름=… [--side=0|1]  (묶음마다 한 줄 견줌 표 · side = 그 자리가 진 판 · 그 자리를 친 상처만)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, DT, CONFIG } from './harness_m.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { LOOKS } from '../../src/looks.js';
import { isMain } from './is_main.mjs';

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => s.split(',').flatMap((p) => { const [a, b] = p.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); });
export const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };

// ── config 수 덮어쓰기 (cfg_override.mjs 와 같은 규칙 — 옛 판엔 그 파일이 없어 안에 둠 · 재기 전용) ──
export function applyCfg(spec) {
  const done = [];
  for (const kv of (spec ?? '').split(',').filter(Boolean)) {
    const i = kv.lastIndexOf(':');
    const path = kv.slice(0, i);
    const v = +kv.slice(i + 1);
    if (!(i > 0) || !Number.isFinite(v)) throw new Error(`--cfg 값은 수만: ${kv}`);
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) {
      o = o?.[k];
      if (o == null || typeof o !== 'object') throw new Error(`unknown cfg: ${path}`);
    }
    const last = keys[keys.length - 1];
    if (!(last in o) || typeof o[last] !== 'number') throw new Error(`unknown cfg (수 칸 아님): ${path}`);
    done.push([path, o[last], v]);
    o[last] = v;
  }
  if (done.length) console.error(`cfg: ${done.map(([p, a, b]) => `${p} ${a} → ${b}`).join(' · ')}`);
  return done;
}

// ── 판 기록기 (두 판 꼴 같이) ──
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const INSTANT = new Set(['목', '머리']);
/** 친 쪽 골반이 상대 골반 쪽(바닥 위)으로 드는 빠르기 m/s — combat.js stepMassOf 와 같은 스텝 전 저장값 (없으면 null) */
function closing(att, vic) {
  const a = att?.cache?.parts?.pelvis;
  const b = vic?.cache?.parts?.pelvis;
  if (!a || !b) return null;
  const dx = b.p.x - a.p.x, dz = b.p.z - a.p.z;
  const dd = Math.hypot(dx, dz);
  if (!(dd > 1e-6)) return null;
  return (a.v.x * dx + a.v.z * dz) / dd;
}
function recorder(G, F, AIs = [null, null]) {
  const wounds = [];
  const dead = [null, null];
  const wasDead = [false, false];
  let passing = null;
  const orig = G.combat.strike.bind(G.combat);
  G.combat.strike = (pr, pt, ps) => { const k = passing; passing = !!ps; try { return orig(pr, pt, ps); } finally { passing = k; } };
  const prevHook = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    prevHook?.(att, vic, r, ...rest);
    const a = F.indexOf(att), v = F.indexOf(vic);
    if (a < 0 || v < 0) return;
    const ty = r.type === 'cut' ? 'c' : r.type === 'stab' ? 's' : 'b';
    const sev = ty === 'b' ? 0 : r.severity ?? 0;
    if (ty === 'b' && !(r.energy > 10)) return; // 가벼운 둔타는 버림 (판정 문턱 근처 스침)
    const ai = AIs[a];
    // ef · th = 판정 실효 에너지 · 문턱 (combat.js analyze eff · thr — 심각도 = (ef − th) ÷ 90(베기) · 60(찌르기) · 가름 = ef × physK > th × 1.25) · why = AI 가 친 칼의 까닭(공격 중일 때 — 'stepin' = 걸음에 치기 · 들어옴)
    const w = { t: r3(G.t), a, z: r.zone, ty, sev: r3(sev), E: r2(r.energy), Ep: r2(r.ephys), m: r3(r.mEff), u: r3(r.t), sp: r2(r.speed), v: r2(closing(att, vic)), pass: r.pass ? 1 : 0, psg: passing == null ? null : passing ? 1 : 0,
      ef: r2(r.eff), th: r2(r.thr), st: r.stuck == null ? null : r.stuck ? 1 : 0, why: ai ? (ai.mode === 'attack' ? ai.why ?? null : ai.mode ?? null) : null, k: null, dc: 0 };
    if (!wasDead[v] && !dead[v] && vic.state === 'dead' && INSTANT.has(vic.causeOfDeath)) {
      dead[v] = { t: r3(G.t), cause: vic.causeOfDeath, decap: vic.decapitated ? 1 : 0, w: wounds.length };
      w.k = vic.causeOfDeath;
      w.dc = vic.decapitated ? 1 : 0;
    }
    wounds.push(w);
  };
  return {
    pre() { for (let i = 0; i < 2; i++) wasDead[i] = F[i].state === 'dead'; },
    post() { for (let i = 0; i < 2; i++) if (!dead[i] && F[i].state === 'dead') dead[i] = { t: r3(G.t), cause: F[i].causeOfDeath, decap: F[i].decapitated ? 1 : 0, w: null }; },
    done(extra) {
      const out = (f) => !f.alive || f.state === 'dead';
      const o0 = out(F[0]), o1 = out(F[1]);
      const loser = o0 && !o1 ? 0 : o1 && !o0 ? 1 : o0 && o1 ? 2 : -1;
      const deaths = [];
      for (let i = 0; i < 2; i++) {
        const d = dead[i] ?? (out(F[i]) ? { t: r3(G.t), cause: F[i].causeOfDeath ?? '쓰러짐', decap: F[i].decapitated ? 1 : 0, w: null } : null);
        if (!d) continue;
        const recv = wounds.filter((w, k) => w.a === 1 - i && w.ty !== 'b' && w.sev > 0 && (d.w == null ? w.t <= d.t : k <= d.w));
        deaths.push({ i, ...d, nRecv: recv.length, blood: r3(F[i].blood) });
      }
      return { endT: r3(G.t), loser, deaths, wounds, ...extra };
    },
  };
}

// ── run: AI 대 AI 같은 유파 거울 ──
export function runFight({ school, wi, seed, swap, prof = 4, dur = 60 }) {
  const weapon = WEAPONS[school][wi];
  const L = CONFIG.AI_PROFICIENCY.levels;
  const G = newRound({
    seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: AI, look: LOOKS.enemy, look2: LOOKS.enemy,
    difficulty: L[prof], difficulty2: L[prof], persona: { proficiency: prof }, persona2: { proficiency: prof },
  });
  const F = [G.player, G.enemy];
  const A = [G.ai2, G.ai];
  if (prof === 6 && CONFIG.PROF6_VITALITY) for (const f of F) f.vitality = CONFIG.PROF6_VITALITY;
  const R = recorder(G, F, A);
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(F[0]) && !out(F[1])) { R.pre(); G.step(); R.post(); }
  const ms = A.map((ai) => ai.stats?.ms ?? null);
  const rec = R.done({ mode: 'run', school, weapon, wi, seed, swap, prof, debana: ms.every((m) => m) ? ms.reduce((s, m) => s + (m.debana ?? 0), 0) : null, atk: A.map((ai) => ai.stats?.attacks ?? null) });
  G.world.free();
  return rec;
}

// ── bot: 사람 손가락 봇 대 AI (special_balance.mjs fightRun 꼴 — 특수 공격 · 고유 강화 · 손가락 긋기 강화 없음) ──
function rng(seed) {
  let rs = seed >>> 0;
  const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  rnd.gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  return rnd;
}
export async function botFight({ school, wi, seed, prof = 4, dur = 60, delay = 0.15, counter = 0.5, sjit = 0.06, jit = 0.04, spd = [3, 5.5] }, mods) {
  const { TECH, PlayerParryGuard, MEASURED } = mods;
  const weapon = WEAPONS[school][wi];
  const L = CONFIG.AI_PROFICIENCY.levels;
  const G = newRound({ seed: seed * 100 + wi * 10 + 5, walls: true, weapon, weapon2: weapon, look: LOOKS.player, look2: LOOKS.enemy, difficulty: L[prof], persona: { proficiency: prof } });
  const P = G.player, A = G.enemy;
  const F = [P, A];
  if (prof === 6 && CONFIG.PROF6_VITALITY) A.vitality = CONFIG.PROF6_VITALITY;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.autoGuard = true;
  const guard = new PlayerParryGuard(P, A);
  P.stamina.controller = guard;
  const rnd = rng(seed * 7919 + wi * 31 + 17);
  const [CONTACT, REACH] = MEASURED[weapon] ?? MEASURED.longsword;
  const STROKES = TECH.filter((t) => t.from && t.path?.length).map((t) => ({ from: t.from, path: t.path }));
  // 손가락 (프레임 = 2 스텝 · 손 목표에 더함 — special_balance fingerBot 과 같음)
  const FRAME = 2 * DT;
  const APPR = 1.6;
  const B = { queue: [], fx: 0, fy: 0, step: 0 };
  const to = (p, vel, held) => {
    const fr = [];
    let x = B.fx, y = B.fy;
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, vel * FRAME);
      x += (dx / d) * st;
      y += (dy / d) * st;
      fr.push([(dx / d) * st, (dy / d) * st, held]);
    }
    B.fx = x;
    B.fy = y;
    return fr;
  };
  const make = (s, back) => {
    B.fx = P.handOffset.x;
    B.fy = P.handOffset.y;
    const vel = spd[0] + rnd() * (spd[1] - spd[0]);
    const fr = [];
    fr.push(...to([s.from[0] + rnd.gauss() * sjit, s.from[1] + rnd.gauss() * sjit], APPR, false));
    fr.push(...Array(4).fill([0, 0, false]));
    for (const p of s.path) fr.push(...to([p[0] + (rnd() * 2 - 1) * jit, p[1] + (rnd() * 2 - 1) * jit], vel, true));
    if (back) { fr.push(...Array(3).fill([0, 0, true])); fr.push(...to(s.from, vel, true)); }
    fr.push(...Array(6).fill([0, 0, false]));
    return fr;
  };
  const feed = () => {
    if ((B.step++ & 1) !== 0) return;
    const f = B.queue.shift() ?? [0, 0, false];
    P.handOffset.x += f[0];
    P.handOffset.y += f[1];
    P.handHeld = f[2];
    if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) P.inputActive = true;
  };
  let nextAtk = 2.6, due = Infinity, heldUntil = 0, lastMotion = -1, notice = false;
  const stats = { strokes: 0, taps: 0, counters: 0, parries: 0 };
  const attack = (t) => {
    if (rnd() < 0.15) { if (P.skill.thrust()) stats.taps++; } else {
      B.queue = make(STROKES[Math.floor(rnd() * STROKES.length)], rnd() < 0.3);
      stats.strokes++;
    }
    nextAtk = t + 1.0 + rnd() * 0.6;
  };
  G.before = () => {
    const t = G.t;
    const dist = P.foeDistance();
    const motion = A.armed && dist < 2.2 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (motion) {
      lastMotion = t;
      if (!notice && !guard.held && due === Infinity && !B.queue.length) { due = t + delay + rnd() * 0.1; notice = true; }
    } else if (t - lastMotion > 0.3) notice = false;
    if (t >= due) {
      due = Infinity;
      if (P.armed && !P.stamina.exhausted && rnd() < counter) { attack(t); stats.counters++; } else { heldUntil = t + 0.6 + rnd() * 0.4; stats.parries++; }
    }
    guard.held = t < heldUntil && !B.queue.length && !P.skill.tap;
    guard.broken = !!(P.skill.tap || P.skill.pom || B.queue.length);
    if (!guard.held && !B.queue.length && t >= nextAtk && dist < REACH && P.alive && P.armed && !P.stamina.exhausted) attack(t);
    guard.step(DT);
    P.inputActive = guard.active;
    feed();
    let fwd = 0;
    if (!P.stamina.exhausted && P.alive) {
      if (B.queue.length && dist > CONTACT) fwd = 0.6; // 긋는 동안 맞닿기 밖이면 앞으로 (사람은 칠 때 들어감)
      else if (t >= nextAtk && !guard.held && dist > REACH) fwd = 0.5;
      else if (dist < CONTACT + 0.1) fwd = -0.55;
      else if (dist > REACH + 0.25) fwd = 0.45;
    }
    P.move.set(0.18 * Math.sin(t * 0.65 + seed), fwd);
    P.stickX = P.move.x;
    P.stickY = P.move.y;
  };
  const R = recorder(G, F, [null, G.ai]);
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(P) && !out(A)) { R.pre(); G.step(); R.post(); }
  const rec = R.done({ mode: 'bot', school, weapon, wi, seed, swap: false, prof, delay, bot: stats, debana: G.ai.stats?.ms ? G.ai.stats.ms.debana ?? 0 : null });
  G.world.free();
  return rec;
}

// ── 통계 ──
export function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
const q = (a, p) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return NaN; const k = (s.length - 1) * p; const lo = Math.floor(k), hi = Math.ceil(k); return s[lo] + (s[hi] - s[lo]) * (k - lo); };
const med = (a) => q(a, 0.5);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pcI = (k, n) => { if (!n) return '-'; const [a, b] = wilson(k, n); return `${((100 * k) / n).toFixed(1)} % [${(100 * a).toFixed(1)} ~ ${(100 * b).toFixed(1)}]`; };
const pcS = (k, n) => (n ? `${((100 * k) / n).toFixed(1)} %` : '-');
const dmg = (w) => w.ty !== 'b' && w.sev > 0;
/** 상처 하나가 새 몸이었다면 즉사인가 (fighter.js applyWound 치명상 문턱 그대로) */
const lethalW = (w) => dmg(w) && ((w.z === 'neck' && w.sev > 0.5) || (w.z === 'head' && ((w.ty === 'c' && w.sev > 0.8) || (w.ty === 's' && w.sev > 0.5))));

// 칼이 몸을 어떻게 지났나 (combat.js strike · afterStep): 가르는 길(psg 1 — 물리 걸이가 칼을 몸 속으로 보냄) 가운데 판정 에너지 > 흡수(absorb)면 '지남'(흡수만큼 끌리고 계속 휘둘러 감) ·
//  ≤ 흡수면 '박힘'(stuck — 다 쓰고 붙잡힘) · 튕긴 길(psg 0 — 접촉힘 충돌)은 '멈춤 · 튕김'. 박힘 기록(st)이 없는 옛 기록은 ANATOMY 흡수표(판 다섯 모두 같음 · 투구 없는 겉모습)로 다시 셈
const ABSORB = { head: 140, neck: 45, chest: 110, abdomen: 90, pelvis: 100, arm: 45, leg: 60 };
export const stuckOf = (w) => (w.st != null ? w.st === 1 : (w.E ?? 0) <= (ABSORB[w.z] ?? 100));
export const passKind = (w) => (w.psg === 1 ? (stuckOf(w) ? 'lodge' : 'through') : w.psg === 0 ? 'stop' : null);

/** 판 묶음 → 셈 (판마다 · 상처마다) */
/** side: null = 두 쪽 모두 · 0 / 1 = 그 자리가 진 판 · 그 자리를 친 상처만 (봇 판 — 0 = 사람 봇 · 1 = AI) */
export function summarize(runs, side = null) {
  const n = runs.length;
  const S = { n };
  const dec = runs.filter((r) => (side == null ? r.loser === 0 || r.loser === 1 : r.loser === side));
  S.decided = dec.length;
  S.draw = runs.filter((r) => r.loser === -1).length;
  S.both = runs.filter((r) => r.loser === 2).length;
  const lossD = (r) => r.deaths.find((d) => d.i === r.loser);
  const cnt = (fn) => dec.filter((r) => fn(lossD(r), r)).length;
  S.decap = cnt((d) => d.cause === '목' && d.decap);
  S.neck = cnt((d) => d.cause === '목' && !d.decap);
  S.head = cnt((d) => d.cause === '머리');
  S.bleed = cnt((d) => d.cause === '출혈');
  S.ko = cnt((d) => d.cause === '기절');
  S.other = S.decided - S.decap - S.neck - S.head - S.bleed - S.ko;
  S.instant = S.decap + S.neck + S.head;
  S.obk = cnt((d) => d.nRecv <= 1 && (INSTANT.has(d.cause) || d.cause === '출혈')); // 한 칼 죽음 (받은 칼날 상처 하나뿐 · 그 상처로 즉사 또는 출혈 — 기절은 둔타가 쌓인 것이라 뺌)
  S.obkInstant = cnt((d) => d.nRecv <= 1 && INSTANT.has(d.cause));
  S.obkBleed = cnt((d) => d.nRecv <= 1 && d.cause === '출혈');
  S.firstBlow = cnt((d, r) => !!r.wounds.find(dmg)?.k); // 첫 칼 즉사: 판의 첫 칼날 상처(어느 쪽이든)가 곧 즉사 결정타
  S.firstWin = dec.filter((r) => { const f = r.wounds.find(dmg); return f && f.a === 1 - r.loser; }).length;
  S.lenMean = runs.reduce((s, r) => s + r.endT, 0) / n;
  S.lenMed = med(runs.map((r) => r.endT));
  S.deathMed = med(dec.map((r) => r.endT));
  S.firstWMed = med(runs.map((r) => r.wounds.find(dmg)?.t ?? null));
  S.killAfterFirst = med(dec.map((r) => { const f = r.wounds.find(dmg); return f ? r.endT - f.t : null; }));
  S.nRecvMed = med(dec.map((r) => lossD(r)?.nRecv ?? null));
  S.nRecvMean = dec.reduce((s, r) => s + (lossD(r)?.nRecv ?? 0), 0) / (dec.length || 1);
  const W = runs.flatMap((r) => r.wounds).filter((w) => side == null || w.a === 1 - side);
  const D = W.filter(dmg);
  S.woundsPF = D.length / n;
  S.contactsPF = W.length / n;
  S.lethalW = D.filter(lethalW).length;
  S.nD = D.length;
  S.neckLethal = D.filter((w) => w.z === 'neck' && w.sev > 0.5).length;
  S.neckLethalCut = D.filter((w) => w.z === 'neck' && w.sev > 0.5 && w.ty === 'c').length;
  S.decapW = W.filter((w) => w.dc).length;
  S.sevMed = med(D.map((w) => w.sev));
  S.sevP90 = q(D.map((w) => w.sev), 0.9);
  S.sev1 = D.filter((w) => w.sev >= 1).length;
  const C = D.filter((w) => w.ty === 'c'), T = D.filter((w) => w.ty === 's');
  const ePair = (xs) => [med(xs.map((w) => w.E)), q(xs.map((w) => w.E), 0.9), xs.length];
  S.eAll = ePair(D);
  S.eCut = ePair(C);
  S.eStab = ePair(T);
  S.eCutStep = ePair(C.filter((w) => w.v != null && w.v >= 0.5));
  S.eCutStand = ePair(C.filter((w) => w.v != null && Math.abs(w.v) < 0.2));
  S.eCutBack = ePair(C.filter((w) => w.v != null && w.v <= -0.2));
  S.eCutTip = ePair(C.filter((w) => w.u >= 2 / 3));
  S.eCutHilt = ePair(C.filter((w) => w.u < 1 / 3));
  // 칼날이 몸에 닿은 모든 베기 꼴 닿음 (가르지 못해 멍이 된 것까지 — 판정 에너지 · 분포)
  S.eContact = ePair(W);
  S.stepShare = [C.filter((w) => w.v != null && w.v >= 0.5).length, C.length];
  // 칼날 베기 상처가 몸을 지남 · 박힘 · 멈춤 (몫 — 베기 상처 중) · 들어가며 친 베기만 따로
  const kinds = (xs) => { const o = { through: 0, lodge: 0, stop: 0, n: xs.length }; for (const w of xs) { const k = passKind(w); if (k) o[k]++; } return o; };
  S.pkCut = kinds(C);
  S.pkCutStep = kinds(C.filter((w) => w.v != null && w.v >= 0.5));
  S.pkCutStand = kinds(C.filter((w) => w.v != null && Math.abs(w.v) < 0.2));
  S.vPos = [C.filter((w) => w.v != null && w.v > 0).length, C.length];
  S.debana = runs.every((r) => r.debana != null) ? runs.reduce((s, r) => s + r.debana, 0) / n : null;
  S.zones = {};
  for (const w of D) S.zones[w.z] = (S.zones[w.z] ?? 0) + 1;
  return S;
}

const CMP_HEAD = '| 묶음 | 판 | 참수 % [95 %] | 한 칼 죽음 % [95 %] | 즉사 한 칼 % | 첫 칼 즉사 % | 즉사(목 · 머리) 모두 % | 출혈 % | 비김 % | 판 길이 평균 · 중앙 s | 첫 상처 s (중앙) | 판당 칼날 상처 | 진 쪽 받은 상처 (평균) | 즉사 상처 몫 (상처당) | 칼날 상처 E 중앙 · p90 J | 베기 E 중앙 · p90 | 찌르기 E 중앙 · p90 | 들어가며 베기 E 중앙 · p90 (수) | 서서 베기 E 중앙 · p90 (수) | 베기 상처 지남 · 박힘 · 멈춤 % | 들어가며 베기 지남 % | 서서 베기 지남 % | 걸음에 치기 /판 |';
const pk3 = (o) => (o.n ? `${((100 * o.through) / o.n).toFixed(0)} · ${((100 * o.lodge) / o.n).toFixed(0)} · ${((100 * o.stop) / o.n).toFixed(0)}` : '-');
export function cmpRow(label, S) {
  const e = (p) => `${f1(p[0])} · ${f1(p[1])}`;
  const en = (p) => `${f1(p[0])} · ${f1(p[1])} (${p[2]})`;
  return `| ${label} | ${S.n} | ${pcI(S.decap, S.n)} | ${pcI(S.obk, S.n)} | ${pcS(S.obkInstant, S.n)} | ${pcS(S.firstBlow, S.n)} | ${pcI(S.instant, S.n)} | ${pcS(S.bleed, S.n)} | ${pcS(S.draw, S.n)} | ${f1(S.lenMean)} · ${f1(S.lenMed)} | ${f1(S.firstWMed)} | ${f2(S.woundsPF)} | ${f2(S.nRecvMean)} | ${pcS(S.lethalW, S.nD)} | ${e(S.eAll)} | ${e(S.eCut)} | ${e(S.eStab)} | ${en(S.eCutStep)} | ${en(S.eCutStand)} | ${pk3(S.pkCut)} | ${pcS(S.pkCutStep.through, S.pkCutStep.n)} | ${pcS(S.pkCutStand.through, S.pkCutStand.n)} | ${S.debana == null ? '-' : f2(S.debana)} |`;
}
export const cmpHead = () => `${CMP_HEAD}\n|${CMP_HEAD.split('|').slice(1, -1).map(() => '---').join('|')}|`;

export function report(runs, side = null) {
  if (side == null && runs[0]?.mode === 'bot') {
    return [`## 사람 봇이 이김 (AI 죽음 · 사람이 친 상처)\n`, report(runs, 1), `\n## AI 가 이김 (사람 죽음 · AI 가 친 상처)\n`, report(runs, 0)].join('\n');
  }
  const S = summarize(runs, side);
  const out = [];
  out.push(`판 ${S.n} · 승부 ${S.decided} · 비김 ${S.draw} · 같이 쓰러짐 ${S.both}`);
  out.push('\n### 죽음 까닭 (진 쪽 · 판 몫 [95 % 윌슨])');
  out.push('| 까닭 | 판 | 몫 |\n|---|---|---|');
  for (const [k, v] of [['참수', S.decap], ['목 치명 (참수 아님)', S.neck], ['머리 치명', S.head], ['출혈', S.bleed], ['기절', S.ko], ['그 밖', S.other], ['비김 (60 s)', S.draw]]) out.push(`| ${k} | ${v} | ${pcI(v, S.n)} |`);
  out.push('\n### 한 칼 · 첫 칼');
  out.push('| 칸 | 판 | 몫 |\n|---|---|---|');
  out.push(`| 한 칼 죽음 (진 쪽이 받은 칼날 상처가 하나뿐이고 그것으로 즉사 · 출혈) | ${S.obk} | ${pcI(S.obk, S.n)} |`);
  out.push(`| — 그중 즉사 (목 · 머리) | ${S.obkInstant} | ${pcI(S.obkInstant, S.n)} |`);
  out.push(`| — 그중 출혈 | ${S.obkBleed} | ${pcI(S.obkBleed, S.n)} |`);
  out.push(`| 첫 칼 즉사 (판의 첫 칼날 상처가 곧 즉사 결정타) | ${S.firstBlow} | ${pcI(S.firstBlow, S.n)} |`);
  out.push(`| 첫 피 승 (첫 칼날 상처를 낸 쪽이 이김 · 승부 난 판 중) | ${S.firstWin} | ${pcI(S.firstWin, S.decided)} |`);
  out.push(`\n판 길이 평균 ${f1(S.lenMean)} · 중앙 ${f1(S.lenMed)} s · 죽음까지 중앙 ${f1(S.deathMed)} s · 첫 칼날 상처 중앙 ${f1(S.firstWMed)} s · 첫 상처 → 끝 중앙 ${f1(S.killAfterFirst)} s · 진 쪽이 받은 칼날 상처 평균 ${f2(S.nRecvMean)} (중앙 ${f1(S.nRecvMed)})`);
  out.push(`판당 칼날 상처 ${f2(S.woundsPF)} · 판당 닿음(멍 포함) ${f2(S.contactsPF)} · 상처당 즉사 몫 ${pcI(S.lethalW, S.nD)} · 목 치명 상처 ${S.neckLethal} (베기 ${S.neckLethalCut}) → 참수 ${S.decapW} · 심각도 중앙 ${f2(S.sevMed)} · p90 ${f2(S.sevP90)} · ≥ 1 몫 ${pcS(S.sev1, S.nD)}`);
  out.push('\n### 판정 에너지 J (칼날 상처 — 심각도 > 0)');
  out.push('| 칸 | 중앙 | p90 | 수 |\n|---|---|---|---|');
  for (const [k, p] of [['칼날 상처 모두', S.eAll], ['베기', S.eCut], ['찌르기', S.eStab], ['베기 — 들어가며 (골반 ≥ 0.5 m/s)', S.eCutStep], ['베기 — 서서 (±0.2)', S.eCutStand], ['베기 — 물러나며 (≤ −0.2)', S.eCutBack], ['베기 — 칼날 끝 ⅓', S.eCutTip], ['베기 — 손잡이 쪽 ⅓', S.eCutHilt], ['몸 닿음 모두 (멍 포함 · 10 J 넘는 둔타)', S.eContact]]) out.push(`| ${k} | ${f1(p[0])} | ${f1(p[1])} | ${p[2]} |`);
  out.push(`\n들어가며 친 베기 몫 ${pcS(...S.stepShare)} · 골반이 조금이라도 드는 베기 몫 ${pcS(...S.vPos)} · 걸음에 치기 판당 ${S.debana == null ? '-' : f2(S.debana)}`);
  out.push(`베기 상처가 몸을 지남 · 박힘 · 멈춤(튕긴 길): 모두 ${pk3(S.pkCut)} % (${S.pkCut.n}) · 들어가며 ${pk3(S.pkCutStep)} % (${S.pkCutStep.n}) · 서서 ${pk3(S.pkCutStand)} % (${S.pkCutStand.n})`);
  out.push(`부위 (칼날 상처): ${Object.entries(S.zones).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${pcS(v, S.nD)}`).join(' · ')}`);
  out.push('\n### 유파별 (참수 · 한 칼 죽음 · 판 길이)');
  out.push('| 유파 | 판 | 참수 | 한 칼 죽음 | 즉사 모두 | 판 길이 평균 | 판당 칼날 상처 |\n|---|---|---|---|---|---|---|');
  for (const s of SCHOOLS) {
    const rs = runs.filter((r) => r.school === s);
    if (!rs.length) continue;
    const X = summarize(rs, side);
    out.push(`| ${KO[s]} | ${X.n} | ${pcS(X.decap, X.n)} | ${pcS(X.obk, X.n)} | ${pcS(X.instant, X.n)} | ${f1(X.lenMean)} | ${f2(X.woundsPF)} |`);
  }
  return out.join('\n');
}


// ── cf: 한 상처씩 거꾸로 셈 (판은 그대로 두고 그 상처의 실효 에너지만 바꿔 봄 — 첫째 차수 · 판이 이어졌을 일은 못 봄 · 게임 값은 그대로) ──
//  지금 머리 판(걸음 운동량 · 칼날 자리 무게가 실린 판)의 베기 상처(심각도 > 0)마다: 걸음 몫 mS = stepMass × min(1, max(0, v) ÷ stepVRef) (찌르기 공격 중 베기 꼴 닿음도 실렸다고 봄 — 드묾)
//   ef′ = ef × (m − mS + mS′) ÷ m × (칼날 무게 끔이면 ÷ w(u)) · 심각도′ = 심각도 × (ef′ − th) ÷ (ef − th) (막기 · 편섬 등 심각도 곱은 그대로 실림) · 가름′ = ef′ > 1.25 th
//   즉사′ = 목 심각도′ > 0.5 · 머리 베기 심각도′ > 0.8 · 참수′ = 목 즉사′ ∧ 가름′ ∧ 가르는 길
const CF = {
  now: { ko: '지금 (그대로)', mS: (v, S) => S.stepMass * Math.min(1, Math.max(0, v) / S.stepVRef) },
  noStep: { ko: '걸음 운동량 0', mS: () => 0 },
  step05: { ko: '걸음 운동량 0.5 kg', mS: (v, S) => 0.5 * Math.min(1, Math.max(0, v) / S.stepVRef) },
  vref2: { ko: '걸음 다 실리는 빠르기 2.0 m/s', mS: (v, S) => S.stepMass * Math.min(1, Math.max(0, v) / 2) },
  noBlade: { ko: '칼날 자리 무게 끔', mS: (v, S) => S.stepMass * Math.min(1, Math.max(0, v) / S.stepVRef), blade: false },
  capNeck: { ko: '목 · 머리엔 걸음 몫 안 셈 (그 밖 그대로)', mS: (v, S) => S.stepMass * Math.min(1, Math.max(0, v) / S.stepVRef), capZones: new Set(['neck', 'head']) },
  capDecap: { ko: '참수 판정만 걸음 몫 뺌 (죽음은 그대로)', mS: (v, S) => S.stepMass * Math.min(1, Math.max(0, v) / S.stepVRef), capDecap: true },
};
export function cfReport(runs, STRIKE) {
  const bw = (u) => (u >= STRIKE.bladeWFull ? 1 : STRIKE.bladeW0 + ((1 - STRIKE.bladeW0) * Math.max(0, u)) / STRIKE.bladeWFull);
  const out = [];
  const cuts = runs.flatMap((r) => r.wounds.map((w) => ({ w, r }))).filter(({ w }) => w.ty === 'c' && w.sev > 0 && w.ef != null && w.th != null && w.m > 0);
  // 맞춤 확인: 기록된 심각도 ≈ (ef − th) ÷ 90 · 가름 ≈ ef > 1.25 th
  const okSev = cuts.filter(({ w }) => Math.abs(w.sev - (w.ef - w.th) / 90) < 0.01).length;
  const okPass = cuts.filter(({ w }) => (w.pass === 1) === (w.ef > 1.25 * w.th)).length;
  out.push(`베기 상처 ${cuts.length} · 심각도 = (ef − th) ÷ 90 맞음 ${pcS(okSev, cuts.length)} (나머지는 막기 · 편섬 · 흘림 곱) · 가름 = ef > 1.25 th 맞음 ${pcS(okPass, cuts.length)}`);
  out.push('\n| 갈래 | 베기 E 중앙 · p90 J (그 갈래에서도 상처인 것) | 즉사 베기 상처 (목 · 머리) | 그중 참수 | 즉사 결정타 → 즉사 아님 (판) | 참수 → 참수 아님 (판) | 심각도 0 이 되는 베기 (상처) |\n|---|---|---|---|---|---|---|');
  const base = {};
  for (const [key, sc] of Object.entries(CF)) {
    let lethal = 0, decap = 0, lostKill = 0, lostDecapFights = 0, zero = 0;
    const Es = [];
    for (const { w, r } of cuts) {
      const mS = STRIKE.stepMass * Math.min(1, Math.max(0, w.v ?? 0) / STRIKE.stepVRef);
      const mS2 = sc.capZones?.has(w.z) ? 0 : sc.mS(w.v ?? 0, STRIKE);
      const kB = sc.blade === false ? 1 / bw(w.u) : 1;
      const ef2 = (w.ef * Math.max(0.05, w.m - mS + mS2)) / w.m * kB;
      const E2 = (w.E * Math.max(0.05, w.m - mS + mS2)) / w.m * kB;
      const sev2 = ef2 > w.th ? (w.sev * (ef2 - w.th)) / (w.ef - w.th) : 0;
      if (!(sev2 > 0)) zero++;
      else Es.push(E2); // 그 갈래에서도 칼날 상처인 것만 (판 표의 '베기 E' 와 같은 뜻)
      const isL = (w.z === 'neck' && sev2 > 0.5) || (w.z === 'head' && sev2 > 0.8);
      let pass2 = ef2 > 1.25 * w.th;
      let neckL = w.z === 'neck' && sev2 > 0.5;
      if (sc.capDecap) { const ef0 = (w.ef * Math.max(0.05, w.m - mS)) / w.m; const s0 = ef0 > w.th ? (w.sev * (ef0 - w.th)) / (w.ef - w.th) : 0; pass2 = ef0 > 1.25 * w.th; neckL = w.z === 'neck' && s0 > 0.5; }
      const dc = neckL && pass2 && w.psg === 1 && isL;
      if (isL) lethal++;
      if (dc) decap++;
      if (w.k && INSTANT.has(w.k) && !isL) lostKill++;
      if (w.dc && !dc) lostDecapFights++;
    }
    if (key === 'now') Object.assign(base, { lethal, decap });
    out.push(`| ${sc.ko} | ${f1(med(Es))} · ${f1(q(Es, 0.9))} | ${lethal} | ${decap} | ${lostKill} | ${lostDecapFights} | ${zero} |`);
  }
  const kills = cuts.filter(({ w }) => w.k && INSTANT.has(w.k));
  const dcs = cuts.filter(({ w }) => w.dc);
  out.push(`\n(판에서 실제로 나온 즉사 베기 결정타 ${kills.length} · 참수 ${dcs.length} — 판 ${runs.length}. '지금' 줄의 즉사 · 참수 수는 판에서 죽은 몸 뒤 상처가 없어 결정타 수와 거의 같음)`);
  // 즉사 베기 · 참수 베기의 걸음 · 칼날 자리
  const row = (nm, xs) => `| ${nm} | ${xs.length} | ${pcS(xs.filter(({ w }) => w.v != null && w.v >= 0.5).length, xs.length)} | ${pcS(xs.filter(({ w }) => w.v != null && w.v > 0).length, xs.length)} | ${f2(med(xs.map(({ w }) => w.v)))} | ${f1(med(xs.map(({ w }) => w.E)))} | ${pcS(xs.filter(({ w }) => w.u >= 2 / 3).length, xs.length)} | ${pcS(xs.filter(({ w }) => w.why === 'stepin').length, xs.length)} |`;
  out.push('\n| 베기 상처 | 수 | 들어가며 (≥ 0.5 m/s) | 골반이 조금이라도 듦 | 드는 빠르기 중앙 m/s | E 중앙 | 칼날 끝 ⅓ | AI 까닭 stepin (걸음에 치기 · 들어옴) |\n|---|---|---|---|---|---|---|---|');
  out.push(row('모든 베기 상처', cuts));
  out.push(row('목 상처', cuts.filter(({ w }) => w.z === 'neck')));
  out.push(row('즉사 결정타 (목 · 머리)', kills));
  out.push(row('참수', dcs));
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const files = (xs) => xs.flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
  if (mode === 'cf') {
    console.log(cfReport(files(args.slice(1).filter((x) => !x.startsWith('--'))), CONFIG.STRIKE));
  } else if (mode === 'agg') {
    console.log(report(files(args.slice(1).filter((x) => !x.startsWith('--')))));
  } else if (mode === 'cmp') {
    const L = [cmpHead()];
    for (const g of args.slice(1).filter((x) => !x.startsWith('--'))) {
      const [label, list] = g.split('=');
      const sd = arg('side', null);
      L.push(cmpRow(label, summarize(files(list.split(',')), sd == null ? null : +sd)));
    }
    console.log(L.join('\n'));
  } else {
    applyCfg(arg('cfg', ''));
    const seeds = range(arg('seeds', mode === 'bot' ? '1-6' : '1-12'));
    const schools = arg('schools', SCHOOLS.join(',')).split(',');
    const prof = +arg('prof', '4');
    const dur = +arg('dur', '60');
    const [si, sn] = arg('shard', '1/1').split('/').map(Number);
    const list = [];
    if (mode === 'bot') { for (const school of schools) for (let wi = 0; wi < 2; wi++) for (const seed of seeds) list.push({ school, wi, seed }); }
    else for (const school of schools) for (let wi = 0; wi < 2; wi++) for (const seed of seeds) for (const swap of [false, true]) list.push({ school, wi, seed, swap });
    const mine = list.filter((_, k) => k % sn === si - 1);
    console.error(`${mode} · 숙련 ${prof} · 전체 ${list.length} 판 · 이 샤드 ${mine.length} (${si}/${sn})`);
    let mods = null;
    if (mode === 'bot') {
      const [{ TECH }, { PlayerParryGuard }, { MEASURED }] = await Promise.all([import('../../src/ai_techniques.js'), import('../../src/parry_button.js'), import('../../src/weapon_measured.js')]);
      mods = { TECH, PlayerParryGuard, MEASURED };
    }
    const runs = [];
    const t0 = Date.now();
    for (const f of mine) {
      const r = mode === 'bot' ? await botFight({ ...f, prof, dur }, mods) : runFight({ ...f, prof, dur });
      runs.push(r);
      const d = r.deaths.find((x) => x.i === r.loser);
      console.error(`${f.school} w${f.wi} s${f.seed}${f.swap ? ' swap' : ''} → ${d ? `${d.cause}${d.decap ? '(참수)' : ''} 받은 ${d.nRecv}` : r.loser === -1 ? '비김' : '같이'} @${r.endT}s · 상처 ${r.wounds.filter(dmg).length} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
    const o = arg('json', null);
    if (o) writeFileSync(o, JSON.stringify(runs));
    else console.log(report(runs));
  }
}
