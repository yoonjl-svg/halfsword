// 사람 막기 단추 손 빠르기 곡선 — PS=<m/s> 로 AI_LEVELS.normal.parrySpeed 를 바꾼 채 parry_gap_map.mjs 를 그대로 돌린다 (플레이어 막기 단추 · 대본 공격)
//  PS=8 node tools/sim/pf_gap_wrap.mjs longsword,uchigatana
import { AI_LEVELS } from '../../src/config.js';
if (process.env.PS) AI_LEVELS.normal.parrySpeed = +process.env.PS;
await import('./parry_gap_map.mjs');
