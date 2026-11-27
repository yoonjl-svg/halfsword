// r33 고치기 — 런지 한 판의 발 고르기를 스텝마다 적음 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음)
//  node fix_probe.mjs --root=<나무> --w=longsword --seed=4031 --add=0.45 [--walk=0.6] [--from=0] [--to=1.6] [--every=1]
//   장면 = lunge_lib.mjs runLunge (lunge_recover.mjs 와 같은 간격 · 씨앗 갈래) · 앞쪽(fwd) = 탭 때 바라보는 쪽 · x 는 탭 때 뒷발 자리에서 앞으로 잰 거리
//   줄: 탭 뒤 t · 발 F/B 마다 [딛음 · 걸음 종류 · 수직 ÷ mg · x · r 엉덩−디딘 자리 수평 · y 발바닥/발끝 높이 · b 발 몸체 x · 뜬 발은 → 디딜 자리 x · u 걸음 몫] · 무게중심 x · 캡처 점 x · 무게중심 앞 빠르기 · capDist · drawPending · req · 상태
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure } = await imp('tools/sim/wb_measure.mjs');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H); const { THREE, DT } = H;
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 } }; // lunge_scene.mjs 와 같음
const W = String(args.w ?? 'longsword'); const seed = +(args.seed ?? 4031); const add = +(args.add ?? 0.45);
const FROM = +(args.from ?? 0), TO = +(args.to ?? 1.6), EVERY = +(args.every ?? 1);
let fw = null, x0 = 0; const f2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const px = (p) => p.x * fw.x + p.z * fw.z;
runLunge(M, H, seed, W, { gap: BODY.reach[W] + BODY.front + add, walk: +(args.walk ?? 0.6), post: TO + 0.05,
  onTap: (G, P) => { fw = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading)); const g = P.gait; x0 = Math.min(px(g.legs.F.plant), px(g.legs.B.plant));
    console.log(`${W} ${seed} +${add} · 자세 길이 ${g.P.guardLength} · weightFront ${g.P.weightFront} · 앞발 ${g.frontLeg(fw)}`);
    console.log('t | F 딛음 종류 N x | B 딛음 종류 N x | com x · cap x · v | capDist | drawP | req | 상태'); },
  onStep: (G, P, E, i) => { const t = (i + 1) * DT; if (t < FROM || t > TO || i % EVERY) return; const g = P.gait; const L = g.legs; const c = P.com; const v = P.comVel; const w0 = P.legDrive?.w0 || P.capW || 3.3;
    const leg = (l) => `${l.stance ? '딛' : '뜸'} ${String(l.kind ?? '-').padEnd(6)} ${f2((l.N || 0) / g.Mg)} ${f2(px(l.plant) - x0)} r${f2(Math.hypot(l.hip.x - l.plant.x, l.hip.z - l.plant.z))} y${f2(l.soleY, 3)}/${f2(l.toeY, 3)}`;
    const cx = c ? px(c) - x0 : NaN; const cap = c && v ? cx + px(v) / w0 : NaN;
    const fb = (k) => f2(px(P.bodies['foot' + k].translation()) - x0); const tg = (l) => (l.stance || !l.target ? '' : ` →${f2(px(l.target) - x0)} u${f2(l.t / l.T)}`);
    console.log(`${f2(t, 3)} | ${leg(L.F)} b${fb('F')}${tg(L.F)} | ${leg(L.B)} b${fb('B')}${tg(L.B)} | ${f2(cx)} · ${f2(cap)} · ${f2(v ? px(v) : NaN)} | ${f2(P.legDrive?.capDist)} | ${g.drawPending ? `${f2(g.drawPending.t)}${g.drawPending.fall ? 'f' : ''}` : '-'} | ${g.req ? `${g.req.kind} ${g.req.fwd}` : '-'} | ${P.state}`); } });
