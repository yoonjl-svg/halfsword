// ─────────────────────────────────────────────────────────────
//  ③ 자세 → 칼길 (11/17 — 사장님 '현실 검술에선 휘두름을 미리 파악해서 막기도 해' · 설계 docs/design/guard_line_2026-11-17.md ·
//   [사장님 11/17 결정] '그래 너의 권고에 따르마' — 기본 판 · 스위치 없음 · config GUARD_LINE · 표 schools.js TRADITIONS[유파].lineMap)
//
//  자세 = 기본 줄의 약속. 열쇠 = 보이는 손 자리에서 가장 가까운 자세(nearGuard — GUARD_LINE.near 안일 때만).
//   공격하는 AI(ai.js pickTech — 내 손)와 읽는 AI(ai.js guardRead — 늦게 본 상대 손 sense.seen)가 이 한 함수를 쓴다. AI 자세 이름(guard.name)은 읽지 않는다.
//  공격: 기술 무게 × W(자세, 기술)^τ — W = P 1 · S 0.35 · U 0.08 (표에 없는 기술 · free 자세 = 1) · τ = 인물의 read (0.35 / 0.65 / 0.9).
//   유파 맛(결정 2)을 지키는 곱 둘 — 기본 기술: 자세마다 한 곱 c(자세)(그 자세의 가장 센 기본 기술 무게가 전과 같게 — 자세 안 P : S : U 비 그대로) ·
//   묶인 고유 기술 넷: κ = (약속하는 자세 ŵ 합) / Σ ŵ(자세) W^τ (ŵ = 간 보는 목록 w × 인물 자세 취향 — 그 목록으로 평균 내면 1).
//   (11/17 재기: 모든 묶인 기술에 κ → 기본 자리에서 커진 기본 기술이 유파 맛을 밀어냄(이베리아 레돈두 · 싱지르 49 → 22 %) · 기본 기술에 곱 없음 → 깎인 기본 기술 몫을 맛 기술이 가져감(일본 코테 19 → 30 %))
//  읽기: 상대 유파 표에서 그 자세의 기본 줄 = 기본(P) 기술 가운데 고를 수 있는 것(꾸러미 tech)의 줄 무게(base)가 가장 큰 것 · 없으면 보조(S) · free 자세 = 줄 없음.
//   줄 이름은 막는 쪽 막기 줄(ai.js threat 의 준비 자세 규칙과 같은 대응 — 상대 오른쪽 위에서 오는 칼 = 내 왼쪽 위 highL).
//  사람 조작은 묶지 않는다 — 여기 셈은 AI 의 고르기 · 읽기에만 쓰인다.
// ─────────────────────────────────────────────────────────────
import { GUARD_LINE } from './config.js';
import { G } from './ai_techniques.js';
import { TRADITIONS } from './schools.js';

/** 기술이 노리는 빈틈(TECH open — 상대 몸 기준) → 막는 쪽 막기 줄 (ai.js threat · ai_intercept.js predLine 과 같은 대응) */
export const PARRY_LINE = { UL: 'highL', UR: 'highR', H: 'highC', LL: 'lowL', LR: 'lowR', C: 'thrust' };

const _guards = new Map();
/** 유파의 자세 후보 = lineMap 열쇠(G 패드) — 표 없는 유파는 빈 목록 */
export function guardsOf(tradition) {
  let L = _guards.get(tradition);
  if (!L) {
    const M = TRADITIONS[tradition]?.lineMap ?? {};
    L = Object.keys(M).filter((k) => G[k]).map((name) => ({ name, pad: G[name] }));
    _guards.set(tradition, L);
  }
  return L;
}

/**
 * 보이는 손 자리에서 가장 가까운 자세 { name, pad } — 거리 GUARD_LINE.near 안일 때만 (아니면 null).
 *  src = 검객(보이는 손 = 걸러진 손 목표 skill.aim) 또는 늦게 본 모습(ai_sense snap 의 hx · hy — 그 손을 반응 지연만큼 늦게 본 것). tradition = 그 검객의 유파
 */
export function nearGuard(src, tradition) {
  if (!src) return null;
  const a = src.skill?.aim;
  const x = a ? a.x : src.hx;
  const y = a ? a.y : src.hy;
  let best = null;
  let bd = GUARD_LINE.near;
  for (const g of guardsOf(tradition)) {
    const d = Math.hypot(g.pad[0] - x, g.pad[1] - y);
    if (d <= bd) {
      bd = d;
      best = g;
    }
  }
  return best;
}

const _rows = new Map();
/** 유파 표 풀이 (처음 한 번): 자세 → { P: Set, S: Set, free } · 묶인 기술 이름(표 어딘가에 있는 것) */
function rowsOf(tradition) {
  let R = _rows.get(tradition);
  if (R === undefined) {
    const M = TRADITIONS[tradition]?.lineMap;
    if (!M) R = null;
    else {
      const rows = {};
      const bound = new Set();
      for (const [g, r] of Object.entries(M)) {
        rows[g] = { P: new Set(r.P ?? []), S: new Set(r.S ?? []), free: !!r.free };
        for (const n of [...(r.P ?? []), ...(r.S ?? [])]) bound.add(n);
      }
      R = { rows, bound };
    }
    _rows.set(tradition, R);
  }
  return R;
}

/** 자세 guard 에서 기술 name 의 칸: 'P' · 'S' · 'U' — 묶지 않은 기술 · free 자세 · 표 없는 자세 · 표 없는 유파면 null (무게 1) */
export function lineClass(tradition, guard, name) {
  const R = rowsOf(tradition);
  if (!R || !R.bound.has(name)) return null;
  const row = R.rows[guard];
  if (!row || row.free) return null;
  return row.P.has(name) ? 'P' : row.S.has(name) ? 'S' : 'U';
}

/** W(자세, 기술)^τ (κ 없이) — 칸 없으면 1 */
export function lineWeight(tradition, guard, name, tau) {
  const k = lineClass(tradition, guard, name);
  return k ? Math.pow(GUARD_LINE.w[k], tau) : 1;
}

/** 자세 guard 가 줄을 약속하는가 (표에 칸이 있고 free 가 아님) */
function promises(tradition, guard) {
  const row = rowsOf(tradition)?.rows[guard];
  return !!row && !row.free;
}

const _uniq = new Map();
/** 유파 고유 기술인가 (TRADITIONS[유파].unique — 표에 묶인 고유 기술은 원전에 출발 자세가 있는 넷뿐) */
function isUnique(tradition, name) {
  let U = _uniq.get(tradition);
  if (!U) _uniq.set(tradition, (U = new Set((TRADITIONS[tradition]?.unique ?? []).map((u) => u.name))));
  return U.has(name);
}

/**
 * 공격하는 AI 의 무게 책 (처음 한 번 · τ 가 바뀌면 다시): τ = 인물의 read.
 *  ① 묶인 고유 기술 넷(유파 맛) — κ(기술) = (약속하는 자세 ŵ 합) / Σ_약속하는 자세 ŵ W^τ (ŵ = 간 보는 목록 w × 인물 자세 취향) — 그 목록으로 평균 낸 무게가 1.
 *  ② 기본 기술 — 자세마다 한 곱 c(자세) = 그 자세에 손을 둔 버릇 무게(인물 취향 × base × 찌르기 배율 × 준비 자리 거리 — pickTech 와 같은 셈 · 상대 모습 몫 빼고)의
 *     기본 기술 가운데 가장 큰 것 ÷ W^τ 를 곱한 뒤 가장 큰 것. 그 자세 안 기본 기술끼리는 P : S : U 그대로 다시 줄 세우고, 가장 센 기본 기술의 무게는 전과 같아
 *     묶지 않은 고유 기술(유파 맛)과의 겨룸이 그대로 (기술 고르기가 거의 가장 큰 무게 하나를 고르는 꼴이라 평균이 아니라 가장 큰 것을 맞춤).
 *  약속하지 않는 자세(free · 표 없음)는 무게 1 그대로 (그 자세에선 유파 버릇 그대로 — 간수세)
 */
function atkBook(ai) {
  const tau = ai.level?.read ?? 0.65;
  const B = ai.glBook;
  if (B && B.tau === tau) return B;
  const tr = ai.art?.tradition;
  const R = rowsOf(tr);
  const gs = (ai.school?.guards ?? []).filter((g) => g.pad && promises(tr, g.name));
  const all = (ai.school?.guards ?? []).filter((g) => g.pad);
  const wOf = (g) => (g.w ?? 1) * (ai.pers?.guardPref?.[g.name] ?? 1);
  const tot = all.reduce((a, g) => a + wOf(g), 0) || 1;
  const wh = gs.map((g) => wOf(g) / tot);
  const mass = wh.reduce((a, b) => a + b, 0);
  const kappa = new Map();
  const kOf = (name) => {
    let k = kappa.get(name);
    if (k === undefined) {
      let c = 0;
      gs.forEach((g, i) => (c += wh[i] * lineWeight(tr, g.name, name, tau)));
      k = c > 1e-9 ? mass / c : 1;
      kappa.set(name, k);
    }
    return k;
  };
  // ② 기본 기술 자세 곱 — 버릇 무게는 pickTech 와 같은 셈(느긋한 틈의 준비 자리 거리 · 상대 모습 몫 1)
  const cfg = ai.me?.weaponCfg;
  const thrustBias = cfg ? cfg.mThrust / cfg.mCut : 1;
  const scale = 0.55 + 0.4 * (1 - tau);
  const base = (ai.school?.tech ?? []).filter((t) => R?.bound.has(t.name) && !isUnique(tr, t.name));
  const cg = new Map();
  const cOf = (g) => {
    let c = cg.get(g);
    if (c === undefined) {
      const pad = G[g];
      let before = 0, after = 0;
      for (const t of base) {
        const a = (ai.pers?.techPref?.[t.name] ?? 1) * (t.base ?? 1) * (t.kind === 'thrust' ? thrustBias : 1) * Math.exp(-Math.hypot(pad[0] - t.from[0], pad[1] - t.from[1]) / scale);
        before = Math.max(before, a);
        after = Math.max(after, a * lineWeight(tr, g, t.name, tau));
      }
      c = after > 1e-12 ? before / after : 1;
      cg.set(g, c);
    }
    return c;
  };
  return (ai.glBook = { tau, tr, kOf, cOf });
}

/**
 * 공격하는 AI: 보이는 내 손 자세 near 에서 기술 t 를 고르는 무게 곱 (near 없음 · 약속하지 않는 자세 · 묶지 않은 기술 = 1).
 *  기본 기술 = W^τ × c(자세) (P 1 · S 0.35 · U 0.08 — [사장님 11/17 결정 2] '기본 기술은 §3 무게' · 자세 안 비 그대로 · 가장 센 기본 기술 무게는 그대로) ·
 *  묶인 고유 기술(실하우 · 크룸프하우 · 임브로카타 · 츠바메가에시) = W^τ × κ (버릇 고정 몫 — 유파 맛 몫이 그대로이게)
 */
export function lineW(ai, near, t) {
  if (!near || !t) return 1;
  const B = atkBook(ai);
  if (!promises(B.tr, near.name) || !rowsOf(B.tr)?.bound.has(t.name)) return 1;
  const w = lineWeight(B.tr, near.name, t.name, B.tau);
  return isUnique(B.tr, t.name) ? w * B.kOf(t.name) : w * B.cOf(near.name);
}

const _main = new WeakMap();
/** 꾸러미 pack(유파 tradition)의 자세마다 기본 줄 (막기 줄 이름 · 없으면 null) — 기본(P) 기술 가운데 고를 수 있는 것의 줄 무게(base)가 가장 큰 것, 없으면 보조(S) */
export function mainLines(pack, tradition) {
  if (!pack?.tech) return null;
  let M = _main.get(pack);
  if (M) return M;
  M = {};
  const R = rowsOf(tradition);
  for (const g of guardsOf(tradition)) {
    const row = R?.rows[g.name];
    if (!row || row.free) {
      M[g.name] = null;
      continue;
    }
    let line = null;
    for (const cls of ['P', 'S']) {
      const mass = {};
      for (const t of pack.tech) if (row[cls].has(t.name) && PARRY_LINE[t.open]) mass[t.open] = (mass[t.open] ?? 0) + (t.base ?? 1);
      let best = 0;
      for (const [o, m] of Object.entries(mass)) if (m > best) (best = m), (line = PARRY_LINE[o]);
      if (line) break;
    }
    M[g.name] = line;
  }
  _main.set(pack, M);
  return M;
}

/**
 * 읽는 AI: 늦게 본 상대 모습 s 의 손 자세 → { guard, line } (상대 유파 표 · 그 자세에 줄이 있을 때만 — 아니면 null).
 *  상대 유파 = 상대가 든 칼의 유파(foe.swordArt — 보이는 것) · 그 유파 꾸러미(무기 기본 — 숙련도 거르기 없음)의 기술로 기본 줄을 셈. 사람 상대도 같은 셈
 */
export function readGuard(foe, s) {
  const art = foe?.swordArt;
  const tr = art?.tradition;
  if (!tr || !TRADITIONS[tr]?.lineMap) return null;
  const g = nearGuard(s, tr);
  if (!g) return null;
  const line = mainLines(art.school, tr)?.[g.name] ?? null;
  return line ? { guard: g.name, line } : null;
}

/** 재기 칸 (판정에 안 씀) */
export function glStats() {
  return { beat: 0, beatSkip: 0, beatFire: 0, enter: 0, go: 0, debana: 0, th: 0, hit: 0, end: 0 };
}
