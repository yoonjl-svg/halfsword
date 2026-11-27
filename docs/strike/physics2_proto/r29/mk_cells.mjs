// r29 값 칸 만들기: 바탕 칸 r24_om(본판 src) 사본 + 이 나무 src, 그리고 config 숫자만 바꿈 (LEGS.ecc 줄 · LEGS.limit 줄 — 두 줄).
//  칸 이름 ll_<ecc × 10>_<한도 %> — 예: ll_13_125 = LEGS.ecc 1.3 · LEGS.limit 칸마다 × 1.25. 이름에서 값을 읽으므로 다른 이름도 된다(ll_12_110 따위).
//  쓰는 법: S=<scratch> node mk_cells.mjs [칸 이름...]   (없으면 ll_10_100 ll_13_100 ll_10_125 ll_13_125 ll_14_125) → $S/p2/r6/mx/cells/<칸>
//  고칠 글이 꼭 한 번 나와야 한다(아니면 멈춤). 이미 있는 칸은 지우고 다시 만든다. 칸마다 그 칸의 config 를 불러 실제로 들어간 값을 찍는다.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const S = process.env.S; if (!S) throw new Error('S=<scratch> 를 주시오');
const TREE = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const CELLS = join(S, 'p2/r6/mx/cells'), BASE = join(CELLS, 'r24_om');
const LIMLINE = '  limit: { hipFlex: 250, hipAbd: 150, hipRot: 70, kneeExt: 250, kneeFlex: 130, anklePlantar: 250, ankleDorsi: 60, ankleInv: 50, ankleRot: 40 },';
const ECCLINE = '  ecc: 1.0,';
function once(file, a, b) {
  const s = readFileSync(file, 'utf8'), n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${file}: '${a.slice(0, 60)}' 가 ${n} 번`);
  if (a !== b) writeFileSync(file, s.replace(a, b));
}
const names = process.argv.slice(2).length ? process.argv.slice(2) : ['ll_10_100', 'll_13_100', 'll_10_125', 'll_13_125', 'll_14_125'];
for (const name of names) {
  const m = name.match(/^ll_(\d+)_(\d+)$/); if (!m) throw new Error('칸 이름은 ll_<ecc×10>_<한도 %>: ' + name);
  const ecc = +m[1] / 10, pct = +m[2];
  const C = join(CELLS, name);
  if (existsSync(C)) execFileSync('rm', ['-rf', C]);
  execFileSync('cp', ['-a', BASE, C]);
  execFileSync('rm', ['-rf', join(C, 'src')]);
  execFileSync('cp', ['-a', join(TREE, 'src'), join(C, 'src')]);
  const cfg = join(C, 'src/config.js');
  once(cfg, ECCLINE, ecc === 1 ? ECCLINE : `  ecc: ${ecc},`);
  once(cfg, LIMLINE, pct === 100 ? LIMLINE : LIMLINE.replace(/: (\d+)/g, (_, v) => ': ' + (+v * pct) / 100));
  const L = (await import(pathToFileURL(cfg).href + '?' + name)).LEGS;
  let out = ''; try { execFileSync('diff', [join(TREE, 'src/config.js'), cfg], { encoding: 'utf8' }); } catch (e) { out = e.stdout; }
  const d = out.split('\n').filter((l) => /^[<>]/.test(l)).length;
  console.log(`${name}: LEGS.ecc ${L.ecc} · eccW ${L.eccW} · limit ${JSON.stringify(L.limit)} · 이 나무 config 와 다른 줄 ${d / 2}`);
}
