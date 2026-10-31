// 이탈리아 고유 공격 시험 — 10/31 자리 바꿈 (사장님 10/31 12:xx · 13:xx — docs/strike/italian_swap_2026-10-31.md · config UNIQUE_ASSIST cav* · inq* · imbroDown · cavArmSlow):
//   ① 내려 찌르기(I7 — 임브로카타): 황소 찌르기 긋기와 아래로 가는 긋기(↓ · ↙ · ↘ — 어느 자세 · 높이에서든) 모두 → 탭 찌르기 덧씌우기로 찌른다 · 수평 · 올려 긋기는 그대로
//   ② 칼끝 돌려 빼기(I2 — 기본 고유 공격 · 특수 공격 아님): 칼끼리 실제로 닿은 한 닿음의 처음부터 실제 0.2 s · 마지막 닿음에서 1.2 s 안의 탭 — 이른 탭은 그 닿음의 기회를 없앰 ·
//      내 긋기 동안의 닿음은 셈 밖 · 낸 칼 = 돌려 빼기 운동학 길 · 보통 찌르기 빠르기 · 잔상 · 식힘 없음
//   ③ 헛누름(I8 — 칼끝 돌려 빼기 심화): 돌려 빼는 순간 상대 두 팔 실제 1.2 s 늦춤(흘림 장치) · 익힌 사람만
//   ④ 비껴서며 찌르기(I9 — 특수 공격): 상대 칼이 들어오는 동안 스틱 옆 탭 → 몸 빼기 + 넷째 자세 운동학 찌름(고노센 × 0.3 · 잔상) · 한 공격에 한 번 · 닿음 조건과 겹치면 먼저
//  작게 · 빠르게(사장님): 손으로 기록을 놓는 시험 + 씨앗 하나 판 셋.  node --test tools/sim/cavazione_tap.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { PLAYER_UNIQUE, PlayerUniqueAssist, strokeTechOf, cavTipSpeed } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { drillRun, fightRun } from './special_balance.mjs';
import { classifyStroke } from '../../src/attack_stroke.js';
import { G as PAD } from '../../src/ai_techniques.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { realS, THRUST } = CONFIG;
const it = Object.fromEntries(PLAYER_UNIQUE.italian.map((e) => [e.name, e]));

test('기본값 (10/31): 칼끝 돌려 빼기 = 기본 기술(특수 공격 아님 · 보통 찌르기 빠르기 · 잔상 없음) · 비껴서며 찌르기 = 특수 공격(고노센 × 0.3) · 헛누름 1.2 s · 내려 긋기 67.5°', () => {
  assert.equal(UA.cavTap, 1);
  assert.equal(UA.cavSnap, 1);
  assert.ok(Math.abs(UA.cavFrom - realS(0.2)) < 1e-12 && Math.abs(UA.cavTo - realS(1.2)) < 1e-12, '창 그대로 (사장님 값)');
  assert.equal(UA.cavSpeed, 'tap');
  assert.ok(Math.abs(cavTipSpeed() - (THRUST.reach + THRUST.chamber) / THRUST.extend) < 1e-12, '탭 찌르기가 칼 선을 따라 뻗는 빠르기');
  assert.equal(UA.cavSide, 'contact');
  assert.ok(Math.abs(UA.cavArmSlow - realS(1.2)) < 1e-12, "헛누름 — 사장님 '1.2초로 할게'");
  assert.equal(UA.cavArmSlowAi, 1);
  assert.equal(UA.inqTap, 1);
  assert.ok(Math.abs(UA.inqThreat - realS(0.25)) < 1e-12);
  assert.equal(UA.specialShare.inquartata, 0.3); // 10/31 16:xx 감독 판단(사장님 위임 — 확인표 3217)
  assert.equal(UA.imbroDown, 67.5);
  assert.ok(!it.cavazione.special && it.cavazione.tapKey === 'cav' && !it.cavazione.on.length, '칼끝 돌려 빼기 — 탭으로만 · 특수 공격 아님');
  assert.ok(it.inquartata.special && it.inquartata.tapKey === 'inq' && !it.inquartata.on.length && !it.inquartata.stick, '비껴서며 찌르기 — 탭으로만 · 특수 공격');
  assert.deepEqual([it.imbroccata.stage, it.cavazione.stage, it.inquartata.stage], [1, 2, 3], 'AI 단계 = 칸 깊이 (d 2 · 3 · 4)');
  assert.ok(it.imbroccata.on.some((c) => c.tech === 'stichOchs') && it.imbroccata.on.some((c) => c.down && !c.tech));
});

/** 사람 레이피어 몸 + 막기 단추 + 연 고유 공격 (판을 돌리지 않음 — 닿음 기록 · 위협을 손으로 놓고 탭을 부름) */
function body(names = ['cavazione'], { kit = null } = {}) {
  const G = newRound({ walls: true, seed: 3, weapon: 'rapier', weapon2: 'longsword' });
  const P = G.player;
  const guard = new PlayerParryGuard(P, G.enemy);
  P.stamina.controller = guard;
  if (kit) P.skillKit = kit;
  const uq = new PlayerUniqueAssist(P, { names: new Set(names) });
  for (let i = 0; i < 3; i++) G.step();
  uq.t = 10;
  /** 칼끼리 닿음: age 초 전에 처음 · last 초 전에 마지막 (cut = 내 긋기 동안) */
  const touch = (age, last = 0.05, cut = false) => (uq.touch = { t0: uq.t - age, t1: uq.t - last, cut, cavSpent: false, n: null, steps: 3 });
  const tap = (name = 'cavazione') => {
    P.skill.tap = null; // 앞 탭은 끝났다고 둠 (판을 돌리지 않으므로)
    P.iai = null;
    P.iaiReq = null;
    uq.tapRec = null;
    const n0 = uq.stats.fired[name] ?? 0;
    P.skill.thrust();
    return (uq.stats.fired[name] ?? 0) > n0;
  };
  const wait = (s) => (uq.t += s);
  return { G, P, uq, guard, touch, tap, wait, free: () => G.world.free() };
}

test('② 칼끼리 닿음 처음부터 실제 0.5 s 의 탭 = 칼끝 돌려 빼기 (돌려 빼기 운동학 길 · 보통 찌르기 빠르기 · 잔상 없음 · 상한 없음 · 탭 찌르기 박자 · 기력 = 찌르기) · 한 닿음에 한 번', () => {
  const B = body();
  try {
    B.touch(realS(0.5));
    const st0 = B.P.stamina.value;
    assert.equal(B.tap(), true);
    const R = B.P.iaiReq;
    assert.ok(R?.combo, '운동학 찌름 요청');
    assert.equal(R.tech, 'cavazione');
    assert.ok(Math.abs(R.speed - cavTipSpeed()) < 1e-9 && R.noArc, '보통 찌르기 빠르기 · 잔상 없음');
    assert.equal(R.maxT, 0, '길 끝(거둠)까지');
    assert.ok(R.moves[0].same && R.moves[0].artThrust && R.moves[0].dyn.under && R.moves[0].dyn.tapTiming && R.moves[0].plane);
    assert.equal(R.selfFree, UA.cavSelfFree, '넘어짐 고침 (cavSelfFree — 그 수 동안 칼 어깨 면 밧줄 뗌)');
    assert.ok(B.P.skill.tap == null, '보통 탭 찌르기는 없음');
    const costCav = st0 - B.P.stamina.value;
    assert.equal(B.uq.coolT.cavazione, undefined, '식힘 없음');
    const st1 = B.P.stamina.value;
    assert.equal(B.tap(), false, '한 닿음에 한 번');
    assert.ok(B.P.skill.tap, '두 번째 탭은 보통 탭 찌르기');
    const costTap = st1 - B.P.stamina.value;
    assert.ok(costCav > 0 && Math.abs(costCav - costTap) < 0.5, `기력 = 보통 탭 찌르기 하나 (${costCav.toFixed(2)} · 탭 ${costTap.toFixed(2)})`);
    B.touch(realS(2.0), realS(0.3)); // 길게 맞댄 닿음 (누름 · 묶음): 처음에서 2 s · 마지막에서 0.3 s — 창 안
    assert.equal(B.tap(), true, '맞댄 채 이어진 닿음');
  } finally {
    B.free();
  }
});

test('② 이른 탭(0.1 s — 그 닿음의 기회를 없앰) · 늦은 탭(마지막 닿음에서 1.3 s) · 내 긋기 동안의 닿음 · 닿음 없음 · 끔(cavTap 0) = 보통 탭', () => {
  const B = body();
  try {
    B.uq.touch = null;
    assert.equal(B.tap(), false, '닿음 없음');
    const E = B.touch(realS(0.1));
    assert.equal(B.tap(), false, '이른 탭');
    assert.ok(E.cavSpent, '이른 탭이 기회를 없앰');
    B.wait(realS(0.4));
    assert.equal(B.tap(), false, '이른 탭 뒤에는 창 안이어도 안 나감');
    B.touch(realS(1.5), realS(1.3));
    assert.equal(B.tap(), false, '늦은 탭');
    B.touch(realS(0.5), 0.05, true);
    assert.equal(B.tap(), false, '내 긋기 동안 닿음 (셈 밖)');
    B.touch(realS(0.5));
    UA.cavTap = 0;
    try {
      assert.equal(B.tap(), false, '끔');
    } finally {
      UA.cavTap = 1;
    }
  } finally {
    B.free();
  }
});

test('② 탭 연타(0.15 s 마다)는 닿음 뒤에도 한 번도 안 나감 · 막기 단추를 쥔 채 친 탭은 나감 (cavHeld)', () => {
  const B = body();
  try {
    B.touch(0.02, 0.02);
    let fired = 0;
    for (let k = 0; k < 12; k++) {
      if (B.tap()) fired++;
      B.wait(realS(0.15));
    }
    assert.equal(fired, 0, '연타');
    B.touch(realS(0.6));
    B.uq.feed(0, 0, 1 / 60, true, false); // 막기 단추를 쥔 채 탭 (탭이 막기를 놓아 줌)
    assert.equal(B.tap(), true, '쥔 채 탭');
  } finally {
    B.free();
  }
});

test('② 닿음 기록 (touchTick — 물리 스텝마다): 칼끼리 닿은 스텝(feel.touching)마다 잇고 · 새로 부딪힘(feel.time 0)이면 새 닿음 · 내 긋기 동안이면 셈 밖 · 상대 칼 쪽 = feel.normal 의 반대', () => {
  const B = body();
  try {
    const fe = B.P.feel;
    const step = (s) => { B.uq.t += s; B.uq.touchTick(); };
    B.uq.touch = null;
    fe.touching = true;
    fe.time = 0;
    fe.normal.set(1, 0, 0);
    step(0.01);
    const C = B.uq.touch;
    assert.ok(C && !C.cut && C.n.x === -1, '새 닿음 · 상대 칼 쪽');
    fe.time = 0.01;
    step(0.01);
    assert.equal(B.uq.touch, C, '이어진 닿음');
    assert.ok(Math.abs(C.t1 - B.uq.t) < 1e-12);
    B.uq.cur = { tech: 'zornhau', kind: 'cut', t0: B.uq.t, dir: [-0.7, -0.7], landed: false, bound: false, tEnd: null, unique: null };
    step(0.01);
    assert.ok(C.cut, '내 긋기 동안 닿음 → 그 닿음 통째로 셈 밖');
    assert.equal(B.uq.stats.touchCut, 1);
    B.uq.cur = { tech: 'stichPflug', kind: 'thrust', t0: B.uq.t, dir: [0, 1], landed: false, bound: false, tEnd: null, unique: null };
    fe.time = 0;
    step(0.01);
    assert.ok(B.uq.touch !== C && !B.uq.touch.cut, '찌르는 긋기 동안의 새 닿음은 셈');
    fe.touching = false;
    B.uq.cur = null;
  } finally {
    B.free();
  }
});

test('③ 헛누름 (I8 · 사장님 1.2 s): 칼끝 돌려 빼기가 나가는 순간 상대 두 팔 늦춤(흘림 장치 flowRecovery) — I8 을 익힌 사람만 (skillKit perk cavazione) · 시뮬 몸(skillKit 없음)은 켬 · 0 = 끔', () => {
  for (const [kit, want] of [[{ perk: new Set(['cavazione']) }, true], [{ perk: new Set() }, false], [null, true]]) {
    const B = body(['cavazione'], { kit });
    try {
      B.touch(realS(0.5));
      const foe = B.G.enemy;
      foe.flowRecovery = null;
      assert.equal(B.tap(), true);
      const R = foe.flowRecovery;
      assert.equal(!!R, want, JSON.stringify(kit && [...kit.perk]));
      if (R) assert.ok(Math.abs(R.duration - realS(1.2)) < 1e-12 && R.floor === CONFIG.FLOW_RECOVERY.floor, '1.2 s · 흘림 바닥 그대로');
    } finally {
      B.free();
    }
  }
  const B = body();
  const v = UA.cavArmSlow;
  UA.cavArmSlow = 0;
  try {
    B.touch(realS(0.5));
    B.G.enemy.flowRecovery = null;
    assert.equal(B.tap(), true);
    assert.equal(B.G.enemy.flowRecovery, null, '끔');
  } finally {
    UA.cavArmSlow = v;
    B.free();
  }
});

test('④ 비껴서며 찌르기: 상대 칼이 들어오는 동안(위협) 스틱 옆 탭 = 특수 공격(고노센 × 0.3 · 잔상 · 몸 빼기 · 몸 꼴은 스틱 쪽) · 스틱 앞 · 위협 없음 = 보통 탭 · 한 공격에 한 번 · 닿음 조건과 함께면 이것이 먼저', () => {
  const B = body(['cavazione', 'inquartata']);
  const cd = UA.specialCooldown;
  UA.specialCooldown = 0;
  try {
    const threat = () => { B.guard.noThreat = 0; B.guard.threatId++; };
    threat();
    B.P.stickX = 0;
    B.P.stickY = 0.9;
    assert.equal(B.tap('inquartata'), false, '스틱 앞');
    B.P.stickX = -0.9;
    B.P.stickY = 0;
    B.guard.noThreat = realS(0.5);
    assert.equal(B.tap('inquartata'), false, '위협 없음');
    threat();
    B.touch(realS(0.5)); // 닿음 조건도 참
    assert.equal(B.tap('inquartata'), true, '스틱 옆 + 위협');
    assert.equal(B.uq.stats.fired.cavazione ?? 0, 0, '비껴서며 찌르기가 먼저');
    const R = B.P.iaiReq;
    assert.ok(R.share === 0.3 && !R.noArc && !(R.speed > 0), '고노센 × 0.3 · 잔상');
    assert.deepEqual(R.moves[0].dyn.void, { lat: -0.3, fwd: 0.15 }, '스틱 쪽(왼) 옆 0.3 · 앞 0.15 (schools.js inquartata step)');
    assert.deepEqual(R.moves[0].bodyPose, [-18, -10, 5, 0.025], '몸 꼴은 디딘 쪽');
    assert.equal(R.maxT, UA.inqSnapTime);
    assert.equal(B.tap('inquartata'), false, '한 공격에 한 번');
    assert.equal(B.uq.stats.fired.cavazione, 1, '그 탭은 닿음 조건으로 칼끝 돌려 빼기');
  } finally {
    UA.specialCooldown = cd;
    B.free();
  }
});

test('① 내려 찌르기 (I7 · 사장님 10/31): 아래로 가는 베기는 어느 자세 · 높이에서든 내려 찌르기 · 수평 · 올려 긋기 · 다른 찌르는 긋기는 그대로 · imbroDown 0 = 황소 찌르기 긋기만', () => {
  const B = body(['imbroccata']);
  try {
    const pick = (start, dir) => {
      const c = classifyStroke(start, dir);
      const cur = { tech: c.tech, kind: c.kind, pad: c.pad, t0: B.uq.t, dir, start, landed: false, bound: false, tEnd: null, unique: null };
      return B.uq.choose(cur, start, dir, B.uq.t)?.e?.name ?? null;
    };
    const n = (x, y) => { const L = Math.hypot(x, y); return [x / L, y / L]; };
    const DOWN = [n(0, -1), n(-1, -1), n(1, -1), n(-0.4, -1), n(1, -0.6)];
    const starts = [PAD.tag, PAD.tagR, PAD.tagL, PAD.ochsR, PAD.ochsL, PAD.langort, PAD.sideR, PAD.sideL, PAD.pflugR, PAD.wechselR, [0.05, 0.05], [-0.3, -0.1]];
    let all = 0, got = 0;
    for (const s of starts) for (const d of DOWN) {
      const c = classifyStroke(s, d);
      if (c.kind !== 'cut' && c.tech !== 'stichOchs' && c.tech !== 'stichOchsL') continue; // 다른 찌르는 긋기(쟁기 · 바보)는 그대로
      all++;
      if (pick(s, d) === 'imbroccata') got++;
    }
    assert.ok(all > 30 && got === all, `아래로 가는 베기 ${got} / ${all}`);
    for (const s of starts) for (const d of [n(1, 0), n(-1, 0), n(-1, 0.3), n(0, 1), n(1, 1), n(-1, 1)]) {
      const c = classifyStroke(s, d);
      if (c.tech === 'stichOchs') continue;
      assert.equal(pick(s, d), null, `수평 · 올려 ${JSON.stringify(s)} ${JSON.stringify(d)}`);
    }
    UA.imbroDown = 0;
    try {
      assert.equal(pick(PAD.tag, n(0, -1)), null, '끔: 정수리 내려 긋기는 보통 긋기');
      assert.equal(pick(PAD.ochsR, n(-0.08 - 0, -0.12)), classifyStroke(PAD.ochsR, n(-0.08, -0.12)).tech === 'stichOchs' ? 'imbroccata' : null, '황소 찌르기 긋기는 그대로');
    } finally {
      UA.imbroDown = 67.5;
    }
  } finally {
    B.free();
  }
});

test('① 내려 찌르기 닿게 (씨앗 1 · 서 있는 상대): 찌른 상처가 남 · 끄면(imbroReach 0) 전 판(칼날 상처 0)', () => {
  const on = drillRun('italian', 1, { foe: 'still', variant: 'on', dur: 14 });
  const stab = on.atts.flatMap((a) => a.hits).filter((h) => h.tech === 'imbroccata' && h.type === 'stab' && h.sev > 0);
  assert.ok(stab.length >= 1, `찌른 상처 ${stab.length}`);
  UA.imbroReach = 0;
  try {
    const off = drillRun('italian', 1, { foe: 'still', variant: 'on', dur: 14 });
    assert.equal(off.atts.flatMap((a) => a.hits).filter((h) => h.sev > 0).length, 0);
  } finally {
    UA.imbroReach = 1;
  }
  assert.equal(typeof strokeTechOf, 'function');
});

test('② 판 (씨앗 901 · 롱소드 AI · 12 s · 칼끼리 닿음을 느끼면 0.25 ~ 0.95 s 뒤 탭하는 손): 실제 닿음 뒤 칼끝 돌려 빼기가 나감 · 셈 밖 닿음은 내 긋기 동안만', () => {
  const r = fightRun('cavTouch', 901, 'longsword', { variant: 'on', dur: 12 });
  assert.ok((r.fired.cavazione ?? 0) >= 1, `나감 ${r.fired.cavazione}`);
  assert.ok(r.it.touches >= r.fired.cavazione && r.it.touchCut <= r.it.touches, JSON.stringify({ touches: r.it.touches, cut: r.it.touchCut }));
  assert.ok(r.it.fires.every((x) => !x || x.E >= 0), '낸 칼 결과');
});

test('② 넘어짐 고침 (cavSelfFree 1 · 확인표 3260): 칼끝 돌려 빼기 수 동안 칼 어깨 면 밧줄을 떼고 끝나면 다시 검 · 0 = 전 판(씨앗 902 츠바이핸더 7.05 s 수 뒤 발 밖 넘어짐)', () => {
  const watch = () => {
    const seen = { during: 0, ropesDuring: 0, after: 0, ropesAfter: 0, was: false };
    const probe = (G, P) => {
      const on = P.iai?.tech === 'cavazione';
      if (on) (seen.during++, P.shoulderRopes && seen.ropesDuring++);
      else if (seen.was) (seen.after++, P.shoulderRopes && seen.ropesAfter++);
      seen.was = on;
    };
    return { seen, probe };
  };
  const a = watch();
  const on = fightRun('cavTouch', 902, 'zweihander', { variant: 'on', dur: 8, probe: a.probe });
  assert.ok(a.seen.during > 0 && a.seen.ropesDuring === 0, `수 동안 밧줄 없음 ${JSON.stringify(a.seen)}`);
  assert.ok(a.seen.after > 0 && a.seen.ropesAfter === a.seen.after, `끝나면 다시 ${JSON.stringify(a.seen)}`);
  const body = (r) => (r.it.knock ?? []).filter((k) => (k.why === 'footing' || k.why === 'tilt') && r.it.fireT.some((t) => k.t >= t && k.t <= t + 0.4));
  assert.equal(body(on).length, 0, JSON.stringify(on.it.knock));
  const sf = UA.cavSelfFree;
  UA.cavSelfFree = 0;
  try {
    const b = watch();
    const off = fightRun('cavTouch', 902, 'zweihander', { variant: 'on', dur: 8, probe: b.probe });
    assert.ok(b.seen.during > 0 && b.seen.ropesDuring === b.seen.during, '전 판: 밧줄 그대로');
    assert.ok(body(off).some((k) => k.why === 'footing'), `전 판: 낸 뒤 발 밖 넘어짐 ${JSON.stringify(off.it.knock)}`);
  } finally {
    UA.cavSelfFree = sf;
  }
});

test('② 세게 하는 시제품 A ~ E (10/31 16:xx 사장님 물음 · 확인표 3263 ~ · 기본 모두 끔): A 빠르기 배 · D 판정 배율 → 요청 · C 상대 반응 묶음(ai.js respond) · E 막기 단추로 거둠 · B 는 combat.js(재기로 봄)', () => {
  assert.deepEqual([UA.cavSpeedMul, UA.cavGap, UA.cavParryLock, UA.cavHitMul, UA.cavCancel], [1, 0, 0, 1, 0], '기본 끔');
  const keep = { cavSpeedMul: UA.cavSpeedMul, cavHitMul: UA.cavHitMul, cavParryLock: UA.cavParryLock, cavCancel: UA.cavCancel };
  const B = body();
  try {
    B.touch(realS(0.5));
    assert.equal(B.tap(), true);
    assert.ok(Math.abs(B.P.iaiReq.speed - cavTipSpeed()) < 1e-9 && B.P.iaiReq.hitMul === 1 && B.G.enemy.parryLockUntil == null, '끔 = 지금 판');
    Object.assign(UA, { cavSpeedMul: 1.5, cavHitMul: 1.3, cavParryLock: realS(0.2), cavCancel: 1 });
    B.touch(realS(0.5));
    assert.equal(B.tap(), true);
    const R = B.P.iaiReq;
    assert.ok(Math.abs(R.speed - 1.5 * cavTipSpeed()) < 1e-9, `A 빠르기 × 1.5 (${R.speed})`);
    assert.equal(R.hitMul, 1.3, 'D 판정 배율');
    const E = B.G.enemy;
    assert.ok(Math.abs(E.parryLockUntil - (E.fightT + realS(0.2))) < 1e-9, 'C 묶음 끝 = 낸 때 + 실제 0.2 s');
    const ai = B.G.ai;
    const seen = ai.threatSeen;
    assert.equal(ai.respond({ id: 9999, line: 'high', thrust: true }, 1.2), false, 'C 묶인 동안 반응 못 함');
    assert.equal(ai.threatSeen, seen, 'C 이 위협은 묶음이 풀린 뒤 다시 봄');
    // E: 끄는 동안 막기 단추를 새로 누르면 그 스텝에 거둠
    B.guard.held = false;
    B.G.step();
    assert.equal(B.P.iai?.tech, 'cavazione', '끄는 칼 시작');
    B.guard.held = true;
    B.uq.drive(DT);
    assert.equal(B.uq.stats.cavCancel, 1, 'E 거둠');
    B.G.step();
    assert.equal(B.P.iai, null, 'E 그 스텝 자리에서 끝');
  } finally {
    Object.assign(UA, keep);
    B.free();
  }
});

test('①② 탭이 걸어 맞추기 판(무릎 꿇은 상대 약한 자리 — skill.thrust 가 참이어도 탭이 아직 없음)이면 이름을 달지 않고 넘어감 (10/28 싸움 재기에서 떨어진 오류)', () => {
  const B = body(['imbroccata', 'cavazione']);
  try {
    const real = B.P.skill.thrust.bind(B.P.skill);
    B.P.skill.thrust = (o = {}) => (o.uniq === false ? true : real(o)); // 걸어 맞추기 판: 참 · 탭 없음
    const e = B.uq.list.find((x) => x.name === 'imbroccata');
    assert.doesNotThrow(() => B.uq.start(e, { tech: 'stichOchs', kind: 'thrust', t0: B.uq.t, dir: [0, -1], start: [0.2, 0.3], landed: false, bound: false, tEnd: null, unique: null }, 1));
    const snap = UA.cavSnap;
    UA.cavSnap = 0; // 운동학 칼 없이 — 탭 찌르기 덧씌우기 갈래
    try {
      B.touch(realS(0.5));
      assert.doesNotThrow(() => B.uq.tapChain());
    } finally {
      UA.cavSnap = snap;
    }
  } finally {
    B.free();
  }
});
