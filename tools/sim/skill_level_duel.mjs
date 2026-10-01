// 검술 보정(skill.level)만 다른 AI(X) 대 보통 AI (롱소드끼리, hybrid): 승패, 손 앞뻗음, 낸 상처의 칼 속도·에너지, 받은 상처. 사용법: node tools/sim/skill_level_duel.mjs <보정 0~1> [판수(자리마다)=24]
//  --both: 같은 시드를 두 번 — X 의 skill.corr 'old' 다음 'v2' (newRound 뒤 X 에만 넣는다. Y 는 설정 그대로 = SKILL.corrAI). 결과 두 줄 + 차이 한 줄 + 뜻 바뀜 한 줄
//   (--both 가 없으면 출력은 예전과 글자까지 같다)
import * as CONFIG from '../../src/config.js';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { wilson } from './ref_duel.mjs';
CONFIG.BODY.weightMode = 'hybrid';
const argv = process.argv.slice(2);
const BOTH = argv.includes('--both');
const pos = argv.filter((a) => a !== '--both');
const S = +pos[0]; const N = +(pos[1] || 24);
function run(corr) {
  const st = { W: 0, L: 0, D: 0, fwd: 0, fwdMax: 0, steps: 0, give: [], take: 0, strikes: 0 };
  for (let s = 1; s <= N; s++) for (const xf of [true, false]) {
    const xp = { school: 'longsword', level: { skill: S } }, yp = { school: 'longsword' };
    const G = newRound({ walls: true, seed: (xf ? 1000 : 2000) + s, weapon: 'longsword', weapon2: 'longsword', difficulty: 'normal', persona: xf ? yp : xp, AI2Class: AI, difficulty2: 'normal', persona2: xf ? xp : yp });
    const X = xf ? G.player : G.enemy, Y = xf ? G.enemy : G.player;
    if (corr) X.skill.corr = corr;
    G.onWound = (a, v, r) => { if (!(r.severity > 0)) return; if (a === X) st.give.push([r.speed, r.energy]); else st.take++; };
    let res = 'D';
    for (let i = 0; i < 40 / DT; i++) {
      G.step();
      const h = X.handBase; if (h) { st.fwd += h[0]; st.fwdMax = Math.max(st.fwdMax, h[0]); st.steps++; }
      if (X.state === 'dead' || Y.state === 'dead') { res = X.state === 'dead' && Y.state === 'dead' ? 'D' : Y.state === 'dead' ? 'W' : 'L'; break; }
    }
    st[res]++;
  }
  return st;
}
const m = (a, i) => (a.length ? a.reduce((p, q) => p + q[i], 0) / a.length : 0);
const line = (st) => {
  const n = st.W + st.L + st.D;
  const [lo, hi] = wilson(st.W, n);
  return `보정 ${S}: 승 ${st.W} 패 ${st.L} 무 ${st.D}/${n} (승률 ${Math.round(100 * st.W / n)}% [95% ${Math.round(100 * lo)}~${Math.round(100 * hi)}]) · 손 앞뻗음 평균 ${(st.fwd / st.steps).toFixed(2)}m 최대 ${st.fwdMax.toFixed(2)}m · 낸 상처 ${(st.give.length / n).toFixed(1)}/판 (칼 속도 ${m(st.give, 0).toFixed(1)}m/s, 에너지 ${m(st.give, 1).toFixed(0)}J) · 받은 상처 ${(st.take / n).toFixed(1)}/판`;
};
if (!BOTH) console.log(line(run(null)));
else {
  const has = 'corr' in (CONFIG.SKILL || {});
  if (!has) console.log('feature absent (SKILL.corr 없음): v2 칸도 옛 보정으로 돈다');
  const a = run('old'), b = run('v2');
  const n = a.W + a.L + a.D;
  console.log(`[X old] ${line(a)}`);
  console.log(`[X v2 ] ${line(b)}`);
  const d = (x, y, k = 1) => `${y - x >= 0 ? '+' : ''}${((y - x) * k).toFixed(2)}`;
  console.log(`[v2 − old] 승 ${d(a.W, b.W)} 패 ${d(a.L, b.L)} 무 ${d(a.D, b.D)} (/${n}) · 손 앞뻗음 평균 ${d(a.fwd / a.steps, b.fwd / b.steps)}m · 낸 상처/판 ${d(a.give.length / n, b.give.length / n)} (칼 속도 ${d(m(a.give, 0), m(b.give, 0))}m/s, 에너지 ${d(m(a.give, 1), m(b.give, 1))}J) · 받은 상처/판 ${d(a.take / n, b.take / n)}`);
  console.log('주의: 손 앞뻗음(handBase[0])은 v2 에서 뜻이 바뀐다 — 옛 보정은 자세 지도로 끈 손 자리, v2 는 날것 깊이 매핑 그대로라 두 줄의 앞뻗음은 같은 양이 아니다 (설계 "뜻이 바뀌는 도구")');
}
