// t_sens.mjs — 민감도: 롱소드 · 크게 감기 · 땅 135 를 바탕으로 한 가지씩 바꿈. (ii) 는 줄마다 켜지는 때를 다시 찾는다. 약 4 분.
//   node t_sens.mjs [--fams=diag,vert,horiz]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadRapier, HERE, args, fmt } from './lib.mjs';
import { runCut, FAMS } from './cuts.mjs';
import { searchII, gainsI } from './tune.mjs';
const R = await loadRapier();
const fams = String(args.fams ?? 'diag,vert,horiz').split(',');
const GI = gainsI();
const V = [
  ['바탕 (출처 있는 한도 · 두 손목 24.4 · 땅 135 빠르기 한계 없음)', {}],
  ['힘 표 0.5', { strength: 0.5 }], ['힘 표 0.8', { strength: 0.8 }], ['힘 표 1.2', { strength: 1.2 }],
  ['손목 12 N·m (한 손목 몫)', { wristCap: 12 }], ['손목 25 N·m', { wristCap: 25 }],
  ['빈손 없이 (한 손 · 손목 12.2)', { twoHand: false }],
  ['손목 근육 0 (풀린 뒤 수동 경첩)', { wristPassive: true }, 'ii'],
  ['함께 시작 (켜지는 때 모두 0)', { fixed: [0, 0, 0] }, 'ii'],
  ['버팀 없이 (켜지기 전 관절 토크 0)', { hold: false }, 'ii'],
  ['땅에 힘–빠르기 16 rad/s (평면 어림의 가정)', { groundVmax: 16 }], ['땅에 힘–빠르기 20 rad/s (엉덩관절 자료 꼴)', { groundVmax: 20 }],
  ['땅 60', { yawCap: 60 }], ['땅 180', { yawCap: 180 }],
  ['다리 yaw 관성 0.25', { legsI: 0.25 }], ['다리 yaw 관성 0.84', { legsI: 0.84 }],
  ['골반 범위 ±30° (기본 ±45°)', { pelLim: 30 * Math.PI / 180 }],
  ['과제의 시작 값 (몸통 120 · 300 · 어깨 100 · 팔꿈치 80 · 손목 25 · 몸통 8 rad/s · 버팀 1.3)', { human: 'start', wristCap: 25 }],
  ['힘–빠르기 끔 (등척 한도만)', { hill: false }],
  ['활성 오름 20 ms', { tAct: 0.02 }], ['활성 오름 60 ms', { tAct: 0.06 }],
  ['엔진: 내부 PGS 1', { pgs: 1 }], ['엔진: 내부 PGS 8', { pgs: 8 }], ['엔진: 풀이 반복 12', { iters: 12 }],
];
const L = []; const P = (x) => L.push(x);
P('# 표 S — 민감도 (롱소드 · 크게 감기 · 땅 135 N·m 바탕). 칸 = 칼날 70 % 최고 m/s / 칼 KE J / 겨눈 선에서 m/s / 벗어남 m / 선까지 ms / 땅 각충격 N·m·s / 잔차 J');
for (const style of ['ii', 'i']) {
  P(''); P(`## ${style === 'ii' ? '(ii) 차례 활성 — 줄마다 켜지는 때를 다시 찾음 (괄호 = 어깨/팔꿈치/손목 풀림 ms)' : '(i) 끝점 힘 — 이득 한 벌 ' + JSON.stringify(GI)}`);
  P('바꾼 것 | ' + fams.map((f) => FAMS[f].ko).join(' | ') + ' | 세 획 가운데값: 칼날 70 % · KE (바탕 대비)'); P('---|' + fams.map(() => '---').join('|') + '|---');
  let base = null;
  for (const [name, ov, only] of V) {
    if (only && only !== style) continue;
    const cells = []; const vs = [], ks = [];
    for (const fam of fams) {
      const { fixed, ...o } = ov; const b0 = { weapon: 'longsword', fam, size: 'large', yawCap: 135, ...o };
      let s, tag = '';
      if (style === 'i') s = runCut(R, { ...b0, style: 'i', ...GI }).sum;
      else { const d = fixed ? { tSh: fixed[0], tEl: fixed[1], tWr: fixed[2] } : searchII(R, b0); s = runCut(R, { ...b0, style: 'ii', tSh: d.tSh, tEl: d.tEl, tWr: d.tWr }).sum; tag = ` (${[d.tSh, d.tEl, d.tWr].map((x) => fmt(x * 1000, 0)).join('/')})`; }
      vs.push(s.v70); ks.push(s.keS);
      cells.push(`${fmt(s.v70)} / ${fmt(s.keS, 0)} / ${s.cross ? fmt(s.cross.v70) : '–'} / ${s.cross ? fmt(s.cross.dev, 2) : '–'} / ${s.tCross ? fmt(s.tCross * 1000, 0) : '–'} / ${fmt(s.impG, 1)} / ${fmt(s.resid, 1)}${tag}`);
    }
    const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const mv = med(vs), mk = med(ks); if (!base) base = { mv, mk };
    P(`${name} | ${cells.join(' | ')} | ${fmt(mv)} m/s (× ${fmt(mv / base.mv, 2)}) · ${fmt(mk, 0)} J (× ${fmt(mk / base.mk, 2)})`);
    process.stderr.write(`\r${style} ${name}                    `);
  }
}
process.stderr.write('\n');
writeFileSync(join(HERE, 'out/sens.txt'), L.join('\n') + '\n'); console.log(L.join('\n'));
