// ─────────────────────────────────────────────────────────────
//  ib_link_bridge.mjs — 이어 돌리기 넘기기 잣대 셋 (11/15 사장님 "이 스킬이 없을 때보다 공격 연계가 빠르고 강하고 자연스러우려면 … 최소의 동작" — 기록 §12)
//   서 있는 과녁(상대 몸 — AI 끔 · 안 죽음) 앞 · 사람 손가락 봇: 큰 칼 A → 손가락을 뗀 뒤 gap 실제 초에 다음 칼 B.
//    켬(IB_LINK.on 1 · 넘기기 판) = B 의 방향만 긋기(시작 자리로 가지 않음 — 게임이 넘김) · 끔(IB_LINK.on 0) = 사람이 하던 대로 B 시작 자리로 손을 옮기고(자세로 돌아가는 빠르기 ·
//    4 프레임 멈춤 — school_balance strokeQ 와 같은 손) 긋기.
//   ① A 손가락 끝 → B 가 과녁에 맞는 순간(실제 s) ② 그 순간 칼끝 빠르기(m/s) · 판정 에너지(J — combat analyze energy · 사슬 위력 배율은 따로)
//   ③ 그 사이 칼끝 빠르기 가장 낮음(m/s) · 스텝마다 칼끝 · 손 옮김 가장 큼(cm — 튐: 칼끝 30 cm · 손 10 cm 넘는 스텝 수)
//  node tools/sim/ib_link_bridge.mjs table [--ws=zweihander] [--gap=0.1] [--set=…]    (큰 칼 다섯 × 다섯 · 켬 · 끔)
//  node tools/sim/ib_link_bridge.mjs one --a=zornhau --b=zwerch [--on=1] [--json=…]   (한 벌 · 스텝 줄 — 그림)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE, AI } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { kitFromNodes, allNodeIds } from '../../src/skill_tree_data.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { isMain } from './is_main.mjs';
import { applySets } from './ib_link.mjs';

const { SKILL, IB_LINK } = CONFIG;
const K = CONFIG.TIME.k;
const FRAME = 1 / 60;
const SPF = Math.max(1, Math.round((FRAME * K) / DT));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export const BIG = ['zornhau', 'zornhauL', 'oberhau', 'zwerch', 'zwerchL'];

function line(from, to, v) {
  const out = [];
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(1, Math.round(d / v / FRAME));
  for (let i = 0; i < n; i++) out.push([(to[0] - from[0]) / n, (to[1] - from[1]) / n]);
  return out;
}
function swipeOf(name, v) {
  const t = TECH_BY_NAME[name];
  const pts = [t.from, ...t.path];
  const out = [];
  for (let i = 0; i + 1 < pts.length; i++) out.push(...line(pts[i], pts[i + 1], v));
  return out;
}
const bodyPts = (P) => {
  const p = (b) => {
    const x = P.bodies[b]?.translation();
    return x ? [r3(x.x), r3(x.y), r3(x.z)] : null;
  };
  return { head: p('head'), chest: p('chest'), pelvis: p('pelvis'), uarmS: p('uarmS'), farmS: p('farmS'), uarmO: p('uarmO'), farmO: p('farmO'), thighF: p('thighF'), thighB: p('thighB'), shinF: p('shinF'), shinB: p('shinB'), footF: p('footF'), footB: p('footB') };
};
const yawOf = (b) => {
  const q = b.rotation();
  const v = new THREE.Vector3(1, 0, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
  return Math.atan2(-v.z, v.x);
};

export function bridgeOne({ ws = 'zweihander', a = 'zornhau', b = 'zwerch', on = 1, gap = 0.1, v = 5.5, dist = 1.9, seed = 1, rows = false } = {}) {
  const on0 = IB_LINK.on;
  IB_LINK.on = on;
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
  const A = TECH_BY_NAME[a];
  const B = TECH_BY_NAME[b];
  const q = [];
  for (let i = 0; i < Math.round(0.6 / FRAME); i++) q.push([0, 0]);
  q.push(...line([P.handOffset.x, P.handOffset.y], A.from, 1.0));
  for (let i = 0; i < 6; i++) q.push([0, 0]);
  q.push(...swipeOf(a, v));
  const nEndA = q.length;
  for (let i = 0; i < Math.round(gap / FRAME); i++) q.push([0, 0]);
  const nIn = q.length;
  let nSw = -1; // 다음 칼 긋기가 시작되는 프레임 (끔)
  let tSw = null; // 다음 칼 긋기 시작 (끔 = 그 프레임 · 켬 = 넘기기가 끝나 받아 둔 긋기를 그을 때 · 넘기기가 없으면 입력 시각)
  let frame = 0;
  let k = 0;
  let t = 0;
  let tEndA = null;
  let tIn = null;
  const hits = [];
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === P && vic === E) hits.push({ t, energy: r.energy, sev: r.type === 'blunt' ? 0 : r.severity, zone: r.zone, type: r.type, vt: tipV });
  };
  const tip = new THREE.Vector3();
  const tipPrev = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const handPrev = new THREE.Vector3();
  let have = false;
  let tipV = 0;
  const steps = [];
  G.before = () => {
    if (k++ % SPF === 0) {
      if (frame === nIn) {
        tIn = t;
        if (on) q.push(...swipeOf(b, v));
        else {
          q.push(...line([P.handOffset.x, P.handOffset.y], B.from, SKILL.recoverSpeed));
          for (let i = 0; i < 4; i++) q.push([0, 0]);
          nSw = frame + q.length; // 끔: 긋기가 시작되는 프레임 (그 앞 자세로 옮기는 손이 상대 몸을 스친 것은 다음 칼 맞음이 아님)
          q.push(...swipeOf(b, v));
        }
      }
      const d = q.shift() ?? [0, 0];
      uq.feed(d[0], d[1], FRAME, false);
      P.handOffset.x += d[0];
      P.handOffset.y += d[1];
      P.handHeld = q.length > 0;
      P.inputActive = Math.abs(d[0]) + Math.abs(d[1]) > 1e-5;
      frame++;
    }
    P.move.set(0, 0);
    P.stickX = P.stickY = 0;
  };
  const t0 = G.t;
  let link = null;
  try {
    while (t < 6) {
      G.step();
      t = (G.t - t0) / K;
      if (tEndA == null && frame >= nEndA) tEndA = t;
      if (tSw == null && !on && nSw >= 0 && frame >= nSw) tSw = t;
      P.bladePoint(1, tip);
      const sw = P.sword.translation();
      hand.set(sw.x, sw.y, sw.z);
      const dTip = have ? tip.distanceTo(tipPrev) : 0;
      const dHand = have ? hand.distanceTo(handPrev) : 0;
      tipV = dTip / (DT / K);
      tipPrev.copy(tip);
      handPrev.copy(hand);
      have = true;
      if (P.ibLink && !link) link = { t0: t, T: r3(P.ibLink.T / K), len: r3(P.ibLink.bridge?.len ?? null) };
      if (link && !link.t1 && !P.ibLink) (link.t1 = t), on && tSw == null && (tSw = t);
      if (on && tSw == null && !link && tIn != null && t > tIn + 0.15 && !uq.link) tSw = tIn; // 켬인데 넘기기가 없음 (그대로 그은 칼)
      if (tEndA != null) steps.push({ t, vt: tipV, dTip, dHand, link: !!P.ibLink, x: P.ibLink?.x ?? null, wfix: P.ibLink && !P.ibLink.bridge ? P.wristFixDeg ?? 0 : 0, yawC: yawOf(P.bodies.chest), yawP: yawOf(P.bodies.pelvis), ...(rows ? { tip: [r3(tip.x), r3(tip.y), r3(tip.z)], hand: [r3(hand.x), r3(hand.y), r3(hand.z)], b0: (() => { const x = P.bladePoint(0, new THREE.Vector3()); return [r3(x.x), r3(x.y), r3(x.z)]; })(), body: bodyPts(P) } : {}) });
      if (tSw != null && t > tSw + 0.9) break;
    }
  } finally {
    G.world.free();
    IB_LINK.on = on0;
  }
  const hB = hits.find((h) => tSw != null && h.t >= tSw && h.t <= tSw + 0.6) ?? null; // 다음 칼 긋기 시작 뒤 0.6 s 안 첫 맞음
  const hA = hits.find((h) => h.t <= (tIn ?? Infinity)) ?? null;
  // 다음 칼이 가장 빠른 때 (과녁과 상관없는 '치는 순간' — 다음 칼 긋기 시작 뒤 0.6 s 안 칼끝 빠르기 가장 큼)
  const win = steps.filter((s) => tSw != null && s.t >= tSw && s.t <= tSw + 0.6);
  const pk = win.length ? win.reduce((m, s) => (s.vt > m.vt ? s : m), win[0]) : null;
  const tE = hB?.t ?? pk?.t ?? null;
  const span = steps.filter((s) => s.t >= tEndA && (tE == null || s.t <= Math.min(tE, pk?.t ?? tE)));
  const vmin = span.length ? Math.min(...span.map((s) => s.vt)) : null;
  const jT = span.filter((s) => s.dTip > 0.3).length;
  const jH = span.filter((s) => s.dHand > 0.1).length;
  const mT = span.length ? Math.max(...span.map((s) => s.dTip)) : null;
  const mH = span.length ? Math.max(...span.map((s) => s.dHand)) : null;
  return { ws, a, b, on, gap, tEndA: r3(tEndA), tIn: r3(tIn), tSw: r3(tSw), hitA: hA ? { t: r3(hA.t), e: r3(hA.energy) } : null, hitB: hB ? { t: r3(hB.t), e: r3(hB.energy), vt: r3(hB.vt), zone: hB.zone, sev: r3(hB.sev) } : null, dt: hB ? r3(hB.t - tEndA) : null, peak: pk ? { t: r3(pk.t), dt: r3(pk.t - tEndA), vt: r3(pk.vt) } : null, vmin: r3(vmin), jumpTip: jT, jumpHand: jH, maxTip: r3(mT), maxHand: r3(mH), link: link ? { ...link, t0: r3(link.t0), t1: r3(link.t1) } : null, ...(rows ? { steps } : {}) };
}

/**
 * AI 이어 돌리기 한 번의 스텝 줄 (그림 — AI 이베리아(적 자리 ws) 대 롱소드 AI · 둘 다 숙련 5 · 벽): 첫 이어 돌리기 0.3 s 앞부터 끝 뒤 0.6 s 까지 ·
 *  같은 꼴(steps · tEndA = 이어 돌리기 시작 · hitB = 그 뒤 첫 맞음)이라 그림 도구가 그대로 읽음
 */
export function aiTrace({ ws = 'zweihander', seed = 3, prof = 5, dur = 30 } = {}) {
  const G = newRound({ walls: true, seed, weapon: 'longsword', weapon2: ws, AI2Class: AI, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const P = G.player;
  const E = G.enemy;
  const hits = [];
  let t = 0;
  let tipV = 0;
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (att === E && vic === P) hits.push({ t, energy: r.energy, vt: tipV, zone: r.zone });
  };
  const tip = new THREE.Vector3();
  const tipPrev = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const handPrev = new THREE.Vector3();
  let have = false;
  const buf = [];
  let link = null;
  const t0 = G.t;
  try {
    while (t < dur && P.alive && E.alive) {
      G.step();
      t = (G.t - t0) / K;
      E.bladePoint(1, tip);
      const sw = E.sword.translation();
      hand.set(sw.x, sw.y, sw.z);
      const dTip = have ? tip.distanceTo(tipPrev) : 0;
      const dHand = have ? hand.distanceTo(handPrev) : 0;
      tipV = dTip / (DT / K);
      tipPrev.copy(tip);
      handPrev.copy(hand);
      have = true;
      buf.push({ t, vt: tipV, dTip, dHand, link: !!E.ibLink, wfix: E.ibLink && !E.ibLink.bridge ? E.wristFixDeg ?? 0 : 0, yawC: yawOf(E.bodies.chest), yawP: yawOf(E.bodies.pelvis), tip: [r3(tip.x), r3(tip.y), r3(tip.z)], hand: [r3(hand.x), r3(hand.y), r3(hand.z)], body: bodyPts(E) });
      if (buf.length > 400) buf.shift();
      if (E.ibLink && !link) link = { t0: t };
      if (link && !link.t1 && !E.ibLink) link.t1 = t;
      if (link?.t1 && t > link.t1 + 0.6) break;
    }
  } finally {
    G.world.free();
  }
  if (!link) return null;
  const steps = buf.filter((s) => s.t >= link.t0 - 0.3);
  const hB = hits.find((h) => h.t >= link.t0) ?? null;
  const span = steps.filter((s) => s.t >= link.t0 - 0.05 && s.t <= (link.t1 ?? link.t0) + 0.3);
  return { ws, seed, ai: true, tEndA: r3(link.t0), link: { t0: r3(link.t0), t1: r3(link.t1), T: link.t1 ? r3(link.t1 - link.t0) : null }, hitB: hB ? { t: r3(hB.t), e: r3(hB.energy), vt: r3(hB.vt), zone: hB.zone } : null, dt: hB ? r3(hB.t - link.t0) : null, vmin: r3(Math.min(...span.map((s) => s.vt))), jumpTip: span.filter((s) => s.dTip > 0.3).length, jumpHand: span.filter((s) => s.dHand > 0.1).length, maxTip: r3(Math.max(...span.map((s) => s.dTip))), maxHand: r3(Math.max(...span.map((s) => s.dHand))), steps };
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => {
    const a = rest.find((x) => x.startsWith(`--${k}=`));
    return a ? a.slice(k.length + 3) : d;
  };
  applySets(arg('set', ''));
  if (mode === 'one') {
    const r = bridgeOne({ ws: arg('ws', 'zweihander'), a: arg('a', 'zornhau'), b: arg('b', 'zwerch'), on: +arg('on', 1), gap: +arg('gap', 0.1), dist: +arg('dist', 1.9), rows: true });
    if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(r));
    const { steps, ...o } = r;
    console.log(JSON.stringify(o));
  } else if (mode === 'ai') {
    const r = aiTrace({ ws: arg('ws', 'zweihander'), seed: +arg('seed', 3) });
    if (arg('json', null) && r) writeFileSync(arg('json'), JSON.stringify(r));
    if (!r) console.log('null');
    else {
      const { steps, ...o } = r;
      console.log(JSON.stringify(o));
    }
  } else if (mode === 'table') {
    const ws = arg('ws', 'zweihander');
    const gap = +arg('gap', 0.1);
    const dist = +arg('dist', 1.9);
    const out = ['| A → B | 끔: ① 가장 빠른 때까지 s · ② 가장 빠름 m/s · ③ 가장 낮음 m/s · 맞음 J | 켬: ① · ② · ③ · 맞음 J · 넘기기 s | ① 빨라짐 s | ② × | 켬 튐 (칼끝 · 손 스텝) |', '|---|---|---|---:|---:|---|'];
    const all = [];
    for (const a of BIG) for (const b of BIG) {
      const off = bridgeOne({ ws, a, b, on: 0, gap, dist });
      const onr = bridgeOne({ ws, a, b, on: 1, gap, dist });
      all.push({ off, on: onr });
      const f = (r) => `${r.peak?.dt ?? '—'} · ${r.peak?.vt ?? '—'} · ${r.vmin} · ${r.hitB ? r.hitB.e : '안 맞음'}`;
      out.push(`| ${a} → ${b} | ${f(off)} | ${f(onr)} · ${onr.link ? onr.link.T : '—'} | ${off.peak && onr.peak ? r3(off.peak.dt - onr.peak.dt) : '—'} | ${off.peak && onr.peak ? r3(onr.peak.vt / off.peak.vt) : '—'} | ${onr.jumpTip} · ${onr.jumpHand} (가장 ${Math.round((onr.maxTip ?? 0) * 100)} · ${Math.round((onr.maxHand ?? 0) * 100)} cm) |`);
    }
    const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const pk = all.filter((x) => x.off.peak && x.on.peak);
    const hb = all.filter((x) => x.off.hitB && x.on.hitB);
    out.push('', `① 가장 빠른 때까지 끔 ${r3(mean(pk.map((x) => x.off.peak.dt)))} → 켬 ${r3(mean(pk.map((x) => x.on.peak.dt)))} s (켬이 빠른 짝 ${pk.filter((x) => x.on.peak.dt < x.off.peak.dt).length} / ${pk.length}) · ② 가장 빠름 ${r3(mean(pk.map((x) => x.off.peak.vt)))} → ${r3(mean(pk.map((x) => x.on.peak.vt)))} m/s (켬이 센 짝 ${pk.filter((x) => x.on.peak.vt > x.off.peak.vt).length}) · ③ 가장 낮음 ${r3(mean(all.map((x) => x.off.vmin)))} → ${r3(mean(all.map((x) => x.on.vmin)))} m/s (켬이 높은 짝 ${all.filter((x) => x.on.vmin > x.off.vmin).length}) · 맞음 끔 ${all.filter((x) => x.off.hitB).length} · 켬 ${all.filter((x) => x.on.hitB).length} / ${all.length} — 둘 다 맞은 ${hb.length} 짝 에너지 ${r3(mean(hb.map((x) => x.off.hitB.e)))} → ${r3(mean(hb.map((x) => x.on.hitB.e)))} J · 켬 튐 스텝 ${all.reduce((s, x) => s + x.on.jumpTip + x.on.jumpHand, 0)}`);
    if (arg('json', null)) writeFileSync(arg('json'), JSON.stringify(all));
    console.log(out.join('\n'));
  }
}
