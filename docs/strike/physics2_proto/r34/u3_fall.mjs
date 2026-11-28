// ─────────────────────────────────────────────────────────────
//  u3_fall.mjs (r34 · 뛰기 여섯째 진단 · 안 본 판) — hop_trace / u3_trace 의 스텝 기록(--dump)을 읽어 판마다 디딤 줄과 '넘어지기 앞 무엇이 먼저 벗어났나'를 낸다. 시뮬을 돌리지 않는다(읽기만).
//   node u3_fall.mjs --base=<본 판 dump,쉼표로 여럿> <볼 dump 파일들…> [--rows] [--all]   (채널은 뛰기 시작 0.3 s 뒤부터 — 들어갈 때 튀는 힘을 뺌)   벗어남 금 = 본 판(넘어지지 않은 판) 가운데 가장 큰 값. --rows = 넘어진 판의 디딤 줄을 모두 찍음.
// ─────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = Object.fromEntries(argv.filter((a) => a.startsWith('--')).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return [m[1], m[2] ?? true]; }));
const files = argv.filter((a) => !a.startsWith('--'));
const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
const f2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : (+x).toFixed(d));

/** 한 판을 디딤 줄과 스텝 줄(채널)로 */
function analyse(r) {
  const thr = 0.03 * r.Mg, S = r.steps.filter((x) => x.on);
  if (!S.length) return null;
  const t0 = r.tOn ?? S[0].t;
  const yaw = r.pre?.yaw ?? S[0].chestYaw; // 뛰기 앞 골반 앞쪽 (없으면 가슴)
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  const toF = (dx, dz) => ({ f: dx * fx + dz * fz, r: -dx * fz + dz * fx });
  const c0 = S[0].c;
  const tds = [], ch = [];
  let air = 0, airMax = 0, prev = { F: false, B: false }, cur = null;
  for (const x of S) {
    const on = { F: x.nF > thr, B: x.nB > thr }, any = on.F || on.B;
    const v = toF(x.c.vx, x.c.vz), d = toF(x.c.x - c0.x, x.c.z - c0.z);
    // 받침 가운데(실린 발들 발목 평균)에서 무게중심까지 (앞 · 옆)
    let sup = null; const ks = ['F', 'B'].filter((k) => on[k] && x.x?.[k]);
    if (ks.length) { const ax = ks.reduce((s, k) => s + x.x[k].ax, 0) / ks.length, az = ks.reduce((s, k) => s + x.x[k].az, 0) / ks.length; sup = toF(x.c.x - ax, x.c.z - az); }
    const kn = Math.max(0, ...(x.callsX ?? []).map((q) => q.sh?.knee ?? 0)), an = Math.max(0, ...(x.callsX ?? []).map((q) => q.sh?.ankle ?? 0));
    ch.push({ t: x.t - t0, tilt: x.tilt, pitch: x.chestPitch, vh: Math.hypot(v.f, v.r), vf: v.f, vr: v.r, df: d.f, dr: d.r, supF: sup?.f ?? null, supR: sup?.r ?? null, py: x.py, fy: x.fy / r.Mg, cut: x.x?.cut ? 1 : 0, kn, an, air });
    for (const k of ['F', 'B']) {
      if (on[k] && !prev[k]) {
        const L = x.x?.[k], p = L ? toF(L.ax - x.c.x, L.az - x.c.z) : null;
        tds.push({ n: tds.length + 1, t: x.t - t0, k, flight: air, footF: p?.f ?? null, footR: p?.r ?? null, vf: v.f, vr: v.r, tilt: x.tilt, pitch: x.chestPitch, both: on.F && on.B, fyPk: 0, cutN: 0, nSt: 0, kn: 0, an: 0, py: x.py });
      }
    }
    // 디딤 하나 동안 (마지막 디딤 줄에 모음)
    if (any && tds.length) { const T = tds[tds.length - 1]; T.fyPk = Math.max(T.fyPk, x.fy / r.Mg); T.nSt++; T.cutN += x.x?.cut ? 1 : 0; T.kn = Math.max(T.kn, kn); T.an = Math.max(T.an, an); }
    air = any ? 0 : air + (S[1] ? S[1].t - S[0].t : 1 / 120); airMax = Math.max(airMax, air);
    prev = on;
  }
  return { r, tds, ch, tFall: r.fell ? r.tFall - t0 : null };
}

const CH = [
  ['tilt', (c) => c.tilt, '가슴 기울기°'], ['pitchAbs', (c) => Math.abs(c.pitch), '가슴 숙임 |°|'], ['vh', (c) => c.vh, '수평 빠르기'],
  ['vr', (c) => Math.abs(c.vr), '옆 빠르기'], ['vf', (c) => Math.abs(c.vf), '앞뒤 빠르기'], ['dr', (c) => Math.abs(c.dr), '옆 흐름 m'], ['df', (c) => Math.abs(c.df), '앞뒤 흐름 m'],
  ['supR', (c) => (c.supR == null ? null : Math.abs(c.supR)), '받침-중심 옆 m'], ['supF', (c) => (c.supF == null ? null : Math.abs(c.supF)), '받침-중심 앞뒤 m'],
  ['air', (c) => c.air, '뜬 시간 s'], ['fy', (c) => c.fy, '수직 힘 BW'], ['pyLow', (c) => -c.py, '골반 낮음(-y)'], ['kn', (c) => c.kn, '무릎 몫'], ['an', (c) => c.an, '발목 몫'],
];
// 본 판 금
const baseRuns = String(opt.base ?? '').split(',').filter(Boolean).flatMap(load).map(analyse).filter((a) => a && !a.r.fell);
const lim = {};
for (const [id, g] of CH) { let m = -Infinity; for (const a of baseRuns) for (const c of a.ch) { if (c.t < 0.3) continue; const v = g(c); if (v != null && v > m) m = v; } lim[id] = m; }
console.log(`본 판 금(넘어지지 않은 ${baseRuns.length} 판의 가장 큰 값): ` + CH.map(([id, , nm]) => `${nm} ${f2(lim[id], 3)}`).join(' · '));

const runs = files.flatMap(load).map(analyse).filter(Boolean);
const tally = {};
for (const a of runs) {
  const { r, tds, ch } = a;
  const first = [];
  for (const [id, g, nm] of CH) { const c = ch.find((q) => { if (q.t < 0.3) return false; const v = g(q); return v != null && v > lim[id]; }); if (c) first.push({ id, nm, t: c.t }); }
  first.sort((p, q) => p.t - q.t);
  const pat = tds.slice(0, 12).map((d) => (d.both ? d.k.toLowerCase() : d.k)).join('');
  const nBefore = a.tFall != null ? tds.filter((d) => d.t <= a.tFall).length : tds.length;
  const fl = tds.map((d) => d.flight), short = tds.filter((d) => d.flight <= 0.05).length;
  const end = ch[ch.length - 1];
  console.log(`${r.weapon} 판 ${r.variant}: ${r.fell ? `넘어짐 ${f2(a.tFall)} s(${r.why ?? ''}) · ${nBefore} 째 디딤 뒤` : '버팀'} · 디딤 ${tds.length} · 0.05 s 밑 뜸 ${short} · 끝 흐름 앞 ${f2(end.df)} 옆 ${f2(end.dr)} · 차례 ${pat}` +
    (r.pre ? ` · 앞 상태 골반 ${f2(r.pre.py, 3)} 발 F(${f2(r.pre.F.f)},${f2(r.pre.F.r)}) B(${f2(r.pre.B.f)},${f2(r.pre.B.r)}) 기울기 ${f2(r.pre.tilt, 1)} v ${f2(r.pre.v, 3)}` : ''));
  console.log(`   먼저 벗어남: ${first.slice(0, 6).map((q) => `${q.nm}@${f2(q.t)}`).join(' → ') || '없음'}`);
  if (r.fell) { const k = first[0]?.id ?? 'none'; (tally[k] ||= []).push(`${r.weapon[0]}${r.variant}`); }
  if (r.fell || opt.all) {
    const show = opt.rows || opt.all ? tds : tds.slice(-5);
    for (const d of show) console.log(`     #${d.n} t ${f2(d.t)} ${d.k}${d.both ? '(두 발)' : ''} 뜸 ${f2(d.flight, 3)} 발-중심 앞 ${f2(d.footF)} 옆 ${f2(d.footR)} · v 앞 ${f2(d.vf)} 옆 ${f2(d.vr)} · 기울 ${f2(d.tilt, 1)} 숙임 ${f2(d.pitch, 1)} · 힘 최고 ${f2(d.fyPk)} · 깎임 ${d.cutN}/${d.nSt} · 무릎 ${f2(d.kn)} 발목 ${f2(d.an)} · 골반 ${f2(d.py)}`);
  }
}
console.log('넘어진 판의 처음 벗어난 채널: ' + Object.entries(tally).map(([k, v]) => `${k} ${v.length} (${v.join(' ')})`).join(' · '));
