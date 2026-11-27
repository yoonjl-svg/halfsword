// r29 inj 1 — far lunge contact trace. Same scene as tools/sim/riso_reach.mjs lungeAt (SECRET.risolutoSlide 0.6 as in the test),
//  plus: every onWound / onClash event (whose blade, blade point distance from the guard, body part, time from fire, speed, energy chain),
//  and a per-step body trace of the lunger P and the target A. Reads only; changes no game value except optional LEGS mutation (--ecc / --lim).
//  usage: (cd <cell> && node $S/.../lunge_trace.mjs --root=. [--gaps=3.2] [--seeds=1] [--ecc=1.3] [--lim=1.25] [--out=<json>] [--trace=<csv>])
//   --ecc / --lim: mutate the exported LEGS object of the cell (LEGS.ecc = x · every LEGS.limit entry * y) before any scene is built.
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const CFGM = await import(u('src/config.js'));
const { LEGS } = CFGM;
if (args.ecc != null) LEGS.ecc = +args.ecc;
if (args.lim != null) for (const k of Object.keys(LEGS.limit)) LEGS.limit[k] *= +args.lim;
const { newRound, CONFIG, DT, THREE } = await import(u('tools/sim/harness_m.mjs'));
const { applyWeaponMeasure } = await import(u('tools/sim/weapon_measures.mjs'));
const { PlayerSecretWatch } = await import(u('src/secret.js'));
const { PlayerParryGuard } = await import(u('src/parry_button.js'));
const CB = await import(u('src/combat.js'));
const { SECRET, STRIKE } = CONFIG;
const K = CONFIG.TIME.k;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +(+x).toFixed(3));
const range = (s) => String(s).split(',').map(Number);
const GAPS = range(args.gaps ?? '3.2');
const SEEDS = range(args.seeds ?? '1');
const old = SECRET.risolutoSlide; SECRET.risolutoSlide = 0.6;
const runs = [];
let traceRows = ['gap,seed,step,tReal,Pstate,iaiKind,iaiT,secStage,PpelX,PpelY,PpelZ,PvX,PvZ,PchestY,PfootFx,PfootBx,PtipX,PtipY,PtipZ,AchestX,AchestY,AchestZ,ApelX,dPel,tipGap,PkneeF,PkneeB,stanceF,stanceB'];
const fwdAxis = (P, A) => { const a = P.bodies.pelvis.translation(), b = A.bodies.pelvis.translation(); const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l, ox: a.x, oz: a.z }; };
const along = (F, p) => (p.x - F.ox) * F.x + (p.z - F.oz) * F.z;
const kneeDeg = (P, k) => { // angle between thigh and shin long axes (deg)
  const th = P.bodies['thigh' + k], sh = P.bodies['shin' + k]; if (!th || !sh) return null;
  const a = new THREE.Vector3(0, 1, 0).applyQuaternion(th.rotation()), b = new THREE.Vector3(0, 1, 0).applyQuaternion(sh.rotation());
  return (Math.acos(Math.max(-1, Math.min(1, a.dot(b)))) * 180) / Math.PI;
};
for (const gap of GAPS) for (const seed of SEEDS) {
  const G = newRound({ weapon: 'rapier', weapon2: 'longsword', gap, seed });
  applyWeaponMeasure(G.ai, 'longsword');
  const P = G.player, A = G.enemy;
  G.ai.update = () => {};
  P.foe = A; A.foe = P;
  const tip = new THREE.Vector3();
  const out = { gap, seed, legs: { ecc: LEGS.ecc, hipFlex: LEGS.limit.hipFlex }, hit: false, sev: 0, over: null, events: [], clashes: [], dEnd: null, tipGapMin: Infinity, lungeEnd: null };
  try {
    for (let i = 0; i < Math.round((CONFIG.ARENA.startHold + 0.3) / DT); i++) G.step();
    const pg = new PlayerParryGuard(P, A); P.stamina.controller = pg;
    const ps = new PlayerSecretWatch(P, A);
    ps.openWindow({ ev: 'risoluto', path: 'touch', held: 0 });
    const o = ps.fire();
    out.ok = !!(o && P.skill.secret(o));
    const t0 = G.t, F = fwdAxis(P, A);
    let stepI = 0;
    const ow = G.combat.hooks.onWound;
    G.combat.hooks.onWound = (att, vic, r, point, pr, ...rest) => {
      // read-only extras before the original hook (pre-step caches are the same ones analyze used)
      const HL = att.weaponCfg.hiltLength, BL = att.weaponCfg.bladeLength;
      const stepM = CB.stepMassOf ? CB.stepMassOf(att, vic) : null;
      const thr = CB.thrustingNow ? CB.thrustingNow(att) : null;
      const wMult = att.weaponCfg.power * (r.type === 'cut' ? att.weaponCfg.mCut : r.type === 'stab' ? att.weaponCfg.mThrust : 1);
      const pv = att.cache?.parts?.pelvis?.v;
      const I = att.iai;
      const ev = {
        tReal: r3((G.t - t0) / K), step: stepI, att: att === P ? 'P' : 'A', vic: vic === P ? 'P' : 'A', bladePart: pr?.w?.part, bodyPart: pr?.v?.part, zone: r.zone, type: r.type,
        bladeT: r3(r.t), fromGuard_m: r3(r.t * BL), fromHand_m: r3(HL + r.t * BL), bladeLen: BL, speed: r3(r.speed), alongAxis: r3(r.bladeAxis && r.dir ? r.bladeAxis.dot(r.dir) : null),
        ephys: r3(r.ephys), mFree: r3(r.mFree), mEff: r3(r.mEff), stepMass_now: r3(stepM), thrustingNow: thr, bladeWeight: r3(CB.bladeWeight ? CB.bladeWeight(r.t) : null),
        energy: r3(r.energy), thr: r3(r.thr), eff: r3(r.eff), wMult: r3(wMult), quality_est: r3(r.eff != null && r.energy > 0 ? r.eff / (r.energy * wMult) : null), severity: r3(r.severity), pass: r.pass,
        secretHit: att.secretHit ?? 1, attPelvisV: pv ? [r3(pv.x), r3(pv.y), r3(pv.z)] : null, attPelvisVfwd: pv ? r3(pv.x * F.x + pv.z * F.z) : null,
        attState: att.state, attIai: I ? { kind: I.kind, t: r3(I.t), T: r3(I.T), stage: I.stage ?? I.phase ?? null, mv: I.i ?? I.idx ?? null } : null, attSecStage: att.skill?.sec?.stage ?? null, lungeRes: !!att.skill?.sec?.lungeRes,
        vicLocal: r.local ? [r3(r.local.x), r3(r.local.y), r3(r.local.z)] : null, vicPartY: r3(vic.bodies[pr?.v?.part]?.translation().y), vicState: vic.state, vicMode: vic === A ? G.ai.mode : null, point: point ? [r3(point.x), r3(point.y), r3(point.z)] : null, pointAlong: point ? r3(along(F, point)) : null,
      };
      out.events.push(ev);
      ow?.(att, vic, r, point, pr, ...rest);
      if (att === P && vic === A && r.type !== 'blunt' && (r.severity ?? 0) > 0) (out.sev += r.severity), (out.hit = true);
    };
    const oc = G.combat.hooks.onClash;
    G.combat.hooks.onClash = (point, sp, info) => { oc?.(point, sp, info); out.clashes.push({ tReal: r3((G.t - t0) / K), sp: r3(sp) }); };
    const n = Math.round((1.2 * K) / DT);
    for (let i = 0; i < n; i++) {
      stepI = i;
      G.step();
      const I = P.iai;
      if (I?.kind === 'combo' && I.moves?.[0]?.lunge && I.overshoot != null) out.over = r3(I.overshoot);
      const c = A.bodies.chest.translation();
      P.bladePoint(1, tip);
      const gapT = Math.hypot(tip.x - c.x, tip.y - c.y, tip.z - c.z);
      out.tipGapMin = Math.min(out.tipGapMin, gapT);
      const L = P.skill.sec?.lungeRes;
      if (L && out.lungeEnd == null) out.lungeEnd = { tReal: r3((G.t - t0) / K), slide: r3(L.slide), foot: r3(L.foot), blocked: !!L.blocked };
      if (args.trace) {
        const pp = P.bodies.pelvis.translation(), pv = P.bodies.pelvis.linvel(), pc = P.bodies.chest.translation(), ff = P.bodies.footF.translation(), fb = P.bodies.footB.translation(), ap = A.bodies.pelvis.translation();
        const g = P.gait?.legs;
        traceRows.push([gap, seed, i, r3((G.t - t0) / K), P.state, I?.kind ?? '', r3(I?.t), P.skill.sec?.stage ?? '', r3(along(F, pp)), r3(pp.y), r3(pp.x * -F.z + pp.z * F.x), r3(pv.x * F.x + pv.z * F.z), r3(pv.x * -F.z + pv.z * F.x), r3(pc.y), r3(along(F, ff)), r3(along(F, fb)), r3(along(F, tip)), r3(tip.y), r3(tip.x * -F.z + tip.z * F.x), r3(along(F, c)), r3(c.y), r3(c.x * -F.z + c.z * F.x), r3(along(F, ap)), r3(Math.hypot(ap.x - pp.x, ap.z - pp.z)), r3(gapT), r3(kneeDeg(P, 'F')), r3(kneeDeg(P, 'B')), g?.F?.stance ? 1 : 0, g?.B?.stance ? 1 : 0].join(','));
      }
    }
    out.tipGapMin = r3(out.tipGapMin); out.sev = r3(out.sev); out.dEnd = r3(P.foeDistance());
  } finally { G.world.free(); }
  runs.push(out);
  const pa = out.events.filter((e) => e.att === 'P' && e.vic === 'A');
  const first = pa[0];
  console.log(`gap ${gap} seed ${seed} ecc ${LEGS.ecc} hipFlex ${LEGS.limit.hipFlex}: ${out.hit ? 'HIT' : 'miss'} sev ${out.sev} over ${out.over} dEnd ${out.dEnd} tipGapMin ${out.tipGapMin} lungeEnd ${out.lungeEnd?.tReal} | P->A events ${pa.length}` + (first ? ` first t ${first.tReal} ${first.type} ${first.energy} J blade ${first.bladePart} ${first.fromGuard_m} m from guard -> ${first.bodyPart} speed ${first.speed}` : '') + ` | all events ${out.events.map((e) => `${e.att}>${e.vic}@${e.tReal}:${e.type}/${e.bodyPart}/${e.energy}`).join(' ')}`);
}
SECRET.risolutoSlide = old;
if (args.out) writeFileSync(String(args.out), JSON.stringify(runs, null, 1));
if (args.trace) writeFileSync(String(args.trace), traceRows.join('\n') + '\n');
