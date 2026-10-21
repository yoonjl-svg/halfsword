// 플레이어 고유 동작 (10/13 이어 주기 → 10/14 강화 — src/unique_assist.js · docs/strike/unique_player_2026-10-13.md) 헤드리스 시험.
//  실제 src 를 그대로 돌린다(1/120 s 스텝). 손가락은 60 Hz 프레임마다 패드 m 움직임을 main.js 와 같은 차례로 넣는다:
//   feed(손가락) → 손 목표에 더함(10/13 판은 이어 주는 중엔 안 더함 — holdsHand 가 없으면 running 으로 본다) → handHeld · inputActive → 물리 두 스텝. 상대는 AI 를 끄고 자세 하나로 서 있다.
//  ① 기본 긋기 12 + 가운데 짧은 내려베기 — 유파 다섯 × 단계 4: 어느 고유 동작이 발동했나 (표대로면 맞음)
//  ② 조건 긋기 (앞 긋기 뒤): 겹치기 · 카바치오네 · 츠바메가에시 · 염시 · 자→격 · 위아래 사슬 잇기 — 맞는 조건 / 틀린 조건(대조)
//  ③ 무작위 긋기 (유파마다 N): 대본의 시작 자리·처음 방향으로 정답을 매겨 맞게/잘못/안 발동을 센다
//  ④ 해금 0 · 스위치 끔(?uniqueAssist=0 과 같은 UNIQUE_ASSIST.on 0): 붙이지 않은 판과 칼 자취가 바이트 같은지 (sha256)
//  ⑥ (10/14) 강화 판: 같은 손가락 입력에서 손 목표 궤적이 안 붙인 판과 같은가 · 강화 몫(걸음·몸·끝 힘)이 실제로 얹혔나 · 날 세우기 어긋남(칼날 방향 ↔ 칼 움직임) 끔과 견줌
//  실행: node tools/sim/unique_assist_probe.mjs [무작위 수 (기본 60)]
//        node tools/sim/unique_assist_probe.mjs sweep <유파> [기본 동작 이름] — 맞물림 쓸기(간격 × 상대 손 자리: 첫 긋기 칼끼리 가장 가까운 거리 · 맞물림 · 맞힘)
import { RAPIER, THREE, CONFIG } from './jelly_harness.mjs';
import { Fighter, GROUND_GROUPS } from '../../src/fighter.js';
import { LOOKS } from '../../src/looks.js';
import { Combat } from '../../src/combat.js';
import { PlayerUniqueAssist, PLAYER_UNIQUE } from '../../src/unique_assist.js';
import { playerKit, stageParam } from '../../src/skill_tree_store.js'; // 10/21 스킬트리 (전 skill_books.js)
import { TECH, G } from '../../src/ai_techniques.js';
import crypto from 'node:crypto';
import { segDist } from '../../src/skill.js';

const { PHYSICS, UNIQUE_ASSIST: UA } = CONFIG;
const DT = PHYSICS.timestep;
const FRAME = 2 * DT; // 60 Hz 프레임 = 물리 두 스텝
const NRAND = +(process.argv[2] || 60) || 60;
const WEAPON = { german: 'longsword', italian: 'rapier', iberian: 'zweihander', japanese: 'uchigatana', chinese: 'qinggang' };
const SCHOOLS = Object.keys(WEAPON);
let seed = 7;
const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);

function mk(weapon, { stage = 4, on = 1, attach = true, gap = 2.6, foeGuard = [0, 0.03] } = {}) {
  const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
  world.timestep = DT;
  world.integrationParameters.numSolverIterations = 6;
  const eventQueue = new RAPIER.EventQueue(true);
  const colliderInfo = new Map();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.9).setCollisionGroups(GROUND_GROUPS), ground);
  const scene = new THREE.Scene();
  const player = new Fighter(RAPIER, world, scene, colliderInfo, { index: 0, name: 'P', x: -gap / 2, heading: 0, look: LOOKS.player, weapon, breakSeed: 1 });
  const enemy = new Fighter(RAPIER, world, scene, colliderInfo, { index: 1, name: 'E', x: gap / 2, heading: Math.PI, look: LOOKS.enemy, weapon: 'longsword', breakSeed: 1 });
  player.skill.level = 0.7;
  player.skill.autoGuard = true;
  enemy.handOffset.set(foeGuard[0], foeGuard[1]);
  const hits = [];
  const combat = new Combat(colliderInfo, { onWound: (a, v, r) => hits.push(`${a.name}->${r.zone}`), onClash: () => {} });
  const on0 = UA.on;
  UA.on = on;
  const uq = attach ? new PlayerUniqueAssist(player, { stage }) : null;
  UA.on = on0;
  const R = { world, player, enemy, uq, hits, t: 0, trace: crypto.createHash('sha256'), fired: [], ends: [] };
  R.step = () => {
    player.foe = enemy;
    enemy.foe = player;
    player.faceTarget = enemy.bodies.pelvis.translation();
    enemy.faceTarget = player.bodies.pelvis.translation();
    enemy.handOffset.set(foeGuard[0], foeGuard[1]);
    player.step(DT);
    enemy.step(DT);
    player.cacheState();
    enemy.cacheState();
    world.step(eventQueue, combat.physicsHooks);
    combat.afterStep(world, eventQueue);
    R.t += DT;
    const s = player.sword.translation();
    R.trace.update(`${s.x.toFixed(6)},${s.y.toFixed(6)},${s.z.toFixed(6)};`);
  };
  /** 한 프레임: 손가락 d(패드 m) · 손가락이 닿았나 */
  R.frame = (dx, dy, held) => {
    const u = player.skill.uniq;
    u?.feed(dx, dy, FRAME, false);
    if (!(u ? u.holdsHand ?? u.running : false)) {
      player.handOffset.x += dx;
      player.handOffset.y += dy;
    }
    player.handHeld = held;
    player.inputActive = Math.abs(dx) + Math.abs(dy) > 1e-5;
    const f0 = { ...(uq?.stats.fired ?? {}) };
    const e0 = { ...(uq?.stats.ends ?? {}) };
    R.step();
    R.step();
    if (uq) {
      for (const [k, n] of Object.entries(uq.stats.fired)) if (n > (f0[k] ?? 0)) R.fired.push(k);
      for (const [k, n] of Object.entries(uq.stats.ends)) if (n > (e0[k] ?? 0)) R.ends.push(k);
    }
  };
  R.wait = (s, held = false) => {
    for (let i = 0; i < s / FRAME; i++) R.frame(0, 0, held);
  };
  /** 손가락을 [x,y] 로 v m/s 로 (손 목표 기준 — 이어 주는 중엔 손가락만 간다: 손가락 자리는 따로 센다) */
  R.fx = player.handOffset.x;
  R.fy = player.handOffset.y;
  R.to = (p, v = 4, held = true) => {
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - R.fx;
      const dy = p[1] - R.fy;
      const d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, v * FRAME);
      R.fx += (dx / d) * st;
      R.fy += (dy / d) * st;
      R.frame((dx / d) * st, (dy / d) * st, held);
    }
  };
  /** 손을 p 에 놓고 가만히 (손 목표·거르기·가죽끈까지 그 자리로) */
  R.place = (p, s = 0.8) => {
    const sk = player.skill;
    player.handOffset.set(p[0], p[1]);
    sk.prev.set(p[0], p[1]);
    sk.anchor.set(p[0], p[1]);
    sk.aim.set(p[0], p[1]);
    sk.aimRaw.set(p[0], p[1]);
    sk.aimVel.set(0, 0);
    sk.vel.set(0, 0);
    sk.follow.set(0, 0);
    sk.cutPending = false; // 자세로 돌아가기(autoGuard)가 놓은 자리를 쉴 자세로 옮기지 않게 — 대본의 시작 자리가 곧 긋기 시작 자리
    sk.recovering = false;
    R.fx = p[0];
    R.fy = p[1];
    R.wait(s);
  };
  R.wait(2.2); // 판 시작 정지 (ARENA.startHold) 지나기
  return R;
}

if (process.argv[2] === 'sweep') {
  const school = process.argv[3] || 'german';
  for (const gap of [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4])
    for (const fg of [[0, 0.03], [0.05, 0.25], [-0.1, 0.15], [0.2, 0.2]])
      for (const stage of [0, 3]) {
        const R = mk(WEAPON[school], { stage, gap, foeGuard: fg });
        let md = 9;
        const P = R.player;
        const E = R.enemy;
        const st = R.step;
        R.step = () => {
          st();
          if (P.tipPrev && E.tipPrev) md = Math.min(md, segDist(P.bladePoint(0.1, new THREE.Vector3()), P.tipPrev, E.bladePoint(0.1, new THREE.Vector3()), E.tipPrev));
        };
        const T = TECH.find((t) => t.name === (process.argv[4] || (school === 'german' ? 'zornhau' : 'stichOchs')));
        R.place(T.from);
        md = 9; // 긋기 동안만
        for (const p of T.path) R.to(p, 4, true);
        R.wait(0.15, true);
        console.log(`${school} ${T.name} 간격 ${gap} 상대 손 ${fg} 단계 ${stage}: 긋기 동안 칼 사이 최소 ${md.toFixed(3)} m · 맞물림 ${(R.uq?.cur ?? R.uq?.last)?.bound ?? '-'} · 맞힘 ${(R.uq?.cur ?? R.uq?.last)?.landed ?? '-'} · 상처 ${R.hits.length} · 발동 ${R.fired.join(',') || '-'}`);
      }
  process.exit(0);
}
const expectOf = (school, stage, trig) => (PLAYER_UNIQUE[school] ?? []).find((e) => e.stage <= stage && e.on.some((c) => (trig.tech && c.tech === trig.tech) || (trig.pad && c.pad === trig.pad && c.dir === trig.dir)))?.name ?? null;
const firstFired = (R) => R.fired[0] ?? null;
const tally = { ok: 0, wrong: 0, miss: 0, okNone: 0 };
const judge = (exp, got) => {
  if (exp && got === exp) tally.ok++;
  else if (!exp && !got) tally.okNone++;
  else if (got && got !== exp) tally.wrong++;
  else tally.miss++;
  return exp === got ? 'OK' : got ? (exp ? 'WRONG' : 'FALSE') : 'MISS';
};
const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};

// ── ① 기본 긋기 12 + 가운데 짧은 내려베기 ──
log('## ① 기본 긋기 (단계 4, 손가락 4 m/s, 긋고 0.15 s 쥔 뒤 뗌)');
const BASE = [...TECH.map((t) => ({ name: t.name, from: t.from, path: t.path, trig: { tech: t.name } })), { name: 'langortDown', from: G.langort, path: [[0.02, -0.22]], trig: { pad: 'langort', dir: 'down' } }];
const fireTable = {};
for (const school of SCHOOLS) {
  const row = [];
  for (const b of BASE) {
    const R = mk(WEAPON[school], { stage: 4 });
    R.place(b.from);
    for (const p of b.path) R.to(p, 4, true);
    R.wait(0.15, true);
    R.wait(0.6, false);
    const exp = expectOf(school, 4, b.trig);
    const got = firstFired(R);
    const v = judge(exp, got);
    row.push(`${b.name}:${got ?? '-'}${v === 'OK' ? '' : `(${v} 기대 ${exp ?? '-'})`}${got ? `[${R.ends.join('+')}]` : ''}`);
    (fireTable[school] ??= {})[b.name] = got;
  }
  log(`${school} ${row.join(' · ')}`);
}

// ── ② 조건 긋기 ──
log('\n## ② 조건 긋기 (앞 긋기 뒤 · 두 번 잇기)');
const cond = [];
function scen(label, school, opt, fn, exp) {
  const R = mk(WEAPON[school], opt);
  fn(R);
  const got = R.fired;
  const L = R.uq?.last;
  const ok = exp(got, R);
  cond.push(ok);
  log(`${ok ? 'OK  ' : 'FAIL'} ${school} ${label}: 발동 [${got.join(', ')}] 끝 [${R.ends.join(', ')}]${L ? ` · 앞 긋기 ${L.tech ?? '-'} 맞물림 ${L.bound} 맞힘 ${L.landed}` : ''}`);
  return R;
}
const has = (n) => (g) => g.includes(n);
const not = (n) => (g) => !g.includes(n);
// 독일 겹치기: 왼 분노의 베기(단계 3 에선 이어 주지 않는 기본 긋기 — 굽은 베기 길은 상대 칼 위로 넘어가 맞물림이 거의 없다, sweep 참고)가 상대 칼에 맞물린 뒤
//  곧바로 다음 긋기 (위 왼쪽으로 칼자루를 들었다 → 왼쪽 아래로 다시 침). 맞물림은 물리가 정한다 → 기대 = 첫 긋기가 맞물렸으면 겹치기, 아니면 없음
const firstBound = (R) => (R.uq.cur ?? R.uq.last)?.bound ?? false;
let bindN = 0;
let dupN = 0;
for (const gap of [1.2, 1.4, 1.6, 1.8, 2.0, 2.2]) {
  for (const fg of [[0, 0.03], [0.05, 0.25]]) {
    scen(`왼 분노의 베기 → (맞물림?) → 다음 긋기 (간격 ${gap} · 상대 손 ${fg})`, 'german', { stage: 3, gap, foeGuard: fg }, (R) => {
      R.place(G.tagL);
      R.to([-0.1, 0.14], 4, true);
      R.to(G.wechselR, 4, true);
      R.wait(0.1, true);
      R.b = firstBound(R);
      if (R.b) bindN++;
      R.wait(0.12, false);
      R.to([R.fx - 0.25, R.fy + 0.35], 4, true);
      R.to([R.fx - 0.3, R.fy - 0.3], 4, true);
      R.wait(0.5, false);
      if (R.fired.includes('duplieren')) dupN++;
    }, (g, R) => g.includes('duplieren') === R.b);
  }
}
log(`  (겹치기 시험 12 판: 첫 긋기 맞물림 ${bindN} · 겹치기 발동 ${dupN})`);
scen('대조: 닿지 않는 왼 분노의 베기 뒤 같은 긋기 (간격 4.0)', 'german', { stage: 3, gap: 4.0 }, (R) => {
  R.place(G.tagL);
  R.to([-0.1, 0.14], 4, true);
  R.to(G.wechselR, 4, true);
  R.wait(0.1, true);
  R.wait(0.12, false);
  R.to([R.fx - 0.25, R.fy + 0.35], 4, true);
  R.to([R.fx - 0.3, R.fy - 0.3], 4, true);
  R.wait(0.5, false);
}, not('duplieren'));
// 일본 츠바메가에시: 정수리 베기 헛침(먼 간격) 뒤 위로 이어 그음 / 대조: 앞 정수리 베기 없이 위로 / 아래로
scen('정수리 베기 헛침 → 위로 이어 그음', 'japanese', { stage: 3, gap: 3.2 }, (R) => {
  R.place(G.tag);
  R.to([0.0, 0.14], 4, true);
  R.to(G.alber, 4, true);
  R.wait(0.1, true);
  R.to([0.06, -0.15], 4, true);
  R.to(G.ochsR, 4, true);
  R.wait(0.4, false);
}, has('tsubameGaeshi'));
scen('대조: 앞 정수리 베기 없이 아래에서 위로', 'japanese', { stage: 3, gap: 3.2 }, (R) => {
  R.place(G.alber);
  R.to([0.06, -0.15], 4, true);
  R.to(G.ochsR, 4, true);
  R.wait(0.4, false);
}, not('tsubameGaeshi'));
scen('대조: 정수리 베기 헛침 뒤 1 s 쉬고 위로 (창 밖)', 'japanese', { stage: 3, gap: 3.2 }, (R) => {
  R.place(G.tag);
  R.to([0.0, 0.14], 4, true);
  R.to(G.alber, 4, true);
  R.wait(1.0, true);
  R.to([0.06, -0.15], 4, true);
  R.to(G.ochsR, 4, true);
  R.wait(0.4, false);
}, not('tsubameGaeshi'));
// 이베리아 위아래 사슬: 내려벤 뒤 위로 이어 그음 → 뒷몫 강화 / 뗌 → 앞 긋기만 (10/14: 뒷몫은 플레이어가 이어 그은 긋기에만 — 자동 두 번째 칼 없음)
scen('정수리 베기 → 위로 이어 그음 (사슬 잇기)', 'iberian', { stage: 2, gap: 3.2 }, (R) => {
  R.place(G.tag);
  R.to([0.0, 0.14], 4, true);
  R.to(G.alber, 4, true);
  R.to([0.02, 0.3], 4, true);
  R.wait(0.5, false);
}, (g, R) => g.includes('altibaixo') && (R.uq.stats.ends.chained ?? 0) > 0);
scen('정수리 베기 → 내려벤 뒤 손 뗌 (앞부분만)', 'iberian', { stage: 2, gap: 3.2 }, (R) => {
  R.place(G.tag);
  R.to([0.0, 0.14], 4, true);
  R.to(G.alber, 4, true);
  R.wait(0.6, false);
}, (g, R) => g.includes('altibaixo') && !(R.uq.stats.ends.chained > 0));
// 이탈리아 카바치오네: 황소 찌르기를 시작했다가 짧은 창 안에 꺾음 (단계 3 — 위에서 내려 찌르기로 이어 주던 것을 놓고 그리로)
scen('황소 찌르기 시작 → 곧 오른쪽 아래로 꺾음', 'italian', { stage: 3, gap: 4.0 }, (R) => {
  R.place(G.ochsR);
  R.to([0.15, 0.19], 4, true);
  R.to([0.25, -0.05], 4, true);
  R.to([0.1, -0.1], 4, true);
  R.wait(0.5, false);
}, has('cavazione'));
scen('대조: 황소 찌르기 끝까지 뒤 0.5 s 쉬고 왼쪽 (닿지 않는 간격 4.0)', 'italian', { stage: 3, gap: 4.0 }, (R) => {
  R.place(G.ochsR);
  R.to([0.08, 0.12], 4, true);
  R.to(G.langort, 4, true);
  R.wait(0.5, true);
  R.to([-0.25, 0.0], 4, true);
  R.wait(0.5, false);
}, not('cavazione'));
let bindI = 0;
for (const gap of [1.8, 2.0, 2.2, 2.4]) {
  scen(`황소 찌르기 → (맞물림?) → 왼쪽 긋기 (간격 ${gap})`, 'italian', { stage: 3, gap, foeGuard: [0.0, 0.1] }, (R) => {
    R.place(G.ochsR);
    R.to([0.08, 0.12], 4, true);
    R.to(G.langort, 4, true);
    R.wait(0.15, true);
    R.b = firstBound(R);
    if (R.b) bindI++;
    R.wait(0.1, false);
    R.to([R.fx - 0.25, R.fy - 0.02], 4, true);
    R.wait(0.5, false);
  }, (g, R) => g.includes('cavazione') === R.b);
}
log(`  (카바치오네 맞물림 시험 4 판 가운데 첫 찌르기 맞물림 ${bindI})`);
// 동방 염시: 쟁기 찌르기를 시작했다가 짧은 창 안에 오른쪽 아래로 거둠 / 자→격: 찌른 뒤 가로 긋기
scen('쟁기 찌르기 시작 → 곧 오른쪽으로 거둠', 'chinese', { stage: 3, gap: 2.6 }, (R) => {
  R.place(G.pflugR);
  R.to([0.13, -0.2], 4, true);
  R.to([0.5, -0.26], 4, true);
  R.wait(0.5, false);
}, has('lianchi'));
scen('쟁기 찌르기 → 0.15 s 뒤 가로 왼쪽 긋기 (자→격)', 'chinese', { stage: 4, gap: 2.6 }, (R) => {
  R.place(G.pflugR);
  R.to([0.06, -0.1], 4, true);
  R.to(G.langort, 4, true);
  R.wait(0.15, true);
  R.to([-0.45, 0.06], 4, true);
  R.wait(0.5, false);
}, has('ciji'));
scen('탭 찌르기 → 끝난 뒤 가로 오른쪽 긋기 (자→격)', 'chinese', { stage: 4, gap: 2.0 }, (R) => {
  R.place(G.langort);
  R.player.skill.thrust();
  R.wait(0.6, false);
  R.to([0.4, 0.06], 4, true);
  R.wait(0.5, false);
}, has('ciji'));
scen('대조: 단계 3 — 같은 찌른 뒤 가로 긋기 (자→격 닫힘)', 'chinese', { stage: 3, gap: 2.6 }, (R) => {
  R.place(G.pflugR);
  R.to([0.06, -0.1], 4, true);
  R.to(G.langort, 4, true);
  R.wait(0.15, true);
  R.to([-0.45, 0.06], 4, true);
  R.wait(0.5, false);
}, not('ciji'));
scen('대조: 찌르기 없이 긴 자세에서 가로 긋기', 'chinese', { stage: 4, gap: 2.6 }, (R) => {
  R.place(G.langort);
  R.to([-0.45, 0.06], 4, true);
  R.wait(0.5, false);
}, not('ciji'));
// 놓아 주기: 반대로 크게 그음 (10/14: 새 긋기 — 강화가 끝나고 칼은 손가락 그대로) · 탭 찌르기
scen('반대로 그음: 분노의 베기 강화 중 반대로 그음 → 강화 끝 · 손 목표 = 손가락', 'iberian', { stage: 1, gap: 3.2 }, (R) => {
  R.place(G.tagR);
  R.to([0.3, 0.3], 4, true);
  R.to([0.42, 0.42], 4, true);
  R.handErr = Math.hypot(R.player.handOffset.x - R.fx, R.player.handOffset.y - R.fy);
  R.wait(0.4, false);
}, (g, R) => g.includes('talhoRodeado') && R.ends.includes('done') && R.handErr < 1e-9);
scen('놓아 주기: 이어 주는 중 탭 찌르기 (기존 동작이 먼저)', 'german', { stage: 2, gap: 3.2 }, (R) => {
  R.place(G.tagR);
  R.to([0.36, 0.36], 4, true);
  R.player.skill.thrust();
  R.wait(0.6, true);
  R.wait(0.3, false);
}, (g, R) => g.includes('krumphau') && R.ends.includes('yield'));
scen('막음: 탭 찌르기 도중 분노의 베기 → 발동 없음', 'german', { stage: 2, gap: 3.2 }, (R) => {
  R.place(G.tagR);
  R.player.skill.thrust();
  R.wait(0.05, false);
  R.to([0.12, 0.14], 4, true);
  R.wait(0.6, false);
}, not('krumphau'));
const condOk = cond.filter(Boolean).length;
log(`조건 시험 ${condOk}/${cond.length} 통과`);

// ── ③ 무작위 긋기 ──
log(`\n## ③ 무작위 긋기 (유파마다 ${NRAND} — 시작 자리 패드 원판 안 고르게, 방향 고르게, 길이 0.3~0.55 m, 빠르기 2.5~6 m/s, 단계 4)`);
const randTally = {};
function truth(school, S, D) {
  let pad = null;
  let pd = UA.padRadius;
  for (const [n, p] of Object.entries(G)) {
    if (n === 'kron') continue;
    const d = Math.hypot(S[0] - p[0], S[1] - p[1]);
    if (d <= pd) {
      pd = d;
      pad = n;
    }
  }
  if (!pad) return null;
  const ang = (a, b) => (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(...a) * Math.hypot(...b))))) * 180) / Math.PI;
  const t = TECH.find((x) => x.from === G[pad]);
  const tech = t && ang(D, [t.path[0][0] - t.from[0], t.path[0][1] - t.from[1]]) <= UA.angle ? t.name : null;
  const dir = ang(D, [0, -1]) <= UA.angle ? 'down' : null;
  return expectOf(school, 4, tech ? { tech } : {}) ?? (dir ? expectOf(school, 4, { pad, dir }) : null);
}
for (const school of SCHOOLS) {
  const T = (randTally[school] = { ok: 0, wrong: 0, miss: 0, none: 0, fires: 0 });
  let R = null;
  for (let i = 0; i < NRAND; i++) {
    if (i % 10 === 0) R = mk(WEAPON[school], { stage: 4, gap: 3.4 });
    // 시작: 패드 점 하나 근처(반은 패드 반경 안, 반은 고르게) — 정답이 있는 긋기가 충분히 나오게
    let S;
    if (rnd() < 0.6) {
      const pads = Object.entries(G).filter(([n]) => n !== 'kron');
      const p = pads[Math.floor(rnd() * pads.length)][1];
      const a = rnd() * 2 * Math.PI;
      const r = rnd() * 0.12;
      S = [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    } else {
      const a = rnd() * 2 * Math.PI;
      const r = Math.sqrt(rnd()) * 0.55;
      S = [Math.cos(a) * r, Math.sin(a) * r];
    }
    const a = rnd() * 2 * Math.PI;
    const D = [Math.cos(a), Math.sin(a)];
    const len = 0.3 + rnd() * 0.25;
    const v = 2.5 + rnd() * 3.5;
    const E = [S[0] + D[0] * len, S[1] + D[1] * len];
    const exp = truth(school, S, D);
    R.fired.length = 0;
    R.place(S, 0.9);
    R.to(E, v, true);
    R.wait(0.1, true);
    R.wait(0.5, false);
    const got = R.fired[0] ?? null;
    if (got) T.fires++;
    if (exp && got === exp) T.ok++;
    else if (!exp && !got) T.none++;
    else if (got) {
      T.wrong++;
      log(`  잘못 발동 ${school}: 시작 [${S.map((x) => x.toFixed(2))}] 방향 [${D.map((x) => x.toFixed(2))}] 기대 ${exp ?? '-'} 발동 ${got}`);
    } else {
      T.miss++;
      log(`  안 발동 ${school}: 시작 [${S.map((x) => x.toFixed(2))}] 방향 [${D.map((x) => x.toFixed(2))}] 빠르기 ${v.toFixed(1)} 기대 ${exp}`);
    }
  }
  log(`${school}: 정답 있는 긋기 맞게 발동 ${T.ok} · 잘못 발동 ${T.wrong} · 안 발동 ${T.miss} · 정답 없음·발동 없음 ${T.none} (발동 ${T.fires}/${NRAND})`);
}

// ── ④ 해금 0 · 스위치 끔 = 붙이지 않은 판 (칼 자취 sha256) ──
log('\n## ④ 해금 0 · 스위치 끔 → 지금과 같은가 (기본 긋기 12 를 한 판에 차례로, 칼 자리 자취 sha256 앞 12 자)');
for (const school of SCHOOLS) {
  const run = (opt) => {
    const R = mk(WEAPON[school], { gap: 2.0, ...opt });
    for (const b of BASE) {
      R.place(b.from, 0.5);
      for (const p of b.path) R.to(p, 4, true);
      R.wait(0.1, true);
      R.wait(0.3, false);
    }
    return { h: R.trace.digest('hex').slice(0, 12), attached: !!R.player.skill.uniq, fired: R.fired.length };
  };
  const A = run({ attach: false });
  const B = run({ stage: 0 });
  const C = run({ stage: 4, on: 0 });
  const D = run({ stage: 4 });
  log(`${school}: 안 붙임 ${A.h} · 해금 0 ${B.h}(붙음 ${B.attached}) · 끔 ${C.h}(붙음 ${C.attached}) → ${A.h === B.h && A.h === C.h ? '같음' : '다름'} · (대조) 해금 4 ${D.h} 발동 ${D.fired}`);
}
// ── ⑥ (10/14) 강화 판: 손 목표 궤적 · 강화 몫 · 날 세우기 ──
//  기본 긋기 13 마다 새 판에서(앞 긋기의 걸음·몸 차이가 번지지 않게) 같은 손가락(긋기 + 곧장 반쯤 되긋기 — 잇는 동작의 뒷몫 자리)을 안 붙인 판·붙인 판(단계 4)으로 돌려
//  손가락이 닿은 프레임의 손 목표(handOffset) 차이 · 칼끝(가슴 기준 몸 방향 틀) 차이 · 날 각(칼날 방향 ↔ 칼날 70 % 지점 속도의 칼 축 수직 몫, 그 속도 > 3 m/s 스텝)을 견준다.
//  날 각은 붙인 판이 강화 중인 스텝과 같은 스텝 번호의 안 붙인 판 (같은 손가락이라 같은 때)
log('\n## ⑥ 강화 판: 같은 손가락 입력(긋기마다 새 판) — 손 목표 궤적 차이 · 강화 몫 · 날 세우기');
const edgeAng = (f) => {
  const v = f.hitPointVel;
  if (!v || v.length() < 3) return null;
  const q = f.sword.rotation();
  const Q = new THREE.Quaternion(q.x, q.y, q.z, q.w);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(Q);
  const e = new THREE.Vector3(1, 0, 0).applyQuaternion(Q);
  const p = v.clone().addScaledVector(ax, -v.dot(ax));
  if (p.length() < 1e-3) return null;
  return (Math.acos(Math.min(1, Math.abs(p.normalize().dot(e)))) * 180) / Math.PI;
};
const yawInv = new THREE.Quaternion();
const sixRun = (school, b, opt) => {
  const R = mk(WEAPON[school], { gap: 2.0, ...opt });
  const H = [];
  const T = [];
  const A = [];
  const busy = [];
  let bodyMax = 0;
  let powMax = 1;
  let on = false;
  const st = R.step;
  R.step = () => {
    st();
    if (!on) return;
    A.push(edgeAng(R.player));
    busy.push(!!R.uq?.running);
    const ub = R.player.skill.uniqBody;
    if (ub) bodyMax = Math.max(bodyMax, Math.abs(ub.chestYaw));
    powMax = Math.max(powMax, R.player.powerMul ?? 1);
  };
  const fr = R.frame;
  R.frame = (dx, dy, held) => {
    fr(dx, dy, held);
    if (!on || !held) return;
    const P = R.player;
    H.push([P.handOffset.x, P.handOffset.y]);
    const s = P.sword.translation();
    const c = P.bodies.chest.translation();
    yawInv.copy(P.yaw).invert();
    const tip = new THREE.Vector3(s.x - c.x, s.y - c.y, s.z - c.z).applyQuaternion(yawInv);
    T.push([tip.x, tip.y, tip.z]);
  };
  R.place(b.from, 0.6);
  on = true;
  for (const p of b.path) R.to(p, 4, true);
  const e = b.path[b.path.length - 1];
  R.to([(b.from[0] + e[0]) / 2, (b.from[1] + e[1]) / 2], 4, true);
  R.wait(0.15, true);
  R.wait(0.3, false);
  return { H, T, A, busy, bodyMax, powMax, S: R.uq?.stats, fired: R.fired.length };
};
const six = { n: 0, s2: 0, mx: 0, t2: 0, tmx: 0, eaOn: [], eaOff: [] };
for (const school of SCHOOLS) {
  const Z = { n: 0, s2: 0, mx: 0, t2: 0, tmx: 0, eaOn: [], eaOff: [], fired: 0, chained: 0, steps: 0, power: 0, bodyMax: 0, powMax: 1 };
  for (const b of BASE) {
    const on = sixRun(school, b, { stage: 4 });
    if (!on.fired) continue;
    const off = sixRun(school, b, { attach: false });
    Z.fired += on.fired;
    Z.chained += on.S?.ends?.chained ?? 0;
    Z.steps += on.S?.steps ?? 0;
    Z.power += on.S?.power ?? 0;
    Z.bodyMax = Math.max(Z.bodyMax, on.bodyMax);
    Z.powMax = Math.max(Z.powMax, on.powMax);
    for (let i = 0; i < Math.min(off.H.length, on.H.length); i++) {
      const d = Math.hypot(off.H[i][0] - on.H[i][0], off.H[i][1] - on.H[i][1]);
      const dt = Math.hypot(off.T[i][0] - on.T[i][0], off.T[i][1] - on.T[i][1], off.T[i][2] - on.T[i][2]);
      Z.n++;
      Z.s2 += d * d;
      Z.mx = Math.max(Z.mx, d);
      Z.t2 += dt * dt;
      Z.tmx = Math.max(Z.tmx, dt);
    }
    for (let i = 0; i < Math.min(off.A.length, on.A.length); i++) {
      if (!on.busy[i] || on.A[i] == null || off.A[i] == null) continue;
      Z.eaOn.push(on.A[i]);
      Z.eaOff.push(off.A[i]);
    }
  }
  for (const k of ['n', 's2', 't2']) six[k] += Z[k];
  six.mx = Math.max(six.mx, Z.mx);
  six.tmx = Math.max(six.tmx, Z.tmx);
  six.eaOn.push(...Z.eaOn);
  six.eaOff.push(...Z.eaOff);
  const ea = (xs) => (xs.length ? `${(xs.reduce((x, y) => x + y, 0) / xs.length).toFixed(1)}° (칼 면 > 45° ${((100 * xs.filter((x) => x > 45).length) / xs.length).toFixed(0)} %)` : '-');
  log(`${school}: 손 목표 차이 RMS ${Math.sqrt(Z.s2 / Math.max(1, Z.n)).toExponential(2)} · 최대 ${Z.mx.toExponential(2)} 패드 m · 칼끝 차이 RMS ${Math.sqrt(Z.t2 / Math.max(1, Z.n)).toFixed(3)} · 최대 ${Z.tmx.toFixed(3)} m (${Z.n} 프레임) · 발동 ${Z.fired} · 이음 ${Z.chained} · 걸음 ${Z.steps} · 끝 힘 창 ${Z.power} (최대 ×${Z.powMax.toFixed(2)}) · 몸 가슴 최대 ${((Z.bodyMax * 180) / Math.PI).toFixed(1)}° · 날 각(강화 중 ${Z.eaOn.length} 스텝) 붙임 ${ea(Z.eaOn)} / 안 붙임 ${ea(Z.eaOff)}`);
}
{
  const ea = (xs) => (xs.length ? `${(xs.reduce((x, y) => x + y, 0) / xs.length).toFixed(1)}° (칼 면 > 45° ${((100 * xs.filter((x) => x > 45).length) / xs.length).toFixed(1)} %)` : '-');
  log(`합: 손 목표 차이 RMS ${Math.sqrt(six.s2 / Math.max(1, six.n)).toExponential(2)} · 최대 ${six.mx.toExponential(2)} · 칼끝 차이 RMS ${Math.sqrt(six.t2 / Math.max(1, six.n)).toFixed(3)} · 최대 ${six.tmx.toFixed(3)} m · 날 각(${six.eaOn.length} 스텝) 붙임 ${ea(six.eaOn)} / 안 붙임 ${ea(six.eaOff)}`);
}

log("\n## ⑤ 해금 (10/21 스킬트리 — skill_tree_store.js playerKit: 고유 공격 칸 하나 = 기술 하나)");
{
  const none = { german: new Set() };
  const kitText = (k) => (k ? `고유 공격 [${[...k.unique].join(', ')}] · 이점 [${[...k.perk].join(', ')}]` : 'null');
  for (const raw of [null, '0', '1', '2', '3', '4', '5', '6']) {
    const upTo = stageParam(raw);
    log(`?uniqueStage=${raw ?? '(없음)'} → 급 ${upTo ?? '익힌 칸'} · ${kitText(playerKit('german', none, { upTo }))}`);
  }
  const some = { german: new Set(['G1', 'G5', 'G8']) };
  log(`익힌 칸 독일 G1 · G5 · G8 → ${kitText(playerKit('german', some))} · 테스트 경로 ${kitText(playerKit('german', none, { test: true }))} · 무유파 ${playerKit('none', some)}`);
}
log(`\n합계 ① 기본 긋기: 맞게 발동 ${tally.ok} · 정답 없음·발동 없음 ${tally.okNone} · 잘못 발동 ${tally.wrong} · 안 발동 ${tally.miss}`);
