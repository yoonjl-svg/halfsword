// dump_weapons.mjs — 게임 무기 표(src/weapons.js buildParts)에서 물리 값만 읽어 weapons.json 으로 (저장소는 읽기만)
//   node dump_weapons.mjs [저장소 뿌리]
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.argv[2] ?? new URL('../../..', import.meta.url).pathname);
const W = await import(pathToFileURL(join(ROOT, 'src/weapons.js')).href);
const out = {};
for (const id of ['longsword', 'zweihander', 'rapier', 'uchigatana']) {
  const s = W.getWeapon(id);
  const parts = s.buildParts({}).map(([shape, y, [m, c, Ie, It], color, isBlade, pose]) => ({ shape, y, m, c, Ie, It, isBlade: !!isBlade, pose: pose ?? null }));
  out[id] = { id, grip: s.grip, twoHand: s.twoHand, oneHandStance: s.oneHandStance, bladeLength: s.bladeLength, hiltLength: s.hiltLength, gripAlong: s.gripAlong, maxAimTorque: s.controlOverrides.maxAimTorque, controlOverrides: s.controlOverrides, parts };
}
writeFileSync(join(HERE, 'weapons.json'), JSON.stringify(out, null, 1));
for (const [id, w] of Object.entries(out)) {
  const m = w.parts.reduce((a, p) => a + p.m, 0);
  const com = w.parts.reduce((a, p) => a + p.m * (p.y + p.c), 0) / m;
  console.log(id, 'grip', w.grip, 'twoHand', w.twoHand, 'm', m.toFixed(3), 'com', com.toFixed(3), 'blade', w.bladeLength, 'hilt', w.hiltLength, 'gripAlong', w.gripAlong, 'maxAim', w.maxAimTorque, JSON.stringify(w.controlOverrides));
  for (const p of w.parts) console.log('   ', JSON.stringify(p));
}
