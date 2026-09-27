// 다리로 체중 받치기(BODY.weightMode = 'hybrid')를 켠 채로 다른 시뮬 스크립트를 돌린다
// 실행: node tools/sim/hybrid.mjs fights12.mjs [인자...]
import * as CONFIG from '../../src/config.js';
CONFIG.BODY.weightMode = 'hybrid';
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], script, ...rest];
await import(new URL('./' + script, import.meta.url));
