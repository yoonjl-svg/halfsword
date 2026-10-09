// 플레이어 발 조작감 (10/10 유파 걸음 ⑥ — 사장님 '플레이어도 유파 영향'): 스틱을 같은 꼴로 밀었을 때 몸이 얼마나 빨리 따라오나를 유파 걸음 켬/끔으로 견준다.
//  상대는 제자리에 세워 둔다(AI 를 멈춤 — 상대 거리로 follow 문턱이 켜지게). 플레이어(index 0)는 AI 없이 스틱(fighter.move)만.
//  차례: 시작 정지 뒤 앞으로 밀어 상대 가슴 near m 까지(near = 2.3·2.5·2.7·2.9 네 번 — 걸음 박자의 다른 자리에서 시작하게, 넷의 평균)(다가가는 시간) → 0.8 s 쉼 → 뒤·앞·왼·오른 각 0.8 s(그 방향 빠르기가 최고의 절반에 닿는 시간·0.8 s 동안 간 거리) → 놓음(0.1 m/s 아래로 멈추는 시간).
//  넘어짐·옮겨 딛기(catch)·follow 시간 몫도 센다. 읽기만 — 물리·난수는 게임 그대로. 판 하나는 결정적.
//  실행: node tools/sim/player_gait_feel.mjs [무기id ...]
import { newRound, DT, THREE } from './harness_m.mjs';
import { GAIT } from '../../src/config.js';
import { TRADITIONS } from '../../src/schools.js';
// GAIT_JSON='{"japanese":{"player":{"dsFrac":0.15}}}' → 그 유파 걸음 칸에 덮어 잰다 (값 고르기용)
if (process.env.GAIT_JSON) for (const [t, o] of Object.entries(JSON.parse(process.env.GAIT_JSON))) TRADITIONS[t].gait = { ...(TRADITIONS[t].gait ?? {}), ...o };

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['longsword', 'rapier', 'qinggang', 'zweihander', 'uchigatana', 'monohoshizao'];
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();

function run(id, school, near = 2.4) {
  const keep = GAIT.school;
  GAIT.school = school;
  const G = newRound({ walls: true, seed: 7, weapon: id, weapon2: 'longsword' });
  G.ai.update = () => G.enemy.move.set(0, 0); // 상대는 제자리
  const P = G.player;
  const g = P.gait;
  let t = 0;
  let catches = 0;
  let falls = 0;
  let followT = 0;
  let prevSt = P.state;
  const prevStance = { F: true, B: true };
  const step = (mx, my) => {
    P.move.set(mx, my);
    G.step();
    t += DT;
    if (prevSt === 'stand' && P.state === 'down') falls++;
    prevSt = P.state;
    if (g?.active) {
      for (const k of ['F', 'B']) {
        const l = g.legs[k];
        if (prevStance[k] && !l.stance && l.kind === 'catch') catches++;
        prevStance[k] = l.stance;
      }
      if (g.follow) followT += DT;
    }
  };
  const vel = () => {
    const v = P.bodies.pelvis.linvel();
    P.forward(_f);
    P.right(_r);
    return { f: v.x * _f.x + v.z * _f.z, r: v.x * _r.x + v.z * _r.z, h: Math.hypot(v.x, v.z) };
  };
  const pos = () => P.bodies.pelvis.translation();
  while (t < 2.3) step(0, 0); // 시작 정지 (ARENA.startHold)
  const t0 = t;
  while (P.foeDistance() > near && t - t0 < 8) step(0, 1);
  const approach = t - t0;
  for (let i = 0; i < 0.8 / DT; i++) step(0, 0);
  const dirs = [['뒤', 0, -1, 'f', -1], ['앞', 0, 1, 'f', 1], ['왼', -1, 0, 'r', -1], ['오른', 1, 0, 'r', 1]];
  const res = {};
  for (const [name, mx, my, ax, sg] of dirs) {
    const a = pos();
    const ax0 = { x: a.x, z: a.z };
    P.forward(_f);
    P.right(_r);
    const u = ax === 'f' ? _f.clone() : _r.clone();
    let peak = 0;
    const vs = [];
    for (let i = 0; i < 0.8 / DT; i++) {
      step(mx, my);
      const v = vel()[ax] * sg;
      vs.push(v);
      peak = Math.max(peak, v);
    }
    const half = vs.findIndex((v) => v >= 0.5 * peak);
    const b = pos();
    res[name] = { rise: half < 0 ? NaN : (half + 1) * DT, dist: ((b.x - ax0.x) * u.x + (b.z - ax0.z) * u.z) * sg, peak };
  }
  let stop = NaN;
  for (let i = 0; i < 1.5 / DT; i++) {
    step(0, 0);
    if (vel().h < 0.1) { stop = (i + 1) * DT; break; }
  }
  GAIT.school = keep;
  return { approach, res, stop, catches, falls, followShare: followT / (t - t0) };
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
console.log('| 무기 | 유파 걸음 | 다가가기 5.6 → 2.3~2.9 m s | 뒤 (반 빠르기 s · 0.8 s 거리 m) | 앞 | 왼 | 오른 | 놓고 멈춤 s | 옮겨 딛기 · 넘어짐 | follow 몫 |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
const NEARS = [2.3, 2.5, 2.7, 2.9];
const mean = (rs, fn) => rs.reduce((a, r) => a + fn(r), 0) / rs.length;
for (const id of ids) {
  for (const school of [0, 1]) {
    const rs = NEARS.map((n) => run(id, school, n));
    const r = { approach: mean(rs, (x) => x.approach), stop: mean(rs, (x) => x.stop), catches: rs.reduce((a, x) => a + x.catches, 0), falls: rs.reduce((a, x) => a + x.falls, 0), followShare: mean(rs, (x) => x.followShare), res: {} };
    for (const k of ['뒤', '앞', '왼', '오른']) r.res[k] = { rise: mean(rs, (x) => x.res[k].rise), dist: mean(rs, (x) => x.res[k].dist) };
    const c = (k) => `${f2(r.res[k].rise)} · ${f2(r.res[k].dist)}`;
    console.log(`| ${id} | ${school ? '켬' : '끔'} | ${f2(r.approach)} | ${c('뒤')} | ${c('앞')} | ${c('왼')} | ${c('오른')} | ${f2(r.stop)} | ${r.catches} · ${r.falls} | ${Math.round(100 * r.followShare)}% |`);
  }
}
