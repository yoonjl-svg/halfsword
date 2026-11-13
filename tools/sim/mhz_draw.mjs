// ─────────────────────────────────────────────────────────────
//  mhz_draw.mjs — 모노호시자오(앞무게 두손 칼) 고노센 발도 한 손 재기 (사장님 11/13 결정 "본판에 넣어. 원전대로. 곧은 칼 길. 한손으로." —
//   기록 docs/strike/monohoshizao_draw_2026-11-13.md). 재기만 한다 — 게임 값은 --set 으로 이 프로세스 안에서만.
//  shot: 서 있는 과녁(롱소드 AI 생각 끔 — 손 목표를 자세 패드에 묶음)에게 발도 한 번 —
//   hip · held = 사람 발도(iai_real.mjs gnsShot 과 같은 길: 손가락 칼 몸 · PlayerSecretWatch 준비 · skill.secret → requestIai player) ·
//   crouch = AI 발도(웅크린 대기 iaiReadyPose → requestIai — req.player 아님 · 몸은 AI 몸 표시 aiControlled).
//   스텝마다 iai_real.mjs pose()(낸 때 가슴 원점 · 헤딩 틀) + 빈손 목표(offArmIK 에 마지막으로 간 점 — 가슴 몸체 틀) · 칼 손 목표(armIK 마지막 점 — 가슴 몸체 틀) ·
//   빈손 ↔ 칼자루 끝 거리(offHand 의 pommel — 칼 원점 + gripAlong) · 쥠(gripping) · 칼끝 빠르기.
//   요약: 맞음 · 칼끝 길 · 빠르기 · 굳음 칼 · 팔 · 쥠 스텝 수(뽑기 · 굳음 · 풀기) · 다시 쥐기(풀기 끝 → 첫 쥠 · 자리 잡음 — 빈손 ↔ 칼자루 끝이 뽑기 전 거리 + 2 cm 안) ·
//   빈손 목표 튐(이웃 스텝 사이 가장 큰 옮김 · 그 빠르기 — 굳음 끝 앞 0.1 s ~ 뒤 1.5 s) · 칼 손 목표 튐(같은 몫)
//  node tools/sim/mhz_draw.mjs shot [--weapon=monohoshizao] [--guards=langort,ochsR,pflugR] [--start=hip,held] [--gap=0.3] [--after=1.5] [--set=SECRET.x=1,...] [--json=파일] [--trace=1]
//  aifight: AI 대 AI (내 무기 숙련 5 일본 — 비기 고노센 · 상대 롱소드 숙련 3 = school_balance 상대 AI 와 같은 숙련) 씨앗마다 30 s — 이김 · 짐 · 고노센마다 쥠 · 굳음 · 다시 쥠 · 튐 (읽기만)
//  fight: school_balance fightOne 그대로(사람 손가락 봇 · 실제 input.js 터치 길) 꽂개 — 사람 고노센마다 같은 것
//  node tools/sim/mhz_draw.mjs aifight|fight [--weapon=monohoshizao] [--opp=longsword] [--oppProf=3 (aifight)] [--seeds=1-24] [--dur=30] [--set=...] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE, AI } from './harness_m.mjs';
import { applySets } from './rapier_defence.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { iaiReadyPose, requestIai } from '../../src/secret_instant.js';
import { guardsOf, bendPts, pose } from './iai_real.mjs';
import { fightOne } from './school_balance.mjs';
import { isMain } from './is_main.mjs';

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const tv = (t) => new THREE.Vector3(t.x, t.y, t.z);
const tq = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const R2D = 180 / Math.PI;

/** 몸 f 의 가슴 몸체 틀로 (월드 점 → [앞, 위, 칼 든 쪽 +]) */
function chestLocal(f, p) {
  const c = tv(f.bodies.chest.translation());
  const v = p.clone().sub(c).applyQuaternion(tq(f.bodies.chest.rotation()).invert());
  return [v.x, v.y, v.z * f.side];
}
/** offHand 가 쥐는 점 (칼 원점 + 칼 축 × gripAlong) · 빈손 (아래팔 끝) */
function pommelW(f) {
  return new THREE.Vector3(0, f.weaponCfg.gripAlong, 0).applyQuaternion(tq(f.sword.rotation())).add(tv(f.sword.translation()));
}
function offHandW(f) {
  return new THREE.Vector3(0, -0.135, 0).applyQuaternion(tq(f.bodies.farmO.rotation())).add(tv(f.bodies.farmO.translation()));
}
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** 몸 f 의 골반 몸체 틀로 (월드 점 → [앞, 위, 칼 든 쪽 +]) — 칼집 손 자리(SECRET.iaiSayaHip — 골반 틀) 견줌 (11/13 iai_saya) */
function pelvisLocal(f, p) {
  const c = tv(f.bodies.pelvis.translation());
  const v = p.clone().sub(c).applyQuaternion(tq(f.bodies.pelvis.rotation()).invert());
  return [v.x, v.y, v.z * f.side];
}

/** 빈손 · 칼 손 목표 기록: 몸의 offArmIK · armIK 를 감싸 이 스텝 마지막으로 간 점(가슴 몸체 틀)을 남긴다 (게임 셈은 그대로 부름) */
function tapTargets(f) {
  const rec = { off: null, offP: null, arm: null };
  const o = f.offArmIK.bind(f);
  const a = f.armIK.bind(f);
  f.offArmIK = (t) => {
    rec.off = chestLocal(f, t);
    rec.offP = pelvisLocal(f, t);
    return o(t);
  };
  f.armIK = (t, ...rest) => {
    rec.arm = chestLocal(f, t);
    return a(t, ...rest);
  };
  return rec;
}

/**
 * 서 있는 과녁에게 발도 한 번. { frames, sum, hit }
 *  frames: 낸 때부터 굳음 · 풀기 끝 + after s 까지 스텝마다 pose() + { t, ph, cut, offT, armT, gap, grip, tipV }
 */
export function mhzShot({ weapon = 'monohoshizao', foeW = 'longsword', guard = 'langort', start = 'hip', gapAdd = 0.3, seed = 1, after = 1.5 } = {}) {
  const pad = guardsOf(foeW).find((g) => g.name === guard)?.pad;
  if (!pad) throw new Error(`자세 없음 ${foeW} ${guard}`);
  const G0 = newRound({ walls: false, weapon, weapon2: foeW, seed });
  const contact = G0.player.swordArt.measure.contact;
  G0.world.free();
  const ai = start === 'crouch';
  const G = newRound({ walls: false, weapon, weapon2: foeW, seed, gap: contact + gapAdd, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0 && !ai) f.humanInput = true; } });
  const P = G.player;
  const A = G.enemy;
  G.ai.update = () => {
    A.move.set(0, 0);
    A.handOffset.set(pad[0], pad[1]);
  };
  let W = null;
  let fired = false;
  if (ai) {
    P.aiControlled = true; // AI 몸 표시 (fighter.js armClearOn — AI 몸 몫)
    G.before = () => iaiReadyPose(P, !fired, DT); // AI 고노센(숙련 5 일본)의 웅크린 발도 대기 (gns_belly.mjs standShot crouch 와 같음)
  } else {
    P.skill.corr = CONFIG.SKILL.corr;
    P.skill.corrTip = CONFIG.SKILL.corrTip;
    P.skill.autoGuard = true;
    P.canShove = true;
    W = new PlayerSecretWatch(P, A);
    if (W.S?.name !== 'goNoSen') throw new Error(`고노센 아님 ${W.S?.name}`);
    const held = start === 'held';
    G.before = () => {
      if (held) {
        P.handGrip = true;
        P.inputActive = true;
        P.handHeld = true;
      }
      W.update(DT, !!P.skill.sec);
    };
  }
  const rec = tapTargets(P);
  const settle = CONFIG.ARENA.startHold + (ai ? 1.4 : CONFIG.SECRET.iaiArmTime + 0.8);
  let gap0 = [];
  while (G.t < settle) {
    G.step();
    if (G.t > settle - 0.3) gap0.push(pommelW(P).distanceTo(offHandW(P)));
  }
  const pre0 = gap0.reduce((s, x) => s + x, 0) / Math.max(1, gap0.length);
  const c0 = tv(P.bodies.chest.translation());
  const inv = P.yaw.clone().invert();
  const pre = pose(P, c0, inv);
  const preGrip = !!P.gripping;
  const ok = ai ? (requestIai(P, {}), true) : P.skill.secret({ S: W.S, ctx: { ev: 'raise' } });
  fired = true;
  const frames = [];
  const t0 = G.t;
  let I = null;
  let endT = null;
  let freeT = null;
  let prevTip = P.bladePoint(1, new THREE.Vector3());
  for (let i = 0; i < Math.round(6 / DT); i++) {
    rec.off = rec.offP = rec.arm = null;
    G.step();
    if (P.iai && P.iai.kind === 'iai') I = P.iai;
    const ph = P.iai ? 'draw' : P.iaiHoldT > 0 ? 'hold' : P.iaiFade > 0 ? 'fade' : 'free';
    if (ph !== 'draw' && endT == null && I) endT = G.t;
    if (ph === 'free' && freeT == null && endT != null) freeT = G.t;
    const tip = P.bladePoint(1, new THREE.Vector3());
    const pm = pommelW(P);
    const oh = offHandW(P);
    frames.push({
      t: r3(G.t - t0), ph, cut: !!(P.iai && P.iai.u >= (P.iai.hitFrom ?? P.iai.ab)), ...pose(P, c0, inv),
      offT: rec.off && rec.off.map(r3), armT: rec.arm && rec.arm.map(r3), gap: r3(pm.distanceTo(oh)), grip: !!P.gripping,
      ohL: chestLocal(P, oh).map(r3), pmL: chestLocal(P, pm).map(r3), tipV: r3(tip.distanceTo(prevTip) / DT), rgK: P.iaiRegripT > 0 ? r3(1 - P.iaiRegripT / P.iaiRegripDur) : null,
      offP: rec.offP && rec.offP.map(r3), ohP: pelvisLocal(P, oh).map(r3), pmP: pelvisLocal(P, pm).map(r3), // 골반 틀 (칼집 손 자리 견줌 — 11/13 iai_saya)
    });
    prevTip = tip;
    if (freeT != null && G.t - freeT > after) break;
  }
  const res = I?.res;
  const hit = I?.hit ? { part: I.hit.info.part, zone: res?.zone ?? null, type: res?.type ?? null, E: r3(res?.energy), sev: r3(res?.severity) } : null;
  const draw = frames.filter((f) => f.ph === 'draw');
  const cut = frames.filter((f) => f.cut);
  const holdF = frames.filter((f) => f.ph === 'hold');
  const fadeF = frames.filter((f) => f.ph === 'fade');
  const end = draw.at(-1) ?? null;
  const h1 = holdF[Math.min(holdF.length - 1, Math.round(0.3 / DT))] ?? null;
  // 다시 쥐기: 풀기 끝(첫 free 스텝) 뒤
  const iF = frames.findIndex((f) => f.ph === 'free');
  const after1 = iF >= 0 ? frames.slice(iF) : [];
  const gripI = after1.findIndex((f) => f.grip);
  const seatI = after1.findIndex((f) => f.gap != null && f.gap <= pre0 + 0.02);
  // 목표 튐 (굳음 끝 앞 0.1 s ~ 풀기 끝 뒤 1.5 s · 이웃 스텝 사이 가장 큰 옮김)
  const iH = frames.findIndex((f) => f.ph === 'fade');
  const win = frames.slice(Math.max(0, (iH >= 0 ? iH : iF) - Math.round(0.1 / DT)));
  const jump = (k) => {
    let best = { d: 0, t: null };
    for (let i = 1; i < win.length; i++) {
      const a = win[i - 1][k];
      const b = win[i][k];
      if (!a || !b) continue;
      const d = dist3(a, b);
      if (d > best.d) best = { d, t: win[i].t, ph: win[i].ph };
    }
    return { d: r3(best.d), v: r3(best.d / DT), t: best.t, ph: best.ph };
  };
  // 빈손 몸 빠르기 (가슴 몸체 틀 — 다시 쥐는 동안)
  let ohV = 0;
  for (let i = 1; i < Math.min(after1.length, Math.round(1.0 / DT)); i++) ohV = Math.max(ohV, dist3(after1[i - 1].ohL, after1[i].ohL) / DT);
  // 굳음 칼: 칼날 높이 각(°) · 칼끝 높이 · 흔들림 (굳음 0.1 s 뒤 칼끝 빠르기 가장)
  const elev = (f) => r1(Math.atan2(f.tip[1] - f.hi[1], Math.hypot(f.tip[0] - f.hi[0], f.tip[2] - f.hi[2])) * R2D);
  const holdLate = holdF.slice(Math.round(0.1 / DT));
  const sum = {
    armed: ai ? true : !!W.iaiArm?.armed, ok: !!ok, stand: P.state === 'stand', pre0: r3(pre0), preGrip, oneHand: !!I?.oneHand, regrip: !!I?.regrip,
    drawT: endT != null ? r3(endT - t0) : null, holdT: freeT != null && endT != null ? r3(freeT - endT) : null,
    tipCut: bendPts(cut.map((f) => f.tip)), tipVmax: r1(Math.max(...cut.map((f) => f.tipV))),
    grip: { draw: draw.filter((f) => f.grip).length, hold: holdF.filter((f) => f.grip).length, fade: fadeF.filter((f) => f.grip).length, nDraw: draw.length, nHold: holdF.length, nFade: fadeF.length },
    ohdHold: h1 && h1.ohL, ohdEnd: end && end.ohL,
    end: end && { flex: end.flex, ext: end.ext, wr: end.wr, tip: end.tip, elev: elev(end), pitch: end.pitch },
    hold: h1 && { flex: h1.flex, ext: h1.ext, wr: h1.wr, tip: h1.tip, elev: elev(h1), pitch: h1.pitch, chestYaw: h1.chestYaw },
    holdTipY: holdF.length ? [r3(Math.min(...holdF.map((f) => f.tip[1]))), r3(Math.max(...holdF.map((f) => f.tip[1])))] : null,
    holdElev: holdF.length ? [Math.min(...holdF.map(elev)), Math.max(...holdF.map(elev))] : null,
    holdTipV: holdLate.length ? r1(Math.max(...holdLate.map((f) => f.tipV))) : null,
    holdFlexMax: holdF.length ? r1(Math.max(...holdF.map((f) => f.flex))) : null,
    regripGrip: gripI >= 0 ? r3(gripI * DT) : null, regripSeat: seatI >= 0 ? r3(seatI * DT) : null,
    offJump: jump('offT'), armJump: jump('armT'), ohVmax: r1(ohV),
    gapFree: after1.length ? r3(after1[Math.min(after1.length - 1, Math.round(1.0 / DT))].gap) : null,
    // 칼집 손 (11/13 iai_saya): 빈손(아래팔 끝)이 빈손 목표에 3 cm 안으로 든 첫 때(낸 때부터 — 뽑기 · 굳음 동안) · 칼집을 떠난 때(베는 몫 첫 스텝) · 굳음 0.3 s 빈손 골반 틀 자리 · 굳음 동안 빈손 ↔ 목표 가장
    sayaIn: (() => { const k = frames.findIndex((f, i) => i > 0 && (f.ph === 'draw' || f.ph === 'hold') && f.offT && dist3(f.ohL, f.offT) < 0.03); return k >= 0 ? frames[k].t : null; })(), // 첫 뽑기 스텝은 낸 스텝 앞 목표(칼자루 끝)라 뺌
    cutT: cut.length ? cut[0].t : null,
    ohPHold: h1 && h1.ohP, offPHold: h1 && h1.offP,
    holdTgtGap: holdLate.length ? r3(Math.max(...holdLate.filter((f) => f.offT).map((f) => dist3(f.ohL, f.offT)))) : null, // 굳음 0.1 s 뒤부터
  };
  G.world.free();
  return { frames, sum, hit, pre };
}

/**
 * 고노센마다 (싸움 꽂개 · AI 판 같이 씀): 뽑기 · 굳음 · 풀기 쥠 스텝 · 굳음 0.3 s 칼 팔 · 칼 높이 각 · 풀기 끝 → 다시 쥠 · 자리 잡음(빈손 ↔ 칼자루 끝 0.05 m 안) ·
 *  빈손 목표 튐(굳음 끝 앞 0.1 s ~ 풀기 끝 뒤 1 s · 이웃 스텝 가장 큰 옮김 — 가슴 몸체 틀) · 맞음 (읽기만)
 */
export function gnsTracker(P, G) {
  const rec = tapTargets(P);
  const list = [];
  let cur = null;
  let lastOff = null;
  const hist = [];
  return {
    list,
    before() {
      rec.off = rec.arm = null;
    },
    step() {
      const I = P.iai;
      if (I && I.kind === 'iai' && I !== cur?.I) {
        cur = { I, t: r3(G.t / CONFIG.TIME.k), c0: tv(P.bodies.chest.translation()), inv: P.yaw.clone().invert(), gripDraw: 0, gripHold: 0, gripFade: 0, n: 0, nH: 0, nF: 0, regrip: null, seat: null, tFree: null, tHold: null, hold: null, jump: 0, jumpPh: null, prev: null };
        list.push(cur);
      }
      if (cur) {
        const ph = P.iai === cur.I ? 'draw' : P.iaiHoldT > 0 ? 'hold' : P.iaiFade > 0 ? 'fade' : 'free';
        if (ph === 'draw') (cur.n++, cur.n > 1 && P.gripping && cur.gripDraw++);
        else if (ph === 'hold') {
          cur.nH++;
          if (P.gripping) cur.gripHold++;
          cur.tHold ??= G.t;
          if (!cur.hold && G.t - cur.tHold >= 0.3) {
            const f = pose(P, cur.c0, cur.inv);
            cur.hold = { flex: f.flex, ext: f.ext, elev: r1(Math.atan2(f.tip[1] - f.hi[1], Math.hypot(f.tip[0] - f.hi[0], f.tip[2] - f.hi[2])) * R2D), ohGap: r3(pommelW(P).distanceTo(offHandW(P))) };
          }
        } else if (ph === 'fade') (cur.nF++, P.gripping && cur.gripFade++);
        else {
          cur.tFree ??= G.t;
          if (P.gripping && cur.regrip == null) cur.regrip = r3(G.t - cur.tFree);
          if (cur.seat == null && pommelW(P).distanceTo(offHandW(P)) <= 0.05) cur.seat = r3(G.t - cur.tFree);
        }
        const off = rec.off;
        if ((ph === 'fade' || ph === 'free' || (ph === 'hold' && P.iaiHoldT < 0.1)) && off && cur.prev) {
          const d = dist3(off, cur.prev);
          if (d > cur.jump) (cur.jump = d), (cur.jumpPh = ph);
        }
        cur.prev = off;
        if (ph === 'free' && G.t - cur.tFree > 1.0) cur = null;
        if (!P.alive) cur = null;
      }
    },
    out() {
      return list.map((g) => ({ t: g.t, oneHand: !!g.I.oneHand, regripOn: !!g.I.regrip, hit: g.I.hit ? g.I.res?.zone ?? g.I.hit.info.kind : null, E: r3(g.I.res?.energy), sev: r3(g.I.res?.severity), gripDraw: g.gripDraw, gripHold: g.gripHold, gripFade: g.gripFade, n: g.n, nH: g.nH, nF: g.nF, hold: g.hold, regrip: g.regrip, seat: g.seat, jump: r3(g.jump), jumpPh: g.jumpPh }));
    },
  };
}

/** AI 대 AI 한 판: 내 무기 숙련 5 (비기 고노센) · 상대 숙련 oppProf(3 = school_balance 상대 AI) — 이김 · 짐 · 고노센마다 (gnsTracker) */
export function aiFight({ weapon = 'monohoshizao', opp = 'longsword', seed = 1, dur = 30, oppProf = 3 } = {}) {
  const G = newRound({ walls: true, seed, weapon, weapon2: opp, AI2Class: AI, persona: { proficiency: oppProf }, persona2: { proficiency: 5 } });
  const P = G.player;
  const A = G.enemy;
  const tr = gnsTracker(P, G);
  G.before = () => tr.before();
  let falls = 0;
  let st0 = 'stand';
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      tr.step();
      if (st0 === 'stand' && P.state !== 'stand' && P.state !== 'dead') falls++;
      st0 = P.state;
      if (!P.alive || !A.alive) break;
    }
    return { seed, win: !A.alive && P.alive, lose: !P.alive && A.alive, falls, gns: tr.out() };
  } finally {
    G.world.free();
  }
}

/** school_balance fightOne 꽂개 (사람 손가락 봇 판): 사람 고노센마다 gnsTracker */
export function mhzProbe() {
  let tr = null;
  let G = null;
  return {
    init(o) {
      G = o.G;
      tr = gnsTracker(o.P, o.G);
      const b = G.before;
      G.before = () => (tr.before(), b?.());
    },
    step() {
      tr.step();
    },
    done() {
      return tr.out();
    },
  };
}

/** 고노센 묶음 줄 */
function gnsLine(G) {
  const p50 = (a) => { const s2 = a.filter((x) => x != null).sort((x, y) => x - y); return s2.length ? s2[Math.floor((s2.length - 1) / 2)] : null; };
  const mx = (a) => { const b = a.filter((x) => x != null); return b.length ? Math.max(...b) : null; };
  const H = G.filter((g) => g.hit);
  return `고노센 ${G.length} · 한 손 ${G.filter((g) => g.oneHand).length} · 맞음 ${H.length} (${G.length ? Math.round((100 * H.length) / G.length) : 0} %) · 맞음당 심각도 ${(H.reduce((s, g) => s + (g.sev ?? 0), 0) / Math.max(1, H.length)).toFixed(2)} · 굳음 쥠 스텝 ${G.reduce((s, g) => s + g.gripHold, 0)}/${G.reduce((s, g) => s + g.nH, 0)} · 굳음 0.3 s 팔꿈치 p50 ${p50(G.map((g) => g.hold?.flex))}° · 칼 p50 ${p50(G.map((g) => g.hold?.elev))}° · 다시 쥠 p50 ${p50(G.map((g) => g.regrip))} s (가장 ${mx(G.map((g) => g.regrip))}) · 자리 p50 ${p50(G.map((g) => g.seat))} s · 빈손 목표 튐 p50 ${p50(G.map((g) => g.jump))} m (가장 ${mx(G.map((g) => g.jump))})`;
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  applySets(arg('set', ''));
  const range = (q) => String(q).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
  if (mode === 'shot') {
    const rows = [];
    for (const guard of arg('guards', 'langort,ochsR,pflugR').split(',')) for (const start of arg('start', 'hip,held').split(',')) for (const gapAdd of arg('gap', '0.3').split(',').map(Number)) {
      const r = mhzShot({ weapon: arg('weapon', 'monohoshizao'), foeW: arg('foe', 'longsword'), guard, start, gapAdd, after: +arg('after', 1.5) });
      rows.push({ guard, start, gapAdd, sum: r.sum, hit: r.hit, frames: arg('trace', null) ? r.frames : undefined });
      const s = r.sum;
      console.log(`${guard.padEnd(7)} ${start.padEnd(6)} +${gapAdd} | 한 손 ${+s.oneHand} | 맞음 ${r.hit ? `${r.hit.zone}(${r.hit.part}) ${r.hit.E} J 심각도 ${r.hit.sev}` : '헛침'} | 칼끝 길 ${JSON.stringify(s.tipCut)} 빠르기 가장 ${s.tipVmax} | 쥠 뽑기 ${s.grip.draw}/${s.grip.nDraw} 굳음 ${s.grip.hold}/${s.grip.nHold} 풀기 ${s.grip.fade}/${s.grip.nFade} | 끝 굽힘 ${s.end?.flex}° 칼 ${s.end?.elev}° | 굳음 0.3 s 굽힘 ${s.hold?.flex}° (가장 ${s.holdFlexMax}) 칼 ${s.hold?.elev}° (${JSON.stringify(s.holdElev)}) 칼끝 ${JSON.stringify(s.hold?.tip)} 흔들림 ${s.holdTipV} m/s 빈손 ${JSON.stringify(s.ohdHold)} | 다시 쥠 ${s.regripGrip} s · 자리 ${s.regripSeat} s (뽑기 전 틈 ${s.pre0}) · 1 s 뒤 틈 ${s.gapFree} | 빈손 목표 튐 ${JSON.stringify(s.offJump)} · 칼 손 목표 튐 ${JSON.stringify(s.armJump)} · 빈손 빠르기 가장 ${s.ohVmax} | 칼집 손: 3 cm 안 ${s.sayaIn} s · 칼집 떠남 ${s.cutT} s · 굳음 빈손 골반 틀 ${JSON.stringify(s.ohPHold)} (목표 ${JSON.stringify(s.offPHold)}) · 굳음 빈손 ↔ 목표 가장 ${s.holdTgtGap}`);
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), rows }));
  } else if (mode === 'aifight' || mode === 'fight') {
    const runs = [];
    for (const seed of range(arg('seeds', '1-24'))) {
      let r;
      if (mode === 'aifight') r = aiFight({ weapon: arg('weapon', 'monohoshizao'), opp: arg('opp', 'longsword'), seed, dur: +arg('dur', 30), oppProf: +arg('oppProf', 3) });
      else {
        const f = fightOne({ school: 'japanese', weapon: arg('weapon', 'monohoshizao'), opp: arg('opp', 'longsword'), seed, dur: +arg('dur', 30), tech: 0.35, probe: mhzProbe() });
        r = { seed, win: f.win, lose: f.lose, falls: f.falls?.P ?? 0, gns: f.probe };
      }
      runs.push(r);
      console.log(`씨앗 ${seed} ${r.win ? '이김' : r.lose ? '짐' : '비김'} 넘어짐 ${r.falls} | ${r.gns.map((g) => `${g.t}s ${g.oneHand ? '한' : '두'} ${g.hit ?? '헛침'} 쥠 ${g.gripDraw}/${g.n}·${g.gripHold}/${g.nH}·${g.gripFade}/${g.nF} 굳음 ${g.hold?.flex}° ${g.hold?.elev}° 다시 ${g.regrip} 자리 ${g.seat} 튐 ${g.jump}(${g.jumpPh})`).join(' | ')}`);
    }
    const G = runs.flatMap((r) => r.gns);
    console.log(`== ${runs.length} 판: 이김 ${runs.filter((r) => r.win).length} · 짐 ${runs.filter((r) => r.lose).length} · 비김 ${runs.filter((r) => !r.win && !r.lose).length} · 넘어짐/판 ${(runs.reduce((s, r) => s + r.falls, 0) / runs.length).toFixed(2)}`);
    console.log(`== ${gnsLine(G)}`);
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), runs }));
  }
}
