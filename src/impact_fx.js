// ─────────────────────────────────────────────────────────────
//  impact_fx.js — 타격감 셈 (10/25 사장님 '타격감 보강도 진행해' — config IMPACT_FX · docs/strike/impact_feel_2026-10-25.md)
//   맞는 순간의 무게 하나로 멈칫 · 카메라 밀림 · 무게 소리의 크기를 정한다 — 모든 무기에 같은 식.
//   무게 H (J) = 판정 에너지 × (때린 무기 무게 / 롱소드 무게)^massExp — massExp 1 이면 '롱소드로 같은 운동량을 내는 데 드는 에너지'.
//   세기 x = ln(H / h0) / ln(h1 / h0) 를 0 ~ 1 로 자름. 효과 = 최대 × x (멈칫) · x^camPow (카메라) · x^pow (소리).
//   멈칫 묶음(stopGrant · stopTick): 잇달아 오는 멈칫의 합을 chainCap 까지만 — 멈칫이 이어 붙어 손이 굼떠지지 않게.
//   순수 함수만 (THREE · 브라우저 없음 · 가져오는 것 없음) — main.js 가 쓰고, tools/sim/impact_fx.test.mjs · impact_fx_table.mjs 가 같은 셈을 읽는다.
//   화면 · 소리만: 판정 · 물리 · AI 와 무관 (combat · fighter · ai 는 이 파일을 읽지 않는다 — 시험이 본다).
// ─────────────────────────────────────────────────────────────

/** 맞음의 무게 H (J): 판정 에너지 × (때린 무기 무게 / massRef)^massExp. 무게를 모르면(총알 포함) 롱소드로 본다 = 판정 에너지 그대로 */
export function woundHeft(energy, mass, C) {
  const m = mass > 0 ? mass : C.massRef;
  return Math.max(0, energy) * (m / C.massRef) ** C.massExp;
}

/**
 * 칼끼리 부딪힘의 무게 H (J): 두 칼 무게의 환산 질량 μ = m1 m2 / (m1 + m2) 로 ½ μ vn² (맞닿는 방향 빠르기 vn 으로 부딪힌 에너지) × energyScale(판정 에너지와 같은 눈금)
 *  × (2μ / massRef)^massExp (같은 무게 둘이면 2μ = 그 무게 — 맞음과 같은 무게 배율)
 */
export function clashHeft(vn, m1, m2, C, energyScale = 2) {
  const a = m1 > 0 ? m1 : C.massRef;
  const b = m2 > 0 ? m2 : C.massRef;
  const mu = (a * b) / (a + b);
  return 0.5 * mu * Math.max(0, vn) ** 2 * energyScale * ((2 * mu) / C.massRef) ** C.massExp;
}

/** 세기 x (0 ~ 1): 에너지가 두 배가 될 때마다 같은 만큼 — h0 아래 0 · h1 위 1 */
export function heftLevel(H, C) {
  if (!(H > C.h0)) return 0;
  return Math.min(1, Math.log(H / C.h0) / Math.log(C.h1 / C.h0));
}

/** 카메라 밀림 세기 (스프링 속도): 최대 × x^camPow */
const camOf = (x, max, C) => max * x ** C.camPow;
const soundOf = (x, C, k = 1) => k * C.sound.gain * x ** C.sound.pow;

/**
 * 맞음 하나의 효과.
 * @param o { energy (판정 J), mass (때린 무기 kg — 총알이면 비움), pass (살을 가르고 지나감), hard (박힘 · 뼈 · 투구 · 판금), taken (내가 맞음) }
 * @returns { H, x, stop (s), cam (카메라 스프링 속도), down (아래 몫), sound (무게 소리 음량 0 ~ gain) }
 */
export function woundImpact(o, C) {
  const H = woundHeft(o.energy, o.mass, C);
  const x = heftLevel(H, C);
  const k = o.pass ? C.passK : o.hard ? C.hardK : 1;
  return {
    H,
    x,
    stop: Math.min(C.stopMax, C.stop * x * k), // 위 끝 stopMax 0.1 s = 지금 멈칫 상한 그대로
    cam: camOf(x, o.taken ? C.camTaken : C.camDealt, C),
    down: C.camDown * x,
    sound: soundOf(x, C),
  };
}

/**
 * 칼끼리 부딪힘 하나의 효과 (맞음보다 순하게).
 * @param o { vn (m/s), m1, m2 (두 칼 kg), energyScale }
 */
export function clashImpact(o, C) {
  const H = clashHeft(o.vn, o.m1, o.m2, C, o.energyScale);
  const x = heftLevel(H, C);
  return { H, x, stop: Math.min(C.stopMax, C.stop * x * C.clashStop), cam: camOf(x, C.clashCam, C), down: 0, sound: soundOf(x, C, C.sound.clash) };
}

/**
 * 멈칫 묶음 — 새 멈칫 want (s) 를 받았을 때 남은 멈칫.
 *  S = { left (남은 멈칫 s), spent (이 묶음에서 이미 멈춘 실제 s), quiet (멈칫이 끝난 뒤 흐른 실제 s) } — main.js 가 한 벌 들고 있다.
 *  늘 '더 긴 쪽' (겹쳐 쌓지 않음) · 한 묶음의 멈칫 합(spent + left)은 chainCap 을 넘지 않는다.
 */
export function stopGrant(S, want, C) {
  if (!(want > 0)) return S.left;
  S.left = Math.max(S.left, Math.min(want, C.chainCap - S.spent));
  return S.left;
}

/**
 * 멈칫 시계 한 화면 (실제 시간 dt s): 멈춘 동안 left 를 줄이고 spent 를 늘림 · 멈칫이 없는 채 chainGap 이 지나면 묶음을 새로.
 *  돌려줌 = 이번 화면 가운데 멈칫인 몫 f (0 ~ 1). main.js 화면 시간 배율 = 1 − f × (1 − 멈칫 배율) — 느린 폰(긴 화면)에서도 짧은 멈칫이
 *  화면 한 장 통째로 늘어나지 않게 (옛 식은 남은 멈칫이 1 ms 여도 그 화면 전부를 늦췄다). 물리 스텝 길이는 그대로
 */
export function stopTick(S, dt, C) {
  if (S.left > 0 && dt > 0) {
    const used = Math.min(dt, S.left);
    S.spent += used;
    S.left -= used;
    S.quiet = 0;
    return used / dt;
  }
  S.quiet += Math.max(0, dt);
  if (S.quiet >= C.chainGap) S.spent = 0;
  return 0;
}

/**
 * 카메라 흔들림 벽: 스프링이 밀린 거리 o (m) 가 max 를 넘으면 그 길이로 줄이고 바깥쪽 빠르기만 없앤다 (안쪽 · 옆 빠르기는 그대로).
 *  빠르기 상한(camCap)만으로는 맞음이 잇달아 오면(첫 밀림이 가장 멀리 간 때 둘째가 같은 쪽으로) 밀린 거리가 겹쳐 커진다 — 폰 멀미.
 *  o · v = { x, y, z } (THREE.Vector3 그대로). 돌려줌 = 벽에 닿았나
 */
export function shakeWall(o, v, max) {
  const L = Math.hypot(o.x, o.y, o.z);
  if (!(L > max)) return false;
  const k = max / L;
  o.x *= k;
  o.y *= k;
  o.z *= k;
  const ux = o.x / max, uy = o.y / max, uz = o.z / max;
  const vr = v.x * ux + v.y * uy + v.z * uz;
  if (vr > 0) {
    v.x -= vr * ux;
    v.y -= vr * uy;
    v.z -= vr * uz;
  }
  return true;
}
