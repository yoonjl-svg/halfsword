// ─────────────────────────────────────────────────────────────
//  jp_strength.mjs — 일본(우치가타나) 강화 길 재기 (사장님 11/05 '걸음 속도가 특색이니 유지하면서 다른 방법으로 강화할 방법을 찾음 좋겠는데' · 기록 docs/strike/jp_strength_2026-11-05.md)
//   재기만 한다 — 게임 값은 건드리지 않는다(--set 은 이 프로세스 안에서만). 싸움 = school_balance.mjs fightOne 그대로(사람 손가락 봇 · 실제 Input 터치 길 · 숙련 3 AI · 자연 바인드).
//   걷기 빠르기(JAPANESE_GAIT — 사람 · AI 0.70)는 안 건드린다. 꽂개 하나(읽기만 — 난수 · 몸 · 칼 그대로 · 판 결과는 school_balance 와 바이트 같음):
//    큰 상처(칼날 상처 심각도 ≥ 1 — 준 · 받은) · 고노센 준비 셈이 0 으로 돌아간 까닭(휘두름 · 탭 · 손잡이 · 비기 · 막기 단추 · 맞음 · 걸음 뜻 · 판 시작 정지 · 넘어짐 · 비기 다 씀) ·
//    준비 몫 · 준비 수 · 창(사건 꼴) · 봇 기다림 수 · 거리 몫(맞는 거리 안 · 칼끝 거리 안 · 밖)
//  node tools/sim/jp_strength.mjs fight [--cells=japanese:uchigatana:longsword,japanese:uchigatana:uchigatana] [--seeds=1-48] [--set=A.b=1,...] [--par=4] [--tag=이름] [--json=파일]
//  node tools/sim/jp_strength.mjs agg <json ...>   (Markdown 표 — 칸마다 한 줄)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { CONFIG } from './harness_m.mjs';
import { fightOne, cellRow } from './school_balance.mjs';
import { applySets } from './rapier_defence.mjs';
import { gnsHumanMoving, secretSpent } from '../../src/secret.js';
import { isMain, simPath } from './is_main.mjs';

const K = CONFIG.TIME.k; // 실제 초 → 게임 초
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : +x.toFixed(3));
export const BIG = 1; // 큰 상처 = 칼날 상처 심각도 ≥ 1 (jp_de_basics 와 같은 잣대 — 판을 끝낼 만한 상처)

/** 꽂개 — fightOne probe 꼴 (init · step · done). 읽기만 */
export function strengthProbe() {
  let G = null;
  let P = null;
  let A = null;
  let W = null;
  let M = null;
  const big = { dealt: [], recv: [] };
  const why = {}; // 준비 셈이 0 으로 돌아간 까닭 (그 스텝의 W.update 앞에서 본 것)
  const F = { steps: 0, inside: 0, mid: 0, out: 0, armedSteps: 0, arms: 0, wasArmed: false, windows: 0, wasOpen: false, winEv: {}, waits: 0, lastAct: null, armedWaitEnd: 0 };
  return {
    init(o) {
      ({ G, P, A, W } = o);
      M = P.swordArt.measure;
      const ow = G.combat.hooks.onWound;
      G.combat.hooks.onWound = (att, vic, r, ...rest) => {
        ow?.(att, vic, r, ...rest);
        if (r.type === 'blunt' || !(r.severity >= BIG)) return;
        if (att === P && vic === A) big.dealt.push([r3(G.t / K), r.zone, r3(r.severity), P.skill.sec ? 'secret' : P.iai ? 'snap' : 'swing']);
        else if (att === A && vic === P) big.recv.push([r3(G.t / K), r.zone, r3(r.severity)]);
      };
      // 준비 셈 까닭: W.update(G.before 안) 앞에서 그 스텝의 조건을 적고, 뒤에서 셈이 0 으로 돌아갔으면 그 조건을 셈
      const b0 = G.before;
      G.before = (t) => {
        const A0 = W?.iaiArm;
        const t0 = A0?.t ?? 0;
        const armed0 = !!A0?.armed;
        const sk = P.skill;
        const flags = {
          swing: !!sk?.swinging, tap: !!sk?.tap, pom: !!sk?.pom, sec: !!sk?.sec, parry: !!P.parryGuard?.held,
          hurt: P.pain > (W?.prevMyPain ?? P.pain) + 0.05, move: !armed0 && gnsHumanMoving(P), hold: !!P.openHold, down: !P.alive || P.state !== 'stand' || !P.armed || !A.alive, spent: secretSpent(P),
        };
        b0?.(t);
        if (A0 && t0 > 0 && A0.t === 0) {
          const k = Object.keys(flags).filter((x) => flags[x]);
          const key = (F.lastAct?.kind === 'wait' ? 'wait-' : '') + (armed0 ? 'armed:' : 'build:') + (k.length ? k.join('+') : 'other'); // wait- = 봇이 일부러 기다리는 동안
          why[key] = (why[key] ?? 0) + 1;
        }
      };
    },
    step(cur, act) {
      if (!G) return;
      F.steps++;
      const d = P.foeDistance();
      if (d < M.contact) F.inside++;
      else if (d < M.reach) F.mid++;
      else F.out++;
      const ar = !!W?.iaiArm?.armed;
      if (ar) F.armedSteps++;
      if (ar && !F.wasArmed) F.arms++;
      F.wasArmed = ar;
      const op = W?.open;
      if (op && !F.wasOpen) {
        F.windows++;
        const ev = op.ctx?.latched != null ? 'latch' : op.ctx?.ev ?? '-';
        F.winEv[ev] = (F.winEv[ev] ?? 0) + 1;
      }
      F.wasOpen = !!op;
      if (act && act !== F.lastAct && act.kind === 'wait') F.waits++;
      F.lastAct = act;
    },
    done(fires) {
      const per = (x) => r3(x / Math.max(1, F.steps));
      const gns = fires.filter((f) => f.cls === 'secret');
      return {
        big,
        iai: { armedFrac: per(F.armedSteps), arms: F.arms, windows: F.windows, winEv: F.winEv, waits: F.waits, why, fired: gns.length, hit: gns.filter((f) => f.wounds > 0).length, sev: r3(gns.reduce((s, f) => s + f.sev, 0)) },
        dist: { inside: per(F.inside), mid: per(F.mid), out: per(F.out) },
        tech: Object.entries(fires.reduce((o, f) => { const x = (o[f.name] ??= { n: 0, hit: 0, sev: 0, big: 0 }); x.n++; if (f.wounds > 0) x.hit++; x.sev += f.sev; return o; }, {})).reduce((o, [k, v]) => ((o[k] = { ...v, sev: r3(v.sev) }), o), {}),
      };
    },
  };
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const f2 = (x, k = 2) => (x == null ? '–' : x.toFixed(k));
const pct = (x) => (x == null ? '–' : `${Math.round(x * 100)}%`);

/** 칸 묶음 한 줄 (판 결과 + 꽂개) */
export function strengthRow(rs) {
  const c = cellRow(rs);
  const pr = rs.map((r) => r.probe).filter(Boolean);
  const bigD = mean(pr.map((p) => p.big.dealt.length));
  const bigR = mean(pr.map((p) => p.big.recv.length));
  const fired = mean(pr.map((p) => p.iai.fired));
  const hit = pr.reduce((s, p) => s + p.iai.hit, 0);
  const firedN = pr.reduce((s, p) => s + p.iai.fired, 0);
  return { ...c, draw: c.n - c.win - c.lose, bigD, bigR, fired, gnsHit: firedN ? hit / firedN : null, armedFrac: mean(pr.map((p) => p.iai.armedFrac)), arms: mean(pr.map((p) => p.iai.arms)), windows: mean(pr.map((p) => p.iai.windows)), waits: mean(pr.map((p) => p.iai.waits)), inside: mean(pr.map((p) => p.dist.inside)), reachIn: mean(pr.map((p) => p.dist.inside + p.dist.mid)) };
}

export function strengthMarkdown(runs, label = '') {
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = ['| 칸 | 견줌 | 판 | 이김 · 짐 · 비김 | 준 심각도/판 | 받은 심각도/판 | 내 넘어짐/판 | 큰 상처/판 준 · 받은 | 고노센 낸/판 (맞음) | 준비 몫 · 준비/판 · 창/판 · 기다림/판 | 맞는 거리 안 · 칼끝 거리 안 | 판 길이 s |', '|---|---|---:|---|---:|---:|---:|---|---|---|---|---:|'];
  for (const [k, rs] of Object.entries(cells)) {
    const s = strengthRow(rs);
    out.push(`| ${k} | ${label} | ${s.n} | ${s.win} · ${s.lose} · ${s.draw} | ${f2(s.dealt)} | ${f2(s.recv)} | ${f2(s.fallsP)} | ${f2(s.bigD)} · ${f2(s.bigR)} | ${f2(s.fired)} (${pct(s.gnsHit)}) | ${pct(s.armedFrac)} · ${f2(s.arms)} · ${f2(s.windows)} · ${f2(s.waits)} | ${pct(s.inside)} · ${pct(s.reachIn)} | ${f2(s.T, 1)} |`);
  }
  return out.join('\n');
}

/** 준비 셈 까닭 · 창 꼴 · 큰 상처 부위 (칸마다) */
export function detailMarkdown(runs) {
  const cells = {};
  for (const r of runs) (cells[`${r.school}:${r.weapon}:${r.opp}`] ??= []).push(r);
  const out = [];
  for (const [k, rs] of Object.entries(cells)) {
    const why = {};
    const ev = {};
    const zones = {};
    const src = {};
    const tech = {};
    for (const r of rs) {
      const p = r.probe;
      if (!p) continue;
      for (const [w, n] of Object.entries(p.iai.why)) why[w] = (why[w] ?? 0) + n;
      for (const [w, n] of Object.entries(p.iai.winEv)) ev[w] = (ev[w] ?? 0) + n;
      for (const b of p.big.dealt) (zones[b[1]] = (zones[b[1]] ?? 0) + 1), (src[b[3]] = (src[b[3]] ?? 0) + 1);
      for (const [t, v] of Object.entries(p.tech ?? {})) { const x = (tech[t] ??= { n: 0, hit: 0, sev: 0 }); x.n += v.n; x.hit += v.hit; x.sev += v.sev; }
    }
    const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([a, b]) => `${a} ${b}`).join(' · ') || '–';
    out.push(`- ${k}: 준비 셈 0 까닭 ${top(why)} / 창 꼴 ${top(ev)} / 준 큰 상처 부위 ${top(zones)} · 낸 꼴 ${top(src)}`);
    out.push(`  - 기술 (낸 수 · 맞음 · 맞음당 심각도): ${Object.entries(tech).sort((a, b) => b[1].n - a[1].n).map(([t, v]) => `${t} ${v.n} · ${pct(v.hit / v.n)} · ${f2(v.hit ? v.sev / v.hit : null)}`).join(' / ')}`);
  }
  return out.join('\n');
}

const range = (s) => String(s).split(',').flatMap((p) => { const m = p.match(/^(\d+)-(\d+)$/); if (!m) return [+p]; const out = []; for (let i = +m[1]; i <= +m[2]; i++) out.push(i); return out; });

/** 한 프로세스 안에서 칸 × 씨앗 */
export function runCells(cells, seeds, { dur = 30, tech = 0.35, log = null } = {}) {
  const runs = [];
  const t0 = Date.now();
  for (const c of cells) {
    const [school, weapon, opp] = c.split(':');
    for (const seed of seeds) {
      const r = fightOne({ school, weapon, opp, seed, dur, tech, probe: strengthProbe() });
      delete r.reads;
      runs.push(r);
      log?.(JSON.stringify({ c, seed, win: r.win, lose: r.lose, T: r.T, dealt: r.dealt, recv: r.recv, ms: Date.now() - t0 }));
    }
  }
  return runs;
}

if (isMain(import.meta.url)) {
  const [mode, ...rest] = process.argv.slice(2);
  const arg = (k, d) => { const a = rest.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
  if (mode === 'agg') {
    for (const p of rest.filter((x) => !x.startsWith('--'))) {
      const J = JSON.parse(readFileSync(p, 'utf8'));
      console.log(strengthMarkdown(J.runs, J.tag || J.set || '지금'));
      if (arg('detail', '0') !== '0') console.log(detailMarkdown(J.runs));
    }
  } else {
    const cells = arg('cells', 'japanese:uchigatana:longsword,japanese:uchigatana:uchigatana').split(',');
    const seeds = range(arg('seeds', '1-24'));
    const par = Math.max(1, +arg('par', 1));
    const set = arg('set', '');
    let runs;
    if (par > 1 && !arg('child', null)) {
      // 씨앗을 par 몫으로 나눠 이 스크립트를 자식 프로세스로 (같은 --set · 판 하나하나는 한 프로세스 판과 바이트 같음)
      const dir = mkdtempSync(path.join(path.resolve('.tmp'), 'jps-'));
      const chunks = Array.from({ length: par }, (_, i) => seeds.filter((_, j) => j % par === i)).filter((x) => x.length);
      const jobs = chunks.map((ch, i) => new Promise((res, rej) => {
        const out = path.join(dir, `c${i}.json`);
        const p = spawn(process.execPath, [simPath('jp_strength.mjs'), 'fight', `--cells=${cells.join(',')}`, `--seeds=${ch.join(',')}`, `--set=${set}`, `--json=${out}`, '--child=1', `--dur=${arg('dur', 30)}`], { stdio: ['ignore', 'ignore', 'inherit'] });
        p.on('exit', (code) => (code === 0 ? res(JSON.parse(readFileSync(out, 'utf8')).runs) : rej(new Error(`자식 ${i} 끝남 ${code}`))));
      }));
      runs = (await Promise.all(jobs)).flat();
      rmSync(dir, { recursive: true, force: true });
      const order = (r) => cells.indexOf(`${r.school}:${r.weapon}:${r.opp}`) * 1e6 + r.seed;
      runs.sort((a, b) => order(a) - order(b));
    } else {
      applySets(set);
      runs = runCells(cells, seeds, { dur: +arg('dur', 30), log: arg('child', null) ? null : (s) => console.error(s) });
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify({ tag: arg('tag', ''), set, cells, seeds, runs }));
    if (!arg('child', null)) {
      console.log(strengthMarkdown(runs, arg('tag', '') || set || '지금'));
      console.log(detailMarkdown(runs));
    }
  }
}
