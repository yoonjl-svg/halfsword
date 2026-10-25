// 일본 고노센 들어옴 사건 (10/25 01:3x 사장님 '이 경우에 창이 안 열리고 천천히 다가와서 가까이 붙어 버리던데?' — docs/strike/school_secret_2026-10-09.md §16):
//  발도 대기인 채 상대가 내 발도가 닿는 거리(gnsEnterLine)를 다가오며 넘어 들면 창 한 번 · ?gnsEnter=0 = 옛 판(창 없음) · 내가 걸어 들어간 것은 아님 · AI 도 같은 사건(10/25 08:0x 기본 켬).
//  node --test tools/sim/gonosen_enter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerSecretWatch, secretEvent, secretCond, gnsEnterLine, gnsOutside } from '../../src/secret.js';
import { playerSecretDef } from '../../src/schools.js';

const { SECRET } = CONFIG;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };

test('기본값 · 정의: 사람 켬 · AI 켬 · 긴 칼 상대 규칙 켬(10/25 08:0x 사장님 ②③ — gonosen_risk.test.mjs) · 들어옴 선 = 발도 창 위 끝 · 새 문턱 없음', () => {
  assert.equal(SECRET.gnsEnter, 1);
  assert.equal(SECRET.gnsEnterAI, 1);
  assert.equal(SECRET.gnsLong, 1);
  assert.equal(SECRET.gnsEnterClosing, undefined); // 다가옴은 상대 ↔ 나 견줌 — 문턱 수 없음
  const S = playerSecretDef('japanese');
  assert.ok([].concat(S.when).includes('foeEnter'));
  const V = { reach: 1.87, contact: 1.58 };
  assert.ok(Math.abs(gnsEnterLine(V) - (1.58 + SECRET.iaiStep + SECRET.iaiMargin)) < 1e-9);
  withCfg({ iai: 0 }, () => assert.ok(Math.abs(gnsEnterLine(V) - (1.87 + SECRET.japaneseReach + SECRET.japaneseFar)) < 1e-9));
});

// 가짜 눈 — 상대 가슴이 x 축 위에서 나(원점) 쪽으로 다가옴 (칼은 안 듦: 손 빠르기 0)
const sense = { recentHandSpeed: () => 0 };
const s0At = (d, v) => ({ cx: d, cz: 0, vx: -v, vz: 0, hvx: 0, hvy: 0, hy: 0, state: 'stand' });
const c = { x: 0, y: 1.3, z: 0 };
const r = { x: 0, y: 0, z: 1 };

// 가짜 나 — 가슴 빠르기 (x 축 위 — 상대 쪽 +)
const meAt = (v) => ({ bodies: { chest: { linvel: () => ({ x: v, y: 0, z: 0 }) } } });
/** 선 L + 0.6 에서 상대 칼 거리까지 스텝마다 gap 을 줄이며 사건을 모음. foeV = 상대가 나 쪽으로 · meV = 내가 상대 쪽으로 (m/s) */
function walk(S, view, { foeV, meV = 0, armed = true, L = gnsEnterLine(view), st = { armed: true, off: 0 }, from = L + 0.6, to = view.foeReach } = {}) {
  const ons = [];
  const step = Math.max(1e-3, foeV + meV) * DT;
  for (let d = from; d > to; d -= step) {
    const ev = secretEvent(S, sense, {}, s0At(d, foeV), c, r, d, view.foeReach, meAt(meV), { reach: view.reach, dt: DT, st, armed: false, enterLine: L, iaiArmed: armed });
    if (ev.on) ons.push({ d, ev });
  }
  return ons;
}

test('준비된 채 상대가 천천히(0.15 m/s — AI 가 기어 드는 빠르기) 걸어 들어오면 선을 넘는 스텝에 들어옴 사건 한 번 — 창 조건(secretCond)도 참', () => {
  const S = playerSecretDef('japanese');
  const view = { reach: 1.87, contact: 1.58, clinch: 1.22, foeReach: 1.85, armed: true };
  const L = gnsEnterLine(view);
  for (const foeV of [0.15, 0.5]) {
    const ons = walk(S, view, { foeV });
    assert.equal(ons.length, 1, `${foeV}`);
    assert.equal(ons[0].ev.ctx.ev, 'enter');
    assert.ok(ons[0].d <= L && ons[0].d > L - foeV * DT - 1e-9);
    assert.ok(secretCond(S, ons[0].ev.ctx, ons[0].d, view));
  }
  // 준비가 아니면 없음 · 내가 걸어 들어가 넘음(상대는 서 있음 · 상대보다 내가 빠름)이면 없음 · 선이 없으면(옛 판) 없음
  assert.equal(walk(S, view, { foeV: 0.5, armed: false }).length, 0);
  assert.equal(walk(S, view, { foeV: 0, meV: 0.47 }).length, 0);
  assert.equal(walk(S, view, { foeV: 0.1, meV: 0.47 }).length, 0);
  assert.equal(walk(S, view, { foeV: 0.5, L: 0 }).length, 0);
  // 둘이 같이 들어오면 상대가 더 빠를 때만
  assert.equal(walk(S, view, { foeV: 0.5, meV: 0.2 }).length, 1);
});

test('창을 연 넘음 뒤: 선을 오가도 다시 안 걸림 — 상대가 선 밖에 iaiArmTime 머물거나 준비가 풀리면 다시', () => {
  const S = playerSecretDef('japanese');
  const view = { reach: 1.87, contact: 1.58, clinch: 1.22, foeReach: 1.85, armed: true };
  const L = gnsEnterLine(view);
  const st = { armed: true, off: 0 };
  assert.equal(walk(S, view, { foeV: 0.5, st, to: L - 0.05 }).length, 1);
  const ex = (armed) => ({ reach: view.reach, dt: DT, st, armed: false, enterLine: L, iaiArmed: armed });
  const at = (d, armed = true) => secretEvent(S, sense, {}, s0At(d, 0.5), c, r, d, view.foeReach, meAt(0), ex(armed)).on;
  // 선 밖으로 잠깐 나갔다 다시 넘음 → 없음
  for (let i = 0; i < 10; i++) at(L + 0.05);
  assert.equal(at(L - 0.01), false);
  // 선 밖에 iaiArmTime 넘게 → 다시 넘으면 창
  for (let i = 0; i < Math.ceil(SECRET.iaiArmTime / DT) + 1; i++) at(L + 0.05);
  assert.equal(at(L - 0.01), true);
  // 준비가 풀렸다 다시 준비되면 → 넘을 때 창
  at(L - 0.02, false);
  at(L + 0.05);
  assert.equal(at(L - 0.01), true);
});

test('긴 칼 상대 규칙(gnsLong): 띠가 빈 짝에서만 · 이미 준비된 채로만 상대 칼 거리 안 ~ 내 발도가 닿는 거리 밖도 밖 — 끄면 옛 셈', () => {
  const V = { reach: 1.28, contact: 1.12, foeReach: 2.06 }; // 打刀 대 츠바이핸더 (L 1.87)
  const L = gnsEnterLine(V);
  assert.ok(V.foeReach >= L);
  assert.equal(gnsOutside(1.95, V, true, 0), false);
  assert.equal(gnsOutside(1.95, V, true, 1), true);
  assert.equal(gnsOutside(1.95, V, false, 1), false); // 새로 쌓는 것은 상대 칼 거리 밖에서만
  assert.equal(gnsOutside(L - 0.01, V, true, 1), false);
  assert.equal(gnsOutside(2.1, V, false, 0), true);
  const N = { reach: 1.87, contact: 1.58, foeReach: 1.85 }; // 띠가 있는 짝 — 규칙이 안 걸림
  assert.equal(gnsOutside(1.8, N, true, 1), false);
});

// 실제 몸: 모노호시자오 사람이 서서 기다리고, 칼을 들지 않고 앞으로만 천천히 걷는 상대(롱소드)
class Walker {
  constructor(me, foe) { this.me = me; this.foe = foe; this.go = 0.25; } // 스틱 0.25 ≈ 0.47 m/s (가슴 빠르기 걸음마다 −0.01 ~ 0.69 — 달려듦 0.9 아래)
  update() { this.me.move.set(0, this.me.foeDistance() > 1.3 ? this.go : 0); }
}
function walkIn(vals, { meWalks = false } = {}) {
  return withCfg(vals, () => {
    const G = newRound({ weapon: 'monohoshizao', weapon2: 'longsword', seed: 1, AIClass: Walker });
    const p = G.player, e = G.enemy;
    p.skill.autoGuard = true;
    const ps = new PlayerSecretWatch(p, e);
    if (meWalks) G.ai.go = 0;
    const out = { wins: [], armedAt: null, L: gnsEnterLine(ps.view()), foeReach: ps.view().foeReach };
    let seen = 0;
    G.before = (t) => {
      if (meWalks && ps.iaiArm.armed) p.move.set(0, p.foeDistance() > 1.3 ? 0.25 : 0);
      ps.update(DT, !!p.skill.sec);
      if (ps.iaiArm.armed && out.armedAt == null) out.armedAt = t;
      if (ps.opened !== seen) { seen = ps.opened; if (ps.open) out.wins.push({ t, ev: ps.open.ctx?.ev, d: p.foeDistance() }); }
    };
    for (let i = 0; i < 14 / DT && p.foeDistance() > 1.4; i++) G.step();
    out.end = p.foeDistance();
    G.world.free();
    return out;
  });
}

test('실제 몸: 준비된 채 상대가 걸어 들어오면 창이 한 번 (들어옴) · ?gnsEnter=0 이면 창 없음 (옛 판 그대로)', () => {
  const on = walkIn({});
  assert.ok(on.armedAt != null && on.armedAt <= SECRET.iaiArmTime + 0.1, `준비 ${on.armedAt}`);
  assert.equal(on.wins[0]?.ev, 'enter', JSON.stringify(on.wins)); // 첫 창 = 선을 넘을 때
  assert.equal(on.wins.filter((w) => w.ev === 'enter').length, 1, JSON.stringify(on.wins)); // 한 번만
  assert.ok(on.wins[0].d <= on.L + 0.05 && on.wins[0].d > on.L - 0.2, `${on.wins[0].d} L ${on.L}`);
  const off = walkIn({ gnsEnter: 0 });
  assert.equal(off.wins.filter((w) => w.ev === 'enter' || w.d > on.foeReach).length, 0, JSON.stringify(off.wins)); // 상대 칼 거리 밖에선 창 없음 — 들어온 뒤(멈추며 칼이 흔들려 '든' 사건) 말고는
  assert.ok(off.end <= 1.45); // 창 없이 가까이 붙음 (사장님이 본 그대로)
});

test('실제 몸: 내가 걸어 들어가 선을 넘은 것은 들어옴이 아님 (상대는 서 있음)', () => {
  const me = walkIn({}, { meWalks: true });
  assert.ok(me.armedAt != null);
  assert.equal(me.wins.filter((w) => w.ev === 'enter').length, 0, JSON.stringify(me.wins));
});
