// r29: 뛰기 나무의 s5/search.mjs 그대로 — 나무(W=<나무>) 와 나옴 폴더(첫 인자)만 밖에서 받게 고침. 쓰는 법: W=<나무> node search_ll.mjs <나옴 폴더> <이름> <분>
// RUN 값 찾기 (관문 hop 그대로 · 판 0 ~ 7 · 세 무기): 무작위 뽑기 → 가장 좋은 몇 둘레에서 좁혀 가는 진화 셈.
//  node search.mjs <이름> <분>  — 한 번에 관문 하나(그 안에서 시뮬 둘). 결과 <이름>.jsonl(한 줄 한 값 묶음) · 가장 좋은 열 <이름>.best.txt · 끝 표시 <이름>.done
//  다시 돌리면 jsonl 을 읽고 이어 감. 점수(작을수록 좋음): 넘어짐 먼저, 그다음 두 발 뜬 스텝 몫 · 0.05 s 넘게 뜬 디딤 몫 · 수직 힘 최고 (관문 줄의 가운데값)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, rmSync, cpSync, symlinkSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const W = process.env.W; if (!W) throw new Error('W=<나무> 를 주시오');
const S = process.argv[2]; // 나옴 폴더
// (다섯째 시도 판: s4/search.mjs 를 베낌 — 새 값 여섯 · 넓힌 범위 · 점수에 못 넘은 줄 · 모터 · 벌림 · 무릎발목 몫)
const [NAME = 'es1', MIN = '90'] = process.argv.slice(3);
const OUT = join(S, NAME + '.jsonl'), BEST = join(S, NAME + '.best.txt'), DONE = join(S, NAME + '.done');
if (existsSync(DONE)) unlinkSync(DONE);
// 범위 [아래, 위] — 모두 RUN 열쇠
const SPACE = {
  width: [0.0, 0.12], tdKnee: [0.3, 0.6], preTD: [0.008, 0.04], forceP: [0.2, 1.0], forceSkew: [0.2, 0.8],
  cadence: [2.4, 3.2], flightMin: [0.05, 0.1], capUse: [0.6, 1.0], momWin: [0.05, 0.3], hGain: [2, 10],
  swReact: [40, 100], swReactAir: [30, 150], airTilt: [40, 80], tdTau: [0.03, 0.1], tdClr: [0.03, 0.08], extT: [0.08, 0.18], swingHz: [3, 7],
  stDamp: [0.02, 0.3], swDamp: [0.01, 0.12], swCap: [0.02, 0.1], capAx: [0.75, 1.0], sideMu: [0, 0.5], abdUse: [0.6, 0.95], liftV: [0, 1.1],
};
const KEYS = Object.keys(SPACE);
const cfgAll = readFileSync(join(W, 'src/config.js'), 'utf8'), cfgText = cfgAll.slice(cfgAll.indexOf('export const RUN'));
const cur = {};
for (const k of KEYS) { const m = cfgText.match(new RegExp('\\n  ' + k + ': ([-0-9.]+),')); cur[k] = m ? +m[1] : (SPACE[k][0] + SPACE[k][1]) / 2; }
const rows = existsSync(OUT) ? readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
let seed = 12345 + rows.length * 7919;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const clampK = (k, v) => Math.min(SPACE[k][1], Math.max(SPACE[k][0], v));
const num = (s) => (s == null ? NaN : +s);
function parse(txt) {
  const L = (re) => txt.split('\n').find((l) => re.test(l)) || '';
  const med = (l) => num(l.match(/가운데값 ([-0-9.]+)/)?.[1]);
  const fell = L(/넘어짐 없음/).match(/잰 값 (\d+)\/(\d+)/);
  const g = txt.match(/GATE hop: (\w+)(?: \((\d+) of (\d+)\))?/);
  return {
    stand: fell ? +fell[1] : 0, n: fell ? +fell[2] : 24,
    fly: med(L(/두 발 모두 뜬/)), f05: med(L(/0\.05 s 넘게/)), f05min: num(L(/0\.05 s 넘게/).match(/가장 작음 ([-0-9.]+)/)?.[1]),
    mot: med(L(/모터 몫/)), abd: med(L(/디딘 엉덩이 벌림/)), kn: med(L(/디딘 무릎 · 발목/)),
    pk: med(L(/수직 힘 최고/)), pkMax: num(L(/수직 힘 최고/).match(/가장 큼 ([-0-9.]+)/)?.[1]),
    fails: g ? (g[2] ? +g[2] : 0) : 99,
  };
}
// (다섯째 시도) 점수: 넘어진 판 먼저 · 그다음 두 발 뜬 몫 · 0.05 s 넘게 뜬 몫 · 힘 최고 · 못 넘은 줄 수 · 모터 몫 · 벌림 · 무릎발목 몫(관문 줄의 가운데값)
const score = (m) => 10 * (m.n - m.stand) + 5 * Math.max(0, (0.15 - (m.fly || 0)) / 0.15) + 3 * (1 - (m.f05 || 0)) + Math.max(0, ((m.pk || 9) - 2.4) / 2.4) + 0.3 * (m.fails ?? 19) + Math.max(0, (m.mot ?? 2) - 0.1) + Math.max(0, (m.abd ?? 2) - 0.85) + Math.max(0, (m.kn ?? 2) - 0.75);
function evalSet(p) {
  const R = join(S, NAME + '.tree');
  rmSync(R, { recursive: true, force: true });
  mkdirSync(R, { recursive: true });
  cpSync(join(W, 'src'), join(R, 'src'), { recursive: true });
  cpSync(join(W, 'tools'), join(R, 'tools'), { recursive: true });
  symlinkSync(join(W, 'node_modules'), join(R, 'node_modules'));
  appendFileSync(join(R, 'src/config.js'), '\n' + KEYS.map((k) => `RUN.${k} = ${+p[k].toPrecision(4)};`).join('\n') + '\n');
  let txt = '';
  try { txt = execFileSync('node', [join(W, 'tools/sim/run_gate.mjs'), '--root=' + R, '--stage=hop', '--seeds=0-7', '--jobs=2', '--out=' + join(S, NAME + '.cache')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }); } catch (e) { txt = String(e.stdout || ''); }
  rmSync(R, { recursive: true, force: true });
  return parse(txt);
}
function writeBest() {
  const b = [...rows].sort((a, c) => a.score - c.score).slice(0, 10);
  const head = 'score | 안넘어짐 | 두발뜸 | 뜬>0.05 (최소) | 힘최고 (최대) | 모터 벌림 무릎 | 못넘은 줄 | ' + KEYS.join(' ');
  writeFileSync(BEST, head + '\n' + b.map((r) => `${r.score.toFixed(3)} | ${r.m.stand}/${r.m.n} | ${r.m.fly} | ${r.m.f05} (${r.m.f05min}) | ${r.m.pk} (${r.m.pkMax}) | ${r.m.mot} ${r.m.abd} ${r.m.kn} | ${r.m.fails} | ` + KEYS.map((k) => +r.p[k].toPrecision(3)).join(' ')).join('\n') + '\n');
}
const t0 = Date.now();
const NINIT = 6;
while ((Date.now() - t0) / 60000 < +MIN) {
  let p;
  if (rows.length === 0) p = { ...cur };
  else if (rows.length < NINIT) { p = {}; for (const k of KEYS) p[k] = SPACE[k][0] + rnd() * (SPACE[k][1] - SPACE[k][0]); }
  else {
    const top = [...rows].sort((a, c) => a.score - c.score).slice(0, 4);
    const par = top[Math.floor(rnd() * top.length)].p;
    const sig = Math.max(0.06, 0.25 * Math.pow(0.97, rows.length - NINIT));
    p = {};
    for (const k of KEYS) p[k] = clampK(k, par[k] + sig * gauss() * (SPACE[k][1] - SPACE[k][0]));
  }
  const m = evalSet(p);
  const r = { i: rows.length, p, m, score: score(m) };
  rows.push(r);
  appendFileSync(OUT, JSON.stringify(r) + '\n');
  writeBest();
}
writeFileSync(DONE, 'done ' + rows.length + '\n');
