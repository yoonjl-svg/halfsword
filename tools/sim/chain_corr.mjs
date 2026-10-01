// ─────────────────────────────────────────────────────────────
//  chain_corr.mjs — 검술 보정 v2 측정 한 벌 (설계 docs/strike/correction_v2_design_2026-10-01.md '측정 계획')
//   wbs-impl(895973d) tools/sim/chain.mjs 의 장면 틀을 옮김: hybrid 걸음, 쟁기에서 2 s 선 뒤 감기 자리(3 m/s, 누른 채) → 베기 획.
//   플레이어는 게임과 같은 입력 길로만 움직인다 (corr_lib inputPump: 손가락 이벤트 → input.js → main.js frame() 차례, 누르는 동안 handHeld).
//   상대는 가만히 (칼 충돌 끔, 죽지 않음, 참수 뒤 목 상처 건너뜀 = chain.mjs 와 같음). hitMove 만 상대가 제 move 입력으로 걷는다 (몸을 옮기지 않는다)
//
//   node tools/sim/chain_corr.mjs [--root=<트리>] [--modes=old0,old07,v204,v207,v21,v207tip0] [--scenes=air,stop,hit,hitMove]
//        [--fams=diagR,vert,horizR,riseR,novA,novB,novC,liftShort,holdShort] [--input=60,120,30J,J] [--limits=on,off]
//        [--seed=7] [--reps=1] [--weapon=longsword] [--quick] [--json=<파일>] [--rows=0] [--shortDeg=25]
//   --root: 그 트리의 src/ 와 tools/sim/harness_m.mjs 를 읽기만 한다 (base_src·시험 트리). 측정 도우미(corr_lib·envelope_check)는 이 트리 것
//   방식: oldS = skill.corr 'old' 설정 S, v2S = 'v2' 설정 S 끝점 겨눔 켬, v207tip0 = v2 0.7 끝점 겨눔 끔(② 대조군). old0 = v2 0 = 맨 팔.
//         S 는 숫자: 0 · 04 → 0.4 · 07 → 0.7 · 1 · 085 → 0.85. SKILL.corr 가 없는 트리의 v2 방식은 'feature absent' 로 건너뛴다
//   장면: air = 2.0 m 헛치기 (내 칼 충돌 끔) · stop = 획 절반에서 손가락 멈춤, 1 s 누른 채, 그 뒤 끝까지 이어 긋고 뗌 (2.0 m, 내 칼 충돌 끔)
//         hit = 1.55 m 서 있는 과녁 (내 칼 충돌 켬) · hitMove = hit 에 상대가 감기 시작부터 획 끝 + 0.3 s 까지 옆(across)·앞(toward)으로 걷는다 (둘 다 돈다)
//   무리: chain.mjs 넷 (손가락 12 m/s) + 초보 긋기 novA/novB/novC (design_novice_feel §8) + liftShort (머리 선보다 25° 위에서 멈추고 곧바로 뗌 = ② 양성)
//         + holdShort (같은 멈춤을 1 s 누른 채 = ② 음성: 일부러 멈춘 것이 베기로 채워지면 안 된다). stop 장면에선 두 짧은 무리를 건너뛴다 (이미 멈춤)
//         --shortDeg=20,25,30 이면 짧은 무리를 각마다 돈다 (기본 25). 초보 긋기·짧은 무리는 감기 자리에서 0.5 s 쥔 뒤 긋는다 (corr_lib FAM chHold)
//   입력: 60 · 120 Hz, 30J = 30 fps ± 25 % 씨앗 흔들림 (24~40 fps), J = 24~45 fps 씨앗 수열 (chain.mjs jitter 와 같은 식)
//   --limits: BODY.humanLimits (생략 = 설정 그대로 한 값). 기능이 없는 트리는 'n/a' 로 한 번
//   --quick: 장면 air,hit · 무리 diagR,novA,liftShort,holdShort · 입력 60 · reps 1 (방식은 주는 대로)
//
//  한 판 차례: 판 → 2 s 섬 → 감기 획 → 베기 획 (i0) → [stop: 1 s 누름 → 이어 긋기] → 뗌 (iL) → 다시 닿음 → 0.5 s.
//   다시 닿음 = 손가락을 대고 300 ms 동안 0.03 m 천천히 끈 뒤 뗌 (탭이 아님: tapMs 180 넘김). liftShort 는 뗌 + 150 ms (② 붙잡음 중, recoverDelay 0.25 s 앞),
//   다른 무리는 뗌 + 2.0 s (되돌아옴 도착 뒤), stop 장면은 이어 긋기 시작이 '멈춘 뒤' 넘김
//  잰 값 (한 줄 json, 없는 칸 = null → 표에서 n/a):
//   tipPk 칼끝 최고 |tipVel| (i0 … 뗌 + 0.3 s) · tipHit 첫 닿음 스텝의 |tipVel| · E1·Emean 상처 에너지 (J) · hps = 상처 (i0 … 뗌 + 0.5 s) / skill.swings (감기 시작 … 같은 끝)
//   contacts: 닿음 사건(같은 부위 2 스텝 넘게 끊기면 새 사건)의 첫 분석 — cut / flat (칼날, ea ≤ STRIKE.edgeAlign, 찌르기 후보 아님) / underE / blunt / stab
//     eaDeg1 = 첫 사건 acos(edgeAlign) (combat.js:141-181 식을 corr_lib tapEdge 가 다시 잰다) · eaDegMean · flatShare = flat / 칼날 사건
//   ① (fighter.corr): opens·closes·switches(창 안 부위 바뀜, 0 이어야) 차이, winMs 창 길이들, rollWin 창 안 굴린 각 Σ|ω·b|dt (°),
//     roll2f 첫 닿음 전 화면 2프레임 동안 굴린 각 (°, 모든 방식), rtOpen·rtClose 열고 닫는 스텝의 굴림 목표 계단 (°),
//     fastRoll = |ω·b| > 40 rad/s 인데 닿음(탭 ±2 스텝·bladeTouch) 밖인 스텝 수 (모든 방식)
//   ② (fighter.corr): onsets (획 … 다시 닿음 앞), onsetsHold (holdShort 누름 동안), carried = φ* − φ손가락 (°), arcLeft 남은 호 몫, tipOutMax 면 밖 각 (°, 0 이어야),
//     ends = tipEnd 바뀐 차례, released = 붙잡음이 풀린 까닭 (walk | touch)
//   jump: 다시 닿음(또는 이어 긋기) 첫 3 스텝 손 목표 변화 (mm, 가슴 원점·바라보는 틀) · jumpDeg 명령 칼 방향(debug.aim) 변화 (°). kind = hold | recovered | stop
//   agree: 획 방향(패드) ↔ 손 목표 3 스텝 변위(앞 깊이 포함) 사이 각, 손 변위 가중 평균, 획 시작 … 획 끝 + 0.1 s (°); agree2 = 같은 것을 옆·위만; handFwd = 그 창의 손 목표 앞 이동 (m)
//   trunk·pelvis: 칼날 70 % 점 최고 속도 때 가슴·골반이 실은 몫 (%, body_share 식)
//   recMs: 뗌 → skill.readies 가 는 때 (skill.readyT) · dSurf: 칼끝 길 ↔ 겨눈 부위(fighter.corr.part, 없으면 가장 가까운 부위) 충돌체 표면 최소 부호 거리 (m, − = 파고듦)
//   shortStop: 맞힘 장면에서 상처 없이 dSurf > 0 · env: envelope_check 스텝 수 (감기부터 끝까지, 플레이어; viol = 설계·문헌 칸 + 두 발 뜸 + 제 몸 뚫림, clip = 봉투 클립 범위 밖 참고)
//   falls: 선 자세에서 쓰러짐·무릎 · recContacts: 뗌 + 0.5 s 뒤 … 다시 닿음 앞 상처 (되돌아오며 닿은 것)
//  끝에 방식 × 장면 요약 (중앙값 [p10–p90] n), ② 음성 확인 줄, 걸린 시간·판 수
// ─────────────────────────────────────────────────────────────
import { writeFileSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hasCorr, hasLimits, setCorr, inputPump, feedTrace, pacer, stroke, setPad, tapEdge, PAD, FAM, SHORT_DEG, padYForEl, q as quant, med, mean, rN } from './corr_lib.mjs';
import { Counter, partDist } from './envelope_check.mjs';

// ── 인자 ──
const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = realpathSync(resolve(arg('root', resolve(HERE, '..', '..'))));
const QUICK = !!arg('quick', false);
const MODES = list('modes', 'old0,old07,v204,v207,v21,v207tip0');
const SCENES = list('scenes', QUICK ? 'air,hit' : 'air,stop,hit,hitMove');
const FAMS = list('fams', QUICK ? 'diagR,novA,liftShort,holdShort' : 'diagR,vert,horizR,riseR,novA,novB,novC,liftShort,holdShort');
const INPUTS = list('input', QUICK ? '60' : '60,120,30J,J');
const SEED = +arg('seed', 7);
const REPS = +arg('reps', 1);
const WEAPON = arg('weapon', 'longsword');
const JSON_OUT = arg('json', null);
const SHORT_DEGS = list('shortDeg', String(SHORT_DEG)).map(Number); // 짧은 무리 멈춤 각 (°, 머리 가운데 선 위). 20,25,30 처럼 여럿이면 짧은 무리를 각마다 돈다
const ROWS = arg('rows', '1') !== '0';
for (const f of FAMS) if (!FAM[f]) throw new Error(`모르는 무리 ${f}`);
for (const s of SCENES) if (!['air', 'stop', 'hit', 'hitMove'].includes(s)) throw new Error(`모르는 장면 ${s}`);
function parseMode(m) {
  const x = m.match(/^(old|v2)(\d+)(tip0)?$/);
  if (!x) throw new Error(`모르는 방식 ${m}`);
  const d = x[2];
  const level = d.length > 1 && d[0] === '0' ? +`0.${d.slice(1)}` : +d;
  return { name: m, corr: x[1], level, tip: !x[3] };
}
const MODE_DEFS = MODES.map(parseMode);

// ── 부팅 ──
const cfg = await import(pathToFileURL(join(ROOT, 'src/config.js')).href);
cfg.BODY.weightMode = 'hybrid'; // chain.mjs 와 같게 (tools/sim/hybrid.mjs)
const H = await import(pathToFileURL(join(ROOT, 'tools/sim/harness_m.mjs')).href);
const { newRound, DT, THREE } = H;
const { Input } = await import(pathToFileURL(join(ROOT, 'src/input.js')).href);
const { Combat } = await import(pathToFileURL(join(ROOT, 'src/combat.js')).href);
const HAS = hasCorr(cfg);
const HASL = hasLimits(cfg);
const LIMITS = arg('limits', null) == null ? [HASL ? (cfg.BODY.humanLimits ? 'on' : 'off') : 'n/a'] : list('limits', 'off');
const deps = { Input, CONFIG: cfg, DT };
const tap = tapEdge(Combat, THREE, cfg);
const R2D = 180 / Math.PI;
const GAP = 2.0, HIT_DIST = 1.55, CHV = 3, STOP_FRAC = 0.5; // chain.mjs 와 같다
const HOLD_RETOUCH = 0.15, LATE_RETOUCH = 2.0, POST = 0.5; // s: 위 머리글 (다시 닿는 때·끝 여유)
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Qq = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);

const FOE_PARTS = ['head', 'chest', 'abdomen', 'pelvis', 'uarmS', 'farmS', 'uarmO', 'farmO', 'thighF', 'thighB'];

function snapCorr(c) {
  if (!c) return null;
  const rt = c.rollTarget;
  return {
    win: !!c.win, part: c.part ?? null, tau: c.tau ?? null, vClose: c.vClose ?? null, tRoll: c.tRoll ?? null, opens: c.opens ?? null, closes: c.closes ?? null, switches: c.switches ?? null,
    rt: rt ? [rt.x, rt.y, rt.z] : null, tip: !!c.tip, tipHold: !!c.tipHold, tipOnsets: c.tipOnsets ?? null, tipCarried: c.tipCarried ?? null, tipArcLeft: c.tipArcLeft ?? null, tipOut: c.tipOut ?? null, tipEnd: c.tipEnd ?? null,
  };
}

function trial(o) {
  const M = o.mode;
  if (HASL && o.limits !== 'n/a') cfg.BODY.humanLimits = o.limits === 'on';
  const dist = o.scene.startsWith('hit') ? HIT_DIST : GAP;
  const G = newRound({ walls: false, gap: dist + 0.17, seed: SEED + o.rep, weapon: WEAPON });
  const P = G.player, E = G.enemy;
  const foeMv = { x: 0, y: 0 };
  G.ai.update = () => E.move.set(foeMv.x, foeMv.y);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  if (!o.scene.startsWith('hit')) for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  const aw = E.applyWound.bind(E);
  E.applyWound = (h) => { if (!(E.decapitated && h.zone === 'neck')) aw(h); };
  P.skill.level = M.level;
  setCorr(cfg, P, M.corr, M.tip);
  setPad(P, PAD.Pflug);
  const pump = inputPump(G, deps, { pace: pacer(o.input, SEED + o.rep) });
  const wounds = [];
  G.onWound = (att, vic, r) => { if (att === P) wounds.push({ k: S.length, gt: G.t, zone: r.zone, E: r.energy, v: r.speed, rec: tap.info.get(r) ?? null }); };
  const recs = [];
  const lis = (rec) => { if (rec.att === P) recs.push({ ...rec, k: S.length, att: undefined, vic: undefined }); };
  tap.listeners.add(lis);
  let falls = 0;
  const env = new Counter();
  const S = [];
  const partN = FOE_PARTS.filter((n) => E.bodies[n]);
  const yawInv = () => P.yaw.clone().invert();
  let counting = false;
  let prevState = P.state;
  const snap = () => {
    const tip = P.bladePoint(1, new THREE.Vector3());
    const hilt = P.bladePoint(0, new THREE.Vector3());
    const axis = tip.clone().sub(hilt).normalize();
    const w = V(P.sword.angvel());
    const chest = V(P.bodies.chest.translation());
    const tgt = P.handTarget.clone().sub(chest).applyQuaternion(yawInv());
    // 칼날 70 % 점 속도와 가슴·골반 몫 (body_share 식)
    const c = P.weaponCfg;
    const p70 = new THREE.Vector3(0, c.hiltLength + 0.7 * c.bladeLength, 0).applyQuaternion(Qq(P.sword.rotation())).add(V(P.sword.translation()));
    const v70 = V(P.sword.velocityAtPoint(p70));
    const sk = P.skill;
    const s = {
      gt: G.t, fr: pump.frames, off: [P.handOffset.x, P.handOffset.y], held: !!P.handHeld, tgt: [tgt.x, tgt.y, tgt.z], tipV: P.tipVel.length(), tip: [tip.x, tip.y, tip.z],
      rollW: w.dot(axis), v70: v70.length(), v70d: v70, p70, aim: P.debug?.aim ? P.debug.aim.clone() : null, swings: sk.swings,
      c: snapCorr(P.corr), bladeTouch: P.bladeTouch ?? null, recovering: !!sk.recovering, recoverP: sk.recoverP ?? null, readies: sk.readies ?? null, readyT: sk.readyT ?? null, lift: sk.lift ?? null, state: P.state,
    };
    // 도구 쪽 'ready' (모든 방식): skill.js(7a474b2) 'ready' 사건과 같은 조건 — 휘두르지 않음, 칼끝이 가슴 앞 (가슴 틀 x > 0, |y| ≤ 0.13, |z| ≤ 0.18 = 가슴 상자 반 높이·반 폭), 두 발 디딤
    {
      const tc = tip.clone().sub(chest).applyQuaternion(yawInv());
      const g = P.gait;
      s.rdy = !(sk.vel.length() > cfg.SKILL.swingSpeed) && tc.x > 0 && Math.abs(tc.y) <= 0.13 && Math.abs(tc.z) <= 0.18 && (!g?.active || (g.legs.F.stance && g.legs.B.stance));
    }
    const v = s.v70 > 1e-6 ? v70.clone().divideScalar(s.v70) : null;
    s.chShare = v ? V(P.bodies.chest.velocityAtPoint(p70)).dot(v) / s.v70 : 0;
    s.pelShare = v ? V(P.bodies.pelvis.velocityAtPoint(p70)).dot(v) / s.v70 : 0;
    delete s.v70d;
    delete s.p70;
    // 칼끝 ↔ 상대 부위 충돌체 표면 부호 거리 (칼끝 겨눔 오차)
    s.dPart = {};
    for (const n of partN) s.dPart[n] = partDist(E.bodies[n], tip);
    return s;
  };
  const step = () => {
    G.step();
    S.push(snap());
    if (counting) env.add(P, DT);
    if (prevState === 'stand' && P.state !== 'stand') falls++;
    prevState = P.state;
  };
  const runUntil = (q, max = 20 / DT) => { let g = 0; while (!q.done && g++ < max) step(); };
  // 1) 섬
  for (let i = 0; i < Math.round(2.0 / DT); i++) step();
  counting = true;
  // 2) 감기
  const F = FAM[o.fam];
  if (o.scene === 'hitMove') Object.assign(foeMv, o.foeMove === 'toward' ? { x: 0, y: 1 } : { x: 1, y: 0 });
  const off0 = [P.handOffset.x, P.handOffset.y];
  const iCh = S.length; // 감기 시작 (휘두름 수는 여기부터: 감기에서 곧장 베면 quiet < 0.2 s 라 베기 획이 새 휘두름으로 안 센다, skill.js:386)
  const chq = feedTrace(G, stroke(F.ch[0] - off0[0], F.ch[1] - off0[1], CHV, { lift: false, hold: F.chHold ?? 0 }));
  runUntil(chq);
  // 3) 베기 획
  let end = F.end;
  let shortInfo = null;
  if (F.short) {
    const hilt = P.bladePoint(0, new THREE.Vector3());
    const h = E.bodies.head.translation();
    const elHead = Math.atan2(h.y - hilt.y, Math.hypot(h.x - hilt.x, h.z - hilt.z));
    end = [F.ch[0], Math.min(F.ch[1], padYForEl(elHead + o.shortDeg / R2D))];
    shortInfo = { deg: o.shortDeg, elHeadDeg: rN(elHead * R2D, 1), padY: rN(end[1], 3) };
  }
  const cur = [P.handOffset.x, P.handOffset.y];
  const tgtPad = o.scene === 'stop' ? [F.ch[0] + STOP_FRAC * (end[0] - F.ch[0]), F.ch[1] + STOP_FRAC * (end[1] - F.ch[1])] : end;
  const dx = tgtPad[0] - cur[0], dy = tgtPad[1] - cur[1];
  const moveT = Math.hypot(dx, dy) / F.v;
  const cut = feedTrace(G, stroke(dx, dy, F.v, o.scene === 'stop' ? { down: false, lift: false, hold: 1000 } : { down: false, lift: true, hold: F.hold ?? 0 }));
  let g = 0;
  do step(); while (cut.t0 == null && ++g < 120);
  const i0 = S.length - 1;
  runUntil(cut);
  let iStrokeEnd = S.findIndex((s, i) => i >= i0 && s.gt >= cut.t0 + moveT - 1e-9);
  if (iStrokeEnd < 0) iStrokeEnd = S.length - 1;
  let iL = S.length - 1; // 뗌 (stop 은 이어 긋기 뒤 뗌)
  let jumpQ = null, jumpKind = null;
  if (o.scene === 'stop') {
    const c2 = [P.handOffset.x, P.handOffset.y];
    const rq = feedTrace(G, stroke(end[0] - c2[0], end[1] - c2[1], F.v, { down: false, lift: true }));
    jumpQ = rq;
    jumpKind = 'stop';
    runUntil(rq);
    iL = S.length - 1;
  }
  if (o.scene === 'hitMove') {
    const tStopFoe = G.t + 0.3;
    while (G.t < tStopFoe) step();
    foeMv.x = 0;
    foeMv.y = 0;
  }
  const tLift = S[iL].gt;
  // 4) 다시 닿음
  const early = o.fam === 'liftShort' && o.scene !== 'stop';
  const tRe = tLift + (o.scene === 'stop' ? LATE_RETOUCH : early ? HOLD_RETOUCH : LATE_RETOUCH);
  while (G.t < tRe - 1e-9) step();
  const rt = feedTrace(G, { fn: (t) => [0.03 * Math.min(1, t / 300), 0], T: 300, down: true, lift: true });
  if (!jumpQ) (jumpQ = rt), (jumpKind = early ? 'hold' : 'recovered');
  runUntil(rt);
  for (let i = 0; i < Math.round(POST / DT); i++) step();
  tap.listeners.delete(lis);
  // ── 잰 값 ──
  const n = S.length;
  const kOf = (t) => { const k = S.findIndex((s) => s.gt >= t - 1e-9); return k < 0 ? n - 1 : k; };
  const iRe = kOf(rt.t0);
  const iWinEnd = Math.min(n - 1, iL + Math.round(0.5 / DT));
  const iTipEnd = Math.min(n - 1, iL + Math.round(0.3 / DT));
  const row = { mode: M.name, corr: M.corr, level: M.level, tip: M.tip, scene: o.scene, foeMove: o.scene === 'hitMove' ? o.foeMove : null, fam: o.fam, input: String(o.input), limits: o.limits, rep: o.rep, feature: { corr: HAS, limits: HASL } };
  if (shortInfo) row.short = shortInfo;
  let tipPk = 0;
  for (let i = i0; i <= iTipEnd; i++) tipPk = Math.max(tipPk, S[i].tipV);
  row.tipPk = rN(tipPk, 2);
  const wIn = wounds.filter((w) => w.k >= i0 && w.k <= iWinEnd);
  const sw = S[iWinEnd].swings - S[Math.max(0, iCh - 1)].swings;
  row.wounds = wIn.length;
  row.swings = sw;
  row.hps = sw > 0 ? rN(wIn.length / sw, 3) : null;
  row.E1 = wIn.length ? rN(wIn[0].E, 1) : null;
  row.Emean = wIn.length ? rN(mean(wIn.map((w) => w.E)), 1) : null;
  row.recContacts = wounds.filter((w) => w.k > iWinEnd && w.k < iRe).length;
  // 닿음 사건
  const ev = [];
  const lastK = {};
  for (const r of recs) {
    if (r.k < i0 || r.k > iWinEnd) continue;
    if (lastK[r.part] == null || r.k - lastK[r.part] > 2) ev.push(r);
    lastK[r.part] = r.k;
  }
  const kinds = { cut: 0, flat: 0, underE: 0, blunt: 0, stab: 0 };
  for (const r of ev) kinds[r.kind]++;
  row.contacts = kinds;
  const bladeEv = ev.filter((r) => r.isBlade);
  row.eaDeg1 = ev.length ? rN(ev[0].eaDeg, 1) : null;
  row.eaDegMean = bladeEv.length ? rN(mean(bladeEv.map((r) => r.eaDeg)), 1) : null;
  row.flatShare = bladeEv.length ? rN(kinds.flat / bladeEv.length, 3) : null;
  const kC = ev.length ? ev[0].k : wIn.length ? wIn[0].k : null;
  row.tipHit = kC != null ? rN(S[kC].tipV, 2) : null;
  // 굴림: 첫 닿음 전 화면 2프레임, 닿음 밖 빠른 굴림
  if (kC != null) {
    const fr0 = S[kC].fr - 2;
    let a = 0;
    for (let i = kC - 1; i >= i0 && S[i].fr >= fr0; i--) a += Math.abs(S[i].rollW) * DT;
    row.roll2f = rN(a * R2D, 1);
  } else row.roll2f = null;
  const inContact = new Uint8Array(n);
  for (const r of recs) for (let i = Math.max(0, r.k - 2); i <= Math.min(n - 1, r.k + 2); i++) inContact[i] = 1;
  let fast = 0;
  for (let i = i0; i < n; i++) if (Math.abs(S[i].rollW) > 40 && !inContact[i] && S[i].bladeTouch !== true) fast++;
  row.fastRoll = fast;
  // ① 창
  const c0 = S[Math.max(0, i0 - 1)].c, c1 = S[iWinEnd].c;
  const dd = (k) => (c1 && c1[k] != null ? c1[k] - (c0?.[k] ?? 0) : null);
  row.win = { opens: dd('opens'), closes: dd('closes'), switches: dd('switches'), winMs: [], rollWin: null, rtOpen: [], rtClose: [], tRoll: c1?.tRoll != null ? rN(c1.tRoll * 1000, 1) : null, part: null };
  if (c1) {
    let run = 0, roll = 0;
    const angA = (a, b) => (a && b ? Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (Math.hypot(...a) * Math.hypot(...b) || 1)))) * R2D : null);
    for (let i = i0; i <= iWinEnd; i++) {
      const c = S[i].c, cp = S[i - 1]?.c;
      if (!c) continue;
      if (c.win) {
        run++;
        roll += Math.abs(S[i].rollW) * DT;
        if (!row.win.part) row.win.part = c.part;
      }
      if (c.win && !cp?.win) row.win.rtOpen.push(rN(angA(c.rt, cp?.rt), 1));
      if (!c.win && cp?.win) row.win.rtClose.push(rN(angA(c.rt, cp.rt), 1));
      if (!c.win && run) (row.win.winMs.push(Math.round(run * DT * 1000)), (run = 0));
    }
    if (run) row.win.winMs.push(Math.round(run * DT * 1000));
    row.win.rollWin = rN(roll * R2D, 1);
  }
  // ② 끝점 겨눔
  row.tip2 = { onsets: null, onsetsHold: null, carried: [], arcLeft: [], tipOutMax: null, ends: [], released: null };
  if (c1 && c1.tipOnsets != null) {
    const cb = S[Math.max(0, i0 - 1)].c?.tipOnsets ?? 0;
    row.tip2.onsets = (S[Math.max(i0, iRe - 1)].c?.tipOnsets ?? cb) - cb;
    if (o.fam === 'holdShort') row.tip2.onsetsHold = (S[Math.min(iL, iStrokeEnd + Math.round(1.0 / DT))].c?.tipOnsets ?? cb) - cb;
    let out = 0, lastEnd = S[i0].c?.tipEnd ?? null;
    for (let i = i0; i < n; i++) {
      const c = S[i].c, cp = S[i - 1]?.c;
      if (!c) continue;
      if (c.tipOnsets != null && cp?.tipOnsets != null && c.tipOnsets > cp.tipOnsets) {
        row.tip2.carried.push(c.tipCarried != null ? rN(c.tipCarried * R2D, 1) : null);
        row.tip2.arcLeft.push(rN(c.tipArcLeft, 3));
      }
      if (c.tipOut != null) out = Math.max(out, Math.abs(c.tipOut));
      if (c.tipEnd !== lastEnd && c.tipEnd != null) {
        row.tip2.ends.push(c.tipEnd);
        if (c.tipEnd === 'walk' || c.tipEnd === 'touch') row.tip2.released = c.tipEnd;
      }
      lastEnd = c.tipEnd;
    }
    row.tip2.tipOutMax = rN(out * R2D, 3);
  }
  // 넘김 튐
  {
    const kR = kOf(jumpQ.t0);
    const a = S[Math.max(0, kR - 1)], b = S[Math.min(n - 1, kR + 2)];
    const mm = Math.hypot(b.tgt[0] - a.tgt[0], b.tgt[1] - a.tgt[1], b.tgt[2] - a.tgt[2]) * 1000;
    row.jump = { kind: jumpKind, mm: rN(mm, 1), deg: a.aim && b.aim ? rN(Math.acos(Math.max(-1, Math.min(1, a.aim.dot(b.aim) / (a.aim.length() * b.aim.length() || 1)))) * R2D, 2) : null, tipHold: !!a.c?.tipHold };
  }
  // 붙잡음 뒤 넘김 튐 ≤ 옮긴 각 (H6: 튐 없음)
  const car = row.tip2.carried.find((x) => x != null);
  row.jump.leCarried = row.jump.kind === 'hold' && row.jump.tipHold && car != null && row.jump.deg != null ? row.jump.deg <= Math.abs(car) + 1e-6 : null;
  // 엄지 ↔ 손 일치: 획 방향 (패드 [dx, dy] → 몸 틀 [앞 0, 위 dy, 칼 쪽 dx·side]) 과 손 목표 3 스텝 변위 (앞 깊이 포함) 사이 각,
  //  손 변위 가중 평균. 창 = 획 시작 … 획 끝 + 0.1 s (거른 aim 이 따라오는 시간, aimFilterStrike 24 rad/s 의 약 2/ω). 옛 당김의 '엄지는 아래인데 손은 앞' 이 여기 잡힌다
  {
    const L3 = Math.hypot(dx, dy) || 1;
    const U = [0, dy / L3, (dx / L3) * P.side];
    let wsum = 0, asum = 0, w2 = 0, a2 = 0;
    const iEndA = Math.min(n - 1, iStrokeEnd + Math.round(0.1 / DT));
    for (let i = i0 + 3; i <= iEndA; i++) {
      const dh = [S[i].tgt[0] - S[i - 3].tgt[0], S[i].tgt[1] - S[i - 3].tgt[1], S[i].tgt[2] - S[i - 3].tgt[2]];
      const lh = Math.hypot(...dh);
      if (lh < 1e-4) continue;
      const c = (U[0] * dh[0] + U[1] * dh[1] + U[2] * dh[2]) / lh;
      asum += Math.acos(Math.max(-1, Math.min(1, c))) * R2D * lh;
      wsum += lh;
      // 옆·위만 (패드 면): 깊이(앞)는 뺀다
      const l2 = Math.hypot(dh[1], dh[2]);
      if (l2 < 1e-4) continue;
      const c2 = (U[1] * dh[1] + U[2] * dh[2]) / (l2 * Math.hypot(U[1], U[2]));
      a2 += Math.acos(Math.max(-1, Math.min(1, c2))) * R2D * l2;
      w2 += l2;
    }
    row.agree = wsum > 0 ? rN(asum / wsum, 1) : null;
    row.agree2 = w2 > 0 ? rN(a2 / w2, 1) : null;
    row.handFwd = rN(S[iEndA].tgt[0] - S[i0].tgt[0], 3); // 같은 창에서 손 목표가 앞으로 간 거리 (m, 몸 틀)
  }
  // 몸통 몫 (칼날 70 % 점 최고)
  {
    let k = i0;
    for (let i = i0; i <= iTipEnd; i++) if (S[i].v70 > S[k].v70) k = i;
    row.v70 = rN(S[k].v70, 2);
    row.trunk = rN(100 * S[k].chShare, 0);
    row.pelvis = rN(100 * S[k].pelShare, 0);
  }
  // 되돌아옴: 뗌 → ready
  {
    // skill.readies 는 첫 'ready' 앞엔 없다 (undefined), 그리고 v2·s > 0 에서만 센다 (skill.js). 같은 작업(6)이 스텝마다 적는 skill.lift 가 있으면 기능이 있는 트리
    const hasReady = M.corr === 'v2' && M.level > 0 && S.some((q) => q.readies != null || q.lift != null);
    const r0 = S[iL].readies ?? (hasReady ? 0 : null);
    let kr = null;
    if (r0 != null) for (let i = iL + 1; i < iRe; i++) if ((S[i].readies ?? 0) > r0) { kr = i; break; }
    row.ready = !hasReady ? 'absent' : kr != null ? 'ok' : 'none'; // absent = 필드 없는 트리, none = 뗌 … 다시 닿음 사이 'ready' 없음
    row.recMs = kr != null ? Math.round((S[kr].gt - tLift) * 1000) : null; // skill.readies 가 는 스텝의 판 시각 (skill.readyT 는 fightT 시계라 G.t 로 잰다)
    // 도구 쪽 ready 의 뗌 뒤 첫 오름 (모든 방식에서 견줄 수 있게)
    let kt = null;
    for (let i = iL + 1; i < iRe; i++) if (S[i].rdy && !S[i - 1].rdy) { kt = i; break; }
    row.recToolMs = kt != null ? Math.round((S[kt].gt - tLift) * 1000) : null;
    let recSteps = 0;
    for (let i = iL; i < iRe; i++) if (S[i].recovering) recSteps++;
    row.recoveringMs = Math.round(recSteps * DT * 1000);
  }
  // 칼끝 겨눔 오차
  {
    const firstPart = S.slice(i0, iWinEnd + 1).find((s) => s.c?.part)?.c.part ?? null;
    const minOf = (p) => { let m = Infinity; for (let i = i0; i <= iWinEnd; i++) if (S[i].dPart[p] != null) m = Math.min(m, S[i].dPart[p]); return m; };
    let aimed = firstPart && partN.includes(firstPart) ? firstPart : null;
    if (!aimed) { let best = Infinity; for (const p of partN) { const m = minOf(p); if (m < best) (best = m), (aimed = p); } }
    row.aimedPart = aimed;
    row.aimedBy = firstPart ? 'corr' : 'nearest';
    row.dSurf = aimed ? rN(minOf(aimed), 3) : null;
    row.shortStop = o.scene.startsWith('hit') ? wIn.length === 0 && (row.dSurf ?? 0) > 0 : null;
  }
  row.env = env.json();
  row.falls = falls;
  return row;
}

// ── 판 차례 ──
const t0 = Date.now();
const rows = [];
const absent = new Set();
console.log(`chain_corr · 트리 ${ROOT} · SKILL.corr ${HAS ? 'O' : '없음'} · BODY.humanLimits ${HASL ? 'O' : '없음'} · 방식 ${MODES.join(',')} · 장면 ${SCENES.join(',')} · 무리 ${FAMS.join(',')} · 입력 ${INPUTS.join(',')} · 한도 ${LIMITS.join(',')} · reps ${REPS} · 시드 ${SEED} · ${WEAPON}`);
{
  let N = 0;
  for (const limits of LIMITS) for (const M of MODE_DEFS) if (!(M.corr === 'v2' && !HAS) && !(limits === 'on' && !HASL)) for (const sc of SCENES) for (const f of FAMS) if (!(sc === 'stop' && FAM[f].short)) N += INPUTS.length * REPS * (sc === 'hitMove' ? 2 : 1) * (FAM[f].short ? SHORT_DEGS.length : 1);
  console.log(`판 N = ${N} (이 기계 바탕 트리에서 판당 약 1.2 s, v2 는 조금 더 → 약 ${Math.round((N * 1.3) / 60)} 분). 20 분을 넘으면 --reps 를 줄이거나 --input 을 나눠 돈다`);
}
for (const limits of LIMITS) {
  if (limits === 'on' && !HASL) { console.log('limits absent: on 건너뜀'); continue; }
  for (const M of MODE_DEFS) {
    if (M.corr === 'v2' && !HAS) { if (!absent.has(M.name)) console.log(`${M.name}: feature absent (SKILL.corr 없음) — 건너뜀`); absent.add(M.name); continue; }
    for (const scene of SCENES) for (const fam of FAMS) {
      if (scene === 'stop' && FAM[fam].short) continue;
      for (const input of INPUTS) for (let rep = 0; rep < REPS; rep++) for (const foeMove of scene === 'hitMove' ? ['across', 'toward'] : [null]) for (const shortDeg of FAM[fam].short ? SHORT_DEGS : [null]) {
        const r = trial({ mode: M, scene, fam, input, limits, rep, foeMove, shortDeg });
        rows.push(r);
        if (ROWS) console.log(JSON.stringify(r));
      }
    }
  }
}
const secs = (Date.now() - t0) / 1000;

// ── 요약: 방식 × 장면 ──
const fmt = (a) => {
  const b = a.filter((x) => x != null && Number.isFinite(x));
  if (!b.length) return 'n/a';
  const f = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
  return `${f(med(b))} [${f(quant(b, 0.1))}–${f(quant(b, 0.9))}] ${b.length}`;
};
const METRICS = [
  ['tipPk', '칼끝 최고 m/s', (r) => r.tipPk],
  ['tipHit', '첫 닿음 칼끝 m/s', (r) => r.tipHit],
  ['E1', '첫 상처 J', (r) => r.E1],
  ['hps', '상처/휘두름', (r) => r.hps],
  ['eaDeg1', '첫 닿음 날 각 °', (r) => r.eaDeg1],
  ['flatShare', '납작 몫', (r) => r.flatShare],
  ['winMs', '① 첫 창 ms', (r) => r.win?.winMs?.[0] ?? null],
  ['rollWin', '① 창 안 굴림 °', (r) => r.win?.rollWin],
  ['switches', '① 창 안 부위 바뀜', (r) => r.win?.switches],
  ['roll2f', '닿기 전 2프레임 굴림 °', (r) => r.roll2f],
  ['fastRoll', '닿음 밖 |ω굴림|>40 스텝', (r) => r.fastRoll],
  ['onsets', '② 켜짐/획', (r) => r.tip2?.onsets],
  ['carried', '② 옮긴 각 °', (r) => r.tip2?.carried?.[0] ?? null],
  ['arcLeft', '② 남은 호 몫', (r) => r.tip2?.arcLeft?.[0] ?? null],
  ['tipOut', '② 면 밖 각 °', (r) => r.tip2?.tipOutMax],
  ['jumpMm', '넘김 튐 mm', (r) => r.jump?.mm],
  ['jumpDeg', '넘김 튐 °', (r) => r.jump?.deg],
  ['agree', '엄지-손 각 ° (깊이 포함)', (r) => r.agree],
  ['agree2', '엄지-손 각 ° (옆·위)', (r) => r.agree2],
  ['handFwd', '획 동안 손 앞으로 m', (r) => r.handFwd],
  ['trunk', '가슴 몫 %', (r) => r.trunk],
  ['pelvis', '골반 몫 %', (r) => r.pelvis],
  ['recMs', '뗌→ready ms (skill.readies)', (r) => r.recMs],
  ['recToolMs', '뗌→ready ms (도구, 모든 방식)', (r) => r.recToolMs],
  ['readyNone', "뗌 뒤 'ready' 없음 (몫)", (r) => (r.ready === 'absent' ? null : r.ready === 'none' ? 1 : 0)],
  ['dSurf', '겨눈 부위 거리 m', (r) => r.dSurf],
  ['shortStop', '짧게 멈춤', (r) => (r.shortStop == null ? null : r.shortStop ? 1 : 0)],
  ['viol', '범위 이탈 스텝 (설계·문헌 칸+두 발 뜸+제 몸)', (r) => r.env?.viol],
  ['clip', '봉투 클립 밖 스텝 (참고)', (r) => r.env?.clip],
  ['falls', '쓰러짐', (r) => r.falls],
];
// 한도 값이 둘 이상이면 행 = 방식/한도 (섞지 않는다)
const ML = LIMITS.length > 1;
const mk = (r) => (ML ? `${r.mode}/${r.limits}` : r.mode);
const modeNames = [...new Set(rows.map(mk))];
const sceneNames = [...new Set(rows.map((r) => (r.foeMove ? `${r.scene}:${r.foeMove}` : r.scene)))];
const key = (r) => (r.foeMove ? `${r.scene}:${r.foeMove}` : r.scene);
console.log(`\n요약 (칸 = 중앙값 [p10–p90] 판 수, 한도 ${LIMITS.join(',')}, 무리 ${FAMS.length}, 입력 ${INPUTS.join(',')})`);
for (const [, title, get] of METRICS) {
  console.log(`\n## ${title}`);
  console.log(`| 방식 | ${sceneNames.join(' | ')} |`);
  for (const m of modeNames) console.log(`| ${m} | ${sceneNames.map((s) => fmt(rows.filter((r) => mk(r) === m && key(r) === s).map(get))).join(' | ')} |`);
}
// ② 음성 확인: holdShort·stop 에서 켜짐·맞힘이 v207tip0·old0 보다 많으면 안 된다
console.log('\n## ② 음성 (holdShort·stop): 켜짐 합 · 상처 합 (방식별)');
for (const m of modeNames) {
  const neg = rows.filter((r) => mk(r) === m && (r.fam === 'holdShort' || r.scene === 'stop'));
  if (!neg.length) continue;
  const on = neg.map((r) => r.tip2?.onsets).filter((x) => x != null);
  console.log(`  ${m.padEnd(9)} 판 ${neg.length} · ② 켜짐 ${on.length ? on.reduce((a, b) => a + b, 0) : 'n/a'} · 누름 동안 ${neg.map((r) => r.tip2?.onsetsHold).filter((x) => x != null).reduce((a, b) => a + b, 0)} · 상처 ${neg.reduce((a, r) => a + r.wounds, 0)}`);
}
console.log('\n## ② 양성 (liftShort, 맞힘 장면): 상처 판 / 판 · 켜짐 합');
for (const m of modeNames) {
  const pos = rows.filter((r) => mk(r) === m && r.fam === 'liftShort' && r.scene.startsWith('hit'));
  if (!pos.length) continue;
  const on = pos.map((r) => r.tip2?.onsets).filter((x) => x != null);
  console.log(`  ${m.padEnd(9)} 상처 판 ${pos.filter((r) => r.wounds > 0).length}/${pos.length} · ② 켜짐 ${on.length ? on.reduce((a, b) => a + b, 0) : 'n/a'} · 풀림 ${pos.map((r) => r.tip2?.released ?? '-').join(',')}`);
}
console.log(`\n판 ${rows.length} · 걸린 시간 ${secs.toFixed(1)} s (${(secs / Math.max(1, rows.length)).toFixed(2)} s/판)`);
if (JSON_OUT && JSON_OUT !== true) writeFileSync(resolve(JSON_OUT), JSON.stringify({ meta: { root: ROOT, modes: MODES, scenes: SCENES, fams: FAMS, inputs: INPUTS, limits: LIMITS, reps: REPS, seed: SEED, weapon: WEAPON, secs, feature: { corr: HAS, limits: HASL } }, rows }, null, 1));
