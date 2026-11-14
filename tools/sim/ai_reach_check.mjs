// ─────────────────────────────────────────────────────────────
//  ai_reach_check.mjs — AI 의 무기 · 거리 셈 점검 (11/14 — 설계안 docs/design/ai_school_baseline_2026-11-14.md §6 · 부록 B).
//   재기만 한다. 게임 값(src)은 그대로 — 이 프로세스 안에서만 ARENA.startHold · SCHOOL_ART.table 을 잴 때 잠깐 바꾼다.
//
//  무기마다 한 번씩 (긴 판 없음 · 무기 하나 ≈ 1 s):
//   ① AI 가 믿는 내 칼 — 그 무기 유파 꾸러미(sword_art.js resolveSwordArt — 인물 없는 AI 와 같음)의 art.measure
//      맞닿기 contact · 칼끝 거리 reach · 붙음 clinch · 베는 시간 cutTime · reachScale(ai.js 생성자와 같은 셈) ·
//      칼을 내는 거리 need = contact + 기술 reach × reachScale + 0.05 (분노의 베기 · 쟁기 찌르기 — ai.js attack 'approach')
//   ② AI 가 믿는 상대 칼 — 롱소드 AI 가 이 무기를 상대할 때 foeReachBase(measureFor(w)) = 그 무기 reach + 0.05 (ai.js — 간 보는 거리 · 위협 읽기의 바탕)
//   ③ 지금 몸으로 다시 잰 값 — 손 표(src/weapon_measured.js)를 만든 생성기와 같은 잣대(tools/sim/weapon_measure.mjs measureSwing · measureThrust):
//      혼자 분노의 베기 한 번 · 칼날 70 % 가 머리 높이를 '내려오며' 지나는 가장 먼 앞 거리(--down) · 시작 정지 0 · 이베리아 자세표 끔 · 이탈리아 유파 무기는 탭 찌르기 잣대.
//      같은 실행 롱소드에 대한 비율을 롱소드 손 값(1.57 · 1.80 · 0.30)에 붙임 — 손 표 줄을 붙인 규칙과 같다.
//      ※ 한 번 휘두른 칼의 기하(kinematic)라 싸움에서 실제로 상처가 나는 거리와는 다를 수 있다(플랑베르주 10/29 기록 — 싸움 칼 1 만 2 천 개로 잰 '실제 닿는 거리' 2.1 m).
//   ④ 칼 길이 비 어림 — (손잡이 + 칼날) ÷ 롱소드 1.18 × 1.57 · 1.80 (손 표에 줄이 없는 무기가 받는 값 — sword_art.js measureScaler)
//   무게 — 부품 질량 합 kg · 손에서 무게 중심까지 m · 손 둘레 관성 kg·m² 어림(부품 중심 m·a² + 길이 몫) — 휘두름 · 되돌림이 무거운 정도
//  표시: 손 표 ↔ ③ 차이 ≥ 0.10 m '△' · 손 표 ↔ ④ 차이 ≥ 0.15 m '◇' · reachScale 이 칼 비율(내 맞닿기 ÷ 롱소드 맞닿기)과 0.05 넘게 다르면 '◦'
//
//  node tools/sim/ai_reach_check.mjs [무기id…] [--md] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { isMain } from './is_main.mjs';
import { ARENA } from '../../src/config.js';
import { WEAPONS, getWeapon } from '../../src/weapons.js';
import { MEASURED, CUT_TIME_30, WEAPON_BASELINE } from '../../src/weapon_measured.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { SCHOOL_ART, traditionOf } from '../../src/schools.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { foeReachBase } from '../../src/ai.js';
import { measureSwing, measureThrust, rulerOf } from './weapon_measure.mjs';

const LS = { contact: 1.57, reach: 1.8, cut: 0.3 }; // 롱소드 손 값 (손 표 줄을 붙이는 바탕)

/** AI 가 믿는 내 칼 (ai.js 생성자와 같은 셈 — 인물 없는 AI · 숙련도 3) */
export function aiOwn(id) {
  const w = getWeapon(id);
  const art = resolveSwordArt(w, null, { proficiency: 3 });
  const M = art.measure;
  const baseM = art.school.measure;
  const reachScale = !w || w.id === 'longsword' ? 1 : (w.techReachScale ?? M.contact / baseM.contact);
  const need = (t) => +(M.contact + (TECH_BY_NAME[t]?.reach ?? 0) * reachScale + 0.05).toFixed(3);
  return { tradition: art.tradition, contact: M.contact, reach: M.reach, clinch: M.clinch, cutTime: M.cutTime, reachScale, needCut: need('zornhau'), needThrust: need('stichPflug'), want: +(M.reach + 0.2).toFixed(3) };
}

/** 롱소드 AI 가 이 무기를 상대할 때 어림하는 상대 칼 닿는 거리 (ai.js foeReachBase) */
export function aiFoe(id) {
  const ls = resolveSwordArt(getWeapon('longsword'), null, { proficiency: 3 });
  const w = getWeapon(id);
  return +foeReachBase(ls.measureFor(w), { swordArt: { tradition: traditionOf(w) } }).toFixed(3);
}

/** 무게 어림: 부품 질량 합 · 손(칼 원점)에서 무게 중심 · 손 둘레 관성 */
export function massOf(id) {
  let parts;
  try { parts = getWeapon(id).buildParts?.({}) ?? []; } catch { return null; }
  if (!parts.length) return null;
  const len = (sh) => (sh[0] === 'box' ? sh[2] : sh[1]);
  let m = 0, ma = 0, I = 0;
  for (const q of parts) {
    const mi = q[2][0];
    const a = q[1];
    m += mi;
    ma += mi * a;
    I += mi * a * a + (mi * len(q[0]) ** 2) / 3;
  }
  return { kg: +m.toFixed(2), com: +(ma / m).toFixed(3), I: +I.toFixed(3) };
}

/** 지금 몸으로 다시 잰 값 (생성기와 같은 잣대 · 같은 실행 롱소드 비율 → 롱소드 손 값) */
export function measureNow(ids) {
  const hold = ARENA.startHold;
  ARENA.startHold = 0;
  const table = SCHOOL_ART.table;
  try {
    const lsC = measureSwing('longsword', { down: true });
    const lsR = measureSwing('longsword', { down: true, lunge: true });
    let lsT = null;
    const out = {};
    for (const id of ids) {
      if (rulerOf(id) === 'thrust') {
        lsT ??= measureThrust('longsword');
        const m = measureThrust(id);
        const k = m.raw / lsT.raw;
        out[id] = { contact: +(LS.contact * k).toFixed(2), reach: +(LS.reach * k).toFixed(2), cut: LS.cut, ruler: 'thrust', tip: +(LS.contact * (m.tip / lsT.raw)).toFixed(2) };
        continue;
      }
      SCHOOL_ART.table = traditionOf(getWeapon(id)) === 'iberian' ? false : table; // 생성기 조건: 이베리아 자세표에서는 앞무게 칼을 못 잰다 (손 표 주석)
      const c = id === 'longsword' ? lsC : measureSwing(id, { down: true });
      const r = id === 'longsword' ? lsR : measureSwing(id, { down: true, lunge: true });
      SCHOOL_ART.table = table;
      out[id] = { contact: +(LS.contact * (c.raw / lsC.raw)).toFixed(2), reach: +(LS.reach * (r.raw / lsR.raw)).toFixed(2), cut: +(LS.cut * (c.cutTime / lsC.cutTime)).toFixed(2), ruler: 'zornhau' };
    }
    return out;
  } finally {
    ARENA.startHold = hold;
    SCHOOL_ART.table = table;
  }
}

export function check(ids) {
  const now = measureNow(ids);
  const lsC = MEASURED.longsword[0];
  return ids.map((id) => {
    const w = getWeapon(id);
    const row = MEASURED[id] ?? null;
    const own = aiOwn(id);
    const L = (w.bladeLength + w.hiltLength) / WEAPON_BASELINE;
    const geo = { contact: +(LS.contact * L).toFixed(2), reach: +(LS.reach * L).toFixed(2) };
    const n = now[id];
    const scaleWant = +(own.contact / lsC).toFixed(3);
    const flags = [];
    if (!row) flags.push('표 없음');
    if (n && (Math.abs(own.contact - n.contact) >= 0.1 || Math.abs(own.reach - n.reach) >= 0.1)) flags.push('△');
    if (Math.abs(own.contact - geo.contact) >= 0.15 || Math.abs(own.reach - geo.reach) >= 0.15) flags.push('◇');
    if (Math.abs(own.reachScale - scaleWant) > 0.05) flags.push('◦');
    return { id, grip: w.grip, len: +(w.bladeLength + w.hiltLength).toFixed(3), mass: massOf(id), own, foe: aiFoe(id), now: n, geo, cutTable: CUT_TIME_30[id] ?? null, scaleWant, flags };
  });
}

function md(rows) {
  const f = (v) => (v == null ? '-' : typeof v === 'number' ? v.toFixed(2) : v);
  const head = '| 무기 | 유파 | 쥠 | 길이 m | kg · 무게중심 m · 관성 | AI 내 칼 맞닿기 / 칼끝 | 다시 잰 맞닿기 / 칼끝 | 길이 비 어림 | 칼 내는 거리 베기 / 찌르기 | 롱소드 AI 의 상대 칼 어림 | 베는 시간 AI / 다시 잼 | reachScale / 칼 비율 | 표시 |';
  const sep = '|' + '---|'.repeat(13);
  const body = rows.map((r) => `| ${r.id} | ${r.own.tradition} | ${r.grip} | ${f(r.len)} | ${r.mass ? `${r.mass.kg} · ${r.mass.com} · ${r.mass.I}` : '-'} | ${f(r.own.contact)} / ${f(r.own.reach)} | ${r.now ? `${f(r.now.contact)} / ${f(r.now.reach)}${r.now.ruler === 'thrust' ? ' (찌르기)' : ''}` : '-'} | ${f(r.geo.contact)} / ${f(r.geo.reach)} | ${f(r.own.needCut)} / ${f(r.own.needThrust)} | ${f(r.foe)} | ${f(r.own.cutTime)} / ${f(r.now?.cut)} | ${f(r.own.reachScale)} / ${f(r.scaleWant)} | ${r.flags.join(' ')} |`);
  return [head, sep, ...body].join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const ids0 = args.filter((a) => !a.startsWith('--'));
  const ids = ids0.length ? ids0 : Object.keys(WEAPONS).filter((id) => !WEAPONS[id].gun);
  const rows = check(ids);
  const json = args.find((a) => a.startsWith('--json='));
  if (json) writeFileSync(json.slice(7), JSON.stringify(rows, null, 1));
  if (args.includes('--md')) console.log(md(rows));
  else for (const r of rows) console.log(`${r.id.padEnd(18)} AI ${r.own.contact.toFixed(2)}/${r.own.reach.toFixed(2)}  잼 ${r.now ? `${r.now.contact.toFixed(2)}/${r.now.reach.toFixed(2)}` : '-'}  길이비 ${r.geo.contact}/${r.geo.reach}  상대어림 ${r.foe}  need ${r.own.needCut}/${r.own.needThrust}  cut ${r.own.cutTime}/${r.now?.cut ?? '-'}  rs ${r.own.reachScale.toFixed(2)}/${r.scaleWant}  ${r.flags.join(' ')}`);
}
