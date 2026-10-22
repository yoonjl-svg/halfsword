// 비기 다섯의 잔상 · 궤적 재기 (10/23 사장님 '잔상과 궤적도 비기에 걸맞는지 체크해' — docs/decisions.md 10/23 · 그림 docs/handoff/secret_trails). 읽기만 · 그림 없음.
//  사람 비기 다섯을 머리 없는 판(harness_m newRound — 상대는 멈춤)에서 곧장 낸다: skill.secret({ S: 그 유파 사람 비기, ctx }).
//  물리 스텝마다 칼자루 · 칼끝 · 비기 잔상(f.instantArc — kind · share · 점 수) · 베는 몫(f.iai.cutting · 탭 찌르기 뻗는 몫)을 적고,
//  비기마다 한 줄: 잔상 종류 · 밝기(share) · 점 수(그중 베는 몫) · 칼끝 최고 빠르기 · 고노센 칼끝 빠르기(같은 칼 iaiTipSpeed) · 보통 띠 가장 짙음(SWORD_TRAIL) ·
//  궤적 모양(몸 틀 앞 · 옆 · 위 폭 — 몸 앞을 가로지르나 · 이웃 점 사이 가장 큰 뜀 — 엉뚱한 데로 튀나).
//  실행: node tools/sim/secret_trail_probe.mjs [비기들 gonosen,mord,riso,spin,gyeoksal] [--json]
import { newRound, DT, CONFIG, THREE } from './harness_m.mjs';

const { SECRET, SWORD_TRAIL } = CONFIG;
const { TRADITIONS, playerSecretDef } = await import('../../src/schools.js');
const { iaiTipSpeed } = await import('../../src/secret_instant.js');
const { THRUST } = await import('../../src/config.js');

const CASES = {
  gonosen: { ko: '고노센', weapon: 'uchigatana', tr: 'japanese', gap: 1.9, ctx: {} },
  mord: { ko: '모르트슐라크', weapon: 'longsword', tr: 'german', gap: 0.75, ctx: { ev: 'press' } },
  riso: { ko: '안다레 리솔루토', weapon: 'rapier', tr: 'italian', gap: 1.6, ctx: { ev: 'risoluto', path: 'hold', held: 0.6 } },
  spin: { ko: '싱지르', weapon: 'zweihander', tr: 'iberian', gap: 2.1, ctx: { ev: 'spin' } },
  gyeoksal: { ko: '격살', weapon: 'qinggang', tr: 'chinese', gap: 1.35, ctx: { ev: 'gyeoksal', slot: 'geojeong', stance: 'geojeong' } },
};
const want = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : Object.keys(CASES).join(',')).split(',');
const asJson = process.argv.includes('--json');
const r2 = (v) => +(+v).toFixed(2);

/** 한 비기: 낸 뒤 비기가 끝날 때까지(굳음 빼고) 물리 스텝마다 적는다 */
export function probe(key) {
  const C = CASES[key];
  const g = newRound({ weapon: C.weapon, weapon2: 'longsword', gap: C.gap, seed: 3, walls: false });
  const P = g.player, E = g.enemy;
  g.ai.update = () => {};
  P.skill.corr = CONFIG.SKILL.corr;
  P.skill.corrTip = CONFIG.SKILL.corrTip;
  P.skill.autoGuard = true;
  P.canShove = true;
  P.foe = E;
  E.foe = P;
  try {
    for (let i = 0; i < Math.round(1.6 / DT); i++) g.step();
    const S = playerSecretDef(C.tr) ?? TRADITIONS[C.tr].secret;
    const id0 = P.instantArc?.id ?? 0;
    const ok = P.skill.secret({ S, ctx: C.ctx });
    const yaw = P.yaw.clone().invert();
    const c0 = new THREE.Vector3().copy(P.bodies.chest.translation());
    const body = (v) => v.clone().sub(c0).applyQuaternion(yaw); // 낸 순간 몸 틀 (x 앞 · y 위 · z 칼 든 쪽)
    const rows = [];
    let prevTip = P.bladePoint(1, new THREE.Vector3());
    let prevEnd = null;
    const w0 = g.wounds.length;
    for (let i = 0; i < Math.round(3 / DT); i++) {
      g.step();
      const sec = P.skill.sec;
      const tip = P.bladePoint(1, new THREE.Vector3());
      const A = P.instantArc;
      const tp = P.skill.tap;
      const K = tp?.K;
      const thrustCut = !!(tp && K && tp.t >= K.aim && tp.t < K.aim + K.extend + K.hold);
      // 치는 끝(잔상 호의 마지막 조각 바깥 끝 — 모르트슐라크는 칼자루 끝) 빠르기
      let vEnd = null;
      if (A && A.id !== id0 && A.pts.length) {
        const q = A.pts[A.pts.length - 1];
        const e = new THREE.Vector3(q[3], q[4], q[5]);
        if (prevEnd) vEnd = e.distanceTo(prevEnd) / DT;
        prevEnd = e;
      }
      rows.push({ t: g.t, st: sec?.stage ?? null, tip: body(tip), v: tip.distanceTo(prevTip) / DT, vEnd, arc: A && A.id !== id0 ? { id: A.id, kind: A.kind, share: A.share ?? 1, n: A.pts.length, pts: A.pts, face: A.face || false, min: A.min ?? 0 } : null, cut: P.iai ? !!(P.iai.kind === 'iai' ? P.iai.u >= P.iai.ab : P.iai.cutting) : thrustCut, spin: !!P.ibSpin });
      prevTip = tip;
      if (!sec || sec.stage === 'stiff') break;
    }
    // 잔상 (마지막에 본 비기 잔상 하나 — 다섯 모두 한 비기에 잔상 하나)
    const last = [...rows].reverse().find((r) => r.arc);
    const arc = last?.arc ?? null;
    // 베는 몫 칼끝 빠르기 · 그때 잔상 점 범위
    const cutRows = rows.filter((r) => r.cut);
    const vmax = Math.max(...rows.map((r) => r.v));
    const vcut = cutRows.length ? Math.max(...cutRows.map((r) => r.v)) : 0;
    const vcutAvg = cutRows.length ? cutRows.reduce((s, r) => s + r.v, 0) / cutRows.length : 0;
    const ends = rows.map((r) => r.vEnd).filter((v) => v != null && v > 0);
    const vEnd = ends.length ? Math.max(...ends) : 0;
    // 잔상 점이 베는 몫에서 왔나: 스텝마다 점 수가 늘어난 몫을 그 스텝의 베는 몫과 맞춘다
    let nCut = 0, nAll = 0, prevN = 0;
    for (const r of rows) {
      const n = r.arc?.n ?? prevN;
      if (n > prevN) {
        nAll += n - prevN;
        if (r.cut) nCut += n - prevN;
      }
      prevN = n;
    }
    // 궤적 모양 (잔상이 있으면 그 점의 칼끝 끝 · 없으면 비기 동안 칼끝)
    const tips = arc ? arc.pts.map((p) => body(new THREE.Vector3(p[3], p[4], p[5]))) : rows.map((r) => r.tip);
    const span = (k) => r2(Math.max(...tips.map((p) => p[k])) - Math.min(...tips.map((p) => p[k])));
    let jump = 0;
    for (let i = 1; i < tips.length; i++) jump = Math.max(jump, tips[i].distanceTo(tips[i - 1]));
    const front = tips.filter((p) => p.x > 0.25);
    const crosses = front.some((p) => p.z > 0.1) && front.some((p) => p.z < -0.1);
    const ref = iaiTipSpeed(P);
    const normalAlpha = SWORD_TRAIL.strength * Math.min(1, Math.max(0, (vmax - SWORD_TRAIL.vMin) / (SWORD_TRAIL.vMax - SWORD_TRAIL.vMin)));
    return {
      key, ko: C.ko, weapon: C.weapon, ok,
      kind: arc?.kind ?? '보통 띠만', share: arc ? r2(arc.share) : null, min: arc?.min ?? 0, face: arc?.face || false, arcAlpha: arc ? r2(0.95 * Math.max(arc.share, arc.min)) : null, normalAlpha: r2(normalAlpha),
      life: arc ? SECRET.instantArcLife : SWORD_TRAIL.life, pts: arc?.n ?? 0, ptsCut: nCut, ptsAll: nAll,
      vmax: r2(vmax), vcut: r2(vcut), vEnd: r2(vEnd), vcutAvg: r2(vcutAvg), ref: r2(ref), shareBySpeed: r2(Math.min(1, vcutAvg / Math.max(1, ref))),
      span: { fwd: span('x'), up: span('y'), side: span('z') }, crosses, jump: r2(jump), hits: g.wounds.length - w0,
      steps: rows.length, thrust: key === 'riso' ? THRUST : undefined,
    };
  } finally {
    g.world.free();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = want.filter((k) => CASES[k]).map(probe);
  if (asJson) console.log(JSON.stringify(out, null, 1));
  else
    for (const o of out)
      console.log(
        `${o.ko.padEnd(8)} ${o.weapon.padEnd(10)} 냄 ${o.ok} · 잔상 ${o.kind} · share ${o.share ?? '-'} · 바닥 ${o.min} · 띠 ${o.face} (호 불투명 ${o.arcAlpha ?? '-'} · 보통 띠 ${o.normalAlpha}) · 남음 ${o.life} s · 점 ${o.pts} (베는 몫 ${o.ptsCut}/${o.ptsAll}) · ` +
          `칼끝 최고 ${o.vmax} m/s · 베는 몫 최고 ${o.vcut} · 평균 ${o.vcutAvg} · 잔상 끝 최고 ${o.vEnd} · 고노센 ${o.ref} (몫 ${o.shareBySpeed}) · 폭 앞 ${o.span.fwd} 위 ${o.span.up} 옆 ${o.span.side} · 가로지름 ${o.crosses} · 뜀 ${o.jump} m · 맞음 ${o.hits}`,
      );
}
