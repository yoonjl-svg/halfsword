// ─────────────────────────────────────────────────────────────
//  wb_gate.mjs — 온몸 치기 관문 (물리 2.0 스무째 판 · r14 §1 의 줄 · §3). 재기만 한다 — 몸에 아무것도 걸지 않는다.
//   node tools/sim/wb_gate.mjs --root=<나무> [--seeds=4001-4040] [--only=lunge|cut] [--json=파일] [--secs=30] [--cache=폴더]
//   재는 셈은 tools/sim/wb_measure.mjs (r13 vs_src.mjs 와 한 벌) 의 strokeWB. 정의 · 고른 까닭 = docs/strike/physics2_notes/r20_wb_gate.md.
//  장면 (씨앗마다):
//   사람 길 — 서 있는 과녁 · 상대 칼 치움 · 탭 찌르기(skill.thrust · 오늘 걸음 그대로) / 손가락 베기(r13 장면)
//     먼 런지: 탭 때 골반 간격 = 키 × 1.45 ~ 1.55 (자료 Akbaş 2023 · Gutiérrez-Dávila 2014 의 시작 거리) — 팔만으로 닿는 거리(reach.json)보다 0.6 ~ 0.9 m 멂
//       씨앗마다 세 번(띠를 셋으로 나눠 칸마다 하나) → 씨앗 40 에 획 120 · 간격은 runThrust({pelvisGap}) 로 탭 때 골반 간격에 맞춤
//     가까운 찌르기: 간격 = 팔 닿음 + 몸통 앞 두께 − 0.05 ~ 0.35 m (팔만으로 닿음) — 값은 적기만 함(판정 없음 · 굳은 금 3)
//     베기: 내려베기 세로 · 사선 · 세로 둘째(장면 난수 s + 100000), 가로 (롱소드)
//   AI 길 — AI 대 AI 싸움 secs 초: 레이피어(탭 찌르기 획) · 롱소드(stich* 찌르기 · zornhau/zornhauL/oberhau 내려베기 · zwerch* 가로베기)
//     찌르기 획은 시작 때 골반 간격으로 가른다: 멂 = 간격 ≥ 팔 닿음(위 10 %) + 몸통 + 0.10 m (레이피어 2.05 · 장검 2.09 m) · 가까움 = 간격 ≤ 팔 닿음(가운데) + 몸통 · 그 사이는 셈 밖
//     AI '멂' 은 런지 거리가 아니다(몸이 0.1 ~ 0.2 m 만 가도 닿음) → AI 런지 줄은 읽기만(판정 없음). 상대가 0.10 m 넘게 다가온 획은 뺌. 키 × 1.40 넘는 AI 찌르기 수도 적음.
//  줄마다 무기 · 길(사람/AI) 하나씩, 그 줄이 쓴 획(맞음만 쓰는 줄은 맞은 획) 40 넘게(≥ 41)여야 판정 — 모자라면 "TOO FEW"(통과 아님).
//  판정 = 가운데값이 과녁 안(차례 · 칼 먼저 줄은 몫). 줄마다 씨앗을 다시 뽑는 90 % 구간(부트스트랩 · 씨앗 단위)을 함께 찍는다.
// ─────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { makeMeasure, seedList, rng, q } from './wb_measure.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const M = makeMeasure(H); const DT = M.DT;
const seeds = seedList(args.seeds ?? '4001-4040'); const only = args.only ? String(args.only) : null; const secs = +(args.secs ?? 30);
const WEAPONS = ['rapier', 'longsword']; // estoc · sabre 는 쓰지 않는다
const MIN_N = 41; // r14 §3 '줄마다 40 획 넘게'
const FAR_PER_SEED = 3, CLOSE_MAX = 0.10, AI_LUNGE = 1.40; // 사람 먼 런지 씨앗마다 횟수 · AI 획에서 뺄 상대 다가옴(m) · AI 참 런지 거리 = 키 × 1.40

// ── 몸의 치수 (오늘 나무에서 잼 · docs/strike/physics2_proto/r20/reach.json · 씨앗 4901-4920) — 나중 나무도 같은 거리로 재도록 고정 ──
export const BODY = { height: 1.72, front: 0.11, reach: { rapier: 1.791, longsword: 1.701 }, reach90: { rapier: 1.837, longsword: 1.878 } }; // 키 = 머리 꼭대기 · 몸통 앞 두께 = 가슴 상자 앞 반 두께 · 팔 닿음 = 걸음 없는 탭에서 칼끝이 탭 때 골반보다 앞선 최고(가운데값)
const farGap = (R, k) => BODY.height * (1.45 + 0.10 * (k + R()) / FAR_PER_SEED); // 띠를 FAR_PER_SEED 칸으로 · 칸 k 안에서 고르게
const nearGap = (w, R) => BODY.reach[w] + BODY.front - (0.05 + 0.30 * R());
const AI_FAR = (w) => BODY.reach90[w] + BODY.front + 0.10, AI_NEAR = (w) => BODY.reach[w] + BODY.front;

// ── 줄 (r14 §1 — 과녁 = 자료 범위 ± 20 % · 표의 값 그대로) ──
const LUNGE_LINES = [
  { id: 'L1', name: '런지 골반 최고 앞 빠르기', key: 'pelPk', lo: 1.5, hi: 2.6, unit: 'm/s', src: '1.84 ~ 2.15 (Hassan · Klauck 1998)' },
  { id: 'L2', name: '런지 골반 ÷ 무기 손 최고', key: 'ratio', lo: 0.45, hi: 0.75, unit: '', src: '약 0.6 (위 두 값의 비)' },
  { id: 'L3', name: '런지 뒷다리 수평 밀기 ÷ 몸무게', key: 'pushAct', lo: 0.56, hi: 1.04, unit: '', src: '0.7 ~ 0.87 (Mulloy 2018)' },
  { id: 'L4', name: '런지 첫 움직임 → 맞음', key: 'tHit', lo: 0.43, hi: 0.84, unit: 's', hitOnly: true, src: '0.54 ~ 0.7 (Mulloy 2015 · 2018 · Gutiérrez-Dávila 2014)' },
  { id: 'L5', name: '런지 손이 앞발보다 먼저 떠남', key: 'handFoot', lo: 0.02, hi: 0.12, unit: 's', src: '0.07 ± 0.05 (Gholipour 2008 · 2차 인용)' },
  { id: 'L6', name: '런지 뒷다리 엉덩→무릎→발목 차례', key: 'order', share: 0.5, hitOnly: true, unit: '몫', src: '80 → 88 → 94 % (Mulloy 2018)' },
  { id: 'L7', name: '런지 팔 최고일 때 몸 앞 빠르기', key: 'comAtHand', read: true, unit: 'm/s', src: '숙련 0.41 · 초심 0.05 (Yiou · Do 2000 · 초록만) — 읽기만' },
];
const CUT_LINES = [
  { id: 'C1', name: '내려베기 앞발 디딤 − 칼 닿음', key: 'footGap', lo: 0, hi: 0.09, unit: 's', posShare: 0.8, hitOnly: true, descOnly: true, src: '숙련 +43 ± 16 ms (Takenaka 2017)' },
  { id: 'C2', name: '베기 칼끝 최고 빠르기 (지킴)', key: 'tipPk', keep: { human: [13.3, 15.3], ai: [12.0, 13.4] }, widen: 0.10, unit: 'm/s', src: '11 ~ 14 (Merkert 2019) · 오늘 범위(r14 표) ± 10 %' },
];
const NEAR_KEYS = ['pelPk', 'handPk', 'ratio', 'tHit', 'handFoot', 'tipPk'];

// ── 씨앗 하나 ──
function runSeed(s) {
  const R = rng(s * 7 + 1); const rows = [];
  const add = (scene, w, path, list, extra = {}) => { for (const r of list) rows.push({ seed: s, scene, weapon: w, path, ...extra, ...r }); };
  if (only !== 'cut') {
    for (const w of WEAPONS) {
      for (let k = 0; k < FAR_PER_SEED; k++) { const gf = farGap(R, k); add('far', w, 'human', M.runThrust(s, w, { gap: gf, pelvisGap: gf, post: 3.2, wb: true }), { rep: k }); }
      const gn = nearGap(w, R); add('near', w, 'human', M.runThrust(s, w, { gap: gn, pelvisGap: gn, post: 3.2, wb: true }));
    }
  }
  if (only !== 'lunge') {
    add('cut', 'longsword', 'human', M.runCut(s, 'desc', { form: 'vert', post: 3.5, wb: true }), { desc: true });
    add('cut', 'longsword', 'human', M.runCut(s, 'desc', { form: 'diag', post: 3.5, wb: true }), { desc: true });
    add('cut', 'longsword', 'human', M.runCut(s + 100000, 'desc', { form: 'vert', post: 3.5, wb: true }).map((r) => ({ ...r, seed: s })), { desc: true, rep: 1 }); // 세로 둘째(장면 난수만 s + 100000) — 사선은 서 있는 과녁을 자주 빗나가 C1 의 맞은 획이 40 언저리라서
    add('cut', 'longsword', 'human', M.runCut(s, 'horiz', { post: 3.5, wb: true }), { desc: false });
  }
  for (const w of WEAPONS) {
    if (only === 'cut' && w === 'rapier') continue;
    const G = H.newRound({ walls: true, seed: s, weapon: w, weapon2: w, AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
    const DESC = new Set(['zornhau', 'zornhauL', 'oberhau']), HOR = new Set(['zwerch', 'zwerchL', 'zwerchAbtritt']);
    const det = (f, i, prev, st) => {
      // 재지 않는 동작도 'other' 사건으로 남김 → 앞 획의 창이 다음 동작 앞에서 끝나게 (읽기 지적 5).
      //   동작 하나 = 바쁨(탭 또는 휘두르기)이 꺼짐 → 켜짐으로 바뀐 스텝. 탭 찌르기는 탭 다음 스텝에 휘두르기가 켜지고 그 안에서 다시 켜지기도 해서 휘두르기 켜짐만으로는 한 동작이 여럿으로 쪼개진다.
      const th = f.skill?.thrusts ?? 0, newTap = th > (st.th ?? th); st.th = th; const swOn = !!f.skill?.swinging && !st.prevSw; st.prevSw = !!f.skill?.swinging;
      //   같은 AI 기술 안의 다음 휘두르기(내려베기의 들기 → 치기 같은)는 같은 동작이라 'other' 가 아님 — AI 기술(객체)이 바뀐 뒤의 켜짐만.
      const tech = ais.get(f)?.tech; const tn = tech?.name;
      const busy = !!f.skill?.tap || !!f.skill?.swinging, busyOn = busy && !st.prevBusy; st.prevBusy = busy; const other = busyOn && (tech == null || tech !== st.evTech) ? { o: i, kind: 'other' } : null;
      if (w === 'rapier') { if (newTap && !f.skill.tap?.down && f.state === 'stand') { st.evTech = tech; return { o: i, kind: 'thrust', tech: 'tap' }; } return other; }
      if (tech !== st.lastTech) { st.lastTech = tech; st.armed = M.STICH.has(tn) || DESC.has(tn) || HOR.has(tn) ? tn : null; }
      let ev = null; if (st.armed && swOn && f.state === 'stand') { ev = { o: i, kind: M.STICH.has(st.armed) ? 'thrust' : 'cut', tech: st.armed, desc: DESC.has(st.armed) }; st.armed = null; st.evTech = tech; }
      return ev ?? other;
    };
    for (const { line, ev, hits } of M.fightRaw(G, ais, secs, det)) {
      for (let j = 0; j < ev.length; j++) {
        const e = ev[j]; if (e.kind === 'other') continue; if (only === 'lunge' && e.kind === 'cut') continue; if (only === 'cut' && e.kind === 'thrust') continue;
        if (line.length - 1 < e.o + 4) continue;
        const r = M.strokeWB(line, e.o, hits, e.kind, ev[j + 1]?.o ?? Infinity);
        if (e.kind === 'cut') { rows.push({ seed: s, scene: 'cut', weapon: w, path: 'ai', tech: e.tech, desc: e.desc, ...r }); continue; }
        const scene = r.gap0 >= AI_FAR(w) ? (r.closing > CLOSE_MAX ? 'farClose' : 'far') : r.gap0 <= AI_NEAR(w) ? 'near' : 'mid';
        rows.push({ seed: s, scene, weapon: w, path: 'ai', tech: e.tech, ...r });
      }
    }
  }
  return rows;
}

// ── 돌리기 (--cache = 씨앗마다 저장 → 끊겨도 이어 돎) ──
const cache = args.cache ? String(args.cache) : null; if (cache) mkdirSync(cache, { recursive: true });
let rows = [];
for (const s of seeds) {
  const cf = cache ? join(cache, `s${s}_${only ?? 'all'}_${secs}_v2.json`) : null;
  if (cf && existsSync(cf)) { rows.push(...JSON.parse(readFileSync(cf, 'utf8'))); continue; }
  const r = runSeed(s); rows.push(...r); if (cf) writeFileSync(cf, JSON.stringify(r));
}

// ── 판정 ──
const f2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
const out = []; const counts = {};
function countScene(scene, w, path) {
  const all = rows.filter((r) => r.scene === scene && r.weapon === w && r.path === path);
  const c = { strokes: all.length, valid: all.filter((r) => r.valid).length, fell: all.filter((r) => r.fell).length, notBack: all.filter((r) => !r.fell && !r.cut && !r.back).length, cut: all.filter((r) => r.cut).length, hits: all.filter((r) => r.valid && r.hit).length };
  counts[`${scene}/${w}/${path}`] = c; return c;
}
// 줄의 수 하나(가운데값 또는 몫) — 부트스트랩도 같은 셈을 씀
const stat = (L, a) => (L.share != null ? (a.length ? a.filter((x) => x === 1).length / a.length : NaN) : L.posShare != null ? (a.length ? a.filter((x) => x > 0).length / a.length : NaN) : q(a, 0.5));
// 씨앗 단위 부트스트랩 90 % 구간 (읽기 지적 7: 획은 씨앗 안에서 뭉치므로 씨앗을 다시 뽑음 · 정해진 난수 → 같은 입력이면 같은 구간)
function bootCI(L, use, B = 1000) {
  const by = new Map(); for (const r of use) { if (!by.has(r.seed)) by.set(r.seed, []); by.get(r.seed).push(r[L.key]); }
  const groups = [...by.values()]; if (groups.length < 2) return [NaN, NaN]; const R = rng(9173); const v = [];
  for (let b = 0; b < B; b++) { const a = []; for (let k = 0; k < groups.length; k++) a.push(...groups[Math.floor(R() * groups.length)]); v.push(stat(L, a)); }
  return [q(v, 0.05), q(v, 0.95)];
}
function judge(L, set, path, readOnly = false) {
  const use = set.filter((r) => (L.hitOnly ? r.hit : true) && r[L.key] != null && Number.isFinite(r[L.key]));
  const a = use.map((r) => r[L.key]); const n = a.length; const med = q(a, 0.5), p10 = q(a, 0.1), p90 = q(a, 0.9);
  const o = { id: L.id, name: L.name, n, med, p10, p90, unit: L.unit, src: L.src, seedsUsed: new Set(use.map((r) => r.seed)).size };
  [o.ciLo, o.ciHi] = bootCI(L, use);
  if (L.share != null) { o.shareVal = stat(L, a); o.target = `몫 > ${L.share}`; o.pass = o.shareVal > L.share; o.lo = L.share; o.hi = 1; o.ties = use.filter((r) => r.orderTie).length; o.trunc = set.filter((r) => r.hit && r.orderTrunc).length; }
  else if (L.posShare != null) { o.shareVal = stat(L, a); o.target = `칼 먼저 > ${L.posShare * 100} % · 가운데 ${L.lo} ~ ${L.hi}`; o.pass = o.shareVal > L.posShare && med >= L.lo && med <= L.hi; o.lo = L.posShare; o.hi = 1; }
  else if (L.keep) { const k = L.keep[path]; o.lo = k[0] * (1 - L.widen); o.hi = k[1] * (1 + L.widen); o.target = `${f2(o.lo)} ~ ${f2(o.hi)}`; o.pass = med >= o.lo && med <= o.hi; }
  else if (L.read) { o.target = '읽기만'; o.pass = null; }
  else { o.lo = L.lo; o.hi = L.hi; o.target = `${L.lo} ~ ${L.hi}`; o.pass = med >= L.lo && med <= L.hi; }
  if (readOnly && o.pass != null) { o.target += ' (AI 거리 — 읽기만)'; o.wouldPass = o.pass; o.pass = null; }
  o.ciInside = o.lo != null && Number.isFinite(o.ciLo) ? o.ciLo >= o.lo && o.ciHi <= o.hi : null; // 90 % 구간이 과녁 안에 통째로 듦 (적기만 · 판정은 가운데값)
  o.verdict = o.pass == null ? 'READ' : n < MIN_N ? 'TOO FEW' : o.pass ? 'PASS' : 'FAIL';
  return o;
}
console.log(`GATE wholebody · 나무 ${ROOT} · 씨앗 ${seeds[0]}~${seeds[seeds.length - 1]} (${seeds.length}) · AI 판 ${secs} s · 줄마다 그 줄이 쓴 획 ${MIN_N} 이상(40 넘게)이어야 판정`);
const groups = [];
if (only !== 'cut') for (const w of WEAPONS) for (const path of ['human', 'ai']) groups.push({ kind: 'lunge', w, path });
if (only !== 'lunge') for (const path of ['human', 'ai']) groups.push({ kind: 'cut', w: 'longsword', path });
for (const G of groups) {
  if (G.kind === 'lunge') {
    const c = countScene('far', G.w, G.path); const set = rows.filter((r) => r.scene === 'far' && r.weapon === G.w && r.path === G.path && r.valid);
    const g0 = set.map((r) => r.gap0), e = set.filter((r) => r.t0Edge).length;
    let extra = `탭 때 골반 간격 ${f2(q(g0, 0), 3)} ~ ${f2(q(g0, 1), 3)} m`;
    if (G.path === 'ai') { const all = rows.filter((r) => r.path === 'ai' && r.weapon === G.w && r.valid); extra += ` · 상대가 ${CLOSE_MAX} m 넘게 다가와 뺀 획 ${countScene('farClose', G.w, 'ai').valid} · 키 × ${AI_LUNGE} 넘는 AI 찌르기 ${all.filter((r) => r.gap0 >= BODY.height * AI_LUNGE).length}`; }
    console.log(`[먼 런지 · ${G.w} · ${G.path === 'human' ? '사람 길' : 'AI 길 — AI 가 고른 거리(런지 거리 아님) · 읽기만'}] 획 ${c.strokes} · 셈에 듦 ${c.valid} · 맞음 ${c.hits} · 넘어짐 ${c.fell} · 3 s 안에 안 돌아옴 ${c.notBack} · 끝 잘림 ${c.cut} · 손 시작이 찾기 처음에 이미 움직이던 획(t0 = 부른 스텝) ${e} · ${extra}`);
    for (const L of LUNGE_LINES) { const o = judge(L, set, G.path, G.path === 'ai'); o.weapon = G.w; o.path = G.path; out.push(o); pr(o); }
  } else {
    const c = countScene('cut', G.w, G.path); const set = rows.filter((r) => r.scene === 'cut' && r.weapon === G.w && r.path === G.path && !r.fell && !r.cut);
    console.log(`[베기 · longsword · ${G.path === 'human' ? '사람 길' : 'AI 길'}] 획 ${c.strokes} · 넘어짐 ${c.fell} · 내려베기 ${set.filter((r) => r.desc).length} (맞음 ${set.filter((r) => r.desc && r.hit).length}) · 가로 ${set.filter((r) => !r.desc).length}`);
    for (const L of CUT_LINES) { const o = judge(L, L.descOnly ? set.filter((r) => r.desc) : set, G.path); o.weapon = G.w; o.path = G.path; out.push(o); pr(o); }
  }
}
function pr(o) {
  const val = o.shareVal != null ? `몫 ${f2(o.shareVal)} · ` : '';
  const tie = o.ties != null ? ` · 같은 스텝(차례 아님) ${o.ties} · 꼭대기 잘려 뺌 ${o.trunc}` : '';
  console.log(`  ${o.verdict.padEnd(7)} ${o.id} ${o.name.padEnd(22)} ${val}가운데 ${f2(o.med, 3)} · 10-90 % ${f2(o.p10, 3)} ~ ${f2(o.p90, 3)} ${o.unit} · 씨앗 90 % 구간 ${f2(o.ciLo, 3)} ~ ${f2(o.ciHi, 3)} · 획 ${o.n}(씨앗 ${o.seedsUsed})${o.n < MIN_N && o.pass != null ? ' (40 넘게 모자람)' : ''}${tie} · 과녁 ${o.target}`);
}
// 가까운 찌르기 — 적기만 (판정 없음)
const near = {};
if (only !== 'cut') {
  console.log('[가까운 찌르기 — 적기만 · 판정 없음]');
  for (const w of WEAPONS) for (const path of ['human', 'ai']) {
    const c = countScene('near', w, path); const set = rows.filter((r) => r.scene === 'near' && r.weapon === w && r.path === path && r.valid);
    const o = {}; for (const k of NEAR_KEYS) { const a = set.filter((r) => (k === 'tHit' ? r.hit : true)).map((r) => r[k]).filter((x) => x != null && Number.isFinite(x)); o[k] = { n: a.length, med: q(a, 0.5), p10: q(a, 0.1), p90: q(a, 0.9) }; }
    near[`${w}/${path}`] = o;
    console.log(`  ${w.padEnd(9)} ${path.padEnd(5)} 획 ${c.strokes} · 셈 ${c.valid} · 넘어짐 ${c.fell} · ` + NEAR_KEYS.map((k) => `${k} ${f2(o[k].med)}(${o[k].n})`).join(' · '));
  }
  const mid = rows.filter((r) => r.scene === 'mid').length; console.log(`  AI 찌르기 가운데 거리(셈 밖) ${mid} 획`);
}
const judged = out.filter((o) => o.pass != null); const passN = judged.filter((o) => o.verdict === 'PASS').length;
const gatePass = judged.length > 0 && passN === judged.length;
console.log(`GATE wholebody: ${gatePass ? 'PASS' : 'FAIL'} (${passN} of ${judged.length})`);
if (args.json) writeFileSync(String(args.json), JSON.stringify({ args, BODY, seeds: [seeds[0], seeds[seeds.length - 1]], lines: out, counts, near, pass: gatePass, passN, m: judged.length, rows }));
