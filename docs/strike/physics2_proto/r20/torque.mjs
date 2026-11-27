// ─────────────────────────────────────────────────────────────
//  torque.mjs — 굳은 금 1 (r14 §3): 먼 런지 동안 다리 · 팔 관절 토크가 사람 한도에 닿은 스텝의 몫 (관절마다). 재기만 한다.
//   장면 = wb_gate 의 사람 길 먼 런지 그대로(같은 씨앗 → 같은 간격 · 키 × 1.45 ~ 1.55). 탭 바로 앞에 honesty.mjs 장부를 붙이고 탭 뒤 1.5 s 를 잰다.
//   관절 토크 두 가지 (honesty.mjs 의 셈 그대로):
//    명령 = 그 관절에 건 모터 토크(다시 셈) + 선언 토크 · '한도에 닿음' = 크기 > 사람 한도 (엉덩 · 무릎 · 발목 250 · 어깨 100 · 팔꿈치 80 · 손목 25 N·m)
//    전달 = 엔진이 실제로 관절에 실은 토크(먼 쪽 묶음의 운동량 변화로 셈) > 한도
//  node docs/strike/physics2_proto/r20/torque.mjs --root=<나무> [--seeds=4001-4040] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
import { makeMeasure, seedList, rng } from '../../../../tools/sim/wb_measure.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const HON = await import(pathToFileURL(join(ROOT, 'tools/sim/honesty.mjs')).href);
const M = makeMeasure(H);
const seeds = seedList(args.seeds ?? '4001-4040');
const HEIGHT = 1.72, FPS = 3; const farGap = (R, k) => HEIGHT * (1.45 + 0.10 * (k + R()) / FPS); // wb_gate 와 같은 셈 · 같은 난수 차례 (무기마다 먼 셋 · 가까운 하나)
const bodiesOf = (f) => { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; };
const JOINTS = /^(thigh|shin|foot|uarm|farm|sword)/;
const res = {};
for (const w of ['rapier', 'longsword']) {
  const acc = {}; let trials = 0;
  for (const s of seeds) {
    const R = rng(s * 7 + 1); const gg = {}; for (const ww of ['rapier', 'longsword']) { gg[ww] = [0, 1, 2].map((k) => farGap(R, k)); R(); } const gap = gg[w][s % FPS]; // 관문의 먼 런지 셋 가운데 씨앗마다 하나(s % 3) — 띠 전체를 고르게
    let L = null, S = null; const last = Math.round(1.5 / M.DT) - 1;
    const out = M.runThrust(s, w, { gap, pelvisGap: gap, post: 1.5, onTap: (G, P) => { L = HON.attach(G.world, bodiesOf(P), { fighter: P }); HON.hook(G, [L]); }, onStep: (G, P, E, i) => { if (i === last && L) S = L.summary(); } }); // 장부 요약은 세계를 풀기 전에
    if (!out.length || !S) continue; trials++;
    for (const [k, j] of Object.entries(S.joints ?? {})) {
      if (!JOINTS.test(k)) continue; const a = (acc[k] ||= { limit: j.limit, n: 0, over: 0, mN: 0, mOver: 0, peak: 0, measPeak: 0 });
      const n = Math.round(1.5 / M.DT); a.n += n; a.over += j.overShare * n; a.mN += j.measCover * n; a.mOver += j.measOverShare * j.measCover * n; a.peak = Math.max(a.peak, j.peak); a.measPeak = Math.max(a.measPeak, j.measPeak);
    }
  }
  res[w] = { trials, joints: Object.fromEntries(Object.entries(acc).sort().map(([k, a]) => [k, { limit: a.limit, cmdAtLimit: +(a.over / a.n).toFixed(4), sentOverLimit: a.mN ? +(a.mOver / a.mN).toFixed(4) : null, cmdPeak: +a.peak.toFixed(1), sentPeak: +a.measPeak.toFixed(1) }])) };
  console.log(`${w} 먼 런지 ${trials} 번 (탭 뒤 1.5 s) — 관절: 명령이 한도에 닿은 몫 / 전달이 한도를 넘은 몫 (최고 명령 · 전달 N·m)`);
  for (const [k, j] of Object.entries(res[w].joints)) console.log(`  ${k.padEnd(7)} 한도 ${String(j.limit).padStart(3)} · 명령 ${(100 * j.cmdAtLimit).toFixed(1).padStart(5)} % · 전달 ${j.sentOverLimit == null ? '-' : (100 * j.sentOverLimit).toFixed(1).padStart(5) + ' %'} · 최고 ${j.cmdPeak} / ${j.sentPeak}`);
}
if (args.json) writeFileSync(String(args.json), JSON.stringify({ seeds: args.seeds ?? '4001-4040', res }, null, 1));
