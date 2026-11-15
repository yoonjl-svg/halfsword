// ─────────────────────────────────────────────────────────────
//  ib_link_speed.mjs — 사슬 칼 빠르기 시제품 재기 (11/15 사장님 "이어돌리기로 이어진 칼의 속도를 인위적으로 좀 더 빠르게 하면 어떨지도 검토해봐. 최대 3~4번까지 매번 이어질 때마다 +5~10% 합산." —
//   config IB_LINK.chainSpeed · iberian_link.js linkBoost · 기록 docs/strike/ib_link_2026-11-15.md §5 · §9). 판: off · on (11/16 — 실제 ×1.1 · 1.2 · 1.3 상한)
//   human = 사람 손가락 봇이 서 있는 과녁(AI 끔 · 안 죽음) 앞에서 큰 칼 넷 사슬(ib_link_chain.mjs 의 스물다섯 줄 · 쉼 gap): 몇째 칼마다 칼끝 가장 빠름 · 맞음 · 판정 에너지 · 기력
//   ai    = AI 대 AI (이베리아 츠바이핸더 AI : 롱소드 AI · 숙련 5 · seeds): 이김 · 짐 · 사슬 길이 나눔(넘김 수) · 이은 칼 맞음 · 에너지 · 더 쓴 기력
//   real  = 실제 빠르기 배율 (사람 · 허공 · 사슬 다섯 25 줄 · 같은 줄 켬 ÷ 끔 · 넘김 k 째) · aipair = AI 짝 재기 (같은 씨앗 · 그 넘김 힘만 표 ↔ 1)
//  node tools/sim/ib_link_speed.mjs human --cfg=off|on [--ws=zweihander] [--gap=0.1] [--json=…]
//  node tools/sim/ib_link_speed.mjs ai --cfg=off|on [--seeds=1-12] [--json=…]
//  node tools/sim/ib_link_speed.mjs real --ws=… [--drive=a,b,c,d]      node tools/sim/ib_link_speed.mjs aipair --ws=… --k=1 [--drive=…] [--seeds=1-30]
//  node tools/sim/ib_link_speed.mjs agg <json …>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, CONFIG, AI, THREE } from './harness_m.mjs';
import { chainRun, seqs } from './ib_link_chain.mjs';
import { isMain } from './is_main.mjs';
import { applySets } from './ib_link.mjs';

const { IB_LINK } = CONFIG;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export const CFGS = { off: { on: 0 }, on: { on: 1 } }; // 11/16 사슬 칼 빠르기 끔 · 켬 (켬 = config 그대로 — 무기마다 재어 맞춘 힘 배율)
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

/** 사슬 다섯(넘김 넷)의 넘김 k 째 칼 가장 빠른 칼끝 (다시 긋기 시작 → 다음 넘김 시작 · 마지막은 1 s 안) */
export const BIG5 = (() => {
  const B = ['zornhau', 'zornhauL', 'oberhau', 'zwerch', 'zwerchL'];
  const out = [];
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) out.push([B[a], B[b], B[(a + 2 * b + 1) % 5], B[(3 * a + b + 2) % 5], B[(a + 3 * b + 4) % 5]]);
  return out;
})();
export function linkPeaks(R) {
  const st = [];
  for (const l of R.links) {
    let t0 = l.e;
    while (t0 < R.rec.length - 1 && R.rec[t0].ph === 'link') t0++;
    st.push(t0);
  }
  const out = [];
  for (let i = 0; i < st.length; i++) {
    const end = R.links[i + 1] ? R.links[i + 1].s : Math.min(R.rec.length, st[i] + 120);
    let pk = 0;
    for (let s = st[i] + 1; s < end; s++) if (R.rec[s]) pk = Math.max(pk, R.rec[s].v);
    out.push(pk);
  }
  return out;
}
/**
 * 실제 빠르기 배율 (11/16 사장님 "빨라지는 칼은 이어질 때마다 +10%로. 상한은 1.3배." — 재어 맞춤): 사람 손가락 봇 · 허공 · 사슬 다섯 25 줄 · 쉼 gap —
 *  같은 줄을 빠르기 켬 · 끔으로 긋고 넘김 k 째 칼 칼끝 가장 빠름의 평균 비(켬 ÷ 끔) · 줄마다 비의 평균 · 더 쓴 기력 / 사슬
 */
export function realHuman({ ws = 'zweihander', gap = 0.1 } = {}) {
  const C = IB_LINK.chainSpeed;
  const on0 = C.on;
  const pk = { on: {}, off: {} };
  let cost = 0;
  try {
    for (const seq of BIG5) {
      const res = {};
      for (const on of [1, 0]) {
        C.on = on;
        const R = chainRun({ ws, seq, gap });
        res[on] = linkPeaks(R);
        if (on) cost += R.boost?.cost ?? 0;
      }
      for (let k = 1; k <= Math.min(res[1].length, res[0].length); k++) {
        (pk.on[k] ??= []).push(res[1][k - 1]);
        (pk.off[k] ??= []).push(res[0][k - 1]);
      }
    }
  } finally {
    C.on = on0;
  }
  const k = {};
  for (const kk of Object.keys(pk.on)) {
    const a = pk.on[kk];
    const b = pk.off[kk];
    k[kk] = { n: a.length, on: r3(mean(a)), off: r3(mean(b)), ratio: r3(mean(a) / mean(b)), pair: r3(mean(a.map((x, i) => x / b[i]))) };
  }
  return { ws, gap, drive: C.drive, k, cost: r3(cost / BIG5.length) };
}

/**
 * AI 짝 재기 (판이 갈리지 않게): 같은 씨앗을 넘김 k 째 힘 배율만 D[k] · 1 로 두 번 — 다른 넘김 · 기력은 같음(기력 값은 목표 s 로만 셈) ·
 *  첫 넘김 k 째 칼(AI strike)의 칼끝 가장 빠름 짝 (그 칼 앞까지는 두 판이 같음). 돌려줌 { on, off } 또는 null(그 칼이 안 나옴)
 */
export function aiPairOne({ ws = 'zweihander', seed = 1, k = 1, D, dur = 60, prof = 5 }) {
  const C = IB_LINK.chainSpeed;
  const T0 = C.driveAi;
  const res = {};
  try {
    for (const on of [1, 0]) {
      const d = D.slice();
      while (d.length < k + 1) d.push(d.at(-1));
      if (!on) d[k - 1] = 1; // k 째만 1 (칸 끝 값이 그 뒤 넘김)
      C.driveAi = { def: d };
      const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: ws, persona: { proficiency: prof }, persona2: { proficiency: prof } });
      const P = G.player;
      const E = G.enemy;
      P.die = () => {};
      const A = G.ai;
      const step = CONFIG.PHYSICS.timestep / CONFIG.TIME.k;
      const tip = new THREE.Vector3();
      const prev = new THREE.Vector3();
      let have = false;
      let pend = null;
      let win = null;
      let was = false;
      let got = null;
      while (G.t < dur && got == null) {
        G.step();
        E.bladePoint(1, tip);
        const v = have ? tip.distanceTo(prev) / step : 0;
        prev.copy(tip);
        have = true;
        if (was && !E.ibLink && (E.ibLinkK ?? 1) === k && !pend && !win) pend = { t: 0 };
        was = !!E.ibLink;
        if (pend && !win) {
          pend.t += step;
          if (A.phase === 'strike') (win = { pk: 0, n: 0 }), (pend = null);
          else if (pend.t > 1.5 || A.mode !== 'attack' || E.ibLink) got = -1;
        }
        if (win) {
          win.pk = Math.max(win.pk, v);
          win.n++;
          if ((A.phase !== 'strike' && A.phase !== 'follow') || win.n * step > 1.5) got = win.pk;
        }
      }
      G.world.free();
      res[on] = got;
    }
  } finally {
    C.driveAi = T0;
  }
  return res[1] > 0 && res[0] > 0 ? { on: res[1], off: res[0] } : null;
}
export function aiPair({ ws = 'zweihander', k = 1, D, seeds = range('1-40') } = {}) {
  const pr = [];
  for (const seed of seeds) {
    const r = aiPairOne({ ws, seed, k, D });
    if (r) pr.push(r);
  }
  return { ws, k, D, n: pr.length, on: r3(mean(pr.map((x) => x.on))), off: r3(mean(pr.map((x) => x.off))), ratio: pr.length ? r3(mean(pr.map((x) => x.on)) / mean(pr.map((x) => x.off))) : null, pair: pr.length ? r3(mean(pr.map((x) => x.on / x.off))) : null };
}

function range(s) {
  const [a, b] = s.split('-').map(Number);
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
}

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
  const cfg = arg('cfg', ['real', 'aipair'].includes(mode) ? '' : 'off');
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
  } else if (mode === 'real') {
    if (arg('drive', null)) IB_LINK.chainSpeed.drive = { def: arg('drive').split(',').map(Number) };
    console.log(JSON.stringify(realHuman({ ws: arg('ws', 'zweihander'), gap: +arg('gap', 0.1) })));
  } else if (mode === 'aipair') {
    console.log(JSON.stringify(aiPair({ ws: arg('ws', 'zweihander'), k: +arg('k', 1), D: arg('drive', '1.37,1.69,3.8,9.5').split(',').map(Number), seeds: range(arg('seeds', '1-40')) })));
  } else if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(runs[0]?.cuts ? aggHuman(runs) : aggAi(runs));
  }
}
