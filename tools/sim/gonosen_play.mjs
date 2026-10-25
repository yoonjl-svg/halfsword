// 일본 고노센 — 겨눔 자세에서 기다리는 사람 손맛 측정 (10/25 01:3x 사장님 '이 경우에 창이 안 열리고 천천히 다가와서 가까이 붙어 버리던데?' — docs/strike/school_secret_2026-10-09.md §16).
//  판정 · 실행은 게임 함수 그대로(읽기만 — PlayerSecretWatch · secretEvent · secretCond · skill.secret). 상대 = 인물 AI(시트 숙련도 · 성격).
//  운전(사람 흉내):
//   stand (기본) — 겨눔 자세 그대로 서서 기다림(스틱 · 손 입력 없음). 창(금색 '!')이 열리면 REACT 초 뒤 탭 하나(main.js 와 같은 차례: 프레임 머리 fire → skill.secret) · 그 밖엔 치지 않음
//   back — 위와 같고, 준비가 안 됐는데 상대가 상대 칼 거리 + 0.3 안이면 스틱 뒤(다시 준비하려고 물러나는 사람)
//  단계 셈 (한 판 모두 — 판정과 같은 함수로 읽기만):
//   ① 상대가 상대 칼 거리(foeReach) 안으로 든 순간 준비가 아님 — 까닭: 짧음(밖에 머문 시간 < iaiArmTime — 상대가 이미 가까움) · 내 휘두름/비기(busy 로 풀림)
//   ② 준비된 동안(켜짐 → 꺼짐) 창 없이 끝남 — 사건 없음(상대가 칼을 들지도 달려들지도 않고 걸어 들어옴) · 사건은 났으나 거리 조건(발도가 닿는 거리) 밖
//   ③ 창이 열림 — 사건별(raise · recover · enter) · 탭 · 맞힘 · 그 칼로 죽임 · 놓침(헛침 · 막힘)
//   준비된 채 발도가 닿는 거리 안으로 든 번 → 그 안에서 창 · 창 없이 상대가 나감 · 준비가 유예로 풀림 / 넘는 스텝의 상대 다가옴 빠르기
//  실행: node tools/sim/gonosen_play.mjs [씨앗 4] [초 30] [무기 monohoshizao,uchigatana,muramasa] [인물 isolde,artoria,ratna,tome,omari,roland,bernardo] [REACT 0.25] [운전 stand|back]
//  스위치 (환경 변수 — 판 기본은 그대로): GNS_ENTER=0 들어옴 사건 끔(옛 판 — main.js ?gnsEnter=0) · GNS_LONG=1 긴 칼 상대 규칙(제안 — ?gnsLong=1) · GNS_AI=1 AI 쪽 들어옴 사건(?gnsEnterAI=1)
//   GNS_DUMP=1 창 · 들어옴 한 줄씩
//  10/25 08:0x (§17): GNS_WARY=0 AI 고노센 경계 끔(?gnsWary=0) · 여쭘 GNS_EWIN=0.4 들어옴 창 길이 A(?gnsEnterWindow=) · GNS_BLOCK=1 들어옴 발도 막힐 수 있음 B(?gnsEnterBlock=1) ·
//   GNS_OPEN=1 들어옴은 상대 칼끝이 비켰을 때만 C(?gnsEnterOpen=1) — 놓침을 헛침 · 막힘으로 나눔 · AI 경계 셈(결행 · 속임 · 발도에 베여 물러남)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import * as SEC from '../../src/secret.js';
import * as THREE from 'three';

const { PlayerSecretWatch, secretEvent, secretCond } = SEC;
const [seedsArg = '4', simArg = '30', wArg = 'monohoshizao,uchigatana,muramasa', fArg = 'isolde,artoria,ratna,tome,omari,roland,bernardo', rArg = '0.25', driveArg = 'stand'] = process.argv.slice(2);
const E = process.env;
const S0 = CONFIG.SECRET;
if (E.GNS_ENTER != null && 'gnsEnter' in S0) S0.gnsEnter = +E.GNS_ENTER ? 1 : 0;
if (E.GNS_LONG != null && 'gnsLong' in S0) S0.gnsLong = +E.GNS_LONG ? 1 : 0;
if (E.GNS_AI != null && 'gnsEnterAI' in S0) S0.gnsEnterAI = +E.GNS_AI ? 1 : 0;
if (E.GNS_WARY != null && 'gnsWary' in S0) S0.gnsWary = +E.GNS_WARY ? 1 : 0;
if (E.GNS_EWIN != null && 'gnsEnterWindow' in S0) S0.gnsEnterWindow = +E.GNS_EWIN;
if (E.GNS_BLOCK != null && 'gnsEnterBlock' in S0) S0.gnsEnterBlock = +E.GNS_BLOCK ? 1 : 0;
if (E.GNS_OPEN != null && 'gnsEnterOpen' in S0) S0.gnsEnterOpen = +E.GNS_OPEN ? 1 : 0;
const SEEDS = +seedsArg, SIM = +simArg, REACT = +rArg, DRIVE = driveArg;
const weapons = wArg.split(','), foes = fArg.split(',');
// 발도가 닿는 거리 (secretCond 의 발도 창 위 끝 — iai 1) · 들어옴 선 (있으면 판 함수)
const strikeLine = (V) => (SEC.gnsEnterLine ? SEC.gnsEnterLine(V) : S0.iai ? V.contact + S0.iaiStep + S0.iaiMargin : V.reach + S0.japaneseReach + S0.japaneseFar);
const armLine = (V) => V.foeReach; // 준비가 쌓이는 선 (상대 칼 거리)
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-'), f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');
const KEYS = ['rounds', 'live', 'entries', 'entArmed', 'entShort', 'entBusy', 'periods', 'pWin', 'pNoEv', 'pEvFar', 'pOther', 'endGrace', 'endBusy', 'endFired', 'endState', 'graceNoWin', 'crossArmed', 'crossWin', 'crossLeft', 'crossGrace', 'win', 'wRaise', 'wRecover', 'wEnter', 'wCharge', 'fired', 'landed', 'kill1', 'missWhiff', 'missBlock', 'unfired', 'foeFirst', 'pDead', 'fDead', 'dealt', 'taken', 'evUnarmed', 'aiCommit', 'aiFeint', 'aiCut', 'stiffHit'];
const rows = [];
const LG = { enterClose: [], reachClose: [], winGap: [], evFarBy: [] };
for (const w of weapons) for (const id of foes) {
  const C = CHARACTERS_BY_ID[id];
  if (!C) throw new Error(`인물 없음: ${id}`);
  const R = { w, id, fw: C.weapon };
  for (const k of KEYS) R[k] = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const G = newRound({ weapon: w, weapon2: C.weapon, seed, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
    const p = G.player, e = G.enemy;
    p.skill.level = 0.7; p.skill.autoGuard = true; p.canShove = true;
    const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, e);
    if (ps.S?.name !== 'goNoSen') throw new Error(`${w}: 고노센이 아님 (${ps.S?.name})`);
    const V = ps.view();
    R.L = strikeLine(V); R.foeReach = V.foeReach; R.band = R.L - armLine(V);
    let cross = null, seenOpen = 0, due = null, openT = null, run = null, lastHurt = -1, prevD = null, prevArmed = false, period = null, lastReset = 'short', evPrev = false, unfiredOpen = null;
    const diagSt = { armed: true, off: 0 }; // 사건 읽기 전용 칸 (창의 칸과 따로)
    G.onWound = (att, vic, r) => {
      if (vic === p && (r.severity ?? 0) > 0) { R.taken += r.severity; lastHurt = G.t; }
      if (att === p && run) { R.dealt += r.severity ?? 0; run.wound = true; }
    };
    G.before = (t) => {
      // ① 입력 (프레임 머리): 창이 열린 뒤 REACT 초에 탭 하나
      if (ps.opened !== seenOpen) {
        seenOpen = ps.opened;
        if (ps.open) {
          due = t + REACT; openT = t; unfiredOpen = ps.open;
          const ev = ps.open.ctx?.ev ?? '-';
          R.win++; R[{ raise: 'wRaise', recover: 'wRecover', enter: 'wEnter' }[ev] ?? 'wCharge']++;
          LG.winGap.push(p.foeDistance());
          if (period) period.win = true;
          if (cross) { R.crossWin++; cross = null; } // 준비된 채 발도가 닿는 거리 안으로 든 뒤 창
          if (E.GNS_DUMP === '1') console.log(`WIN ${w} ${id} ${ev} t ${t.toFixed(2)} d ${p.foeDistance().toFixed(2)} L ${R.L.toFixed(2)} foeReach ${V.foeReach.toFixed(2)} armed ${ps.iaiArm.armed}`);
        }
      }
      if (due != null && t >= due) {
        due = null;
        if (ps.open && !p.skill.secretPhase && p.alive) {
          const o = ps.fire();
          if (o && p.skill.secret(o)) { R.fired++; run = { t0: t, wound: false, foeFirst: lastHurt >= openT, fAlive: e.alive, landed0: p.skill.secretStats.goNoSen?.landed ?? 0, hurt0: R.taken }; unfiredOpen = null; }
        }
      }
      if (unfiredOpen && !ps.open && !run) { R.unfired++; unfiredOpen = null; }
      const busy = !!p.skill.sec;
      const t0arm = ps.iaiArm.t;
      ps.update(DT, busy);
      pg.step(DT);
      // ② 손 · 발 (운전)
      p.inputActive = false; p.handHeld = false;
      const d = p.foeDistance();
      let fwd = 0;
      if (DRIVE === 'back' && !busy && !ps.iaiArm.armed && !ps.open && d < V.foeReach + 0.3) fwd = -1;
      p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
      // ③ 단계 셈 (판정과 같은 함수 — 읽기만)
      const live = p.alive && e.alive && p.state === 'stand' && e.state === 'stand' && p.armed && e.armed;
      if (live) R.live += DT;
      if (t0arm > 0 && ps.iaiArm.t === 0) lastReset = busy || p.skill.swinging ? 'busy' : 'short';
      const c = p.bodies.chest.translation();
      const s0 = ps.sense.seen(0);
      const d0 = Math.max(0.01, Math.hypot(s0.cx - c.x, s0.cz - c.z));
      const closing = Math.max(0, -(s0.vx * (s0.cx - c.x) + s0.vz * (s0.cz - c.z)) / d0); // 상대 가슴이 나 쪽으로 (m/s)
      const armed = ps.iaiArm.armed;
      if (armed && !prevArmed) { period = { win: false, ev: false, evFar: false }; R.periods++; }
      if (!armed && prevArmed && period) {
        if (period.win) R.pWin++; else if (period.evFar) R.pEvFar++; else if (!period.ev) R.pNoEv++; else R.pOther++;
        if (busy) R.endFired++; else if (p.state !== 'stand' || e.state !== 'stand' || !p.alive || !e.alive) R.endState++; else if (d0 <= armLine(V)) { R.endGrace++; if (!period.win) R.graceNoWin++; } else R.endBusy++;
        period = null;
      }
      prevArmed = armed;
      if (live && !busy) {
        const r = p.right(new THREE.Vector3());
        const ev = secretEvent(ps.S, ps.sense, e, s0, c, r, d0, V.foeReach, p, { reach: V.reach, dt: DT, st: diagSt, armed: false });
        const rise = ev.on && !evPrev;
        evPrev = ev.on;
        if (rise && ev.ctx?.ev !== 'enter') {
          if (!armed) R.evUnarmed++;
          else if (period) {
            period.ev = true;
            if (!secretCond(ps.S, ev.ctx, d0, V)) { period.evFar = true; LG.evFarBy.push(d0 - R.L); }
          }
        }
        // 상대가 들어옴: 발도가 닿는 거리 · 상대 칼 거리를 안으로 넘는 순간의 상대 다가옴 빠르기
        if (prevD != null && prevD > R.L && d0 <= R.L) {
          LG.enterClose.push(closing);
          if (armed) { R.crossArmed++; cross = {}; } // 준비된 채 발도가 닿는 거리 안으로 듦 — 그 안에 머무는 동안 창이 열렸나
          if (E.GNS_DUMP === '1') console.log(`ENTER ${w} ${id} t ${t.toFixed(2)} d ${d0.toFixed(2)} closing ${closing.toFixed(2)} armed ${armed}`);
        }
        if (cross && (d0 > R.L || !armed)) { R[d0 > R.L ? 'crossLeft' : 'crossGrace']++; cross = null; } // 창 없이 — 상대가 선 밖으로 나감 · 준비가 유예로 풀림
        if (prevD != null && prevD > V.foeReach && d0 <= V.foeReach) {
          R.entries++; LG.reachClose.push(closing);
          if (armed) R.entArmed++; else if (lastReset === 'busy') R.entBusy++; else R.entShort++;
        }
      } else evPrev = false;
      prevD = live ? d0 : null;
      // 낸 칼 끝: 맞힘 · 죽임
      if (run && !p.skill.sec) {
        if (R.taken > run.hurt0) R.stiffHit++; // 고노센을 낸 뒤 굳음이 끝나기 전에 베임
        const landed = (p.skill.secretStats.goNoSen?.landed ?? 0) > run.landed0;
        if (landed) R.landed++; else if (p.instantResult?.blocked) R.missBlock++; else R.missWhiff++;
        if (run.foeFirst) R.foeFirst++;
        if (run.fAlive && !e.alive) R.kill1++;
        run = null;
      }
    };
    for (let i = 0; i < SIM / DT; i++) {
      G.step();
      if (!p.alive) break;
      if (!e.alive && !run) break;
    }
    R.rounds++;
    const gn = G.ai.gnsW?.n;
    if (gn) { R.aiCommit += gn.commit; R.aiFeint += gn.feint; R.aiCut += gn.cut; }
    if (!p.alive) R.pDead++;
    if (!e.alive) R.fDead++;
    G.world.free();
  }
  rows.push(R);
}
const S = CONFIG.SECRET;
console.log(`[고노센 겨눔 기다림] 들어옴 사건 ${S.gnsEnter ? '켬' : S.gnsEnter === 0 ? '끔' : '없음(옛 판)'} · 긴 칼 상대 규칙 ${S.gnsLong ? '켬' : '끔'} · AI 들어옴 ${S.gnsEnterAI ? '켬' : '끔'} · AI 경계 ${S.gnsWary ? '켬' : '끔'} · 여쭘 A 창 ${S.gnsEnterWindow > 0 ? S.gnsEnterWindow : S.playerWindow} s · B 막힘 ${S.gnsEnterBlock ? '켬' : '끔'} · C 칼끝 ${S.gnsEnterOpen ? '켬' : '끔'} · 운전 ${DRIVE} · 씨앗 ${SEEDS} × ${SIM} s · 탭 반응 ${REACT} s`);
console.log('| 무기 | 상대 (칼) | 띠 m | 판 | 서 있는 때 s | 상대 칼 거리 안으로 듦 (준비 · 짧음 · 휘두름) | 준비 (창 · 사건 없음 · 사건 거리 밖) | 끝남 (유예 · 냄 · 넘어짐) | 창 없이 걸어 들어옴 | 창 (든·달려듦 · 헛침 · 들어옴 · 그 밖) | 창 / 30 s | 탭 · 맞힘 · 그 칼로 죽임 | 놓침 (헛침 · 막힘) | 상대 칼 먼저 | 준 · 입은 심각도 | 내 죽음 · 상대 죽음 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const T = { band: NaN };
for (const k of KEYS) T[k] = 0;
const per30 = (n, s) => (s > 0 ? (30 * n) / s : NaN);
for (const R of rows) {
  console.log(`| ${R.w} | ${CHARACTERS_BY_ID[R.id].name} (${R.fw}) | ${f2(R.band)} | ${R.rounds} | ${f1(R.live)} | ${R.entries} (${R.entArmed} · ${R.entShort} · ${R.entBusy}) | ${R.periods} (${R.pWin} · ${R.pNoEv} · ${R.pEvFar}) | ${R.endGrace} · ${R.endFired} · ${R.endState} | ${R.graceNoWin} | ${R.win} (${R.wRaise} · ${R.wRecover} · ${R.wEnter} · ${R.wCharge}) | ${f2(per30(R.win, R.live))} | ${R.fired} · ${R.landed} · ${R.kill1} | ${R.missWhiff} | ${R.foeFirst} | ${f1(R.dealt)} · ${f1(R.taken)} | ${R.pDead} · ${R.fDead} |`);
  for (const k of KEYS) T[k] += R[k];
}
console.log(`| 합 | | | ${T.rounds} | ${f1(T.live)} | ${T.entries} (${T.entArmed} · ${T.entShort} · ${T.entBusy}) | ${T.periods} (${T.pWin} · ${T.pNoEv} · ${T.pEvFar}) | ${T.endGrace} · ${T.endFired} · ${T.endState} | ${T.graceNoWin} | ${T.win} (${T.wRaise} · ${T.wRecover} · ${T.wEnter} · ${T.wCharge}) | ${f2(per30(T.win, T.live))} | ${T.fired} · ${T.landed} · ${T.kill1} | ${T.missWhiff} | ${T.foeFirst} | ${f1(T.dealt)} · ${f1(T.taken)} | ${T.pDead} · ${T.fDead} |`);
const empty = rows.filter((R) => R.band <= 0);
const sumE = (k) => empty.reduce((s, R) => s + R[k], 0);
console.log(`띠가 빈 짝 (발도가 닿는 거리 ≤ 준비 선 — 긴 칼 상대): ${empty.length} / ${rows.length} 짝 · 그 판 ${sumE('rounds')} · 창 ${sumE('win')} · 준비 ${sumE('periods')} (사건 거리 밖 ${sumE('pEvFar')} · 사건 없음 ${sumE('pNoEv')}) · 서 있는 때 ${f1(sumE('live'))} s`);
console.log(`상대 다가옴 빠르기 (m/s) — 발도가 닿는 거리를 넘을 때 p10 ${f2(q(LG.enterClose, 0.1))} · p50 ${f2(q(LG.enterClose, 0.5))} · p90 ${f2(q(LG.enterClose, 0.9))} (${LG.enterClose.length} 번, 0.3 넘음 ${LG.enterClose.filter((x) => x > 0.3).length}) · 상대 칼 거리를 넘을 때 p50 ${f2(q(LG.reachClose, 0.5))} (${LG.reachClose.length})`);
console.log(`창이 열린 때 가슴 사이 p50 ${f2(q(LG.winGap, 0.5))} (${f2(q(LG.winGap, 0))} ~ ${f2(q(LG.winGap, 1))}) m · 사건 거리 밖일 때 발도가 닿는 거리보다 p10 ${f2(q(LG.evFarBy, 0.1))} · p50 ${f2(q(LG.evFarBy, 0.5))} m 멂 (${LG.evFarBy.length}) · 창 안 냄 ${T.unfired} · 상대 사건이 났는데 준비 아님 ${T.evUnarmed}`);
console.log(`준비된 채 발도가 닿는 거리 안으로 든 수 ${T.crossArmed} · 그 안에 머무는 동안 창이 열린 수 ${T.crossWin} · 창 없이 상대가 선 밖으로 나감 ${T.crossLeft} · 창 없이 준비가 유예로 풀림 ${T.crossGrace} · 나머지(넘어짐 · 판 끝) ${T.crossArmed - T.crossWin - T.crossLeft - T.crossGrace}`);
console.log(`놓침 헛침 ${T.missWhiff} · 막힘 ${T.missBlock} · 낸 뒤 굳음 동안 베임 ${T.stiffHit} · AI 경계: 결행 ${T.aiCommit} · 속임 ${T.aiFeint} · 발도에 베여 물러남 ${T.aiCut}`);
console.log(`맞힘 ${T.landed} / ${T.fired} 탭 (${T.fired ? Math.round((100 * T.landed) / T.fired) : '-'} %) · 그 칼로 죽임 ${T.kill1} · 판당 창 ${f2(T.win / T.rounds)} · 서 있는 30 s 당 창 ${f2(per30(T.win, T.live))} · 탭 ${f2(per30(T.fired, T.live))} · 맞힘 ${f2(per30(T.landed, T.live))}`);
