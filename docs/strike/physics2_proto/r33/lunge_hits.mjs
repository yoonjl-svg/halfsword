// r33 선임 판정 덧 — 런지 거리 장면의 '맞음'이 무엇으로 맞았나 (읽기만 — 몸에 아무것도 걸지 않음 · 원래 함수를 감싸 값을 적을 뿐 · push_window.mjs 와 같은 감싸기)
//  node lunge_hits.mjs --root=<나무> [--w=longsword,rapier] [--seeds=7001-7020] [--adds=0.3,0.45] [--walk=0.6] [--json=파일]
//   장면 = lunge_lib.mjs runLunge (lunge_scene.mjs 와 같은 간격 · 씨앗 갈래) · 탭 뒤 2 s.
//   판마다: 상대 몸통 · 머리에 대한 판정 시도(combat.strike → analyze) 가운데 상처가 난 첫 시도(없으면 가장 센 시도)의
//    갈래(stab 찌르기 · cut 베기 · blunt 멍) · 그때 칼끝 빠르기 · 칼 축 쪽 빠르기 · 맞닿는 빠르기 · 유효 질량 · 관통 셈 대 문턱 · 에너지 · 뻗는 구간(thrustPush) 안인가 · 찌르기 시계 · 무게중심 앞 빠르기
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { makeMeasure, seedList } = await imp('tools/sim/wb_measure.mjs');
const { Combat } = await imp('src/combat.js'); const THREE = await imp('node_modules/three/build/three.module.js');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H);
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // lunge_scene.mjs 와 같음
const WS = String(args.w ?? 'longsword,rapier').split(','); const seeds = seedList(args.seeds ?? '7001-7020'); const ADDS = String(args.adds ?? '0.3,0.45').split(',').map(Number); const WALK = +(args.walk ?? 0.6);
const TORSO = ['chest', 'abdomen', 'pelvis', 'head', 'neck', 'belly', 'spine']; const V = (o) => new THREE.Vector3(o.x, o.y, o.z);
let cur = null;
const oA = Combat.prototype.analyze; Combat.prototype.analyze = function (...a) { const r = oA.apply(this, a); if (cur) cur.lastR = r; return r; };
const oS = Combat.prototype.strike; Combat.prototype.strike = function (pr, point, passing) { if (cur) cur.lastR = null; const r = oS.call(this, pr, point, passing);
  if (cur && cur.P && pr.w.fighter === cur.P && pr.v.fighter === cur.E) { const L = cur.lastR; if (!L) return r; const P = cur.P;
    cur.strikes.push({ i: cur.i, part: pr.v.part, wpart: pr.w.part, E: L.physE ?? L.energy, type: L.type ?? null, sp: L.speed ?? null, mEff: L.mEff ?? null, thr: L.thr ?? null, eff: L.eff ?? null, judged: !!r, push: !!P.skill.thrustPush, ph: P.skill.tap?.t ?? null, tipV: cur.tipV, axV: cur.axV, comV: cur.comV }); }
  return r; };
const out = []; const f = (x, d = 1) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
for (const W of WS) for (const add of ADDS) for (const s of seeds) {
  cur = { P: null, E: null, i: 0, strikes: [], tipV: 0, axV: 0, comV: 0 };
  const r = runLunge(M, H, s, W, { gap: BODY.reach[W] + BODY.front + add, walk: WALK, post: 2.0, wb: true,
    onTap: (G, P, E) => { cur.P = P; cur.E = E; const p = P.bodies.pelvis.translation(), e = E.bodies.pelvis.translation(); const d = Math.hypot(e.x - p.x, e.z - p.z); cur.ux = (e.x - p.x) / d; cur.uz = (e.z - p.z) / d; },
    onStep: (G, P, E, i) => { cur.i = i; const tip = P.bladePoint(1, new THREE.Vector3()); const v = V(P.sword.velocityAtPoint(tip)); const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion().copy(P.sword.rotation()));
      cur.tipV = v.length(); cur.axV = v.dot(ax); cur.comV = P.comVel ? P.comVel.x * cur.ux + P.comVel.z * cur.uz : NaN; } });
  if (!r) { cur = null; continue; }
  const tor = cur.strikes.filter((x) => TORSO.some((t) => x.part === t || x.part?.startsWith?.(t)));
  const first = tor.find((x) => x.judged) ?? null; const best = tor.reduce((m, x) => (m == null || (x.E ?? -1) > (m.E ?? -1) ? x : m), null);
  out.push({ W, add, seed: s, hit: !!r.hit, tHit: r.tHit, fell: !!r.fell, tipPk: r.tipPk, handPk: r.handPk, comPk: r.comPk, wound: first, best, nTor: tor.length });
  cur = null;
}
const med = (a) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
console.log(`앞서 걸음 ${WALK} s · 씨앗 ${seeds[0]}-${seeds[seeds.length - 1]} · 상처가 난 첫 몸통 판정(맞은 판) / 가장 센 몸통 시도(안 맞은 판)`);
console.log('무기 | 넘어 m | 갈래 | 판 | 뻗는 구간 안 | 스텝 가운데 | 칼끝 m/s (그 가운데 칼 축 쪽) | 맞닿는 빠르기 | 무게중심 앞 | 유효 질량 kg | 관통 셈 대 문턱 | 에너지 J (가장 작음 ~ 큼)');
for (const W of WS) for (const add of ADDS) { const R = out.filter((r) => r.W === W && r.add === add); const g = {};
  for (const r of R) { const x = r.hit ? r.wound ?? r.best : r.best; const k = (r.hit ? '맞음' : x ? '닿았으나 상처 없음' : '안 닿음') + (x ? ' · ' + x.type + (x.wpart && x.wpart !== 'blade' ? ' (' + x.wpart + ')' : '') : ''); (g[k] ??= []).push(x); }
  for (const [k, v] of Object.entries(g).sort()) { const s = v.filter(Boolean);
    console.log(`${W} | +${add} | ${k} | ${v.length} | ${s.filter((x) => x.push).length} | ${f(med(s.map((x) => x.i)), 0)} | ${f(med(s.map((x) => x.tipV)))} (${f(med(s.map((x) => x.axV)))}) | ${f(med(s.map((x) => x.sp)))} | ${f(med(s.map((x) => x.comV)), 2)} | ${f(med(s.map((x) => x.mEff)), 2)} | ${f(med(s.map((x) => x.eff)))} 대 ${f(med(s.map((x) => x.thr)))} | ${f(med(s.map((x) => x.E)))} (${s.length ? f(Math.min(...s.map((x) => x.E))) : '-'} ~ ${s.length ? f(Math.max(...s.map((x) => x.E))) : '-'})`); } }
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
