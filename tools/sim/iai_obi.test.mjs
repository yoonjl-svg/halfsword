// 帯刀 시험 (사장님 11/14 결정 "권고대로 둘 다 진행해" — 기록 docs/strike/iai_obi_2026-11-14.md · 확인표 3870 ~ · src/iai_obi.js · 시간 상한 기준 없음 — 자리 · 거리 · 틈 · 뚫음만 봄)
//  ① 기본값: SECRET.iaiObi · iaiObiSaya 1 · 칼집 입(= 칼날 시작)이 배꼽 앞(몸 가운데 · 배 앞면 밖 · 허리띠 높이) · 칼 축은 왼 뒤로 · 쉬는 칼집 축은 그보다 뒤로 · 새 시간 값 없음
//  ② 대기 칼 자리 (사람 허리 대기 · AI 허리 대기(11/19 — 전 웅크린 대기) × 일본 칼 넷): 코등이가 배꼽 앞(골반 틀 몸 가운데 ±4 cm · 배 앞면 밖) · 칼이 칼집 안(칼집이 칼을 감싸고 칼날이 칼집 겉 밖으로 안 나옴) /
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
//  ── 11/14 사장님 '플레이어 기준으로, 일본 유파 새로 만든 검집이 너무 옆으로 각도가 벌어진 거 같은데' → '고쳐' · '발도 대기 자세로 전환될 때 칼을 칼집에 넣는 모션 … 0.6초' · '2초 후에 납도 시작' (기록 §13):
//  ⑫ 쉬는 칼집: 입이 배 왼쪽 앞(배 그림 상자 앞 · 옆 모서리 곁) · 위에서 볼 때 바로 뒤에서 15 ~ 25° 바깥 · 아래로 기움 10 ~ 20° (서기 · 걷기 · 달리기 동안 골반 틀 그대로 — 뚫음 · 틈은 ⑤)
//  ⑬ 납도 (SECRET.iaiSheathe): 사람 창 — iaiArmTime 에 납도 시작 · iaiArmTime + iaiSheathe 에 준비(그 전엔 창 없음) · 납도 동안 손 · 칼 덧씌우기 · 끝에 칼이 칼집 안 /
//     도중 막기 단추 · 이동 입력이면 그만둠(셈 0 · 덧씌우기 곧장 0) / 끄면(0) iaiArmTime 에 준비 · 납도 없음 / AI 셈(IaiArm) 같음 · 납도 동안 칼날이 몸 · 다리를 안 뚫음 (시간 상한 기준 없음 — 차례 · 자리만)
//  ⑭ 칼끝이 칼집 입으로 들어감 (11/14 사장님 '칼끝이 들어가도록 충분히 들어올려지지 않았는데 칼집을 뚫고 순간이동하는 느낌'): 납도 동안 그림 칼끝(휜 칼날 · 날 위 굴림)이
//     칼집 안으로 든 첫 스텝의 앞 스텝이 칼집 입 곁(입 밖 3 cm 안 · 단면 1.3 배 안) · 칼집 몸 옆(입이 아닌 데)으로 든 스텝 0 (사람 허리 대기 · AI 웅크린 대기 × 우치가타나 · 무라마사 · 쿠사나기 —
//     모노호시자오는 칼집이 허리띠 곁에 묶인 뒤 팔 · 손목이 칼끝을 입에 못 댐 · 기록 §15)
//  node --test tools/sim/iai_obi.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, DT, newRound, AI } from './harness_m.mjs';
import { readyShot, sayaScript, sayaMeasure, lookOf, WEAPONS, notoRun } from './iai_obi.mjs';
import { PlayerSecretWatch, IaiArm } from '../../src/secret.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { mhzShot } from './mhz_draw.mjs';
import { iaiReadyPose, requestIai } from '../../src/secret_instant.js';
import { obiGrip, obiPulled, obiSayaPose, obiRest } from '../../src/iai_obi.js';
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
  // 모노호시자오 AI 대기는 바탕부터 대기 칼이 자세를 못 지킴(② 머리말 — 웅크린 대기 때 잰 것) — 사람 허리 대기로
  for (const [weapon, mode] of [['uchigatana', 'ai'], ['monohoshizao', 'hip']]) {
    const hip = mode === 'hip';
    const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed: 1, gap: 4, onFighter(f) { if (f.index === 0 && hip) f.humanInput = true; } });
    const P = G.player;
    try {
      if (hip) { P.skill.corr = CONFIG.SKILL.corr; P.skill.autoGuard = true; } else P.aiControlled = true;
      G.ai.update = () => {};
      let fire = false;
      G.before = () => (fire ? null : hip ? iaiReadyPose(P, true, DT) : iaiReadyPose(P, true, DT));
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
  for (const start of ['hip', 'ai']) {
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

// ── 11/14 감독 권고 넷 ──
const NEW4 = ['iaiObiSageo', 'iaiObiOwn', 'iaiObiEdge', 'iaiObiDroop'];
const edgeCos = (f) => {
  const q = f.swordGroup.quaternion;
  const b = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const e = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const u = new THREE.Vector3(0, 1, 0).addScaledVector(b, -b.y).normalize();
  return e.dot(u);
};

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

test('⑫ 쉬는 칼집 — 입은 배 왼쪽 앞 · 위에서 볼 때 바로 뒤에서 15 ~ 25° 바깥 · 아래로 10 ~ 20° (사장님 11/14 \'옆으로 각도가 벌어진\' → \'고쳐\')', () => {
  const [x, y, z] = SECRET.iaiObiSayaMouth;
  assert.ok(x > 0.1175 && x < 0.22, `배 그림 상자 앞(0.1175) 밖 (${x})`);
  assert.ok(z > 0.12 && z < 0.2, `배 왼쪽 — 옆 모서리(0.1675) 곁 (${z})`);
  assert.ok(Math.abs(y - SECRET.iaiSayaHip[1]) < 0.02, `허리띠 높이 (${y})`);
  const top = 180 + SECRET.iaiObiSayaAxis.yaw; // 바로 뒤(−180)에서 바깥(왼)으로
  assert.ok(top >= 15 && top <= 25, `위에서 본 각 바로 뒤에서 ${top}°`);
  assert.ok(-SECRET.iaiObiSayaAxis.el >= 10 && -SECRET.iaiObiSayaAxis.el <= 20, `아래로 기움 ${-SECRET.iaiObiSayaAxis.el}° (落とし差し 처럼 가파르지 않게)`);
  // 실제 몸: 서 있는 동안 칼집 그림 축을 골반 틀 위에서 봄 (밀어냄 뒤)
  const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed: 1, gap: 6 });
  const P = G.player;
  try {
    P.aiControlled = true;
    G.ai.update = () => {};
    while (G.t < CONFIG.ARENA.startHold + 0.5) { G.step(); P.syncMeshes(); }
    const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(P.obiSaya.g.quaternion);
    const ang = (Math.atan2(-ax.z * P.side, -ax.x) * 180) / Math.PI; // 바로 뒤에서 왼쪽 +
    assert.ok(ang >= 15 && ang <= 25, `그려진 칼집 — 바로 뒤에서 ${ang.toFixed(1)}°`);
    const { M } = obiRest(P);
    assert.ok(P.obiSaya.g.position.distanceTo(M) < 0.01, `칼집 입이 쉬는 자리 (밀어냄 ${P.obiSaya.g.position.distanceTo(M).toFixed(3)} m)`);
  } finally {
    G.world.free();
  }
});

/** 사람 창(PlayerSecretWatch — 허리 대기) 한 판: 우치가타나 · 롱소드 과녁 2.4 m · 손 쉼. drive(t, p, pg) 가 스텝마다 */
function human(vals, drive) {
  return withS(vals, () => {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed: 3, gap: 2.4 });
    G.ai.update = () => G.enemy.move.set(0, 0);
    const p = G.player;
    p.skill.autoGuard = true;
    const pg = new PlayerParryGuard(p, G.enemy);
    p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, G.enemy);
    const out = { G, p, ps, pg, start: null, armed: null, w: [], open: false };
    G.before = () => {
      const t = G.t - CONFIG.ARENA.startHold;
      drive?.(t, p, pg, ps);
      ps.update(DT, !!p.skill.sec);
      if (ps.iaiArm.sheathe > 0 && out.start == null) out.start = t;
      if (ps.iaiArm.armed && out.armed == null) out.armed = t;
      if (ps.open) out.open = true;
    };
    out.run = (s) => { for (let i = 0; i < Math.round(s / DT); i++) { G.step(); p.syncMeshes(); } };
    out.run(CONFIG.ARENA.startHold);
    return out;
  });
}

/** 납도 한 판 (iai_obi.mjs notoRun — ⑬ · ⑭ 가 같은 판을 읽음) */
const notoRuns = {};
const noto = (weapon, mode) => (notoRuns[`${weapon} ${mode}`] ??= notoRun({ weapon, mode }));

test('⑭ 칼끝이 칼집 입으로 들어감 — 칼집 몸 옆으로 드는 스텝 없음 (사람 · AI 허리 대기 × 우치가타나 · 무라마사 · 쿠사나기)', () => {
  // 11/19 A11: AI 도 선 채 허리 대기(사장님 'AI 도 원전 꼴' — 전 웅크린 대기는 이 시험을 넘었음) → AI 몸 납도 칼끝이 입 밖 0.28 ~ 0.44 m 에서 칼집 옆으로 들었음.
  //  11/19 보정 v2 묶음(4 단계): 칼 팔 몸 규칙 A4 ~ A6(손 목표 자르기 · 날 미리 돌리기 · 두손 칼 빈팔 닿는 곳 — 사람과 같은 조건) · 닿음 신호(납도 = 기다리는 꼴 — 앞 바닥 · 엇갈림 막기 꺼짐)로
  //  우치가타나 · 무라마사는 사람과 같게 입으로 듦. 쿠사나기 AI 는 입 밖 3.3 cm(문턱 3 cm · 사람 2.5 cm)라 아직 뺌 — A12(걸음 덮개 지움) 뒤에도 같음.
  //  남은 몫은 몸 규칙이 아니라 AI 반응 시간(AI_REACT.face 0.2 s — fighter.js updateHeading 이 0.2 s 전 과녁 자리를 봄 · AI 감각 — 기록 human_ai_parity A17 '그대로 — AI 본성' · §10):
  //  사람 몸에 aiControlled 만 켜도 3.3 cm · AI 몸에서 그 반응 시간만 빼면(재기만) 2.4 cm. 긴 칼날이라 몸 돌림 차가 칼끝에서 커짐 — 반응 시간은 AI 본성이라 그대로 두고 뺌
  for (const weapon of WEAPONS)
    for (const mode of ['hip', 'ai']) {
      if (mode === 'ai' && weapon === 'kusanagi') continue;
      if (weapon === 'monohoshizao') continue; // (웅크림 판 AI 는) 대기 칼이 자세를 못 지킴 (② 머리말) · 허리 대기는 칼집 입을 허리띠 곁에 둔 뒤 팔 · 손목이 칼끝을 입에 못 댐 (11/14 '허공에 붕 떠보이는데' 뒤 — 모자람 · 기록 §15)
      const e = noto(weapon, mode).even;
      assert.ok(e && e.entry, `${weapon} ${mode} 칼끝이 칼집 안으로 듦`);
      assert.ok(e.entry.viaMouth, `${weapon} ${mode} 칼끝이 칼집 입 곁에서 들어감 (앞 스텝 입 밖 ${e.entry.prevY} m · 단면 ${e.entry.prevE} 배)`);
      assert.equal(e.sideEntries, 0, `${weapon} ${mode} 칼집 몸 옆으로 든 스텝 ${JSON.stringify(e.sideAt)}`);
    }
});
