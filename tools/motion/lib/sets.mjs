// ─────────────────────────────────────────────────────────────
//  저작 키 묶음(set) 다루기 (동작 연구 PM) — build_clips.mjs · build_flow.mjs 가 같이 쓴다
//   set = { keys: [{ t, tag, p: [골반 돌림, 낮춤, 숙임], c: [가슴 돌림(골반 기준), 숙임, 옆굽힘], h: 손(가슴 틀), d: 칼 방향(가슴 틀), guard? }],
//           steps: [{ t, feet: { L, R: [x, z, 발끝 돌림, 들림, 높이] }, px, pz }], chain }
// ─────────────────────────────────────────────────────────────
import { v3, m3, frame, BODY } from './body.mjs';
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

/**
 * 왼쪽에서 베기 = 거울. 몸은 그대로 오른손잡이라 칼 팔(오른팔)이 반대쪽에 남는다 — 그래서 온전한 거울이 아니다:
 *  - 게임 자세표 키: 짝이 있는 자세는 게임의 왼쪽 자세 값(pflug → pflugL …).
 *  - 짝 없이 가운데 한 자세(지붕·긴 자세·바보): 게임은 양쪽에 같은 자세를 쓴다 → 게임 값 그대로.
 *    (거울 값은 칼 든 어깨를 뒤로 빼 긴 자세·바보에서 팔이 5~8 cm 모자랐다 — validate_clip R1)
 *  - 저작 키: 거울. 거울 손이 칼 든 어깨(가슴 틀 [0, 0.1, 0.2])에서 팔 길이 0.565 m 를 넘으면 어깨 쪽으로 당긴다
 *    (오른쪽 허리 근처 손은 왼쪽으로 가면 오른팔이 몸을 가로질러야 해서 멀어진다).
 *    단 앞뒤 게임 자세가 둘 다 가운데 자세인 저작 키(작게 Oberhau·Scheitelhau 의 지붕 → 바보·긴 자세 사이)는 거울에 비추지 않는다
 *    — 게임에서 그 구간은 양쪽이 같은 길이다(거울에 비추면 손이 옆으로 10 cm 지그재그).
 */
const SAME_GUARD = { tag: 'tag', langort: 'langort', alber: 'alber' };
function guardKey(k, id) {
  const g = fromGameGuard(GAME_GUARDS[id]);
  return { t: k.t, tag: k.tag, p: [g.pelvis.yaw, g.pelvis.drop, 0], c: [g.chest.yaw, g.chest.lean, 0], h: g.hand, d: g.dirV, guard: id };
}
export function mirror(set) {
  const reach = BODY.upper + BODY.fore;
  // 저작 키마다 앞·뒤로 가장 가까운 게임 자세 키
  const before = [], after = [];
  set.keys.forEach((k, i) => (before[i] = k.guard ?? before[i - 1]));
  for (let i = set.keys.length - 1; i >= 0; i--) after[i] = set.keys[i].guard ?? after[i + 1];
  const keys = set.keys.map((k, i) => {
    if (k.guard && MIRROR_GUARD[k.guard]) return guardKey(k, MIRROR_GUARD[k.guard]);
    if (k.guard && SAME_GUARD[k.guard]) return guardKey(k, SAME_GUARD[k.guard]);
    if (SAME_GUARD[before[i]] && SAME_GUARD[after[i]]) return { t: k.t, tag: k.tag, p: [...k.p], c: [...k.c], h: [...k.h], d: [...k.d] };
    let h = [k.h[0], k.h[1], -k.h[2]];
    const off = v3.sub(h, BODY.shoulder);
    if (v3.len(off) > reach) h = v3.add(BODY.shoulder, v3.mul(off, reach / v3.len(off)));
    // 짝이 없는 자세(옆 지킴)는 이름 없음
    return { t: k.t, tag: k.tag, p: [-k.p[0], k.p[1], k.p[2] ?? 0], c: [-k.c[0], k.c[1], -(k.c[2] ?? 0)], h, d: [k.d[0], k.d[1], -k.d[2]] };
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
