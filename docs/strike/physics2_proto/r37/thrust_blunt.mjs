// r37 곁 — AI 장검 찌르기 기술의 맞음이 왜 멍인가 (재기만 · Combat.analyze 를 감싸 그 입력에서 판정의 찌르기 기하 두 값을 다시 셈해 적음)
//  node thrust_blunt.mjs --root=<나무> --out=<폴더> [--w=longsword] [--seeds=4001-4020] [--secs=30]
//   찌르기 조건 (combat.js analyze): 칼날 부품 · along = (칼 − 몸 빠르기)·칼축 ÷ 빠르기 > STRIKE.stabAlign − 창 · t (칼날 위 닿은 자리 0 = 날밑 · 1 = 칼끝) > 0.8 − 창
//   맞음마다: 기술 이름 · 이 몸이 찌르기 기술 휘두름 중인가 · 판정 갈래 · along · t · 빠르기 · 부위
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, mkdirSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.')); const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs'); const { seedList } = await imp('tools/sim/wb_measure.mjs'); const { Combat } = await imp('src/combat.js'); const { STRIKE } = await imp('src/config.js');
const THREE = H.THREE; const OUT = String(args.out ?? '.'); mkdirSync(OUT, { recursive: true });
const STICH = new Set(['stichPflug', 'stichPflugL', 'stichOchs', 'stichOchsL', 'stichAlber']);
const oA = Combat.prototype.analyze;
Combat.prototype.analyze = function (pr, point, S, P, predicting = false) {
  const r = oA.call(this, pr, point, S, P, predicting); if (!r || predicting) return r;
  const vel = (st, p) => new THREE.Vector3().crossVectors(st.w, new THREE.Vector3().subVectors(p, st.com)).add(st.v);
  const rel = vel(S, point).sub(vel(P, point)); const sp = rel.length(); const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(S.q);
  const att = pr.w.fighter; const local = point.clone().sub(S.p).applyQuaternion(S.q.clone().invert());
  r.__g = { along: sp > 0 ? rel.dot(ax) / sp : null, t: Math.max(0, Math.min(1, (local.y - att.weaponCfg.hiltLength) / att.weaponCfg.bladeLength)), part: pr.w.part, win: att.weaponCfg.thrustStyle?.window ?? 0 };
  return r; };
const seeds = seedList(args.seeds ?? '4001-4020'); const w = String(args.w ?? 'longsword'); const secs = +(args.secs ?? 30); const rows = [];
for (const s of seeds) {
  const G = H.newRound({ walls: true, seed: s, weapon: w, weapon2: w, AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
  const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (!ais.has(A) || Vc === A) return; const ai = ais.get(A); const tn = ai?.tech?.name ?? null;
    rows.push({ seed: s, t: +G.t.toFixed(3), tech: tn, stich: STICH.has(tn), swing: !!A.skill?.swinging, tap: !!A.skill?.tap, push: !!A.skill?.thrustPush, type: r.type, zone: r.zone, E: r.energy, sp: r.speed, ...(r.__g ?? {}) }); };
  for (let k = 0; k < Math.round(secs / H.DT); k++) G.step();
  try { G.world.free(); } catch { /* */ }
  process.stderr.write(`${w} ${s} 맞음 ${rows.length}\n`);
}
const q = (a, p) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); if (!b.length) return NaN; const i = (b.length - 1) * p; const l = Math.floor(i), h = Math.ceil(i); return b[l] + (b[h] - b[l]) * (i - l); };
const S2 = rows.filter((r) => r.stich && r.swing); const show = (set, nm) => { const n = set.length; if (!n) return console.log(nm, 0);
  const aOk = set.filter((r) => r.along > STRIKE.stabAlign - (r.win ?? 0)).length, tOk = set.filter((r) => r.t > 0.8 - (r.win ?? 0)).length, both = set.filter((r) => r.along > STRIKE.stabAlign - (r.win ?? 0) && r.t > 0.8 - (r.win ?? 0)).length;
  const ty = set.reduce((o, r) => ((o[r.type] = (o[r.type] || 0) + 1), o), {});
  console.log(`${nm}: 맞음 ${n} · 갈래 ${JSON.stringify(ty)} · along > ${STRIKE.stabAlign} ${aOk} · t > 0.8 ${tOk} · 둘 다 ${both} · along 가운데 / 90 % ${q(set.map((r) => r.along), 0.5).toFixed(2)} / ${q(set.map((r) => r.along), 0.9).toFixed(2)} · t 가운데 / 90 % ${q(set.map((r) => r.t), 0.5).toFixed(2)} / ${q(set.map((r) => r.t), 0.9).toFixed(2)} · 칼날 부품 ${set.filter((r) => r.part === 'blade').length} · 뻗는 구간(thrustPush) ${set.filter((r) => r.push).length}`); };
show(S2, `${w} 찌르기 기술 휘두름 중 맞음`); show(rows.filter((r) => !(r.stich && r.swing)), `${w} 그 밖 맞음`);
writeFileSync(join(OUT, `thrust_blunt_${w}.json`), JSON.stringify(rows));
