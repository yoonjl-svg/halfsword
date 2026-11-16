// ─────────────────────────────────────────────────────────────
//  intercept_timing.mjs — 막기 2.0 단계 B 진단 (11/17 · docs/strike/ai_intercept_2026-11-17.md §4). 게임 값은 건드리지 않는다.
//  숙련 4 거울 30 판(유파 다섯 × 씨앗 셋 × 무기 둘 · 겉모습 같음 · 60 s):
//   time   — 휘두름(strike) 하나마다: 휘두름 길이 · 첫 상처 때 · 막는 쪽이 위협을 처음 본 때 · 반응 굴림 때 (휘두름 시작부터 · 25/50/75 %)
//   defend — 칼로 막는 막기(defend · 피하기 아님) 한 번마다: 그동안 상대가 휘둘렀나 · 칼끼리 닿음 · 막는 동안 다침 · 두 칼 최소 거리 · 시작 때 상대 꼴
//  node tools/sim/intercept_timing.mjs time
//  node tools/sim/intercept_timing.mjs defend [--icp=1]
// ─────────────────────────────────────────────────────────────
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { LOOKS } from '../../src/looks.js';
import { WEAPONS } from './ai_ring_measure.mjs';

function timeDiag() {
  const A = [];
  for (const school of ['german', 'italian', 'iberian', 'japanese', 'chinese']) for (const seed of [1, 2, 3]) for (const wi of [0, 1]) {
    const weapon = WEAPONS[school][wi];
    const G = newRound({ seed: seed * 100 + wi * 10, walls: true, weapon, weapon2: weapon, AI2Class: AI, look: LOOKS.enemy, look2: LOOKS.enemy, difficulty: 'hard', difficulty2: 'hard', persona: { proficiency: 4 }, persona2: { proficiency: 4 } });
    const fs = [G.player, G.enemy];
    const aiOf = new Map([[G.enemy, G.ai], [G.player, G.ai2]]);
    const open = new Map();
    for (const f of fs) {
      const a = aiOf.get(f);
      const oT = a.threat.bind(a);
      a.threat = (...x) => { const r = oT(...x); const foe = f === G.player ? G.enemy : G.player; const S = open.get(foe); if (r && S && S.tTh == null) S.tTh = G.t - S.t0; return r; };
      const oR = a.respond.bind(a);
      a.respond = (th, d) => { const foe = f === G.player ? G.enemy : G.player; const S = open.get(foe); const before = a.threatSeen; const r = oR(th, d); if (S && S.tR == null && a.threatSeen === th.id && before !== th.id) { S.tR = G.t - S.t0; S.dec = !r ? 'fail' : a.mode === 'attack' ? 'counter' : a.defVoid ? 'void' : 'parry'; } return r; };
    }
    G.onWound = (att, vic, r) => { const S = open.get(att); if (r.severity > 0 && S && S.tW == null) S.tW = G.t - S.t0; };
    const prev = new Map();
    while (G.t < 60 && G.player.alive && G.enemy.alive) {
      G.step();
      for (const f of fs) {
        const a = aiOf.get(f), ph = a.mode === 'attack' ? a.phase : '';
        if (ph === 'strike' && prev.get(f) !== 'strike') { const S = { t0: G.t, tEnd: null }; A.push(S); open.set(f, S); }
        const S = open.get(f);
        if (S && S.tEnd == null && ph !== 'strike') S.tEnd = G.t - S.t0;
        if (S && G.t - S.t0 > 1.0) open.delete(f);
        prev.set(f, ph);
      }
    }
    G.world.free();
  }
  const q = (a, p) => { const s = a.filter((x) => x != null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length * p)].toFixed(3) : '-'; };
  console.log('strikes', A.length, '| strike dur p25/50/75', q(A.map((s) => s.tEnd), 0.25), q(A.map((s) => s.tEnd), 0.5), q(A.map((s) => s.tEnd), 0.75));
  console.log('first wound (when any) p25/50/75', q(A.map((s) => s.tW), 0.25), q(A.map((s) => s.tW), 0.5), q(A.map((s) => s.tW), 0.75), 'share', (A.filter((s) => s.tW != null).length / A.length).toFixed(2));
  console.log('defender first threat seen p25/50/75', q(A.map((s) => s.tTh), 0.25), q(A.map((s) => s.tTh), 0.5), q(A.map((s) => s.tTh), 0.75), 'share', (A.filter((s) => s.tTh != null).length / A.length).toFixed(2));
  console.log('defender respond roll p25/50/75', q(A.map((s) => s.tR), 0.25), q(A.map((s) => s.tR), 0.5), q(A.map((s) => s.tR), 0.75), 'share', (A.filter((s) => s.tR != null).length / A.length).toFixed(2), JSON.stringify(A.reduce((a, s) => ((a[s.dec ?? 'none'] = (a[s.dec ?? 'none'] ?? 0) + 1), a), {})));
  const both = A.filter((s) => s.tW != null && s.tTh != null);
  console.log('wound before threat seen', (both.filter((s) => s.tW <= s.tTh).length / both.length).toFixed(2), 'n', both.length);

}

function defendDiag(ICP) {
  CONFIG.AI_INTERCEPT.on = ICP;
  function segDist(p1, q1, p2, q2) {
    const d1 = q1.clone().sub(p1), d2 = q2.clone().sub(p2), r = p1.clone().sub(p2);
    const a = d1.dot(d1), e = d2.dot(d2), f = d2.dot(r); let s, t; const c = d1.dot(r), b = d1.dot(d2), den = a * e - b * b;
    s = den > 1e-9 ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0; t = (b * s + f) / e;
    if (t < 0) { t = 0; s = Math.min(1, Math.max(0, -c / a)); } else if (t > 1) { t = 1; s = Math.min(1, Math.max(0, (b - c) / a)); }
    return p1.clone().addScaledVector(d1, s).distanceTo(p2.clone().addScaledVector(d2, t));
  }
  const eps = [];
  for (const school of ['german', 'italian', 'iberian', 'japanese', 'chinese']) for (const seed of [1, 2, 3]) for (const wi of [0, 1]) {
    const weapon = WEAPONS[school][wi];
    const G = newRound({ seed: seed * 100 + wi * 10, walls: true, weapon, weapon2: weapon, AI2Class: AI, look: LOOKS.enemy, look2: LOOKS.enemy, difficulty: 'hard', difficulty2: 'hard', persona: { proficiency: 4 }, persona2: { proficiency: 4 } });
    const fs = [G.player, G.enemy];
    const aiOf = new Map([[G.enemy, G.ai], [G.player, G.ai2]]);
    const cur = new Map();
    let freshNow = false;
    G.combat.hooks.onClash = (p, sp, info) => { if (info.fresh) freshNow = true; };
    const wounded = new Set();
    G.onWound = (att, vic, r) => { if (r.severity > 0) wounded.add(vic); };
    while (G.t < 60 && G.player.alive && G.enemy.alive) {
      freshNow = false; wounded.clear();
      G.step();
      for (const f of fs) {
        const a = aiOf.get(f), foe = f === G.player ? G.enemy : G.player, fa = aiOf.get(foe);
        const on = a.mode === 'defend' && !a.defVoid;
        let E = cur.get(f);
        if (on && !E) { E = { t0: G.t, minD: 9, clash: false, hurt: false, foeStrike: false, icp: !!a.icp, hand0: Math.hypot(f.handOffset.x - (a.school.parry[a.defLine] ?? [0,0])[0], f.handOffset.y - (a.school.parry[a.defLine] ?? [0,0])[1]), foePh0: fa.mode + '/' + fa.phase, tClash: null, tHurt: null, dAtClash: null }; cur.set(f, E); }
        if (!on && E) { E.t1 = G.t; eps.push(E); cur.delete(f); continue; }
        if (!E) continue;
        if (f.armed && foe.armed) { const d = segDist(f.bladePoint(0), f.bladePoint(1), foe.bladePoint(0), foe.bladePoint(1)); E.minD = Math.min(E.minD, d); }
        if (fa.mode === 'attack' && fa.phase === 'strike') E.foeStrike = true;
        if (freshNow && !E.clash) { E.clash = true; E.tClash = G.t - E.t0; }
        if (wounded.has(f) && !E.hurt) { E.hurt = true; E.tHurt = G.t - E.t0; }
      }
    }
    G.world.free();
  }
  const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
  const pc = (x) => (100 * x).toFixed(1) + '%';
  for (const sub of [['all', eps], ['icp', eps.filter((e) => e.icp)], ['noicp', eps.filter((e) => !e.icp)]]) {
    const [nm, E] = sub; if (!E.length) continue;
    console.log(`ICP=${ICP} ${nm} n=${E.length} dur med ${med(E.map((e) => e.t1 - e.t0)).toFixed(2)}s · foe struck ${pc(E.filter((e) => e.foeStrike).length / E.length)} · clash ${pc(E.filter((e) => e.clash).length / E.length)} (t med ${med(E.filter((e) => e.clash).map((e) => e.tClash)).toFixed(2)}) · hurt ${pc(E.filter((e) => e.hurt).length / E.length)} (t med ${med(E.filter((e) => e.hurt).map((e) => e.tHurt)).toFixed(2)}) · minD med ${med(E.map((e) => e.minD)).toFixed(2)} · hand→slot at start med ${med(E.map((e) => e.hand0)).toFixed(2)} · foe phase at start: ${Object.entries(E.reduce((a, e) => ((a[e.foePh0] = (a[e.foePh0] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => k + ' ' + v).join(', ')}`);
  }

}

const args = process.argv.slice(2);
if (args[0] === 'time') timeDiag();
else defendDiag(args.includes('--icp=1') ? 1 : 0);
