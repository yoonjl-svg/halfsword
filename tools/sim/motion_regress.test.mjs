// 사람 고유 공격 · 특수 공격 · 비기 길 시험 (11/18 — 사장님 11/17 '물리가 변하면서 고유공격, 특수공격, 비기 길이나 빠르기 같은 게 좀 달라진 거 같아' ·
//  기록 docs/strike/motion_regress_2026-11-18.md · 도구 tools/sim/motion_regress.mjs)
//  ① 이베리아 B7 이어 돌리기 칸 글: 11/17 스위치 걷기(801e1a75)가 IB_LINK.on 칸을 지우고도 글이 그 칸을 읽어 늘 옛 풍차 베기 글이던 것 — 기본 판(이어 돌리기) 글로 묶음.
//  ② 허공(상대 3.2 m · 멈춤) 수마다 걸린 시간 · 칼끝 길 · 칼끝 최고 빠르기 = 11/16 끝(54299e65)에서 잰 값 ± 5 % · 낸 이름 같음 — 스위치 걷기가 기본 판을 바꾸지 않았음을 묶음.
//  ③ 맞는 긋기(걸어 들어가 곁눈 베기)는 C 물리(79808850 — 사장님 11/17 결정)로 달라짐 — C 두 수를 빼면 11/16 값 그대로 (다른 까닭이 섞이지 않음).
//  node --test tools/sim/motion_regress.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { STRIKE } from '../../src/config.js';
import { MOVES } from './motion_regress.mjs';

test('B7 이어 돌리기 칸 글 = 기본 판(이어 돌리기) 글 — 지운 IB_LINK.on 을 읽지 않음 (11/16 브라우저 기본 판 값)', () => {
  const e = PLAYER_UNIQUE.iberian.find((x) => x.name === 'cingir');
  assert.equal(e.hint, '이어 그으면 칼이 머리 위로 돌아 다음 칼 시작 자리로 넘어간다');
  assert.equal(e.nameKo, '이어 돌리기 (싱지르)');
  // 표 칸에 config 를 읽는 getter 가 남지 않음 (칸을 지우면 소리 없이 다른 판 글이 됨 — 교훈 §9-6)
  for (const L of Object.values(PLAYER_UNIQUE)) for (const x of L) for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(x))) assert.equal(typeof d.get, 'undefined', `${x.name}.${k} getter`);
});

// 11/16 끝 (54299e65) 에서 같은 도구로 잰 값 — [dur 게임 s, path m, vmax m/s, 낸 이름]
const PIN = {
  schielhau: [0.6, 4.164, 16.97, ['schielhau']],
  imbroccata: [0.9, 1.669, 8.56, ['imbroccata']],
  inquartata: [0.308, 0.927, 11.91, ['inquartata']],
  talhoRodeado: [1.425, 8.541, 14.08, ['talhoRodeado']],
  cingir: [1.917, 14.335, 18.05, ['cingir×1']],
  altib: [0.333, 4.464, 13.66, []],
  kote: [0.842, 1.566, 3.69, ['kote']],
  tsubameGaeshi: [0.467, 2.207, 16.62, ['tsubameGaeshi']],
  gonosen: [0.15, 4.879, 69.08, ['goNoSen']],
  chebuYaoji: [1.217, 6.096, 12.34, ['chebuYaoji']],
  lianchi: [0.383, 3.19, 17.27, ['lianchi']],
  gyeoksal: [0.217, 2.325, 11.8, ['gyeoksal']],
  mordschlag: [0.75, 6.546, 62.15, ['mordschlag']],
  risoluto: [0.708, 1.252, 24.8, ['andareRisoluto']],
};
const near = (a, b) => Math.abs(a - b) <= 0.05 * Math.abs(b) + 1e-9;

for (const [k, [dur, path, vmax, fired]] of Object.entries(PIN)) {
  test(`허공 ${k}: 걸린 시간 · 칼끝 길 · 칼끝 최고 = 11/16 ± 5 % · 같은 수가 남`, () => {
    const r = MOVES[k]();
    assert.ok(!r.err, r.err);
    assert.deepEqual(r.fired, fired);
    if (k === 'altib') assert.equal(r.bursts, 1, '알티바슈 포르트 비기 한 번');
    assert.ok(near(r.dur, dur), `dur ${r.dur} (11/16 ${dur})`);
    assert.ok(near(r.path, path), `path ${r.path} (11/16 ${path})`);
    assert.ok(near(r.vmax, vmax), `vmax ${r.vmax} (11/16 ${vmax})`);
  });
}

test('맞는 긋기(걸어 들어가 곁눈 베기): C 물리 두 수(걸음 운동량 · 칼날 자리 무게)를 빼면 11/16 값 그대로 — 차이는 C 몫뿐', () => {
  const keep = { stepMass: STRIKE.stepMass, bladeW0: STRIKE.bladeW0 };
  let off;
  try {
    STRIKE.stepMass = 0;
    STRIKE.bladeW0 = 1;
    off = MOVES.schielhauNear();
  } finally {
    Object.assign(STRIKE, keep);
  }
  assert.deepEqual(off.fired, ['schielhau']);
  assert.ok(near(off.path, 2.332) && near(off.dur, 0.492), `C 뺀 판 path ${off.path} dur ${off.dur} (11/16 2.332 · 0.492)`);
  const on = MOVES.schielhauNear();
  assert.deepEqual(on.fired, ['schielhau']);
  assert.ok(on.path > off.path * 1.05, `C 판 path ${on.path} — 들어가며 친 칼이 몸을 더 가르고 지나감 (ae_port §4-1)`);
});
