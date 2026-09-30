// 쓰러진 상대에게 탭 찌르기(skill.thrust) → 마무리 찌르기가 들어가는가 — 측정 도구
//  상대를 쓰러뜨려(일어나지 못하게) 여러 거리에 두고, 플레이어 칼을 교본 자세 하나(쟁기·황소·지붕·바보)에 둔 채
//  화면을 톡 친 것처럼 skill.thrust() 를 부른다. 탭 뒤 WIN 초 안의 첫 접촉·몸통 접촉·상처를 센다.
//   거리 = 내 가슴에서 상대 몸통(가슴·배·골반) 가장 가까운 곳까지 수평 거리 (down_hits.mjs torsoDist)
//   걸음: 탭이 다리 걸음(gait.requestStep)을 부탁했나·거절됐나·그 발이 디뎠나(탭→디딤), 골반이 앞으로 간 거리
//   손 각도: 칼자루가 탭 → 몸통 접촉까지 움직인 방향(수평 아래 각도), 뻗기 시작(thrustPush) → 접촉 방향
//   판금(하인리히 겉모습): 첫 몸통 접촉의 판정 에너지(eff)와 문턱(thr)
//  사용법: node tools/sim/finish_thrust.mjs [판 수(칸마다)=3] [무기 id] [--armour=none|plate|both] [--guards=쟁기,황소,지붕,바보]
//          [--dists=0.5,0.8,1.1,1.4,1.6] [--falls=toward,away,left,right] [--seed=첫 번호] [--stand] [--rows]
//   --stand : 서 있는 상대 대조 (마무리 경로가 걸리지 않아야 한다 — 바꾸기 전·후 바이트 같음)
//   --rows  : 판마다 한 줄씩 더 찍는다
//   시드: 500 + 17s + 거리×100 + 방향 번호×1000 (자세마다 같은 판). 결정적(같은 입력 → 같은 출력)
import { newRound, DT, THREE, V, Q } from './harness_m.mjs';
import { torsoDist, FALLS } from './down_hits.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { isMain } from './is_main.mjs';

export const PADS = { 쟁기: [0.18, -0.28], 황소: [0.22, 0.26], 지붕: [0.02, 0.52], 바보: [0.0, -0.5] };
const TORSO = new Set(['chest', 'abdomen', 'pelvis']);
const R2D = 180 / Math.PI;
const WIN = 1.5; // 탭 뒤 재는 시간 (초) — 걸음을 기다리는 찌르기도 들어가도록 넉넉히
const PLATE = CHARACTERS.find((c) => c.id === 'heinrich').look;

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  for (const k of ['prev', 'aim', 'aimRaw']) f.skill[k].set(xy[0], xy[1]);
  f.skill.anchor?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}

/** 패드를 휘두르기가 아니게 천천히(1m/s) 자세로 옮긴다 */
function padTo(G, P, pad, secs) {
  for (let i = 0; i < secs / DT; i++) {
    const off = P.handOffset;
    const dx = pad[0] - off.x;
    const dy = pad[1] - off.y;
    const d = Math.hypot(dx, dy);
    const st = 1.0 * DT;
    if (d > st) (off.x += (dx / d) * st), (off.y += (dy / d) * st);
    else off.set(pad[0], pad[1]);
    P.move.set(0, 0);
    G.step();
  }
}

/** 탭 한 번을 WIN 초 동안 지켜본다 */
function watchTap(G, t0, fwd) {
  const P = G.player;
  const E = G.enemy;
  const log = [];
  const C = G.combat;
  const orig = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (pr.w.fighter === P && pr.v && r && G.t >= t0) {
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation()));
      log.push({ t: G.t, part: pr.v.part, type: r.type, energy: r.energy, eff: r.eff, thr: r.thr, plate: r.plate, axisEl: Math.asin(THREE.MathUtils.clamp(axis.y, -1, 1)) * R2D, grip: V(P.sword.translation()), pel: V(P.bodies.pelvis.translation()), push: P.skill.thrustPush });
    }
    return r;
  };
  // 걸음 부탁·디딤 (gait 가 켜져 있을 때)
  const st = { req: [], plant: null, push: null, pushGrip: null };
  const g = P.gait;
  if (g) {
    const rq = g.requestStep.bind(g);
    g.requestStep = (o) => {
      const ok = rq(o);
      st.req.push({ t: G.t, fwd: o?.fwd, ok });
      return ok;
    };
    const td = g.touchdown.bind(g);
    g.touchdown = (l, s) => {
      if (l.kind === 'req' && st.plant == null && G.t >= t0) st.plant = G.t;
      return td(l, s);
    };
  }
  return { log, st, E, fwd };
}

export function finishTrial({ guard, dist, fall, seed, weapon = 'longsword', plate = false, before }) {
  const G = newRound({ walls: false, gap: 2.4, seed, weapon, weapon2: 'longsword', ...(plate ? { look2: PLATE } : {}) });
  G.ai.update = () => {};
  before?.(G);
  const P = G.player;
  const E = G.enemy;
  const step = (mv = 0) => {
    P.move.set(0, mv);
    G.step();
  };
  setHand(P, PADS.쟁기);
  const j1 = Math.random() - 0.5;
  const j2 = Math.random() - 0.5;
  E.knockDown(true);
  E.downTime = 1e9;
  const a = FALLS[fall] + j1 * 0.5;
  const J = 40 * (1 + j2 * 0.4);
  for (let i = 0; i < 2.5 / DT; i++) {
    if (i * DT < 0.25) for (const k of ['chest', 'head']) E.bodies[k].applyImpulse({ x: Math.cos(a) * J * DT * 4, y: 0, z: Math.sin(a) * J * DT * 4 }, true);
    step();
  }
  for (const [tol, mx] of [[0.12, 0.5], [0.03, 0.22]]) {
    for (let i = 0; i < 5 / DT; i++) {
      const d = torsoDist(P, E);
      if (Math.abs(d - dist) < tol) break;
      step(THREE.MathUtils.clamp((d - dist) * 2.5, -mx, mx));
    }
    for (let i = 0; i < 0.6 / DT; i++) step();
  }
  padTo(G, P, PADS[guard], 1.2);
  for (let i = 0; i < 0.4 / DT; i++) step();
  const d0 = torsoDist(P, E);
  const finOn = P.finish.on;
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(P.yaw);
  fwd.y = 0;
  fwd.normalize();
  const g0 = V(P.sword.translation());
  const pel0 = V(P.bodies.pelvis.translation());
  const t0 = G.t;
  const W = watchTap(G, t0, fwd);
  const w0 = G.wounds.length;
  const ok = P.skill.thrust();
  const down = !!P.skill.tap?.down;
  let pelMax = 0;
  for (let i = 0; i < WIN / DT; i++) {
    step();
    if (W.st.push == null && P.skill.thrustPush) (W.st.push = G.t), (W.st.pushGrip = V(P.sword.translation()));
    pelMax = Math.max(pelMax, V(P.bodies.pelvis.translation()).sub(pel0).dot(fwd));
  }
  const first = W.log[0] ?? null;
  const tor = W.log.find((l) => TORSO.has(l.part)) ?? null;
  const ws = G.wounds.slice(w0).filter((w) => w.att === P && (w.type === 'cut' || w.type === 'stab') && w.severity > 0);
  const ang = (from, to) => {
    const d = to.clone().sub(from);
    return Math.atan2(-d.y, d.dot(fwd)) * R2D;
  };
  const req = W.st.req[0] ?? null;
  return {
    guard, dist, fall, seed, plate, d0, finOn, ok, down,
    reqd: !!req, refused: !!req && !req.ok, reqFwd: req?.fwd ?? null,
    tPlant: W.st.plant != null ? W.st.plant - t0 : null, tPush: W.st.push != null ? W.st.push - t0 : null,
    pelAtHit: tor ? tor.pel.clone().sub(pel0).dot(fwd) : null, pelMax,
    first: first ? { part: first.part, type: first.type } : null,
    tor: tor ? { type: tor.type, energy: tor.energy, eff: tor.eff, thr: tor.thr, plate: tor.plate, axisEl: tor.axisEl, push: tor.push } : null,
    tTor: tor ? tor.t - t0 : null,
    handTap: tor ? ang(g0, tor.grip) : null,
    handPush: tor && W.st.pushGrip && W.st.push <= tor.t ? ang(W.st.pushGrip, tor.grip) : null,
    wound: ws.length > 0, stab: ws.some((w) => w.type === 'stab'), sev: ws.reduce((m, w) => Math.max(m, w.severity), 0),
  };
}

/** 대조: 서 있는 상대 (칼을 바보 자세로 내림), 탭 한 번 */
export function standTrial({ guard, gap, seed, weapon = 'longsword' }) {
  const G = newRound({ walls: false, gap, seed, weapon, weapon2: 'longsword' });
  G.ai.update = () => {};
  const P = G.player;
  const E = G.enemy;
  setHand(P, PADS.쟁기);
  setHand(E, PADS.바보);
  padTo(G, P, PADS[guard], 1.2);
  for (let i = 0; i < 0.8 / DT; i++) (P.move.set(0, 0), G.step());
  const t0 = G.t;
  const W = watchTap(G, t0, null);
  const w0 = G.wounds.length;
  const ok = P.skill.thrust();
  const down = !!P.skill.tap?.down;
  for (let i = 0; i < 0.8 / DT; i++) (P.move.set(0, 0), G.step());
  const first = W.log[0] ?? null;
  const ws = G.wounds.slice(w0).filter((w) => w.att === P && (w.type === 'cut' || w.type === 'stab') && w.severity > 0);
  return { guard, gap, ok, down, first: first ? `${first.part}/${first.type}/${first.energy.toFixed(3)}` : '-', wound: ws.length > 0, sev: ws.reduce((m, w) => m + w.severity, 0), reqd: W.st.req.length, pel: V(P.bodies.pelvis.translation()).toArray().map((x) => x.toFixed(5)).join(',') };
}

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const pc = (k, n) => (n ? `${Math.round((100 * k) / n)}%` : '-');

function line(label, rs) {
  const n = rs.length;
  if (!n) return;
  const c = rs.filter((r) => r.first);
  const t = rs.filter((r) => r.tor);
  const w = rs.filter((r) => r.wound);
  const rq = rs.filter((r) => r.reqd);
  const acc = rq.filter((r) => !r.refused);
  const pl = acc.filter((r) => r.tPlant != null);
  console.log(
    `${label.padEnd(12)} n=${String(n).padStart(3)} 닿음 ${pc(c.length, n).padStart(4)} 몸통 ${pc(t.length, n).padStart(4)} 상처 ${pc(w.length, n).padStart(4)} (찌르기 ${pc(rs.filter((r) => r.stab).length, n)}) 깊이 ${f(avg(w.map((r) => r.sev)))}` +
      ` | 몸통 E ${f(avg(t.map((r) => r.tor.energy)), 0)}J 탭→몸통 ${f(avg(t.map((r) => r.tTor)))}s 탭→뻗기 ${f(avg(rs.filter((r) => r.tPush != null).map((r) => r.tPush)))}s 손 ${f(avg(t.map((r) => r.handTap)), 0)}°/${f(avg(t.filter((r) => r.handPush != null).map((r) => r.handPush)), 0)}° 칼 ${f(avg(t.map((r) => r.tor.axisEl)), 0)}°` +
      ` | 걸음 부탁 ${pc(rq.length, n)} 거절 ${rq.length - acc.length} 디딤 ${pl.length}/${acc.length} 길이 ${f(avg(rq.map((r) => r.reqFwd)))}m 탭→디딤 ${f(avg(pl.map((r) => r.tPlant)))}s 골반 ${f(avg(rs.map((r) => r.pelMax)))}m | 겨눔 ${pc(rs.filter((r) => r.finOn).length, n)} d0 ${f(avg(rs.map((r) => r.d0)))}`,
  );
}

function report(rows, guards, dists, falls, tag) {
  console.log(`── ${tag} ──`);
  for (const g of guards) line(g, rows.filter((r) => r.guard === g));
  for (const d of dists) line(`${d}m`, rows.filter((r) => r.dist === d));
  for (const fl of falls) line(fl, rows.filter((r) => r.fall === fl));
  line('전체', rows);
  // 칸: 자세 × 거리 상처율 (닿음)
  console.log(`칸 (상처% / 닿음%): ${'자세'.padEnd(4)} ${dists.map((d) => `${d}m`.padStart(11)).join('')}`);
  for (const g of guards) {
    const cells = dists.map((d) => {
      const rs = rows.filter((r) => r.guard === g && r.dist === d);
      return `${pc(rs.filter((r) => r.wound).length, rs.length)}/${pc(rs.filter((r) => r.first).length, rs.length)}`.padStart(11);
    });
    console.log(`                   ${g.padEnd(4)} ${cells.join('')}`);
  }
  const t = rows.filter((r) => r.tor);
  const types = {};
  for (const r of t) types[r.tor.type] = (types[r.tor.type] || 0) + 1;
  console.log(`몸통 첫 접촉 판정 ${JSON.stringify(types)} · 뻗는 중(thrustPush) ${pc(t.filter((r) => r.tor.push).length, t.length)} · 판금 위 ${t.filter((r) => r.tor.plate).length}`);
  const pl = t.filter((r) => r.tor.plate && r.tor.thr != null);
  if (pl.length) console.log(`판금 위 몸통 접촉 ${pl.length}: eff ${f(avg(pl.map((r) => r.tor.eff)), 0)}J 문턱 ${f(avg(pl.map((r) => r.tor.thr)), 0)}J · 문턱 넘음 ${pl.filter((r) => r.tor.eff > r.tor.thr).length}`);
  const miss = rows.filter((r) => !r.wound);
  if (miss.length) console.log(`상처 없음 ${miss.length}: ${miss.map((r) => `${r.guard}${r.dist}${r.fall[0]}:${r.tor ? `${r.tor.type}${f(r.tor.eff ?? r.tor.energy, 0)}/${f(r.tor.thr, 0)}J` : r.first ? `${r.first.part}` : '안닿음'}`).join(' ')}`);
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
  const N = +(pos[0] || 3);
  const weapon = pos[1] || 'longsword';
  const S0 = +(opt('seed') ?? 1);
  const guards = opt('guards')?.split(',') ?? Object.keys(PADS);
  const dists = opt('dists')?.split(',').map(Number) ?? [0.5, 0.8, 1.1, 1.4, 1.6];
  const falls = opt('falls')?.split(',') ?? Object.keys(FALLS);
  const armour = opt('armour') ?? 'both';
  const fallNo = Object.fromEntries(Object.keys(FALLS).map((k, i) => [k, i]));
  if (args.includes('--stand')) {
    console.log(`탭 찌르기 대조: 서 있는 상대 · ${weapon} · 자세마다 간격 1.2/1.5/1.8m × ${N}판`);
    for (const guard of guards)
      for (const gap of [1.2, 1.5, 1.8])
        for (let s = S0; s < S0 + N; s++) {
          const r = standTrial({ guard, gap, seed: 300 + 11 * s + Math.round(gap * 10), weapon });
          console.log(`${guard} ${gap} s${s} ok ${r.ok} down ${r.down} 걸음 ${r.reqd} 첫 ${r.first} 상처 ${r.wound} ${r.sev.toFixed(4)} 골반 ${r.pel}`);
        }
  } else {
    console.log(`마무리 찌르기 (쓰러진 상대에게 탭) · ${weapon} · 칸마다 ${N}판 · 자세 ${guards} · 거리 ${dists} · 방향 ${falls} · 재는 시간 ${WIN}s`);
    for (const plate of armour === 'both' ? [false, true] : [armour === 'plate']) {
      const rows = [];
      for (const guard of guards)
        for (const dist of dists)
          for (const fall of falls)
            for (let s = S0; s < S0 + N; s++) rows.push(finishTrial({ guard, dist, fall, seed: 500 + 17 * s + Math.round(dist * 100) + fallNo[fall] * 1000, weapon, plate }));
      report(rows, guards, dists, falls, plate ? '판금 (하인리히 겉모습)' : '맨몸 (기본 적 겉모습)');
      if (args.includes('--rows')) for (const r of rows) console.log(JSON.stringify(r));
    }
  }
}
