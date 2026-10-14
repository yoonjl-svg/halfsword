// 손님 인물 기질 비교 (docs/import/chanda_terra_port_2026-10-14.md §1-4 — 사장님 결정 10/14 '라트나와 겹치는 기질 값은 찬다 쪽을 손본다'). 헤드리스 · 결정적.
//  ① 더미(가만히 선 플레이어 자리) 앞 60 s × 시드 N: 분당 공격 · 분당 속임 · 첫 공격(s) · 자세 전환/초 · 전환 거리 · 평균 간격(m) · 도는 빠르기(°/s — 더미를 중심으로 돈 각) · 물러난 거리(m/분)
//  ② 기본 AI(롱소드 · normal, 무작위 성격) 대 45 s × 시드 M: 이김/짐/비김(피 많은 쪽) · 분당 맞받기·막기·비켜서기·잇기 · 평균 간격 · 도는 빠르기
//     + 쓴 기술 이름 모음 (동방 고유 동작이 숙련도 2 의 체보요격·좌익격 안인지 · 비기 0)
//  비교 대상: 라트나(우리 시트 — 이베리아 · 북부 대공의 검) · 찬다 샛별 값(같은 막야 · 동방, 샛별 level·pers 그대로 — 자세·기술 취향 포함) · 찬다(우리 시트) · 병마용(우리 시트)
// 실행: node tools/sim/guest_temper.mjs [더미 시드=5] [대결 시드=12]
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { padDist } from '../../src/ai_techniques.js';
import { CHARACTERS_BY_ID, aiAtProficiency } from '../../src/characters.js';

const SEEDS = +(process.argv[2] ?? 5);
const DUELS = +(process.argv[3] ?? 12);
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const f2 = (x) => (x == null || Number.isNaN(x) ? '—' : (Math.round(x * 100) / 100).toFixed(2));
const CH = CHARACTERS_BY_ID.chanda;
// 샛별 찬다 값 (origin/main 7684c732 characters_expansion.js — 막야 판): 우리 숙련도 2 위에 그대로 얹은 것 (비교용, 게임에는 없다)
const CHANDA_SB = {
  ...CH,
  id: 'chanda_saetbyeol',
  ai: aiAtProficiency({ ...CH, ai: { ...CH.ai, persona: {
    school: 'moye',
    level: { skill: 0.78, discipline: 0.84, strength: 1, aggression: 0.78 },
    pers: { precision: 0.8, guardStick: 2.8, fearful: 0.2, angry: 0.1, dogged: 0.35, rhythm: 2.8, aggr: 0.8, vor: 0.4, guardPref: { wechselR: 1.4, langort: 1.2 }, techPref: { zornhau: 1.4, oberhau: 1.1 } },
    idle: { guard: 'wechselR', gesture: 'still' },
  } } }, 2),
};
const LIST = [CHARACTERS_BY_ID.ratna, CHANDA_SB, CH, CHARACTERS_BY_ID.terracotta];
const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const bearing = (from, to) => Math.atan2(to.z - from.z, to.x - from.x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const GUARDS_READY = [0.12, -0.18];

function runDummy(ch, seed, durS = 60) {
  const G = newRound({ seed, difficulty: ch.ai.level, persona: ch.ai.persona, weapon2: ch.weapon });
  const { player: dummy, enemy: me, ai } = G;
  G.before = () => { dummy.move.set(0, 0); dummy.handOffset.set(GUARDS_READY[0], GUARDS_READY[1]); };
  let prevGuard = ai.guard, switches = 0, firstAtk = null, dSum = 0, dN = 0, turn = 0, back = 0;
  const switchAt = [];
  let prevB = null, prevD = null;
  for (let i = 0; i < Math.round(durS / DT); i++) {
    G.step();
    if (!dummy.alive || !me.alive) break;
    if (ai.guard !== prevGuard) { switches++; switchAt.push(padDist(ai.guard.pad, prevGuard.pad)); prevGuard = ai.guard; }
    if (firstAtk == null && ai.stats.attacks > 0) firstAtk = G.t;
    if (me.state === 'stand') {
      const pd = dummy.bodies.pelvis.translation(), pm = me.bodies.pelvis.translation();
      const d = flat(pd, pm), b = bearing(pd, pm);
      dSum += d; dN++;
      if (prevB != null) turn += Math.abs(wrap(b - prevB));
      if (prevD != null && d > prevD) back += d - prevD;
      prevB = b; prevD = d;
    } else { prevB = null; prevD = null; }
  }
  const dur = G.t;
  return { apm: (ai.stats.attacks / dur) * 60, fpm: (ai.stats.feints / dur) * 60, first: firstAtk, sps: switches / dur, swd: mean(switchAt), dist: dN ? dSum / dN : null, turn: (turn * 180) / Math.PI / dur, back: (back / dur) * 60 };
}

const UNIQUE_CN = { chebuYaoji: 1, zuoyi: 2, lianchi: 3, yaoji: 4 };
function runDuel(ch, seed, durS = 45) {
  const G = newRound({ seed, difficulty: ch.ai.level, persona: ch.ai.persona, weapon2: ch.weapon, AI2Class: AI, difficulty2: 'normal', persona2: null, weapon: 'longsword', onFighter: (f) => { if (f.index === 1 && ch.physiology) f.physiology = Object.freeze({ body: 'human', bleeds: true, deathRequiresHeadDetachment: false, ...ch.physiology }); } });
  const { player: B, enemy: A, ai } = G;
  const tech = {};
  let last = null, secret = 0, lastSecret = false, dSum = 0, dN = 0, turn = 0, prevB = null;
  for (let i = 0; i < Math.round(durS / DT); i++) {
    G.step();
    const name = ai.feint?.name ?? ai.tech?.name ?? null;
    const key = ai.mode === 'attack' || ai.feint ? name : null;
    if (key && key !== last) tech[key] = (tech[key] || 0) + 1;
    last = key;
    const sec = !!ai.secretRun || ai.mode === 'secret';
    if (sec && !lastSecret) secret++;
    lastSecret = sec;
    if (A.state === 'stand' && B.state === 'stand') {
      const pb = B.bodies.pelvis.translation(), pa = A.bodies.pelvis.translation();
      dSum += flat(pb, pa); dN++;
      const b = bearing(pb, pa);
      if (prevB != null) turn += Math.abs(wrap(b - prevB));
      prevB = b;
    } else prevB = null;
    if (!A.alive || !B.alive) break;
  }
  const dur = G.t, S = ai.stats;
  const r = !A.alive && !B.alive ? 'draw' : !A.alive ? 'L' : !B.alive ? 'W' : A.blood === B.blood ? 'draw' : A.blood > B.blood ? 'W' : 'L';
  return { r, ko: !A.alive || !B.alive, cpm: (S.counters / dur) * 60, ppm: (S.parries / dur) * 60, vpm: (S.voids / dur) * 60, upm: (S.followUps / dur) * 60, apm: (S.attacks / dur) * 60, dist: dN ? dSum / dN : null, turn: (turn * 180) / Math.PI / Math.max(1e-6, dN * DT), tech, secret, prof: ai.proficiency, pack: (ai.school?.tech || []).map((t) => t.name).filter((n) => n in UNIQUE_CN), feints: (ai.school?.feints || []).map((f) => f.name) };
}

console.log(`=== ① 더미 앞 60 s × 시드 1~${SEEDS} 평균 ===`);
console.log('인물, 분당 공격, 분당 속임, 첫 공격 s, 자세 전환/초, 전환 거리, 평균 간격 m, 도는 빠르기 °/s, 물러남 m/분');
for (const ch of LIST) {
  const runs = [];
  for (let s = 1; s <= SEEDS; s++) runs.push(runDummy(ch, s));
  const m = (k) => mean(runs.map((x) => x[k]).filter((x) => x != null));
  console.log(`${ch.id}, ${f2(m('apm'))}, ${f2(m('fpm'))}, ${f2(m('first'))}, ${f2(m('sps'))}, ${f2(m('swd'))}, ${f2(m('dist'))}, ${f2(m('turn'))}, ${f2(m('back'))}`);
}
console.log(`\n=== ② 기본 AI(롱소드 · normal) 대 45 s × 시드 1~${DUELS} ===`);
console.log('인물, 이김-짐-비김(끝장 판), 분당 공격, 분당 맞받기, 분당 막기, 분당 비켜서기, 분당 잇기, 평균 간격 m, 도는 빠르기 °/s');
const techAll = {};
for (const ch of LIST) {
  const runs = [];
  for (let s = 1; s <= DUELS; s++) runs.push(runDuel(ch, s));
  const w = runs.filter((x) => x.r === 'W').length, l = runs.filter((x) => x.r === 'L').length, d = runs.length - w - l, ko = runs.filter((x) => x.ko).length;
  const m = (k) => mean(runs.map((x) => x[k]).filter((x) => x != null));
  console.log(`${ch.id}, ${w}-${l}-${d} (${ko}), ${f2(m('apm'))}, ${f2(m('cpm'))}, ${f2(m('ppm'))}, ${f2(m('vpm'))}, ${f2(m('upm'))}, ${f2(m('dist'))}, ${f2(m('turn'))}`);
  const tech = {};
  for (const r of runs) for (const [k, v] of Object.entries(r.tech)) tech[k] = (tech[k] || 0) + v;
  techAll[ch.id] = { tech, secret: runs.reduce((s, r) => s + r.secret, 0), prof: runs[0].prof, pack: runs[0].pack, feints: runs[0].feints };
}
console.log('\n=== 쓴 기술 (대결 판 합) · 숙련도 · 꾸러미의 동방 고유 동작 · 비기 ===');
for (const [id, t] of Object.entries(techAll)) {
  const uniq = Object.keys(t.tech).filter((k) => k in UNIQUE_CN || /염시|斂翅/.test(k));
  console.log(`${id}: 숙련도 ${t.prof} · 꾸러미 고유 ${JSON.stringify(t.pack)} · 속임 ${JSON.stringify(t.feints)} · 비기 ${t.secret} · 쓴 고유 ${JSON.stringify(uniq)}\n   쓴 기술 ${JSON.stringify(t.tech)}`);
}
