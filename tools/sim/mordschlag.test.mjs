// 독일 비기 죽음의 일격 (모르트슐라크 · 10/22 사장님 '독일은 죽음의 일격으로 하자' · '1.5로 해' · 사람 먼저 — src/mordschlag.js · docs/strike/german_mordschlag_2026-10-22.md).
// 조건(밀치기 누르기 이어짐 → 창) · 사람 몫만(AI 비기 그대로) · 칼날 거꾸로 쥐기(손목 관절 · 원래 쥠으로) · 비기 흐름(준비 → 베기 → 다시 세우기 → 굳음)을 실제 물리 몸에서 본다.
// 손맛 · 맞힘 수는 tools/sim/mordschlag_duel.mjs · 동작 자취는 tools/sim/mordschlag_probe.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { PlayerSecretWatch, playerSecretOf } from '../../src/secret.js';
import { mordMode, mordHitMul, mordKinOf, mordHeadReach } from '../../src/mordschlag.js';
import { FINISH } from '../../src/finish.js';
const { SECRET } = CONFIG;

class Still {
  constructor(me) { this.me = me; }
  update() { this.me.move.set(0, 0); }
}
/** SECRET.mord 칸을 잠깐 바꿔 fn 을 돌리고 되돌림 (10/31 14:xx 폼멜 찍기 기본 뒤 거꾸로 쥔 판 시험을 pommel 0 으로 묶음) */
const withMord = (set, fn) => { const keep = { ...SECRET.mord }; Object.assign(SECRET.mord, set); try { return fn(); } finally { Object.assign(SECRET.mord, keep); } };
function fixture(weapon = 'longsword', gap = 0.75) {
  const g = newRound({ weapon, weapon2: 'longsword', gap, seed: 7, walls: false, AIClass: Still });
  const P = g.player, E = g.enemy;
  P.skill.corr = CONFIG.SKILL.corr; P.skill.autoGuard = true; P.canShove = true;
  P.foe = E; E.foe = P;
  return { g, P, E };
}
const q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const anc = (P) => { const a = P.gripJoint.anchor2(); return [+a.x.toFixed(6), +a.y.toFixed(6), +a.z.toFixed(6)]; };
const wristGap = (P) => {
  const fa = P.bodies.farmS, sw = P.sword;
  const w = new THREE.Vector3(0.13, 0, 0).applyQuaternion(q(fa.rotation())).add(fa.translation());
  const gp = new THREE.Vector3(0, 0, 0).applyQuaternion(q(sw.rotation())).add(sw.translation());
  return w.distanceTo(gp);
};

const KIN0 = SECRET.mord.kin; // 판 값 (11/11 0.35 — 시험이 바꾼 뒤 이 값으로 되돌림 · 전 0.3 을 적어 되돌렸음)

test('값: 사람 독일 비기 = 죽음의 일격 (사장님 결정 1.5 s — 11/11 · 전 2 s 10/25 23:1x · 끊김 너그러움 0.4 s — 10/27 21:4x · 창 0.6 s · 굳음 0.4 s) · 사람 비기 열림에 독일 · AI 도 독일 (10/24)', () => {
  assert.equal(SECRET.mordPress, CONFIG.realS(1.5)); // 11/11 사장님 '1.5초로 해.' (전 2 — 10/25 23:1x 사장님 '1초 말고 2초로 하고, 대신 리솔루토처럼 0.2초 안에 다시 붙으면 이어서 세.' (전 1.5) · 표준 시간(10/25): 적힌 수는 실제 초 — 게임 값 = × 1.1
  assert.equal(SECRET.mordGrace, CONFIG.realS(0.4)); // 10/27 21:4x 사장님 '0.2초 간격을 0.4초로 늘려' (전 0.2)
  assert.equal(SECRET.playerWindow, CONFIG.realS(0.6));
  assert.equal(SECRET.stiff.german, CONFIG.realS(0.6)); // 11/14 사장님 '모든 비기 경직 0.6초로 통일' (전 0.4)
  assert.ok(SECRET.openSchools.includes('german') && SECRET.openSchools.includes('japanese'));
  assert.deepEqual(SECRET.aiOpenSchools, ['japanese', 'iberian', 'german', 'italian', 'chinese']); // 10/24 이베리아 싱지르 · 독일 모르트슐라크 AI 열림 (사장님 12:0x 'ai도 비기 쓰게 해') · 11/14 이탈리아 리솔루토 ('리솔루토도 쓰게해') · 동방 격살 ('동방도 격살 쓰게 해')
  const S = TRADITIONS.german.playerSecret;
  assert.equal(S.name, 'mordschlag');
  assert.equal(S.nameKo, '모르트슐라크');
  assert.equal(S.when, 'press');
  assert.notEqual(TRADITIONS.german.secret.name, 'mordschlag'); // 옛 판(TRADITIONS.german.secret — 받아 베기 · 감아 들기)은 그대로 · `?deMord=0` 에만
  assert.equal(TRADITIONS.german.aiSecret, S); // 10/24 AI 몫 = 사람과 같은 비기
});




test('조건 (사장님 10/29 20:0x — mordRule close 기본): 가슴 사이 ≤ 붙은 거리 n(0.8 m 모든 무기 — 사장님 10/30 00:4x)인 채 mordPress(2 s) → 창 · 밀치기 꼴 · 긋기와 상관없음 · 너그러움 0.4 s 안 떨어짐은 이어 셈 · 더 길면 0 · 상대가 서 있지 않으면 아님 · mordCloseN 숫자면 그 거리', () => {
  const { g, P, E } = fixture();
  try {
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

test('폼멜 찍기 기본 (10/31 14:xx 사장님 \'폼멜 찍기로 바꿔서 본판에 올려.\' — SECRET.mord.pommel 1 · noSelfClip 1): 사람 — 가슴 사이 0.45 · 0.6 · 0.75 m 에서 내면 쥠 그대로 폼멜로 머리 · 두 손이 늘 내 머리 앞 · 넘어지지 않음 · 굳음까지 끝 · AI — 누르기 창 안에서 내 폼멜로 상대 머리', () => {
  assert.equal(SECRET.mord.clipStep, 0.3); // 팔이 안 닿으면 앞 반걸음 끝
  for (const gap of [0.45, 0.6, 0.75]) {
    const { g, P } = fixture('longsword', gap);
    try {
      for (let i = 0; i < Math.round(2.4 / DT); i++) g.step();
      const hits = [];
      g.combat.hooks.onWound = (att, vic, r, pt, pr) => { if (att === P) hits.push({ zone: r.zone, part: pr.w.part, E: r.energy }); };
      assert.equal(P.skill.secret({ S: TRADITIONS.german.playerSecret, ctx: { ev: 'press' } }), true);
      assert.equal(mordMode(P), 'hilt');
      let front = Infinity, fell = false, stiff = false;
      for (let i = 0; i < Math.round(3 / DT) && P.skill.sec; i++) {
        g.step();
        if (P.state !== 'stand') fell = true;
        if (P.skill.sec?.stage === 'stiff') stiff = true;
        const I = P.iai;
        if (!I?.mord) continue;
        const hd = new THREE.Vector3().copy(P.bodies.head.translation()), yi = I.yaw.clone().invert();
        const wS = new THREE.Vector3(0.13, 0, 0).applyQuaternion(q(P.bodies.farmS.rotation())).add(P.bodies.farmS.translation());
        const wO = new THREE.Vector3(0, -0.13, 0).applyQuaternion(q(P.bodies.farmO.rotation())).add(P.bodies.farmO.translation());
        front = Math.min(front, wS.sub(hd).applyQuaternion(yi).x, wO.sub(hd).applyQuaternion(yi).x);
      }
      assert.ok(hits.some((h) => h.zone === 'head' && h.part === 'hilt'), `${gap}: 폼멜로 머리 ${JSON.stringify(hits)}`);
      assert.ok(front > 0.05, `${gap}: 두 손이 내 머리 앞 ${front.toFixed(2)} m`);
      assert.ok(!fell, `${gap}: 서 있음`);
      assert.ok(stiff && P.skill.sec === null, `${gap}: 굳음까지 끝`);
      assert.ok(P.instantResult?.mord && P.instantResult.clip, JSON.stringify(P.instantResult?.clip));
    } finally { g.world.free(); }
  }
  // AI (같은 실행부): 누르기 창 → 머리가 닿는 거리(팔 + 폼멜 + 앞 반걸음)면 냄 → 폼멜로 머리
  const g = newRound({ weapon: 'longsword', weapon2: 'longsword', gap: 0.7, seed: 7, walls: false, AIClass: AI, persona: { proficiency: { german: 5 }, planOff: true } }); // 3 단계(11/14): 비기 셈을 보는 장면 — 독일 플랜 전 판(planOff · 인물 칸 없는 밀치기 몸 아님)
  const P = g.player, E = g.enemy, ai = g.ai;
  try {
    ai.watch = () => {};
    ai.moveFeet = function () { this.me.move.set(0, 0); this.me.stickX = 0; this.me.stickY = 0; };
    for (let i = 0; i < Math.round(0.3 / DT); i++) g.step();
    assert.equal(mordHeadReach(E), true, '가슴 0.7 m — 폼멜이 닿는 거리');
    const hits = [];
    g.combat.hooks.onWound = (att, vic, r, pt, pr) => { if (att === E && E.skill.sec) hits.push({ zone: r.zone, part: pr.w.part }); };
    E.barge = { phase: 'press' };
    let fired = false, fell = false;
    for (let i = 0; i < Math.round((SECRET.mordPress + 1.5) / DT); i++) {
      g.step();
      if (ai.secretRun?.stage === 'mord') fired = true;
      if (fired && E.state !== 'stand') fell = true;
    }
    assert.ok(fired, 'AI 가 창 안에서 냄');
    assert.ok(!fell, 'AI 서 있음');
    assert.ok(hits.some((h) => h.zone === 'head' && h.part === 'hilt'), `AI 폼멜로 머리 ${JSON.stringify(hits)}`);
  } finally { g.world.free(); }
});
