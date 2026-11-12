// ─────────────────────────────────────────────────────────────
//  arm_clear2_pic.mjs — 두 팔 엇갈림 막기 둘째 그림 JSON (11/12 — docs/strike/arm_clear2_2026-11-12.md · 그림은 tools/sim/arm_reach_draw.py 가 그림)
//   전(빨강) = 11/12 첫 판 두 팔 엇갈림 막기(main 30929293 — arm_real_pin ARM_CLEAR1) · 후(파랑) = 지금.
//   human: 무기마다 같은 손가락 길(arm_reach_audit runDir — 손가락은 판마다 같음)에서 전 판이 가장 깊게 뚫은 때 t* 의 두 판 자세(위 줄) · 멈춘 끝 자세(아래 줄)
//   ai: AI 끼리 장면(fights12 씨앗 · harness_m 짝)에서 전 판(AI 몫 끔) AI 가 가장 깊게 뚫은 때 t* — 같은 판을 AI 몫 켜고 돌려 같은 t* 의 자세 (판 시작 뒤 짧은 때만 — 그 뒤는 두 판이 갈라짐)
//  node tools/sim/arm_clear2_pic.mjs human --weapons=zweihander,flamberge,durandal --dir=right [--mode=slow] --pout=그림.json [--title=…]
//  node tools/sim/arm_clear2_pic.mjs ai --scenes=fights12:2:P:2.0,pair:zweihander:longsword:3:P:3.0 --pout=그림.json   (장면:씨앗:몸:찾는 끝 s)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { runDir, armReachSample, poseOf, FLAG_KO, weaponCells, DIR_KO } from './arm_reach_audit.mjs';
import { withArmOld } from './arm_real_pin.mjs';
import { CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const { SKILL } = CONFIG;
const RED = '#d93025';
const BLUE = '#1a73e8';
const cm = (x) => `${x < 0 ? '-' : '+'}${Math.abs(x * 100).toFixed(1)} cm`; // 그림 글꼴(wqy)에 '−'(U+2212)가 없어 '-'
const old1 = (fn) => withArmOld(fn, ['armClear2']);

/** 사람 한 칸: 스텝마다 두 팔 겉 틈 · 자세를 남기고 (t → 자세) */
function humanRun(weapon, dir, mode) {
  const steps = [];
  const r = runDir({ weapon, dir, mode, onRound({ G, P }) {
    const step = G.step.bind(G);
    G.step = () => {
      step();
      if (!P.handHeld) return;
      const s = armReachSample(P);
      if (s) steps.push({ t: G.t, arms: s.arms, reach: s.reach, pose: poseOf(P) });
    };
  } });
  return { r, steps };
}

export function humanPic(weapons, dir, mode = 'slow', title = null) {
  const B = Object.fromEntries(weapons.map((w) => [w, old1(() => humanRun(w, dir, mode))]));
  const A = Object.fromEntries(weapons.map((w) => [w, humanRun(w, dir, mode)]));
  const sets = [['11/12 첫 판 (전)', RED, B], ['지금 (후)', BLUE, A]].map(([name, color, R]) => ({ name, color, poses: {}, cells: {} }));
  const order = [[], []];
  const labels = {};
  for (const w of weapons) {
    const b = B[w], a = A[w];
    const worst = b.steps.reduce((m, s) => (s.arms < m.arms ? s : m), b.steps[0]);
    const at = (R) => R.steps.reduce((m, s) => (Math.abs(s.t - worst.t) < Math.abs(m.t - worst.t) ? s : m), R.steps[0]);
    const kx = `${w}:x`, ke = `${w}:e`;
    order[0].push(kx);
    order[1].push(ke);
    const cell = weaponCells([w])[0];
    labels[kx] = `${w} (${cell.tierKo}) · 가장 겹친 때`;
    labels[ke] = `${w} — 멈춘 끝`;
    for (const [si, R] of [[0, b], [1, a]]) {
      const s = at(R);
      sets[si].poses[kx] = s.pose;
      sets[si].cells[kx] = `${si ? '후' : '전'} 두 팔 겉 틈 ${cm(s.arms)} · 뻗음 ${s.reach.toFixed(2)}`;
      sets[si].poses[ke] = R.r.poseEnd;
      const fl = R.r.flags.map((k) => FLAG_KO[k]);
      sets[si].cells[ke] = `${si ? '후' : '전'} 뻗음 ${R.r.end.reach.toFixed(2)} · 두 팔 뚫은 몫 ${Math.round(R.r.frac.arms * 100)} %${fl.length ? ' · ' + fl.join(' · ') : ''}`;
    }
  }
  order.push([null]);
  const nm = { slow: '천천히 끌어 멈춤', fast: '빠르게 긋고 댄 채' }[mode];
  return { title: title ?? `${DIR_KO[dir]} 끝까지 (${nm}) — 두 팔 엇갈림 전 · 후`, sub: '위 줄 = 전 판이 끄는 동안 가장 깊게 겹친 때 (두 판 같은 손가락 자리) · 아래 줄 = 멈춘 끝 · 겉 틈 - = 뚫음', sets, order, labels, legend: ['두 팔 겉 틈 = 칼 팔 ↔ 빈팔 겉끼리', '  (손목 6 cm 뺌 · - = 뚫음)'] };
}

/** AI 장면 한 판 (AI 몫 켬/끔) — 고른 몸의 스텝마다 두 팔 겉 틈 · 자세 (until s 까지) */
async function aiRun(scene, seed, who, until) {
  const steps = [];
  let G;
  if (scene === 'fights12') {
    const J = await import('./jelly_harness.mjs');
    let s = seed * 9301 + 49297;
    Math.random = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    G = J.newRound({ walls: true, seed });
    G.player.skill.level = 0.7;
    G.ai2 = new J.AI(G.player, G.enemy, 'normal');
  } else {
    const [, w1, w2] = scene.split('/');
    const H = await import('./harness_m.mjs');
    const { applyWeaponMeasure } = await import('./weapon_measures.mjs');
    G = H.newRound({ seed, weapon: w1, weapon2: w2, AI2Class: H.AI, walls: true, persona: { proficiency: 3 }, persona2: { proficiency: 3 } });
    applyWeaponMeasure(G.ai, w2);
    applyWeaponMeasure(G.ai2, w1);
  }
  const f = who === 'P' ? G.player : G.enemy;
  try {
    while (G.t < until) {
      G.step();
      if (G.t < 0.3 || f.state !== 'stand') continue;
      const s = armReachSample(f);
      if (s) steps.push({ t: G.t, arms: s.arms, reach: s.reach, aim: [f.skill.aim.x, f.skill.aim.y], pose: poseOf(f), w: f.weaponSpecId });
    }
  } finally {
    G.world.free();
  }
  return steps;
}

export async function aiPic(specs, title = null) {
  const sets = [{ name: 'AI 몫 끔 (전 — main)', color: RED, poses: {}, cells: {} }, { name: 'AI 몫 켬 (후)', color: BLUE, poses: {}, cells: {} }];
  const keys = [];
  const labels = {};
  for (const sp of specs) {
    const [scene, seed, who, until] = sp.split(':');
    const keep = SKILL.armClear.ai;
    let b, a;
    SKILL.armClear.ai = 0;
    try {
      b = await old1(() => aiRun(scene, +seed, who, +until));
    } finally {
      SKILL.armClear.ai = keep;
    }
    a = await aiRun(scene, +seed, who, +until);
    const worst = b.reduce((m, s) => (s.arms < m.arms ? s : m), b[0]);
    const near = a.reduce((m, s) => (Math.abs(s.t - worst.t) < Math.abs(m.t - worst.t) ? s : m), a[0]);
    const k = sp;
    keys.push(k);
    labels[k] = `${scene === 'fights12' ? `fights12 씨앗 ${seed} · ${worst.w}` : `${worst.w} 대 ${scene.split('/')[2]} · 씨앗 ${seed}`} · ${worst.t.toFixed(2)} s`;
    sets[0].poses[k] = worst.pose;
    sets[0].cells[k] = `전 두 팔 겉 틈 ${cm(worst.arms)} · 손 목표 패드 ${worst.aim.map((x) => x.toFixed(2)).join(', ')}`;
    sets[1].poses[k] = near.pose;
    sets[1].cells[k] = `후 두 팔 겉 틈 ${cm(near.arms)} · 패드 ${near.aim.map((x) => x.toFixed(2)).join(', ')}`;
  }
  const all = [...keys, null]; // 끝 칸 = 범례
  const order = [];
  for (let i = 0; i < all.length; i += 3) order.push(all.slice(i, i + 3));
  return { title: title ?? 'AI 끼리 싸움 — AI 두 팔 엇갈림 전 · 후 (같은 판 · 같은 때)', sub: '전 판에서 AI 두 팔이 가장 깊게 뚫은 때 · 같은 판을 AI 몫 켜고 돌린 같은 때 (판 시작 뒤 짧은 때 — 두 판 명령이 같음)', sets, order, labels, legend: ['두 팔 겉 틈 = 칼 팔 ↔ 빈팔 겉끼리', '  (손목 6 cm 뺌 · - = 뚫음)'] };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const out = arg('pout', '.tmp/pic.json');
  const J = argv[0] === 'ai' ? await aiPic(arg('scenes', '').split(','), arg('title', null)) : humanPic(arg('weapons', '').split(','), arg('dir', 'right'), arg('mode', 'slow'), arg('title', null));
  writeFileSync(out, JSON.stringify(J));
  console.log(out);
}
