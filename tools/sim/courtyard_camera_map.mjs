// 봉인의 중정 디자인 리뷰 (10/17 — docs/design/courtyard_review_2026-10-17.md): 경기 카메라에서 상대가 얼마나 가려지나 — 바닥 지도.
//  내 자리를 결투장 바닥 0.5 m 칸마다 두고(장애물 충돌체에서 몸 반지름 0.3 m 밖이면 어디든 — 사람은 돌에 등을 붙일 수 있다),
//  상대를 내 둘레 열두 방향 · 거리 d(기본 2.0 m — 칼 닿는 거리)에 세운다.
//  카메라는 main.js updateCamera 와 같은 순서의 어깨 너머 자리(camera_rig.basePose → keepDistance → 반지름 10.5 → arena_obstacle.clampStageCamera).
//  상대 몸 열 곳(머리 · 가슴 · 배 · 골반 · 허벅지 둘 · 정강이 둘 · 위팔 둘)으로 광선을 쏴
//   ① 장애물 충돌체(보이는 돌이 그 안에 든다)에 막힌 몫 ② 내 몸(부위마다 공 — 어림)에 막힌 몫 ③ 둘 중 하나에 막힌 몫을 센다.
//  칸 값 = 열두 방향 가운데 상대가 절반 넘게 가려지는 방향의 몫. 카메라 당김(clampStageCamera 가 0.5 m 넘게 앞으로 당김) · 카메라 ↔ 내 몸 거리도 센다.
//  무대: courtyard(급수정) · sluice(말레이곰 석상 — 지금 여정에 있는 비교 기준) · open(장애물 없음 — 내 몸 가림의 바탕값). 몸 자세는 판 시작 선 자세 그대로(겨눈 자세).
//  실행: node tools/sim/courtyard_camera_map.mjs [결과.json] [--d=2.0] [--stages=courtyard,sluice,open]
import fs from 'node:fs';
import { newRound, RAPIER, THREE } from './harness_m.mjs';
import { GROUND_GROUPS } from '../../src/fighter.js';
import { configureStageObstacle, clampStageCamera } from '../../src/arena_obstacle.js';
import { CAMERA, ARENA } from '../../src/config.js';
import { basePose, keepDistance } from '../../src/camera_rig.js';

const args = process.argv.slice(2);
const out = args[0] && !args[0].startsWith('--') ? args[0] : '/tmp/courtyard-camera-map.json';
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const D = +opt('d', 2.0);
const STAGES = opt('stages', 'courtyard,sluice,open').split(',');
const PARTS = ['head', 'chest', 'abdomen', 'pelvis', 'thighF', 'thighB', 'shinF', 'shinB', 'uarmS', 'uarmO'];
// 내 몸 가림 어림: 부위마다 공 하나 (반지름 m)
const BODY = { head: 0.11, chest: 0.17, abdomen: 0.15, pelvis: 0.16, thighF: 0.09, thighB: 0.09, shinF: 0.07, shinB: 0.07, uarmS: 0.06, uarmO: 0.06, farmS: 0.05, farmO: 0.05 };
const LIMIT = ARENA.radius - 0.6; // 몸 중심이 설 수 있는 결투장 안쪽

const result = { d: D, step: 0.5, stages: {} };
for (const stage of STAGES) {
  const G = newRound({ seed: 7, weapon: 'longsword' });
  const ob = stage === 'open' ? null : configureStageObstacle(RAPIER, G.world, stage, GROUND_GROUPS);
  const nav = ob?.navigation ?? null;
  G.world.step();
  const P = G.player, E = G.enemy;
  // 선 자세의 몸 부위 자리를 골반 기준으로 적어 둔다 — 나는 +x 를, 상대는 −x 를 본다 (옮길 때 돌려 쓴다)
  const rel = (f, parts) => { const p = f.bodies.pelvis.translation(); const o = {}; for (const k of parts) { const t = f.bodies[k].translation(); o[k] = [t.x - p.x, t.y, t.z - p.z]; } return o; };
  const eRel = rel(E, PARTS), pRel = rel(P, Object.keys(BODY));
  let comY = 0, M = 0;
  for (const k in P.bodies) { const b = P.bodies[k]; comY += b.translation().y * b.mass(); M += b.mass(); }
  comY /= M;
  const inCover = (h) => ob && ob.handles.has(h);
  const coverHit = (a, b) => {
    if (!ob) return false;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    return !!G.world.castRay({ origin: { x: a.x, y: a.y, z: a.z }, dir: { x: dx / L, y: dy / L, z: dz / L } }, L, true, undefined, undefined, undefined, undefined, (c) => inCover(c.handle));
  };
  // 공과 선분 a → b
  const sphereHit = (a, b, c, r) => {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L2 = dx * dx + dy * dy + dz * dz;
    const t = Math.max(0, Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy + (c.z - a.z) * dz) / L2));
    return Math.hypot(a.x + dx * t - c.x, a.y + dy * t - c.y, a.z + dz * t - c.z) < r;
  };
  // 서 있을 수 있는 자리: 장애물 충돌체에서 골반 높이로 0.3 m 밖
  const standable = (x, z) => {
    if (!ob) return true;
    for (const y of [0.3, 0.95, 1.4]) {
      const pr = G.world.projectPoint({ x, y, z }, true, undefined, undefined, undefined, undefined, (c) => inCover(c.handle));
      if (pr && (pr.isInside || Math.hypot(pr.point.x - x, pr.point.y - y, pr.point.z - z) < 0.3)) return false;
    }
    return true;
  };
  const rot = (o, yaw, x0, z0) => { const c = Math.cos(yaw), s = Math.sin(yaw); return { x: x0 + o[0] * c - o[2] * s, y: o[1], z: z0 + o[0] * s + o[2] * c }; };
  const cells = [];
  const tot = { n: 0, cover: 0, body: 0, any: 0, coverAll: 0, pulled: 0, near: 0 };
  const cam = new THREE.Vector3();
  for (let gx = -LIMIT; gx <= LIMIT + 1e-6; gx += 0.5) for (let gz = -LIMIT; gz <= LIMIT + 1e-6; gz += 0.5) {
    if (Math.hypot(gx, gz) > LIMIT || !standable(gx, gz)) continue;
    const c = { n: 0, cover: 0, body: 0, any: 0, pulled: 0, near: 0 };
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const ux = Math.cos(a), uz = Math.sin(a);
      const ex = gx + ux * D, ez = gz + uz * D;
      if (Math.hypot(ex, ez) > LIMIT || !standable(ex, ez)) continue;
      // 두 사람 사이 선이 장애물을 지나면(돌 너머 상대) 칼 닿는 거리 짝이 아니다 — 뺀다
      if (ob && coverHit({ x: gx, y: 1.0, z: gz }, { x: ex, y: 1.0, z: ez })) continue;
      const src = { x: gx, y: comY, z: gz };
      basePose(src, ux, uz, 0, 0, CAMERA, cam);
      keepDistance(cam, src, CAMERA.minDist);
      const r = Math.hypot(cam.x, cam.z);
      if (r > 10.5) cam.multiplyScalar(10.5 / r).setY(CAMERA.height);
      const before = Math.hypot(cam.x - src.x, cam.z - src.z);
      clampStageCamera(src, cam, nav);
      const after = Math.hypot(cam.x - src.x, cam.z - src.z);
      const eyaw = Math.atan2(-uz, -ux) - Math.PI, pyaw = a; // 상대: −x → 나를 봄 · 나: +x → 상대를 봄
      let byCover = 0, byBody = 0, byAny = 0;
      for (const kp of PARTS) {
        const tp = rot(eRel[kp], eyaw, ex, ez);
        const hc = coverHit(cam, tp);
        let hb = false;
        for (const [bk, br] of Object.entries(BODY)) if (sphereHit(cam, tp, rot(pRel[bk], pyaw, gx, gz), br)) { hb = true; break; }
        byCover += hc; byBody += hb; byAny += hc || hb;
      }
      const half = PARTS.length / 2;
      c.n++; tot.n++;
      if (byCover > half) { c.cover++; tot.cover++; }
      if (byBody > half) { c.body++; tot.body++; }
      if (byAny > half) { c.any++; tot.any++; }
      if (byCover === PARTS.length) tot.coverAll++;
      if (before - after > 0.5) { c.pulled++; tot.pulled++; }
      if (after < 1.6) { c.near++; tot.near++; }
    }
    if (c.n) cells.push([+gx.toFixed(2), +gz.toFixed(2), +(c.cover / c.n).toFixed(3), +(c.body / c.n).toFixed(3), +(c.any / c.n).toFixed(3), +(c.pulled / c.n).toFixed(3), +(c.near / c.n).toFixed(3)]);
  }
  const f = (x) => +(x / Math.max(1, tot.n)).toFixed(4);
  result.stages[stage] = { nav, samples: tot.n, coverHalf: f(tot.cover), coverAll: f(tot.coverAll), bodyHalf: f(tot.body), anyHalf: f(tot.any), camPulled: f(tot.pulled), camNear: f(tot.near),
    cellKeys: ['x', 'z', 'coverHalf', 'bodyHalf', 'anyHalf', 'camPulled', 'camNear'], cells };
  const { cells: _, cellKeys: __, ...brief } = result.stages[stage];
  console.log(stage, JSON.stringify(brief));
  G.world.free();
}
fs.writeFileSync(out, JSON.stringify(result) + '\n');
