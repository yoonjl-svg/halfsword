// 비기 소리 시험 (10/25 사장님 '샛별이 비기 소리 보낸 거 입혀' — 샛별 저장소 2fa0b2ae · docs/import/secret_audio_import_2026-10-25.md · 확인표 2542 ~ 2545):
//  사람 비기 다섯(고노센 · 안다레 리솔루토 · 격살 · 싱지르 · 모르트슐라크)과 AI 비기 셋(고노센 · 싱지르 · 모르트슐라크 — 이탈리아 · 동방은 AI 에게 닫힘 SECRET.aiOpenSchools)을
//  머리 없는 판(harness_m)에서 실제 실행부로 내고, 물리 스텝마다 src/secret_sfx.js SecretSfxWatch.tick → src/sound.js Sound.secretSfx(소리 카드 없는 가짜)로 간 소리 요청을 센다:
//  한 비기 = 정확히 한 번 · 낸 사람 유파의 파일 · 준비(창 · 고노센 / 싱지르 준비 · 누르기 창) · 못 냄 · 실행 실패 = 0 · 재생 빠르기 1 · 쇳소리 묶음 · 음량 SOUND.secretSfxGain
//  node --test tools/sim/secret_sfx.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { SecretSfxWatch, secretSfxFile, secretSfxMode, secretFizzled } from '../../src/secret_sfx.js';

const { Sound } = await import('../../src/sound.js');
const { TRADITIONS, playerSecretDef } = await import('../../src/schools.js');
const { PlayerSecretWatch } = await import('../../src/secret.js');
const { CHARACTERS_BY_ID } = await import('../../src/characters.js');
const { SOUND, SECRET, SKILL } = CONFIG;
const root = (p) => new URL(`../../${p}`, import.meta.url);
const G1 = 'secret/g1-clank';
const G2 = 'secret/g2-dry';

/** 소리 카드 없이 Sound.secretSfx 만 돌리는 가짜 — 어떤 녹음을 어느 묶음 · 음량 · 빠르기로 냈나만 적는다 */
function fakeSound() {
  const s = Object.create(Sound.prototype);
  const played = [];
  Object.assign(s, { _on: true, ctx: { currentTime: 0 }, useSamples: true, master: 'master', fleshBus: 'flesh', metalBus: 'metal', voices: [] });
  s.samples = { [`secret:${G1}`]: [{ name: G1 }], [`secret:${G2}`]: [{ name: G2 }] };
  s.event = (o) => {
    const ev = { ...o, srcs: [], end: s.ctx.currentTime };
    ev.out = { gain: { setTargetAtTime: (v) => (ev.stopped = v === 0) } };
    return ev;
  };
  s.layer = (ev, buf, o) => {
    ev.end = s.ctx.currentTime + 0.34;
    played.push({ file: buf.name, bus: ev.bus, gain: ev.gain, layer: o.gain, rate: o.rate, prio: ev.prio });
  };
  return { s, played };
}

/** 판 하나의 걸쇠: 사람(player.skill) · AI(ai) 수를 따로 — main.js newRound 와 같은 짝 */
function watchRound(g, s) {
  const reqs = [];
  const W = new SecretSfxWatch(
    [
      { who: 'player', fighter: g.player, count: () => g.player.skill.secretBursts, run: () => g.player.skill.sec },
      { who: 'ai', fighter: g.enemy, count: () => g.ai.secretBursts, run: () => g.ai.secretRun },
    ],
    (file, who, school) => {
      const n = s.played.length;
      s.s.secretSfx(file);
      reqs.push({ file, who, school, t: g.t, sounded: s.played.length - n });
    },
  );
  return { W, reqs };
}

/** 사람 비기 다섯 (secret_trail_probe.mjs 와 같은 판: 무기 · 유파 · 사이 · 창 사건) */
const CASES = {
  gonosen: { weapon: 'uchigatana', tr: 'japanese', gap: 1.9, ctx: {}, file: G1 },
  riso: { weapon: 'rapier', tr: 'italian', gap: 1.6, ctx: { ev: 'risoluto', path: 'hold', held: 0.6 }, file: G1 },
  gyeoksal: { weapon: 'qinggang', tr: 'chinese', gap: 1.35, ctx: { ev: 'gyeoksal', slot: 'geojeong', stance: 'geojeong' }, file: G1 },
  spin: { weapon: 'zweihander', tr: 'iberian', gap: 2.1, ctx: { ev: 'spin' }, file: G2 },
  mord: { weapon: 'longsword', tr: 'german', gap: 0.75, ctx: { ev: 'press' }, file: G2 },
};

function playerRound(C) {
  const g = newRound({ weapon: C.weapon, weapon2: 'longsword', gap: C.gap, seed: 3, walls: false });
  g.ai.update = () => {}; // 상대는 멈춤 (사람 비기만 본다)
  Object.assign(g.player.skill, { corr: SKILL.corr, corrTip: SKILL.corrTip, autoGuard: true });
  g.player.canShove = true;
  return g;
}

/** 사람 비기 하나를 내고 비기가 끝난 뒤 1 s 까지 스텝마다 tick — 소리 요청 목록 */
function firePlayer(key) {
  const C = CASES[key];
  const g = playerRound(C);
  const s = fakeSound();
  const { W, reqs } = watchRound(g, s);
  try {
    for (let i = 0; i < Math.round(1.6 / DT); i++) { g.step(); W.tick(); }
    assert.equal(reqs.length, 0, `${key}: 내기 전 0`);
    const S = playerSecretDef(C.tr) ?? TRADITIONS[C.tr].secret;
    assert.ok(g.player.skill.secret({ S, ctx: C.ctx }), `${key}: 비기를 냄`);
    let end = null;
    for (let i = 0; i < Math.round(5 / DT) && (end == null || g.t - end < 1); i++) {
      g.step();
      W.tick();
      if (end == null && !g.player.skill.sec) end = g.t;
    }
    assert.ok(end != null, `${key}: 비기가 끝남`);
    return { reqs, played: s.played, g };
  } finally {
    g.world.free();
  }
}

for (const [key, C] of Object.entries(CASES)) {
  test(`사람 ${key} (${C.tr}): 낸 순간 한 번 · ${C.file} · 쇳소리 묶음 · 음량 1 · 파일 크기 맞춤 · 빠르기 1 · 비기가 끝날 때까지 더 없음`, () => {
    const { reqs, played } = firePlayer(key);
    assert.equal(reqs.length, 1, JSON.stringify(reqs));
    assert.deepEqual([reqs[0].who, reqs[0].school, reqs[0].file, reqs[0].sounded], ['player', C.tr, C.file, 1]);
    assert.equal(played.length, 1);
    assert.deepEqual(played[0], { file: C.file, bus: 'metal', gain: 1, layer: 10 ** (SOUND.secretSfxTrimDb[C.file] / 20), rate: 1, prio: 2.5 });
  });
}

test('여러 수 비기(서보 연환 — 수마다 칼 길을 다시 엶 · run.burst 걸쇠): 두 수에 한 번', () => {
  const keep = SECRET.cnFast;
  SECRET.cnFast = 0;
  try {
    const { reqs } = firePlayer('gyeoksal');
    assert.equal(reqs.length, 1, JSON.stringify(reqs));
    assert.equal(reqs[0].file, G1);
  } finally {
    SECRET.cnFast = keep;
  }
});

test('사람 준비 · 창은 0: 고노센 준비(발도 대기) · 싱지르 무장 창 — 열리고 닫혀도 소리 없음 · 창에서 내면 한 번', () => {
  for (const key of ['gonosen', 'spin']) {
    const C = CASES[key];
    const g = playerRound({ ...C, gap: 4 });
    const s = fakeSound();
    const { W, reqs } = watchRound(g, s);
    const PS = new PlayerSecretWatch(g.player, g.enemy);
    try {
      let ready = false;
      for (let i = 0; i < Math.round(4 / DT); i++) {
        g.step();
        PS.update(DT, !!g.player.skill.sec);
        ready ||= key === 'gonosen' ? PS.iaiArm.armed : !!PS.open;
        W.tick();
      }
      assert.ok(ready, `${key}: 준비가 됨`);
      assert.equal(reqs.length, 0, `${key}: 준비 · 창 동안 0`);
      if (key === 'spin') {
        const o = PS.open ? PS.fire() : null; // main.js 와 같은 길: 창 → fire → skill.secret
        assert.ok(o && g.player.skill.secret(o), '창에서 냄');
        for (let i = 0; i < Math.round(2 / DT); i++) { g.step(); PS.update(DT, !!g.player.skill.sec); W.tick(); }
        assert.deepEqual(reqs.map((r) => r.file), [G2]);
      }
    } finally {
      g.world.free();
    }
  }
});

test('못 냄 · 실행 실패는 0: 탈진 · 서 있지 않음(secret() false) · 낸 스텝에 칼을 놓친 발도(instantResult.ok false)', () => {
  const C = CASES.gonosen;
  const g = playerRound(C);
  const s = fakeSound();
  const { W, reqs } = watchRound(g, s);
  const P = g.player;
  const S = playerSecretDef(C.tr);
  try {
    for (let i = 0; i < Math.round(1.6 / DT); i++) { g.step(); W.tick(); }
    const ex = Object.getOwnPropertyDescriptor(P.stamina, 'exhausted');
    Object.defineProperty(P.stamina, 'exhausted', { value: true, configurable: true });
    assert.equal(P.skill.secret({ S, ctx: {} }), false);
    if (ex) Object.defineProperty(P.stamina, 'exhausted', ex);
    else delete P.stamina.exhausted;
    const st = P.state;
    P.state = 'kneel';
    assert.equal(P.skill.secret({ S, ctx: {} }), false);
    P.state = st;
    g.step(); W.tick();
    assert.equal(reqs.length, 0);
    // 낸 뒤 그 스텝 끝 실행 전에 칼을 놓침 → 수는 올랐으나(화면 늦춤은 그대로) 비기는 못 걸림
    const n0 = P.skill.secretBursts;
    assert.ok(P.skill.secret({ S, ctx: {} }));
    assert.equal(P.skill.secretBursts, n0 + 1);
    P.armed = false;
    g.step();
    assert.equal(P.instantResult?.ok, false);
    assert.equal(secretFizzled(P, P.skill.sec), true);
    W.tick();
    P.armed = true;
    for (let i = 0; i < Math.round(1 / DT); i++) { g.step(); W.tick(); }
    assert.equal(reqs.length, 0, JSON.stringify(reqs));
    // 묵은 실패 결과 + 다른 칸의 비기(준비 · 베기 길)는 소리 냄
    assert.equal(secretFizzled({ instantResult: { ok: false } }, { stage: 'strike' }), false);
    assert.equal(secretFizzled({ instantResult: { ok: false } }, { stage: 'instant' }), true);
    assert.equal(secretFizzled({ instantResult: { ok: true } }, null), false);
  } finally {
    g.world.free();
  }
});

test('AI 고노센 (일본 숙련도 5 · AI 실행부 secretGo): 한 번 · g1 · 못 내면 0', () => {
  const g = newRound({ walls: false, weapon: 'longsword', weapon2: 'uchigatana', seed: 1, persona: { proficiency: 5 } });
  const s = fakeSound();
  const { W, reqs } = watchRound(g, s);
  const A = g.ai, E = g.enemy;
  try {
    assert.equal(A.secret?.do?.instant, true);
    let fired = 0;
    let failTried = false;
    g.before = () => g.player.move.set(0, g.t > 2 && E.foeDistance() > A.M.reach ? 0.6 : 0); // 사람 자리: 2 s 부터 AI 칼끝 거리까지 걸어 들어감 (저절로 낸 고노센도 센다)
    for (let i = 0; i < 120 * 12 && !fired; i++) {
      g.step();
      W.tick();
      const near = g.t > 2.6 && E.state === 'stand' && g.player.state === 'stand' && E.foeDistance() < A.M.reach + 0.3 && A.secretFree() && !A.secretRun;
      if (!near) continue;
      if (!failTried) {
        failTried = true;
        const keep = A.staminaRest;
        A.staminaRest = true; // 쉬는 중(기력) → secretGo false
        if (CONFIG.STAMINA.on) assert.equal(A.secretGo(A.secret, {}), false);
        A.staminaRest = keep;
      }
      if (A.secretGo(A.secret, {})) fired++;
    }
    const before = reqs.length;
    g.before = null;
    for (let i = 0; i < 120 * 3; i++) { g.step(); W.tick(); }
    const firedAll = Object.values(A.stats.secrets ?? {}).reduce((n, x) => n + x.fired, 0);
    assert.ok(fired === 1 && firedAll >= 1, `낸 수 ${fired} / ${firedAll}`);
    assert.equal(reqs.length, firedAll, JSON.stringify(reqs)); // 저절로 낸 것(secretScan)이 있으면 그것도 한 번씩
    assert.ok(before >= 1);
    assert.ok(reqs.every((r) => r.who === 'ai' && r.school === 'japanese' && r.file === G1 && r.sounded === 1));
  } finally {
    g.world.free();
  }
});

test('AI 싱지르 (롤랑 — 이베리아 숙련도 6 · spinGo 가 skill.secret 과 AI 실행부 둘 다 셈): 무장 동안 0 · 낸 순간 한 번 · g2', () => {
  const H = CHARACTERS_BY_ID.roland;
  const g = newRound({ seed: 3, weapon: 'longsword', weapon2: H.weapon, difficulty: H.ai.level, persona: H.ai.persona, look2: H.look, gap: 4 });
  const s = fakeSound();
  const { W, reqs } = watchRound(g, s);
  const P = g.player;
  try {
    assert.equal(g.ai.secret?.name, 'ibSpin');
    let fired = null, armedSeen = false, back = false, enemySkill0 = g.enemy.skill.secretBursts, ai0 = g.ai.secretBursts ?? 0;
    g.before = () => {
      P.move.set(0, g.t > 3 ? 0.7 : 0);
      if (g.ai.spinArm?.armed && fired == null) armedSeen = true;
      if (g.ai.secretRun?.stage === 'spin' && fired == null) fired = g.t;
      if (fired != null && !g.ai.secretRun && g.ai.mode !== 'secret') back = true;
    };
    let quietWhileArmed = true;
    while (g.t < 9 && !back) {
      g.step();
      W.tick();
      if (fired == null && reqs.length) quietWhileArmed = false;
    }
    for (let i = 0; i < 120; i++) { g.step(); W.tick(); }
    assert.ok(armedSeen && quietWhileArmed, '무장(준비) 동안 소리 없음');
    assert.ok(fired != null && back);
    assert.equal(g.ai.stats.secrets.ibSpin.fired, 1);
    assert.equal(g.enemy.skill.secretBursts - enemySkill0, 1); // 검술 층도 셌고
    assert.equal((g.ai.secretBursts ?? 0) - ai0, 1); // AI 실행부도 셌다 — 그래도 소리는 한 번
    assert.equal(reqs.length, 1, JSON.stringify(reqs));
    assert.deepEqual([reqs[0].who, reqs[0].school, reqs[0].file, reqs[0].sounded], ['ai', 'iberian', G2, 1]);
    assert.ok(Math.abs(reqs[0].t - fired) <= 2 * DT, `소리 ${reqs[0].t} · 냄 ${fired}`);
  } finally {
    g.world.free();
  }
});

test('AI 모르트슐라크 (독일 숙련도 5 · mordTick → mordGo): 누르기 · 창 동안 0 · 낸 순간 한 번 · g2', () => {
  const g = newRound({ weapon: 'longsword', weapon2: 'longsword', gap: 0.7, seed: 7, walls: false, AIClass: AI, persona: { proficiency: { german: 5 } } });
  const s = fakeSound();
  const { W, reqs } = watchRound(g, s);
  const E = g.enemy, ai = g.ai;
  try {
    assert.equal(ai.secret?.name, 'mordschlag');
    ai.watch = () => {};
    ai.moveFeet = function () { this.me.move.set(0, 0); this.me.stickX = 0; this.me.stickY = 0; };
    for (let i = 0; i < Math.round(0.3 / DT); i++) { g.step(); W.tick(); }
    E.barge = { phase: 'press' };
    let opened = null, fired = null, ended = null, quietBeforeFire = true;
    for (let i = 0; i < Math.round(3.0 / DT); i++) {
      g.step();
      W.tick();
      if (opened == null && ai.press.wins > 0) opened = g.t;
      if (fired == null && ai.secretRun?.stage === 'mord') fired = g.t;
      if (fired == null && reqs.length) quietBeforeFire = false;
      if (fired != null && ended == null && !ai.secretRun) ended = g.t;
    }
    E.barge = null;
    for (let i = 0; i < 120; i++) { g.step(); W.tick(); }
    assert.ok(opened != null && fired != null && ended != null, `창 ${opened} · 냄 ${fired} · 끝 ${ended}`);
    assert.ok(quietBeforeFire, '누르기 · 창 동안 소리 없음');
    assert.equal(ai.secretStat(ai.secret).fired, 1);
    assert.equal(reqs.length, 1, JSON.stringify(reqs));
    assert.deepEqual([reqs[0].who, reqs[0].school, reqs[0].file, reqs[0].sounded], ['ai', 'german', G2, 1]);
    assert.ok(Math.abs(reqs[0].t - fired) <= 2 * DT);
  } finally {
    g.world.free();
  }
});

test('걸쇠 셈: 새 판 바탕(묵은 수는 안 터짐) · 같은 화면 둘이 내면 각자 유파로 한 번씩 · 수가 둘 올라도 한 번 · 잔상(instantArc)만 바뀌면 0 · 표에 없는 유파 0', () => {
  const P = { swordArt: { tradition: 'german' }, skill: { secretBursts: 7 }, instantArc: { id: 3 } };
  const E = { swordArt: { tradition: 'japanese' } };
  const A = { secretBursts: 4 };
  const got = [];
  const W = new SecretSfxWatch(
    [
      { who: 'player', fighter: P, count: () => P.skill.secretBursts, run: () => null },
      { who: 'ai', fighter: E, count: () => A.secretBursts, run: () => null },
    ],
    (file, who) => got.push([who, file]),
  );
  assert.deepEqual(W.tick(), []); // 지난 판 수 7 · 4 는 바탕
  P.instantArc = { id: 4, kind: 'art' }; // 고유 동작 잔상
  assert.deepEqual(W.tick(), []);
  P.skill.secretBursts++;
  A.secretBursts++;
  W.tick();
  assert.deepEqual(got, [['player', G2], ['ai', G1]]);
  A.secretBursts += 2;
  W.tick();
  assert.equal(got.length, 3);
  P.swordArt.tradition = 'none';
  P.skill.secretBursts++;
  assert.deepEqual(W.tick(), [{ who: 'player', school: 'none', file: null }]);
  assert.equal(got.length, 3);
  // 수가 줄면(새 몸 · 되돌림) 소리 없이 바탕만 옮김
  A.secretBursts = 0;
  assert.deepEqual(W.tick(), []);
});

test('연결표 = 사장님 10/25 결정 · 주소 스위치 ?secretSfx=0 · 소리 끔 · 녹음 없음 · 꺼 둔 판은 녹음도 안 받음', async () => {
  assert.deepEqual(SOUND.secretSfxFiles, { japanese: G1, italian: G1, chinese: G1, iberian: G2, german: G2 });
  assert.deepEqual(['japanese', 'italian', 'chinese', 'iberian', 'german', 'none', null].map((k) => secretSfxFile(k)), [G1, G1, G1, G2, G2, null, null]);
  assert.equal(SOUND.secretSfx, 1);
  assert.equal(SOUND.secretSfxGain, 1); // 사장님 10/25 18:4x '음량 1.0으로'
  const q = (x) => secretSfxMode(new URLSearchParams(x), 1);
  assert.deepEqual(['', 'secretSfx=0', 'secretSfx=1', 'weapon=rapier&secretSfx=0'].map(q), [1, 0, 1, 0]);
  const a = fakeSound();
  a.s._on = false; // 음소거
  assert.equal(a.s.secretSfx(G1), null);
  a.s._on = true;
  delete a.s.samples[`secret:${G2}`]; // 아직 안 읽힘 → 합성으로 대신하지 않음
  assert.equal(a.s.secretSfx(G2), null);
  const keep = SOUND.secretSfx;
  try {
    SOUND.secretSfx = 0;
    assert.equal(a.s.secretSfx(G1), null);
    assert.equal(a.played.length, 0);
    // 녹음 받기: 켬이면 두 파일 · 끔이면 안 받음 (fetch 대신 decodeSample 을 바꿔 낌)
    for (const on of [1, 0]) {
      SOUND.secretSfx = on;
      const b = Object.create(Sound.prototype);
      const asked = [];
      Object.assign(b, { samples: {}, decodeSample: async (f) => (asked.push(f), { name: f }) });
      await b.loadSamples();
      assert.equal(asked.includes(`${G1}`) && asked.includes(`${G2}`), !!on);
      assert.equal(!!b.samples[`secret:${G1}`], !!on);
    }
  } finally {
    SOUND.secretSfx = keep;
  }
});

test('g1 · g2 크기 맞춤 (사장님 10/25 18:4x \'g1과 g2 소리 크기 맞춰\'): 받은 MP3 바이트 그대로 · 녹음 한 겹 음량만 · 맞춘 뒤 순간 크기 차 0.1 dB 안 · 키운 최고도 리미터(−6 dB) 아래', () => {
  // 순간 크기(EBU R128 · BS.1770 K 가중 · 400 ms 창 최고 — LUFS)는 받은 MP3 를 48 kHz 로 풀어 잰 값 (docs/import/secret_audio_import_2026-10-25.md §5)
  const LOUD = { [G1]: -20.53, [G2]: -23.79 };
  const T = SOUND.secretSfxTrimDb;
  assert.deepEqual(T, { [G1]: 0, [G2]: 3.3 });
  assert.ok(Math.abs(LOUD[G1] + T[G1] - (LOUD[G2] + T[G2])) < 0.1, '맞춘 뒤 크기 차');
  // 최고(받은 measurements 의 4 배 오버샘플 최고 dBTP) + 맞춤 + 이벤트 음량 + 전체 음량 → 리미터(sound.js build — 문턱 −6 dB) 아래
  const M = JSON.parse(fs.readFileSync(root('docs/import/secret_audio_20261025/measurements.json'), 'utf8'));
  const db = (x) => 20 * Math.log10(x);
  for (const [name, f] of [['g1-clank', G1], ['g2-dry', G2]]) {
    const peak = Math.max(M[name].files.mp3.truePeak4xDbFS, M[name].pcmPeakDbFS) + T[f] + db(SOUND.secretSfxGain) + db(SOUND.volume);
    assert.ok(peak < -6.5, `${name} 최고 ${peak.toFixed(2)} dBTP`);
  }
  // 소리 카드 가짜: 파일마다 녹음 한 겹 음량
  const a = fakeSound();
  a.s.secretSfx(G1);
  a.s.secretSfx(G2);
  assert.deepEqual(a.played.map((p) => [p.file, p.gain, +p.layer.toFixed(4)]), [[G1, 1, 1], [G2, 1, +(10 ** (3.3 / 20)).toFixed(4)]]);
});

test('일시정지 · 새 판: 울리던 비기 소리를 줄여 끔 (다른 싸움 소리는 그대로)', () => {
  const a = fakeSound();
  const stopped = [];
  a.s.secretSfx(G1);
  const ev = a.s._secretEv;
  ev.srcs.push({ stop: (t) => stopped.push(t) });
  a.s.setPaused(true);
  assert.equal(ev.stopped, true);
  assert.equal(stopped.length, 1);
  assert.equal(a.s._secretEv, null);
  a.s.setPaused(true); // 다시 불려도 아무 일 없음
  assert.equal(stopped.length, 1);
  a.s.secretSfx(G2);
  const ev2 = a.s._secretEv;
  a.s.ctx.currentTime = 1; // 이미 끝난 소리는 건드리지 않음
  a.s.stopSecretSfx();
  assert.equal(ev2.stopped, undefined);
});

test('녹음 파일: 받은 그대로(샛별 저장소 2fa0b2ae measurements 해시) · MPEG-1 48 kHz 모노 · 출처 · CC0 기록', () => {
  const M = JSON.parse(fs.readFileSync(root('docs/import/secret_audio_20261025/measurements.json'), 'utf8'));
  for (const [name, f] of [['g1-clank', G1], ['g2-dry', G2]]) {
    const b = fs.readFileSync(root(`public/sfx/${f}.mp3`));
    assert.equal(crypto.createHash('sha256').update(b).digest('hex'), M[name].files.mp3.sha256, name);
    let i = b.toString('latin1', 0, 3) === 'ID3' ? 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]) : 0;
    while (!(b[i] === 0xff && (b[i + 1] & 0xe0) === 0xe0)) i++;
    assert.deepEqual([(b[i + 1] >> 3) & 3, (b[i + 1] >> 1) & 3, (b[i + 2] >> 2) & 3, (b[i + 3] >> 6) & 3], [3, 1, 1, 3], name); // MPEG-1 · Layer III · 48 kHz · 모노
    const wav = fs.readFileSync(root(`docs/import/secret_audio_20261025/masters/${name}.wav`));
    assert.equal(crypto.createHash('sha256').update(wav).digest('hex'), M[name].files.wav.sha256);
  }
  const lic = fs.readFileSync(root('public/sfx/secret/LICENSE.txt'), 'utf8');
  assert.ok(lic.includes('CC0 1.0') && lic.includes('581594') && lic.includes('772113') && lic.includes('seax-unsheathe-02.wav'));
  assert.ok(fs.readFileSync(root('public/sfx/LICENSE.txt'), 'utf8').includes('secret/LICENSE.txt'));
});
