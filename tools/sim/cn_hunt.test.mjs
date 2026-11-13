// 동방 맹호은림 사냥 겹 시험 (11/14 — src/cn_hunt.js · config UNIQUE_ASSIST.cnHunt · 새 칸 C12 · 기록 docs/strike/cn_hunt_2026-11-14.md):
//  사장님 11/14 '동방은 사냥감을 말려죽이는 고양이과 맹수야' · '빠지는 규칙은 안 둘게' · '3번 제한을 다른 비기처럼 1번으로' · '스택당 기력 회복 -8% 격살 빠르기 +8%'.
//  쌓임 조건(허리를 베는 세 칼 · 칼날 베기 · 몸통 · 상처 > 0 · 사람은 C12 · 공격 하나에 한 겹) · 상한 5 · 빠지지 않음 · 기력 회복 −8 %/겹 · 격살 빠르기 × (1 + 0.08 n) ·
//  사람 격살 판당 1 번 · 스위치 끔이면 전 판 · AI 스위치 · 다른 유파 바이트 같음.  node --test tools/sim/cn_hunt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { huntOn, huntHit, huntRegenK, huntShareK, huntUses, huntN } from '../../src/cn_hunt.js';
import { recoverRate } from '../../src/stamina.js';
import { Combat } from '../../src/combat.js';
import { secretUsesOf, secretLeft, useSecret } from '../../src/secret.js';
import { kitFromNodes, allNodeIds, nodeOf, KIT_KEYS } from '../../src/skill_tree_data.js';
import { TRADITIONS } from '../../src/schools.js';

const UA = CONFIG.UNIQUE_ASSIST;
const { SECRET, STAMINA } = CONFIG;
const H0 = { ...UA.cnHunt };
const reset = () => Object.assign(UA.cnHunt, H0);
const kitAll = (s = 'chinese') => kitFromNodes(s, allNodeIds(s));
const kitNo12 = () => { const ids = allNodeIds('chinese'); ids.delete('C12'); return kitFromNodes('chinese', ids); };
/** 가짜 몸 (쌓임 판정만 — 물리 없음): 유파 · 스킬트리 몫 · 공격 번호 · 지금 기술(artTech — unique_assist.js strokeTechOf 가 맨 먼저 읽음) */
const body = ({ tr = 'chinese', kit = kitAll(tr), tech = 'yaoji', id = 1 } = {}) => ({ swordArt: { tradition: tr }, ...(kit ? { skillKit: kit } : {}), stamina: { attackId: id, time: 0 }, artTech: tech });
const C = Object.create(Combat.prototype); // huntWound · yaojiDeep 은 this 의 다른 칸을 안 씀
const cut = (zone = 'abdomen', o = {}) => ({ type: 'cut', zone, severity: 0.4, ...o });

test('기본값 — 켬 · 상한 5 · 기력 회복 −8 %/겹 · 격살 빠르기 +8 %/겹 · 사람 판당 1 번 · AI 스위치 끔 [사장님 11/14]', () => {
  assert.deepEqual(UA.cnHunt, { on: 1, max: 5, regen: 0.08, share: 0.08, uses: 1, ai: 0 });
  assert.deepEqual(UA.secretUses, { default: 1, chinese: 3 }); // 공용 표는 그대로 — 사람 동방만 cnHunt.uses 로 덮음(AI · 시뮬 몸은 ai 스위치)
  assert.deepEqual(UA.yaojiBleed.techs, ['yaoji', 'chebuYaoji', 'lianchi']);
  assert.deepEqual(UA.yaojiBleed.zones, ['chest', 'abdomen', 'pelvis']);
});

test('칸 C12 맹호은림: 출혈 심화 C4 다음 · 심화 · 깊이 3 · 금화 400 · 몫 cnHunt 하나 · 오의 출처 본국검', () => {
  const n = nodeOf('chinese', 'C12');
  assert.deepEqual([n.name, n.cat, [...n.pre], n.d, n.cx, n.price, n.heads, [...n.f]], ['맹호은림', 'deep', ['C4'], 3, 130, 400, 0, ['cnHunt']]);
  assert.ok(KIT_KEYS.includes('cnHunt'));
  assert.equal(kitAll().cnHunt, true);
  assert.equal(kitNo12().cnHunt, false);
  assert.match(n.src, /본국검 — 맹호은림세/);
  assert.ok(!/[0-9]/.test(n.eff) && !n.eff.includes(' · '), '효과 글: 숫자 · 꼬리 없음');
});

test('쌓임 조건: 허리를 베는 세 칼 · 칼날 베기 · 몸통 셋 · 상처 > 0 · 출혈 심화(C4) · 맹호은림(C12) — 하나라도 빠지면 없음', () => {
  try {
    for (const tech of ['yaoji', 'chebuYaoji', 'lianchi']) for (const zone of ['chest', 'abdomen', 'pelvis']) {
      const v = {};
      C.huntWound(body({ tech }), v, cut(zone));
      assert.equal(huntN(v), 1, `${tech} ${zone}`);
    }
    const none = (att, r) => { const v = {}; C.huntWound(att, v, r); return huntN(v); };
    assert.equal(none(body(), cut('arm')), 0, '팔');
    assert.equal(none(body(), cut('head')), 0, '머리');
    assert.equal(none(body(), cut('leg')), 0, '다리');
    assert.equal(none(body(), cut('abdomen', { type: 'stab' })), 0, '찌르기');
    assert.equal(none(body(), cut('abdomen', { type: 'blunt' })), 0, '둔타');
    assert.equal(none(body(), cut('abdomen', { severity: 0 })), 0, '상처 없음');
    for (const tech of ['zwerch', 'zwerchL', 'schielhau', 'gyeoksal', null]) assert.equal(none(body({ tech }), cut()), 0, String(tech));
    assert.equal(none(body({ kit: kitNo12() }), cut()), 0, 'C12 안 익힘');
    const ids = allNodeIds('chinese');
    ids.delete('C4');
    assert.equal(none(body({ kit: kitFromNodes('chinese', ids) }), cut()), 0, 'C4 안 익힘 (출혈 × k 가 안 붙음)');
    assert.equal(none(body({ tr: 'german' }), cut()), 0, '동방 무기가 아님');
    assert.equal(huntHit(body(), null), false);
    const self = body();
    assert.equal(huntHit(self, self), false, '제 몸');
  } finally { reset(); }
});

test('공격 하나에 한 겹 (같은 공격 번호의 두 번째 상처는 셈 밖) · 상한 5 · 상한에 닿은 때 적음', () => {
  const v = { stamina: { time: 7 } };
  const a = body({ id: 10 });
  C.huntWound(a, v, cut('chest'));
  C.huntWound(a, v, cut('abdomen')); // 같은 칼이 가슴 · 배를 함께 가름
  assert.equal(huntN(v), 1);
  assert.equal(v.cnHunt.hits, 2);
  for (let i = 11; i < 20; i++) (a.stamina.attackId = i), C.huntWound(a, v, cut());
  assert.equal(huntN(v), 5, '상한 5');
  assert.equal(v.cnHunt.t5, 7);
});

test('기력 회복 −8 %/겹 (stamina.js recoverRate) · 겹 없으면 같은 수 · 0 밑으로 안 내려감', () => {
  try {
    for (const f of [{ aiControlled: true }, { humanInput: true }, {}]) {
      const base = recoverRate(f);
      assert.equal(base, f.aiControlled ? STAMINA.recoverPerSecond : f.humanInput ? STAMINA.humanRecoverPerSecond : STAMINA.playerRecoverPerSecond);
      for (let n = 1; n <= 5; n++) {
        f.cnHunt = { n };
        assert.ok(Math.abs(recoverRate(f) - base * (1 - 0.08 * n)) < 1e-12, `${n} 겹`);
      }
      delete f.cnHunt;
    }
    assert.equal(huntRegenK({ cnHunt: { n: 5 } }), 1 - 0.4);
    UA.cnHunt.regen = 0.3;
    assert.equal(huntRegenK({ cnHunt: { n: 5 } }), 0);
  } finally { reset(); }
});

test('실제 판: 겹은 판 끝까지 빠지지 않음 · 겹이 쌓인 몸은 쉼 뒤 회복이 1 − 0.08 n 배', () => {
  const run = (n) => {
    const G = newRound({ weapon: 'hwando', weapon2: 'longsword', seed: 2, kit: kitAll() });
    try {
      G.ai.update = () => {};
      while (G.t < 0.5) G.step();
      const A = G.enemy;
      if (n) A.cnHunt = { n, hits: n, last: new Map(), t5: null };
      A.stamina.value = 20;
      A.stamina.rest = 10; // 쉼 대기는 지난 것으로
      const v0 = A.stamina.value;
      for (let i = 0; i < 60; i++) G.step();
      assert.equal(huntN(A), n, '빠지지 않음');
      return A.stamina.value - v0;
    } finally { G.world.free(); }
  };
  const d0 = run(0);
  assert.ok(d0 > 1, `회복 ${d0}`);
  for (const n of [1, 5]) assert.ok(Math.abs(run(n) / d0 - (1 - 0.08 * n)) < 0.02, `${n} 겹`);
});

test('격살 칼끝 빠르기 × (1 + 0.08 n) — 겨눈 상대의 겹 · 0.7 × 1.4 = 0.98 at 5 · 겹 없음 · C12 없음이면 그대로', () => {
  const S = TRADITIONS.chinese.playerSecret;
  const T = (n, kit = kitAll()) => {
    const G = newRound({ weapon: 'qinggang', weapon2: 'longsword', seed: 1, gap: 1.35, kit });
    try {
      G.ai.update = () => {};
      while (G.t < 1.0) G.step();
      if (n) G.enemy.cnHunt = { n, hits: n, last: new Map(), t5: null };
      assert.ok(G.player.skill.secret({ S, ctx: { slot: 'yoryak', stance: 'yoryak' } }));
      const t0 = G.t;
      while (G.t < t0 + 1.2 && G.player.skill.sec) G.step();
      return G.player.instantArc.share;
    } finally { G.world.free(); }
  };
  assert.equal(SECRET.gyeoksal.share, 0.7);
  assert.equal(T(0), 0.7);
  assert.ok(Math.abs(T(3) - 0.7 * 1.24) < 1e-12);
  assert.ok(Math.abs(T(5) - 0.98) < 1e-12);
  assert.equal(T(5, kitNo12()), 0.7, 'C12 없음');
  assert.equal(huntShareK({ swordArt: { tradition: 'chinese' }, skillKit: kitAll(), foe: { cnHunt: { n: 5 } } }), 1.4);
});

test('격살 판당 1 번: 사람 동방(스킬트리가 있는 몸 — C12 와 상관없이) 1 · AI · 시뮬 몸은 공용 표 3 · AI 스위치면 1 · 다른 유파 1 그대로', () => {
  try {
    assert.equal(secretUsesOf(body()), 1);
    assert.equal(secretUsesOf(body({ kit: kitNo12() })), 1, 'C12 와 상관없이');
    assert.equal(secretUsesOf(body({ kit: null })), 3, 'AI · 시뮬 몸');
    for (const tr of ['german', 'italian', 'iberian', 'japanese']) assert.equal(secretUsesOf(body({ tr })), 1, tr);
    const P = body();
    useSecret(P);
    assert.equal(secretLeft(P), 0, '한 번 쓰면 끝');
    UA.cnHunt.ai = 1;
    assert.equal(secretUsesOf(body({ kit: null })), 1, 'AI 스위치');
    assert.equal(huntUses(body({ tr: 'german', kit: null })), null);
    UA.secretUses = null; // 끝없음 판은 그대로 끝없음
    assert.equal(secretUsesOf(body()), Infinity);
  } finally { reset(); UA.secretUses = { default: 1, chinese: 3 }; }
});

test('AI 스위치: 끔(기본)이면 스킬트리 없는 몸(AI · 시뮬)은 안 쌓음 · 켜면 쌓음', () => {
  try {
    const ai = body({ kit: null });
    assert.equal(huntOn(ai), false);
    const v = {};
    C.huntWound(ai, v, cut());
    assert.equal(huntN(v), 0);
    UA.cnHunt.ai = 1;
    assert.equal(huntOn(ai), true);
    C.huntWound(ai, v, cut());
    assert.equal(huntN(v), 1);
  } finally { reset(); }
});

test('스위치 끔(on 0 — `?cnHunt=0`)이면 전 판: 안 쌓음 · 회복 · 빠르기 · 판당 수(3) 그대로', () => {
  try {
    UA.cnHunt.on = 0;
    const v = {};
    C.huntWound(body(), v, cut());
    assert.equal(huntN(v), 0);
    assert.equal(huntRegenK({ cnHunt: { n: 5 } }), 1);
    assert.equal(huntShareK({ swordArt: { tradition: 'chinese' }, skillKit: kitAll(), foe: { cnHunt: { n: 5 } } }), 1);
    assert.equal(secretUsesOf(body()), 3);
  } finally { reset(); }
});

/** 실제 판 한 토막의 몸 자리 (바이트 견줌) */
function trace(o, steps = 420) {
  const G = newRound({ seed: 5, ...o });
  try {
    const out = [];
    for (let i = 0; i < steps; i++) {
      G.step();
      if (i % 30 === 0) for (const f of [G.player, G.enemy]) { const p = f.bodies.chest.translation(); out.push(p.x, p.y, p.z, f.stamina.value, f.wounds.length); }
    }
    return JSON.stringify(out);
  } finally { G.world.free(); }
}
test('다른 유파 · AI 판은 바이트 같음: 사냥 켬과 끔이 같은 판 (독일 · 일본 사람 몫 · 동방 AI 끼리)', () => {
  try {
    for (const o of [{ weapon: 'longsword', weapon2: 'longsword', kit: kitAll('german') }, { weapon: 'uchigatana', weapon2: 'hwando', kit: kitAll('japanese') }, { weapon: 'hwando', weapon2: 'hwando' }]) {
      UA.cnHunt.on = 1;
      const a = trace(o);
      UA.cnHunt.on = 0;
      assert.equal(trace(o), a, o.weapon);
    }
  } finally { reset(); }
});
