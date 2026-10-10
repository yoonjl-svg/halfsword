// 이베리아 비기 흐름 탐침 (10/11 — docs/strike/iberian_secret_v5_2026-10-11.md). 읽기만.
//  츠바이핸더(또는 argv[2]) AI 가 서 있는 롱소드 몸(입력 없음)에게 다가가 닿는 거리에 들면 비기를 직접 낸다(secretGo — 조건을 기다리지 않음).
//  씨앗마다 물리 스텝 기록: 칼끝 빠르기 · 칼끝 자리(몸 기준 옆 x · 높이 y) · 수 이름 · 단계. 수마다 칼끝 최고 빠르기 · 칼끝이 지난 옆 범위(좌우로 실제로 오갔나) · 이음새 칼끝 빠르기 바닥 · 맞힘.
//  WHO=player: 플레이어 몸(검술 층 skill.secret — 게임과 같은 보정·autoGuard)이 비기를 낸다. 상대 롱소드 AI 는 멈춤, 시작 거리 1.9 m. DIR=x,y = 비기를 낸 끌기 방향(기본 −1,−0.6 = 왼 아래)
//  실행: node tools/sim/hybrid.mjs iberian_flow_probe.mjs [무기 zweihander] [씨앗 수 6]
import { newRound, DT, THREE } from './harness_m.mjs';
import { SECRET, SKILL } from '../../src/config.js';
import { playerSecretOf } from '../../src/secret.js';
const WHO = process.env.WHO || 'ai';
const DIR = (process.env.DIR || '-1,-0.6').split(',').map(Number);
const id = process.argv[2] || 'zweihander';
const N = +(process.argv[3] || 6);
const _r = new THREE.Vector3();
const _f = new THREE.Vector3();
const agg = {};
let fired = 0, landed = 0, stiffN = 0;
const tot = [];
for (let seed = 1; seed <= N; seed++) {
  const PL = WHO === 'player';
  const G = PL ? newRound({ walls: false, weapon: id, weapon2: 'longsword', seed, gap: +(process.env.GAP || 1.9) }) : newRound({ walls: false, weapon: 'longsword', weapon2: id, seed });
  const me = PL ? G.player : G.enemy;
  if (PL) { G.ai.update = () => {}; me.skill.corr = SKILL.corr; me.skill.corrTip = SKILL.corrTip; me.skill.autoGuard = true; }
  const ai = PL ? { M: me.swordArt.measure, secretFree: () => !me.skill.sec, get secretRun() { const s = me.skill.sec; return s ? { stage: s.stage } : null; }, get tech() { return me.skill.sec?.cur ?? null; }, phase: '-', path: { get length() { return me.skill.sec?.path?.length ?? 0; } }, stats: { secrets: {} }, secret: playerSecretOf(me) } : G.ai;
  let run = null;
  const rec = [];
  let t0 = null;
  let woundsE = 0;
  G.onWound = (att, vic, r) => { if (att === me && t0 != null) { woundsE++; rec.push({ wound: r.energy, zone: r.zone, t: G.t - t0 }); } };
  for (let i = 0; i < 120 * 14; i++) {
    G.step();
    if (t0 == null && G.t > 2.6 && me.state === 'stand' && G.player.state === 'stand' && me.foeDistance() < ai.M.reach - 0.1 && ai.secretFree() && !ai.secretRun) {
      if (PL ? me.skill.secret({ S: ai.secret, ctx: null, dir: DIR }) : ai.secretGo(ai.secret)) { t0 = G.t; fired++; }
    }
    if (t0 != null) {
      const sr = ai.secretRun;
      const c = me.bodies.chest.translation();
      me.right(_r);
      me.forward(_f);
      const tp = me.tipPrev ?? me.bladePoint(1, new THREE.Vector3());
      const rx = tp.x - c.x, ry = tp.y - c.y, rz = tp.z - c.z;
      rec.push({ t: G.t - t0, v: me.tipVel.length(), x: me.side * (rx * _r.x + rz * _r.z), y: ry, fw: rx * _f.x + rz * _f.z, n: sr ? (sr.stage === 'stiff' ? 'stiff' : ai.tech?.name) : null, ph: ai.phase, pl: ai.path.length, hx: me.handOffset.x, hy: me.handOffset.y, ax: me.skill.aim.x, ay: me.skill.aim.y });
      if (process.env.TRACE == seed && rec.length % 4 === 1) { const q = rec[rec.length - 1]; console.log(`  t ${q.t.toFixed(3)} ${q.n} pl ${q.pl} 손 [${q.hx.toFixed(2)},${q.hy.toFixed(2)}] aim [${q.ax.toFixed(2)},${q.ay.toFixed(2)}] 칼끝 옆 ${q.x.toFixed(2)} 위 ${q.y.toFixed(2)} 앞 ${q.fw.toFixed(2)} v ${q.v.toFixed(1)}`); }
      if (sr?.stage === 'stiff' && !run) { run = 'stiff'; stiffN++; }
      if (!sr) break;
    }
  }
  if (t0 == null) { console.log(`seed ${seed}: 못 냄`); continue; }
  if (PL ? me.skill.secretStats[ai.secret.name]?.landed : ai.stats.secrets?.[ai.secret.name]?.landed) landed++;
  // 수마다
  const segs = [];
  for (const r of rec) {
    if (r.wound != null) { if (segs.length) segs[segs.length - 1].J.push(Math.round(r.wound)); continue; }
    if (!segs.length || segs[segs.length - 1].n !== r.n) segs.push({ n: r.n, t0: r.t, t1: r.t, vmax: 0, vmin: Infinity, xmin: Infinity, xmax: -Infinity, ymin: Infinity, ymax: -Infinity, J: [] });
    const s = segs[segs.length - 1];
    s.t1 = r.t;
    s.vmax = Math.max(s.vmax, r.v);
    s.vmin = Math.min(s.vmin, r.v);
    s.xmin = Math.min(s.xmin, r.x); s.xmax = Math.max(s.xmax, r.x);
    s.ymin = Math.min(s.ymin, r.y); s.ymax = Math.max(s.ymax, r.y);
  }
  const runRec = rec.filter((r) => r.n && r.n !== 'stiff' && r.v != null);
  const T = runRec.length ? runRec[runRec.length - 1].t : 0;
  tot.push(T);
  console.log(`seed ${seed}: 흐름 ${T.toFixed(2)} s · 상처 ${woundsE} · ` + segs.map((s) => `${s.n} ${(s.t1 - s.t0 + DT).toFixed(2)}s v ${s.vmax.toFixed(1)}/${s.vmin.toFixed(1)} 옆 ${s.xmin.toFixed(2)}~${s.xmax.toFixed(2)} 높이 ${s.ymin.toFixed(2)}~${s.ymax.toFixed(2)}${s.J.length ? ' J ' + s.J.join(',') : ''}`).join(' | '));
  for (const s of segs) { const A = (agg[s.n] ??= { n: 0, t: 0, v: 0, vmin: 0, xr: 0 }); A.n++; A.t += s.t1 - s.t0 + DT; A.v += s.vmax; A.vmin += s.vmin; A.xr += s.xmax - s.xmin; }
}
console.log(`\n${id} · ${WHO} · 판 ${SECRET.iberianSecret} · 낸 ${fired} · 맞힘 ${landed} · 경직 ${stiffN} · 흐름 평균 ${(tot.reduce((a, b) => a + b, 0) / Math.max(1, tot.length)).toFixed(2)} s`);
for (const [k, A] of Object.entries(agg)) console.log(`  ${k}: n ${A.n} · ${(A.t / A.n).toFixed(2)} s · 칼끝 최고 ${(A.v / A.n).toFixed(1)} · 바닥 ${(A.vmin / A.n).toFixed(1)} m/s · 칼끝 옆 폭 ${(A.xr / A.n).toFixed(2)} m`);
