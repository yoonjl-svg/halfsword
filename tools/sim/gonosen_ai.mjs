// 일본 고노센 — AI 쪽 들어옴 사건(SECRET.gnsEnterAI — 기본 끔) 효과 재기 (10/25 — docs/strike/school_secret_2026-10-09.md §16). 판정 · 실행은 게임 함수 그대로(읽기만).
//  일본 AI(숙련도 5 — 시트 그대로) 대 ① 인물 AI(AI 끼리) ② 걸어 들어오는 사람 봇(스틱 앞으로 걸어 내 칼끝 거리에 들면 0.6 s 마다 톡 찌르기 — 고노센을 모르는 사람 흉내).
//  실행: node tools/sim/gonosen_ai.mjs [씨앗 4] [초 30] [일본 인물 minami,white_scale] [상대 isolde,artoria,ratna,tome,roland,chanda,walker:longsword,walker:rapier] [걷기 스틱 0.5]
//  스위치: GNS_AI=0|1 AI 들어옴 사건 · GNS_LONG=0|1 긴 칼 상대 규칙(AI 들어옴과 함께) · GNS_WARY=0|1 AI 고노센 경계(상대 AI 가 일본 AI 를 보고 — 10/25 08:0x ⑤) · GNS_BLOCK=1 여쭘 B · GNS_OPEN=1 여쭘 C
//   (10/25 08:0x 부터 기본 = AI 들어옴 · 긴 칼 · 경계 모두 켬 — 끄면 01:3x 판)
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const [seedsArg = '4', simArg = '30', jArg = 'minami,white_scale', fArg = 'isolde,artoria,ratna,tome,roland,chanda,walker:longsword,walker:rapier', goArg = '0.5'] = process.argv.slice(2);
const E = process.env;
if (E.GNS_AI != null) CONFIG.SECRET.gnsEnterAI = +E.GNS_AI ? 1 : 0;
if (E.GNS_LONG != null) CONFIG.SECRET.gnsLong = +E.GNS_LONG ? 1 : 0;
if (E.GNS_WARY != null) CONFIG.SECRET.gnsWary = +E.GNS_WARY ? 1 : 0;
if (E.GNS_BLOCK != null) CONFIG.SECRET.gnsEnterBlock = +E.GNS_BLOCK ? 1 : 0;
if (E.GNS_OPEN != null) CONFIG.SECRET.gnsEnterOpen = +E.GNS_OPEN ? 1 : 0;
const SEEDS = +seedsArg, SIM = +simArg, GO = +goArg;
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-'), f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const rows = [];
for (const jid of jArg.split(',')) for (const fid of fArg.split(',')) {
  const J = CHARACTERS_BY_ID[jid];
  const walker = fid.startsWith('walker:');
  const F = walker ? null : CHARACTERS_BY_ID[fid];
  const fw = walker ? fid.slice(7) : F.weapon;
  const R = { jid, fid, fw, rounds: 0, t: 0, fired: 0, landed: 0, jWin: 0, fWin: 0, jDealt: 0, fDealt: 0, kill: 0 };
  for (let seed = 1; seed <= SEEDS; seed++) {
    // 자리: 사람 자리(player) = 상대 · AI 자리(enemy) = 일본 인물
    const G = newRound({ weapon: fw, weapon2: J.weapon, seed, difficulty: J.ai.level, persona: J.ai.persona, revive: J.revive, walls: true, ...(walker ? {} : { AI2Class: AI, persona2: F.ai.persona, difficulty2: F.ai.level, revive2: F.revive }) });
    const p = G.player, e = G.enemy;
    if (!G.ai.secret || G.ai.secret.name !== 'goNoSen') throw new Error(`${jid}: AI 고노센 없음`);
    let nextTap = 0;
    if (walker) {
      p.skill.autoGuard = true;
      G.before = (t) => {
        const reach = p.swordArt.measure.reach;
        const d = p.foeDistance();
        p.move.set(0, d > reach ? GO : 0); p.stickX = 0; p.stickY = d > reach ? GO : 0;
        p.inputActive = false; p.handHeld = false;
        if (d <= reach + 0.1 && t >= nextTap && p.state === 'stand' && p.alive && e.alive) { p.skill.thrust(); nextTap = t + 0.6; }
      };
    }
    G.onWound = (att, vic, r) => {
      const sev = r.severity ?? 0;
      if (att === e) R.jDealt += sev;
      if (att === p) R.fDealt += sev;
    };
    let i = 0;
    for (; i < SIM / DT; i++) {
      const pa = p.alive;
      G.step();
      if (pa && !p.alive && G.ai.secretRun) R.kill++; // 고노센 실행 · 굳음 동안 상대가 죽음
      if (!p.alive || !e.alive) break;
    }
    R.t += i * DT;
    R.rounds++;
    if (!p.alive && e.alive) R.jWin++;
    if (!e.alive && p.alive) R.fWin++;
    const st = G.ai.stats.secrets?.goNoSen ?? { fired: 0, landed: 0 };
    R.fired += st.fired; R.landed += st.landed;
    G.world.free();
  }
  rows.push(R);
}
const S = CONFIG.SECRET;
console.log(`[AI 고노센] AI 들어옴 ${S.gnsEnterAI ? '켬' : '끔'} · 긴 칼 상대 규칙 ${S.gnsLong ? '켬' : '끔'} · 상대 AI 경계 ${S.gnsWary ? '켬' : '끔'} · B 막힘 ${S.gnsEnterBlock ? '켬' : '끔'} · C 칼끝 ${S.gnsEnterOpen ? '켬' : '끔'} · 씨앗 ${SEEDS} × ${SIM} s · 걷는 봇 스틱 ${GO}`);
console.log('| 일본 AI | 상대 | 판 | 고노센 낸 · 맞힘 | 30 s 당 낸 | 고노센 동안 상대 죽음 | 일본 이김 · 상대 이김 | 준 · 입은 심각도 (일본) |');
console.log('|---|---|---|---|---|---|---|---|');
const T = { rounds: 0, t: 0, fired: 0, landed: 0, jWin: 0, fWin: 0, jDealt: 0, fDealt: 0, kill: 0 };
for (const R of rows) {
  const who = R.fid.startsWith('walker:') ? `걷는 봇 (${R.fw})` : `${CHARACTERS_BY_ID[R.fid].name} (${R.fw})`;
  console.log(`| ${CHARACTERS_BY_ID[R.jid].name} | ${who} | ${R.rounds} | ${R.fired} · ${R.landed} | ${f2((30 * R.fired) / R.t)} | ${R.kill} | ${R.jWin} · ${R.fWin} | ${f1(R.jDealt)} · ${f1(R.fDealt)} |`);
  for (const k of Object.keys(T)) T[k] += R[k];
}
console.log(`| 합 | | ${T.rounds} | ${T.fired} · ${T.landed} | ${f2((30 * T.fired) / T.t)} | ${T.kill} | ${T.jWin} · ${T.fWin} | ${f1(T.jDealt)} · ${f1(T.fDealt)} |`);
