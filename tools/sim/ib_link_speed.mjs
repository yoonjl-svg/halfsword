// ─────────────────────────────────────────────────────────────
//  ib_link_speed.mjs — 사슬 칼 빠르기 시제품 재기 (11/15 사장님 "이어돌리기로 이어진 칼의 속도를 인위적으로 좀 더 빠르게 하면 어떨지도 검토해봐. 최대 3~4번까지 매번 이어질 때마다 +5~10% 합산." —
//   config IB_LINK.chainSpeed · iberian_link.js linkBoost · 기록 docs/strike/ib_link_2026-11-15.md). 판: off · p5n3 · p5n4 · p10n3 · p10n4 (p = 넘김마다 더하는 몫 · n = 몇 번째 넘김까지)
//   human = 사람 손가락 봇이 서 있는 과녁(AI 끔 · 안 죽음) 앞에서 큰 칼 넷 사슬(ib_link_chain.mjs 의 스물다섯 줄 · 쉼 gap): 몇째 칼마다 칼끝 가장 빠름 · 맞음 · 판정 에너지 · 기력
//   ai    = AI 대 AI (이베리아 츠바이핸더 AI : 롱소드 AI · 숙련 5 · seeds): 이김 · 짐 · 사슬 길이 나눔(넘김 수) · 이은 칼 맞음 · 에너지 · 더 쓴 기력
//  node tools/sim/ib_link_speed.mjs human --cfg=off|p5n3|… [--ws=zweihander] [--gap=0.1] [--json=…]
//  node tools/sim/ib_link_speed.mjs ai --cfg=… [--seeds=1-12] [--json=…]
//  node tools/sim/ib_link_speed.mjs agg <json …>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, CONFIG, AI } from './harness_m.mjs';
import { chainRun, seqs } from './ib_link_chain.mjs';
import { isMain } from './is_main.mjs';
import { applySets } from './ib_link.mjs';

const { IB_LINK } = CONFIG;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export const CFGS = { off: { on: 0, p: 0.05, n: 3 }, p5n3: { on: 1, p: 0.05, n: 3 }, p5n4: { on: 1, p: 0.05, n: 4 }, p10n3: { on: 1, p: 0.1, n: 3 }, p10n4: { on: 1, p: 0.1, n: 4 } };
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

/** 사람 사슬 하나 (과녁 앞): 몇째 칼마다 { k, peak 칼끝 가장 빠름 m/s, hit, energy(첫 맞음), sev } */
export function humanOne({ ws = 'zweihander', seq, gap = 0.1, v = 5.5, dist = 1.9, seed = 1 }) {
  const R = chainRun({ ws, seq, gap, v, seed, dist });
  // 칼마다 창: 첫 칼 = 시작 ~ 첫 넘기기 · k 째 = 그 칼 다시 긋기 시작 ~ 다음 넘기기 시작
  const starts = [0];
  for (const l of R.links) {
    let t0 = l.e;
    while (t0 < R.rec.length - 1 && R.rec[t0].ph === 'link') t0++;
    starts.push(t0);
  }
  const cuts = [];
  for (let i = 0; i < starts.length; i++) {
    const a = starts[i];
    const b = i + 1 < R.links.length + 1 && R.links[i] ? R.links[i].s : R.rec.length;
    let peak = 0;
    for (let s = a + 1; s < Math.min(b, R.rec.length); s++) if (R.rec[s]) peak = Math.max(peak, R.rec[s].v);
    const h = R.hits.filter((x) => x.s >= a && x.s < b);
    cuts.push({ k: i + 1, peak: r3(peak), hit: h.length > 0, energy: h.length ? r3(h[0].energy) : null, sev: r3(h.reduce((x, y) => x + y.sev, 0)) });
  }
  return { ws, seq: seq.join('>'), gap, cuts, links: R.links.length, boost: R.boost, stamina: r3(R.stamina) };
}

/** AI 대 AI 한 판 (이베리아 AI = enemy) */
export function aiOne({ weapon = 'zweihander', opp = 'longsword', seed = 1, dur = 30, prof = 5 }) {
  const G = newRound({ walls: true, seed, weapon: opp, weapon2: weapon, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const P = G.player; // 롱소드 AI
  const E = G.enemy; // 이베리아 AI
  const hits = { all: [], linked: [] };
  let linked = false; // 넘김이 끝난 뒤 그 칼이 휘두르기를 마칠 때까지
  let swung = false;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === E && vic === P) {
      const h = { energy: r.energy, sev: r.type === 'blunt' ? 0 : r.severity ?? 0, k: E.ibBoost?.k ?? 0 };
      hits.all.push(h);
      if (linked) hits.linked.push(h);
    }
  };
  const chains = []; // 사슬마다 넘김 수 (그 사슬에서 가장 큰 ibLinkK)
  let kMax = 0;
  let wasLink = false;
  let linkedN = 0;
  let linkedHitCuts = 0;
  let hitThis = false;
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(P) && !out(E)) {
    const nh = hits.linked.length;
    G.step();
    if (E.ibLink && !wasLink) kMax = Math.max(kMax, E.ibLinkK ?? 0);
    if (wasLink && !E.ibLink) (linked = true), (swung = false), (hitThis = false), linkedN++;
    wasLink = !!E.ibLink;
    if (linked) {
      if (hits.linked.length > nh) hitThis = true;
      if (E.skill.swinging) swung = true;
      else if (swung) {
        linked = false;
        if (hitThis) linkedHitCuts++;
      }
    }
    if (!E.ibLinkK && kMax) chains.push(kMax), (kMax = 0);
  }
  if (kMax) chains.push(kMax);
  const st = G.ai.stats;
  const r = {
    weapon, opp, seed, T: r3(G.t), win: out(P) && !out(E), lose: out(E) && !out(P),
    attacks: st.attacks ?? 0, landed: st.landed ?? 0, linkFired: st.ibLink?.fired ?? 0, linkDone: st.ibLink?.done ?? 0, linkedN, linkedHitCuts,
    chains, eAll: r3(mean(hits.all.map((h) => h.energy))), eLinked: r3(mean(hits.linked.map((h) => h.energy))), nHits: hits.all.length, nLinkedHits: hits.linked.length,
    sevDealt: r3(hits.all.reduce((x, h) => x + h.sev, 0)), boost: E.ibBoostLog ?? null,
  };
  G.world.free();
  return r;
}

const range = (s) => {
  const [a, b] = s.split('-').map(Number);
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
};

export function aggHuman(runs) {
  const by = {};
  for (const r of runs) (by[r.cfg] ??= []).push(r);
  const base = {};
  const out = ['| 판 | 몇째 칼 | 칼 수 | 칼끝 가장 빠름 평균 m/s (끔 대비) | 맞음 몫 | 첫 맞음 에너지 평균 J (끔 대비) | 더 쓴 기력/사슬 |', '|---|---:|---:|---|---:|---|---:|'];
  for (const cfg of Object.keys(CFGS)) {
    const rs = by[cfg];
    if (!rs) continue;
    for (let k = 1; k <= 4; k++) {
      const cs = rs.flatMap((r) => r.cuts.filter((c) => c.k === k));
      if (!cs.length) continue;
      const pk = mean(cs.map((c) => c.peak));
      const en = mean(cs.filter((c) => c.energy != null).map((c) => c.energy));
      if (cfg === 'off') base[k] = { pk, en };
      const b = base[k];
      const cost = k === 1 ? mean(rs.map((r) => r.boost?.cost ?? 0)) : null;
      out.push(`| ${cfg} | ${k} | ${cs.length} | ${r3(pk)}${b && cfg !== 'off' ? ` (×${r3(pk / b.pk)})` : ''} | ${r3(cs.filter((c) => c.hit).length / cs.length)} | ${r3(en)}${b && cfg !== 'off' && en && b.en ? ` (×${r3(en / b.en)})` : ''} | ${cost != null ? r3(cost) : ''} |`);
    }
  }
  return out.join('\n');
}
export function aggAi(runs) {
  const by = {};
  for (const r of runs) (by[r.cfg] ??= []).push(r);
  const out = ['| 판 | 판 수 | 이김 · 짐 · 비김 | 공격 맞힘 몫 | 넘김/판 | 사슬 길이 나눔 (넘김 1 · 2 · 3 · 4+) | 이은 칼 맞힘 몫 | 맞음 에너지 평균 J (이은 칼) | 준 심각도/판 | 더 쓴 기력/판 (못 낸 수) | 판 길이 s |', '|---|---:|---|---:|---:|---|---:|---|---:|---|---:|'];
  for (const cfg of Object.keys(CFGS)) {
    const rs = by[cfg];
    if (!rs) continue;
    const n = rs.length;
    const W = rs.filter((r) => r.win).length;
    const Ls = rs.filter((r) => r.lose).length;
    const ch = rs.flatMap((r) => r.chains);
    const hist = [1, 2, 3].map((k) => ch.filter((x) => x === k).length).concat([ch.filter((x) => x >= 4).length]);
    const att = rs.reduce((x, r) => x + r.attacks, 0);
    const land = rs.reduce((x, r) => x + r.landed, 0);
    const ln = rs.reduce((x, r) => x + r.linkedN, 0);
    const lh = rs.reduce((x, r) => x + r.linkedHitCuts, 0);
    const eAll = mean(rs.map((r) => r.eAll).filter((x) => x != null));
    const eL = mean(rs.map((r) => r.eLinked).filter((x) => x != null));
    out.push(`| ${cfg} | ${n} | ${W} · ${Ls} · ${n - W - Ls} | ${r3(land / Math.max(1, att))} | ${r3(ln / n)} | ${hist.join(' · ')} | ${r3(lh / Math.max(1, ln))} | ${r3(eAll)} (${r3(eL)}) | ${r3(mean(rs.map((r) => r.sevDealt)))} | ${r3(mean(rs.map((r) => r.boost?.cost ?? 0)))} (${rs.reduce((x, r) => x + (r.boost?.skip ?? 0), 0)}) | ${r3(mean(rs.map((r) => r.T)))} |`);
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
  const cfg = arg('cfg', 'off');
  if (CFGS[cfg]) Object.assign(IB_LINK.chainSpeed ?? (IB_LINK.chainSpeed = {}), CFGS[cfg]);
  if (mode === 'human') {
    const runs = [];
    for (const seq of seqs(4)) {
      const r = humanOne({ ws: arg('ws', 'zweihander'), seq, gap: +arg('gap', 0.1), dist: +arg('dist', 1.9) });
      r.cfg = cfg;
      runs.push(r);
    }
    if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(runs));
    console.log(aggHuman(runs));
  } else if (mode === 'ai') {
    const runs = [];
    for (const seed of range(arg('seeds', '1-12'))) {
      const r = aiOne({ weapon: arg('ws', 'zweihander'), opp: arg('opp', 'longsword'), seed, dur: +arg('dur', 30) });
      r.cfg = cfg;
      runs.push(r);
      console.error(JSON.stringify(r));
    }
    if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(runs));
    console.log(aggAi(runs));
  } else if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(runs[0]?.cuts ? aggHuman(runs) : aggAi(runs));
  }
}
