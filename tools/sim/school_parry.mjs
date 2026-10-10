// 유파 막기 자리 물리 점검 (10/10 빌린 칸 걷어내기 — docs/strike/school_borrow_clear_2026-10-10.md §1)
//  motion_lab parry 와 같은 방법: 치는 쪽 = 롱소드(스크립트로 기술 길을 11 m/s 로), 막는 쪽 = 이 무기(본판 길 — MOTION.lib 켬, 유파 자세표 그대로)가
//  한 자리를 들고 버틴다. 다른 점: 본판 길로 잰다(생성자가 유파 자세표를 입힘) · 14 패드에 독일 표의 highL 자리 [−0.3, 0.1] 를 더한다 ·
//  줄마다 그 유파 꾸러미의 막기 자리(art.school.parry)와 독일 막기 자리(GERMAN = longsword 꾸러미)를 표시한다.
//  막음 = 그 판에 치는 쪽 상처가 0. 고르는 기준은 원전이고 이 수는 보고용이다.
//  10/11: 유파 막기 자리 몸꼴(TRADITIONS[유파].parryCover — 중국 거정세·어거세·요략세)이 있는 줄은 '덧씌운 자리' 후보를 더한다: 같은 패드를 들고 AI 를 막는 중(mode 'defend')으로 두어
//   본판과 같은 덧씌우기(frames.js installCover — 덮는 시간 0.08 s)로 몸꼴을 입힌다. 표에 ◀유파 = 본판이 쓰는 자리(덧씌움 있으면 덧씌운 쪽).
//   node tools/sim/school_parry.mjs <무기id>      (PARRY_GAPS=1.3,1.45,1.6,1.75 · PARRY_SEEDS=7 — 판 수 = 간격 × 씨앗 · PARRY_ONLY=1 = 유파·독일 자리만 · PARRY_LINES=lowL,thrust = 그 줄만)
import { newRound, DT } from './harness_m.mjs';
import { MOTION } from '../../src/motion_library.js';
import { TECH, G as PAD } from '../../src/ai_techniques.js';
import { GUARD_BASE } from '../../src/guards.js';
import { SCHOOLS } from '../../src/schools.js';
import { WEAPONS } from '../../src/weapons.js';
import { resolveSwordArt } from '../../src/sword_art.js';
import { TRADITIONS } from '../../src/schools.js';

const id = process.argv[2] ?? 'rapier';
const W = WEAPONS[id];
if (!W) throw new Error(`무기 없음: ${id}`);
MOTION.lib = true; // 본판 길
const GAPS = (process.env.PARRY_GAPS ?? '1.3,1.45,1.6,1.75').split(',').map(Number);
const SEEDS = (process.env.PARRY_SEEDS ?? '7').split(',').map(Number);
const LINES = [['highL', 'zornhau'], ['highR', 'zornhauL'], ['highC', 'oberhau'], ['lowL', 'unterhau'], ['lowR', 'unterhauL'], ['thrust', 'stichPflug']];
const SPD = 11;
const art = resolveSwordArt(W, null);
const own = art.school.parry;
const ger = SCHOOLS.longsword.parry;
const names = art.names;
const covers = TRADITIONS[art.tradition]?.parryCover ?? {}; // 줄 → 막기 자리 몸꼴 (덧씌우기)
const padKey = (p) => Object.entries(PAD).find(([, v]) => v[0] === p[0] && v[1] === p[1])?.[0] ?? `[${p}]`;
const CANDS0 = [...GUARD_BASE.map((g, i) => ({ pad: g.pad, label: `${padKey(g.pad)} ${names[i]?.name ?? g.name}` })), { pad: [-0.3, 0.1], label: '[-0.3,0.1] (독일 highL 자리)' }];
const ONLY = process.env.PARRY_ONLY === '1'; // 유파·독일 자리만 (빠른 판)
const setPad = (P, x, y) => {
  P.handOffset.set(x, y);
  P.skill.aimRaw?.set?.(x, y);
};
const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
const out = {};
console.log(`${id} (${art.tradition}) 막기 점검 — 판 ${GAPS.length * SEEDS.length} / 자리 · 간격 ${GAPS} · 씨앗 ${SEEDS}`);
const LSEL = process.env.PARRY_LINES ? process.env.PARRY_LINES.split(',') : null; // 줄 고르기 (예: lowL,thrust)
for (const [line, tn] of LINES) {
  if (LSEL && !LSEL.includes(line)) continue;
  const tech = TECH.find((t) => t.name === tn);
  const rows = [];
  // 유파·독일 자리가 표 패드와 꼭 같지 않으면(예: G.sideL [−0.52, 0.06] — 표 자리는 [−0.52, 0.03]) 그 자리를 따로 더한다
  const extra = [own[line], ger[line]].filter((p, i, a) => a.findIndex((q) => same(q, p)) === i && !CANDS0.some((c) => same(c.pad, p))).map((p) => ({ pad: p, label: `${padKey(p)} (G 자리, 가까운 표 자리 섞임)` }));
  const cov = covers[line];
  const covC = cov ? [{ pad: own[line], cover: true, label: `${padKey(own[line])} + 덧씌움 ${cov.name}` }] : [];
  const ALL = [...CANDS0, ...extra, ...covC];
  const CANDS = ONLY ? ALL.filter((c) => same(c.pad, own[line]) || same(c.pad, ger[line])) : ALL;
  for (const c of CANDS) {
    let hit = 0, clash = 0, n = 0;
    for (const gap of GAPS) for (const seed of SEEDS) {
      const Gm = newRound({ walls: false, weapon: 'longsword', weapon2: id, seed, gap });
      Gm.ai.update = () => {};
      if (c.cover) Object.assign(Gm.ai, { mode: 'defend', defVoid: false, defLine: line }); // 막는 중 → installCover 가 그 줄의 몸꼴을 덧씌움
      const A = Gm.player, D = Gm.enemy;
      setPad(D, c.pad[0], c.pad[1]);
      setPad(A, tech.from[0], tech.from[1]);
      for (let t = 0; t < 0.8; t += DT) Gm.step();
      const pts = tech.path.map((q) => q.slice());
      let cur = tech.from.slice();
      const w0 = Gm.wounds.length, c0 = Gm.clashes ?? 0;
      for (let t = 0; t < 1.0; t += DT) {
        if (pts.length) {
          const [tx, ty] = pts[0];
          const dx = tx - cur[0], dy = ty - cur[1], dd = Math.hypot(dx, dy), st = SPD * DT;
          if (dd > st) cur = [cur[0] + (dx / dd) * st, cur[1] + (dy / dd) * st];
          else (cur = [tx, ty]), pts.shift();
        }
        setPad(A, cur[0], cur[1]);
        if (tech.kind === 'thrust' && t < DT) A.skill.thrust({ step: false });
        Gm.step();
      }
      if (Gm.wounds.slice(w0).some((w) => w.att === A)) hit++;
      clash += (Gm.clashes ?? 0) - c0;
      n++;
    }
    rows.push({ ...c, block: n - hit, n, clash });
  }
  out[line] = rows;
  const isOwn = (r) => same(r.pad, own[line]) && !!r.cover === !!cov; // 본판이 쓰는 자리 (덧씌움 있으면 덧씌운 쪽)
  const mark = (r) => `${isOwn(r) ? ' ◀유파' : ''}${same(r.pad, ger[line]) && !r.cover ? ' ◁독일' : ''}`;
  const sorted = [...rows].sort((a, b) => b.block - a.block || b.clash - a.clash);
  console.log(`\n${line} (${tn}): 유파 자리 ${padKey(own[line])} · 독일 자리 ${padKey(ger[line])}`);
  for (const r of sorted) console.log(`  ${r.block}/${r.n} 막음 · 칼 부딪침 ${r.clash} · ${r.label}${mark(r)}`);
}
const pick = (line, p, own = false) => out[line].find((r) => same(r.pad, p) && (own ? !!r.cover === !!covers[line] : !r.cover));
console.log('\n| 줄 | 독일 자리 막음 | 유파 자리 막음 |');
for (const [line] of LINES) {
  if (!out[line]) continue;
  const g = pick(line, ger[line]), o = pick(line, own[line], true);
  console.log(`| ${line} | ${padKey(ger[line])} ${g ? `${g.block}/${g.n}` : '-'} | ${padKey(own[line])}${covers[line] ? ` + ${covers[line].name}` : ''} ${o ? `${o.block}/${o.n}` : '-'} |`);
}
