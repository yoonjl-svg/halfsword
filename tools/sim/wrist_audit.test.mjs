// 손목 검사 시험 (10/24 15:5x 사장님 '주먹 아래쪽으로 칼날이 향하도록 거꾸로 쥐고 있는 거 같은데?' · '손목 고침에 새 작업자 붙이고 다른 동작에서도 저런지 검사해' —
//  docs/strike/wrist_audit_2026-10-24.md · tools/sim/wrist_audit.mjs):
//   안다레 리솔루토 런지 · 격살 허파 찌르기(운동학 겨눈 찌름 — SECRET.thrustArm): 맞힌 자세 아래팔-칼 ≤ 135° · 손이 어깨 앞 팔 길이 0.8 이상 · 칼이 새끼 쪽으로 꺾이지 않음(손 면 dev ≥ −30 — AAOS 척측 30) ·
//   굳음 동안도 뻗은 채 · `?thrustArm=0` 은 옛 꼴(손이 어깨 가까이 · 칼이 새끼 쪽으로 75° 넘게 — 거꾸로 쥔 꼴) 그대로 ·
//   JOINTS.elbowSwivel(10/24 17:2x 기본 켬): 끄면 레이피어 1번 자세(프리마)가 새끼 쪽 · 켜면 척측 한도 안.
//   10/24 17:2x 비정상 손목 교정 (JOINTS.wristGuard 기본 켬 — 기록 §9): 겨눔 교정 wristClamp 기하 · 끄면(전 판) 범위 밖 몫이 크고 켜면 상한 아래 ·
//   옛 굽은 팔 길(`?thrustArm=0`)도 교정이 손목을 범위 안으로 · 시험 손목 치우침 밧줄 둘(gripDev · `?wristRope=1`)은 켜면 범위 밖 0 · 칼날을 거꾸로 쥔 동안 뗐다가 돌아오면 다시.
//   10/24 17:2x 뒤 고침 (기록 §9-9): 탭 찌르기 황소 → 칼 내린 상대 찌름 판정이 전 판만큼은 남(JOINTS.swivelThrust — 0 = 17:2x 판은 찌름 0) ·
//   격살 허파 찌르기 맞닿기 언저리 첫 맞음이 베기로 셈되지 않음(SECRET.thrustSweep — 겨눔 토막 옆 움직임이 찌름 방향에 섞이지 않게).
//  node --test tools/sim/wrist_audit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, THREE } from './harness_m.mjs';
import { lungeRun, gyeoksalRun, guardsRun, aiRun, tapRun, wristSample, outOfRange, WristTally, ARM_LEN, REV, ULNAR, OOR_X } from './wrist_audit.mjs';
import { HUMAN, wristClamp } from '../../src/fighter.js';
import { mordGripOf } from '../../src/mordschlag.js';
import { standTrial } from './tap_thrust.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { ITALIAN_ZORNHAU } from '../../src/weapon_measured.js';

const { SECRET, JOINTS } = CONFIG;
/** 여러 값을 잠깐 바꿔 fn — [[객체, 열쇠, 값], …] */
const withSets = (L, fn) => {
  const old = L.map(([o, k]) => o[k]);
  L.forEach(([o, k, v]) => (o[k] = v));
  try {
    return fn();
  } finally {
    L.forEach(([o, k], i) => (o[k] = old[i]));
  }
};
const OLD = [[JOINTS, 'elbowSwivel', 0], [JOINTS, 'wristGuard', 0]]; // 10/24 17:2x 전 판
const ph = (T, k) => T.k.get(k);

test('값: 운동학 겨눈 찌름 팔 뻗음 SECRET.thrustArm 1 · 팔꿈치 돌림 JOINTS.elbowSwivel 1 (사장님 10/24 17:2x) · 따라감 0.2 s · 손목 교정 wristGuard 1 · 손 면 범위 [−30, 135] · 팔 길이 0.57 m · 찌르는 돌림 swivelThrust 1 · 찌름 쓸린 자리 thrustSweep 1', () => {
  assert.equal(SECRET.thrustArm, 1);
  assert.equal(JOINTS.elbowSwivel, 1);
  assert.equal(JOINTS.swivelThrust, 1);
  assert.equal(SECRET.thrustSweep, 1);
  assert.equal(JOINTS.swivelTau, 0.2);
  assert.equal(JOINTS.wristGuard, 1);
  assert.equal(JOINTS.wristRope, 0); // 시험 밧줄 기본 끔 (켜면 AI 베기가 크게 약해짐 — 기록 §9)
  assert.equal(JOINTS.wristSwing, 0); // 시험 베는 동안 손목 교정 기본 0 = 지금대로 (10/25 셸하우 — 기록 §11)
  assert.equal(HUMAN.ulnarDev, 30);
  assert.equal(HUMAN.wristThumb, 135);
  assert.ok(Math.abs(ARM_LEN - 0.57) < 1e-9);
  assert.equal(REV, -45);
  assert.equal(ULNAR, -30);
});

test('10/24 런지 손목: 맞힌 자세 아래팔-칼 ≤ 135° · 손이 어깨 앞 팔 길이 0.8 이상 · 새끼 쪽 아님 · 굳음 동안 뻗은 채 (레이피어 · 달타냥 · 2.2 m)', () => {
  for (const w of ['rapier', 'dartagnan']) {
    const r = lungeRun(w, { gap: 2.2 });
    assert.ok(r.fired && r.res?.ok, `${w} 런지`);
    assert.ok(r.res.hit, `${w} 맞힘`);
    const h = r.hit;
    assert.ok(h.wrist <= 135, `${w} 맞힌 자세 아래팔-칼 ${h.wrist.toFixed(0)}°`);
    assert.ok(h.along >= 0.8, `${w} 맞힌 자세 손 앞 ${h.along.toFixed(2)} 팔 길이`);
    assert.ok(h.dev >= ULNAR, `${w} 맞힌 자세 손 면 dev ${h.dev.toFixed(0)}°`);
    const S = ph(r.T, 'stiff');
    assert.ok(S.n > 60, `${w} 굳음 스텝 ${S.n}`);
    assert.ok(S.aSum / S.n >= 0.85, `${w} 굳음 손 앞 평균 ${(S.aSum / S.n).toFixed(2)}`);
    assert.ok(S.wSum / S.n <= 30, `${w} 굳음 아래팔-칼 평균 ${(S.wSum / S.n).toFixed(0)}°`);
    assert.ok(S.revUp / S.n < 0.1, `${w} 굳음 거꾸로 · 아래팔 섬 몫 ${((100 * S.revUp) / S.n).toFixed(0)} %`);
    // 칼끝 빠르기 = 고노센 × risolutoShare 그대로 (italian_risoluto.test.mjs 와 같은 기준)
    assert.ok(r.res.tipVmax >= 0.9 * r.res.v && r.res.tipV >= 0.8 * r.res.v, `${w} 칼끝 ${r.res.tipV.toFixed(1)} · 최고 ${r.res.tipVmax.toFixed(1)} / 길 ${r.res.v.toFixed(1)}`);
  }
});

test('10/24 런지 `?thrustArm=0&elbowSwivel=0&wristGuard=0` = 옛 꼴 그대로: 굳음 동안 손이 어깨 앞 팔 길이 0.5 아래 · 칼이 새끼 쪽으로 75° 안팎 (거꾸로 쥔 꼴) — 손목 교정만 켜면 같은 굽은 팔에서 범위 안', () => {
  // 옛 판 재현 = 그때 간격 줄로 (10/25 이탈리아 간격 줄 다시 잼 — 런지 몸 미끄러짐은 맞닿기 거리에서 멈춰 새 줄에선 끝 자리가 0.18 ~ 0.25 m 멀어 옛 꼴이 안 남 · docs/strike/italian_measure_2026-10-25.md §6-3)
  const old = (w) => { const m = ITALIAN_ZORNHAU.MEASURED[w]; return { contact: m[0], reach: m[1], clinch: m[2], cutTime: ITALIAN_ZORNHAU.CUT_TIME_30[w] }; };
  withSets([[SECRET, 'thrustArm', 0], ...OLD], () => {
    for (const w of ['rapier', 'dartagnan']) {
      const r = lungeRun(w, { gap: 2.2, measure: old(w) });
      assert.ok(r.fired && r.res?.ok && r.res.hit, `${w} 런지 · 맞힘`);
      const S = ph(r.T, 'stiff');
      assert.ok(S.aSum / S.n < 0.5, `${w} 옛 굳음 손 앞 평균 ${(S.aSum / S.n).toFixed(2)}`);
      assert.ok(S.devSum / S.n < -60, `${w} 옛 굳음 손 면 dev 평균 ${(S.devSum / S.n).toFixed(0)}°`);
      assert.ok(S.rev / S.n > 0.5, `${w} 옛 굳음 거꾸로 몫 ${((100 * S.rev) / S.n).toFixed(0)} %`);
    }
  });
  withSets([[SECRET, 'thrustArm', 0]], () => {
    const r = lungeRun('rapier', { gap: 2.2, measure: old('rapier') });
    assert.ok(r.fired && r.res?.ok && r.res.hit, '교정 켬 · 옛 팔 길 런지 맞힘');
    const S = ph(r.T, 'stiff');
    assert.ok(S.aSum / S.n < 0.5, `팔은 그대로 굽음 (팔을 펴게 하지 않음) ${(S.aSum / S.n).toFixed(2)}`);
    assert.ok(S.devSum / S.n >= ULNAR - 5 && S.rev / S.n < 0.1, `손목은 범위 안 dev ${(S.devSum / S.n).toFixed(0)}° · 거꾸로 ${S.rev} / ${S.n}`); // 옛 꼴 거꾸로 > 50 %
  });
});

test('격살 허파 찌르기(봉두세)도 같은 길: 굳음 동안 뻗은 채 · 새끼 쪽 아님 — `?thrustArm=0` 은 옛 꼴(새끼 쪽)', () => {
  const now = gyeoksalRun('qinggang', 'bongdu');
  assert.ok(now.fired && now.res?.ok, '격살 허파 찌르기');
  const S = ph(now.T, 'stiff');
  assert.ok(S.aSum / S.n >= 0.85 && S.devSum / S.n >= ULNAR, `굳음 손 앞 ${(S.aSum / S.n).toFixed(2)} · dev ${(S.devSum / S.n).toFixed(0)}`);
  withSets([[SECRET, 'thrustArm', 0], ...OLD], () => {
    const old = gyeoksalRun('qinggang', 'bongdu');
    const O = ph(old.T, 'stiff');
    assert.ok(O.aSum / O.n < 0.5 && O.devSum / O.n < -60, `옛 굳음 손 앞 ${(O.aSum / O.n).toFixed(2)} · dev ${(O.devSum / O.n).toFixed(0)}`);
  });
});

test('10/24 17:2x 뒤 탭 찌르기 (롱소드 황소 → 칼 내린 상대 · 1.5 ~ 2.3 m): 기본 찌름 판정 수 ≥ 전 판(돌림 · 교정 끔) · 머묾 손목 범위 안 — JOINTS.swivelThrust 0(17:2x 판)은 찌름 0', () => {
  const run = () => {
    let stab = 0, dev = 0, n = 0;
    for (const gap of [1.5, 1.7, 1.9, 2.1, 2.3]) {
      let hold = null;
      const r = standTrial({
        gap,
        pad: [0.22, 0.26],
        foePad: [0.0, -0.5],
        seed: 311 + Math.round(gap * 10),
        before: (G) => {
          const st = G.step.bind(G);
          G.step = () => {
            st();
            const tp = G.player.skill.tap;
            if (tp && !hold && tp.t >= tp.K.aim + tp.K.extend) hold = wristSample(G.player);
          };
        },
      });
      if (r.stab) stab++;
      if (hold) (dev += hold.dev), n++;
    }
    return { stab, dev: n ? dev / n : NaN };
  };
  const old = withSets(OLD, run);
  const now = run();
  const v17 = withSets([[JOINTS, 'swivelThrust', 0]], run);
  assert.ok(old.stab >= 1, `전 판 찌름 ${old.stab} / 5`);
  assert.ok(now.stab >= old.stab, `기본 찌름 ${now.stab} ≥ 전 판 ${old.stab}`);
  assert.ok(now.dev >= ULNAR - 5, `기본 머묾 손 면 dev 평균 ${now.dev.toFixed(0)}° (전 판 ${old.dev.toFixed(0)}°)`);
  assert.equal(v17.stab, 0, `17:2x 판 찌름 ${v17.stab}`);
});

test('격살 허파 찌르기 맞닿기 언저리 (맞닿기 −0.1 ~ +0.1 m · 상대 롱소드 · 우치가타나 · 청강검 · 사브르): 첫 맞음이 베기 아님 — SECRET.thrustSweep 0 이면 겨눔 토막 옆 움직임이 섞여 베기', () => {
  const run = () => {
    const T = { stab: 0, cut: 0, n: 0 };
    const g0 = newRound({ weapon: 'qinggang', weapon2: 'longsword', seed: 1 });
    const contact = g0.player.swordArt.measure.contact;
    g0.world.free();
    for (const gp of [-0.1, 0, 0.1]) for (const fw of ['longsword', 'uchigatana', 'qinggang', 'sabre']) {
      const g = newRound({ weapon: 'qinggang', weapon2: fw, seed: 1, gap: contact + gp });
      try {
        g.ai.update = () => {};
        const p = g.player;
        p.foe = g.enemy;
        g.enemy.foe = p;
        p.skill.autoGuard = true;
        while (g.t < 1.0) g.step();
        let first = null;
        const pw = g.combat.hooks.onWound;
        g.combat.hooks.onWound = (att, vic, r, ...rest) => {
          pw?.(att, vic, r, ...rest);
          if (att === p && !first) first = r.type;
        };
        p.skill.secret({ S: TRADITIONS.chinese.playerSecret, ctx: { slot: 'bongdu', stance: 'bongdu' } });
        for (let i = 0; i < 150 && (p.skill.sec || p.iai); i++) g.step();
        T.n++;
        if (first === 'stab') T.stab++;
        if (first === 'cut') T.cut++;
      } finally {
        g.world.free();
      }
    }
    return T;
  };
  const now = run();
  assert.equal(now.cut, 0, `기본 첫 맞음 베기 ${now.cut} / ${now.n}`);
  assert.ok(now.stab >= 10, `기본 첫 맞음 찌름 ${now.stab} / ${now.n}`);
  const off = withSets([[SECRET, 'thrustSweep', 0]], run);
  assert.ok(off.cut >= 3, `thrustSweep 0: 첫 맞음 베기 ${off.cut} / ${off.n}`);
});

// 손 자리는 10/25 손을 뻗기 전 1번 자세 [0.5, 0.28, 0.12] (지금 표는 [0.62, 0.26, 0.12] — school_kit_map 10/25 · 기록 §12): 이 시험은 그 자리에서 돌림이 한 일을 본다
const PRIMA_OLD = [[TRADITIONS.italian.guardTable['지붕 (폼 타크)'], 'hand', [0.5, 0.28, 0.12]]];
test('JOINTS.elbowSwivel: 끄면(전 판) 레이피어 1번 자세(프리마 — 전 손 자리)는 칼이 새끼 쪽 · 켜면(손목 교정 없이도 · 사람 팔 범위 안 보는 10/24 판 swivelHuman 0) 같은 손 자리에서 척측 한도 안 — 그 값은 팔꿈치를 줄 가까이 들어 얻은 것(10/25 사장님 \'팔 관절이 비틀린 게 많아\' — 기본은 사람 팔 범위 안 돌림만 · onehand_arm.test.mjs)', () => {
  const prima = (T) => [...T.k.entries()].find(([k]) => k.includes('프리마'))?.[1];
  const off = withSets([...PRIMA_OLD, ...OLD], () => prima(guardsRun('rapier').T));
  assert.ok(off && off.devSum / off.n < REV, `끔: 프리마 dev ${(off.devSum / off.n).toFixed(0)}°`);
  const on = withSets([...PRIMA_OLD, [JOINTS, 'wristGuard', 0], [JOINTS, 'swivelHuman', 0]], () => prima(guardsRun('rapier').T));
  assert.ok(on && on.devSum / on.n >= ULNAR, `켬: 프리마 dev ${(on.devSum / on.n).toFixed(0)}°`);
  assert.ok(Math.abs(on.aSum / on.n - off.aSum / off.n) < 0.1, `손 자리 그대로 ${(off.aSum / off.n).toFixed(2)} → ${(on.aSum / on.n).toFixed(2)}`);
});

test('wristClamp 기하: 손 면 안 각을 가까운 범위 끝으로 (−60 → −30 · 150 → 135) · 범위 안 · 아래팔이 칼 면 밖 70° 넘으면 그대로 · 칼 면 축 그대로', () => {
  const HD = Math.PI / 180;
  const devOf = (fx, aim, z) => 90 - Math.atan2(fx.dot(aim), fx.dot(new THREE.Vector3().crossVectors(aim, z))) / HD;
  const fAt = (dev, fe = 0) => new THREE.Vector3(Math.cos((90 - dev) * HD) * Math.cos(fe * HD), Math.sin((90 - dev) * HD) * Math.cos(fe * HD), Math.sin(fe * HD)); // 칼 틀 x = 날 · y = 칼 축 · z = 칼 면
  for (const [d0, d1] of [[-60, -30], [-100, -30], [150, 135], [170, 135], [50, 50], [-30, -30], [0, 0], [120, 120]]) {
    const aim = new THREE.Vector3(0, 1, 0);
    const z = new THREE.Vector3(0, 0, 1);
    const fx = fAt(d0);
    const r = wristClamp(fx, aim, z);
    assert.ok(Math.abs(r - (d1 - d0)) < 1e-6, `${d0} → 돌림 ${r}`);
    assert.ok(Math.abs(devOf(fx, aim, z) - d1) < 1e-6, `${d0} → ${devOf(fx, aim, z)}`);
    assert.ok(Math.abs(aim.length() - 1) < 1e-9 && Math.abs(aim.z) < 1e-9, '칼 면 안에서만');
  }
  const aim = new THREE.Vector3(0, 1, 0);
  assert.equal(wristClamp(fAt(-80, 75), aim, new THREE.Vector3(0, 0, 1)), 0, '굽힘 · 폄 75° — 면 안 각이 뜻이 없음');
  assert.equal(aim.y, 1);
  // outOfRange (wrist_audit) 는 같은 범위
  assert.equal(outOfRange({ dev: -40, fe: 0 }), 10);
  assert.equal(outOfRange({ dev: 140, fe: 0 }), 5);
  assert.equal(outOfRange({ dev: -170, fe: 0 }), 55); // 엄지 쪽 끝으로 넘어가는 쪽이 가까움
  assert.equal(outOfRange({ dev: -90, fe: 80 }), 0);
});

/** 묶음 합 → 범위 밖 몫 · > 10° 몫 · 거꾸로 몫 · 거꾸로 · 아래팔 섬 몫 */
function shares(T) {
  let n = 0, oor = 0, oorX = 0, rev = 0, revUp = 0;
  for (const P of T.k.values()) {
    n += P.n;
    oor += P.oor;
    oorX += P.oorX;
    rev += P.rev;
    revUp += P.revUp;
  }
  return { n, oor: oor / n, oorX: oorX / n, rev: rev / n, revUp: revUp / n };
}
const pc = (x) => (100 * x).toFixed(1);
const ROPE = [[JOINTS, 'wristRope', 1]]; // 시험 손목 치우침 밧줄 켬

test('손목 교정 끔 · 켬 · 밧줄 — 자세표(롱소드 · 레이피어 · 사브르) · 탭 찌르기(황소 · 긴 자세): 전 판 > 10° 넘침 35 % 안팎 · 기본(돌림 + 겨눔 교정) ≤ 10 % · 거꾸로 · 아래팔 섬 ≤ 8 % · 시험 밧줄 켜면 ≤ 1 %', () => {
  const run = () => {
    const T = new WristTally();
    for (const w of ['longsword', 'rapier', 'sabre']) T.merge(guardsRun(w).T, `${w}:`);
    for (const w of ['rapier', 'sabre']) for (const gd of ['ochs', 'langort']) T.merge(tapRun(w, gd).T, `${w}:${gd}:`);
    return shares(T);
  };
  const off = withSets(OLD, run);
  const on = run();
  const rope = withSets(ROPE, run);
  assert.ok(off.oorX > 0.25 && off.rev > 0.15, `전 판: > ${OOR_X}° ${pc(off.oorX)} % · 거꾸로 ${pc(off.rev)} %`);
  assert.ok(on.oorX <= 0.1 && on.revUp <= 0.08 && on.oorX < off.oorX / 3, `기본: > ${OOR_X}° ${pc(on.oorX)} % · 거꾸로 · 아래팔 섬 ${pc(on.revUp)} %`);
  assert.ok(rope.oorX <= 0.01 && rope.rev <= 0.01, `밧줄: > ${OOR_X}° ${pc(rope.oorX)} % · 거꾸로 ${pc(rope.rev)} %`);
});

// 기본 판은 씨앗 셋(11 · 12 · 13) 합: 15 s 한 판은 누가 언제 쓰러지느냐로 자세 몫이 크게 바뀐다 (10/25 엎친 손 뒤 사브르 > 10° 씨앗 11 · 12 · 13 = 11.4 · 6.1 · 10.6 % — 엎친 손 전 7.3 · 4.2 · 11.6 % · 기록 §12)
test('AI 끼리 15 s (롱소드 · 사브르 — 씨앗 셋 합): 기본 범위 밖 > 10° ≤ 10 % · 거꾸로 · 아래팔 섬 ≤ 6 % (10/25 한손 사람 팔 범위 뒤 사브르 3.4 → 5.1 % — 팔 비틀어 맞추던 몫이 손목으로 · 기록 §10-5) · 시험 밧줄 켜면(씨앗 11) > 10° ≤ 1 % · 거꾸로 ≤ 1 %', () => {
  for (const w of ['longsword', 'sabre']) {
    const T = new WristTally();
    for (const seed of [11, 12, 13]) T.merge(aiRun(w, { seed }).T, `${seed}:`);
    const s = shares(T);
    assert.ok(s.n > 1000, `${w} 스텝 ${s.n}`);
    assert.ok(s.oorX <= 0.1 && s.revUp <= 0.06, `${w} 기본: > ${OOR_X}° ${pc(s.oorX)} % · 거꾸로 · 아래팔 섬 ${pc(s.revUp)} %`);
    const r = withSets(ROPE, () => shares(aiRun(w, { seed: 11 }).T));
    assert.ok(r.oorX <= 0.01 && r.rev <= 0.01, `${w} 밧줄: > ${OOR_X}° ${pc(r.oorX)} % · 거꾸로 ${pc(r.rev)} %`);
  }
});

test('시험 손목 치우침 밧줄: 켜면(`?wristRope=1`) 손목 원뿔에 둘 더 (gripDev — 척측 · 엄지 쪽) · 기본 · 전 판은 없음 · 칼날을 거꾸로 쥔 동안 떼고 돌아오면 다시', () => {
  const mk = () => newRound({ weapon: 'longsword', weapon2: 'longsword', gap: 2.6, seed: 3 });
  const keepRope = JOINTS.wristRope;
  JOINTS.wristRope = 1; // 밧줄은 몸이 만들어질 때 · 원래 쥠으로 돌아올 때 건다 — 이 판 내내 켬
  const g = mk();
  try {
    const P = g.player;
    for (let i = 0; i < 30; i++) g.step();
    assert.ok(P.gripDev?.length === 2 && P.gripDev.every((j) => P.gripCone.includes(j)), '켬: 밧줄 둘 (척측 · 엄지 쪽)');
    const G = mordGripOf(P);
    assert.equal(P.reverseGrip(G, { x: 0, y: -1, z: 0 }), true);
    assert.equal(P.gripDev, null, '거꾸로 쥔 동안 뗌');
    for (let i = 0; i < 30; i++) g.step();
    assert.equal(P.reverseGrip(null), true);
    assert.ok(P.gripDev?.length === 2 && P.gripDev.every((j) => P.gripCone.includes(j)), '돌아오면 다시');
    for (let i = 0; i < 30; i++) g.step();
    const t = P.sword.translation();
    assert.ok(Number.isFinite(t.x + t.y + t.z), 'NaN 없음');
  } finally {
    g.world.free();
    JOINTS.wristRope = keepRope;
  }
  for (const L of [OLD, [[JOINTS, 'wristRope', 0]], [[JOINTS, 'wristRope', 1], [JOINTS, 'wristGuard', 0]]]) {
    withSets(L, () => {
      const g0 = mk();
      try {
        assert.equal(g0.player.gripDev, null, `끔(${L.map(([, k, v]) => `${k}=${v}`).join(' ')}): 밧줄 없음`);
      } finally {
        g0.world.free();
      }
    });
  }
});

test('wristSample: 칼이 없으면 null', () => {
  assert.equal(wristSample({ bodies: {}, sword: null }), null);
});
