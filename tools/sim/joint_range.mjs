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
    const mx = (k, v) => { if (v != null) this.max[k] = Math.max(this.max[k] ?? -Infinity, v); };
    mx('hyper', -o.elbow);
    mx('shBack', o.shBack);
    mx('shRotIn', o.shRot == null ? null : -o.shRot);
    mx('shRotOut', o.shRot);
    mx('wristFE', o.wristFE == null ? null : Math.abs(o.wristFE));
    mx('wrist', o.wrist);
    mx('spin', o.spin);
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
    return { phases: out, spinSteps: this.spin, nanSteps: this.nan, max: Object.fromEntries(Object.entries(this.max).map(([k, v]) => [k, +v.toFixed(1)])) };
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
    L.push(`관절 폭발(팔 각속도 > ${SPIN} rad/s) ${J.spinSteps} 스텝 · NaN ${J.nanSteps} 스텝`);
    L.push(Object.entries(LIMITS).map(([k, v]) => `${k} = ${v.src}`).join(' · '));
    return L.join('\n');
  }
}

// ── CLI: 다른 시뮬을 감싸 센다 ──
if (isMain(import.meta.url)) {
  const fs = await import('node:fs');
  const { Fighter } = await import('../../src/fighter.js');
  const cfg = await import('../../src/config.js');
  const byW = new Map(); // 무기 id → JointCounter
  const cache = Fighter.prototype.cacheState;
  Fighter.prototype.cacheState = function (...a) {
    const id = this.weapon?.id ?? '?';
    if (!byW.has(id)) byW.set(id, new JointCounter());
    byW.get(id).add(this);
    return cache.apply(this, a);
  };
  const [script, ...rest] = process.argv.slice(2);
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
    if (process.env.JR_JSON) fs.writeFileSync(process.env.JR_JSON, JSON.stringify({ script, args: rest, mode, weapons: Object.fromEntries([...byW].map(([id, C]) => [id, C.json()])) }, null, 1));
  };
  process.on('exit', report);
  process.argv = [process.argv[0], simPath(script), ...rest];
  await import(new URL('./' + script, import.meta.url));
  report();
}
