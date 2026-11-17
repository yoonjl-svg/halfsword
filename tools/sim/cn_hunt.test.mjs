// 동방 맹호은림 사냥 겹 시험 (11/14 — src/cn_hunt.js · config UNIQUE_ASSIST.cnHunt · 새 칸 C12 · 기록 docs/strike/cn_hunt_2026-11-14.md):
//  사장님 11/14 '동방은 사냥감을 말려죽이는 고양이과 맹수야' · '빠지는 규칙은 안 둘게' · '3번 제한을 다른 비기처럼 1번으로' · '스택당 기력 회복 -8% 격살 빠르기 +8%'.
//  11/14 '동방과 일본은 전부 권고대로' — 쌓임은 몸 어디든 칼날 상처(전 판 몸통만 = torso 1) · 격살 판당 1 번은 공용 표(사람 · AI 같음).
//  쌓임 조건(허리를 베는 세 칼 · 칼날 베기 · 상처 > 0 · 사람은 C12 · 공격 하나에 한 겹) · 상한 5 · 빠지지 않음 · 기력 회복 −8 %/겹 · 격살 빠르기 × (1 + 0.08 n) ·
//  격살 판당 1 번 · 스위치 끔이면 겹 전 판 · AI 스위치 · 다른 유파 바이트 같음.  node --test tools/sim/cn_hunt.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { huntOn, huntHit, huntRegenK, huntN } from '../../src/cn_hunt.js';
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

test('기본값 — 켬 · 상한 5 · 기력 회복 −10 %/겹(11/16 — 전 −8 %) · 격살 빠르기 몫 share 0.08(풀기 끔 판) · 몸 어디든 · AI 도 쌓음 · 모든 칼날 상처로 쌓임 · 8.0 s 뒤 사라짐(11/16) · 동방 판당 1 번(공용 표) [사장님 11/14 · 11/16]', (t) => {
  assert.deepEqual(UA.cnHunt, { max: 5, regen: 0.1, life: CONFIG.realS(8.0) }); // 11/16 사장님 결정 '대신 기력 회복 -10%' · '8초로 하자' · '모든 공격 성공으로 쌓이게' — regen 0.08 → 0.10 · life · any 더함 (ai 1 = 11/14 '동방도 격살 쓰게 해')
  assert.deepEqual(UA.secretUses, { default: 1, chinese: 1 }); // 11/14 '다른 비기처럼 1번으로' — 사람 · AI 같은 표 (전 chinese 3)
  assert.deepEqual(UA.yaojiBleed.techs, ['yaoji', 'chebuYaoji', 'lianchi']);
  assert.deepEqual(UA.yaojiBleed.zones, ['chest', 'abdomen', 'pelvis']);
});

test('칸 C12 맹호은림: 출혈 심화 C4 다음 · 심화 · 깊이 3 · 금화 400 · 몫 cnHunt 하나 · 오의 간수세(호준)', () => {
  const n = nodeOf('chinese', 'C12');
  assert.deepEqual([n.name, n.cat, [...n.pre], n.d, n.cx, n.price, n.heads, [...n.f]], ['맹호은림', 'deep', ['C4'], 3, 130, 400, 0, ['cnHunt']]);
  assert.ok(KIT_KEYS.includes('cnHunt'));
  assert.equal(kitAll().cnHunt, true);
  assert.equal(kitNo12().cnHunt, false);
  assert.match(n.src, /권2 예도 — 간수세/); // 11/14 '전부 권고대로' — 간수세(호준) [원문] (전 본국검 맹호은림세 [풀이])
  assert.equal(n.lore, '병기를 지켜 살펴 나아가지 못하게 하고, 기미를 보아 형세를 따라 굴려 죽인다');
  assert.ok(!/[0-9]/.test(n.eff) && !n.eff.includes(' · '), '효과 글: 숫자 · 꼬리 없음');
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





test('스킬트리 없는 몸(AI · 시뮬)도 쌓음 (11/14)', () => {
  try {
    const ai = body({ kit: null });
    const v = {};
    assert.equal(huntOn(ai), true);
    C.huntWound(ai, v, cut());
    assert.equal(huntN(v), 1);
  } finally { reset(); }
});

