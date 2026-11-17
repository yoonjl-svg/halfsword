// ─────────────────────────────────────────────────────────────
//  이탈리아 아웃복싱 — 칼끝으로 거리를 재고, 걸어 들어오는 상대를 그 박자에 찌른다 (사장님 11/14 '이탈리아는 아웃복싱 스타일이야. 너의 제안과 목표는 같아.
//   '찌르기' 자체를 너프하자. 지금보다 약하게 하고 대신 타이밍을 맞춰서 걸어들어오는 상대를 카운터하면 +30%. 제안 A와 B 좋아.' — 값 config IT_OUTBOX ·
//   설계안 docs/design/italian_point_control_2026-11-14.md · 기록 docs/strike/it_outbox_2026-11-14.md).
//  이탈리아 몸(무기 유파 italian) — 사람 · AI 같게 (사장님 11/14 'ai에도 적용').
//   AI 몫: 1 · 2 = AI 찌르기 기술(빼서 찌르기 패시브 = 칼끝 돌려 빼기 · 비껴서며 찌르기 = 특수) · 3 = AI 빼서 찌르기 · 비껴서며 찌르기가 상처를 내면 · 헛누름이 들면 칼 우위(AI 는 리솔루토가 없어 —
//   SECRET.aiOpenSchools — 칼 우위는 빛 · 재기만)만)
//   1 찌르기 약하게 — itThrust: 보통 찌르기(탭 찌르기 · 내려 찌르기 · 칼끝 돌려 빼기 · 그어 찌르기 · 막아찌르기)의 판정 에너지 × thrustMul.
//      자리 = combat.js analyze 의 hk(비기 배율 secretHit — SECRET.risolutoHitMul 과 같은 자리 · 칼날 상처 · 둔타 모두 그 에너지에서 · 물리 빠르기 · 질량은 그대로).
//      비기(리솔루토)는 빼고 · 특수 공격(비껴서며 찌르기)도 빼고(제 칼끝 빠르기 몫 specialShare 가 따로).
//   2 맞박자 찌르기 — 같은 자리에 × (1 + stop): 찌르기가 드는 순간 상대가 내 쪽으로 걸어 들어오는 중(foeWalkingIn)이면. 몫 열쇠 itTempo(새 패시브 칸 대기 — 지금은 I1).
//      보통 찌르기 = thrustMul × (1 + stop) (0.8 × 1.3 = 1.04) · 비껴서며 찌르기 = 1 × (1 + stop) (stopSpecial) · 비기 = 받지 않음.
//      원전: 카포 페로 『Gran Simulacro』(1610) 쓰임 10 「Del ferire di contratempo」(원판 30쪽) — 상대가 칼을 얻으러 오른발을 옮기는 바로 그 박자에 찌른다.
//   3 칼 우위 (설계안 A) — itOnStrike · itEdgeGrant: I2 · I6 · I9 가 상처를 내면 · I8 헛누름이 들면 edge 초. 리솔루토 창은 칼 우위 동안만(itEdgeOk — secret.js risoTick).
//  재기(판정엔 안 씀): 몸의 itOut { edge 켜진 수 · by 갈래 · stopHits 맞박자 맞음 · thrustHits 약해진 찌르기 맞음 · risoWait 칼 우위 없어 리솔루토 셈이 기다린 시간 }
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { IT_OUTBOX as IO, GAIT } from './config.js';
import { kitOff } from './skill_kit.js';

const isIt = (f) => f?.swordArt?.tradition === 'italian';

/** 견줌 대상인 몸인가: 이탈리아 (사람 · AI) */
export function itBody(f) {
  return isIt(f);
}

/** 재기 칸 (사람 몸 — 판마다 새 몸) */
export function itStats(f) {
  return (f.itOut ??= { edge: 0, by: {}, stopHits: 0, thrustHits: 0, risoWait: 0 });
}

/**
 * 지금 이 몸이 내는 찌르기 갈래 (판정은 맞는 순간 — combat.js analyze · strike):
 *  'secret' 비기(리솔루토 — 비기 실행 · 비기 배율이 걸림) · 'special' 비껴서며 찌르기(I9 운동학 칼 · 그 이름의 탭) · 'cav' 칼끝 돌려 빼기(I2) · 'tap' 탭 찌르기(내려 찌르기 덧씌우기 포함) ·
 *  'opp' 막아찌르기(I6) · 'stroke' 사람 긋기가 찌르기로 읽힘 · 'ai' AI 찌르기 기술 · null = 찌르기 아님(베기 · 둔기 · 다른 운동학 칼)
 */
export function itThrustKind(f) {
  const sk = f.skill;
  if (f.aiControlled) {
    const c = f.aiCtl;
    if (!c || c.secretRun || f.stamina?.inSecret) return c?.secretRun ? 'secret' : null;
    if (f.iai?.tech === 'inquartata') return 'special'; // 11/15 AI 비껴서며 찌르기 = 사람과 같은 운동학 칼 (UNIQUE_ASSIST.inqAi — ai.js inqGo · 끄는 동안 · 공격 꼴이 바뀌어도)
    // 11/15 고침: 공격 · 찌르기 기술 줄을 탭 줄보다 먼저 — AI 레이피어 찌르기는 탭 길(ai.js startStrike → skill.thrust)이라 전엔 비껴서며 찌르기 · 빼서 찌르기도 'ai' 로 읽힘
    //  (상처를 내도 칼 우위가 안 켜지고 비껴서며 찌르기에 × thrustMul — 11/14 결정 '사람 · AI 같게'와 어긋남 · 기록 docs/strike/it_ai_i9_2026-11-15.md §4)
    if (c.mode === 'attack' && (c.phase === 'strike' || c.phase === 'follow') && c.tech?.kind === 'thrust') return c.tech.name === 'inquartata' ? 'special' : c.passiveAtk === 'cavazione' ? 'cav' : 'ai'; // 빼서 찌르기 패시브(AI 칼끝 돌려 빼기 — 칼이 맞물린 뒤)
    if (sk?.tap) return 'ai'; // 기술 밖 탭 (쓰러진 상대 찍기 등)
    return null;
  }
  if (f.stamina?.inSecret || sk?.sec || f.iai?.secret || (f.secretHit ?? 1) !== 1) return 'secret';
  if (f.iai?.tech) return f.iai.tech === 'cavazione' ? 'cav' : f.iai.tech === 'inquartata' ? 'special' : null;
  if (sk?.tap) return sk.tap.uniqTech === 'inquartata' ? 'special' : sk.tap.uniqTech === 'cavazione' ? 'cav' : 'tap';
  if (f.parryGuard?.opposition?.run) return 'opp';
  const st = f.stamina;
  const s = st?.stroke?.paid ? st.stroke : st?.strokeTail?.paid && st.time <= st.strokeTail.until ? st.strokeTail : null;
  return s?.kind === 'thrust' ? 'stroke' : null;
}

/**
 * 상대가 내 쪽으로 걸어 들어오는 중인가 (2 맞박자 찌르기 — 사장님 11/14 '걸어들어오는 상대'): 상대가 서 있고 · 걷는 중(gait.walking — 걸음 단계 · stopWalk) ·
 *  상대 골반 수평 빠르기의 내 쪽 몫 ≥ stopV (null = GAIT.walkMin — 걸음 문턱). 읽기만
 */
export function foeWalkingIn(me, foe) {
  if (!foe?.alive || foe.state !== 'stand') return false;
  if (!foe.gait?.walking) return false;
  // 물리 스텝 직전 상태(fighter.cacheState — 충돌 훅 안에서 엔진을 건드리지 않게 · combat.js predict 와 같은 까닭) · 없으면(도구 · 시험) 지금 몸
  const pa = me?.cache?.parts?.pelvis;
  const pb = foe.cache?.parts?.pelvis;
  const a = pa ? pa.p : me?.bodies?.pelvis?.translation();
  const b = pb ? pb.p : foe.bodies?.pelvis?.translation();
  const v = pb ? pb.v : foe.bodies?.pelvis?.linvel();
  if (!a || !b || !v) return false;
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  const L = Math.hypot(dx, dz);
  if (L < 1e-6) return false;
  return (v.x * dx + v.z * dz) / L >= GAIT.walkMin;
}

/**
 * 판정 배율 (combat.js analyze 의 hk — 비기 배율 secretHit 과 같은 자리 · 예측 길에서도 부름 · 읽기만): 견줌 대상이 아니거나 배율 1 이면 null(전 판 그대로).
 *  → { k, kind, stop } — k = (보통 찌르기면 thrustMul) × (맞박자면 1 + stop)
 */
export function itThrust(att, vic) {
  if (!itBody(att)) return null;
  const kind = itThrustKind(att);
  if (!kind || kind === 'secret') return null;
  let k = kind === 'special' ? IO.inqMul ?? 1 : IO.thrustMul; // 비껴서며 찌르기 배율 (11/15 시제품 — IT_OUTBOX.inqMul · 기본 1 = 그대로 · 사람 · AI 같게)
  const stop = IO.stop > 0 && !kitOff(att, 'itTempo') && vic === att.foe && foeWalkingIn(att, vic);
  if (stop) k *= 1 + IO.stop;
  return k === 1 && !stop ? null : { k, kind, stop };
}

/** 칼 우위인가 (3 — 몸 시계 fightT 로: 켜진 때 + edge) */
export function itEdgeOn(f) {
  return !!f?.itEdge && f.fightT < f.itEdge.until - 1e-9;
}

/** 리솔루토 창을 열어도 되나 (secret.js risoTick — 지금 조건에 더함): 칼 우위 끔이면 늘 참 */
export function itEdgeOk(f) {
  return !(IO.edge > 0) || itEdgeOn(f);
}


/** 칼 우위 켬 (사람 이탈리아만 · why = 'cav' I2 · 'opp' I6 · 'special' I9 · 'feint' I8 헛누름) — 켜진 동안 다시 들면 그때부터 다시 edge 초 */
export function itEdgeGrant(f, why) {
  if (!(IO.edge > 0) || !itBody(f)) return false;
  f.itEdge = { until: (f.fightT ?? 0) + IO.edge, why, t0: f.fightT ?? 0 };
  const S = itStats(f);
  S.edge++;
  S.by[why] = (S.by[why] ?? 0) + 1;
  return true;
}

/**
 * 맞음이 상처로 들어감 (combat.js strike — applyWound 뒤 · 사람 이탈리아만 · AI 판은 곧장 돌아감): 재기 · 칼 우위(I2 · I6 · I9 가 상처를 냄).
 *  r.itThrust = analyze 가 붙인 배율 (없으면 지금 갈래를 다시 읽음)
 */
export function itOnStrike(att, vic, r) {
  if (!itBody(att) || vic !== att.foe) return;
  const S = itStats(att);
  if (!(r.severity > 0)) return;
  if (r.itThrust?.stop) S.stopHits++;
  if (r.itThrust && r.itThrust.kind !== 'special') S.thrustHits++;
  const kind = r.itThrust?.kind ?? itThrustKind(att);
  if (kind === 'cav' || kind === 'opp' || kind === 'special') itEdgeGrant(att, kind);
}

/**
 * 칼 우위 빛 (main.js 프레임마다 — 그림만 · 물리 · 판정 · 난수 무관): 칼 우위 동안 칼날 둘레에 옅은 빛 판(덧셈 섞기) · 남은 시간 마지막 0.5 s 에 옅어짐.
 *  칼 그림(swordGroup)에 한 번 만들어 붙이고 보이기 · 투명도만 바꾼다. 칼이 부러지거나 없으면 숨김
 */
export function itEdgeLook(f, T = THREE) {
  if (!f?.swordGroup) return;
  const on = itEdgeOn(f) && f.armed && !f.weaponBroken;
  let g = f.itEdgeMesh;
  if (!g) {
    if (!on) return;
    const W = f.weaponCfg;
    const len = W?.bladeLength ?? 0.9;
    const mat = new T.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
    g = new T.Group();
    for (const rz of [0, Math.PI / 2]) {
      const m = new T.Mesh(new T.PlaneGeometry(0.05, len), mat);
      m.rotation.y = rz;
      g.add(m);
    }
    g.position.y = (W?.hiltLength ?? 0) + len / 2;
    g.userData.mat = mat;
    f.swordGroup.add(g);
    f.itEdgeMesh = g;
  }
  g.visible = on;
  if (on) {
    const left = f.itEdge.until - f.fightT;
    g.userData.mat.opacity = 0.32 * Math.min(1, left / Math.max(1e-3, Math.min(0.5, IO.edge)));
  }
}
