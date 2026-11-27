// r28 A4 — 바탕에서 휘둘린 가까운 찌르기 줄(사람 길 · 레이피어 · 관문 tipPk > 문턱)을 새 칸에서 다시 돌려, 안 맞은 줄마다 까닭을 가름 (읽기만 — 몸에 아무것도 걸지 않음)
//  node miss_class.mjs --root=<나무> --base=<바탕 gate json>[,<json>…] [--thr=8] [--w=rapier] [--json=파일]
//  줄은 바탕 json 에서 고르고(씨앗 · 간격 gap = 관문이 runThrust 에 준 그 값 · pelvisGap 같음) 새 나무로 같은 장면(runThrust · post 3.2 s)을 돌림.
//  갈래 (차례대로 · 처음 맞는 것):
//   hit       맞음(onWound) — 갈래 밖
//   arm       칼이 상대 팔(uarm · farm)에 닿음(접촉 쌍) 그리고 몸통 · 머리에는 판정 없음 — 상대 팔에 막히거나 밀림 (관문 장면은 상대 칼 충돌을 끔 → 칼에 막힘은 없음)
//   noWound   칼이 몸통 · 머리 · 목 · 골반에 닿음(combat.strike 불림) 그러나 판정 문턱(STRIKE.minEnergy J) 밑 — 그 에너지 · 그때 칼끝 빠르기
//   offLine   안 닿음 · 가장 가까울 때 칼끝 → 몸 겉 벡터의 칼 축 옆 성분이 앞 성분보다 큼 (옆으로 빗나감 cm)
//   short     안 닿음 · 앞 성분이 더 큼 (못 미침 cm)
//  함께 적는 것: 가장 가까울 때 칼끝 → 몸 겉 거리 · 그 스텝 · 칼끝 가장 빠름 · 칼끝이 탭 때 골반보다 앞선 최고(m) · 팔이 다 펴진 스텝 수(armFull) · 골반이 앞으로 간 거리 · 앞발 뜸/디딤
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const { Combat } = await import(pathToFileURL(join(ROOT, 'src/combat.js')).href);
const { STRIKE } = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
const THREE = await import(pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href);
const M = makeMeasure(H);
const THR = +(args.thr ?? 8), W = String(args.w ?? 'rapier');
const base = String(args.base).split(',').flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).rows);
const sel = base.filter((r) => r.scene === 'near' && r.path === 'human' && r.weapon === W && r.tipPk > THR);
const TORSO = ['chest', 'abdomen', 'pelvis', 'head', 'neck', 'belly', 'spine'], ARMS = ['uarmS', 'farmS', 'uarmO', 'farmO', 'handS', 'handO'];
let cur = null; // 이 판의 기록
const oA = Combat.prototype.analyze; Combat.prototype.analyze = function (...a) { const r = oA.apply(this, a); if (cur) cur.lastR = r; return r; };
const oS = Combat.prototype.strike; Combat.prototype.strike = function (pr, point, passing) { if (cur) cur.lastR = null; const r = oS.call(this, pr, point, passing);
  if (cur && pr.w.fighter === cur.P && pr.v.fighter === cur.E) cur.strikes.push({ i: cur.i, part: pr.v.part, E: cur.lastR ? (cur.lastR.physE ?? cur.lastR.energy) : null, judged: !!r, tipV: cur.tipV }); return r; };
const V = (o) => new THREE.Vector3(o.x, o.y, o.z);
const out = []; const f1 = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
for (const row of sel) {
  cur = { P: null, E: null, i: 0, strikes: [], tipV: 0, best: { d: Infinity }, armTouch: 0, torsoTouch: 0, reach: -Infinity, full: 0, tipPk: 0, pel0: null, pelMax: 0, footLift: null, footLand: null };
  const res = M.runThrust(row.seed, W, { gap: row.gap, pelvisGap: row.gap, post: 3.2, raw: true,
    onTap: (G, P, E) => { cur.P = P; cur.E = E; const pp = P.bodies.pelvis.translation(); cur.pel0 = V(pp); cur.fwd = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading)); cur.tor = TORSO.filter((k) => E.bodies[k]).flatMap((k) => { const b = E.bodies[k]; const c = []; for (let j = 0; j < b.numColliders(); j++) c.push(b.collider(j)); return c; }); cur.arm = ARMS.filter((k) => E.bodies[k]).flatMap((k) => { const b = E.bodies[k]; const c = []; for (let j = 0; j < b.numColliders(); j++) c.push(b.collider(j)); return c; }); },
    onStep: (G, P, E, i) => { if (i > 120) return; cur.i = i; const tip = P.bladePoint(1, new THREE.Vector3()); const tv = V(P.sword.velocityAtPoint(tip)).length(); cur.tipV = tv; cur.tipPk = Math.max(cur.tipPk, tv);
      cur.reach = Math.max(cur.reach, tip.clone().sub(cur.pel0).dot(cur.fwd)); if (P.armFull) cur.full++;
      const pp = V(P.bodies.pelvis.translation()); cur.pelMax = Math.max(cur.pelMax, pp.clone().sub(cur.pel0).dot(cur.fwd));
      for (const c of cur.tor) { const pj = c.projectPoint(tip, true); if (!pj) continue; const q = V(pj.point); const d = pj.isInside ? 0 : q.distanceTo(tip); if (d < cur.best.d) { const b = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().copy(P.sword.rotation())); const v = q.clone().sub(tip); const al = v.dot(b); cur.best = { d, i, along: al, side: v.clone().addScaledVector(b, -al).length(), tipV: tv }; } }
      for (const sc of P.swordColliders) { for (const c of cur.arm) G.world.contactPair(sc, c, (m) => { if (m.numContacts() > 0) cur.armTouch++; }); for (const c of cur.tor) G.world.contactPair(sc, c, (m) => { if (m.numContacts() > 0) cur.torsoTouch++; }); }
      const onF = P.legDrive?.legs?.F?.on; if (cur.footLift == null && i > 0 && cur.prevF && !onF) cur.footLift = i; if (cur.footLift != null && cur.footLand == null && onF) cur.footLand = i; cur.prevF = onF; } });
  const hits = res.hits.filter((k) => k >= res.o).map((k) => k - res.o);
  const torsoStr = cur.strikes.filter((s) => TORSO.some((t) => s.part?.startsWith?.(t) || s.part === t));
  const armStr = cur.strikes.filter((s) => !torsoStr.includes(s));
  let cls;
  if (hits.length) cls = 'hit';
  else if (torsoStr.length) cls = 'noWound';
  else if (cur.armTouch > 0 || armStr.length) cls = 'arm';
  else cls = cur.best.side > cur.best.along ? 'offLine' : 'short';
  const r = { seed: row.seed, gap: +row.gap.toFixed(3), cls, hit: hits[0] ?? null, baseHit: row.hit, minD: cur.best.d, minAt: cur.best.i, along: cur.best.along, side: cur.best.side, tipAtMin: cur.best.tipV, tipPk: cur.tipPk, reach: cur.reach, fullSteps: cur.full, pelFwd: cur.pelMax, footLift: cur.footLift, footLand: cur.footLand, armTouch: cur.armTouch, torsoTouch: cur.torsoTouch,
    strikes: cur.strikes.slice(0, 6).map((s) => ({ i: s.i, part: s.part, E: s.E, judged: s.judged, tipV: s.tipV })) };
  out.push(r);
  console.log(`${r.seed} gap ${r.gap} ${cls.padEnd(7)} 맞음 ${r.hit ?? '-'} | 가장 가까움 ${f1(r.minD * 100)} cm @${r.minAt} (앞 ${f1(r.along * 100)} · 옆 ${f1(r.side * 100)} cm · 칼끝 ${f1(r.tipAtMin)} m/s) | 칼끝 최고 ${f1(r.tipPk)} m/s · 앞섬 ${f1(r.reach, 2)} m · 팔 다 폄 ${r.fullSteps} 스텝 · 골반 앞 ${f1(r.pelFwd, 2)} m · 앞발 뜸 ${r.footLift ?? '-'} 디딤 ${r.footLand ?? '-'} | 팔 닿음 ${r.armTouch} 몸 닿음 ${r.torsoTouch} | 판정 시도 ${r.strikes.map((s) => `${s.part}:${f1(s.E)}J${s.judged ? '✓' : ''}`).join(' ')}`);
  cur = null;
}
const cnt = {}; for (const r of out) cnt[r.cls] = (cnt[r.cls] ?? 0) + 1;
console.log(`줄 ${out.length} · 갈래 ${JSON.stringify(cnt)} · 판정 문턱 STRIKE.minEnergy ${STRIKE.minEnergy} J`);
if (args.json) writeFileSync(String(args.json), JSON.stringify({ thr: THR, minEnergy: STRIKE.minEnergy, rows: out }));
