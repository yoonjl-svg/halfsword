// 광기의 병마용 실전 검사 (사장님 10/27 23:2x '일반 인간처럼 죽되 흰 피' · 23:3x 숙련도 5 — 확인표 2650 ~ 2655). 결정적. 실패하면 exit 1.
//  ① 롱소드 AI(사람) 대 가만히 선 광기의 병마용 · 원본 병마용 — 같은 씨앗 · 같은 판: 광기의 병마용은 출혈 · 치명상으로 죽음(참수 없이 죽은 판이 있음 · 피가 줄어듦),
//     원본 병마용은 피 1 그대로 · 죽은 판은 모두 목 관절 없음
//  ② 광기의 병마용 AI(시트 그대로 — 숙련도 5 · 월왕구천검) 대 롱소드 AI: 흰 피는 겉모습만 — 피 색 표식(blood 'white')을 뺀 같은 몸과 판이 한 자리까지 같음.
//     누가 이기는지는 숫자만 보인다(걸지 않음)
// 실행: node tools/sim/terracotta_mad_check.mjs [--fights=6] [--secs=30]
import { newRound, DT, AI } from './harness_m.mjs';
import { HUMAN_BODY } from '../../src/fighter.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { bloodPalette } from '../../src/blood_palette.js';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const FIGHTS = +(args.fights ?? 6), SECS = +(args.secs ?? 30);
let fails = 0;
const say = (ok, name, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) fails++; };
const MAD = CHARACTERS_BY_ID.terracotta_mad, TERRA = CHARACTERS_BY_ID.terracotta;
const bodyOf = (c) => Object.freeze({ ...HUMAN_BODY, ...c.physiology });
const headless = (f) => f.decapitated && !f.jointByName.head?.joint;
class Passive { update() {} }

/** 한 판: foe 시트 몸을 enemy 에. passive = enemy 가 가만히 선다 */
function fight(sheet, seed, passive) {
  const G = newRound({ seed, weapon: 'longsword', weapon2: sheet.weapon, AI2Class: AI, difficulty2: 'normal', persona2: null,
    ...(passive ? { AIClass: Passive } : { difficulty: sheet.ai.level, persona: sheet.ai.persona }),
    onFighter: (f) => { if (f.index === 1) f.physiology = bodyOf(sheet); } });
  const E = G.enemy, P = G.player;
  let minBlood = 1;
  for (let i = 0; i < SECS / DT; i++) {
    G.step();
    minBlood = Math.min(minBlood, E.blood);
    if (E.state === 'dead' || P.state === 'dead') break;
  }
  const r = { dead: E.state === 'dead', cause: E.causeOfDeath, headless: headless(E), decap: !!E.decapitated, minBlood, wounds: E.wounds.length, pDead: P.state === 'dead', pCause: P.causeOfDeath, t: G.t,
    blood: E.blood, pBlood: P.blood, white: bloodPalette(E).key };
  G.world.free();
  return r;
}
const line = (r) => `${r.dead ? `죽음(${r.cause}${r.decap ? ' · 참수' : ''})` : '살아 있음'} 피 최저 ${r.minBlood.toFixed(2)} 상처 ${r.wounds} · 사람 ${r.pDead ? `죽음(${r.pCause})` : '살아 있음'} · ${r.t.toFixed(1)} s`;

// ── ① 롱소드 AI 대 가만히 선 몸 ──
{
  const mad = [], clay = [];
  for (let seed = 1; seed <= FIGHTS; seed++) {
    const m = fight(MAD, seed, true), c = fight(TERRA, seed, true);
    mad.push(m); clay.push(c);
    console.log(`  ① 씨앗 ${seed}: 광기의 병마용 ${line(m)} | 원본 병마용 ${line(c)}`);
  }
  const madDeaths = mad.filter((r) => r.dead), madNoDecap = madDeaths.filter((r) => !r.decap);
  say(mad.every((r) => r.white === 'white') && clay.every((r) => r.white === 'red'), '① 피 색: 광기의 병마용 흰 피 · 원본 병마용(피 없음)은 기본 갈래');
  say(madNoDecap.length > 0 && madNoDecap.every((r) => !r.headless && ['출혈', '기절', '머리', '목', '내려찍기'].includes(r.cause)),
    '① 광기의 병마용: 목이 붙은 채 사람 규칙으로 죽은 판이 있음', `죽음 ${madDeaths.length} / ${FIGHTS} · 참수 없이 ${madNoDecap.length} (${madNoDecap.map((r) => r.cause).join(', ')})`);
  say(mad.some((r) => r.minBlood < 1), '① 광기의 병마용은 피를 흘림', `피 최저 ${Math.min(...mad.map((r) => r.minBlood)).toFixed(2)}`);
  say(clay.every((r) => r.minBlood === 1) && clay.filter((r) => r.dead).every((r) => r.headless), '① 원본 병마용: 피 1 그대로 · 죽은 판은 모두 목 관절 없음',
    `죽음 ${clay.filter((r) => r.dead).length} / ${FIGHTS} · 참수 ${clay.filter((r) => r.headless).length}`);
}

// ── ② 광기의 병마용 AI 대 롱소드 AI — 흰 피 표식을 뺀 같은 몸과 견줌 ──
{
  const RED_TWIN = { ...MAD, physiology: { body: 'human', bleeds: true, deathRequiresHeadDetachment: false } };
  const N = Math.max(1, Math.ceil(FIGHTS / 2));
  const out = [];
  let same = 0;
  for (let seed = 1; seed <= N; seed++) {
    const r = fight(MAD, seed, false), twin = fight(RED_TWIN, seed, false);
    out.push(r);
    const { white: _a, ...ra } = r, { white: _b, ...rb } = twin;
    if (JSON.stringify(ra) === JSON.stringify(rb) && r.white === 'white' && twin.white === 'red') same++;
    console.log(`  ② 씨앗 ${seed}: 광기의 병마용 AI(숙련도 ${MAD.ai.proficiency}) ${line(r)}`);
  }
  say(same === N, '② 흰 피는 겉모습만: 피 색 표식을 뺀 같은 몸 · 같은 씨앗 판과 결과가 한 자리까지 같음', `${same} / ${N} · 광기의 병마용 죽음 ${out.filter((r) => r.dead).length} · 사람 죽음 ${out.filter((r) => r.pDead).length}`);
}

console.log(fails ? `\n실패 ${fails}` : '\n모두 통과');
process.exit(fails ? 1 : 0);
