// AI 리볼버 발 사이 간격 · 첫 발 · 쏘는 동안 발 묶음 점검 — 사장님 10/16 지시(× 1.8, 샛별 쪽 메모로 전달, 10/17 들여옴 · 확인표 2022 · docs/import/saetbyeol_requests_2026-10-17.md)
//  → 사장님 10/29 22:3x '1.8배 → 2.0배 · 공격이 가능하게 된 시점에서 그 초만큼 간격을 주어 첫 탄환 · 발사 중엔 이동 못 하게'(확인표 2980 ~ 2982)
//  → 사장님 10/30 00:1x '사람은 그대로 두고 AI만 적용해. 쏘기 전과 후에 모두 0.2초 움직임 정지 넣어.'(확인표 2985 · 2986 — GUN.aiPlant · aiAfter)
//  → 사장님 10/30 01:4x '2번으로'(AI 조준 보정 없음 — GUN.aiAimAssist 0 · 확인표 3010) · '마야가 받는 모든 핸디캡은 ai가 리볼버를 쓸 때 전부 적용'(GUN.aiHandicapK 1.5 — AI 권총 모두 · 확인표 3012)
//  → 사장님 10/30 08:1x 'AI는 가늠쇠가 몸통(골반 ~ 가슴)을 지날 때만 쏜다'(GUN.aiTorsoOnly 1 · aiPlantAim 1 — 다 선 뒤 몸통에 걸릴 때까지 섬 · 확인표 3015 · 3016).
//  GUN.aiCooldownK(2.0)는 AI 가 모는 몸(f.aiControlled — ai.js AI 생성자가 붙이는 표시)의 발 사이 간격에만 곱한다(gun.js gunGap).
//  실제 gun.js updateGun 길을 그대로 돌리고, 한 발이 나간 바로 그 스텝에 정해진 시간(f.gun.cool)을 읽는다:
//   장전이 아닐 때 = 발 사이 간격(GUN.cooldown × AI 핸디캡 aiHandicapK × AI 배율 — 사람은 둘 다 1) · 여섯째 발 뒤 = 장전(GUN.reload).
//  '전' 판의 마야는 그때처럼 몸에 gunCooldownK 1.5 를 붙여(인물 덮어쓰기 길) 돌린다 — 그때 기본 AI 는 핸디캡 1.
//  사람 손은 '쏠 수 있으면 바로 탭'(skill.thrust — 게임의 찌르기 단추와 같은 길)으로 흉내 낸다. 이 손에는 AI 표시가 없다.
//  '전' = 같은 판을 10/29 전 값(aiCooldownK 1.8 · aiFirstGap 0 · aiFireStill 0 · 흔들림 1.1)으로 돌린 것 · '후' = 지금 값.
//  시간: 정해진 값은 게임 초(시뮬 템포 1.1 — 실제 초 × TIME.k), 줄에는 실제 초를 함께 찍는다.
//  결정적: harness_m newRound 의 seed 로 Math.random 을 고정한다. 어긋난 줄이 있으면 '실패' 를 찍고 종료 코드 1.
//   node tools/sim/ai_gun_cooldown_check.mjs
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { GUN, gunGap } from '../../src/gun.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const { realS, TIME, ARENA } = CONFIG;
const KEYS = ['aiCooldownK', 'aiFirstGap', 'aiFireStill', 'aiPlant', 'aiPlantAim', 'aiAfter', 'aimEnvelopeScale', 'aiAimAssist', 'aiHandicapK', 'aiTorsoOnly'];
const NOW = Object.fromEntries(KEYS.map((k) => [k, GUN[k]])); // 지금 값 (2.0 · 1 · 1 · 0.2 · 0.2 · 1.21)
const OLD = { aiCooldownK: 1.8, aiFirstGap: 0, aiFireStill: 0, aiPlant: 0, aiPlantAim: 0, aiAfter: GUN.kickTime + GUN.kickFade, aimEnvelopeScale: 1.1, aiAimAssist: 1, aiHandicapK: 1, aiTorsoOnly: 0 }; // 10/29 전
const MAYA = CHARACTERS_BY_ID.samira; // 마야(id samira) — 10/30 01:4x 부터 시트에 권총 배율 없음(GUN.aiHandicapK)
const FOE_MAYA = { weapon2: 'pistol', look2: MAYA.look, difficulty: MAYA.ai.level, persona: MAYA.ai.persona };
const HUMAN = realS(0.8); // 사람 간격 (게임 초)
const PLAIN = realS(0.8) * 1.5 * 2.0; // 인물 없는 기본 AI — 실제 2.4 s (10/30 01:4x 부터 마야와 같음 · 전 1.6)
const MAYA_GAP = realS(0.8) * 1.5 * 2.0; // 마야 AI — 실제 2.4 s
const PLAIN_OLD = realS(0.8) * 1.8; // 전 1.44 s
const MAYA_OLD = realS(0.8) * 1.5 * 1.8; // 전 2.16 s
const RELOAD = realS(8);
const STOP = realS(0.2); // 쏘기 전 · 뒤 멈춤 (게임 초)
const near = (a, b) => Math.abs(a - b) < 1e-9;
const allNear = (xs, v) => xs.length > 0 && xs.every((x) => near(x, v));
const real = (t) => +(t / TIME.k).toFixed(4);
const fmt = (xs) => (xs.length ? [...new Set(xs.map((x) => real(x)))].join('/') + ' s' : '없음');
let fails = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? '통과' : '실패'} · ${msg}`);
  if (!ok) fails++;
};

/** 사람 손 흉내: 쏠 수 있으면 바로 탭한다 (AI 가 아니다 — aiControlled 를 붙이지 않는다). harness 의 AIClass / AI2Class 자리에 넣는다 */
class Tapper {
  constructor(me) {
    this.me = me;
  }
  update() {
    if (this.me.weapon?.gun) this.me.skill.thrust();
  }
}
/** 판 하나를 secs 초 돌리며 두 몸의 발사를 적는다 — 쏜 스텝의 { t, cool(정해진 시간), reload(장전으로 넘어갔나) } · 발 묶인 스텝(fireHold) · 묶인 동안 걷기 입력이 0 이 아닌 스텝 */
function run(opts, secs, cond = NOW, before = null) {
  Object.assign(GUN, cond);
  try {
    const G = newRound({ walls: true, ...opts });
    if (cond === OLD && opts.persona === MAYA.ai.persona) G.enemy.gunCooldownK = 1.5; // 전 판 마야 = 시트 1.5 (그때 ai.js 가 몸에 붙이던 값)
    before?.(G);
    const F = [G.player, G.enemy];
    const shots = [[], []];
    const seen = [0, 0];
    const hold = [0, 0];
    const leak = [0, 0];
    const runs = [[], []]; // 이어진 발 묶음 토막 { pre, post } (게임 초 — 쏘지 않은 토막은 pre null)
    const open = [null, null];
    const torsoPrev = [false, false]; // 지난 스텝 뒤 g.onTorso (gunAI 가 이 스텝에 읽은 값)
    for (let i = 0; i < Math.round(secs / DT); i++) {
      G.step();
      F.forEach((f, j) => {
        const n = f.gun?.shots ?? 0;
        if (f.fireHold && !open[j]) open[j] = { start: i, shot: null };
        if (n > seen[j]) {
          seen[j] = n;
          shots[j].push({ t: +G.t.toFixed(4), cool: f.gun.cool, reload: f.gun.reloading, aim: f.gun.aim, torso: torsoPrev[j] });
          if (open[j]) open[j].shot = i;
        }
        torsoPrev[j] = !!f.gun?.onTorso;
        if (f.fireHold) {
          hold[j]++;
          if (f.move.x || f.move.y) leak[j]++;
        } else if (open[j]) {
          const o = open[j];
          runs[j].push(o.shot == null ? { pre: null, post: (i - o.start) * DT } : { pre: (o.shot - o.start) * DT, post: (i - o.shot) * DT });
          open[j] = null;
        }
      });
    }
    return { P: G.player, E: G.enemy, sP: shots[0], sE: shots[1], hP: hold[0], hE: hold[1], leakP: leak[0], leakE: leak[1], rP: runs[0], rE: runs[1] };
  } finally {
    Object.assign(GUN, NOW);
  }
}
const gapsOf = (s) => s.filter((x) => !x.reload).map((x) => x.cool); // 정해진 발 사이 간격
const reloadsOf = (s) => s.filter((x) => x.reload).map((x) => x.cool); // 정해진 장전 시간
/** 실제로 잰 발 사이 시간 (장전을 낀 사이는 뺀다) — 정해진 간격보다 짧을 수 없다 */
const realGaps = (s) => {
  const out = [];
  for (let i = 1; i < s.length; i++) if (!s[i - 1].reload) out.push(s[i].t - s[i - 1].t);
  return out;
};
const minOf = (xs) => (xs.length ? Math.min(...xs) : NaN);
const line = (name, s) => {
  const m = minOf(realGaps(s));
  return `${name}: ${s.length}발 · 간격 ${fmt(gapsOf(s))} · 장전 ${fmt(reloadsOf(s))} · 첫 발 ${s[0] ? real(s[0].t - ARENA.startHold) + ' s(공격 가능부터)' : '없음'} · 실제 최소 간격 ${Number.isNaN(m) ? '없음' : real(m) + ' s'}`;
};
/** 첫 발이 공격이 가능해진 때(ARENA.startHold) + 간격 gap 보다 이르지 않다 */
const firstAfter = (s, gap) => !!s[0] && s[0].t >= ARENA.startHold + gap - 1e-9;

console.log(`GUN.cooldown ${real(GUN.cooldown)} s · GUN.reload ${real(GUN.reload)} s · GUN.aiCooldownK ${NOW.aiCooldownK} · aiFirstGap ${NOW.aiFirstGap} · aiFireStill ${NOW.aiFireStill} · AI 핸디캡 ${GUN.aiHandicapK} · AI 조준 보정 ${GUN.aiAimAssist} · 마야 시트 gunCooldownK ${MAYA.ai.persona.gunCooldownK} · 판 시작 정지 ${ARENA.startHold} 게임 초 (실제 초로 찍음 — TIME.k ${TIME.k})`);
check(NOW.aiCooldownK === 2.0 && NOW.aiFirstGap === 1 && NOW.aiFireStill === 1, 'GUN.aiCooldownK = 2.0 · aiFirstGap 1 · aiFireStill 1 (사장님 10/29 22:3x)');
check(near(NOW.aiPlant, STOP) && near(NOW.aiAfter, STOP), 'GUN.aiPlant · aiAfter = 실제 0.2 s (사장님 10/30 00:1x — 시간 사다리 0.2)');
check(NOW.aiAimAssist === 0 && NOW.aiHandicapK === 1.5 && MAYA.ai.persona.gunCooldownK === undefined, 'GUN.aiAimAssist 0 · aiHandicapK 1.5 · 마야 시트에 따로 배율 없음 (사장님 10/30 01:4x)');
check(near(GUN.cooldown, realS(0.8)) && near(GUN.reload, realS(8)), 'GUN.cooldown 실제 0.8 · GUN.reload 실제 8 그대로 (플레이어 간격 · 장전을 건드리지 않음)');

// ① 사람 대 AI (AI 는 롱소드로 실제로 싸운다): 사람 권총의 간격 · 장전 · 쏜 시각이 전과 바이트 같다 · 사람은 발이 안 묶인다
console.log('\n① 사람(권총, 탭) 대 롱소드 AI — 20 s · 씨앗 21');
{
  const o = { seed: 21, weapon: 'pistol', weapon2: 'longsword', AI2Class: Tapper };
  const a = run(o, 20, OLD);
  const b = run(o, 20);
  console.log(`  전 ${line('사람', a.sP)}\n  후 ${line('사람', b.sP)}`);
  check(!b.P.aiControlled && b.E.aiControlled, '플레이어 자리 = 사람(AI 표시 없음) · 상대 = AI');
  check(allNear(gapsOf(b.sP), HUMAN) && allNear(reloadsOf(b.sP), RELOAD), '사람 간격 0.8 s · 장전 8 s');
  check(JSON.stringify(a.sP) === JSON.stringify(b.sP), `사람의 발사 기록(쏜 시각 · 간격 · 장전) ${b.sP.length}발이 전과 같다`);
  check(b.hP === 0, '사람은 쏘는 동안에도 발이 안 묶인다 (fireHold 0 스텝)');
}

// ② 사람 대 기본 AI 권총(인물 없음): AI 1.44 → 2.4 s(마야와 같은 핸디캡) · 장전 8 · 첫 발 = 공격 가능 + 2.4 s 뒤
console.log('\n② 가만히 선 사람(롱소드) 대 기본 AI(권총, 인물 배율 없음) — 24 s · 씨앗 11');
{
  const o = { seed: 11, weapon: 'longsword', weapon2: 'pistol' };
  const a = run(o, 24, OLD);
  const b = run(o, 24);
  console.log(`  전 ${line('AI', a.sE)}\n  후 ${line('AI', b.sE)}`);
  check(b.E.gunCooldownK === undefined, 'AI 몸에 인물 배율 없음 → AI 권총 핸디캡 GUN.aiHandicapK 1.5');
  check(allNear(gapsOf(a.sE), PLAIN_OLD) && allNear(gapsOf(b.sE), PLAIN), 'AI 간격 전 1.44 s → 후 2.4 s (마야와 같음)');
  check(b.sE.every((x) => x.aim === 0) && a.sE.every((x) => x.aim > 0), 'AI 조준 보정: 전 있음 → 후 없음 (총알 = 쏜 순간 총신 방향)');
  check(allNear(reloadsOf(a.sE), RELOAD) && (allNear(reloadsOf(b.sE), RELOAD) || reloadsOf(b.sE).length === 0), 'AI 장전 8 s 그대로 (전 · 후 — 장전까지 갔으면)');
  check(firstAfter(b.sE, PLAIN) && !firstAfter(a.sE, PLAIN), `AI 첫 발: 전 공격 가능 ${real(a.sE[0]?.t - ARENA.startHold)} s 뒤 → 후 ${real(b.sE[0]?.t - ARENA.startHold)} s 뒤 (≥ 2.4 s)`);
  check(minOf(realGaps(b.sE)) >= PLAIN - 1e-9, `실제로 잰 AI 발 사이 시간도 2.4 s 아래로 내려가지 않음 (최소 ${real(minOf(realGaps(b.sE)))} s)`);
}

// ③ 사람 대 AI 마야: 인물 배율 1.5 는 그대로, AI 배율을 위에 얹어 1.2 → 2.4 s · 첫 발 = 공격 가능 + 2.4 s · 쏘는 동안 발 묶음
console.log('\n③ 가만히 선 사람(롱소드) 대 AI 마야(권총, 인물 배율 1.5) — 30 s · 씨앗 12');
{
  const o = { seed: 12, weapon: 'longsword', ...FOE_MAYA };
  const a = run(o, 30, OLD);
  const b = run(o, 30);
  const shotRuns = b.rE.filter((r) => r.pre != null);
  const fmtR = (k) => [...new Set(shotRuns.map((r) => real(r[k])))].join('/');
  console.log(`  전 ${line('마야', a.sE)}\n  후 ${line('마야', b.sE)} · 발 묶인 스텝 ${b.hE} · 한 발 쏘기 전 ${fmtR('pre')} s · 쏜 뒤 ${fmtR('post')} s · 쏘지 않고 풀린 멈춤 ${b.rE.length - shotRuns.length}`);
  check(b.E.gunCooldownK === undefined && a.E.gunCooldownK === 1.5, '마야: 전 시트 배율 1.5 → 후 AI 권총 핸디캡(몸에 따로 없음) — 간격은 같은 2.4 s');
  check(allNear(gapsOf(a.sE), MAYA_OLD) && allNear(gapsOf(b.sE), MAYA_GAP), '마야 간격 전 2.16 s → 후 2.4 s');
  check(allNear(reloadsOf(b.sE), RELOAD) || reloadsOf(b.sE).length === 0, '마야 장전 8 s 그대로 (장전까지 갔으면)');
  check(firstAfter(b.sE, MAYA_GAP), `마야 첫 발 공격 가능 ${real(b.sE[0]?.t - ARENA.startHold)} s 뒤 ≥ 2.4 s (전 ${real(a.sE[0]?.t - ARENA.startHold)} s)`);
  check(minOf(realGaps(b.sE)) >= MAYA_GAP - 1e-9, `실제로 잰 발 사이 시간 최소 ${real(minOf(realGaps(b.sE)))} s ≥ 2.4`);
  // 쏘는 중 = 쏘기 전 멈춤 0.2 s(+ 가늠쇠가 몸통에 걸릴 때까지) + 방아쇠 스텝 + 쏜 뒤 멈춤 0.2 s — 발 사이 기다림 전체가 아님 · 묶인 동안 걷기 입력은 0
  const within = (x, v) => x >= v - DT - 1e-9 && x <= v + 2 * DT + 1e-9;
  check(shotRuns.length > 0 && shotRuns.length >= b.sE.length - 1 && shotRuns.every((r) => r.pre >= STOP - DT - 1e-9 && within(r.post, STOP)), `한 발마다 쏘기 전 ≥ 0.2 s · 쏜 뒤 0.2 s(± 스텝) 묶임 — ${shotRuns.length} 토막 · 쏘기 전 가장 긴 ${real(Math.max(...shotRuns.map((r) => r.pre)))} s`);
  check(b.sE.length > 0 && b.sE.every((x) => x.torso) && !a.sE.every((x) => x.torso), `AI 는 가늠쇠가 몸통(골반 ~ 가슴)에 걸린 스텝에만 쏨 — ${b.sE.length}발 모두 (전 판은 ${a.sE.filter((x) => !x.torso).length}발이 몸통 밖)`);
  check(b.leakE === 0, '묶인 동안 걷기 입력(move) 0');
  check(a.hE === 0, '전(aiFireStill 0)은 안 묶임');
}

// ④ 사람 대 AI, 둘 다 권총: 같은 판에서 사람 0.8 · AI 2.4
console.log('\n④ 사람(권총, 탭) 대 기본 AI(권총) — 24 s · 씨앗 13');
{
  const o = { seed: 13, weapon: 'pistol', weapon2: 'pistol', AI2Class: Tapper };
  const a = run(o, 24, OLD);
  const b = run(o, 24);
  console.log(`  전 ${line('사람', a.sP)}\n      ${line('AI', a.sE)}\n  후 ${line('사람', b.sP)}\n      ${line('AI', b.sE)}`);
  check(allNear(gapsOf(a.sP), HUMAN) && allNear(gapsOf(b.sP), HUMAN), '사람 간격 전 · 후 모두 0.8 s');
  check(allNear(reloadsOf(b.sP), RELOAD) || reloadsOf(b.sP).length === 0, '사람 장전 8 s (장전까지 갔으면)');
  check(b.hP === 0, '사람 발 안 묶임');
  check((gapsOf(a.sE).length === 0 || allNear(gapsOf(a.sE), PLAIN_OLD)) && (gapsOf(b.sE).length === 0 || allNear(gapsOf(b.sE), PLAIN)), 'AI 간격 전 1.44 s → 후 2.4 s (쏜 만큼)');
  check(b.sE.length === 0 || firstAfter(b.sE, PLAIN), 'AI 첫 발 ≥ 공격 가능 + 2.4 s (쐈으면)');
  check(a.sP.every((x) => x.aim === 0) && b.sP.every((x) => x.aim === 0), '사람 조준 보정 없음 (전 · 후)');
  check(b.P.gun?.onTorso === undefined, '사람 몸엔 몸통 셈(onTorso)이 없음 — 사람 쏘기는 그대로');
}

// ⑤ AI 대 AI: 플레이어 자리(index 0)도 AI 가 몰면 곱해진다 — 기본 AI · 마야 모두 2.4
console.log('\n⑤ AI 대 AI — 플레이어 자리 기본 AI(권총) 대 마야(권총) — 30 s · 씨앗 14');
{
  const o = { seed: 14, weapon: 'pistol', ...FOE_MAYA, AI2Class: AI, difficulty2: 'normal' };
  const a = run(o, 30, OLD);
  const b = run(o, 30);
  console.log(`  전 ${line('P 기본 AI', a.sP)}\n      ${line('E 마야', a.sE)}\n  후 ${line('P 기본 AI', b.sP)}\n      ${line('E 마야', b.sE)}`);
  check(b.P.aiControlled && b.P.index === 0, '플레이어 자리(index 0)를 AI 가 몬다');
  check(allNear(gapsOf(a.sP), PLAIN_OLD) && allNear(gapsOf(b.sP), PLAIN), 'P 기본 AI 간격 전 1.44 → 후 2.4 s');
  check((gapsOf(b.sE).length === 0 || allNear(gapsOf(b.sE), MAYA_GAP)) && (gapsOf(a.sE).length === 0 || allNear(gapsOf(a.sE), MAYA_OLD)), 'E 마야 간격 전 2.16 → 후 2.4 s (쏜 만큼)');
  check(firstAfter(b.sP, PLAIN) && (b.sE.length === 0 || firstAfter(b.sE, MAYA_GAP)), '첫 발: P · E 모두 ≥ 공격 가능 + 2.4 s');
  check([...reloadsOf(b.sP), ...reloadsOf(b.sE)].every((x) => near(x, RELOAD)), '장전은 둘 다 8 s');
  check(b.hP > 0 && b.leakP === 0 && b.leakE === 0, 'AI 둘 다 쏘는 동안 묶임 · 묶인 동안 걷기 입력 0');
  check(b.rP.filter((r) => r.pre != null).every((r) => r.pre >= STOP - DT - 1e-9), 'P 기본 AI 도 쏘기 전 0.2 s 멈춤');
}

// ⑥ 자리와 무관: 상대 자리(index 1)를 사람 손이 몰면 곱해지지 않고, 플레이어 자리 AI 는 곱해진다
console.log('\n⑥ 자리 바꿈 — 플레이어 자리 기본 AI(권총) 대 상대 자리 사람 손(권총, 탭) — 24 s · 씨앗 15');
{
  const b = run({ seed: 15, weapon: 'pistol', weapon2: 'pistol', AIClass: Tapper, AI2Class: AI }, 24);
  console.log(`  후 ${line('P AI', b.sP)}\n      ${line('E 사람', b.sE)}`);
  check(b.P.aiControlled && !b.E.aiControlled && b.E.index === 1, '상대 자리(index 1) = 사람 손 · 플레이어 자리 = AI');
  check(allNear(gapsOf(b.sE), HUMAN) && b.hE === 0, '상대 자리 사람 간격 0.8 s · 발 안 묶임 (자리로 곱하지 · 묶지 않음)');
  check(near(gunGap(b.P), PLAIN) && near(gunGap(b.E), HUMAN) && (b.sP.length === 0 || (allNear(gapsOf(b.sP), PLAIN) && firstAfter(b.sP, PLAIN))), `플레이어 자리 AI 간격(gunGap) 2.4 s · 상대 자리 사람 0.8 s (조종하는 쪽으로 — 이 판 AI 는 ${b.sP.length}발)`);
}

// ⑦ 다시 시작 · 새 판: 같은 판을 한 프로세스에서 세 번 — 매번 2.4 s (두 번 곱해 4.8 s 가 되지 않음)
console.log('\n⑦ 다시 시작 · 새 판 — ③ 과 같은 판을 세 번 이어서');
{
  const o = { seed: 12, weapon: 'longsword', ...FOE_MAYA };
  const r = [run(o, 30), run(o, 30), run(o, 30)];
  r.forEach((x, i) => console.log(`  ${i + 1}번째 ${line('마야', x.sE)}`));
  check(r.every((x) => allNear(gapsOf(x.sE), MAYA_GAP)), '세 판 모두 마야 간격 2.4 s');
  check(r.every((x) => JSON.stringify(x.sE) === JSON.stringify(r[0].sE)), '세 판의 발사 기록이 서로 같다 (판 사이에 쌓이는 값 없음)');
}

// ⑧ 무기 바꿈: 새 판마다 상대 무기를 권총 → 롱소드 → 권총 (게임은 무기를 고르면 새 판을 세운다)
console.log('\n⑧ 무기 바꿈 — 기본 AI 상대 무기 권총 → 롱소드 → 권총 (새 판마다) — 24 s · 씨앗 11');
{
  const g1 = run({ seed: 11, weapon: 'longsword', weapon2: 'pistol' }, 24);
  const sw = run({ seed: 11, weapon: 'longsword', weapon2: 'longsword' }, 6);
  const g2 = run({ seed: 11, weapon: 'longsword', weapon2: 'pistol' }, 24);
  console.log(`  권총 ${line('AI', g1.sE)}\n  롱소드 판: 쏜 발 ${sw.sE.length} · 총 상태 ${sw.E.gun ? '있음' : '없음'} · 발 묶인 스텝 ${sw.hE}\n  권총 ${line('AI', g2.sE)}`);
  check(allNear(gapsOf(g1.sE), PLAIN) && allNear(gapsOf(g2.sE), PLAIN), '권총으로 돌아와도 AI 간격 2.4 s');
  check(sw.sE.length === 0 && !sw.E.gun && sw.hE === 0 && sw.hP === 0, '롱소드 판에는 총 상태 · 발 묶음이 생기지 않음');
  check(JSON.stringify(g1.sE) === JSON.stringify(g2.sE), '앞뒤 권총 판의 발사 기록이 같다');
}

// ⑨ 같은 몸에 AI 를 다시 붙여도 (AI 생성자를 세 번) 인물 배율은 1.5 로 덮어쓰기만 하고 간격은 2.4 s
//  (생성자가 성격을 무작위로 굴려 판의 난수 차례가 달라지므로 발사 기록은 견주지 않고 정해진 간격만 본다)
console.log('\n⑨ 같은 몸에 AI 다시 붙이기 — 마야 몸에 AI 생성자를 두 번 더 (몰기는 처음 AI 가 그대로) — 30 s · 씨앗 12');
{
  const o = { seed: 12, weapon: 'longsword', ...FOE_MAYA };
  const b = run(o, 30, NOW, (G) => {
    const ctl = G.enemy.stamina.controller; // 처음 AI (harness 가 판마다 부른다)
    for (let i = 0; i < 2; i++) new AI(G.enemy, G.player, MAYA.ai.level, MAYA.ai.persona);
    G.enemy.stamina.controller = ctl; // 기력 장부의 방어 상태는 처음 AI 를 그대로 본다 (몰기와 같게)
  });
  console.log(`  후 ${line('마야', b.sE)}`);
  check(b.E.gunCooldownK === undefined, '몸에 쌓이는 배율 없음 (AI 를 다시 붙여도 핸디캡은 GUN.aiHandicapK 한 번)');
  check(allNear(gapsOf(b.sE), MAYA_GAP) && (allNear(reloadsOf(b.sE), RELOAD) || reloadsOf(b.sE).length === 0), '간격 2.4 s · 장전 8 s 그대로');
}

console.log(`\n${fails ? `실패 ${fails}줄` : '모두 통과'}`);
process.exitCode = fails ? 1 : 0;
