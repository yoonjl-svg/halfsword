// 안다레 리솔루토 11/11 (기록 docs/strike/riso_reach_2026-11-11.md · 확인표 3510 ~ 3519):
//  A [사장님 11/11 결정] '리솔루토는 지금 상태에서 오히려 더 빠르게 하고 역방향의 위력 배율을 주자. 손맛을 살리기 위해. … 리솔루토를 70%로 상향하고 파괴력을 0.5로 해.'
//   — 빠르기 몫 SECRET.risolutoShare 0.7 · 리솔루토만 비기 판정 배율 SECRET.risolutoHitMul 0.5 (다른 비기는 SECRET.hitMul 1.3 그대로 · 런지 · 탭 찌르기 둘 다 · AI 는 리솔루토를 안 씀)
//  B (스위치 · 기본 끔 — 사장님 확인 전) 거리 판단 리솔루토 SECRET.risolutoReach: ① 칼이 떨어진 뒤에도 창 risolutoReachKeep 초 ② 런지 몸 미끄러짐 늘 같은 길이 → 멀리서 내면 빗나감
//  node --test tools/sim/riso_reach.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { playerSecretDef, TRADITIONS } from '../../src/schools.js';
import { risoHitMul, gyeoksalHitMul } from '../../src/skill.js';
import { mordHitMul } from '../../src/mordschlag.js';
import { lungeAt } from './riso_reach.mjs';

const { SECRET } = CONFIG;
const rs = CONFIG.realS;
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const REACH = (keep = 0.4, fixed = 1) => ({ risolutoReach: 1, risolutoReachKeep: rs(keep), risolutoReachFixed: fixed });

/** 창을 열고 곧장 내는 몸 (멈춘 상대 · 판 시작 발 묶임 뒤) — 돌려줌: 낸 요청 · 찌르는 동안 판정 배율 */
function fireOnce({ gap = 2.2, w = 'rapier', foeW = 'longsword', seed = 9 } = {}) {
  const g = newRound({ weapon: w, weapon2: foeW, gap, seed });
  const p = g.player, e = g.enemy;
  g.ai.update = () => {}; p.foe = e; e.foe = p;
  try {
    for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.3) / DT); i++) g.step();
    p.stamina.controller = new PlayerParryGuard(p, e);
    const ps = new PlayerSecretWatch(p, e);
    ps.openWindow({ ev: 'risoluto', path: 'touch', held: 0 });
    const o = ps.fire();
    const ok = p.skill.secret(o);
    const req = p.iaiReq ? { ...p.iaiReq, moves: p.iaiReq.moves.map((m) => ({ ...m, step: { ...m.step } })) } : null;
    const hits = new Set();
    for (let i = 0; i < Math.round(1.2 / DT) && p.skill.sec; i++) {
      g.step();
      if (p.skill.sec?.stage === 'riso' && p.skill.tap) hits.add(p.secretHit);
    }
    return { ok, req, tapHits: [...hits], tap: o && !SECRET.risolutoLunge };
  } finally { g.world.free(); }
}

test("A [사장님 11/11 결정] '리솔루토를 70%로 상향하고 파괴력을 0.5로 해.': 빠르기 몫 0.7 · 리솔루토만 판정 배율 0.5 · 다른 비기 1.3 그대로 · ?risoHitMul=1.3 · null = 다른 비기와 같음", () => {
  assert.equal(SECRET.risolutoShare, 0.7);
  assert.equal(SECRET.risolutoHitMul, 0.5);
  assert.equal(SECRET.hitMul, 1.3, '다른 비기 판정 배율 그대로');
  assert.equal(risoHitMul(), 0.5);
  assert.equal(mordHitMul(), 1, '죽음의 일격 1 (11/11 사장님 \'죽음의 일격도 1.0으로 해.\' — 이 줄은 riso-reach 가지 때 1.3 이었음 · 고노센만 1.3)');
  withCfg({ risolutoHitMul: 1.3 }, () => assert.equal(risoHitMul(), 1.3)); // ?risoHitMul=1.3 = 전 판
  withCfg({ risolutoHitMul: null }, () => assert.equal(risoHitMul(), SECRET.hitMul));
  // 런지 요청 = 빠르기 0.7 · 판정 0.5
  const o = fireOnce();
  assert.equal(o.ok, true);
  assert.equal(o.req.share, 0.7);
  assert.equal(o.req.hitMul, 0.5);
});



test('A: 같은 자리 같은 런지 — 판정 배율 0.5 의 심각도 < 1.3 의 심각도 (판정 에너지 × 배율 · 몸 · 칼 움직임은 같음)', () => {
  const a = withCfg({ risolutoHitMul: 0.5 }, () => lungeAt({ gap: 2.0, seed: 9 }));
  const b = withCfg({ risolutoHitMul: 1.3 }, () => lungeAt({ gap: 2.0, seed: 9 }));
  assert.ok(a.hit && b.hit, '둘 다 맞음');
  assert.equal(a.slide, b.slide);
  assert.equal(a.tipMax, b.tipMax, '칼끝 빠르기 같음');
  assert.ok(a.sev < b.sev, `심각도 0.5: ${a.sev} · 1.3: ${b.sev}`);
  assert.ok(a.bodyE < b.bodyE, `판정 에너지 0.5: ${a.bodyE} · 1.3: ${b.bodyE}`);
});


/** 창 하나를 열고 칼끼리 가까움(feel.touching — bladesNear 가 그대로 읽음)을 nearS 실제 초 동안 주고 그 뒤 떨어뜨림 — 창이 닫힌 때(연 뒤 실제 s) */
function windowLife({ nearS = 0, gap = 4.5, max = 3, onStep = null } = {}) {
  const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap, seed: 9 });
  const p = g.player, e = g.enemy;
  g.ai.update = () => {}; p.foe = e; e.foe = p;
  try {
    for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.3) / DT); i++) g.step();
    p.stamina.controller = new PlayerParryGuard(p, e);
    const ps = new PlayerSecretWatch(p, e);
    ps.openWindow({ ev: 'risoluto', path: 'touch', held: 0 });
    const K = CONFIG.TIME.k;
    let t = 0;
    for (let i = 0; i < Math.round((max * K) / DT); i++) {
      g.step();
      t += DT;
      p.feel.touching = t <= nearS * K + 1e-9; // 가슴 사이 4.5 m — 두 칼은 모양으로는 떨어져 있음(겨눈 칼끼리는 3.8 m 안팎까지 0.15 m 안) · 맞닿음 느낌만 줌
      onStep?.(p, e, t / K);
      ps.update(DT, !!p.skill.sec);
      if (!ps.open) return { closed: t / K, ext: ps.riso.reachExt ?? 0 };
    }
    return { closed: null, ext: ps.riso.reachExt ?? 0 };
  } finally { g.world.free(); }
}

// 11/11 사장님 "런지 거리는 0.45로 해" 뒤에도 아래 둘(B ② · B 켬)은 이 기록을 쓴 때의 장면(리솔루토 미끄러짐 0.6 = 고노센 iaiStep)으로 본다 — 옛 장면 재현 (0.45 판은 gk_ghost.test.mjs)
const SLIDE06 = (fn) => withCfg({ risolutoSlide: 0.6 }, fn);

test('B 켬: 가까우면 맞음 · 먼 데서 내면 칼끝이 모자라 빗나감 (자동 겨눔은 줄만 — 모자란 거리를 메우지 않음)', () => SLIDE06(() => withCfg(REACH(), () => {
  for (const gap of [1.9, 2.2]) {
    const r = lungeAt({ gap });
    assert.ok(r.hit && r.sev > 0, `${gap} m 맞음 ${JSON.stringify(r)}`);
    assert.ok(r.over > 0, `${gap} m 칼끝이 겨눈 곳을 지남 ${r.over}`);
  }
  for (const gap of [2.8, 3.2]) {
    const r = lungeAt({ gap });
    assert.equal(r.hit, false, `${gap} m 빗나감 ${JSON.stringify(r)}`);
    assert.ok(r.over < -0.1, `${gap} m 칼끝 모자람 ${r.over}`);
  }
})));
