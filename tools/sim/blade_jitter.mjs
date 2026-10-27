// ─────────────────────────────────────────────────────────────
//  blade_jitter.mjs — 쉬는 칼 떨림 계기 (사장님 10/27 22:3x '떨림 측정해봐' — 확인표 2609 · docs/strike/blade_jitter_2026-10-27.md). 읽기만 한다.
//   게임 값은 바꾸지 않는다. --twistK · --damp · --dampI 는 이 실행의 판(그 싸움꾼의 weaponCfg · CONFIG.JOINTS)만 고친다 — 고칠 길을 재 보는 손잡이.
//
//   rest (기본): 무기마다 사람 자리 싸움꾼이 입력 없이 겨눔 자세로 서 있음(상대는 멀리 치움 — G.park). settle 초 뒤 secs 초 동안 물리 스텝(1/120 s)마다 잰다.
//    --walk: 같은 판에서 옆걸음(오른쪽 1.5 s · 왼쪽 1.5 s 되풀이)하며 잼.
//    칸: I 손 기준 휘두름 관성(weaponPhysics) · ω 칼 각속도 RMS(엔진 속도 상태 — 판정이 읽는 값) · 그 가운데 칼날 축 둘레(비틀림) 몫 ·
//        뒤집힘 = 스텝마다 각속도가 반대로 뒤집힌 몫(ω_t · ω_t−1 < 0) · 주기 = 각속도 자기상관(r1 < −0.5 면 두 스텝 = 16.7 ms) ·
//        서보 포화 = 손목 서보 돌림힘이 상한(debug.wristCap)에 붙은 스텝 몫 · 끝 v = 칼 몸 속도로 센 칼끝 빠르기(평균 · p95 — 판정 · 칼끼리 세기가 읽는 쪽) ·
//        끝 이동 = 칼끝 자리 차분 빠르기(스텝마다 실제로 움직인 거리 ÷ 1/120) · 고주파 = |p_t − (p_t−1 + p_t+1)/2| 평균 · p95(mm — 두 스텝 떨림 크기) ·
//        화면 칼끝 이동 = 그린 프레임 사이 칼끝 이동(cm p95) — main.js 그대로(템포 1.1 · 보간 없음 · 프레임마다 스텝 상한 6): 60 · 45 · 30 fps · 14/20 ms 번갈아 ·
//        1 cm 넘는 튐 = 60 fps 에서 그린 장 사이 1 cm 넘게 옮긴 장 수 /s · 느린 흔들림 = 두 스텝 떨림을 지운 자리에서 ±0.25 s 이동 평균을 뺀 RMS(mm · 주기 = 자기상관 첫 골 × 2) ·
//        두 스텝 떨림 몫 = 자리 − 다섯 점 가중 평균만 그린 장 사이 이동 · 그림 두 스텝 가운데 = 그림만 마지막 두 스텝 자리 가운데로 그릴 때(고칠 길 E) ·
//        팔 = 칼 든 위팔 각속도 RMS(뼈 축 둘레 비틀림 · 그 밖)
//   bind (--bind): 두 싸움꾼 모두 입력 없이 겨눔(AI 없음) · 가슴 사이 gaps · 받는 쪽 옆 옮김 --dz(m) 로 칼이 맞닿게 · 맞닿은 스텝 · 칼끼리 사건(onClash) 수 —
//    새 부딪힘(fresh) · '쨍'(fresh 또는 vn > 3 — main.js onClash) · 센 쨍(vn > 3) · 불꽃(세기 ≥ 2.5 또는 vt > 5) · 멈칫(세기 > 6) · 미끄러짐(slide) 평균 · 최고 ·
//    몸 판정(combat.strike) 부른 수 · 맞음(≥ minEnergy 6 J) · 상처(깊이 > 0) · 공격으로 센 접촉(stamina.contactAttack)
//   body (--body): 받는 쪽은 칼을 놓고(dropSword) 서고 칼끝이 그 몸에 닿게(gaps) — 몸 판정 부른 수 · 맞음 수 · 상처 · 최고 에너지
//
//   node tools/sim/blade_jitter.mjs [무기,무기…|all] [--walk] [--secs=6] [--settle=4] [--json=파일]
//   node tools/sim/blade_jitter.mjs muramasa,longsword --bind [--dz=0.3] [--gaps=0.9,1.1,1.3,1.5,1.7,1.9]
//   node tools/sim/blade_jitter.mjs muramasa,longsword --body [--gaps=…]
//   고칠 길 재기(이 실행만): --twistK=10 (위팔 비틀기 서보 강성 — CONFIG.JOINTS.twistK) · --damp=4 (손목 서보 감쇠 aimDamping) · --dampI=0.27 (aimDamping × min(1, I ÷ 값))
// ─────────────────────────────────────────────────────────────
import { newRound, THREE, DT, CONFIG } from './harness_m.mjs';
import { WEAPONS } from '../../src/weapons.js';
import { weaponPhysics } from '../../src/weapon_class.js';
import { writeFileSync } from 'node:fs';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const DEFAULT_IDS = ['longsword', 'rapier', 'dartagnan', 'uchigatana', 'muramasa', 'kusanagi', 'hwando', 'sain', 'chixiao', 'goujian', 'zweihander', 'flamberge', 'tizona', 'durandal', 'rubber_chicken', 'druid_whip'];
const IDS = !pos[0] ? DEFAULT_IDS : pos[0] === 'all' ? Object.keys(WEAPONS) : pos[0].split(',');
const SECS = +(args.secs ?? 6);
const SETTLE = +(args.settle ?? 4); // 판 시작 뒤 몸 · 칼이 자리 잡는 시간 (1.5 s 로는 이탈리아 한손 칼이 아직 자리 잡는 중 — 느린 흔들림이 부풀었다)
const TEMPO = 1.1; // main.js 기본 템포 (?tempo)
const MAX_STEPS = CONFIG.PHYSICS.maxStepsPerFrame;
if (args.twistK != null) CONFIG.JOINTS.twistK = +args.twistK;

class Idle {
  update() {}
}

function tune(F) {
  const I = weaponPhysics(F.weapon).I;
  if (args.damp != null) F.weaponCfg.aimDamping = +args.damp;
  if (args.dampI != null) F.weaponCfg.aimDamping *= Math.min(1, I / +args.dampI);
}

const _q = new THREE.Quaternion();
const _b = new THREE.Vector3();
const _w = new THREE.Vector3();
const _ax = new THREE.Vector3();
function bladeAxis(F) {
  const r = F.sword.rotation();
  _q.set(r.x, r.y, r.z, r.w);
  return _b.set(0, 1, 0).applyQuaternion(_q);
}
function tipPos(F, out) {
  const t = F.sword.translation();
  return out.set(t.x, t.y, t.z).addScaledVector(bladeAxis(F), F.weaponCfg.hiltLength + F.weaponCfg.bladeLength);
}
function tipBodySpeed(F) {
  const ax = bladeAxis(F).clone().multiplyScalar(F.weaponCfg.hiltLength + F.weaponCfg.bladeLength);
  const v = F.sword.linvel();
  const w = F.sword.angvel();
  return _w.set(w.x, w.y, w.z).cross(ax).add(new THREE.Vector3(v.x, v.y, v.z)).length();
}
const pct = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const rms = (a) => Math.sqrt(mean(a.map((x) => x * x)));

/** 그린 프레임 사이 칼끝 이동 (main.js: acc += 프레임 시간 × 템포 · 스텝마다 acc −= DT · 상한 6 · 보간 없음 → 프레임은 마지막 스텝 자리)
 *  series = 스텝마다 자리(칼끝, 또는 떨림 몫만 — 아래 jitterPart). filter2 = 그림만 마지막 두 스텝 자리의 가운데로 그림(고칠 길 ③ 재기) */
function frameDisp(series, pattern, filter2 = false) {
  let acc = 0;
  let k = 0;
  let prev = null;
  const d = [];
  let odd = 0;
  let frames = 0;
  for (let f = 0; k < series.length - 1; f++) {
    acc += (pattern[f % pattern.length] / 1000) * TEMPO;
    let steps = 0;
    while (acc >= DT && steps < MAX_STEPS) {
      acc -= DT;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;
    k += steps;
    if (k >= series.length) break;
    const p = filter2 && k > 0 ? series[k].clone().add(series[k - 1]).multiplyScalar(0.5) : series[k];
    if (prev) {
      d.push(p.distanceTo(prev) * 100);
      frames++;
      if (steps % 2) odd++;
    }
    prev = p;
  }
  const secs = (series.length * DT) || 1;
  return { p95: pct(d, 0.95), max: Math.max(0, ...d), mean: mean(d), odd: frames ? odd / frames : 0, jumps1cm: d.filter((x) => x > 1).length / secs };
}
/** 떨림 몫: 자리 − 다섯 점 가중 평균(½, 1, 1, 1, ½ ÷ 4 — 두 스텝 주기 뒤집힘을 정확히 지우고 느린 움직임은 남김) */
function jitterPart(tips) {
  const e = [];
  for (let i = 0; i < tips.length; i++) {
    const a = tips[Math.max(0, i - 2)], b = tips[Math.max(0, i - 1)], c = tips[i], d = tips[Math.min(tips.length - 1, i + 1)], f = tips[Math.min(tips.length - 1, i + 2)];
    const sm = a.clone().multiplyScalar(0.5).add(b).add(c).add(d).addScaledVector(f, 0.5).multiplyScalar(0.25);
    e.push(c.clone().sub(sm));
  }
  return e;
}
const PATTERNS = { '60': [1000 / 60], '45': [1000 / 45], '30': [1000 / 30], '14/20': [14, 20] };

function restRun(id, walk) {
  const G = newRound({ walls: true, weapon: id, weapon2: 'longsword', seed: 1 });
  G.park();
  const P = G.player;
  tune(P);
  if (walk) G.before = (t) => P.move.set(Math.floor(t / 1.5) % 2 ? -1 : 1, 0);
  const n0 = Math.round(SETTLE / DT);
  const n1 = n0 + Math.round(SECS / DT);
  const W = [];
  const twist = [];
  const tipV = [];
  const tips = [];
  const sat = [];
  const armTw = [];
  const armSw = [];
  for (let i = 0; i < n1; i++) {
    G.step();
    if (i < n0) continue;
    const w0 = P.sword.angvel();
    const w = new THREE.Vector3(w0.x, w0.y, w0.z);
    W.push(w);
    twist.push(w.dot(bladeAxis(P)));
    tipV.push(tipBodySpeed(P));
    tips.push(tipPos(P, new THREE.Vector3()));
    sat.push(P.debug.wristCap > 0 && P.debug.wristTorque.length() >= 0.99 * P.debug.wristCap ? 1 : 0);
    const u = P.bodies.uarmS;
    const ur = u.rotation();
    _ax.set(1, 0, 0).applyQuaternion(_q.set(ur.x, ur.y, ur.z, ur.w));
    const uw = u.angvel();
    const uv = new THREE.Vector3(uw.x, uw.y, uw.z);
    const ut = uv.dot(_ax);
    armTw.push(ut);
    armSw.push(Math.sqrt(Math.max(0, uv.lengthSq() - ut * ut)));
  }
  // 뒤집힘 · 자기상관
  let flips = 0;
  for (let i = 1; i < W.length; i++) if (W[i].dot(W[i - 1]) < 0) flips++;
  const s0 = W.reduce((s, w) => s + w.lengthSq(), 0) || 1;
  const r = (k) => {
    let s = 0;
    for (let i = 0; i + k < W.length; i++) s += W[i].dot(W[i + k]);
    return s / s0;
  };
  const r1 = r(1);
  let period = null;
  if (r1 < -0.5) period = 2;
  else {
    let best = null;
    for (let k = 2; k < 120; k++) {
      const v = r(k);
      if (v > r(k - 1) && v >= r(k + 1) && v > 0.2) {
        best = k;
        break;
      }
    }
    period = best;
  }
  const fd = [];
  const hf = [];
  for (let i = 1; i < tips.length; i++) fd.push(tips[i].distanceTo(tips[i - 1]) / DT);
  for (let i = 1; i + 1 < tips.length; i++) hf.push(tips[i].clone().sub(tips[i - 1].clone().add(tips[i + 1]).multiplyScalar(0.5)).length() * 1000);
  const jit = jitterPart(tips);
  // 느린 흔들림: 두 스텝 떨림을 지운 자리(다섯 점 평균)에서 ±0.25 s 이동 평균을 뺀 흩어짐(mm RMS) · 자기상관 첫 골 × 2 = 어림 주기
  const sm = tips.map((p, i) => p.clone().sub(jit[i]));
  const HW = 30; // ±0.25 s 이동 평균을 뺌 — 몸이 천천히 자리 잡는 몫(초 단위)은 빼고 그 안의 흔들림만
  const dev = sm.map((p, i) => {
    const a = Math.max(0, i - HW), b = Math.min(sm.length - 1, i + HW);
    const m = new THREE.Vector3();
    for (let j = a; j <= b; j++) m.add(sm[j]);
    return p.clone().sub(m.multiplyScalar(1 / (b - a + 1)));
  });
  const d0 = dev.reduce((a, v) => a + v.lengthSq(), 0) || 1;
  const rr = (k) => dev.slice(0, dev.length - k).reduce((a, v, i) => a + v.dot(dev[i + k]), 0) / d0;
  let slowPeriod = null;
  for (let k = 3; k < 180; k++) if (rr(k) < rr(k - 1) && rr(k) <= rr(k + 1) && rr(k) < -0.2) { slowPeriod = 2 * k * DT * 1000; break; }
  const slowSd = Math.sqrt(d0 / dev.length) * 1000;
  const frames = Object.fromEntries(Object.entries(PATTERNS).map(([k, p]) => [k, frameDisp(tips, p)])); // 칼끝 이동 그대로(느린 움직임 포함)
  const framesJ = Object.fromEntries(Object.entries(PATTERNS).map(([k, p]) => [k, frameDisp(jit, p)])); // 떨림 몫만
  const framesF = Object.fromEntries(Object.entries(PATTERNS).map(([k, p]) => [k, frameDisp(jit, p, true)])); // 떨림 몫 · 그림만 두 스텝 가운데
  const framesRawF = Object.fromEntries(Object.entries(PATTERNS).map(([k, p]) => [k, frameDisp(tips, p, true)])); // 칼끝 이동 그대로 · 그림만 두 스텝 가운데
  const ph = weaponPhysics(WEAPONS[id] ?? P.weapon);
  return {
    id,
    walk: !!walk,
    I: ph.I,
    mass: ph.mass,
    cap: P.debug.wristCap,
    damp: P.weaponCfg.aimDamping,
    wRms: rms(W.map((w) => w.length())),
    twistRms: rms(twist),
    flip: flips / Math.max(1, W.length - 1),
    r1,
    periodMs: period ? period * DT * 1000 : null,
    sat: mean(sat),
    tipV: mean(tipV),
    tipV95: pct(tipV, 0.95),
    tipFD: mean(fd),
    hfMm: mean(hf),
    slowSd,
    slowPeriod,
    hf95Mm: pct(hf, 0.95),
    frames,
    framesJ,
    framesFilter2: framesF,
    framesRawFilter2: framesRawF,
    armTwist: rms(armTw),
    armSwing: rms(armSw),
  };
}

function printRest(rows) {
  const f = (v, d = 2) => (v == null ? '-' : v.toFixed(d));
  console.log(`| 무기 | 걸음 | I | ω RMS rad/s | 비틀림 | 뒤집힘 | 주기 ms (r1) | 서보 포화 | 끝 v 평균 · p95 m/s | 끝 이동 m/s | 고주파 mm 평균 · p95 | 화면 칼끝 이동 cm p95 60 · 45 · 30 · 14/20 | 1 cm 넘는 튐 /s 60 fps | 느린 흔들림 mm RMS (주기 ms) | 두 스텝 떨림 몫 cm p95 45 · 14/20 | 그림 두 스텝 가운데 p95 45 · 14/20 | 팔 비틀림 · 그 밖 |`);
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const r of rows)
    console.log(
      `| ${r.id} | ${r.walk ? '걸음' : '섬'} | ${f(r.I, 3)} | ${f(r.wRms)} | ${f(r.twistRms)} | ${f(r.flip * 100, 0)} % | ${f(r.periodMs, 1)} (${f(r.r1)}) | ${f(r.sat * 100, 0)} % | ${f(r.tipV)} · ${f(r.tipV95)} | ${f(r.tipFD)} | ${f(r.hfMm, 1)} · ${f(r.hf95Mm, 1)} | ${['60', '45', '30', '14/20'].map((k) => f(r.frames[k].p95)).join(' · ')} | ${f(r.frames['60'].jumps1cm, 1)} | ${f(r.slowSd, 1)} (${r.slowPeriod ? f(r.slowPeriod, 0) : '-'}) | ${f(r.framesJ['45'].p95)} · ${f(r.framesJ['14/20'].p95)} | ${f(r.framesFilter2['45'].p95)} · ${f(r.framesFilter2['14/20'].p95)} | ${f(r.armTwist, 1)} · ${f(r.armSwing, 1)} |`,
    );
}

function bindRun(a, b, gap, mode) {
  const G = newRound({ walls: true, weapon: a, weapon2: b, seed: 1, gap, AIClass: Idle });
  tune(G.player);
  tune(G.enemy);
  const ev = { touchSteps: 0, clash: 0, fresh: 0, ping: 0, loudN: 0, sparks: 0, stop: 0, attack: 0, slide: [], strikes: 0, judged: 0, wounds: 0, eMax: 0, vnMax: 0 };
  const hooks = G.combat.hooks;
  const oc = hooks.onClash;
  hooks.onClash = (pt, sp, t) => {
    ev.clash++;
    if (t?.fresh) ev.fresh++;
    if (t && (t.fresh || t.vn > 3)) ev.ping++;
    if (t && t.vn > 3) ev.loudN++;
    const impact = t ? (t.fresh || t.vn > 3 ? t.vn : 0) : sp;
    if (impact >= 2.5 || (t && t.vt > 5)) ev.sparks++;
    if (impact > 6) ev.stop++;
    if (t) ev.vnMax = Math.max(ev.vnMax, t.vn);
    return oc?.(pt, sp, t);
  };
  for (const F of [G.player, G.enemy]) {
    const ca = F.stamina.contactAttack.bind(F.stamina);
    F.stamina.contactAttack = (...x) => {
      ev.attack++;
      return ca(...x);
    };
  }
  const st = G.combat.strike.bind(G.combat);
  G.combat.strike = (pr, point, passing) => {
    ev.strikes++;
    const r = st(pr, point, passing);
    if (r) {
      ev.judged++;
      ev.eMax = Math.max(ev.eMax, r.energy);
    }
    return r;
  };
  if (mode === 'body') G.enemy.dropSword(); // 몸 판: 받는 쪽은 칼을 놓아 칼끼리 닿지 않게
  const dz = +(args.dz ?? 0); // 받는 쪽을 옆으로 옮김 (m — 겨눔이 나란한 칼도 엇갈려 맞닿게)
  if (dz) for (const { rb } of G.enemy.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x, y: t.y, z: t.z + dz }, true); }
  if (dz && G.enemy.armed) { const t = G.enemy.sword.translation(); G.enemy.sword.setTranslation({ x: t.x, y: t.y, z: t.z + dz }, true); }
  const n0 = Math.round(SETTLE / DT);
  const n1 = n0 + Math.round(SECS / DT);
  let w0 = 0;
  for (let i = 0; i < n1; i++) {
    if (i === n0) {
      w0 = G.wounds.length;
      for (const k of ['clash', 'fresh', 'ping', 'loudN', 'sparks', 'stop', 'attack', 'strikes', 'judged']) ev[k] = 0;
      ev.eMax = ev.vnMax = 0;
    }
    G.step();
    if (i < n0) continue;
    const bc = G.combat.bladeContact;
    if (bc.last === G.combat.stepNo) {
      ev.touchSteps++;
      ev.slide.push(bc.slide);
    }
  }
  const W = G.wounds.slice(w0);
  ev.wounds = W.length;
  ev.woundSev = W.filter((w) => w.severity > 0).length; // 상처 깊이 > 0 (멍 · 긁힘이 아닌)
  ev.woundTypes = [...new Set(W.map((w) => `${w.att.weaponSpecId}→${w.zone}:${w.type}`))].slice(0, 4).join(' ');
  ev.loud = ev.loudN;
  return { a, b, gap, ...ev, slideMean: mean(ev.slide), slideMax: Math.max(0, ...ev.slide), slide: undefined };
}

const out = { args, rows: [] };
if (args.bind || args.body) {
  const mode = args.body ? 'body' : 'bind';
  const gaps = String(args.gaps ?? (mode === 'body' ? '0.8,0.9,1.0,1.1,1.2' : '0.9,1.0,1.1,1.2,1.3,1.4,1.5,1.6')).split(',').map(Number);
  const pairs = mode === 'body' ? IDS.map((id) => [id, 'longsword']) : IDS.flatMap((id) => (id === 'longsword' ? [[id, id]] : [[id, id], [id, 'longsword']]));
  console.log(`[${mode}] ${SECS} s · 정지 ${SETTLE} s 뒤 · 옆 ${args.dz ?? 0} m · twistK ${CONFIG.JOINTS.twistK ?? '판'} · aimDamping ${args.damp ?? (args.dampI ? `× min(1, I/${args.dampI})` : '판')}`);
  if (mode === 'bind') console.log('| 짝 | 가슴 사이 m | 맞닿은 스텝 | 칼 사건 | 새 부딪힘 | 쨍 소리 | 센 쨍 vn > 3 | 불꽃 | 멈칫 | 최고 vn m/s | 미끄러짐 평균 · 최고 m/s | 몸 판정 부름 · 맞음 · 상처(깊이 > 0) | 공격 접촉 | 상처 꼴 |');
  else console.log('| 칼 | 가슴 사이 m | 몸 판정 부름 | 맞음(≥ 6 J) | 상처(깊이 > 0) | 최고 J | 공격 접촉 | 상처 꼴 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [a, b] of pairs)
    for (const g of gaps) {
      const r = bindRun(a, b, g, mode);
      out.rows.push(r);
      if (mode === 'bind') console.log(`| ${a} · ${b} | ${g} | ${r.touchSteps} | ${r.clash} | ${r.fresh} | ${r.ping} | ${r.loud} | ${r.sparks} | ${r.stop} | ${r.vnMax.toFixed(2)} | ${r.slideMean.toFixed(2)} · ${r.slideMax.toFixed(2)} | ${r.strikes} · ${r.judged} · ${r.wounds}(${r.woundSev}) | ${r.attack} | ${r.woundTypes} |`);
      else console.log(`| ${a} | ${g} | ${r.strikes} | ${r.judged} | ${r.wounds}(${r.woundSev}) | ${r.eMax.toFixed(1)} | ${r.attack} | ${r.woundTypes} |`);
    }
} else {
  console.log(`[rest] ${SECS} s · 정지 ${SETTLE} s 뒤 · twistK ${CONFIG.JOINTS.twistK ?? '판'} · aimDamping ${args.damp ?? (args.dampI ? `× min(1, I/${args.dampI})` : '판')} · 화면 템포 ${TEMPO}`);
  for (const id of IDS) {
    out.rows.push(restRun(id, false));
    if (args.walk) out.rows.push(restRun(id, true));
  }
  printRest(out.rows);
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
