// 손잡이 찍기(Knaufschlag) 시제품 재기 — skill.pommel()·closeQuarters then 'pommel' (10/9, docs/strike/pommel_strike_2026-10-09.md).
//  src 기본값은 건드리지 않는다: 이 도구 안에서만 인물의 close 를 바꾸거나 pommel() 을 직접 부른다.
//
//  probe : 홀로 탐침. 찍는 쪽 P(옛 보정 'old', 숙련 0.7 = AI normal 과 같은 손)가 가만히 선 상대 E(AI 없음, 칼은 기본 자세) 앞에서
//          2.3 s(판 시작 발 묶임 ARENA.startHold 2 s 뒤) 서 있다가 skill.pommel() 을 한 번 부른다. 0.6 s 동안 P 의 무기가 E 몸에 닿은 모든 판정(analyze, 6 J 문턱 아래 포함)을 적는다.
//          폼멜 빠르기 = 칼 원점에서 칼 축 −knob(폼멜 가운데) 점의 월드 속도. 거리(시작 간격) 3 · 시작 손 자리 3 · 씨앗 --seeds(기본 2; 상대 AI 가 없어 씨앗이 거의 안 바꾼다) = 18 번.
//          --chamber --drive --hold --recover --side --elev --past --step --pull=x,y --pitch --yaw --target 로 POMMEL 값을 이 도구 안에서만 바꿔 본다. --quiet 면 합계 줄만
//  duel  : 48 판(씨앗 1000+s · 2000+s, s = 1..24, 40 s, motion_lab duel·pommel_count 와 같은 차림) 롱소드 대 롱소드, 둘 다 AI normal.
//          X 쪽 인물만 close = { rate: 0.8, kind: 'barge', then } (then = pommel | cut | none), Y 는 롱소드 기본 인물.
//          X 인물값 = --x (기본 heinrich: 인물표 그대로에 close 만 바꿈. 롱소드 기본 인물은 붙지 않아 밀치기 0 번 — 아래 duel 주석)
//          X 의 밀치기 수 · 찍기 시작 수 · 자루 맞음(폼멜/손잡이/코등이 — pommel_count 의 칼 축 좌표 나눔) · 폼멜 에너지 · 부위 ·
//          찍는 동안(skill.pom) 칼날이 닿은 수 · Y 넘어짐(stand → 다른 상태) · 이김/짐.
//  실행: node tools/sim/pommel_trial.mjs probe [--elev=60] [--target=head]
//        node tools/sim/pommel_trial.mjs duel --then=pommel|cut|none [--N=24] [--x=heinrich|longsword|인물 id] [--press=0.8] [--gap=0.9]
//          --press: Y 의 발을 늘 앞으로(스틱 앞 값, 가슴 0.55 m 까지). 기본 0.8. 0 = AI 그대로 (그러면 롱소드 AI 둘은 가슴 0.77 m 안에 머물지 않아
//           밀치기·찍기가 0 번 — 하인리히 인물로도 4 판 들어섬 E1 0 번: AI 의 '붙으면 떨어짐'이 먼저 돈다)
//          --gap: 시작 간격(골반 사이, m). AI 끼리는 붙지 않으므로(아래) 붙은 채 시작하는 판(0.9)으로 근접 사건을 만든다. 없으면 ARENA.startGap
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? '1']; }));
const mode = pos[0] ?? 'probe';
const { POMMEL } = CONFIG;
if (args.elev != null) POMMEL.elev = +args.elev;
if (args.target) POMMEL.target = args.target;
if (args.past != null) POMMEL.past = +args.past;
if (args.drive != null) POMMEL.drive = +args.drive;
if (args.chamber != null) POMMEL.chamber = +args.chamber;
if (args.side != null) POMMEL.side = +args.side;
if (args.hold != null) POMMEL.hold = +args.hold;
if (args.recover != null) POMMEL.recover = +args.recover;
if (args.step != null) POMMEL.step = +args.step;
if (args.pull) POMMEL.pull = args.pull.split(',').map(Number);
if (args.pitch != null) POMMEL.body = { ...POMMEL.body, pitch: +args.pitch };
if (args.yaw != null) POMMEL.body = { ...POMMEL.body, chestYaw: +args.yaw, pelvisYaw: +args.yaw / 2 };
const SEEDS = +(args.seeds ?? 2);
const quiet = !!args.quiet;

const med = (a) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return +b[Math.floor(b.length / 2)].toFixed(1); };
const max = (a) => (a.length ? +Math.max(...a).toFixed(1) : null);
const bump = (o, k) => { o[k] = (o[k] ?? 0) + 1; };
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();

/** 무기의 어디가 닿았나: 칼날 부품은 'blade', 자루는 칼 축 좌표로 폼멜·손잡이·코등이 (pommel_count.mjs 와 같은 나눔) */
function wpartOf(att, pr, point, S) {
  if (pr.w.part !== 'hilt') return 'blade';
  const ly = _v.copy(point).sub(S.p).applyQuaternion(_q.copy(S.q).invert()).y;
  const HL = att.weaponCfg.hiltLength;
  return ly < -0.07 ? 'pommel' : ly > HL - 0.05 ? 'guard' : 'grip';
}

/** 폼멜 가운데 월드 자리 */
function pommelPos(f, out) {
  const p = f.sword.translation();
  const q = f.sword.rotation();
  return out.set(0, -POMMEL.knob, 0).applyQuaternion(_q.set(q.x, q.y, q.z, q.w)).add(_v.set(p.x, p.y, p.z));
}

class Still {
  constructor() {}
  update() {}
}

function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) f.skill[k]?.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0);
  f.skill.vel.set(0, 0);
  f.skill.follow.set(0, 0);
}

if (mode === 'probe') {
  const PADS = { pflug: [0.18, -0.28], ochs: [0.22, 0.26], mid: [0.0, 0.0] };
  const GAPS = (args.gaps ?? '0.65,0.75,0.85').split(',').map(Number); // 시작 간격 (골반 사이, m). 붙은 가슴 거리는 아래 d 로 잰다
  const rows = [];
  const agg = { n: 0, started: 0, anyContact: 0, firstPart: {}, pommelHit: 0, hiltHit: 0, bladeHit: 0, bladeReal: 0, pommelReal: 0, bladePhase: {}, bladeEmax: [], bladeFirst: 0, pommelE: [], hiltE: [], vAt: [], vPeak: [], zones: {}, over45: 0, down: 0, minGap: [], d: [] };
  for (const gap of GAPS) {
    for (const [pn, pad] of Object.entries(PADS)) {
      for (let s = 0; s < SEEDS; s++) {
        const G = newRound({ walls: false, seed: 700 + s + Math.round(gap * 100) * 10, weapon: 'longsword', gap, AIClass: Still });
        const P = G.player, E = G.enemy;
        P.skill.corr = CONFIG.SKILL.corrAI;
        P.skill.level = CONFIG.AI_LEVELS.normal.skill;
        const log = [];
        const C = G.combat;
        const oa = C.analyze.bind(C);
        C.analyze = (pr, point, S, PP, predicting = false) => {
          const r = oa(pr, point, S, PP, predicting);
          if (!predicting && r && pr.w.fighter === P && pr.v.fighter === E) log.push({ t: G.t, wpart: wpartOf(P, pr, point, S), type: r.type, zone: r.zone, energy: r.energy, speed: r.speed, part: pr.v.part });
          return r;
        };
        G.before = () => {
          if (G.t < 2.3) setHand(P, pad);
        };
        for (let i = 0; i < 2.3 / DT; i++) G.step();
        const a = P.bodies.chest.translation(), b = E.bodies.chest.translation();
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        log.length = 0;
        const ok = P.skill.pommel();
        const t0 = G.t;
        const pp = new THREE.Vector3(), prev = pommelPos(P, new THREE.Vector3());
        const sp = [];
        let minGap = Infinity;
        let eDown = false;
        for (let i = 0; i < 0.6 / DT; i++) {
          G.step();
          pommelPos(P, pp);
          sp.push({ t: G.t - t0, v: pp.distanceTo(prev) / DT });
          prev.copy(pp);
          const h = E.bodies.head.translation();
          minGap = Math.min(minGap, Math.hypot(pp.x - h.x, pp.y - h.y, pp.z - h.z));
          if (E.state !== 'stand') eDown = true;
        }
        const first = log[0];
        const pom = log.filter((r) => r.wpart === 'pommel');
        const hilt = log.filter((r) => r.wpart !== 'blade');
        const blade = log.filter((r) => r.wpart === 'blade');
        const bestPom = pom.length ? pom.reduce((m, r) => (r.energy > m.energy ? r : m)) : null;
        const vAt = first ? sp.reduce((m, x) => (Math.abs(x.t - (first.t - t0)) < Math.abs(m.t - (first.t - t0)) ? x : m)).v : null;
        const vPeak = Math.max(...sp.map((x) => x.v));
        agg.n++;
        if (ok) agg.started++;
        if (first) {
          agg.anyContact++;
          bump(agg.firstPart, first.wpart);
          if (first.wpart === 'blade') agg.bladeFirst++;
          agg.vAt.push(vAt);
        }
        if (pom.length) agg.pommelHit++;
        if (hilt.length) agg.hiltHit++;
        if (blade.length) agg.bladeHit++;
        const bReal = blade.filter((r) => r.energy >= CONFIG.STRIKE.minEnergy);
        if (bReal.length) {
          agg.bladeReal++; // 판정 문턱(6 J)을 넘은 칼날 맞음 = 찍기 대신 칼날이 친 것. 언제였나: 당김(칼끝을 세움)·내지름(+버팀)·돌아옴(칼끝이 다시 앞으로 내려옴)·끝난 뒤
          const tb = bReal[0].t - t0;
          bump(agg.bladePhase, tb < POMMEL.chamber ? 'chamber' : tb < POMMEL.chamber + POMMEL.drive + POMMEL.hold ? 'drive' : tb < POMMEL.chamber + POMMEL.drive + POMMEL.hold + POMMEL.recover ? 'recover' : 'after');
          agg.bladeEmax.push(Math.max(...bReal.map((r) => r.energy)));
        }
        if (pom.some((r) => r.energy >= CONFIG.STRIKE.minEnergy)) agg.pommelReal++;
        if (bestPom) {
          agg.pommelE.push(bestPom.energy);
          bump(agg.zones, bestPom.zone);
          if ((bestPom.zone === 'head' || bestPom.zone === 'neck') && bestPom.energy > 45) agg.over45++;
        }
        if (hilt.length) agg.hiltE.push(Math.max(...hilt.map((r) => r.energy)));
        agg.vPeak.push(vPeak);
        agg.minGap.push(minGap * 100);
        agg.d.push(d);
        if (eDown) agg.down++;
        rows.push({ gap, pad: pn, s, d: +d.toFixed(2), ok, first: first ? `${first.wpart}->${first.zone} ${first.energy.toFixed(0)}J @${(first.t - t0).toFixed(2)}s` : '-', pommel: bestPom ? `${bestPom.zone} ${bestPom.energy.toFixed(0)}J v${bestPom.speed.toFixed(1)}` : '-', blade: blade.length, vPeak: +vPeak.toFixed(1), gapHead_cm: +(minGap * 100).toFixed(0), eDown });
      }
    }
  }
  if (!quiet) for (const r of rows) console.log(JSON.stringify(r));
  console.log(JSON.stringify({ mode, POMMEL: { side: POMMEL.side, chamber: POMMEL.chamber, drive: POMMEL.drive, hold: POMMEL.hold, elev: POMMEL.elev, target: POMMEL.target, step: POMMEL.step, past: POMMEL.past, pull: POMMEL.pull, body: POMMEL.body }, n: agg.n, started: agg.started, anyContact: agg.anyContact, firstPart: agg.firstPart, pommelHit: agg.pommelHit, pommelOver6J: agg.pommelReal, hiltHit: agg.hiltHit, bladeHit: agg.bladeHit, bladeOver6J: agg.bladeReal, bladeOver6J_phase: agg.bladePhase, bladeE_med: med(agg.bladeEmax), bladeFirst: agg.bladeFirst, pommelE_med: med(agg.pommelE), pommelE_max: max(agg.pommelE), hiltE_med: med(agg.hiltE), zones: agg.zones, headOver45: agg.over45, foeNotStanding: agg.down, vAtContact_med: med(agg.vAt), vPeak_med: med(agg.vPeak), pommelHeadGap_cm_med: med(agg.minGap), chestDist_med: med(agg.d) }));
} else if (mode === 'duel') {
  const then = args.then ?? 'pommel';
  const xId = args.x ?? 'heinrich';
  const press = +(args.press ?? 0.8);
  const N = +(args.N ?? 24);
  const S = { shoves: 0, pommels: 0, pommelSrc: {}, closeCut: 0, hits: 0, hilt: 0, hiltPart: { pommel: 0, grip: 0, guard: 0 }, pommelE: [], hiltE: [], hiltZone: {}, pommelZone: {}, hiltOver45Head: 0, hiltInPom: 0, bladeInPom: 0, yFalls: 0, xFalls: 0, cutHits: 0, stabHits: 0, pomD: [], pomLanded: 0, pomYFall: 0, ev: {}, bladePomE: [], bladePomType: {}, fallBy: {} };
  let W = 0, L = 0, D = 0;
  const close = (e) => {
    S.pomD.push(e.d);
    if (e.landed) S.pomLanded++;
    if (e.fell) S.pomYFall++;
  };
  for (let s = 1; s <= N; s++) {
    for (const xFirst of [true, false]) {
      const seed = (xFirst ? 1000 : 2000) + s;
      // X: 롱소드 기본 인물은 붙은 거리(가슴 0.77 m)까지 들어오지 않는다 (탐색: 4 판 가슴 거리 최소 1.03~1.63 m, 들어섬 E1 0 번) →
      //  붙는 인물(기본 하인리히 — 제원 롱소드 복제품, margin 작음·vor 높음)의 인물값에 close 만 바꿔 끼운다. --x=longsword 면 롱소드 기본 인물
      const xc = xId === 'longsword' ? null : CHARACTERS_BY_ID[xId];
      const x = { weapon: xc ? xc.weapon : 'longsword', difficulty: xc?.ai.level ?? 'normal', persona: { ...(xc ? xc.ai.persona : { school: 'longsword' }), close: { rate: 0.8, kind: 'barge', then } } };
      const y = { weapon: 'longsword', persona: { school: 'longsword' } };
      const P = xFirst ? x : y, E = xFirst ? y : x;
      const G = newRound({ walls: true, seed, gap: args.gap != null ? +args.gap : undefined, weapon: P.weapon, weapon2: E.weapon, difficulty: E.difficulty ?? 'normal', persona: E.persona, AI2Class: AI, difficulty2: P.difficulty ?? 'normal', persona2: P.persona });
      const X = xFirst ? G.player : G.enemy, Y = xFirst ? G.enemy : G.player;
      const XA = xFirst ? G.ai2 : G.ai;
      // 미는 상대(--press, 기본 0.8): Y 는 AI 그대로(손·막기·베기)인데 발만 늘 앞으로 — AI 끼리는 붙은 거리에 머물지 않아서(아래 주석)
      //  근접 사건이 안 생긴다. 플레이어가 붙어 들어오는 판을 흉내 낸다. 0 이면 AI 그대로
      if (press > 0) G.before = () => { if (Y.state === 'stand' && Y.foeDistance() > 0.55) Y.move.y = Math.max(Y.move.y, press); };
      let pomLive = 0; // 찍기가 끝난 뒤 0.1 s 까지 '찍는 동안'으로 본다 (닿음 사건이 한두 스텝 늦게 올 수 있다)
      let pomCount = 0;
      let lastHit = null; // X 의 마지막 맞힘 (넘어짐 까닭 가늠: 넘어지기 0.5 s 안의 마지막 맞힘)
      let ev = null; // 이번 찍기: 자루가 맞혔나 · 상대가 넘어졌나 (찍기 시작 ~ 끝 + 0.5 s)
      const orig = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, point, pr) => {
        orig(att, vic, r, point, pr);
        if (att !== X) return;
        S.hits++;
        const sw = att.cache?.sword;
        const wp = wpartOf(att, pr, point, { p: sw?.p ?? att.sword.translation(), q: sw?.q ?? att.sword.rotation() });
        const inPom = pomLive > 0;
        lastHit = { t: G.t, k: `${wp}:${r.type}:${r.zone}` };
        if (wp === 'blade') {
          if (inPom) {
            S.bladePomE.push(r.energy);
            bump(S.bladePomType, r.type);
          }
          if (r.type === 'cut') S.cutHits++;
          else if (r.type === 'stab') S.stabHits++;
          if (inPom) S.bladeInPom++;
          return;
        }
        S.hilt++;
        S.hiltPart[wp]++;
        S.hiltE.push(r.energy);
        bump(S.hiltZone, r.zone);
        if (inPom) S.hiltInPom++;
        if (inPom && ev) ev.landed = true;
        if (wp === 'pommel') {
          S.pommelE.push(r.energy);
          bump(S.pommelZone, r.zone);
        }
        if ((r.zone === 'head' || r.zone === 'neck') && r.energy > 45) S.hiltOver45Head++;
      };
      let yPrev = Y.state, xPrev = X.state;
      let res = 'D';
      for (let i = 0; i < 40 / DT; i++) {
        G.step();
        pomLive = X.skill.pom ? 0.1 : Math.max(0, pomLive - DT);
        if (X.skill.pommels !== pomCount) {
          pomCount = X.skill.pommels;
          if (ev) close(ev);
          const a = X.bodies.chest.translation(), b = Y.bodies.chest.translation();
          ev = { t: G.t, d: Math.hypot(a.x - b.x, a.z - b.z), landed: false, fell: false };
        }
        if (ev && !ev.fell && Y.state !== 'stand' && G.t - ev.t < 0.9) {
          ev.fell = true;
          bump(S.fallBy, lastHit && G.t - lastHit.t < 0.5 ? lastHit.k : 'no hit 0.5 s');
        }
        if (ev && G.t - ev.t >= 0.9) { close(ev); ev = null; }
        if (Y.state !== yPrev && yPrev === 'stand' && (Y.state === 'down' || Y.state === 'dead' || Y.state === 'kneel')) S.yFalls++;
        if (X.state !== xPrev && xPrev === 'stand' && (X.state === 'down' || X.state === 'dead' || X.state === 'kneel')) S.xFalls++;
        yPrev = Y.state;
        xPrev = X.state;
        const xd = X.state === 'dead', yd = Y.state === 'dead';
        if (xd || yd) { res = xd && yd ? 'D' : yd ? 'W' : 'L'; break; }
      }
      if (ev) close(ev);
      if (res === 'W') W++; else if (res === 'L') L++; else D++;
      S.shoves += X.shoves ?? 0;
      S.pommels += XA.stats.pommels ?? 0;
      if (XA.lastPommel) bump(S.pommelSrc, XA.lastPommel);
      S.closeCut += XA.closeEv.cut;
      for (const k of ['E1', 'E2', 'E4', 'won']) S.ev[k] = (S.ev[k] ?? 0) + XA.closeEv[k];
    }
  }
  console.log(JSON.stringify({ mode, then, x: xId, press, gap: args.gap ?? 'start', fights: 2 * N, X_W: W, X_L: L, D, shoves: S.shoves, closeEv: S.ev, pommels: S.pommels, pomDist_med: med(S.pomD), pomLanded: S.pomLanded, pomFoeFell: S.pomYFall, closeCut: S.closeCut, xHits: S.hits, cut: S.cutHits, stab: S.stabHits, hilt: S.hilt, hiltPart: S.hiltPart, hiltInPom: S.hiltInPom, bladeInPom: S.bladeInPom, pommelE_med: med(S.pommelE), pommelE_max: max(S.pommelE), hiltE_med: med(S.hiltE), pommelZone: S.pommelZone, bladeInPomE_med: med(S.bladePomE), bladeInPomType: S.bladePomType, pomFallBy: S.fallBy, hiltZone: S.hiltZone, hiltHeadOver45: S.hiltOver45Head, yFalls: S.yFalls, xFalls: S.xFalls }));
} else throw new Error(`모드 없음: ${mode} (probe | duel)`);
