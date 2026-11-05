// ─────────────────────────────────────────────────────────────
//  finger_cut.mjs — 손가락 긋기 세기 재기 (11/06 사장님 '손가락 베기 세기 -> 이건 최소한, 상처의 최소 문턱과 비슷해져야해' · 기록 docs/strike/finger_cut_2026-11-06.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만 · 스위치 SKILL.fingerCut 은 src/finger_cut.js).
//   drill — 서 있는 상대(칼을 아래에 둠 · 상처는 몸에 안 걸고 통증만 — special_balance drill 과 같은 꼴)에 손가락 봇(special_balance fingerBot — 시작 자리 σ 0.06 · 길 ± 0.04 · 3 ~ 5.5 패드 m/s)이
//           기본 베기 일곱(분노 · 왼 분노 · 정수리 · 가로 · 왼 가로 · 올려 · 왼 올려)을 하나씩 긋는다. 긋기마다 가장 센 닿음(판정 문턱 6 J 밑 포함)의 판정 J · 빠르기 · 칼끝 가장 빠름 · 기력.
//           싸움의 소음(막힘 · 물러남) 없이 몸 장치가 칼을 얼마나 빨리 돌리나만 본다 — 값 거르기용
//   agg   — jp_de_basics.mjs fight JSON(싸움 = school_balance fightOne 그대로 · 꽂개는 읽기만)에서 손가락 긋기(낸 것 종류 swing — 기본 · 강화 · 걸음 공격 긋기 · 끌고 가는 칼 · 비기 · 탭 아님)만 골라
//           닿음 판정 J 가운데값 · 6 J 넘은 닿음 가운데 문턱 밑 몫 · 맞음 · 맞음당 심각도 + 판(이김 · 짐 · 비김 · 준 · 받은 심각도 · 넘어짐 · 기력 바닥 몫) — --base=폴더 면 지금 대비
//  node tools/sim/finger_cut.mjs drill [--cells=german:longsword,japanese:uchigatana] [--seeds=1-8] [--dur=14] [--set=SKILL.fingerCut.arm=1.5] [--spd=3/5.5] [--json=파일]
//  node tools/sim/finger_cut.mjs agg <폴더 · json ...> [--base=폴더] [--by=cell|name]
// ─────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { fingerBot, rng, stepIn } from './special_balance.mjs';
import { applySets } from './rapier_defence.mjs';
import { cellRow } from './school_balance.mjs';
import { isMain } from './is_main.mjs';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';

const K = CONFIG.TIME.k;
export const CUTS = ['zornhau', 'zornhauL', 'oberhau', 'zwerch', 'zwerchL', 'unterhau', 'unterhauL'];
const LOW = [0, -0.5];
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; });
/** 상대 칼을 아래에 붙듦 (special_balance holdLow 와 같음) */
function holdLow(f) {
  f.handOffset.set(LOW[0], LOW[1]);
  const sk = f.skill;
  for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) sk[k]?.set(LOW[0], LOW[1]);
  for (const k of ['aimVel', 'vel', 'follow']) sk[k]?.set(0, 0);
}

/** drill 한 판: 그 유파 스킬트리를 다 익힌 사람 몸(고유 공격 강화는 붙이지 않음 — 보통 긋기 몸 장치만) · 서 있는 롱소드 상대 */
export function drillOne({ school, weapon, seed, dur = 14, spd = [3, 5.5], onRound = null }) {
  const kit = school && school !== 'none' ? kitFromNodes(school, allNodeIds(school)) : null;
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', ...(kit ? { kit } : {}), persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  const D = G.enemy;
  G.ai.update = () => {};
  D.applyWound = (h) => { D.pain = Math.min(2, D.pain + (h.severity ?? 0) * 0.8 + h.energy / 150); };
  D.knockDown = () => {};
  D.dropSword = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  onRound?.({ G, P, D });
  const rnd = rng(seed * 7919 + 17);
  const bot = fingerBot(G, P, rnd, { sjit: 0.06, jit: 0.04, spd });
  const [CONTACT, REACH] = MEASURED[weapon] ?? MEASURED.longsword;
  const atts = [];
  let cur = null;
  let nextAtk = 1.5;
  const an0 = G.combat.analyze.bind(G.combat);
  G.combat.analyze = (pr, point, S, Pp, predicting = false) => {
    const r = an0(pr, point, S, Pp, predicting);
    if (predicting || !cur || pr.w.fighter !== P || pr.v.fighter !== D || !r) return r;
    const c = { E: r.energy, sp: r.speed, ty: r.type, thr: r.thr, eff: r.eff, z: r.zone, t: r.t, at: (G.t - cur.t0) / K };
    if (!cur.best || c.E > cur.best.E) cur.best = c;
    return r;
  };
  G.before = () => {
    const t = G.t;
    const dist = P.foeDistance();
    if (cur && !bot.queue.length && cur.tq == null) cur.tq = t;
    if (cur && cur.tq != null && t - cur.tq > 0.35) cur = null;
    if (!bot.queue.length && !cur && t >= nextAtk && dist < REACH && P.alive && P.armed && !P.stamina.exhausted) {
      const name = CUTS[Math.floor(rnd() * CUTS.length)];
      const T = TECH_BY_NAME[name];
      bot.queue = bot.make([{ from: T.from, path: T.path }]);
      cur = { name, t0: t, tq: null, d0: dist, best: null, tipMax: 0, handMax: 0, st0: P.stamina.value, st1: P.stamina.value };
      atts.push(cur);
      nextAtk = t + 0.8 + rnd() * 0.6 + bot.queue.length * 2 * DT;
    }
    bot.feed();
    const fwd = stepIn(P, dist, bot.queue.length, t >= nextAtk && !cur, CONTACT, REACH, REACH);
    P.move.set(0, fwd);
    P.stickX = 0;
    P.stickY = fwd;
  };
  try {
    while (G.t < dur && D.alive && P.alive) {
      holdLow(D);
      G.step();
      if (cur) {
        cur.tipMax = Math.max(cur.tipMax, P.tipVel.length());
        const v = P.sword.linvel();
        cur.handMax = Math.max(cur.handMax, Math.hypot(v.x, v.y, v.z));
        cur.st1 = P.stamina.value;
      }
    }
  } finally {
    G.world.free();
  }
  return atts.filter((a) => a.tq != null).map((a) => ({ name: a.name, d0: r3(a.d0), tipMax: r3(a.tipMax), handMax: r3(a.handMax), st: r3(a.st0 - a.st1), best: a.best && { ...a.best, E: r3(a.best.E), sp: r3(a.best.sp), eff: r3(a.best.eff), thr: r3(a.best.thr), t: r3(a.best.t), at: r3(a.best.at) } }));
}

/** 허공 긋기 하나 (swing_feel.mjs 꼴 — 상대는 멀리 · 손 목표를 프레임마다 옮김): 감는 자리 A 로 2 패드 m/s → 0.6 s 쉼 → A → B 를 v 패드 m/s → 0.6 s 댄 채. 칼끝 · 손 가장 빠름 (m/s) */
export function airSwing({ weapon = 'longsword', school = 'german', A = [0.42, 0.42], B = [-0.4, -0.42], v = 4, seed = 1 } = {}) {
  const kit = school && school !== 'none' ? kitFromNodes(school, allNodeIds(school)) : null;
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', ...(kit ? { kit } : {}), onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  G.ai.update = () => G.enemy.move.set(0, 0);
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const FRAME = 2 * DT;
  const legs = [[null, 2.6], [A, 2], [null, 0.6], [B, v, 'cut'], [null, 0.6, 'cut']];
  let tip = 0;
  let hand = 0;
  try {
    const fg = [P.handOffset.x, P.handOffset.y]; // 손가락 자리 (손 목표에는 프레임마다 옮긴 몫만 더함 — main.js 와 같이)
    for (const [to, sp, tag] of legs) {
      const off = P.handOffset;
      const n = to ? Math.max(1, Math.ceil(Math.hypot(to[0] - fg[0], to[1] - fg[1]) / sp / FRAME)) : Math.round(sp / FRAME);
      const from = [fg[0], fg[1]];
      for (let i = 1; i <= n; i++) {
        let moved = false;
        if (to) {
          const nx = from[0] + ((to[0] - from[0]) * i) / n;
          const ny = from[1] + ((to[1] - from[1]) * i) / n;
          moved = true;
          off.x += nx - fg[0];
          off.y += ny - fg[1];
          fg[0] = nx;
          fg[1] = ny;
        }
        P.handHeld = true;
        P.inputActive = moved;
        P.move.set(0, 0);
        for (let s = 0; s < 2; s++) {
          G.step();
          if (tag) {
            tip = Math.max(tip, P.tipVel.length());
            const lv = P.sword.linvel();
            hand = Math.max(hand, Math.hypot(lv.x, lv.y, lv.z));
          }
        }
      }
    }
  } finally {
    G.world.free();
  }
  return { tip: r3(tip), hand: r3(hand) };
}

// ── 묶음 ──
export const q = (a, p) => {
  const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const mean = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const f2 = (x, k = 2) => (x == null ? '–' : x.toFixed(k));
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)} %` : '–');
/** 베기 · 찌르기가 문턱을 넘어 상처를 냈나 (아니면 둔타 — 6 J 넘은 닿음 가운데 문턱 밑 몫의 셈) */
const woundCut = (b) => (b.ty === 'cut' || b.ty === 'stab') && b.eff != null && b.thr != null && b.eff > b.thr;
export function drillRow(atts) {
  const tc = atts.filter((a) => a.best);
  const c6 = tc.filter((a) => a.best.E >= CONFIG.STRIKE.minEnergy);
  return { n: atts.length, touch: tc.length, E50: q(tc.map((a) => a.best.E), 0.5), E75: q(tc.map((a) => a.best.E), 0.75), sp50: q(tc.map((a) => a.best.sp), 0.5), tip50: q(atts.map((a) => a.tipMax), 0.5), hand50: q(atts.map((a) => a.handMax), 0.5), under: c6.filter((a) => !woundCut(a.best)).length, c6: c6.length, wounds: c6.filter((a) => woundCut(a.best)).length, st50: q(atts.map((a) => a.st), 0.5) };
}

/** jp_de_basics 판 묶음 → 손가락 긋기 낸 것 (fires + deep 꽂개) — 종류 swing (기본 · 강화 · 걸음 공격 긋기 · 판 기록이 기술 이름을 붙인 것 포함) */
export function fingerFires(runs) {
  const out = [];
  for (const r of runs) {
    const pd = r.probe?.deep ?? [];
    r.fires.forEach((f, i) => { if (f.cls === 'swing') out.push({ ...f, deep: pd[i] ?? null, cell: `${r.school}:${r.weapon}:${r.opp}` }); });
  }
  return out;
}
export function fightRow(runs) {
  const c = cellRow(runs);
  const fs = fingerFires(runs);
  const withC = fs.filter((p) => p.deep?.best);
  const c6 = withC.filter((p) => !p.deep.best.minE);
  const hit = fs.filter((f) => f.w > 0);
  const T = runs.reduce((s, r) => s + r.T, 0);
  return {
    ...c, draw: c.n - c.win - c.lose,
    fn: fs.length, perMin: (fs.length / Math.max(1e-9, T)) * 60, touch: withC.length,
    E50: q(withC.map((p) => p.deep.best.E), 0.5), E75: q(withC.map((p) => p.deep.best.E), 0.75), sp50: q(withC.map((p) => p.deep.best.sp), 0.5),
    under: c6.filter((p) => p.deep.best.why === 'under').length, flat: c6.filter((p) => p.deep.best.why === 'flat').length, c6: c6.length,
    hit: hit.length / Math.max(1, fs.length), sevHit: mean(hit.map((f) => f.sev)), stF: q(fs.map((f) => f.st), 0.5),
  };
}
function loadRuns(paths) {
  const files = paths.flatMap((p) => (statSync(p).isDirectory() ? readdirSync(p).filter((x) => x.endsWith('.json')).map((x) => join(p, x)) : [p]));
  return files.flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
}
const byCell = (runs) => { const o = {}; for (const r of runs) (o[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r); return o; };
export function aggMarkdown(runs, baseRuns = null) {
  const C = byCell(runs);
  const B = baseRuns ? byCell(baseRuns) : null;
  const out = ['| 칸 | 판 | 손가락 긋기 (분당) | 닿음 판정 J 50 · 75 % | 닿을 때 빠르기 | 6 J 넘은 닿음 가운데 문턱 밑 (납작) | 맞음 | 맞음당 심각도 | 이김 · 짐 · 비김 | 준 · 받은 심각도/판 | 내 넘어짐/판 | 기력 바닥 몫 | 긋기당 기력 |', '|---|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---:|---:|'];
  for (const [k, rs] of Object.entries(C)) {
    const x = fightRow(rs);
    const seeds = new Set(rs.map((r) => r.seed));
    const bs = B?.[k]?.filter((r) => seeds.has(r.seed)); // 지금 대비는 같은 씨앗끼리
    const b = bs?.length ? fightRow(bs) : null;
    const d = (v, w, n = 1) => (b && v != null && w != null ? ` (${v - w >= 0 ? '+' : ''}${(v - w).toFixed(n)})` : '');
    out.push(`| ${k} | ${x.n} | ${x.fn} (${f2(x.perMin, 1)}) | **${f2(x.E50, 1)}**${d(x.E50, b?.E50)} · ${f2(x.E75, 0)} | ${f2(x.sp50, 1)} | ${pct(x.under, x.c6)} (${pct(x.flat, x.c6)}) | ${pct(x.hit * 100, 100)}${b ? ` (${pct(b.hit * 100, 100)})` : ''} | ${f2(x.sevHit)} | ${x.win} · ${x.lose} · ${x.draw}${b ? ` (${b.win} · ${b.lose} · ${b.draw})` : ''} | ${f2(x.dealt)} · ${f2(x.recv)} | ${f2(x.fallsP)} | ${pct(x.exh * 100, 100)} | ${f2(x.stF, 1)} |`);
  }
  // 칸 모두 (닿음 합 · 판 합) — 닿음 판정 J 가운데값은 모든 칸의 손가락 긋기 닿음을 한데 모아
  if (Object.keys(C).length > 1) {
    const x = fightRow(runs);
    out.push(`| (칸 모두) | ${x.n} | ${x.fn} | **${f2(x.E50, 1)}** · ${f2(x.E75, 0)} | ${f2(x.sp50, 1)} | ${pct(x.under, x.c6)} (${pct(x.flat, x.c6)}) | ${pct(x.hit * 100, 100)} | ${f2(x.sevHit)} | ${x.win} · ${x.lose} · ${x.draw} | ${f2(x.dealt)} · ${f2(x.recv)} | ${f2(x.fallsP)} | ${pct(x.exh * 100, 100)} | ${f2(x.stF, 1)} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = loadRuns(rest.filter((x) => !x.startsWith('--')));
    const base = arg('base', null);
    console.log(aggMarkdown(runs, base ? loadRuns([base]) : null));
  } else {
    applySets(arg('set', ''));
    const cells = arg('cells', 'german:longsword,japanese:uchigatana').split(',');
    const spd = arg('spd', '3/5.5').split('/').map(Number);
    const all = {};
    for (const c of cells) {
      const [school, weapon] = c.split(':');
      all[c] = range(arg('seeds', '1-8')).flatMap((seed) => drillOne({ school, weapon, seed, dur: +arg('dur', 14), spd }));
      const x = drillRow(all[c]);
      console.log(`${arg('tag', arg('set', '지금'))} ${c} · 긋기 ${x.n} (닿음 ${x.touch}) · 판정 J 50 · 75 % ${f2(x.E50, 1)} · ${f2(x.E75, 1)} · 닿을 때 빠르기 ${f2(x.sp50)} · 칼끝 가장 빠름 ${f2(x.tip50, 1)} · 손 ${f2(x.hand50, 1)} · 6 J 넘은 닿음 가운데 문턱 밑 ${x.under}/${x.c6} · 베기 상처 ${x.wounds} · 긋기당 기력 ${f2(x.st50, 1)}`);
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), cells, all }));
  }
}
