// ─────────────────────────────────────────────────────────────
//  joint_range.mjs — 칼 든 팔의 관절 각을 스텝마다 재어, 해부학 범위 밖 비율을 공격 중 / 간 보기 중 / 넘어짐 중으로 나눈다 (10/9 관절 가동 범위)
//   다른 시뮬을 감싼다 (envelope_check.mjs 와 같은 방식: Fighter.prototype.cacheState 를 감싸 읽기만 — 감싼 stdout 은 한 글자도 안 바뀐다).
//     node tools/sim/joint_range.mjs motion_lab.mjs duel longsword 24 main      (48 판 결투)
//     JOINTS=anat node tools/sim/joint_range.mjs motion_lab.mjs duel rapier 24 main   (교정안 켬, config JOINTS)
//     JR_JSON=<파일> 이면 표를 json 으로도 쓴다. 표는 stderr.
//   각 (몸체 좌표에서 곧장, 가슴 몸 틀: x 앞, y 위, z 칼 든 쪽):
//     elbow   = 칼 팔꿈치 굽힘 (°, 위팔 x → 아래팔 x 를 경첩 축 z(위팔 몸) 둘레로 잰 부호 있는 각). + 굽힘, − 과신전. 명령값(armIK 목표)도 함께
//     shElev  = 어깨 들림 (위팔과 아래 방향 사이 각, 0 = 늘어뜨림, 180 = 곧게 위)
//     shBack  = 어깨 뒤로 젖힘 (위팔이 가슴 관상면 뒤로 나간 각, asin(−u·x)) — 폄 60° 와 견줌
//     shPlane = 들림 면 atan2(앞, 바깥) (들림 60~160° 표본만, envelope_check 와 같은 가름)
//     shRot   = 위팔 돌림 (들림 120° 아래만. 경첩 축 z(위팔) 이 '늘어뜨린 팔 · 아래팔 앞' 기준에서 최단 호로 옮긴 축과 이루는 각, 위팔 둘레, + 바깥 돌림)
//     wristFE = 손목 굽힘·폄 (칼날 축이 아래팔 경첩 면(x·y) 밖으로 나간 각, asin(b·z_아래팔). 쥔 자세에서 0)
//     wristDev= 아래팔-칼 면 안 각 atan2(b·y, b·x) (자루가 손바닥을 비스듬히 가로질러 기준이 무기마다 달라 참고 수)
//     wrist   = 아래팔-칼날 사이 각 (envelope_check wrist 와 같은 정의, 설계 칸 163°)
//   해부학 범위 (출처):
//     팔꿈치 굽힘 0~145°, 과신전 5° 안 — AAOS, "Joint Motion: Method of Measuring and Recording"(1965) 0~150 · Soucie 외 2011
//       (Haemophilia 17:500, 정상 남자 굽힘 평균 약 144) · 과신전 0~5 (Norkin & White, "Measurement of Joint Motion")
//     어깨 굽힘 180 · 폄 60 · 벌림 180 · 안쪽 돌림 70 · 바깥 돌림 90 — AAOS (1965)
//     손목 굽힘 80 · 폄 70 → 둘 다 ±70 으로 (AAOS 1965: 굽힘 80, 폄 70)
//     '쭉 뻗음' (해부학 밖은 아니나 사장님 지적): 팔꿈치 굽힘 < 10° — 결투에서 칼을 쥐고 칠 때의 살짝 굽힘(15~30°)보다 곧음
//   가름: 넘어짐 중 = state ≠ 'stand' · 공격 중 = skill.swinging 또는 skill.activity > 0.5 또는 찌르기 덧씌움 > 0.05 · 그 밖 = 간 보기 중
//   판 시작 0.5 s 뒤부터 (envelope_check SETTLE_S 와 같음). 칼을 놓치면 손목 칸은 건너뛴다
//   관절 폭발: 칼 팔(위팔·아래팔) 각속도 > 80 rad/s 인 스텝 · NaN 스텝
// ─────────────────────────────────────────────────────────────
//   브라우저에서도 불러 쓴다 (tools/browser/joint_shots.mjs 가 armAngles 를 그대로 읽는다) → node 전용 모듈은 직접 실행일 때만 부른다
const NODE = typeof process !== 'undefined' && !!process.argv?.[1];
const { isMain, simPath } = NODE ? await import('./is_main.mjs') : { isMain: () => false, simPath: null };

const R2D = 180 / Math.PI;
const SETTLE_S = 0.5;
const SPIN = 80; // rad/s
const BLADE_SPIN = 60; // rad/s 칼날 축 둘레 (정상 날 세우기는 10~30)
export const LIMITS = {
  elbowHyper: { lo: -5, src: '팔꿈치 과신전 > 5° (Norkin & White 0~5)' },
  elbowFlex: { hi: 145, src: '팔꿈치 굽힘 > 145° (AAOS 150 · Soucie 2011 약 144)' },
  shBack: { hi: 60, src: '어깨 폄(뒤로) > 60° (AAOS)' },
  shPlane: { lo: -45, hi: 130, src: '수평 벌림 45 · 모음 130 (AAOS, 들림 60~160)' },
  shRotIn: { lo: -70, src: '위팔 안쪽 돌림 > 70° (AAOS)' },
  shRotOut: { hi: 90, src: '위팔 바깥 돌림 > 90° (AAOS)' },
  wristFE: { lo: -70, hi: 70, src: '손목 굽힘·폄 ±70° (AAOS 80/70)' },
  wrist163: { hi: 163, src: '아래팔-칼 > 163° (설계 칸, HUMAN.gripFlex)' },
};
const STRAIGHT = 10; // °
const TWIST_LAG = 45; // ° 위팔 돌림이 armIK 명령에서 이만큼 넘게 벗어난 스텝 = '덜렁거림' (팔꿈치가 엉뚱한 쪽을 봄)
const ROT_ELEV = 120; // ° 위팔 돌림은 들림 이 아래 표본만 (탐침: 들림 120° 위에선 armIK 명령 자체가 이 기준으로 28~58 % 밖 — 기준 탓)

// ── 작은 벡터·쿼터니언 (배열) ──
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const crs = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const Q = (r) => [r.x, r.y, r.z, r.w];
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]];
const qrot = (q, v) => {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]), ty = 2 * (z * v[0] - x * v[2]), tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
};
const signedAbout = (a, b, axis) => Math.atan2(dot(crs(a, b), axis), dot(a, b)) * R2D;
/** 최단 호로 a → b 돌린 뒤의 v (a, b 단위) */
function swing(a, b, v) {
  const c = dot(a, b);
  const ax = crs(a, b);
  const s = Math.hypot(ax[0], ax[1], ax[2]);
  if (s < 1e-9) return c > 0 ? v : [v[0], -v[1], -v[2]]; // 반대: x 둘레 반 바퀴(어림)
  const k = [ax[0] / s, ax[1] / s, ax[2] / s];
  const th = Math.atan2(s, c);
  const kv = crs(k, v), kd = dot(k, v);
  const ct = Math.cos(th), st = Math.sin(th);
  return [v[0] * ct + kv[0] * st + k[0] * kd * (1 - ct), v[1] * ct + kv[1] * st + k[1] * kd * (1 - ct), v[2] * ct + kv[2] * st + k[2] * kd * (1 - ct)];
}

/** 한 스텝 칼 팔 각 (읽기만). 가슴 틀: x 앞, y 위, z 칼 든 쪽 × side */
export function armAngles(f) {
  const B = f.bodies;
  if (!B.uarmS || !B.farmS || !B.chest) return null;
  if (f.detachedParts?.has?.('farmS') || f.severed?.some?.((x) => x.limb === 'armS')) return null; // 칼 팔이 잘렸으면 재지 않는다
  const qc = Q(B.chest.rotation()), qu = Q(B.uarmS.rotation()), qf = Q(B.farmS.rotation());
  const ci = qinv(qc);
  const s = f.side ?? 1;
  const toC = (v) => { const r = qrot(ci, v); return [r[0], r[1], r[2] * s]; };
  const u = toC(qrot(qu, [1, 0, 0])); // 위팔 (어깨 → 팔꿈치)
  const zU = toC(qrot(qu, [0, 0, 1])); // 팔꿈치 경첩 축
  const fa = toC(qrot(qf, [1, 0, 0])); // 아래팔 (팔꿈치 → 손목)
  const o = {};
  o.elbow = signedAbout(u, fa, zU);
  const tq = f.jointByName?.farmS?.target;
  o.elbowCmd = tq ? 2 * Math.atan2(tq.z, tq.w) * R2D : null;
  o.shElev = Math.acos(Math.max(-1, Math.min(1, -u[1]))) * R2D;
  o.shBack = Math.asin(Math.max(-1, Math.min(1, -u[0]))) * R2D;
  o.shPlane = o.shElev >= 60 && o.shElev <= 160 ? Math.atan2(u[0], u[2]) * R2D : null;
  // 위팔 돌림: 기준 = 늘어뜨린 팔(아래)·아래팔 앞 → 경첩 축 = 칼 쪽 바깥 (+z). 그 축을 아래 → u 최단 호로 옮긴 r 과 실제 zU 사이 각 (u 둘레)
  o.shRot = o.shElev <= ROT_ELEV ? signedAbout(swing([0, -1, 0], u, [0, 0, 1]), zU, u) : null; // 높이 든 팔은 최단 호 기준이 방위에 따라 크게 돌아(코드먼 역설) 뺀다
  // 위팔 돌림의 '덜렁거림' = 실제 경첩 축과 armIK 명령 경첩 축(같은 위팔 방향으로 옮겨 견줌) 사이 각 (u 둘레, 부호 없음)
  const tu = f.jointByName?.uarmS?.target;
  if (tu) {
    const tq4 = [tu.x, tu.y, tu.z, tu.w];
    const uc = qrot(tq4, [1, 0, 0]), zc = qrot(tq4, [0, 0, 1]);
    const ucs = [uc[0], uc[1], uc[2] * s], zcs = [zc[0], zc[1], zc[2] * s];
    o.twistLag = Math.abs(signedAbout(swing(nrm(ucs), u, zcs), zU, u));
  } else o.twistLag = null;
  if (f.sword && f.armed !== false) {
    const b = qrot(qinv(qf), qrot(Q(f.sword.rotation()), [0, 1, 0])); // 칼날 축, 아래팔 몸 틀
    o.wristFE = Math.asin(Math.max(-1, Math.min(1, b[2]))) * R2D;
    o.wristDev = Math.atan2(b[1], b[0]) * R2D;
    o.wrist = Math.acos(Math.max(-1, Math.min(1, b[0]))) * R2D;
  } else o.wristFE = o.wristDev = o.wrist = null;
  const wu = B.uarmS.angvel(), wf = B.farmS.angvel();
  o.spin = Math.max(Math.hypot(wu.x, wu.y, wu.z), Math.hypot(wf.x, wf.y, wf.z));
  // 칼날 축 둘레 돌림 빠르기 (rad/s, 날 세우기 힘이 안정 한계를 넘으면 이 축이 팽이처럼 돈다 — 10/9 3차)
  if (f.sword && f.armed !== false) { const ws = f.sword.angvel(); const bq = qrot(Q(f.sword.rotation()), [0, 1, 0]); o.bladeSpin = Math.abs(ws.x * bq[0] + ws.y * bq[1] + ws.z * bq[2]); } else o.bladeSpin = null;
  // 빈팔 팔꿈치 (두 손 무기는 칼자루 끝을 쥔다): 뼈가 몸 −y 를 따라 누움, 같은 경첩 z
  if (B.uarmO && B.farmO && !f.severed?.some?.((x) => x.limb === 'armO')) {
    const qo = Q(B.uarmO.rotation());
    o.elbowO = signedAbout(qrot(qo, [0, -1, 0]), qrot(Q(B.farmO.rotation()), [0, -1, 0]), qrot(qo, [0, 0, 1]));
  } else o.elbowO = null;
  o.nan = ![o.elbow, o.shElev, o.spin].every(Number.isFinite);
  return o;
}

/** 가름: 'down' | 'attack' | 'watch' */
export function phaseOf(f) {
  if (f.state !== 'stand') return 'down';
  const sk = f.skill;
  if (sk && (sk.swinging || (sk.activity ?? 0) > 0.5 || (sk.thrustPose?.w ?? 0) > 0.05)) return 'attack';
  return 'watch';
}

/** 범위 밖 세기 — 몫마다 */
export function outKeys(o) {
  const k = [];
  if (o.elbow < LIMITS.elbowHyper.lo) k.push('elbowHyper');
  if (o.elbow > LIMITS.elbowFlex.hi) k.push('elbowFlex');
  if (o.shBack > LIMITS.shBack.hi) k.push('shBack');
  if (o.shPlane != null && (o.shPlane < LIMITS.shPlane.lo || o.shPlane > LIMITS.shPlane.hi)) k.push('shPlane');
  if (o.shRot != null && o.shRot < LIMITS.shRotIn.lo) k.push('shRotIn');
  if (o.shRot != null && o.shRot > LIMITS.shRotOut.hi) k.push('shRotOut');
  if (o.wristFE != null && (o.wristFE < LIMITS.wristFE.lo || o.wristFE > LIMITS.wristFE.hi)) k.push('wristFE');
  if (o.wrist != null && o.wrist > LIMITS.wrist163.hi) k.push('wrist163');
  return k;
}

const PHASES = ['attack', 'watch', 'down'];
const PH_KO = { attack: '공격 중', watch: '간 보기 중', down: '넘어짐 중' };
export class JointCounter {
  constructor() {
    this.seen = new WeakMap();
    this.ph = Object.fromEntries(PHASES.map((p) => [p, { n: 0, any: 0, straight: 0, straightO: 0, nO: 0, twistLag: 0, nT: 0, cmdStraight: 0, out: {}, elbowSum: 0, elbows: [] }]));
    this.spin = 0;
    this.nan = 0;
    this.max = {};
  }
  add(f, dt = 1 / 120) {
    const t = (this.seen.get(f) ?? 0) + dt;
    this.seen.set(f, t);
    if ((f.fightT ?? t) < SETTLE_S) return null;
    if (f.state === 'dead') return null;
    const o = armAngles(f);
    if (!o) return null;
    if (o.nan) { this.nan++; return o; }
    const P = this.ph[phaseOf(f)];
    P.n++;
    const ks = outKeys(o);
    if (ks.length) P.any++;
    for (const k of ks) P.out[k] = (P.out[k] ?? 0) + 1;
    if (o.elbow < STRAIGHT) P.straight++;
    if (o.elbowO != null) { P.nO++; if (o.elbowO < STRAIGHT) P.straightO++; }
    if (o.twistLag != null) { P.nT++; if (o.twistLag > TWIST_LAG) P.twistLag++; }
    if (o.elbowCmd != null && o.elbowCmd < STRAIGHT) P.cmdStraight++;
    P.elbowSum += o.elbow;
    if (P.elbows.length < 400000) P.elbows.push(o.elbow);
    if (o.spin > SPIN) this.spin++;
    if (o.bladeSpin != null && o.bladeSpin > BLADE_SPIN) this.bladeSpinN = (this.bladeSpinN ?? 0) + 1;
    const mx = (k, v) => { if (v != null) this.max[k] = Math.max(this.max[k] ?? -Infinity, v); };
    mx('hyper', -o.elbow);
    mx('shBack', o.shBack);
    mx('shRotIn', o.shRot == null ? null : -o.shRot);
    mx('shRotOut', o.shRot);
    mx('wristFE', o.wristFE == null ? null : Math.abs(o.wristFE));
    mx('wrist', o.wrist);
    mx('spin', o.spin);
    mx('bladeSpin', o.bladeSpin);
    return o;
  }
  json() {
    const pct = (a, n) => (n ? +((100 * a) / n).toFixed(2) : 0);
    const qtl = (a, p) => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y); return +b[Math.floor(p * (b.length - 1))].toFixed(1); };
    const med = (a) => qtl(a, 0.5);
    const out = {};
    for (const p of PHASES) {
      const P = this.ph[p];
      out[p] = { steps: P.n, anyPct: pct(P.any, P.n), straightPct: pct(P.straight, P.n), straightOPct: pct(P.straightO, P.nO), twistLagPct: pct(P.twistLag, P.nT), cmdStraightPct: pct(P.cmdStraight, P.n), elbowMed: med(P.elbows), elbowP5: qtl(P.elbows, 0.05), elbowP95: qtl(P.elbows, 0.95), out: Object.fromEntries(Object.entries(P.out).map(([k, c]) => [k, pct(c, P.n)])) };
    }
    return { phases: out, spinSteps: this.spin, nanSteps: this.nan, bladeSpinSteps: this.bladeSpinN ?? 0, max: Object.fromEntries(Object.entries(this.max).map(([k, v]) => [k, +v.toFixed(1)])) };
  }
  table(title) {
    const J = this.json();
    const keys = Object.keys(LIMITS);
    const L = [`${title}`];
    L.push(`| 가름 | 스텝 | 범위 밖 % | 쭉 뻗음(<${STRAIGHT}°) % | 명령 쭉 뻗음 % | 빈팔 쭉 뻗음 % | 돌림 덜렁(>${TWIST_LAG}°) % | 팔꿈치 중앙 ° | ${keys.join(' | ')} |`);
    L.push(`|---|---|---|---|---|---|---|---|${keys.map(() => '---').join('|')}|`);
    for (const p of PHASES) {
      const r = J.phases[p];
      L.push(`| ${PH_KO[p]} | ${r.steps} | ${r.anyPct} | ${r.straightPct} | ${r.cmdStraightPct} | ${r.straightOPct} | ${r.twistLagPct} | ${r.elbowMed ?? '-'} | ${keys.map((k) => r.out[k] ?? 0).join(' | ')} |`);
    }
    L.push(`최대: 과신전 ${J.max.hyper ?? '-'}° · 어깨 폄 ${J.max.shBack ?? '-'}° · 안쪽 돌림 ${J.max.shRotIn ?? '-'}° · 바깥 돌림 ${J.max.shRotOut ?? '-'}° · 손목 굽힘·폄 ${J.max.wristFE ?? '-'}° · 아래팔-칼 ${J.max.wrist ?? '-'}° · 팔 각속도 ${J.max.spin ?? '-'} rad/s`);
    L.push(`관절 폭발(팔 각속도 > ${SPIN} rad/s) ${J.spinSteps} 스텝 · 칼날 축 팽이(> ${BLADE_SPIN} rad/s) ${J.bladeSpinSteps} 스텝, 최대 ${J.max.bladeSpin ?? '-'} rad/s · NaN ${J.nanSteps} 스텝`);
    L.push(Object.entries(LIMITS).map(([k, v]) => `${k} = ${v.src}`).join(' · '));
    return L.join('\n');
  }
}

// ── 칼 면 맞음 계기 (10/10 날 세우기 — docs/motion/edge_alignment_2026-10-10.md) ──
//  상처(맞음)마다 '날 각' = 칼날 방향(칼 몸 x)과 맞는 순간 상대 속도의 칼날 축에 수직인 몫이 이루는 각 (0 = 날이 똑바로 섬, 90 = 칼 면).
//  판정(combat.js analyze)과 같은 벡터: S = 스텝 전 칼 상태, r.dir = 상대 속도 방향, r.bladeAxis = 칼날 축. 칼 면 맞음 = 날 각 > EDGE_FLAT (확인표 520).
//  세는 맞음: 날 있는 무기의 칼날 부품('blade')이 새 상처를 낸 것(같은 부위 쿨다운 중 가르기 저항은 뺌), 찌르기(stab)는 칼 축으로 들어가 날 각이 없어 뺀다
export const EDGE_FLAT = 45; // °
export function edgeAngleOf(S, r) {
  const ax = r.bladeAxis, d = r.dir;
  const q = [S.q.x, S.q.y, S.q.z, S.q.w];
  const e = qrot(q, [1, 0, 0]);
  const a = [ax.x, ax.y, ax.z];
  const v = [d.x, d.y, d.z];
  const k = dot(v, a);
  const p = [v[0] - a[0] * k, v[1] - a[1] * k, v[2] - a[2] * k];
  const pl = Math.hypot(p[0], p[1], p[2]);
  if (pl < 1e-3) return null;
  return Math.acos(Math.min(1, Math.abs(dot(p, e)) / pl)) * R2D;
}
export class EdgeCounter {
  constructor() { this.by = new Map(); }
  add(key, ang, r, eScale, edgeAlign, own = null, att = null) {
    if (!this.by.has(key)) this.by.set(key, { n: 0, flat: 0, judgedFlat: 0, angs: [], e: 0, eq: 0, ownFlat: 0, ownN: 0, v: 0 });
    const B = this.by.get(key);
    B.n++;
    B.v += r.speed; // 맞는 순간 상대 속도 (m/s)
    if (ang > EDGE_FLAT) B.flat++;
    // 갈래: 칼 면 맞음 가운데 '제 칼 속도로 재도 칼 면'(날 세우기가 못 따라감)인 몫. 나머지는 제 칼은 날이 섰는데 상대 몸 움직임·막는 칼에 닿아 칼 면이 된 것
    if (ang > EDGE_FLAT && own != null) { B.ownN++; if (own > EDGE_FLAT) B.ownFlat++; }
    // 칼 면 맞음의 까닭 (제 칼 속도로도 칼 면인 것만): 굴림 목표가 아직 쉼(칼 면 오른쪽) 쪽인가(섞기 moving < 0.5) · 목표는 날인데 칼이 못 따라갔나(어긋남 > 45°)
    if (ang > EDGE_FLAT && own != null && own > EDGE_FLAT && att) { B.cRest = (B.cRest || 0) + ((att.edgeMoving ?? 1) < 0.5 ? 1 : 0); B.cLag = (B.cLag || 0) + ((att.edgeMoving ?? 1) >= 0.5 && (att.edgeLag ?? 0) > Math.PI / 4 ? 1 : 0);
      // 그 가운데 손목 굴림 밧줄(아래팔 z ↔ 칼 z, HUMAN.forearmRoll 80°)이 끝 10° 안인 것 — 아래팔 엎침·뒤침이 다 써서 못 돈 몫
      if ((att.edgeMoving ?? 1) >= 0.5 && (att.edgeLag ?? 0) > Math.PI / 4 && att.bodies?.farmS && att.sword) {
        const zf = qrot(Q(att.bodies.farmS.rotation()), [0, 0, 1]), zs = qrot(Q(att.sword.rotation()), [0, 0, 1]);
        if (Math.acos(Math.max(-1, Math.min(1, dot(zf, zs)))) * R2D > 70) B.cRope = (B.cRope || 0) + 1;
      }
    }
    const al = Math.cos(ang / R2D);
    if (al <= edgeAlign) B.judgedFlat++;
    B.angs.push(ang);
    // 빠르기 갈래 (맞는 순간 상대 속도): < 3 m/s · 3~8 · ≥ 8 — [맞음, 칼 면]
    const sb = r.speed < 3 ? 0 : r.speed < 8 ? 1 : 2;
    (B.sp ||= [[0, 0], [0, 0], [0, 0]])[sb][0]++;
    if (ang > EDGE_FLAT) B.sp[sb][1]++;
    const e = r.ephys * eScale; // 칼날이 실은 에너지 (게임 J, 판정 energy 와 같은 배율 — 둔기 배율 전)
    B.e += e;
    B.eq += al > edgeAlign ? e * (0.4 + 0.6 * ((al - edgeAlign) / (1 - edgeAlign))) : 0; // × 날 세움 (판정 quality 와 같은 식, 칼 면이면 0)
  }
  json() {
    const o = {};
    for (const [k, B] of this.by) {
      const s = [...B.angs].sort((x, y) => x - y);
      o[k] = { speedBins: B.sp ? B.sp.map(([n, f]) => `${n}:${n ? ((100 * f) / n).toFixed(0) : 0}%`).join(' ') : null, ownFlatOfFlatPct: B.ownN ? +((100 * B.ownFlat) / B.ownN).toFixed(1) : null, hits: B.n, flatPct: B.n ? +((100 * B.flat) / B.n).toFixed(1) : 0, judgedFlatPct: B.n ? +((100 * B.judgedFlat) / B.n).toFixed(1) : 0, angMed: s.length ? +s[Math.floor(s.length / 2)].toFixed(1) : null, eMean: B.n ? +(B.e / B.n).toFixed(1) : 0, eqMean: B.n ? +(B.eq / B.n).toFixed(1) : 0, vMean: B.n ? +(B.v / B.n).toFixed(2) : 0, ownFlatRest: B.cRest || 0, ownFlatLag: B.cLag || 0, ownFlatLagRope: B.cRope || 0, ownFlatN: B.ownFlat };
    }
    return o;
  }
  table() {
    const L = [`| 때린 쪽 | 칼날 맞음 | 칼 면 (> ${EDGE_FLAT}°) % | 판정 칼 면 (둔기) % | 날 각 중앙 ° | 칼날 J 평균 | × 날 세움 J 평균 | 맞는 속도 평균 m/s | 칼 면 중 제 칼 속도로도 칼 면 % | 빠르기별 맞음:칼 면 % (<3 · 3~8 · ≥8 m/s) |`, '|---|---|---|---|---|---|---|---|---|---|'];
    for (const [k, r] of Object.entries(this.json())) L.push(`| ${k} | ${r.hits} | ${r.flatPct} | ${r.judgedFlatPct} | ${r.angMed ?? '-'} | ${r.eMean} | ${r.eqMean} | ${r.vMean} | ${r.ownFlatOfFlatPct ?? '-'} | ${r.speedBins ?? '-'} |`);
    return L.join('\n');
  }
}

// ── 칼끝 방향 계기 (10/10 한손 칼끝 — docs/motion/onehand_tip_2026-10-10.md) ──
//  올림각 = 칼날 축(자루 → 칼끝)이 수평면과 이루는 각 (+ 위, − 땅 쪽) · 방위 = 칼날 축의 수평 몫과 '내 가슴 → 상대 가슴' 수평 방향 사이 각
//  (0 = 상대를 겨눔, 90 = 옆, 180 = 내 쪽, 부호 + = 칼 든 쪽) · 겨눔 어긋남 = 칼날 축과 '칼 원점 → 상대 가슴' 사이 3 차원 각
export function tipAngles(f) {
  if (!f.sword || f.armed === false || !f.foe) return null;
  const b = qrot(Q(f.sword.rotation()), [0, 1, 0]);
  const c = f.bodies.chest.translation(), fc = f.foe.bodies.chest.translation(), sp = f.sword.translation();
  const fx = fc.x - c.x, fz = fc.z - c.z, fl = Math.hypot(fx, fz) || 1;
  const hx = b[0], hz = b[2], hl = Math.hypot(hx, hz);
  const elev = Math.asin(Math.max(-1, Math.min(1, b[1]))) * R2D;
  // 수평 부호: 몸 틀 +z = 앞 × 위 = (−fz, 0, fx)/fl, 칼 든 쪽 = +z × side (armAngles 의 toC 와 같은 뜻)
  const s = f.side ?? 1;
  const az = hl > 1e-3 ? Math.atan2(s * (hx * -fz + hz * fx), hx * fx + hz * fz) * R2D : null;
  const tx = fc.x - sp.x, ty = fc.y - sp.y, tz = fc.z - sp.z, tl = Math.hypot(tx, ty, tz) || 1;
  const off = Math.acos(Math.max(-1, Math.min(1, (b[0] * tx + b[1] * ty + b[2] * tz) / tl))) * R2D;
  return { elev, az, off };
}
export class TipCounter {
  constructor() { this.by = new Map(); }
  add(key, o) {
    if (!o) return;
    if (!this.by.has(key)) this.by.set(key, { n: 0, el: 0, azAbs: 0, az: 0, off: 0, back: 0, down: 0, both: 0, lying: 0 });
    const B = this.by.get(key);
    B.n++;
    B.el += o.elev;
    if (o.az != null) { B.az += o.az; B.azAbs += Math.abs(o.az); if (Math.abs(o.az) > 90) B.back++; }
    B.off += o.off;
    if (o.elev < -30) B.down++;
    if (o.elev < -15 && o.az != null && Math.abs(o.az) > 90) B.both++; // 땅 쪽이면서 내 쪽
    if (o.elev < 45 && o.az != null && Math.abs(o.az) > 90) B.lying++; // 누운 채 내 쪽 (사장님 지적의 꼴: 칼끝이 분명히 위도 아니면서 상대 반대쪽 = 거꾸로 든 꼴)
  }
  json() {
    const o = {};
    for (const [k, B] of this.by) o[k] = { frames: B.n, elev: +(B.el / B.n).toFixed(1), az: +(B.az / B.n).toFixed(1), azAbs: +(B.azAbs / B.n).toFixed(1), off: +(B.off / B.n).toFixed(1), backPct: +((100 * B.back) / B.n).toFixed(1), downPct: +((100 * B.down) / B.n).toFixed(1), bothPct: +((100 * B.both) / B.n).toFixed(1), lyingPct: +((100 * B.lying) / B.n).toFixed(1) };
    return o;
  }
  table() {
    const L = ['| 무기 · 자세 | 프레임 | 올림각 ° | 방위 ° (+ 칼 든 쪽) | |방위| ° | 겨눔 어긋남 ° | 내 쪽(|방위| > 90°) % | 땅 쪽(올림 < −30°) % | 땅 쪽 · 내 쪽(올림 < −15° · |방위| > 90°) % | **누운 채 내 쪽**(올림 < 45° · |방위| > 90°) % |', '|---|---|---|---|---|---|---|---|---|---|'];
    for (const [k, r] of Object.entries(this.json()).sort()) L.push(`| ${k} | ${r.frames} | ${r.elev} | ${r.az} | ${r.azAbs} | ${r.off} | ${r.backPct} | ${r.downPct} | ${r.bothPct} | ${r.lyingPct} |`);
    return L.join('\n');
  }
}

// ── CLI: 다른 시뮬을 감싸 센다 ──
if (isMain(import.meta.url)) {
  const fs = await import('node:fs');
  const { Fighter } = await import('../../src/fighter.js');
  const cfg = await import('../../src/config.js');
  const { Combat } = await import('../../src/combat.js');
  const { GUARDS } = await import('../../src/guards.js');
  const byW = new Map(); // 무기 id → JointCounter
  const edges = new EdgeCounter(); // 칼 면 맞음 (때린 쪽 무기 · 이름)
  const tips = new TipCounter();
  const hitWhere = {}; // 무기 → { 칼날 몫·부위: [맞음, 칼 면] }
  const lagSt = {}; // 무기 → [움직이는 스텝, 어긋남 > 45° 스텝, 어긋남 합(rad)] // 한손 무기 간 보기 칼끝 (무기 · 가까운 자세)
  const cache = Fighter.prototype.cacheState;
  Fighter.prototype.cacheState = function (...a) {
    const id = this.weapon?.id ?? '?';
    if (!byW.has(id)) byW.set(id, new JointCounter());
    byW.get(id).add(this);
    // 날 세우기 따라감 (움직이는 칼 — 섞기 moving ≥ 0.99 인 스텝): 칼 면 ↔ 굴림 목표 어긋남 > 45° 인 스텝 몫
    if (this.armed !== false && this.state === 'stand' && (this.edgeMoving ?? 0) >= 0.99) { const L = (lagSt[id] ||= [0, 0, 0]); L[0]++; if ((this.edgeLag ?? 0) > Math.PI / 4) L[1]++; L[2] += this.edgeLag ?? 0; }
    if (this.guardPose?.oneHand && this.state === 'stand' && phaseOf(this) === 'watch' && (this.fightT ?? 1) >= SETTLE_S) {
      const gi = this.guardPose.nearest;
      tips.add(`${id} · ${GUARDS[gi]?.name ?? gi}`, tipAngles(this));
    }
    return cache.apply(this, a);
  };
  // 칼끼리 닿은 스텝 (bladeClash 에 닿은 짝이 있던 스텝) — 칼 면 맞음이 칼에 걸려 미끄러진 뒤인가를 가른다
  let stepN = 0, clashStep = -1e9;
  const afterStep = Combat.prototype.afterStep;
  Combat.prototype.afterStep = function (...a) { stepN++; return afterStep.apply(this, a); };
  const bladeClash = Combat.prototype.bladeClash;
  Combat.prototype.bladeClash = function (world, pairs) { if (pairs.length) clashStep = stepN; return bladeClash.call(this, world, pairs); };
  const strike = Combat.prototype.strike;
  Combat.prototype.strike = function (pr, point, passing) {
    const att = pr.w.fighter, vic = pr.v.fighter;
    const key = `${att.index}:${pr.v.part}`;
    const fresh = !vic.hitCooldowns.has(key);
    const S = att.cache?.sword;
    const r = strike.call(this, pr, point, passing);
    if (fresh && r && S && vic.hitCooldowns.has(key) && pr.w.part === 'blade' && att.weaponCfg.edged && r.type !== 'stab') {
      const ang = edgeAngleOf(S, r);
      if (ang != null) {
        // 맞은 자리 칼날 몫 t (0 = 코등이, 1 = 칼끝) · 맞은 부위 — 칼 면 맞음이 어디서 나나
        const iq = [-S.q.x, -S.q.y, -S.q.z, S.q.w];
        const ly = qrot(iq, [point.x - S.p.x, point.y - S.p.y, point.z - S.p.z])[1];
        const tb = Math.max(0, Math.min(1, (ly - att.weaponCfg.hiltLength) / att.weaponCfg.bladeLength));
        const wk = att.weapon?.id ?? '?';
        const H = (hitWhere[wk] ||= {});
        const bk = `t${tb < 0.4 ? 'lo' : tb < 0.75 ? 'mid' : 'hi'}`;
        (H[bk] ||= [0, 0])[0]++; if (ang > EDGE_FLAT) H[bk][1]++;
        const ck = stepN - clashStep <= 15 ? 'clash≤15스텝' : 'clash 없음';
        (H[ck] ||= [0, 0])[0]++; if (ang > EDGE_FLAT) H[ck][1]++;
        const pk = `p:${pr.v.part}`;
        (H[pk] ||= [0, 0])[0]++; if (ang > EDGE_FLAT) H[pk][1]++;
        const w = att.weapon?.id ?? '?';
        const hv = att.hitPointVel;
        const own = hv && hv.lengthSq() > 0.25 ? edgeAngleOf(S, { bladeAxis: r.bladeAxis, dir: hv.clone().normalize() }) : null; // 제 칼 70 % 지점 속도로 잰 날 각
        edges.add(w, ang, r, cfg.STRIKE.energyScale, cfg.STRIKE.edgeAlign, own, att);
        edges.add(`${w} · ${att.name}`, ang, r, cfg.STRIKE.energyScale, cfg.STRIKE.edgeAlign, own, att);
      }
    }
    return r;
  };
  const [script, ...rest] = process.argv.slice(2);
  if (script === 'rest') {
    // 플레이어 쉴 자세 칼끝 (skill.js ③ 되돌아옴의 목적지 = 유파 쉴 자세 패드, 없으면 SKILL.homeGuard): 보정 v2·autoGuard·숙련 0.7 (main.js 와 같음),
    //  상대는 시작 거리에 멈춰 선다. 3 s 들고 마지막 1.5 s 평균. node tools/sim/joint_range.mjs rest sabre falchion rapier qinggang longsword
    const { newRound, DT } = await import('./harness_m.mjs');
    const T = new TipCounter();
    const info = [];
    //  REST_PAD=x,y: 다른 패드 하나(판 시작 = 0.15,0) · REST_PAD=all: 쉴 자세 + 바탕 자세 14 곳 패드마다 (손을 그 자리에 둔 채 — 벤 뒤 손가락을 든 채 멈춘 꼴)
    const jobs = [];
    for (const w of rest.length ? rest : ['sabre', 'falchion', 'rapier', 'qinggang']) {
      if (process.env.REST_PAD === 'all') { jobs.push([w, null]); for (const g of GUARDS) if (!g.finish) jobs.push([w, g]); }
      else jobs.push([w, process.env.REST_PAD ? { pad: process.env.REST_PAD.split(',').map(Number) } : null]);
    }
    // REST_CUTS=1: 쉴 자세에서 손가락으로 벤 뒤 손을 떼고(되돌아옴 ③) 2.5 s 동안의 칼끝 — 사장님이 보는 '벤 사이' 꼴. 벤 길 = live_battery CUTS 와 그 거울
    if (process.env.REST_CUTS === '1') {
      const CUTS = { oberhau: [[0.02, 0.52], [0.0, -0.45]], zornhau: [[0.42, 0.42], [-0.4, -0.42]], zwerch: [[0.52, 0.06], [-0.5, 0.06]], unterhau: [[0.38, -0.44], [-0.3, 0.26]], zornhauL: [[-0.4, 0.42], [0.38, -0.44]], zwerchL: [[-0.5, 0.06], [0.52, 0.06]], unterhauL: [[-0.4, -0.42], [0.3, 0.26]] };
      for (const w of rest.length ? rest : ['sabre', 'falchion', 'rapier', 'qinggang']) for (const [cn, [a, b]] of Object.entries(CUTS)) {
        const G = newRound({ walls: false, weapon: w, weapon2: 'longsword', seed: 7 });
        G.ai.update = () => {};
        const P = G.player;
        P.skill.autoGuard = true;
        const pad = [a[0], a[1]];
        const setP = () => { P.handOffset.set(pad[0], pad[1]); };
        P.handOffset.set(pad[0], pad[1]);
        for (const k of ['aim', 'aimRaw', 'prev']) P.skill[k]?.set?.(pad[0], pad[1]);
        let phase = 'settle', t0 = 0;
        G.before = (t) => {
          P.inputActive = false;
          P.handHeld = phase === 'cut' || (phase === 'release' && process.env.REST_HOLD === '1'); // REST_HOLD=1: 벤 뒤 손가락을 화면에 둔 채(되돌아옴 없음) — 벤 끝 자세
          if (phase === 'settle' && t > 1.2) { phase = 'cut'; P.handHeld = true; }
          if (phase === 'cut') {
            const dx = b[0] - pad[0], dy = b[1] - pad[1], d = Math.hypot(dx, dy), st = 13 * DT;
            if (d > st) { pad[0] += (dx / d) * st; pad[1] += (dy / d) * st; } else { pad[0] = b[0]; pad[1] = b[1]; phase = 'release'; t0 = t; }
            P.handOffset.x = pad[0]; P.handOffset.y = pad[1];
            P.inputActive = true;
          }
        };
        void setP;
        for (let t = 0; t < 5; t += DT) {
          G.step();
          if (phase === 'release' && G.t - t0 > 0.3) T.add(`${w} · ${cn} 뒤 ${process.env.REST_HOLD === '1' ? '손가락 든 채' : '되돌아옴'}`, tipAngles(P));
        }
        info.push(`${w} ${cn}: 끝 패드 (${P.skill.aim.x.toFixed(2)}, ${P.skill.aim.y.toFixed(2)}) · 가까운 자세 ${GUARDS[P.guardPose.nearest]?.name}`);
      }
    }
    for (const [w, gd] of process.env.REST_CUTS === '1' ? [] : jobs) {
      const G = newRound({ walls: false, weapon: w, weapon2: 'longsword', seed: 7 });
      G.ai.update = () => {};
      const P = G.player;
      P.skill.autoGuard = true;
      const home = gd ? gd.pad : P.swordArt?.restGuard?.pad ?? cfg.SKILL.homeGuard;
      P.handOffset.set(home[0], home[1]);
      for (const k of ['aim', 'aimRaw', 'prev']) P.skill[k]?.set?.(home[0], home[1]);
      let cmdEl = 0, n = 0;
      // REST_HELD=1: 손가락을 그 패드에 둔 채 (쉼 무게 0 — 보정 v2 날것 매핑, 사장님 화면의 '옆 자세' 가 이 꼴)
      if (process.env.REST_HELD === '1') G.before = () => { P.handHeld = true; P.handOffset.set(home[0], home[1]); };
      for (let t = 0; t < 3; t += DT) {
        G.step();
        if (t > 1.5) {
          T.add(`${w} · ${gd?.name ? `패드 ${gd.name}` : '쉴 자세 패드'} (${home.map((v) => v.toFixed(2)).join(', ')})${process.env.REST_HELD === '1' ? ' 손가락 둠' : ''}`, tipAngles(P));
          cmdEl += Math.asin(Math.max(-1, Math.min(1, P.debug.aim.y))) * R2D;
          n++;
        }
      }
      if (!gd) info.push(`${w}: 가까운 자세 ${GUARDS[P.guardPose.nearest]?.name} · 쉼 무게 ${P.bodyPose.idle.toFixed(2)} · 보정 무게 gw ${P.guardWeight().toFixed(2)} · 명령 칼끝 올림각 ${(cmdEl / n).toFixed(1)}° · 한손 ${!!P.guardPose.oneHand}`);
    }
    console.log(`플레이어 쉴 자세 칼끝 (JOINTS.mode ${cfg.JOINTS.mode}, edge ${cfg.JOINTS.edge ?? '-'})`);
    console.log(T.table());
    for (const l of info) console.log('  ' + l);
    process.exit(0);
  }
  if (!script) {
    console.error('사용법: node tools/sim/joint_range.mjs <시뮬.mjs> [인자...]');
    process.exit(2);
  }
  let done = false;
  const report = () => {
    if (done) return;
    done = true;
    const mode = cfg.JOINTS?.mode ?? 'off';
    process.stderr.write(`\n──── joint_range (${script}${rest.length ? ' ' + rest.join(' ') : ''}) · JOINTS.mode ${mode} ────\n`);
    for (const [id, C] of byW) process.stderr.write(C.table(`무기 ${id} (양쪽 싸움꾼 합)`) + '\n');
    process.stderr.write(`칼 면 맞음 (날 각 > ${EDGE_FLAT}°, JOINTS.edge ${cfg.JOINTS?.edge ?? '-'})\n` + edges.table() + '\n');
    for (const [id, L] of Object.entries(lagSt)) process.stderr.write(`날 세우기 따라감 ${id}: 움직이는 스텝 ${L[0]} · 어긋남 > 45° ${((100 * L[1]) / L[0]).toFixed(1)}% · 평균 ${((L[2] / L[0]) * R2D).toFixed(1)}°\n`);
    if (tips.by.size) process.stderr.write('한손 무기 간 보기 칼끝 (가까운 자세별 평균)\n' + tips.table() + '\n');
    if (process.env.JR_JSON) fs.writeFileSync(process.env.JR_JSON, JSON.stringify({ script, args: rest, mode, edge: cfg.JOINTS?.edge ?? null, weapons: Object.fromEntries([...byW].map(([id, C]) => [id, C.json()])), edges: edges.json(), tips: tips.json(), lag: lagSt, where: hitWhere }, null, 1));
  };
  process.on('exit', report);
  process.argv = [process.argv[0], simPath(script), ...rest];
  await import(new URL('./' + script, import.meta.url));
  report();
}
