// 간격과 박자 · 오코리 시험 (11/17 · config MEASURE · OKORI · src/ai_measure.js · 기록 docs/strike/measure_okori_2026-11-17.md · 옮긴 기록 docs/strike/ae_port_2026-11-17.md):
//  [사장님 11/17 결정] 기본 판 — 켜고 끄는 칸 없음 · 값이 사다리 위 · 선(유파 여유 · 독일 칼 붙음) · 오코리(띠 크기 · 베기 반대쪽 · 이미 실린 자세 · 칼이 이미 움직이는 공격 빼기) · 판에서 쓰임 ·
//  사람 몸에는 오코리 덧씌우기 · 늦춤이 없고 AI 는 사람 손의 느린 감기(나)를 늦게 본 눈으로 읽음.
//  node --test tools/sim/measure_okori.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { msLine, msHold, msFeetV, msRead, msDebanaTick, okoriStart, okoriFrom, okoriCue } from '../../src/ai_measure.js';

const M = CONFIG.MEASURE;
const O = CONFIG.OKORI;
/** 가짜 AI (선 · 오코리 셈만 읽는 칸) */
function fake(o = {}) {
  return {
    proficiency: 4, art: { tradition: 'german' }, foeReach: 1.7, chasing: false, Mup: null, drillOut: false, me: { armed: true, handOffset: { x: 0, y: 0 } },
    sense: { t: 10 }, stats: {}, M: { reach: 1.8 }, d: 1.9, phase: 'windup', tech: { kind: 'cut', from: [0.02, 0.52], path: [[0, 0.14], [-0.02, -0.5]] }, ...o,
  };
}

test('기본 판 · 켜고 끄는 칸 없음 · 값 (시간 사다리 0.2 · 0.4 · 0.6 s · 걸음 사다리)', () => {
  assert.equal('on' in M, false, '사장님 11/17 — 기본 판 (스위치 없음)');
  assert.equal('on' in O, false, '사장님 11/17 — 기본 판 (스위치 없음)');
  const L = CONFIG.realS(1);
  assert.deepEqual(O.T.map((x) => +(x / L).toFixed(6)), [0.6, 0.6, 0.4, 0.2], '띠마다 몸 시작 시간 — 사다리 위');
  assert.deepEqual(O.amp.map((x) => +x.toFixed(4)), [1, 1, 0.6667, 0.3333], '크기 — 낮음이 크고 높음이 작음');
  assert.deepEqual(O.see, [0.6, 0.6, 0.4, 0.2]);
  assert.ok(O.turn === 0.35 && O.lean === 0.05 && O.drop === 0.03 && O.front === 0.15 && O.lift === 0.15 && O.hand === 1.4 && O.read === 1 && O.windV === 1.3, JSON.stringify(O));
  assert.ok(M.gap.italian === 0 && M.gap.chinese === 0 && M.gap.other === 0.15 && M.deep === 0.15 && M.step === 0.6 && M.inside === 1 && M.read === 1 && M.debana === 1 && M.out === 1, JSON.stringify(M));
  assert.ok(Math.abs(M.bindT / L - 0.2) < 1e-9);
});

test('선: 상대 칼끝 어림 + 유파 여유 · 독일은 칼이 붙어 있는 동안 선 없음 · 간 보기 바닥 · 기어 들지 않음', () => {
  assert.equal(msLine(fake({ art: { tradition: 'italian' } })), 1.7);
  assert.equal(msLine(fake({ art: { tradition: 'chinese' } })), 1.7);
  assert.ok(Math.abs(msLine(fake({ art: { tradition: 'japanese' } })) - 1.85) < 1e-9);
  assert.ok(Math.abs(msLine(fake()) - 1.85) < 1e-9);
  assert.equal(msLine(fake({ msBindT: 10 })), -Infinity, '독일 — 칼이 방금 붙음');
  assert.ok(msLine(fake({ msBindT: 10 - 2 * M.bindT })) > 0, '독일 — 붙은 지 오래');
  assert.equal(msLine(fake({ chasing: true })), -Infinity, '빈손 상대 쫓기');
  assert.ok(Math.abs(msHold(fake(), 1.5) - 1.93) < 1e-9, '바닥 = 선 + 0.08');
  assert.equal(msHold(fake(), 2.2), 2.2);
  assert.equal(msFeetV(fake(), 0.18, 1.9), 0, '선 + 0.08 안 — 앞으로 안 감');
  assert.equal(msFeetV(fake(), -0.3, 1.9), -0.3, '물러남은 그대로');
  assert.equal(msFeetV(fake(), 0.18, 2.1), 0.18, '선 밖 — 그대로');
});

test('오코리: 띠 크기 · 베기 반대쪽 · 이미 실린 자세는 높은 띠가 감지 않음 · 칼이 이미 움직이는 공격은 없음', () => {
  // 손이 멀리(가운데) · 정수리 베기(위 → 아래): 손은 준비 자리 너머 위로
  const lo = fake({ proficiency: 1 });
  okoriStart(lo, {});
  assert.ok(lo.okori && lo.okori.A === 1 && Math.abs(lo.okori.T - O.T[1]) < 1e-12 && lo.okori.by > 0.14 && !lo.okori.loaded, JSON.stringify(lo.okori));
  const hi = fake({ proficiency: 6 });
  okoriStart(hi, {});
  assert.ok(hi.okori.A < 0.34 && hi.okori.T < lo.okori.T && hi.okori.by < lo.okori.by, '높은 띠 — 작고 짧게');
  const F = okoriFrom(lo, lo.tech.from);
  assert.ok(Math.hypot(F[0], F[1]) <= 0.6 + 1e-9, '손 목표 한도 안');
  // 이미 준비 자리 (실린 자세): 높은 띠 = 너머 몫 0 · 낮은 띠 = 그래도 감음
  const hiL = fake({ proficiency: 6, me: { armed: true, handOffset: { x: 0.02, y: 0.52 } } });
  okoriStart(hiL, {});
  assert.ok(hiL.okori.loaded && hiL.okori.by === 0 && hiL.okori.bx === 0, '높은 띠 — 이미 실린 자세에서 곧장');
  const loL = fake({ proficiency: 1, me: { armed: true, handOffset: { x: 0.02, y: 0.52 } } });
  okoriStart(loL, {});
  assert.ok(loL.okori.loaded && loL.okori.by > 0, '낮은 띠 — 그래도 감음');
  // 가로베기(오른쪽 → 왼쪽): 몸통은 칼 든 쪽(+)으로 감음
  const zw = fake({ tech: { kind: 'cut', from: [0.52, 0.06], path: [[0, 0.1], [-0.52, 0.06]] } });
  okoriStart(zw, {});
  assert.ok(zw.okori.yaw > 0.9 && zw.okori.bx > 0, '가로베기 — 오른쪽으로 감음');
  for (const opt of [{ chain: 1 }, { secret: true }, { skipChamber: true }, { drill: true }]) {
    const a = fake();
    okoriStart(a, opt);
    assert.equal(a.okori, null, JSON.stringify(opt));
  }
});

test('오코리 읽기: 띠 문턱 (높은 띠가 더 작은 몸 시작도 봄) · 느린 감기도 낌새', () => {
  const s = { okori: 0.3, hx: 0.2, hy: 0.2, hvx: 0, hvy: 0, tvx: 0, tvy: 0, tvz: 0 };
  assert.equal(okoriCue(fake({ proficiency: 6 }), s), true, '높은 띠 — 0.3 을 봄 (문턱 0.2 · 기울기 1)');
  assert.equal(okoriCue(fake({ proficiency: 2 }), s), false, '낮은 띠 — 0.3 은 못 봄 (문턱 0.6)');
  const w = { okori: 0, hx: 0.3, hy: 0.3, hvx: 1.2, hvy: 1.2, tvx: 1, tvy: 0, tvz: 0 };
  assert.equal(okoriCue(fake({ proficiency: 2 }), w), true, '손이 바깥으로 1.7 m/s · 칼끝 느림 — 감기');
  assert.equal(okoriCue(fake({ proficiency: 2 }), { ...w, tvx: 5 }), false, '칼끝이 빠르면 휘두름 (위협 눈 몫)');
});

test('판에서 쓰임 (오코리 시작 · 몸 덧씌우기 · 보이는 크기 · 박자 걸음)', () => {
  const G = newRound({ seed: 2, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 2 }, persona2: { proficiency: 4 } });
  let vis = 0, body = 0;
  try {
    while (G.t < 30 && G.player.alive && G.enemy.alive) {
      G.step();
      vis = Math.max(vis, G.enemy.okoriVis, G.player.okoriVis);
      if (G.enemy.okoriBody || G.player.okoriBody) body++;
    }
    const ms = [G.ai.stats.ms, G.ai2.stats.ms];
    assert.ok(ms[0] && ms[1], '재기 칸');
    assert.ok(ms[0].okori + ms[1].okori > 0, '오코리 시작');
    assert.ok(ms[0].tempo + ms[1].tempo > 0, '박자 걸음');
    assert.ok(vis > 0.3 && body > 0, `보이는 크기 ${vis} · 덧씌운 스텝 ${body}`);
  } finally {
    G.world.free();
  }
});

// 사장님 11/17 'A~E' 의 D — AI 는 사람의 실제 감기를 읽음: 사람 몸에는 오코리 덧씌우기 · 입력 늦춤이 없고, AI 는 사람 몸이 실제로 보이는 것만
//  (느린 감기 (나) · 칼 듦 · 걸음)을 늦게 본 눈(sense.seen — 반응 지연)으로 읽는다. 사람 자리 = 하네스 플레이어(AI 없이 손 목표 handOffset 을 손가락처럼 옮김)
test('사람 손의 느린 바깥 감기를 AI 가 늦게 본 눈으로 읽음 (오코리 읽기 (나)) · 사람 몸엔 오코리 없음', () => {
  const run = (wind) => {
    const G = newRound({ seed: 1, walls: true, weapon: 'longsword', weapon2: 'longsword', persona: { proficiency: 4 } });
    const P = G.player, ai = G.ai;
    const t0 = 2.0, v = 1.5, T = 0.5; // 손가락을 왼쪽(자세 바깥)으로 1.5 m/s · 0.5 s — 휘두르기 문턱(SKILL.swingSpeed 1.5) 언저리의 느린 감기
    G.before = (t) => { if (wind && t >= t0 && t < t0 + T) P.handOffset.x -= v * CONFIG.PHYSICS.timestep; };
    let n0 = 0, live = null, eye0 = null, maxVis = 0, maxSeenOk = 0, body = 0;
    try {
      while (G.t < t0 + 1.2) {
        G.step();
        const c = ai.stats.ms?.chamberSeen ?? 0;
        if (G.t < t0) n0 = c;
        else if (live == null && c > n0) live = G.t - t0; // AI 가 제 판단 길(preThreat → okoriCue)에서 처음 본 때
        if (G.t >= t0 && eye0 == null && okoriCue({ proficiency: 4, stats: {} }, ai.sense.seen(0))) eye0 = G.t - t0; // 지연 없는 눈이라면 본 때 (견줌)
        maxVis = Math.max(maxVis, P.okoriVis);
        maxSeenOk = Math.max(maxSeenOk, ai.sense.seen(0).okori);
        if (P.okoriBody || P.okoriFront) body++;
      }
      return { live, n: (ai.stats.ms?.chamberSeen ?? 0) - n0, eye0, lag: ai.level.reaction, maxVis, maxSeenOk, body, human: !P.aiControlled && !G.ai2 };
    } finally {
      G.world.free();
    }
  };
  const off = run(false);
  assert.equal(off.n, 0, '감지 않으면 낌새 없음');
  const on = run(true);
  assert.ok(on.human, '사람 자리 (AI 없음)');
  assert.ok(on.n > 0 && on.live != null, `AI 판단 길에서 사람의 느린 감기를 봄 ${JSON.stringify(on)}`);
  assert.ok(on.eye0 != null && on.live >= on.eye0 + on.lag - 0.02, `늦게 본 눈 — 지연 ${on.lag} s 뒤에 봄 (${on.eye0} → ${on.live})`);
  assert.ok(on.maxVis === 0 && on.maxSeenOk === 0 && on.body === 0, '사람 몸엔 오코리 덧씌우기 · 무게 옮김 · 보이는 크기 없음');
});

// 사장님 11/17 '데바나 살려' — 걸음에 치기: 들어옴 읽기(read × 띠 기울기)가 나오고 상대가 내 칼끝 + 0.3 안이면 줄 닫기 앞에 debana × 띠 기울기로 그 걸음에 침 ·
//  안 나오면 줄 닫기 · 아직 멀면 줄 닫기 (가지 코드에선 줄 닫기가 늘 먼저라 닿지 않던 갈래)
test('걸음에 치기: 칼 든 AI 는 칼끝 + 0.3 안으로 걸어 드는 상대를 띠 기울기만큼 그 걸음에 침 · 아니면 줄 닫기 · 멀면 줄 닫고 칼끝 안에 들 때 한 번 더 · 준비 없는 칼', () => {
  const G = newRound({ seed: 3, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 4 }, persona2: { proficiency: 4 } });
  try {
    while (G.t < 1) G.step();
    const ai = G.ai;
    ai.mind = null; // 유파 마음가짐 (11/18): 독일 거리 1 의 선(gap −0.2)은 상대 칼끝 안 — '칼끝 + 0.3 밖 · 선 + 0.3 안' 띠가 없음. 이 셈 시험은 옛 선(MEASURE.gap 0.15 — 마음가짐 없는 몸)으로
    const L = msLine(ai);
    const dIn = Math.min(ai.M.reach + 0.2, L + 0.25);
    const dFar = ai.M.reach + 0.35;
    assert.ok(L > 0 && dIn < ai.M.reach + 0.3 && dIn < L + 0.3 && dFar < L + 0.3, `선 ${L} · 칼끝 ${ai.M.reach}`);
    const s0 = { ...ai.lastSeen, state: 'stand', armed: true };
    const trial = (d) => {
      ai.mode = 'watch';
      ai.phase = 'ready';
      ai.icpPre = ai.icp = false;
      ai.okori = null;
      ai.dbn = null;
      ai.msArmed = true; // 들어옴 하나 (걸쇠 새로)
      ai.foeClosing = 1.0; // 늦게 본 상대 골반이 1 m/s 로 다가옴
      const took = msRead(ai, s0, d, 1 / 120, 1);
      return !took ? 'none' : ai.mode === 'attack' ? 'strike' : ai.mode === 'defend' && ai.icpPre ? 'close' : 'other';
    };
    const near = { none: 0, strike: 0, close: 0, other: 0 };
    const far = { none: 0, strike: 0, close: 0, other: 0 };
    for (let i = 0; i < 40; i++) near[trial(dIn)]++;
    for (let i = 0; i < 20; i++) far[trial(dFar)]++;
    assert.ok(near.strike > 0 && near.close > 0 && near.other === 0, `칼끝 안 — 칠 때도 줄 닫을 때도 (가운데 띠 ⅔ · ⅔) ${JSON.stringify(near)}`);
    assert.ok(far.strike === 0 && far.close > 0 && far.other === 0, `칼끝 + 0.3 밖 — 줄 닫기만 ${JSON.stringify(far)}`);
    assert.equal(ai.why, 'stepin');
    const S = ai.stats.ms;
    assert.ok(S.debana === near.strike && S.debanaRoll === near.strike + near.close, JSON.stringify(S));
    // 칼끝 + 0.3 밖에서 줄을 닫은 들어옴은 상대가 칼끝 + 0.3 안에 들 때 한 번 더 — 들어옴 하나에 굴림 하나 (감독 11/17 — '데바나 살려' 안에서)
    const late = { strike: 0, close: 0, twice: 0 };
    for (let i = 0; i < 40; i++) {
      const r = trial(dFar);
      if (r === 'none') continue; // 들어옴 읽기(read × 띠 기울기)가 안 나옴 — 반응 없음 (그대로)
      assert.equal(r, 'close');
      assert.ok(ai.dbn && !ai.dbn.rolled, '열린 들어옴 · 아직 안 굴림');
      const hit = msDebanaTick(ai, s0, dIn, 1 / 120, null, 1);
      late[hit ? 'strike' : 'close']++;
      if (hit) {
        assert.ok(ai.mode === 'attack' && ai.why === 'stepin' && ai.okori === null && ai.phase === 'approach', '준비 없는 칼 — 오코리 없음 · 곧장 다가감');
        ai.mode = 'defend';
        ai.icpPre = true;
      }
      if (msDebanaTick(ai, s0, dIn, 1 / 120, null, 1)) late.twice++;
    }
    assert.ok(late.strike > 0 && late.close > 0 && late.twice === 0, `칼끝 안에 들 때 굴림 · 한 번만 ${JSON.stringify(late)}`);
    // 그친 들어옴은 닫힘 (상대가 다가오지 않은 채 rearm 넘게)
    while (trial(dFar) !== 'close');
    ai.foeClosing = 0;
    msDebanaTick(ai, s0, dFar, 0.6, null, 0.5);
    msDebanaTick(ai, s0, dFar, 0.6, null, 0.5);
    assert.equal(ai.dbn, null, '그친 들어옴 닫힘');
  } finally {
    G.world.free();
  }
});

test('걸음에 치기 — 덮은 채 걸어 듦(미리 줄 닫기 anticStep)도: 줄을 닫은 뒤 칼끝 + 0.3 안에 들면 굴림', () => {
  // 상대(플레이어 자리)가 더 긴 칼 — 덮은 들어옴을 내 칼끝 + 0.3 밖에서 봄 (같은 칼이면 상대 칼끝 어림 + 0.3 이 곧 내 칼끝 + 0.3 이라 처음 볼 때 이미 안)
  const G = newRound({ seed: 4, walls: true, weapon: 'zweihander', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 6 }, persona2: { proficiency: 6 } });
  try {
    while (G.t < 1) G.step();
    const ai = G.ai;
    const c = ai.me.bodies.chest.translation();
    const f = ai.me.forward();
    const s = { ...ai.lastSeen, tx: c.x + f.x * 0.6, ty: c.y, tz: c.z + f.z * 0.6, mx: c.x + f.x * 0.9, my: c.y, mz: c.z + f.z * 0.9, tvx: 0, tvy: 0, tvz: 0, mvx: 0, mvy: 0, mvz: 0, state: 'stand', armed: true };
    assert.ok(ai.foeClass(s).online, '상대 칼끝이 나를 겨눔 (덮은 채)');
    ai.mode = 'watch';
    ai.dbn = null;
    ai.anArmed = true;
    ai.foeClosing = 1.0;
    const dFar = ai.M.reach + 0.35;
    assert.ok(dFar < ai.foeReach + 0.3, `상대 칼끝 어림 + 0.3 안 ${dFar} · ${ai.foeReach}`);
    assert.equal(ai.anticStep(s, dFar, 1 / 120), true, '높은 띠 — 줄 닫기 굴림 늘');
    assert.ok(ai.mode === 'defend' && ai.icpPre && ai.dbn && !ai.dbn.rolled, '줄을 미리 닫고 들어옴 열림');
    assert.equal(msDebanaTick(ai, s, ai.M.reach + 0.1, 1 / 120, null, 1), true, '높은 띠 — 칼끝 안에 들면 늘 침');
    assert.ok(ai.mode === 'attack' && ai.why === 'stepin' && ai.okori === null);
    assert.equal(ai.stats.ms.debanaLate, 1);
  } finally {
    G.world.free();
  }
});
