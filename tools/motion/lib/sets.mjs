// ─────────────────────────────────────────────────────────────
//  저작 키 묶음(set) 다루기 (동작 연구 PM) — build_clips.mjs · build_flow.mjs 가 같이 쓴다
//   set = { keys: [{ t, tag, p: [골반 돌림, 낮춤, 숙임], c: [가슴 돌림(골반 기준), 숙임, 옆굽힘], h: 손(가슴 틀), d: 칼 방향(가슴 틀), guard? }],
//           steps: [{ t, feet: { L, R: [x, z, 발끝 돌림, 들림, 높이] }, px, pz }], chain }
// ─────────────────────────────────────────────────────────────
import { v3, m3, frame } from './body.mjs';
import { GAME_GUARDS } from './cuts.mjs';
import { fromGameGuard, stepOf, nearestGuard } from './clip.mjs';

export const MIRROR_GUARD = { tag: null, langort: null, alber: null, neben: null,  tagR: 'tagL', tagL: 'tagR', ochs: 'ochsL', ochsL: 'ochs', side: 'sideL', sideL: 'side', pflug: 'pflugL', pflugL: 'pflug', wechsel: 'wechselL', wechselL: 'wechsel' };

/** 저작 키 (p/c/h/d + 걸음 키) → clip.mjs 키 */
export function toKeys(set) {
  const keys = set.keys.map((k) => ({
    t: k.t,
    tag: k.tag,
    pelvis: { yaw: k.p[0], drop: k.p[1], pitch: k.p[2] ?? 0, roll: 0 },
    chest: { yaw: k.c[0], lean: k.c[1], side: k.c[2] ?? 0 },
    hand: k.h,
    // 칼 방향: 저작 키는 그 키의 가슴 틀 → 월드로 바꿔 둔다 (보간은 월드에서)
    dirV: m3.apply(frame(k.p[0] + k.c[0], (k.p[2] ?? 0) + k.c[1], k.c[2] ?? 0), k.d),
  }));
  for (const s of set.steps) {
    const f = {};
    for (const side of ['L', 'R']) {
      const a = s.feet[side];
      f[side] = { x: a[0], z: a[1], yaw: a[2], lift: a[3], up: a[4] };
    }
    keys.push({ t: s.t, feet: f, pelvis: { x: s.px ?? 0, z: s.pz ?? 0 } });
  }
  keys.sort((a, b) => a.t - b.t);
  return keys;
}
export function marksOf(set) {
  const m = {};
  for (const k of set.keys) if (k.tag) m[k.tag] = k.t;
  m.t0 = set.keys[0].t;
  for (const need of ['t0', 'tw', 'tr', 'tc', 'tf', 'tg']) if (m[need] == null) throw new Error(`표시 ${need} 없음`);
  return m;
}

/** 왼쪽에서 베기 = 거울 (게임 자세표 키는 게임의 왼쪽 자세 값으로 바꾼다) */
export function mirror(set) {
  const keys = set.keys.map((k) => {
    if (k.guard && MIRROR_GUARD[k.guard]) {
      const g = fromGameGuard(GAME_GUARDS[MIRROR_GUARD[k.guard]]);
      return { t: k.t, tag: k.tag, p: [g.pelvis.yaw, g.pelvis.drop, 0], c: [g.chest.yaw, g.chest.lean, 0], h: g.hand, d: g.dirV, guard: MIRROR_GUARD[k.guard] };
    }
    // 거울에 비춰도 같은 자세(지붕·긴 자세·바보)는 이름 그대로, 짝이 없는 자세(옆 지킴)는 이름 없음
    const same = { tag: 'tag', langort: 'langort', alber: 'alber' };
    return { t: k.t, tag: k.tag, p: [-k.p[0], k.p[1], k.p[2] ?? 0], c: [-k.c[0], k.c[1], -(k.c[2] ?? 0)], h: [k.h[0], k.h[1], -k.h[2]], d: [k.d[0], k.d[1], -k.d[2]], guard: k.guard ? same[k.guard] : undefined };
  });
  const steps = set.steps.map((s) => {
    const m = (a) => [a[0], -a[1], -a[2], a[3], a[4]];
    return { t: s.t, feet: { L: m(s.feet.R), R: m(s.feet.L) }, px: s.px, pz: -(s.pz ?? 0) };
  });
  return { keys, steps, chain: set.chain };
}

/** clip/2 에 더한 클립 단위 값: 걸음(목표·때), 시작·복귀 목표 자세와 시작·끝 자세에 가장 가까운 게임 자세(손 오차), 복귀 구간 표본 */
export function clipExtras(set, rows, marks) {
  const last = set.keys[set.keys.length - 1];
  const rec = rows.filter((r) => r.t >= marks.tf - 1e-9 && r.t <= marks.tg + 1e-9);
  return {
    step: stepOf(rows, marks),
    startFrom: set.keys[0].guard ?? null,
    startPose: nearestGuard(rows[0].J, GAME_GUARDS),
    recoverTo: last.guard ?? null,
    endPose: nearestGuard(rows[rows.length - 1].J, GAME_GUARDS),
    recovery: { from: +marks.tf.toFixed(3), to: +marks.tg.toFixed(3), samples: rec.length },
  };
}
