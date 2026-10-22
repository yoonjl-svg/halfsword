// 드루이드의 채찍 측정 (10/23 — docs/import/druid_whip_2026-10-23.md). 물리를 바꾸지 않는다(측정만).
//  샛별 저장소 69ef7dac8 의 docs/design/druid_whip_release_20261022 repeat.mjs · verify.mjs 와 같은 측정에, 10/23 검수 잣대(쉬는 자세 · 끝에서 터짐)를 더해
//  샛별 값(`src` — druid_whip.js WHIP_SRC)과 지금 값(`now` — WHIP_NOW)을 나란히 잰다.
//   node tools/sim/druid_whip.mjs [repeat] [swing] [tap] [rest] [verify] [draw] [perf]   (안 적으면 다)
//  repeat: 샛별 표 그대로 — 손 목표를 1.6 s 마다 같은 길로 여덟 번, 2 ~ 8 번째 평균(앞 도달 · 몸통 높이 도달 · 접힘 · 제 몸 실제 접촉 · 끝 최대 빠르기).
//   before = 샛별 749a7b367 전(제 몸통 비트 되돌림 + 굽힘 .035 만 — 샛별 표의 '기존') · src · now. 판마다 시작을 0 · 0.1 · 0.2 s 늦춰 셋 평균(되풀이 휘두름은 시작 상태에 민감하다)
//  swing: 손가락 긋기 셋(가로 · 내려 · 사선) × 빠르기 둘(0.12 · 0.25 s) × 시작 셋 — 끝 최대 빠르기 · 손잡이 끝(덩굴 시작) 최대 빠르기와 그 비(채찍 꼴 '끝에서 터짐') ·
//   끝이 가장 빠른 때 덩굴이 펴진 몫(곧은 줄 = 1) · 그때 끝의 앞 거리 · 높이 · 접힘 시간 · 긋기 뒤 덩굴이 몸 뒤로 넘어간 시간 · 30 m/s 넘는 획(판정 버림 — combat.analyze) 몫 ·
//   선 상대(AI 멈춤 · 가슴 1.55 m)를 친 판정 수 · 가장 센 판정 J
//  tap: 톡 네 번(1.2 s 쉬고 톡 · 0.8 s 봄) — 끝 최대 빠르기 · 끝 앞 도달 최대, 선 상대(가슴 1.55 m)에 판정 수 · 가장 센 J (롱소드 · src · now)
//  rest: 쉬는 자세 6 s(처음 1 s 뺌) — 손잡이 흔들림(손잡이 축에 수직인 각속도 평균) · 끝 빠르기 평균 · 끝이 땅에 닿은 몫 · 끝 높이
//  verify: 정지 · 손 휘두르기 · AI · 양쪽 채찍 각 12 s — 마디 벌어짐 · 마디 빠르기 · 휨 · 유한 · 맞힘 수, 강한 충격 1000 번 + 직접 부러뜨리기 뒤 길이 · 질량
//  draw: 카드 첫 장에 채찍이 나올 확률(셈) · 편지 없음 / 편지 하나에서 drawWeaponCards 20 만 번
//  perf: AI 대 AI 6 s 의 스텝당 시간 — 롱소드 대 롱소드 · 채찍 대 롱소드(src · now)
import * as THREE from 'three';
import { newRound, DT, AI, CONFIG } from './harness_m.mjs';
import { WEAPONS, WEAPON_LIST, RETIRED_WEAPONS, TIER_DRAW, drawWeaponCards, weaponSpecText, getWeapon } from '../../src/weapons.js';
import { TECH_BY_NAME } from '../../src/ai_techniques.js';
import { traditionOf } from '../../src/schools.js';
import { letterMul } from '../../src/skill_tree_data.js';
import { setWhipPreset } from '../../src/druid_whip.js';

const want = process.argv.slice(2);
const on = (k) => !want.length || want.includes(k);
CONFIG.ARENA.startHold = 0;
class Quiet { update() {} }
const Yv = new THREE.Vector3(0, 1, 0);
const LEADS = [0, 0.1, 0.2];
const axisOf = (b) => Yv.clone().applyQuaternion(new THREE.Quaternion().copy(b.rotation()));
const local = (f, p) => p.clone().sub(new THREE.Vector3().copy(f.bodies.chest.translation())).applyQuaternion(f.yaw.clone().invert());
const selfTouch = (g, f) => {
  let touch = false;
  for (const s of f.flexWeapon.segments) g.world.contactPairsWith(s.col, (c) => {
    const info = f.colliderInfo.get(c.handle);
    if (info?.fighter === f && info.kind !== 'weapon') g.world.contactPair(s.col, c, (m) => { if (m.numSolverContacts() > 0) touch = true; });
  });
  return touch;
};
function oldBend(f) {
  // 749a7b367 전 굽힘: 관절마다 .035 × (1 − i/10) 만 (샛별 repeat.mjs 'before')
  const flex = f.flexWeapon;
  return () => {
    for (let i = 0; i < flex.segments.length; i++) {
      const child = flex.segments[i].body, parent = i ? flex.segments[i - 1].body : f.sword;
      const t = axisOf(child).cross(axisOf(parent)).multiplyScalar(0.035 * (1 - i / 10));
      child.addTorque(t, true); parent.addTorque({ x: -t.x, y: -t.y, z: -t.z }, true);
    }
  };
}
/** 손 목표 길 한 바퀴(C s): 0 ~ 0.3 감기(to → from) · 0.55 까지 쥠 · dur 동안 긋기(from → to) · 그 뒤 손가락 뗌 */
function drive(f, from, to, dur, C, lead) {
  return (t0) => {
    const t = t0 - lead;
    if (t < 0) { f.handHeld = false; f.inputActive = false; return; }
    const c = t % C;
    let p = null, act = false, held = true;
    if (c < 0.3) { const u = c / 0.3; p = [to[0] + u * (from[0] - to[0]), to[1] + u * (from[1] - to[1])]; act = true; }
    else if (c < 0.55) p = from;
    else if (c < 0.55 + dur) { const u = (c - 0.55) / dur; p = [from[0] + u * (to[0] - from[0]), from[1] + u * (to[1] - from[1])]; act = true; }
    else held = false;
    if (p) f.handOffset.set(...p);
    f.handHeld = held; f.inputActive = act;
  };
}
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

if (on('repeat')) {
  console.log('## 되풀이 휘두르기 (샛별 표 — 2 ~ 8 번째 평균, 시작 셋 평균)');
  console.log('| 판 | 길 | 앞 도달 m | 몸통 높이 도달 m | 접힘 s | 제 몸 접촉 s | 끝 최대 m/s |');
  console.log('|---|---|---|---|---|---|---|');
  const G = { cross: [[-0.6, 0.25], [0.6, 0.25]], down: [[0.1, 0.65], [0.1, -0.55]], diagonal: [[-0.5, 0.65], [0.5, -0.5]] };
  for (const mode of ['before', 'src', 'now']) for (const [gesture, [from, to]] of Object.entries(G)) {
    const acc = { reach: [], torso: [], fold: [], touch: [], speed: [] };
    for (const lead of LEADS) {
      setWhipPreset(mode === 'now' ? 'now' : 'src');
      const g = newRound({ weapon: 'druid_whip', weapon2: 'tree_branch', seed: 13, gap: 1.3, AIClass: Quiet });
      g.park();
      const f = g.player, flex = f.flexWeapon;
      if (mode === 'before') { for (const s of flex.segments) s.col.setCollisionGroups(s.col.collisionGroups() | 256); flex.step = oldBend(f); } // 256 = fighter.js torsoBit(0)
      // 샛별 repeat.mjs 와 같은 손 길 (감기 0.3 s · 쥠 · 0.32 s 긋기 — 손가락 떼기 없음: inputActive 만)
      g.before = (t0) => {
        const t = t0 - lead;
        if (t < 0) return;
        const c = t % 1.6;
        let p;
        if (c < 0.3) { const u = c / 0.3; p = [to[0] + u * (from[0] - to[0]), to[1] + u * (from[1] - to[1])]; }
        else if (c < 0.55) p = from;
        else { const u = Math.min(1, (c - 0.55) / 0.32); p = [from[0] + u * (to[0] - from[0]), from[1] + u * (to[1] - from[1])]; }
        f.handOffset.set(...p);
        f.inputActive = c < 0.3 || (c >= 0.55 && c < 0.87);
      };
      const S = Array.from({ length: 8 }, () => ({ reach: 0, torso: 0, fold: 0, touch: 0, speed: 0 }));
      for (let i = 0; i < (12.8 + lead) / DT; i++) {
        g.step();
        const t = g.t - DT - lead;
        if (t < 0) continue;
        const r = S[Math.min(7, Math.floor(t / 1.6))];
        if (t % 1.6 < 0.55) continue;
        const tip = f.bladePoint(1).clone(), rel = local(f, tip);
        if (tip.y > 0.45) r.reach = Math.max(r.reach, rel.x);
        if (tip.y > 0.85 && tip.y < 1.8) r.torso = Math.max(r.torso, rel.x);
        if (selfTouch(g, f)) r.touch += DT;
        if (tip.distanceTo(new THREE.Vector3().copy(f.sword.translation())) < 0.6) r.fold += DT;
        r.speed = Math.max(r.speed, f.tipVel.length());
      }
      for (const k in acc) acc[k].push(mean(S.slice(1).map((s) => s[k])));
      g.world.free();
    }
    console.log(`| ${mode} | ${gesture} | ${mean(acc.reach).toFixed(3)} | ${mean(acc.torso).toFixed(3)} | ${mean(acc.fold).toFixed(3)} | ${mean(acc.touch).toFixed(3)} | ${mean(acc.speed).toFixed(1)} |`);
  }
  setWhipPreset('now');
}

/** 손가락 긋기 한 판(6 획): 획마다 잰 값의 2 ~ 6 번째 평균 */
function swing(preset, gesture, dur, lead, target) {
  setWhipPreset(preset);
  const G = { cross: [[-0.55, 0.2], [0.55, 0.2]], down: [[0.1, 0.6], [0.1, -0.5]], diag: [[0.42, 0.42], [-0.4, -0.42]] };
  const [from, to] = G[gesture];
  const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', seed: 13, gap: target ? 1.55 : 1.3, AIClass: Quiet });
  if (!target) g.park();
  const f = g.player, flex = f.flexWeapon, C = 1.6, n = 6;
  g.before = drive(f, from, to, dur, C, lead);
  const S = Array.from({ length: n }, () => ({ tip: 0, root: 0, extPk: 0, pkFwd: 0, pkY: 0, fold: 0, behind: 0, hits: 0, J: 0 }));
  for (let i = 0; i < (n * C + lead) / DT; i++) {
    g.step();
    const t = g.t - DT - lead;
    if (t < 0) continue;
    const ph = t % C, r = S[Math.min(n - 1, Math.floor(t / C))];
    if (ph < 0.55 || ph > 0.55 + dur + 0.6) continue;
    const tip = f.bladePoint(1).clone(), root = f.bladePoint(0), cl = tip.distanceTo(root), rel = local(f, tip);
    const rv = flex.segments[0].body.linvel(), vt = f.tipVel.length();
    r.root = Math.max(r.root, Math.hypot(rv.x, rv.y, rv.z));
    if (vt > r.tip) Object.assign(r, { tip: vt, extPk: cl / 1.44, pkFwd: rel.x, pkY: tip.y });
    if (cl < 0.6) r.fold += DT;
    if (ph >= 0.55 + dur && rel.x < -0.05) r.behind += DT;
  }
  for (const w of g.wounds) if (w.att === f) { const r = S[Math.min(n - 1, Math.floor((w.t - lead) / C))]; if (r) { r.hits++; r.J = Math.max(r.J, w.energy); } }
  g.world.free();
  const out = {};
  for (const k of Object.keys(S[0])) out[k] = mean(S.slice(1).map((s) => s[k]));
  out.over30 = mean(S.slice(1).map((s) => (s.tip > 30 ? 1 : 0)));
  return out;
}

if (on('swing')) {
  console.log('\n## 손가락 긋기 (가로 · 내려 · 사선 × 0.12 · 0.25 s × 시작 셋 평균 — 2 ~ 6 번째 획)');
  console.log('| 판 | 끝 최대 m/s | 손잡이 끝 최대 m/s | 비 | 끝 최고 때 펴짐 | 그때 앞 m | 그때 높이 m | 접힘 s | 몸 뒤로 s | 30 m/s 넘음 | 선 상대 판정 수 / 획 | 가장 센 판정 J |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const preset of ['src', 'now']) {
    const A = [], T = [];
    for (const gs of ['cross', 'down', 'diag']) for (const d of [0.12, 0.25]) for (const lead of LEADS) { A.push(swing(preset, gs, d, lead, false)); if (lead === 0) T.push(swing(preset, gs, d, lead, true)); }
    const m = (k, L = A) => mean(L.map((x) => x[k]));
    console.log(`| ${preset} | ${m('tip').toFixed(1)} | ${m('root').toFixed(1)} | ${(m('tip') / m('root')).toFixed(2)} | ${m('extPk').toFixed(2)} | ${m('pkFwd').toFixed(2)} | ${m('pkY').toFixed(2)} | ${m('fold').toFixed(3)} | ${m('behind').toFixed(3)} | ${(100 * m('over30')).toFixed(0)} % | ${m('hits', T).toFixed(1)} | ${m('J', T).toFixed(0)} |`);
  }
  setWhipPreset('now');
}

if (on('tap')) {
  console.log('\n## 톡 (네 번)');
  console.log('| 무기 · 판 | 끝 최대 m/s | 끝 앞 도달 최대 m | 선 상대 판정 수 | 가장 센 J | 맞은 곳 |');
  console.log('|---|---|---|---|---|---|');
  for (const [w, preset] of [['longsword', 'now'], ['druid_whip', 'src'], ['druid_whip', 'now']]) {
    const row = {};
    for (const gap of [3.0, 1.55]) {
      setWhipPreset(preset);
      const g = newRound({ weapon: w, weapon2: 'longsword', seed: 13, gap, AIClass: Quiet });
      const f = g.player;
      let tip = 0, fwd = -9;
      for (let k = 0; k < 4; k++) {
        for (let i = 0; i < 1.2 / DT; i++) g.step();
        f.skill.thrust();
        for (let i = 0; i < 0.8 / DT; i++) {
          g.step();
          tip = Math.max(tip, f.tipVel.length());
          const t = f.bladePoint(1), c = f.bodies.chest.translation(), fw = f.forward();
          fwd = Math.max(fwd, (t.x - c.x) * fw.x + (t.z - c.z) * fw.z);
        }
      }
      const hits = g.wounds.filter((x) => x.att === f);
      if (gap > 2) Object.assign(row, { tip, fwd });
      else Object.assign(row, { n: hits.length, J: Math.max(0, ...hits.map((h) => h.energy)), zones: [...new Set(hits.map((h) => h.zone))].join(' · ') });
      g.world.free();
    }
    console.log(`| ${w}${w === 'druid_whip' ? ` (${preset})` : ''} | ${row.tip.toFixed(1)} | ${row.fwd.toFixed(2)} | ${row.n} | ${row.J.toFixed(0)} | ${row.zones || '-'} |`);
  }
  setWhipPreset('now');
}

if (on('rest')) {
  console.log('\n## 쉬는 자세 (6 s · 처음 1 s 뺌)');
  console.log('| 판 | 손잡이 흔들림 rad/s | 끝 빠르기 평균 m/s | 끝이 땅에 닿은 몫 | 가장 낮은 마디 m |');
  console.log('|---|---|---|---|---|');
  for (const preset of ['src', 'now']) {
    setWhipPreset(preset);
    const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', seed: 13, gap: 1.3, AIClass: Quiet });
    g.park();
    const f = g.player;
    let n = 0, wp = 0, tv = 0, gnd = 0, low = 9;
    for (let i = 0; i < 6 / DT; i++) {
      g.step();
      if (g.t < 1) continue;
      n++;
      const w = f.sword.angvel(), ax = axisOf(f.sword), wa = w.x * ax.x + w.y * ax.y + w.z * ax.z;
      wp += Math.sqrt(Math.max(0, w.x * w.x + w.y * w.y + w.z * w.z - wa * wa));
      tv += f.tipVel.length();
      const ys = f.flexWeapon.segments.map((s) => s.body.translation().y);
      low = Math.min(low, ...ys);
      if (Math.min(...ys) < 0.05) gnd++;
    }
    console.log(`| ${preset} | ${(wp / n).toFixed(1)} | ${(tv / n).toFixed(2)} | ${(gnd / n).toFixed(2)} | ${low.toFixed(2)} |`);
    g.world.free();
  }
  setWhipPreset('now');
}

if (on('verify')) {
  console.log('\n## 안정성 (12 s 씩)');
  console.log('| 판 | 상황 | 마디 벌어짐 최대 m | 마디 빠르기 최대 m/s | 곧은 끝과 거리 최대 m | 맞힘 (P→ · E→) | 칼끼리 | 유한 |');
  console.log('|---|---|---|---|---|---|---|---|');
  const w = WEAPONS.druid_whip;
  for (const preset of ['src', 'now']) for (const mode of ['rest', 'stroke', 'ai', 'both']) {
    setWhipPreset(preset);
    const g = newRound({ weapon: 'druid_whip', weapon2: mode === 'both' ? 'druid_whip' : 'tree_branch', gap: 1.35, seed: 11, AIClass: mode === 'rest' ? Quiet : AI, AI2Class: mode === 'ai' || mode === 'both' ? AI : Quiet });
    const f = g.player;
    let gap = 0, speed = 0, bend = 0, finite = true;
    g.before = (t) => {
      if (mode !== 'stroke') return;
      const tech = TECH_BY_NAME.zornhau, ph = t % 1.6, pts = [tech.from, ...tech.path];
      const u = Math.min(1, Math.max(0, (ph - 0.5) / 0.35)), i = u < 0.5 ? 0 : 1, v = u < 0.5 ? u * 2 : (u - 0.5) * 2;
      f.handOffset.set(pts[i][0] + (pts[i + 1][0] - pts[i][0]) * v, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * v);
      f.inputActive = ph >= 0.5 && ph < 0.9;
    };
    for (let i = 0; i < 12 / DT; i++) {
      g.step();
      const x = f.flexWeapon;
      for (let j = 0; j < x.active; j++) {
        const s = x.segments[j], p = s.body.translation(), v = s.body.linvel();
        if (![p.x, p.y, p.z, v.x, v.y, v.z].every(Number.isFinite)) finite = false;
        speed = Math.max(speed, Math.hypot(v.x, v.y, v.z));
        const a = new THREE.Vector3(0, -x.L / 2, 0).applyQuaternion(new THREE.Quaternion().copy(s.body.rotation())).add(new THREE.Vector3().copy(p));
        const prev = j ? x.segments[j - 1].body : f.sword;
        const b = new THREE.Vector3(0, j ? x.L / 2 : 0.13, 0).applyQuaternion(new THREE.Quaternion().copy(prev.rotation())).add(new THREE.Vector3().copy(prev.translation()));
        gap = Math.max(gap, a.distanceTo(b));
      }
      const straight = new THREE.Vector3(0, 0.13 + w.bladeLength, 0).applyQuaternion(new THREE.Quaternion().copy(f.sword.rotation())).add(new THREE.Vector3().copy(f.sword.translation()));
      bend = Math.max(bend, straight.distanceTo(f.bladePoint(1)));
    }
    f.syncMeshes();
    if (![...f.bladeMesh.geometry.attributes.position.array].every(Number.isFinite)) finite = false;
    const pHits = g.hits.filter((h) => h.startsWith('P->')).length, eHits = g.hits.length - pHits;
    console.log(`| ${preset} | ${mode} | ${gap.toFixed(4)} | ${speed.toFixed(1)} | ${bend.toFixed(2)} | ${pHits} · ${eHits} | ${g.clashes} | ${finite} |`);
    g.world.free();
  }
  setWhipPreset('now');
  const g = newRound({ weapon: 'druid_whip', weapon2: 'longsword', seed: 5, AIClass: Quiet });
  const f = g.player, m0 = f.stamina.originalMass;
  for (let i = 0; i < 1000; i++) f.absorbWeaponImpact(1000, { armed: true, weapon: { breakMult: 100 } });
  f.breakWeapon();
  console.log(`\n부서지지 않음: fragile=${f.weapon.fragile} · 부러짐=${f.weaponBroken} · 마디 ${f.flexWeapon.active} · 덩굴 ${f.weaponCfg.bladeLength} m · 기력 질량 ${m0.toFixed(3)} → ${f.stamina.originalMass.toFixed(3)} kg · 스펙 '${weaponSpecText(w)}'`);
  g.world.free();
}

if (on('draw')) {
  console.log('\n## 뽑기');
  // main.js PLAYER_WEAPON_POOL 과 같은 목록 (복제 엑스칼리버 · 빼 둔 무기 제외 · 인물 전용 제외는 drawWeaponCards 가)
  const pool = WEAPON_LIST.map((x) => x.id).filter((id) => id !== 'excalibur_replica' && !RETIRED_WEAPONS.has(id));
  const byTier = {};
  for (const id of pool) (byTier[getWeapon(id).tier] ||= new Set()).add(getWeapon(id).drawGroup || id);
  const tot = Object.keys(byTier).reduce((a, t) => a + (TIER_DRAW[t] ?? 0), 0);
  const nMys = byTier.mystery.size;
  console.log(`??? 칸: ${[...byTier.mystery].join(' · ')} (${nMys} 칸) · 등급 확률 합 ${tot}`);
  console.log(`첫 장이 채찍: ${TIER_DRAW.mystery} / ${tot} ÷ ${nMys} = ${(100 * TIER_DRAW.mystery / tot / nMys).toFixed(3)} %`);
  let seed = 12345;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const letters of [null, new Set(['german'])]) {
    const N = 200000;
    let first = 0, any = 0;
    for (let i = 0; i < N; i++) {
      const ids = drawWeaponCards(pool, 2, { rnd, ...(letters ? { weightOf: (id) => letterMul(traditionOf(getWeapon(id)), letters) } : {}) });
      if (ids[0] === 'druid_whip') first++;
      if (ids.includes('druid_whip')) any++;
    }
    console.log(`${letters ? '편지 하나(독일)' : '편지 없음'}: 첫 장 ${(100 * first / N).toFixed(2)} % · 두 장 중 하나 ${(100 * any / N).toFixed(2)} % (${N} 번)`);
  }
}

if (on('perf')) {
  console.log('\n## 스텝당 시간 (AI 대 AI 6 s · 세 번 중 가장 빠른 값)');
  for (const [a, b, preset] of [['longsword', 'longsword', 'now'], ['druid_whip', 'longsword', 'src'], ['druid_whip', 'longsword', 'now']]) {
    setWhipPreset(preset);
    let best = Infinity;
    for (let k = 0; k < 3; k++) {
      const g = newRound({ weapon: a, weapon2: b, seed: 3, AI2Class: AI });
      const t0 = process.hrtime.bigint();
      for (let i = 0; i < 6 / DT; i++) g.step();
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6 / (6 / DT));
      g.world.free();
    }
    console.log(`${a} 대 ${b}${a === 'druid_whip' ? ` (${preset})` : ''}: ${best.toFixed(3)} ms / 스텝`);
  }
  setWhipPreset('now');
}
