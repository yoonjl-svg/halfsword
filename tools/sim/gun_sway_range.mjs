// 가늠쇠(총신 겨눔) 흔들림 궤적 범위 · 사람 손 사격 — 사장님 10/30 00:1x '가늠쇠의 흔들림 궤적을 좀더 넓혀. 중심부 바깥으로 벗어나서 좀더 많이 흔들리게 하는거지.
//  지금 총 궤적 범위보다 10% 정도 더 넓혀.' (docs/decisions.md 10/30 00:1x · 확인표 2987)
//  전 = GUN.aimEnvelopeScale 1.1 · 후 = 지금 값(1.21). 한 프로세스에서 둘 다 돈다 (흔들림 난수는 검객별 전용 — 판정 난수 · 탄 퍼짐과 따로).
//  범위 = 가운데(gun.js gunAimTarget 의 확대 가운데 — 골반과 몸 줄 끝의 가운데)에서
//   ① 목표점(gunAimTarget — 사격 자세가 쫓는 점) ② 레이저 점(실제 총신이 가운데를 지나는 세로 면에 닿는 점) 까지 거리: 최대 · p90 · p50 · 좌우 · 위아래 |p95|.
//  사람 = AI 없는 권총 몸(서서 겨눔 — 사람 손과 같은 사격 자세 gunPose) · AI = 마야 AI(걷고 쏨 — 쏜 뒤 0.5 s · 장전 · 판 시작 정지 뒤 0.5 s 안 스텝은 뺌).
//  상대 = 가만히 선 롱소드 몸(5.6 m 에서 시작). 총알 세기 0(상대가 안 죽게 — 맞음 셈은 그대로).
//  사람 손 사격: '막 탭'(쏠 수 있으면 바로) · '레이저 탭'(레이저가 몸에 닿은 스텝에 탭 — 가장 잘하는 손) · '늦은 탭'(레이저가 몸에 닿고 0.2 s 뒤 탭 — 사람 반응) → 몸에 맞은 발 / 쏜 발.
//   node tools/sim/gun_sway_range.mjs [범위 게임 초=120] [사격 게임 초=600] [씨앗=3]  (흔들림 난수는 검객 자리별이라 씨앗을 바꿔도 거의 같은 궤적 — 표본은 길이로 늘린다)
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { GUN, gunSway, gunAimTarget } from '../../src/gun.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const [secsArg = '120', shootArg = '600', seedArg = '3'] = process.argv.slice(2);
const SECS = +secsArg;
const SHOOT = +shootArg;
const SEED = +seedArg;
const K = CONFIG.TIME.k;
const HOLD = CONFIG.ARENA.startHold;
const NOW = GUN.aimEnvelopeScale;
const SCALES = { 전: 1.1, 후: NOW };
const MAYA = CHARACTERS_BY_ID.samira;
const UP = new THREE.Vector3(0, 1, 0);

function muzzleRay(f) {
  const r = f.sword.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const p = f.sword.translation();
  const o = new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
  return { o, ax };
}
/** 이 스텝의 목표점 · 레이저 점 · 가운데 (월드) */
function sample(f) {
  const g = f.gun;
  const foe = f.foe;
  const sw = gunSway(g.t ?? 0, f.index * 2.1, {});
  const rs = g.rs ?? { yaw: 0, pitch: 0 };
  const sway = { yaw: sw.yaw + rs.yaw, pitch: sw.pitch + rs.pitch };
  const T = gunAimTarget(foe, g.h, sway, new THREE.Vector3());
  const keep = GUN.aimEnvelopeScale;
  GUN.aimEnvelopeScale = 0; // (목표 − 가운데) × 0 + 가운데 = 가운데
  const C = gunAimTarget(foe, g.h, sway, new THREE.Vector3());
  GUN.aimEnvelopeScale = keep;
  const { o, ax } = muzzleRay(f);
  const n = new THREE.Vector3(C.x - o.x, 0, C.z - o.z).normalize();
  const side = new THREE.Vector3().crossVectors(UP, n).normalize();
  const den = ax.dot(n);
  const P = den > 0.2 ? o.clone().addScaledVector(ax, C.clone().sub(o).dot(n) / den) : null;
  const off = (X) => {
    const d = X.clone().sub(C);
    return { r: d.length(), lat: d.dot(side), up: d.y };
  };
  return { T: off(T), P: P ? off(P) : null };
}
const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const stats = (S) => ({ max: Math.max(...S.map((x) => x.r)), p90: q(S.map((x) => x.r), 0.9), p50: q(S.map((x) => x.r), 0.5), lat: q(S.map((x) => Math.abs(x.lat)), 0.95), up: q(S.map((x) => Math.abs(x.up)), 0.95), n: S.length });

/** 흔들림 범위 한 판: who = 'human' | 'ai' */
function range(who, scale) {
  const keepE = GUN.energy;
  GUN.aimEnvelopeScale = scale;
  GUN.energy = 0;
  try {
    const G = who === 'human' ? newRound({ walls: true, seed: SEED, weapon: 'pistol', weapon2: 'longsword' }) : newRound({ walls: true, seed: SEED, weapon: 'longsword', weapon2: 'pistol', look2: MAYA.look, difficulty: MAYA.ai.level, persona: MAYA.ai.persona });
    if (who === 'human') G.ai.update = () => {}; // 상대는 가만히
    const f = who === 'human' ? G.player : G.enemy;
    const T = [];
    const P = [];
    for (let i = 0; i < Math.round(SECS / DT); i++) {
      G.step();
      const g = f.gun;
      if (!g || f.fightT < HOLD + 0.5 || g.reloading || g.since < 0.5 || g.pending >= 0 || f.state !== 'stand') continue;
      const s = sample(f);
      T.push(s.T);
      if (s.P) P.push(s.P);
    }
    return { T: stats(T), P: stats(P), shots: f.gun?.shots ?? 0 };
  } finally {
    GUN.aimEnvelopeScale = NOW;
    GUN.energy = keepE;
  }
}

/** 사람 손 사격 한 판: mode = 'any' | 'laser' | 'late' */
function shoot(mode, scale) {
  const keepE = GUN.energy;
  GUN.aimEnvelopeScale = scale;
  GUN.energy = 0;
  try {
    const G = newRound({ walls: true, seed: SEED, weapon: 'pistol', weapon2: 'longsword' });
    G.ai.update = () => {};
    const f = G.player;
    const info = G.combat.info;
    const lag = Math.round(CONFIG.realS(0.2) / DT);
    const on = [];
    G.before = () => {
      const { o, ax } = muzzleRay(f);
      const hit = G.world.castRay({ origin: { x: o.x, y: o.y, z: o.z }, dir: { x: ax.x, y: ax.y, z: ax.z } }, GUN.range, true, undefined, undefined, undefined, undefined, (c) => info.get(c.handle)?.fighter !== f);
      const vi = hit ? info.get(hit.collider.handle) : null;
      on.push(!!vi && vi.fighter === G.enemy && vi.kind !== 'weapon');
      const want = mode === 'any' ? true : mode === 'laser' ? on[on.length - 1] : !!on[on.length - 1 - lag];
      if (want && f.fightT >= HOLD) f.skill.thrust();
    };
    for (let i = 0; i < Math.round(SHOOT / DT); i++) G.step();
    return { shots: f.gun?.shots ?? 0, hits: f.gun?.hits ?? 0, onBody: on.filter(Boolean).length / Math.max(1, on.length) };
  } finally {
    GUN.aimEnvelopeScale = NOW;
    GUN.energy = keepE;
  }
}

const f3 = (x) => x.toFixed(3);
const pct = (a, b) => `${b > 0 ? (((a - b) / b) * 100 >= 0 ? '+' : '') + (((a - b) / b) * 100).toFixed(1) : '—'} %`;
console.log(`흔들림 범위 — ${SECS} 게임 초 · 씨앗 ${SEED} · TIME.k ${K} · aimEnvelopeScale 전 1.1 → 후 ${NOW.toFixed(2)} (m, 가운데에서)`);
for (const who of ['human', 'ai']) {
  const R = Object.fromEntries(Object.entries(SCALES).map(([k, s]) => [k, range(who, s)]));
  console.log(`\n${who === 'human' ? '사람(서서 겨눔)' : 'AI 마야(걷고 쏨)'} — 표본 ${R.전.T.n} / ${R.후.T.n} 스텝`);
  for (const [kind, name] of [['T', '목표점'], ['P', '레이저 점']]) {
    for (const m of ['max', 'p90', 'p50', 'lat', 'up']) {
      const a = R.전[kind][m];
      const b = R.후[kind][m];
      console.log(`  ${name.padEnd(6)} ${{ max: '최대', p90: 'p90', p50: 'p50', lat: '좌우 |p95|', up: '위아래 |p95|' }[m].padEnd(10)} ${f3(a)} → ${f3(b)} (${pct(b, a)})`);
    }
  }
}
console.log(`\n사람 손 사격 — ${SHOOT} 게임 초 (상대 가만히 · 몸에 맞은 발 / 쏜 발 · 레이저가 몸에 닿은 스텝 몫)`);
for (const mode of ['any', 'laser', 'late']) {
  const a = shoot(mode, SCALES.전);
  const b = shoot(mode, SCALES.후);
  const name = { any: '막 탭', laser: '레이저 탭', late: '늦은 탭 0.2 s' }[mode];
  console.log(`  ${name.padEnd(10)} 전 ${a.hits}/${a.shots} (${((100 * a.hits) / Math.max(1, a.shots)).toFixed(0)} %) · 레이저 몸 ${(100 * a.onBody).toFixed(1)} %  →  후 ${b.hits}/${b.shots} (${((100 * b.hits) / Math.max(1, b.shots)).toFixed(0)} %) · 레이저 몸 ${(100 * b.onBody).toFixed(1)} %`);
}
