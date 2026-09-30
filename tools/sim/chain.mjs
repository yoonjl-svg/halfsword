// ─────────────────────────────────────────────────────────────
//  chain.mjs — 온몸 베기 측정 한 벌 (R0: 재설계 docs/whole_body_redesign.md §8 R0 행 / R2 W5: docs/strike/r2_impl_spec.md §8.2 관문 차례)
//
//   node tools/sim/chain.mjs [--variant=W|hold] [--modes=game,plain] [--root=<체크아웃>] [--weapon=longsword[,..]] [--hz=120] [--input=60[,120]]
//        [--v=12[,..]] [--ginput=wind[,stroke]] [--clock=finger[,floor]] [--seed=7] [--fams=diagR,vert,horizR,riseR] [--scenes=air,stop,hit]
//        [--blocks=rows,latency,mx,pace] [zornhau-wind] [--jitter] [--no-channels] [--record] [--out=tools/sim/out/chain]
//        [--json=<파일>] [--vs=<앞선 json>] [--check=<기록 폴더>] [--set=GRP.key=val ...] [--md] [--no-record]
//   환경 변수: HZ=<입력 Hz 목록> (= --input) · SPEED=4,6,12,20 (= --v) · PACE=script (= --blocks 에 pace) · JITTER=1 (= --jitter)
//
//  Hz: --hz = 물리 Hz (게임 120 고정), --input·HZ = 화면(손가락) 프레임 Hz. JITTER = 화면 프레임 24–45 fps (씨앗 고정 수열, 판마다 같은 수열)
//  장면 변형 (--variant): W (기본) = 쟁기 2 s → 감기 자리 3 m/s, 머묾 0 (손가락이 거꾸로 돌아 곧장 벤다) → 끝 자리 v m/s 획
//                         hold = 쟁기 2 s → 감기 자리 1.2 m/s + 1 s 머묾 → 끝 자리 (옛 기본)
//  방식 (--modes): game = 설정 그대로 (드라이브·손짓 켬), plain = 같은 커밋 DRIVE.on=false (맨 팔 베기).
//    옛 arm / commit 방식 (옛 결심 경로 끔·켬) 은 R2 W5 가 그 경로와 함께 지웠다 (지우기 전 체크아웃의 chain.mjs 로 잰다)
//  --ginput = GESTURE.input (A 'wind' / B 'stroke'), --clock = GESTURE.clock ('floor' 는 시뮬 전용)
//
//  --root 의 src/ 와 tools/sim/harness_m.mjs 를 읽기만 한다(다른 가지의 체크아웃도 된다). 동작 연구 PM 의 라이브러리(tools/motion/lib)는
//  이 저장소 것을 쓴다. 조건은 옛 tools/motion/record_wbs.mjs(= tseq.mjs, 둘 다 R2 W5 가 지움)와 같다: hybrid 걸음, skill 0.7, 상대는 서 있기만(칼 충돌 끔).
//  장면: air = 2.0 m 헛치기(내 칼 충돌 끔, 기록 파일을 낸다) · stop = 획 절반에서 손가락 멈춤(1 s 누른 채) · hit = 1.55 m 에서 맞힘(내 칼 충돌 켬)
//  내는 것: (1) 동작 연구 PM 의 stillness-motion-record/1 기록(air 장면, --out 폴더 — docs/motion 에는 쓰지 않는다. --check = 기록 폴더와 J 칸 견줌)
//         (2) 표: 칼끝·손·골반·가슴 최고와 때, 겨눈 선을 지난 때 tc, 사슬 순서(tc 기준), 칼끝 속도의 몸통·팔·손목 몫, 칼 운동에너지, 손목·빈손 일,
//             근육 한계 포화 비율(fighter.ins 계측 탭), 지연(손가락 → 손 목표 2 cm·손 2 cm·칼끝 5 cm·고른 지연·골반/가슴 5°), 대가(멈춤 넘침·복귀·쏠림·상처)
//         (3) --json 한 벌. --vs=<앞선 json> 이면 칼끝·KE·상처 에너지 Δ%, 지연 Δms 를 견주고 |Δ| > 3 % 또는 물리 한 스텝 넘는 것에 표를 한다
//         (4) game/plain 행 (R2 W5): 칼끝 최고·때 (베기 창 = 획 시작 … 손짓 층이 다시 idle, 최고가 창 끝이면 peakAtEdge), tc 운동에너지, 첫 상처 J·ms·부위, tCut 의 손 높이·뒤·손 길, 넘어짐, S·c 최고, 되돌아감(hitch),
//             걸음 (tLand − tTc), 사슬 순서 (10 ms 같음), 스텝마다 채널 (f.strike S/φ/φ̇/상태/무리/c/over + drive.debug 전부, json 'channels') + 요약
//             되돌아감 = tCut … 몸 위상 tc (φB ≥ 0.85, 맨 팔은 손짓 φ) 사이, 손이 tCut 의 제 자리보다 베는 쪽으로 나간 뒤 그 자리로 되돌아가는
//             빠르기의 최고 (가슴 원점·바라보는 틀). 관문 0.5 m/s. (옛 관문은 φ 0 클립 손 쪽 빠르기라 큰 감기를 앞으로 베는 것을 셌다)
//         (5) 묶음 (--blocks): latency = 감기가 손가락을 따르나 (zornhau-wind: 3 m/s 끌기·0.3 m/50 ms 걸음 → 골반·가슴 5°, 관문 33/25 ms),
//             mx = 짜 놓은 위상(drive.script, S 1, 클립 빠르기) 추적 기록의 모양 (shape_metrics) + 추적 (DTW), pace = 짜 놓은 위상 걸음 착지 (tc ± 50 ms)
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
const POS = []; // 이름 붙은 장면 (zornhau-wind = latency 묶음)
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m && /^[a-z]+-[a-z]+$/.test(a)) {
    POS.push(a);
    continue;
  }
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  if (m[1] === 'set') sets.push(m[2]);
  else args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = realpathSync(resolve(arg('root', resolve(HERE, '..', '..')))); // realpath: harness 가 상대 경로로 여는 config 와 같은 모듈이 되게
const VARIANT = arg('variant', 'W');
if (VARIANT !== 'W' && VARIANT !== 'hold') throw new Error(`모르는 변형 ${VARIANT} (W | hold)`);
const WEAPONS = list('weapon', 'longsword');
const WEAPON = WEAPONS[0];
const HZ = +arg('hz', 120); // 물리 Hz
const INPUTS = list('input', process.env.HZ || 60).map(Number); // 화면(손가락) 프레임 Hz
const INPUT = INPUTS[0];
const SEED = +arg('seed', 7);
const VFS = list('v', process.env.SPEED || 12).map(Number);
const VF = VFS[0];
const FAMS = list('fams', 'diagR,vert,horizR,riseR');
const MODES = list('modes', 'game,plain');
for (const m of MODES) if (!['game', 'plain'].includes(m)) throw new Error(`모르는 방식 ${m}${m === 'arm' || m === 'commit' ? ' (옛 결심 경로와 함께 R2 W5 가 지웠다)' : ''}`);
const SCENES = list('scenes', 'air,stop,hit');
const JITTER = process.env.JITTER === '1' || !!arg('jitter', false);
const BLOCKS = new Set(list('blocks', 'rows'));
if (POS.includes('zornhau-wind')) BLOCKS.add('latency');
for (const p of POS) if (p !== 'zornhau-wind') throw new Error(`모르는 장면 ${p}`);
if (process.env.PACE === 'script') BLOCKS.add('pace');
const CHANNELS = !arg('no-channels', false);
// 감기 자리로 가는 빠르기 (m/s)·머묾 (ms): W = 큰 감기에서 곧장 거꾸로 (3 m/s, 0), hold = 옛 1.2 m/s + 1 s
const CHV = VARIANT === 'hold' ? 1.2 : 3;
const HOLD = VARIANT === 'hold' ? 1000 : 0;
const OUT = resolve(arg('out', 'tools/sim/out/chain'));
const JSON_OUT = resolve(arg('json', join(OUT, `chain_${WEAPON}_${HZ}_${INPUT}.json`)));
const VS = arg('vs', null);
const CHECK = arg('check', null);
const MD = !!arg('md', false);
const RECORD = !!arg('record', false); // --record 일 때만 (행이 많다)
const R0_OFF = process.env.R0_OFF === '1';

const GAP = 2.0; // 헛치기·멈춤 거리 (record_wbs.mjs)
const HIT_DIST = 1.55; // 맞힘 거리 (costs/probe.mjs)
const PRE = 0.6; // 기록 시각 0 = 베기 획 − PRE
const POST_REC = 1.0; // 기록 창: 획 뒤 이만큼 (record_wbs.mjs)
const POST = 2.5; // 대가 창: 획(멈춤 장면은 손가락 멈춤) 뒤 이만큼
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
// 게임 설정 (--set 뒤): game/plain 은 판마다 이것으로 되돌린다 (plain 은 DRIVE.on 만 끈다)
const BASE = { drive: cfg.DRIVE?.on, input: cfg.GESTURE?.input, clock: cfg.GESTURE?.clock };
const GINPUTS = list('ginput', BASE.input ?? 'wind');
const CLOCKS = list('clock', BASE.clock ?? 'finger');
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { newRound, DT, THREE, V, Q, handPos, feedTrace, inputPump } = H;
const { guardAt } = await import(pathToFileURL(join(ROOT, 'src/guards.js')).href);
const { getWeapon } = await import(pathToFileURL(join(ROOT, 'src/weapons.js')).href);
for (const w of WEAPONS)
  if (getWeapon(w).gun) {
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
    act: sk.activity,
    com: P.com ? P.com.clone() : V(B.pelvis.translation()), comV: P.comVel.clone(), s: P.support, offB: P.offBalance, state: P.state,
    // 계측 탭 (fighter.ins, 없으면 undefined)
    wrSat: wr.sat, wrHill: wr.hill, wAimRaw: wr.wAimRaw, release: wr.release, brake: wr.brake,
    shSat: shI.sat, shHill: shI.hill, elSat: el.sat, elHill: el.hill,
    chSatY: sp.chest?.satY, abSatY: sp.abdomen?.satY, chVclamp: sp.chest?.velClampY, abVclamp: sp.abdomen?.velClampY,
    hlClip: I.hl ? I.hl[3] > I.hl[0] + 1e-9 : undefined,
  };
}

// ── 새 방식 (game/plain) 스텝 채널: f.strike 와 drive.debug 전부 (읽기만) ──
const FAM_NAMES = [];
const famIdx = (s) => {
  if (s == null) return -1;
  let i = FAM_NAMES.indexOf(s);
  if (i < 0) i = FAM_NAMES.push(s) - 1;
  return i;
};
const STRIKE_KEYS = ['S', 'phi', 'phiDot', 'state', 'fam', 'c', 'over'];
function chanNames(P) {
  const n = STRIKE_KEYS.map((k) => `strike.${k}`);
  n.push('drive.w', 'drive.phiB');
  const d = P.drive?.debug;
  if (d) for (const [k, v] of Object.entries(d)) if (ArrayBuffer.isView(v)) for (let j = 0; j < v.length; j++) n.push(`debug.${k}.${j}`);
    else n.push(`debug.${k}`);
  return n;
}
const p5 = (x) => (typeof x === 'number' ? (Number.isFinite(x) ? +x.toPrecision(5) : null) : x == null ? null : +x);
function chanRow(P) {
  const s = P.strike || {};
  const r = [p5(s.S ?? 0), p5(s.phi ?? -1), p5(s.phiDot ?? 0), s.state ?? 0, famIdx(s.fam ?? null), p5(s.c ?? 0), p5(s.over ?? 0)];
  const D = P.drive;
  r.push(D ? p5(D.w) : 0, D ? p5(D.cmd.phi) : null);
  if (D) for (const v of Object.values(D.debug)) if (ArrayBuffer.isView(v)) for (let j = 0; j < v.length; j++) r.push(p5(v[j]));
    else r.push(p5(v));
  return r;
}
/** 새 방식 표본 덧칸 (스텝 뒤, 읽기만) */
function sampleX(P) {
  const s = P.strike || {};
  const D = P.drive;
  return { st: s.state ?? 0, cuts: s.stats?.cuts ?? 0, S: s.S ?? 0, c: s.c ?? 0, over: s.over ?? 0, phi: s.phi ?? -1, phiB: D ? D.cmd.phi : null, w: D ? D.w : 0, tTc: D ? D.debug.tTc : -1, tCutD: D ? D.debug.tCut : 0, dt: D ? D.t : 0 };
}
/** JITTER: 화면 프레임 24–45 fps, 씨앗 고정 수열 (판마다 처음부터) */
function jitterPump(G) {
  const P = G.pump;
  const fr = P.frame;
  let js = (SEED * 2654435761) >>> 0;
  P.frame = () => {
    js = (Math.imul(js, 1664525) + 1013904223) >>> 0;
    P.hz = 24 + (21 * js) / 4294967296;
    fr();
  };
}

/** 한 판: 옛 record_wbs.mjs 의 순서 그대로 + 표본 + 대가 창. o = { weapon, input, v, ginput, clock } */
function trial(fam, mode, scene, o) {
  const VF = o.v, INPUT = o.input;
  cfg.DRIVE.on = mode === 'plain' ? false : BASE.drive;
  cfg.GESTURE.input = o.ginput;
  cfg.GESTURE.clock = o.clock;
  const dist = scene === 'hit' ? HIT_DIST : GAP;
  const G = newRound({ walls: false, gap: dist + 0.17, seed: SEED, weapon: o.weapon });
  cfg.DRIVE.on = BASE.drive; // 드라이브는 판을 만들 때 붙는다 (plain = 붙지 않음)
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  if (scene !== 'hit') for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.level = 0.7;
  setPad(P, PAD.Pflug);
  inputPump(G, { hz: INPUT });
  if (o.jitter) jitterPump(G);
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
  // 채널 (감기 시작부터 전부) · 손 길 누적 (감기 시작부터)
  const chan = CHANNELS ? { names: chanNames(P), t0: G.t, rows: [] } : null;
  let pathCum = 0, hPrev = null;
  // 앞먹임 잡음 (드라이브 w > 0 스텝의 |최고|, 읽기만): 명령 가슴·골반 yaw 각가속도 (rad/s²), 몸통 앞먹임 회전력 (N·m), 팔 α_des
  const ffn = { chestYawDDot: 0, pelvisYawDDot: 0, ffChest: 0, ffAbd: 0, ffHip: 0, alphaDes: 0, steps: 0 };
  const snap = () => {
    const p = P.bodies.pelvis.translation();
    const fw = P.forward();
    const q = { J: jointsOf(P, THREE, W0), o: [p.x, p.z], yaw: Math.atan2(fw.z, fw.x), s: sample(G, P, E) };
    {
      const h = q.s.hand;
      if (hPrev) pathCum += h.distanceTo(hPrev);
      hPrev = h;
      q.s.x = sampleX(P);
      q.s.x.path = pathCum;
      if (chan) chan.rows.push(chanRow(P));
      const D = P.drive;
      if (D && D.w > 0) {
        const cm = D.cmd, d = D.debug;
        ffn.steps++;
        for (const [k, x] of [['chestYawDDot', cm.chestYawDDot], ['pelvisYawDDot', cm.pelvisYawDDot], ['ffChest', d.ffChest], ['ffAbd', d.ffAbd], ['ffHip', d.ffHip], ['alphaDes', d.alphaDes ?? 0]]) if (Math.abs(x) > ffn[k]) ffn[k] = Math.abs(x);
      }
    }
    return q;
  };
  const chq = feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], CHV, { hold: HOLD, lift: false }), INPUT);
  let nDrop = 0; // 버퍼 앞에서 버린 표본 수 (새 방식: 채널 줄과 맞춘다)
  while (!chq.done) {
    G.step();
    buf.push(snap());
    if (buf.length > keep) buf.shift(), nDrop++;
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
  const T = { fam, mode, scene, S: buf.map((q) => q.s), frames, i0, tStart, cut, moveT, dx, dy, tgt, gap: dist, commits, wounds, catches, kd, hasTap, o };
  {
    T.Jw = buf.map((q) => q.J); // 월드 관절 (tCut 의 손 높이·뒤)
    T.chan = chan ? { names: chan.names, i0: i0 + nDrop, rows: chan.rows } : null; // i0 = 채널 줄에서 획 시작 줄
    T.stats = { ...(P.strike?.stats || {}) };
    T.final = P.state;
    T.dbgEnd = P.drive ? Object.fromEntries(Object.entries(P.drive.debug).filter(([, v]) => typeof v === 'number')) : null;
    T.nDrop = nDrop;
    T.ffNoise = ffn;
  }
  return T;
}

// ── 기록 파일 (record/1) ──
function makeRecord(T, tc) {
  const { fam, mode, frames, tStart, commits } = T;
  const { v: VF, input: INPUT, weapon: WEAPON } = T.o;
  const hold = `${CHV} m/s + ${HOLD / 1000} s 머묾`;
  const mdesc = mode === 'game' ? '게임 설정' : '맨 팔 베기, DRIVE.on=false';
  const tip = speeds(frames, DT, 'tip');
  const hand = speeds(frames, DT, 'hS');
  const peakI = tip.indexOf(Math.max(...tip));
  const n = commits.length;
  return {
    format: 'stillness-motion-record/1',
    id: `wbs_${fam}_${mode}_${VARIANT}_${WEAPON}_v${VF}_in${T.o.jitter ? 'J' : INPUT}_${T.o.ginput}`,
    cut: FAM[fam].cut,
    kind: `wbs-${mode}`,
    source: `${CODE} (${mdesc}), chain.mjs = tseq.mjs 조건: hybrid, ${WEAPON}, skill 0.7, ${T.gap} m, 감기 ${hold} → 끝 ${VF} m/s, 입력 ${INPUT} Hz, 칼 충돌 끔. 결심 ${n}번`,
    cond: {
      code: CODE, seed: SEED, physicsHz: Math.round(1 / DT), recordHz: Math.round(1 / DT), inputHz: INPUT, weapon: WEAPON, gait: cfg.BODY.weightMode, skill: 0.7, gap: T.gap,
      input: `패드: Pflug ${JSON.stringify(PAD.Pflug)} 2 s → ${padName(FAM[fam].ch)} ${JSON.stringify(FAM[fam].ch)} ${hold} → ${padName(FAM[fam].end)} ${JSON.stringify(FAM[fam].end)} ${VF} m/s (tseq.mjs)`,
      commit: `DRIVE.on ${mode === 'game'} (확정 ${n}번)`,
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
/** 베기 창 끝: 손가락 획이 끝난 뒤 손짓 층이 처음 idle (상태 0) 로 돌아간 스텝, 없으면 마지막 (고정 창은 최고를 창 끝에서 잘랐다) */
function strokeEnd(T) {
  const { S, i0, moveT } = T;
  for (let i = i0 + Math.round(moveT / DT) + 1; i < S.length; i++) if (S[i].x.st === 0) return i;
  return S.length - 1;
}
function metrics(T) {
  const { S, i0, cut, moveT, scene, dx, dy, tgt, hasTap } = T;
  const t0 = cut.t0;
  const n = S.length;
  const iEnd = strokeEnd(T);
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
    const hits = T.wounds.filter((w) => w.gt >= t0 && w.gt <= S[iEnd].gt);
    const h = hits[0];
    Object.assign(cost, { hits: hits.length, hitZone: h?.zone ?? null, hitE_J: r0(h?.E), hitV_mps: r1(h?.v), hitMEff_kg: r2(h?.mEff), hit_ms: h ? Math.round((h.gt - t0) * 1000) : null });
  }
  const cms = T.commits.filter((c) => c.gt >= t0 - 0.05).map((c) => `${c.st}@${Math.round((c.gt - t0) * 1000)}`);
  return {
    fam: T.fam, mode: T.mode, scene, key: `${T.fam}/${T.mode}/${scene}`, hasTap,
    tip: r2(tv), peakAtEdge: iTip >= iEnd - 1, tWin: ms(iEnd), tipFD: r2(S[iTipFD].tipVfd), t_tip: ms(iTip), hand: r2(S[iHand].handV), t_hand: ms(iHand), shoulder: r2(S[iSh].shV), t_shoulder: ms(iSh),
    pelRate: r0(sg * S[iPel].pelW * R2D), t_pelvis: ms(iPel), chRate: r0(sg * S[iCh].chW * R2D), t_chest: ms(iCh), chAtTip_pct: r0((100 * S[iTip].chW) / (S[iCh].chW || 1)),
    swRelW: r1(S[iRelW].swRelW), t_swRel: ms(iRelW), swW: r1(Math.max(...S.slice(i0, iEnd + 1).map((s) => s.swW))),
    tc: ms(iTc), onlineMax: r3(S[iTc].online), tipAtTc: r2(S[iTc].tipV), seq, ordered,
    share, sharePct, trunkAtTip_pct: r0((100 * (p.pel + p.spine)) / tv), trunkCut_pct: r0((100 * trunkSum) / tipSum),
    KE_J: r1(S[iKE].KE), t_KE: ms(iKE), KEatTc_J: r1(S[iTc].KE), KEatTip_J: r1(S[iTip].KE), Wwr_J: hasTap ? r1(Wwr) : null, WwrPos_J: hasTap ? r1(WwrPos) : null, Woff_J: hasTap ? r1(Woff) : null,
    sat, lat, cost, commits: cms.join(','), nCommits: T.commits.length,
  };
}


// ── 새 방식 (game/plain) 행 칸: 기준 (1)·되돌아감·tCut 의 손·넘어짐·S·걸음 ──
const IXJ = Object.fromEntries(JOINTS.map((n, i) => [n, i * 3]));
const PJ = (J, n) => [J[IXJ[n]], J[IXJ[n] + 1], J[IXJ[n] + 2]];
const HITCH_GATE = 0.5; // m/s (§9 W4 줄)
function newMetrics(T, m) {
  const { S, i0, cut } = T;
  const t0 = cut.t0;
  const n = S.length;
  const ms = (i) => (i == null ? null : Math.round((S[i].gt - t0) * 1000));
  const game = T.mode === 'game';
  // tCut = 획 시작 (6 스텝 앞부터) 뒤 손짓 층의 베기 수가 처음 느는 스텝 (맨 팔도 손짓 층은 돈다. (B) 는 감기 자리로 가는 획도 베기라 그것은 뺀다)
  let iC = null;
  for (let i = Math.max(1, i0 - 6); i < n; i++) if (S[i].x.cuts > S[i - 1].x.cuts) { iC = i; break; }
  // 몸 위상 tc: game = drive φB ≥ 0.85 (drive.debug.tTc), plain = 손짓 φ ≥ 0.85
  //  game 은 이 획의 beginCut 이 쓴 tCut 만 (드라이브 시계가 tCut 앞 스텝보다 뒤). 감기 자리로 가는 획 (B 에선 베기) 의 옛 tCut·tTc 는 창을 0 스텝으로 만든다
  let iTcB = null;
  if (iC != null) {
    const tPrev = S[iC - 1].x.dt;
    for (let i = iC; i < n; i++) {
      const x = S[i].x;
      if (game ? x.tCutD > tPrev && x.tTc >= x.tCutD : (x.st === 2 || x.st === 3) && x.phi >= 0.85) { iTcB = i; break; }
    }
  }
  // 되돌아감: tCut(없으면 획 시작) … 몸 위상 tc (없으면 겨눈 선 tc). 가슴 원점·바라보는 틀의 손 (몸이 옮겨·도는 몫은 뺀다)
  const iA = iC ?? i0;
  // 몸 위상 tc 가 없으면 (손짓 층이 이 획을 베기로 읽지 않음) 겨눈 선 tc 와 칼끝 최고 중 늦은 것까지
  const iTcOn = i0 + Math.round(Math.max(m.tc ?? 0, m.t_tip ?? 0) / (DT * 1000));
  const iB = Math.min(n - 1, iTcB ?? Math.max(iA + 1, iTcOn));
  const h0 = S[iA].handH, dC = S[iB].handH.clone().sub(h0);
  let hitch = 0, hitchRaw = 0, iH = null;
  for (let i = iA + 1; i <= iB; i++) {
    const rel = S[i].handH.clone().sub(h0);
    const L = rel.length();
    if (L < 1e-9) continue;
    const tow = -S[i].handH.clone().sub(S[i - 1].handH).dot(rel) / L / DT; // tCut 의 제 자리 쪽으로 가는 빠르기
    if (tow > hitchRaw) hitchRaw = tow;
    if (rel.dot(dC) > 0 && tow > hitch) (hitch = tow), (iH = i); // 베는 쪽으로 나간 뒤 되돌아감만
  }
  // tCut 의 손: 머리 위 (손목 − (머리 + 0.1)), 가슴 앞면 뒤 (shape_metrics 와 같은 식), 감기 시작 → tCut 손 길
  const J = T.Jw[iA];
  const hS = PJ(J, 'hS'), head = PJ(J, 'head'), C = PJ(J, 'chest'), sv = [PJ(J, 'shS')[0] - PJ(J, 'shO')[0], 0, PJ(J, 'shS')[2] - PJ(J, 'shO')[2]];
  const y = Math.atan2(-sv[0], sv[2]);
  const handTopCut = hS[1] - (head[1] + 0.1);
  const handBackCut = -((hS[0] - C[0]) * Math.cos(y) + (hS[2] - C[2]) * Math.sin(y) - 0.11);
  const iEnd = strokeEnd(T);
  let Smax = 0, cMax = 0, overMax = 0;
  for (let i = 0; i < n; i++) {
    const x = S[i].x;
    if (x.S > Smax) Smax = x.S;
    if (x.c > cMax) cMax = x.c;
    if (x.over > overMax) overMax = x.over;
  }
  const hit = T.scene === 'hit' ? T.wounds.filter((w) => w.gt >= t0 && w.gt <= S[iEnd].gt)[0] : null;
  // 걸음 (drive.debug, 드라이브 시계): tLand − tTc
  let land = null;
  if (game && T.dbgEnd) {
    const g = (k) => p5(T.dbgEnd[k]);
    land = { tStepReq: g('tStepReq'), tLand: g('tLand'), tTc: g('tTc'), tCut: g('tCut'), stepDur: g('stepDur'), landed: g('landed'), footSlipMax: g('footSlipMax') };
    land.landMinusTc_ms = land.tLand >= 0 && land.tTc >= 0 ? Math.round((land.tLand - land.tTc) * 1000) : null;
  }
  const st = T.stats || {};
  const tie = 10;
  const order10 = [m.t_pelvis, m.t_chest, m.t_hand, m.t_tip].every((x) => x != null) && m.t_pelvis <= m.t_chest + tie && m.t_chest <= m.t_hand + tie && m.t_hand <= m.t_tip + tie;
  return {
    variant: VARIANT, weapon: T.o.weapon, inputHz: T.o.jitter ? 'J' : T.o.input, v: T.o.v, ginput: T.o.ginput, clock: T.o.clock,
    tipPeak: m.tip, tipPeakMs: m.t_tip, KEatTc_J: m.KEatTc_J,
    woundJ: hit ? r0(hit.E) : null, woundMs: hit ? Math.round((hit.gt - t0) * 1000) : null, woundPart: hit ? hit.zone : null,
    tCut_ms: ms(iC), tTcBody_ms: ms(iTcB), handTopCut: r3(handTopCut), handBackCut: r3(handBackCut),
    handPathWind: r3(S[iA].x.path), handPathCut: r3(S[iEnd].x.path - S[i0].x.path),
    falls: T.kd + (T.final === 'stand' ? 0 : T.kd ? 0 : 1), finalState: T.final,
    Smax: r3(Smax), cMax: r3(cMax), overMax: r3(overMax),
    hitch: r3(hitch), hitchRaw: r3(hitchRaw), hitch_ms: ms(iH), hitchFrom: iC != null ? 'tCut' : 'stroke', hitchTo: iTcB != null ? (game ? 'phiB0.85' : 'phi0.85') : 'tc|tipPeak', hitchWin_ms: Math.round((iB - iA) * DT * 1000), hitchPass: hitch < HITCH_GATE,
    order10,
    land,
    ffNoise: T.ffNoise && T.ffNoise.steps ? Object.fromEntries(Object.entries(T.ffNoise).map(([k, x]) => [k, k === 'steps' ? x : +x.toPrecision(5)])) : null,
    stats: { stepRequests: st.stepRequests ?? null, stepRefused: st.stepRefused ?? null, stepLanded: st.stepLanded ?? null, stepLost: st.stepLost ?? null, footSlipMax: r3(st.footSlipMax ?? null), ffCap: st.ffCap ?? null, reachClamp: st.reachClamp ?? null, poleFlip: st.poleFlip ?? null, rateClip: st.rateClip ?? null, cuts: st.cuts ?? null, atlasMissing: st.atlasMissing ?? null },
  };
}
/** 채널 요약 (행마다): 상태 흐름·드라이브 디버그 |최고| */
function chanSummary(T) {
  const ch = T.chan;
  if (!ch) return null;
  const nm = ch.names, t0 = T.cut.t0;
  const iSt = nm.indexOf('strike.state');
  const trans = [];
  let prev = null;
  for (let i = 0; i < ch.rows.length; i++) {
    const s = ch.rows[i][iSt];
    if (s !== prev) trans.push(`${['idle', 'wind', 'cut', 'follow', 'recover'][s] ?? s}@${Math.round((i - ch.i0) * DT * 1000)}`);
    prev = s;
  }
  const absMax = {};
  for (let k = 0; k < nm.length; k++) {
    if (!nm[k].startsWith('debug.') || /\.(t|tCut|tTc|tLand|tStepReq|state|mode|fam|side)$/.test(nm[k])) continue;
    let mx = 0;
    for (const r of ch.rows) if (r[k] != null && Math.abs(r[k]) > mx) mx = Math.abs(r[k]);
    absMax[nm[k].slice(6)] = +mx.toPrecision(4);
  }
  return { states: trans.join(' '), famFirst: FAM_NAMES[ch.rows.find((r) => r[nm.indexOf('strike.fam')] >= 0)?.[nm.indexOf('strike.fam')]] ?? null, debugAbsMax: absMax };
}

// ── 돌리기 ──
mkdirSync(OUT, { recursive: true });
const rows = [];
const records = [];
const tag = R0_OFF ? 'R0_OFF=1' : 'R0 켬';
console.log(`chain.mjs  root ${ROOT}  코드 ${CODE}  물리 ${HZ} Hz  입력 ${INPUT} Hz  시드 ${SEED}  무기 ${WEAPON}  끝 ${VF} m/s  ${tag}${sets.length ? '  set ' + sets.join(' ') : ''}`);
const t00 = Date.now();
const channels = {}; // 새 방식 행의 스텝 채널 (key → { names, i0, rows })
console.log(`변형 ${VARIANT} (감기 ${CHV} m/s, 머묾 ${HOLD} ms)  방식 ${MODES.join(',')}  무기 ${WEAPONS.join(',')}  입력 Hz ${INPUTS.join(',')}${JITTER ? '+J(24–45 fps)' : ''}  v ${VFS.join(',')}  입력 방식 ${GINPUTS.join(',')}  시계 ${CLOCKS.join(',')}  묶음 ${[...BLOCKS].join(',')}`);
const OPTS = [];
for (const weapon of WEAPONS)
  for (const input of JITTER ? [...INPUTS, 'J'] : INPUTS)
    for (const ginput of GINPUTS)
      for (const clock of CLOCKS)
        for (const v of VFS) OPTS.push({ weapon, input: input === 'J' ? INPUTS[0] : input, jitter: input === 'J', ginput, clock, v });
if (BLOCKS.has('rows'))
  for (const o of OPTS)
    for (const fam of FAMS)
      for (const mode of MODES)
        for (const scene of SCENES) {
          const T = trial(fam, mode, scene, o);
          const m = metrics(T);
          Object.assign(m, newMetrics(T, m));
          m.key = `${fam}/${mode}/${scene}/${VARIANT}/${o.weapon}/in${o.jitter ? 'J' : o.input}/v${o.v}/${o.ginput}/${o.clock}`;
          m.chan = chanSummary(T);
          if (T.chan) channels[m.key] = T.chan;
          if (scene === 'air') {
            const rec = makeRecord(T, m.tc);
            m.shape = shapeMetrics(rec);
            m.record = { tipPeak: rec.summary.tipPeak, handPeak: rec.summary.handPeak, tipPeakT: rec.summary.tipPeakT, n: rec.data.n };
            if (CHECK) records.push(rec);
            if (RECORD) writeRecord(OUT, rec);
          }
          rows.push(m);
        }

// ── 묶음: latency (감기가 손가락을 따르나, §8.2 'Wind follows the finger') ──
//  쟁기 2 s → 어깨 지붕(ShR) 쪽으로 drag = 3 m/s 끌기 / step = 0.3 m 를 50 ms (6 m/s) 걸음. 손가락 시작 → 골반·가슴 5°, S > 0, 손 2 cm
const LAT_GATE = { 60: 33, 120: 25 }; // 골반 5° 까지 ms (입력 Hz 별, 명세 §8.2)
function latTrial(mode, kind, o) {
  cfg.DRIVE.on = mode === 'plain' ? false : BASE.drive;
  cfg.GESTURE.input = o.ginput;
  cfg.GESTURE.clock = o.clock;
  const G = newRound({ walls: false, gap: GAP + 0.17, seed: SEED, weapon: o.weapon });
  cfg.DRIVE.on = BASE.drive;
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (const f of [P, E]) for (let i = 0; i < f.sword.numColliders(); i++) f.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.level = 0.7;
  setPad(P, PAD.Pflug);
  inputPump(G, { hz: o.input });
  if (o.jitter) jitterPump(G);
  for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
  const off = [P.handOffset.x, P.handOffset.y];
  let dx = PAD.ShR[0] - off[0], dy = PAD.ShR[1] - off[1];
  const L = Math.hypot(dx, dy);
  const v = kind === 'step' ? 6 : 3;
  if (kind === 'step') (dx *= 0.3 / L), (dy *= 0.3 / L);
  const tr = feedTrace(G, stroke(dx, dy, v, { hold: 300, lift: false }), o.input);
  const S = [];
  let guard = 0;
  do G.step(); while (tr.t0 == null && ++guard < 120);
  const t0 = tr.t0;
  const smp = () => ({ gt: G.t, s: sample(G, P, E), S: P.strike?.S ?? 0 });
  S.push(smp());
  for (let i = 0; i < Math.round(0.4 / DT); i++) (G.step(), S.push(smp()));
  const a = S[0].s;
  const first = (pred) => { for (const q of S) if (pred(q)) return Math.round((q.gt - t0) * 1000); return null; };
  const r = {
    mode, kind, weapon: o.weapon, inputHz: o.jitter ? 'J' : o.input, ginput: o.ginput, v,
    pelvis5_ms: first((q) => Math.abs(q.s.pelTw - a.pelTw) >= 5), chest5_ms: first((q) => Math.abs(q.s.chTw - a.chTw) >= 5),
    S0_ms: first((q) => q.S > 0), hand2_ms: first((q) => q.s.hand.distanceTo(a.hand) >= 0.02), tip5_ms: first((q) => q.s.tip.distanceTo(a.tip) >= 0.05),
    fingerStep_ms: kind === 'step' ? 50 : Math.round((L / 3) * 1000),
  };
  const g = LAT_GATE[o.input];
  r.gate_ms = kind === 'step' && mode === 'game' && !o.jitter && g ? g : null;
  r.pass = r.gate_ms == null ? null : r.pelvis5_ms != null && r.pelvis5_ms <= r.gate_ms;
  return r;
}

// ── 묶음: mx·pace (짜 놓은 위상 drive.script, S 1, 클립 빠르기 — 추적 기록) ──
//  mx = 모양 (shape_metrics + 어깨 올림) 과 추적 (DTW, 손 ≤ 0.08 m·칼 ≤ 15°·늦음 ≤ 60 ms), pace = 걸음 착지 − 몸 위상 tc (±50 ms 안 ≥ 80 %)
let _raw = null;
async function rawAtlas() {
  if (!_raw) {
    const A = await import(pathToFileURL(join(ROOT, 'src/strike/atlas.js')).href);
    _raw = await A.loadAtlasFromClips(await A.defaultClipsDir(ROOT, process.argv), { keepRaw: true });
  }
  return _raw;
}
const { frameOf } = await import('../motion/lib/game_joints.mjs');
function tracked(cut, S, pace, gap, weapon) {
  cfg.DRIVE.on = BASE.drive;
  const G = newRound({ seed: 1, gap, walls: false, weapon });
  G.ai.update = () => {};
  const P = G.player, E = G.enemy;
  for (const f of [P, E]) for (let i = 0; i < f.sword.numColliders(); i++) f.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.autoGuard = true;
  P.handOffset.set(PAD.Pflug[0], PAD.Pflug[1]);
  G.before = () => P.move.set(0, 0);
  for (let i = 0; i < 1.5 / DT; i++) { G.step(); if (i === 2) P.skill.lunge = 0; }
  for (let i = 0; i < 3 / DT && P.gait && (P.gait.walking || !P.gait.legs.F.stance || !P.gait.legs.B.stance); i++) G.step();
  const D = P.drive;
  if (!D) return null;
  const side = 'right';
  for (let i = 0; i < 0.5 / DT; i++) { D.script(-1, S, cut, side, 0); G.step(); }
  const Tm = H.atlas.marks(cut, side, S);
  const fr = frameOf(P, THREE);
  const st = D.stats, d = D.debug;
  const s0 = { stepRefused: st.stepRefused, stepRequests: st.stepRequests, stepLanded: st.stepLanded };
  const frames = [];
  let falls = 0;
  const tEnd = Tm[5] / pace + 0.3;
  for (let t = 0; t <= tEnd + 1e-9; t += DT) {
    const phi = H.atlas.phiAt(cut, side, Math.min(t, Tm[5] / pace) * pace, S);
    D.script(phi, S, cut, side);
    G.step();
    frames.push({ t: +(t * pace).toFixed(4), J: jointsOf(P, THREE, fr) });
    if (P.state !== 'stand') falls = 1;
  }
  D.script(null);
  const land = { tTc: d.tTc, tLand: d.tLand, tStepReq: d.tStepReq, landMinusTc_ms: d.tLand >= 0 && d.tTc >= 0 ? Math.round((d.tLand - d.tTc) * 1000) : null, stepRequests: st.stepRequests - s0.stepRequests, stepRefused: st.stepRefused - s0.stepRefused, stepLanded: st.stepLanded - s0.stepLanded, footSlipMax: r3(d.footSlipMax) };
  return { frames, falls, land };
}
const P3 = (f, nm) => [f.J[IXJ[nm]], f.J[IXJ[nm] + 1], f.J[IXJ[nm] + 2]];
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
function clipSeq(clip) {
  const J = clip.data.cols.J, names = clip.joints, n = clip.data.n, nj = names.length * 3;
  const idx = Object.fromEntries(names.map((nm, i) => [nm, i * 3]));
  const out = [];
  for (let i = 0; i < n; i++) {
    const Jr = new Array(JOINTS.length * 3);
    for (const nm of JOINTS) { const k = i * nj + idx[nm]; Jr[IXJ[nm]] = J[k]; Jr[IXJ[nm] + 1] = J[k + 1]; Jr[IXJ[nm] + 2] = J[k + 2]; }
    out.push({ t: clip.data.cols.t[i], J: Jr });
  }
  return out;
}
const swordAng = (a, b) => {
  const u = P3(a, 'tip').map((x, i) => x - P3(a, 'hS')[i]), v = P3(b, 'tip').map((x, i) => x - P3(b, 'hS')[i]);
  const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
};
function dtw(A, B, band) {
  const n = A.length, m = B.length, INF = 1e18;
  const C = new Float64Array((n + 1) * (m + 1)).fill(INF), W = (i, j) => i * (m + 1) + j;
  C[W(0, 0)] = 0;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) {
      if (Math.abs(A[i - 1].t - B[j - 1].t) > band) continue;
      C[W(i, j)] = dist3(P3(A[i - 1], 'hS'), P3(B[j - 1], 'hS')) + Math.min(C[W(i - 1, j)], C[W(i, j - 1)], C[W(i - 1, j - 1)]);
    }
  if (!(C[W(n, m)] < INF)) return null;
  const path = [];
  let i = n, j = m;
  while (i > 0 && j > 0) {
    path.push([i - 1, j - 1]);
    const a = C[W(i - 1, j - 1)], b = C[W(i - 1, j)], c = C[W(i, j - 1)];
    if (a <= b && a <= c) (i--, j--);
    else if (b <= c) i--;
    else j--;
  }
  return path.reverse();
}
/** 추적 (DTW, tc 에서 둘로 나눠 맞춤, 띠 ±0.3 s 클립 시계, 값 = 손목점 hS 거리): 손 평균·칼 방향 차·늦음 (실제 시각 ms) */
function trackCompare(frames, clip, pace) {
  const mk = clip.marks, B = clipSeq(clip).filter((f) => f.t <= mk.tf + 1e-9), A = frames.filter((f) => f.t <= mk.tf + 1e-9);
  const split = (X) => [X.filter((f) => f.t <= mk.tc + 1e-9), X.filter((f) => f.t > mk.tc + 1e-9)];
  const [A1, A2] = split(A), [B1, B2] = split(B);
  const perB = new Map();
  for (const [AA, BB, oa, ob] of [[A1, B1, 0, 0], [A2, B2, A1.length, B1.length]]) {
    const p = dtw(AA, BB, 0.3);
    if (!p) return null;
    for (const [i, j] of p) { const k = j + ob; (perB.get(k) || perB.set(k, []).get(k)).push(i + oa); }
  }
  const hand = [], sword = [], lag = [];
  for (const [j, is] of perB) {
    const b = B[j];
    hand.push(is.reduce((s, i) => s + dist3(P3(A[i], 'hS'), P3(b, 'hS')), 0) / is.length);
    sword.push(is.reduce((s, i) => s + swordAng(A[i], b), 0) / is.length);
    lag.push((is.reduce((s, i) => s + A[i].t, 0) / is.length - b.t) / pace);
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  return { handMean: r3(mean(hand)), handMax: r3(Math.max(...hand)), swordMeanDeg: r1(mean(sword)), lagMeanMs: r1(mean(lag) * 1000) };
}
/** 어깨 올림 (t ≤ tr): 위팔 (shS → elS) 과 몸통 아래 축 사이 각 */
function elevation(seq, tr) {
  let best = 0;
  for (const f of seq) {
    if (f.t > tr + 1e-9) break;
    const sh = P3(f, 'shS'), el = P3(f, 'elS'), up = P3(f, 'neck').map((x, i) => x - P3(f, 'hipC')[i]);
    const u = el.map((x, i) => x - sh[i]), c = -(u[0] * up[0] + u[1] * up[1] + u[2] * up[2]) / (Math.hypot(...u) * Math.hypot(...up));
    best = Math.max(best, (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI);
  }
  return r1(best);
}
const SIDE_GATE = { zornhau: -0.3, mittelhau: -0.33, unterhau: -0.33, oberhau: null };
const OVERHEAD = { zornhau: true, oberhau: true, mittelhau: false, unterhau: false };
const TRACK_GATE = { hand: 0.08, sword: 15, lagMs: 60 };
function mxGates(cut, m, elev) {
  return {
    handTop: OVERHEAD[cut] ? m.handTop >= 0.05 : null, handBack: m.handBack >= 0.1, shoulderElev: OVERHEAD[cut] ? elev >= 130 : null, tipBack: m.tipBack >= 1.0,
    cross: SIDE_GATE[cut] == null ? null : m.cross <= SIDE_GATE[cut], chestRange: m.chestRange >= 120, pelvisRange: m.pelvisRange >= 65,
    xOrder: m.seq.pelvis <= m.seq.chest, handPath: m.handPath >= 1.8,
  };
}
const CUTS4 = ['zornhau', 'oberhau', 'mittelhau', 'unterhau'];
const blockOut = {};
if (BLOCKS.has('latency')) {
  blockOut.latency = [];
  for (const o of OPTS.filter((q, i, a) => a.findIndex((z) => z.weapon === q.weapon && z.input === q.input && z.jitter === q.jitter && z.ginput === q.ginput && z.clock === q.clock) === i))
    for (const mode of MODES)
      for (const kind of ['step', 'drag']) blockOut.latency.push(latTrial(mode, kind, o));
}
if (BLOCKS.has('mx') || BLOCKS.has('pace')) {
  const raw = BLOCKS.has('mx') ? await rawAtlas() : null;
  if (BLOCKS.has('mx')) blockOut.mx = [];
  if (BLOCKS.has('pace')) blockOut.pace = [];
  for (const weapon of WEAPONS)
    for (const cut of CUTS4) {
      if (BLOCKS.has('mx')) {
        const T = tracked(cut, 1, 1, 1.8, weapon);
        if (!T) continue;
        const clip = raw.fam(cut, 'right').large.raw;
        const mk = clip.marks;
        const rec = { joints: JOINTS, marks: { tw: mk.tw }, data: { n: T.frames.length, cols: { t: T.frames.map((f) => f.t), J: T.frames.flatMap((f) => f.J) } } };
        const m = shapeMetrics(rec), elev = elevation(T.frames, mk.tr);
        const mc = shapeMetrics(clip), elevC = elevation(clipSeq(clip), mk.tr);
        const g = mxGates(cut, m, elev);
        const cmp = trackCompare(T.frames, clip, 1);
        const tp = cmp ? { hand: cmp.handMean <= TRACK_GATE.hand, sword: cmp.swordMeanDeg <= TRACK_GATE.sword, lag: Math.abs(cmp.lagMeanMs) <= TRACK_GATE.lagMs } : null;
        blockOut.mx.push({ weapon, cut, S: 1, pace: 1, falls: T.falls, shape: { ...m, shoulderElevDeg: elev }, clipShape: { ...mc, shoulderElevDeg: elevC }, gates: g, pass: Object.values(g).every((x) => x !== false), track: cmp, trackGates: tp, trackPass: !!tp && Object.values(tp).every(Boolean), land: T.land });
      }
      if (BLOCKS.has('pace'))
        for (const gap of [1.6, 1.8, 2.0]) {
          const T = tracked(cut, 1, 1, gap, weapon);
          if (!T) continue;
          const d = T.land.landMinusTc_ms;
          blockOut.pace.push({ weapon, cut, gap, ...T.land, falls: T.falls, within50: d != null && Math.abs(d) <= 50 });
        }
    }
  if (blockOut.pace) {
    const n = blockOut.pace.length, k = blockOut.pace.filter((r) => r.within50).length;
    blockOut.paceSummary = { n, within50: k, pct: n ? +((100 * k) / n).toFixed(1) : null, pass: n > 0 && k / n >= 0.8 };
  }
}
// 걸음 착지 분포 (손가락 빠르기별, 문턱 없음): game 행의 tLand − tTc
if (rows.some((r) => r.land)) {
  const byV = {};
  for (const r of rows) if (r.land) (byV[r.v] ||= []).push(r.land.landMinusTc_ms);
  const qq = (a, p) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))] : null; };
  blockOut.landing = Object.fromEntries(Object.entries(byV).map(([v, a]) => [v, { n: a.length, landed: a.filter((x) => x != null).length, median_ms: qq(a, 0.5), p90_ms: qq(a, 0.9) }]));
}
cfg.GESTURE.input = BASE.input, (cfg.GESTURE.clock = BASE.clock), (cfg.DRIVE.on = BASE.drive);
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
function table(cols, rowFn, title, rs = rows) {
  if (!rs.length) return;
  console.log(`\n[${title}]`);
  console.log(cols.map(([h, w, rt]) => pad(h, w, rt)).join(' '));
  for (const r of rs) console.log(rowFn(r).map((v, i) => pad(v, cols[i][1], cols[i][2] !== false)).join(' '));
}
// game/plain 행: 기준 (1) 칸·되돌아감·tCut 의 손·걸음 (옛 방식 표 두 벌은 --md 로)
const newRows = rows;
const colsN = [['키', 58, false], ['칼끝', 6], ['@ms', 4], ['KE@tc', 6], ['상처 J@ms 부위', 18, false], ['tCut', 5], ['손 위/뒤/감기길', 17, false], ['S/c 최고', 11, false], ['되돌아감', 8], ['순서', 4, false], ['착지−tc', 7], ['넘어짐', 6]];
const rowN = (r) => [r.key, r.tipPeak, r.tipPeakMs, r.KEatTc_J, r.woundJ != null ? `${r.woundJ}@${r.woundMs} ${r.woundPart}` : r.scene === 'hit' ? '없음' : '-', r.tCut_ms, `${r.handTopCut}/${r.handBackCut}/${r.handPathWind}`, `${r.Smax}/${r.cMax}`, r.hitch, r.order10 ? 'O' : '×', r.land?.landMinusTc_ms, r.falls];
table(colsN, rowN, `game/plain 행 (t = 획 시작 기준 ms, 되돌아감 m/s 관문 ${HITCH_GATE}, 순서 = 골반 ≤ 가슴 ≤ 손 ≤ 칼끝 10 ms 같음)`, newRows);
if (blockOut.latency) {
  console.log('\n[latency: 손가락 시작 → 골반·가슴 5°, S > 0, 손 2 cm, 칼끝 5 cm (ms). 관문 = step·game 골반 5° ≤ 33 ms (입력 60 Hz) / 25 ms (120 Hz)]');
  for (const r of blockOut.latency) console.log(`${pad(r.mode, 5, false)} ${pad(r.kind, 4, false)} ${pad(r.weapon, 10, false)} in${pad(r.inputHz, 3, false)} ${pad(r.ginput, 6, false)} 골반 ${pad(r.pelvis5_ms, 4)} 가슴 ${pad(r.chest5_ms, 4)} S ${pad(r.S0_ms, 4)} 손 ${pad(r.hand2_ms, 4)} 칼끝 ${pad(r.tip5_ms, 4)}${r.gate_ms != null ? `  ≤ ${r.gate_ms} ${r.pass ? 'PASS' : 'FAIL'}` : ''}`);
}
if (blockOut.mx) {
  console.log('\n[mx: 짜 놓은 위상 S 1 클립 빠르기 추적 기록 — 모양 (게임 / 클립) · 추적]');
  for (const r of blockOut.mx) {
    const s = r.shape, c = r.clipShape, g = r.gates, f = (k) => (g[k] == null ? '' : g[k] ? '' : '×');
    console.log(`${pad(r.weapon, 10, false)} ${pad(r.cut, 9, false)} 손위 ${s.handTop}${f('handTop')}/${c.handTop} 손뒤 ${s.handBack}${f('handBack')}/${c.handBack} 어깨 ${s.shoulderElevDeg}${f('shoulderElev')}/${c.shoulderElevDeg} 칼뒤 ${s.tipBack}${f('tipBack')}/${c.tipBack} 지나감 ${s.cross}${f('cross')}/${c.cross} 가슴 ${s.chestRange}${f('chestRange')}/${c.chestRange} 골반 ${s.pelvisRange}${f('pelvisRange')}/${c.pelvisRange} X ${s.seq.pelvis}≤${s.seq.chest}${f('xOrder')} 손길 ${s.handPath}${f('handPath')}/${c.handPath} → ${r.pass ? 'PASS' : 'FAIL'} | 추적 ${r.track ? `손 ${r.track.handMean} 칼 ${r.track.swordMeanDeg}° 늦음 ${r.track.lagMeanMs} ms` : '-'} ${r.trackPass ? 'PASS' : 'FAIL'} 넘어짐 ${r.falls}`);
  }
}
if (blockOut.pace) {
  console.log('\n[pace: 짜 놓은 위상 S 1 클립 빠르기, 상대 1.6/1.8/2.0 m — 착지 − 몸 위상 tc (ms), 관문 ±50 ms 안 ≥ 80 %]');
  for (const r of blockOut.pace) console.log(`${pad(r.weapon, 10, false)} ${pad(r.cut, 9, false)} ${r.gap} m 착지−tc ${pad(r.landMinusTc_ms, 5)} 부탁 ${r.stepRequests} 거절 ${r.stepRefused} 딛음 ${r.stepLanded} 미끄럼 ${r.footSlipMax} 넘어짐 ${r.falls}`);
  const q = blockOut.paceSummary;
  console.log(`±50 ms 안 ${q.within50}/${q.n} (${q.pct} %) → ${q.pass ? 'PASS' : 'FAIL'}`);
}
if (blockOut.landing && newRows.length) console.log('\n[걸음 착지 − 몸 위상 tc (손가락 빠르기별, 문턱 없음)]', JSON.stringify(blockOut.landing));
if (MD) {
  const md = (cols, rowFn) => { console.log('| ' + cols.map((c) => c[0]).join(' | ') + ' |'); console.log('|' + cols.map(() => '---').join('|') + '|'); for (const r of rows) console.log('| ' + rowFn(r).map((v) => (v == null ? '·' : v)).join(' | ') + ' |'); };
  console.log('\n### 속도·사슬\n'); md(cols1, row1);
  console.log('\n### 포화·지연·대가\n'); md(cols2, row2);
}

// ── 기록 J 칸이 앞선 기록과 같은가 (--check 폴더) ──
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
{
  Object.assign(outJ.meta, { variant: VARIANT, chamberV: CHV, holdMs: HOLD, modes: MODES, weapons: WEAPONS, inputHz: INPUTS, jitter: JITTER, v: VFS, ginput: GINPUTS, clock: CLOCKS, blocks: [...BLOCKS], hzMeaning: '물리 physicsHz (게임 120), inputHz = 화면(손가락) 프레임, J = 24–45 fps 흔들림' });
  outJ.blocks = blockOut;
  outJ.famNames = FAM_NAMES;
  if (Object.keys(channels).length) outJ.channels = channels;
}
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
