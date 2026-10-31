// ─────────────────────────────────────────────────────────────
//  bind_on_measure.mjs — 자연 바인드 본판 재기 (사장님 10/31 19:xx '바인드 실험 본판에 적용해. 단 튕김은 0.1이 아니라 0.2로 해. ai가 밀지의 여부는 기본적으로 키되 성향에 따라 그 정도가 조절되면 좋겠네.'
//   — 기록 docs/strike/natural_bind_on_2026-10-31.md) · 재기만 (게임 값은 --set 으로 이 프로세스 안에서만 바꿈)
//  ai  = AI 대 AI (둘 다 기본 'normal' · 숙련 2 — fights12 와 같은 몸) · 무기 짝 × 씨앗
//  bot = 사람 손가락 봇 대 치고 막는 AI (special_balance.mjs fightRun 싸움 그대로 — 숙련 3 · 봇 반응 delay) · 줄(german = 롱소드 · 독일 고유 공격 모두 익힘 → 겹치기 자동 'bind' ·
//        cavTouch = 레이피어 · 칼끼리 닿음 → 탭 = 칼끝 돌려 빼기 · iberian = 츠바이핸더 · japanese = 우치가타나) × 상대 무기 × 씨앗
//  센다 (판마다): 칼끼리 맞닿음 덩이(0 번 몸 feel.touching · 4 스텝 틈까지 한 덩이 — motion_lab BIND_STATS 와 같은 셈) 수 · 길이 · 0.3 s 넘는 덩이 · 그 합(붙어 있던 시간) ·
//   '자석' 셈: 덩이 길이 > 민 AI 의 상한(BIND.holdMax × w) + 0.3 s · 아무도 밀지 않는데(치는 쪽 natPress 손 목표 · 막는 쪽 natHoldDef 둘 다 아님) 붙어 있던 시간 · 그 가운데 두 칼이 함께 끌려감
//   (맞닿은 자리 미끄럼 bladeContact.slide < 0.25 m/s 인데 두 칼끝 평균 빠르기 > 1.5 m/s) · 아무도 안 미는 채 0.3 s · 1 s 넘게 이어진 덩이(Stand = 둘 다 서 있는 동안만 — 넘어진 몸 밑에 칼이 낀 것 뺌) ·
//   판 길이(먼저 죽은 때 — 없으면 끝까지) · 이긴 쪽 · 칼날 상처 심각도 합(양쪽) · 넘어짐(서 있다 down · getup) · 휘청(발 디딤 잃음 offBalanceTime 0 → 양수) · AI natBind 끝난 방식 · 미는 뜻 w
//  시간은 게임 초(1/120 스텝 — 10/11 기록과 같은 잣대 · 실제 초 = ÷ TIME.k 1.1)
//  node tools/sim/bind_on_measure.mjs ai  [--pairs=longsword:longsword,rapier:rapier,…] [--seeds=1-12] [--dur=40] [--set=BIND.natural=0,BIND.restitution=0.1,BIND.will.on=0] [--tag=이름] [--json=파일]
//  node tools/sim/bind_on_measure.mjs bot [--rows=german,cavTouch,iberian,japanese] [--opps=same,longsword] [--seeds=901-904] [--dur=30] [--delay=0.22] [--set=…] [--tag=…] [--json=파일]
//  node tools/sim/bind_on_measure.mjs agg <json…>   (판 묶음마다 표 한 줄 — tag · 모드 · 짝)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, DT, CONFIG, AI } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { fightRun, ROWS } from './special_balance.mjs';
import { isMain } from './is_main.mjs';

const BIND = CONFIG.BIND;
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => s.split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));

/** --set=BIND.natural=0,BIND.will.on=0 — 이 프로세스 안에서만 */
export function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}

// 막는 쪽 '붙어 버팀'이 이 스텝에 걸렸나 (natHoldDef 가 true 를 돌려준 스텝 — 재기만)
const nhd = AI.prototype.natHoldDef;
AI.prototype.natHoldDef = function (dt) {
  const r = nhd.call(this, dt);
  if (r) this._nhdT = this.sense.t;
  return r;
};
const pressing = (A) => !!A && ((A.mode === 'attack' && A.pressAim && A.pressAimT === A.sense.t) || A._nhdT === A.sense.t);
const willOf = (A) => (A ? Math.max(A.natP && !A.natP.done ? A.natP.w ?? 1 : 0, A.mode === 'defend' && A.natDef?.w != null ? A.natDef.w : 0) : 0);

/** 스텝마다 부르는 계기 (0 번 몸 X · 1 번 몸 Y · 그 AI XA · YA — 사람 자리는 XA null) */
function meter(G, X, Y, XA, YA) {
  const M = { lens: [], long: 0, stuck: 0, touchT: 0, freeT: 0, freeStandT: 0, carryT: 0, freeRun03: 0, freeRun1: 0, freeRun1Stand: 0, over: 0, overStand: 0, overAbs: 0, falls: [0, 0], staggers: [0, 0], chunks: [] };
  const S = { run: -1, gap: 0, w: 0, free: 0, freeMax: 0, freeS: 0, freeMaxS: 0, down: false };
  const prev = [X.state, Y.state];
  const offPrev = [0, 0];
  const absMax = BIND.holdMax * (BIND.will?.on ? BIND.will.hi : 1);
  const close = () => {
    const len = S.run;
    M.lens.push(len);
    if (len >= 0.3) (M.long++, (M.stuck += len));
    const lim = S.w > 0 ? BIND.holdMax * S.w : null;
    if (lim != null && len > lim + 0.3) (M.over++, !S.down && M.overStand++);
    if (len > absMax + 0.3) M.overAbs++;
    if (S.freeMax >= 0.3) M.freeRun03++;
    if (S.freeMax >= 1) M.freeRun1++;
    if (S.freeMaxS >= 1) M.freeRun1Stand++;
    if (len >= 0.3) M.chunks.push([r3(len), r3(lim), r3(S.freeMax), S.down ? 1 : 0, r3(S.freeMaxS)]);
    S.run = -1;
  };
  const step = () => {
    [X, Y].forEach((f, i) => {
      if (prev[i] === 'stand' && (f.state === 'down' || f.state === 'getup')) M.falls[i]++;
      prev[i] = f.state;
      const ob = f.offBalanceTime ?? 0;
      if (f.state === 'stand' && offPrev[i] <= 0 && ob > 0) M.staggers[i]++;
      offPrev[i] = ob;
    });
    if (!X.alive || !Y.alive) return;
    const tch = !!X.feel?.touching;
    if (tch) {
      if (S.run < 0) (S.run = 0), (S.w = 0), (S.free = 0), (S.freeMax = 0), (S.freeS = 0), (S.freeMaxS = 0), (S.down = false);
      const stand = X.state === 'stand' && Y.state === 'stand';
      if (!stand) S.down = true;
      S.run += DT;
      S.gap = 0;
      M.touchT += DT;
      const pr = pressing(XA) || pressing(YA);
      S.w = Math.max(S.w, willOf(XA), willOf(YA));
      if (!pr) {
        M.freeT += DT;
        S.free += DT;
        S.freeMax = Math.max(S.freeMax, S.free);
        if (stand) (M.freeStandT += DT), (S.freeS += DT), (S.freeMaxS = Math.max(S.freeMaxS, S.freeS));
        else S.freeS = 0;
        const slide = G.combat.bladeContact?.slide ?? 9;
        const tv = (X.tipVel.length() + Y.tipVel.length()) / 2;
        if (slide < 0.25 && tv > 1.5) M.carryT += DT;
      } else (S.free = 0), (S.freeS = 0);
    } else if (S.run >= 0 && ++S.gap > 4) close();
  };
  const end = () => { if (S.run >= 0) close(); };
  return { M, step, end };
}

const natStats = (A) => (A ? { nat: { ...(A.stats.natBind ?? {}) }, will: A.stats.natWill ? { n: A.stats.natWill.n, mean: r3(A.stats.natWill.sum / A.stats.natWill.n), min: r3(A.stats.natWill.min), max: r3(A.stats.natWill.max) } : null, wind: A.stats.natBind?.wind ?? 0 } : null);

/** AI 대 AI 한 판 */
export function aiFight(wA, wB, seed, dur = 40) {
  const G = newRound({ walls: true, seed, weapon: wA, weapon2: wB, AI2Class: AI });
  applyWeaponMeasure(G.ai2, wA);
  applyWeaponMeasure(G.ai, wB);
  const X = G.player, Y = G.enemy;
  const dmg = [0, 0];
  const pw = G.combat.hooks.onWound;
  G.combat.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (r.type === 'blunt' || !(r.severity > 0)) return;
    if (att === X && vic === Y) dmg[0] += r.severity;
    if (att === Y && vic === X) dmg[1] += r.severity;
  };
  const m = meter(G, X, Y, G.ai2, G.ai);
  let end = null;
  try {
    for (let i = 0; i < Math.round(dur / DT); i++) {
      G.step();
      m.step();
      if (end == null && (!X.alive || !Y.alive)) end = G.t;
      if (end != null && G.t > end + 0.5) break;
    }
    m.end();
    return {
      mode: 'ai', pair: `${wA}:${wB}`, seed, t: r3(end ?? G.t), done: end != null,
      win: X.alive && !Y.alive ? 0 : Y.alive && !X.alive ? 1 : null,
      dmg: dmg.map(r3), blood: [r3(1 - X.blood), r3(1 - Y.blood)],
      ...m.M, lens: m.M.lens.map(r3), ais: [natStats(G.ai2), natStats(G.ai)],
    };
  } finally {
    G.world.free();
  }
}

/** 사람 손가락 봇 대 AI 한 판 (special_balance.mjs fightRun) */
export function botFight(row, opp, seed, { dur = 30, delay = 0.22 } = {}) {
  let m = null;
  let G0 = null;
  const probe = (G, P, A) => {
    if (!m) (m = meter(G, P, A, null, G.ai)), (G0 = G);
    m.step();
  };
  const r = fightRun(row, seed, opp, { variant: 'on', dur, prof: 3, delay, probe });
  m?.end();
  const M = m?.M ?? {};
  return {
    mode: 'bot', pair: `${row}:${opp}`, seed, t: r.t, done: r.win || r.lose,
    win: r.win ? 0 : r.lose ? 1 : null, dmg: [r.dealt, r.recv], fired: r.fired, it: r.it ? { touchTaps: r.it.touchTaps ?? null } : undefined,
    ...M, lens: (M.lens ?? []).map(r3), ais: [null, natStats(G0?.ai)],
  };
}

// ── 묶음 표 ──
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
export function summary(R) {
  const n = R.length;
  const lens = R.flatMap((r) => r.lens);
  const longs = R.flatMap((r) => r.lens.filter((x) => x >= 0.3));
  const min = R.reduce((s, r) => s + r.t, 0) / 60;
  const fired = (k) => R.reduce((s, r) => s + (r.fired?.[k] ?? 0), 0);
  const nat = {};
  for (const r of R) for (const A of r.ais ?? []) for (const [k, v] of Object.entries(A?.nat ?? {})) nat[k] = (nat[k] ?? 0) + v;
  const ws = R.flatMap((r) => (r.ais ?? []).filter((A) => A?.will).map((A) => A.will.mean));
  return {
    n,
    long: r3(R.reduce((s, r) => s + r.long, 0) / n), // 0.3 s 넘는 맞닿음 / 판
    chunks: r3(lens.length / n), // 맞닿음 덩이 / 판
    meanLen: r3(mean(lens)), meanLong: r3(mean(longs)), p90: r3(pct(lens, 0.9)), max: r3(Math.max(0, ...lens)),
    stuck: r3(R.reduce((s, r) => s + r.stuck, 0) / n), // 0.3 s 넘는 덩이 합 s / 판
    touch: r3(R.reduce((s, r) => s + r.touchT, 0) / n), // 맞닿아 있던 시간 s / 판
    stuckShare: r3(R.reduce((s, r) => s + r.stuck, 0) / R.reduce((s, r) => s + r.t, 0)), // 판 시간 가운데 0.3 s 넘는 덩이 몫
    free: r3(R.reduce((s, r) => s + r.freeT, 0) / n), freeStand: r3(R.reduce((s, r) => s + (r.freeStandT ?? 0), 0) / n), freeRun1Stand: R.reduce((s, r) => s + (r.freeRun1Stand ?? 0), 0), overStand: R.reduce((s, r) => s + (r.overStand ?? 0), 0), carry: r3(R.reduce((s, r) => s + r.carryT, 0) / n),
    freeRun03: R.reduce((s, r) => s + r.freeRun03, 0), freeRun1: R.reduce((s, r) => s + r.freeRun1, 0), over: R.reduce((s, r) => s + r.over, 0), overAbs: R.reduce((s, r) => s + r.overAbs, 0),
    t: r3(mean(R.map((r) => r.t))), w0: R.filter((r) => r.win === 0).length, w1: R.filter((r) => r.win === 1).length, draw: R.filter((r) => r.win == null).length,
    dmg0: r3(mean(R.map((r) => r.dmg[0] ?? 0))), dmg1: r3(mean(R.map((r) => r.dmg[1] ?? 0))),
    falls: r3(R.reduce((s, r) => s + r.falls[0] + r.falls[1], 0) / n), staggers: r3(R.reduce((s, r) => s + r.staggers[0] + r.staggers[1], 0) / n),
    nat, will: ws.length ? [r3(Math.min(...ws)), r3(mean(ws)), r3(Math.max(...ws))] : null,
    dupPerMin: r3(fired('duplieren') / min), cavPerMin: r3(fired('cavazione') / min), firedPerMin: Object.fromEntries(Object.keys(R.reduce((o, r) => Object.assign(o, r.fired ?? {}), {})).map((k) => [k, r3(fired(k) / min)])),
    touchTaps: R.some((r) => r.it) ? R.reduce((s, r) => s + (r.it?.touchTaps ?? 0), 0) : undefined,
  };
}

function main() {
  const mode = process.argv[2];
  if (mode === 'agg') {
    const rows = [];
    for (const f of process.argv.slice(3)) {
      const J = JSON.parse(readFileSync(f, 'utf8'));
      const groups = {};
      for (const r of J.runs) (groups[r.pair] ??= []).push(r);
      for (const [pair, R] of Object.entries(groups)) rows.push({ tag: J.tag, mode: J.mode, pair, ...summary(R) });
      rows.push({ tag: J.tag, mode: J.mode, pair: 'ALL', ...summary(J.runs) });
    }
    for (const r of rows) console.log(JSON.stringify(r));
    return;
  }
  applySets(arg('set', ''));
  const tag = arg('tag', 'run');
  const runs = [];
  if (mode === 'ai') {
    const pairs = arg('pairs', 'longsword:longsword,rapier:rapier,zweihander:zweihander,uchigatana:uchigatana').split(',').map((p) => p.split(':'));
    const seeds = range(arg('seeds', '1-12'));
    const dur = +arg('dur', 40);
    for (const [a, b] of pairs) for (const s of seeds) runs.push(aiFight(a, b, s, dur));
  } else if (mode === 'bot') {
    const rowsK = arg('rows', 'german,cavTouch,iberian,japanese').split(',');
    const opps = arg('opps', 'same,longsword').split(',');
    const seeds = range(arg('seeds', '901-904'));
    const dur = +arg('dur', 30);
    const delay = +arg('delay', 0.22);
    for (const row of rowsK) for (const o of opps) {
      const opp = o === 'same' ? ROWS[row].w : o;
      if (o !== 'same' && opp === ROWS[row].w && opps.includes('same')) continue;
      for (const s of seeds) runs.push(botFight(row, opp, s, { dur, delay }));
    }
  } else {
    console.error('mode: ai | bot | agg');
    process.exit(2);
  }
  const J = { tag, mode, set: arg('set', ''), bind: JSON.parse(JSON.stringify(BIND)), runs };
  if (arg('json')) writeFileSync(arg('json'), JSON.stringify(J));
  const groups = {};
  for (const r of runs) (groups[r.pair] ??= []).push(r);
  for (const [pair, R] of Object.entries(groups)) console.log(JSON.stringify({ tag, pair, ...summary(R) }));
  console.log(JSON.stringify({ tag, pair: 'ALL', ...summary(runs) }));
}
if (isMain(import.meta.url)) main();
