// ─────────────────────────────────────────────────────────────
//  kote_pickup.mjs — 손목 치기 칼 떨굼 · 떨어진 칼 줍기 재기 (사장님 11/04 '코테는 칼을 더 자주 떨어트리게 해. 단 떨어진 무기를 줍는 동작을 신설하자' · 기록 docs/strike/kote_pickup_2026-11-05.md)
//   재기만 한다 — 게임 값은 --set 으로 이 프로세스 안에서만.
//  rate : 일본 손가락 봇(school_balance.mjs fightOne — 실제 Input 터치 길 · focus 'kote' = 유파 기술 몫이 모두 손목 치기) 대 AI.
//         손목 치기 낸 것마다 탐침: 칼날이 상대 아래팔에 닿음(물리 닿음 — 에너지 · 식힘 · 기술 창 무관) · 상대 칼 손 쪽 절반과 새로 부딪힘(빠르기 vn · 들어감 · 자리 at) ·
//         굴림 · 떨굼(낸 뒤 1 실제 s 안). 깔때기 = 낸 수 → 닿음(아래팔 또는 칼 손 쪽 절반) → 지금 판정이 굴리는 닿음 → 굴림 → 떨굼
//    node tools/sim/kote_pickup.mjs rate [--cells=japanese:uchigatana:longsword,…] [--seeds=1-12] [--tech=0.6] [--dur=30] [--set=UNIQUE_ASSIST.koteDrop.p=1] [--json=파일]
//  agg  : node tools/sim/kote_pickup.mjs agg <json …>   (깔때기 표 — Markdown)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { CONFIG, THREE } from './harness_m.mjs';
import { fightOne } from './school_balance.mjs';
import { strokeTechOf } from '../../src/unique_assist.js';
import { isMain } from './is_main.mjs';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const UA = CONFIG.UNIQUE_ASSIST;
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });
/** --set=A.b.c=1,… (이 프로세스 안에서만 — school_balance applySets 와 같은 꼴) */
export function applySets(s) {
  for (const kv of (s ?? '').split(',').filter(Boolean)) {
    const [path, v] = kv.split('=');
    const keys = path.split('.');
    let o = CONFIG;
    for (const k of keys.slice(0, -1)) o = o[k];
    o[keys.at(-1)] = v === 'true' ? true : v === 'false' ? false : Number.isNaN(+v) ? v : +v;
  }
}
const _v = new THREE.Vector3();
const _a = new THREE.Vector3();
const velAt = (st, point, out) => out.copy(point).sub(st.com).cross(st.w).negate().add(st.v); // combat.js velAt 과 같은 셈 (스텝 전 칼 상태)

/** 손목 치기 탐침을 판에 건다 (fightOne onRound): 칼날 ↔ 상대 아래팔 물리 닿음 · 칼끼리 새 부딪힘(koteSword 를 부르는 문 — 새 · 충격 > 0) */
export function koteProbe({ G, P, A }) {
  const C = G.combat;
  const ev = [];
  const t = () => r3(G.t / K);
  const strike0 = C.strike.bind(C);
  C.strike = (pr, point, passing) => {
    const hit = pr.w.fighter === P && pr.v.fighter === A && (pr.v.part === 'farmS' || pr.v.part === 'farmO');
    const cool = hit ? A.hitCooldowns.has(`${P.index}:${pr.v.part}`) : false;
    const tech = hit ? strokeTechOf(P) === 'kote' : false;
    const armed = A.armed;
    const r = strike0(pr, point, passing);
    let E = r?.energy;
    if (hit && armed && !r) { const S = P.cache?.sword, Q = A.cache?.parts?.[pr.v.part]; const a = S && Q ? C.analyze(pr, point, S, Q, true) : null; E = a?.energy; } // 판정이 안 난 닿음의 에너지 (예측 셈 — 상처 없음)
    if (hit && armed) ev.push({ t: t(), k: 'arm', part: pr.v.part, grip: !!A.gripping, r: !!r, E: r3(E), sev: r3(r?.severity), type: r?.type ?? null, cool, tech, passing: !!passing });
    return r;
  };
  const ks0 = C.koteSword.bind(C);
  C.koteSword = (Af, Bf, SA, SB, point, nrm, vn) => {
    for (const [att, vic, S, sg] of [[Af.fighter, Bf.fighter, SA, 1], [Bf.fighter, Af.fighter, SB, -1]]) {
      if (att !== P || vic !== A || !vic.armed || !vic.sword || !vic.weaponCfg) continue;
      const into = sg * velAt(S, point, _v).dot(nrm);
      const q = vic.sword.rotation();
      const ax = _a.set(0, 1, 0).applyQuaternion(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      const o = vic.sword.translation();
      const at = (_v.copy(point).sub(new THREE.Vector3(o.x, o.y, o.z)).dot(ax) - vic.weaponCfg.hiltLength) / vic.weaponCfg.bladeLength;
      ev.push({ t: t(), k: 'clash', vn: r3(vn), into: r3(into), at: r3(at), tech: strokeTechOf(P) === 'kote' });
    }
    return ks0(Af, Bf, SA, SB, point, nrm, vn);
  };
  return { ev, C };
}

/** 한 판 (손목 치기 몫 판) + 탐침 → 판 결과에 kote 칸 */
export function rateOne({ school = 'japanese', weapon, opp, seed, dur, tech }) {
  let probe = null;
  const r = fightOne({ school, weapon, opp, seed, dur, tech, focus: 'kote', onRound: (o) => (probe = koteProbe(o)) });
  const log = (probe.C.koteLog ?? []).map((x) => ({ ...x, t: r3(x.t / K) }));
  const kotes = r.fires.filter((f) => f.name === 'kote');
  const all = r.fires;
  const K_ = UA.koteDrop;
  r.kote = kotes.map((f) => {
    const i = all.indexOf(f);
    const t1 = Math.min(f.t + 0.8, all[i + 1]?.t ?? Infinity); // 그 손목 치기의 닿음 창 = 낸 뒤 0.8 실제 s 또는 다음 기술 전까지
    const e = probe.ev.filter((x) => x.t >= f.t - 1e-9 && x.t < t1);
    const arm = e.filter((x) => x.k === 'arm' && (x.part === 'farmS' || x.grip));
    const clash = e.filter((x) => x.k === 'clash');
    const half = clash.filter((x) => x.at <= K_.swordHalf);
    const rolls = log.filter((x) => x.t >= f.t - 1e-9 && x.t < t1);
    return {
      t: f.t, d: f.d, dis1: f.dis1,
      land: arm.length > 0 || half.length > 0, landArm: arm.length > 0, landHalf: half.length > 0,
      armE: arm.length ? Math.max(...arm.map((x) => x.E ?? 0)) : null,
      armR: arm.some((x) => x.r), armTech: arm.some((x) => x.tech), armOk: arm.some((x) => x.r && x.tech), armCut: arm.some((x) => x.r && x.tech && x.type === 'cut' && x.sev > 0), armCool: arm.some((x) => x.cool),
      halfVn: half.length ? Math.max(...half.map((x) => x.vn)) : null, halfInto: half.length ? Math.max(...half.map((x) => x.into)) : null, halfTech: half.some((x) => x.tech),
      halfOk: half.some((x) => x.tech && x.vn > K_.swordVn && x.into > 0.5),
      clashAny: clash.length, clashAt: clash.length ? Math.min(...clash.map((x) => x.at)) : null,
      rolls: rolls.length, drops: rolls.filter((x) => x.drop).length,
      ev: e.map((x) => ({ ...x, dt0: r3(x.t - f.t) })), // 날것 (분포 보기)
    };
  });
  r.koteEv = probe.ev.length;
  r.koteRolls = log.length; // 판 전체 굴림 · 떨굼 (긋기 창과 상관없이 — combat.koteLog)
  r.koteDrops = log.filter((x) => x.drop).length;
  return r;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '–');
/** 깔때기 묶음 */
export function funnel(runs) {
  const ks = runs.flatMap((r) => r.kote ?? []);
  const n = ks.length;
  const c = (f) => ks.filter(f).length;
  return {
    runs: runs.length, fired: n,
    land: c((k) => k.land), landArm: c((k) => k.landArm), landHalf: c((k) => k.landHalf),
    armR: c((k) => k.landArm && k.armR), armTech: c((k) => k.landArm && k.armTech), armOk: c((k) => k.armOk), armCut: c((k) => k.armCut),
    halfTech: c((k) => k.landHalf && k.halfTech), halfVn: c((k) => k.landHalf && k.halfVn > UA.koteDrop.swordVn), halfOk: c((k) => k.halfOk),
    judged: c((k) => k.armOk || k.halfOk), rolled: c((k) => k.rolls > 0), dropped: c((k) => k.drops > 0), dis1: c((k) => k.dis1),
    dropLand: c((k) => k.land && k.drops > 0),
    koteDrops: runs.reduce((s, r) => s + (r.koteDrops ?? 0), 0), dropFights: runs.filter((r) => (r.koteDrops ?? 0) > 0).length,
    win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length, disarms: runs.reduce((s, r) => s + (r.disarms ?? 0), 0),
  };
}
export function funnelMarkdown(groups) {
  const out = ['| 묶음 | 판 | 낸 손목 치기 | 닿음 (아래팔 · 칼 손 쪽 절반) | 아래팔 | 칼 반쪽 | 아래팔 판정 남(에너지 · 식힘) | 아래팔 기술 창 | 아래팔 굴림 문 | 칼 반쪽 기술 창 | 칼 반쪽 vn > 문턱 | 칼 반쪽 굴림 문 | 굴림 | 떨굼 | **떨굼 / 닿음** | 떨굼 / 낸 수 | 판 전체 손목 치기 떨굼 (떨군 판) | 이김 · 짐 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'];
  for (const [name, runs] of groups) {
    const F = funnel(runs);
    out.push(`| ${name} | ${F.runs} | ${F.fired} | ${F.land} (${pct(F.land, F.fired)}) | ${F.landArm} | ${F.landHalf} | ${F.armR} | ${F.armTech} | ${F.armOk} | ${F.halfTech} | ${F.halfVn} | ${F.halfOk} | ${F.rolled} | ${F.dropped} | **${pct(F.dropLand, F.land)}** | ${pct(F.dropped, F.fired)} | ${F.koteDrops} (${F.dropFights}) | ${F.win} · ${F.lose} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const files = rest.filter((x) => !x.startsWith('--'));
    const groups = new Map();
    for (const p of files) { const J = JSON.parse(readFileSync(p, 'utf8')); const g = J.tag || p; groups.set(g, [...(groups.get(g) ?? []), ...J.runs]); }
    console.log(funnelMarkdown([...groups]));
  } else if (mode === 'rate') {
    applySets(arg('set', ''));
    const cells = arg('cells', 'japanese:uchigatana:longsword,japanese:uchigatana:uchigatana').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const runs = [];
    const t0 = Date.now();
    for (const c of cells) {
      const [school, weapon, opp] = c.split(':');
      for (const seed of seeds) {
        const r = rateOne({ school, weapon, opp, seed, dur: +arg('dur', 30), tech: +arg('tech', 0.6) });
        delete r.fires; delete r.wants; delete r.acts;
        r.cell = c;
        runs.push(r);
        console.error(JSON.stringify({ c, seed, kote: r.kote.length, land: r.kote.filter((k) => k.land).length, drops: r.kote.filter((k) => k.drops).length, ms: Date.now() - t0 }));
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set: arg('set', ''), cells, seeds, runs }));
    console.log(funnelMarkdown([[arg('tag', 'run'), runs]]));
  } else console.log('modes: rate | agg');
}
