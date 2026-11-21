// usage: J_COUNTS=1 node jrun.mjs <tool.mjs> [args...] — runs the tool, prints audit counters at exit
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const tool = resolve(process.argv[2]);
process.argv.splice(1, 2, tool);
process.on('exit', () => { const C = globalThis.__JC ?? {}; const o = Object.fromEntries(Object.keys(C).sort().map((k) => [k, +C[k].toFixed(3)])); process.stdout.write('\n@@JC ' + JSON.stringify(o) + '\n'); });
await import(pathToFileURL(tool).href);
