// 11/11 끌고 가는 칼 헛맞음 고침 · 리솔루토 런지 미끄러짐 (기록 docs/strike/gk_ghost_2026-11-11.md · 확인표 3540 ~ 3549):
//  1. [사장님 11/11 결정 '격살 오류 고쳐'] SECRET.spendOnWound 1 — '수마다 한 번' 맞음은 상처가 난 닿음만 씀. 격살 허파 찌르기(빠르기 0.7) 멈춘 상대 맞닿기 ± 0.1 m 12 장면에서
//     겨눔 → 찌름을 넘는 스텝의 찌름 첫 조각이 0.3 ~ 0.8 m/s 로 읽혀 3 장면이 칼이 몸을 지나가는데 상처가 없었음 → 다음 스텝 닿음으로 맞음. 0 = 전 판(`?spendOnWound=0`).
//  2. [사장님 11/11 결정 "런지 거리는 0.45로 해, 다른 거리 잴 필요 없어."] 리솔루토 전용 미끄러짐 한도 SECRET.risolutoSlide 0.45 (전 고노센 발도와 같은 iaiStep 0.6 ·
//     `?risoSlide=0.6` = 전 판 바이트 같음 · 고노센 발도는 iaiStep 0.6 그대로).
//  node --test tools/sim/gk_ghost.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound } from './harness_m.mjs';
import { TRADITIONS } from '../../src/schools.js';
import { lungeAt } from './riso_reach.mjs';

const { SECRET } = CONFIG;
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

/** 격살 허파 찌르기 멈춘 상대 맞닿기 −0.1 · 0 · +0.1 m × 상대 칼 넷 (wrist_audit.test.mjs 와 같은 장면) — 장면마다 첫 상처 · 심각도 합 · 문턱 밑 닿음 셈 */
function gkScenes() {
  const out = [];
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
      const S = { gp, fw, first: null, sev: 0, wounds: 0, weak: 0 };
      const pw = g.combat.hooks.onWound;
      g.combat.hooks.onWound = (att, vic, r, ...rest) => {
        pw?.(att, vic, r, ...rest);
        if (att !== p) return;
        S.first ??= r.type;
        S.wounds++;
        S.sev += r.severity ?? 0;
      };
      p.skill.secret({ S: TRADITIONS.chinese.playerSecret, ctx: { slot: 'bongdu', stance: 'bongdu' } });
      for (let i = 0; i < 150 && (p.skill.sec || p.iai); i++) {
        g.step();
        if (p.iai?.kind === 'combo') S.weak = p.iai.weakN ?? 0;
      }
      out.push(S);
    } finally {
      g.world.free();
    }
  }
  return out;
}
const key = (s) => `${s.gp} ${s.fw}`;

test('값: 헛맞음 고침 SECRET.spendOnWound 1 · 리솔루토 미끄러짐 SECRET.risolutoSlide 0.45 (리솔루토 걸음 칸 slide 가 이 열쇠) · 고노센 발도 iaiStep 0.6 그대로 · 격살 0.7 · 1', () => {
  assert.equal(SECRET.spendOnWound, 1);
  assert.equal(SECRET.risolutoSlide, 0.45);
  assert.equal(SECRET.risolutoStep.slide, 'risolutoSlide');
  assert.equal(SECRET.iaiStep, 0.6);
  assert.equal(SECRET.gyeoksal.share, 0.7);
  assert.equal(SECRET.gyeoksalHitMul, 1);
});

test('격살 허파 찌르기 맞닿기 ± 0.1 m 12 장면: 고침 뒤 칼이 몸을 지나가면 모두 상처(찌름 · 첫 맞음 베기 0) — 전 판(spendOnWound 0)은 문턱 밑 첫 조각 닿음이 맞음을 써 상처 없는 장면이 있음', () => {
  const now = gkScenes();
  const old = withSets([[SECRET, 'spendOnWound', 0]], gkScenes);
  const ghostOld = old.filter((s) => s.wounds === 0);
  assert.ok(ghostOld.length >= 1, `전 판 상처 없는 장면 ${ghostOld.map(key).join(' · ')}`);
  for (const s of ghostOld) assert.ok(s.weak >= 1, `전 판 ${key(s)}: 문턱 밑 닿음이 있었음 (${s.weak})`);
  assert.equal(now.filter((s) => s.wounds === 0).length, 0, `고침 뒤 상처 없는 장면 ${now.filter((s) => s.wounds === 0).map(key).join(' · ')}`);
  assert.equal(now.filter((s) => s.first === 'cut').length, 0, '첫 맞음 베기 0 (thrustSweep 이 지키는 성질 그대로)');
  for (const s of ghostOld) {
    const n = now.find((x) => key(x) === key(s));
    assert.equal(n.first, 'stab', `${key(s)}: 고침 뒤 찌름`);
    assert.ok(n.sev > 0, `${key(s)}: 고침 뒤 심각도 ${n.sev}`);
    assert.ok(n.weak >= 1, `${key(s)}: 문턱 밑 닿음은 셈만 (${n.weak})`);
  }
  // 헛맞음이 없던 장면은 그대로 (문턱 밑 닿음이 없으면 고침이 아무것도 바꾸지 않음)
  for (const s of now.filter((x) => x.weak === 0)) {
    const o = old.find((x) => key(x) === key(s));
    assert.deepEqual([s.first, s.wounds, s.sev], [o.first, o.wounds, o.sev], `${key(s)} 그대로`);
  }
});

test('격살 10/24 장면 (빠르기 0.6 · 판정 1.3 — 전 기본): 전 판 헛맞음 1 장면도 고침 뒤 찌름 상처', () => {
  const GK = [[SECRET.gyeoksal, 'share', 0.6], [SECRET, 'gyeoksalHitMul', 1.3]];
  const now = withSets(GK, gkScenes);
  const old = withSets([...GK, [SECRET, 'spendOnWound', 0]], gkScenes);
  assert.ok(old.some((s) => s.wounds === 0), '전 판 상처 없는 장면 있음');
  assert.equal(now.filter((s) => s.wounds === 0).length, 0, '고침 뒤 모두 상처');
  assert.equal(now.filter((s) => s.first === 'cut').length, 0, '첫 맞음 베기 0');
});

test('리솔루토 미끄러짐 `?risoSlide=0.6` = 전 판(걸음 칸 slide 가 고노센 iaiStep) 바이트 같음 — 가까운 · 닿는 끝 · 먼 데', () => {
  for (const gap of [2.0, 2.4, 2.6]) {
    const a = withSets([[SECRET, 'risolutoSlide', 0.6]], () => lungeAt({ gap }));
    const b = withSets([[SECRET, 'risolutoStep', { ...SECRET.risolutoStep, slide: 'iaiStep' }]], () => lungeAt({ gap }));
    assert.deepEqual(a, b, `${gap} m`);
  }
});

test('리솔루토 미끄러짐 0.45 (기본): 몸 미끄러짐 한도 0.45 m · 닿는 끝 = 낸 때 가슴 사이 2.29 m 맞음 · 2.35 m 빗나감 (0.6 판은 2.45 맞음 — 0.15 m 당겨짐) · 가까운 데는 맞닿기에서 멈춤 그대로', () => {
  const near = lungeAt({ gap: 2.0 });
  assert.ok(near.hit && near.sev > 0, `2.0 m 맞음 ${JSON.stringify(near)}`);
  assert.ok(near.slide < 0.45, `2.0 m 미끄러짐 맞닿기에서 멈춤 ${near.slide}`);
  const edge = lungeAt({ gap: 2.25 });
  assert.ok(edge.hit && edge.sev > 0, `2.25 m 맞음 ${JSON.stringify(edge)}`);
  assert.ok(Math.abs(edge.slide - 0.45) < 1e-3, `미끄러짐 한도 ${edge.slide}`);
  const out = lungeAt({ gap: 2.3 });
  assert.equal(out.hit, false, `2.3 m 빗나감 ${JSON.stringify(out)}`);
  assert.ok(out.over < 0, `칼끝 모자람 ${out.over}`);
  const old = withSets([[SECRET, 'risolutoSlide', 0.6]], () => lungeAt({ gap: 2.3 }));
  assert.ok(old.hit, `0.6 판 같은 자리 맞음 ${JSON.stringify(old)}`);
  assert.ok(Math.abs(old.slide - 0.6) < 1e-3, `0.6 판 미끄러짐 ${old.slide}`);
});
