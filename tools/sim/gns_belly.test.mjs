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

const { SECRET } = CONFIG;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const strip = (r) => JSON.stringify({ ...r, frames: undefined });

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

 // 11/14 그때 판 (스택 · 바위 몸 전 · 3 단계 읽기 · 공정함 전)
