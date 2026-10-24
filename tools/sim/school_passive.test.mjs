// 유파 패시브 넷 (10/21 사장님 결정 — src/school_passive.js · config SCHOOL_PASSIVE): 이탈리아 곧은 선 · 일본 켄타이 · 독일 인데스 · 동방 숨 바꾸기 (토납).
// 실제 물리 몸(harness_m)에서 패시브 상태 · 배율 · 시계를 본다. 이기나 지나(효과의 크기)는 tools/sim/school_passive_duel.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
const SP = CONFIG.SCHOOL_PASSIVE;
const UA = CONFIG.UNIQUE_ASSIST;
const D2R = Math.PI / 180;

/** 플레이어(AI 없음) weapon · 상대 롱소드(AI 멈춤). 판 시작 정지 지남 */
function fixture(weapon, opts = {}) {
  const g = newRound({ weapon, weapon2: 'longsword', gap: 1.6, seed: 7, ...opts });
  const f = g.player, a = g.enemy;
  g.ai.update = () => {};
  f.foe = a; a.foe = f;
  f.fightT = a.fightT = CONFIG.ARENA.startHold;
  return { g, f, a, sp: f.schoolPassive };
}
const tick = (fx, sec) => { for (let i = 0; i < Math.round(sec / DT); i++) fx.sp.update(DT); };
/** 탭 찌르기를 시작해 뻗는 구간(thrustPush)까지 — 몸 · 물리는 움직이지 않는다(상태만) */
function startTapThrust(f) {
  assert.ok(f.skill.thrust({ step: false }), 'tap thrust starts');
  for (let i = 0; i < 40 && !f.skill.thrustPush; i++) f.skill.updateThrust(DT);
  assert.ok(f.skill.thrustPush, 'in push phase');
}
const ang = (a, b) => a.angleTo(b) / D2R;

// ── 받는 조건 ──
test('book off / wrong school / low proficiency: no passive', () => {
  const off = fixture('uchigatana', { schoolPassive: false });
  try { assert.equal(off.sp.school, null); tick(off, 2); assert.equal(off.sp.charge, 0); assert.equal(off.sp.clotK(), 1); } finally { off.g.world.free(); }
  const ger = fixture('longsword');
  try {
    assert.equal(ger.sp.school, 'german');
    tick(ger, 2);
    assert.equal(ger.sp.charge, 0, 'german body gets no kentai');
    assert.equal(ger.sp.clotK(), 1, 'german body gets no clotting');
  } finally { ger.g.world.free(); }
  const cn = fixture('qinggang');
  try { cn.sp.foeFailed('whiff'); assert.equal(cn.sp.indesOpen, false, 'chinese body gets no indes'); } finally { cn.g.world.free(); }
  // AI: 숙련도 at(4) 아래면 없음 · 이상이면 AI 몫
  for (const [p, want] of [[3, null], [4, 'japanese']]) {
    const g = newRound({ weapon: 'longsword', weapon2: 'uchigatana', seed: 3, persona: { proficiency: p } });
    try { assert.equal(g.enemy.schoolPassive.school, want); if (want) assert.equal(g.enemy.schoolPassive.ai, true); } finally { g.world.free(); }
  }
});

test('switches: SCHOOL_PASSIVE.on and per-school on turn it off', () => {
  const fx = fixture('uchigatana');
  try {
    tick(fx, 1.5);
    assert.ok(Math.abs(fx.sp.charge - SP.japanese.gain) < 1e-9);
    SP.on = false; assert.equal(fx.sp.charge, 0);
    SP.on = true; SP.japanese.on = false; assert.equal(fx.sp.charge, 0);
  } finally { SP.on = true; SP.japanese.on = true; fx.g.world.free(); }
});

// ── 이탈리아 곧은 선 ──
for (const ai of [false, true]) {
  test(`italian: tip turns toward the target, capped and rate-limited (${ai ? 'AI half' : 'player'})`, () => {
    const fx = fixture('rapier');
    try {
      const { f, sp } = fx;
      assert.equal(sp.school, 'italian');
      sp.ai = ai;
      const k = ai ? SP.italian.aiK : 1;
      const cap = SP.italian.tipMax * k, rate = SP.italian.tipRate * k;
      startTapThrust(f);
      const aim0 = new THREE.Vector3(-0.2, 0.3, 1).normalize(); // 상대에서 크게 벗어난 처음 줄 (몸 틀 — 앞 = +x)
      const fwd = new THREE.Vector3(1, 0, 0);
      let prev = 0;
      for (let i = 0; i < 120; i++) {
        const a = aim0.clone();
        sp.tipAim(a, DT);
        const c = ang(a, aim0);
        assert.ok(c <= cap + 1e-6, `total correction ${c.toFixed(3)}° ≤ ${cap}°`);
        assert.ok(c - prev <= rate * DT + 1e-6, `rate ${((c - prev) / DT).toFixed(2)}°/s ≤ ${rate}`);
        if (i === 0) assert.ok(ang(a, fwd) < ang(aim0, fwd), 'turns toward the foe');
        prev = c;
      }
      assert.ok(prev > cap - 0.01, `reaches the cap (${prev.toFixed(3)}°)`);
      // 찌르기가 끝나면 같은 빠르기로 걷는다 (튀지 않음)
      f.skill.tap = null; f.skill.thrustPush = false;
      const a = aim0.clone(); sp.tipAim(a, DT);
      const c = ang(a, aim0);
      assert.ok(c < prev && prev - c <= rate * DT + 1e-6, 'released smoothly');
      assert.equal(sp.stats.tip.thrusts, 1);
    } finally { fx.g.world.free(); }
  });
}

test('italian: no correction for parry-thrust (opposition), secret, or non-thrust', () => {
  const fx = fixture('rapier');
  try {
    const { f, sp } = fx;
    const aim0 = new THREE.Vector3(-0.2, 0.3, 1).normalize();
    const same = () => { const a = aim0.clone(); sp.tipAim(a, DT); return ang(a, aim0); };
    assert.equal(same(), 0, 'not thrusting');
    startTapThrust(f);
    f.skill.sec = { fake: true }; assert.equal(same(), 0, 'secret');
    f.skill.sec = null;
    f.parryGuard = { opposition: { run: {} } }; assert.equal(same(), 0, 'opposition');
    f.parryGuard = null;
    assert.ok(same() > 0, 'normal tap corrects');
  } finally { fx.g.world.free(); }
});

// ── 일본 켄타이 ──
test('kentai: linear ramp to +30% over 1.5 s of no attack, capped', () => {
  const fx = fixture('uchigatana');
  try {
    const { sp } = fx;
    tick(fx, 0.75); assert.ok(Math.abs(sp.charge - 0.15) < 0.01, `half ${sp.charge}`);
    tick(fx, 0.75); assert.ok(Math.abs(sp.charge - 0.3) < 0.01, `full ${sp.charge}`);
    tick(fx, 2); assert.ok(Math.abs(sp.charge - SP.japanese.gain) < 1e-9, 'capped');
  } finally { fx.g.world.free(); }
});

test('kentai: stroke start locks the charge and resets the build; no build while swinging; spent on hit', () => {
  const fx = fixture('uchigatana');
  try {
    const { f, sp } = fx;
    tick(fx, 2);
    startTapThrust(f);
    assert.ok(Math.abs(sp.lock.ken - 0.3) < 1e-9, 'locked');
    assert.equal(sp.charge, 0, 'build reset');
    tick(fx, 0.1); assert.equal(sp.charge, 0, 'no build while thrusting');
    assert.ok(Math.abs(sp.dealtK() - 1.3) < 1e-9, 'dealt × 1.3');
    sp.onHit({ schoolK: sp.dealtK(), schoolLock: sp.lastLock });
    assert.equal(sp.dealtK(), 1, 'spent after the wounding hit');
    assert.equal(sp.stats.ken.hits, 1);
  } finally { fx.g.world.free(); }
});

test('kentai: missed charge carries to tsubame-gaeshi started within 0.6 s, else lost', () => {
  for (const [gap, tsu, want] of [[0.4, true, 0.3], [0.4, false, null], [UA.afterWindow + 0.1, true, null]]) {
    const fx = fixture('uchigatana');
    try {
      const { f, sp } = fx;
      tick(fx, 2);
      startTapThrust(f); // 1: 묶임 0.3
      f.skill.tap = null; f.skill.thrustPush = false; // 못 맞히고 끝남
      tick(fx, gap);
      const fresh = sp.charge;
      if (tsu) f.artTech = 'tsubameGaeshi'; // 지금 긋는 기술 = 츠바메가에시 (unique_assist.js strokeTechOf)
      startTapThrust(f); // 2
      const k = sp.dealtK();
      f.artTech = null;
      if (want != null) assert.ok(Math.abs(k - (1 + want)) < 1e-9, `carried ${k}`);
      else assert.ok(Math.abs(k - (1 + fresh)) < 1e-9, `only fresh charge ${k} (gap ${gap}, tsubame ${tsu})`);
    } finally { fx.g.world.free(); }
  }
});

test('kentai: never on secret strikes', () => {
  const fx = fixture('uchigatana');
  try {
    const { f, sp } = fx;
    tick(fx, 2);
    f.skill.sec = { fake: true };
    f.stamina.attack('cut', true); // 비기 수 (skill.js secretNextMove 와 같은 청구)
    assert.equal(sp.lock.ken, 0);
    assert.equal(sp.dealtK(), 1);
  } finally { fx.f.skill.sec = null; fx.g.world.free(); }
});

// ── 독일 인데스 ──
test('indes: opens on foe whiff and on block (AI attacker afterStrike), not when hit', () => {
  for (const [landed, bound, kind] of [[false, false, 'whiff'], [false, true, 'blocked'], [true, true, null]]) {
    const fx = fixture('longsword');
    try {
      const { g, sp } = fx;
      g.ai.hitLanded = landed; g.ai.bound = bound;
      g.ai.afterStrike(4);
      assert.equal(sp.indesOpen, !!kind, `${landed}/${bound}`);
      if (kind) assert.equal(sp.stats.indes[kind], 1);
    } finally { fx.g.world.free(); }
  }
});

test('indes: AI german gets the window from the player failed attack (skill.js whiffEnd)', () => {
  const fx = fixture('longsword');
  try {
    const { f, a } = fx;
    a.schoolPassive.set('german', { ai: true });
    f.skill.whiffEnd({ on: true, landed: false, bound: false, att: false }, a);
    assert.equal(a.schoolPassive.indesOpen, false, 'a non-attack swing (preparation) does not count');
    f.skill.whiffEnd({ on: true, landed: false, bound: true, att: true }, a);
    assert.equal(a.schoolPassive.indesOpen, true);
    assert.equal(a.schoolPassive.stats.indes.blocked, 1);
  } finally { fx.g.world.free(); }
});

test('indes: closes after afterWindow (0.6 s); a stroke inside gets +30% (AI × aiK)', () => {
  const fx = fixture('longsword');
  try {
    const { f, sp } = fx;
    sp.foeFailed('whiff');
    tick(fx, 0.2);
    assert.equal(f.indesOpen, true, 'fighter getter');
    assert.ok(Math.abs(f.indesLeft - (UA.afterWindow - 0.2)) < 0.01, `indesLeft ${f.indesLeft}`);
    tick(fx, UA.afterWindow - 0.22); assert.equal(sp.indesOpen, true);
    tick(fx, 0.04); assert.equal(sp.indesOpen, false, 'closed');
    assert.equal(f.indesOpen, false); assert.equal(f.indesLeft, null);
    sp.foeFailed('blocked');
    tick(fx, 0.2);
    startTapThrust(f);
    assert.equal(sp.indesOpen, false, 'used by the stroke');
    assert.ok(Math.abs(sp.dealtK() - 1.3) < 1e-9);
    sp.onHit({ schoolK: sp.dealtK(), schoolLock: sp.lastLock });
    assert.ok(Math.abs(sp.dealtK() - 1.3) < 1e-9, 'whole stroke (not spent per hit)');
    assert.equal(sp.stats.indes.hits, 1);
  } finally { fx.g.world.free(); }
  const fa = fixture('longsword');
  try {
    fa.sp.ai = true; SP.german.aiK = 0.5;
    fa.sp.foeFailed('whiff'); startTapThrust(fa.f);
    assert.ok(Math.abs(fa.sp.dealtK() - 1.15) < 1e-9, 'aiK');
  } finally { SP.german.aiK = 1; fa.g.world.free(); }
});

test('indes: clock pauses during gap-closing fast steps and hold, closes when the hold ends', () => {
  const fx = fixture('longsword');
  try {
    const { f, sp } = fx;
    const g = f.gait;
    sp.foeFailed('whiff');
    tick(fx, 0.3);
    g.fastK = 1.5; g.chaseStep = true; // 간격 잡기 빠른 디딤 시작
    tick(fx, 0.5); assert.equal(sp.indesOpen, true, 'paused during fast steps');
    assert.equal(f.indesOpen, true); assert.equal(f.indesLeft, null, 'no countdown while paused');
    g.fastK = 1; g.chaseStep = false; g.hold = { t: 0, T: 0.6 }; // 잡기
    tick(fx, 0.6); assert.equal(sp.indesOpen, true, 'paused during hold');
    g.hold = null; tick(fx, DT); assert.equal(sp.indesOpen, false, 'closes at hold end');
    // 잡기 없이 빠른 디딤만 끝나면 남은 시계
    sp.foeFailed('whiff'); tick(fx, 0.3);
    g.fastK = 1.5; g.chaseStep = true; tick(fx, 0.5);
    g.fastK = 1; g.chaseStep = false;
    tick(fx, UA.afterWindow - 0.3 - 0.03); assert.equal(sp.indesOpen, true, 'remaining clock');
    tick(fx, 0.06); assert.equal(sp.indesOpen, false);
  } finally { fx.g.world.free(); }
});

test('indes: not on secret (window closes, no bonus)', () => {
  const fx = fixture('longsword');
  try {
    const { f, sp } = fx;
    sp.foeFailed('whiff');
    f.skill.sec = { fake: true };
    f.stamina.secret();
    assert.equal(sp.indesOpen, false);
    assert.equal(sp.lock.indes, 0);
    assert.equal(sp.dealtK(), 1);
  } finally { fx.f.skill.sec = null; fx.g.world.free(); }
});

// ── 동방 숨 바꾸기 (토납) ──
test('chinese: bleeding clots ×2 only while not swinging', () => {
  const fx = fixture('qinggang');
  try {
    const { f, sp } = fx;
    tick(fx, DT);
    assert.equal(sp.clotK(), SP.chinese.clot);
    const decay = () => { f.bleed = 0.02; const b = f.bleed; f.updateVitals(DT); return (b - f.bleed) / (b * DT); };
    assert.ok(Math.abs(decay() - CONFIG.VITALS.clotting * 2) < 1e-6, 'idle: × 2');
    startTapThrust(f); tick(fx, DT);
    assert.equal(sp.clotK(), 1);
    assert.ok(Math.abs(decay() - CONFIG.VITALS.clotting) < 1e-6, 'swinging: normal');
  } finally { fx.g.world.free(); }
});

// ── 실제 판 (AI 대 AI · 숙련도 4) — 배율이 실제 맞음에 실린다 ──
test('real fight: kentai and indes bonuses reach real wounds', () => {
  for (const [w, key] of [['uchigatana', 'ken'], ['longsword', 'indes']]) {
    const g = newRound({ weapon: w, weapon2: 'longsword', seed: 1002, AI2Class: AI, persona: { proficiency: 4 }, persona2: { proficiency: 4 } }); // 씨앗 1001 → 1002 (10/24 17:2x 팔꿈치 돌림 · 손목 교정 — 1001 은 30 s 안에 독일 indes 가 안 터짐 · 1002 = ken 2 · indes 1)
    try {
      let boosted = 0;
      const pw = g.combat.hooks.onWound;
      g.combat.hooks.onWound = (att, vic, r, ...rest) => { pw?.(att, vic, r, ...rest); if (att === g.player && r.schoolK > 1) boosted++; };
      for (let i = 0; i < 30 / DT; i++) { g.step(); if (!g.player.alive || !g.enemy.alive) break; }
      assert.ok(g.player.schoolPassive.stats[key].hits >= 1, `${key} hits`);
      assert.ok(boosted >= 1, 'a wound carried schoolK');
    } finally { g.world.free(); }
  }
});
