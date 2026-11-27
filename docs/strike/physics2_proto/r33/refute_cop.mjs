// r33 반박 — 압력 중심 자르기를 앞뒤 · 옆으로 가르고, 수평 힘을 '자세 몫'과 '몸통 토크 몫'으로 가름 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음 · drive 를 감싸 값을 적을 뿐)
//  node refute_cop.mjs --root=<나무> [--w=rapier,longsword] [--seeds=7001-7003] [--walk=0|0.6] [--gap=2.58]
//  런지 창(lunge_trace.mjs 와 같은 뜸 ~ 디딤 + 0.1 s) 안 스텝마다 legs_vmc.js 의 셈을 다시 따라감:
//   바란 압력 중심 p = 무게중심 + (Mz − hT·Fx₀, −(Mx + hT·Fz₀)) / N  (Fx₀ = 가속 한도 뒤 바람 + push) · 쓴 압력 중심 c = LegDrive.cop
//   잘림 (c − p) 의 앞 성분 · 옆 성분 (옆 = 바라보는 쪽의 오른쪽)
//   앞 수평 힘 = [ T·fwd − ((c − 무게중심)·fwd) N ] / hT  →  자세 몫 −((c−무게중심)·fwd) N/hT · 토크 몫 T·fwd/hT (T = (Mz, −Mx) — 칼 팔 몫 hx,hz 는 빼지 않음 · 어림)
//   뒷발 뒤 가장자리(발바닥 가운데 + fx·aMin)보다 무게중심이 앞선 거리 → 몸통 토크 0 일 때 낼 수 있는 앞 힘 최고 = 그 거리 × N / hT
//   무게중심이 디딘 발(뒷발) 발바닥 가운데에서 옆으로 떨어진 거리
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList } = await imp('tools/sim/wb_measure.mjs');
const { LegDrive } = await imp('src/legs_vmc.js');
const { LEGS } = await imp('src/config.js');
const { runLunge } = await import('./lunge_lib.mjs');
const M = makeMeasure(H); const { THREE, DT } = H; const g = 9.81;
const WS = String(args.w ?? 'rapier,longsword').split(','); const seeds = seedList(args.seeds ?? '7001-7003');
const GAP = +(args.gap ?? 2.58); const WALK = +(args.walk ?? 0);
let cur = null;
const oD = LegDrive.prototype.drive;
LegDrive.prototype.drive = function (...a) {
  const it0 = this.intent; const w0 = it0 ? { x: it0.want.x, z: it0.want.z, aLim: it0.aLim } : null; const push0 = { x: this.push.x, z: this.push.z };
  const r = oD.apply(this, a);
  if (cur && this.f === cur.P && w0 && this.f.com && this.dbg.on) {
    const f = this.f, d = this.dbg, fw = cur.fwd, rt = { x: -fw.z, z: fw.x }; const Mb = f.totalMass + (f.armed && f.sword ? f.sword.mass() : 0); const cv = f.comVel, com = f.com;
    const fl = Mb * w0.aLim; const cl = (v) => Math.max(-fl, Math.min(fl, v));
    const Fx0 = cl(Mb * LEGS.velGain * (w0.x - cv.x)) + push0.x, Fz0 = cl(Mb * LEGS.velGain * (w0.z - cv.z)) + push0.z;
    const hT = g / (this.w0 * this.w0); const N = d.N;
    const px = com.x + (d.Mz - hT * Fx0) / N, pz = com.z - (d.Mx + hT * Fz0) / N; const c = this.cop;
    const qf = (c.x - px) * fw.x + (c.z - pz) * fw.z, qs = (c.x - px) * rt.x + (c.z - pz) * rt.z;
    const ccf = (c.x - com.x) * fw.x + (c.z - com.z) * fw.z;
    const geo = (-ccf * N) / hT / (Mb * g), tor = ((d.Mz * fw.x - d.Mx * fw.z) / hT) / (Mb * g);
    let heel = null, lat = null; const on = ['F', 'B'].filter((k) => this.legs[k].on);
    if (on.length === 1) { const L = this.legs[on[0]]; const hx = L.sole.x + L.fx.x * L.aMin, hz = L.sole.z + L.fx.z * L.aMin; heel = ((com.x - hx) * fw.x + (com.z - hz) * fw.z); lat = (com.x - L.sole.x) * rt.x + (com.z - L.sole.z) * rt.z; }
    cur.drv = { qf, qs, geo, tor, Fcop: (d.Fx * fw.x + d.Fz * fw.z) / (Mb * g), Fcap: (Fx0 * fw.x + Fz0 * fw.z) / (Mb * g), n1: on.length, heel, lat, geoMax: heel != null ? (heel * N) / hT / (Mb * g) : null, hT };
  }
  return r;
};
const out = [];
for (const W of WS) for (const seed of seeds) {
  const rows = []; cur = { P: null, fwd: null, drv: null };
  runLunge(M, H, seed, W, { gap: GAP, walk: WALK, post: 1.0,
    onTap: (G, P, E) => { cur.P = P; cur.fwd = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading)); },
    onStep: (G, P, E, i) => { const s = M.sample(P); if (!s) return; const fw = cur.fwd; const fp = P.bodies.footF.translation(), bp = P.bodies.footB.translation();
      rows.push({ i, onF: s.onF, onB: s.onB, xF: fp.x * fw.x + fp.z * fw.z, xB: bp.x * fw.x + bp.z * fw.z, PF: s.Px * fw.x + s.Pz * fw.z, M: s.M, st: P.state, drv: cur.drv }); cur.drv = null; } });
  cur = null;
  const FR = rows[0].xF >= rows[0].xB ? 'F' : 'B'; const onK = 'on' + FR;
  let lift = null, land = null; for (let k = 1; k + 2 < rows.length && lift == null; k++) if (rows[k - 1][onK] && !rows[k][onK] && !rows[k + 1][onK] && !rows[k + 2][onK]) lift = k;
  if (lift != null) for (let k = lift + 1; k + 2 < rows.length; k++) if (rows[k][onK] && rows[k + 1][onK] && rows[k + 2][onK]) { land = k; break; }
  const a = lift ?? 0, b = Math.min(rows.length - 1, (land ?? a + 48) + 12);
  let n = 0, nF = 0, nS = 0, sCap = 0, sCop = 0, sGeo = 0, sTor = 0, sGeoMax = 0, n1 = 0; const lats = [], heels = [];
  for (let k = a; k <= b; k++) { const d = rows[k].drv; if (!d) continue; n++; if (Math.abs(d.qf) > 0.005) nF++; if (Math.abs(d.qs) > 0.005) nS++; sCap += d.Fcap * g * DT; sCop += d.Fcop * g * DT; sGeo += d.geo * g * DT; sTor += d.tor * g * DT; if (d.n1 === 1) { n1++; sGeoMax += d.geoMax * g * DT; lats.push(d.lat); heels.push(d.heel); } }
  const med = (x) => { const y = [...x].sort((p, q) => p - q); return y.length ? y[(y.length - 1) >> 1] : NaN; }; const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : '-');
  const dAct = (rows[b].PF - rows[a].PF) / rows[a].M;
  const s = { W, seed, walk: WALK, n, n1, fClipFwd: +(nF / n).toFixed(2), fClipSide: +(nS / n).toFixed(2), dvCap: +sCap.toFixed(3), dvCop: +sCop.toFixed(3), dvGeo: +sGeo.toFixed(3), dvTor: +sTor.toFixed(3), dvGeoMax1: +sGeoMax.toFixed(3), dvAct: +dAct.toFixed(3), heelMed: f3(med(heels)), latMed: f3(med(lats)), fell: rows.some((r) => r.st !== 'stand') };
  out.push(s);
  console.log(`${W} ${seed} walk ${WALK} | 창 스텝 ${n} (한 발 ${n1}) | 잘림 앞>5mm ${s.fClipFwd} · 옆>5mm ${s.fClipSide} | Δv 한도뒤 ${s.dvCap} → 압중뒤 ${s.dvCop} = 자세 몫 ${s.dvGeo} + 토크 몫 ${s.dvTor} | 한 발 동안 자세 몫 최고(토크 0 · 뒤꿈치 끝) ${s.dvGeoMax1} | 실제 ${s.dvAct} | 무게중심−뒷발 뒤끝 가운데 ${s.heelMed} m · 옆 어긋남 ${s.latMed} m | 넘어짐 ${s.fell ? '예' : '-'}`);
}
