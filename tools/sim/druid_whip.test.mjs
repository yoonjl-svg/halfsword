// 드루이드의 채찍 시험 (10/23 — 샛별 저장소 69ef7dac8 에서 들여옴 · docs/import/druid_whip_2026-10-23.md)
//  스펙 · 글 · 뽑기 칸 · 인물 무기 아님 · 마디 물리(8 마디 · 벌어짐 · 유한 · 부서지지 않음) · 덩굴 값(지금 값 — 판 고르기 걷음 11/17) · 톡 = 손목 튕기기
//  node --test tools/sim/druid_whip.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WEAPONS, WEAPON_LIST, RETIRED_WEAPONS, TIER_DRAW, getWeapon, weaponSpecText } from '../../src/weapons.js';
import { traditionOf } from '../../src/schools.js';
import { CHARACTERS } from '../../src/characters.js';
import { WHIP, WHIP_NOW, DRUID } from '../../src/druid_whip.js';
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';

class Quiet { update() {} }
const W = () => getWeapon('druid_whip');

test('스펙 · 글: ??? · 한손 · 무유파 · 나무 · 날 없음 · 둔타 3(10/23 셋째 일 — 샛별 값 1.5) · 부서지지 않음 · 770 g · 173 cm · 두 줄 숫자 없음', () => {
  const w = W();
  assert.equal(w.id, 'druid_whip');
  assert.equal(w.nameKo, '드루이드의 채찍');
  assert.equal(w.tier, 'mystery');
  assert.equal(w.power, 1);
  assert.equal(w.grip, 'one-hand');
  assert.equal(traditionOf(w), 'none');
  assert.equal(w.material, 'wood');
  assert.equal(w.edged, false);
  assert.equal(w.mBlunt, 3);
  assert.equal(w.fragile, false);
  assert.equal(w.breakChance(1e9), 0);
  assert.equal(weaponSpecText(w), '한손 채찍, 173 cm, 0.77 kg');
  const lines = w.desc.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(!/[0-9]/.test(w.desc));
  // 끝 무게를 바꿔도 합 질량 · 길이는 그대로
  const parts = w.buildParts({});
  assert.ok(Math.abs(parts.reduce((a, q) => a + q[2][0], 0) - DRUID.mass) < 1e-9);
  assert.equal(parts.length, 2 + DRUID.count);
});

test('뽑기 · 인물: 사람 카드 ??? 칸 넷째 · 첫 장 확률 1.5 % · 인물 무기 목록에는 없음', () => {
  const pool = WEAPON_LIST.map((x) => x.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id)); // main.js PLAYER_WEAPON_POOL 과 같은 목록
  assert.ok(pool.includes('druid_whip'));
  const mystery = new Set(pool.filter((id) => getWeapon(id).tier === 'mystery').map((id) => getWeapon(id).drawGroup || id));
  assert.equal(mystery.size, 4);
  const total = Object.values(TIER_DRAW).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(TIER_DRAW.mystery / total / mystery.size - 0.015) < 1e-12);
  for (const c of CHARACTERS) assert.notEqual(c.weapon, 'druid_whip', c.id);
  assert.ok(!getWeapon('druid_whip').characterOnly);
});

test('덩굴 값 = 지금 값 (10/23 검수 — 덧 풀이 1 · 서보 10 · 굽힘 감쇠 8 · 끝 매듭 없음) · 무기 칸 서보도 같다', () => {
  assert.equal(WHIP.iters, WHIP_NOW.iters); assert.equal(WHIP.tip, WHIP_NOW.tip);
  assert.deepEqual(W().controlOverrides, { ...W().controlOverrides, ...WHIP_NOW.servo });
});

test('칼 닿는 마디 (10/23 셋째 일 · WHIP.bladeFrom): 지금 = 마디 4 ~ 8 만 상대 칼과 부딪힘 · 상대 몸은 모든 마디 · 제 몸통은 빠짐', () => {
  CONFIG.ARENA.startHold = 0;
  assert.equal(WHIP_NOW.bladeFrom, 3);
  for (const [p, from] of [['now', 3]]) {
    const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', gap: 1.35, seed: 3, AIClass: Quiet, AI2Class: Quiet });
    const P = g.player, E = g.enemy;
    const foeBlade = E.swordColliders[0].collisionGroups() >>> 16, foeBody = E.bodies.chest.collider(0).collisionGroups() >>> 16;
    const myTorso = P.bodies.chest.collider(0).collisionGroups() >>> 16;
    P.flexWeapon.segments.forEach((sg, i) => {
      const filter = sg.col.collisionGroups() & 0xffff;
      assert.equal(!!(filter & foeBlade), i >= from, `${p} 마디 ${i + 1} 상대 칼`);
      assert.ok(filter & foeBody, `${p} 마디 ${i + 1} 상대 몸`);
      assert.equal(filter & myTorso, 0, `${p} 마디 ${i + 1} 제 몸통`);
    });
    g.world.free();
  }
});

test('덩굴 길이 · 무게 · 테이퍼 (10/23 넷째 · 다섯째 일 · WHIP.lash · mass · tip · taper): 지금 = 끝 매듭 없음 · 테이퍼 6 : 1 · 길이 1.44 m · 0.77 kg 그대로 · 길이 · 무게는 판을 따라 무기 칸 · 카드 스펙 · 마디가 바뀜', () => {
  CONFIG.ARENA.startHold = 0;
  assert.equal(WHIP_NOW.lash, 1.44); assert.equal(WHIP_NOW.mass, 0.77);
  assert.equal(WHIP_NOW.tip, 0);
  assert.equal(WHIP_NOW.taper[0] / WHIP_NOW.taper[7], 6);
  const parts = W().buildParts({}).slice(2).map((q) => q[2][0]);
  for (let i = 1; i < 8; i++) assert.ok(parts[i] < parts[i - 1], `마디 ${i + 1} 이 손 쪽보다 가볍다`);
  assert.ok(parts[0] > 5 * parts[7], '손 쪽 마디가 끝 마디의 5 배 넘게 무겁다');
  // 덩굴 칸 길이 · 무게를 바꾸면 무기 칸 · 카드 스펙 · 마디 길이가 따른다 (시험 도구 whip_duel.mjs --whip 과 같은 길)
  Object.assign(WHIP, { lash: 1.8, mass: 0.9 });
  assert.equal(W().bladeLength, 1.8);
  assert.equal(weaponSpecText(W()), '한손 채찍, 209 cm, 0.9 kg');
  const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', gap: 1.35, seed: 3, AIClass: Quiet, AI2Class: Quiet });
  assert.ok(Math.abs(g.player.flexWeapon.L - 0.225) < 1e-9);
  assert.equal(g.player.weaponCfg.bladeLength, 1.8);
  assert.ok(Math.abs(g.player.stamina.originalMass - 0.9) < 1e-6);
  g.world.free();
  Object.assign(WHIP, { lash: WHIP_NOW.lash, mass: WHIP_NOW.mass });
  assert.equal(W().bladeLength, 1.44);
  assert.equal(weaponSpecText(W()), '한손 채찍, 173 cm, 0.77 kg');
});


test('톡 = 손목 튕기기 (사람 · 마무리 아님): 손 목표가 올라갔다 내려오고 끝나면 놓는다 · 덩굴 끝이 앞으로', () => {
  CONFIG.ARENA.startHold = 0;
  const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', seed: 13, gap: 3.0, AIClass: Quiet });
  const f = g.player;
  for (let i = 0; i < 1 / DT; i++) g.step();
  assert.equal(f.skill.thrust(), true);
  assert.ok(f.skill.flick);
  assert.equal(f.skill.tap, null); // 찌르기 동작은 시작하지 않는다
  let top = -9, fwd = -9;
  for (let i = 0; i < 0.8 / DT; i++) {
    g.step();
    top = Math.max(top, f.handOffset.y);
    const t = f.bladePoint(1), c = f.bodies.chest.translation(), fw = f.forward();
    fwd = Math.max(fwd, (t.x - c.x) * fw.x + (t.z - c.z) * fw.z);
  }
  assert.ok(top > 0.4, `손 위 ${top}`);
  assert.equal(f.skill.flick, null);
  assert.equal(f.handHeld, false);
  assert.ok(fwd > 0.9, `끝 앞 ${fwd}`);
  g.world.free();
});

test('무릎 꿇리기 (사장님 10/23 · config WHIP_KNEEL): 채찍만 · 한 획에 한 번(첫 맞음) · p 1 이면 맞은 쪽이 꿇음 · p 0 이면 없음 · AI 채찍은 굴리지 않음', async () => {
  const { WHIP_KNEEL } = await import('../../src/config.js');
  assert.equal(WHIP_KNEEL.p, 0.5); assert.equal(WHIP_KNEEL.kneel, CONFIG.realS(0.6)); /* 11/15 사장님 '채찍도 같이 0.6초로 해' (전 0.4) */ // 꿇는 시간 실제 0.4 s (표준 시간 10/25)
  assert.equal(W().kneelHit, true);
  for (const w of WEAPON_LIST) if (w.id !== 'druid_whip') assert.ok(!w.kneelHit, w.id);
  CONFIG.ARENA.startHold = 0;
  const p0 = WHIP_KNEEL.p;
  // 꿇음 봄(e.state 'getup')은 휘청 게이지로 넘어진 것도 셈 — 10/31 자연 바인드 본판 때는 이 씨앗 p 0 판도 게이지로 넘어져 옛 칼 물리로 묶었음 · 11/17 스위치 걷은 뒤 본판 그대로 지나감
  const run = (p, aiWhip = false) => {
    WHIP_KNEEL.p = p;
    const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', seed: 13, gap: 1.5, AIClass: Quiet, ...(aiWhip ? { AI2Class: AI } : {}) });
    const f = g.player, e = g.enemy;
    let kneeled = false;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 1.0 / DT; i++) { g.step(); if (e.state === 'getup') kneeled = true; }
      if (!aiWhip) f.skill.thrust();
      for (let i = 0; i < 0.8 / DT; i++) { g.step(); if (e.state === 'getup') kneeled = true; }
    }
    const log = g.combat.whipKneelLog ?? [];
    const hits = g.wounds.filter((x) => x.att === f).length;
    g.world.free();
    return { log, hits, kneeled };
  };
  const a = run(1);
  assert.ok(a.hits > a.log.length, `판정 ${a.hits} · 굴림 ${a.log.length}`); // 한 획에 판정이 여럿이어도 굴림은 하나
  const perStroke = new Map();
  for (const x of a.log) perStroke.set(x.stroke, (perStroke.get(x.stroke) ?? 0) + 1);
  for (const n of perStroke.values()) assert.equal(n, 1);
  assert.ok(a.log.some((x) => x.hit) && a.kneeled, '꿇음');
  const b = run(0);
  assert.equal(b.log.length, 0);
  assert.equal(b.kneeled, false);
  const c = run(1, true); // AI 가 든 채찍 — 굴리지 않음
  assert.equal(c.log.filter((x) => x.att === 0).length, 0);
  WHIP_KNEEL.p = p0;
});

test('섬네일 (10/24 사장님 확정 — 처음 만든 넓은 원형 그림 · 샛별 저장소 537a7bd8): 게임 WebP = 승인 해시 = art 마스터 · 원본 1254² PNG 보관 · 다시 찍기 도구가 마스터를 그대로 복사', async () => {
  const fs = await import('node:fs'), crypto = await import('node:crypto');
  const root = (p) => new URL(`../../${p}`, import.meta.url), sha = (p) => crypto.createHash('sha256').update(fs.readFileSync(root(p))).digest('hex');
  const m = JSON.parse(fs.readFileSync(root('art/druid-whip-thumb-20261024/manifest.json'), 'utf8'));
  assert.equal(sha('public/ui/weapons/druid_whip.webp'), 'a649b44ed7eaba6c4f99440af2b7fb2798c92af193f5add38dd3ec6838612175');
  for (const f of Object.values(m.files)) assert.equal(sha(f.path), f.sha256, f.path);
  assert.equal(m.files.game.sha256, sha('public/ui/weapons/druid_whip.webp'));
  const png = fs.readFileSync(root(m.files.original.path));
  assert.deepEqual([png.toString('latin1', 12, 16), png.readUInt32BE(16), png.readUInt32BE(20), png[25]], ['IHDR', 1254, 1254, 6]); // 1254² RGBA
  const webp = fs.readFileSync(root('public/ui/weapons/druid_whip.webp'));
  assert.deepEqual([webp.toString('latin1', 0, 4), webp.toString('latin1', 8, 12)], ['RIFF', 'WEBP']);
  assert.match(fs.readFileSync(root('tools/browser/weapon_thumbs.mjs'), 'utf8'), /KEEP = \{ druid_whip: '\.\.\/\.\.\/art\/druid-whip-thumb-20261024\/game\.webp' \}/);
});
