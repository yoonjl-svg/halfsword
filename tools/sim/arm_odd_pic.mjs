// ─────────────────────────────────────────────────────────────
//  arm_odd_pic.mjs — 새로 생긴 이상한 팔 꼴 고침 그림 JSON (11/13 — docs/strike/arm_odd_2026-11-13.md · 그림은 tools/sim/arm_reach_draw.py 가 그림)
//   전(빨강) = 11/12 둘째 판(칼자루 끝 앞 바닥 쥐면 곧장 — arm_real_pin 'armOdd') · 후(파랑) = 지금(frontIn 들임). 같은 손가락 길(arm_reach_audit runDir — 손가락은 두 판 같음).
//   칸: 쥔 첫 스텝(전 판 손 목표 × 가 한 스텝에 튄 때) · 전 판이 그 꼴로 가장 깊었던 때 t* · 멈춘 끝 — 두 판 같은 때
//   꼴: rev = 손 면 안 각 가장 작은 때(거꾸로 쥠 < −45°) · shRot = 위팔 돌림 가장 안쪽(한도 −70°) · oor = 손목 범위 밖 가장 큰 때
//  node tools/sim/arm_odd_pic.mjs --cells=durandal:downRight:fast:rev --pout=그림.json [--title=…]   (여러 칸은 쉼표 — 칸마다 가장 깊은 때 · 멈춘 끝 두 줄)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { runDir, armReachSample, poseOf, FLAG_KO, DIR_KO } from './arm_reach_audit.mjs';
import { withArmOld } from './arm_real_pin.mjs';
import { isMain } from './is_main.mjs';

const RED = '#d93025';
const BLUE = '#1a73e8';
const was2 = (fn) => withArmOld(fn, ['armOdd']);
const MODE_KO = { slow: '천천히 끌어 멈춤', fast: '빠르게 긋고 댄 채' };
const deg = (x) => `${x < 0 ? '-' : ''}${Math.abs(x).toFixed(0)}°`; // 그림 글꼴(wqy)에 '−'(U+2212)가 없어 '-'

/** 한 칸: 스텝마다 표본 · 자세 · 앞 바닥 섞음 */
function run(weapon, dir, mode) {
  const steps = [];
  const r = runDir({ weapon, dir, mode, onRound({ G, P }) {
    const st = G.step.bind(G);
    G.step = () => {
      st();
      const s = armReachSample(P);
      if (s) steps.push({ t: G.t, s, w: P.frontW ?? 0, pose: poseOf(P) });
    };
  } });
  return { r, steps };
}
const near = (R, t) => R.steps.reduce((m, x) => (Math.abs(x.t - t) < Math.abs(m.t - t) ? x : m), R.steps[0]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** 꼴의 깊이 (클수록 나쁨) */
const DEPTH = { rev: (s) => -s.dev, shRot: (s) => -(s.shRot ?? 0), oor: (s) => s.oor };
const LEGEND = {
  rev: ['손 면 안 각: 칼이 아래팔 줄에서 새끼 쪽으로', '  (사람 -30° · 거꾸로 쥠 < -45°)'],
  shRot: ['위팔 돌림: 안쪽 -70° · 바깥 90° 가 사람 끝', '  (AAOS — 넘으면 위팔 돌림 밖)'],
  oor: ['손목 범위 밖: 손 면 안 각이 사람 범위', '  (-30° ~ 엄지 쪽 끝)를 넘은 각 (10° 넘게 = 걸림)'],
};
const VAL = { rev: (s) => `손 면 안 각 ${deg(s.dev)}`, shRot: (s) => `위팔 돌림 ${deg(s.shRot ?? 0)}`, oor: (s) => `손목 범위 밖 ${deg(s.oor)}` };

export function oddPic(cells, title = null) {
  const sets = [{ name: '11/12 둘째 판 (전 — 쥐면 곧장)', color: RED, poses: {}, cells: {} }, { name: '지금 (후 — 0.1 s 로 들임)', color: BLUE, poses: {}, cells: {} }];
  const labels = {};
  const one = cells.length === 1;
  const rows = one ? [[], [null]] : [[], [], [null]];
  for (const spec of cells) {
    const [w, dir, mode, k] = spec.split(':');
    const B = was2(() => run(w, dir, mode));
    const A = run(w, dir, mode);
    const worst = B.steps.reduce((m, x) => (DEPTH[k](x.s) > DEPTH[k](m.s) ? x : m), B.steps[0]);
    const kx = `${spec}:x`, ke = `${spec}:e`;
    if (one) {
      // 쥔 첫 스텝 (전 판 손 목표가 튄 때)
      const i0 = B.steps.findIndex((x) => x.w > 0);
      const kg = `${spec}:g`;
      rows[0].push(kg, kx, ke);
      labels[kg] = `${w} · 쥔 첫 스텝`;
      for (const [si, R] of [[0, B], [1, A]]) {
        const x = near(R, B.steps[i0].t);
        const p = near(R, B.steps[i0 - 1].t);
        sets[si].poses[kg] = x.pose;
        sets[si].cells[kg] = `${si ? '후' : '전'} 손 목표 × 한 스텝에 ${(dist(x.pose.target, p.pose.target) * 100).toFixed(1)} cm · 앞 바닥 ${Math.round(x.w * 100)} %`;
      }
    } else {
      rows[0].push(kx);
      rows[1].push(ke);
    }
    const short = one ? '' : `${w} · `;
    labels[kx] = `${short}전 판 가장 깊은 때 (쥔 뒤 ${(worst.t - B.steps.find((x) => x.w > 0).t).toFixed(2)} s)`;
    labels[ke] = `${short}멈춘 끝`;
    for (const [si, R] of [[0, B], [1, A]]) {
      const x = near(R, worst.t);
      sets[si].poses[kx] = x.pose;
      sets[si].cells[kx] = `${si ? '후' : '전'} ${VAL[k](x.s)} · 뻗음 ${x.s.reach.toFixed(2)} · 팔꿈치 ${Math.round(x.s.elbow)}°`;
      sets[si].poses[ke] = R.r.poseEnd;
      const fl = R.r.flags.map((f) => FLAG_KO[f]);
      sets[si].cells[ke] = `${si ? '후' : '전'} 뻗음 ${R.r.end.reach.toFixed(2)} · ${FLAG_KO[k]} ${Math.round(R.r.frac[k] * 100)} %${fl.length ? ' · 걸림: ' + fl.join(' · ') : ' · 걸린 꼴 없음'}`;
    }
  }
  if (!one) rows[0].push(null), rows.pop();
  const [, d0, m0] = cells[0].split(':');
  return {
    title: title ?? `${DIR_KO[d0]} ${MODE_KO[m0]} — 새로 생긴 꼴 전 · 후`,
    sub: one ? '쥔 첫 스텝(전 판 손 목표가 튄 때) · 전 판이 그 꼴로 가장 깊었던 때 · 멈춘 끝 — 두 판 같은 손가락 · 같은 때' : '위 줄 = 전 판이 그 꼴로 가장 깊었던 때 · 아래 줄 = 멈춘 끝 — 두 판 같은 손가락 · 같은 때',
    sets, order: rows, labels,
    legend: LEGEND[cells[0].split(':')[3]],
  };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const out = arg('pout', '.tmp/pic.json');
  writeFileSync(out, JSON.stringify(oddPic(arg('cells', '').split(','), arg('title', null))));
  console.log(out);
}
