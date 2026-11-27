// r28 P7 — italian_measure.test '찌르기 잣대는 팔 두 판에서 0.02 m 안' 의 두 값을 찍음 (시험과 같은 조건 · 읽기만). node it_measure.mjs --root=<나무>
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const ROOT = resolve(process.argv.find((a) => a.startsWith('--root='))?.slice(7) ?? '.');
const { CONFIG } = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { measureThrust } = await import(pathToFileURL(join(ROOT, 'tools/sim/weapon_measure.mjs')).href);
const { JOINTS, ARENA } = CONFIG;
const withSets = (L, fn) => { const old = L.map(([o, k]) => o[k]); L.forEach(([o, k, v]) => (o[k] = v)); try { return fn(); } finally { L.forEach(([o, k], i) => (o[k] = old[i])); } };
withSets([[ARENA, 'startHold', 0], [CONFIG.AI_REACT, 'face', 0.2]], () => { const now = measureThrust('rapier').raw; const old = withSets([[JOINTS, 'swivelHuman', 0], [JOINTS, 'wristPronate', 0]], () => measureThrust('rapier').raw);
  console.log(`${ROOT}: 지금 팔 ${now.toFixed(4)} · 전 팔(swivelHuman 0 · wristPronate 0) ${old.toFixed(4)} · 차 ${(now - old).toFixed(4)} m (시험 문턱 0.02)`); });
