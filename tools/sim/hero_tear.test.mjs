// 용사의 눈물 시험 (사장님 10/17 — docs/import/hero_tear_2026-10-17.md): 방어구 칸 자료 · 목 자리 저장 · 기력 무한 장부(사람 · AI 길) · 클린치 · 실제 판
//  node --test tools/sim/hero_tear.test.mjs   (새 시험 파일 — 다른 시뮬 도구 · 관문 출력은 그대로. 기력 무한은 setInfinite 를 부른 몸만)
import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2 } from 'three';
const storage = new Map();
globalThis.localStorage = { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) };
const { Stamina } = await import('../../src/stamina.js');
const { STAMINA } = await import('../../src/config.js');
const { LOBBY_ARMOR, LOBBY_ARMORS, HERO_TEAR, armorSlot, readLobbyArmor, saveLobbyArmor, readLobbyNeck, saveLobbyNeck } = await import('../../src/lobby_equipment.js');
const { newRound, DT } = await import('./harness_m.mjs');
const { AI } = await import('../../src/ai.js');
const { TECH } = await import('../../src/ai_techniques.js');

const near = (a, b, e = 1e-7) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
function actor(extra = {}) {
  const pos = { x: 0, y: 1, z: 0 };
  const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass: 1.6, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false }, bodies: { pelvis: { translation: () => pos } }, ...extra };
  f.stamina = new Stamina(f); f.pos = pos; return f;
}
const tick = (f, seconds, dt = 1 / 120) => { for (let t = 0; t < seconds - 1e-9; t += dt) f.stamina.step(Math.min(dt, seconds - t)); };
/** 쉬지 않고 몰아붙이기: 베기 · 찌르기 · 비기 · 박차기 · 권총 · 상대 공격 막아 받기 · 걷기 (사람 길 — aiControlled 아님) */
function hammer(f, foe, rounds = 40) {
  for (let i = 0; i < rounds; i++) {
    f.stamina.attack(i % 3 ? 'cut' : 'thrust');
    if (i % 10 === 0) f.stamina.secret();
    if (i % 4 === 0) f.stamina.burst();
    foe.stamina.attack('cut'); f.stamina.block(foe); // 상대 공격 번호마다 한 번
    f.move.set(0, 1); f.pos.x += 0.3; f.gun = { shots: i }; // 앞으로 걷기 0.3 m · 권총 한 발
    tick(f, 1 / 30); tick(foe, 1 / 30);
  }
}

// ── 대기실 자료 · 저장 ──
test('방어구 칸: 케틀 햇 · 용사의 눈물 차례 · 자리(머리 · 목) · 카드 글 · 그림', () => {
  assert.deepEqual(LOBBY_ARMORS.map((a) => a.id), ['kettle', 'hero_tear']);
  assert.equal(LOBBY_ARMORS[0], LOBBY_ARMOR); assert.equal(LOBBY_ARMORS[1], HERO_TEAR);
  assert.deepEqual([armorSlot('kettle'), armorSlot('hero_tear')], ['head', 'neck']);
  assert.equal(HERO_TEAR.nameKo, '용사의 눈물'); assert.equal(HERO_TEAR.tier, 'legend'); assert.equal(HERO_TEAR.infiniteStamina, true);
  assert.equal(`${HERO_TEAR.description} ${HERO_TEAR.ability}`, '용사가 흘린 눈물이 굳었다는 물방울 모양의 다이아. 옷 안에 걸어 겉으로는 보이지 않는다. (기력 무한)');
  assert.equal(HERO_TEAR.thumbnail, 'ui/armor/hero_tear.webp');
  assert.ok(Object.isFrozen(HERO_TEAR) && Object.isFrozen(LOBBY_ARMORS));
});
test('목 자리 저장: 처음부터 걸침 · 걸기/벗기 · 다른 이름 거절 · 머리 자리와 따로 · 저장이 막히면 이번 실행 동안', () => {
  assert.equal(readLobbyNeck(), 'hero_tear'); assert.equal(readLobbyArmor(), 'kettle'); // 새 기기: 케틀 햇 · 용사의 눈물 둘 다 씀 (사장님 10/17 '장착을 기본으로')
  assert.equal(saveLobbyNeck('kettle'), false); assert.equal(saveLobbyNeck('longsword'), false); assert.equal(readLobbyNeck(), 'hero_tear');
  assert.equal(saveLobbyNeck(null), true); assert.equal(readLobbyNeck(), null); assert.equal(storage.get('stillness.lobby.neck.v1'), '{"version":1,"neck":null}'); // 벗으면 벗은 채로 남는다
  assert.equal(saveLobbyNeck('hero_tear'), true); assert.equal(readLobbyNeck(), 'hero_tear');
  assert.equal(storage.get('stillness.lobby.neck.v1'), '{"version":1,"neck":"hero_tear"}');
  assert.equal(saveLobbyArmor(null), true); assert.equal(readLobbyNeck(), 'hero_tear'); assert.equal(readLobbyArmor(), null); // 케틀 햇을 벗어도 목걸이는 그대로
  assert.equal(saveLobbyArmor('kettle'), true); assert.equal(saveLobbyNeck(null), true); assert.equal(readLobbyArmor(), 'kettle'); // 반대도
  assert.equal(storage.get('stillness.lobby.armor.v1'), '{"version":1,"armor":"kettle"}'); // 머리 저장은 전 꼴 그대로
  storage.set('stillness.lobby.neck.v1', '{"version":1,"neck":"crown"}'); assert.equal(readLobbyNeck(), null); // 모르는 이름은 무시 (지난 값 유지)
  storage.set('stillness.lobby.neck.v1', 'not json'); assert.equal(readLobbyNeck(), null);
  const real = globalThis.localStorage;
  try {
    globalThis.localStorage = { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } };
    assert.equal(saveLobbyNeck('hero_tear'), false); assert.equal(readLobbyNeck(), 'hero_tear');
  } finally { globalThis.localStorage = real; saveLobbyNeck(null); }
});

// ── 기력 무한 장부 ──
test('기력 무한: 몰아붙여도 늘 가득 · 지침 · 탈진 없음 · 빠르기/힘 1 · 청구 0 — 횟수 · 공격 번호는 남음 (같은 일을 한 보통 몸은 탈진)', () => {
  const foe = actor({ aiControlled: true });
  const hero = actor(); hero.stamina.setInfinite(true);
  const plain = actor();
  let low = Infinity, slow = 1, exhausted = 0;
  for (let k = 0; k < 4; k++) {
    hammer(hero, foe, 10); hammer(plain, actor({ aiControlled: true }), 10);
    low = Math.min(low, hero.stamina.value); slow = Math.min(slow, hero.stamina.speed, hero.stamina.power); exhausted += hero.stamina.exhausted;
  }
  near(low, 100); near(hero.stamina.value, 100); near(hero.stamina.ratio, 1); assert.equal(hero.stamina.level, 0);
  assert.equal(slow, 1); assert.equal(exhausted, 0); assert.equal(hero.stamina.counts.exhaustion, 0); near(hero.stamina.pose, 0);
  near(sum(hero.stamina.spent), 0);
  assert.equal(hero.stamina.counts.cut + hero.stamina.counts.thrust, 40); assert.equal(hero.stamina.attackId, 44); // 베기 · 찌르기 40 + 비기 4 — 상대 막아 받기 청구가 읽는 번호
  // 같은 일을 한 보통 몸: 깎이고 지치고 탈진했다 (대조)
  assert.ok(plain.stamina.counts.exhaustion >= 1 && sum(plain.stamina.spent) > 100, JSON.stringify(plain.stamina.spent));
  // 상대(보통 몸)는 내 공격을 막아 받으면 전처럼 3 × 무게
  const guard = actor({ aiControlled: true }); guard.stamina.controller = { mode: 'defend' };
  hero.stamina.attack('cut'); guard.stamina.block(hero); near(guard.stamina.spent.block, STAMINA.blockCost);
});
test('기력 무한 + 케틀 햇: 최대 130 · 늘 130 / 바깥에서 값을 바꿔도 다음 스텝에 가득 / 기력 끔이면 100 그대로', () => {
  const f = actor(); f.stamina.setMaxBonus(30); f.stamina.setInfinite(true);
  near(f.stamina.max, 130); near(f.stamina.value, 130); hammer(f, actor({ aiControlled: true }), 12); near(f.stamina.value, 130);
  f.stamina.value = -79; f.stamina.exhaustLeft = 1; f.stamina.level = 3; // 시험 도구가 바꿔 놓은 값
  tick(f, 1 / 120); near(f.stamina.value, 130); assert.equal(f.stamina.exhausted, false); assert.equal(f.stamina.level, 0);
  try {
    STAMINA.on = false;
    const g = actor(); g.stamina.setInfinite(true); near(g.stamina.max, 100); near(g.stamina.value, 100);
    hammer(g, actor({ aiControlled: true }), 5); near(g.stamina.value, 100); near(sum(g.stamina.spent), 0);
  } finally { STAMINA.on = true; }
  const off = actor(); off.stamina.setInfinite(true); off.stamina.setInfinite(false); hammer(off, actor({ aiControlled: true }), 3); assert.ok(off.stamina.value < 100); // 끄면 보통 장부
});
test('클린치: 기력 무한 쪽은 0 · 상대는 전처럼 초당 10 (스텝 차례 무관) — 상대가 탈진하면 밀기 끝', () => {
  for (const reverse of [false, true]) {
    const fs = [1.1, 2.9].map((swordMass) => {
      const position = { x: 0, y: 1, z: 0 };
      const f = { alive: true, armed: true, state: 'stand', heading: 0, swordMass, move: new Vector2(), handOffset: new Vector2(), skill: { vel: new Vector2(), swinging: false },
        canShove: true, stickY: 1, barge: { phase: 'press' }, contact: true, foeDistance: () => 0.5, closeTouch() { return this.contact; }, bodies: { pelvis: { translation: () => position } } };
      f.stamina = new Stamina(f); f.stamina.value = 80; f.stamina.rest = 10;
      return f;
    });
    [fs[0].foe, fs[1].foe] = [fs[1], fs[0]];
    fs[0].stamina.setInfinite(true);
    const order = reverse ? [fs[1], fs[0]] : fs;
    for (let i = 0; i < 240; i++) for (const f of order) f.stamina.step(1 / 120);
    near(fs[0].stamina.value, 100); near(fs[0].stamina.spent.clinch, 0);
    near(fs[1].stamina.value, 60, 1e-6); near(fs[1].stamina.spent.clinch, 20, 1e-6); // 2 초 × 10
    for (let i = 0; i < 1800 && !fs[1].stamina.exhausted; i++) for (const f of order) f.stamina.step(1 / 120);
    assert.equal(fs[1].stamina.exhausted, true); assert.equal(fs[0].stamina.exhausted, false); assert.equal(fs[1].barge, null); // 상대 탈진 → 밀기 끝 (전 규칙)
  }
});

// ── 실제 판 (헤드리스 물리) ──
test('실제 판 · 사람 길: 진짜 긋기 열두 가지를 거듭해도 기력 무한은 0 청구 · 보통 몸은 12 / 10 씩', () => {
  const setup = (infinite, from) => {
    const g = newRound({ weapon: 'longsword', seed: 23, gap: 8, walls: false }); g.ai.update = () => {};
    g.player.handHeld = true; g.player.inputActive = true; g.player.handOffset.set(...from);
    for (let i = 0; i < 240; i++) g.step();
    g.player.stamina = new Stamina(g.player); if (infinite) g.player.stamina.setInfinite(true); g.step();
    g.move = (to, seconds) => { const s = g.player.handOffset.toArray(), n = Math.ceil(seconds / DT); for (let i = 1; i <= n; i++) { g.player.handOffset.set(s[0] + (to[0] - s[0]) * i / n, s[1] + (to[1] - s[1]) * i / n); g.player.inputActive = true; g.step(); } };
    return g;
  };
  for (const infinite of [true, false]) {
    let spent = 0, want = 0, strokes = 0, low = Infinity;
    for (const tech of TECH) {
      const g = setup(infinite, tech.from);
      try {
        for (const to of tech.path) { const from = g.player.handOffset; g.move(to, Math.hypot(to[0] - from.x, to[1] - from.y) / 3); low = Math.min(low, g.player.stamina.value); }
        for (let i = 0; i < 30; i++) g.step();
        spent += g.player.stamina.spent.attack; want += tech.kind === 'thrust' ? 10 : 12; strokes += g.player.stamina.counts.cut + g.player.stamina.counts.thrust;
      } finally { g.world.free(); }
    }
    assert.equal(strokes, TECH.length); // 열두 긋기 모두 공격으로 셈 (번호 · 횟수)
    if (infinite) { near(spent, 0); near(low, 100); } else near(spent, want, 1e-5); // 무게 √(칼 질량 ÷ 1.6) 의 소수 끝
  }
});
test('실제 판 · AI 둘이 맞붙음: 용사의 눈물을 건 쪽(플레이어 자리)은 내내 가득 · 상대는 전처럼 깎임', () => {
  const g = newRound({ weapon: 'longsword', seed: 7, AI2Class: AI });
  try {
    g.player.stamina.setInfinite(true);
    let low = Infinity, slow = 1;
    for (let i = 0; i < 20 * 120 && g.player.alive && g.enemy.alive; i++) { g.step(); low = Math.min(low, g.player.stamina.value); slow = Math.min(slow, g.player.stamina.speed); }
    near(low, 100); assert.equal(slow, 1); near(sum(g.player.stamina.spent), 0); assert.equal(g.player.stamina.counts.exhaustion, 0);
    assert.ok(g.player.stamina.counts.cut + g.player.stamina.counts.thrust > 0, '플레이어 자리가 실제로 공격했다');
    assert.ok(sum(g.enemy.stamina.spent) > 0, JSON.stringify(g.enemy.stamina.spent)); assert.equal(g.enemy.stamina.infinite, false);
  } finally { g.world.free(); }
});
