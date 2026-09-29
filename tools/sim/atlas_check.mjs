// ─────────────────────────────────────────────────────────────
//  클립 아틀라스 점검 (R2 §4, W1 합격선) — node tools/sim/atlas_check.mjs [--clips=<원본 폴더>] [--pack=src/strike/clips/atlas_v0.json] [--n=100000]
//   1. 원본(clip/2)·묶음(pack/1) 읽기 + 보고 (§4.2 report, §4.6 닿는 거리 표)
//   2. 틀린 입력은 예외여야 한다: 형식·hz·표본 수·채널·NaN·t 단조·표시 순서·phiMarks·phi 지도·단위 벡터·칼 한 표본 각·세 벌 완비·step·자세 id·
//      작은 벌 손 오차·작은 벌 vs guards.js·오른손잡이·묶음 형식·자료 길이·sha1
//   3. 작은 벌 시작·끝 손 vs guards.js ≤ 0.02 m (베기마다)
//   4. 표본 비용 (1e5 번, μs/번, 힙 증가) — 목표 ≤ 0.02 ms, 관문 ≤ 0.05 ms
//   5. 묶음 크기 ≤ 1.5 MB, sha1 = 원본 파일, 되읽은 표본 = 원본 표본
//   6. 보간: 격자 점 일치, d1·d2 = 유한 차분, 칸 경계 C², 방향 단위 길이·ω 일치, S 연속(sizeMid), over 선형(이득 1), 베기 섞기 끝값, 이월 도우미
//   7. 부호표(§4.3): 가슴 틀 = body.mjs frame(), 바라보는 틀 손 = guards.js 손, 게임 yaw = −deg·D2R 이 three.js 의 +Y 회전과 같은 자리를 준다
//  원본 폴더 기본값: ATLAS.clipsDir(../halfsword/docs/motion/clips, 저장소 뿌리 기준), 없으면 docs/motion/clips. 실패가 하나라도 있으면 종료 코드 1
// ─────────────────────────────────────────────────────────────
import { readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { ATLAS, GAIT } from '../../src/config.js';
import { GUARDS, guardAt } from '../../src/guards.js';
import { frame as bodyFrame, m3 as bm3 } from '../motion/lib/body.mjs';
import {
  AtlasError, loadRaw, loadPack, buildAtlas, validateIndex, validateClip, validatePack, resampleClip, makeGrid, makeSample, encodeF32,
  chestFrame, quatFromM3, toFacing, toGame, m3apply, carryOver, angleDeg, defaultClipsDir,
  CH, OFF, WIDTH, OUT_WIDTH, CHANNELS, GUARD_PADS, GUARD_IDS, PHI_MARKS, MARK_NAMES, D2R, R2D, LIN_IDX, DIR_OFFS, tOfPhi, dTdPhi,
} from '../../src/strike/atlas.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const DIR = await defaultClipsDir(ROOT, args);
const PACK = resolve(ROOT, opt('pack', 'src/strike/clips/atlas_v0.json'));
const NCALLS = +opt('n', 100000);
const gates = [];
const gate = (name, ok, detail) => {
  gates.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};
const f3 = (x) => (Math.abs(x) < 1e-3 && x !== 0 ? x.toExponential(1) : (+x).toFixed(3));
const v3s = (a, o = 0) => `[${(+a[o]).toFixed(3)}, ${(+a[o + 1]).toFixed(3)}, ${(+a[o + 2]).toFixed(3)}]`;
const clone = (x) => JSON.parse(JSON.stringify(x));

// ── 1. 읽기 + 보고 ──
console.log(`[atlas_check] 원본 ${DIR}\n[atlas_check] 묶음 ${PACK}`);
let t = performance.now();
const raw = await loadRaw(DIR, { keepRaw: true });
const rawMs = performance.now() - t;
console.log(`\n## 1. 원본 읽기 ${rawMs.toFixed(0)} ms`);
for (const l of raw.reportLines()) console.log(l);
t = performance.now();
const packJson = JSON.parse(readFileSync(PACK, 'utf8'));
const parseMs = performance.now() - t;
t = performance.now();
const packed = await loadPack(packJson);
const packMs = performance.now() - t;
console.log(`\n## 1b. 묶음 읽기: JSON 파싱 ${parseMs.toFixed(0)} ms + 검사·풀기·도함수 ${packMs.toFixed(0)} ms · generated ${packJson.generated} · 클립 ${packed.clips.length}`);

// ── 2. 예외 붙박이 (fixtures) ──
console.log('\n## 2. 틀린 입력은 예외 (AtlasError)');
const rawSmall = raw.index.get('zornhau_right_small').raw;
const rawMedium = raw.index.get('zornhau_right_medium').raw;
const recsOf = (A) => A.clips.map((c) => ({ meta: c.meta, grid: c.grid }));
let fixOk = 0, fixN = 0;
function mustThrow(name, fn, needle) {
  fixN++;
  try {
    fn();
    console.log(`  FAIL  ${name}: 예외 없음`);
  } catch (e) {
    const ok = e instanceof AtlasError && (!needle || e.message.includes(needle));
    if (ok) fixOk++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}: ${e instanceof AtlasError ? e.message : e}`);
  }
}
const mut = (fn) => {
  const c = clone(rawSmall);
  fn(c);
  return () => validateClip(c, { tools: true });
};
const mutM = (fn) => {
  const c = clone(rawMedium);
  fn(c);
  return () => validateClip(c, { tools: true });
};
mustThrow('index.format 이 다름', () => validateIndex({ format: 'stillness-motion-index/2', clips: [{ id: 'x', file: 'x', cut: 'x', side: 'right', size: 'small' }] }), 'format');
mustThrow('clip/1 (format)', mut((c) => (c.format = 'stillness-motion-clip/1')), 'clip/1');
mustThrow('hz 60', mut((c) => (c.hz = 60)), 'hz 60');
mustThrow('handedness left', mut((c) => (c.handedness = 'left')), 'handedness');
mustThrow('data.n ≠ round(tg·hz)+1', mut((c) => (c.marks.tg = 1.1)), 'data.n');
mustThrow('채널 길이 ≠ n·폭', mut((c) => c.data.cols.handS.pop()), '길이');
mustThrow('채널 빠짐 (girdleO)', mut((c) => delete c.data.cols.girdleO), "'girdleO' 없음");
mustThrow('채널 폭 다름 (sword 2)', mut((c) => (c.data.width.sword = 2)), '폭');
mustThrow('NaN', mut((c) => (c.data.cols['chest.yaw'][40] = NaN)), '수가 아님');
mustThrow('Infinity', mut((c) => (c.data.cols.handO[7] = Infinity)), '수가 아님');
mustThrow('t 단조 아님', mut((c) => (c.data.cols.t[50] = c.data.cols.t[49] - 0.001)), '단조');
mustThrow('t 가 hz 격자에서 벗어남', mut((c) => { for (let i = 50; i < c.data.n; i++) c.data.cols.t[i] += 0.002; }), 'Hz 격자');
mustThrow('marks 차례 (tr > tc)', mut((c) => (c.marks.tr = 0.5)), 'marks 차례');
mustThrow('phiMarks 다름 (tc 0.8)', mut((c) => (c.phiMarks.tc = 0.8)), 'phiMarks.tc');
mustThrow('phi 가 표시 지도에서 벗어남', mut((c) => (c.data.cols.phi[60] += 0.01)), 'phi[60]');
mustThrow('sword 가 단위 벡터가 아님', mut((c) => { for (let k = 30; k < 33; k++) c.data.cols.sword[k] *= 1.1; }), '길이');
mustThrow('sword 가 한 표본에 20° 넘게 돎', mut((c) => { const s = c.data.cols.sword; [s[90], s[91], s[92]] = [-s[90], -s[91], -s[92]]; }), 'vecStepMaxDeg');
mustThrow('보통 벌에 step 없음', mutM((c) => (c.step = null)), 'step');
mustThrow('step.from 이 2벡터가 아님', mutM((c) => (c.step.from = [])), 'step');
mustThrow('step.to 원소가 수가 아님', mutM((c) => (c.step.to = [null, 0])), 'step');
mustThrow('step liftPhi > landPhi', mutM((c) => (c.step.liftPhi = 0.9)), 'liftPhi');
mustThrow('step liftPhi 가 φ 범위 밖', mutM((c) => (c.step.liftPhi = 9)), 'liftPhi');
mustThrow('step.liftT 가 수가 아님', mutM((c) => (c.step.liftT = 'x')), 'liftT');
mustThrow('step liftT ≥ landT', mutM((c) => (c.step.liftT = c.step.landT + 0.1)), 'liftT');
mustThrow('recoverTo 가 자세 id 가 아님', mut((c) => (c.recoverTo = 'nebenhut')), 'recoverTo');
mustThrow('startFrom 이 자세 id 가 아님', mut((c) => (c.startFrom = 'zornhut')), 'startFrom');
mustThrow('작은 벌 startPose.handError > 0.02', mut((c) => (c.startPose.handError = 0.03)), 'handError');
mustThrow('세 벌 완비 아님 (large 빠짐)', () => buildAtlas(recsOf(raw).filter((r) => r.meta.id !== 'zornhau_right_large'), { families: ['zornhau'] }), 'large 벌이 없음');
mustThrow('요청한 베기가 없음', () => buildAtlas(recsOf(raw), { families: ['zwerchhau'] }), '클립이 하나도 없음');
mustThrow('작은 벌 시작 손 vs guards.js > 0.02 m', () => {
  const recs = recsOf(raw).map((r) => (r.meta.id === 'zornhau_right_small' ? { meta: r.meta, grid: new Float32Array(r.grid) } : r));
  recs.find((r) => r.meta.id === 'zornhau_right_small').grid[CH.handS] += 0.05;
  buildAtlas(recs, { families: ['zornhau'] });
}, 'guards.js');
mustThrow('묶음 format 다름', () => validatePack({ ...packJson, format: 'stillness-atlas-pack/0' }), 'format');
mustThrow('묶음 sourceFormat 다름', () => validatePack({ ...packJson, sourceFormat: 'stillness-motion-clip/1' }), 'sourceFormat');
mustThrow('묶음 channels 다름', () => validatePack({ ...packJson, channels: packJson.channels.slice(1) }), 'channels');
mustThrow('묶음 자료 길이 ≠ 격자×폭', () => validatePack({ ...packJson, clips: [{ ...packJson.clips[0], data: packJson.clips[0].data.slice(0, -16) }] }), 'data 길이');
mustThrow('묶음 자료에 NaN', () => {
  const g = new Float32Array(packed.grid.n * WIDTH);
  g[123] = NaN;
  validatePack({ ...packJson, clips: [{ ...packJson.clips[0], data: encodeF32(g) }] });
}, '수가 아님');
mustThrow('묶음 marks 차례', () => validatePack({ ...packJson, clips: [{ ...packJson.clips[0], marks: { ...packJson.clips[0].marks, tw: 0.9 } }] }), 'marks 차례');
mustThrow('묶음 sha1 꼴이 아님', () => validatePack({ ...packJson, clips: [{ ...packJson.clips[0], sha1: 'abc' }] }), 'sha1');
mustThrow('묶음 크게 벌에 step 없음', () => validatePack({ ...packJson, clips: [{ ...packJson.clips[2], step: null }] }), 'step');
mustThrow('묶음 step.from 이 2벡터가 아님', () => validatePack({ ...packJson, clips: [{ ...packJson.clips[1], step: { ...packJson.clips[1].step, from: [] } }] }), 'step');
// sha1 ≠ 원본 파일 (둘 다 디스크에 있을 때): 이 도구가 견준다
function checkSha1(pack, dir) {
  for (const c of pack.clips) {
    const p = join(dir, `${c.id}.json`);
    if (!existsSync(p)) throw new AtlasError(c.id, `원본 ${p} 없음`);
    const h = createHash('sha1').update(readFileSync(p)).digest('hex');
    if (h !== c.sha1) throw new AtlasError(c.id, `묶음 sha1 ${c.sha1} ≠ 원본 파일 ${h} — 묶음을 다시 만들어야 한다 (pack_atlas.mjs)`);
  }
}
mustThrow('묶음 sha1 ≠ 원본 파일', () => checkSha1({ clips: [{ ...packJson.clips[0], sha1: '0'.repeat(40) }] }, DIR), 'sha1');
gate('틀린 입력 예외', fixOk === fixN, `${fixOk}/${fixN}`);

// ── 3. 작은 벌 vs guards.js ──
console.log('\n## 3. 작은 벌 시작·끝 손 vs guards.js (바라보는 틀, m) — 베기마다 최대');
let svgMax = 0;
for (const cut of raw.families) {
  const rows = raw.report.smallVsGuards.filter((s) => s.id.startsWith(cut + '_'));
  const mx = Math.max(...rows.flatMap((r) => [r.start, r.end]));
  svgMax = Math.max(svgMax, mx);
  console.log(`  ${cut.padEnd(10)} ${rows.map((r) => `${r.id.replace(cut + '_', '').padEnd(12)} ${r.startFrom}→${r.start.toFixed(4)} ${r.recoverTo}→${r.end.toFixed(4)}`).join(' · ')}  최대 ${mx.toFixed(4)}`);
}
gate('작은 벌 vs guards.js ≤ 0.02 m', svgMax <= ATLAS.smallTol, `최대 ${svgMax.toFixed(4)} m (원본·묶음 같은 격자)`);

// ── 4. 표본 비용 ──
console.log(`\n## 4. 표본 비용 (${NCALLS} 번)`);
const out = makeSample();
const cuts = raw.families, sides = ['right', 'left'];
function bench(A, mode) {
  const req = { cut: 'zornhau', side: 'right', phi: 0, S: 0, over: 0, cutB: null, wAB: 0 };
  const run = (n) => {
    let acc = 0;
    for (let i = 0; i < n; i++) {
      req.cut = cuts[i & 3];
      req.side = sides[(i >> 2) & 1];
      req.phi = -1 + ((i * 0.0137) % 3.2);
      req.S = (i * 0.0071) % 1.0;
      if (mode === 'over') req.S = 1 + ((i * 0.003) % 0.5);
      if (mode === 'fam') {
        req.cutB = cuts[(i + 1) & 3];
        req.wAB = 0.3;
      }
      A.sample(out, req);
      acc += out.v[CH.handS];
    }
    return acc;
  };
  // 바탕: 요청 객체에 같은 수를 쓰기만 (측정 틀 자체의 힙 증가 — 실수를 객체 칸에 쓰면 V8 이 상자를 만들 수 있다)
  const base = (n) => {
    let acc = 0;
    for (let i = 0; i < n; i++) {
      req.phi = -1 + ((i * 0.0137) % 3.2);
      req.S = (i * 0.0071) % 1.0;
      out.phi = req.phi;
      out.S = req.S;
      acc += out.phi;
    }
    return acc;
  };
  run(20000);
  base(20000);
  global.gc?.();
  const hb0 = process.memoryUsage().heapUsed;
  base(NCALLS);
  const hb1 = process.memoryUsage().heapUsed;
  global.gc?.();
  const h0 = process.memoryUsage().heapUsed;
  const t0 = performance.now();
  run(NCALLS);
  const dt = performance.now() - t0;
  const h1 = process.memoryUsage().heapUsed;
  return { us: (dt * 1000) / NCALLS, heapKB: (h1 - h0) / 1024, baseKB: (hb1 - hb0) / 1024 };
}
const bPlain = bench(packed, 'plain'), bOver = bench(packed, 'over'), bFam = bench(packed, 'fam');
console.log(`  묶음 아틀라스: 한 베기 ${bPlain.us.toFixed(3)} μs/번 · over>0 ${bOver.us.toFixed(3)} μs · 두 베기 섞기 ${bFam.us.toFixed(3)} μs`);
console.log(`  힙 증가 (${NCALLS} 번${global.gc ? '' : ', --expose-gc 없이 잰 값'}): 표본 ${bPlain.heapKB.toFixed(0)} kB · 바탕(요청·그릇에 실수 쓰기만) ${bPlain.baseKB.toFixed(0)} kB → 표본 몫 ≈ ${Math.max(0, bPlain.heapKB - bPlain.baseKB).toFixed(0)} kB (${(Math.max(0, bPlain.heapKB - bPlain.baseKB) * 1024 / NCALLS).toFixed(1)} B/번); 배열·객체 새로 만들지 않음`);
gate('표본 비용 ≤ 0.02 ms (관문 ≤ 0.05)', bFam.us <= 50, `한 베기 ${bPlain.us.toFixed(2)} μs · 두 베기 ${bFam.us.toFixed(2)} μs${bFam.us > 20 ? ' (목표 0.02 ms 넘음)' : ''}`);

// ── 5. 묶음 ──
console.log('\n## 5. 묶음');
const bytes = statSync(PACK).size;
console.log(`  ${PACK}: ${bytes} B = ${(bytes / 1e6).toFixed(3)} MB (${(bytes / 1048576).toFixed(3)} MiB) · 클립 ${packJson.clips.length} × Float32 ${packJson.phiGrid.n}×${packJson.width}`);
gate('묶음 ≤ 1.5 MB', bytes <= 1.5e6, `${(bytes / 1e6).toFixed(3)} MB`);
let shaOk = true, shaMsg = '';
try {
  checkSha1(packJson, DIR);
} catch (e) {
  shaOk = false;
  shaMsg = e.message;
}
gate('묶음 sha1 = 원본 파일', shaOk, shaMsg || `${packJson.clips.length} 벌 일치`);
{
  const a = makeSample(), b = makeSample();
  let mx = 0;
  for (const cut of cuts)
    for (const side of sides)
      for (let i = 0; i <= 300; i++) {
        const phi = -1.1 + 3.4 * (i / 300), S = ((i * 7) % 13) / 10;
        raw.sampleAt(cut, side, phi, S, a);
        packed.sampleAt(cut, side, phi, S, b);
        for (let k = 0; k < OUT_WIDTH; k++) mx = Math.max(mx, Math.abs(a.v[k] - b.v[k]), Math.abs(a.d1[k] - b.d1[k]) * 0.01, Math.abs(a.d2[k] - b.d2[k]) * 1e-4);
      }
  gate('묶음 표본 = 원본 표본', mx <= 1e-4, `최대 차이 ${mx.toExponential(2)}`);
}

// ── 6. 보간 ──
console.log('\n## 6. 보간·섞기');
const A = packed, g = A.grid;
{
  // 격자 점 일치 (한 벌·한 크기)
  let mx = 0;
  const s = makeSample();
  for (const rec of A.clips)
    for (let i = 0; i < g.n; i += 7) {
      A.sampleSize(s, rec.cut, rec.side, rec.size, g.phi[i]);
      for (let k = 0; k < WIDTH; k++) mx = Math.max(mx, Math.abs(s.v[k] - rec.grid[i * WIDTH + k]));
    }
  gate('격자 점에서 표본 = 저장 값', mx <= 1e-6, `최대 ${mx.toExponential(2)}`);
  // 격자 φ 의 t 가 원본 표본 시각과 같으면 (표시 자리 등) 격자 값 = 원본 값 (PCHIP·slerp 는 마디에서 정확)
  let mf = 0, nf = 0;
  for (const rec of raw.clips) {
    const c = rec.raw, C = c.data.cols, m = rec.marks;
    for (let i = 0; i < g.n; i++) {
      const tphi = (() => { let a = 0; for (let k = 0; k < 5; k++) if (g.phi[i] <= PHI_MARKS[k + 1]) { a = m[k] + ((m[k + 1] - m[k]) * (g.phi[i] - PHI_MARKS[k])) / (PHI_MARKS[k + 1] - PHI_MARKS[k]); break; } return a; })();
      const fi = Math.round(tphi * c.hz);
      if (Math.abs(tphi * c.hz - fi) > 1e-6 || fi >= c.data.n) continue;
      nf++;
      for (const [name, w, kind] of CHANNELS) {
        const o = fi * w, l = kind === 'dir' ? Math.hypot(C[name][o], C[name][o + 1], C[name][o + 2]) : 1; // 방향은 단위로 저장 (원본은 1e-3 반올림)
        for (let k = 0; k < w; k++) mf = Math.max(mf, Math.abs(rec.grid[i * WIDTH + OFF[name] + k] - C[name][o + k] / l));
      }
    }
  }
  gate('격자 = 원본 표본 (t 가 같은 자리; Float32 저장)', mf <= 2e-5, `${nf} 자리, 최대 ${mf.toExponential(2)}`);
}
{
  // d1·d2 = 유한 차분 (칸 안), C² (칸 경계 좌우 극한), 방향 단위·ω 일치, S 연속
  const p = makeSample(), q = makeSample(), c = makeSample();
  const LIN = [...LIN_IDX, CH.xFactor]; // 방향 채널의 d1·d2 는 ω·α (성분 미분이 아니다) → 따로 본다
  let e1 = 0, e2 = 0, eC = 0, eLen = 0, eS = 0;
  const eW = { sword: { pure: [], blend: [], peak: 0 }, elbowPoleS: { pure: [], blend: [], peak: 0 }, elbowPoleO: { pure: [], blend: [], peak: 0 } };
  const wStat = (E, list) => {
    let num = 0, den = 0, mx = 0;
    for (const [e, n] of list) (num += e * e), (den += n * n), (mx = Math.max(mx, e / E.peak));
    return { rms: Math.sqrt(num / Math.max(den, 1e-12)), max: mx };
  };
  const eps = 1e-6; // 칸(0.01) 안에 머무는 유한 차분 — 마디를 넘으면 3차 도함수 불연속(C² 까지만 보장)이 섞인다
  const scale = (x) => Math.max(1, Math.abs(x));
  for (let i = 0; i < 400; i++) {
    const cut = cuts[i & 3], side = sides[(i >> 2) & 1], S = (i % 11) / 10;
    const cellI = 2 + ((i * 37) % (g.n - 4)), phi = g.phi[cellI] + g.step * (0.1 + 0.8 * ((i * 0.618) % 1));
    A.sampleAt(cut, side, phi - eps, S, p);
    A.sampleAt(cut, side, phi + eps, S, q);
    A.sampleAt(cut, side, phi, S, c);
    for (const k of LIN) {
      e1 = Math.max(e1, Math.abs((q.v[k] - p.v[k]) / (2 * eps) - c.d1[k]) / scale(c.d1[k]));
      e2 = Math.max(e2, Math.abs((q.d1[k] - p.d1[k]) / (2 * eps) - c.d2[k]) / scale(c.d2[k]));
    }
    for (const o of [CH.sword, CH.edge, CH.poleS, CH.poleO]) {
      eLen = Math.max(eLen, Math.abs(Math.hypot(c.v[o], c.v[o + 1], c.v[o + 2]) - 1));
      // ḋ (유한 차분) vs ω × d — 벡터 오차 |ḋ − ω×d| 를 그 채널의 최고 |ḋ| 로 나눈 값. pole 은 뒤집힘(180°) 자리가 있어 보고만
      if (o === CH.edge) continue;
      const dx = (q.v[o] - p.v[o]) / (2 * eps), dy = (q.v[o + 1] - p.v[o + 1]) / (2 * eps), dz = (q.v[o + 2] - p.v[o + 2]) / (2 * eps);
      const w = c.d1, cx = w[o + 1] * c.v[o + 2] - w[o + 2] * c.v[o + 1], cy = w[o + 2] * c.v[o] - w[o] * c.v[o + 2], cz = w[o] * c.v[o + 1] - w[o + 1] * c.v[o];
      const name = o === CH.sword ? 'sword' : o === CH.poleS ? 'elbowPoleS' : 'elbowPoleO';
      const E = eW[name], isPure = S === 0 || S === 0.5 || S === 1;
      const err = Math.hypot(dx - cx, dy - cy, dz - cz), n = Math.hypot(dx, dy, dz);
      E.peak = Math.max(E.peak, n);
      (isPure ? E.pure : E.blend).push([err, n]);
    }
    // 칸 경계 좌우 극한 (±1e-12: pole 뒤집힘 칸은 3차 도함수가 1e8 에 이르러 1e-9 만 떨어져도 α 가 눈에 띄게 움직인다 — 경계 값 자체는 같다)
    const gp = g.phi[10 + (i % (g.n - 20))];
    A.sampleAt(cut, side, gp - 1e-12, S, p);
    A.sampleAt(cut, side, gp + 1e-12, S, q);
    for (let k = 0; k < WIDTH; k++) {
      if (k >= CH.edge && k < CH.edge + 3) continue; // edge: 몰지 않고 뒤집힘이 잦다 (보고만)
      eC = Math.max(eC, Math.abs(p.v[k] - q.v[k]) / scale(p.v[k]), Math.abs(p.d1[k] - q.d1[k]) / scale(p.d1[k]), Math.abs(p.d2[k] - q.d2[k]) / scale(p.d2[k]));
    }
    // sizeMid 좌우
    A.sampleAt(cut, side, phi, ATLAS.sizeMid - 1e-9, p);
    A.sampleAt(cut, side, phi, ATLAS.sizeMid + 1e-9, q);
    for (let k = 0; k < OUT_WIDTH; k++) eS = Math.max(eS, Math.abs(p.v[k] - q.v[k]) / scale(p.v[k]));
  }
  gate('d1 = dv/dφ (유한 차분, 상대)', e1 <= 1e-4, `최대 ${e1.toExponential(2)}`);
  gate('d2 = d²v/dφ² (유한 차분, 상대)', e2 <= 1e-3, `최대 ${e2.toExponential(2)}`);
  gate('칸 경계 C² (v·d1·d2 좌우 극한, 상대; edge 제외)', eC <= 1e-5, `최대 ${eC.toExponential(2)} (남는 몫은 pole 뒤집힘 칸의 α)`);
  gate('방향 채널 단위 길이', eLen <= 1e-12, `최대 |len−1| ${eLen.toExponential(2)}`);
  {
    const sp = wStat(eW.sword, eW.sword.pure), sb = wStat(eW.sword, eW.sword.blend);
    const pole = ['elbowPoleS', 'elbowPoleO'].map((k) => `${k} rms ${(wStat(eW[k], eW[k].pure).rms * 100).toFixed(1)}%/${(wStat(eW[k], eW[k].blend).rms * 100).toFixed(1)}%`).join(' · ');
    gate('칼 방향 ω: |ḋ − ω×d| — 한 벌 rms ≤ 1 %, 섞기 rms ≤ 1 % (최고 |ḋ| 대비 최대 ≤ 3 %)', sp.rms <= 0.01 && sb.rms <= 0.01 && sp.max <= 0.03 && sb.max <= 0.03, `한 벌 rms ${(sp.rms * 100).toFixed(2)}% max ${(sp.max * 100).toFixed(2)}% · 섞기 rms ${(sb.rms * 100).toFixed(2)}% max ${(sb.max * 100).toFixed(2)}% · 보고만: ${pole} (뒤집힘 자리)`);
  }
  gate('S = sizeMid 좌우 연속 (상대)', eS <= 1e-6, `최대 ${eS.toExponential(2)}`);
}
{
  // over 선형 (이득 1): sample(S=1, over) − sample(S=1) = over·(large − medium); 방향은 M→L 회전을 over 배
  const base = makeSample(), ov = makeSample(), M = makeSample(), L = makeSample();
  let e = 0, eDir = 0;
  for (let i = 0; i < 200; i++) {
    const cut = cuts[i & 3], side = sides[(i >> 2) & 1], phi = -1 + 3.2 * ((i * 0.37) % 1), over = 0.25 + (i % 5) * 0.5;
    A.sampleAt(cut, side, phi, 1, base);
    A.sampleAt(cut, side, phi, 1 + over, ov); // S > 1 → over 로
    A.sampleSize(M, cut, side, 'medium', phi);
    A.sampleSize(L, cut, side, 'large', phi);
    for (const [name, w, kind] of CHANNELS) {
      if (kind === 'dir') continue;
      for (let k = 0; k < w; k++) {
        const c = OFF[name] + k;
        e = Math.max(e, Math.abs(ov.v[c] - base.v[c] - over * (L.v[c] - M.v[c])), Math.abs(ov.d1[c] - base.d1[c] - over * (L.d1[c] - M.d1[c])) * 1e-2);
      }
    }
    // 방향: 회전각(M→out) = (1 + over)·각(M→L) — 같은 축 위이므로 각으로 견준다 (180° 넘게 돌면 감긴다)
    for (const o of [CH.sword, CH.poleS, CH.poleO]) {
      const th = angleDeg(M.v, o, L.v, o), want = (1 + over) * th;
      if (want > 175) continue;
      eDir = Math.max(eDir, Math.abs(angleDeg(M.v, o, ov.v, o) - want));
    }
  }
  gate('over: out += over·(크게 − 보통), 이득 1, 상한 없음 (S 1.25 … 3.25)', e <= 1e-9 && eDir <= 1e-6, `값 ${e.toExponential(2)} · 방향 각 ${eDir.toExponential(2)}°`);
  // over 의 방향 ω: |ḋ − ω×d| (유한 차분) — 칼 관문, pole 은 보고만 (뒤집힘 자리). S 1 + over ∈ {0.5, 1, 3}, S 0.3 + over 1
  {
    const p = makeSample(), q = makeSample(), c = makeSample(), eps = 1e-6;
    const acc = { sword: [0, 0, 0], elbowPoleS: [0, 0, 0], elbowPoleO: [0, 0, 0] }; // Σerr² Σ|ḋ|² max(err/|ḋ|, |ḋ| > 1)
    for (const [S, over] of [[1, 0.5], [1, 1], [1, 3], [0.3, 1]])
      for (let i = 0; i < 160; i++) {
        const cut = cuts[i & 3], side = sides[(i >> 2) & 1], phi = -0.98 + 3.16 * ((i * 0.618) % 1);
        A.sampleAt(cut, side, phi - eps, S, p, over);
        A.sampleAt(cut, side, phi + eps, S, q, over);
        A.sampleAt(cut, side, phi, S, c, over);
        for (const [name, o] of [['sword', CH.sword], ['elbowPoleS', CH.poleS], ['elbowPoleO', CH.poleO]]) {
          const dx = (q.v[o] - p.v[o]) / (2 * eps), dy = (q.v[o + 1] - p.v[o + 1]) / (2 * eps), dz = (q.v[o + 2] - p.v[o + 2]) / (2 * eps);
          const w = c.d1, cx = w[o + 1] * c.v[o + 2] - w[o + 2] * c.v[o + 1], cy = w[o + 2] * c.v[o] - w[o] * c.v[o + 2], cz = w[o] * c.v[o + 1] - w[o + 1] * c.v[o];
          const err = Math.hypot(dx - cx, dy - cy, dz - cz), n = Math.hypot(dx, dy, dz), a = acc[name];
          a[0] += err * err;
          a[1] += n * n;
          if (n > 1) a[2] = Math.max(a[2], err / n);
        }
      }
    const st = (a) => [Math.sqrt(a[0] / Math.max(a[1], 1e-12)), a[2]];
    const [sr, sm] = st(acc.sword), [psr, psm] = st(acc.elbowPoleS), [por, pom] = st(acc.elbowPoleO);
    gate('over: 방향 ω = slerp 닫힌 도함수 — 칼 |ḋ − ω×d| rms ≤ 1 %, 최대 ≤ 3 % (S 1 + over 0.5/1/3, S 0.3 + over 1)', sr <= 0.01 && sm <= 0.03, `칼 rms ${(sr * 100).toFixed(3)}% max ${(sm * 100).toFixed(3)}% · 보고만: elbowPoleS rms ${(psr * 100).toFixed(2)}% max ${(psm * 100).toFixed(1)}% · elbowPoleO rms ${(por * 100).toFixed(2)}% max ${(pom * 100).toFixed(1)}%`);
  }
  // 시각·걸음도 같은 규칙: 표시·step = 크게 + over·(크게 − 보통). sample().t·dt = marks()/tAt() 의 시계 (두 답이 없다)
  let eT = 0, eStep = 0, collapse = Infinity, collapseAt = '';
  for (let i = 0; i < 200; i++) {
    const cut = cuts[i & 3], side = sides[(i >> 2) & 1], phi = -1 + 3.2 * ((i * 0.37) % 1), over = 0.25 + (i % 5) * 0.5;
    const f = A.fam(cut, side), M = f.medium.marks, L = f.large.marks, mk = new Float64Array(6);
    for (let k = 0; k < 6; k++) mk[k] = L[k] + over * (L[k] - M[k]);
    A.sampleAt(cut, side, phi, 1 + over, ov);
    const mS = A.marks(cut, side, 1 + over);
    for (let k = 0; k < 6; k++) eT = Math.max(eT, Math.abs(mS[k] - mk[k]));
    eT = Math.max(eT, Math.abs(ov.t - tOfPhi(mk, phi)), Math.abs(ov.dt - dTdPhi(mk, phi)), Math.abs(ov.t - A.tAt(cut, side, phi, 1 + over)));
    A.sampleAt(cut, side, phi, 1, ov, over); // S 1 + over 따로 = S 1 + over 합친 것
    eT = Math.max(eT, Math.abs(ov.t - tOfPhi(mk, phi)), Math.abs(ov.dt - dTdPhi(mk, phi)));
    const sL = A.step(cut, side, 1), sO = A.step(cut, side, 1 + over), sm = A.step(cut, side, ATLAS.sizeMid); // sizeMid = 보통 벌
    for (const k of ['fwd', 'side', 'swingT']) eStep = Math.max(eStep, Math.abs(sO[k] - (sL[k] + over * (sL[k] - sm[k]))));
  }
  // 자료의 성질 (걸쇠 아님): 크게의 표시 간격이 보통보다 짧으면 over 가 크면 그 간격이 0 이 된다 → 그 over 를 적는다
  for (const cut of cuts)
    for (const side of sides) {
      const f = A.fam(cut, side), M = f.medium.marks, L = f.large.marks;
      for (let k = 0; k < 5; k++) {
        const dL = L[k + 1] - L[k], dM = M[k + 1] - M[k];
        if (dL < dM) {
          const o = dL / (dM - dL);
          if (o < collapse) (collapse = o), (collapseAt = `${cut}_${side} ${MARK_NAMES[k]}→${MARK_NAMES[k + 1]}`);
        }
      }
    }
  gate('over: 시각 t·dt·marks·step 도 크게 + over·(크게 − 보통) (이득 1, 멈춤 없음)', eT <= 1e-12 && eStep <= 1e-12, `표시·t·dt ${eT.toExponential(1)} · step ${eStep.toExponential(1)} · 보고만: 표시 간격이 0 이 되는 over ${collapse === Infinity ? '없음' : `${collapse.toFixed(2)} (${collapseAt})`}`);
}
{
  // 두 베기 섞기 끝값
  const a = makeSample(), b = makeSample(), m = makeSample();
  let e = 0;
  const req = { cut: 'zornhau', side: 'right', phi: 0.3, S: 0.7, over: 0, cutB: 'oberhau', wAB: 0 };
  A.sample(a, { ...req, cutB: null });
  A.sample(m, req);
  for (let k = 0; k < OUT_WIDTH; k++) e = Math.max(e, Math.abs(a.v[k] - m.v[k]));
  A.sample(b, { ...req, cut: 'oberhau', cutB: null });
  A.sample(m, { ...req, wAB: 1 });
  for (let k = 0; k < OUT_WIDTH; k++) e = Math.max(e, Math.abs(b.v[k] - m.v[k]));
  A.sample(m, { ...req, wAB: 0.5 });
  const mid = Math.abs(m.v[CH.chestYaw] - 0.5 * (a.v[CH.chestYaw] + b.v[CH.chestYaw]));
  const sw = angleDeg(a.v, CH.sword, m.v, CH.sword) - angleDeg(m.v, CH.sword, b.v, CH.sword);
  gate('두 베기 섞기: wAB 0 = A, 1 = B, 0.5 = 가운데(칼은 slerp 가운데)', e <= 1e-12 && mid <= 1e-9 && Math.abs(sw) <= 1e-6, `끝값 ${e.toExponential(1)} · 가운데 ${mid.toExponential(1)} · 칼 각 차 ${sw.toExponential(1)}°`);
}
{
  // 이월 도우미: k(0) = 1 → out + (rev − base) (칼은 base→rev 회전을 그대로), k(carryPhi) = 0
  const o = makeSample(), rev = makeSample(), base = makeSample(), o0 = makeSample();
  A.sampleAt('zornhau', 'right', -0.4, 0.8, rev);
  A.sampleAt('zornhau', 'right', 0, 0.8, base);
  A.sampleAt('zornhau', 'right', 0.0, 0.8, o0);
  A.sampleAt('zornhau', 'right', 0.0, 0.8, o);
  const k1 = carryOver(o, rev, base, 0, 0.3);
  let e = Math.abs(k1 - 1);
  for (let k = 0; k < 3; k++) e = Math.max(e, Math.abs(o.v[CH.handS + k] - (o0.v[CH.handS + k] + rev.v[CH.handS + k] - base.v[CH.handS + k])));
  e = Math.max(e, angleDeg(o.v, CH.sword, rev.v, CH.sword)); // φ 0 에서 out = base → 이월 뒤 칼 = rev 의 칼
  A.sampleAt('zornhau', 'right', 0.3, 0.8, o0);
  A.sampleAt('zornhau', 'right', 0.3, 0.8, o);
  const k0 = carryOver(o, rev, base, 0.3, 0.3);
  e = Math.max(e, Math.abs(k0));
  for (let k = 0; k < OUT_WIDTH; k++) e = Math.max(e, Math.abs(o.v[k] - o0.v[k]));
  A.sampleAt('zornhau', 'right', 0.15, 0.8, o);
  const kh = carryOver(o, rev, base, 0.15, 0.3);
  gate('이월 도우미: k(0)=1 전부, k(carryPhi)=0, 가운데 최소 저크', e <= 1e-5 && Math.abs(kh - 0.5) <= 1e-12, `오차 ${e.toExponential(1)} · k(½) ${kh}`);
  // 이월 뒤 도함수: 방향 ḋ (유한 차분) vs ω × d, 선형 d1 vs 유한 차분 — φ 0.005 … 0.3
  const p = makeSample(), q = makeSample(), c = makeSample(), eps = 1e-6;
  let eSw = 0, ePole = 0, eLin = 0;
  for (const [cut, phiRev, S] of [['zornhau', -0.4, 0.8], ['zornhau', -0.7, 1], ['oberhau', -0.5, 0.6], ['unterhau', -0.3, 1], ['mittelhau', -0.4, 0.9]]) {
    A.sampleAt(cut, 'right', phiRev, S, rev);
    A.sampleAt(cut, 'right', 0, S, base);
    for (let phi = 0.005; phi < 0.3; phi += 0.0137) {
      A.sampleAt(cut, 'right', phi - eps, S, p);
      carryOver(p, rev, base, phi - eps, 0.3);
      A.sampleAt(cut, 'right', phi + eps, S, q);
      carryOver(q, rev, base, phi + eps, 0.3);
      A.sampleAt(cut, 'right', phi, S, c);
      carryOver(c, rev, base, phi, 0.3);
      for (const k of LIN_IDX) eLin = Math.max(eLin, Math.abs((q.v[k] - p.v[k]) / (2 * eps) - c.d1[k]) / Math.max(1, Math.abs(c.d1[k])));
      for (const o of [CH.sword, CH.poleS]) {
        const dx = (q.v[o] - p.v[o]) / (2 * eps), dy = (q.v[o + 1] - p.v[o + 1]) / (2 * eps), dz = (q.v[o + 2] - p.v[o + 2]) / (2 * eps);
        const w = c.d1, cx = w[o + 1] * c.v[o + 2] - w[o + 2] * c.v[o + 1], cy = w[o + 2] * c.v[o] - w[o] * c.v[o + 2], cz = w[o] * c.v[o + 1] - w[o + 1] * c.v[o];
        const n = Math.sqrt(dx * dx + dy * dy + dz * dz), err = Math.sqrt((dx - cx) ** 2 + (dy - cy) ** 2 + (dz - cz) ** 2) / Math.max(n, 1);
        if (o === CH.sword) eSw = Math.max(eSw, err);
        else ePole = Math.max(ePole, err);
      }
    }
  }
  gate('이월 도우미 도함수: 칼 |ḋ − ω×d|/|ḋ| ≤ 1 %, 선형 d1 = 유한 차분', eSw <= 0.01 && eLin <= 1e-4, `칼 최대 ${(eSw * 100).toFixed(2)}% · 선형 ${eLin.toExponential(1)} · 보고만: elbowPoleS ${(ePole * 100).toFixed(2)}%`);
}

// ── 7. 부호표 (§4.3) ──
console.log('\n## 7. 부호표 §4.3 — 가슴 틀 = body.mjs frame(yaw, lean, side), 바라보는 틀 손 = guards.js, 게임 yaw 부호');
const gh = { hand: [0, 0, 0], dir: [0, 0, 0] };
const UP = new THREE.Vector3(0, 1, 0);
const samples = [
  ['zornhau_right_small', 'small', -1, 'pflug'],
  ['zornhau_right_small', 'small', 0, 'tagR'],
  ['zornhau_right_large', 'large', 0.85, null],
];
let signOk = true;
const s = makeSample(), face = new Float64Array(3), Mq = new Float64Array(9), tmp = new Float64Array(3), cmd = {};
console.log('  clip                  φ     chest.yaw lean side  | Δ(frame−body.mjs) | 손 가슴틀 → 바라보는 틀  (guards.js 손)  오차 cm (자세표 그대로 / guardAt) | 게임 pelvisYaw chestYaw pitch side drop (rad·m) | Ry(게임 yaw)·어깨 = frame·어깨');
for (const [id, size, phi, guard] of samples) {
  A.sampleSize(s, 'zornhau', 'right', size, phi);
  const yaw = s.v[CH.chestYaw], lean = s.v[CH.chestLean], side = s.v[CH.chestSide];
  const Mb = bodyFrame(yaw, lean, side), Ma = chestFrame(yaw, lean, side, Mq);
  let dM = 0;
  for (let k = 0; k < 9; k++) dM = Math.max(dM, Math.abs(Mb[k] - Ma[k]));
  toFacing(s.v, CH.handS, face, 0);
  let gErr = null, bErr = null, gHand = null;
  if (guard) {
    const pad = GUARD_PADS[guard];
    gHand = GUARDS[GUARD_IDS.indexOf(guard)].hand; // 자세표 손 그대로
    gErr = Math.hypot(face[0] - gHand[0], face[1] - gHand[1], face[2] - gHand[2]) * 100;
    guardAt(pad[0], pad[1], gh); // 그 자리에서 게임이 섞어 내는 손 (이웃 자세가 조금 섞인다)
    bErr = Math.hypot(face[0] - gh.hand[0], face[1] - gh.hand[1], face[2] - gh.hand[2]) * 100;
  }
  toGame(s.v, cmd);
  // 게임 yaw: −deg·D2R 를 three.js 의 +Y 축 회전(fighter.js anchorQ = setFromAxisAngle(UP, …))에 넣으면 어깨가 frame() 과 같은 자리에 온다
  const shG = new THREE.Vector3(0, 0.1, 0.2).applyQuaternion(new THREE.Quaternion().setFromAxisAngle(UP, cmd.chestYaw));
  const shF = m3apply(chestFrame(yaw, 0, 0, Mq), [0, 0.1, 0.2], 0, tmp, 0);
  const dSh = Math.hypot(shG.x - shF[0], shG.y - shF[1], shG.z - shF[2]);
  // 쿼터니언도 three.js 와 같은가
  const qa = quatFromM3(chestFrame(yaw, lean, side, Mq)), m4 = new THREE.Matrix4().set(Mq[0], Mq[1], Mq[2], 0, Mq[3], Mq[4], Mq[5], 0, Mq[6], Mq[7], Mq[8], 0, 0, 0, 0, 1);
  const qt = new THREE.Quaternion().setFromRotationMatrix(m4);
  const dQ = Math.min(Math.hypot(qa[0] - qt.x, qa[1] - qt.y, qa[2] - qt.z, qa[3] - qt.w), Math.hypot(qa[0] + qt.x, qa[1] + qt.y, qa[2] + qt.z, qa[3] + qt.w));
  const ok = dM < 1e-12 && (gErr == null || (gErr <= 1.0 && bErr <= ATLAS.smallTol * 100)) && dSh < 1e-12 && dQ < 1e-9;
  signOk &&= ok;
  console.log(`  ${id.padEnd(21)} ${String(phi).padStart(5)} ${yaw.toFixed(1).padStart(8)} ${lean.toFixed(1).padStart(5)} ${side.toFixed(1).padStart(5)} | ${dM.toExponential(1).padStart(8)}          | ${v3s(s.v, CH.handS)} → ${v3s(face)} ${guard ? `(${guard} ${v3s(gHand)}) ${gErr.toFixed(2)} (guardAt 섞임 ${bErr.toFixed(2)})` : '(—)'} | ${cmd.pelvisYaw.toFixed(3)} ${cmd.chestYaw.toFixed(3)} ${cmd.pitch.toFixed(3)} ${cmd.side.toFixed(3)} ${cmd.drop.toFixed(3)} | Δ어깨 ${dSh.toExponential(1)} Δq ${dQ.toExponential(1)} ${ok ? 'ok' : 'FAIL'}`);
}
// 부호 뜻 (숫자로): + yaw 25° 에서 칼 든 어깨(+z) 의 x 가 음수(뒤로) — clip_format §2 · guards.js 머리말
const shBack = m3apply(chestFrame(25, 0, 0, Mq), [0, 0.1, 0.2], 0, tmp, 0)[0];
const topFwd = m3apply(chestFrame(0, 10, 0, Mq), [0, 1, 0], 0, tmp, 0)[0];
const topSide = m3apply(chestFrame(0, 0, 10, Mq), [0, 1, 0], 0, tmp, 0)[2];
console.log(`  yaw +25° → 칼 든 어깨 x ${shBack.toFixed(3)} (뒤로 = 음수 ✓) · lean +10° → 머리 x ${topFwd.toFixed(3)} (앞으로 ✓) · side +10° → 머리 z ${topSide.toFixed(3)} (칼 쪽 ✓)`);
console.log(`  게임 단위: pelvisYaw −deg·D2R (fighter.js pT = -G.pelvisYaw…) · chestYaw −deg·D2R · pitch +lean·D2R (작은 벌 t0 lean 5° = pflug pitch ${(GUARDS[5].pitch * R2D).toFixed(0)}°) · drop − ${0.06} (t0 drop 0.07 = pflug drop ${GUARDS[5].drop}) · 발 yaw −deg·D2R · heel = lift·GAIT.heelMax ${GAIT.heelMax}`);
gate('부호표 §4.3 (frame = body.mjs, 손 = 자세표 ≤ 1 cm · guardAt ≤ 2 cm, Ry(−deg) = 게임 +Y 회전, 쿼터니언 = three.js)', signOk && shBack < 0 && topFwd > 0 && topSide > 0);

// ── 8. 닿는 거리 표 (§4.6) ──
console.log('\n## 8. 닿는 거리 (고정 어깨 (0, 0.1, ±0.2) 에서 0.565 m 대비, 가장 먼 표본, cm; + = 팔이 모자람 → fighter.js armIK 가 자른다, reachClamp 로 센다)');
console.log('  clip                    손 over   t(s)   빈손 over  t(s)   wristOver160  wristMax  pole 뒤집힘');
for (const rec of A.clips) {
  const r = A.report.reach.find((x) => x.id === rec.id), ck = rec.meta.summary.checks;
  console.log(`  ${rec.id.padEnd(23)} ${(r.hand.over * 100).toFixed(1).padStart(7)} ${String(r.hand.t).padStart(7)} ${(r.off.over * 100).toFixed(1).padStart(9)} ${String(r.off.t).padStart(7)}   ${String(ck.wristOver160 ?? '-').padStart(10)} ${String(ck.wristMax ?? '-').padStart(9)}  ${(ck.poleFlips || []).length ? ck.poleFlips.map((p) => `${p.ch.replace('elbowPole', '')}@${p.t}s ${p.deg}°`).join(' ') : '-'}`);
}
console.log('  같은 φ 벌 사이 칼 방향 각 최대: ' + A.report.crossSize.filter((c) => c.ch === 'sword').map((c) => `${c.cut}_${c.side} ${c.pair} ${c.deg}°@φ${c.phi}`).join(' · '));
console.log('  걸음 (S 1 / 0.5 / 0.3): ' + cuts.map((cut) => { const a = A.step(cut, 'right', 1), b = A.step(cut, 'right', 0.5), c = A.step(cut, 'right', 0.3); return `${cut} fwd ${a.fwd.toFixed(2)}/${b.fwd.toFixed(2)}/${c.fwd.toFixed(2)} m swingT ${a.swingT.toFixed(3)}/${b.swingT.toFixed(3)}/${c.swingT.toFixed(3)} s φ̇clip ${a.phiDotClip.toFixed(2)}/${b.phiDotClip.toFixed(2)}/${c.phiDotClip.toFixed(2)}`; }).join(' · '));
console.log('  시각 (zornhau_right, S 0/0.5/1) 표시 t0…tg: ' + [0, 0.5, 1].map((S) => `S${S} [${[...A.marks('zornhau', 'right', S)].map((x) => x.toFixed(3)).join(' ')}]`).join(' · '));
console.log('  복귀 자세: ' + cuts.map((cut) => `${cut} R ${A.recoverTo(cut, 'right', 0)}/${A.recoverTo(cut, 'right', 1)} L ${A.recoverTo(cut, 'left', 0)}/${A.recoverTo(cut, 'left', 1)}`).join(' · '));
// 칼 방향 각속도 (φ 단위 → 클립 박자로 rad/s): tr…tc 구간 최대 (§6.2 의 숫자 확인용)
{
  const s = makeSample();
  const rows = [];
  for (const cut of cuts) {
    let mx = 0, at = 0;
    for (let phi = 0.55; phi <= 0.85; phi += 0.01) {
      A.sampleAt(cut, 'right', phi, 1, s);
      const w = Math.hypot(s.d1[CH.sword], s.d1[CH.sword + 1], s.d1[CH.sword + 2]) / s.dt; // rad/φ ÷ (s/φ) = rad/s
      if (w > mx) (mx = w), (at = phi);
    }
    rows.push(`${cut} ${mx.toFixed(1)} rad/s@φ${at.toFixed(2)}`);
  }
  console.log('  크게 벌 칼 방향 각속도 tr…tc 최대 (가슴 틀, 클립 박자): ' + rows.join(' · '));
}

// ── 표 ──
console.log('\n## 결과');
for (const gt of gates) console.log(`  ${gt.ok ? 'PASS' : 'FAIL'}  ${gt.name}${gt.detail ? ' — ' + gt.detail : ''}`);
const nFail = gates.filter((x) => !x.ok).length;
console.log(nFail ? `\n[atlas_check] 실패 ${nFail}` : '\n[atlas_check] 모두 통과');
process.exit(nFail ? 1 : 0);
