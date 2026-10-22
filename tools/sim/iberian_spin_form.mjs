// ─────────────────────────────────────────────────────────────
//  iberian_spin_form.mjs — 휘감아 돌기 몸꼴 재기 (10/23 사장님 01:0x '동작에 따라 너무 위로 치솟더라 … 높이가 몸통부를 넘지 않게' ·
//   '조이스틱 회전에 따라 반대로도' · '마무리 동작이 날아갈 것처럼 너무 휘청거리니까' — src/iberian_spin.js · docs/strike/iberian_spin_2026-10-22.md §11)
//
//  node tools/sim/iberian_spin_form.mjs [--torso=0|1] [--settle=0|1] [--reverse=0|1] [--weapons=zweihander,flamberge] [--starts=tag,ochsR,langort,wechselR,ochsL] [--dirs=0,1,-1] [--targets=none,stand,guard] [--gap=2.3] [--json=파일]
//   start = 낼 때 손 자리(자세 패드 — ai_techniques.js G) · dir 0 = 칼 든 쪽이 정하는 쪽(공격 입력 판 · 10/22 그대로) · 1 = 왼쪽으로(heading +) · −1 = 오른쪽으로
//   target none = 상대를 8 m 앞에(몸꼴만) · stand = 서 있는 과녁(칼 충돌 끔 · 죽지 않음) · guard = 칼을 앞에 든 과녁(칼 충돌 켬 — 막혀 튐)
//   잰 것 (낸 때 ~ 비기 끝 + 0.6 s, 물리 스텝마다):
//    높이 — 칼(손 · 칼날 다섯 점 · 칼끝)의 가장 높은 점 − 내 가슴 점 높이(가슴 몸체 가운데) · 가장 낮은 점 − 골반 점 높이, 단계별(ramp 감기 · wind 감은 채 · free 놓은 뒤 대본 안 · follow 따라 지나감 · stiff 굳음 · after 끝난 뒤)
//    휘청 — 대본이 끝난 순간 골반 수평 빠르기 · 골반 도는 빠르기(°/s) · 그 뒤 0.6 s 동안 골반이 간 길 · 몸 기울기(골반 → 머리 줄의 세로에서 벗어난 각) 최대 · 균형 벗어남(offBalance) 최대 · 균형 걸음 스텝 몫 · 넘어짐
//    맞음 — 칼날 상처 수 · 칼면 닿음 수(corr_lib tapEdge 'flat')
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { G as PADS } from '../../src/ai_techniques.js';
import { tapEdge } from './corr_lib.mjs';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const { SKILL, SECRET } = CONFIG;
for (const k of ['torso', 'settle', 'reverse']) if (args[k] != null) SECRET.ibSpin[k] = +args[k]; // 판 값 견줌 (이 도구 안에서만)
const tap = tapEdge(Combat, THREE, CONFIG);
const PH = ['ramp', 'wind', 'free', 'follow', 'stiff', 'after'];
const SH = CONFIG.ARM.shoulder[1]; // 어깨 관절 높이 = 가슴 점 + 0.1 (몸통 위 끝 — 있는 몸 수)
const ROT = 'rot'; // 도는 빠르기가 최고의 절반 넘는 동안 (대본 rate ≥ 0.5 — 단계와 겹쳐 셈)

function run(w, start, dir, target, gap) {
  const G = newRound({ seed: 7, weapon: w, weapon2: 'longsword', gap: target === 'none' ? 8 : gap, walls: false });
  const P = G.player, E = G.enemy;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  G.ai.update = () => E.move.set(0, 0);
  E.die = () => {};
  if (target === 'stand') for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  else E.handOffset.set(0, 0.05); // guard: 칼끝을 앞으로 든 채 (긴 자세 꼴)
  const W = new PlayerSecretWatch(P, E, { locked: false });
  const pad = PADS[start];
  if (!pad) throw new Error(`자세 ${start}?`);
  const r = { w, start, dir, target, cross: null, fired: false, ph: {}, fin: null, after: null, cuts: 0, flats: 0, why: null };
  for (const k of [...PH, ROT]) r.ph[k] = { top: -9, low: 9, tip: -9, n: 0, over: 0 };
  let t0 = null, tEnd = null, tFin = null, fin = null, fin0 = null, wasSpin = false;
  const flats = [];
  const l = (rec) => {
    if (t0 != null && rec.att === P && rec.vic === E && rec.kind === 'flat') flats.push(rec);
  };
  tap.listeners.add(l);
  const w0 = G.wounds.length;
  const pts = [0, 0.25, 0.5, 0.75, 1];
  const _p = new THREE.Vector3();
  G.before = () => {
    W.update(DT, !!P.skill.sec);
    P.move.set(0, 0);
    if (t0 == null) {
      if (G.t > 1.2) P.handOffset.set(pad[0], pad[1]); // 자세를 잡고 (2.6 s 까지)
      if (G.t > 2.6) {
        const ctx = { ev: 'spin' };
        if (dir) ctx.turnDir = dir;
        r.fired = P.skill.secret({ S: W.S, ctx });
        t0 = G.t;
        if (!r.fired) tEnd = G.t;
      }
      return;
    }
  };
  const after = () => {
    if (t0 == null || !r.fired) return;
    const sec = P.skill.sec;
    const S = P.ibSpin;
    let ph = null;
    if (S) ph = S.free ? 'free' : S.t < S.r ? 'ramp' : 'wind';
    else if (sec) ph = sec.stage === 'stiff' ? 'stiff' : 'follow';
    else ph = 'after';
    if (wasSpin && !S && tFin == null) {
      // 대본이 끝난 순간
      tFin = G.t;
      const pv = P.bodies.pelvis.linvel();
      const pa = P.bodies.pelvis.angvel();
      const pp = P.bodies.pelvis.translation();
      fin0 = { x: pp.x, z: pp.z };
      fin = { v: Math.hypot(pv.x, pv.z), w: (Math.abs(pa.y) * 180) / Math.PI, path: 0, tilt: 0, off: 0, stumble: 0, n: 0, fell: false, last: { x: pp.x, z: pp.z } };
      r.why = P.skill.sec?.spin?.why ?? null;
    }
    wasSpin = !!S;
    if (!sec && tEnd == null) tEnd = G.t;
    if (fin && G.t - tFin <= 0.6) {
      const pp = P.bodies.pelvis.translation();
      const hd = P.bodies.head.translation();
      fin.path += Math.hypot(pp.x - fin.last.x, pp.z - fin.last.z);
      fin.last = { x: pp.x, z: pp.z };
      const tilt = (Math.atan2(Math.hypot(hd.x - pp.x, hd.z - pp.z), hd.y - pp.y) * 180) / Math.PI;
      fin.tilt = Math.max(fin.tilt, tilt);
      fin.off = Math.max(fin.off, P.offBalance ?? 0);
      if ((P.stumble?.length?.() ?? 0) > 1e-3) fin.stumble++;
      fin.n++;
      if (P.state !== 'stand') fin.fell = true;
      fin.w = Math.max(fin.w, (Math.abs(P.bodies.pelvis.angvel().y) * 180) / Math.PI);
    }
    if (ph === 'after' && G.t - tEnd > 0.6) return;
    if (!P.armed) return;
    if (!r.cross && (ph === 'free' || ph === 'follow')) {
      // 칼이 몸 앞 가운데를 가로지를 때 (칼 가로 각 ±15°): 칼끝 높이 · 높이 각 · 칼끝 앞 거리 (iberian_spin.mjs probe 와 같은 셈)
      const tp = P.bladePoint(1), b0 = P.bladePoint(0), fw = P.forward(), rg = P.right(), c = P.bodies.chest.translation();
      const dx = tp.x - b0.x, dz = tp.z - b0.z, dy = tp.y - b0.y, L = Math.hypot(dx, dy, dz);
      const yaw = (Math.atan2(dx * rg.x + dz * rg.z, dx * fw.x + dz * fw.z) * 180) / Math.PI;
      if (Math.abs(yaw) < 15) r.cross = { ty: +tp.y.toFixed(2), el: Math.round((Math.asin(dy / L) * 180) / Math.PI), fwd: +((tp.x - c.x) * fw.x + (tp.z - c.z) * fw.z).toFixed(2), d: +P.foeDistance().toFixed(2), v: +P.tipVel.length().toFixed(1) };
    }
    const cy = P.bodies.chest.translation().y;
    const py = P.bodies.pelvis.translation().y;
    let top = P.sword.translation().y;
    let low = top;
    for (const u of pts) {
      const y = P.bladePoint(u, _p).y;
      top = Math.max(top, y);
      low = Math.min(low, y);
    }
    const tip = P.bladePoint(1, _p).y;
    for (const k of S && S.rate >= 0.5 ? [ph, ROT] : [ph]) {
      const R = r.ph[k];
      R.top = Math.max(R.top, top - cy);
      R.low = Math.min(R.low, low - py);
      R.tip = Math.max(R.tip, tip);
      R.n++;
      if (top > cy + SH) R.over++;
    }
  };
  while (G.t < 8 && (tEnd == null || G.t < tEnd + 0.65)) {
    G.step();
    after();
  }
  tap.listeners.delete(l);
  r.cuts = G.wounds.slice(w0).filter((x) => x.att === P && x.vic === E && x.severity > 0).length;
  r.flats = flats.length;
  r.fin = fin ? { v: +fin.v.toFixed(2), w: Math.round(fin.w), path: +fin.path.toFixed(2), tilt: Math.round(fin.tilt), off: +fin.off.toFixed(2), stumble: fin.n ? +(fin.stumble / fin.n).toFixed(2) : 0, fell: fin.fell } : null;
  r.chest = +P.bodies.chest.translation().y.toFixed(2);
  r.state = P.state;
  G.world.free();
  return r;
}

const WEAPONS = list('weapons', 'zweihander,flamberge');
const STARTS = list('starts', 'tag,ochsR,langort,wechselR,ochsL');
const DIRS = list('dirs', '0').map(Number);
const TARGETS = list('targets', 'none,stand,guard');
const gap = +arg('gap', 2.3);
const all = [];
for (const w of WEAPONS) for (const target of TARGETS) for (const dir of DIRS) for (const s of STARTS) all.push(run(w, s, dir, target, gap));
const f2 = (x) => (x < -8 || x > 8 ? '-' : (x >= 0 ? '+' : '') + x.toFixed(2));
console.log(`칸 = 칼 가장 높은 점 − 내 가슴 점 (m) · 괄호 = 어깨 높이(가슴 + ${SH}) 위로 나간 스텝 몫 % · gap ${gap} · torso ${SECRET.ibSpin.torso} · settle ${SECRET.ibSpin.settle} · reverse ${SECRET.ibSpin.reverse}`);
console.log('| 무기 | 과녁 | 쪽 | 시작 자세 | ' + [...PH, '도는 중(rate ≥ ½)'].join(' | ') + ' | 칼끝 최고 (m) | 가장 낮은 점 − 골반 | 끝난 순간 골반 m/s · 0.6 s 안 도는 °/s 최대 | 0.6 s 골반 길 · 기울기° · 균형 벗어남 · 균형 걸음 몫 · 넘어짐 | 상처 · 칼면 | 대본 끝 | 가로지를 때 칼끝 높이 · 각 · 앞 거리 · 상대 거리 · 빠르기 |');
console.log('|' + '---|'.repeat(13 + PH.length));
for (const r of all) {
  const cells = [...PH, ROT].map((k) => (r.ph[k].n ? `${f2(r.ph[k].top)} (${Math.round((100 * r.ph[k].over) / r.ph[k].n)})` : '-'));
  const tip = Math.max(...PH.map((k) => r.ph[k].tip));
  const low = Math.min(...PH.map((k) => r.ph[k].low));
  const F = r.fin;
  console.log(`| ${r.w} | ${r.target} | ${r.dir || '기본'} | ${r.start} | ${cells.join(' | ')} | ${tip.toFixed(2)} (가슴 ${r.chest}) | ${f2(low)} | ${F ? `${F.v} · ${F.w}` : '-'} | ${F ? `${F.path} · ${F.tilt} · ${F.off} · ${F.stumble} · ${F.fell ? '넘어짐' : '-'}` : '-'} | ${r.cuts} · ${r.flats} | ${r.why ?? (r.fired ? '-' : '못 냄')} | ${r.cross ? `${r.cross.ty} · ${r.cross.el}° · ${r.cross.fwd} · ${r.cross.d} · ${r.cross.v}` : '-'} |`);
}
// 묶음 (무기 × 과녁): 단계별 가장 높은 점 최대 · 휘청 평균
console.log('\n| 무기 | 과녁 | 판 | 가장 높은 점 − 가슴 최대 (단계 — 끝난 뒤 빼고) | 도는 중(rate ≥ ½) 최대 · 어깨 위 몫 % · 칼끝 최고 m | 어깨 위 스텝 몫 (감기 · 감은 채 · 놓은 뒤 · 따라 · 굳음) | 따라 · 굳음 가장 높은 점 − 가슴 최대 | 0.6 s 안 도는 °/s 최대 평균 | 0.6 s 골반 길 평균 | 기울기 최대 평균 | 균형 걸음 몫 평균 | 넘어짐 | 상처 판 | 칼면 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const by = new Map();
for (const r of all) {
  const k = `${r.w}|${r.target}`;
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(r);
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
for (const [k, rs] of by) {
  const [w, t] = k.split('|');
  let best = -9, bph = '';
  for (const r of rs) for (const p of PH.slice(0, 5)) if (r.ph[p].n && r.ph[p].top > best) { best = r.ph[p].top; bph = p; }
  const share = PH.slice(0, 5).map((p) => { const n = rs.reduce((s, r) => s + r.ph[p].n, 0); const o = rs.reduce((s, r) => s + r.ph[p].over, 0); return n ? Math.round((100 * o) / n) : '-'; }).join(' · ');
  const F = rs.map((r) => r.fin).filter(Boolean);
  const rot = rs.filter((r) => r.ph[ROT].n);
  const rotTop = Math.max(...rot.map((r) => r.ph[ROT].top));
  const rotOver = rot.reduce((a, r) => a + r.ph[ROT].over, 0) / Math.max(1, rot.reduce((a, r) => a + r.ph[ROT].n, 0));
  const rotTip = Math.max(...rot.map((r) => r.ph[ROT].tip));
  const fsTop = Math.max(...rs.flatMap((r) => ['follow', 'stiff'].filter((p) => r.ph[p].n).map((p) => r.ph[p].top)));
  console.log(`| ${w} | ${t} | ${rs.length} | ${f2(best)} (${bph}) | ${rot.length ? `${f2(rotTop)} · ${Math.round(rotOver * 100)} · ${rotTip.toFixed(2)}` : '-'} | ${share} | ${f2(fsTop)} | ${Math.round(mean(F.map((x) => x.w)))} | ${mean(F.map((x) => x.path)).toFixed(2)} | ${Math.round(mean(F.map((x) => x.tilt)))} | ${mean(F.map((x) => x.stumble)).toFixed(2)} | ${F.filter((x) => x.fell).length} | ${rs.filter((r) => r.cuts).length} | ${rs.reduce((s, r) => s + r.flats, 0)} |`);
}
if (args.json) writeFileSync(args.json, JSON.stringify(all, null, 1));
