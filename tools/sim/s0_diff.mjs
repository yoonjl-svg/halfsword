// S = 0 불변 관문 (docs/strike/r2_impl_spec.md §7, §8.2 'S = 0'). 새 빌드 대 기준 B 를 같은 묶음에서 바이트로 견준다
//
//   node tools/sim/s0_diff.mjs [--batteries=arm,live,dance,fights] [--hz=120,60] [--weapons=longsword,zweihander,sabre]
//        [--ginput=wind,stroke] [--seeds=1,13,25,37,49] [--ref=<체크아웃>] [--ref-only] [--no-main] [--quick] [--out=<폴더>] [--set=GRP.key=val ...]
//
//  빌드 (with_config 로 설정만 바꾼다, 모두 같은 체크아웃):
//   new    = 기본 (GESTURE.on·DRIVE.on 켬) — 손가락이 있는 묶음(arm·live·dance)은 입력 방식 (A) wind·(B) stroke 둘 다
//   B      = GESTURE.on=false (맨 팔 베기)                         → new 와 바이트 같아야 한다
//            (옛 결심 경로를 지운 뒤 (R2 W5, §7-8): 옛 기준 B 'GESTURE.on=false COMMIT.minLevel=2' 가 이것이 되고, 1단계 소비를 가르던 기준 A 는 없다)
//  묶음:
//   arm    = 팔 베기 입력 (감기 없음 |w| < sL0, 쉼에서 vStrike 넘는 획 없음 — 목록은 출력 'inputs'):
//            자세 6곳 3 mm / 8 Hz 떨림 2 s, 쟁기에서 8 방향 0.1 m 획 (4·8 m/s), 자세 바꾸기 29가지 0.7 m/s 최소 저크 (최고 1.31 m/s < vStrike 1.5)
//            패드를 손가락 없이 시작 자세에 두고 (setPad) 1 s 뒤 긋는다. 입력 Hz 60/120 (화면 프레임, 물리 120), 무기 셋 (고를 수 있다)
//   live   = live_battery.mjs 기본 · dance = dance.mjs 기본 · fights = fights12.mjs SEED0 1/13/25/37/49 (AI 끼리, 손가락 없음 → (A) 만)
//            이 셋은 무기를 고를 수 없다 (롱소드). Hz = 물리 Hz (PHYSICS.timestep 1/120 게임, 1/60)
//  스텝 탭 (s0_tap.mjs, node --import): 물리 스텝마다 몸 전부의 해시와 S·w (옛 결심 on 칸은 지운 뒤 늘 0). 판(world)마다 처음 어긋난 스텝을 찾아 가른다:
//   new 쪽 S > 0 (그 스텝·앞 두 스텝) → 손짓 문턱 오분류 (실패 아님, arm 묶음에서 S ≥ mixX 인 입력 비율 ≤ 3 % 관문)
//   그 밖 → S = 0 샘 = FAIL
//  깃발 끈 판 (wbs_baselines.md §3 명령) = main sha, 기본 AI 판 = wbs_baselines.md §1 sha (둘 다 실행할 때 문서에서 읽는다)
//  --ref=<체크아웃>: 같은 묶음을 그 체크아웃에서도 돌려 바이트 견줌 (옛 경로 지우기 전 ↔ 뒤, §7-8): new ↔ ref new, B ↔ ref B.
//   ref 의 config 에 옛 COMMIT 이 있으면 ref B 에 COMMIT.minLevel=2 를 더한다 (지우기 전 기준 B). --ref-only 면 이것만
//  S = 0 FAIL (샘·ref 차이·sha 어긋남) 이 하나라도 있으면 끝 코드 1. 오분류 비율은 따로 적는다 (§8.2 Gesture 줄의 관문, 끝 코드 밖). 결과: <out>/s0_diff.json, s0_diff.md (기본 out = 임시 폴더)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT0 = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const a = argv.find((s) => s === `--${k}` || s.startsWith(`--${k}=`));
  return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true;
};
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);

// ═════════════ 아이 (arm 묶음을 돌린다: 설정은 --sets, 뿌리는 S0_ROOT) ═════════════
if (arg('child') === 'arm') {
  const ROOT = path.resolve(process.env.S0_ROOT || ROOT0);
  const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
  const CONFIG = await imp('src/config.js');
  for (const s of list('sets', '')) {
    const i = s.indexOf('=');
    const [g, k] = s.slice(0, i).split('.');
    const v = s.slice(i + 1);
    CONFIG[g][k] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
  const H = await imp('tools/sim/harness_m.mjs');
  const { newRound, DT, THREE, feedTrace, inputPump, handPos } = H;
  const PAD = {
    Pflug: [0.18, -0.28], PflugL: [-0.18, -0.28], Ochs: [0.22, 0.26], OchsL: [-0.22, 0.26], Tag: [0.02, 0.52], ShR: [0.42, 0.42],
    Langort: [0, 0.03], Alber: [0, -0.5], WechselL: [-0.4, -0.42], Wechsel: [0.38, -0.44], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Neben: [0.55, -0.26],
  };
  // wholebody.mjs detect 의 자세 바꾸기 (FP) 그대로
  const FP = [['Pflug', 'Ochs'], ['Pflug', 'OchsL'], ['Pflug', 'Tag'], ['Pflug', 'PflugL'], ['PflugL', 'Pflug'], ['Pflug', 'Alber'], ['Pflug', 'Wechsel'], ['Pflug', 'Neben'], ['Pflug', 'Langort'],
    ['Ochs', 'OchsL'], ['OchsL', 'Ochs'], ['Alber', 'Ochs'], ['Alber', 'OchsL'], ['WechselL', 'Ochs'], ['Wechsel', 'OchsL'], ['Tag', 'Langort'], ['Langort', 'Side'], ['Langort', 'SideL'], ['Ochs', 'Pflug'],
    ['OchsL', 'PflugL'], ['Tag', 'Ochs'], ['Ochs', 'Tag'], ['Side', 'Langort'], ['ShR', 'Ochs'], ['Ochs', 'Langort'], ['Langort', 'Pflug'], ['Wechsel', 'Pflug'], ['WechselL', 'PflugL'], ['Alber', 'Pflug']];
  const inputs = [];
  for (const p of [[0.18, -0.28], [0.3, 0.34], [0.1, 0.4], [0.26, 0.0], [-0.1, -0.35], [0.02, 0.15]]) {
    const T = 2000, a = 0.003, w = 2 * Math.PI * 8;
    inputs.push({ id: `jitter@${p}`, from: p, tr: { fn: (t) => [a * Math.sin((w * t) / 1000), a * (Math.cos((w * t) / 1000) - 1)], T, lift: true } });
  }
  for (const v of [4, 8])
    for (let k = 0; k < 8; k++) {
      const d = (k * Math.PI) / 4, L = 0.1, dx = L * Math.cos(d), dy = L * Math.sin(d), T = (L / v) * 1000;
      inputs.push({ id: `small${k * 45}deg@${v}`, from: PAD.Pflug, tr: { fn: (t) => { const u = Math.min(1, t / T); return [dx * u, dy * u]; }, T: T + 150, lift: true } });
    }
  for (const [a, b] of FP) {
    const dx = PAD[b][0] - PAD[a][0], dy = PAD[b][1] - PAD[a][1], v = 0.7, T = (Math.hypot(dx, dy) / v) * 1000;
    inputs.push({ id: `${a}->${b}@0.7mj`, from: PAD[a], tr: { fn: (t) => { const u = Math.min(1, t / T); const s = u * u * u * (10 - 15 * u + 6 * u * u); return [dx * s, dy * s]; }, T: T + 150, lift: true } });
  }
  if (arg('list')) {
    console.log(JSON.stringify(inputs.map((q) => q.id)));
    process.exit(0);
  }
  const setPad = (P, xy) => {
    P.handOffset.set(xy[0], xy[1]);
    const k = P.skill;
    for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(xy[0], xy[1]);
    k.aimVel?.set(0, 0);
    k.vel?.set(0, 0);
    k.follow?.set(0, 0);
  };
  const tip = new THREE.Vector3();
  for (const weapon of list('weapons', 'longsword'))
    for (const hz of list('hz', '60').map(Number))
      for (const q of inputs) {
        const G = newRound({ walls: false, gap: 2.2, seed: 11, weapon });
        const P = G.player, E = G.enemy;
        G.ai.update = () => E.move.set(0, 0);
        P.skill.level = 0.7;
        setPad(P, q.from);
        inputPump(G, { hz });
        for (let i = 0; i < Math.round(1.0 / DT); i++) G.step();
        const tr = feedTrace(G, q.tr, hz);
        const ser = [];
        let i = 0;
        const rec = () => {
          if (i++ % 2) return;
          P.bladePoint(1, tip);
          const h = handPos(P);
          ser.push(tip.x, tip.y, tip.z, h.x, h.y, h.z);
        };
        while (!tr.done) (G.step(), rec());
        for (let k = 0; k < Math.round(1.0 / DT); k++) (G.step(), rec());
        console.log(JSON.stringify({ id: q.id, weapon, hz, state: P.state, n: ser.length, ser }));
      }
  process.exit(0);
}

// ═════════════ 부모 ═════════════
const QUICK = !!arg('quick', false);
const BATS = list('batteries', 'arm,live,dance,fights');
const HZS = list('hz', QUICK ? '120' : '120,60').map(Number);
const WEAPONS = list('weapons', QUICK ? 'longsword' : 'longsword,zweihander,sabre');
const GINPUTS = list('ginput', 'wind,stroke');
const SEEDS = list('seeds', QUICK ? '1' : '1,13,25,37,49').map(Number);
const REF = arg('ref', null) ? path.resolve(arg('ref')) : null;
const REF_ONLY = !!arg('ref-only', false);
const MAIN = !arg('no-main', false) && !REF_ONLY;
const OUT = path.resolve(arg('out', fs.mkdtempSync(path.join(os.tmpdir(), 's0_diff_'))));
fs.mkdirSync(OUT, { recursive: true });
const CFG = await import(pathToFileURL(path.join(ROOT0, 'src/config.js')).href);
const MIXX = CFG.DRIVE.mixX;
const TAP = path.join(HERE, 's0_tap.mjs');
const t00 = Date.now();

// --set=GRP.key=val (여러 번): 세 빌드 모두에 더한다 (설정 바꿔 보기, 예: GESTURE.sectorAll=false). 기본 AI 판·깃발 끈 판 sha 견줌에는 안 넣는다
const XSETS = argv.filter((s) => s.startsWith('--set=')).map((s) => s.slice(6));
const BUILDS = { new: [...XSETS], B: ['GESTURE.on=false', ...XSETS] };
// ref (지우기 전 체크아웃) 의 기준 B: 옛 COMMIT 이 있으면 옛 1단계를 막는다 (§7 기준 B 그대로)
const REF_OLD = REF ? /export const COMMIT\b/.test(fs.readFileSync(path.join(REF, 'src/config.js'), 'utf8')) : false;
const REF_B = REF_OLD ? ['GESTURE.on=false', 'COMMIT.minLevel=2', ...XSETS] : BUILDS.B;
const ginSet = (g) => (g === 'wind' ? [] : [`GESTURE.input=${g}`]);
const dtSet = (hz) => (hz === 120 ? [] : [`PHYSICS.timestep=${1 / hz}`]);

/** 일 하나 돌리기: 표준 출력 sha·탭 */
function run(root, job, tag) {
  const tap = path.join(OUT, `${tag}.tap.json`);
  const outF = path.join(OUT, `${tag}.out`);
  let args, env = { ...process.env, S0_TAP: tap, S0_ROOT: root, QUIET_ATLAS: '1', ...(job.env || {}) };
  if (job.battery === 'arm') args = [TAP, path.join(HERE, 's0_diff.mjs'), '--child=arm', `--sets=${job.sets.join(',')}`, `--hz=${job.hz}`, `--weapons=${job.weapon}`];
  else args = [TAP, path.join(root, 'tools/sim/with_config.mjs'), ...job.sets, job.script, ...(job.args || [])];
  const t0 = Date.now();
  const r = spawnSync('nice', ['-n', '10', process.execPath, '--import', pathToFileURL(args[0]).href, ...args.slice(1)], { cwd: root, env, encoding: 'utf8', maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`${tag} 실패 (${r.status}): ${r.stderr.slice(-800)}`);
  fs.writeFileSync(outF, r.stdout);
  return { tag, sha: crypto.createHash('sha256').update(r.stdout).digest('hex'), out: r.stdout, tap: readTap(tap), s: +((Date.now() - t0) / 1000).toFixed(1) };
}
function readTap(f) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const dec = (s, T) => { const u = new Uint8Array(Buffer.from(s, 'base64')); return new T(u.buffer); };
  return { n: j.n, hash: dec(j.hash, Uint32Array), round: dec(j.round, Int32Array), step: dec(j.step, Int32Array), S: dec(j.S, Float64Array), w: dec(j.w, Float64Array), cm: dec(j.cm, Uint8Array) };
}
/** 판(world)마다 스텝 범위 */
function rounds(t) {
  const m = new Map();
  for (let i = 0; i < t.n; i++) {
    const r = t.round[i];
    const o = m.get(r);
    if (!o) m.set(r, { a: i, b: i });
    else o.b = i;
  }
  return m;
}
/**
 * 견주기: kind 'B' | 'ref'. new (또는 지금 체크아웃) = x, 기준 = y
 * 판마다 처음 어긋난 스텝 → 분류. 돌려주는 것: { verdict, rounds: [...], sameStdout, sameTap }
 */
function compare(x, y, kind) {
  const sameStdout = x.sha === y.sha;
  const rx = rounds(x.tap), ry = rounds(y.tap);
  const res = [];
  let sameTap = x.tap.n === y.tap.n;
  for (const [id, a] of rx) {
    const b = ry.get(id);
    if (!b) { res.push({ round: id, cls: 'missing' }); sameTap = false; continue; }
    const na = a.b - a.a + 1, nb = b.b - b.a + 1;
    let k = -1;
    for (let j = 0; j < Math.min(na, nb); j++) if (x.tap.hash[a.a + j] !== y.tap.hash[b.a + j]) { k = j; break; }
    if (k < 0 && na !== nb) k = Math.min(na, nb);
    // 이 판의 new 쪽 S 최고 (플레이어·상대)
    let Smax = 0;
    for (let j = a.a; j <= a.b; j++) Smax = Math.max(Smax, x.tap.S[j * 2], x.tap.S[j * 2 + 1]);
    if (k < 0) { res.push({ round: id, cls: 'same', Smax }); continue; }
    sameTap = false;
    let sAt = 0, cmAt = 0;
    for (let j = Math.max(0, k - 2); j <= Math.min(k, na - 1); j++) sAt = Math.max(sAt, x.tap.S[(a.a + j) * 2], x.tap.S[(a.a + j) * 2 + 1], x.tap.w[(a.a + j) * 2], x.tap.w[(a.a + j) * 2 + 1]);
    for (let j = Math.max(0, k - 2); j <= Math.min(k, nb - 1); j++) cmAt |= y.tap.cm[(b.a + j) * 2] | y.tap.cm[(b.a + j) * 2 + 1];
    const cls = kind === 'ref' ? 'refDiff' : sAt > 0 ? 'misclass' : 'leak';
    res.push({ round: id, cls, step: k, S: +sAt.toFixed(4), cmBase: !!cmAt, Smax });
  }
  const bad = res.filter((r) => r.cls === 'leak' || r.cls === 'missing' || r.cls === 'refDiff');
  const verdict = bad.length ? 'FAIL' : sameStdout && sameTap ? 'IDENTICAL' : res.every((r) => r.cls === 'same') && !sameStdout ? 'FAIL' : 'CLASSIFIED';
  return { verdict, sameStdout, sameTap, rounds: res, stdoutOnly: !sameStdout && res.every((r) => r.cls === 'same') };
}

// ── 일 목록 ──
const jobs = [];
for (const b of BATS) {
  if (b === 'arm')
    for (const hz of [60, 120].filter((h) => !QUICK || h === 60))
      for (const weapon of WEAPONS) jobs.push({ battery: 'arm', label: `arm in${hz} ${weapon}`, hz, weapon, fingers: true });
  if (b === 'live') for (const hz of HZS) jobs.push({ battery: 'live', label: `live_battery ${hz}Hz`, hz, script: 'live_battery.mjs', fingers: true });
  if (b === 'dance') for (const hz of HZS) jobs.push({ battery: 'dance', label: `dance ${hz}Hz`, hz, script: 'dance.mjs', fingers: true });
  if (b === 'fights') for (const hz of HZS) for (const s of SEEDS) jobs.push({ battery: 'fights', label: `fights12 SEED0=${s} ${hz}Hz`, hz, script: 'fights12.mjs', env: { SEED0: String(s) }, fingers: false });
}
const results = [];
let fail = 0;
const log = (s) => console.log(s);
log(`s0_diff  뿌리 ${ROOT0}${REF ? `  ref ${REF}` : ''}  묶음 ${BATS.join(',')}  Hz ${HZS.join(',')} (arm = 입력 Hz 60/120·물리 120, 나머지 = 물리 Hz)  무기 ${WEAPONS.join(',')} (arm 만 고름)  입력 방식 ${GINPUTS.join(',')}  mixX ${MIXX}  out ${OUT}`);
for (const J of jobs) {
  const mk = (build, gin, ref) => ({ ...J, sets: [...(ref && build === 'B' ? REF_B : BUILDS[build]), ...(build === 'new' ? ginSet(gin) : []), ...(J.battery === 'arm' ? [] : dtSet(J.hz))] });
  const tagOf = (build, gin, ref) => `${J.label.replace(/[^A-Za-z0-9=.]+/g, '_')}_${build}${build === 'new' ? '_' + gin : ''}${ref ? '_ref' : ''}`;
  const gins = J.fingers ? GINPUTS : ['wind'];
  const row = { job: J.label, battery: J.battery, hz: J.hz, weapon: J.weapon ?? 'longsword', cmp: [] };
  const mine = {}; // 이 체크아웃에서 이미 돈 것 (ref 견줌에 다시 쓴다)
  if (!REF_ONLY) {
    const B = (mine.B = run(ROOT0, mk('B'), tagOf('B')));
    row.shaB = B.sha;
    for (const g of gins) {
      const N = run(ROOT0, mk('new', g), tagOf('new', g));
      if (g === 'wind') mine.new = N;
      {
        const c = compare(N, B, 'B');
        row.cmp.push({ vs: 'B', ginput: g, shaNew: N.sha, ...c });
        if (c.verdict === 'FAIL') fail++;
      }
      if (J.battery === 'arm') {
        const ids = N.out.trim().split('\n').map((l) => JSON.parse(l).id);
        const rr = rounds(N.tap);
        const per = [...rr.entries()].map(([id, r]) => {
          let m = 0;
          for (let j = r.a; j <= r.b; j++) m = Math.max(m, N.tap.S[j * 2]);
          return { id: ids[id], Smax: +m.toFixed(4) };
        });
        row.misclass ||= {};
        row.misclass[g] = { n: per.length, ids: per.map((p) => p.id), sGeMixX: per.filter((p) => p.Smax >= MIXX).map((p) => p.id), sPos: per.filter((p) => p.Smax > 0).map((p) => `${p.id}(${p.Smax})`) };
      }
      log(`${J.label.padEnd(26)} ${g.padEnd(6)} new ${N.sha.slice(0, 8)} B ${B.sha.slice(0, 8)}  ` + row.cmp.filter((c) => c.ginput === g).map((c) => `vs ${c.vs}: ${c.verdict}${c.verdict !== 'IDENTICAL' ? ` (${summ(c)})` : ''}`).join('  ') + `  (${N.s} s)`);
    }
  }
  if (REF) {
    for (const [build, g] of [['new', 'wind'], ['B']]) {
      const X = mine[build] ?? run(ROOT0, mk(build, g), tagOf(build, g) + '_x');
      const Y = run(REF, mk(build, g, true), tagOf(build, g, true));
      const c = compare(X, Y, 'ref');
      row.cmp.push({ vs: `ref:${build}`, ginput: g ?? null, shaNew: X.sha, shaRef: Y.sha, ...c });
      if (c.verdict !== 'IDENTICAL') fail++;
      log(`${J.label.padEnd(26)} ref ${build.padEnd(4)} ${X.sha.slice(0, 8)} vs ${Y.sha.slice(0, 8)}  ${c.verdict === 'IDENTICAL' ? 'IDENTICAL' : 'FAIL (' + summ(c) + ')'}`);
    }
  }
  results.push(row);
}
function summ(c) {
  const k = {};
  for (const r of c.rounds) if (r.cls !== 'same') k[r.cls] = (k[r.cls] || 0) + 1;
  const first = c.rounds.find((r) => r.cls !== 'same');
  return `${Object.entries(k).map(([a, b]) => `${a} ${b}`).join(', ') || (c.stdoutOnly ? '표준 출력만 다름' : '')}${first ? `; 첫 판 ${first.round} 스텝 ${first.step} S ${first.S}` : ''}`;
}

// ── arm 오분류 비율 (S ≥ mixX 인 입력 / 전체), 관문 ≤ 3 % ──
const mis = {};
for (const g of GINPUTS) {
  let n = 0, k = 0;
  const who = [];
  for (const r of results) if (r.misclass?.[g]) (n += r.misclass[g].n), (k += r.misclass[g].sGeMixX.length), who.push(...r.misclass[g].sGeMixX.map((x) => `${r.job}:${x}`));
  // 관문 = 쟁기에서 시작한 입력 (명세 §7 'pflug-stroke set': 쟁기 8 방향 0.1 m 획·쟁기 떨림·쟁기 → 자세 바꾸기). 전체 비율은 보고
  const isPflug = (id) => /^(small|Pflug->|jitter@0\.18,-0\.28)/.test(id.split(':').pop());
  let np = 0;
  for (const r of results) if (r.misclass?.[g]) np += r.misclass[g].ids.filter(isPflug).length;
  const kp = who.filter(isPflug).length;
  if (n) mis[g] = { n, k, pct: +((100 * k) / n).toFixed(1), pflugN: np, pflugK: kp, pflugPct: np ? +((100 * kp) / np).toFixed(1) : null, pass: np ? kp / np <= 0.03 : true, who };
}

// ── 깃발 끈 판 = main sha, 기본 AI 판 = 기준 sha (wbs_baselines.md 를 지금 읽는다) ──
const shaChecks = [];
if (MAIN) {
  const doc = fs.readFileSync(path.join(ROOT0, 'docs/strike/wbs_baselines.md'), 'utf8');
  const want = {};
  for (const m of doc.matchAll(/^- `([0-9a-f]{64})` (.+)$/gm)) want[m[2].trim()] = m[1];
  const MF = ['WHOLE.on=false', 'GESTURE.on=false', 'DRIVE.on=false', 'ARM.lead=false', 'ARM.rawSwing=false', 'ARM.leashSkip=false', 'ARM.holdSpeedFinger=0.3'];
  const cases = [
    { name: '깃발 끈 판 fights12 (§3)', sets: MF, script: 'fights12.mjs', env: { R0_OFF: '1' }, want: want['fights12 = main'] },
    { name: '깃발 끈 판 hybrid fights12 (§3)', sets: MF, script: 'hybrid.mjs', args: ['fights12.mjs'], env: { R0_OFF: '1' }, want: want['fights12 = main'] },
    { name: '깃발 끈 판 live_battery (§3)', sets: MF, script: 'live_battery.mjs', env: { R0_OFF: '1' }, want: want['live_battery = main'] },
    { name: 'WHOLE.on=false 손짓·드라이브 켬 fights12 (§3)', sets: ['WHOLE.on=false'], script: 'fights12.mjs', env: { R0_OFF: '1' }, want: want['fights12 = main'] },
    { name: 'WHOLE.on=false 손짓·드라이브 켬 live_battery (§3)', sets: ['WHOLE.on=false'], script: 'live_battery.mjs', env: { R0_OFF: '1' }, want: want['live_battery = main'] },
    { name: '기본 fights12 (§1)', sets: [], script: 'fights12.mjs', want: want['fights12 기본'] },
    { name: '기본 live_battery (§1)', sets: [], script: 'live_battery.mjs', want: want['live_battery 기본'] },
  ];
  for (const c of cases) {
    const r = run(ROOT0, { battery: 'main', ...c }, `main_${c.name.replace(/[^A-Za-z0-9=.]+/g, '_')}`);
    const ok = !!c.want && r.sha === c.want;
    if (!ok) fail++;
    shaChecks.push({ name: c.name, sha: r.sha, want: c.want ?? null, pass: ok });
    log(`${c.name.padEnd(44)} ${r.sha.slice(0, 8)} = ${c.want ? c.want.slice(0, 8) : '(문서에 없음)'} → ${ok ? 'PASS' : 'FAIL'}`);
  }
}

// ── 요약 ──
const misFail = Object.values(mis).some((m) => !m.pass);
const verdict = fail ? 'FAIL' : 'PASS'; // S = 0 불변 (샘·ref·sha). 오분류 관문은 따로 (Gesture 줄, 끝 코드에 넣지 않는다)
const classified = [];
for (const r of results) for (const c of r.cmp) for (const q of c.rounds) if (q.cls !== 'same') classified.push({ job: r.job, vs: c.vs, ginput: c.ginput, ...q });
const md = [];
md.push(`# s0_diff (${new Date().toISOString()}, ${((Date.now() - t00) / 1000).toFixed(0)} s)`, '');
md.push(`뿌리 \`${ROOT0}\`${REF ? `, ref \`${REF}\` (ref 기준 B: ${REF_B.join(' ')})` : ''}. Hz: arm = 입력 Hz (물리 120), live·dance·fights = 물리 Hz. 무기: arm 만 ${WEAPONS.join('·')}, 나머지 롱소드 (고를 수 없음).`, '');
md.push('| 묶음 | 입력 방식 | vs | 판정 | 표준 출력 | 탭 | 가름 |', '|---|---|---|---|---|---|---|');
for (const r of results) for (const c of r.cmp) md.push(`| ${r.job} | ${c.ginput ?? '-'} | ${c.vs} | ${c.verdict} | ${c.sameStdout ? '같음' : '다름'} | ${c.sameTap ? '같음' : '다름'} | ${c.verdict === 'IDENTICAL' ? '' : summ(c)} |`);
if (Object.keys(mis).length) {
  md.push('', '| arm 오분류 (S ≥ mixX) | 쟁기 시작 입력 | S ≥ mixX | 비율 (관문 ≤ 3 %) | 전체 입력 | S ≥ mixX | 비율 (보고) |', '|---|---|---|---|---|---|---|');
  for (const [g, m] of Object.entries(mis)) md.push(`| ${g} | ${m.pflugN} | ${m.pflugK} | ${m.pflugPct} % ${m.pass ? 'PASS' : 'FAIL'} | ${m.n} | ${m.k} | ${m.pct} % |`);
}
if (shaChecks.length) {
  md.push('', '| sha 확인 | sha | 문서 | 판정 |', '|---|---|---|---|');
  for (const s of shaChecks) md.push(`| ${s.name} | \`${s.sha.slice(0, 8)}\` | \`${(s.want || '').slice(0, 8)}\` | ${s.pass ? 'PASS' : 'FAIL'} |`);
}
md.push('', `**S = 0: ${verdict}** (샘·ref 차이·sha 어긋남 ${fail}) · 오분류 관문 (§8.2 Gesture 줄): ${Object.keys(mis).length ? (misFail ? 'FAIL' : 'PASS') : '-'}`);
const inputsList = BATS.includes('arm') ? JSON.parse(spawnSync(process.execPath, [path.join(HERE, 's0_diff.mjs'), '--child=arm', '--list'], { cwd: ROOT0, encoding: 'utf8', env: { ...process.env, QUIET_ATLAS: '1' } }).stdout) : [];
fs.writeFileSync(path.join(OUT, 's0_diff.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 's0_diff.json'), JSON.stringify({ format: 's0-diff/1', root: ROOT0, ref: REF, batteries: BATS, hz: HZS, weapons: WEAPONS, ginput: GINPUTS, seeds: SEEDS, mixX: MIXX, inputs: inputsList, verdict, fail, misclass: mis, misclassPass: !misFail, shaChecks, classified, results: results.map((r) => ({ ...r, cmp: r.cmp.map((c) => ({ ...c, rounds: c.rounds.filter((q) => q.cls !== 'same') })) })), elapsed_s: Math.round((Date.now() - t00) / 1000) }, null, 1));
log('');
log(md.join('\n'));
log(`\njson ${path.join(OUT, 's0_diff.json')}`);
process.exit(verdict === 'PASS' ? 0 : 1);
