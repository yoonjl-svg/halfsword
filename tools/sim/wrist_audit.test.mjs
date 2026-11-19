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
import { standTrial } from './tap_thrust.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { ITALIAN_NOW } from '../../src/weapon_measured.js'; // 10/25 이탈리아 간격 판 'full' 이면 옛 판 재현을 그때 간격 줄로

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
  assert.equal(JOINTS.elbowSwivel, 1);
  assert.equal(JOINTS.swivelThrust, 1);
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

// 10/24 런지 굳음 길이(게임 0.6 s — 표준 시간 전 판)로 본다: 뻗은 팔은 굳음이 시작되고 게임 약 0.45 s(54 스텝) 뒤부터 돌아오기 시작한다 — 옛 판 · 표준 시간 판 같은 스텝(굳음 · 붙잡기 길이와
//  상관없는 몫 — 까닭은 따로 볼 일). 굳음이 실제 0.6 s(게임 0.66 — 80 스텝)가 되면 돌아오는 몫이 평균에 더 들어가 달타냥 '굳음 손 앞 평균' 0.90 → 0.845
//  (docs/strike/time_standard_2026-10-25.md §4 — 사장님 · 감독께 여쭘). 팔 · 손목 규칙 시험이라 10/24 굳음 길이로 본다
//  10/30 20:0x 사장님 '팔 느려짐 없애고 속도는 90%'(risolutoArmSlow 0 · risolutoShare 0.9) 뒤에도 이 팔 · 손목 시험은 10/24 런지 값(빠르기 1 · 팔 늦춤 0.6)으로 본다 — 손목 규칙이 그대로인지 보는 자리
//  11/11 사장님 '리솔루토를 70%로 상향하고 파괴력을 0.5로 해.'(risolutoHitMul 0.5) 뒤에도 10/24 런지 값 판정 배율 1.3(그때 SECRET.hitMul) 으로 본다 — 옛 장면 재현 (배율 0.5 면 달타냥 옛 꼴 거꾸로 몫이 50 % 로 문턱에 걸림)
//  11/11 사장님 "런지 거리는 0.45로 해, 다른 거리 잴 필요 없어."(risolutoSlide 0.45) 뒤에도 10/24 런지 값 몸 미끄러짐 0.6(그때 고노센 iaiStep 과 같은 수) 으로 본다 — 옛 장면 재현 (0.45 면 달타냥 2.2 m 런지가 닿는 끝 밖)
const LUNGE1024 = [[SECRET, 'risolutoStiff', 0.6], [SECRET, 'risolutoArmSlow', 0.6], [SECRET, 'risolutoShare', 1], [SECRET, 'risolutoHitMul', 1.3], [SECRET, 'risolutoSlide', 0.6]];
const withLunge1024 = (fn) => withSets(LUNGE1024, fn);



test('10/24 17:2x 뒤 탭 찌르기 (롱소드 황소 → 칼 내린 상대 · 1.5 ~ 2.3 m): 기본 찌름 판정 수 ≥ 전 판(돌림 · 교정 끔) · 머묾 손목 범위 안 — JOINTS.swivelThrust 0(17:2x 판)은 찌름 0', () => {
  // 11/16 묶음 P(사람 탭 찌르기 몸 싣기 THRUST.drive 3) 그대로 — 높은 자세(황소)에선 몸 싣기 당김을 안 해(skill.js thrust · 기록 docs/strike/thrust_stuck_2026-11-15.md §8) 기준 안 (전 묶음 풀음)
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
  // 17:2x 판(옛 결함) 재현은 그때 걷기 빠르기(게임 1.8 m/s)로 — 표준 시간 걷기 실제 2.0(게임 1.818)이면 탭 찌르기 디딤이 1 % 더 나가 1.5 m 판 하나가 찌름 1 (docs/strike/time_standard_2026-10-25.md §4)
  const v17 = withSets([[JOINTS, 'swivelThrust', 0], [CONFIG.GAIT, 'moveSpeed', 1.8]], run);
  // 11/19 보정 v2 묶음 (기록 docs/strike/human_ai_parity_2026-11-19.md §10): 서 있는 과녁(AI 롱소드 몸)이 사람과 같은 칼 팔 몸 규칙(A4 ~ A6 — fighter.js bodyArm) · 보정 v2(A1)로 칼을 쥠 →
  //  과녁 칼 · 몸이 1 cm 남짓 옮겨 전 판(돌림 · 교정 끔) 찌름 1 → 0 / 5(1.5 m) · 기본 2 → 1 / 5(1.5 m 는 칼끝이 닿지 않음 · 1.7 m 찌름) · 17:2x 판 0 → 1 / 5
  //  (1.5 m — 첫 닿음은 머리 둔타 · 걸음 1.8 m/s 라 디딤 자리가 다름). 묶음 전(f000cce0)에서 과녁을 사람 손가락 몸(autoGuard · 보정 v2)으로 두면 세 판 모두 똑같이 0 · 1 · 1 —
  //  고장이 아니라 과녁 몸이 사람 몸과 같아진 몫. 그래서 '전 판도 찌른다(≥ 1)' 대신 '기본이 찌른다(≥ 1)' · '17:2x 판 찌름 0' 대신 '17:2x 판이 기본보다 더 찌르지 않음'으로 묶음
  //  (대본 몸 · 보정 old 과녁이면 0 · 2 · 0 — 그 과녁은 지금 어느 몸과도 같지 않아 쓰지 않음)
  assert.ok(now.stab >= 1, `기본 찌름 ${now.stab} / 5 (전 판 ${old.stab})`);
  assert.ok(now.stab >= old.stab, `기본 찌름 ${now.stab} ≥ 전 판 ${old.stab}`);
  assert.ok(now.dev >= ULNAR - 5, `기본 머묾 손 면 dev 평균 ${now.dev.toFixed(0)}° (전 판 ${old.dev.toFixed(0)}°)`);
  assert.ok(v17.stab <= now.stab, `17:2x 판 찌름 ${v17.stab} ≤ 기본 ${now.stab}`);
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


test('시험 손목 치우침 밧줄: 켜면(`?wristRope=1`) 손목 원뿔에 둘 더 (gripDev — 척측 · 엄지 쪽) · 기본 · 전 판은 없음 · 칼날을 거꾸로 쥔 동안 떼고 돌아오면 다시', () => {
  const mk = () => newRound({ weapon: 'longsword', weapon2: 'longsword', gap: 2.6, seed: 3 });
  const keepRope = JOINTS.wristRope;
  JOINTS.wristRope = 1; // 밧줄은 몸이 만들어질 때 · 원래 쥠으로 돌아올 때 건다 — 이 판 내내 켬
  const g = mk();
  try {
    const P = g.player;
    for (let i = 0; i < 30; i++) g.step();
    assert.ok(P.gripDev?.length === 2 && P.gripDev.every((j) => P.gripCone.includes(j)), '켬: 밧줄 둘 (척측 · 엄지 쪽)');
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
