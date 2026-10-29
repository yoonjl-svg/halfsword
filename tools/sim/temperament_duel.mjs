// 인물 맞대결 + 싸움 결 재기 (사장님 10/29 15:5x — docs/characters/temperament_2026-10-29.md §7: 반응 = 본 유파 · 광기의 브론 · 롤랑 / 베르나르도 가르기)
//  사용: node tools/sim/temperament_duel.mjs <A[:무기]> <B[:무기]> [판 수 8] [초 45] [--json]
//   A · B = 인물 id (CHARACTERS_BY_ID). ':무기' = 그 판에 드는 무기 — 시트와 다르면 main.js 처럼 유파 꾸러미도 그 무기 것(검술을 배우지 못한 인물은 그대로)
//   판마다 자리를 바꾼다(홀수 판 A = 상대 자리 · 짝수 판 A = 플레이어 자리 — 둘 다 AI). 겉모습(투구 · 판금) · 버티는 힘(vitality)은 시트 그대로
//  찍는 것 (인물마다): 이김 · 반응(s) · AI 숙련도(손에 든 유파) · 분당 공격 · 첫 공격까지(s) · 속임 몫 · 받아치기 몫(맞받기 + 먼저 끊기 ÷ 공격) · 이어 치기 몫 · 맞힘 · 간 볼 때 평균 거리(m)
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { getWeapon } from '../../src/weapons.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const JSON_OUT = process.argv.includes('--json');
const [specA, specB, seedsArg = '8', durArg = '45'] = args;
const side = (spec) => {
  const [id, w] = String(spec).split(':');
  const c = CHARACTERS_BY_ID[id];
  if (!c) { console.error('알 수 없는 id:', id); process.exit(1); }
  const weapon = w ? getWeapon(w).id : c.weapon;
  const persona = weapon !== c.weapon && !c.noSwordsmanship ? { ...c.ai.persona, school: weapon } : c.ai.persona; // main.js 와 같은 규칙
  return { id, c, weapon, level: c.ai.level, persona, label: w ? `${id}:${weapon}` : id };
};
const A = side(specA), B = side(specB);
const SEEDS = +seedsArg, DUR = +durArg;

const blank = () => ({ win: 0, attacks: 0, feints: 0, counters: 0, preempts: 0, followUps: 0, landed: 0, firstT: 0, firstN: 0, dSum: 0, dN: 0, t: 0, reaction: 0, prof: 0 });
const S = { A: blank(), B: blank() };
let draws = 0;
for (let s = 1; s <= SEEDS; s++) {
  const aEnemy = s % 2 === 1;
  const E = aEnemy ? A : B, P = aEnemy ? B : A;
  const G = newRound({ seed: s, difficulty: E.level, persona: E.persona, weapon2: E.weapon, look2: E.c.look, revive: E.c.revive,
    AI2Class: AI, difficulty2: P.level, persona2: P.persona, weapon: P.weapon, look: P.c.look, revive2: P.c.revive });
  G.enemy.vitality = E.c.vitality > 0 ? E.c.vitality : 1;
  G.player.vitality = P.c.vitality > 0 ? P.c.vitality : 1;
  const sides = [[aEnemy ? 'A' : 'B', G.ai, G.enemy], [aEnemy ? 'B' : 'A', G.ai2, G.player]];
  const first = { A: null, B: null };
  const steps = Math.round(DUR / DT);
  for (let i = 0; i < steps; i++) {
    G.step();
    for (const [k, ai] of sides) {
      if (first[k] == null && ai.stats.attacks > 0) first[k] = G.t;
      if (ai.mode === 'watch') { S[k].dSum += ai.d; S[k].dN++; }
    }
    if (!G.enemy.alive || !G.player.alive) break;
  }
  const alive = { [sides[0][0]]: G.enemy.alive, [sides[1][0]]: G.player.alive };
  const blood = { [sides[0][0]]: G.enemy.blood, [sides[1][0]]: G.player.blood };
  const winner = alive.A && !alive.B ? 'A' : alive.B && !alive.A ? 'B' : !alive.A && !alive.B ? null : blood.A > blood.B ? 'A' : blood.B > blood.A ? 'B' : null;
  if (winner) S[winner].win++; else draws++;
  for (const [k, ai] of sides) {
    const st = ai.stats, o = S[k];
    o.attacks += st.attacks; o.feints += st.feints; o.counters += st.counters; o.preempts += st.preempts; o.followUps += st.followUps; o.landed += st.landed;
    o.t += G.t; o.reaction = ai.level.reaction; o.prof = ai.proficiency;
    if (first[k] != null) { o.firstT += first[k]; o.firstN++; }
  }
}
const r2 = (x) => Math.round(x * 100) / 100;
const sum = (k, o) => ({
  who: k === 'A' ? A.label : B.label, win: o.win, reaction: r2(o.reaction), prof: o.prof,
  attPerMin: r2((o.attacks / o.t) * 60), firstAttack: o.firstN ? r2(o.firstT / o.firstN) : null,
  feintShare: o.attacks ? r2(o.feints / o.attacks) : 0, counterShare: o.attacks ? r2((o.counters + o.preempts) / o.attacks) : 0,
  followShare: o.attacks ? r2(o.followUps / o.attacks) : 0, landed: o.landed, watchDist: o.dN ? r2(o.dSum / o.dN) : null,
});
const out = { A: sum('A', S.A), B: sum('B', S.B), draws, seeds: SEEDS, dur: DUR };
if (JSON_OUT) console.log(JSON.stringify(out));
else {
  console.log(`${A.label} 대 ${B.label} — ${SEEDS} 판 × ${DUR} s · 무 ${draws}`);
  for (const k of ['A', 'B']) {
    const x = out[k];
    console.log(`  ${x.who}: 이김 ${x.win} · 반응 ${x.reaction} s · 숙련도 ${x.prof} · 분당 공격 ${x.attPerMin} · 첫 공격 ${x.firstAttack} s · 속임 ${x.feintShare} · 받아치기 ${x.counterShare} · 이어 치기 ${x.followShare} · 맞힘 ${x.landed} · 간 볼 때 거리 ${x.watchDist} m`);
  }
}
