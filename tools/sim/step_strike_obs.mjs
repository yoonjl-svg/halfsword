// 걸어 들어가며 친 타격이 더 센가 — 관찰(AI 결투 36 판, 오늘 본판): 상처마다 치는 쪽 골반이 맞는 쪽으로 다가가는 속도(m/s)를 적고
//  다가감(> 0.4) / 제자리(|v| ≤ 0.4) / 물러남(< −0.4) 으로 나눠 베기 에너지·상대 속도·심각도 중앙값을 비교한다. 결정적.
//  실행: node tools/sim/step_strike_obs.mjs [N=36]
import { newRound, DT, AI } from './jelly_harness.mjs';
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const N = +(process.argv[2] || 36);
const H = [];
for (let seed = 1; seed <= N; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7; G.ai2 = new AI(P, E, 'normal');
  G.combat.hooks.onWound = (att, vic, r) => {
    const a = att.bodies.pelvis.translation(), b = vic.bodies.pelvis.translation(); const v = att.bodies.pelvis.linvel(); const vv = vic.bodies.pelvis.linvel();
    const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz) || 1;
    const closing = (v.x * dx + v.z * dz) / d; // 치는 쪽이 다가가는 속도
    const closingRel = ((v.x - vv.x) * dx + (v.z - vv.z) * dz) / d; // 둘 사이가 좁혀지는 속도
    H.push({ seed, who: att.name, type: r.type, zone: r.zone, E: r.energy, speed: r.speed, mEff: r.mEff, sev: r.severity, pass: r.pass, closing, closingRel, attSpeed: Math.hypot(v.x, v.z), gait: att.gait?.active ? 1 : 0 });
  };
  for (let i = 0; i < 30 / DT; i++) G.step();
}
const cuts = H.filter((h) => h.type === 'cut');
const bins = [['다가감 (> 0.4 m/s)', (h) => h.closing > 0.4], ['제자리 (|v| ≤ 0.4)', (h) => Math.abs(h.closing) <= 0.4], ['물러남 (< −0.4)', (h) => h.closing < -0.4]];
console.log(`상처 ${H.length} (베기 ${cuts.length}, 찌르기 ${H.filter((h) => h.type === 'stab').length}, 둔타 ${H.filter((h) => h.type === 'blunt').length}) · 36 판`);
console.log('구간\t베기 n\tE 중앙 J\tE p75\t상대속도 중앙 m/s\tmEff 중앙 kg\t심각도 중앙\t관통 비율\t치는 쪽 속도 중앙');
for (const [name, f] of bins) {
  const A = cuts.filter(f); if (!A.length) { console.log(`${name}\t0`); continue; }
  const p75 = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * 0.75)]; };
  console.log(`${name}\t${A.length}\t${med(A.map((h) => h.E)).toFixed(0)}\t${p75(A.map((h) => h.E)).toFixed(0)}\t${med(A.map((h) => h.speed)).toFixed(1)}\t${med(A.map((h) => h.mEff)).toFixed(2)}\t${med(A.map((h) => h.sev)).toFixed(2)}\t${(A.filter((h) => h.pass).length / A.length).toFixed(2)}\t${med(A.map((h) => h.attSpeed)).toFixed(2)}`);
}
// 상관: 다가가는 속도 ↔ 베기 에너지 (피어슨)
const pear = (x, y) => { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
console.log(`피어슨 r(다가가는 속도, 베기 E) = ${pear(cuts.map((h) => h.closing), cuts.map((h) => h.E)).toFixed(3)} · r(둘 사이 좁혀짐, E) = ${pear(cuts.map((h) => h.closingRel), cuts.map((h) => h.E)).toFixed(3)} · r(치는 쪽 속력, E) = ${pear(cuts.map((h) => h.attSpeed), cuts.map((h) => h.E)).toFixed(3)}`);
