// 원전과 다른 셋 맞춤 시험 (사장님 11/13 결정 "원전과 다른 셋 이어서 맞춰" — 기록 docs/strike/iai_saya2_2026-11-14.md · 확인표 3720 ~ · 시간 상한 기준 없음 — 자리 · 쥠 · 거리 · 차례만 봄)
//  ① 기본값: SECRET.iaiSayaReady · iaiRegripFade · iaiSayaModoshi 1 · 鞘戻し 점 iaiSayaMouth = 배꼽 앞(배 앞면 밖 · 허리띠 높이 · 몸 가운데 왼쪽) · 칼집 입 자리 · 다시 쥐는 시간 사다리 값
//  ② 발도 대기 왼손 칼집 입 (사람 허리 대기 · AI 웅크린 대기 · 우치가타나 · 모노호시자오): 대기 동안 왼손이 칼자루 끝을 놓고 칼집 입을 쥠 · 들어갈 때 · 풀 때 빈손 목표가 튀지 않음(보통 두 손 싸움 몫 안) ·
//     풀면 칼자루 끝으로 돌아와 다시 쥠 (전 판 사람 대기 풀기는 칼 겨눔이 한 스텝에 바뀌며 빈손 목표 0.3 m 넘게 튐)
//  ③ 鞘引き: 대기에서 낸 발도는 칼이 칼집을 떠나는 몫(uB — 사람 원전 꼴은 맞음 · 잔상이 켜지는 hitFrom 과 같음)에서 빈손이 이미 왼 허리 · 사람 발도 칼 길 · 맞음 그대로 /
//     칼자루를 쥔 채 낸 발도는 11/13 그대로(鞘引き 놓기 없음)
//  ④ 두 손으로 돌아오는 때: 다시 쥐기가 풀기(振りかぶり) 동안 시작 · 鞘戻し 점을 풀기가 끝나는 때 지남(몫 0.5) · 빈손 목표가 그 점을 지남 · 굳음 · 풀기 길이 그대로 · 튐 없음 · 다시 쥐고 자리 잡음
//  ⑤ 끄면 11/13 판: 세 스위치 0 = 대기 동안 두 손 · 鞘引き 놓기 없음 · 풀기 끝 뒤 곧은 다시 쥐기
//  node --test tools/sim/iai_saya2.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { mhzShot, readyShot } from './mhz_draw.mjs';

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
const OFF = { iaiSayaReady: 0, iaiRegripFade: 0, iaiSayaModoshi: 0 };
const LADDER = [0.2, 0.4, 0.6, 1.2, 1.5, 2.0, 3.0, 6.0, 10.0];
const shot = (o = {}) => mhzShot({ weapon: 'uchigatana', foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3, ...o });
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mouthP = () => [SECRET.iaiSayaMouth[0], SECRET.iaiSayaMouth[1], -SECRET.iaiSayaMouth[2]];
const maxJump = (F) => {
  let m = 0;
  for (let i = 1; i < F.length; i++) if (F[i - 1].offT && F[i].offT) m = Math.max(m, dist3(F[i - 1].offT, F[i].offT));
  return m;
};

test('① 기본값 — 세 맞춤 켬 · 鞘戻し 점은 배꼽 앞 · 칼집 입 자리 · 다시 쥐는 시간 사다리 값', () => {
  assert.equal(SECRET.iaiSayaReady, 1);
  assert.equal(SECRET.iaiRegripFade, 1);
  assert.equal(SECRET.iaiSayaModoshi, 1);
  const [x, y, z] = SECRET.iaiSayaMouth;
  assert.ok(x > 0.1 && x < 0.2, `배 앞면(골반 상자 앞 0.1) 밖 (${x})`);
  assert.equal(y, SECRET.iaiSayaHip[1], '허리띠 높이 = 칼집 손 자리 높이');
  assert.ok(z > 0 && z < SECRET.iaiSayaHip[2], `몸 가운데 왼쪽 · 왼 허리보다 안 (${z})`);
  assert.ok(SECRET.iaiSayaKoi > 0 && SECRET.iaiSayaKoi <= 0.1, `칼집 입 (코등이에서 ${SECRET.iaiSayaKoi} m)`);
  assert.ok(SECRET.iaiSayaKoiAround > 0, '옮겨 쥘 때 칼 든 손 비킴');
  assert.ok(LADDER.includes(SECRET.iaiRegrip), `iaiRegrip ${SECRET.iaiRegrip}`);
});

test('② 발도 대기 왼손 칼집 입 — 대기 동안 칼집 입을 쥠 · 들고 날 때 튐 없음 · 풀면 칼자루로 다시 쥠', () => {
  // 모노호시자오 AI 웅크린 대기 앞 긴 자세(langort)는 맞닿기 + 0.3 m 에서 상대 칼끝이 대기 칼을 밀어 칼집 입이 몸 앞 0.67 m (대기 자세 밖 — 바탕부터) · 풀 때 칼이 크게 돌아오는 판이라 뺌
  for (const [weapon, start, guards] of [['uchigatana', 'hip', ['langort', 'ochsR']], ['uchigatana', 'crouch', ['langort', 'ochsR']], ['monohoshizao', 'hip', ['langort', 'ochsR']], ['monohoshizao', 'crouch', ['ochsR']]]) {
    for (const guard of guards) {
      const r = readyShot({ weapon, guard, start });
      const s = r.sum;
      assert.equal(s.sayaMax, 1, `${weapon} ${start} ${guard} 칼집 입 몫 다 듦`);
      assert.ok(s.onGapKoi < 0.04 && s.onGrip === 1, `${weapon} ${start} ${guard} 대기 동안 왼손이 칼집 입을 쥠 (틈 ${s.onGapKoi} · 쥠 ${s.onGrip})`);
      assert.ok(s.jumpOn.d < 0.05, `${weapon} ${start} ${guard} 대기에 들 때 빈손 목표 ${JSON.stringify(s.jumpOn)}`);
      const tr = r.frames.filter((f) => !f.on && f.sw > 0);
      assert.ok(tr.length > 1 && maxJump(tr) < 0.08, `${weapon} ${start} ${guard} 풀 때 빈손 목표 ${maxJump(tr)} (보통 두 손 싸움 몫 안)`);
      assert.ok(s.backGrip != null && s.endGap <= 0.03, `${weapon} ${start} ${guard} 칼자루로 다시 쥠 (${s.backGrip} · 틈 ${s.endGap})`);
    }
  }
  // 전 판(11/13): 대기 동안 두 손 — 사람 대기를 풀면 칼 겨눔이 한 스텝에 바뀌며 칼자루 끝 목표가 튐
  const b = withS(OFF, () => readyShot({ weapon: 'uchigatana', start: 'hip' }));
  assert.equal(b.sum.sayaMax, 0, '끄면 대기 동안 칼자루 끝 그대로');
  assert.ok(b.sum.jumpBack.d > 0.3, `전 판 사람 대기 풀기 튐 ${JSON.stringify(b.sum.jumpBack)}`);
});

test('③ 鞘引き — 칼이 칼집을 떠나는 몫에서 왼손이 이미 왼 허리 · 사람 발도 칼 길 · 맞음 그대로', () => {
  for (const [weapon, start] of [['uchigatana', 'hip'], ['monohoshizao', 'hip'], ['uchigatana', 'crouch'], ['kusanagi', 'hip'], ['muramasa', 'hip']]) {
    const r = shot({ weapon, start });
    const s = r.sum;
    assert.ok(s.preOff.sayaW > 0.9 && s.sayaUB != null, `${weapon} ${start} 대기(칼집 입)에서 낸 발도`);
    assert.ok(s.ohUBHip < 0.03, `${weapon} ${start} 칼집을 떠날 때 빈손 ↔ 왼 허리 ${s.ohUBHip}`);
    if (start === 'hip') assert.ok(Math.abs(s.sayaUB - r.frames.find((f) => f.cut).u) < 0.07, `${weapon} 사람 원전 꼴: 鞘引き 끝 = 칼집을 떠나 맞음 · 잔상이 켜지는 몫`);
  }
  for (const [weapon, guard] of [['uchigatana', 'langort'], ['uchigatana', 'ochsR'], ['monohoshizao', 'langort']]) {
    const on = shot({ weapon, guard });
    const off = withS(OFF, () => shot({ weapon, guard }));
    assert.equal(on.sum.far, off.sum.far, `${weapon} ${guard} 뽑는 길 시작 같음`);
    assert.equal(on.hit?.part, off.hit?.part, `${weapon} ${guard} 맞는 곳`);
    assert.ok(Math.abs(on.hit.E - off.hit.E) < 1, `${weapon} ${guard} 판정 에너지`);
    assert.ok(Math.abs(on.sum.tipCut.len - off.sum.tipCut.len) < 0.02 && Math.abs(on.sum.tipCut.devShare - off.sum.tipCut.devShare) < 0.01, `${weapon} ${guard} 칼끝 길`);
    assert.ok(Math.abs(on.sum.tipVmax - off.sum.tipVmax) < 1, `${weapon} ${guard} 칼끝 빠르기`);
    assert.ok(Math.abs(on.sum.hold.elev - off.sum.hold.elev) < 2 && Math.abs(on.sum.hold.flex - off.sum.hold.flex) < 2, `${weapon} ${guard} 굳음 칼 · 팔`);
  }
  const held = shot({ start: 'held' });
  assert.ok(held.sum.preOff.sayaW === 0 && held.sum.sayaUB == null, '칼자루를 쥔 채 낸 발도는 鞘引き 놓기 없음 (11/13 그대로)');
});

test('④ 두 손으로 돌아오는 때 — 풀기(振りかぶり) 동안 시작 · 鞘戻し 점을 풀기 끝에 지남 · 굳음 · 풀기 길이 그대로 · 튐 없음', () => {
  for (const [weapon, start] of [['uchigatana', 'hip'], ['uchigatana', 'held'], ['uchigatana', 'crouch'], ['monohoshizao', 'hip'], ['kusanagi', 'held']]) {
    const r = shot({ weapon, start });
    const s = r.sum;
    const off = withS(OFF, () => shot({ weapon, start }));
    assert.equal(s.grip.nHold, off.sum.grip.nHold, `${weapon} ${start} 굳음 스텝 수 그대로`);
    assert.equal(s.grip.nFade, off.sum.grip.nFade, `${weapon} ${start} 풀기 스텝 수 그대로`);
    assert.equal(s.rgStart?.ph, 'fade', `${weapon} ${start} 다시 쥐기가 풀기 동안 시작`);
    assert.equal(off.sum.rgStart?.ph, 'free', '끄면 풀기가 끝난 뒤');
    const lastFade = r.frames.filter((f) => f.ph === 'fade').at(-1);
    assert.ok(lastFade.rgK != null && Math.abs(lastFade.rgK - 0.5) < 0.1, `${weapon} ${start} 풀기 끝 = 다시 쥐기 가운데(鞘戻し 점) ${lastFade.rgK}`);
    assert.ok(s.via && s.via.tgt < 0.002, `${weapon} ${start} 빈손 목표가 鞘戻し 점을 지남 ${JSON.stringify(s.via)}`);
    assert.ok(s.via.hand < 0.15, `${weapon} ${start} 빈손이 鞘戻し 점 곁을 지남 ${s.via.hand}`);
    assert.ok(s.offJump.d < 0.08, `${weapon} ${start} 빈손 목표 이웃 스텝 옮김 ${JSON.stringify(s.offJump)} (보통 두 손 싸움 몫 안)`);
    const last = r.frames.filter((f) => f.ph === 'free').at(-1);
    assert.ok(last.grip && last.gap <= s.seatRef + 0.03 && last.rgK == null, `${weapon} ${start} 다시 쥐고 자리 잡음 (틈 ${last.gap})`);
  }
});

test('⑤ 끄면 11/13 판 — 대기 동안 두 손 · 鞘引き 놓기 없음 · 풀기 끝 뒤 곧은 다시 쥐기', () => {
  const r = withS(OFF, () => shot({ start: 'hip' }));
  const s = r.sum;
  assert.ok(s.preGrip && s.preOff.sayaW === 0, '대기 동안 칼자루 끝을 쥠');
  assert.equal(s.sayaUB, null, '鞘引き 놓기 없음');
  assert.equal(s.rgStart?.ph, 'free', '풀기가 끝난 뒤 다시 쥐기');
  const g = SECRET.iaiSayaHip;
  const R = r.frames.filter((f) => f.rgK != null && f.offP);
  // 곧은 섞기: 다시 쥐는 동안 빈손 목표가 왼 허리 → 칼자루 끝 곧은 줄 위 (鞘戻し 점을 지나지 않음)
  assert.ok(Math.min(...R.map((f) => dist3(f.offP, mouthP()))) > 0.02, '鞘戻し 점을 지나지 않음');
  assert.ok(dist3(R[0].offP, [g[0], g[1], -g[2]]) < 0.03, '왼 허리에서 시작');
});
