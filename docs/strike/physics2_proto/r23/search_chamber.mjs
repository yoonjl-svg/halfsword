// r23 읽기 지적 3 — 당김 끝 손 빠르기(STRIKE_TIMING.base.chamberV) 찾기. 관문과 같은 사람 찌르기 장면(wb_gate 의 먼 셋 · 가까운 하나 거리 셈 — search_thrust.mjs 와 같음)으로
//  G2 가까운 찌르기 탭 → 맞음 가운데 · 가까운 맞음 수 · L5 를 후보마다 잰다.
//  node search_chamber.mjs --root=<나무> --seeds=4001-4020 --cand=0.25,0.5,1,2,Infinity [--json=파일]
//  바탕 나무(STRIKE_TIMING 없음)는 후보 없이 한 번 잰다(--cand=base).
//  고름 (재기 앞에 정함): 두 무기 모두 가까운 tHit 가운데가 바탕(같은 씨앗 · 같은 대본)보다 0.0083 s(한 스텝) 넘게 길지 않은 후보 가운데 가까운 맞음 수(두 무기 합)가 가장 많은 것 · 같으면 L5 가 0.07 에 가까운 것.
//  Infinity = 머묾 없음(걸음만 옮긴 판과 같음).
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, readFileSync, existsSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure, seedList, rng, q } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const M = makeMeasure(H);
const BODY = { height: 1.72, front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // wb_gate.mjs BODY 그대로
const farGap = (R, k) => BODY.height * (1.45 + (0.10 * (k + R())) / 3), nearGap = (w, R) => BODY.reach[w] + BODY.front - (0.05 + 0.30 * R());
const cands = String(args.cand ?? '0.25,0.5,1,2,Infinity').split(',').map((c) => (c === 'base' ? c : Number(c))); const seeds = seedList(args.seeds ?? '4001-4020');
const res = [];
for (const c of cands) {
  if (c !== 'base') H.CONFIG.STRIKE_TIMING.base.chamberV = c;
  const o = { cand: String(c) }; const far = { rapier: [], longsword: [] }, near = { rapier: [], longsword: [] };
  for (const s of seeds) {
    const R = rng(s * 7 + 1);
    for (const w of ['rapier', 'longsword']) {
      for (let k = 0; k < 3; k++) { const g = farGap(R, k); far[w].push(...M.runThrust(s, w, { gap: g, pelvisGap: g, post: 1.5, wb: true })); }
      const gn = nearGap(w, R); near[w].push(...M.runThrust(s, w, { gap: gn, pelvisGap: gn, post: 1.5, wb: true }));
    }
  }
  for (const w of ['rapier', 'longsword']) o[w] = { L5: q(far[w].map((r) => r.handFoot), 0.5), nearHit: q(near[w].filter((r) => r.hit).map((r) => r.tHit), 0.5), nearN: near[w].filter((r) => r.hit).length, nearAll: near[w].length, farFell: far[w].filter((r) => r.fell).length, nearFell: near[w].filter((r) => r.fell).length };
  res.push(o); console.log(JSON.stringify(o));
}
const baseF = args.base ? String(args.base) : null;
const base = baseF && existsSync(baseF) ? JSON.parse(readFileSync(baseF, 'utf8')).res.find((r) => r.cand === 'base') : res.find((r) => r.cand === 'base');
if (base) {
  const ok = res.filter((r) => r.cand !== 'base' && ['rapier', 'longsword'].every((w) => !(r[w].nearHit > base[w].nearHit + 0.0083)));
  const hits = (r) => r.rapier.nearN + r.longsword.nearN; const l5 = (r) => Math.max(...['rapier', 'longsword'].map((w) => Math.abs(r[w].L5 - 0.07)));
  ok.sort((a, b) => hits(b) - hits(a) || l5(a) - l5(b));
  console.log('BASE', JSON.stringify(base)); console.log('OK', ok.map((r) => r.cand).join(' '), '· PICK', ok[0]?.cand ?? '-');
  if (args.json) writeFileSync(String(args.json), JSON.stringify({ res, base, ok: ok.map((r) => r.cand), pick: ok[0]?.cand ?? null }));
} else if (args.json) writeFileSync(String(args.json), JSON.stringify({ res }));
