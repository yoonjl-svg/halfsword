// r27 C1: 세계 스텝마다 모든 싸움꾼의 골반 · 두 발 자리(f64 그대로)를 이진 파일에 적는다 — 두 칸의 파일을 cmp 로 비트까지 견준다 (재기만).
//  쓰는 법: R27_ROOT=<칸> R27_TRACE=<나옴.bin> node --import file://<이 파일> tools/sim/fights12.mjs
//  줄 하나 = [세계 번호, 스텝 번호, 싸움꾼 번호, 골반 xyz, footF xyz, footB xyz] (f64 12 개). 끝에 줄 수를 stderr 로.
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { openSync, writeSync, closeSync } from 'node:fs';
const ROOT = process.env.R27_ROOT;
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
const { Fighter } = await import(u('src/fighter.js'));
const fd = openSync(process.env.R27_TRACE, 'w');
const FS = new Set(), WID = new WeakMap(), SN = new WeakMap();
let nW = 0, rows = 0;
const buf = new Float64Array(12);
const oF = Fighter.prototype.step;
Fighter.prototype.step = function (dt) { FS.add(this); return oF.call(this, dt); };
const oS = RAPIER.World.prototype.step;
RAPIER.World.prototype.step = function (...a) {
  const r = oS.apply(this, a);
  if (!WID.has(this)) WID.set(this, nW++);
  const s = (SN.get(this) ?? 0) + 1; SN.set(this, s);
  let fi = 0;
  for (const f of FS) {
    if (f.world !== this) continue;
    buf[0] = WID.get(this); buf[1] = s; buf[2] = fi++;
    let o = 3;
    for (const n of ['pelvis', 'footF', 'footB']) { const b = f.bodies[n]; const t = b ? b.translation() : { x: NaN, y: NaN, z: NaN }; buf[o++] = t.x; buf[o++] = t.y; buf[o++] = t.z; }
    writeSync(fd, new Uint8Array(buf.buffer)); rows++;
  }
  return r;
};
process.on('exit', () => { closeSync(fd); process.stderr.write(`r27 trace rows ${rows}\n`); });
