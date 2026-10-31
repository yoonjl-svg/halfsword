// 제비 베기(일본 J9 특수 공격) 되돌림 칼 칼끝 길 재기 (사장님 10/31 14:xx '제비 베기 경로가 좀 휘어보이던데 점검해봐' · 16:xx '제비 베기는 곧은 길로 바꿔') — 재기만 · 게임 값은 갈래에서만 덮어씀
//  사람 打刀 · 상대 롱소드(멈춤 · 칼 아래 · 상처 안 걸림) · 가슴 사이 GAP · 손가락 = schielhau_strike.mjs tsubameRun 과 같은 길(지붕 → [0, 0.14] → 아래 [0, −0.5] → 곧장 위로) · 아래 칼은 상대 몸을 지나감(ghostDown)
//  끌고 가는 칼(제비 베기 강화가 켜진 스텝부터 운동학 칼이 끝나고 0.1 s)마다 칼끝 · 손(칼자루) 세계 자리 · 맞은 자리 · 손목을 적음 →
//   휨: 칼끝 길 ↔ 처음 · 끝을 잇는 곧은 줄 가장 먼 거리(m) · 그 줄 길이에 대한 몫 · 꺾임(이웃 조각 방향 바뀜 가장 큰 °) — 운동학 칼 모두(bend) · 베는 토막만(bendCut)
//   손목(끌고 가는 스텝마다 · 첫 맞음 때 — wrist_audit.mjs 잣대): 범위 밖(> 1°) · 아래팔 굴림 ≥ 78 · 날 앞장(칼날 0.7 자리 움직임과 날 cos > STRIKE.edgeAlign — 외날의 날 쪽) · 등 앞장(cos < −문턱)
//  갈래 VARIANTS (아래 표): hook(10/25 갈고리 — `?tsuHook=1`) · old(10/25 전 길 — tsuAim 0) · line(곧은 길 — 지금 기본) · 그 밖 시험 길 · 쪽 붙들기 · 띠 옮김 꼴
//  node tools/sim/tsubame_trace.mjs [--variants=hook,line,old] [--seeds=4] [--gaps=1.0,1.15,1.3] [--json=파일]  (씨앗 1 = 손가락 길 그대로 · 2 부터 점마다 ± 0.04 흔들림)
//   --sum 이면 갈래마다 묶음 한 줄(JSON) — 12 번(사이 셋 × 씨앗 넷)이 기록 표의 판
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist, strokeTechOf, TSU_AIM } from '../../src/unique_assist.js';
import { TRADITIONS } from '../../src/schools.js';
import { wristSample, outOfRange, OOR_EPS, ROLL_AT } from './wrist_audit.mjs';
import { isMain } from './is_main.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
const U = TRADITIONS.japanese.unique.find((x) => x.name === 'tsubameGaeshi');
const r3 = (x) => +x.toFixed(3);
const KEEP = { band: JSON.parse(JSON.stringify(TSU_AIM.band)), line: JSON.parse(JSON.stringify(TSU_AIM.line)), ua: { tsuAim: UA.tsuAim, tsuBand: UA.tsuBand, tsuHook: UA.tsuHook } };
const OLD = [[0.06, -0.15], [0.22, 0.26]]; // AI 길 (schools.js — 10/25 전 사람 길)
/** 갈래: ua = 스위치 · band = 갈고리 길(TSU_AIM.band) 덮음 · line = 곧은 길(TSU_AIM.line) 칸 덮음 */
export const VARIANTS = {
  hook: { ua: { tsuHook: 1 } }, // 10/25 해법 ③ 갈고리 — [0.2, −0.2] → [0, 0.1]
  old: { ua: { tsuAim: 0 } }, // 10/25 전 길 — 덧칸 · 띠 · 굴림 묶음 없음
  line: { ua: { tsuHook: 0 } }, // 곧은 길 (TSU_AIM.line 그대로)
  diag: { ua: { tsuHook: 0 }, line: { path: OLD, shift: null, side: null } }, // 10/31 점검의 'diag' — 손가락 사선 + 띠 옮김 (쪽은 스텝마다)
  diagStick: { ua: { tsuHook: 0 }, line: { path: OLD, shift: null, side: 'stick' } },
  diagPivot: { ua: { tsuHook: 0 }, line: { path: OLD, shift: 'pivot', side: null } },
  diagPivotStick: { ua: { tsuHook: 0 }, line: { path: OLD, shift: 'pivot', side: 'stick' } },
  oldRoll: { ua: { tsuHook: 0 }, line: { path: OLD, shift: 'none', side: null } }, // 전 길 + 굴림 묶음만(띠 옮김 없음)
  oldRollStick: { ua: { tsuHook: 0 }, line: { path: OLD, shift: 'none', side: 'stick' } },
};
// 그 밖 시험 길: --path='x,y;x,y' (line 칸) · --shift=all|pivot|none · --side=stick
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };

function apply(variant) {
  Object.assign(UA, KEEP.ua);
  TSU_AIM.band = JSON.parse(JSON.stringify(KEEP.band));
  TSU_AIM.line = JSON.parse(JSON.stringify(KEEP.line));
  const v = typeof variant === 'string' ? VARIANTS[variant] : variant;
  if (!v) throw new Error(`갈래 없음: ${variant}`);
  Object.assign(UA, v.ua ?? {});
  if (v.band) Object.assign(TSU_AIM.band, v.band);
  if (v.line) Object.assign(TSU_AIM.line, v.line);
}
function restore() {
  Object.assign(UA, KEEP.ua);
  TSU_AIM.band = JSON.parse(JSON.stringify(KEEP.band));
  TSU_AIM.line = JSON.parse(JSON.stringify(KEEP.line));
}

/** 맞는 순간 놓인 칼의 날 맞춤 (schielhau_strike.mjs edgeOf 와 같은 셈): 맞은 점 움직임의 칼 축 수직 몫과 날(칼 틀 +x) cos — + = 날 앞장 · − = 등 */
function edgeAt(f) {
  const v = f.hitPointVel;
  if (!v || !f.sword) return null;
  const r = f.sword.rotation();
  const q = new THREE.Quaternion(r.x, r.y, r.z, r.w);
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  const ed = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const p = v.clone().addScaledVector(ax, -v.dot(ax));
  const pl = p.length();
  return pl > 1e-3 ? r3(p.dot(ed) / pl) : null;
}

export function traceRun(variant, seed, GAP) {
  apply(variant);
  let rs = (seed * 7919 + 17) >>> 0;
  const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  const J = seed === 701 ? 0 : 0.04; // 첫 씨앗은 손가락 길 그대로 · 그 밖은 점마다 ± 0.04 패드 m 흔들림
  const G = newRound({ walls: true, seed, weapon: 'uchigatana', weapon2: 'longsword', gap: GAP + 0.3, AIClass: AI });
  const P = G.player;
  const D = G.enemy;
  G.ai.update = () => {};
  D.applyWound = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['tsubameGaeshi']) });
  const FRAME = 2 * DT;
  let fx = P.handOffset.x, fy = P.handOffset.y;
  const to = (p, vel, held) => {
    const fr = [];
    let x = fx, y = fy;
    for (let k = 0; k < 400; k++) {
      const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy);
      if (d < 1e-6) break;
      const st = Math.min(d, vel * FRAME);
      x += (dx / d) * st; y += (dy / d) * st;
      fr.push([(dx / d) * st, (dy / d) * st, held]);
    }
    fx = x; fy = y;
    return fr;
  };
  let queue = [];
  let started = false;
  const tr = { tip: [], hand: [], pad: [], wr: [], hits: [], snapT: null, endT: null, fired: false, bandDy: null, bandFrom: null };
  G.before = () => {
    if (!started && G.t > 1.2 && P.foeDistance() < GAP + 0.05) {
      started = true;
      queue = [...to(U.from, 1.6, false), ...Array(4).fill([0, 0, false])];
      for (const p of U.path) queue.push(...to([p[0] + (rnd() * 2 - 1) * J, p[1] + (rnd() * 2 - 1) * J], 4.5, true));
      queue.push(...Array(8).fill([0, 0, false]));
    }
    if ((G.stepN = (G.stepN ?? 0) + 1) % 2 === 1) {
      const f = queue.shift() ?? [0, 0, false];
      uq.feed(f[0], f[1], FRAME, false);
      if (!(uq.holdsHand ?? uq.running)) { P.handOffset.x += f[0]; P.handOffset.y += f[1]; }
      P.handHeld = f[2];
      if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) P.inputActive = true;
      if (!queue.length) { fx = P.handOffset.x; fy = P.handOffset.y; }
    }
    const dist = P.foeDistance();
    P.move.set(0, started ? 0 : dist > GAP ? 0.5 : 0);
    if (started && !tr.fired && queue.length && uq.r?.e.name !== 'tsubameGaeshi') P.instantGhost = Math.max(P.instantGhost ?? 0, 2); // 아래 칼은 빗나감 (제비 베기가 나는 조건)
  };
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === P && strokeTechOf(P) === 'tsubameGaeshi') {
      const s = wristSample(P);
      tr.hits.push({ zone: r.zone, part: rest[1]?.v?.part ?? null, type: r.type, sev: r3(r.severity ?? 0), E: r3(r.energy), t: r3(G.t - (tr.snapT ?? G.t)), kin: P.iai ? 1 : 0, roll: s ? +s.roll.toFixed(0) : null, oor: s ? +outOfRange(s).toFixed(1) : null, edge: P.iai ? undefined : edgeAt(P) }); // 운동학 칼 맞음의 날은 그 스텝 끝에 (아래 — hitPointVel 은 지난 스텝 몫)
    }
  };
  const v = new THREE.Vector3();
  const h = new THREE.Vector3();
  const q = new THREE.Quaternion();
  let p7 = null;
  try {
    while (G.t < 6) {
      G.step();
      const on = uq.r?.e.name === 'tsubameGaeshi';
      if (on && tr.snapT == null) {
        tr.snapT = G.t;
        tr.bandDy = P.iai?.bandDy ?? null;
        tr.bandFrom = P.iai ? `${P.iai.bandFrom ?? '-'}>${P.iai.bandTo ?? '-'}` : null;
      }
      if (on) tr.fired = true;
      if (tr.snapT != null && tr.endT == null && !on && !P.iai) tr.endT = G.t;
      // 칼날 0.7 자리 움직임과 날(칼 틀 +x — 외날의 날 쪽) cos (부호 있음 · + = 날 앞장)
      const b7 = P.bladePoint(0.7, new THREE.Vector3());
      let ec = null;
      if (p7 && P.sword) {
        const r = P.sword.rotation();
        q.set(r.x, r.y, r.z, r.w);
        const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const ed = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
        const mv = b7.clone().sub(p7);
        mv.addScaledVector(ax, -mv.dot(ax));
        if (mv.length() > 1e-3) ec = mv.dot(ed) / mv.length();
      }
      p7 = b7;
      tr.edgeNow = ec == null ? null : r3(ec);
      for (const hh of tr.hits) if (hh.edge === undefined) hh.edge = tr.edgeNow; // 이 스텝에 난 운동학 칼 맞음 = 이 스텝 칼날 움직임 · 놓인 날
      if (tr.snapT != null && (tr.endT == null || G.t - tr.endT < 0.1)) {
        // 세계 → 내 몸 기준 (x = 상대 쪽 · y = 위 · z = 칼 든 쪽 옆) — 판마다 같은 틀
        const c = P.bodies.chest.translation();
        const yaw = P.heading ?? 0;
        const loc = (p) => { const dx = p.x - c.x, dz = p.z - c.z; return [r3(dx * Math.cos(yaw) - dz * Math.sin(yaw)), r3(p.y), r3(dx * Math.sin(yaw) + dz * Math.cos(yaw))]; };
        const cut = P.iai?.kind === 'combo' ? (P.iai.cutting ? 1 : 0) : 0;
        tr.tip.push([r3(G.t - tr.snapT), ...loc(P.bladePoint(1, v)), P.iai ? 1 : 0, cut]);
        tr.hand.push([r3(G.t - tr.snapT), ...loc(P.bladePoint(0, h))]);
        tr.pad.push([r3(G.t - tr.snapT), r3(P.handOffset.x), r3(P.handOffset.y)]);
        const s = wristSample(P);
        tr.wr.push(s ? [r3(G.t - tr.snapT), P.iai ? 1 : 0, +s.roll.toFixed(1), +outOfRange(s).toFixed(1), +(P.wristFixDeg ?? 0).toFixed(1), tr.edgeNow] : null);
      }
      if (tr.endT != null && G.t - tr.endT > 0.12) break;
    }
  } finally {
    G.world.free();
    restore();
  }
  return tr;
}

/** 휨 재기: 칼끝 길 T(점 [t, x, y, z, …])의 곧은 줄 대비 가장 먼 거리 · 몫 · 이웃 조각 꺾임 */
export function bendOf(T) {
  if (T.length < 3) return null;
  const a = T[0].slice(1, 4), b = T[T.length - 1].slice(1, 4);
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const L = Math.hypot(...ab);
  if (L < 1e-6) return null;
  let dev = 0, devAt = 0;
  for (const p of T) {
    const ap = [p[1] - a[0], p[2] - a[1], p[3] - a[2]];
    const t = (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / (L * L);
    const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
    const d = Math.hypot(p[1] - q[0], p[2] - q[1], p[3] - q[2]);
    if (d > dev) { dev = d; devAt = p[0]; }
  }
  let kink = 0, len = 0;
  for (let i = 2; i < T.length; i++) {
    const u = [T[i - 1][1] - T[i - 2][1], T[i - 1][2] - T[i - 2][2], T[i - 1][3] - T[i - 2][3]];
    const w = [T[i][1] - T[i - 1][1], T[i][2] - T[i - 1][2], T[i][3] - T[i - 1][3]];
    const nu = Math.hypot(...u), nw = Math.hypot(...w);
    len += nw;
    if (nu > 0.01 && nw > 0.01) kink = Math.max(kink, (Math.acos(Math.max(-1, Math.min(1, (u[0] * w[0] + u[1] * w[1] + u[2] * w[2]) / (nu * nw)))) * 180) / Math.PI);
  }
  return { chord: r3(L), dev: r3(dev), devShare: r3(dev / L), devAt, kinkDeg: +kink.toFixed(1), pathLen: r3(len), steps: T.length, dur: r3(T[T.length - 1][0] - T[0][0]) };
}
/** 운동학 칼이 끄는 동안(iai 1) 칼끝 길 · 베는 토막만 */
export const bend = (tr) => bendOf(tr.tip.filter((p) => p[4]));
export const bendCut = (tr) => bendOf(tr.tip.filter((p) => p[4] && p[5]));

const p50 = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)]; };
const LEGS = new Set(['thighF', 'thighB', 'shinF', 'shinB', 'footF', 'footB']);
/** 갈래 묶음: 맞음 / 판 · 첫 맞음 부위 · 휨 p50 · 가장 큼 · 끌고 가는 스텝 손목(범위 밖 · 굴림 ≥ 78 · 날 앞장 · 등 앞장 %) · 첫 맞음 손목 · 심각도 */
export function traceSummary(runs) {
  const n = runs.length;
  const F = runs.filter((r) => r.fired);
  const first = runs.map((r) => r.hits[0]).filter(Boolean);
  const parts = {};
  for (const hh of first) parts[hh.part ?? hh.zone] = (parts[hh.part ?? hh.zone] ?? 0) + 1;
  const B = F.map((r) => r.bend).filter(Boolean);
  const C = F.map((r) => r.bendCut).filter(Boolean);
  const W = F.flatMap((r) => r.wr.filter((w) => w && w[1]));
  const WF = F.flatMap((r) => r.wr.filter((w) => w && !w[1] && w[0] > 0));
  const FH = runs.flatMap((r) => r.hits.filter((hh) => !hh.kin));
  const pc = (k) => (W.length ? +((100 * k) / W.length).toFixed(0) : null);
  const k = CONFIG.STRIKE.edgeAlign;
  const E = W.map((w) => w[5]).filter((x) => x != null);
  const pe = (f) => (E.length ? +((100 * E.filter(f).length) / E.length).toFixed(0) : null);
  const mx = (a) => (a.length ? Math.max(...a) : null);
  const f2 = (x) => (x == null ? null : +x.toFixed(2));
  return {
    runs: n,
    fired: F.length,
    hits: first.length,
    legs: first.filter((hh) => LEGS.has(hh.part)).length,
    parts,
    dev: f2(p50(B.map((b) => b.dev))), devShare: f2(p50(B.map((b) => b.devShare))), devShareMax: f2(mx(B.map((b) => b.devShare))),
    kink: p50(B.map((b) => b.kinkDeg)), kinkMax: mx(B.map((b) => b.kinkDeg)),
    cutDevShare: f2(p50(C.map((b) => b.devShare))), cutKink: p50(C.map((b) => b.kinkDeg)), cutKinkMax: mx(C.map((b) => b.kinkDeg)),
    kinSteps: W.length, oorStep: pc(W.filter((w) => w[3] > OOR_EPS).length), roll78Step: pc(W.filter((w) => w[2] >= ROLL_AT).length), rollStepP50: p50(W.map((w) => w[2])), rollStepMax: mx(W.map((w) => w[2])),
    edgeLead: pe((x) => x > k), backLead: pe((x) => x < -k),
    hitRoll: p50(first.map((hh) => hh.roll).filter((x) => x != null)), hitOor: first.filter((hh) => hh.oor > OOR_EPS).length, hitRoll78: first.filter((hh) => hh.roll >= ROLL_AT).length,
    hitEdge: first.filter((hh) => hh.edge != null && hh.edge > k).length, hitBack: first.filter((hh) => hh.edge != null && hh.edge < -k).length,
    sevPerRun: +(first.reduce((a, hh) => a + hh.sev, 0) / n).toFixed(3), E: f2(p50(first.map((hh) => hh.E))),
    shifted: F.filter((r) => r.bandDy).length,
    // 끌고 간 칼이 끝난 뒤 0.1 s 손가락 몫 (덧칸 planStep): 범위 밖 · 굴림 ≥ 78 스텝 % · 손가락 맞음(뒤 맞음 — 날 · 등)
    fSteps: WF.length, fOorStep: WF.length ? +((100 * WF.filter((w) => w[3] > OOR_EPS).length) / WF.length).toFixed(0) : null, fRoll78Step: WF.length ? +((100 * WF.filter((w) => w[2] >= ROLL_AT).length) / WF.length).toFixed(0) : null,
    fHits: FH.length, fHitOor: FH.filter((hh) => hh.oor > OOR_EPS).length, fHitBack: FH.filter((hh) => hh.edge != null && hh.edge < -k).length,
  };
}

if (isMain(import.meta.url)) {
  const SEEDS = +arg('seeds', 4);
  const GAPS = arg('gaps', '1.0,1.15,1.3').split(',').map(Number);
  const names = arg('variants', 'hook,line,old').split(',');
  if (arg('path')) VARIANTS.custom = { ua: { tsuHook: 0 }, line: { path: arg('path').split(';').map((p) => p.split(',').map(Number)), shift: arg('shift', null), side: arg('side', null) } };
  const out = { gaps: GAPS, runs: [], sum: {} };
  for (const variant of names) {
    const runs = [];
    for (const gap of GAPS) for (let s = 1; s <= SEEDS; s++) {
      const tr = traceRun(variant, 700 + s, gap);
      const row = { variant, seed: 700 + s, gap, fired: tr.fired, bend: bend(tr), bendCut: bendCut(tr), hits: tr.hits, bandDy: tr.bandDy, bandFrom: tr.bandFrom, tip: tr.tip, hand: tr.hand, pad: tr.pad, wr: tr.wr };
      runs.push(row);
      out.runs.push(row);
      if (!process.argv.includes('--sum')) console.log(variant, gap, 700 + s, JSON.stringify({ fired: tr.fired, bend: row.bend && { dev: row.bend.dev, devShare: row.bend.devShare, kinkDeg: row.bend.kinkDeg, dur: row.bend.dur }, cut: row.bendCut && { devShare: row.bendCut.devShare, kinkDeg: row.bendCut.kinkDeg }, dy: tr.bandDy, hits: tr.hits.map((x) => `${x.part ?? x.zone}@${x.t}${x.kin ? '' : '(f)'} r${x.roll} e${x.edge}`) }));
    }
    out.sum[variant] = traceSummary(runs);
    console.log('SUM', variant, JSON.stringify(out.sum[variant]));
  }
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify(out));
}
