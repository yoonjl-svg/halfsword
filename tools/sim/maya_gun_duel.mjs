// 마야(id samira · 권총 AI) 대 칼 인물 AI — 사장님 리볼버 결정 전 · 후 (docs/decisions.md 10/29 22:3x · 10/30 00:1x · 01:4x · 확인표 2980 ~ 2989 · 3010 ~)
//  v0 = 10/29 전(GUN.aiCooldownK 1.8 · aiFirstGap 0 · 발 묶음 없음) · v1029 = 10/29 판(2.0 · 첫 발 = 공격 가능 + 간격 · 쏜 뒤 꺾음 꼬리 0.23 게임 초 묶음 · 흔들림 1.1)
//  before = 10/30 00:1x 판(쏘기 전 · 뒤 0.2 s 멈춤 · 흔들림 범위 1.21 · AI 조준 보정 있음) · after = 지금 값(10/30 01:4x: AI 조준 보정 없음 — aiAimAssist 0)
//  stop = 00:1x 판에서 흔들림만 1.1 · sway = 10/29 판에서 흔들림만 1.21 · aim = 00:1x 판 + 다 선 뒤 겨눔이 다시 걸릴 때까지 섬(aiPlantAim 1 — 시험) · aim0 = 지금 + aiPlantAim 1 ·
//  assist = 지금 + 조준 보정 있음(핸디캡만 바뀐 판 — 마야 아닌 총잡이의 가름)
//  핸디캡 GUN.aiHandicapK(10/30 01:4x — AI 권총 모두 1.5): 01:4x 전 판(v0 · v1029 · before …)은 마야만 1.5 · 다른 AI 1 로 되돌려 돈다.
//  쏘는 쪽: SHOOTER=samira(기본 · 마야) | plain(인물 없는 기본 AI — 난이도 normal · 기본 겉모습) | <인물 id>(그 인물 시트에 권총만 쥐어 줌)
//  두 쪽 다 AI(게임 상대 시트의 ai.level · persona · look 그대로) · 마야는 상대 자리(index 1 — 게임의 상대) · 벽 있음 · 상대가 죽으면 끝 · 아니면 cap 초에서 비김.
//  재는 것: 판마다 쏜 발 · 몸에 맞은 발(gun.hits — 투구 · 판금이 막은 것 포함) · 첫 발 시각(공격이 가능해진 때 = ARENA.startHold 부터, 실제 초) · 승패 ·
//   한 발마다 발 묶인 시간(fighter.fireHold 가 이어진 토막: 쏘기 전 · 쏜 뒤 — 판이 묶인 채 끝난 토막은 뺌) · 쏘지 않고 풀린 멈춤(겨눔이 빠짐) 수 · 쏜 뒤 0.6 s 안 골반 수평 빠르기 < 0.3 m/s 인 시간 ·
//   쏜 순간 골반 빠르기 · 쏜 뒤 0.3 s 안 가장 느린 골반 빠르기 · 쏜 순간 총신이 몸에서 빠진(aiAimTol 밖) 발 · 총신 벗어남 각 · 총알이 닿은 곳(gun.what) · 맞은 부위(상처 zone).
//  결정적: harness_m newRound 의 seed. 시간은 실제 초(게임 초 ÷ TIME.k — 시뮬 템포 1.1)로 찍는다.
//   node tools/sim/maya_gun_duel.mjs [씨앗 수=6] [cap 게임 초=60] [v0|v1029|before|after|stop|sway|aim|aim0|nostill|both(= before,after)|all] [상대 id,…]
import { newRound, DT, AI, CONFIG, THREE } from './harness_m.mjs';
import { GUN } from '../../src/gun.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const [nSeeds = '6', capArg = '60', which = 'both', foesArg = 'margarethe,tome,minami'] = process.argv.slice(2);
const SEEDS = Array.from({ length: +nSeeds }, (_, i) => i + 1);
const CAP = +capArg;
const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const HOLD = CONFIG.ARENA.startHold; // 게임 초
const SHOOTER = process.env.SHOOTER || 'samira';
const MAYA = SHOOTER === 'plain' ? { id: 'plain', name: '기본 AI', look: undefined, ai: { level: 'normal', persona: null } } : CHARACTERS_BY_ID[SHOOTER]; // 쏘는 쪽 (이름은 마야 그대로 — 기본은 마야)
const FOES = foesArg.split(',').map((id) => CHARACTERS_BY_ID[id]);
const KEYS = ['aiCooldownK', 'aiFirstGap', 'aiFireStill', 'aiPlant', 'aiPlantAim', 'aiAfter', 'aimEnvelopeScale', 'aiAimAssist', 'aiHandicapK'];
const OLD_K = MAYA.id === 'samira' ? 1.5 : 1; // 10/30 01:4x 전 핸디캡 — 마야 시트에만 1.5
const NOW = Object.fromEntries(KEYS.map((k) => [k, GUN[k]]));
const KICK = GUN.kickTime + GUN.kickFade; // 10/29 판 쏜 뒤 묶음
const V1029 = { aiCooldownK: 2.0, aiFirstGap: 1, aiFireStill: 1, aiPlant: 0, aiPlantAim: 0, aiAfter: KICK, aimEnvelopeScale: 1.1, aiAimAssist: 1, aiHandicapK: OLD_K };
const V1030 = { ...V1029, aiPlant: CONFIG.realS(0.2), aiAfter: CONFIG.realS(0.2), aimEnvelopeScale: 1.1 * 1.1 }; // 10/30 00:1x 판 (조준 보정 있음)
const COND = { v0: { ...V1029, aiCooldownK: 1.8, aiFirstGap: 0, aiFireStill: 0 }, v1029: V1029, before: V1030, after: NOW, stop: { ...V1030, aimEnvelopeScale: 1.1 }, sway: { ...V1029, aimEnvelopeScale: V1030.aimEnvelopeScale }, aim: { ...V1030, aiPlantAim: 1 }, aim0: { ...NOW, aiPlantAim: 1 }, assist: { ...NOW, aiAimAssist: 1 }, nostill: { ...V1029, aiFireStill: 0 } }; // nostill = 10/29 판에서 발 묶음만 뺌 (10/29 기록의 가름)
const NAME = { v0: '10/29 전', v1029: '10/29 판', before: '전(10/30 00:1x 판 · 보정 있음)', after: '후(10/30 01:4x · 보정 없음)', stop: '00:1x 판 − 흔들림(멈춤만)', sway: '10/29 판 + 흔들림만', aim: '00:1x 판 + 다 선 뒤 겨눔 기다림', aim0: '후 + 다 선 뒤 겨눔 기다림(aiPlantAim 1)', assist: '후 + 조준 보정(핸디캡만 바뀜)', nostill: '10/29 판 − 발 묶음' };
const real = (t) => t / K;
/** 총신이 상대 골반 · 배 · 가슴 · (붙은) 머리 몸체 중심에서 벗어난 가장 작은 각(도) — gun.js aimErr 와 같은 셈 (쏜 스텝 뒤 읽으면 쏜 때의 총신) */
function aimErrOf(f) {
  const r = f.sword.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const p = f.sword.translation();
  const o = new THREE.Vector3(f.weapon.muzzleX ?? 0, f.weaponCfg.hiltLength + f.weaponCfg.bladeLength, 0).applyQuaternion(q).add(new THREE.Vector3(p.x, p.y, p.z));
  let best = 180;
  for (const k of ['head', 'pelvis', 'abdomen', 'chest']) {
    if (!f.foe.bodies[k] || (k === 'head' && f.foe.decapitated)) continue;
    const c = f.foe.bodies[k].translation();
    best = Math.min(best, (ax.angleTo(new THREE.Vector3(c.x - o.x, c.y - o.y, c.z - o.z)) * 180) / Math.PI);
  }
  return best;
}

function fight(foe, seed, cond) {
  Object.assign(GUN, cond);
  try {
    const G = newRound({ walls: true, seed, weapon: foe.weapon, look: foe.look, AI2Class: AI, difficulty2: foe.ai.level, persona2: foe.ai.persona, weapon2: 'pistol', ...(MAYA.look ? { look2: MAYA.look } : {}), difficulty: MAYA.ai.level, persona: MAYA.ai.persona });
    const M = G.enemy;
    const S = G.player;
    let seen = 0;
    let first = null;
    const shots = []; // { t, v, vMin } — 쏜 시각(게임 초) · 그 순간 골반 수평 빠르기 · 쏜 뒤 0.3 s 안 가장 느린 골반 빠르기
    let run = null; // 이어진 발 묶음 토막 { start, shot } (스텝 번호)
    const pre = [];
    const post = [];
    const aborted = []; // 쏘지 않고 풀린 멈춤 길이
    let slow = 0; // 쏜 뒤 0.6 s 안 골반 < 0.3 m/s 스텝
    let end = null;
    for (let i = 0; i < Math.round(CAP / DT); i++) {
      G.step();
      const pv = M.bodies.pelvis.linvel();
      const v = Math.hypot(pv.x, pv.z);
      const n = M.gun?.shots ?? 0;
      if (M.fireHold && !run) run = { start: i, shot: null };
      if (n > seen) {
        seen = n;
        const err = aimErrOf(M);
        shots.push({ t: G.t, v, vMin: v, err, off: err >= GUN.aiAimTol });
        if (first == null) first = G.t;
        if (run) run.shot = i;
      }
      if (!M.fireHold && run) {
        if (run.shot != null) {
          pre.push(real((run.shot - run.start) * DT));
          post.push(real((i - run.shot) * DT));
        } else aborted.push(real((i - run.start) * DT));
        run = null;
      }
      const last = shots[shots.length - 1];
      if (last && G.t - last.t <= 0.3) last.vMin = Math.min(last.vMin, v);
      if (last && G.t - last.t <= 0.6 && v < 0.3) slow++;
      if (!M.alive || !S.alive) {
        end = !M.alive && !S.alive ? 'both' : !S.alive ? 'maya' : 'foe';
        break;
      }
    }
    const full = shots.filter((x) => G.t - x.t >= 0.3); // 판이 그 발 뒤 0.3 s 안에 끝나지 않은 발
    const zones = {};
    for (const w of G.wounds) if (w.att === M) zones[w.zone] = (zones[w.zone] ?? 0) + 1;
    return { what: { ...(M.gun?.what ?? {}) }, zones, shots: seen, hits: M.gun?.hits ?? 0, first: first == null ? null : real(first - HOLD), win: end ?? 'draw', t: real(G.t), pre, post, aborted, vMins: full.map((x) => x.vMin), slow: real(slow * DT), vShots: shots.map((x) => x.v), offs: shots.filter((x) => x.off).length, errs: shots.map((x) => x.err), gaps: shots.slice(1).map((x, j) => real(x.t - shots[j].t)) };
  } finally {
    Object.assign(GUN, NOW);
  }
}

const q90 = (xs) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(0.9 * xs.length)] : NaN);
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
  const pre = R.flatMap((r) => r.pre);
  const post = R.flatMap((r) => r.post);
  const ab = R.flatMap((r) => r.aborted);
  const vMins = R.flatMap((r) => r.vMins);
  const slow = R.reduce((s, r) => s + r.slow, 0);
  const vs = R.flatMap((r) => r.vShots);
  const offs = R.reduce((s, r) => s + r.offs, 0);
  const sum = (k) => R.reduce((o, r) => (Object.entries(r[k]).forEach(([z, n]) => (o[z] = (o[z] ?? 0) + n)), o), {});
  const what = sum('what');
  const zones = sum('zones');
  const show = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z} ${n}`).join(' · ');
  const errs = R.flatMap((r) => r.errs).sort((a, b) => a - b);
  const qe = (p) => (errs.length ? errs[Math.min(errs.length - 1, Math.floor(p * errs.length))] : NaN);
  return (
    `${name.padEnd(22)} 판 ${R.length} · 마야 승 ${wins} 패 ${loss} 둘 다 ${both} 비김 ${draws} (승률 ${((100 * wins) / R.length).toFixed(0)} %) · 판당 쏜 발 ${f2(shots / R.length)} · 맞힘 ${hits}/${shots} (${shots ? ((100 * hits) / shots).toFixed(0) : 0} %) · 쏜 순간 겨눔이 몸에서 빠진 발(≥ ${GUN.aiAimTol}°) ${offs} (총신 벗어남 p50 ${f2(qe(0.5))}° · p90 ${f2(qe(0.9))}°) · 쏘기 전 멈춤 p90 ${f2(q90(pre))} · 최대 ${f2(Math.max(...pre))} s · 총알 닿은 곳 ${show(what)} · 맞은 부위 ${show(zones)} · ` +
    `첫 발 ${f2(mean(firsts))} s (최소 ${f2(Math.min(...firsts))}) · 가장 짧은 발 사이 ${f2(Math.min(...gaps))} s · 한 발 발 묶임 쏘기 전 ${f2(mean(pre))} · 쏜 뒤 ${f2(mean(post))} s(${post.length}발) · 쏘지 않고 풀린 멈춤 ${ab.length}번(한 번 ${f2(mean(ab))} s) · 쏜 뒤 0.6 s 안 거의 섬(< 0.3 m/s) ${f2(shots ? slow / shots : NaN)} s · 골반 쏜 순간 ${f2(mean(vs))} → 0.3 s 안 가장 느림 ${f2(mean(vMins))} m/s · 판 길이 ${f2(mean(R.map((r) => r.t)))} s`
  );
}

console.log(`TIME.k ${K} · ARENA.startHold ${HOLD} 게임 초 · GUN.cooldown ${real(GUN.cooldown).toFixed(2)} 실제 s · 쏘는 쪽 ${MAYA.name}(${SHOOTER}) · AI 권총 핸디캡 지금 ${GUN.aiHandicapK} · 씨앗 ${SEEDS.join(',')} · cap ${CAP} 게임 초`);
for (const c of which === 'both' ? ['before', 'after'] : which === 'all' ? Object.keys(COND) : [which]) {
  const cond = COND[c];
  console.log(`\n${NAME[c]} — aiCooldownK ${cond.aiCooldownK} · aiFirstGap ${cond.aiFirstGap} · aiFireStill ${cond.aiFireStill} · aiPlant ${real(cond.aiPlant).toFixed(2)} · aiPlantAim ${cond.aiPlantAim} · aiAfter ${real(cond.aiAfter).toFixed(2)} s · aimEnvelopeScale ${cond.aimEnvelopeScale.toFixed(2)} · aiAimAssist ${cond.aiAimAssist} · aiHandicapK ${cond.aiHandicapK} → AI 발 사이 ${(real(GUN.cooldown) * cond.aiHandicapK * cond.aiCooldownK).toFixed(2)} s`);
  const all = [];
  for (const foe of FOES) {
    const R = SEEDS.map((s) => fight(foe, s, cond));
    all.push(...R);
    console.log('  ' + line(`${foe.name}(${foe.weapon})`, R));
  }
  console.log('  ' + line('모두', all));
}
