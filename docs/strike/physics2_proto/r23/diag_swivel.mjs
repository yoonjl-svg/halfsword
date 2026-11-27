// r23 읽기 지적 2 — 한손 탭 찌르기 위팔 돌림 밖이 어느 무기 · 자세 · 찌르기 마디(aim · extend · hold · recover)에서 나는가 (onehand_arm.test tapRun 그대로)
//  node diag_swivel.mjs --root=<나무> [--seeds=311-318]  → 칸마다 스텝 · 위팔 돌림 밖 스텝 수
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const W = await import(pathToFileURL(join(ROOT, 'tools/sim/wrist_audit.mjs')).href);
const [a, b] = String(args.seeds ?? '311-311').split('-').map(Number);
const tot = new Map();
for (let seed = a; seed <= (b ?? a); seed++) for (const w of ['rapier', 'hwando']) for (const gd of ['pflug', 'ochs', 'langort']) {
  const { T } = W.tapRun(w, gd, { seed });
  for (const [k, P] of T.k) { const key = `${w}:${gd}:${k}`; const o = tot.get(key) ?? { n: 0, rotN: 0, shOut: 0 }; o.n += P.n; o.rotN += P.rotN; o.shOut += P.shOut; tot.set(key, o); }
}
for (const [k, o] of tot) console.log(`${k.padEnd(24)} 스텝 ${o.n} · 돌림 잰 ${o.rotN} · 밖 ${o.shOut}`);
