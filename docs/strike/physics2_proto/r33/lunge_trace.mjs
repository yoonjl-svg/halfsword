// r33 런지 진단 — 사람 길 탭 찌르기 런지 한 판을 스텝마다 적음 (읽기만 — 몸에 힘 · 빠르기를 걸지 않음 · 원래 함수를 감싸 값을 적을 뿐)
//  node lunge_trace.mjs --root=<나무> [--w=rapier,longsword] [--seeds=4001-4003] [--gap=2.58] [--walk=0 | 0.6] [--tap=thrust|riso] [--post=1.5] [--every=3] [--json=파일] [--quiet]
//   장면 = lunge_lib.mjs runLunge (walk 0 = tools/sim/wb_measure.mjs runThrust · 관문 먼 장면과 같은 틀 · 두 발 나란히 섬 / walk 0.6 = 먼저 걸어 펜싱 자세로 섬) · gap = 탭 때 골반 간격 · 기본 키 1.72 × 1.5
//   감싸는 것: LegDrive.prototype.drive (src/legs_vmc.js) — 부른 뒤 그 스텝의 뜻(legIntent.want · aLim) · 무게중심 속도 · 바란 수평 땅 반력(가속 한도 앞 · 뒤) ·
//    압력 중심 · 마찰로 자른 뒤 수평 힘(dbg.Fx/Fz) · 다리마다 받기로 한 땅 반력(Gx/Gy/Gz) · 다리 관절의 바란 토크(raw — 한도 앞) ÷ 한도(legLimit · 받는 쪽 ecc 배율 포함)를 읽음.
//   실제 땅 반력(수평) = 온몸 + 칼 운동량의 앞 성분 변화 ÷ 시간 (±2 스텝 · 상대가 멀어 닿지 않으니 수평 밖 힘은 땅뿐) · 발마다 수직 = 엔진 접촉 법선 충격량 ÷ dt
//   줄마다 요약: 런지 창(앞발 뜸 ~ 디딤 + 0.1 s) 안 Δv 쪼개기 — ∫(가속 한도 없는 바람) · ∫(가속 한도 뒤) · ∫(압력 중심 · 마찰 뒤) · 실제 Δv(운동량) ÷ 몸무게
//   · 한도에 걸린 스텝 몫 · 관절 바람 ÷ 한도 최고 · 마찰 쓰임 · 부탁 걸음 길이와 실제 · 손 빠르기.
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList } = await imp('tools/sim/wb_measure.mjs');
const { LegDrive, legLimit } = await imp('src/legs_vmc.js');
const { LEGS, GAIT } = await imp('src/config.js');
const { runLunge } = await import('./lunge_lib.mjs');
const TAP = String(args.tap ?? 'thrust'); // thrust = 사람 탭 찌르기(skill.thrust) · riso = 안다레 리솔루토 런지 비기(게임 길: PlayerSecretWatch 창 열기 → fire → skill.secret — tools/sim/riso_reach.mjs lungeAt 과 같은 부름)
const RS = TAP === 'riso' ? { ...(await imp('src/secret.js')), ...(await imp('src/parry_button.js')) } : null;
let foeE = null;
const tapFn = TAP === 'riso' ? (P) => { const pg = new RS.PlayerParryGuard(P, foeE); P.stamina.controller = pg; const ps = new RS.PlayerSecretWatch(P, foeE); ps.openWindow({ ev: 'risoluto', path: 'touch', held: 0 }); const o = ps.fire(); return !!(o && P.skill.secret(o)); } : undefined;
const M = makeMeasure(H); const { THREE, DT } = H; const g = 9.81;
const WS = String(args.w ?? 'rapier,longsword').split(','); const seeds = seedList(args.seeds ?? '4001-4003');
const GAP = +(args.gap ?? 1.72 * 1.5); const POST = +(args.post ?? 1.5); const EVERY = +(args.every ?? 3); const WALK = +(args.walk ?? 0); // walk > 0: 탭 앞에 스틱을 앞으로 walk 초 → 펜싱 자세로 섬 (lunge_lib.mjs)
const f2 = (x, d = 2) => (x == null || !Number.isFinite(x) ? '-' : x.toFixed(d));
// 관절 바람 ÷ 한도 (clampLeg 와 같은 셈: + 쪽 한도 hi · − 쪽 한도 lo · 관절 빠르기 w 로 받는 쪽 배율)
const ratio = (t, w, lo, hi, str) => (t >= 0 ? t / legLimit(hi, str, w) : -t / legLimit(lo, str, -w));
let cur = null;
const oD = LegDrive.prototype.drive;
LegDrive.prototype.drive = function (...a) {
  const it0 = this.intent; const want0 = it0 ? { x: it0.want.x, z: it0.want.z, aLim: it0.aLim } : null; // drive 가 intent 를 비우므로 앞서 베낌
  const r = oD.apply(this, a);
  if (cur && this.f === cur.P) {
    const f = this.f, it = want0 ? { want: want0, aLim: want0.aLim } : null, d = this.dbg, fw = cur.fwd; const lim = LEGS.limit;
    const Mb = f.totalMass + (f.armed && f.sword ? f.sword.mass() : 0);
    const o = { ok: !!(it && f.state === 'stand' && f.com), on: d.on };
    if (o.ok) {
      const cv = f.comVel; o.want = it.want.x * fw.x + it.want.z * fw.z; o.aLim = it.aLim; o.cvF = cv.x * fw.x + cv.z * fw.z;
      const ux = Mb * LEGS.velGain * (it.want.x - cv.x), uz = Mb * LEGS.velGain * (it.want.z - cv.z); const fl = Mb * it.aLim;
      o.Fraw = (ux * fw.x + uz * fw.z) / (Mb * g); // 가속 한도 앞 바람 (÷ 몸무게)
      o.Fcap = (Math.max(-fl, Math.min(fl, ux)) * fw.x + Math.max(-fl, Math.min(fl, uz)) * fw.z) / (Mb * g); // 가속 한도 뒤
      o.capHit = Math.abs(ux) > fl || Math.abs(uz) > fl;
      o.Fcop = d.on ? (d.Fx * fw.x + d.Fz * fw.z) / (Mb * g) : 0; // 압력 중심 · 마찰 뒤 (발이 받기로 한 것)
      o.N = d.on ? d.N / (Mb * g) : 0; o.clip = d.on ? d.clipped : 0;
      o.legs = {};
      for (const k of ['F', 'B']) {
        const L = this.legs[k]; if (!L.on) { o.legs[k] = null; continue; }
        const str = this.strengthOf(k); const R = L.raw;
        o.legs[k] = { G: (L.Gx * fw.x + L.Gz * fw.z) / (Mb * g), N: L.Gy / (Mb * g), mu: L.Gy > 1 ? Math.hypot(L.Gx, L.Gz) / L.Gy : 0,
          hip: ratio(R.hz, L.wH.z, lim.hipFlex, lim.hipFlex, str), abd: ratio(R.hx, L.wH.x, lim.hipAbd, lim.hipAbd, str), knee: ratio(R.k, L.wK, lim.kneeExt, lim.kneeFlex, str), ank: ratio(R.az, L.wA.z, lim.ankleDorsi, lim.anklePlantar, str),
          rot: ratio(R.hy, L.wH.y, lim.hipRot, lim.hipRot, str), inv: ratio(R.ax, L.wA.x, lim.ankleInv, lim.ankleInv, str), arot: ratio(R.ay, L.wA.y, lim.ankleRot, lim.ankleRot, str) }; // (짓기 1: 엉덩 돌림 · 발목 젖힘(안팎) · 발목 돌림 더함 — clampLeg 의 일곱 자르기 모두)
      }
    }
    cur.drv = o;
  }
  return r;
};
function normalN(f, rb) { let J = 0; for (let ci = 0, nc = rb.numColliders(); ci < nc; ci++) { const col = rb.collider(ci); f.world.contactPairsWith(col, (other) => { if (!other.parent()?.isFixed()) return; f.world.contactPair(col, other, (m) => { for (let k = 0, nk = m.numContacts(); k < nk; k++) J += Math.abs(m.contactImpulse(k)); }); }); } return J / DT; }
const allRuns = [];
for (const W of WS) for (const seed of seeds) {
  const rows = [];
  cur = { P: null, fwd: null, drv: null };
  const res = runLunge(M, H, seed, W, { gap: GAP, walk: WALK, post: POST,
    tap: tapFn, onTap: (G, P, E) => { foeE = E; P.foe = E; E.foe = P; cur.P = P; cur.fwd = new THREE.Vector3(Math.cos(P.heading), 0, -Math.sin(P.heading)); },
    onStep: (G, P, E, i) => {
      const s = M.sample(P); if (!s) return; const gt = P.gait; const fw = cur.fwd;
      const req = gt?.req; const sw = gt ? (!gt.legs.F.stance && gt.legs.F.kind === 'req' ? gt.legs.F : !gt.legs.B.stance && gt.legs.B.kind === 'req' ? gt.legs.B : null) : null;
      const reqWant = req && sw ? (req.fwd * 0.8 * (req.push ?? 1)) / (sw.T + 0.15) : null; // gait.js 1423 의 런지 몫(legVmax 자르기 앞)
      const pv = P.bodies.pelvis.linvel(); const fp = P.bodies.footF.translation(), bp = P.bodies.footB.translation();
      rows.push({ i, t: (i + 1) * DT, pelF: pv.x * fw.x + pv.z * fw.z, PF: s.Px * fw.x + s.Pz * fw.z, M: s.M, hH: s.hH, tipSp: s.tipSp, onF: s.onF, onB: s.onB, NF: normalN(P, P.bodies.footF) / (s.M * g), NB: normalN(P, P.bodies.footB) / (s.M * g),
        xF: fp.x * fw.x + fp.z * fw.z, xB: bp.x * fw.x + bp.z * fw.z, py: P.bodies.pelvis.translation().y, cx: P.com ? P.com.x * fw.x + P.com.z * fw.z : NaN, cy: P.com?.y ?? NaN,
        req: req ? { kind: req.kind, fwd: req.fwd, push: req.push ?? 1, accel: !!req.accel } : null, reqLeg: sw ? (sw === gt.legs.F ? 'F' : 'B') : null, swT: sw?.T ?? null, swt: sw?.t ?? null, reqWant, legV: gt?.legV?.() ?? null,
        lb: !!gt?.lungeBrake, st: P.state, tap: P.skill.tap ? +P.skill.tap.t.toFixed(3) : null, push: !!P.skill.thrustPush, drv: cur.drv });
      cur.drv = null;
    } });
  cur = null;
  // 실제 수평 땅 반력 ÷ 몸무게 (운동량 ±2 스텝)
  for (let k = 0; k < rows.length; k++) { const a = rows[Math.max(0, k - 2)], b = rows[Math.min(rows.length - 1, k + 2)]; rows[k].Fact = (b.PF - a.PF) / ((b.i - a.i) * DT) / (rows[k].M * g); }
  // 앞발 = 탭 때 더 앞에 있는 발 · 뜸 = 그 발이 3 스텝 내리 떨어진 첫 스텝 · 디딤 = 그 뒤 3 스텝 내리 닿은 첫 스텝
  // (짓기 1 고침: 앞발 = 런지 부탁 걸음으로 뜬 발 — 탭 때 발 몸체 자리로 고르면 고쳐 딛던 발이 떠 있을 때 뒤집힘(레이피어 펜싱 자세 '걸음 실제 −0.00' 의 까닭). 부탁 걸음이 없으면 예전대로)
  const rq = rows.find((r) => r.reqLeg); const FR = rq ? rq.reqLeg : rows[0].xF >= rows[0].xB ? 'F' : 'B', RE = FR === 'F' ? 'B' : 'F'; const onK = 'on' + FR;
  let lift = null, land = null; for (let k = 1; k + 2 < rows.length && lift == null; k++) if (rows[k - 1][onK] && !rows[k][onK] && !rows[k + 1][onK] && !rows[k + 2][onK]) lift = k;
  if (lift != null) for (let k = lift + 1; k + 2 < rows.length; k++) if (rows[k][onK] && rows[k + 1][onK] && rows[k + 2][onK]) { land = k; break; }
  const x0 = rows[0]['x' + FR];
  const a = lift ?? 0, b = Math.min(rows.length - 1, (land ?? a + 48) + 12);
  let dRaw = 0, dCap = 0, dCop = 0, nCap = 0, nAll = 0, nClip = 0; let pk = { hip: 0, knee: 0, ank: 0, abd: 0, rot: 0, inv: 0, arot: 0 }, pkF = { hip: 0, knee: 0, ank: 0, abd: 0, rot: 0, inv: 0, arot: 0 }, nSat = 0, muMax = 0, wantMax = 0, reqMax = 0, reqFwd = null;
  for (let k = a; k <= b; k++) { const r = rows[k], d = r.drv; if (!d?.ok) continue; nAll++; dRaw += d.Fraw * g * DT; dCap += d.Fcap * g * DT; dCop += d.Fcop * g * DT; if (d.capHit) nCap++; if (d.clip > 1e-4) nClip++; wantMax = Math.max(wantMax, d.want); if (r.reqWant) reqMax = Math.max(reqMax, r.reqWant); if (r.req) reqFwd = r.req.fwd;
    const LB = d.legs[RE]; if (LB) { for (const j of Object.keys(pk)) pk[j] = Math.max(pk[j], LB[j]); if (Math.max(...Object.keys(pk).map((j) => LB[j])) > 1) nSat++; } const LF = d.legs[FR]; if (LF) for (const j of Object.keys(pkF)) pkF[j] = Math.max(pkF[j], LF[j]);
    if (!r[onK] && r['on' + RE]) { const Fh = Math.abs(r.Fact), Nn = r['N' + RE]; if (Nn > 0.2) muMax = Math.max(muMax, Fh / Nn); } }
  // 받기 (Q3): 앞발 디딘 뒤 0.5 s — 앞다리 관절 바람 ÷ 한도 최고 · 한도 넘는 스텝 · 앞발 미끄러짐(디딘 자리에서 앞뒤로 가장 멀어진 거리) · 앞발 수직 최고 ÷ 몸무게 · 무게중심 앞 빠르기가 0.1 m/s 밑으로 든 때
  let rcv = null; if (land != null) { const e = Math.min(rows.length - 1, land + Math.round(0.5 / DT)); const pkR = { hip: 0, knee: 0, ank: 0, abd: 0, rot: 0, inv: 0, arot: 0 }; let nS = 0, nA = 0, slip = 0, Nmax = 0, tStop = null;
    for (let k = land; k <= e; k++) { const r = rows[k], d = r.drv; slip = Math.max(slip, Math.abs(r['x' + FR] - rows[land]['x' + FR])); Nmax = Math.max(Nmax, r['N' + FR]); if (tStop == null && d?.ok && d.cvF < 0.1) tStop = +((k - land) * DT).toFixed(3); const LF = d?.legs?.[FR]; if (!LF) continue; nA++; for (const j of Object.keys(pkR)) pkR[j] = Math.max(pkR[j], LF[j]); if (Math.max(...Object.keys(pkR).map((j) => LF[j])) > 1) nS++; }
    rcv = { peak: Object.fromEntries(Object.entries(pkR).map(([k, v]) => [k, +v.toFixed(2)])), sat: nS, n: nA, slip: +slip.toFixed(3), Nmax: +Nmax.toFixed(2), tStop }; }
  const geo = (k) => { const r = rows[k]; return r ? { d: +(r.cx - r['x' + RE]).toFixed(3), h: +r.cy.toFixed(3), spread: +(r['x' + FR] - r['x' + RE]).toFixed(3) } : null; }; // 무게중심이 뒷발(발 몸체 가운데)보다 앞선 거리 · 무게중심 높이 · 두 발 앞뒤 거리
  const geoTap = geo(0), geoLift = geo(a), geoLand = land != null ? geo(land) : null;
  const dAct = (rows[b].PF - rows[a].PF) / rows[a].M; let pelPk = -Infinity, iPk = 0, handPk = 0, pushPk = -Infinity; for (let k = 0; k < Math.min(rows.length, 150); k++) { if (rows[k].pelF > pelPk) { pelPk = rows[k].pelF; iPk = k; } handPk = Math.max(handPk, rows[k].hH); if (lift != null && k >= lift && k <= (land ?? b) && !rows[k][onK] && rows[k]['on' + RE]) pushPk = Math.max(pushPk, rows[k].Fact); }
  const sum = { W, seed, front: FR, lift: lift != null ? +(lift * DT).toFixed(3) : null, land: land != null ? +(land * DT).toFixed(3) : null, swing: lift != null && land != null ? +((land - lift) * DT).toFixed(3) : null, reqFwd, stepAct: land != null ? +(rows[land]['x' + FR] - x0).toFixed(3) : null,
    pelPk: +pelPk.toFixed(3), tPelPk: +(iPk * DT).toFixed(3), handPk: +handPk.toFixed(2), ratio: +(pelPk / handPk).toFixed(3), pushPk: Number.isFinite(pushPk) ? +pushPk.toFixed(3) : null, wantMax: +wantMax.toFixed(3), reqWantMax: +reqMax.toFixed(3), aLim: rows.find((r) => r.drv?.ok)?.drv.aLim,
    dv: { raw: +dRaw.toFixed(3), cap: +dCap.toFixed(3), cop: +dCop.toFixed(3), act: +dAct.toFixed(3) }, capShare: nAll ? +(nCap / nAll).toFixed(3) : null, clipShare: nAll ? +(nClip / nAll).toFixed(3) : null, rearPeak: Object.fromEntries(Object.entries(pk).map(([k, v]) => [k, +v.toFixed(3)])), frontPeak: Object.fromEntries(Object.entries(pkF).map(([k, v]) => [k, +v.toFixed(3)])), satSteps: nSat, nWin: nAll, muMax: +muMax.toFixed(3),
    rcv, geoTap, geoLift, geoLand, cvPk: +Math.max(...rows.slice(0, 150).map((r) => r.drv?.cvF ?? -9)).toFixed(3), fell: rows.some((r) => r.st !== 'stand'), tapEnd: (() => { const k = rows.findIndex((r, j) => j > 0 && r.tap == null); return k >= 0 ? +(k * DT).toFixed(3) : null; })() };
  allRuns.push({ sum, rows: args.json ? rows : undefined });
  if (!args.quiet) {
    console.log(`\n=== ${W} 씨앗 ${seed} · 골반 간격 ${GAP.toFixed(2)} m · 앞서 걸음 ${WALK} s · 앞발 ${FR} · 뜸 ${sum.lift} s · 디딤 ${sum.land} s (떠 있음 ${sum.swing} s) · 부탁 걸음 ${sum.reqFwd} m · 실제 ${sum.stepAct} m · 넘어짐 ${sum.fell ? '예' : '아니오'}`);
    console.log(' t s  | 탭시계 | 앞발 뒷발 | want  req몫 legV aLim | 무게v 골반v | 바람(앞) 바람(뒤) 압중·마찰 실제 ÷mg | 앞N 뒷N | 뒷다리 엉덩 무릎 발목 벌림 ÷한도 | 앞다리 엉덩 무릎 발목 | 손 m/s | 앞발x');
    for (let k = 0; k < rows.length; k += EVERY) { const r = rows[k], d = r.drv; if (r.t > 1.0) break; const LB = d?.legs?.[RE], LF = d?.legs?.[FR];
      console.log(`${f2(r.t, 3)} | ${r.tap == null ? '  -  ' : f2(r.tap, 3)} | ${r[onK] ? '딛음' : ' 뜸 '} ${r['on' + RE] ? '딛음' : ' 뜸 '} | ${f2(d?.want)} ${f2(r.reqWant)} ${f2(r.legV)} ${f2(d?.aLim, 1)}${r.lb ? '*' : ' '} | ${f2(d?.cvF)} ${f2(r.pelF)} | ${f2(d?.Fraw)} ${f2(d?.Fcap)}${d?.capHit ? '!' : ' '} ${f2(d?.Fcop)} ${f2(r.Fact)} | ${f2(r['N' + FR])} ${f2(r['N' + RE])} | ${LB ? `${f2(LB.hip)} ${f2(LB.knee)} ${f2(LB.ank)} ${f2(LB.abd)}` : '   -   '} | ${LF ? `${f2(LF.hip)} ${f2(LF.knee)} ${f2(LF.ank)}` : '   -   '} | ${f2(r.hH)} | ${f2(r['x' + FR] - x0)}`); }
    console.log(`요약: 골반 최고 ${sum.pelPk} m/s @${sum.tPelPk} s · 손 최고 ${sum.handPk} · 비 ${sum.ratio} · 뒷다리 밀기(실제) 최고 ${sum.pushPk} mg · want 최고 ${sum.wantMax} (런지 몫 자르기 앞 ${sum.reqWantMax}) · aLim ${sum.aLim}`);
    console.log(`  런지 창 Δv m/s: 한도 없는 바람 ${sum.dv.raw} → 가속 한도 뒤 ${sum.dv.cap} → 압력 중심·마찰 뒤 ${sum.dv.cop} → 실제 ${sum.dv.act} · 가속 한도에 걸린 스텝 몫 ${sum.capShare} · 압력 중심 잘림 몫 ${sum.clipShare}`);
    console.log(`  받기(디딘 뒤 0.5 s): 앞다리 바람 ÷ 한도 최고 ${JSON.stringify(sum.rcv?.peak)} · 넘는 스텝 ${sum.rcv?.sat} / ${sum.rcv?.n} · 앞발 미끄러짐 ${sum.rcv?.slip} m · 앞발 수직 최고 ${sum.rcv?.Nmax} mg · 무게중심 0.1 m/s 밑까지 ${sum.rcv?.tStop} s`);
    console.log(`  자세: 탭 때 ${JSON.stringify(sum.geoTap)} · 앞발 뜸 ${JSON.stringify(sum.geoLift)} · 디딤 ${JSON.stringify(sum.geoLand)} (d = 무게중심 − 뒷발 · h = 무게중심 높이 · spread = 앞발 − 뒷발 · m) · 무게중심 최고 앞 빠르기 ${sum.cvPk}`);
    console.log(`  뒷다리 바람 ÷ 한도 최고 ${JSON.stringify(sum.rearPeak)} · 한도 넘는 스텝 ${sum.satSteps} / ${sum.nWin} · 앞다리 ${JSON.stringify(sum.frontPeak)} · 한 발 밀기 마찰 쓰임 최고 ${sum.muMax} (발 마찰 0.9 · 제어 μ ${LEGS.mu})`);
  }
}
console.log('\n씨앗 | 무기 | 골반 | 무게v | 손 | 비 | 밀기 | want최고 | Δv 바람/한도뒤/압중뒤/실제 | 한도걸림 | 뒷다리 최고 ÷한도 (엉덩/무릎/발목/벌림/돌림/발목안팎) | 마찰 | 걸음 부탁/실제 | 떠있음 | 넘어짐 | 받기: 앞다리 최고(엉덩/무릎/발목/벌림/돌림/발목안팎) 넘음 미끄러짐 멈춤s');
for (const { sum: s } of allRuns) console.log(`${s.seed} | ${s.W} | ${s.pelPk} | ${s.cvPk} | ${s.handPk} | ${s.ratio} | ${s.pushPk} | ${s.wantMax} | ${s.dv.raw}/${s.dv.cap}/${s.dv.cop}/${s.dv.act} | ${s.capShare} | ${s.rearPeak.hip}/${s.rearPeak.knee}/${s.rearPeak.ank}/${s.rearPeak.abd}/${s.rearPeak.rot}/${s.rearPeak.inv} | ${s.muMax} | ${s.reqFwd}/${s.stepAct} | ${s.swing} | ${s.fell ? '예' : '-'} | ${s.rcv ? `${s.rcv.peak.hip}/${s.rcv.peak.knee}/${s.rcv.peak.ank}/${s.rcv.peak.abd}/${s.rcv.peak.rot}/${s.rcv.peak.inv} ${s.rcv.sat}/${s.rcv.n} ${s.rcv.slip} ${s.rcv.tStop}` : '-'}`);
console.log(`GAIT.maxAccel ${GAIT.maxAccel} · burstAccel ${GAIT.burstAccel} · legVmax ${GAIT.legVmax} · LEGS.velGain ${LEGS.velGain} · mu ${LEGS.mu}`);
if (args.json) writeFileSync(String(args.json), JSON.stringify(allRuns));
