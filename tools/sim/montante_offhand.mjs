// ─────────────────────────────────────────────────────────────
//  montante_offhand.mjs — 두 손 칼 빈손 쥠 계기 (10/10 몬탄테 빈손 ① — docs/motion/iberian_montante_2026-10-10.md §11)
//   AI 대 AI (시험 칼 = 기본 AI, 인물 없음 → 그 무기의 유파 꾸러미 · 상대 롱소드 AI). 본판 길(MOTION.lib 켬) 그대로. 판마다 20 s.
//   씨앗 두 묶음: A = 6~29 (24 판 = 480 s) · B = 100~105 (6 판 = 120 s). 시험 칼은 플레이어 자리(index 0), 씨앗 = 판 씨앗.
//   읽기만 한다 (물리·난수 무관 — fighter.offHand 가 둔 gripping 을 읽고, 쥔 손~쥘 자리 거리는 같은 식으로 스텝 뒤에 다시 잰다)
//
//   서 있음 = state 'stand' · 칼 쥠 · muscle > 0.3 · 빈팔 > 0.3 (offHand 가 쥐려 하는 조건 — 다쳐서 놓는 것은 뺀다)
//   쥔 몫 = 서 있는 스텝 가운데 gripping · 놓침 = 서 있는 채 gripping 참 → 거짓 · 못 쥔 몫 = 1 − 쥔 몫
//   쥔 손~쥘 자리 = 빈손(아래팔 끝 0.135) ↔ 칼 위 gripAlong 점 거리 (서 있는 스텝) · 칼 떨림 = |Δω| / 스텝 (칼 각속도 바뀐 크기, rad/s)
//   판마다 칼끝 최고 빠르기 (서 있는 동안 칼 몸의 칼끝 점 속도, m/s — 차분 tipVel 은 칼을 놓치거나 되살 때 튄다) · 가슴 거리와 맞붙는 거리(CLOSE.reach) 안 몫
//   못 쥔 몫 나눔: 놓친 뒤 되잡을 때까지의 스텝을 그 놓침의 갈래로 (서자마자 못 쥔 것은 따로)
//   (느슨히 센 놓침 — 전 계기와 정의를 맞춰 보려고: 조건 없이 gripping 참 → 거짓 · state 'stand' 만)
//   놓침 나누기: 놓치는 길(놓친 스텝에서 거슬러, 손~쥘 자리 > 0.10 m 로 이어진 스텝 — 0.25 s 안)에서 쥘 자리를 가슴 몸체 좌표(x 앞 · y 위 · z 칼 든 쪽)로 옮겨
//     ① 가슴 안쪽 = 앞 < 0.15 m (가슴 반두께 0.11 + 손 반지름 0.04) 이고 위아래 |y| < 0.40 · 옆 |z| < 0.30
//     ② 팔 밖     = 빈 어깨(가슴 기준 [0, 0.1, −0.2])에서 0.57 m 넘음 (빈팔 0.3 + 0.275 − 0.005, offArmIK 끝)
//     그 밖       = 나머지
//   놓침마다 그때 AI 자세(ai.guard 이름) · 몸에 가장 가까운 표 자세 · AI 상태(mode/phase) · 기술 · 칼 |ω| 를 센다
//
//   node tools/sim/montante_offhand.mjs [무기=zweihander] [--sets=A,B] [--secs=20] [--side=E] [--seeds=200-223] [--list] [--json=<파일>]
//   --side=E: 시험 칼을 상대 자리(index 1, ai)에 · --list: 놓침 하나씩. 설정 바꿈은 with_config.mjs 나 스위치 환경 인자(MONTANTE_HAND=old 등)로 감싼다
// ─────────────────────────────────────────────────────────────
import { newRound, THREE, DT, AI, CONFIG } from './harness_m.mjs';
import { writeFileSync } from 'node:fs';
import { getWeapon } from '../../src/weapons.js';

const args = {};
const pos = [];
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args[m[1]] = m[2] ?? true;
  else pos.push(a);
}
const WID = pos[0] || 'zweihander';
const SECS = +(args.secs ?? 20);
const SETS = { A: Array.from({ length: 24 }, (_, i) => 6 + i), B: Array.from({ length: 6 }, (_, i) => 100 + i) };
if (args.seeds) { const [a, b] = String(args.seeds).split('-').map(Number); SETS.X = Array.from({ length: b - a + 1 }, (_, i) => a + i); } // --seeds=200-223: 묶음 X (잡음 폭 재기)
const USE = String(args.sets ?? (args.seeds ? 'X' : 'A,B')).split(',');
const WIN = Math.round(0.25 / DT); // 놓침 나누기 창 (스텝)

const _q = new THREE.Quaternion(), _qi = new THREE.Quaternion();
const _p = new THREE.Vector3(), _h = new THREE.Vector3(), _l = new THREE.Vector3();
const q4 = (r, out) => out.set(r.x, r.y, r.z, r.w);

function pct(a, p) {
  if (!a.length) return NaN;
  const s = Float64Array.from(a).sort();
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}

function runSet(seeds) {
  const R = { steps: 0, held: 0, drops: 0, dist: [], dw: [], tipMax: [], cls: { in: 0, out: 0, other: 0 }, dropsAny: 0, dropsSt: 0, missBy: { in: 0, out: 0, other: 0, start: 0 }, inSteps: 0, foeD: [], inside: 0, by: {}, list: [], gaps: [] };
  const bump = (k, v) => { const B = (R.by[k] ||= {}); B[v] = (B[v] || 0) + 1; };
  for (const seed of seeds) {
    const onE = args.side === 'E';
    const G = newRound({ walls: true, seed, weapon: onE ? 'longsword' : WID, weapon2: onE ? WID : 'longsword', difficulty: 'normal', AI2Class: AI, difficulty2: 'normal' });
    const X = onE ? G.enemy : G.player;
    const XA = onE ? G.ai : G.ai2;
    const along = X.weaponCfg.gripAlong;
    let prevHeld = null, prevW = null, tip = 0, dropT = -1, prevAny = null, curCls = null;
    const ring = [];
    for (let i = 0; i < SECS / DT; i++) {
      G.step();
      const stand = X.state === 'stand' && X.armed && X.weaponCfg.twoHand && X.muscle > 0.3 && X.limbs.armO > 0.3;
      const w = X.sword.angvel();
      // 느슨한 놓침 (점검): 조건 없이 gripping 참 → 거짓 · state 'stand' 만
      { const g = !!X.gripping; if (prevAny === true && !g) R.dropsAny++; if (prevAny === true && !g && X.state === 'stand') R.dropsSt++; prevAny = g; }
      if (!stand) { prevHeld = null; prevW = null; ring.length = 0; curCls = null; continue; }
      if (prevW) R.dw.push(Math.hypot(w.x - prevW.x, w.y - prevW.y, w.z - prevW.z));
      prevW = { x: w.x, y: w.y, z: w.z };
      // 칼끝 빠르기: 칼 몸 속도의 칼끝 점 (차분 tipVel 은 칼을 놓치거나 되살 때 튄다)
      { const bp = X.bladePoint(1, _h); const v = X.sword.velocityAtPoint({ x: bp.x, y: bp.y, z: bp.z }); const tv = Math.hypot(v.x, v.y, v.z); if (Number.isFinite(tv)) tip = Math.max(tip, tv); }
      R.steps++;
      // 가슴 거리 (맞붙는 거리 CLOSE.reach 안 몫 — 10/10 오른손 날밑: hiltLength 가 바뀌면 이 문턱이 바뀐다)
      { const d = X.foeDistance(); R.foeD.push(d); if (d <= CONFIG.CLOSE.reach(X.weapon)) R.inside++; }
      const held = !!X.gripping;
      if (held) R.held++;
      if (held && dropT >= 0) { R.gaps.push(G.t - dropT); dropT = -1; }
      // 쥘 자리 · 빈손 (fighter.offHand 와 같은 식, 스텝 뒤 자리)
      const st = X.sword.translation();
      _p.set(0, along, 0).applyQuaternion(q4(X.sword.rotation(), _q)).add(_l.set(st.x, st.y, st.z));
      const ft = X.bodies.farmO.translation();
      _h.set(0, -0.135, 0).applyQuaternion(q4(X.bodies.farmO.rotation(), _q)).add(_l.set(ft.x, ft.y, ft.z));
      const dd = _h.distanceTo(_p);
      R.dist.push(dd);
      // 쥘 자리의 가슴 몸체 좌표 → 이 스텝의 자리 (in 가슴 안쪽 · out 팔 밖 · mid)
      const c = X.bodies.chest.translation();
      q4(X.bodies.chest.rotation(), _qi).invert();
      const loc = _l.set(_p.x - c.x, _p.y - c.y, _p.z - c.z).applyQuaternion(_qi);
      const fx = loc.x, fy = loc.y, fz = loc.z * X.side; // z: + = 칼 든 쪽
      const sh = Math.hypot(fx, fy - 0.1, fz + 0.2);
      const zone = fx < 0.15 && Math.abs(fy) < 0.4 && Math.abs(fz) < 0.3 ? 'in' : sh > 0.57 ? 'out' : 'mid';
      const wl = Math.hypot(w.x, w.y, w.z);
      const ni = X.guardPose?.nearest;
      const nName = (ni >= 0 ? X.guardPose.table?.[ni]?.name : null) ?? (ni >= 0 ? `#${ni}` : '-');
      ring.push({ zone, wl, nName, fx, fy, fz, sh, dd });
      if (zone === 'in') R.inSteps++;
      if (ring.length > WIN) ring.shift();
      if (!held && prevHeld !== true) R.missBy[curCls ?? 'start']++; // 놓친 뒤 이어서 못 쥔 스텝 → 그 놓침의 갈래 (서기 시작부터 못 쥔 것은 start)
      if (prevHeld === true && !held) {
        R.drops++;
        dropT = G.t;
        // 놓치는 길(아래)에서 쥘 자리가 가슴 안쪽에 든 적이 있으면 ①, 아니면 팔 밖에 나간 적이 있으면 ②, 둘 다 아니면 그 밖
        // 놓치는 길 = 놓친 스텝에서 거슬러 손이 쥘 자리에서 0.10 m 넘게 떨어져 있던 이어진 스텝 (창 0.25 s 안)
        let k = ring.length - 1;
        while (k > 0 && ring[k - 1].dd > 0.1) k--;
        const run = ring.slice(k);
        const inR = run.find((r) => r.zone === 'in');
        const outR = run.find((r) => r.zone === 'out');
        const cls = inR ? 'in' : outR ? 'out' : 'other';
        const at = inR ?? outR ?? ring[ring.length - 1];
        const wPk = Math.max(...run.map((r) => r.wl));
        curCls = cls;
        R.missBy[cls]++;
        R.cls[cls]++;
        const gName = XA.guard?.name ?? '-';
        const mode = XA.mode === 'attack' ? `attack:${XA.phase}` : XA.mode;
        bump(`guard:${cls}`, gName);
        bump(`near:${cls}`, at.nName);
        bump(`mode:${cls}`, mode);
        bump(`tech:${cls}`, XA.mode === 'attack' || XA.mode === 'secret' ? XA.tech?.name ?? '?' : '-');
        bump(`w:${cls}`, wPk < 10 ? '<10' : wPk < 20 ? '10~20' : wPk < 35 ? '20~35' : '35+');
        R.list.push(`s${seed} t ${G.t.toFixed(2)} ${cls} 앞 ${at.fx.toFixed(2)} 위 ${at.fy.toFixed(2)} 옆 ${at.fz.toFixed(2)} 어깨 ${at.sh.toFixed(2)} | AI 자세 ${gName} · 몸 ${at.nName} (놓칠 때 ${nName}) · ${mode} ${XA.tech?.name ?? ''} · |ω| 창 최고 ${wPk.toFixed(1)}`);
      }
      if (held) curCls = null;
      prevHeld = held;
    }
    R.tipMax.push(tip);
  }
  return R;
}

const out = {};
for (const k of USE) {
  const seeds = SETS[k];
  const R = runSet(seeds);
  const held = R.held / Math.max(1, R.steps);
  const s = {
    seeds: `${seeds[0]}~${seeds[seeds.length - 1]}`, secs: seeds.length * SECS,
    heldPct: +(100 * held).toFixed(1), missPct: +(100 * (1 - held)).toFixed(1), drops: R.drops,
    cls: R.cls, distP50: +pct(R.dist, 0.5).toFixed(3), distP90: +pct(R.dist, 0.9).toFixed(3),
    dwP50: +pct(R.dw, 0.5).toFixed(2), dwP99: +pct(R.dw, 0.99).toFixed(1),
    foeP50: +pct(R.foeD, 0.5).toFixed(2), insidePct: +(100 * R.inside / Math.max(1, R.steps)).toFixed(1),
    tipMean: +(R.tipMax.reduce((a, b) => a + b, 0) / R.tipMax.length).toFixed(1), tipMax: +Math.max(...R.tipMax).toFixed(1),
    gapP50: R.gaps.length ? +pct(R.gaps, 0.5).toFixed(2) : null, gapP90: R.gaps.length ? +pct(R.gaps, 0.9).toFixed(2) : null,
    missBy: Object.fromEntries(Object.entries(R.missBy).map(([k, v]) => [k, +(100 * v / Math.max(1, R.steps)).toFixed(2)])),
    by: R.by,
  };
  out[k] = s;
  console.log(`${WID} 빈손 [${k}] 씨앗 ${s.seeds} × ${SECS} s (${s.secs} s): 쥔 몫 ${s.heldPct} % · 못 쥔 ${s.missPct} % · 놓침 ${s.drops} (① 가슴 안쪽 ${R.cls.in} · ② 팔 밖 ${R.cls.out} · 그 밖 ${R.cls.other}) · 되잡기 p50/p90 ${s.gapP50}/${s.gapP90} s · (느슨히 센 놓침: 조건 없이 ${R.dropsAny} · state stand ${R.dropsSt})`);
  console.log(`   가슴 거리 p10/p50 ${pct(R.foeD, 0.1).toFixed(2)}/${pct(R.foeD, 0.5).toFixed(2)} m · 맞붙는 거리(CLOSE.reach ${CONFIG.CLOSE.reach(getWeapon(WID)).toFixed(3)} m) 안 몫 ${(100 * R.inside / Math.max(1, R.steps)).toFixed(1)} %`);
  console.log(`   쥘 자리가 가슴 안쪽에 든 몫 (서 있는 동안) ${(100 * R.inSteps / Math.max(1, R.steps)).toFixed(1)} %`);
  console.log(`   못 쥔 몫 나눔: ① ${(100 * R.missBy.in / Math.max(1, R.steps)).toFixed(2)} % · ② ${(100 * R.missBy.out / Math.max(1, R.steps)).toFixed(2)} % · 그 밖 ${(100 * R.missBy.other / Math.max(1, R.steps)).toFixed(2)} % · 서자마자 못 쥠 ${(100 * R.missBy.start / Math.max(1, R.steps)).toFixed(2)} %`);
  console.log(`   쥔 손~쥘 자리 p50/p90 ${s.distP50}/${s.distP90} m · 칼 떨림 |Δω|/스텝 p50/p99 ${s.dwP50}/${s.dwP99} rad/s · 판마다 칼끝 최고 평균/최대 ${s.tipMean}/${s.tipMax} m/s`);
  const top = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${v}`).join(' · ');
  for (const c of ['in', 'out', 'other']) {
    if (!R.cls[c]) continue;
    console.log(`   ${c === 'in' ? '①' : c === 'out' ? '②' : '그 밖'}: 자세 ${top(R.by[`guard:${c}`])} | 몸 ${top(R.by[`near:${c}`])} | 상태 ${top(R.by[`mode:${c}`])} | 기술 ${top(R.by[`tech:${c}`])} | |ω| ${top(R.by[`w:${c}`])}`);
  }
  if (args.list) for (const l of R.list) console.log(`     ${l}`);
}
if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
