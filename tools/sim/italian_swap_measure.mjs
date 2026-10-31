// ─────────────────────────────────────────────────────────────
//  italian_swap_measure.mjs — 10/31 이탈리아 자리 바꿈 재기 (사장님 10/31 12:xx — docs/strike/italian_swap_2026-10-31.md)
//   재기만 한다 — 게임 값은 건드리지 않는다. special_balance.mjs fightRun 의 줄 cavTouch · inqVoid(사람 손가락 봇 대 치고 막는 AI · 30 s)를 돌려 묶는다.
//   cavTouch (I2 칼끝 돌려 빼기 — 기본 기술): 판당 낸 수 · 낸 칼 맞힘 % · 칼끼리 닿음 · 그 가운데 내 긋기 동안이라 셈 밖 · 이른 탭(기회를 없앰) · 승패 · 준 · 받은 심각도
//   inqVoid (I9 비껴서며 찌르기 — 특수 공격): 맞받기 시도 · 낸 수 · 낸 칼 맞힘 % · 낸 뒤 0.6 s 안 상대 칼에 맞은 몫(off = 같은 손의 보통 탭 · 옆걸음) · 낸 뒤 1 s 안 넘어짐 · 승패 · 준 · 받은
//  사용법: node tools/sim/italian_swap_measure.mjs [--rows=cavTouch,inqVoid] [--variants=on,off] [--opps=longsword,uchigatana,zweihander] [--fseeds=901,902] [--delays=0.15] [--dur=30] [--prof=3] [--json=파일]
//          node tools/sim/italian_swap_measure.mjs agg <json ...>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { fightRun } from './special_balance.mjs';
import { isMain } from './is_main.mjs';

const r3 = (x) => (x == null || !isFinite(x) ? null : +x.toFixed(3));
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const pct = (n, d) => (d > 0 ? r3((100 * n) / d) : null);

/** 판들 → 한 줄 */
export function summarize(row, runs) {
  const n = runs.length;
  const name = row === 'inqVoid' ? 'inquartata' : 'cavazione';
  const fired = sum(runs, (r) => r.fired?.[name] ?? 0);
  const res = runs.flatMap((r) => (r.it?.fires ?? []).filter(Boolean));
  const hit = res.filter((x) => x.hits > 0).length;
  const blocked = res.filter((x) => x.blocked && !x.hits).length;
  const base = {
    row, n, perFight: r3(fired / n), fired, snapRes: res.length, hitPct: pct(hit, res.length), blockedPct: pct(blocked, res.length),
    spSev: r3(sum(runs, (r) => r.spSev) / n), spHits: sum(runs, (r) => r.spHits),
    win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length,
    dealt: r3(sum(runs, (r) => r.dealt) / n), recv: r3(sum(runs, (r) => r.recv) / n),
    falls: sum(runs, (r) => r.it?.falls?.length ?? 0),
  };
  if (row === 'cavTouch') {
    const touches = sum(runs, (r) => r.it?.touches ?? 0);
    const cut = sum(runs, (r) => r.it?.touchCut ?? 0);
    return { ...base, touchesPerFight: r3(touches / n), touchCutPerFight: r3(cut / n), touchCutPct: pct(cut, touches), earlyPerFight: r3(sum(runs, (r) => r.it?.early ?? 0) / n), tapsPerFight: r3(sum(runs, (r) => r.it?.touchTaps ?? 0) / n) };
  }
  const inq = runs.flatMap((r) => r.it?.inq ?? []);
  const F = inq.filter((x) => x.fired);
  const N = inq.filter((x) => !x.fired);
  return {
    ...base, tries: inq.length, triesThreat: inq.filter((x) => x.threat).length, triesCool: inq.filter((x) => x.cool).length,
    firedTryPct: pct(F.length, inq.length),
    hitAfterFiredPct: pct(F.filter((x) => x.hit).length, F.length), // 낸 뒤 0.6 s 안에 상대 칼에 맞은 몫 (작을수록 몸 빼기가 비낌)
    hitAfterNotFiredPct: pct(N.filter((x) => x.hit).length, N.length),
    recvAfterFired: r3(F.length ? sum(F, (x) => x.recv) / F.length : null),
    fallAfterFired: F.filter((x) => x.fall).length,
  };
}

function parseArgs() {
  const a = { _: [] };
  for (const s of process.argv.slice(2)) {
    const m = s.match(/^--([^=]+)=(.*)$/);
    if (m) a[m[1]] = m[2];
    else a._.push(s);
  }
  return a;
}

if (isMain(import.meta.url)) {
  const args = parseArgs();
  if (args._[0] === 'agg') {
    const by = new Map();
    for (const fn of args._.slice(1)) for (const x of JSON.parse(readFileSync(fn, 'utf8')).res) by.set(`${x.row}|${x.variant}`, [...(by.get(`${x.row}|${x.variant}`) ?? []), ...x.runs]);
    for (const [k, runs] of by) console.log(k, JSON.stringify(summarize(k.split('|')[0], runs)));
  } else {
    const rows = String(args.rows ?? 'cavTouch,inqVoid').split(',');
    const variants = String(args.variants ?? 'on,off').split(',');
    const opps = String(args.opps ?? 'longsword,uchigatana,zweihander').split(',');
    const fseeds = String(args.fseeds ?? '901,902').split(',').map(Number);
    const delays = String(args.delays ?? '0.15').split(',').map(Number);
    const out = { at: new Date().toISOString(), res: [] };
    const t0 = Date.now();
    for (const row of rows)
      for (const variant of variants) {
        const runs = [];
        for (const opp of opps) for (const seed of fseeds) for (const delay of delays) {
          const r = fightRun(row, seed, opp, { variant, delay, prof: +(args.prof ?? 3), dur: +(args.dur ?? 30), share: +(args.share ?? 0.5), counter: +(args.counter ?? 0.5) });
          delete r.atts;
          runs.push(r);
        }
        out.res.push({ row, variant, runs });
        console.log(`${row} ${variant}: ${JSON.stringify(summarize(row, runs))}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
        if (args.json) writeFileSync(String(args.json), JSON.stringify(out)); // 판마다 적음 (컨테이너가 다시 서도 남게)
      }
  }
}
