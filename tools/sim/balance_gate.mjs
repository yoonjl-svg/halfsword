// ─────────────────────────────────────────────────────────────
//  balance_gate.mjs — 균형 관문 (물리 2.0 · 15 번째 판). 재기만 한다.
//
//   node tools/sim/balance_gate.mjs --root=<트리> [--seeds=0-39|100-139] [--json=<파일>] [--scenes=A,C] [--noguard] [--ref=<지킴 줄 기준 json>] [--writeRef] [--jobs=2]
//
//  하는 일: ① tools/sim/balance_scenes.mjs 의 장면마다 씨앗 묶음을 돌려 버틴 몫과 판마다 낸 값들의 가운데값을 찍는다 · 모두 합친 버틴 몫.
//          ② 지킴 줄: tools/sim/legs_battery.mjs 의 기본 19 장면을 --n=8 --fights=0 --weapons=longsword (--nohonesty — 정직 검사는 그 도구에서 따로)로 돌려
//             걷기 · 뒷걸음 · 옆걸음 빠르기와 장면마다 통과 수를 기준(--ref · 기본 docs/strike/physics2_proto/r15/guard_ref.json — 오늘 본판 fb_base 에서 잰 값)과 견준다.
//             빠르기가 10 % 넘게 바뀌거나 통과 수가 줄면 '바뀜'. --writeRef = 이번 값을 기준으로 적음.
//  시뮬레이션은 늘 두 개까지만 함께 (--jobs · 자식 프로세스). 일은 장면 하나 · 지킴 묶음 반쪽 둘로 나눠 긴 것부터 — 같은 인자면 같은 결과(판마다 새 세계 · 일 나눔이 고정).
//  --json: { scenes: { A: { recovery, … }, … }, total: { recovery, recovered, n }, guard: { changed, rows } } — 찾기 도구는 scenes.<장면>.recovery 하나씩 읽으면 된다.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const SEEDS = String(args.seeds ?? '0-39');
const KEYS = String(args.scenes ?? 'A,C').split(',');
const JOBS = Math.max(1, Math.min(2, +(args.jobs ?? 2)));
const REF = resolve(String(args.ref ?? join(HERE, '../../docs/strike/physics2_proto/r15/guard_ref.json')));
const TMP = mkdtempSync(join(tmpdir(), 'bgate-'));
const t0 = Date.now();

const GUARD_HALVES = [
  ['wander', 'stopgo', 'getup', 'walkstroke_diagR', 'walkstroke_vert', 'walkstroke_horizR'],
  ['stand', 'walk', 'back', 'strafeR', 'strafeL', 'turn', 'circle', 'kick40', 'kick80', 'walkkick', 'stroke_diagR', 'stroke_vert', 'stroke_horizR'],
];
const tasks = [];
if (!args.noguard) GUARD_HALVES.forEach((only, i) => tasks.push({ id: 'guard' + i, cost: i === 0 ? 3 : 2.5, argv: [join(HERE, 'legs_battery.mjs'), `--root=${ROOT}`, '--n=8', '--fights=0', '--weapons=longsword', '--nohonesty', '--quiet', `--only=${only.join(',')}`, `--json=${join(TMP, 'guard' + i + '.json')}`] }));
for (const k of KEYS) tasks.push({ id: k, cost: 1, argv: [join(HERE, 'balance_scenes.mjs'), `--root=${ROOT}`, `--scenes=${k}`, `--seeds=${SEEDS}`, `--json=${join(TMP, 'sc_' + k + '.json')}`] });
tasks.sort((a, b) => b.cost - a.cost);

const run = (t) => new Promise((res, rej) => {
  const p = spawn(process.execPath, t.argv, { stdio: ['ignore', 'ignore', 'pipe'] });
  let err = ''; p.stderr.on('data', (d) => { err += d; });
  p.on('exit', (code) => (code === 0 ? res() : rej(new Error(`${t.id} 실패 (${code}): ${err.split('\n').filter((l) => !/deprecated/.test(l)).slice(-5).join(' | ')}`))));
});
const queue = [...tasks];
await Promise.all(Array.from({ length: JOBS }, async () => { while (queue.length) await run(queue.shift()); }));

const fmt = (x, d = 2) => (x == null || !isFinite(x) ? '-' : (+x).toFixed(d));
// 장면 줄 (balance_scenes.mjs 의 line 과 같은 꼴 — 그 도구를 불러오면 시뮬레이션 모듈이 이 프로세스에도 실려서 따로 적음)
const line = (m) => {
  const cs = Object.entries(m.causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '-';
  return `  ${m.scene} ${m.name.padEnd(16)} 버팀 ${String(m.recovered).padStart(2)}/${m.n} (${fmt(100 * m.recovery, 0)} %) · 넘어짐 원인 ${cs} (같은 원인 ${m.sameCause == null ? '-' : fmt(100 * m.sameCause, 0) + ' %'}) · 자리 잡음 ${fmt(m.tSteady)} s · 걸음 ${fmt(m.nSteps, 0)} · 디딘÷필요 ${fmt(m.stepRatio)} · 날아간 ${fmt(m.flight)} s · 디딜 때 무릎 ${fmt(m.kneeTD, 0)}° · 가장 깊은 무릎 ${fmt(m.kneeDeep, 0)}° · 한도 넘은 몫 무릎 ${fmt(m.kneeOver)} 엉덩이 ${fmt(m.hipOver)} 발목 ${fmt(m.ankleOver)}`;
};
const out = { root: ROOT, seeds: SEEDS, scenes: {}, total: null, guard: null, secs: null };
console.log(`균형 관문 · ${ROOT} · 씨앗 ${SEEDS}`);
let rec = 0, n = 0;
for (const k of KEYS) {
  const J = JSON.parse(readFileSync(join(TMP, 'sc_' + k + '.json'), 'utf8')).scenes[k];
  const { runs, ...m } = J; out.scenes[k] = m; rec += m.recovered; n += m.n;
  console.log(line(m));
}
out.total = { recovered: rec, n, recovery: +(rec / Math.max(1, n)).toFixed(3) };
console.log(`  합계 버팀 ${rec}/${n} (${(100 * rec / Math.max(1, n)).toFixed(0)} %)`);

if (!args.noguard) {
  const solo = {}; for (let i = 0; i < GUARD_HALVES.length; i++) Object.assign(solo, JSON.parse(readFileSync(join(TMP, 'guard' + i + '.json'), 'utf8')).solo.longsword);
  const rows = {}; for (const [k, r] of Object.entries(solo)) rows[k] = { ok: r.ok, n: r.n, along: r.along };
  const ref = existsSync(REF) && !args.writeRef ? JSON.parse(readFileSync(REF, 'utf8')).rows : null;
  let changed = 0; const lines = [];
  for (const k of [...GUARD_HALVES[1], ...GUARD_HALVES[0]]) {
    const r = rows[k]; if (!r) continue; const q = ref?.[k];
    const sp = ['walk', 'back', 'strafeR', 'strafeL'].includes(k);
    let bad = false;
    if (q) { if (r.ok < q.ok) bad = true; if (sp && q.along && Math.abs(r.along - q.along) > 0.1 * Math.abs(q.along)) bad = true; }
    r.changed = bad; if (bad) changed++;
    lines.push(`${k} ${r.ok}/${r.n}${sp ? ` ${fmt(r.along)} m/s` : ''}${q ? (bad ? ` ← 바뀜 (기준 ${q.ok}/${q.n}${sp ? ' ' + fmt(q.along) + ' m/s' : ''})` : '') : ''}`);
  }
  out.guard = { changed, ref: ref ? REF : null, rows };
  console.log(`  지킴 줄 (legs_battery 기본 19 · n 8 · longsword${ref ? ' · 기준과 견줌' : ' · 기준 없음'}): ${changed ? `바뀜 ${changed}` : ref ? '모두 같음' : '-'}`);
  for (let i = 0; i < lines.length; i += 5) console.log('    ' + lines.slice(i, i + 5).join(' · '));
  if (args.writeRef) { writeFileSync(REF, JSON.stringify({ root: ROOT, note: 'legs_battery 기본 19 장면 · --n=8 --fights=0 --weapons=longsword --nohonesty', rows }, null, 1)); console.log(`  기준을 적음: ${REF}`); }
}
out.secs = +((Date.now() - t0) / 1000).toFixed(0);
console.log(`  걸린 시간 ${out.secs} s (함께 ${JOBS})`);
if (args.json) writeFileSync(String(args.json), JSON.stringify(out, null, 1));
rmSync(TMP, { recursive: true, force: true });
