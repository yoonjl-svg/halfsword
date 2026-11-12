// ─────────────────────────────────────────────────────────────
//  iai_real.mjs — 사람 고노센 발도 몸 · 팔 · 칼끝 길 재기 (사장님 11/13 '플레이어 고노센 자세가 좀 어정쩡히 이상해졌어. 실제 발도술이나 원전이 재현되도록 검토해.
//   동작과 칼의 길 모두.' — 기록 docs/strike/iai_real_2026-11-13.md). 재기만 한다 — 게임 값은 --set 으로 이 프로세스 안에서만.
//  gns: 서 있는 과녁(AI 생각 끔 — 손 목표를 자세 패드에 묶음 · 걸음 0)에게 사람 고노센을 게임 길 그대로 낸다 —
//   사람 몸 설정(school_balance fightOne 과 같음: 손가락 칼 autoGuard · 보정 · 사람 입력 몸) · 준비(PlayerSecretWatch — 2 s 가만히) · 비기 실행(skill.secret → requestIai player).
//   처음 손: hip = 손을 쉼(허리 대기 SECRET.gnsReadyHip 자세에서 뽑음 — 사장님이 보는 꼴) · held = 손가락이 손을 쥔 채(가운데 겨눔에서 — handGrip · inputActive)
//   스텝마다 (낸 때 내 가슴 원점 · x 상대 쪽 · y 땅 위 높이 · z 칼 든 쪽): 칼 어깨 · 팔꿈치 · 손목 · 칼자루 · 칼끝 · 빈 어깨 · 빈 팔꿈치 · 빈손 · 골반 · 가슴 · 머리 · 두 발 ·
//   베는 몫(cut — 맞음 · 잔상이 도는 몫: 원전 꼴은 칼집을 떠난 뒤 hitFrom) · 가슴 숙임(°) · 가슴 · 골반 돌림(° — 헤딩 기준 칼 든 쪽 +) · 빈손 쥠 · 팔꿈치 굽힘(°) · 팔꿈치 들림(어깨 → 손목 줄 위 몫 m) · 팔 펴짐(어깨 ↔ 손목 / 팔 길이) · 칼끝 길
//  fight: 일본 우치가타나 대 롱소드 AI 싸움(school_balance fightOne 그대로 — 사람 손가락 봇 · 실제 input.js 터치 길) 꽂개 — 사람 고노센마다 몸 꼴(뽑기 끝 · 굳음 0.3 s) ·
//   사람 제비 베기 되돌림 칼마다 잔상 칼끝 길 휨(베는 토막 — 그리는 그대로) · 몸통 띠 옮김 · 첫 맞음 (읽기만)
//  node tools/sim/iai_real.mjs gns [--weapon=uchigatana] [--foe=longsword] [--guards=langort,ochsR,pflugR] [--start=hip,held] [--gap=0.3] [--set=SECRET.x=1,...] [--json=파일] [--trace=1]
//  node tools/sim/iai_real.mjs fight [--seeds=1-24] [--opp=longsword] [--set=...] [--json=파일]
//  tsu: 제비 베기 되돌림 칼 칼끝 길 (tsubame_trace traceRun 그대로 — 가만히 선 상대 · 손가락 길) 을 칼끝 곧은 줄 끔 · 켬(UNIQUE_ASSIST.tsuTip 0 · 1)으로 — 그림용 JSON
//  node tools/sim/iai_real.mjs tsu [--gaps=1.15,1.3] [--seeds=701,702] [--low=-0.7] [--json=파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { applySets } from './rapier_defence.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { fightOne } from './school_balance.mjs';
import { traceRun, bendCut, bendTrail } from './tsubame_trace.mjs';
import { isMain } from './is_main.mjs';

const { ARM } = CONFIG;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const r1 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(1));
const tv = (t) => new THREE.Vector3(t.x, t.y, t.z);
const tq = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const R2D = 180 / Math.PI;

const guardCache = {};
/** 상대 무기 AI 유파의 간 보는 자세 (gns_belly.mjs guardsOf 와 같음 — 옛 판에도 돌게 여기 둠) */
export function guardsOf(foeW) {
  if (!guardCache[foeW]) {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: foeW, seed: 1 });
    guardCache[foeW] = G.ai.school.guards.map((g) => ({ name: g.name, pad: g.pad.slice() }));
    G.world.free();
  }
  return guardCache[foeW];
}

/** 몸 한 장면 (가슴 원점 · 낸 때 헤딩 틀) */
function pose(P, c0, inv) {
  const B = P.bodies;
  const L = (v) => { const p = v.clone(); const y = p.y; p.sub(c0).applyQuaternion(inv); return [r3(p.x), r3(y), r3(p.z)]; };
  const qc = tq(B.chest.rotation());
  const S = new THREE.Vector3(ARM.shoulder[0], ARM.shoulder[1], P.side * ARM.shoulder[2]).applyQuaternion(qc).add(tv(B.chest.translation()));
  const qu = tq(B.uarmS.rotation());
  const qf = tq(B.farmS.rotation());
  const El = new THREE.Vector3(0.15, 0, 0).applyQuaternion(qu).add(tv(B.uarmS.translation()));
  const Wr = new THREE.Vector3(0.13, 0, 0).applyQuaternion(qf).add(tv(B.farmS.translation()));
  const So = new THREE.Vector3(0, 0.1, -P.side * 0.2).applyQuaternion(qc).add(tv(B.chest.translation()));
  const quo = tq(B.uarmO.rotation());
  const qfo = tq(B.farmO.rotation());
  const Eo = new THREE.Vector3(0, 0.14, 0).applyQuaternion(qfo).add(tv(B.farmO.translation()));
  const Ho = new THREE.Vector3(0, -0.135, 0).applyQuaternion(qfo).add(tv(B.farmO.translation()));
  // 팔꿈치 굽힘 · 들림 · 펴짐
  const ua = El.clone().sub(S);
  const fa = Wr.clone().sub(El);
  const flex = ua.angleTo(fa) * R2D;
  const sw = Wr.clone().sub(S);
  const lift = (() => { const n = sw.clone().normalize(); const perp = ua.clone().addScaledVector(n, -ua.dot(n)); return perp.y; })();
  // 가슴 숙임 · 돌림 (헤딩 틀)
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(qc).applyQuaternion(inv);
  const fw = new THREE.Vector3(1, 0, 0).applyQuaternion(qc).applyQuaternion(inv);
  const fp = new THREE.Vector3(1, 0, 0).applyQuaternion(tq(B.pelvis.rotation())).applyQuaternion(inv);
  return {
    sh: L(S), el: L(El), wr: L(Wr), hi: L(P.bladePoint(0, new THREE.Vector3())), tip: L(P.bladePoint(1, new THREE.Vector3())),
    osh: L(So), oel: L(Eo), ohd: L(Ho), pel: L(tv(B.pelvis.translation())), ch: L(tv(B.chest.translation())), hd: L(tv(B.head.translation())),
    fF: L(tv(B.footF.translation())), fB: L(tv(B.footB.translation())), kF: L(tv(B.shinF.translation())), kB: L(tv(B.shinB.translation())),
    pitch: r1(Math.atan2(up.x, up.y) * R2D), chestYaw: r1(Math.atan2(fw.z, fw.x) * R2D), pelvisYaw: r1(Math.atan2(fp.z, fp.x) * R2D),
    flex: r1(flex), lift: r3(lift), ext: r3(sw.length() / (ARM.upper + ARM.fore)), grip: !!P.gripping, ohGap: r3(Ho.distanceTo(P.bladePoint(0, new THREE.Vector3()))),
  };
}

/** 칼끝 길 휨: 곧은 줄(처음 → 끝) 대비 가장 먼 거리 몫 · 이웃 조각 꺾임 가장 큼 (tsubame_trace bendOf 와 같은 셈) */
export function bendPts(T) {
  if (T.length < 3) return null;
  const a = new THREE.Vector3(...T[0]);
  const b = new THREE.Vector3(...T[T.length - 1]);
  const ab = b.clone().sub(a);
  const L = ab.length();
  let dev = 0;
  for (const p of T) {
    const v = new THREE.Vector3(...p).sub(a);
    const q = ab.clone().multiplyScalar(v.dot(ab) / (L * L));
    dev = Math.max(dev, v.distanceTo(q));
  }
  let kink = 0;
  let len = 0;
  for (let i = 2; i < T.length; i++) {
    const u = new THREE.Vector3(...T[i - 1]).sub(new THREE.Vector3(...T[i - 2]));
    const w = new THREE.Vector3(...T[i]).sub(new THREE.Vector3(...T[i - 1]));
    len += w.length();
    if (u.length() > 0.01 && w.length() > 0.01) kink = Math.max(kink, u.angleTo(w) * R2D);
  }
  return { chord: r3(L), dev: r3(dev), devShare: r3(dev / L), kinkDeg: r1(kink), len: r3(len) };
}

/**
 * 서 있는 과녁에게 사람 고노센 한 번 (게임 길 그대로 — skill.secret). { frames, sum, hit }
 *  frames: 낸 때부터 굳음 · 풀기 끝 + 0.3 s 까지 스텝마다 pose() + { t, u, ph: 'draw' | 'hold' | 'fade' | 'free' }
 */
export function gnsShot({ foeW = 'longsword', guard = 'langort', start = 'hip', gapAdd = 0.3, seed = 1, after = 0.3, weapon = 'uchigatana' } = {}) {
  const pad = guardsOf(foeW).find((g) => g.name === guard)?.pad;
  if (!pad) throw new Error(`자세 없음 ${foeW} ${guard}`);
  const G0 = newRound({ walls: false, weapon, weapon2: foeW, seed });
  const contact = G0.player.swordArt.measure.contact;
  G0.world.free();
  const G = newRound({ walls: false, weapon, weapon2: foeW, seed, gap: contact + gapAdd, persona: { proficiency: 3 }, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
  const P = G.player;
  const A = G.enemy;
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  P.canShove = true;
  const W = new PlayerSecretWatch(P, A);
  if (W.S?.name !== 'goNoSen') throw new Error(`고노센 아님 ${W.S?.name}`);
  G.ai.update = () => {
    A.move.set(0, 0);
    A.handOffset.set(pad[0], pad[1]);
  };
  const held = start === 'held';
  G.before = () => {
    if (held) {
      P.handGrip = true;
      P.inputActive = true;
      P.handHeld = true;
    }
    W.update(DT, !!P.skill.sec);
  };
  // 준비: 판 시작 정지 + 무장 2 s + 허리 대기 손 0.35 s 를 넉넉히
  const settle = CONFIG.ARENA.startHold + CONFIG.SECRET.iaiArmTime + 0.8;
  while (G.t < settle) G.step();
  const armed = !!W.iaiArm?.armed;
  const handW = r3(P.iaiHandW ?? 0);
  const c0 = tv(P.bodies.chest.translation());
  const inv = P.yaw.clone().invert();
  const pre = pose(P, c0, inv);
  const ok = P.skill.secret({ S: W.S, ctx: { ev: 'raise' } });
  const frames = [];
  const t0 = G.t;
  let I = null;
  let endT = null;
  let holdEnd = null;
  for (let i = 0; i < Math.round(4 / DT); i++) {
    G.step();
    if (P.iai && P.iai.kind === 'iai') I = P.iai;
    const ph = P.iai ? 'draw' : P.iaiHoldT > 0 ? 'hold' : P.iaiFade > 0 ? 'fade' : 'free';
    if (ph !== 'draw' && endT == null && I) endT = G.t;
    if (ph === 'free' && holdEnd == null && endT != null) holdEnd = G.t;
    frames.push({ t: r3(G.t - t0), u: r3(P.iai?.u ?? (I ? 1 : 0)), ph, cut: !!(P.iai && P.iai.u >= (P.iai.hitFrom ?? P.iai.ab)), ...pose(P, c0, inv) });
    if (holdEnd != null && G.t - holdEnd > after) break;
  }
  const res = I?.res;
  const hit = I?.hit ? { part: I.hit.info.part, zone: res?.zone ?? null, type: res?.type ?? null, E: r3(res?.energy), sev: r3(res?.severity) } : null;
  const draw = frames.filter((f) => f.ph === 'draw');
  const cut = frames.filter((f) => f.cut);
  const holdF = frames.filter((f) => f.ph === 'hold');
  const mid = draw[Math.floor(draw.length / 2)] ?? null;
  const end = draw.at(-1) ?? null;
  const h1 = holdF[Math.min(holdF.length - 1, Math.round(0.3 / DT))] ?? null; // 굳음 0.3 s 뒤 (잔심 자세)
  const sum = {
    armed, handW, ok: !!ok, stand: P.state === 'stand', ab: r3(I?.ab), T: r3(I?.T),
    drawT: endT != null ? r3(endT - t0) : null, holdT: holdEnd != null && endT != null ? r3(holdEnd - endT) : null,
    pre: { pel: pre.pel[1], ch: pre.ch[1], pitch: pre.pitch, hand: pre.wr, ohd: pre.ohd, stance: r3(pre.fF[0] - pre.fB[0]) },
    tipCut: bendPts(cut.map((f) => f.tip)),
    tipDraw: bendPts(draw.map((f) => f.tip)),
    // 몸: 가장 낮은 골반 · 가장 큰 숙임 (뽑는 동안 · 굳음)
    pelMin: r3(Math.min(...frames.filter((f) => f.ph !== 'free').map((f) => f.pel[1]))),
    pitchMax: r1(Math.max(...frames.filter((f) => f.ph !== 'free').map((f) => f.pitch))),
    stanceEnd: end ? r3(end.fF[0] - end.fB[0]) : null,
    stanceHold: h1 ? r3(h1.fF[0] - h1.fB[0]) : null,
    mid: mid && { flex: mid.flex, lift: mid.lift, ext: mid.ext, wr: mid.wr, tip: mid.tip, ohd: mid.ohd, grip: mid.grip, pitch: mid.pitch },
    end: end && { flex: end.flex, lift: end.lift, ext: end.ext, wr: end.wr, tip: end.tip, ohd: end.ohd, grip: end.grip, pitch: end.pitch, pel: end.pel[1], chestYaw: end.chestYaw },
    hold: h1 && { flex: h1.flex, lift: h1.lift, ext: h1.ext, wr: h1.wr, tip: h1.tip, ohd: h1.ohd, grip: h1.grip, pitch: h1.pitch, pel: h1.pel[1], chestYaw: h1.chestYaw },
    flexMaxDraw: r1(Math.max(...draw.map((f) => f.flex))), liftMaxDraw: r3(Math.max(...draw.map((f) => f.lift))),
    gripDraw: draw.filter((f) => f.grip).length, gripHold: holdF.filter((f) => f.grip).length,
  };
  G.world.free();
  return { frames, sum, hit, pre };
}

/** fight 꽂개: 사람 고노센 몸 꼴 · 제비 베기 되돌림 칼 잔상 휨 (읽기만) */
export function realProbe() {
  let G = null;
  let P = null;
  let gcur = null;
  let tcur = null;
  const gns = [];
  const tsu = [];
  return {
    init(o) {
      ({ G, P } = o);
    },
    step() {
      const I = P.iai;
      if (I && I.kind === 'iai' && I !== gcur?.I) {
        const c0 = tv(P.bodies.chest.translation());
        gcur = { I, c0, inv: P.yaw.clone().invert(), t0: G.t, frames: [] };
      }
      if (gcur) {
        const ph = P.iai === gcur.I ? 'draw' : P.iaiHoldT > 0 ? 'hold' : P.iaiFade > 0 ? 'fade' : 'free';
        gcur.frames.push({ t: r3(G.t - gcur.t0), ph, cut: P.iai === gcur.I && gcur.I.u >= (gcur.I.hitFrom ?? gcur.I.ab), ...pose(P, gcur.c0, gcur.inv) });
        if (ph === 'free' || G.t - gcur.t0 > 3) {
          const fr = gcur.frames;
          const draw = fr.filter((f) => f.ph === 'draw');
          const hold = fr.filter((f) => f.ph === 'hold');
          const end = draw.at(-1);
          const h1 = hold[Math.min(hold.length - 1, Math.round(0.3 / DT))];
          const J = gcur.I;
          gns.push({ t: r3(gcur.t0 / CONFIG.TIME.k), hit: J.hit ? J.res?.zone ?? J.hit.info.kind : null, E: r3(J.res?.energy), tipCut: bendPts(fr.filter((f) => f.cut).map((f) => f.tip)), end: end && { flex: end.flex, ext: end.ext, wr: end.wr, tip: end.tip, pitch: end.pitch, pel: end.pel[1], stance: r3(end.fF[0] - end.fB[0]) }, hold: h1 && { flex: h1.flex, ext: h1.ext, wr: h1.wr, tip: h1.tip, pitch: h1.pitch, pel: h1.pel[1], stance: r3(h1.fF[0] - h1.fB[0]), ohd: h1.ohd }, pitchMax: r1(Math.max(...fr.map((f) => f.pitch))), pelMin: r3(Math.min(...fr.map((f) => f.pel[1]))), frames: fr });
          gcur = null;
        }
      }
      // 제비 베기 되돌림 칼 (끌고 가는 칼 tech 'tsubameGaeshi')
      if (I && I.kind === 'combo' && I.tech === 'tsubameGaeshi' && I !== tcur?.I) tcur = { I, t0: G.t, tips: [], hand0: [r3(P.handOffset.x), r3(P.handOffset.y)], p7: null, edges: [], hitEdge: null, tipK: null };
      if (tcur) {
        if (P.iai === tcur.I) {
          tcur.tips.push([...P.bladePoint(1, new THREE.Vector3()).toArray(), tcur.I.cutting ? 1 : 0]);
          tcur.tipK ??= tcur.I.tipK ?? null;
          // 날 앞장 (tsubame_trace 와 같은 셈 — 칼날 0.7 자리 움직임의 칼 축 수직 몫과 날(칼 틀 +x) cos)
          const b7 = P.bladePoint(0.7, new THREE.Vector3());
          if (tcur.p7 && P.sword) {
            const q = tq(P.sword.rotation());
            const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
            const mv = b7.clone().sub(tcur.p7);
            mv.addScaledVector(ax, -mv.dot(ax));
            if (mv.length() > 1e-3) {
              const ec = mv.dot(new THREE.Vector3(1, 0, 0).applyQuaternion(q)) / mv.length();
              if (tcur.I.cutting) tcur.edges.push(r3(ec));
              if (tcur.hitEdge == null && (tcur.I.hits ?? 0) > 0) tcur.hitEdge = r3(ec);
            }
          }
          tcur.p7 = b7;
        }
        else {
          const J = tcur.I;
          const arc = J.arc?.pts ?? [];
          const k0 = CONFIG.STRIKE.edgeAlign;
          tsu.push({ t: r3(tcur.t0 / CONFIG.TIME.k), pad: tcur.hand0, tipK: tcur.tipK, lead: tcur.edges.length ? r3(tcur.edges.filter((x) => x > k0).length / tcur.edges.length) : null, hitEdge: tcur.hitEdge, dy: r3(J.bandDy ?? 0), from: J.bandFrom ?? null, to: J.bandTo ?? null, part: J.part ?? null, hits: J.hits ?? 0, trail: arc.length >= 3 ? bendPts(arc.map((a) => [a[3], a[4], a[5]])) : null, cut: bendPts(tcur.tips.filter((x) => x[3]).map((x) => x.slice(0, 3))), arc: arc.map((a) => a.map(r3)) });
          tcur = null;
        }
      }
    },
    done() {
      return { gns, tsu };
    },
  };
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  applySets(arg('set', ''));
  if (mode === 'gns') {
    const foeW = arg('foe', 'longsword');
    const guards = arg('guards', 'langort,ochsR,pflugR').split(',');
    const starts = arg('start', 'hip,held').split(',');
    const gaps = arg('gap', '0.3').split(',').map(Number);
    const rows = [];
    for (const guard of guards) for (const start of starts) for (const gapAdd of gaps) {
      const r = gnsShot({ foeW, guard, start, gapAdd, weapon: arg('weapon', 'uchigatana') });
      rows.push({ foeW, guard, start, gapAdd, sum: r.sum, hit: r.hit, frames: arg('trace', null) ? r.frames : undefined });
      const s = r.sum;
      console.log(`${guard.padEnd(8)} ${start.padEnd(4)} +${gapAdd} | 준비 ${s.armed ? 'o' : 'x'} 손 ${s.handW} | 맞음 ${r.hit ? `${r.hit.zone}(${r.hit.part}) ${r.hit.E} J` : '헛침'} | 뽑기 ${s.drawT} s · 굳음 ${s.holdT} s | 골반 ${s.pre.pel} → 낮음 ${s.pelMin} · 숙임 ${s.pre.pitch} → ${s.pitchMax}° | 발 ${s.pre.stance} → ${s.stanceEnd} · ${s.stanceHold} | 가운데 굽힘 ${s.mid?.flex}° 들림 ${s.mid?.lift} 펴짐 ${s.mid?.ext} 빈손 ${JSON.stringify(s.mid?.ohd)} | 끝 굽힘 ${s.end?.flex}° 펴짐 ${s.end?.ext} 손 ${JSON.stringify(s.end?.wr)} 칼끝 ${JSON.stringify(s.end?.tip)} | 굳음 0.3 s 굽힘 ${s.hold?.flex}° 손 ${JSON.stringify(s.hold?.wr)} 칼끝 ${JSON.stringify(s.hold?.tip)} 빈손 ${JSON.stringify(s.hold?.ohd)} 쥠 ${s.gripHold} | 칼끝 길(베는 몫) ${JSON.stringify(s.tipCut)}`);
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), rows }));
  } else if (mode === 'tsu') {
    const UA = CONFIG.UNIQUE_ASSIST;
    const keep = UA.tsuTip;
    const low = arg('low', null) != null ? +arg('low', null) : undefined;
    const rows = [];
    for (const gap of arg('gaps', '1.15,1.3').split(',').map(Number)) for (const seed of arg('seeds', '701,702').split(',').map(Number)) for (const tip of [0, keep]) {
      UA.tsuTip = tip;
      const tr = traceRun('line', seed, gap, { low });
      UA.tsuTip = keep;
      const row = { gap, seed, tsuTip: tip, low: low ?? null, fired: tr.fired, cut: bendCut(tr), trail: bendTrail(tr), hits: tr.hits, tip: tr.tip, hand: tr.hand, arc: (tr.arc ?? []).map((a) => a.map(r3)) };
      rows.push(row);
      console.log(`${gap} m 씨앗 ${seed} 곧은 줄 ${tip} | 베는 토막 ${JSON.stringify(row.cut)} | 잔상 ${JSON.stringify(row.trail)} | 첫 맞음 ${tr.hits[0]?.part ?? '-'} 날 ${tr.hits[0]?.edge}`);
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ rows }));
  } else if (mode === 'fight') {
    const range = (q) => String(q).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
    const opp = arg('opp', 'longsword');
    const runs = [];
    for (const seed of range(arg('seeds', '1-24'))) {
      const r = fightOne({ school: 'japanese', weapon: 'uchigatana', opp, seed, dur: 30, tech: 0.35, probe: realProbe() });
      const pr = r.probe;
      runs.push({ seed, win: r.win, lose: r.lose, gns: pr.gns, tsu: pr.tsu });
      for (const g of pr.gns) console.log(`씨앗 ${seed} 고노센 ${g.t}s ${g.hit ?? '헛침'} ${g.E} J | 끝 굽힘 ${g.end?.flex}° 펴짐 ${g.end?.ext} | 굳음 0.3 s 굽힘 ${g.hold?.flex}° 펴짐 ${g.hold?.ext} 숙임 ${g.hold?.pitch}° 발 ${g.hold?.stance} | 숙임 가장 ${g.pitchMax}° 골반 낮음 ${g.pelMin} | 칼끝 ${JSON.stringify(g.tipCut)}`);
      for (const x of pr.tsu) console.log(`씨앗 ${seed} 제비 ${x.t}s 꺾은 패드 ${JSON.stringify(x.pad)} 곧은 줄 ${x.tipK} 띠 ${x.dy} ${x.from}>${x.to} 맞음 ${x.part ?? '-'} 날 ${x.hitEdge} 날 앞장 ${x.lead} | 잔상 ${JSON.stringify(x.trail)} | 칼끝 ${JSON.stringify(x.cut)}`);
    }
    const T = runs.flatMap((r) => r.tsu).filter((x) => x.trail);
    const p50 = (a) => { const s2 = [...a].sort((x, y) => x - y); return s2.length ? s2[Math.floor((s2.length - 1) / 2)] : null; };
    const mx = (a) => (a.length ? Math.max(...a) : null);
    const k0 = CONFIG.STRIKE.edgeAlign;
    const Th = T.filter((x) => x.part);
    console.log(`== 제비 맞음 ${Th.length} 번: 날로 ${Th.filter((x) => x.hitEdge != null && x.hitEdge > k0).length} · 등 ${Th.filter((x) => x.hitEdge != null && x.hitEdge < -k0).length} · 날 앞장 스텝 p50 ${p50(T.map((x) => x.lead ?? 1))} · 곧은 줄 쓴 ${T.filter((x) => x.tipK > 0).length}`);
    console.log(`== 제비 ${T.length} 번: 잔상 휨 몫 p50 ${p50(T.map((x) => x.trail.devShare))} · 가장 ${mx(T.map((x) => x.trail.devShare))} · 꺾임 p50 ${p50(T.map((x) => x.trail.kinkDeg))} · 가장 ${mx(T.map((x) => x.trail.kinkDeg))} · 0.16 넘음 ${T.filter((x) => x.trail.devShare >= 0.16).length} · 15° 넘음 ${T.filter((x) => x.trail.kinkDeg >= 15).length} · 띠 옮김 ${T.filter((x) => x.dy).length}`);
    const Gs = runs.flatMap((r) => r.gns);
    console.log(`== 고노센 ${Gs.length} 번: 굳음 굽힘 p50 ${p50(Gs.map((g) => g.hold?.flex ?? 0))} · 숙임 가장 p50 ${p50(Gs.map((g) => g.pitchMax))} · 맞음 ${Gs.filter((g) => g.hit).length}`);
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ set: arg('set', ''), runs }));
  }
}
