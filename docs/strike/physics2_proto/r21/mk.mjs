// r21 칸 만들기: node mk.mjs <칸...> — $SCRATCH/p2/r6/mx/cells/fb_base 를 cp -a 하고 src/ 의 값만 바꾼 뒤 칸마다 <칸>.diff 를 이 폴더에 남긴다.
// 이미 있는 칸은 건너뜀. 바꾸는 곳은 아래 KNOB 표(파일 · 바꿀 글자 · 새 글자) — 글자가 꼭 한 번 나와야 한다.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const C = `${process.env.SCRATCH}/p2/r6/mx/cells`;
// 걸음 길이 배수 k: gait.js requestStep 이 받는 fwd · side 를 k 배 (0.6 → 0.45 이면 0.75 · 0.6 → 0.3 이면 0.5)
const step = (k) => [['src/gait.js', "fwd: o.fwd ?? 0.5, side: o.side ?? 0,", `fwd: (o.fwd ?? 0.5) * ${k}, side: (o.side ?? 0) * ${k},`]];
const retreat = [['src/ai.js', 'me.move.set(clamp(side * mv, -lim, lim), clamp(fwd * mv, -lim, lim));', 'me.move.set(clamp(side * mv, -lim, lim), clamp(fwd * mv, -0.5 * lim, lim));']];
const push = [['src/gait.js', 'want.addScaledVector(fwd, (this.req.fwd * 0.8 * (this.req.push ?? 1))', 'want.addScaledVector(fwd, (this.req.fwd * 0.56 * (this.req.push ?? 1))']];
const arc = [['src/config.js', '  trunkArc: 2, //', '  trunkArc: 1.4, //']];
const legs = [['src/config.js', 'limit: { hipFlex: 250, hipAbd: 150, hipRot: 70, kneeExt: 250, kneeFlex: 130, anklePlantar: 250, ankleDorsi: 60, ankleInv: 50, ankleRot: 40 },', 'limit: { hipFlex: 500, hipAbd: 300, hipRot: 140, kneeExt: 500, kneeFlex: 260, anklePlantar: 500, ankleDorsi: 120, ankleInv: 100, ankleRot: 80 },']];
const load = [['src/config.js', '  loadMax: 1.8,', '  loadMax: 3.0,']];
const aid = (y, t) => [['src/config.js', '  yawMax: 100, // 수직축', `  yawMax: ${y}, // 수직축`], ['src/config.js', '  tiltMax: 80, // 기울기 두 축', `  tiltMax: ${t}, // 기울기 두 축`]];
const KNOB = {
  sa_dem: [...step(0.75), ...retreat, ...push, ...arc],
  sa_dem2: [...step(0.5), ...retreat, ...push, ...arc],
  sb_body: [...legs, ...load],
  sc_aid0: aid(0, 0),
  sc_aid2: aid(200, 160),
  // 둘째 걸음 (한 손잡이씩)
  sa_step: step(0.75), sa_step2: step(0.5), sa_ret: retreat, sa_push: push, sa_arc: arc,
  sb_legs: legs, sb_load: load,
};
for (const cell of process.argv.slice(2)) {
  const T = `${C}/${cell}`;
  if (existsSync(T)) { console.log(cell, '있음 — 건너뜀'); continue; }
  if (!KNOB[cell]) throw new Error('모르는 칸 ' + cell);
  execSync(`cp -a ${C}/fb_base ${T}`);
  for (const [f, a, b] of KNOB[cell]) {
    const p = `${T}/${f}`, s = readFileSync(p, 'utf8');
    if (s.split(a).length !== 2) throw new Error(`${cell} ${f}: 글자가 한 번이 아님 — ${a}`);
    writeFileSync(p, s.replace(a, b));
  }
  let d = '';
  try { execSync(`diff -ru ${C}/fb_base/src ${T}/src`, { encoding: 'utf8' }); } catch (e) { d = e.stdout; }
  writeFileSync(`${HERE}/${cell}.diff`, d.split(process.env.SCRATCH).join('$S'));
  console.log(cell, '만듦', d.split('\n').filter((l) => /^[+-][^+-]/.test(l)).length, '줄 바뀜');
}
