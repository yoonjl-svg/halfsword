// ─────────────────────────────────────────────────────────────
//  chain.mjs — 온몸 베기 R0 측정 한 벌 (재설계 docs/whole_body_redesign.md §8 R0 행, tseq.mjs·mx.mjs·costs/probe.mjs 를 하나로)
//
//   node tools/sim/chain.mjs [--root=<체크아웃>] [--weapon=longsword] [--hz=120] [--input=60] [--seed=7] [--v=12]
//        [--fams=diagR,vert,horizR,riseR] [--modes=arm,commit] [--scenes=air,stop,hit] [--out=tools/sim/out/chain]
//        [--json=<파일>] [--vs=<앞선 json>] [--check=<기록 폴더>] [--set=GRP.key=val ...] [--md] [--no-record]
//
//  --root 의 src/ 와 tools/sim/harness_m.mjs 를 읽기만 한다(다른 가지의 체크아웃도 된다). 동작 연구 PM 의 라이브러리(tools/motion/lib)는
//  이 저장소 것을 쓴다. 조건은 tools/motion/record_wbs.mjs(= tseq.mjs)와 같다: hybrid 걸음, skill 0.7, 상대는 서 있기만(칼 충돌 끔),
//  쟁기 2 s → 감기 자리 1.2 m/s + 1 s 머묾 → 끝 자리 v m/s 획. arm = WHOLE.commit 끔, commit = 켬.
//  장면: air = 2.0 m 헛치기(내 칼 충돌 끔, 기록 파일을 낸다) · stop = 획 절반에서 손가락 멈춤(1 s 누른 채) · hit = 1.55 m 에서 맞힘(내 칼 충돌 켬)
//  내는 것: (1) 동작 연구 PM 의 stillness-motion-record/1 기록(air 장면, --out 폴더 — docs/motion 에는 쓰지 않는다. J 칸은 record_wbs.mjs 와 바이트까지 같다, --check)
//         (2) 표: 칼끝·손·골반·가슴 최고와 때, 겨눈 선을 지난 때 tc, 사슬 순서(tc 기준), 칼끝 속도의 몸통·팔·손목 몫, 칼 운동에너지, 손목·빈손 일,
//             근육 한계 포화 비율(fighter.ins 계측 탭), 지연(손가락 → 손 목표 2 cm·손 2 cm·칼끝 5 cm·고른 지연·골반/가슴 5°), 대가(멈춤 넘침·복귀·쏠림·상처)
//         (3) --json 한 벌. --vs=<앞선 json> 이면 칼끝·KE·상처 에너지 Δ%, 지연 Δms 를 견주고 |Δ| > 3 % 또는 물리 한 스텝 넘는 것에 표를 한다
//             (팔 베기 ±3 % 관문: 다른 R0 가지에서 --root=<그 가지> 로 돌려 기준 json 과 견준다)
//  물리 Hz 는 harness_m.mjs 가 불러올 때 굳히므로 config 를 먼저 읽어 바꾼 뒤 harness 를 불러온다 (speedsweep.mjs 와 같은 순서)
//  fighter.ins 가 없는 체크아웃(옛 가지)에서도 돈다 — 포화·일 항목만 비운다. 자르기·한도·바닥은 어디에도 넣지 않는다 (재기만 한다)
// ─────────────────────────────────────────────────────────────
import { mkdirSync, readFileSync, writeFileSync, realpathSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { JOINTS, BONES } from '../motion/lib/body.mjs';
import { jointsOf, speeds } from '../motion/lib/game_joints.mjs';
import { writeRecord, gitRev } from '../motion/lib/records.mjs';
import { shapeMetrics } from '../motion/lib/shape_metrics.mjs';

// ── 인자 ──
const args = {};
const sets = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  if (m[1] === 'set') sets.push(m[2]);
  else args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = realpathSync(resolve(arg('root', resolve(HERE, '..', '..')))); // realpath: harness 가 상대 경로로 여는 config 와 같은 모듈이 되게
const WEAPON = arg('weapon', 'longsword');
const HZ = +arg('hz', 120);
const INPUT = +arg('input', 60);
const SEED = +arg('seed', 7);
const VF = +arg('v', 12);
const FAMS = list('fams', 'diagR,vert,horizR,riseR');
const MODES = list('modes', 'arm,commit');
const SCENES = list('scenes', 'air,stop,hit');
const OUT = resolve(arg('out', 'tools/sim/out/chain'));
const JSON_OUT = resolve(arg('json', join(OUT, `chain_${WEAPON}_${HZ}_${INPUT}.json`)));
const VS = arg('vs', null);
const CHECK = arg('check', null);
const MD = !!arg('md', false);
const RECORD = !arg('no-record', false);
const R0_OFF = process.env.R0_OFF === '1';

const GAP = 2.0; // 헛치기·멈춤 거리 (record_wbs.mjs)
const HIT_DIST = 1.55; // 맞힘 거리 (costs/probe.mjs)
const PRE = 0.6; // 기록 시각 0 = 베기 획 − PRE
const POST_REC = 1.0; // 기록 창: 획 뒤 이만큼 (record_wbs.mjs)
const POST = 2.5; // 대가 창: 획(멈춤 장면은 손가락 멈춤) 뒤 이만큼
const WIN = 0.6; // 최고·포화를 찾는 베기 창 (tseq.mjs)
const STOP_FRAC = 0.5; // 멈춤 장면: 감기 → 끝의 이 비율에서 손가락을 멈춘다 (mx.mjs stop)
const R2D = 180 / Math.PI;

// ── 부팅 (순서가 중요: 물리 스텝을 바꾼 뒤 harness) ──
const cfg = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
cfg.PHYSICS.timestep = 1 / HZ;
cfg.BODY.weightMode = 'hybrid'; // tools/sim/hybrid.mjs 와 같게
const parseVal = (v) => (v === 'true' ? true : v === 'false' ? false : /^[[{]/.test(v) ? JSON.parse(v) : Number.isNaN(+v) ? v : +v);
for (const s of sets) {
  const i = s.indexOf('=');
  const [grp, key] = s.slice(0, i).split('.');
  cfg[grp][key] = parseVal(s.slice(i + 1));
}
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { newRound, DT, THREE, V, Q, handPos, feedTrace, inputPump } = H;
const { guardAt } = await import(pathToFileURL(join(ROOT, 'src/guards.js')).href);
const { getWeapon } = await import(pathToFileURL(join(ROOT, 'src/weapons.js')).href);
if (getWeapon(WEAPON).gun) {
  console.log('권총은 결심 베기가 없다');
  process.exit(2);
}
const branch = (() => {
  try {
    return execFileSync('git', ['-C', ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return '?';
  }
})();
const rev = process.env.WBS_REV || gitRev(ROOT);
const CODE = `${branch} ${rev}`;
const STEP_MS = 1000 / HZ;

// ── 패드 자리·무리 (record_wbs.mjs 와 같다) ──
const PAD = { Pflug: [0.18, -0.28], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], Tag: [0.02, 0.52], Alber: [0, -0.5], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Wechsel: [0.38, -0.44], OchsL: [-0.22, 0.26] };
const padName = (xy) => Object.keys(PAD).find((k) => PAD[k] === xy);
const FAM = {
  diagR: { ch: PAD.ShR, end: PAD.WechselL, cut: 'zornhau' },
  vert: { ch: PAD.Tag, end: PAD.Alber, cut: 'oberhau' },
  horizR: { ch: PAD.Side, end: PAD.SideL, cut: 'mittelhau' },
  riseR: { ch: PAD.Wechsel, end: PAD.OchsL, cut: 'unterhau' },
};
for (const f of FAMS) if (!FAM[f]) throw new Error(`모르는 무리 ${f}`);

function stroke(dx, dy, v, { hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  return { fn: (t) => { const u = T > 0 ? Math.min(1, t / T) : 1; return [dx * u, dy * u]; }, T: T + hold, lift, down };
}
function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(xy[0], xy[1]);
  k.aimVel?.set(0, 0);
  k.vel?.set(0, 0);
  k.follow?.set(0, 0);
}

// ── 강체 도구 ──
const lv = (rb) => V(rb.linvel());
const av = (rb) => V(rb.angvel());
const com = (rb) => V(rb.worldCom());
/** 월드 점 p 가 강체 rb 에 붙어 있다면 갖는 속도 */
const carry = (rb, p) => lv(rb).add(av(rb).cross(p.clone().sub(com(rb))));
const bodyYaw = (rb) => { const f = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(rb.rotation())); return Math.atan2(-f.z, f.x); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** 칼 운동에너지 (평행 이동 + 주관성축 회전) */
function swordKE(sw) {
  const m = sw.mass();
  const vc = lv(sw);
  const w = av(sw).applyQuaternion(Q(sw.rotation()).invert()).applyQuaternion(Q(sw.principalInertiaLocalFrame()).invert());
  const I = sw.principalInertia();
  return 0.5 * m * vc.lengthSq() + 0.5 * (I.x * w.x * w.x + I.y * w.y * w.y + I.z * w.z * w.z);
}

/** 한 스텝 표본 (스텝 뒤에 읽는다. 물리는 건드리지 않는다) */
function sample(G, P, E) {
  const B = P.bodies;
  const tip = P.bladePoint(1, new THREE.Vector3());
  const hilt = P.bladePoint(0, new THREE.Vector3());
  const hand = handPos(P);
  const ch = B.chest;
  const chest = V(ch.translation());
  const sh = new THREE.Vector3(0, 0.1, P.side * 0.2).applyQuaternion(Q(ch.rotation())).add(chest);
  const vTip = carry(P.sword, tip), vHand = carry(B.farmS, hand), vSh = carry(ch, sh);
  // 칼끝 속도 나누기: 골반이 실어 준 몫 | 척추(가슴−골반) | 어깨(위팔−가슴) | 팔꿈치(아래팔−위팔) | 손목(칼−아래팔). 칼끝 속도 방향 성분
  const cP = carry(B.pelvis, tip), cC = carry(ch, tip), cU = carry(B.uarmS, tip), cF = carry(B.farmS, tip);
  const u = vTip.lengthSq() > 1e-9 ? vTip.clone().normalize() : new THREE.Vector3(1, 0, 0);
  const part = { pel: cP.dot(u), spine: cC.clone().sub(cP).dot(u), shoulder: cU.clone().sub(cC).dot(u), elbow: cF.clone().sub(cU).dot(u), wrist: vTip.clone().sub(cF).dot(u) };
  const wSw = av(P.sword), wFa = av(B.farmS);
  const yawInv = P.yaw.clone().invert();
  const toH = (p) => { const v = p.clone().sub(chest).applyQuaternion(yawInv); v.z *= P.side; return v; }; // 머리 방향 틀, 가슴 가운데 원점, +z = 칼 쪽
  const bd = tip.clone().sub(hilt).normalize();
  const q = V(E.bodies.chest.translation()).sub(hilt);
  const online = bd.dot(q) / (q.length() + 1e-9); // 칼 방향과 칼자루 → 상대 가슴 사이 cos (겨눈 선을 지나는 때 = 최대)
  const I = P.ins || {};
  const wr = I.wr || {}, shI = I.sh || {}, el = I.el || {}, sp = I.sp || {}, off = I.off || {};
  const cm = P.commit || {};
  const sk = P.skill;
  return {
    gt: G.t, tip, hand, tipH: toH(tip), handH: toH(hand), tgtH: toH(P.handTarget),
    tipV: vTip.length(), tipVfd: P.tipVel.length(), handV: vHand.length(), shV: vSh.length(),
    pelW: av(B.pelvis).y, chW: av(ch).y, swW: wSw.length(), swRelW: wSw.clone().sub(wFa).length(),
    part, KE: swordKE(P.sword),
    Pw: wr.tau ? wr.tau.dot(wSw) : null, // 손목 일률 τ·ω (W)
    Po: off.F && off.on ? off.F.dot(off.vp) : 0, // 빈손이 칼자루에 준 일률 F·v (W, 잡지 않으면 0)
    online, heading: P.heading,
    pelTw: wrap(bodyYaw(B.pelvis) - P.heading) * R2D * -P.side, chTw: wrap(bodyYaw(ch) - P.heading) * R2D * -P.side,
    off: [P.handOffset.x, P.handOffset.y], aim: [sk.aim.x, sk.aim.y], aimRaw: [sk.aimRaw.x, sk.aimRaw.y],
    act: sk.activity, cmOn: !!cm.on, cmStage: cm.stage ?? null, cmU: cm.u ?? null, padOn: !!cm.padOn,
    com: P.com ? P.com.clone() : V(B.pelvis.translation()), comV: P.comVel.clone(), s: P.support, offB: P.offBalance, state: P.state,
    // 계측 탭 (fighter.ins, 없으면 undefined)
    wrSat: wr.sat, wrHill: wr.hill, wAimRaw: wr.wAimRaw, release: wr.release, brake: wr.brake,
    shSat: shI.sat, shHill: shI.hill, elSat: el.sat, elHill: el.hill,
    chSatY: sp.chest?.satY, abSatY: sp.abdomen?.satY, chVclamp: sp.chest?.velClampY, abVclamp: sp.abdomen?.velClampY,
    hlClip: I.hl ? I.hl[3] > I.hl[0] + 1e-9 : undefined,
  };
}

/** 한 판: record_wbs.mjs 의 순서 그대로 + 표본 + 대가 창 */
function trial(fam, mode, scene) {
  cfg.WHOLE.commit = mode !== 'arm';
  const dist = scene === 'hit' ? HIT_DIST : GAP;
  const G = newRound({ walls: false, gap: dist + 0.17, seed: SEED, weapon: WEAPON });
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  if (scene !== 'hit') for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.level = 0.7;
  setPad(P, PAD.Pflug);
  inputPump(G, { hz: INPUT });
  P.ins = { wr: {}, sh: {}, el: {}, sp: {}, off: { on: false }, hl: null }; // 계측 탭 꽂기 (수치는 바뀌지 않는다)
  const commits = [];
  const oc = P.onCommit.bind(P);
  P.onCommit = (st, c, fm) => (commits.push({ gt: G.t, st, c, fm }), oc(st, c, fm));
  const wounds = [];
  G.onWound = (att, vic, r) => att === P && wounds.push({ gt: G.t, zone: r.zone, E: r.energy, v: r.speed, mEff: r.mEff });
  let catches = 0, kd = 0;
  if (P.gait) {
    const ot = P.gait.onTouchdown.bind(P.gait);
    P.gait.onTouchdown = (foot, s, kind) => (kind === 'catch' && catches++, ot(foot, s, kind));
  }
  const okd = P.knockDown.bind(P);
  P.knockDown = (heavy) => (P.state === 'stand' && kd++, okd(heavy));
  for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
  const hasTap = P.ins.wr.pre !== undefined;
  const F = FAM[fam];
  const off = [P.handOffset.x, P.handOffset.y];
  // 월드 관절을 굴려 두다가(최근 PRE 초) 베기 획 PRE 초 앞을 원점으로 삼는다 (record_wbs.mjs)
  const W0 = { origin: new THREE.Vector3(0, 0, 0), yaw0: 0 };
  const keep = Math.round(PRE / DT);
  const buf = [];
  const snap = () => {
    const p = P.bodies.pelvis.translation();
    const fw = P.forward();
    return { J: jointsOf(P, THREE, W0), o: [p.x, p.z], yaw: Math.atan2(fw.z, fw.x), s: sample(G, P, E) };
  };
  const chq = feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 1.2, { hold: 1000, lift: false }), INPUT);
  while (!chq.done) {
    G.step();
    buf.push(snap());
    if (buf.length > keep) buf.shift();
  }
  const cur = [P.handOffset.x, P.handOffset.y];
  const tgt = scene === 'stop' ? [F.ch[0] + STOP_FRAC * (F.end[0] - F.ch[0]), F.ch[1] + STOP_FRAC * (F.end[1] - F.ch[1])] : F.end;
  const dx = tgt[0] - cur[0], dy = tgt[1] - cur[1];
  const moveT = Math.hypot(dx, dy) / VF;
  const cut = feedTrace(G, stroke(dx, dy, VF, scene === 'stop' ? { down: false, lift: false, hold: 1000 } : { down: false, lift: true }), INPUT);
  const tStart = buf.length * DT; // 베기 획을 건 때 (기록 시각)
  let guard = 0;
  do {
    G.step();
    buf.push(snap());
  } while (cut.t0 == null && ++guard < 120);
  const i0 = buf.length - 1; // 획이 시작된 첫 스텝의 표본
  const iRecEnd = buf.length + Math.round(POST_REC / DT);
  const nPost = Math.round((POST + (scene === 'stop' ? moveT : 0)) / DT);
  for (let i = 0; i < nPost; i++) {
    G.step();
    buf.push(snap());
  }
  // 첫 표본의 골반 밑 땅·바라보는 방향을 원점으로 다시 적는다 (record_wbs.mjs 와 같은 식·자릿수)
  const [ox, oz] = buf[0].o;
  const c = Math.cos(-buf[0].yaw), sn = Math.sin(-buf[0].yaw);
  const frames = buf.slice(0, iRecEnd).map((q, i) => {
    const J = new Array(q.J.length);
    for (let k = 0; k < q.J.length; k += 3) {
      const ddx = q.J[k] - ox, ddz = q.J[k + 2] - oz;
      J[k] = +(ddx * c - ddz * sn).toFixed(3);
      J[k + 1] = q.J[k + 1];
      J[k + 2] = +(ddx * sn + ddz * c).toFixed(3);
    }
    return { t: +(i * DT).toFixed(4), J };
  });
  return { fam, mode, scene, S: buf.map((q) => q.s), frames, i0, tStart, cut, moveT, dx, dy, tgt, gap: dist, commits, wounds, catches, kd, hasTap };
}

// ── 기록 파일 (record/1) ──
function makeRecord(T, tc) {
  const { fam, mode, frames, tStart, commits } = T;
  const tip = speeds(frames, DT, 'tip');
  const hand = speeds(frames, DT, 'hS');
  const peakI = tip.indexOf(Math.max(...tip));
  const n = commits.length;
  return {
    format: 'stillness-motion-record/1',
    id: `wbs_${fam}_${mode}`,
    cut: FAM[fam].cut,
    kind: mode === 'arm' ? 'wbs-arm' : 'wbs-commit',
    source: `${CODE} (${mode === 'arm' ? '팔 베기, WHOLE.commit 끔' : '결심 베기, WHOLE.commit 켬'}), chain.mjs = tseq.mjs 조건: hybrid, ${WEAPON}, skill 0.7, ${T.gap} m, 감기 1.2 m/s + 1 s 머묾 → 끝 ${VF} m/s, 입력 ${INPUT} Hz, 칼 충돌 끔. 결심 ${n}번`,
    cond: {
      code: CODE, seed: SEED, physicsHz: Math.round(1 / DT), recordHz: Math.round(1 / DT), inputHz: INPUT, weapon: WEAPON, gait: cfg.BODY.weightMode, skill: 0.7, gap: T.gap,
      input: `패드: Pflug ${JSON.stringify(PAD.Pflug)} 2 s → ${padName(FAM[fam].ch)} ${JSON.stringify(FAM[fam].ch)} 1.2 m/s + 1 s 머묾 → ${padName(FAM[fam].end)} ${JSON.stringify(FAM[fam].end)} ${VF} m/s (tseq.mjs)`,
      commit: mode === 'arm' ? '끔' : `켬 (결심 ${n}번)`,
    },
    hz: Math.round(1 / DT),
    marks: { cutStroke: +tStart.toFixed(4), tipPeak: frames[peakI].t },
    summary: { tipPeak: Math.max(...tip), handPeak: Math.max(...hand), tipPeakT: frames[peakI].t, commits: n, tc },
    joints: JOINTS,
    bones: BONES,
    data: { n: frames.length, cols: { t: frames.map((q) => q.t), 'speed.tip': tip, 'speed.hand': hand, J: frames.flatMap((q) => q.J) } },
  };
}

// ── 잰 값 ──
const r0 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(2));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
function metrics(T) {
  const { S, i0, cut, moveT, scene, dx, dy, tgt, hasTap } = T;
  const t0 = cut.t0;
  const n = S.length;
  const iEnd = Math.min(n - 1, i0 + Math.round(WIN / DT));
  const ms = (i) => (i == null ? null : Math.round((S[i].gt - t0) * 1000));
  const argmax = (get, a = i0, b = iEnd) => { let best = a; for (let i = a; i <= b; i++) if (get(S[i]) > get(S[best])) best = i; return best; };
  const first = (pred, a = i0, b = n - 1) => { for (let i = a; i <= b; i++) if (pred(S[i], i)) return i; return null; };
  let chSum = 0;
  for (let i = i0; i <= iEnd; i++) chSum += S[i].chW;
  const sg = Math.sign(chSum) || 1; // 베는 쪽으로 도는 부호
  const iTip = argmax((s) => s.tipV), iTipFD = argmax((s) => s.tipVfd), iHand = argmax((s) => s.handV), iSh = argmax((s) => s.shV);
  const iPel = argmax((s) => sg * s.pelW), iCh = argmax((s) => sg * s.chW), iRelW = argmax((s) => s.swRelW), iKE = argmax((s) => s.KE);
  const iTc = argmax((s) => s.online); // 겨눈 선을 지나는 때
  const iRel = hasTap ? first((s) => s.release === true, i0, iEnd) : null; // 손목 놓아주기 시작
  const tcRel = (i) => (i == null ? null : Math.round((S[i].gt - S[iTc].gt) * 1000));
  const seq = { pelvis: tcRel(iPel), chest: tcRel(iCh), shoulder: tcRel(iSh), hand: tcRel(iHand), release: tcRel(iRel), tip: tcRel(iTip) };
  const ordered = iPel <= iCh && iCh <= iSh && iSh <= iHand && iHand <= iTip;
  const p = S[iTip].part, tv = S[iTip].tipV;
  let trunkSum = 0, tipSum = 0;
  for (let i = i0; i <= iTip; i++) (trunkSum += S[i].part.pel + S[i].part.spine), (tipSum += S[i].tipV);
  const share = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, r2(v)]));
  const sharePct = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, r0((100 * v) / tv)]));
  // 일 (베기 창)
  let Wwr = 0, WwrPos = 0, Woff = 0;
  for (let i = i0; i <= iEnd; i++) {
    if (S[i].Pw != null) (Wwr += S[i].Pw * DT), (WwrPos += Math.max(0, S[i].Pw) * DT);
    Woff += S[i].Po * DT;
  }
  // 포화 비율 (베기 창 · 칼끝 최고까지)
  const pct = (k, b = iEnd) => { if (!hasTap) return null; let c = 0; for (let i = i0; i <= b; i++) if (S[i][k] === true) c++; return Math.round((100 * c) / (b - i0 + 1)); };
  const pctAim = (b = iEnd) => { if (!hasTap) return null; let c = 0; for (let i = i0; i <= b; i++) if (S[i].wAimRaw > 25) c++; return Math.round((100 * c) / (b - i0 + 1)); };
  const sat = {
    wrist: pct('wrSat'), wristToTip: pct('wrSat', iTip), shoulder: pct('shSat'), shoulderToTip: pct('shSat', iTip), elbow: pct('elSat'), elbowToTip: pct('elSat', iTip),
    chestY: pct('chSatY'), abdY: pct('abSatY'), chVclamp: pct('chVclamp'), abVclamp: pct('abVclamp'), wAim25: pctAim(), wAim25ToTip: pctAim(iTip),
    release: pct('release'), brake: pct('brake'), hlClip: pct('hlClip'),
    wrHillAtTip: hasTap ? r2(S[iTip].wrHill) : null, shHillAtTip: hasTap ? r2(S[iTip].shHill) : null, elHillAtTip: hasTap ? r2(S[iTip].elHill) : null,
  };
  // 지연 (mx.mjs lat): 손가락 시작 → 각 단계가 2 cm / 5 cm 움직인 때
  const fl = Math.hypot(dx, dy), u = [dx / fl, dy / fl];
  const along2 = (k, thr) => { const p0 = S[i0][k]; return first((s) => (s[k][0] - p0[0]) * u[0] + (s[k][1] - p0[1]) * u[1] >= thr); };
  const moved3 = (k, thr) => { const p0 = S[i0][k]; return first((s) => s[k].distanceTo(p0) >= thr); };
  const deg5 = (k) => { const a0 = S[i0][k]; return first((s) => Math.abs(s[k] - a0) >= 5); };
  const iLagEnd = Math.min(n - 1, i0 + Math.round((moveT + 0.15) / DT));
  const lagMs = (ka, kb) => {
    let best = [1e9, 0];
    for (let L = 0; L <= 40; L++) {
      let e = 0, m = 0;
      for (let i = i0; i + L < iLagEnd; i++) { const a = S[i][ka], b = S[i + L][kb]; e += (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2; m++; }
      if (m > 5 && e / m < best[0]) best = [e / m, L];
    }
    return Math.round(best[1] * DT * 1000);
  };
  const lat = { off2: ms(along2('off', 0.02)), aimRaw2: ms(along2('aimRaw', 0.02)), aim2: ms(along2('aim', 0.02)), tgt2: ms(moved3('tgtH', 0.02)), hand2: ms(moved3('hand', 0.02)), tip5: ms(moved3('tip', 0.05)), lagAim: lagMs('off', 'aim'), pelvis5: ms(deg5('pelTw')), chest5: ms(deg5('chTw')) };
  // 대가
  const cost = {};
  if (scene === 'stop') {
    const tStop = t0 + moveT;
    const iStop = first((s) => s.gt >= tStop - 1e-9) ?? n - 1;
    const g = guardAt(tgt[0], tgt[1], {});
    const hStop = new THREE.Vector3(g.hand[0], g.hand[1], g.hand[2]);
    let over = 0, path = 0, tipPk = 0;
    for (let i = iStop; i < n; i++) {
      over = Math.max(over, S[i].handH.distanceTo(hStop));
      tipPk = Math.max(tipPk, S[i].tipV);
      if (i > iStop) path += S[i].hand.distanceTo(S[i - 1].hand);
    }
    let run = 0, iSettle = null;
    for (let i = iStop; i < n && iSettle == null; i++) { run = S[i].tipV < 1.5 ? run + 1 : 0; if (run >= Math.round(0.05 / DT)) iSettle = i; }
    Object.assign(cost, { stopOver_m: r3(over), stopFinal_m: r3(S[n - 1].handH.distanceTo(hStop)), stopHandPath_m: r3(path), stopTipPk_mps: r1(tipPk), stopSettle_ms: iSettle == null ? null : Math.round((S[iSettle].gt - tStop) * 1000), committedAfterStop: T.commits.some((c) => c.st === 'B' && c.gt >= t0 - 0.05) });
  }
  if (scene === 'air') {
    const tLift = cut.t1;
    const g = guardAt(PAD.Pflug[0], PAD.Pflug[1], {});
    const home = new THREE.Vector3(g.hand[0], g.hand[1], g.hand[2]);
    const iHome = tLift == null ? null : first((s) => s.gt >= tLift && s.handH.distanceTo(home) < 0.06 && s.tipV < 1.5);
    const s0 = S[i0];
    const fx = Math.cos(s0.heading), fz = -Math.sin(s0.heading);
    const along = (s) => (s.com.x - s0.com.x) * fx + (s.com.z - s0.com.z) * fz;
    const side = (s) => (s.com.x - s0.com.x) * -fz + (s.com.z - s0.com.z) * fx;
    let comMax = -1e9, vPk = 0, iV = i0, sMin = 1, iS = i0;
    for (let i = i0; i < n; i++) {
      comMax = Math.max(comMax, along(S[i]));
      const sp = Math.hypot(S[i].comV.x, S[i].comV.z);
      if (sp > vPk) (vPk = sp), (iV = i);
      if (S[i].s < sMin) (sMin = S[i].s), (iS = i);
    }
    const iSettle = first((s) => Math.hypot(s.comV.x, s.comV.z) < 0.1, iV);
    const iS9 = first((s) => s.s >= 0.9, iS);
    Object.assign(cost, { recover_ms: iHome == null || tLift == null ? null : Math.round((S[iHome].gt - tLift) * 1000), comMax_m: r3(comMax), comEnd_m: r3(along(S[n - 1])), comSide_m: r3(side(S[n - 1])), comVpk_mps: r2(vPk), settle_ms: ms(iSettle), supportMin: r3(sMin), support9_ms: ms(iS9), catches: T.catches, knockdowns: T.kd });
  }
  if (scene === 'hit') {
    const hits = T.wounds.filter((w) => w.gt >= t0 && w.gt <= t0 + 0.8);
    const h = hits[0];
    Object.assign(cost, { hits: hits.length, hitZone: h?.zone ?? null, hitE_J: r0(h?.E), hitV_mps: r1(h?.v), hitMEff_kg: r2(h?.mEff), hit_ms: h ? Math.round((h.gt - t0) * 1000) : null });
  }
  const cms = T.commits.filter((c) => c.gt >= t0 - 0.05).map((c) => `${c.st}@${Math.round((c.gt - t0) * 1000)}`);
  return {
    fam: T.fam, mode: T.mode, scene, key: `${T.fam}/${T.mode}/${scene}`, hasTap,
    tip: r2(tv), tipFD: r2(S[iTipFD].tipVfd), t_tip: ms(iTip), hand: r2(S[iHand].handV), t_hand: ms(iHand), shoulder: r2(S[iSh].shV), t_shoulder: ms(iSh),
    pelRate: r0(sg * S[iPel].pelW * R2D), t_pelvis: ms(iPel), chRate: r0(sg * S[iCh].chW * R2D), t_chest: ms(iCh), chAtTip_pct: r0((100 * S[iTip].chW) / (S[iCh].chW || 1)),
    swRelW: r1(S[iRelW].swRelW), t_swRel: ms(iRelW), swW: r1(Math.max(...S.slice(i0, iEnd + 1).map((s) => s.swW))),
    tc: ms(iTc), onlineMax: r3(S[iTc].online), tipAtTc: r2(S[iTc].tipV), seq, ordered,
    share, sharePct, trunkAtTip_pct: r0((100 * (p.pel + p.spine)) / tv), trunkCut_pct: r0((100 * trunkSum) / tipSum),
    KE_J: r1(S[iKE].KE), t_KE: ms(iKE), KEatTc_J: r1(S[iTc].KE), KEatTip_J: r1(S[iTip].KE), Wwr_J: hasTap ? r1(Wwr) : null, WwrPos_J: hasTap ? r1(WwrPos) : null, Woff_J: hasTap ? r1(Woff) : null,
    sat, lat, cost, commits: cms.join(','), nCommits: T.commits.length,
  };
}

// ── 돌리기 ──
mkdirSync(OUT, { recursive: true });
const rows = [];
const records = [];
const tag = R0_OFF ? 'R0_OFF=1' : 'R0 켬';
console.log(`chain.mjs  root ${ROOT}  코드 ${CODE}  물리 ${HZ} Hz  입력 ${INPUT} Hz  시드 ${SEED}  무기 ${WEAPON}  끝 ${VF} m/s  ${tag}${sets.length ? '  set ' + sets.join(' ') : ''}`);
const t00 = Date.now();
for (const fam of FAMS)
  for (const mode of MODES)
    for (const scene of SCENES) {
      const T = trial(fam, mode, scene);
      const m = metrics(T);
      if (scene === 'air') {
        const rec = makeRecord(T, m.tc);
        m.shape = shapeMetrics(rec);
        m.record = { tipPeak: rec.summary.tipPeak, handPeak: rec.summary.handPeak, tipPeakT: rec.summary.tipPeakT, n: rec.data.n };
        records.push(rec);
        if (RECORD) writeRecord(OUT, rec);
      }
      rows.push(m);
    }
const elapsed = ((Date.now() - t00) / 1000).toFixed(1);
const hasTap = rows.some((r) => r.hasTap);

// ── 표 ──
const pad = (v, w, right = true) => { const s = v == null ? '·' : String(v); return right ? s.padStart(w) : s.padEnd(w); };
const seqStr = (q) => ['pelvis', 'chest', 'shoulder', 'hand', 'release', 'tip'].map((k) => (q[k] == null ? '·' : q[k])).join('/');
const cols1 = [['무리', 6, false], ['방식', 6, false], ['장면', 4, false], ['칼끝', 6], ['(fd)', 6], ['t', 4], ['손', 5], ['어깨', 5], ['골반°/s', 7], ['t', 4], ['가슴°/s', 7], ['t', 4], ['가슴@칼끝%', 9], ['손목rad/s', 8], ['tc', 4], ['순서 골반/가슴/어깨/손/풀기/칼끝 (tc기준 ms)', 40, false], ['몸통%최고/베기', 13], ['KE J', 6], ['@tc', 6], ['손목 J', 6], ['빈손 J', 6], ['결심', 12, false]];
const row1 = (r) => [r.fam, r.mode, r.scene, r.tip, r.tipFD, r.t_tip, r.hand, r.shoulder, r.pelRate, r.t_pelvis, r.chRate, r.t_chest, r.chAtTip_pct, r.swRelW, r.tc, seqStr(r.seq) + (r.ordered ? '' : ' ×'), `${r.trunkAtTip_pct}/${r.trunkCut_pct}`, r.KE_J, r.KEatTc_J, r.Wwr_J, r.Woff_J, r.commits || '-'];
const satStr = (s) => (s.wrist == null ? '(탭 없음)' : `${s.wrist}/${s.shoulder}/${s.elbow}/${s.chestY}/${s.abdY}/${s.wAim25}/${s.hlClip} (${s.wristToTip}/${s.shoulderToTip}/${s.elbowToTip})`);
const latStr = (l) => [l.tgt2, l.hand2, l.tip5, l.lagAim, l.pelvis5, l.chest5].map((x) => (x == null ? '·' : x)).join('/');
const costStr = (r) => {
  const c = r.cost;
  if (r.scene === 'stop') return `넘침 ${c.stopOver_m} m 끝 ${c.stopFinal_m} m 손길 ${c.stopHandPath_m} m 칼끝 ${c.stopTipPk_mps} m/s 진정 ${c.stopSettle_ms ?? '·'} ms${c.committedAfterStop ? ' 결심됨' : ''}`;
  if (r.scene === 'air') return `복귀 ${c.recover_ms ?? '·'} ms 쏠림 ${c.comMax_m}/${c.comEnd_m} m 옆 ${c.comSide_m} m 무게중심 ${c.comVpk_mps} m/s 진정 ${c.settle_ms ?? '·'} ms 지탱 ${c.supportMin} (${c.support9_ms ?? '·'} ms) 잡는 걸음 ${c.catches} 넘어짐 ${c.knockdowns}`;
  return c.hits ? `상처 ${c.hits} 첫 ${c.hitZone} ${c.hitE_J} J ${c.hitV_mps} m/s m ${c.hitMEff_kg} kg @${c.hit_ms} ms` : '상처 없음';
};
const cols2 = [['무리', 6, false], ['방식', 6, false], ['장면', 4, false], ['포화% 손목/어깨/팔꿈치/가슴/배/wAim25/손깎임 (최고까지)', 44, false], ['지연 ms 목표2/손2/칼끝5/고른/골반5/가슴5', 32, false], ['대가', 0, false]];
const row2 = (r) => [r.fam, r.mode, r.scene, satStr(r.sat), latStr(r.lat), costStr(r)];
function table(cols, rowFn, title) {
  console.log(`\n[${title}]`);
  console.log(cols.map(([h, w, rt]) => pad(h, w, rt)).join(' '));
  for (const r of rows) console.log(rowFn(r).map((v, i) => pad(v, cols[i][1], cols[i][2] !== false)).join(' '));
}
table(cols1, row1, '속도·사슬 (t = 획 시작 기준 ms, 창 0.6 s)');
table(cols2, row2, '포화·지연·대가');
if (rows.some((r) => r.shape)) {
  console.log('\n[모양 (동작 연구 PM shape_metrics, air)]');
  for (const r of rows) if (r.shape) console.log(`${pad(r.fam, 6, false)} ${pad(r.mode, 6, false)}`, JSON.stringify(r.shape));
}
if (MD) {
  const md = (cols, rowFn) => { console.log('| ' + cols.map((c) => c[0]).join(' | ') + ' |'); console.log('|' + cols.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + rowFn(r).map((v) => (v == null ? '·' : v)).join(' | ') + ' |'); };
  console.log('\n### 속도·사슬\n'); md(cols1, row1);
  console.log('\n### 포화·지연·대가\n'); md(cols2, row2);
}

// ── 기록 J 칸이 앞선 기록과 같은가 (record_wbs.mjs 재현 증명) ──
if (CHECK) {
  console.log(`\n[기록 견주기 ${CHECK}]`);
  let same = 0, diff = 0;
  for (const rec of records) {
    const fp = join(resolve(CHECK), `${rec.id}.json`);
    if (!existsSync(fp)) { console.log(`${rec.id.padEnd(20)} 없음`); diff++; continue; }
    const o = JSON.parse(readFileSync(fp, 'utf8'));
    const eq = (k) => JSON.stringify(rec.data.cols[k]) === JSON.stringify(o.data.cols[k]);
    const ok = eq('J') && eq('t') && eq('speed.tip') && eq('speed.hand') && rec.data.n === o.data.n;
    let firstDiff = null;
    if (!eq('J')) for (let i = 0; i < rec.data.cols.J.length; i++) if (rec.data.cols.J[i] !== o.data.cols.J[i]) { firstDiff = i; break; }
    console.log(`${rec.id.padEnd(20)} ${ok ? '같음' : `다름 (J 첫 차이 칸 ${firstDiff ?? '-'}, n ${rec.data.n} vs ${o.data.n}, 칼끝 ${rec.summary.tipPeak} vs ${o.summary.tipPeak})`}  표본 ${rec.data.n}`);
    ok ? same++ : diff++;
  }
  console.log(`J·t·speed 칸 같음 ${same} / 다름 ${diff}`);
}

// ── json ──
const outJ = { format: 'chain/1', meta: { root: ROOT, branch, rev, code: CODE, physicsHz: HZ, inputHz: INPUT, seed: SEED, weapon: WEAPON, v: VF, r0off: R0_OFF, hasTap, sets, generated: new Date().toISOString(), elapsed_s: +elapsed, cmd: process.argv.slice(2).join(' ') }, rows };
writeFileSync(JSON_OUT, JSON.stringify(outJ, null, 1));
console.log(`\njson ${JSON_OUT}${RECORD && records.length ? `  기록 ${OUT}/wbs_*.json` : ''}  (${elapsed} s)`);

// ── 앞선 json 과 견주기: 칼끝·KE·상처 Δ%, 지연 Δms ──
if (VS) {
  const prev = JSON.parse(readFileSync(resolve(VS), 'utf8'));
  console.log(`\n[견주기] 기준 ${prev.meta.code} (${prev.meta.physicsHz}/${prev.meta.inputHz} Hz) → 지금 ${CODE}. 표 = |Δ| > 3 % 또는 > ${STEP_MS.toFixed(1)} ms (물리 한 스텝)`);
  const dpct = (a, b) => (a == null || b == null ? null : b === 0 ? (a === 0 ? 0 : null) : (100 * (a - b)) / Math.abs(b));
  const dms = (a, b) => (a == null || b == null ? null : a - b);
  const fmt = (d, unit) => (d == null ? '·' : `${d > 0 ? '+' : ''}${unit === '%' ? d.toFixed(1) : Math.round(d)}${unit}`);
  const flag = (d, unit) => d != null && Math.abs(d) > (unit === '%' ? 3 : STEP_MS + 1e-9);
  let armFlags = 0, armRows = 0, allFlags = 0;
  console.log(pad('키', 20, false), ['칼끝', 'KE', '상처E', '칼끝t', 'tc', '목표2', '손2', '칼끝5', '고른', '골반5', '가슴5', '복귀'].map((h) => pad(h, 8)).join(' '));
  for (const r of rows) {
    const q = prev.rows.find((x) => x.key === r.key);
    if (!q) { console.log(pad(r.key, 20, false), '기준에 없음'); continue; }
    const items = [
      [dpct(r.tip, q.tip), '%'], [dpct(r.KE_J, q.KE_J), '%'], [r.scene === 'hit' ? dpct(r.cost.hitE_J, q.cost.hitE_J) : null, '%'],
      [dms(r.t_tip, q.t_tip), 'ms'], [dms(r.tc, q.tc), 'ms'], [dms(r.lat.tgt2, q.lat.tgt2), 'ms'], [dms(r.lat.hand2, q.lat.hand2), 'ms'], [dms(r.lat.tip5, q.lat.tip5), 'ms'],
      [dms(r.lat.lagAim, q.lat.lagAim), 'ms'], [dms(r.lat.pelvis5, q.lat.pelvis5), 'ms'], [dms(r.lat.chest5, q.lat.chest5), 'ms'], [r.scene === 'air' ? dms(r.cost.recover_ms, q.cost.recover_ms) : null, 'ms'],
    ];
    const fl = items.filter(([d, u]) => flag(d, u)).length;
    if (r.mode === 'arm') (armRows++, (armFlags += fl ? 1 : 0));
    allFlags += fl ? 1 : 0;
    console.log(pad(r.key, 20, false), items.map(([d, u]) => pad(fmt(d, u) + (flag(d, u) ? '!' : ''), 8)).join(' '));
  }
  console.log(`팔 베기(arm) 관문 ±3 %·1 스텝: ${armFlags ? `표 ${armFlags}/${armRows} 줄 — 살펴볼 것` : `통과 (${armRows} 줄 모두 안)`} · 전체 표 ${allFlags}/${rows.length} 줄`);
}
