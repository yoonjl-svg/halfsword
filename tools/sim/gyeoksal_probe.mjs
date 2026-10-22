// 동방 막아 죽이기 (격살 · 10/22) 사람 손맛 — 보고 막고, 창이 열리면 친다 (docs/strike/chinese_gyeoksal_2026-10-22.md §5). 읽기만 (판정 · 실행은 게임 함수 그대로).
//  parry_assist_probe.mjs 꼴: 플레이어 = 동방 칼 · 막기 단추(PlayerParryGuard) · 비기 창(PlayerSecretWatch — 격살) · 상대 = 인물 AI(FOE) 또는 롱소드 AI 보통.
//  사람 대본 (main.js 와 같은 차례 — 입력 → playerSecret.update → 미리 받은 입력 → playerGuard.step):
//   ① 보고 누르기: AI 공격 시작(준비 포함) + REACT(0.25) s 에 막기 단추를 누르고, 그 공격이 끝나고 0.3 s 뒤 뗀다 (parry_assist_probe REACT 와 같음)
//   ② 앞으로: 단추를 누르는 동안 스틱 앞(stickY 1 — 걸어 든다) · 떼면 APPROACH(맞닿기 + 0.2 m 밖이면 앞)
//   ③ 치기: 칼이 닿고 격살 기다림(pend)이 걸리면 그로부터 HIT(0.25) s 뒤 공격 입력 하나 — 창이 열렸으면 곧장 격살, 칼이 아직 붙어 있으면 미리 받기(떨어지는 순간 나감), 창이 닫혔으면 놓침
//  센 것: 판당 창 · 자세별(거정 · 어거 · 요략 · 봉두 — 줄로 정함 / 손에서 가까운 자리로 정함) · 거절 까닭(누르지 않음 · 때 늦음 · 스틱 · 느린 칼 · 다침 · 자세 없음) ·
//   격살 낸 수 · 맞힘 · 맞은 곳 · 겨눈 곳 맞힘 · 절단 · 깊은 출혈(상처 하나 심각도 ≥ 1.0 — 절단 문턱과 같은 '살 문턱 위 90 J' · 재는 이름) · 참수 · 상대 죽음 · 갑옷 · 문턱에 막혀 멍 · 칼에 막힘 · 플레이어 죽음
//  node tools/sim/gyeoksal_probe.mjs [무기들 qinggang,hwando] [상대 인물 id 들 — '-' = 롱소드 AI] [씨앗 1,2,3] [초 45]   ·   REACT= · HIT= · POW=(판정 배율) · SHARE=(칼끝 빠르기 몫) · ARM=down · CSV=1(격살마다 한 줄)
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { PlayerParryGuard } from '../../src/parry_button.js';
import { PlayerSecretWatch } from '../../src/secret.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';

const weapons = (process.argv[2] || 'qinggang').split(',');
const foes = (process.argv[3] || '-').split(',');
const SEEDS = (process.argv[4] || '1,2,3').split(',').map(Number);
const SIM = +(process.argv[5] || 45);
const REACT = +(process.env.REACT ?? 0.25);
const HIT = +(process.env.HIT ?? 0.25);
if (process.env.POW === 'hit' || +process.env.POW > 0) CONFIG.SECRET.gyeoksal.power = process.env.POW === 'hit' ? 'hit' : +process.env.POW; // 판정 배율 시험 (기본 'finish' = FINISH.power · 'hit' = 다른 비기와 같은 hitMul 1.3)
if (+process.env.SHARE > 0) CONFIG.SECRET.gyeoksal.share = +process.env.SHARE; // 시험: 격살 칼끝 빠르기 몫 (기본 cnFastShare)
if (process.env.ARM) CONFIG.SECRET.gyeoksal.armPath = process.env.ARM; // 시험: 어거 길 'down'
const WANT = { geojeong: ['head'], eogeo: ['uarmS', 'farmS', 'uarmO', 'farmO'], yoryak: ['thighF', 'shinF', 'thighB', 'shinB', 'footF', 'footB'], bongdu: ['chest'] };
const SKO = { geojeong: '거정', eogeo: '어거', yoryak: '요략', bongdu: '봉두' };

const rows = [];
for (const wid of weapons) {
  for (const fid of foes) {
    const FOE = fid === '-' ? null : CHARACTERS_BY_ID[fid];
    const T = { bySt: {}, rounds: 0, simT: 0, open: 0, st: {}, by: { line: 0, pad: 0 }, rej: {}, edges: 0, pend: 0, cutDuring: 0, fired: 0, hit: 0, aimHit: 0, blocked: 0, armor: 0, sever: 0, deep: 0, decap: 0, kill: 0, parts: {}, miss: 0, buffered: 0, pDead: 0, pWounds: 0, fWounds: 0 };
    for (const seed of SEEDS) {
      const G = newRound(FOE ? { weapon: wid, weapon2: FOE.weapon, seed, difficulty: FOE.ai.level, persona: FOE.ai.persona, look2: FOE.look } : { weapon: wid, weapon2: 'longsword', seed });
      const P = G.player;
      const E = G.enemy;
      P.skill.corr = CONFIG.SKILL.corr;
      P.skill.corrTip = CONFIG.SKILL.corrTip;
      P.skill.autoGuard = true;
      P.canShove = true;
      const guard = new PlayerParryGuard(P, E);
      const watch = new PlayerSecretWatch(P, E);
      if (watch.S?.name !== 'gyeoksal') throw new Error(`${wid}: 격살이 아님 (${watch.S?.name})`);
      const contactD = P.swordArt.measure?.contact ?? 1.2;
      const ai = G.ai;
      let cur = null; // 지금 AI 공격 { t0 }
      let releaseAt = -1;
      let pendSeen = null;
      let due = null;
      let run = null; // 지금 낸 격살 { t, w0, det, decap, alive, stance, res0 }
      const fire = (o) => {
        if (!o || !P.skill.secret(o)) return false;
        T.fired++;
        run = { t: G.t, w0: E.wounds.length, det: new Set(E.detachedParts ?? []), decap: !!E.decapitated, alive: E.alive && E.state !== 'dead', stance: o.ctx?.stance, res0: P.instantResult };
        return true;
      };
      const done = () => {
        const res = P.instantResult;
        const nw = E.wounds.slice(run.w0);
        const sever = [...(E.detachedParts ?? [])].filter((p) => !run.det.has(p));
        const part = res?.hit ? res.part : res?.blocked ? '칼에 막힘' : '헛침';
        const B = (T.bySt[run.stance] ??= { n: 0, hit: 0, aim: 0, sever: 0, deep: 0, kill: 0 });
        B.n++;
        if (res?.hit) B.hit++;
        if (res?.hit && WANT[run.stance]?.includes(res.part)) B.aim++;
        if (sever.length) B.sever++;
        if (nw.some((w) => w.severity >= 1.0)) B.deep++;
        if (run.alive && (!E.alive || E.state === 'dead')) B.kill++;
        T.parts[part] = (T.parts[part] ?? 0) + 1;
        if (res?.hit) T.hit++;
        if (res?.blocked) T.blocked++;
        if (res?.hit && WANT[run.stance]?.includes(res.part)) T.aimHit++;
        if (res?.hit && !nw.length) T.armor++;
        if (sever.length) T.sever++;
        if (nw.some((w) => w.severity >= 1.0)) T.deep++;
        if (E.decapitated && !run.decap) T.decap++;
        if (run.alive && (!E.alive || E.state === 'dead')) T.kill++;
        if (process.env.CSV) console.log(['row', wid, fid, seed, run.t.toFixed(2), run.stance, part, res?.zone ?? '-', res?.type ?? '-', (res?.sev ?? 0).toFixed(2), sever.join('+') || '-', E.decapitated && !run.decap ? 'decap' : '-', E.causeOfDeath ?? '-'].join(','));
        run = null;
      };
      G.before = () => {
        // ③ 치기 (프레임 머리 — main.js 입력 차례)
        if (due != null && G.t >= due && P.alive) {
          due = null;
          if (watch.open && !P.skill.sec) fire(watch.fire());
          else if (watch.canBuffer()) (watch.buffer([0, 0]), T.buffered++);
          else T.miss++;
        }
        // ① 보고 누르기
        guard.held = (!!cur && G.t - cur.t0 >= REACT) || G.t < releaseAt;
        // ② 앞으로 (누르는 동안 스틱 앞 — 떼면 맞닿기 + 0.2 m 까지 걸어 듦)
        const fwd = guard.held || (P.alive && P.foeDistance() > contactD + 0.2) ? 1 : 0;
        P.stickX = 0;
        P.stickY = fwd;
        P.move.set(0, fwd);
        watch.update(DT, !!P.skill.sec);
        if (watch.queued && !P.skill.sec && P.alive) fire(watch.fire());
        guard.step(DT);
        P.inputActive = guard.active;
        P.handHeld = guard.active;
        const pd = watch.pc?.pend;
        if (pd && pd !== pendSeen) (pendSeen = pd), (due = G.t + HIT);
        if (run && P.instantResult !== run.res0 && !P.skill.sec) done();
        if (ai.mode === 'attack' && !cur) cur = { t0: G.t };
      };
      const as0 = ai.afterStrike.bind(ai);
      ai.afterStrike = (d) => {
        if (cur) (cur = null), (releaseAt = G.t + 0.3);
        return as0(d);
      };
      while (G.t < SIM && P.alive && E.alive && E.state !== 'dead') G.step();
      const tEnd = G.t;
      while (run && P.skill.sec && G.t < tEnd + 2) G.step(); // 판이 격살 도중 끝났으면(상대가 죽음) 그 칼의 결과까지 (맞힘 · 맞은 곳을 셈)
      if (run) done();
      const K = watch.pc?.gk ?? {};
      T.rounds++;
      T.simT += tEnd;
      T.open += K.open ?? 0;
      T.edges += K.edges ?? 0;
      T.pend += K.pend ?? 0;
      T.cutDuring += K.cut ?? 0;
      for (const [k, v] of Object.entries(K.stance ?? {})) T.st[k] = (T.st[k] ?? 0) + v;
      for (const k of ['line', 'pad']) T.by[k] += K.by?.[k] ?? 0;
      for (const k of ['busy', 'atk', 'noPress', 'late', 'notFwd', 'slow', 'hurt', 'noStance']) T.rej[k] = (T.rej[k] ?? 0) + (K[k] ?? 0);
      if (!P.alive) T.pDead++;
      T.pWounds += P.wounds.filter((w) => w.severity > 0).length;
      T.fWounds += E.wounds.filter((w) => w.severity > 0).length;
    }
    rows.push({ wid, fid, T });
  }
}
const per = (x, n) => (x / Math.max(1, n)).toFixed(2);
{
  // 모든 상대를 합친 줄 (무기마다)
  for (const wid of weapons) {
    const A = { bySt: {}, rounds: 0, simT: 0, open: 0, st: {}, by: { line: 0, pad: 0 }, rej: {}, edges: 0, pend: 0, cutDuring: 0, fired: 0, hit: 0, aimHit: 0, blocked: 0, armor: 0, sever: 0, deep: 0, decap: 0, kill: 0, parts: {}, miss: 0, buffered: 0, pDead: 0, pWounds: 0, fWounds: 0 };
    for (const r of rows.filter((x) => x.wid === wid)) {
      for (const [k, v] of Object.entries(r.T)) {
        if (typeof v === 'number') A[k] += v;
        else if (k === 'bySt') for (const [s2, o] of Object.entries(v)) { const b = (A.bySt[s2] ??= { n: 0, hit: 0, aim: 0, sever: 0, deep: 0, kill: 0 }); for (const q in o) b[q] += o[q]; }
        else for (const [q, n] of Object.entries(v)) A[k][q] = (A[k][q] ?? 0) + n;
      }
    }
    rows.push({ wid, fid: '합', T: A });
  }
}
console.log(`격살 사람 손맛 (판정 배율 ${CONFIG.SECRET.gyeoksal.power} · 빠르기 몫 ${CONFIG.SECRET.gyeoksal.share ?? CONFIG.SECRET.cnFastShare} · 어거 길 ${CONFIG.SECRET.gyeoksal.armPath}) — 보고 누름 +${REACT}s · 누르는 동안 스틱 앞 · 기다림 + ${HIT}s 에 침 · 씨앗 ${SEEDS.join(',')} × ${SIM} s`);
for (const { wid, fid, T } of rows) {
  const st = Object.entries(T.st).map(([k, v]) => `${SKO[k] ?? k} ${v}`).join(' · ');
  const bs = Object.entries(T.bySt).map(([k, b]) => `${SKO[k] ?? k} ${b.hit}/${b.n}(겨눈 곳 ${b.aim} · 절단 ${b.sever} · 깊은 출혈 ${b.deep} · 죽임 ${b.kill})`).join(' · ');
  const R = T.rej;
  console.log(
    `${wid.padEnd(8)} 대 ${(fid === '-' ? '롱소드 AI' : fid === '합' ? '모두 합' : fid).padEnd(10)} | ${T.rounds} 판 ${T.simT.toFixed(0)} s | 칼 닿음 ${T.edges} → 거절 (누름 없음 ${R.noPress} · 때 늦음 ${R.late} · 스틱 ${R.notFwd} · 느린 칼 ${R.slow} · 다침 ${R.hurt} · 자세 없음 ${R.noStance} · 내 공격 ${R.atk} · 격살 도중 ${R.busy}) · 기다림 ${T.pend}(줄 ${T.by.line} · 손 자리 ${T.by.pad}) · 그사이 베임 ${T.cutDuring}` +
      ` | 창 ${T.open} = 판당 ${per(T.open, T.rounds)} (${st}) | 격살 ${T.fired} = 판당 ${per(T.fired, T.rounds)} · 미리 받음 ${T.buffered} · 놓침 ${T.miss} | 맞힘 ${T.hit} (겨눈 곳 ${T.aimHit}) · 칼에 막힘 ${T.blocked} · 갑옷·문턱에 막혀 멍 ${T.armor} | 절단 ${T.sever} · 깊은 출혈 ${T.deep} · 참수 ${T.decap} · 죽임 ${T.kill} | 자세별 맞힘 ${bs} | 맞은 곳 ${JSON.stringify(T.parts)} | 내 죽음 ${T.pDead} · 내 상처 ${T.pWounds} · 상대 상처 ${T.fWounds}`,
  );
}
