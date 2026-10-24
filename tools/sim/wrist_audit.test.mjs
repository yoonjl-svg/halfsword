// 손목 검사 시험 (10/24 15:5x 사장님 '주먹 아래쪽으로 칼날이 향하도록 거꾸로 쥐고 있는 거 같은데?' · '손목 고침에 새 작업자 붙이고 다른 동작에서도 저런지 검사해' —
//  docs/strike/wrist_audit_2026-10-24.md · tools/sim/wrist_audit.mjs):
//   안다레 리솔루토 런지 · 격살 허파 찌르기(운동학 겨눈 찌름 — SECRET.thrustArm): 맞힌 자세 아래팔-칼 ≤ 135° · 손이 어깨 앞 팔 길이 0.8 이상 · 칼이 새끼 쪽으로 꺾이지 않음(손 면 dev ≥ −30 — AAOS 척측 30) ·
//   굳음 동안도 뻗은 채 · `?thrustArm=0` 은 옛 꼴(손이 어깨 가까이 · 칼이 새끼 쪽으로 75° 넘게 — 거꾸로 쥔 꼴) 그대로 ·
//   시험 JOINTS.elbowSwivel(기본 끔): 끄면 레이피어 1번 자세(프리마)가 오늘처럼 새끼 쪽 · 켜면 척측 한도 안.
//  node --test tools/sim/wrist_audit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { lungeRun, gyeoksalRun, guardsRun, wristSample, ARM_LEN, REV, ULNAR } from './wrist_audit.mjs';

const { SECRET, JOINTS } = CONFIG;
const withSet = (o, k, v, fn) => {
  const old = o[k];
  o[k] = v;
  try {
    return fn();
  } finally {
    o[k] = old;
  }
};
const ph = (T, k) => T.k.get(k);

test('값: 운동학 겨눈 찌름 팔 뻗음 SECRET.thrustArm 1 (기본) · 팔꿈치 돌림 시험 JOINTS.elbowSwivel 0 (기본 끔) · 팔 길이 0.57 m', () => {
  assert.equal(SECRET.thrustArm, 1);
  assert.equal(JOINTS.elbowSwivel, 0);
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

test('10/24 런지 `?thrustArm=0` = 옛 꼴 그대로: 굳음 동안 손이 어깨 앞 팔 길이 0.5 아래 · 칼이 새끼 쪽으로 75° 안팎 (거꾸로 쥔 꼴)', () => {
  withSet(SECRET, 'thrustArm', 0, () => {
    for (const w of ['rapier', 'dartagnan']) {
      const r = lungeRun(w, { gap: 2.2 });
      assert.ok(r.fired && r.res?.ok && r.res.hit, `${w} 런지 · 맞힘`);
      const S = ph(r.T, 'stiff');
      assert.ok(S.aSum / S.n < 0.5, `${w} 옛 굳음 손 앞 평균 ${(S.aSum / S.n).toFixed(2)}`);
      assert.ok(S.devSum / S.n < -60, `${w} 옛 굳음 손 면 dev 평균 ${(S.devSum / S.n).toFixed(0)}°`);
      assert.ok(S.rev / S.n > 0.5, `${w} 옛 굳음 거꾸로 몫 ${((100 * S.rev) / S.n).toFixed(0)} %`);
    }
  });
});

test('격살 허파 찌르기(봉두세)도 같은 길: 굳음 동안 뻗은 채 · 새끼 쪽 아님 — `?thrustArm=0` 은 옛 꼴(새끼 쪽)', () => {
  const now = gyeoksalRun('qinggang', 'bongdu');
  assert.ok(now.fired && now.res?.ok, '격살 허파 찌르기');
  const S = ph(now.T, 'stiff');
  assert.ok(S.aSum / S.n >= 0.85 && S.devSum / S.n >= ULNAR, `굳음 손 앞 ${(S.aSum / S.n).toFixed(2)} · dev ${(S.devSum / S.n).toFixed(0)}`);
  withSet(SECRET, 'thrustArm', 0, () => {
    const old = gyeoksalRun('qinggang', 'bongdu');
    const O = ph(old.T, 'stiff');
    assert.ok(O.aSum / O.n < 0.5 && O.devSum / O.n < -60, `옛 굳음 손 앞 ${(O.aSum / O.n).toFixed(2)} · dev ${(O.devSum / O.n).toFixed(0)}`);
  });
});

test('시험 JOINTS.elbowSwivel: 끄면(기본) 레이피어 1번 자세(프리마)는 칼이 새끼 쪽(오늘 그대로) · 켜면 같은 손 자리에서 척측 한도 안', () => {
  const prima = (T) => [...T.k.entries()].find(([k]) => k.includes('프리마'))?.[1];
  const off = prima(guardsRun('rapier').T);
  assert.ok(off && off.devSum / off.n < REV, `끔: 프리마 dev ${(off.devSum / off.n).toFixed(0)}°`);
  const on = withSet(JOINTS, 'elbowSwivel', 1, () => prima(guardsRun('rapier').T));
  assert.ok(on && on.devSum / on.n >= ULNAR, `켬: 프리마 dev ${(on.devSum / on.n).toFixed(0)}°`);
  assert.ok(Math.abs(on.aSum / on.n - off.aSum / off.n) < 0.1, `손 자리 그대로 ${(off.aSum / off.n).toFixed(2)} → ${(on.aSum / on.n).toFixed(2)}`);
});

test('wristSample: 칼이 없으면 null', () => {
  assert.equal(wristSample({ bodies: {}, sword: null }), null);
});
