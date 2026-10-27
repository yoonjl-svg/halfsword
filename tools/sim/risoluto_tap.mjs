// 안다레 리솔루토 — 사람 탭 흉내 (10/25 사장님 '이탈리아 비기 창이 열리고도 탭을 눌렀을 때 대부분 비기가 나가지 않아서 … 0.6초 안에 탭 누르면 되는 거 아니었어?').
//  docs/strike/italian_risoluto_2026-10-22.md §16. 판정 · 실행은 게임 함수 그대로(읽기만) — main.js 프레임 차례를 따라 한다:
//   프레임(실시간 1/60 s · 게임 시간 × TEMPO 1.1) 머리 = 손가락 입력(손 움직임 d · 탭 수 — 탭은 손가락을 뗄 때 셈 · input.js) → 창이 열려 있고 탭이면 fire → skill.secret →
//   손 목표 += d · handHeld · inputActive · 탭이 남으면 보통 탭 찌르기 · 스틱 → 물리 스텝들(ai.update → PlayerSecretWatch.update → 막기 단추 step → 몸 step).
//   금색 '!' = 프레임 끝에 창이 열려 있음(strike_cue.js readCueWindow — 닫히면 0.1 s 에 흐려짐).
//  사람(운전): 칼 쪽 손가락을 대고 끌어 내 칼 손 쪽을 상대 칼 위로(risoluto_play.mjs 와 같은 운전 · 손 빠르기 V) · 스틱은 늘 앞(사람이 쥐듯 — RISO_TAP_STOP=1 이면 맞붙는 거리에서 멈춤) ·
//   '!' 가 처음 보인 프레임에서 RT 초(실시간) 뒤 손가락을 화면에 다시 대고(끌던 손가락은 LIFT 초 앞서 뗌) PRESS 초 뒤 뗌 = 탭(뗀 뒤 첫 프레임 머리에서 셈) ·
//   누르는 동안 손가락이 SLIP px 미끄러짐(탭 한도 12 px 안 — 폰 가로 화면 높이 390 px · touchSensitivity · 세로 1.35 배). 탭 뒤 0.15 s 에 다시 끌기.
//  탭마다 까닭 한 줄: fired(비기) · gap(창이 간격으로 닫힘 — 탭 앞) · gapFire(같은 프레임 간격 — fire null) · swing(내 손 휘두름 · 긋기로 닫힘) · expire(0.6 s 지남) · state(넘어짐 · 상대 죽음 …) ·
//   busy(비기 실행 · 굳음) · refuse:tap|pom|sec|exhausted|state(skill.secret 거절 — 창은 써 버림) · skillBusy(보통 찌르기가 도는 중 — 창 지킴 판은 창을 남김) · tapOnly(전 판 끌기 — 보통 베기) · noWin(창 없음).
//  실행: node tools/sim/risoluto_tap.mjs [무기 rapier,dartagnan,pappenheimer] [인물 isolde,tome] [씨앗 1] [초 30] [RT 0.15,0.25,0.35,0.5]
//   환경 변수: RISO_TAP_SLIP=px(0) · RISO_TAP_PRESS=s(0.08) · RISO_TAP_LIFT=s(0.06) · RISO_TAP_V=패드 m/s(0.6) · RISO_TAP_STOP=1 · RISO_TAP_TRACE=1(창마다 프레임 줄) ·
//   RISO_TAP_ATTACK=drag — 탭 대신 끌기(누른 뒤 프레임마다 16 px 옆으로 6 프레임 — 휘두르기 문턱 넘는 빠른 긋기 · main.js secSwipe 는 첫 프레임에 셈) ·
//   RISO_OLD=1 — 10/25 21:0x 전 판(스틱 앞만 · 탭만 · 덮음 0.07 · 창 지킴 끔 — main.js ?risoStick=fwd&risoTap=1&risoCover=0.07&secretHold=0) · RISO_GAP=0
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { lungeGap } from '../../src/italian_risoluto.js';
import * as THREE from 'three';

const [wArg = 'rapier,dartagnan,pappenheimer', fArg = 'isolde,tome', seedsArg = '1', simArg = '30', rtArg = '0.15,0.25,0.35,0.5'] = process.argv.slice(2);
const E = process.env;
if (E.RISO_GAP) CONFIG.SECRET.risolutoGap = +E.RISO_GAP;
if (E.RISO_OLD === '1') Object.assign(CONFIG.SECRET, { risolutoStick: 'fwd', risolutoTap: 1, risolutoCover: 0.07, secretHold: 0 }); // 10/25 21:0x 전 판
const DRAG = E.RISO_TAP_ATTACK === 'drag';
const DRAG_PX = 16, DRAG_N = 6; // 끌기: 프레임마다 16 px(약 0.11 m — 실시간 6.4 m/s · 문턱 1.5) · 6 프레임
const TEMPO = 1.1; // main.js 기본 (?tempo)
const FR = 1 / 60; // 화면 프레임 (실시간)
const SLIP = +(E.RISO_TAP_SLIP ?? 0), PRESS = +(E.RISO_TAP_PRESS ?? 0.08), LIFT = +(E.RISO_TAP_LIFT ?? 0.06), V = +(E.RISO_TAP_V ?? 0.6);
const STOP = E.RISO_TAP_STOP === '1', TRACE = E.RISO_TAP_TRACE === '1';
const VIEW_H = 390; // 폰 가로 화면 높이 (CSS px — strike_cue.js 기본)
const slipD = (() => { const s = CONFIG.INPUT.touchSensitivity / Math.max(320, VIEW_H), a = SLIP / Math.SQRT2; return { x: a * s, y: -a * s * 1.35 }; })(); // 오른쪽 아래로 미끄러짐 (mobile_intent.js mapMobileHandDelta)
const SEEDS = +seedsArg, SIM = +simArg;
const weapons = wArg.split(','), foes = fArg.split(','), RTS = rtArg.split(',').map(Number);
const v3 = () => new THREE.Vector3();
const a0 = v3(), a1 = v3(), b0 = v3(), b1 = v3(), pa = v3(), pb = v3(), _d1 = v3(), _d2 = v3(), _r = v3();
function closest(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r), c = _d1.dot(_r), b = _d1.dot(_d2), den = a * e - b * b;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  pa.copy(p1).addScaledVector(_d1, s); pb.copy(p2).addScaledVector(_d2, t);
}
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

/** 한 판: 사람 탭 흉내 · 돌려줌 { taps: [{ why, rt, ... }], wins: [...], blocked, lunges, hits, pDead, fDead } */
function round(w, id, seed, RT) {
  const C = CHARACTERS_BY_ID[id];
  const G = newRound({ weapon: w, weapon2: C.weapon, seed, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
  const p = G.player, e = G.enemy;
  p.skill.level = 0.7; p.skill.autoGuard = true; p.canShove = true;
  const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
  const ps = new PlayerSecretWatch(p, e);
  if (ps.S?.when !== 'risoluto') throw new Error(`${w}: 리솔루토가 아님 (${ps.S?.name})`);
  const contact = lungeGap(p);
  const out = { taps: [], wins: [], lunges: 0, hits: 0, pDead: 0, fDead: 0, blocked: 0, invisible: 0 };
  let tgt = [0.1, 0.05], fingerDown = true, plan = null, resumeAt = -1, cue = null, cueOut = 9, realT = 0, acc = 0, lastWin = null;
  let pendTaps = 0, slipDue = null, closedBy = null;
  // 물리 스텝마다 (main.js 차례: ai.update 뒤 · 몸 step 앞)
  G.before = () => {
    const prev = ps.open, gc = ps.riso.gapClosed ?? 0, gb = ps.riso.gapBlocked ?? 0;
    ps.update(DT, !!p.skill.sec);
    if ((ps.riso.gapBlocked ?? 0) > gb) out.blocked++;
    if (prev && !ps.open && closedBy !== 'fired') {
      // 창이 닫힌 까닭 (판정과 같은 순서 — secret.js update · risoTick)
      const why = (ps.riso.gapClosed ?? 0) > gc ? 'gap' : prev.t <= 0 ? 'expire' : p.skill.swinging || p.stamina.stroke?.paid ? 'swing' : 'state';
      if (lastWin && lastWin.o === prev) { lastWin.closed = why; lastWin.closeT = G.t; lastWin.gapClose = p.foeDistance(); }
    }
    if (ps.open && ps.open !== lastWin?.o) {
      lastWin = { o: ps.open, path: ps.open.ctx?.path, openT: G.t, gap0: p.foeDistance(), margin: p.foeDistance() - contact, closed: null, closeT: null, seenR: null, trace: [] };
      out.wins.push(lastWin);
      closedBy = null;
    }
    if (TRACE && lastWin && G.t - lastWin.openT <= 0.9) lastWin.trace.push(`${(G.t - lastWin.openT).toFixed(3)} gap ${p.foeDistance().toFixed(3)} open ${ps.open === lastWin.o ? 1 : 0} sw ${p.skill.swinging ? 1 : 0} paid ${p.stamina.stroke?.paid ? 1 : 0} vel ${p.skill.vel.length().toFixed(2)} stand ${p.state} fwd ${p.stickY}`);
    pg.step(DT);
  };
  const steps = Math.round(SIM / (FR * TEMPO));
  for (let fr = 0; fr < steps; fr++) {
    // ── 프레임 머리: 손가락 (실시간 realT)
    const d = { x: 0, y: 0 };
    if (plan) {
      if (!plan.lifted && realT >= plan.lift) { plan.lifted = true; fingerDown = false; }
      if (!plan.down && realT >= plan.press) { plan.down = true; fingerDown = true; slipDue = plan.press + PRESS / 2; plan.pressGame = G.t; plan.openAtPress = !!ps.open && ps.open === plan.win.o; plan.cueAtPress = cue?.shown ?? false; }
      if (!DRAG && slipDue != null && realT >= slipDue) { d.x += slipD.x; d.y += slipD.y; slipDue = null; }
      if (DRAG && plan.down && !plan.up) {
        // 끌기: 누른 프레임부터 옆으로 빠르게 (손가락이 닿아 있는 동안 — main.js 는 프레임 손 움직임 ÷ 프레임 시간 ≥ swingSpeed 를 긋기로 셈)
        const k = CONFIG.INPUT.touchSensitivity / Math.max(320, VIEW_H);
        d.x -= DRAG_PX * k;
        if (++plan.dragN >= DRAG_N) { plan.up = true; fingerDown = false; resumeAt = realT + 0.15; }
        plan.swipeNow = true;
      } else if (plan.down && !plan.up && realT >= plan.release) { plan.up = true; fingerDown = false; pendTaps++; resumeAt = realT + 0.15; }
    } else if (!fingerDown && realT >= resumeAt && !p.skill.sec) fingerDown = true;
    // 끌기 운전 (손가락이 대어 있고 탭을 누르는 중이 아닐 때): risoluto_play.mjs 와 같은 운전 — 프레임마다 손 목표 움직임으로
    const dragging = fingerDown && !(plan && plan.down && !plan.up) && !p.skill.sec && p.armed && e.armed;
    if (dragging) {
      p.bladePoint(0, a0); p.bladePoint(0.5, a1); e.bladePoint(0.5, b0); e.bladePoint(1, b1);
      closest(a0, a1, b0, b1);
      const dv = pb.clone().sub(pa).applyQuaternion(p.yaw.clone().invert());
      const gdt = FR * TEMPO;
      if (p.foeDistance() < 3) tgt = [Math.max(-0.5, Math.min(0.5, tgt[0] + dv.z * 4 * gdt)), Math.max(-0.3, Math.min(0.45, tgt[1] + (dv.y + 0.03) * 4 * gdt))];
      const off = p.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, dd = Math.hypot(dx, dy), st = V * gdt;
      if (dd > st) { d.x += (dx / dd) * st; d.y += (dy / dd) * st; } else { d.x += dx; d.y += dy; }
    }
    // main.js 프레임 머리 그대로
    const exhausted = p.stamina.exhausted;
    if (exhausted) { d.x = 0; d.y = 0; }
    let taps = pendTaps; pendTaps = 0;
    if (exhausted) taps = 0;
    let secBusy = exhausted || !!p.skill.secretPhase;
    const swipe = Math.hypot(d.x, d.y) / FR >= CONFIG.SKILL.swingSpeed; // main.js: 프레임 손 움직임 ÷ 프레임 시간(실시간)
    const secSwipe = swipe && !ps.S?.do?.tapOnly;
    const secArm = !(CONFIG.SECRET.secretHold && (p.skill.tap || p.skill.pom)); // main.js 창 지킴: 보통 찌르기가 도는 동안은 창을 쓰지 않음
    const attack = DRAG ? !!plan?.swipeNow && swipe : taps > 0;
    if (plan) plan.swipeNow = false;
    if (attack && plan && !plan.done) {
      // 이 탭의 까닭
      const T = { rt: RT, path: plan.win.path, margin: plan.win.margin, open: !!ps.open, why: null, dtOpen: G.t - plan.win.openT, gapTap: p.foeDistance() - contact, openAtPress: plan.openAtPress, cueAtPress: plan.cueAtPress, winLeft: ps.open ? ps.open.t : 0 };
      if (secBusy) T.why = 'busy';
      else if (ps.open && !secArm) T.why = 'skillBusy';
      else if (ps.open && DRAG && !secSwipe) T.why = 'tapOnly';
      else if (ps.open) {
        const sk = p.skill;
        const pre = { tap: !!sk.tap, pom: !!sk.pom, sec: !!sk.sec, ex: !!p.stamina.exhausted, st: p.state };
        const o = ps.fire();
        if (!o) T.why = 'gapFire';
        else {
          o.dir = [d.x, d.y];
          closedBy = 'fired';
          if (p.skill.secret(o)) { T.why = 'fired'; secBusy = true; out.lunges++; }
          else T.why = `refuse:${pre.tap ? 'tap' : pre.pom ? 'pom' : pre.sec ? 'sec' : pre.ex ? 'exhausted' : pre.st !== 'stand' ? 'state' : 'other'}`;
        }
      } else T.why = plan.win.closed ?? 'noWin';
      if (T.why !== 'fired') T.closeAfter = plan.win.closeT != null ? plan.win.closeT - plan.win.openT : null;
      out.taps.push(T);
      plan.done = true;
      if (!DRAG) plan = null;
    }
    if (plan && plan.up && (plan.done || DRAG)) plan = null; // 끌기가 비기 입력으로 셈되지 못하고 끝남(탈진 등)은 줄을 남기지 않음
    if (secBusy) taps = 0;
    pg.held = false;
    if (p.alive && !secBusy) { p.handOffset.x += d.x; p.handOffset.y += d.y; }
    p.handHeld = fingerDown;
    p.inputActive = !secBusy && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
    if (taps > 0 && p.alive) p.skill.thrust();
    const feet = p.alive && !exhausted && p.skill.secretPhase !== 'stiff';
    const fwd = feet && !(STOP && p.foeDistance() <= p.swordArt.measure.clinch) ? 1 : 0;
    p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
    // ── 물리 스텝들
    acc += FR * TEMPO;
    let n = 0;
    while (acc >= DT && n < CONFIG.PHYSICS.maxStepsPerFrame) { G.step(); acc -= DT; n++; }
    realT += FR;
    // ── 프레임 끝: 금색 '!' (strike_cue.js — 열린 동안 · 닫히면 0.1 s 흐려짐)
    const open = ps.open;
    if (open) {
      if (!cue || cue.o !== open) {
        cue = { o: open, shown: true, t0: realT };
        const W = out.wins.find((x) => x.o === open);
        if (W) {
          W.seenR = realT;
          // 사람: 처음 보인 '!' 에 반응 (이미 다른 탭을 누르는 중이면 그대로)
          if (!plan) plan = { win: W, lift: realT + Math.max(0, RT - LIFT), press: realT + RT, release: realT + RT + PRESS, lifted: false, down: false, up: false, dragN: 0 };
        }
      }
      cueOut = 0;
    } else if (cue) {
      cueOut += FR;
      cue.shown = cueOut < 0.1;
      if (!cue.shown) cue = null;
    }
    if (!p.alive) break;
    if (!e.alive && !p.skill.sec) break;
  }
  for (const W of out.wins) if (W.seenR == null) out.invisible++; // 열렸다 같은 프레임에 닫혀 '!' 가 한 번도 안 보인 창
  out.hits = p.skill.secretStats.andareRisoluto?.landed ?? 0;
  out.pDead = p.alive ? 0 : 1; out.fDead = e.alive ? 0 : 1;
  out.contact = contact;
  if (TRACE) for (const W of out.wins.slice(0, 4)) { console.log(`TRACE ${w} ${id} RT ${RT} 창 ${W.path} 여유 ${W.margin.toFixed(3)} 닫힘 ${W.closed} ${W.closeT != null ? (W.closeT - W.openT).toFixed(3) : '-'}`); for (const l of W.trace.filter((_, i) => i % 6 === 0)) console.log('   ', l); }
  G.world.free();
  return out;
}

const WHY = ['fired', 'gap', 'gapFire', 'swing', 'expire', 'state', 'busy', 'skillBusy', 'tapOnly', 'refuse:tap', 'refuse:pom', 'refuse:sec', 'refuse:exhausted', 'refuse:state', 'refuse:other', 'noWin'];
console.log(`사람 ${DRAG ? '끌기' : '탭'} 흉내 · ${E.RISO_OLD === '1' ? '전 판(10/25 21:0x 전)' : '새 판'} · 덮음 ${CONFIG.SECRET.risolutoCover} · 스틱 ${CONFIG.SECRET.risolutoStick} · ${CONFIG.SECRET.risolutoTap ? '탭만' : '공격'} · 창 지킴 ${CONFIG.SECRET.secretHold ? '켬' : '끔'} · 스틱 늘 앞${STOP ? '(맞붙는 거리에서 멈춤)' : ''} · 누름 ${PRESS} s · 끌던 손가락 뗌 ${LIFT} s 앞 · 미끄러짐 ${SLIP} px · 손 ${V} · TEMPO ${TEMPO} · 씨앗 ${SEEDS} × ${SIM} s · 간격 조건 ${CONFIG.SECRET.risolutoGap ? '켬' : '끔'}`);
const all = {};
for (const RT of RTS) {
  const A = { taps: [], wins: [], lunges: 0, hits: 0, pDead: 0, fDead: 0, blocked: 0, invisible: 0, rounds: 0, byW: {} };
  for (const w of weapons) for (const id of foes) for (let s = 1; s <= SEEDS; s++) {
    const r = round(w, id, s, RT);
    A.taps.push(...r.taps); A.wins.push(...r.wins);
    for (const k of ['lunges', 'hits', 'pDead', 'fDead', 'blocked', 'invisible']) A[k] += r[k];
    A.rounds++;
    const B = (A.byW[w] ??= { taps: 0, fired: 0 });
    B.taps += r.taps.length; B.fired += r.taps.filter((t) => t.why === 'fired').length;
  }
  all[RT] = A;
  const n = A.taps.length, cnt = (k) => A.taps.filter((t) => t.why === k).length;
  const parts = WHY.map((k) => [k, cnt(k)]).filter(([, c]) => c > 0).map(([k, c]) => `${k} ${c} (${Math.round((100 * c) / Math.max(1, n))} %)`);
  console.log(`RT ${RT} s: 탭 ${n} · ${parts.join(' · ')} | 무기별 비기/탭 ${Object.entries(A.byW).map(([w, B]) => `${w} ${B.fired}/${B.taps}`).join(' · ')}`);
  const W = A.wins, closedGap = W.filter((x) => x.closed === 'gap').map((x) => x.closeT - x.openT);
  console.log(`   창 ${W.length} (판당 ${f2(W.length / A.rounds)} — 칼끝 얽힘 ${W.filter((x) => x.path === 'touch').length} · 이어짐 ${W.filter((x) => x.path === 'hold').length} · 다 붙음 ${W.filter((x) => x.path === 'close').length} · 상대 박자 ${W.filter((x) => x.path === 'beat').length}) · '!' 한 번도 안 보임 ${A.invisible} · 가까워 안 뜸 ${A.blocked} · 열린 때 간격 여유 p50 ${f2(q(W.map((x) => x.margin), 0.5))} m · 간격으로 닫힌 창 ${closedGap.length} — 열린 뒤 p10 · p50 · p90 ${f2(q(closedGap, 0.1))} · ${f2(q(closedGap, 0.5))} · ${f2(q(closedGap, 0.9))} s(게임) · 런지 ${A.lunges} · 맞힘 ${A.hits} · 내 죽음 ${A.pDead} · 상대 죽음 ${A.fDead} / ${A.rounds} 판`);
  const fired = A.taps.filter((t) => t.why === 'fired'), inner = fired.filter((t) => t.gapTap < 0);
  if (fired.length) console.log(`   비기 낸 때 간격 − 맞닿기 p10 · p50 · p90 ${f2(q(fired.map((t) => t.gapTap), 0.1))} · ${f2(q(fired.map((t) => t.gapTap), 0.5))} · ${f2(q(fired.map((t) => t.gapTap), 0.9))} m · 맞닿기 거리 안에서 냄(창 지킴 덕 — 몸 미끄러짐 0) ${inner.length} / ${fired.length}`);
  const miss = A.taps.filter((t) => t.why === 'gap');
  if (miss.length) console.log(`   간격으로 닫힌 뒤 탭: 누를 때 창이 아직 열려 있었음 ${miss.filter((t) => t.openAtPress).length} · 누를 때 '!' 보임(흐려지는 중 포함) ${miss.filter((t) => t.cueAtPress).length} / ${miss.length} · 닫힘 — 열린 뒤 p50 ${f2(q(miss.map((t) => t.closeAfter), 0.5))} s · 탭 때 간격 − 맞닿기 p50 ${f2(q(miss.map((t) => t.gapTap), 0.5))} m`);
}
