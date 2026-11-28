// r35 반박 — 칼(손목 관절의 먼 쪽 묶음) 질량 · 관성을 읽기만 (손으로 셈한 토크와 정직 심판 값을 견주려고) · 시뮬 스텝 없음
//  node refute_inertia.mjs --root=<나무> [--w=rapier,longsword]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.')); const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
for (const w of String(args.w ?? 'rapier,longsword').split(',')) {
  const G = H.newRound({ walls: true, seed: 4021, weapon: w, weapon2: w, AI2Class: H.AI }); const f = G.player, sw = f.sword;
  const m = sw.mass(), com = sw.localCom(), I = sw.principalInertia(); const hp = H.handPos(f), wc = sw.worldCom?.() ?? sw.translation();
  const cfg = f.weaponCfg; const rHand = Math.hypot(wc.x - hp.x, wc.y - hp.y, wc.z - hp.z);
  console.log(`${w} 질량 ${m.toFixed(3)} kg · 무게중심(국소) ${[com.x, com.y, com.z].map((x) => x.toFixed(3))} · 주 관성 ${[I.x, I.y, I.z].map((x) => x.toFixed(4))} · 손↔무게중심 ${rHand.toFixed(3)} m · 손잡이 ${cfg.hiltLength} · 날 ${cfg.bladeLength} · 손 둘레 관성(가로) ≈ ${(Math.max(I.x, I.z) + m * rHand * rHand).toFixed(4)} kg m²`);
}
process.exit(0);
