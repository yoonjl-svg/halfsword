// 일본 고노센 — 10/25 08:0x 사장님 ②③⑤ 결정 · 여쭘 A · B · C 스위치 (docs/strike/school_secret_2026-10-09.md §17):
//  ② 긴 칼 상대 규칙 켬 · ③ AI 들어옴 켬 · ⑤ AI 고노센 경계(선 밖 기다림 · 결행 · 속임 · 베이면 물러남) · A 들어옴 창 길이 · B 들어옴 발도 막힘 · C 칼끝 겨눈 들어옴은 창 없음.
//  node --test tools/sim/gonosen_risk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { PlayerSecretWatch, secretEvent, gnsEnterLine, foeOnline, gnsUser } from '../../src/secret.js';
import { playerSecretDef } from '../../src/schools.js';
import { requestIai } from '../../src/secret_instant.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const { SECRET } = CONFIG;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };

test('기본값: ② 긴 칼 상대 켬 · ③ AI 들어옴 켬 · ⑤ AI 경계 켬 · 여쭘 A · B · C 는 지금 판(끔)', () => {
  assert.equal(SECRET.gnsEnter, 1);
  assert.equal(SECRET.gnsEnterAI, 1);
  assert.equal(SECRET.gnsLong, 1);
  assert.equal(SECRET.gnsWary, 1);
  assert.equal(SECRET.gnsEnterWindow, 0);
  assert.equal(SECRET.gnsEnterBlock, 0);
  assert.equal(SECRET.gnsEnterOpen, 0);
});

// 가짜 눈 — 상대 가슴이 x 축 위에서 나(원점) 쪽으로 · 손(m)과 칼끝(t): online 이면 칼끝이 내 가슴 쪽
const sense = { recentHandSpeed: () => 0 };
const c = { x: 0, y: 1.3, z: 0 };
const r = { x: 0, y: 0, z: 1 };
const meAt = (v) => ({ bodies: { chest: { linvel: () => ({ x: v, y: 0, z: 0 }) } } });
const s0At = (d, v, online) => ({ cx: d, cz: 0, vx: -v, vz: 0, hvx: 0, hvy: 0, hy: 0, state: 'stand', mx: d - 0.4, my: 1.2, mz: 0, tx: online ? d - 1.4 : d - 0.4, ty: online ? 1.3 : 2.4, tz: 0 });

test('C 칼끝 겨눔: foeOnline 은 ai.js foeClass 의 online 과 같은 셈 · 켜면 칼끝을 겨눈 채 넘는 들어옴은 창 없음 · 끄면 그대로', () => {
  assert.equal(foeOnline(s0At(2.4, 0, true), c), true);
  assert.equal(foeOnline(s0At(2.4, 0, false), c), false);
  const S = playerSecretDef('japanese');
  const view = { reach: 1.87, contact: 1.58, clinch: 1.22, foeReach: 1.85, armed: true };
  const L = gnsEnterLine(view);
  const walk = (online) => {
    const st = { armed: true, off: 0 };
    let n = 0;
    for (let d = L + 0.3; d > view.foeReach; d -= 0.5 * DT) if (secretEvent(S, sense, {}, s0At(d, 0.5, online), c, r, d, view.foeReach, meAt(0), { reach: view.reach, dt: DT, st, armed: false, enterLine: L, iaiArmed: true }).on) n++;
    return n;
  };
  assert.equal(walk(true), 1);
  assert.equal(walk(false), 1);
  withCfg({ gnsEnterOpen: 1 }, () => {
    assert.equal(walk(true), 0);
    assert.equal(walk(false), 1);
  });
});

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

test('A 들어옴 창 길이: 기본(0) = playerWindow · 0.4 이면 들어옴 창만 0.4 s', () => {
  assert.ok(Math.abs(firstEnterWindow() - SECRET.playerWindow) < 1e-9);
  withCfg({ gnsEnterWindow: 0.4 }, () => assert.ok(Math.abs(firstEnterWindow() - 0.4) < 1e-9));
});

test('B 들어옴 발도 막힘: 켜면 들어옴 창에서 낸 발도만 막힐 수 있음(block) — 칼을 든 상대에게 낸 것 · 끄면 그대로 · 휩쓸기만 밀어냄', () => {
  const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 1 });
  const p = G.player;
  const S = playerSecretDef('japanese');
  for (let i = 0; i < 10; i++) G.step(); // 몸이 상대를 알게 (p.foe)
  const req = (ctx) => { p.skill.sec = null; p.iaiReq = null; p.skill.secret({ S, ctx }); const b = !!p.iaiReq?.block; p.iaiReq = null; p.skill.sec = null; return b; };
  assert.equal(req({ ev: 'enter' }), false);
  withCfg({ gnsEnterBlock: 1 }, () => {
    assert.equal(req({ ev: 'enter' }), true);
    assert.equal(req({ ev: 'raise' }), false);
    assert.equal(req({ ev: 'recover' }), false);
  });
  requestIai(p, { player: true, block: true });
  assert.equal(p.iaiReq.block, true);
  requestIai(p, { player: true });
  assert.equal(p.iaiReq.block, false);
  G.world.free();
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
function standoff(id, vals) {
  return withCfg(vals, () => {
    const C = CHARACTERS_BY_ID[id];
    const G = newRound({ weapon: 'monohoshizao', weapon2: C.weapon, seed: 1, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
    const p = G.player;
    p.skill.autoGuard = true;
    const ps = new PlayerSecretWatch(p, G.enemy);
    const L = gnsEnterLine(ps.view());
    const out = { creep: 0, ready: 0, W: null };
    let prev = null;
    G.before = () => {
      ps.update(DT, !!p.skill.sec);
      p.move.set(0, 0);
      const W = G.ai.gnsW;
      if (W?.ready) out.ready++;
      const d = p.foeDistance();
      if (prev != null && prev > L && d <= L && ps.iaiArm.armed && (!W || W.ready) && G.ai.mode === 'watch') out.creep++;
      prev = d;
    };
    for (let i = 0; i < 16 / DT && p.alive && G.enemy.alive; i++) G.step();
    out.W = G.ai.gnsW ?? null;
    G.world.free();
    return out;
  });
}

test('⑤ 실제 몸: 경계를 끄면 AI 가 간 보기로 준비된 사람 발도 선 안에 기어 든다(10/25 01:3x 판) · 켜면 간 보기로는 선 밖에서 기다림', () => {
  const off = standoff('isolde', { gnsWary: 0 });
  assert.equal(off.W, null); // 끄면 경계 칸 자체가 없다 (옛 판 그대로)
  assert.ok(off.creep > 0, `off creep ${off.creep}`);
  const on = standoff('isolde', {});
  assert.ok(on.W?.user && on.ready > 0, JSON.stringify(on.W?.n));
  assert.equal(on.creep, 0);
  const rows = [];
  for (const id of ['tome', 'ratna']) {
    const o = standoff(id, {});
    rows.push(`${id} ${o.creep}`);
    assert.equal(o.creep, 0, rows.join(' · '));
  }
});

test('⑤ 속임 → 결행: 속임은 준비 한 번에 한 번 (선 밖에서 들었다 거둠) · 다음 칠 때는 결행 — 상대가 고노센 쓰는 몸이 아니면 아무 일 없음', () => {
  const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 1, difficulty: 'normal' });
  const ai = G.ai;
  for (let i = 0; i < 2 / DT; i++) G.step();
  ai.gnsWatch(DT, ai.d, false);
  const W = ai.gnsW;
  assert.equal(W.user, true);
  const s = ai.sense.seen(0);
  const rnd = Math.random;
  try {
    Math.random = () => 0.999; // vor 보다 큼 → 속임
    W.feinted = false;
    assert.equal(ai.gnsAct(s, { kind: 'patience' }), true);
    assert.equal(W.plan?.kind, 'feint');
    assert.equal(ai.mode, 'attack');
    ai.abortAttack();
    ai.gnsWatch(DT, ai.d, false);
    assert.equal(W.plan, null);
    W.ready = true;
    assert.equal(ai.gnsAct(s, { kind: 'patience' }), true); // 속인 뒤엔 굴림 없이 결행
    assert.equal(W.plan?.kind, 'commit');
    assert.equal(W.feinted, false);
  } finally {
    Math.random = rnd;
  }
  G.world.free();
  const K = newRound({ weapon: 'longsword', weapon2: 'longsword', seed: 1 });
  for (let i = 0; i < 1 / DT; i++) K.step();
  assert.equal(K.ai.gnsW?.user, false);
  assert.equal(K.ai.holdDist(), withCfg({ gnsWary: 0 }, () => K.ai.holdDist()));
  K.world.free();
});
