// ─────────────────────────────────────────────────────────────
//  onehand_arm.mjs — 한손 무기 팔 비틀림 재기 (10/25 01:2x 사장님 '팔 관절이 비틀린 게 많아' — docs/strike/wrist_audit_2026-10-24.md §10)
//   잣대 (물리 스텝이 끝난 자세 · 칼 팔): 위팔 돌림(shRot — joint_range armAngles · 들림 120° 아래만 · 한도 밖 = AAOS 안 70 / 바깥 90 밖 · 끝 10° 안) ·
//    팔꿈치 줄 위(어깨 관절 → 손목 줄에서 팔꿈치가 비킨 방향의 가슴 틀 위 몫 > 0 · > 30°) · 아래팔 굴림 ≥ 78(손목 밧줄 80 끝) · 손목 거꾸로(dev < −45 · 아래팔이 칼 면에서 45° 안) ·
//    범위 밖(dev 가 [−31, 136] 밖 · 아래팔이 칼 면에서 70° 안) · 어깨 면 밖(shPlane −45 / 130) · 돌림 덜렁(twistLag > 45 — 실제 경첩 축이 명령에서 45° 넘게)
//   모드: guards(자세표 자리마다 새 판 1.4 s 붙잡기 · 1.0 s 뒤 잼 — 첫 칸 'first' 따로 · FIRST=1 이면 첫 칸 자세값 줄) · tap(탭 찌르기 쟁기 · 황소 · 긴 자세 · 1.8 m) ·
//    ai(같은 무기 AI 끼리 · 씨앗 11 · 12 · 15 s — 공격 중(긋기 · 따라 베기) · 탭 · 그 밖) · terra(병마용 기질 월왕구천검 AI 대 롱소드 · 레이피어 · 청강검 AI — 병마용 쪽만)
//   node tools/sim/onehand_arm.mjs [GROUP.key=v,…] [모드들=guards,tap,ai] [무기들=rapier,dartagnan,balisarda,sabre,qinggang,moye,goujian,ganjiang]
//    전(손목 교정 전) = JOINTS.elbowSwivel=0,JOINTS.wristGuard=0,JOINTS.swivelThrust=0 · 10/24 17:2x 뒤 판 = JOINTS.swivelHuman=0
// ─────────────────────────────────────────────────────────────
import { newRound, DT, AI, CONFIG, THREE } from './harness_m.mjs';
import { armAngles } from './joint_range.mjs';
import { wristSample } from './wrist_audit.mjs';
import { GUARD_BASE } from '../../src/guards.js';
import { CHARACTERS_BY_ID } from '../../src/characters.js';
for (const kv of (process.argv[2] || '').split(',').filter(Boolean)) {
  const [k, v] = kv.split('=');
  const [g, key] = k.split('.');
  CONFIG[g][key] = isNaN(+v) ? v : +v;
}
const MODES = (process.argv[3] || 'guards,tap,ai').split(',');
const WEAPONS = (process.argv[4] || 'rapier,dartagnan,balisarda,sabre,qinggang,moye,goujian,ganjiang').split(',');
const V = (t) => new THREE.Vector3(t.x, t.y, t.z);
const Qt = (r) => new THREE.Quaternion(r.x, r.y, r.z, r.w);
/** 팔꿈치 자리: 어깨 → 손목 줄에서 팔꿈치가 비킨 방향의 위 몫(°, + = 줄보다 위) · 바깥 몫(°, + = 칼 든 쪽 바깥) — 가슴 틀 */
function elbowDir(f) {
  const B = f.bodies;
  const qu = Qt(B.uarmS.rotation()), qf = Qt(B.farmS.rotation()), qc = Qt(B.chest.rotation());
  const u = new THREE.Vector3(1, 0, 0).applyQuaternion(qu);
  const fa = new THREE.Vector3(1, 0, 0).applyQuaternion(qf);
  const S = V(B.uarmS.translation()).addScaledVector(u, -0.15);
  const E = V(B.uarmS.translation()).addScaledVector(u, 0.15);
  const W = V(B.farmS.translation()).addScaledVector(fa, 0.13);
  const d = W.clone().sub(S).normalize();
  const off = E.clone().sub(S);
  off.addScaledVector(d, -off.dot(d));
  if (off.lengthSq() < 1e-8) return { up: NaN, out: NaN };
  off.normalize();
  const ci = qc.clone().invert();
  const o = off.applyQuaternion(ci);
  return { up: (Math.asin(THREE.MathUtils.clamp(o.y, -1, 1)) * 180) / Math.PI, out: (Math.asin(THREE.MathUtils.clamp(o.z * (f.side ?? 1), -1, 1)) * 180) / Math.PI };
}
class Tally {
  constructor() { this.k = new Map(); }
  add(key, f) {
    const a = armAngles(f), w = wristSample(f), e = elbowDir(f);
    if (!a || !w) return;
    let P = this.k.get(key);
    if (!P) this.k.set(key, (P = { n: 0, rotN: 0, rotOut: 0, rotNear: 0, rotIn: 0, rotSum: 0, up: 0, up30: 0, upSum: 0, roll78: 0, rev: 0, oor: 0, lag: 0, shPl: 0 }));
    P.n++;
    if (a.shRot != null) { P.rotN++; P.rotSum += a.shRot; if (a.shRot < -70 || a.shRot > 90) P.rotOut++; if (a.shRot < -60 || a.shRot > 80) P.rotNear++; if (a.shRot < -70) P.rotIn++; }
    if (a.shPlane != null && (a.shPlane < -45 || a.shPlane > 130)) P.shPl++;
    if (a.twistLag != null && a.twistLag > 45) P.lag++;
    if (Number.isFinite(e.up)) { P.upSum += e.up; if (e.up > 0) P.up++; if (e.up > 30) P.up30++; }
    if (w.roll >= 78) P.roll78++;
    if (w.dev < -45 && Math.abs(w.fe) < 45) P.rev++;
    if (Math.abs(w.fe) <= 70 && (w.dev < -31 || w.dev > 136)) P.oor++;
  }
}
const pc = (x, n) => (n ? ((100 * x) / n).toFixed(1) : '-');
function line(label, P) {
  return `${label} · 스텝 ${P.n} · 위팔 돌림 한도 밖 ${pc(P.rotOut, P.rotN)} % (안쪽 ${pc(P.rotIn, P.rotN)}) · 끝 10° 안 ${pc(P.rotNear, P.rotN)} % · 평균 ${(P.rotSum / Math.max(1, P.rotN)).toFixed(0)}° · 팔꿈치 줄 위 ${pc(P.up, P.n)} % · 30° 넘게 위 ${pc(P.up30, P.n)} % · 평균 ${(P.upSum / P.n).toFixed(0)}° · 굴림 ≥ 78 ${pc(P.roll78, P.n)} % · 손목 거꾸로 ${pc(P.rev, P.n)} % · 범위 밖 ${pc(P.oor, P.n)} % · 어깨 면 밖 ${pc(P.shPl, P.n)} % · 돌림 덜렁 ${pc(P.lag, P.n)} %`;
}
function setHand(f, xy) {
  f.handOffset.set(xy[0], xy[1]);
  const sk = f.skill;
  for (const k of ['prev', 'aim', 'aimRaw', 'anchor']) sk[k]?.set?.(xy[0], xy[1]);
  sk.aimVel?.set(0, 0); sk.vel?.set(0, 0); sk.follow?.set(0, 0);
}
const still = (w, gap = 2.6, seed = 7) => { const g = newRound({ weapon: w, weapon2: 'longsword', gap, seed }); g.ai.update = () => {}; g.player.foe = g.enemy; g.enemy.foe = g.player; return g; };
const tot = new Tally();
const firstRows = [];
for (const mode of MODES) {
  const T = new Tally();
  if (mode === 'guards') {
    for (const w of WEAPONS) {
      const pr = still(w);
      const table = (pr.player.guardPose.table ?? GUARD_BASE).filter((G) => G?.pad && !G.finish);
      pr.world.free();
      table.forEach((G, i) => {
        const g = still(w);
        try {
          g.player.skill.autoGuard = true;
          while (g.t < 1.4) {
            setHand(g.player, G.pad);
            g.step();
            if (g.t >= 1.0 && g.player.state === 'stand') { T.add(i === 0 ? 'first' : 'rest', g.player); if (i === 0) firstRows.push([w, G.name, armAngles(g.player), elbowDir(g.player), wristSample(g.player)]); }
          }
        } finally { g.world.free(); }
      });
    }
  } else if (mode === 'tap') {
    for (const w of WEAPONS) for (const pad of [[0.18, -0.28], [0.22, 0.26], [0.0, 0.03]]) {
      const g = still(w, 1.8, 311);
      try {
        g.player.skill.autoGuard = true;
        while (g.t < 1.4) { setHand(g.player, pad); g.step(); }
        if (!g.player.skill.thrust()) continue;
        for (let i = 0; i < Math.round(1.0 / DT) && g.player.skill.tap; i++) { g.step(); if (g.player.state === 'stand') T.add('tap', g.player); }
      } finally { g.world.free(); }
    }
  } else if (mode === 'ai' || mode === 'terra') {
    const pairs = mode === 'ai' ? WEAPONS.map((w) => [w, w, null]) : [['goujian', 'longsword', 'terracotta'], ['goujian', 'rapier', 'terracotta'], ['goujian', 'qinggang', 'terracotta']];
    for (const [w1, w2, ch] of pairs) for (const seed of [11, 12]) {
      const C = ch ? CHARACTERS_BY_ID[ch] : null;
      const g = newRound({ seed, weapon: w2, weapon2: w1, AI2Class: AI, walls: true, ...(C ? { persona: C.ai.persona } : {}) });
      const ais = [g.ai2, g.ai];
      try {
        while (g.t < 15 && g.player.alive && g.enemy.alive) {
          g.step();
          if (g.t < 0.5) continue;
          for (const f of mode === 'terra' ? [g.enemy] : [g.player, g.enemy]) {
            if (f.state !== 'stand' || f.iai) continue;
            const ai = ais.find((a) => a?.me === f);
            const atk = ai?.mode === 'attack' && (ai.phase === 'strike' || ai.phase === 'follow');
            T.add(f.skill.tap ? 'tap' : atk ? 'attack' : 'watch', f);
          }
        }
      } finally { g.world.free(); }
    }
  }
  for (const [k, P] of T.k) console.log(line(`${mode}:${k}`, P));
}
// 무기마다 첫 칸의 마지막 스텝
if (process.env.FIRST === '1') for (const [w, n, a, e, s] of firstRows.filter((r, i, A) => A.findLastIndex((x) => x[0] === r[0]) === i)) console.log(`첫 자세 ${w} ${n}: 위팔 돌림 ${a?.shRot?.toFixed(0)} · 들림 ${a?.shElev?.toFixed(0)} · 팔꿈치 ${a?.elbow?.toFixed(0)} · 팔꿈치 위 ${e.up.toFixed(0)}° 바깥 ${e.out.toFixed(0)}° · dev ${s?.dev?.toFixed(0)} · 굴림 ${s?.roll?.toFixed(0)}`);
