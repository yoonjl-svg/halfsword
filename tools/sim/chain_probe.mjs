// ─────────────────────────────────────────────────────────────
//  chain_probe.mjs — 타격 사슬 지표 H4 (물리 2.0 · docs/strike/physics2_notes/s2_strike_chain.md). 재기만 한다.
//
//   node tools/sim/chain_probe.mjs [--root=<트리>] [--weapons=longsword,zweihander,uchigatana,rapier] [--fams=diagR,vert,horizR] [--v=12] [--thrust=1] [--json=<파일>]
//
//  대본 베기 · 탭 찌르기에서 칼날 70 % 점 빠르기를 운동 사슬 마디별로 나눈다.
//   v_P = v_골반 + ω_골반×(P−c_골반) + (ω_배−ω_골반)×(P−J_허리) + (ω_가슴−ω_배)×(P−J_등) + (ω_위팔−ω_가슴)×(P−J_어깨) + (ω_아래팔−ω_위팔)×(P−J_팔꿈치) + (ω_칼−ω_아래팔)×(P−J_손목)
//   몫 = 각 항 · v̂_P ÷ |v_P| (합 = 1 이어야 함 — 검산 값 함께 냄).
//  끝에 H4 요약: 몸통 몫(골반 돌림 + 허리 + 등) · 몸 쪽 → 끝 쪽 차례(골반 → 몸통 비틀림 → 어깨 → 팔꿈치 → 손목 차례로 최고 각속도)를 지킨 칸 · 손이 칼날보다 먼저 최고인 칸 · 손목 서보 포화.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const { FAM } = await import(u('tools/sim/corr_lib.mjs'));
const { newRound, DT, THREE, CONFIG } = H;
const V = (v) => new THREE.Vector3(v.x, v.y, v.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
const weapons = String(args.weapons ?? 'longsword,zweihander,uchigatana,rapier').split(',');
const fams = String(args.fams ?? 'diagR,vert,horizR').split(',');
const VF = args.v != null ? +args.v : null;
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : NaN; };
const f1 = (x, n = 1) => (Number.isFinite(x) ? x.toFixed(n) : '–');
const D = 180 / Math.PI;

function chainOf(P) {
  const J = P.jointByName;
  const anchorW = (joint, parent) => { const a = joint.anchor1(); return V(a).applyQuaternion(Q(parent.rotation())).add(V(parent.translation())); };
  return {
    pelvis: P.bodies.pelvis, abdomen: P.bodies.abdomen, chest: P.bodies.chest, uarm: P.bodies.uarmS, farm: P.bodies.farmS, sword: P.sword,
    jWaist: () => anchorW(J.abdomen.joint, P.bodies.pelvis), jBack: () => anchorW(J.chest.joint, P.bodies.abdomen),
    jSh: () => anchorW(J.uarmS.joint, P.bodies.chest), jEl: () => anchorW(J.farmS.joint, P.bodies.uarmS), jWr: () => anchorW(P.gripJoint, P.bodies.farmS),
  };
}
function sample(P, C, t70 = 0.7) {
  const p70 = P.bladePoint(t70, new THREE.Vector3());
  const tip = P.bladePoint(1, new THREE.Vector3());
  const v70 = V(C.sword.velocityAtPoint(p70)), vtip = V(C.sword.velocityAtPoint(tip));
  const w = { pel: V(C.pelvis.angvel()), abd: V(C.abdomen.angvel()), ch: V(C.chest.angvel()), ua: V(C.uarm.angvel()), fa: V(C.farm.angvel()), sw: V(C.sword.angvel()) };
  const sp = v70.length();
  const dir = sp > 1e-6 ? v70.clone().multiplyScalar(1 / sp) : new THREE.Vector3(1, 0, 0);
  const term = (wa, wb, j) => wa.clone().sub(wb).cross(p70.clone().sub(j)).dot(dir);
  const zero = new THREE.Vector3();
  const pc = V(C.pelvis.worldCom());
  const parts = {
    pelLin: V(C.pelvis.linvel()).dot(dir),
    pelRot: term(w.pel, zero, pc),
    waist: term(w.abd, w.pel, C.jWaist()),
    back: term(w.ch, w.abd, C.jBack()),
    shoulder: term(w.ua, w.ch, C.jSh()),
    elbow: term(w.fa, w.ua, C.jEl()),
    wrist: term(w.sw, w.fa, C.jWr()),
  };
  const sum = Object.values(parts).reduce((a, b) => a + b, 0);
  // 관절 각속도 (rad/s): 몸통은 수직축 몫 · 팔은 크기 · 손목은 칼날 축 비틀림 뺀 몫
  const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(C.sword.rotation()));
  const wWr = w.sw.clone().sub(w.fa); wWr.addScaledVector(blade, -wWr.dot(blade));
  const uAx = new THREE.Vector3(1, 0, 0).applyQuaternion(Q(C.uarm.rotation()));
  const wSh = w.ua.clone().sub(w.ch); const shTw = Math.abs(wSh.dot(uAx)); wSh.addScaledVector(uAx, -wSh.dot(uAx));
  const elAx = new THREE.Vector3(0, 0, 1).applyQuaternion(Q(C.uarm.rotation()));
  const om = {
    pelYaw: Math.abs(w.pel.y), trunkTwist: Math.abs(w.ch.y - w.pel.y), chestYaw: Math.abs(w.ch.y),
    shoulder: wSh.length(), shTwist: shTw, elbow: Math.abs(w.fa.clone().sub(w.ua).dot(elAx)), wrist: wWr.length(),
    // 그 관절이 칼날 점에 주는 빠르기 (m/s · 치는 쪽 몫)
    cTrunk: parts.pelRot + parts.waist + parts.back, cShoulder: parts.shoulder, cElbow: parts.elbow, cWrist: parts.wrist, cPelLin: parts.pelLin,
  };
  const axial = vtip.dot(blade);
  // 손(손목 관절 자리) 빠르기
  const hand = V(C.farm.velocityAtPoint(C.jWr())).length();
  // 자세 각: 골반 · 가슴 yaw (세계) · 팔꿈치 굽힘 · 손목 각(아래팔 줄 ↔ 칼날)
  const fx = (b) => new THREE.Vector3(1, 0, 0).applyQuaternion(Q(b.rotation()));
  const yawOf = (b) => { const a = fx(b); return Math.atan2(-a.z, a.x); };
  const uDir = fx(C.uarm), fDir = fx(C.farm);
  const ang = { pelYaw: yawOf(C.pelvis), chYaw: yawOf(C.chest), elbow: Math.acos(Math.max(-1, Math.min(1, uDir.dot(fDir)))), wrist: Math.acos(Math.max(-1, Math.min(1, fDir.dot(blade)))) };
  // 위팔 방향 (가슴 틀) — 어깨 각 변위용
  const uCh = uDir.clone().applyQuaternion(Q(C.chest.rotation()).invert());
  return { sp, axial, tip: vtip.length(), parts, sum, om, hand, ang, uCh, tauW: P.debug.wristTorque.length(), capW: P.debug.wristCap || 0, pelPos: V(C.pelvis.translation()) };
}
function summarize(rows, i0, i1) {
  // 창 [i0, i1) 안: 칼날 70 % 최고 스텝
  let iPk = i0; for (let i = i0; i < i1; i++) if (rows[i].sp > rows[iPk].sp) iPk = i;
  let iTip = i0; for (let i = i0; i < i1; i++) if (rows[i].tip > rows[iTip].tip) iTip = i;
  const R = rows[iPk];
  const share = Object.fromEntries(Object.entries(R.parts).map(([k, v]) => [k, v / R.sp]));
  const pk = (k) => { let b = i0; for (let i = i0; i <= iPk; i++) if (rows[i].om[k] > rows[b].om[k]) b = i; return { v: rows[b].om[k], lead: (iPk - b) * DT * 1000 }; };
  const pkAll = (k) => { let b = i0; for (let i = i0; i < i1; i++) if (rows[i].om[k] > rows[b].om[k]) b = i; return { v: rows[b].om[k], lead: (iPk - b) * DT * 1000 }; };
  const pkHand = (() => { let b = i0; for (let i = i0; i < i1; i++) if (rows[i].hand > rows[b].hand) b = i; return { v: rows[b].hand, lead: (iPk - b) * DT * 1000 }; })();
  const rng = (fn) => { let lo = Infinity, hi = -Infinity; for (let i = i0; i < i1; i++) { const x = fn(rows[i]); lo = Math.min(lo, x); hi = Math.max(hi, x); } return hi - lo; };
  // yaw 범위는 풀어서 (−π ~ π 넘김 막기)
  const unwrapRng = (key) => { let prev = rows[i0].ang[key], acc = 0, lo = 0, hi = 0; for (let i = i0 + 1; i < i1; i++) { let d = rows[i].ang[key] - prev; d = Math.atan2(Math.sin(d), Math.cos(d)); acc += d; prev = rows[i].ang[key]; lo = Math.min(lo, acc); hi = Math.max(hi, acc); } return hi - lo; };
  const xf = rng((r) => Math.atan2(Math.sin(r.ang.chYaw - r.ang.pelYaw), Math.cos(r.ang.chYaw - r.ang.pelYaw)));
  let shSweep = 0; for (let i = i0 + 1; i < i1; i++) shSweep += Math.acos(Math.max(-1, Math.min(1, rows[i].uCh.dot(rows[i - 1].uCh))));
  let sat = 0, n = 0, tauMax = 0, capAtMax = 0; for (let i = i0; i <= iPk; i++) { n++; if (rows[i].capW > 0 && rows[i].tauW >= 0.98 * rows[i].capW) sat++; if (rows[i].tauW > tauMax) { tauMax = rows[i].tauW; capAtMax = rows[i].capW; } }
  const pelTravel = rows[i1 - 1].pelPos.clone().sub(rows[i0].pelPos).setY(0).length();
  return {
    v70: R.sp, tip: rows[iTip].tip, tipAt70: R.tip, tAcc: (iPk - i0 + 1) * DT * 1000, check: R.sum / R.sp, share,
    pk: { pelYaw: pk('pelYaw'), trunkTwist: pk('trunkTwist'), shoulder: pk('shoulder'), elbow: pk('elbow'), wrist: pk('wrist') },
    pkAll: { pelYaw: pkAll('pelYaw'), trunkTwist: pkAll('trunkTwist'), shoulder: pkAll('shoulder'), elbow: pkAll('elbow'), wrist: pkAll('wrist') },
    pkC: { trunk: pkAll('cTrunk'), shoulder: pkAll('cShoulder'), elbow: pkAll('cElbow'), wrist: pkAll('cWrist') }, shTwist: pkAll('shTwist'),
    hand: pkHand, rngPelYaw: unwrapRng('pelYaw') * D, rngChYaw: unwrapRng('chYaw') * D, rngX: xf * D, rngElbow: rng((r) => r.ang.elbow) * D, rngWrist: rng((r) => r.ang.wrist) * D, shSweep: shSweep * D,
    sat: sat / Math.max(1, n), tauMax, capAtMax, pelTravel,
  };
}
const out = [];
for (const weapon of weapons) {
  for (const fam of fams) {
    const F0 = FAM[fam]; const F = VF ? { ...F0, v: VF } : F0;
    const G = newRound({ walls: false, weapon, seed: 7 });
    G.park();
    const P = G.player; const C = chainOf(P);
    P.handOffset.set(F.ch[0], F.ch[1]);
    for (let i = 0; i < Math.round(3.0 / DT); i++) { P.move.set(0, 0); G.step(); }
    let tgt = F.end; const res = [];
    for (let k = 0; k < 6; k++) {
      const from = [P.handOffset.x, P.handOffset.y], dist = Math.hypot(tgt[0] - from[0], tgt[1] - from[1]);
      const n = Math.round((dist / F.v + 0.6) / DT); const rows = [];
      for (let i = 0; i < n; i++) {
        const off = P.handOffset, dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
        if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(tgt[0], tgt[1]);
        P.move.set(0, 0); G.step(); rows.push(sample(P, C));
      }
      res.push({ k, dir: tgt === F.end ? 'fwd' : 'back', ...summarize(rows, 0, rows.length) });
      tgt = tgt === F.end ? F.ch : F.end;
    }
    out.push({ weapon, fam, str: P.strength, mAim: P.weaponCfg.maxAimTorque, Ihand: P.swordIhand, mSword: P.sword.mass(), res });
    const fw = res.filter((r) => r.dir === 'fwd');
    const m = (fn) => med(fw.map(fn));
    console.log(`${weapon.padEnd(11)} ${fam.padEnd(7)} 앞 획 ${fw.length}: 칼날70 ${f1(m((r) => r.v70))} · 칼끝 ${f1(m((r) => r.tip))} m/s · 가속 ${f1(m((r) => r.tAcc), 0)} ms · 검산 ${f1(m((r) => r.check), 2)}`);
    console.log(`   몫 %: 골반 옮김 ${f1(100 * m((r) => r.share.pelLin), 0)} · 골반 돌림 ${f1(100 * m((r) => r.share.pelRot), 0)} · 허리 ${f1(100 * m((r) => r.share.waist), 0)} · 등 ${f1(100 * m((r) => r.share.back), 0)} · 어깨 ${f1(100 * m((r) => r.share.shoulder), 0)} · 팔꿈치 ${f1(100 * m((r) => r.share.elbow), 0)} · 손목 ${f1(100 * m((r) => r.share.wrist), 0)}`);
    console.log(`   최고 각속도 °/s (칼날 최고보다 앞선 ms — 칼날 최고 앞 창): 골반 yaw ${f1(D * m((r) => r.pk.pelYaw.v), 0)} (${f1(m((r) => r.pk.pelYaw.lead), 0)}) · 몸통 비틀림 ${f1(D * m((r) => r.pk.trunkTwist.v), 0)} (${f1(m((r) => r.pk.trunkTwist.lead), 0)}) · 어깨 ${f1(D * m((r) => r.pk.shoulder.v), 0)} (${f1(m((r) => r.pk.shoulder.lead), 0)}) · 팔꿈치 ${f1(D * m((r) => r.pk.elbow.v), 0)} (${f1(m((r) => r.pk.elbow.lead), 0)}) · 손목 ${f1(D * m((r) => r.pk.wrist.v), 0)} (${f1(m((r) => r.pk.wrist.lead), 0)}) · 손 ${f1(m((r) => r.hand.v))} m/s (${f1(m((r) => r.hand.lead), 0)})`);
    console.log(`   전체 창 최고 (앞선 ms · − = 칼날 최고 뒤): 골반 ${f1(m((r) => r.pkAll.pelYaw.lead), 0)} · 비틀림 ${f1(m((r) => r.pkAll.trunkTwist.lead), 0)} · 어깨 ${f1(m((r) => r.pkAll.shoulder.lead), 0)} · 팔꿈치 ${f1(m((r) => r.pkAll.elbow.lead), 0)} · 손목 ${f1(m((r) => r.pkAll.wrist.lead), 0)} · 위팔 비틀림 최고 ${f1(D * m((r) => r.shTwist.v), 0)} °/s`);
    console.log(`   칼날 점에 준 빠르기 최고 m/s (앞선 ms): 몸통 ${f1(m((r) => r.pkC.trunk.v))} (${f1(m((r) => r.pkC.trunk.lead), 0)}) · 어깨 ${f1(m((r) => r.pkC.shoulder.v))} (${f1(m((r) => r.pkC.shoulder.lead), 0)}) · 팔꿈치 ${f1(m((r) => r.pkC.elbow.v))} (${f1(m((r) => r.pkC.elbow.lead), 0)}) · 손목 ${f1(m((r) => r.pkC.wrist.v))} (${f1(m((r) => r.pkC.wrist.lead), 0)})`);
    console.log(`   움직인 범위 °: 골반 yaw ${f1(m((r) => r.rngPelYaw), 0)} · 가슴 yaw ${f1(m((r) => r.rngChYaw), 0)} · 가슴−골반 ${f1(m((r) => r.rngX), 0)} · 어깨 쓸기 ${f1(m((r) => r.shSweep), 0)} · 팔꿈치 ${f1(m((r) => r.rngElbow), 0)} · 손목 ${f1(m((r) => r.rngWrist), 0)} · 골반 옮김 ${f1(m((r) => r.pelTravel), 2)} m`);
    console.log(`   손목 서보: 포화 ${f1(100 * m((r) => r.sat), 0)} % 스텝 · |τ| 최고 ${f1(m((r) => r.tauMax))} / 그때 상한 ${f1(m((r) => r.capAtMax))} N·m (설정 ${P.weaponCfg.maxAimTorque} × 힘 ${P.strength}) · 칼 손 기준 관성 ${f1(P.swordIhand, 3)} kg·m² · 칼 ${f1(P.sword.mass(), 2)} kg`);
    G.world.free?.();
  }
}
if (args.thrust) {
  const K = CONFIG.TIME.k;
  for (const weapon of weapons) {
    const G = newRound({ weapon, weapon2: 'longsword', seed: 1, gap: 3, walls: false, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
    const P = G.player, E = G.enemy; const C = chainOf(P);
    G.ai.update = () => E.move.set(0, 0);
    P.skill.autoGuard = true;
    for (let t = 0; t < 3.2; t += DT) { P.move.set(0, 0); E.handOffset.set(0, -0.5); G.step(); }
    const ok = P.skill.thrust();
    const rows = [];
    for (let i = 0; i < Math.round(0.9 / DT); i++) { P.move.set(0, 0); E.handOffset.set(0, -0.5); G.step(); rows.push(sample(P, C, 1)); }
    const S = summarize(rows, 0, rows.length);
    let iAx = 0; for (let i = 0; i < rows.length; i++) if (rows[i].axial > rows[iAx].axial) iAx = i;
    const RA = rows[iAx]; const pelV = Math.max(...rows.map((r) => Math.abs(r.parts.pelLin)));
    const pelSp = (() => { let b = 0; for (let i = 1; i < rows.length; i++) { const d = rows[i].pelPos.clone().sub(rows[i - 1].pelPos).setY(0).length() / DT; if (d > b) b = d; } return b; })();
    console.log(`${weapon.padEnd(11)} 탭 찌르기 칼 축 쪽 칼끝 빠르기 최고 ${f1(RA.axial)} m/s (${f1(iAx * DT * 1000, 0)} ms 뒤 · 그때 칼끝 ${f1(RA.tip)} · 손 ${f1(RA.hand)} m/s) · 골반 수평 빠르기 최고 ${f1(pelSp)} m/s · 0.9 s 동안 골반 옮김 ${f1(S.pelTravel, 2)} m · 팔꿈치 범위 ${f1(S.rngElbow, 0)}°`);
    out.push({ weapon, fam: 'tapThrust', ok, res: [S], axial: RA.axial, tAx: iAx * DT, pelSp });
    console.log(`${weapon.padEnd(11)} 탭 찌르기(허공 · 상대 3 m): 시작 ${ok} · 칼끝 ${f1(S.v70)} m/s (실제 초 ${f1(S.v70 / K)}) · 손 ${f1(S.hand.v)} m/s · 가속 ${f1(S.tAcc, 0)} ms · 검산 ${f1(S.check, 2)}`);
    console.log(`   몫 %: 골반 옮김 ${f1(100 * S.share.pelLin, 0)} · 골반 돌림 ${f1(100 * S.share.pelRot, 0)} · 허리 ${f1(100 * S.share.waist, 0)} · 등 ${f1(100 * S.share.back, 0)} · 어깨 ${f1(100 * S.share.shoulder, 0)} · 팔꿈치 ${f1(100 * S.share.elbow, 0)} · 손목 ${f1(100 * S.share.wrist, 0)}`);
    console.log(`   최고 각속도 °/s (앞선 ms): 골반 ${f1(D * S.pk.pelYaw.v, 0)} (${f1(S.pk.pelYaw.lead, 0)}) · 비틀림 ${f1(D * S.pk.trunkTwist.v, 0)} (${f1(S.pk.trunkTwist.lead, 0)}) · 어깨 ${f1(D * S.pk.shoulder.v, 0)} (${f1(S.pk.shoulder.lead, 0)}) · 팔꿈치 ${f1(D * S.pk.elbow.v, 0)} (${f1(S.pk.elbow.lead, 0)}) · 손목 ${f1(D * S.pk.wrist.v, 0)} (${f1(S.pk.wrist.lead, 0)})`);
    console.log(`   움직인 범위 °: 골반 yaw ${f1(S.rngPelYaw, 0)} · 가슴 yaw ${f1(S.rngChYaw, 0)} · 팔꿈치 ${f1(S.rngElbow, 0)} · 골반 옮김 ${f1(S.pelTravel, 2)} m · 손목 서보 |τ| 최고 ${f1(S.tauMax)} / ${f1(S.capAtMax)} N·m`);
    G.world.free?.();
  }
}
// ── H4 요약 (베기 칸만) ──
{
  const cells = out.filter((o) => o.fam !== 'tapThrust').map((o) => {
    const fw = o.res.filter((r) => r.dir === 'fwd'), m = (fn) => med(fw.map(fn));
    const lead = ['pelYaw', 'trunkTwist', 'shoulder', 'elbow', 'wrist'].map((k) => m((r) => r.pkAll[k].lead));
    return { weapon: o.weapon, fam: o.fam, v70: m((r) => r.v70), tip: m((r) => r.tip), trunk: m((r) => r.share.pelRot + r.share.waist + r.share.back), wrist: m((r) => r.share.wrist), order: lead.every((x, i) => i === 0 || lead[i - 1] >= x), handFirst: m((r) => r.hand.lead) > 0, sat: m((r) => r.sat) };
  });
  if (cells.length) {
    const n = cells.length, mm = (fn) => med(cells.map(fn));
    console.log(`H4 요약 (베기 ${n} 칸): 몸통 몫 가운데값 ${f1(100 * mm((c) => c.trunk), 0)} % (20 % 넘는 칸 ${cells.filter((c) => c.trunk >= 0.2).length}/${n}) · 손목 몫 가운데값 ${f1(100 * mm((c) => c.wrist), 0)} % · 몸 쪽 → 끝 쪽 차례를 지킨 칸 ${cells.filter((c) => c.order).length}/${n} · 손이 칼날보다 먼저 최고인 칸 ${cells.filter((c) => c.handFirst).length}/${n} · 손목 서보 포화 가운데값 ${f1(100 * mm((c) => c.sat), 0)} % · 칼날 70 % 가운데값 ${f1(mm((c) => c.v70))} m/s · 칼끝 ${f1(mm((c) => c.tip))} m/s`);
    out.push({ h4: cells });
  }
}
if (args.json) { const { writeFileSync } = await import('node:fs'); writeFileSync(String(args.json), JSON.stringify(out)); }
