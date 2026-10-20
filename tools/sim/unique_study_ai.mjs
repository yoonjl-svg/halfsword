// 고유 공격 실험 B · P3 (2026-10-20 감독 — docs/strike/unique_attack_study_result_2026-10-20.md) — AI 유파 단위 고유 공격 켬/끔 · 하나 빼기 (설계서 §4 B, 절반 규모)
//  ARM=on | off | drop:<이름> · SCHOOL · SEEDS · OPPS · OUT. 유파 무기 AI(숙련도 4 · normal 실력 숫자) 대 상대 AI(여섯 무기 · normal). 끔 = 유파 AI 를 만들 때만 SCHOOL_ART.unique=false (패시브 · 실력 숫자 같음)
import { newRound, DT, AI } from './harness_m.mjs';
import { SCHOOL_ART, TRADITIONS } from '../../src/schools.js';
import { observeHealth } from './chinese_benefit_model.mjs';
import { writeFileSync } from 'node:fs';
const SCH = { german: 'longsword', italian: 'rapier', iberian: 'zweihander', japanese: 'monohoshizao', chinese: 'qinggang' };
const OPP = ['longsword', 'uchigatana', 'zweihander', 'qinggang', 'rapier', 'flamberge'];
const school = process.env.SCHOOL, arm = process.env.ARM ?? 'on', out = process.env.OUT;
const seeds = (process.env.SEEDS ?? '701,702,703').split(',').map(Number), opps = (process.env.OPPS ?? OPP.join(',')).split(',');
const W = SCH[school]; if (!W) throw new Error('school ' + school);
const rows = [];
for (const seed of seeds) for (const opp of opps) for (const side of [0, 1]) {
  const t0 = Date.now(); const uses = {}; let schoolAI = null;
  class SchoolAI extends AI {
    constructor(me, foe, d, p) {
      const keep = SCHOOL_ART.unique; if (arm === 'off') SCHOOL_ART.unique = false;
      // ARM=drop:<이름> = 넷 가운데 그 하나만 뺌 (P3 하나 빼기) — 만들 때만 ai:false
      const drop = arm.startsWith('drop:') ? (TRADITIONS[school].unique ?? []).find((u) => (u.feint ? u.feint.name : u.name) === arm.slice(5)) : null;
      if (arm.startsWith('drop:') && !drop) throw new Error('no unique ' + arm);
      const keepAi = drop ? drop.ai : undefined; if (drop) drop.ai = false;
      super(me, foe, d, p); SCHOOL_ART.unique = keep; if (drop) { if (keepAi === undefined) delete drop.ai; else drop.ai = keepAi; }
      if (arm === 'off') this.uniqueByName = new Map();
      schoolAI = this; const cue = this.setTechCue.bind(this);
      this.setTechCue = (name, kind, ...r) => { if (kind === 'unique') uses[name] = (uses[name] ?? 0) + 1; return cue(name, kind, ...r); };
    }
  }
  const G = side === 0
    ? newRound({ weapon: W, weapon2: opp, seed, AI2Class: SchoolAI, persona2: { proficiency: 4 } })
    : newRound({ weapon: opp, weapon2: W, seed, AIClass: SchoolAI, persona: { proficiency: 4 }, AI2Class: AI });
  const S = side === 0 ? G.player : G.enemy, O = side === 0 ? G.enemy : G.player;
  S.skill.level = O.skill.level = 0.7;
  const hS = observeHealth(S, () => G.t), hO = observeHealth(O, () => G.t);
  let end = 30;
  for (let i = 0; i < 30 / DT; i++) { G.step(); if ((!S.alive || !O.alive) && end === 30) end = G.t + 0.5; if (G.t >= end) break; }
  const sev = (l) => +l.reduce((s, h) => s + (h.severity ?? 0), 0).toFixed(3);
  rows.push({ school, arm, seed, opp, side, dur: +G.t.toFixed(2), sAlive: S.alive, oAlive: O.alive, sDeath: hS.r?.death ?? hS.death ?? null,
    recvSev: sev((hS.r ?? hS).applied), recvLimb: +((hS.r ?? hS).limbLost ?? 0).toFixed(3), recvConc: +((hS.r ?? hS).concussion ?? 0).toFixed(3), recvBleed: +((hS.r ?? hS).bleedAdded ?? 0).toFixed(4),
    dealtSev: sev((hO.r ?? hO).applied), dealtLimb: +((hO.r ?? hO).limbLost ?? 0).toFixed(3), dealtConc: +((hO.r ?? hO).concussion ?? 0).toFixed(3), dealtBleed: +((hO.r ?? hO).bleedAdded ?? 0).toFixed(4),
    recvT: (hS.r ?? hS).applied.map((h) => [+h.t.toFixed(2), +(h.severity ?? 0).toFixed(3)]), dealtT: (hO.r ?? hO).applied.map((h) => [+h.t.toFixed(2), +(h.severity ?? 0).toFixed(3)]),
    uses, attacks: schoolAI?.stats?.attacks ?? null, ms: Date.now() - t0 });
  console.log(JSON.stringify({ ...rows.at(-1), recvT: undefined, dealtT: undefined }));
}
if (out) writeFileSync(out, JSON.stringify(rows));
