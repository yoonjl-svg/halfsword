// r33 T2 첫 일 — 가까운 사람 레이피어 탭 찌르기에서 '맞음'과 '스침'이 왜 갈리는가를 판정 순간의 기록으로 봄 (읽기만 — 몸에 아무것도 걸지 않음 · 원래 함수를 감싸 값을 적을 뿐)
//  node push_window.mjs --root=<나무> --base=<바탕 gate json>[,<json>…] [--w=rapier] [--json=파일]
//  줄 = 바탕 json 의 가까운 사람 길 줄 모두(씨앗 · gap 그대로) · 장면 = wb_measure.runThrust (post 3.2 s) — r28/miss_class.mjs 와 같은 틀.
//  줄마다: 탭 뒤 칼끝을 뻗는 구간(skill.thrustPush)이 켜진 스텝 [처음, 끝] · 상대 몸통/머리에 대한 첫 판정 시도(combat.strike)의 스텝 · 그때 thrustPush · 찌르기 시계 · 칼끝 빠르기 · 칼 축 쪽 빠르기 ·
//   골반 앞 빠르기 · 판정 에너지 · 판정됨 여부 · 그때 팔이 다 펴졌는가(armFull).
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const { Combat } = await import(pathToFileURL(join(ROOT, 'src/combat.js')).href);
const { STRIKE } = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
const THREE = await import(pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href);
const M = makeMeasure(H); const W = String(args.w ?? 'rapier');
const sel = String(args.base).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).rows).filter((r) => r.scene === 'near' && r.path === 'human' && r.weapon === W);
const TORSO = ['chest', 'abdomen', 'pelvis', 'head', 'neck', 'belly', 'spine'];
const V = (o) => new THREE.Vector3(o.x, o.y, o.z);
let cur = null;
const oA = Combat.prototype.analyze; Combat.prototype.analyze = function (...a) { const r = oA.apply(this, a); if (cur) cur.lastR = r; return r; };
const oS = Combat.prototype.strike; Combat.prototype.strike = function (pr, point, passing) { if (cur) cur.lastR = null; const r = oS.call(this, pr, point, passing);
  if (cur && pr.w.fighter === cur.P && pr.v.fighter === cur.E) { const P = cur.P; const L = cur.lastR;
    if (!L) return r; /* 분석까지 안 간 닿음(빠르기 0.5 m/s 아래 따위)은 뺌 */ cur.strikes.push({ i: cur.i, part: pr.v.part, E: L.physE ?? L.energy, type: L.type ?? null, sp: L.speed ?? null, mEff: L.mEff ?? null, mFree: L.mFree ?? null, thr: L.thr ?? null, eff: L.eff ?? null, pass: L.pass ?? null, keys: cur.keys ??= Object.keys(L).join(','), judged: !!r, push: !!P.skill.thrustPush, ph: P.skill.tap?.t ?? null, tipV: cur.tipV, axV: cur.axV, pelV: cur.pelV, full: !!P.armFull, state: P.state }); } return r; };
const out = []; const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
for (const row of sel) {
  cur = { P: null, E: null, i: 0, strikes: [], tipV: 0, axV: 0, pelV: 0, on: null, off: null, tapEnd: null, pelPk: 0, fullAt: null };
  const res = M.runThrust(row.seed, W, { gap: row.gap, pelvisGap: row.gap, post: 3.2, raw: true,
    onTap: (G, P, E) => { cur.P = P; cur.E = E; cur.fwd = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading)); },
    onStep: (G, P, E, i) => { if (i > 240) return; cur.i = i; const tip = P.bladePoint(1, new THREE.Vector3()); const v = V(P.sword.velocityAtPoint(tip)); const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().copy(P.sword.rotation()));
      cur.tipV = v.length(); cur.axV = v.dot(ax); cur.pelV = V(P.bodies.pelvis.linvel()).dot(cur.fwd); cur.pelPk = Math.max(cur.pelPk, cur.pelV);
      if (P.skill.thrustPush) { if (cur.on == null) cur.on = i; cur.off = i; } if (cur.tapEnd == null && i > 0 && !P.skill.tap) cur.tapEnd = i; if (cur.fullAt == null && P.armFull) cur.fullAt = i; } });
  const hits = res.hits.filter((k) => k >= res.o).map((k) => k - res.o);
  const tor = cur.strikes.filter((s) => TORSO.some((t) => s.part === t || s.part?.startsWith?.(t)));
  const s0 = tor.reduce((m, s) => (m == null || (s.E ?? -1) > (m.E ?? -1) ? s : m), null); const sJ = tor.find((s) => s.judged) ?? null; // 대표 = 가장 센 몸통 시도 (당기는 동안 스친 0.1 J 따위를 거름)
  const r = { seed: row.seed, gap: +row.gap.toFixed(3), baseWhip: row.tipPk > 8, hit: hits[0] ?? null, on: cur.on, off: cur.off, tapEnd: cur.tapEnd, fullAt: cur.fullAt, pelPk: cur.pelPk, first: s0, judged: sJ, nTor: tor.length, nAll: cur.strikes.length };
  out.push(r);
  console.log(`${r.seed} gap ${r.gap} ${r.baseWhip ? '휘' : '  '} 맞음 ${String(r.hit ?? '-').padStart(3)} | 뻗는 구간 ${r.on ?? '-'} ~ ${r.off ?? '-'} · 팔 다 폄 @${r.fullAt ?? '-'} · 골반 최고 ${f(r.pelPk, 2)} m/s | 몸통 가장 센 판정 시도 ${s0 ? `@${s0.i} ${s0.part} 뻗는 중 ${s0.push ? '예' : '아니오'} 시계 ${f(s0.ph, 3)} 칼끝 ${f(s0.tipV)} (축 ${f(s0.axV)}) m/s 골반 ${f(s0.pelV, 2)} m/s E ${f(s0.E)} J ${s0.type ?? '-'} (유효 질량 ${f(s0.mEff, 2)} kg · 관통 셈 ${f(s0.eff)} 대 문턱 ${f(s0.thr)}) ${s0.judged ? '판정됨' : '문턱 아래'} 팔폄 ${s0.full ? '예' : '아니오'}` : '없음'} · 몸통 시도 ${r.nTor}`);
  cur = null;
}
const hitR = out.filter((r) => r.hit != null), touch = out.filter((r) => r.hit == null && r.first), none = out.filter((r) => r.hit == null && !r.first);
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const sum = (name, rs) => { const s = rs.map((r) => r.first).filter(Boolean); console.log(`${name}: 줄 ${rs.length} · 가장 센 몸통 시도가 뻗는 구간 안 ${s.filter((x) => x.push).length} / ${s.length} · 그 스텝 가운데 ${med(s.map((x) => x.i))} (구간 끝 가운데 ${med(rs.map((r) => r.off))}) · 칼끝 ${f(med(s.map((x) => x.tipV)))} m/s (축 ${f(med(s.map((x) => x.axV)))}) · 골반 ${f(med(s.map((x) => x.pelV)), 2)} m/s · E 가운데 ${f(med(s.map((x) => x.E)))} J (${f(Math.min(...s.map((x) => x.E ?? Infinity)))} ~ ${f(Math.max(...s.map((x) => x.E ?? -Infinity)))})`); };
console.log(`\n줄 ${out.length} · 판정 문턱 ${STRIKE.minEnergy} J · 팔 무게 thrustAssist ${STRIKE.thrustAssist} kg (뻗는 구간에만) · 그 밖 armAssist ${STRIKE.armAssist} kg`);
sum('맞은 줄', hitR); sum('닿았으나 상처 없는 줄', touch); console.log(`몸통에 안 닿은 줄 ${none.length}`); console.log('analyze 칸: ' + (out.find((r) => r.first)?.first.keys ?? '-'));
const byT = {}; for (const r of out) if (r.first) { const k = (r.hit != null ? '맞음' : '상처 없음') + ' · ' + r.first.type + ' · 뻗는 중 ' + (r.first.push ? '예' : '아니오') + ' · 팔 다 폄 ' + (r.first.full ? '뒤' : '앞'); (byT[k] ??= []).push(r.first); }
for (const [k, v] of Object.entries(byT).sort()) console.log(`  ${k}: ${v.length} 줄 · 스텝 가운데 ${med(v.map((x) => x.i))} · 칼끝 ${f(med(v.map((x) => x.tipV)))} m/s · 축 ${f(med(v.map((x) => x.axV)))} m/s · 맞닿는 빠르기 ${f(med(v.map((x) => x.sp)))} m/s · 유효 질량 ${f(med(v.map((x) => x.mEff)), 2)} kg · 관통 셈 ${f(med(v.map((x) => x.eff)))} 대 문턱 ${f(med(v.map((x) => x.thr)))} · E ${f(med(v.map((x) => x.E)))} J (${f(Math.min(...v.map((x) => x.E)))} ~ ${f(Math.max(...v.map((x) => x.E)))})`);
if (args.json) writeFileSync(String(args.json), JSON.stringify({ rows: out }));
