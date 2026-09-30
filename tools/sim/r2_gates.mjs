// R2 관문 한 벌 (docs/strike/r2_impl_spec.md §8.2 표 차례, §9 W5). 하위 도구를 하나씩 (nice) 돌리고 줄마다 PASS/FAIL (최소 목표에만) 을 적는다
//
//   node tools/sim/r2_gates.mjs [--hz=60,120] [--weapons=longsword,zweihander,sabre] [--input=wind,stroke] [--quick] [--out=<폴더>]
//        [--r1=<R1 체크아웃>] [--s0-ref=<체크아웃>] [--ai-min=10] [--skip=s0,ai,perf,...] [--set=GRP.key=val ...]
//  --s0-ref = s0_diff --ref (옛 결심 경로 지우기 전 체크아웃과 바이트 견줌, §7-8 checkout 방식)
//
//  빠르기·에너지 비·걸음 착지 분포는 보고만 (위쪽 관문 없음). 도구는 재기만 한다 (자르기·한도 없음)
//  Hz 뜻 (줄마다 'Hz' 칸): 입력 = 화면(손가락) 프레임 Hz, 물리는 게임과 같은 120 · 물리 = PHYSICS.timestep (AI 끼리처럼 손가락이 없는 줄) · J = 24–45 fps 흔들림
//  --quick = 롱소드·입력 60 Hz·v 12 (기준 (1)·되돌아감·걸음), s0_diff --quick, AI 1 분, perf 짧게
//  기준 (1) '맨 팔 베기보다 약하지 않다': 짝 (무리, air/hit, 입력 Hz, v, 무기, 입력 방식) 마다 game (설정 그대로) 대 plain (같은 커밋 DRIVE.on=false,
//   둘 다 게임 설정). 칼끝 최고 ≥ 0.95×, 맨 팔이 상처를 냈으면 첫 상처 J ≥ 0.95× 그리고 때 ≤ 맨 팔/0.95,
//   air 는 칼끝 최고 때 ≤ 맨 팔/0.95, 값이 없으면 빠짐 (짝 한쪽 없음·칼끝 최고가 베기 창 끝 (peakAtEdge)·하위 실행 실패도 빠짐). 관문 = chainW (감기 3 m/s, 머묾 0) 행, hold (1.2 m/s + 1 s) 행은 따로 보고
//  결과: <out>/r2_gates.md, r2_gates.json, 하위 도구 출력 (기본 out = 임시 폴더, 저장소에 쓰지 않는다)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const a = argv.find((s) => s === `--${k}` || s.startsWith(`--${k}=`));
  return a == null ? d : a.includes('=') ? a.slice(k.length + 3) : true;
};
const list = (k, d) => String(arg(k, d)).split(',').filter(Boolean);
// --set=GRP.key=val (여러 번): chain.mjs 하위 실행에만 넘긴다 (게임 설정 바꿔 보기. game 행만 뜻, plain 은 DRIVE.on=false)
const SETS = argv.filter((s) => s.startsWith('--set='));

// ═════════════ 아이: AI 끼리 긴 판 (--child=ai, 뿌리 = R2_ROOT) ═════════════
if (arg('child') === 'ai') {
  const R = path.resolve(process.env.R2_ROOT || ROOT);
  const CONFIG = await import(pathToFileURL(path.join(R, 'src/config.js')).href);
  const hz = +arg('hz', 120);
  CONFIG.PHYSICS.timestep = 1 / hz;
  const H = await import(pathToFileURL(path.join(R, 'tools/sim/harness_m.mjs')).href);
  const { newRound, DT, AI } = H;
  const weapon = arg('weapon', 'longsword');
  const steps = Math.round((+arg('minutes', 10) * 60) / DT);
  const o = { hz, weapon, minutes: +arg('minutes', 10), steps, rounds: 0, nan: 0, glitch: 0, falls: 0, deaths: 0, hits: 0, clashes: 0, strikes: 0, errors: 0 };
  let seed = 1, G = null, prev = null, ph = null;
  const fresh = () => {
    if (G) (o.glitch += G.combat.glitchDrops || 0), (o.clashes += G.clashes || 0), (o.hits += G.wounds.length);
    G = newRound({ seed: seed++, weapon, weapon2: weapon, AI2Class: AI });
    G.player.skill.level = 0.7;
    o.rounds++;
    prev = { P: 'stand', E: 'stand' };
    ph = { P: null, E: null };
  };
  for (let i = 0; i < steps; i++) {
    if (!G || !G.player.alive || !G.enemy.alive || G.t > 45) {
      if (G && (!G.player.alive || !G.enemy.alive)) o.deaths++;
      fresh();
    }
    try {
      G.step();
    } catch (e) {
      o.errors++;
      G = null;
      continue;
    }
    for (const [k, f, ai] of [['P', G.player, G.ai2], ['E', G.enemy, G.ai]]) {
      if (prev[k] === 'stand' && (f.state === 'down' || f.state === 'getup')) o.falls++;
      prev[k] = f.state;
      const p = ai?.mode === 'attack' ? ai.phase : null;
      if (p === 'strike' && ph[k] !== 'strike') o.strikes++;
      ph[k] = p;
      const c = f.bodies.chest.translation(), s = f.sword.translation();
      if (![c.x, c.y, c.z, s.x, s.y, s.z].every(Number.isFinite)) {
        o.nan++;
        G = null;
        break;
      }
    }
  }
  if (G) (o.glitch += G.combat.glitchDrops || 0), (o.clashes += G.clashes || 0), (o.hits += G.wounds.length);
  o.fallsPerMin = +(o.falls / o.minutes).toFixed(2);
  console.log(JSON.stringify(o));
  process.exit(0);
}

// ═════════════ 아이: 추적·빈 손짓 비용 (--child=perf) ═════════════
if (arg('child') === 'perf') {
  const CONFIG = await import(pathToFileURL(path.join(ROOT, 'src/config.js')).href);
  CONFIG.BODY.weightMode = 'hybrid';
  const H = await import(pathToFileURL(path.join(ROOT, 'tools/sim/harness_m.mjs')).href);
  const { newRound, DT, AI, atlas } = H;
  const { ClipDrive } = await import(pathToFileURL(path.join(ROOT, 'src/strike/drive_arm.js')).href);
  const { Gesture } = await import(pathToFileURL(path.join(ROOT, 'src/strike/gesture.js')).href);
  // 드라이브 메서드 전부를 깊이 0 에서만 잰다 (안쪽 부름은 겹쳐 세지 않는다)
  let depth = 0, tDrive = 0;
  for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(ClipDrive.prototype))) {
    if (k === 'constructor' || typeof d.value !== 'function') continue;
    const fn = d.value;
    ClipDrive.prototype[k] = function (...a) {
      if (depth++ === 0) {
        const t0 = performance.now();
        try { return fn.apply(this, a); } finally { tDrive += performance.now() - t0; depth--; }
      }
      try { return fn.apply(this, a); } finally { depth--; }
    };
  }
  let tGes = 0, nGes = 0;
  const gu = Gesture.prototype.update;
  Gesture.prototype.update = function (...a) {
    if (this.srcKind !== 0 || this.f?.index !== 1) return gu.apply(this, a);
    const t0 = performance.now();
    try { return gu.apply(this, a); } finally { tGes += performance.now() - t0; nGes++; }
  };
  const reps = +arg('reps', 3);
  // (a) 추적: 짜 놓은 위상 S 1 클립 빠르기, 네 베기 × reps — 드라이브 w > 0 스텝당 드라이브 시간
  let nTrack = 0;
  const cuts = ['zornhau', 'oberhau', 'mittelhau', 'unterhau'];
  for (let r = 0; r < reps; r++)
    for (const cut of cuts) {
      const G = newRound({ seed: 1, gap: 1.8, walls: false });
      G.ai.update = () => {};
      const P = G.player, D = P.drive;
      P.handOffset.set(0.18, -0.28);
      for (let i = 0; i < 1.0 / DT; i++) G.step();
      const T = atlas.marks(cut, 'right', 1);
      tDrive = 0;
      let n = 0;
      for (let t = 0; t <= T[5] + 1e-9; t += DT) {
        D.script(atlas.phiAt(cut, 'right', t, 1), 1, cut, 'right');
        G.step();
        if (D.w > 0) n++;
      }
      D.script(null);
      if (r > 0) (nTrack += n), (globalThis.__tTrack = (globalThis.__tTrack || 0) + tDrive); // 첫 벌은 데우기
    }
  // (b) 손가락 없는 상대 손짓 (AI 끼리): 부름당 µs
  const G = newRound({ seed: 5, AI2Class: AI });
  for (let i = 0; i < Math.round(+arg('aiSec', 30) / DT); i++) G.step();
  console.log(JSON.stringify({ trackMsPerStep: +((globalThis.__tTrack || 0) / Math.max(1, nTrack)).toFixed(4), trackSteps: nTrack, gestureNoSourceUsPerCall: +((1000 * tGes) / Math.max(1, nGes)).toFixed(3), gestureCalls: nGes, handsDefault: CONFIG.DRIVE.hands }));
  process.exit(0);
}

// ═════════════ 부모 ═════════════
const QUICK = !!arg('quick', false);
const HZS = list('hz', QUICK ? '60' : '60,120').map(Number);
const WEAPONS = list('weapons', QUICK ? 'longsword' : 'longsword,zweihander,sabre');
const GINPUTS = list('input', 'wind,stroke');
const VS = QUICK ? [12] : [3, 6, 12, 20]; // 기준 (1) 손가락 빠르기
const VSTEP = QUICK ? [12] : [3, 4, 6, 12, 20]; // chainW 격자 (걸음 착지 분포 SPEED=4,6,12,20 도 여기서)
const FAMS = ['horizR', 'diagR', 'vert', 'riseR'];
const OUT = path.resolve(arg('out', fs.mkdtempSync(path.join(os.tmpdir(), 'r2_gates_'))));
const R1 = arg('r1', null) ? path.resolve(arg('r1')) : null;
const AIMIN = +arg('ai-min', QUICK ? 1 : 10);
const SKIP = new Set(list('skip', ''));
fs.mkdirSync(OUT, { recursive: true });
const t00 = Date.now();
const rows = [];
const J = { meta: { root: ROOT, hz: HZS, weapons: WEAPONS, input: GINPUTS, v: VS, quick: QUICK, r1: R1, aiMinutes: AIMIN, started: new Date().toISOString() }, rows, raw: {} };
const rev = spawnSync('git', ['-C', ROOT, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const dirty = spawnSync('git', ['-C', ROOT, 'status', '--porcelain', '--', 'src'], { encoding: 'utf8' }).stdout.trim() ? '+src 고침' : '';
J.meta.rev = rev + dirty;
J.meta.sets = SETS.map((x) => x.slice(6));
const say = (s) => console.log(s);
say(`r2_gates  ${ROOT} ${rev}${dirty}  Hz ${HZS.join(',')}  무기 ${WEAPONS.join(',')}  입력 방식 ${GINPUTS.join(',')}  v ${VS.join(',')}${QUICK ? '  (quick)' : ''}  out ${OUT}`);

/** 하위 도구 (nice, 차례로). 출력은 <out>/<name>.out/.err */
function sub(name, args, { env = {}, cwd = ROOT, allowFail = true } = {}) {
  const t0 = Date.now();
  const r = spawnSync('nice', ['-n', '10', process.execPath, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8', maxBuffer: 1 << 30 });
  fs.writeFileSync(path.join(OUT, `${name}.out`), r.stdout || '');
  fs.writeFileSync(path.join(OUT, `${name}.err`), r.stderr || '');
  const s = +((Date.now() - t0) / 1000).toFixed(1);
  say(`  · ${name} (${s} s, 끝 ${r.status})`);
  if (r.status !== 0 && !allowFail) throw new Error(`${name} 실패: ${(r.stderr || '').slice(-600)}`);
  return { out: r.stdout || '', err: r.stderr || '', status: r.status, s };
}
const add = (gate, hz, number, target, pass, detail = null) => rows.push({ gate, hz, number, target, result: pass == null ? '보고' : pass ? 'PASS' : 'FAIL', detail });
const SIM = (f) => path.join(HERE, f);
const pct = (a, b) => (b ? +((100 * a) / b).toFixed(1) : null);
const qq = (a, p) => { const b = a.filter((x) => x != null && Number.isFinite(x)).sort((x, y) => x - y); return b.length ? b[Math.min(b.length - 1, Math.floor(p * (b.length - 1) + 0.5))] : null; };

// ── Atlas ──
if (!SKIP.has('atlas')) {
  const r = sub('atlas_check', ['--expose-gc', SIM('atlas_check.mjs')]);
  const ok = r.status === 0 && /모두 통과/.test(r.out);
  const fails = (r.out.match(/^\s*FAIL .*/gm) || []).slice(0, 5);
  const dec = (r.err + r.out).match(/decode[^\n]*?([\d.]+) ms/);
  add('Atlas (24 클립 검사·조각 던짐·guards ≤ 0.02 m·C⁰/C¹·표본 ≤ 0.05 ms)', '-', `모두 통과 ${ok}${dec ? `, 묶음 읽기 ${dec[1]} ms` : ''}`, 'atlas_check 모두 통과', ok, fails.join(' | ') || null);
}
// ── Puppet ──
if (!SKIP.has('puppet')) {
  const r = sub('puppet', [SIM('puppet.mjs'), '--cuts=zornhau,oberhau,mittelhau,unterhau', '--sides=right,left', '--sizes=small,medium,large']);
  const g = r.out.match(/GATE puppet[^\n]*/);
  const s = r.out.match(/^summary (.*)$/m);
  const sm = s ? JSON.parse(s[1]) : {};
  add('Puppet (운동학, 손 ≤ 0.03 m·칼 ≤ 5°·칼끝 ≤ 0.05 m·부호 넷)', '- (물리 없음)', `${sm.pass}/${sm.clips}, 손 최대 ${sm.handMaxWorst} m, 칼 평균 ${sm.swordMeanWorst}°, 칼끝 ${sm.tipMeanWorst} m`, '24/24·부호 PASS', !!g && /PASS/.test(g[0]), g ? g[0] : null);
}
// ── Gesture ──
if (!SKIP.has('gesture'))
  for (const gi of GINPUTS) {
    const r = sub(`gesture_${gi}`, [SIM('gesture_eval.mjs'), `--input=${gi}`, `--out=${path.join(OUT, `gesture_${gi}.json`)}`]);
    const m = r.out.match(/=== GESTURE\.input = '(\w+)' — (PASS|FAIL) ===/);
    const bad = (r.out.match(/^FAIL .*/gm) || []).slice(0, 4);
    add(`Gesture (${gi}: 꺾임 지연·Hz 같은 φ̇·떨림 S 0·snap·busy)`, '입력 60/90/120 (도구 안)', m ? m[2] : '출력 없음', '최소 목표 모두', !!m && m[2] === 'PASS', bad.join(' | ') || null);
  }
// ── S = 0 (s0_diff) ──
if (!SKIP.has('s0')) {
  const a = [SIM('s0_diff.mjs'), `--out=${path.join(OUT, 's0')}`, `--ginput=${GINPUTS.join(',')}`];
  const S0REF = arg('s0-ref', null);
  if (S0REF) a.push(`--ref=${path.resolve(S0REF)}`);
  if (QUICK) a.push('--quick');
  else a.push(`--hz=${[120, 60].join(',')}`, `--weapons=${WEAPONS.join(',')}`);
  fs.rmSync(path.join(OUT, 's0', 's0_diff.json'), { force: true }); // 끊긴 실행이 앞선 json 을 읽지 않게
  const r = sub('s0_diff', a);
  let js = null;
  try { js = JSON.parse(fs.readFileSync(path.join(OUT, 's0', 's0_diff.json'), 'utf8')); } catch {}
  J.raw.s0 = js ? { verdict: js.verdict, fail: js.fail, misclass: js.misclass, shaChecks: js.shaChecks, classifiedCount: js.classified.length } : null;
  const leaks = js ? js.classified.filter((c) => c.cls === 'leak').length : null;
  const refDiff = js ? js.results.reduce((n, r) => n + r.cmp.filter((c) => String(c.vs).startsWith('ref:') && c.verdict !== 'IDENTICAL').length, 0) : null;
  const refN = js ? js.results.reduce((n, r) => n + r.cmp.filter((c) => String(c.vs).startsWith('ref:')).length, 0) : 0;
  const mis = js ? Object.entries(js.misclass).map(([g, m]) => `${g} 쟁기 ${m.pflugK}/${m.pflugN} (${m.pflugPct} %), 전체 ${m.k}/${m.n}`).join('; ') : '';
  add(`S = 0 (§7: new = 기준 B (GESTURE.on=false) 바이트${S0REF ? '; checkout 견줌 = 옛 경로 지우기 전 new·B 바이트' : ''}; 깃발 끈 판 = main sha)`, 'arm = 입력 60/120, AI 판 = 물리 120/60', js ? `샘 ${leaks}${S0REF ? `, ref 다름 ${refDiff}/${refN}` : ''}, sha ${js.shaChecks.filter((s) => s.pass).length}/${js.shaChecks.length}` : `끝 ${r.status}`, `S = 0 샘 0${S0REF ? '·ref 모두 같음' : ''}, sha 모두 같음`, js ? js.fail === 0 : false);
  if (js) add('Gesture 오분류 (arm 묶음 쟁기 시작 입력에서 S ≥ mixX)', '입력 60/120', mis, '≤ 3 %', Object.values(js.misclass).every((m) => m.pass));
}
// ── chain.mjs 묶음 (latency · mx · pace) ──
let latJ = null, mxJ = null;
if (!SKIP.has('latency')) {
  const f = path.join(OUT, 'chain_latency.json');
  fs.rmSync(f, { force: true });
  const rl = sub('chain_latency', [SIM('chain.mjs'), ...SETS, 'zornhau-wind', '--blocks=latency', `--input=${HZS.join(',')}`, '--jitter', `--ginput=${GINPUTS.join(',')}`, `--weapon=${WEAPONS.join(',')}`, '--no-channels', `--out=${path.join(OUT, 'rec')}`, `--json=${f}`]);
  try { latJ = JSON.parse(fs.readFileSync(f, 'utf8')).blocks.latency; } catch {}
  if (!latJ) add('감기가 손가락을 따름 (chain_latency)', `입력 ${HZS.join('/')}`, `json 없음 (끝 ${rl.status})`, '실행 끝 0', false);
}
if (latJ) {
  const g = latJ.filter((r) => r.gate_ms != null);
  const worst = (hz) => { const a = g.filter((r) => r.inputHz === hz); return a.length ? a.map((r) => r.pelvis5_ms ?? '없음').join('/') : null; };
  for (const hz of HZS) add(`감기가 손가락을 따름 (0.3 m / 50 ms 걸음 → 골반 5°, game)`, `입력 ${hz}`, `골반 5° ${worst(hz)} ms (무기·입력 방식별)`, `≤ ${hz === 60 ? 33 : hz === 120 ? 25 : '?'} ms`, g.filter((r) => r.inputHz === hz).every((r) => r.pass));
  const drag = latJ.filter((r) => r.mode === 'game' && r.kind === 'drag');
  add('감기 3 m/s 끌기 → 골반·가슴 5°, S > 0 (보고)', `입력 ${HZS.join('/')}·J`, drag.map((r) => `${r.weapon[0]}${r.inputHz}${r.ginput[0]} ${r.pelvis5_ms ?? '-'}/${r.chest5_ms ?? '-'}/${r.S0_ms ?? '-'}`).join(' '), '-', null);
}
if (!SKIP.has('mx')) {
  const f = path.join(OUT, 'chain_mx.json');
  fs.rmSync(f, { force: true });
  const rm = sub('chain_mx', [SIM('chain.mjs'), ...SETS, '--blocks=mx,pace', `--weapon=${WEAPONS.join(',')}`, '--no-channels', `--out=${path.join(OUT, 'rec')}`, `--json=${f}`]);
  try { mxJ = JSON.parse(fs.readFileSync(f, 'utf8')).blocks; } catch {}
  if (!mxJ) add('Motion size·Tracking·걸음 착지 (chain_mx)', '물리 120 (입력 없음)', `json 없음 (끝 ${rm.status})`, '실행 끝 0', false);
}
if (mxJ) {
  const ls = mxJ.mx.filter((r) => r.weapon === 'longsword');
  const fl = (r) => Object.entries(r.gates).filter(([, v]) => v === false).map(([k]) => k).join(',');
  add('Motion size (S 1 롱소드 짜 놓은 위상 추적 기록, shape_metrics)', '물리 120 (입력 없음)', ls.map((r) => `${r.cut} ${r.pass ? 'P' : 'F'}${r.pass ? '' : '(' + fl(r) + ')'} 손위 ${r.shape.handTop} 손길 ${r.shape.handPath}`).join('; '), '손 머리 위 +0.05·뒤 0.10·어깨 130°·칼 뒤 1.0·지나가기 −0.30/−0.33·가슴 120°·골반 65°·X 순서·손 길 1.8', ls.length > 0 && ls.every((r) => r.pass));
  add('Tracking (DTW 손 ≤ 0.08 m·칼 ≤ 15°·늦음 ≤ 60 ms)', '물리 120 (입력 없음)', ls.map((r) => `${r.cut} ${r.track ? `${r.track.handMean}/${r.track.swordMeanDeg}°/${r.track.lagMeanMs}` : '-'}`).join('; '), '손 0.08·칼 15°·60 ms', ls.length > 0 && ls.every((r) => r.trackPass));
  const ps = mxJ.paceSummary;
  add('걸음 착지 (짜 놓은 위상 클립 빠르기, 상대 1.6–2.0 m)', '물리 120 (입력 없음)', `tc ± 50 ms 안 ${ps.within50}/${ps.n} (${ps.pct} %), 착지−tc ${[...new Set(mxJ.pace.map((r) => r.landMinusTc_ms))].join('/')} ms, 거절 ${mxJ.pace.reduce((s, r) => s + r.stepRefused, 0)}`, '≥ 80 %', ps.pass);
}

// ── 기준 (1) 격자: chainW (관문)·hold (보고) × game/plain, air·hit, v, 입력 Hz, 무기, 입력 방식 ──
const grid = { W: [], hold: [] };
const gridFail = { W: [], hold: [] }; // 끝이 0 이 아니거나 json 을 못 읽은 하위 실행 (빠짐 = 실패)
let jitRows = [];
if (!SKIP.has('grid')) {
  for (const variant of ['W', 'hold'])
    for (const w of WEAPONS) {
      const f = path.join(OUT, `chain_${variant}_${w}.json`);
      fs.rmSync(f, { force: true });
      const r = sub(`chain_${variant}_${w}`, [SIM('chain.mjs'), ...SETS, `--variant=${variant}`, '--modes=game,plain', '--scenes=air,hit', `--fams=${FAMS.join(',')}`, `--v=${(variant === 'W' ? VSTEP : VS).join(',')}`, `--input=${HZS.join(',')}`, `--ginput=${GINPUTS.join(',')}`, `--weapon=${w}`, '--no-channels', `--out=${path.join(OUT, 'rec')}`, `--json=${f}`]);
      let rs = null;
      if (r.status === 0) try { rs = JSON.parse(fs.readFileSync(f, 'utf8')).rows; } catch {}
      if (rs) grid[variant].push(...rs);
      else gridFail[variant].push(`chain_${variant}_${w} (끝 ${r.status})`);
      if (!J.meta.atlasDecode) J.meta.atlasDecode = (r.err.match(/pack decode ([\d.]+) ms/) || [])[1] ?? null;
    }
  if (!SKIP.has('jitter'))
    for (const w of WEAPONS) {
      const f = path.join(OUT, `chain_J_${w}.json`);
      fs.rmSync(f, { force: true });
      const r = sub(`chain_J_${w}`, [SIM('chain.mjs'), ...SETS, '--variant=W', '--modes=game', '--scenes=air,hit', `--fams=${FAMS.join(',')}`, `--v=${VS.join(',')}`, `--input=${HZS[0]}`, '--jitter', `--ginput=${GINPUTS.join(',')}`, `--weapon=${w}`, '--no-channels', `--out=${path.join(OUT, 'rec')}`, `--json=${f}`]);
      if (r.status === 0) jitRows.push(...JSON.parse(fs.readFileSync(f, 'utf8')).rows.filter((x) => x.inputHz === 'J'));
    }
}
const keyOf = (r) => `${r.fam}/${r.scene}/in${r.inputHz}/v${r.v}/${r.weapon}/${r.ginput}`;
function criterion(rs) {
  const game = new Map(), plain = new Map();
  for (const r of rs) if (VS.includes(r.v)) (r.mode === 'game' ? game : plain).set(keyOf(r), r);
  const items = [];
  const keys = new Set([...game.keys(), ...plain.keys()]);
  for (const k of keys) {
    const g = game.get(k), p = plain.get(k);
    const push = (item, ok, val, ref) => items.push({ key: k, item, ok, game: val, plain: ref });
    if (!g || !p) { push('row', false, g ? '있음' : null, p ? '있음' : null); continue; }
    // 칼끝 최고가 베기 창 끝에 걸린 쪽은 최고를 모른다 → 빠짐 (실패)
    if (g.peakAtEdge || p.peakAtEdge) { push('peakAtEdge', false, g.peakAtEdge ? `창 끝 ${g.tipPeakMs}` : g.tipPeakMs, p.peakAtEdge ? `창 끝 ${p.tipPeakMs}` : p.tipPeakMs); continue; }
    push('tipPeak', g.tipPeak != null && p.tipPeak != null && g.tipPeak >= 0.95 * p.tipPeak, g.tipPeak, p.tipPeak);
    if (p.scene === 'hit' && p.woundJ != null) {
      push('woundJ', g.woundJ != null && g.woundJ >= 0.95 * p.woundJ, g.woundJ, p.woundJ);
      push('woundMs', p.woundMs > 0 && g.woundMs != null && g.woundMs <= p.woundMs / 0.95, g.woundMs, p.woundMs);
    }
    if (p.scene === 'air') push('tipPeakMs', p.tipPeakMs > 0 && g.tipPeakMs != null && g.tipPeakMs <= p.tipPeakMs / 0.95, g.tipPeakMs, p.tipPeakMs);
  }
  const fails = items.filter((x) => !x.ok);
  const failRows = new Set(fails.map((x) => x.key));
  const byFam = {};
  for (const x of fails) { const f = x.key.split('/')[0]; byFam[f] = (byFam[f] || 0) + 1; }
  return { pairs: keys.size, items: items.length, fails: fails.length, failRows: failRows.size, byFam, failList: fails };
}
const crit = { W: criterion(grid.W), hold: criterion(grid.hold) };
J.raw.criterion = { W: { ...crit.W, failList: crit.W.failList }, hold: { ...crit.hold, failList: crit.hold.failList } };
for (const v of ['W', 'hold']) if (gridFail[v].length) add(`기준 (1) chain${v} 실행 실패`, `입력 ${HZS.join('/')}`, gridFail[v].join(', '), '실패 0', false);
if (!SKIP.has('grid') && !grid.W.length) add('기준 (1) chainW: game ≥ 맨 팔', `입력 ${HZS.join('/')}`, '행 없음', '빠짐 0', false);
if (grid.W.length) {
  const c = crit.W;
  add('기준 (1) chainW: game ≥ 맨 팔 (칼끝 최고 0.95×, 첫 상처 J 0.95×·때 /0.95, air 최고 때 /0.95)', `입력 ${HZS.join('/')}`, `빠짐 ${c.fails}/${c.items} 항목, ${c.failRows}/${c.pairs} 짝 (${Object.entries(c.byFam).map(([f, n]) => `${f} ${n}`).join(', ')})`, '빠짐 0', c.fails === 0);
  const h = crit.hold;
  add('기준 (1) hold (1.2 m/s + 1 s 머묾, 보고)', `입력 ${HZS.join('/')}`, `빠짐 ${h.fails}/${h.items} 항목, ${h.failRows}/${h.pairs} 짝 (${Object.entries(h.byFam).map(([f, n]) => `${f} ${n}`).join(', ')})`, '-', null);
  // 되돌아감 (새 정의)
  const gWall = grid.W.filter((r) => r.mode === 'game');
  const gW = gWall.filter((r) => VS.includes(r.v));
  const byV = {};
  for (const r of gW) byV[r.v] = Math.max(byV[r.v] ?? 0, r.hitch ?? 0);
  const hmax = Math.max(...gW.map((r) => r.hitch ?? 0));
  const worstH = gW.reduce((a, r) => ((r.hitch ?? 0) > (a?.hitch ?? -1) ? r : a), null);
  add('되돌아감 (tCut … 몸 위상 tc, 손이 tCut 제 자리로 되돌아가는 빠르기, chainW game)', `입력 ${HZS.join('/')}`, `최고 ${hmax.toFixed(2)} m/s (${worstH ? worstH.key : '-'}); v별 ${Object.entries(byV).map(([v, x]) => `${v}: ${x.toFixed(2)}`).join(', ')}; 원래 값 (앞선 조건 없이) 최고 ${Math.max(...gW.map((r) => r.hitchRaw ?? 0)).toFixed(2)}`, '< 0.5 m/s', hmax < 0.5);
  const gh = grid.hold.filter((r) => r.mode === 'game');
  if (gh.length) add('되돌아감 hold (보고)', `입력 ${HZS.join('/')}`, `최고 ${Math.max(...gh.map((r) => r.hitch ?? 0)).toFixed(2)} m/s`, '-', null);
  // 사슬 순서 (air, game, chainW)
  const air = gW.filter((r) => r.scene === 'air');
  const ord = air.filter((r) => r.order10).length;
  add('사슬 순서 (골반 ≤ 가슴 ≤ 손 ≤ 칼끝 최고, 10 ms 같음; chainW game air)', `입력 ${HZS.join('/')}`, `${ord}/${air.length} 줄`, '모든 줄', ord === air.length);
  // 걸음 착지 분포 (손가락 빠르기별)
  const lv = {};
  for (const r of gWall) (lv[r.v] ||= []).push(r.land?.landMinusTc_ms ?? null);
  add('걸음 착지 − 몸 위상 tc (손가락 빠르기별, chainW game; 물리 swingVmax 가 정함)', `입력 ${HZS.join('/')}`, Object.entries(lv).map(([v, a]) => `v${v}: 가운데 ${qq(a, 0.5)} p90 ${qq(a, 0.9)} ms (딛음 ${a.filter((x) => x != null).length}/${a.length})`).join('; ') + `; 거절 ${gWall.reduce((s, r) => s + (r.stats?.stepRefused ?? 0), 0)}, 발 미끄럼 최고 ${Math.max(...gWall.map((r) => r.stats?.footSlipMax ?? 0)).toFixed(3)} m`, '문턱 없음', null);
  // 60 vs 120 Hz 칼끝 ±3 %, 흔들림
  const g60 = new Map(gW.filter((r) => r.inputHz === 60).map((r) => [`${r.fam}/${r.scene}/v${r.v}/${r.weapon}/${r.ginput}`, r]));
  const devs = [];
  for (const r of gW.filter((x) => x.inputHz === 120)) {
    const a = g60.get(`${r.fam}/${r.scene}/v${r.v}/${r.weapon}/${r.ginput}`);
    if (a && a.tipPeak) devs.push({ key: r.key, d: +((100 * (r.tipPeak - a.tipPeak)) / a.tipPeak).toFixed(1) });
  }
  const jd = [];
  for (const r of jitRows) {
    const a = g60.get(`${r.fam}/${r.scene}/v${r.v}/${r.weapon}/${r.ginput}`);
    if (a && a.tipPeak) jd.push({ key: r.key, d: +((100 * (r.tipPeak - a.tipPeak)) / a.tipPeak).toFixed(1) });
  }
  const in3 = (a) => a.filter((x) => Math.abs(x.d) <= 3).length;
  const mx = (a) => (a.length ? a.reduce((m, x) => (Math.abs(x.d) > Math.abs(m.d) ? x : m)) : null);
  if (devs.length) add('60 ↔ 120 Hz 칼끝 최고 ±3 % (chainW game)', '입력 60 대 120', `${in3(devs)}/${devs.length} 안, 최대 ${mx(devs).d} % (${mx(devs).key})`, '모두 ±3 %', in3(devs) === devs.length);
  if (jd.length) add('흔들림 24–45 fps ↔ 60 Hz 칼끝 최고 ±3 % (chainW game)', 'J 대 입력 60', `${in3(jd)}/${jd.length} 안, 최대 ${mx(jd).d} % (${mx(jd).key})`, '모두 ±3 %', in3(jd) === jd.length);
  J.raw.hz = { devs, jitter: jd };
  // atlasMissing
  // game 행만 (plain 은 드라이브 없이 손짓 S > 0 이라 fighter.js 가 센다 — 도구의 맨 팔 방식 탓, 게임에는 없다)
  const miss = grid.W.concat(grid.hold).filter((r) => r.mode === 'game').reduce((s, r) => s + (r.stats?.atlasMissing ?? 0), 0);
  add('atlasMissing (기준 (1) 격자 game 행)', '-', `${miss}${J.meta.atlasDecode ? `; 묶음 읽기 ${J.meta.atlasDecode} ms (node)` : ''}`, '0', miss === 0);
  // 비 (보고): game/plain 칼끝·tc 운동에너지 (in60 v12 air)
  const pm = new Map(grid.W.filter((r) => r.mode === 'plain').map((r) => [keyOf(r), r]));
  const ratios = gW.filter((r) => r.scene === 'air' && r.v === 12 && r.inputHz === HZS[0]).map((r) => { const p = pm.get(keyOf(r)); return p ? `${r.fam}/${r.weapon[0]}/${r.ginput[0]} ${(r.tipPeak / p.tipPeak).toFixed(2)}/${p.KEatTc_J ? (r.KEatTc_J / p.KEatTc_J).toFixed(2) : '-'}` : null; }).filter(Boolean);
  // 앞먹임 잡음 (보고): chainW game 행의 드라이브 w > 0 스텝 |최고| — 명령 가슴·골반 yaw 각가속도, 몸통 앞먹임 회전력
  const fz = gW.map((r) => r.ffNoise).filter(Boolean);
  const fmax = (k) => (fz.length ? Math.max(...fz.map((x) => x[k] ?? 0)) : null);
  const fmed = (k) => qq(fz.map((x) => x[k] ?? 0), 0.5);
  J.raw.ffNoise = Object.fromEntries(['chestYawDDot', 'pelvisYawDDot', 'ffChest', 'ffAbd', 'ffHip', 'alphaDes'].map((k) => [k, { max: fmax(k), median: fmed(k) }]));
  add('앞먹임 잡음 (chainW game, w > 0 스텝 절댓값 최고: 가슴·골반 yaw 명령 각가속도 rad/s², 몸통 앞먹임 N·m, 보고)', `입력 ${HZS.join('/')}`, `가슴 α 최고 ${fmax('chestYawDDot')} (가운데 ${fmed('chestYawDDot')}), 골반 α ${fmax('pelvisYawDDot')} (${fmed('pelvisYawDDot')}), ffChest ${fmax('ffChest')}, ffAbd ${fmax('ffAbd')}, ffHip ${fmax('ffHip')}, 팔 α_des ${fmax('alphaDes')}; ${fz.length} 행`, '-', null);
  add('빠르기·에너지 비 game/plain (칼끝 최고 / tc 운동에너지, air v12, 보고 — R3 가 ≥ 1.45×·2× 관문)', `입력 ${HZS[0]}`, ratios.join('; '), '-', null);
}

// ── grep 관문: ai.js·ai_sense.js 는 f.strike·f.ges 를 읽지 않는다 ──
if (!SKIP.has('grep')) {
  const bad = [];
  const pat = /\.(strike|ges)\b(?!\s*\()|\[\s*['"`](strike|ges)['"`]\s*\]|\{[^}]*\b(strike|ges)\b[^}]*\}\s*=\s*[A-Za-z_$]|\b(strike|ges)\s*:\s*[A-Za-z_$][\w$]*\s*[,}]/;
  for (const f of ['src/ai.js', 'src/ai_sense.js']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      const code = l.replace(/\/\/.*$/, '');
      if (!pat.test(code)) return;
      if (/\bges\?\.attachSource\(/.test(code) && !/\.strike\b/.test(code)) return; // 허용: 손가락 합성 붙이기 (쓰기만, 출력 안 읽음)
      bad.push(`${f}:${i + 1}: ${l.trim()}`);
    });
  }
  add('grep: ai.js·ai_sense.js 가 f.strike·f.ges 를 읽지 않음 (허용 ges?.attachSource 한 줄)', '-', bad.length ? bad.join(' | ') : '없음', '0 줄', bad.length === 0);
}

// ── 성능 ──
if (!SKIP.has('perf')) {
  const po = path.join(OUT, 'perf_ab.json');
  const r = sub('perf_ab', ['--expose-gc', SIM('perf_ab.mjs'), ...(QUICK ? ['6', '1000'] : ['10', '2000'])], { env: { SWITCH: 'DRIVE.on', OUT: po } });
  let pa = null;
  try { pa = JSON.parse(fs.readFileSync(po, 'utf8')); } catch {}
  const q = sub('perf_child', [SIM('r2_gates.mjs'), '--child=perf', ...(QUICK ? ['--reps=2', '--aiSec=10'] : [])]);
  let pc = null;
  try { pc = JSON.parse(q.out.trim().split('\n').pop()); } catch {}
  J.raw.perf = { perf_ab: pa, child: pc };
  if (pa) {
    const m = pa.time.ratioMean;
    add('성능: 보통 스텝 CPU (AI 끼리, SWITCH=DRIVE.on 켬/끔)', '물리 120', `비 ${m} (95 % ${pa.time.ci95.join('–')}), ${pa.time.msPerStepA}/${pa.time.msPerStepB} ms; THREE 할당 차 ${JSON.stringify(pa.three.diff)}; 힙 ${pa.heap ? pa.heap.diffAB + ' B/스텝 (잡음 ' + pa.heap.noiseBC + ')' : '-'}`, '≤ +10 % (+5 % 넘으면 적음)', m <= 1.1, m > 1.05 ? '+5 % 넘음' : null);
  }
  if (pc) {
    add('성능: 추적 (짜 놓은 위상 S 1, 드라이브 메서드 시간 / w > 0 스텝)', '물리 120', `${pc.trackMsPerStep} ms/스텝 (${pc.trackSteps} 스텝, DRIVE.hands ${pc.handsDefault})`, '≤ 0.05 ms', pc.trackMsPerStep <= 0.05);
    add('성능: 손가락 없는 상대 Gesture.update (보고)', '물리 120', `${pc.gestureNoSourceUsPerCall} µs/부름 (${pc.gestureCalls})`, '≤ 1 µs (보고)', null);
  }
}

// ── AI 끼리 안정 (10 분 × Hz × 무기), 넘어짐 R1 견줌 ──
if (!SKIP.has('ai')) {
  const ai = [];
  for (const hz of [60, 120])
    for (const w of WEAPONS)
      for (const [who, root] of [['R2', ROOT], ...(R1 ? [['R1', R1]] : [])]) {
        const r = sub(`ai_${who}_${hz}_${w}`, [SIM('r2_gates.mjs'), '--child=ai', `--hz=${hz}`, `--weapon=${w}`, `--minutes=${AIMIN}`], { env: { R2_ROOT: root, QUIET_ATLAS: '1' } });
        let o = null;
        try { o = JSON.parse(r.out.trim().split('\n').pop()); } catch {}
        ai.push({ who, hz, weapon: w, ...(o || { error: r.err.slice(-300) }) });
      }
  J.raw.ai = ai;
  for (const hz of [60, 120]) {
    const a = ai.filter((x) => x.who === 'R2' && x.hz === hz), b = ai.filter((x) => x.who === 'R1' && x.hz === hz);
    const nan = a.reduce((s, x) => s + (x.nan ?? 1), 0), gl = a.reduce((s, x) => s + (x.glitch ?? 1), 0), er = a.reduce((s, x) => s + (x.errors ?? 1), 0);
    const fallsOk = b.length ? a.every((x) => { const y = b.find((z) => z.weapon === x.weapon); return y && x.falls <= y.falls; }) : null;
    add(`안정: AI 끼리 ${AIMIN} 분 × 무기 (NaN·튐·오류 0, 넘어짐 ≤ R1)`, `물리 ${hz}`, a.map((x) => { const y = b.find((z) => z.weapon === x.weapon); return `${x.weapon} NaN ${x.nan} 튐 ${x.glitch} 넘어짐 ${x.falls}${y ? ` (R1 ${y.falls})` : ''} 휘두름 ${x.strikes} 상처 ${x.hits} 칼 부딪힘 ${x.clashes} 판 ${x.rounds}`; }).join('; '), 'NaN 0·튐 0·넘어짐 ≤ R1', nan === 0 && gl === 0 && er === 0 && fallsOk !== false, fallsOk == null ? 'R1 체크아웃 없음 (--r1)' : null);
  }
}
add('Owner (보기 도구 화면·A/B 스위치·금빛 자취·사장님 판정)', '-', '이 도구 밖 (W5-C: 기록·화면·시험판)', '사장님 판정', null);

// ── 쓰기 ──
const wall = Math.round((Date.now() - t00) / 1000);
J.meta.wall_s = wall;
const md = [`# R2 관문 (${J.meta.rev}, ${new Date().toISOString()}, 벽시계 ${Math.floor(wall / 60)} 분 ${wall % 60} 초)`, '', `무기 ${WEAPONS.join('·')}, 입력 방식 ${GINPUTS.join('·')}, v ${VS.join('/')} m/s, 입력 Hz ${HZS.join('/')}${QUICK ? ' (quick)' : ''}${SETS.length ? `, chain 설정 ${J.meta.sets.join(' ')}` : ''}. PASS/FAIL 은 최소 목표에만, '보고' 는 관문 없음.`, '', '| 관문 | Hz | 잰 값 | 목표 | 결과 |', '|---|---|---|---|---|'];
for (const r of rows) md.push(`| ${r.gate} | ${r.hz} | ${String(r.number).replace(/\|/g, '/')} | ${r.target} | ${r.result}${r.detail ? ` (${String(r.detail).replace(/\|/g, '/').slice(0, 300)})` : ''} |`);
const nF = rows.filter((r) => r.result === 'FAIL').length, nP = rows.filter((r) => r.result === 'PASS').length;
md.push('', `PASS ${nP}, FAIL ${nF}, 보고 ${rows.length - nP - nF}.`);
if (crit.W.failList?.length) {
  md.push('', '## 기준 (1) chainW 빠진 항목', '', '| 짝 | 항목 | game | plain |', '|---|---|---|---|');
  for (const x of crit.W.failList) md.push(`| ${x.key} | ${x.item} | ${x.game ?? '없음'} | ${x.plain ?? '없음'} |`);
}
fs.writeFileSync(path.join(OUT, 'r2_gates.md'), md.join('\n') + '\n');
fs.writeFileSync(path.join(OUT, 'r2_gates.json'), JSON.stringify(J, null, 1));
say('\n' + md.slice(0, md.indexOf('## 기준 (1) chainW 빠진 항목') > 0 ? md.indexOf('## 기준 (1) chainW 빠진 항목') : md.length).join('\n'));
say(`\nmd ${path.join(OUT, 'r2_gates.md')}  json ${path.join(OUT, 'r2_gates.json')}`);
