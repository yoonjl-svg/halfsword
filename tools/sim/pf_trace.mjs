// parrySpeed 역설 추적 — X 쪽만 parrySpeed 를 바꾼 숙련 4 거울에서 X 의 모드 · 막기 마디 · 맞음을 센다
//  node tools/sim/pf_trace.mjs <name> <seeds> <out.json> '<json level>' [--fix]
import { writeFileSync } from 'node:fs';
const H = await import('./harness_m.mjs');
const M = await import('./prof_gap_measure.mjs');
const { WEAPONS } = await import('./ai_ring_measure.mjs');
const [name, seedsN, out, lvJson, ...rest] = process.argv.slice(2);
const lv = JSON.parse(lvJson || '{}');
const SEED0 = +(process.env.SEED0 || 1), SCOPE = process.env.SCOPE || 'all', PSV = +(process.env.PSV || 0); // SCOPE def = 막기 때만 · nodef = 막기 아닐 때만 PSV 로
const A = { fights: 0, xW: 0, yW: 0, res: { x: 0, y: 0, d: 0 }, t: 0, modeT: {}, defEp: 0, defDur: 0, defPadDist0: 0, defReach: 0, defReachT: 0, defClash: 0, defHurt: 0, defHurtYW: 0, atk: 0,
  xHitBy: {}, yHitBy: {}, xHitAge: { def0_0p3: 0, def0p3_0p6: 0, post0p6: 0, nodef: 0 }, afterDefHurt: 0, afterDefEp: 0, padSp: [], aimReach: 0, aimReachN: 0, wdSteps: 0, wdPath: 0, wdTipV: 0, defTipV: 0, defSteps: 0, wdFast: 0, xHitType: {}, yHitType: {}, clashN: 0 };
for (const school of M.SCHOOLS) for (const [wi, weapon] of WEAPONS[school].entries()) for (let seed = SEED0; seed < SEED0 + +seedsN; seed++) for (const swap of [false, true]) {
  const pX = { proficiency: 4, ...(Object.keys(lv).length ? { level: lv } : {}) }, pY = { proficiency: 4 };
  const g = H.newRound({ seed: seed * 100 + wi * 10 + (swap ? 1 : 0), walls: true, weapon, weapon2: weapon, AI2Class: H.AI, difficulty: 'hard', difficulty2: 'hard', persona: swap ? pX : pY, persona2: swap ? pY : pX });
  const X = swap ? g.enemy : g.player, Y = swap ? g.player : g.enemy;
  const aiX = swap ? g.ai : g.ai2;
  if (PSV && SCOPE !== 'all') { const L0 = aiX.level; aiX.level = new Proxy(L0, { get(t, k) { if (k === 'parrySpeed') { const d = aiX.mode === 'defend'; return (SCOPE === 'def' ? d : !d) ? PSV : t.parrySpeed; } return t[k]; } }); }
  let lastPad = null;
  let ep = null, lastDefEnd = -9, prevMode = null, clash0 = 0;
  const dead = (f) => !f.alive || f.state === 'dead';
  g.onWound = (a, v, r) => {
    if (!(r.severity > 0)) return;
    const k = `${r.zone}:${r.type}`;
    if (v === X) {
      A.xW++;
      const age = ep ? g.t - ep.t0 : g.t - lastDefEnd;
      const key = ep ? (age < 0.3 ? 'def0_0p3' : 'def0p3_0p6') : g.t - lastDefEnd < 0.6 ? 'post0p6' : 'nodef';
      A.xHitAge[key]++;
      const m = `${aiX.mode}${aiX.mode === 'attack' ? ':' + aiX.phase : ''}`;
      A.xHitBy[m] = (A.xHitBy[m] || 0) + 1;
      A.xHitType[r.type] = (A.xHitType[r.type] || 0) + 1;
      if (ep) ep.hurt = true;
      else if (g.t - lastDefEnd < 0.6 && lastEp) lastEp.hurtAfter = true;
    } else if (v === Y) {
      A.yW++;
      const m = `${aiX.mode}${aiX.mode === 'attack' ? ':' + aiX.phase : ''}`;
      A.yHitBy[m] = (A.yHitBy[m] || 0) + 1;
      A.yHitType[r.type] = (A.yHitType[r.type] || 0) + 1;
      if (ep) ep.yw = true;
    }
  };
  let lastEp = null;
  while (g.t < 60 && !dead(X) && !dead(Y)) {
    g.step();
    const mode = aiX.mode;
    A.modeT[mode] = (A.modeT[mode] || 0) + 1;
    if (mode === 'attack' && prevMode !== 'attack') A.atk++;
    if (mode === 'defend' && prevMode !== 'defend') { ep = { t0: g.t, clash: g.clashes, reached: null, d0: Math.hypot(aiX.hand.x - X.handOffset.x, aiX.hand.y - X.handOffset.y) }; }
    if (ep) {
      const dd = Math.hypot(aiX.hand.x - X.handOffset.x, aiX.hand.y - X.handOffset.y);
      if (ep.reached == null && dd < 0.02) ep.reached = g.t - ep.t0;
      if (ep.aimR == null && Math.hypot(aiX.hand.x - X.skill.aim.x, aiX.hand.y - X.skill.aim.y) < 0.04) ep.aimR = g.t - ep.t0;
      if (mode === 'defend') { A.defTipV += X.tipVel.length(); A.defSteps++; }
      if (mode !== 'defend') {
        A.defEp++; A.defDur += g.t - ep.t0; A.defPadDist0 += ep.d0;
        if (ep.reached != null) { A.defReach++; A.defReachT += ep.reached; }
        if (ep.aimR != null) { A.aimReach += ep.aimR; A.aimReachN++; }
        if (g.clashes > ep.clash) A.defClash++;
        if (ep.hurt) A.defHurt++;
        if (ep.yw) A.defHurtYW++;
        lastDefEnd = g.t; lastEp = ep; ep = null;
      }
    }
    if (mode === 'withdraw') { A.wdSteps++; A.wdTipV += X.tipVel.length(); const px = X.handOffset; if (lastPad) { const v = Math.hypot(px.x - lastPad[0], px.y - lastPad[1]) / H.DT; A.wdPath += v; if (v > 3) A.wdFast++; } lastPad = [px.x, px.y]; } else lastPad = null;
    prevMode = mode;
  }
  A.fights++; A.t += g.t; A.clashN += g.clashes;
  A.xW; A.res[dead(Y) && !dead(X) ? 'x' : dead(X) && !dead(Y) ? 'y' : 'd']++;
  g.world.free();
}
writeFileSync(out, JSON.stringify({ name, ...A }));
