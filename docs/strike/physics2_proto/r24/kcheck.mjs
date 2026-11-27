// r24 읽기 지적 1: 다리 근육 셈이 쓰는 이동성 K (legChainK · lcAxisK — 축 14 × 14)를 엔진의 참값과 견준다.
//  참값: world.step 바로 앞 사본(takeSnapshot)을 그대로 한 번 · 축 i 마다 그 관절 두 몸에 짝 토크 T0 u_i 를 더 걸어 한 번 돌려
//   (같은 접촉 걸이) 축마다 관절 상대 각속도 바뀜 ÷ (T0 dt) = K_참 의 i 열. 사본에는 다른 관절 엔진 모터 · 접촉이 모두 들어 있다.
//  쓰는 법: R24_ROOT=<나무> R24_KC=<나옴.jsonl> [R24_KC_EVERY=30] node --import file://<이 파일> tools/sim/<도구>.mjs ...
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { appendFileSync, writeFileSync } from 'node:fs';
const ROOT = process.env.R24_ROOT;
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const RAPIER = (await import(u('node_modules/@dimforge/rapier3d-compat/rapier.mjs'))).default;
const FM = await import(u('src/fighter.js'));
const EVERY = +(process.env.R24_KC_EVERY ?? 30);
const OUT = process.env.R24_KC;
if (OUT) writeFileSync(OUT, '');
const T0 = 2;
const pend = new Map();
const ownSolve = FM.Fighter.prototype.legMuscleSolve;
FM.Fighter.prototype.legMuscleSolve = function () {
  const r = ownSolve.call(this);
  const N = this.lcN, C = FM.LEG_CHAIN, M = C.max;
  if (!N) return r;
  const K = [], U = [], J = [];
  for (let i = 0; i < N; i++) {
    K.push(Array.from({ length: N }, (_, jj) => C.K[i * M + jj]));
    U.push([C.U[i * 3], C.U[i * 3 + 1], C.U[i * 3 + 2]]);
    const j = this.lcJoints[C.owner[i]];
    const lg = this.gait?.legs?.[j.name.slice(-1)]; J.push({ n: j.name, q: C.q[i], ch: j.child.handle, ph: j.parent.handle, st: !!lg?.stance, N: lg?.stance ? +(lg.N / (this.totalMass * 9.81)).toFixed(3) : 0 });
  }
  if (!pend.has(this.world)) pend.set(this.world, []);
  pend.get(this.world).push({ who: this.name ?? this.index, K, U, J });
  return r;
};
const W0 = RAPIER.World.prototype;
const oStep = W0.step;
let s = 0;
const rel = (W, a) => { const C = W.getRigidBody(a.ch).angvel(), P = W.getRigidBody(a.ph).angvel(); return [C.x - P.x, C.y - P.y, C.z - P.z]; };
W0.step = function (eq, hooks) {
  const L = pend.get(this);
  s++;
  if (L && L.length && s % EVERY === 0) {
    const snap = this.takeSnapshot();
    const run = (extra) => {
      const W = RAPIER.World.restoreSnapshot(snap);
      if (extra) { const [a, uu] = extra; W.getRigidBody(a.ch).addTorque({ x: T0 * uu[0], y: T0 * uu[1], z: T0 * uu[2] }, true); W.getRigidBody(a.ph).addTorque({ x: -T0 * uu[0], y: -T0 * uu[1], z: -T0 * uu[2] }, true); }
      const q = new RAPIER.EventQueue(true);
      oStep.call(W, q, hooks);
      q.free();
      const out = [];
      for (const F of L) out.push(F.J.map((a, i) => { const w = rel(W, a); return w[0] * F.U[i][0] + w[1] * F.U[i][1] + w[2] * F.U[i][2]; }));
      W.free();
      return out;
    };
    const y0 = run(null);
    const dt = this.timestep;
    L.forEach((F, fi) => {
      const N = F.J.length, Kt = Array.from({ length: N }, () => new Array(N).fill(0));
      for (let i = 0; i < N; i++) {
        const y = run([F.J[i], F.U[i]])[fi];
        for (let r = 0; r < N; r++) Kt[r][i] = (y[r] - y0[fi][r]) / (T0 * dt);
      }
      if (OUT) appendFileSync(OUT, JSON.stringify({ s, who: F.who, J: F.J.map((a) => [a.n, a.q, a.st ? 1 : 0, a.N]), K: F.K.map((r) => r.map((v) => +v.toPrecision(4))), Kt: Kt.map((r) => r.map((v) => +v.toPrecision(4))) }) + '\n');
    });
  }
  if (L) L.length = 0;
  return oStep.call(this, eq, hooks);
};
