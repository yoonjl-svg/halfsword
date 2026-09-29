// AI vs AI: record every wound (zone,type,eff,thr,plate,helmet) and every fresh blade clash impulse / rebound jolt,
// and peak sword tip speeds (per step, per fighter). Deaths disabled? no — record time to death.
// usage (저장소 루트에서): node tools/redesign_probes/duelstats.mjs N secs  (env W, W2, LOOK=1 armored looks, OUT=결과 json)
// SPD/CAP/HOLDALL/HOLDEFF 훅은 실험판 src(exp_src.patch) 에서만 듣는다 — 이 저장소 src 에는 적용하지 않았다(기본 통계만 나온다).
const N = +(process.argv[2] || 6);
const SECS = +(process.argv[3] || 20);
if (process.env.SPD) globalThis.__WRIST_SPD = +process.env.SPD;
if (process.env.CAP) globalThis.__SPEEDCAP = +process.env.CAP;
if (process.env.HOLDALL) globalThis.__HOLDALL = 1;
if (process.env.HOLDEFF) globalThis.__HOLDEFF = 1;
const H = await import('../sim/harness_m.mjs');
const { newRound, AI, THREE } = H;
const { LOOKS, getLook } = await import('../../src/looks.js');
const W = process.env.W || 'longsword';
const W2 = process.env.W2 || W;
const out = { fast: [], spikes: 0, flips: 0, steps: 0, stuckSteps: 0, over30: 0, capHits: null, wounds: [], clashJ: [], jolts: [], tipPeaks: [], tipHist: {}, deaths: [] };
const bins = [10, 15, 20, 25, 30, 35, 40, 50, 60, 1e9];
for (let s = 0; s < N; s++) {
  const opts = { seed: 100 + s, weapon: W, weapon2: W2, AI2Class: AI };
  if (process.env.LOOK) { opts.look2 = getLook(process.env.LOOK); }
  const G = newRound(opts);
  const fs = [G.player, G.enemy];
  G.onWound = (att, vic, r) => out.wounds.push({ s, t: +G.t.toFixed(2), att: att.index, zone: r.zone, type: r.type, E: +r.energy.toFixed(1), eff: r.eff == null ? null : +r.eff.toFixed(1), thr: r.thr == null ? null : +r.thr.toFixed(1), sev: +r.severity.toFixed(2), plate: r.plate, helmet: r.helmet, speed: +r.speed.toFixed(1), pass: r.pass });
  const oc = G.combat.hooks.onClash;
  G.combat.hooks.onClash = (p, sp, info) => { oc?.(p, sp, info); if (info.fresh) out.clashJ.push({ s, J: +info.impulse.toFixed(2), vn: +info.vn.toFixed(1) }); };
  for (const f of fs) { const oj = f.takeJolt?.bind(f); f.takeJolt = (J) => { out.jolts.push(+J.toFixed(2)); return oj?.(J); }; }
  const peak = [0, 0]; const hist = [[], []]; const prevW = [null, null], prevDw = [null, null];
  const tip = new THREE.Vector3();
  for (let k = 0; k < Math.round(SECS / H.DT); k++) {
    G.step();
    fs.forEach((f, i) => {
      if (!f.armed) return;
      const sw = f.sword; const L = f.weaponCfg.hiltLength + f.weaponCfg.bladeLength;
      tip.set(0, L, 0).applyQuaternion(H.Q(sw.rotation())).add(H.V(sw.translation()));
      const v = sw.velocityAtPoint({ x: tip.x, y: tip.y, z: tip.z });
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > peak[i]) peak[i] = sp;
      out.steps++; if (sp > 30) out.over30++;
      if (sp > 38 && (hist[i].length === 0 || hist[i][hist[i].length - 1] <= 38)) {
        const cm = G.combat; let stuck = 0, cutting = 0;
        for (const c of cm.cutting.values()) if (c.pr.w.fighter === f) { cutting++; if (c.stuckT > 0 || c.held) stuck++; }
        const hand = f.bodies.farmS.linvel(); const hs = Math.hypot(hand.x, hand.y, hand.z);
        const wv0 = sw.angvel(), fw = f.bodies.farmS.angvel();
        out.fast.push({ s, t: +G.t.toFixed(2), i, sp: +sp.toFixed(1), prev: +(hist[i][hist[i].length - 1] ?? 0).toFixed(1), clash: cm.stepNo - cm.bladeLast <= 3, cutting, stuck, commit: !!f.commit?.on, brake: !!f.wristBrake, aimErrDeg: +((f.aimErr ?? 0) * 57.3).toFixed(0), wRel: +Math.hypot(wv0.x - fw.x, wv0.y - fw.y, wv0.z - fw.z).toFixed(1), handV: +hs.toFixed(1), cap: +(f.debug?.wristCap ?? 0).toFixed(1), state: f.state });
      }
      const hh = hist[i]; hh.push(sp); if (hh.length > 12) hh.shift();
      if (hh.length === 12) { const base = [...hh.slice(0, 8)].sort((a, b) => a - b)[4]; if (hh[9] > Math.max(1.5 * base, base + 8) && hh[11] < 0.8 * hh[9]) out.spikes++; }
      const wv = sw.angvel(); const W = new THREE.Vector3(wv.x, wv.y, wv.z);
      if (prevW[i]) { const dw = W.clone().sub(prevW[i]); if (prevDw[i] && dw.length() > 2 && prevDw[i].length() > 2 && dw.dot(prevDw[i]) < -0.8 * dw.length() * prevDw[i].length()) out.flips++; prevDw[i] = dw; }
      prevW[i] = W;
      const b = bins.findIndex((x) => sp < x);
      out.tipHist[bins[b]] = (out.tipHist[bins[b]] || 0) + 1;
    });
    for (const c of G.combat.cutting.values()) if (c.stuckT > 0) out.stuckSteps++;
    if (fs.some((f) => f.state === 'dead')) { out.deaths.push({ s, t: +G.t.toFixed(2), who: fs.findIndex((f) => f.state === 'dead') }); break; }
  }
  out.tipPeaks.push(peak.map((x) => +x.toFixed(1)));
}
out.capHits = globalThis.__capHits || [];
const fn = process.env.OUT || new URL(`./out/duel_${W}_${W2}${process.env.LOOK ? '_armor' : ''}.json`, import.meta.url).pathname;
(await import('node:fs')).mkdirSync(new URL('./out/', import.meta.url), { recursive: true });
(await import('node:fs')).writeFileSync(fn, JSON.stringify(out));
console.log(fn, 'steps', out.steps, 'over30', out.over30, 'spikes', out.spikes, 'flips(60Hz chatter)', out.flips, 'stuckSteps', out.stuckSteps, 'capHits', out.capHits.length, 'wounds', out.wounds.length, 'clashes', out.clashJ.length, 'deaths', out.deaths.length, 'peaks', JSON.stringify(out.tipPeaks));
