// 설정 객체 안쪽 값을 JSON 으로 덮어쓴 채 다른 시뮬 스크립트를 돌린다 (with_config.mjs 는 맨 위 값만 바꾼다)
// 실행: PATCH='{"STROKE":{"diagR":{"over":40}}}' node tools/sim/with_patch.mjs hybrid.mjs wholebody.mjs cuts
import * as CONFIG from '../../src/config.js';
import { simPath } from './is_main.mjs';
const merge = (dst, src) => {
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object') merge(dst[k], v);
    else dst[k] = v;
  }
};
merge(CONFIG, JSON.parse(process.env.PATCH || '{}'));
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], simPath(script), ...rest];
await import(new URL('./' + script, import.meta.url));
