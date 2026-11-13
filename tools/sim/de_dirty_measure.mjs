// ─────────────────────────────────────────────────────────────
//  de_dirty_measure.mjs — 독일 더티복싱 · 붙은 거리 규칙 재기 (11/14 — 기록 docs/strike/de_dirty_2026-11-14.md)
//   school_balance.mjs 손가락 봇 판(fightOne — 사람 몸 0 번 · 상대 숙련 3 AI)에 재기 꽂개(probe)를 꽂아 판마다 셈만 더한다(읽기만 — 난수 · 몸 그대로).
//   판(variant): 아래 VARIANTS 의 --set 묶음 (게임 값은 이 프로세스 안에서만)
//   판마다: 파고들기(낸 수 · 박찬 앞 걸음 · 들어가다 0.6 s 안 맞음) · 밀치기(낸 수 · 묶임 수 · 몸에 듦 · 1 s 안 상대 넘어짐 · 막힌 까닭 시간) ·
//    손잡이 찍기(낸 수 · 맞음 · 의식 · 1 s 안 넘어짐) · 모르트슐라크(낸 수 · 머리 · 겹치기→모르트슐라크 이음 2.0 s 안) · 붙은 거리 시간 몫(가슴 사이 ≤ 0.8 · ≤ 1.0) ·
//    묶임(시간 · 갇힘 — 스틱 놓음 · 떨어짐 · 공격 입력이 먹지 않은 시간) · 기력(붙어 버티기 · 박찬 걸음) · 판 결과
//  node tools/sim/de_dirty_measure.mjs run --variant=③ [--cells=…] [--seeds=1-24] [--json=파일]
//  node tools/sim/de_dirty_measure.mjs agg <json …>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { fightOne } from './school_balance.mjs';
import { CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k;
export const CELLS = ['german:longsword:longsword', 'german:sabre:longsword', 'german:sabre:sabre', 'german:longsword:rapier', 'german:longsword:uchigatana'];
const OFF_CLOSE = 'CLOSE.startD=null,CLOSE.holdMin=0,CLOSE.nearHilt=0,CLOSE.holdLock=0,CLOSE.holdDrain=1,CLOSE.holdCool=0';
const B = `DE_DIRTY.armSlow=${CONFIG.DE_DIRTY_ON.armSlow},DE_DIRTY.clinchK=${CONFIG.DE_DIRTY_ON.clinchK}`;
const C = `DE_DIRTY.door=${CONFIG.DE_DIRTY_ON.door},DE_DIRTY.mordIndes=${CONFIG.DE_DIRTY_ON.mordIndes}`;
const OLD3 = 'DE_DIRTY.ring=0,UNIQUE_ASSIST.dupBandMin=0.8';
/** 판: ① 지금 main(파고들기 · 붙은 거리 규칙 · B · C 모두 끔) ② 파고들기만 ③ + 붙은 거리 규칙(사장님 11/14 — 기본) ④ + B ⑤ + C ⑥ 모두 · ⓪ 옛 봇 · ③A AI 도 같은 규칙 · n = 묶임 시간 견줌 (③ 위) */
export const VARIANTS = {
  '①': `GAIT.deDig=0,${OFF_CLOSE},DE_DIRTY.ring=0`,
  '②': `GAIT.deDig=1,${OFF_CLOSE},DE_DIRTY.ring=0`,
  '③': OLD3, // 11/14 첫 재기 판(칼 씨름 · 겹치기 띠 1.0 m 전) — 그때 ③ 그대로 다시 낼 수 있게
  '④': `${OLD3},${B}`,
  '⑤': `${OLD3},${C}`,
  '⑥': `${OLD3},${B},${C}`,
  '⑦': `DE_DIRTY.ringT=${CONFIG.realS(0.6)},DE_DIRTY.ringNoRecover=0,UNIQUE_ASSIST.dupAuto=bind`, // 중간 판 (③ + 칼 씨름 0.6 s + 겹치기 띠 1.0 m · 'bind') — 11/14 결정 사이
  '⑧': '', // 지금 가지 기본 (③ + 칼 씨름 1.2 s · 기력 회복 막힘 2.0 s + 겹치기 자동 ⓒ 'both' · 띠 아래 끝 1.0 m)
  '⑧bind': 'UNIQUE_ASSIST.dupAuto=bind', // ⑧ 에서 겹치기 자동만 옛 'bind' (ⓐ 견줌)
  '⑦링끔': 'DE_DIRTY.ring=0', // ⑦ 에서 칼 씨름만 끔
  'dB': `UNIQUE_ASSIST.dupStackGap=${CONFIG.realS(0.4)}`, // 겹치기 자동 끊김 너그러움 0.2 → 0.4 s (⑦ 위)
  'dC': 'UNIQUE_ASSIST.dupAuto=both', // 'bind' 또는 'clash2' 가운데 먼저 찬 쪽
  'dD': `UNIQUE_ASSIST.dupAuto=both,UNIQUE_ASSIST.dupStackGap=${CONFIG.realS(0.4)}`,
  '⓪': `GAIT.deDig=0,${OFF_CLOSE},DE_DIRTY.ring=0`, // ① 과 같은 값 — 옛 독일 봇(SB_DE_BOT=0 으로 돌림 · 11/04 재기와 같은 손)
  '③A': `${OLD3},CLOSE.startAI=1`, // ③ + AI 도 같은 붙은 거리 규칙 (견줌 스위치 — 시작 1.0 m · 묶임 · 맞밀기 · 기력 × 2 · 쿨타임 · 묶인 동안 공격 안 함 · 1 m 안 손잡이 찍기)
  'n0.6': `${OLD3},CLOSE.holdMin=${CONFIG.realS(0.6)}`,
  'n1.5': `${OLD3},CLOSE.holdMin=${CONFIG.realS(1.5)}`,
  'n2.0': `${OLD3},CLOSE.holdMin=${CONFIG.realS(2.0)}`,
  'cool0': `${OLD3},CLOSE.holdCool=0`,
};
function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'null' ? null : v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });

/** 재기 꽂개 (fightOne probe) */
function makeProbe() {
  let G, P, A;
  const S = { T: 0, near08: 0, near10: 0, digs: [], shoves: [], pommels: [], block: { req: 0, swing: 0, tap: 0, state: 0, foe: 0, cool: 0, other: 0 }, pushT: 0, recvAfterDig: 0, digHit: 0, foeFallAfterShove: 0, pommelHit: 0, pommelCons: 0, pommelFall: 0, mordHead: 0 };
  let digN = 0, shoveN = 0, pomN = 0, aStand = true, consA = 1, uq = null, seg = null;
  const segs = [];
  return {
    init(o) {
      ({ G, P, A, uq } = o);
      consA = A.consciousness;
      const pw = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, point, pr, ...rest) => {
        const dc = Math.max(0, consA - vic.consciousness);
        pw?.(att, vic, r, point, pr, ...rest);
        const t = G.t / K;
        if (att === A && vic === P) for (const d of S.digs) if (t - d.t <= 0.6 && !d.hit) (d.hit = true), S.recvAfterDig++;
        if (att === P && vic === A) {
          if (P.skill.pom) { const p = S.pommels.at(-1); if (p && !p.hit) (p.hit = true), S.pommelHit++; if (p) p.cons += dc; S.pommelCons += dc; }
          if (P.skill.sec?.mord && pr?.v?.part === 'head' && (dc > 0 || (r.energy ?? 0) > 10)) S.mordHead++; // 모르트슐라크가 머리에 듦 (의식이 깎였거나 판정 에너지 10 J 넘음 — combat.js 상처 길과 같은 문턱)
        }
      };
    },
    step() {
      const t = G.t / K;
      const dtR = CONFIG.PHYSICS.timestep / K;
      if (!P.alive || !A.alive) return;
      S.T += dtR;
      const d = P.foeDistance();
      const both = P.state === 'stand' && A.state === 'stand';
      if (both && d <= 0.8) S.near08 += dtR; // 붙은 거리 시간 (둘 다 서 있을 때만 — 넘어진 상대 곁은 빼고)
      if (both && d <= 1.0) S.near10 += dtR;
      // 칼끼리 닿음 한 덩이 (겹치기 자동이 보는 bladeTouch — 길이 · 띠 안 몫 · 그 덩이에 겹치기가 났나)
      const touch = !!uq?.bladeTouch?.();
      const lo = CONFIG.UNIQUE_ASSIST.dupBandMin ?? (CONFIG.CLOSE.nearHilt && CONFIG.CLOSE.startD > 0 ? CONFIG.CLOSE.startD : CONFIG.SECRET.mordCloseN);
      const inBand = d > lo && d <= CONFIG.UNIQUE_ASSIST.dupBandMax;
      if (touch) {
        if (!seg) seg = { t0: t, dur: 0, band: 0, dup: false, swing: 0 };
        seg.dur += dtR;
        if (inBand) seg.band += dtR;
        if (P.skill.inputSwinging) seg.swing += dtR;
        if (P.iai?.tech === 'duplieren') seg.dup = true;
      } else if (seg) {
        segs.push(seg);
        seg = null;
      }
      const g = P.gait;
      if (g && g.digs > digN) { digN = g.digs; S.digs.push({ t, d0: r3(d), hit: false }); }
      if (P.shoves > shoveN) { shoveN = P.shoves; S.shoves.push({ t, d0: r3(d), held: !!P.barge?.hold, fall: false }); }
      if (P.skill.pommels > pomN) { pomN = P.skill.pommels; S.pommels.push({ t, d0: r3(d), hit: false, cons: 0, fall: false }); }
      consA = A.consciousness;
      const up = A.state === 'stand';
      if (aStand && !up) {
        for (const s of S.shoves) if (t - s.t <= 1 && !s.fall) (s.fall = true), S.foeFallAfterShove++;
        for (const p of S.pommels) if (t - p.t <= 1 && !p.fall) (p.fall = true), S.pommelFall++;
      }
      aStand = up;
      // 밀치기가 막힌 까닭 (밂 · 시작 거리 안 · 밀치기 없음 — fighter.closeStep 의 준비 셈을 밖에서 다시: 걸음 요청 기다림 · 휘두름 · 탭 · 내 몸 · 상대 몸)
      const reach = CONFIG.CLOSE.reach(P.armed ? P.weapon : null);
      const startD = P.humanInput && CONFIG.CLOSE.startD > 0 ? CONFIG.CLOSE.startD : reach;
      if (!P.barge && d <= startD && P.stickY > Math.abs(P.stickX)) {
        S.pushT += dtR;
        const foeUp = A.alive && A.state === 'stand' && !A.revival;
        const why = P.state !== 'stand' || !g?.active || P.feetHeld ? 'state' : !foeUp ? 'foe' : P.skill.swinging ? 'swing' : P.skill.tap ? 'tap' : g?.req ? 'req' : 'other';
        S.block[why] += dtR;
      }
    },
    done(fires) {
      const mord = fires.filter((f) => f.name === 'mordschlag');
      const dup = fires.filter((f) => f.name === 'duplieren');
      const link = mord.filter((m) => dup.some((x) => m.t - x.t >= 0 && m.t - x.t <= 2.0)).length;
      if (seg) segs.push(seg);
      const L = P.closeLog ?? {};
      const st = P.stamina.spent;
      return {
        T: r3(S.T), near08: r3(S.near08 / Math.max(1e-6, S.T)), near10: r3(S.near10 / Math.max(1e-6, S.T)),
        digs: S.digs.length, digSteps: P.gait?.digSteps ?? 0, digHit: S.recvAfterDig,
        shoves: S.shoves.length, shoveFall: S.foeFallAfterShove, holds: L.holds ?? 0, holdT: r3((L.holdT ?? 0) / K), landed: L.landed ?? 0, cooled: L.cooled ?? 0,
        trap: Object.fromEntries(Object.entries(L.trap ?? {}).map(([k, v]) => [k, r3(v / K)])), lockT: r3(L.lockT ?? 0), lockAtk: L.lockAtk ?? 0, nearT: r3(L.nearT ?? 0), nearAtk: L.nearAtk ?? 0, ends: L.ends ?? {},
        pommels: S.pommels.length, pommelHit: S.pommelHit, pommelCons: r3(S.pommelCons), pommelFall: S.pommelFall,
        mord: mord.length, mordHit: mord.filter((m) => m.w > 0 || m.cons > 0).length, mordHead: S.mordHead, dup: dup.length, dupMord: link,
        pushT: r3(S.pushT), block: Object.fromEntries(Object.entries(S.block).map(([k, v]) => [k, r3(v)])),
        clinchSt: r3(st.clinch ?? 0), pushSt: r3(st.push ?? 0), foeClinchSt: r3(A.stamina.spent.clinch ?? 0),
        de: P.deDirtyStats ?? null, indesMord: P.schoolPassive?.stats.indes.mord ?? 0, indesRing: P.schoolPassive?.stats.indes.ring ?? 0,
        segs: segs.map((x) => [r3(x.dur), r3(x.band), x.dup ? 1 : 0, r3(x.swing)]), dupHit: dup.filter((x) => x.w > 0 || x.cons > 0).length,
      };
    },
  };
}

export function runCell(cell, seed, variant, dur = 30) {
  const [school, weapon, opp] = cell.split(':');
  const r = fightOne({ school, weapon, opp, seed, dur, probe: makeProbe() });
  return { cell, seed, variant, win: r.win, lose: r.lose, T: r.T, dealt: r.dealt, recv: r.recv, consD: r.consD, consR: r.consR, falls: r.falls, exh: r.exh, secretFired: r.secretFired, ...r.probe };
}

// ── 묶음 ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const f2 = (x, k = 2) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(k));
export function aggRows(runs) {
  const by = {};
  for (const r of runs) (by[`${r.variant}|${r.cell}`] ??= []).push(r);
  return Object.entries(by).map(([k, rs]) => {
    const [variant, cell] = k.split('|');
    const m = (f) => mean(rs.map(f));
    const sum = (f) => rs.reduce((s, r) => s + f(r), 0);
    return {
      variant, cell, n: rs.length, win: rs.filter((r) => r.win).length, lose: rs.filter((r) => r.lose).length,
      dealt: m((r) => r.dealt), recv: m((r) => r.recv), consD: m((r) => r.consD ?? 0), consR: m((r) => r.consR ?? 0), fallsA: m((r) => r.falls.A), fallsP: m((r) => r.falls.P), T: m((r) => r.T), exh: m((r) => r.exh ?? 0),
      digs: m((r) => r.digs), digHit: sum((r) => r.digHit) / Math.max(1, sum((r) => r.digs)),
      shoves: m((r) => r.shoves), holds: m((r) => r.holds), landed: m((r) => r.landed), shoveFall: sum((r) => r.shoveFall) / Math.max(1, sum((r) => r.shoves)), cooled: m((r) => r.cooled),
      holdT: m((r) => r.holdT), trapStick: m((r) => (r.trap?.release ?? 0) + (r.trap?.apart ?? 0) + (r.trap?.armFull ?? 0)), lockT: m((r) => r.lockT), lockAtk: m((r) => r.lockAtk), nearT: m((r) => r.nearT), nearAtk: m((r) => r.nearAtk),
      pommels: m((r) => r.pommels), pommelHit: sum((r) => r.pommelHit) / Math.max(1, sum((r) => r.pommels)), pommelCons: sum((r) => r.pommelCons) / Math.max(1, sum((r) => r.pommelHit)), pommelFall: sum((r) => r.pommelFall),
      mord: m((r) => r.mord), mordHead: m((r) => r.mordHead), dupMord: m((r) => r.dupMord), dup: m((r) => r.dup),
      near08: m((r) => r.near08), near10: m((r) => r.near10), clinchSt: m((r) => r.clinchSt), foeClinchSt: m((r) => r.foeClinchSt), pushSt: m((r) => r.pushSt),
      pushT: m((r) => r.pushT), block: Object.fromEntries(['req', 'swing', 'tap', 'state', 'foe', 'other'].map((w) => [w, m((r) => r.block?.[w] ?? 0)])),
      doorWin: m((r) => (r.de?.doorWin?.shove ?? 0) + (r.de?.doorWin?.dup ?? 0)), armSlow: m((r) => r.de?.armSlow ?? 0), indesMord: m((r) => r.indesMord ?? 0),
    };
  });
}
export function aggMarkdown(runs) {
  const rows = aggRows(runs);
  const out = [];
  out.push('| 판 | 칸 | 판수 | 이김·짐·비김 | 준 심각도 | 받은 심각도 | 준 의식 | 상대 넘어짐 | 내 넘어짐 | 파고들기 | 들어가다 맞음 | 밀치기 | 묶임 | 1 s 안 넘어뜨림 | 손잡이 찍기 (맞음) | 모르트슐라크 | 머리 | 겹치기→모르트 | 붙음 ≤0.8 | ≤1.0 | 붙어 버티기 기력 (상대) | 지침 몫 |');
  out.push('|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---|---:|');
  for (const r of rows) out.push(`| ${r.variant} | ${r.cell} | ${r.n} | ${r.win}·${r.lose}·${r.n - r.win - r.lose} | ${f2(r.dealt)} | ${f2(r.recv)} | ${f2(r.consD)} | ${f2(r.fallsA)} | ${f2(r.fallsP)} | ${f2(r.digs)} | ${f2(100 * r.digHit, 0)}% | ${f2(r.shoves)} | ${f2(r.holds)} | ${f2(100 * r.shoveFall, 0)}% | ${f2(r.pommels)} (${f2(100 * r.pommelHit, 0)}%) | ${f2(r.mord)} | ${f2(r.mordHead)} | ${f2(r.dupMord)} | ${f2(100 * r.near08, 0)}% | ${f2(100 * r.near10, 0)}% | ${f2(r.clinchSt, 1)} (${f2(r.foeClinchSt, 1)}) | ${f2(100 * r.exh, 0)}% |`);
  out.push('', '| 판 | 칸 | 묶인 시간 s/판 | 갇힘(스틱 놓음 · 떨어짐 · 팔 펴짐) s | 묶인 동안 버린 공격 입력 수 | 칼자루만 거리 시간 s | 그 거리 공격 입력 수 | 찍기 맞음당 의식 | 찍기 1 s 안 넘어뜨림(합) | 쿨타임에 걸린 밀치기 | 밂 시간 s (막힘: 걸음 요청 · 휘두름 · 탭 · 몸 · 상대 · 그 밖) | 빠른 문 창 | 팔 늦춤 | 칼자루 뒤 창 |');
  out.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|');
  for (const r of rows) out.push(`| ${r.variant} | ${r.cell} | ${f2(r.holdT)} | ${f2(r.trapStick)} | ${f2(r.lockAtk)} | ${f2(r.nearT)} | ${f2(r.nearAtk)} | ${f2(r.pommelCons, 3)} | ${r.pommelFall} | ${f2(r.cooled)} | ${f2(r.pushT)} (${['req', 'swing', 'tap', 'state', 'foe', 'other'].map((w) => f2(r.block[w])).join(' · ')}) | ${f2(r.doorWin)} | ${f2(r.armSlow)} | ${f2(r.indesMord)} |`);
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(aggMarkdown(runs));
  } else {
    const variant = arg('variant', '③');
    applySets(VARIANTS[variant] ?? '');
    applySets(arg('set', ''));
    const cells = arg('cells', CELLS.join(',')).split(',');
    const seeds = range(arg('seeds', '1-24'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) for (const seed of seeds) {
      const r = runCell(c, seed, variant, +arg('dur', 30));
      runs.push(r);
      console.error(JSON.stringify({ variant, c, seed, win: r.win, lose: r.lose, digs: r.digs, shoves: r.shoves, holds: r.holds, mord: r.mord, pommels: r.pommels, ms: Date.now() - t0 }));
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ variant, set: VARIANTS[variant], cells, seeds, runs }));
    console.log(aggMarkdown(runs));
  }
}
