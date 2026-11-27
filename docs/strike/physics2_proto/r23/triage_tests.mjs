// r23 새로 깨진 단위 시험 가르기 (씨앗 여덟): 한손 탭 찌르기 팔 범위(onehand_arm.test 의 tapRun · 씨앗만 바꿈 311 ~ 318)
//  node triage_tests.mjs --root=<나무>  → 씨앗마다 위팔 돌림 밖 몫 · 30° 넘게 위 몫 (시험 문턱 ≤ 1 %)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const W = await import(pathToFileURL(join(ROOT, 'tools/sim/wrist_audit.mjs')).href);
const sharesOf = (T) => { let n = 0, rotN = 0, shOut = 0, up30 = 0; for (const P of T.k.values()) { n += P.n; rotN += P.rotN; shOut += P.shOut; up30 += P.up30; } return { n, shOut: shOut / Math.max(1, rotN), up30: up30 / Math.max(1, n) }; }; // onehand_arm.test.mjs shares() 의 두 칸
for (let seed = 311; seed <= 318; seed++) {
  const T = new W.WristTally();
  for (const w of ['rapier', 'hwando']) for (const gd of ['pflug', 'ochs', 'langort']) T.merge(W.tapRun(w, gd, { seed }).T, `${w}:${gd}:`);
  const r = sharesOf(T); console.log(`seed ${seed} 스텝 ${r.n} · 위팔 돌림 밖 ${(100 * r.shOut).toFixed(1)} % · 30° 넘게 위 ${(100 * r.up30).toFixed(1)} %`);
}
