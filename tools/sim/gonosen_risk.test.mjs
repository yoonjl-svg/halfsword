// 일본 고노센 — 10/25 08:0x 사장님 ②③⑤ 결정 · 여쭘 A · B · C 스위치 (docs/strike/school_secret_2026-10-09.md §17) · 10/25 16:0x B 켬 · 달려듦 1.2 m/s (§18):
//  ② 긴 칼 상대 규칙 켬 · ③ AI 들어옴 켬 · ⑤ AI 고노센 경계(선 밖 기다림 · 결행 · 속임 · 베이면 물러남) · A 들어옴 창 길이 · B 들어옴 발도 막힘 · C 칼끝 겨눈 들어옴은 창 없음.
//  node --test tools/sim/gonosen_risk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { PlayerSecretWatch, secretEvent, gnsEnterLine, foeOnline, gnsUser, gnsBlockOf } from '../../src/secret.js';
import { playerSecretDef, JAPANESE_GAIT } from '../../src/schools.js';
import { requestIai } from '../../src/secret_instant.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
// 준비까지 (11/14 사장님 '2초 후에 납도 시작' — 일본 준비는 iaiArmTime 뒤 납도 SECRET.iaiSheathe 가 끝나야 · 帯刀 끄면 납도 없음 · secret.js IaiArm.extra)
const ARM = () => CONFIG.SECRET.iaiArmTime + (CONFIG.SECRET.iaiSheathe > 0 ? CONFIG.SECRET.iaiSheathe : 0);

const { SECRET } = CONFIG;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };

test('기본값: ② 긴 칼 상대 켬 · ③ AI 들어옴 켬 · ⑤ AI 경계 켬 · B 켬(10/25 16:0x) · A · C 끔 · 달려듦 1.2 m/s', () => {
  assert.equal(SECRET.gnsEnterBlock, 2); // 10/25 19:4x 사장님 위임 — B 2 기본 (확인표 2526)
  assert.equal(SECRET.foeChargeSpeed, CONFIG.realV(1.2)); // 실제 1.2 m/s (사장님 10/25 22:3x — 표준 시간 · 옛 판 게임 1.2)
});

// 가짜 눈 — 상대 가슴이 x 축 위에서 나(원점) 쪽으로 · 손(m)과 칼끝(t): online 이면 칼끝이 내 가슴 쪽
const sense = { recentHandSpeed: () => 0 };
const c = { x: 0, y: 1.3, z: 0 };
const r = { x: 0, y: 0, z: 1 };
const meAt = (v) => ({ bodies: { chest: { linvel: () => ({ x: v, y: 0, z: 0 }) } } });
const s0At = (d, v, online) => ({ cx: d, cz: 0, vx: -v, vz: 0, hvx: 0, hvy: 0, hy: 0, state: 'stand', mx: d - 0.4, my: 1.2, mz: 0, tx: online ? d - 1.4 : d - 0.4, ty: online ? 1.3 : 2.4, tz: 0 });


// 실제 몸: 모노호시자오 사람이 서서 기다리고, 칼을 들지 않고 앞으로만 천천히 걷는 상대(롱소드)
class Walker {
  constructor(me, foe) { this.me = me; this.foe = foe; }
  update() { this.me.move.set(0, this.me.foeDistance() > 1.3 ? 0.25 : 0); }
}
function firstEnterWindow() {
  const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 1, AIClass: Walker });
  const p = G.player;
  p.skill.autoGuard = true;
  const ps = new PlayerSecretWatch(p, G.enemy);
  let seen = 0, t0 = null;
  G.before = () => {
    ps.update(DT, !!p.skill.sec);
    if (ps.opened !== seen) { seen = ps.opened; if (ps.open?.ctx?.ev === 'enter' && t0 == null) t0 = ps.open.t; }
  };
  for (let i = 0; i < 14 / DT && t0 == null; i++) G.step();
  G.world.free();
  return t0;
}


test('B 들어옴 발도 막힘 (10/25 16:0x 켬): 천천히 걸어 든 들어옴 창에서 낸 발도만 막힐 수 있음 — 빠르게(달려듦 빠르기로) 넘은 들어옴 · 칼을 듦 · 헛침 창은 그대로 · 끄면 그대로 · 휩쓸기만 밀어냄', () => {
  const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 1 });
  const p = G.player;
  const S = playerSecretDef('japanese');
  for (let i = 0; i < 10; i++) G.step(); // 몸이 상대를 알게 (p.foe)
  const req = (ctx) => { p.skill.sec = null; p.iaiReq = null; p.skill.secret({ S, ctx }); const b = !!p.iaiReq?.block; p.iaiReq = null; p.skill.sec = null; return b; };
  assert.equal(req({ ev: 'enter' }), true);
  assert.equal(req({ ev: 'enter', fast: true }), false);
  assert.equal(req({ ev: 'raise' }), false);
  assert.equal(req({ ev: 'raise', charge: true }), false);
  assert.equal(req({ ev: 'recover' }), false);
  withCfg({ gnsEnterBlock: 0 }, () => assert.equal(req({ ev: 'enter' }), false));
  requestIai(p, { player: true, block: true });
  assert.equal(p.iaiReq.block, true);
  requestIai(p, { player: true });
  assert.equal(p.iaiReq.block, false);
  requestIai(p, { player: true, block: 'cover' });
  assert.equal(p.iaiReq.block, 'cover');
  G.world.free();
});

test('B 2 (10/25 19:4x 기본 — 앞을 가린 상대도 막음): 낼 때 상대가 막기 단추를 누르거나 막는 중이거나 칼끝이 내 몸을 겨누면 cover · 아니면 칼 닿음만 · 1 이면 늘 칼 닿음만', () => {
  const chest = { x: 0, y: 1.3, z: 0 };
  const me = (online) => ({ bodies: { chest: { translation: () => chest } }, foe: { hitPointPrev: { x: 1.6, y: 1.3, z: 0 }, tipPrev: online ? { x: 1.1, y: 1.3, z: 0 } : { x: 1.6, y: 1.9, z: 0 } } });
  withCfg({ gnsEnterBlock: 1 }, () => assert.equal(gnsBlockOf({ ev: 'enter' }, me(true)), true));
  withCfg({ gnsEnterBlock: 2 }, () => {
    assert.equal(gnsBlockOf({ ev: 'enter' }, me(true)), 'cover');
    assert.equal(gnsBlockOf({ ev: 'enter' }, me(false)), true);
    const g = me(false);
    g.foe.parryGuard = { held: true, broken: false }; // 막기 단추를 누른 채 (칼끝은 비킴)
    assert.equal(gnsBlockOf({ ev: 'enter' }, g), 'cover');
    g.foe.parryGuard.broken = true;
    assert.equal(gnsBlockOf({ ev: 'enter' }, g), true);
    g.foe.parryGuard = null;
    g.foe.aiCtl = { mode: 'defend' }; // AI 막기 꼴
    assert.equal(gnsBlockOf({ ev: 'enter' }, g), 'cover');
    assert.equal(gnsBlockOf({ ev: 'enter', fast: true }, me(true)), false);
    assert.equal(gnsBlockOf({ ev: 'raise' }, me(true)), false);
  });
});


test('⑤ 고노센 쓰는 몸 (gnsUser): 사람 = 일본 칼 · 비기 칸 (skillKit 없으면 켬) · AI = 숙련도 5 일본만', () => {
  const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 1, AI2Class: AI, persona2: { proficiency: 5 }, persona: { proficiency: 5 } });
  assert.equal(gnsUser(G.player), true); // AI 가 모는 몸(AI2Class) — 그 AI 의 비기가 고노센
  assert.equal(gnsUser(G.enemy), false); // 롱소드 AI
  G.world.free();
  const H = newRound({ weapon: 'uchigatana', weapon2: 'longsword', seed: 1 });
  assert.equal(gnsUser(H.player), true); // 사람 몸 · skillKit 없음(시뮬)
  H.player.skillKit = { secret: false };
  assert.equal(gnsUser(H.player), false); // 비기 칸을 안 익힘
  H.player.skillKit = { secret: true };
  assert.equal(gnsUser(H.player), true);
  H.world.free();
  const K = newRound({ weapon: 'longsword', weapon2: 'longsword', seed: 1 });
  assert.equal(gnsUser(K.player), false);
  K.world.free();
});

/** 서서 기다리는 모노호시자오 사람(창이 열려도 안 침) 대 인물 AI — 준비된 동안 AI 가 간 보기(결행 · 속임 없이)로 사람 발도 선을 안으로 넘은 수 (이미 안에 있을 때 준비된 것은 넘음이 아님) */
// '기어 듦' = 발도 선을 DEEP 넘게 들어옴 (10/27 표준 시간 — 토메 씨앗 1 은 선 밖 간 보기 자리(holdDist 2.42)에서 옆으로 돌며 가슴 사이가 선 2.33 m 위아래 1 ~ 2 cm 로 흔들려
//  선을 두 번 스침 — 걸어 들지는 않음 · 끄면(옛 01:3x 판) 몸이 선 안으로 걸어 들어와 이 깊이도 넘음 · docs/strike/time_standard_2026-10-25.md §4)
const DEEP = 0.05;
function standoff(id, vals) {
  return withCfg(vals, () => {
    const C = CHARACTERS_BY_ID[id];
    const G = newRound({ weapon: 'monohoshizao', weapon2: C.weapon, seed: 1, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
    const p = G.player;
    p.skill.autoGuard = true;
    const ps = new PlayerSecretWatch(p, G.enemy);
    const L = gnsEnterLine(ps.view());
    const out = { creep: 0, ready: 0, W: null };
    let prev = null, pending = false;
    G.before = () => {
      ps.update(DT, !!p.skill.sec);
      p.move.set(0, 0);
      const W = G.ai.gnsW;
      if (W?.ready) out.ready++;
      const d = p.foeDistance();
      // 10/27 (무장 시계를 판 시작 정지 뒤부터 — 사장님 23:0x): 간 보기(watch)로 선을 넘어 든 뒤 DEEP 넘게 들어감(그 사이 꼴이 공격으로 바뀌어도) — 선 끝을 mm 로 오가는 것 · 들자마자 공격으로 바꾼 것은 깊이로 거름
      if (prev != null && prev > L && d <= L && ps.iaiArm.armed && (!W || W.ready) && G.ai.mode === 'watch') pending = true;
      if (d > L) pending = false;
      else if (pending && d <= L - DEEP) (out.creep++, (pending = false));
      prev = d;
    };
    for (let i = 0; i < 16 / DT && p.alive && G.enemy.alive; i++) G.step();
    out.W = G.ai.gnsW ?? null;
    G.world.free();
    return out;
  });
}




/** 무모 판 (11/14): 서서 기다리는 모노호시자오 사람 대 이탈리아 레이피어 AI(숙련 prof — 플랜 켬) — 씨앗 seed · 사람 들어옴 창이 열리면 곧장 고노센을 냄(fire) · 기어 듦 수 · 굴림이 경계를 접은 준비 수 · 고노센에 베인 수 */
function reckStandoff(prof, seed) {
  const G = newRound({ weapon: 'monohoshizao', weapon2: 'rapier', seed, persona: { proficiency: prof }, walls: true });
  const p = G.player;
  p.skill.autoGuard = true;
  const ps = new PlayerSecretWatch(p, G.enemy);
  const L = gnsEnterLine(ps.view());
  const out = { creep: 0, reck: 0, ready: 0, fired: 0, cut: 0 };
  let prev = null, pending = false, wasReady = false;
  G.before = () => {
    ps.update(DT, !!p.skill.sec);
    p.move.set(0, 0);
    const W = G.ai.gnsW;
    if (W?.ready && !wasReady) (out.ready++, W.reck && out.reck++);
    wasReady = !!W?.ready;
    if (ps.open && !p.skill.sec) {
      const o = ps.fire();
      if (o) (p.skill.secret(o), out.fired++);
    }
    const d = p.foeDistance();
    if (prev != null && prev > L && d <= L && ps.iaiArm.armed && (!W || W.ready) && G.ai.mode === 'watch') pending = true;
    if (d > L) pending = false;
    else if (pending && d <= L - DEEP) (out.creep++, (pending = false));
    prev = d;
  };
  for (let i = 0; i < 16 / DT && p.alive && G.enemy.alive; i++) G.step();
  out.cut = G.ai.gnsW?.n.cut ?? 0;
  G.world.free();
  return out;
}

test('⑤ 무모 (11/14 사장님 \'권고대로 고노센도 무모하게 넘고\'): 플랜 유파 낮은 띠는 가끔 선을 넘다 고노센에 걸림 · 가운데는 지금처럼 선 밖', () => {
  const lo = [1, 2, 3, 4].map((seed) => reckStandoff(2, seed));
  const sum = (a, k) => a.reduce((x, o) => x + o[k], 0);
  assert.ok(sum(lo, 'ready') > 0, JSON.stringify(lo));
  assert.ok(sum(lo, 'reck') > 0, `낮음 — 굴림이 경계를 접은 준비가 있음 ${JSON.stringify(lo)}`);
  assert.ok(sum(lo, 'creep') + sum(lo, 'cut') > 0, `낮음 — 선을 넘고 고노센에 걸림 ${JSON.stringify(lo)}`);
  const mid = [1, 2, 3, 4].map((seed) => reckStandoff(4, seed));
  assert.equal(sum(mid, 'reck'), 0, '가운데 — 굴리지 않음 (경계 그대로)');
  assert.equal(sum(mid, 'creep'), 0, `가운데 — 간 보기로는 선 밖 ${JSON.stringify(mid)}`);
});

