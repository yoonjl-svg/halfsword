// 뛰기 재기 (11/18 — src/run.js · config RUN · 기록 docs/strike/run_2026-11-18.md)
//  사람 몸(0 번 · humanInput) 하나가 빈 평지(벽 없음 · 상대는 멀리 치움 — 바라볼 곳 +x)에서 스틱을 끝까지 민다. 판 시작 발 묶임(ARENA.startHold) 뒤 0.3 s 서 있다가 민다.
//  재는 것: 뛴 시간 · 거리(가속 포함 — 뛰기 시작 ~ 기력 0 으로 걷기) · 가장 빠른 빠르기 · 걷기 끝 빠르기 · 넘어짐 · 붙잡기 반사(gait.levC > 0.3) 시간 ·
//   걸음 박자 · 두 발 모두 뜬 시간 몫(날기) · 뒤로 뛰기 몸 돌림 시간 · 멈춘 뒤 상대 쪽으로 돌아오는 시간 · 공격으로 끊은 뒤 걷는 빠르기까지 줄어드는 시간 · 거리
//  실행: node tools/sim/run_measure.mjs [표|run|turn|brk|walk] [무기] [시작 기력]   (기본 표 — 유파마다)
//  시간 · 빠르기는 게임 값과 실제 값(÷ 템포 1.1 · × 템포) 둘 다 적는다
import { newRound, DT } from './harness_m.mjs';
import { TIME, GAIT, RUN, ARENA } from '../../src/config.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { runCostRate, walkTopOf } from '../../src/run.js';

const K = TIME.k; // 실제 1 초 = 게임 K 초
const hv = (f) => { const v = f.bodies.pelvis.linvel(); return Math.hypot(v.x, v.z); };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** 판 하나: weapon · kit · stamina0 · script(t, P, G) → { sx, sy, reach, brk } (t = 발이 풀린 뒤 시간) */
export function runCase({ weapon = 'longsword', kit = null, stamina0 = 100, T = 9, script, seed = 7 }) {
  const G = newRound({ weapon, weapon2: 'longsword', seed, walls: false, ...(kit ? { kit } : {}), onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  G.park();
  const P = G.player;
  const t0 = ARENA.startHold + 0.3;
  const rec = [];
  let set = false;
  G.before = (t) => {
    const u = t - t0;
    if (u >= 0 && !set) { set = true; P.stamina.value = stamina0; }
    const c = u >= 0 ? script(u, P, G) : { sx: 0, sy: 0, reach: 0 };
    P.move.set(c.sx, c.sy);
    P.stickX = c.sx;
    P.stickY = c.sy;
    P.runReach = c.reach;
    if (c.brk) P.runBreak = true;
    if (c.thrust) P.skill.thrust();
  };
  for (let i = 0; i < (t0 + T) / DT; i++) {
    G.step();
    const u = G.t - t0;
    if (u < 0) continue;
    const p = P.bodies.pelvis.translation();
    const g = P.gait;
    rec.push({ u, x: p.x, z: p.z, y: p.y, v: hv(P), on: !!P.run?.on, k: P.run?.k ?? 0, st: P.stamina.value, state: P.state, head: P.heading,
      lev: g?.levC ?? 0, air: g?.active ? !g.legs.F.stance && !g.legs.B.stance : false, fN: (g?.legs.F.N || 0) + (g?.legs.B.N || 0), tdn: (g?.legs.F.tdN || 0) + (g?.legs.B.tdN || 0), off: P.offBalance, end: P.run?.end });
  }
  return { P, G, rec };
}

/** 앞으로 끝까지 밀어 뛰기 → 기력이 다해 걷기까지 */
export function measureRun(o) {
  const { P, rec } = runCase({ T: 14, ...o, script: () => ({ sx: 0, sy: 1, reach: 1 }) });
  const i0 = rec.findIndex((r) => r.on);
  let i1 = rec.findIndex((r, i) => i > i0 && !r.on);
  if (i1 < 0) i1 = rec.length - 1;
  const seg = rec.slice(i0, i1 + 1);
  const dist = Math.hypot(rec[i1].x - rec[i0].x, rec[i1].z - rec[i0].z);
  // 빠르기: 0.25 s 창 평균 (발마다 출렁임을 거름)
  const w = Math.round(0.25 / DT);
  let vMax = 0;
  for (let i = i0; i + w < i1; i++) vMax = Math.max(vMax, Math.hypot(rec[i + w].x - rec[i].x, rec[i + w].z - rec[i].z) / (w * DT));
  const tUp = (() => { for (let i = i0; i + w < i1; i++) if (Math.hypot(rec[i + w].x - rec[i].x, rec[i + w].z - rec[i].z) / (w * DT) >= 0.95 * vMax) return rec[i + w].u - rec[i0].u; return NaN; })();
  const falls = rec.filter((r, i) => i > 0 && rec[i - 1].state === 'stand' && r.state !== 'stand').length;
  const catchT = seg.filter((r) => r.lev > 0.3).length * DT;
  const airT = seg.filter((r) => r.air).length * DT;
  const steps = seg[seg.length - 1].tdn - seg[0].tdn;
  const tRun = seg[seg.length - 1].u - seg[0].u;
  // 걷기로 바뀐 뒤 1.5 s 의 빠르기 (같은 스틱 · 걷기)
  const after = rec.filter((r) => r.u > rec[i1].u + 1.0 && r.u < rec[i1].u + 2.0);
  const vWalk = after.length > 1 ? Math.hypot(after[after.length - 1].x - after[0].x, after[after.length - 1].z - after[0].z) / (after[after.length - 1].u - after[0].u) : NaN;
  return { tRun, dist, vMax, tUp, falls, catchT, airT, cad: steps / tRun, end: rec[i1].end, stEnd: rec[i1].st, vWalk, walkTop: walkTopOf(P), rate: runCostRate(P), offMax: Math.max(...seg.map((r) => r.off)) };
}

const SCHOOLS = [
  ['독일 (롱소드)', 'longsword', null],
  ['이탈리아 (레이피어)', 'rapier', null],
  ['이베리아 (츠바이헨더)', 'zweihander', null],
  ['일본 J1 없음 (우치가타나)', 'uchigatana', kitFromNodes('japanese', new Set())],
  ['일본 J1 (우치가타나)', 'uchigatana', kitFromNodes('japanese', new Set(['J1']))],
  ['동방 C2 없음 (청강검 · 보법 C1)', 'qinggang', kitFromNodes('chinese', new Set(['C1']))],
  ['동방 C2 (청강검 · C1 C2)', 'qinggang', kitFromNodes('chinese', new Set(['C1', 'C2']))],
];

const fx = (x, n = 2) => (Number.isFinite(x) ? x.toFixed(n) : '-');

function table(st0s = [100, 50]) {
  console.log('| 유파 | 시작 기력 | 뛴 시간 실제 s (게임) | 거리 m | 가장 빠름 실제 m/s (게임) | 95 % 까지 실제 s | 걷는 끝 실제 m/s | 기력 실제 초당 | 걸음/실제 s | 날기 몫 | 붙잡기 s | 넘어짐 | 끝 |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const [name, weapon, kit] of SCHOOLS) {
    for (const s0 of st0s) {
      const m = measureRun({ weapon, kit, stamina0: s0 });
      console.log(`| ${name} | ${s0} | ${fx(m.tRun / K)} (${fx(m.tRun)}) | ${fx(m.dist, 1)} | ${fx(m.vMax * K)} (${fx(m.vMax)}) | ${fx(m.tUp / K)} | ${fx(m.walkTop * K)} | ${fx(m.rate * K)} | ${fx((m.cad * K), 1)} | ${fx(m.airT / m.tRun)} | ${fx(m.catchT)} | ${m.falls} | ${m.end} ${fx(m.stEnd, 1)} |`);
    }
  }
}

/** 뒤로 뛰기: 상대를 보다가 스틱을 뒤 끝으로 → 몸이 돌아 뛰는 쪽을 보기까지 · 2 s 뛴 뒤 스틱을 놓고 → 다시 상대를 보기까지 */
function turn(weapon = 'longsword') {
  const { rec } = runCase({ weapon, T: 6, script: (u) => (u < 2.5 ? { sx: 0, sy: -1, reach: 1 } : { sx: 0, sy: 0, reach: 0 }) });
  const faceAway = rec.find((r) => Math.abs(wrap(r.head - Math.PI)) < 0.15);
  const stop = rec.find((r) => r.u >= 2.5);
  const back = rec.find((r) => r.u > 2.5 && Math.abs(wrap(Math.atan2(-(0 - 0), 100 - r.x) - r.head)) < 0.15);
  const falls = rec.filter((r, i) => i > 0 && rec[i - 1].state === 'stand' && r.state !== 'stand').length;
  console.log(`뒤로 뛰기 (${weapon}): 등 돌리기(±0.15 rad) ${fx(faceAway?.u / K)} 실제 s · 2.5 s 에 놓음(빠르기 ${fx(stop.v * K)} 실제 m/s) → 상대 쪽 돌아옴 ${fx((back?.u - 2.5) / K)} 실제 s · 넘어짐 ${falls}`);
}

/** 공격 입력으로 끊기: 2 s 뛴 뒤 runBreak(톡 찌르기) → 걷는 끝 빠르기까지 줄어드는 시간 · 거리 */
function brk(weapon = 'longsword') {
  const { P, rec } = runCase({ weapon, T: 5, script: (u) => ({ sx: 0, sy: 1, reach: 1, brk: u >= 2 && u < 2 + DT, thrust: u >= 2 && u < 2 + DT }) });
  const at = rec.find((r) => r.u >= 2);
  const wt = walkTopOf(P) * 1.05;
  const slow = rec.find((r) => r.u > 2 && r.v <= wt);
  const falls = rec.filter((r, i) => i > 0 && rec[i - 1].state === 'stand' && r.state !== 'stand').length;
  console.log(`공격으로 끊기 (${weapon}): 끊을 때 ${fx(at.v * K)} 실제 m/s · 걷는 끝 ×1.05 까지 ${fx((slow?.u - 2) / K)} 실제 s · ${fx(Math.hypot(slow.x - at.x, slow.z - at.z))} m · 끝 까닭 ${rec.find((r) => r.u > 2 && !r.on)?.end} · 넘어짐 ${falls}`);
}

/** 걷기만 (스틱 0.9 · 뛰기 문턱 밑): 걷는 빠르기 */
function walk(weapon = 'longsword') {
  const { P, rec } = runCase({ weapon, T: 4, script: () => ({ sx: 0, sy: 1, reach: 0.9 }) });
  const a = rec.find((r) => r.u >= 2);
  const b = rec[rec.length - 1];
  console.log(`걷기 (${weapon}, 스틱 0.9 — 뛰지 않음): ${fx(Math.hypot(b.x - a.x, b.z - a.z) / (b.u - a.u) * K)} 실제 m/s · 뛰었나 ${rec.some((r) => r.on)} · 걷는 끝 ${fx(walkTopOf(P) * K)}`);
}

if (process.argv[1]?.endsWith('run_measure.mjs')) {
  const [cmd = '표', w, s0] = process.argv.slice(2);
  if (cmd === '표') table();
  else if (cmd === 'run') console.log(measureRun({ weapon: w ?? 'longsword', stamina0: +(s0 ?? 100) }));
  else if (cmd === 'turn') turn(w);
  else if (cmd === 'brk') brk(w);
  else if (cmd === 'walk') walk(w);
}
