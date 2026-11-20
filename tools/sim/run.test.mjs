// 뛰기 시험 (11/18 사장님 '… 스틱을 가장 극단적인 값으로 밀면 뛰게 해 …' · 같은 날 빠르기 걷기 × 2 · 기력 걷기 × 1.5 · 뛰는 동안 회복 없음 · 50 에서 시작 0 까지 —
//  src/run.js · config RUN · 기록 docs/strike/run_2026-11-18.md): 들어감 · 나감 문턱과 사이 띠 · 기력 50 / 0 · 유파마다 초당 기력 · 공격 · 막기가 끊음 · 다시 걺 ·
//  뛰는 동안 · 뒤의 바라봄 · 걸음 운동량 상한 · 스틱 길 몫을 안 둔 몸(1:1 AI · 대본 몸)은 f.run 이 없음 · PC Shift.  node --test tools/sim/run.test.mjs
//  (AI 뛰기 — 셋 이상 판 · 11/19: tools/sim/ai_run.test.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT, THREE } from './harness_m.mjs';
import { runState, runStep, runCostRate, walkTopOf, runSpend, runFace } from '../../src/run.js';
import { stepMassOf } from '../../src/combat.js';
import { kitFromNodes } from '../../src/skill_tree_data.js';
import { runCase, measureRun } from './run_measure.mjs';

const { RUN, GAIT, STAMINA, STRIKE, TIME } = CONFIG;
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** 판 없이 runStep 만 부르는 몸 (몸 상태 · 입력 칸만) */
function mock(o = {}) {
  const f = {
    alive: true, state: 'stand', feetHeld: false, heading: 0, legHealth: 1, weapon: {}, swordArt: { tradition: 'german' },
    gait: { active: true, P: GAIT }, skill: {}, faceTarget: { x: 10, y: 1, z: 0 },
    stamina: { value: 100, exhausted: false, attacking: false, guarding: false, infinite: false },
    bodies: { pelvis: { translation: () => ({ x: 0, y: 0.9, z: 0 }), linvel: () => ({ x: 0, y: 0, z: 0 }) } },
    move: new THREE.Vector2(), stickX: 0, stickY: 1, runReach: 0,
    wearsPlate: () => false,
    ...o,
  };
  return f;
}
const tick = (f, reach, extra = {}) => {
  f.runReach = reach;
  Object.assign(f, extra);
  f.move.set(f.stickX, f.stickY);
  runStep(f, DT);
  return f.run.on;
};
/** 끝까지 민 채 RUN.hold(11/21 — 실제 2 s) 동안 tick — 뛰기 시작했나 (그 전 스텝에는 늘 걷기여야 함) */
const H = RUN.hold;
const hold = (f, reach, extra = {}) => {
  const n = Math.ceil(H / DT - 1e-9);
  for (let i = 1; i < n; i++) assert.equal(tick(f, reach, extra), false, `버티는 동안 (${(i * DT).toFixed(3)} / ${H.toFixed(3)} s) 은 걷기`);
  return tick(f, reach, extra);
};

test('들어감 · 나감 문턱과 사이 띠: 길의 0.95 넘게 밀면 뛰고 · 0.85 안으로 돌아오면 걷기 (0.85 ~ 0.95 는 하던 대로)', () => {
  assert.equal(RUN.stickIn, 0.95);
  assert.equal(RUN.stickOut, 0.85);
  const f = mock();
  assert.equal(tick(f, 0.94), false, '0.94 — 걷기');
  assert.equal(hold(f, RUN.stickIn), true, '0.95 — 버티면 뜀');
  assert.equal(tick(f, 0.9), true, '0.9 — 사이 띠: 하던 대로 뜀');
  assert.equal(tick(f, 0.86), true);
  assert.equal(tick(f, 0.84), false, '0.84 — 걷기');
  assert.equal(f.run.end, 'stick');
  assert.equal(tick(f, 0.9), false, '0.9 — 사이 띠: 하던 대로 걷기');
  assert.equal(hold(f, 1), true, '다시 끝까지 — 버티면 뜀');
  assert.equal(tick(f, 1, { stickX: 0, stickY: 0 }), false, '방향이 없으면 걷기');
});

test('기력: 50 이상에서만 시작 · 0 까지 뛰고 걷기 · 다시 뛰려면 50', () => {
  assert.equal(RUN.startAt, 50);
  assert.equal(RUN.stopAt, 0);
  const f = mock();
  f.stamina.value = 49.9;
  for (let i = 0; i < 2 * H / DT; i++) assert.equal(tick(f, 1), false, '49.9 — 시작 못 함 (버텨도)');
  assert.equal(f.run.hold, 0, '버티는 셈도 안 함 (테두리가 차지 않음)');
  f.stamina.value = 50;
  assert.equal(hold(f, 1), true, '50 — 버티면 시작');
  f.stamina.value = 20;
  assert.equal(tick(f, 1), true, '20 — 뛰는 중이면 계속');
  f.stamina.value = 0.5;
  assert.equal(tick(f, 1), true, '0.5 — 아직');
  f.stamina.value = 0;
  assert.equal(tick(f, 1), false, '0 — 걷기');
  assert.equal(f.run.end, 'stamina');
  f.stamina.value = 30;
  assert.equal(tick(f, 1), false, '30 — 다시 시작 못 함');
  f.stamina.value = 49;
  assert.equal(tick(f, 1), false);
  f.stamina.value = 50;
  assert.equal(hold(f, 1), true, '50 — 버티면 다시 뜀');
  // 기력 무한(용사의 눈물)은 늘 뜰 수 있음
  const g = mock();
  g.stamina.value = 10;
  g.stamina.infinite = true;
  assert.equal(hold(g, 1), true);
});

test('공격 · 막기가 뛰기를 곧바로 끊음 · 끊은 뒤에는 스틱을 0.85 안으로 되돌렸다 다시 밀어야 뜀', () => {
  for (const [name, set, clear] of [
    ['공격 입력 (runBreak)', (f) => (f.runBreak = true), () => {}],
    ['휘두름', (f) => (f.skill.swinging = true), (f) => (f.skill.swinging = false)],
    ['톡 찌르기', (f) => (f.skill.tap = {}), (f) => (f.skill.tap = null)],
    ['막기 (막기 단추를 쥠)', (f) => (f.stamina.guarding = true), (f) => (f.stamina.guarding = false)],
    ['비기', (f) => (f.skill.sec = {}), (f) => (f.skill.sec = null)],
  ]) {
    const f = mock();
    assert.equal(hold(f, 1), true, name);
    set(f);
    assert.equal(tick(f, 1), false, `${name} — 끊김`);
    assert.equal(f.run.end, 'break', name);
    clear(f);
    for (let i = 0; i < 10; i++) assert.equal(tick(f, 1), false, `${name} — 스틱을 그대로 밀고 있으면 다시 뛰지 않음`);
    assert.equal(tick(f, 0.5), false);
    assert.equal(hold(f, 1), true, `${name} — 되돌렸다 밀고 버티면 뜀`);
  }
  // 공격 중엔 시작하지 못함
  const g = mock();
  g.skill.swinging = true;
  for (let i = 0; i < 2 * H / DT; i++) assert.equal(tick(g, 1), false);
});

test('뛰는 방향은 상대 틀(나 → 상대가 앞) · 몸 틀 조종 입력으로 옮김 · 뛰는 동안 바라볼 쪽 = 뛰는 쪽', () => {
  // 상대가 +x. 스틱 비스듬히 앞 = 상대 틀 그대로 · 오른쪽 끝 = 상대 틀의 오른쪽
  const f = mock({ stickX: Math.SQRT1_2, stickY: Math.SQRT1_2 });
  hold(f, 1);
  assert.ok(near(f.run.dx, Math.SQRT1_2, 1e-12) && near(f.run.dz, Math.SQRT1_2, 1e-12), '비스듬히 앞 오른쪽');
  assert.ok(near(Math.abs(wrap(runFace(f) + Math.PI / 4)), 0, 1e-12), '바라볼 쪽 = 비스듬히 오른쪽');
  const right = new THREE.Vector3(Math.sin(0), 0, Math.cos(0)); // fighter.right (heading 0)
  const g = mock({ stickX: 1, stickY: 0 });
  hold(g, 1);
  assert.ok(near(g.run.dx, right.x, 1e-12) && near(g.run.dz, right.z, 1e-12), '오른쪽 = 몸 오른쪽(상대를 볼 때)');
  // 몸이 돌아 뛰는 쪽을 보면 조종 입력은 앞 (몸 틀) — 돌아서는 동안은 크기를 RUN.turnMove 로 줄임
  const h = mock({ stickX: 1, stickY: 0, heading: -Math.PI / 2 });
  hold(h, 1);
  assert.ok(near(h.move.x, 0, 1e-9) && near(h.move.y, 1, 1e-9), `몸이 옆으로 돌았으면 앞으로 걷는 입력 (${h.move.x}, ${h.move.y})`);
  const k = mock({ stickX: 1, stickY: 0, heading: 0 });
  hold(k, 1);
  assert.ok(near(Math.hypot(k.move.x, k.move.y), RUN.turnMove, 1e-9), '돌아서는 동안(사이 각 > alignMax) 크기 × turnMove');
});

test('초당 기력 = 그 몸의 걷는 끝 빠르기 걷기 초당 기력 × 2 (11/20 사장님 \'뛰기 기력 소모는 걷기의 2배\' — 실제 초당 보통 26.7 · 동방 C2 13.3 · 일본 J1 28 · 일본 J1 없음 26.7)', () => {
  assert.equal(RUN.cost, 2);
  const rate = (weapon, kit) => {
    const G = newRound({ weapon, seed: 1, ...(kit ? { kit } : {}), onFighter(f) { if (f.index === 0) f.humanInput = true; } });
    G.step();
    const r = runCostRate(G.player) * TIME.k; // 실제 초당
    const w = walkTopOf(G.player) * TIME.k;
    G.world.free();
    return { r, w };
  };
  const de = rate('longsword');
  assert.ok(near(de.w, 2.0, 1e-9) && near(de.r, 80 / 3, 1e-9), `보통(독일) ${de.r}`);
  assert.ok(near(rate('rapier').r, 80 / 3, 1e-9), '이탈리아');
  assert.ok(near(rate('zweihander').r, 80 / 3, 1e-9), '이베리아');
  const cn2 = rate('qinggang', kitFromNodes('chinese', new Set(['C1', 'C2'])));
  assert.ok(near(cn2.r, 40 / 3, 1e-9), `동방 C2 ${cn2.r}`);
  assert.ok(near(rate('qinggang', kitFromNodes('chinese', new Set(['C1']))).r, 80 / 3, 1e-9), '동방 C2 없음');
  const jp1 = rate('uchigatana', kitFromNodes('japanese', new Set(['J1'])));
  assert.ok(near(jp1.w, 1.4, 1e-9) && near(jp1.r, 28, 1e-9), `일본 J1 ${jp1.r} (걷는 끝 ${jp1.w})`);
  const jp0 = rate('uchigatana', kitFromNodes('japanese', new Set()));
  assert.ok(near(jp0.w, 2.0, 1e-9) && near(jp0.r, 80 / 3, 1e-9), `일본 J1 없음 — 보법 I(J1)을 안 익히면 보통 걸음 · 보통 걸음 기력 (${jp0.r})`);
});

test('뛰는 동안 기력: 초당 runCostRate 그대로 빠지고 자연 회복 없음 · 0 밑으로 안 감 · 끝나면 recoverDelay 뒤 회복', () => {
  const S = { value: 100, rest: 5, infinite: false, spent: { move: 0 }, spend(k, a) { this.value -= a; this.spent[k] += a; return true; } };
  const f = mock();
  const r = runCostRate(f);
  runSpend(S, f, 0.5);
  assert.ok(near(S.value, 100 - r * 0.5, 1e-9));
  assert.equal(S.rest, 0, '회복 시계 0');
  S.value = r * 0.01;
  runSpend(S, f, 0.5);
  assert.equal(S.value, 0, '0 에서 멈춤 (지침으로 넘지 않음)');
  // 판 안: 사람 몸이 뛰는 1 s 동안 기력이 runCostRate × 1 s 만큼 빠지고(회복 없음), 뛰기를 놓으면 recoverDelay 지나서 오름
  const { P, rec } = runCase({ weapon: 'longsword', T: 3 + H, script: (u) => (u < H + 1.5 ? { sx: 0, sy: 1, reach: 1 } : { sx: 0, sy: 0, reach: 0 }) });
  const a = rec.find((x) => x.on);
  const b = rec.filter((x) => x.on).at(-1);
  const exp = runCostRate(P) * (b.u - a.u);
  assert.ok(Math.abs(a.st - b.st - exp) < runCostRate(P) * DT * 2, `뛴 동안 빠짐 ${a.st - b.st} ≈ ${exp}`);
  for (let i = 1; i < rec.length; i++) if (rec[i].on && rec[i - 1].on) assert.ok(rec[i].st <= rec[i - 1].st + 1e-9, '뛰는 동안 오르지 않음');
  const stop = rec.find((x) => x.u >= H + 1.5 && !x.on);
  const up = rec.find((x) => x.u > stop.u && x.st > stop.st + 1e-6);
  assert.ok(up && up.u - stop.u >= STAMINA.recoverDelay - 2 * DT, `회복은 recoverDelay 뒤 (${up?.u - stop.u})`);
});

test('앞 반원만 뜀 (11/20 사장님 \'뒤돌아 뛰는 거 자체를 없애는 게 나을 수도 있어\'): 앞 · 옆 · 비스듬히 앞 끝이면 뜀 · 뒤 반원이면 걷기(뒷걸음) · 뛰다 뒤 반원으로 당기면 걷기', () => {
  assert.ok(RUN.arc > Math.PI / 2 && RUN.arc < Math.PI / 2 + 0.1, `RUN.arc ${RUN.arc}`);
  for (const [sx, sy, on, name] of [[0, 1, true, '앞'], [1, 0, true, '옆'], [-1, 0, true, '왼옆'], [Math.SQRT1_2, Math.SQRT1_2, true, '비스듬히 앞'],
    [Math.SQRT1_2, -Math.SQRT1_2, false, '비스듬히 뒤'], [0, -1, false, '뒤'], [-0.2, -0.98, false, '거의 뒤'], [0.999, -0.04, true, '옆 (엄지가 조금 뒤로)'], [0.99, -0.14, false, '옆보다 8° 뒤']]) {
    assert.equal(hold(mock({ stickX: sx, stickY: sy }), 1), on, name);
  }
  // 뛰는 중: 옆 끝에서 조금(RUN.arcOut 안) 뒤로 흔들려도 그대로 · 뒤 반원으로 당기면 걷기
  const f = mock({ stickX: 1, stickY: 0 });
  assert.equal(hold(f, 1), true);
  const a = RUN.arc + RUN.arcOut * 0.5;
  assert.equal(tick(f, 1, { stickX: Math.sin(a), stickY: Math.cos(a) }), true, '사이 띠');
  assert.equal(tick(f, 1, { stickX: 0, stickY: -1 }), false, '뒤로 당김 — 걷기');
  assert.equal(f.run.end, 'stick');
  assert.equal(tick(f, 1), false, '뒤 반원에 둔 채면 그대로 걷기');
  assert.equal(hold(f, 1, { stickX: 0, stickY: 1 }), true, '앞으로 밀고 버티면 다시 뜀 (다시 걺 필요 없음)');
});

test('판 안: 뒤 끝으로 밀면 뛰지 않고 상대를 본 채 뒷걸음 · 옆 끝으로 뛰면 걷는 끝보다 빠르고 · 놓으면 서고 나서 상대 쪽으로 돌아옴 · 넘어지지 않음', () => {
  const B = runCase({ weapon: 'longsword', T: 3, script: () => ({ sx: 0, sy: -1, reach: 1 }) });
  assert.equal(B.P.run.runs, 0, '뒤 끝 — 뛰지 않음');
  assert.ok(B.rec.every((x) => Math.abs(wrap(x.head)) < 0.3), '몸은 상대(+x)를 봄');
  assert.ok(B.rec.at(-1).x < B.rec[0].x - 1, `뒷걸음으로 물러남 ${(B.rec.at(-1).x - B.rec[0].x).toFixed(2)} m`);
  const { P, rec } = runCase({ weapon: 'longsword', T: 8 + H, script: (u) => (u < H + 3.2 ? { sx: 1, sy: 0, reach: 1 } : { sx: 0, sy: 0, reach: 0 }) });
  const on0 = rec.find((x) => x.on);
  const side = rec.find((x) => x.on && Math.abs(wrap(x.head + Math.PI / 2)) < 0.15);
  assert.ok(on0 && on0.u >= H - DT && rec.filter((x) => x.u < on0.u).every((x) => Math.abs(wrap(x.head)) < 0.3), `버티는 ${H.toFixed(2)} s 동안은 상대를 본 채 옆걸음 (뛰기 시작 ${on0?.u.toFixed(2)})`);
  assert.ok(side && side.u - on0.u < 1.5, `옆으로 돌아섬 ${side?.u - on0?.u}`);
  const w = Math.round(0.3 / DT);
  let vMax = 0;
  for (let i = 0; i + w < rec.length; i++) if (rec[i].on && rec[i + w].on) vMax = Math.max(vMax, Math.hypot(rec[i + w].x - rec[i].x, rec[i + w].z - rec[i].z) / (w * DT));
  assert.ok(vMax > walkTopOf(P) * 2, `뛰는 빠르기 ${vMax} > 걷는 끝 × 2`);
  const back = rec.find((x) => x.u > H + 3.2 && Math.abs(wrap(Math.atan2(-(0 - x.z), 100 - x.x) - x.head)) < 0.15);
  assert.ok(back && back.u - H - 3.2 < 3.5, `상대 쪽으로 돌아옴 ${back?.u - H - 3.2}`);
  // 놓은 뒤 몸이 걷는 끝 × RUN.faceSlow 밑으로 줄 때까지는 가는 쪽을 봄 — 내달리는 채로 돌지 않음
  const turning = rec.find((x) => x.u > H + 3.2 && Math.abs(wrap(x.head + Math.PI / 2)) > 0.5);
  assert.ok(turning && turning.v < walkTopOf(P) * RUN.faceSlow * 1.3, `돌기 시작할 때 빠르기 ${turning?.v}`);
  assert.ok(rec.every((x) => x.state === 'stand'), '넘어지지 않음');
});

test('공격 입력으로 끊으면 몸은 RUN.accel 안에서 걷는 빠르기로 줄어듦 (순간이동 없음)', () => {
  const { P, rec } = runCase({ weapon: 'longsword', T: 4 + H, script: (u) => ({ sx: 0, sy: 1, reach: 1, brk: u >= H + 2.5 && u < H + 2.5 + DT }) });
  const i0 = rec.findIndex((x) => x.u >= H + 2.5);
  assert.equal(rec[i0 + 1].on, false);
  assert.equal(rec[i0 + 1].end, 'break');
  // 0.2 s 창 평균 빠르기 (발마다 출렁임을 거름)
  const w = Math.round(0.2 / DT);
  const vAt = (i) => Math.hypot(rec[i + w].x - rec[i].x, rec[i + w].z - rec[i].z) / (w * DT);
  const v0 = vAt(i0 - w);
  const wt = walkTopOf(P);
  let j = i0;
  while (j + w < rec.length && vAt(j) > wt * 1.05) j++;
  const t = (j - i0) * DT;
  assert.ok(v0 > wt * 1.5, `끊을 때 뛰는 빠르기 ${v0}`);
  assert.ok(t > 0.1 && (v0 - wt) / t <= RUN.accel * 1.3, `걷는 빠르기까지 ${t.toFixed(2)} s · 평균 ${((v0 - wt) / t).toFixed(2)} m/s² (한도 ${RUN.accel})`);
  const vCap = walkTopOf(P) * RUN.mul * 1.3; // 뛰는 끝 빠르기 × 1.3 (날며 뛰는 걸음마다 출렁임)
  for (let i = 1; i < rec.length; i++) assert.ok(Math.hypot(rec[i].x - rec[i - 1].x, rec[i].z - rec[i - 1].z) < vCap * DT, `한 스텝에 ${vCap.toFixed(1)} m/s 넘게 옮기지 않음`);
  assert.ok(rec.slice(i0).every((x) => x.state === 'stand'));
});

test('걸음 운동량(STRIKE.stepMass)은 걷는 끝 빠르기에서 멈춤 — 뛰며 친 베기가 걸으며 친 베기보다 세지 않음 · 지금 값(stepVRef 1.0)에선 바뀜 없음', () => {
  const body = (vx) => ({ cache: { parts: { pelvis: { p: { x: 0, z: 0 }, v: { x: vx, z: 0 } } } }, skill: {} });
  const vic = { cache: { parts: { pelvis: { p: { x: 2, z: 0 }, v: { x: 0, z: 0 } } } } };
  assert.ok(STRIKE.stepVRef <= GAIT.moveSpeed);
  for (const v of [0.3, 0.9, 1.0, 1.5, GAIT.moveSpeed]) assert.equal(stepMassOf(body(v), vic), STRIKE.stepMass * Math.min(1, v / STRIKE.stepVRef), `v ${v} — 옛 식 그대로`);
  assert.equal(stepMassOf(body(3.6), vic), stepMassOf(body(GAIT.moveSpeed), vic), '뛰는 빠르기 = 걷는 끝');
  const keep = STRIKE.stepVRef;
  STRIKE.stepVRef = 3;
  try {
    assert.equal(stepMassOf(body(3.6), vic), stepMassOf(body(GAIT.moveSpeed), vic), 'stepVRef 를 걷는 끝 위로 올려도 뛰는 몫은 걷는 끝에서 멈춤');
    assert.ok(stepMassOf(body(3.6), vic) < STRIKE.stepMass);
  } finally {
    STRIKE.stepVRef = keep;
  }
});

test('스틱 길 몫(runReach)을 둔 몸만 (11/19 — 몸을 가리지 않음): 1:1 AI · runReach 를 안 둔 대본 몸은 f.run 이 없음 · runReach 를 둔 대본 몸은 같은 규칙으로 뜀', () => {
  const G = newRound({ weapon: 'longsword', seed: 3 });
  G.before = () => { G.player.move.set(0, 1); G.player.stickY = 1; };
  for (let i = 0; i < 3 / DT; i++) G.step();
  assert.equal(G.player.run, undefined, '대본 몸 (runReach 없음)');
  assert.equal(G.enemy.run, undefined, '1:1 AI 몸 (runReach 를 두지 않음 — src/ai_run.js 는 셋 이상 판만)');
  assert.equal(G.enemy.runReach, undefined);
  G.world.free();
  const K = newRound({ weapon: 'longsword', seed: 3 });
  K.before = () => { K.player.move.set(0, 1); K.player.stickY = 1; K.player.runReach = 1; };
  for (let i = 0; i < (3 + H) / DT; i++) K.step();
  assert.ok(K.player.run?.runs >= 1, '대본 몸도 스틱 끝이면 (버틴 뒤) 뜀 (사람 · AI 와 같은 runStep)');
  assert.equal(K.enemy.run, undefined);
  K.world.free();
  assert.equal(runState({}).on, false);
});

test('PC: Shift(왼 · 오른) + 방향 키 = 스틱 끝(1) · Shift 만 · 방향 키만은 아님 · 스틱은 손잡이 길 몫', async () => {
  const { Input } = await import('../../src/input.js');
  const get = Object.getOwnPropertyDescriptor(Input.prototype, 'runReach').get;
  const R = (keys, stickReach = 0, enabled = true) => get.call({ enabled, keys: new Set(keys), stickReach });
  assert.equal(R(['ShiftLeft', 'KeyW']), 1);
  assert.equal(R(['ShiftRight', 'ArrowDown']), 1);
  assert.equal(R(['ShiftLeft']), 0);
  assert.equal(R(['KeyW']), 0);
  assert.equal(R([], 0.97), 0.97);
  assert.equal(R(['ShiftLeft', 'KeyW'], 0, false), 0, '입력 꺼짐');
});

test('빠르기 (11/20 사장님 \'최소 5에서 6은 돼야겠던데?\' — RUN.mul 3 → 11/21 \'너무 빠르더라. 2.5배로 하고\' 2.5): 보통 몸 뛰는 끝 실제 5.0 m/s · 날며 뜀(두 발 모두 뜬 몫) · 고른 빠르기에서 붙잡기 반사 · 넘어짐 없음 · 일본 J1 은 걷기 × 2.5 = 실제 3.5', () => {
  assert.equal(RUN.mul, 2.5);
  const K = TIME.k;
  for (const [weapon, kit, target] of [['longsword', null, 5.0], ['uchigatana', kitFromNodes('japanese', new Set(['J1'])), 3.5]]) {
    const { P, rec } = runCase({ weapon, kit, T: 6 + H, script: () => ({ sx: 0, sy: 1, reach: 1 }) });
    assert.ok(near(walkTopOf(P) * RUN.mul * K, target, 1e-9), `${weapon} 뛰는 끝 ${walkTopOf(P) * RUN.mul * K}`);
    // 뛰기 시작 2.5 s 뒤 ~ 기력이 다하기 전 (게임 초) — 고른 빠르기
    const i0 = rec.findIndex((x) => x.on);
    const steady = rec.filter((x) => x.on && x.u > rec[i0].u + 2.5 && x.u < rec[i0].u + 5);
    const a = steady[0];
    const b = steady.at(-1);
    const v = (Math.hypot(b.x - a.x, b.z - a.z) / (b.u - a.u)) * K;
    assert.ok(v > target * 0.9, `${weapon} 고른 빠르기 실제 ${v.toFixed(2)} m/s (> ${target} × 0.9)`);
    const air = steady.filter((x) => x.air).length / steady.length;
    assert.ok(air > 0.3, `${weapon} 두 발 모두 뜬 몫 ${air.toFixed(2)}`);
    assert.equal(steady.filter((x) => x.lev > 0.3).length, 0, `${weapon} 붙잡기 반사 없음`);
    assert.ok(rec.every((x) => x.state === 'stand'), `${weapon} 넘어지지 않음`);
  }
});

test('날며 뛰기는 뛰는 몸만 (11/20): f.run 이 없는 몸(1:1 AI · 대본 몸)의 걸음 장치는 늘 날기 끔 · 두 발이 한꺼번에 뜨지 않음', () => {
  const G = newRound({ weapon: 'longsword', seed: 5 });
  G.before = () => { G.player.move.set(0, 1); G.player.stickY = 1; };
  let fly = 0, air = 0;
  for (let i = 0; i < 4 / DT; i++) {
    G.step();
    for (const f of [G.player, G.enemy]) {
      if (f.gait?.fly || f.gait?.flyAir) fly++;
      if (f.gait?.active && !f.gait.legs.F.stance && !f.gait.legs.B.stance) air++;
    }
  }
  assert.equal(G.player.run, undefined);
  assert.equal(fly, 0);
  assert.equal(air, 0, '두 발 모두 뜬 스텝 없음');
  G.world.free();
});

test('물리 스텝이 화면마다 여럿이어도(사람 몸 — 스틱은 화면마다 한 번) 돌아서는 동안 걸음 입력이 거듭 줄지 않음 (11/20 고침)', () => {
  for (const heading of [0, 0.2, 0.35]) {
    const f = mock({ stickX: 0, stickY: -1, heading: Math.PI - heading });
    f.runReach = 1;
    f.move.set(0, -1);
    runStep(f, DT);
    const m1 = Math.hypot(f.move.x, f.move.y);
    runStep(f, DT); // 같은 화면의 둘째 스텝 — main.js 가 move 를 다시 두지 않음
    runStep(f, DT);
    const m3 = Math.hypot(f.move.x, f.move.y);
    assert.ok(near(m1, m3, 1e-12), `사이 각 ${heading}: ${m1} → ${m3}`);
    f.move.set(0, -1); // 다음 화면: main.js 가 스틱을 다시 둠 — 그대로 읽음
    runStep(f, DT);
    assert.ok(near(Math.hypot(f.move.x, f.move.y), m1, 1e-12));
  }
});

test('들어가기 (11/21 사장님 \'끝까지 밀고 2초 이상 유지하면 뛰기 시작.\'): 끝까지 민 채 RUN.hold(실제 2 s) 넘게 버텨야 뜀 · stickOut 안으로 돌아오거나 방향이 RUN.holdTurn 넘게 돌면 처음부터 · 사이 띠(0.85 ~ 0.95)는 셈을 이어감', () => {
  assert.ok(near(RUN.hold, 2.0 * TIME.k, 1e-12), `RUN.hold = realS(2.0) ${RUN.hold}`);
  assert.ok(RUN.holdTurn > Math.PI / 4 && RUN.holdTurn < Math.PI / 2, `holdTurn ${RUN.holdTurn}`);
  const f = mock();
  assert.equal(hold(f, 1), true, '버틴 끝 스텝에 뜀');
  assert.ok(near(f.run.runT, 0, 1e-12) || f.run.runT <= DT + 1e-12);
  // 셈 이어감: 사이 띠 · 작은 방향 바뀜(holdTurn 안)
  const g = mock();
  const n = Math.ceil(H / DT - 1e-9);
  for (let i = 1; i < n; i++) {
    const a = i < n / 2 ? 0 : RUN.holdTurn * 0.9;
    assert.equal(tick(g, i % 3 ? 1 : 0.88, { stickX: Math.sin(a), stickY: Math.cos(a) }), false);
  }
  assert.equal(tick(g, 1, { stickX: Math.sin(RUN.holdTurn * 0.9), stickY: Math.cos(RUN.holdTurn * 0.9) }), true, '사이 띠 · holdTurn 안의 방향 바뀜은 셈을 이어감');
  // 처음부터: stickOut 안으로 돌아옴
  const h = mock();
  for (let i = 0; i < n - 2; i++) tick(h, 1);
  assert.equal(tick(h, 0.84), false);
  assert.equal(h.run.hold, 0, 'stickOut 안 — 처음부터');
  assert.equal(hold(h, 1), true, '다시 RUN.hold 를 버텨야');
  // 처음부터: 방향이 holdTurn 넘게 돎 (앞 → 옆) — 새 방향에서 셈을 새로
  const k = mock();
  for (let i = 0; i < n - 2; i++) tick(k, 1);
  assert.equal(tick(k, 1, { stickX: 1, stickY: 0 }), false);
  assert.ok(near(k.run.hold, DT, 1e-12), '옆으로 돌림 — 새 방향에서 처음부터');
  for (let i = 2; i < n; i++) assert.equal(tick(k, 1, { stickX: 1, stickY: 0 }), false);
  assert.equal(tick(k, 1, { stickX: 1, stickY: 0 }), true, '새 방향에서 RUN.hold 를 버틴 뒤 뜀');
  // 처음부터: 버티는 동안 공격 입력
  const m = mock();
  for (let i = 0; i < n - 2; i++) tick(m, 1);
  m.runBreak = true;
  tick(m, 1);
  assert.equal(m.run.hold, 0, '공격 입력 — 처음부터');
});
