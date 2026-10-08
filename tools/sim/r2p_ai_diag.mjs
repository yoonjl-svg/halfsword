// R2′ 묶음(몸의 호·follow-through)을 AI 가 쓸 때 베기가 어떻게 달라지나 — WA5 진단 (10/8). N 결투(cut_react_battery 와 같은 차림: 둘 다 AI normal, P 는 보정 v2 숙련 0.7, 30 s, 결정적).
//  쪽(P/E)마다: 휘두름 수(startStrike)·그만둔 공격·맞힌 수(상처 콜백: 벤/둔)·휘두름당 맞힘·머리+목·베기 E 중앙/p90·맞는 순간 칼끝 속도·휘두름 최고 칼끝 속도·
//  휘두름 시작 거리·상대 옆 비킴(foeLat)·넘어짐·죽음(원인). 조건은 with_config 로 앞에 끼운다:
//  node tools/sim/r2p_ai_diag.mjs [--N=36]            (오늘)
//  node tools/sim/with_config.mjs BODY.trunkArc=2 BODY.trunkFollow=1 r2p_ai_diag.mjs --N=36                    (묶음 플레이어 P 만)
//  node tools/sim/with_config.mjs BODY.trunkArc=2 BODY.trunkFollow=1 BODY.r2pScope=all r2p_ai_diag.mjs --N=36  (묶음 둘 다)
import { newRound, DT, AI } from './jelly_harness.mjs';
import { MEASURED } from '../../src/ai.js';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const N = +(args.N ?? 36);
for (const [k, i] of [['contact', 0], ['reach', 1], ['clinch', 2], ['cutTime', 3]]) if (args[k] != null) MEASURED.longsword[i] = +args[k]; // AI 롱소드 간격 실측값 [contact, reach, clinch, cutTime] 덮어쓰기(두 손 상한 26 뒤 박자 맞추기 실험, 10/8)
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const p90 = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * 0.9)]; };
const f1 = (x) => Number.isFinite(x) ? +x.toFixed(1) : null, f2 = (x) => Number.isFinite(x) ? +x.toFixed(2) : null;

const side = { P: null, E: null };
const fresh = () => ({ swings: 0, aborted: 0, hits: 0, cutHits: 0, bluntHits: 0, headNeck: 0, cutE: [], bluntE: [], tipAtHit: [], peakTip: [], landedSwings: 0, startDist: [], startLat: [], arcAtHit: [], tHit: [], tPeak: [], hitFrac: [], distAtHit: [], handAtHit: [], falls: 0, deaths: 0, causes: {}, kills: 0, hitsOutside: 0 });
for (const k of ['P', 'E']) side[k] = fresh();
let cur = { P: null, E: null }; // 열려 있는 휘두름 기록
let G_t = () => 0;
const origStart = AI.prototype.startStrike, origAbort = AI.prototype.abortAttack;
AI.prototype.startStrike = function () {
  const k = this.me.name, S = side[k]; if (S) {
    S.swings++;
    if (cur[k]) closeSwing(k);
    cur[k] = { peak: 0, hits: 0, t0: G_t(), tPeak: 0 };
    S.startDist.push(this.contactDist()); S.startLat.push(Math.abs(this.foeLat || 0));
  }
  return origStart.apply(this, arguments);
};
AI.prototype.abortAttack = function () { const S = side[this.me.name]; if (S) S.aborted++; return origAbort.apply(this, arguments); };
function closeSwing(k) { const c = cur[k]; if (!c) return; side[k].peakTip.push(c.peak); side[k].tPeak.push(c.tPeak - c.t0); if (c.hits > 0) side[k].landedSwings++; cur[k] = null; }

const ends = []; const perSeed = [];
for (let seed = 1; seed <= N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7; G.ai2 = new AI(P, E, 'normal');
  const F = { P, E }, ais = { P: G.ai2, E: G.ai };
  for (const a of [G.ai, G.ai2]) for (const k of ['contact', 'reach', 'clinch', 'cutTime']) if (args[k] != null) a.M[k] = +args[k]; // 유파 간격 덮어쓰기(실험)
  const prev = { P: 'stand', E: 'stand' }; let seen = 0; const s0 = { Pf: side.P.falls, Ef: side.E.falls, Pc: side.P.cutHits, Ec: side.E.cutHits, Ph: side.P.hits, Eh: side.E.hits, Ps: side.P.swings, Es: side.E.swings };
  cur.P = null; cur.E = null; G_t = () => G.t;
  for (let i = 0; i < 30 / DT; i++) {
    G.step();
    for (const k of ['P', 'E']) {
      const f = F[k], a = ais[k];
      if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) side[k].falls++;
      prev[k] = f.state;
      const striking = a.mode === 'attack' && (a.phase === 'strike' || a.phase === 'follow');
      if (cur[k]) { const tv = f.tipVel.length(); if (tv > cur[k].peak) { cur[k].peak = tv; cur[k].tPeak = G.t; } if (!striking) closeSwing(k); }
    }
    for (; seen < G.hits.length; seen++) {
      const m = /^(P|E)->([a-zA-Z_]+):([a-z]+) (\d+)J$/.exec(G.hits[seen]); if (!m) continue;
      const [, att, zone, type, eS] = m; const Eo = +eS, S = side[att], f = F[att];
      S.hits++;
      if (type === 'blunt') { S.bluntHits++; S.bluntE.push(Eo); } else { S.cutHits++; S.cutE.push(Eo); }
      if (zone === 'head' || zone === 'neck') S.headNeck++;
      S.tipAtHit.push(f.tipVel.length()); S.arcAtHit.push(Math.abs(f.arcLast || 0));
      if (cur[att]) { cur[att].hits++; const dtH = G.t - cur[att].t0; S.tHit.push(dtH); S.hitFrac.push(cur[att].peak > 0 ? f.tipVel.length() / cur[att].peak : 0); } else S.hitsOutside++;
      const vp = F[att].bodies.pelvis.translation(), vq = F[att === 'P' ? 'E' : 'P'].bodies.pelvis.translation(); S.distAtHit.push(Math.hypot(vp.x - vq.x, vp.z - vq.z)); S.handAtHit.push(f.skill?.vel ? Math.hypot(f.skill.vel.x, f.skill.vel.y) : NaN);
    }
  }
  for (const k of ['P', 'E']) closeSwing(k);
  for (const k of ['P', 'E']) { const f = F[k]; if (f.state === 'dead') { side[k].deaths++; const c = f.causeOfDeath || '?'; side[k].causes[c] = (side[k].causes[c] || 0) + 1; side[k === 'P' ? 'E' : 'P'].kills++; } }
  ends.push(`${P.state[0]}${E.state[0]}`);
  perSeed.push({ seed, end: `${P.state[0]}${E.state[0]}`, Pf: side.P.falls - s0.Pf, Ef: side.E.falls - s0.Ef, Pc: side.P.cutHits - s0.Pc, Ec: side.E.cutHits - s0.Ec, Ph: side.P.hits - s0.Ph, Eh: side.E.hits - s0.Eh, Ps: side.P.swings - s0.Ps, Es: side.E.swings - s0.Es, Pcause: P.causeOfDeath, Ecause: E.causeOfDeath });
}
const row = (k) => { const S = side[k]; return { side: k, swings: S.swings, aborted: S.aborted, hits: S.hits, cut: S.cutHits, blunt: S.bluntHits, hitsPerSwing: f2(S.hits / Math.max(1, S.swings)), landedSwingPct: f1(100 * S.landedSwings / Math.max(1, S.swings)), hitsOutside: S.hitsOutside, headNeck: S.headNeck, cutE_med: f1(med(S.cutE)), cutE_p90: f1(p90(S.cutE)), bluntE_med: f1(med(S.bluntE)), tipAtHit_med: f1(med(S.tipAtHit)), peakTip_med: f1(med(S.peakTip)), startDist_med: f2(med(S.startDist)), startLat_med: f2(med(S.startLat)), arcAtHit_med: f2(med(S.arcAtHit)), tHit_med: f2(med(S.tHit)), tPeak_med: f2(med(S.tPeak)), hitFrac_med: f2(med(S.hitFrac)), distAtHit_med: f2(med(S.distAtHit)), handAtHit_med: f1(med(S.handAtHit)), falls: S.falls, deaths: S.deaths, causes: S.causes, kills: S.kills }; };
const out = { N, ends: ends.join(' '), P: row('P'), E: row('E'), perSeed };
console.log(JSON.stringify({ ...out, perSeed: undefined }));
if (args.seeds) for (const r of perSeed) console.log('seed ' + JSON.stringify(r));
const cols = ['swings', 'aborted', 'hits', 'cut', 'blunt', 'hitsPerSwing', 'landedSwingPct', 'hitsOutside', 'headNeck', 'cutE_med', 'cutE_p90', 'bluntE_med', 'tipAtHit_med', 'peakTip_med', 'startDist_med', 'startLat_med', 'arcAtHit_med', 'tHit_med', 'tPeak_med', 'hitFrac_med', 'distAtHit_med', 'handAtHit_med', 'falls', 'deaths', 'kills'];
console.log('쪽\t' + cols.join('\t'));
for (const k of ['P', 'E']) console.log(k + '\t' + cols.map((c) => out[k][c]).join('\t') + '\t' + JSON.stringify(out[k].causes));
