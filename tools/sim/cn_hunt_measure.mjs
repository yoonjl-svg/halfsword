// ─────────────────────────────────────────────────────────────
//  cn_hunt_measure.mjs — 동방 맹호은림 사냥 겹 재기 (11/14 — 기록 docs/strike/cn_hunt_2026-11-14.md · 게임 src/cn_hunt.js · config UNIQUE_ASSIST.cnHunt)
//   재기만 한다 — 판 값은 이 프로세스 안에서만 바꾼다. 몸 · 봇 = school_balance.mjs fightOne (사람 손가락 봇 · 스킬트리 모두 익힘 · 상대 숙련 3 AI · 30 실제 s).
//   판(cfg): 1 = 전 main(사냥 끔 · 판당 3 · 옛 봇) · 1b = 사냥 끔 · 사냥 봇 · 2 = 겹(기력 회복)만 · 3 = + 격살 빠르기 · 4 = + 격살 판당 1 번 · 5 = 4 + AI 스위치 (2 ~ 5 = 몸통만 — 11/14 첫 판) · 6 = 몸 어디든(11/14 둘째 가지 기본)
//   모든 판: 비기 굳음 SECRET.stiff.chinese = 실제 0.6 s (감독 11/14 — 사장님 '모든 비기 경직 0.6초로 통일'이 본판에 들어오기 전이라 재기 설정으로만)
//  node tools/sim/cn_hunt_measure.mjs run --cfg=4 --cells=chinese:hwando:longsword --seeds=1-24 --json=.tmp/x.json
//  node tools/sim/cn_hunt_measure.mjs par [--cfgs=1,1b,2,3,4,5] [--cells=…] [--seeds=1-24] [--jobs=4] [--out=.tmp/cn_hunt]
//  node tools/sim/cn_hunt_measure.mjs agg <json …>
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { isMain } from './is_main.mjs';

const UA = CONFIG.UNIQUE_ASSIST;
/** 재는 칸: 환도 · 청강검 대 롱소드 AI · 거울 둘 · 대 독일(세이버 AI) · 대 일본(우치가타나 AI) */
export const HUNT_CELLS = ['chinese:hwando:longsword', 'chinese:qinggang:longsword', 'chinese:hwando:hwando', 'chinese:qinggang:qinggang', 'chinese:hwando:sabre', 'chinese:hwando:uchigatana'];
/** 판 (cnHunt 덮는 값 · 사냥 봇) */
//  11/14 둘째 판 (사장님 '동방과 일본은 전부 권고대로'): 6 = 새 가지 기본(몸 어디든 · 판당 1 번 공용 표) · 1 ~ 5 = 첫 판(몸통만 torso 1 — uses = 동방 판당 수 secretUses.chinese)
export const CFGS = {
  1: { label: '① 전 main (사냥 끔 · 판당 3 · 옛 봇)', set: { on: 0 }, uses: 3, bot: 0 },
  '1b': { label: '①b 사냥 끔 · 판당 3 · 사냥 봇', set: { on: 0 }, uses: 3, bot: 1 },
  2: { label: '② 겹(기력 회복)만 · 몸통', set: { on: 1, share: 0, torso: 1 }, uses: 3, bot: 1 },
  3: { label: '③ + 격살 빠르기 · 몸통', set: { on: 1, torso: 1 }, uses: 3, bot: 1 },
  4: { label: '④ + 격살 판당 1 번 · 몸통 (11/14 첫 가지 기본)', set: { on: 1, torso: 1 }, uses: 1, bot: 1 },
  5: { label: '⑤ ④ + AI 스위치', set: { on: 1, torso: 1, ai: 1 }, uses: 1, bot: 1 },
  6: { label: '⑥ 몸 어디든 · 판당 1 번 (11/14 둘째 가지 기본)', set: { on: 1, torso: 0 }, uses: 1, bot: 1 },
};
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });

/** 판 하나를 켬 (이 프로세스 안 — 기본값은 가지 그대로에서 덮음) */
export function applyCfg(cfg) {
  const C = CFGS[cfg];
  if (!C) throw new Error(`cfg ${cfg}`);
  Object.assign(UA.cnHunt, C.set);
  if (C.uses != null) UA.secretUses = { ...UA.secretUses, chinese: C.uses };
  CONFIG.SECRET.stiff.chinese = CONFIG.realS(0.6); // 감독 11/14: 비기 굳음 0.6 s 로 잼 (11/14 본판 기본값도 0.6 — c1cad826)
  return C;
}

/** 판 묶음 → 한 줄 (칸 · 판) */
export function huntRow(runs) {
  const n = runs.length;
  const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
  const gk = runs.map((r) => r.fires.filter((f) => f.cls === 'secret' && f.name === 'gyeoksal'));
  const gkHitRuns = runs.filter((r, i) => gk[i].some((f) => f.w > 0));
  return {
    n,
    win: runs.filter((r) => r.win).length,
    lose: runs.filter((r) => r.lose).length,
    draw: runs.filter((r) => !r.win && !r.lose).length,
    stack: mean(runs.map((r) => r.hunt?.n ?? 0)),
    full: runs.filter((r) => (r.hunt?.n ?? 0) >= (UA.cnHunt.max ?? 5)).length,
    t5: mean(runs.filter((r) => r.hunt?.t5 != null).map((r) => r.hunt.t5)),
    onMe: mean(runs.map((r) => r.hunt?.onMe ?? 0)),
    gkFired: gk.reduce((s, a) => s + a.length, 0),
    gkHit: gk.reduce((s, a) => s + a.filter((f) => f.w > 0).length, 0),
    gkSev: mean(gk.flat().filter((f) => f.w > 0).map((f) => f.sev)),
    gkHitRuns: gkHitRuns.length,
    gkHitWin: gkHitRuns.filter((r) => r.win).length,
    T: mean(runs.map((r) => r.T)),
    recv: mean(runs.map((r) => r.recv)),
    dealt: mean(runs.map((r) => r.dealt)),
  };
}

export function aggMarkdown(all) {
  const by = {};
  for (const r of all) (by[`${r.cfg}|${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const f = (x, k = 2) => (x == null ? '–' : x.toFixed(k));
  const out = ['| 판 | 칸 | 판 수 | 이김·짐·비김 | 겹 평균 | 5 겹 닿은 판 | 5 겹 닿은 때 s | 내게 쌓인 겹 | 격살 낸 수 | 맞음 | 맞음당 심각도 | 격살 맞힌 판 이김 | 판 길이 s | 준 심각도/판 | 받은 심각도/판 |', '|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  const keys = Object.keys(by).sort((a, b) => { const [ca, xa] = a.split('|'); const [cb, xb] = b.split('|'); return HUNT_CELLS.indexOf(xa) - HUNT_CELLS.indexOf(xb) || Object.keys(CFGS).indexOf(ca) - Object.keys(CFGS).indexOf(cb); });
  for (const k of keys) {
    const [cfg, cell] = k.split('|');
    const R = huntRow(by[k]);
    out.push(`| ${cfg} | ${cell} | ${R.n} | ${R.win}·${R.lose}·${R.draw} | ${f(R.stack)} | ${R.full} | ${f(R.t5, 1)} | ${f(R.onMe)} | ${R.gkFired} | ${R.gkHit} | ${f(R.gkSev)} | ${R.gkHitWin}/${R.gkHitRuns} | ${f(R.T, 1)} | ${f(R.dealt)} | ${f(R.recv)} |`);
  }
  // 칸 모아 (판마다)
  out.push('', '| 판 | 판 수 | 이김·짐·비김 | 겹 평균 | 5 겹 닿은 판 | 격살 낸 수 | 맞음 | 격살 맞힌 판 이김 | 판 길이 s | 받은 심각도/판 |', '|---|---:|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const cfg of Object.keys(CFGS)) {
    const rs = all.filter((r) => String(r.cfg) === cfg);
    if (!rs.length) continue;
    const R = huntRow(rs);
    out.push(`| ${cfg} ${CFGS[cfg].label} | ${R.n} | ${R.win}·${R.lose}·${R.draw} | ${f(R.stack)} | ${R.full} | ${R.gkFired} | ${R.gkHit} | ${R.gkHitWin}/${R.gkHitRuns} | ${f(R.T, 1)} | ${f(R.recv)} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')).runs);
    console.log(aggMarkdown(runs));
  } else if (mode === 'par') {
    const cfgs = arg('cfgs', Object.keys(CFGS).join(',')).split(',');
    const cells = arg('cells', HUNT_CELLS.join(',')).split(',');
    const seeds = arg('seeds', '1-24');
    const out = arg('out', '.tmp/cn_hunt');
    mkdirSync(out, { recursive: true });
    const all = cfgs.flatMap((c) => cells.map((x) => ({ c, x, json: `${out}/${c}_${x.replace(/:/g, '-')}.json` })));
    const jobs = all.filter((J) => !existsSync(J.json)); // 이어 돌리기: 이미 끝난 덩이(json 있음)는 건너뜀
    let next = 0;
    const self = fileURLToPath(import.meta.url);
    const one = () => new Promise((res) => {
      if (next >= jobs.length) return res();
      const J = jobs[next++];
      const p = spawn(process.execPath, [self, 'run', `--cfg=${J.c}`, `--cells=${J.x}`, `--seeds=${seeds}`, `--json=${J.json}`], { stdio: ['ignore', 'ignore', 'inherit'] });
      p.on('exit', (code) => { console.error(`done ${J.c} ${J.x} rc ${code}`); one().then(res); });
    });
    await Promise.all(Array.from({ length: +arg('jobs', 4) }, one));
    console.log(aggMarkdown(all.filter((J) => existsSync(J.json)).flatMap((J) => JSON.parse(readFileSync(J.json, 'utf8')).runs)));
  } else {
    const cfg = arg('cfg', '4');
    const C = applyCfg(cfg);
    const cells = arg('cells', HUNT_CELLS.join(',')).split(',');
    const runs = [];
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of range(arg('seeds', '1-24'))) {
        const r = fightOne({ school, weapon, opp, seed, hunt: C.bot });
        r.cfg = cfg;
        delete r.reads;
        runs.push(r);
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ cfg, cells, runs }));
    else console.log(aggMarkdown(runs));
  }
}
