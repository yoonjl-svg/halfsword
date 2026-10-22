// ─────────────────────────────────────────────────────────────
//  iberian_spin.mjs — 이베리아 비기 '휘감아 돌기 (싱지르)' 사람 손맛 재기 (10/22 — docs/strike/iberian_spin_2026-10-22.md · src/iberian_spin.js)
//   노리는 사람 흉내: 칼끝 거리(reach) 밖에 서서 무장(금색 '!')을 기다리고, 무장이면 상대 가슴이 reach + FIRE 안일 때 공격 입력 하나(watch.fire → skill.secret).
//   무장 전: reach + 0.1 보다 가까우면 물러서고 reach + 0.8 보다 멀면 다가선다. 그 밖의 칼 · 막기 입력은 없다(비기만 재는 봇).
//   상대 = 인물 AI (characters.js — 무기 · 겉모습(갑옷 · 투구) · 숙련도 · 부활 그대로) · 'longsword' = 기본 상대(롱소드 · 보통).
//
//  node tools/sim/iberian_spin.mjs duel  [--weapons=zweihander,flamberge] [--opps=longsword,isolde,heinrich,tome,omari,minami,renji,eira] [--seeds=1-3] [--dur=30]
//                                        [--fire=0.6] [--hit=hitMul|finish|one] [--power=1.3] [--yaw=110] [--stiff=1.3] [--torso=0|1] [--settle=0|1] [--json=파일]
//  node tools/sim/iberian_spin.mjs probe [--weapons=…] [--gaps=2.3,2.6,2.9] [--hit=…] [--power=…]   서 있는 과녁(칼 충돌 끔 · 죽지 않음) 앞에서 한 번씩: 칼끝 빠르기 · 판정 에너지 · 나아간 거리
//   판당: 무장 수 · 낸 수 · 맞힘(상대 칼날 상처 심각도 > 0) · 막힘(칼끼리 닿고 못 맞힘) · 칼면 맞음(칼날이 면으로 몸에 닿음 — tapEdge 'flat') · 헛침 · 준 심각도 · 도는 동안(낸 때 ~ 경직 끝) 맞은 수
//   판정 배율 · 서보 힘은 SECRET.ibSpin.hit · power 를 이 도구 안에서만 바꾼다 (판 값 그대로)
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, THREE, CONFIG } from './harness_m.mjs';
import { Combat } from '../../src/combat.js';
import { CHARACTERS } from '../../src/characters.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { tapEdge } from './corr_lib.mjs';

const MODE = process.argv[2];
if (!['duel', 'probe'].includes(MODE)) throw new Error('첫 인자: duel | probe');
const args = {};
for (const a of process.argv.slice(3)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const range = (s) => {
  const out = [];
  for (const p of String(s).split(',')) {
    const m = p.match(/^(\d+)-(\d+)$/);
    if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i);
    else out.push(+p);
  }
  return out;
};
const { SECRET, SKILL, STRIKE } = CONFIG;
if (args.hit) SECRET.ibSpin.hit = args.hit;
if (args.power) SECRET.ibSpin.power = +args.power;
if (args.yaw) SECRET.ibSpin.wind.yaw = +args.yaw;
if (args.stiff) SECRET.stiff.iberian = +args.stiff; // 비기 뒤 굳음 견줌 (10/23 판 값 1.3 — 전 0.4)
for (const k of ['torso', 'settle']) if (args[k] != null) SECRET.ibSpin[k] = +args[k]; // 10/23 몸꼴 고침 견줌
const WEAPONS = list('weapons', 'zweihander,flamberge');
const tap = tapEdge(Combat, THREE, CONFIG);
const BY = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

/** 플레이어 몸 준비 (main.js newRound 와 같은 칸) */
function playerSetup(P) {
  P.skill.corr = SKILL.corr;
  P.skill.corrTip = SKILL.corrTip;
  P.skill.autoGuard = true;
}

/** 내 칼 → 상대 몸 닿음 사건 (부위가 2 스텝 넘게 끊겼다 다시 닿은 첫 분석 — iberian_flat 과 같은 셈) */
function contactLog(G, P, E) {
  const ev = [];
  const last = new Map();
  let k = 0;
  const on = { v: false };
  const l = (rec) => {
    if (!on.v || rec.att !== P || rec.vic !== E) return;
    const lk = last.get(rec.part);
    last.set(rec.part, k);
    if (lk != null && k - lk <= 2) return;
    ev.push({ k, kind: rec.kind, part: rec.part, speed: rec.speed, energy: rec.energy, landed: rec.energy >= (STRIKE.minEnergy ?? 0) });
  };
  tap.listeners.add(l);
  return { ev, on, tick: () => k++, done: () => tap.listeners.delete(l) };
}

function duel(w, oppId, seed) {
  const ch = oppId === 'longsword' ? null : BY[oppId];
  if (oppId !== 'longsword' && !ch) throw new Error(`인물 ${oppId}?`);
  const opts = ch ? { seed, weapon: w, weapon2: ch.weapon, difficulty: ch.ai.level, persona: ch.ai.persona, look2: ch.look, revive: ch.revive } : { seed, weapon: w, weapon2: 'longsword' };
  const G = newRound(opts);
  const P = G.player, E = G.enemy;
  playerSetup(P);
  const watch = new PlayerSecretWatch(P, E, { locked: false });
  const M = P.swordArt.measure;
  const FIRE = +arg('fire', 0.6);
  const log = contactLog(G, P, E);
  const fires = [];
  let cur = null;
  const pW0 = () => P.wounds?.length ?? 0;
  G.before = () => {
    watch.update(DT, !!P.skill.sec);
    log.tick();
    const d = P.foeDistance();
    if (P.skill.sec) {
      P.move.set(0, 0);
    } else if (watch.open?.ctx?.ev === 'spin' && d <= M.reach + FIRE && P.alive && E.alive) {
      const o = watch.fire();
      const ok = !!o && P.skill.secret(o);
      if (ok) {
        cur = { t: G.t, d, ev0: log.ev.length, w0: G.wounds.length, pw0: pW0(), blocked: false, done: null };
        fires.push(cur);
        log.on.v = true;
      }
      P.move.set(0, 0);
    } else {
      const armed = watch.open?.ctx?.ev === 'spin';
      P.move.set(0, armed ? (d > M.reach + FIRE ? 0.6 : 0) : d < M.reach + 0.1 ? -1 : d > M.reach + 0.8 ? 0.6 : 0);
    }
    if (cur && !cur.done) {
      if (P.feel?.touching) cur.blocked = true;
      if (!cur.spin && P.skill.sec?.spin) cur.spin = P.skill.sec.spin; // 대본 끝 기록 (막혀 멈춤 · 닿은 때 · 진행)
      if (!P.skill.sec) {
        cur.done = G.t;
        log.on.v = false;
      }
    }
  };
  const T = +arg('dur', 30);
  while (G.t < T && P.alive && E.alive) G.step();
  if (cur && !cur.done) cur.done = G.t;
  log.done();
  const rows = fires.map((f) => {
    const ws = G.wounds.slice(f.w0).filter((x) => x.t >= f.t && x.t <= f.done + DT);
    const dealt = ws.filter((x) => x.att === P && x.vic === E);
    const hurt = ws.filter((x) => x.att === E && x.vic === P && x.severity > 0);
    const ev = log.ev.slice(f.ev0);
    const hit = dealt.some((x) => x.severity > 0);
    const flat = ev.filter((e) => e.kind === 'flat' && e.landed).length;
    const first = ev[0] ?? null;
    return {
      w, opp: oppId, seed, t: +f.t.toFixed(2), d: +f.d.toFixed(2), hit, blocked: !hit && f.blocked, flat, contact: ev.length, whiff: !hit && !f.blocked && !ev.length,
      sev: +dealt.reduce((a, x) => a + x.severity, 0).toFixed(3), zones: dealt.filter((x) => x.severity > 0).map((x) => x.zone),
      why: f.spin?.why ?? null, touchQ: f.spin?.touchT != null ? +(f.spin.touchT / SECRET.ibSpin.time).toFixed(2) : null,
      hurt: hurt.length, hurtSev: +hurt.reduce((a, x) => a + x.severity, 0).toFixed(3), firstKind: first?.kind ?? null, firstSpeed: first ? +first.speed.toFixed(1) : null, firstE: first ? +first.energy.toFixed(0) : null,
    };
  });
  const out = { w, opp: oppId, seed, arms: watch.spinArm.ons, fires: rows.length, rows, pAlive: P.alive, eAlive: E.alive, t: +G.t.toFixed(1), pSev: +(P.wounds ?? []).reduce((a, x) => a + (x.severity ?? 0), 0).toFixed(2), eSev: +(E.wounds ?? []).reduce((a, x) => a + (x.severity ?? 0), 0).toFixed(2) };
  G.world.free();
  return out;
}

function probe(w, gap) {
  const G = newRound({ seed: 7, weapon: w, weapon2: 'longsword', gap, walls: false });
  const P = G.player, E = G.enemy;
  playerSetup(P);
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0); // 서 있는 과녁: 칼 충돌 끔 (iberian_flat pad 'stand' 와 같음)
  E.die = () => {};
  const watch = new PlayerSecretWatch(P, E, { locked: false });
  const log = contactLog(G, P, E);
  let fired = null, t0 = null, x0 = null;
  let tipMax = 0, cutTip = 0, cross = null;
  G.before = () => {
    watch.update(DT, !!P.skill.sec);
    log.tick();
    P.move.set(0, 0);
    if (!fired && G.t > 2.6) {
      const S = P.swordArt.school && watch.S;
      fired = P.skill.secret({ S, ctx: { ev: 'spin' } }) ? { d: P.foeDistance() } : null;
      if (fired) {
        log.on.v = true;
        t0 = G.t;
        const pp = P.bodies.pelvis.translation();
        x0 = { x: pp.x, z: pp.z };
      }
    }
    if (fired && P.skill.sec) {
      const v = P.tipVel.length();
      tipMax = Math.max(tipMax, v);
      if (!P.ibSpin) cutTip = Math.max(cutTip, v);
      // 가로지를 때 (칼이 몸 앞 가운데 선을 지나는 스텝 — 칼 가로 각 ±15° · 대본 끝 뒤): 칼끝 높이 · 칼 높이 각 · 칼끝 앞 거리
      if (!cross && (!P.ibSpin || P.ibSpin.free)) {
        const tp = P.bladePoint(1), b0 = P.bladePoint(0), fw = P.forward(), rg = P.right(), c = P.bodies.chest.translation();
        const dx = tp.x - b0.x, dz = tp.z - b0.z, dy = tp.y - b0.y, L = Math.hypot(dx, dy, dz);
        const yaw = (Math.atan2(dx * rg.x + dz * rg.z, dx * fw.x + dz * fw.z) * 180) / Math.PI;
        if (Math.abs(yaw) < 15) cross = { t: +(G.t - t0).toFixed(3), tip: +v.toFixed(1), ty: +tp.y.toFixed(2), el: +((Math.asin(dy / L) * 180) / Math.PI).toFixed(0), fwd: +((tp.x - c.x) * fw.x + (tp.z - c.z) * fw.z).toFixed(2), d: +P.foeDistance().toFixed(2) };
      }
    }
  };
  while (G.t < 6) G.step();
  log.done();
  const pp = P.bodies.pelvis.translation();
  const ws = G.wounds.filter((x) => x.att === P);
  const r = { w, gap, d: fired ? +fired.d.toFixed(2) : null, travel: x0 ? +Math.hypot(pp.x - x0.x, pp.z - x0.z).toFixed(2) : null, tipMax: +tipMax.toFixed(1), cutTip: +cutTip.toFixed(1), cross, ev: log.ev.map((e) => `${e.part}:${e.kind}:${e.speed.toFixed(1)}m/s:${e.energy.toFixed(0)}J`), wounds: ws.map((x) => `${x.zone}:${x.type}:${x.energy.toFixed(0)}J:${x.severity.toFixed(2)}`), state: P.state };
  G.world.free();
  return r;
}

if (MODE === 'probe') {
  for (const w of WEAPONS) for (const g of list('gaps', '2.3,2.6,2.9').map(Number)) console.log(JSON.stringify(probe(w, g)));
} else {
  const OPPS = list('opps', 'longsword,isolde,heinrich,tome,omari,minami,renji,eira');
  const SEEDS = range(arg('seeds', '1-3'));
  const all = [];
  for (const w of WEAPONS)
    for (const o of OPPS)
      for (const s of SEEDS) {
        const r = duel(w, o, s);
        all.push(r);
        if (!args.quiet) console.error(`… ${w} ${o} ${s}: 무장 ${r.arms} · 낸 ${r.fires} · 맞힘 ${r.rows.filter((x) => x.hit).length} · ${r.t} s`);
      }
  // 표: 무기 × 상대
  const fmt = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
  const head = '| 무기 | 상대 | 판 | 판당 무장 | 판당 낸 수 | 맞힘 | 막힘 | 칼면 맞음 | 헛침 | 맞힌 칼 심각도 평균 | 도는 동안 맞음 | 이김 / 짐 |';
  const lines = [head, '|' + '---|'.repeat(12)];
  const groups = new Map();
  for (const r of all) {
    const k = `${r.w}|${r.opp}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const tot = new Map();
  for (const [k, rs] of groups) {
    const [w, opp] = k.split('|');
    const rows = rs.flatMap((r) => r.rows);
    const n = rs.length;
    const hits = rows.filter((x) => x.hit);
    const s = { n, arms: rs.reduce((a, r) => a + r.arms, 0), fires: rows.length, hit: hits.length, blocked: rows.filter((x) => x.blocked).length, flat: rows.reduce((a, x) => a + x.flat, 0), whiff: rows.filter((x) => x.whiff).length, sev: hits.reduce((a, x) => a + x.sev, 0), hurt: rows.reduce((a, x) => a + x.hurt, 0), win: rs.filter((r) => r.pAlive && !r.eAlive).length, lose: rs.filter((r) => !r.pAlive).length };
    const T = tot.get(w) ?? { n: 0, arms: 0, fires: 0, hit: 0, blocked: 0, flat: 0, whiff: 0, sev: 0, hurt: 0, win: 0, lose: 0 };
    for (const key of Object.keys(T)) T[key] += s[key];
    tot.set(w, T);
    lines.push(`| ${w} | ${opp} | ${n} | ${fmt(s.arms / n)} | ${fmt(s.fires / n)} | ${s.hit} | ${s.blocked} | ${s.flat} | ${s.whiff} | ${fmt(s.hit ? s.sev / s.hit : NaN)} | ${s.hurt} | ${s.win} / ${s.lose} |`);
  }
  for (const [w, s] of tot) lines.push(`| **${w}** | 합 | ${s.n} | ${fmt(s.arms / s.n)} | ${fmt(s.fires / s.n)} | ${s.hit} | ${s.blocked} | ${s.flat} | ${s.whiff} | ${fmt(s.hit ? s.sev / s.hit : NaN)} | ${s.hurt} | ${s.win} / ${s.lose} |`);
  console.log(`설정: hit ${SECRET.ibSpin.hit} · power ${SECRET.ibSpin.power} · wind yaw ${SECRET.ibSpin.wind.yaw} · fire reach + ${arg('fire', 0.6)} · ${arg('dur', 30)} s`);
  console.log(lines.join('\n'));
  const all1 = all.flatMap((r) => r.rows);
  const hitR = all1.filter((x) => x.hit);
  console.log(`맞힌 칼 첫 닿음: 빠르기 평균 ${fmt(hitR.reduce((a, x) => a + (x.firstSpeed ?? 0), 0) / Math.max(1, hitR.length))} m/s · 판정 에너지 평균 ${fmt(hitR.reduce((a, x) => a + (x.firstE ?? 0), 0) / Math.max(1, hitR.length))} J · 부위 ${hitR.flatMap((x) => x.zones).join(' ')}`);
  const whyN = {};
  for (const x of all1) whyN[x.why ?? '-'] = (whyN[x.why ?? '-'] ?? 0) + 1;
  const tq = all1.filter((x) => x.touchQ != null).map((x) => x.touchQ).sort((a, b) => a - b);
  console.log(`대본 끝: ${Object.entries(whyN).map(([k, v]) => `${k} ${v}`).join(' · ')} · 칼이 처음 닿은 돌기 시각(몫 — 1 = 한 바퀴) 중앙 ${tq.length ? tq[Math.floor(tq.length / 2)] : '-'} (n ${tq.length})`);
  if (args.json) writeFileSync(args.json, JSON.stringify(all));
}
