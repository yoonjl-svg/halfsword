// R2′ M1b (10/7): 서기 자세 heading 계단 응답 (게임의 돌아서기 명령 그대로: faceTarget 을 θ 만큼 돌린 자리로) + 장부(chain_ledger.attachLedger) 행.
//  엉덩이 모터 자신의 토크(τ̂ = k·e + d·ω)가 골반·몸통 회전으로 얼마나 가는지 — 획 없이 순수 돌아서기에서 잰다. anchor 뿌리에선 닻 모터가 돈다.
// usage: node m1b_turn.mjs --root=<tree> [--seeds=7,8,9] [--deg=20,60] [--dur=1.0] [--settle=1.5] [--out=file.json]
import { realpathSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = realpathSync(args.root ? resolve(String(args.root)) : resolve(HERE, '..', '..')); // 기본 = 이 저장소 (chain_ledger 와 같음); --root 로 다른 작업 공간
const u = (p) => pathToFileURL(resolve(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const { attachLedger } = await import(u('tools/sim/chain_ledger.mjs'));
const { CONFIG, DT } = H;
const seeds = String(args.seeds || '7,8,9').split(',').map(Number);
const DEGS = String(args.deg || '20,60').split(',').map(Number);
const DUR = +(args.dur ?? 1.0), SETTLE = +(args.settle ?? 1.5);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const d2 = (r) => (r * 180) / Math.PI;
const med = (a) => { const x = a.filter((v) => v != null && Number.isFinite(v)).sort((p, q) => p - q); return x.length ? (x.length % 2 ? x[(x.length - 1) / 2] : (x[x.length / 2 - 1] + x[x.length / 2]) / 2) : null; };
const q = (a, p) => { const x = a.filter((v) => v != null && Number.isFinite(v)).sort((p1, q1) => p1 - q1); return x.length ? x[Math.min(x.length - 1, Math.floor(p * (x.length - 1)))] : null; };
const f = (x, n = 1) => (x == null ? '-' : (+x).toFixed(n));
const yawOf = (b) => { const r = b.rotation(); const x = 1 - 2 * (r.y * r.y + r.z * r.z), z = 2 * (r.x * r.z - r.w * r.y); return Math.atan2(-z, x); }; // 몸 x 축의 세계 yaw

function run(seed, deg) {
  const G = H.newRound({ walls: false, weapon: 'longsword', weapon2: 'longsword', seed });
  G.park();
  const P = G.player;
  const led = attachLedger(G, P, { CONFIG });
  for (let i = 0; i < Math.round(SETTLE / DT); i++) { P.move.set(0, 0); G.step(); }
  const th = (deg * Math.PI) / 180;
  const i0 = led.rows.length;
  const B = P.bodies;
  const y0 = { pel: yawOf(B.pelvis), ch: yawOf(B.chest), thF: yawOf(B.thighF), thB: yawOf(B.thighB), fF: yawOf(B.footF), fB: yawOf(B.footB), head: P.heading };
  const pp = B.pelvis.translation();
  G.faceP = { x: pp.x + 100 * Math.cos(y0.head + th), y: 1, z: pp.z - 100 * Math.sin(y0.head + th) };
  const tr = [];
  const st = { F: P.gait?.legs?.F?.stance, B: P.gait?.legs?.B?.stance };
  let lifts = 0;
  const n = Math.round(DUR / DT);
  for (let k = 0; k < n; k++) {
    P.move.set(0, 0); G.step();
    for (const s of ['F', 'B']) { const now = P.gait?.legs?.[s]?.stance; if (st[s] && now === false) lifts++; st[s] = now; }
    tr.push({ t: (k + 1) * DT, pel: wrap(yawOf(B.pelvis) - y0.pel), ch: wrap(yawOf(B.chest) - y0.ch), thF: wrap(yawOf(B.thighF) - y0.thF), thB: wrap(yawOf(B.thighB) - y0.thB), fF: wrap(yawOf(B.footF) - y0.fF), fB: wrap(yawOf(B.footB) - y0.fB), head: wrap(P.heading - y0.head), dpsi: P.chainDpsi ?? null, wy: B.pelvis.angvel().y, state: P.state });
  }
  const rows = led.rows.slice(i0);
  const t90 = (key) => { const r = tr.find((x) => Math.sign(th) * x[key] >= 0.9 * Math.abs(th)); return r ? r.t : null; };
  const integ = (key, tEnd) => { let s = 0; for (let i = 0; i < rows.length && i < tr.length; i++) { if (tr[i].t > tEnd) break; s += (rows[i][key] || 0) * DT; } return s; };
  const at = (key, tEnd) => { const i = Math.min(rows.length - 1, Math.max(0, Math.round(tEnd / DT) - 1)); return rows[i]?.[key] ?? null; };
  const tp = t90('pel'), tc = t90('ch'), thd = t90('head');
  const tw = tp ?? DUR; // 창: 골반 90 % 까지 (못 가면 전체)
  const hipAbs = rows.flatMap((r) => [Math.abs(r.hipTauYF || 0), Math.abs(r.hipTauYB || 0)]);
  const out = {
    seed, deg, t90_pel: tp, t90_chest: tc, t90_head: thd, win: tw,
    pelW_max: d2(Math.max(...tr.map((x) => Math.sign(th) * x.wy))), overshoot: d2(Math.max(...tr.map((x) => Math.sign(th) * x.pel)) - Math.abs(th)), endErr: d2(Math.sign(th) * tr[tr.length - 1].pel - Math.abs(th)),
    yawEnd: { pel: d2(tr[tr.length - 1].pel), ch: d2(tr[tr.length - 1].ch), thF: d2(tr[tr.length - 1].thF), thB: d2(tr[tr.length - 1].thB), fF: d2(tr[tr.length - 1].fF), fB: d2(tr[tr.length - 1].fB), head: d2(tr[tr.length - 1].head) },
    yawAtWin: { pel: d2(tr[Math.round(tw / DT) - 1]?.pel ?? 0), thF: d2(tr[Math.round(tw / DT) - 1]?.thF ?? 0), thB: d2(tr[Math.round(tw / DT) - 1]?.thB ?? 0), fF: d2(tr[Math.round(tw / DT) - 1]?.fF ?? 0), fB: d2(tr[Math.round(tw / DT) - 1]?.fB ?? 0) },
    Jhip: integ('hipTauV', tw), Jhip_full: integ('hipTauV', DUR), Janc: integ('aV', tw), Jsp: integ('spAbY', tw), Jpin: integ('pinYawF', tw) + integ('pinYawB', tw),
    dLt: (at('LtY', tw) ?? 0) - (rows[0]?.LtY ?? 0), dLup: null, Ialpha: (() => { let s = 0; for (let i = 0; i < rows.length; i++) { if (tr[i] && tr[i].t > tw) break; s += (rows[i].Iup || 0) * (rows[i].alphaPel || 0) * DT; } return s; })(),
    LtY_max: Math.max(...rows.map((r) => Math.sign(th) * (r.LtY - rows[0].LtY))),
    hip_p50: q(hipAbs, 0.5), hip_p90: q(hipAbs, 0.9), hip_max: Math.max(...hipAbs), sig_med: med(rows.flatMap((r) => [r.sigF, r.sigB])), kYaw: med(rows.map((r) => r.kYaw)),
    slip: rows.reduce((s, r) => s + (r.slipF || 0) + (r.slipB || 0), 0), slipEv: rows.reduce((s, r) => s + (r.slipEvF || 0) + (r.slipEvB || 0), 0), yawSat: med(rows.map((r) => ((r.yawSatF || 0) + (r.yawSatB || 0)) / 2)),
    single: med(rows.map((r) => r.single)), lifts, stateEnd: tr[tr.length - 1].state, rows: rows.length,
    trace: tr.filter((x, i) => i % 6 === 5).map((x) => ({ t: +x.t.toFixed(3), head: +d2(x.head).toFixed(1), pel: +d2(x.pel).toFixed(1), ch: +d2(x.ch).toFixed(1), thF: +d2(x.thF).toFixed(1), fF: +d2(x.fF).toFixed(1), fB: +d2(x.fB).toFixed(1), dpsi: x.dpsi == null ? null : +d2(x.dpsi).toFixed(1) })),
  };
  out.rowsDump = rows.slice(0, Math.round(0.5 / DT)).map((r, i) => ({ t: +((i + 1) * DT).toFixed(4), LtY: r.LtY, LaY: r.LaY, LsY: r.LsY, LV: r.LV, hipTauV: r.hipTauV, spAbY: r.spAbY, shChestY: r.shChestY, wristChest: r.wristChest, pelW: r.pelW, aV: r.aV, pinY: (r.pinYawF || 0) + (r.pinYawB || 0), tauFricV: r.tauFricV, rV: r.rV }));
  out.sink = Math.abs(out.Jhip) > 1e-6 ? out.Ialpha / out.Jhip : null;
  out.ratio_t = Math.abs(out.Jhip) > 1e-6 ? out.dLt / out.Jhip : null;
  return out;
}

const res = { root: ROOT, chain: CONFIG.BODY?.chain ?? null, DT, seeds, DEGS, DUR, runs: [] };
console.log(`m1b_turn 뿌리 ${ROOT} · BODY.chain ${res.chain} · turnSpeed ${CONFIG.BODY?.turnSpeed} rad/s · GAIT.maxTwist ${CONFIG.GAIT?.maxTwist} · DT ${DT} · 창 = 골반 90 % 도달까지`);
for (const deg of DEGS) {
  const R = seeds.map((sd) => run(sd, deg));
  res.runs.push(...R);
  const m = (k) => med(R.map((r) => r[k]));
  const mm = (k, j) => med(R.map((r) => r[k]?.[j]));
  console.log(`\n== θ ${deg}° (seeds ${seeds.join(',')}; 중앙)`);
  console.log(`  90 % 도달(s): heading ${f(m('t90_head'), 3)} · 골반 ${f(m('t90_pel'), 3)} · 가슴 ${f(m('t90_chest'), 3)} | 골반 ω 최고 ${f(m('pelW_max'), 0)} °/s · 지나침 ${f(m('overshoot'), 1)} ° · 끝 오차 ${f(m('endErr'), 1)} ° · 발 들기 ${R.map((r) => r.lifts).join('/')} · 끝 상태 ${R.map((r) => r.stateEnd).join('/')}`);
  console.log(`  창 끝 yaw(°): 골반 ${f(mm('yawAtWin', 'pel'), 1)} 허벅지 F ${f(mm('yawAtWin', 'thF'), 1)} B ${f(mm('yawAtWin', 'thB'), 1)} 발 F ${f(mm('yawAtWin', 'fF'), 1)} B ${f(mm('yawAtWin', 'fB'), 1)} | 1 s 끝: 골반 ${f(mm('yawEnd', 'pel'), 1)} 가슴 ${f(mm('yawEnd', 'ch'), 1)} 허벅지 ${f(mm('yawEnd', 'thF'), 1)}/${f(mm('yawEnd', 'thB'), 1)} 발 ${f(mm('yawEnd', 'fF'), 1)}/${f(mm('yawEnd', 'fB'), 1)}`);
  console.log(`  충격량(N·m·s, 창): J_hip ${f(m('Jhip'), 2)} (1 s 전체 ${f(m('Jhip_full'), 2)}) · J_닻 ${f(m('Janc'), 2)} · J_척추 ${f(m('Jsp'), 2)} · J_핀 ${f(m('Jpin'), 2)} | ΔL 몸통 ${f(m('dLt'), 3)} · ∫I_up·α ${f(m('Ialpha'), 3)} · L몸통 최고 ${f(m('LtY_max'), 3)} | 싱크 ∫Iα/J_hip ${f(m('sink'), 3)} · ΔL몸통/J_hip ${f(m('ratio_t'), 3)}`);
  console.log(`  엉덩이 |τ̂_y|(N·m): p50 ${f(m('hip_p50'), 0)} p90 ${f(m('hip_p90'), 0)} max ${f(m('hip_max'), 0)} · σ 중앙 ${f(m('sig_med'), 2)} · kYaw ${m('kYaw') == null ? 'null' : f(m('kYaw'), 0)} · 미끄럼 ${f(m('slip'), 4)} m (${R.map((r) => r.slipEv).join('/')} 건) · yaw 핀 포화 ${f(m('yawSat'), 2)} · 한 발 ${f(m('single'), 2)}`);
  const tr = R[0].trace;
  console.log(`  궤적(seed ${R[0].seed}, °): ` + tr.filter((x, i) => i < 20).map((x) => `${x.t}s h${x.head} p${x.pel} c${x.ch} tF${x.thF} fF${x.fF} fB${x.fB}${x.dpsi == null ? '' : ' Δψ' + x.dpsi}`).join(' | '));
}
if (args.rows) {
  for (const R of res.runs) {
    if (R.seed !== seeds[0]) continue;
    console.log(`\n-- 행 (θ ${R.deg}°, seed ${R.seed}; L 는 전체 질량중심 기준 수직축 각운동량 N·m·s, 처음 값 뺌; 토크 N·m)`);
    const r0 = R.rowsDump[0];
    const d = R.rowsDump.map((r) => ({ ...r, LtY: r.LtY - r0.LtY, LaY: r.LaY - r0.LaY, LsY: r.LsY - r0.LsY, LV: r.LV - r0.LV }));
    console.log('   t(ms)   L몸통   L팔    L칼   L전체 | τ̂엉덩이  τ̂척추  어깨근  손목   τ̂닻   핀   τ마찰   잔차 | 골반ω°/s');
    let Jh = 0, Jf = 0, Jr = 0;
    for (let i = 0; i < d.length; i++) {
      const r = d[i]; Jh += (r.hipTauV || 0) * DT; Jf += (r.tauFricV || 0) * DT; Jr += (r.rV || 0) * DT;
      const ms = Math.round(r.t * 1000);
      if ([8, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500].includes(ms)) console.log(`  ${String(ms).padStart(5)} ${f(r.LtY, 3).padStart(7)} ${f(r.LaY, 3).padStart(6)} ${f(r.LsY, 3).padStart(6)} ${f(r.LV, 3).padStart(7)} | ${f(r.hipTauV, 0).padStart(7)} ${f(r.spAbY, 0).padStart(6)} ${f(r.shChestY, 0).padStart(6)} ${f(r.wristChest, 0).padStart(5)} ${f(r.aV, 0).padStart(6)} ${f(r.pinY, 1).padStart(5)} ${f(r.tauFricV, 0).padStart(6)} ${f(r.rV, 0).padStart(6)} | ${f(d2(r.pelW), 0).padStart(6)}   ∫τ̂엉 ${f(Jh, 2)} ∫τ마찰 ${f(Jf, 2)} ∫잔차 ${f(Jr, 2)}`);
    }
  }
}
if (args.out) writeFileSync(resolve(String(args.out)), JSON.stringify(res, null, 1));
