// 고노센 — 손가락을 얹은 사람 흉내 봇 (10/31 사장님 08:xx '웅크리기를 없앴더니 고노센 발동창이 안열려.' — docs/strike/gonosen_window_2026-10-31.md).
//  판정 · 실행은 게임 함수 그대로(PlayerSecretWatch · skill.secret — 읽기만). 입력은 main.js 프레임 길을 그대로 흉내: 60 Hz 프레임마다 손가락 움직임(px → 패드 m —
//   input.js mapMobileHandDelta · INPUT.touchSensitivity · 세로 1.35) 을 손 목표(handOffset)에 더하고 handHeld(손가락 닿음) · inputActive(이 프레임에 움직임) · 스틱 원값을 적음.
//   창이 열려 있고 긋기(프레임 손 빠르기 ≥ swingSpeed) · 탭이 오면 fire → skill.secret (main.js 와 같은 차례 · 같은 조건). 상대 = 인물 AI(시트 숙련도 · 성격).
//  운전(DRIVE):
//   still — 손을 뗀 채 서서 기다림 · 창이 뜨면 REACT 초 뒤 탭 (gonosen_play stand 와 같음)
//   rest  — 칼 쪽 화면에 손가락을 얹은 채(떨림 JIT px · 천천히 떠돎 DRIFT px) 기다림 · 창이 뜨면 REACT 초 뒤 그 자리에서 아래로 긋기
//   human — rest 에 더해, 멀면(가슴 사이 > 발도 선 + 0.5) 준비 전엔 스틱으로 다가감(엄지 0.6) · 손가락은 얹은 채 · IMPATIENT 초(기본 0 = 안 함) 창이 없으면 보통 긋기 한 번
//   walk  — rest 에 더해, 준비가 켜진 것을 보면 발도 선 − 0.1 m 까지 스틱 WALK(0.5)로 걸어 들어감(준비된 뒤엔 걸어도 유지 — 카드 글 그대로의 쓰임) · 준비 전엔 서 있음
//  잼(판마다 — 비기를 아직 쓸 수 있는 동안만 셈): 서 있는 때 · 준비된 때 몫 · 준비 켜짐 · 셈이 0 으로 돌아간 까닭 · 창(사건별) · 낸 · 맞힘 · 맞은 곳 · 1 s 안 죽임 ·
//   AI 공격 시작(그때 준비였나 · 발도 선 안이었나) · 웅크림 무게 · 손 덧씌우기 무게(준비된 동안 평균) · 비기를 낸 뒤 2 s 에 그 판을 끝냄(판당 1 번)
//  실행: node tools/sim/gonosen_touch.mjs [씨앗 3] [초 40] [무기 uchigatana] [인물 isolde,heinrich,artoria,ratna,tome,omari,roland,bernardo] [운전 rest] [REACT 0.3]
//   환경: JIT(0.5 px) · DRIFT(4 px) · IMPATIENT(0) · GNS_DUMP=1(창 · 낸 것 한 줄씩) · 값 바꿈은 with_config.mjs (예 SECRET.gnsCrouch=1)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';

const [seedsArg = '3', simArg = '40', wArg = 'uchigatana', fArg = 'isolde,heinrich,artoria,ratna,tome,omari,roland,bernardo', driveArg = 'rest', rArg = '0.3'] = process.argv.slice(2);
const E = process.env;
const SEEDS = +seedsArg, SIM = +simArg, DRIVE = driveArg, REACT = +rArg;
const JIT = +(E.JIT ?? 0.5), DRIFT = +(E.DRIFT ?? 4), IMPATIENT = +(E.IMPATIENT ?? 0), WALK = +(E.WALK ?? 0.5);
const S0 = CONFIG.SECRET;
const H = 390; // 폰 가로 화면 높이 (px)
const PX = CONFIG.INPUT.touchSensitivity / H; // 1 px = 이만큼 패드 m (input.js mapMobileHandDelta — 가로)
const VG = 1.35; // 세로 배율 (mobile_intent.js 기본)
const tk = CONFIG.TIME?.k ?? 1;
const weapons = wArg.split(','), foes = fArg.split(',');
const ZONES = {};
const T = { rounds: 0, live: 0, armedT: 0, ons: 0, resets: 0, why: {}, win: 0, ev: {}, fired: 0, landed: 0, kill1: 0, pDead: 0, fDead: 0, atk: 0, atkArmed: 0, atkArmedIn: 0, atkIn: 0, crouchW: 0, handW: 0, wSamples: 0, firstWin: [], online: 0, onN: 0 };
let rng = 1;
const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);
for (const w of weapons) for (const id of foes) {
  const C = CHARACTERS_BY_ID[id];
  if (!C) throw new Error(`인물 없음: ${id}`);
  for (let seed = 1; seed <= SEEDS; seed++) {
    rng = seed * 7919 + id.length;
    const G = newRound({ weapon: w, weapon2: C.weapon, seed, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
    const p = G.player, e = G.enemy, ai = G.ai;
    p.skill.level = 0.7; p.skill.autoGuard = true; p.canShove = true;
    const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, e);
    if (ps.S?.name !== 'goNoSen') throw new Error(`${w}: 고노센이 아님 (${ps.S?.name})`);
    const V = ps.view();
    const line = V.contact + S0.iaiStep + S0.iaiMargin;
    // 손가락 (화면 px — 처음 자리 기준)
    const F = { down: DRIVE !== 'still', x: 0, y: 0, tx: 0, ty: 0, retarget: 0, swipe: 0, sx: 0, sy: 0, moved: 0 };
    let step = 0, frameT = 0, seenOpen = 0, due = null, run = null, endAt = null, prevPain = p.pain, lastMode = ai.mode, prevSec = null, armT0 = null, sinceWin = 0, firstWin = null, taps = 0;
    const chest = () => { const a = p.bodies.chest.translation(), b = e.bodies.chest.translation(); return Math.hypot(a.x - b.x, a.z - b.z); };
    G.onWound = (att, vic, r) => {
      if (att === p && run && !run.done) { run.zones.push(r.zone); ZONES[r.zone] = (ZONES[r.zone] ?? 0) + 1; }
    };
    G.before = (t) => {
      const frame = step++ % 2 === 0; // 60 Hz 프레임 (물리 120 Hz 두 스텝마다)
      const available = ps.left > 0 && !p.skill.sec;
      if (frame) {
        // ① 프레임 머리 (main.js 차례): 손가락 움직임 d · 창에서 긋기 · 탭이면 비기
        let dx = 0, dy = 0;
        if (F.down) {
          if (t >= F.retarget) { F.retarget = t + 2 + 4 * rand(); const a = rand() * 2 * Math.PI, r = DRIFT * rand(); F.tx = Math.cos(a) * r; F.ty = Math.sin(a) * r; }
          const nx = F.x + (F.tx - F.x) * 0.02 + (rand() - 0.5) * 2 * JIT * 0.5;
          const ny = F.y + (F.ty - F.y) * 0.02 + (rand() - 0.5) * 2 * JIT * 0.5;
          dx = nx - F.x; dy = ny - F.y; F.x = nx; F.y = ny;
        }
        if (F.swipe > 0) { dx += -8; dy += 28; F.sx += -8; F.sy += 28; F.swipe--; } // 아래로 긋기 (4 프레임 · 약 120 px)
        else if (F.sx || F.sy) { F.sx = F.sy = 0; F.moved = 0; F.x = F.y = 0; } // 그은 뒤 손가락을 떼었다 다시 얹음 (닿은 자리 새로)
        let d = { x: dx * PX, y: -dy * PX * VG };
        const fdt = 2 * DT / tk; // 이 프레임의 실제 초 (main.js dt — 화면 시계)
        const swipe = Math.hypot(d.x, d.y) / Math.max(fdt, 1e-3) >= CONFIG.SKILL.swingSpeed;
        const secBusy = !!p.skill.secretPhase;
        const atkWin = !!ps.open && !ps.stickOwns() && !ps.circleOwns();
        const secArm = !(S0.secretHold && (p.skill.tap || p.skill.pom));
        if (atkWin && (taps > 0 || swipe) && !secBusy && p.alive && secArm) {
          const o = ps.fire();
          if (o) o.dir = [d.x, d.y];
          if (p.skill.secret(o)) {
            T.fired++;
            run = { t0: t, zones: [], fAlive: e.alive, landed0: p.skill.secretStats.goNoSen?.landed ?? 0, done: false };
            if (E.GNS_DUMP === '1') console.log(`FIRE ${w} ${id} s${seed} t ${t.toFixed(2)} d ${chest().toFixed(2)}`);
          }
          taps = 0;
        }
        if (secBusy) taps = 0;
        if (p.alive && !secBusy) { p.handOffset.x += d.x; p.handOffset.y += d.y; }
        p.handHeld = F.down || F.swipe > 0;
        F.moved = Math.max(F.moved ?? 0, Math.hypot(F.x + F.sx, F.y + F.sy)); // 닿은 자리에서 가장 먼 거리 (px — input.js press.moved)
        p.handGrip = p.handHeld ? F.moved >= (CONFIG.INPUT.holdPx ?? CONFIG.INPUT.tapPx) : p.inputActive; // main.js handGrip 과 같은 셈
        p.inputActive = !secBusy && Math.abs(d.x) + Math.abs(d.y) > 1e-5;
        if (taps > 0 && p.alive) p.skill.thrust();
        taps = 0;
        // 발 (human: 준비 전 · 멀면 다가감)
        let fwd = 0;
        if (DRIVE === 'human' && !ps.iaiArm.armed && !secBusy && chest() > line + 0.5) fwd = 0.6;
        if (DRIVE === 'walk' && ps.iaiArm.armed && !secBusy && !ps.open && chest() > line - 0.1) fwd = WALK; // 준비가 켜진 걸 보고 걸어 들어감 (준비된 뒤엔 걸어도 유지)
        p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
        // 창이 뜨면 REACT 실제 초 뒤 (still = 탭 · rest · human = 얹은 손가락으로 긋기)
        if (ps.opened !== seenOpen) {
          seenOpen = ps.opened;
          if (ps.open && available) {
            T.win++; T.ev[ps.open.ctx?.ev ?? '-'] = (T.ev[ps.open.ctx?.ev ?? '-'] ?? 0) + 1;
            if (firstWin == null) { firstWin = t; T.firstWin.push(t); }
            due = t + REACT * tk; sinceWin = 0;
            if (E.GNS_DUMP === '1') console.log(`WIN ${w} ${id} s${seed} t ${t.toFixed(2)} ${ps.open.ctx?.ev} d ${chest().toFixed(2)} armedFor ${armT0 != null ? (t - armT0).toFixed(2) : '-'}`);
          }
        }
        if (due != null && t >= due) { due = null; if (ps.open) { if (DRIVE === 'still') taps = 1; else F.swipe = 4; } }
        if (IMPATIENT > 0 && DRIVE === 'human' && ps.iaiArm.armed && !ps.open && (sinceWin += 2 * DT / tk) > IMPATIENT) { F.swipe = 4; sinceWin = 0; }
      }
      // ② 물리 스텝 (main.js 차례: ai.update → playerSecret.update → … → player.step)
      const A = ps.iaiArm, t0 = A.t, a0 = A.armed, sk = p.skill;
      const hurt = p.pain > prevPain + 0.05; prevPain = p.pain;
      const why = { swing: !!sk.swinging, tap: !!sk.tap, pom: !!sk.pom, sec: !!sk.sec, parry: !!p.parryGuard?.held, hurt, move: Math.hypot(p.stickX || 0, p.stickY || 0) > 0, hold: !!p.openHold, notStand: p.state !== 'stand' };
      ps.update(DT, !!sk.sec);
      pg.step(DT);
      const live = p.alive && e.alive && p.state === 'stand' && e.state === 'stand' && !p.openHold && available;
      if (live) { T.live += DT / tk; if (A.armed) T.armedT += DT / tk; }
      if (A.armed && !a0) { T.ons++; armT0 = t; }
      if (live && t0 > 0 && A.t === 0 && !A.armed) { T.resets++; for (const k of Object.keys(why)) if (why[k] && !(k === 'move' && a0)) T.why[k] = (T.why[k] ?? 0) + 1; }
      if (A.armed && live) {
        T.crouchW += p.iaiReadyW ?? 0; T.handW += p.skill.thrustPose?.w ?? 0; T.wSamples++;
        if (ai.lastSeen) { T.onN++; if (ai.foeClass(ai.lastSeen).online) T.online++; }
      }
      if (ai.mode === 'attack' && lastMode !== 'attack' && live) { const dd = chest(); T.atk++; if (A.armed) T.atkArmed++; if (dd <= line) T.atkIn++; if (A.armed && dd <= line) T.atkArmedIn++; }
      lastMode = ai.mode;
      if (run && !run.done && t - run.t0 > 1.0 * tk) {
        run.done = true;
        const landed = (p.skill.secretStats.goNoSen?.landed ?? 0) > run.landed0;
        if (landed) T.landed++;
        if (run.fAlive && !e.alive) T.kill1++;
        if (E.GNS_DUMP === '1') console.log(`RES ${w} ${id} s${seed} landed ${landed} zones ${run.zones.join(',')} dead ${!e.alive}`);
        endAt = t + 1.0 * tk;
      }
      prevSec = sk.sec;
    };
    for (let i = 0; i < (SIM * tk) / DT; i++) {
      G.step();
      if (!p.alive || !e.alive) break;
      if (endAt != null && G.t >= endAt) break;
    }
    T.rounds++;
    if (!p.alive) T.pDead++;
    if (!e.alive) T.fDead++;
    G.world.free();
  }
}
const pm = (n) => (T.live > 0 ? ((60 * n) / T.live).toFixed(2) : '-');
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };
console.log(`[고노센 손가락 봇] 운전 ${DRIVE} · 웅크림 gnsCrouch ${S0.gnsCrouch}${'gnsReadyHip' in S0 ? ` · 허리 대기 gnsReadyHip ${S0.gnsReadyHip}` : ''} · 무기 ${wArg} · 인물 ${foes.length} × 씨앗 ${SEEDS} × ${SIM} s · 반응 ${REACT} s · 떨림 ${JIT} px · 떠돎 ${DRIFT} px${IMPATIENT ? ` · 참지 못함 ${IMPATIENT} s` : ''}`);
console.log(`판 ${T.rounds} · 비기를 쓸 수 있는 서 있는 때 ${T.live.toFixed(1)} s(실제) · 준비된 때 몫 ${(T.armedT / Math.max(1e-9, T.live) * 100).toFixed(0)} % · 준비 켜짐 ${T.ons} · 셈 0 으로 ${T.resets} (${Object.entries(T.why).map(([k, v]) => `${k} ${v}`).join(' · ')})`);
console.log(`창 ${T.win} (${Object.entries(T.ev).map(([k, v]) => `${k} ${v}`).join(' · ')}) · 분당 창 ${pm(T.win)} · 낸 ${T.fired} (분당 ${pm(T.fired)}) · 맞힘 ${T.landed} · 1 s 안 죽임 ${T.kill1} · 첫 창까지 p50 ${q(T.firstWin, 0.5).toFixed(1)} s(게임) · 창이 연 판 ${T.firstWin.length} / ${T.rounds}`);
console.log(`AI 공격 시작 ${T.atk} · 그때 준비 ${T.atkArmed} · 발도 선 안 ${T.atkIn} · 준비 + 선 안 ${T.atkArmedIn} · 준비된 동안 웅크림 무게 평균 ${(T.crouchW / Math.max(1, T.wSamples)).toFixed(2)} · 손 덧씌우기 평균 ${(T.handW / Math.max(1, T.wSamples)).toFixed(2)} · AI 가 본 칼끝 겨눔(준비된 동안) ${(100 * T.online / Math.max(1, T.onN)).toFixed(0)} % · 내 죽음 ${T.pDead} · 상대 죽음 ${T.fDead}`);
const zs = Object.entries(ZONES).sort((a, b) => b[1] - a[1]);
const zt = zs.reduce((s, [, v]) => s + v, 0);
console.log(`고노센 맞은 곳 (${zt}) ${zs.map(([k, v]) => `${k} ${v}`).join(' · ')} · 머리 · 목 ${(ZONES.head ?? 0) + (ZONES.neck ?? 0)} · 배 · 골반 ${(ZONES.abdomen ?? 0) + (ZONES.pelvis ?? 0)}`);
