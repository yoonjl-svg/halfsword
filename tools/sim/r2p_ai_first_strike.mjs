// WA5 통제 실험(R2′ 묶음을 AI 가 쓸 때 베는 자리, 10/8): 가만히 선(자세만 지키는) 상대에게 AI 가 고른 첫 베기 — 맞나, 베나, 어디를, 얼마나, 빗나가면 어느 쪽으로. 결정적.
//  node tools/sim/r2p_ai_first_strike.mjs [--N=36] [--who=P|E] [--bundle=player|all [--trunkArc=2] [--trunkFollow=0.5]] [--chain=legs] [--rows=1]   (who=E 면 E 의 AI(옛 보정)가 가만히 선 P 를, P 면 보정 v2 의 P 가 E 를 벤다; bundle 은 with_config 없이 안에서 켠다)
import { newRound, DT, AI, THREE, CONFIG } from './jelly_harness.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const N = +(args.N ?? 36), who = args.who ?? 'P';
if (args.bundle) { CONFIG.BODY.trunkArc = +(args.trunkArc ?? 2); CONFIG.BODY.trunkFollow = +(args.trunkFollow ?? 1); CONFIG.ARM.servoLead = 0.5; if (args.bundle === 'all') CONFIG.BODY.r2pScope = 'all'; }
if (args.chain) CONFIG.BODY.chain = args.chain;
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const f1 = (x) => +x.toFixed(1), f2 = (x) => +x.toFixed(2);
let strikeStarted = null; const origStart = AI.prototype.startStrike;
AI.prototype.startStrike = function () { strikeStarted = { t: null, kind: this.tech.kind, name: this.tech.name || this.tech.id || '?', dist: this.contactDist(), lat: this.foeLat }; return origStart.apply(this, arguments); };
const rows = [];
for (let seed = 1; seed <= N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7;
  const att = who === 'P' ? P : E, vic = who === 'P' ? E : P;
  if (who === 'P') { G.ai = { update() { E.move.set(0, 0); } }; G.ai2 = new AI(P, E, 'normal'); } else { G.ai2 = { update() { P.move.set(0, 0); } }; }
  const ai = who === 'P' ? G.ai2 : G.ai;
  strikeStarted = null; let seen = 0; const hits = []; let minD = 9, atMin = null, peak = 0, tEnd = null, fell = false, started = false;
  const tip = () => att.tipPos ? att.tipPos : null;
  for (let i = 0; i < 8 / DT; i++) {
    G.step();
    if (strikeStarted && !started) { started = true; strikeStarted.t = G.t; seen = G.hits.length; }
    if (started) {
      const tv = att.tipVel.length(); if (tv > peak) peak = tv;
      // 칼끝 ↔ 상대 가슴·목·머리 중심 최단 거리와 그때 칼끝의 옆 치우침(공격자 → 상대 선 기준, 오른쪽 +)·높이
      const tp = att.tipPrev; 
      if (tp) for (const part of ['chest', 'neck', 'head']) { const b = vic.bodies[part]; if (!b) continue; const c = b.translation(); const d = Math.hypot(tp.x - c.x, tp.y - c.y, tp.z - c.z); if (d < minD) { const ap = att.bodies.pelvis.translation(), vp = vic.bodies.pelvis.translation(); const fx = vp.x - ap.x, fz = vp.z - ap.z, L = Math.hypot(fx, fz) || 1; const rx = fz / L, rz = -fx / L; minD = d; const hp = att.bodies.handR ? att.bodies.handR.translation() : att.bodies.pelvis.translation(); atMin = { part, lat: f2((tp.x - c.x) * rx + (tp.z - c.z) * rz), dy: f2(tp.y - c.y), along: f2(((tp.x - ap.x) * fx + (tp.z - ap.z) * fz) / L), alongV: f2(((c.x - ap.x) * fx + (c.z - ap.z) * fz) / L), handAlong: f2(((hp.x - ap.x) * fx + (hp.z - ap.z) * fz) / L), chestYaw: f2(att.bodyPose?.chestYaw ?? 0), tip: f1(tv), t: f2(G.t - strikeStarted.t) }; } }
      for (; seen < G.hits.length; seen++) { const m = /^(P|E)->([a-zA-Z_]+):([a-z]+) (\d+)J$/.exec(G.hits[seen]); if (m && m[1] === who) hits.push({ zone: m[2], type: m[3], E: +m[4], t: f2(G.t - strikeStarted.t) }); }
      if (att.state === 'down' || att.state === 'getup') fell = true;
      const striking = ai.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow');
      if (!striking && G.t - strikeStarted.t > 0.1) { tEnd = G.t; break; }
    }
  }
  rows.push({ seed, started, kind: strikeStarted?.kind, dist: strikeStarted ? f2(strikeStarted.dist) : null, lat: strikeStarted ? f2(strikeStarted.lat) : null, dur: tEnd && strikeStarted ? f2(tEnd - strikeStarted.t) : null, peak: f1(peak), hits, minD: f2(minD), atMin, fell, arc: f2(att.arcLast || 0) });
}
const st = rows.filter((r) => r.started); const hit = st.filter((r) => r.hits.length), cut = st.filter((r) => r.hits.some((h) => h.type !== 'blunt'));
const first = st.filter((r) => r.hits.length).map((r) => r.hits[0]);
console.log(JSON.stringify({ who, N, started: st.length, hit: hit.length, cut: cut.length, bluntOnly: hit.length - cut.length, firstHitE_med: f1(med(first.map((h) => h.E))), firstCutE_med: f1(med(first.filter((h) => h.type !== 'blunt').map((h) => h.E))), peak_med: f1(med(st.map((r) => r.peak))), dist_med: f2(med(st.map((r) => r.dist))), fell: st.filter((r) => r.fell).length, miss_lat_med: f2(med(st.filter((r) => !r.hits.length && r.atMin).map((r) => r.atMin.lat))), miss_minD_med: f2(med(st.filter((r) => !r.hits.length).map((r) => r.minD))), zones: Object.fromEntries(['head', 'neck', 'chest', 'belly', 'pelvis', 'arm', 'leg'].map((z) => [z, first.filter((h) => h.zone.startsWith(z)).length])) }));
if (args.rows) for (const r of rows) console.log(JSON.stringify(r));
