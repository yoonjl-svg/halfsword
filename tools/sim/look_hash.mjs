// 인물 겉모습 해시 · 삼각형 · 그리기 수 (node, 물리 한 걸음도 돌리지 않음).
//  상대 자리에 인물 하나를 세워(harness_m newRound look2) 부위 그룹 아래 모든 메쉬의 로컬 꼭짓점(1e-5 반올림)·
//  인덱스·꼭짓점 색·재질 몇 값·치수 값(geometry.parameters)·로컬 자리를 FNV-1a 로 묶는다. 무기 메쉬는 넣지 않는다.
//  실행: node tools/sim/look_hash.mjs [id 또는 id:판 ...]  (생략하면 모든 인물의 지금 판 + 토메 v1)
//  기록: docs/characters/tome_librarian_2026-10-10.md
import { newRound } from './harness_m.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { getLook } from '../../src/looks.js';

function fnv(h, s) {
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function measure(look) {
  const G = newRound({ seed: 1, look2: look, weapon: 'longsword', weapon2: 'longsword' });
  let h = 2166136261, tris = 0, draws = 0;
  for (const [name, group] of Object.entries(G.enemy.groups)) {
    h = fnv(h, name);
    group.traverse((o) => {
      if (!o.isMesh || o.visible === false) return;
      const g = o.geometry, p = g.attributes.position;
      draws++;
      tris += (g.index ? g.index.count : p.count) / 3;
      const m = o.material;
      const f = (v) => v.toFixed(5);
      h = fnv(h, `${g.type}|${JSON.stringify(g.parameters || {})}|${m.color?.getHex()}|${m.side}|${m.transparent}|${m.opacity}|${m.vertexColors}|${o.position.toArray().map(f)}|${o.quaternion.toArray().map(f)}|${o.scale.toArray().map(f)}`);
      let s = '';
      for (let i = 0; i < p.array.length; i++) s += Math.round(p.array[i] * 1e5) + ',';
      h = fnv(h, s);
      if (g.index) h = fnv(h, Array.from(g.index.array).join(','));
      const c = g.attributes.color;
      if (c) h = fnv(h, Array.from(c.array, (v) => Math.round(v * 1e4)).join(','));
    });
  }
  return { hash: h.toString(16).padStart(8, '0'), tris, draws };
}
const args = process.argv.slice(2);
const list = args.length ? args : [...CHARACTERS.map((c) => c.id), 'tome:v1'];
for (const a of list) {
  const [id, v] = a.split(':');
  const ch = CHARACTERS.find((c) => c.id === id);
  const look = v ? getLook(id, v) : ch?.look ?? getLook(id);
  const r = measure(look);
  console.log(`${a.padEnd(16)} ${r.hash}  tris=${r.tris}  draws=${r.draws}`);
}
