// ─────────────────────────────────────────────────────────────
//  balance_scenes.mjs — 싸움에서 상처 없이 넘어지는 꼴을 혼자 장면으로 (물리 2.0 · 15 번째 판). 재기만 한다 — 몸에 거는 것은 장면마다 선언된 충격 한 번뿐.
//
//   node tools/sim/balance_scenes.mjs [--root=<트리>] [--scenes=A,C] [--seeds=0-39] [--rows] [--json=<파일>] [--J=<N·s>] [--ang=<°>] [--part=chest|pelvis] [--lead=<s>]
//
//  왜: 싸움 판(24 판 묶음 사이 흔들림 ±4 넘어짐)으로는 받아 딛기 값 · 무릎 고침을 가를 수 없다. 싸움의 넘어짐 꼴(docs/strike/physics2_proto/r15/situations.mjs 의 표)을
//   혼자 몸에 다시 만들고 '일어선 채 버텼나'를 씨앗마다 센다. 씨앗이 같으면 결과가 같다(새 세계 · 같은 차례).
//  몸: 싸움의 AI 몸과 같게 힘 0.65(config AI 숙련 '보통'의 몸 힘 — ai.js 가 싸움 몸에 거는 값) · aiControlled. 상대는 멀리 치움(harness park).
//  들어가기: 게임의 입력(조종 move · 손 자리 handOffset · gait.requestStep 의 lunge)만 쓴다. 그 위에 장면마다 선언된 수평 충격 한 번
//   (legs_battery 의 가슴 치기와 같은 꼴 — applyImpulse 한 스텝 · 가슴 또는 골반). 크기 ±20 % · 쪽 ±20° · 때는 씨앗으로 흔듦.
//  넘어짐: 상태가 down · getup · kneel · dead · 골반 0.5 m 밑 0.25 s · 가슴 기울기 60° 넘음 0.25 s (legs_battery 와 같음). 원인 가름 = tools/sim/fall_mech.mjs classify (싸움과 같은 칸 · 같은 고리).
//  판마다 내는 것: fell · 넘어진 때 · 원인 · 자리 잡은 때(충격 뒤 두 발 딛음 + 캡처 점 받침 안 + 무게중심 0.25 m/s 밑이 0.3 s 이어진 첫 때) ·
//   걸음마다 디딘 길이 ÷ 필요한 길이(뜰 때 그 발 ~ 캡처 점 거리) · 날아간 시간 · 디딜 때 그 다리 무릎 굽힘 · 충격 뒤 딛은 무릎 가장 깊은 굽힘 ·
//   충격 뒤 딛은 다리의 무릎 · 엉덩이 · 발목 토크가 한도를 넘은 스텝 몫.
//  장면 (값과 그 근거는 docs/strike/physics2_notes/r15_balance_scenes.md):
//   A 옆으로 쏠린 받아 딛기 — 앞으로 걸으며 런지 부탁 · 앞발이 뜬 뒤 골반을 옆으로 침
//   B 뒤로 쏠린 받아 딛기 — 뒷걸음하며 가슴을 뒤로 침 — 되살리지 못함(같은 원인 몫이 2/3 에 못 미침 — 기록 참조). 관문 기본 묶음에서 빠짐
//   C 한 발 딛음 · 굽은 무릎 꺼짐 — 뒷걸음하며 한 발이 뜬 때 골반을 뒤 · 옆으로 침
//   E 몸통 기욺 — 앞 · 옆으로 걸으며 베기 · 가슴을 앞 · 옆으로 침 — 되살리지 못함(넘어짐은 나와도 원인이 cap:* · sink:knee — 기록 참조). 관문 기본 묶음에서 빠짐 (--scenes=E 로만)
// ─────────────────────────────────────────────────────────────
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve, basename } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const ROOT = args.root ? resolve(String(args.root)) : resolve(HERE, '../..');
const u = (p) => pathToFileURL(join(ROOT, p)).href;
const H = await import(u('tools/sim/harness_m.mjs'));
const CFG = await import(u('src/config.js'));
// 원인 가름은 이 도구 옆의 fall_mech.mjs (재는 나무가 달라도 같은 잣대) — 없으면 그 나무의 것
const { classify } = await import(existsSync(join(HERE, 'fall_mech.mjs')) ? pathToFileURL(join(HERE, 'fall_mech.mjs')).href : u('tools/sim/fall_mech.mjs'));
const DT = H.DT, D2R = Math.PI / 180;
const { LEGS, BODY, BALANCE } = CFG;
const rng = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const med = (a) => { const s = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? s[(s.length - 1) >> 1] * 0.5 + s[s.length >> 1] * 0.5 : null; };
const fwdOf = (P) => { const q = P.bodies.pelvis.rotation(); const fx = 1 - 2 * (q.y * q.y + q.z * q.z), fz = 2 * (q.x * q.z - q.w * q.y), l = Math.hypot(fx, fz) || 1; return { x: fx / l, z: fz / l }; };
/** 선언된 충격 한 번: part(chest · pelvis)를 J N·s 로 · ang = 몸 앞 기준(0 = 뒤에서 앞으로 · +90 = 오른쪽으로 · 180 = 뒤로) — legs_battery hitChest 와 같은 틀 */
function hit(P, part, J, angDeg) { const f = fwdOf(P), a = angDeg * D2R, c = Math.cos(a), s = Math.sin(a); P.bodies[part].applyImpulse({ x: (f.x * c - f.z * s) * J, y: 0, z: (f.z * c + f.x * s) * J }, true); }
const CH = [0.42, 0.42], END = [-0.4, -0.42]; // 오른 대각 베기의 감기 · 끝 손 자리 (legs_battery FAM.diagR 기본)
const moveHand = (P, tgt, v) => { const o = P.handOffset, dx = tgt[0] - o.x, dy = tgt[1] - o.y, d = Math.hypot(dx, dy), st = v * DT; if (d > st) { o.x += (dx / d) * st; o.y += (dy / d) * st; } else o.set(tgt[0], tgt[1]); };

// ── 장면 ──
//  base: 크기 J (N·s) · 쪽 ang (°) · 때리는 토막 · 들어가기 lead (s, 충격 앞 걷는 시간의 바닥) · weapons = 씨앗마다 돌림(싸움 꼴의 무기 섞임)
//  drive(c, t) = 들어가기 동안 · 충격 뒤 입력 · trigger(c, t) = 충격을 걸 때인가 (lead 가 지난 뒤 처음 참인 스텝 · 1.0 s 안에 안 오면 그때 침)
// 몸 상태 표 (docs/strike/physics2_proto/r15/situations.mjs — 그 꼴로 넘어진 싸움 몸의 넘어지기 0.5 s 앞 [다리 성함 legHealth, 근육 힘 muscle]). 씨앗마다 하나를 골라
//  판 시작에 한 번 둔다: 두 다리 limbs.legF · legB = 다리 성함 · 피(blood)는 vigor(= 근육 힘 목표)가 그 근육 힘이 되게. 몸을 약하게만 한다(돕는 쪽 없음) — 싸움에서 그 몸이 앞서 받은 상처 · 흘린 피의 흉내.
const BODYSTATE = {
  A: [[1,1],[0.88,0.95],[0.97,1],[1,0.87],[1,1],[1,0.69],[1,1],[1,0.99],[0.66,1],[1,1],[1,1],[1,1],[0.82,0.72],[0.98,1],[1,1],[1,1],[1,0.67]],
  B: [[1,1],[1,1],[1,0.84],[1,1],[1,0.52],[0.94,1],[1,1],[1,1],[0.58,0.89],[1,0.86]],
  C: [[1,0.4],[0.57,0.63],[1,0.9],[0.92,0.51],[0.53,0.6],[0.53,1],[0.53,0.98],[0.98,0.43],[0.73,0.84],[0.94,0.49],[0.58,0.92],[0.66,1],[0.5,0.94],[1,0.57],[1,0.95],[1,1],[0.58,1],[0.99,1],[1,1],[0.74,1],[1,0.36],[0.5,0.76],[1,1]],
  E: [[1,1],[1,0.47],[1,0.87],[1,0.72],[0.65,1],[1,0.49],[0.66,1],[1,0.98],[0.91,1],[1,0.54],[1,1],[1,0.49],[1,1],[0.6,1],[0.6,0.66]],
};
function setBody(P, hp, mus) {
  P.limbs.legF = hp; P.limbs.legB = hp;
  const m = Math.max(0.4, Math.min(1, mus)), b = (m - 0.35) / 0.65;
  P.blood = m >= 1 ? 1 : CFG.VITALS.collapseBlood + b * (CFG.VITALS.weakBlood - CFG.VITALS.collapseBlood);
}
const oneUp = (P) => { const g = P.gait; if (!g?.legs) return null; const F = !g.legs.F.stance, B = !g.legs.B.stance; return F && !B ? 'F' : B && !F ? 'B' : null; };
export const SCENES = {
  A: {
    name: '옆으로 쏠린 받아 딛기', cause: 'cap:short', weapons: ['zweihander', 'rapier'],
    base: { J: 70, ang: 90, part: 'chest', lead: 0.6 }, // 맞춘 값(r15 · 씨앗 0 ~ 39): 가슴 70 N·s = 넘어짐 45 % · 같은 원인 78 % (가슴 80 = 57 % · 65 % · 골반 110 = 47 % · 79 % · 골반 55 = 0 %) — 몸 75 kg 에 옆 빠르기 ≈ 0.9 m/s (싸움 꼴 0.5 s 앞 0.96 m/s)
    drive(c, t) {
      const { P, s } = c;
      P.move.set(0, s.hitAt == null ? 0.45 : 0);
      if (s.req == null && t >= s.lead - 0.25) { s.req = P.gait?.requestStep?.({ kind: 'lunge', fwd: 0.6, duration: 0.4, accel: true }) ? t : -1; }
      moveHand(P, s.req > 0 ? END : CH, 12);
    },
    trigger: (c, t) => c.s.req > 0 && oneUp(c.P) != null && t - c.s.req > c.s.dly, // 런지 부탁 뒤 처음 한 발이 뜬 때
  },
  B: {
    name: '뒤로 쏠린 받아 딛기', cause: 'cap:short', weapons: ['rapier', 'rapier', 'zweihander'],
    base: { J: 70, ang: 180, part: 'chest', lead: 1.0 }, // 되살리지 못함 — 관문 기본 묶음에서 빠짐(--scenes=B 로만). 씨앗 0 ~ 39: 가슴 70 = 넘어짐 55 % · 같은 원인 55 % · 성한 몸 가슴 45 · 50 · 60 = 9 · 62 · 24 % · 성한 몸 골반 70 = 47 %. 씨앗 0 ~ 19: 가슴 40 · 60 은 같은 원인 25 · 60 % · 골반 60 · 80 은 40 · 43 % · 가슴 70 이 넘어짐 45 % · 같은 원인 67 % (싸움 꼴: 뒷걸음 중 0.5 s 앞 뒤 빠르기 0.84 → 0.25 s 앞 1.33 m/s)
    drive(c, t) { c.P.move.set(0, -1); moveHand(c.P, CH, 12); },
    trigger: (c, t) => oneUp(c.P) != null && t > c.s.lead + c.s.dly,
  },
  C: {
    name: '한 발 딛음 · 굽은 무릎 꺼짐', cause: 'sink:knee', weapons: ['zweihander', 'rapier', 'longsword'],
    base: { J: 0, ang: 150, part: 'pelvis', lead: 1.0, back: -0.8 }, // 뒷걸음 조종 −0.8 (16 번째 판에서 다시 맞춤: −0.45 는 씨앗 100 ~ 139 에서 넘어짐 18 % — 바닥 30 % 밑. −0.45 · −0.6 · −0.8 · −1 · 골반 15 N·s 를 두 묶음에서 견줘 −0.8 = 넘어짐 38 % · 33 % · 같은 원인 80 % · 92 %). // 충격 없음 (J 0 = 재기 시작 때만 적음). 맞춘 값: 성한 몸은 골반 · 가슴 30 ~ 80 N·s 에도 sink:knee 0 — 싸움 꼴의 다친 다리 · 빠진 피(몸 상태 표)가 있어야 꺼짐. 골반 30 N·s 를 더하면 같은 원인 57 % 로 떨어짐
    drive(c, t) { c.P.move.set(0, c.s.back ?? -0.45); moveHand(c.P, CH, 12); },
    trigger: (c, t) => oneUp(c.P) != null && t > c.s.lead + c.s.dly,
  },
  E: {
    name: '몸통 기욺', cause: 'tilt:other', weapons: ['zweihander', 'rapier', 'longsword'],
    base: { J: 60, ang: 65, part: 'chest', lead: 1.0 }, // 싸움 꼴 0.5 s 앞 빠르기 0.58 m/s · 쪽 65° · 기울기 38°
    drive(c, t) {
      const { P, s } = c; P.move.set(s.side * 0.5, 0.7);
      s.ht ??= END; s.hold ??= 0; const o = P.handOffset; moveHand(P, s.ht, 12);
      if (Math.hypot(o.x - s.ht[0], o.y - s.ht[1]) < 1e-6) { s.hold += DT; if (s.hold > 0.4) { s.hold = 0; s.ht = s.ht === END ? CH : END; } }
    },
    trigger: (c, t) => oneUp(c.P) != null && t > c.s.lead + c.s.dly,
  },
};

/** 다리 하나의 기계 칸 (fall_context.mjs --mech 의 mechOf 와 같은 셈) */
function legMech(f, k) {
  const D = f.legDrive, g = f.gait, lim = LEGS.limit, L = D?.legs?.[k];
  if (!L) return null;
  const str = D.strengthOf(k), len = L.ph.distanceTo(L.pa);
  const c = Math.max(-1, Math.min(1, (L.lenT * L.lenT + L.lenS * L.lenS - len * len) / (2 * L.lenT * L.lenS)));
  const r = L.raw;
  return {
    on: L.on ? 1 : 0, st: g?.legs?.[k]?.stance ? 1 : 0, phi: +(Math.PI - Math.acos(c)).toFixed(3), kr: +(-r.k / Math.max(1e-6, lim.kneeExt * str)).toFixed(3),
    hs: Math.abs(r.hx) > lim.hipAbd * str || Math.abs(r.hy) > lim.hipRot * str || Math.abs(r.hz) > lim.hipFlex * str ? 1 : 0,
    as: r.az > lim.anklePlantar * str || r.az < -lim.ankleDorsi * str || Math.abs(r.ax) > lim.ankleInv * str ? 1 : 0,
  };
}

/** 장면 하나 · 씨앗 하나 */
export function runScene(key, seed, over = {}) {
  const S = SCENES[key], B = { ...S.base, ...over };
  const weapon = S.weapons[seed % S.weapons.length];
  const G = H.newRound({ walls: false, weapon, seed: 5000 + seed });
  G.park();
  const P = G.player;
  P.strength = 0.65; P.aiControlled = true; // 싸움의 AI 몸과 같게
  const R = rng(7000 + seed * 7919 + key.charCodeAt(0) * 104729);
  const s = { lead: B.lead + 0.4 * R(), dly: 0.15 * R(), side: R() < 0.5 ? -1 : 1, hitAt: null, back: B.back };
  const J = B.J * (0.8 + 0.4 * R()), ang0 = B.ang * (key === 'B' ? 1 : s.side) + (R() - 0.5) * 40; // 옆 쪽(±) 은 씨앗마다 · 크기 ±20 % · 쪽 ±20°
  const c = { G, P, s, R };
  P.handOffset.set(CH[0], CH[1]);
  const bs = over.healthy ? [1, 1] : BODYSTATE[key][seed % BODYSTATE[key].length]; setBody(P, bs[0], bs[1]);
  const settle = Math.round((2.0 + 0.2 * R()) / DT);
  for (let i = 0; i < settle; i++) { P.move.set(0, 0); G.step(); }
  // why: Fighter.knockDown 을 감싸 넘어진 가지를 적음 (fall_context 와 같음)
  let why = null; const oK = P.knockDown;
  P.knockDown = function (heavy) { if (this.state === 'stand') { const tilt = this.tiltDeg() - (this.hunch || 0) / D2R; why = tilt > BODY.fallTiltDeg ? 'tilt' : this.balance <= 0 ? 'balance0' : this.offBalanceTime > BALANCE.fallDelay ? 'footing' : this.sitTime > (BALANCE.sitDelay ?? 9) ? 'sit' : this.legsCannotSupport ? 'legs' : 'other'; } return oK.call(this, heavy); };
  const ring = [], RING = Math.round(3.0 / DT);
  const maxT = s.lead + 1.0 + 3.0, n = Math.round(maxT / DT);
  let fell = false, tFall = null, lowFor = 0, tiltFor = 0, steadyRun = 0, tSteady = null;
  const sw = {}, steps = []; let deep = 0, nPost = 0, kOver = 0, hOver = 0, aOver = 0, prevSt = 'stand';
  for (let i = 0; i < n; i++) {
    const t = i * DT;
    S.drive(c, t);
    if (s.hitAt == null && t >= s.lead && (S.trigger(c, t) || t >= s.lead + 1.0)) { if (J > 0) hit(P, B.part, J, ang0); s.hitAt = t; }
    G.step();
    const st = P.state, g = P.gait, D = P.legDrive, pp = P.bodies.pelvis.translation();
    const fw = P.forward(new H.THREE.Vector3()), com = P.com ?? pp, cv = P.comVel ?? { x: 0, z: 0 };
    const kF = legMech(P, 'F'), kB = legMech(P, 'B');
    const w0 = D?.w0 || 3.3, cpx = com.x + cv.x / w0, cpz = com.z + cv.z / w0;
    const row = { t, st, tilt: P.tiltDeg(), y: pp.y, cap: D?.capDist ?? 0, off: P.offBalance ?? 0, F: g?.legs?.F?.stance ? null : g?.legs?.F?.kind ?? null, B: g?.legs?.B?.stance ? null : g?.legs?.B?.kind ?? null, h: g?.h ?? 0, kF, kB, aidT: D ? +Math.min(1, Math.hypot(D.rem.x, D.rem.z) / (CFG.AID?.tiltMax ?? 1e9)).toFixed(2) : 0, stroke: s.ht ? 'cut' : 'windup', reqK: g?.req?.kind ?? null, vf: cv.x * fw.x + cv.z * fw.z, vr: cv.x * -fw.z + cv.z * fw.x };
    ring.push(row); if (ring.length > RING) ring.shift();
    if (over.trace && i % 6 === 0) { const L = (l) => (l ? `${l.on}${(l.phi / D2R).toFixed(0)}° kr${l.kr.toFixed(1)}` : '-'); console.log(`      ${t.toFixed(2)} ${st} y ${pp.y.toFixed(2)} h ${row.h.toFixed(2)} v ${row.vf.toFixed(2)},${row.vr.toFixed(2)} sw ${row.F ?? '-'}/${row.B ?? '-'} kF ${L(kF)} kB ${L(kB)} cap ${row.cap.toFixed(2)} tilt ${row.tilt.toFixed(0)} str ${P.strength} mus ${(P.muscle ?? 1).toFixed(2)}${s.hitAt != null && Math.abs(s.hitAt - t) < 0.01 ? ' ← 침' : ''}`); }
    if (s.hitAt != null && !fell) {
      // 걸음: 뜰 때 그 발 자리 · 캡처 점 → 디딜 때 자리 · 날아간 시간 · 디딘 다리 무릎
      for (const k of ['F', 'B']) {
        const up = g?.legs?.[k] && !g.legs[k].stance, fp = P.bodies['foot' + k].translation();
        if (up && !sw[k]) sw[k] = { t0: t, p0: { x: fp.x, z: fp.z }, need: Math.hypot(cpx - fp.x, cpz - fp.z), kind: g.legs[k].kind };
        else if (!up && sw[k]) { const w = sw[k]; steps.push({ kind: w.kind, leg: k, flight: +(t - w.t0).toFixed(3), taken: +Math.hypot(fp.x - w.p0.x, fp.z - w.p0.z).toFixed(3), need: +w.need.toFixed(3), knee: +((k === 'F' ? kF : kB)?.phi / D2R).toFixed(0), capAfter: null, at: +(t - s.hitAt).toFixed(3) }); sw[k] = null; }
      }
      for (const x of steps) if (x.capAfter == null && t - s.hitAt - x.at >= 0.05) x.capAfter = +(D?.capDist ?? 0).toFixed(3);
      nPost++;
      const on = [kF, kB].filter((l) => l && l.on);
      for (const l of on) deep = Math.max(deep, l.phi / D2R);
      if (on.some((l) => l.kr > 1)) kOver++; if (on.some((l) => l.hs)) hOver++; if (on.some((l) => l.as)) aOver++;
      const steady = kF?.on && kB?.on && !((D?.capDist ?? 0) > 0) && Math.hypot(cv.x, cv.z) < 0.25;
      steadyRun = steady ? steadyRun + DT : 0;
      if (tSteady == null && steadyRun >= 0.3) tSteady = +(t - s.hitAt - 0.3).toFixed(2);
    }
    lowFor = pp.y < 0.5 ? lowFor + DT : 0; tiltFor = row.tilt > 60 ? tiltFor + DT : 0;
    if ((prevSt === 'stand' && (st === 'down' || st === 'getup' || st === 'kneel' || st === 'dead')) || lowFor > 0.25 || tiltFor > 0.25) { fell = true; tFall = +(t - (s.hitAt ?? t)).toFixed(2); break; }
    prevSt = st;
    if (s.hitAt != null && t - s.hitAt >= 3.0) break;
  }
  let cause = null, mech = null;
  if (fell) {
    const Rs = ring.slice(0, -1).filter((x) => x.st === 'stand'), N = Rs.length;
    let on = N; while (on > 0 && (Rs[on - 1].off > 0 || Rs[on - 1].tilt > 30)) on--; if (on >= N) on = Math.max(0, N - 1);
    const rec = { onsetBefore: +((N - on) * DT).toFixed(2), afterGetup: false, sinceStand: 99, why: why ?? (P.state === 'stand' ? 'low' : 'other') };
    mech = classify(rec, ring.filter((_, k) => k % 2 === (ring.length - 1) % 2));
    cause = mech.cause;
  }
  try { G.world.free(); } catch { /* */ }
  const ratio = steps.filter((x) => x.need > 0.02).map((x) => x.taken / x.need);
  return {
    scene: key, seed, weapon, hp: bs[0], mus: bs[1], J: +J.toFixed(1), ang: +ang0.toFixed(0), hitAt: s.hitAt != null ? +s.hitAt.toFixed(2) : null, fell, tFall, cause, why, tSteady,
    nSteps: steps.length, steps, stepRatio: med(ratio), flight: med(steps.map((x) => x.flight)), kneeTD: med(steps.map((x) => x.knee)), kneeDeep: +deep.toFixed(0),
    kneeOver: +(kOver / Math.max(1, nPost)).toFixed(3), hipOver: +(hOver / Math.max(1, nPost)).toFixed(3), ankleOver: +(aOver / Math.max(1, nPost)).toFixed(3),
  };
}

export const parseSeeds = (x) => String(x).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const a = +m[1], b = +m[2]; return Array.from({ length: b - a + 1 }, (_, i) => a + i); });
export function summarize(key, rs) {
  const f = rs.filter((r) => r.fell), cnt = {};
  for (const r of f) cnt[r.cause] = (cnt[r.cause] ?? 0) + 1;
  return {
    scene: key, name: SCENES[key].name, cause: SCENES[key].cause, n: rs.length, recovered: rs.length - f.length, recovery: +((rs.length - f.length) / rs.length).toFixed(3), fellShare: +(f.length / rs.length).toFixed(3),
    sameCause: f.length ? +((cnt[SCENES[key].cause] ?? 0) / f.length).toFixed(3) : null, causes: cnt,
    tSteady: med(rs.filter((r) => !r.fell).map((r) => r.tSteady)), stepRatio: med(rs.map((r) => r.stepRatio)), flight: med(rs.map((r) => r.flight)), kneeTD: med(rs.map((r) => r.kneeTD)), kneeDeep: med(rs.map((r) => r.kneeDeep)),
    kneeOver: med(rs.map((r) => r.kneeOver)), hipOver: med(rs.map((r) => r.hipOver)), ankleOver: med(rs.map((r) => r.ankleOver)), tFall: med(f.map((r) => r.tFall)), nSteps: med(rs.map((r) => r.nSteps)),
  };
}
export const fmt = (x, d = 2) => (x == null || !isFinite(x) ? '-' : (+x).toFixed(d));
export function line(m) {
  const cs = Object.entries(m.causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '-';
  return `  ${m.scene} ${m.name.padEnd(16)} 버팀 ${String(m.recovered).padStart(2)}/${m.n} (${fmt(100 * m.recovery, 0)} %) · 넘어짐 원인 ${cs} (같은 원인 ${m.sameCause == null ? '-' : fmt(100 * m.sameCause, 0) + ' %'}) · 자리 잡음 ${fmt(m.tSteady)} s · 걸음 ${fmt(m.nSteps, 0)} · 디딘÷필요 ${fmt(m.stepRatio)} · 날아간 ${fmt(m.flight)} s · 디딜 때 무릎 ${fmt(m.kneeTD, 0)}° · 가장 깊은 무릎 ${fmt(m.kneeDeep, 0)}° · 한도 넘은 몫 무릎 ${fmt(m.kneeOver)} 엉덩이 ${fmt(m.hipOver)} 발목 ${fmt(m.ankleOver)} · 넘어진 때 ${fmt(m.tFall)} s`;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const keys = String(args.scenes ?? 'A,C').split(',');
  const seeds = parseSeeds(args.seeds ?? '0-39');
  const over = {}; for (const k of ['J', 'ang', 'lead', 'back']) if (args[k] != null) over[k] = +args[k]; if (args.part) over.part = String(args.part); if (args.trace) over.trace = true; if (args.healthy) over.healthy = true;
  const out = { root: basename(ROOT), seeds: String(args.seeds ?? '0-39'), over, scenes: {} };
  for (const k of keys) {
    const rs = seeds.map((sd) => runScene(k, sd, over));
    if (args.rows) for (const r of rs) console.log(`    ${k} #${r.seed} ${r.weapon.padEnd(10)} J ${r.J} ang ${r.ang} 침 ${r.hitAt} → ${r.fell ? `넘어짐 ${r.tFall} s ${r.cause} (${r.why})` : `버팀 · 자리 잡음 ${r.tSteady}`} · 걸음 ${r.steps.map((x) => `${x.kind}:${x.leg} ${fmt(x.taken)}/${fmt(x.need)} ${fmt(x.flight)}s 무릎${x.knee}`).join(' | ')} · 깊은 무릎 ${r.kneeDeep} · 한도 무릎 ${r.kneeOver} 엉덩이 ${r.hipOver} 발목 ${r.ankleOver}`);
    const m = summarize(k, rs);
    console.log(line(m));
    out.scenes[k] = { ...m, runs: rs.map(({ steps, ...r }) => r) };
  }
  if (args.json) writeFileSync(String(args.json), JSON.stringify(out, null, 1));
}
