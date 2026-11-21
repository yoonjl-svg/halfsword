// 거점전 — 두 거점 쥐기 (사장님 11/21 '생사전은 전멸을 목표로 해야 생사전이야. 거점전은 따로 만들자.' — src/capture.js · src/capture_ai.js · 기록 docs/strike/capture_mode_2026-11-21.md)
//  ① 3 초 쥐기 · 함께 서면 · 비면 처음부터 ② 쓰러짐 · 일어나는 중 · 죽음 · 부활 중은 안 셈 (꿇은 채 싸우는 몸은 셈) ③ 두 거점 20 초 → 이김 ④ 상대가 원 안에 서 있으면 멈춤
//  ⑤ 하나를 뺏기면 20 초부터 다시 ⑥ 전멸도 이김 · 쥐기로 끝난 판 ⑦ 생사전 · 다른 판은 거점이 없음(전멸만) ⑧ AI 자리 나눔 (둘 = 하나씩 · 셋 = 둘 + 하나 · 상대가 둘 다 쥐면 몰아 감)
//  node --test tools/sim/capture.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { RAPIER, newMatch, DT } from './jelly_harness.mjs';
import { createCapture, stepCapture, pointBody } from '../../src/capture.js';
import { captureGoal } from '../../src/capture_ai.js';
import { matchResult } from '../../src/match.js';
import { fieldOfMap, mapGeo, SAENGSA_MAP_BY_ID } from '../../src/saengsa_maps.js';
import { CAPTURE } from '../../src/config.js';

const PTS = [{ x: 0, z: -7, r: 1.3 }, { x: 0, z: 7, r: 1.3 }];
/** 물리 없는 몸 (골반 자리 · 편 · 상태) */
const body = (team, x, z, extra = {}) => ({ team, alive: true, revival: null, state: 'stand', index: 0, bodies: { pelvis: { translation: () => ({ x, y: 1, z }) }, chest: { translation: () => ({ x, y: 1.3, z }) } }, ...extra });
const run = (C, F, secs, dt = 1 / 60) => { let w = null; for (let t = 0; t < secs - 1e-9 && w == null; t += dt) w = stepCapture(C, F, dt); return w; };

test('규칙 값 = 사장님 결정 (쥐기 3 초 · 함께 쥔 20 초) · 거점 원 = 맵 표 (두 다리 1.3 · 성벽 안뜰 1.2)', () => {
  assert.equal(CAPTURE.take, 3);
  assert.equal(CAPTURE.hold, 20);
  assert.deepEqual(mapGeo(SAENGSA_MAP_BY_ID.bridges).points.map((p) => p.r), [1.3, 1.3]);
  assert.deepEqual(mapGeo(SAENGSA_MAP_BY_ID.court).points.map((p) => p.r), [1.2, 1.2]);
});

test('3 초: 원 안에 한 편만 3 초 이어지면 그 편 것 · 2.9 초엔 아직 · 함께 서거나 비면 처음부터', () => {
  const C = createCapture(PTS);
  const a = body(0, 0.5, -7);
  run(C, [a], 2.9);
  assert.equal(C.points[0].owner, null);
  assert.equal(C.points[0].by, 0);
  run(C, [a], 0.12);
  assert.equal(C.points[0].owner, 0);
  assert.equal(C.points[1].owner, null);
  // 함께 서면 쥐는 셈 없음 · 상대가 2 초 쥐다 떠나면 처음부터
  const C2 = createCapture(PTS);
  const b = body(1, -0.3, -7.2);
  run(C2, [a, b], 5);
  assert.equal(C2.points[0].owner, null);
  assert.equal(C2.points[0].by, null);
  run(C2, [b], 2);
  assert.equal(C2.points[0].by, 1);
  run(C2, [], 0.5);
  assert.equal(C2.points[0].k, 0);
  run(C2, [b], 2.9);
  assert.equal(C2.points[0].owner, null, '떠났다 오면 3 초를 처음부터');
  // 원 밖(반지름 1.3 넘음)은 안 셈
  const C3 = createCapture(PTS);
  run(C3, [body(0, 1.4, -7)], 5);
  assert.equal(C3.points[0].owner, null);
});

test('쓰러짐 · 일어나는 중 · 죽음 · 부활 중은 안 셈 — 꿇은 채 싸우는 몸(kneel)은 셈', () => {
  for (const extra of [{ state: 'down' }, { state: 'getup' }, { state: 'dead', alive: false }, { alive: false }, { revival: { t: 0 } }]) {
    const C = createCapture(PTS);
    const f = body(0, 0, -7, extra);
    assert.equal(pointBody(f), false);
    run(C, [f], 5);
    assert.equal(C.points[0].owner, null, JSON.stringify(extra));
  }
  const C = createCapture(PTS);
  run(C, [body(0, 0, -7, { state: 'kneel' })], 3.1);
  assert.equal(C.points[0].owner, 0);
  // 쓰러진 상대는 내 쥐기를 막지 않는다
  const C2 = createCapture(PTS);
  run(C2, [body(0, 0, -7), body(1, 0.4, -7, { state: 'down' })], 3.1);
  assert.equal(C2.points[0].owner, 0);
});

test('20 초: 두 거점을 다 가진 채 20 초 → 이김 (19.9 초엔 아직) · 원을 떠나도 주인은 남음', () => {
  const C = createCapture(PTS);
  const a = body(0, 0, -7), b = body(0, 0, 7);
  run(C, [a, b], 3.05);
  assert.deepEqual(C.points.map((P) => P.owner), [0, 0]);
  assert.equal(C.holder, 0);
  const away = [body(0, -10, 0)]; // 원 밖으로 — 주인은 남고 시계는 돈다
  assert.equal(run(C, away, 19.85), null);
  assert.equal(C.winner, null);
  assert.ok(C.clock > 0 && C.clock < 0.3, String(C.clock));
  assert.equal(run(C, away, 0.3), 0);
  assert.equal(C.winner, 0);
  assert.equal(C.clock, 0);
});

test('멈춤: 상대 몸이 어느 원에든 서 있는 동안 시계가 멈춤 · 나가면 이어서', () => {
  const C = createCapture(PTS);
  run(C, [body(0, 0, -7), body(0, 0, 7)], 3.05);
  run(C, [], 5);
  const left = C.clock;
  // 상대가 원 안 · 우리 편도 함께(뺏기지 않음) — 멈춤
  run(C, [body(1, 0.2, 7), body(0, -0.2, 7)], 6);
  assert.equal(C.paused, true);
  assert.ok(Math.abs(C.clock - left) < 1e-9, `${C.clock} ${left}`);
  assert.equal(C.points[1].owner, 0);
  // 쓰러진 상대는 멈추지 못함
  run(C, [body(1, 0.2, 7, { state: 'down' })], 1);
  assert.equal(C.paused, false);
  assert.ok(C.clock < left - 0.9);
});

test('뺏기면 처음부터: 상대가 거점 하나를 쥐면 20 초로 · 다시 둘 다 쥐어도 20 초부터', () => {
  const C = createCapture(PTS);
  run(C, [body(0, 0, -7), body(0, 0, 7)], 3.05);
  run(C, [], 12);
  assert.ok(C.clock < 9);
  run(C, [body(1, 0, 7)], 3.05); // 상대 혼자 3 초 — 뺏음
  assert.equal(C.points[1].owner, 1);
  assert.equal(C.holder, null);
  assert.equal(C.clock, CAPTURE.hold);
  run(C, [body(0, 0, 7)], 3.05); // 되찾음
  assert.equal(C.holder, 0);
  assert.ok(C.clock > CAPTURE.hold - 0.1, String(C.clock));
});

test('판: 거점전은 전멸도 이김 (endBy wipe) · 쥐기로 끝나면 endBy capture · 생사전 · 다른 판은 거점 없음(전멸만)', async () => {
  await RAPIER.init?.();
  const G = newMatch({ count: 4, ai: 'all', seed: 3, walls: true, map: 'bridges', capture: true });
  assert.ok(G.capture);
  assert.equal(G.fighters[0].capture, G.capture);
  for (const f of G.fighters) if (f.team === 1) f.die('시험');
  G.step();
  assert.equal(G.over, true);
  assert.equal(G.winner, 0);
  assert.equal(G.endBy, 'wipe');
  assert.equal(matchResult(G).by, 'wipe');
  const H = newMatch({ count: 4, ai: 'all', seed: 3, walls: true, map: 'court', capture: true });
  for (const P of H.capture.points) P.owner = 1;
  H.step(); // 쥔 편이 바뀌면 20 초로
  assert.equal(H.capture.holder, 1);
  H.capture.clock = DT / 2;
  H.step();
  assert.equal(H.over, true);
  assert.equal(H.winner, 1);
  assert.equal(H.endBy, 'capture');
  assert.equal(matchResult(H).by, 'capture');
  // 거점전이 아닌 판: 생사전 전용 맵이어도(생사전) · 원 무대도 거점 없음 — 결과 꼴도 그대로
  for (const o of [{ map: 'bridges' }, { map: 'court' }, {}]) {
    const K = newMatch({ count: 4, ai: 'all', seed: 3, walls: true, ...o });
    assert.equal(K.capture, undefined, JSON.stringify(o));
    assert.equal('by' in matchResult(K), false);
    assert.equal(K.fighters[0].capture, undefined);
  }
});

test('AI 자리 나눔: 둘 = 거점마다 하나 · 셋 = 둘 + 하나(우리 것이 아닌 곳에 둘) · 상대가 둘 다 쥐면 셋은 한 곳으로 · 사람 몸은 가까운 거점', () => {
  const F = fieldOfMap('bridges');
  const team = (n, xs) => {
    const list = xs.slice(0, n).map(([x, z], i) => body(0, x, z, { index: i * 2 }));
    const foes = [body(1, 14, 0, { index: 1 }), body(1, 14, 2, { index: 3 })];
    for (const f of list) (f.mates = list.filter((g) => g !== f)), (f.foes = foes);
    return list;
  };
  const spots = [[-14, -2.5], [-14, 0], [-14, 2.5]];
  // 둘
  let C = createCapture(mapGeo(SAENGSA_MAP_BY_ID.bridges).points);
  let T = team(2, spots);
  assert.deepEqual(T.map((f) => captureGoal(C, F, f)).sort(), [0, 1]);
  // 셋 (둘 다 빔): 둘 + 하나
  C = createCapture(mapGeo(SAENGSA_MAP_BY_ID.bridges).points);
  T = team(3, spots);
  let g = T.map((f) => captureGoal(C, F, f));
  assert.equal(new Set(g).size, 2);
  assert.ok(g.filter((i) => i === 0).length === 2 || g.filter((i) => i === 1).length === 2);
  // 셋 · 거점 0 이 우리 것: 둘은 거점 1 로
  C = createCapture(mapGeo(SAENGSA_MAP_BY_ID.bridges).points);
  C.points[0].owner = 0;
  g = T.map((f) => captureGoal(C, F, f));
  assert.equal(g.filter((i) => i === 1).length, 2);
  // 상대가 둘 다 쥠: 셋은 한 곳으로
  C = createCapture(mapGeo(SAENGSA_MAP_BY_ID.bridges).points);
  for (const P of C.points) P.owner = 1;
  C.holder = 1;
  g = T.map((f) => captureGoal(C, F, f));
  assert.equal(new Set(g).size, 1);
  // 둘은 상대가 둘 다 쥐어도 하나씩
  T = team(2, spots);
  g = T.map((f) => captureGoal(C, F, f));
  assert.deepEqual([...g].sort(), [0, 1]);
  // 사람 몸: 거점 1 옆에 선 사람은 거점 1 · AI 둘이 나머지(둘 + 하나 = 거점 0 둘)
  C = createCapture(mapGeo(SAENGSA_MAP_BY_ID.bridges).points);
  T = team(3, [[-4, 7], [-14, 0], [-14, 2.5]]);
  T[0].human = true;
  g = T.map((f) => captureGoal(C, F, f));
  assert.equal(g[0], 1);
});
