// 탭 고유 동작 셋 — AI 도 사람 탭과 같은 운동학 칼 (11/19 사람 · AI 같게 A9 · 기록 docs/strike/human_ai_parity_2026-11-19.md):
//  unique_assist.js tapArt 하나를 사람 launchTap 과 AI ai.js artGo 가 부른다 · 언제 내나는 AI 판단 그대로(빼서 찌르기 패시브 · 속임) · 못 내면 옛 길
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { TAP_ART } from '../../src/unique_assist.js';

function aiOf(prof, weapon2, fn) {
  const G = newRound({ seed: 1, weapon: 'longsword', weapon2, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: 3 } });
  try { return fn(G.ai, G); } finally { G.world.free(); }
}
/** 운동학 칼이 끝날 때까지 (끝나면 다음 스텝에 뒤따름) */
function runOut(ai, G, lim = 240) {
  const me = ai.me;
  let k = 0;
  while ((me.iai || me.iaiReq) && k++ < lim) G.step();
  assert.ok(k < lim, '칼이 끝남');
  G.step();
  assert.ok(ai.artRun === false && ai.phase !== 'strike', '끝나면 뒤따름으로');
}

test('TAP_ART 이름 = 사람 탭 고유 동작 이름', () => {
  assert.deepEqual(TAP_ART, { cav: 'cavazione', lian: 'lianchi', dup: 'duplieren' });
});

test('칼끝 돌려 빼기 — 빼서 찌르기 패시브(맞물린 뒤)가 내는 칼 = 사람 탭과 같은 운동학 찌름 (상대 칼 밑 · 이름 cavazione) · 끔(enhance 0)이면 옛 길', () => {
  aiOf(4, 'rapier', (ai, G) => {
    const me = ai.me;
    for (let k = 0; k < 20; k++) G.step();
    const t = ai.school.techByName.stichPflug;
    assert.ok(t, '쟁기 찌르기');
    assert.ok(ai.startAttack(t, 'riposte', { noFeint: true, skipChamber: true, passive: true }));
    ai.passiveAtk = 'cavazione'; // passiveFired 가 적는 이름
    const st0 = me.stamina.value;
    ai.startStrike();
    const R = me.iaiReq ?? me.iai;
    assert.ok(R, '운동학 칼 부탁');
    assert.equal(R.tech, 'cavazione', '같은 이름');
    assert.equal(ai.phase, 'strike');
    assert.equal(ai.artRun, true);
    assert.equal(ai.stats.tapArt.cav.fired, 1);
    assert.equal(ai.path.length, 0, '패드 길 없음');
    assert.ok(me.stamina.value < st0 || me.stamina.infinite, '찌르기 기력');
    runOut(ai, G);
  });
  const UA = CONFIG.UNIQUE_ASSIST;
  const e0 = UA.enhance;
  UA.enhance = 0;
  try {
    aiOf(4, 'rapier', (ai, G) => {
      for (let k = 0; k < 20; k++) G.step();
      assert.ok(ai.startAttack(ai.school.techByName.stichPflug, 'riposte', { noFeint: true, skipChamber: true, passive: true }));
      ai.passiveAtk = 'cavazione';
      ai.startStrike();
      assert.ok(!ai.me.iaiReq && !ai.me.iai && !ai.artRun, '끔 — 운동학 칼 없음');
      assert.ok(ai.path.length > 0, '옛 패드 길');
    });
  } finally {
    UA.enhance = e0;
  }
});

test('칼끝 돌려 빼기 속임 — 가짜 칼(황소 찌르기 앞몫) 뒤 진짜 칼 = 같은 운동학 찌름', () => {
  aiOf(4, 'rapier', (ai, G) => {
    const me = ai.me;
    for (let k = 0; k < 20; k++) G.step();
    const fe = ai.school.feints.find((f) => f.name === '칼끝 돌려 빼기 (카바치오네)');
    assert.ok(fe, '꾸러미에 속임');
    assert.ok(ai.startAttack(ai.school.techByName[fe.fake], 'counter', { noFeint: true, skipChamber: true }));
    ai.feint = fe;
    ai.startStrike();
    assert.equal(ai.feintPts, 1, '가짜 칼 먼저');
    let k = 0;
    while (!ai.stats.tapArt?.cav?.fired && k++ < 120) ai.moveHand(1 / 120);
    assert.equal(ai.stats.tapArt.cav.fired, 1, '가짜 칼 뒤 냄');
    assert.equal((me.iaiReq ?? me.iai)?.tech, 'cavazione');
    assert.equal(ai.path.length, 0, '속임 뒤 패드 길 없음');
  });
});

test('날개 접기 속임 — 가짜 칼(쟁기 찌르기 앞몫) 뒤 진짜 칼 = 사람 탭과 같은 운동학 허리 베기 (이름 lianchi · 특수 공격 식힘은 칼이 나갈 때)', () => {
  aiOf(5, 'hwando', (ai, G) => {
    const me = ai.me;
    for (let k = 0; k < 20; k++) G.step();
    const fe = ai.school.feints.find((f) => f.name === '날개 접기 (염시)');
    assert.ok(fe, '꾸러미에 속임 (숙련 5)');
    assert.ok(ai.startAttack(ai.school.techByName[fe.fake], 'counter', { noFeint: true, skipChamber: true }));
    ai.feint = fe;
    ai.startStrike();
    assert.equal(ai.stats.specials?.lianchi, 1, '특수 공격 셈 (startStrike — 속임)');
    let k = 0;
    while (!ai.stats.tapArt?.lian?.fired && k++ < 120) ai.moveHand(1 / 120);
    assert.equal(ai.stats.tapArt.lian.fired, 1, '가짜 칼 뒤 냄');
    assert.equal((me.iaiReq ?? me.iai)?.tech, 'lianchi');
    assert.equal(ai.path.length, 0, '속임 뒤 패드 길 없음');
    assert.equal(ai.artRun, true);
    runOut(ai, G);
  });
});

test('겹치기 — 고른 겹치기 칼 = 사람과 같은 운동학 칼 (이름 duplieren · 특수 공격 식힘) · 칼이 맞물리지 않았으면 고르지 않음', () => {
  aiOf(4, 'longsword', (ai, G) => {
    const me = ai.me;
    for (let k = 0; k < 20; k++) G.step();
    const t = ai.school.techByName.duplieren;
    assert.ok(t, '꾸러미에 겹치기 (숙련 4)');
    const s = ai.sense.seen(0);
    const pick = (bound, d, n = 300) => {
      const fd = me.foeDistance;
      me.foeDistance = () => d;
      ai.bound = bound;
      me.feel.touching = false;
      try {
        let c = 0;
        for (let k = 0; k < n; k++) if (ai.pickTech(s, 'follow')?.name === 'duplieren') c++;
        return c;
      } finally {
        me.foeDistance = fd;
      }
    };
    assert.equal(pick(false, 1.2), 0, '맞물림 없음 — 안 고름');
    assert.equal(pick(true, 2.4), 0, '맞물렸어도 겹치기 띠(가슴 사이 1.6 m) 밖 — 안 고름');
    assert.ok(pick(true, 1.2) > 0, '맞물림 · 띠 안 — 고를 수 있음');
    ai.bound = true;
    assert.ok(ai.startAttack(t, 'follow', { noFeint: true, skipChamber: true }));
    ai.startStrike();
    assert.equal((me.iaiReq ?? me.iai)?.tech, 'duplieren', '같은 이름 운동학 칼');
    assert.equal(ai.stats.tapArt.dup.fired, 1);
    assert.equal(ai.stats.specials?.duplieren, 1, '특수 공격 셈');
    assert.equal(ai.path.length, 0, '패드 길 없음');
    runOut(ai, G, 600); // 이 시험은 5.6 m 에서 냄 — 앞 박차기(dupBurst)가 죽음의 일격 거리까지 가서 벰
  });
});
