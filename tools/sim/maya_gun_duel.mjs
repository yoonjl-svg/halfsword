// 마야(id samira · 권총 AI) 대 칼 인물 AI — 사장님 10/29 22:3x 리볼버 결정 전 · 후 (docs/decisions.md 10/29 22:3x · 확인표 2980 ~ 2984)
//  전 = GUN.aiCooldownK 1.8 · aiFirstGap 0(gunAI 를 처음 부른 때부터 aiFirst) · aiFireStill 0  /  후 = 지금 값(2.0 · 공격이 가능해진 때 + 발 사이 간격 · 쏘는 동안 발 묶음)
//  두 쪽 다 AI(게임 상대 시트의 ai.level · persona · look 그대로) · 마야는 상대 자리(index 1 — 게임의 상대) · 벽 있음 · 상대가 죽으면 끝 · 아니면 cap 초에서 비김.
//  재는 것: 판마다 쏜 발 · 몸에 맞은 발(gun.hits — 투구 · 판금이 막은 것 포함) · 첫 발 시각(공격이 가능해진 때 = ARENA.startHold 부터, 실제 초) · 승패 ·
//   한 발마다 발 묶인 시간(fighter.fireHold 스텝 — 판이 그 발 뒤 0.3 s 안에 끝난 발은 뺌) · 쏜 뒤 0.6 s 안 골반 수평 빠르기 < 0.3 m/s 인 시간 ·
//   쏜 순간 골반 빠르기 · 쏜 뒤 0.3 s 안 가장 느린 골반 빠르기.
//  결정적: harness_m newRound 의 seed. 시간은 실제 초(게임 초 ÷ TIME.k — 시뮬 템포 1.1)로 찍는다.
//   node tools/sim/maya_gun_duel.mjs [씨앗 수=6] [cap 게임 초=60] [before|after|nostill|both] [상대 id,…]
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { GUN } from '../../src/gun.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const [nSeeds = '6', capArg = '60', which = 'both', foesArg = 'margarethe,tome,minami'] = process.argv.slice(2);
const SEEDS = Array.from({ length: +nSeeds }, (_, i) => i + 1);
const CAP = +capArg;
const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const HOLD = CONFIG.ARENA.startHold; // 게임 초
const MAYA = CHARACTERS_BY_ID.samira;
const FOES = foesArg.split(',').map((id) => CHARACTERS_BY_ID[id]);
const NOW = { aiCooldownK: GUN.aiCooldownK, aiFirstGap: GUN.aiFirstGap, aiFireStill: GUN.aiFireStill };
const COND = { before: { aiCooldownK: 1.8, aiFirstGap: 0, aiFireStill: 0 }, after: NOW, nostill: { ...NOW, aiFireStill: 0 } }; // nostill = 후에서 발 묶음만 뺌 (어느 쪽 몫인지 가름)
const real = (t) => t / K;

function fight(foe, seed, cond) {
  Object.assign(GUN, cond);
  try {
    const G = newRound({ walls: true, seed, weapon: foe.weapon, look: foe.look, AI2Class: AI, difficulty2: foe.ai.level, persona2: foe.ai.persona, weapon2: 'pistol', look2: MAYA.look, difficulty: MAYA.ai.level, persona: MAYA.ai.persona });
    const M = G.enemy;
    const S = G.player;
    let seen = 0;
    let first = null;
    const shots = []; // { t, v, hold, vMin } — 쏜 시각(게임 초) · 그 순간 골반 수평 빠르기 · 그 발 뒤 발 묶인 스텝 · 쏜 뒤 0.3 s 안 가장 느린 골반 빠르기
    let slow = 0; // 쏜 뒤 0.6 s 안 골반 < 0.3 m/s 스텝
    let end = null;
    for (let i = 0; i < Math.round(CAP / DT); i++) {
      G.step();
      const pv = M.bodies.pelvis.linvel();
      const v = Math.hypot(pv.x, pv.z);
      const n = M.gun?.shots ?? 0;
      if (n > seen) {
        seen = n;
        shots.push({ t: G.t, v, hold: 0, vMin: v });
        if (first == null) first = G.t;
      }
      const last = shots[shots.length - 1];
      if (last && M.fireHold) last.hold++;
      if (last && G.t - last.t <= 0.3) last.vMin = Math.min(last.vMin, v);
      if (last && G.t - last.t <= 0.6 && v < 0.3) slow++;
      if (!M.alive || !S.alive) {
        end = !M.alive && !S.alive ? 'both' : !S.alive ? 'maya' : 'foe';
        break;
      }
    }
    const full = shots.filter((x) => G.t - x.t >= 0.3); // 판이 그 발 뒤 0.3 s 안에 끝나지 않은 발
    return { shots: seen, hits: M.gun?.hits ?? 0, first: first == null ? null : real(first - HOLD), win: end ?? 'draw', t: real(G.t), holds: full.map((x) => real(x.hold * DT)), vMins: full.map((x) => x.vMin), slow: real(slow * DT), vShots: shots.map((x) => x.v), gaps: shots.slice(1).map((x, j) => real(x.t - shots[j].t)) };
  } finally {
    Object.assign(GUN, NOW);
  }
}

const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '—');
function line(name, R) {
  const shots = R.reduce((s, r) => s + r.shots, 0);
  const hits = R.reduce((s, r) => s + r.hits, 0);
  const firsts = R.map((r) => r.first).filter((x) => x != null);
  const wins = R.filter((r) => r.win === 'maya').length;
  const loss = R.filter((r) => r.win === 'foe').length;
  const both = R.filter((r) => r.win === 'both').length;
  const draws = R.filter((r) => r.win === 'draw').length;
  const gaps = R.flatMap((r) => r.gaps);
  const holds = R.flatMap((r) => r.holds);
  const vMins = R.flatMap((r) => r.vMins);
  const slow = R.reduce((s, r) => s + r.slow, 0);
  const vs = R.flatMap((r) => r.vShots);
  return (
    `${name.padEnd(22)} 판 ${R.length} · 마야 승 ${wins} 패 ${loss} 둘 다 ${both} 비김 ${draws} (승률 ${((100 * wins) / R.length).toFixed(0)} %) · 판당 쏜 발 ${f2(shots / R.length)} · 맞힘 ${hits}/${shots} (${shots ? ((100 * hits) / shots).toFixed(0) : 0} %) · ` +
    `첫 발 ${f2(mean(firsts))} s (최소 ${f2(Math.min(...firsts))}) · 가장 짧은 발 사이 ${f2(Math.min(...gaps))} s · 한 발 발 묶임 ${f2(mean(holds))} s(${holds.length}발) · 쏜 뒤 0.6 s 안 거의 섬(< 0.3 m/s) ${f2(shots ? slow / shots : NaN)} s · 골반 쏜 순간 ${f2(mean(vs))} → 0.3 s 안 가장 느림 ${f2(mean(vMins))} m/s · 판 길이 ${f2(mean(R.map((r) => r.t)))} s`
  );
}

console.log(`TIME.k ${K} · ARENA.startHold ${HOLD} 게임 초 · GUN.cooldown ${real(GUN.cooldown).toFixed(2)} 실제 s · 마야 gunCooldownK ${MAYA.ai.persona.gunCooldownK} · 씨앗 ${SEEDS.join(',')} · cap ${CAP} 게임 초`);
for (const c of which === 'both' ? ['before', 'after'] : [which]) {
  const cond = COND[c];
  console.log(`\n${{ before: '전', after: '후', nostill: '후 − 발 묶음' }[c]} — aiCooldownK ${cond.aiCooldownK} · aiFirstGap ${cond.aiFirstGap} · aiFireStill ${cond.aiFireStill} → 마야 AI 발 사이 ${(real(GUN.cooldown) * MAYA.ai.persona.gunCooldownK * cond.aiCooldownK).toFixed(2)} s`);
  const all = [];
  for (const foe of FOES) {
    const R = SEEDS.map((s) => fight(foe, s, cond));
    all.push(...R);
    console.log('  ' + line(`${foe.name}(${foe.weapon})`, R));
  }
  console.log('  ' + line('모두', all));
}
