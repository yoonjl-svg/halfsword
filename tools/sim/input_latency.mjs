// ─────────────────────────────────────────────────────────────
//  입력 지연 측정 (R0 입력, docs/whole_body_redesign.md 3-2 (a)·3-3): 합성 손가락 궤적을 게임과 같은 길(harness_m.mjs inputPump:
//  input.js → main.js 와 같은 프레임·스텝 시계 → handOffset → skill.update)로 넣고 다음을 잰다.
//   drag  : 3 m/s 곧은 끌기 1.08 m — 손가락 → 손 목표(handOffset)·겨눔(skill.aim) 2 cm 도달 지연, 고른(정상) 지연(모든 스텝 = 물리 시계 기준,
//           프레임 마지막 스텝 = 화면에 그려지는 상태 기준), 스텝별 손 목표 이동의 고름(표준편차/평균: 0 = 스텝마다 같게, 1 = 2v·0·2v·0 처럼
//           한 프레임 몫이 첫 스텝에 몰림), 이동 보존(손가락을 뗀 두 프레임 뒤 손 목표 − 시작 = 손가락 이동. 예측한 몫이 남지 않아야 0)
//   cut12 : 감기(1.2 m/s, 1초 머묾) → 12 m/s 사선 베기(chain.mjs hold 와 같은 조건) — 게임 설정 그대로 칼끝·손 최고 빠르기, 손짓 층 확정 횟수
//           (옛 결심 켬/끔 두 줄은 R2 W5 가 옛 경로와 함께 지웠다)
//   jitter: 손가락 3 mm · 8 Hz 흔들림 2초 — 손 목표·겨눔·칼끝의 흔들림 RMS
//  INPUT.coalesce 끔·켬을 한 프로세스에서 견준다 (R0_OFF=1 이면 끔만). 화면 60/120/30 Hz, 터치 표본 = 화면과 같게 또는 120 Hz(합쳐진 이벤트).
//  실행: node tools/sim/input_latency.mjs [--json] [--hz=60,120,30]      (hybrid 걸음: node tools/sim/hybrid.mjs input_latency.mjs)
//  관문(R0): 켬이 끔보다 나쁘지 않을 것 (지연 ≤, 고름 ≤, 이동 보존 = 0), 팔 베기 칼끝 ±3%, 60 Hz 와 120 Hz 칼끝 ±3%
// ─────────────────────────────────────────────────────────────
import { newRound, DT, CONFIG, feedTrace, inputPump, f1, f2, f3 } from './harness_m.mjs';

const args = process.argv.slice(2);
const JSON_OUT = args.includes('--json');
const arg = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const HZS = arg('hz', '60,120,30').split(',').map(Number);
const R0_OFF = CONFIG.R0_OFF;
const FLAGS = R0_OFF ? [false] : [false, true];
const SEED = 7;
const PAD = { Pflug: [0.18, -0.28], ShR: [0.42, 0.42], WechselL: [-0.4, -0.42] };

/** 곧은 긋기 (같은 빠르기): 이동 (dx, dy) 를 v 패드 m/s 로. hold ms 머묾 */
function stroke(dx, dy, v, { hold = 0, lift = true, down = true } = {}) {
  const T = (Math.hypot(dx, dy) / v) * 1000;
  return { fn: (t) => { const u = T > 0 ? Math.min(1, Math.max(0, t / T)) : 1; return [dx * u, dy * u]; }, T: T + hold, lift, down };
}
function setPad(P, xy) {
  P.handOffset.set(xy[0], xy[1]);
  const k = P.skill;
  for (const v of [k.prev, k.aim, k.aimRaw, k.anchor]) v.set(xy[0], xy[1]);
  k.aimVel.set(0, 0);
  k.vel.set(0, 0);
  k.follow.set(0, 0);
}
/** 플레이어 혼자 (상대는 서 있기만, 칼 충돌 끔), 쟁기에서 2초 */
function stage({ hz, touchHz, pad = PAD.Pflug }) {
  const G = newRound({ walls: false, gap: 2.17, seed: SEED, weapon: 'longsword' });
  const P = G.player, E = G.enemy;
  G.ai.update = () => E.move.set(0, 0);
  for (let i = 0; i < E.sword.numColliders(); i++) E.sword.collider(i).setCollisionGroups(0);
  for (let i = 0; i < P.sword.numColliders(); i++) P.sword.collider(i).setCollisionGroups(0);
  E.die = () => {};
  P.skill.level = 0.7;
  setPad(P, pad);
  const pump = inputPump(G, { hz, touchHz });
  let commits = 0;
  const oc = P.onCommit.bind(P);
  P.onCommit = (...a) => (a[0] === 'B' && commits++, oc(...a));
  for (let i = 0; i < Math.round(2.0 / DT); i++) G.step();
  return { G, P, pump, commits: () => commits };
}
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / Math.max(1, a.length));
const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) * (x - m)))); };

/** drag: 곧은 끌기의 지연·고름·보존 */
function drag(cond) {
  const S = stage({ ...cond, pad: [-0.45, -0.3] });
  const { G, P, pump } = S;
  const v = 3, dx = 0.9, dy = 0.6, L = Math.hypot(dx, dy);
  const ux = dx / L, uy = dy / L;
  const x0 = P.handOffset.x, y0 = P.handOffset.y;
  const q = feedTrace(G, stroke(dx, dy, v), cond.hz, { touchHz: cond.touchHz });
  const rows = [];
  for (let i = 0; i < Math.round(1.0 / DT); i++) {
    G.step();
    const t = pump.stepWall;
    const tau = q.w0 == null ? -1 : t - q.w0;
    const fp = tau < 0 ? 0 : Math.min(L, (tau / 1000) * v); // 손가락의 진행 (m)
    rows.push({ t, tau, fp, last: pump.budget === 0, hp: (P.handOffset.x - x0) * ux + (P.handOffset.y - y0) * uy, ap: (P.skill.aim.x - x0) * ux + (P.skill.aim.y - y0) * uy, hx: P.handOffset.x, hy: P.handOffset.y });
  }
  const T = (L / v) * 1000;
  const cross = (key, th) => { const r = rows.find((r) => r[key] >= th); return r ? r.tau - (th / v) * 1000 : null; };
  const steady = rows.filter((r) => r.fp >= 0.3 * L && r.fp <= 0.9 * L);
  const lag = (key, only = steady) => f1(mean(only.map((r) => ((r.fp - r[key]) / v) * 1000)));
  const shown = steady.filter((r) => r.last); // 프레임의 마지막 스텝 (그 프레임에 그려지는 상태)
  const inc = [];
  for (let i = 1; i < rows.length; i++) if (rows[i].fp >= 0.3 * L && rows[i].fp <= 0.9 * L) inc.push(Math.hypot(rows[i].hx - rows[i - 1].hx, rows[i].hy - rows[i - 1].hy));
  const after = rows.find((r) => r.tau >= T + 2000 / cond.hz) ?? rows[rows.length - 1]; // 손가락을 뗀 두 프레임 뒤 (자세로 돌아가기 recoverDelay 0.25 s 전)
  return {
    hand2cm_ms: f1(cross('hp', 0.02)), aim2cm_ms: f1(cross('ap', 0.02)), handLag_ms: lag('hp'), aimLag_ms: lag('ap'), handLagShown_ms: lag('hp', shown), aimLagShown_ms: lag('ap', shown),
    stepUnif: f3(sd(inc) / Math.max(1e-9, mean(inc))), stepMax_mm: f2(Math.max(...inc) * 1000), conserve_mm: f2((after.hp - L) * 1000), strokeT_ms: f1(T), steps: steady.length,
  };
}

/** cut12: 감기 → 12 m/s 사선 베기 (chain.mjs hold 조건) — 칼끝·손 최고, 손짓 층 확정 */
function cut12(cond) {
  const S = stage(cond);
  const { G, P, pump } = S;
  const off = [P.handOffset.x, P.handOffset.y];
  const ch = feedTrace(G, stroke(PAD.ShR[0] - off[0], PAD.ShR[1] - off[1], 1.2, { hold: 1000, lift: false }), cond.hz, { touchHz: cond.touchHz });
  while (!ch.done) G.step();
  const cur = [P.handOffset.x, P.handOffset.y];
  const cut = feedTrace(G, stroke(PAD.WechselL[0] - cur[0], PAD.WechselL[1] - cur[1], 12, { down: false, lift: true }), cond.hz, { touchHz: cond.touchHz });
  let tip = 0, hand = 0, tipT = 0, t5 = null, prev = P.handOffset.clone();
  const hx0 = cur[0], hy0 = cur[1];
  for (let i = 0; i < Math.round(1.0 / DT); i++) {
    G.step();
    const tv = P.tipVel.length();
    if (tv > tip) { tip = tv; tipT = pump.stepWall; }
    hand = Math.max(hand, P.handOffset.distanceTo(prev) / DT);
    prev.copy(P.handOffset);
    if (t5 == null && cut.w0 != null && Math.hypot(P.handOffset.x - hx0, P.handOffset.y - hy0) >= 0.05) t5 = pump.stepWall - cut.w0;
  }
  return { tip_mps: f2(tip), tipT_ms: f1(tipT - cut.w0), handPad_mps: f2(hand), hand5cm_ms: f1(t5), commits: S.commits() };
}

/** jitter: 3 mm 8 Hz 흔들림 — 손 목표·겨눔·칼끝 RMS */
function jitter(cond) {
  const S = stage(cond);
  const { G, P } = S;
  const A = 0.003, F = 8, T = 2000;
  const x0 = P.handOffset.x, y0 = P.handOffset.y;
  feedTrace(G, { fn: (t) => [A * Math.sin((2 * Math.PI * F * t) / 1000), 0], T, lift: true, down: true }, cond.hz, { touchHz: cond.touchHz });
  const h = [], a = [], tv = [];
  for (let i = 0; i < Math.round(2.2 / DT); i++) {
    G.step();
    if (i * DT < 0.3) continue;
    h.push(P.handOffset.x - x0);
    a.push(P.skill.aim.x - x0);
    tv.push(P.tipVel.length());
  }
  return { hand_mm: f3(rms(h) * 1000), aim_mm: f3(rms(a) * 1000), tip_mps: f3(rms(tv)), handMax_mm: f2(Math.max(...h.map(Math.abs)) * 1000), drift_mm: f2((P.handOffset.x - x0) * 1000) };
}

const conds = [];
for (const hz of HZS) {
  conds.push({ hz, touchHz: hz });
  if (hz < 120) conds.push({ hz, touchHz: 120 });
}
const out = { R0_OFF, predictMs: CONFIG.INPUT.predictMs, weightMode: CONFIG.BODY.weightMode, rows: [] };
for (const flag of FLAGS) {
  CONFIG.INPUT.coalesce = flag;
  for (const c of conds) {
    const r = { coalesce: flag, hz: c.hz, touchHz: c.touchHz, drag: drag(c), cutArm: cut12(c), jitter: jitter(c) };
    out.rows.push(r);
    if (!JSON_OUT) {
      const d = r.drag, ca = r.cutArm, j = r.jitter;
      console.log(`${flag ? '켬' : '끔'} 화면 ${String(c.hz).padStart(3)} Hz 터치 ${String(c.touchHz).padStart(3)} Hz │ drag 2cm 손 ${d.hand2cm_ms} 겨눔 ${d.aim2cm_ms} ms · 고른 지연 손 ${d.handLag_ms} 겨눔 ${d.aimLag_ms} ms (그려지는 스텝 손 ${d.handLagShown_ms} 겨눔 ${d.aimLagShown_ms}) · 스텝 고름 ${d.stepUnif} (최대 ${d.stepMax_mm} mm) · 보존 ${d.conserve_mm} mm │ 팔 베기 칼끝 ${ca.tip_mps} m/s (t ${ca.tipT_ms} ms, 손 5cm ${ca.hand5cm_ms} ms) · 확정 ${ca.commits} │ 떨림 손 ${j.hand_mm} 겨눔 ${j.aim_mm} mm 칼끝 ${j.tip_mps} m/s`);
    }
  }
}
CONFIG.INPUT.coalesce = !R0_OFF;
// 견줌: 같은 화면·터치 조건에서 켬 − 끔
if (FLAGS.length === 2) {
  out.diff = [];
  for (const c of conds) {
    const a = out.rows.find((r) => !r.coalesce && r.hz === c.hz && r.touchHz === c.touchHz);
    const b = out.rows.find((r) => r.coalesce && r.hz === c.hz && r.touchHz === c.touchHz);
    const d = { hz: c.hz, touchHz: c.touchHz, hand2cm_ms: f1(b.drag.hand2cm_ms - a.drag.hand2cm_ms), aim2cm_ms: f1(b.drag.aim2cm_ms - a.drag.aim2cm_ms), handLag_ms: f1(b.drag.handLag_ms - a.drag.handLag_ms), aimLag_ms: f1(b.drag.aimLag_ms - a.drag.aimLag_ms), aimLagShown_ms: f1(b.drag.aimLagShown_ms - a.drag.aimLagShown_ms), stepUnif: f3(b.drag.stepUnif - a.drag.stepUnif), armTip_pct: f2(((b.cutArm.tip_mps - a.cutArm.tip_mps) / a.cutArm.tip_mps) * 100), jitterHand_mm: f3(b.jitter.hand_mm - a.jitter.hand_mm) };
    out.diff.push(d);
    if (!JSON_OUT) console.log(`켬−끔 화면 ${String(c.hz).padStart(3)} Hz 터치 ${String(c.touchHz).padStart(3)} Hz: 2cm 손 ${d.hand2cm_ms} 겨눔 ${d.aim2cm_ms} ms · 고른 지연 손 ${d.handLag_ms} 겨눔 ${d.aimLag_ms} ms (그려지는 스텝 겨눔 ${d.aimLagShown_ms}) · 스텝 고름 ${d.stepUnif} · 팔 베기 칼끝 ${d.armTip_pct}% · 결심 베기 칼끝 ${d.commitTip_pct}% · 떨림 손 ${d.jitterHand_mm} mm`);
  }
  const on = out.rows.filter((r) => r.coalesce);
  const t60 = on.find((r) => r.hz === 60 && r.touchHz === 60), t120 = on.find((r) => r.hz === 120);
  if (t60 && t120) {
    out.tip60vs120_pct = f2(((t120.cutArm.tip_mps - t60.cutArm.tip_mps) / t60.cutArm.tip_mps) * 100);
    if (!JSON_OUT) console.log(`켬 팔 베기 칼끝 120 Hz − 60 Hz: ${out.tip60vs120_pct}%`);
  }
}
if (JSON_OUT) console.log(JSON.stringify(out));
