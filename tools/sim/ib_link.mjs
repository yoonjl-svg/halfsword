// ─────────────────────────────────────────────────────────────
//  ib_link.mjs — 이베리아 B7 '이어 돌리기' 재기 · 그림 자료 (11/14 사장님 '이베리아 이어 돌리기로 진행해.' — config IB_LINK · src/iberian_link.js · 기록 docs/strike/ib_link_2026-11-14.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만).
//   air   = 허공 이어 긋기 (상대 6 m 밖 · AI 끔): 손가락이 분노의 베기(↙)를 긋고 곧장 다음 큰 칼 방향(↘ 왼 분노 · ↙ 분노 · ↓ 정수리 · ← 가로)만 긋는다 —
//           이어 돌리기가 났나 · 원 시간 · 다시 그은 칼이 무엇으로 읽혔나 · 사슬 n · 위력 · 칼끝이 원 동안 선 몫 · 긋기 사이(앞 칼 끝 → 다음 칼 시작)
//   trace = 위 한 벌의 몸 · 칼 자리 줄 (그림 — tools/sim/ib_link_draw.py)
//   fight = 유파 표 칸(school_balance.mjs fightOne — 손가락 봇 대 숙련 3 AI)을 판 ① ~ ⑤ 로 · 판당 사슬 · 긋기 사이 · 분당 긋기 · 맞음 · 받은 심각도 · 알티바슈 · 결과
//  node tools/sim/ib_link.mjs air [--ws=zweihander] [--next=zornhauL,zornhau,oberhau,zwerchL] [--set=IB_LINK.on=0]
//  node tools/sim/ib_link.mjs trace --json=파일 [--ws=zweihander] [--next=zornhauL]
//  node tools/sim/ib_link.mjs fight --cfg=1|2|3|4|5 [--cells=…] [--seeds=1-24] [--json=파일]
//  node tools/sim/ib_link.mjs agg <json …>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE, AI } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { isMain } from './is_main.mjs';

const { SKILL, IB_LINK, UNIQUE_ASSIST: UA } = CONFIG;
const K = CONFIG.TIME.k;
const FRAME = 1 / 60; // 실제 s
const SPF = Math.max(1, Math.round((FRAME * K) / DT)); // 프레임당 물리 스텝 (게임 시간)
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
/** 판 (기록 §4 · §10): ① 11/12 풍차 베기 · ② 이어 돌리기(맞바꿈 끔) · ③ + B · a = ⓐ 이어 돌리기 + 새 맞바꿈 B12(기본) · b = ⓑ 맞바꿈 없음(= ②) — 전 ④ ⑤(옛 C' 맞바꿈)는 11/14 걷어냄 */
export const CFG = { 1: { on: 0, chainArm: 0, trade: 0 }, 2: { on: 1, chainArm: 0, trade: 0 }, 3: { on: 1, chainArm: 1, trade: 0 }, a: { on: 1, chainArm: 0, trade: 1 }, b: { on: 1, chainArm: 0, trade: 0 } };
export function applyCfg(n) {
  const c = CFG[n];
  if (!c) return;
  IB_LINK.on = c.on;
  IB_LINK.chainArm = c.chainArm;
  IB_LINK.trade = c.trade;
}

/** 손가락 줄 (패드 m · 실제 프레임마다): 곧게 v 패드 m/s */
function line(from, to, v) {
  const out = [];
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.round(d / v / FRAME));
  for (let i = 0; i < n; i++) out.push([(to[0] - from[0]) / n, (to[1] - from[1]) / n]);
  return out;
}
/** 기술 길을 손가락으로 (지금 손 자리에서 그 기술 길의 옮김만 — 시작 자리로 가지 않음) */
function swipeOf(name, v) {
  const t = TECH_BY_NAME[name];
  const pts = [t.from, ...t.path];
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(...line(pts[i], pts[i + 1], v));
  return out;
}

/**
 * 허공 이어 긋기 한 벌: 쉴 자세 → 분노의 베기 시작 자리로(느리게) → 분노의 베기(↙) → next 칼마다 곧장 그 방향 긋기(시작 자리로 가지 않음) → 쉼.
 *  돌려줌 { cuts: 진짜 긋기 [{ t0, t1, n, tech }] · links: 이어 돌리기 [{ t0, t1, tech }] · gaps · trace(줄 — trace 면) }
 */
export function airOne({ ws = 'zweihander', next = ['zornhauL', 'zornhau'], v = 4.5, pause = 0.1, seed = 1, trace = false, repos = null } = {}) {
  const kit = kitFromNodes('iberian', allNodeIds('iberian'));
  const G = newRound({ walls: false, weapon: ws, weapon2: 'longsword', seed, gap: 6, kit });
  const P = G.player;
  const E = G.enemy;
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  P.humanInput = true;
  for (const x of [P, E]) x.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  const uq = new PlayerUniqueAssist(P, { names: kit.unique });
  // repos: 다음 칼 시작 자리로 손가락을 옮긴 뒤 긋기(이어 돌리기가 없는 판 — 사람이 하던 대로 · school_balance 봇 strokeQ 와 같은 손: 자세로 돌아가는 빠르기 · 4 프레임 멈춤) · 아니면 곧장 그 방향만
  const re = repos ?? !IB_LINK.on;
  const q = [];
  const z = TECH_BY_NAME.zornhau;
  for (let i = 0; i < Math.round(0.6 / FRAME); i++) q.push([0, 0]);
  q.push(...line([P.handOffset.x, P.handOffset.y], z.from, 1.0));
  for (let i = 0; i < 6; i++) q.push([0, 0]);
  q.push(...swipeOf('zornhau', v));
  const plan = next.slice();
  let wait = null; // 다음 칼을 그을 때 (실제 s) — 칼이 다 나가고(휘두르기 · 이어 돌리기 끝) pause 뒤 (사람 눈)
  const cuts = [];
  const links = [];
  const rows = [];
  let wasSw = false;
  let cur = null;
  let link = null;
  let k = 0;
  const tip = new THREE.Vector3();
  const tipPrev = new THREE.Vector3();
  let havePrev = false;
  let t = 0;
  let tail = null; // 다 그은 뒤 0.6 s 더 (마지막 칼 끝을 읽음)
  G.before = () => {
    if (k++ % SPF === 0) {
      if (!q.length && plan.length) {
        if (uq.link || P.skill.swinging || P.ibLink) wait = null;
        else if (wait == null) wait = t + pause;
        else if (t >= wait) {
          const n = plan.shift();
          const T = TECH_BY_NAME[n];
          if (re) {
            q.push(...line([P.handOffset.x, P.handOffset.y], T.from, SKILL.recoverSpeed));
            for (let i = 0; i < 4; i++) q.push([0, 0]);
          }
          q.push(...swipeOf(n, v));
          wait = null;
        }
      }
      const d = q.shift() ?? [0, 0];
      uq.feed(d[0], d[1], FRAME, false);
      P.handOffset.x += d[0];
      P.handOffset.y += d[1];
      P.handHeld = q.length > 0 || plan.length > 0;
      P.inputActive = Math.abs(d[0]) + Math.abs(d[1]) > 1e-5;
    }
    P.move.set(0, 0);
    P.stickX = P.stickY = 0;
  };
  const t0 = G.t;
  try {
    while (tail == null || t < tail) {
      if (tail == null && !(q.length || plan.length || t < 2 || P.skill.swinging || uq.link)) tail = t + 0.6;
      G.step();
      t = (G.t - t0) / K; // 실제 s
      const sw = !!P.ibFlowSw;
      if (sw && !wasSw) cur = { t0: t, n: null, tech: uq.cur?.tech ?? null };
      if (!sw && wasSw && cur) {
        cur.t1 = t;
        cur.real = !!P.ibFlowWasCut;
        cur.n = P.ibFlowChain ? P.ibCutN ?? 0 : 0;
        cur.k = r3(P.ibFlowOn ? P.ibFlowK() : 1);
        cuts.push(cur);
        cur = null;
      }
      if (cur && !cur.tech && uq.cur?.tech) cur.tech = uq.cur.tech;
      wasSw = sw;
      if (P.ibLink && !link) link = { t0: t, tech: P.ibLink.tech, dpsi: P.ibLink.plan ? r3((P.ibLink.plan.dpsi * 180) / Math.PI) : null, T: r3(P.ibLink.T / K), v0: r3(P.ibLink.speed?.v0 ?? P.ibLink.bridge?.v0), v1: r3(P.ibLink.speed?.v1 ?? P.ibLink.bridge?.v3), still: 0, n: 0, vmax: 0 }; // 11/15 넘기기 판은 원 길(plan) 없음
      P.bladePoint(1, tip);
      const vt = havePrev ? tip.distanceTo(tipPrev) / DT : 0; // 칼끝 실제 옮김 빠르기 (놓인 칼도)
      tipPrev.copy(tip);
      havePrev = true;
      if (link && !link.t1) {
        link.n++;
        if (vt < 1.5) link.still++;
        if (link.n > 1) link.vmax = Math.max(link.vmax, vt);
        if (!P.ibLink) (link.t1 = t), links.push(link), (link = null);
      }
      if (trace) rows.push(snap(P, t, vt));
      if (t > 12) break;
    }
  } finally {
    G.world.free();
  }
  const real = cuts.filter((c) => c.real);
  const gaps = [];
  for (let i = 0; i + 1 < real.length; i++) gaps.push(r3(real[i + 1].t0 - real[i].t1));
  return { ws, next, repos: re, cuts: real.map((c) => ({ t0: r3(c.t0), t1: r3(c.t1), n: c.n, k: c.k, tech: c.tech })), links: links.map((l) => ({ t0: r3(l.t0), dur: r3(l.t1 - l.t0), T: l.T, v0: l.v0, v1: l.v1, tech: l.tech, dpsi: l.dpsi, still: r3(l.still / Math.max(1, l.n)), vmax: r3(l.vmax) })), gaps, stats: uq.stats.link ?? null, ...(trace ? { rows } : {}) };
}

/** 몸 · 칼 자리 (그림 — 월드 m · 몸 틀 yaw 도 같이) */
function snap(P, t, vt) {
  const p = (b) => {
    const x = P.bodies[b]?.translation();
    return x ? [r3(x.x), r3(x.y), r3(x.z)] : null;
  };
  const b0 = P.bladePoint(0, new THREE.Vector3());
  const b1 = P.bladePoint(1, new THREE.Vector3());
  const q = P.yaw;
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  return { t: r3(t), link: !!P.ibLink, x: P.ibLink ? r3(P.ibLink.x) : null, sw: !!P.skill.swinging, vt: r3(vt), fwd: [r3(fwd.x), r3(fwd.z)], side: P.side, head: p('head'), chest: p('chest'), abdomen: p('abdomen'), pelvis: p('pelvis'), uarmS: p('uarmS'), farmS: p('farmS'), uarmO: p('uarmO'), farmO: p('farmO'), thighR: p('thighF'), thighL: p('thighB'), shinR: p('shinF'), shinL: p('shinB'), footR: p('footF'), footL: p('footB'), b0: [r3(b0.x), r3(b0.y), r3(b0.z)], b1: [r3(b1.x), r3(b1.y), r3(b1.z)] };
}

const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor((b.length - 1) / 2)] : null; };
const f2 = (x, k = 2) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(k));
/** 판 ① ~ ⑤ 칸 묶음 표 (Markdown) — runs 에 cfg 가 적혀 있음 */
/** 맞바꿈 표 (11/14 — 기록 §10): 판 결과 · 받은 피해 · 넘긴 맞음 · 아낀 심각도 · 쓴 기력 (칸마다 + 다섯 칸 모두) */
export function tradeTable(runs) {
  const by = {};
  for (const r of runs) {
    (by[`${r.cfg}|${r.weapon}:${r.opp}`] ??= []).push(r);
    (by[`${r.cfg}|다섯 칸 모두`] ??= []).push(r);
  }
  const out = ['| 판 | 칸 (내 칼 : 상대) | 판 수 | 이김 · 짐 · 비김 | 받은 심각도/판 | 받은 맞음/판 | 받은 의식/판 | 준 심각도/판 | 넘긴 맞음/판 | 아낀 심각도/판 (넘긴 맞음당) | 쓴 기력/판 (넘긴 맞음당) | 이어 돌리기/판 (그만둠) | 판 길이 s |', '|---|---|---:|---|---:|---:|---:|---:|---:|---|---|---|---:|'];
  for (const [k, rs] of Object.entries(by).sort()) {
    const [cfg, cell] = k.split('|');
    const n = rs.length;
    const W = rs.filter((r) => r.win).length;
    const Ls = rs.filter((r) => r.lose).length;
    const tn = rs.reduce((x, r) => x + (r.ib?.trade?.n ?? 0), 0);
    const ts = rs.reduce((x, r) => x + (r.ib?.trade?.sev ?? 0), 0);
    const tc = rs.reduce((x, r) => x + (r.ib?.trade?.cost ?? 0), 0);
    const lf = rs.reduce((x, r) => x + (r.ib?.link?.fired ?? 0), 0);
    const ld = rs.reduce((x, r) => x + (r.ib?.link?.done ?? 0), 0);
    out.push(`| ${cfg} | ${cell} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${f2(mean(rs.map((r) => r.recv)))} | ${f2(mean(rs.map((r) => r.recvN)))} | ${f2(mean(rs.map((r) => r.consR ?? 0)))} | ${f2(mean(rs.map((r) => r.dealt)))} | ${f2(tn / n)} | ${f2(ts / n)} (${tn ? f2(ts / tn) : '—'}) | ${f2(tc / n, 1)} (${tn ? f2(tc / tn, 1) : '—'}) | ${f2(lf / n)} (${lf - ld}) | ${f2(mean(rs.map((r) => r.T)), 1)} |`);
  }
  return out.join('\n');
}

export function aggTable(runs) {
  const by = {};
  for (const r of runs) (by[`${r.cfg}${r.secretOn === false ? ' 비기 끔' : ''}|${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = ['| 판 | 칸 (내 칼 : 상대) | 판 수 | 이김 · 짐 · 비김 | 사슬 길이 평균 (2 넘는 사슬) | 긋기 사이 빈 시간 s (사슬 뜻 안 · 중앙) | 이은 칼 사이 s | 분당 진짜 긋기 | 이은 칼 몫 | 맞음/판 (준 심각도) | 받은 심각도/판 | 알티바슈/판 | 이어 돌리기/판 (끝까지 · 그만둠) | 사슬 무장/판 |', '|---|---|---:|---|---|---|---:|---:|---:|---|---:|---:|---|---:|'];
  for (const [k, rs] of Object.entries(by).sort()) {
    const [cfg, cell] = k.split('|');
    const n = rs.length;
    const W = rs.filter((r) => r.win).length;
    const Ls = rs.filter((r) => r.lose).length;
    const chains = rs.flatMap((r) => r.ib?.chains ?? []);
    const long = chains.filter((c) => c >= 2);
    const gapAct = rs.flatMap((r) => r.ib?.gapAct ?? []);
    const gapAll = rs.flatMap((r) => r.ib?.gapAll ?? []);
    const cuts = rs.reduce((x, r) => x + (r.ib?.cuts ?? 0), 0);
    const chained = rs.reduce((x, r) => x + (r.ib?.chained ?? 0), 0);
    const T = rs.reduce((x, r) => x + r.T, 0);
    const lf = rs.reduce((x, r) => x + (r.ib?.link?.fired ?? 0), 0);
    const ld = rs.reduce((x, r) => x + (r.ib?.link?.done ?? 0), 0);
    out.push(`| ${cfg} | ${cell} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${f2(mean(chains))} (${long.length} · ${f2(mean(long))}) | ${f2(mean(gapAct))} · ${f2(med(gapAct))} (${gapAct.length}) | ${f2(mean(gapAll))} | ${f2((cuts / Math.max(1e-6, T)) * 60, 1)} | ${cuts ? Math.round((100 * chained) / cuts) : 0}% | ${f2(mean(rs.map((r) => r.dealtN)))} (${f2(mean(rs.map((r) => r.dealt)))}) | ${f2(mean(rs.map((r) => r.recv)))} | ${f2(mean(rs.map((r) => r.ib?.altib ?? 0)))} | ${f2(lf / n)} (${ld} · ${lf - ld}) | ${f2(mean(rs.map((r) => r.ib?.chainArms ?? 0)))} |`);
  }
  return out.join('\n');
}

/**
 * AI 대 AI (11/14 사장님 '모두 본판에 넣어 ai에게도 똑같이 적용해' — 기록 §11): 이베리아 AI(적 자리 · weapon) 대 롱소드 AI(opp) · 둘 다 숙련 5 · 벽 있음 · dur 초 ·
 *  판 'ai0' = AI 풍차 베기(11/14 전 판) · 'ai1' = AI 이어 돌리기 + 맞바꿈(기본) · 'ai1n' = AI 이어 돌리기만(맞바꿈 끔)
 */
export const AI_CFG = { ai0: { ai: 0, trade: 1 }, ai1: { ai: 1, trade: 1 }, ai1n: { ai: 1, trade: 0 } };
export function aiFightOne({ weapon = 'zweihander', opp = 'longsword', seed = 1, dur = 30, prof = 5 }) {
  const G = newRound({ walls: true, seed, weapon: opp, weapon2: weapon, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const P = G.player; // 롱소드 AI
  const E = G.enemy; // 이베리아 AI
  const sev = { E: 0, P: 0, En: 0, Pn: 0 };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (vic === E) (sev.E += sv), (sev.En += sv > 0 ? 1 : 0);
    if (vic === P) (sev.P += sv), (sev.Pn += sv > 0 ? 1 : 0);
  };
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(P) && !out(E)) G.step();
  const st = G.ai.stats;
  const L = E.ibTradeLog ?? [];
  const r = { weapon, opp, seed, T: +G.t.toFixed(3), win: out(P) && !out(E), lose: out(E) && !out(P), recv: +sev.E.toFixed(4), recvN: sev.En, dealt: +sev.P.toFixed(4), dealtN: sev.Pn,
    link: st.ibLink ? { fired: st.ibLink.fired, done: st.ibLink.done, cancel: st.ibLink.cancel } : { fired: 0, done: 0, cancel: {} }, cingir: st.cingir?.fired ?? 0,
    trade: { n: L.length, sev: +L.reduce((a, k) => a + k.sev, 0).toFixed(4), cost: +(E.ibTradeCost ?? 0).toFixed(3) }, states: `${P.state}/${E.state}` };
  G.world.free();
  return r;
}
export function aiTable(runs) {
  const by = {};
  for (const r of runs) {
    (by[`${r.cfg}|${r.weapon}:${r.opp}`] ??= []).push(r);
    (by[`${r.cfg}|모두`] ??= []).push(r);
  }
  const out = ['| 판 | 칸 (이베리아 AI : 상대 AI) | 판 수 | 이김 · 짐 · 비김 | 받은 심각도/판 | 준 심각도/판 | 이어 돌리기/판 (끝까지 · 그만둠) | 풍차 베기/판 | 넘긴 맞음/판 | 아낀 심각도/판 | 쓴 기력/판 | 판 길이 s |', '|---|---|---:|---|---:|---:|---|---:|---:|---:|---:|---:|'];
  for (const [k, rs] of Object.entries(by).sort()) {
    const [cfg, cell] = k.split('|');
    const n = rs.length;
    const W = rs.filter((r) => r.win).length;
    const Ls = rs.filter((r) => r.lose).length;
    const lf = rs.reduce((x, r) => x + r.link.fired, 0);
    const ld = rs.reduce((x, r) => x + r.link.done, 0);
    out.push(`| ${cfg} | ${cell} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${f2(mean(rs.map((r) => r.recv)))} | ${f2(mean(rs.map((r) => r.dealt)))} | ${f2(lf / n)} (${ld} · ${lf - ld}) | ${f2(mean(rs.map((r) => r.cingir)))} | ${f2(mean(rs.map((r) => r.trade.n)))} | ${f2(mean(rs.map((r) => r.trade.sev)))} | ${f2(mean(rs.map((r) => r.trade.cost)), 1)} | ${f2(mean(rs.map((r) => r.T)), 1)} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => {
    const a = rest.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : d;
  };
  applySets(arg('set', ''));
  if (mode === 'air' || mode === 'trace') {
    const ws = arg('ws', 'zweihander');
    const next = arg('next', 'zornhauL,zornhau').split(',');
    const r = airOne({ ws, next, trace: mode === 'trace', v: +arg('v', 4.5), pause: +arg('pause', 0.1) });
    if (mode === 'trace') writeFileSync(arg('json', '.tmp_ib_link_trace.json'), JSON.stringify(r));
    const { rows, ...o } = r;
    console.log(JSON.stringify(o, null, 1));
  } else if (mode === 'fight') {
    const cfg = arg('cfg', '2');
    applyCfg(cfg);
    const { fightOne } = await import('./school_balance.mjs');
    const cells = arg('cells', 'iberian:zweihander:longsword').split(',');
    const seeds = range(arg('seeds', '1-24'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = fightOne({ school, weapon, opp, seed, dur: +arg('dur', 30), ibBot: arg('ibBot', 'chain'), secret: arg('secret', '1') !== '0' });
        r.cfg = cfg;
        r.secretOn = arg('secret', '1') !== '0';
        delete r.reads;
        runs.push(r);
        console.error(JSON.stringify({ cfg, c, seed, win: r.win, lose: r.lose, T: r.T, ib: r.ib ? { cuts: r.ib.cuts, chains: r.ib.chains, link: r.ib.link?.fired ?? 0 } : null, s: Math.round((Date.now() - t0) / 1000) }));
        if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify({ cfg, cells, seeds, set: arg('set', ''), runs }));
      }
    }
    console.log(aggTable(runs));
  } else if (mode === 'aifight') {
    const cfg = arg('cfg', 'ai1');
    Object.assign(IB_LINK, AI_CFG[cfg]);
    const cells = arg('cells', 'zweihander:longsword').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const runs = [];
    for (const c of cells) {
      const [weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = aiFightOne({ weapon, opp, seed, dur: +arg('dur', 30), prof: +arg('prof', 5) });
        r.cfg = cfg;
        runs.push(r);
        console.error(JSON.stringify(r));
        if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify({ cfg, cells, seeds, runs }));
      }
    }
    console.log(aiTable(runs));
  } else if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(arg('table', '') === 'trade' ? tradeTable(runs) : arg('table', '') === 'ai' ? aiTable(runs) : aggTable(runs));
  }
}
