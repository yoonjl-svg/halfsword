// t_ref.mjs — 방식 (iii) 맞춤 확인: 벤치에 옮긴 지금 게임 꼴이 게임에서 잰 값(tools/sim/chain_probe.mjs · 문서 s2 §2-1)과 얼마나 맞나. 작게 감기 · 닻 yaw 상한 100 (게임 값).
//   node t_ref.mjs
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRapier, HERE, fmt } from './lib.mjs';
import { runGame } from './game.mjs';
import { FAMS } from './cuts.mjs';
const R = await loadRapier();
const KO = { longsword: '롱소드', zweihander: '츠바이핸더', uchigatana: '우치가타나', rapier: '레이피어' };
// 게임에서 잰 값 (s2_strike_chain.md §2-1: 칼날 70 % · 칼끝 · 몸통 몫(골반 돌림 + 허리 + 등) · 손목 몫)
const GAME = { longsword: { diag: [13.9, 17.8, 10, 34], vert: [13.4, 17.2, 2, 46], horiz: [13.0, 17.2, 2, 80] }, zweihander: { diag: [13.7, 18.3, 46, 58], vert: [13.7, 17.6, 8, 32], horiz: [5.6, 7.8, 132, 58] }, uchigatana: { diag: [13.4, 16.8, 21, 41], vert: [12.5, 15.8, -4, 36], horiz: [15.5, 20.0, 7, 49] }, rapier: { diag: [12.7, 16.3, 10, 31], vert: [15.3, 19.9, -7, 40], horiz: [8.1, 10.5, 16, 45] } };
const L = []; const P = (x) => L.push(x);
P('# 표 R — 방식 (iii) 맞춤: 벤치(게임 꼴을 옮긴 것 · 풀이 6 × PGS 1 · 닻 yaw 상한 100) 대 게임에서 잰 값');
P('무기 | 획 | 벤치 칼날 70 % | 게임 | 비 | 벤치 칼끝 | 게임 | 벤치 칼 KE J | 벤치 몸통 몫 % | 게임 | 벤치 손목 몫 % | 게임 | 손목 서보 포화 % | 차례 | PGS 4 일 때 칼날 70 %');
P('---|---|---|---|---|---|---|---|---|---|---|---|---|---|---');
const ratios = [];
for (const weapon of Object.keys(GAME)) for (const fam of ['diag', 'vert', 'horiz']) {
  const s = runGame(R, { weapon, fam, size: 'small', yawCap: 100 }).sum; const s4 = runGame(R, { weapon, fam, size: 'small', yawCap: 100, pgs: 4 }).sum;
  const g = GAME[weapon][fam]; ratios.push(s.v70 / g[0]);
  P(`${KO[weapon]} | ${FAMS[fam].ko} | ${fmt(s.v70)} | ${g[0]} | ${fmt(s.v70 / g[0], 2)} | ${fmt(s.tip)} | ${g[1]} | ${fmt(s.keS, 0)} | ${fmt(100 * s.trunkShare, 0)} | ${g[2]} | ${fmt(100 * s.share.wrist, 0)} | ${g[3]} | ${fmt(100 * s.sat.wr, 0)} | ${s.order ? '○' : '×'} | ${fmt(s4.v70)}`);
}
ratios.sort((a, b) => a - b);
P(`벤치 ÷ 게임 (칼날 70 %): 가운데값 ${fmt(ratios[Math.floor(ratios.length / 2)], 2)} · 범위 ${fmt(ratios[0], 2)} ~ ${fmt(ratios.at(-1), 2)} (게임 값이 5.6 · 8.1 로 무너진 두 칸 포함)`);
writeFileSync(join(HERE, 'out/ref.txt'), L.join('\n') + '\n'); console.log(L.join('\n'));
