// ─────────────────────────────────────────────────────────────
//  thrust_stuck.mjs — 찌르기 박힘 · 칼 놓침 · 무시된 공격 재기 (사장님 11/15 '지금 찌르기가 좀 이상해. 상대 몸에 박혀서 안 뽑히기도 하고 그러다 칼을 떨어뜨리기도 함.
//   공격이 종종 무시될 때도 있어.' — 기록 docs/strike/thrust_stuck_2026-11-15.md).
//   유파 밸런스 손가락 봇(school_balance.mjs fightOne — 사람 몸을 실제 입력 길로) 대 AI(숙련 SB_FOE_PROF · 기본 5). 게임 값은 이 프로세스 안에서만 바꾼다(판 arm).
//   읽기만 하는 꽂개(probe): combat.analyze · strike 를 감싸 사람 칼 → 상대 몸 닿음마다 갈래(italian_outbox.js itThrustKind) · 판정 에너지 · 물리 에너지 · 박힘을 적고,
//    가르는 칼 장부(combat.cutting)를 스텝마다 보아 박힌 칼이 몸 안에 머문 시간 · 칼 놓침(P.armed 꺼짐 — 까닭) · 봇 탭마다 공격이 났나(아니면 까닭)를 센다.
//  node tools/sim/thrust_stuck.mjs run --arm=main --cells=italian:rapier:longsword --seeds=1-12 --out=x.jsonl
//  node tools/sim/thrust_stuck.mjs agg x.jsonl ...
// ─────────────────────────────────────────────────────────────
import { appendFileSync, readFileSync } from 'node:fs';
import { isMain } from './is_main.mjs';

/** 판(arm): 이 프로세스 안 config 덮어쓰기 — 키 'GROUP.key' = 값 (realS 는 붙은 값 그대로) */
export const ARMS = {
  dev: {}, // 개발 가지 머리 (사람 박자 찌르기 끔 — beatHuman 0)
  main: { 'IT_OUTBOX.beatHuman': 1 }, // main 3e3e4452 와 같은 판 (사람 박자 찌르기 켬)
  mul1: { 'IT_OUTBOX.beatHuman': 1, 'IT_OUTBOX.thrustMul': 1 }, // main + 찌르기 판정 배율 1 (`?itThrustMul=1`)
  devmul1: { 'IT_OUTBOX.thrustMul': 1 },
  fix: { 'STRIKE.hitKPhys': 1 }, // 고침 1 (약화 배율은 상처에만 — 가름 · 판정 문턱 · 박힘 · 끌림은 배율 전)
  lodge: { 'STRIKE.lodgeHold': 1 }, // 고침 2 (박힌 칼 깊이 붙잡기)
  both: { 'STRIKE.hitKPhys': 1, 'STRIKE.lodgeHold': 1 },
  fixmain: { 'IT_OUTBOX.beatHuman': 1, 'STRIKE.hitKPhys': 1 },
  lodgemain: { 'IT_OUTBOX.beatHuman': 1, 'STRIKE.lodgeHold': 1 },
  drive1: { 'THRUST.drive': 1 }, // 사람 탭 찌르기 당김 0.3 (§2)
  drive2: { 'THRUST.drive': 2 }, // 사람 탭 찌르기 몸 싣기 (런지 0.45 · 실림 · 뻗은 채 머묾)
  drive3: { 'THRUST.drive': 3 }, // 둘 다
  drive3lodge: { 'THRUST.drive': 3, 'STRIKE.lodgeHold': 1 },
  riso1: { 'SECRET.risolutoHitMul': 1 }, // 견줌: 리솔루토 판정 배율 1
  off: { 'IT_OUTBOX.on': 0 }, // 견줌: 아웃복싱 넷 모두 끔
};

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; });

function setPath(CONFIG, key, v) {
  const ks = key.split('.');
  const o = ks.slice(0, -1).reduce((a, k) => a[k], CONFIG);
  const old = o[ks.at(-1)];
  o[ks.at(-1)] = v;
  return () => (o[ks.at(-1)] = old);
}

/** 한 판 — 판(arm)을 넣고 fightOne 을 돌려 셈을 돌려줌 */
export async function runOne({ arm, cell, seed, bot = 'outbox', foeProf = 5, sets = {} }) {
  process.env.SB_IT_BOT = bot;
  process.env.SB_FOE_PROF = String(foeProf);
  const { fightOne } = await import('./school_balance.mjs');
  const { CONFIG, DT } = await import('./harness_m.mjs');
  const { itThrustKind } = await import('../../src/italian_outbox.js');
  const { closeInputGate } = await import('../../src/close_hold.js');
  const THREE = await import('three');
  const undo = [];
  for (const [k, v] of Object.entries({ ...ARMS[arm], ...sets })) {
    if (k.split('.').slice(0, -1).reduce((a, x) => a?.[x], CONFIG) == null) throw new Error(`없는 값 ${k}`);
    undo.push(setPath(CONFIG, k, v));
  }
  const K = CONFIG.TIME.k;
  const ST = CONFIG.STRIKE;
  const [school, weapon, opp] = cell.split(':');
  try {
    let G, P, A, uq, W;
    const contacts = []; // 사람 칼 → 상대 몸 닿음 (strike 부름마다)
    const atks = new Map(); // 공격(물체) → 기록
    const lodges = []; // 가르는 칼 장부 (사람 칼)
    const cutSeen = new Map();
    const drops = [];
    const breaks = [];
    const taps = []; // 봇 탭
    const calls = []; // skill.thrust 부름
    const starts = []; // 공격 시작 (박힌 채 시작했나)
    let lastAct = null, armed = true, broken = false, atkN = 0, lastAtk = null;
    const grip = { max: 0, lodgeMax: 0, over5: 0, over10: 0 }; // 손목(아래팔 끝) ↔ 칼자루 벌어짐 (m — 손에서 칼이 빠져 보이는 몫)
    const _w = new THREE.Vector3(), _q = new THREE.Quaternion();
    const gripGap = () => { if (!P.armed || !P.sword) return 0; const fa = P.bodies.farmS, r = fa.rotation(), tr = fa.translation(); _w.set(0.13, 0, 0).applyQuaternion(_q.set(r.x, r.y, r.z, r.w)).add(tr); const s = P.sword.translation(); return Math.hypot(_w.x - s.x, _w.y - s.y, _w.z - s.z); };
    const t = () => G.t / K;
    const atkObj = () => P.skill.sec ?? P.iai ?? P.skill.tap ?? P.parryGuard?.opposition?.run ?? (P.stamina?.stroke?.paid && P.stamina.stroke.kind === 'thrust' ? P.stamina.stroke : null) ?? null;
    const lodgedNow = () => { for (const c of G.combat.cutting.values()) if (c.pr.w.fighter === P && c.applied && c.pr.v.fighter === A) return c.stuckT > 0 ? 'hold' : 'in'; return null; };
    const probe = {
      init(o) {
        ({ G, P, A, uq, W } = o);
        const C = G.combat;
        let lastA = null;
        const an = C.analyze.bind(C);
        C.analyze = (pr, point, S, Pp, predicting = false) => {
          const r = an(pr, point, S, Pp, predicting);
          if (!predicting) lastA = r;
          return r;
        };
        const st = C.strike.bind(C);
        C.strike = (pr, point, passing) => {
          if (pr.w.fighter !== P || pr.v.fighter !== A) return st(pr, point, passing);
          const cool = A.hitCooldowns.has(`${P.index}:${pr.v.part}`);
          const kind = itThrustKind(P);
          const obj = atkObj();
          lastA = null;
          const r = st(pr, point, passing);
          const a = lastA;
          const why = r ? 'judged' : cool && !passing ? 'cool' : !a ? 'noAn' : cool ? 'coolPass' : 'under';
          const E1 = a ? a.ephys * ST.energyScale : null; // 배율 전 판정 에너지 (칼날 · 찌르기 — 둔기는 무기 배율이 더 붙음)
          const c = { t: r3(t()), d: r3(P.foeDistance()), kind, passing, why, type: a?.type ?? null, part: pr.v.part, E: r3(a?.energy), E1: r3(E1), hk: a && a.type !== 'blunt' && E1 > 0 ? r3(a.energy / E1) : null, absorb: a?.absorb ?? null, stuck: r ? !!r.stuck : false, sev: r3(r?.severity ?? 0), sp: r3(a?.speed) };
          contacts.push(c);
          if (obj && kind) {
            let R = atks.get(obj);
            if (!R) atks.set(obj, (R = { t: c.t, kind, n: 0, judged: 0, under: 0, cool: 0, noAn: 0, stuck: 0, sev: 0, Emax: 0, E1max: 0, stab: 0 }));
            R.n++;
            if (why === 'judged') R.judged++;
            else if (why === 'under') R.under++;
            else if (why === 'noAn') R.noAn++;
            else R.cool++;
            if (c.stuck) R.stuck++;
            if (c.type === 'stab') R.stab++;
            R.sev += c.sev;
            R.Emax = Math.max(R.Emax, c.E ?? 0);
            R.E1max = Math.max(R.E1max, c.E1 ?? 0);
          }
          return r;
        };
        const th = P.skill.thrust.bind(P.skill);
        P.skill.thrust = (o = {}) => {
          const s = P.skill;
          const pre = s.tap ? (s.tap.uniqTech ? `tap:${s.tap.uniqTech}` : 'tap') : s.pom ? 'pom' : s.vitalRange ? 'vital' : P.stamina.exhausted ? 'exh' : !P.armed ? 'unarmed' : P.state !== 'stand' && P.state !== 'kneel' ? `state:${P.state}` : null;
          const f0 = Object.values(uq.stats.fired).reduce((a, b) => a + b, 0);
          const tap0 = s.tap;
          const ok = th(o);
          const f1 = Object.values(uq.stats.fired).reduce((a, b) => a + b, 0);
          calls.push({ t: r3(t()), ok, pre, special: f1 > f0, newTap: !!s.tap && s.tap !== tap0, vital: !!s.vitalRange, lodged: lodgedNow(), iai: !!P.iai, sec: !!s.sec });
          return ok;
        };
      },
      step(cur, act) {
        const now = t();
        // 봇 탭 (새 뜻이 탭 · 옆 탭)
        if (act && act !== lastAct && (act.kind === 'tap' || act.kind === 'sideTap')) { const cg = closeInputGate(P, W); taps.push({ t: r3(act.t), kind: act.kind, want: act.want ?? null, atk0: atkN, call0: calls.length, lodged: lodgedNow(), win: !!W.open, busy: P.stamina.exhausted ? 'exh' : P.skill.secretPhase ? 'secret' : null, close: cg.lock ? 'lock' : cg.near ? 'near' : null, pom0: P.skill.pommels ?? 0 }); }
        const gg = gripGap();
        grip.max = Math.max(grip.max, gg);
        if (lodgedNow()) grip.lodgeMax = Math.max(grip.lodgeMax, gg);
        if (gg > 0.05) grip.over5 += DT / K;
        if (gg > 0.1) grip.over10 += DT / K;
        lastAct = act;
        // 공격 시작 셈
        const o = atkObj();
        if (o && o !== lastAtk) { atkN++; starts.push({ obj: o, t: r3(now), kind: itThrustKind(P), lodged: lodgedNow() }); }
        lastAtk = o;
        // 가르는 칼 장부
        const live = new Set();
        for (const c of G.combat.cutting.values()) {
          if (c.pr.w.fighter !== P || c.pr.v.fighter !== A || !c.applied) continue;
          live.add(c);
          let L = cutSeen.get(c);
          if (!L) cutSeen.set(c, (L = { t0: now, stuck: !!c.stuck, hold: 0, part: c.pr.v.part, kind: itThrustKind(P), atk: atkObj() }));
          if (c.stuckT > 0) L.hold += DT / K;
          L.t1 = now;
        }
        for (const [c, L] of cutSeen) if (!live.has(c)) { lodges.push({ t0: r3(L.t0), life: r3(L.t1 - L.t0), stuck: L.stuck, part: L.part, kind: L.kind }); cutSeen.delete(c); }
        // 칼 놓침 · 부러짐
        if (armed && !P.armed) {
          const kl = (G.combat.koteLog ?? []).filter((x) => x.vic === P.index && x.drop).at(-1);
          const why = kl && Math.abs(kl.t - G.t) < 0.05 ? 'kote' : P.severedLimbs?.has?.('armS') ? 'sever' : (P.limbs?.armS ?? 1) < CONFIG.VITALS.dropSwordArm ? 'arm' : 'other';
          const near = lodges.concat([...cutSeen.values()].map((L) => ({ t0: r3(L.t0), life: r3(now - L.t0), stuck: L.stuck }))).filter((L) => L.stuck && now - (L.t0 + L.life) <= 1.2 && now >= L.t0);
          drops.push({ t: r3(now), why, armS: r3(P.limbs?.armS), afterLodge: near.length > 0, lodgedNow: lodgedNow() });
        }
        armed = P.armed;
        if (!broken && P.weaponBroken) breaks.push({ t: r3(now), lodgedNow: lodgedNow() });
        broken = !!P.weaponBroken;
      },
      done() {
        for (const [, L] of cutSeen) lodges.push({ t0: r3(L.t0), life: r3(L.t1 - L.t0), stuck: L.stuck, part: L.part, kind: L.kind, open: true });
        // 탭마다 결과: 0.4 실제 s 안에 공격이 났나 · 아니면 thrust 부름의 까닭
        const tapRes = taps.map((x, i) => {
          const nextT = taps[i + 1]?.t ?? Infinity;
          const cs = calls.filter((c) => c.t >= x.t - 1e-6 && c.t <= Math.min(x.t + 0.4, nextT));
          const started = cs.some((c) => c.ok);
          const why = started ? (cs.find((c) => c.ok).special ? 'special' : cs.find((c) => c.ok).vital ? 'vital' : 'tap') : x.win ? 'window' : !cs.length ? (x.close ? `close:${x.close}` : x.busy ?? 'noCall') : cs[0].pre ?? 'other';
          return { ...x, started, why, lodgedAtCall: cs[0]?.lodged ?? null };
        });
        const inStarts = starts.filter((x) => x.lodged && x.kind).map((x) => ({ t: x.t, kind: x.kind, lodged: x.lodged, judged: atks.get(x.obj)?.judged ?? 0, touched: !!atks.get(x.obj) }));
        return { inStarts, startsN: starts.filter((x) => x.kind).length, contacts, atks: [...atks.values()], lodges, drops, breaks, taps: tapRes, grip: { max: r3(grip.max), lodgeMax: r3(grip.lodgeMax), over5: r3(grip.over5), over10: r3(grip.over10) } };
      },
    };
    const r = fightOne({ school, weapon, opp, seed, probe });
    return { arm, cell, seed, T: r.T, win: r.win, lose: r.lose, dealt: r.dealt, recv: r.recv, secretFired: r.secretFired, ...r.probe };
  } finally {
    for (const u of undo.reverse()) u();
  }
}

/** 판 묶음 → 표 줄 (판당) */
export function summarize(runs) {
  const n = runs.length;
  const per = (x) => (x / n).toFixed(2);
  const A = runs.flatMap((r) => r.atks);
  const touched = A.length;
  const judgedAtk = A.filter((a) => a.judged > 0).length;
  const ignAtk = A.filter((a) => a.judged === 0).length; // 몸에 닿았는데 판정이 하나도 안 남
  const ignUnder = A.filter((a) => a.judged === 0 && a.under > 0).length;
  const C = runs.flatMap((r) => r.contacts.filter((c) => c.kind));
  const under = C.filter((c) => c.why === 'under');
  const underK = under.filter((c) => c.hk != null && c.hk < 1 && c.E1 >= 6).length; // 배율이 없었으면 문턱을 넘었을 닿음
  const L = runs.flatMap((r) => r.lodges);
  const stuck = L.filter((x) => x.stuck && x.kind); // 찌르기 박힘 (갈래가 찌르기 — itThrustKind)
  const stuckAll = L.filter((x) => x.stuck); // 베기까지
  const stuckJ = C.filter((c) => c.why === 'judged' && c.passing);
  const stuckK = stuckJ.filter((c) => c.stuck && c.E1 != null && c.E1 > c.absorb && c.type !== 'blunt').length; // 배율이 없었으면 안 박혔을 닿음
  const D = runs.flatMap((r) => r.drops);
  const B = runs.flatMap((r) => r.breaks);
  const T = runs.flatMap((r) => r.taps);
  const tNo = T.filter((x) => !x.started && x.why !== 'window'); // 비기 창의 탭(window)은 비기가 받음 — 무시 아님
  const why = {};
  for (const x of tNo) why[x.why] = (why[x.why] ?? 0) + 1;
  const dwhy = {};
  for (const d of D) dwhy[d.why] = (dwhy[d.why] ?? 0) + 1;
  const kinds = {};
  for (const a of A) { const k = (kinds[a.kind] ??= { n: 0, ign: 0, stuck: 0 }); k.n++; if (!a.judged) k.ign++; if (a.stuck) k.stuck++; }
  const lifeSt = stuck.map((x) => x.life).sort((a, b) => a - b);
  return {
    n, win: runs.filter((r) => r.win).length, lose: runs.filter((r) => r.lose).length,
    touch: per(touched), judged: per(judgedAtk), ign: per(ignAtk), ignUnder: per(ignUnder), ignShare: touched ? ((100 * ignAtk) / touched).toFixed(0) : '–',
    under: per(under.length), underK: per(underK), lodge: per(stuck.length), lodgeAll: per(stuckAll.length), lodgeShare: stuckJ.length ? ((100 * stuckJ.filter((c) => c.stuck).length) / stuckJ.length).toFixed(0) : '–', stuckK: per(stuckK),
    lodgeLifeP50: lifeSt.length ? lifeSt[Math.floor(lifeSt.length / 2)].toFixed(2) : '–', lodgeLifeMax: lifeSt.length ? lifeSt.at(-1).toFixed(2) : '–', lodge1: per(stuck.filter((x) => x.life >= 1.0).length),
    drops: per(D.length), dropsLodge: per(D.filter((d) => d.afterLodge || d.lodgedNow).length), dwhy, breaks: per(B.length),
    inStart: per(runs.reduce((s, r) => s + (r.inStarts?.length ?? 0), 0)), inStartNo: per(runs.reduce((s, r) => s + (r.inStarts?.filter((x) => !x.judged).length ?? 0), 0)), startsN: per(runs.reduce((s, r) => s + (r.startsN ?? 0), 0)),
    taps: per(T.length), tapNo: per(tNo.length), tapNoShare: T.length ? ((100 * tNo.length) / T.length).toFixed(0) : '–', tapWhy: why, tapNoLodged: per(tNo.filter((x) => x.lodged || x.lodgedAtCall).length),
    gripMax: Math.max(0, ...runs.map((r) => r.grip?.max ?? 0)).toFixed(3), gripLodge: Math.max(0, ...runs.map((r) => r.grip?.lodgeMax ?? 0)).toFixed(3), grip5: per(runs.reduce((s, r) => s + (r.grip?.over5 ?? 0), 0)),
    dealt: (runs.reduce((s, r) => s + r.dealt, 0) / n).toFixed(2), recv: (runs.reduce((s, r) => s + r.recv, 0) / n).toFixed(2), kinds,
  };
}

export function aggMarkdown(runs) {
  const by = new Map();
  for (const r of runs) { const k = `${r.arm}|${r.cell}`; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const out = ['| 판 | 칸 | 판 수 | 이김·짐 | 몸에 닿은 찌르기/판 | 판정 난 찌르기/판 | 판정 없는 찌르기/판 (문턱 밑) · 몫 | 문턱 밑 닿음/판 (배율 없었으면 넘음) | 찌르기 박힘/판 [베기까지] (가른 찌르기 닿음 중 몫) · 배율 없었으면 안 박힘/판 | 박힌 찌르기 칼 몸 안 시간 p50 · 최대 s · 1 s 넘음/판 | 칼 놓침/판 (박힘 뒤) · 까닭 | 칼 부러짐/판 | 봇 탭/판 · 공격 안 남/판 (몫) · 까닭 | 준 · 받은 심각도/판 |', '|---|---|---:|---|---:|---:|---|---|---|---|---|---:|---|---|'];
  for (const [k, R] of by) {
    const [arm, cell] = k.split('|');
    const s = summarize(R);
    out.push(`| ${arm} | ${cell} | ${s.n} | ${s.win}·${s.lose} | ${s.touch} | ${s.judged} | ${s.ign} (${s.ignUnder}) · ${s.ignShare} % | ${s.under} (${s.underK}) | ${s.lodge} [${s.lodgeAll}] (${s.lodgeShare} %) · ${s.stuckK} | ${s.lodgeLifeP50} · ${s.lodgeLifeMax} · ${s.lodge1} | ${s.drops} (${s.dropsLodge}) ${JSON.stringify(s.dwhy)} | ${s.breaks} | ${s.taps} · ${s.tapNo} (${s.tapNoShare} %) ${JSON.stringify(s.tapWhy)} | ${s.dealt} · ${s.recv} |`);
  }
  out.push('', '| 판 | 칸 | 갈래별 (닿은 공격 · 판정 없음 · 박힘) | 손목 ↔ 칼자루 벌어짐 최대 m (박힌 동안) · 5 cm 넘은 s/판 | 찌르기 시작/판 · 그 가운데 칼이 몸 안에 든 채 시작/판 (판정 없음) |', '|---|---|---|---|---|');
  for (const [k, R] of by) {
    const [arm, cell] = k.split('|');
    const s = summarize(R);
    out.push(`| ${arm} | ${cell} | ${Object.entries(s.kinds).map(([kk, v]) => `${kk} ${v.n} · ${v.ign} · ${v.stuck}`).join(' / ')} | ${s.gripMax} (${s.gripLodge}) · ${s.grip5} | ${s.startsN} · ${s.inStart} (${s.inStartNo}) |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    console.log(aggMarkdown(runs));
  } else {
    const arms = arg('arm', 'dev').split(',');
    const cells = arg('cells', 'italian:rapier:longsword').split(',');
    const seeds = range(arg('seeds', '1-12'));
    const out = arg('out', null);
    const sets = Object.fromEntries(arg('set', '').split(',').filter(Boolean).map((kv) => { const [k, v] = kv.split('='); return [k, Number.isNaN(+v) ? v : +v]; }));
    const runs = [];
    for (const arm of arms) for (const cell of cells) for (const seed of seeds) {
      const r = await runOne({ arm, cell, seed, bot: arg('bot', 'outbox'), foeProf: +arg('prof', 5), sets });
      runs.push(r);
      if (out) appendFileSync(out, JSON.stringify(r) + '\n');
      const s = summarize([r]);
      console.error(JSON.stringify({ arm, cell, seed, win: r.win, lose: r.lose, touch: s.touch, ign: s.ign, lodge: s.lodge, drops: s.drops, tapNo: s.tapNo }));
    }
    if (!out) console.log(aggMarkdown(runs));
  }
}
