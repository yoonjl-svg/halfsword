// 고노센 배 높이 길 시험 (11/06 사장님 '그래 배 쪽으로 재봐. 사선 베기의 모양도 지금보다는 완만해져도 돼' · 기록 docs/strike/gns_belly_2026-11-06.md · 확인표 3450 ~)
//  ① SECRET.iaiBelly 기본 켬(11/08 사장님 '고노센 배 길도 본판에 넣어') · 지금 길(iaiPathRise) 값 그대로 · 배 길의 뽑는 자리 B = 지금 B
//  ② 끔 = 지금 판 그대로: 배 길 값을 어떻게 바꿔도 끈 판의 발도는 같음 · 발도 길 = iaiPathRise
//  ③ 켬 = 선 사람 발도만 배 길 (AI 발도 · 웅크림 판 사람은 지금 길) · 서 있는 과녁(롱소드 긴 자세)에서 첫 닿음이 배 · 칼이 상대 배 높이로 가운데 줄을 지남 ·
//     한 팔 다 펴짐 · 칼이 땅 · 제 다리에 안 닿음 · 끝까지 서 있음 (롱소드 AI 간 보는 자세 아홉 모두)
//  ④ 싸움 꽂개(gns_belly.mjs bellyProbe)는 읽기만 · 씨앗 6 고노센 — 끔 팔 · 켬 배
//  node --test tools/sim/gns_belly.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { standShot, guardsOf, bellyProbe } from './gns_belly.mjs';
import { withArmOld } from './arm_real_pin.mjs'; // 11/12 팔 사람 꼴 — 옛 장면은 잰 때 팔로 (docs/strike/arm_real_2026-11-12.md §10)
import { withJpOld } from './jp_tank_pin.mjs'; // 11/14 일본 스택 · 바위 몸 — 옛 장면은 잰 때 판으로 (docs/strike/jp_tank_2026-11-14.md §5)

const { SECRET } = CONFIG;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const strip = (r) => JSON.stringify({ ...r, frames: undefined });

test('기본값: iaiBelly 켬 (11/08 사장님) · 전 올려베기 길 값 그대로 · 배 길 B = 전 B', () => {
  assert.equal(SECRET.iaiBelly, 1);
  assert.equal(SECRET.iaiRise, 1);
  const R = SECRET.iaiPathRise;
  assert.deepEqual([R.M.hand, R.M.yaw, R.M.el], [[0.5, 0.02, 0.04], 0, 12]);
  assert.deepEqual([R.E.hand, R.E.yaw, R.E.el], [[0.4, 0.34, 0.4], 70, 38]);
  assert.deepEqual(SECRET.iaiPathBelly.B, R.B, '뽑는 자리 그대로');
  assert.deepEqual(SECRET.iaiPathBelly.E.body, R.E.body, '끝 몸 그대로');
  const B = SECRET.iaiPathBelly;
  assert.ok(B.M.hand[1] < R.M.hand[1] && B.M.el < R.M.el, '가운데가 낮고 칼날 오름이 작음');
  assert.ok(B.E.hand[1] < R.E.hand[1] && B.E.el < R.E.el, '끝이 낮고 칼날 오름이 작음 (완만)');
  assert.ok(B.E.el > B.M.el && B.E.hand[1] > B.B.hand[1], '그래도 올려 벰 (왼 아래 → 오른 위)');
});

// 11/13 사람 발도 원전 꼴(SECRET.iaiReal — docs/strike/iai_real_2026-11-13.md)은 선 사람 발도 길을 iaiPathReal 로 바꿈 — 배 길을 잰 이 장면들은 그때 판(iaiReal 0)으로 묶음 (§7)
test('끔 = 전 판: 배 길 값을 바꿔도 끈 판 발도는 바이트 같음', () => withCfg({ iaiBelly: 0, iaiReal: 0 }, () => {
  const a = standShot({ foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3 });
  const keep = SECRET.iaiPathBelly;
  try {
    SECRET.iaiPathBelly = { B: keep.B, M: { hand: [0.3, -0.5, 0.3], yaw: 10, el: -30 }, E: { hand: [0.1, -0.5, 0.1], yaw: 0, el: -40, body: keep.E.body } };
    const b = standShot({ foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3 });
    assert.equal(strip(b), strip(a));
  } finally {
    SECRET.iaiPathBelly = keep;
  }
  assert.equal(a.first?.zone, 'chest', `끈 판 첫 닿음 ${a.first?.zone}`);
}));

test('켬: 선 사람 발도 — 첫 닿음 배 · 가운데 줄이 배 높이 · 팔 다 펴짐 · 칼이 땅 · 제 다리에 안 닿음 · 서 있음', () => {
  const off = withCfg({ iaiBelly: 0, iaiReal: 0 }, () => standShot({ foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3 }));
  const on = withCfg({ iaiBelly: 1, iaiReal: 0 }, () => standShot({ foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3 }));
  assert.equal(on.first?.zone, 'abdomen', `첫 닿음 ${on.first?.zone}`);
  const ab = on.foeY.abdomen;
  assert.ok(on.crossY > ab - 0.07 && on.crossY < ab + 0.07, `가운데 줄 ${on.crossY} · 배 ${ab} ± 0.07`);
  assert.ok(on.crossY < off.crossY - 0.1, `끈 판보다 낮게 ${off.crossY} → ${on.crossY}`);
  assert.ok(on.ext.M >= 0.95 && on.ext.E >= 0.95, `팔 펴짐 ${on.ext.M} · ${on.ext.E}`);
  assert.ok(on.minY > 0.3, `칼 가장 낮은 점 ${on.minY} m`);
  assert.ok(on.legGap > 0.03, `제 다리 · 골반 틈 ${on.legGap} m`);
  assert.equal(on.stand, true);
});

test('켬: 롱소드 AI 간 보는 자세 아홉 모두 — 칼이 땅 · 제 다리에 안 닿음 · 서 있음 · 가슴에 먼저 닿지 않음', () => {
  withCfg({ iaiBelly: 1 }, () => {
    for (const g of guardsOf('longsword')) {
      const r = standShot({ foeW: 'longsword', guard: g.name, start: 'guard', gapAdd: 0.3 });
      assert.ok(r.minY > 0.3 && r.legGap > 0.03, `${g.name}: 낮은 점 ${r.minY} · 다리 틈 ${r.legGap}`);
      assert.equal(r.stand, true, `${g.name}: 서 있음`);
      assert.ok(r.first && r.first.zone !== 'chest' && r.first.zone !== 'neck', `${g.name}: 첫 닿음 ${r.first?.zone}`);
    }
  });
});

test('켬이어도 AI 발도(웅크린 대기에서 req.player 아님) · 웅크림 판 사람은 지금 길', () => {
  const a = withCfg({ iaiBelly: 0 }, () => standShot({ foeW: 'longsword', guard: 'langort', start: 'crouch', gapAdd: 0.3 }));
  const b = withCfg({ iaiBelly: 1 }, () => standShot({ foeW: 'longsword', guard: 'langort', start: 'crouch', gapAdd: 0.3 }));
  assert.equal(strip(b), strip(a), 'AI 발도 그대로');
  const c = withCfg({ gnsCrouch: 1, iaiBelly: 0 }, () => standShot({ foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3 }));
  const d = withCfg({ gnsCrouch: 1, iaiBelly: 1 }, () => standShot({ foeW: 'longsword', guard: 'langort', start: 'hip', gapAdd: 0.3 }));
  assert.equal(strip(d), strip(c), '웅크림 판 사람 그대로');
});

test('싸움 꽂개는 읽기만 · 씨앗 6 고노센 — 끔 팔 · 켬 배', () => withJpOld(() => withArmOld(() => {
  // 씨앗 6 판은 11/12 두 팔 엇갈림 막기(SKILL.armClear) 전 팔로 — 켠 판은 이 씨앗이 14 s 안에 고노센을 안 냄 (기록 arm_real §10)
  const o = { school: 'japanese', weapon: 'uchigatana', opp: 'longsword', seed: 6, dur: 14 };
  const a = withCfg({ iaiBelly: 0, iaiReal: 0 }, () => fightOne(o));
  const b = withCfg({ iaiBelly: 0, iaiReal: 0 }, () => fightOne({ ...o, probe: bellyProbe() }));
  assert.equal(JSON.stringify({ ...b, probe: undefined }), JSON.stringify(a));
  assert.equal(b.probe.gns.length, 1, '이 씨앗은 14 s 안에 고노센을 냄');
  assert.equal(b.probe.gns[0].first, 'arm', `끔 — ${b.probe.gns[0].first}`);
  const c = withCfg({ iaiBelly: 1, iaiReal: 0 }, () => fightOne({ ...o, probe: bellyProbe() }));
  assert.equal(c.probe.gns[0].first, 'abdomen', `켬 — ${c.probe.gns[0].first}`);
}, ['armClear']))); // 11/14 그때 판 (스택 · 바위 몸 전)
