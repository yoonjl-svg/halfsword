// r27 C1 진단: 모터 몫 자르기가 걸린 스텝을 처음 몇 개 적는다 (재기만). R27_ROOT=<칸> [R27_N=20] node --import file://<이 파일> tools/sim/fights12.mjs
//  줄: 스텝 · 싸움꾼 · 상태 · muscle · 근력 몫 F/B · 걸린 칸(관절 축) · 여유 + / − · 스프링 잘림 · d_eff ÷ d
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
const ROOT = process.env.R27_ROOT, NMAX = +(process.env.R27_N ?? 20);
const { Fighter } = await import(pathToFileURL(join(ROOT, 'src/fighter.js')).href);
let n = 0, steps = 0, cuts = 0;
const o = Fighter.prototype.driveJoints;
Fighter.prototype.driveJoints = function (...a) {
  const r = o.apply(this, a);
  steps++;
  const D = this.legDrive;
  for (const k of ['F', 'B']) {
    const L = D.legs[k];
    for (let i = 0; i < 7; i++) {
      if (!(L.mCutK[i] || L.mDf[i] < 1)) continue;
      cuts++;
      if (n++ < NMAX) process.stderr.write(`cut step ${steps} ${this.name ?? this.index} state ${this.state} muscle ${this.muscle?.toFixed?.(3)} str ${D.strengthOf('F').toFixed(3)}/${D.strengthOf('B').toFixed(3)} leg ${k} slot ${i} room ${L.mRp[i].toFixed(2)}/${L.mRm[i].toFixed(2)} cutK ${L.mCutK[i]} df ${L.mDf[i].toFixed(4)} w ${L.mW[i].toFixed(2)}\n`);
    }
  }
  return r;
};
process.on('exit', () => process.stderr.write(`first_cut: driveJoints ${steps} · 걸린 칸-스텝 ${cuts}\n`));
