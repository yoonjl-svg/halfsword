// ─────────────────────────────────────────────────────────────
//  약한 자세 겨눔 (늘 — 낮은 상대 진입과 한 묶음, 10/12 · 11/17 스위치 걷음: 전 FINISH.vital · VITAL.aiCut · thrust · playerCut · track)
//   사장님 10/12 02:3x 지시로 샛별 저장소 ccea5855 · fdc6a4ed · 07206655 · 8bbee803 의 뜻을 우리 코드에 옮겼다.
//   기록: docs/import/saetbyeol_vital_2026-10-12.md · 확인표 1001~1008 (사장님 확인 전). 묶음 켬 · 찌르기 켬 · AI 목 가로 베기 끔 · 플레이어 베기 보정 끔 (측정 §4)
//   — 끈 두 갈래(AI 목 가로 베기 준비 · 플레이어 느린 준비 베기 보정)는 11/17 코드째 걷음
//
//  뜻: 상대가 무릎 꿇음·일어나는 중·넘어지는 중(kneel·getup·down)이고 실제로 몸이 낮거나 기울었으면
//   · 찌르기(AI · 플레이어 탭)는 목·얼굴·머리로 (못 겨누면 보통처럼 가슴) — 겨누는 동안은 상대 머리에 붙은 점을 따라가다 뻗을 때 고정
//   · 완전히 낮은 몸(누움)은 내려찍기(finish.js)가 맡는다 — 같은 높이 문턱(LOW_FINISH)
//  힘·빠르기·피해 배율·즉사·확률은 하나도 바꾸지 않는다. 겨눌 곳과 준비만 바꾼다. 맞느냐·뚫느냐는 충돌·갑옷·상처 문턱 그대로.
//  아래 길이·각 예산은 게임 설계값이다 (사람 실측 한계가 아니다 — 샛별 쪽 값 그대로).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { ARM, THRUST, realS } from './config.js';
import { guardAt } from './guards.js';
import { FINISH } from './finish.js';
import { LOW_FINISH } from './finish_entry.js';

export const VITAL = {
  faceLocalX: 0.075, // 얼굴 점: 머리 몸체 기준 앞 (m)
  faceLocalY: -0.025, // 얼굴 점: 머리 몸체 기준 아래 (m)
  guardRadius: 0.14, // 상대 칼이 목표 앞 마지막 길을 이만큼 안에서 가리면 겨누지 않는다 (m)
  guardNearTarget: 0.34, // 상대 칼이 목표에서 이만큼 안에 있을 때만 가림을 본다 (m)
  minForward: 0.2, // 목표가 내 가슴 앞 이만큼은 있어야 (m)
  maxSideRatio: 0.85, // 옆 / 앞 비율 한도
  reachSlack: 0.04, // 닿는 거리 여유 (m)
  minimumChestDrop: 0.12, // 상대 가슴이 내 가슴보다 이만큼 낮거나 (m)
  maximumUprightCos: Math.cos(Math.PI / 6), // 상체가 30° 넘게 기울었어야 (똑바로 선 채 낮추기만 한 상대는 아니다)
  // 무기별 간격 (샛별 8bbee803, 플레이어 탭 찌르기): 칼끝이 목표 바로 앞에 오도록 걸어 맞춘 뒤 찌른다
  rangeTravel: 1, // 목표가 닿는 거리보다 이만큼(m) 멀어도 겨눈다 (걸어 들어간다)
  rangeTimeout: realS(2), // (실제 초 — 표준 시간 10/25) 간격 맞추기 최대 (s)
  rangeAlignCos: Math.cos((20 * Math.PI) / 180), // 칼 축이 목표 쪽 20° 안
  rangeLineMiss: 0.07, // 칼 선이 목표를 비껴가는 거리 한도 (m)
  manualDead: 0.15, // 조이스틱을 이만큼 넘게 밀면 간격 맞추기를 거둔다
};

const clamp = THREE.MathUtils.clamp;
const xyz = (v) => ({ x: v.x, y: v.y, z: v.z });
const vec = (v) => new THREE.Vector3(v.x, v.y, v.z);
const finite = (v) => !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
const quat = (q) => new THREE.Quaternion(q.x, q.y, q.z, q.w);

/** 상대 모습 사본 (AI 는 반응 지연 기록에 넣어 늦게 본다 — ai_sense.js). 살아 있는 몸 참조를 담지 않는다 · 부를 때마다 새 사본 */
export function captureVitalPose(f) {
  return captureVitalPoseInto(f, newVitalPose());
}

const P3 = () => ({ x: 0, y: 0, z: 0 });
const put3 = (o, v) => ((o.x = v.x), (o.y = v.y), (o.z = v.z), o);
const put4 = (o, q) => ((o.x = q.x), (o.y = q.y), (o.z = q.z), (o.w = q.w), o);
/** 다시 쓰는 사본 칸 (ai_sense.js 기록 칸마다 하나 — 11/21 감사 N-010 (d): 스텝마다 객체 열둘을 새로 만들지 않음). pose 의 칸 · 차례는 captureVitalPose 의 사본과 같다 */
export function newVitalPose() {
  return {
    pose: {
      targetId: 0, state: '', alive: false, armed: false, headOff: false,
      head: P3(), chest: P3(), pelvis: P3(), headQ: { x: 0, y: 0, z: 0, w: 1 }, chestQ: { x: 0, y: 0, z: 0, w: 1 },
      headRadius: 0, hasHelmet: false, neck: P3(), face: P3(), bladeBase: null, bladeTip: null,
    },
    bladeBase: P3(),
    bladeTip: P3(),
  };
}
const _lpV = new THREE.Vector3(), _lpP = new THREE.Vector3(), _lpQ = new THREE.Quaternion(), _bpV = new THREE.Vector3();
/** 머리 몸체 틀의 점 (x, y, z) → 세계 점을 o 에 (임시 객체 없이 — 예전 localPoint 와 같은 셈) */
function localPointInto(o, p, q, x, y, z) {
  return put3(o, _lpV.set(x, y, z).applyQuaternion(_lpQ.set(q.x, q.y, q.z, q.w)).add(_lpP.set(p.x, p.y, p.z)));
}
/** 상대 모습을 칸 slot(newVitalPose)에 적고 slot.pose 를 돌려준다 (몸이 없으면 null). 값은 captureVitalPose 의 새 사본과 같다 */
export function captureVitalPoseInto(f, slot) {
  if (!f?.bodies?.head || !f.bodies.chest || !f.bodies.pelvis) return null;
  const o = slot.pose;
  const head = put3(o.head, f.bodies.head.translation());
  const headQ = put4(o.headQ, f.bodies.head.rotation());
  put4(o.chestQ, f.bodies.chest.rotation());
  o.targetId = f.index;
  o.state = f.state;
  o.alive = !!f.alive;
  o.armed = !!f.armed;
  o.headOff = !!f.decapitated;
  put3(o.chest, f.bodies.chest.translation());
  put3(o.pelvis, f.bodies.pelvis.translation());
  o.headRadius = f.headR;
  o.hasHelmet = !!f.hasHelmet;
  // 목 점: 우리 목 구역 가운데 (finish.js FINISH.neckAt — 머리 몸체 아래 −0.10 ~ 투구 끝 −0.01 의 가운데)
  localPointInto(o.neck, head, headQ, 0, FINISH.neckAt, 0);
  localPointInto(o.face, head, headQ, VITAL.faceLocalX, VITAL.faceLocalY, 0);
  o.bladeBase = f.armed ? put3(slot.bladeBase, f.bladePoint(0, _bpV)) : null;
  o.bladeTip = f.armed ? put3(slot.bladeTip, f.bladePoint(1, _bpV)) : null;
  return o;
}

function pointSegmentDistance(p, a, b) {
  const d = vec(b).sub(vec(a));
  const t = clamp(vec(p).sub(vec(a)).dot(d) / Math.max(d.lengthSq(), 1e-12), 0, 1);
  return vec(a).addScaledVector(d, t).distanceTo(vec(p));
}

/** 상대 칼이 목표 바로 앞 길을 가리나 (겨누지 않을 뿐 — 충돌을 대신하지 않는다) */
function vitalBlocked(origin, target, snap) {
  const a = snap?.bladeBase;
  const b = snap?.bladeTip;
  if (!snap?.armed || !finite(a) || !finite(b)) return false;
  if (pointSegmentDistance(target, a, b) > VITAL.guardNearTarget) return false;
  const T = vec(target);
  const start = T.clone().lerp(vec(origin), Math.min(1, 0.45 / Math.max(1e-6, T.distanceTo(vec(origin)))));
  for (let i = 0; i <= 8; i++) if (pointSegmentDistance(start.clone().lerp(T, i / 8), a, b) <= VITAL.guardRadius) return true;
  return false;
}

/** 찌르기 겨눔 후보 (샛별 07206655): 머리 공 안쪽 점들 + 목. 투구가 덮지 않은 길 → 가운데 → 지금 칼 축과 가까운 순 */
function thrustCandidates(snap, origin, axis) {
  const radius = snap.headRadius;
  if (!Number.isFinite(radius) || radius <= 0 || axis.lengthSq() < 0.5) return [];
  const center = vec(snap.head);
  const from = vec(origin);
  const dir = axis.clone().normalize();
  const rotation = quat(snap.headQ);
  const inset = radius * 0.65;
  const projected = from.clone().addScaledVector(dir, Math.max(0, center.clone().sub(from).dot(dir)));
  const offset = projected.sub(center);
  const points = [
    ['head', center.clone(), 0],
    ...[[0.45, -0.35, 0], [-0.45, -0.35, 0], [0, -0.35, 0.45], [0, -0.35, -0.45]].map((a) => ['head', center.clone().add(new THREE.Vector3(...a).multiplyScalar(radius).applyQuaternion(rotation)), 0]),
    ...[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map((a) => ['head', center.clone().addScaledVector(new THREE.Vector3(...a), inset), 1]),
  ];
  if (offset.length() <= radius * 0.35) points.unshift(['head', center.clone().add(offset), 0]);
  points.push(['neck', vec(snap.neck), 0]);
  const inv = rotation.clone().invert();
  return points
    .map(([zone, point, fallback]) => {
      const ray = point.clone().sub(from);
      if (ray.lengthSq() <= 1e-12) return null;
      ray.normalize();
      const toCenter = center.clone().sub(from);
      const along = toCenter.dot(ray);
      const disc = along * along - (toCenter.lengthSq() - radius * radius);
      const entry = disc >= 0 ? along - Math.sqrt(disc) : -1;
      const covered = snap.hasHelmet && entry >= 0 && from.clone().addScaledVector(ray, entry).sub(center).applyQuaternion(inv).y > -0.01;
      return { zone, point, fallback, covered: !!covered, alignment: ray.dot(dir) };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.covered) - Number(b.covered) || a.fallback - b.fallback || b.alignment - a.alignment);
}

/**
 * 약한 자세 빈틈 찾기. 상대는 snap 만 읽는다 (AI 는 늦게 본 기록). 내 몸은 지금 것.
 * @param kind 'cut' | 'thrust'
 * @param extra 찌르기에서 닿는 거리 밖으로 더 볼 거리 (플레이어 간격 맞추기 VITAL.rangeTravel)
 * @returns { target: Vector3(세계), zone, kind, targetId } | null
 */
export function findVital(att, snap, kind, extra = 0) {
  if (!att.alive || !att.armed || att.weapon?.gun || att.weaponBroken || (att.state !== 'stand' && att.state !== 'kneel')) return null;
  if (!snap?.alive || snap.headOff || !['kneel', 'down', 'getup'].includes(snap.state)) return null;
  const cfg = att.weaponCfg;
  if (kind === 'cut' && (!cfg.edged || !(cfg.mCut > 0))) return null;
  if (kind === 'thrust' && (!(cfg.edged || cfg.spike) || !(cfg.mThrust > 0))) return null;
  if (kind !== 'cut' && kind !== 'thrust') return null;
  if (![snap.head, snap.chest, snap.pelvis, snap.neck].every(finite)) return null;
  const chest = att.bodies.chest.translation();
  // 이름만 바뀐 넘어짐은 아니다: 가슴이 실제로 낮거나 상체가 30° 넘게 기울었어야
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat(snap.chestQ));
  if (snap.chest.y > chest.y - VITAL.minimumChestDrop && up.y > VITAL.maximumUprightCos) return null;
  // 내려찍기가 맡는 몸은 건드리지 않는다 (낮은 상대 진입의 같은 문턱)
  const top = Math.max(snap.chest.y, snap.pelvis.y);
  const ground = att.terrain ? att.terrain.heightAt(snap.pelvis.x, snap.pelvis.z) : 0; // 지형 무대(화산섬): 상대 골반 밑 땅 위 높이로 (finish_entry 와 같은 문턱)
  const lowBody = (att.terrain ? top - ground : top) <= LOW_FINISH.enterHeight && top + LOW_FINISH.minimumDrop < chest.y;
  const finishOwns = (snap.state === 'down' || snap.state === 'getup') && lowBody;
  if (finishOwns) return null;
  const yaw = att.yaw;
  const cq = att.bodies.chest.rotation();
  const shoulder = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * (att.side ?? 1)).applyQuaternion(quat(cq)).add(vec(chest));
  const reach = ARM.upper + ARM.fore - ARM.slack + cfg.hiltLength + cfg.bladeLength + VITAL.reachSlack + (kind === 'thrust' ? extra : 0);
  const origin = xyz(att.sword.translation());
  const inv = yaw.clone().invert();
  let cands;
  if (kind === 'thrust') {
    const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat(att.sword.rotation()));
    cands = thrustCandidates(snap, origin, axis).map((p) => [p.zone, p.point]);
  } else cands = [['neck', vec(snap.neck)]];
  for (const [zone, point] of cands) {
    if (!finite(point)) continue;
    const local = point.clone().sub(vec(chest)).applyQuaternion(inv);
    if (local.x < VITAL.minForward || Math.abs(local.z) > local.x * VITAL.maxSideRatio) continue;
    if (shoulder.distanceTo(point) > reach || vitalBlocked(origin, point, snap)) continue;
    return { target: point.clone(), zone, kind, targetId: snap.targetId };
  }
  return null;
}

/** 이 무기로 노릴 것: 찌르기 기술이면 찌르기, 아니면 베기 (찌르기 배율이 더 큰 무기는 찌르기) */
export function vitalWeaponKind(me, tech = null) {
  if (me.weapon?.gun || me.weaponBroken) return null;
  const cfg = me.weaponCfg;
  if (!cfg) return null;
  if (tech?.kind === 'thrust') return (cfg.edged || cfg.spike) && cfg.mThrust > 0 ? 'thrust' : null;
  if (!cfg.edged || !(cfg.mCut > 0)) return null;
  if (!tech && cfg.mThrust > cfg.mCut) return 'thrust';
  return 'cut';
}

// ── AI (ai.js 가 부른다 — 상대는 반응 지연 기록 s.vital 만 본다) ─────────

/** 지금 노릴 빈틈 (AI). 상대 칼끝이 나를 겨누면(online) 들어가지 않는다 — 보통 공격 규칙 그대로. 찌르기만 (AI 목 가로 베기 갈래는 11/17 걷음) */
export function aiVitalCandidate(ai, s, tech = null) {
  const snap = s?.vital;
  if (!snap || ai.me.skill?.tap || ai.me.finish?.amt > 0 || (snap.armed && ai.foeClass(s).online)) return null;
  if (vitalWeaponKind(ai.me, tech) !== 'thrust') return null;
  return findVital(ai.me, snap, 'thrust');
}

/** 공격 준비: 찌를 목·얼굴·머리 점 (치는 순간 ai.js startStrike 가 고정한다) */
export function aiVitalPrepare(ai, s, tech) {
  const found = aiVitalCandidate(ai, s, tech);
  return found ? { ...found, started: false } : null;
}

// ── 탭 찌르기 (skill.js) ─────────

/** 탭 찌르기가 겨눌 급소 (플레이어: 지금 모습, extra = 걸어 맞출 거리) */
export function playerVitalThrust(f, extra = 0) {
  if (!f.foe) return null;
  return findVital(f, captureVitalPose(f.foe), 'thrust', extra);
}

/** 무기별 간격 (샛별 8bbee803 measureThrustDistance): 칼끝이 목표 바로 앞에 오는 거리인가 · 칼 축이 목표 쪽인가 · 앞뒤로 얼마나 */
export function measureThrustRange(f, target) {
  const bad = { valid: false, ready: false, aligned: false, move: 0 };
  if (!target || !f?.sword || !finite(target)) return bad;
  const grip = vec(f.sword.translation());
  const ray = vec(target).sub(grip);
  const distance = ray.length();
  if (!(distance > 0.01)) return bad;
  ray.divideScalar(distance);
  const c = f.bodies.chest.translation();
  const shoulder = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], ARM.shoulder[2] * (f.side ?? 1)).applyQuaternion(quat(f.bodies.chest.rotation())).add(vec(c));
  const off = grip.clone().sub(shoulder);
  const dot = off.dot(ray);
  const R = ARM.upper + ARM.fore - ARM.slack;
  const disc = dot * dot + R * R - off.lengthSq();
  const armTravel = disc < 0 ? 0 : Math.max(0, -dot + Math.sqrt(disc));
  const reach = Math.min(THRUST.reach + (f.weaponCfg.thrustStyle?.reach ?? 0), armTravel);
  const L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
  const min = L - Math.min(0.06, THRUST.chamber * 0.5);
  const max = L + Math.max(0.035, reach * 0.65);
  const error = distance - (min + max) * 0.5;
  const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(quat(f.sword.rotation()));
  const alignment = axis.dot(ray);
  const lineMiss = distance * Math.sqrt(Math.max(0, 1 - alignment * alignment));
  const forward = f.forward(new THREE.Vector3());
  const proj = ray.dot(forward);
  const valid = proj > 0.25;
  const ready = valid && distance >= min && distance <= max;
  const move = !valid || ready ? 0 : Math.sign(error) * clamp((Math.abs(error) * 2) / Math.max(0.5, proj), 0.18, 0.65);
  // 샛별 조건 그대로 (각 20° + 표적 선 7 cm). 우리 칼은 버티는 동안 약 6° 처져(선 12 cm) 가만히 무릎 꿇은 상대에선 2 s 를 넘기기 쉽다 → 보통 찌르기로 넘어감.
  //  선 조건을 뺀 판을 재 봤다: 판금 크게 넘어뜨림 24 판 탭 마무리 8 → 4 · 급소 찌르기 헛침 31 → 36 % (맨몸 36 → 43 %) — 그래서 그대로 둠 (문서 §3)
  return { valid, ready, aligned: alignment >= VITAL.rangeAlignCos && lineMiss <= VITAL.rangeLineMiss, move, distance, min, max, alignment, lineMiss };
}
