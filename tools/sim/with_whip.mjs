// 채찍 덩굴 값(druid_whip.js WHIP 칸)을 바꾼 채로 다른 시뮬 스크립트를 돌린다 (감싸는 스크립트 — with_config.mjs 와 같은 꼴, 10/23 넷째 일)
// 실행: node tools/sim/with_whip.mjs '{"lash":1.8,"mass":0.9}' with_config.mjs ARENA.startHold=0 weapon_measures.mjs --gen --down druid_whip longsword
//  지금 값(WHIP_NOW) 위에 JSON 을 덮는다. 덩굴 길이(lash)는 무기 칸 bladeLength 도 따른다(weapons.js — 싸움꾼이 만들어질 때 읽음)
import { WHIP, setWhipPreset } from '../../src/druid_whip.js';
import { simPath } from './is_main.mjs';
const [json, script, ...rest] = process.argv.slice(2);
setWhipPreset('now');
Object.assign(WHIP, JSON.parse(json));
process.argv = [process.argv[0], simPath(script), ...rest];
await import(new URL('./' + script, import.meta.url));
