// r22: r21/fall_cost.mjs 복사 + 판마다 perFight(씨앗 · 길이 · 죽음 수) 를 json 에 더 적음 (시뮬은 같음)
// r22p: r22/fall_cost.mjs 복사 + --posture=<파일> 자세 표본(재기만 · 몸에 아무것도 안 검): 가만히 선 때 실린 다리 무릎 굽힘 · 디딤 때 무릎 굽힘(걸음 꼴별) · 디딘 뒤 0.5 s 안 가장 깊은 굽힘 · 선 채 골반 높이
// ─────────────────────────────────────────────────────────────
//  fall_cost.mjs (r21 — fall_context.mjs 복사 + 싸움 쪽 값 cost: 판 길이 · 죽음 · 상처 · 베기 시작 수 · 선 채 골반이 간 길 — 몸에는 아무것도 안 건다) · 원본 fall_context.mjs — 싸움에서 스스로 넘어진 몸이 그 앞 1.0 s 동안 무엇을 하고 있었나 (물리 2.0 다섯째 판 · E1). 재기만 한다 — 몸에 아무것도 걸지 않는다.
//
//   node tools/sim/fall_context.mjs [--root=<트리>] [--fights=24] [--offset=0] [--secs=30] [--fightWeapons=longsword,rapier,zweihander] [--json=<파일>] [--rows] [--all]
//
//  판 · 넘어짐 · '스스로'의 뜻은 legs_battery.mjs 의 싸움과 글자까지 같다(같은 씨앗 · 같은 무기 돌림 · 넘어지기 앞 1.5 s 안에 받은 상처가 없는 넘어짐). 그래서 넘어짐 수가 그 도구와 같아야 한다(맨 끝 줄에 찍음).
//  몸마다 스텝마다 한 줄씩 3.0 s 를 고리로 들고 있다가 넘어진 스텝에 요약한다:
//   · 넘어진 까닭(Fighter.updateState 의 가지): 기울기 · 발 밖으로 달아남(offBalanceTime) · 균형 0 · 주저앉음 · 다리 못 버팀 · 그 밖(도구의 '서 있음인 채 0.25 s 낮음')
//   · 시작(onset) = 넘어질 때까지 '발 밖으로 벗어남(Fighter.offBalance > 0) 또는 가슴 기울기 30° 넘음'이 끊기지 않고 이어진 구간의 첫 스텝(고리는 3 s). 본 창 = 넘어지기 앞 1.0 s 와 시작 앞 0.5 s 가운데 더 이른 쪽부터 넘어질 때까지.
//   · 제 칼: AI 의 단계(attack 의 windup · approach = 감기 / strike = 베기 / follow = 되돌림 · defend = 막기 · 그 밖 = 쉼)를 시작 때와 창 전체로.
//   · 발: 시작 때 뜬 발과 그 걸음 꼴(walk · req · catch · settle · draw · trail) · 시작 앞 0.4 s 안에 두 발 디딤에서 발을 뗐는가 · 창 안의 걸음 수.
//   · 맞음 · 밀림: 창 안에 칼끼리 부딪힘(takeJolt) · 상대 몸이나 칼이 내 몸 토막에 닿음(엔진 접촉 — 닿은 스텝 수 · 가장 큰 접촉 충격량) · 상대 가슴까지 거리.
//   · 돌기: 창 안의 몸 돌리는 빠르기 최고(gait.headRate) · 기력(stamina.value · 단계 · 바닥남) · 무기 · 조종 스틱 · 넘어진 쪽(몸 틀).
//   · 뿌리 걸음: 시작 때 떠 있던 발을 뗀 스텝 바로 앞의 꼴(남을 발 ~ 캡처 점 거리 · 자세 너비 · 골반 높이 · 가는 쪽 거꾸로) — 맨 끝 '뿌리' 가름.
//  --mech --ringOut=<파일> = (10 번째 판) 스텝마다 기계 칸(다리 무릎 굽힘 · 무릎 토크 ÷ 한도 · 엉덩이 · 발목 한도 닿음 · 캡처 점 · 도움 ÷ 상한 · 걸음 상태)을 더 적고 넘어짐마다 앞 3 s 고리를 파일로 — 가름은 tools/sim/fall_mech.mjs
//  --rows = 넘어짐마다 한 줄 · --all = 스스로가 아닌 넘어짐도 줄로 · --trace=씨앗:P|E:넘어진 때[,…] [--every=6] [--compact] = 그 넘어짐 앞 3 s 의 자취.
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { writeFileSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
if (args.cfg) { const { applyCfg } = await import(u('tools/sim/cfg_override.mjs')); console.log('덮어씀(재기 전용):', JSON.stringify(applyCfg(String(args.cfg)))); }
const H = await import(u('tools/sim/harness_m.mjs'));
const CFG = await import(u('src/config.js'));
const DT = H.DT, FIGHTS = +(args.fights ?? 24), OFFSET = +(args.offset ?? 0), FSECS = +(args.secs ?? 30);
const FW = String(args.fightWeapons ?? 'longsword,rapier,zweihander').split(',');
const WIN = Math.round(1.0 / DT), RING = Math.round(3.0 / DT);
const { BALANCE, BODY } = CFG;

const strokeOf = (ai) => {
  if (!ai) return 'none';
  if (ai.mode === 'attack') return ai.phase === 'windup' || ai.phase === 'approach' || ai.phase === 'rdWind' ? 'windup' : ai.phase === 'strike' || ai.phase === 'rdStrike' || ai.phase === 'ibLink' ? 'cut' : ai.phase === 'follow' ? 'recover' : 'idle';
  if (ai.mode === 'defend') return 'defend';
  if (ai.mode === 'secret') return 'secret';
  if (ai.mode === 'withdraw') return 'withdraw';
  return 'idle';
};
/** 발목의 무게중심에 대한 자리 (몸 틀 · 앞 · 오른쪽 m) */
const rel = (f, n, fw) => { const p = f.bodies[n].translation(), c = f.com ?? p; const dx = p.x - c.x, dz = p.z - c.z; return [+(dx * fw.x + dz * fw.z).toFixed(2), +(dx * -fw.z + dz * fw.x).toFixed(2), +p.y.toFixed(2)]; };
const TRACE = args.trace ? String(args.trace).split(',').map((x) => { const [sd, who, t] = x.split(':'); return { seed: +sd, who, t: +t }; }) : [];
const falls = [];
// ── --mech (10 번째 판 · 넘어짐 흔적): 스텝마다 기계 칸을 더 적고, 넘어짐마다 앞 3 s 고리를 --ringOut 파일에 남긴다 (가름은 tools/sim/fall_mech.mjs) ──
const MECH = !!(args.mech || args.ringOut);
const { LEGS, AID } = CFG;
const ringDump = [];
/** 이 스텝의 기계 칸: 다리마다 딛음 · 무릎 굽힘(rad) · 무릎 펴는 토크 ÷ 한도 · 엉덩이 · 발목이 한도에 닿음 / 무게중심 높이 · 캡처 점(몸 틀) · 선언된 도움 ÷ 상한 · 걸음 상태 */
function mechOf(f, e, G) {
  const D = f.legDrive, g = f.gait, lim = LEGS.limit, out = {};
  const fw = f.forward(new H.THREE.Vector3());
  for (const k of ['F', 'B']) {
    const L = D?.legs?.[k];
    if (!L) { out['k' + k] = null; continue; }
    const str = D.strengthOf(k), len = L.ph.distanceTo(L.pa);
    const c = Math.max(-1, Math.min(1, (L.lenT * L.lenT + L.lenS * L.lenS - len * len) / (2 * L.lenT * L.lenS)));
    const r = L.raw;
    out['k' + k] = {
      on: L.on ? 1 : 0, st: g?.legs?.[k]?.stance ? 1 : 0, phi: +(Math.PI - Math.acos(c)).toFixed(3), kr: +(-r.k / Math.max(1e-6, lim.kneeExt * str)).toFixed(3),
      hs: Math.abs(r.hx) > lim.hipAbd * str || Math.abs(r.hy) > lim.hipRot * str || Math.abs(r.hz) > lim.hipFlex * str ? 1 : 0,
      as: r.az > lim.anklePlantar * str || r.az < -lim.ankleDorsi * str || Math.abs(r.ax) > lim.ankleInv * str ? 1 : 0,
      N: +(g?.legs?.[k]?.N ?? 0).toFixed(0), kind: g?.legs?.[k]?.stance ? null : g?.legs?.[k]?.kind ?? null, u: g?.legs?.[k]?.stance ? 0 : +((g?.legs?.[k]?.t ?? 0) / Math.max(1e-3, g?.legs?.[k]?.T ?? 1)).toFixed(2),
    };
  }
  const com = f.com, cv = f.comVel, w0 = D?.w0 || 3.3;
  if (com && cv) {
    const p = f.bodies.pelvis.translation();
    const cx = com.x + cv.x / w0 - p.x, cz = com.z + cv.z / w0 - p.z;
    out.comY = +com.y.toFixed(3); out.cpF = +(cx * fw.x + cz * fw.z).toFixed(3); out.cpR = +(cx * -fw.z + cz * fw.x).toFixed(3);
  }
  out.aidT = D ? +Math.min(1, Math.hypot(D.rem.x, D.rem.z) / AID.tiltMax).toFixed(2) : 0;
  out.aidY = D ? +Math.min(1, Math.abs(D.rem.y) / AID.yawMax).toFixed(2) : 0;
  out.aidUp = f.aidAfter ? 1 : 0;
  out.sit = +(f.sitTime ?? 0).toFixed(2);
  out.pend = g?.pend ?? null; out.reqK = g?.req?.kind ?? null; out.catches = g?.catches ?? 0;
  out.hp = +(f.legHealth ?? 1).toFixed(2); out.mus = +(f.muscle ?? 1).toFixed(2); out.bal = +(f.balance ?? 0).toFixed(0);
  out.ph = e.ai?.phase ?? null; out.mode = e.ai?.mode ?? null;
  return out;
}
let nFalls = 0, nSelf = 0, nFallsD = 0, nSelfD = 0; // …D = 따로 일어난 넘어짐 (앞 넘어짐 뒤 몸이 0.25 s 넘게 서 있은 다음의 것만 — legs_battery.mjs 의 fallsD 와 같은 셈)
const bodyMin = { all: 0, stand: 0 };
const cost = { fights: 0, secs: 0, deaths: 0, wounds: 0, woundE: 0, strokes: 0, walk: 0, fightsDeath: 0 }; // r21: 싸움 쪽 값 (재기만)
const perFight = [];
const POS = { still: [], pelvis: [], td: [] }; // r22p 자세 표본
/** r22p: 다리 k 의 무릎 굽힘(rad) — mechOf 와 같은 셈(엉덩이 ~ 발목 거리 → 코사인 법칙) */
const kneePhi = (D, k) => { const L = D?.legs?.[k]; if (!L) return null; const len = L.ph.distanceTo(L.pa); const c = Math.max(-1, Math.min(1, (L.lenT * L.lenT + L.lenS * L.lenS - len * len) / (2 * L.lenT * L.lenS))); return Math.PI - Math.acos(c); }; // r22: 판마다 씨앗 · 길이 · 죽음 수 (짝 지은 견줌용 — 재기만)

for (let seed = 1; seed <= FIGHTS; seed++) {
  const G = H.newRound({ walls: true, seed: seed + OFFSET, weapon: FW[(seed - 1) % FW.length], weapon2: FW[seed % FW.length], AI2Class: H.AI });
  const info = G.combat.info;
  const fs = [G.player, G.enemy].map((x, i) => ({ f: x, ai: i === 0 ? G.ai2 : G.ai, foe: i === 0 ? G.enemy : G.player, prev: 'stand', lastWound: -9, lowFor: 0, sat: false, ring: [], jolt: 0, why: null, weapon: i === 0 ? FW[(seed - 1) % FW.length] : FW[seed % FW.length] }));
  G.onWound = (att, vic, r) => { cost.wounds++; cost.woundE += r?.energy ?? 0; const e = fs.find((x) => x.f === vic); if (e) { e.lastWound = G.t; (e.wl ||= []).push({ t: G.t, zone: r?.zone ?? '-', type: r?.type ?? '-', energy: r?.energy ?? 0, sev: r?.severity ?? 0 }); } };
  for (const e of fs) {
    const f = e.f, oJ = f.takeJolt, oK = f.knockDown;
    f.takeJolt = function (J) { e.jolt = Math.max(e.jolt, J); return oJ.call(this, J); };
    f.knockDown = function (heavy) {
      if (this.state === 'stand') {
        const tilt = this.tiltDeg() - (this.hunch || 0) * 180 / Math.PI;
        e.why = tilt > BODY.fallTiltDeg ? 'tilt' : this.balance <= 0 ? 'balance0' : this.offBalanceTime > BALANCE.fallDelay ? 'footing' : this.sitTime > (BALANCE.sitDelay ?? 9) ? 'sit' : this.legsCannotSupport ? 'legs' : 'other';
      }
      return oK.call(this, heavy);
    };
    e.cols = Object.values(f.bodies).map((b) => b.collider(0));
    e.swCols = []; if (f.sword) for (let k = 0; k < f.sword.numColliders(); k++) e.swCols.push(f.sword.collider(k));
  }
  const n = Math.round(FSECS / DT);
  for (let i = 0; i < n; i++) {
    G.step();
    for (const e of fs) {
      const f = e.f, st = f.state; if (st === 'dead') continue;
      if (args.posture) { // r22p 자세 표본
        const g = f.gait, D = f.legDrive, R2 = (x) => Math.round(x * 1000) / 1000;
        e.pz ??= { F: { st: 1, kind: null, td: null }, B: { st: 1, kind: null, td: null } };
        if (st === 'stand' && g?.legs && D?.legs) {
          const pp = f.bodies.pelvis.translation();
          if (i % 4 === 0) POS.pelvis.push(R2(pp.y - (f.groundHeightAt ? f.groundHeightAt(pp.x, pp.z) : 0)));
          const v = f.comVel ? Math.hypot(f.comVel.x, f.comVel.z) : 9;
          if (i % 4 === 0 && g.legs.F.stance && g.legs.B.stance && v < 0.15) { const k = (g.legs.F.N ?? 0) >= (g.legs.B.N ?? 0) ? 'F' : 'B'; const ph = kneePhi(D, k); if (ph != null) POS.still.push(R2(ph)); }
          for (const k of ['F', 'B']) {
            const z = e.pz[k], l = g.legs[k], s1 = l.stance ? 1 : 0, ph = kneePhi(D, k);
            if (z.td) { if (s1 && ph != null && z.td.n < 60) { z.td.mx = Math.max(z.td.mx, ph); z.td.n++; } else { POS.td.push([z.td.kind, R2(z.td.ph), R2(z.td.mx), z.td.n]); z.td = null; } }
            if (s1 && !z.st && ph != null) z.td = { kind: z.kind ?? '-', ph, mx: ph, n: 1 };
            if (!s1) z.kind = l.kind ?? '-';
            z.st = s1;
          }
        } else if (e.pz) { for (const k of ['F', 'B']) { const z = e.pz[k]; if (z.td) { POS.td.push([z.td.kind, Math.round(z.td.ph * 1000) / 1000, Math.round(z.td.mx * 1000) / 1000, z.td.n]); z.td = null; } z.st = 1; } }
      }
      bodyMin.all += DT / 60; if (st === 'stand') bodyMin.stand += DT / 60;
      { const so = strokeOf(e.ai); if (so === 'cut' && e.cStroke !== 'cut') cost.strokes++; e.cStroke = so; const q = f.bodies.pelvis.translation(); if (e.cpx != null && st === 'stand') cost.walk += Math.hypot(q.x - e.cpx, q.z - e.cpz); e.cpx = q.x; e.cpz = q.z; }
      const pp = f.bodies.pelvis.translation(), y = pp.y; e.lowFor = y < 0.5 ? e.lowFor + DT : 0;
      // 상대 몸 · 칼이 내 몸 토막에 닿았나 (엔진 접촉)
      let touch = 0, imp = 0, byBlade = false, impSum = 0;
      for (const c of e.cols) {
        G.world.contactPairsWith(c, (o) => {
          const io = info.get(o.handle); if (!io || io.fighter !== e.foe) return;
          G.world.contactPair(c, o, (m) => { const k = m.numContacts(); if (!k) return; touch++; if (io.kind === 'weapon') byBlade = true; for (let j = 0; j < k; j++) { imp = Math.max(imp, m.contactImpulse(j)); impSum += m.contactImpulse(j); } });
        });
      }
      // 내 칼이 상대 칼에 닿았나 (칼끼리 맞댐 — 부딪힘 문턱 밑의 누르기도)
      let bind = 0, bindImp = 0;
      for (const c of e.swCols) {
        G.world.contactPairsWith(c, (o) => {
          const io = info.get(o.handle); if (!io || io.fighter !== e.foe || io.kind !== 'weapon') return;
          G.world.contactPair(c, o, (m) => { const k = m.numContacts(); if (!k) return; bind++; for (let j = 0; j < k; j++) bindImp = Math.max(bindImp, m.contactImpulse(j)); });
        });
      }
      const g = f.gait, D = f.legDrive, fp = e.foe.bodies.chest.translation(), cp = f.bodies.chest.translation();
      const fw = f.forward(new H.THREE.Vector3()), cv = f.comVel ?? { x: 0, z: 0 };
      const s = {
        t: G.t, st, stroke: strokeOf(e.ai), tech: e.ai?.tech?.name ?? null, swing: !!f.skill?.swinging,
        F: g?.legs?.F?.stance ? null : g?.legs?.F?.kind ?? null, B: g?.legs?.B?.stance ? null : g?.legs?.B?.kind ?? null, walking: !!g?.walking, req: !!g?.req,
        cap: D?.capDist ?? 0, off: f.offBalance ?? 0, tilt: f.tiltDeg(), y, on: D?.dbg?.on ?? 0,
        head: Math.abs(g?.headRate ?? 0), stam: f.stamina?.value ?? null, lvl: f.stamina?.level ?? 0, exh: !!f.stamina?.exhausted,
        jolt: e.jolt, touch, imp, impSum, byBlade, bind, bindImp, sinceStand: st === 'stand' ? f.stateTime : 0, everDown: e.everDown, cf: f.cmdVel ? f.cmdVel.x * fw.x + f.cmdVel.z * fw.z : 0, cr: f.cmdVel ? f.cmdVel.x * -fw.z + f.cmdVel.z * fw.x : 0, dist: Math.hypot(fp.x - cp.x, fp.z - cp.z), mv: Math.hypot(f.move.x, f.move.y),
        mx: f.move.x, my: f.move.y, cmd: f.cmdVel ? Math.hypot(f.cmdVel.x, f.cmdVel.z) : 0, offT: f.offBalanceTime ?? 0, bal: f.balance ?? 0,
        fF: rel(f, 'footF', fw), fB: rel(f, 'footB', fw), cut: !!f.skill?.swinging, tip: f.tipVel ? Math.hypot(f.tipVel.x, f.tipVel.y, f.tipVel.z) : 0, rx: D ? D.rem.x * fw.x + D.rem.z * fw.z : 0, rz: D ? D.rem.x * -fw.z + D.rem.z * fw.x : 0, ry: D ? D.rem.y : 0, ax: D ? D.armM.x * fw.x + D.armM.z * fw.z : 0, az: D ? D.armM.x * -fw.z + D.armM.z * fw.x : 0, ay: D ? D.armM.y : 0, pend: g?.pend ?? null, h: g?.h ?? 0,
        vf: cv.x * fw.x + cv.z * fw.z, vr: cv.x * -fw.z + cv.z * fw.x, remT: D ? Math.hypot(D.rem.x, D.rem.z) : 0, remY: D ? Math.abs(D.rem.y) : 0, armM: D ? D.armM.length() : 0,
      };
      if (MECH) Object.assign(s, mechOf(f, e, G));
      e.jolt = 0;
      e.ring.push(s); if (e.ring.length > RING) e.ring.shift();
      if (st !== 'stand') e.everDown = true;
      e.upRun = y > 0.7 && e.f.tiltDeg() < 45 ? (e.upRun ?? 0) + DT : 0; if (e.upRun > 0.25) e.fresh = true;
      if (e.lastFall) { if (st !== 'stand') e.lastFall.leftStand = true; if (e.upRun > 0.25) { e.lastFall.backUp = +(G.t - e.lastFall.t).toFixed(2); e.lastFall = null; } }
      const fallNow = (e.prev === 'stand' && (st === 'down' || st === 'getup')) || (st === 'stand' && e.lowFor > 0.25 && !e.sat);
      if (st === 'stand' && e.lowFor > 0.25) e.sat = true; else if (y > 0.6) e.sat = false;
      const self = G.t - e.lastWound > 1.5;
      if (fallNow) {
        nFalls++; if (self) nSelf++;
        const dup = e.fresh === false; e.fresh = false;
        if (!dup) { nFallsD++; if (self) nSelfD++; }
        const R = e.ring.slice(0, -1).filter((x) => x.st === 'stand'); // 넘어진 스텝은 뺀 고리 (서 있던 스텝만 · 3 s 까지)
        const N = R.length;
        // 시작: 뒤에서부터 '발 밖으로 벗어남(offBalance > 0) 또는 가슴 기울기 30° 넘음'이 이어진 첫 스텝
        let on = N; while (on > 0 && (R[on - 1].off > 0 || R[on - 1].tilt > 30)) on--;
        if (on >= N) on = Math.max(0, N - 1);
        const O = R[on] ?? s, pre = R.slice(Math.max(0, on - Math.round(0.4 / DT)), on + 1);
        const wholeWin = R.slice(Math.max(0, Math.min(N - WIN, on - Math.round(0.5 / DT)))); // 본 창 = 넘어지기 앞 1.0 s 와 시작 앞 0.5 s 가운데 더 이른 쪽부터 넘어질 때까지
        const lastWin = R.slice(Math.max(0, N - WIN)); // 넘어지기 앞 1.0 s
        const seenStroke = [...new Set(wholeWin.map((x) => x.stroke))];
        const swingAt = O.F ?? O.B ?? null, swingLeg = O.F ? 'F' : O.B ? 'B' : null;
        // 시작 앞 0.4 s 안에 두 발 디딤에서 발을 뗐는가 (그 걸음 꼴)
        let lift = null; for (let k = 1; k < pre.length; k++) { const a = pre[k - 1], b = pre[k]; if (!a.F && !a.B && (b.F || b.B)) lift = b.F ?? b.B; }
        let steps = 0; for (let k = 1; k < wholeWin.length; k++) { const a = wholeWin[k - 1], b = wholeWin[k]; if ((!a.F && b.F) || (!a.B && b.B)) steps++; }
        const kinds = [...new Set(wholeWin.flatMap((x) => [x.F, x.B]).filter(Boolean))];
        const joltMax = Math.max(0, ...wholeWin.map((x) => x.jolt)), touchSteps = wholeWin.filter((x) => x.touch > 0).length, impMax = Math.max(0, ...wholeWin.map((x) => x.imp)), blade = wholeWin.some((x) => x.byBlade);
        const bindSteps = wholeWin.filter((x) => x.bind > 0).length, bindImp = Math.max(0, ...wholeWin.map((x) => x.bindImp));
        const preTouch = R.slice(Math.max(0, on - Math.round(0.5 / DT)), on + 1); // 시작 앞 0.5 s — 맞음 · 밀림이 '먼저'였나
        const hitBefore = preTouch.some((x) => x.touch > 0), bindBefore = preTouch.some((x) => x.bind > 0 || x.jolt > 0);
        const last = R[N - 1] ?? s;
        // 뿌리 걸음 = 시작 때 떠 있던 발(없으면 시작 앞에 마지막으로 뗀 발)을 뗀 스텝. 그 바로 앞 스텝(두 발 디딤)의 꼴을 적는다:
        //  남을 발에서 캡처 점(무게중심 + 속도 ÷ 3.3)까지의 거리(m · 몸 틀) · 두 발 사이 옆 너비 · 앞뒤 길이 · 골반 높이 · 몸 빠르기 · 조종 속도와 몸 빠르기가 거꾸로인가
        let root = null;
        for (let k = Math.min(on, N - 1); k > 0 && k > on - Math.round(1.5 / DT); k--) {
          const a = R[k - 1], b = R[k], leg = !a.F && b.F ? 'F' : !a.B && b.B ? 'B' : null;
          if (!leg) continue;
          const o = leg === 'F' ? a.fB : a.fF, cx = a.vf / 3.3, cz = a.vr / 3.3, sp = Math.hypot(a.vf, a.vr), cm = Math.hypot(a.cf, a.cr);
          root = { before: +((N - k) * DT).toFixed(2), kind: b[leg], leg, both: !a.F && !a.B, d: +Math.hypot(o[0] - cx, o[1] - cz).toFixed(2), dLat: +(o[1] - cz).toFixed(2), dSag: +(o[0] - cx).toFixed(2), wide: +Math.abs(a.fF[1] - a.fB[1]).toFixed(2), long: +Math.abs(a.fF[0] - a.fB[0]).toFixed(2), y: +a.y.toFixed(2), v: +sp.toFixed(2), rev: sp > 0.5 && cm > 0.2 && (a.vf * a.cf + a.vr * a.cr) / (sp * cm) < -0.3, sameSide: (a.fF[1] - cz) * (a.fB[1] - cz) > 0 && Math.min(Math.abs(a.fF[1] - cz), Math.abs(a.fB[1] - cz)) > 0.1, tilt: +a.tilt.toFixed(0) };
          break;
        }
        const pushSum = preTouch.reduce((q, x) => q + x.impSum, 0) + R.slice(on).reduce((q, x) => q + x.impSum, 0); // 시작 앞 0.5 s 부터 넘어질 때까지 상대 몸 · 칼이 내 몸에 준 접촉 충격량 합 (N·s)
        const afterGetup = !!last.everDown && last.sinceStand < 4;

        const rec = {
          root, pushSum: +pushSum.toFixed(1), afterGetup, sinceStand: +last.sinceStand.toFixed(1),
          seed: seed + OFFSET, who: e.f.name, weapon: e.weapon, t: +G.t.toFixed(2), self, dup, why: e.why ?? (st === 'stand' ? 'low' : 'other'), heavy: st === 'down',
          onsetBefore: +((N - on) * DT).toFixed(2), strokeOnset: O.stroke, strokeFall: last.stroke, strokeSeen: seenStroke, stroke1s: [...new Set(lastWin.map((x) => x.stroke))], kinds1s: [...new Set(lastWin.flatMap((x) => [x.F, x.B]).filter(Boolean))], hit1s: lastWin.some((x) => x.touch > 0), bind1s: lastWin.some((x) => x.bind > 0 || x.jolt > 0), bindSteps, bindImp: +bindImp.toFixed(1), hitBefore, bindBefore, vOn: +Math.hypot(O.vf, O.vr).toFixed(2), vfOn: +O.vf.toFixed(2), vrOn: +O.vr.toFixed(2), stamOn: O.stam != null ? +O.stam.toFixed(0) : null, tech: O.tech, swingSeen: wholeWin.some((x) => x.swing),
          swingAt, swingLeg, lift, steps, kinds, onAtOnset: O.on, walking: O.walking, mv: +O.mv.toFixed(2),
          joltMax: +joltMax.toFixed(1), touchSteps, impMax: +impMax.toFixed(1), blade, distMin: +Math.min(...wholeWin.map((x) => x.dist)).toFixed(2), distFall: +last.dist.toFixed(2),
          headMax: +Math.max(0, ...wholeWin.map((x) => x.head)).toFixed(2), stam: last.stam != null ? +last.stam.toFixed(0) : null, lvl: last.lvl, exh: last.exh,
          vf: +last.vf.toFixed(2), vr: +last.vr.toFixed(2), tilt: +last.tilt.toFixed(0), y: +last.y.toFixed(2), remT: +(wholeWin.reduce((a, x) => a + x.remT, 0) / Math.max(1, N)).toFixed(1), remY: +(wholeWin.reduce((a, x) => a + x.remY, 0) / Math.max(1, N)).toFixed(1), armMax: +Math.max(0, ...wholeWin.map((x) => x.armM)).toFixed(0),
        };
        { const W = (e.wl ?? []).filter((w) => G.t - w.t <= 1.5); const w = W.sort((x, y) => y.energy - x.energy)[0]; rec.wound = w ? { zone: w.zone, type: w.type, energy: +w.energy.toFixed(0), sev: +w.sev.toFixed(2), ago: +(G.t - w.t).toFixed(2), n: W.length } : null; rec.legs = +(e.f.legHealth ?? 1).toFixed(2); rec.bal = +(e.f.balance ?? 0).toFixed(0); }
        if (!dup) { rec.leftStand = st !== 'stand'; e.lastFall = rec; }
        if (args.ringOut) ringDump.push({ key: `${rec.seed}:${rec.who}:${rec.t}`, seed: rec.seed, who: rec.who, t: rec.t, dup, self, onsetBefore: rec.onsetBefore, ring: e.ring.filter((_, k) => k % 2 === (e.ring.length - 1) % 2).map((x) => ({ ...x, fF: x.fF, fB: x.fB })) });
        falls.push(rec);
        if (TRACE.some((q) => q.seed === seed + OFFSET && q.who === e.f.name && Math.abs(q.t - G.t) < 0.05)) {
          console.log(`── 자취 씨앗 ${seed + OFFSET} ${e.f.name} ${e.weapon} 넘어짐 t ${G.t.toFixed(2)} 까닭 ${rec.why} (몸 틀: 앞 · 오른쪽 · 발 = 무게중심에 대한 발목 자리) ──`);
          const fx = (x, n = 2) => (x >= 0 ? ' ' : '') + x.toFixed(n);
          for (let k = 0; k < e.ring.length; k += +(args.every ?? 6)) { const x = e.ring[k]; if (args.compact) { console.log(`   ${(x.t - G.t).toFixed(2)} ${x.stroke.slice(0, 4).padEnd(4)}${x.cut ? '*' : ' '} 조종 ${fx(x.mx, 1)} ${fx(x.my, 1)} v ${fx(x.vf)} ${fx(x.vr)} F ${(x.F ?? '-').slice(0, 4).padEnd(4)} ${fx(x.fF[0])} ${fx(x.fF[1])} B ${(x.B ?? '-').slice(0, 4).padEnd(4)} ${fx(x.fB[0])} ${fx(x.fB[1])} 누른 ${x.on} off ${x.off.toFixed(2)} 기울 ${x.tilt.toFixed(0).padStart(2)} 골반 ${x.y.toFixed(2)} 돌 ${x.head.toFixed(1)} 팔 ${fx(x.ax, 0)} ${fx(x.az, 0)} ${fx(x.ay, 0)} 닿 ${x.touch}/${x.imp.toFixed(0)} 거리 ${x.dist.toFixed(1)}${x.pend ? ' 기다림' + x.pend : ''}${x.req ? ' 부탁' : ''}`); continue; } console.log(`   ${(x.t - G.t).toFixed(2)} ${x.st.padEnd(5)} ${x.stroke.padEnd(8)}${x.cut ? '*' : ' '} 칼끝 ${x.tip.toFixed(1).padStart(4)} · 조종 ${fx(x.mx, 1)} ${fx(x.my, 1)} · 몸 v 앞 ${fx(x.vf)} 옆 ${fx(x.vr)} · F ${(x.F ?? '-').padEnd(6)} ${x.fF.map((v) => fx(v)).join(' ')} · B ${(x.B ?? '-').padEnd(6)} ${x.fB.map((v) => fx(v)).join(' ')} · 누른 ${x.on} · 받침 밖 ${x.cap.toFixed(2)} off ${x.off.toFixed(2)} (${x.offT.toFixed(2)} s) · 기울기 ${x.tilt.toFixed(0).padStart(2)}° 골반 ${x.y.toFixed(2)} (목표 ${x.h.toFixed(2)}) · 돌기 ${x.head.toFixed(1)} · 나머지 앞축 ${fx(x.rx, 0)} 옆축 ${fx(x.rz, 0)} yaw ${fx(x.ry, 0)} · 팔 ${fx(x.ax, 0)} ${fx(x.az, 0)} ${fx(x.ay, 0)} · 닿음 ${x.touch}/${x.imp.toFixed(1)} 맞댐 ${x.bind} · 거리 ${x.dist.toFixed(2)}${x.pend ? ' · 기다림 ' + x.pend : ''}`); }
        }
      }
      e.why = st === 'stand' ? null : e.why;
      e.prev = st;
    }
    if (G.player.state === 'dead' || G.enemy.state === 'dead') break;
  }
  cost.fights++; cost.secs += G.t; { const dd = [G.player, G.enemy].filter((x) => x.state === 'dead').length; cost.deaths += dd; if (dd) cost.fightsDeath++; perFight.push({ seed: seed + OFFSET, secs: +G.t.toFixed(2), deaths: dd }); }
  try { G.world.free(); } catch { /* */ }
}

// ── 가름 ──
// 맞음 · 밀림: 칼끼리 부딪힘이 창 안에 있었거나(joltMax > 0) 상대 몸 · 칼이 내 몸에 닿았음(touchSteps > 0). 세기: 접촉 충격량 최고 × 120 = 그 스텝의 힘 N.
const hitOf = (r) => (r.touchSteps > 0 ? (r.blade ? 'body-blade' : 'body') : r.joltMax > 0 || r.bindSteps > 0 ? 'clash' : 'none');
const hitFirst = (r) => (r.hitBefore ? '몸에 닿음' : r.bindBefore ? '칼끼리' : '없음');
const footOf = (r) => (r.swingAt ? r.swingAt : r.lift ? 'lift:' + r.lift : 'both');
const cnt = (rows, key) => { const m = new Map(); for (const r of rows) { const k = key(r); m.set(k, (m.get(k) ?? 0) + 1); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
const show = (title, rows, key) => console.log(`  ${title}: ` + cnt(rows, key).map(([k, v]) => `${k} ${v}`).join(' · '));
const S = falls.filter((r) => r.self);
console.log(`■ 넘어짐 ${nFalls} · 그중 스스로 ${nSelf} — 따로 일어난 것만 ${nFallsD} · 스스로 ${nSelfD} (씨앗 ${1 + OFFSET} ~ ${FIGHTS + OFFSET} · ${FW.join(' · ')}) · 살아 있던 몸 시간 ${bodyMin.all.toFixed(2)} 분 · 서 있던 ${bodyMin.stand.toFixed(2)} 분`);
{ // 11/26: 규칙이 선언한 넘어짐과 몸이 실제로 쓰러진 것 · 상처 자리와 세기 (훈련된 검술 숙련자 기준으로 읽기 위한 표)
  const D = falls.filter((r) => !r.dup);
  const by = (L, k) => cnt(L, k).map(([a, n]) => `${a} ${n}`).join(' · ');
  console.log(`  까닭(전체 · 겹침 뺌 ${D.length}): ${by(D, (r) => r.why)} — tilt = 몸이 실제로 55° 넘게 기욺 · balance0 = 상처 에너지로 균형 게이지가 0 (규칙) · footing = 발 밖에 0.25 s (규칙) · sit = 골반이 0.2 s 낮음 (규칙) · low = 서 있음인 채 골반이 0.25 s 낮음 (도구)`);
  console.log(`  서 있음인 채 제 다리로 다시 선 것(상태가 stand 를 안 떠남): ${D.filter((r) => r.backUp != null && !r.leftStand).length} · 걸린 시간 ${D.filter((r) => r.backUp != null && !r.leftStand).map((r) => r.backUp).sort((a, b) => a - b).join(' ')} s`);
  const Wd = D.filter((r) => !r.self);
  console.log(`  상처 뒤 넘어짐 ${Wd.length}: 자리 ${by(Wd, (r) => r.wound?.zone ?? '-')} | 세기(J) ${by(Wd, (r) => { const e = r.wound?.energy ?? 0; return e < 50 ? '<50' : e < 100 ? '50~100' : e < 200 ? '100~200' : '200+'; })} | 까닭 × 세기: ${by(Wd, (r) => `${r.why}|${(r.wound?.energy ?? 0) < 100 ? '<100J' : '100J+'}`)} | 다리 성함 ${by(Wd, (r) => (r.legs < 0.5 ? '<0.5' : r.legs < 0.9 ? '0.5~0.9' : '성함'))}`);
}
if (args.rows) for (const r of (args.all ? falls : S)) console.log(`   씨앗 ${r.seed} ${r.who} ${r.weapon.padEnd(10)} t ${String(r.t).padStart(5)} ${r.self ? '스스로' : '맞고  '} 까닭 ${r.why.padEnd(8)} 시작 −${r.onsetBefore} s · 칼 ${r.strokeOnset}→${r.strokeFall} (창 ${r.strokeSeen.join('/')}${r.tech ? ' · ' + r.tech : ''}) · 발 ${footOf(r)} (걸음 ${r.steps} · ${r.kinds.join('/') || '-'} · 누른 발 ${r.onAtOnset}) · 맞음 ${hitOf(r)} (부딪힘 ${r.joltMax} · 닿음 ${r.touchSteps} 스텝 · 충격 ${r.impMax} · 칼 맞댐 ${r.bindSteps} 스텝 ${r.bindImp} · 시작 앞 0.5 s: ${hitFirst(r)} · 거리 ${r.distMin}) · 돌기 ${r.headMax} · 기력 ${r.stam}${r.exh ? ' 바닥' : ''} · 조종 ${r.mv} · 몸 빠르기 시작 때 앞 ${r.vfOn} 옆 ${r.vrOn} → 끝 앞 ${r.vf} 옆 ${r.vr} · 못 낸 나머지 평균 기울기 ${r.remT} yaw ${r.remY} · 팔 반작용 최고 ${r.armMax}`);
console.log(`  스스로 넘어짐 ${S.length} 의 가름 (시작 = 발 밖으로 벗어나거나 가슴이 30° 넘게 기울어 다시 안 돌아온 때):`);
show('까닭', S, (r) => r.why);
show('무기', S, (r) => r.weapon);
show('제 칼 (시작 때)', S, (r) => r.strokeOnset);
show('제 칼 (창 1 s 안에 베기 cut 이 있었나)', S, (r) => (r.strokeSeen.includes('cut') ? 'cut 있음' : r.strokeSeen.includes('windup') ? 'windup 만' : r.strokeSeen.includes('defend') ? 'defend' : '없음'));
show('발 (시작 때)', S, footOf);
show('창 안의 걸음 꼴', S, (r) => r.kinds.join('/') || '-');
show('맞음 · 밀림 (본 창)', S, hitOf);
show('맞음 · 밀림 (시작 앞 0.5 s 안 — 먼저 맞았나)', S, hitFirst);
show('시작 때 몸 빠르기', S, (r) => (r.vOn > 1.2 ? '>1.2 m/s' : r.vOn > 0.6 ? '0.6~1.2' : '<0.6'));
show('돌기 (창 안 최고 rad/s)', S, (r) => (r.headMax > 2 ? '>2' : r.headMax > 1 ? '1~2' : '<1'));
show('기력', S, (r) => (r.exh ? '바닥' : r.lvl === 2 ? '몹시 지침' : r.lvl === 1 ? '지침' : '성함'));
show('상대까지 (창 안 최소 m)', S, (r) => (r.distMin < 0.75 ? '<0.75' : r.distMin < 1.2 ? '0.75~1.2' : r.distMin < 2 ? '1.2~2' : '>2'));
show('시작에서 넘어짐까지', S, (r) => (r.onsetBefore < 0.3 ? '<0.3 s' : r.onsetBefore < 0.6 ? '0.3~0.6' : r.onsetBefore < 1.0 ? '0.6~1.0' : r.onsetBefore < 2.9 ? '1.0~2.9' : '3 s 내내'));
show('칼 × 발 × 먼저 맞음 (시작 때)', S, (r) => `${r.strokeOnset}|${footOf(r)}|${hitFirst(r)}`);
show('칼 × 발 × 맞음', S, (r) => `${r.strokeOnset}|${footOf(r)}|${hitOf(r)}`);
// 뿌리 가름 (차례대로 처음 맞는 것 하나): 일어선 뒤 4 s 안 · 밀림(접촉 충격량 합 10 N·s 넘음 — 견줌: 묶음의 가슴 치기 40 N·s 는 8/8 버팀) · 낮은 골반에서 뗌(0.75 m 밑) · 벌어진 자세에서 뗌(옆 너비 0.6 m 넘음) ·
//  두 발이 캡처 점의 같은 쪽(옆으로 0.1 m 넘게) · 가는 쪽을 거꾸로 바꿈(몸 0.5 m/s 넘는데 조종 속도가 거꾸로) · 남을 발이 캡처 점에서 0.25 m 넘게 떨어진 채 뗌 · 그 밖
const rootOf = (r) => (r.afterGetup ? '일어선 뒤' : r.pushSum > 10 ? '밀림' : !r.root ? '뗀 발 없음' : r.root.y < 0.75 ? '낮은 골반' : r.root.wide > 0.6 ? '벌어진 자세' : r.root.sameSide ? '두 발이 한쪽' : r.root.rev ? '거꾸로 바꿈' : r.root.d > 0.25 ? '남을 발이 멂' : '그 밖');
show('뿌리 (뗀 발 바로 앞의 꼴)', S, rootOf);
show('뿌리 × 뗀 걸음 꼴', S, (r) => `${rootOf(r)}|${r.root?.kind ?? '-'}`);
show('뿌리 × 무기', S, (r) => `${rootOf(r)}|${r.weapon}`);
show('뿌리 × 제 칼(시작 때)', S, (r) => `${rootOf(r)}|${r.strokeOnset}`);
if (args.rows) for (const r of S) console.log(`   뿌리 씨앗 ${r.seed} ${r.who} ${r.weapon.padEnd(10)} t ${String(r.t).padStart(5)} ${rootOf(r).padEnd(8)} 칼 ${r.strokeOnset.padEnd(8)} · ` + (r.root ? `넘어지기 ${r.root.before} s 앞에 ${r.root.kind} 발 ${r.root.leg} 뗌 · 남을 발 ~ 캡처 점 ${r.root.d} m (앞뒤 ${r.root.dSag} · 옆 ${r.root.dLat}) · 자세 옆 ${r.root.wide} 앞뒤 ${r.root.long} · 골반 ${r.root.y} · 기울기 ${r.root.tilt}° · 몸 ${r.root.v} m/s${r.root.rev ? ' · 거꾸로' : ''}${r.root.sameSide ? ' · 한쪽' : ''}` : '뗀 발 없음') + ` · 밀림 합 ${r.pushSum} N·s · 선 지 ${r.sinceStand} s`);
if (args.ringOut) writeFileSync(String(args.ringOut), JSON.stringify({ dt: DT * 2, falls: ringDump }));
if (args.posture) writeFileSync(String(args.posture), JSON.stringify(POS)); // r22p
if (args.json) writeFileSync(String(args.json), JSON.stringify({ fights: FIGHTS, offset: OFFSET, nFalls, nSelf, nFallsD, nSelfD, bodyMin, cost, perFight, falls }, null, 1));
