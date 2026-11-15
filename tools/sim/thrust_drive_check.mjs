// ─────────────────────────────────────────────────────────────
//  thrust_drive_check.mjs — 사람 탭 찌르기 몸 싣기(THRUST.drive) 런지가 유파 걸음 · 다른 런지와 겹치나 (사장님 11/15 '3-1과 3-2만 해. 3-2는 런지가 이탈리아 보법이나 런지와 겹쳐서
//   움직임이 이상해지는지 확인 필요.' — 기록 docs/strike/thrust_stuck_2026-11-15.md §7). 재기만(게임 값은 --set 으로 이 프로세스 안에서만).
//   걸음 부탁(gait.requestStep)을 감싸 누가 냈나(탭 · 그 밖) · 받아들여졌나 · 그때 앞 탭의 런지 부탁이 아직 남았나(딛기 전 — gait.req 그대로)를 적고, 탭 하나(skill.tap)마다:
//    겹침 = 탭 런지가 딛기 전에 다른 걸음 부탁이 덮음(또는 탭 런지가 남의 부탁을 덮음) · 두 번 디딤 = 탭 동안 발 디딤 2 번 넘음 · 미끄러짐 = 골반이 부탁한 걸음 × 1.5 + 0.15 m 넘게 감 ·
//    발 엇갈림 = 탭 동안 앞뒤 발 차례가 바뀜(런지는 앞발이 앞 그대로) · 팔 먼저 = 탭이 끝날 때 몸이 갈 길의 절반도 못 감 · 안 풀림 = 뻗은 채 머문 시간(탭 시계가 멈춘 시간) 0.6 s 넘음
//  node tools/sim/thrust_drive_check.mjs fight --cells=italian:rapier:longsword,... --seeds=1-8 --drives=0,3 [--out=x.jsonl]   (손가락 봇 대 AI 숙련 5)
//  node tools/sim/thrust_drive_check.mjs scene --cells=italian:rapier,... --scenes=stand,walk,double --drives=0,3 --dir=<폴더>   (짠 장면 · 그림 json)
//  node tools/sim/thrust_drive_check.mjs agg x.jsonl
// ─────────────────────────────────────────────────────────────
import { appendFileSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { isMain } from './is_main.mjs';

const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const o = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; });

/** 탭 · 걸음 엿보기 (P = 사람 몸) — 스텝마다 step() · 끝에 done() */
export function makeWatch(P, G, THREE, K, DT) {
  const reqs = []; // 걸음 부탁
  const taps = [];
  let inThrust = false, cur = null, tdN = 0, prevStance = null;
  const lift = [null, null]; // 발 든 자리 (F · B)
  const tds = []; // 디딤 { t, leg, fwd(든 자리 → 디딘 자리 · 앞 몫 m) }
  const g = P.gait;
  if (g?.requestStep) {
    const rs = g.requestStep.bind(g);
    g.requestStep = (o = {}) => {
      const pend = g.req; // 덮기 전 부탁
      const ok = rs(o);
      const src = inThrust ? 'tap' : (new Error().stack.split('\n')[2] ?? '').replace(/^\s*at\s+/, '').replace(/\(.*\/(src|tools)\//, '($1/').slice(0, 80);
      const e = { t: r3(G.t / K), kind: o.kind ?? 'pass', fwd: r3(o.fwd ?? 0.5), push: o.push ?? null, accel: !!o.accel, ok, src, pend: pend ? (pend === cur?.req ? 'tapReq' : pend.kind) : null };
      reqs.push(e);
      if (ok && inThrust && cur) { cur.req = g.req; cur.reqFwd = e.fwd; cur.reqPush = e.push; if (pend) cur.over = (cur.over ?? 0) + 1; }
      else if (ok && cur?.req && pend === cur.req) { cur.stacked = (cur.stacked ?? 0) + 1; (cur.stackBy ??= []).push(e.src); }
      return ok;
    };
  }
  const th = P.skill.thrust.bind(P.skill);
  P.skill.thrust = (o) => { // thrust 안에서 낸 걸음 부탁 = 탭 런지
    inThrust = true;
    try { return th(o); } finally { inThrust = false; }
  };
  const fwdOf = () => new THREE.Vector3(1, 0, 0).applyQuaternion(P.yaw);
  const pel = () => { const p = P.bodies.pelvis.translation(); return new THREE.Vector3(p.x, p.y, p.z); };
  const footOrder = (f) => { const a = P.bodies.footF.translation(), b = P.bodies.footB.translation(); return Math.sign((a.x - b.x) * f.x + (a.z - b.z) * f.z); };
  // 탭 런지 부탁을 thrust 안에서 받으려면 탭 물체를 thrust 전에 알아야 함 → thrust 부름 앞에서 cur 를 새로 만듦
  const th2 = P.skill.thrust;
  P.skill.thrust = (o) => {
    const prev = cur;
    const pre = { t0: r3(G.t / K), req: null };
    cur = pre;
    const ok = th2(o);
    const tp = P.skill.tap;
    if (ok && tp && !tp.down && (!prev || prev.obj !== tp)) {
      Object.assign(pre, { obj: tp, drive: !!tp.drive, it: !!tp.it, fwd: fwdOf(), p0: pel(), ord0: footOrder(fwdOf()), td0: tdN, tdI: tds.length, lastT: tp.t, freeze: 0, ext: [], maxTravel: 0 });
      taps.push(pre);
      if (prev && prev.obj && prev.t1 == null) prev.t1 = pre.t0;
    } else cur = prev;
    return ok;
  };
  return {
    reqs, taps,
    step() {
      const t = G.t / K;
      // 발 디딤 셈
      const L = g?.legs;
      if (L) {
        const st = [L.F.stance, L.B.stance];
        const ft = [P.bodies.footF.translation(), P.bodies.footB.translation()];
        const fw = fwdOf();
        if (prevStance) for (let i = 0; i < 2; i++) {
          if (!st[i] && prevStance[i]) lift[i] = { x: ft[i].x, z: ft[i].z };
          if (st[i] && !prevStance[i]) { tdN++; const a = lift[i]; tds.push({ t, leg: i ? 'B' : 'F', fwd: a ? (ft[i].x - a.x) * fw.x + (ft[i].z - a.z) * fw.z : 0 }); }
        }
        prevStance = st;
      }
      for (const x of taps) {
        if (x.done) continue;
        const tp = P.skill.tap;
        const alive = tp === x.obj;
        const d = pel().sub(x.p0).dot(x.fwd);
        if (alive) {
          if (Math.abs(tp.t - x.lastT) < 1e-9 && !tp.abort) x.freeze += DT / K;
          x.lastT = tp.t;
          x.travelAtEnd = d;
          x.tdIn = tdN - x.td0;
          x.fwdSteps = tds.slice(x.tdI).filter((d) => d.fwd > 0.12).length; // 앞으로 0.12 m 넘게 디딘 걸음
          if (footOrder(x.fwd) !== x.ord0 && footOrder(x.fwd) !== 0) x.cross = true;
        } else if (x.t1 == null) x.t1 = r3(t);
        x.maxTravel = Math.max(x.maxTravel, d);
        if (x.t1 != null && t > x.t1 + 0.3) x.done = true;
      }
    },
    done() {
      return taps.map((x) => { // 두 번 디딤 = 탭 동안 앞으로 0.12 m 넘게 디딘 걸음이 둘 넘음(뒷발 따라 붙이기는 앞 몫이 작음)
        const lim = (x.reqFwd ?? 0) * 1.5 + 0.15;
        const armFirst = x.maxTravel > 0.1 && x.travelAtEnd != null && x.travelAtEnd < 0.5 * x.maxTravel;
        return { t0: x.t0, t1: x.t1, dur: x.t1 != null ? r3(x.t1 - x.t0) : null, drive: x.drive, it: x.it, reqFwd: x.reqFwd ?? null, reqPush: x.reqPush ?? null, travel: r3(x.maxTravel), travelEnd: r3(x.travelAtEnd), freeze: r3(x.freeze), td: x.tdIn ?? 0, fwdSteps: x.fwdSteps ?? 0, stacked: x.stacked ?? 0, stackBy: x.stackBy ?? [], over: x.over ?? 0, cross: !!x.cross,
          an: { stack: (x.stacked ?? 0) + (x.over ?? 0) > 0, double: (x.fwdSteps ?? 0) > 1, slide: x.reqFwd != null && x.maxTravel > lim, cross: !!x.cross, armFirst, hold: x.freeze > 0.6 } };
      });
    },
  };
}

/** 손가락 봇 한 판 */
export async function fightRun({ cell, seed, drive, foeProf = 5, sets = {} }) {
  process.env.SB_IT_BOT = 'outbox';
  process.env.SB_FOE_PROF = String(foeProf);
  const { fightOne } = await import('./school_balance.mjs');
  const { CONFIG, DT, THREE } = await import('./harness_m.mjs');
  const keep = CONFIG.THRUST.drive;
  const undo = [];
  for (const [k, v] of Object.entries(sets)) { const ks = k.split('.'); const o = ks.slice(0, -1).reduce((a, x) => a[x], CONFIG); const old = o[ks.at(-1)]; o[ks.at(-1)] = v; undo.push(() => (o[ks.at(-1)] = old)); }
  CONFIG.THRUST.drive = drive;
  try {
    const [school, weapon, opp] = cell.split(':');
    let W = null;
    const r = fightOne({ school, weapon, opp, seed, probe: { init({ G, P }) { W = makeWatch(P, G, THREE, CONFIG.TIME.k, DT); }, step() { W.step(); }, done() { return { taps: W.done(), reqs: W.reqs.length } } } });
    return { cell, seed, drive, T: r.T, win: r.win, lose: r.lose, ...r.probe };
  } finally {
    CONFIG.THRUST.drive = keep;
    for (const u of undo.reverse()) u();
  }
}

/** 짠 장면 하나: stand = 칼끝 거리 + 0.4 에 서서 탭 · walk = 3.2 m 에서 걸어 들어가며(스틱 앞 0.7) 칼끝 거리 + 0.6 에서 탭 · double = stand 뒤 첫 탭이 끝나는 스텝에 다시 탭 ·
 *  riso = (이탈리아) 탭 0.1 s 뒤 리솔루토 실행부(skill.secret — 창 없이) · cut = 탭 0.1 s 뒤 내려베기 손가락 획(사람 베기 걸음) */
export async function sceneRun({ school, weapon, scene, drive }) {
  const { newRound, DT, THREE, CONFIG } = await import('./harness_m.mjs');
  const { allNodeIds, kitFromNodes } = await import('../../src/skill_tree_data.js');
  const { PlayerSecretWatch } = await import('../../src/secret.js');
  const { TECH_BY_NAME } = await import('../../src/ai_techniques.js');
  const K = CONFIG.TIME.k;
  const keep = { drive: CONFIG.THRUST.drive, hold: CONFIG.ARENA.startHold };
  CONFIG.THRUST.drive = drive;
  CONFIG.ARENA.startHold = 0;
  try {
    const kit = kitFromNodes(school, allNodeIds(school));
    const G0 = newRound({ weapon, weapon2: 'longsword', seed: 1, kit });
    const M = G0.player.swordArt.measure;
    G0.world.free();
    const gap = scene === 'walk' ? 3.2 : M.reach + 0.4;
    const mv = scene === 'walk' ? [0, 0.7] : scene === 'side' ? [0.7, 0] : [0, 0]; // 스틱 (옆 · 앞)
    const G = newRound({ weapon, weapon2: 'longsword', seed: 1, gap, walls: false, kit, onFighter(f) { if (f.index === 0) f.humanInput = true; } });
    const P = G.player, E = G.enemy;
    G.ai.update = () => E.move.set(0, 0);
    P.skill.corr = CONFIG.SKILL.corr; P.skill.corrTip = CONFIG.SKILL.corrTip; P.skill.autoGuard = true;
    const Wt = makeWatch(P, G, THREE, K, DT);
    for (let t = 0; t < 1.0 * K; t += DT) { P.move.set(0, 0); E.handOffset.set(0, -0.5); G.step(); }
    if (scene === 'walk') for (let t = 0; t < 6 * K && P.foeDistance() > M.reach + 0.6; t += DT) { P.move.set(...mv); E.handOffset.set(0, -0.5); G.step(); }
    if (scene === 'side') for (let t = 0; t < 0.8 * K; t += DT) { P.move.set(...mv); E.handOffset.set(0, -0.5); G.step(); } // 옆걸음 (이베리아 굽은 · 엇갈린 걸음)
    const steps = [];
    const t0 = G.t;
    const pts = () => { const p = (b) => { const x = P.bodies[b]?.translation(); return x ? [r3(x.x), r3(x.y), r3(x.z)] : null; }; return { head: p('head'), chest: p('chest'), pelvis: p('pelvis'), uarmS: p('uarmS'), farmS: p('farmS'), uarmO: p('uarmO'), farmO: p('farmO'), thighF: p('thighF'), thighB: p('thighB'), shinF: p('shinF'), shinB: p('shinB'), footF: p('footF'), footB: p('footB') }; };
    P.skill.thrust();
    let second = scene === 'double' ? 'wait' : null;
    let fired = null;
    const q = [];
    for (let i = 0; i < 1.4 * K / DT; i++) {
      const t = (G.t - t0) / K;
      if (second === 'wait' && !P.skill.tap) { P.skill.thrust(); second = r3(t); }
      if (scene === 'riso' && fired == null && !P.skill.tap) { // 탭이 끝나는 스텝에 리솔루토 실행부 (창 없이 — 비기는 탭 동안 못 냄)
        const Wsec = new PlayerSecretWatch(P, E, { locked: false });
        fired = Wsec.S ? (P.skill.secret({ S: Wsec.S, ctx: { path: 'scene' } }) ? r3(t) : 'refused') : 'none';
      }
      if (scene === 'cut' && fired == null && t >= 0.1) {
        const T = TECH_BY_NAME.zornhau;
        let fx = P.handOffset.x, fy = P.handOffset.y;
        for (const p of [T.from, ...T.path]) { const dx = p[0] - fx, dy = p[1] - fy, n = Math.max(1, Math.round(Math.hypot(dx, dy) / (4.25 / 60))); for (let k = 0; k < n; k++) q.push([dx / n, dy / n]); fx = p[0]; fy = p[1]; }
        fired = r3(t);
      }
      if (q.length && i % 2 === 0) { const [dx, dy] = q.shift(); P.handOffset.x += dx; P.handOffset.y += dy; P.handHeld = true; P.inputActive = true; } else if (!q.length) { P.handHeld = false; P.inputActive = false; }
      P.move.set(...mv);
      E.handOffset.set(0, -0.5);
      G.step();
      Wt.step();
      const tip = P.bladePoint(1, new THREE.Vector3()), s = P.sword.translation();
      steps.push({ t: r3((G.t - t0) / K), tap: !!P.skill.tap, sec: !!P.skill.sec, req: P.gait?.req?.kind ?? null, body: pts(), hand: [r3(s.x), r3(s.y), r3(s.z)], tip: [r3(tip.x), r3(tip.y), r3(tip.z)], stF: P.gait?.legs.F.stance ?? null, stB: P.gait?.legs.B.stance ?? null });
    }
    const out = { school, weapon, scene, drive, gap: r3(gap), second, fired, taps: Wt.done(), reqs: Wt.reqs, steps };
    G.world.free();
    return out;
  } finally {
    CONFIG.THRUST.drive = keep.drive;
    CONFIG.ARENA.startHold = keep.hold;
  }
}

export function aggMarkdown(runs) {
  const by = new Map();
  for (const r of runs) { const k = `${r.cell ?? `${r.school}:${r.weapon}:${r.scene}`}|${r.drive}`; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const out = ['| 칸 | drive | 판 | 탭 | 겹침 | 두 번 디딤 | 미끄러짐 | 발 엇갈림 | 팔 먼저 | 안 풀림 | 골반 감 p50 · 최대 m | 탭 길이 p50 · 최대 s | 머묾 최대 s | 겹친 부탁 |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|'];
  const q = (a, p) => { a = a.filter((x) => x != null).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length * p)] : null; };
  const f2 = (x) => (x == null ? '–' : x.toFixed(2));
  for (const [k, R] of by) {
    const [c, d] = k.split('|');
    const T = R.flatMap((r) => r.taps);
    const n = (key) => T.filter((x) => x.an[key]).length;
    const by2 = {};
    for (const x of T) for (const s of x.stackBy) by2[s.replace(/ \(.*/, '')] = (by2[s.replace(/ \(.*/, '')] ?? 0) + 1;
    out.push(`| ${c} | ${d} | ${R.length} | ${T.length} | ${n('stack')} | ${n('double')} | ${n('slide')} | ${n('cross')} | ${n('armFirst')} | ${n('hold')} | ${f2(q(T.map((x) => x.travel), 0.5))} · ${f2(Math.max(0, ...T.map((x) => x.travel ?? 0)))} | ${f2(q(T.map((x) => x.dur), 0.5))} · ${f2(Math.max(0, ...T.map((x) => x.dur ?? 0)))} | ${f2(Math.max(0, ...T.map((x) => x.freeze ?? 0)))} | ${Object.entries(by2).map(([a, b]) => `${a} ${b}`).join(' · ') || '–'} |`);
  }
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  const drives = arg('drives', '0,3').split(',').map(Number);
  if (mode === 'agg') {
    const runs = rest.filter((x) => !x.startsWith('--')).flatMap((p) => readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
    console.log(aggMarkdown(runs));
  } else if (mode === 'scene') {
    const dir = arg('dir', '.');
    mkdirSync(dir, { recursive: true });
    const runs = [];
    for (const c of arg('cells', 'german:longsword,italian:rapier,iberian:zweihander,japanese:uchigatana,chinese:hwando').split(',')) for (const scene of arg('scenes', 'stand,walk,double').split(',')) for (const drive of drives) {
      const [school, weapon] = c.split(':');
      if (scene === 'riso' && school !== 'italian') continue;
      const r = await sceneRun({ school, weapon, scene, drive });
      writeFileSync(`${dir}/${school}_${weapon}_${scene}_d${drive}.json`, JSON.stringify(r));
      runs.push(r);
      console.error(JSON.stringify({ c, scene, drive, fired: r.fired, second: r.second, taps: r.taps.map((x) => ({ dur: x.dur, travel: x.travel, td: x.td, an: Object.entries(x.an).filter(([, v]) => v).map(([k]) => k) })), reqs: r.reqs.map((e) => `${e.t} ${e.kind} ${e.fwd} ${e.ok ? '' : 'x'} ${e.src} ${e.pend ?? ''}`) }));
    }
    console.log(aggMarkdown(runs));
  } else {
    const out = arg('out', null);
    const runs = [];
    for (const c of arg('cells', 'italian:rapier:longsword').split(',')) for (const drive of drives) for (const seed of range(arg('seeds', '1-8'))) {
      const r = await fightRun({ cell: c, seed, drive });
      runs.push(r);
      if (out) appendFileSync(out, JSON.stringify(r) + '\n');
      console.error(JSON.stringify({ c, drive, seed, taps: r.taps.length, an: r.taps.reduce((o, x) => { for (const [k, v] of Object.entries(x.an)) if (v) o[k] = (o[k] ?? 0) + 1; return o; }, {}) }));
    }
    console.log(aggMarkdown(runs));
  }
}
