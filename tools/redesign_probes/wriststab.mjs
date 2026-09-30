// 가벼운 칼 손목 튐 수치: 무기마다 c·dt/I, k·dt²/I, 최대 토크 한 스텝 각속도·칼끝 속도 변화 (1이 넘으면 한 스텝에 튄다)
// 실행: node tools/redesign_probes/wriststab.mjs (저장소 루트에서; src 패치 불필요)
//
// FLIP=1: 동적 측정 (R0 손목 항목, 설계서 §6-5 "부호 뒤집힘 ≤ 7%" 관문은 여기서 보고만 한다). 옛 record_wbs.mjs·tseq 조건 (둘 다 R2 W5 가 지움):
//   hybrid 걸음, skill 0.7, 상대 2.0 m(서 있기만, 칼 충돌 끔), 쟁기 2 s → 감기 자리 1.2 m/s + 1 s 머묾 → 끝 자리 v m/s 획(손가락 뗌).
//   무기 × 무리 × v 마다 (게임 설정 그대로) 베기 획 시작 뒤 0.6 s 창에서
//     flip60/flip120: 칼의 아래팔 상대 각속도(칼날 축 몫 뺌)가 표본 사이에 뒤집힌 비율 (60 Hz 표본 / 물리 스텝. 둘 다 > 2 rad/s 일 때만)
//     old25: 칼끝 목표가 월드에서 25 rad/s 보다 빨리 돈 스텝 수 (옛 자르기가 걸렸을 스텝), clips: STRIKE.wristRel 보호값이 걸린 스텝 수(fighter.debug)
//     relMax: 목표의 아래팔 상대 빠르기 최고(rad/s), tip: 칼끝 최고(m/s), 그리고 옛 월드 25 자르기(STRIKE.wristRel 끔)로 같은 획을 다시 잰 값
//   env: HZ=60 VS=12,20 FAMS=diagR,horizR,vert WEAPONS=<id,..> (기본 전부) MODES=air[,dummy] (dummy: 상대 1.6 m, 내 칼 충돌 켬)
//        NOCLAMP=1: 보호값 없음(wristRelMax=∞)으로 한 번 더 재서 칼끝 속도 시계열의 스텝 최대 차이를 적는다   OUT=<json 경로> (저장소 밖에)
const H = await import('../sim/harness_m.mjs');
const { WEAPON_LIST } = await import('../../src/weapons.js');
const dt = 1/120;
if (!process.env.FLIP) {
for (const w of WEAPON_LIST) {
  const G = H.newRound({ seed: 1, weapon: w.id, walls: false });
  const f = G.player, c = f.weaponCfg, I = f.swordIhand;
  // effective inertia at hand incl? swordIhand = rotational inertia about hand
  const k = c.aimStiffness, d = c.aimDamping, dr = c.releaseDamping;
  console.log(w.id.padEnd(18), 'm', f.swordMass.toFixed(2), 'Ihand', I.toFixed(4), 'k', k, 'd', d, 'dRel', dr, 'Tmax', c.maxAimTorque, 'wVmax', c.wristVmax,
    ' c*dt/I', (d*dt/I).toFixed(2), ' k*dt2/I', (k*dt*dt/I).toFixed(3), ' Tmax/I rad/s2', (c.maxAimTorque/I).toFixed(0), ' dw/step at Tmax', (c.maxAimTorque/I*dt).toFixed(1), 'rad/s', 'tipDv/step', (c.maxAimTorque/I*dt*(c.hiltLength+c.bladeLength)).toFixed(2));
}
} else {
  const { newRound, DT, THREE, CONFIG, feedTrace, inputPump, V, Q } = H;
  const { STRIKE, BODY } = CONFIG;
  BODY.weightMode = 'hybrid'; // tools/sim/hybrid.mjs 와 같게
  const HZ = +(process.env.HZ || 60);
  const VS = (process.env.VS || '12,20').split(',').map(Number);
  const FAMS = (process.env.FAMS || 'diagR,horizR,vert').split(',');
  const WEAPONS = process.env.WEAPONS ? process.env.WEAPONS.split(',') : WEAPON_LIST.map((w) => w.id);
  const MODES = (process.env.MODES || 'air').split(',');
  const NOCLAMP = process.env.NOCLAMP === '1';
  const WIN = 0.6; // 베기 획 시작 뒤 재는 창 (s)
  const POST = 1.0;
  const SEED = 7;
  const PAD = { Pflug: [0.18, -0.28], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42], Tag: [0.02, 0.52], Alber: [0, -0.5], Side: [0.52, 0.03], SideL: [-0.52, 0.03], Wechsel: [0.38, -0.44], OchsL: [-0.22, 0.26] };
  const FAM = { diagR: { ch: PAD.ShR, end: PAD.WechselL }, vert: { ch: PAD.Tag, end: PAD.Alber }, horizR: { ch: PAD.Side, end: PAD.SideL }, riseR: { ch: PAD.Wechsel, end: PAD.OchsL } };
  const stroke = (dx, dy, v, { hold = 0, lift = true, down = true } = {}) => {
    const T = (Math.hypot(dx, dy) / v) * 1000;
    return { fn: (t) => { const u = T > 0 ? Math.min(1, t / T) : 1; return [dx * u, dy * u]; }, T: T + hold, lift, down };
  };
  const setPad = (P, xy) => {
    P.handOffset.set(xy[0], xy[1]);
    const k = P.skill;
    for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v?.set(xy[0], xy[1]);
    k.aimVel?.set(0, 0); k.vel?.set(0, 0); k.follow?.set(0, 0);
  };
  const rel0 = { on: STRIKE.wristRel, max: STRIKE.wristRelMax };
  const r1 = (x) => +x.toFixed(1), r2 = (x) => +x.toFixed(2);
  // variant: cfg = 지금 설정 그대로 (R0_OFF=1 이면 옛 자르기), old = 옛 월드 25 자르기, none = 보호값 없음
  function trial(weapon, mode, fam, v, commit, variant) {
    STRIKE.wristRel = variant === 'old' ? false : variant === 'none' ? true : rel0.on;
    STRIKE.wristRelMax = variant === 'none' ? Infinity : rel0.max;
    const G = newRound({ walls: false, gap: (mode === 'dummy' ? 1.6 : 2.0) + 0.17, seed: SEED, weapon });
    const P = G.player, E = G.enemy;
    G.ai.update = () => E.move.set(0, 0);
    for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
    if (mode !== 'dummy') for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
    E.die = () => {};
    P.skill.level = 0.7;
    setPad(P, PAD.Pflug);
    inputPump(G, { hz: HZ });
    let commits = 0;
    const oc = P.onCommit.bind(P);
    P.onCommit = (...a) => (commits++, oc(...a));
    for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
    const F = FAM[fam];
    const off = [P.handOffset.x, P.handOffset.y];
    const chq = feedTrace(G, stroke(F.ch[0] - off[0], F.ch[1] - off[1], 1.2, { hold: 1000, lift: false }), HZ);
    while (!chq.done) G.step();
    const cur = [P.handOffset.x, P.handOffset.y];
    const cut = feedTrace(G, stroke(F.end[0] - cur[0], F.end[1] - cur[1], v, { down: false, lift: true }), HZ);
    let guard = 0;
    while (cut.t0 == null && ++guard < 120) G.step();
    const t0 = G.t;
    const prevAim = P.debug.aim.clone();
    const clips0 = P.debug.wAimRelClips;
    const swingP = new THREE.Vector3(), swing60 = new THREE.Vector3(), swing = new THREE.Vector3(), wAimW = new THREE.Vector3(), fw = new THREE.Vector3();
    const m = { steps: 0, flip120: 0, n60: 0, flip60: 0, old25: 0, new60: 0, relMax: 0, tip: 0, tips: [], nan: false };
    const n = Math.round(POST / DT);
    for (let i = 1; i <= n; i++) {
      G.step();
      const tip = P.tipVel.length();
      if (!Number.isFinite(tip)) m.nan = true;
      m.tip = Math.max(m.tip, tip);
      m.tips.push(tip);
      const aim = P.debug.aim;
      wAimW.crossVectors(prevAim, aim).multiplyScalar(1 / DT); // driveSword 의 wAim (월드) 그대로
      prevAim.copy(aim);
      if (G.t - t0 > WIN + 1e-9) continue;
      m.steps++;
      const w = V(P.sword.angvel()).sub(V(P.bodies.farmS.angvel()));
      const blade = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(P.sword.rotation()));
      swing.copy(w).addScaledVector(blade, -w.dot(blade));
      if (i > 1 && swing.dot(swingP) < 0 && swing.length() > 2 && swingP.length() > 2) m.flip120++;
      if (i % 2 === 0) {
        if (i > 2 && swing.dot(swing60) < 0 && swing.length() > 2 && swing60.length() > 2) m.flip60++;
        if (i > 2) m.n60++;
        swing60.copy(swing);
      }
      swingP.copy(swing);
      if (wAimW.length() > 25) m.old25++;
      const f0 = P.bodies.farmS.angvel();
      fw.set(f0.x, f0.y, f0.z).addScaledVector(aim, -fw.dot(aim));
      const rel = wAimW.sub(fw).length();
      if (rel > 60) m.new60++;
      m.relMax = Math.max(m.relMax, rel);
    }
    m.clips = P.debug.wAimRelClips - clips0;
    m.commits = commits;
    m.hits = G.hits.length;
    return m;
  }
  const rows = [];
  const per = {};
  for (const weapon of WEAPONS) {
    const agg = (per[weapon] = { steps: 0, flip120: 0, n60: 0, flip60: 0, old25: 0, new60: 0, clips: 0, relMax: 0, tipArm: 0, tipCommit: 0, oldFlip60: 0, oldN60: 0, oldTipArm: 0, oldTipCommit: 0, dTipMax: 0, nan: 0 });
    for (const mode of MODES) for (const fam of FAMS) for (const v of VS) for (const commit of [false]) { // 게임 설정 한 벌 (옛 결심 켬 줄은 R2 W5 가 옛 경로와 함께 지웠다)
      const a = trial(weapon, mode, fam, v, commit, 'cfg');
      const o = trial(weapon, mode, fam, v, commit, 'old');
      const row = { weapon, mode, fam, v, commit, steps: a.steps, flip60_pct: r1((100 * a.flip60) / Math.max(1, a.n60)), flip120_pct: r1((100 * a.flip120) / Math.max(1, a.steps)), old25: a.old25, new60: a.new60, clips: a.clips, relMax: r1(a.relMax), tip: r2(a.tip), commits: a.commits, hits: a.hits, oldFlip60_pct: r1((100 * o.flip60) / Math.max(1, o.n60)), oldTip: r2(o.tip), nan: a.nan || o.nan };
      if (NOCLAMP) {
        const z = trial(weapon, mode, fam, v, commit, 'none');
        let d = 0;
        for (let i = 0; i < Math.min(a.tips.length, z.tips.length); i++) d = Math.max(d, Math.abs(a.tips[i] - z.tips[i]));
        row.noneTip = r2(z.tip);
        row.dTipMax = +d.toFixed(4); // 보호값 60 과 보호값 없음의 칼끝 속도 스텝 최대 차이 (m/s). clips 0 이면 0 이어야 한다
        agg.dTipMax = Math.max(agg.dTipMax, d);
      }
      rows.push(row);
      agg.steps += a.steps; agg.flip120 += a.flip120; agg.n60 += a.n60; agg.flip60 += a.flip60; agg.old25 += a.old25; agg.new60 += a.new60; agg.clips += a.clips;
      agg.relMax = Math.max(agg.relMax, a.relMax); agg.oldFlip60 += o.flip60; agg.oldN60 += o.n60; agg.nan += row.nan ? 1 : 0;
      if (commit) { agg.tipCommit = Math.max(agg.tipCommit, a.tip); agg.oldTipCommit = Math.max(agg.oldTipCommit, o.tip); }
      else { agg.tipArm = Math.max(agg.tipArm, a.tip); agg.oldTipArm = Math.max(agg.oldTipArm, o.tip); }
      console.log(`${weapon.padEnd(17)} ${mode.padEnd(5)} ${fam.padEnd(6)} v${String(v).padStart(2)} ${commit ? 'commit' : 'arm   '}  flip60 ${String(row.flip60_pct).padStart(5)}%  flip120 ${String(row.flip120_pct).padStart(5)}%  old25 ${String(a.old25).padStart(2)}  new60 ${String(a.new60).padStart(2)}  clips ${String(a.clips).padStart(2)}  relMax ${String(row.relMax).padStart(5)}  tip ${String(row.tip).padStart(5)} (old25 clamp: flip60 ${String(row.oldFlip60_pct).padStart(5)}%  tip ${String(row.oldTip).padStart(5)})${NOCLAMP ? `  none tip ${row.noneTip} dTipMax ${row.dTipMax}` : ''}${a.commits ? `  commits ${a.commits}` : ''}${a.hits ? `  hits ${a.hits}` : ''}${row.nan ? '  NaN!' : ''}`);
    }
  }
  console.log('\n무기별 (창 0.6 s 합계):  flip60% = 60 Hz 표본 부호 뒤집힘 비율 (관문 ≤ 7%, 여기서는 보고만),  old25/new60/clips = 스텝 수 합');
  const summary = {};
  for (const [w, g] of Object.entries(per)) {
    const s = (summary[w] = { flip60_pct: r1((100 * g.flip60) / Math.max(1, g.n60)), flip120_pct: r1((100 * g.flip120) / Math.max(1, g.steps)), oldFlip60_pct: r1((100 * g.oldFlip60) / Math.max(1, g.oldN60)), old25: g.old25, new60: g.new60, clips: g.clips, relMax: r1(g.relMax), tipArm: r2(g.tipArm), tipCommit: r2(g.tipCommit), oldTipArm: r2(g.oldTipArm), oldTipCommit: r2(g.oldTipCommit), steps: g.steps, nan: g.nan });
    if (NOCLAMP) s.dTipMax = +g.dTipMax.toFixed(4);
    console.log(`${w.padEnd(17)} flip60 ${String(s.flip60_pct).padStart(5)}% (old25 clamp ${String(s.oldFlip60_pct).padStart(5)}%)  flip120 ${String(s.flip120_pct).padStart(5)}%  old25 ${String(s.old25).padStart(4)}  new60 ${String(s.new60).padStart(3)}  clips ${String(s.clips).padStart(3)}  relMax ${String(s.relMax).padStart(6)}  tip arm ${s.tipArm} commit ${s.tipCommit} (old25 clamp: arm ${s.oldTipArm} commit ${s.oldTipCommit})${NOCLAMP ? `  dTipMax ${s.dTipMax}` : ''}${s.nan ? '  NaN!' : ''}`);
  }
  STRIKE.wristRel = rel0.on;
  STRIKE.wristRelMax = rel0.max;
  if (process.env.OUT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.OUT, JSON.stringify({ cond: { hz: HZ, vs: VS, fams: FAMS, modes: MODES, seed: SEED, skill: 0.7, gait: BODY.weightMode, window_s: WIN, wristRel: rel0.on, wristRelMax: rel0.max, R0_OFF: process.env.R0_OFF === '1' }, summary, rows }, null, 1));
    console.log('→', process.env.OUT);
  }
}
