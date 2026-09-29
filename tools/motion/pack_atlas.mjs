// ─────────────────────────────────────────────────────────────
//  클립 묶음 만들기 (R2 §4.1) — clip/2 원본 → src/strike/clips/atlas_v0.json (stillness-atlas-pack/1)
//   node tools/motion/pack_atlas.mjs [--families=zornhau,oberhau,mittelhau,unterhau] [--out=src/strike/clips/atlas_v0.json] [--clips=<원본 폴더>]
//  원본 폴더 기본값: ATLAS.clipsDir(../halfsword/docs/motion/clips, 저장소 뿌리 기준 — 클립이 아직 main 에만 있어서), 없으면 docs/motion/clips.
//  모는 채널만(+edge), φ 격자(−1…2.2, 0.01)로 다시 표본, Float32 리틀 엔디언 base64. J·ang.*·w.*·speed.*·com·t·phi·chest.xFactor 는 뺀다
//  (t 는 marks 의 선형 조각, xFactor 는 chest.yaw − pelvis.yaw 로 읽을 때 되살린다). 도함수는 읽을 때 만든다.
//  만든 뒤 묶음을 다시 읽어 원본 아틀라스와 표본을 견준다(Float32 반올림 수준이어야 한다).
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ATLAS } from '../../src/config.js';
import { loadRaw, loadPack, packOf, defaultClipsDir, makeSample, OUT_WIDTH } from '../../src/strike/atlas.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const a = args.find((s) => s.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const families = opt('families', ATLAS.families.join(',')).split(',').filter(Boolean);
const outPath = resolve(ROOT, opt('out', 'src/strike/clips/atlas_v0.json'));
const dir = await defaultClipsDir(ROOT, args);

console.log(`[pack_atlas] 원본 ${dir}`);
const t0 = performance.now();
const raw = await loadRaw(dir, { families });
console.log(`[pack_atlas] 원본 읽기·검사·격자화 ${(performance.now() - t0).toFixed(0)} ms — 클립 ${raw.clips.length} (${families.join(', ')})`);
for (const l of raw.reportLines()) console.log(l);

const pack = packOf(raw);
const json = JSON.stringify(pack);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);
const bytes = statSync(outPath).size;
console.log(`[pack_atlas] → ${outPath}  ${bytes} B = ${(bytes / 1e6).toFixed(3)} MB (${(bytes / 1048576).toFixed(3)} MiB) · 클립당 자료 ${pack.clips[0].data.length} 글자 (Float32 ${pack.phiGrid.n}×${pack.width})`);
for (const c of pack.clips) console.log(`  ${c.id.padEnd(24)} sha1 ${c.sha1}`);

// 되읽어 견주기: 같은 (베기, 쪽, φ, S) 표본의 최대 차이 (Float32 저장 → 1e-6 수준)
const t1 = performance.now();
const packed = await loadPack(outPath, { families, clipsDir: dir }); // sha1 = 원본 파일도 여기서 본다
const loadMs = performance.now() - t1;
const a = makeSample(), b = makeSample();
let maxV = 0, maxD1 = 0, maxD2 = 0;
for (const cut of families)
  for (const side of ['right', 'left'])
    for (let i = 0; i <= 200; i++) {
      const phi = -1 + 3.2 * (i / 200), S = (i * 7) % 11 / 10;
      raw.sampleAt(cut, side, phi, S, a);
      packed.sampleAt(cut, side, phi, S, b);
      for (let k = 0; k < OUT_WIDTH; k++) {
        maxV = Math.max(maxV, Math.abs(a.v[k] - b.v[k]));
        maxD1 = Math.max(maxD1, Math.abs(a.d1[k] - b.d1[k]));
        maxD2 = Math.max(maxD2, Math.abs(a.d2[k] - b.d2[k]));
      }
    }
console.log(`[pack_atlas] 되읽기 ${loadMs.toFixed(0)} ms (풀기 + 도함수) · 원본 대비 최대 차이 값 ${maxV.toExponential(2)} d1 ${maxD1.toExponential(2)} d2 ${maxD2.toExponential(2)}`);
if (maxV > 1e-4) {
  console.error('[pack_atlas] 묶음이 원본과 다르다 — 실패');
  process.exit(1);
}
