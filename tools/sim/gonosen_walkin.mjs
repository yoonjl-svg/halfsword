// 일본 고노센 — 걸어 드는 상대 (10/25 16:0x 사장님 'B 켬' · '고노센을 천천히 걸어들어와서 파훼할 수 있어야 해. 최고 속도 기준으로 상위 30% 정도를 빠르게 걸어들어오는 것으로'
//  — docs/strike/school_secret_2026-10-09.md §18). 판정 · 실행은 게임 함수 그대로(읽기만).
//  고노센 쓰는 몸(가만히 서서 기다림) 대 걸어 드는 몸(스틱 S 로 곧장 앞 · 손 입력 없음 · 내 칼끝 거리 안이면 멈춰 0.6 s 마다 톡 찌르기).
//   걷는 동안 칼: WALK_GUARD=1(기본) 막기 단추를 누른 채(PlayerParryGuard held — 앞을 가림 · 들어오는 칼을 지금 모습으로 읽어 막기 자리로) · 0 = 쉬는 겨눔 그대로.
//   WALK_GUARD=1 이면 칼끝 거리 안에서도 단추를 누른 채 서 있다가, 상대가 발도를 낸 뒤(굳음 — 받아 낸 뒤 치는 사람) 또는 칼끝 거리 안에 1.5 s 서 있었으면 단추를 놓고 찌른다
//   (main.js — 누른 채 톡이면 막기를 놓음과 같은 차례 · 1.5 s 는 봇의 참을성일 뿐 게임 값 아님). 0 이면 칼끝 거리에 들자마자 찌름.
//   mode human — 고노센 = 사람 봇(PlayerSecretWatch · 창이 열리면 REACT 초 뒤 탭 — gonosen_play.mjs 와 같은 차례) · 걷는 몸 = 상대 자리(AI 없이 이 봇)
//   mode ai — 고노센 = 숙련도 5 일본 AI(상대 자리 · 비기는 지금 모습 · 반응 0) · 걷는 몸 = 사람 자리(gonosen_ai.mjs 의 걷는 봇과 같은 꼴)
//  재는 것: 상대 다가옴 빠르기(고노센 쪽 눈 — secretEvent 와 같은 셈: 상대 골반 빠르기의 나 쪽 몫, 지금 모습 한 스텝) — 발도 선을 넘는 스텝 · 선 앞뒤 0.5 m 걸음 동안 스텝마다(분포) ·
//   선을 넘는 스텝의 최근 0.6 s 평균(들어옴 판정과 같은 지수 평균) / 창(사건별 — 들어옴 천천히 · 들어옴 빠르게 · 칼을 듦 · 달려듦 · 헛침) · 발도 낸 · 맞힘 · 막힘 · 헛침 ·
//   그 발도로 죽임 · 발도 뒤 굳음 동안 고노센 쪽이 베임 · 죽음
//  실행: node tools/sim/gonosen_walkin.mjs [씨앗 4] [초 20] [고노센 무기 monohoshizao,uchigatana,muramasa] [걷는 칼 longsword,rapier,zweihander] [스틱 0.5,0.7,1] [REACT 0.25] [mode human|ai]
//  스위치: GNS_BLOCK=0|1|2 (B · ?gnsEnterBlock — 2 = 앞을 가린 상대도 막음) · CHARGE=수 (달려듦 빠르기 · ?foeChargeSpeed) · WALK_GUARD=0|1 · GNS_DUMP=1 창 한 줄씩
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch, gnsEnterLine } from '../../src/secret.js';
import { iaiBusy } from '../../src/secret_instant.js';

const [seedsArg = '4', simArg = '20', gArg = 'monohoshizao,uchigatana,muramasa', wArg = 'longsword,rapier,zweihander', sArg = '0.5,0.7,1', rArg = '0.25', modeArg = 'human'] = process.argv.slice(2);
const E = process.env;
const S0 = CONFIG.SECRET;
if (E.GNS_BLOCK != null) S0.gnsEnterBlock = [0, 1, 2].includes(+E.GNS_BLOCK) ? +E.GNS_BLOCK : 1; // 2 = 앞을 가린 상대도 막음
if (E.CHARGE != null && +E.CHARGE > 0) S0.foeChargeSpeed = CONFIG.realV(+E.CHARGE); // 실제 m/s (주소 ?foeChargeSpeed 와 같게 — 표준 시간 10/25)
if (E.CHARGE_AVG != null) S0.foeChargeAvg = +E.CHARGE_AVG ? 1 : 0; // 달려듦 빠르기 최근 0.6 s 평균 (?foeChargeAvg)
const SEEDS = +seedsArg, SIM = +simArg, REACT = +rArg, MODE = modeArg;
const GUARD = E.WALK_GUARD == null ? 1 : +E.WALK_GUARD ? 1 : 0;
// (iaiBusy 는 아래 import — walkStep 이 상대 발도를 읽음)
const TH = S0.foeChargeSpeed;
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)} %` : '-');

/** 걷는 몸: 스틱 go 로 곧장 앞 · 칼끝 거리 안이면 멈춰 0.6 s 마다 톡 찌르기 · 막기 단추(st.pg)는 걷는 동안 누르고 찌를 거리에선 놓음 */
function walkStep(w, go, t, st, dt) {
  const d = w.foeDistance();
  const reach = w.swordArt.measure.reach;
  const s = d > reach ? go : 0;
  w.move.set(0, s); w.stickX = 0; w.stickY = s;
  w.inputActive = false; w.handHeld = false;
  const inReach = d <= reach + 0.1;
  st.inT = inReach ? (st.inT ?? 0) + dt : 0;
  if (w.foe && iaiBusy(w.foe)) st.punish = true; // 상대가 발도를 냄 — 이제 친다
  const attack = inReach && (!GUARD || st.punish || st.inT >= 1.5);
  if (st.pg) {
    st.pg.held = !!GUARD && !attack && !w.skill.tap;
    st.pg.step(dt);
  }
  if (attack && t >= st.next && w.state === 'stand' && w.alive && w.foe?.alive) { w.skill.thrust(); st.next = t + 0.6; }
}
class WalkBot {
  constructor(me, foe) { this.me = me; this.foe = foe; this.t = 0; this.st = { next: 0, pg: null }; this.go = 0; me.skill.autoGuard = true; }
  update(dt) { this.t += dt; walkStep(this.me, this.go, this.t, this.st, dt); }
}

const rows = [];
for (const gw of gArg.split(',')) for (const ww of wArg.split(',')) for (const go of sArg.split(',').map(Number)) {
  const R = { gw, ww, go, rounds: 0, cross: [], crossEma: [], band: [], bandMax: [], win: { slow: 0, fast: 0, raise: 0, charge: 0, recover: 0 }, fired: 0, landed: 0, blocked: 0, whiff: 0, kill: 0, stiffHit: 0, gDead: 0, wDead: 0, online: 0, crossN: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const human = MODE !== 'ai';
    const G = human
      ? newRound({ weapon: gw, weapon2: ww, seed, AIClass: WalkBot, walls: true })
      : newRound({ weapon: ww, weapon2: gw, seed, persona: { proficiency: 5 }, difficulty: 'hard', walls: true });
    const user = human ? G.player : G.enemy;
    const walker = human ? G.enemy : G.player;
    if (human) G.ai.go = go;
    const wpg = new PlayerParryGuard(walker, user); // 걷는 몸 막기 단추 (WALK_GUARD)
    walker.stamina.controller = wpg;
    let ps = null, pg = null, sense;
    if (human) {
      user.skill.level = 0.7; user.skill.autoGuard = true;
      pg = new PlayerParryGuard(user, walker); user.stamina.controller = pg;
      ps = new PlayerSecretWatch(user, walker);
      if (ps.S?.name !== 'goNoSen') throw new Error(`${gw}: 고노센이 아님`);
      sense = ps.sense;
    } else {
      if (G.ai.secret?.name !== 'goNoSen') throw new Error(`${gw}: AI 고노센 없음`);
      user.stamina.controller = G.ai; // AI 몸의 기력 장부는 AI (걷는 몸 막기 단추가 덮어쓰지 않게)
      walker.skill.autoGuard = true;
      sense = G.ai.sense;
    }
    const L = gnsEnterLine(human ? ps.view() : G.ai.M);
    const wst = { next: 0, pg: wpg };
    if (human) G.ai.st.pg = wpg;
    let seen = 0, due = null, prevD = null, ema = 0, draw = null, lastCtx = null, walking = true;
    G.onWound = (att, vic, r) => { if (vic === user && draw && (r.severity ?? 0) > 0) draw.hurt = true; };
    G.before = (t) => {
      if (human) {
        if (ps.opened !== seen) {
          seen = ps.opened;
          if (ps.open) {
            const c = ps.open.ctx ?? {};
            const k = c.ev === 'enter' ? (c.fast ? 'fast' : 'slow') : c.ev === 'raise' ? (c.charge ? 'charge' : 'raise') : c.ev === 'recover' ? 'recover' : 'raise';
            R.win[k]++;
            due = t + REACT;
            if (E.GNS_DUMP === '1') console.log(`WIN ${gw} ${ww} ${go} s${seed} t ${t.toFixed(2)} ${k} d ${user.foeDistance().toFixed(2)}`);
          }
        }
        if (due != null && t >= due) {
          due = null;
          if (ps.open && !user.skill.secretPhase && user.alive) { const o = ps.fire(); if (o && user.skill.secret(o)) { R.fired++; lastCtx = o.ctx; } }
        }
        ps.update(DT, !!user.skill.sec);
        pg.step(DT);
        user.inputActive = false; user.handHeld = false; user.move.set(0, 0); user.stickX = 0; user.stickY = 0;
      } else walkStep(walker, go, t, wst, DT);
      // 다가옴 (고노센 쪽 눈 — 지금 모습)
      const c = user.bodies.chest.translation();
      const s0 = sense.seen(0);
      const dx = s0.cx - c.x, dz = s0.cz - c.z;
      const d0 = Math.max(0.01, Math.hypot(dx, dz));
      const cl = -(s0.vx * dx + s0.vz * dz) / d0;
      ema += (cl - ema) * Math.min(1, DT / 0.6);
      const live = user.alive && walker.alive && user.state === 'stand' && walker.state === 'stand';
      if (walking && walker.foeDistance() <= walker.swordArt.measure.reach) walking = false; // 멈춰 찌르기 시작 — 걸음 재기 끝
      if (live && walking && d0 <= L + 0.5 && d0 >= L - 0.5) R.band.push(cl);
      if (live && prevD != null && prevD > L && d0 <= L) {
        R.cross.push(cl); R.crossEma.push(ema); R.crossN++;
        const bx = s0.tx - s0.mx, by = s0.ty - s0.my, bz = s0.tz - s0.mz, qx = c.x - s0.mx, qy = c.y - s0.my, qz = c.z - s0.mz;
        if ((bx * qx + by * qy + bz * qz) / (Math.hypot(bx, by, bz) * Math.hypot(qx, qy, qz) + 1e-6) > 0.88) R.online++; // 칼끝이 내 몸을 겨눈 채 넘음 (foeOnline)
      }
      prevD = live ? d0 : null;
      // 발도: 시작 · 끝
      if (user.iai && !draw) {
        draw = { wAlive: walker.alive, hurt: false, done: false };
        if (!human) R.fired++;
      }
      if (draw && !draw.done && !user.iai && user.instantResult) {
        draw.done = true;
        const ir = user.instantResult;
        if (ir.hit) R.landed++; else if (ir.blocked) R.blocked++; else R.whiff++;
      }
      if (draw?.done && !iaiBusy(user)) {
        if (draw.wAlive && !walker.alive) R.kill++;
        if (draw.hurt) R.stiffHit++;
        draw = null;
      }
    };
    for (let i = 0; i < SIM / DT; i++) {
      G.step();
      if (!user.alive || !walker.alive) { if (draw?.done && draw.wAlive && !walker.alive) R.kill++; break; }
    }
    R.rounds++;
    if (!user.alive) R.gDead++;
    if (!walker.alive) R.wDead++;
    G.world.free();
  }
  rows.push(R);
}
const S = CONFIG.SECRET;
console.log(`[고노센 대 걸어 드는 몸] mode ${MODE} · B 막힘 ${['끔', '켬', '켬 + 앞 가림'][S.gnsEnterBlock]} · 달려듦 ${+TH.toFixed(3)} 게임 m/s = 실제 ${+(TH * CONFIG.TIME.tempo).toFixed(3)} (빠르기 칸은 모두 게임 m/s · 실제 = × 템포 ${CONFIG.TIME.tempo}) (${S.foeChargeAvg ? "0.6 s 평균" : "한 스텝"}) · 걷는 몸 막기 단추 ${GUARD ? '누름' : '안 누름'} · 씨앗 ${SEEDS} × ${SIM} s${MODE !== 'ai' ? ` · 탭 반응 ${REACT} s` : ''}`);
console.log(`| 고노센 | 걷는 칼 | 스틱 | 판 | 선 앞뒤 0.5 m 다가옴 p10 · p50 · p90 · 최고 (> ${TH} · > 0.9 몫) | 선을 넘는 스텝 p50 · 최고 (0.6 s 평균 p50) · 칼끝 겨눔 | 창 천천히 · 빠르게 · 듦 · 달려듦 · 헛침 | 발도 낸 · 맞힘 · 막힘 · 헛침 | 그 칼로 죽임 | 굳음 동안 베임 | 고노센 죽음 · 걷는 몸 죽음 |`);
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const R of rows) {
  const b = R.band;
  const share = (th) => pct(b.filter((x) => x > th).length, b.length);
  console.log(`| ${R.gw} | ${R.ww} | ${R.go} | ${R.rounds} | ${f2(q(b, 0.1))} · ${f2(q(b, 0.5))} · ${f2(q(b, 0.9))} · ${f2(q(b, 1))} (${share(TH)} · ${share(0.9)}) | ${f2(q(R.cross, 0.5))} · ${f2(q(R.cross, 1))} (${f2(q(R.crossEma, 0.5))}) · ${R.online}/${R.crossN} | ${R.win.slow} · ${R.win.fast} · ${R.win.raise} · ${R.win.charge} · ${R.win.recover} | ${R.fired} · ${R.landed} · ${R.blocked} · ${R.whiff} | ${R.kill} | ${R.stiffHit} | ${R.gDead} · ${R.wDead} |`);
}
// 스틱별 합
for (const go of [...new Set(rows.map((r) => r.go))]) {
  const rs = rows.filter((r) => r.go === go);
  const sum = (k) => rs.reduce((s, r) => s + r[k], 0);
  const band = rs.flatMap((r) => r.band), cross = rs.flatMap((r) => r.cross);
  const W = { slow: 0, fast: 0, raise: 0, charge: 0, recover: 0 };
  for (const r of rs) for (const k in W) W[k] += r.win[k];
  console.log(`스틱 ${go}: 판 ${sum('rounds')} · 선 앞뒤 다가옴 p50 ${f2(q(band, 0.5))} · p90 ${f2(q(band, 0.9))} · 최고 ${f2(q(band, 1))} · > ${TH} ${pct(band.filter((x) => x > TH).length, band.length)} · > 0.9 ${pct(band.filter((x) => x > 0.9).length, band.length)} · 넘는 스텝 p50 ${f2(q(cross, 0.5))} · 최고 ${f2(q(cross, 1))} · > ${TH} ${cross.filter((x) => x > TH).length}/${cross.length} · 창 천천히 ${W.slow} · 빠르게 ${W.fast} · 듦 ${W.raise} · 달려듦 ${W.charge} · 헛침 ${W.recover} · 발도 ${sum('fired')} · 맞힘 ${sum('landed')} (${pct(sum('landed'), sum('fired'))}) · 막힘 ${sum('blocked')} · 헛침 ${sum('whiff')} · 그 칼로 죽임 ${sum('kill')} · 굳음 동안 베임 ${sum('stiffHit')} · 고노센 죽음 ${sum('gDead')} · 걷는 몸 죽음 ${sum('wDead')}`);
}
