// AI 대 AI 다섯 유파 판 (10/21 스킬트리 — 사람 몫을 칸마다 나눌 때 AI 판이 그대로인지 보는 관문 보조): 유파 무기 여섯 × 시드 둘 · 둘 다 숙련도 5 · 20 초.
//  고유 공격 · 강화동작 이점(무릎 꺾기 · 틈 · 쌓기 · 출혈) · 유파 패시브 · 흘림 · 쳐내기 · 이어 긋기 흐름이 모두 도는 판 — fights12(롱소드끼리)가 못 보는 유파 몫.
//  바꾸기 전 · 후 stdout 이 바이트 같아야 한다(sha256). AI 는 스킬트리를 읽지 않는다(몸에 skillKit 없음 — src/skill_kit.js).
//  node tools/sim/school_ai_fights.mjs | sha256sum
import { createHash } from 'node:crypto';
import { newRound, DT, AI } from './harness_m.mjs';
const W = ['longsword', 'rapier', 'zweihander', 'uchigatana', 'qinggang', 'monohoshizao'];
const out = [];
for (let i = 0; i < W.length; i++) for (const seed of [11, 12]) {
  const a = W[i], b = W[(i + 2) % W.length];
  const G = newRound({ walls: true, seed, weapon: a, weapon2: b, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const wounds = [];
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => { pw?.(att, vic, r, ...rest); wounds.push(`${att.index}${r.zone}${r.type}${r.severity.toFixed(4)}${r.energy.toFixed(2)}`); };
  for (let k = 0; k < Math.round(20 / DT); k++) G.step();
  const P = G.player, E = G.enemy;
  const pos = [P, E].map((f) => { const t = f.bodies.pelvis.translation(); return `${t.x.toFixed(5)},${t.z.toFixed(5)}`; }).join('|');
  out.push(`${a} v ${b} s${seed}: ${P.state}/${E.state} blood ${P.blood.toFixed(5)}/${E.blood.toFixed(5)} wounds ${wounds.length} ${createHash('sha256').update(wounds.join(';')).digest('hex').slice(0, 12)} pos ${pos} buckle ${(G.combat.buckleLog ?? []).length} flowSp ${P.stamina.counts?.flow ?? 0}/${E.stamina.counts?.flow ?? 0}`);
  G.world.free();
}
console.log(out.join('\n'));
