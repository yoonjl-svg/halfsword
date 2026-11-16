// 막기 2.0 STEP B — 가로막기 · 덮는 맞받기 시험 (11/17 · config AI_INTERCEPT · src/ai_intercept.js · 기록 docs/strike/ai_intercept_2026-11-17.md):
//  기본 끔 · 끄면 셈 · 굴림 없음 · 상대 칼 길 내다보기(둥근 칼 읽기와 같은 회전) · 가로지르는 손 자리를 고름 · 띠 기울기 굴림(무 0 · 높음 1) · 판에서 쓰임.
//  node --test tools/sim/ai_intercept.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { foePath, icpAim, icpArm, strikeCoverPrep, strikeCoverQ } from '../../src/ai_intercept.js';

const I = CONFIG.AI_INTERCEPT;
function withIcp(o, fn) {
  const keep = { ...I };
  Object.assign(I, o);
  try {
    return fn();
  } finally {
    Object.assign(I, keep);
  }
}
/** 독일 롱소드 AI 숙련 p (E 자리 = G.ai) */
function round(p = 4, seed = 1) {
  const G = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: p }, persona2: { proficiency: p } });
  return { G, ai: G.ai, free: () => G.world.free() };
}

test('기본 끔 · 값 (시간 사다리 0.2 s · 걸음 사다리 0.3 m · 패드 칸 0.15 m)', () => {
  assert.equal(I.on, 0, '사장님 확인 전 — 기본 끔');
  assert.ok(I.aim === 1 && I.counter === 1 && I.strike === 0 && I.grid === 0.15 && I.thrustR === 0.3 && Math.abs(I.qual - CONFIG.realS(0.2)) < 1e-12, JSON.stringify(I));
});

test('끄면 가로막기 셈 · 굴림이 없다 (판에서 stats.icp 없음 · ai.icp 없음)', () => {
  const { G, ai, free } = round();
  try {
    while (G.t < 12) G.step();
    assert.equal(ai.stats.icp, undefined);
    assert.equal(ai.icp, undefined);
    assert.equal(G.ai2.stats.icp, undefined);
  } finally {
    free();
  }
});

test('상대 칼 길: 한 축으로 도는 칼은 회전 그대로 내다봄 (둥근 칼 읽기와 같은 셈) · 몸에 드는 칸', () => {
  // 가슴 (0, 1.2, 0) · 앞 1.6 m 의 축(위)으로 w rad/s 도는 칼 — 칼끝 반지름 1.5 · 타격점 1.3 (칼날 0.7 — 칼 길이 0.667 · 손잡이 끝 반지름 0.833)
  const o = [0, 1.2, 1.6], a0 = 1.25, w = 6;
  const at = (r, a) => [o[0] + r * Math.sin(a), o[1], o[2] - r * Math.cos(a)];
  const vel = (r) => [-w * r * Math.cos(a0), 0, -w * r * Math.sin(a0)];
  const T = at(1.5, a0), M = at(1.3, a0), vT = vel(1.5), vM = vel(1.3);
  const s = { tx: T[0], ty: T[1], tz: T[2], mx: M[0], my: M[1], mz: M[2], tvx: vT[0], tvy: vT[1], tvz: vT[2], mvx: vM[0], mvy: vM[1], mvz: vM[2] };
  const P = foePath(s, { x: 0, y: 1.2, z: 0 });
  for (const k of [0, 4, 10]) {
    const a = a0 + w * k * P.h * -1; // 각이 줄어드는 쪽 (빠르기 부호)
    const tip = at(1.5, a), base = at(1.5 - (1.5 - 1.3) / 0.3, a);
    for (let j = 0; j < 3; j++) {
      assert.ok(Math.abs(P.t[3 * k + j] - tip[j]) < 1e-6, `칼끝 k=${k}`);
      assert.ok(Math.abs(P.b[3 * k + j] - base[j]) < 1e-6, `손잡이 끝 k=${k}`);
    }
  }
  assert.ok(P.kHit > 0 && P.kHit < P.K, `몸에 드는 칸 ${P.kHit} / ${P.K}`);
});

test('가로막기: 오는 칼을 몸 앞에서 가로지르는 손 자리를 고름 (막기 줄 · 패드 · 몸꼴 끔 표시)', () => {
  withIcp({ on: 1 }, () => {
    const { G, ai, free } = round();
    try {
      while (G.t < 1) G.step();
      const me = ai.me;
      const c = me.bodies.chest.translation();
      const f = me.forward();
      const r = me.right();
      // 늦게 본 상대 칼: 내 앞 1.5 m · 위 0.3 m 의 점 o 를 비스듬한 축(위 + 0.8 × 오른쪽)으로 도는 칼 — θ = 0 이면 칼끝(반지름 1.45)이 내 가슴 0.1 m 앞
      const add = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
      const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
      const nrm = (a) => { const l = Math.hypot(a.x, a.y, a.z); return { x: a.x / l, y: a.y / l, z: a.z / l }; };
      const crs = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
      const o = add(add(c, f, 1.5), { x: 0, y: 1, z: 0 }, 0.3);
      const ax = nrm(add({ x: 0, y: 1, z: 0 }, r, 0.8));
      const toC = add({ x: c.x, y: c.y, z: c.z }, o, -1);
      const e1 = nrm(add(toC, ax, -dot(toC, ax)));
      const e2 = crs(ax, e1);
      const th0 = 1.1, w = 7, L = 0.95, R = 1.45;
      const pt = (rr) => add(add(o, e1, rr * Math.cos(th0)), e2, rr * Math.sin(th0));
      const vv = (rr) => { const k = -w * rr; return { x: k * (-Math.sin(th0) * e1.x + Math.cos(th0) * e2.x), y: k * (-Math.sin(th0) * e1.y + Math.cos(th0) * e2.y), z: k * (-Math.sin(th0) * e1.z + Math.cos(th0) * e2.z) }; }; // dθ/dt = −w
      const T = pt(R), Mp = pt(R - 0.3 * L), vT = vv(R), vM = vv(R - 0.3 * L);
      const s = { tx: T.x, ty: T.y, tz: T.z, mx: Mp.x, my: Mp.y, mz: Mp.z, tvx: vT.x, tvy: vT.y, tvz: vT.z, mvx: vM.x, mvy: vM.y, mvz: vM.z };
      ai.mode = 'defend';
      ai.defVoid = false;
      ai.defLine = 'highR';
      icpArm(ai);
      ai.icp = true;
      const ok = icpAim(ai, s, { id: 1, line: 'highR', thrust: false });
      assert.ok(ok, JSON.stringify(ai.stats.icp));
      assert.ok(Array.isArray(ai.icpPad) && Math.hypot(ai.icpPad[0], ai.icpPad[1]) <= 0.62, `패드 ${ai.icpPad}`);
      assert.equal(typeof ai.icpFree, 'boolean');
      assert.ok(['highL', 'highR', 'highC', 'lowL', 'lowR', 'thrust'].includes(ai.defLine));
      assert.equal(ai.stats.icp.aim, 1);
    } finally {
      free();
    }
  });
});

test('덮는 베기 (기본 0 — 켜면): 내 칼 길이 상대 칼을 가로지르면 질 > 0 · 먼 칼은 0 · 띠 0 이면 준비물 없음', () => {
  withIcp({ on: 1, strike: 1 }, () => {
    const { G, ai, free } = round(6);
    try {
      while (G.t < 1) G.step();
      ai.d = ai.M.contact; // 내딛는 걸음 0 (칼이 닿는 거리에 서 있음)
      const me = ai.me;
      const t = ai.school.techByName.zornhau;
      const c = me.bodies.chest.translation();
      const blade = (pad) => {
        const H = me.handTarget.clone(), D = me.handTarget.clone();
        me.padCommand(pad[0], pad[1], H, D);
        H.applyQuaternion(me.yaw).add({ x: c.x, y: c.y, z: c.z });
        D.applyQuaternion(me.yaw);
        const hl = me.weaponCfg.hiltLength, bl = me.weaponCfg.bladeLength;
        return { mid: H.clone().addScaledVector(D, hl + bl * 0.5), D };
      };
      // 길 가운데 칸 앞뒤의 내 칼 가운데 → 쓸고 가는 쪽 · 칼 면의 법선으로 상대 칼을 세움 (가운데에서 면을 꿰뚫음)
      const a = blade(t.path[0]), b = blade(t.from);
      const sweep = a.mid.clone().sub(b.mid).normalize();
      const n = a.D.clone().cross(sweep).normalize();
      const mid = a.mid;
      const tip = mid.clone().addScaledVector(n, 0.4); // 상대 칼끝
      const base = mid.clone().addScaledVector(n, -0.4);
      const m7 = base.clone().lerp(tip, 0.7);
      const s = { tx: tip.x, ty: tip.y, tz: tip.z, mx: m7.x, my: m7.y, mz: m7.z, armed: true };
      const prep = strikeCoverPrep(ai, s);
      assert.ok(prep && prep.k === 1, '높음 띠 기울기 1');
      assert.ok(strikeCoverQ(ai, prep, t) > 0, '가로지름');
      const far = { ...s, tx: tip.x + 5, mx: m7.x + 5 };
      assert.equal(strikeCoverQ(ai, strikeCoverPrep(ai, far), t), 0, '먼 칼');
      const P0 = round(0);
      try {
        assert.equal(strikeCoverPrep(P0.ai, s), null, '무 띠');
      } finally {
        P0.free();
      }
    } finally {
      free();
    }
  });
});

test('띠 기울기 굴림: 숙련도 0(무) 은 가로막기 없음 · 5 ~ 6(높음) 은 늘 (칼이 있을 때) · 피하기는 끔', () => {
  withIcp({ on: 1 }, () => {
    for (const [p, want] of [[0, false], [6, true]]) {
      const { ai, free } = round(p);
      try {
        for (let i = 0; i < 20; i++) {
          ai.defVoid = false;
          ai.icpPick();
          assert.equal(ai.icp, want, `숙련 ${p}`);
        }
        ai.defVoid = true;
        ai.icpPick();
        assert.equal(ai.icp, false, '피하기');
      } finally {
        free();
      }
    }
  });
});

test('켜면 판에서 쓰임: 막기 굴림 · 겨눔 · 덮는 맞받기 셈', () => {
  withIcp({ on: 1 }, () => {
    let arm = 0, aim = 0, cv = 0;
    for (const seed of [1, 2]) {
      const { G, free } = round(6, seed);
      try {
        while (G.t < 30 && G.player.alive && G.enemy.alive) G.step();
        for (const a of [G.ai, G.ai2]) {
          arm += a.stats.icp?.arm ?? 0;
          aim += a.stats.icp?.aim ?? 0;
          cv += a.stats.icp?.cvTry ?? 0;
        }
      } finally {
        free();
      }
    }
    assert.ok(arm > 0 && aim > 0 && cv > 0, JSON.stringify({ arm, aim, cv }));
  });
});
