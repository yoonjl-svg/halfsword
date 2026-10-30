// 모르트슐라크 '팔이 내 머리를 뚫음' 재기 (10/31 02:xx 사장님 '가까이서 보면 팔이 나의 머리를 뚫고 뒤로 갔다가 다시 적을 강타하는 것처럼 보여') — 읽기만 · 판 값 그대로
//  가만히 선 상대(AI 없음) 앞 가슴 거리 GAPS 에서 사람(롱소드 · 독일)이 비기를 곧장 낸다(창 · 조건 없이 skill.secret — tools/sim/mordschlag_probe.mjs 와 같은 꼴).
//  스텝마다 잰다 (몸 틀 = 길을 짠 yaw · 가슴 원점 — secret_instant.js comboPlanMord 와 같은 틀 · 앞 x · 위 y · 칼 든 쪽 z):
//   칼 든 손목 · 빈손 손목의 내 머리 가운데에서의 자리(앞 · 위 · 옆) · 내 머리 공(r 0.1) ↔ 팔 캡슐 네 개(위팔 · 아래팔 두 쪽) · 칼 축(폼멜 끝 ~ 칼끝) 겉 사이 틈(음수 = 뚫음)
//   'pull' 옮김 delta = 시작 자세(옮긴 뒤) − 옮기기 전 시작 자세(다시 세우기 끝 home) — 앞 · 위 · 옆 · 길이 (M.pullD 와 같은 것 · track 이면 스텝마다 바뀜)
//  실행: node tools/sim/mordschlag_selfclip.mjs [가슴 거리=0.5,0.6,0.7,0.8] · GUARDS=home,high,low(상대 손 자리) · TRACE=1(스텝마다 한 줄) · MORD_JSON='{"noSelfClip":1}'
//   FOE_DROP=0.1 = 상대 머리를 그만큼 낮춤(상대 골반을 낮게 — 무릎 굽힘 흉내: 상대 몸 전체를 아래로 옮겨 붙잡음 · 재기용)
import { newRound, DT, THREE } from './harness_m.mjs';
import { SECRET, SKILL } from '../../src/config.js';
import { TRADITIONS } from '../../src/schools.js';

const GAPS = (process.argv[2] || '0.5,0.6,0.7,0.8').split(',').map(Number);
const GUARDS = (process.env.GUARDS || 'home,high,low').split(',');
if (process.env.MORD_JSON) Object.assign(SECRET.mord, JSON.parse(process.env.MORD_JSON));
const TRACE = !!process.env.TRACE;
class Still {
  constructor(me) { this.me = me; }
  update() { this.me.move.set(0, 0); }
}
const PADS = { home: SKILL.homeGuard, high: [0.02, 0.45], low: [0.05, -0.35] };
const V = (p) => new THREE.Vector3(p.x, p.y, p.z);
const Q = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
// 점 P ↔ 선분 AB 거리
const segDist = (A, B, P) => { const ab = B.clone().sub(A); const t = Math.max(0, Math.min(1, P.clone().sub(A).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return A.clone().addScaledVector(ab, t).distanceTo(P); };
// 몸 캡슐 (몸 축 반 길이 · 반지름 — fighter.js partDefs): 칼 팔은 x 축(alongX) · 빈팔은 y 축
const CAPS = { uarmS: [0.105, 0.045, 'x'], farmS: [0.095, 0.04, 'x'], uarmO: [0.105, 0.045, 'y'], farmO: [0.095, 0.04, 'y'] };
const capSeg = (b, [h, , ax]) => { const q = Q(b.rotation()); const c = V(b.translation()); const a = new THREE.Vector3(ax === 'x' ? h : 0, ax === 'y' ? h : 0, 0).applyQuaternion(q); return [c.clone().sub(a), c.clone().add(a)]; };
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
const f3 = (v) => `${f2(v.x)},${f2(v.y)},${f2(v.z)}`;
const rows = [];
for (const gap of GAPS) for (const gd of GUARDS) {
  const G = newRound({ weapon: 'longsword', weapon2: process.env.FOE || 'longsword', seed: 7, gap, walls: false, AIClass: Still });
  const P = G.player, E = G.enemy;
  P.skill.corr = SKILL.corr; P.skill.corrTip = SKILL.corrTip; P.skill.autoGuard = true; P.canShove = true;
  const S = TRADITIONS.german.playerSecret;
  const hits = [];
  G.combat.hooks.onWound = (att, vic, r, pt, pr) => { if (att === P && P.skill.sec) hits.push(`${pr?.w?.part}>${r.zone}:${r.energy.toFixed(0)}J`); };
  G.before = () => {
    P.move.set(0, 0); P.stickX = P.stickY = 0;
    if (!fired) { P.handOffset.x = SKILL.homeGuard[0]; P.handOffset.y = SKILL.homeGuard[1]; }
    E.handOffset.x = PADS[gd][0]; E.handOffset.y = PADS[gd][1];
  };
  let fired = false, tFire = 0, row = null, plan = null;
  const headR = P.headR ?? 0.1;
  for (let i = 0; i < 6 / DT; i++) {
    G.step();
    if (!fired && G.t > 2.4) { fired = P.skill.secret({ S, ctx: { ev: 'press' } }); tFire = G.t; row = { gap, gd, fired, minArm: Infinity, minArmAt: null, minArmPart: null, minSword: Infinity, minSwordAt: null, behindS: Infinity, behindO: Infinity, behindElbow: Infinity, clipSteps: 0, clipT: 0, steps: 0, dMax: null, d0: null, hits }; }
    const I = P.iai;
    if (!fired || !I || I.kind !== 'combo' || !I.mord) { if (row && row.steps && !row.done) row.done = true; if (row?.done) break; continue; }
    row.steps++;
    const yi = I.yaw.clone().invert();
    const c = V(P.bodies.chest.translation());
    const hd = V(P.bodies.head.translation());
    const L = (w) => w.clone().sub(hd).applyQuaternion(yi); // 내 머리 가운데 기준 몸 틀
    // 손목 (아래팔 끝 0.13) · 빈손 (빈 아래팔 끝 −y 0.13)
    const wS = new THREE.Vector3(0.13, 0, 0).applyQuaternion(Q(P.bodies.farmS.rotation())).add(V(P.bodies.farmS.translation()));
    const wO = new THREE.Vector3(0, -0.13, 0).applyQuaternion(Q(P.bodies.farmO.rotation())).add(V(P.bodies.farmO.translation()));
    const elS = new THREE.Vector3(-0.135, 0, 0).applyQuaternion(Q(P.bodies.farmS.rotation())).add(V(P.bodies.farmS.translation()));
    // 팔 캡슐 ↔ 머리 공 틈
    let arm = Infinity, armPart = null;
    for (const [k, cap] of Object.entries(CAPS)) {
      const [A, B] = capSeg(P.bodies[k], cap);
      const g = segDist(A, B, hd) - headR - cap[1];
      if (g < arm) { arm = g; armPart = k; }
    }
    // 칼 축 (폼멜 끝 ~ 칼끝) ↔ 머리 공 틈 (칼 반두께 0.02)
    const sq = Q(P.sword.rotation()), sp = V(P.sword.translation());
    const W = P.weaponCfg;
    const pom = new THREE.Vector3(0, -0.15, 0).applyQuaternion(sq).add(sp), tip = new THREE.Vector3(0, W.hiltLength + W.bladeLength, 0).applyQuaternion(sq).add(sp);
    const sw = segDist(pom, tip, hd) - headR - 0.02;
    const gp = new THREE.Vector3(0, P.mordGrip ? P.mordGrip.g : 0, 0).applyQuaternion(sq).add(sp); // 칼 든 손이 쥔 자리
    const swH = segDist(pom, gp, hd) - headR - 0.02, swT = segDist(gp, tip, hd) - headR - 0.02; // 칼자루 쪽(손 → 폼멜 끝 — 치는 막대) · 칼끝 쪽(손 → 칼끝 — 내 쪽으로 남는 꼬리)
    // 옮김 delta (몸 틀): 시작 자세(옮긴 뒤 — segs[0].B) − home(다시 세우기 끝 — 옮기기 전 시작 자세)
    const s0 = I.segs[0]?.B, sh = I.segs.find((sg) => sg.B.back)?.B;
    const delta = s0 && sh && !I.mordBacked ? s0.H.clone().sub(sh.H) : null;
    if (delta && row.d0 == null) { row.d0 = delta.clone(); plan = { start: s0.H.clone(), home: sh.H.clone(), headC: hd.clone().sub(c).applyQuaternion(yi) }; }
    if (delta && (!row.dMax || delta.length() > row.dMax.length())) row.dMax = delta.clone();
    const t = G.t - tFire;
    const segI = I.si, cut = !!I.segs[I.si]?.cut, back = !!I.segs[I.si]?.B?.back;
    const ph = back ? 'back' : cut ? 'cut' : 'wind';
    const lS = L(wS), lO = L(wO), lE = L(elS);
    if (arm < row.minArm) { row.minArm = arm; row.minArmAt = { t: +t.toFixed(3), ph, part: armPart, wristS: f3(lS), wristO: f3(lO) }; }
    if (sw < row.minSword) { row.minSword = sw; row.minSwordAt = { t: +t.toFixed(3), ph }; }
    row.minHiltSide = Math.min(row.minHiltSide ?? Infinity, swH); row.minTipSide = Math.min(row.minTipSide ?? Infinity, swT);
    if (I.mord.clip && row.baseX == null) { const B = I.mord.clip.base, Hc = plan?.headC ?? hd.clone().sub(c).applyQuaternion(yi); row.baseX = B.map((b) => +(b.H.x - Hc.x).toFixed(2)).join('/'); }
    row.behindS = Math.min(row.behindS, lS.x); row.behindO = Math.min(row.behindO, lO.x); row.behindElbow = Math.min(row.behindElbow, lE.x);
    if (arm < 0) { row.clipSteps++; (row.clipPh ??= {})[ph] = (row.clipPh[ph] ?? 0) + 1; }
    if (TRACE) console.log(`t${t.toFixed(3)} ${ph.padEnd(4)} seg${segI} wristS(head) ${f3(lS)} wristO ${f3(lO)} elbowS ${f3(lE)} arm-head ${f2(arm)} ${armPart} sword-head ${f2(sw)} (hilt ${f2(swH)} tip ${f2(swT)}) delta ${delta ? f3(delta) + ' |' + f2(delta.length()) : '-'}`);
  }
  const R = P.instantResult ?? {};
  rows.push({ ...row, dt: DT, clipT: +(row.clipSteps * DT).toFixed(3), minArm: +row.minArm.toFixed(3), minSword: +row.minSword.toFixed(3), minHiltSide: +row.minHiltSide.toFixed(3), minTipSide: +row.minTipSide.toFixed(3), behindS: +row.behindS.toFixed(3), behindO: +row.behindO.toFixed(3), behindElbow: +row.behindElbow.toFixed(3),
    d0: row.d0 ? f3(row.d0) + ' |' + f2(row.d0.length()) : null, dMax: row.dMax ? f3(row.dMax) + ' |' + f2(row.dMax.length()) : null, plan: plan ? { start: f3(plan.start), home: f3(plan.home), myHead: f3(plan.headC) } : null,
    hit: !!R.hit, part: R.part ?? null, wPart: R.wPart ?? null, pullD: R.pullD != null ? +R.pullD.toFixed(3) : null, clip: R.clip ?? null, hits: hits.join(' ') });
  delete rows.at(-1).steps; delete rows.at(-1).done; delete rows.at(-1).clipSteps;
  console.log(JSON.stringify(rows.at(-1)));
  G.world.free?.();
}
const n = rows.length, clip = rows.filter((r) => r.minArm < 0).length;
console.log(`일격 ${n} · 팔이 머리를 뚫음(틈 < 0) ${clip} · 팔 ↔ 머리 틈 가장 작음 ${f2(Math.min(...rows.map((r) => r.minArm)))} m · 칼 손목이 머리 가운데 뒤로 가장 깊이 ${f2(Math.min(...rows.map((r) => r.behindS)))} m · 머리 맞힘 ${rows.filter((r) => r.part === 'head' || r.part === 'neck').length}`);
