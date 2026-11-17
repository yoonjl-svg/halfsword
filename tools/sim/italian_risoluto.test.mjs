// 이탈리아 거침없이 나아가 찌르기 (안다레 리솔루토 — 10/22 사람 먼저 · docs/strike/italian_risoluto_2026-10-22.md):
//  덮음은 칼 모양(내 손 쪽 절반 ↔ 상대 칼끝 쪽 절반 가장 가까운 거리) · 덮인 채 나아가기 셈 · 창 · 두 번째 길(상대 박자) · 실제 몸에서 실행(탭 찌르기 · 상대 팔 늦춤 · 비기 배율 · 굳음) · AI 는 닫힘.
//  10/23 넓은 판정(기본 — 칼 어느 부위든 · 너그러움 0.2 s · 가슴 사이 조건 없음 · 다 붙음 · 상대 박자 켬) · 10/22 판(?risoWide=0 = OLD)은 그 판으로 시험.
//  10/24 런지(기본 — 운동학 찌르기 · 고노센 칼끝 빠르기 · 몸 미끄러짐 + 앞발 런지 · 팔 늦춤 0.6 · 굳음 0.6) · 10/23 탭 찌르기 판(?risoLunge=0 = TAP1023)은 그 판으로 시험.
//  node --test tools/sim/italian_risoluto.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { coverDist, bladesNear, RisolutoWatch, lungeGap, lungeGapOk, foeStep, mirrorOk } from '../../src/italian_risoluto.js';
import { MEASURED } from '../../src/weapon_measured.js'; // 10/25 이탈리아 간격 판 THRUST.itMeasure (old 기본 · contact · full — IT_MEASURE=…)
import { PlayerSecretWatch, playerSecretOf } from '../../src/secret.js';
import { playerSecretDef, TRADITIONS } from '../../src/schools.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { iaiTipSpeed, stanceSpread } from '../../src/secret_instant.js';

const { SECRET } = CONFIG;
const rs = CONFIG.realS; // 표준 시간 (10/25 22:3x): 적힌 0.6 · 0.2 · 0.4 s 는 실제 초 — 게임 초 = × 1.1
const keep = (o, k, v, fn) => { const old = o[k]; o[k] = v; try { return fn(); } finally { o[k] = old; } };
const withCfg = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const withJ = (vals, fn) => { const J = CONFIG.JOINTS, old = {}; for (const k of Object.keys(vals)) (old[k] = J[k]), (J[k] = vals[k]); try { return fn(); } finally { Object.assign(J, old); } }; // 손목 값 (10/24 17:2x)
const OLD = { risolutoAnyPart: 0, risolutoGrace: 0, risolutoClosing: 1, risolutoClose: 0, risolutoBeat: 0, risolutoTouch: 0, risolutoMirror: 0 }; // 10/22 판 (main.js ?risoWide=0 과 같은 값 — 10/28 상대 걸음 맞춤도 끔)
const PRE1028 = { risolutoMirror: 0, risolutoClose: 1 }; // 10/25 21:0x 판 (main.js ?risoMirror=0 과 같은 값 — 스틱만 · 다 붙음 창 켬)
const HOLD1024 = { risolutoTouch: 0 }; // 10/24 판 창 규칙 — 이어짐 0.6 s 를 기다림 (main.js ?risoTouch=0 과 같은 값 · 10/25 칼끝 얽힘 창 전)
const TAP1023 = { risolutoLunge: 0, risolutoArmSlow: null, risolutoStiff: null }; // 10/23 탭 찌르기 판 (main.js ?risoLunge=0 과 같은 값)

// 가짜 몸 — 칼은 a(손 쪽 0) → b(칼끝 1) 선분
const blade = (a, b) => (t, out = new THREE.Vector3()) => out.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
function fake({ foeA = [1.4, 1.03, 0.4], foeB = [0.2, 1.03, -0.4] } = {}) {
  const me = { armed: true, alive: true, stickX: 0, stickY: 1, skill: {}, stamina: {}, aiControlled: false, gap: 2, bladePoint: blade([0.3, 1, 0], [1.4, 1, 0]) };
  const foe = { armed: true, alive: true, skill: {}, stamina: {}, aiControlled: true, aiCtl: { mode: 'watch', phase: 'ready' }, move: { x: 0, y: -1 }, bladePoint: blade(foeA, foeB) }; // move: 상대가 물러서는 중 (10/28 상대 걸음에 맞춰 — 내 스틱 앞과 맞음)
  me.foeDistance = () => me.gap;
  return { me, foe };
}
const tick = (W, f, n, step = -0.01) => { let r = null; for (let i = 0; i < n && !r; i++) { f.me.gap += step; r = W.tick(DT, true); } return r; };

test('덮음 거리 = 내 칼 손 쪽 절반 ↔ 상대 칼 칼끝 쪽 절반 (모양 — 닿음이 아님)', () => {
  // 상대 칼끝 쪽 절반(0.5 = [0.8, 1.03, 0] → 칼끝 [0.2, 1.03, −0.4])이 내 손 쪽 절반(x 0.3 → 0.85) 위 3 cm 를 엇갈려 지나감 → 0.03
  const { me, foe } = fake();
  assert.ok(Math.abs(coverDist(me, foe) - 0.03) < 1e-6);
  // 상대 칼끝 쪽이 내 칼 끝 쪽 절반 곁에만 있는 자리(내 약한 쪽) → 덮음 아님
  const weak = fake({ foeA: [2.4, 1.02, 0.4], foeB: [1.2, 1.02, -0.4] });
  assert.ok(coverDist(weak.me, weak.foe) > SECRET.risolutoCover);
  // 칼이 없으면 덮음 없음
  assert.equal(coverDist({ ...me, armed: false }, foe), Infinity);
  assert.equal(SECRET.risolutoCover, 0.15); // 사장님 10/25 21:0x '칼끼리 닿아 있거나 15cm 이내에' (전 0.07 — `?risoCover=0.07`)
});

// 11/11 사장님 '리솔루토를 70%로 상향하고 파괴력을 0.5로 해.' (SECRET.risolutoHitMul 0.5): 이 시험은 10/23 판 장면 그대로라 그 판 배율 1.3 으로 묶음 — 기본 배율 0.5 는 riso_reach.test.mjs


// 10/24 런지 — 상대는 멈춤 · 판 시작 발 묶임(ARENA.startHold) 뒤 · 창을 열어 탭 하나
// 10/24 13:2x · 13:4x 간격 조건: 런지는 가슴 사이 ≥ 맞닿기 거리(레이피어 1.54 · 달타냥 1.39 m)에서만 — 시험 판은 그 밖 2.2 m 에서 연다
function lungeRun(w, { gap = 2.2, seed = 9, foeW = 'longsword', cfg = {} } = {}) {
  return withCfg(cfg, () => {
    const g = newRound({ weapon: w, weapon2: foeW, gap, seed });
    const p = g.player, e = g.enemy;
    g.ai.update = () => {}; p.foe = e; e.foe = p;
    try {
      for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.3) / DT); i++) g.step();
      const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
      const ps = new PlayerSecretWatch(p, e);
      ps.openWindow({ ev: 'risoluto', path: 'close', held: 0.6 });
      const out = { w, gap0: p.foeDistance(), clinch: p.swordArt.measure.clinch, gon: iaiTipSpeed(p), spent0: p.stamina.spent.attack, secret0: p.stamina.spent.secret, tipV: 0, stiffT: null, stiffSteps: 0, held: false, drew: false, gaitReq: null, spread0: stanceSpread(p), standAll: true, tilt: 0, wounds: [] };
      const pel0 = new THREE.Vector3().copy(p.bodies.pelvis.translation());
      g.onWound = (a, v, r) => { if (a === p) out.wounds.push(r); };
      const o = ps.fire();
      out.name = o.S.name;
      out.ok = p.skill.secret(o);
      out.stage0 = p.skill.sec?.stage; out.lunge = !!p.skill.sec?.lunge; out.tap = !!p.skill.tap;
      out.req = p.iaiReq ? { ...p.iaiReq, moves: p.iaiReq.moves.map((m) => ({ ...m })) } : null;
      out.armSlow = e.flowRecovery?.duration ?? null; out.lungeT = p.lungeT ?? 0;
      out.spentAttack = p.stamina.spent.attack - out.spent0; out.spentSecret = p.stamina.spent.secret - out.secret0;
      let prev = p.bladePoint(1, new THREE.Vector3());
      for (let i = 0; i < Math.round(1.5 / DT) && p.skill.sec; i++) {
        const comboBefore = p.iai?.kind === 'combo';
        g.step();
        const tip = p.bladePoint(1, new THREE.Vector3());
        if (comboBefore) out.tipV = Math.max(out.tipV, tip.distanceTo(prev) / DT);
        prev = tip;
        out.gaitReq ??= p.gait?.req ? { kind: p.gait.req.kind, fwd: p.gait.req.fwd, draw: !!p.gait.req.draw, push: p.gait.req.push ?? 1, accel: !!p.gait.req.accel } : null;
        if (p.skill.sec?.stage === 'stiff') {
          out.stiffT = p.skill.sec.stiffT; out.stiffSteps++;
          out.held ||= p.iaiHoldT > 0 && p.skill.thrustPose.w === 1;
          out.phase = p.skill.secretPhase;
          out.res ??= p.skill.sec.lungeRes;
        }
        out.drew ||= !!p.gait?.drawPending || p.gait?.legs?.F?.kind === 'draw' || p.gait?.legs?.B?.kind === 'draw';
        out.standAll &&= p.state === 'stand';
        const ch = p.bodies.chest.translation(), pl = p.bodies.pelvis.translation();
        out.tilt = Math.max(out.tilt, (Math.atan2(Math.hypot(ch.x - pl.x, ch.z - pl.z), ch.y - pl.y) * 180) / Math.PI);
      }
      const pl = p.bodies.pelvis.translation();
      out.pelMove = Math.hypot(pl.x - pel0.x, pl.z - pel0.z);
      out.end = p.skill.sec;
      // 10/24 14:0x 되돌아오기: 굳음이 끝난 뒤 · 몸이 다 실리면 앞발을 뒤로 거둠 (1 s 더 보며 그 걸음 · 두 발 간격 · 가슴 사이)
      out.spreadMax = stanceSpread(p);
      out.gapLunge = p.foeDistance();
      for (let i = 0; i < Math.round(1.0 / DT); i++) {
        g.step();
        out.recReq ??= p.gait?.req && p.gait.req.fwd < 0 ? { kind: p.gait.req.kind, fwd: p.gait.req.fwd, accel: !!p.gait.req.accel } : null;
        out.spreadMax = Math.max(out.spreadMax ?? 0, out.recReq ? 0 : stanceSpread(p) ?? 0);
        out.standAll &&= p.state === 'stand';
      }
      out.recovered = p.lungeRecovered ?? null;
      out.spreadEnd = stanceSpread(p);
      out.gapEnd = p.foeDistance();
      return out;
    } finally { g.world.free(); }
  });
}

test('10/24 런지 값 (사장님 \'런지로 진행해. 단 런지 동작이 고노센처럼 빠르게 나가야 의미가 있어. 상대 팔 늦어지는 효과는 0.6초 내 경직도 0.6초\')', () => {
  assert.equal(SECRET.risolutoShare, 0.7); // 11/11 사장님 '리솔루토를 70%로 상향하고 파괴력을 0.5로 해.' (전 0.5 — 11/04 사장님 '리솔루토 빠르기 0.5로') // 10/31 01:2x 사장님 '리솔루토 70%' (전 0.8 — 10/30 22:2x · 그 전 0.9 — 20:0x · 그 전 1 — 고노센 칼끝 빠르기 그대로)
  assert.equal(SECRET.risolutoStiff, rs(0.6));
  assert.equal(SECRET.hitMul, 1.3); // 다른 비기 판정 배율 그대로 (사장님 지시 — 바꾸지 않음)
  assert.equal(SECRET.risolutoHitMul, 0.5); // 11/11 사장님 '… 파괴력을 0.5로 해.' — 리솔루토만 0.5 (같은 날 앞 결정 '1.3도 없애' = 1 을 바꿈)
  // 걸음은 있던 수: 몸 미끄러짐 = 고노센 발도 iaiStep · 앞발 = 이탈리아 런지 italianStep · 디딘 뒤 뒷발 끌어붙임
  // 10/24 14:0x: 디딘 뒤 뒷발 끌어붙임(draw) 대신 앞발을 뒤로 거둠(recover — 걸음 시간 0.4 사다리) · 걸음 동안 몸 따라감 배율 stepPush(엇박 찌르기 런지와 같은 2.0) · 몸 가속 한도 × burstAccel(accel)
  // 11/11 사장님 "런지 거리는 0.45로 해, 다른 거리 잴 필요 없어." — 몸 미끄러짐은 리솔루토 전용 SECRET.risolutoSlide 0.45 (전 고노센 발도와 같은 iaiStep 0.6 · 고노센은 0.6 그대로)
  assert.deepEqual(SECRET.risolutoStep, { slide: 'risolutoSlide', foot: 'italianStep', draw: 0, room: 0, push: 'stepPush', accel: 1, recover: 1, recoverT: 0.4 }); // room 1 = 앞발도 clinch 밖까지만 (?risoRoom=1)
  assert.equal(SECRET.risolutoSlide, 0.45); assert.equal(SECRET.iaiStep, 0.6); assert.equal(SECRET.italianStep, 0.9);
  // 다른 곳 값은 그대로 (흘림 팔 늦춤 · 이탈리아 비기 굳음 — 10/23 판 · AI 칸)
  assert.equal(CONFIG.FLOW_RECOVERY.seconds, rs(0.4)); assert.equal(SECRET.stiff.italian, rs(0.6)); /* 11/14 통일 (전 0.4) */
});


// 10/24 14:0x 런지 자세 (사장님 '런지할 때 런지 자세가 되려면 앞무릎을 굽히면서 자세 낮춰야 하는데 지금 그렇게 보여?'): 앞무릎 굽힘 · 뒷다리 펴짐 · 골반 낮춤 — 무릎 굽힘 = 넓적다리(엉덩이 → 무릎)와 정강이(무릎 → 발목) 사이 각
function lungePose(cfg) {
  return withCfg(cfg, () => {
    // 가슴 사이 2.2 m = 맞닿기 1.54 + 0.66(몸 미끄러짐이 한도 0.6 를 다 나가는 거리) — 'full' 판(맞닿기 1.72)은 같은 자리로 맞닿기 + 0.66
    const g = newRound({ weapon: 'rapier', weapon2: 'longsword', gap: MEASURED.rapier[0] + 0.66, seed: 9 });
    const p = g.player, e = g.enemy;
    g.ai.update = () => {}; p.foe = e; e.foe = p;
    const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
    const jw = (c) => { const a = p.jointByName[c].joint.anchor2(), b = p.bodies[c], r = b.rotation(); return new THREE.Vector3(a.x, a.y, a.z).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(V(b.translation())); };
    const pose = () => {
      const c = p.bodies.chest.translation(), f = e.bodies.chest.translation(), fw = new THREE.Vector3(f.x - c.x, 0, f.z - c.z).normalize();
      const leg = (k) => { const h = jw('thigh' + k), kn = jw('shin' + k), an = jw('foot' + k); return { flex: (kn.clone().sub(h).angleTo(an.clone().sub(kn)) * 180) / Math.PI, x: an.dot(fw) }; };
      const F = leg('F'), B = leg('B'), front = F.x > B.x ? F : B, back = F.x > B.x ? B : F;
      return { front: front.flex, back: back.flex, spread: front.x - back.x, pel: p.bodies.pelvis.translation().y };
    };
    try {
      for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.5) / DT); i++) g.step();
      const pel0 = pose().pel;
      const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
      const ps = new PlayerSecretWatch(p, e);
      ps.openWindow({ ev: 'risoluto', path: 'hold', held: 0.6 });
      assert.equal(p.skill.secret(ps.fire()), true);
      const rows = [];
      let wasLunge = false, landed = false, last = null;
      for (let i = 0; i < Math.round(1.2 / DT); i++) {
        g.step();
        const rq = p.gait?.req;
        if (rq && rq.fwd > 0) wasLunge = true;
        if (wasLunge && !(rq && rq.fwd > 0)) landed = true;
        if (rq && rq.fwd < 0) break; // 앞발을 거두기 시작
        if (landed) last = pose();
        if (landed && p.gait.legs.F.stance && p.gait.legs.B.stance) rows.push(last);
      }
      const ms = Math.max(...rows.map((r) => r.spread));
      const wide = rows.filter((r) => r.spread >= 0.85 * ms); // 두 발이 가장 벌어진 몫 (런지 자세)
      // 10/24 15:5x 손목(SECRET.thrustArm — 팔을 뻗은 채 굳음): 몸이 다 실린 끝 무렵은 걸음 몸의 앞발 '디딤' 표시가 몇 스텝 꺼졌다 켜지는 사이라(옛 팔에서도 0.50 ~ 0.60 s 꺼짐)
      //  그 몇 스텝이 창 밖으로 밀리면 런지 자세를 못 본다 → 앞발을 거두기 바로 전 자세(문서 §12-1 셋째 줄 '몸이 다 실려 앞발이 뜨기 바로 전')도 런지 자세로 셈
      if (last && !wide.includes(last)) wide.push(last);
      const best = wide.reduce((a, r) => (r.front - r.back > a.front - a.back ? r : a), wide[0]);
      return { ...best, drop: pel0 - Math.min(...rows.map((r) => r.pel)) };
    } finally { g.world.free(); }
  });
}




