// 걸음 리듬 계기 (10/10 사장님 '레이피어 물러나기·멈추기가 다리를 저는 것처럼 — 리듬감·탄력감이 없다'): 플레이어 스틱 대본에서
//  디딤 시각열을 뽑아 '저는 느낌'을 숫자로 — 짝 박자 비 · 끌림 · 좌우 디딤 비대칭 · 골반 박자 출렁임 · 멈출 때 남은 발 끌려옴.
//  상대는 제자리(player_gait_feel 과 같은 판). 플레이어(index 0)는 AI 없이 스틱(fighter.move)만. 읽기만 — 물리·난수는 게임 그대로, 결정적.
//  대본: 시작 정지 → 앞으로 상대 가슴 near m 까지 → 0.8 s 쉼 → [뒤 2.4 s → 놓음 1.2 s] → (다시 가슴 2.75 m 까지 다가가 0.8 s 쉼) → [앞 1.2 s → 놓음 1.2 s]. near 2.3·2.5·2.7 세 번, 스틱 세기 1.0·0.6 두 벌.
//  계기 (걷는 구간 = 스틱을 민 동안, 각 디딤은 발이 땅에 닿은 물리 스텝):
//   짝 박자 비   : 가는 쪽으로 앞선 발 디딤(이끔) → 다음 디딤이 따라붙는 발(따름)이면 그 간격 a, 따름 → 이끔 간격 b. a/b (따·닥 짝걸음 = 작다, 고른 셔플 = 1 언저리).
//                  지나 딛는 걸음(passing — 모든 디딤이 이끔)은 '-'
//   간격 CV     : 디딤 간격의 표준편차/평균 (고른 셔플 = 작다, 짝걸음 = 크다 — 박자가 두 가지라서). 좌우 박자 비 = (F 로 끝나는 간격 평균)/(B 로 끝나는 간격 평균)
//   끌림        : 발바닥이 1 cm 아래인데 발이 0.05 m/s 넘게 수평으로 움직인 시간·거리 (딛은 발이 미끄러진 것 + 낮게 끌며 옮긴 것)
//   디딤 비대칭  : F·B 발 한 걸음 평균 길이 차 / 평균 (0 = 같다)
//   골반 박자 출렁임: 한 짝(같은 발 디딤 → 다음 같은 발 디딤)을 12 칸으로 나눠 칸마다 골반 높이(구간 평균을 뺀) 평균 → 그 곡선의 높낮이 차 cm 와,
//                  그 곡선이 전체 출렁임을 설명하는 몫(%) — 박자에 맞춘 오르내림이면 크다. 표준편차 = 걷는 구간(첫 0.3 s 뺌) 골반 높이
//   멈춤        : 놓은 뒤 마지막 디딤까지 s (남은 발이 끌려와 서는 시간)·그 사이 걸음 수·골반 0.1 m/s 아래로 멈추는 s
//  실행: node tools/sim/gait_rhythm.mjs [무기id ...]   (GAIT_JSON='{"italian":{...}}' 로 유파 걸음 칸 덮어 재기, RHY_STICK=1 이면 스틱 1.0 만)
import { newRound, DT, THREE } from './harness_m.mjs';
import { GAIT } from '../../src/config.js';
import { TRADITIONS } from '../../src/schools.js';
if (process.env.GAIT_JSON) for (const [t, o] of Object.entries(JSON.parse(process.env.GAIT_JSON))) TRADITIONS[t].gait = { ...(TRADITIONS[t].gait ?? {}), ...o };

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ['rapier', 'longsword'];
const STICKS = process.env.RHY_STICK ? [Number(process.env.RHY_STICK)] : [1.0, 0.6];
const NEARS = [2.3, 2.5, 2.7];
const FWD_FROM = 2.75;
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();

function run(id, near, stick) {
  const G = newRound({ walls: true, seed: 7, weapon: id, weapon2: 'longsword' });
  G.ai.update = () => G.enemy.move.set(0, 0);
  const P = G.player;
  const g = P.gait;
  let t = 0;
  let falls = 0;
  let catches = 0;
  let prevSt = P.state;
  const prev = { F: true, B: true };
  const phases = []; // { name, t0, t1, dir:{x,z}, tds:[], samples:[] , release }
  let ph = null;
  const step = (mx, my) => {
    P.move.set(mx, my);
    G.step();
    t += DT;
    if (prevSt === 'stand' && P.state === 'down') falls++;
    prevSt = P.state;
    if (!g?.active || !ph) {
      if (g?.active) for (const k of ['F', 'B']) prev[k] = g.legs[k].stance;
      return;
    }
    for (const k of ['F', 'B']) {
      const l = g.legs[k];
      if (!prev[k] && l.stance) ph.tds.push({ t, k, kind: l.kind, x: l.plant.x, z: l.plant.z, follow: !!g.follow });
      if (prev[k] && !l.stance && l.kind === 'catch') catches++;
      prev[k] = l.stance;
    }
    const pv = P.bodies.pelvis.translation();
    const s = { t, py: pv.y, px: pv.x, pz: pv.z, feet: {} };
    for (const k of ['F', 'B']) {
      const l = g.legs[k];
      const v = P.bodies[l.foot].linvel();
      s.feet[k] = { sole: l.soleY, vh: Math.hypot(v.x, v.z), stance: l.stance };
    }
    const lv = P.bodies.pelvis.linvel();
    s.vh = Math.hypot(lv.x, lv.z);
    s.dF = Math.hypot(g.legs.F.hip.x - g.legs.F.plant.x, g.legs.F.hip.z - g.legs.F.plant.z);
    s.dB = Math.hypot(g.legs.B.hip.x - g.legs.B.plant.x, g.legs.B.hip.z - g.legs.B.plant.z);
    s.h = g.h;
    s.hN = g.hNom;
    ph.samples.push(s);
  };
  while (t < 2.3) step(0, 0);
  const t0 = t;
  while (P.foeDistance() > near && t - t0 < 8) step(0, 1);
  for (let i = 0; i < 0.8 / DT; i++) step(0, 0);
  const out = [];
  for (const [name, my, dur] of [['뒤', -1, 2.4], ['앞', 1, 1.2]]) {
    if (my > 0) {
      // 앞: 상대 가슴 FWD_FROM m 안(follow 문턱 2.8 안쪽)까지 (재지 않고) 다가간 뒤 쉬었다가
      while (P.foeDistance() > FWD_FROM && t - t0 < 30) step(0, 1);
      for (let i = 0; i < 0.8 / DT; i++) step(0, 0);
    }
    P.forward(_f);
    ph = { name, dir: { x: _f.x * my, z: _f.z * my }, tds: [], samples: [], t0: t, init: { F: { k: 'F', x: g.legs.F.plant.x, z: g.legs.F.plant.z }, B: { k: 'B', x: g.legs.B.plant.x, z: g.legs.B.plant.z } } };
    for (let i = 0; i < dur / DT; i++) step(0, my * stick);
    ph.release = t;
    for (let i = 0; i < 1.2 / DT; i++) step(0, 0);
    out.push(ph);
    ph = null;
  }
  return { phases: out, falls, catches };
}

function analyse(ph) {
  const walk = ph.tds.filter((d) => d.t <= ph.release + 1e-9 && d.t > ph.t0 + 0.05);
  const dir = ph.dir;
  // 디딤마다 이끔/따름: 디딘 발이 다른 발(그때 딛고 있던 마지막 자리)보다 가는 쪽으로 앞이면 이끔
  const lastAll = { ...ph.init };
  const tagged = [];
  for (const d of ph.tds) {
    const o = lastAll[d.k === 'F' ? 'B' : 'F'];
    const prevSelf = lastAll[d.k];
    d.lead = o ? (d.x - o.x) * dir.x + (d.z - o.z) * dir.z > 0 : true;
    d.len = prevSelf ? Math.hypot(d.x - prevSelf.x, d.z - prevSelf.z) : NaN;
    lastAll[d.k] = d;
    tagged.push(d);
  }
  const W = tagged.filter((d) => walk.includes(d));
  const ab = { a: [], b: [] };
  const lr = { F: [], B: [] };
  const iv = [];
  for (let i = 1; i < W.length; i++) {
    const dt = W[i].t - W[i - 1].t;
    iv.push(dt);
    lr[W[i].k].push(dt);
    if (W[i - 1].lead && !W[i].lead) ab.a.push(dt);
    else if (!W[i - 1].lead && W[i].lead) ab.b.push(dt);
  }
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
  const sd = (a) => {
    const m = mean(a);
    return a.length > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length) : NaN;
  };
  const pairRatio = ab.a.length >= 2 && ab.b.length >= 2 ? mean(ab.a) / mean(ab.b) : NaN;
  const cv = sd(iv) / mean(iv);
  const lrRatio = mean(lr.F) / mean(lr.B);
  const lenF = mean(W.filter((d) => d.k === 'F' && Number.isFinite(d.len)).map((d) => d.len));
  const lenB = mean(W.filter((d) => d.k === 'B' && Number.isFinite(d.len)).map((d) => d.len));
  const asym = Math.abs(lenF - lenB) / ((lenF + lenB) / 2);
  // 끌림 (걷는 구간 + 멈춤 구간 모두)
  let dragT = 0;
  let dragD = 0;
  for (const s of ph.samples) {
    for (const k of ['F', 'B']) {
      const f = s.feet[k];
      if (f.sole < 0.01 && f.vh > 0.05) {
        dragT += DT;
        dragD += f.vh * DT;
      }
    }
  }
  // 골반 박자 출렁임: 걷는 구간, 같은 발(F) 디딤 사이를 한 짝으로
  const ws = ph.samples.filter((s) => s.t > ph.t0 + 0.3 && s.t <= ph.release);
  const pm = mean(ws.map((s) => s.py));
  const fT = W.filter((d) => d.k === 'F').map((d) => d.t);
  const NB = 12;
  const bins = Array.from({ length: NB }, () => []);
  let totVar = 0;
  let nVar = 0;
  for (let i = 1; i < fT.length; i++) {
    for (const s of ws) {
      if (s.t < fT[i - 1] || s.t >= fT[i]) continue;
      const u = (s.t - fT[i - 1]) / (fT[i] - fT[i - 1]);
      bins[Math.min(NB - 1, Math.floor(u * NB))].push(s.py - pm);
      totVar += (s.py - pm) ** 2;
      nVar++;
    }
  }
  const prof = bins.map(mean);
  const ok = prof.every(Number.isFinite);
  const bobAmp = ok ? Math.max(...prof) - Math.min(...prof) : NaN;
  let expl = NaN;
  if (ok && nVar) {
    let v = 0;
    for (let b = 0; b < NB; b++) v += bins[b].length * prof[b] ** 2;
    expl = v / totVar;
  }
  const pStd = Math.sqrt(ws.reduce((a, s) => a + (s.py - pm) ** 2, 0) / Math.max(1, ws.length));
  // 멈춤
  const after = ph.tds.filter((d) => d.t > ph.release);
  const lastTD = after.length ? after[after.length - 1].t - ph.release : 0;
  const stopSample = ph.samples.find((s) => s.t > ph.release && s.vh < 0.1);
  const stopT = stopSample ? stopSample.t - ph.release : NaN;
  // 0.8 s·1.6 s 간 거리
  const s0 = ph.samples[0];
  const at = (tt) => ph.samples.find((s) => s.t >= tt) ?? ph.samples[ph.samples.length - 1];
  const dist = (s) => (s.px - s0.px) * dir.x + (s.pz - s0.pz) * dir.z;
  const followShare = W.length ? W.filter((d) => d.follow).length / W.length : 0;
  return { n: W.length, pairRatio, cv, lrRatio, asym, dragT, dragD, bobAmp, expl, pStd, lastTD, nAfter: after.length, stopT, d08: dist(at(ph.t0 + 0.8)), d16: dist(at(ph.release)), d12: dist(at(ph.t0 + 1.2)), followShare, ivs: iv, aMean: mean(ab.a), bMean: mean(ab.b) };
}

const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '-');
console.log('| 무기 | 스틱 | 방향 | 디딤 수 | 짝 박자 비 a/b (a·b s) | 간격 CV | 좌우 박자 비 | 디딤 비대칭 | 끌림 s · m | 골반 박자 출렁임 cm (설명 %) · 표준편차 cm | 0.8 s · 1.2 s 거리 m | 놓고 마지막 디딤 s (걸음) · 멈춤 s | follow 몫 | 옮겨 딛기 · 넘어짐 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const avg = (rs, fn) => {
  const v = rs.map(fn).filter(Number.isFinite);
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : NaN;
};
for (const id of ids) {
  for (const stick of STICKS) {
    const runs = NEARS.map((n) => run(id, n, stick));
    for (const pi of [0, 1]) {
      const rs = runs.map((r) => analyse(r.phases[pi]));
      const name = runs[0].phases[pi].name;
      const c = runs.reduce((a, r) => a + r.catches, 0);
      const fl = runs.reduce((a, r) => a + r.falls, 0);
      console.log(
        `| ${id} | ${stick} | ${name} | ${f1(avg(rs, (x) => x.n))} | ${f2(avg(rs, (x) => x.pairRatio))} (${f2(avg(rs, (x) => x.aMean))}·${f2(avg(rs, (x) => x.bMean))}) | ${f2(avg(rs, (x) => x.cv))} | ${f2(avg(rs, (x) => x.lrRatio))} | ${f2(avg(rs, (x) => x.asym))} | ${f2(avg(rs, (x) => x.dragT))} · ${f2(avg(rs, (x) => x.dragD))} | ${f1(100 * avg(rs, (x) => x.bobAmp))} (${Math.round(100 * avg(rs, (x) => x.expl))}) · ${f1(100 * avg(rs, (x) => x.pStd))} | ${f2(avg(rs, (x) => x.d08))} · ${f2(avg(rs, (x) => x.d12))} | ${f2(avg(rs, (x) => x.lastTD))} (${f1(avg(rs, (x) => x.nAfter))}) · ${f2(avg(rs, (x) => x.stopT))} | ${Math.round(100 * avg(rs, (x) => x.followShare))}% | ${pi === 0 ? `${c} · ${fl}` : ''} |`,
      );
      if (process.env.RHY_TRACE) {
        const ph = runs[0].phases[pi];
        let line = '';
        for (const sm of ph.samples) {
          const k = Math.round((sm.t - ph.t0) / DT);
          if (k % 4) continue;
          line += `${(sm.t - ph.t0).toFixed(2)}:${(sm.py * 100).toFixed(1)}${sm.feet.F.stance ? 'F' : 'f'}${sm.feet.B.stance ? 'B' : 'b'}${sm.vh.toFixed(2)}${process.env.RHY_TRACE === '2' ? `[h${(sm.h * 100).toFixed(0)} n${(sm.hN * 100).toFixed(0)} F${sm.dF.toFixed(2)} B${sm.dB.toFixed(2)}]` : ''} `;
        }
        console.log('   ', line);
      }
      if (process.env.RHY_SEQ) for (const r of runs) console.log('   ', r.phases[pi].tds.filter((d) => d.t <= r.phases[pi].release && d.t > r.phases[pi].t0).map((d) => `${(d.t - r.phases[pi].t0).toFixed(2)}${d.k}${d.lead ? '↑' : '↓'}${d.kind[0]}${d.follow ? '' : '*'}`).join(' '));
    }
  }
}
