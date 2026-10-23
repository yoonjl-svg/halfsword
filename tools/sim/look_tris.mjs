// 인물 겉모습 삼각형 재기 (10/23 — 무거운 두 모델 롤랑 · 백린의 전사를 줄일 때 쓸 자리 표, docs/import/wander_heroes_import_2026-10-23.md §6)
//  부위별 삼각형(보이는 메쉬만 · 칼 뺌) · 꼭짓점 해시(겉모습이 바뀌었나) · 복식 모듈의 addMerged 를 부른 줄마다 삼각형(그 줄을 부른 줄까지 — 같은 장식이 어느 부위에서 몇 번 쓰였나).
//  그리기 없이 노드에서 몸을 세운다(fighter.js — 시뮬 하네스와 같은 길). 장면 그림자 그리기에서 몸을 한 번 더 그리므로 실제 그리기 몫은 대략 이 수의 두 배다.
//  node tools/sim/look_tris.mjs <겉모습 id[:판]> [복식 모듈 경로 내보낸 함수 이름 OUTFITS 열쇠] [--json]   (판을 안 쓰면 지금 판)
//   예) node tools/sim/look_tris.mjs roland src/outfit_roland.js createRolandOutfit roland · node tools/sim/look_tris.mjs bernardo:v2-gold
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import RAPIER from '../../node_modules/@dimforge/rapier3d-compat/rapier.mjs';
import { Fighter } from '../../src/fighter.js';
import { OUTFITS, newOutfitHelpers } from '../../src/outfits.js';
import { getLook } from '../../src/looks.js';
import { PHYSICS } from '../../src/config.js';

await RAPIER.init();
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const asJson = process.argv.includes('--json');
const [lookArg, modPath, exportName, outfitKey] = args;
const [lookId, lookVer] = lookArg.split(':');
const sites = {};
let lines = [];
if (modPath) {
  const mod = await import(pathToFileURL(path.resolve(modPath)).href);
  const file = path.basename(modPath);
  lines = readFileSync(modPath, 'utf8').split('\n');
  // add(...) 감싸개 줄(const add = … addMerged)은 건너뛰고 그 add 를 부른 줄을 센다
  const wrapperLines = new Set(lines.map((l, i) => (/const add = |=> addMerged\(/.test(l) ? i + 1 : 0)).filter(Boolean));
  const helpers = {
    ...newOutfitHelpers,
    addMerged(parent, pieces, color, mat) {
      const m = newOutfitHelpers.addMerged(parent, pieces, color, mat);
      if (m) {
        const frames = new Error().stack.split('\n').filter((l) => l.includes(file)).map((l) => Number(l.match(/:(\d+):\d+\)?$/)?.[1]));
        const real = frames.filter((n) => !wrapperLines.has(n));
        const key = real.slice(0, 2).join('<') || String(frames[0]);
        const g = m.geometry;
        sites[key] = (sites[key] ?? 0) + (g.index ? g.index.count : g.attributes.position.count) / 3;
      }
      return m;
    },
  };
  OUTFITS[outfitKey] = mod[exportName](helpers);
}
const look = getLook(lookId, lookVer);
if (!look) throw new Error(`겉모습 없음: ${lookArg}`);
const world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
const THREE = await import('../../node_modules/three/build/three.module.js');
const fighter = new Fighter(RAPIER, world, new THREE.Scene(), new Map(), { index: 1, name: 'E', x: 0, heading: Math.PI, look, weapon: 'longsword', breakSeed: 1 });
const parts = {};
let total = 0;
for (const [name, group] of Object.entries(fighter.groups)) {
  const h = createHash('sha1');
  let tris = 0;
  const walk = (o) => {
    if (!o.visible) return;
    if (o.isMesh) {
      const g = o.geometry;
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      h.update(Buffer.from(new Float32Array(Array.from(g.attributes.position.array, (v) => Math.round(v * 1e6) / 1e6)).buffer));
      if (g.index) h.update(Buffer.from(new Uint32Array(g.index.array).buffer));
      h.update(String(o.material?.color?.getHex?.() ?? ''));
    }
    for (const c of o.children) walk(c);
  };
  walk(group);
  parts[name] = { tris, hash: h.digest('hex').slice(0, 12) };
  total += tris;
}
if (asJson) {
  console.log(JSON.stringify({ look: lookArg, total, parts, sites }));
} else {
  console.log(`${lookArg}: 몸 하나 삼각형 ${total.toLocaleString('en')} (칼 뺌)`);
  for (const [name, p] of Object.entries(parts).sort((a, b) => b[1].tris - a[1].tris)) console.log(`  ${name.padEnd(8)} ${String(p.tris).padStart(7)}  ${p.hash}`);
  if (modPath) {
    console.log(`복식 모듈 ${modPath} — addMerged 를 부른 줄 (줄<그 줄을 부른 줄) · 삼각형 · 몫`);
    for (const [key, n] of Object.entries(sites).sort((a, b) => b[1] - a[1])) {
      const at = Number(key.split('<')[0]);
      console.log(`  ${String(n).padStart(7)} ${(n / total * 100).toFixed(1).padStart(5)} %  ${key.padEnd(8)} ${(lines[at - 1] ?? '').trim().slice(0, 100)}`);
    }
  }
}
