// ─────────────────────────────────────────────────────────────
//  쓰러진 상대 마무리 (내려찍기)
//
//  문제 (tools/sim/down_hits.mjs 로 잰 것): 교본 자세는 서 있는 상대에 맞춰져 있어서, 가장 낮은 자세(바보·바꿈)도
//  칼끝이 40~45°만 내려가고 손은 가슴 0.33m 아래에 머문다. 땅에 누운 몸(높이 0.1~0.3m)은 칼 밑을 지나가 닿지 않거나,
//  닿더라도 칼끝(칼날의 끝 2%)만 휘두르기 끝자락에 닿는다. 그때는 이미 손목이 칼을 멈추는 중이라 4~9m/s로 느려서
//  베기 문턱(가슴 45J·배 40J)을 넘지 못하고 멍만 든다(몸통 멍은 효과 없음). 쓰러진 상대 상처율 3%.
//
//  처방: 상대가 완전히 쓰러져(state 'down') 한 걸음 안에 누워 있으면, 자세 지도의 아래쪽 자세 자리에 마무리 자세를
//  겹쳐 놓는다 (guards.js FINISH_GUARDS). 두 자세 모두 누운 몸통을 겨누도록 매 스텝 이 파일이 손·칼끝을 정한다.
//   - 겨눔 (쟁기·옆 지킴 자리): 칼자루를 가슴 높이 위로 들고 칼끝을 누운 몸 바로 위에 둔다 (쉬는 자세)
//   - 내려찍기 (바보·바꿈 자리): 손을 낮게 앞으로 뻗고, 칼을 겨눔과 같은 선 위에서 몸 밑 땅속까지 겨눈다
//   → 겨눔 → 내려찍기 = 칼끝 방향으로 곧게 내리찌르기 (칼 축을 따라 움직여 '찌르기'로 판정된다)
//   → 지붕 → 내려찍기 = 내려베기. 칼의 목표 각도가 몸 밑 땅속이라 몸에 닿는 순간은 아직 목표에 한참 못 미쳐
//     손목이 제동을 걸기 전이다 → 빠른 칼날이 들어간다
//  두 사람 다 서 있으면 amt = 0 이고 자세 지도 계산은 예전과 한 비트도 다르지 않다.
//  플레이어와 AI 가 같은 파이터 코드를 쓰므로 AI 의 내려베기도 그대로 마무리가 된다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { MEASURED } from './ai.js';

export const FINISH = {
  range: 1.7, // 누운 몸통이 내 가슴에서 이 수평 거리(m) 안이면 마무리 자세
  minFwd: 0.2, // 내 앞쪽으로 이만큼(m)은 있어야 한다 (발밑·등 뒤는 찍지 못한다)
  ideal: 0.85, // 몸통(골반~가슴 선)에서 겨눌 점: 내 앞 이 거리(m)에 가장 가까운 점
  rampIn: 0.25, // 마무리 자세로 바뀌는 시간 (초)
  rampOut: 0.15, // 상대가 일어나면 교본 자세로 돌아가는 시간 (초)
  top: 0.12, // 누운 몸의 두께 절반 (몸 중심 위 겉면까지, m)
  sink: 0.2, // 내려찍기: 칼 선을 몸 중심 너머로 이만큼 더 겨눈다 (몸을 지나 땅속까지, m)
  // 칼날의 이 비율 지점이 몸 겉면에 닿도록 손을 놓는다. 칼은 가슴 높이에서 땅까지 닿을 만큼 길어서, 손을 너무 낮추거나
  //  몸에 붙이면 칼끝이 몸보다 먼저 땅에 박힌다 (측정: 가까이 누운 몸에서 칼이 몸 앞 땅을 쳤다)
  hitAt: 0.85,
  steep: 0.9, // 그때 칼이 내려가는 기울기 (sin) — 약 64°
  strikeY: [-0.45, 0.05], // 내려찍기 손 높이 범위 (가슴 기준, m)
  strikeFwd: [0.1, 0.55], // 내려찍기 손을 앞으로 뻗는 범위 (m)
  clear: 0.3, // 겨눔: 칼끝을 몸 겉면보다 이만큼 위에 둔다 (m) — 내리찌를 때 손이 속도를 붙일 거리
  hoverMaxY: 0.42, // 겨눔 손의 가장 높은 곳 (가슴 기준, m. 얼굴 높이)
  hoverMinX: 0.05, // 겨눔 손을 가슴 앞으로 이만큼은 둔다 (m)
  hoverBack: [0.2, 0.6], // 겨눔 손이 내려찍기 손에서 칼 선을 따라 물러나는 거리 범위 (m)
  // 내려찍는 동안 손목이 칼을 세우기 시작하는 때를 늦춘다 (fighter.driveSword 의 놓아주기 여유 × (1 − 이 값)).
  //  목표 각도가 몸 밑 땅속이라, 제동을 늦춰도 칼은 몸이나 땅에 먼저 닿는다
  brakeRelief: 0.8,
  hover: { pelvisYaw: 10, chestYaw: 12, pitch: 8, drop: 0.07 }, // 몸 (도, m)
  strike: { pelvisYaw: -5, chestYaw: -5, pitch: 22, drop: 0.13 },
  // AI 가 쓰러진 상대에게 쓰는 간격 (롱소드 기준 m, 무기 배율 k 를 곱한다. ai.js 가 간격 표 contact·reach·clinch 대신 쓴다).
  //  서 있는 상대의 간격(칼날이 머리 높이에 닿는 1.6m)으로는 누운 몸이 칼 밑 멀리 있어 허공만 치고 물러난다
  //  (tools/sim/down_diag.mjs: 롱소드 AI 가 1.5m 안으로 들어가지 않았다). 겨눌 점(ideal 0.85m)보다 조금 멀리서 들어가 내려치고,
  //  발밑(minFwd)에 가까울 때만 물러난다. 1.0/1.3/0.5 · 1.1/1.4/0.6 · 1.2/1.5/0.6 을 48판씩 견줘 첫 상처가 가장 빠른 값
  ai: { contact: 1.1, reach: 1.4, clinch: 0.6 },
};

// 칼 길이에 따른 마무리 거리: 누운 몸(어깨 아래 약 1.2m)까지 수평으로 닿는 거리는 칼이 짧을수록 훨씬 짧아진다.
//  무기 실측 사거리(ai.js MEASURED 의 contact — 칼날 70% 지점이 머리 높이에 닿는 가슴 기준 거리)를 반지름으로 보고
//  √(contact² − DROP²) 를 롱소드 값으로 나눈 배율을 FINISH.ideal·range, THRUST.downStepFrom, AI 가 다가서는 거리에 곱한다.
//  롱소드보다 긴 칼은 1 (롱소드에 맞춘 값 그대로). 측정: 청강검은 누운 몸까지 0.7~0.9m 에서만 들어갔다(롱소드 1.35m 넘어서도)
const DROP = 1.2;
export function downReachK(id) {
  const m = MEASURED[id];
  if (!m || id === 'longsword') return 1;
  const r = (c) => Math.sqrt(Math.max(0.09, c * c - DROP * DROP));
  return Math.min(1, r(m[0]) / r(MEASURED.longsword[0]));
}

const D2R = Math.PI / 180;
const _yawInv = new THREE.Quaternion();
const _c = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _t = new THREE.Vector3();
const _h = new THREE.Vector3();

function pose(body) {
  return { hand: [0, 0, 0], dir: [0, -1, 0], pelvisYaw: body.pelvisYaw * D2R, chestYaw: body.chestYaw * D2R, pitch: body.pitch * D2R, drop: body.drop };
}

/** 이 파이터의 마무리 상태 (guards.js guardAt 의 fin) */
export function newFinish() {
  return { amt: 0, on: false, k: null, gap: null, target: [0, 0, 0], hover: pose(FINISH.hover), strike: pose(FINISH.strike) };
}

/**
 * 매 물리 스텝: 상대가 쓰러져 있으면 누운 몸통의 한 점을 겨누는 마무리 자세를 정하고 amt 를 0 → 1 로 올린다.
 * 좌표는 몸 기준(가슴 중심 원점, 몸이 바라보는 방향 yaw): [앞, 위, 칼 든 쪽]
 */
export function updateFinish(f, dt) {
  const fin = f.finish;
  const foe = f.foe;
  fin.k ??= downReachK(f.weapon?.id); // 무기 배율 (한 판 동안 같다)
  fin.gap ??= { contact: FINISH.ai.contact * fin.k, reach: FINISH.ai.reach * fin.k, clinch: FINISH.ai.clinch * fin.k }; // AI 가 읽는 간격
  let on = false;
  if (foe && foe.state === 'down' && f.alive && f.armed && (f.state === 'stand' || f.state === 'kneel')) {
    const c = f.bodies.chest.translation();
    _c.set(c.x, c.y, c.z);
    _yawInv.copy(f.yaw).invert();
    // 날 없는 무기(나뭇가지·고무 닭·참치)나 부러진 칼은 머리를 내려찍는다: 둔기로 몸통을 치면 멍만 들고, 머리 충격만 기절시킨다
    const blunt = !f.weaponCfg.edged || f.weaponBroken;
    const p0 = foe.bodies[blunt ? 'head' : 'pelvis'].translation();
    const p1 = foe.bodies[blunt ? 'head' : 'chest'].translation();
    _a.set(p0.x, p0.y, p0.z).sub(_c).applyQuaternion(_yawInv);
    _b.set(p1.x, p1.y, p1.z).sub(_c).applyQuaternion(_yawInv);
    // 몸통 선(골반 → 가슴) 위에서 내 앞 ideal 거리의 점에 가장 가까운 곳 (수평면에서)
    const ex = _b.x - _a.x;
    const ez = _b.z - _a.z;
    const el2 = ex * ex + ez * ez;
    const ideal = FINISH.ideal * fin.k;
    const s = el2 > 1e-6 ? THREE.MathUtils.clamp(((ideal - _a.x) * ex + (0 - _a.z) * ez) / el2, 0, 1) : 0;
    _t.copy(_a).lerp(_b, s);
    const hd = Math.hypot(_t.x, _t.z);
    if (_t.x > FINISH.minFwd && hd < FINISH.range * fin.k) {
      on = true;
      fin.target[0] = _t.x;
      fin.target[1] = _t.y;
      fin.target[2] = _t.z;
      aimPoses(f, fin, _t);
    }
  }
  fin.on = on;
  fin.amt = THREE.MathUtils.clamp(fin.amt + (on ? dt / FINISH.rampIn : -dt / FINISH.rampOut), 0, 1);
}

/**
 * 겨눈 점 T(몸 기준) → 내려찍기·겨눔 자세의 손 위치와 칼끝 방향.
 * 칼끝 방향은 고정값이 아니라 "지금 손이 있는 곳에서 몸 밑 겨눈 점으로" 매 스텝 다시 잡는다(칼끝이 한 점을 노린다).
 * 팔은 손 목표를 곧게 따라가지 못하고 앞쪽으로 먼저 뻗는데(측정: 칼은 −73°인데 손은 −49°로 움직였다), 칼이 늘 한 점을
 * 겨누고 있으면 손이 어느 길로 가든 칼끝은 그 점을 향해 칼 축을 따라 들어간다 → 내리찌르기가 '찌르기'로 판정된다.
 */
function aimPoses(f, fin, T) {
  const cfg = f.weaponCfg;
  const L = cfg.hiltLength + cfg.bladeLength; // 손에서 칼끝까지
  const S = fin.strike;
  const H = fin.hover;
  const clamp = THREE.MathUtils.clamp;
  // 내려찍기 손: 칼날 hitAt 지점이 몸 겉면에 약 64° 기울기로 닿는 곳 (손이 닿을 수 있는 범위 안으로)
  const reach = cfg.hiltLength + FINISH.hitAt * cfg.bladeLength;
  const topY = T.y + FINISH.top;
  const sh = S.hand;
  sh[1] = clamp(topY + FINISH.steep * reach, FINISH.strikeY[0], FINISH.strikeY[1]);
  const dv = sh[1] - topY;
  sh[0] = clamp(T.x - Math.sqrt(Math.max(0, reach * reach - dv * dv)), FINISH.strikeFwd[0], FINISH.strikeFwd[1]);
  sh[2] = 0.06 + clamp(0.35 * T.z, -0.15, 0.2); // 옆으로 누운 쪽으로 조금 따라간다
  // 칼 선: 내려찍기 손에서 몸 중심 T 를 지나 sink 만큼 더 (몸 밑 땅속). 그 끝이 겨눈 점
  //  (T 바로 아래를 겨누면 선이 몸 윗면 높이에서 몸 앞을 지나가 버린다 — 측정: 가까이 누운 몸에서 칼이 몸 앞 땅을 쳤다)
  let dx = T.x - sh[0];
  let dy = T.y - sh[1];
  let dz = T.z - sh[2];
  let n = Math.hypot(dx, dy, dz);
  const ux = dx / n;
  const uy = dy / n;
  const uz = dz / n;
  const px = T.x + ux * FINISH.sink;
  const py = T.y + uy * FINISH.sink;
  const pz = T.z + uz * FINISH.sink;
  // 겨눔 손: 칼 선을 따라 뒤·위로 물린다. 칼끝이 몸 겉면보다 clear 만큼 위에 오도록
  //  (칼끝 높이 = 손 높이 + uy·L, 손 높이 = 내려찍기 손 − uy·back)
  const want = topY + FINISH.clear - uy * L;
  const back = clamp((want - sh[1]) / Math.max(0.2, -uy), FINISH.hoverBack[0], FINISH.hoverBack[1]);
  const hh = H.hand;
  hh[0] = Math.max(FINISH.hoverMinX, sh[0] - ux * back);
  hh[1] = Math.min(FINISH.hoverMaxY, sh[1] - uy * back);
  hh[2] = sh[2] - uz * back;
  // 겨눔 손이 물러날 수 있는 한계에 걸려 칼끝이 몸에 닿을 만큼 낮으면, 그만큼 칼끝을 들어 올린다 (고정 각도)
  dx = px - hh[0];
  dy = py - hh[1];
  dz = pz - hh[2];
  n = Math.hypot(dx, dy, dz);
  const elNom = Math.asin(clamp(dy / n, -1, 1));
  const elTip = Math.asin(clamp((topY + FINISH.clear - hh[1]) / L, -0.99, 0.99));
  const lift = Math.max(0, elTip - elNom);
  // 지금 손 위치 (칼자루, 몸 기준) → 겨눈 점으로
  const sp = f.sword.translation();
  _h.set(sp.x, sp.y, sp.z).sub(_c).applyQuaternion(_yawInv);
  dx = px - _h.x;
  dy = py - _h.y;
  dz = pz - _h.z;
  n = Math.hypot(dx, dy, dz);
  const sd = S.dir;
  sd[0] = dx / n;
  sd[1] = dy / n;
  sd[2] = dz / n;
  const hd = H.dir;
  if (lift > 0) {
    const el = Math.asin(clamp(sd[1], -1, 1)) + lift;
    const hz = Math.hypot(sd[0], sd[2]) || 1;
    const k = Math.cos(el) / hz;
    hd[0] = sd[0] * k;
    hd[1] = Math.sin(el);
    hd[2] = sd[2] * k;
  } else {
    hd[0] = sd[0];
    hd[1] = sd[1];
    hd[2] = sd[2];
  }
}
