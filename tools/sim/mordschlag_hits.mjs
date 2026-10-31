// 모르트슐라크 사람 적중 진단 (10/30 사장님 '모르트가 빗나가는 경우는 어떤거지? … 모르트의 적중은 실력이 아니라 그저 행운인가?') — 붙어 미는 사람 봇이 낸 일격 하나하나의 결과와 빗나간 까닭 (읽기만 · 판 값 그대로)
//  node tools/sim/mordschlag_hits.mjs [foes isolde,…,roland] [seeds 6] [dur 40]
//  BOT=player(걸어 붙어 스틱 앞 ±25° 흔들림 · 붙은 동안 0.8 ~ 1.6 s 마다 긋기) | hold(스틱 앞 쥠만) · STICK=keep(일격 동안 스틱 앞 그대로 — 기본) | release(놓음) · 판당 쓸 수 끔 · 창이 열리면 0.12 ~ 0.30 s 뒤 냄
//  TRACK=0 옛 겨눔(SECRET.mord.track — 10/30 08:2x 부터 기본 1) · COMMIT=실제 초(trackCommit) · UNTIL=cut · JSON=1 일격마다 한 줄
//  NOCLIP=1 내 머리 뚫음 막기(SECRET.mord.noSelfClip — 10/31 시제품 · 기본 끔) · CLIPX= · CLIPSTEP= · AT=(SECRET.mord.at) · 일격마다 내 머리 ↔ 두 손 · 팔 · 칼자루 쪽 틈도 잰다(10/31)
//  까닭: head 머리 · otherPart 칼자루가 머리 대신 가슴 · 팔 등에 · blocked 상대 칼(막힘 거리) · headMoved 머리가 길에서 빠져 헛침 · pathOff 길이 겨눈 자리를 안 지남 · outOfReach 안 닿음 ·
//   foeDown 상대가 넘어짐 · notStarted 시작 못 함(기력이 비기 값보다 적어 낸 스텝에 탈진 — lost) · 겨눈 자리 = 길을 짠 때 머리(내 가슴 틀) · 가장 가까운 때 머리 옮김(rel) · 상대 머리 · 내 가슴(땅) 옮김
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';
import { PlayerSecretWatch } from '../../src/secret.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { mordHeadReach } from '../../src/mordschlag.js';
const { SECRET, CLOSE, SKILL, UNIQUE_ASSIST: UA, TIME } = CONFIG;
UA.secretUses = null;
if (process.env.TRACK) SECRET.mord.track = +process.env.TRACK;
if (process.env.COMMIT) SECRET.mord.trackCommit = +process.env.COMMIT * TIME.k;
if (process.env.UNTIL) SECRET.mord.trackUntil = process.env.UNTIL;
const STICK = process.env.STICK || 'keep'; // 일격 동안 스틱: keep = 앞으로 쥔 채(붙어 밀던 그대로) · release = 놓음
if (process.env.MORD_N) SECRET.mordCloseN = +process.env.MORD_N;
if (process.env.MORD_JSON) Object.assign(SECRET.mord, JSON.parse(process.env.MORD_JSON));
if (process.env.NOCLIP) SECRET.mord.noSelfClip = +process.env.NOCLIP;
if (process.env.CLIPX) SECRET.mord.clipX = +process.env.CLIPX;
if (process.env.CLIPSTEP) SECRET.mord.clipStep = +process.env.CLIPSTEP;
if (process.env.AT) SECRET.mord.at = +process.env.AT;
// 10/31 08:xx 시제품: REGRIP=0.4(실제 초 — 자연스러운 쥠 바꿈) · BURST=1(강제 뒤 박차기) · BURSTFREE=1(그 걸음 기력 안 냄) · POMMEL=1(쥠 그대로 폼멜 찍기)
if (process.env.REGRIP) SECRET.mord.regrip = TIME.k * +process.env.REGRIP;
if (process.env.BURST) SECRET.mord.burstBack = +process.env.BURST;
if (process.env.BURSTFREE) SECRET.mord.burstFree = +process.env.BURSTFREE;
if (process.env.POMMEL) SECRET.mord.pommel = +process.env.POMMEL;
// 내 머리 ↔ 팔 캡슐 (10/31 — tools/sim/mordschlag_selfclip.mjs 와 같은 셈): 칼 팔 x 축 · 빈팔 y 축 [반 길이, 반지름]
const CAPS = { uarmS: [0.105, 0.045, 'x'], farmS: [0.095, 0.04, 'x'], uarmO: [0.105, 0.045, 'y'], farmO: [0.095, 0.04, 'y'] };
const qOf = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
function selfClip(P, I, rec) {
  const hd = new THREE.Vector3().copy(P.bodies.head.translation()), hr = P.headR ?? 0.1, yi = I.yaw.clone().invert();
  const wS = new THREE.Vector3(0.13, 0, 0).applyQuaternion(qOf(P.bodies.farmS.rotation())).add(P.bodies.farmS.translation());
  const wO = new THREE.Vector3(0, -0.13, 0).applyQuaternion(qOf(P.bodies.farmO.rotation())).add(P.bodies.farmO.translation());
  let arm = Infinity;
  for (const [k, [h, rad, ax]] of Object.entries(CAPS)) {
    const b = P.bodies[k], a = new THREE.Vector3(ax === 'x' ? h : 0, ax === 'y' ? h : 0, 0).applyQuaternion(qOf(b.rotation())), c = new THREE.Vector3().copy(b.translation());
    arm = Math.min(arm, segToPoint(c.clone().sub(a), c.clone().add(a), hd) - hr - rad);
  }
  const sq = qOf(P.sword.rotation()), sp = new THREE.Vector3().copy(P.sword.translation());
  const gp = new THREE.Vector3(0, P.mordGrip ? P.mordGrip.g : 0, 0).applyQuaternion(sq).add(sp), pom = new THREE.Vector3(0, -0.15, 0).applyQuaternion(sq).add(sp);
  const hilt = segToPoint(gp, pom, hd) - hr - 0.02;
  if (Math.max(wS.distanceTo(hd), wO.distanceTo(hd)) > 1.0) { rec.scCut = (rec.scCut ?? 0) + 1; return; } // 팔이 잘려 날아감 (붙은 팔은 머리에서 0.85 m 밖으로 못 감) — 재지 않음
  const hand = Math.min(wS.distanceTo(hd), wO.distanceTo(hd));
  const back = Math.min(wS.clone().sub(hd).applyQuaternion(yi).x, wO.clone().sub(hd).applyQuaternion(yi).x); // 두 손이 내 머리 가운데보다 몸 앞(+) · 뒤(−)
  rec.sc ??= { arm: Infinity, hilt: Infinity, hand: Infinity, back: Infinity };
  const rg = I.segs[I.si]?.rg;
  const ph = rg ? (rg.in ? 'grip' : 'gripOut') : I.segs[I.si]?.B?.back || I.mordBacked ? 'back' : I.segs[I.si]?.cut ? 'cut' : 'wind'; // 쥠 바꿈 · 준비 · 내리침 · 다시 세우기(막혀 되돌아감 포함)
  if (arm < rec.sc.arm) rec.sc.armPh = ph;
  if (back < rec.sc.back) rec.sc.backPh = ph;
  rec.sc.arm = Math.min(rec.sc.arm, arm); rec.sc.hilt = Math.min(rec.sc.hilt, hilt); rec.sc.hand = Math.min(rec.sc.hand, hand); rec.sc.back = Math.min(rec.sc.back, back);
}
const [foesArg = 'isolde,tome,omari,minami,liao,margarethe,artoria,eira,roland', seedArg = '6', durArg = '40'] = process.argv.slice(2);
const BOT = process.env.BOT || 'player';
const DUR = +durArg;
const K = TIME.k;
const realS = (s) => s * K;
const recs = [];
const tv = (p, o = new THREE.Vector3()) => o.set(p.x, p.y, p.z);
// 선분 AB ↔ 점 P 거리
const segToPoint = (A, B, P) => { const ab = B.clone().sub(A); const t = Math.max(0, Math.min(1, P.clone().sub(A).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return A.clone().addScaledVector(ab, t).distanceTo(P); };
for (const id of foesArg.split(',')) {
  const ch = CHARACTERS_BY_ID[id];
  for (let s = 0; s < +seedArg; s++) {
    const seed = 4100 + s * 17;
    const G = newRound({ seed, weapon: 'longsword', weapon2: ch.weapon, difficulty: ch.ai.level, persona: ch.ai.persona, look2: ch.look, revive: ch.revive, walls: true });
    const P = G.player, E = G.enemy;
    P.skill.autoGuard = true; P.canShove = true;
    const W = new PlayerSecretWatch(P, E);
    let rs = (seed * 2654435761) >>> 0;
    const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
    let fireAt = null, nextSwing = null, swingLeft = 0, rec = null, winAt = null;
    const headR = E.headR ?? 0.11;
    G.before = () => {
      const t = G.t;
      W.update(DT, !!P.skill.sec);
      if (W.open && fireAt == null) { fireAt = t + realS(0.12 + 0.18 * rnd()); winAt = t; }
      if (!W.open) fireAt = null;
      if (fireAt != null && t >= fireAt && W.open && !P.skill.sec && P.alive) {
        const st0 = P.stamina.value, push0 = P.stamina.counts?.push ?? 0, ch0 = { x: P.bodies.chest.translation().x, z: P.bodies.chest.translation().z };
        const o = W.fire(); fireAt = null;
        const d = P.foeDistance();
        const r = { foe: id, seed, t: t / K, wait: (t - winAt) / K, d, reach: mordHeadReach(P), foeState: E.state, mode: G.ai.mode, phase: G.ai.phase, foeAtk: !!E.stamina?.attacking, started: false, st0, push0, ch0, tFire: t };
        const sk = P.skill;
        r.why = !o ? 'noWindow' : P.stamina.exhausted ? 'exhausted' : sk.sec ? 'sec' : sk.tap ? 'tap' : sk.pom ? 'pom' : P.state !== 'stand' ? `state:${P.state}` : null;
        const ok = !!(o && P.skill.secret(o));
        r.ok = ok;
        if (!ok && !r.why) r.why = 'secretFalse';
        if (ok) rec = r; else recs.push({ ...r, cls: 'notStarted' });
      }
      let y = P.alive && P.skill.sec?.stage !== 'stiff' ? 1 : 0;
      let x = 0;
      const dd = P.foeDistance();
      const reach = CLOSE.reach(P.weapon);
      if (BOT === 'player') {
        const a = (25 * Math.PI / 180) * Math.sin(t * 1.7 + seed);
        x = Math.sin(a) * y; y = Math.cos(a) * y;
        if (dd <= reach + 0.2 && !P.skill.sec) {
          if (nextSwing == null) nextSwing = t + realS(0.8 + 0.8 * rnd());
          if (t >= nextSwing && swingLeft <= 0) { swingLeft = realS(0.18); nextSwing = null; }
        }
      }
      if (P.skill.sec && STICK === 'release') { x = 0; y = 0; } // 일격 동안 스틱 놓음
      P.move.set(x, y); P.stickX = x; P.stickY = y;
      if (swingLeft > 0 && !P.skill.sec) {
        swingLeft -= DT;
        P.handOffset.x += (-2.5) * DT;
        P.handOffset.y += (-1.2) * DT;
      } else if (!P.skill.sec) { P.handOffset.x += (SKILL.homeGuard[0] - P.handOffset.x) * 0.1; P.handOffset.y += (SKILL.homeGuard[1] - P.handOffset.y) * 0.1; }
    };
    let watch = null;
    const after = () => {
      if (watch) { if (P.state !== 'stand' && P.alive) watch.rec.fell = P.state; if (G.t >= watch.until) watch = null; }
      if (rec?.started && P.state !== 'stand' && P.alive) rec.fell = P.state;
      if (!rec) return;
      if (!rec.started && !P.iai && !P.iaiReq && !rec.lost) {
        // 운동학 길이 시작하지 못함 (secret_instant.js startIai 거절 — 다음 스텝 몸 상태)
        rec.lost = { state: P.state, sec: P.skill.sec?.stage ?? null, ir: P.instantResult ? { ...P.instantResult } : null, foe: E.state, alive: P.alive && E.alive };
      }
      const I = P.iai;
      const c = tv(P.bodies.chest.translation());
      const h = tv(E.bodies.head.translation());
      if (I?.kind === 'combo' && I.mord) {
        if (!rec.started) {
          rec.started = true;
          rec.t0 = G.t;
          rec.pullD = I.mord.pullD ?? 0;
          rec.Prel = h.clone().sub(c).applyQuaternion(I.yaw.clone().invert()); // 길이 겨눈 머리 (몸 틀 — comboPlanMord 와 같은 식 · 같은 스텝)
          rec.h0 = h.clone(); rec.c0 = c.clone(); rec.d0 = P.foeDistance();
          rec.segs = I.segs.map((sg) => [sg.cut ? 1 : 0, +sg.T.toFixed(3)]);
          rec.dPlanMin = Infinity; rec.dNowMin = Infinity; rec.minAt = null; rec.prev = null; rec.cutT0 = null;
          rec.minState = E.state; rec.foeDown = E.state !== 'stand';
          rec.modes = new Set();
        }
        rec.live = { hit: I.hits > 0, part: I.part, blocked: I.blocked > 0, E: I.E };
        if (!I.hitM && !I.blockM) { rec.modes.add(`${G.ai.mode}/${G.ai.phase}`); if (E.state !== 'stand') rec.foeDown = true; }
        if (I.blockM && rec.blockT == null) { rec.blockT = (G.t - rec.t0) / K; rec.blockMode = `${G.ai.mode}/${G.ai.phase}`; rec.foeGuard = !!E.skill?.guarding || !!E.guard?.held; }
        selfClip(P, I, rec); // 내 머리 ↔ 손 · 팔 · 칼자루 쪽 (10/31)
        { const cc = P.bodies.chest.translation(), fw = new THREE.Vector3(1, 0, 0).applyQuaternion(I.yaw); rec.backD = Math.max(rec.backD ?? 0, -((cc.x - rec.ch0.x) * fw.x + (cc.z - rec.ch0.z) * fw.z)); } // 내 가슴이 뒤로 간 거리 (낸 때부터 · 땅)
        const cur = I.prev; // 이 스텝 놓인 치는 막대 (손목 → 칼자루 끝)
        if (cur?.B && I.cutting && !I.hitM && !I.blockM) {
          if (rec.cutT0 == null) { rec.cutT0 = G.t; rec.hCut = h.clone(); rec.cCut = c.clone(); rec.dCut = P.foeDistance(); rec.cutState = E.state; rec.cutMode = `${G.ai.mode}/${G.ai.phase}`; }
          const tip = cur.tip ?? cur.B.clone().addScaledVector(cur.D, I.mord.Lp);
          const Pw = rec.Prel.clone().applyQuaternion(I.yaw).add(c); // 겨눈 자리 (지금 내 가슴 틀)
          // 지난 스텝 막대와 이번 막대 사이 3 조각 (stepCombo 와 같음)
          const pv = rec.prev ?? { B: cur.B, tip };
          for (let k = 1; k <= 3; k++) {
            const w = k / 3;
            const B = pv.B.clone().lerp(cur.B, w), T = pv.tip.clone().lerp(tip, w);
            const dn = segToPoint(B, T, h) - headR;
            const dp = segToPoint(B, T, Pw) - headR;
            if (dn < rec.dNowMin) { rec.dNowMin = dn; rec.minAt = { t: (G.t - rec.t0) / K, hd: h.distanceTo(rec.h0), cd: c.distanceTo(rec.c0), rel: h.clone().sub(c).applyQuaternion(I.yaw.clone().invert()).distanceTo(rec.Prel) }; }
            rec.dPlanMin = Math.min(rec.dPlanMin, dp);
          }
          // 손 목표(길) ↔ 실제 손목 — 팔이 못 닿은 몫
          const Hw = I.cur.H.clone().applyQuaternion(I.yaw).add(c);
          rec.short = Math.max(rec.short ?? 0, Hw.distanceTo(cur.B));
          rec.prev = { B: cur.B.clone(), tip };
        }
        return;
      }
      if (rec.started && !I) {
        const R = P.instantResult ?? {};
        rec.hit = !!R.hit; rec.part = R.part; rec.zone = R.zone; rec.blocked = !!R.blocked; rec.E = R.energy ?? 0; rec.T = R.T; rec.trackN = R.trackN; rec.trackMoved = R.trackMoved; rec.wPart = R.wPart ?? null; rec.clip = R.clip ?? null;
        rec.helm = !!E.hasHelmet;
        const relMove = rec.minAt?.rel ?? 0;
        if (rec.blocked && !rec.hit) rec.cls = 'blocked';
        else if (rec.hit && (rec.part === 'head' || rec.part === 'neck')) rec.cls = 'head';
        else if (rec.hit) rec.cls = 'otherPart';
        else if (rec.foeDown) rec.cls = 'foeDown';
        else if (rec.dPlanMin > 0.05 && !rec.reach) rec.cls = 'outOfReach';
        else if (rec.dPlanMin > 0.05) rec.cls = 'pathOff';
        else rec.cls = 'headMoved';
        rec.relMove = relMove;
        rec.stEnd = P.stamina.value; rec.pushN = (P.stamina.counts?.push ?? 0) - rec.push0; rec.Ttot = (G.t - rec.tFire) / K;
        delete rec.prev; rec.modes = [...rec.modes].join(' ');
        recs.push(rec);
        watch = { rec, until: G.t + realS(1.0) }; // 끝난 뒤 1 s — 넘어짐
        rec = null;
      }
    };
    let end = DUR;
    for (let i = 0; i < realS(DUR) / DT; i++) { G.step(); after(); if (!P.alive || !E.alive) { end = G.t / K; break; } }
    if (rec) {
      // 판이 일격 도중 끝남 (대개 머리를 맞아 상대가 죽음 — 루프가 곧장 멈춤): 그때까지의 결과로
      const L = rec.live ?? {};
      rec.hit = !!L.hit; rec.part = L.part; rec.blocked = !!L.blocked; rec.wPart = P.iai?.wPart ?? null; rec.E = L.E ?? 0; rec.endedFight = true; rec.foeDead = !E.alive; rec.meDead = !P.alive;
      rec.cls = !rec.started ? 'notStarted' : rec.hit && rec.part === 'head' ? 'head' : rec.hit ? 'otherPart' : rec.blocked ? 'blocked' : 'unfinished';
      delete rec.prev; rec.modes = [...(rec.modes ?? [])].join(' ');
      recs.push(rec);
    }
    G.world.free();
  }
}
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const by = {};
for (const r of recs) by[r.cls] = (by[r.cls] ?? 0) + 1;
const n = recs.length;
const pc = (k) => `${by[k] ?? 0} (${f2(((by[k] ?? 0) / Math.max(1, n)) * 100)} %)`;
console.log(`봇 ${BOT} · 스틱 ${STICK} · track ${SECRET.mord.track ?? 0} commit ${f2((SECRET.mord.trackCommit ?? 0) / K)} until ${SECRET.mord.trackUntil} · n ${SECRET.mordCloseN} · 일격 ${n} · 머리 · 목 ${pc('head')} · 다른 부위 ${pc('otherPart')} · 막힘 ${pc('blocked')} · 머리 움직임 ${pc('headMoved')} · 길이 빗나감 ${pc('pathOff')} · 닿지 않음 ${pc('outOfReach')} · 상대 넘어짐 ${pc('foeDown')} · 시작 못 함 ${pc('notStarted')} · 끝 못 봄 ${pc('unfinished')}`);
const parts = {};
for (const r of recs) if (r.cls === 'otherPart') parts[r.part] = (parts[r.part] ?? 0) + 1;
console.log(`다른 부위: ${JSON.stringify(parts)}`);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const st = (sel, f) => { const a = recs.filter(sel).map(f).filter(Number.isFinite); return `p10 ${f2(q(a, 0.1))} · p50 ${f2(q(a, 0.5))} · p90 ${f2(q(a, 0.9))}`; };
const T = (r) => (r.cutT0 != null ? (r.cutT0 - r.t0) / K : NaN);
console.log(`낼 때 가슴 사이 (m): 머리 ${st((r) => r.cls === 'head', (r) => r.d)} · 빗나감 ${st((r) => !['head', 'otherPart'].includes(r.cls), (r) => r.d)}`);
console.log(`준비 → 베기 시작 (실제 s): ${st((r) => r.started, T)} · 베는 막대 ↔ 지금 머리 겉 가장 가까움 (m) — 머리 움직임 ${st((r) => r.cls === 'headMoved', (r) => r.dNowMin)}`);
console.log(`겨눈 때 → 가장 가까울 때 머리 (몸 틀) 옮김 (m): 머리 ${st((r) => r.cls === 'head', (r) => r.relMove)} · 머리 움직임 ${st((r) => r.cls === 'headMoved', (r) => r.relMove)} · 그 가운데 상대 머리 (땅) ${st((r) => r.cls === 'headMoved', (r) => r.minAt?.hd)} · 내 가슴 (땅) ${st((r) => r.cls === 'headMoved', (r) => r.minAt?.cd)}`);
console.log(`팔 못 닿은 몫 (m): 머리 ${st((r) => r.cls === 'head', (r) => r.short)} · 빗나감 ${st((r) => ['headMoved', 'pathOff', 'outOfReach'].includes(r.cls), (r) => r.short)} · pullD ${st((r) => r.started, (r) => r.pullD)}`);
// 가슴 사이 칸별 머리 맞힘
for (const [a, b] of [[0, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 9]]) {
  const S = recs.filter((r) => r.d >= a && r.d < b);
  const hh = S.filter((r) => r.cls === 'head').length;
  console.log(`  가슴 사이 ${a} ~ ${b}: ${S.length} · 머리 ${hh} (${f2((hh / Math.max(1, S.length)) * 100)} %) · 막힘 ${S.filter((r) => r.cls === 'blocked').length} · 움직임 ${S.filter((r) => r.cls === 'headMoved').length} · 다른 ${S.filter((r) => r.cls === 'otherPart').length}`);
}
// 상대 상태별
const md = {};
for (const r of recs) { const k = `${r.mode}`; (md[k] ??= { n: 0, head: 0, blocked: 0 }).n++; if (r.cls === 'head') md[k].head++; if (r.cls === 'blocked') md[k].blocked++; }
console.log(`낼 때 상대 AI 마음 → 일격 · 머리 · 막힘: ${Object.entries(md).map(([k, v]) => `${k} ${v.n}·${v.head}·${v.blocked}`).join(' | ')}`);
const fo = {};
for (const r of recs) { (fo[r.foe] ??= { n: 0, head: 0 }).n++; if (r.cls === 'head') fo[r.foe].head++; }
console.log(`상대별 일격 · 머리: ${Object.entries(fo).map(([k, v]) => `${k} ${v.n}·${v.head}`).join(' | ')}`);
const wt = (sel) => st(sel, (r) => r.wait);
console.log(`창 → 냄 (실제 s): 머리 ${wt((r) => r.cls === 'head')} · 빗나감 ${wt((r) => r.cls !== 'head')}`);
// 내 머리 뚫음 (10/31): 일격마다 가장 작은 틈 — 팔 캡슐 ↔ 머리 공 · 칼자루 쪽(손 → 폼멜 끝) ↔ 머리 · 두 손 ↔ 머리 가운데 · 두 손이 머리 가운데보다 몸 앞(+)/뒤(−)
{
  const S = recs.filter((r) => r.sc);
  const pct = (k) => `${S.filter(k).length} (${f2((S.filter(k).length / Math.max(1, S.length)) * 100)} %)`;
  console.log(`내 머리 (시작한 일격 ${S.length} · 팔이 잘려 뺀 스텝이 있는 일격 ${recs.filter((r) => r.scCut).length}): 팔이 머리 공을 뚫음 ${pct((r) => r.sc.arm < 0)} · 칼자루 쪽이 머리를 지남 ${pct((r) => r.sc.hilt < 0)} · 손이 머리 가운데 뒤 ${pct((r) => r.sc.back < 0)} · 팔 틈 ${st((r) => r.sc, (r) => r.sc.arm)} · 가장 작음 ${f2(Math.min(...S.map((r) => r.sc.arm)))}`);
  console.log(`  손 ↔ 머리 가운데 (m) ${st((r) => r.sc, (r) => r.sc.hand)} · 가장 작음 ${f2(Math.min(...S.map((r) => r.sc.hand)))} · 손 앞(+)/뒤(−) ${st((r) => r.sc, (r) => r.sc.back)} · 가장 깊이 ${f2(Math.min(...S.map((r) => r.sc.back)))} · 칼자루 쪽 틈 ${st((r) => r.sc, (r) => r.sc.hilt)}`);
  const Sg = recs.filter((r) => r.started);
  console.log(`  넘어짐(낸 때 ~ 끝 + 1 s) ${Sg.filter((r) => r.fell).length} / ${Sg.length} · 박찬 걸음 기력 청구 ${Sg.filter((r) => r.pushN > 0).length} 번 · 가슴 사이 낼 때 ${st((r) => r.started, (r) => r.d)} → 내리침 시작 ${st((r) => Number.isFinite(r.dCut), (r) => r.dCut)} (늘어난 몫 ${st((r) => Number.isFinite(r.dCut), (r) => r.dCut - r.d)}) · 내 가슴이 낸 자리보다 뒤로 간 가장 큰 거리 ${st((r) => r.started, (r) => r.backD)} · 기력 낼 때 ${st((r) => r.started, (r) => r.st0)} → 끝 ${st((r) => Number.isFinite(r.stEnd), (r) => r.stEnd)} · 낸 때 → 비기 끝(굳음 앞) 실제 s ${st((r) => Number.isFinite(r.Ttot), (r) => r.Ttot)}`);
  const wp = {}; for (const r of recs) if (r.cls === 'head') wp[r.wPart ?? '?'] = (wp[r.wPart ?? '?'] ?? 0) + 1;
  const phs = (k, f) => { const o = {}; for (const r of S.filter(f)) o[r.sc[k] ?? '?'] = (o[r.sc[k] ?? '?'] ?? 0) + 1; return JSON.stringify(o); };
  console.log(`  팔이 머리 공을 뚫은 토막 ${phs('armPh', (r) => r.sc.arm < 0)} · 손이 머리 뒤인 토막 ${phs('backPh', (r) => r.sc.back < 0)}`);
  console.log(`  머리를 친 칼 부품: ${JSON.stringify(wp)} · 머리 맞힘 에너지 (J) ${st((r) => r.cls === 'head', (r) => r.E)}${S.some((r) => r.clip) ? ` · 반걸음 (m) ${st((r) => r.clip, (r) => r.clip.step)} · 기울임 (°) ${st((r) => r.clip, (r) => r.clip.tilt)} · 못 옮긴 몫 (m) ${st((r) => r.clip, (r) => r.clip.short)}` : ''}`);
  for (const [a, b] of [[0, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 9]]) {
    const T = S.filter((r) => r.d >= a && r.d < b);
    if (T.length) console.log(`    가슴 사이 ${a} ~ ${b}: ${T.length} · 팔 뚫음 ${T.filter((r) => r.sc.arm < 0).length} · 칼자루 쪽 ${T.filter((r) => r.sc.hilt < 0).length} · 손 뒤 ${T.filter((r) => r.sc.back < 0).length} · 손 앞뒤 p50 ${f2(q(T.map((r) => r.sc.back), 0.5))}`);
  }
}
if (process.env.JSON) for (const r of recs) console.log(JSON.stringify({ ...r, Prel: undefined, h0: undefined, c0: undefined, hCut: undefined, cCut: undefined }));
