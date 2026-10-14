// 와신상담 시험 (월왕구천검 에픽 특수 능력 — combat.js WOUND_RAGE · woundDegree · woundRageMult, docs/import/goujian_port_2026-10-14.md §5)
//  A0. 대본 베기(live_battery hit() 꼴): 같은 타격(같은 순간의 같은 접촉)을 칼 주인 상태만 바꿔 analyze 로 다시 셈 → 에너지 배율이 1 · 1.15 · 1.30 인가
//      (사람: 피로 d · 피 없는 몸: 상처 심각도만 · 팔다리 하나). 롱소드는 일곱 상태 모두 같은 값(===)이고 결과에 woundRage 칸이 없는가
//  A · B. AI 판: 월왕구천검 쪽 타격은 같은 배율 · 롱소드 쪽 타격은 칼 주인이 중상이어도 배율 1
//  C. 피 없는 몸 흉내(매 스텝 blood 1 · bleed 0 — 병마용처럼 피가 줄지 않는 몸)에 진짜 fighter.applyWound 로 상처 → d 가 오르는가
//  D. 실제 판 한 판(30 s): 피 없는 월왕구천검 쪽이 롱소드 AI 에게 맞는 동안 d·배율이 어떻게 오르나
//  analyze 는 읽기만 하므로 같은 순간에 여러 번 불러도 판이 안 바뀐다 (끝나면 칼 주인 상태를 되돌림). 실행: node tools/sim/wound_rage_check.mjs (실패가 있으면 종료 코드 1)
import { newRound, DT, AI, THREE, CONFIG } from './harness_m.mjs';
import { woundDegree, woundRageMult, WOUND_RAGE } from '../../src/combat.js';
const { VITALS } = CONFIG;
const f4 = (x) => (x == null ? null : +x.toFixed(4));
const sevSum = (f) => f.wounds.reduce((a, w) => a + w.severity, 0);
let fail = 0;
const check = (ok, msg) => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${msg}`); if (!ok) fail++; };

// 칼 주인 상태 바꿔 끼우기 (analyze 는 읽기만 하므로 같은 순간에 여러 번 불러도 판이 안 바뀐다 — 끝나면 되돌림)
const STATES = [
  { key: 'd0', note: '멀쩡 (d 0)', set: (f) => { f.blood = 1; f.wounds = []; for (const k in f.limbs) f.limbs[k] = 1; } },
  { key: 'h05', note: '사람 — 피 0.725 (d 0.5)', set: (f) => { f.blood = 1 - 0.5 * (1 - VITALS.collapseBlood); f.wounds = []; for (const k in f.limbs) f.limbs[k] = 1; } },
  { key: 'h1', note: '사람 — 피 0.45 (d 1)', set: (f) => { f.blood = VITALS.collapseBlood; f.wounds = []; for (const k in f.limbs) f.limbs[k] = 1; } },
  { key: 'c05', note: '피 없는 몸 — 피 1 · 상처 심각도 합 2 (d 0.5)', set: (f) => { f.blood = 1; f.wounds = [{ part: 'chest', type: 'cut', severity: 1.2, bleed: 0 }, { part: 'abdomen', type: 'stab', severity: 0.8, bleed: 0 }]; for (const k in f.limbs) f.limbs[k] = 1; } },
  { key: 'c1', note: '피 없는 몸 — 피 1 · 상처 심각도 합 4 (d 1)', set: (f) => { f.blood = 1; f.wounds = [{ part: 'chest', type: 'cut', severity: 2.5, bleed: 0 }, { part: 'pelvis', type: 'cut', severity: 1.5, bleed: 0 }]; for (const k in f.limbs) f.limbs[k] = 1; } },
  { key: 'c15', note: '피 없는 몸 — 피 1 · 상처 심각도 합 6 (d 1 에서 멈춤)', set: (f) => { f.blood = 1; f.wounds = [{ part: 'chest', type: 'cut', severity: 6, bleed: 0 }]; for (const k in f.limbs) f.limbs[k] = 1; } },
  { key: 'l05', note: '팔다리 — 빈팔 기능 0.5 (d 0.5)', set: (f) => { f.blood = 1; f.wounds = []; for (const k in f.limbs) f.limbs[k] = 1; f.limbs.armO = 0.5; } },
];
const want = { d0: 1, h05: 1.15, h1: 1.3, c05: 1.15, c1: 1.3, c15: 1.3, l05: 1.15 };

function probe(G, holder, maxHits, minJ = 15) {
  const orig = G.combat.analyze.bind(G.combat);
  const out = [];
  let lastT = -1;
  G.combat.analyze = (pr, point, S, P, predicting = false) => {
    if (!predicting && pr.w.fighter === holder && out.length < maxHits) {
      const f = holder;
      const save = { blood: f.blood, wounds: f.wounds, limbs: { ...f.limbs } };
      const row = { t: +G.t.toFixed(3), zone: null, states: {} };
      for (const s of STATES) {
        s.set(f);
        const r = orig(pr, point, S, P, false);
        row.zone = r.zone;
        row.states[s.key] = { type: r.type, eff: r.eff, energy: r.energy, rage: r.woundRage, d: woundDegree(f), mult: woundRageMult(f) };
      }
      f.blood = save.blood; f.wounds = save.wounds; Object.assign(f.limbs, save.limbs);
      const b = row.states.d0;
      const big = (b.eff ?? b.energy) >= minJ; // 뚜렷한 타격만 (같은 접촉이 여러 스텝 이어지는 잔 접촉은 뺀다)
      if (big && G.t - lastT > 0.15) { out.push(row); lastT = G.t; }
    }
    return orig(pr, point, S, P, predicting);
  };
  return out;
}

// 대본 베기 (live_battery hit() 와 같은 꼴): 상대는 가만히 · 상대 칼 충돌 끔 · 플레이어 손을 a → b 로 13 패드/s 로 긋는다
const CUTS = { oberhau: [[0.02, 0.52], [0.0, -0.45]], zornhau: [[0.42, 0.42], [-0.4, -0.42]], zwerch: [[0.52, 0.06], [-0.5, 0.06]] };
function settleAt(G, f, xy, secs = 1.5) {
  f.handOffset.set(xy[0], xy[1]); f.skill.prev.set(xy[0], xy[1]); f.skill.aim.set(xy[0], xy[1]); f.skill.aimRaw.set(xy[0], xy[1]);
  f.skill.aimVel.set(0, 0); f.skill.vel.set(0, 0); f.skill.follow.set(0, 0);
  for (let i = 0; i < secs / DT; i++) G.step();
}
function scripted(weapon, name, gap, sp = 13) {
  const [a, b] = CUTS[name];
  const G = newRound({ walls: false, gap, weapon, weapon2: 'longsword', seed: 1 });
  G.ai.update = () => {};
  G.player.skill.level = 0.7;
  const P = G.player, E = G.enemy;
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  E.handOffset.set(0.15, 0);
  settleAt(G, P, a, 1.5);
  const rows = probe(G, P, 1, 15);
  for (let i = 0; i < 0.8 / DT && !rows.length; i++) {
    const off = P.handOffset; const dx = b[0] - off.x, dy = b[1] - off.y, d = Math.hypot(dx, dy), st = sp * DT;
    if (d > st) { off.x += dx / d * st; off.y += dy / d * st; } else off.set(b[0], b[1]);
    G.step();
  }
  return rows[0] ? { ...rows[0], name, gap, weapon } : null;
}

// ── A0: 대본 베기 — 월왕구천검 · 롱소드 (같은 접촉을 칼 주인 상태만 바꿔 다시 셈) ──
{
  console.log(`# A0. 대본 베기 (sevRef ${WOUND_RAGE.sevRef} · 월왕구천검 woundRage 0.3)`);
  for (const [weapon, gaps] of [['goujian', [0.9, 1.0]], ['longsword', [1.2, 1.3]]]) {
    for (const gap of gaps) for (const name of Object.keys(CUTS)) {
      const row = scripted(weapon, name, gap);
      if (!row) { console.log(`  ${weapon} ${name}@${gap}: 닿지 않음`); continue; }
      const base = row.states.d0;
      const usesEff = base.eff != null;
      const cells = STATES.map((s) => {
        const st = row.states[s.key];
        return { key: s.key, d: f4(st.d), mult: st.mult, rage: st.rage, ratio: usesEff ? st.eff / base.eff : st.energy / base.energy, type: st.type, same: usesEff ? st.eff === base.eff : st.energy === base.energy };
      });
      console.log(`  ${weapon} ${name}@${gap} → ${row.zone}:${base.type} ${usesEff ? `eff(d0) ${base.eff.toFixed(1)} J` : `energy(d0) ${base.energy.toFixed(1)} J`} · ${cells.map((c) => `${c.key} d${c.d} ×${f4(c.ratio)}${c.type !== base.type ? `(${c.type})` : ''}`).join(' · ')}`);
      if (weapon === 'goujian') for (const c of cells) check(Math.abs(c.ratio - want[c.key]) < 1e-9 && Math.abs(c.mult - want[c.key]) < 1e-9 && Math.abs(c.rage - want[c.key]) < 1e-9, `A0 ${weapon} ${name}@${gap} ${c.key} ×${f4(c.ratio)} = ${want[c.key]}`);
      else check(cells.every((c) => c.same && c.rage === undefined && c.mult === 1), `A0 ${weapon} ${name}@${gap} 일곱 상태 모두 같은 값(===) · woundRage 칸 없음`);
    }
  }
}

// ── A · B: AI 판 — 같은 판에서 월왕구천검 쪽(P)과 롱소드 쪽(E)의 타격을 잡는다 ──
{
  const G = newRound({ walls: true, weapon: 'goujian', weapon2: 'longsword', seed: 3, AI2Class: AI });
  const rowsP = probe(G, G.player, 4, 1);
  // 같은 감싸개를 상대(롱소드)에도 — probe 를 두 번 감싸면 안쪽이 바깥을 부른다
  const rowsE = probe(G, G.enemy, 4);
  for (let i = 0; i < 40 / DT && (rowsP.length < 4 || rowsE.length < 4); i++) G.step();
  console.log(`# A. AI 판 월왕구천검 (P) 타격 ${rowsP.length} — 같은 접촉을 칼 주인 상태만 바꿔 다시 셈 (sevRef ${WOUND_RAGE.sevRef}, woundRage ${G.player.weapon.woundRage})`);
  for (const row of rowsP) {
    const base = row.states.d0;
    const usesEff = base.eff != null; // 처음 갈래가 베기·찌르기면 eff(문턱과 견주는 에너지), 둔기면 energy
    const cells = STATES.map((s) => {
      const st = row.states[s.key];
      const ratio = usesEff ? st.eff / base.eff : st.energy / base.energy;
      return { key: s.key, d: f4(st.d), mult: f4(st.mult), rage: f4(st.rage), ratio: f4(ratio), type: st.type };
    });
    console.log(`  t ${row.t} ${row.zone} ${usesEff ? `eff(d0) ${base.eff.toFixed(1)} J` : `energy(d0) ${base.energy.toFixed(1)} J`} · ${cells.map((c) => `${c.key} d${c.d} ×${c.ratio}${c.type !== base.type ? `(${c.type})` : ''}`).join(' · ')}`);
    for (const c of cells) check(Math.abs(c.ratio - want[c.key]) < 1e-9 && Math.abs(c.mult - want[c.key]) < 1e-9 && Math.abs(c.rage - want[c.key]) < 1e-9, `A t${row.t} ${c.key} 배율 ${c.ratio} = ${want[c.key]}`);
  }
  console.log(`# B. 롱소드 (E) 타격 ${rowsE.length} — 칼 주인이 중상이어도 배율 1 · woundRage 칸 없음`);
  for (const row of rowsE) {
    const base = row.states.d0;
    const usesEff = base.eff != null;
    const same = STATES.every((s) => {
      const st = row.states[s.key];
      return (usesEff ? st.eff === base.eff : st.energy === base.energy) && st.rage === undefined && st.mult === 1;
    });
    console.log(`  t ${row.t} ${row.zone} ${usesEff ? `eff ${base.eff.toFixed(1)}` : `energy ${base.energy.toFixed(1)}`} J · 일곱 상태 모두 같은 값(===) ${same} · d(h1) ${f4(row.states.h1.d)} · mult ${row.states.h1.mult}`);
    check(same, `B t${row.t} 롱소드 배율 1 · 바이트 같음`);
  }
}

// ── C: 피 없는 몸 흉내 + 진짜 applyWound (결정적) ──
{
  const G = newRound({ walls: true, weapon: 'goujian', weapon2: 'longsword', seed: 5 });
  const P = G.player;
  const bloodless = () => { P.blood = 1; P.bleed = 0; for (const w of P.wounds) w.bleed = 0; };
  G.before = bloodless;
  G.parkEnemy = false;
  for (let i = 0; i < 0.5 / DT; i++) G.step();
  const hits = [
    { part: 'chest', zone: 'chest', type: 'cut', severity: 0.6 },
    { part: 'farmO', zone: 'arm', type: 'cut', severity: 0.5 },
    { part: 'abdomen', zone: 'abdomen', type: 'stab', severity: 0.9 },
    { part: 'thighF', zone: 'leg', type: 'cut', severity: 0.4 },
    { part: 'chest', zone: 'chest', type: 'cut', severity: 1.3 },
    { part: 'pelvis', zone: 'pelvis', type: 'stab', severity: 0.8 },
  ];
  console.log('# C. 피 없는 몸 흉내 (매 스텝 blood 1 · bleed 0) + 진짜 fighter.applyWound — 상처마다 0.3 s 지나서 읽음');
  console.log(`  처음: blood ${P.blood} · Σsev 0 · d ${f4(woundDegree(P))} · ×${f4(woundRageMult(P))}`);
  let prevD = woundDegree(P);
  for (const h of hits) {
    P.applyWound({ ...h, energy: 60, local: new THREE.Vector3(0, 0, 0.05), dir: new THREE.Vector3(1, 0, 0), helmet: false, plate: false, bleedPerSev: (CONFIG.ANATOMY[h.zone] || CONFIG.ANATOMY.chest).bleed, pass: false, passing: false, finish: false });
    for (let i = 0; i < 0.3 / DT; i++) G.step();
    const d = woundDegree(P);
    const limbMax = Math.max(...Object.values(P.limbs).map((v) => 1 - v));
    console.log(`  ${h.part} ${h.type} 심각도 ${h.severity} → blood ${f4(P.blood)} · bleed ${f4(P.bleed)} · Σsev ${f4(sevSum(P))} (÷${WOUND_RAGE.sevRef} = ${f4(sevSum(P) / WOUND_RAGE.sevRef)}) · 가장 상한 팔다리 ${f4(limbMax)} · d ${f4(d)} · ×${f4(woundRageMult(P))} · ${P.state}`);
    check(P.blood === 1 && d >= prevD - 1e-12, `C ${h.part} 피 1 그대로 · d 줄지 않음 (${f4(prevD)} → ${f4(d)})`);
    prevD = d;
  }
  check(prevD > 0.9, `C 상처 여섯 뒤 d ${f4(prevD)} > 0.9 (피 없이)`);
  // 같은 상처를 사람(피 있음)에게: 출혈로 피가 줄어 피 몫도 오른다
  const G2 = newRound({ walls: true, weapon: 'goujian', weapon2: 'longsword', seed: 5 });
  const Q = G2.player;
  for (let i = 0; i < 0.5 / DT; i++) G2.step();
  for (const h of hits) {
    Q.applyWound({ ...h, energy: 60, local: new THREE.Vector3(0, 0, 0.05), dir: new THREE.Vector3(1, 0, 0), helmet: false, plate: false, bleedPerSev: (CONFIG.ANATOMY[h.zone] || CONFIG.ANATOMY.chest).bleed, pass: false, passing: false, finish: false });
    for (let i = 0; i < 0.3 / DT; i++) G2.step();
  }
  const dBlood = (1 - Q.blood) / (1 - VITALS.collapseBlood);
  console.log(`  같은 여섯 상처, 사람(피 있음) 1.8 s 뒤: blood ${f4(Q.blood)} (피 몫 ${f4(dBlood)}) · 정해진 잃은 피 ${f4(1 - Q.blood + Q.bleed / VITALS.clotting)} (피 몫 ${f4((1 - Q.blood + Q.bleed / VITALS.clotting) / (1 - VITALS.collapseBlood))}) · d ${f4(woundDegree(Q))} · ×${f4(woundRageMult(Q))} · ${Q.state}`);
}

// ── D: 실제 판 (30 s) — 피 없는 월왕구천검 쪽(P) 대 롱소드 AI ──
for (const seed of [1]) {
  const G = newRound({ walls: true, weapon: 'goujian', weapon2: 'longsword', seed, AI2Class: AI });
  const P = G.player;
  G.before = () => { P.blood = 1; P.bleed = 0; for (const w of P.wounds) w.bleed = 0; };
  const events = [];
  const pHits = [];
  G.onWound = (att, vic, r) => {
    if (vic === P && r.type !== 'blunt' && r.severity > 0) events.push({ t: +G.t.toFixed(2), zone: r.zone, sev: f4(r.severity) });
    if (att === P) pHits.push({ t: +G.t.toFixed(2), type: r.type, rage: f4(r.woundRage), sev: f4(r.severity), E: Math.round(r.energy) });
  };
  let lastN = 0;
  const log = [];
  for (let i = 0; i < 30 / DT; i++) {
    G.step();
    if (P.wounds.length !== lastN) { lastN = P.wounds.length; log.push(`t ${G.t.toFixed(2)} 상처 ${lastN} · blood ${P.blood.toFixed(3)} · Σsev ${sevSum(P).toFixed(3)} · d ${woundDegree(P).toFixed(3)} · ×${woundRageMult(P).toFixed(3)}`); }
  }
  console.log(`# D. 실제 판 seed ${seed} 30 s — 피 없는 월왕구천검(P) 대 롱소드 AI(E): 끝 ${P.state}/${G.enemy.state} · P 상처 ${P.wounds.length} · blood ${P.blood} · d ${f4(woundDegree(P))} · ×${f4(woundRageMult(P))}`);
  for (const l of log) console.log('  ' + l);
  console.log(`  P 가 낸 타격 ${pHits.length}: ${pHits.map((h) => `${h.t}s ${h.type} ×${h.rage}`).join(' · ')}`);
  if (P.wounds.length) check(P.blood === 1 && woundDegree(P) > 0, `D 피 없이 상처 ${P.wounds.length} → d ${f4(woundDegree(P))} > 0`);
  check(pHits.every((h) => h.rage >= 1 && h.rage <= 1.3 + 1e-12), 'D 월왕구천검 타격 배율 1~1.3 안');
}
console.log(fail ? `\n실패 ${fail}` : '\n모두 통과');
process.exit(fail ? 1 : 0);
