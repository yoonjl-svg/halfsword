// probe (b): fallDir from tools/sim/iai_obi.test.mjs (copied; not exported), with seed and impulse as args
// usage: node probe_b.mjs <tree> <dir 앞|뒤|왼|오른> <imp> <seed...>
const T = process.argv[2];
const { CONFIG, DT, newRound } = await import(T + '/tools/sim/harness_m.mjs');
const { sayaMeasure } = await import(T + '/tools/sim/iai_obi.mjs');
const THREE = await import(T + '/node_modules/three/build/three.module.js');
const { SECRET } = CONFIG;
const withS = (vals, fn) => { const old = {}; for (const k of Object.keys(vals)) (old[k] = SECRET[k]), (SECRET[k] = vals[k]); try { return fn(); } finally { Object.assign(SECRET, old); } };
const fallDir = (dir, droop, seed, imp) =>
  withS({ iaiObiDroop: droop }, () => {
    const G = newRound({ walls: false, weapon: 'uchigatana', weapon2: 'longsword', seed, gap: 7.0 });
    const P = G.player;
    try {
      P.aiControlled = true;
      G.ai.update = () => { G.enemy.move.set(0, 0); };
      G.before = () => { P.move.set(0, 0); };
      while (G.t < CONFIG.ARENA.startHold + 0.3) G.step();
      const c = P.bodies.chest;
      const p = c.translation();
      const o = G.enemy.bodies.chest.translation();
      const fw = new THREE.Vector3(o.x - p.x, 0, o.z - p.z).normalize();
      const lf = new THREE.Vector3(0, 1, 0).cross(fw);
      const d = { 앞: fw, 뒤: fw.clone().negate(), 왼: lf, 오른: lf.clone().negate() }[dir];
      const hand0 = P.bodies.farmS.translation();
      c.applyImpulseAtPoint({ x: d.x * imp, y: 0, z: d.z * imp }, { x: p.x, y: p.y + 0.1, z: p.z }, true);
      P.die('obi-test', true);
      const r = { ground: 1, gT: 0, swingAtMin: 0, torso: 1, leg: 1, top: -1 };
      for (let i = 0; i < Math.round(3.0 / DT); i++) {
        G.step();
        if (i % 4) continue;
        const m = sayaMeasure(P);
        if (m.ground < r.ground) (r.ground = m.ground, r.gT = +(i * DT).toFixed(2), r.swingAtMin = +(+m.swing).toFixed(1), r.pelvisY = +P.bodies.pelvis.translation().y.toFixed(3));
        r.torso = Math.min(r.torso, m.gap);
        r.leg = Math.min(r.leg, m.leg);
        if (i > 1.5 / DT) r.top = Math.max(r.top, Math.max(...m.axis.map((q) => q.y)));
      }
      // final body roll: pelvis local x (left?) y component
      const q = P.bodies.pelvis.rotation(); const Q = new THREE.Quaternion(q.x, q.y, q.z, q.w);
      r.pelvisUpY = +new THREE.Vector3(0, 1, 0).applyQuaternion(Q).y.toFixed(2);
      r.pelvisXY = +new THREE.Vector3(1, 0, 0).applyQuaternion(Q).y.toFixed(2);
      r.pelvisZY = +new THREE.Vector3(0, 0, 1).applyQuaternion(Q).y.toFixed(2);
      const h = P.bodies.farmS.translation(), pv = P.bodies.pelvis.translation();
      r.handRelPelvis = [h.x - pv.x, h.y - pv.y, h.z - pv.z].map((v) => +v.toFixed(2));
      for (const k of ['ground', 'torso', 'leg', 'top']) r[k] = +r[k].toFixed(3);
      return r;
    } finally { G.world.free(); }
  });
const [dir, imp] = [process.argv[3], +process.argv[4]];
for (const s of process.argv.slice(5)) console.log(JSON.stringify({ dir, imp, seed: +s, ...fallDir(dir, 1, +s, imp) }));
process.exit(0);
