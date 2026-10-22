// 이탈리아 거침없이 나아가 찌르기 (안다레 리솔루토) — 노리는 사람 손맛 측정 (10/22 — docs/strike/italian_risoluto_2026-10-22.md). 판정 · 실행은 게임 함수 그대로(읽기만).
//  운전(노리는 사람 흉내): 칼끝 쪽 절반이 보이면 내 칼 손 쪽 절반을 그 위로 옮긴다(손 빠르기 V 패드 m/s — 휘두르기 문턱 SKILL.swingSpeed 1.5 아래, 칼 위로 3 cm 를 노림) ·
//   스틱 앞으로 걸어 들어감(맞붙는 거리 clinch 에서 멈춤) · 창(금색 '!')이 열리면 REACT 초 뒤 탭 하나(main.js 와 같은 차례: 프레임 머리 fire → skill.secret) · 그 밖엔 치지 않음.
//  상대 = 인물 AI(시트 숙련도 · 성격).
//  실행: node tools/sim/risoluto_play.mjs [T 0.6] [두 번째 길 0|1] [씨앗 3] [초 30] [무기 rapier,dartagnan] [인물 isolde,tome,omari,minami,liao] [V 0.6] [REACT 0.25]
//  시험 스위치 (환경 변수 — 판 기본은 그대로, 감독 10/22 비교):
//   RISO_CLOSE=1 '다 붙었을 때' 창(SECRET.risolutoClose) · RISO_LINE=1 칼을 대지 않는 덮음(줄 막기 — SECRET.risolutoLine) · RISO_COVER=수 덮음 거리
//   RISO_GUARD=1 막기 단추를 누른 채 걸어 들어감(SECRET.risolutoGuard — 운전: 가슴 사이 3 m 안에서 누르고 쥠 · 손은 막기 단추가 쥠 · 탭은 같은 엄지라 단추를 놓고 · 비기가 끝나면 다시 누름) ·
//   RISO_OPP=0 막아찌르기 끔(SKILL.itOpposition) · RISO_PLAIN=1 대조(같은 때의 보통 탭 — 팔 늦춤 · 비기 배율 끔)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch, bladesTouch } from '../../src/secret.js';
import { coverDist } from '../../src/italian_risoluto.js';
import * as THREE from 'three';

const [Targ = '0.6', beatArg = '0', seedsArg = '3', simArg = '30', wArg = 'rapier,dartagnan', fArg = 'isolde,tome,omari,minami,liao', vArg = '0.6', rArg = '0.25'] = process.argv.slice(2);
const E = process.env;
CONFIG.SECRET.risolutoHold = +Targ;
CONFIG.SECRET.risolutoBeat = +beatArg ? 1 : 0;
if (E.RISO_COVER) CONFIG.SECRET.risolutoCover = +E.RISO_COVER;
if (E.RISO_CLOSE === '1') CONFIG.SECRET.risolutoClose = 1;
if (E.RISO_LINE === '1') CONFIG.SECRET.risolutoLine = 1;
const GUARD = E.RISO_GUARD === '1';
if (GUARD) CONFIG.SECRET.risolutoGuard = 1;
if (E.RISO_OPP === '0') CONFIG.SKILL.itOpposition = 0;
// 대조 RISO_PLAIN=1: 같은 때의 보통 탭 찌르기 — 상대 팔 늦춤 끔(FLOW_RECOVERY.seconds 0) · 비기 배율 1 (AI 비기는 닫혀 있어 사람 쪽만 바뀜)
const PLAIN = E.RISO_PLAIN === '1';
if (PLAIN) { CONFIG.FLOW_RECOVERY.seconds = 0; CONFIG.SECRET.power = 1; CONFIG.SECRET.hitMul = 1; }
const SEEDS = +seedsArg, SIM = +simArg, V = +vArg, REACT = +rArg;
const weapons = wArg.split(','), foes = fArg.split(',');
const v3 = () => new THREE.Vector3();
const a0 = v3(), a1 = v3(), b0 = v3(), b1 = v3(), pa = v3(), pb = v3(), _d1 = v3(), _d2 = v3(), _r = v3();
/** 두 선분 가장 가까운 점 (운전이 '눈으로 보는' 상대 칼 — pa 내 쪽 · pb 상대 쪽) */
function closest(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r), c = _d1.dot(_r), b = _d1.dot(_d2), den = a * e - b * b;
  let s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0;
  let t = (b * s + f) / e;
  if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
  pa.copy(p1).addScaledVector(_d1, s); pb.copy(p2).addScaledVector(_d2, t);
}
const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(f * s.length))] : NaN; };
const KEYS = ['rounds', 'hold', 'close', 'beat', 'fired', 'landed', 'blocked', 'armSlow', 'dealt', 'taken', 'pDead', 'fDead', 'foeFirst', 'opp', 'oppCover', 'oppWin', 'lineSteps'];
const rows = [];
for (const w of weapons) for (const id of foes) {
  const C = CHARACTERS_BY_ID[id];
  const R = { w, id, runs: [], ends: { foeSwing: 0, uncover: 0, meSwing: 0, stick: 0, gap: 0 } };
  for (const k of KEYS) R[k] = 0;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const G = newRound({ weapon: w, weapon2: C.weapon, seed, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
    const p = G.player, e = G.enemy;
    p.skill.level = 0.7; p.skill.autoGuard = true; p.canShove = true;
    const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, e);
    if (ps.S?.when !== 'risoluto') throw new Error(`${w}: 리솔루토가 아님 (${ps.S?.name})`);
    let tgt = [0.1, 0.05], due = null, seenOpen = 0, run = null, openT = null, oppSeen = 0, lastHurt = -1;
    G.onWound = (att, vic, r) => {
      if (vic === p) { R.taken += r.severity ?? 0; if ((r.severity ?? 0) > 0) lastHurt = G.t; if (run && !run.hitFoe && (r.severity ?? 0) > 0) run.foeFirst = true; }
      if (att === p && p.skill.sec?.risoluto) { R.dealt += r.severity ?? 0; if (run) { run.wound = true; run.hitFoe = true; } }
    };
    G.before = (t) => {
      // ① 입력 (프레임 머리 — main.js 와 같은 차례): 창이 열린 뒤 REACT 초에 탭 하나
      if (ps.opened !== seenOpen) { seenOpen = ps.opened; if (ps.open) { due = t + REACT; openT = t; } }
      if (due != null && t >= due) {
        due = null;
        if (GUARD) pg.held = false; // 폰: 막기 단추와 칼 쪽 화면이 같은 엄지 — 톡 하려면 단추를 놓음
        if (ps.open && !p.skill.secretPhase && p.alive) {
          const o = ps.fire();
          if (o && p.skill.secret(o)) { R.fired++; run = { touch: false, wound: false, hitFoe: false, foeFirst: lastHurt >= openT, openT }; } // 상대 칼 먼저: 창이 열린 뒤 내 찌르기가 맞기 전에 내가 상처(심각도 > 0)를 입음
        }
      }
      ps.update(DT, !!p.skill.sec);
      // 막기 단추 운전: 3 m 안에서 누르고 쥠 (비기 실행 · 굳음 동안은 놓아 둠 → 끝나면 다시 누름 = 새 누름)
      if (GUARD) pg.held = !p.skill.sec && p.foeDistance() < 3;
      pg.step(DT);
      if (pg.opposition.starts !== oppSeen) {
        oppSeen = pg.opposition.starts;
        R.opp++;
        if (coverDist(p, e) <= CONFIG.SECRET.risolutoCover || ps.riso.on) R.oppCover++; // 덮인 채(또는 칼끼리 덮인 꼴)에서 막아찌르기가 먼저 나감
        if (ps.open) R.oppWin++;
      }
      // ② 손: 막기 단추가 쥐는 동안 · 비기 실행 · 굳음 동안은 손을 대지 않음 (main.js 가 칼 입력을 막음)
      if (!GUARD && !p.skill.sec && p.armed && e.armed) {
        p.bladePoint(0, a0); p.bladePoint(0.5, a1); e.bladePoint(0.5, b0); e.bladePoint(1, b1);
        closest(a0, a1, b0, b1);
        const dv = pb.clone().sub(pa).applyQuaternion(p.yaw.clone().invert()); // 몸 틀: x 앞 · y 위 · z 칼 든 쪽
        if (p.foeDistance() < 3) tgt = [Math.max(-0.5, Math.min(0.5, tgt[0] + dv.z * 4 * DT)), Math.max(-0.3, Math.min(0.45, tgt[1] + (dv.y + 0.03) * 4 * DT))];
        const off = p.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, dd = Math.hypot(dx, dy), st = V * DT;
        if (dd > st) { off.x += (dx / dd) * st; off.y += (dy / dd) * st; } else off.set(tgt[0], tgt[1]);
        p.inputActive = dd > 1e-4;
      } else p.inputActive = GUARD ? pg.active : false;
      p.handHeld = !p.skill.sec;
      // ③ 발: 앞으로 (맞붙는 거리에서 멈춤) · 굳음 동안 스틱이 안 들음
      const fwd = p.skill.secretPhase !== 'stiff' && p.foeDistance() > p.swordArt.measure.clinch ? 1 : 0;
      p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
      // 막힘: 리솔루토 찌르기 동안 칼끼리 닿고 상처를 못 냄 · 상대 칼 먼저: 창이 열린 뒤 내 찌르기가 맞기 전에 내가 상처를 입음
      if (run && p.skill.sec?.risoluto && bladesTouch(p, e)) run.touch = true;
      if (run && !p.skill.sec) { if (run.touch && !run.wound) R.blocked++; if (run.foeFirst) R.foeFirst++; run = null; }
    };
    for (let i = 0; i < SIM / DT; i++) {
      G.step();
      if (!p.alive || !e.alive) break;
    }
    R.rounds++;
    if (!p.alive) R.pDead++;
    if (!e.alive) R.fDead++;
    const W = ps.riso;
    R.runs.push(...W.runs);
    R.hold += W.opens.hold; R.beat += W.opens.beat; R.close += W.opens.close ?? 0; R.lineSteps += W.lineSteps ?? 0;
    for (const k of Object.keys(R.ends)) R.ends[k] += W.ends[k];
    const st = p.skill.secretStats.andareRisoluto ?? { landed: 0, armSlow: 0 };
    R.landed += st.landed; R.armSlow += st.armSlow ?? 0;
    G.world.free();
  }
  rows.push(R);
}
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const S = CONFIG.SECRET;
const tags = [PLAIN && '대조: 팔 늦춤 · 비기 배율 끔', S.risolutoClose && '다 붙음 창', S.risolutoLine && '줄 막기 덮음', GUARD && '막기 단추 쥔 채', CONFIG.SKILL.itOpposition ? '' : '막아찌르기 끔'].filter(Boolean);
console.log(`${tags.length ? `[${tags.join(' · ')}] ` : ''}T ${S.risolutoHold} s · 두 번째 길 ${S.risolutoBeat ? '켬' : '끔'} · 덮음 ${S.risolutoCover} m · 씨앗 ${SEEDS} × ${SIM} s · 손 ${V} · 탭 반응 ${REACT} s`);
console.log('| 무기 | 상대 | 판 | 덮인 채 나아가기 ≥0.2 s (판당) | 길이 p50 · max | 창 이어짐 · 다 붙음 · 상대 박자 | 탭 | 맞힘 | 막힘 | 상대 칼 먼저 | 준 심각도 | 입은 심각도 | 내 죽음 · 상대 죽음 | 막아찌르기 (덮인 꼴 · 창 중) | 끝난 까닭 (상대 휘두름 · 덮음 풀림 · 가슴 사이 · 스틱 · 내 휘두름) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const T = { runs: [] };
for (const k of KEYS) T[k] = 0;
for (const R of rows) {
  const big = R.runs.filter((x) => x >= 0.2);
  console.log(`| ${R.w} | ${CHARACTERS_BY_ID[R.id].name} | ${R.rounds} | ${big.length} (${f1(big.length / R.rounds)}) | ${f2(q(big, 0.5))} · ${f2(q(big, 1))} | ${R.hold} · ${R.close} · ${R.beat} | ${R.fired} | ${R.landed} | ${R.blocked} | ${R.foeFirst} | ${f1(R.dealt)} | ${f1(R.taken)} | ${R.pDead} · ${R.fDead} | ${R.opp} (${R.oppCover} · ${R.oppWin}) | ${R.ends.foeSwing} · ${R.ends.uncover} · ${R.ends.gap} · ${R.ends.stick} · ${R.ends.meSwing} |`);
  T.runs.push(...big); for (const k of KEYS) T[k] += R[k];
}
const win = T.hold + T.close + T.beat;
console.log(`| 합 | | ${T.rounds} | ${T.runs.length} (${f2(T.runs.length / T.rounds)}) | ${f2(q(T.runs, 0.5))} · ${f2(q(T.runs, 1))} | ${T.hold} · ${T.close} · ${T.beat} | ${T.fired} | ${T.landed} | ${T.blocked} | ${T.foeFirst} | ${f1(T.dealt)} | ${f1(T.taken)} | ${T.pDead} · ${T.fDead} | ${T.opp} (${T.oppCover} · ${T.oppWin}) | |`);
console.log(`판당: 창 ${f2(win / T.rounds)} · 탭 ${f2(T.fired / T.rounds)} · 맞힘 ${f2(T.landed / T.rounds)} · 막힘 ${f2(T.blocked / T.rounds)} · 준 심각도 ${f2(T.dealt / T.rounds)} · 상대 칼 먼저 ${T.fired ? Math.round((100 * T.foeFirst) / T.fired) : '-'} % (탭 중) · 막아찌르기 ${f2(T.opp / T.rounds)} (덮인 꼴 ${T.oppCover} · 창 중 ${T.oppWin}) · 줄 막기 스텝 ${T.lineSteps}`);
const all = rows.flatMap((R) => R.runs);
console.log(`덮인 채 나아가기 길이 (모든 판 · 0 초 넘는 것 ${all.length}): p50 ${f2(q(all, 0.5))} · p90 ${f2(q(all, 0.9))} · ≥0.4 ${all.filter((x) => x >= 0.4).length} · ≥0.6 ${all.filter((x) => x >= 0.6).length} · ≥1.5 ${all.filter((x) => x >= 1.5).length}`);
