// ─────────────────────────────────────────────────────────────
//  whip_duel.mjs — 드루이드의 채찍은 쓸만한가 (10/23 — docs/import/druid_whip_2026-10-23.md §9). 물리 · 판정은 바꾸지 않는다(재기만).
//   사람처럼 쓰는 손가락 봇이 플레이어 자리에서 무기를 들고 인물 AI 와 판을 돈다 — 같은 봇으로 무기만 바꿔 견준다.
//   봇: 제 무기 간격(swordArt.measure — 채찍은 잰 값)의 clinch ~ reach 안에 서려고 스틱을 밀고, 0.9 ~ 1.5 s 마다(간격 안이면)
//    80 % 긋기(기본 베기 일곱 가운데 하나 — 시작 자리로 1.6 패드 m/s 감기 · 잠깐 멈춤 · 4 ~ 6 패드 m/s 로 긋기 · 손가락 뗌) · 20 % 톡.
//    막기: 상대 칼이 빠르게(2.5 m/s 넘게) 움직이고 2.2 m 안이면 0.15 ~ 0.25 s 뒤 0.6 ~ 1.0 s 막기 단추(PlayerParryGuard — 게임과 같은 판단).
//   상대 = 인물 AI (characters.js — 무기 · 겉모습(갑옷 · 투구) · 숙련도 · 부활 그대로) · 'longsword' = 기본 상대(롱소드 · 보통).
//
//  node tools/sim/whip_duel.mjs [--weapons=druid_whip,druid_whip:k,longsword,morgenstern] [--opps=longsword,isolde,heinrich,tome,omari,minami] [--seeds=1-3] [--dur=40] [--kneelP=0.5] [--json=파일]
//                                [--whip='{"friction":0.2}'] [--mBlunt=2] [--label=이름]   덩굴 값(druid_whip.js WHIP 칸) · 채찍 둔타 계수를 이 실행에서만 바꿔 견줌 (판 값은 그대로)
//                                [--stand=reach|contact|수]  봇이 서는 간격 끝(기본 reach = 한 걸음 내디뎌 닿는 거리 — 둘째 일 표 · contact = 맞닿는 간격 — 셋째 일 표, §12)
//                                [--diag]  획 진단: 몸 닿음 · 칼만 · 둘 다 아님 갈래마다 시작 거리 · 덩굴 끝이 상대 쪽으로 간 거리 · 상대 몸통 · 머리와 가장 가까움 · 상대가 서 있던 획 몫
//   무기 뒤 ':k' = 채찍 무릎 꿇리기 켬(WHIP_KNEEL.p 판 값) · 없으면 끔(p 0 — 꿇리기 전) · ':ai' = 플레이어 자리도 AI 가 채찍(AI 스위치 WHIP_KNEEL.ai 켬) · ':ai0' = 같은 AI 채찍 · 스위치 끔(견줌)
//  판마다: 판정 수(strike 가 낸 맞음) · 가장 큰 한 맞음 J(maxJ · 머리 · 목 maxHeadJ) · 판정 J 합(머리 · 목 따로 — 둔기는 심각도 대신 J · 넘어짐 · 의식으로 친다) · 상대 넘어짐(down) · 의식 잃은 몫 · 상처 맞힘(심각도 > 0) · 준 심각도 · 받은 심각도 · 이김(상대 죽음 — 부활 뒤 마지막) / 짐 / 시간 끝 · 이긴 때 · 휘두른 획 · 막힌 획(칼끼리 닿고 못 맞힘) ·
//   꿇린 수 · 연달아 꿇림(일어선 뒤 1 s 안에 다시 꿇음 · 가장 긴 줄) · 상대가 꿇은 채 보낸 시간 · 머리 · 목 판정 수 · 주저앉음(서 있다 무릎 — 채찍 꿇림 빼고) ·
//   (채찍) 덩굴이 상대 칼에 붙어 있던 시간 · 붙음 횟수 · 가운데 길이 · 0.3 s 넘게 붙은 횟수 · 마디별 칼 닿음 몫 · 몸에 닿을 기회가 있던 획(그 획 1.2 s 안에 덩굴이 상대 몸에 닿음) 몫
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { CHARACTERS } from '../../src/characters.js';
import { TECH } from '../../src/ai_techniques.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { WEAPONS } from '../../src/weapons.js';
import { WHIP, setWhipPreset } from '../../src/druid_whip.js';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [+p]; });
const { SKILL, STRIKE, WHIP_KNEEL } = CONFIG;
const BY = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
const STAND = String(arg('stand', 'reach')), DIAG = !!args.diag, tipV = new THREE.Vector3(); // --diag : 획 진단 (아래)
const WHIP_OVR = args.whip ? JSON.parse(args.whip) : null, MB = args.mBlunt != null ? +args.mBlunt : null;
const P0 = WHIP_KNEEL.p, PK = args.kneelP != null ? +args.kneelP : P0; // --kneelP= : ':k' · ':ai' 판의 꿇리기 확률 (견줌용 — 판 값은 그대로)
const CUTS = TECH.filter((t) => t.kind === 'cut');
const FRAME = 2 * DT;

function duel(wSpec, oppId, seed, dur) {
  const [w, mode] = wSpec.split(':');
  WHIP_KNEEL.p = mode === 'k' || mode === 'ai' || mode === 'ai0' ? PK : 0;
  WHIP_KNEEL.ai = mode === 'ai';
  const aiDrive = mode === 'ai' || mode === 'ai0';
  setWhipPreset('now');
  if (WHIP_OVR) Object.assign(WHIP, WHIP_OVR);
  const mb0 = WEAPONS.druid_whip.mBlunt;
  if (MB != null) WEAPONS.druid_whip.mBlunt = MB;
  const ch = oppId === 'longsword' ? null : BY[oppId];
  if (oppId !== 'longsword' && !ch) throw new Error(`인물 ${oppId}?`);
  const base = { seed, weapon: w, ...(aiDrive ? { AI2Class: AI } : {}) };
  const G = newRound(ch ? { ...base, weapon2: ch.weapon, difficulty: ch.ai.level, persona: ch.ai.persona, look2: ch.look, revive: ch.revive } : { ...base, weapon2: 'longsword' });
  const P = G.player, E = G.enemy;
  P.skill.corr = SKILL.corr; P.skill.corrTip = SKILL.corrTip; P.skill.autoGuard = true;
  const guard = aiDrive ? null : new PlayerParryGuard(P, E);
  let rs = (seed * 7919 + oppId.length * 104729) >>> 0;
  const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  const M0 = P.swordArt.measure, M = STAND === 'reach' ? M0 : { ...M0, reach: STAND === 'contact' ? M0.contact : +STAND }; // --stand= : 봇이 서는 간격 끝(기본 reach · 'contact' · 수 m — 견줌용)
  let queue = [], fx = P.handOffset.x, fy = P.handOffset.y, nextAtk = 2.4, due = Infinity, heldUntil = 0, lastMotion = -9, notice = false, step = 0;
  const strokes = [];
  const to = (p, v, held) => { const fr = []; let x = fx, y = fy; for (let k = 0; k < 400; k++) { const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, v * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, held]); } fx = x; fy = y; return fr; };
  const swipe = (b, v) => { const fr = to(b.from, 1.6, true); fr.push(...Array(4).fill([0, 0, true])); for (const p of b.path) fr.push(...to(p, v, true)); fr.push([0, 0, false]); return fr; };
  // 상대가 꿇은 시간 · 꿇림 줄
  let kneelT = 0, lastStandAt = -9, prevState = E.state, chain = 0, chainMax = 0, rekneel = 0, downs = 0, consMin = 1;
  const kn0 = () => (G.combat.whipKneelLog ?? []).filter((x) => x.hit).length;
  G.before = () => {
    const t = G.t, d = P.foeDistance();
    if (!aiDrive) {
      const motion = d < 2.2 && Math.hypot(E.hitPointVel.x, E.hitPointVel.y, E.hitPointVel.z) > 2.5;
      if (motion) { lastMotion = t; if (!notice && due === Infinity && !queue.length) { due = t + 0.15 + rnd() * 0.1; notice = true; } } else if (t - lastMotion > 0.3) notice = false;
      if (t >= due) { heldUntil = t + 0.6 + rnd() * 0.4; due = Infinity; }
      guard.held = t < heldUntil && !queue.length && !P.skill.tap && !P.skill.flick;
      guard.broken = !!(P.skill.tap || P.skill.pom || P.skill.flick || queue.length);
      if (!guard.held && !queue.length && t >= nextAtk && d < M.reach + 0.15 && P.alive && P.armed && !P.stamina.exhausted && E.alive) {
        if (rnd() < 0.2) { if (P.skill.thrust()) strokes.push({ t, tap: true, w0: G.wounds.length, up: E.state === 'stand' }); }
        else { queue = swipe(CUTS[Math.floor(rnd() * CUTS.length)], 4 + rnd() * 2); strokes.push({ t, tap: false, w0: G.wounds.length, up: E.state === 'stand' }); }
        nextAtk = t + 0.9 + rnd() * 0.6;
      }
      guard.step(DT);
      if ((step++ & 1) === 0) {
        const f = queue.shift();
        if (f) { P.handOffset.x += f[0]; P.handOffset.y += f[1]; P.handHeld = f[2]; P.inputActive = Math.abs(f[0]) + Math.abs(f[1]) > 1e-5 || guard.active; }
        else { P.handHeld = false; P.inputActive = guard.active; fx = P.handOffset.x; fy = P.handOffset.y; }
      }
      if (P.stamina.exhausted || !P.alive) P.move.set(0, 0);
      else P.move.set(0.18 * Math.sin(t * 0.65 + seed), d > M.reach ? 0.6 : d < M.clinch + 0.05 ? -0.6 : 0);
      P.stickX = P.move.x; P.stickY = P.move.y;
      for (const s of strokes) if (!s.done && t - s.t < 1.2 && P.feel?.touching) s.touched = true;
    }
    // 상대 꿇음 기록
    const st = E.state;
    if (st === 'getup') kneelT += DT;
    if (st === 'down' && prevState !== 'down') downs++;
    consMin = Math.min(consMin, E.consciousness ?? 1);
    if (prevState !== 'stand' && st === 'stand') lastStandAt = t;
    prevState = st;
  };
  let endT = null, nk = 0, sits = 0, wrapT = 0, wrapOn = -1, prevE = E.state;
  const eps = [], segT = Array(8).fill(0), X = P.flexWeapon;
  const touches = (col, want) => { let hit = false; G.world.contactPairsWith(col, (c) => { if (hit) return; const info = G.combat.info?.get?.(c.handle) ?? P.colliderInfo.get(c.handle); if (info?.fighter === E && want(info)) G.world.contactPair(col, c, (m) => { if (m.numSolverContacts() > 0) hit = true; }); }); return hit; };
  while (G.t < dur && P.alive && E.alive) {
    G.step();
    if (E.state === 'getup' && prevE === 'stand') sits++;
    prevE = E.state;
    if (X) {
      let blade = false, body = false;
      X.segments.forEach((sg, j) => { if (touches(sg.col, (i) => i.kind === 'weapon')) { blade = true; segT[j] += DT; } if (!body && touches(sg.col, (i) => i.kind !== 'weapon')) body = true; });
      if (blade) { wrapT += DT; if (wrapOn < 0) wrapOn = G.t; } else if (wrapOn >= 0) { eps.push(G.t - wrapOn); wrapOn = -1; }
      for (const st of strokes) if (G.t - st.t < 1.2) {
        if (body) st.body = true; if (blade) st.blade = true;
        if (DIAG) { // 획 진단: 그 획 동안 덩굴 끝이 제 가슴 → 상대 가슴 쪽으로 가장 멀리 간 거리 · 마디(끝 포함)와 상대 몸통 · 머리 가운데의 가장 가까운 거리
          const a = P.bodies.chest.translation(), b = E.bodies.chest.translation(), dx = b.x - a.x, dz = b.z - a.z, dd = Math.hypot(dx, dz) || 1;
          if (st.d0 == null) st.d0 = dd;
          X.point(1, tipV); st.reach = Math.max(st.reach ?? -9, ((tipV.x - a.x) * dx + (tipV.z - a.z) * dz) / dd);
          for (let j = 0; j <= 8; j++) { if (j < 8) { const q = X.segments[j].body.translation(); tipV.set(q.x, q.y, q.z); } else X.point(1, tipV); for (const nm of ['head', 'chest', 'abdomen', 'pelvis']) { const c = E.bodies[nm].translation(); st.dmin = Math.min(st.dmin ?? 9, Math.hypot(tipV.x - c.x, tipV.y - c.y, tipV.z - c.z)); } }
        }
      }
    }
    const k = kn0();
    if (k > nk) { // 새 꿇림: 일어선 뒤 1 s 안이면 줄을 잇는다
      if (G.t - lastStandAt < 1.0 && nk > 0) { chain++; rekneel++; } else chain = 1;
      chainMax = Math.max(chainMax, chain);
      nk = k;
    }
  }
  if (wrapOn >= 0) eps.push(G.t - wrapOn);
  if (!E.alive) endT = G.t;
  WEAPONS.druid_whip.mBlunt = mb0;
  const dealt = G.wounds.filter((x) => x.att === P && x.vic === E);
  const recv = G.wounds.filter((x) => x.att === E && x.vic === P);
  for (const s of strokes) {
    const ws = G.wounds.slice(s.w0).filter((x) => x.att === P && x.t >= s.t && x.t <= s.t + 1.2);
    s.hit = ws.length > 0;
    s.blocked = !s.hit && !!s.touched;
  }
  const log = G.combat.whipKneelLog ?? [];
  const diag = DIAG && X ? strokes.map((st) => ({ k: st.body ? 'body' : st.blade ? 'blade' : 'none', tap: st.tap, up: st.up, d0: +(st.d0 ?? 0).toFixed(2), reach: +(st.reach ?? 0).toFixed(2), dmin: +(st.dmin ?? 9).toFixed(2) })) : undefined;
  const out = {
    w: wSpec, opp: oppId, seed, t: +G.t.toFixed(1), win: !E.alive, loss: !P.alive, endT: endT && +endT.toFixed(1),
    hits: dealt.length, J: Math.round(dealt.reduce((a, x) => a + x.energy, 0)), headJ: Math.round(dealt.filter((x) => x.zone === 'head' || x.zone === 'neck').reduce((a, x) => a + x.energy, 0)), maxJ: Math.round(Math.max(0, ...dealt.map((x) => x.energy))), maxHeadJ: Math.round(Math.max(0, ...dealt.filter((x) => x.zone === 'head' || x.zone === 'neck').map((x) => x.energy))), downs, conc: +(1 - consMin).toFixed(2), wounds: dealt.filter((x) => x.severity > 0).length, sev: +dealt.reduce((a, x) => a + (x.severity ?? 0), 0).toFixed(2), recv: +recv.reduce((a, x) => a + (x.severity ?? 0), 0).toFixed(2),
    strokes: strokes.length, blocked: strokes.filter((s) => s.blocked).length, kneels: log.filter((x) => x.hit && x.att === 0).length, rolls: log.filter((x) => x.att === 0).length,
    aiKneels: log.filter((x) => x.hit && x.att === 1).length, rekneel, chainMax, kneelT: +kneelT.toFixed(1),
    heads: dealt.filter((x) => x.zone === 'head' || x.zone === 'neck').length, sits: sits - log.filter((x) => x.hit && x.att === 0).length,
    ...(diag ? { diag } : {}),
    ...(X ? { wrapT: +wrapT.toFixed(2), wrapEp: eps.length, wrapLong: eps.filter((e) => e >= 0.3).length, wrapMed: eps.length ? +[...eps].sort((a, b) => a - b)[eps.length >> 1].toFixed(2) : 0, segT: segT.map((x) => +x.toFixed(2)), bodyN: strokes.filter((st) => st.body).length, bladeN: strokes.filter((st) => st.blade).length } : {}),
  };
  G.world.free();
  return out;
}

const W = list('weapons', 'druid_whip,druid_whip:k,longsword,morgenstern');
const LABEL = args.label ? ` ${args.label}` : '';
const OPPS = list('opps', 'longsword,isolde,heinrich,tome,omari,minami');
const SEEDS = range(arg('seeds', '1-3'));
const DUR = +arg('dur', 40);
const rows = [];
for (const w of W) for (const o of OPPS) for (const s of SEEDS) {
  const r = duel(w, o, s, DUR);
  rows.push(r);
  console.log(JSON.stringify(r));
}
WHIP_KNEEL.p = P0; WHIP_KNEEL.ai = false;
// 무기마다 묶음
const f1 = (v) => (Number.isFinite(v) ? v.toFixed(v >= 10 ? 0 : 1) : '-');
console.log('\n| 무기 | 판 | 이김 · 짐 · 시간 끝 | 이긴 때 평균 s | 판정 / 판 | 판정 J 합 / 판 (머리 · 목) | 머리 · 목 판정 / 판 | 주저앉음 · 넘어짐 / 판 · 의식 잃은 몫 | 상처 맞힘 / 판 | 준 심각도 / 판 | 받은 심각도 / 판 | 획 / 판 | 막힌 획 몫 | 몸에 닿을 기회 획 · 칼 닿은 획 | 칼에 붙은 시간 / 판 s (횟수 · 가운데 s · 0.3 s 넘음) | 마디별 칼 닿음 몫 (1 → 8) | 꿇린 수 / 판 (굴림) | 연달아 꿇림 / 판 · 가장 긴 줄 | 상대 꿇은 시간 / 판 s |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const w of W) {
  const R = rows.filter((r) => r.w === w), n = R.length, m = (k) => R.reduce((a, r) => a + (r[k] ?? 0), 0) / n;
  const wins = R.filter((r) => r.win), ends = wins.map((r) => r.endT);
  const strokes = R.reduce((a, r) => a + r.strokes, 0), blocked = R.reduce((a, r) => a + r.blocked, 0);
  const X = R.filter((r) => r.wrapT != null), mx = (k) => X.reduce((a, r) => a + (r[k] ?? 0), 0) / Math.max(1, X.length);
  const seg = Array.from({ length: 8 }, (_, j) => X.reduce((a, r) => a + r.segT[j], 0)), segSum = seg.reduce((a, b) => a + b, 0) || 1;
  const sx = (k) => X.reduce((a, r) => a + r[k], 0) / Math.max(1, X.reduce((a, r) => a + r.strokes, 0)); // 획 몫 = 모든 판의 획을 합쳐 셈
  const wx = X.length ? `${(100 * sx('bodyN')).toFixed(0)} % · ${(100 * sx('bladeN')).toFixed(0)} % | ${mx('wrapT').toFixed(1)} (${mx('wrapEp').toFixed(1)} · ${mx('wrapMed').toFixed(2)} · ${mx('wrapLong').toFixed(1)}) | ${seg.map((v) => Math.round(100 * v / segSum)).join(' ')}` : '- | - | -';
  console.log(`| ${w}${LABEL} | ${n} | ${wins.length} · ${R.filter((r) => r.loss).length} · ${R.filter((r) => !r.win && !r.loss).length} | ${f1(ends.reduce((a, b) => a + b, 0) / Math.max(1, ends.length))} | ${f1(m('hits'))} | ${f1(m('J'))} (${f1(m('headJ'))}) | ${m('heads').toFixed(1)} | ${m('sits').toFixed(1)} · ${m('downs').toFixed(1)} · ${m('conc').toFixed(2)} | ${f1(m('wounds'))} | ${m('sev').toFixed(2)} | ${m('recv').toFixed(2)} | ${f1(m('strokes'))} | ${(100 * blocked / Math.max(1, strokes)).toFixed(0)} % | ${wx} | ${f1(m('kneels'))} (${f1(m('rolls'))}) | ${f1(m('rekneel'))} · ${Math.max(...R.map((r) => r.chainMax))} | ${f1(m('kneelT'))} |`);
}
if (DIAG) { // 획 진단 묶음: 몸 닿음 · 칼만 · 둘 다 아님 — 몫 · 그 획 시작 때 가슴 사이 거리 · 덩굴 끝이 상대 쪽으로 간 가장 먼 거리 · 마디와 상대 몸통 · 머리의 가장 가까운 거리 (가운데 값)
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1].toFixed(2) : '-');
  console.log('\n| 무기 | 획 갈래 | 몫 | 톡 몫 | 시작 거리 m | 끝이 간 거리 m | 몸통 · 머리와 가장 가까움 m |\n|---|---|---|---|---|---|---|');
  for (const w of W) {
    const D = rows.filter((r) => r.w === w).flatMap((r) => r.diag ?? []);
    for (const k of ['body', 'blade', 'none']) { const E = D.filter((x) => x.k === k); console.log(`| ${w}${LABEL} | ${k} | ${(100 * E.length / Math.max(1, D.length)).toFixed(0)} % | ${(100 * E.filter((x) => x.tap).length / Math.max(1, E.length)).toFixed(0)} % | ${med(E.map((x) => x.d0))} | ${med(E.map((x) => x.reach))} | ${med(E.map((x) => x.dmin))} |`); }
    const U = D.filter((x) => x.up), N = D.filter((x) => !x.up); // 상대가 서 있을 때 시작한 획 · 아닌 획(꿇음 · 넘어짐 · 일어나는 중)
    console.log(`| ${w}${LABEL} | 상대 서 있음 · 아님 | ${(100 * U.length / Math.max(1, D.length)).toFixed(0)} % · ${(100 * N.length / Math.max(1, D.length)).toFixed(0)} % | 몸 닿음 ${(100 * U.filter((x) => x.k === 'body').length / Math.max(1, U.length)).toFixed(0)} % · ${(100 * N.filter((x) => x.k === 'body').length / Math.max(1, N.length)).toFixed(0)} % | | | |`);
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows));
