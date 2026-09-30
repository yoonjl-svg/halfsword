// J audit: run any sim script, then dump branch counters
import { simPath } from './is_main.mjs';
globalThis.__JC = globalThis.__JC || {};
const [script, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], simPath(script), ...rest];
process.on('exit', () => { const JC = globalThis.__JC; console.log('JC ' + JSON.stringify(Object.fromEntries(Object.keys(JC).sort().map(k => [k, +JC[k].toFixed(2)])))); });
await import(new URL('./' + script, import.meta.url));
