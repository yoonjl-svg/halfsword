// ─────────────────────────────────────────────────────────────
//  italian_thrust.mjs — 이탈리아 찌르기 재기 (10/25 08:0x 사장님 '이탈리아 찌르기 손봐' — docs/strike/italian_thrust_2026-10-25.md)
//   ai   : 이탈리아 무기 AI 대 상대 AI (둘 다 숙련도 PROF · 시험 쪽만 유파 패시브 켬 · 상대는 패시브 없음 — school_passive_duel.mjs 'on' 판과 같은 판 ·
//          자리 둘 × SEEDS · 시드 1000 + s · 2000 + s · DUR 초) — 승 / 패 / 무 · 준 · 받은 칼날 상처 · 기술마다:
//          고름(startAttack) · 찌름 시작(startStrike) · 들어가며 칼끝 닿음(준비 · 다가가는 동안 내 칼이 상대 몸에 닿은 공격) · 맞힘(찌르는 동안 첫 몸 접촉이 있는 공격) ·
//          찌른 상처(그 기술이 낸 찌르기 상처 > 0 수 · 심각도 합) · 머리 겨눔 몫(탭 tap.head) · 찌름 시작 때 가슴 사이 · 칼끝 → 겨눈 몸 거리 p50 · 찌르는 동안 칼끝이 나간 거리 p50
//   tap  : 사람 탭 찌르기 (멈춘 상대 — 칼 내린 상대 · 쟁기로 겨눈 상대 · 1.5 ~ 2.3 m 다섯 · tap_thrust.mjs standTrial 그대로) — 자세 1번(프리마) · 2번 · 3번 · 4번 · 긴 자세 패드 ·
//          찌름 판정 수 · 상처 수 · 첫 접촉
//  사용법: [SETS=GROUP.key=v,…] [SEEDS=12] [SEED0=1] [DUR=30] [PROF=4] [W=rapier] [FOES=longsword] [MODES=ai,tap] [TAPW=rapier,dartagnan] node tools/sim/italian_thrust.mjs
//   SETS 는 판마다 config 를 덮음 (예: SETS=THRUST.itApproach=0 = 10/25 아침 판)
// ─────────────────────────────────────────────────────────────
import { newRound, DT, AI, CONFIG, THREE } from './harness_m.mjs';
import { applyWeaponMeasure } from './weapon_measures.mjs';
import { standTrial } from './tap_thrust.mjs';
import { strokeTechOf } from '../../src/unique_assist.js';

for (const kv of (process.env.SETS || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split('=');
  const path = k.split('.');
  const o = path.slice(0, -1).reduce((a, p) => a[p], CONFIG);
  o[path[path.length - 1]] = isNaN(+v) ? v : +v;
}
const SP = CONFIG.SCHOOL_PASSIVE;
const N = +(process.env.SEEDS ?? 12), S0 = +(process.env.SEED0 ?? 1), DUR = +(process.env.DUR ?? 30), PROF = +(process.env.PROF ?? 4);
const W = process.env.W ?? 'rapier';
const FOES = (process.env.FOES ?? 'longsword').split(',');
const MODES = (process.env.MODES ?? 'ai,tap').split(',');
const TAPW = (process.env.TAPW ?? 'rapier,dartagnan').split(',');
const DIAG = process.env.DIAG ?? ''; // 기술 이름 — 그 기술의 찌름마다 첫 몸 접촉을 한 줄씩
// OLDPRIMA=1: 이탈리아 1번 자세 손을 10/25 전 자리 [0.5, 0.28, 0.12] 로 (10/24 판 · dbf2120 판 재현 — 확인표 2500)
if (process.env.OLDPRIMA === '1') {
  const { TRADITIONS } = await import('../../src/schools.js');
  TRADITIONS.italian.guardTable['지붕 (폼 타크)'].hand = [0.5, 0.28, 0.12];
}
const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
const pct = (a, q) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length * q)] : NaN);
const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');

/** 한 판: T = 이탈리아 무기 AI 몸 · O = 상대 */
function fight(foeW, seed, side) {
  SP.on = true;
  for (const k of Object.keys(SP)) if (SP[k] && typeof SP[k] === 'object' && 'on' in SP[k]) SP[k].on = k === 'italian';
  const G = newRound({ walls: true, seed, weapon: side === 0 ? W : foeW, weapon2: side === 0 ? foeW : W, AI2Class: AI, persona: { proficiency: PROF }, persona2: { proficiency: PROF } });
  applyWeaponMeasure(G.ai2, side === 0 ? W : foeW);
  applyWeaponMeasure(G.ai, side === 0 ? foeW : W);
  const T = side === 0 ? G.player : G.enemy, O = side === 0 ? G.enemy : G.player;
  const ai = side === 0 ? G.ai2 : G.ai;
  O.schoolPassive?.set(null);
  const atks = [];
  let cur = null;
  const sa = ai.startAttack.bind(ai);
  ai.startAttack = (tech, why, opt = {}) => {
    const ok = sa(tech, why, opt);
    if (ok && ai.mode === 'attack' && ai.tech) {
      cur = { name: ai.feint ? `${ai.feint.fake}>feint` : ai.tech.name, why, strike: false, touchApp: false, hit: false, stab: 0, sev: 0, wounds: [], tap: null };
      atks.push(cur);
    }
    return ok;
  };
  const ss = ai.startStrike.bind(ai);
  ai.startStrike = () => {
    ss();
    if (!cur) return;
    cur.strike = true;
    cur.tS = G.t;
    cur.d = T.foeDistance();
    const tp = T.skill.tap;
    cur.tap = tp ? { head: !!tp.head, ref: tp } : null;
    const tip = T.bladePoint(1, new THREE.Vector3());
    cur.tip0 = tip.clone();
    const tgt = V(O.bodies[tp?.head ? 'head' : 'chest'].translation());
    cur.tipGap = tip.distanceTo(tgt);
    cur.tipMax = 0;
  };
  const C = G.combat;
  const orig = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const r = orig(pr, point, passing);
    if (r && cur && pr.w.fighter === T && pr.v?.fighter === O && ai.mode === 'attack') {
      if (ai.phase === 'windup' || ai.phase === 'approach') cur.touchApp = true;
      else if (cur.strike) {
        if (!cur.hit) cur.first = { part: pr.v.part, type: r.type, e: r.energy, sev: r.severity, sp: r.speed, t: +(G.t - cur.tS).toFixed(2), d: T.foeDistance(), out: T.bladePoint(1, new THREE.Vector3()).distanceTo(cur.tip0) };
        cur.hit = true;
      }
    }
    return r;
  };
  const pw = C.hooks.onWound;
  let dealt = 0, taken = 0;
  C.hooks.onWound = (att, vic, r, ...rest) => {
    pw?.(att, vic, r, ...rest);
    if (r.type === 'blunt' || !(r.severity > 0)) return;
    if (att === T && vic === O) {
      dealt += r.severity;
      const tn = strokeTechOf(T);
      if (cur && tn && r.type === 'stab') ((cur.stab += 1), (cur.sev += r.severity), cur.wounds.push(r.zone));
    }
    if (att === O && vic === T) taken += r.severity;
  };
  let end = null;
  for (let i = 0; i < Math.round(DUR / DT); i++) {
    G.step();
    if (cur?.strike && ai.mode === 'attack' && cur.tip0) {
      cur.tipMax = Math.max(cur.tipMax, T.bladePoint(1, new THREE.Vector3()).distanceTo(cur.tip0));
      cur.dMin = Math.min(cur.dMin ?? Infinity, T.foeDistance());
    }
    if (ai.mode !== 'attack') cur = null;
    if (!T.alive || !O.alive) {
      end = +G.t.toFixed(1);
      break;
    }
  }
  const res = { foeW, seed, side, end, win: !O.alive && T.alive, lose: !T.alive && O.alive, both: !T.alive && !O.alive, dealt, taken, atks };
  G.world.free();
  return res;
}

if (MODES.includes('ai')) {
  for (const foeW of FOES) {
    const R = [];
    for (let s = S0; s < S0 + N; s++) for (const side of [0, 1]) R.push(fight(foeW, (side ? 2000 : 1000) + s, side));
    const n = R.length;
    console.log(`${W} 대 ${foeW} · 판 ${n} · 승 ${R.filter((r) => r.win).length} 패 ${R.filter((r) => r.lose).length} 둘다 ${R.filter((r) => r.both).length} 무 ${R.filter((r) => r.end == null).length} · 준 상처 ${(R.reduce((a, r) => a + r.dealt, 0) / n).toFixed(2)} 받은 ${(R.reduce((a, r) => a + r.taken, 0) / n).toFixed(2)} (판당 심각도)`);
    const by = new Map();
    for (const r of R) for (const a of r.atks) {
      let B = by.get(a.name);
      if (!B) by.set(a.name, (B = { pick: 0, strike: 0, touch: 0, hit: 0, stabA: 0, stab: 0, sev: 0, head: 0, d: [], gap: [], out: [], hold: [], dMin: [], zones: {} }));
      B.pick++;
      if (a.touchApp) B.touch++;
      if (!a.strike) continue;
      B.strike++;
      if (a.hit) B.hit++;
      if (a.stab) B.stabA++;
      B.stab += a.stab;
      B.sev += a.sev;
      if (a.tap?.head) B.head++;
      B.d.push(a.d);
      B.gap.push(a.tipGap);
      B.out.push(a.tipMax);
      if (Number.isFinite(a.dMin)) B.dMin.push(a.dMin);
      if (a.tap?.ref?.it) B.hold.push(a.tap.ref.it.hold);
      for (const z of a.wounds) B.zones[z] = (B.zones[z] ?? 0) + 1;
    }
    if (DIAG) for (const r of R) for (const a of r.atks) if (a.name === DIAG && a.strike) console.log(`    ${r.seed}/${r.side} d ${f2(a.d)} 칼끝→몸 ${f2(a.tipGap)} 머리 ${a.tap?.head ? 1 : 0} · 첫 ${a.first ? `${a.first.part}/${a.first.type} E ${a.first.e.toFixed(1)} sev ${a.first.sev.toFixed(2)} v ${a.first.sp?.toFixed(1)} t ${a.first.t} d ${f2(a.first.d)} 나감 ${f2(a.first.out)}` : '-'} · 상처 ${a.stab} ${a.wounds.join(',')} · 닿음(들어가며) ${a.touchApp ? 1 : 0}`);
    for (const [name, B] of [...by.entries()].sort((a, b) => b[1].pick - a[1].pick)) {
      if (!/stich|imbroccata|passata|inquartata|cavazione|feint/.test(name)) continue;
      console.log(`  ${name.padEnd(18)} 고름 ${String(B.pick).padStart(3)} · 찌름 시작 ${String(B.strike).padStart(3)} · 들어가며 칼끝 닿음 ${String(B.touch).padStart(3)} · 맞힘 ${String(B.hit).padStart(3)} · 찌른 상처 ${String(B.stab).padStart(3)} (공격 ${B.stabA}) 심각도 ${B.sev.toFixed(2)} · 머리 겨눔 ${B.head} · 시작 가슴 사이 p50 ${f2(med(B.d))} · 칼끝 → 몸 p50 ${f2(med(B.gap))} · 칼끝 나감 p50 ${f2(med(B.out))} · 가장 붙은 가슴 사이 p10 ${f2(pct(B.dMin, 0.1))} p50 ${f2(med(B.dMin))}${B.hold.length ? ` · 런지 뻗은 채 p50 ${f2(med(B.hold))} 최대 ${f2(Math.max(...B.hold))} s` : ''} · 곳 ${JSON.stringify(B.zones)}`);
    }
  }
}

if (MODES.includes('tap')) {
  const PADS = [
    ['1번(프리마)', [0.02, 0.52]],
    ['2번(세콘다)', [0.22, 0.26]],
    ['3번(테르차)', [0.18, -0.28]],
    ['4번(콰르타)', [-0.18, -0.28]],
    ['뻗은 3번', [0.0, 0.03]],
  ];
  const FOEP = [
    ['칼 내린 상대', [0.0, -0.5]],
    ['쟁기 상대', [0.18, -0.28]],
  ];
  for (const w of TAPW) for (const [fl, fp] of FOEP) {
    const parts = [];
    let tot = 0;
    for (const [gl, pad] of PADS) {
      let stab = 0, wound = 0, clash = 0;
      const first = [];
      for (const gap of [1.5, 1.7, 1.9, 2.1, 2.3]) {
        const r = standTrial({ gap, pad, foePad: fp, seed: 311 + Math.round(gap * 10), weapon: w });
        if (r.stab) stab++;
        if (r.wound) wound++;
        if (r.clashed) clash++;
        first.push(r.first ? `${r.first.part}/${r.first.type}` : '-');
      }
      tot += stab;
      parts.push(`${gl} 찌름 ${stab}/5 상처 ${wound} 칼 ${clash} [${first.join(' ')}]`);
    }
    console.log(`탭 ${w} → ${fl} · 합 ${tot}/25 · ${parts.join(' · ')}`);
  }
}
