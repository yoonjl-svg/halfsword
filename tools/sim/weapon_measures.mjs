// 무기별 유파 간격 실측치 (docs/weapons.md §2, tools/sim/weapon_measure.mjs 로 잰 값).
// 헤드리스 무기 배터리(weapon_balance/weapon_trace)에서 AI 가 롱소드 간격(1.62/2.0)으로 짧은 칼을 휘두르지 않게,
// 판을 만든 뒤 AI 의 유파 measure 만 이 표로 바꿔 끼운다 (ai.js·schools.js 는 건드리지 않는다 — 캐릭터 PM 소유).
// 10/8 ① 구조: 숫자는 이제 src/weapon_measured.js 한 곳에서 읽는다 (전엔 이 파일에 셋째 벌이 있었다 — 값은 같다).
//  거리 셋은 MEASURED, 베는 시간은 날것(MEASURED 넷째 칸) — 단 롱소드 줄은 기본 AI 값 그대로(베는 시간 0.30 = CUT_TIME_30, 회귀 기준)
//  생성기: `node tools/sim/weapon_measures.mjs --gen` (아래 맨 끝) — 같은 측정으로 전 무기를 재어 파일에 쓰고 손 표와 나란히 찍는다(비교란)
import { MEASURED, CUT_TIME_30 } from '../../src/weapon_measured.js';
import { isMain } from './is_main.mjs';

export const WEAPON_MEASURES = Object.fromEntries(
  Object.entries(MEASURED).map(([id, m]) => [id, { contact: m[0], reach: m[1], clinch: m[2], cutTime: id === 'longsword' ? CUT_TIME_30.longsword : m[3] }]),
);

/** AI 하나의 유파 간격을 그 무기 실측치로 바꿔 끼운다 (롱소드는 그대로 두어 기본 AI 회귀를 지킨다) */
// cutTime 은 weapon_measure.mjs 가 거리와 달리 보정 없이 raw 로 적는다(롱소드 raw 0.43s). 그런데 롱소드 AI 는 0.3 을 쓴다 —
//  raw 그대로 끼우면 롱소드 말고 모든 무기의 AI 가 "내 베기는 롱소드보다 40% 늦다"고 착각해 너무 멀리서 공격을 걸었다
//  (3→4라운드 밸런스에서 확인한 근본 원인). 거리와 똑같이 롱소드 기준으로 보정한다: 0.3 × (무기 raw ÷ 롱소드 raw).
export const LONGSWORD_RAW_CUT = MEASURED.longsword[3]; // hybrid 재실측 롱소드 raw 0.41 (예전 levitate 0.43) — weapon_measured.js
export function applyWeaponMeasure(ai, weaponId) {
  const m = WEAPON_MEASURES[weaponId];
  if (!ai || !m || weaponId === 'longsword') return;
  const M = { ...m, cutTime: WEAPON_MEASURES.longsword.cutTime * (m.cutTime / LONGSWORD_RAW_CUT) };
  ai.school = { ...ai.school, measure: M };
  ai.M = M;
  // foeReach(상대 칼이 닿는 거리 어림)는 건드리지 않는다: 게임처럼 AI 생성자가 상대 무기로 정한 값(ai.foeM.reach + 0.05)을 쓴다.
  //  (예전엔 여기서 내 무기 사거리로 덮어써서, 짧은 칼 AI 가 롱소드 사거리를 짧게 어림하고 너무 가까이 서 있었다)
}

// ── 생성기 (10/8 ① 구조, docs/strike/sword_art_layers_design_2026-10-08.md §13) ──────────────────────────
//  node tools/sim/weapon_measures.mjs --gen [--out=data/weapon_measured.gen.json] [무기id…]
//   weapon_measure.mjs 와 같은 측정(혼자 분노의 베기 · 칼날 70% 가 머리 높이를 지나는 가장 먼 앞 거리, 롱소드 raw → 1.62 보정,
//   clinch = contact × 1.25/1.62, 베는 시간 날것)으로 전 무기를 한 번에 재어 파일에 쓰고, 손 표(src/weapon_measured.js)와 나란히 찍는다.
//   비교란: 손 표를 바꾸지 않는다. 걸음이 든 reach 는 시작 정지(ARENA.startHold) 안에서 내딛기가 거절되어 contact 와 같게 나온다 —
//   `node tools/sim/with_config.mjs ARENA.startHold=0 weapon_measures.mjs --gen --out=…` 로 따로 잰다.
//   마지막 칸은 손 표의 CUT_TIME_30 을 손 표의 날것으로 다시 셈한 값(0.30 × 날것 ÷ 롱소드 날것, 둘째 자리)과 견준다
if (isMain(import.meta.url) && process.argv.includes('--gen')) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { measureAll } = await import('./weapon_measure.mjs');
  const { ARENA } = await import('../../src/config.js');
  const { WEAPONS } = await import('../../src/weapons.js');
  const args = process.argv.slice(2);
  const outArg = args.find((a) => a.startsWith('--out='));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const out = path.resolve(root, outArg ? outArg.slice(6) : 'data/weapon_measured.gen.json');
  const ids = args.filter((a) => !a.startsWith('--'));
  const res = measureAll(ids.length ? ids : Object.keys(WEAPONS));
  const f2 = (v) => (v == null ? '-' : v.toFixed(2));
  const cell = (hand, gen) => (hand == null ? `- / ${f2(gen)}` : `${f2(hand)} / ${f2(gen)}${Math.abs(hand - gen) >= 0.005 ? ' ≠' : ''}`);
  const diffs = [];
  const rows = {};
  for (const r of res.rows) {
    const h = MEASURED[r.id] ?? null;
    rows[r.id] = { contact: r.contact, reach: r.reach, clinch: r.clinch, cutTime: r.cutTime };
    if (h) for (const [k, i] of [['contact', 0], ['reach', 1], ['clinch', 2], ['cutTime', 3]]) if (Math.abs(h[i] - r[k]) >= 0.005) diffs.push(`${r.id}.${k} ${h[i]} → ${r[k]}`);
  }
  const file = {
    note: '생성 측정값 (비교란 — 게임은 src/weapon_measured.js 손 표를 읽는다). node tools/sim/weapon_measures.mjs --gen',
    method: 'weapon_measure.mjs measureAll: zornhau 0.35 s 를 혼자 휘둘러 칼날 70% 가 머리 높이(1.45~1.75 m)를 지나는 가장 먼 앞 거리 × (1.62 / 롱소드 raw), reach 는 같은 베기 + 앞으로 걷기, clinch = contact × 1.25/1.62, cutTime 날것',
    conditions: { 'ARENA.startHold': ARENA.startHold },
    longswordRaw: +res.longswordRaw.toFixed(4),
    calibration: +res.calibration.toFixed(4),
    rows: '__ROWS__',
    diffsFromHand: diffs,
  };
  // 무기 한 줄씩 (읽기 쉽게)
  const rowsText = `{\n${Object.entries(rows).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n')}\n }`;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(file, null, 1).replace('"__ROWS__"', rowsText) + '\n');
  console.log(`생성 측정값 → ${path.relative(root, out)} (보정 배율 ${res.calibration.toFixed(4)}, 롱소드 raw ${res.longswordRaw.toFixed(3)} m, 시작 정지 ${ARENA.startHold} s)`);
  console.log('| 무기 | contact 손 / 생성 | reach 손 / 생성 | clinch 손 / 생성 | 베는 시간 날것 손 / 생성 | 0.30 기준 손 / 날것으로 셈 |');
  console.log('|---|---|---|---|---|---|');
  for (const r of res.rows) {
    const h = MEASURED[r.id];
    const c30 = CUT_TIME_30[r.id];
    const c30calc = h ? +(0.3 * (h[3] / MEASURED.longsword[3])).toFixed(2) : null;
    console.log(`| ${r.id} | ${cell(h?.[0], r.contact)} | ${cell(h?.[1], r.reach)} | ${cell(h?.[2], r.clinch)} | ${cell(h?.[3], r.cutTime)} | ${c30 == null ? '-' : `${f2(c30)} / ${f2(c30calc)}${Math.abs(c30 - c30calc) >= 0.005 ? ' ≠' : ''}`} |`);
  }
  console.log(`손 표와 다른 칸 ${diffs.length} 개 (≠, 0.005 이상) — 비교란: 손 표는 바꾸지 않는다`);
}
