// 이베리아 비기 흐름 탐침 (10/11 — docs/strike/iberian_secret_v5_2026-10-11.md). 읽기만.
//  츠바이핸더(또는 argv[2]) AI 가 서 있는 롱소드 몸(입력 없음)에게 다가가 닿는 거리에 들면 비기를 직접 낸다(secretGo — 조건을 기다리지 않음).
//  씨앗마다 물리 스텝 기록: 칼끝 빠르기 · 칼끝 자리(몸 기준 옆 x · 높이 y) · 수 이름 · 단계. 수마다 칼끝 최고 빠르기 · 칼끝이 지난 옆 범위(좌우로 실제로 오갔나) · 이음새 칼끝 빠르기 바닥 · 맞힘.
//  WHO=player: 플레이어 몸(검술 층 skill.secret — 게임과 같은 보정·autoGuard)이 비기를 낸다. 상대 롱소드 AI 는 멈춤, 시작 거리 1.9 m. DIR=x,y = 비기를 낸 끌기 방향(기본 −1,−0.6 = 왼 아래)
//  10/11 v6 길목 지키기(판 gilmok): AI 는 내기 전 ARM 초(기본 1.0) 동안 손 목표를 준비 자세(옆 자세 — ai.js 길목 준비와 같은 덮기)에 둔 뒤 낸다(ARM=0 = 덮지 않음).
//   CMP=<기술 이름>(예 zwerch): 비기 대신 그 보통 기술을 같은 자리에서 낸다(startAttack — 손 속도·힘 창·보조 힘 없음) — 칼끝 빠르기 견줌
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
if (process.env.STEPF) { const { TRADITIONS } = await import("../../src/schools.js"); TRADITIONS.iberian.secret.do.step = +process.env.STEPF ? { lat: 0, fwd: +process.env.STEPF, when: "strike" } : null; } // STEPF=m: 길목 한 칼 걸음 시험
if (process.env.CUTMID) { const { TRADITIONS } = await import("../../src/schools.js"); TRADITIONS.iberian.secret.do.cutMid = process.env.CUTMID.split(",").map(Number); } // CUTMID=x,y: 길목 한 칼 가운데 점 시험
for (let seed = 1; seed <= N; seed++) {
  const PL = WHO === 'player';
  const G = PL ? newRound({ walls: false, weapon: id, weapon2: 'longsword', seed, gap: +(process.env.GAP || 1.9) }) : newRound({ walls: false, weapon: 'longsword', weapon2: id, seed });
  const me = PL ? G.player : G.enemy;
  if (PL) { G.ai.update = () => {}; me.skill.corr = SKILL.corr; me.skill.corrTip = SKILL.corrTip; me.skill.autoGuard = true; }
  const ai = PL ? { M: me.swordArt.measure, secretFree: () => !me.skill.sec, get secretRun() { const s = me.skill.sec; return s ? { stage: s.stage } : null; }, get tech() { return me.skill.sec?.cur ?? null; }, phase: '-', path: { get length() { return me.skill.sec?.path?.length ?? 0; } }, stats: { secrets: {} }, secret: playerSecretOf(me) } : G.ai;
  let run = null;
  const rec = [];
  const GIL = !PL && ai.secret?.do?.gilmok;
  const ARM = +(process.env.ARM ?? 1.0);
  let armT = 0;
  const CMP = process.env.CMP ? ai.school.techByName[process.env.CMP] : null;
  if (GIL && ARM > 0) { const mh = ai.moveHand.bind(ai); ai.moveHand = (dt) => { if (t0 == null && armT > 0) { const p = ai.secret.do.side[1]; ai.hand.set(p[0], p[1]); ai.handSpeed = 0.9; } return mh(dt); }; const sa = ai.startAttack.bind(ai); ai.startAttack = (t, why, o) => (t0 == null && why !== 'secret' && why !== 'test' ? false : sa(t, why, o)); } // 준비 동안 AI 가 스스로 치지 않게
  let t0 = null;
  let woundsE = 0;
  G.onWound = (att, vic, r, _p, pr) => { if (att === me && t0 != null) { woundsE++; const pt = pr?.v?.part ?? ''; const pk = /thigh|shin|foot|leg/i.test(pt) ? '다리' : /arm|hand/i.test(pt) ? '팔' : /head|neck/i.test(pt) ? '머리·목' : '몸통'; (globalThis.__parts ??= {})[pk] = (globalThis.__parts[pk] ?? 0) + 1; rec.push({ wound: r.energy, zone: r.zone, t: G.t - t0 }); } };
  for (let i = 0; i < 120 * 14; i++) {
    if (process.env.WALK && !PL) G.player.move.set(0, t0 == null && armT >= ARM ? +process.env.WALK : 0); // WALK=v: 준비가 찬 뒤 상대(입력 없는 롱소드 몸)가 앞으로 걸어 든다 (스틱 v)
    G.step();
    const near = t0 == null && G.t > 2.6 && me.state === 'stand' && G.player.state === 'stand' && me.foeDistance() < (process.env.FIRE === "contact" ? ai.M.contact : ai.M.reach - 0.1) && ai.secretFree() && !ai.secretRun;
    if (t0 == null && (armT > 0 || near || (process.env.WALK && G.t > 2.6)) && GIL && ARM > 0 && armT < ARM) { armT += DT; continue; }
    if (near) {
      if (CMP) { if (ai.startAttack(CMP, 'test', { noFeint: true })) { t0 = G.t; fired++; } }
      else if (PL ? me.skill.secret({ S: ai.secret, ctx: null, dir: DIR }) : ai.secretGo(ai.secret)) { t0 = G.t; fired++; }
    }
    if (t0 != null) {
      const sr = CMP ? (ai.mode === 'attack' ? { stage: 'strike' } : null) : ai.secretRun;
      const c = me.bodies.chest.translation();
      me.right(_r);
      me.forward(_f);
      const tp = me.tipPrev ?? me.bladePoint(1, new THREE.Vector3());
      const rx = tp.x - c.x, ry = tp.y - c.y, rz = tp.z - c.z;
      rec.push({ t: G.t - t0, v: me.tipVel.length(), fd: me.foeDistance(), x: me.side * (rx * _r.x + rz * _r.z), y: ry, fw: rx * _f.x + rz * _f.z, n: sr ? (sr.stage === 'stiff' ? 'stiff' : ai.tech?.name) : null, ph: ai.phase, pl: ai.path.length, hx: me.handOffset.x, hy: me.handOffset.y, ax: me.skill.aim.x, ay: me.skill.aim.y });
      if (process.env.TRACE == seed && rec.length % 4 === 1) { const q = rec[rec.length - 1]; console.log(`  t ${q.t.toFixed(3)} ${q.n} pl ${q.pl} 손 [${q.hx.toFixed(2)},${q.hy.toFixed(2)}] aim [${q.ax.toFixed(2)},${q.ay.toFixed(2)}] 칼끝 옆 ${q.x.toFixed(2)} 위 ${q.y.toFixed(2)} 앞 ${q.fw.toFixed(2)} v ${q.v.toFixed(1)} 거리 ${me.foeDistance().toFixed(2)}`); }
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
  // 10/11 v6 2차: 칼끝이 가운데 선(옆 0)을 지날 때 — 앞 거리(가슴 기준) · 높이(가슴 기준) · 그때 상대 가슴 거리
  for (let k = 1; k < runRec.length; k++) {
    const a = runRec[k - 1], b = runRec[k];
    if (a.x * b.x <= 0 && a.x !== b.x) { (globalThis.__mid ??= []).push({ fw: b.fw, y: b.y, fd: b.fd }); console.log(`  가운데 선: 칼끝 앞 ${b.fw.toFixed(2)} m · 높이 ${b.y.toFixed(2)} m · 상대 가슴 ${b.fd.toFixed(2)} m · ${b.n}`); break; }
  }
  const T = runRec.length ? runRec[runRec.length - 1].t : 0;
  tot.push(T);
  console.log(`seed ${seed}: 흐름 ${T.toFixed(2)} s · 상처 ${woundsE} · ` + segs.map((s) => `${s.n} ${(s.t1 - s.t0 + DT).toFixed(2)}s v ${s.vmax.toFixed(1)}/${s.vmin.toFixed(1)} 옆 ${s.xmin.toFixed(2)}~${s.xmax.toFixed(2)} 높이 ${s.ymin.toFixed(2)}~${s.ymax.toFixed(2)}${s.J.length ? ' J ' + s.J.join(',') : ''}`).join(' | '));
  for (const s of segs) { const A = (agg[s.n] ??= { n: 0, t: 0, v: 0, vmin: 0, xr: 0 }); A.n++; A.t += s.t1 - s.t0 + DT; A.v += s.vmax; A.vmin += s.vmin; A.xr += s.xmax - s.xmin; }
}
console.log(`\n${id} · ${WHO} · 판 ${SECRET.iberianSecret} · 낸 ${fired} · 맞힘 ${landed} · 경직 ${stiffN} · 흐름 평균 ${(tot.reduce((a, b) => a + b, 0) / Math.max(1, tot.length)).toFixed(2)} s`);
if (globalThis.__mid?.length) { const M = globalThis.__mid; const av = (k) => (M.reduce((a, b) => a + b[k], 0) / M.length).toFixed(2); console.log(`  가운데 선 평균 (n ${M.length}): 칼끝 앞 ${av('fw')} m · 높이 ${av('y')} m (${Math.min(...M.map((m) => m.y)).toFixed(2)}~${Math.max(...M.map((m) => m.y)).toFixed(2)}) · 상대 가슴 ${av('fd')} m`); } // 10/11 v6 3차
if (globalThis.__parts) console.log(`  맞힌 자리(상처 수): ${Object.entries(globalThis.__parts).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
for (const [k, A] of Object.entries(agg)) console.log(`  ${k}: n ${A.n} · ${(A.t / A.n).toFixed(2)} s · 칼끝 최고 ${(A.v / A.n).toFixed(1)} · 바닥 ${(A.vmin / A.n).toFixed(1)} m/s · 칼끝 옆 폭 ${(A.xr / A.n).toFixed(2)} m`);
