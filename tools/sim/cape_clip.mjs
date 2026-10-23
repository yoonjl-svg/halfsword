// 긴 망토 겹침 재기 (10/23 — 베르나르도 v2 긴 망토 · 사장님 10/23 23:5x '다리 · 칼과 걸리지 않게'): AI 끼리 판에서 망토 메쉬가
//  ① 제 다리(넓적다리 · 정강이 — 보이는 굵기: 사슬 · 정강이받이까지)에 들어간 프레임 몫 · ② 제 칼날(손잡이 끝 → 칼끝 선분)이 망토 겉면을 뚫은 프레임 몫 ·
//  ③ 상대 칼날이 뚫은 프레임 몫(망토는 충돌체가 없어 맞아도 지나간다 — 참고)을 센다. 롤랑 v2 긴 망토가 견줄 기준.
//  node tools/sim/cape_clip.mjs <인물 id> [판 수 12] [초 20] [--mod=<복식 모듈 경로>:<내보낸 함수>:<OUTFITS 열쇠>] [--mesh=<메쉬 이름>]
//   예) node tools/sim/cape_clip.mjs bernardo · node tools/sim/cape_clip.mjs roland
//   --mesh: 겉감 대신 이 이름의 메쉬를 잰다(10/24 — 베르나르도 그 전 망토의 5 mm 안쪽 안감 'bernardo-mantle-lining' 을 견주려고)
//  망토 메쉬 = 가슴 부위의 천 층에서 이름이 CAPE_MESH 에 있는 메쉬(겉감만 · 이름 없는 옛 망토는 망토 천 층의 첫 메쉬). 4 걸음마다 한 번 잰다. 시뮬 해시 · 게임 코드와 무관(재기만)
//  10/24 망토 흔들림(src/cape_sway.js): 게임처럼 2 걸음(60 fps 한 프레임)마다 syncMeshes → updateCapeSway(그 사이 흐른 게임 시간)로 뼈를 움직이고,
//   흔들린 꼭짓점(스키닝을 거친 자리)으로 잰다. --sway=off = 흔들림 없이 쉬는 꼴(그 전 단단한 망토와 같음) · 아르토리아('artoria-cape')도 잰다
//   흔들림 각(아랫단 — 묶은 뒤)의 평균 · 99 % · 가장 큰 값과 updateCapeSway 한 번의 시간도 적는다
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { newRound, DT } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { OUTFITS, newOutfitHelpers } from '../../src/outfits.js';
import { updateCapeSway, capeSwayAngles } from '../../src/cape_sway.js';
import { CAPE } from '../../src/config.js';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const [id = 'bernardo', fightsArg = '12', durArg = '20'] = args;
const modArg = process.argv.find((a) => a.startsWith('--mod='));
if (modArg) {
  const [file, fn, key] = modArg.slice(6).split(':');
  OUTFITS[key] = (await import(pathToFileURL(path.resolve(file)).href))[fn](newOutfitHelpers);
}
const meshArg = process.argv.find((a) => a.startsWith('--mesh='));
const CAPE_MESH = new Set(meshArg ? [meshArg.slice(7)] : ['bernardo-gold-mantle', 'roland-wine-cape', 'artoria-cape']);
const SWAY = !process.argv.includes('--sway=off');
// --tune='{"accel":0.03,"clamp":{"fwd":0.05}}' = 이 판만 CAPE 값을 덮어 잼(값 고르기용 — 게임 값은 src/config.js CAPE)
const tuneArg = process.argv.find((a) => a.startsWith('--tune='));
if (tuneArg) { const t = JSON.parse(tuneArg.slice(7)); Object.assign(CAPE, t, { clamp: { ...CAPE.clamp, ...t.clamp }, idle: { ...CAPE.idle, ...t.idle } }); }
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
    // 흔들림 망토(SkinnedMesh)는 뼈를 거친 자리 — 그리기 카드와 같은 셈(three applyBoneTransform)
    const v = Array.from({ length: p.count }, (_, i) => (m.isSkinnedMesh ? m.getVertexPosition(i, new THREE.Vector3()) : new THREE.Vector3().fromBufferAttribute(p, i)).applyMatrix4(W));
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
const swayDeg = { fwd: [], back: [], side: [], twist: [] }; let swayNs = 0, swayCalls = 0;
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
    if (i % 2) continue;
    F.syncMeshes();
    if (SWAY) {
      const t0 = process.hrtime.bigint();
      updateCapeSway(F, 2 * DT);
      swayNs += Number(process.hrtime.bigint() - t0); swayCalls++;
      const [a] = capeSwayAngles(F);
      if (a) {
        const d = 180 / Math.PI;
        (a.z > 0 ? swayDeg.fwd : swayDeg.back).push(Math.abs(a.z) * d);
        swayDeg.side.push(Math.abs(a.x) * d); swayDeg.twist.push(Math.abs(a.y) * d);
      }
    }
    if (i % 4) continue;
    F.groups.chest.updateMatrixWorld(true);
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
console.log(`${id}${modArg ? ' (' + modArg.slice(6) + ')' : ''}${meshArg ? ' [' + meshArg.slice(7) + ']' : ''}${tuneArg ? ' ' + tuneArg.slice(7) : ''}: 판 ${n} × ${dur} 초 · 잰 프레임 ${frames}`);
console.log(`  다리에 들어감 ${pc(legHit)} (넓적다리 앞 ${pc(perLeg.thighF)} · 뒤 ${pc(perLeg.thighB)} · 정강이 앞 ${pc(perLeg.shinF)} · 뒤 ${pc(perLeg.shinB)}) · 가장 깊이 ${(legDepthMax * 100).toFixed(1)} cm · 들어간 꼭짓점 프레임당 ${(legVerts / frames).toFixed(1)}`);
console.log(`  제 칼이 뚫음 ${pc(ownBlade)} · 상대 칼이 뚫음 ${pc(foeBlade)}`);
if (SWAY) {
  const st = (a) => { if (!a.length) return '—'; const s = a.slice().sort((x, y) => x - y), m = a.reduce((x, y) => x + y, 0) / a.length; return `평균 ${m.toFixed(2)}° · 99 % ${s[Math.floor(0.99 * (s.length - 1))].toFixed(1)}° · 가장 큼 ${s.at(-1).toFixed(1)}°`; };
  const nAll = swayDeg.fwd.length + swayDeg.back.length;
  console.log(`  흔들림(아랫단 · 묶은 뒤): 앞 ${st(swayDeg.fwd)} (${(100 * swayDeg.fwd.length / nAll).toFixed(0)} % 프레임) · 뒤 ${st(swayDeg.back)} · 옆 ${st(swayDeg.side)} · 비틀림 ${st(swayDeg.twist)}`);
  console.log(`  updateCapeSway 한 번 ${(swayNs / swayCalls / 1000).toFixed(1)} µs (node · 싸움꾼 하나)`);
} else console.log('  흔들림 끔 (--sway=off — 쉬는 꼴)');
