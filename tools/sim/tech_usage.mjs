// AI 가 실제 싸움에서 내는 공격 세기 (10/16 21:2x 사장님 '아래 찌르기가 들어오긴 해? 공격 자체가 거의 없어서 판정이 안 되는 건 아닌지'). 읽기만.
//  여정 상대(stages.js STAGE_ORDER 의 상대 · 후보 — 얼터는 원본과 같은 AI 라 빼고, 몸값이 다른 광기의 하인리히만 넣음)마다
//  플레이어 자리에 AI(보통 · 롱소드)를 세워 맞붙이고, 상대 AI 가 칼을 내는 순간(ai.js strikeCue)의 기술 이름을 센다. 속임수는 '속임수:이름'.
//  node tools/sim/tech_usage.mjs [상대,…|-] [판 수 3] [초 40]   (OUT=<json> 이면 판별 수를 적는다)
import { newRound, DT } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { STAGE_ORDER, STAGE_FOE, STAGE_FOE_EXTRA } from '../../src/stages.js';

const journey = [...new Set(STAGE_ORDER.flatMap((st) => [STAGE_FOE[st], ...(STAGE_FOE_EXTRA[st] ?? [])]))].filter((id) => id && (!id.endsWith('_mad') || id === 'heinrich_mad'));
const ids = process.argv[2] && process.argv[2] !== '-' ? process.argv[2].split(',') : journey;
const SEEDS = +(process.argv[3] ?? 3);
const DUR = +(process.argv[4] ?? 40);

let cur = null; // { fighter, c }
const orig = AI.prototype.strikeCue;
AI.prototype.strikeCue = function (t) {
  if (cur && this.me === cur.fighter) {
    const k = this.feint ? `속임수:${this.feint.name}` : t.name;
    cur.c[k] = (cur.c[k] ?? 0) + 1;
  }
  return orig.call(this, t);
};

const out = {};
for (const id of ids) {
  const F = CHARACTERS_BY_ID[id];
  if (!F) {
    console.log(id, '알 수 없음');
    continue;
  }
  const c = {};
  for (let s = 1; s <= SEEDS; s++) {
    const G = newRound({ seed: s, difficulty: F.ai.level, persona: F.ai.persona, weapon2: F.weapon, AI2Class: AI, difficulty2: 'normal', weapon: 'longsword', revive: F.revive });
    cur = { fighter: G.enemy, c };
    const steps = Math.round(DUR / DT);
    for (let i = 0; i < steps; i++) {
      G.step();
      if (!G.enemy.alive || !G.player.alive) break;
    }
    cur = null;
  }
  out[id] = c;
  const n = Object.values(c).reduce((a, b) => a + b, 0);
  const top = Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ');
  console.log(`${id.padEnd(16)} ${String(F.weapon).padEnd(12)} 공격 ${n} | ${top}`);
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
