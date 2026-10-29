// ─────────────────────────────────────────────────────────────
//  redondo_sway.mjs — 풍차 베기(B4 레돈두) 감기 첫머리 휘청 재기 (사장님 10/29 20:0x '레돈두는 처음 발동을 시작할 때 캐릭터가 크게 휘청거려' · docs/strike/redondo_hold_2026-10-29.md §8)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 으로 바꿔 견줌). 사람 몸(0 번)이 서서(stand) · 앞으로 걸으며(walk — 스틱 0.6) 탭을 끌지 않고 길게 누름 → 감기 →
//   감기 시작부터 release 초 뒤 뗌. 상대는 멀리(시작 거리 5.6 m) 가만히 칼을 내린 채.
//   창 = 감기 시작 ~ 실제 0.6 s (사장님 '처음 발동을 시작할 때') · hold = 감는 내내(감기 시작 ~ 뗌) · 바탕 = 누르기 전 같은 길이(같은 몸 · 같은 걸음 — 감기 없이도 있는 흔들림)
//   잼 (창 안 최대 · cm · °):
//    pelvis   골반 가로 옮김 − 바탕 걸음 몫(서기: 창 첫 자리부터 · 걷기: 스틱 걸음 빠르기 × 시간을 뺀 몫이 아니라 바탕 창의 같은 셈과 견줌)
//    comOff   무게중심 ↔ 두 발 사이 선분 가로 거리 (fighter.js updateBalance 의 offBalance 셈 — 캡처 포인트 · 발 둘레 여유 footMargin 밖 몫)
//    tilt     가슴 위 축 ↔ 하늘 각 (최대 · 창 첫 자리와의 차)
//    chestW   가슴 각속도 최대 (rad/s)
//    foot     땅에 닿은 발의 가로 미끄러짐 (스텝마다 닿은 채 움직인 거리의 합 — 걸음으로 든 발은 뺌)
//    stumble  균형 걸음 명령 크기 최대 (0 ~ 1 — 1 이면 넘어지지 않으려 딛는 걸음이 다 걸림) · 넘어짐(state ≠ stand)
//    jerk     칼끝 놓인 자리의 가속 최대 (m/s² — 놓인 자리의 차 두 번) · 손 놓인 자리 첫 스텝 뜀(cm)
//   사용법: node tools/sim/redondo_sway.mjs [--ws=zweihander,flamberge,tizona,durandal] [--seeds=6] [--moves=stand,walk] [--release=1.5] [--control=1] [--paired=1] [--held=press|always|off] [--set=UNIQUE_ASSIST.rdWindMode="slowSpin";…] [--json=.tmp/파일]
//    씨앗 n = 누르는 때 3.8 + 0.1·(n − 1) s (걸음 박자 자리를 고르게 — 상대 · 몸은 같은 판) · --control=1 = 누르지 않고 같은 창 (걸음만의 흔들림) · --paired=1 = 같은 박자의 control 과 짝 차이(excess)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { PlayerUniqueAssist } from '../../src/unique_assist.js';
import { isMain } from './is_main.mjs';

const R2D = 180 / Math.PI;
const UP = new THREE.Vector3(0, 1, 0);
const r2 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(2));
const q = (a, p) => {
  const s = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))] : null;
};
const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
function segDist2D(x, z, a, b) {
  const ux = b.x - a.x;
  const uz = b.z - a.z;
  const L = ux * ux + uz * uz;
  const t = L > 1e-9 ? Math.max(0, Math.min(1, ((x - a.x) * ux + (z - a.z) * uz) / L)) : 0;
  return Math.hypot(x - (a.x + ux * t), z - (a.z + uz * t));
}

/** 한 판: 누름 → 감기 → 뗌. 창 · 바탕 재기를 돌려줌 */
export function swayRun({ w = 'zweihander', seed = 1, move = 'stand', press = 4.0, release = 1.5, after = 1.0, setup = null, control = false, held = 'press' } = {}) {
  const G = newRound({ walls: true, seed, weapon: w, weapon2: 'longsword', persona: { proficiency: 4 } });
  const P = G.player;
  const D = G.enemy;
  setup?.(G, P); // 견줌 (재는 도구만 — 충돌 · 무게 끄기 등)
  G.ai.update = () => {};
  D.applyWound = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  const uq = new PlayerUniqueAssist(P, { names: new Set(['redondo']) });
  if (!uq.holdE) throw new Error('풍차 베기가 열리지 않음');
  const winLen = CONFIG.realS(0.6);
  const rec = { w, seed, move, tWind: null, tFire: null, base: null, win: null, fell: false, fire: null, turns: null, stam0: null, stam1: null };
  let down = false;
  let tWind = null;
  let tRel = null;
  G.before = () => {
    const t = G.t;
    const fwd = move === 'walk' && t > 2.0 ? 0.6 : 0;
    P.move.set(0, fwd);
    P.stickX = 0;
    P.stickY = fwd;
    if (t >= press && tRel == null && !control) down = true;
    if (tWind == null && (uq.winding || (control && t >= press + CONFIG.UNIQUE_ASSIST.rdHoldTime))) { // control = 누르지 않고 같은 때 창을 잼 (걸음만의 흔들림 — 견줌)
      tWind = t;
      rec.tWind = +(t - press).toFixed(3);
      rec.stam0 = P.stamina.value;
    }
    if (tWind != null && tRel == null && t - tWind >= release) { // (control 도 같은 때 끝냄)
      tRel = t;
      down = false;
      rec.turns = +(P.rdWind?.turns ?? 0).toFixed(2);
      rec.stam1 = P.stamina.value;
    }
    uq.holdInput(down, true, false);
    // 손가락이 화면에 닿아 있나 (main.js player.handHeld = input.activeTouch !== null — 길게 누르는 동안은 늘 참):
    //  'press' = 누른 때부터 뗄 때까지(게임과 같음 — control 판도 같은 때) · 'always' = 처음부터 손가락을 대고 있음(쉼 자세가 날것 매핑 — 칼이 오른쪽 아래) · 'off' = 대지 않음(10/29 판 시뮬)
    P.handHeld = held === 'always' ? t > 1 : held === 'press' ? t >= press && tRel == null : false;
  };
  // 재는 창: [a, a + winLen)
  const mk = () => ({ n: 0, p0: null, tilt0: null, pelvis: 0, comOff: 0, offBal: 0, tilt: 0, dTilt: 0, chestW: 0, foot: 0, stumble: 0, jerk: 0, hand0: null, handJump: 0, yawDev: 0, selfImp: 0, selfSteps: 0 });
  // 제 칼 · 칼팔 ↔ 제 몸통 닿음 (BODY.humanLimits — 제 몸 충돌): 스텝마다 그 닿음의 충격량 합 (N·s)
  const torsoCols = ['pelvis', 'abdomen', 'chest', 'thighF', 'thighB'].map((k) => P.bodies[k]?.collider(0)).filter(Boolean);
  const selfH = new Set([P.bodies.uarmS.handle, P.bodies.farmS.handle, P.sword.handle]);
  const selfImpulse = () => {
    let J = 0;
    for (const c1 of torsoCols)
      G.world.contactPairsWith(c1, (c2) => {
        if (!selfH.has(c2.parent()?.handle)) return;
        G.world.contactPair(c1, c2, (m) => {
          for (let i = 0; i < m.numContacts(); i++) J += m.contactImpulse(i);
        });
      });
    return J;
  };
  const base = mk();
  const win = mk();
  const hold = mk(); // 감는 내내 (감기 시작 ~ 뗌 — 고리를 여러 바퀴 도는 동안의 흔들림)
  const sampleInto = (S, first) => {
    const pel = V(P.bodies.pelvis.translation());
    const chest = P.bodies.chest;
    const up = UP.clone().applyQuaternion(Q(chest.rotation()));
    const tilt = Math.acos(Math.max(-1, Math.min(1, up.y))) * R2D;
    if (first || !S.p0) {
      S.p0 = pel.clone();
      S.tilt0 = tilt;
      S.walk0 = pel.clone();
    }
    S.n++;
    const disp = Math.hypot(pel.x - S.p0.x, pel.z - S.p0.z);
    S.pelvisRaw = Math.max(S.pelvisRaw ?? 0, disp);
    // 옆 · 뒤 흔들림 (걷는 앞 몫 뺌): 골반의 몸 옆 축 성분 + 몸 앞 축 성분 가운데 스틱 걸음 바깥 몫 — 몸 틀로 옮겨 옆 성분 최대
    const inv = P.yaw.clone().invert();
    const loc = new THREE.Vector3(pel.x - S.p0.x, 0, pel.z - S.p0.z).applyQuaternion(inv);
    S.side = Math.max(S.side ?? 0, Math.abs(loc.z));
    S.back = Math.max(S.back ?? 0, -loc.x);
    S.tilt = Math.max(S.tilt, tilt);
    S.dTilt = Math.max(S.dTilt, Math.abs(tilt - S.tilt0));
    const aw = chest.angvel();
    S.chestW = Math.max(S.chestW, Math.hypot(aw.x, aw.y, aw.z));
    // 무게중심 ↔ 두 발 (updateBalance 와 같은 com · 발바닥)
    const com = P.com;
    if (com) {
      const a = P.solePoint('footF', new THREE.Vector3());
      const b = P.solePoint('footB', new THREE.Vector3());
      S.comOff = Math.max(S.comOff, segDist2D(com.x, com.z, a, b));
    }
    S.offBal = Math.max(S.offBal, P.offBalance ?? 0);
    const J = selfImpulse();
    S.selfImp += J;
    if (J > 1e-4) S.selfSteps++;
    S.stumble = Math.max(S.stumble, P.stumble?.length?.() ?? 0);
    // 땅에 닿은 발 미끄러짐
    const ft = ['footF', 'footB'].map((k) => P.solePoint(k, new THREE.Vector3()));
    if (S.footPrev && !first)
      for (let i = 0; i < 2; i++) {
        if (ft[i].y < 0.06 && S.footPrev[i].y < 0.06) S.foot += Math.hypot(ft[i].x - S.footPrev[i].x, ft[i].z - S.footPrev[i].z);
      }
    S.footPrev = ft;
    // 칼끝 가속 · 손 첫 뜀
    const tip = P.bladePoint(1, new THREE.Vector3());
    const tipV = S.tipPrev ? tip.clone().sub(S.tipPrev).divideScalar(DT) : null;
    if (tipV && S.tipVPrev && !first) S.jerk = Math.max(S.jerk, tipV.clone().sub(S.tipVPrev).length() / DT);
    if (tipV && !first) S.tipVmax = Math.max(S.tipVmax ?? 0, tipV.length());
    S.tipPrev = tip;
    S.tipVPrev = tipV;
    const hand = V(P.sword.translation());
    if (S.handPrev && !first) S.handJump = Math.max(S.handJump, hand.distanceTo(S.handPrev) - (move === 'walk' ? 0.6 * DT * 2 : 0));
    S.handPrev = hand;
    // 몸 방향 ↔ 상대 방향
    const fw = new THREE.Vector3(1, 0, 0).applyQuaternion(P.yaw);
    const dc = D.bodies.chest.translation();
    const c = chest.translation();
    const to = new THREE.Vector3(dc.x - c.x, 0, dc.z - c.z).normalize();
    S.yawDev = Math.max(S.yawDev, Math.acos(Math.max(-1, Math.min(1, fw.x * to.x + fw.z * to.z))) * R2D);
  };
  const bA = press - winLen;
  try {
    const end = () => (tRel != null && G.t > tRel + after) || G.t > press + 8;
    let inB = false;
    let inW = false;
    let inH = false;
    while (!end() && P.alive) {
      G.step();
      const t = G.t;
      if (t >= bA && t < press) {
        sampleInto(base, !inB);
        inB = true;
      }
      if (tWind != null && t >= tWind && t < tWind + winLen) {
        sampleInto(win, !inW);
        inW = true;
      }
      if (tWind != null && t >= tWind && (tRel == null || t < tRel)) {
        sampleInto(hold, !inH);
        inH = true;
      }
      if (P.state !== 'stand') rec.fell = true;
      if (tRel != null && rec.fire == null && P.iai?.moves?.[0]?.rd) rec.fire = +(t - tRel).toFixed(3);
    }
  } finally {
    G.world.free();
  }
  const out = (S) => ({ pelvis: r2(S.pelvisRaw * 100), side: r2(S.side * 100), back: r2(S.back * 100), comOff: r2(S.comOff * 100), offBal: r2(S.offBal * 100), tilt: r2(S.tilt), dTilt: r2(S.dTilt), chestW: r2(S.chestW), tipV: r2(S.tipVmax ?? 0), foot: r2(S.foot * 100), stumble: r2(S.stumble), jerk: r2(S.jerk), handJump: r2(S.handJump * 100), yawDev: r2(S.yawDev), selfImp: r2(S.selfImp), selfShare: r2(S.n ? S.selfSteps / S.n : 0) });
  rec.base = out(base);
  rec.win = out(win);
  rec.hold = out(hold);
  rec.drain = rec.stam0 != null && rec.stam1 != null ? r2(rec.stam0 - rec.stam1) : null;
  rec.stats = { winds: uq.stats.winds ?? 0, fire: uq.stats.windFire ?? {}, cancel: uq.stats.windCancel ?? {} };
  return rec;
}

/** 무기 · 걸음마다 씨앗 묶음 (p50 · 최대) */
export function swaySummary(runs) {
  const keys = ['pelvis', 'side', 'back', 'comOff', 'offBal', 'dTilt', 'chestW', 'tipV', 'foot', 'stumble', 'jerk', 'handJump', 'yawDev', 'selfImp', 'selfShare'];
  const agg = (which) => Object.fromEntries(keys.map((k) => [k, [r2(q(runs.map((r) => r[which][k]), 0.5)), r2(Math.max(...runs.map((r) => r[which][k] ?? 0)))]]));
  return { n: runs.length, fell: runs.filter((r) => r.fell).length, base: agg('base'), win: agg('win'), hold: agg('hold'), turns: r2(q(runs.map((r) => r.turns), 0.5)), drain: r2(q(runs.map((r) => r.drain), 0.5)) };
}

if (isMain(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  for (const kv of String(args.set ?? '').split(';').filter(Boolean)) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = JSON.parse(kv.slice(i + 1));
  }
  const out = {};
  for (const w of String(args.ws || 'zweihander,flamberge,tizona,durandal').split(','))
    for (const move of String(args.moves || 'stand,walk').split(',')) {
      const runs = [];
      for (let seed = 1; seed <= +(args.seeds || 6); seed++) runs.push(swayRun({ w, seed, move, press: 3.8 + 0.1 * (seed - 1), release: +(args.release || 1.5), control: !!+(args.control || 0), held: args.held || 'press' })); // 씨앗마다 누르는 때를 0.1 s 씩 (걸음 박자 자리를 고르게)
      const sm = swaySummary(runs);
      if (args.paired) {
        // 같은 박자 자리의 누르지 않은 판(control)과 짝 차이 (창 안 최대 − 걸음만의 최대): 걸음 자체가 가끔 발 밖으로 벗어나는 몫(control 최대 13 cm 남짓)을 뺌
        const ctl = runs.map((r) => swayRun({ w, seed: r.seed, move, press: 3.8 + 0.1 * (r.seed - 1), release: +(args.release || 1.5), control: true, held: args.held || 'press' }));
        sm.ctl = swaySummary(ctl).win;
        sm.ctlHold = swaySummary(ctl).hold;
        const ex = (wh) => Object.fromEntries(['dTilt', 'side', 'offBal', 'stumble', 'chestW', 'comOff'].map((k) => { const d = runs.map((r, i) => (r[wh][k] ?? 0) - (ctl[i][wh][k] ?? 0)); return [k, [r2(q(d, 0.5)), r2(Math.max(...d))]]; }));
        sm.excess = ex('win');
        sm.excessHold = ex('hold');
      }
      out[`${w}/${move}`] = { ...sm, runs: args.runs ? runs : undefined };
      console.log(`${w} ${move}: ${JSON.stringify(sm)}`);
    }
  if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
}
