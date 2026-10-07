// 팔·다리 절단 발생률 표 (COMBAT.limbSever 'count': 자르지 않고 후보만 센다 — 행동 변화 0, fights12 와 같은 판).
//  설계 docs/strike/limb_sever_design_2026-10-07.md §5-2. 격자 S(심각도 문턱) × r(관절 반경) 마다 "후보 사건/판" 과 관절·무기별 분포.
// 실행: node tools/sim/limb_sever_count.mjs [--sets=3] [--S=0.8,1.0,1.2,1.5] [--r=0.06,0.085,0.11] [--json=파일]
import { writeFileSync } from 'node:fs';
import { newRound, DT, AI, CONFIG } from './jelly_harness.mjs';
import { LIMB_SEVER_COUNT } from '../../src/fighter.js';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const SETS = +(args.sets ?? 3);
const SS = String(args.S ?? '0.8,1.0,1.2,1.5').split(',').map(Number);
const RS = String(args.r ?? '0.06,0.085,0.11').split(',').map(Number);
CONFIG.COMBAT.limbSever = 'count';
const seedRand = (seed) => { let s = seed * 9301 + 49297; Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
const fights = [];
let allCuts = 0, limbCuts = 0;
for (let seed = 1; seed <= 12 * SETS; seed++) {
  seedRand(seed);
  const G = newRound({ walls: true, seed }); const P = G.player, E = G.enemy; P.skill.level = 0.7;
  G.ai2 = new AI(P, E, 'normal');
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => hits.push(r);
  const n0 = LIMB_SEVER_COUNT.events.length;
  for (let i = 0; i < 30 / DT; i++) G.step();
  const ev = LIMB_SEVER_COUNT.events.slice(n0).map((e) => ({ ...e, seed }));
  allCuts += hits.filter((h) => h.type === 'cut').length;
  fights.push({ seed, end: `${P.state}/${E.state}`, weapons: [P.weaponSpecId, E.weaponSpecId], events: ev });
}
const events = fights.flatMap((f) => f.events);
const nF = fights.length;
const f2 = (x) => (+x).toFixed(2);
console.log(`limb_sever_count: 판 ${nF}(fights12 × ${SETS} 시드 묶음) · 통과 베기 후보(팔다리 관절 후보 있음) ${events.length} 건 · 판당 ${f2(events.length / nF)} · 전체 베기 상처 ${allCuts}`);
console.log('격자: 후보 사건/판 (심각도 ≥ S 이고 관절 거리 ≤ r)  [팔꿈치/어깨/무릎/엉덩이]');
console.log('   S \\ r  ' + RS.map((r) => String(r).padStart(22)).join(''));
const grid = {};
for (const S of SS) {
  let line = String(S).padStart(6) + '   ';
  for (const r of RS) {
    const sel = events.filter((e) => e.severity >= S && e.dist <= r);
    const k = (kind) => sel.filter((e) => e.kind === kind).length;
    grid[`${S}|${r}`] = { perFight: sel.length / nF, n: sel.length, elbow: k('elbow'), shoulder: k('shoulder'), knee: k('knee'), hip: k('hip'), fightsWith: new Set(sel.map((e) => e.seed)).size };
    line += `${f2(sel.length / nF)} [${k('elbow')}/${k('shoulder')}/${k('knee')}/${k('hip')}] f${new Set(sel.map((e) => e.seed)).size}`.padStart(22);
  }
  console.log(line);
}
const q = (a, p) => { const x = [...a].sort((p1, q1) => p1 - q1); return x.length ? x[Math.min(x.length - 1, Math.floor(p * (x.length - 1)))] : null; };
const sev = events.map((e) => e.severity), dist = events.map((e) => e.dist), en = events.map((e) => e.energy);
console.log(`후보 분포: 심각도 p10/p50/p90 ${q(sev, .1)}/${q(sev, .5)}/${q(sev, .9)} · 관절 거리 p10/p50/p90 ${q(dist, .1)}/${q(dist, .5)}/${q(dist, .9)} m · 에너지 p50/p90 ${q(en, .5)}/${q(en, .9)} J`);
const by = (key) => { const m = {}; for (const e of events) m[e[key]] = (m[e[key]] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '); };
console.log(`부위: ${by('part')}`); console.log(`관절: ${by('kind')}`); console.log(`무기(공격자): ${by('weapon')}`); console.log(`피격자 상태: ${by('state')}`);
if (args.json) writeFileSync(String(args.json), JSON.stringify({ sets: SETS, fights: nF, SS, RS, grid, events }, null, 1));
