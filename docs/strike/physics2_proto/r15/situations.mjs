// ─────────────────────────────────────────────────────────────
//  situations.mjs — 상처 없이 넘어진 몸이 넘어지기 1.0 · 0.5 · 0.25 s 앞에 어떤 꼴이었나 (물리 2.0 · 15 번째 판). 재 둔 파일만 읽는다 — 시뮬레이션 없음.
//
//   node docs/strike/physics2_proto/r15/situations.mjs --root=<트리(fall_mech.mjs 가 있는)> --dir=<fall_*.json · ring_*.json 폴더> [--offs=0,300,600,624,648,672] [--rows] [--json=<파일>]
//
//  들어오는 것: tools/sim/fall_context.mjs --mech --ringOut 의 넘어짐 기록 + 앞 3 s 고리(스텝 2 개마다 하나 · 1/60 s) · 원인 가름은 tools/sim/fall_mech.mjs 의 classify 그대로.
//  재는 것 (넘어지기 1.0 · 0.5 · 0.25 s 앞 · 고리의 마지막 '서 있음' 줄을 넘어진 때로 봄):
//   무게중심 빠르기 크기 · 쪽(몸 앞 기준 각 · 0 = 앞 · +90 = 오른쪽) · 딛은 발 쪽에 대한 빠르기(딛은 발에서 무게중심을 향하는 쪽 성분 — +면 딛은 발에서 멀어짐)
//   두 발의 무게중심에 대한 자리(앞 · 오른쪽 m) · 딛은 발(엔진 닿음) · 두 무릎 굽힘(°) · 떠 있는 걸음 꼴(walk · catch · req · settle …) · 부탁 걸음 꼴(lunge · pass) · 제 칼(windup · cut · recover · defend · withdraw · idle) · 무기
//  꼴(situation) 가름 — 원인 셋(cap:short · sink:knee · tilt:other)을 아래 규칙으로 (차례대로 처음 맞는 것):
//   A 옆으로 쏠린 받아 딛기 (cap:short · 넘어지기 0.5 s 앞 빠르기 쪽이 몸 옆(45 ~ 135°) · 두 발이 무게중심 한쪽에)
//   B 뒤로 쏠린 받아 딛기 (cap:short 나머지 — 오늘 10 번 모두 빠르기 쪽이 몸 뒤쪽)
//   C 한 발 딛음 · 굽은 무릎이 꺼짐 (sink:knee · 넘어지기 0.5 s 앞 ~ 그때까지 한 발 딛음이 절반 넘음)
//   D 두 발 딛은 채 꺼짐 (sink:knee 나머지 — 오늘 0 번)
//   E 몸통이 기욺 (tilt:other)
// ─────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const DIR = resolve(String(args.dir));
const OFFS = String(args.offs ?? '0,300,600,624,648,672').split(',').map(Number);
const { classify } = await import(pathToFileURL(join(ROOT, 'tools/sim/fall_mech.mjs')).href);
const D2R = Math.PI / 180, DT = 1 / 60;
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const k = (s.length - 1) * p, i = Math.floor(k); return s[i] + (s[Math.min(s.length - 1, i + 1)] - s[i]) * (k - i); };
const f = (x, d = 2) => (x == null || !isFinite(x) ? '-' : x.toFixed(d));

/** 고리 한 줄의 꼴 */
function snap(x) {
  const v = Math.hypot(x.vf, x.vr), ang = Math.atan2(x.vr, x.vf) / D2R;
  const dn = { F: !!x.kF?.on, B: !!x.kB?.on };
  const nDown = +dn.F + +dn.B;
  // 딛은 발(하나만 딛었으면 그 발 · 둘이면 가운데) 에서 무게중심으로의 쪽 — 빠르기의 그 쪽 성분
  const ft = nDown === 1 ? (dn.F ? x.fF : x.fB) : [(x.fF[0] + x.fB[0]) / 2, (x.fF[1] + x.fB[1]) / 2];
  const l = Math.hypot(ft[0], ft[1]) || 1, away = (-ft[0] * x.vf + -ft[1] * x.vr) / l;
  // 두 발이 무게중심의 한쪽(옆)에 있나 — 빠르기 쪽에 수직인 선 말고 몸 옆으로 봄
  const sameSideR = Math.sign(x.fF[1]) === Math.sign(x.fB[1]) && Math.min(Math.abs(x.fF[1]), Math.abs(x.fB[1])) > 0.02;
  const sameSideV = (() => { const ux = x.vf / (v || 1), uz = x.vr / (v || 1); const a = x.fF[0] * ux + x.fF[1] * uz, b = x.fB[0] * ux + x.fB[1] * uz; return v > 0.2 && a < 0 && b < 0; })(); // 두 발 모두 무게중심 뒤(가는 쪽 거꾸로)
  return {
    v, ang, away, nDown, dnF: dn.F, dnB: dn.B, fF: x.fF.slice(0, 2), fB: x.fB.slice(0, 2), kneeF: (x.kF?.phi ?? 0) / D2R, kneeB: (x.kB?.phi ?? 0) / D2R,
    krF: x.kF?.kr ?? 0, krB: x.kB?.kr ?? 0, swF: x.F, swB: x.B, reqK: x.reqK ?? null, stroke: x.stroke, sameSideR, sameSideV, y: x.y, tilt: x.tilt, cap: x.cap ?? 0, pend: x.pend,
    mx: x.mx ?? 0, my: x.my ?? 0, armM: x.armM ?? 0, stanceKnee: nDown === 1 ? (dn.F ? x.kF.phi : x.kB.phi) / D2R : Math.max(x.kF?.phi ?? 0, x.kB?.phi ?? 0) / D2R,
  };
}

const rows = [];
let nSelf = 0; // 상처 없는 따로 일어난 넘어짐 (고리가 없거나 서 있음 줄이 없는 것도 셈)
for (const o of OFFS) {
  const F = JSON.parse(readFileSync(join(DIR, `fall_${o}.json`), 'utf8'));
  const RG = JSON.parse(readFileSync(join(DIR, `ring_${o}.json`), 'utf8'));
  const by = new Map(RG.falls.map((x) => [x.key, x]));
  for (const r of F.falls) {
    if (r.dup || !r.self) continue;
    nSelf++;
    const g = by.get(`${r.seed}:${r.who}:${r.t}`); if (!g) continue;
    const m = classify(r, g.ring);
    const R = g.ring.filter((x) => x.st === 'stand'); const N = R.length; if (!N) continue;
    const at = (s) => R[Math.max(0, N - 1 - Math.round(s / DT))];
    const S = { 1: snap(at(1.0)), 0.5: snap(at(0.5)), 0.25: snap(at(0.25)) };
    // 0.5 s 앞 ~ 넘어짐: 한 발 딛음 몫 · 떠 있던 걸음 꼴 · 가장 깊은 딛은 무릎
    const W = R.slice(Math.max(0, N - 1 - Math.round(0.5 / DT)));
    const single = W.filter((x) => (+!!x.kF?.on + +!!x.kB?.on) === 1).length / W.length;
    const kinds = [...new Set(R.slice(Math.max(0, N - 1 - Math.round(1.0 / DT))).flatMap((x) => [x.F, x.B]).filter(Boolean))];
    const deep = Math.max(...W.map((x) => Math.max(x.kF?.on ? x.kF.phi : 0, x.kB?.on ? x.kB.phi : 0))) / D2R;
    // 마지막 뜬 발: 뜬 스텝 · 디딘 스텝 → 날아간 시간 (넘어지기 앞 1.5 s 안의 마지막 걸음)
    let lastSw = null;
    for (const k of ['F', 'B']) { let e = -1, s = -1; for (let j = N - 1; j > 0; j--) { if (e < 0 && R[j - 1][k] && !R[j][k]) e = j; if (e >= 0 && !R[j - 1][k] && R[j][k]) { s = j; break; } } if (e > 0 && s > 0 && (!lastSw || e > lastSw.e)) lastSw = { k, e, s, kind: R[s][k], flight: (e - s) * DT, before: (N - 1 - e) * DT }; }
    rows.push({ off: o, seed: r.seed, who: r.who, t: r.t, weapon: r.weapon, cause: m.cause, stroke: m.stroke, reqK: m.reqK, contact: r.pushSum >= 40 ? 'big' : r.touchSteps > 0 ? 'light' : r.joltMax > 0 || r.bindSteps > 0 ? 'clash' : 'none', S, single, kinds, deep, lastSw, onset: r.onsetBefore });
  }
}

function sitOf(r) {
  const s = r.S[0.5];
  const side = Math.abs(s.ang) > 45 && Math.abs(s.ang) < 135;
  if (r.cause === 'cap:short') return side ? 'A' : 'B';
  if (r.cause === 'sink:knee') return r.single > 0.5 ? 'C' : 'D';  // D 는 오늘 0 번 (sink:knee 23 모두 한 발 딛음이 절반 넘음)
  if (r.cause === 'tilt:other') return 'E';
  return null;
}
const NAMES = { A: '옆으로 쏠린 받아 딛기 (cap:short)', B: '뒤로 쏠린 받아 딛기 (cap:short)', C: '한 발 딛음 · 굽은 무릎이 꺼짐 (sink:knee)', D: '두 발 딛은 채 꺼짐 (sink:knee)', E: '몸통이 기욺 (tilt:other)' };
for (const r of rows) r.sit = sitOf(r);

if (args.rows) for (const r of rows) {
  const p = (s) => `v ${f(s.v)}@${f(s.ang, 0)}° 멀어짐 ${f(s.away)} 딛음 ${s.dnF ? 'F' : '-'}${s.dnB ? 'B' : '-'} F(${s.fF.map((x) => f(x)).join(',')}) B(${s.fB.map((x) => f(x)).join(',')}) 무릎 ${f(s.kneeF, 0)}/${f(s.kneeB, 0)} 뜬 ${s.swF ?? '-'}/${s.swB ?? '-'} ${s.reqK ?? ''} ${s.stroke}`;
  console.log(`${r.sit ?? '·'} ${r.cause.padEnd(10)} ${String(r.off + '/' + r.seed).padStart(8)} ${r.who} ${r.weapon.padEnd(10)} ${r.contact.padEnd(5)} 한발 ${f(r.single)} 깊은무릎 ${f(r.deep, 0)} 마지막걸음 ${r.lastSw ? `${r.lastSw.kind} ${f(r.lastSw.flight)}s 앞 ${f(r.lastSw.before)}` : '-'} 꼴 ${r.kinds.join('+')}\n     1.0 ${p(r.S[1])}\n     0.5 ${p(r.S[0.5])}\n    0.25 ${p(r.S[0.25])}`);
}

// ── 꼴 표 ──
const cnt = (L, fn) => { const m = new Map(); for (const r of L) for (const k of [].concat(fn(r))) m.set(k, (m.get(k) ?? 0) + 1); return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · '); };
const rng = (a, d = 2) => `${f(q(a, 0.5), d)} [${f(q(a, 0.1), d)} ~ ${f(q(a, 0.9), d)}]`;
const out = { total: null, sits: {} };
console.log(`■ 상처 없는 넘어짐 ${nSelf} (고리로 잴 수 있는 것 ${rows.length}) · 원인 ${cnt(rows, (r) => r.cause)}`);
let covered = 0;
for (const k of Object.keys(NAMES)) {
  const L = rows.filter((r) => r.sit === k); if (!L.length) continue; covered += L.length;
  console.log(`\n■ ${k} ${NAMES[k]} — ${L.length} 번 (${(100 * L.length / nSelf).toFixed(0)} %) · 무기 ${cnt(L, (r) => r.weapon)} · 닿음 ${cnt(L, (r) => r.contact)}`);
  const o = { n: L.length, name: NAMES[k], at: {} };
  for (const t of [1, 0.5, 0.25]) {
    const s = L.map((r) => r.S[t]);
    const line = {
      v: q(s.map((x) => x.v), 0.5), ang: q(s.map((x) => Math.abs(x.ang)), 0.5), away: q(s.map((x) => x.away), 0.5),
      single: s.filter((x) => x.nDown === 1).length / s.length, stanceKnee: q(s.map((x) => x.stanceKnee), 0.5),
    };
    o.at[t] = line;
    console.log(`  ${String(t).padStart(4)} s 앞: 빠르기 ${rng(s.map((x) => x.v))} m/s · 쪽 |각| ${rng(s.map((x) => Math.abs(x.ang)), 0)}° · 딛은 발에서 멀어지는 성분 ${rng(s.map((x) => x.away))} · 한 발 딛음 ${(100 * line.single).toFixed(0)} % · 두 발 무게중심 한 옆 ${(100 * s.filter((x) => x.sameSideR).length / s.length).toFixed(0)} % · 두 발 모두 가는 쪽 뒤 ${(100 * s.filter((x) => x.sameSideV).length / s.length).toFixed(0)} %`);
    console.log(`           앞발 자리(앞, 옆) ${rng(s.map((x) => x.fF[0]))}, ${rng(s.map((x) => Math.abs(x.fF[1])))} · 뒷발 ${rng(s.map((x) => x.fB[0]))}, ${rng(s.map((x) => Math.abs(x.fB[1])))} · 무릎 앞/뒤 ${rng(s.map((x) => x.kneeF), 0)} / ${rng(s.map((x) => x.kneeB), 0)}° · 딛은 무릎 ${rng(s.map((x) => x.stanceKnee), 0)}° · 골반 ${rng(s.map((x) => x.y))} m · 기울기 ${rng(s.map((x) => x.tilt), 0)}°`);
    console.log(`           조종(옆 · 앞) ${rng(s.map((x) => x.mx))}, ${rng(s.map((x) => x.my))} · 팔 짝힘 ${rng(s.map((x) => x.armM), 0)} N·m`);
    console.log(`           뜬 걸음 ${cnt(s, (x) => [x.swF, x.swB].filter(Boolean).length ? [x.swF, x.swB].filter(Boolean) : ['없음'])} · 부탁 ${cnt(s, (x) => x.reqK ?? '없음')} · 칼 ${cnt(s, (x) => x.stroke)}`);
  }
  const sw = L.map((r) => r.lastSw).filter(Boolean);
  o.single = q(L.map((r) => r.single), 0.5); o.deep = q(L.map((r) => r.deep), 0.5); o.flight = q(sw.map((x) => x.flight), 0.5);
  console.log(`  끝 0.5 s 한 발 딛음 몫 ${rng(L.map((r) => r.single))} · 가장 깊은 딛은 무릎 ${rng(L.map((r) => r.deep), 0)}° · 마지막 걸음 꼴 ${cnt(sw, (x) => x.kind)} · 날아간 시간 ${rng(sw.map((x) => x.flight))} s · 디딘 뒤 넘어질 때까지 ${rng(sw.map((x) => x.before))} s · 1 s 안 걸음 꼴 ${cnt(L, (r) => r.kinds.length ? r.kinds : ['없음'])}`);
  out.sits[k] = o;
}
console.log(`\n■ 꼴이 덮는 몫: ${covered}/${nSelf} (${(100 * covered / nSelf).toFixed(0)} %) · 안 덮인 원인 ${cnt(rows.filter((r) => !r.sit), (r) => r.cause)}`);
out.covered = covered; out.total = nSelf;
if (args.json) writeFileSync(String(args.json), JSON.stringify({ ...out, rows: rows.map((r) => ({ ...r })) }, null, 1));
