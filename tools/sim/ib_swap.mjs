// ─────────────────────────────────────────────────────────────
//  ib_swap.mjs — 이베리아 자리 바꿈 재기 (11/11 사장님 '싱지르와 알티바슈 포르트의 위치와 역할을 바꾸자' — 기록 docs/strike/ib_swap_2026-11-11.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만). 서 있는 과녁(롱소드 · AI 끔 · 상처는 몸에 안 걸고 기록만).
//  altib : 비기 알티바슈 포르트 — 사람 몸이 무장 창(press.armed — 무장 셈은 건너뜀)에서 탭을 끌지 않고 길게 눌러 메고, 메기 시작부터 hold 실제 초 뒤 뗌 → 내려침.
//          멜 때 기력 = st × 최대 기력. 판마다: 뗀 때 기력 · 위력 몫(k) · 첫 상처(자리 · 심각도 · J) · 상처 합 · 내려친 뒤 기력.
//          --k1=1 = 기력 몫을 끈 판(SECRET.altib.staminaK 0 — '기력 100 % 위력' 견줌)
//  spin  : 싱지르 — 과녁 가슴 거리 gap 에서 낸다(특수 공격 판 = skill.secret special · 비기 판 = --mode=spin). 판마다: 맞힘 · 첫 상처 J · 골반 옮김 · 몸 기울기 최대 · 넘어짐 · 끝 두 발 앞뒤
//  node tools/sim/ib_swap.mjs altib [--ws=zweihander,flamberge,tizona,durandal] [--st=1] [--hold=1.6] [--k1=0] [--seeds=1] [--set=…]
//  node tools/sim/ib_swap.mjs spin  [--ws=…] [--gaps=1.6,1.9,2.2] [--seeds=1] [--set=SECRET.ibSpin.stride=0.45] [--old=1]
// ─────────────────────────────────────────────────────────────
import { newRound, CONFIG, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { IBERIAN_SPIN_DEF } from '../../src/schools.js';
import { MEASURED } from '../../src/weapon_measured.js';
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
export function altibRun({ w = 'zweihander', seed = 1, st = 1, hold = 1.6, gap = null } = {}) {
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
      stRel = P.stamina.value;
    }
    uq.holdInput(down, true, true, true);
    P.handHeld = down;
  };
  try {
    while (G.t < pressAt + CONFIG.realS(hold) + 3) {
      G.step();
      if (k == null && uq.stats.altib?.k?.length) k = uq.stats.altib.k[0];
    }
    const first = wounds[0] ?? null;
    return { w, seed, st, hold, k, stRel: r1(stRel), stEnd: r1(P.stamina.value), weight: r3(P.stamina.weight), first, sev: r3(wounds.reduce((a, x) => a + x.sev, 0)), Emax: r1(Math.max(0, ...wounds.map((x) => x.E))), n: wounds.length, fired: uq.stats.altib?.fired ?? 0 };
  } finally {
    G.world.free();
  }
}

/** 싱지르 한 번 (서 있는 과녁 · 가슴 거리 gap) — special 판(기본) · old = 비기 판 실행(전 대본 · 비기 몫) */
export function spinRun({ w = 'zweihander', seed = 1, gap = 1.9, old = false, after = 1.6 } = {}) {
  const G = newRound({ walls: true, seed, weapon: w, weapon2: 'longsword', gap });
  const P = G.player;
  const D = G.enemy;
  G.ai.update = () => {};
  D.applyWound = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const K = CONFIG.TIME.k;
  const fireAt = 3.0;
  const wounds = [];
  let t0 = null, d0 = null, p0 = null, tMax = 0, fell = false, done = null, res = null;
  G.combat.hooks.onWound = ((pw) => (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === P && vic === D && t0 != null) wounds.push({ t: r3((G.t - t0) / K), zone: r.zone, sev: r3(r.type === 'blunt' ? 0 : r.severity ?? 0), E: r1(r.energy) });
  })(G.combat.hooks.onWound);
  try {
    while (G.t < fireAt + CONFIG.realS(after) + 0.2) {
      if (t0 == null && G.t >= fireAt) {
        d0 = P.foeDistance();
        const pp = P.bodies.pelvis.translation();
        p0 = { x: pp.x, z: pp.z };
        const ok = P.skill.secret(old ? { S: IBERIAN_SPIN_DEF, ctx: { ev: 'spin', turnDir: 0 } } : { S: IBERIAN_SPIN_DEF, ctx: { ev: 'spin', turnDir: 0 }, special: 'cingir' });
        if (!ok) throw new Error('싱지르를 못 냄');
        t0 = G.t;
      }
      G.step();
      if (t0 != null) {
        tMax = Math.max(tMax, tilt(P));
        if (P.state !== 'stand') fell = true;
        if (P.ibSpinDone && !res) res = P.ibSpinDone;
        if (P.ibSpin) res = { T: P.ibSpin.T, near: P.ibSpin.near, stride: P.ibSpin.stride };
        if (!P.skill.sec && done == null) done = r3((G.t - t0) / K);
      }
    }
    const pp = P.bodies.pelvis.translation();
    const g = P.gait;
    const fw = P.forward(new THREE.Vector3());
    const fa = g?.legs?.F?.ankle, ba = g?.legs?.B?.ankle;
    const feetLon = fa && ba ? Math.abs((fa.x - ba.x) * fw.x + (fa.z - ba.z) * fw.z) : null;
    const first = wounds[0] ?? null;
    return { w, seed, gap, d0: r3(d0), hit: wounds.some((x) => x.sev > 0), first, Emax: r1(Math.max(0, ...wounds.map((x) => x.E))), sev: r3(wounds.reduce((a, x) => a + x.sev, 0)), travel: r3(Math.hypot(pp.x - p0.x, pp.z - p0.z)), tiltMax: r1(tMax), fell, feetLon: r3(feetLon), done, T: r3(res?.T != null ? res.T / K : null) };
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
    if (arg('k1', '0') === '1') CONFIG.SECRET.altib.staminaK = 0;
    for (const w of ws) for (const st of arg('st', '1').split(',').map(Number)) for (const hold of arg('hold', '1.6').split(',').map(Number)) for (const seed of seeds) console.log(JSON.stringify(altibRun({ w, seed, st, hold })));
  } else if (mode === 'spin') {
    for (const w of ws) for (const gap of arg('gaps', '1.6,1.9,2.2').split(',').map(Number)) for (const seed of seeds) console.log(JSON.stringify(spinRun({ w, seed, gap, old: arg('old', '0') === '1' })));
  } else throw new Error('첫 인자: altib | spin');
}
