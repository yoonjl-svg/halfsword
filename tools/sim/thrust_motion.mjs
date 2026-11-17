// ─────────────────────────────────────────────────────────────
//  thrust_motion.mjs — 찌르기 동작 재기 · 베기와 견줌 (사장님 11/15 '베기에 비해 동작이 너무 작고 느린 거 같아. 이탈리아 뿐만 아니라 모든 찌르기 동작을 강화하고
//   좀 빠르게 혹은 힘있게 찌르게 하는 것도 고려해.' — 기록 docs/strike/thrust_stuck_2026-11-15.md §2). 재기만 한다(게임 값은 --set 으로 이 프로세스 안에서만).
//   서 있는 상대(AI 끔 · 칼 아래 · 롱소드) 앞 가슴 사이 = 그 무기 맞닿기 거리(swordArt.measure.contact) 에서 사람 몸(그 유파 스킬트리 모두 — 0 번 humanInput) 하나가 한 획:
//    tap   = 화면 톡(skill.thrust — 사람 탭 찌르기 · 이탈리아는 런지 · 내려 찌르기 등 유파 몫 그대로)
//    stich = 손가락 찌르기 획(stichOchs — 봇 손 4.25 패드 m/s · 시작 자리로 감기 · 4 프레임 멈춤 · 긋기)
//    cut   = 손가락 내려베기 획(zornhau — 같은 손)
//   획마다 (입력 = 톡 순간 · 손가락 긋기 첫 프레임 — 실제 초): 칼끝 나간 거리(cm — 처음 칼끝에서 가장 먼) · 손 나간 거리(cm — 칼자루) · 칼끝 가장 빠름(m/s) · 그때까지 s ·
//    처음 상대 몸 닿음까지 s · 처음 판정(꼴 · 에너지 J · 배율 전 J) · 판정 수 · 칼날 상처 심각도 합.
//  node tools/sim/thrust_motion.mjs [--cells=german:longsword,italian:rapier,iberian:zweihander,japanese:uchigatana,chinese:hwando] [--kinds=tap,stich,cut] [--set=THRUST.x=v] [--seeds=1-3] [--gap=air,contact,reach|<m>] (air = 상대를 가슴 사이 3 m — 닿지 않음)
// ─────────────────────────────────────────────────────────────
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { allNodeIds, kitFromNodes } from '../../src/skill_tree_data.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k;
CONFIG.ARENA.startHold = 0; // 판 시작 정지 없음 (italian_cut.mjs 와 같음 — 정지 동안은 걸음 부탁 · 런지가 안 남)
const FRAME = 1 / 60; // 손가락 프레임 (실제 s)
const r2 = (x) => (Number.isFinite(x) ? +x.toFixed(2) : null);

/** 한 획 → 셈 */
export function strokeRun({ school, weapon, kind, seed = 1, gap = 'contact', v = 4.25, foeHand = [0, -0.5] }) {
  const kit = kitFromNodes(school, allNodeIds(school));
  // 거리: 먼저 몸을 하나 지어 그 무기 간격 줄을 읽음
  const air = gap === 'air'; // 허공 (상대를 가슴 사이 3 m 에 둠 — 닿지 않는 동작만 · 탭은 겨눌 상대가 있어야 나감)
  let g = air ? 3 : +gap;
  if (!Number.isFinite(g)) {
    const G0 = newRound({ weapon, weapon2: 'longsword', seed, kit });
    g = G0.player.swordArt.measure[gap];
    G0.world.free();
  }
  const G = newRound({ weapon, weapon2: 'longsword', seed, gap: g, walls: false, kit, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.autoGuard = true;
  for (let t = 0; t < 1.2 * K; t += DT) { P.move.set(0, 0); E.handOffset.set(...foeHand); G.step(); }
  const d0 = air ? null : P.foeDistance();
  // 판정 엿보기
  let on = false;
  const hits = [];
  let touchT = null;
  const C = G.combat;
  let lastA = null;
  const an = C.analyze.bind(C);
  C.analyze = (pr, point, S, Pp, predicting = false) => { const r = an(pr, point, S, Pp, predicting); if (!predicting) lastA = r; return r; };
  const st = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    lastA = null;
    const r = st(pr, point, passing);
    if (on && pr.w.fighter === P && pr.v.fighter === E) {
      if (touchT == null) touchT = G.t;
      if (lastA) hits.push({ t: G.t, judged: !!r, type: lastA.type, E: lastA.energy, E1: lastA.ephys * CONFIG.STRIKE.energyScale, sev: r?.severity ?? 0, stuck: !!r?.stuck, part: pr.v.part, sp: lastA.speed, passing });
    }
    return r;
  };
  // 손가락 획 (italian_cut.mjs 와 같은 손 — 실제 프레임 1/60 s)
  const q = [];
  if (kind !== 'tap') {
    const T = TECH_BY_NAME[kind === 'stich' ? 'stichOchs' : 'zornhau'];
    let fx = P.handOffset.x, fy = P.handOffset.y;
    const to = (p, sp, flag) => { for (let k = 0; k < 400; k++) { const dx = p[0] - fx, dy = p[1] - fy, dd = Math.hypot(dx, dy); if (dd < 1e-6) break; const s = Math.min(dd, sp * FRAME); fx += (dx / dd) * s; fy += (dy / dd) * s; q.push([(dx / dd) * s, (dy / dd) * s, flag]); } };
    to(T.from, 1.6, 0);
    for (let i = 0; i < 4; i++) q.push([0, 0, 0]);
    for (const p of T.path) to(p, v, 1);
  }
  let t0 = null, nextF = 0, tReal = 0;
  const tip0 = new THREE.Vector3(), hand0 = new THREE.Vector3(), tip = new THREE.Vector3(), prev = new THREE.Vector3();
  let tipMax = 0, handMax = 0, vMax = 0, tV = null, have = false, released = false;
  const handPt = () => { const s = P.sword.translation(); return new THREE.Vector3(s.x, s.y, s.z); };
  if (kind === 'tap') {
    t0 = G.t;
    on = true;
    tip0.copy(P.bladePoint(1, new THREE.Vector3()));
    hand0.copy(handPt());
    P.skill.thrust();
  }
  for (let i = 0; i < 4 / DT; i++) {
    tReal = G.t / K;
    if (kind !== 'tap' && tReal >= nextF - 1e-9) {
      nextF += FRAME;
      const f = q.shift();
      if (f) {
        if (f[2] === 1 && t0 == null) { t0 = G.t; on = true; tip0.copy(P.bladePoint(1, new THREE.Vector3())); hand0.copy(handPt()); }
        P.handOffset.x += f[0];
        P.handOffset.y += f[1];
        P.handHeld = true;
        P.inputActive = Math.abs(f[0]) + Math.abs(f[1]) > 1e-5;
      } else if (!released) { P.handHeld = false; P.inputActive = false; released = true; }
    }
    P.move.set(0, 0);
    E.handOffset.set(...foeHand);
    G.step();
    if (t0 == null) continue;
    P.bladePoint(1, tip);
    if (have) {
      const sp = tip.distanceTo(prev) / (DT / K); // 실제 m/s
      if (sp > vMax) (vMax = sp), (tV = (G.t - t0) / K);
    }
    prev.copy(tip);
    have = true;
    tipMax = Math.max(tipMax, tip.distanceTo(tip0));
    handMax = Math.max(handMax, handPt().distanceTo(hand0));
    if ((G.t - t0) / K > 0.8) break;
  }
  const first = hits.find((h) => h.judged) ?? null;
  const out = { school, weapon, kind, seed, gapName: String(gap), gap: r2(g), d0: r2(d0), tip: r2(tipMax * 100), hand: r2(handMax * 100), vMax: r2(vMax), tV: r2(tV), tTouch: touchT == null ? null : r2((touchT - t0) / K), first: first ? { type: first.type, E: r2(first.E), E1: r2(first.E1), part: first.part, sp: r2(first.sp), t: r2((first.t - t0) / K), stuck: first.stuck } : null, judged: hits.filter((h) => h.judged).length, under: hits.filter((h) => !h.judged).length, sev: r2(hits.reduce((s, h) => s + h.sev, 0)), stuck: hits.filter((h) => h.stuck).length };
  G.world.free();
  return out;
}

const med = (a) => { const s = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
export function table(rows) {
  const by = new Map();
  for (const r of rows) { const k = `${r.school}:${r.weapon}|${r.kind}|${r.gapName}`; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const out = ['| 유파 · 무기 | 획 | 수 | 칼끝 나감 cm | 손 나감 cm | 칼끝 가장 빠름 m/s | 그때까지 s | 몸 닿음까지 s | 첫 판정 꼴 · J (배율 전) | 판정 / 문턱 밑 닿음 | 박힘 | 심각도 |', '|---|---|---:|---:|---:|---:|---:|---:|---|---|---:|---:|'];
  const f = (x, k = 2) => (x == null ? '–' : x.toFixed(k));
  for (const [k, R] of by) {
    const [sw, kind, gn] = k.split('|');
    const F = R.map((r) => r.first).filter(Boolean);
    const ty = {};
    for (const x of F) ty[x.type] = (ty[x.type] ?? 0) + 1;
    out.push(`| ${sw} | ${kind} · ${gn} | ${R.length} | ${f(med(R.map((r) => r.tip)), 0)} | ${f(med(R.map((r) => r.hand)), 0)} | ${f(med(R.map((r) => r.vMax)), 1)} | ${f(med(R.map((r) => r.tV)))} | ${f(med(R.map((r) => r.tTouch)))} | ${Object.entries(ty).map(([a, b]) => `${a} ${b}`).join(' · ') || '–'} · ${f(med(F.map((x) => x.E)), 0)} (${f(med(F.map((x) => x.E1)), 0)}) | ${R.reduce((s, r) => s + r.judged, 0)} / ${R.reduce((s, r) => s + r.under, 0)} | ${R.reduce((s, r) => s + r.stuck, 0)} | ${f(R.reduce((s, r) => s + r.sev, 0) / R.length)} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  for (const kv of arg('set', '').split(',').filter(Boolean)) {
    const [k, v] = kv.split('=');
    const p = k.split('.');
    const o = p.slice(0, -1).reduce((a, x) => a[x], CONFIG);
    o[p.at(-1)] = Number.isNaN(+v) ? v : +v;
  }
  const cells = arg('cells', 'german:longsword,italian:rapier,iberian:zweihander,japanese:uchigatana,chinese:hwando').split(',');
  const kinds = arg('kinds', 'tap,stich,cut').split(',');
  const [s0, s1] = arg('seeds', '1-3').split('-').map(Number);
  const gaps = arg('gap', 'air,reach').split(',');
  const rows = [];
  for (const c of cells) for (const kind of kinds) for (const gap of gaps) for (let s = s0; s <= (s1 ?? s0); s++) {
    const [school, weapon] = c.split(':');
    const r = strokeRun({ school, weapon, kind, seed: s, gap });
    rows.push(r);
    console.error(JSON.stringify(r));
  }
  console.log(table(rows));
}
