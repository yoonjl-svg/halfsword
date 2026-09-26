// ─────────────────────────────────────────────────────────────
//  칼이 몸에 닿는 순간의 물리
//
//  1) 닿은 지점에서 "칼의 그 점"과 "몸의 그 점"의 속도 차이를 구한다.
//  2) 칼이 어떤 모양으로 닿았는지 본다.
//       - 칼끝 쪽으로 곧게 들어가면 → 찌르기
//       - 날 선 쪽이 앞장서면       → 베기
//       - 칼 면이나 손잡이로 닿으면 → 둔기(타박)
//  3) 운동 에너지(J) = ½ × 유효질량 × 속도²  를 부위별 문턱값과 비교해서 상처를 만든다.
//  4) 에너지가 충분하면 칼이 살을 가르고 "지나간다". (충돌 훅으로 튕겨내는 힘을 끄고,
//     몸이 흡수한 만큼만 칼을 느리게 한다.) 모자라면 박히거나 튕긴다.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { WEAPON, STRIKE, ANATOMY } from './config.js';

const Y = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _d = new THREE.Vector3();
const _e = new THREE.Vector3();
const _q = new THREE.Quaternion();

const BLADE_START = 0.13; // 칼자루 중심에서 칼날이 시작하는 거리

/** 강체 상태(p, q, com, v, w)에서 한 점의 속도 */
function velAt(st, point, out) {
  return out.copy(point).sub(st.com).cross(st.w).negate().add(st.v); // v + w × r
}

/** 부위 이름 + 부위 기준 위치 → 해부학적 구역 */
function zoneOf(info, local) {
  if (info.kind === 'head') return local.y < -0.05 ? 'neck' : 'head';
  if (info.kind === 'chest') return local.y > 0.11 ? 'neck' : 'chest';
  return info.kind; // pelvis | arm | leg
}

export class Combat {
  /**
   * @param {object} hooks  { onWound(attacker, victim, result, point), onClash(point, speed), onBlocked(...) }
   */
  constructor(colliderInfo, hooks) {
    this.info = colliderInfo;
    this.hooks = hooks;
    this.cutting = new Map(); // "칼콜라이더:몸콜라이더" → { seen, applied, until }
    this.stepNo = 0;
    // Rapier 물리 훅: 칼과 상대 몸이 부딪히려 할 때마다(매 스텝) 불린다.
    // 여기서는 엔진 함수를 부르면 안 되므로, 스텝 직전에 저장해 둔 값(cacheState)만 쓴다.
    this.physicsHooks = {
      filterContactPair: (c1, c2) => this.filterContactPair(c1, c2),
      filterIntersectionPair: () => true,
    };
  }

  pairOf(c1, c2) {
    const a = this.info.get(c1);
    const b = this.info.get(c2);
    if (!a || !b || a.fighter === b.fighter) return null;
    if (a.kind === 'weapon' && b.kind !== 'weapon') return { w: a, v: b, wc: c1, vc: c2 };
    if (b.kind === 'weapon' && a.kind !== 'weapon') return { w: b, v: a, wc: c2, vc: c1 };
    return null;
  }

  filterContactPair(c1, c2) {
    const pr = this.pairOf(c1, c2);
    if (!pr || pr.w.part !== 'blade') return 1; // 1 = 평소처럼 부딪힘
    const key = `${pr.wc}:${pr.vc}`;
    let cut = this.cutting.get(key);
    if (cut) {
      cut.seen = this.stepNo;
      return 0; // 0 = 부딪히는 힘 없음 → 칼이 살을 가르고 지나감
    }
    // 아직 안 닿았으면: 지금 속도로 닿는다면 가를 수 있는지 예측
    const res = this.predict(pr);
    if (res && res.pass) {
      this.cutting.set(key, { seen: this.stepNo, applied: false, pr, wc: pr.wc, vc: pr.vc });
      return 0;
    }
    return 1;
  }

  /** 스텝 전 저장값으로, 칼날 위에서 몸 부위 중심에 가장 가까운 점을 접촉점으로 가정해 분석 */
  predict(pr) {
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    if (!att.cache || !vic.cache) return null;
    const S = att.cache.sword;
    const P = vic.cache.parts[pr.v.part];
    const a = _a.set(0, BLADE_START, 0).applyQuaternion(S.q).add(S.p);
    const b = _b.set(0, BLADE_START + WEAPON.length, 0).applyQuaternion(S.q).add(S.p);
    const ab = _c.subVectors(b, a);
    const t = THREE.MathUtils.clamp(_d.subVectors(P.com, a).dot(ab) / ab.lengthSq(), 0, 1);
    const point = _e.copy(a).addScaledVector(ab, t);
    return this.analyze(pr, point, S, P, true);
  }

  /**
   * 핵심 분석. S/P = 칼/부위의 상태 { p, q, com, v, w }
   * @returns {{type, zone, energy, severity, pass, absorb, local, dir, t, helmet, speed}}
   */
  analyze(pr, point, S, P, predicting = false) {
    const vBlade = velAt(S, point, new THREE.Vector3());
    const vBody = velAt(P, point, new THREE.Vector3());
    const rel = vBlade.sub(vBody);
    const speed = rel.length();
    if (speed < 0.5) return null;
    // 사람이 휘두르는 칼은 칼끝도 초속 20m 남짓. 그보다 빠르면 물리 계산이 튄 것이니 무시한다
    if (speed > 22) return null;
    const dir = rel.clone().divideScalar(speed);

    // 칼 기준 축: y = 칼끝 방향, x = 날 방향, z = 칼 면(납작한 쪽)
    const axis = _a.copy(Y).applyQuaternion(S.q);
    const edge = _b.copy(X).applyQuaternion(S.q);
    const local = point.clone().sub(S.p).applyQuaternion(_q.copy(S.q).invert());
    const t = THREE.MathUtils.clamp((local.y - BLADE_START) / WEAPON.length, 0, 1);
    const isBlade = pr.w.part === 'blade' && local.y > BLADE_START - 0.01;

    // 유효 질량: 칼끝으로 칠수록 가볍게(회전 중심에서 멀수록 실어 보내는 질량이 줄어든다) + 팔·몸의 도움
    const mEff = WEAPON.mass * (0.35 + 0.45 * (1 - t)) + STRIKE.armAssist;
    const energy = 0.5 * mEff * speed * speed;

    let type = 'blunt';
    let quality = 1;
    const along = rel.dot(axis) / speed;
    if (isBlade) {
      if (along > STRIKE.stabAlign && t > 0.8) type = 'stab';
      else {
        const perp = rel.clone().addScaledVector(axis, -rel.dot(axis));
        const pl = perp.length();
        const edgeAlign = pl > 1e-3 ? Math.abs(perp.dot(edge)) / pl : 0;
        if (edgeAlign > STRIKE.edgeAlign) {
          type = 'cut';
          quality = (edgeAlign - STRIKE.edgeAlign) / (1 - STRIKE.edgeAlign); // 날이 똑바로 설수록 잘 베인다
          quality = 0.4 + 0.6 * quality;
          // 칼날 길이 방향으로 미끄러지며 벨수록(당겨 베기) 잘 들고, 칼날 손잡이 쪽은 덜 든다
        }
      }
    }

    // 맞은 곳
    const vicLocal = point.clone().sub(P.p).applyQuaternion(_q.copy(P.q).invert());
    const zone = zoneOf(pr.v, vicLocal);
    const vic = pr.v.fighter;
    // 투구: 머리 윗부분(눈썹 위)만 덮는다
    const helmet = zone === 'head' && vic.hasHelmet && vicLocal.y > -0.01;
    const A = helmet ? { ...ANATOMY.head, ...ANATOMY.helmet } : ANATOMY[zone];
    // 막아주는 정도: 투구는 찌그러질수록, 옷은 찢어질수록 약해진다
    let guard = 1;
    let helmetBlunt = 1;
    if (helmet) {
      const hi = vic.helmetIntegrity;
      guard = 0.25 + 0.75 * hi;
      helmetBlunt = ANATOMY.helmet.blunt + (1 - ANATOMY.helmet.blunt) * (1 - hi);
    } else if (zone !== 'head' && zone !== 'neck') {
      guard = 0.55 + 0.45 * (vic.cloth[pr.v.part] ?? 1);
    }

    let severity = 0;
    let pass = false;
    if (type === 'cut' || type === 'stab') {
      const thr = (type === 'cut' ? A.cut : A.stab) * guard;
      const eff = energy * quality;
      if (eff > thr) {
        severity = (eff - thr) / (type === 'cut' ? 90 : 60);
        pass = eff > thr * 1.25; // 확실히 파고들 때만 튕기지 않고 가르고 들어간다
      } else if (!predicting) {
        type = 'blunt'; // 날이 들지 못했으면 멍만 든다
      }
    }
    return {
      type,
      zone,
      energy,
      severity,
      pass,
      absorb: A.absorb ?? 100,
      bleedPerSev: (ANATOMY[zone] || ANATOMY.chest).bleed,
      local: vicLocal,
      point: point.clone(),
      dir,
      speed,
      mEff,
      t,
      helmet,
      helmetBlunt,
      bladeAxis: axis.clone(),
    };
  }

  /** 매 물리 스텝 직후: 가르고 있는 칼 처리 + 일반 충돌(튕김) 처리 */
  afterStep(world, eventQueue) {
    this.stepNo++;
    // 1) 가르고 지나가는 칼
    for (const [key, c] of this.cutting) {
      if (this.stepNo - c.seen > 2) {
        this.cutting.delete(key); // 더 이상 겹치지 않음
        continue;
      }
      if (c.applied) continue;
      const col1 = world.getCollider(c.wc);
      const col2 = world.getCollider(c.vc);
      let point = null;
      world.contactPair(col1, col2, (m, flipped) => {
        for (let i = 0; i < m.numContacts() && !point; i++) {
          if (m.contactDist(i) < 0.004) {
            // flipped면 엔진 쪽 순서가 뒤집혀 있어서, col1 기준 점은 두 번째 점이다
            const lp = flipped ? m.localContactPoint2(i) : m.localContactPoint1(i);
            if (lp) point = new THREE.Vector3(lp.x, lp.y, lp.z).applyQuaternion(rotQ(col1)).add(tv(col1.translation()));
          }
        }
      });
      if (!point) continue; // 아직 실제로 닿지 않음 (가까이만 옴)
      c.applied = true;
      this.strike(c.pr, point, true);
    }

    // 2) 튕긴 충돌 (칼끼리, 칼 면/손잡이, 문턱 못 넘은 베기)
    eventQueue.drainContactForceEvents((e) => {
      const h1 = e.collider1();
      const h2 = e.collider2();
      const a = this.info.get(h1);
      const b = this.info.get(h2);
      if (!a || !b || a.fighter === b.fighter) return;
      if (a.kind === 'weapon' && b.kind === 'weapon') {
        const p = contactPointOf(world, h1, h2) || a.fighter.bladePoint(0.6);
        const rel = a.body.velocityAtPoint(p);
        const rel2 = b.body.velocityAtPoint(p);
        const sp = Math.hypot(rel.x - rel2.x, rel.y - rel2.y, rel.z - rel2.z);
        this.hooks.onClash?.(p, sp);
        return;
      }
      const pr = this.pairOf(h1, h2);
      if (!pr) return;
      if (this.cutting.has(`${pr.wc}:${pr.vc}`)) return;
      const p = contactPointOf(world, h1, h2);
      if (!p) return;
      this.strike(pr, p, false);
    });
  }

  /** 실제 접촉점에서 다시 정확히 분석하고 상처/에너지 전달을 적용 */
  strike(pr, point, passing) {
    const att = pr.w.fighter;
    const vic = pr.v.fighter;
    const key = `${att.index}:${pr.v.part}`;
    if (vic.hitCooldowns.has(key)) return;
    // 속도는 스텝 "직전" 값을 쓴다. 튕긴 충돌은 스텝 뒤엔 이미 속도가 꺾여 있어서 에너지가 작게 나온다.
    const S = att.cache?.sword || liveState(pr.w.body);
    const P = vic.cache?.parts[pr.v.part] || liveState(pr.v.body);
    const r = this.analyze(pr, point, S, P);
    if (!r || r.energy < STRIKE.minEnergy) return;
    vic.hitCooldowns.set(key, STRIKE.hitCooldown);

    if (passing) {
      // 몸이 흡수한 에너지만큼 칼을 늦추고, 그 운동량을 몸에 전달한다
      const absorbed = Math.min(r.energy, r.absorb);
      const remain = r.energy - absorbed;
      const newSpeed = Math.sqrt((2 * remain) / r.mEff);
      const dv = r.speed - newSpeed;
      const J = r.dir.clone().multiplyScalar(r.mEff * dv);
      pr.w.body.applyImpulseAtPoint({ x: -J.x, y: -J.y, z: -J.z }, vp(point), true);
      pr.v.body.applyImpulseAtPoint({ x: J.x * 0.8, y: J.y * 0.8, z: J.z * 0.8 }, vp(point), true);
      r.stuck = remain <= 0; // 에너지가 모자라 칼이 박힘
    }
    if (r.type !== 'blunt' || r.severity > 0 || r.energy > 10) {
      vic.applyWound({ ...r, part: pr.v.part });
    }
    this.hooks.onWound?.(att, vic, r, point, pr);
  }
}

// ── 도우미 ──
function tv(v) {
  return new THREE.Vector3(v.x, v.y, v.z);
}
function vp(v) {
  return { x: v.x, y: v.y, z: v.z };
}
function rotQ(col) {
  const r = col.rotation();
  return new THREE.Quaternion(r.x, r.y, r.z, r.w);
}
function liveState(b) {
  const t = b.translation();
  const r = b.rotation();
  const c = b.worldCom();
  const v = b.linvel();
  const w = b.angvel();
  return {
    p: new THREE.Vector3(t.x, t.y, t.z),
    q: new THREE.Quaternion(r.x, r.y, r.z, r.w),
    com: new THREE.Vector3(c.x, c.y, c.z),
    v: new THREE.Vector3(v.x, v.y, v.z),
    w: new THREE.Vector3(w.x, w.y, w.z),
  };
}
function contactPointOf(world, h1, h2) {
  let found = null;
  world.contactPair(world.getCollider(h1), world.getCollider(h2), (m) => {
    if (!found && m.numSolverContacts() > 0) {
      const p = m.solverContactPoint(0);
      if (p) found = new THREE.Vector3(p.x, p.y, p.z);
    }
  });
  return found;
}
