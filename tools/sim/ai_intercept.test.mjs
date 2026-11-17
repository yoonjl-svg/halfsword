// 막기 2.0 읽기 묶음 시험 — 가로막기 · 덮는 맞받기 · 공격 절제 · 미리 줄 닫기 · 새 휘두름 (11/17 · config AI_INTERCEPT · src/ai_intercept.js · 기록 docs/strike/ai_intercept_2026-11-17.md ·
//  옮긴 기록 docs/strike/ae_port_2026-11-17.md): [사장님 11/17 결정] 기본 판 — 켜고 끄는 칸 없음 · 상대 칼 길 내다보기(둥근 칼 읽기와 같은 회전) · 가로지르는 손 자리를 고름 ·
//  띠 기울기 굴림(무 0 · 높음 1) · 판에서 쓰임.
//  node --test tools/sim/ai_intercept.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, AI } from './harness_m.mjs';
import { foePath, icpAim, icpArm } from '../../src/ai_intercept.js';

const I = CONFIG.AI_INTERCEPT;
/** 독일 롱소드 AI 숙련 p (E 자리 = G.ai) */
function round(p = 4, seed = 1) {
  const G = newRound({ seed, walls: true, weapon: 'longsword', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: p }, persona2: { proficiency: p } });
  return { G, ai: G.ai, free: () => G.world.free() };
}

test('기본 판 · 값 (시간 사다리 0.2 s · 걸음 사다리 0.3 m · 패드 칸 0.15 m · 몫 1 × 띠 기울기)', () => {
  for (const k of ['on', 'strike', 'human', 'anticWd']) assert.equal(k in I, false, `${k} — 켜고 끄는 칸 · 안 들인 칸 없음 (사장님 11/17)`);
  assert.ok(I.aim === 1 && I.counter === 1 && I.grid === 0.15 && I.thrustR === 0.3 && Math.abs(I.qual - CONFIG.realS(0.2)) < 1e-12, JSON.stringify(I));
  assert.ok(I.discipline === 1 && I.antic === 1 && I.swing === 1, JSON.stringify(I));
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
  {
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
  }
});

test('띠 기울기 굴림: 숙련도 0(무) 은 가로막기 없음 · 5 ~ 6(높음) 은 늘 (칼이 있을 때) · 피하기는 끔', () => {
  {
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
  }
});

test('판에서 쓰임: 막기 굴림 · 겨눔 · 덮는 맞받기 셈', () => {
  {
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
  }
});

// ───────── 막기 2.0 STEP C (11/17 — 공격 절제 · 미리 줄 닫기 · 새 휘두름 — [사장님 11/17 결정] 기본 판) ─────────
import { discHold, anticAim, swingMark, swingTurn } from '../../src/ai_intercept.js';

/** 판을 1 s 돌린 뒤 늦게 본 모습을 갈아 끼움: 상대가 서서 칼끝을 내 가슴으로 겨눔 (칼 멈춤) */
function aimedAt(ai, extra = {}) {
  const c = ai.me.bodies.chest.translation();
  const f = ai.me.forward();
  const tip = { x: c.x + f.x * 0.6, y: c.y, z: c.z + f.z * 0.6 };
  const mid = { x: c.x + f.x * 0.9, y: c.y, z: c.z + f.z * 0.9 };
  const s = { ...ai.lastSeen, tx: tip.x, ty: tip.y, tz: tip.z, mx: mid.x, my: mid.y, mz: mid.z, tvx: 0, tvy: 0, tvz: 0, mvx: 0, mvy: 0, mvz: 0, hvx: 0, hvy: 0, state: 'stand', armed: true, ...extra };
  ai.lastSeen = s;
  ai.d = ai.foeReach;
  ai.sense.recentHandSpeed = () => 0;
  return s;
}

test('공격 절제: 준비된 상대 칼끝이 내 줄이면 높음 띠는 참음 · 휘두르는 중 · 줄 밖 · 무 띠는 안 참음 · 박자마다 한 번 굴림', () => {
  {
    const { G, ai, free } = round(6);
    try {
      while (G.t < 1) G.step();
      aimedAt(ai);
      assert.ok(ai.foeClass(ai.lastSeen).online, '칼끝 겨눔');
      assert.equal(discHold(ai), true, '높음 = 참음');
      assert.equal(ai.stats.icp.discRoll, 1);
      assert.equal(discHold(ai), true);
      assert.equal(ai.stats.icp.discRoll, 1, '같은 박자 = 같은 답');
      ai.discT = -Infinity;
      aimedAt(ai, { tvx: 6 });
      assert.equal(discHold(ai), false, '휘두르는 중 (Indes 몫)');
      const s = aimedAt(ai);
      const rr = ai.me.right();
      ai.lastSeen = { ...s, tx: s.tx + rr.x * 1.5, tz: s.tz + rr.z * 1.5 }; // 칼끝을 옆으로 — 줄 밖
      assert.equal(discHold(ai), false, '칼이 줄 밖');
      aimedAt(ai);
      ai.d = ai.foeReach + 1;
      assert.equal(discHold(ai), false, '멀다');
      assert.equal(ai.startAttack(ai.school.tech[0], 'recover'), true, '헛친 뒤(Nach)는 그대로 엶');
    } finally {
      free();
    }
    const P0 = round(0);
    try {
      while (P0.G.t < 1) P0.G.step();
      aimedAt(P0.ai);
      for (let i = 0; i < 10; i++) {
        P0.ai.discT = -Infinity;
        assert.equal(discHold(P0.ai), false, '무 띠');
      }
    } finally {
      P0.free();
    }
  }
});

test('미리 줄 닫기: 든 칼에서 내다본 길(상대 가슴 축 회전)을 몸 앞에서 가로지르는 손 자리 · 겨누면 찌르기 줄', () => {
  {
    const { G, ai, free } = round(6);
    try {
      while (G.t < 1) G.step();
      const me = ai.me;
      const c = me.bodies.chest.translation();
      const f = me.forward(), r = me.right();
      // 상대 가슴 = 내 앞 1.6 m · 칼을 상대 오른쪽(내 왼쪽) 위로 듦: 손잡이 끝 상대 머리 옆 · 칼끝 위 뒤
      const fc = { x: c.x + f.x * 1.6, y: c.y, z: c.z + f.z * 1.6 };
      const base = { x: fc.x - r.x * 0.25, y: fc.y + 0.45, z: fc.z - r.z * 0.25 };
      const dir = { x: f.x * 0.3 - r.x * 0.3, y: 0.9, z: f.z * 0.3 - r.z * 0.3 };
      const dl = Math.hypot(dir.x, dir.y, dir.z);
      const L = 0.9;
      const tip = { x: base.x + (dir.x / dl) * L, y: base.y + (dir.y / dl) * L, z: base.z + (dir.z / dl) * L };
      const mid = { x: base.x + (dir.x / dl) * L * 0.7, y: base.y + (dir.y / dl) * L * 0.7, z: base.z + (dir.z / dl) * L * 0.7 };
      const s = { ...ai.lastSeen, cx: fc.x, cy: fc.y, cz: fc.z, tx: tip.x, ty: tip.y, tz: tip.z, mx: mid.x, my: mid.y, mz: mid.z, hx: -0.3, hy: 0.4 };
      ai.mode = 'defend';
      ai.defVoid = false;
      assert.equal(ai.foeClass(s).online, false);
      assert.equal(anticAim(ai, s), true, JSON.stringify(ai.stats.icp));
      assert.ok(Array.isArray(ai.icpPad) && Math.hypot(ai.icpPad[0], ai.icpPad[1]) <= 0.62, `패드 ${ai.icpPad}`);
      assert.equal(ai.stats.icp.antAim, 1);
      const S2 = aimedAt(ai);
      anticAim(ai, S2);
      assert.equal(ai.defLine, ai.icpPad && !ai.icpFree ? ai.defLine : 'thrust', '겨눈 칼 = 찌르기 줄 (막기 자리를 고르면 그 줄)');
    } finally {
      free();
    }
  }
});

test('미리 줄 닫기 꼴: 휘두름이 보이면 보통 가로막기로 · 안 오면 막기 시간 뒤 간 보기로', () => {
  {
    const { G, ai, free } = round(6);
    try {
      while (G.t < 1) G.step();
      const s = aimedAt(ai);
      ai.anticGo(s);
      assert.ok(ai.mode === 'defend' && ai.icpPre === true && ai.icp === true && ai.defVoid === false);
      assert.equal(ai.stats.icp.ant, 1);
      ai.timer = 0.001;
      ai.defend(0.01, s, ai.foeReach, null);
      assert.equal(ai.mode, 'watch', '안 옴 → 간 보기');
      assert.equal(ai.icpPre, false);
      assert.equal(ai.stats.icp.antEnd, 1);
      ai.anticGo(s);
      ai.timer = 0.1;
      ai.defend(1 / 120, s, ai.foeReach, { id: 77, line: 'highR', thrust: false });
      assert.equal(ai.icpPre, false, '휘두름이 보임');
      assert.equal(ai.threatSeen, 77, '이 위협은 받음');
      assert.equal(ai.mode, 'defend');
      assert.equal(ai.stats.icp.antTh, 1);
    } finally {
      free();
    }
  }
});

test('새 휘두름: 칼 가는 방향이 90° 넘게 꺾이면 높음 띠는 새 번호 · 안 꺾이면 그대로 · 무 띠는 안 줌', () => {
  {
    for (const [p, want] of [[6, true], [0, false]]) {
      const { ai, free } = round(p);
      try {
        const s = { tvx: 8, tvy: 0, tvz: 0, mvx: 5, mvy: 0, mvz: 0 };
        swingMark(ai, s);
        assert.equal(swingTurn(ai, { ...s, tvx: 7, tvy: 2 }), false, '같은 쪽');
        assert.equal(swingTurn(ai, { ...s, tvx: -8 }), want, `되돌아 옴 · 숙련 ${p}`);
        assert.equal(ai.stats.icp.swTurn, 1);
        assert.equal(swingTurn(ai, { ...s, tvx: -8 }), false, '한 번 꺾임에 한 번');
      } finally {
        free();
      }
    }
  }
});

test('STEP C 판에서 쓰임: 절제 굴림 · 미리 닫음 · 꺾임 셈', () => {
  {
    const t = { discRoll: 0, ant: 0, swTurn: 0 };
    for (const seed of [1, 2, 3]) {
      const { G, free } = round(4, seed);
      try {
        while (G.t < 40 && G.player.alive && G.enemy.alive) G.step();
        for (const a of [G.ai, G.ai2]) for (const k in t) t[k] += a.stats.icp?.[k] ?? 0;
      } finally {
        free();
      }
    }
    assert.ok(t.discRoll > 0 && t.ant > 0 && t.swTurn > 0, JSON.stringify(t));
  }
});
