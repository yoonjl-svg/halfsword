// 긴 망토 겹침 재기 (10/23 — 베르나르도 v2 긴 망토 · 사장님 10/23 23:5x '다리 · 칼과 걸리지 않게'): AI 끼리 판에서 망토 메쉬가
//  ① 제 다리(넓적다리 · 정강이 — 보이는 굵기: 사슬 · 정강이받이까지)에 들어간 프레임 몫 · ② 제 칼날(손잡이 끝 → 칼끝 선분)이 망토 겉면을 뚫은 프레임 몫 ·
//  ③ 상대 칼날이 뚫은 프레임 몫(망토는 충돌체가 없어 맞아도 지나간다 — 참고)을 센다. 롤랑 v2 긴 망토가 견줄 기준.
//  node tools/sim/cape_clip.mjs <인물 id> [판 수 12] [초 20] [--mod=<복식 모듈 경로>:<내보낸 함수>:<OUTFITS 열쇠>] [--mesh=<메쉬 이름>]
//   예) node tools/sim/cape_clip.mjs bernardo · node tools/sim/cape_clip.mjs roland
//   --mesh: 겉감 대신 이 이름의 메쉬를 잰다(10/24 — 베르나르도 그 전 망토의 5 mm 안쪽 안감 'bernardo-mantle-lining' 을 견주려고)
//  망토 메쉬 = 가슴 부위의 천 층에서 이름이 CAPE_MESH 에 있는 메쉬(겉감만 · 이름 없는 옛 망토는 망토 천 층의 첫 메쉬). 4 걸음마다 한 번 잰다. 시뮬 해시 · 게임 코드와 무관(재기만)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { OUTFITS, newOutfitHelpers } from '../../src/outfits.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [id = 'bernardo', fightsArg = '12', durArg = '20'] = args;
const modArg = process.argv.find((a) => a.startsWith('--mod='));
if (modArg) {
  const [file, fn, key] = modArg.slice(6).split(':');
  OUTFITS[key] = (await import(pathToFileURL(path.resolve(file)).href))[fn](newOutfitHelpers);
}
const meshArg = process.argv.find((a) => a.startsWith('--mesh='));
const CAPE_MESH = new Set(meshArg ? [meshArg.slice(7)] : ['bernardo-gold-mantle', 'roland-wine-cape']);
const ME = CHARACTERS_BY_ID[id];
const FOES = ['heinrich', 'liao', 'margarethe', 'isolde', 'omari', 'minami'].filter((f) => CHARACTERS_BY_ID[f]);
const LEG = { thighF: [0.15, 0.095], thighB: [0.15, 0.095], shinF: [0.16, 0.065], shinB: [0.16, 0.065] }; // [반 길이, 보이는 반지름]
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Quaternion();
const _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3(), _h = new THREE.Vector3(), _s = new THREE.Vector3(), _qq = new THREE.Vector3();

function segTri(o, d, a, b, c) {
  // Möller–Trumbore — o + t d (0 ≤ t ≤ 1) 가 삼각형 abc 를 지나나
  _e1.subVectors(b, a); _e2.subVectors(c, a); _h.crossVectors(d, _e2);
  const det = _e1.dot(_h);
  if (Math.abs(det) < 1e-12) return false;
  const f = 1 / det; _s.subVectors(o, a);
  const u = f * _s.dot(_h);
  if (u < 0 || u > 1) return false;
  _qq.crossVectors(_s, _e1);
  const v = f * d.dot(_qq);
  if (v < 0 || u + v > 1) return false;
  const t = f * _e2.dot(_qq);
  return t >= 0 && t <= 1;
}
function capeOf(F) {
  const list = [];
  F.groups.chest.traverse((o) => { if (o.isMesh && CAPE_MESH.has(o.name)) list.push(o); });
  // 이름 없는 옛 망토(베르나르도 그 전 v2 짧은 망토): 망토 천 층의 첫 메쉬 = 겉감
  if (!list.length) F.groups.chest.traverse((o) => { if (!list.length && o.name === 'bernardo-gold-mantle' && o.children[0]?.isMesh) list.push(o.children[0]); });
  return list;
}
function worldTris(meshes) {
  const out = [];
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const g = m.geometry, p = g.attributes.position, idx = g.index.array, W = m.matrixWorld;
    const v = Array.from({ length: p.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(W));
    for (let i = 0; i < idx.length; i += 3) out.push([v[idx[i]], v[idx[i + 1]], v[idx[i + 2]]]);
    out.verts = (out.verts || []).concat(v);
  }
  return out;
}
function bladeSeg(F) {
  return [F.bladePoint(-F.weaponCfg.hiltLength / F.weaponCfg.bladeLength, new THREE.Vector3()), F.bladePoint(1, new THREE.Vector3())];
}
function segDist(p, a, b) {
  _a.subVectors(b, a); const t = Math.max(0, Math.min(1, _p.subVectors(p, a).dot(_a) / _a.lengthSq()));
  return _b.copy(a).addScaledVector(_a, t).distanceTo(p);
}
let frames = 0, legHit = 0, ownBlade = 0, foeBlade = 0, legDepthMax = 0, legVerts = 0;
const perLeg = { thighF: 0, thighB: 0, shinF: 0, shinB: 0 };
const n = +fightsArg, dur = +durArg;
for (let k = 0; k < n; k++) {
  const foe = CHARACTERS_BY_ID[FOES[k % FOES.length]];
  const G = newRound({ seed: 100 + k, look2: ME.look, weapon2: ME.weapon, persona: ME.ai.persona, difficulty: ME.ai.level, AI2Class: AI, persona2: foe.ai.persona, difficulty2: foe.ai.level, look: foe.look, weapon: foe.weapon });
  const F = G.enemy, P = G.player, cape = capeOf(F);
  if (!cape.length) throw new Error('망토 메쉬 없음 — ' + id);
  const steps = Math.round(dur / DT);
  for (let i = 0; i < steps; i++) {
    G.step();
    if (!F.alive || !P.alive) break;
    if (i % 4) continue;
    F.syncMeshes();
    const tris = worldTris(cape);
    frames++;
    // ① 다리
    let any = false;
    for (const [part, [hh, r]] of Object.entries(LEG)) {
      const rb = F.bodies[part], t = rb.translation(), q = rb.rotation();
      _q.set(q.x, q.y, q.z, q.w);
      const c = new THREE.Vector3(t.x, t.y, t.z), ax = new THREE.Vector3(0, hh, 0).applyQuaternion(_q), a = c.clone().sub(ax), b = c.clone().add(ax);
      let hit = false;
      for (const v of tris.verts) {
        const d = segDist(v, a, b);
        if (d < r) { hit = true; legVerts++; legDepthMax = Math.max(legDepthMax, r - d); }
      }
      if (hit) { perLeg[part]++; any = true; }
    }
    if (any) legHit++;
    // ② 제 칼 · ③ 상대 칼
    for (const [who, W] of [['own', F], ['foe', P]]) {
      const [a, b] = bladeSeg(W), d = new THREE.Vector3().subVectors(b, a);
      if (tris.some(([x, y, z]) => segTri(a, d, x, y, z))) who === 'own' ? ownBlade++ : foeBlade++;
    }
  }
}
const pc = (x) => (100 * x / frames).toFixed(1) + ' %';
console.log(`${id}${modArg ? ' (' + modArg.slice(6) + ')' : ''}${meshArg ? ' [' + meshArg.slice(7) + ']' : ''}: 판 ${n} × ${dur} 초 · 잰 프레임 ${frames}`);
console.log(`  다리에 들어감 ${pc(legHit)} (넓적다리 앞 ${pc(perLeg.thighF)} · 뒤 ${pc(perLeg.thighB)} · 정강이 앞 ${pc(perLeg.shinF)} · 뒤 ${pc(perLeg.shinB)}) · 가장 깊이 ${(legDepthMax * 100).toFixed(1)} cm · 들어간 꼭짓점 프레임당 ${(legVerts / frames).toFixed(1)}`);
console.log(`  제 칼이 뚫음 ${pc(ownBlade)} · 상대 칼이 뚫음 ${pc(foeBlade)}`);
