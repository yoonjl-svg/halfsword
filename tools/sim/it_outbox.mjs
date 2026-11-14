// ─────────────────────────────────────────────────────────────
//  it_outbox.mjs — 이탈리아 아웃복싱 재기 (사장님 11/14 — config IT_OUTBOX · src/italian_outbox.js · 기록 docs/strike/it_outbox_2026-11-14.md)
//   유파 밸런스 손가락 봇(school_balance.mjs fightOne — 사람 이탈리아 몸을 실제 입력 길로)으로 판 묶음(preset)마다 칸 × 씨앗을 돌린다. 게임 값은 이 프로세스 안에서만 바꾼다.
//   판(preset): main_old = 지금 main · 전 봇 / main = 지금 main · 아웃복싱 봇(SB_IT_BOT=outbox) / m07 · m08 · m09 = 1 만 / stop = 2 만 / edge2 · edge3 = 3 만 / beat = 4 만 / all · all3 · all07 · all09 = 넷 모두
//   판마다 적음: 이김 · 짐 · 준 · 받은 심각도 · 리솔루토(비기) 낸 수 · 준 몫 · 칼 우위 켜진 수(갈래) · 비껴서며 찌르기 낸 수 · 맞음 · 박자 찌르기 길 · 맞박자(카운터) 맞음 ·
//    비껴서며 찌르기 탭 진단(diag — 봇이 옆 탭을 냈는데 안 나간 까닭: 식힘 · 위협 없음 · 스틱 · 같은 위협 · 몸 바쁨 · 상대 · 지침)
//  node tools/sim/it_outbox.mjs run --preset=all --cells=italian:rapier:longsword,... [--seeds=1-24] [--json=파일]
//  node tools/sim/it_outbox.mjs work --presets=main_old,main,... --of=4 --at=0 --out=파일.jsonl   (판 × 칸 덩이를 차례로 나눠 맡음 — 판 하나마다 한 줄 덧붙임 · 이미 적힌 판은 건너뜀)
//  node tools/sim/it_outbox.mjs agg <json · jsonl ...>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, appendFileSync, readdirSync } from 'node:fs';
import { isMain } from './is_main.mjs';

export const CELLS = ['italian:rapier:longsword', 'italian:rapier:rapier', 'italian:rapier:sabre', 'italian:rapier:uchigatana', 'italian:dartagnan:longsword', 'italian:dartagnan:dartagnan', 'italian:dartagnan:sabre', 'italian:dartagnan:uchigatana'];
/** 판 묶음: bot = 'outbox' | '' (전 봇) · io = IT_OUTBOX 덮어쓰기 (edge · beat 는 실제 초 — realS 로 바꿔 넣음) */
export const PRESETS = {
  main_old: { bot: '', io: { on: 0 } },
  main: { bot: 'outbox', io: { on: 0 } },
  m07: { bot: 'outbox', io: { on: 1, thrustMul: 0.7, stop: 0, edge: 0, beat: 0 } },
  m08: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0, edge: 0, beat: 0 } },
  m09: { bot: 'outbox', io: { on: 1, thrustMul: 0.9, stop: 0, edge: 0, beat: 0 } },
  stop: { bot: 'outbox', io: { on: 1, thrustMul: 1, stop: 0.3, edge: 0, beat: 0 } },
  edge2: { bot: 'outbox', io: { on: 1, thrustMul: 1, stop: 0, edge: 2.0, beat: 0 } },
  edge3: { bot: 'outbox', io: { on: 1, thrustMul: 1, stop: 0, edge: 3.0, beat: 0 } },
  beat: { bot: 'outbox', io: { on: 1, thrustMul: 1, stop: 0, edge: 0, beat: 0.4 } },
  all: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 2.0, beat: 0.4 } },
  all3: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 3.0, beat: 0.4 } },
  all07: { bot: 'outbox', io: { on: 1, thrustMul: 0.7, stop: 0.3, edge: 2.0, beat: 0.4 } },
  all09: { bot: 'outbox', io: { on: 1, thrustMul: 0.9, stop: 0.3, edge: 2.0, beat: 0.4 } },
  // 11/14 사장님 '이탈리아 찌르기 0.8로 해. 우위 2초 권고대로. ai에도 적용.' — fin = 본판 값(사람 · AI 같게) · hum = 사람만(11/14 첫 판 · ai 0)
  fin: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 2.0, beat: 0.4, ai: 1 } },
  hum: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 2.0, beat: 0.4, ai: 0 } },
  // 11/14 사장님 '기본찌르기는 0.6 위에서 내려찌르기는 0.9' — 판금 상대(하인리히 차림 · SB_FOE_LOOK=plate): finP = 새 틈(레이피어 0.6 · 내려 찌르기 0.9) · finPold = 옛 틈(0.3 · 0.6)
  finP: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 2.0, beat: 0.4, ai: 1 }, plate: 1, gap: { rapier: 0.6, estoc: 0.6, imbro: 0.9 } },
  finPold: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 2.0, beat: 0.4, ai: 1 }, plate: 1, gap: { rapier: 0.3, estoc: 0.5, imbro: 0.6 } },
  // 11/14 사장님 '리솔루토도 쓰게해' — AI 이탈리아 숙련 5(비기 문 AI_PROFICIENCY.secretAt): R = 리솔루토 열림(본판 aiOpenSchools 'italian') · R0 = 닫힘(이탈리아를 뺌 — 견줌)
  //  ai 칸(aiFight)은 prof = AI 이탈리아 숙련 · run 칸(손가락 봇)은 foeProf = 상대 AI 숙련(SB_FOE_PROF — 레이피어 거울)
  aiR: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 2.0, beat: 0.4, ai: 1 }, prof: 5, foeProf: 5, open: 1 },
  aiR0: { bot: 'outbox', io: { on: 1, thrustMul: 0.8, stop: 0.3, edge: 2.0, beat: 0.4, ai: 1 }, prof: 5, foeProf: 5, open: 0 },
};
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; });
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

/** 판 묶음을 넣고(이 프로세스 안) 칸 × 씨앗을 돈다 */
export async function runPreset(name, cells, seeds, log = () => {}) {
  const P0 = PRESETS[name];
  if (!P0) throw new Error(`모르는 판 ${name}`);
  process.env.SB_IT_BOT = P0.bot;
  process.env.SB_FOE_LOOK = P0.plate ? 'plate' : '';
  process.env.SB_FOE_PROF = P0.foeProf ? String(P0.foeProf) : '';
  const { fightOne, CONFIG } = await loadSB();
  const IO = CONFIG.IT_OUTBOX;
  const keep = { ...IO };
  const { THRUST_STYLE } = await import('../../src/weapons.js');
  const keepGap = [THRUST_STYLE.rapier.gap, THRUST_STYLE.estoc.gap, CONFIG.UNIQUE_ASSIST.imbroccataGap];
  if (P0.gap) (THRUST_STYLE.rapier.gap = P0.gap.rapier), (THRUST_STYLE.estoc.gap = P0.gap.estoc), (CONFIG.UNIQUE_ASSIST.imbroccataGap = P0.gap.imbro);
  const io = { ...P0.io };
  if (io.edge != null) io.edge = CONFIG.realS(io.edge);
  if (io.beat != null) io.beat = CONFIG.realS(io.beat);
  Object.assign(IO, io);
  const UA = CONFIG.UNIQUE_ASSIST;
  const open0 = CONFIG.SECRET.aiOpenSchools;
  if (P0.open === 0) CONFIG.SECRET.aiOpenSchools = open0.filter((x) => x !== 'italian');
  const runs = [];
  try {
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        let P = null, uq = null, lastAct = null, GA = null;
        const fr = { sev: 0, hits: 0 }; // 상대 AI 리솔루토가 사람에게 낸 상처 (11/14)
        const plate = { hits: 0, sev: 0, pierce: 0, stopped: 0 };
        const diag = [];
        const probe = {
          init({ G, P: p, A, uq: u }) {
            P = p;
            GA = G.ai;
            uq = u;
            const pw = G.combat.hooks.onWound; // 판금 재기 (11/14): 판 위 칼날 상처 · 판에 막힌 찌르기(멍으로 바뀜) · 상처 낸 맞음 수 · 심각도
            G.combat.hooks.onWound = (att, vic, r, ...rest) => {
              pw?.(att, vic, r, ...rest);
              if (att === A && vic === P && G.ai.secretRun?.stage === 'riso' && r.severity > 0 && r.type !== 'blunt') (fr.hits++, (fr.sev += r.severity));
              if (att !== P || vic !== A) return;
              if (r.severity > 0 && r.type !== 'blunt') (plate.hits++, (plate.sev += r.severity));
              if (r.plate && r.type === 'stab' && r.severity > 0) plate.pierce++;
              if (r.plate && r.type === 'blunt' && (P.skill?.tap || P.iai || P.skill?.sec || P.stamina?.stroke?.kind === 'thrust')) plate.stopped++;
            };
            const e = uq.tapList?.find((x) => x.tapKey === 'inq');
            if (!e) return;
            const orig = uq.tapChain.bind(uq);
            uq.tapChain = () => {
              const want = lastAct?.want ?? null;
              const G = P.parryGuard;
              const n0 = uq.stats.fired.inquartata ?? 0;
              const x = P.stickX ?? 0, y = P.stickY ?? 0;
              const why = !UA.inqTap ? 'off' : uq.cooling(e) ? 'cooling' : uq.busy(!!UA.tapHeld) ? 'busy' : P.foe?.state !== 'stand' ? 'foe' : P.stamina.exhausted ? 'exhausted' : null;
              const sk = P.skill; // 바쁨 갈래 (unique_assist.js busy 와 같은 차례): 손을 쥠 · 비기 · 탭 찌르기 · 손잡이 찍기 · 걸어 맞추기 · 몸 상태 · 칼 · 마무리
              const busyBy = why === 'busy' ? (uq.handHeld || uq.blocked ? 'held' : sk.sec ? 'sec' : sk.tap ? (sk.tap.uniqTech ? `tap:${sk.tap.uniqTech}` : 'tap') : sk.pom ? 'pom' : sk.vitalRange ? 'vital' : P.state !== 'stand' ? `state:${P.state}` : !P.armed || P.weaponBroken ? 'weapon' : (P.finish?.amt ?? 0) > 0.5 ? 'finish' : 'other') : null;
              const threat = !!G && G.noThreat <= UA.inqThreat;
              const side = Math.abs(x) >= (UA.stepIn ? UA.stepStick : 0.5) && Math.abs(x) >= Math.abs(y);
              const seen = !!G && uq.inqSeen === G.threatId;
              const ret = orig();
              const fired = (uq.stats.fired.inquartata ?? 0) > n0;
              if (want === 'inquartata' || want === 'tempo' || fired) diag.push({ want, fired, why, busyBy, threat, side, seen, sx: r3(x), sy: r3(y), age: G ? r3(G.noThreat / CONFIG.TIME.k) : null, beat: !!uq.foeAtk && r3((uq.t - uq.foeAtk.t0) / CONFIG.TIME.k) });
              return ret;
            };
          },
          step(cur, act) { lastAct = act; },
          done() {
            const o = P?.itOut ?? {};
            const AR = GA?.stats?.riso;
            const foeRiso = GA ? { on: !!AR, fired: GA.stats?.secrets?.andareRisoluto?.fired ?? 0, landed: GA.stats?.secrets?.andareRisoluto?.landed ?? 0, wins: AR?.wins ?? 0, gapBlocked: AR?.gapBlocked ?? 0, armT: r3((AR?.armT ?? 0) / CONFIG.TIME.k), edge: GA.me.itOut?.edge ?? 0, ...fr } : null;
            return { foeRiso, plate, edge: o.edge ?? 0, by: o.by ?? {}, stopHits: o.stopHits ?? 0, thrustHits: o.thrustHits ?? 0, beatFired: o.beatFired ?? 0, risoWait: r3((o.risoWait ?? 0) / CONFIG.TIME.k), diag, tapFired: uq?.stats?.fired ?? {} };
          },
        };
        const r = fightOne({ school, weapon, opp, seed, probe });
        const sum = summarize(r);
        runs.push({ preset: name, c, ...sum });
        log(JSON.stringify({ preset: name, c, seed, win: r.win, lose: r.lose, T: r.T, riso: sum.riso, edge: sum.edge, inq: sum.inq }));
      }
    }
  } finally {
    Object.assign(IO, keep);
    CONFIG.SECRET.aiOpenSchools = open0;
    [THRUST_STYLE.rapier.gap, THRUST_STYLE.estoc.gap, CONFIG.UNIQUE_ASSIST.imbroccataGap] = keepGap;
  }
  return runs;
}
/**
 * AI 대 AI 한 판 (11/14 'ai에도 적용' 재기): 자리 0 = AI 이탈리아(weapon) · 자리 1 = 상대 AI(opp) · 둘 다 숙련 3(손가락 봇 판의 상대와 같은 몸) · 30 s.
 *  → 이김 · 짐 · 준 · 받은 심각도(칼날) · 칼 우위 켜진 수(갈래) · 박자 찌르기 · 맞박자 맞음 · 비껴서며 찌르기 낸 수(AI 특수 공격 셈) · 맞받아 베기 수
 */
export async function aiFight(preset, weapon, opp, seed) {
  const P0 = PRESETS[preset];
  const h = await import('./harness_m.mjs');
  const { newRound, DT, AI, CONFIG } = h;
  const IO = CONFIG.IT_OUTBOX;
  const keep = { ...IO };
  const io = { ...P0.io };
  if (io.edge != null) io.edge = CONFIG.realS(io.edge);
  if (io.beat != null) io.beat = CONFIG.realS(io.beat);
  Object.assign(IO, io);
  const open0 = CONFIG.SECRET.aiOpenSchools;
  if (P0.open === 0) CONFIG.SECRET.aiOpenSchools = open0.filter((x) => x !== 'italian');
  try {
    const G = newRound({ walls: true, seed, weapon, weapon2: opp, AI2Class: AI, persona: { proficiency: 3 }, persona2: { proficiency: P0.prof ?? 3 } }); // 11/14 AI 리솔루토 재기: AI 이탈리아 숙련 P0.prof (상대 AI 는 3 그대로)
    const P = G.player, E = G.enemy;
    const hasRiso = G.ai2.secret?.name === 'andareRisoluto'; // 숙련 5 · 열림이면 판 처음에 듦
    const w = { dealt: 0, recv: 0, inqHit: 0, risoSev: 0, risoHits: 0 };
    const pw = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, ...rest) => {
      pw?.(att, vic, r, ...rest);
      const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
      if (att === P) w.dealt += sv;
      if (att === P && G.ai2.secretRun?.stage === 'riso' && sv > 0) (w.risoHits++, (w.risoSev += sv));
      else w.recv += sv;
    };
    let T = 30;
    for (let k = 0; k < Math.round(30 / DT); k++) {
      G.step();
      if (!P.alive || !E.alive) { T = G.t; break; }
    }
    const o = P.itOut ?? {};
    const st = G.ai2.stats;
    const r = { preset, c: `ai:${weapon}:${opp}`, seed, T: r3(T), win: !E.alive && P.alive, lose: !P.alive && E.alive, dealt: r3(w.dealt), recv: r3(w.recv), edge: o.edge ?? 0, by: o.by ?? {}, beatFired: o.beatFired ?? 0, stopHits: o.stopHits ?? 0, thrustHits: o.thrustHits ?? 0, inq: st.specials?.inquartata ?? 0, counters: st.counters ?? 0, specials: st.specials ?? null, riso: st.secrets?.andareRisoluto?.fired ?? 0, risoLanded: st.secrets?.andareRisoluto?.landed ?? 0, risoWins: st.riso?.wins ?? 0, risoGap: st.riso?.gapBlocked ?? 0, risoArmT: r3((st.riso?.armT ?? 0) / CONFIG.TIME.k), risoSev: r3(w.risoSev), risoHits: w.risoHits, hasRiso };
    G.world.free();
    return r;
  } finally {
    Object.assign(IO, keep);
    CONFIG.SECRET.aiOpenSchools = open0;
  }
}
let SB = null;
async function loadSB() {
  if (!SB) {
    const m = await import('./school_balance.mjs');
    const h = await import('./harness_m.mjs');
    SB = { fightOne: m.fightOne, CONFIG: h.CONFIG };
  }
  return SB;
}

/** 판 하나 → 줄 */
export function summarize(r) {
  const F = r.fires;
  const sev = (f) => f.sev ?? 0;
  const all = F.reduce((s, f) => s + sev(f), 0);
  const riso = F.filter((f) => f.cls === 'secret');
  const inq = F.filter((f) => f.name === 'inquartata');
  const pr = r.probe ?? {};
  return {
    seed: r.seed, T: r.T, win: r.win, lose: r.lose, dealt: r.dealt, recv: r.recv,
    riso: riso.length, risoSev: r3(riso.reduce((s, f) => s + sev(f), 0)), firesSev: r3(all),
    inq: inq.length, inqHit: inq.filter((f) => f.w > 0).length, inqSev: r3(inq.reduce((s, f) => s + sev(f), 0)),
    edge: pr.edge ?? 0, by: pr.by ?? {}, stopHits: pr.stopHits ?? 0, thrustHits: pr.thrustHits ?? 0, beatFired: pr.beatFired ?? 0, risoWait: pr.risoWait ?? 0,
    diag: pr.diag ?? [], wants: r.wants, plate: pr.plate ?? null,
  };
}

const f2 = (x, k = 2) => (x == null || !Number.isFinite(x) ? '–' : x.toFixed(k));
/** 판 묶음 · 칸마다 한 줄 (판당) */
export function aggRows(runs) {
  const by = new Map();
  for (const r of runs) {
    const k = `${r.preset}|${r.c}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  }
  const rows = [];
  for (const [k, R] of by) {
    const [preset, c] = k.split('|');
    rows.push(row(preset, c, R));
  }
  return rows;
}
export function row(preset, c, R) {
  const n = R.length;
  const s = (key) => R.reduce((a, r) => a + (r[key] ?? 0), 0);
  const win = R.filter((r) => r.win).length, lose = R.filter((r) => r.lose).length;
  const by = {};
  for (const r of R) for (const [k, v] of Object.entries(r.by ?? {})) by[k] = (by[k] ?? 0) + v;
  return {
    preset, c, n, win, lose, draw: n - win - lose,
    risoShare: s('firesSev') > 0 ? s('risoSev') / s('firesSev') : null, riso: s('riso') / n,
    edge: s('edge') / n, by, inq: s('inq') / n, inqHit: s('inqHit') / n, beat: s('beatFired') / n, stopHits: s('stopHits') / n, thrustHits: s('thrustHits') / n,
    dealt: s('dealt') / n, recv: s('recv') / n, T: s('T') / n, risoWait: s('risoWait') / n,
  };
}
export function aggMarkdown(runs, { pool = false } = {}) {
  const rows = aggRows(runs);
  const out = ['| 판 | 칸 | 판 수 | 이김·짐·비김 | 리솔루토 몫 | 리솔루토/판 | 칼 우위/판 (갈래) | 비껴서며 찌르기/판 (맞음 · 박자 길) | 카운터 맞음/판 | 약한 찌르기 맞음/판 | 준 심각도/판 | 받은 심각도/판 | 판 길이 s |', '|---|---|---:|---|---:|---:|---|---|---:|---:|---:|---:|---:|'];
  for (const x of rows) {
    const by = Object.entries(x.by).map(([k, v]) => `${k} ${f2(v / x.n)}`).join(' · ');
    out.push(`| ${x.preset} | ${x.c.replace('italian:', '')} | ${x.n} | ${x.win}·${x.lose}·${x.draw} | ${x.risoShare == null ? '–' : `${Math.round(100 * x.risoShare)} %`} | ${f2(x.riso)} | ${f2(x.edge)}${by ? ` (${by})` : ''} | ${f2(x.inq)} (${f2(x.inqHit)} · ${f2(x.beat)}) | ${f2(x.stopHits)} | ${f2(x.thrustHits)} | ${f2(x.dealt)} | ${f2(x.recv)} | ${f2(x.T, 1)} |`);
  }
  if (pool) {
    const P = new Map();
    for (const r of runs) { if (!P.has(r.preset)) P.set(r.preset, []); P.get(r.preset).push(r); }
    out.push('', '| 판 (칸 모아) | 판 수 | 이김·짐·비김 | 리솔루토 몫 | 리솔루토/판 | 칼 우위/판 | 비껴서며 찌르기/판 (맞음 · 박자 길) | 카운터 맞음/판 | 준/판 | 받은/판 |', '|---|---:|---|---:|---:|---:|---|---:|---:|---:|');
    for (const [p, R] of P) {
      const x = row(p, '*', R);
      out.push(`| ${p} | ${x.n} | ${x.win}·${x.lose}·${x.draw} | ${x.risoShare == null ? '–' : `${Math.round(100 * x.risoShare)} %`} | ${f2(x.riso)} | ${f2(x.edge)} | ${f2(x.inq)} (${f2(x.inqHit)} · ${f2(x.beat)}) | ${f2(x.stopHits)} | ${f2(x.dealt)} | ${f2(x.recv)} |`);
    }
  }
  return out.join('\n');
}
/** 비껴서며 찌르기 탭 진단 (봇이 옆 탭 · 박자 탭을 냈을 때 · 나간 탭) */
export function diagMarkdown(runs) {
  const P = new Map();
  for (const r of runs) for (const d of r.diag ?? []) {
    if (!P.has(r.preset)) P.set(r.preset, { n: 0, fired: 0, why: {} });
    const x = P.get(r.preset);
    if (d.want !== 'inquartata') continue;
    x.n++;
    if (d.fired) { x.fired++; continue; }
    const k = d.why ?? (!d.threat ? 'noThreat' : !d.side ? 'stick' : d.seen ? 'sameThreat' : 'other');
    x.why[k] = (x.why[k] ?? 0) + 1;
  }
  const out = ['| 판 | 옆 탭 수 | 나감 | 안 나간 까닭 |', '|---|---:|---:|---|'];
  for (const [p, x] of P) out.push(`| ${p} | ${x.n} | ${x.fired} | ${Object.entries(x.why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'ai') {
    const presets = arg('presets', 'main,fin').split(',');
    const cells = arg('cells', 'rapier:longsword,rapier:sabre').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const out = arg('out', null);
    for (const p of presets) for (const c of cells) for (const seed of seeds) {
      const [wpn, opp] = c.split(':');
      const r = await aiFight(p, wpn, opp, seed);
      console.error(JSON.stringify({ p, c, seed, win: r.win, lose: r.lose, edge: r.edge, beat: r.beatFired, stop: r.stopHits }));
      if (out) appendFileSync(out, JSON.stringify(r) + '\n');
    }
  } else if (mode === 'work') {
    const presets = arg('presets', Object.keys(PRESETS).join(',')).split(',');
    const cells = arg('cells', CELLS.join(',')).split(',');
    const seeds = range(arg('seeds', '1-24'));
    const of = +arg('of', 1), at = +arg('at', 0), out = arg('out', null);
    const done = new Set();
    const dir = arg('done', null); // 이 폴더의 *.jsonl 에 이미 적힌 판은 건너뜀 (일꾼끼리 나눈 덩이가 바뀌어도)
    const files = dir ? readdirSync(dir).filter((f) => f.endsWith('.jsonl')).map((f) => `${dir}/${f}`) : [out];
    for (const fp of files) { try { for (const l of readFileSync(fp, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); done.add(`${r.preset}|${r.c}|${r.seed}`); } } catch {} }
    const units = presets.flatMap((p) => cells.map((c) => [p, c]));
    for (let i = at; i < units.length; i += of) {
      const [p, c] = units[i];
      for (const seed of seeds.filter((s) => !done.has(`${p}|${c}|${s}`))) {
        const [r] = await runPreset(p, [c], [seed], (s) => console.error(s));
        appendFileSync(out, JSON.stringify(r) + '\n');
      }
    }
  } else if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => (p.endsWith('.jsonl') ? readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : JSON.parse(readFileSync(p, 'utf8')).runs));
    console.log(aggMarkdown(runs, { pool: true }));
    console.log('');
    console.log(diagMarkdown(runs));
  } else {
    const presets = arg('preset', 'main').split(',');
    const cells = arg('cells', CELLS.join(',')).split(',');
    const seeds = range(arg('seeds', '1-24'));
    const runs = [];
    for (const p of presets) runs.push(...(await runPreset(p, cells, seeds, (s) => console.error(s))));
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ presets, cells, seeds, runs }));
    console.log(aggMarkdown(runs, { pool: true }));
  }
}
