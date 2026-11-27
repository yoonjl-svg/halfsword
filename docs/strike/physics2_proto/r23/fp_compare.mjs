// ─────────────────────────────────────────────────────────────
//  fp_compare.mjs — r23 의 지문 견줌 (r20 fingerprint.mjs 의 네 장면 그대로 + 발 칸 · 양마다 허용 폭 보고). r20 도구는 바꾸지 않음.
//   node fp_compare.mjs --root=<나무> --json=<파일>                 장면을 돌려 적음 (칼끝 · 빠르기 · 골반 + 앞발 · 뒷발 닿음)
//   node fp_compare.mjs --a=<옛 json> --b=<새 json>                  양마다 견줌: 맞음 앞(칼끝 자리 · 빠르기 · 골반) · 맞음 뒤 · 맞음 스텝 · 발 뜸/디딤 스텝 · 칼끝 길 꼴(맞음까지 호 길이로 다시 뽑은 자리)
//   허용 폭(이 대본이 정함 · 재기 값): 자리 0.005 m · 빠르기 0.05 m/s · 스텝 1 (0.0083 s) — 넘으면 '바뀜'
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, readFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const TOL = { pos: 0.005, vel: 0.05, step: 1 };
if (args.root) {
  const ROOT = resolve(String(args.root));
  const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
  const { makeMeasure } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
  const M = makeMeasure(H); const DT = M.DT;
  const SEED = 4801; const REACH = { rapier: 1.791, longsword: 1.701 }, FRONT = 0.11; // r20 fingerprint.mjs 그대로
  const r5 = (x) => Math.round(x * 1e5) / 1e5;
  const pick = (s) => [s.tipx, s.tipy, s.tipz, s.tvx, s.tvy, s.tvz, s.px, s.py, s.pz].map(r5).concat([s.onF ? 1 : 0, s.onB ? 1 : 0, s.pF >= s.pB ? 1 : 0]);
  const scenes = {};
  for (const w of ['rapier', 'longsword']) {
    const { ok, line, o, hits } = M.runThrust(SEED, w, { gap: REACH[w] + FRONT - 0.2, post: 1.5, raw: true });
    scenes[`near_${w}`] = { ok, hits: hits.filter((i) => i >= o).slice(0, 5).map((i) => i - o), rows: line.slice(o).map(pick), pre: line.slice(Math.max(0, o - 30), o).map(pick) };
  }
  { let rows = [], hitsAt = [];
    M.runCut(SEED, 'desc', { form: 'vert', post: 1.5, onStart: (G, P) => { const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (A === P) hitsAt.push(rows.length); }; }, onStep: (G, P) => { const s = M.sample(P); if (s) rows.push(pick(s)); } });
    scenes.cut_desc = { hits: hitsAt.slice(0, 5), rows }; }
  { const G = H.newRound({ walls: false, gap: 1.8, weapon: 'longsword', weapon2: 'longsword', seed: 4803 }); const P = G.player, E = G.enemy;
    P.skill.level = 0.7; P.skill.autoGuard = true; P.handHeld = true; P.inputActive = false; P.handOffset.set(0.02, 0.52);
    for (let i = 0; i < Math.round(1.5 / DT); i++) { P.move.set(0, 0); G.step(); }
    const c0 = G.clashes; const rows = [], clashAt = [];
    for (let k = 0; k < Math.round(1.0 / DT); k++) { const off = P.handOffset; const d = off.y + 0.5; if (d > 11 * DT) off.y -= 11 * DT; else off.y = -0.5; P.inputActive = d > 1e-6; const c1 = G.clashes; P.move.set(0, 0); G.step(); if (G.clashes > c1) clashAt.push(k); const sp = M.sample(P), se = M.sample(E); if (sp) rows.push(pick(sp).concat(se ? pick(se) : [])); }
    M.freeWorld(G); scenes.parry = { clashes: G.clashes - c0, hits: clashAt.slice(0, 5), rows }; }
  writeFileSync(String(args.json), JSON.stringify({ dt: DT, cols: 'tip xyz · tipVel xyz · pelvis xyz · onF · onB · F 가 앞 (막기: 치는 쪽 12 칸 + 막는 쪽 12 칸)', scenes }));
  console.log('적음', args.json);
}
if (args.a && args.b) {
  const A = JSON.parse(readFileSync(String(args.a), 'utf8')), B = JSON.parse(readFileSync(String(args.b), 'utf8')); const DT = A.dt;
  const f = (x, d = 4) => (x == null ? '-' : Number.isFinite(x) ? x.toFixed(d) : String(x));
  const W = 12; let all0 = true; const rep = {};
  const lift = (rows, k) => { for (let i = 1; i + 2 < rows.length; i++) if (rows[i - 1][k] && !rows[i][k] && !rows[i + 1][k] && !rows[i + 2][k]) return i; return null; };
  const land = (rows, k, from) => { if (from == null) return null; for (let i = from + 1; i + 2 < rows.length; i++) if (rows[i][k] && rows[i + 1][k] && rows[i + 2][k]) return i; return null; };
  const arc = (rows, end) => { const P = rows.slice(0, end + 1).map((r) => [r[0], r[1], r[2]]); const L = [0]; for (let i = 1; i < P.length; i++) L.push(L[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1], P[i][2] - P[i - 1][2])); const T = L[L.length - 1]; const out = []; for (let s = 0; s <= 50; s++) { const t = (T * s) / 50; let j = 1; while (j < L.length - 1 && L[j] < t) j++; const u = L[j] > L[j - 1] ? (t - L[j - 1]) / (L[j] - L[j - 1]) : 0; out.push(P[j - 1].map((v, c) => v + (P[j][c] - v) * u)); } return { pts: out, len: T }; };
  for (const k of Object.keys(A.scenes)) {
    const a = A.scenes[k], b = B.scenes[k]; if (!b) continue; const n = Math.min(a.rows.length, b.rows.length);
    const ha = a.hits[0] ?? null, hb = b.hits[0] ?? null; const cut = Math.min(ha ?? n, hb ?? n);
    const dmax = (i0, i1, cols) => { let d = 0; for (let i = i0; i < i1; i++) for (const c of cols) d = Math.max(d, Math.abs(a.rows[i][c] - b.rows[i][c])); return d; };
    const groups = k === 'parry' ? [0, W] : [0];
    const r = { hitA: ha, hitB: hb, dHit: ha != null && hb != null ? hb - ha : ha === hb ? 0 : Infinity, steps: [a.rows.length, b.rows.length] };
    r.preTipPos = Math.max(...groups.map((g) => dmax(0, cut, [g, g + 1, g + 2]))); r.preTipVel = Math.max(...groups.map((g) => dmax(0, cut, [g + 3, g + 4, g + 5]))); r.prePelvis = Math.max(...groups.map((g) => dmax(0, cut, [g + 6, g + 7, g + 8])));
    r.postTipPos = Math.max(...groups.map((g) => dmax(cut, n, [g, g + 1, g + 2]))); r.postPelvis = Math.max(...groups.map((g) => dmax(cut, n, [g + 6, g + 7, g + 8])));
    const fr = a.rows[0][11] ? 9 : 10; // 시작 때 앞발 칸
    r.frontLift = [lift(a.rows, fr), lift(b.rows, fr)]; r.frontLand = [land(a.rows, fr, r.frontLift[0]), land(b.rows, fr, r.frontLift[1])];
    if (ha != null && hb != null && ha >= 2 && hb >= 2) { const pa = arc(a.rows, ha), pb = arc(b.rows, hb); r.pathShape = Math.max(...pa.pts.map((p, i) => Math.hypot(p[0] - pb.pts[i][0], p[1] - pb.pts[i][1], p[2] - pb.pts[i][2]))); r.pathLen = [pa.len, pb.len]; }
    const moved = (r.preTipPos > TOL.pos) || (r.preTipVel > TOL.vel) || (r.prePelvis > TOL.pos) || Math.abs(r.dHit) > 0 || r.postTipPos > TOL.pos;
    if (r.preTipPos > 0 || r.preTipVel > 0 || r.prePelvis > 0 || r.postTipPos > 0 || r.postPelvis > 0 || r.dHit !== 0) all0 = false;
    rep[k] = r;
    console.log(`${k.padEnd(15)} 맞음 스텝 ${ha} → ${hb} (차 ${r.dHit}) · 맞음 앞 칼끝 자리 최대 차 ${f(r.preTipPos)} m (허용 ${TOL.pos}) · 빠르기 ${f(r.preTipVel)} m/s (허용 ${TOL.vel}) · 골반 ${f(r.prePelvis)} m · 맞음 뒤 칼끝 ${f(r.postTipPos)} · 골반 ${f(r.postPelvis)} m`);
    console.log(`${''.padEnd(15)} 앞발 뜸 스텝 ${r.frontLift[0]} → ${r.frontLift[1]} · 디딤 ${r.frontLand[0]} → ${r.frontLand[1]}${r.pathShape != null ? ` · 칼끝 길 꼴(맞음까지 호 길이로 51 점) 최대 차 ${f(r.pathShape)} m · 길이 ${f(r.pathLen[0], 3)} → ${f(r.pathLen[1], 3)} m` : ''} · ${moved ? '바뀜' : r.preTipPos > 0 || r.postTipPos > 0 ? '허용 안' : '같음(0)'}`);
    if (k.startsWith('near')) { const mx = (rows) => { let m = -Infinity, at = null; for (let i = 0; i < rows.length; i++) if (rows[i][0] > m) { m = rows[i][0]; at = i; } return [m, at]; }; r.tipMaxX = [mx(a.rows), mx(b.rows)]; console.log(`${''.padEnd(15)} 칼끝 가장 앞(x · 스텝) ${r.tipMaxX[0][0].toFixed(3)} @${r.tipMaxX[0][1]} → ${r.tipMaxX[1][0].toFixed(3)} @${r.tipMaxX[1][1]}`); }
  }
  console.log(`모두 0: ${all0}`);
  if (args.json) writeFileSync(String(args.json), JSON.stringify({ TOL, rep }));
}
