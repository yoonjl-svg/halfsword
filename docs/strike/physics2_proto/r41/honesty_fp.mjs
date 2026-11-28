// r41 — 정직 심판(tools/sim/honesty.mjs)을 칸의 PIERCE 재는 수준으로 돌림 (읽기만 · 심판 대본은 그대로 · 재는 쪽 값만 바꿈)
//  node honesty_fp.mjs --root=<칸> [--fp=230] [--ff=0] --scene=fight --weapon=rapier --seed=4001 --secs=30 --json=파일
//  PIERCE 가 없는 칸(바탕)은 그대로 심판만 돈다. 심판은 자기 main 을 '직접 불렸을 때'만 돌리므로 argv[1] 을 심판 경로로 둔다.
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const CM = await import(pathToFileURL(join(ROOT, 'src/combat.js')).href);
if (CM.PIERCE) { if (args.fp != null) CM.PIERCE.FP = +args.fp; if (args.ff != null) CM.PIERCE.FF = +args.ff; }
const judge = join(ROOT, 'tools/sim/honesty.mjs');
process.argv[1] = judge;
await import(pathToFileURL(judge).href);
console.log(`PIERCE ${CM.PIERCE ? JSON.stringify(CM.PIERCE) : '없음(바탕)'}`);
