// r28 P1 덧칸 — 관문 사람 길 찌르기 줄(가까운 · 먼 · 두 무기)마다 칼끝이 찌르기 선에서 옆으로 가장 멀리 간 거리 (읽기만)
//  node side_rows.mjs --root=<나무> --base=<그 묶음의 바탕 gate json> [--gate=<이 나무의 같은 묶음 gate json — tipPk 견줌>] [--post=1.2] [--json=파일]
//   줄(씨앗 · 장면 · 무기 · 간격 gap)은 바탕 json 에서 읽고(간격은 씨앗에서 나와 칸마다 같음) 이 나무로 같은 장면(runThrust · gap = pelvisGap = 그 줄 값)을 탭부터 post 초 돌림
//   찌르기 선 = 탭 때 칼자루(손)에서 탭 때 상대 가슴으로 가는 곧은 선 (세계) · 옆 거리 = 칼끝에서 그 선까지 수직 거리 · 창 안의 가장 큰 값
//   창 = 탭부터 탭이 자세로 돌아오기 시작할 때(찌르기 시계 ≥ 겨눔 + 뻗음 + 머묾)까지 — 휘둘림은 이 안에서 일어남 (r28 trace_whip) · 돌아오는 칼은 셈 밖
//   tip = 같은 창의 칼끝 가장 빠름 (관문 tipPk 는 창이 달라 같지 않을 수 있음 — 다른 줄 수를 적기만)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { readFileSync, writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { makeMeasure } = await import(pathToFileURL(join(ROOT, 'tools/sim/wb_measure.mjs')).href);
const THREE = await import(pathToFileURL(join(ROOT, 'node_modules/three/build/three.module.js')).href);
const M = makeMeasure(H); const post = +(args.post ?? 1.2);
const rows = JSON.parse(readFileSync(String(args.base), 'utf8')).rows.filter((r) => r.path === 'human' && (r.scene === 'near' || r.scene === 'far') && r.valid);
const V = (o) => new THREE.Vector3(o.x, o.y, o.z); const out = [];
const gate = JSON.parse(readFileSync(String(args.gate ?? args.base), 'utf8')).rows; const gTip = (r) => gate.find((x) => x.seed === r.seed && x.scene === r.scene && x.weapon === r.weapon && x.path === 'human' && (x.rep ?? null) === (r.rep ?? null))?.tipPk;
for (const r of rows) {
  let A = null, n = null, side = 0, tip = 0, done = false; const hits = [];
  const res = M.runThrust(r.seed, r.weapon, { gap: r.gap, pelvisGap: r.gap, post, raw: true,
    onTap: (G, P, E) => { A = V(H.handPos(P)); n = V(E.bodies.chest.translation()).sub(A).normalize(); },
    onStep: (G, P, E, i) => { if (done) return; const tp = P.skill.tap; if (i > 0 && (!tp || tp.t >= tp.K.aim + tp.K.extend + tp.K.hold)) { done = true; return; } /* 창 = 탭부터 자세로 돌아오기 시작할 때까지 */ const t = P.bladePoint(1, new THREE.Vector3()); const v = t.clone().sub(A); side = Math.max(side, v.addScaledVector(n, -v.dot(n)).length()); tip = Math.max(tip, V(P.sword.velocityAtPoint(t)).length()); } });
  out.push({ seed: r.seed, scene: r.scene, weapon: r.weapon, rep: r.rep ?? null, side, tip, gateTip: gTip(r), hit: res.hits.some((k) => k >= res.o) });
}
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
console.log('| 장면 · 무기 | 줄 | 칼끝 > 8 m/s 줄 | 옆 거리 가운데 m | 옆 가장 큼 m | 옆 > 0.5 m 줄 | 칼끝이 관문 tipPk 와 0.05 넘게 다른 줄 |');
console.log('|---|---|---|---|---|---|---|');
for (const sc of ['near', 'far']) for (const w of ['rapier', 'longsword']) { const g = out.filter((x) => x.scene === sc && x.weapon === w); if (!g.length) continue;
  console.log(`| ${sc} · ${w} | ${g.length} | ${g.filter((x) => x.tip > 8).length} | ${med(g.map((x) => x.side)).toFixed(2)} | ${Math.max(...g.map((x) => x.side)).toFixed(2)} | ${g.filter((x) => x.side > 0.5).length} | ${g.filter((x) => Math.abs(x.tip - x.gateTip) > 0.05).length} |`); }
if (args.json) writeFileSync(String(args.json), JSON.stringify(out));
