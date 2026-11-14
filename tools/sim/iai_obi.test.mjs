// 帯刀 시험 (사장님 11/14 결정 "권고대로 둘 다 진행해" — 기록 docs/strike/iai_obi_2026-11-14.md · 확인표 3870 ~ · src/iai_obi.js · 시간 상한 기준 없음 — 자리 · 거리 · 틈 · 뚫음만 봄)
//  ① 기본값: SECRET.iaiObi · iaiObiSaya 1 · 칼집 입(= 칼날 시작)이 배꼽 앞(몸 가운데 · 배 앞면 밖 · 허리띠 높이) · 칼 축은 왼 뒤로 · 쉬는 칼집 축은 그보다 뒤로 · 새 시간 값 없음
//  ② 대기 칼 자리 (사람 허리 대기 · AI 웅크린 대기 × 일본 칼 넷): 코등이가 배꼽 앞(골반 틀 몸 가운데 ±4 cm · 배 앞면 밖) · 칼이 칼집 안(칼집이 칼을 감싸고 칼날이 칼집 겉 밖으로 안 나옴) /
//     끄면(?iaiObi=0) 코등이가 몸 가운데에서 왼쪽 10 cm 넘게 (11/14 판)
//  ③ 칼집은 골반을 따름: 서기 · 걷기 · 달리기 · 물러서기 동안 칼집이 골반 그림 그룹의 아이 · 골반 틀 자리 그대로(쉬는 칼집)
//  ④ 칼집 입 ↔ 왼손: 대기 동안 왼손 쥠 자리(칼 축 칼날 시작 + iaiSayaKoi)가 칼집 입 + iaiSayaKoi 와 같은 점 · 鞘引き 끝(굳음)은 왼손이 칼집 입 쥠 자리 곁(5 cm 안) ·
//     다시 쥘 때 빈손 목표가 鞘戻し 점 = 쉬는 칼집 입 쥠(obiGrip)을 지남 (칼집 입을 제자리로 돌려 놓음)
//  ⑤ 뚫음 · 틈 한도 (동작 대본 — 서기 ~ 쓰러져 죽음): 쉬는 칼집이 골반 · 배 겉에서 0 ~ 1.5 cm (떠 보이지 않음) · 몸통 뚫음 0.5 cm 아래 · 다리 · 가슴은 안 닿음 · 땅으로 0.5 cm 넘게 안 듦
//  ⑥ 스위치 끔이면 전 판 · 칼집은 그림만: iaiObi 0 = 칼집 없음 · 대기 칼 자리 iaiReady · 뽑는 자리 iaiPath.B / iaiObiSaya 0 · 1 의 몸 · 칼 자리가 스텝마다 같음
//  ── 11/14 사장님 '동방과 일본은 전부 권고대로' (감독 권고 넷 — 기록 §12 · 확인표 3886 ~):
//  ⑦ 날 위 (iaiObiEdge — 그림만): 발도 대기 끝에 칼 그림의 날(칼 +x)이 위(칼 축에 수직인 위와 cos 0.95 넘게) · 뽑아 굳음에 들면 돌림 0 · 끄면 날 아래(그림 = 물리)
//  ⑧ 사게오 (iaiObiSageo): 끈이 칼집 栗形 ↔ 허리띠 매는 자리를 잇고(대기 동안 두 끝 거리가 끈 길이 안 — 뜬 틈을 이음) · 끈이 골반 · 배 · 다리를 0.5 cm 넘게 안 뚫음 · 끄면 끈 없음
//  ⑨ 다라이시 (iaiObiOwn): 자기 빈 검집(몸 · 쇠붙이)이 칼집 틀로 옮겨짐 · 매다는 끈 감춤 · 쉬는 칼집 틈 0 ~ 1.5 cm · 몸통 · 땅 뚫음 0.5 cm 아래 · 대기 동안 칼을 감쌈 / 끄면 옛 자리
//  ⑩ 누운 몸 (iaiObiDroop): 네 방향으로 쓰러진 죽음 — 땅 · 몸통 · 다리 뚫음 0.5 cm 아래 · 칼집 쪽이 위인 몸(오른쪽으로 누움)도 칼집이 허공으로 서지 않음(가장 높은 점 0.5 m 아래 — 끄면 0.6 m 넘게 섬)
//  ⑪ 넷 모두 그림만: 네 스위치를 다 끄든 켜든 AI 대 AI 판(기본 · 다라이시 겉모습)의 몸 · 칼 자리가 스텝마다 같음
//  node --test tools/sim/iai_obi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, DT, newRound, AI } from './harness_m.mjs';
import { readyShot, sayaScript, sayaMeasure, lookOf, WEAPONS } from './iai_obi.mjs';
import { mhzShot } from './mhz_draw.mjs';
import { iaiReadyPose, iaiReadyPosePlayer, requestIai } from '../../src/secret_instant.js';
import { obiGrip, obiPulled, obiSayaPose } from '../../src/iai_obi.js';
import * as THREE from '../../node_modules/three/build/three.module.js';

const { SECRET } = CONFIG;
const withS = (vals, fn, O = SECRET) => {
  const old = {};
  for (const k of Object.keys(vals)) (old[k] = O[k]), (O[k] = vals[k]);
  try {
    return fn();
  } finally {
    Object.assign(O, old);
  }
};
const tv = (t) => new THREE.Vector3(t.x, t.y, t.z);
const tq = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const toPelvis = (f, w) => w.clone().sub(tv(f.bodies.pelvis.translation())).applyQuaternion(tq(f.bodies.pelvis.rotation()).invert());
const offHandW = (f) => new THREE.Vector3(0, -0.135, 0).applyQuaternion(tq(f.bodies.farmO.rotation())).add(tv(f.bodies.farmO.translation()));

test('① 기본값 — 帯刀 켬 · 칼집 입이 배꼽 앞 · 칼 축 왼 뒤 · 쉬는 칼집 축은 더 뒤 · 새 시간 값 없음', () => {
  assert.equal(SECRET.iaiObi, 1);
  assert.equal(SECRET.iaiObiSaya, 1);
  const [x, y, z] = SECRET.iaiObiMouth;
  assert.ok(x > 0.15 && x < 0.3, `배 앞면(골반 상자 앞 0.1) 밖 한 주먹 (${x})`);
  assert.ok(Math.abs(y - SECRET.iaiSayaHip[1]) < 0.02, `허리띠 높이 (${y})`);
  assert.ok(Math.abs(z) <= 0.04, `몸 가운데 (${z})`);
  assert.ok(SECRET.iaiObiAxis.yaw < -90 && SECRET.iaiObiAxis.yaw > -135 && SECRET.iaiObiAxis.el < 0, '대기 칼 축: 왼 뒤로 조금 아래');
  assert.ok(SECRET.iaiObiSayaAxis.yaw < SECRET.iaiObiAxis.yaw, '쉬는 칼집 축이 대기 칼 축보다 뒤로 (왼 앞 허리 모서리에 닿게)');
  assert.ok(SECRET.iaiObiPull.yaw < SECRET.iaiObiSayaAxis.yaw, '鞘引き 끝 칼집은 허리를 따라 더 뒤로');
  assert.ok(SECRET.iaiObiFollow.m > 0 && SECRET.iaiObiFollow.deg > 0 && SECRET.iaiObiSkin >= 0);
  assert.ok([0.2, 0.4, 0.6, 1.2, 1.5, 2.0, 3.0, 6.0, 10.0].includes(SECRET.iaiRegrip), '칼집 놓임 · 감쌈 걷음은 iaiRegrip 그대로');
});

test('② 대기 칼 자리 — 코등이가 배꼽 앞 · 칼이 칼집 안 (사람 허리 대기 · AI 웅크린 대기 × 일본 칼 넷) / 끄면 11/14 판', () => {
  // 모노호시자오 AI 웅크린 대기는 바탕(11/14 판)부터 대기 칼이 자세를 못 지킴(이 장면 칼 축 yaw −49 · el +49 — 긴 칼) — 칼집은 한도 밖이라 안 따름만 봄
  for (const weapon of WEAPONS)
    for (const mode of ['hip', 'crouch']) {
      const r = readyShot({ weapon, mode });
      if (weapon === 'monohoshizao' && mode === 'crouch') {
        if (r.da > 2 * SECRET.iaiObiFollow.deg) assert.equal(r.follow, 0, '한도 두 배 밖이면 칼집은 제자리');
        continue;
      }
      const [tx, , tz] = r.tsuba;
      assert.ok(Math.abs(tz) < 0.04, `${weapon} ${mode} 코등이 몸 가운데 (${tz})`);
      assert.ok(tx > 0.12 && tx < 0.32, `${weapon} ${mode} 코등이 배 앞 (${tx})`);
      assert.ok(r.follow >= 0.9, `${weapon} ${mode} 칼집이 칼을 감쌈 (${r.follow})`);
      assert.ok(r.bladeOut <= 0.01, `${weapon} ${mode} 칼날이 칼집 겉 안 (${r.bladeOut})`);
    }
  const b = withS({ iaiObi: 0 }, () => readyShot({ weapon: 'uchigatana', mode: 'hip' }));
  assert.ok(b.tsuba[2] < -0.1 && b.follow == null, `끄면 코등이가 배꼽보다 왼쪽 (${b.tsuba}) · 칼집 없음`);
});

/** 동작 대본 한 판 (서기 · 걷기 · … · 쓰러져 죽음 — iai_obi.mjs SCRIPT) */
const scripts = {};
const script = (weapon) => (scripts[weapon] ??= sayaScript({ weapon, look: 'player', visual: false }));

test('③ 칼집은 골반을 따름 — 골반 그림 그룹의 아이 · 걷고 뛰는 동안 골반 틀 자리 그대로', () => {
  const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed: 1, gap: 6 });
  const P = G.player;
  try {
    assert.ok(P.obiSaya && P.obiSaya.g.parent === P.groups.pelvis, '골반 그림 그룹에 닮');
    P.aiControlled = true;
    G.ai.update = () => {};
    const seen = [];
    for (let i = 0; i < Math.round(3.5 / DT); i++) {
      if (G.t > CONFIG.ARENA.startHold) P.move.set(0, i % 400 < 200 ? 0.5 : 1);
      G.step();
      P.syncMeshes();
      if (G.t > CONFIG.ARENA.startHold) seen.push([P.obiSaya.g.position.clone(), P.obiSaya.g.quaternion.clone()]);
    }
    const [p0, q0] = seen[0];
    for (const [p, q] of seen) {
      assert.ok(p.distanceTo(p0) < 1e-6 && Math.abs(q.dot(q0)) > 1 - 1e-9, '쉬는 칼집은 골반 틀에서 움직이지 않음');
    }
    const gp = P.groups.pelvis;
    const w = P.obiSaya.g.getWorldPosition(new THREE.Vector3());
    const local = toPelvis(P, w);
    assert.ok(local.distanceTo(P.obiSaya.g.position) < 1e-4 && gp.position.distanceTo(tv(P.bodies.pelvis.translation())) < 1e-6, '골반 몸체 자리를 따라 그려짐');
  } finally {
    G.world.free();
  }
});

test('④ 칼집 입 ↔ 왼손 쥠 자리 — 대기 동안 같은 점 · 鞘引き 끝은 왼손 곁', () => {
  // 모노호시자오 AI 웅크린 대기는 바탕부터 대기 칼이 자세를 못 지킴(② 머리말) — 사람 허리 대기로
  for (const [weapon, mode] of [['uchigatana', 'crouch'], ['monohoshizao', 'hip']]) {
    const hip = mode === 'hip';
    const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed: 1, gap: 4, onFighter(f) { if (f.index === 0 && hip) f.humanInput = true; } });
    const P = G.player;
    try {
      if (hip) { P.skill.corr = CONFIG.SKILL.corr; P.skill.corrTip = CONFIG.SKILL.corrTip; P.skill.autoGuard = true; } else P.aiControlled = true;
      G.ai.update = () => {};
      let fire = false;
      G.before = () => (fire ? null : hip ? iaiReadyPosePlayer(P, true, false, DT, true) : iaiReadyPose(P, true, DT));
      while (G.t < CONFIG.ARENA.startHold + 1.5) (G.step(), P.syncMeshes());
      // 대기: 칼집 입 쥠(칼집 틀 y = iaiSayaKoi) = 칼 축 칼날 시작 + iaiSayaKoi (offHand 가 쥐는 점) · 왼손이 그 곁
      const pose = obiSayaPose(P);
      const koiS = new THREE.Vector3(0, SECRET.iaiSayaKoi, 0).applyQuaternion(pose.quat).add(pose.pos);
      const koiW = new THREE.Vector3(0, P.weaponCfg.hiltLength + SECRET.iaiSayaKoi, 0).applyQuaternion(tq(P.sword.rotation())).add(tv(P.sword.translation()));
      const koiP = toPelvis(P, koiW);
      assert.ok(pose.follow >= 0.9 && koiS.distanceTo(koiP) < 0.005, `${weapon} 대기 칼집 입 쥠 = 칼 쥠 자리 (${koiS.distanceTo(koiP)})`);
      assert.ok(toPelvis(P, offHandW(P)).distanceTo(koiS) < 0.04, `${weapon} 왼손이 칼집 입을 쥠 (${toPelvis(P, offHandW(P)).distanceTo(koiS)})`);
      // 鞘引き 끝 (굳음): 왼손 ↔ 칼집 입 쥠 자리
      fire = true;
      requestIai(P, { player: hip });
      let hold = null;
      for (let i = 0; i < Math.round(1.5 / DT) && hold == null; i++) {
        G.step();
        P.syncMeshes();
        if (P.iaiHoldT > 0 && !P.iai) {
          const ps = obiSayaPose(P);
          const g = new THREE.Vector3(0, SECRET.iaiSayaKoi, 0).applyQuaternion(ps.quat).add(ps.pos);
          if (ps.k > 0.95) hold = toPelvis(P, offHandW(P)).distanceTo(g);
        }
      }
      assert.ok(hold != null && hold < 0.05, `${weapon} 굳음 동안 왼손이 당긴 칼집 입 곁 (${hold})`);
      const { M } = obiPulled(P);
      assert.ok(M.length() > 0.15, '鞘引き 끝 칼집 입은 왼 허리 곁');
      assert.ok(obiGrip(P).x > 0.1, '鞘戻し 점은 배 앞');
    } finally {
      G.world.free();
    }
  }
  // 鞘戻し: 다시 쥐는 동안 빈손 목표(골반 틀)가 쉬는 칼집 입 쥠을 지남
  for (const start of ['hip', 'crouch']) {
    const r = mhzShot({ weapon: 'uchigatana', foeW: 'longsword', guard: 'langort', start, gapAdd: 0.3 });
    const g = obiGrip({ side: 1 });
    const R = r.frames.filter((f) => f.rgK != null && f.offP);
    const d = Math.min(...R.map((f) => Math.hypot(f.offP[0] - g.x, f.offP[1] - g.y, f.offP[2] - g.z)));
    assert.ok(R.length > 0 && d < 0.002, `${start} 빈손 목표가 鞘戻し 점(쉬는 칼집 입 쥠)을 지남 (${d})`);
  }
});

test('⑤ 뚫음 · 틈 한도 — 쉬는 칼집은 골반 · 배 겉에서 0 ~ 1.5 cm · 몸통 뚫음 0.5 cm 아래 · 다리 · 가슴 안 닿음 · 땅 안 듦 (동작 대본)', () => {
  for (const weapon of ['uchigatana', 'monohoshizao']) {
    const r = script(weapon);
    for (const [k, v] of Object.entries(r.rows)) {
      assert.ok(v.n > 0, `${weapon} ${k} 표본`);
      assert.ok(v.torso >= -0.005, `${weapon} ${k} 골반 · 배 뚫음 ${v.torso}`);
      assert.ok(v.leg > 0, `${weapon} ${k} 다리 ${v.leg}`);
      assert.ok(v.chest > 0, `${weapon} ${k} 가슴 ${v.chest}`);
      assert.ok(v.ground >= -0.005, `${weapon} ${k} 땅으로 듦 ${v.ground} (누운 몸 — 입을 축으로 눕힘)`);
      if (['stand', 'walk', 'run', 'back'].includes(k)) assert.ok(v.gapMin >= 0 && v.gapMax <= 0.015, `${weapon} ${k} 쉬는 칼집 틈 ${v.gapMin} ~ ${v.gapMax} (떠 보이지 않음)`);
    }
  }
});

test('⑥ 끄면 전 판 · 칼집은 그림만 — iaiObi 0 = 칼집 없음 · iaiReady 대기 · iaiPath.B / iaiObiSaya 0 · 1 몸 · 칼 자리 스텝마다 같음', () => {
  withS({ iaiObi: 0 }, () => {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed: 1, gap: 4 });
    const P = G.player;
    try {
      assert.equal(P.obiSaya, null, '칼집 없음');
      P.aiControlled = true;
      G.ai.update = () => {};
      G.before = () => iaiReadyPose(P, true, DT);
      while (G.t < CONFIG.ARENA.startHold + 0.5) G.step();
      assert.deepEqual([...P.skill.thrustPose.hand], SECRET.iaiReady.hand, '대기 칼 손 = iaiReady');
      assert.equal(P.iaiObiW, 0);
      requestIai(P, {});
      G.step();
      assert.equal(P.iai.K.B, SECRET.iaiPathRise.B, '뽑는 자리 = 전 길 B');
    } finally {
      G.world.free();
    }
  });
  // 그림만: 칼집을 달든 안 달든 AI 대 AI 판의 몸 · 칼 자리가 스텝마다 같음
  const trace = (saya) =>
    withS({ iaiObiSaya: saya }, () => {
      const G = newRound({ walls: true, seed: 3, weapon: 'uchigatana', weapon2: 'longsword', AI2Class: AI, persona: { proficiency: 3 }, persona2: { proficiency: 5 } });
      const out = [];
      try {
        for (let i = 0; i < Math.round(8 / DT); i++) {
          G.step();
          G.player.syncMeshes();
          if (i % 20 === 0) for (const f of [G.player, G.enemy]) for (const b of [f.bodies.pelvis, f.bodies.farmS, f.sword]) { const t = b.translation(); out.push(t.x, t.y, t.z); }
        }
        return { out, has: !!G.player.obiSaya };
      } finally {
        G.world.free();
      }
    });
  const a = trace(1);
  const b = trace(0);
  assert.ok(a.has && !b.has, '칼집 그림 켬 · 끔');
  assert.deepEqual(a.out, b.out, '몸 · 칼 자리 스텝마다 같음');
});

// ── 11/14 감독 권고 넷 ──
const NEW4 = ['iaiObiSageo', 'iaiObiOwn', 'iaiObiEdge', 'iaiObiDroop'];
const edgeCos = (f) => {
  const q = f.swordGroup.quaternion;
  const b = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const e = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const u = new THREE.Vector3(0, 1, 0).addScaledVector(b, -b.y).normalize();
  return e.dot(u);
};

test('⑦ 날 위 (그림만) — 대기 끝에 칼 그림의 날이 위 · 뽑아 굳음에 들면 돌림 0 · 끄면 날 아래', () => {
  for (const weapon of ['uchigatana', 'monohoshizao'])
    for (const on of [1, 0])
      withS({ iaiObiEdge: on }, () => {
        const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed: 1, gap: 2.4 });
        const P = G.player;
        try {
          P.aiControlled = true;
          G.ai.update = () => { G.enemy.move.set(0, 0); };
          let fired = false;
          G.before = () => { if (!fired) iaiReadyPose(P, true, DT); };
          while (G.t < CONFIG.ARENA.startHold + 1.5) { G.step(); P.syncMeshes(); }
          const c = edgeCos(P);
          if (on) assert.ok(c > 0.95, `${weapon} 대기 끝 날 위 (cos ${c.toFixed(3)})`);
          else assert.ok(c < 0, `${weapon} 끄면 날 아래 — 그림 = 물리 (cos ${c.toFixed(3)})`);
          fired = true;
          requestIai(P, {});
          for (let i = 0; i < Math.round(1.2 / DT) && !(P.iaiHoldT > 0); i++) { G.step(); P.syncMeshes(); }
          assert.ok(P.iaiHoldT > 0, `${weapon} 뽑아 굳음`);
          assert.ok(Math.abs(P.obiEdge?.roll ?? 0) < 1e-6, `${weapon} 굳음에 들면 돌림 0 (${P.obiEdge?.roll})`);
        } finally {
          G.world.free();
        }
      });
});

test('⑧ 사게오 — 栗形 ↔ 허리띠를 잇고 대기 동안 끈 길이 안 · 몸을 안 뚫음 / 끄면 없음', () => {
  for (const weapon of ['uchigatana', 'monohoshizao']) {
    const r = script(weapon);
    for (const [k, v] of Object.entries(r.rows)) {
      assert.ok(v.cTorso >= -0.005, `${weapon} ${k} 끈 골반 · 배 뚫음 ${v.cTorso}`);
      assert.ok(v.cLeg >= -0.005, `${weapon} ${k} 끈 다리 ${v.cLeg}`);
      assert.ok(v.cGround >= -0.005, `${weapon} ${k} 끈 땅 ${v.cGround}`);
      if (k === 'ready' || k === 'lowwalk') assert.ok(v.cSpan <= 0.14 + 1e-3, `${weapon} ${k} 대기 동안 두 끝 거리 ${v.cSpan} ≤ 끈 길이 (뜬 칼집을 허리띠에 이음)`);
    }
  }
  withS({ iaiObiSageo: 0 }, () => {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed: 1, gap: 4 });
    try {
      assert.ok(G.player.obiSaya && !G.player.obiSaya.cord, '끄면 끈 없음');
      assert.equal(G.player.groups.pelvis.getObjectByName('iai-obi-sageo'), undefined);
    } finally {
      G.world.free();
    }
  });
});

test('⑨ 다라이시 — 자기 빈 검집이 허리띠 자리로 (꼴 그대로) · 틈 · 뚫음 한도 / 끄면 옛 자리', () => {
  for (const [look, weapon] of [['silver_wanderer', 'uchigatana'], ['silver_wanderer_mad', 'monohoshizao']]) {
    const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed: 1, gap: 4, look: lookOf(look) });
    try {
      const S = G.player.obiSaya;
      assert.ok(S && S.own, `${look} 자기 검집을 칼집으로`);
      const moved = [];
      S.g.traverse((o) => { if (o.isMesh) moved.push(o.name); });
      assert.ok(moved.includes('daraishi-scabbard') && moved.includes('daraishi-scabbard-fit'), `${look} 검집 몸 · 쇠붙이를 칼집 틀로 옮김 (${moved})`);
      const strap = G.player.groups.pelvis.getObjectByName('daraishi-scabbard-strap');
      assert.ok(!strap || strap.visible === false, '옛 자리 매다는 끈 감춤');
    } finally {
      G.world.free();
    }
    const r = sayaScript({ weapon, look, visual: false });
    for (const [k, v] of Object.entries(r.rows)) {
      assert.ok(v.torso >= -0.005, `${look} ${k} 골반 · 배 뚫음 ${v.torso}`);
      assert.ok(v.ground >= -0.005, `${look} ${k} 땅 ${v.ground}`);
      if (['stand', 'walk', 'run', 'back'].includes(k)) assert.ok(v.gapMin >= 0 && v.gapMax <= 0.015, `${look} ${k} 쉬는 칼집 틈 ${v.gapMin} ~ ${v.gapMax}`);
    }
    assert.ok(r.rows.ready.follow > 0.9, `${look} 대기 동안 칼을 감쌈 (${r.rows.ready.follow})`);
  }
  withS({ iaiObiOwn: 0 }, () => {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed: 1, gap: 4, look: lookOf('silver_wanderer') });
    try {
      assert.equal(G.player.obiSaya, null, '끄면 칼집 없음 (옛 자리 검집)');
      const sc = G.player.groups.pelvis.getObjectByName('daraishi-scabbard');
      assert.ok(sc && sc.visible !== false && !/iai-obi/.test(sc.parent?.name ?? ''), '옛 자리 검집 그대로');
    } finally {
      G.world.free();
    }
  });
});

const fallDir = (dir, droop) =>
  withS({ iaiObiDroop: droop }, () => {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed: 1, gap: 7.0 });
    const P = G.player;
    try {
      P.aiControlled = true;
      G.ai.update = () => { G.enemy.move.set(0, 0); };
      G.before = () => { P.move.set(0, 0); };
      while (G.t < CONFIG.ARENA.startHold + 0.3) G.step();
      const c = P.bodies.chest;
      const p = c.translation();
      const o = G.enemy.bodies.chest.translation();
      const fw = new THREE.Vector3(o.x - p.x, 0, o.z - p.z).normalize();
      const lf = new THREE.Vector3(0, 1, 0).cross(fw);
      const d = { 앞: fw, 뒤: fw.clone().negate(), 왼: lf, 오른: lf.clone().negate() }[dir];
      c.applyImpulseAtPoint({ x: d.x * 70, y: 0, z: d.z * 70 }, { x: p.x, y: p.y + 0.1, z: p.z }, true);
      P.die('obi-test', true);
      const r = { ground: 1, torso: 1, leg: 1, top: -1 };
      for (let i = 0; i < Math.round(3.0 / DT); i++) {
        G.step();
        if (i % 4) continue;
        const m = sayaMeasure(P);
        r.ground = Math.min(r.ground, m.ground);
        r.torso = Math.min(r.torso, m.gap);
        r.leg = Math.min(r.leg, m.leg);
        if (i > 1.5 / DT) r.top = Math.max(r.top, Math.max(...m.axis.map((q) => q.y)));
      }
      return r;
    } finally {
      G.world.free();
    }
  });

test('⑩ 누운 몸 — 네 방향 쓰러짐에서 땅 · 몸통 · 다리 안 뚫음 · 칼집 쪽이 위인 몸도 칼집이 허공으로 서지 않음', () => {
  for (const dir of ['앞', '뒤', '왼', '오른']) {
    const r = fallDir(dir, 1);
    assert.ok(r.ground >= -0.005 && r.torso >= -0.005 && r.leg >= -0.005, `${dir} 땅 ${r.ground} · 몸통 ${r.torso} · 다리 ${r.leg}`);
    if (dir === '오른') {
      assert.ok(r.top < 0.5, `오른쪽으로 누운 몸 — 칼집 가장 높은 점 ${r.top} m (허공으로 서지 않음)`);
      const off = fallDir(dir, 0);
      assert.ok(off.top > 0.6, `끄면 칼집이 섬 (${off.top} m — 11/14 판)`);
    }
  }
});

test('⑪ 넷 모두 그림만 — 네 스위치를 끄든 켜든 몸 · 칼 자리가 스텝마다 같음 (기본 · 다라이시 겉모습)', () => {
  for (const look of ['player', 'silver_wanderer']) {
    const trace = (on) =>
      withS(Object.fromEntries(NEW4.map((k) => [k, on])), () => {
        const G = newRound({ walls: true, seed: 3, weapon: 'uchigatana', weapon2: 'longsword', look: lookOf(look), AI2Class: AI, persona: { proficiency: 3 }, persona2: { proficiency: 5 } });
        const out = [];
        try {
          for (let i = 0; i < Math.round(8 / DT); i++) {
            G.step();
            G.player.syncMeshes();
            if (i % 20 === 0) for (const f of [G.player, G.enemy]) for (const b of [f.bodies.pelvis, f.bodies.farmS, f.sword]) { const t = b.translation(); out.push(t.x, t.y, t.z); }
          }
          return out;
        } finally {
          G.world.free();
        }
      });
    assert.deepEqual(trace(1), trace(0), `${look} 몸 · 칼 자리 스텝마다 같음`);
  }
});
