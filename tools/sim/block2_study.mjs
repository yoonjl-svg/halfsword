// ─────────────────────────────────────────────────────────────
//  block2_study.mjs — 막기 2.0 조사 · A/B 도구 (11/17). 게임 값은 건드리지 않는다 (BLOCK2 스위치는 --block2=1 로 켬 — 기본 끔)
//  숙련 4 거울(같은 겉모습 · 자리 번갈음) · 유파 다섯 × 무기 둘 × 씨앗 × 자리 둘 · 60 s · 한쪽이 죽으면 끝.
//  '동시 공격' = 두 쪽 모두 ai.mode === 'attack' 이고 phase === 'strike' 인 스텝이 이어진 구간 (한 쪽이 strike 를 떠나면 끝).
//  판마다 모으는 것: 동시 공격 구간(칼 선분 최소 거리 · 칼 닿음 · 닿은 자리 · 뒤 0.6 s 상처) · 상처 목록(맞교환 몫) · 닿음 수 · 이김.
//  node tools/sim/block2_study.mjs run --seeds=1-6 [--shard=i/n] [--out=path.json] [--dur=60] [--block2=1] [--str=1.6] [--prof=2:6] [--look=enemy]
//    --str=a:b   : 플레이어 자리 strength a · 상대 자리 b (자리 번갈음은 swap 으로: 첫 수가 '주인공' = 높은 쪽)
//    --prof=lo:hi: 숙련도 차이 (prof_gap_measure 와 같이 difficulty = AI_PROFICIENCY.levels[prof])
//  node tools/sim/block2_study.mjs agg a.json b.json …
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, DT, CONFIG } from './harness_m.mjs';
import { LOOKS } from '../../src/looks.js';
import { WEAPONS } from './ai_ring_measure.mjs';
import { isMain } from './is_main.mjs';
import { wilson } from './ref_duel.mjs';

const { AI_PROFICIENCY, PROF6_VITALITY } = CONFIG;
const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const out = (f) => !f.alive || f.state === 'dead';

// 선분 둘 사이 최소 거리 (Ericson)
function segDist(p1, q1, p2, q2) {
  const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r);
  let s, t;
  const c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
  s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
}
const tAlong = (f, pt) => { // 칼 위 접점의 자리 (0 = 손잡이 끝 · 1 = 칼끝) — 칼날 선분에 내린 수선
  const a = f.bladePoint(0), b = f.bladePoint(1), ab = b.clone().sub(a);
  return Math.min(1.2, Math.max(-0.2, pt.clone().sub(a).dot(ab) / ab.lengthSq()));
};

export function studyFight({ school, weapon, wi, seed, swap, dur = 60, block2 = 0, reward = 0, str, prof, look = 'enemy' }) {
  CONFIG.BLOCK2.on = block2 ? 1 : 0;
  CONFIG.BLOCK2.reward = reward;
  CONFIG.BLOCK2.watch = 1;
  const lk = look === 'enemy' ? LOOKS.enemy : LOOKS.player;
  // 주인공(= 높은 쪽) 자리: swap=false → 플레이어(P) 자리, true → 상대(E) 자리
  const [pLo, pHi] = prof ? prof : [4, 4];
  const lvl = (n) => AI_PROFICIENCY.levels[n];
  const hiProf = pHi, loProf = pLo;
  const G = newRound({
    seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: AI, look, look2: lk,
    difficulty: lvl(swap ? hiProf : loProf), difficulty2: lvl(swap ? loProf : hiProf),
    persona: { proficiency: swap ? hiProf : loProf }, persona2: { proficiency: swap ? loProf : hiProf },
  });
  const P = G.player, E = G.enemy;
  const hero = swap ? E : P, other = swap ? P : E;
  if (str) { hero.strength = str[0]; other.strength = str[1]; }
  if (prof) { if (hiProf === 6 && !process.env.NO_VITAL) hero.vitality = PROF6_VITALITY; if (loProf === 6) other.vitality = PROF6_VITALITY; }
  const aiOf = new Map([[E, G.ai], [P, G.ai2]]);
  const nm = (f) => (f === P ? 'P' : 'E');
  const wounds = [];
  const eps = [];
  let ep = null, clashes = 0, freshClashes = 0;
  const strike = (f) => { const a = aiOf.get(f); return a.mode === 'attack' && a.phase === 'strike'; };
  G.combat.hooks.onClash = (point, sp, info) => {
    G.clashes++; clashes++;
    if (info.fresh) freshClashes++;
    if (ep) {
      ep.nClash++;
      if (info.fresh) {
        ep.nFresh++;
        if (!ep.first) ep.first = { t: G.t, tP: tAlong(P, point), tE: tAlong(E, point), vn: info.vn, force: info.force, impulse: info.impulse, dt0: G.t - ep.t0 };
      }
    }
  };
  G.onWound = (att, vic, r) => {
    if (!(r.severity > 0)) return;
    wounds.push({ t: G.t, att: nm(att), vic: nm(vic), zone: r.zone, type: r.type, sev: r.severity, vAtk: strike(vic) || aiOf.get(vic).mode === 'attack' });
  };
  const lastDone = [];
  const resp = { parry: 0, void: 0, counter: 0, rollfail: 0, other: 0 };
  for (const f of [P, E]) {
    const ai = aiOf.get(f);
    const oRe = ai.respond.bind(ai);
    ai.respond = (th, d) => {
      const before = ai.threatSeen, c0 = ai.stats.counters;
      const r = oRe(th, d);
      if (before !== th.id && ai.threatSeen === th.id) {
        const b = !r ? 'rollfail' : ai.mode === 'attack' || ai.stats.counters > c0 ? 'counter' : ai.defVoid ? 'void' : ai.mode === 'defend' ? 'parry' : 'other';
        resp[b]++;
      }
      return r;
    };
  }
  let prev = null, ep2 = null;
  const eps2 = [];
  const lerp = (a, b, k) => a.clone().lerp(b, k);
  while (G.t < dur && !out(P) && !out(E)) {
    G.step();
    const cur = { p0: P.bladePoint(0), p1: P.bladePoint(1), e0: E.bladePoint(0), e1: E.bladePoint(1) };
    const anyAtk = aiOf.get(P).mode === 'attack' && aiOf.get(E).mode === 'attack' && P.armed && E.armed;
    if (anyAtk) {
      const d = segDist(cur.p0, cur.p1, cur.e0, cur.e1);
      if (!ep2) ep2 = { t0: G.t, minD: 1e9, nFresh: 0, nClash: 0 };
      ep2.minD = Math.min(ep2.minD, d); ep2.tEnd = G.t;
      ep2.cl0 = ep2.cl0 ?? clashes; ep2.cl1 = clashes; ep2.fr0 = ep2.fr0 ?? freshClashes; ep2.fr1 = freshClashes;
    } else if (ep2) { eps2.push(ep2); ep2 = null; }
    const both = strike(P) && strike(E) && P.armed && E.armed;
    if (both) {
      const d = segDist(cur.p0, cur.p1, cur.e0, cur.e1);
      if (prev) { // 스텝 사이 훑기 (터널링 의심): 앞 스텝 → 이번 스텝 위치를 6 칸으로 보간해 가장 가까운 거리
        for (let k = 1; k < 6; k++) {
          const x = k / 6;
          const ds = segDist(lerp(prev.p0, cur.p0, x), lerp(prev.p1, cur.p1, x), lerp(prev.e0, cur.e0, x), lerp(prev.e1, cur.e1, x));
          if (ds < (ep?.minSweep ?? 1e9)) { if (!ep) ep = { t0: G.t, minD: 1e9, nClash: 0, nFresh: 0, first: null, steps: 0, ph0: { P: aiOf.get(P).phase, E: aiOf.get(E).phase } }; ep.minSweep = ds; }
        }
        const tv = Math.max(cur.p1.distanceTo(prev.p1), cur.e1.distanceTo(prev.e1)) / DT;
        if (ep) ep.tipV = Math.max(ep.tipV ?? 0, tv);
      }
      if (!ep) ep = { t0: G.t, minD: 1e9, nClash: 0, nFresh: 0, first: null, steps: 0, ph0: { P: aiOf.get(P).phase, E: aiOf.get(E).phase } };
      ep.minD = Math.min(ep.minD, d); ep.steps++;
      ep.tEnd = G.t;
    } else if (ep) {
      // 한 쪽이 strike 를 떠난 뒤 0.1 s 까지 닿음도 이 구간 몫 (칼은 마지막 스텝에 닿을 수 있다)
      ep.closeT = G.t; eps.push(ep); lastDone.push(ep); ep = null;
    }
    prev = cur;
  }
  if (ep) eps.push(ep);
  // 구간 → 뒤 0.6 s 상처
  for (const e of eps) {
    const ws = wounds.filter((w) => w.t >= e.t0 && w.t <= (e.tEnd ?? e.t0) + 0.6);
    e.wP = ws.filter((w) => w.att === 'P').length; // P 가 낸 상처
    e.wE = ws.filter((w) => w.att === 'E').length;
  }
  const res = out(hero) && !out(other) ? 'lo' : out(other) && !out(hero) ? 'hi' : 'd';
  const rec = {
    school, weapon, seed, swap, res, endT: +G.t.toFixed(2), clashes, freshClashes, wounds,
    eps: eps.map((e) => ({ t0: +e.t0.toFixed(3), dur: +(e.tEnd - e.t0 + DT).toFixed(3), minD: +e.minD.toFixed(3), minSweep: +(e.minSweep ?? 9).toFixed(3), tipV: +(e.tipV ?? 0).toFixed(1), nClash: e.nClash, nFresh: e.nFresh, first: e.first, wP: e.wP, wE: e.wE })),
    hero: swap ? 'E' : 'P', resp, b2: G.combat.block2Stats ?? null,
    eps2: eps2.map((e) => ({ dur: +(e.tEnd - e.t0).toFixed(2), minD: +e.minD.toFixed(3), nClash: e.cl1 - e.cl0, nFresh: e.fr1 - e.fr0 })),
  };
  G.world.free();
  return rec;
}

// ───────── 모으기 ─────────
const pc = (a, b) => (b ? `${((100 * a) / b).toFixed(1)} %` : '-');
export function aggregate(recs) {
  const O = [];
  const n = recs.length;
  const eps = recs.flatMap((r) => r.eps.map((e) => ({ ...e, r })));
  const W = recs.reduce((s, r) => s + r.wounds.length, 0);
  // 맞교환: 어떤 상처가 반대쪽 상처(서로 맞은)와 0.5 s 안에 있다
  let trade = 0;
  for (const r of recs) for (const w of r.wounds) if (r.wounds.some((x) => x !== w && x.att === w.vic && x.vic === w.att && Math.abs(x.t - w.t) <= 0.5)) trade++;
  const hi = recs.filter((r) => r.res === 'hi').length, lo = recs.filter((r) => r.res === 'lo').length, dr = recs.filter((r) => r.res === 'd').length;
  const k = hi + dr / 2;
  const [wl, wh] = wilson(k, n).map((v) => 100 * v);
  O.push(`판 ${n} · 상처 ${W} (판당 ${(W / n).toFixed(2)}) · 맞교환 상처 ${trade} (${pc(trade, W)}) · 칼 닿음 스텝 ${recs.reduce((s, r) => s + r.clashes, 0)} (판당 ${(recs.reduce((s, r) => s + r.clashes, 0) / n).toFixed(0)}) · 새 닿음 ${recs.reduce((s, r) => s + r.freshClashes, 0)}`);
  O.push(`주인공(높은 쪽/첫 수) 몫 ${(100 * k / n).toFixed(1)} % [${wl.toFixed(1)} ~ ${wh.toFixed(1)}] — 승 ${hi} · 무 ${dr} · 패 ${lo} · 평균 끝 ${(recs.reduce((s, r) => s + r.endT, 0) / n).toFixed(1)} s`);
  O.push(`동시 공격 구간 ${eps.length} (판당 ${(eps.length / n).toFixed(2)}) · 중앙 길이 ${med(eps.map((e) => e.dur)).toFixed(3)} s`);
  const near = (d) => eps.filter((e) => e.minD < d).length;
  O.push(`· 칼 선분 최소 거리 < 0.05 m: ${pc(near(0.05), eps.length)} · < 0.10: ${pc(near(0.1), eps.length)} · < 0.25: ${pc(near(0.25), eps.length)} · 중앙 ${med(eps.map((e) => e.minD)).toFixed(2)} m`);
  const cl = eps.filter((e) => e.nFresh > 0);
  O.push(`· 구간 안에 칼 새로 닿음: ${cl.length} (${pc(cl.length, eps.length)}) — 가까웠던(<0.10) 것 중 ${pc(eps.filter((e) => e.minD < 0.1 && e.nFresh > 0).length, near(0.1))}`);
  const outc = (rows) => {
    const none = rows.filter((e) => !e.wP && !e.wE).length, onlyP = rows.filter((e) => e.wP && !e.wE).length, onlyE = rows.filter((e) => !e.wP && e.wE).length, both = rows.filter((e) => e.wP && e.wE).length;
    return `무상처 ${pc(none, rows.length)} · 한 쪽만 ${pc(onlyP + onlyE, rows.length)} · 둘 다 ${pc(both, rows.length)}`;
  };
  O.push(`· 결과(뒤 0.6 s 상처) 전체: ${outc(eps)}`);
  O.push(`  닿음 있음 (${cl.length}): ${outc(cl)}`);
  O.push(`  닿음 없음 (${eps.length - cl.length}): ${outc(eps.filter((e) => !e.nFresh))}`);
  // 닿은 자리와 이김 (닿은 첫 순간 두 칼 자리 t · 그 뒤 상처를 낸 쪽)
  const dec = cl.filter((e) => e.first && (!!e.wP !== !!e.wE));
  const rows = dec.map((e) => ({ winP: !!e.wP, tP: e.first.tP, tE: e.first.tE, vn: e.first.vn }));
  const lever = rows.filter((x) => Math.abs(x.tP - x.tE) > 0.1);
  const leverWin = lever.filter((x) => (x.tP < x.tE) === x.winP).length;
  O.push(`· 닿은 뒤 한 쪽만 상처 낸 구간 ${dec.length}: 손잡이 쪽(작은 t)에서 닿은 쪽이 상처 낸 몫 ${pc(leverWin, lever.length)} (n=${lever.length}, 자리 차 > 0.1) — 50 % 면 레버리지 무관`);
  // 블록 고르기 몫 · 터널링 · 넓은 겹침 · 막기 2.0 사건
  const rs = recs.reduce((a, r) => { for (const k in r.resp) a[k] = (a[k] ?? 0) + r.resp[k]; return a; }, {});
  const rt = Object.values(rs).reduce((a, b) => a + b, 0);
  O.push(`· 반응 굴림 ${rt}: 칼로 막기 ${pc(rs.parry, rt)} · 물러나 피하기 ${pc(rs.void, rt)} · 맞받기 ${pc(rs.counter, rt)} · 굴림 탈락 ${pc(rs.rollfail, rt)}`);
  const sw = eps.filter((e) => e.minSweep < 0.03);
  O.push(`· 훑기(스텝 사이 6 칸) 최소 거리 < 0.03 m: ${sw.length} (${pc(sw.length, eps.length)}) — 그 중 칼 닿음(어떤 스텝이든) ${pc(sw.filter((e) => e.nClash > 0).length, sw.length)} · 닿음 없음 ${sw.filter((e) => !e.nClash).length} (중앙 칼끝 빠르기 ${med(sw.filter((e) => !e.nClash).map((e) => e.tipV)).toFixed(1)} m/s, 닿은 것 ${med(sw.filter((e) => e.nClash).map((e) => e.tipV)).toFixed(1)} m/s)`);
  const e2 = recs.flatMap((r) => r.eps2);
  const e2n = e2.filter((e) => e.minD < 0.05);
  O.push(`· 넓은 겹침(둘 다 attack 모드 · 준비 · 마무리 포함) ${e2.length} (판당 ${(e2.length / n).toFixed(2)}) · 중앙 ${med(e2.map((e) => e.dur)).toFixed(2)} s · 칼 < 0.05 m ${pc(e2n.length, e2.length)} · 새 닿음 있음 ${pc(e2.filter((e) => e.nFresh > 0).length, e2.length)}`);
  const b2 = recs.map((r) => r.b2).filter(Boolean);
  if (b2.length) O.push(`· 막기 2.0 사건: 새 닿음 분류(둘 다 공격 몸짓 ${b2.reduce((a, x) => a + x.both, 0)} · 한쪽만 ${b2.reduce((a, x) => a + x.one, 0)} · 둘 다 아님/막기 ${b2.reduce((a, x) => a + x.none, 0)} · 둘 다 공격 상태 ${b2.reduce((a, x) => a + x.state2, 0)}) · 겨룸 ${b2.reduce((a, x) => a + x.clash, 0)} (판당 ${(b2.reduce((a, x) => a + x.clash, 0) / n).toFixed(2)}) · 막기 보상 ${b2.reduce((a, x) => a + x.reward, 0)} (판당 ${(b2.reduce((a, x) => a + x.reward, 0) / n).toFixed(2)})`);
  const clashEps = eps.length ? pc(cl.length, eps.length) : '-';
  return O.join('\n');
}
function med(a) { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
  const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'table') { // node tools/sim/block2_study.mjs table --dir=D v1 v2 … : 변형마다 거울 · 힘 · 숙련 세 묶음 (파일 이름 D/{변형}_{mirror|str|prof}_{1..4}.json)
    const dir = arg('dir', '.');
    const names = args.slice(1).filter((a) => !a.startsWith('--'));
    const load = (n, set) => [1, 2, 3, 4].flatMap((i) => JSON.parse(readFileSync(`${dir}/${n}_${set}_${i}.json`, 'utf8')));
    const share = (rs) => { const k = rs.filter((r) => r.res === 'hi').length + rs.filter((r) => r.res === 'd').length / 2; const [lo, hi] = wilson(k, rs.length).map((v) => 100 * v); return `${((100 * k) / rs.length).toFixed(1)} % [${lo.toFixed(0)}~${hi.toFixed(0)}]`; };
    console.log('| 변형 | 맞교환 상처 몫 | 칼로 막기 고른 몫 | 판당 상처 | 판당 겨룸 사건 | 판당 막기 보상 | 힘 1.6 : 1.1 — 센 쪽 몫 | 숙련 2 : 6 — 6 쪽 몫 | 평균 끝 s (거울) |');
    console.log('|---|---|---|---|---|---|---|---|---|');
    for (const n of names) {
      const m = load(n, 'mirror'), st = load(n, 'str'), pf = load(n, 'prof');
      const W = m.reduce((a, r) => a + r.wounds.length, 0);
      let trade = 0;
      for (const r of m) for (const w of r.wounds) if (r.wounds.some((x) => x !== w && x.att === w.vic && x.vic === w.att && Math.abs(x.t - w.t) <= 0.5)) trade++;
      const rs = m.reduce((a, r) => { for (const k in r.resp) a[k] = (a[k] ?? 0) + r.resp[k]; return a; }, {});
      const rt = Object.values(rs).reduce((a, b) => a + b, 0);
      const b2 = (k) => m.reduce((a, r) => a + (r.b2?.[k] ?? 0), 0) / m.length;
      const wps = (rs2) => (rs2.reduce((a, r) => a + r.wounds.length, 0) / rs2.length).toFixed(2);
      console.log(`| ${n} | ${pc(trade, W)} | ${pc(rs.parry, rt)} | ${(W / m.length).toFixed(2)} (힘 ${wps(st)} · 숙련 ${wps(pf)}) | ${b2('clash').toFixed(2)} | ${b2('reward').toFixed(2)} | ${share(st)} | ${share(pf)} | ${(m.reduce((a, r) => a + r.endT, 0) / m.length).toFixed(1)} |`);
    }
  } else if (mode === 'agg') {
    const recs = args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(aggregate(recs));
  } else {
    const [s0, s1] = arg('seeds', '1-3').split('-').map(Number);
    const seeds = Array.from({ length: (s1 ?? s0) - s0 + 1 }, (_, i) => s0 + i);
    const [si, sn] = arg('shard', '1/1').split('/').map(Number);
    const dur = +arg('dur', '60');
    const str = arg('str', null)?.split(':').map(Number);
    const prof = arg('prof', null)?.split(':').map(Number);
    const list = [];
    for (const school of SCHOOLS) WEAPONS[school].forEach((weapon, wi) => { for (const seed of seeds) for (const swap of [false, true]) list.push({ school, weapon, wi, seed, swap }); });
    const mine = list.filter((_, i) => i % sn === si - 1);
    const recs = [];
    for (const f of mine) {
      const r = studyFight({ ...f, dur, block2: +arg('block2', '0'), reward: +arg('reward', '0'), str, prof, look: arg('look', 'enemy') });
      recs.push(r);
      console.error(f.school, f.weapon, f.seed, f.swap ? 'S' : '-', r.res, r.endT, 'eps', r.eps.length);
    }
    const o = arg('out', null);
    if (o) writeFileSync(o, JSON.stringify(recs));
    console.log(aggregate(recs));
  }
}
