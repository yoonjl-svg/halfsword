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
//                                [--measure=c,r,cl,cut] 채찍 간격표 · [--flexMax=] 휘는 마디 물리 튐 문턱(STRIKE.flexSpeedMax) · [--speedBonus=k] 견줌만(게임에 없음) 판정 에너지 × (1 + k × 닿은 빠르기 ÷ 20) — 넷째 일 §14
//   (채찍) 판마다 덩굴 닿음 빠르기도 셈: 닿음 수 cN · 30 m/s 넘음 c30 · 문턱에 버려짐 cDrop · 가장 빠른 닿음 cMax · 30 넘어 난 판정 J fastJ · 그 마디 fastSeg · 마디 최고 빠르기 segVmax · 기력 평균 stam · 지친 시간 exhaustT
//   상대는 인물 시트 모두(손님 인물 롤랑 · 베르나르도 · 백린 포함 — CHARACTERS_BY_ID · 10/24) · 시트에 버티는 힘(vitality)이 있으면 상대 몸에 그대로
//   (10/24) 획마다 손맛도 셈: 긋기 시작(감기 · 멈춤 뒤) → 칼끝(몸통 기준) 가장 빠른 때 swingT · 그 빠르기 tipV · 손가락을 뗀 뒤 칼끝이 몸통 기준 3 m/s 아래로 0.1 s 머물기까지 recT(회수) · 판정 하나의 J 평균
//                                [--sound]  (10/24) 채찍 소리 때: 게임과 같은 휙 · 딱 걸쇠(src/whip_sound.js whipTipStep)를 화면마다(물리 2 스텝 = 60 fps) 돌려 딱이 난 때와 채찍 맞음(판정 5 J 넘음 · 살 · 옷 / 투구 · 판금) 때를 적고 맞음마다 가장 가까운 딱까지 시간을 셈 — 맞음 소리와 딱이 겹치나 (docs/import/bernardo_whip_import_2026-10-24.md)
//                                [--diag]  획 진단: 몸 닿음 · 칼만 · 둘 다 아님 갈래마다 시작 거리 · 덩굴 끝이 상대 쪽으로 간 거리 · 상대 몸통 · 머리와 가장 가까움 · 상대가 서 있던 획 몫
//   무기 뒤 ':k' = 채찍 무릎 꿇리기 켬(WHIP_KNEEL.p 판 값) · 없으면 끔(p 0 — 꿇리기 전) · ':ai' = 플레이어 자리도 AI 가 채찍(AI 스위치 WHIP_KNEEL.ai 켬) · ':ai0' = 같은 AI 채찍 · 스위치 끔(견줌)
//  판마다: 판정 수(strike 가 낸 맞음) · 가장 큰 한 맞음 J(maxJ · 머리 · 목 maxHeadJ) · 판정 J 합(머리 · 목 따로 — 둔기는 심각도 대신 J · 넘어짐 · 의식으로 친다) · 상대 넘어짐(down) · 의식 잃은 몫 · 상처 맞힘(심각도 > 0) · 준 심각도 · 받은 심각도 · 이김(상대 죽음 — 부활 뒤 마지막) / 짐 / 시간 끝 · 이긴 때 · 휘두른 획 · 막힌 획(칼끼리 닿고 못 맞힘) ·
//   꿇린 수 · 연달아 꿇림(일어선 뒤 1 s 안에 다시 꿇음 · 가장 긴 줄) · 상대가 꿇은 채 보낸 시간 · 머리 · 목 판정 수 · 주저앉음(서 있다 무릎 — 채찍 꿇림 빼고) ·
//   (채찍) 덩굴이 상대 칼에 붙어 있던 시간 · 붙음 횟수 · 가운데 길이 · 0.3 s 넘게 붙은 횟수 · 마디별 칼 닿음 몫 · 몸에 닿을 기회가 있던 획(그 획 1.2 s 안에 덩굴이 상대 몸에 닿음) 몫
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import * as THREE from '../../node_modules/three/build/three.module.js';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { TECH } from '../../src/ai_techniques.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { WEAPONS } from '../../src/weapons.js';
import { WHIP, setWhipPreset } from '../../src/druid_whip.js';
import { MEASURED } from '../../src/weapon_measured.js';
import { whipTipStep, whipCrackGate } from '../../src/whip_sound.js';

const args = {};
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (!m) throw new Error(`알 수 없는 인자 ${a}`);
  args[m[1]] = m[2] ?? true;
}
const arg = (k, d) => (args[k] === undefined ? d : args[k]);
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); return m ? Array.from({ length: +m[2] - +m[1] + 1 }, (_, i) => +m[1] + i) : [+p]; });
const { SKILL, STRIKE, WHIP_KNEEL, SOUND } = CONFIG;
const BY = CHARACTERS_BY_ID; // 손님 인물(롤랑 · 베르나르도 · 백린) · 변형도 (10/24 — 전 CHARACTERS 만 · 그 인물들 값은 같음)
const SND = !!args.sound; // --sound (10/24): 맞음 소리 · 딱 때 (아래)
const STAND = String(arg('stand', 'reach')), DIAG = !!args.diag, tipV = new THREE.Vector3(); // --diag : 획 진단 (아래)
const WHIP_OVR = args.whip ? JSON.parse(args.whip) : null, MB = args.mBlunt != null ? +args.mBlunt : null;
// --measure=c,r,cl,cut : 이 실행에서만 채찍 간격표(weapon_measured.js MEASURED.druid_whip — 맞닿음 · 한 걸음 · 너무 붙음 · 베는 시간) 바꿈 (덩굴 길이를 바꾼 판은 그 판으로 잰 간격을 넣어 견준다)
if (args.measure) MEASURED.druid_whip = String(args.measure).split(',').map(Number);
// --flexMax= : 휘는 무기 마디 닿음의 물리 튐 문턱(config STRIKE.flexSpeedMax) 이 실행에서만
if (args.flexMax != null) STRIKE.flexSpeedMax = +args.flexMax;
// --speedBonus=k : (견줌만 — 게임에 없음) 채찍 판정 에너지 × (1 + k × 닿은 빠르기 ÷ 20 m/s) — 사장님이 말한 '속도 보너스'(가짜 힘)가 어느 정도면 롱소드에 가까워지나
const SPEED_K = args.speedBonus != null ? +args.speedBonus : 0;
const P0 = WHIP_KNEEL.p, PK = args.kneelP != null ? +args.kneelP : P0; // --kneelP= : ':k' · ':ai' 판의 꿇리기 확률 (견줌용 — 판 값은 그대로)
const CUTS = TECH.filter((t) => t.kind === 'cut');
const FRAME = 2 * DT;

// --sound: 게임의 겹침 막기(whipCrackGate · SOUND.whipLashGap · whipFlam)를 판 시계로 다시 돌려 낸 · 막힌 수 [C2 맞음 낸, 막힌, 끝 딱 낸, 막힌] (멈칫 시간은 셈 밖)
function gateCount(SD) {
  const ev = [...SD.crack.map((t) => [t, 'crack']), ...SD.hit.filter((h) => !h[1]).map((h) => [h[0], 'lash'])].sort((a, b) => a[0] - b[0] || (a[1] === 'lash' ? -1 : 1));
  const G = {}, n = [0, 0, 0, 0];
  for (const [t, k] of ev) n[(k === 'lash' ? 0 : 2) + (whipCrackGate(G, k, t, SOUND) ? 0 : 1)]++;
  return n;
}
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
  if (ch?.vitality > 0) E.vitality = ch.vitality; // 버티는 힘 (롤랑 · 베르나르도 1.1 — 게임 main.js 와 같게 · 다른 인물은 시트에 없어 1)
  P.skill.corr = SKILL.corr; P.skill.corrTip = SKILL.corrTip; P.skill.autoGuard = true;
  const guard = aiDrive ? null : new PlayerParryGuard(P, E);
  let rs = (seed * 7919 + oppId.length * 104729) >>> 0;
  const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);
  const M0 = P.swordArt.measure, M = STAND === 'reach' ? M0 : { ...M0, reach: STAND === 'contact' ? M0.contact : +STAND }; // --stand= : 봇이 서는 간격 끝(기본 reach · 'contact' · 수 m — 견줌용)
  let queue = [], fx = P.handOffset.x, fy = P.handOffset.y, nextAtk = 2.4, due = Infinity, heldUntil = 0, lastMotion = -9, notice = false, step = 0;
  const strokes = [];
  const to = (p, v, held) => { const fr = []; let x = fx, y = fy; for (let k = 0; k < 400; k++) { const dx = p[0] - x, dy = p[1] - y, d = Math.hypot(dx, dy); if (d < 1e-6) break; const st = Math.min(d, v * FRAME); x += (dx / d) * st; y += (dy / d) * st; fr.push([(dx / d) * st, (dy / d) * st, held]); } fx = x; fy = y; return fr; };
  const swipe = (b, v) => { const fr = to(b.from, 1.6, true); fr.push(...Array(4).fill([0, 0, true])); fr.windN = fr.length; for (const p of b.path) fr.push(...to(p, v, true)); fr.push([0, 0, false]); return fr; }; // windN = 감기 · 멈춤 칸 수 (긋기 시작 때 — 손맛 셈)
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
        else { queue = swipe(CUTS[Math.floor(rnd() * CUTS.length)], 4 + rnd() * 2); strokes.push({ t, tap: false, w0: G.wounds.length, up: E.state === 'stand', cutAt: t + queue.windN * FRAME, relAt: t + (queue.length - 1) * FRAME }); }
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
  const SD = SND && X ? { W: {}, crack: [], swish: 0, hit: [], k: 0 } : null; // --sound: 딱 때 · 휙 수 · 맞음 [때, 갑옷, J]
  if (SD) G.onWound = (att, vic, r) => { if (att === P && r.energy >= 5) SD.hit.push([G.t, !!(r.helmet || r.plate), r.energy]); };
  // 덩굴 닿음 빠르기 (combat.analyze 를 감싸 잼 — 판정은 그대로): 닿음 수 · 30 m/s 넘음(칼 문턱) · 문턱에 버려짐 · 가장 빠른 닿음 · 30 넘게 닿아 판정이 난 J · 그 마디
  const CS = { n: 0, o30: 0, drop: 0, max: 0, fastJ: [], fastSeg: Array(8).fill(0) }, A0 = G.combat.analyze.bind(G.combat), vA = new THREE.Vector3(), vB = new THREE.Vector3();
  if (X) G.combat.analyze = (pr, point, S, Pp, predicting = false) => {
    const r = A0(pr, point, S, Pp, predicting);
    if (!predicting && pr.w.fighter === P && pr.w.flexible) {
      vA.copy(point).sub(S.com).cross(S.w).negate().add(S.v); vB.copy(point).sub(Pp.com).cross(Pp.w).negate().add(Pp.v);
      const sp = vA.sub(vB).length();
      if (r && SPEED_K) r.energy *= 1 + SPEED_K * sp / 20;
      CS.n++; CS.max = Math.max(CS.max, sp);
      if (sp > 30) { CS.o30++; const j = X.segments.findIndex((sg) => sg.body === pr.w.body); if (j >= 0) CS.fastSeg[j]++; if (r) CS.fastJ.push(r.energy); }
      if (!r && sp > STRIKE.flexSpeedMax) CS.drop++;
    }
    return r;
  };
  let segVmax = 0, stamSum = 0, stamN = 0, exhaustT = 0;
  const tipNow = new THREE.Vector3(), tipPrev = P.bladePoint(1, new THREE.Vector3()); // 손맛: 칼끝 빠르기 (몸통 기준 — 걷는 몫 뺌)
  const grip = { P: [0, 0], E: [0, 0] }; let nan = false; // 두 손 쥔 몫 (서서 칼을 쥔 스텝 가운데 빈손이 칼자루를 쥔 몫 — fighter.offHand gripping) · 칼끝 NaN
  const touches = (col, want) => { let hit = false; G.world.contactPairsWith(col, (c) => { if (hit) return; const info = G.combat.info?.get?.(c.handle) ?? P.colliderInfo.get(c.handle); if (info?.fighter === E && want(info)) G.world.contactPair(col, c, (m) => { if (m.numSolverContacts() > 0) hit = true; }); }); return hit; };
  while (G.t < dur && P.alive && E.alive) {
    G.step();
    if (SD && (++SD.k & 1) === 0) for (const [kind] of whipTipStep(SD.W, P.armed ? P.tipVel.length() : 0)) { if (kind === 'crack') SD.crack.push(G.t); else SD.swish++; }
    { P.bladePoint(1, tipNow); const cv = P.bodies.chest.linvel(), tv = Math.hypot((tipNow.x - tipPrev.x) / DT - cv.x, (tipNow.y - tipPrev.y) / DT - cv.y, (tipNow.z - tipPrev.z) / DT - cv.z); tipPrev.copy(tipNow);
      for (const st of strokes) if (st.cutAt != null && st.recT == null) {
        if (G.t >= st.cutAt && G.t <= st.cutAt + 0.8 && tv > (st.tipV ?? 0)) { st.tipV = tv; st.swingT = G.t - st.cutAt; }
        if (G.t >= st.relAt) { if (tv < 3) { st.calm ??= G.t; if (G.t - st.calm >= 0.1) st.recT = st.calm - st.relAt; } else st.calm = null; if (G.t - st.relAt > 2) st.recT = 2; }
      } }
    for (const [k, f] of [['P', P], ['E', E]]) if (f.state === 'stand' && f.armed && f.weaponCfg.twoHand) { grip[k][0]++; if (f.gripping) grip[k][1]++; }
    if (![tipNow.x, tipNow.y, tipNow.z].every(Number.isFinite) || ![E.bladePoint(1, tipV).x].every(Number.isFinite)) nan = true;
    stamSum += P.stamina.value; stamN++; if (P.stamina.exhausted) exhaustT += DT;
    if (X) for (const sg of X.segments) { const v = sg.body.linvel(); segVmax = Math.max(segVmax, Math.hypot(v.x, v.y, v.z)); }
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
    strokes: strokes.length, blocked: strokes.filter((s) => s.blocked).length,
    feel: strokes.filter((s) => s.recT != null && s.tipV != null).map((s) => [+s.swingT.toFixed(3), +s.tipV.toFixed(1), +s.recT.toFixed(3)]), // 손맛 [긋기 시작 → 칼끝 가장 빠름 s · 그 빠르기 m/s · 손 뗀 뒤 회수 s] (끝난 획만)
    hitJ: dealt.map((x) => Math.round(x.energy)),
    pGrip: grip.P[0] ? +(grip.P[1] / grip.P[0]).toFixed(3) : null, eGrip: grip.E[0] ? +(grip.E[1] / grip.E[0]).toFixed(3) : null, nan, // 두 손 쥔 몫 (나 · 상대) · NaN kneels: log.filter((x) => x.hit && x.att === 0).length, rolls: log.filter((x) => x.att === 0).length,
    aiKneels: log.filter((x) => x.hit && x.att === 1).length, rekneel, chainMax, kneelT: +kneelT.toFixed(1),
    heads: dealt.filter((x) => x.zone === 'head' || x.zone === 'neck').length, sits: sits - log.filter((x) => x.hit && x.att === 0).length,
    stam: +(stamSum / Math.max(1, stamN)).toFixed(1), exhaustT: +exhaustT.toFixed(1),
    ...(X ? { cN: CS.n, c30: CS.o30, cDrop: CS.drop, cMax: +CS.max.toFixed(1), fastJ: CS.fastJ.map((x) => Math.round(x)), fastSeg: CS.fastSeg, segVmax: +segVmax.toFixed(1) } : {}),
    ...(diag ? { diag } : {}),
    ...(SD ? { snd: { swish: SD.swish, crack: SD.crack.length, gate: gateCount(SD), hit: SD.hit.map(([t, a, e]) => { const d = SD.crack.map((c) => c - t).sort((x, y) => Math.abs(x) - Math.abs(y))[0]; return [+t.toFixed(3), a ? 1 : 0, Math.round(e), d == null ? null : +d.toFixed(4)]; }) } } : {}),
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
// 손맛 · 세기 묶음 (10/24 — 뒤랑달 무게 견줌): 판정 하나의 J 평균 · 가장 센 J · 긋기 시작 → 칼끝 가장 빠름 · 칼끝 최고 빠르기 · 손 뗀 뒤 회수 (끝난 긋기 획 모두의 가운데 값 · 평균)
console.log('\n| 무기 | 판 | 이김 · 짐 · 시간 끝 | 판정 / 판 | 판정 하나 J 평균 | 가장 센 J (판마다 가장 센 J 의 평균) | 긋기 획 | 긋기 시작 → 칼끝 가장 빠름 s (가운데 · 평균) | 칼끝 최고 m/s (가운데) | 회수 s (가운데 · 평균) | 두 손 쥔 몫 나 · 상대 | NaN 판 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const w of W) {
  const R = rows.filter((r) => r.w === w), n = R.length, F = R.flatMap((r) => r.feel), J = R.flatMap((r) => r.hitJ);
  const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[a.length >> 1] : NaN), avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
  const col = (i) => F.map((f) => f[i]);
  const gp = (A, k) => { const v = A.map((r) => r[k]).filter((x) => x != null); return v.length ? `${(100 * avg(v)).toFixed(1)} %` : '-'; };
  console.log(`| ${w}${LABEL} | ${n} | ${R.filter((r) => r.win).length} · ${R.filter((r) => r.loss).length} · ${R.filter((r) => !r.win && !r.loss).length} | ${f1(J.length / n)} | ${f1(avg(J))} | ${Math.max(0, ...J)} (${f1(avg(R.map((r) => r.maxJ)))}) | ${F.length} | ${med(col(0)).toFixed(3)} · ${avg(col(0)).toFixed(3)} | ${med(col(1)).toFixed(1)} | ${med(col(2)).toFixed(3)} · ${avg(col(2)).toFixed(3)} | ${gp(R, 'pGrip')} · ${gp(R, 'eGrip')} | ${R.filter((r) => r.nan).length} |`);
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
if (SND) { // 맞음마다 가장 가까운 딱까지 (딱 − 맞음 s): 같은 화면(±1/60 s) · 맞음 뒤 · 맞음 앞 · 0.3 s 안에 없음 — 살 · 옷 / 투구 · 판금 따로
  console.log('\n| 무기 | 판 | 휙 / 판 | 딱 / 판 | 맞음 갈래 | 맞음 수 | 같은 화면 ±1/60 s | 뒤 0.017 ~ 0.1 | 뒤 0.1 ~ 0.3 | 앞 0.017 ~ 0.1 | 앞 0.1 ~ 0.3 | 0.3 s 안에 딱 없음 |\n|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const w of W) {
    const R = rows.filter((r) => r.w === w && r.snd); if (!R.length) continue;
    for (const [lab, a] of [['살 · 옷', 0], ['투구 · 판금', 1]]) {
      const H = R.flatMap((r) => r.snd.hit).filter((h) => h[1] === a), n = H.length || 1, c = (f) => `${H.filter((h) => f(h[3])).length} (${Math.round(100 * H.filter((h) => f(h[3])).length / n)} %)`;
      const F = 1 / 60 + 1e-6, near = (d) => d != null && Math.abs(d) <= 0.3;
      if (a) { const g = R.reduce((s, r) => s.map((x, i) => x + r.snd.gate[i]), [0, 0, 0, 0]); console.log(`| ${w}${LABEL} | ${R.length} | 겹침 막기(${SOUND.whipLashGap} · ${SOUND.whipFlam} s) | | C2 맞음 낸 ${g[0]} · 막힌 ${g[1]} | 끝 딱 낸 ${g[2]} · 막힌 ${g[3]} | | | | | | |`); }
      console.log(`| ${w}${LABEL} | ${R.length} | ${(R.reduce((s, r) => s + r.snd.swish, 0) / R.length).toFixed(1)} | ${(R.reduce((s, r) => s + r.snd.crack, 0) / R.length).toFixed(1)} | ${lab} | ${H.length} | ${c((d) => near(d) && Math.abs(d) <= F)} | ${c((d) => near(d) && d > F && d <= 0.1)} | ${c((d) => near(d) && d > 0.1)} | ${c((d) => near(d) && d < -F && d >= -0.1)} | ${c((d) => near(d) && d < -0.1)} | ${c((d) => !near(d))} |`);
    }
  }
}
if (args.json) writeFileSync(args.json, JSON.stringify(rows));
