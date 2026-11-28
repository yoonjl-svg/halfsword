// r35 진단 — AI 길 찌르기(탭 · 장검 찌르기 기술)의 칼끝 가장 빠름이 무엇에서 오나 (재기만 — 몸에 아무것도 걸지 않음 · 원래 함수를 감싸 값을 적을 뿐)
//  node ai_tip_trace.mjs --root=<나무> --out=<폴더> [--seeds=4001-4020] [--w=rapier,longsword] [--secs=30] [--hon=1] [--exp=none]
//   싸움 = tools/sim/wb_gate.mjs 의 AI 길과 같은 판(H.newRound walls · seed · 같은 무기 둘 · AI2Class) · 같은 사건 찾기(det) · 같은 획 셈(M.strokeWB) → 관문 줄의 tipPk · hit 를 다시 내는지 먼저 본다.
//   획마다 (t0 − 0.3 s ~ 창 끝 + 0.1 s) 스텝마다 적음:
//    칼끝 빠르기 · 칼 축 쪽 몫 · 옆 몫 · 가름 (정확한 합: v_tip = v_골반 + ω_가슴×(칼끝 − 가슴) [몸통 돌림] + (v_손 − v_골반 − ω_가슴×(손 − 가슴)) [팔] + (ω_칼 − ω_가슴)×(칼끝 − 손) [칼이 손 둘레로 · 가슴에 대해])
//     — 몫 = 그 벡터를 칼끝 빠르기 방향에 내린 값 ÷ 칼끝 빠르기 (넷의 합 = 1)
//    명령 손 자리(fighter.handTarget · 세계 · 몸 yaw 틀)와 명령 칼 방향(fighter.aimDirW)이 한 스텝에 움직인 크기 · thrustPose.dir 의 한 스텝 각 · 몸 yaw(heading) 한 스텝 각
//    명령 위팔 돌림 · 팔꿈치 극 축 sin (r28 trace_whip 과 같은 정의) · 찌르기 단계(tap.t) · AI 입력(move · skill.aim · mode · phase · 기술) · 휘두름 · 걸음
//    손목(sword) · 팔꿈치(farmS) · 어깨(uarmS) 전달 토크 ÷ 한도 (honesty.mjs attach · hook 그대로 — 장부의 mHist 에 이 스텝 값이 더해졌으면 그 값 · 아니면 null)
//   맞음 = 관문과 같은 onWound 스텝 · 그 상처의 갈래 · 에너지 · 닿는 빠르기(speed) · 관통 셈(eff) 대 문턱(thr) · 부위.
//  --exp (실험 전용 — 고침 아님 · 게임 코드는 그대로 · 이 대본 안에서 AI 가 몸에 주는 입력만 바꿈):
//    still  = 탭(찌르기 동작)이 도는 동안 그 몸의 걸음 입력 move 를 0 으로 (G.before = AI 갱신 뒤 · 몸 스텝 앞)
//    noturn = 탭이 도는 동안 몸이 바라보는 점(faceTarget)을 탭 처음 그 자리로 굳힘 → 몸 돌림 입력 없앰 (AI 반응 지연 버퍼에도 같은 점이 들어감)
//    aimfix = 탭이 도는 동안 찌르기 목표점(skill.thrustTarget)을 탭 처음의 세계 점으로 굳힘 (상대를 따라가지 않음)
//    calm   = AI 가 탭을 부를 때 칼끝이 2 m/s 넘게 움직이면 그 탭을 부르지 않음 (탭 앞 동작에서 곧장 찌르지 않게 — 사건 수가 바뀜)
//    aimslow = 탭의 당김 시간(K.aim)을 두 배로 (명령 칼 방향이 도는 빠르기를 반으로) · extslow = 뻗는 시간(K.extend)을 두 배로
//    여럿은 쉼표로.
//  --human=1 : 사람 길 관문 가까운 장면(wb_gate.mjs 의 nearGap 난수 차례 · wb_measure.mjs runThrust 를 옮겨 적은 장면 — 서 있는 과녁 · 탭 한 번)을 같은 기록으로.
//    --pad=x,y (실험 전용) = 탭 앞 손 패드를 그 자리로 (관문은 세 패드 가운데 난수) · --pre=still|walk|turn (실험 전용 · 탭 앞 0.4 s 에 사람 입력으로 걷기 앞 0.45 · 옆으로 돎)
import { pathToFileURL } from 'node:url'; import { join, resolve } from 'node:path'; import { writeFileSync, mkdirSync } from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = resolve(String(args.root ?? '.'));
const imp = (p) => import(pathToFileURL(join(ROOT, p)).href);
const H = await imp('tools/sim/harness_m.mjs');
const { makeMeasure, seedList, rng: rng0 } = await imp('tools/sim/wb_measure.mjs');
const { attach, hook } = await imp('tools/sim/honesty.mjs');
const { Fighter } = await imp('src/fighter.js');
const { Skill } = await imp('src/skill.js');
const { THRUST } = await imp('src/config.js');
const THREE = H.THREE; const M = makeMeasure(H); const DT = M.DT;
const OUT = String(args.out ?? '.'); mkdirSync(OUT, { recursive: true });
const seeds = seedList(args.seeds ?? '4001-4020'); const WS = String(args.w ?? 'rapier,longsword').split(','); const secs = +(args.secs ?? 30);
const HON = String(args.hon ?? '1') !== '0'; const EXP = new Set(String(args.exp ?? 'none').split(','));
const BODY = { front: 0.11, reach: { rapier: 1.791, longsword: 1.701 }, reach90: { rapier: 1.837, longsword: 1.878 } }; // wb_gate.mjs BODY 와 같음
const AI_FAR = (w) => BODY.reach90[w] + BODY.front + 0.10, AI_NEAR = (w) => BODY.reach[w] + BODY.front, CLOSE_MAX = 0.10;
const HD = Math.PI / 180, V = (o) => new THREE.Vector3(o.x, o.y, o.z), Q = (o) => new THREE.Quaternion(o.x, o.y, o.z, o.w);
const PRE = Math.round(0.3 / DT), POST = Math.round(0.1 / DT);

// ── 명령 위팔 돌림 · 극 축 sin (r28 trace_whip.mjs 와 같은 식) ──
function twistOf(u, zU, down, side) { if (u.dot(down) <= Math.cos(120 * HD)) return null; const r = new THREE.Vector3(0, 0, side).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(down, u)); return side * Math.atan2(new THREE.Vector3().crossVectors(r, zU).dot(u), r.dot(zU)); }
const oIK = Fighter.prototype.armIK;
Fighter.prototype.armIK = function (target, alignDir = null) {
  const r = oIK.call(this, target, alignDir);
  if (this._ikMain && this.__rec) { const qt = this.jointByName.uarmS.target; const u = new THREE.Vector3(1, 0, 0).applyQuaternion(qt), z = new THREE.Vector3(0, 0, 1).applyQuaternion(qt);
    const tw = twistOf(u, z, new THREE.Vector3(0, -1, 0), this.side); this.__rec.twC = tw == null ? null : tw / HD;
    const c = this.bodies.chest.translation(); const T = V(target).sub(V(c)).applyQuaternion(Q(this.bodies.chest.rotation()).invert());
    const S = new THREE.Vector3(0, 0.1, this.side * 0.2), Dn = T.clone().sub(S).normalize(); const pole = new THREE.Vector3(-0.25, -1, this.side * 0.5).normalize();
    this.__rec.poleSin = pole.clone().addScaledVector(Dn, -pole.dot(Dn)).length(); }
  return r; };
// 실험 전용 aimslow · extslow: 탭이 시작된 뒤 그 탭의 시간 값만 바꿈
if (EXP.has('aimslow') || EXP.has('extslow')) { const oTh = Skill.prototype.thrust; Skill.prototype.thrust = function (opt) { const had = this.tap; const r = oTh.call(this, opt); const tp = this.tap; if (r && tp && tp !== had && !tp.down) { tp.K = { ...tp.K }; if (EXP.has('aimslow')) tp.K.aim *= 2; if (EXP.has('extslow')) tp.K.extend *= 2; } return r; }; }
// 실험 전용 aimfix: 찌르기 목표점을 탭 처음 세계 점으로 (켤 때만 감쌈)
if (EXP.has('aimfix')) { const oTT = Skill.prototype.thrustTarget; const _yi = new THREE.Quaternion();
  Skill.prototype.thrustTarget = function (out) { const tp = this.tap; const r = oTT.call(this, out); if (!tp || tp.down || !this.f.__exp) return r;
    const c = V(this.f.bodies.chest.translation()); _yi.copy(this.f.yaw).invert();
    if (!tp.__fixW) tp.__fixW = r.clone().applyQuaternion(this.f.yaw).add(c);
    return out.copy(tp.__fixW).sub(c).applyQuaternion(_yi); }; }

// ── 관문 det (wb_gate.mjs runSeed 안의 det 그대로) ──
function makeDet(w, ais) {
  const DESC = new Set(['zornhau', 'zornhauL', 'oberhau']), HOR = new Set(['zwerch', 'zwerchL', 'zwerchAbtritt']);
  return (f, i, prev, st) => {
    const th = f.skill?.thrusts ?? 0, newTap = th > (st.th ?? th); st.th = th; const swOn = !!f.skill?.swinging && !st.prevSw; st.prevSw = !!f.skill?.swinging;
    const tech = ais.get(f)?.tech; const tn = tech?.name;
    const busy = !!f.skill?.tap || !!f.skill?.swinging, busyOn = busy && !st.prevBusy; st.prevBusy = busy; const other = busyOn && (tech == null || tech !== st.evTech) ? { o: i, kind: 'other' } : null;
    if (w === 'rapier') { if (newTap && !f.skill.tap?.down && f.state === 'stand') { st.evTech = tech; return { o: i, kind: 'thrust', tech: 'tap' }; } return other; }
    if (tech !== st.lastTech) { st.lastTech = tech; st.armed = M.STICH.has(tn) || DESC.has(tn) || HOR.has(tn) ? tn : null; }
    let ev = null; if (st.armed && swOn && f.state === 'stand') { ev = { o: i, kind: M.STICH.has(st.armed) ? 'thrust' : 'cut', tech: st.armed, desc: DESC.has(st.armed) }; st.armed = null; st.evTech = tech; }
    return ev ?? other;
  };
}

const K = { aim: THRUST.aim, extend: THRUST.extend, hold: THRUST.hold };
function phaseOf(tp, prevT) { if (!tp) return '-'; if (tp.down) return 'down'; const t = tp.t, k = tp.K ?? K; if (tp.abort) return '거둠';
  if (t <= k.aim + 1e-9) return prevT != null && Math.abs(t - prevT) < 1e-9 && t > 0 ? '머묾발' : '당김'; if (t < k.aim + k.extend) return '뻗음'; if (t < k.aim + k.extend + k.hold) return '머묾'; return '되돌림'; }

// ── 스텝 기록 (몸 하나 · G.step 뒤) ──
function capture(f, ai, st, LJ) {
  const B = f.bodies; const sw = f.sword; if (!sw) return null;
  const tipP = f.bladePoint(1, new THREE.Vector3()); const vt = V(sw.velocityAtPoint(tipP)); const sp = vt.length();
  const ax = new THREE.Vector3(0, 1, 0).applyQuaternion(Q(sw.rotation())); const vax = vt.dot(ax); const vlat = Math.sqrt(Math.max(0, sp * sp - vax * vax));
  const hp = H.handPos(f); const vh = V(B.farmS.velocityAtPoint(hp)); const c = V(B.chest.translation()); const wc = V(B.chest.angvel()), ws = V(sw.angvel()); const vp = V(B.pelvis.linvel());
  const pTrunk = new THREE.Vector3().crossVectors(wc, tipP.clone().sub(c));
  const pArm = vh.clone().sub(vp).sub(new THREE.Vector3().crossVectors(wc, hp.clone().sub(c)));
  const pRot = new THREE.Vector3().crossVectors(ws.clone().sub(wc), tipP.clone().sub(hp));
  const u = sp > 1e-6 ? vt.clone().divideScalar(sp) : new THREE.Vector3(); const sh = (x) => (sp > 1e-6 ? x.dot(u) / sp : 0);
  const yawI = f.yaw.clone().invert(); const hT = f.handTarget.clone(); const hTb = hT.clone().sub(c).applyQuaternion(yawI); const aW = f.aimDirW.clone().normalize();
  const tp = f.skill?.tap; const th = f.skill?.thrustPose;
  const angD = (a, b) => (a && b ? Math.acos(Math.max(-1, Math.min(1, a.dot(b) / Math.max(1e-9, a.length() * b.length())))) / HD : null);
  const ph = phaseOf(tp, st.prevTapT); st.prevTapT = tp ? tp.t : null;
  const thDir = th ? new THREE.Vector3(...th.dir) : null;
  const tq = {}; for (const [k, nm] of [['wr', 'sword'], ['el', 'farmS'], ['sh', 'uarmS']]) { const J = LJ?.joint?.[nm]; const n = J?.mHist?.length ?? 0; tq[k] = J && n > (st['n' + k] ?? 0) ? J.mHist[n - 1] / J.limit : null; st['n' + k] = n; }
  const r = {
    sp, vax, vlat, sPel: sh(vp), sTrk: sh(pTrunk), sArm: sh(pArm), sRot: sh(pRot), mPel: vp.length(), mTrk: pTrunk.length(), mArm: pArm.length(), mRot: pRot.length(), hand: vh.length(),
    dHandW: st.hT ? hT.distanceTo(st.hT) : null, dHandB: st.hTb ? hTb.distanceTo(st.hTb) : null, dAim: angD(st.aW, aW), dThDir: tp && st.thDir ? angD(st.thDir, thDir) : null, dYaw: st.head != null ? Math.abs(Math.atan2(Math.sin(f.heading - st.head), Math.cos(f.heading - st.head))) / HD : null,
    aimSword: angD(aW, ax), twC: f.__rec.twC ?? null, poleSin: f.__rec.poleSin ?? null,
    tap: !!tp, ph, tt: tp ? tp.t : null, w: th?.w ?? 0, vital: !!tp?.vital, head: !!tp?.head, chFit: tp?.chFit ?? null,
    mvx: f.move.x, mvy: f.move.y, aimx: f.skill.aim?.x ?? null, aimy: f.skill.aim?.y ?? null, mode: ai?.mode ?? null, aph: ai?.phase ?? null, tech: ai?.tech?.name ?? null, swing: !!f.skill?.swinging, walk: !!f.gait?.walking, req: f.gait?.req?.kind ?? null, st: f.state,
    tqWr: tq.wr, tqEl: tq.el, tqSh: tq.sh,
  };
  st.hT = hT; st.hTb = hTb; st.aW = aW; st.thDir = thDir; st.head = f.heading; f.__rec = {};
  return r;
}

const strokes = [];
if (args.human) { const { rng } = await imp('tools/sim/wb_measure.mjs');
  const PADX = args.pad ? String(args.pad).split(',').map(Number) : null;
  for (const s of seeds) { const R = rng(s * 7 + 1); for (const w of ['rapier', 'longsword']) { for (let k = 0; k < 3; k++) R(); const gn = BODY.reach[w] + BODY.front - (0.05 + 0.30 * R()); if (!WS.includes(w)) continue;
    const res = humanThrust(s, w, { gap: gn, pelvisGap: gn, post: 3.2, pad: PADX, pre: args.pre ? String(args.pre) : null }); if (!res) continue;
    const { line, o, hits, xs, WO } = res; const r = M.strokeWB(line, o, hits, 'thrust');
    const t0 = o + Math.round(r.t0rel / 1000 / DT); const end = t0 + Math.round(r.tEnd / DT); const iT = t0 + Math.round(r.tTip / DT); const hitI = r.hit ? t0 + Math.round(r.tHit / DT) : null;
    const a = Math.max(0, t0 - PRE), b = Math.min(xs.length - 1, end + POST);
    strokes.push({ seed: s, weapon: w, who: 'H', scene: 'near', tech: 'tap', o, t0, end, iT, hitI, nextO: null, path: 'human', ...r, wound: hitI != null ? WO.find((x) => x.i === hitI) ?? null : null, a, steps: xs.slice(a, b + 1) }); } }
  const tag = String(args.tag ?? 'human'); writeFileSync(join(OUT, `trace_${tag}.json`), JSON.stringify({ args, strokes })); console.log(`획 ${strokes.length} → trace_${tag}.json`); process.exit(0); }
// wb_measure.mjs runThrust 를 옮겨 적음 (같은 차례 · 같은 난수) + 스텝 기록 · 실험 전용 pad · pre
function humanThrust(seed, weapon, opt) {
  const R = rng0(seed); const PADS = [[0.18, -0.28], [0.22, 0.26], [0.0, 0.03]]; let pad = PADS[Math.floor(R() * 3)].map((v) => v + (R() - 0.5) * 0.06); R(); if (opt.pad) pad = opt.pad.slice(); const gap = opt.gap;
  const G = H.newRound({ walls: false, gap, seed, weapon, weapon2: 'longsword' }); G.ai.update = () => {}; const P = G.player, E = G.enemy;
  for (const c of E.swordColliders) c.setCollisionGroups(0);
  P.skill.level = 0.7; P.skill.autoGuard = true; M.setHand(P, [0.18, -0.28]); M.setHand(E, [0, -0.5]);
  let LP = null; if (HON) { LP = attach(G.world, bodiesOf(P), { fighter: P }); hook(G, [LP]); }
  P.__rec = {}; const CSt = {}; const line = [], xs = [], WO = []; const hits = M.hookHits(G, P, E, () => line.length);
  const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (A === P && Vc === E) WO.push({ i: line.length, type: r.type, zone: r.zone, E: r.physE ?? r.energy, energy: r.energy, sp: r.speed, eff: r.eff, thr: r.thr, mEff: r.mEff }); };
  const rec = () => { const smp = M.sample(P); if (smp) { line.push(smp); xs.push(capture(P, null, CSt, LP)); } return smp; };
  for (let i = 0; i < Math.round(1.2 / DT); i++) { const off = P.handOffset; const dx = pad[0] - off.x, dy = pad[1] - off.y, d = Math.hypot(dx, dy); if (d > DT) { off.x += (dx / d) * DT; off.y += (dy / d) * DT; } else off.set(pad[0], pad[1]); P.move.set(0, 0); G.step(); rec(); }
  const placeE = () => { const pp = P.bodies.pelvis.translation(), ep = E.bodies.pelvis.translation(); const d = Math.hypot(ep.x - pp.x, ep.z - pp.z), k = (opt.pelvisGap - d) / d, dx = (ep.x - pp.x) * k, dz = (ep.z - pp.z) * k; for (const { rb } of E.meshes) { const t = rb.translation(); rb.setTranslation({ x: t.x + dx, y: t.y, z: t.z + dz }, true); } };
  const nQ = Math.round(0.8 / DT), nPre = Math.round(0.4 / DT);
  for (let i = 0; i < nQ; i++) { if (i === 0 || i === Math.round(0.4 / DT)) placeE();
    const late = opt.pre && i >= nQ - nPre; P.move.set(late && opt.pre === 'walk' ? 0 : 0, late && opt.pre === 'walk' ? 0.45 : 0); if (late && opt.pre === 'turn') P.move.set(1, 0);
    G.step(); rec(); }
  hits.length = 0; WO.length = 0; const o = line.length; const ok = P.skill.thrust(); if (!ok) { M.freeWorld(G); return null; }
  for (let i = 0; i < Math.round(opt.post / DT); i++) { P.move.set(0, 0); G.step(); if (!rec()) break; }
  M.freeWorld(G); return { line, o, hits, xs, WO };
}
for (const w of WS) for (const s of seeds) {
  const G = H.newRound({ walls: true, seed: s, weapon: w, weapon2: w, AI2Class: H.AI }); const ais = new Map([[G.player, G.ai2], [G.enemy, G.ai]]);
  const F = [G.player, G.enemy]; for (const f of F) f.__rec = {};
  let LP = null, LE = null; if (HON) { LP = attach(G.world, bodiesOf(G.player), { fighter: G.player }); LE = attach(G.world, bodiesOf(G.enemy), { fighter: G.enemy }); LP.foe = LE; LE.foe = LP; hook(G, [LP, LE]); }
  const LJ = new Map([[G.player, LP], [G.enemy, LE]]);
  // 실험 전용 입력 (AI 갱신 뒤 · 몸 스텝 앞)
  if (EXP.has('still') || EXP.has('noturn')) G.before = () => { for (const f of F) { const tp = f.skill?.tap; const on = !!tp && !tp.down; f.__exp = on;
    if (!on) { f.__face = null; continue; } if (EXP.has('still')) f.move.set(0, 0);
    if (EXP.has('noturn')) { if (!f.__face) { const p = f.faceTarget; f.__face = { x: p.x, y: p.y, z: p.z }; } f.faceTarget = f.__face; } } };
  if (EXP.has('aimfix')) { const ob = G.before; G.before = (t) => { ob?.(t); for (const f of F) f.__exp = !!f.skill?.tap && !f.skill.tap.down; }; }
  if (EXP.has('calm')) { for (const f of F) { const sk = f.skill; const o = sk.thrust.bind(sk); sk.thrust = (opt = {}) => { if (f.aiControlled !== false && opt.step === false && !opt.rangeCommit) { const tip = f.bladePoint(1, new THREE.Vector3()); if (V(f.sword.velocityAtPoint(tip)).length() > 2) return false; } return o(opt); }; } }
  // fightRaw (wb_measure.mjs) 그대로 + 스텝 기록 · 상처 기록
  const det = makeDet(w, ais);
  const L = new Map(F.map((f) => [f, []])), X = new Map(F.map((f) => [f, []])), ST = new Map(F.map((f) => [f, {}])), CS = new Map(F.map((f) => [f, {}])), EV = new Map(F.map((f) => [f, []])), HI = new Map(F.map((f) => [f, []])), WO = new Map(F.map((f) => [f, []]));
  const ow = G.combat.hooks.onWound; G.combat.hooks.onWound = (A, Vc, r, ...x) => { ow?.(A, Vc, r, ...x); if (L.has(A) && Vc !== A) { const i = L.get(A).length; HI.get(A).push(i); WO.get(A).push({ i, type: r.type, zone: r.zone, E: r.physE ?? r.energy, energy: r.energy, sp: r.speed, eff: r.eff, thr: r.thr, mEff: r.mEff }); } };
  const dead = new Set();
  for (let k = 0; k < Math.round(secs / DT); k++) {
    G.step();
    for (const f of F) { if (dead.has(f)) continue; const smp = M.sample(f); if (!smp || !f.alive) { dead.add(f); continue; } const ln = L.get(f); ln.push(smp); X.get(f).push(capture(f, ais.get(f), CS.get(f), LJ.get(f))); const ev = det(f, ln.length - 1, ln[ln.length - 2], ST.get(f)); if (ev) EV.get(f).push(ev); }
  }
  M.freeWorld(G);
  for (const f of F) { const line = L.get(f), ev = EV.get(f), hits = HI.get(f), xs = X.get(f);
    for (let j = 0; j < ev.length; j++) { const e = ev[j]; if (e.kind !== 'thrust') continue; if (line.length - 1 < e.o + 4) continue;
      const nextO = ev[j + 1]?.o ?? Infinity; const r = M.strokeWB(line, e.o, hits, 'thrust', nextO);
      const scene = r.gap0 >= AI_FAR(w) ? (r.closing > CLOSE_MAX ? 'farClose' : 'far') : r.gap0 <= AI_NEAR(w) ? 'near' : 'mid';
      const t0 = e.o + Math.round(r.t0rel / 1000 / DT); const end = t0 + Math.round(r.tEnd / DT); const iT = t0 + Math.round(r.tTip / DT);
      const hitI = r.hit ? t0 + Math.round(r.tHit / DT) : null; const wound = hitI != null ? WO.get(f).find((x) => x.i === hitI) ?? null : null;
      const a = Math.max(0, t0 - PRE), b = Math.min(xs.length - 1, end + POST);
      strokes.push({ seed: s, weapon: w, who: f === G.player ? 'P' : 'E', scene, tech: e.tech, o: e.o, t0, end, iT, hitI, nextO: Number.isFinite(nextO) ? nextO : null, ...r, wound, a, steps: xs.slice(a, b + 1) });
    } }
  process.stderr.write(`${w} ${s} 획 ${strokes.length}\n`);
}
function bodiesOf(f) { const seen = new Set(), out = []; for (const [n, b] of [...Object.entries(f.bodies), ['sword', f.sword]]) if (b && !seen.has(b.handle)) { seen.add(b.handle); out.push([n, b]); } return out; }
const tag = String(args.tag ?? `${seeds[0]}-${seeds[seeds.length - 1]}_${[...EXP].join('+')}`);
writeFileSync(join(OUT, `trace_${tag}.json`), JSON.stringify({ args, strokes }));
console.log(`획 ${strokes.length} → ${join(OUT, `trace_${tag}.json`)}`);
