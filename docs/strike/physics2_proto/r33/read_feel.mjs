// r33 반박 읽기 — 런지가 길어져 생기는 일 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//  node read_feel.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4021-4030] [--adds=0.45] [--mode=dbl,back] [--json=파일]
//   장면 = lunge_lib.mjs runLunge (lunge_recover.mjs 와 같은 간격 · 걸어 들어와 선 자세) · 탭 뒤 2.6 s
//   dbl  = 첫 탭 뒤 탭을 스텝마다 다시 누름(받아지는 대로 — 연달아 누르기)
//   back = 탭 0.15 s 뒤부터 0.6 s 동안 스틱을 뒤로(물러남 입력 — 사람 조종과 같은 P.move)
//   셈: 넘어짐(state 가 stand 아닌 스텝이 있음) · 맞음 · 받아진 탭 수 · 런지 부탁 수(gait.req 가 새로 생긴 수)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList } = await imp('tools/sim/wb_measure.mjs');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H); const { DT } = H;
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // lunge_scene.mjs 와 같음
const WS = String(args.w ?? 'rapier,longsword').split(','); const seeds = seedList(args.seeds ?? '4021-4030');
const ADDS = String(args.adds ?? '0.45').split(',').map(Number); const MODES = String(args.mode ?? 'dbl,back').split(',');
const rows = [];
for (const mode of MODES) for (const W of WS) for (const add of ADDS) for (const s of seeds) {
  let taps = 0, reqs = 0, lastReq = null, fell = false, k = 0;
  const r = runLunge(M, H, s, W, { gap: BODY.reach[W] + BODY.front + add, walk: 0.6, post: 2.6, wb: true,
    onTap: (G, P) => { if (mode === 'back') { const mv = P.move, set0 = mv.set.bind(mv); mv.set = (x, y) => set0(x, k * DT >= 0.15 && k * DT < 0.75 ? -1 : y); } },
    onStep: (G, P, E, i) => { k = i + 1; if (P.state !== 'stand') fell = true; const rq = P.gait?.req; if (rq && rq !== lastReq) reqs++; lastReq = rq;
      if (mode === 'dbl' && P.state === 'stand' && P.skill.thrust()) taps++; } });
  if (!r) continue;
  rows.push({ mode, W, add, seed: s, hit: !!r.hit, fell: fell || !!r.fell, taps, reqs });
}
for (const mode of MODES) for (const W of WS) for (const add of ADDS) { const R = rows.filter((r) => r.mode === mode && r.W === W && r.add === add); if (!R.length) continue;
  console.log(`${mode} | ${W} | +${add} | 판 ${R.length} | 맞음 ${R.filter((r) => r.hit).length} | 넘어짐 ${R.filter((r) => r.fell).length} [${R.filter((r) => r.fell).map((r) => r.seed).join(' ')}] | 더 받아진 탭 ${R.reduce((a, r) => a + r.taps, 0)} | 런지 부탁 ${R.reduce((a, r) => a + r.reqs, 0)}`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(rows));
