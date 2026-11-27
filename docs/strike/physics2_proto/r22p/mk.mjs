// r22p 칸 만들기 (r21/mk.mjs 꼴): SCRATCH=$S node mk.mjs <칸...> — 칸의 바탕($S/p2/r6/mx/cells/<FROM>, 보통 fb_base)을 cp -a 하고 src/ 를 아래 KNOB 표대로 고친 뒤
//  <칸>.diff (fb_base 에 대한 diff) 를 이 폴더에 남긴다. 이미 있는 칸은 건너뜀. 바꿀 글자는 꼭 한 번 나와야 한다.
//  자세 칸: 서 있는 · 걷는 골반 높이 목표 (+2 · +4 cm) · 디딜 때 무릎 굽힘 바닥(sp_td) — 값은 미리 정함(재기 전에), 손으로 맞추지 않음.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url));
const C = `${process.env.SCRATCH}/p2/r6/mx/cells`;
const r3 = (x) => +x.toFixed(3);
// 골반 높이 목표 +d (m): 기본 걸음 GAIT(config.js — 독일 · 이베리아는 이것을 물려받음) 와 이탈리아 걸음(schools.js ITALIAN_GAIT — 레이피어 몸) 둘 다.
//  유파 걸음은 GAIT 기준 낮춤(lowMax 안)이라 GAIT 만 올리면 이탈리아 몸은 그대로 — 그래서 같이 올린다.
const height = (d) => [
  ['src/config.js', '  guardHeight: 0.9, // 펜싱 자세', `  guardHeight: ${r3(0.9 + d)}, // 펜싱 자세`],
  ['src/config.js', '  walkHeight: 0.978, // 걸을 때', `  walkHeight: ${r3(0.978 + d)}, // 걸을 때`],
  ['src/schools.js', 'const ITALIAN_GAIT = { guardHeight: 0.895, walkHeight: 0.965,', `const ITALIAN_GAIT = { guardHeight: ${r3(0.895 + d)}, walkHeight: ${r3(0.965 + d)},`],
];
// sp_td: 내딛는 발이 디딜 때(발 뜬 시간 몫 GAIT.reachFrom ~ reachFull 사이로 섞어) 그 다리가 무릎 GAIT.tdKnee(0.4 rad = 22.9°)로 디딜 자리에 닿는 골반 높이를
//  골반 높이 목표의 바닥으로 둔다 — 딛은 다리가 무릎 기본 굽힘(kneeBase)으로 닿는 높이(hGeo, 미리 내리기 전) 안에서만. 그 창 동안은 올라가는 빠르기 한도를 hUpWalk 대신 hUpMax.
//  (오늘: 같은 창에서 '무릎 기본 굽힘으로 닿을 만큼 내리기'만 있고 올리는 쪽은 없다 — 걷는 골반은 옆 · 뒷걸음 내림(sideDip · backDip)과 느린 되올림(hUpWalk 0.06 m/s)에 눌려 hNom 보다 3 cm 밑)
const td = [
  ['src/config.js', '  kneeBase: 0.25, // 딛은 다리 무릎 기본 굽힘(라디안)', '  kneeBase: 0.25, // 딛은 다리 무릎 기본 굽힘(라디안)\n  tdKnee: 0.4, // r22p sp_td: 내딛는 다리가 디딜 때 무릎 굽힘(라디안) — 이 굽힘으로 닿을 높이를 골반 목표 바닥으로(gait.js ⑥)'],
  ['src/gait.js', "    if (swing && !swing2 && hGeo < Infinity && (swing.kind === 'walk' || swing.kind === 'catch' || swing.kind === 'req')) {\n      const rem",
    "    let tdF = -Infinity, tdW = 0; // r22p sp_td\n    if (swing && !swing2 && hGeo < Infinity && (swing.kind === 'walk' || swing.kind === 'catch' || swing.kind === 'req')) {\n      const rem"],
  ['src/gait.js', '      if (hy < hGeo) hGeo += (hy - hGeo) * THREE.MathUtils.smoothstep(swing.t / swing.T, GAIT.reachFrom, GAIT.reachFull);\n',
    '      const Lt = legLen(GAIT.tdKnee), hG0 = hGeo; // r22p sp_td: 디딜 다리가 tdKnee 로 닿는 높이 (딛은 다리가 닿는 높이 안)\n      tdF = Math.min(hG0, (f.terrain ? swing.p1.y : ANKLE_H) + Math.sqrt(Math.max(0.04, Lt * Lt - hx * hx - hz * hz)) + HIP_DROP);\n      tdW = THREE.MathUtils.smoothstep(swing.t / swing.T, GAIT.reachFrom, GAIT.reachFull);\n      if (hy < hGeo) hGeo += (hy - hGeo) * THREE.MathUtils.smoothstep(swing.t / swing.T, GAIT.reachFrom, GAIT.reachFull);\n'],
  ['src/gait.js', '    // 딱 멈추는 2차 필터 (내려갈 땐 빨리: 다리가 닿지 않는 높이로 끌어올리지 않게)\n',
    '    if (tdW > 0 && tdF > hT) hT += (tdF - hT) * tdW; // r22p sp_td: 디딜 무릎 바닥\n    // 딱 멈추는 2차 필터 (내려갈 땐 빨리: 다리가 닿지 않는 높이로 끌어올리지 않게)\n'],
  ['src/gait.js', '    const hUp = walkNow ? GAIT.hUpWalk : GAIT.hUpMax;', '    const hUp = walkNow && !(tdW > 0 && tdF > this.h) ? GAIT.hUpWalk : GAIT.hUpMax; // r22p sp_td: 디딜 무릎 바닥 창에선 빨리 올림'],
];
// 칸: [바탕 칸, 고침들]. sp_h_td 의 높이는 48 판 결과로 고른다(상처 없는 넘어짐이 적은 쪽 · 같으면 2 cm) — 환경 변수 HBEST=2|4 로 준다(미리 정한 규칙).
const hb = +(process.env.HBEST ?? 2) / 100;
const KNOB = {
  sp_h2: ['fb_base', height(0.02)],
  sp_h4: ['fb_base', height(0.04)],
  sp_h6: ['fb_base', height(0.06)], // 감사의 말(11/27): +2 는 흔들림 안 · +4 는 밖 — 곡선이 어디서 눕는지 (선임이 더함)
  sp_td: ['fb_base', td],
  sp_h_td: ['fb_base', [...height(hb), ...td]],
  sp_combo: ['se_ecc13', [...height(hb), ...(process.env.NOTD ? [] : td)]],
};
for (const cell of process.argv.slice(2)) {
  const T = `${C}/${cell}`;
  if (existsSync(T)) { console.log(cell, '있음 — 건너뜀'); continue; }
  if (!KNOB[cell]) throw new Error('모르는 칸 ' + cell);
  const [from, edits] = KNOB[cell];
  execSync(`cp -a ${C}/${from} ${T}`);
  for (const [f, a, b] of edits) {
    const p = `${T}/${f}`, s = readFileSync(p, 'utf8');
    if (s.split(a).length !== 2) throw new Error(`${cell} ${f}: 글자가 한 번이 아님 — ${a}`);
    writeFileSync(p, s.replace(a, b));
  }
  let d = '';
  try { execSync(`diff -ru ${C}/fb_base/src ${T}/src`, { encoding: 'utf8' }); } catch (e) { d = e.stdout; }
  writeFileSync(`${HERE}/${cell}.diff`, `# 바탕 ${from} 위에 고침 · 아래 diff 는 fb_base 에 대한 것\n` + d.split(process.env.SCRATCH).join('$S'));
  console.log(cell, from, '위에 만듦', d.split('\n').filter((l) => /^[+-][^+-]/.test(l)).length, '줄 바뀜');
}
