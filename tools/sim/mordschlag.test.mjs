// 독일 비기 죽음의 일격 (모르트슐라크 · 10/22 사장님 '독일은 죽음의 일격으로 하자' · '1.5로 해' · 사람 먼저 — src/mordschlag.js · docs/strike/german_mordschlag_2026-10-22.md).
// 조건(밀치기 누르기 이어짐 → 창) · 사람 몫만(AI 비기 그대로) · 칼날 거꾸로 쥐기(손목 관절 · 원래 쥠으로) · 비기 흐름(준비 → 베기 → 다시 세우기 → 굳음)을 실제 물리 몸에서 본다.
// 손맛 · 맞힘 수는 tools/sim/mordschlag_duel.mjs · 동작 자취는 tools/sim/mordschlag_probe.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerSecretWatch, playerSecretOf } from '../../src/secret.js';
import { mordMode, mordGripOf, mordHitMul, mordKinOf, mordHeadReach } from '../../src/mordschlag.js';
import { FINISH } from '../../src/finish.js';
const { SECRET } = CONFIG;

class Still {
  constructor(me) { this.me = me; }
  update() { this.me.move.set(0, 0); }
}
function fixture(weapon = 'longsword', gap = 0.75) {
  const g = newRound({ weapon, weapon2: 'longsword', gap, seed: 7, walls: false, AIClass: Still });
  const P = g.player, E = g.enemy;
  P.skill.corr = CONFIG.SKILL.corr; P.skill.corrTip = CONFIG.SKILL.corrTip; P.skill.autoGuard = true; P.canShove = true;
  P.foe = E; E.foe = P;
  return { g, P, E };
}
const q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const anc = (P) => { const a = P.gripJoint.anchor2(); return [+a.x.toFixed(6), +a.y.toFixed(6), +a.z.toFixed(6)]; };
const wristGap = (P) => {
  const fa = P.bodies.farmS, sw = P.sword;
  const w = new THREE.Vector3(0.13, 0, 0).applyQuaternion(q(fa.rotation())).add(fa.translation());
  const gp = new THREE.Vector3(0, P.mordGrip ? P.mordGrip.g : 0, 0).applyQuaternion(q(sw.rotation())).add(sw.translation());
  return w.distanceTo(gp);
};

test('값: 사람 독일 비기 = 죽음의 일격 (사장님 결정 2 s — 10/25 23:1x · 끊김 너그러움 0.4 s — 10/27 21:4x · 창 0.6 s · 굳음 0.4 s) · 사람 비기 열림에 독일 · AI 도 독일 (10/24)', () => {
  assert.equal(SECRET.deMord, 1);
  assert.equal(SECRET.mordPress, CONFIG.realS(2)); // 10/25 23:1x 사장님 '1초 말고 2초로 하고, 대신 리솔루토처럼 0.2초 안에 다시 붙으면 이어서 세.' (전 1.5) · 표준 시간(10/25): 적힌 수는 실제 초 — 게임 값 = × 1.1
  assert.equal(SECRET.mordGrace, CONFIG.realS(0.4)); // 10/27 21:4x 사장님 '0.2초 간격을 0.4초로 늘려' (전 0.2)
  assert.equal(SECRET.playerWindow, CONFIG.realS(0.6));
  assert.equal(SECRET.stiff.german, CONFIG.realS(0.4));
  assert.equal(SECRET.mordOver, 0); // 넘어 들어감 규칙 — 사장님 확인 전 · 기본 끔
  assert.ok(SECRET.openSchools.includes('german') && SECRET.openSchools.includes('japanese'));
  assert.deepEqual(SECRET.aiOpenSchools, ['japanese', 'iberian', 'german']); // 10/24 이베리아 싱지르 · 독일 모르트슐라크 AI 열림 (사장님 12:0x 'ai도 비기 쓰게 해')
  const S = TRADITIONS.german.playerSecret;
  assert.equal(S.name, 'mordschlag');
  assert.equal(S.nameKo, '모르트슐라크');
  assert.equal(S.when, 'press');
  assert.notEqual(TRADITIONS.german.secret.name, 'mordschlag'); // 옛 판(TRADITIONS.german.secret — 받아 베기 · 감아 들기)은 그대로 · `?deMord=0` 에만
  assert.equal(TRADITIONS.german.aiSecret, S); // 10/24 AI 몫 = 사람과 같은 비기
});

test('10/27 23:0x 다시 붙는 밀치기 첫 걸음 동안 너그러움 시계 멈춤 (SECRET.mordStepPause): 끊긴 뒤 새 밀치기의 딛는 단계(barge phase step)는 너그러움보다 길어도 셈을 쥠 · 그 걸음 하나만 · 끄면 너그러움 넘으면 셈 0', () => {
  const { g, P, E } = fixture();
  const rule0 = SECRET.mordRule;
  SECRET.mordRule = 'press'; // 밀치기 누르기 판 (10/29 20:0x 전 — 지금 기본은 'close')
  try {
    assert.equal(SECRET.mordStepPause, 1);
    const steps = (sec) => Math.round(sec / DT);
    const run = (w, n, barge) => { for (let i = 0; i < n; i++) { P.barge = barge; w.update(DT, false); } };
    const press = { phase: 'press' };
    const w = new PlayerSecretWatch(P, E);
    run(w, steps(SECRET.mordPress / 2), press);
    const held = w.pressT;
    run(w, steps(SECRET.mordGrace / 2), null); // 끊김 (너그러움 안)
    const stepA = { phase: 'step' };
    run(w, steps(SECRET.mordGrace * 2), stepA); // 다시 시작한 밀치기의 첫 걸음 — 너그러움의 두 배 동안 딛어도
    assert.ok(Math.abs(w.pressT - held) < 1e-9, `첫 걸음 동안 셈을 쥠 ${w.pressT}`);
    run(w, 3, press); // 발이 닿아 누르기 → 이어 셈
    assert.ok(w.pressT > held, '이어 셈');
    run(w, steps(SECRET.mordGrace / 2), null); // 다시 끊김
    run(w, steps(SECRET.mordGrace / 4), { phase: 'step' }); // 첫 걸음이 누르기 없이 끝남(떨어짐 · 거절)
    run(w, 1, null);
    run(w, steps(SECRET.mordGrace), { phase: 'step' }); // 다른 걸음 — 멈추지 않음 → 너그러움 넘어 셈 0
    assert.equal(w.pressT, 0, '두 번째 걸음은 시계를 멈추지 않음');
    const old = SECRET.mordStepPause;
    try {
      SECRET.mordStepPause = 0;
      const w0 = new PlayerSecretWatch(P, E);
      run(w0, steps(SECRET.mordPress / 2), press);
      run(w0, steps(SECRET.mordGrace * 2), { phase: 'step' });
      assert.equal(w0.pressT, 0, '끄면(10/27 21:4x 판) 걸음 동안에도 너그러움 시계가 감');
    } finally { SECRET.mordStepPause = old; }
  } finally { SECRET.mordRule = rule0; P.barge = null; g.world.free(); }
});

test('사람 · AI 몫: 플레이어 독일 무기 = 죽음의 일격 · deMord 0 = 옛 판 · AI 독일 숙련도 5 = 같은 비기 · 4 = 없음 · aiOpenSchools 에서 빼면 없음 (10/24)', () => {
  const { g, P, E } = fixture();
  try {
    assert.equal(playerSecretOf(P).name, 'mordschlag');
    SECRET.deMord = 0;
    try { assert.equal(playerSecretOf(P), TRADITIONS.german.secret); } finally { SECRET.deMord = 1; }
    const ai = new AI(E, P, 'normal', { proficiency: { german: 5 } });
    assert.equal(ai.secret?.name, 'mordschlag');
    assert.ok(ai.press && ai.press.win === 0 && !ai.press.go); // 누르기 셈 · 창 (ai.js mordTick)
    assert.equal(new AI(E, P, 'normal', { proficiency: { german: 4 } }).secret, null); // 숙련도 5 아래는 비기 없음
    const open0 = SECRET.aiOpenSchools;
    SECRET.aiOpenSchools = open0.filter((s) => s !== 'german');
    try { assert.equal(new AI(E, P, 'normal', { proficiency: { german: 5 } }).secret, null); } finally { SECRET.aiOpenSchools = open0; }
    assert.equal(new AI(E, P, 'normal').press, null); // 기본 AI(숙련도 2) — 관문 판 그대로
  } finally { g.world.free(); }
});

test('옛 조건(mordRule press — 10/25 판): 밀치기 누르기가 mordPress(2 s) 이어지면 창 · 끊겨도 mordGrace(0.4 s) 안에 다시 누르면 셈을 이어감(그동안은 안 셈) · 더 끊기면 셈 0 · 창을 열면 셈 0 · 0.6 s 판도', () => {
  const { g, P, E } = fixture();
  const rule0 = SECRET.mordRule;
  SECRET.mordRule = 'press';
  try {
    const w = new PlayerSecretWatch(P, E);
    assert.equal(w.S.name, 'mordschlag');
    const steps = (sec) => Math.round(sec / DT); // 게임 초 → 물리 스텝 (SECRET 값은 읽을 때 이미 게임 초 — 표준 시간 10/25)
    const N = steps(SECRET.mordPress);
    const press = (n, on = true) => { for (let i = 0; i < n; i++) { P.barge = on ? { phase: 'press' } : null; w.update(DT, false); } };
    press(N - 2);
    assert.equal(w.open, null, 'mordPress 전에는 창 없음');
    press(steps(SECRET.mordGrace) + 2, false); // 너그러움보다 길게 끊김 → 셈 0
    assert.equal(w.pressT, 0);
    press(N - 2);
    assert.equal(w.open, null, '끊긴 뒤 다시 mordPress 전');
    press(steps(SECRET.mordGrace) - 2, false); // 너그러움 안의 끊김 → 셈을 쥔 채 (안 셈)
    assert.ok(Math.abs(w.pressT - (N - 2) * DT) < 1e-9, `쥔 셈 ${w.pressT}`);
    assert.equal(w.open, null);
    press(3);
    assert.ok(w.open, '이어 센 누르기가 mordPress 넘으면 창');
    assert.equal(w.open.ctx.ev, 'press');
    assert.equal(w.opened, 1);
    assert.ok(Math.abs(w.open.t - SECRET.playerWindow) < 3 * DT);
    P.barge = { phase: 'step' }; // 딛는 동안은 누르기가 아님
    w.update(DT, false);
    assert.equal(w.pressT, 0);
    const old = { mordPress: SECRET.mordPress, mordGrace: SECRET.mordGrace };
    try {
      SECRET.mordPress = CONFIG.realS(0.6); // 실제 0.6 s 판
      const w2 = new PlayerSecretWatch(P, E);
      for (let i = 0; i < steps(CONFIG.realS(0.6)) + 2; i++) { P.barge = { phase: 'press' }; w2.update(DT, false); }
      assert.ok(w2.open, '0.6 s 판');
      SECRET.mordGrace = 0; // 전 판: 끊기면 곧장 셈 0
      const w4 = new PlayerSecretWatch(P, E);
      for (let i = 0; i < steps(0.4); i++) { P.barge = { phase: 'press' }; w4.update(DT, false); }
      P.barge = null;
      w4.update(DT, false);
      assert.equal(w4.pressT, 0, 'mordGrace 0 — 한 스텝 끊겨도 셈 0');
    } finally { Object.assign(SECRET, old); }
    const w3 = new PlayerSecretWatch(P, E);
    for (let i = 0; i < steps(SECRET.mordPress + 0.5); i++) { P.barge = { phase: 'press' }; w3.update(DT, true); } // 비기 실행 · 굳음 동안은 세지 않음
    assert.equal(w3.open, null);
  } finally { SECRET.mordRule = rule0; P.barge = null; g.world.free(); }
});

test('조건 (사장님 10/29 20:0x — mordRule close 기본): 가슴 사이 ≤ 붙은 거리 n(0.8 m 모든 무기 — 사장님 10/30 00:4x)인 채 mordPress(2 s) → 창 · 밀치기 꼴 · 긋기와 상관없음 · 너그러움 0.4 s 안 떨어짐은 이어 셈 · 더 길면 0 · 상대가 서 있지 않으면 아님 · mordCloseN 숫자면 그 거리', () => {
  const { g, P, E } = fixture();
  try {
    assert.equal(SECRET.mordRule, 'close');
    assert.equal(SECRET.mordCloseN, 0.8);
    const n0 = SECRET.mordCloseN;
    let d = 0.6;
    P.foeDistance = () => d;
    const steps = (sec) => Math.round(sec / DT);
    const N = steps(SECRET.mordPress);
    const w = new PlayerSecretWatch(P, E);
    const run = (n, dd) => { for (let i = 0; i < n; i++) { d = dd; P.barge = null; P.skill.swinging = i % 7 === 0; w.update(DT, false); } };
    run(N - 2, 0.6);
    assert.equal(w.open, null, '2 s 전');
    run(steps(SECRET.mordGrace) - 2, 1.2); // 너그러움 안 떨어짐 → 셈을 쥠
    assert.equal(w.open, null);
    run(3, 0.7);
    assert.ok(w.open, '이어 센 붙음이 2 s 넘으면 창 (밀치기 · 스틱 없음 · 긋는 중이어도)');
    assert.equal(w.open.ctx.ev, 'press');
    assert.equal(w.open.ctx.close, true);
    const w2 = new PlayerSecretWatch(P, E);
    for (let i = 0; i < N - 2; i++) { d = 0.6; w2.update(DT, false); }
    for (let i = 0; i < steps(SECRET.mordGrace) + 2; i++) { d = 1.2; w2.update(DT, false); }
    assert.equal(w2.pressT, 0, '너그러움보다 길게 떨어지면 셈 0');
    const st = E.state;
    E.state = 'kneel';
    const w3 = new PlayerSecretWatch(P, E);
    for (let i = 0; i < N + 2; i++) { d = 0.5; w3.update(DT, false); }
    assert.equal(w3.open, null, '상대가 서 있지 않으면 아님');
    E.state = st;
    SECRET.mordCloseN = 0.5;
    try {
      const w4 = new PlayerSecretWatch(P, E);
      for (let i = 0; i < N + 2; i++) { d = 0.6; w4.update(DT, false); }
      assert.equal(w4.open, null, 'n 0.5 이면 0.6 m 는 붙음 아님');
    } finally { SECRET.mordCloseN = n0; }
    SECRET.mordCloseN = null; // 옛 판 — 롱소드 CLOSE.reach 0.77: 0.78 m 는 붙음 아님 · 기본 0.8 이면 붙음
    try {
      assert.ok(Math.abs(CONFIG.CLOSE.reach(P.weapon) - 0.77) < 0.02, `롱소드 닿는 거리 ${CONFIG.CLOSE.reach(P.weapon)}`);
      const w5 = new PlayerSecretWatch(P, E);
      for (let i = 0; i < N + 2; i++) { d = 0.78; w5.update(DT, false); }
      assert.equal(w5.open, null, 'CLOSE.reach 0.77 이면 0.78 m 는 붙음 아님');
    } finally { SECRET.mordCloseN = n0; }
    const w6 = new PlayerSecretWatch(P, E);
    for (let i = 0; i < N + 2; i++) { d = 0.78; w6.update(DT, false); }
    assert.ok(w6.open, '기본 0.8 m 면 0.78 m 는 붙음');
  } finally { delete P.foeDistance; P.skill.swinging = false; g.world.free(); }
});

test('칼날 거꾸로 쥐기: 손목 관절이 그 자리에서 맞음 · 칼끝 아래 · 원래 쥠으로 돌아오면 관성 · 닻 그대로', () => {
  const { g, P } = fixture();
  try {
    for (let i = 0; i < 60; i++) g.step();
    const I0 = P.swordIhand;
    const G = mordGripOf(P);
    assert.ok(G.g > P.weaponCfg.hiltLength && G.g < P.weaponCfg.hiltLength + P.weaponCfg.bladeLength);
    assert.ok(G.gOff > G.g); // 빈손은 칼끝 쪽
    assert.equal(P.reverseGrip(G, { x: 0, y: -1, z: 0 }), true);
    assert.equal(P.reverseGrip(G), false); // 이미 거꾸로
    assert.ok(wristGap(P) < 1e-3, `손목 ↔ 쥔 자리 ${wristGap(P)}`);
    const tip = new THREE.Vector3(0, 1, 0).applyQuaternion(q(P.sword.rotation()));
    assert.ok(tip.y < -0.99, '칼끝 아래 · 칼자루 위');
    assert.deepEqual(anc(P), [0, +G.g.toFixed(6), 0]);
    for (let i = 0; i < 60; i++) g.step();
    assert.ok(wristGap(P) < 0.01, `0.5 s 뒤에도 관절이 버팀 ${wristGap(P)}`);
    assert.equal(P.reverseGrip(null), true);
    assert.equal(P.mordGrip, null);
    assert.ok(wristGap(P) < 1e-3);
    assert.ok(Math.abs(P.swordIhand - I0) < 1e-9);
    assert.deepEqual(anc(P), [0, 0, 0]);
    assert.equal(mordMode(P), 'reverse');
  } finally { g.world.free(); }
  const ls = fixture('lightsaber');
  try { assert.equal(mordMode(ls.P), 'hilt'); } finally { ls.g.world.free(); } // 칼날을 잡을 수 없는 칼은 쥠 그대로
});

test('비기 흐름: 준비 → 베기 길 → 따라 지나감 → 다시 세우기 → 굳음 0.4 s · 끝나면 원래 쥠 · 겨눔 · NaN 없음', () => {
  SECRET.mord.kin = 0; SECRET.mord.aim = 'pad'; try { // 서보 길 시험 (10/23 판 기본은 운동학 kin 0.3 · pull)
  const { g, P } = fixture('longsword', 0.75);
  try {
    for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
    assert.equal(P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } }), true);
    assert.ok(P.mordGrip && P.mordAim, '입력 스텝에 칼날을 거꾸로 쥠');
    const seen = new Set();
    let stiffT = null;
    for (let i = 0; i < Math.round(4 / DT) && P.skill.sec; i++) {
      g.step();
      if (P.skill.sec) { seen.add(P.skill.sec.stage); if (P.skill.sec.stage === 'stiff') stiffT = P.skill.sec.stiffT; }
      const t = P.sword.translation();
      assert.ok(Number.isFinite(t.x + t.y + t.z));
      if (P.mordGrip) assert.ok(wristGap(P) < 0.02, `손목 ↔ 쥔 자리 ${wristGap(P)}`);
    }
    assert.equal(P.skill.sec, null);
    for (const s of ['chamber', 'strike', 'follow', 'mordBack', 'stiff']) assert.ok(seen.has(s), s);
    assert.equal(stiffT, CONFIG.realS(0.4));
    assert.equal(P.mordGrip, null);
    assert.equal(P.mordAim, false);
    assert.equal(P.mordHold, null);
    assert.deepEqual(anc(P), [0, 0, 0]);
    assert.equal(P.powerMul, 1);
    assert.equal(P.secretHit, 1);
  } finally { g.world.free(); }
  } finally { SECRET.mord.kin = 0.3; SECRET.mord.aim = 'pull'; }
});

test('넘어 들어감 규칙 (mordOver — 기본 끔): 켜면 내리치는 동안만 내 칼이 상대 칼과 부딪히지 않고, 끝나면 원래 그룹', () => {
  SECRET.mord.kin = 0; SECRET.mord.aim = 'pad'; try { // 서보 길 시험 (10/23 판 기본은 운동학 kin 0.3 · pull)
  const { g, P } = fixture('longsword', 0.75);
  SECRET.mordOver = 1;
  try {
    const g0 = P.swordColliders.map((c) => c.collisionGroups());
    for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
    P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } });
    let off = false;
    for (let i = 0; i < Math.round(4 / DT) && P.skill.sec; i++) {
      g.step();
      const st = P.skill.sec?.stage;
      const masked = P.swordColliders.every((c) => (c.collisionGroups() & 16) === 0);
      if (st === 'strike' || st === 'follow') off ||= masked;
      if (st === 'chamber' || st === 'stiff') assert.equal(masked, false, st);
    }
    assert.ok(off);
    assert.deepEqual(P.swordColliders.map((c) => c.collisionGroups()), g0);
  } finally { SECRET.mordOver = 0; g.world.free(); }
  } finally { SECRET.mord.kin = 0.3; SECRET.mord.aim = 'pull'; }
});

test('가볍고 느림을 고칠 안 (10/23 확정 — kin 0.3 · aim pull): kin · aim · power hit = 판정 배율 hitMul 그대로 · finish = FINISH.power · 수 = 그 수', () => {
  assert.equal(SECRET.mord.kin, 0.3); // 사장님 10/23 '죽음의 일격 30%'
  assert.equal(SECRET.mord.aim, 'pull');
  assert.equal(SECRET.mord.power, 'hit');
  assert.equal(mordHitMul(), SECRET.hitMul);
  SECRET.mord.power = 'finish';
  try { assert.equal(mordHitMul(), FINISH.power); } finally { SECRET.mord.power = 'hit'; }
  SECRET.mord.power = 2;
  try { assert.equal(mordHitMul(), 2); } finally { SECRET.mord.power = 'hit'; }
  const { g, P } = fixture();
  try {
    const run = { mord: { G: mordGripOf(P) } };
    const M = mordKinOf(P, run);
    assert.ok(Math.abs(M.Lc - (M.g - P.weaponCfg.hiltLength)) < 1e-9); // 손 → 코등이
    assert.ok(Math.abs(M.Lp - (M.g + 0.15)) < 1e-6, `손 → 칼자루 끝 ${M.Lp}`); // 롱소드 폼멜 공 밑 −0.15
    assert.equal(M.pull, true); // 10/23 aim 'pull' 기본
  } finally { g.world.free(); }
});

test('운동학 길 (kin 0.6): 쥠 바꿈 → instant(연환 틀) → 원래 쥠 · 밧줄 다시 · 굳음 0.4 s · 입력 → 굳음 끝 1 s 안 · pull 이면 칼자루가 머리에', () => {
  for (const aim of ['pad', 'pull']) {
    const { g, P } = fixture('longsword', 0.65);
    SECRET.mord.kin = 0.6;
    SECRET.mord.aim = aim;
    try {
      for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
      const cone = !!P.gripCone;
      assert.equal(P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } }), true);
      assert.equal(P.skill.sec.stage, 'instant');
      assert.ok(P.mordGrip && P.mordAim);
      const hits = [];
      g.combat.hooks.onWound = (att, vic, r, pt, pr) => { if (att === P) hits.push({ zone: r.zone, part: pr.w.part }); };
      const seen = new Set();
      let t = 0, kin = false;
      for (let i = 0; i < Math.round(3 / DT) && P.skill.sec; i++) {
        g.step();
        t += DT;
        if (P.skill.sec) seen.add(P.skill.sec.stage);
        if (P.iai) kin ||= P.iai.kind === 'combo' && !!P.iai.mord;
        const s = P.sword.translation();
        assert.ok(Number.isFinite(s.x + s.y + s.z));
      }
      assert.ok(kin, '연환 틀로 몬다');
      assert.equal(P.skill.sec, null);
      assert.ok(seen.has('instant') && seen.has('stiff'));
      assert.ok(t < 1, `입력 → 굳음 끝 ${t.toFixed(2)} s`);
      assert.equal(P.mordGrip, null);
      assert.equal(P.mordAim, false);
      assert.equal(!!P.gripCone, cone, '손목 밧줄 다시');
      assert.deepEqual(anc(P), [0, 0, 0]);
      assert.ok(P.instantResult?.mord);
      if (aim === 'pull') {
        assert.ok(P.instantResult.pullD > 0);
        assert.ok(hits.some((h) => h.zone === 'head' && h.part === 'hilt'), JSON.stringify(hits));
      }
    } finally { SECRET.mord.kin = 0.3; SECRET.mord.aim = 'pull'; g.world.free(); }
  }
});

test('머리 따라 겨눔 시제품 (10/30 사장님 \'모르트가 빗나가는 경우는 어떤거지?\' — SECRET.mord.track 기본 끔): 끄면 결과에 따라 겨눔 셈 없음 · 켜면 겨눈 자리까지 스텝마다 그때 머리로 다시 옮김(trackN) · trackUntil cut 은 베는 토막 전까지만(더 적음) · 머리 맞음', () => {
  assert.equal(SECRET.mord.track, 0);
  assert.equal(SECRET.mord.trackCommit, 0);
  assert.equal(SECRET.mord.trackUntil, 'aim');
  const run = (track, until = 'aim') => {
    const { g, P } = fixture('longsword', 0.65);
    SECRET.mord.track = track;
    SECRET.mord.trackUntil = until;
    try {
      for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
      const hits = [];
      g.combat.hooks.onWound = (att, vic, r, pt, pr) => { if (att === P) hits.push({ zone: r.zone, part: pr.w.part }); };
      assert.equal(P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } }), true);
      for (let i = 0; i < Math.round(3 / DT) && P.skill.sec; i++) g.step();
      return { R: P.instantResult, hits };
    } finally { SECRET.mord.track = 0; SECRET.mord.trackUntil = 'aim'; g.world.free(); }
  };
  const off = run(0);
  assert.ok(off.R?.mord && off.R.trackN === undefined, '끄면 따라 겨눔 없음');
  const on = run(1);
  assert.ok(on.R.trackN > 0 && Number.isFinite(on.R.trackMoved), JSON.stringify(on.R));
  assert.ok(on.hits.some((h) => h.zone === 'head' && h.part === 'hilt'), JSON.stringify(on.hits));
  const cut = run(1, 'cut');
  assert.ok(cut.R.trackN > 0 && cut.R.trackN < on.R.trackN, `베기 전까지 ${cut.R.trackN} < 겨눈 자리까지 ${on.R.trackN}`);
});

test('AI 모르트슐라크 (10/24 사장님 \'ai도 비기 쓰게 해\'): 누르기 mordPress(2 s) → 창 → 머리가 닿으면 곧장 냄(사람과 같은 실행부) → 굳음 → 끝 · 끊기면 셈 0 · 머리가 멀면 안 냄', () => {
  const g = newRound({ weapon: 'longsword', weapon2: 'longsword', gap: 0.7, seed: 7, walls: false, AIClass: AI, persona: { proficiency: { german: 5 } } });
  const P = g.player, E = g.enemy, ai = g.ai;
  try {
    assert.equal(ai.secret?.name, 'mordschlag');
    const S = ai.secret, PR = ai.press; // 판당 1 번(10/29 19:5x — 다 쓰면 ai.secret · ai.press 가 비워짐 · dropSecret)
    assert.equal(E.canShove, false); // persona.close 없는 몸 — 아래 누르기는 시험이 쥔다 (fighter.closeStep 이 돌지 않음)
    ai.watch = () => {}; // 간 보기 결정 없음 (공격 · 물러남 없이 셈만 본다)
    ai.moveFeet = function () { this.me.move.set(0, 0); this.me.stickX = 0; this.me.stickY = 0; };
    const steps = (sec) => Math.round(sec / DT);
    for (let i = 0; i < steps(0.3); i++) g.step(); // 몸이 선다
    assert.equal(mordHeadReach(E), true, '가슴 0.7 m — 머리가 칼자루 길 안');
    E.barge = { phase: 'press' };
    for (let i = 0; i < steps(1.0); i++) g.step();
    E.barge = null; // 너그러움(mordGrace)보다 길게 끊김 → 셈 0
    for (let i = 0; i < steps(SECRET.mordGrace) + 2; i++) g.step();
    assert.equal(PR.pressT, 0);
    E.barge = { phase: 'press' };
    let opened = null, fired = null, ended = null;
    const c0 = E.stamina.counts.secret ?? 0;
    for (let i = 0; i < steps(SECRET.mordPress + 1.5); i++) {
      g.step();
      if (opened == null && PR.wins > 0) opened = PR.pressMax;
      if (fired == null && ai.secretRun?.stage === 'mord') fired = g.t;
      if (fired != null && ended == null && !ai.secretRun) ended = g.t;
      const s = E.sword.translation();
      assert.ok(Number.isFinite(s.x + s.y + s.z));
    }
    assert.ok(opened != null && Math.abs(opened - SECRET.mordPress) < 3 * DT, `창은 누르기 ${opened} s 에`);
    assert.ok(fired != null, '창 안에서 냄');
    assert.ok(ended != null && ended - fired < 1.5, `냄 → 끝 ${ended - fired} s`);
    assert.equal(ai.secretStat(S).fired, 1);
    assert.equal(PR.wins, 1);
    assert.equal(ai.secret, null, '판당 1 번 — 다 쓰면 비기 없는 AI (10/29 19:5x)');
    assert.equal(E.secretUsed, 1);
    assert.equal(E.mordGrip, null); // 원래 쥠으로
    assert.equal(E.skill.sec, null);
    if (CONFIG.STAMINA.on) assert.equal((E.stamina.counts.secret ?? 0) - c0, 1); // 비기 기력 (사람과 같은 장부)
    E.barge = null;
    const pp = P.bodies;
    for (const k of Object.keys(pp)) { const t = pp[k].translation(); pp[k].setTranslation({ x: t.x - 2.5, y: t.y, z: t.z }, true); } // 상대를 멀리
    assert.equal(mordHeadReach(E), false, '가슴 3 m — 머리가 멂');
  } finally { g.world.free(); }
});

test('AI 걸어가며 치기 (10/24 13:3x 사장님 \'걸어가며 치기도 같이 넣어\' — SECRET.mordWalkStrike 1): 붙으러 걸어 들어가는 동안은 간 보기가 칠 때를 본다 · 밀치는 동안은 걸쇠 · 0 = 12:0x 판(걸어가는 동안도 걸쇠)', () => {
  assert.equal(SECRET.mordWalkStrike, 1);
  const g = newRound({ weapon: 'longsword', weapon2: 'longsword', gap: 1.9, seed: 7, walls: false, AIClass: AI, persona: { proficiency: { german: 5 }, close: { rate: 0.25, kind: 'barge', then: 'cut' } } });
  const P = g.player, E = g.enemy, ai = g.ai;
  try {
    assert.ok(ai.press);
    let seen = 0;
    ai.preThreat = () => { seen++; return true; }; // 걸쇠 바로 뒤 — 불렸으면 간 보기가 칠 때를 보러 간 것
    const look = () => { seen = 0; ai.watch(DT, null, 1.9, null); return seen > 0; };
    ai.press.go = false;
    assert.equal(look(), true, '붙이기 아님 — 평소 간 보기');
    ai.press.go = true; ai.press.goWhy = 'watch'; ai.press.goBarge = false; E.barge = null;
    assert.equal(ai.mordWalking(), true);
    assert.equal(look(), true, '걸어 들어가는 동안 — 칠 때를 본다');
    SECRET.mordWalkStrike = 0;
    try { assert.equal(look(), false, '0 = 걸어가는 동안도 먼저 치지 않음'); } finally { SECRET.mordWalkStrike = 1; }
    E.barge = { phase: 'press' };
    assert.equal(ai.mordWalking(), false);
    assert.equal(look(), false, '밀치는 동안은 먼저 치지 않음');
    E.barge = null; ai.press.goWhy = 'barge';
    assert.equal(ai.mordWalking(), false, '밀치기 걸쇠(이미 붙어 밂)는 걷기가 아님');
  } finally { E.barge = null; g.world.free(); }
});

test('AI 자연스럽게 가까울 때만 밀기 (10/24 14:2x 사장님 \'무작정 밀며 들어가지 말고, 경합하다가 자연스럽게 가까워졌을 때\' — SECRET.mordNear 1): 칠 때 굴림 없음 · 붙은 거리의 반 걸음은 밀기의 일부 · 붙은 거리 밖으로 떨어지면 끝 · 0 = 12:0x 판', () => {
  assert.equal(SECRET.mordNear, 1);
  const g = newRound({ weapon: 'longsword', weapon2: 'longsword', gap: 1.9, seed: 7, walls: false, AIClass: AI, persona: { proficiency: { german: 5 }, close: { rate: 1, kind: 'barge', then: 'cut' } } });
  const P = g.player, E = g.enemy, ai = g.ai;
  try {
    E.foe = P; P.foe = E; // 판 스텝 전 — 거리를 잴 수 있게
    const calls = [];
    const go0 = ai.mordPressGo.bind(ai);
    ai.mordPressGo = (why) => { calls.push(why); return go0(why); };
    // 칠 때를 본 순간: 14:2x 는 붙이기 굴림 없이 보통 AI 대로 (간 보기 결정 자리를 바로 부름)
    ai.opportunity = () => ({ score: 9, kind: 'patience' });
    let attacked = 0;
    ai.startAttack = () => { attacked++; return true; };
    ai.preThreat = () => false; ai.seize = () => false; ai.passiveWatch = () => false; ai.pickTech = () => null; ai.guardTimer = 99; // 간 보기의 다른 갈래는 쉼 (결정 자리만 본다)
    ai.decideTimer = 0; ai.watch(DT, null, 1.9, null);
    assert.deepEqual(calls, []);
    assert.equal(attacked, 1, '보통 AI 대로 친다');
    SECRET.mordNear = 0;
    try { ai.decideTimer = 0; ai.watch(DT, null, 1.9, null); assert.deepEqual(calls, ['watch'], '0 = 칠 때 굴림(12:0x 판)'); } finally { SECRET.mordNear = 1; }
    // 붙은 거리에서 붙는 반 걸음은 밀기의 일부 — 걸어가며 치기 대상 아님 (12:0x 판은 걷기)
    ai.press.go = true; ai.press.goBarge = false; ai.press.goWhy = 'clinch'; E.barge = null;
    assert.equal(ai.mordWalking(), false);
    SECRET.mordNear = 0;
    try { assert.equal(ai.mordWalking(), true); } finally { SECRET.mordNear = 1; }
    // 상대가 붙은 거리 밖(가슴 1.9 m > M.clinch)이면 끝 — 쫓지 않음 · 12:0x 판은 칠 거리 안이면 이어 감
    ai.mode = 'watch'; ai.d = E.foeDistance();
    assert.ok(ai.d > ai.M.clinch && ai.d < ai.holdDist() + ai.watchReachOut());
    ai.mordTick(DT, false);
    assert.equal(ai.press.go, false, '붙은 거리 밖 — 끝');
    SECRET.mordNear = 0;
    try { ai.press.go = true; ai.press.goWhy = 'clinch'; ai.mordTick(DT, false); assert.equal(ai.press.go, true, '12:0x 판은 칠 거리 안이면 이어 감'); } finally { SECRET.mordNear = 1; ai.press.go = false; }
  } finally { E.barge = null; g.world.free(); }
});
