// 찌르기 박힘 · 무시됨 고침 시제품 · 사람 탭 찌르기 몸 싣기 시험 (사장님 11/15 '지금 찌르기가 좀 이상해. 상대 몸에 박혀서 안 뽑히기도 하고 그러다 칼을 떨어뜨리기도 함.
//  공격이 종종 무시될 때도 있어.' · '베기에 비해 동작이 너무 작고 느린 거 같아 … 모든 찌르기 동작을 강화하고 좀 빠르게 혹은 힘있게' — 기록 docs/strike/thrust_stuck_2026-11-15.md):
//   약화 배율은 상처에만 · 다 쓴 박힘 풀기 · THRUST.drive(사람 탭 찌르기 당김 · 몸 싣기 — AI 는 THRUST.driveAi 따로)
//   11/16 묶음 P(사장님 '묶음 P 넣어.') · drive 3 기본
//  node --test tools/sim/thrust_stuck.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, newRound, DT } from './harness_m.mjs';
import { thrustDrive } from '../../src/skill.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { strokeRun } from './thrust_motion.mjs';

const ST = CONFIG.STRIKE;
const TH = CONFIG.THRUST;
const withSet = (o, vals, fn) => { const old = { ...o }; Object.assign(o, vals); try { return fn(); } finally { Object.assign(o, old); } };

/** 사람 이탈리아 레이피어가 맞닿기 거리(1.72 m)에서 선 상대(칼 아래)를 탭 찌르기 한 번 — 1.2 s 동안 사람 칼 → 상대 몸 판정 · 가르는 칼 장부 */
function tapScene() {
  const hold = CONFIG.ARENA.startHold;
  CONFIG.ARENA.startHold = 0;
  try {
    const kit = kitFromNodes('italian', allNodeIds('italian'));
    const G = newRound({ weapon: 'rapier', weapon2: 'longsword', seed: 1, gap: 1.72, walls: false, kit, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
    const P = G.player, E = G.enemy;
    G.ai.update = () => E.move.set(0, 0);
    for (let t = 0; t < 1.2 * CONFIG.TIME.k; t += DT) { P.move.set(0, 0); E.handOffset.set(0, -0.5); G.step(); }
    const C = G.combat;
    const hits = [];
    const st = C.strike.bind(C);
    C.strike = (pr, point, passing) => { const r = st(pr, point, passing); if (r && pr.w.fighter === P && pr.v.fighter === E) hits.push({ type: r.type, energy: r.energy, physE: r.physE, absorb: r.absorb, stuck: r.stuck, passing, itk: r.itThrust?.k ?? 1 }); return r; };
    P.skill.thrust();
    let spent = 0; // 다 쓴 박힘(끌림 · 붙잡는 시간 끝)이 장부에 남아 있던 스텝 수
    let held = 0;
    for (let i = 0; i < 1.2 * CONFIG.TIME.k / DT; i++) {
      P.move.set(0, 0);
      E.handOffset.set(0, -0.5);
      G.step();
      for (const c of C.cutting.values()) {
        if (c.pr.w.fighter !== P || !c.applied || !c.stuck) continue;
        if (c.stuckT > 0) held++;
        else if (!(c.Eleft > 0)) spent++;
      }
    }
    G.world.free();
    return { hits, spent, held };
  } finally {
    CONFIG.ARENA.startHold = hold;
  }
}

test('기본값: 다 쓴 박힘 풀기 켬(사장님 11/15 결정 \'3-1과 3-2만 해\') · 몸 싣기 3 · 약화 배율 상처만 켬(사장님 11/16 결정 \'묶음 P 넣어.\') — 확인표 4440 ~ 4448 · 4570 ~', () => {
  assert.equal(TH.drive, 3);
  assert.equal(TH.driveChamber, 0.3, '걸음 사다리 0.3');
  assert.equal(TH.driveStep, 0.45, '걸음 사다리 0.45');
});



test('약화 배율(0.8) 찌르기는 physE = 판정 에너지 ÷ 0.8 · 박힘은 physE 로 셈', () => {
  const r = tapScene();
  const s = r.hits.filter((h) => h.itk < 1 && h.type === 'stab');
  assert.ok(s.length > 0);
  for (const h of s) {
    assert.ok(Math.abs(h.physE - h.energy / 0.8) < 1e-9, `physE ${h.physE} energy ${h.energy}`);
    if (h.passing) assert.equal(h.stuck, h.physE <= h.absorb, '박힘은 physE ≤ absorb');
  }
});


test('THRUST.drive: 당김 = 칼끝이 더 빠름 · 몸 싣기 = 칼끝이 더 멀리 (사람 탭 찌르기 · 상대 3 m)', () => {
  const run = (d, school, weapon) => withSet(TH, { drive: d }, () => strokeRun({ school, weapon, kind: 'tap', gap: 'air' }));
  const it0 = run(0, 'italian', 'rapier'), it1 = run(1, 'italian', 'rapier');
  assert.ok(it1.vMax > it0.vMax * 1.3, `이탈리아 당김 ${it0.vMax} → ${it1.vMax}`);
  const de0 = run(0, 'german', 'longsword'), de2 = run(2, 'german', 'longsword');
  assert.ok(de2.tip > de0.tip * 1.5, `독일 몸 싣기 ${de0.tip} → ${de2.tip} cm`);
});

test('THRUST.drive 겹침 막기 (사장님 11/15 \'런지가 이탈리아 보법이나 런지와 겹쳐서 움직임이 이상해지는지 확인 필요\'): 이탈리아 잰 런지 · 걷던 몸은 제 걸음 그대로 · 리솔루토가 탭 런지를 덮지 않음 · 옆걸음 뒤 오래 안 머묾', async () => {
  const { sceneRun } = await import('./thrust_drive_check.mjs');
  const it0 = await sceneRun({ school: 'italian', weapon: 'rapier', scene: 'stand', drive: 0 });
  const it3 = await sceneRun({ school: 'italian', weapon: 'rapier', scene: 'stand', drive: 3 });
  assert.equal(it3.taps[0].reqFwd, it0.taps[0].reqFwd, '이탈리아는 잰 런지 그대로 (0.45 로 바꾸지 않음)');
  const de3 = await sceneRun({ school: 'german', weapon: 'longsword', scene: 'stand', drive: 3 });
  assert.equal(de3.taps[0].reqFwd, 0.45, '선 몸 보통 탭은 몸 싣기 걸음');
  assert.equal(de3.reqs.filter((e) => e.src === 'tap').length, 1, '탭 하나에 걸음 부탁 하나');
  const cn3 = await sceneRun({ school: 'chinese', weapon: 'hwando', scene: 'walk', drive: 3 });
  assert.equal(cn3.taps[0].reqPush, null, '걷던 몸은 몸 실림 없이 (걸음 길이만)');
  const riso = await sceneRun({ school: 'italian', weapon: 'rapier', scene: 'riso', drive: 3 });
  assert.equal(riso.taps[0].an.stack, false, '리솔루토 걸음이 탭 런지를 덮지 않음 (런지를 딛은 뒤 탭이 끝남)');
  const ib = await sceneRun({ school: 'iberian', weapon: 'zweihander', scene: 'side', drive: 3 });
  assert.ok(ib.taps[0].freeze < 0.3, `옆걸음 뒤 탭: 런지 발이 뜨기 전엔 안 머묾 — ${ib.taps[0].freeze} s`);
});
