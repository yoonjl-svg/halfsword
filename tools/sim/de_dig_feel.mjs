// ─────────────────────────────────────────────────────────────
//  de_dig_feel.mjs — 독일 보법 II '파고들기' 몸 길 · 거리-시간 (11/14 — 사장님 '간격 잡기를 파고들기로 바꿔 … 두 걸음 빠르게 들어가는 기술 · 거리 제한은 없음' · docs/strike/de_dirty_2026-11-14.md)
//   재기만 한다(게임 값은 이 프로세스 안에서만). 사람 몸(0 번 — humanInput · 독일 롱소드 · 스킬트리 모두)이 서 있다가 스틱을 곧장 앞(1.0)으로 민다 · 상대는 서 있기만(AI 끔).
//   판: walk = 보통 걸음(파고들기 끔 · deDig 0) · chase = 옛 간격 잡기(deDig 0 · 민 순간 상대 헛침을 알림 — 받을 창 · 빠른 디딤 · 칼 거리 잡기) · dig = 파고들기(기본)
//   줄마다: 걸음(뗀 때 · 빠른 걸음인가 · fastK) · 몸 앞 이동(골반 — 0.1 s 마다) · 가슴 사이 · 넘어짐 · 기력(박찬 걸음 push)
//  node tools/sim/de_dig_feel.mjs [--gap=2.6] [--dur=1.5] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, CONFIG } from './harness_m.mjs';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k;
/** 한 판: mode 'walk' | 'chase' | 'dig' · 서 있다 미는 순간부터 dur 실제 초 */
export function digRun({ mode = 'dig', gap = 2.6, dur = 1.5, stick = 1, side = 0, seed = 3, weapon = 'longsword' } = {}) {
  const G0 = CONFIG.GAIT;
  const keep = { deDig: G0.deDig };
  G0.deDig = mode === 'dig' ? 1 : 0;
  const kit = kitFromNodes('german', allNodeIds('german'));
  const G = newRound({ weapon, seed, kit, gap, onFighter(f) { if (f.index === 0) f.humanInput = true; } }); // 사람 입력이 모는 몸 (main.js 플레이어와 같은 표 — 파고들기는 이 몸만)
  try {
    G.ai.update = () => {};
    const P = G.player;
    const A = G.enemy;
    P.move.set(0, 0);
    for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.6) / CONFIG.PHYSICS.timestep); i++) G.step(); // 판 시작 정지 뒤 · 서 있음
    const g = P.gait;
    for (let i = 0; i < 600 && !(g.legs.F.stance && g.legs.B.stance && Math.hypot(g.vf.x, g.vf.z) < 0.1); i++) G.step(); // 두 발이 땅에 · 몸이 멈출 때까지 (자세 고치던 발이 디딤 — 박차기의 '서 있음')
    const x0 = P.bodies.pelvis.translation().x;
    const st0 = P.stamina.spent.push ?? 0;
    const d0 = P.foeDistance();
    if (mode === 'chase') g.foeWhiff(); // 옛 간격 잡기: 상대 헛침을 알림 (받을 창 0.6 s)
    const rows = [];
    const steps = [];
    let prevSwing = new Set();
    let fell = false;
    let minD = d0;
    const T = dur * K;
    for (let t = 0; t <= T + 1e-9; t += CONFIG.PHYSICS.timestep) {
      P.move.set(side, stick);
      P.stickX = side;
      P.stickY = stick;
      G.step();
      const tr = (G.t - 0) / K;
      for (const k of ['F', 'B']) {
        const L = g.legs[k];
        const sw = !L.stance;
        if (sw && !prevSwing.has(k)) steps.push({ t: +(t / K).toFixed(3), leg: k, kind: L.kind ?? null, fastK: +g.fastK.toFixed(3), dig: !!g.digStep, chase: !!g.chaseStep });
        if (sw) prevSwing.add(k);
        else prevSwing.delete(k);
      }
      if (P.state !== 'stand') fell = true;
      minD = Math.min(minD, P.foeDistance());
      const ti = Math.round(t / K / 0.05);
      if (Math.abs(t / K - ti * 0.05) < CONFIG.PHYSICS.timestep / K / 2) rows.push({ t: +(ti * 0.05).toFixed(2), dx: +(P.bodies.pelvis.translation().x - x0).toFixed(3), v: +g.vf.x.toFixed(3), d: +P.foeDistance().toFixed(3), fastK: +g.fastK.toFixed(3), hold: !!g.hold });
      void tr;
    }
    const at = (s) => rows.find((r) => r.dx >= s)?.t ?? null;
    return { mode, gap, stick, side, d0: +d0.toFixed(3), minD: +minD.toFixed(3), fell, push: +((P.stamina.spent.push ?? 0) - st0).toFixed(2), digs: g.digs, digSteps: g.digSteps, held: !!g.hold || g.holdEnd != null, steps, t05: at(0.5), t10: at(1.0), t15: at(1.5), dx03: rows.find((r) => r.t >= 0.3)?.dx ?? null, dx06: rows.find((r) => r.t >= 0.6)?.dx ?? null, dx10: rows.find((r) => r.t >= 1.0)?.dx ?? null, rows };
  } finally {
    G.world.free();
    Object.assign(G0, keep);
  }
}

if (isMain(import.meta.url)) {
  const arg = (k, d) => { const a = process.argv.slice(2).find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const out = [];
  for (const mode of ['walk', 'chase', 'dig']) {
    const r = digRun({ mode, gap: +arg('gap', 2.6), dur: +arg('dur', 1.5) });
    out.push(r);
    console.log(`${mode.padEnd(6)} 처음 가슴 사이 ${r.d0} → 가장 가까이 ${r.minD} · 0.5 m ${r.t05} s · 1.0 m ${r.t10} s · 1.5 m ${r.t15} s · 0.3 s ${r.dx03} · 0.6 s ${r.dx06} · 1.0 s ${r.dx10} m · 박찬 앞 걸음 ${r.digSteps} (파고들기 ${r.digs}) · 기력 push ${r.push} · 잡기 ${r.held} · 넘어짐 ${r.fell}`);
    console.log('   걸음:', r.steps.slice(0, 5).map((s) => `${s.t}s ${s.leg}${s.kind ? ' ' + s.kind : ''} ×${s.fastK}${s.dig ? ' dig' : ''}${s.chase ? ' chase' : ''}`).join(' | '));
  }
  const json = arg('json', null);
  if (json) writeFileSync(json, JSON.stringify(out));
}
