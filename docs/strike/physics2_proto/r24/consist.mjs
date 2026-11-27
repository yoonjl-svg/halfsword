// r24 읽기 지적 1 재기: 다리 명시 근육(legMuscle)이 건 토크가 '엔진 모터라면 냈을 토크'와 같은가 — 같은 판 · 같은 스텝에서.
//  엔진 모터는 관절 · 접촉과 한 풀이 안에서 스텝 끝 관절 빠르기를 보고 건다 (작은 스텝마다 τ = k e + c (tv − ω_끝)). 명시 근육(legMuscleSolve)은 그 끝 빠르기를 K 로 내다본다.
//  그래서 스텝 뒤 실제 관절 빠르기로 같은 법칙을 다시 세면(작은 스텝 n 개 · ω 는 처음 → 실제 끝을 곧게 이음) 그것이 '엔진이라면' 값이고,
//  건 값이 그보다 작으면 K 가 너무 크다(저쪽 몸을 너무 가볍게 봄). 축마다 기울기 = Σ 건·셈 / Σ 셈² · 크기 비 = p50 · p90 |건| / |셈|.
//  쓰는 법: R24_ROOT=<나무> R24_CONS=<나옴.json>
//          node --import file://<이 파일> tools/sim/<도구>.mjs ...
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
const ROOT = process.env.R24_ROOT;
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
const { Fighter } = await import(u('src/fighter.js'));
const THREE = await import(u('node_modules/three/build/three.module.js'));
const pend = new Map(); // world → [{ j, st, kind }]
const acc = {}; // 'S thigh x' → { ac, cc, ra: [|a|], rc: [|c|], n }
const own = Fighter.prototype.legMuscleSolve;
const _q = new THREE.Quaternion(), _w = new THREE.Vector3();
Fighter.prototype.legMuscleSolve = function () {
  const r = own.call(this);
  const W = this.world;
  if (!pend.has(W)) pend.set(W, []);
  for (const j of this.lcJoints || []) pend.get(W).push({ j, st: !!this.gait?.legs?.[j.name.slice(-1)]?.stance, kind: j.name.slice(0, -1) });
  return r;
};
const W0 = RAPIER.World.prototype;
const oStep = W0.step;
W0.step = function (...args) {
  const r = oStep.apply(this, args);
  const L = pend.get(this);
  if (L && L.length) {
    for (const { j, st, kind } of L) {
      const s = j.lmSt;
      if (!s) continue;
      const wc = j.child.angvel(), wp = j.parent.angvel();
      _q.copy(s.qp).invert();
      const wE = _w.set(wc.x - wp.x, wc.y - wp.y, wc.z - wp.z).applyQuaternion(_q);
      const axes = j.type === 'hinge' ? ['z'] : ['x', 'y', 'z'];
      for (const ax of axes) {
        let e = s.e0[ax], sum = 0;
        for (let m = 0; m < s.n; m++) {
          const w1 = s.w0[ax] + ((m + 1) / s.n) * (wE[ax] - s.w0[ax]);
          sum += s.k * e + s.c * (s.tv[ax] - w1);
          e -= s.h * w1;
        }
        const c = sum / s.n, a = s.tau[ax];
        const key = `${st ? 'S' : 'W'} ${kind} ${ax}`;
        const o = (acc[key] ||= { ac: 0, cc: 0, ra: [], rc: [], n: 0 });
        o.ac += a * c; o.cc += c * c; o.ra.push(Math.abs(a)); o.rc.push(Math.abs(c)); o.n++;
      }
    }
    L.length = 0;
  }
  return r;
};
const q = (v, p) => { if (!v.length) return NaN; const s = [...v].sort((x, y) => x - y); return s[Math.floor(p * (s.length - 1))]; };
process.on('exit', () => {
  const out = {};
  for (const [k, o] of Object.entries(acc).sort()) out[k] = { n: o.n, slope: +(o.ac / Math.max(1e-12, o.cc)).toFixed(3), a50: +q(o.ra, 0.5).toFixed(3), c50: +q(o.rc, 0.5).toFixed(3), a90: +q(o.ra, 0.9).toFixed(3), c90: +q(o.rc, 0.9).toFixed(3) };
  if (process.env.R24_CONS) writeFileSync(process.env.R24_CONS, JSON.stringify({ axes: out }, null, 1));
  process.stderr.write(`r24 consist:\n` + Object.entries(out).map(([k, v]) => `  ${k.padEnd(12)} n ${v.n} slope ${v.slope} |a| p50 ${v.a50} p90 ${v.a90} · law p50 ${v.c50} p90 ${v.c90}`).join('\n') + '\n');
});
