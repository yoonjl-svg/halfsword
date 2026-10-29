// ─────────────────────────────────────────────────────────────
//  redondo_check.mjs — 풍차 베기(B4 레돈두 — 이베리아 특수 공격) 두 손 몸 검사 · 감기 재기 (10/29 감독 '손목이 범위 밖 · 칼이 제 몸을 지나가지 않게' · docs/strike/redondo_hold_2026-10-29.md)
//   재기만 한다 — 게임 값은 건드리지 않는다. special_balance.mjs drillRun('rdHold') (서 있는 · 걷는 상대 · 손가락 봇이 길게 눌러 감고 걸어 들어가 뗌)의 스텝마다:
//    감는 동안(f.rdWind) · 내려침(운동학 칼 iai — moves[0].rd) 따로 duplieren_check.mjs sample 표(칼 팔 손목 wrist_audit · 빈팔 · 내 팔 · 칼날 ↔ 내 몸통 · 머리 겉 거리 — 음수 = 겹침)
//    감기: 한 바퀴 시간(바퀴 수 1 이 된 때 — 감기 시작부터 · 게임 초 · 실제 초) · 칼끝 빠르기(놓인 자리의 차 ÷ 스텝 — 칼 몸 빠르기는 가슴이라 따로) · 칼끝 높이 · 몸 방향 ↔ 상대 방향 각
//    내려침: 칼끝 빠르기 최고 · 맞음 · 칼 방향(왼 위 → 오른 아래 — 칼끝 높이 처음 → 끝 · 칼 든 쪽 쪽으로 감)
//   사용법: node tools/sim/redondo_check.mjs [--ws=zweihander,flamberge,tizona,durandal] [--seeds=6] [--foes=still,walk] [--json=.tmp/파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { THREE, CONFIG, DT } from './harness_m.mjs';
import { drillRun, ROWS } from './special_balance.mjs';
import { sample, dupTable } from './duplieren_check.mjs';
import { isMain } from './is_main.mjs';

const R2D = 180 / Math.PI;
const q = (a, p) => {
  const s = a.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))].toFixed(3) : null;
};

export function rdCheck({ w = 'zweihander', seeds = 6, foes = ['still', 'walk'] } = {}) {
  const keep = ROWS.rdHold.w;
  ROWS.rdHold.w = w;
  const S = { wind: [], strike: [] };
  const winds = [];
  const strikes = [];
  try {
    for (const foe of foes)
      for (let seed = 1; seed <= seeds; seed++) {
        let W = null;
        let K = null;
        let tip0 = null;
        let Wl = null; // 이 판의 마지막 감기 (뗀 때 → 맞음 · 든 기력 — 감자마자 뗀 감기는 첫 스텝뿐이라 W 가 없음)
        drillRun('rdHold', seed, {
          foe,
          variant: 'on',
          dur: 16,
          probe: (G, P, D) => {
            if (!G.__rdHit) {
              // 내려침이 처음 상처를 낸 때 (뗀 때 → 맞음 — 10/29 20:0x 감기 꼴 견줌)
              G.__rdHit = true;
              const pw = G.combat.hooks.onWound;
              G.combat.hooks.onWound = (att, vic, ...rest) => {
                pw?.(att, vic, ...rest);
                if (att === P && vic === D && K && K.tHit == null) K.tHit = G.t;
              };
            }
            const tip = P.bladePoint(1, new THREE.Vector3());
            const v = tip0 ? tip.distanceTo(tip0) / DT : 0; // 놓인 자리의 차 (칼 몸 빠르기는 감는 동안 가슴 빠르기)
            tip0 = tip.clone();
            const Wd = P.rdWind;
            if (Wd && Wd.t === 0) {
              // 감기 첫 스텝 = 아직 놓기 전(그 전 자세 — 보통 자세의 손목) · 셈 밖
              Wl = { t0: G.t, st0: P.stamina.value, st1: P.stamina.value, turns: 0 };
            } else if (Wd) {
              if (!W) winds.push((W = { w, foe, seed, t0: G.t, tRot: null, v: [], h: [], face: [], st0: P.stamina.value }));
              W.st1 = P.stamina.value; // 감는 동안 든 기력 (마지막 감은 스텝까지 — 내려침 칼 하나 몫은 뺌)
              W.off = Math.max(W.off ?? 0, P.offBalance ?? 0); // 휘청 (10/29 20:0x): 무게중심이 발 둘레 밖으로 벗어난 몫 최대 · 균형 걸음 · 넘어짐
              W.stum = Math.max(W.stum ?? 0, P.stumble?.length?.() ?? 0);
              if (P.state !== 'stand') W.fell = true;
              W.turns = Wd.turns;
              if (Wl) Object.assign(Wl, { st1: W.st1, turns: W.turns });
              if (W.tRot == null && Wd.turns >= 1) W.tRot = G.t - W.t0;
              if (Wd.k >= 1) {
                W.v.push(v);
                const c = P.bodies.chest.translation();
                W.h.push(tip.y - c.y);
                const f = new THREE.Vector3(1, 0, 0).applyQuaternion(P.yaw);
                const dc = D.bodies.chest.translation();
                const to = new THREE.Vector3(dc.x - c.x, 0, dc.z - c.z).normalize();
                W.face.push(Math.acos(Math.max(-1, Math.min(1, f.x * to.x + f.z * to.z))) * R2D);
              }
              S.wind.push({ w, foe, seed, ...sample(P, D, { cross: 0 }) });
            } else W = null;
            if (K && P.state !== 'stand') K.fell = true; // 내려침 동안 넘어짐
            const I = P.iai;
            if (I?.moves?.[0]?.rd) {
              if (!K) {
                strikes.push((K = { w, foe, seed, first: !strikes.some((k) => k.foe === foe && k.seed === seed), vMax: 0, y: [], side: [], tRel: G.t, tHit: null, drain: Wl && Wl.st0 != null ? Wl.st0 - Wl.st1 : null, windT: Wl ? G.t - Wl.t0 : null, turns: Wl?.turns ?? null }));
                Wl = null;
              }
              const seg = I.segs?.[I.si];
              if (seg?.cut) {
                K.vMax = Math.max(K.vMax, v);
                const c = P.bodies.chest.translation();
                const loc = new THREE.Vector3(tip.x - c.x, tip.y - c.y, tip.z - c.z).applyQuaternion(P.yaw.clone().invert());
                K.y.push(loc.y);
                K.side.push(loc.z * (P.side >= 0 ? 1 : -1));
              }
              S.strike.push({ w, foe, seed, ...sample(P, D, { cross: 0 }), seg: seg?.cut ? 'cut' : 'lead' });
            } else if (K) {
              K.res = P.instantResult ? { hits: P.instantResult.hits, zone: P.instantResult.zone, type: P.instantResult.type, E: +(P.instantResult.energy ?? 0).toFixed(1) } : null;
              K = null;
            }
          },
        });
      }
  } finally {
    ROWS.rdHold.w = keep;
  }
  return { S, winds, strikes };
}

/** 묶음 표 (무기 하나) */
export function rdSummary({ S, winds, strikes }) {
  const W = winds.filter((x) => x.v.length);
  const V = W.flatMap((x) => x.v);
  const cut = strikes.filter((k) => k.y.length);
  return {
    wind: { n: winds.length, off: [q(W.map((x) => x.off ?? 0), 0.5), q(W.map((x) => x.off ?? 0), 1)], stum: q(W.map((x) => x.stum ?? 0), 1), fell: winds.filter((x) => x.fell).length, steps: S.wind.length, tRotGame: q(winds.map((x) => x.tRot), 0.5), tRotReal: q(winds.map((x) => (x.tRot == null ? null : x.tRot / CONFIG.TIME.k)), 0.5), rotDone: winds.filter((x) => x.tRot != null).length, tipV: [q(V, 0.1), q(V, 0.5), q(V, 0.9)], tipH: [q(W.flatMap((x) => x.h), 0.1), q(W.flatMap((x) => x.h), 0.9)], faceDeg: [q(W.flatMap((x) => x.face), 0.5), q(W.flatMap((x) => x.face), 0.95)], table: dupTable(S.wind) },
    strike: {
      n: strikes.length,
      tipVmax: [q(cut.map((k) => k.vMax), 0.1), q(cut.map((k) => k.vMax), 0.5), q(cut.map((k) => k.vMax), 0.9)],
      // 칼끝 높이(가슴 기준 m) 첫 벰 자리 → 끝 · 칼 든 쪽(+) 첫 → 끝 — 왼 위 → 오른 아래면 y 줄고 side 늚
      y0: q(cut.map((k) => k.y[0]), 0.5), y1: q(cut.map((k) => k.y.at(-1)), 0.5), side0: q(cut.map((k) => k.side[0]), 0.5), side1: q(cut.map((k) => k.side.at(-1)), 0.5),
      leftHighRightLow: cut.filter((k) => k.y.at(-1) < k.y[0] && k.side.at(-1) > k.side[0]).length,
      hits: strikes.filter((k) => k.res?.hits).length,
      fell: strikes.filter((k) => k.fell).length,
      // 뗀 때 → 첫 상처 (실제 초 p50 · p90) · 감는 동안 든 기력 (p50 · 최대) · 감은 시간 (실제 초 p50) · 감은 셈 p50 (10/29 20:0x)
      toHit: [q(strikes.filter((k) => k.tHit != null).map((k) => (k.tHit - k.tRel) / CONFIG.TIME.k), 0.5), q(strikes.filter((k) => k.tHit != null).map((k) => (k.tHit - k.tRel) / CONFIG.TIME.k), 0.9)],
      drain: [q(strikes.map((k) => k.drain), 0.5), q(strikes.map((k) => k.drain), 1)],
      windReal: q(strikes.map((k) => (k.windT == null ? null : k.windT / CONFIG.TIME.k)), 0.5),
      turns: q(strikes.map((k) => k.turns), 0.5),
      // 다 감은 뒤 뗀 칼만 (감은 셈 ≥ 1 — 봇의 반은 감자마자 뗌): 수 · 맞음 · 뗀 때 → 첫 상처 p50
      wound: (() => { const Z = strikes.filter((k) => (k.turns ?? 0) >= 1); const H = Z.filter((k) => k.tHit != null); return { n: Z.length, hits: Z.filter((k) => k.res?.hits).length, toHit: q(H.map((k) => (k.tHit - k.tRel) / CONFIG.TIME.k), 0.5), drain: q(Z.map((k) => k.drain), 0.5) }; })(),
      // 판마다 첫 내려침만 (12 판 — 식힘 3 s 가 끝난 때부터라 한 판에 둘이 나가기도 함): 수 · 맞음 · 뗀 때 → 첫 상처 p50
      first: (() => { const F = strikes.filter((k) => k.first); const H = F.filter((k) => k.tHit != null); return { n: F.length, hits: F.filter((k) => k.res?.hits).length, toHit: q(H.map((k) => (k.tHit - k.tRel) / CONFIG.TIME.k), 0.5) }; })(),
      zones: strikes.reduce((o, k) => ((o[k.res?.zone ?? '-'] = (o[k.res?.zone ?? '-'] ?? 0) + 1), o), {}),
      table: dupTable(S.strike),
    },
  };
}

if (isMain(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  // --set=UNIQUE_ASSIST.rdLoop={"cone":26,"hand":[0.28,0.33,0.06]};… : 게임 값을 바꿔 견줌 (JSON 값 · ';' 로 여럿 — duplieren_check.mjs 와 같은 꼴)
  for (const kv of String(args.set ?? '').split(';').filter(Boolean)) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = JSON.parse(kv.slice(i + 1));
  }
  const out = {};
  for (const w of String(args.ws || 'zweihander,flamberge,tizona,durandal').split(',')) {
    const r = rdCheck({ w, seeds: +(args.seeds || 6), foes: String(args.foes || 'still,walk').split(',') });
    const sm = rdSummary(r);
    out[w] = sm;
    const T = (t) => ({ oorShare: t.sword.oorShare, oorMax: t.sword.oorMax, fe: t.sword.fe, dev: t.sword.dev, roll: t.sword.roll, selfBlade: t.self.blade, bladeHitShare: t.self.bladeHitShare, selfArm: t.self.arm, armHitShare: t.self.armHitShare, armArmHitShare: t.self.armArmHitShare, offGap: t.off.gap, steps: t.steps });
    console.log(`${w} 감기: ${JSON.stringify({ ...sm.wind, table: T(sm.wind.table) })}`);
    console.log(`${w} 내려침: ${JSON.stringify({ ...sm.strike, table: T(sm.strike.table) })}`);
  }
  if (args.json) writeFileSync(args.json, JSON.stringify(out, null, 1));
}
