// ─────────────────────────────────────────────────────────────
//  prof_gap_measure.mjs — 숙련도 차이만 있는 같은 유파 거울 맞대결 (숙련도 격차 재기 · 목표 — 2:4 · 4:6 = 65 ~ 85 %, 2:6 = 85 ~ 95 %, 한 칸 차이 = 55 ~ 75 % (사장님 11/16 '목표 승률 모두 ok'))
//  유파 다섯(독일 · 이탈리아 · 이베리아 · 일본 · 동방) × 짝 여덟(1:2 · 2:3 · 3:4 · 4:5 · 5:6 · 2:4 · 4:6 · 2:6) = 칸 40.
//  칸마다 판 12 = 유파 대표 무기 둘 × 씨앗 1 ~ 3 × 자리 둘 (높은 쪽이 플레이어 자리 또는 상대 자리). 두 쪽 모두 같은 무기 · 같은 AI 클래스 · 숙련도만 다르다.
//  숙련도 6 은 시트와 같이 버팀 vitality = PROF6_VITALITY (src/characters.js · config.js — 숙련도 6 시트 규칙과 같은 뜻).
//  사장님 결정: '60초에도 승부 안 나면 비김으로 기록해. 2:6도 넣고 4갈래 동시 실행해.' · 목표 '65~85, 85~95 이렇게 해.'
//  기록 — 결과 hi(높은 쪽 이김) · lo(낮은 쪽 이김) · draw(60 s 까지 둘 다 서 있음 · 동시에 쓰러짐도 비김). 타이브레이크 없음.
//  판마다: 칸 · 짝 · 무기 · 씨앗 · 자리 · 결과 · 끝 시각 · 서로 준 상처 수 · 끝 피 · 비밀 기술 낸 수.
//  node tools/sim/prof_gap_measure.mjs [--schools=german,italian,…] [--pairs=1:2,2:4,…] [--seeds=1-3] [--dur=60] [--shard=i/n] [--json=path]
//  node tools/sim/prof_gap_measure.mjs agg a.json b.json …   ·  4 갈래 동시 실행: --shard=1/4 … --shard=4/4 (네 개 모두 옵션을 같게 — 옵션으로 만든 전체 목록 번호를 n 으로 나눔)
//  출력 — 합산 hi 몫 = (승 + 무 ½) / 판 수 · 95 % 윌슨 구간 · 승 / 무 / 패 · 평균 끝 시각 · 유파별 hi 몫 (무 수)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI } from './harness_m.mjs';
import { wilson } from './ref_duel.mjs';
import { isMain } from './is_main.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';
import { PROF6_VITALITY, AI_PROFICIENCY } from '../../src/config.js';

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };

export const SCHOOLS = ['german', 'italian', 'iberian', 'japanese', 'chinese'];
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };
export const PAIR_ORDER = ['1:2', '2:3', '3:4', '4:5', '5:6', '2:4', '4:6', '2:6'];

/** 짝의 목표 구간 (%) — 한 칸 차이 55 ~ 75 (사장님 11/16 '목표 승률 모두 ok') · 2:4 · 4:6 65 ~ 85 · 2:6 85 ~ 95 */
export function targetOf(key) {
  const [lo, hi] = key.split(':').map(Number);
  if (hi - lo === 1) return { t: [55, 75], label: '55 ~ 75 %' };
  if (key === '2:4' || key === '4:6') return { t: [65, 85], label: '65 ~ 85 %' };
  if (key === '2:6') return { t: [85, 95], label: '85 ~ 95 %' };
  return null;
}

const outOf = (f) => !f.alive || f.state === 'dead';
const secretsFired = (ai) => Object.values(ai?.stats?.secrets ?? {}).reduce((s, x) => s + (x.fired || 0), 0);

/** 전체 판 목록 (순서 고정 — 샤딩 번호는 이 목록의 순서) */
export function planFights({ schools, pairs, seeds }) {
  const list = [];
  for (const school of schools) for (const key of pairs) {
    const [lo, hi] = key.split(':').map(Number);
    WEAPONS[school].forEach((weapon, wi) => {
      for (const seed of seeds) for (const swap of [false, true]) list.push({ school, lo, hi, weapon, wi, seed, swap });
    });
  }
  return list;
}

/** 한 판: swap=false 면 높은 쪽이 플레이어 자리, true 면 상대 자리. 같은 무기 · 씨앗은 무기 · 씨앗 · 자리마다 다른 값 */
export function measureFight(f, dur) {
  const { school, lo, hi, weapon, wi, seed, swap } = f;
  const rngSeed = seed * 100 + wi * 10 + (swap ? 1 : 0);
  // persona = 상대(E) 자리 AI · persona2 = 플레이어 자리 AI (ai2)
  const G = newRound({
    seed: rngSeed, walls: true, weapon, weapon2: weapon, AI2Class: AI,
    // 실력 등급: 게임과 같게 숙련도 표의 이름을 넘김(main.js · characters.js aiAtProficiency — AI 가 AI_PLAN.levels 로 바꿈) · 11/17 고침: 전엔 harness 기본 'normal' 이라 모든 숙련도가 보통 숫자
    difficulty: AI_PROFICIENCY.levels[swap ? hi : lo], difficulty2: AI_PROFICIENCY.levels[swap ? lo : hi],
    persona: { proficiency: swap ? hi : lo }, persona2: { proficiency: swap ? lo : hi },
  });
  const hiF = swap ? G.enemy : G.player;
  const loF = swap ? G.player : G.enemy;
  const aiHi = swap ? G.ai : G.ai2;
  const aiLo = swap ? G.ai2 : G.ai;
  if (hi === 6 && !process.env.NO_VITAL) hiF.vitality = PROF6_VITALITY;
  if (lo === 6) loF.vitality = PROF6_VITALITY;

  const dealt = new Map([[hiF, 0], [loF, 0]]);
  G.onWound = (att, vic, r) => { if (r.severity > 0 && dealt.has(att)) dealt.set(att, dealt.get(att) + 1); };

  while (G.t < dur && !outOf(hiF) && !outOf(loF)) G.step();
  const hOut = outOf(hiF), lOut = outOf(loF);
  const result = lOut && !hOut ? 'hi' : hOut && !lOut ? 'lo' : 'draw';
  const rec = {
    school, lo, hi, weapon, seed, swap, result,
    endT: +G.t.toFixed(2),
    hiWounds: dealt.get(hiF), loWounds: dealt.get(loF),
    hiBlood: +hiF.blood.toFixed(3), loBlood: +loF.blood.toFixed(3),
    hiSecrets: secretsFired(aiHi), loSecrets: secretsFired(aiLo),
  };
  G.world.free();
  return rec;
}

const pct = (x) => `${x.toFixed(1)} %`;
/** 기록 배열 → Markdown 표 (짝마다 한 줄 · 합산 · 유파별) */
export function aggTable(rows) {
  const keys = [...new Set(rows.map((r) => `${r.lo}:${r.hi}`))];
  keys.sort((a, b) => (PAIR_ORDER.indexOf(a) < 0 ? 99 : PAIR_ORDER.indexOf(a)) - (PAIR_ORDER.indexOf(b) < 0 ? 99 : PAIR_ORDER.indexOf(b)) || a.localeCompare(b));
  const schools = SCHOOLS.filter((s) => rows.some((r) => r.school === s));
  const head = ['짝 (낮:높)', '목표', '합산 hi 몫 (승+무½)', '95 % 구간', '승 · 무 · 패', '평균 끝 (s)', ...schools.map((s) => KO[s])];
  const L = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`];
  for (const key of keys) {
    const rs = rows.filter((r) => `${r.lo}:${r.hi}` === key);
    const n = rs.length;
    const W = rs.filter((r) => r.result === 'hi').length, D = rs.filter((r) => r.result === 'draw').length, Lo = rs.filter((r) => r.result === 'lo').length;
    const k = W + D / 2;
    const p = (100 * k) / n;
    const [wl, wh] = wilson(k, n).map((v) => 100 * v);
    const tg = targetOf(key);
    const out = tg && (p < tg.t[0] || p > tg.t[1]) ? ' 밖' : '';
    const meanT = rs.reduce((s, r) => s + r.endT, 0) / n;
    const cells = schools.map((s) => {
      const ss = rs.filter((r) => r.school === s);
      if (!ss.length) return '-';
      const ks = ss.filter((r) => r.result === 'hi').length + ss.filter((r) => r.result === 'draw').length / 2;
      const ds = ss.filter((r) => r.result === 'draw').length;
      return `${((100 * ks) / ss.length).toFixed(0)} % (무 ${ds})`;
    });
    L.push(`| ${key} | ${tg ? tg.label : '-'} | ${pct(p)}${out} | ${wl.toFixed(1)} ~ ${wh.toFixed(1)} % | ${W} · ${D} · ${Lo} (${n}) | ${meanT.toFixed(1)} | ${cells.join(' | ')} |`);
  }
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  if (mode === 'agg') {
    const rows = args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')));
    console.log(aggTable(rows));
  } else {
    const schools = arg('schools', SCHOOLS.join(',')).split(',');
    for (const s of schools) if (!SCHOOLS.includes(s)) throw new Error(`unknown school: ${s}`);
    const pairs = arg('pairs', PAIR_ORDER.join(',')).split(',');
    for (const p of pairs) {
      const [lo, hi] = p.split(':').map(Number);
      if (!(Number.isInteger(lo) && Number.isInteger(hi) && lo >= 1 && hi > lo && hi <= 6)) throw new Error(`bad pair: ${p} (lo:hi, 1 ≤ lo < hi ≤ 6)`);
    }
    const seeds = range(arg('seeds', '1-3'));
    const dur = +arg('dur', '60');
    const shard = arg('shard', '1/1').split('/').map(Number);
    const [si, sn] = shard;
    if (!(sn >= 1 && si >= 1 && si <= sn)) throw new Error('--shard=i/n 은 1 ≤ i ≤ n');
    const all = planFights({ schools, pairs, seeds });
    const mine = all.map((f, k) => ({ f, k })).filter(({ k }) => k % sn === si - 1);
    console.error(`전체 ${all.length} 판 · 이 샤드 ${mine.length} 판 (${si}/${sn})`);
    const runs = [];
    for (const { f, k } of mine) {
      const r = measureFight(f, dur);
      runs.push(r);
      console.error(`[${k + 1}/${all.length}] ${f.school} ${f.lo}:${f.hi} w${f.wi} s${f.seed} ${f.swap ? 'swap' : 'std'} → ${r.result} @${r.endT}s`);
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(aggTable(runs));
  }
}
