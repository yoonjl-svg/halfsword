// 일본 고노센 — 10/25 08:0x 사장님 ②③⑤ 결정 · 여쭘 A · B · C 스위치 (docs/strike/school_secret_2026-10-09.md §17) · 10/25 16:0x B 켬 · 달려듦 1.2 m/s (§18):
//  ② 긴 칼 상대 규칙 켬 · ③ AI 들어옴 켬 · ⑤ AI 고노센 경계(선 밖 기다림 · 결행 · 속임 · 베이면 물러남) · A 들어옴 창 길이 · B 들어옴 발도 막힘 · C 칼끝 겨눈 들어옴은 창 없음.
//  node --test tools/sim/gonosen_risk.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { PlayerSecretWatch, secretEvent, gnsEnterLine, foeOnline, gnsUser, gnsBlockOf } from '../../src/secret.js';
import { playerSecretDef, JAPANESE_GAIT, setJapaneseGait } from '../../src/schools.js';
import { requestIai } from '../../src/secret_instant.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { withReadOld } from './ai_read_pin.mjs'; // 11/14 유파 AI 3 단계 수 읽기 · 공정함 · AI 고노센 지키기 — 옛 장면은 잰 때 판으로 (docs/strike/ai_read_2026-11-14.md §6)
// 준비까지 (11/14 사장님 '2초 후에 납도 시작' — 일본 준비는 iaiArmTime 뒤 납도 SECRET.iaiSheathe 가 끝나야 · 帯刀 끄면 납도 없음 · secret.js IaiArm.extra)
const ARM = () => CONFIG.SECRET.iaiArmTime + (CONFIG.SECRET.iaiObi && CONFIG.SECRET.iaiSheathe > 0 ? CONFIG.SECRET.iaiSheathe : 0);

const { SECRET } = CONFIG;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };

test('기본값: ② 긴 칼 상대 켬 · ③ AI 들어옴 켬 · ⑤ AI 경계 켬 · B 켬(10/25 16:0x) · A · C 끔 · 달려듦 1.2 m/s', () => {
  assert.equal(SECRET.gnsEnter, 1);
  assert.equal(SECRET.gnsEnterAI, 1);
  assert.equal(SECRET.gnsLong, 1);
  assert.equal(SECRET.gnsWary, 1);
  assert.equal(SECRET.gnsEnterWindow, 0);
  assert.equal(SECRET.gnsEnterBlock, 2); // 10/25 19:4x 사장님 위임 — B 2 기본 (확인표 2526)
  assert.equal(SECRET.foeChargeSpeed, CONFIG.realV(1.2)); // 실제 1.2 m/s (사장님 10/25 22:3x — 표준 시간 · 옛 판 게임 1.2)
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

test('A 들어옴 창 길이 (들어옴 창 gnsWalkIn 1 일 때 — 10/25 22:3x 부터 기본 끔): 기본(0) = playerWindow · 0.4 이면 들어옴 창만 0.4 s', () => {
  withCfg({ gnsWalkIn: 1 }, () => {
    assert.ok(Math.abs(firstEnterWindow() - SECRET.playerWindow) < 1e-9);
    withCfg({ gnsEnterWindow: 0.4 }, () => assert.ok(Math.abs(firstEnterWindow() - 0.4) < 1e-9));
  });
  assert.equal(firstEnterWindow(), null); // 기본(gnsWalkIn 0): 천천히 걸어 드는 상대에게 들어옴 창 없음
});

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

test('달려듦 1.2 m/s (10/25 16:1x) · 최근 0.6 s 평균(foeChargeAvg): 1.1 m/s 로 다가오면 달려듦 창 아님 · 1.3 이면 달려듦 · 옛 0.9 면 1.1 도 · 걸음마다 0.6 ↔ 1.4 로 출렁이는 평균 1.0 걸음은 평균 판이면 아님(한 스텝 판이면 달려듦) · 들어옴 fast', () => {
  assert.equal(SECRET.foeChargeAvg, 1);
  const S = playerSecretDef('japanese');
  const view = { reach: 1.87, contact: 1.58, clinch: 1.22, foeReach: 1.85, armed: true };
  const L = gnsEnterLine(view);
  /** 선 안 한 자리에서 2.5 s 동안 (빠르기 v 또는 스텝마다 v(i)) — 한 번이라도 사건이 났나 (평균이 차오르는 데 0.6 s 의 몇 배) */
  const ev = (v) => {
    const st = { armed: true, off: 0 };
    let on = null;
    for (let i = 0; i < 2.5 / DT; i++) {
      const vi = typeof v === 'function' ? v(i) : v;
      const e = secretEvent(S, sense, {}, s0At(L - 0.1, vi, false), c, r, L - 0.1, view.foeReach, meAt(0), { reach: view.reach, dt: DT, st, armed: false });
      if (e.on) on ??= e.ctx;
    }
    return on;
  };
  assert.equal(ev(1.1), null);
  assert.equal(ev(1.3)?.charge, true);
  withCfg({ foeChargeSpeed: 0.9 }, () => assert.equal(ev(1.1)?.charge, true));
  const wobble = (i) => (Math.floor(i / 30) % 2 ? 1.4 : 0.6); // 0.25 s 마다 0.6 ↔ 1.4 (평균 1.0)
  assert.equal(ev(wobble), null);
  withCfg({ foeChargeAvg: 0 }, () => assert.equal(ev(wobble)?.charge, true)); // 한 스텝 판: 출렁임 꼭대기에서 달려듦
  const cross = (v) => {
    const st = { armed: true, off: 0 };
    for (let d = L + 3; d > view.foeReach; d -= v * DT) {
      const e = secretEvent(S, sense, {}, s0At(d, v, false), c, r, d, view.foeReach, meAt(0), { reach: view.reach, dt: DT, st, armed: false, enterLine: L, iaiArmed: true });
      if (e.on && d <= L) return e.ctx; // 선 밖의 달려듦은 창 조건(secretCond — 발도가 닿는 거리)에서 걸러짐 · 넘는 스텝은 들어옴이 먼저
    }
    return null;
  };
  assert.equal(cross(0.8)?.ev, 'enter');
  assert.equal(cross(0.8).fast, false);
  assert.equal(cross(1.5)?.ev, 'enter');
  assert.equal(cross(1.5).fast, true);
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

// 경계를 끈 판(10/25 01:3x 판)의 기어 듦은 그때 걸음(일본 걸음 전 판 `?jpGait=old` — 모노호시자오 서 있는 자세 0.35)에서 본다: 10/29 일본 걸음(자세 0.51)에선
//  씨앗 1 ~ 6 모두 '준비된 발도 + 간 보기 꼴'로 선을 넘는 일이 없음(이솔데는 선 2.33 m 안 0.8 ~ 1.4 m 까지 들어오나 그 조건 밖 — docs/strike/jp_gait_2026-10-29.md §10). 켠 판(지금 판)은 새 걸음 그대로
const withJpOld = (fn) => {
  const keep = { ...JAPANESE_GAIT };
  setJapaneseGait('old');
  try {
    return fn();
  } finally {
    for (const k of Object.keys(JAPANESE_GAIT)) delete JAPANESE_GAIT[k];
    Object.assign(JAPANESE_GAIT, keep);
  }
};

// 11/14 (사장님 '권고대로 고노센도 무모하게 넘고'): 유파 플랜 무 · 낮음 띠는 굴림 몫만큼 선을 넘는다 — 이 시험은 10/25 결정 장면이라 옛 판(AI_PLAN.on 0)으로 묶어 기준 그대로 본다 (아래 '무모' 시험이 새 판)
const withPlanOff = (fn) => {
  const keep = CONFIG.AI_PLAN.on;
  CONFIG.AI_PLAN.on = 0;
  try {
    return fn();
  } finally {
    CONFIG.AI_PLAN.on = keep;
  }
};

test('⑤ 실제 몸: 경계를 끄면 AI 가 간 보기로 준비된 사람 발도 선 안에 기어 든다(10/25 01:3x 판) · 켜면 간 보기로는 선 밖에서 기다림 (옛 판 — AI_PLAN.on 0)', () => withPlanOff(() => {
  const off = withJpOld(() => standoff('isolde', { gnsWary: 0 }));
  assert.equal(off.W, null); // 끄면 경계 칸 자체가 없다 (옛 판 그대로)
  assert.ok(off.creep > 0, `off creep ${off.creep}`);
  // 11/14 칼집 각도 · 납도(준비 2.0 → 2.6 s)로 이 씨앗 판이 갈려 이솔데가 11.6 s 에 간 보기(holdDist 2.52 · 스틱 0 곁) 동안 걸음 한 번에 선 안 6 cm 로 듦 — 경계 셈은 그대로라
  //  이 씨앗 장면은 그 전 판(납도 없음 · 쉬는 칼집 11/14 자리)으로 묶음 · 기준은 그대로 (docs/strike/iai_obi_2026-11-14.md §13-5) · 토메 · 라트나는 지금 판
  const on = standoff('isolde', { iaiSheathe: 0, iaiObiSayaMouth: [0.21, 0.085, 0.02], iaiObiSayaAxis: { yaw: -121, el: -15 }, iaiObiPull: { yaw: -160, el: -25 }, iaiObiFollow: { m: 0.06, deg: 20 } });
  assert.ok(on.W?.user && on.ready > 0, JSON.stringify(on.W?.n));
  assert.equal(on.creep, 0);
  const rows = [];
  for (const id of ['tome', 'ratna']) {
    const o = standoff(id, {});
    rows.push(`${id} ${o.creep}`);
    assert.equal(o.creep, 0, rows.join(' · '));
  }
}));

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

test('⑤ 속임 → 결행: 속임은 준비 한 번에 한 번 (선 밖에서 들었다 거둠) · 다음 칠 때는 결행 — 상대가 고노센 쓰는 몸이 아니면 아무 일 없음', () => withReadOld(() => {
  // 11/14 3 단계 공정함(AI_PLAN.read.fair)이면 사람 준비를 늦게 본 준비 자세(켜짐 0.35 s + 반응 시간)로 읽어 준비가 막 켜진 이 때엔 아직 안 보임 → 속임 표식이 지워짐 —
  //  속임 → 결행 셈 시험이라 그 전 판 눈(사람 스틱 셈)으로 묶음 (기록 ai_read §6 · 공정한 눈의 준비 읽기는 ai_read.test '공정함')
  const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 1, difficulty: 'normal' });
  const ai = G.ai;
  for (let i = 0; i < (CONFIG.ARENA.startHold + ARM() + 0.1) / DT; i++) G.step(); // 사람 준비가 켜질 때까지 (무장 시계는 판 시작 정지 뒤부터 — 10/27 23:0x · 실제 2 s)
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
}));
