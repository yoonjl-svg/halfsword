// 막기 2.0 · 칼끼리 연속 충돌 (config BLOCK2.ccd — 사장님 11/17 결정 '네가 원하는대로 모두 빠짐없이 하고').
//  칼끝 15 m/s 는 한 스텝(1/120 s)에 0.12 m — 칼날 두께보다 커서 칼끼리 스텝 사이로 통과한다. 딱딱한 연속 충돌(CCD)을 칼 몸에 늘 켜면
//  칼이 상대 몸에 닿는 순간 멈춰 서서 베는 판정이 죽는다(칼끝 17 → 0.1 m/s · 판당 상처 −36 %, 11/17 재어 봄). 그래서 두 칼이 이번 스텝 안에 서로 가로지를 때만 그 스텝에 둘의 CCD 를 켠다.
//  부르는 곳: fighter.cacheState() — 두 싸움꾼이 다 스텝 전 상태를 적은 뒤(번호 큰 쪽이 부를 때) 한 번.
import * as THREE from 'three';
import { BLOCK2 } from './config.js';

const _a0 = new THREE.Vector3(), _a1 = new THREE.Vector3(), _b0 = new THREE.Vector3(), _b1 = new THREE.Vector3();
const _c0 = new THREE.Vector3(), _c1 = new THREE.Vector3(), _d0 = new THREE.Vector3(), _d1 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _qa = new THREE.Quaternion(), _ax = new THREE.Vector3(), _r = new THREE.Vector3(), _s = new THREE.Vector3();

function segDist(p1, q1, p2, q2) { // 선분 둘 사이 최소 거리
  const d1 = _r.subVectors(q1, p1), d2 = _s.subVectors(q2, p2);
  const rx = p1.x - p2.x, ry = p1.y - p2.y, rz = p1.z - p2.z;
  const a = d1.dot(d1), e = d2.dot(d2), f = d2.x * rx + d2.y * ry + d2.z * rz;
  const c = d1.x * rx + d1.y * ry + d1.z * rz, b = d1.dot(d2), den = a * e - b * b;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = e > 1e-12 ? (b * s + f) / e : 0;
  if (t < 0) { t = 0; s = a > 1e-12 ? Math.min(1, Math.max(0, -c / a)) : 0; } else if (t > 1) { t = 1; s = a > 1e-12 ? Math.min(1, Math.max(0, (b - c) / a)) : 0; }
  const dx = rx + d1.x * s - d2.x * t, dy = ry + d1.y * s - d2.y * t, dz = rz + d1.z * s - d2.z * t;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/** 스텝 전 상태 S({p,q,v,w}) 의 칼이 dt·k 뒤에 있을 자리 → [손잡이 끝, 칼끝] (선형 + 각속도 돌림) */
function ends(f, S, k, out0, out1) {
  const cfg = f.weaponCfg;
  _q.copy(S.q);
  const wl = S.w.length();
  if (wl > 1e-6) { _qa.setFromAxisAngle(_ax.copy(S.w).multiplyScalar(1 / wl), wl * k); _q.premultiply(_qa); }
  out0.set(0, cfg.hiltLength, 0).applyQuaternion(_q).addScaledVector(S.v, k).add(S.p);
  out1.set(0, cfg.hiltLength + cfg.bladeLength, 0).applyQuaternion(_q).addScaledVector(S.v, k).add(S.p);
}

/** f 와 상대(f.foe) 의 칼이 이번 스텝 안에 가로지르면 둘의 칼 몸 CCD 를 켜고, 아니면 끈다 (BLOCK2.ccd 1 = 이렇게 · 2 = 늘 켬 — 비교용) */
export function bladeSweepCcd(f, dt) {
  const g = f.foe;
  if (!g || !f.sword || !g.sword || f.flexWeapon || g.flexWeapon || !f.cache?.sword || !g.cache?.sword || g.index > f.index) return;
  let on = false;
  if (f.armed && g.armed) {
    if (BLOCK2.ccd === 2) on = true;
    else {
      const m = BLOCK2.ccdMargin;
      ends(f, f.cache.sword, 0, _a0, _a1);
      ends(g, g.cache.sword, 0, _b0, _b1);
      if (segDist(_a0, _a1, _b0, _b1) > m) { // 이미 맞닿은 칼은 엔진이 푼다 (CCD 는 새로 가로지르는 칼 몫)
        for (let i = 1; i <= 4 && !on; i++) {
          ends(f, f.cache.sword, (dt * i) / 4, _c0, _c1);
          ends(g, g.cache.sword, (dt * i) / 4, _d0, _d1);
          on = segDist(_c0, _c1, _d0, _d1) <= m;
        }
      }
    }
  }
  for (const x of [f, g]) if (!!x.ccdOn !== on) { x.sword.enableCcd(on); x.ccdOn = on; }
}
