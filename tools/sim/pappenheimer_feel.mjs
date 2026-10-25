// ─────────────────────────────────────────────────────────────
//  pappenheimer_feel.mjs — 파펜하이머 손맛 견줌 (10/25 사장님 '신규 무기를 도입할 때는, 언제나 같은 계열 기존 무기들과 다른 손맛을 주는 걸 목표로 해' ·
//   docs/import/pappenheimer_import_2026-10-25.md §4). 물리 · 판정은 바꾸지 않는다(재기만).
//   hit : 같은 맞음 — 판정(combat.analyze)에 같은 칼 움직임을 두 가지로 넣고 무기만 바꿔 견줌(달타냥 시험 sameHit 과 같은 틀 · 상대 롱소드 · 가슴):
//          베기 = 칼날 70 % 자리가 날 방향으로 CUT m/s · 찌르기 = 칼날 97 % 자리가 칼 축 방향으로 STAB m/s — 판정 갈래 · J(판정 에너지 — 질량 · 관성 몫이 든 값) · 효율 · 심각도
//   ai  : AI 24 판 대 롱소드 — italian_thrust.mjs ai 판과 같은 판(둘 다 숙련도 PROF · 시험 쪽만 이탈리아 패시브 · 자리 둘 × SEEDS · 시드 1000 + s · 2000 + s · DUR 초 ·
//          applyWeaponMeasure) — 승 / 패 / 무 · 준 · 받은 심각도 · 시험 쪽이 낸 맞음을 갈래(베기 · 찌르기)마다: 판정 수 · 하나 J 평균 · 하나 심각도 평균 · 상처 낸 몫
//  사용법: [W=rapier,dartagnan,pappenheimer] [MODES=hit,ai] [CUT=12] [STAB=6] [SEEDS=12] [DUR=30] [PROF=4] node tools/sim/pappenheimer_feel.mjs
// ─────────────────────────────────────────────────────────────
import { newRound, DT, AI, CONFIG, THREE } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';

const WS = (process.env.W ?? 'rapier,dartagnan,pappenheimer').split(',');
const MODES = (process.env.MODES ?? 'hit,ai').split(',');
const CUT = +(process.env.CUT ?? 12), STAB = +(process.env.STAB ?? 6);
const N = +(process.env.SEEDS ?? 12), DUR = +(process.env.DUR ?? 30), PROF = +(process.env.PROF ?? 4);
const SP = CONFIG.SCHOOL_PASSIVE;

/** 같은 맞음 하나: 판을 세우고 5 스텝 뒤 내 칼 자리 · 방향 그대로, 칼 속도만 정해 analyze 에 (판정은 판을 바꾸지 않는 예측 판정) */
function sameHit(weapon, kind) {
  const G = newRound({ seed: 1, weapon, weapon2: 'longsword', walls: false });
  for (let i = 0; i < 5; i++) G.step();
  const att = G.player, vic = G.enemy;
  let wI, vI;
  for (const [, i] of G.combat.info) {
    if (i.fighter === att && i.kind === 'weapon' && i.part === 'blade') wI = i;
    if (i.fighter === vic && i.part === 'chest') vI = i;
  }
  const S0 = att.cache.sword, P = vic.cache.parts.chest, cfg = att.weaponCfg;
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(S0.q);
  const edge = new THREE.Vector3(1, 0, 0).applyQuaternion(S0.q);
  const t = kind === 'cut' ? 0.7 : 0.97;
  const point = S0.p.clone().addScaledVector(axis, cfg.hiltLength + t * cfg.bladeLength);
  const v = kind === 'cut' ? edge.multiplyScalar(CUT) : axis.multiplyScalar(STAB);
  const S = { p: S0.p.clone(), q: S0.q.clone(), com: S0.com.clone(), v, w: new THREE.Vector3() };
  const Pz = { p: P.p.clone(), q: P.q.clone(), com: P.com.clone(), v: new THREE.Vector3(), w: new THREE.Vector3() };
  const r = G.combat.analyze({ w: wI, v: vI }, point, S, Pz, true);
  G.world.free();
  return r;
}

if (MODES.includes('hit')) {
  console.log(`같은 맞음 (상대 롱소드 가슴 · 베기 칼날 70 % 날 방향 ${CUT} m/s · 찌르기 칼날 97 % 칼 축 ${STAB} m/s)`);
  console.log('| 무기 | 베기 갈래 · J · 효율 · 심각도 | 찌르기 갈래 · J · 효율 · 심각도 |\n|---|---|---|');
  for (const w of WS) {
    const c = sameHit(w, 'cut'), s = sameHit(w, 'stab');
    const f = (r) => (r ? `${r.type} · ${r.energy.toFixed(1)} · ${(r.eff ?? 0).toFixed(1)} · ${r.severity.toFixed(3)}` : '-');
    console.log(`| ${w} | ${f(c)} | ${f(s)} |`);
  }
}

/** AI 한 판 (italian_thrust.mjs fight 와 같은 판 세움) — 시험 쪽 T 가 낸 맞음을 갈래마다 셈 */
function fight(W, seed, side) {
  SP.on = true;
  for (const k of Object.keys(SP)) if (SP[k] && typeof SP[k] === 'object' && 'on' in SP[k]) SP[k].on = k === 'italian';
  const foeW = 'longsword';
  const G = newRound({ walls: true, seed, weapon: side === 0 ? W : foeW, weapon2: side === 0 ? foeW : W, AI2Class: AI, persona: { proficiency: PROF }, persona2: { proficiency: PROF } });
  applyWeaponMeasure(G.ai2, side === 0 ? W : foeW);
  applyWeaponMeasure(G.ai, side === 0 ? foeW : W);
  const T = side === 0 ? G.player : G.enemy, O = side === 0 ? G.enemy : G.player;
  O.schoolPassive?.set(null);
  const hits = { cut: [], stab: [], blunt: [] };
  let dealt = 0, taken = 0;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === T && vic === O) {
      hits[r.type]?.push([r.energy, r.severity]);
      if (r.type !== 'blunt' && r.severity > 0) dealt += r.severity;
    }
    if (att === O && vic === T && r.type !== 'blunt' && r.severity > 0) taken += r.severity;
  };
  let end = null;
  for (let i = 0; i < Math.round(DUR / DT); i++) {
    G.step();
    if (!T.alive || !O.alive) { end = G.t; break; }
  }
  const res = { win: !O.alive && T.alive, lose: !T.alive && O.alive, both: !T.alive && !O.alive, draw: end == null, dealt, taken, hits };
  G.world.free();
  return res;
}

if (MODES.includes('ai')) {
  console.log(`\nAI ${2 * N} 판 대 롱소드 (숙련도 ${PROF} · ${DUR} s · 이탈리아 패시브 시험 쪽만)`);
  console.log('| 무기 | 승 · 패 · 둘 다 · 무 | 준 · 받은 심각도 / 판 | 베기 판정 / 판 · 하나 J · 하나 심각도 · 상처 몫 | 찌르기 판정 / 판 · 하나 J · 하나 심각도 · 상처 몫 |\n|---|---|---|---|---|');
  for (const W of WS) {
    const R = [];
    for (let s = 1; s <= N; s++) for (const side of [0, 1]) R.push(fight(W, (side ? 2000 : 1000) + s, side));
    const n = R.length, cnt = (k) => R.filter((r) => r[k]).length;
    const kind = (k) => {
      const H = R.flatMap((r) => r.hits[k]);
      if (!H.length) return '0 · - · - · -';
      return `${(H.length / n).toFixed(2)} · ${(H.reduce((a, h) => a + h[0], 0) / H.length).toFixed(1)} · ${(H.reduce((a, h) => a + h[1], 0) / H.length).toFixed(3)} · ${Math.round((100 * H.filter((h) => h[1] > 0).length) / H.length)} %`;
    };
    console.log(`| ${W} | ${cnt('win')} · ${cnt('lose')} · ${cnt('both')} · ${cnt('draw')} | ${(R.reduce((a, r) => a + r.dealt, 0) / n).toFixed(2)} · ${(R.reduce((a, r) => a + r.taken, 0) / n).toFixed(2)} | ${kind('cut')} | ${kind('stab')} |`);
  }
}
