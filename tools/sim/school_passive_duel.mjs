// 유파 패시브 넷 측정 (10/21 사장님 결정 — src/school_passive.js · config SCHOOL_PASSIVE): 유파 무기 AI 대 롱소드 AI(둘 다 숙련도 PROF — 4 = 4급 패시브 책),
//  시험 쪽만 패시브 켬(on) · 모두 끔(off). 상대 롱소드(독일 몸)는 두 판 모두 패시브 없음 — 시험 쪽 몫만 견준다. 자리를 바꿔 SEEDS 판씩(weapon_balance 와 같은 시드 1000+s · 2000+s).
//  SCHOOLS=italian,japanese,german,chinese SEEDS=24 SEED0=1 DUR=30 PROF=4 OUT=<json> node tools/sim/school_passive_duel.mjs (SEED0 = 첫 시드 번호 s — 판을 나눠 돌릴 때)
//  재는 것: 승 · 패 · 무 · 죽은 까닭(출혈 몫) · 시험 쪽이 잃은 피 · 주고받은 칼날 상처 심각도 합 · 패시브가 터진 수(school_passive.js stats)
//  10/28 전 · 후 견주기 (판 기본은 그대로 — 환경 변수로만): INDES_TOUCH=0|1 인데스 칼끼리 닿음 창(SCHOOL_PASSIVE.german.touch) · KEN_SECRET=0|1 고노센 켄타이(japanese.secret) ·
//   KEN_FULL=실제 초 켄타이 쌓이는 시간(japanese.full — realS) · PROF_T · PROF_O = 시험 쪽 · 상대 숙련도(없으면 PROF — 고노센은 숙련도 5 · 상대 롱소드 5 면 모르트슐라크도 씀)
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
const SP = CONFIG.SCHOOL_PASSIVE;
const WEAPON = { italian: 'rapier', japanese: 'uchigatana', german: 'longsword', chinese: 'qinggang' };
const SCHOOLS = (process.env.SCHOOLS ?? 'italian,japanese,german,chinese').split(',');
const N = +(process.env.SEEDS ?? 24), S0 = +(process.env.SEED0 ?? 1), DUR = +(process.env.DUR ?? 30), PROF = +(process.env.PROF ?? 4);
const PROF_T = +(process.env.PROF_T ?? PROF), PROF_O = +(process.env.PROF_O ?? PROF);
if (process.env.INDES_TOUCH != null) SP.german.touch = +process.env.INDES_TOUCH ? 1 : 0;
if (process.env.KEN_SECRET != null) SP.japanese.secret = +process.env.KEN_SECRET ? 1 : 0;
if (process.env.KEN_FULL != null) SP.japanese.full = CONFIG.realS(+process.env.KEN_FULL);
const VARIANTS = (process.env.VARIANTS ?? 'off,on').split(',');
const keep = { on: SP.on, ...Object.fromEntries(['iberian', ...Object.keys(WEAPON)].map((k) => [k, SP[k]?.on])) };

function fight(school, seed, side, v) {
  SP.on = v === 'on';
  for (const k of ['iberian', ...Object.keys(WEAPON)]) if (SP[k]) SP[k].on = k === school;
  const w = WEAPON[school];
  const G = newRound({ walls: true, seed, weapon: side === 0 ? w : 'longsword', weapon2: side === 0 ? 'longsword' : w, AI2Class: AI, persona: { proficiency: side === 0 ? PROF_O : PROF_T }, persona2: { proficiency: side === 0 ? PROF_T : PROF_O } }); // persona = 적(enemy) · persona2 = 플레이어 몸 AI (harness_m)
  applyWeaponMeasure(G.ai2, side === 0 ? w : 'longsword');
  applyWeaponMeasure(G.ai, side === 0 ? 'longsword' : w);
  const T = side === 0 ? G.player : G.enemy, O = side === 0 ? G.enemy : G.player;
  O.schoolPassive?.set(null); // 상대(롱소드)는 패시브 없음
  let dealt = 0, taken = 0, boosted = 0, boostSum = 0, secHits = 0, secSev = 0, secK = 0, secKn = 0; // sec* = 시험 쪽 비기 칼의 상처 (10/28 고노센 켄타이)
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (r.type === 'blunt' || !(r.severity > 0)) return;
    if (att === T && vic === O) { dealt += r.severity; if (r.schoolK > 1) (boosted++, (boostSum += r.schoolK - 1)); if (T.stamina?.inSecret) (secHits++, (secSev += r.severity), r.schoolK > 1 && (secK += r.schoolK - 1, secKn++)); }
    if (att === O && vic === T) taken += r.severity;
  };
  let end = null;
  for (let i = 0; i < Math.round(DUR / DT); i++) {
    G.step();
    if (!T.alive || !O.alive) { end = +G.t.toFixed(1); break; }
  }
  const S = T.schoolPassive?.stats;
  const r = {
    school, seed, side, v, end,
    win: !O.alive && T.alive, lose: !T.alive && O.alive, both: !T.alive && !O.alive,
    tCause: T.causeOfDeath, oCause: O.causeOfDeath,
    tBlood: +(1 - T.blood).toFixed(4), oBlood: +(1 - O.blood).toFixed(4),
    dealt: +dealt.toFixed(3), taken: +taken.toFixed(3), boosted, boostSum: +boostSum.toFixed(3), secHits, secSev: +secSev.toFixed(3), secK: +secK.toFixed(4), secKn,
    stats: S ? JSON.parse(JSON.stringify(S)) : null,
  };
  G.world.free();
  return r;
}

const out = [];
for (const school of SCHOOLS) for (let s = S0; s < S0 + N; s++) for (const side of [0, 1]) for (const v of VARIANTS) out.push(fight(school, (side ? 2000 : 1000) + s, side, v));
Object.assign(SP, { on: keep.on });
for (const k of ['iberian', ...Object.keys(WEAPON)]) if (SP[k]) SP[k].on = keep[k];
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));

const avg = (R, f) => R.reduce((s, r) => s + f(r), 0) / Math.max(1, R.length);
for (const school of SCHOOLS) {
  for (const v of VARIANTS) {
    const R = out.filter((r) => r.school === school && r.v === v), n = R.length;
    const st = (f) => avg(R, (r) => (r.stats ? f(r.stats) : 0));
    const line = [`${school.padEnd(8)} ${v.padEnd(3)} n ${n}`, `승 ${R.filter((r) => r.win).length} 패 ${R.filter((r) => r.lose).length} 둘다 ${R.filter((r) => r.both).length} 무 ${R.filter((r) => r.end == null).length}`,
      `시험쪽 죽음 ${R.filter((r) => r.tCause).length}(출혈 ${R.filter((r) => r.tCause === '출혈').length})`, `잃은 피 ${(avg(R, (r) => r.tBlood) * 100).toFixed(1)}%`, `준 상처 ${avg(R, (r) => r.dealt).toFixed(2)} 받은 ${avg(R, (r) => r.taken).toFixed(2)}`];
    if (v === 'on') {
      if (school === 'italian') line.push(`찌르기 ${st((s) => s.tip.thrusts).toFixed(1)}/판 · 고친 ${st((s) => s.tip.corrected).toFixed(1)} · 평균 ${(R.reduce((a, r) => a + (r.stats?.tip.sum ?? 0), 0) / Math.max(1, R.reduce((a, r) => a + (r.stats?.tip.corrected ?? 0), 0))).toFixed(2)}° · 최대 ${Math.max(...R.map((r) => r.stats?.tip.max ?? 0)).toFixed(2)}°`);
      if (school === 'japanese') line.push(`칼 ${st((s) => s.strokes).toFixed(1)}/판 · 실린 칼 ${st((s) => s.ken.charged).toFixed(1)} · 실려 맞음 ${st((s) => s.ken.hits).toFixed(2)} · 평균 몫 +${((R.reduce((a, r) => a + (r.stats?.ken.bonus ?? 0), 0) / Math.max(1, R.reduce((a, r) => a + (r.stats?.ken.hits ?? 0), 0))) * 100).toFixed(1)}% · 제비 베기로 넘어감 ${R.reduce((a, r) => a + (r.stats?.ken.carried ?? 0), 0)} · 잃음 ${st((s) => s.ken.lost).toFixed(2)}`,
        `고노센(비기 칼) 상처 ${R.reduce((a, r) => a + r.secHits, 0)} 개 · 심각도 ${R.reduce((a, r) => a + r.secSev, 0).toFixed(2)} · 켄타이 묶인 고노센 ${R.reduce((a, r) => a + (r.stats?.ken.secret ?? 0), 0)} · 실려 맞음 ${R.reduce((a, r) => a + (r.stats?.ken.secretHits ?? 0), 0)} · 평균 k ${(1 + R.reduce((a, r) => a + (r.stats?.ken.secretBonus ?? 0), 0) / Math.max(1, R.reduce((a, r) => a + (r.stats?.ken.secretHits ?? 0), 0))).toFixed(3)}`);
      if (school === 'german') line.push(`창 ${st((s) => s.indes.opened).toFixed(2)}/판(헛침 ${st((s) => s.indes.whiff).toFixed(2)} · 막힘 ${st((s) => s.indes.blocked).toFixed(2)} · 칼끼리 닿음 ${st((s) => s.indes.touch ?? 0).toFixed(2)} · 간격 잡기로 멈춤 ${st((s) => s.indes.paused).toFixed(2)}) · 창 안 칼 ${st((s) => s.indes.strokes).toFixed(2)} · 실려 맞은 칼 ${st((s) => s.indes.hits).toFixed(2)}`);
      if (school === 'chinese') line.push(`안 휘두른 시간 ${st((s) => s.clotT).toFixed(1)} s/판`);
      line.push(`배율 실린 상처 ${avg(R, (r) => r.boosted).toFixed(2)}/판`);
    }
    console.log(line.join(' · '));
  }
}
