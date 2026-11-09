// ─────────────────────────────────────────────────────────────
//  fc_gain_edge.mjs — 손가락 긋기 감도 바닥 재기 (사장님 11/09 '감도 2배는 두되 손이 원 바닥에 닿기 전에서 멈추게 해' · 기록 docs/strike/fc_gain_edge_2026-11-09.md)
//   재기만 — 게임 값은 이 프로세스 안에서만 (--fc · --floor)
//   line (기본) — 제비 베기 곧은 길 판(tsubame_trace.mjs traceRun 'line' — 가만히 선 상대 · 손가락 그대로) 가슴 사이 × 씨앗마다:
//        내려 긋는 동안 손 목표(패드) 가장 낮은 높이 · 원 끝(반지름 WEAPON.reach)에 닿았나(닿은 높이) · 되돌림 칼이 난 때 패드 높이 · 그때 손 목표(fighter.handTarget — 가슴 기준 몸 틀) ·
//        tsubame_snap.test.mjs '곧은 길 꼴' 잣대 모두(칼끝 · 잔상 devShare < 0.12 · 꺾임 < 15° · 손목 · 굴림 · 날 앞장 ≥ 80 % · 첫 맞음 몸통 날 — fc_arm_reach 와 같은 30 판 꼴)
//   air — 허공 긋기 칼끝 · 손 가장 빠름 (finger_cut.mjs airSwing — 분노의 베기 길 · 정수리 베기 길 [지붕 → 바보] · 손가락 3 · 4.5 · 6 패드 m/s · 롱소드 · 우치가타나)
//   feel — 크게 그은 손가락(지붕 → 패드 −1.2 — 화면 끝까지 내려 끎 · 4.5 패드 m/s): 스텝마다 패드 · 걸러진 손 목표 높이 · 손 목표 빠르기 · 칼끝 빠르기 — 멈춤이 툭 끊기나
//  node tools/sim/fc_gain_edge.mjs [line|air|feel] [--fc=팔 힘,감도] [--floor=-0.5|none] [--gaps=1.1,1.15,1.2,1.25,1.3] [--seeds=6] [-v]
// ─────────────────────────────────────────────────────────────
import { CONFIG, THREE, DT, newRound } from './harness_m.mjs';
import { traceRun, bend, bendTrail } from './tsubame_trace.mjs';
import { airSwing } from './finger_cut.mjs';
import { HUMAN } from '../../src/fighter.js';
import { G as GU } from '../../src/ai_techniques.js';
import { isMain } from './is_main.mjs';

const r3 = (x) => (x == null ? null : +x.toFixed(3));
const R = CONFIG.WEAPON.reach;

/** 한 판: 패드 가장 낮음 · 원 끝 닿음 · 되돌림 칼 날 때 패드 · 손 목표 · 시험 잣대 못 넘은 까닭 (빈 배열 = 모두 넘음) */
export function edgeRun(seed, gap, low = null) {
  const k = CONFIG.STRIKE.edgeAlign;
  let snapped = false;
  let padMin = 9;
  let edgeY = null;
  let snapPad = null;
  let snapTgt = null;
  const tr = traceRun('line', seed, gap, {
    ...(low != null ? { low } : {}),
    onStep(G, P) {
      if (snapped) return;
      if (P.iai) {
        snapped = true;
        snapPad = [r3(P.handOffset.x), r3(P.handOffset.y)];
        const inv = P.yaw.clone().invert();
        const c = P.bodies.chest.translation();
        const T = P.handTarget.clone().sub(new THREE.Vector3(c.x, c.y, c.z)).applyQuaternion(inv);
        snapTgt = [r3(T.x), r3(T.y), r3(T.z)];
        return;
      }
      if (G.t > 1.2 && P.handHeld) {
        padMin = Math.min(padMin, P.handOffset.y);
        if (edgeY == null && P.handOffset.length() > R - 0.005) edgeY = r3(P.handOffset.y);
      }
    },
  });
  const why = [];
  let b = null;
  let t = null;
  if (!tr.fired) why.push('안 남');
  else {
    b = bend(tr);
    t = bendTrail(tr);
    if (!(b && b.devShare < 0.12 && b.kinkDeg < 15)) why.push('칼끝');
    if (!(t && t.devShare < 0.12 && t.kinkDeg < 15)) why.push('잔상');
    const W = tr.wr.filter((w) => w && w[1]);
    if (!W.every((w) => w[3] <= 1)) why.push('손목');
    if (!W.every((w) => w[2] <= HUMAN.forearmRoll + 1)) why.push('굴림');
    if (!(W.filter((w) => w[5] > k).length >= 0.8 * W.length)) why.push('날 앞장');
    const h = tr.hits[0];
    if (!(h && ['pelvis', 'abdomen', 'chest'].includes(h.part) && h.edge > k)) why.push(`첫 맞음 ${h?.part ?? '없음'}`);
  }
  return { seed, gap, padMin: r3(padMin), edgeY, snapPad, snapTgt, tip: b && [b.devShare, b.kinkDeg], trail: t && [t.devShare, t.kinkDeg], bandDy: tr.bandDy, why };
}

/** 크게 그은 손가락 하나 (feel): 지붕(G.tag)에서 쉼 → 패드 −1.2 까지 곧장 아래로 v 패드 m/s → 0.5 s 댄 채. 스텝마다 [t, 패드 y, 걸러진 손 목표 y, 손 목표 빠르기, 칼끝 빠르기] */
export function feelRun({ weapon = 'longsword', school = 'german', v = 4.5, to = -1.2, seed = 1 } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2: 'longsword', onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  G.ai.update = () => G.enemy.move.set(0, 0);
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const FRAME = 2 * DT;
  const A = GU.tag;
  const legs = [[null, 2.6], [A, 2], [null, 0.6], [[A[0], to], v, 'cut'], [null, 0.5, 'cut']];
  const rows = [];
  let t0 = null;
  try {
    const fg = [P.handOffset.x, P.handOffset.y];
    for (const [dst, sp, tag] of legs) {
      const off = P.handOffset;
      const n = dst ? Math.max(1, Math.ceil(Math.hypot(dst[0] - fg[0], dst[1] - fg[1]) / sp / FRAME)) : Math.round(sp / FRAME);
      const from = [fg[0], fg[1]];
      for (let i = 1; i <= n; i++) {
        let moved = false;
        if (dst) {
          const nx = from[0] + ((dst[0] - from[0]) * i) / n;
          const ny = from[1] + ((dst[1] - from[1]) * i) / n;
          moved = true;
          off.x += nx - fg[0];
          off.y += ny - fg[1];
          fg[0] = nx;
          fg[1] = ny;
        }
        P.handHeld = true;
        P.inputActive = moved;
        P.move.set(0, 0);
        for (let s = 0; s < 2; s++) {
          G.step();
          if (tag) {
            t0 ??= G.t;
            const tv = P.tipVel.length();
            rows.push([r3(G.t - t0), r3(fg[1]), r3(P.handOffset.y), r3(P.skill.aim.y), r3(P.skill.aimVel.length()), r3(tv)]);
          }
        }
      }
    }
  } finally {
    G.world.free();
  }
  return rows;
}

function setFc(arg) {
  if (arg('fc')) {
    const [a, g] = arg('fc').split(',').map(Number);
    Object.assign(CONFIG.SKILL.fingerCut, { arm: a, gain: g });
  }
  const fl = arg('floor');
  if (fl != null) CONFIG.SKILL.fingerCut.floor = fl === 'none' ? null : +fl;
  const F = CONFIG.SKILL.fingerCut;
  return `팔 힘 ${F.arm} · 감도 ${F.gain} · 바닥 ${F.floor ?? '끔'}`;
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const mode = argv[0] && !argv[0].startsWith('-') ? argv[0] : 'line';
  const arg = (k, d) => { const a = argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const tag = setFc(arg);
  const med = (a) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  if (mode === 'line') {
    const gaps = arg('gaps', '1.1,1.15,1.2,1.25,1.3').split(',').map(Number);
    const seeds = +arg('seeds', 6);
    const rows = [];
    for (const gap of gaps) for (let s = 1; s <= seeds; s++) rows.push(edgeRun(700 + s, gap, arg('low') != null ? +arg('low') : null));
    const why = {};
    for (const r of rows) for (const w of r.why) why[w.split(' ')[0]] = (why[w.split(' ')[0]] ?? 0) + 1;
    console.log(`${tag}: 판 ${rows.length} · 시험 잣대 모두 넘음 ${rows.filter((r) => !r.why.length).length} · 못 넘은 까닭 ${JSON.stringify(why)} · 패드 가장 낮음 가운데 ${med(rows.map((r) => r.padMin))} · 원 끝 닿은 판 ${rows.filter((r) => r.edgeY != null).length} · 날 때 패드 높이 가운데 ${med(rows.map((r) => r.snapPad?.[1]))} · 날 때 손 목표 (앞 · 위) 가운데 ${med(rows.map((r) => r.snapTgt?.[0]))} · ${med(rows.map((r) => r.snapTgt?.[1]))} · 칼끝 휨 가운데 ${med(rows.map((r) => r.tip?.[0]))} · 꺾임 ${med(rows.map((r) => r.tip?.[1]))}° · 띠 옮김 ${rows.filter((r) => r.bandDy).length}`);
    if (argv.includes('-v')) for (const r of rows) console.log('  ', JSON.stringify(r));
  } else if (mode === 'air') {
    const paths = { 분노: [GU.tagR, GU.wechselL], 정수리: [GU.tag, GU.alber] };
    for (const [weapon, school] of [['longsword', 'german'], ['uchigatana', 'japanese']]) {
      for (const [pn, [A, B]] of Object.entries(paths)) {
        const out = [3, 4.5, 6].map((v) => airSwing({ weapon, school, A, B, v }));
        console.log(`${tag} · ${weapon} ${pn}: 칼끝 가장 빠름 ${out.map((o) => o.tip.toFixed(1)).join(' · ')} · 손 ${out.map((o) => o.hand.toFixed(1)).join(' · ')} m/s (손가락 3 · 4.5 · 6 패드 m/s)`);
      }
    }
  } else if (mode === 'feel') {
    for (const [weapon, school] of [['longsword', 'german'], ['uchigatana', 'japanese']]) {
      const rows = feelRun({ weapon, school, v: +arg('v', 4.5) });
      let tipMax = 0;
      let aimMin = 9;
      let dvMax = 0;
      for (let i = 0; i < rows.length; i++) {
        tipMax = Math.max(tipMax, rows[i][5]);
        aimMin = Math.min(aimMin, rows[i][3]);
        if (i > 0) dvMax = Math.max(dvMax, (rows[i - 1][4] - rows[i][4]) / DT);
      }
      const stop = rows.find((r, i) => i > 0 && r[2] === rows[i - 1][2] && r[1] < rows[i - 1][1]);
      console.log(`${tag} · ${weapon}: 패드 멈춤 ${stop ? `${stop[0]} s · 패드 ${stop[2]} (손가락 ${stop[1]})` : '없음'} · 손 목표 가장 낮음 ${r3(aimMin)} · 손 목표 빠르기 가장 크게 줄어듦 ${r3(dvMax)} 패드 m/s² · 칼끝 가장 빠름 ${r3(tipMax)} m/s`);
      if (argv.includes('-v')) for (const r of rows) console.log('  ', JSON.stringify(r));
    }
  }
}
