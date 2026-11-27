// r22p 디딤 진단(재기만 · 개발용): 칸 폴더에서 node diag.mjs <판 수> — 디딤마다 걸음 꼴 · 무릎 굽힘 · 골반 실제 높이 · 골반 목표 g.h · 자세 높이 hNom · 엉덩이~발목 수평 · 수직 거리 · 발 뜬 시간 몫 u · 딛은 다리가 무릎 0.25 rad 로 닿는 높이 · 그 다리 수평 거리 의 가운데 값
const H = await import(process.cwd() + '/tools/sim/harness_m.mjs');
const FW = ['longsword', 'rapier', 'zweihander'];
const kneePhi = (D, k) => { const L = D.legs[k]; const len = L.ph.distanceTo(L.pa); const c = Math.max(-1, Math.min(1, (L.lenT ** 2 + L.lenS ** 2 - len * len) / (2 * L.lenT * L.lenS))); return Math.PI - Math.acos(c); };
const rows = []; const NF = +(process.argv[2] ?? 3);
for (let s = 1; s <= NF; s++) {
  const G = H.newRound({ walls: true, seed: s, weapon: FW[(s - 1) % 3], weapon2: FW[s % 3], AI2Class: H.AI });
  const st = new Map();
  for (let i = 0; i < 30 * 120; i++) {
    G.step();
    for (const f of [G.player, G.enemy]) {
      if (f.state !== 'stand') continue; const g = f.gait, D = f.legDrive; if (!g?.legs || !D?.legs) continue;
      const z = st.get(f) ?? { F: { s: 1 }, B: { s: 1 } }; st.set(f, z);
      for (const k of ['F', 'B']) { const l = g.legs[k], s1 = l.stance ? 1 : 0;
        if (s1 && !z[k].s) { const L = D.legs[k]; const p = f.bodies.pelvis.translation(); const o = g.legs[k === 'F' ? 'B' : 'F']; const Ls = Math.sqrt(.43*.43+.42*.42+2*.43*.42*Math.cos(0.25)); const ohx = o.hip.x - o.plant.x, ohz = o.hip.z - o.plant.z; const lp = g.legs[k]; rows.push({ u: z[k].u, odx: Math.hypot(ohx, ohz), oy: 0.062 + Math.sqrt(Math.max(0.04, Ls*Ls - ohx*ohx - ohz*ohz)) + 0.04, kind: z[k].kind, phi: kneePhi(D, k), y: p.y, h: g.h, hN: g.hNom, dx: Math.hypot(L.ph.x - L.pa.x, L.ph.z - L.pa.z), dy: L.ph.y - L.pa.y, school: g.P.guardHeight }); }
        if (!s1) { z[k].kind = l.kind; z[k].u = l.t / l.T; } z[k].s = s1; }
    }
    if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
  }
}
const med = (a) => { a = [...a].sort((x, y) => x - y); return a[a.length >> 1]; };
const by = {}; for (const r of rows) (by[r.kind] ??= []).push(r);
for (const k in by) { const R = by[k]; console.log(k, R.length, 'phi', (med(R.map((r) => r.phi)) * 57.3).toFixed(1), 'pelvis', med(R.map((r) => r.y)).toFixed(3), 'h', med(R.map((r) => r.h)).toFixed(3), 'hNom', med(R.map((r) => r.hN)).toFixed(3), 'dx', med(R.map((r) => r.dx)).toFixed(3), 'dy', med(R.map((r) => r.dy)).toFixed(3), 'u', med(R.map((r) => r.u)).toFixed(2), 'otherReach14', med(R.map((r) => r.oy)).toFixed(3), 'otherDx', med(R.map((r) => r.odx)).toFixed(3)); }
