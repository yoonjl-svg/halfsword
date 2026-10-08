// 걸어 들어가며 친 타격이 더 센가 — 통제 실험: 가만히 선 상대에게 같은 대본 베기(corr_lib FAM)를 (a) 선 채 (b) 앞으로 걸어 들어가며 (c) 뒤로 물러나며 친다.
//  걷는 경우는 더 먼 거리에서 출발해 상대와의 거리가 (a) 와 같아지는 순간 획을 시작한다(접촉 기하 맞춤). 첫 상처의 에너지(판정 E, J)·접촉 상대 속도·유효 질량·심각도·관통.
//  실행: node tools/sim/step_strike.mjs [--weapon=longsword] [--fams=vert,diagR] [--dist=1.35] [--json]
import { newRound } from './harness_m.mjs';
import { DT, THREE } from './jelly_harness.mjs';
import { FAM } from './corr_lib.mjs';
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const weapon = String(args.weapon ?? 'longsword');
const fams = String(args.fams ?? 'vert,diagR').split(',');
const DIST = +(args.dist ?? 1.35);
const SHORT = +(args.short ?? 1); // --short=0.5 : 손가락 획을 시작점에서 끝점까지의 이 비율만 긋는다(짧은 세로 획 보상 실험, 10/8)
const CAP = args.cap != null ? +args.cap : null; // --cap=N : 이 무기의 손목 서보 상한 덮어쓰기(arm_arc_gauge 와 같음)
if (CAP != null) { const { getWeapon } = await import('../../src/weapons.js'); getWeapon(weapon).controlOverrides.maxAimTorque = CAP; }
class Passive { update() {} }
function placeEnemy(G, dist) { // 상대를 주인공 정면 dist 로 (몸 전체 평행이동, G.park 과 같은 식)
  const P = G.player, E = G.enemy; const pp = P.pelvisPos, ep = E.pelvisPos;
  const dx = pp.x + dist - ep.x; // 주인공은 x− 쪽에서 x+ 를 본다(harness_m: player x = −gap/2, heading 0)
  for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z }, true); }
  const a = E.anchor.translation(); E.anchor.setTranslation({ x: a.x + dx, y: a.y, z: a.z }, true);
}
const gap = (G) => G.enemy.pelvisPos.x - G.player.pelvisPos.x;
function runCase(fam, move) {
  const F = FAM[fam];
  const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed: 7, AIClass: Passive }); const P = G.player, E = G.enemy;
  P.skill.level = 0.7;
  const start = move > 0 ? DIST + 0.9 : move < 0 ? DIST - 0.5 : DIST; // 걸어 들어갈(물러날) 거리를 두고 출발
  placeEnemy(G, start);
  for (const c of E.swordColliders) c.setCollisionGroups(0); // 상대 칼은 치운다(상대는 가만히 선다)
  P.handOffset.set(F.ch[0], F.ch[1]);
  for (let i = 0; i < Math.round(1.5 / DT); i++) { P.move.set(0, 0); E.move.set(0, 0); G.step(); }
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => { if (att === P) hits.push({ type: r.type, zone: r.zone, E: +r.energy.toFixed(0), speed: +r.speed.toFixed(2), mEff: +r.mEff.toFixed(2), sev: +r.severity.toFixed(2), pass: r.pass, t: +G.t.toFixed(3) }); };
  // 걷기: 거리가 DIST 가 될 때까지 걷고(최대 4 s), 그 순간 획 시작 (걷는 채로)
  let walked = 0;
  if (move !== 0) { for (let i = 0; i < 4 / DT; i++) { P.move.set(0, move); E.move.set(0, 0); G.step(); walked++; if ((move > 0 && gap(G) <= DIST) || (move < 0 && gap(G) >= DIST)) break; } }
  const gapAtStart = gap(G); const vP = P.bodies.pelvis.linvel(); const bodyV = +vP.x.toFixed(2);
  const tgt = SHORT < 1 ? [F.ch[0] + SHORT * (F.end[0] - F.ch[0]), F.ch[1] + SHORT * (F.end[1] - F.ch[1])] : F.end; let tipMax = 0;
  const n = Math.round((Math.hypot(tgt[0] - F.ch[0], tgt[1] - F.ch[1]) / F.v + 0.8) / DT);
  for (let i = 0; i < n; i++) {
    const off = P.handOffset; const dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
    if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(tgt[0], tgt[1]);
    P.move.set(0, move); E.move.set(0, 0); G.step(); tipMax = Math.max(tipMax, P.tipVel.length());
  }
  const first = hits.find((h) => h.type !== 'blunt') ?? hits[0] ?? null;
  return { fam, move, gapAtStart: +gapAtStart.toFixed(2), bodyV, tipMax: +tipMax.toFixed(1), nHits: hits.length, first, all: hits };
}
function runCaseAt(fam, move, gStart) {
  const F = FAM[fam];
  const G = newRound({ walls: false, weapon, weapon2: 'longsword', seed: 7, AIClass: Passive }); const P = G.player, E = G.enemy;
  P.skill.level = 0.7; placeEnemy(G, gStart + 1.0);
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.handOffset.set(F.ch[0], F.ch[1]);
  for (let i = 0; i < Math.round(1.5 / DT); i++) { P.move.set(0, 0); E.move.set(0, 0); G.step(); }
  const hits = []; G.combat.hooks.onWound = (att, vic, r) => { if (att === P) hits.push({ type: r.type, zone: r.zone, E: +r.energy.toFixed(0), speed: +r.speed.toFixed(2), mEff: +r.mEff.toFixed(2), sev: +r.severity.toFixed(2), pass: r.pass, gap: +gap(G).toFixed(2) }); };
  for (let i = 0; i < 4 / DT; i++) { P.move.set(0, move); E.move.set(0, 0); G.step(); if (gap(G) <= gStart) break; }
  const gapAtStart = gap(G); const bodyV = +P.bodies.pelvis.linvel().x.toFixed(2);
  const tgt = SHORT < 1 ? [F.ch[0] + SHORT * (F.end[0] - F.ch[0]), F.ch[1] + SHORT * (F.end[1] - F.ch[1])] : F.end; let tipMax = 0;
  const n = Math.round((Math.hypot(tgt[0] - F.ch[0], tgt[1] - F.ch[1]) / F.v + 0.8) / DT);
  for (let i = 0; i < n; i++) {
    const off = P.handOffset; const dx = tgt[0] - off.x, dy = tgt[1] - off.y, d = Math.hypot(dx, dy), st = F.v * DT;
    if (d > st) { off.x += (dx / d) * st; off.y += (dy / d) * st; } else off.set(tgt[0], tgt[1]);
    P.move.set(0, move); E.move.set(0, 0); G.step(); tipMax = Math.max(tipMax, P.tipVel.length());
  }
  const first = hits.find((h) => h.type !== 'blunt') ?? hits[0] ?? null;
  return { fam, move, gapAtStart: +gapAtStart.toFixed(2), bodyV, tipMax: +tipMax.toFixed(1), nHits: hits.length, first, all: hits };
}
const rows = [];
if (args.sweep) {
  // 걸어 들어가는 경우는 접촉 기하가 바뀌므로, 획 시작 거리를 훑어 선 채와 같은 자리(머리·목·가슴 베기)가 나오는 줄을 찾는다: --sweep=1.5:2.6:0.1 --move=1|0.5
  const [a, b, st] = String(args.sweep).split(':').map(Number); const mv = +(args.move ?? 1);
  for (const fam of fams) { rows.push(runCase(fam, 0)); for (let g = a; g <= b + 1e-9; g += st) rows.push(runCaseAt(fam, mv, +g.toFixed(2))); }
} else for (const fam of fams) for (const move of [0, 1, -1]) rows.push(runCase(fam, move));
console.log(`무기 ${weapon} · 접촉 거리 ${DIST} m · 상대 가만히(칼 치움)`);
console.log('무리\t걸음\t획 시작 거리(접촉 거리)\t몸 속도 m/s\t칼끝 최고\t첫 상처(부위/종류)\tE J\t상대속도\tmEff\t심각도\t관통');
for (const r of rows) console.log(`${r.fam}\t${r.move > 0 ? '앞으로 ' + r.move : r.move < 0 ? '뒤로' : '선 채'}\t${r.gapAtStart}${r.first?.gap != null ? ' (' + r.first.gap + ')' : ''}\t${r.bodyV}\t${r.tipMax}\t${r.first ? r.first.zone + '/' + r.first.type : '없음(' + r.nHits + ')'}\t${r.first?.E ?? ''}\t${r.first?.speed ?? ''}\t${r.first?.mEff ?? ''}\t${r.first?.sev ?? ''}\t${r.first?.pass ?? ''}`);
if (args.json) console.log(JSON.stringify(rows));
