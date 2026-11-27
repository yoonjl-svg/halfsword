// ─────────────────────────────────────────────────────────────
//  fingerprint.mjs — 굳은 금 3 (r14 §3): 가까운 찌르기 · 내려베기 · 막기 하나의 길 지문. 재기만 한다.
//   스텝마다 칼끝 자리(x y z) · 칼끝 빠르기(x y z) · 골반 자리 · 맞음/부딪힘 스텝을 적는다. 나중 나무를 수 하나하나 견준다.
//   장면 (씨앗 4801 하나 · 정해진 값):
//    near_rapier · near_longsword — 사람 탭 찌르기 · 서 있는 과녁 · 간격 = 팔 닿음 + 몸통 − 0.2 m (wb_gate 의 가까운 찌르기 가운데)
//    cut_desc — 사람 손가락 세로 내려베기(지붕 → 바보) · r13 장면
//    parry — 내(사람 손가락)가 세로로 내려베고 상대 AI 가 막는다 (씨앗 4803 · 간격 1.8 m · 부딪힘 있고 막는 쪽 상처 0). 대본으로 막는 자리를 든 판은 부딪혀도 상처가 났다 — 그래서 게임의 AI 막기를 씀
//  node docs/strike/physics2_proto/r20/fingerprint.mjs --root=<나무> [--json=파일] [--compare=기준 json]
//   --compare: 장면마다 가장 큰 차이(칼끝 자리 m · 빠르기 m/s · 맞음 스텝)와 처음 갈린 스텝을 찍는다. 오늘 대 오늘 = 0.
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, readFileSync } from 'node:fs';
import { makeMeasure } from '../../../../tools/sim/wb_measure.mjs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const M = makeMeasure(H); const DT = M.DT;
const SEED = 4801; const REACH = { rapier: 1.791, longsword: 1.701 }, FRONT = 0.11;
const r5 = (x) => Math.round(x * 1e5) / 1e5;
const pick = (s) => [s.tipx, s.tipy, s.tipz, s.tvx, s.tvy, s.tvz, s.px, s.py, s.pz].map(r5);

const scenes = {};
for (const w of ['rapier', 'longsword']) {
  const { ok, line, o, hits } = M.runThrust(SEED, w, { gap: REACH[w] + FRONT - 0.2, post: 1.5, raw: true });
  scenes[`near_${w}`] = { ok, start: o, hits: hits.filter((i) => i >= o).slice(0, 5), rows: line.slice(o).map(pick) };
}
{ // 내려베기
  let rows = [], hitsAt = [];
  M.runCut(SEED, 'desc', { form: 'vert', post: 1.5, onStart: (G, P, E) => { const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (A === P) hitsAt.push(rows.length); }; }, onStep: (G, P) => { const s = M.sample(P); if (s) rows.push(pick(s)); } });
  scenes.cut_desc = { hits: hitsAt.slice(0, 5), rows };
}
{ // 막기 하나: 나(사람 손가락)가 세로로 내려베고, 상대 AI(롱소드 · 씨앗 4803 · 간격 1.8 m)가 막는다 — 부딪힘이 있고 막는 쪽 상처 0 인 판을 골랐다(4801 ~ 4803 × 1.6 · 1.8 가운데)
  const G = H.newRound({ walls: false, gap: 1.8, weapon: 'longsword', weapon2: 'longsword', seed: 4803 }); const P = G.player, E = G.enemy;
  P.skill.level = 0.7; P.skill.autoGuard = true; P.handHeld = true; P.inputActive = false; P.handOffset.set(0.02, 0.52);
  let woundE = 0; const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (Vc === E) woundE++; };
  for (let i = 0; i < Math.round(1.5 / DT); i++) { P.move.set(0, 0); G.step(); }
  const c0 = G.clashes; woundE = 0; const rowsP = [], rowsE = [], clashAt = [];
  for (let k = 0; k < Math.round(1.0 / DT); k++) {
    const off = P.handOffset; const d = off.y + 0.5; if (d > 11 * DT) off.y -= 11 * DT; else off.y = -0.5; P.inputActive = d > 1e-6;
    const c1 = G.clashes; P.move.set(0, 0); G.step(); if (G.clashes > c1) clashAt.push(k);
    const sp = M.sample(P), se = M.sample(E); if (sp) rowsP.push(pick(sp)); if (se) rowsE.push(pick(se));
  }
  M.freeWorld(G);
  scenes.parry = { clashes: G.clashes - c0, woundToDefender: woundE, hits: clashAt.slice(0, 5), rows: rowsP.map((r, i) => r.concat(rowsE[i] ?? [])) };
}
for (const [k, v] of Object.entries(scenes)) console.log(`${k.padEnd(15)} 스텝 ${v.rows.length} · 맞음/부딪힘 스텝 ${JSON.stringify(v.hits)}${v.clashes != null ? ` · 부딪힘 ${v.clashes} · 막는 쪽 상처 ${v.woundToDefender}` : ''} · 끝 칼끝 ${JSON.stringify(v.rows[v.rows.length - 1]?.slice(0, 3))}`);
if (args.json) writeFileSync(String(args.json), JSON.stringify({ seed: SEED, dt: DT, cols: 'tip xyz · tipVel xyz · pelvis xyz (막기: 막는 쪽 9 칸 + 치는 쪽 9 칸)', scenes }));
if (args.compare) {
  const B = JSON.parse(readFileSync(String(args.compare), 'utf8')).scenes; let worst = 0;
  for (const [k, v] of Object.entries(scenes)) {
    const b = B[k]; if (!b) { console.log(`  ${k}: 기준에 없음`); continue; }
    let dPos = 0, dVel = 0, first = null; const n = Math.min(v.rows.length, b.rows.length);
    for (let i = 0; i < n; i++) for (let c = 0; c < v.rows[i].length; c++) { const d = Math.abs(v.rows[i][c] - b.rows[i][c]); if (d > 0 && first == null) first = i; if (c % 9 >= 3 && c % 9 < 6) dVel = Math.max(dVel, d); else dPos = Math.max(dPos, d); }
    const dHit = JSON.stringify(v.hits) === JSON.stringify(b.hits) ? 0 : Math.max(...v.hits.map((h, i) => Math.abs(h - (b.hits[i] ?? Infinity))), b.hits.length !== v.hits.length ? Infinity : 0);
    worst = Math.max(worst, dPos, dVel, dHit, v.rows.length !== b.rows.length ? Infinity : 0);
    console.log(`  견줌 ${k.padEnd(15)} 자리 최대 차 ${dPos.toFixed(5)} m · 빠르기 최대 차 ${dVel.toFixed(5)} m/s · 맞음 스텝 차 ${dHit} · 스텝 수 ${v.rows.length}/${b.rows.length} · 처음 갈린 스텝 ${first ?? '-'}`);
  }
  console.log(`지문 가장 큰 차이: ${worst}`);
}
