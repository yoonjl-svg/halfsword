// ─────────────────────────────────────────────────────────────
//  ib_swap.mjs — 이베리아 자리 바꿈 재기 (11/11 사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자' — 기록 docs/strike/ib_swap_2026-11-11.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만). 서 있는 과녁(롱소드 · AI 끔 · 상처는 몸에 안 걸고 기록만).
//  altib : 비기 알티바슈 포르트 — 사람 몸이 무장 창(press.armed — 무장 셈은 건너뜀)에서 탭을 끌지 않고 길게 눌러 메고, 메기 시작부터 hold 실제 초 뒤 뗌 → 내려침.
//          멜 때 기력 = st × 최대 기력. 판마다: 뗀 때 기력 · 위력 몫(k) · 첫 상처(자리 · 심각도 · J) · 상처 합 · 내려친 뒤 기력.
//  node tools/sim/ib_swap.mjs altib [--ws=zweihander,flamberge,tizona,durandal] [--st=1] [--hold=1.6] [--k1=0] [--seeds=1] [--set=…] [--rel=100,60,30,0 (11/16 뗀 순간 기력 · vMax 칼끝 가장 빠름 실제 m/s)]
// ─────────────────────────────────────────────────────────────
import { newRound, CONFIG, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { iaiTipSpeed } from '../../src/secret_instant.js'; // 11/16 칼끝 몫 → 실제 m/s (목표 빠르기 vT)
import { isMain } from './is_main.mjs';

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const R2D = 180 / Math.PI;
const tilt = (P) => {
  const q = P.bodies.chest.rotation();
  return Math.acos(Math.min(1, new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)).y)) * R2D;
};
export function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}

/** 비기 알티바슈 포르트 한 번 (서 있는 과녁) */
export function altibRun({ w = 'zweihander', seed = 1, st = 1, hold = 1.6, gap = null, rel = null } = {}) { // rel (11/16): 뗀 순간 기력을 이 값으로 (빠르기 판 견줌 — 칼끝 가장 빠름 vMax 실제 m/s)
  const [C, R] = MEASURED[w] ?? MEASURED.longsword;
  const G = newRound({ walls: true, seed, weapon: w, weapon2: 'longsword', gap: gap ?? (C + R) / 2 });
  const P = G.player;
  const D = G.enemy;
  G.ai.update = () => {};
  D.applyWound = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo']) });
  const K = CONFIG.TIME.k;
  const pressAt = 3.0;
  const wounds = [];
  let tWind = null, tRel = null, down = false, st0 = null, stRel = null, k = null;
  G.combat.hooks.onWound = ((pw) => (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === P && vic === D && tRel != null) wounds.push({ t: r3((G.t - tRel) / K), zone: r.zone, sev: r3(r.type === 'blunt' ? 0 : r.severity ?? 0), E: r1(r.energy), type: r.type });
  })(G.combat.hooks.onWound);
  G.before = () => {
    const t = G.t;
    if (t >= pressAt - 0.02 && st0 == null) {
      P.stamina.value = st * P.stamina.max;
      st0 = P.stamina.value;
    }
    if (t >= pressAt && tRel == null) down = true;
    if (tWind == null && uq.winding) tWind = t;
    if (tWind != null && tRel == null && t - tWind >= CONFIG.realS(hold)) {
      tRel = t;
      down = false;
      if (rel != null) P.stamina.value = rel; // 11/16 뗀 순간 기력 (빠르기 판 견줌)
      stRel = P.stamina.value;
    }
    uq.holdInput(down, true, true, true);
    P.handHeld = down;
  };
  try {
    let vMax = 0;
    const tip = new THREE.Vector3(), prevTip = new THREE.Vector3();
    const tips = [];
    let have = false;
    while (G.t < pressAt + CONFIG.realS(hold) + 3) {
      G.step();
      if (k == null && uq.stats.altib?.k?.length) k = uq.stats.altib.k[0];
      P.bladePoint(1, tip);
      if (tRel != null && G.t - tRel <= CONFIG.realS(0.6)) {
        tips.push(tip.clone());
        if (tips.length > 4) vMax = Math.max(vMax, tip.distanceTo(tips[tips.length - 5]) / ((4 * CONFIG.PHYSICS.timestep) / K)); // 뗀 뒤 0.6 실제 s 안 칼끝 가장 빠름 — 4 스텝 창 평균 (실제 m/s · 운동학 칼 놓임 튐을 거름)
      }
      prevTip.copy(tip);
      have = true;
    }
    const first = wounds[0] ?? null;
    const sh = uq.stats.altib?.share?.[0] ?? null;
    return { w, seed, st, hold, k, share: sh, vT: sh != null ? r1(sh * iaiTipSpeed(P) * K) : null, vMax: r1(vMax), stRel: r1(stRel), stEnd: r1(P.stamina.value), weight: r3(P.stamina.weight), first, sev: r3(wounds.reduce((a, x) => a + x.sev, 0)), Emax: r1(Math.max(0, ...wounds.map((x) => x.E))), n: wounds.length, fired: uq.stats.altib?.fired ?? 0 };
  } finally {
    G.world.free();
  }
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => {
    const a = rest.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : d;
  };
  applySets(arg('set', ''));
  const ws = arg('ws', 'zweihander,flamberge,tizona,durandal').split(',');
  const seeds = arg('seeds', '1').split(',').map(Number);
  if (mode === 'altib') {
    const rels = arg('rel', null)?.split(',').map(Number) ?? [null]; // 11/16 뗀 순간 기력 (빠르기 판 견줌)
    for (const w of ws) for (const st of arg('st', '1').split(',').map(Number)) for (const hold of arg('hold', '1.6').split(',').map(Number)) for (const rel of rels) for (const seed of seeds) console.log(JSON.stringify(altibRun({ w, seed, st, hold, rel })));
  } else throw new Error('첫 인자: altib');
}
