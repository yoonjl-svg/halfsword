// ─────────────────────────────────────────────────────────────
//  riso_reach.mjs — 거리 판단 리솔루토 재기 (사장님 11/11 '거리 제한을 풀어서 잘못 판단하면 빗나가게' → '거리 판단에 맡기기 -> 진행하고' ·
//   같은 날 '리솔루토를 70%로 상향하고 파괴력을 0.5로 해.' · 기록 docs/strike/riso_reach_2026-11-11.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만).
//  fight: 싸움 = school_balance.mjs fightOne 그대로(사람 손가락 봇 · 실제 Input 터치 길 · 숙련 3 AI) + rapier_defence.mjs 꽂개(AI 첫 반응 · 닿음 때 — 읽기만 · 판 결과 바이트 같음) +
//   리솔루토 꽂개(읽기만): 낸 때 창 나이(연 뒤 실제 s) · 칼이 떨어진 뒤 지난 시간(open.apart — 거리 판단 켬만) · 창 길(touch · hold · beat) · 0.6 s 를 넘어 이어진 창에서 냈나 ·
//   낸 때 가슴 사이 · 두 칼 가까움 · 런지 몸 미끄러짐 · 앞발 · 칼끝이 겨눈 곳을 지난 길이(overshoot — 음수 = 모자람) · 런지 막힘 · 판마다 연 창 수 · 0.6 s 넘어 이어진 창 수
//  sweep: 서 있는 상대(AI 멈춤) 또는 산 AI(숙련 3) 앞 가슴 사이 g 에서 창을 열고 곧장 런지 — 맞음 · 심각도 · 첫 몸 닿음 때 · 미끄러짐 · overshoot · 그때 AI 꼴
//  node tools/sim/riso_reach.mjs fight [--cells=italian:rapier:longsword,italian:rapier:rapier] [--seeds=1-24] [--set=SECRET.risolutoReach=1,...] [--tag=이름] [--json=파일]
//  node tools/sim/riso_reach.mjs sweep [--gaps=1.8-3.2:0.1] [--seeds=1-4] [--live=0|1] [--opp=longsword] [--set=...] [--json=파일]
//  node tools/sim/riso_reach.mjs agg <json ...>   (판 표 · 기술 표(school_balance) · 리솔루토 표 · 낸 거리별 맞음)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, CONFIG, DT, THREE } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { fightOne, cellRow, techRows } from './school_balance.mjs';
import { makeProbe, respBefore, applySets } from './rapier_defence.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { bladesNear } from '../../src/italian_risoluto.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const NAME = 'andareRisoluto';
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });

/** 리솔루토 꽂개 — rapier_defence 꽂개를 감싸 낸 리솔루토마다 창 · 런지 기록을 붙인다 (읽기만) */
export function makeRisoProbe() {
  const base = makeProbe();
  let G = null;
  let P = null;
  let A = null;
  let pend = null;
  let R = null;
  let W = null;
  let wo = null; // 지금 열린 창 (목숨 재기)
  const lives = []; // 창마다 [연 뒤 닫힌 때 실제 s · 냈나 · 0.6 s 넘어 이어졌나]
  const streaks = []; // 두 칼이 가까운(bladesNear) 채 이어진 시간 (실제 s — 비기 · 판 시작 정지 동안 빼고 · 끝난 것만)
  let near = 0;
  const recs = new Map();
  const life = () => {
    if (W.open === wo) return;
    if (wo) lives.push([r3((wo.age ?? 0) / K), !!wo.fired, !!wo.ext]);
    wo = W.open?.S?.name === NAME ? W.open : null;
  };
  return {
    lives,
    streaks,
    init(o) {
      base.init(o);
      ({ G, P, A } = o);
      W = o.W;
      const f0 = W.fire.bind(W);
      W.fire = () => {
        const O = W.open;
        if (O) O.fired = true;
        const info = O && O.S?.name === NAME ? { age: r3((O.age ?? 0) / K), apart: O.apart == null ? null : r3(O.apart / K), ext: !!O.ext, path: O.ctx?.path ?? null, d: r3(P.foeDistance()), near: bladesNear(P, A), gapShort: !!O.gapShort } : null;
        const res = f0();
        if (res && info) pend = info;
        return res;
      };
    },
    step(cur, act) {
      base.step(cur, act);
      life();
      const nb = !P.skill.sec && P.alive && A.alive && bladesNear(P, A);
      if (nb) near += DT;
      else if (near > 0) streaks.push(r3(near / K)), (near = 0);
      if (cur && cur.name === NAME && !recs.has(cur) && pend) {
        R = { ...pend, over: null, slide: null, foot: null, blocked: null, glided: null, tipMax: 0 };
        recs.set(cur, R);
        pend = null;
      }
      if (!R || R.res) return;
      const I = P.iai;
      if (I?.kind === 'combo' && I.moves?.[0]?.lunge) {
        if (I.overshoot != null) R.over = r3(I.overshoot);
        R.tipMax = Math.max(R.tipMax, P.tipVel?.length?.() ?? 0);
      }
      const L = P.skill.sec?.lungeRes;
      if (L) Object.assign(R, { res: true, slide: r3(L.slide), foot: r3(L.foot), blocked: !!L.blocked, glided: L.glided ?? 0, tipMax: r3(R.tipMax) });
    },
    done(fires) {
      const b = base.done(fires);
      return fires.map((f, i) => (b[i] && recs.has(f) ? { ...b[i], riso: recs.get(f) } : b[i]));
    },
  };
}

/** 한 판 (fightOne + 꽂개) — 판마다 연 창 수 · 0.6 s 넘어 이어진 창 수 · 간격으로 막힌 창 수를 붙임 */
export function fightRiso(o) {
  let W = null;
  const pr = makeRisoProbe();
  const r = fightOne({ ...o, probe: pr, onRound: (x) => (W = x.W) });
  r.win2 = W ? { opened: W.opened, ext: W.riso?.reachExt ?? 0, gapBlocked: W.riso?.gapBlocked ?? 0, gapClosed: W.riso?.gapClosed ?? 0, gapHeld: W.riso?.gapHeld ?? 0, lives: pr.lives, streaks: pr.streaks } : null;
  return r;
}

/** 서 있는 상대 · 산 AI 앞 가슴 사이 gap 에서 창을 열고 곧장 런지 (lungeRun — italian_risoluto.test.mjs 와 같은 차례) */
export function lungeAt({ w = 'rapier', opp = 'longsword', gap = 2.2, seed = 9, live = false, wait = 0.3 } = {}) {
  const G = newRound({ weapon: w, weapon2: opp, gap, seed, ...(live ? { persona: { proficiency: 3 } } : {}) });
  applyWeaponMeasure(G.ai, opp);
  const P = G.player;
  const A = G.enemy;
  if (!live) G.ai.update = () => {};
  P.foe = A;
  A.foe = P;
  const tip = new THREE.Vector3();
  try {
    for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + wait) / DT); i++) G.step();
    const pg = new PlayerParryGuard(P, A);
    P.stamina.controller = pg;
    const ps = new PlayerSecretWatch(P, A);
    ps.openWindow({ ev: 'risoluto', path: 'touch', held: 0 });
    const o = ps.fire();
    const out = { gap: r3(gap), d0: r3(P.foeDistance()), near0: bladesNear(P, A), ok: !!(o && P.skill.secret(o)), sev: 0, hit: false, body: null, clash: null, over: null, slide: null, foot: null, blocked: null, tipMax: 0, ai: null, aiBody: null, tipGapMin: Infinity };
    const t0 = G.t;
    const ow = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, ...rest) => {
      ow?.(att, vic, r, ...rest);
      if (att !== P || vic !== A) return;
      if (r.type !== 'blunt' && (r.severity ?? 0) > 0) (out.sev += r.severity), (out.hit = true);
      if (out.body == null) Object.assign(out, { body: r3((G.t - t0) / K), bodyType: r.type, bodyE: r3(r.energy), aiBody: { mode: G.ai.mode, void: G.ai.mode === 'defend' ? !!G.ai.defVoid : null } });
    };
    const oc = G.combat.hooks.onClash;
    G.combat.hooks.onClash = (point, sp, info) => {
      oc?.(point, sp, info);
      if (out.clash == null && ((info.a === P && info.b === A) || (info.a === A && info.b === P))) out.clash = r3((G.t - t0) / K);
    };
    for (let i = 0; i < Math.round(1.2 * K / DT); i++) {
      G.step();
      const I = P.iai;
      if (I?.kind === 'combo' && I.moves?.[0]?.lunge) {
        if (I.overshoot != null) out.over = r3(I.overshoot);
        out.tipMax = Math.max(out.tipMax, P.tipVel.length());
      }
      const c = A.bodies.chest.translation();
      P.bladePoint(1, tip);
      out.tipGapMin = Math.min(out.tipGapMin, Math.hypot(tip.x - c.x, tip.y - c.y, tip.z - c.z));
      const L = P.skill.sec?.lungeRes;
      if (L && out.slide == null) Object.assign(out, { slide: r3(L.slide), foot: r3(L.foot), blocked: !!L.blocked });
      if (out.ai == null && G.t - t0 >= 0.2 * K) out.ai = { mode: G.ai.mode, void: G.ai.mode === 'defend' ? !!G.ai.defVoid : null };
    }
    out.tipMax = r3(out.tipMax);
    out.tipGapMin = r3(out.tipGapMin);
    out.sev = r3(out.sev);
    out.dEnd = r3(P.foeDistance());
    return out;
  } finally {
    G.world.free();
  }
}

// ── 표 ──
const mean = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const q = (a, p) => {
  const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i));
};
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
const f2 = (x, k = 2) => (x == null ? '–' : x.toFixed(k));
export const BINS = [[0, 1.8], [1.8, 2.0], [2.0, 2.2], [2.2, 2.4], [2.4, 2.6], [2.6, 9]];
const binName = ([a, b]) => (a === 0 ? `< ${b}` : b === 9 ? `≥ ${a}` : `${a} ~ ${b}`);

/** 낸 리솔루토 기록 (판 결과 fires + 꽂개) */
export function risoFires(runs) {
  return runs.flatMap((r) => r.fires.map((f, i) => ({ f, p: r.probe?.[i] ?? null, cell: `${r.school}:${r.weapon}:${r.opp}` })).filter((x) => x.f.name === NAME));
}

const lifeCell = (rs) => {
  const L = rs.flatMap((r) => r.win2?.lives ?? []);
  if (!L.length) return '–';
  const a = L.map((x) => x[0]);
  return `${f2(q(a, 0.5))} · ${f2(q(a, 0.9))} · ${f2(Math.max(...a))} · ${L.filter((x) => !x[1]).length}/${L.length}`;
};
export function risoMarkdown(runs) {
  const out = [];
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  out.push('| 칸 | 판 | 이김 · 짐 · 비김 | 준 · 받은 심각도/판 | 리솔루토 낸 수 (판당) | 맞음 | 맞음당 심각도 | 닿음당 J | 1 s 안 쓰러뜨림 | 막힘 · 헛침 · 몸 닿음만 | AI 칼로 막음 · 물러나 피함 (닿기 전) | 첫 닿음 s (50 %) | 칼끝 m/s (50 %) | 낸 거리 (10 · 50 · 90 %) | 창 나이 s (50 · 90 %) | 0.6 s 넘은 창에서 냄 | 연 창/판 · 0.6 s 넘어 이어짐 | 창 목숨 s (50 · 90 % · 가장 긺) · 안 쓰고 닫힘 |');
  out.push('|---|---:|---|---|---:|---:|---:|---:|---:|---|---|---:|---:|---|---|---:|---|---|');
  for (const [k, rs] of Object.entries(cells)) {
    const c = cellRow(rs);
    const fs = risoFires(rs);
    const n = fs.length;
    const hit = fs.filter((x) => x.f.w > 0);
    const tc = (p) => (p ? Math.min(p.body ?? Infinity, p.clash ?? Infinity) : Infinity);
    const outc = (o) => fs.filter((x) => x.p?.out === o).length;
    const rb = (b) => fs.filter((x) => x.p && respBefore(x.p) === b).length;
    const opened = rs.reduce((s, r) => s + (r.win2?.opened ?? 0), 0);
    const ext = rs.reduce((s, r) => s + (r.win2?.ext ?? 0), 0);
    out.push(`| ${k} | ${c.n} | ${c.win} · ${c.lose} · ${c.n - c.win - c.lose} | ${f2(c.dealt)} · ${f2(c.recv)} | ${n} (${f2(n / c.n)}) | ${pct(hit.length, n)} | ${f2(mean(hit.map((x) => x.f.sev)))} | ${f2(mean(fs.filter((x) => x.f.c > 0).map((x) => x.f.E)), 0)} | ${pct(fs.filter((x) => x.f.k1).length, n)} | ${outc('blocked')} · ${outc('whiff')} · ${outc('touch')} | ${rb('parry')} · ${rb('void')} | ${f2(q(fs.map((x) => tc(x.p)).filter(Number.isFinite), 0.5))} | ${f2(q(fs.map((x) => x.p?.riso?.tipMax), 0.5), 1)} | ${[0.1, 0.5, 0.9].map((p) => f2(q(fs.map((x) => x.f.d), p))).join(' · ')} | ${f2(q(fs.map((x) => x.p?.riso?.age), 0.5))} · ${f2(q(fs.map((x) => x.p?.riso?.age), 0.9))} | ${fs.filter((x) => x.p?.riso?.ext).length} | ${f2(opened / c.n)} · ${ext} | ${lifeCell(rs)} |`);
  }
  out.push('', '#### 낸 때 가슴 사이(m)별 — 낸 수 · 맞음 (칸 모두)', '', `| 묶음 | ${BINS.map(binName).join(' | ')} |`, `|---|${BINS.map(() => '---:').join('|')}|`);
  const fs = risoFires(runs);
  const cellOf = (x) => `${BINS.map((B) => { const g = x.filter((y) => y.f.d >= B[0] && y.f.d < B[1]); return g.length ? `${g.filter((y) => y.f.w > 0).length}/${g.length} (${pct(g.filter((y) => y.f.w > 0).length, g.length)})` : '–'; }).join(' | ')}`;
  out.push(`| 모두 | ${cellOf(fs)} |`);
  out.push(`| 칼이 떨어진 뒤 냄 | ${cellOf(fs.filter((x) => x.p?.riso && !x.p.riso.near))} |`);
  out.push(`| 0.6 s 넘은 창에서 냄 | ${cellOf(fs.filter((x) => x.p?.riso?.ext))} |`);
  out.push(`| 미끄러짐 (가운데 m) | ${BINS.map((B) => f2(q(fs.filter((y) => y.f.d >= B[0] && y.f.d < B[1]).map((y) => y.p?.riso?.slide), 0.5))).join(' | ')} |`);
  out.push(`| 칼끝이 겨눈 곳을 지난 길이 (가운데 m · 음수 = 모자람) | ${BINS.map((B) => f2(q(fs.filter((y) => y.f.d >= B[0] && y.f.d < B[1]).map((y) => y.p?.riso?.over), 0.5))).join(' | ')} |`);
  out.push(`| AI 칼로 막음 · 물러나 피함 (닿기 전) | ${BINS.map((B) => { const g = fs.filter((y) => y.f.d >= B[0] && y.f.d < B[1]); return g.length ? `${g.filter((y) => y.p && respBefore(y.p) === 'parry').length} · ${g.filter((y) => y.p && respBefore(y.p) === 'void').length}` : '–'; }).join(' | ')} |`);
  return out.join('\n');
}

export function aggAll(runs) {
  const out = [risoMarkdown(runs)];
  const S = runs.flatMap((r) => r.win2?.streaks ?? []);
  if (S.length) out.push('', `두 칼이 가까운(bladesNear 0.15 m · 맞닿음) 채 이어진 시간 (실제 s · ${S.length} 번): 50 % ${f2(q(S, 0.5))} · 90 % ${f2(q(S, 0.9))} · 99 % ${f2(q(S, 0.99))} · 가장 긺 ${f2(Math.max(...S))} · 1 s 넘음 ${S.filter((x) => x > 1).length} · 3 s 넘음 ${S.filter((x) => x > 3).length}`);
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  for (const [k, rs] of Object.entries(cells)) {
    const t = techRows(rs).find((x) => x.name === NAME);
    if (t) out.push('', `${k} 기술 표 리솔루토 줄 (school_balance techRows): 낸 수 ${t.n} · 몸 닿음 ${pct(t.contact * t.n, t.n)} · 맞음 ${pct(t.hit * t.n, t.n)} · 맞음당 심각도 ${f2(t.sevHit)} · 닿음당 J ${f2(t.Ehit, 0)} · 가장 큰 J ${f2(t.Emax, 0)} · 1 s 안 쓰러뜨림 ${pct(t.kill1 * t.n, t.n)} · 1 s 안 받은 심각도 ${f2(t.recv1)}`);
  }
  return out.join('\n');
}

export function sweepMarkdown(rows) {
  const out = ['| 가슴 사이 (낸 때 m) | 판 | 맞음 | 심각도 (가운데) | 첫 몸 닿음 s | 미끄러짐 m | 앞발 m | 칼끝이 겨눈 곳을 지난 길이 m | 칼끝 → 가슴 가장 가까움 m | 칼끝 m/s | 0.2 s 째 AI 막기 꼴 (물러나기) | 막힘 |', '|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|'];
  const g = {};
  for (const r of rows) (g[r.gap] ??= []).push(r);
  for (const [gap, rs] of Object.entries(g).sort((a, b) => +a[0] - +b[0])) {
    const n = rs.length;
    out.push(`| ${f2(q(rs.map((r) => r.d0), 0.5))} (${gap}) | ${n} | ${pct(rs.filter((r) => r.hit).length, n)} | ${f2(q(rs.map((r) => r.sev), 0.5))} | ${f2(q(rs.map((r) => r.body), 0.5))} | ${f2(q(rs.map((r) => r.slide), 0.5))} | ${f2(q(rs.map((r) => r.foot), 0.5))} | ${f2(q(rs.map((r) => r.over), 0.5))} | ${f2(q(rs.map((r) => r.tipGapMin), 0.5))} | ${f2(q(rs.map((r) => r.tipMax), 0.5), 1)} | ${rs.filter((r) => r.ai?.mode === 'defend').length} (${rs.filter((r) => r.ai?.void).length}) | ${rs.filter((r) => r.blocked).length} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const files = rest.filter((x) => !x.startsWith('--')).map((p) => JSON.parse(readFileSync(p, 'utf8')));
    if (files[0]?.sweep) console.log(sweepMarkdown(files.flatMap((x) => x.rows)));
    else console.log(aggAll(files.flatMap((x) => x.runs)));
  } else if (mode === 'sweep') {
    applySets(arg('set', ''));
    const [g0, g1, st] = arg('gaps', '1.8-3.2:0.1').split(/[-:]/).map(Number);
    const seeds = range(arg('seeds', '1-4'));
    const live = arg('live', '0') === '1';
    const rows = [];
    for (let g = g0; g <= g1 + 1e-9; g += st) for (const seed of seeds) rows.push({ ...lungeAt({ gap: +g.toFixed(3), seed, live, opp: arg('opp', 'longsword'), wait: +arg('wait', '0.3') }), seed });
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ sweep: true, set: arg('set', ''), live, rows }));
    console.log(sweepMarkdown(rows));
  } else {
    applySets(arg('set', ''));
    const cells = arg('cells', 'italian:rapier:longsword,italian:rapier:rapier').split(',');
    const seeds = range(arg('seeds', '1-24'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = fightRiso({ school, weapon, opp, seed, dur: +arg('dur', 30), tech: +arg('tech', 0.35) });
        runs.push(r);
        console.error(JSON.stringify({ c, seed, win: r.win, lose: r.lose, T: r.T, fires: r.fires.length, ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set: arg('set', ''), cells, seeds, runs }));
    console.log(aggAll(runs));
  }
}
