// r27 값 칸 만들기: 바탕 칸 r24_om(본판 src) 사본 + 이 나무 src 에 값만 바꿈. 칸마다 실제로 들어간 값을 그 칸의 config 를 불러 찍는다.
//  쓰는 법: S=<scratch> node mk_cells.mjs [칸 이름...]   (없으면 다섯 칸 모두) → $S/p2/r6/mx/cells/<칸>
//   lc_10_100 = 만든 그대로 (LEGS.ecc 1.0 · 한도 × 1) · lc_13_100 = LEGS.ecc 1.3 · lc_10_125 = LEGS.limit 칸마다 × 1.25 · lc_13_125 = 둘 다 ·
//   lc_13_125_h4 = 둘 다 + 선 높이 + 4 cm (r22p/sp_h4.diff 와 같게: config GAIT guardHeight 0.9 → 0.94 · walkHeight 0.978 → 1.018 · schools ITALIAN_GAIT 0.895 → 0.935 · 0.965 → 1.005)
//  고칠 글이 꼭 한 번 나와야 한다(아니면 멈춤). 이미 있는 칸은 지우고 다시 만든다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const S = process.env.S; if (!S) throw new Error('S=<scratch> 를 주시오');
const TREE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CELLS = join(S, 'p2/r6/mx/cells'), BASE = join(CELLS, 'r24_om');
const ALL = { lc_10_100: { ecc: 0, lim: 0, h4: 0 }, lc_13_100: { ecc: 1, lim: 0, h4: 0 }, lc_10_125: { ecc: 0, lim: 1, h4: 0 }, lc_13_125: { ecc: 1, lim: 1, h4: 0 }, lc_13_125_h4: { ecc: 1, lim: 1, h4: 1 } };
const LIMLINE = '  limit: { hipFlex: 250, hipAbd: 150, hipRot: 70, kneeExt: 250, kneeFlex: 130, anklePlantar: 250, ankleDorsi: 60, ankleInv: 50, ankleRot: 40 },';
function once(file, a, b) {
  const s = readFileSync(file, 'utf8'), n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${file}: '${a.slice(0, 60)}' 가 ${n} 번`);
  writeFileSync(file, s.replace(a, b));
}
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(ALL);
for (const name of names) {
  const o = ALL[name]; if (!o) throw new Error('모르는 칸 ' + name);
  const C = join(CELLS, name);
  if (existsSync(C)) execFileSync('rm', ['-rf', C]);
  execFileSync('cp', ['-a', BASE, C]);
  execFileSync('rm', ['-rf', join(C, 'src')]);
  execFileSync('cp', ['-a', join(TREE, 'src'), join(C, 'src')]);
  const cfg = join(C, 'src/config.js'), sch = join(C, 'src/schools.js');
  if (o.ecc) once(cfg, '  ecc: 1.0,', '  ecc: 1.3,');
  if (o.lim) once(cfg, LIMLINE, LIMLINE.replace(/: (\d+)/g, (_, v) => ': ' + +v * 1.25));
  if (o.h4) {
    once(cfg, '  guardHeight: 0.9, //', '  guardHeight: 0.94, //');
    once(cfg, '  walkHeight: 0.978, //', '  walkHeight: 1.018, //');
    once(sch, 'const ITALIAN_GAIT = { guardHeight: 0.895, walkHeight: 0.965,', 'const ITALIAN_GAIT = { guardHeight: 0.935, walkHeight: 1.005,');
  }
  const K = await import(pathToFileURL(cfg).href + '?' + name);
  const L = K.LEGS;
  const gh = readFileSync(sch, 'utf8').match(/const ITALIAN_GAIT = \{ guardHeight: ([\d.]+), walkHeight: ([\d.]+),/);
  console.log(`${name}: LEGS.ecc ${L.ecc} · capDFloor ${L.capDFloor} · limit ${JSON.stringify(L.limit)} · GAIT guardHeight ${K.GAIT?.guardHeight} walkHeight ${K.GAIT?.walkHeight} · ITALIAN_GAIT ${gh?.[1]} / ${gh?.[2]}`);
}
