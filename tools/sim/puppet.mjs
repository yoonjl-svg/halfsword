// ─────────────────────────────────────────────────────────────
//  R2 꼭두각시 관문 (docs/strike/r2_impl_spec.md §8.1, W3). 좌표 문제를 물리 전에 잡는다
//   node tools/sim/puppet.mjs [--cuts=zornhau,oberhau,mittelhau,unterhau] [--sides=right,left] [--sizes=small,medium,large]
//        [--girdle=off,anchor] [--physics] [--hand=trunk|wind] [--paces=1,1.5] [--record=<폴더>] [--out=<json>] [--clips=<원본 클립 폴더>]
//   1) 운동학 확인 (물리 없음): 원본 클립 표본마다 아틀라스(원본 클립 길) φ·S 표본 → src/strike/puppet.js kinPose (게임 몸 치수·armIK)
//      → 손목점·팔꿈치·칼끝을 클립 자신의 J 와 (클립 월드에서) 견준다. 손 ≤ 0.03 m (t0…tf 평균), 칼 ≤ 5°, 칼끝 ≤ 0.05 m
//      부호 넷: (i) 골반 yaw ↔ J 엉덩이 선 (ii) drop (iii) chest.side ↔ J 어깨 높이 (iv) 발 yaw (딛는 발 Δ = 골반 Δ, 뒷발 벌림 ↔ GAIT.rearToe)
//      날 각 (게임 멈춘 칼 면 ↔ Qc·edge, 보고만), 팔꿈치 뒤집힘·손 닿음 자름 (보고). girdle 'off'(관문) · 'anchor'(보고)
//   2) --physics: 부호를 실제 엔진에서 (골반 yaw·drop·옆굽힘·딛는 발), 랙돌 꼭두각시 기록 (kind 'puppet'),
//      짜 놓은 위상 추적 (drive.script, 클립 빠르기·1.5배 (--paces), kind 'tracked'). --hand = 시험판 '칼 든 손' 스위치와 같게
//      (trunk = DRIVE.hands 거짓 (기본), wind = hands 참·handMode 'windOnly'·ffFilter 참 — main.js applyHandMode) 두고 추적 id 끝에 _trunk/_wind
//   PASS/FAIL 은 관문 최소값에만. 기록은 --record 폴더에만 쓴다 (index.json 도 갱신, docs/motion/records 는 W5 가 이것으로 채움)
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as CONFIG from '../../src/config.js';
import { loadAtlasFromClips, defaultClipsDir, D2R } from '../../src/strike/atlas.js';
import { kinPose, makePose, PUP, Puppet } from '../../src/strike/puppet.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const CUTS = arg('cuts', 'zornhau,oberhau,mittelhau,unterhau').split(',');
const SIDES = arg('sides', 'right,left').split(',');
const SIZES = arg('sizes', 'small,medium,large').split(',');
const GIRDLES = arg('girdle', 'off,anchor').split(',');
const PHYS = process.argv.includes('--physics');
const REC = arg('record', null);
const HAND = arg('hand', null); // 'trunk' | 'wind' | null (설정 그대로, id 꼬리 없음)
const PACES = arg('paces', '1,1.5').split(',').map(Number);
if (HAND === 'wind') (CONFIG.DRIVE.hands = true), (CONFIG.DRIVE.handMode = 'windOnly'), (CONFIG.DRIVE.ffFilter = true);
else if (HAND != null && HAND !== 'trunk') throw new Error(`--hand=${HAND}: trunk 또는 wind`);
const OUT = arg('out', null);
const SIZE_S = { small: 0, medium: 0.5, large: 1 };
const GATE = { hand: 0.03, sword: 5, tip: 0.05 };

const t0 = performance.now();
const clipsDir = await defaultClipsDir(ROOT, process.argv);
const atlas = await loadAtlasFromClips(clipsDir, { keepRaw: true });
console.error(`[puppet] 원본 클립 ${atlas.clips.length} 벌 읽음 (${(performance.now() - t0).toFixed(0)} ms, ${clipsDir})`);

const r3 = (x) => (x == null || !Number.isFinite(x) ? x : +x.toFixed(3));
const r1 = (x) => (x == null || !Number.isFinite(x) ? x : +x.toFixed(1));
const sgn = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
const angDeg = (a, b) => (Math.acos(Math.max(-1, Math.min(1, a.dot(b) / (a.length() * b.length() || 1)))) * 180) / Math.PI;

/** 원본 클립 J 읽개 */
function jOf(clip) {
  const J = clip.data.cols.J, names = clip.joints;
  const at = (i, name) => {
    const k = i * names.length * 3 + names.indexOf(name) * 3;
    return [J[k], J[k + 1], J[k + 2]];
  };
  return at;
}
import * as THREE from 'three';
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// ───────── 1) 운동학 확인 ─────────
function checkClip(cut, side, size, girdle) {
  const rec = atlas.fam(cut, side)[size];
  const clip = rec.raw;
  const cols = clip.data.cols, n = clip.data.n, J = jOf(clip);
  const S = SIZE_S[size];
  const P = makePose();
  const mk = clip.marks;
  const feet = (i) => () => ({ L: { ankle: J(i, 'ankleL'), toe: J(i, 'toeL') }, R: { ankle: J(i, 'ankleR'), toe: J(i, 'toeR') } });
  const e = { hand: [], handCmd: [], handFK: [], sword: [], tip: [], elbow: [], flat: [], tf: [] };
  let reach = 0, reachMax = 0, poleFlip = 0, frameErr = 0, prevU = null, stanceErr = 0;
  const sideRows = [];
  for (let i = 0; i < n; i++) {
    const t = cols.t[i], phi = cols.phi[i];
    const hip = J(i, 'hipC');
    kinPose(atlas, { cut, side, phi, S, girdle, hip: [hip[0], hip[2]], feet: feet(i) }, P);
    const hS = V(J(i, 'hS')), tip = V(J(i, 'tip')), elS = V(J(i, 'elS'));
    const inTf = t <= mk.tf + 1e-9;
    e.tf.push(inTf);
    e.hand.push(P.hS.distanceTo(hS));
    e.handCmd.push(P.handCmd.distanceTo(hS)); // Qc 규약만 (IK 없이)
    e.handFK.push(P.hS.distanceTo(P.handCmd)); // IK·손목점만
    e.sword.push(angDeg(P.sword, tip.clone().sub(hS)));
    e.tip.push(P.tip.distanceTo(tip));
    e.elbow.push(P.elS.distanceTo(elS));
    e.flat.push(P.flatErrDeg);
    if (P.reachClamp) (reach++, (reachMax = Math.max(reachMax, P.reachOver)));
    frameErr = Math.max(frameErr, P.frameErr);
    const u = P.elS.clone().sub(P.shS).normalize();
    if (prevU && (Math.acos(Math.max(-1, Math.min(1, u.dot(prevU)))) * 180) / Math.PI > 57) poleFlip++;
    prevU = u;
    sideRows.push({ i, side: cols['chest.side'][i] });
  }
  const pick = (a, onlyTf) => a.filter((_, i) => !onlyTf || e.tf[i]);
  const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const st = (k) => ({ meanTf: r3(mean(pick(e[k], true))), maxTf: r3(Math.max(...pick(e[k], true))), meanTg: r3(mean(e[k])), maxTg: r3(Math.max(...e[k])) });
  // 묶음 길의 발 근사(PUP.stanceFoot) vs J (t0)
  const stepFoot = (atlas.fam(cut, side).medium.meta.step || {}).foot;
  const standK = stepFoot === 'R' ? 'L' : 'R';
  const a0 = J(0, `ankle${standK}`);
  stanceErr = Math.hypot(a0[0] - PUP.stanceFoot[0], Math.abs(a0[2]) - PUP.stanceFoot[1]);
  const res = {
    id: rec.id, girdle, hand: st('hand'), handQc: st('handCmd'), handIK: st('handFK'), sword: st('sword'), tip: st('tip'), elbow: st('elbow'),
    edgeFlatDeg: { mean: r1(mean(e.flat)), max: r1(Math.max(...e.flat)) }, reachClamp: reach, reachOverMax: r3(reachMax), poleFlip, frameErr: +frameErr.toExponential(2), stanceFootApproxErr: r3(stanceErr),
  };
  res.pass = res.hand.meanTf <= GATE.hand && res.sword.meanTf <= GATE.sword && res.tip.meanTf <= GATE.tip;
  if (girdle === 'off') res.signs = signs(cut, side, size, clip, J, S);
  return res;
}

/** 부호 넷 (운동학). 게임 쪽은 kinPose 의 게임 단위 틀 (골반 qY(pelvisYaw), 척추 목표 Euler YXZ 조립) */
function signs(cut, side, size, clip, J, S) {
  const cols = clip.data.cols, n = clip.data.n, P = makePose();
  const out = {};
  // (i) 골반 yaw: |pelvis.yaw| > 5° 인 표본에서 J 엉덩이 선(R − L)의 x 부호 = 게임 골반 +z 축의 x 부호
  let ok = 0, all = 0;
  for (let i = 0; i < n; i += 3) {
    if (Math.abs(cols['pelvis.yaw'][i]) < 5) continue;
    kinPose(atlas, { cut, side, phi: cols.phi[i], S, girdle: 'off' }, P);
    const hl = V(J(i, 'hipR')).sub(V(J(i, 'hipL')));
    const gl = P.legs.R.hip.clone().sub(P.legs.L.hip);
    all++;
    if (sgn(hl.x) === sgn(gl.x)) ok++;
  }
  out.pelvisYaw = { agree: ok, n: all, pass: ok === all };
  // (ii) drop: drop 가장 큰·작은 표본의 엉덩이 높이 차 부호 (J vs 게임 틀)
  const dr = cols['pelvis.drop'];
  let iMin = 0, iMax = 0;
  for (let i = 0; i < n; i++) (dr[i] < dr[iMin] && (iMin = i), dr[i] > dr[iMax] && (iMax = i));
  if (dr[iMax] - dr[iMin] > 1e-3) {
    const yA = kinPose(atlas, { cut, side, phi: cols.phi[iMin], S }, P).hipC.y, yB = kinPose(atlas, { cut, side, phi: cols.phi[iMax], S }, P).hipC.y;
    const jA = J(iMin, 'hipC')[1], jB = J(iMax, 'hipC')[1];
    out.drop = { game: r3(yB - yA), clip: r3(jB - jA), pass: sgn(yB - yA) === sgn(jB - jA) };
  } else out.drop = { pass: null, note: 'drop 바뀜 없음' };
  // (iii) chest.side: |side| 봉우리 (양·음)에서 게임 척추 목표로 조립한 어깨 높이 차 부호 = J (어깨띠 몫을 뺀) 부호. J 날것도 적는다
  const sd = cols['chest.side'];
  let iP = 0, iN = 0;
  for (let i = 0; i < n; i++) (sd[i] > sd[iP] && (iP = i), sd[i] < sd[iN] && (iN = i));
  const row = (i) => {
    kinPose(atlas, { cut, side, phi: cols.phi[i], S }, P);
    const g = P.shSg.y - P.shOg.y;
    const jr = J(i, 'shS')[1] - J(i, 'shO')[1];
    // 어깨띠 [lift, prot] 를 가슴 틀 위·앞으로 빼기 (body.mjs girdle)
    const gS = cols.girdleS.slice(i * 2, i * 2 + 2), gO = cols.girdleO.slice(i * 2, i * 2 + 2);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(P.qC), fw = new THREE.Vector3(1, 0, 0).applyQuaternion(P.qC);
    const jn = jr - (up.y * gS[0] + fw.y * gS[1]) + (up.y * gO[0] + fw.y * gO[1]);
    return { side: r1(sd[i]), game: r3(g), clipRaw: r3(jr), clipNoGirdle: r3(jn), pass: Math.abs(sd[i]) < 1 ? null : sgn(g) === sgn(jn) };
  };
  if (Math.max(sd[iP], -sd[iN]) < 1) out.side = { pass: null, note: 'chest.side 0 (이 클립은 옆굽힘 없음)' };
  else {
    const rows = [row(iP), row(iN)].filter((r) => r.pass !== null);
    out.side = { peaks: rows, pass: rows.every((r) => r.pass), rawAgree: rows.every((r) => sgn(r.game) === sgn(r.clipRaw)) };
  }
  // (iv) 발: tr→tc 딛는 발(내딛지 않는 발) yaw Δ 게임 단위 부호 = 골반 Δ 부호; 뒷발(내딛는 발) t0 벌림 부호 = 바깥쪽 (R 은 −, L 은 +), 게임 뒷발 B = −l.side·rearToe (+)
  const mk = clip.marks, hz = clip.hz;
  const ir = Math.round(mk.tr * hz), ic = Math.round(mk.tc * hz);
  const stepFoot = (atlas.fam(cut, side).medium.meta.step || {}).foot;
  const stand = stepFoot === 'R' ? 'L' : 'R';
  const dS = -(cols[`feet.${stand}.yaw`][ic] - cols[`feet.${stand}.yaw`][ir]) * D2R, dP = -(cols['pelvis.yaw'][ic] - cols['pelvis.yaw'][ir]) * D2R;
  const rear = -cols[`feet.${stepFoot}.yaw`][0] * D2R, rearOut = stepFoot === 'R' ? -1 : 1, gameRear = -(-1) * CONFIG.GAIT.rearToe;
  out.feet = {
    stanceDelta: r3(dS), pelvisDelta: r3(dP), stanceAgree: Math.abs(dS) < 1e-3 ? null : sgn(dS) === sgn(dP),
    rearFoot: stepFoot, rearYawGame: r3(rear), rearOutward: sgn(rear) === rearOut, gameRearB: gameRear, gameRearOutward: gameRear > 0,
  };
  out.feet.pass = (out.feet.stanceAgree ?? true) && out.feet.rearOutward && out.feet.gameRearOutward;
  return out;
}

const res = { gate: GATE, clipsDir, kin: [], physics: null };
for (const cut of CUTS) for (const side of SIDES) for (const size of SIZES) for (const girdle of GIRDLES) res.kin.push(checkClip(cut, side, size, girdle));
const off = res.kin.filter((r) => r.girdle === 'off');
res.summary = {
  clips: off.length, pass: off.filter((r) => r.pass).length,
  handMeanWorst: Math.max(...off.map((r) => r.hand.meanTf)), handMaxWorst: Math.max(...off.map((r) => r.hand.maxTf)),
  swordMeanWorst: Math.max(...off.map((r) => r.sword.meanTf)), tipMeanWorst: Math.max(...off.map((r) => r.tip.meanTf)),
  reachClamps: off.filter((r) => r.reachClamp).map((r) => `${r.id}:${r.reachClamp}(${r.reachOverMax} m)`),
  poleFlips: off.filter((r) => r.poleFlip).map((r) => `${r.id}:${r.poleFlip}`),
  signs: {
    pelvisYaw: off.every((r) => r.signs.pelvisYaw.pass), drop: off.every((r) => r.signs.drop.pass !== false),
    side: off.every((r) => r.signs.side.pass !== false), sideRawAgree: off.filter((r) => r.signs.side.peaks).every((r) => r.signs.side.rawAgree),
    feet: off.every((r) => r.signs.feet.pass),
  },
  frameErrMax: Math.max(...off.map((r) => r.frameErr)),
  edgeFlatMeanDeg: r1(off.reduce((s, r) => s + r.edgeFlatDeg.mean, 0) / off.length),
};
if (GIRDLES.includes('anchor')) {
  const an = res.kin.filter((r) => r.girdle === 'anchor');
  res.summary.anchor = { pass: an.filter((r) => r.pass).length, elbowMeanOff: r3(off.reduce((s, r) => s + r.elbow.meanTf, 0) / off.length), elbowMeanAnchor: r3(an.reduce((s, r) => s + r.elbow.meanTf, 0) / an.length), reachClamps: an.filter((r) => r.reachClamp).map((r) => `${r.id}:${r.reachClamp}`) };
}
console.log('id'.padEnd(26), 'girdle', 'hand mean/max(tf) m', 'Qc', 'IK', 'sword°', 'tip m', 'elbow m', 'edge°', 'reach', 'flip', 'PASS');
for (const r of res.kin) console.log(r.id.padEnd(26), r.girdle.padEnd(6), `${r.hand.meanTf}/${r.hand.maxTf}`.padEnd(19), String(r.handQc.meanTf).padEnd(5), String(r.handIK.meanTf).padEnd(5), String(r.sword.meanTf).padEnd(6), String(r.tip.meanTf).padEnd(5), String(r.elbow.meanTf).padEnd(7), String(r.edgeFlatDeg.mean).padEnd(5), String(r.reachClamp).padEnd(5), String(r.poleFlip).padEnd(4), r.pass ? 'PASS' : 'FAIL');
for (const r of off) console.log('signs', r.id.padEnd(26), JSON.stringify(r.signs));
console.log('summary', JSON.stringify(res.summary));

// ───────── 2) 물리 ─────────
if (PHYS) res.physics = await physics();

async function physics() {
  CONFIG.BODY.weightMode = 'hybrid';
  const H = await import('./harness_m.mjs');
  const { newRound, DT } = H;
  const { frameOf, jointsOf, speeds } = await import('../motion/lib/game_joints.mjs');
  const { JOINTS, BONES } = await import('../motion/lib/body.mjs');
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const yawOf = (rb) => { const q = rb.rotation(); return Math.atan2(-2 * (q.x * q.z - q.w * q.y), 1 - 2 * (q.y * q.y + q.z * q.z)); };
  const quiet = (gap = 1.8) => {
    const G = newRound({ seed: 1, gap, walls: false });
    G.ai.update = () => {};
    const P = G.player;
    P.skill.autoGuard = true;
    P.handOffset.set(0.18, -0.28);
    G.before = () => P.move.set(0, 0);
    for (let i = 0; i < 1.5 / DT; i++) { G.step(); if (i === 2) P.skill.lunge = 0; }
    for (let i = 0; i < 3 / DT && P.gait && (P.gait.walking || !P.gait.legs.F.stance || !P.gait.legs.B.stance); i++) G.step();
    return G;
  };
  const out = { signs: {}, puppet: [], tracked: [] };
  const hold = (G, cut, side, phi, sec = 1.2) => { for (let i = 0; i < sec / DT; i++) { G.player.drive.script(phi, 1, cut, side, 0); G.step(); } };
  const shoulderTilt = (P) => {
    const c = P.bodies.chest, q = c.rotation(), qq = new THREE.Quaternion(q.x, q.y, q.z, q.w), t = c.translation();
    const s = new THREE.Vector3(0, 0.1, 0.2).applyQuaternion(qq).y, o = new THREE.Vector3(0, 0.1, -0.2).applyQuaternion(qq).y;
    return s - o;
  };
  // 부호 (엔진): zornhau right large (옆굽힘·drop·골반 yaw 모두 있음) + unterhau right large (옆굽힘 +10°)
  for (const cut of ['zornhau', 'unterhau']) {
    const side = 'right';
    const clip = atlas.fam(cut, side).large.raw, cols = clip.data.cols, n = clip.data.n;
    let iP = 0, iN = 0, iDmin = 0, iDmax = 0, iY = 0;
    for (let i = 0; i < n; i++) {
      if (cols['chest.side'][i] > cols['chest.side'][iP]) iP = i;
      if (cols['chest.side'][i] < cols['chest.side'][iN]) iN = i;
      if (cols['pelvis.drop'][i] < cols['pelvis.drop'][iDmin]) iDmin = i;
      if (cols['pelvis.drop'][i] > cols['pelvis.drop'][iDmax]) iDmax = i;
      if (Math.abs(cols['pelvis.yaw'][i]) > Math.abs(cols['pelvis.yaw'][iY])) iY = i;
    }
    const r = {};
    // (iii) 옆굽힘: 같은 φ 를 sideShare 0.5 와 0 으로 붙잡아 어깨선 기울기 차 (엔진) 부호 = −sign(side) (클립: + 가 칼 쪽으로 기움 = 칼 쪽 어깨가 내려감)
    for (const [lab, i] of [['pos', iP], ['neg', iN]]) {
      const tilt = {};
      for (const sh of [0.5, 0]) {
        CONFIG.DRIVE.sideShare = sh;
        const G = quiet();
        hold(G, cut, side, cols.phi[i]);
        tilt[sh] = shoulderTilt(G.player);
        G.player.drive.script(null);
      }
      CONFIG.DRIVE.sideShare = 0.5;
      const d = tilt[0.5] - tilt[0];
      r[`side_${lab}`] = { clipSideDeg: r1(cols['chest.side'][i]), phi: r3(cols.phi[i]), dTilt: r3(d), pass: sgn(d) === -sgn(cols['chest.side'][i]) };
    }
    // (ii) drop: drop 작은·큰 φ 에서 골반 높이
    {
      const y = [];
      for (const i of [iDmin, iDmax]) {
        const G = quiet();
        hold(G, cut, side, cols.phi[i]);
        y.push(G.player.bodies.pelvis.translation().y);
      }
      r.drop = { clipDrop: [r3(cols['pelvis.drop'][iDmin]), r3(cols['pelvis.drop'][iDmax])], pelvisY: y.map(r3), pass: y[1] < y[0] };
    }
    // (i) 골반 yaw: 가장 큰 |pelvis.yaw| φ 에서 실제 골반 yaw (heading 기준) 부호 = 게임 명령 부호, 엉덩이 선 x 부호 = J
    {
      const G = quiet();
      const P = G.player;
      hold(G, cut, side, cols.phi[iY]);
      const act = wrap(yawOf(P.bodies.pelvis) - P.heading), cmd = -cols['pelvis.yaw'][iY] * D2R;
      const q = P.bodies.pelvis.rotation();
      const hl = new THREE.Vector3(0, 0, 2 * PUP.hipZ).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w)); // 엉덩이 관절 선 (thighB → thighF 관절 자리, F = 칼 쪽 = 클립 R)
      const fwd = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading));
      const hlx = hl.x * fwd.x + hl.z * fwd.z; // 그 앞 성분 (허벅지 몸 가운데는 다리 자세를 따라가 쓰지 않는다)
      const J = jOf(clip), jl = J(iY, 'hipR')[0] - J(iY, 'hipL')[0];
      r.pelvisYaw = { clipDeg: r1(cols['pelvis.yaw'][iY]), cmd: r3(cmd), act: r3(act), hipLineFwd: r3(hlx), clipHipLineFwd: r3(jl), pass: sgn(act) === sgn(cmd) && sgn(hlx) === sgn(jl) };
    }
    // (iv) 딛는 발: 짜 놓은 위상 클립 빠르기, tr → tc 동안 딛는 다리 l.yaw Δ 부호 = 실제 골반 yaw Δ 부호
    {
      const G = quiet();
      const P = G.player, D = P.drive;
      const T = atlas.marks(cut, side, 1);
      for (let i = 0; i < 0.5 / DT; i++) { D.script(-1, 1, cut, side, 0); G.step(); }
      let yR = null, pR = null, yC = null, pC = null, leg = null, fR = null;
      for (let t = 0; t <= T[3] + 1e-9; t += DT) {
        D.script(atlas.phiAt(cut, side, t, 1), 1, cut, side);
        G.step();
        if (yR == null && t >= T[2]) {
          leg = D._swingLeg === 'F' ? 'B' : 'F';
          yR = P.gait.legs[leg].yaw;
          pR = yawOf(P.bodies.pelvis);
          fR = yawOf(P.bodies['foot' + leg]);
        }
      }
      yC = P.gait.legs[leg].yaw;
      pC = yawOf(P.bodies.pelvis);
      D.script(null);
      const dS = wrap(yC - yR), dP = wrap(pC - pR), dF = wrap(yawOf(P.bodies['foot' + leg]) - fR);
      r.feet = { stanceLeg: leg, dStanceTarget: r3(dS), dStanceBody: r3(dF), dPelvis: r3(dP), pass: sgn(dS) === sgn(dP) && sgn(dF) === sgn(dP), footSlipMax: r3(D.stats.footSlipMax) };
    }
    out.signs[`${cut}_${side}_large`] = r;
  }
  // 랙돌 꼭두각시 기록 (kind 'puppet') + 추적 (kind 'tracked', 클립 빠르기·1.5배)
  const recDir = REC ? path.resolve(REC) : null;
  if (recDir) fs.mkdirSync(recDir, { recursive: true });
  const { writeRecord, gitRev } = await import('../motion/lib/records.mjs');
  const CODE = gitRev(ROOT, ['src']); // 기록한 게임 코드
  const writeRec = (r) => { if (recDir) writeRecord(recDir, r); };
  const DV = CONFIG.DRIVE;
  const handKo = DV.hands ? `칼 든 손 큰 감기 (DRIVE.hands 참, handMode '${DV.handMode}', ffFilter ${DV.ffFilter}; 짜 놓은 위상은 φ ≥ 0 에서 베기로 들어 그 뒤는 손가락 매핑 + tCut 손 차이 — 손가락은 Pflug 에 멈춰 있음)` : `칼 든 손 몸통만 (DRIVE.hands 거짓, ffFilter ${DV.ffFilter}; 손은 팔 베기 손가락 매핑 — 손가락은 Pflug 에 멈춰 있음)`;
  const handTag = HAND ? `_${HAND}` : '';
  const record = (id, kind, cut, frames, source, cond) => {
    const tip = speeds(frames, DT, 'tip'), hand = speeds(frames, DT, 'hS');
    const pk = tip.indexOf(Math.max(...tip));
    return { format: 'stillness-motion-record/1', id, cut, kind, source, cond, hz: Math.round(1 / DT), marks: { tipPeak: frames[pk].t }, summary: { tipPeak: Math.max(...tip), handPeak: Math.max(...hand), tipPeakT: frames[pk].t }, joints: JOINTS, bones: BONES, data: { n: frames.length, cols: { t: frames.map((q) => q.t), 'speed.tip': tip, 'speed.hand': hand, J: frames.flatMap((q) => q.J) } } };
  };
  const vsClip = (frames, clip, align = 0) => {
    // 같은 시각 (기록 t − align = 클립 t) 의 손목·칼끝·가슴 차 (클립 월드)
    const J = jOf(clip), cols = clip.data.cols, hS = JOINTS.indexOf('hS') * 3, tp = JOINTS.indexOf('tip') * 3, ch = JOINTS.indexOf('chest') * 3;
    const e = { hand: [], tip: [], chest: [] };
    for (const fr of frames) {
      const t = fr.t - align;
      if (t < 0 || t > clip.marks.tf) continue;
      const i = Math.min(clip.data.n - 1, Math.round(t * clip.hz));
      const d = (k, name) => Math.hypot(fr.J[k] - J(i, name)[0], fr.J[k + 1] - J(i, name)[1], fr.J[k + 2] - J(i, name)[2]);
      e.hand.push(d(hS, 'hS'));
      e.tip.push(d(tp, 'tip'));
      e.chest.push(d(ch, 'chest'));
    }
    const m = (a) => r3(a.reduce((s, x) => s + x, 0) / Math.max(1, a.length));
    return { hand: m(e.hand), tip: m(e.tip), chest: m(e.chest) };
  };
  const cond = (extra) => ({ code: CODE, seed: 1, physicsHz: Math.round(1 / DT), recordHz: Math.round(1 / DT), inputHz: null, weapon: 'longsword', gait: CONFIG.BODY.weightMode, skill: null, gap: null, commit: null, ...extra });
  for (const cut of CUTS) {
    const side = 'right', size = 'large', S = 1;
    const clip = atlas.fam(cut, side)[size].raw;
    const J = jOf(clip), cols = clip.data.cols;
    // 꼭두각시: 몸 전체 kinematic, 클립 J 의 골반 xz·발 (node 길)
    {
      const G = newRound({ seed: 1, walls: false });
      G.park();
      const P = G.player;
      const tIdx = (phi) => { let i = 0; while (i < clip.data.n - 1 && cols.phi[i + 1] <= phi) i++; return i; };
      const pup = new Puppet(P, atlas, { cut, side, S, loop: false, hip: (phi) => { const h = J(tIdx(phi), 'hipC'); return [h[0], h[2]]; }, feet: (phi) => { const i = tIdx(phi); return { L: { ankle: J(i, 'ankleL'), toe: J(i, 'toeL') }, R: { ankle: J(i, 'ankleR'), toe: J(i, 'toeR') } }; } });
      pup.start();
      const fr = frameOf(P, THREE);
      const frames = [];
      for (let t = 0; t <= pup.T + 1e-9; t += DT) {
        frames.push({ t: +t.toFixed(4), J: jointsOf(P, THREE, fr) });
        pup.update(DT);
        G.step();
      }
      const r = record(`puppet_${cut}_${side}_${size}`, 'puppet', cut, frames, `꼭두각시 (src/strike/puppet.js), 클립 ${clip.id} S ${S}, 몸 전체 kinematic`, cond({ input: `클립 시계 그대로 (${clip.id})` }));
      writeRec(r);
      out.puppet.push({ id: r.id, n: frames.length, vsClip: vsClip(frames, clip), tipPeak: r.summary.tipPeak, clipTipPeak: clip.summary?.tipPeak ?? null });
    }
    // 추적: 물리 켬, drive.script 가 클립 시계를 T0 빠르기·1.5배로
    for (const pace of PACES) {
      const G = quiet();
      const P = G.player, D = P.drive;
      for (let i = 0; i < 0.5 / DT; i++) { D.script(-1, S, cut, side, 0); G.step(); }
      const T = atlas.marks(cut, side, S);
      const fr = frameOf(P, THREE);
      const frames = [];
      let lagMax = 0, chLagMax = 0, falls = 0, ffCap0 = D.stats.ffCap;
      for (let t = 0; t <= T[5] / pace + 1e-9; t += DT) {
        D.script(atlas.phiAt(cut, side, t * pace, S), S, cut, side);
        G.step();
        frames.push({ t: +(t * pace).toFixed(4), J: jointsOf(P, THREE, fr) });
        if (t * pace <= T[4]) (lagMax = Math.max(lagMax, Math.abs(D.debug.pelvisLag)), (chLagMax = Math.max(chLagMax, Math.abs(D.debug.chestLag))));
        if (P.state !== 'stand') falls = 1;
      }
      D.script(null);
      const r = record(`tracked_${cut}_${side}_${size}${handTag}_x${pace}`, 'tracked', cut, frames, `추적 (drive.script, 클립 시계 ×${pace}), S ${S}, 물리 켬, ${handKo}`, cond({ input: `drive.script ×${pace}`, hand: HAND ?? (DV.hands ? DV.handMode : 'trunk') }));
      writeRec(r);
      out.tracked.push({ id: r.id, pace, vsClip: vsClip(frames, clip), pelvisLagMaxDeg: r1((lagMax * 180) / Math.PI), chestLagMaxDeg: r1((chLagMax * 180) / Math.PI), falls, ffCap: D.stats.ffCap - ffCap0, tipPeak: r.summary.tipPeak });
    }
  }
  console.log('physics signs', JSON.stringify(out.signs));
  for (const p of out.puppet) console.log('puppet', JSON.stringify(p));
  for (const p of out.tracked) console.log('tracked', JSON.stringify(p));
  return out;
}

if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
const gateOk = res.summary.pass === res.summary.clips && Object.values(res.summary.signs).every((x) => x !== false);
console.log(`GATE puppet (girdle off): ${res.summary.pass}/${res.summary.clips} clips, signs ${JSON.stringify(res.summary.signs)} → ${gateOk ? 'PASS' : 'FAIL'}`);
