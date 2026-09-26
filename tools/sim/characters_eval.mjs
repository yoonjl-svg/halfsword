// characters.js에 담긴 5인의 캐릭터를 검증한다 (헤드리스, 결정적):
//  1) 구분성: 가만히 있는 상대(더미) 앞에서 자세 전환 거리·빈도, 평균 간격, 분당 공격·속임수, 붙음(clinch) 비율을 잰다
//  2) 균형: 캐릭터끼리 맞대결(라운드로빈) + 더미 상대 처치 시간(TTK)
//
// 실행: node tools/sim/characters_eval.mjs [passive|rr|both] [seeds]
import { newRound, DT, THREE } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { padDist } from '../../src/ai_techniques.js';
import { CHARACTERS } from '../../src/characters.js';

const [mode = 'both', seedsArg = '5'] = process.argv.slice(2);
const SEEDS = +seedsArg;
const CLINCH_D = 1.3; // eval_m.mjs와 같은 기준
const GUARDS_READY = [0.12, -0.18];

const flat = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
const slow = (off, q, sp) => {
  const dx = q[0] - off.x, dy = q[1] - off.y, dd = Math.hypot(dx, dy), s = sp * DT;
  if (dd > s) { off.x += (dx / dd) * s; off.y += (dy / dd) * s; } else off.set(q[0], q[1]);
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

/** 캐릭터 하나를 가만히 서 있는 더미 앞에 세우고 재는 시나리오 */
function runPassive(ch, seed, durS = 60) {
  const opts = { seed, difficulty: ch.ai.level, persona: ch.ai.persona };
  const G = newRound(opts);
  const { player: dummy, enemy: fighter, ai } = G;
  G.before = () => { dummy.move.set(0, 0); slow(dummy.handOffset, GUARDS_READY, 1.0); };

  let prevGuard = ai.guard;
  const switchAt = []; // 자세를 바꾼 순간의 간격(d)
  let switches = 0;
  let dSum = 0, dN = 0;
  let clinchT = 0, standT = 0;
  let tDead = null;

  const steps = Math.round(durS / DT);
  for (let i = 0; i < steps; i++) {
    G.step();
    if (!dummy.alive || !fighter.alive) { if (tDead == null) tDead = +G.t.toFixed(1); break; }
    if (ai.guard !== prevGuard) {
      switches++;
      switchAt.push(padDist(ai.guard.pad, prevGuard.pad)); // 자세 공간에서 얼마나 먼 자세로 건너뛰었나 (가까운 자세 고집 vs 먼 자세로 점프)
      prevGuard = ai.guard;
    }
    if (fighter.state === 'stand') {
      standT += DT;
      dSum += ai.d;
      dN++;
      if (ai.d < CLINCH_D) clinchT += DT;
    }
  }
  const dur = tDead ?? durS;
  return {
    id: ch.id,
    switchDist: mean(switchAt),
    switchesPerSec: switches / dur,
    meanDist: dN ? dSum / dN : 0,
    apm: (ai.stats.attacks / dur) * 60,
    feintsPerMin: (ai.stats.feints / dur) * 60,
    clinchPct: standT ? (clinchT / standT) * 100 : 0,
    ttk: tDead,
  };
}

/** 캐릭터 대 캐릭터 맞대결 (혹은 캐릭터 대 기본 AI) 한 판. a=enemy(index1), b=player(index0) */
function runDuel(chA, chB, seed, durS = 45) {
  const opts = {
    seed,
    difficulty: chA.ai.level,
    persona: chA.ai.persona,
    AI2Class: AI,
    difficulty2: chB.ai.level,
    persona2: chB.ai.persona,
  };
  const G = newRound(opts);
  const { player: B, enemy: A } = G;
  const steps = Math.round(durS / DT);
  for (let i = 0; i < steps; i++) {
    G.step();
    if (!A.alive || !B.alive) break;
  }
  if (!A.alive && !B.alive) return 'draw';
  if (!A.alive) return 'B'; // B(플레이어 자리) 승
  if (!B.alive) return 'A'; // A(적 자리) 승
  return A.blood === B.blood ? 'draw' : A.blood > B.blood ? 'A' : 'B';
}

function fmt(x) { return (Math.round(x * 100) / 100).toFixed(2); }

async function main() {
  if (mode === 'passive' || mode === 'both') {
    console.log('\n=== 구분성 (더미 상대, 60초, 시드 1~' + SEEDS + ' 평균) ===');
    console.log('id, 자세전환거리(m), 전환/초, 평균간격(m), 분당공격, 분당속임수, 붙음%, 평균TTK(s)');
    for (const ch of CHARACTERS) {
      const runs = [];
      for (let s = 1; s <= SEEDS; s++) runs.push(runPassive(ch, s));
      const r = {
        switchDist: mean(runs.map((x) => x.switchDist)),
        switchesPerSec: mean(runs.map((x) => x.switchesPerSec)),
        meanDist: mean(runs.map((x) => x.meanDist)),
        apm: mean(runs.map((x) => x.apm)),
        feintsPerMin: mean(runs.map((x) => x.feintsPerMin)),
        clinchPct: mean(runs.map((x) => x.clinchPct)),
        ttks: runs.map((x) => x.ttk).filter((x) => x != null),
      };
      const ttkMean = r.ttks.length ? mean(r.ttks) : null;
      console.log(`${ch.id}, ${fmt(r.switchDist)}, ${fmt(r.switchesPerSec)}, ${fmt(r.meanDist)}, ${fmt(r.apm)}, ${fmt(r.feintsPerMin)}, ${fmt(r.clinchPct)}, ${ttkMean ? fmt(ttkMean) + ` (${r.ttks.length}/${SEEDS}판 처치)` : '처치 못함'}`);
    }
  }

  if (mode === 'rr' || mode === 'both') {
    console.log('\n=== 균형: 캐릭터 라운드로빈 (시드 1~' + SEEDS + ') ===');
    // 주의: 이 물리 시뮬레이션은 자리(A=index1/enemy, B=index0/player)에 따라 작지만 실재하는 유불리가
    //  있다(같은 성격끼리 붙여도 자리를 바꾸면 승률이 달라진다 — ai*.js가 아니라 물리/자리 배치 쪽 문제로
    //  보인다). 그래서 각 조합을 두 자리 배치 모두 돌려 평균 낸 "대칭 승률"을 진짜 실력 비교로 쓴다.
    const ids = CHARACTERS.map((c) => c.id);
    const raw = {}; // raw[A][B] = A가 자리 A(enemy)일 때 B를 이긴 비율(%)
    for (const chA of CHARACTERS) {
      raw[chA.id] = {};
      for (const chB of CHARACTERS) {
        if (chA.id === chB.id) continue;
        let aWins = 0, bWins = 0, draws = 0;
        for (let s = 1; s <= SEEDS; s++) {
          const r = runDuel(chA, chB, s);
          if (r === 'A') aWins++; else if (r === 'B') bWins++; else draws++;
        }
        raw[chA.id][chB.id] = (aWins / SEEDS) * 100;
      }
    }
    console.log('[참고] 자리 그대로: 행 = A(enemy 자리), 열 = B(player 자리). 셀 = A가 B를 이긴 비율(%)');
    console.log('A\\B,' + ids.join(','));
    for (const a of ids) console.log(a + ',' + ids.map((b) => (a === b ? '-' : fmt(raw[a][b]))).join(','));

    // 대칭 승률: X가 A자리일 때 이긴 비율과, X가 B자리일 때(=Y가 A자리일 때 Y가 진 비율) 이긴 비율의 평균
    const sym = {};
    for (const x of ids) { sym[x] = {}; for (const y of ids) if (x !== y) sym[x][y] = (raw[x][y] + (100 - raw[y][x])) / 2; }
    console.log('\n[진짜 밸런스] 대칭 승률: 행 X가 열 Y를 이긴 비율(%) — 자리 유불리를 상쇄한 값');
    console.log('X\\Y,' + ids.join(','));
    for (const x of ids) console.log(x + ',' + ids.map((y) => (x === y ? '-' : fmt(sym[x][y]))).join(','));
  }
}

main();
