// 손목 치기 칼 떨구기 (일본 심화 칸 J8 — 사장님 10/24 11:5x · 12:0x, config UNIQUE_ASSIST.koteDrop · combat.js koteCheck) 측정
//  손가락 봇(사람 흉내): 일본 무기 플레이어(고유 공격 강화 — PlayerUniqueAssist 단계 4 = 비껴 베기 · 손목 치기 · 제비 베기). 공격 결정마다 KOTE 몫(기본 0.5)은
//   긴 자세에서 짧게 내려베기(= 강화동작 손목 치기), 나머지는 다른 기본 긋기 · 그 가운데 15 % 는 탭 찌르기. 그은 뒤 30 % 되긋기.
//  맞받기 · 막기: 상대 칼이 가까이서 빠르게 움직이면 반응 지연(0.12 ~ 0.22 s) 뒤 COUNTER 몫(기본 0.5)은 손목 치기로 맞받고, 나머지는 0.6 ~ 1.0 s 막기 단추(유파 막기 — main.js 와 같이 PlayerParryGuard.step).
//  이동: 내 무기 간격(weapon_measured.js MEASURED) 띠 — 맞닿기 + 0.1 ~ 칼끝 거리 + 0.25 · 칼끝 거리 + 0.3 안에서 칠 때는 긋는 동안 앞으로 디딤(맞닿기까지).
//  같은 시드 · 같은 손가락 줄로 J8 켬(on — p 판 값) · 끔(off — p 0)을 견준다(떨굼이 나기 전까지는 두 판이 바이트 같다).
//   force = 끔 판에서 FORCE_T 초(기본 8)에 상대 칼을 떨군다(dropSword) — 손목 치기가 드물어도 '떨군 뒤'를 넉넉히 재려고(VARIANTS=off,on,force).
//  상대 = AI 숙련도 PROF(기본 3) · 무기 OPPS. 판 DUR 초(먼저 죽으면 0.5 s 뒤 끝).
//  떨군 뒤 봇은 손목 치기 대신 몸을 노리는 긋기를 0.5 ~ 0.8 s 마다 · 맞닿기 간격까지 끝까지 쫓는다(사람이라면 끝내러 들어간다).
//  센다(판당): 손목 치기 긋기 · 손목 치기 칼날 맞음(어느 몸체) · 굴림 · 떨굼 · 떨군 때 · 판 결과(누가 · 언제) · 떨군 뒤 끝날 때까지 · 떨군 뒤 AI 공격 시작 수 ·
//   떨군 뒤 상대가 준 칼날 상처 · 떨어진 칼 높이 · 값 깨짐(NaN)
//  OPPS=longsword,zweihander,rapier,qinggang SEEDS=901,902,903 PROF=3 W=uchigatana KOTE=0.5 COUNTER=0.5 DUR=30 OUT=<json> node tools/sim/kote_drop_duel.mjs
import { newRound, DT } from './harness_m.mjs';
import { SKILL, UNIQUE_ASSIST as UA } from '../../src/config.js';
import { PlayerUniqueAssist, strokeTechOf } from '../../src/unique_assist.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { TECH, G as PAD } from '../../src/ai_techniques.js';
import { writeFileSync } from 'node:fs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { MEASURED } from '../../src/weapon_measured.js';

const W = process.env.W ?? 'uchigatana';
const OPPS = (process.env.OPPS ?? 'longsword,zweihander,rapier,qinggang').split(',');
const SEEDS = (process.env.SEEDS ?? '901,902,903').split(',').map(Number);
const PROF = +(process.env.PROF ?? 3), DUR = +(process.env.DUR ?? 30), KOTE = +(process.env.KOTE ?? 0.5), COUNTER = +(process.env.COUNTER ?? 0.5), FORCE_T = +(process.env.FORCE_T ?? 8);
const VARIANTS = (process.env.VARIANTS ?? 'off,on').split(',');
const P_ON = UA.koteDrop.p;
const FRAME = 2 * DT;
const KOTE_BASE = { name: 'langortDown', from: PAD.langort, path: [[0.02, -0.22]] }; // 긴 자세에서 짧게 내려베기 → 강화동작 손목 치기 (unique_assist.js PLAYER_UNIQUE japanese kote)
const OTHER = TECH.map((t) => ({ name: t.name, from: t.from, path: t.path }));
const ARM = new Set(UA.koteDrop.parts);
const [CONTACT, REACH] = MEASURED[W] ?? MEASURED.longsword; // 내 무기 간격 (맞닿기 · 칼끝 거리) — 간격 띠 = 맞닿기 + 0.1 ~ 칼끝 거리 + 0.25 · 칠 때는 칼끝 거리 + 0.3 안에서 앞으로 디디며

function fight(opp, seed, v) {
  UA.koteDrop.p = v === 'on' ? P_ON : 0;
  let rs = (seed * 7919) >>> 0; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  SKILL.parryAssist = 0;
  const G = newRound({ walls: true, weapon: W, weapon2: opp, seed, persona: { proficiency: PROF } });
  applyWeaponMeasure(G.ai, opp);
  const D = G.player, A = G.enemy;
  D.skill.corr = SKILL.corr; D.skill.corrTip = SKILL.corrTip; D.skill.autoGuard = true;
  const guard = new PlayerParryGuard(D, A); D.stamina.controller = guard;
  const uq = new PlayerUniqueAssist(D, { stage: 4 });
  const r = { opp, seed, v, koteStrokes: 0, koteHits: {}, rolls: 0, drops: 0, dropT: null, end: null, win: false, lose: false, after: null, aiAttackAfter: 0, foeCutAfter: 0, swordMinY: null, nan: false, strokes: 0, counters: 0 };
  G.combat.hooks.onWound = (att, vic, w, pt, pr) => {
    if (att === D && strokeTechOf(D) === 'kote' && w.type === 'cut' && w.severity > 0) { const p = pr?.v?.part ?? '?'; r.koteHits[p] = (r.koteHits[p] ?? 0) + 1; }
    if (att === A && r.dropT != null && w.type !== 'blunt' && w.severity > 0) r.foeCutAfter++;
  };
  let queue = [], fx = D.handOffset.x, fy = D.handOffset.y, nextAtk = 2.6, due = Infinity, heldUntil = 0, lastMotion = -1, notice = false, step = 0, prevMode = null;
  const to = (p, vel, held) => { const fr = []; let x = fx, y = fy; for (let k = 0; k < 400; k++) { const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, vel * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, held]); } fx = x; fy = y; return fr; };
  const stroke = (b, back) => { let fr = to(b.from, 1.6, false); fr.push(...Array(4).fill([0, 0, false])); for (const p of b.path) fr.push(...to(p, 4, true)); if (back) { fr.push(...Array(3).fill([0, 0, true])); fr.push(...to(b.from, 4, true)); } fr.push(...Array(6).fill([0, 0, false])); return fr; };
  G.before = () => {
    const t = G.t, dist = D.foeDistance();
    const motion = A.armed && dist < 2.2 && Math.hypot(A.hitPointVel.x, A.hitPointVel.y, A.hitPointVel.z) > 2.5;
    if (motion) { lastMotion = t; if (!notice && !guard.held && due === Infinity && !queue.length) { due = t + 0.12 + rnd() * 0.1; notice = true; } } else if (t - lastMotion > 0.3) notice = false;
    if (t >= due) {
      due = Infinity;
      // 상대가 치고 들 때: COUNTER 몫은 손목 치기로 맞받음(「적이 치고 들 때, 아래에서 그 손을 쳐라」) · 나머지는 막기 단추
      if (D.armed && !D.stamina.exhausted && rnd() < COUNTER) { queue = stroke(KOTE_BASE, false); r.strokes++; r.counters++; nextAtk = t + 1.0 + rnd() * 0.6; }
      else heldUntil = t + 0.6 + rnd() * 0.4;
    }
    guard.held = t < heldUntil && !queue.length && !D.skill.tap; guard.broken = !!(D.skill.tap || D.skill.pom || queue.length);
    if (!guard.held && !queue.length && t >= nextAtk && dist < REACH + 0.3 && D.alive && D.armed && !D.stamina.exhausted) {
      const bare = !A.armed; // 칼을 떨군 상대: 손목 치기 대신 몸을 노리는 긋기 · 더 자주(사람이라면 끝내러 들어간다)
      const k = !bare && rnd() < KOTE;
      if (!k && rnd() < 0.15) D.skill.thrust();
      else { queue = stroke(k ? KOTE_BASE : OTHER[Math.floor(rnd() * OTHER.length)], rnd() < 0.3); r.strokes++; }
      nextAtk = t + (bare ? 0.5 + rnd() * 0.3 : 1.0 + rnd() * 0.6);
    }
    guard.step(DT); D.inputActive = guard.active;
    if ((step++ & 1) === 0) {
      const f = queue.shift() ?? [0, 0, false];
      const u = D.skill.uniq; u?.feed(f[0], f[1], FRAME, false);
      if (!(u ? u.holdsHand ?? u.running : false)) { D.handOffset.x += f[0]; D.handOffset.y += f[1]; }
      D.handHeld = f[2]; if (Math.abs(f[0]) + Math.abs(f[1]) > 1e-5) D.inputActive = true;
      if (!queue.length) { fx = D.handOffset.x; fy = D.handOffset.y; }
    }
    // 떨군 뒤에는 상대를 쫓아 맞닿기 간격까지 들어간다(앞으로 끝까지) · 그 밖엔 간격 유지
    const chase = !A.armed && A.alive;
    const lunge = queue.length > 0 && dist > CONTACT;
    if (D.stamina.exhausted || !D.alive) D.move.set(0, 0); else D.move.set(0.18 * Math.sin(t * 0.65 + seed), chase ? (dist > CONTACT ? 1 : 0) : lunge ? 0.6 : dist < CONTACT + 0.1 ? -0.55 : dist > REACH + 0.25 ? 0.45 : 0);
    D.stickX = D.move.x; D.stickY = D.move.y;
  };
  let end = DUR, inK = false, kMin = Infinity, kClash = 0, kAny = 0;
  r.kote = []; // 손목 치기 긋기마다 { 칼날 ↔ 상대 아래팔 가장 가까운 거리 m · 그동안 칼끼리 닿음 · 그동안 몸에 닿은 판정 수 }
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, w, pt, pr) => { pw(att, vic, w, pt, pr); if (att === D && inK) kAny++; };
  const _b = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < DUR / DT; i++) {
    const c0 = G.clashes;
    G.step();
    const k = strokeTechOf(D) === 'kote';
    if (k) {
      if (!inK) { inK = true; kMin = Infinity; kClash = 0; kAny = 0; }
      kClash += G.clashes - c0;
      for (const part of ['farmS', 'farmO']) { const a = A.bodies[part].translation(); for (let j = 0; j <= 8; j++) { const b = D.bladePoint(j / 8); kMin = Math.min(kMin, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); } }
    } else if (inK) { inK = false; r.kote.push([+kMin.toFixed(2), kClash, kAny]); }
    if (v === 'force' && r.dropT == null && G.t >= FORCE_T && A.armed && A.alive && D.alive) { A.dropSword(); r.dropT = +G.t.toFixed(2); r.forced = true; } // 떨군 뒤를 재는 판: FORCE_T 초에 상대 칼을 떨군다(손목 치기와 같은 dropSword)
    if (r.dropT == null && G.combat.koteLog?.some((x) => x.drop)) r.dropT = +G.t.toFixed(2);
    if (r.dropT != null) {
      const p = A.sword.translation(), vv = A.sword.linvel();
      if (![p.x, p.y, p.z, vv.x, vv.y, vv.z].every(Number.isFinite)) r.nan = true;
      r.swordMinY = Math.min(r.swordMinY ?? Infinity, +p.y.toFixed(3));
      if (G.ai.mode === 'attack' && prevMode !== 'attack') r.aiAttackAfter++;
    }
    prevMode = G.ai.mode;
    if ((!D.alive || !A.alive) && end === DUR) { end = G.t + 0.5; r.end = +G.t.toFixed(2); }
    if (G.t >= end) break;
  }
  const log = G.combat.koteLog ?? [];
  r.rolls = log.length; r.drops = log.filter((x) => x.drop).length;
  r.rollParts = log.map((x) => x.part).join(',');
  r.koteStrokes = uq.stats?.fired?.kote ?? 0;
  r.win = !A.alive && D.alive; r.lose = !D.alive && A.alive;
  if (r.dropT != null && r.end != null) r.after = +(r.end - r.dropT).toFixed(2);
  r.foeArmedEnd = A.armed; r.pBlood = +(1 - D.blood).toFixed(3); r.eBlood = +(1 - A.blood).toFixed(3);
  G.world.free();
  UA.koteDrop.p = P_ON;
  return r;
}

const out = [];
for (const opp of OPPS) for (const seed of SEEDS) for (const v of VARIANTS) {
  const r = fight(opp, seed, v);
  out.push(r);
  console.log(JSON.stringify(r));
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(out));
for (const v of VARIANTS) {
  const R = out.filter((r) => r.v === v), n = R.length, sum = (f) => R.reduce((s, r) => s + f(r), 0);
  const hits = sum((r) => Object.values(r.koteHits).reduce((a, b) => a + b, 0)), arm = sum((r) => Object.entries(r.koteHits).filter(([p]) => ARM.has(p)).reduce((a, [, b]) => a + b, 0));
  const D = R.filter((r) => r.dropT != null);
  console.log(`${v} n ${n} · 승 ${R.filter((r) => r.win).length} 패 ${R.filter((r) => r.lose).length} 무 ${R.filter((r) => r.end == null).length} · 손목 치기 긋기 ${(sum((r) => r.koteStrokes) / n).toFixed(2)}/판 · 칼날 맞음 ${(hits / n).toFixed(2)}/판(아래팔 ${(arm / n).toFixed(2)}) · 굴림 ${(sum((r) => r.rolls) / n).toFixed(2)}/판 · 떨굼 ${sum((r) => r.drops)} 판 ${D.length}` +
    (D.length ? ` · 떨군 판 승 ${D.filter((r) => r.win).length}/${D.length} · 떨군 뒤 끝 ${D.filter((r) => r.after != null).map((r) => r.after).join(',')} s · 떨군 뒤 AI 공격 ${sum((r) => r.aiAttackAfter)} · 떨군 뒤 받은 상처 ${sum((r) => r.foeCutAfter)} · 칼 높이 최저 ${Math.min(...D.map((r) => r.swordMinY)).toFixed(2)} m · NaN ${D.filter((r) => r.nan).length}` : ''));
}
