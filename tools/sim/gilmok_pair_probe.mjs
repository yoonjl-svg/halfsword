// 길목 지키기 한 칼 맞대기 탐침 (10/11 v6 §17 — docs/strike/iberian_secret_v6_2026-10-11.md). 읽기만.
//  같은 무기(츠바이핸더) · 같은 시작 자세(옆 자세로 감긴 준비 — 손 목표를 do.side[s] 에 ARM 초) · 같은 상대 거리(GAP, 상대 롱소드 몸은 멈춤)에서
//   ① AI 몸(ai.js secretGo — AI 실행부)  ② 플레이어 몸(skill.js secret() — 플레이어 실행부, 게임과 같은 보정 v2·autoGuard)
//  이 한 칼을 내게 하고 물리 스텝마다 적는다: 패드 목표(handOffset)·걸러진 손(skill.aim) · 덧씌우기 무게(thrustPose.w)·손/칼날 목표 · 실제 손·칼날 방향(몸 틀) ·
//   골반·가슴 돌림 명령(bodyPose)과 실제 · 골반 옮김 · 두 발 · 칼끝 자리 · 높이 각 입력(상대 가슴 높이 · 내 칼자루 높이) · 스틱.
//  두 줄을 같은 t(낸 뒤 시간)로 맞대어 처음 갈리는 스텝을 찾는다.
//  실행: node tools/sim/hybrid.mjs gilmok_pair_probe.mjs [무기 zweihander] [씨앗 1]   (GAP=2.0 · ARM=1.0 · S=1 탈류 · ROWS=1 이면 스텝 표 · EPS=0.03)
import { newRound, DT, THREE, toBody, handPos, V, Q } from './harness_m.mjs';
import { SKILL } from '../../src/config.js';
import { playerSecretOf, gilmokLine, PlayerSecretWatch } from '../../src/secret.js';
const id = process.argv[2] || 'zweihander';
const seed = +(process.argv[3] || 1);
const GAP = +(process.env.GAP || 2.0);
const ARM = +(process.env.ARM ?? 1.0);
const SIDE = +(process.env.S || 1);
const EPS = +(process.env.EPS || 0.03);
const WALK = +(process.env.WALK || 0); // WALK=v: 준비가 찬 뒤 상대가 스틱 v 로 걸어 든다 → 경계(gilmokLine)를 넘는 스텝에 낸다 (게임 창과 같은 순간)
const NAT = !!+(process.env.NATURAL || 0); // NATURAL=1: 손을 박지 않는다 — AI 는 제 준비 자세(ai.js 길목 준비)·제 창(secretScan), 플레이어는 PlayerSecretWatch(게임 창 · 준비 자세 gilmokRest)가 연 창에서 곧장 낸다. 상대는 WALK 로 걸어 듦
const HELD = !!+(process.env.HELD || 0);
const T0 = 2.6; // 몸이 선 뒤 (iberian_flow_probe 와 같은 바탕)

function yawOf(body, me) {
  // 몸체의 앞(+x) 방향이 fighter 틀 앞에서 수평으로 돈 각 (rad, + = 왼쪽으로)
  const f = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(body.rotation())).applyQuaternion(me.yaw.clone().invert());
  return Math.atan2(-f.z, f.x);
}

function run(who) {
  const PL = who === 'player';
  const G = PL ? newRound({ walls: false, weapon: id, weapon2: 'longsword', seed, gap: GAP }) : newRound({ walls: false, weapon: 'longsword', weapon2: id, seed, gap: GAP });
  const me = PL ? G.player : G.enemy;
  const foe = PL ? G.enemy : G.player;
  const S = PL ? playerSecretOf(me) : G.ai.secret;
  if (process.env.FOEOLD && !PL) foe.skill.corr = 'old'; // FOEOLD=1: AI 쪽 상대(입력 없는 몸)도 AI 와 같은 옛 보정 — 두 장면의 상대 자세를 같게
  const side = S.do.side[SIDE];
  let t0 = null;
  if (PL) {
    G.ai.update = () => {}; // 상대 멈춤
    me.skill.corr = SKILL.corr;
    me.skill.corrTip = process.env.NOTIP ? false : SKILL.corrTip;
    me.skill.autoGuard = !process.env.NOAG; // NOAG=1: 플레이어 칼 표시(playerArm = autoGuard) 끔 — 진단용
  } else {
    const ai = G.ai;
    const mh = ai.moveHand.bind(ai);
    ai.moveHand = (dt) => {
      if (!NAT && t0 == null && G.t >= T0) {
        ai.hand.set(side[0], side[1]);
        ai.handSpeed = 0.9;
      }
      return mh(dt);
    };
    const sa = ai.startAttack.bind(ai);
    ai.startAttack = (t, why, o) => (t0 == null && why !== 'secret' ? false : sa(t, why, o)); // 준비 동안 스스로 치지 않게
    const mf = ai.moveFeet.bind(ai);
    ai.moveFeet = (dt, d) => (t0 == null ? me.move.set(0, 0) : mf(dt, d)); // 낼 때까지 제자리 (같은 거리)
    if (!NAT) ai.secretScan = () => {}; // 스스로 비기를 내지 않게 (탐침이 낸다)
  }
  // 플레이어 준비: 손 목표를 같은 빠르기(0.9 패드/s — AI 탐침 준비와 같음)로 옆 자세로, 손가락은 댄 채(handHeld — 쉴 자세로 돌아가지 않음)
  const W = PL && NAT ? new PlayerSecretWatch(me, foe) : null;
  if (W) G.before = () => W.update(DT, !!me.skill.sec); // main.js 와 같은 자리(ai.update 뒤 · player.step 앞)
  else if (PL)
    G.before = () => {
      if (t0 != null || G.t < T0) return;
      me.handHeld = HELD; // HELD=1: 손가락 댄 채(날것 매핑) · 기본 0: 뗀 채(쉼 무게 1 — 옛 자세 지도, AI 와 같은 감긴 모습 · 가지 5차 준비 자세와 같은 꼴)
      me.skill.secretMove(side[0], side[1], 0.9, DT);
    };
  const rows = [];
  let p0 = null;
  const fl = (b) => toBody(me, V(b.translation()));
  for (let i = 0; i < 120 * 8; i++) {
    if (WALK && t0 == null) foe.move.set(0, G.t >= T0 + ARM ? WALK : 0);
    G.step();
    const natGo = NAT && t0 == null && (PL ? !!W.open : !!G.ai.secretRun);
    if (natGo || (!NAT && t0 == null && G.t >= T0 + ARM && (!WALK || me.foeDistance() < gilmokLine(me, me.swordArt.measure.reach, S.do)))) {
      const ok = NAT ? (PL ? me.skill.secret({ ...W.fire(), dir: [-SIDE, 0] }) : true) : PL ? me.skill.secret({ S, ctx: null, dir: [-SIDE, 0] }) : G.ai.secretGo(S);
      if (!ok) return { fail: true };
      t0 = G.t;
      p0 = V(me.bodies.pelvis.translation());
      if (PL && !NAT) me.handHeld = true; // 낸 뒤에도 손가락은 댄 채 (끌기 한 번 — 브라우저 hold 대본과 같은 꼴)
      if (!NAT || PL) continue;
    }
    if (t0 == null) continue;
    const sk = me.skill;
    const th = sk.thrustPose;
    const c = V(me.bodies.chest.translation());
    const hp = me.bladePoint(0, new THREE.Vector3());
    const tp = me.bladePoint(1, new THREE.Vector3());
    const bl = toBody(me, tp).sub(toBody(me, hp)).normalize();
    const tipB = toBody(me, tp);
    const hand = toBody(me, handPos(me));
    const pv = V(me.bodies.pelvis.translation()).sub(p0);
    const fw = me.forward(new THREE.Vector3());
    const name = PL ? sk.sec?.cur?.name : G.ai.tech?.name;
    const stage = PL ? sk.sec?.stage : G.ai.secretRun ? (G.ai.secretRun.stage === 'stiff' ? 'stiff' : G.ai.phase) : null;
    rows.push({
      t: G.t - t0,
      name,
      stage,
      pad: [me.handOffset.x, me.handOffset.y],
      aim: [sk.aim.x, sk.aim.y],
      w: th.w,
      thH: th.hand.slice(),
      thD: th.dir.slice(),
      tgt: toBody(me, me.handTarget.clone()),
      hand,
      bl,
      pyC: me.bodyPose.pelvisYaw,
      cyC: me.bodyPose.chestYaw,
      dropC: me.bodyPose.drop,
      pitC: me.bodyPose.pitch,
      pyA: yawOf(me.bodies.pelvis, me),
      cyA: yawOf(me.bodies.chest, me),
      mv: pv.x * fw.x + pv.z * fw.z,
      pelY: me.bodies.pelvis.translation().y,
      fF: fl(me.bodies.footF),
      fB: fl(me.bodies.footB),
      tip: tipB,
      foeY: foe.bodies.chest.translation().y,
      hiltY: hp.y,
      chestY: c.y,
      d: me.foeDistance(),
      move: [me.move.x, me.move.y],
      pm: me.powerMul ?? 1,
      str: me.strength,
      idle: me.bodyPose.idle,
      req: !!me.gait?.req,
    });
    if (!stage) break;
  }
  return { clash: G.clashes, foeHand: [foe.handOffset.x.toFixed(2), foe.handOffset.y.toFixed(2)], rows, wounds: G.wounds.filter((w) => w.att === me).map((w) => `${w.zone}:${w.energy.toFixed(0)}J@${(w.t - t0).toFixed(2)}`) };
}

const A = run('ai');
const P = run('player');
if (A.fail || P.fail) {
  console.log('못 냄', A.fail, P.fail);
  process.exit(0);
}
const f2 = (x) => (Array.isArray(x) ? '[' + x.map((v) => (+v).toFixed(2)).join(',') : '') || x.toFixed(2);
const v3 = (v) => `[${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}]`;
const a3 = (a) => `[${a.map((v) => v.toFixed(2)).join(',')}]`;
const KEYS = [
  ['pad', (r) => r.pad, 2],
  ['aim', (r) => r.aim, 2],
  ['w', (r) => [r.w], 1],
  ['thH', (r) => r.thH, 3],
  ['thD', (r) => r.thD, 3],
  ['tgt', (r) => [r.tgt.x, r.tgt.y, r.tgt.z], 3],
  ['hand', (r) => [r.hand.x, r.hand.y, r.hand.z], 3],
  ['blade', (r) => [r.bl.x, r.bl.y, r.bl.z], 3],
  ['pyC', (r) => [r.pyC], 1],
  ['cyC', (r) => [r.cyC], 1],
  ['dropC', (r) => [r.dropC], 1],
  ['pitC', (r) => [r.pitC], 1],
  ['pyA', (r) => [r.pyA], 1],
  ['cyA', (r) => [r.cyA], 1],
  ['mv', (r) => [r.mv], 1],
  ['move', (r) => r.move, 2],
  ['tip', (r) => [r.tip.x, r.tip.y, r.tip.z], 3],
  ['foeY', (r) => [r.foeY], 1],
  ['str', (r) => [r.str, r.pm], 2],
  ['hip', (r) => [r.pelY], 1],
  ['hiltY', (r) => [r.hiltY], 1],
];
console.log(`${id} · 씨앗 ${seed} · 거리 ${GAP} · 준비 ${ARM} s · 쪽 ${SIDE}${NAT ? ' · 제 준비·제 창' : ''}${WALK ? ' · 걸어 듦 ' + WALK : ''}`);
console.log(`칼끼리 부딪힘 AI ${A.clash} · 플레이어 ${P.clash} · 상대 손 패드 AI 쪽 ${A.foeHand} · 플레이어 쪽 ${P.foeHand}`);
console.log(`AI 상처 ${A.wounds.join(' ') || '없음'} · 플레이어 상처 ${P.wounds.join(' ') || '없음'}`);
const n = Math.min(A.rows.length, P.rows.length);
const first = {};
for (let k = 0; k < n; k++) {
  const a = A.rows[k];
  const p = P.rows[k];
  for (const [key, g] of KEYS) {
    if (first[key]) continue;
    const ga = g(a);
    const gp = g(p);
    const dmax = Math.max(...ga.map((v, i) => Math.abs(v - gp[i])));
    if (dmax > EPS) first[key] = { k, t: a.t, a: ga, p: gp, dmax };
  }
}
console.log('처음 갈리는 스텝 (|차| > ' + EPS + '):');
for (const [key] of KEYS) {
  const F = first[key];
  console.log(`  ${key.padEnd(6)} ${F ? `스텝 ${F.k} (t ${F.t.toFixed(3)}) AI ${a3(F.a)} · 플레이어 ${a3(F.p)}` : '갈림 없음'}`);
}
// 가운데 선 (칼끝 옆 0 을 지날 때 — 칼끝 앞·높이(가슴 기준))
for (const [lab, R] of [['AI', A.rows], ['플레이어', P.rows]]) {
  let mid = null;
  for (let k = 1; k < R.length; k++) if (R[k - 1].tip.z * R[k].tip.z <= 0 && R[k].name && !/Wind/.test(R[k].name)) { mid = R[k]; break; }
  const last = R[R.length - 1];
  console.log(`${lab}: 가운데 선 ${mid ? `t ${mid.t.toFixed(2)} 칼끝 앞 ${mid.tip.x.toFixed(2)} · 높이 ${mid.tip.y.toFixed(2)} · 상대 ${mid.d.toFixed(2)} m` : '안 지남'} · 몸 옮김 끝 ${last.mv.toFixed(2)} m · 스텝 ${R.length}`);
}
if (process.env.ROWS) {
  const every = +process.env.ROWS;
  for (let k = 0; k < n; k += every) {
    const a = A.rows[k];
    const p = P.rows[k];
    console.log(`t ${a.t.toFixed(3)} | ${a.name ?? '-'}/${a.stage} w ${a.w.toFixed(2)} pad ${f2(a.pad)}] aim ${f2(a.aim)}] tgt ${v3(a.tgt)} hand ${v3(a.hand)} bl ${v3(a.bl)} py ${a.pyC.toFixed(2)}/${a.pyA.toFixed(2)} cy ${a.cyC.toFixed(2)}/${a.cyA.toFixed(2)} dr ${a.dropC.toFixed(2)} mv ${a.mv.toFixed(2)} st ${f2(a.move)}] tip ${v3(a.tip)} hilt ${a.hiltY.toFixed(2)} idle ${a.idle.toFixed(2)} str ${a.str.toFixed(2)}/${a.pm.toFixed(2)}`);
    console.log(`        | ${p.name ?? '-'}/${p.stage} w ${p.w.toFixed(2)} pad ${f2(p.pad)}] aim ${f2(p.aim)}] tgt ${v3(p.tgt)} hand ${v3(p.hand)} bl ${v3(p.bl)} py ${p.pyC.toFixed(2)}/${p.pyA.toFixed(2)} cy ${p.cyC.toFixed(2)}/${p.cyA.toFixed(2)} dr ${p.dropC.toFixed(2)} mv ${p.mv.toFixed(2)} st ${f2(p.move)}] tip ${v3(p.tip)} hilt ${p.hiltY.toFixed(2)} idle ${p.idle.toFixed(2)} str ${p.str.toFixed(2)}/${p.pm.toFixed(2)}`);
  }
}
