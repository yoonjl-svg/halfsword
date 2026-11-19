// 혼자 2:1 과 같은 짝의 1:1 (11/19 사장님 '이탈리아만 다수전 지능이나 판단을 일부 떨어트려도 됨. 근데 그게 기본적으로 1:1에서 만들어진 숙련도별 격차로 인한 것인지 판단 필요.' —
//  기록 docs/strike/lone_master_2026-11-19.md §3): team_sense.mjs --modes=2v1 --sides=A:B --lone=유파 와 같은 씨앗 · 같은 무기로
//  혼자(자리 1 · 숙련 A · 그 유파 대표 무기 둘을 씨앗 홀짝으로) 대 둘 쪽 한 몸(자리 0 · 숙련 B · 2:1 의 둘 쪽 두 몸 — --field 와 같은 무기 · 꾸러미)을 1:1 로 (벽 · 최대 90 s · 겉모습 같음).
//  씨앗마다 두 판(둘 쪽 두 몸 하나씩 — none 은 두 몸이 같아 씨앗 2N 개에 한 판씩) — 혼자 이김 · 짐 · 끝 안 남. 재기 전용 (게임 코드는 읽기만).
//  쓰임: node tools/sim/lone_duel.mjs N A:B 유파 [--field=even|none] [--out=파일]   (N = 씨앗 수 — 판 2N)
import { newMatch, DT } from './jelly_harness.mjs';
import { aiAtProficiency } from '../../src/characters.js';
import { LOOKS } from '../../src/looks.js';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const N = +(pos[0] ?? 12);
const [PA, PB] = String(pos[1] ?? '6:4').split(':').map(Number);
const SCHOOL = pos[2] ?? 'german';
const OUT = (args.find((a) => a.startsWith('--out=')) ?? '').slice(6) || null;
const FIELD = (args.find((a) => a.startsWith('--field=')) ?? '').slice(8) || null; // team_sense.mjs --field 와 같은 둘 쪽 (even · none — 안 주면 loadout)
const MAX = 90;
const WEAPONS = ['longsword', 'kriegsmesser', 'rapier', 'pappenheimer', 'zweihander', 'flamberge', 'uchigatana', 'monohoshizao', 'hwando', 'qinggang']; // 11/19 사장님 '잴 때(뭘 재는 거든) 에스톡과 세이버는 쓰지 마' — 다섯 유파 대표 무기 열 · team_sense.mjs loadout 과 같음 (유파마다 둘 · ai_ring_measure.mjs 와 같음)
const loadout = (seed, count) => Array.from({ length: count }, (_, i) => WEAPONS[(seed * 7 + i * 3) % WEAPONS.length]); // 걸음 3 — 한 판 넷까지 서로 다른 무기 (0 · 3 · 6 · 9) · 씨앗 7 걸음으로 열을 다 돎
const LONE_W = { german: ['longsword', 'kriegsmesser'], italian: ['rapier', 'pappenheimer'], iberian: ['zweihander', 'flamberge'], japanese: ['uchigatana', 'monohoshizao'], chinese: ['hwando', 'qinggang'] };
if (!LONE_W[SCHOOL]) throw new Error(`유파 ${SCHOOL}`);
const FIELD_SCH = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
if (FIELD === 'none') { const S = await import('../../src/schools.js'); const { WEAPONS: WP } = await import('../../src/weapons.js'); S.SCHOOLS.none_sword ??= S.weaponSchool(WP.longsword, 'none'); }
/** 둘 쪽 몸 m(자리 0 · 2) — team_sense.mjs fieldBody 와 같음 */
const fieldBody = (k, seed, m) => (FIELD === 'none' ? { weapon: 'longsword', school: 'none_sword' } : FIELD === 'even' ? { weapon: LONE_W[FIELD_SCH[m === 0 ? Math.floor((k % 25) / 5) : k % 5]][seed % 2] } : { weapon: loadout(seed, 3)[m] });

const rows = [];
for (let k = 0; k < (FIELD === 'none' ? 2 * N : N); k++) {
  const seed = k + 1;
  const lw = LONE_W[SCHOOL][seed % 2];
  for (const m of FIELD === 'none' ? [0] : [0, 2]) {
    let s = seed * 9301 + 49297;
    Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const fb = fieldBody(k, seed, m);
    const weapons = [fb.weapon, lw];
    const G = newMatch({ count: 2, ai: 'all', seed, walls: true, weapons, looks: [LOOKS.enemy, LOOKS.enemy], aiOf: (i) => aiAtProficiency({ ai: { persona: i === 0 && fb.school ? { school: fb.school } : {} }, weapon: weapons[i] }, i === 1 ? PA : PB) });
    const [O, L] = G.fighters;
    let i = 0;
    for (; i < MAX / DT && O.alive && L.alive; i++) G.step();
    const res = L.alive && !O.alive ? 'W' : !L.alive && O.alive ? 'L' : 'D';
    rows.push({ seed, m, lone: lw, foe: fb.weapon, pack: fb.school ?? null, res, t: +G.t.toFixed(2) });
    process.stderr.write(`${SCHOOL} ${PA}:${PB} s${seed} m${m} ${lw} 대 ${fb.weapon}${fb.school ? `(${fb.school})` : ''} → ${res} @${G.t.toFixed(1)}\n`);
    G.world.free();
  }
}
const W = rows.filter((r) => r.res === 'W').length;
const D = rows.filter((r) => r.res === 'D').length;
const sum = { school: SCHOOL, cell: `${PA}:${PB}`, field: FIELD ?? 'loadout', n: rows.length, W, D, L: rows.length - W - D, p: +(W / rows.length).toFixed(3) };
console.log(JSON.stringify(sum));
if (OUT) writeFileSync(OUT, JSON.stringify({ ...sum, rows }, null, 1));
