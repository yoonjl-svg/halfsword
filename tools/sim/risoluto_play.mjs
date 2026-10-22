// 이탈리아 거침없이 나아가 찌르기 (안다레 리솔루토) — 노리는 사람 손맛 측정 (10/22 — docs/strike/italian_risoluto_2026-10-22.md). 판정 · 실행은 게임 함수 그대로(읽기만).
//  운전(노리는 사람 흉내): 칼끝 쪽 절반이 보이면 내 칼 손 쪽 절반을 그 위로 옮긴다(손 빠르기 V 패드 m/s — 휘두르기 문턱 SKILL.swingSpeed 1.5 아래, 칼 위로 3 cm 를 노림) ·
//   스틱 앞으로 걸어 들어감(맞붙는 거리 clinch 에서 멈춤) · 창(금색 '!')이 열리면 REACT 초 뒤 탭 하나(main.js 와 같은 차례: 프레임 머리 fire → skill.secret) · 그 밖엔 치지 않음.
//  상대 = 인물 AI(시트 숙련도 · 성격). 막기 단추 없음.
//  실행: node tools/sim/risoluto_play.mjs [T 0.6] [두 번째 길 0|1] [씨앗 3] [초 30] [무기 rapier,dartagnan] [인물 isolde,tome,omari,minami,liao] [V 0.6] [REACT 0.25]
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch, bladesTouch } from '../../src/secret.js';
import * as THREE from 'three';

const [Targ = '0.6', beatArg = '0', seedsArg = '3', simArg = '30', wArg = 'rapier,dartagnan', fArg = 'isolde,tome,omari,minami,liao', vArg = '0.6', rArg = '0.25'] = process.argv.slice(2);
CONFIG.SECRET.risolutoHold = +Targ;
CONFIG.SECRET.risolutoBeat = +beatArg ? 1 : 0;
if (process.env.RISO_COVER) CONFIG.SECRET.risolutoCover = +process.env.RISO_COVER;
// 대조 RISO_PLAIN=1: 같은 때의 보통 탭 찌르기 — 상대 팔 늦춤 끔(FLOW_RECOVERY.seconds 0) · 비기 배율 1 (AI 비기는 닫혀 있어 사람 쪽만 바뀜)
const PLAIN = process.env.RISO_PLAIN === '1';
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
const rows = [];
for (const w of weapons) for (const id of foes) {
  const C = CHARACTERS_BY_ID[id];
  const R = { w, id, rounds: 0, t: 0, runs: [], hold: 0, beat: 0, fired: 0, landed: 0, blocked: 0, armSlow: 0, dealt: 0, dealtN: 0, taken: 0, pDead: 0, fDead: 0, ends: { foeSwing: 0, uncover: 0, meSwing: 0, stick: 0, gap: 0 }, missed: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    const G = newRound({ weapon: w, weapon2: C.weapon, seed, difficulty: C.ai.level, persona: C.ai.persona, revive: C.revive, walls: true });
    const p = G.player, e = G.enemy;
    p.skill.level = 0.7; p.skill.autoGuard = true; p.canShove = true;
    const pg = new PlayerParryGuard(p, e); p.stamina.controller = pg;
    const ps = new PlayerSecretWatch(p, e);
    if (ps.S?.when !== 'risoluto') throw new Error(`${w}: 리솔루토가 아님 (${ps.S?.name})`);
    let tgt = [0.1, 0.05], due = null, seenOpen = 0, run = null;
    G.onWound = (att, vic, r) => {
      if (vic === p) R.taken += r.severity ?? 0;
      if (att === p && p.skill.sec?.risoluto) { R.dealt += r.severity ?? 0; R.dealtN++; if (run) run.wound = true; }
    };
    G.before = (t) => {
      // ① 입력 (프레임 머리 — main.js 와 같은 차례): 창이 열린 뒤 REACT 초에 탭 하나
      if (ps.opened !== seenOpen) { seenOpen = ps.opened; if (ps.open) due = t + REACT; }
      if (due != null && t >= due) {
        due = null;
        if (ps.open && !p.skill.secretPhase && p.alive) {
          const o = ps.fire();
          if (o && p.skill.secret(o)) { R.fired++; run = { touch: false, wound: false }; } else R.missed++;
        } else R.missed++;
      }
      ps.update(DT, !!p.skill.sec);
      pg.step(DT);
      // ② 손: 비기 실행 · 굳음 동안은 손을 대지 않음 (main.js 가 칼 입력을 막음)
      if (!p.skill.sec && p.armed && e.armed) {
        p.bladePoint(0, a0); p.bladePoint(0.5, a1); e.bladePoint(0.5, b0); e.bladePoint(1, b1);
        closest(a0, a1, b0, b1);
        const dv = pb.clone().sub(pa).applyQuaternion(p.yaw.clone().invert()); // 몸 틀: x 앞 · y 위 · z 칼 든 쪽
        if (p.foeDistance() < 3) tgt = [Math.max(-0.5, Math.min(0.5, tgt[0] + dv.z * 4 * DT)), Math.max(-0.3, Math.min(0.45, tgt[1] + (dv.y + 0.03) * 4 * DT))];
        const off = p.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, dd = Math.hypot(dx, dy), st = V * DT;
        if (dd > st) { off.x += (dx / dd) * st; off.y += (dy / dd) * st; } else off.set(tgt[0], tgt[1]);
        p.inputActive = dd > 1e-4;
      } else p.inputActive = false;
      p.handHeld = !p.skill.sec;
      // ③ 발: 앞으로 (맞붙는 거리에서 멈춤) · 굳음 동안 스틱이 안 들음
      const fwd = p.skill.secretPhase !== 'stiff' && p.foeDistance() > p.swordArt.measure.clinch ? 1 : 0;
      p.move.set(0, fwd); p.stickX = 0; p.stickY = fwd;
      // 막힘: 리솔루토 찌르기 동안 칼끼리 닿고 상처를 못 냄
      if (run && p.skill.sec?.risoluto && bladesTouch(p, e)) run.touch = true;
      if (run && !p.skill.sec) { if (run.touch && !run.wound) R.blocked++; run = null; }
    };
    for (let i = 0; i < SIM / DT; i++) {
      G.step();
      if (!p.alive || !e.alive) break;
    }
    R.rounds++; R.t += G.t;
    if (!p.alive) R.pDead++;
    if (!e.alive) R.fDead++;
    const W = ps.riso;
    R.runs.push(...W.runs);
    R.hold += W.opens.hold; R.beat += W.opens.beat;
    for (const k of Object.keys(R.ends)) R.ends[k] += W.ends[k];
    const st = p.skill.secretStats.andareRisoluto ?? { landed: 0, armSlow: 0 };
    R.landed += st.landed; R.armSlow += st.armSlow ?? 0;
    G.world.free();
  }
  rows.push(R);
}
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
console.log(`${PLAIN ? '[대조: 팔 늦춤 · 비기 배율 끔] ' : ''}T ${CONFIG.SECRET.risolutoHold} s · 두 번째 길 ${CONFIG.SECRET.risolutoBeat ? '켬' : '끔'} · 덮음 ${CONFIG.SECRET.risolutoCover} m · 씨앗 ${SEEDS} × ${SIM} s · 손 ${V} · 탭 반응 ${REACT} s`);
console.log('| 무기 | 상대 | 판 | 덮인 채 나아가기 ≥0.2 s (판당) | 길이 p50 · max | 창 이어짐 · 상대 박자 | 탭 | 맞힘 | 막힘 | 팔 늦춤 | 준 상처 심각도 | 입은 심각도 | 내 죽음 · 상대 죽음 | 끝난 까닭 (상대 휘두름 · 덮음 풀림 · 가슴 사이 · 스틱 · 내 휘두름) |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const T = { rounds: 0, runs: [], hold: 0, beat: 0, fired: 0, landed: 0, blocked: 0, armSlow: 0, dealt: 0, taken: 0, pDead: 0, fDead: 0 };
for (const R of rows) {
  const big = R.runs.filter((x) => x >= 0.2);
  console.log(`| ${R.w} | ${CHARACTERS_BY_ID[R.id].name} | ${R.rounds} | ${big.length} (${f1(big.length / R.rounds)}) | ${f2(q(big, 0.5))} · ${f2(q(big, 1))} | ${R.hold} · ${R.beat} | ${R.fired} | ${R.landed} | ${R.blocked} | ${R.armSlow} | ${f1(R.dealt)} | ${f1(R.taken)} | ${R.pDead} · ${R.fDead} | ${R.ends.foeSwing} · ${R.ends.uncover} · ${R.ends.gap} · ${R.ends.stick} · ${R.ends.meSwing} |`);
  T.rounds += R.rounds; T.runs.push(...big); for (const k of ['hold', 'beat', 'fired', 'landed', 'blocked', 'armSlow', 'dealt', 'taken', 'pDead', 'fDead']) T[k] += R[k];
}
console.log(`| 합 | | ${T.rounds} | ${T.runs.length} (${f1(T.runs.length / T.rounds)}) | ${f2(q(T.runs, 0.5))} · ${f2(q(T.runs, 1))} | ${T.hold} · ${T.beat} (판당 ${f2((T.hold + T.beat) / T.rounds)}) | ${T.fired} | ${T.landed} | ${T.blocked} | ${T.armSlow} | ${f1(T.dealt)} | ${f1(T.taken)} | ${T.pDead} · ${T.fDead} | |`);
const all = rows.flatMap((R) => R.runs);
console.log(`덮인 채 나아가기 길이 (모든 판 · 0 초 넘는 것 ${all.length}): p50 ${f2(q(all, 0.5))} · p90 ${f2(q(all, 0.9))} · ≥0.6 ${all.filter((x) => x >= 0.6).length} · ≥1.5 ${all.filter((x) => x >= 1.5).length}`);
