// ─────────────────────────────────────────────────────────────
//  ib_link_input.mjs — 이어 돌리기(B7) 다음 칼 입력 재기 (11/15 사장님 "앞뒤 칼이 이어지는 느낌이 아니고 내가 실제로 조작한 다음칼이 나가지도 않았어"
//   — 기록 docs/strike/ib_link_2026-11-14.md §12).
//  허공 · 사람 손가락 봇(main.js 와 같은 차례: 손가락 몫 → uq.feed → 손 목표에 더함 · 탭 → skill.thrust): 쉼 → 첫 칼 시작 자리로 → 첫 칼 긋기 →
//   손가락을 뗀 뒤 gap 실제 초에 다음 칼 '방향만' 긋기(시작 자리로 가지 않음 — 이어 돌리기가 옮겨 줄 몫) 또는 탭 → 1.5 s.
//   돌려줌: 다음 입력 시각 · 원 시작 · 끝 · 그만둠 까닭 · 원이 고른 칼 · 실제로 나간 칼(입력 뒤 첫 긋기 — 원을 부른 첫머리는 뺌) · 칼끝이 간 길 · 칼끝 빠르기 곡선.
//  node tools/sim/ib_link_input.mjs table [--ws=zweihander] [--set=IB_LINK.on=0]   (표 — 첫 칼 셋 × 다음 입력 아홉 × 틈 넷)
//  node tools/sim/ib_link_input.mjs one --first=zornhau --next=zornhau --gap=0.1 [--json=…]   (한 벌 · 스텝 줄)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { TECH, TECH_BY_NAME } from '../../src/ai_techniques.js';
// 큰 칼 · 첫 방향 (iberian_link.js 와 같은 셈 — 이 도구는 고치기 전 코드에서도 돌게 따로 둠)
const LINK_TECH = TECH.filter((t) => t.kind === 'cut' && t.from[1] > 0);
const techDir = (t) => { const d = [t.path[0][0] - t.from[0], t.path[0][1] - t.from[1]]; const n = Math.hypot(d[0], d[1]) || 1; return [d[0] / n, d[1] / n]; };
import { isMain } from './is_main.mjs';
import { applySets } from './ib_link.mjs';

const { SKILL } = CONFIG;
const K = CONFIG.TIME.k;
const FRAME = 1 / 60; // 실제 s
const SPF = Math.max(1, Math.round((FRAME * K) / DT));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

function line(from, to, v) {
  const out = [];
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.round(d / v / FRAME));
  for (let i = 0; i < n; i++) out.push([(to[0] - from[0]) / n, (to[1] - from[1]) / n]);
  return out;
}
/** 기술 길의 옮김만 (지금 손 자리에서 — 시작 자리로 가지 않음) */
function swipeOf(name, v) {
  const t = TECH_BY_NAME[name];
  const pts = [t.from, ...t.path];
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(...line(pts[i], pts[i + 1], v));
  return out;
}

/** 다음 입력 아홉: 큰 칼 다섯 · 올려 베기 둘 · 찌르는 긋기(소 자세 찌르기 길) · 탭 */
export const NEXT = ['zornhau', 'zornhauL', 'oberhau', 'zwerch', 'zwerchL', 'unterhau', 'unterhauL', 'stichOchs', 'tap'];

export function inputOne({ ws = 'zweihander', first = 'zornhau', next = 'zornhau', gap = 0.1, v = 5.5, seed = 1, rows = false } = {}) {
  const kit = kitFromNodes('iberian', allNodeIds('iberian'));
  const G = newRound({ walls: false, weapon: ws, weapon2: 'longsword', seed, gap: 6, kit });
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
  const q = [];
  const A = TECH_BY_NAME[first];
  for (let i = 0; i < Math.round(0.6 / FRAME); i++) q.push([0, 0]);
  q.push(...line([P.handOffset.x, P.handOffset.y], A.from, 1.0));
  for (let i = 0; i < 6; i++) q.push([0, 0]);
  const firstQ = swipeOf(first, v);
  q.push(...firstQ);
  const nFirstEnd = q.length; // 첫 칼 손가락이 끝난 프레임 수
  for (let i = 0; i < Math.round(gap / FRAME); i++) q.push([0, 0]);
  const nIn = q.length; // 다음 입력 첫 프레임
  const nextQ = next === 'tap' ? [] : swipeOf(next, v);
  q.push(...nextQ);
  const tapAt = next === 'tap' ? nIn : -1;
  let tIn = Infinity; // 다음 입력 시각 (실제 s — 그 프레임이 든 때)
  let tEnd = Infinity;
  let frame = 0;
  let k = 0;
  let t = 0;
  const strokes = [];
  let seenCur = null;
  let link = null;
  const links = [];
  const cancel0 = () => JSON.stringify(uq.stats.link?.cancel ?? {});
  let tapT = null;
  const tip = new THREE.Vector3();
  const prev = new THREE.Vector3();
  let have = false;
  const curve = [];
  G.before = () => {
    if (k++ % SPF === 0) {
      const d = q.shift() ?? [0, 0];
      uq.feed(d[0], d[1], FRAME, false);
      P.handOffset.x += d[0];
      P.handOffset.y += d[1];
      P.handHeld = q.length > 0;
      P.inputActive = Math.abs(d[0]) + Math.abs(d[1]) > 1e-5;
      if (frame === nIn) (tIn = t), (tEnd = t + 1.5 + nextQ.length * FRAME);
      if (frame === tapAt) (tapT = t), P.skill.thrust();
      frame++;
    }
    P.move.set(0, 0);
    P.stickX = P.stickY = 0;
  };
  const t0 = G.t;
  let fingerEnd1 = null;
  try {
    while (t < tEnd) {
      G.step();
      t = (G.t - t0) / K;
      if (fingerEnd1 == null && frame >= nFirstEnd) fingerEnd1 = t;
      // 긋기 (uq 가 읽은 새 긋기 — 원을 부른 첫머리는 cur.link)
      if (uq.cur && uq.cur !== seenCur) {
        seenCur = uq.cur;
        strokes.push({ t: r3(t), tech: uq.cur.tech, start: uq.cur.start?.map(r3), dir: uq.cur.dir?.map(r3), cur: uq.cur });
      }
      if (P.ibLink && !link) link = { t0: r3(t), tech: P.ibLink.tech, c0: cancel0() };
      if (link && !link.t1 && !P.ibLink) {
        link.t1 = r3(t);
        const c1 = cancel0();
        link.cancel = c1 !== link.c0 ? c1 : null;
        links.push(link);
        link = null;
      }
      P.bladePoint(1, tip);
      const vt = have ? tip.distanceTo(prev) / (DT / K) : 0; // 칼끝 빠르기 (실제 m/s)
      prev.copy(tip);
      have = true;
      if (rows || t >= tIn - 0.4) curve.push([r3(t), r3(vt), P.ibLink ? 1 : uq.link?.phase === 'replay' ? 2 : P.skill.swinging ? 3 : 0]);
    }
  } finally {
    G.world.free();
  }
  for (const s of strokes) s.link = s.cur.link ?? null;
  const after = strokes.filter((s) => s.t >= tIn - 1e-6 && !s.link);
  const exe = next === 'tap' ? (tapT != null ? 'tap' : null) : after[0]?.tech ?? (after[0] ? '-' : null);
  const L = links.find((l) => l.t0 >= tIn - 0.2) ?? null;
  // 칼끝이 다음 입력 뒤(원이 있으면 원 끝 뒤) 0.6 s 동안 간 길 · 원 끝 칼끝 빠르기 · 원 끝 뒤 0.1 s 안 가장 낮은 빠르기
  const from = L?.t1 ?? tIn;
  const seg = curve.filter((c) => c[0] > from && c[0] <= from + 0.6);
  const travel = seg.reduce((a, c) => a + c[1] * (DT / K), 0);
  const atEnd = L ? curve.filter((c) => c[0] <= L.t1).at(-1)?.[1] ?? null : null;
  const dip = L ? Math.min(...curve.filter((c) => c[0] > L.t1 && c[0] <= L.t1 + 0.1).map((c) => c[1])) : null;
  for (const s of strokes) delete s.cur;
  // 같은가: 나간 칼 이름 = 입력 · 큰 칼이 아닌 입력(올려 베기 · 찌르는 긋기)은 원이 엉뚱한 칼로 부르지 않았고 첫 긋기 방향이 그은 방향 40° 안이면 '그 자리 그 방향 긋기'로 나감(이름 없는 기본 긋기여도)
  const isLink = LINK_TECH.some((t) => t.name === next);
  const wrongLink = !!L && L.tech !== next;
  const nd = next === 'tap' ? null : techDir(TECH_BY_NAME[next]);
  const d0 = after[0]?.dir;
  const dirOk = !!(nd && d0) && (Math.acos(Math.max(-1, Math.min(1, nd[0] * d0[0] + nd[1] * d0[1]))) * 180) / Math.PI <= CONFIG.UNIQUE_ASSIST.angle;
  const same = exe === next || (!isLink && next !== 'tap' && !wrongLink && dirOk);
  return { ws, first, next, gap, tIn: r3(tIn), fingerEnd1: r3(fingerEnd1), link: L, exe, same, wrongLink, dirOk, travel: r3(travel), atEnd: r3(atEnd), dip: r3(dip), strokes: strokes.filter((s) => s.t >= tIn - 0.5), curve };
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => {
    const a = rest.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : d;
  };
  applySets(arg('set', ''));
  if (mode === 'one') {
    const r = inputOne({ ws: arg('ws', 'zweihander'), first: arg('first', 'zornhau'), next: arg('next', 'zornhau'), gap: +arg('gap', 0.1), v: +arg('v', 5.5), rows: true });
    if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(r));
    const { curve, ...o } = r;
    console.log(JSON.stringify(o, null, 1));
  } else if (mode === 'table') {
    const ws = arg('ws', 'zweihander');
    const firsts = arg('first', 'zornhau,zornhauL,zwerch').split(',');
    const nexts = arg('next', NEXT.join(',')).split(',');
    const gaps = arg('gaps', '0,0.1,0.25,0.45').split(',').map(Number);
    const out = ['| 첫 칼 | 다음 입력 | 틈 s | 입력 시각 s | 원 시작 · 끝 s | 원이 고른 칼 · 그만둠 | 나간 칼 | 같은가 | 칼끝 간 길 m (0.6 s) | 원 끝 칼끝 · 끝 뒤 0.1 s 가장 낮음 m/s |', '|---|---|---:|---:|---|---|---|---|---:|---|'];
    const all = [];
    for (const first of firsts) for (const next of nexts) for (const gap of gaps) {
      const r = inputOne({ ws, first, next, gap, v: +arg('v', 5.5) });
      const { curve, strokes, ...o } = r;
      all.push(o);
      out.push(`| ${first} | ${next} | ${gap} | ${r.tIn} | ${r.link ? `${r.link.t0} · ${r.link.t1}` : '—'} | ${r.link ? `${r.link.tech}${r.link.cancel ? ` · ${r.link.cancel}` : ''}` : '—'} | ${r.exe ?? '없음'}${r.exe === '-' ? (r.dirOk ? ' (그 방향 기본 긋기)' : ' (방향 다름)') : ''} | ${r.same ? 'O' : '**X**'} | ${r.travel} | ${r.link ? `${r.atEnd} · ${r.dip}` : '—'} |`);
    }
    const bad = all.filter((o) => !o.same).length;
    out.push('', `같지 않음 ${bad} / ${all.length}`);
    if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(all));
    console.log(out.join('\n'));
  }
}
