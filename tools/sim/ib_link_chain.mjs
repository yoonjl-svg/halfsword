// ─────────────────────────────────────────────────────────────
//  ib_link_chain.mjs — 이어 돌리기(B7 넘기기 판) 사슬 칼 개입 재기 (11/15 사장님 "혹시 이어돌리기 동작이 그 다음 두 번째나 세 번째로 이어지는 칼의 궤적에 개입하는 면이 있는지
//   한 번 더 꼼꼼히 검토해. 몇번째 칼이든 그은 그대로 칼이 나가야 하고 이어돌리기는 그 사이의 힌지일 뿐이야." — 기록 docs/strike/ib_link_2026-11-15.md).
//  허공 · 사람 손가락 봇(main.js 와 같은 차례: 손가락 몫 → uq.feed → 손 목표에 더함): 첫 칼은 시작 자리에서 긋고 · 둘째 칼부터는 gap 실제 초 쉬고 그 칼 '방향만' 긋기(시작 자리로 가지 않음).
//   사슬의 둘째 · 셋째 · 넷째 칼마다 — 그 칼이 실제로 나간 것(넘기기 뒤 손 목표 · 칼끝)을 같은 손가락 긋기를 '그 시작 자리에 손을 두고 새로' 그은 것과 견줌:
//   손 목표: 그은 몫과 시간 맞춘 가장 큰 어긋남 · 끝 어긋남(섞임 · 잘림) · 꼴 어긋남(하우스도르프) · 빠르기 배율 · 받아 둔 시간(손가락 첫머리 → 다시 긋기 시작)
//   칼끝(몸 틀): 시작 칼날 각 · 첫 0.1 s 방향 각 · 시간 맞춘 가장 큰 어긋남 · 꼴 어긋남 · 가장 빠름 배율 · 읽힌 칼 이름(새로 그은 것과 같나) · 넘기기가 고른 칼(그은 칼과 같나)
//  node tools/sim/ib_link_chain.mjs table [--ws=zweihander,flamberge,tizona] [--len=2,3,4] [--gaps=0,0.1] [--v=5.5] [--json=…] [--set=…]
//  node tools/sim/ib_link_chain.mjs one --seq=zornhau,zwerchL,zornhau [--ws=…] [--gap=0.1] [--json=…]   (한 벌 · 스텝 줄 — 그림)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE, toBody } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { isMain } from './is_main.mjs';
import { applySets } from './ib_link.mjs';

const { SKILL } = CONFIG;
const K = CONFIG.TIME.k;
const FRAME = 1 / 60; // 실제 s
const SPF = Math.max(1, Math.round((FRAME * K) / DT));
const STEP = DT / K; // 물리 한 스텝 = 실제 s
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export const BIG = ['zornhau', 'zornhauL', 'oberhau', 'zwerch', 'zwerchL'];

function line(from, to, v) {
  const out = [];
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.round(d / v / FRAME));
  for (let i = 0; i < n; i++) out.push([(to[0] - from[0]) / n, (to[1] - from[1]) / n]);
  return out;
}
/** 기술 길의 옮김만 (지금 손 자리에서 — 시작 자리로 가지 않음) */
export function swipeOf(name, v) {
  const t = TECH_BY_NAME[name];
  const pts = [t.from, ...t.path];
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(...line(pts[i], pts[i + 1], v));
  return out;
}

function rig(ws, seed, dist = 6) {
  const kit = kitFromNodes('iberian', allNodeIds('iberian'));
  const G = newRound({ walls: false, weapon: ws, weapon2: 'longsword', seed, gap: dist, kit });
  const P = G.player;
  const E = G.enemy;
  P.skill.level = 0.7;
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
  P.humanInput = true;
  for (const x of [P, E]) x.die = () => {};
  G.ai.update = () => E.move.set(0, 0);
  const uq = new PlayerUniqueAssist(P, { names: kit.unique });
  return { G, P, E, uq };
}

const _tip = new THREE.Vector3();
const _b0 = new THREE.Vector3();
/** 한 스텝 기록: 손 목표(패드) · 칼끝(몸 틀 m) · 칼날 방향(몸 틀) · 칼끝 빠르기(실제 m/s — 월드) */
function snap(P, prevTip) {
  P.bladePoint(1, _tip);
  P.bladePoint(0, _b0);
  const tipB = toBody(P, _tip);
  const dirB = _tip.clone().sub(_b0).normalize().applyQuaternion(P.yaw.clone().invert());
  const v = prevTip ? _tip.distanceTo(prevTip) / STEP : 0;
  const hdB = toBody(P, _b0);
  return { h: [P.handOffset.x, P.handOffset.y], tip: [tipB.x, tipB.y, tipB.z], hd: [hdB.x, hdB.y, hdB.z], bd: [dirB.x, dirB.y, dirB.z], v, w: _tip.clone() };
}

/**
 * 사슬 한 벌: seq = 칼 이름 줄(첫 칼은 시작 자리에서 · 둘째부터 방향만) · gap = 손가락을 뗀 뒤 다음 칼까지(실제 s) · v = 손가락 빠르기(패드/실제 s).
 *  돌려줌 { rec(스텝마다), strokes(둘째부터 — 손가락 첫 스텝 · 몫), links(넘기기 — 시작 · 끝 스텝 · 고른 칼 · 그만둠), curs(읽힌 긋기) }
 */
export function chainRun({ ws = 'zweihander', seq = ['zornhau', 'zwerchL'], gap = 0.1, v = 5.5, seed = 1, dist = 6 } = {}) {
  const { G, P, E, uq } = rig(ws, seed, dist);
  const hits = []; // 과녁(상대 — AI 끔 · 안 죽음)에 든 맞음 (dist 가 가까울 때 — ib_link_speed.mjs)
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === P && vic === E) hits.push({ s: step, energy: r.energy, type: r.type, sev: r.type === 'blunt' ? 0 : r.severity ?? 0 });
  };
  const q = [];
  const A = TECH_BY_NAME[seq[0]];
  for (let i = 0; i < Math.round(0.6 / FRAME); i++) q.push([0, 0]);
  q.push(...line([P.handOffset.x, P.handOffset.y], A.from, 1.0));
  for (let i = 0; i < 18; i++) q.push([0, 0]);
  q.push(...swipeOf(seq[0], v));
  const strokes = [];
  for (let k = 1; k < seq.length; k++) {
    for (let i = 0; i < Math.round(gap / FRAME); i++) q.push([0, 0]);
    const d = swipeOf(seq[k], v);
    strokes.push({ k, name: seq[k], f0: q.length, d });
    q.push(...d);
  }
  for (let i = 0; i < Math.round(1.6 / FRAME); i++) q.push([0, 0]);
  const nF = q.length;
  const frameStep = []; // 프레임 i 의 몫이 손 목표에 든 스텝
  const rec = [];
  const links = [];
  const curs = [];
  let frame = 0;
  let k = 0;
  let step = 0;
  let link = null;
  let seen = null;
  let prevTip = null;
  const cancel0 = () => JSON.stringify(uq.stats.link?.cancel ?? {});
  let plainN = 0;
  const plains = [];
  G.before = () => {
    if (k++ % SPF === 0) {
      const d = q[frame] ?? [0, 0];
      uq.feed(d[0], d[1], FRAME, false);
      P.handOffset.x += d[0];
      P.handOffset.y += d[1];
      P.handHeld = frame < nF - 1;
      P.inputActive = Math.abs(d[0]) + Math.abs(d[1]) > 1e-5;
      frameStep[frame] = step + 1;
      frame++;
    }
    P.move.set(0, 0);
    P.stickX = P.stickY = 0;
  };
  let tail = 0; // 손가락 몫이 다 든 뒤 · 지연 줄 · 넘기기가 다 끝나고도 0.5 s 더 (받아 둔 칼이 늦게 나감 — 한도 4 s)
  try {
    while (frame < nF || (tail < 0.5 / STEP && frame < nF + Math.round(4 / FRAME))) {
      if (frame >= nF) tail = uq.link || P.ibLink ? 0 : tail + 1;
      G.step();
      step++;
      const s = snap(P, prevTip);
      prevTip = s.w;
      delete s.w;
      s.ph = P.ibLink ? 'link' : uq.link?.phase ?? '';
      s.ex = P.stamina?.value ?? null;
      rec[step] = s;
      if (P.ibLink && !link) link = { s: step, tech: P.ibLink.tech, to: P.ibLink.to?.slice(), c0: cancel0(), T: P.ibLink.T };
      if (link && !P.ibLink) {
        link.e = step;
        const c1 = cancel0();
        link.cancel = c1 !== link.c0 ? c1 : null;
        link.after = uq.link?.phase ?? null;
        links.push(link);
        link = null;
      }
      if (uq.cur && uq.cur !== seen) {
        seen = uq.cur;
        curs.push({ s: step, tech: uq.cur.tech, kind: uq.cur.kind, start: uq.cur.start?.slice(), dir: uq.cur.dir?.slice(), link: uq.cur.link ?? null });
      }
      const np = uq.stats.link?.plain ?? 0; // 지연 줄 안 넘기지 않은 긋기가 나감 (11/15 (2) — 그 판에만 있음)
      if (np > plainN) (plainN = np), plains.push(step);
    }
  } finally {
    G.world.free();
  }
  for (const st of strokes) st.s0 = frameStep[st.f0];
  return { ws, seq, gap, v, rec, strokes, links, curs, hits, plains, stats: uq.stats.link ?? null, boost: P.ibBoostLog ?? null, stamina: P.stamina?.value ?? null };
}

/** 새로 그음: 손을 start(패드)에 두고 칼이 가라앉은 뒤 같은 손가락 몫 d 를 같은 프레임 박자로. 돌려줌 { rec(첫 몫 앞 스텝 = 0 부터), tech } */
const freshCache = new Map();
export function freshRun({ ws, start, d, v = 5.5, seed = 1, key = null }) {
  const ck = key && `${ws}|${key}|${start.map((x) => x.toFixed(3))}`;
  if (ck && freshCache.has(ck)) return freshCache.get(ck);
  const { G, P, uq } = rig(ws, seed);
  const q = [];
  for (let i = 0; i < Math.round(0.6 / FRAME); i++) q.push([0, 0]);
  q.push(...line([P.handOffset.x, P.handOffset.y], start, 1.0));
  for (let i = 0; i < Math.round(0.8 / FRAME); i++) q.push([0, 0]);
  const f0 = q.length;
  q.push(...d);
  for (let i = 0; i < Math.round(0.8 / FRAME); i++) q.push([0, 0]);
  let frame = 0;
  let k = 0;
  let step = 0;
  let s0 = null;
  const rec = [];
  let prevTip = null;
  let seen = null;
  const curs = [];
  G.before = () => {
    if (k++ % SPF === 0) {
      const dd = q[frame] ?? [0, 0];
      uq.feed(dd[0], dd[1], FRAME, false);
      P.handOffset.x += dd[0];
      P.handOffset.y += dd[1];
      P.handHeld = frame < q.length - 1;
      P.inputActive = Math.abs(dd[0]) + Math.abs(dd[1]) > 1e-5;
      if (frame === f0) s0 = step + 1;
      frame++;
    }
    P.move.set(0, 0);
    P.stickX = P.stickY = 0;
  };
  try {
    while (frame < q.length) {
      G.step();
      step++;
      const s = snap(P, prevTip);
      prevTip = s.w;
      delete s.w;
      rec[step] = s;
      if (uq.cur && uq.cur !== seen) {
        seen = uq.cur;
        curs.push({ s: step, tech: uq.cur.tech, kind: uq.cur.kind });
      }
    }
  } finally {
    G.world.free();
  }
  const o = s0 - 1;
  const out = { rec: rec.slice(o), tech: curs.find((c) => c.s >= s0)?.tech ?? null, kind: curs.find((c) => c.s >= s0)?.kind ?? null, start };
  if (ck) freshCache.set(ck, out);
  return out;
}

const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const n2 = (a) => Math.hypot(a[0], a[1]);
const n3 = (a) => Math.hypot(a[0], a[1], a[2]);
const ang3 = (a, b) => {
  const na = n3(a);
  const nb = n3(b);
  if (na < 1e-9 || nb < 1e-9) return null;
  return (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (na * nb)))) * 180) / Math.PI;
};
function segDist(p, a, b) {
  const ab = a.map((x, i) => b[i] - x);
  const L2 = ab.reduce((s, x) => s + x * x, 0);
  const t = L2 < 1e-12 ? 0 : Math.max(0, Math.min(1, ab.reduce((s, x, i) => s + x * (p[i] - a[i]), 0) / L2));
  return Math.hypot(...p.map((x, i) => x - (a[i] + t * ab[i])));
}
const polyDist = (p, P) => (P.length < 2 ? Math.hypot(...p.map((x, i) => x - P[0][i])) : Math.min(...P.slice(1).map((b, i) => segDist(p, P[i], b))));
/** 꼴 어긋남 (두 길의 하우스도르프 — 시간과 상관없이 길끼리 가장 먼 곳) */
const haus = (A, B) => Math.max(...A.map((p) => polyDist(p, B)), ...B.map((p) => polyDist(p, A)));

/**
 * 사슬 한 벌 재기: 둘째 칼부터 칼마다 넘기기 · 다시 그은 칼 · 새로 그은 칼 견줌 (위 머리말). 받은 칼 하나가 결함인가(bad) — 손 목표가 그은 것과 다르거나(시간 맞춘 1 cm · 끝 1 cm 넘음) · 읽힌 칼 이름이 새로 그은 것과 다르거나 ·
 *  넘기기가 그은 칼이 아닌 칼 시작 자리로 감
 */
export function chainOne(o0) {
  const o = { ws: 'zweihander', gap: 0.1, v: 5.5, seed: 1, ...o0 };
  const R = chainRun(o);
  const used = new Set();
  const usedP = new Set();
  const out = [];
  for (let i = 0; i < R.strokes.length; i++) {
    const st = R.strokes[i];
    const nx = R.strokes[i + 1];
    const nd = st.d.length; // 프레임 수
    const dur = nd * SPF; // 스텝
    // 이 칼의 넘기기: 손가락 첫머리 뒤 · 그은 칼과 같은 칼을 고른 것 먼저 · 없으면 다음 칼 첫머리 앞에 든 아무 넘기기
    let L = R.links.find((l, j) => !used.has(j) && l.s >= st.s0 - 2 && l.tech === st.name);
    if (!L) L = R.links.find((l, j) => !used.has(j) && l.s >= st.s0 - 2 && (!nx || l.s < nx.s0));
    if (L) used.add(R.links.indexOf(L));
    const row = { k: st.k + 1, name: st.name, link: L ? L.tech : null, cancel: L?.cancel ?? null };
    // 다시 긋기 시작 스텝 (넘기기가 끝나고 받아 둔 긋기를 다시 그음) · 넘기기가 없으면 손가락 첫머리 그대로 · 11/15 (2) 지연 줄 안에서 넘기지 않고 나간 긋기면 그 스텝
    let t0 = st.s0 - 1;
    const pl = !L ? R.plains.find((p, j) => !usedP.has(j) && p >= st.s0 - 2 && (!nx || true)) : undefined;
    if (pl != null) (t0 = pl - 1), usedP.add(R.plains.indexOf(pl));
    if (L) {
      t0 = L.e;
      while (t0 < R.rec.length - 1 && R.rec[t0].ph === 'link') t0++;
    }
    row.hold = r3((t0 + 1 - st.s0) * STEP); // 받아 둔 시간 (실제 s)
    const h0 = R.rec[t0].h;
    // 그은 몫 (시간 맞춤): 몫 j 는 스텝 1 + j·SPF 에
    const drawn = [[0, 0]];
    let cx = 0;
    let cy = 0;
    for (let s = 1; s <= dur + 2 * SPF; s++) {
      const j = (s - 1) / SPF;
      if (Number.isInteger(j) && j < nd) (cx += st.d[j][0]), (cy += st.d[j][1]);
      drawn.push([cx, cy]);
    }
    const exe = [];
    for (let s = 0; s <= dur + 2 * SPF && t0 + s < R.rec.length; s++) exe.push(sub2(R.rec[t0 + s].h, h0));
    const R0 = CONFIG.WEAPON.reach;
    // 그은 몫을 그 자리에서 손 목표 반지름으로 자른 길 (새로 그은 것도 그렇게 잘림 — skill.js)
    const clipped = drawn.map((p) => {
      const a = [h0[0] + p[0], h0[1] + p[1]];
      const n = n2(a);
      return n > R0 ? sub2([(a[0] * R0) / n, (a[1] * R0) / n], h0) : p;
    });
    let hErr = 0;
    for (let s = 0; s < exe.length && s <= 1 + (nd - 1) * SPF; s++) hErr = Math.max(hErr, n2(sub2(exe[s], clipped[s])));
    const endS = Math.min(exe.length - 1, 1 + (nd - 1) * SPF); // 마지막 몫이 든 스텝 (그 뒤는 다음 넘기기 몫일 수 있음)
    row.hErr = r3(hErr);
    row.hEnd = r3(n2(sub2(exe[endS], clipped[Math.min(endS, clipped.length - 1)])));
    row.hShape = r3(haus(exe.slice(0, endS + 1), clipped.slice(0, endS + 1)));
    let le = 0;
    let ld = 0;
    for (let s = 1; s <= dur && s < exe.length; s++) (le += n2(sub2(exe[s], exe[s - 1]))), (ld += n2(sub2(clipped[s], clipped[s - 1])));
    row.hSpeed = ld > 1e-6 ? r3(le / ld) : null; // 그은 시간 동안 손 목표가 간 길 ÷ 그은 길 (1 = 같은 빠르기)
    // 새로 그음 (손을 h0 에 두고)
    const F = freshRun({ ws: o.ws, start: h0, d: st.d, v: o.v, seed: o.seed ?? 1, key: `${st.name}|${o.v}` });
    const W = dur + Math.round(0.1 / STEP);
    const tc = [];
    const tf = [];
    let pc = 0;
    let pf = 0;
    let tMax = 0;
    for (let s = 0; s <= W && t0 + s < R.rec.length && s < F.rec.length; s++) {
      const a = R.rec[t0 + s];
      const b = F.rec[s];
      tc.push(a.tip);
      tf.push(b.tip);
      tMax = Math.max(tMax, n3(sub3(a.tip, b.tip)));
      if (s > 0) (pc = Math.max(pc, a.v)), (pf = Math.max(pf, b.v));
    }
    row.blade0 = r3(ang3(R.rec[t0].bd, F.rec[0].bd));
    const j1 = Math.min(tc.length - 1, Math.round(0.1 / STEP));
    row.tipDir = r3(ang3(sub3(tc[j1], tc[0]), sub3(tf[j1], tf[0])));
    row.tipMax = r3(tMax);
    row.tipShape = r3(haus(tc, tf));
    // 덮음 (새로 그은 칼끝 길의 점마다 사슬 칼끝 길까지 가장 먼 곳 — 그은 호를 다 지났나) · 덧 (사슬 칼끝 길 점마다 새로 그은 길까지 — 더 간 몫: 남은 들기 · 앞 넘기기 기세)
    const Wc = dur + Math.round(0.2 / STEP);
    const tc2 = [];
    for (let s = 0; s <= Wc && t0 + s < R.rec.length; s++) tc2.push(R.rec[t0 + s].tip);
    row.tipCover = r3(Math.max(...tf.map((p) => polyDist(p, tc2))));
    row.tipExtra = r3(Math.max(...tc.map((p) => polyDist(p, tf))));
    row.peakC = r3(pc);
    row.peakF = r3(pf);
    row.peakK = pf > 0 ? r3(pc / pf) : null;
    const cur = R.curs.find((c) => c.s >= t0 - 1 && c.s <= t0 + dur && !c.link);
    row.exe = cur ? cur.tech ?? '-' : null;
    row.fresh = F.tech ?? '-';
    row.reread = row.exe !== row.fresh;
    row.wrongLink = !!L && L.tech !== st.name;
    row.noLink = !L;
    // 쉼 없이(gap 0) 앞 칼에서 꺾인 각이 꺾임 문턱(UNIQUE_ASSIST.turnDeg) 안이면 손가락은 긋기 하나를 그은 것 (새 긋기가 아님 — 어느 판이든 다음 칼로 안 읽힘: 결함 셈에서 뺌)
    const pd = i === 0 ? swipeOf(o.seq[0], o.v).at(-1) : R.strokes[i - 1].d.at(-1);
    const ta = (Math.acos(Math.max(-1, Math.min(1, (pd[0] * st.d[0][0] + pd[1] * st.d[0][1]) / (n2(pd) * n2(st.d[0]) || 1)))) * 180) / Math.PI;
    row.merged = o.gap === 0 && ta <= CONFIG.UNIQUE_ASSIST.turnDeg && !L && pl == null; // (게임이 새 긋기로 갈랐으면 셈에 넣음)
    row.plain = pl != null; // 지연 줄 안에서 넘기지 않고 나간 긋기
    // 넘기기가 손댄 칼(넘김 · 지연 줄)만 결함을 셈 — 넘기기가 안 낀 칼(손가락 그대로)은 이 스킬이 없을 때와 같음 · 넘기기 빠짐 = 큰 칼을 그 시작 자리에서 패드 반지름 넘게 떨어져 그었는데 넘기기가 없음
    const T = TECH_BY_NAME[st.name];
    row.missed = !L && !row.plain && n2(sub2(h0, T.from)) > CONFIG.UNIQUE_ASSIST.padRadius;
    row.bad = !row.merged && (((!!L || row.plain) && (row.hErr > 0.01 || row.hEnd > 0.01 || row.reread || row.wrongLink)) || row.missed);
    row.t0 = t0;
    row.h0 = h0.map(r3);
    out.push(row);
  }
  return { ws: o.ws, seq: o.seq, gap: o.gap, v: o.v, cuts: out, R, stats: R.stats };
}

/** 사슬 줄 고르기: 둘 = 큰 칼 다섯 × 다섯 · 셋 · 넷 = 둘째 칼 다음을 정해진 차례로 (스물다섯 벌씩) */
export function seqs(len) {
  const out = [];
  for (let a = 0; a < 5; a++)
    for (let b = 0; b < 5; b++) {
      const s = [BIG[a], BIG[b]];
      if (len >= 3) s.push(BIG[(a + 2 * b + 1) % 5]);
      if (len >= 4) s.push(BIG[(3 * a + b + 2) % 5]);
      out.push(s);
    }
  return out;
}

/** 표 (table · render — 무기 · 사슬 · 몇째 칼마다): gap 0 에서 앞 칼과 꺾인 각이 꺾임 문턱 안인 칼(손가락 긋기 하나)은 뺌 */
export function tableOf(all0) {
  const all = all0.filter((c) => !c.merged);
  const groups = new Map();
  for (const c of all) {
    const key = `${c.ws}|${c.len}|${c.k}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const mx = (a, f) => r3(Math.max(...a.map(f).filter((x) => x != null)));
  const av = (a, f) => {
    const b = a.map(f).filter((x) => x != null);
    return r3(b.reduce((s, x) => s + x, 0) / Math.max(1, b.length));
  };
  const lines = [`(gap 0 에서 앞 칼과 꺾인 각이 ${CONFIG.UNIQUE_ASSIST.turnDeg}° 안 — 손가락 긋기 하나 — ${all0.length - all.length} 칼은 뺌)`, '', '| 무기 | 사슬 | 몇째 칼 | 수 | 결함 | 손 목표 어긋남 평균 · 가장 큼 (패드 m) | 끝 어긋남 가장 큼 | 꼴 어긋남 가장 큼 | 손 빠르기 배율 평균 (가장 큼) | 받아 둔 시간 평균 s | 시작 칼날 각 평균 ° | 칼끝 첫 방향 각 평균 ° | 칼끝 꼴 어긋남 평균 · 가장 큼 m | 그은 호 덮음 평균 · 가장 큼 m | 칼끝 가장 빠름 배율 평균 | 이름 다름 | 엉뚱한 넘기기 | 넘기기 없음 (빠짐) |', '|---|---:|---:|---:|---:|---|---:|---:|---|---:|---:|---:|---|---|---:|---:|---:|---|'];
  for (const [key, a] of groups) {
    const [ws, len, k] = key.split('|');
    lines.push(`| ${ws} | ${len} | ${k} | ${a.length} | ${a.filter((c) => c.bad).length} | ${av(a, (c) => c.hErr)} · ${mx(a, (c) => c.hErr)} | ${mx(a, (c) => c.hEnd)} | ${mx(a, (c) => c.hShape)} | ${av(a, (c) => c.hSpeed)} (${mx(a, (c) => c.hSpeed)}) | ${av(a, (c) => c.hold)} | ${av(a, (c) => c.blade0)} | ${av(a, (c) => c.tipDir)} | ${av(a, (c) => c.tipShape)} · ${mx(a, (c) => c.tipShape)} | ${av(a, (c) => c.tipCover)} · ${mx(a, (c) => c.tipCover)} | ${av(a, (c) => c.peakK)} | ${a.filter((c) => c.reread && (c.link || c.plain)).length} | ${a.filter((c) => c.wrongLink).length} | ${a.filter((c) => c.noLink && !c.plain).length} (${a.filter((c) => c.missed).length}) |`);
  }
  lines.push('', `결함 ${all.filter((c) => c.bad).length} / ${all.length}`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => {
    const a = rest.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : d;
  };
  applySets(arg('set', ''));
  if (mode === 'one') {
    const r = chainOne({ ws: arg('ws', 'zweihander'), seq: arg('seq', 'zornhau,zwerchL,zornhau').split(','), gap: +arg('gap', 0.1), v: +arg('v', 5.5) });
    if (arg('json', null)) {
      const F = r.cuts.map((c) => {
        const st = r.R.strokes.find((s) => s.k + 1 === c.k);
        return freshRun({ ws: r.ws, start: c.h0, d: st.d, v: r.v, key: `${c.name}|${r.v}` }).rec.slice(0, st.d.length * SPF + Math.round(0.3 / STEP)).map((x) => ({ tip: x.tip.map(r3), hd: x.hd.map(r3), h: x.h.map(r3), v: r3(x.v) }));
      });
      writeFileSync(arg('json'), JSON.stringify({ ws: r.ws, seq: r.seq, gap: r.gap, cuts: r.cuts, step: STEP, rec: r.R.rec.map((x) => (x ? { tip: x.tip.map(r3), hd: x.hd.map(r3), h: x.h.map(r3), v: r3(x.v), ph: x.ph } : null)), strokes: r.R.strokes.map(({ d, ...s }) => ({ ...s, n: d.length, d: d.map((x) => x.map(r3)) })), spf: SPF, fresh: F }));
    }
    console.log(JSON.stringify({ seq: r.seq, cuts: r.cuts, links: r.R.links.map(({ c0, ...l }) => l), stats: r.stats }, null, 1));
  } else if (mode === 'table') {
    const wss = arg('ws', 'zweihander').split(',');
    const lens = arg('len', '2,3,4').split(',').map(Number);
    const gaps = arg('gaps', '0,0.1').split(',').map(Number);
    const vs = arg('v', '5.5').split(',').map(Number);
    let all = [];
    for (const ws of wss) for (const len of lens) for (const gap of gaps) for (const v of vs) for (const seq of seqs(len)) {
      const r = chainOne({ ws, seq, gap, v });
      for (const c of r.cuts) all.push({ ws, len, gap, v, seq: seq.join('>'), ...c });
    }
    if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(all));
    console.log(tableOf(all));
  } else if (mode === 'render') {
    console.log(tableOf(rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  }
}
