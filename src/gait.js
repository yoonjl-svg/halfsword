// ─────────────────────────────────────────────────────────────
//  다리가 체중을 싣는 걸음
//
//  예전 방식('levitate'): 보이지 않는 힘이 골반을 거의 전부(몸무게의 94%) 떠받치고, 다리는 흉내만 냈다.
//  그 다음('hybrid' 10/1 ~ 11/23): 몸무게의 약 80 % 를 다리 관절이 땅까지 전하고 나머지 20 % 는 보조 힘이, 몸을 보내는 힘 · 세우는 힘은 몸 밖 힘(걷기 밀기 · 닻)이 냈다.
//
//  지금 (물리 2.0 시제품 2026-11-24): 몸 밖 힘이 없다. 몸무게 · 밀기 · 세우기 · 돌기는 딛은 다리의 관절 토크 쌍이 땅 반력으로 낸다(src/legs_vmc.js).
//  이 파일은 '어느 발을 언제 어디에 딛을지'와 다리 관절의 자세 목표를 정한다. 딛은 발 덧질량 · 발 핀 힘 · 보조 힘 넘겨받기 · 붙잡기 반사는 없다.
//  몸이 거꾸로 선 진자이므로 발을 떼는 때와 디딜 자리는 캡처 점(무게중심 + 속도 ÷ √(g / 높이))으로 정한다(liftOk · target).
//
//   1) 딛은 발: 발을 디딘 자리(월드 좌표)를 기억하고, 다리 역운동학(IK)으로 엉덩이 → 그 자리까지 다리를 뻗는다.
//      골반이 움직여도 발은 그 자리에 붙어 있다 (미끄러지지 않는다). 발바닥은 정지 마찰처럼 붙잡는다(한계 = 마찰계수 × 실린 무게,
//      실린 무게는 걸러서 쓴다: 접촉 힘이 순간 작게 잡힐 때마다 붙잡는 자리가 끌려가면 가만히 선 발이 조금씩 밀려난다).
//   2) 골반 높이: 딛은 다리가 닿을 수 있는 높이 (뒤집힌 진자) → 두 발을 딛을 때 낮아지고 한 발 위를 지날 때 높아진다.
//      발을 막 디딘 순간 무릎이 살짝 굽으며 무게를 받는다 (하중 반응). 옆걸음·천천히 걷기엔 골반을 조금 더 출렁인다.
//   3) 걸음: 시간으로 박자를 맞추고(빠를수록 잦게, 보폭은 길게), 내딛는 발은 "몸이 갈 곳"(속도 기반, Raibert)에 놓는다.
//      한 발로 설 때마다 무게중심이 딛은 발 쪽으로 옮겨 간다 (좌우 흔들림). 아주 빠르면 무릎을 굽힌 채 종종 뛴다.
//   4) 멈추면 펜싱 자세(칼 든 쪽 발이 앞, 무릎을 살짝 굽힘)로 발을 고쳐 딛는다. 몸을 돌리면 발도 돌려 딛는다
//      (돌아서는 방향을 미리 보고 짧고 빠른 걸음으로. 돌면서 걸을 땐 방향을 틀 수 있는 만큼만 빨리 간다).
//   5) 세게 맞아 발이 끌리면 그 자리에서 다시 딛고, 캡처 점이 발 밖으로 나가면 그쪽으로 발을 옮겨 딛는다. 못 받으면 넘어진다.
// ─────────────────────────────────────────────────────────────
import { guarded, rethrowRapier } from './rapier_guard.js'; // 11/17 Rapier 콜백 예외 드러내기
import * as THREE from 'three';
import { BODY, GAIT, LEGS, RUN } from './config.js';
import { TRADITIONS, FAST_ACCENT, footworkTradition } from './schools.js';
import { runFace } from './run.js'; // 뛰는 동안 바라볼 쪽 (11/18 뛰기 · 11/20 멈추는 동안)
import { kitOff } from './skill_kit.js'; // 플레이어 스킬트리 몫 (10/21 — 이탈리아 물러서기 I3 · 이베리아 옆 박차기 B2 · 독일 간격 잡기 G2)
import { GUARD_BASE } from './guards.js';
import { bwAim, bwBurst } from './burst_whiff.js'; // 뒤 박차기 헛침 경직 (11/19 — 걸 때 나를 겨눠 나가는 칼을 적고 · 뗄 때 표시)

// 자세 이름 → 바탕 자세표 차례 (유파 걸음 P.guardLow — 몸 틀 자세표도 같은 패드 자리·같은 순서라 bodyGuard.nearest 와 견줄 수 있다)
const _guardIdx = new Map();
const guardIdx = (name) => {
  if (!_guardIdx.has(name)) _guardIdx.set(name, GUARD_BASE.findIndex((g) => g.name === name));
  return _guardIdx.get(name);
};

const A_LEN = 0.43; // 허벅지 (엉덩이 → 무릎)
const B_LEN = 0.42; // 정강이 (무릎 → 발목)
/**
 * 'hybrid'일 때 다리 관절을 조금 바꾼다 (몸이 만들어질 때 한 번):
 *  발목을 공 관절로 → 다리가 옆으로 기울어도 발바닥이 땅에 평평하게 닿는다 (경첩이면 발 모서리로 선다)
 *  엉덩이를 조금 더 비틀 수 있게 → 딛은 발 위에서 몸을 돌릴 수 있다
 */
export function hybridJointDefs(defs) {
  for (const jd of defs) {
    if (jd.c === 'footF' || jd.c === 'footB') {
      jd.type = 'ball';
      jd.lim = { x: [-0.4, 0.4], y: [-0.3, 0.3], z: [-0.6, 0.8] }; // 옆으로 기울기, 비틀기, 앞뒤 굽히기
    }
    // 엉덩이 비틀기(안쪽·바깥쪽 돌리기)를 사람만큼 (약 45도): 딛은 발 위에서 몸을 돌릴 때 관절 한계에 걸려 발을 비틀지 않게
    if ((jd.c === 'thighF' || jd.c === 'thighB') && GAIT.hipTwist) jd.lim = { ...jd.lim, y: [-GAIT.hipTwist, GAIT.hipTwist] };
  }
  return defs;
}

const ANKLE_H = 0.062; // 발바닥이 땅에 평평하게 닿았을 때 발목 높이 (발 0.07 − 체중에 눌려 땅에 파묻히는 몫 약 0.008: 물리 엔진의 부드러운 접촉)
const SOLE_C = new THREE.Vector3(0, -0.035, 0); // 발 몸체 기준 발바닥 가운데
const SOLE_T = new THREE.Vector3(0.12, -0.035, 0); // 발끝 쪽 (뒤꿈치를 들면 여기로 버틴다)
const TOE_X = 0.17; // 발목에서 발끝(뒤꿈치를 들 때 축이 되는 곳)까지 앞으로
const SOLE_Y = 0.07; // 발목에서 발바닥까지 아래로
const GATHER_T = 0.2; // 모아 딛는 발 뜬 시간(s · 다섯째 판 E2): 시간 사다리 0.2 — 받아 딛기(GAIT.catchT 0.26)보다 짧은 반걸음. 늘리면 런지가 늦게 뜨고, 줄이면 뒷발이 덜 모인다
// 뒤꿈치를 약 0.35라디안 들었을 때 발목이 올라가는 높이·앞으로 가는 거리 (골반 높이를 정할 때 쓴다)
const HEEL_DY = TOE_X * Math.sin(0.35) + SOLE_Y * (Math.cos(0.35) - 1);
const HEEL_DX = TOE_X * (1 - Math.cos(0.35)) + SOLE_Y * Math.sin(0.35);
const HIP_DROP = 0.04; // 골반 중심에서 엉덩이 관절까지 (아래로)
const UP = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 무릎을 phi(라디안) 굽혔을 때 엉덩이~발목 거리 */
const legLen = (phi) => Math.sqrt(A_LEN * A_LEN + B_LEN * B_LEN + 2 * A_LEN * B_LEN * Math.cos(phi));
const clamp = THREE.MathUtils.clamp;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * 박자 걸음 칸(P.rhythm)이 켜졌나 — 디딤 셈 normal·fast 둘 다 1 이상 (옛 짝 셈 'pair' · 'off' 는 11/17 걷음).
 *  꺼졌으면 칸 없는 것과 같은 길(셈하지 않음)
 */
const rhythmOn = (R) => !!R && R.normal > 0 && R.fast > 0;
/** 뛰는 걸음 꼴 섞기 (11/18 뛰기 — src/run.js): 걷는 값 a → 뛰는 값 b 를 k 만큼. k 0 이면 a 그대로(셈하지 않음 — 뛰지 않는 몸 · 1:1 AI · 시뮬 몸은 늘 0 · 바이트 같음) */
const runMix = (a, b, k) => (k > 0 ? a + (b - a) * k : a);
/** 부드러운 출발·도착 (속도·가속도 0) */
const minJerk = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * u * (10 - 15 * u + 6 * u * u));

function mkLeg(k, side) {
  return {
    k,
    side, // 몸 기준 좌우 (+1 = 오른쪽)
    thigh: 'thigh' + k,
    shin: 'shin' + k,
    foot: 'foot' + k,
    stance: true,
    plant: new THREE.Vector3(), // 딛은 자리 (발목, 월드)
    yaw: 0, // 딛은 발의 방향 (월드)
    yawTD: 0, // 디딜 때의 발 방향
    tLand: 1, // 디딘 뒤 지난 시간
    hip: new THREE.Vector3(), // 엉덩이 관절 (월드, 실제)
    ankle: new THREE.Vector3(), // 발목 (월드, 실제)
    footYaw: 0,
    soleY: 0,
    toeY: 0,
    // 내딛는 중
    t: 0,
    T: 0.4,
    p0: new THREE.Vector3(),
    p1: new THREE.Vector3(),
    yaw0: 0,
    yaw1: 0,
    lift: 0,
    kind: 'walk',
    phi: 0, // 지금 목표 무릎 굽힘
    heel: 0, // 뒤꿈치를 든 각도
    phiTD: 0, // 디딜 때의 무릎 굽힘
    hFrac: 1,
    y0: 0, // 걸음을 바꿀 때 이미 들려 있던 높이
    rel: new THREE.Vector3(), // 엉덩이에 대한 내딛는 발목 목표
    relOk: false,
    des: new THREE.Vector3(), // 내딛는 발목 목표
    desV: new THREE.Vector3(), // 그 목표가 움직이는 속도
    desA: new THREE.Vector3(), // 그 목표의 가속 (걸러진 값 — 이끄는 힘의 앞먹임)
    v0: new THREE.Vector3(), // 발을 뗄 때 발의 출발 속도
    fq: new THREE.Quaternion(), // 발 자세 (월드)
    fp: new THREE.Vector3(), // 발 위치 (월드)
    pinC: new THREE.Vector3(), // 딛을 때 발바닥 가운데가 닿은 곳 (월드)
    pinT: new THREE.Vector3(), // 발끝이 닿은 곳
  };
}

/**
 * 유파 걸음 (10/10 비싼 층 — docs/strike/school_gait_design_2026-10-10.md): 무기의 유파(fighter.swordArt.tradition) 걸음 칸
 *  TRADITIONS[t].gait 를 GAIT 위에 덮은 값. 칸이 없는 유파(독일·무유파)는 **GAIT 객체 그 자체** →
 *  읽는 값·연산이 한 비트도 안 바뀐다. 칸이 있으면 GAIT 를 프로토타입으로 둔 객체(덮지 않은 열쇠는 전역 값 — with_config 도 그대로 따라감).
 *  byFrame[틀]: 그 몸 틀(swordArt.frame)만 더 덮는 값(일본 앞무게 = 모노호시자오). 플레이어도 같은 걸음(사장님 10/10 05:1x '플레이어도 유파 영향') —
 *  (전 player: 사람 쪽만 다시 덮는 값(조작감 완화용) — 남은 몫은 trailReach 0.36 하나였고 11/19 사람 · AI 같게 A12 로 칸 값 0.36 으로 · player 칸 지움)
 *  even: 그 위에 다시 덮는 값 (10/15 이탈리아 '고른 바탕 걸음')
 *  보폭 규칙 (10/15 20:3x 사장님 — docs/strike/stride_rule_2026-10-15.md): 칸에 strideK(k)가 있으면 맨 끝에 보폭 상한 = GAIT.maxStride × k · 1 m/s 박자 = GAIT.cadence0 ÷ k 로
 *   (덮어쓰기 칸 byFrame 의 그 두 값도 이것으로 — 사람·AI 같은 보폭 · 박자는 빠르기 ÷ 보폭). 끄면(0) 칸 값 그대로(바이트 같음) — 일본은 10/29 strideK 뺌(설계 박자 · 보폭 칸 그대로)
 *  speedMul: 가려는 빠르기 배율(update — 일본 0.70 · 10/29 사장님 '확연히 느려도 돼' · 10/31 '일본 바로잡아' 0.67 → 0.70) · settleStance: 서 있는 자세 길이 고쳐 딛기(settleLeg · target — 일본)
 */
export function gaitParams(f) {
  const art = f.swordArt;
  const g = TRADITIONS[footworkTradition(f)]?.gait; // 대기실 스킬트리 보법 I 을 안 익혔으면(플레이어만 — schools.js footworkTradition) 기본 걸음
  if (!g) return GAIT;
  const P = Object.create(GAIT);
  const put = (o) => {
    if (!o) return;
    for (const k of Object.keys(o)) if (k !== 'byFrame' && k !== 'even') P[k] = o[k];
  };
  put(g);
  put(g.byFrame?.[art.frame]);
  if (g.even) put(g.even);
  if (g.strideK) {
    P.maxStride = GAIT.maxStride * g.strideK;
    P.cadence0 = GAIT.cadence0 / g.strideK;
  }
  // 스킬트리 (10/21 — 사람만 · skill_kit.js): 보법 I 은 유파 걸음 칸 전부, 보법 II 칸 몫만 따로 — 이탈리아 I3 물러서기 = 뒤 느려짐 없앰(backMul — 10/31 부터 이어 물러선 네 디딤까지 · backCap) ·
  //  이베리아 B2 옆 박차기 = burstSide(첫 걸음 옆 박차기 · 옆 누르면 늘 박차기 · 비스듬히 앞으로). 그 칸을 안 익혔으면 그 몫만 걸음 칸에서 뺀다. AI 도 같은 칸 몫(11/16 config AI_KIT — ai.js applyKit)
  if (kitOff(f, 'backFlat')) P.backMul = undefined;
  if (kitOff(f, 'burstSide')) P.burstSide = false;
  P.tradition = art.tradition;
  return P;
}

/**
 * follow 안 'pass' → lunge + 끌어붙임(passAs) 걸음 길이 (10/29 18:5x 사장님 '네 제안대로' — docs/strike/step_ladder_2026-10-29.md §11):
 *  가까운 사다리 칸(GAIT.stepRungs)으로 맞춘 뒤 한 칸 아래 · 맨 아래 칸(0.3) 이하는 그대로(늘리지 않음) · pa.rung === false 면 × pa.fwdK ·
 *  뒤 · 0 걸음은 그대로
 */
export function passAsFwd(fwd, pa) {
  if (pa?.rung === false) return fwd * (pa?.fwdK ?? 1);
  const R = GAIT.stepRungs;
  if (!(fwd > R[0])) return fwd;
  let i = 0;
  for (let k = 1; k < R.length; k++) if (Math.abs(R[k] - fwd) < Math.abs(R[i] - fwd)) i = k;
  return R[Math.max(0, i - 1)];
}

export class Gait {
  constructor(fighter) {
    this.f = fighter;
    this.P = gaitParams(fighter); // 유파 걸음 값 (칸 없으면 GAIT 그 자체)
    this._art = fighter.swordArt;
    const s = fighter.side;
    this.legs = { F: mkLeg('F', s), B: mkLeg('B', -s) };
    this.active = false;
    this.slow = 0; // 일어선 직후 천천히 걷는 몫 (1 → 0)
    this.liftHold = 0; // 자세 고쳐 딛을 발을 떼려다 무게 옮기기를 기다린 시간
    this.calmT = 0; // 두 발을 딛은 채 캡처 점이 받침 안에 머문 시간
    this.vTD = new THREE.Vector3(); // 지난 디딤 때의 무게중심 속도
    this.pend = null; // 떼려고 기다리는 발
    this.missPrev = Infinity; // 떼기 앞서 내다본 벗어남(liftMiss)의 앞 스텝 값 — 줄어드는 동안만 기다린다
    this.capW = 3.3; // √(g / 무게중심 높이)
    this.gc = new THREE.Vector3(); // 펜싱 자세 자리의 기준 점 (guardSpot)
    this.h = BODY.standHeight; // 골반 높이 목표
    this.hNom = BODY.standHeight;
    this.hv = 0;
    this.sinceTD = 1; // 마지막으로 발을 디딘 뒤 지난 시간
    this.lastTD = 'B'; // 마지막으로 디딘 발
    this.walking = false;
    this.walkT = 0; // 걷기 시작한 뒤 / 멈춘 뒤 지난 시간
    this.idleT = 0;
    this.stepT = 0.5; // 지금 걸음 박자 (한 걸음 시간)
    this.vf = new THREE.Vector3(); // 골반 수평 속도 (걸러진 값)
    this.req = null; // 기술이 부탁한 걸음 (requestStep)
    this.settles = 0; // 멈춘 뒤 고쳐 딛은 횟수
    this.prevHead = fighter.heading;
    this.headRate = 0; // 몸을 돌리는 빠르기(rad/s)
    this.sinceEnter = 0;
    this.speedF = 0;
    this.runW = 0;
    this.rk = 0; // 뛰는 걸음 꼴 섞임 (11/18 뛰기 — f.run.k · f.run 이 없는 몸은 늘 0)
    // 빠른 걸음 (10/15 — 이탈리아 박자 걸음 P.rhythm): fastK = 지금 걸음의 몸 빠르기·발 박자 배율(1 = 보통) · rhyN = 이번 마디에 센 앞뒤 걸음(디딤 셈이면 보통 디딤) ·
    //  rhyF = 디딤 셈 빠른 몫에 남은 빠른 디딤 · rhyIdle = 걸음이 끝난 뒤 지난 시간
    //  rhyTrail = 짝걸음 빠른 걸음의 따라붙는 발이 아직 남았나 · chase = 독일 간격 잡기 받을 창(상대 헛침 뒤 — foeWhiff) · fastAccent = 지금 빠른 걸음의 발소리 강조 ·
    //  fastAcc = 지금 빠른 걸음의 몸 가속 한도 배율(fighter.js driveBalance — 간격 잡기 빠른 디딤만 둠) · chaseStep = 지금 빠른 걸음이 간격 잡기 빠른 디딤인가(fastBegin)
    this.fastK = 1;
    this.rhyN = 0;
    this.rhyGo = false; // 보폭 박자 — 처음부터 다시 세면 짧은 디딤부터
    this.rhyF = 0;
    this.rhyIdle = 0;
    this.rhyTrail = false;
    this.chase = null;
    this.chaseStep = false;
    this.digStep = false; // 지금 걸음이 파고들기 박찬 앞 걸음인가 (11/14 — fastBegin · 그 순간 창 시계가 멈춤 school_passive.js)
    this.digs = 0; // 파고들기를 낸 수 (첫 박찬 앞 걸음을 뗀 수 — 재기만)
    this.digSteps = 0; // 파고들기 박찬 앞 걸음 수 (재기만)
    // 간격 잡기의 잡기(10/15 — holdTick · 플레이어만): hold = 잡는 중 { t 지난 시간, T 잡는 시간 } · holdBrake = 걸 때 상대 쪽 단위 벡터(세게 멈춤 — 몸이 설 때까지) ·
    //  holdEnd = 마지막 잡기가 풀린 까닭('time' · 'stick' · 'state' — 읽기만 하는 표시)
    this.hold = this.holdBrake = this.holdEnd = null;
    // 첫 걸음 박차기(10/15): burst = 서 있다가 뒤·옆으로 걷기 시작한 순간 걸고(update) 첫 걸음을 뗄 때 쓴다(fastBegin) — { fore, side 스틱 방향 부호 · lat 옆 몫 비율 } ·
    //  burstLeg = 그 걸음의 발(디딜 자리를 박찬 가속으로 내다봄 — burstAhead) · burstBrake = 박찬 쪽 단위 벡터(몸이 따라잡을 때까지 가속 한도 그대로 — 세게 멈춤)
    this.burst = this.burstLeg = this.burstBrake = null;
    this.lungeBrake = null; // 안다레 리솔루토 런지 걸음 몸 가속 (아래 req.accel)
    this.fastFore = false; // 첫 걸음 박차기 비스듬히 뒤(이베리아 아님): 몸 빠르기의 앞뒤 몫만 × fastK — fastBegin 이 정함
    // 물러서기 걸음 수 한도 (10/31 — 걸음 칸 backCap · 이탈리아 backMul 'flat'): backN = 이어 물러선 뒤 디딤 수(backStep) · backIdle = 걸음이 끝난 뒤 지난 시간 ·
    //  backWf · backWl = 이번 스텝 가려는 속도(뒤 느려짐 없애기 전)의 앞뒤 몫(부호) · 옆 몫(크기) — 칸 없으면 늘 0
    this.backN = 0;
    this.backIdle = 0;
    this.backWf = this.backWl = 0;
  }

  /** 서기 시작(라운드 시작, 일어선 직후): 두 발을 지금 자리에 딛는다 */
  enter() {
    if (this.f.missingLeg) return; // 다리를 잃은 몸은 걷기·서기 제어를 다시 켜지 않는다 (fighter.sever)
    this.active = true;
    this.sense();
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      L.stance = true;
      L.Nf = 0; // 새 서기: 지난 서기의 걸러진 하중 기록을 버린다 — 안 버리면 넘어짐→기립 뒤 첫 서기에서 묵은 Nf(수백 N)가 핀 마찰 한도로 쓰여 미끄러진다 (10/7; 샛별 10차 '새 서기 Nf 초기화' 와 같은 결함, 공통 조상 코드)
      this.plantAt(L);
      L.tLand = 1;
    }
    // 일어선 직후(resumed): 골반 높이 목표는 지금 높이에서 출발하고 한동안 천천히 걷는다
    const resumed = !!this.started;
    this.slow = resumed ? 1 : 0;
    this.liftHold = 0;
    this.pend = null;
    this.missPrev = Infinity;
    this.started = true;
    this.sinceEnter = 0;
    const p = this.f.bodies.pelvis.translation();
    // 일어선 직후: 골반 높이 목표는 지금 높이에서 출발해 천천히 자세 높이로 간다 (한 번에 바꾸면 솟았다가 주저앉는다)
    if (this.f.terrain) {
      // 지형 무대(화산섬)만: 높이 목표 h·hNom 은 월드 높이, 거르는 자세 높이 hNomF 와 hv 는 골반 밑 땅 위로 (샛별 0116047c 그대로)
      this.groundY = this.f.terrain.heightAt(p.x, p.z);
      this.hNomF = resumed ? clamp(p.y - this.groundY, this.P.guardHeight - 0.03, this.P.walkHeight) : undefined;
      this.hNom = this.groundY + BODY.standHeight;
      this.h = p.y;
      const v = this.f.bodies.pelvis.linvel();
      this.hv = resumed ? clamp(v.y - this.f.groundVelocityAt(p.x, p.z, v), -0.3, 0.3) : 0;
    } else {
      this.hNomF = resumed ? clamp(p.y, this.P.guardHeight - 0.03, this.P.walkHeight) : undefined;
      this.h = p.y;
      this.hv = resumed ? clamp(this.f.bodies.pelvis.linvel().y, -0.3, 0.3) : 0;
    }
    this.sinceTD = 0;
    this.walking = false;
    this.speedF = 0;
    this.idleT = 0;
    this.req = null;
    this.settles = 0;
    this.prevHead = this.f.heading;
    this.headRate = 0;
    this.resetRates();
    // 빠른 걸음: 새로 서면(판 시작·일어선 뒤) 처음부터 센다 — 넘어진 동안은 걸음 셈이 없다(간격 잡기 받을 창·잡기·박차기도 버림)
    this.fastK = 1;
    this.rhyN = 0;
    this.rhyGo = false; // 보폭 박자 — 처음부터 다시 세면 짧은 디딤부터
    this.rhyF = 0;
    this.rhyIdle = 0;
    this.rhyTrail = false;
    this.chase = null;
    this.hold = this.holdBrake = null;
    this.burst = this.burstLeg = this.burstBrake = null;
    this.lungeBrake = null; // 안다레 리솔루토 런지 걸음 몸 가속 (아래 req.accel)
    this.backN = 0; // 물러서기 걸음 수 (backCap): 새로 서면 처음부터
    this.backIdle = 0;
  }

  exit() {
    this.active = false;
    this.fastK = 1;
    this.rhyN = 0;
    this.rhyGo = false; // 보폭 박자 — 처음부터 다시 세면 짧은 디딤부터
    this.rhyF = 0;
    this.chase = null;
    if (this.hold) this.holdEnd = 'state';
    this.hold = this.holdBrake = null;
    this.burst = this.burstLeg = this.burstBrake = null;
    this.lungeBrake = null; // 안다레 리솔루토 런지 걸음 몸 가속 (아래 req.accel)
    this.backN = 0;
    this.fly = this.flyAir = false; // 날며 뛰기 (11/20)
    const J = this.f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      for (const n of [l.thigh, l.shin, l.foot]) {
        J[n].gain = 1;
        J[n].gainD = J[n].cap = undefined;
      }
    }
    this.req = null;
  }

  // ── 몸 상태 읽기 ──
  sense() {
    const f = this.f;
    const pel = f.bodies.pelvis;
    const r = pel.rotation();
    const qP = _qP.set(r.x, r.y, r.z, r.w);
    const pt = pel.translation();
    for (const k of ['F', 'B']) {
      const L = this.legs[k];
      L.hip.set(0, -HIP_DROP, L.side * 0.095).applyQuaternion(qP).add(_s1.set(pt.x, pt.y, pt.z));
      const fb = f.bodies[L.foot];
      const fr = fb.rotation();
      _qF.set(fr.x, fr.y, fr.z, fr.w);
      const ft = fb.translation();
      _s1.set(ft.x, ft.y, ft.z);
      L.fq.copy(_qF);
      L.fp.copy(_s1);
      L.ankle.set(-0.05, 0.035, 0).applyQuaternion(_qF).add(_s1);
      if (f.terrain) {
        // 지형 무대: 발바닥·발끝 높이는 그 자리 땅 위로
        _s2.set(0, -0.035, 0).applyQuaternion(_qF).add(_s1);
        L.soleY = _s2.y - f.terrain.heightAt(_s2.x, _s2.z);
        _s2.copy(SOLE_T).applyQuaternion(_qF).add(_s1);
        L.toeY = _s2.y - f.terrain.heightAt(_s2.x, _s2.z);
      } else {
        L.soleY = _s2.set(0, -0.035, 0).applyQuaternion(_qF).add(_s1).y;
        L.toeY = _s2.copy(SOLE_T).applyQuaternion(_qF).add(_s1).y;
      }
      const fx = _s2.set(1, 0, 0).applyQuaternion(_qF);
      L.footYaw = Math.atan2(-fx.z, fx.x);
    }
    const v = pel.linvel();
    this.vf.x += (v.x - this.vf.x) * 0.25;
    this.vf.z += (v.z - this.vf.z) * 0.25;
  }

  /**
   * 이 몸의 다리가 따라갈 수 있는 걷는 빠르기 한도(m/s) = GAIT.legVmax × 다리 힘 몫(인물 힘 · 다리 건강 · 약한 쪽 다리 기능 — 1 위로는 늘리지 않는다).
   *  다리 관절 토크 한도는 사람 한도 × 힘 몫이다(src/legs_vmc.js strengthOf). 걷는 동안 딛은 엉덩이가 내야 하는 토크는 앞으로 실린 윗몸을 받치는 몫(빠르기와 무관 · 70 ~ 100 N·m)
   *  + 내딛는 다리를 앞으로 보내는 반작용(빠르기에 비례)이라, 힘 몫이 작은 몸은 그만큼 느리게 걸어야 몸통을 세울 토크가 남는다.
   *  잰 값(힘 몫 0.65 = 숙련 2 '보통' 의 몸 · 세 무기 걷기 8 판): 한도 1.1 m/s → 0 · 0 · 0 / 0.95 → 4 · 0 · 3 / 0.85 → 8 · 3 · 7 / 0.75 → 8 · 8 · 8.
   */
  legV() {
    const f = this.f;
    const k = (0.6 + 0.4 * (f.legHealth ?? 1)) * (0.4 + 0.6 * Math.min(f.limbs?.legF ?? 1, f.limbs?.legB ?? 1)); // 인물 힘 몫은 안 곱함 (legs_vmc.js strengthOf 와 같은 까닭)
    return GAIT.legVmax * Math.min(1, k) * clamp(f.muscle ?? 1, 0, 1); // × 근육 세기(피 · 아픔 — vigor): 관절 토크 한도에 곱해지는 몫 그대로 — 피를 흘려 힘이 빠진 몸도 그만큼 느리게 · 짧게 걷는다 (넷째 판)
  }

  /**
   * 다리 힘이 버틸 수 있는 골반 높이의 바닥 (물리 2.0 넷째 판 — 다친 몸의 자세): 딛은 다리마다 '그 다리가 받칠 하중에서 버틸 수 있는 가장 큰 무릎 굽힘'(legs_vmc.js kneeBendMax)일 때의 골반 높이 가운데 높은 쪽.
   *  하중: 한 발 몫(몸무게 전부 — 언제든 다른 발을 떼어야 하므로). 일부러 낮춘 자세(crouch m — 줍기 웅크림 · 런지 자세 · 자세표 낮춤)는 두 발로 버티는 자세라 낮춘 만큼(0.1 m 에서 다) 두 발 몫(다리 힘 몫대로 나눔)으로.
   *  성한 몸은 어느 자세에서도 −Infinity (막지 않음). 장면마다 따로 둔 값은 없다 — 관절 토크 한도 × 근력 몫에서만 나온다.
   */
  strengthFloor(crouch) {
    const f = this.f;
    const D = f.legDrive;
    const sF = D.strengthOf('F');
    const sB = D.strengthOf('B');
    if (!(sF + sB > 1e-3)) return -Infinity;
    const two = clamp(crouch / 0.1, 0, 1);
    let h = -Infinity;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (!l.stance) continue;
      const share = (k === 'F' ? sF : sB) / (sF + sB);
      const phi = D.kneeBendMax(k, this.Mg * (1 - two * (1 - share)));
      if (!(phi < Infinity)) continue;
      const Ls = legLen(Math.max(GAIT.kneeBase, phi));
      const hx = l.hip.x - l.plant.x;
      const hz = l.hip.z - l.plant.z;
      const hy = (f.terrain ? l.plant.y : ANKLE_H) + Math.sqrt(Math.max(0.04, Ls * Ls - hx * hx - hz * hz)) + HIP_DROP;
      if (hy > h) h = hy;
    }
    return h;
  }

  /**
   * 독일 박찬 걸음(파고들기 · 뒤 박차기)이 걸려 있거나 그 걸음 중인가 — 옆 박차기(이베리아) · 박자 걸음 빠른 디딤은 아니다 (물리 2.0 넷째 판).
   *  그동안 조종 속도는 곧바로 바뀌고(fighter.js driveBalance) 박찬 걸음의 빠르기 한도는 걷는 한도 × 박찬 배율이며(update 의 한도 자르기) 박찬 발은 캡처 점으로 딛는다(target) —
   *  몸을 미는 밖 힘이 없으니 박찬 걸음도 발이 낼 수 있는 만큼만 빨라진다.
   */
  kickNow() {
    const B = this.burst;
    return B ? !B.side : this.fastK > 1 && !!this.kickStep; // (걸린 박차기 · 박찬 걸음 중 — kickStep 은 fastBegin 이 걸음마다 정함)
  }

  /**
   * 뛰는 걸음까지 넣은 빠르기 한도(m/s · 물리 2.0 넷째 판): 걷는 걸음은 legV() 그대로, 뛰는 동안은 runCapTick 이 스텝마다 고친 값(this.runV).
   *  가려는 속도 자르기(update) · 뛰는 걸음의 박자(update) · 뛰는 걸음의 디딜 자리(target)가 같은 값을 읽는다 — 셋이 다른 빠르기를 보면 몸은 1.6 m/s 로 가는데 발은 2.1 m/s 의 박자로 놀고 디딤 자리는 걸음마다 더 빨라지려 든다.
   */
  legVRun() {
    return this.runV ?? this.legV();
  }

  /**
   * 뛰는 걸음의 빠르기 한도를 스텝마다 한 번 고친다(update 가 부름) → this.runV. 걷는 한도 legV() 에서 뛰는 걸음 한도(RUN.legVmax × 같은 다리 힘 몫)로 뛰기 섞임 rk 만큼 옮겨 가되,
   *  오르는 빠르기는 GAIT.goAccel 까지 — RUN.blend(0.3 s) 만에 다 올리면 가려는 속도가 한 번에 뛰어(2.4 m/s²) 뛰기 시작한 0.3 ~ 0.9 s 에 넘어진다(잰 값 · 레이피어 한도 1.9: 8 판에 5 판 → 고친 뒤 1 판). 내리는 쪽은 섞임 그대로.
   *  걷는 걸음(rk 0)은 legV() 와 같은 값이다.
   */
  runCapTick(rk, dt) {
    const v = this.legV();
    if (!(rk > 0)) return void (this.runV = v);
    const t = v + (RUN.legVmax * (v / GAIT.legVmax) - v) * rk;
    this.runV = Math.min(t, Math.max(v, this.runV ?? v) + GAIT.goAccel * dt); // (오르는 빠르기는 GAIT.goAccel 까지 — 위 설명 그대로. 일꾼이 끊긴 커밋에는 이 줄이 빠져 있었다: 합치기에서 일꾼의 마지막 파일대로 되돌림)
  }

  /**
   * 기술이 걸음을 부탁한다 (AI의 베며 내딛기). kind: 'pass'(뒷발이 앞으로 나간다) | 'lunge'(앞발을 내딛는다)
   * fwd: 몸 기준 앞으로(m), side: 오른쪽으로(m), duration: 발이 떠 있는 시간(초)
   *  'retreat'(유파 비기 — 10/9 일본 後の先 ① 빠른 백스텝): 뒷발을 fwd(음수)만큼 뒤로 딛고 몸도 따라 물러난다. 물러나는 스틱이어도 받는다
   *  push: 기술 걸음 동안 몸이 따라 나가는 배율 (없으면 1 — 전과 같다. 일본 後の先 ② '앞발을 강하게')
   */
  requestStep(o = {}) {
    if (!this.active || this.f.state !== 'stand') return false;
    if (this.f.feetHeld || this.f.fireHold) return false; // 판 시작 정지 (ARENA.startHold): 기술 걸음도 받지 않는다 · AI 가 쏘는 동안(fireHold — 10/29)도
    // 물러나는 중이면 받지 않는다 (몸은 뒤로, 발은 앞으로 가면 넘어진다). 뒤로 딛는 걸음(retreat)은 예외
    if (this.f.move.y < -0.1 && o.kind !== 'retreat' && !o.force) return false; // force: 겹치기 앞 박차기 (몸은 이미 미끄러져 나감 — 발도 따라 디뎌야 넘어지지 않음)
    this.req = { kind: o.kind || 'pass', fwd: o.fwd ?? 0.5, side: o.side ?? 0, duration: clamp(o.duration ?? 0.4, Math.min(0.28, o.minT ?? 0.28), 0.7), age: 0, leg: o.leg ?? null }; // minT: 이보다 짧은 발 뜬 시간도 받음 (겹치기 앞 박차기 — 칼이 끌리는 시간에 맞춤 · 10/31 · 없으면 0.28 그대로) // leg 'left'|'right': 기술이 고른 발(R2′ 채널 B, 확인표 182) — 없으면 아래 규칙(lunge 앞발·pass 뒷발)
    if (o.push) this.req.push = o.push;
    if (o.accel) this.req.accel = true; // 안다레 리솔루토 런지 · 되돌아오기 (10/24 14:0x): 이 걸음 동안 · 끝난 뒤 몸이 따라잡을 때까지 가속 한도 × GAIT.burstAccel (lungeBrake — fighter.js driveBalance)
    if (o.draw) this.req.draw = true;
    if (o.tech) this.req.tech = o.tech; // 기술 이름 (중국 활 자세 P.bow.tech 가 읽는다 — 다른 유파는 안 읽음) // 유파 걸음(10/10): 디딘 뒤 뒷발 끌어붙임 걸음 하나 (일본 히키츠케·중국 체보)
    // 유파 걸음 follow 안에서는 지나 딛는 기술 걸음(플레이어 베기 걸음·근접 걸음 등 'pass')을 그 유파 꼴로 (P.passAs — 앞발 lunge + 끌어붙임: 앞뒤 발이 안 바뀐다)
    const pa = this.follow && o.kind === 'pass' ? this.P.passAs : null;
    if (pa) {
      this.req.kind = pa.kind;
      this.req.fwd = passAsFwd(this.req.fwd, pa); // 걸음 사다리 한 칸 아래
      this.req.leg = null;
      if (pa.draw) this.req.draw = true;
    }
    return true;
  }

  /**
   * 독일 간격 잡기 — 받을 창 (10/15 사장님 결정 '헛침만, 앞으로 두 걸음 50%로 가자' — docs/strike/german_chase_2026-10-15.md, 그때 이름 '따라 들어가기'): 상대 공격이 칼에도 몸에도 닿지 않고 끝났다(헛침) —
   *  ai.js afterStrike 의 missed · 사람 휘두르기는 skill.js whiffTrack 이 부른다. 내 무기가 독일 유파(TRADITIONS.german.chase)이고 서서 걷는 몸이면 받을 창을 연다(새 헛침이면 새로).
   *  잡기(10/15 18:0x, docs/strike/german_hold_2026-10-15.md): 플레이어(AI 가 몰지 않는 몸)는 헛침 때 이미 내 칼이 제대로 들어가는 거리(swordArt.measure.contact —
   *   가슴-가슴, holdTick 과 같은 잣대) 안이면 창을 열지 않는다(이미 가까움). 11/19 부터 사람 · AI 모두 받지 않음(아래 첫 줄 — 시뮬 대본 몸만).
   *  상태만 적고 난수·몸은 건드리지 않는다
   */
  foeWhiff() {
    if (!this.active || this.f.state !== 'stand') return;
    if (this.f.humanInput || this.f.aiControlled) return; // 11/14 사장님 '간격 잡기를 파고들기로 바꿔' — 사람 · AI 모두 옛 간격 잡기(받을 창 · 빠른 디딤 · 잡기)는 거둠(파고들기가 맡음 — 사람 gait.js update 걷기 시작 · AI dig_proto · deDigAi). 사람은 11/14 · AI 는 11/19(사장님 '사람 · AI 같게' — 독일 대 이탈리아 숙련 5 · 40 판 있음 23.8 / 없음 25.0 % · docs/strike/human_ai_parity_2026-11-19.md §7) · 시뮬 대본 몸만 그대로
    const def = TRADITIONS[footworkTradition(this.f)]?.chase; // 독일 간격 잡기 — 보법 I 을 안 익힌 플레이어는 없음
    if (!def || kitOff(this.f, 'chase')) return; // 사람은 스킬트리 G2 '보법 II · 간격 잡기' (10/21 — G1 은 뒤 박차기만)
    if (!this.f.aiControlled && this.f.foeDistance() <= this.f.swordArt.measure.contact) return;
    this.chase = { def, t: 0, left: def.steps, got: false };
  }

  /**
   * 독일 간격 잡기 — 잡기 (10/15 18:0x 사장님 승인 "'간격 잡기'로 네가 잡은 기준으로 테스트 해봐" · 감독 보충 '거기서 서야' — docs/strike/german_hold_2026-10-15.md):
   *  플레이어(AI 가 몰지 않는 몸)만, fighter.js driveBalance 가 조종 입력을 읽기 전에 매 스텝 부른다. 칼 입력은 읽지 않는다(다리만의 규칙).
   *  걸기: 받을 창이 열려 있거나(this.chase — 받기 전·받은 뒤 남은 걸음) 간격 잡기 빠른 디딤 중(fastK > 1 · chaseStep)에
   *   '지금 거리 − 멈추는 거리' ≤ 내 무기 swordArt.measure.contact(칼이 제대로 들어가는 거리 — 롱소드 1.57 m, 무기별 실측)이면 —
   *   거리 = 가슴-가슴 수평(fighter.foeDistance — AI 가 measure 와 견주는 d 와 같은 잣대) · 멈추는 거리 = v² ÷ (2 · maxAccel · burstAccel)
   *   (v = 걸러진 골반 빠르기 vf 의 상대 쪽 몫 — 세게 멈춤 가속으로 서는 거리: 서는 자리가 contact 근처가 되게)
   *   → 남은 빠른 디딤을 버리고(fastK 1 · 받을 창 닫음) 잡기 window s(받을 창과 같은 값 0.6) · 세게 멈춤(holdBrake — 가속 한도 × burstAccel, 박차기 뒤 세게 멈춤과 같은 값)
   *  잡는 동안: 조종 입력(move — 스틱, 그리고 거기에 얹힌 베기 첫 0.3 s 몸 밀기)의 앞 몫만 0(fighter.js driveBalance — 옆·뒤 몫은 그대로, 판 시작 정지와 같은 자리) ·
   *   몸이 이미 가진 빠르기는 물리대로(세게 멈춤 한도로 줄고, 다 줄면 보통 한도) · 기술 걸음(requestStep)·균형 걸음(stumble)은 그대로
   *  풀기: 스틱을 놓으면(데드존 안 = 0 — main.js stickX·stickY, 없으면 move) 바로 · window s 지나면 · 판 시작 정지·마무리 중 · 넘어짐(exit). 한 받을 창에 한 번(걸 때 창을 닫음)
   *  세게 멈춤 끝은 update(몸의 그 쪽 빠르기가 가려는 속도의 그 몫 + BRAKE_TOL 안 — 박차기 세게 멈춤과 같은 셈, 시간 값 없음). 난수는 건드리지 않는다
   */
  holdTick(dt) {
    const f = this.f;
    if (f.feetHeld || f.finish?.amt > 0.5) {
      if (this.hold) this.holdEnd = 'state';
      this.hold = this.holdBrake = null;
      return;
    }
    const H = this.hold;
    if (H) {
      const sx = f.stickX ?? f.move.x;
      const sy = f.stickY ?? f.move.y;
      if (!sx && !sy) this.holdEnd = 'stick';
      else if ((H.t += dt) > H.T) this.holdEnd = 'time';
      else return;
      this.hold = null;
      return;
    }
    if (!this.chase && !(this.fastK > 1 && this.chaseStep)) return;
    const foe = f.foe;
    const contact = f.swordArt?.measure?.contact;
    if (!foe || !(contact > 0)) return;
    const a = f.bodies.chest.translation();
    const b = foe.bodies.chest.translation();
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    if (!(d > 1e-6)) return;
    const v = Math.max(0, (this.vf.x * dx + this.vf.z * dz) / d);
    if (d - (v * v) / (2 * GAIT.maxAccel * GAIT.burstAccel) > contact) return;
    this.hold = { t: 0, T: TRADITIONS[footworkTradition(f)]?.chase?.window ?? 0 };
    this.holdEnd = null;
    this.holdBrake = { x: dx / d, z: dz / d };
    this.fastK = 1;
    this.chase = null;
  }

  /**
   * 빠른 걸음 (10/15): 새 걸음을 뗄 때(update ③) 이 걸음이 빠른 걸음인지(fastK) 정한다 → 이 걸음 시간을 돌려준다.
   *  RH = 이탈리아 박자 걸음(P.rhythm — docs/strike/italian_rhythm_2026-10-15.md)이 세고, C = 독일 간격 잡기 받을 창(this.chase — docs/strike/german_chase_2026-10-15.md)이 쓴다.
   *  한 걸음(펜싱의 한 걸음) = follow 짝걸음이면 이끄는 발로 여는 한 짝(따라붙는 발·짝 사이 쉼까지 같은 걸음 — 몸 박자 leadV·trailV·restV 도 한 짝이 한 단위),
   *   아니면(지나 딛기) 걷는 동안 몸을 옮기는 한 디딤 — walk 걸음, 그리고 걷는 중 다리가 안 닿아 먼저 옮기는 catch 걸음(스틱 끝까지 앞으로 달리면
   *   레이피어 앞발 디딤이 늘 catch 로 열린다 — 박자 걸음 전에도 그렇다. 안 세면 두 디딤에 하나만 센다).
   *   앞뒤 걸음(옆 몫이 앞뒤 몫보다 작은 걸음)만 센다 — 앞 ↔ 뒤로 바꿔도 셈은 이어진다(펜싱 박자).
   *  every 번 센 다음 걸음이 빠른 걸음(fastK = mul): 그 걸음을 떼서 다음 걸음을 뗄 때까지 — 짝걸음은 이끄는 발 + 첫 따라붙는 발 + 짝 사이 쉼까지
   *   (뒤에 남은 발을 한 번 더 따라붙이는 걸음은 빠른 걸음 끝 — 몸이 빠른 채 따라붙기를 되풀이하지 않게).
   *   옆 걸음·기술 걸음(req·draw)·짝걸음 안 catch·자세 고치기는 세지도 끊지도 않는다(빠른 걸음만 거기서 끝남 — 그 걸음은 제 시간)
   *  방향을 막 바꿔 몸이 아직 반대쪽으로 RH.brake m/s 넘게 가는 동안 뗀 걸음은 빠른 걸음을 미룬다(셈은 하고 다음 앞뒤 걸음이 빠른 걸음) — 멈춰 서는 디딤을
   *   서두르면 붙잡기 반사가 는다(스틱 끝 앞 ↔ 뒤 번갈아 — rhythm_step_feel C). 빠른 걸음 중 스틱 앞뒤가 뒤집혀도 거기서 끝(update)
   *  간격 잡기 빠른 디딤은 같은 '한 걸음' 가운데 앞 걸음(wf > 0)만 받고 쓴다 — 받을 창 안 첫 앞 걸음부터 steps 걸음(몸이 아직 뒤로 brake 넘게 가는 앞 걸음은 받기만)
   *  ※ 위 '한 걸음'(짝걸음 = 한 짝)은 옛 짝 셈(11/17 걷음)이고, 박자 걸음은 디딤 셈(10/15 13:2x 사장님 '디딤 기준으로 통일'):
   *   짝걸음 안에서도 **디딤 하나 = 한 걸음**(이끄는 발·따라붙는 발·걷는 중 catch 모두) — 앞뒤 디딤 normal 번 보통 → 다음 fast 디딤이 빠름(기본 2 + 2 — 10/15 15:1x, 전 4 + 2 · 셈 rhyN, 남은 빠른 디딤 rhyF).
   *   짝걸음이면 빠른 몫은 **이끄는 발 디딤에서만 시작** — 셈이 따라붙는 발에서 차면 그 발은 보통으로 두고(셈은 normal 에 머묾) 다음 이끄는 발에서 시작 → 빠른 몫이 펜싱 한 걸음 통째.
   *   빠른 디딤마다 fastK = mul(박자 · 몸 빠르기 — 짝걸음은 발 뜬 시간 그대로, 짝 사이 쉼에서 줄임) · 가속 한도 규칙도 그대로(RH.accel 없음 = × 1).
   *   옆 걸음·기술 걸음·자세 고치기는 세지도 끊지도 않음(그 걸음은 제 빠르기 — 남은 빠른 디딤은 다음 앞뒤 디딤으로) · brake 미룸 · idle 끊김 · 스틱 뒤집힘 끝은 같음
   *   (스틱이 뒤집혀 빠른 걸음이 끝나면 남은 빠른 디딤도 버림 — update). 독일 간격 잡기 빠른 디딤은 원래 디딤 셈(PR 없음)이라 그대로
   *  wf = 가려는 속도의 앞 몫(m/s, 부호 있음) · vb = 걸러진 골반 속도의 앞 몫
   */
  fastBegin(RH, C, kind, PR, wf, vLat, vb, Tstep) {
    const k0 = this.fastK;
    this.fastFore = false; // 첫 걸음 박차기의 '앞뒤 몫만 빠르게'(이베리아 아닌 유파 비스듬히 뒤) — 아래 박차기 가지만 켬
    this.chaseStep = false; // 이 걸음이 간격 잡기 빠른 디딤인가 — 아래 C 가지만 켬 (잡기 걸기 holdTick 이 읽음)
    this.digStep = false; // 이 걸음이 파고들기 박찬 앞 걸음인가 — 아래 박차기 가지의 dig 만 켬 (11/14)
    this.kickStep = false; // 이 걸음이 독일 박찬 걸음(파고들기 · 뒤 박차기)인가 — 아래 박차기 가지가 켬 (kickNow)
    const foot = !!RH; // 박자 걸음 디딤 셈 — 짝걸음 따라붙는 발·catch 도 센다
    this.fastTimeOnly = false; // 박자 걸음 보폭 박자(10/15 22:1x · 22:5x 이탈리아): 빠른 몫은 발 박자 ×mul · 몸 빠르기 ×speedMul
    if (Math.abs(wf) > vLat && (PR && !foot ? kind === 'walk' && this.pairStep === 'lead' : kind === 'walk' || (kind === 'catch' && this.walking))) {
      let k = 1;
      if (foot) {
        // 디딤 셈 N + M: 빠른 몫 안이면 이 디딤도 빠름 · 아니면 normal 번 센 뒤(짝걸음은 이끄는 발 디딤에서만 · 멈춰 서는 디딤은 brake 로 미룸) 빠른 몫 시작
        const fresh = !this.rhyGo; // 보폭 박자: 쉬었다 걸으면 짧은 디딤(빠른 몫)부터 — '1-2 디딤 짧게 3-4 디딤 넓게' (쉬었다 떼는 첫 디딤은 짝 자리가 아직 없어도 이끄는 발로 봄)
        if (fresh) this.rhyN = RH.normal;
        this.rhyGo = true;
        let fast = this.rhyF > 0;
        if (fast) this.rhyF--;
        else if (this.rhyN >= RH.normal && ((fresh && this.pairStep !== 'trail') || !PR || (kind === 'walk' && this.pairStep === 'lead')) && vb * Math.sign(wf) > -(RH.brake ?? Infinity)) {
          fast = true;
          this.rhyN = 0;
          this.rhyF = RH.fast - 1;
        } else this.rhyN = Math.min(RH.normal, this.rhyN + 1);
        if (fast) {
          k = RH.mul;
          this.fastAccent = RH.accent ?? true;
          this.fastAcc = RH.accel ?? 1;
          this.fastTimeOnly = true;
          this.fastSpeedMul = RH.speedMul ?? 1; // 몸 빠르기 배율(보폭 + 빠르기 결합 — 10/15 22:5x)
        }
      }
      if (C && wf > 0) {
        // 간격 잡기 빠른 디딤: 받을 창 안의 첫 앞 걸음이 받는다 — 몸이 아직 뒤로 brake 넘게 가면 받기만 하고(멈춰 서는 디딤) 빠른 걸음은 다음 앞 걸음부터. steps 걸음을 다 쓰면 끝
        C.got = true;
        if (vb > -(C.def.brake ?? Infinity)) {
          k = C.def.mul;
          this.fastAccent = C.def.accent ?? true;
          this.fastAcc = C.def.accel ?? 1; // 가속 한도 배율 (fighter.js driveBalance — 그 걸음 동안만)
          this.chaseStep = true;
          this.fastTimeOnly = false;
          if (--C.left <= 0 && this.chase === C) this.chase = null;
        }
      }
      this.fastK = k;
      this.fastDir = Math.sign(wf);
      this.fastSide = 0;
      this.rhyTrail = !!PR && !foot; // 짝 셈(박자 걸음 없는 간격 잡기 · 박차기): 이 짝의 따라붙는 발 하나는 같은 걸음 (박자 걸음 디딤 셈은 따라붙는 발도 제 디딤으로 센다)
    } else if (PR && !foot && kind === 'walk' && this.pairStep === 'trail' && this.rhyTrail) this.rhyTrail = false;
    else {
      this.fastK = 1;
      this.rhyTrail = false;
    }
    // 첫 걸음 박차기 (10/15 — update 의 걷기 시작에서 건 this.burst): 걷기 시작 뒤 처음 뗀 걸음이 걷는 걸음(walk·catch — 짝걸음은 이끄는 발로 여는 한 짝)이면
    //  그 걸음을 빠른 걸음으로 — 몸 빠르기·발 박자 × fastK · 가속 한도 × burstAccel · 발소리 강조는 빠른 걸음과 같은 FAST_ACCENT(10/15 15:2x 사장님 '박차기에 발소리 강조 붙여' —
    //  박찬 발 디딤만: 다음 걸음은 fastK 1 이라 update ③ 이 그 발의 fastStep 을 지움). 박자 걸음 셈은 위에서 그대로(이 걸음도 센다), 배율만 덮는다.
    //  fastK = 절대 목표 빠르기 ÷ 그 쪽 걷는 빠르기(뒤 burstBackV ÷ (moveSpeed × backFactor) · 옆 burstSideV ÷ (moveSpeed × sideFactor) — 스틱의 옆 몫 비율 lat 로 섞음, 1 아래로는 안 내림)
    //  끝: 다음 걸음을 뗄 때(위 가지들이 fastK 를 다시 정함 — 이어 걷는 걸음은 제 빠르기) · 스틱이 거꾸로 가면 · 멈추면(update). 첫 걸음이 기술 걸음이면 박차기는 버린다
    //  파고들기 (11/14 사장님 '간격 잡기를 파고들기로 바꿔 … 두 걸음 빠르게 들어가는 기술' — B.dig = 남은 박찬 앞 걸음 수, update 걷기 시작이 걺): 같은 장치로 앞 걸음을 박찬다 —
    //   fastK = digV ÷ 앞 걷는 빠르기(moveSpeed) · 앞 걸음(wf > 0)만(아니면 버림) · 기력은 첫 걸음만(다음 걸음은 free) · 남은 걸음이 있으면 다음 걸음에 다시 걺(그 걸음도 걷는 걸음이어야 —
    //   기술 걸음 · 자세 고치기 · 멈춤 · 스틱 뒤집힘이면 끝). 그 순간 창 시계는 이 걸음 동안 멈춤(digStep — school_passive.js)
    const B = this.burst;
    if (B?.dig && !(wf > 0)) this.burst = B.ai > 0 ? { ...B, ai: B.ai - 1 } : null; // AI 파고들기(deDigAi — 11/14 3 단계): 걸 때 디디던 걸음(물러서던 · 옆 걸음)이 둘까지 지나가도 남김 (스틱을 앞으로 바꾼 뒤 첫 앞 걸음에)
    else if (B) {
      this.burst = null;
      if ((kind === 'walk' || kind === 'catch') && (!PR || this.pairStep === 'lead')) {
        if (B.dig) {
          this.fastK = Math.max(1, GAIT.digV / GAIT.moveSpeed);
          this.fastFore = !!B.foreOnly;
          this.fastAcc = GAIT.burstAccel;
          this.fastTimeOnly = false;
          this.fastAccent = FAST_ACCENT;
          this.fastDir = 1;
          this.fastSide = 0;
          this.rhyTrail = !!PR;
          this.burstStep = true;
          this.digStep = true;
          this.kickStep = true;
          this.digSteps++;
          if (!B.free) {
            this.digs++;
            this.f.stamina?.burst(); // 기력: 박찬 걸음 pushCost 12 를 한 번 (두 걸음 한 기술 — 다음 걸음은 free)
          }
          if (B.dig > 1) this.burst = { ...B, dig: B.dig - 1, free: true };
          return Math.min(Tstep, GAIT.burstT);
        }
        const kB = GAIT.burstBackV / (GAIT.moveSpeed * GAIT.backFactor);
        const kS = GAIT.burstSideV / (GAIT.moveSpeed * GAIT.sideFactor * (this.P.sideMul || 1)); // 이베리아 옆 빠르기(P.sideMul × 1.3)도 박찬 걸음은 같은 절대 목표 — 걷는 옆걸음만 빠르다
        this.fastK = Math.max(1, kB + (kS - kB) * B.lat);
        this.fastFore = !!B.foreOnly; // 이베리아 아닌 유파의 비스듬히 뒤: 몸 빠르기의 앞뒤 몫만 × fastK (옆 몫은 보통 빠르기 — §8)
        this.fastAcc = GAIT.burstAccel;
        this.fastTimeOnly = false;
        this.fastAccent = FAST_ACCENT; // 박찬 발 디딤 발소리 강조(× 1.3 · × 1.06 — 빠른 걸음과 같은 값 · 10/15 15:2x)
        this.fastDir = B.side ? 0 : B.fore;
        this.fastSide = B.side;
        this.rhyTrail = !!PR;
        this.burstStep = true; // 부른 쪽(update ③)이 이 걸음의 발을 burstLeg 로 적는다
        this.kickStep = !B.side; // 뒤 박차기 (옆 박차기는 아님)
        if (B.fore < 0 && !B.side) bwBurst(this.f, B.bw); // 뒤 박차기 헛침 경직 (11/19 [사장님 결정] — burst_whiff.js): 뒤 박찬 걸음을 뗀 순간 — 걸 때 · 뗄 때 나를 겨눠 나가는 칼이 아직 안 끝났으면 표시 (옆 박차기 · 파고들기는 아님)
        if (!B.free) this.f.stamina?.burst(); // 기력: 박찬 걸음을 뗄 때 한 번 12 (STAMINA.pushCost — 설계안 §1 · docs/strike/stamina_import_2026-10-15.md). 기력 끔이면 아무 일도 없다 · free = 죽음의 일격 강제 뒤 박차기(10/31 시제품 SECRET.mord.burstFree — 비기 값에 든 것으로)
        // 발 뜬 시간은 절대값 burstT(그 걸음 제 시간보다 길게는 안 함) — 몸 빠르기 배율로 나누면(÷ fastK) 걸음이 너무 짧아(0.15 s) 몸이 박찬 빠르기에 닿기 전에 걸음이 끝난다
        return Math.min(Tstep, GAIT.burstT);
      }
    }
    // 지나 딛기는 이 걸음 시간을 새 배율로 (Tsw 는 지난 배율로 셈했다 — 짝걸음 발 뜬 시간·기술 걸음·끌어붙임·자세 고치기는 제 시간이라 그대로)
    return this.fastK !== k0 && !PR && (kind === 'walk' || kind === 'catch') ? (Tstep * k0) / this.fastK : Tstep;
  }

  /**
   * 막는 중인가 (박자 걸음 셈 시계 — 사장님 결정 10/17 14:5x '막기 중엔 셈을 지우지 않게 함'):
   *  플레이어 = 막기 단추가 손을 쥔 동안(parry_button.js active — 누름 · 휘두르지 않음 · 서 있음) · AI = 막기 꼴(ai.js mode 'defend', 피하기 아님 — 기력 장부 stamina.guarding 과 같은 가름)
   */
  parrying() {
    const f = this.f;
    return f.parryGuard ? !!f.parryGuard.active : !!(f.aiControlled && f.stamina?.guarding);
  }

  /**
   * 물러서기 걸음 수 셈 (10/31 08:xx 사장님 '이탈리아도 네걸음 이후에는 (다섯 걸음째부터) 70% 적용' — 걸음 칸 backCap · update ③ 이 새 걸음을 뗄 때 부름):
   *  박자 걸음(fastBegin)과 같은 디딤 셈 — 걷는 걸음(walk · 걷는 중 catch) 디딤 하나 = 한 걸음(짝걸음의 이끄는 발 · 따라붙는 발도 하나씩).
   *  앞뒤 몫이 옆 몫보다 큰 뒤 걸음이면 +1 · 앞 걸음 · 옆 몫이 큰 걸음 · 빈 스틱 걸음은 몸이 더는 물러나지 않을 때(걸러진 골반 빠르기의 뒤 몫 < GAIT.walkMin — 걷기 문턱)만 0 으로
   *  (물러서기 끝) — 아직 뒤로 미끄러지는 동안이면 세지도 끊지도 않는다: 스틱을 잠깐 놓거나 옆으로 한 디딤 틀어 셈만 지우고 물러선 빠르기는 그대로 갖고 가는 꼴을 막는다
   *  (재 봄: 넷째 디딤마다 놓기 · 옆 한 디딤이 곧게 물러서기보다 +31 · +26 % 빨랐다). 몫은 이번 스텝 가려는 속도의 뒤 느려짐 없애기 전 값(backWf · backWl) · vb = 걸러진 골반 빠르기의 앞 몫.
   *  기술 걸음(req · draw) · 자세 고치기(settle)는 세지도 끊지도 않는다(박자 걸음과 같음)
   */
  backStep(kind, vb) {
    if (!(kind === 'walk' || (kind === 'catch' && this.walking))) return;
    if (this.backWf < 0 && -this.backWf > this.backWl) this.backN++;
    else if (-vb < GAIT.walkMin) this.backN = 0;
  }

  /**
   * 물러서기 걸음 수 끊기 (10/31 — backCap.idle): 걸음(자세 고치기 빼고)이 끝난 뒤 idle s(박자 걸음 멈춤 기준 0.6 s — 사장님 결정 10/17) 안에 새 걸음을 떼지 않으면 처음부터 ·
   *  판 시작 정지 · 마무리 중에도 처음부터(박자 걸음과 같음). 발이 떠 있는 동안은 재지 않는다
   */
  backTick(dt, swing) {
    const f = this.f;
    if (f.feetHeld || f.finish?.amt > 0.5) {
      this.backN = 0;
      this.backIdle = 0;
    } else if (swing && swing.kind !== 'settle') this.backIdle = 0;
    else if ((this.backIdle += dt) > this.P.backCap.idle) this.backN = 0;
  }

  /**
   * 고른 짝걸음(P.pair.even — 10/15 이탈리아 '고른 바탕 걸음')의 다음 디딤 배율 미리 보기: 짝걸음 안 다음 걷는 걸음(trail = 따라붙는 발이면 true)이
   *  박자 걸음 빠른 디딤일지 — fastBegin 의 박자 걸음 셈과 같은 가름이되 상태(rhyN·rhyF·fastK)는 바꾸지 않는다. 디딤 셈(기본)은 빠른 몫 안이면 빠름 ·
   *  아니면 보통 디딤을 다 셌고 이끄는 발이고 몸이 반대쪽으로 brake 넘게 가지 않을 때 빠름.
   *  update ③ 이 다음 발을 뗄 때(gate)를 정할 때만 부른다 — 빠른 디딤으로 끝나는 간격을 짧게(박자 걸음의 셈·빠르기 자체는 fastBegin 그대로)
   */
  fastPeek(RH, trail, wf, vLat, vb) {
    if (!(Math.abs(wf) > vLat)) return 1;
    const go = vb * Math.sign(wf) > -(RH.brake ?? Infinity);
    const fresh = !this.rhyGo; // 보폭 박자 — fastBegin 과 같은 가름(쉬었다 떼는 첫 이끄는 디딤부터 짧은 디딤)
    return this.rhyF > 0 || (!trail && (fresh ? RH.normal : this.rhyN) >= RH.normal && go) ? RH.mul : 1;
  }

  /**
   * 첫 걸음 박차기 발(burstLeg)의 디딜 자리 셈(target): 남은 시간 remain 동안 몸이 가려는 속도 × fastK 쪽으로 박찬 가속 한도(maxAccel × burstAccel)로 빨라진다(느려진다)고 보고
   *  디딜 때의 몸 자리(px·pz)와 몸 빠르기(x·z)를 내다본다 — 지금 빠르기(vf)로만 보면 아직 거의 서 있는 몸이라 발이 몸 밑에 짧게 떨어지고, 박찬 몸이 그 발을 지나친다
   *  (놓으면 '가만히 서기' 무게중심 되돌림이 몸을 도로 끌어온다). 박찬 쪽과 수직인 몫은 지금 빠르기 그대로. 디딜 자리 식(Raibert)은 그대로 이 값을 쓴다
   */
  burstAhead(p, want, remain, fwd) {
    const v = this.vf;
    const o = _ba;
    // 박찬 목표 빠르기 = want × fastK — 앞뒤 몫만 빠르게 한 박차기(이베리아 아닌 유파 비스듬히 뒤 — fastFore)는 want + fwd·(want·fwd)·(fastK − 1)
    let wx = want.x;
    let wz = want.z;
    let k = this.fastK;
    if (this.fastFore) {
      const wfo = want.x * fwd.x + want.z * fwd.z;
      wx += fwd.x * wfo * (k - 1);
      wz += fwd.z * wfo * (k - 1);
      k = 1;
    }
    const w = Math.hypot(wx, wz);
    if (w < 1e-6) {
      o.x = v.x;
      o.z = v.z;
      o.px = p.x + v.x * remain;
      o.pz = p.z + v.z * remain;
      return o;
    }
    const ux = wx / w;
    const uz = wz / w;
    const W = w * k; // 박찬 목표 빠르기 (스틱 쪽 — 앞뒤 몫만이면 그 목표 쪽)
    const va = v.x * ux + v.z * uz;
    const a = GAIT.maxAccel * GAIT.burstAccel;
    const s = Math.sign(W - va);
    const tr = Math.min(remain, Math.abs(W - va) / a); // 목표 빠르기에 닿는 데 걸리는 시간
    const d = va * tr + 0.5 * s * a * tr * tr + W * (remain - tr);
    const vEnd = va + s * a * tr;
    o.x = v.x + (vEnd - va) * ux;
    o.z = v.z + (vEnd - va) * uz;
    o.px = p.x + (v.x - va * ux) * remain + ux * d;
    o.pz = p.z + (v.z - va * uz) * remain + uz * d;
    return o;
  }

  /** 몸을 turn(라디안)만큼 돌리려 할 때, 딛은 발에 대해 엉덩이가 비틀 수 있는 만큼으로 줄인다 */
  /**
   * 옆 박차기 명령 (10/21 SIDE_DASH — 시험): 걷는 중에도 다음에 떼는 걸음을 옆 박찬 걸음으로(update 의 걷기 시작 박차기와 같은 this.burst — fastBegin 이 쓴다).
   *  옆 박차기는 유파 걸음 칸 burstSide(이베리아)만(10/15 사장님 결정) · 판 시작 정지 · 마무리 · 박찬 뒤 세게 멈춤 · 이미 박찬 걸음 중이면 무시. 걸었으면 true
   */
  sideDash(side) {
    const f = this.f;
    if (!side || !this.P.burstSide || f.feetHeld || f.finish?.amt > 0.5 || this.burstBrake || this.burst || this.fastK > 1) return false;
    this.burst = { fore: 0, side: Math.sign(side), lat: 1 };
    return true;
  }

  /**
   * 독일 파고들기 · 뒤 박차기 명령 — AI 몫 (11/14 3 단계 독일 플랜 · src/ai_plan_de.js): 사람 장치(파고들기 — 앞 digSteps 걸음 박찬 걸음 · 뒤 박차기)와 같은 this.burst 를
   *  다음에 떼는 걸음에 건다(옆 박차기 sideDash 와 같은 꼴 — 걷는 중에도). 무기 유파 독일 · 판 시작 정지 · 마무리 · 박찬 뒤 세게 멈춤 · 이미 박찬 걸음 중이면 무시. 걸었으면 true
   */
  deDigAi() {
    const f = this.f;
    if (footworkTradition(f) !== 'german' || kitOff(f, 'chase') || f.feetHeld || f.finish?.amt > 0.5 || this.burstBrake || this.burst || this.fastK > 1) return false; // 11/16 칸 몫: 파고들기 칸 G2(열쇠 chase — 사람과 같음)
    this.burst = { fore: 1, side: 0, lat: 0, foreOnly: false, dig: GAIT.digSteps, ai: 2 };
    return true;
  }

  backBurstAi() {
    const f = this.f;
    if (footworkTradition(f) !== 'german' || f.feetHeld || f.finish?.amt > 0.5 || this.burstBrake || this.burst || this.fastK > 1) return false;
    this.burst = { fore: -1, side: 0, lat: 0, bw: bwAim(f) }; // bw = 뒤 박차기 헛침 경직 (11/19): 걸 때 나를 겨눠 나가는 칼
    return true;
  }

  limitTurn(turn) {
    if (!turn) return turn;
    const f = this.f;
    const pel = f.heading + (f.pelvisYawOffset || 0);
    let lim = Infinity;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (!l.stance) continue;
      // 도는 쪽으로 이미 비튼 만큼 (디딜 때의 발 방향 기준: 발이 비틀려 끌려가도 한계가 따라 늘지 않게)
      const tw = wrap(pel - l.yawTD) * Math.sign(turn);
      lim = Math.min(lim, Math.max(0, GAIT.maxTwist - tw));
    }
    return Math.sign(turn) * Math.min(Math.abs(turn), lim);
  }

  /**
   * 겹치기 앞 박차기 (10/31 19:xx — secret_instant.js dupBurstStart): 칼과 같은 때 앞발을 내딛음. 떠 있는 발이 없으면 requestStep 그대로(다음 스텝에 앞발 'lunge') ·
   *  앞발이 이미 떠 있으면(걷던 걸음) 그 걸음을 이 걸음으로 이어받음(디딜 자리 = 뗀 자리 + fwd · 남은 발 뜬 시간 = duration) — 걷던 걸음을 디딘 뒤 또 내딛어 칼보다 늦지 않게 ·
   *  뒷발이 떠 있으면 그 걸음 그대로 두고 부탁하지 않음(false — 뒷발이 디딘 뒤 앞발이 나가면 칼보다 늦음 · 몸 미끄러짐은 그대로). 받았으면 true
   */
  takeStep(o) {
    const L = this.legs;
    const sw = !L.F.stance ? L.F : !L.B.stance ? L.B : null;
    if (!sw) return this.requestStep(o);
    if (!this.requestStep(o)) return false;
    sw.kind = 'req';
    sw.T = sw.t + this.req.duration;
    return true;
  }

  /** 앞발(몸 기준 앞에 있는 발) */
  frontLeg(fwd) {
    const a = this.legs.F.plant;
    const b = this.legs.B.plant;
    return (a.x - b.x) * fwd.x + (a.z - b.z) * fwd.z >= 0 ? 'F' : 'B';
  }

  /**
   * 매 스텝(서 있는 동안) driveBalance가 부른다. want(가려는 속도, 월드)에 좌우 무게 옮기기·자리 지키기를 더하고,
   * 골반 높이 목표(this.h)를 정한다.
   */
  update(dt, want, fwd, rgt) {
    const f = this.f;
    const pl = !f.aiControlled; // 사람 쪽 몸 (아래 박차기 · 옆 박차기 — 스틱 입력 몫)
    // 유파 걸음 값: 무기(검술 풀이)가 바뀌었으면 다시 고른다 — 칸 없는 유파는 늘 GAIT 그대로 (11/19 A12 — 사람 덮개 칸을 지워 조종(aiControlled)과 상관없음)
    if (this._art !== f.swordArt || this._fw !== f.schoolFootwork || this._kit !== f.skillKit) {
      this._art = f.swordArt;
      this._kit = f.skillKit; // 스킬트리 칸 몫 (10/21 — 사람만 · AI 는 늘 없음)
      this._fw = f.schoolFootwork; // 스킬트리 보법 I (사람 = 대기실 칸 · AI = 칸 몫 AI_KIT — 11/16 ai.js applyKit · 판을 세울 때 정한다 · 칸 몫 skillKit 도 그때)
      this.P = gaitParams(f);
    }
    // 뛰는 걸음 꼴 (11/18 뛰기 — src/run.js 가 스틱 길 몫을 둔 몸(사람 · 셋 이상 판 AI)에만 f.run 을 둠): 0 이면 아래 섞기는 모두 걷는 값 그대로
    const rk = f.run ? f.run.k : 0;
    this.rk = rk;
    this.runCapTick(rk, dt); // 뛰는 걸음의 빠르기 한도 (rk 0 이면 걷는 한도 그대로)
    // 유파 옆 빠르기(P.sideMul — 10/10 이베리아 데스트레사 둥근 걸음, 사장님 '사이드스텝 이동량 증가' · 확인표 623): 조종 스틱에 옆 몫이 있을 때 가려는 속도의 옆 몫을 배율만큼.
    //  몸의 일이라 플레이어·AI 같이(기질 circleRate 는 그대로 — 두 번 곱하지 않음). 칸 없으면 셈하지 않는다(바이트 같음)
    if (this.P.sideMul && !f.feetHeld && f.move.x) {
      const wl = want.x * rgt.x + want.z * rgt.z;
      want.addScaledVector(rgt, wl * (this.P.sideMul - 1));
    }
    // 이탈리아 뒤 느려짐 없앰 (10/21 — 걸음 칸 backMul 'flat'): 가려는 속도의 뒤 몫에서 GAIT.backFactor 를 되곱한다(앞 · 옆 몫 그대로 — 앞 · 뒤 배율 시험 foreMul · setItalianWalk 는 11/17 걷음).
    //  박자는 아래 cad(빠르기 ÷ 보폭)가 따라 올린다. 칸 없으면 셈하지 않는다(바이트 같음)
    //  'flat' 의 걸음 수 한도(P.backCap — 10/31 08:xx 사장님 '네걸음 이후에는 (다섯 걸음째부터) 70% 적용'): 이어 물러선 뒤 디딤이 backCap.steps 를 넘으면(다섯째 뒤 디딤을 뗀 때부터)
    //  없애지 않는다 — 모든 유파와 같은 뒷걸음 × GAIT.backFactor. 셈은 아래 ③ backStep · 끊기는 backTick (셈이 읽는 앞뒤 · 옆 몫은 배율 전 값 — 한도가 셈을 흔들지 않게)
    if (this.P.backMul === 'flat' && !f.feetHeld) {
      const wf = want.x * fwd.x + want.z * fwd.z;
      if (this.P.backCap) {
        this.backWf = wf;
        this.backWl = Math.abs(want.x * rgt.x + want.z * rgt.z);
      }
      const k = wf > 0 ? 1 : this.backN > (this.P.backCap?.steps ?? Infinity) ? 1 : 1 / GAIT.backFactor; // 'flat' = 뒤 느려짐(GAIT.backFactor) 없앰 — 이탈리아 10/21 · 10/31 부터 네 디딤까지
      if (k !== 1) want.addScaledVector(fwd, wf * (k - 1));
    }
    // 유파 걸음 빠르기 (10/29 21:0x 사장님 '일본 걸음 … 다른 유파보다 확연히 느려도 돼' — P.speedMul · docs/strike/jp_gait_2026-10-29.md): 가려는 빠르기 전부(앞 · 뒤 · 옆)에 곱한다.
    //  박자는 아래 cad(빠르기 ÷ 보폭)가 따라 내린다. 칸 없으면 셈하지 않는다(바이트 같음)
    if (this.P.speedMul && this.P.speedMul !== 1 && !f.feetHeld) want.multiplyScalar(this.P.speedMul);
    // 막대가 가리키는 걷기 빠르기(유파 옆 빠르기까지) — 아래 붙잡기 반사 느림(slow)·reachSlow·좌우 흔들기로 줄기 전 값. 첫 걸음 박차기 뒤 세게 멈춤의 바닥(아래 ⑥ 앞)만 읽는다
    const wsx = want.x;
    const wsz = want.z;
    // 유파 걸음 follow(앞발 먼저·뒷발 따라붙임): 상대 가슴이 P.followIn 안일 때만 (나가는 문턱은 0.3 m 더 — 들락날락 막기). 칸 없는 유파는 셈하지 않는다
    //  빨리 갈 땐(걸러진 빠르기 > P.followVmax) 지나 딛는다 — 펜싱·검도도 멀리서 빨리 좁힐 땐 아유미아시. follow 그대로 빨리 가면 뒤에 남은 발이 안 닿아 허둥지둥 옮겨 딛는다
    if (this.P.footwork === 'follow') this.follow = f.foeDistance() < this.P.followIn + (this.follow ? 0.3 : 0) && this.speedF < (this.P.followVmax ?? Infinity) * (this.follow ? 1.15 : 1);
    else this.follow = false;
    if (!this.active) this.enter();
    else this.sense();
    // 펜싱 자세 자리의 기준 점(guardSpot): 발을 떼려고 기다리는 동안 · 고쳐 딛는 발이 떠 있는 동안은 멈춰 둔다
    //  기준 점 = 두 발 사이 무게를 둘 자리(아래 ⑤ 와 같은 점 — 지금 무게중심이 아니라 무게중심이 돌아와 설 자리: 무게를 한 발로 옮겨 둔 동안에도 자세의 꼴만 잰다)
    if (!this.pend && this.legs.F.stance && this.legs.B.stance) {
      const fr = this.frontLeg(fwd);
      const a = this.legs[fr].plant;
      const b = this.legs[fr === 'F' ? 'B' : 'F'].plant;
      this.gc.set(b.x + (a.x - b.x) * this.P.weightFront, 0, b.z + (a.z - b.z) * this.P.weightFront);
    }
    if (f.terrain) {
      // 지형 무대: h·hNom 은 월드 높이 — 골반이 비탈을 오르내린 땅 높이만큼 목표를 같이 옮긴다 (몸이 아니라 목표만. 거르기·hv 는 땅 위 자세 높이)
      const pp = f.bodies.pelvis.translation();
      const gy = f.terrain.heightAt(pp.x, pp.z);
      const dy = gy - this.groundY;
      this.h += dy;
      this.hNom += dy;
      this.groundY = gy;
    }
    this.sinceEnter += dt;
    this.Mg = this.Mg || f.totalMass * 9.81;
    const dHead = wrap(f.heading - this.prevHead);
    this.prevHead = f.heading;
    this.headRate += (dHead / dt - this.headRate) * Math.min(1, dt * 10);
    // 일어선 직후엔 천천히 걷는다 (1.2 s 에 걸쳐 제 빠르기로)
    this.slow = Math.max(0, this.slow - dt / 1.2);
    if (this.slow > 0) want.multiplyScalar(1 - 0.6 * minJerk(this.slow));
    // 돌면서 걸을 땐 (속도 × 도는 빠르기 = 방향을 트는 가속)이 발로 낼 수 있는 만큼만 빨리 간다
    //  (빠르게 걸으며 휙 돌면 몸이 옆으로 흘러 뒤에 남은 발이 닿지 않고 끌린다)
    if (GAIT.turnAccel > 0) {
      const vMax = (this.fly ? Math.max(GAIT.turnAccel, RUN.curve * 1.5) : GAIT.turnAccel) / Math.max(0.1, Math.abs(this.headRate)); // 날며 뛰기 (11/20): 둥글게 꺾는 뛰기(RUN.curve)는 줄이지 않음
      const sp = Math.hypot(want.x, want.z);
      if (sp > vMax) want.multiplyScalar(vMax / sp);
    }
    // 런지 채비 (다섯째 판 E2 · docs/strike/physics2_notes/r5_e2.md): 앞으로 내딛는 런지 부탁을 받은 뒤 런지 발이 뜨기까지 몸은 앞으로는 서려 한다(가려는 속도의 앞뒤 몫 0 · 옆 몫은 그대로 — 옆으로 걷던 몸을 한 번에 세우면 옆으로 넘어간다: 비스듬히 걷는 런지 넘어진 판 2 · 2 · 4 → 0 · 4 · 6 과 앞발 104 → 116/144 를 맞바꿈).
    //  앞으로 가고 있는 몸만(뒤로 물러나던 몸은 런지 쪽 조종을 그대로 따라 멈춘다 — 물러나다 큰 런지 biglunge 레이피어 24 판: 채비를 걸면 15 · 안 걸면 22 · b4 21) — 걷던 몸이면 떠 있던 발이 캡처 점 쪽으로 짧게 딛어 몸을 세우고(멈춰 딛기),
    //  그래도 못 받으면 뒷발을 모아 딛는다(update ③ gather). 선 몸은 곧장 런지 발이 뜨므로 바뀌는 것이 없다. 런지 몸의 앞 몫은 런지 걸음 동안 아래 기술 걸음 몫이 낸다
    if (this.req?.kind === 'lunge' && this.req.fwd > 0 && this.vf.x * fwd.x + this.vf.z * fwd.z > 0 && !((!this.legs.F.stance && this.legs.F.kind === 'req') || (!this.legs.B.stance && this.legs.B.kind === 'req'))) want.addScaledVector(fwd, -(want.x * fwd.x + want.z * fwd.z));
    const speed = Math.hypot(want.x, want.z);
    // 가려는 쪽의 앞뒤 몫 (+1 = 앞으로, −1 = 뒤로): 조종 입력으로 (want에는 균형 잡는 발걸음 등이 섞여 들쭉날쭉하다)
    const mv = f.feetHeld ? null : f.move; // 판 시작 정지 동안엔 조종 입력이 없는 것으로
    const foreFrac = mv && mv.lengthSq() > 1e-6 ? mv.y / mv.length() : 0;
    const backness = clamp((-foreFrac - GAIT.backFrom) / GAIT.backFull, 0, 1); // 뒤로 가는 정도 (0 ~ 1, 비스듬히 물러나는 것도)
    // 걷기 시작·멈추기 판단은 걸러진 속도로, 조금 여유를 두고 (균형 잡는 발걸음(stumble)이 매 스텝 들쭉날쭉해서
    //  걷기 ↔ 서기가 번갈아 바뀌면 발이 헛디딘다)
    this.speedF += (speed - this.speedF) * Math.min(1, dt * GAIT.walkFilter);
    // 부탁 걸음을 디딘 뒤 조종을 놓고 있으면 곧 '서 있음'으로 본다 — 걸러진 속도(speedF)의 여운으로 걷는 걸음을 하나 더 떼면 그 발은 걷는 박자(0.38 s)로 가서 런지로 실린 몸을 못 받는다
    //  (잰 값 · 선 채 탭 찌르기: 앞발을 디딘 0.08 s 뒤 뒷발이 걷는 걸음으로 떠 0.6 m 뒤에 닿고 몸은 1.2 m/s 로 넘어감 — 선 몸이면 받아 딛기(0.26 s · 캡처 점)가 그 발을 앞발 곁에 딛는다)
    const reqHalt = this.lastTDKind === 'req' && !(mv && mv.lengthSq() > 1e-6);
    const walkNow = !reqHalt && (this.walking ? this.speedF > GAIT.walkMin * 0.6 : this.speedF > GAIT.walkMin || speed > GAIT.walkMin * 2);
    // 첫 걸음 박차기 (10/15 — docs/strike/step_burst_2026-10-15.md): 서 있던 몸(걷지 않았고 골반이 burstStandV 보다 느림)이 지금 걷기 시작하고
    //  스틱을 burstStick 넘게 뒤·옆(앞 몫 < burstFwdMax)으로 밀었으면 건다 → 첫 걸음을 뗄 때 fastBegin 이 쓴다. 지금은 플레이어만(AI 가 몰면 aiControlled) ·
    //  유파 걸음 칸 burst: false(이탈리아 — 박자 걸음 첫 디딤과 겹침)는 받지 않음 · 박찬 몸이 아직 박찬 빠르기를 다 줄이기 전(burstBrake)엔 다시 걸지 않음 ·
    //  판 시작 정지·마무리 중엔 걸지 않는다. 시간 값 없음 — 걷기 시작마다 한 번. 끄면(0) 셈하지 않는다
    //  뒤(비스듬히 뒤 포함 — side 0) 박차기는 두 발이 다 땅에 있을 때만 건다(10/15 뒤 2 s 고침 — docs/strike/step_burst_2026-10-15.md §7): 자세 고치던 발이 아직 떠 있으면 첫 걸음이
    //   그 발이 디딜 때까지 늦고 그동안 보통 걸음으로 움직인 몸에서 박차게 되어, 박찬 발(앞발이 몸 뒤로 크게 건너감)이 닿지 않는 데(엉덩이 뒤 0.5 m · 발바닥 0.1 m 위)에
    //   떨어져 붙잡기 반사로 몸이 거의 선다(그 걸음은 그 유파 보통 첫 걸음). 옆 박차기는 그대로(가는 쪽 발을 짧게 옮겨 늦게 차도 발이 땅에 닿음)
    if (walkNow && !this.walking && pl && this.P.burst !== false && mv && !this.burstBrake && !(f.finish?.amt > 0.5)) {
      const m = mv.length();
      const side = Math.abs(mv.x) > Math.abs(mv.y) ? Math.sign(mv.x) : 0;
      if (m >= GAIT.burstStick && mv.y / m < GAIT.burstFwdMax && Math.hypot(this.vf.x, this.vf.z) < GAIT.burstStandV && (side || (this.legs.F.stance && this.legs.B.stance))) {
        // 옆 박차기(옆·비스듬히 옆 — 옆 몫이 뒤 몫보다 큼)는 유파 걸음 칸 burstSide(이베리아)만(10/15 15:1x 사장님 '옆으로 박차기는 이베리아 유파만 사용하게 바꿔' — §8).
        //  다른 유파는 뒤 몫이 옆 몫 이상일 때만 건다 — 비스듬히 뒤면 몸 빠르기의 앞뒤 몫만 빠르게(foreOnly — 옆 몫은 보통 빠르기: fastBegin · update ③ 뒤 · burstAhead · 세게 멈춤 쪽).
        //  스틱이 곧장 뒤(옆 몫 0)면 전과 같은 길
        //  박차기는 독일 보법(10/15 20:4x 사장님 '박차기는 독일 보법으로 넣어' — docs/strike/step_burst_2026-10-15.md §10): 뒤(비스듬히 뒤 — 뒤 몫 ≥ 옆 몫) 박차기는
        //   내 무기 유파가 독일(swordArt.tradition — 독일은 유파 걸음 칸이 없어 무기 유파를 바로 읽음)일 때만 · 옆(비스듬히 옆) 박차기는 burstSide(이베리아)만 그대로 →
        //   이베리아는 옆만(뒤 박차기 없음) · 일본·동방·이탈리아·무유파는 박차기 없음
        if (side) {
          if (this.P.burstSide) this.burst = { fore: Math.sign(mv.y), side, lat: (mv.x * mv.x) / (m * m) };
        } else if (mv.y < 0 && footworkTradition(f) === 'german') this.burst = { fore: -1, side: 0, lat: 0, foreOnly: mv.x !== 0, bw: bwAim(f) }; // bw = 뒤 박차기 헛침 경직 (11/19): 걸 때 나를 겨눠 나가는 칼
      }
    }
    // 파고들기 (11/14 사장님 결정 "간격 잡기를 파고들기로 바꿔. '앞 박차기'인데 한 걸음이 아니라 두 걸음 빠르게 들어가는 기술이야. 거리 제한은 없음" — GAIT.deDig):
    //  사람(사람 입력이 모는 몸 humanInput — main.js 플레이어 · 시뮬 대본 몸 · AI 는 아님) · 무기 유파 독일(보법 I 을 익힌 몸 — footworkTradition) · 스킬트리 G2(열쇠 'chase' — 옛 이름 그대로)가 뒤 박차기와 같은 '서 있음'(걷지 않았고 골반 burstStandV 아래 ·
    //  두 발 땅)에서 스틱을 burstStick 넘게 앞으로(앞 몫 > 0 · 앞 몫 ≥ 옆 몫) 밀며 걷기 시작하면 → 앞 digSteps 걸음을 박찬 걸음으로(fastBegin). 헛침 조건 · 거리 제한(칼 거리 잡기) 없음 ·
    //  비스듬히 앞이면 앞 몫만 빠르게(foreOnly — 뒤 박차기와 같은 꼴). 박찬 몸이 아직 박찬 빠르기를 다 줄이기 전(burstBrake) · 판 시작 정지 · 마무리 중엔 걸지 않음. 끄면(0) 셈하지 않는다
    if (walkNow && !this.walking && f.humanInput && mv && !this.burst && !this.burstBrake && !f.feetHeld && !(f.finish?.amt > 0.5) && footworkTradition(f) === 'german' && !kitOff(f, 'chase')) {
      const m = mv.length();
      if (m >= GAIT.burstStick && mv.y > 0 && mv.y >= Math.abs(mv.x) && Math.hypot(this.vf.x, this.vf.z) < GAIT.burstStandV && this.legs.F.stance && this.legs.B.stance) this.burst = { fore: 1, side: 0, lat: 0, foreOnly: mv.x !== 0, dig: GAIT.digSteps };
    }
    // 옆 누르면 첫 걸음에 늘 옆 박차기 (10/21 사장님 '그냥 옆 누르면 첫 걸음에 무조건 나가야지'): 스틱이 옆으로 바뀌는 순간(옆 몫 > 앞뒤 몫 ·
    //  burstStick 넘게 · 앞 몫 < burstFwdMax — 서 있든 걷든 · 거꾸로 옆으로 틀어도) 다음에 떼는 걸음을 옆 박찬 걸음으로(sideDash — 이베리아만). 아직 걷기 문턱 전이면
    //  걷기 시작할 때까지(0.3 s 안) 미뤄 둔다(걷지 않는 몸에 건 박차기는 아래에서 버려지므로). 플레이어만
    if (pl && mv && !f.run?.fast) { // (뛰는 동안은 옆 박차기 없음 — 11/20)
      this.dashClock = (this.dashClock ?? 0) + dt;
      const m = mv.length();
      const s = m >= GAIT.burstStick && Math.abs(mv.x) > Math.abs(mv.y) && mv.y / m < GAIT.burstFwdMax ? Math.sign(mv.x) : 0;
      if (s && s !== this.dashSide) this.dashPend = { s, t: this.dashClock };
      this.dashSide = s;
      const pend = this.dashPend;
      if (pend && (!s || s !== pend.s || this.dashClock - pend.t > 0.3)) this.dashPend = null;
      else if (pend && walkNow) { if (!this.burst && !(this.fastK > 1)) this.sideDash(pend.s); this.dashPend = null; }
    }
    if (walkNow !== this.walking) {
      this.walking = walkNow;
      this.walkT = 0;
    }
    this.walkT += dt;
    this.idleT = walkNow ? 0 : this.idleT + dt;
    if (walkNow) this.settles = 0;
    // 걸음 박자: 느리면 한 걸음 약 0.55초, 빠를수록 잦아지고 보폭이 길어진다
    const vLat = Math.abs(want.x * rgt.x + want.z * rgt.z);
    //  (비스듬히 물러날 땐 옆으로 옮기는 보폭을 줄인다: 뒤에 남는 발이 옆으로 멀어져 다리가 벌어진 채 골반이 주저앉는다)
    const sideStride = this.P.sideStride * (1 - GAIT.backSideCut * backness);
    //  (뛰는 걸음의 박자는 다리 빠르기 한도로 자른 빠르기로 센다 — 가려는 속도는 몸보다 RUN.lead 앞서 있어, 그대로 세면 1.6 m/s 로 가는 몸이 2.1 m/s 의 박자(초당 3 걸음 · 걸음 0.53 m)로 발을 놀린다:
    //   내딛는 발의 가속은 빠르기 × 박자에 비례하고 그 반작용을 디딘 엉덩이(한도 200 N·m)가 받는다. 걷는 걸음(rk 0)은 그대로)
    const speedC = rk > 0 ? Math.min(speed, this.legVRun()) : speed;
    let cad = Math.max(this.P.cadence0 + this.P.cadenceK * Math.max(0, speedC - 1), speedC / runMix(this.P.maxStride, RUN.stride, rk), (2 * vLat) / sideStride, this.P.cadence0 * 0.9); // 뛰는 걸음: 보폭 상한 RUN.stride (11/18)
    // 짝걸음(P.pair — 10/10 레이피어 리듬): 한 짝(두 발 한 번씩) 동안 한 발이 옮기는 거리(빠르기 × 두 걸음 시간)가 pair.stride 를 넘지 않게 박자를 올린다. 칸 없으면 셈하지 않는다
    //  (앞뒤로 갈 때만 — 옆 몫이 앞뒤 몫보다 크면 전 follow 그대로. 걷기 시작 발 고르기(아래 ③)와 같은 가름)
    const PR = this.follow && this.P.pair && Math.abs(want.x * fwd.x + want.z * fwd.z) > vLat ? this.P.pair : null;
    this.pairOn = !!PR;
    if (PR?.stride) cad = Math.max(cad, (2 * speed) / PR.stride);
    // 뛰는 걸음 (11/18 — 사람 몸만): 박자는 몸이 실제로 가는 빠르기로도 잰다(가려는 속도보다 빠르면 그만큼 잦게) — 빨라지는 동안 걸음이 늦어 뒷발이 뒤에 남지 않게
    if (rk > 0 && walkNow) {
      const vNow = Math.hypot(this.vf.x, this.vf.z);
      if (vNow > speed) cad = Math.max(cad, vNow / runMix(this.P.maxStride, RUN.stride, rk));
    }
    // 날며 뛰기 (11/20 사장님 '뛰는 속도가 느리더라. 지금 4지? 최소 5에서 6은 돼야겠던데?' — 기록 docs/strike/run_2026-11-20.md): 뛰는 몸(f.run.on · 섞임 RUN.flyK 넘음 —
    //  날기 시작한 뒤엔 뛰기가 끝나 줄어드는 동안도 RUN.flyFrom × flyOut 밑으로 줄 때까지)이
    //  몸 앞으로 RUN.flyFrom 넘게 빨리 가면 한 발이 땅을 딛는 시간을 Tc(= RUN.flyContact ÷ 빠르기)로 줄이고 그 뒤 두 발이 모두 뜬 채 나간다 — 걸음이 길어지고 박자가 느려짐
    //  (박자 = RUN.flyCad[0] + flyCad[1] × 빠르기). 몸이 몸 앞쪽으로 가는 동안만(비스듬히 · 돌아서는 동안은 아래 걷는 박자) · 섞임 rk 0 이면 셈하지 않음(f.run 없는 몸 · 1:1 AI · 시뮬 몸은 늘 끔)
    if (rk > 0) {
      const vfw = this.vf.x * fwd.x + this.vf.z * fwd.z;
      const vh = Math.hypot(this.vf.x, this.vf.z);
      // (날기 문턱은 무게중심 앞 빠르기로 잰다 — 밖에서 밀지 않는 몸의 골반은 걸음마다 무게중심보다 ± 0.5 m/s 출렁여, 골반으로 재면 2.0 m/s 로 가는 몸이 걸음 안의 꼭대기(2.4 ~ 2.8)에서 날기로 넘어간다:
      //   새 다리는 아직 날며 뛰지 못한다(두 발이 뜬 동안 골반이 0.13 ~ 0.2 m 내려앉고 디딜 때 무릎 한도 250 N·m 를 넘음 — docs/strike/physics2_notes/r4_run.md). 그 밖의 셈(flyV · flyFore)은 그대로 골반 빠르기)
      const vcw = f.comVel ? f.comVel.x * fwd.x + f.comVel.z * fwd.z : vfw;
      this.fly = (this.fly || (!!f.run?.on && rk >= RUN.flyK)) && walkNow && !f.feetHeld && f.state === 'stand' && vcw > RUN.flyFrom * (this.fly ? RUN.flyOut : 1) && vfw > RUN.flyFore * vh; // (뛰기가 끝나도 몸이 RUN.flyFrom × flyOut 밑으로 줄 때까지 — 줄어드는 동안도 이 걸음)
      if (this.fly) cad = RUN.flyCad[0] + RUN.flyCad[1] * vfw;
      this.flyV = vfw;
    } else this.fly = false;
    const T = walkNow ? 1 / cad : GAIT.settleT / (1 - this.P.dsFrac);
    this.stepT += (T - this.stepT) * Math.min(1, dt * 6);
    // 빠른 걸음 (10/15): 박자 걸음(P.rhythm — 이탈리아, docs/strike/italian_rhythm_2026-10-15.md)은 켜졌을 때만 센다(rhythmOn — 디딤 셈 N + M 또는 옛 짝 셈 ·
    //  간격 잡기 빠른 디딤(this.chase — 독일, 상대 헛침 뒤 받을 창 · docs/strike/german_chase_2026-10-15.md)(잡기는 holdTick — driveBalance 가 먼저 부름).
    //  판 시작 정지·마무리 중엔 세지 않고 처음부터(받을 창도 버림) · 걷지 않으면 빠른 걸음 끝. 둘 다 없고 빠른 걸음도 아니면 셈하지 않는다
    //  빠른 걸음 중 스틱 앞뒤가 뒤집히면(가려는 속도 앞 몫의 부호가 그 걸음과 반대) 거기서 끝 — 멈춰 서는 동안 서두르지 않게
    let RH = rhythmOn(this.P.rhythm) && !f.run?.fast ? this.P.rhythm : null; // (뛰는 동안 · 뛰다 줄어드는 동안은 박자 걸음 없음 — 11/20 · 빠른 디딤이 뛰는 빠르기에 또 곱해짐)
    let CH = this.chase;
    //  첫 걸음 박차기(this.burst — 위 걷기 시작에서 건 것)도 같은 자리: 첫 걸음을 떼기 전에 멈추면 버린다 · 박찬 걸음 중 스틱이 거꾸로(옆 박차기는 옆으로 거꾸로) 가면 거기서 끝 ·
    //  박찬 발이 떠 있고 스틱을 밀고 있는 동안은 '걷지 않음'으로 끝내지 않는다(느린 옆·뒤 출발은 걸러진 빠르기가 둘째 스텝에 걷기 문턱 아래로 한 번 깜빡인다 — 그 깜빡임에 박차기가 끊기지 않게)
    if (RH || CH || this.burst || this.fastK > 1) {
      if (f.feetHeld || f.finish?.amt > 0.5) {
        this.rhyN = 0;
        this.rhyGo = false; // 보폭 박자 — 처음부터 다시 세면 짧은 디딤부터
        this.rhyF = 0;
        this.rhyIdle = 0;
        this.fastK = 1;
        this.chase = null;
        this.burst = this.burstLeg = this.burstBrake = null;
        RH = CH = null;
      } else if ((!walkNow && !(this.burstLeg && mv?.lengthSq() > 0)) || (this.fastK > 1 && ((want.x * fwd.x + want.z * fwd.z) * this.fastDir < 0 || (this.fastSide && (want.x * rgt.x + want.z * rgt.z) * this.fastSide < 0)))) {
        this.fastK = 1;
        this.rhyF = 0; // 디딤 셈 빠른 몫도 거기서 끝 (남은 빠른 디딤 버림)
        if (!walkNow) this.burst = null;
      }
    }
    // 빠른 걸음 동안(fastK > 1) 발 박자를 fastK 배로: 한 걸음 시간 sT = stepT ÷ fastK (걸러진 박자 stepT 는 그대로 — 빠른 걸음이 끝나면 곧 제 박자).
    //  지나 딛기는 발 뜬 시간·두 발 디딤이 sT 로 줄고, 짝걸음(PR)은 한 짝 박자(2 × sT)를 짝 사이 쉼에서 줄인다 — 이끄는·따라붙는 발 뜬 시간은 그대로
    //  (짝걸음 발 뜬 시간은 이미 0.1 s 안팎이라 더 줄이면 일찍 디딤·따라붙는 발 끌림이 는다 — rhythm_step_feel). 디딜 자리·몸 박자 셈도 sT. 보통 걸음은 sT = stepT (같은 수)
    const sT = this.fastK > 1 ? this.stepT / this.fastK : this.stepT;
    this.sT = sT;
    const swT = PR ? this.stepT : sT;
    this.dsF = runMix(this.P.dsFrac, RUN.dsFrac, rk); // 두 발 디딤 몫 — 뛰는 걸음은 RUN.dsFrac (11/18 · 디딜 자리 target 도 이 값)
    // 날며 뛰기 (11/20): 한 발 디딤 Tc · 두 발 디딤 없음 · 발 뜬 시간 = 두 걸음 − Tc (한 발이 Tc 딛고 뗀 뒤 다른 발이 (한 걸음 − Tc) 뒤에 딛는다 — 그 사이 두 발 모두 뜸)
    const Tc = this.fly ? Math.min(RUN.flyContact / Math.max(this.flyV, RUN.flyFrom), sT * RUN.flyDuty) : 0;
    this.flyTc = Tc;
    const Tds = (this.tds = this.fly ? 0 : swT * this.dsF); // (this.tds: 모아 딛는 발의 디딜 자리가 읽는다 — target gather)
    const Tsw = this.fly ? 2 * sT - Tc : swT - Tds;

    const L = this.legs;
    let swing = L.F.stance ? (L.B.stance ? null : L.B) : L.F;
    let swing2 = rk > 0 && swing === L.F && !L.B.stance ? L.B : null; // 날며 뛰기 (11/20): 두 발 모두 떠 있으면 둘째 발 (뛰는 섞임이 없는 몸은 늘 한 발만 뜸 — 셈하지 않음)
    this.sinceTD += dt;
    for (const k of ['F', 'B']) L[k].tLand += dt;
    this.calmT = L.F.stance && L.B.stance && !(f.legDrive.capDist > 0) ? this.calmT + dt : 0; // 두 발을 딛은 채 캡처 점이 받침 안에 머문 시간 (자세 고쳐 딛기는 이 시간이 GAIT.restTime 을 넘은 뒤에만)

    // ① 딛은 발이 크게 끌려갔으면(세게 맞음) 그 자리에서 다시 딛는다 (정지 마찰을 넘어 미끄러진 것)
    for (const k of ['F', 'B']) {
      const l = L[k];
      if (!l.stance) continue;
      const dx = l.ankle.x - l.plant.x;
      const dz = l.ankle.z - l.plant.z;
      if (dx * dx + dz * dz > GAIT.slipReset * GAIT.slipReset || l.soleY > 0.12) {
        this.plantAt(l);
      }
    }

    // ② 내딛는 발
    // 자세를 고쳐 딛던 중에 다시 걷기 시작하면: 지금 발 위치에서 걷는 걸음으로 바꾼다
    //  (이미 거의 딛었으면 그대로 딛는다: 무게가 실린 발을 다시 들어 옮기면 땅을 긁는다)
    //  (반 넘게 옮긴 발은 마저 딛는다: 땅 가까이 내려오는 발을 새 자리로 휙 옮기면 땅을 긁는다)
    if (swing && walkNow && swing.kind === 'settle' && swing.t > swing.T * 0.6 && swing.soleY < GAIT.convertLand) {
      this.touchdown(swing, 0);
      swing = null;
    }
    if (swing && walkNow && swing.kind === 'settle' && swing.t < swing.T * GAIT.convertMax) {
      swing.p0.copy(swing.des);
      const floorY = f.terrain ? this.ankleHeight(swing.des.x, swing.des.z) : ANKLE_H; // 지형 무대: 그 자리 땅 위 발목 높이
      swing.y0 = Math.max(0, swing.des.y - floorY);
      swing.p0.y = floorY;
      swing.v0.set(0, 0, 0);
      swing.vy0 = 0;
      swing.T = clamp(swing.T - swing.t, GAIT.convertMinT, Math.max(GAIT.convertMinT, Tsw * 0.8)); // 이미 오래 들고 있었으면 조금 빨리 딛는다 (너무 서두르면 발이 땅을 긁는다)
      swing.t = 0;
      swing.kind = 'walk';
      swing.hFrac = 1;
    }
    // 세게 밀려 균형을 잃으면 내딛는 발을 서둘러 딛는다 (한 발로 오래 버티면 딛은 발이 들려 몸이 넘어간다)
    //  (걷기 시작·멈출 때 조금 기우는 정도(offBalance ≈ 0.3)에선 서두르지 않는다: 발이 움직이는 채로 닿아 미끄러진다)
    let hurry = GAIT.catchHurry * clamp((f.offBalance - GAIT.hurryFrom) / 0.2, 0, 1);
    // 딛은 발이 뒤로 빠져 뒤꿈치를 거의 끝까지 들었으면(다리가 곧 닿지 않는다) 내딛는 발을 서둘러 딛는다
    //  (빨리 나가기 시작할 때·뛸 때: 몸이 먼저 나가 뒤에 남은 발이 발끝으로 끌린다. 제자리에서 돌 땐 서두르지 않는다: 돌려 딛는 발이 돌아가는 채로 닿는다)
    if (swing && swing.kind === 'walk' && speed > GAIT.hurrySpeed && Math.abs(this.headRate) < 1) {
      const st = swing === L.F ? L.B : L.F;
      if (st.stance) hurry = Math.max(hurry, GAIT.reachHurry * clamp((st.heel - GAIT.heelHurry) / 0.12, 0, 1));
    }
    if (swing) {
      swing.t += dt * (swing.kind === 'req' || swing.kind === 'gather' ? 1 : 1 + hurry);
      const u = swing.t / swing.T;
      // (캡처 점으로 정하는 걸음 — 걷는 걸음 · 옮겨 딛기 — 은 닿을 때까지 디딜 자리를 고친다: 캡처 점은 e^(ω·t) 로 달아나므로 일찍 못박은 자리는 닿을 때 이미 틀린다)
      if (u < GAIT.retarget || swing.kind === 'walk' || swing.kind === 'catch') this.target(swing, want, fwd, rgt, Math.max(0, swing.T - swing.t));
      if ((u >= 1 && swing.soleY < 0.02) || u >= 1 + GAIT.lateMax / swing.T || (u > 0.8 && swing.soleY < 0.004) || (u > GAIT.earlyTD && this.groundForce(swing) > GAIT.earlyLoad * this.Mg)) {
        // (발을 든 동안 발이 땅에 닿아 무게가 실리면(몸이 내려앉음) 그 자리에서 딛는다: 무게 실린 발을 끌고 가면 미끄러진다)
        this.touchdown(swing, speed);
        swing = null;
      }
    }
    // 날며 뛰기 (11/20): 둘째로 뜬 발도 같은 셈 — 첫 발이 딛었으면 그 발이 '떠 있는 발'
    if (swing2) {
      swing2.t += dt * (1 + hurry);
      const u = swing2.t / swing2.T;
      if (u < GAIT.retarget) this.target(swing2, want, fwd, rgt, Math.max(0, swing2.T - swing2.t));
      if ((u >= 1 && swing2.soleY < 0.02) || u >= 1 + GAIT.lateMax / swing2.T || (u > 0.8 && swing2.soleY < 0.004) || (u > GAIT.earlyTD && this.groundForce(swing2) > GAIT.earlyLoad * this.Mg)) {
        this.touchdown(swing2, speed);
        swing2 = null;
      }
      if (!swing) (swing = swing2), (swing2 = null);
    }
    // 날며 뛰기 (11/20): 딛은 발이 Tc 만큼 딛었으면 뗀다 → 떠 있는 발이 딛을 때까지 두 발 모두 뜸. 뗀 발은 떠 있는 발이 딛은 뒤 한 걸음(sT) 뒤에 딛게
    //  (발 뜬 시간 = 떠 있는 발이 남은 시간 + sT — 고른 박자면 두 걸음 − Tc · 박자가 바뀌는 동안에도 두 발이 번갈아 딛음).
    //  딛은 발을 더 오래 두면 몸이 그 발을 지나 다리가 닿지 않는 데까지 가서 끌린다. 발 들기 높이 RUN.flyLift · 뗄 때 발이 몸 빠르기의 RUN.flyCarry 몫으로 출발(땅을 긁지 않게)
    if (this.fly && swing && !swing2 && swing.kind === 'walk' && f.muscle > 0.15 && !this.req) {
      const st = swing === L.F ? L.B : L.F;
      if (st.stance && st.tLand >= Math.min(st.flyTc || Tc, Tc)) {
        this.begin(st, 'walk', clamp(Math.max(0, swing.T - swing.t) + sT, sT, 2 * sT));
        this.flyStep(st);
        this.target(st, want, fwd, rgt, Tsw);
        swing2 = st;
      }
    }

    // ③ 새 걸음 시작
    //  짝걸음(P.pair): 이끄는 발(가는 쪽 발)을 디딘 뒤엔 따라붙는 발을 곧 떼고(두 발 디딤 Tds × pair.inner — '따·닥' 의 닥), 따라붙는 발을 디딘 뒤엔
    //  한 짝 시간이 걸음 두 개(2 × stepT)가 되도록 쉰다(짝과 짝 사이 쉼). 여는 때 = 걷는 중 follow 이고 기술 걸음·끌어붙임이 없을 때. 칸 없으면 Tds 그대로
    //  고른 짝걸음(pair.even — 10/15 이탈리아 '고른 바탕 걸음', docs/strike/italian_rhythm_2026-10-15.md §10): '따·닥 + 쉼' 대신 디딤 간격이 늘 한 걸음 시간 —
    //   이끄는 발이든 따라붙는 발이든 앞 디딤 뒤 (stepT ÷ 그 디딤 배율 − 그 발 뜬 시간)만큼 두 발로 섰다가 뗀다. 박자 걸음 빠른 디딤이면 그 간격이 ÷ mul
    //   (배율은 fastPeek 가 미리 봄 — 빠른 디딤으로 끝나는 간격이 짧아지게). 몸 박자는 없다(몸 빠르기 고르게)
    let gate = Tds;
    let pairTrail = false;
    if (PR && walkNow && !this.req && !this.drawPending && !swing) {
      const dfp = (L.F.plant.x - L.B.plant.x) * want.x + (L.F.plant.z - L.B.plant.z) * want.z;
      pairTrail = this.lastTD === (dfp > 0 ? 'F' : 'B') && this.sinceTD < sT * 1.5;
      if (PR.even) {
        const kN = RH ? this.fastPeek(RH, pairTrail, want.x * fwd.x + want.z * fwd.z, vLat, this.vf.x * fwd.x + this.vf.z * fwd.z) : 1;
        gate = Math.max(0, this.stepT / kN - Tsw * (pairTrail ? PR.trail : PR.lead ?? 1));
      } else gate = pairTrail ? Tds * PR.inner : Math.max(Tds, 2 * sT - Tsw * ((PR.lead ?? 1) + PR.trail) - Tds * PR.inner);
    }
    if (!swing && this.sinceTD >= Math.min(Tds, gate) && f.muscle > 0.15) {
      let next = null;
      let kind = 'walk';
      let Tstep = Tsw;
      const keep0 = this.settles; // (발을 떼지 않고 기다리게 되면 아래 고르기가 바꾼 셈을 되돌린다 — liftOk)
      const keep1 = this.pairOpen;
      const keep2 = this.drawPending;
      // 다리가 닿지 않을 만큼 벌어진 발은 먼저 옮긴다
      for (const k of ['F', 'B']) {
        const l = L[k];
        const hx = l.hip.x - l.plant.x;
        const hz = l.hip.z - l.plant.z;
        //  (일어선 직후처럼 "딛은" 발이 실제로는 떠 있으면 그 발부터 딛는다: 다른 발을 들면 두 발 다 떠 버린다)
        //  (서 있는 중에도 딛은 발이 발끝까지 땅에서 떠 무게가 없으면 (골반이 들려 다리가 닿지 않음) 그 발을 다시 딛는다: 공중에 뜬 채 끌려가지 않게)
        const air = l.soleY > GAIT.airFoot && (this.slow > 0.5 || (l.toeY > GAIT.airFoot * 0.75 && (l.N || 0) < 0.05 * this.Mg));
        const rm = f.secretStance?.reach ?? this.P.reachMax; // 비기 자세(런지·발도)는 넓게 벌린 발을 그대로 둔다 (secretStance.reach). 유파 칸 reachMax(10/10 일본 낮은 자세 — 골반이 낮으면 다리가 옆으로 더 닿는다), 없으면 GAIT 그대로
        if (hx * hx + hz * hz > rm * rm || air) next = next || k;
      }
      // 받아 딛기: 캡처 점이 받침 다각형 밖(다리 구동이 지난 스텝에 잰 거리 capDist)이면 기다리지 않고 바로 한 발을 그 자리로 옮긴다 — 몸을 붙드는 밖 힘이 없으니 발이 받아야 한다
      //  걷는 중에는 캡처 점이 늘 딛은 발 앞에 있다(그래서 걷는다) — 걷는 걸음 고르기를 그대로 쓰고, 발을 떼기 앞서 기다리는 것(liftOk)만 건너뛴다
      const out = L.F.stance && L.B.stance && f.legDrive.capDist > GAIT.catchOut && this.sinceTD > GAIT.catchRest;
      let urgent = false;
      let first = false; // 서 있다가 떼는 첫 걷는 걸음 (떼기 앞서 무게를 남을 발 쪽으로 옮긴다 — 아래)
      const stepping = (this.lastTDKind === 'walk' || this.lastTDKind === 'catch') && this.sinceTD < sT * 1.5;
      //  (조종이 걸으라고 하지 않는데 균형 걸음 몫(stumble)만으로 '걷는 중'이 된 때도 받아 딛기로 — 걷는 걸음 박자 · 번갈아 딛기로는 늦다)
      if (!next && out && !walkNow) {
        next = this.catchLeg(GAIT.catchT, want, fwd, rgt);
        if (next) {
          kind = 'catch';
          Tstep = GAIT.catchT;
          urgent = true;
          this.catches = (this.catches || 0) + 1;
        }
      } else if (next) Tstep = Math.min(Tstep, GAIT.catchT * 1.3);
      if (this.req && !next) {
        const front = this.frontLeg(fwd);
        const pick = this.req.leg === 'right' ? (this.legs.F.side > 0 ? 'F' : 'B') : this.req.leg === 'left' ? (this.legs.F.side < 0 ? 'F' : 'B') : null; // 채널 B: 획 방향의 반대 발
        next = pick ?? (this.req.kind === 'lunge' ? front : front === 'F' ? 'B' : 'F');
        // 발 고르기는 몸이 받을 수 있는 쪽으로: 고른 발을 뗀 채 남은 발 위에서 걸음 시간(req.duration)을 버틴 뒤의 캡처 점이 남은 발에서 GAIT.reqSpan 넘게 달아나 있으면(새 발이 닿지 못한다)
        //  다른 발로 바꾼다 — 앞발을 내딛는 걸음(lunge)은 뒷발이 지나 딛는 걸음(pass)으로, 거꾸로도 같다(디딜 자리는 target 의 req 가지가 바꾼 꼴로 정한다).
        //  잰 값(1 m/s 로 걷다 앞발을 막 디딘 때 온 lunge 0.6 m · 0.4 s): 무게중심은 이미 뒷발 앞 0.38 m — 앞발을 떼면 거꾸로 선 진자가 0.4 s 에 2 m/s 까지 넘어가고 골반이 0.92 → 0.72 m 로 떨어진다(세 무기 0/8).
        this.req.swap = false;
        if (!pick && L.F.stance && L.B.stance && (this.req.kind === 'lunge' || this.req.kind === 'pass')) {
          const o1 = L[next === 'F' ? 'B' : 'F'];
          if (this.capAt(o1, this.req.duration, want)) {
            const s1 = Math.hypot(_cap.x - o1.pinC.x, _cap.z - o1.pinC.z);
            if (s1 > GAIT.reqSpan && this.capAt(L[next], this.req.duration, want) && Math.hypot(_cap.x - L[next].pinC.x, _cap.z - L[next].pinC.z) < s1 - 0.1) {
              // 앞발 런지는 제 디딜 자리가 캡처 점을 받으면 앞발 그대로 (lungeFit) — 못 받을 때만 발을 바꾼다
              if (!(this.req.kind === 'lunge' && this.req.fwd > 0 && this.lungeFit(L[next], o1, want, fwd, rgt))) {
                next = next === 'F' ? 'B' : 'F';
                // 모아 딛기 (다섯째 판 E2 · docs/strike/physics2_notes/r5_e2.md): 앞으로 내딛는 런지를 지금 자세로 못 받으면(걷던 몸 — 캡처 점이 디딜 자리를 지나침) 뒷발을 지나 딛게 바꾸지 않고
                //  먼저 뒷발을 무게중심 바로 뒤 · 가는 줄 위로 모아 딛는다(gather — 펜싱 전진 런지의 차례). 디딘 뒤 다음 걸음에서 같은 물음을 다시 한다 — 그때도 못 받으면 예전처럼 발을 바꾼다(한 번만 모음)
                if (this.req.kind === 'lunge' && this.req.fwd > 0 && !this.req.gathered) this.req.gather = true;
                else this.req.swap = true;
              }
            }
          }
        }
        kind = 'req';
        Tstep = this.req.duration;
        if (this.req.gather) {
          this.req.gather = false;
          this.req.gathered = true;
          kind = 'gather';
          Tstep = GATHER_T;
        }
        // 활 자세(P.bow — 10/10 중국): 앞으로 내딛는 기술 걸음(進步 — AI 베기 걸음·플레이어 베기 걸음·連環三擊 반걸음)이면 디딜 때 골반을 낮춰 앞무릎을 굽힌다
        this.bowReq = !!this.P.bow && this.req.fwd > 0 && (this.req.kind === 'lunge' || this.req.kind === 'pass');
      } else if (this.drawPending && !next && this.P.bow && this.bowAfter > 0) {
        // 활 자세 버팀(P.bow.hold s): 내딛은 앞무릎을 굽힌 채 뒷다리를 뻗어 둔다 — 그 뒤에 뒷발을 끌어붙인다(체보). 그동안 다른 발은 들지 않는다
      } else if (this.drawPending && !next) {
        // 유파 걸음(10/10): 베며 내딛은(lunge) 뒤 뒷발을 앞발 뒤 자세 자리로 끌어붙인다 — 일본 히키츠케·중국 체보 (ai.js gaitStep 의 cutStep.draw)
        const front = this.frontLeg(fwd);
        next = front === 'F' ? 'B' : 'F';
        kind = 'draw';
        Tstep = this.P.drawT ?? 0.3;
        this.drawPending = null;
      } else if (walkNow && !next && this.follow) {
        // 유파 걸음 follow(10/10 — 가까이선 앞발이 늘 앞, 오쿠리아시·체보·카포 페로의 곧은 걸음): 가는 쪽에 있는 발이 먼저 나가고 다른 발이 따라붙는다.
        //  방금 가는 쪽 발을 디뎠으면 다른 발(따라붙음), 아니면 가는 쪽 발. 디딜 자리는 target() 의 follow 가지(걷는 동안에도 펜싱 자세)
        const df = (L.F.plant.x - L.B.plant.x) * want.x + (L.F.plant.z - L.B.plant.z) * want.z;
        const ahead = df > 0 ? 'F' : 'B';
        const trail = ahead === 'F' ? 'B' : 'F';
        //  (뒤에 남은 발이 엉덩이에서 P.trailReach 넘게 멀어졌으면 그 발부터 따라붙인다 — 다리가 안 닿아 허둥지둥 옮겨 딛기(catch) 전에)
        const tl = L[trail];
        const far = Math.hypot(tl.hip.x - tl.plant.x, tl.hip.z - tl.plant.z) > (this.P.trailReach ?? Infinity);
        next = far || (this.lastTD === ahead && this.sinceTD < sT * 1.5) ? trail : ahead;
        this.trailStep = next !== ahead;
        if (PR) {
          // 짝걸음: 따라붙는 발은 짧고 빠르게(Tsw × pair.trail), 이끄는 발은 짝 사이 쉼(gate)이 지난 뒤에 Tsw × pair.lead 로
          //  (고른 짝걸음 pair.even 은 따라붙는 발도 gate 까지 기다린다 — 두 디딤 간격이 같게)
          if (PR.even && this.sinceTD < gate) next = null;
          else if (this.trailStep) Tstep = Tsw * PR.trail;
          else if (this.sinceTD < gate) next = null;
          else Tstep = Tsw * (PR.lead ?? 1);
          if (next) this.pairStep = this.trailStep ? 'trail' : 'lead';
        }
      } else if (walkNow && !next && speed > 0.05 && vLat / speed > (this.P.crossFrom ?? 0.7)) {
        // 옆으로 갈 땐 가는 쪽 발이 먼저, 다른 발이 따라붙는다(P.sideLead — 10/10 이베리아: 에텐하르트 1675 둥근 걸음 '그 발이 제 쪽으로' ·
        //  피게이레두 1651 복합 규칙 XII '오른발을 오른쪽으로 … 왼발이 따라붙는다', 확인표 621). 옆 몫 문턱은 둥근 걸음 발끝 틀기와 같은 P.crossFrom.
        //  방금 가는 쪽 발을 디뎠으면 다른 발(따라붙음), 아니면 가는 쪽 발 — 걷기 시작 첫 걸음도 가는 쪽 발(뒤따르는 발부터 들면 다리 꼬임 막기에 걸려 헛걸음)
        //  물리 2.0: 모든 유파가 이 규칙 — 두 발이 서로 지나가지 못하는 옆걸음에서는 가는 쪽 발이 캡처 점을 받고(target 의 좌우 규칙) 다른 발이 좁혀 딛는 차례뿐이다
        const dir = Math.sign(want.x * rgt.x + want.z * rgt.z);
        const lead = L.F.side * dir > 0 ? 'F' : 'B';
        next = this.lastTD === lead && (this.lastTDKind === 'walk' || this.lastTDKind === 'catch') && this.sinceTD < sT * 1.5 ? (lead === 'F' ? 'B' : 'F') : lead; // (멈춘 채 자세 고쳐 딛은 발은 '방금 디딘 이끄는 발'로 치지 않는다)
      } else if (walkNow && !next) {
        // 걷는 중(방금 걷는 걸음 · 받아 딛는 걸음을 디뎠다): 번갈아. 걷기 시작: 가려는 쪽에서 뒤에 있는 발부터 (앞발부터 내딛으면 뒷발이 닿지 않을 만큼 멀어진다)
        if (stepping) next = this.lastTD === 'F' ? 'B' : 'F';
        else {
          const df = (L.F.plant.x - L.B.plant.x) * want.x + (L.F.plant.z - L.B.plant.z) * want.z;
          next = df > 0 ? 'B' : 'F';
          // 서 있다가 떼는 첫 걸음만 무게를 먼저 옮긴다 — 이미 가고 있는 몸(기술 걸음 · 끌어붙임을 디딘 바로 뒤 · 밀려 가는 몸)을 0.2 s 세워 두면 몸만 0.2 m 달아난다
          first = !f.comVel || Math.hypot(f.comVel.x, f.comVel.z) < GAIT.startV;
        }
      } else if (next) kind = 'catch';
      if (urgent) kind = 'catch';
      else if (!next && this.P.pair?.stop && this.pairOpen && !walkNow && !f.feetHeld && !f.fireHold && this.sinceTD >= Tds) {
        // 짝걸음 멈춤(pair.stop): 이끄는 발만 딛고 멈췄으면 기다리지 않고(settleDelay 없이) 따라붙는 발을 곧 펜싱 자세 자리로 짧게 딛는다 — '착' 하고 선다
        next = this.pairOpen === 'F' ? 'B' : 'F';
        kind = 'settle';
        this.settles++;
        this.pairStop = true;
        this.pairOpen = null;
      } else if (!next && this.idleT > GAIT.settleDelay && !f.feetHeld && !f.fireHold) {
        // (판 시작 정지 · AI 가 쏘는 동안(fireHold) 엔 자세 고쳐 딛기도 미룬다. 닿지 않는 발·균형 잡는 걸음은 그대로)
        // 자리 고치기는 settleMax번까지, 몸을 돌려 발이 틀어진 것은 언제든 (발을 돌려 딛는다)
        next = this.settleLeg(this.settles < GAIT.settleMax);
        if (next && this.settleTurn) {
          // 몸을 돌리느라 발을 돌려 딛는 걸음: 받아 딛기와 같은 걸음(디딜 자리 = 디딜 때의 캡처 점 · 발 방향 = 바라볼 쪽 — target 의 캡처 점 디딤)으로 바로 뗀다.
          //  자세 자리로 옮기는 걸음은 떼기 앞서 무게를 남을 발로 다 옮겨야 서는데(두 발 사이 0.25 m 를 옮기는 데 0.6 s — 거꾸로 선 진자), 90° 돌아서기는 두 발을 다 돌려 디뎌야 해서 그 기다림 둘이면 2 s 가 간다.
          //  기다리지 않고 떼면 몸은 뗀 발 쪽으로 넘어가기 시작한다 — 그 발을 캡처 점에 디디면 선다(사람이 제자리에서 도는 걸음). 벌어지거나 좁아진 자세는 다 돈 뒤 가라앉아 고쳐 딛는다(셈 settles 는 처음부터)
          kind = 'catch';
          Tstep = GAIT.turnStepT;
          this.settles = 0;
        } else if (next) {
          kind = 'settle';
          this.settles++;
          if (this.P.settleStance) this.settleRel = this.settleByStance; // 자세 길이 고치기 걸음 (P.settleStance — 10/29 일본 걸음): 디딜 자리 = 다른 발에서 자세 길이 (target) · 걸음 동안 그대로
        }
      }
      // 짝걸음으로 일찍 들어왔는데(gate < Tds) 따라붙는 걸음이 아니면 전처럼 Tds 까지 기다린다 (고른 짝걸음은 걷는 걸음 모두 gate 가 제 간격 — 빠른 디딤이면 Tds 보다 짧을 수 있음)
      if (next && gate < Tds && this.sinceTD < Tds && !(kind === 'walk' && (this.trailStep || PR?.even))) next = null;
      // 발 떼기: 걷는 걸음 · 받아 딛기 · 기술 걸음 · 끌어붙임은 제 박자에 바로 뗀다 — 몸은 거꾸로 선 진자이고, 디딜 자리를 캡처 점으로 스텝마다 고쳐 받는다(target).
      //  급하지 않은 자세 고쳐 딛기만: 캡처 점이 받침 안에 GAIT.restTime 머문 뒤(몸이 가라앉은 뒤), 무게를 남을 발로 옮겨 캡처 점이 그 발바닥 안에 온 때 뗀다
      //  (기다림 한도 GAIT.settleWait 뒤에는 그냥 뗀다 — 몸을 돌리느라 발을 돌려 딛는 걸음은 받아 딛기와 같은 걸음이라 여기 오지 않는다)
      this.pend = null;
      if (next && kind === 'settle' && L[next === 'F' ? 'B' : 'F'].stance) {
        const calm = this.calmT >= GAIT.restTime;
        if (!calm || (!this.settleOk(L[next === 'F' ? 'B' : 'F']) && this.liftHold < GAIT.settleWait)) {
          if (calm) {
            this.liftHold += dt;
            this.pend = next; // 뗄 발 (아래 ⑤ 가 무게를 다른 발 쪽으로 옮김)
          }
          next = null;
          this.settles = keep0;
          this.pairOpen = keep1;
          this.drawPending = keep2;
          this.pairStop = false;
        }
      }
      // 걷기 시작의 첫 발: 떼기 앞서 GAIT.startWait 까지 무게를 남을 발 쪽으로 옮긴다(가려는 쪽에 수직인 몫만 — 아래 ⑤). 캡처 점이 남을 발에서 그 수직 쪽으로 GAIT.startSide 안에 오면 바로 뗀다.
      //  (두 발 사이에 선 채 한 발을 그냥 떼면 몸이 뗀 발 쪽으로 넘어가며 출발한다 — 사람도 발을 떼기 앞서 무게를 옮긴다)
      if (next && first && kind === 'walk' && this.liftHold < GAIT.startWait && L[next === 'F' ? 'B' : 'F'].stance && f.com) {
        const o = L[next === 'F' ? 'B' : 'F'];
        const w0 = f.legDrive.w0 || f.capW || 3.3;
        const sx = f.com.x + f.comVel.x / w0 - o.pinC.x;
        const sz = f.com.z + f.comVel.z / w0 - o.pinC.z;
        if (speed > 1e-3 && Math.abs(sx * want.z - sz * want.x) / speed > GAIT.startSide) {
          this.liftHold += dt;
          this.pend = next;
          next = null;
        }
      }
      // 미리 준비 (물리 2.0 다섯째 판 E1): 두 발로 선 채 스스로 떼는 발(기술 걸음 · 걷기 시작의 첫 발)은 떼기 앞서 '이 발을 떼고 남을 발 위에서 걸음 시간을 버틴 뒤의 캡처 점을
      //  새 받침(남을 발 ~ 디딜 자리)이 받는가'를 내다본다(liftMiss). 못 받으면(발 반 길이 SOLE_A 넘게 벗어남) 떼지 않고 무게를 남을 발 쪽으로 옮기며(아래 ⑤ 의 pend) 기다린다 — 사람이 첫 발을 떼기 앞서 0.3 ~ 0.5 s 무게를 옮기는 그 준비.
      //  기다림은 벗어남이 줄어드는 동안만 · GAIT.liftWait 까지(지나면 그냥 뗀다). 받아 딛기(급함) · 걷는 중의 번갈아 딛기는 묻지 않는다. 잰 값: 넘어짐으로 이어진 부탁 걸음 6 가운데 5 가 무게 실린 발을 뗀 뒤 옆으로 2 m/s (r5_e1 노트 §1)
      let ready = true;
      const going = kind === 'walk' && stepping; // 걷는 중의 번갈아 딛기: 기다리지 않는다(가는 몸을 세워 두면 몸만 달아난다) — 준비 걸음만 묻는다. 뛰기 · 빠른 걸음 · 박차기는 묻지 않음
      //  (합친 판 · r5_merge §4) 앞으로 내딛는 런지 부탁은 묻지 않는다 — 위의 발 고르기(lungeFit · 모아 딛기 gather — E2)가 이미 '이 자세로 받을 수 있는가'를 셈했다. 두 번 물으면 받을 수 있다고 본 런지를 기다리게 하거나 준비 걸음으로 바꾼다
      if (next && !urgent && ((kind === 'req' && !(this.req.kind === 'lunge' && this.req.fwd > 0)) || kind === 'walk') && !(going && (this.fly || this.burst || this.fastK > 1)) && L.F.stance && L.B.stance && f.com) {
        const ok = next === 'F' ? 'B' : 'F';
        const miss = this.liftMiss(L[next], L[ok], kind, Tstep, want, fwd, rgt);
        if (miss > SOLE_A) {
          if (!going && Math.hypot(f.comVel.x, f.comVel.z) < GAIT.startV && this.liftHold < GAIT.liftWait && miss <= this.missPrev + GAIT.capGuard) { // 기다림은 느린 몸(GAIT.startV 아래 — 걷기 첫 발의 무게 옮김과 같은 문턱)만: 이미 가는 몸(기술 걸음을 디딘 바로 뒤 · 밀려 가는 몸)은 세워 두면 달아난다
            this.missPrev = Math.min(this.missPrev, miss); // (가장 작았던 값보다 발 반 너비 넘게 다시 커지면 기다려도 소용없다)
            this.liftHold += dt;
            this.pend = next;
            next = null;
            ready = false;
          } else if (this.liftMiss(L[ok], L[next], 'catch', GAIT.catchT, want, fwd, rgt) < miss - 0.1) {
            // 준비 걸음: 기다려도 못 받는 발(몸이 이미 옆으로 가고 있다 — 두 발이 다 무게중심 한쪽에 남음)이면 다른 발을 먼저 캡처 점에 디뎌 받침을 몸 밑에 놓는다. 부탁은 그대로 남아(1 s 안) 그 발을 디딘 뒤 다시 묻는다.
            //  잰 값(츠바이핸더 씨앗 15 · 20): 오른쪽으로 0.5 m/s 가는 몸에서 왼발만 부탁 걸음으로 두 번 뜨고 오른발은 그대로 — 두 발이 다 왼쪽에 남아 오른쪽으로 2 m/s 로 넘어감
            next = ok;
            kind = 'catch';
            Tstep = GAIT.catchT;
          }
        }
      }
      if (ready) this.missPrev = Infinity;
      if (next) this.liftHold = 0;
      if (next) {
        const l = L[next];
        // 빠른 걸음: 이 걸음을 세고(박자 걸음) 받을 창을 쓰고(간격 잡기) 박차기를 쓰고(첫 걸음) 빠른 걸음인지 정한다 (앞뒤 가름은 위 짝걸음 PR 과 같은 셈). 빠른 걸음 중이면 끝내는 것도 여기
        if (RH || CH || this.burst || this.fastK > 1) Tstep = this.fastBegin(RH, CH, kind, PR, want.x * fwd.x + want.z * fwd.z, vLat, this.vf.x * fwd.x + this.vf.z * fwd.z, Tstep);
        if (this.P.backCap && this.P.backMul === 'flat') this.backStep(kind, this.vf.x * fwd.x + this.vf.z * fwd.z);
        if (kind === 'walk' || kind === 'catch') Tstep /= 1 + hurry;
        this.begin(l, kind, Tstep);
        // 캡처 점이 받침 밖이라 바로 뗀 받아 딛기(urgent)는 유파 걸음이 아니라 몸의 반사다 — 낮게 끄는 유파 발 들기(이탈리아 0.045)로 옆 · 뒤로 멀리 뻗으면 발이 길의 절반도 못 가 땅에 걸린다: 들기 바닥 GAIT.catchLift.
        //  (같은 'catch' 꼴이어도 몸을 돌리느라 돌려 딛는 걸음 · 닿지 않는 발 옮기기는 유파 들기 그대로 — 싸움에서 늘 나오는 그 걸음까지 높이 들면 넘어짐이 는다: 잰 값 r4_balance 노트)
        l.reflex = urgent;
        if (urgent && GAIT.catchLift > l.lift) l.lift = GAIT.catchLift;
        if (this.fly && kind === 'walk') this.flyStep(l); // 날며 뛰기 (11/20)
        if (this.burstStep) {
          // 첫 걸음 박차기를 쓴 걸음: 그 발(디딜 자리를 박찬 가속으로 내다봄 — target) · 박찬 쪽(세게 멈춤 — 아래 burstBrake)
          this.burstStep = false;
          this.burstLeg = l;
          if (this.fastFore) {
            const s = Math.sign(want.x * fwd.x + want.z * fwd.z) || -1; // 앞뒤 몫만 빠르게 한 박차기(비스듬히 뒤 — 이베리아 아님): 세게 멈춤은 앞뒤 축으로(옆 몫은 보통 빠르기)
            this.burstBrake = { x: fwd.x * s, z: fwd.z * s };
          } else {
            const w = Math.hypot(want.x, want.z) || 1;
            this.burstBrake = { x: want.x / w, z: want.z / w };
          }
        }
        if (this.fastK > 1 || l.fastStep) l.fastStep = this.fastK > 1 ? this.fastAccent : null; // 빠른 걸음의 발 = 발소리 강조 배율 { gain, rate } — 디딜 때 조금 또렷하게 (sound.js BodySounds). 보통 걸음은 null
        // follow 의 따라붙는 발·끌어붙임(draw)은 발을 더 낮게 (중국 체보·일본 스리아시 — P.dragLift, 없으면 그대로)
        if (this.P.dragLift != null && (kind === 'draw' || (kind === 'walk' && this.follow && this.trailStep))) l.lift = this.P.dragLift;
        this.target(l, want, fwd, rgt, Tstep);
        // 자세 고치기: 멀리 옮길수록 천천히 (휙 옮기면 딛을 때 미끄러진다)
        if (kind === 'settle') l.T = clamp(GAIT.settleT + 0.5 * l.p0.distanceTo(l.p1), GAIT.settleT, 0.6);
        if (this.pairStop) {
          // 짝걸음 멈춤: 따라붙는 발은 걷던 짝의 따라붙는 걸음 시간으로 (자세 고치기보다 짧게), 발 들기는 걷는 걸음 높이
          l.T = Tsw * this.P.pair.trail;
          l.lift = this.P.lift;
          this.pairStop = false;
        }
        swing = l;
      }
    }
    this.flyAir = !!swing2; // 두 발 모두 뜸 (그동안 몸은 중력만 받는다 · updateFooting)
    // 박자 걸음 셈 끊기(P.rhythm): 걸음(자세 고치기 빼고)이 끝난 뒤 RH.idle s 안에 새 걸음을 떼지 않으면 처음부터 — 발이 떠 있는 동안은 재지 않는다.
    //  옆 걸음·기술 걸음도 걸음이라 시계를 되돌린다(세지도 끊지도 않음). 칸 없으면 셈하지 않는다
    //  막는 동안도 걸음 중과 같게 시계가 0 에 머문다(사장님 결정 10/17 14:5x '막기 중엔 셈을 지우지 않게 함' — parrying): 막기를 놓은 뒤 RH.idle s 안에 걸으면 셈이 이어진다
    if (RH) {
      if ((swing && swing.kind !== 'settle') || this.parrying()) this.rhyIdle = 0;
      else if ((this.rhyIdle += dt) > RH.idle) {
        this.rhyN = 0;
        this.rhyGo = false; // 보폭 박자 — 처음부터 다시 세면 짧은 디딤부터
        this.rhyF = 0;
        this.fastK = 1;
      }
    }
    if (this.P.backCap && this.P.backMul === 'flat') this.backTick(dt, swing);
    // 간격 잡기 받을 창: 받기 전엔 헛침 뒤 window s 안에 앞으로 걷기 시작하지 않으면 사라짐 · 받은 뒤엔 걸음(자세 고치기 빼고)이 끝나고 window s 안에
    //  새 걸음을 떼지 않으면(멈춤) 남은 걸음도 사라짐. 창이 없으면 셈하지 않는다
    if (CH && this.chase === CH) {
      if (!CH.got) {
        if ((CH.t += dt) > CH.def.window) this.chase = null;
      } else if (!(swing && swing.kind !== 'settle') && this.sinceTD > CH.def.window) this.chase = null;
    }
    if (this.req) {
      this.req.age += dt;
      if (this.req.age > 1) this.req = null;
    }
    if (this.drawPending && (this.drawPending.t += dt) > 0.6) this.drawPending = null; // 끌어붙임을 못 하고 0.6 s 지나면 버린다
    // 활 자세 무게(P.bow): 앞으로 내딛는 기술 걸음의 뒤 절반(앞발이 땅에 닿을 무렵부터 — 한 발로 떠 있는 동안 낮추면 앞발 위로 주저앉는다) + 디딘 뒤 hold s
    //  (끌어붙이는 발을 들면 끝) 1 쪽으로 inTime, 아니면 0 쪽으로 outTime. 칸 없으면 셈하지 않는다
    if (this.P.bow) {
      const B = this.P.bow;
      if (this.bowAfter > 0) this.bowAfter -= dt;
      if (swing && swing.kind === 'draw') this.bowAfter = 0;
      const on = (swing && swing.kind === 'req' && this.bowReq && swing.t > 0.5 * swing.T) || this.bowAfter > 0;
      this.bowW = clamp((this.bowW || 0) + (on ? dt / B.inTime : -dt / B.outTime), 0, 1);
    } else this.bowW = 0;

    // 짝걸음 몸 박자(pair.leadV·trailV·restV): 이끄는 발이 나가는 동안엔 몸이 덜 나가고(앞발 하나로 버티는 동안 다리가 늘어나 골반이 주저앉지 않게),
    //  이끄는 발을 디딘 뒤 따라붙는 발이 오는 동안 몸이 실려 가고, 짝 사이 쉼엔 조금 덜 — 펜싱 걸음처럼 몸이 짝마다 밀려 간다. 칸 없으면 셈하지 않는다
    if (PR?.leadV && walkNow) {
      const role = swing ? (swing.kind === 'walk' ? this.pairStep : null) : this.pairOpen ? 'trail' : 'rest';
      const k = role === 'lead' ? PR.leadV : role === 'trail' ? PR.trailV : role === 'rest' ? PR.restV : 1;
      //  (한 짝 평균이 1 이 되게 나눈다 — 박자 값을 바꿔도 같은 스틱이면 같은 거리를 간다)
      const tL = Tsw * (PR.lead ?? 1);
      const tT = Tds * PR.inner + Tsw * PR.trail;
      const tR = Math.max(Tds, 2 * sT - tL - tT);
      want.multiplyScalar(k / ((tL * PR.leadV + tT * PR.trailV + tR * PR.restV) / (tL + tT + tR)));
    }
    // 빠른 걸음 몸 빠르기(10/15 — 박자 걸음): 가려는 속도 ×fastK. 발 박자도 같은 배(위 sT)라 한 걸음 길이는 그대로, 시간만 ÷fastK.
    //  몸의 일이라 플레이어·AI 같이 — 이베리아 옆 빠르기(P.sideMul, 위 처음)와 같은 결이되 follow·박자 판단(speedF·cad) 뒤에 둔다(빠른 걸음이 follow 를 끄거나 박자를 두 번 올리지 않게).
    //  아래 reachSlow 는 그대로 건다(뒤에 남은 발이 닿게). 보통 걸음은 셈하지 않는다
    if (this.fastK > 1 && (!this.fastTimeOnly || this.fastSpeedMul > 1)) {
      if (this.fastTimeOnly) want.multiplyScalar(this.fastSpeedMul); // 이탈리아 보폭 박자: 몸은 speedMul, 박자는 fastK(mul)
      else if (this.fastFore) want.addScaledVector(fwd, (want.x * fwd.x + want.z * fwd.z) * (this.fastK - 1)); // 첫 걸음 박차기 비스듬히 뒤(이베리아 아님): 앞뒤 몫만
      else want.multiplyScalar(this.fastK);
    }
    // 기술 걸음 동안엔 몸도 그만큼 따라 나간다. 옆(side, 유파 고유 동작의 비껴 딛기 — 10/9)도 같은 꼴로 — side 0 이면 더하지 않는다(전과 바이트 같음)
    // 런지 걸음 (다섯째 판 E2): 앞으로 내딛는 런지는 제 줄로 간다 — 조종의 옆 몫은 런지 발이 디딜 때까지 쓰지 않는다(뒷발 하나로 선 몸은 옆으로 밀면 넘어간다 · r4_req §5-2 의 좌우 셈).
    //  옆으로 비껴 딛는 런지(req.side)는 아래에서 그 몫을 그대로 더한다
    const launch = !!(swing && swing.kind === 'req' && this.req?.kind === 'lunge' && this.req.fwd > 0);
    if (launch) want.addScaledVector(rgt, -(want.x * rgt.x + want.z * rgt.z));
    if (swing && swing.kind === 'req' && this.req) {
      want.addScaledVector(fwd, (this.req.fwd * 0.8 * (this.req.push ?? 1)) / (swing.T + 0.15)); // push: 유파 비기의 강한 걸음 (없으면 ×1 — 같은 수)
      if (this.req.side) want.addScaledVector(rgt, (this.req.side * 0.8) / (swing.T + 0.15));
      if (this.req.accel) this.lungeBrake = { x: fwd.x * Math.sign(this.req.fwd), z: fwd.z * Math.sign(this.req.fwd), on: true }; // 런지 걸음 (req.accel): 걸음 동안 가속 한도 × burstAccel
    } else if (this.lungeBrake?.on) this.lungeBrake.on = false;
    // 런지 걸음이 끝난 뒤: 몸의 그 쪽 빠르기가 가려는 속도 + BRAKE_TOL 안으로 줄 때까지 가속 한도 × burstAccel 그대로(박차기 세게 멈춤과 같은 셈 · 시간 값 없음) — 따라잡으면 끝
    if (this.lungeBrake && !this.lungeBrake.on) {
      const lb = this.lungeBrake;
      if (this.vf.x * lb.x + this.vf.z * lb.z <= Math.max(0, want.x * lb.x + want.z * lb.z) + BRAKE_TOL) this.lungeBrake = null;
    }
    // 다리로 낼 수 있는 걷는 빠르기 한도 (물리 2.0 시제품): 내딛는 발은 몸보다 2.3 배쯤 빨리 가야 한다(발이 뜬 시간에 두 걸음 길이를 옮김) — 이 한도 너머는 발이 제때 못 닿아 넘어진다.
    //  몸을 미는 밖 힘이 없으므로 '가려는 속도'를 다리가 따라갈 수 있는 값으로 자른다(박차기 · 런지 · 뛰기 몫도 여기서 잘린다 — 그 걸음들은 이 시제품에서 다시 맞추지 않음)
    {
      const sp = Math.hypot(want.x, want.z);
      const vmax = Math.max(this.legVRun(), this.fastK > 1 && this.kickNow() ? this.legV() * (GAIT.digV / GAIT.moveSpeed) : 0); // 뛰는 걸음은 그 걸음의 한도까지 · 독일 박찬 걸음은 걷는 한도 × 박찬 배율(파고들기 digV ÷ 걷는 끝 = 1.375 — 지금 게임과 같은 비) · 둘 다 아니면 legV 그대로
      if (sp > vmax) want.multiplyScalar(vmax / sp);
    }
    // ④ (좌우 무게 옮기기 — 한 발로 서는 동안 '속도'로 무게를 딛은 발 쪽에 밀던 몫 — 는 없다: 발을 떼기 앞서 무게를 옮기고(아래 ⑤ · liftOk), 한 발로 선 동안은 그 발 위에 붙든다)
    // ⑤ 가만히 서 있을 땐 무게중심을 두 발 사이(앞발 쪽으로 조금)에 둔다 → 서서 미끄러지지 않는다
    //  (활 자세(P.bow) 버팀 동안은 걷는 중이어도 무게를 앞발 쪽 P.bow.front 로 옮긴다 — 엉덩이가 앞발 위로 가 뒷다리가 펴진다. 칸 없으면 전과 같다)
    const bowHold = this.P.bow?.front != null && this.bowW > 0 && !swing;
    if (!walkNow && swing && !swing2 && swing.kind !== 'req' && f.com) {
      // 제자리에서 한 발로 선 동안(자세 고쳐 딛기 · 옮겨 딛기): 무게중심을 딛은 발 위에 붙든다 — 거꾸로 선 진자는 속도만 줄여서는 서지 않는다(자리 되먹임이 있어야)
      const o = swing === L.F ? L.B : L.F;
      this.standOn(o, swing, _s1);
      _s1.set((_s1.x - f.com.x) * GAIT.shiftGain, 0, (_s1.z - f.com.z) * GAIT.shiftGain);
      if (_s1.length() > GAIT.shiftVmax) _s1.setLength(GAIT.shiftVmax);
      want.add(_s1);
    }
    if ((!walkNow && !swing) || bowHold) {
      const c = f.com;
      if (c) {
        let w = bowHold ? this.P.weightFront + (this.P.bow.front - this.P.weightFront) * this.bowW : this.P.weightFront;
        if (f.okoriFront) w += f.okoriFront; // 오코리 (11/17 — AI 몸 · 사람 몸은 0): 무게를 앞발 쪽으로
        const front = this.frontLeg(fwd);
        const a = L[front].plant;
        const b = L[front === 'F' ? 'B' : 'F'].plant;
        let tx = b.x + (a.x - b.x) * w;
        let tz = b.z + (a.z - b.z) * w;
        let g = GAIT.holdGain;
        if (this.pend) {
          // 떼려고 기다리는 발이 있으면(liftOk) 무게중심을 남을 발 위로 옮긴다 — 발 하나 위에 서야 다른 발을 뗄 수 있다
          this.standOn(L[this.pend === 'F' ? 'B' : 'F'], L[this.pend], _s2);
          tx = _s2.x;
          tz = _s2.z;
          g = GAIT.shiftGain;
        }
        _s1.set((tx - c.x) * g, 0, (tz - c.z) * g);
        if (_s1.length() > (this.pend ? GAIT.shiftVmax : 0.3)) _s1.setLength(this.pend ? GAIT.shiftVmax : 0.3);
        want.add(_s1);
      }
    } else if (this.pend && walkNow && !swing && f.com) {
      // 걷기 시작의 첫 발을 떼려고 기다리는 동안: 가려는 쪽에 수직인 몫만 남을 발 쪽으로 (앞뒤는 가려는 속도가 민다)
      const o = L[this.pend === 'F' ? 'B' : 'F'];
      let sx = o.pinC.x - f.com.x;
      let sz = o.pinC.z - f.com.z;
      const sp = Math.hypot(want.x, want.z);
      if (sp > 1e-3) {
        const al = (sx * want.x + sz * want.z) / (sp * sp);
        sx -= want.x * al;
        sz -= want.z * al;
      }
      _s1.set(sx * GAIT.shiftGain, 0, sz * GAIT.shiftGain);
      if (_s1.length() > GAIT.shiftVmax) _s1.setLength(GAIT.shiftVmax);
      want.add(_s1);
    }

    // 첫 걸음 박차기 뒤 세게 멈춤(burstBrake — 박찬 쪽 단위 벡터): 박찬 걸음이 끝난 뒤(fastK 1 — 다음 걸음·스틱 거꾸로·놓음)에도 몸이 박찬 쪽으로 가려는 속도보다 BRAKE_TOL 넘게 빠른 동안은
    //  가속 한도 × burstAccel 그대로(fighter.js driveBalance) — 박찬 빠르기를 보통 가속 한도(3.2 m/s²)로 줄이면 몸이 0.3 m 넘게 더 흘러 발이 못 따라간다. 따라잡으면 끝 — 시간 값 없음
    //  10/15 뒤 2 s 고침(§7): 막대를 박찬 쪽으로 밀고 있으면(막대 걷기 빠르기의 박찬 쪽 몫 ws > 0) 세게 멈춤은 ws 까지만 끌어내린다 — 붙잡기 반사 느림·reachSlow 가
    //  가려는 속도를 그 아래로 줄여도 × burstAccel 로 거기까지 끌지 않는다(뒤로 오래 밀 때 몸이 0.1 m/s 까지 서던 까닭). ws 아래로 줄이는 몫은 세게 멈춤이 끝난 뒤 보통 가속 한도로.
    //  막대를 놓았거나 거꾸로면(ws ≤ 0) 전과 같다
    if (this.burstBrake && this.fastK <= 1) {
      const bb = this.burstBrake;
      const ws = wsx * bb.x + wsz * bb.z;
      const wb = want.x * bb.x + want.z * bb.z;
      if (this.vf.x * bb.x + this.vf.z * bb.z <= Math.max(0, wb, ws) + BRAKE_TOL) this.burstBrake = null;
      else if (ws > 0 && wb < ws) {
        want.x += bb.x * (ws - wb);
        want.z += bb.z * (ws - wb);
      }
    }
    // 간격 잡기 세게 멈춤(holdBrake — 잡기를 걸 때의 상대 쪽 단위 벡터, holdTick · 플레이어만): 몸의 그 쪽 빠르기가 가려는 속도의 그 몫 + BRAKE_TOL 안으로 줄면 끝 —
    //  그동안 가속 한도 × burstAccel(fighter.js driveBalance). 박차기 세게 멈춤과 같은 셈 · 시간 값 없음 · 잡기가 먼저 풀려도(스틱 놓음) 몸이 설 때까지는 그대로
    if (this.holdBrake) {
      const hb = this.holdBrake;
      if (this.vf.x * hb.x + this.vf.z * hb.z <= Math.max(0, want.x * hb.x + want.z * hb.z) + BRAKE_TOL) this.holdBrake = null;
    }

    // ⑥ 골반 높이: 딛은 다리가 닿는 높이 (무릎을 조금 굽힌 채)
    const drop = f.pelvisDropOffset || 0;
    const hurt = (1 - f.legHealth) * 0.1;
    // 빨리 걸을수록 무릎을 조금 더 굽힌 채 걷는다 (보폭이 길어도 골반이 크게 출렁이지 않게)
    //  뛰듯이 빨리 갈 땐 무릎을 더 굽혀 몸을 낮춘다
    //  옆걸음(옆으로 가는 몫이 절반 넘을 때)은 무릎을 조금 굽힌 채 (펜싱 발놀림처럼): 발을 옆으로 벌려 딛으면 어차피 골반이 내려간다
    this.runW = walkNow ? clamp((speed - GAIT.runFrom) / 0.5, 0, 1) : 0; // 뛰듯 가는 정도 (0 ~ 1)
    const walkH =
      this.P.walkHeight -
      GAIT.walkHeightFast * clamp((speed - 0.8) / 0.8, 0, 1) -
      GAIT.runDrop * this.runW -
      GAIT.sideLow * clamp((speed > 1e-3 ? vLat / speed : 0) * 2 - 1, 0, 1);
    // 걷기 ↔ 서기 높이는 천천히 바꾼다 (한 번에 낮추면 다리를 오므려 두 발이 땅에서 뜬다)
    const sd = f.secretStance; // 비기 자세 (10/10 — 발도 웅크림·런지, secret_instant.js stanceTick): 골반을 더 낮추고 그 동안은 빨리 바꾼다. 없으면 오늘 그대로
    const P = this.P;
    // 뛰는 걸음 (11/18 — 사람 몸만): 골반을 RUN.drop × 섞임 만큼 더 낮춘다 — 유파 걸음은 그 낮춤도 유파 바탕 낮춤과 함께 GAIT.lowMax 안(일본처럼 이미 낮은 몸은 더 안 낮춤). 섞임 0 이면 0 (빼도 그대로)
    const runDrop = rk > 0 ? RUN.drop * rk : 0;
    let hNomT;
    if (P === GAIT) hNomT = (walkNow ? walkH - runDrop : GAIT.guardHeight) - hurt - Math.max(0, drop) - (sd ? sd.drop : 0);
    else {
      // 유파 걸음(10/10): 바탕 높이(P.guardHeight·walkHeight)를 낮추고, 자세표·덧씌우기 낮춤(drop)과 합친 낮춤을 전역 기본 높이 기준 GAIT.lowMax 까지로.
      //  비기 자세(sd) 동안은 유파 바탕을 쓰지 않고 전역 기본 높이 위에 비기 낮춤 그대로(비기 값이 그 높이에 맞춰 정해짐 — 상한 밖, 확인표 507)
      const def = walkNow ? walkH + (GAIT.walkHeight - P.walkHeight) : GAIT.guardHeight;
      // 유파 낮춤 더하기 (10/10 중국, 상한 GAIT.lowMax 안): 그 자세에 있을 때(P.guardLow — 간수세 虎蹲) · 활 자세(P.bow, 무게 bowW). 칸 없으면 0
      const gl = P.guardLow && f.bodyGuard?.nearest === guardIdx(P.guardLow.guard) ? P.guardLow.drop : 0;
      if (sd) hNomT = def - hurt - Math.max(0, drop) - sd.drop;
      else hNomT = def - Math.min(GAIT.lowMax, def - (walkNow ? walkH - runDrop : P.guardHeight) + Math.max(0, drop) + gl) - hurt;
      // 활 자세: 걷는 중이어도 멈춘 높이(전역 guardHeight) 기준으로 낮춘다(걷는 높이 기준이면 상한에 걸려 덜 내려간다) — 낮춤 합계는 같은 lowMax 안, 무게 bowW 만큼 섞음
      if (!sd && this.bowW > 0) {
        //  상한은 활 자세 칸 lowMax 가 있으면 그것 (10/10 14:2x 사장님 '0.16 은 규칙이 아니라 기준, 판단은 디렉터' → 활 자세만 밖으로 — 대기·걸음 낮춤은 GAIT.lowMax 그대로)
        const hb = GAIT.guardHeight - Math.min(P.bow.lowMax ?? GAIT.lowMax, GAIT.guardHeight - P.guardHeight + Math.max(0, drop) + gl + P.bow.drop) - hurt;
        hNomT += (Math.min(hNomT, hb) - hNomT) * this.bowW;
      }
    }
    const hr = (sd ? sd.rate : this.bowW > 0 ? Math.max(GAIT.heightRate, P.bow.rate) : GAIT.heightRate) * dt;
    this.hNomF = this.hNomF === undefined ? hNomT : this.hNomF + clamp(hNomT - this.hNomF, -hr, hr);
    const hNom = f.terrain ? this.groundY + this.hNomF : this.hNomF; // 지형 무대: 거른 자세 높이를 골반 밑 땅 위로
    let hGeo = Infinity;
    for (const k of ['F', 'B']) {
      const l = L[k];
      if (!l.stance) continue;
      l.phi = runMix(GAIT.kneeBase, RUN.knee, rk); // 디딜 때 더 굽히기(옛 loadKnee)는 0이라 지웠다. 무게를 받으며 저절로 굽는다 · 뛰는 걸음은 RUN.knee (11/18)
      const Ls = legLen(l.phi);
      const hx = l.hip.x - l.plant.x;
      const hz = l.hip.z - l.plant.z;
      let hy = (f.terrain ? l.plant.y : ANKLE_H) + Math.sqrt(Math.max(0.04, Ls * Ls - hx * hx - hz * hz)) + HIP_DROP; // 지형 무대: 딛은 발목의 실제 높이에서
      // 뒤로 빠진 발은 뒤꿈치를 들어(발끝으로 서서) 더 높이 받칠 수 있다
      //  (발이 엉덩이 옆을 지나 뒤로 빠지는 동안 조금씩 더한다: 한 번에 켜고 끄면 골반 높이 목표가 한 스텝에 몇 cm씩 뛴다)
      const back = hx * fwd.x + hz * fwd.z; // + = 발이 엉덩이 뒤에
      if (back > 0) {
        const r = Math.hypot(hx, hz);
        const r2 = Math.max(0, r - HEEL_DX);
        let hyHeel = ANKLE_H + HEEL_DY + Math.sqrt(Math.max(0.04, Ls * Ls - r2 * r2)) + HIP_DROP;
        if (f.terrain) {
          // 지형 무대: 뒤꿈치를 0.35 rad 든 발목 자리를 비탈 면 기준으로 (toePivot 의 지형 갈래)
          const heelAnkle = this.toePivot(l, _hp.copy(l.plant), 0.35);
          const heelReach2 = (l.hip.x - heelAnkle.x) ** 2 + (l.hip.z - heelAnkle.z) ** 2;
          hyHeel = heelAnkle.y + Math.sqrt(Math.max(0.04, Ls * Ls - heelReach2)) + HIP_DROP;
        }
        if (hyHeel > hy) hy += (hyHeel - hy) * clamp(back / GAIT.heelBlend, 0, 1);
      }
      // 두 발로 딛을 땐 더 높이 받칠 수 있는 다리 기준 (뒷발은 뒤꿈치를 들어 따라온다)
      hGeo = hGeo === Infinity ? hy : Math.max(hGeo, hy);
    }
    // 내딛는 다리가 디딜 자리에 닿을 높이: 발이 닿을 때 엉덩이가 있을 곳(지금 엉덩이 + 걸러진 속도 × 남은 시간)에서 디딜 자리까지 다리(무릎 기본 굽힘)가 닿게 골반을 미리 내린다.
    //  (안 내리면 다 편 다리가 땅 위 3 ~ 5 cm 에 뜬 채 몸이 그 위로 떨어질 때까지 기다린다 — 잰 값: 0.9 m/s 걷기에서 디딤이 정한 때보다 0.02 ~ 0.12 s 늦고 무릎 3° 로 닿음)
    if (swing && !swing2 && hGeo < Infinity && (swing.kind === 'walk' || swing.kind === 'catch' || swing.kind === 'req')) {
      const rem = Math.max(0, swing.T - swing.t);
      const hx = swing.hip.x + this.vf.x * rem - swing.p1.x;
      const hz = swing.hip.z + this.vf.z * rem - swing.p1.z;
      const Ls = legLen(runMix(GAIT.kneeBase, RUN.knee, rk));
      const hy = (f.terrain ? swing.p1.y : ANKLE_H) + Math.sqrt(Math.max(0.04, Ls * Ls - hx * hx - hz * hz)) + HIP_DROP;
      if (hy < hGeo) hGeo += (hy - hGeo) * THREE.MathUtils.smoothstep(swing.t / swing.T, GAIT.reachFrom, GAIT.reachFull);
    }
    this.hNom = hNom;
    const hStr = this.strengthFloor(drop + (sd ? sd.drop : 0)); // 다리 힘이 버틸 수 있는 높이 바닥 (다친 · 힘 빠진 몸은 무릎을 펴고 선다 — 성한 몸은 −∞)
    let hT = hStr > hNom ? Math.min(hStr, hGeo) : clamp(Math.min(hNom, hGeo), hNom - GAIT.maxDip, hNom);
    // 옆걸음·뒷걸음: 발을 디딜 때마다 골반을 살짝 내려 무릎이 무게를 받게 한다
    //  (옆걸음은 다리를 벌린 채, 뒷걸음은 발끝부터 디뎌 뒤꿈치를 든 채 무게를 받아서 저절로는 무릎이 굽지 않는다)
    if (walkNow && GAIT.sideDip > 0 && speed > 1e-3) {
      let bump = 0;
      for (const k of ['F', 'B']) {
        const l = L[k];
        if (l.stance && l.tLand < GAIT.loadTime) bump = Math.max(bump, Math.sin((Math.PI * l.tLand) / GAIT.loadTime));
      }
      //  (앞뒤로 비스듬히 갈 땐 내리지 않는다: 앞으로 내딛는 다리는 저절로 무릎이 굽는다)
      const side = clamp((vLat / speed - GAIT.sideDipFrom) / (1 - GAIT.sideDipFrom), 0, 1);
      const back = backness * clamp(speed / 0.9, 0.4, 1); // 천천히 물러날 땐 덜
      hT -= Math.max(GAIT.sideDip * side, GAIT.backDip * back) * bump;
    }
    // 딱 멈추는 2차 필터 (내려갈 땐 빨리: 다리가 닿지 않는 높이로 끌어올리지 않게)
    const w = hT < this.h ? GAIT.hDown : GAIT.hUp;
    this.hv += (w * w * (hT - this.h) - 2 * w * this.hv) * dt;
    // 올라가는 빠르기는 hUpMax(m/s)까지 (낮게 내려앉았던 골반을 한 번에 밀어 올리면 몸이 떠서 딛은 발이 미끄러진다)
    //  걷는 동안은 hUpWalk 까지만: 골반 높이 목표가 걸음마다 '디딜 때 다리가 닿는 높이'로 내려갔다가 '한 발 위를 지날 때의 높이'로 되올라가면(0.89 ↔ 0.97 m) 높이 스프링(고유 진동수 1.7 Hz)이
    //  걸음 박자(2.1 ~ 3 Hz)를 못 따라가 실제 골반은 거꾸로 움직이고 수직 힘이 걸음마다 0.3 ↔ 1.6 × 몸무게로 출렁인다(잰 값 — 발을 바꿔 딛는 0.1 s 동안 바닥 값에 붙음).
    //  되올라가는 빠르기를 묶으면 목표가 디딜 때의 높이에 머문다 — 무릎을 굽힌 채 고른 높이로 걷는다(사람 골반 오르내림 ± 2 cm)
    const hUp = walkNow ? GAIT.hUpWalk : GAIT.hUpMax;
    if (this.hv > hUp) this.hv = hUp;
    this.h += this.hv * dt;
    // 다리가 닿는 높이보다 높으면 내린다. 한 번에 내리지 않고 capRate(m/s)로 (디딘 발이 엉덩이 옆을 지날 때처럼 닿는 높이가
    //  갑자기 줄면, 한 스텝에 골반 목표를 몇 cm 떨어뜨려 두 발이 다 들렸다가 다음 발이 몸무게의 두 배 가까이 받으며 미끄러진다)
    const cap = Math.max(hGeo + 0.01, hNom - GAIT.maxDip);
    if (this.h > cap) {
      this.h = Math.max(cap, this.h - GAIT.capRate * dt);
      this.hv = Math.min(this.hv, 0);
    }
  }

  /** 멈춘 뒤 펜싱 자세에서 가장 벗어난 발 (고쳐 딛을 발). 괜찮으면 null */
  settleLeg(posOk) {
    const c = this.f.com;
    if (!c) return null;
    this.settleByStance = false;
    let worst = null;
    let worstE = 0;
    let turned = 0; // 방향이 yawTol 넘게 틀어진 발 수
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      this.guardSpot(l, _s3);
      const e = Math.hypot(l.plant.x - _s3.x, l.plant.z - _s3.z);
      const ye = Math.abs(wrap(l.yaw - this.guardYaw(l)));
      const tol = this.settles === 0 ? GAIT.settleTol : GAIT.settleTol * 1.6;
      const score = Math.max(posOk ? e / tol : 0, ye / GAIT.yawTol);
      if (ye > GAIT.yawTol) turned++;
      if (score > 1 && score > worstE) {
        worstE = score;
        worst = k;
        this.settleTurn = ye / GAIT.yawTol >= (posOk ? e / tol : 0); // 몸을 돌려서 고쳐 딛는 발
      }
    }
    // 돌려 딛기에서 두 발이 다 틀어져 있으면 캡처 점에서 먼 발(덜 실린 발)부터 뗀다 — 실린 발을 먼저 떼면 몸이 그 발 쪽으로 넘어가며 돈다
    if (worst && this.settleTurn && turned === 2) {
      const v = this.f.comVel;
      const w0 = this.f.legDrive.w0 || this.f.capW || 3.3;
      const cx = c.x + (v ? v.x / w0 : 0);
      const cz = c.z + (v ? v.z / w0 : 0);
      const dF = Math.hypot(this.legs.F.pinC.x - cx, this.legs.F.pinC.z - cz);
      const dB = Math.hypot(this.legs.B.pinC.x - cx, this.legs.B.pinC.z - cz);
      worst = dF >= dB ? 'F' : 'B';
    }
    // 자세 길이 (P.settleStance — 10/29 일본 걸음): 발 하나하나는 자리 안이어도 두 발 앞뒤 거리가 자세 길이(guardLength)에서 settleTol(0.08 — 두 번째부터 넓히지 않음) 넘게
    //  벗어나면 한 발을 다른 발에서 자세 길이로 고쳐 딛는다 — 판 시작 자세 0.31 m 가 일본 자세 길이 0.45 로 끝내 안 고쳐지던 것(무게중심 기준 자리 고치기는 앞발을 옮기면 무게중심이 따라오고,
    //  뒷발을 뒤로 옮기면 무게가 실린 채 0.1 m 쯤 못 미쳐 디뎌 자세가 짧게 멈춤). 옮길 발 = 무게중심에서 먼 발(덜 실린 발). 칸 없으면 셈하지 않음
    //  발 하나가 자리 밖이어도 방금 고쳐 딛은 그 발을 또 고쳐 딛으려는 때(못 미쳐 디딘 뒷발 — 모노호시자오 자세 0.5 에서 settleMax 를 다 씀)엔 자세 길이를 먼저 본다
    if (posOk && this.P.settleStance && (!worst || (!this.settleTurn && worst === this.lastTD && this.lastTDKind === 'settle'))) {
      const h = this.headAhead();
      const fx = Math.cos(h);
      const fz = -Math.sin(h);
      const aF = this.legs.F.plant.x * fx + this.legs.F.plant.z * fz;
      const aB = this.legs.B.plant.x * fx + this.legs.B.plant.z * fz;
      if (Math.abs(Math.abs(aF - aB) - this.P.guardLength) > GAIT.settleTol) {
        const ac = c.x * fx + c.z * fz;
        worst = Math.abs(aF - ac) >= Math.abs(aB - ac) ? 'F' : 'B';
        this.settleTurn = false;
        this.settleByStance = true;
      }
    }
    return worst;
  }

  /**
   * 한 발(o)로 설 때 무게중심을 둘 자리 → out: 그 발바닥 가운데에서 다른 발(l) 쪽으로 GAIT.standInset.
   *  (한 발로 선 몸이 바깥으로 밀리면 받을 발이 없다 — 안쪽으로 밀리면 내딛는 발이 받는다. 그래서 안쪽으로 조금 치우쳐 선다)
   */
  standOn(o, l, out) {
    const dx = l.ankle.x - o.pinC.x;
    const dz = l.ankle.z - o.pinC.z;
    // 그 발의 옆 축 쪽 몫만 (앞뒤로는 발바닥 가운데)
    const lx = Math.sin(o.yaw);
    const lz = Math.cos(o.yaw);
    const sgn = Math.sign(dx * lx + dz * lz) || 0;
    return out.set(o.pinC.x + lx * sgn * GAIT.standInset, 0, o.pinC.z + lz * sgn * GAIT.standInset);
  }

  /**
   * 다음 걸음에 낼 몸 빠르기 → _sv: 지금 무게중심 빠르기에서 조종이 가려는 속도(균형 걸음 몫은 뺌) 쪽으로 한 걸음에 GAIT.capDv 까지.
   *  (가려는 속도를 바로 쓰면 서 있던 몸은 발을 뒤에 딛어 앞으로 넘어지며 출발하려 든다 — 빠르기는 두 발 디딤 동안의 땅 밀기와 걸음마다의 디딤 자리로 조금씩 올리고 내린다)
   */
  stepVel(want, dv = GAIT.capDv) {
    const v = this.f.comVel;
    let ex = want.x - v.x;
    let ez = want.z - v.z;
    const e = Math.hypot(ex, ez);
    if (e > dv) {
      ex *= dv / e;
      ez *= dv / e;
    }
    return _sv.set(v.x + ex, 0, v.z + ez);
  }

  /**
   * 캡처 점(무게중심 + 속도 ÷ ω)이 T 초 뒤 있을 곳 → _cap, 그때의 무게중심 → _capC · 속도 → _capV. st = 그동안 혼자 딛고 있을 발(없으면 두 발 모두 뜸 — 곧게 날아감).
   *  한 발로 선 동안 다리 구동(src/legs_vmc.js)이 하는 그대로 내다본다: 바라는 가속 a* = velGain · (조종 속도 − 속도)[가속 한도 안] 을 내는 압력 중심 p = 무게중심 밑 − a* ÷ ω² 를
   *  딛은 발바닥 안으로 자르고, 무게중심은 ω² · (무게중심 − p) 로 빨라진다 (ω² = g ÷ 윗몸 질량중심 높이 — 땅 반력이 윗몸을 돌리지 않게 기울 때의 진자).
   *  want = 가려는 속도 (다리 구동이 따르는 조종 속도)
   */
  capAt(st, T, want) {
    const f = this.f;
    const c = f.com;
    const v = f.comVel;
    if (!c || !v) return false;
    const w0 = (this.capW = f.legDrive.w0 || f.capW || 3.3);
    // 내딛는 다리를 휘두르는 반작용을 딛은 다리가 맞받으며 무게중심에 준 운동량은 그 다리가 땅에 서며 되돌아간다 — 내다볼 때는 그 몫(내딛는 발의 땅에 대한 속도 × GAIT.swingShare)을 뺀 속도로
    let cx = c.x, cz = c.z, vx = v.x, vz = v.z;
    {
      const sw = !this.legs.F.stance ? this.legs.F : !this.legs.B.stance ? this.legs.B : null;
      if (sw && sw.relOk) {
        const fv = f.bodies[sw.foot].linvel();
        vx -= GAIT.swingShare * fv.x;
        vz -= GAIT.swingShare * fv.z;
      }
    }
    const vx0 = vx, vz0 = vz, cx0 = cx, cz0 = cz;
    this.capIn = false;
    if (st && T > 0) {
      const fx = Math.cos(st.yaw), fz = -Math.sin(st.yaw);
      const w2 = w0 * w0;
      let ux = want ? want.x : vx, uz = want ? want.z : vz;
      // 조종 속도는 아직 오르내리는 중일 수 있다(fighter.driveBalance 의 goAccel · stopDecel) — 그 끝 값 쪽으로 같은 빠르기로 바뀐다고 본다
      const us = Math.hypot(ux, uz);
      const gk = want && us > 1e-4 ? Math.min(f.cmdGoalK ?? 1, this.legV() / us) : 1;
      const ux0 = ux, uz0 = uz;
      const ur = (gk < 1 ? GAIT.stopDecel : GAIT.goAccel) / Math.max(us, 1e-4);
      const aL = f.legIntent?.aLim || GAIT.maxAccel;
      const n = Math.max(1, Math.ceil(T * 60)), dt = T / n;
      for (let i = 0; i < n; i++) {
        if (gk !== 1) {
          const kk = gk > 1 ? Math.min(gk, 1 + ur * dt * (i + 1)) : Math.max(gk, 1 - ur * dt * (i + 1));
          ux = ux0 * kk;
          uz = uz0 * kk;
        }
        const dx = cx - clamp(LEGS.velGain * (ux - vx), -aL, aL) / w2 - st.pinC.x;
        const dz = cz - clamp(LEGS.velGain * (uz - vz), -aL, aL) / w2 - st.pinC.z;
        const a = clamp(dx * fx + dz * fz, -SOLE_A, SOLE_A);
        const b = clamp(-dx * fz + dz * fx, -SOLE_B, SOLE_B);
        if (i === 0) this.capIn = a === dx * fx + dz * fz && b === -dx * fz + dz * fx; // 바라는 압력 중심이 그 발바닥 안 (그대로 붙들 수 있다)
        vx += w2 * (cx - (st.pinC.x + a * fx - b * fz)) * dt;
        vz += w2 * (cz - (st.pinC.z + a * fz + b * fx)) * dt;
        cx += vx * dt;
        cz += vz * dt;
      }
      // 내딛는 발이 가는 쪽으로는: 거꾸로 선 진자가 넘어가며 얻는 속도 가운데 GAIT.capLip 몫만 디딜 때까지 남는다고 본다 — 나머지는 내딛는 다리를 세우는 반작용이 되가져간다
      //  (잰 값: 걷는 걸음에서 진자 셈은 디딜 때 앞 속도를 0.2 ~ 0.5 m/s 높게 본다 · 옆으로는 진자 셈 그대로가 맞다)
      const sw = !this.legs.F.stance ? this.legs.F : !this.legs.B.stance ? this.legs.B : null;
      if (sw) {
        let ux = sw.p1.x - sw.p0.x, uz = sw.p1.z - sw.p0.z;
        const ul = Math.hypot(ux, uz);
        if (ul > 0.05) {
          ux /= ul;
          uz /= ul;
          const k = 1 - GAIT.capLip;
          const dv = ((vx - vx0) * ux + (vz - vz0) * uz) * k;
          const dc = ((cx - cx0 - vx0 * T) * ux + (cz - cz0 - vz0 * T) * uz) * k;
          vx -= ux * dv;
          vz -= uz * dv;
          cx -= ux * dc;
          cz -= uz * dc;
        }
      }
    } else {
      cx += vx * T;
      cz += vz * T;
    }
    _capC.set(cx, 0, cz);
    _capV.set(vx, 0, vz);
    _cap.set(cx + vx / w0, 0, cz + vz / w0);
    return true;
  }

  /** 디딜 자리 미리 보기: begin + target 을 해 보고 되돌린다 → _pv { x, z 발바닥 가운데 · ideal 캡처 점으로 정한 자리인가 · miss 그 자리에서 잘린 거리 } */
  preview(l, kind, T, want, fwd, rgt) {
    for (const k of LIFT_KEEP) _keep[k] = l[k];
    _keepV[0].copy(l.p0);
    _keepV[1].copy(l.p1);
    _keepV[2].copy(l.v0);
    this.begin(l, kind, T);
    this.target(l, want, fwd, rgt, T);
    _pv.x = l.p1.x + Math.cos(l.yaw1) * 0.05; // 발바닥 가운데 = 발목 앞 0.05
    _pv.z = l.p1.z - Math.sin(l.yaw1) * 0.05;
    _pv.ideal = l.capIdeal;
    _pv.miss = l.capMiss;
    for (const k of LIFT_KEEP) l[k] = _keep[k];
    l.p0.copy(_keepV[0]);
    l.p1.copy(_keepV[1]);
    l.v0.copy(_keepV[2]);
    l.capIdeal = false;
    return _pv;
  }

  /**
   * 발 l 을 kind 걸음으로 T 초 떼었다 디딘 때(남을 발 o 위에서 버틴 뒤), 내다본 캡처 점이 새 받침 줄(남을 발바닥 가운데 ~ 디딜 발바닥 가운데)에서 벗어나는 거리(m).
   *  디딜 자리는 실제 걸음과 같은 셈(preview = begin + target — 캡처 점 지킴 · 닿는 거리 · 다리 꼬임 막기까지)으로 본다. 0 에 가까우면 디딘 뒤 설 수 있다.
   */
  liftMiss(l, o, kind, T, want, fwd, rgt) {
    if (!this.capAt(o, T, want)) return 0;
    this.preview(l, kind, T, want, fwd, rgt); // (target 이 같은 남을 발 · 같은 시간으로 캡처 점을 다시 내다봤으면 _cap 은 그 값)
    const ex = _pv.x - o.pinC.x;
    const ez = _pv.z - o.pinC.z;
    const e2 = ex * ex + ez * ez;
    const t = e2 > 1e-6 ? clamp(((_cap.x - o.pinC.x) * ex + (_cap.z - o.pinC.z) * ez) / e2, 0, 1) : 0;
    return Math.hypot(_cap.x - (o.pinC.x + ex * t), _cap.z - (o.pinC.z + ez * t));
  }

  /**
   * 받아 딛을 발 (캡처 점이 받침 밖으로 나갔을 때 — 두 발 다 딛은 채): 두 발을 하나씩 떼 본다고 치고(남은 발 위에서 T 초 동안 캡처 점이 달아난 뒤 그 자리에 딛기),
   *  디딜 자리가 닿는 거리 · 다리 꼬임 막기에 덜 잘리고, 덜 옮겨도 되는 쪽.
   */
  catchLeg(T, want, fwd, rgt) {
    let best = null;
    let bestCost = Infinity;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      const o = this.legs[k === 'F' ? 'B' : 'F'];
      if (!this.capAt(o, T, want)) return null;
      this.preview(l, 'catch', T, want, fwd, rgt);
      // 값 = 그 발이 옮겨 가야 할 거리 + 잘린 거리 × 3 (짧게 옮겨 받을 수 있는 발이 낫다 — 멀리 휘두르는 다리는 그 반작용으로 몸을 더 흔든다)
      const cost = Math.hypot(_pv.x - l.pinC.x, _pv.z - l.pinC.z) + _pv.miss * 3;
      if (cost < bestCost) {
        bestCost = cost;
        best = k;
      }
    }
    return best;
  }

  /**
   * 앞발 런지를 앞발 그대로 받을 수 있는가 (l = 내딛을 앞발 · o = 남을 뒷발 · update ③ 의 발 바꾸기 앞에서 물음).
   *  런지는 제 디딜 자리(뗀 자리 + fwd · side)가 뒷발에서 멀다(자세 길이 + 런지 길이 — 선 자세 0.55 + 0.6 = 1.15 m). 뒷발 하나 위에서 걸음 시간 동안 넘어간 몸의 캡처 점이
   *  '뒷발 → 디딜 자리' 쪽으로 그 자리를 발 반 길이(SOLE_A) 넘게 지나치지만 않으면 새 발이 받는다(캡처 점이 두 발 사이) — 캡처 점이 뒷발에서 GAIT.reqSpan 넘게 갔다는 것만으로 발을 바꾸지 않는다.
   *  지나치면(걷다가 받은 런지 — 캡처 점이 2 m 넘게 달아남) 거짓: 뒷발이 지나 딛는다.
   */
  lungeFit(l, o, want, fwd, rgt) {
    const r = this.req;
    const tx = l.pinC.x + fwd.x * r.fwd + rgt.x * r.side - o.pinC.x;
    const tz = l.pinC.z + fwd.z * r.fwd + rgt.z * r.side - o.pinC.z;
    const D = Math.hypot(tx, tz);
    if (D < 1e-3 || !this.capAt(o, r.duration, want)) return false;
    return ((_cap.x - o.pinC.x) * tx + (_cap.z - o.pinC.z) * tz) / D <= D + SOLE_A;
  }

  /**
   * 자세 고쳐 딛는 발을 지금 떼도 되는가 (o = 남을 발): 캡처 점이 남을 발바닥 안(한 발로 선 채 발목으로 붙들 수 있다)이어야 한다.
   *  걷는 걸음 · 받아 딛기 · 기술 걸음은 이 물음 없이 제 박자에 뗀다(디딜 자리를 캡처 점으로 스텝마다 고쳐 받는다) — 급하지 않은 고쳐 딛기만 무게를 먼저 옮긴다.
   */
  settleOk(o) {
    const c = this.f.com;
    const v = this.f.comVel;
    if (!c || !v) return true;
    const w0 = this.f.legDrive.w0 || this.f.capW || 3.3;
    const dx = c.x + v.x / w0 - o.pinC.x;
    const dz = c.z + v.z / w0 - o.pinC.z;
    const fx = Math.cos(o.yaw);
    const fz = -Math.sin(o.yaw);
    return Math.abs(dx * fx + dz * fz) < SOLE_A && Math.abs(-dx * fz + dz * fx) < SOLE_B;
  }

  /**
   * 펜싱 자세에서 이 발이 설 자리 (무게중심 기준).
   *  기준 점 this.gc: 발을 떼려고 무게를 옮기는 동안 · 고쳐 딛는 발이 떠 있는 동안은 그 앞의 무게중심 자리에 멈춰 둔다(update) —
   *  무게중심을 남을 발 쪽으로 옮기면(liftOk) 자리도 같이 움직여 고쳐 딛을지 말지가 뒤집히기 때문
   */
  guardSpot(l, out) {
    const c = this.gc;
    // 몸을 돌리는 중이면 돌아갈 방향을 미리 본다
    const h = this.headAhead();
    const fx = Math.cos(h);
    const fz = -Math.sin(h);
    const gl = this.P.guardLength * this.stanceK(); // (다친 몸은 자세 길이를 줄인다 — 성한 몸은 × 1)
    const x = l.k === 'F' ? gl * (1 - this.P.weightFront) : -gl * this.P.weightFront;
    const z = l.side * this.P.guardWidth * 0.5;
    // 오른쪽 = (-fz, 0, fx)
    out.set(c.x + fx * x - fz * z, ANKLE_H, c.z + fz * x + fx * z);
    if (this.f.terrain) out.y = this.ankleHeight(out.x, out.z); // 지형 무대: 그 자리 땅 위 발목 높이
    return out;
  }

  /**
   * 다친 몸의 자세 길이 몫 (0.3 ~ 1 · 넷째 판): 펜싱 자세의 두 발 앞뒤 거리를 '약한 쪽 다리 한 발로 서도 엉덩이가 버티는 거리'(legs_vmc.js hipReach)까지 줄인다.
   *  기준 = 자세의 긴 쪽 반 길이(guardLength × 무게 몫의 큰 쪽 — 한 발로 설 때 엉덩이가 그 발에서 가장 멀어지는 거리). 성한 몸은 모든 유파 자세에서 1.
   *  바닥 0.3: 두 발이 앞뒤로 겹치지 않는 거리(발 길이 0.24 m 의 0.7 배쯤 — 자세 길이 0.55 × 0.3 = 0.17 m · 좌우 간격은 그대로)
   */
  stanceK() {
    const D = this.f.legDrive;
    const half = this.P.guardLength * Math.max(this.P.weightFront, 1 - this.P.weightFront);
    return clamp(Math.min(D.hipReach('F'), D.hipReach('B')) / half, 0.3, 1);
  }

  /** 몸이 곧 바라볼 방향 (지금 도는 빠르기로 조금 앞질러) */
  headAhead() {
    const f = this.f;
    let lead = clamp(this.headRate * GAIT.turnLead, -0.5, 0.5);
    // 돌아서려는 방향(바라볼 곳)을 알면 그쪽을 미리 본다 (한 걸음에 발을 더 많이 돌려 딛는다)
    //  (뛰는 동안은 뛰는 쪽 — 11/18 뛰기 · 사람 몸만 · fighter.updateHeading 이 도는 쪽과 같게)
    const rf = f.run?.back ? runFace(f) : null; // (뛰다 멈춰 줄어드는 동안은 가는 쪽 — 11/20 · run.js runFace)
    if (GAIT.turnAhead > 0 && (f.faceTarget || rf != null)) {
      const p = f.bodies.pelvis.translation();
      const d = wrap((rf != null ? rf : Math.atan2(-(f.faceTarget.z - p.z), f.faceTarget.x - p.x)) - f.heading);
      if (Math.abs(d) > Math.abs(lead)) lead = clamp(d, -GAIT.turnAhead, GAIT.turnAhead);
    }
    return f.heading + lead;
  }

  guardYaw(l) {
    return this.headAhead() + (l.k === 'B' ? -l.side * GAIT.rearToe : 0);
  }

  /** 날며 뛰기 걸음 (11/20): 발 들기 높이 RUN.flyLift · 뗄 때 발 출발 빠르기 몸의 RUN.flyCarry 몫 (begin 뒤) */
  flyStep(l) {
    l.lift = RUN.flyLift;
    l.v0.set(this.vf.x * RUN.flyCarry, 0, this.vf.z * RUN.flyCarry);
  }

  begin(l, kind, T) {
    l.stance = false;
    l.heel = 0;
    l.relOk = false;
    l.kind = kind;
    l.t = 0;
    l.T = T;
    // 뗄 때의 발 놀림(follow·짝걸음) — 고른 짝걸음(P.pair.even)은 이 걸음을 디딜 때까지 이 꼴로 디딜 자리를 고친다(target). 다른 걸음은 읽지 않음
    l.fol = !!this.follow;
    l.pairOn = !!this.pairOn;
    l.p0.set(l.ankle.x, this.f.terrain ? this.ankleHeight(l.ankle.x, l.ankle.z) : ANKLE_H, l.ankle.z);
    l.p1.copy(l.p0);
    // 뗄 때의 발목은 서 있지 않다: 뒤에 남은 발은 뒤꿈치를 든 채(발목이 평평할 때보다 7 ~ 9 cm 위) 발끝을 축으로 돌며 앞으로 1.5 m/s · 위로 1 m/s 로 가고 있다(잰 값 — 1.1 m/s 걷기).
    //  목표 길을 '평평한 높이에 멈춘 발'에서 시작하면 이끄는 힘이 처음 0.05 s 동안 그 발을 세우고 눌렀다가(앞 −140 N · 아래 −140 N) 다시 상한(200 N)으로 0.2 s 를 당겨 따라잡는다 —
    //  그 큰 힘의 반작용이 몸통과 윗몸 yaw 를 흔든다. 그래서 길은 발목의 실제 자리 · 속도에서 시작한다(수평 속도 v0 · 들려 있던 높이 y0 · 올라가던 속도 vy0)
    {
      const fb = this.f.bodies[l.foot];
      const v = fb.linvel(), w = fb.angvel(), t = fb.translation();
      const rx = l.ankle.x - t.x, ry = l.ankle.y - t.y, rz = l.ankle.z - t.z;
      l.v0.set(v.x + w.y * rz - w.z * ry, 0, v.z + w.x * ry - w.y * rx);
      const vm = l.v0.length();
      if (vm > GAIT.liftVmax) l.v0.multiplyScalar(GAIT.liftVmax / vm);
      l.vy0 = clamp(v.y + w.z * rx - w.x * rz, 0, GAIT.liftVmax);
      l.y0 = Math.max(0, l.ankle.y - l.p0.y);
    }
    l.yaw0 = l.footYaw;
    l.lift = kind === 'settle' && !(this.P.settleStance && this.settleRel) ? this.P.liftSettle : this.P.lift; // 자세 길이 고치기 걸음(settleRel — 10/29 일본)은 걷는 들기: 고쳐 딛는 들기(일본 0.015)로는 낮은 자세에서 발이 일찍 실려 0.1 m 쯤 못 미쳐 디딤
    // 걷는 중엔 발을 든 시간 내내 옮긴다 (일찍 도착하면 몸이 따라올 때까지 발이 몸 앞 멀리 떠 있어야 한다)
    //  (다리가 닿지 않아 크게 옮기는 발(catch)은 조금 일찍 도착해 제자리에서 내려 딛는다: 움직이는 채로 닿으면 미끄러진다)
    l.hFrac = kind === 'settle' ? GAIT.hFrac : kind === 'catch' ? GAIT.hFracCatch : 1;
  }

  /** 내딛을 자리 정하기 (remain: 발이 땅에 닿기까지 남은 시간) */
  target(l, want, fwd, rgt, remain) {
    const f = this.f;
    if (this.rk > 0) {
      // 뛰는 걸음: 디딜 자리도 다리 빠르기 한도로 자른 속도로 센다 — 가려는 속도는 몸보다 늘 RUN.lead 앞서 있어, 그대로 쓰면 디딤 자리가 걸음마다 몸을 더 빠르게 하려 들어(stepVel) 한도를 넘어 달아난다
      //  (잰 값 · 한도 1.9: 무게중심 2.8 m/s 까지 달아나 8 판에 4 판 넘어짐). 걷는 걸음(rk 0)은 그대로
      const sp = Math.hypot(want.x, want.z), vm = this.legVRun();
      if (sp > vm) want = _wc.set((want.x * vm) / sp, 0, (want.z * vm) / sp);
    }
    l.capIdeal = false;
    const other = l === this.legs.F ? this.legs.B : this.legs.F;
    const p = f.bodies.pelvis.translation();
    const out = l.p1;
    const qx = out.x; // 지난 스텝까지의 디딜 자리 (아래 끝 — 고치는 빠르기 한도)
    const qz = out.z;
    if (l.kind === 'settle') {
      if (this.P.settleStance && this.settleRel) {
        // 자세 길이로 고쳐 딛음 (P.settleStance — 10/29 일본 걸음 · settleRel 은 고쳐 딛기를 시작할 때 정함): 다른 발에서 앞뒤 guardLength · 옆 guardWidth (끌어붙임 draw 자리와 같은 꼴)
        const h = this.headAhead();
        const fx = Math.cos(h);
        const fz = -Math.sin(h);
        const sg = l.k === 'F' ? 1 : -1;
        const z = (l.side - other.side) * this.P.guardWidth * 0.5;
        out.set(other.plant.x + fx * sg * this.P.guardLength - fz * z, ANKLE_H, other.plant.z + fz * sg * this.P.guardLength + fx * z);
        if (f.terrain) out.y = this.ankleHeight(out.x, out.z);
      } else this.guardSpot(l, out);
      l.yaw1 = this.guardYaw(l);
    } else if (l.kind === 'gather') {
      // 모아 딛기 (다섯째 판 E2 — update ③): 디딜 때의 무게중심(지금 자리 + 빠르기 × 남은 시간) 바로 뒤(발 반 길이 SOLE_A) · 가는 줄 위(옆 0)에.
      //  앞발과 겹치지 않게 앞발 디딘 자리에서 발 길이(2 × SOLE_A)보다 앞으로는 가지 않는다
      const c = f.com ?? p;
      const v = f.comVel ?? this.vf;
      const t = Math.max(0, remain) + (this.tds ?? 0); // 런지 발을 뗄 때(디딘 뒤 두 발 디딤 Tds)의 무게중심 밑으로
      let x = c.x + v.x * t;
      let z = c.z + v.z * t;
      const over = (x - other.plant.x) * fwd.x + (z - other.plant.z) * fwd.z + 2 * SOLE_A;
      if (over > 0) (x -= fwd.x * over), (z -= fwd.z * over);
      out.set(x, ANKLE_H, z);
      if (f.terrain) out.y = this.ankleHeight(out.x, out.z);
      l.yaw1 = this.headAhead();
    } else if (l.kind === 'req' && this.req) {
      // 기술 걸음. lunge: 앞발을 fwd만큼 내딛는다. pass: 뒷발이 앞발을 지나 그 앞에 딛는다 (앞뒤 발이 바뀐다). retreat: 뒷발을 fwd(음수)만큼 뒤로 (유파 비기 백스텝)
      const r = this.req;
      const own = r.kind === 'retreat' || (r.kind === 'lunge') !== !!r.swap; // 제 자리에서 내딛는 꼴(lunge · retreat) — 발을 바꿔 뗐으면(r.swap · update ③) lunge ↔ pass 가 뒤바뀐다
      const base = own ? l.p0 : other.plant;
      const x = own ? r.fwd : Math.max(0.3, r.fwd - 0.1);
      const z = r.side + (own ? 0 : l.side * this.P.guardWidth);
      out.set(base.x + fwd.x * x + rgt.x * z, ANKLE_H, base.z + fwd.z * x + rgt.z * z);
      l.yaw1 = this.headAhead();
    } else if (l.kind === 'draw') {
      // 끌어붙임(유파 걸음): 뒷발을 앞발 뒤 펜싱 자세 자리(앞뒤 P.guardLength, 좌우 P.guardWidth)로
      const fx = Math.cos(this.headAhead());
      const fz = -Math.sin(this.headAhead());
      const z = (l.side - other.side) * this.P.guardWidth * 0.5;
      out.set(other.plant.x - fx * this.P.guardLength - fz * z, ANKLE_H, other.plant.z - fz * this.P.guardLength + fx * z);
      l.yaw1 = this.guardYaw(l);
    } else if (l.kind !== 'catch' && (this.P.pair?.even ? l.fol : this.follow)) {
      // (받아 딛기 · 돌려 딛기는 유파 걸음이어도 아래 캡처 점 디딤으로: 펜싱 자세 자리(캡처 점에서 앞뒤 ± 0.29 m)에 한 발만 옮기면 캡처 점이 두 발을 잇는 줄 밖에 남는다 —
      //  잰 값(싸움 · 레이피어): 옆으로 0.35 m/s 로 넘어가는 몸을 받아 디딘 앞발이 캡처 점 앞 0.29 m 에 떨어져 캡처 점은 받침 밖 0.11 m 그대로, 받아 딛기 네 번에 두 발이 1.24 m 까지 벌어지며 넘어짐)
      // follow(유파 걸음): 몸이 닿을 곳(아래 walk 가지와 같은 Raibert 몫)을 가운데로 펜싱 자세 자리에 딛는다 — 걷는 동안에도 앞발이 앞, 두 발이 서로 지나가지 않는다
      //  (첫 걸음 박차기 발이면 몸 빠르기·디딜 때 자리를 박찬 가속으로 내다본다 — burstAhead)
      //  고른 짝걸음(P.pair.even)은 뗄 때의 꼴(l.fol · l.pairOn)로 끝까지 — 걸음 가운데 빠르기가 followVmax 를 넘나들어 follow ↔ 지나 딛기가 바뀌면 디딜 자리가 펜싱 자세 몫(±0.2 m)만큼
      //  한 번에 당겨져 앞발이 몸 밑에 떨어지고(몸이 앞발을 지나침) 붙잡기 반사가 켜진다(가까이 앞으로 짧게 톡 — gait_even_feel NT)
      const v = l === this.burstLeg ? this.burstAhead(p, want, remain, fwd) : this.vf;
      const pon = this.P.pair?.even ? l.pairOn : this.pairOn;
      //  (짝걸음(P.pair)이면 한 발이 딛고 있는 시간이 한 짝(걸음 두 개) − 제 발 든 시간 — 몸이 그 가운데쯤 발 위를 지나게 그만큼 앞에 딛는다)
      const Tst = pon ? 2 * this.sT - l.T : this.sT * (1 + (this.rk > 0 ? this.dsF : this.P.dsFrac));
      let px = l === this.burstLeg ? v.px : p.x + v.x * remain;
      let pz = l === this.burstLeg ? v.pz : p.z + v.z * remain;
      let cx = px + want.x * Tst * 0.5 + GAIT.kv * (v.x - want.x);
      let cz = pz + want.z * Tst * 0.5 + GAIT.kv * (v.z - want.z);
      // 캡처 점 디딤 (위 walk 가지와 같은 뜻): 펜싱 자세의 가운데를 '디딜 때의 캡처 점 − 계속 가는 몫'에 둔다
      if (l !== this.burstLeg && this.capAt(other.stance ? other : null, remain, want)) {
        const E = Math.exp(this.capW * Math.max(0.2, Tst));
        px = _capC.x;
        pz = _capC.z;
        this.stepVel(want);
        cx = _cap.x - (_sv.x * Tst) / (E - 1);
        cz = _cap.z - (_sv.z * Tst) / (E - 1);
      }
      const h = this.headAhead();
      const fx = Math.cos(h);
      const fz = -Math.sin(h);
      //  (짝걸음은 걷는 동안 앞뒤 간격을 pair.len 배로 — 한 발로 버티는 동안 엉덩이가 딛은 발에서 덜 멀어지게. 멈추면 자세 고치기가 펜싱 자세 간격으로 되돌린다)
      const gl = this.P.guardLength * (pon ? this.P.pair.len ?? 1 : 1);
      const x = l.k === 'F' ? gl * (1 - this.P.weightFront) : -gl * this.P.weightFront;
      const z = l.side * this.P.guardWidth * 0.5;
      out.set(cx + fx * x - fz * z, ANKLE_H, cz + fz * x + fx * z);
      l.yaw1 = this.guardYaw(l);
      const dx = out.x - px;
      const dz = out.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > this.P.maxReach) {
        out.x = px + (dx / d) * this.P.maxReach;
        out.z = pz + (dz / d) * this.P.maxReach;
      }
    } else {
      // 몸이 닿을 때 있을 곳 + 속도 × (딛는 시간의 절반) (Raibert). 속도가 원하는 것보다 빠르면 더 멀리 딛어 받는다
      //  (첫 걸음 박차기 발이면 몸 빠르기·디딜 때 자리를 박찬 가속으로 내다본다 — burstAhead)
      const bl = l === this.burstLeg && !this.kickNow(); // 옛 식(박찬 가속으로 내다봄)으로 딛는 박찬 발 — 독일 박찬 걸음(파고들기 · 뒤 박차기)은 아니다: 몸을 미는 밖 힘이 없어 12.8 m/s² 로 내다본 자리는 몸보다 멀리 앞이라 몸이 그 발에 걸려 선다(잰 값: 파고들기 두 걸음 뒤 0.27 m/s). 캡처 점 디딤으로 걸음마다 빨라진다
      const v = bl ? this.burstAhead(p, want, remain, fwd) : this.vf;
      const Tst = this.fly ? this.flyTc : this.sT * (1 + (this.rk > 0 ? this.dsF : this.P.dsFrac)); // 뛰는 걸음은 두 발 디딤 몫 RUN.dsFrac 섞음 (11/18) · 날며 뛰기는 한 발 디딤 Tc (11/20)
      let px = bl ? v.px : p.x + v.x * remain;
      let pz = bl ? v.pz : p.z + v.z * remain;
      const ah = this.fly ? RUN.flyAhead : 0.5; // 날며 뛰기 (11/20): 디딤 길의 RUN.flyAhead 몫만 몸 앞에 딛는다 — 무릎을 굽힌 채 닿게(다 편 다리로 닿으면 몸이 장대처럼 솟으며 선다)
      let ox = want.x * Tst * ah + GAIT.kv * (v.x - want.x);
      let oz = want.z * Tst * ah + GAIT.kv * (v.z - want.z);
      let wd = Math.min(this.P.width, GAIT.widthMax); // 걸음 너비는 유파 칸 값이어도 GAIT.widthMax 까지 (넓은 걸음은 한 발 디딤 동안 윗몸을 수직축으로 돌린다 — config)
      // 캡처 점 디딤: 몸은 딛은 발 위의 거꾸로 선 진자 — 이 발이 닿을 때 캡처 점이 있을 곳(capAt · 스텝마다 다시 내다봄)에서, 가려는 빠르기로 계속 걷게 하는 만큼(걸음 길이 ÷ (e^(ω·T) − 1)) 못 미쳐,
      //  좌우는 걸음 너비 ÷ (e^(ω·T) + 1) 만큼 바깥에 발바닥 가운데를 둔다. 몸이 밀리면 캡처 점이 먼저 움직이므로 발이 그쪽으로 따라간다(몸을 붙드는 밖 힘이 없으니 발이 받아야 한다).
      //  좌우 규칙: 디딜 때 캡처 점은 새로 딛는 발의 안쪽(다른 발 쪽)에 있어야 한다 — 바깥에 있으면 다음 발(반대쪽 발)은 다리를 꼬지 않고는 받을 수 없다.
      //   그래서 '못 미치는 몫'의 좌우 성분이 이 발 쪽을 향하면(옆으로 갈 때 가는 쪽 발) 그 성분은 버린다 — 가는 쪽 발은 캡처 점 바로 바깥에 딛고, 따라오는 발이 간격을 좁힌다.
      //  날며 뛰기 · 첫 걸음 박차기 발은 위 옛 식 그대로(그 걸음들은 다시 맞추지 않음)
      let sole = false; // 아래 자리가 발바닥 가운데 기준인가 (캡처 점 디딤) — 발목 자리로 옮김
      if (!this.fly && !bl && this.capAt(other.stance ? other : null, remain, want)) {
        const E = Math.exp(this.capW * Math.max(0.2, this.sT));
        this.stepVel(want, l === this.burstLeg ? GAIT.kickDv : GAIT.capDv); // 독일 박찬 발은 한 걸음에 더 크게 빨라진다 (GAIT.kickDv)
        px = _capC.x;
        pz = _capC.z;
        l.capX = _cap.x; // 내다본 디딜 때의 캡처 점 · 무게중심 · 속도 (재는 도구가 실제와 견준다)
        l.capZ = _cap.z;
        l.capCx = _capC.x;
        l.capCz = _capC.z;
        l.capVx = _capV.x;
        l.capVz = _capV.z;
        let bx = (_sv.x * this.sT) / (E - 1);
        let bz = (_sv.z * this.sT) / (E - 1);
        const bl = bx * rgt.x + bz * rgt.z;
        if (bl * l.side > 0) {
          bx -= rgt.x * bl;
          bz -= rgt.z * bl;
        }
        // 빠르기 맞춤(앞뒤로만): 디딜 때 앞뒤 속도가 조종 속도보다 빠르면 그만큼(× GAIT.kv 초) 더 앞에 딛어 받는다 — 몸통을 세우는 엉덩이 토크가 땅을 뒤로 밀어 몸을 조금씩 더 보내므로
        //  (몸통 먼저) 진자 셈만으로는 가려는 빠르기보다 빨라진다. 좌우로는 걸지 않는다(좌우 속도는 걸음마다 오가는 제 흔들림 — 거기에 걸면 발을 너무 바깥에 딛어 흔들림이 커진다)
        //  속도는 지난 디딤 때 잰 값(vTD)을 쓴다 — 발이 뜬 동안의 무게중심 속도는 내딛는 다리를 휘두르는 반작용으로 ± 0.3 m/s 출렁여, 그것으로 맞추면 디딜 자리가 걸음 안에서 앞뒤로 끌려다닌다
        const kf = GAIT.kv * ((this.vTD.x - want.x) * fwd.x + (this.vTD.z - want.z) * fwd.z);
        ox = _cap.x - px - bx + fwd.x * kf;
        oz = _cap.z - pz - bz + fwd.z * kf;
        wd = (2 * wd) / (1 + E) + GAIT.capWidth;
        sole = true;
      }
      if (this.fly) {
        // (골반이 자세대로 틀어져 있어 뒷다리 엉덩이는 골반 가운데보다 뒤에 있다 — 그 발 엉덩이 기준으로 딛는다: 골반 가운데 기준이면 뒷발이 다리가 닿지 않을 만큼 앞에 떨어져 몸이 솟으며 선다)
        //  (줄이는 동안(가려는 속도 < 몸 빠르기)도 엉덩이 앞 RUN.flyReach 까지만 — 더 멀리 딛으면 같은 까닭으로 솟음)
        const hf = (l.hip.x - p.x) * fwd.x + (l.hip.z - p.z) * fwd.z;
        const oa = ox * fwd.x + oz * fwd.z;
        const cut = Math.min(0, RUN.flyReach - oa);
        ox += fwd.x * (hf + cut);
        oz += fwd.z * (hf + cut);
      }
      out.set(px + ox + rgt.x * l.side * wd, ANKLE_H, pz + oz + rgt.z * l.side * wd);
      l.yaw1 = this.headAhead();
      if (sole) {
        // 발바닥 가운데 → 발목 (발목은 발바닥 가운데보다 0.05 m 뒤)
        out.x -= Math.cos(l.yaw1) * 0.05;
        out.z += Math.sin(l.yaw1) * 0.05;
      }
      l.capIx = out.x; // 캡처 점이 바라는 자리 (아래 닿는 거리 · 다리 꼬임 막기로 잘리기 전) → l.capMiss (target 끝)
      l.capIz = out.z;
      l.capIdeal = sole; // (옛 식으로 정한 첫 걸음 박차기 · 날며 뛰기 발은 아래 캡처 점 지킴을 받는다)
      l.cross = false;
      if (this.P.crossSide || this.P.arcYaw) {
        // 이베리아 둥근 걸음(10/10 유파 걸음 ⑤ — 몬탄테 둥근 걸음 [원전 2차]): 옆으로 돌 때(옆 몫이 크면) 발끝을 도는 쪽으로 틀어 딛고(arcYaw),
        //  뒤따르는 발(가는 쪽 반대편 발)은 딛고 있는 발 앞으로 엇갈려 그 너머에 딛는다(crossSide) — 다리 꼬임 막기(minWidth)는 이 걸음만 건너뛴다
        const wl = want.x * rgt.x + want.z * rgt.z;
        const sp = Math.hypot(want.x, want.z);
        const latF = sp > 0.05 ? Math.abs(wl) / sp : 0;
        if (latF > (this.P.crossFrom ?? 0.7)) {
          const dir = Math.sign(wl);
          if (this.P.arcYaw) l.yaw1 += -dir * this.P.arcYaw * latF; // 오른쪽(+)으로 돌면 발끝을 오른쪽으로 (yaw 는 왼쪽이 +)
          if (this.P.crossSide && l.side * dir < 0) {
            const olat = (other.plant.x - px) * rgt.x + (other.plant.z - pz) * rgt.z;
            const lat0 = (out.x - px) * rgt.x + (out.z - pz) * rgt.z;
            const add = olat + dir * this.P.crossSide - lat0;
            if (add * dir > 0) {
              out.addScaledVector(rgt, add);
              out.addScaledVector(fwd, this.P.crossFwd ?? 0.12);
              l.cross = true;
            }
          }
        }
      }
      // 너무 멀리 뻗지 않게
      const dx = out.x - px;
      const dz = out.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > this.P.maxReach) {
        out.x = px + (dx / d) * this.P.maxReach;
        out.z = pz + (dz / d) * this.P.maxReach;
      }
    }
    // 발을 돌려 딛는 각도는 엉덩이·발목이 비틀 수 있는 만큼만 (더 돌려 디디면 디딘 뒤 다리가 발을 되돌려 비틀어 미끄러진다)
    if (GAIT.swingTwist > 0) {
      const pel = f.heading + (f.pelvisYawOffset || 0);
      l.yaw1 = pel + clamp(wrap(l.yaw1 - pel), -GAIT.swingTwist, GAIT.swingTwist);
    }
    // 캡처 점 지킴: 정해진 자리에 딛는 걸음(기술 걸음 · 끌어붙임 · 유파 걸음의 펜싱 자세 디딤 · 자세 고쳐 딛기 · 첫 걸음 박차기 · 날며 뛰기)도 디딘 뒤 캡처 점이 '남은 발 ~ 새 발' 줄에서 GAIT.capGuard 넘게
    //  벗어나 있으면 새 발을 그만큼 캡처 점 쪽으로 옮긴다 — 몸을 세워 줄 밖 힘이 없으니 어느 걸음이든 디딘 뒤 설 수 있는 자리여야 한다(아래 다리 꼬임 막기보다 먼저 — 남은 발을 넘어가지는 않는다).
    //  (잰 값 · 싸움: 베며 내딛는 걸음(런지 0.58 m)이 뗀 자리 기준으로 딛는 동안 몸은 1.5 m/s 까지 빨라져 캡처 점이 새 발 앞 0.5 ~ 1.1 m 에 남고, 다음 받아 딛기에서 두 발이 1.25 m 벌어지며 넘어짐)
    if (!l.capIdeal && other.stance && this.capAt(other, remain, want)) {
      const sx = out.x + Math.cos(l.yaw1) * 0.05; // 새 발바닥 가운데
      const sz = out.z - Math.sin(l.yaw1) * 0.05;
      const ex = sx - other.pinC.x;
      const ez = sz - other.pinC.z;
      const e2 = ex * ex + ez * ez;
      const t = e2 > 1e-6 ? clamp(((_cap.x - other.pinC.x) * ex + (_cap.z - other.pinC.z) * ez) / e2, 0, 1) : 1;
      const dx = _cap.x - (other.pinC.x + ex * t);
      const dz = _cap.z - (other.pinC.z + ez * t);
      const d = Math.hypot(dx, dz);
      if (d > GAIT.capGuard) {
        const k = (1 - GAIT.capGuard / d) / Math.max(t, 0.5); // (줄 가운데쯤이 벗어났으면 끝 점인 새 발은 그만큼 더 옮겨야 줄이 캡처 점에 닿는다)
        out.x += dx * k;
        out.z += dz * k;
        const rx = out.x - _capC.x; // 다리가 닿는 거리 안으로 (디딜 때의 무게중심에서)
        const rz = out.z - _capC.z;
        const r = Math.hypot(rx, rz);
        if (r > this.P.maxReach) {
          out.x = _capC.x + (rx / r) * this.P.maxReach;
          out.z = _capC.z + (rz / r) * this.P.maxReach;
        }
      }
    }
    // 다리가 꼬이지 않게: 딛은 발에서 자기 쪽으로 최소 간격
    //  (옆으로 갈 때 따라오는 발 — 가는 쪽 반대편 발 — 은 GAIT.sideClose 까지만 좁힌다: 가는 쪽 발이 다음에 내딛는 길이는 '따라온 발에서 캡처 점까지 거리'에 비례한다)
    const lat = (out.x - other.plant.x) * rgt.x + (out.z - other.plant.z) * rgt.z;
    const wl = (l.kind === 'walk' || l.kind === 'catch') && this.walking ? want.x * rgt.x + want.z * rgt.z : 0;
    //  (캡처 점으로 정한 디딤이 딛은 발보다 앞뒤로 GAIT.crossFore 넘게 떨어져 있으면 좌우로 GAIT.crossMax 까지 넘어가 딛을 수 있다 — 앞뒤로 엇갈린 두 다리는 서로 걸리지 않는다.
    //   디딜 때 캡처 점이 딛은 발 바깥으로 나가 있으면 그 발 앞을 가로질러 받는 길뿐이다)
    const fore = (out.x - other.plant.x) * fwd.x + (out.z - other.plant.z) * fwd.z;
    const pmw = l.capIdeal ? Math.min(this.P.minWidth, GAIT.minWidthMax) : this.P.minWidth; // (캡처 점으로 정하는 걷는 걸음 · 받아 딛기만 — 자세 고쳐 딛기는 유파 값 그대로)
    const minW = l.capIdeal && Math.abs(fore) > GAIT.crossFore ? -GAIT.crossMax : wl * l.side < -GAIT.walkMin ? Math.max(pmw, GAIT.sideClose) : pmw;
    const need = minW - lat * l.side;
    if (need > 0 && !(l.cross && l.kind === 'walk')) out.addScaledVector(rgt, need * l.side);
    if (l.capIdeal) l.capMiss = Math.hypot(out.x - l.capIx, out.z - l.capIz);
    // 발이 뜬 뒤 고치는 디딜 자리는 한 번 거른다(시간 상수 GAIT.retargetTau) — 내다봄이 스텝마다 흔들리면 발목 목표가 홱 당겨지고, 그 다리를 세우는 반작용이 다시 몸을 흔든다
    if (l.t > 0 && (l.kind === 'walk' || l.kind === 'catch')) {
      const k = Math.min(1, (f.lastDt || 1 / 120) / GAIT.retargetTau);
      out.x = qx + (out.x - qx) * k;
      out.z = qz + (out.z - qz) * k;
    }
    if (f.terrain) out.y = this.ankleHeight(out.x, out.z); // 지형 무대: 어느 갈래로 정했든 디딜 자리의 땅 위 발목 높이
  }

  touchdown(l, speed) {
    l.stance = true;
    if (this.f.comVel) this.vTD.copy(this.f.comVel); // 디딜 때의 무게중심 속도 (빠르기 맞춤이 읽는다 — target)
    if (this.fly) l.flyTc = this.flyTc; // 날며 뛰기 (11/20): 이 발이 딛는 시간은 디딜 때의 빠르기로 정함 (줄어드는 동안 Tc 가 늘어 발을 못 떼지 않게)
    if (l === this.burstLeg) this.burstLeg = null; // 첫 걸음 박차기 발이 디딤 (세게 멈춤 burstBrake 는 몸이 따라잡을 때까지 — update)
    // 디딜 때의 무릎 굽힘 (허벅지와 정강이 사이 각도)
    const bt = this.f.bodies[l.thigh].rotation();
    const bs = this.f.bodies[l.shin].rotation();
    _s2.set(0, 1, 0).applyQuaternion(_qT.set(bt.x, bt.y, bt.z, bt.w));
    _s3.set(0, 1, 0).applyQuaternion(_qT.set(bs.x, bs.y, bs.z, bs.w));
    l.phiTD = Math.acos(clamp(_s2.dot(_s3), -1, 1));
    this.plantAt(l);
    l.tLand = 0;
    this.sinceTD = 0;
    this.lastTD = l.k;
    this.lastTDKind = l.kind; // 옆걸음 가는 쪽 발 먼저(P.sideLead)가 읽는다
    if (this.P.pair) {
      // 짝걸음: 이끄는 발만 딛은 채면 짝이 열려 있다(pairOpen — 멈출 때 따라붙는 발을 곧 딛게), 따라붙는 발을 디디면 닫는다
      this.pairOpen = l.kind === 'walk' && this.follow && this.pairStep === 'lead' ? l.k : null;
      this.pairStep = null;
    }
    if (l.kind === 'req') {
      if (this.req?.draw) this.drawPending = { t: 0 }; // 유파 걸음: 다음 걸음에 뒷발 끌어붙임
      if (this.bowReq) this.bowAfter = this.P.bow.tech?.[this.req?.tech]?.hold ?? this.P.bow.hold; // 활 자세: 디딘 뒤 hold s 버팀 (기술마다 다르면 P.bow.tech — 표두격)
      this.bowReq = false;
      this.req = null;
    }
    this.f.footstep = Math.max(this.f.footstep, clamp(speed / GAIT.moveSpeed, 0.15, 1));
    l.tdN = (l.tdN || 0) + 1; // 디딤 셈 (sound.js BodySounds — 이탈리아 고른 짝걸음 발소리가 읽음. 몸·물리에는 안 씀)
  }

  /** 지금 발 자리를 딛은 자리로 기억한다 (발바닥 가운데·발끝이 땅에 붙은 곳도) */
  plantAt(l) {
    l.plant.set(l.ankle.x, ANKLE_H, l.ankle.z);
    l.yaw = l.footYaw;
    l.yawTD = l.footYaw;
    l.pinC.copy(SOLE_C).applyQuaternion(l.fq).add(l.fp);
    l.pinT.copy(SOLE_T).applyQuaternion(l.fq).add(l.fp);
    // 뒤꿈치를 든 채(발끝으로) 디뎠으면: 발끝 자리를 기준으로 발을 평평히 내렸을 때의 발목·발바닥 가운데 자리를 기억한다
    //  (들린 발 그대로 기억하면 뒤꿈치가 내려앉을 때 붙잡는 자리와 발이 어긋나 발이 끌린다)
    const fx = _s2.set(1, 0, 0).applyQuaternion(l.fq);
    if (this.f.terrain) {
      // 지형 무대: 딛은 발목은 땅 위 발목 높이, 붙잡는 자리는 땅 위. 뒤꿈치를 든 채 디뎠는지는 땅 법선 기준으로 보고,
      //  그랬으면 발끝 자리에서 비탈 면을 따라 발을 평평히 내렸을 때의 자리를 기억한다 (샛별 0116047c 그대로)
      const T = this.f.terrain;
      l.plant.y = this.ankleHeight(l.plant.x, l.plant.z);
      const n = T.normalAt(l.plant.x, l.plant.z);
      const heelDown = fx.x * n.x + fx.y * n.y + fx.z * n.z < -GAIT.heelTD;
      l.pinC.y = T.heightAt(l.pinC.x, l.pinC.z);
      l.pinT.y = T.heightAt(l.pinT.x, l.pinT.z);
      if (heelDown) {
        this.floorFrame(l.plant.x, l.plant.z, l.yaw);
        l.pinC.copy(l.pinT).addScaledVector(_floorFwd, -(SOLE_T.x - SOLE_C.x));
        l.plant.copy(l.pinT).addScaledVector(_floorFwd, -TOE_X).addScaledVector(_floorNormal, ANKLE_H);
      }
      return;
    }
    if (fx.y < -GAIT.heelTD) {
      const cx = Math.cos(l.yaw);
      const cz = -Math.sin(l.yaw);
      l.pinT.y = 0;
      l.pinC.set(l.pinT.x - cx * (SOLE_T.x - SOLE_C.x), 0, l.pinT.z - cz * (SOLE_T.x - SOLE_C.x));
      l.plant.set(l.pinT.x - cx * TOE_X, ANKLE_H, l.pinT.z - cz * TOE_X);
    }
  }

  /** 다리 관절 목표 (applyPose가 부른다) */
  poseLegs() {
    const f = this.f;
    const J = f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      // 딛은 다리 모터는 자세만 무르게 잡는다(굳기 · 감쇠 · 스프링 몫 상한 배율) — 몸무게 · 밀기 · 세우기는 명시 토크 쌍(src/legs_vmc.js)
      for (const n of [l.thigh, l.shin, l.foot]) {
        J[n].gain = l.stance ? GAIT.stanceGain : GAIT.swingGain;
        J[n].gainD = l.stance ? GAIT.stanceDamp : GAIT.swingDamp;
        J[n].cap = l.stance ? (n === l.foot ? GAIT.stanceAnkleCap : GAIT.stanceCap) : GAIT.swingCap;
        if (!l.stance && n === l.thigh) {
          // 내딛는 엉덩이: 모터는 다리가 향할 면(무릎 방향)만 무르게 잡는다 — 다리를 휘두르는 토크는 명시 쌍(발목을 이끄는 힘 · src/legs_vmc.js)이 내고, 그래야 그 반작용을 딛은 다리가 그대로 맞받는다.
          //  (모터가 세게 휘두르면 그 반작용은 셈에 안 잡힌 채 골반을 숙인다 — 엔진 모터가 실제로 낸 토크는 읽을 수 없다)
          J[n].gain = GAIT.swingHipGain;
          J[n].gainD = GAIT.swingHipDamp;
          J[n].cap = GAIT.swingHipCap;
        }
        if (l.stance && n === l.foot) J[n].gain = GAIT.stanceAnkleGain; // 딛은 발목: 압력 중심(발목 토크)은 명시 토크가 정한다 — 모터가 발바닥 평평 목표로 끼어들면 압력 중심이 몇 cm 어긋난다
      }
    }
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      if (l.stance) {
        // 딛은 발: 지금 엉덩이에서 딛은 자리까지의 다리 꼴이 목표 — 다리 길이 쪽으로는 모터가 밀지도 당기지도 않는다(골반 높이 · 몸무게는 명시 토크 쌍이 낸다 · src/legs_vmc.js).
        //  모터에 남는 것은 무릎이 향할 면 · 발바닥 평평 · 발 방향(자세)뿐
        _h.copy(l.hip);
        _a.copy(l.plant);
        // 다리가 닿지 않으면 발끝을 축으로 뒤꿈치를 든다 (뒤로 빠진 발이 땅을 끌지 않게)
        //  (조금만 모자랄 땐 들지 않는다: 들락날락하면 발이 떨린다)
        const heel = Math.max(0, this.heelOff(l, _h, _a, legLen(l.phi)) - GAIT.heelDead);
        l.heel += (heel - l.heel) * 0.3;
        if (l.heel > 0.01) this.toePivot(l, _a, l.heel);
        //  (디딜 때 이미 굽어 있던 만큼(phiTD)에서 더 굽히는 몫만 제한한다: 무릎을 굽힌 채 뛰듯 걸을 땐 그 굽힘부터)
        //  (걷는 중 디딘 직후(무게를 받는 동안)만: 서 있을 땐 자세대로 무릎을 굽힌다)
        const capK = GAIT.stanceKneeMax > 0 && this.walking && l.kind !== 'settle' && l.tLand < GAIT.loadTime * 1.5;
        //  (뛰듯 빨리 갈 땐 발을 디딜 때 부딪는 힘이 커서 무릎이 목표보다 더 꺾이므로 덜 굽히게 한다)
        this.legIK(l, _h, _a, l.yaw, -l.heel, capK ? legLen(Math.max(l.phi, l.phiTD) + GAIT.stanceKneeMax * (1 - GAIT.runKneeCut * this.runW)) : 0);
      } else {
        const u = clamp(l.t / l.T, 0, 1);
        // 앞뒤·옆으로는 발을 든 시간의 앞쪽 hFrac 동안 옮기고, 나머지 동안 거의 제자리에서 내려 딛는다
        //  (움직이는 채로 땅에 닿으면 미끄러진다)
        const uh = Math.min(1, u / l.hFrac);
        const s = minJerk(uh);
        // 5차 곡선: 발을 떼는 순간엔 몸과 함께 앞으로 나가기 시작하고(뒤에 끌리지 않게), 딛는 순간엔 땅에 대해 멈춘다
        const h1 = uh - 6 * uh * uh * uh + 8 * uh * uh * uh * uh - 3 * uh * uh * uh * uh * uh;
        _a.lerpVectors(l.p0, l.p1, s).addScaledVector(l.v0, h1 * l.T * l.hFrac);
        const late = l.t > l.T ? Math.min(GAIT.lateDrop, (l.t - l.T) * GAIT.lateRate) : 0; // 늦은 발은 땅을 찾아 더 내린다 (몸이 기울어 발이 떠 있어도 닿을 때까지)
        // 발은 일찍 들고(발끝이 걸리지 않게) 늦게 내린다. 들린 동안 발끝을 살짝 든다
        const up = THREE.MathUtils.smoothstep(u, 0, 0.3) * (1 - THREE.MathUtils.smoothstep(u, Math.min(GAIT.lowerFrom, l.hFrac - 0.15), 1));
        //  (뗄 때 들려 있던 높이 y0 는 발 뜬 시간의 가운데까지 그대로 두었다가 내린다 — 처음부터 내리면 올라가던 발을 이끄는 힘이 아래로 누른다 ·
        //   뗄 때 올라가던 속도 vy0 는 GAIT.liftBlend 초에 걸쳐 0 으로 — 같은 5차 꼴 · 가장 높이 0.2 × vy0 × liftBlend 만큼 더 뜸)
        const ub = Math.min(1, l.t / GAIT.liftBlend);
        const rise = (l.vy0 || 0) * GAIT.liftBlend * (ub - 6 * ub * ub * ub + 8 * ub * ub * ub * ub - 3 * ub * ub * ub * ub * ub);
        _a.y = (f.terrain ? this.ankleHeight(_a.x, _a.z) : ANKLE_H) + Math.max(l.lift * up, l.y0 * (1 - THREE.MathUtils.smoothstep(u, 0.4, 0.9))) + rise - late; // 지형 무대: 지나는 자리의 땅 위로
        const yaw = l.yaw0 + wrap(l.yaw1 - l.yaw0) * s;
        // 엉덩이에 대한 발의 속도를 제한한다 (다리를 채찍처럼 휘두르면 그 반동이 몸을 떠민다)
        _d.subVectors(_a, l.hip);
        if (l.relOk) {
          const mv = (this.fly ? RUN.flySwingV : GAIT.swingVmax) * f.lastDt; // 날며 뛰기 (11/20): 긴 걸음이라 발이 더 빨리 앞으로 (RUN.flySwingV)
          _c.subVectors(_d, l.rel);
          if (_c.lengthSq() > mv * mv) {
            _c.setLength(mv);
            _d.copy(l.rel).add(_c);
            _a.addVectors(l.hip, _d);
          }
        }
        l.rel.copy(_d);
        // 내딛는 발목을 목표로 이끄는 힘 — 엉덩이 · 무릎 토크 쌍으로 낸다(src/legs_vmc.js). 관절 모터만으로는 빠르게 휘두르는 다리가 목표를 지나쳐 땅에 미끄러지며 닿는다
        if (l.relOk && GAIT.swingK) this.swingLead(l, _a);
        else {
          l.desV.set(l.v0.x, l.vy0 || 0, l.v0.z); // 목표 길의 출발 속도 (다음 스텝의 목표 가속 셈이 0 에서 튀지 않게)
          l.desA.set(0, 0, 0);
        }
        l.relOk = true;
        l.des.copy(_a);
        // 받아 딛는 발: 다리 관절 모터가 따라갈 꼴(무릎 굽힘 · 다리 길이)은 '실제 발목에서 GAIT.catchKneeLead 앞'까지만 길 위의 점을 따라간다(높이는 길 그대로).
        //  길 위의 점은 이끄는 힘(상한 200 N)이 낼 수 있는 것보다 빨리 달아난다(밀린 몸을 받는 0.5 m 넘는 걸음) — 그 먼 점에 닿는 꼴로 무릎을 미리 펴면 다리만 길어져 발이 길의 절반에서 땅에 걸린다
        //  (잰 값 · 레이피어 80 N·s 옆 밀림: 발목이 길보다 0.2 m 뒤처진 채 발 뜬 시간의 45 % 에 닿아 정한 자리에 0.45 m 못 미침). 수평으로 옮기는 것은 이끄는 힘의 몫이다
        if (l.kind === 'catch' && l.reflex) {
          const ex = _a.x - l.ankle.x, ez = _a.z - l.ankle.z, e = Math.hypot(ex, ez);
          if (e > GAIT.catchKneeLead) { _a.x = l.ankle.x + (ex / e) * GAIT.catchKneeLead; _a.z = l.ankle.z + (ez / e) * GAIT.catchKneeLead; }
        }
        this.legIK(l, l.hip, _a, yaw, this.P.toeUp * Math.sin(Math.PI * u));
      }
    }
  }

  /**
   * 내딛는 발목을 목표(a)로 이끄는 힘을 정해 다리 구동에 넘긴다 — 다리 구동이 그 힘을 엉덩이 · 무릎 관절 토크 쌍으로 바꿔 건다(자코비안 전치).
   *  (예전 swingPull 은 발목 점의 발과 엉덩이 점의 골반에 같은 크기 반대 힘을 걸었다 — 두 작용선이 달라 몸 전체에 짝 없는 짝힘이 남았다: 걷기 4 s 에 326 N·m·s)
   */
  swingLead(l, a) {
    const f = this.f;
    const dt = f.lastDt || 1 / 120;
    // 목표의 속도 · 가속 (걸러서)
    _c.subVectors(a, l.des).multiplyScalar(1 / dt);
    const ax = l.desV.x, ay = l.desV.y, az = l.desV.z;
    l.desV.lerp(_c, 0.5);
    _c.set(l.desV.x - ax, l.desV.y - ay, l.desV.z - az).multiplyScalar(1 / dt);
    l.desA.lerp(_c, 0.35);
    const v = f.bodies[l.foot].linvel();
    const K = GAIT.swingK;
    const D = GAIT.swingD;
    // 되먹임(목표 자리 · 속도) + 앞먹임(목표 가속 × 발목에서 본 다리의 관성 GAIT.swingMass) — 앞먹임이 길을 따라가는 힘의 큰 몫을 내면 되먹임은 어긋남만 고친다
    const Mm = GAIT.swingMass;
    //  자리 어긋남 몫은 GAIT.swingErrMax 까지만 센다 — 뗀 발이 땅에서 풀리기 앞서 쌓인 어긋남이 한꺼번에 당기면 발이 목표를 지나친다
    _d.set(a.x - l.ankle.x, a.y - l.ankle.y, a.z - l.ankle.z);
    if (_d.length() > GAIT.swingErrMax) _d.setLength(GAIT.swingErrMax);
    _c.set(K * _d.x + D * (l.desV.x - v.x) + Mm * l.desA.x, K * _d.y + D * (l.desV.y - v.y) + Mm * l.desA.y, K * _d.z + D * (l.desV.z - v.z) + Mm * l.desA.z);
    const m = _c.length();
    const fm = Math.min(GAIT.swingFmax, (LEGS.limit.hipFlex * f.legDrive.strengthOf(l.k)) / f.legDrive.legMax); // 이끄는 힘의 상한: 그 다리 엉덩이가 낼 수 있는 힘(굽힘 토크 한도 × 근력 몫 ÷ 다리 길이 — 성한 몸 235 N 이라 그대로 200 · 근력 몫 0.85 밑부터 줄어든다) — 다리가 낼 수 없는 힘을 바라면 딛은 다리가 있지도 않은 반작용을 맞받는다 (넷째 판 · 다친 몸은 발을 느리게 옮긴다)
    if (m > fm) _c.multiplyScalar(fm / m);
    const D2 = f.legDrive.legs[l.k];
    D2.pullV.copy(_c);
    D2.pull = D2.pullV;
  }

  /** 딛은 발 발목이 엉덩이에서 Ls보다 멀면, 발끝을 축으로 뒤꿈치를 몇 라디안 들어야 닿는지 */
  heelOff(l, hip, ankle, Ls) {
    const dx = ankle.x - hip.x;
    const dy = ankle.y - hip.y;
    const dz = ankle.z - hip.z;
    if (dx * dx + dy * dy + dz * dz <= Ls * Ls) return 0;
    let lo = 0;
    let hi = GAIT.heelMax;
    for (let i = 0; i < 6; i++) {
      const m = (lo + hi) * 0.5;
      this.toePivot(l, _hp.copy(ankle), m);
      if (_hp.distanceToSquared(hip) > Ls * Ls) lo = m;
      else hi = m;
    }
    return hi;
  }

  /** 발끝(발바닥 앞쪽 모서리)을 축으로 뒤꿈치를 th만큼 들었을 때의 발목 위치 (ankle을 고친다) */
  toePivot(l, ankle, th) {
    if (this.f.terrain) {
      // 지형 무대: 발끝 → 발목을 비탈 면 틀(앞 = 면에 눕힌 yaw, 위 = 땅 법선)에서 (샛별 0116047c 그대로)
      this.floorFrame(ankle.x, ankle.z, l.yaw);
      const back = TOE_X * Math.cos(th) - SOLE_Y * Math.sin(th);
      const up = TOE_X * Math.sin(th) + SOLE_Y * Math.cos(th);
      return ankle.addScaledVector(_floorFwd, TOE_X - back).addScaledVector(_floorNormal, up - SOLE_Y);
    }
    const fx = Math.cos(l.yaw);
    const fz = -Math.sin(l.yaw);
    // 평평할 때 발끝 → 발목: 뒤로 TOE_X, 위로 SOLE_Y
    const c = Math.cos(th);
    const s = Math.sin(th);
    const back = TOE_X * c - SOLE_Y * s; // 발끝에서 뒤쪽으로
    const up = TOE_X * s + SOLE_Y * c;
    const tx = ankle.x + fx * TOE_X;
    const tz = ankle.z + fz * TOE_X;
    const ty = ankle.y - SOLE_Y;
    return ankle.set(tx - fx * back, ty + up, tz - fz * back);
  }

  /**
   * 다리 역운동학: 엉덩이(hip) → 발목(ankle)까지 다리를 뻗고, 발은 yaw 방향을 보며 땅과 나란하게.
   * 무릎은 경첩, 발목은 공 관절이라 다리가 옆으로 기울어도 발바닥은 평평하다.
   */
  legIK(l, hip, ankle, yaw, pitch, minLen = 0) {
    const f = this.f;
    const J = f.jointByName;
    const d = _d.subVectors(ankle, hip);
    let len = d.length();
    if (len < 1e-4) return;
    d.multiplyScalar(1 / len);
    // minLen: 딛은 다리는 무릎을 이 이상 굽히지 않고 버틴다 (몸무게를 받으며 무릎이 너무 꺾이지 않게: 다리가 골반을 밀어 올린다)
    len = clamp(len, Math.max(0.42, minLen), legLen(GAIT.kneeMin));
    const fwd = _fw.set(Math.cos(yaw), 0, -Math.sin(yaw));
    // 무릎 축: 발이 보는 방향의 오른쪽 축을, 다리 방향에 수직이 되게 고친다
    const kx = _kx.set(-fwd.z, 0, fwd.x);
    kx.addScaledVector(d, -kx.dot(d));
    if (kx.lengthSq() < 1e-6) kx.set(0, 0, 1).applyQuaternion(f.yaw);
    kx.normalize();
    const m = _m.crossVectors(kx, d); // 다리 평면에서 앞쪽
    const cosK = clamp((A_LEN * A_LEN + B_LEN * B_LEN - len * len) / (2 * A_LEN * B_LEN), -1, 1);
    const phi = Math.PI - Math.acos(cosK); // 무릎 굽힘
    const cosA = clamp((A_LEN * A_LEN + len * len - B_LEN * B_LEN) / (2 * A_LEN * len), -1, 1);
    const sinA = Math.sqrt(1 - cosA * cosA);
    const ut = _ut.copy(d).multiplyScalar(cosA).addScaledVector(m, sinA); // 허벅지 방향 (엉덩이 → 무릎)
    // 허벅지 자세 (월드): y = 뼈 반대 방향, z = 무릎 축
    _y.copy(ut).negate();
    _x.crossVectors(_y, kx);
    _M.makeBasis(_x, _y, kx);
    _qT.setFromRotationMatrix(_M);
    const pr = f.bodies.pelvis.rotation();
    _qP.set(pr.x, pr.y, pr.z, pr.w);
    _qP.invert();
    J[l.thigh].target.copy(_qP).multiply(_qT);
    J[l.shin].target.setFromAxisAngle(Z_AXIS, -phi);
    // 발목(공 관절): 발바닥이 땅과 나란히 yaw 방향을 보게 (pitch만큼 발끝을 들거나 뒤꿈치를 든다)
    //  발목 목표 = (정강이 목표 자세)⁻¹ × (발 월드 자세)
    _qS.copy(_qT).multiply(_qK.setFromAxisAngle(Z_AXIS, -phi)).invert();
    if (f.terrain) _qW.copy(this.floorFrame(ankle.x, ankle.z, yaw)); // 지형 무대: 발바닥이 비탈 면과 나란히
    else _qW.setFromAxisAngle(UP, yaw);
    if (pitch) _qW.multiply(_qK.setFromAxisAngle(Z_AXIS, pitch));
    J[l.foot].target.copy(_qS).multiply(_qW);
  }

  /**
   * 이 발이 지난 물리 스텝에 땅에서 받은 수직 힘(N): 물리 엔진의 접촉 충격량 ÷ 시간.
   *  바닥 콜라이더(setSupportFloor 로 알린 것)와의 접촉만 체중 받침으로 센다 — 경계 벽·잠든 습지 석상에 발이 부딪힌 힘은 받침이 아니다
   *  (10/14 디자인 결정 F, 확인표 1120). 바닥을 알리지 않은 세계(옛 도구)는 전처럼 고정 몸체 접촉을 모두 센다
   */
  groundForce(l) {
    const f = this.f;
    const w = f.world;
    const col = l.col || (l.col = f.bodies[l.foot].collider(0));
    _gf.imp = 0;
    _gf.col = col;
    _gf.w = w;
    _gf.floor = SUPPORT_FLOOR.get(w) ?? -1;
    _gf.sum = f.terrain ? _gfSumUp : _gfSum; // 지형 무대: 접촉 충격의 위 방향 성분만 받침으로 (비탈 면을 미는 몫·미끄럼을 막는 몫은 받침이 아님)
    w.contactPairsWith(col, _gfPairG);
    rethrowRapier(_rg); // 11/17 콜백 예외 드러내기 (rapier_guard.js)
    return f.lastDt > 0 ? _gf.imp / f.lastDt : 0;
  }

  /**
   * 딛은 발이 지난 스텝에 땅에서 받은 수직 힘 l.N 을 읽고(걸음 판단이 씀), 미끄러진 발의 딛은 자리 · 방향을 발 쪽으로 따라 옮긴다.
   *  힘은 걸지 않는다 — 발을 붙잡는 것은 엔진의 발 · 땅 마찰뿐이다. (예전 pinFeet 은 발바닥을 디딘 자리에 스프링으로 붙잡는 수평 힘 · yaw 토크를 발에 걸었다 —
   *  엔진 마찰과 겹쳐 수평 합이 마찰 한계를 넘곤 했다: 걷기 4 s 에 56 N·s)
   */
  footLoads() {
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      l.N = 0;
      if (!l.stance) continue;
      l.N = this.groundForce(l) * N_READ; // 엔진 접촉 충격량은 (반복 수 + 1) ÷ 반복 수 배로 읽힌다 (엔진 시험 2026-11-24 — 반복 6)
      // 발끝(뒤꿈치를 들어도 땅에 남는 점)이 딛을 때 자리에서 밀린 만큼 딛은 자리 · 발바닥 자리를 따라 옮긴다 — 미끄러진 발을 다리 모터가 되끌지 않는다
      _s1.copy(SOLE_T).applyQuaternion(l.fq).add(l.fp);
      const ex = (_s1.x - l.pinT.x) * GAIT.plantFollow;
      const ez = (_s1.z - l.pinT.z) * GAIT.plantFollow;
      l.plant.x += ex;
      l.plant.z += ez;
      l.pinC.x += ex;
      l.pinC.z += ez;
      l.pinT.x += ex;
      l.pinT.z += ez;
      l.yaw += wrap(l.footYaw - l.yaw) * GAIT.plantFollow;
      // 평평히 디딘 발목 높이도 실제 값으로 (접촉이 파묻히는 깊이는 엔진 풀이 값에 달렸다)
      if (!this.f.terrain && l.heel < 0.01 && Math.abs(l.soleY - l.toeY) < 0.004) l.plant.y += (clamp(l.ankle.y, ANKLE_H - 0.01, ANKLE_H + 0.012) - l.plant.y) * 0.2;
    }
  }

  /** 지형 무대: 이 자리에서 발바닥을 비탈과 나란히 댔을 때 발목의 월드 높이 (발목은 발바닥에서 땅 법선 쪽으로 ANKLE_H — 수직으로는 ANKLE_H / 법선 y) */
  ankleHeight(x, z) {
    const T = this.f.terrain;
    return T.heightAt(x, z) + ANKLE_H / T.normalAt(x, z).y;
  }

  /** 지형 무대: 발의 월드 틀 — 앞 = yaw 방향을 비탈 면에 눕힌 것, 위 = 땅 법선 (평지에서 setFromAxisAngle(UP, yaw) 와 같은 축 차례). _floorFwd·_floorNormal 도 채운다 */
  floorFrame(x, z, yaw) {
    const n = this.f.terrain.normalAt(x, z);
    _floorNormal.set(n.x, n.y, n.z);
    _floorFwd.set(Math.cos(yaw), 0, -Math.sin(yaw));
    _floorFwd.y = -(_floorNormal.x * _floorFwd.x + _floorNormal.z * _floorFwd.z) / _floorNormal.y;
    _floorFwd.normalize();
    _floorRight.crossVectors(_floorFwd, _floorNormal).normalize();
    _floorMatrix.makeBasis(_floorFwd, _floorNormal, _floorRight);
    return _floorQuat.setFromRotationMatrix(_floorMatrix);
  }


  /** 관절 목표 속도 기록(driveJoints의 prevRV)을 지운다 → 목표가 한 번에 바뀌어도 모터가 튀지 않는다 */
  resetRates() {
    const J = this.f.jointByName;
    for (const k of ['F', 'B']) {
      const l = this.legs[k];
      for (const n of [l.thigh, l.shin, l.foot]) J[n].prevRV = null;
    }
  }
}

const _qP = new THREE.Quaternion();
const _qF = new THREE.Quaternion();
const _qT = new THREE.Quaternion();
const _M = new THREE.Matrix4();
const _s1 = new THREE.Vector3();
const _s2 = new THREE.Vector3();
const _s3 = new THREE.Vector3();
const _h = new THREE.Vector3();
const _a = new THREE.Vector3();
const _d = new THREE.Vector3();
const _fw = new THREE.Vector3();
const _kx = new THREE.Vector3();
const _m = new THREE.Vector3();
const _ut = new THREE.Vector3();
const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _c = new THREE.Vector3();
const _hp = new THREE.Vector3();
const _qS = new THREE.Quaternion();
const _qK = new THREE.Quaternion();
const _qW = new THREE.Quaternion();
const _f = { x: 0, y: 0, z: 0 };
// groundForce용 (매 스텝 함수를 새로 만들지 않게)
const _gf = { imp: 0, col: null, w: null, floor: -1, sum: null };
const _gfSum = (m) => {
  for (let i = 0, n = m.numContacts(); i < n; i++) _gf.imp += m.contactImpulse(i);
};
// 지형 무대: 접촉 충격 × 그 접촉 법선의 위 방향 성분 (Rapier 법선은 첫째 → 둘째 콜라이더. 뒤집혔으면 땅 → 발이라 그대로 위) — 샛별 0116047c 와 같은 셈
const _gfSumUp = (m, flipped) => {
  const up = Math.max(0, m.normal().y * (flipped ? 1 : -1));
  for (let i = 0, n = m.numContacts(); i < n; i++) _gf.imp += m.contactImpulse(i) * up;
};
const _gfPair = (other) => {
  if (_gf.floor >= 0) {
    if (other.handle === _gf.floor) _gf.w.contactPair(_gf.col, other, _gf.sum === _gfSumUp ? _gfSumUpG : _gfSumG);
    rethrowRapier(_rg);
    return;
  }
  const b = other.parent();
  if (b && b.isFixed()) _gf.w.contactPair(_gf.col, other, _gf.sum === _gfSumUp ? _gfSumUpG : _gfSumG);
  rethrowRapier(_rg);
};
// 11/17 Rapier 콜백 예외 드러내기 (rapier_guard.js): 감싼 콜백은 모듈에서 한 번만 만듦 (발 받침은 스텝마다 불림)
const _rg = {};
const _gfSumG = guarded(_rg, _gfSum);
const _gfSumUpG = guarded(_rg, _gfSumUp);
const _gfPairG = guarded(_rg, _gfPair);
/** 물리 세계 → 체중을 받치는 바닥 콜라이더 핸들 (main.js newRound · 시뮬 jelly_harness 가 바닥을 만들 때 알린다) */
const SUPPORT_FLOOR = new WeakMap();
export function setSupportFloor(world, collider) {
  SUPPORT_FLOOR.set(world, collider.handle);
}
const _p = { x: 0, y: 0, z: 0 };
const _ba = { x: 0, z: 0, px: 0, pz: 0 }; // 첫 걸음 박차기 발 디딜 자리 셈(burstAhead) — 디딘 때 몸 빠르기·자리
const _sv = new THREE.Vector3(); // stepVel
const _wc = new THREE.Vector3(); // target: 뛰는 걸음의 자른 가려는 속도
const _pv = { x: 0, z: 0, ideal: false, miss: 0 }; // preview
const _cap = new THREE.Vector3(); // capAt: 디딜 때의 캡처 점
const _capC = new THREE.Vector3(); // capAt: 디딜 때의 무게중심
const _capV = new THREE.Vector3(); // capAt: 디딜 때의 무게중심 속도
const SOLE_A = 0.108; // 압력 중심이 발바닥 가운데에서 앞뒤로 갈 수 있는 거리 (발 반 길이 0.12 − LEGS.copMargin)
const SOLE_B = 0.038; // 좌우 (반 너비 0.05 − LEGS.copMargin)
const LIFT_KEEP = ['stance', 'heel', 'y0', 'vy0', 'relOk', 'kind', 't', 'T', 'fol', 'pairOn', 'yaw0', 'yaw1', 'lift', 'hFrac', 'cross', 'capMiss'];
const _keep = {};
const _keepV = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const N_READ = 6 / 7; // 접촉 법선 충격량 읽기 교정 (반복 6)
const BRAKE_TOL = 0.1; // 첫 걸음 박차기 뒤 세게 멈춤이 끝나는 빠르기 차(m/s): 몸이 박찬 쪽으로 가려는 속도보다 이만큼 안으로 느려지면 보통 가속 한도로 (확인표 1580~)
// 지형 무대 발 틀·마찰용 (floorFrame · pinTerrainFoot · plantAt · toePivot — 지형 없으면 쓰지 않는다)
const _floorNormal = new THREE.Vector3();
const _floorFwd = new THREE.Vector3();
const _floorRight = new THREE.Vector3();
const _floorMatrix = new THREE.Matrix4();
const _floorQuat = new THREE.Quaternion();
const _pinVelocity = new THREE.Vector3();
const _pinError = new THREE.Vector3();
const _pinForce = new THREE.Vector3();
