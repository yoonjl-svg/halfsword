// r23 T1 — 찌르기 걸음 때(STRIKE_TIMING.base.thrustStep) 찾기: 관문 L5(손이 앞발보다 먼저 · 과녁 0.02 ~ 0.12 · 자료 가운데 0.07)와
//  가까운 찌르기 탭 → 맞음(G2 · 오늘보다 한 스텝 넘게 길어지면 안 됨)을 관문과 같은 장면(wb_gate 의 먼 · 가까운 거리 셈)으로 잰다.
//  node search_thrust.mjs --root=<나무> --seeds=4001-4010 --cand=-0.11,0,0.02,0.04,0.06,0.08 [--json=파일]
//  고름: 가까운 찌르기 tHit 가운데가 옛 값(−0.11 = 탭과 같은 때)보다 0.0083 s 넘게 길지 않은 값 가운데 두 무기 L5 가운데값과 0.07 의 차(큰 쪽)가 가장 작은 값.
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure, seedList, rng, q } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const M = makeMeasure(H);
const BODY = { height: 1.72, front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // wb_gate.mjs BODY 그대로
const farGap = (R, k) => BODY.height * (1.45 + (0.10 * (k + R())) / 3), nearGap = (w, R) => BODY.reach[w] + BODY.front - (0.05 + 0.30 * R());
const cands = String(args.cand ?? '-0.11,0,0.02,0.04,0.06,0.08').split(',').map(Number); const seeds = seedList(args.seeds ?? '4001-4010');
const res = [];
for (const c of cands) {
  H.CONFIG.STRIKE_TIMING.base.thrustStep = c;
  const o = { cand: c }; const far = { rapier: [], longsword: [] }, near = { rapier: [], longsword: [] };
  for (const s of seeds) {
    const R = rng(s * 7 + 1); // wb_gate runSeed 와 같은 난수 차례 (무기마다 먼 셋 → 가까운 하나 · 같은 R 을 이어 씀)
    for (const w of ['rapier', 'longsword']) {
      for (let k = 0; k < 3; k++) { const g = farGap(R, k); far[w].push(...M.runThrust(s, w, { gap: g, pelvisGap: g, post: 1.5, wb: true })); }
      const gn = nearGap(w, R); near[w].push(...M.runThrust(s, w, { gap: gn, pelvisGap: gn, post: 1.5, wb: true }));
    }
  }
  for (const w of ['rapier', 'longsword']) o[w] = { L5: q(far[w].map((r) => r.handFoot), 0.5), L5n: far[w].filter((r) => r.handFoot != null).length, nearHit: q(near[w].filter((r) => r.hit).map((r) => r.tHit), 0.5), nearN: near[w].filter((r) => r.hit).length, farFell: far[w].filter((r) => r.fell).length };
  res.push(o); console.log(JSON.stringify(o));
}
const base = res.find((r) => r.cand === -0.11);
const ok = res.filter((r) => !base || ['rapier', 'longsword'].every((w) => !(r[w].nearHit > base[w].nearHit + 0.0083)));
const score = (r) => Math.max(...['rapier', 'longsword'].map((w) => Math.abs(r[w].L5 - 0.07)));
ok.sort((a, b) => score(a) - score(b));
console.log('PICK', ok[0]?.cand, 'score', ok[0] ? score(ok[0]).toFixed(3) : '-');
if (args.json) writeFileSync(String(args.json), JSON.stringify({ res, pick: ok[0]?.cand }));
