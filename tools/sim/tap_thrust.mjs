// 탭 찌르기가 '찌르기'로 들어가는가 — 측정 도구
//  플레이어가 화면을 톡 친 것처럼 skill.thrust() 를 부르고, 그 뒤 0.6초 안에 상대 몸에 처음 닿은 판정
//  (찌르기/베기/둔기, 에너지, 칼축 방향 움직임 along, 부위, 상처)을 센다. 상대 칼에 먼저 막혔는지도 본다.
//   stand  : 가만히 선 상대 (칼을 바보 자세로 내림 = 길이 열림, 또는 쟁기 자세로 겨눔)
//   down   : 쓰러진 상대 (내려찍기 겨눔 자세에서 탭 → 아래로 찌르기)
//   duel   : AI 와 대결하며 간격에 들어오면 톡 친다 (스크립트 플레이어)
//  사용법: node tools/sim/tap_thrust.mjs [stand|down|duel|all] [판 수] [무기 id] [--str=0.85] [--emo=off] [--emoP=anger:1] …
//   근력·감정 옵션은 str_emo.mjs 참고 (찌르는 쪽 = 플레이어)
import { newRound, DT, THREE, V, AI } from './harness_m.mjs';
import { torsoDist } from './down_hits.mjs';
import { strEmoOpts, applyStrEmo, strEmoLabel } from './str_emo.mjs';

const G_PAD = { pflug: [0.18, -0.28], ochs: [0.22, 0.26], langort: [0.0, 0.03] };

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  f.skill.prev.set(xy[0], xy[1]);
  f.skill.aim.set(xy[0], xy[1]);
  f.skill.aimRaw.set(xy[0], xy[1]);
  f.skill.anchor?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}

/** 플레이어의 칼이 상대 몸·칼에 닿는 것을 기록한다 */
function watch(G) {
  const P = G.player;
  const log = [];
  const C = G.combat;
  const orig = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (pr.w.fighter === P && r) {
      const S = P.cache?.sword;
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(S.q);
      log.push({ t: G.t, part: pr.v.part, wpart: pr.w.part, type: r.type, zone: r.zone, energy: r.energy, severity: r.severity, speed: r.speed, tb: r.t, along: r.dir.dot(axis) });
    }
    return r;
  };
  const clashes = [];
  const oc = C.hooks.onClash;
  C.hooks.onClash = (...a) => {
    clashes.push(G.t);
    return oc?.(...a);
  };
  return { log, clashes };
}

/** 톡 친 뒤 0.6초 동안 본다 → 처음 몸에 닿은 판정 */
function afterTap(G, W, t0, extra) {
  const P = G.player;
  const w0 = G.wounds.length;
  for (let i = 0; i < 0.6 / DT; i++) {
    extra?.();
    G.step();
  }
  const hits = W.log.filter((l) => l.t >= t0);
  const first = hits[0] ?? null;
  const ws = myWounds(G, P, w0);
  const clashed = W.clashes.some((t) => t >= t0 && (!first || t < first.t));
  return { first, wound: ws.length > 0, sev: maxSev(ws), stabSev: maxSev(ws.filter((w) => w.type === 'stab')), clashed, stab: hits.some((h) => h.type === 'stab') };
}

/** w0 뒤로 P 가 낸 베기·찌르기 상처 */
const myWounds = (G, P, w0) => G.wounds.slice(w0).filter((w) => w.att === P && (w.type === 'cut' || w.type === 'stab') && w.severity > 0);
const maxSev = (ws) => ws.reduce((m, w) => Math.max(m, w.severity), 0);

export function standTrial({ gap, pad, foePad, seed, weapon, before }) {
  const G = newRound({ walls: false, gap, seed, weapon, weapon2: 'longsword' });
  G.ai.update = () => {};
  before?.(G);
  const P = G.player;
  const E = G.enemy;
  setHand(P, pad);
  setHand(E, foePad);
  const W = watch(G);
  for (let i = 0; i < 2.0 / DT; i++) {
    P.move.set(0, 0);
    G.step();
  }
  const d0 = P.foeDistance();
  const t0 = G.t;
  P.skill.thrust();
  const r = afterTap(G, W, t0, () => P.move.set(0, 0));
  return { gap, d0, ...r };
}

export function downTrial({ dist, seed, weapon, before }) {
  const G = newRound({ walls: false, gap: 2.4, seed, weapon, weapon2: 'longsword' });
  G.ai.update = () => {};
  before?.(G);
  const P = G.player;
  const E = G.enemy;
  setHand(P, G_PAD.pflug);
  E.knockDown(true);
  E.downTime = 1e9;
  const a = Math.PI + (Math.random() - 0.5) * 2.5; // 대체로 뒤·옆으로 눕는다
  for (let i = 0; i < 2.5 / DT; i++) {
    if (i * DT < 0.25) for (const k of ['chest', 'head']) E.bodies[k].applyImpulse({ x: Math.cos(a) * 40 * DT * 4, y: 0, z: Math.sin(a) * 40 * DT * 4 }, true);
    P.move.set(0, 0);
    G.step();
  }
  for (const [tol, mx] of [[0.12, 0.5], [0.03, 0.22]]) {
    for (let i = 0; i < 5 / DT; i++) {
      const d = torsoDist(P, E);
      if (Math.abs(d - dist) < tol) break;
      P.move.set(0, THREE.MathUtils.clamp((d - dist) * 2.5, -mx, mx));
      G.step();
    }
    for (let i = 0; i < 0.6 / DT; i++) {
      P.move.set(0, 0);
      G.step();
    }
  }
  for (let i = 0; i < 0.8 / DT; i++) {
    P.move.set(0, 0);
    G.step();
  }
  const W = watch(G);
  const d0 = torsoDist(P, E);
  const t0 = G.t;
  P.skill.thrust();
  const r = afterTap(G, W, t0, () => P.move.set(0, 0));
  return { dist, d0, fin: P.finish.amt, ...r };
}

/** AI 와 대결: 스크립트 플레이어가 쟁기 자세로 간격을 재다가 닿을 거리면 톡 친다 */
export function duelTrial({ seed, weapon, secs = 30, before }) {
  const G = newRound({ walls: true, gap: 3, seed, weapon, weapon2: 'longsword' });
  before?.(G);
  const P = G.player;
  const E = G.enemy;
  setHand(P, G_PAD.pflug);
  const W = watch(G);
  const taps = [];
  let cool = 0;
  let open = null;
  for (let i = 0; i < secs / DT && P.alive && E.alive; i++) {
    const d = P.foeDistance();
    // 걷기: 1.6m 쯤을 지킨다 (다가오면 물러나고 멀면 다가간다)
    P.move.set(0, P.state === 'stand' ? THREE.MathUtils.clamp((d - 1.65) * 2, -0.6, 0.6) : 0);
    cool -= DT;
    if (!open && cool <= 0 && d < 1.95 && P.state === 'stand' && P.skill.thrust()) {
      open = { t0: G.t, w0: G.wounds.length, d0: d };
      cool = 0.9;
    }
    G.step();
    if (open && G.t - open.t0 > 0.6) {
      const hits = W.log.filter((l) => l.t >= open.t0 && l.t < open.t0 + 0.6);
      const first = hits.find((h) => h.part !== undefined) ?? null;
      const ws = myWounds(G, P, open.w0);
      const clashed = W.clashes.some((t) => t >= open.t0 && t < open.t0 + 0.6 && (!first || t < first.t));
      taps.push({ d0: open.d0, first, wound: ws.length > 0, sev: maxSev(ws), stabSev: maxSev(ws.filter((w) => w.type === 'stab')), clashed, stab: hits.some((h) => h.type === 'stab') });
      open = null;
    }
  }
  return { taps, playerAlive: P.alive, enemyAlive: E.alive };
}

function summary(label, rs) {
  const n = rs.length;
  const touched = rs.filter((r) => r.first);
  const stab = rs.filter((r) => r.stab).length;
  const firstStab = touched.filter((r) => r.first.type === 'stab').length;
  const wound = rs.filter((r) => r.wound).length;
  const clashed = rs.filter((r) => r.clashed).length;
  const avg = (a, k) => (a.length ? (a.reduce((s, r) => s + r.first[k], 0) / a.length).toFixed(2) : '-');
  const mean = (a) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : '-');
  const stabbed = rs.filter((r) => r.stabSev > 0);
  console.log(
    `${label.padEnd(26)} 탭 ${String(n).padStart(3)} · 몸에 닿음 ${touched.length} · 첫 접촉이 찌르기 ${firstStab}/${touched.length} (${touched.length ? Math.round((100 * firstStab) / touched.length) : 0}%) · 찌르기 판정 있음 ${stab} · 상처 ${wound} (${Math.round((100 * wound) / Math.max(1, n))}%) · 칼에 먼저 막힘 ${clashed} · 첫 접촉 평균 E ${avg(touched, 'energy')} v ${avg(touched, 'speed')} along ${avg(touched, 'along')}`,
  );
  // 상처 깊이(severity): 상처 낸 탭의 가장 깊은 상처 평균 / 찌르기 상처만
  console.log(`   상처 깊이 평균 ${mean(rs.filter((r) => r.wound).map((r) => r.sev))} · 찌르기 상처 ${stabbed.length}번 깊이 평균 ${mean(stabbed.map((r) => r.stabSev))}`);
  const types = {};
  for (const r of touched) types[`${r.first.type}:${r.first.zone}`] = (types[`${r.first.type}:${r.first.zone}`] || 0) + 1;
  console.log(`   첫 접촉 종류: ${JSON.stringify(types)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const mode = pos[0] || 'all';
  const N = +(pos[1] || 3);
  const weapon = pos[2] || undefined;
  const SE = strEmoOpts(args);
  const before = (G) => applyStrEmo(G, SE);
  console.log(`무기 ${weapon ?? 'longsword'} · ${strEmoLabel(SE)}`);
  const out = {};
  if (mode === 'stand' || mode === 'all') {
    for (const [pad, foePad, label] of [
      [G_PAD.pflug, [0.0, -0.5], '쟁기→ 칼 내린 상대'],
      [G_PAD.ochs, [0.0, -0.5], '황소(머리)→ 칼 내린 상대'],
      [G_PAD.pflug, G_PAD.pflug, '쟁기→ 쟁기로 겨눈 상대'],
    ]) {
      const rs = [];
      for (const gap of [1.5, 1.7, 1.9, 2.1, 2.3]) for (let s = 1; s <= N; s++) rs.push(standTrial({ gap, pad, foePad, seed: 300 + s * 11 + Math.round(gap * 10), weapon, before }));
      summary(label, rs);
      out[label] = rs.map((r) => ({ d0: +r.d0.toFixed(2), type: r.first?.type ?? null, wound: r.wound, sev: +r.sev.toFixed(2), clashed: r.clashed }));
    }
  }
  if (mode === 'down' || mode === 'all') {
    const rs = [];
    for (const dist of [0.55, 0.75, 0.95, 1.15, 1.3]) for (let s = 1; s <= N; s++) rs.push(downTrial({ dist, seed: 500 + s * 17 + Math.round(dist * 100), weapon, before }));
    summary('쓰러진 상대 (아래로 찌르기)', rs);
    out.down = rs.map((r) => ({ d0: +r.d0.toFixed(2), type: r.first?.type ?? null, wound: r.wound, sev: +r.sev.toFixed(2) }));
  }
  if (mode === 'duel' || mode === 'all') {
    const taps = [];
    for (let s = 1; s <= N; s++) taps.push(...duelTrial({ seed: 40 + s, weapon, before }).taps);
    summary('AI 와 대결 중', taps);
    out.duel = taps.map((r) => ({ d0: +r.d0.toFixed(2), type: r.first?.type ?? null, wound: r.wound, sev: +r.sev.toFixed(2), clashed: r.clashed }));
  }
  console.log(JSON.stringify(out));
}
