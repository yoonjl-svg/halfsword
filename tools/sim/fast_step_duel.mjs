// 빠른 걸음 AI 판 (10/15 — 이탈리아 박자 걸음, docs/strike/italian_rhythm_2026-10-15.md): 시험 무기 AI(X) 대 상대 무기 AI, 씨앗마다 한 판(벽, 40 s — 48 판 아님).
//  X 의 빠른 걸음(gait.fastK > 1 로 뗀 걸음 — 짝걸음은 이끄는 발만 셈) 수 · 그 걸음 동안 X 가 시작한 공격(ai.js startAttack, 이어 치기 포함) 수 ·
//  X 의 넘어짐(stand → down)·붙잡기 반사 시간(gait.levC > 0.3 — 그중 빠른 걸음 동안과 그 뒤 0.5 s 몫, 다리 다침(legHealth < 1) 뒤 몫)·catch 디딤·
//  일찍 디딤(walk 걸음이 정한 시간 85 % 전에 디딤) · 공격 수 · 끝난 판(죽음 — 판마다 싸움이 갈라지므로 씨앗별 값보다 합을 본다)
//  재기만 — 물리·난수·AI 는 게임 그대로(begin·touchdown·startAttack 을 감싸 읽기만), 판 하나는 결정적. 주기는 TRADITIONS.italian.gait.rhythm.every 를 바꿔 견줌
//  실행: node tools/sim/fast_step_duel.mjs [X 무기 rapier] [상대 무기 longsword] [씨앗 수 3] [초 40] [주기들 0,3]
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { Gait } from '../../src/gait.js';
import { SCHOOLS, TRADITIONS } from '../../src/schools.js';

const [xw = 'rapier', yw = 'longsword', nSeed = '3', secs = '40', everyArg = '0,3'] = process.argv.slice(2);
const EVERY = everyArg.split(',').map(Number);
const RH = TRADITIONS.italian.gait.rhythm;
const EVERY0 = RH.every;
let X = null;
let fastSteps = 0;
let fastAtk = 0;
let atk = 0;
let early = 0;
let earlyF = 0;
let walkTD = 0;
let catches = 0;
const B0 = Gait.prototype.begin;
Gait.prototype.begin = function (l, kind, T) {
  B0.call(this, l, kind, T);
  if (this.f === X && this.fastK > 1 && (kind === 'walk' || kind === 'catch') && !(this.pairOn && this.pairStep === 'trail')) fastSteps++;
};
const TD0 = Gait.prototype.touchdown;
Gait.prototype.touchdown = function (l, speed) {
  if (this.f === X) {
    if (l.kind === 'walk') {
      walkTD++;
      if (l.t < 0.85 * l.T) {
        early++;
        if (l.fastStep) earlyF++;
      }
    }
    if (l.kind === 'catch') catches++;
  }
  TD0.call(this, l, speed);
};
const SA = AI.prototype.startAttack;
AI.prototype.startAttack = function (tech, why, opt) {
  const ok = SA.call(this, tech, why, opt);
  if (ok && this.me === X) {
    atk++;
    if (X.gait?.fastK > 1) fastAtk++;
  }
  return ok;
};

const school = (w) => (SCHOOLS[w] ? w : 'longsword');
console.log(`빠른 걸음 AI 판 · ${xw} AI 대 ${yw} AI · 씨앗 ${nSeed} × ${secs} s · mul ${RH.mul} · idle ${RH.idle} s`);
console.log('| 주기 | 씨앗 | 빠른 걸음 (분당) | 그 걸음 중 공격 / 공격 | 넘어짐 | 붙잡기 반사 s (빠른 걸음 +0.5 s 안 · 다리 다친 뒤) | catch 디딤 | 일찍 디딤 (빠른 걸음 발) | 끝 (X/상대) |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const every of EVERY) {
  RH.every = every;
  const tot = { fast: 0, fastAtk: 0, atk: 0, falls: 0, lev: 0, levF: 0, levH: 0, catches: 0, early: 0, walkTD: 0, T: 0 };
  for (let s = 1; s <= +nSeed; s++) {
    const seed = 1000 + s;
    const G = newRound({ walls: true, seed, weapon: xw, weapon2: yw, difficulty: 'normal', persona: { school: school(yw) }, AI2Class: AI, difficulty2: 'normal', persona2: { school: school(xw) } });
    X = G.player;
    fastSteps = fastAtk = atk = early = earlyF = walkTD = catches = 0;
    let falls = 0;
    let lev = 0;
    let levF = 0;
    let levH = 0;
    let fastT = -9;
    let hurtLeg = false;
    let prev = X.state;
    let T = 0;
    for (let i = 0; i < +secs / DT; i++) {
      G.step();
      T += DT;
      if (prev === 'stand' && X.state === 'down') falls++;
      prev = X.state;
      if (X.gait?.fastK > 1) fastT = T;
      if (X.legHealth < 1) hurtLeg = true;
      if (X.state === 'stand' && X.gait?.active && X.gait.levC > 0.3) {
        lev += DT;
        if (T - fastT <= 0.5) levF += DT;
        if (hurtLeg) levH += DT;
      }
      if (X.state === 'dead' || G.enemy.state === 'dead') break;
    }
    console.log(`| ${every ? `${every} + 1` : '끔'} | ${seed} | ${fastSteps} (${((fastSteps * 60) / T).toFixed(1)}) | ${fastAtk} / ${atk} | ${falls} | ${lev.toFixed(2)} (${levF.toFixed(2)} · ${levH.toFixed(2)}) | ${catches} | ${early}/${walkTD} (${earlyF}) | ${X.state}/${G.enemy.state} @${T.toFixed(1)} s |`);
    Object.assign(tot, { fast: tot.fast + fastSteps, fastAtk: tot.fastAtk + fastAtk, atk: tot.atk + atk, falls: tot.falls + falls, lev: tot.lev + lev, levF: tot.levF + levF, levH: tot.levH + levH, catches: tot.catches + catches, early: tot.early + early, earlyF: (tot.earlyF ?? 0) + earlyF, walkTD: tot.walkTD + walkTD, T: tot.T + T });
  }
  console.log(`| **${every ? `${every} + 1` : '끔'} 합** | | ${tot.fast} (${((tot.fast * 60) / tot.T).toFixed(1)}) | ${tot.fastAtk} / ${tot.atk} | ${tot.falls} | ${tot.lev.toFixed(2)} (${tot.levF.toFixed(2)} · ${tot.levH.toFixed(2)}) | ${tot.catches} | ${tot.early}/${tot.walkTD} (${tot.earlyF ?? 0}) | ${tot.T.toFixed(1)} s |`);
}
RH.every = EVERY0;
