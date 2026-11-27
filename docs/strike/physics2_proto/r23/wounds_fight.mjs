// r23 읽기 지적 7 — 싸움 48 판(fall_context 와 같은 판: 씨앗 1 ~ 24 · offset 0 · 300 · 무기 longsword · rapier · zweihander 돌림 · 30 s)의 상처 수 (치는 쪽 무기 · 찌르기 / 그 밖)
//  node wounds_fight.mjs --root=<나무> [--offsets=0,300] [--fights=24] [--secs=30]
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const FW = ['longsword', 'rapier', 'zweihander']; const FIGHTS = +(args.fights ?? 24), SECS = +(args.secs ?? 30);
const tot = { fights: 0, wounds: 0 }; const by = {};
for (const off of String(args.offsets ?? '0,300').split(',').map(Number)) for (let seed = 1; seed <= FIGHTS; seed++) {
  const w1 = FW[(seed - 1) % FW.length], w2 = FW[seed % FW.length];
  const G = H.newRound({ walls: true, seed: seed + off, weapon: w1, weapon2: w2, AI2Class: H.AI });
  const wOf = new Map([[G.player, w1], [G.enemy, w2]]);
  G.onWound = (att, vic, r) => { if (!wOf.has(att) || att === vic) return; tot.wounds++; const k = `${wOf.get(att)} · ${r?.type === 'thrust' ? '찌르기' : r?.type ?? '-'}`; by[k] = (by[k] ?? 0) + 1; };
  for (let k = 0; k < Math.round(SECS / H.DT); k++) G.step();
  tot.fights++;
  try { G.world.free(); } catch {}
}
console.log(`판 ${tot.fights} · 상처 ${tot.wounds} · 판당 ${(tot.wounds / tot.fights).toFixed(2)}`);
for (const k of Object.keys(by).sort()) console.log(`  ${k} ${by[k]}`);
