// 다리로 체중 받치기(BODY.weightMode = 'hybrid')를 켠 채로 다른 시뮬 스크립트를 돌린다
// 실행: node tools/sim/hybrid.mjs fights12.mjs [인자...]
import * as CONFIG from '../../src/config.js';
import { simPath } from './is_main.mjs';
CONFIG.BODY.weightMode = 'hybrid';
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], simPath(script), ...rest]; // 절대 경로로 넘긴다 (대상 스크립트의 직접 실행 확인이 맞게)
await import(new URL('./' + script, import.meta.url));
