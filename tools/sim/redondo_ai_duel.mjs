// ─────────────────────────────────────────────────────────────
//  redondo_ai_duel.mjs — AI 풍차 베기(머리 위 돌려 베기 — UNIQUE_ASSIST.rdAiWind) 가 AI 싸움을 어떻게 바꾸나 (사장님 10/31 08:xx '플레이어만 그런 건가? 누가봐도 레돈두 준비처럼 보여야해.' ·
//   docs/strike/redondo_hold_2026-10-29.md §8-12). 재기만 — 게임 값은 --set 으로.
//  이베리아 AI(츠바이핸더 등 · 숙련도 4 — 머리 위 돌려 베기 단계 3 열림) 대 상대 AI(롱소드 · 숙련도 4) · 씨앗마다 dur 게임 초 · 두 쪽 AI.
//  잼: 이긴 쪽(죽음 · 시간 끝 = 무) · 판 길이 · 이베리아 AI 의 머리 위 돌려 베기 고름 수 · 감기 시작 · 내려침 · 그만둠 까닭 · 내려침이 낸 상처 · 패드 길 머리 위 돌려 베기 수(옛 판)
//  --force=1 = 시킨 한 칼(drill — 가슴 사이 2.6 m 안에서 머리 위 돌려 베기를 한 번 시킴 · 나감 · 그만둠 · 감기 길이 · 맞힘 · 상처 자리)
//  사용법: node tools/sim/redondo_ai_duel.mjs [--n=12] [--dur=45] [--w=zweihander] [--foe=longsword] [--force=1] [--set=UNIQUE_ASSIST.rdAiWind=0] [--json=.tmp/파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
import { TRADITIONS } from '../../src/schools.js';
import { isMain } from './is_main.mjs';

export function duel({ seed = 1, dur = 45, w = 'zweihander', foe = 'longsword' } = {}) {
  const G = newRound({ walls: true, seed, weapon: foe, weapon2: w, AI2Class: AI, persona: { proficiency: 4 }, persona2: { proficiency: 4 } });
  const P = G.player; // 상대 (AI2)
  const E = G.enemy; // 이베리아 AI
  const rec = { seed, winner: null, t: null, picks: 0, rd: null, rdWounds: 0, wounds: { E: 0, P: 0 } };
  const st0 = G.ai.startAttack.bind(G.ai);
  G.ai.startAttack = (tech, why, opt) => { if (tech?.name === 'redondo') rec.picks++; return st0(tech, why, opt); };
  try {
    while (G.t < dur) {
      const n0 = G.wounds.length;
      G.step();
      for (const x of G.wounds.slice(n0)) {
        if (x.att === E) { rec.wounds.E++; if (E.iai?.moves?.[0]?.rd || E.artTech === 'redondo') rec.rdWounds++; }
        if (x.att === P) rec.wounds.P++;
      }
      if (!P.alive || !E.alive) {
        rec.winner = !E.alive && !P.alive ? 'both' : E.alive ? w : foe;
        rec.t = +G.t.toFixed(2);
        break;
      }
    }
  } finally {
    G.world.free();
  }
  rec.rd = G.ai.stats.rdWind ?? null;
  rec.specials = G.ai.stats.specials ?? {};
  return rec;
}

/** 시킨 한 칼 (--force=1): 판 2 초 뒤 이베리아 AI 가 쉬는 때 머리 위 돌려 베기를 빈틈 공격으로 한 번 시킴(그림 도구와 같은 꼴) — 그 공격이 끝나면 AI 는 멈춤 · 상대 AI 는 그대로 막고 침
 *  잼: 나감 · 그만둠 까닭 · 시작 → 내려침(감기) · 시작 → 첫 상처 · 첫 상처 자리 · 그동안 내가 맞음 */
export function drill({ seed = 1, w = 'zweihander', foe = 'longsword', maxT = 6 } = {}) {
  const G = newRound({ walls: true, seed, weapon: foe, weapon2: w, AI2Class: AI, persona: { proficiency: 4 }, persona2: { proficiency: 4 } });
  const P = G.player;
  const E = G.enemy;
  const ai = G.ai;
  const t = TRADITIONS.iberian.unique.find((u) => u.name === 'redondo');
  const rec = { seed, started: false, t0: null, fireT: null, endT: null, hitT: null, zone: null, hitBy: 0, rd: null };
  const up = ai.update.bind(ai);
  let state = 'wait';
  ai.update = (dt) => {
    if (state === 'done') { if (E.rdWind || ai.rd) ai.rdKeep(dt); E.move.set(0, 0); return; } // 멈춘 뒤에도 감기 지킴(공격 꼴 밖 → 그만둠 'mode') · 밧줄 되걸기는 게임과 같게
    up(dt);
    if (state === 'run' && ai.mode !== 'attack') { state = 'done'; rec.endT = +(G.t - rec.t0).toFixed(3); rec.endMode = ai.mode; }
  };
  try {
    while (G.t < 2 + maxT + 4) {
      const a = P.bodies.pelvis.translation();
      const b = E.bodies.pelvis.translation();
      const gap = Math.hypot(a.x - b.x, a.z - b.z);
      if (state === 'wait' && G.t > 2 && gap <= 2.6 && !E.feetHeld && ai.mode !== 'attack' && !E.iai && E.alive && P.alive) { // 가슴 사이 2.6 m 안 (그림 도구와 같은 틈)
        rec.started = ai.startAttack({ ...t, plain: null }, 'open', { noFeint: true });
        if (!rec.started) break;
        rec.t0 = G.t;
        state = 'run';
      }
      const n0 = G.wounds.length;
      G.step();
      if (rec.t0 != null && rec.fireT == null && (ai.phase === 'rdStrike' || ai.phase === 'strike')) rec.fireT = +(G.t - rec.t0).toFixed(3);
      for (const x of G.wounds.slice(n0)) {
        if (rec.t0 == null) continue;
        if (x.att === E && rec.hitT == null && (state === 'run' || G.t - rec.t0 - (rec.endT ?? 0) < 0.3)) { rec.hitT = +(G.t - rec.t0).toFixed(3); rec.zone = x.zone; }
        if (x.att === P && state === 'run') rec.hitBy++;
      }
      if (state === 'done' && G.t - rec.t0 > (rec.endT ?? 0) + 0.3) break;
      if (rec.t0 != null && G.t - rec.t0 > maxT) break;
      if (!P.alive || !E.alive) break;
    }
  } finally {
    G.world.free();
  }
  rec.rd = ai.stats.rdWind ?? null;
  return rec;
}

if (isMain(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, '').split('='); return [k, v.join('=')]; }));
  for (const kv of String(args.set ?? '').split(';').filter(Boolean)) {
    const i = kv.indexOf('=');
    const ks = kv.slice(0, i).split('.');
    let o = CONFIG;
    for (const k of ks.slice(0, -1)) o = o[k];
    o[ks.at(-1)] = JSON.parse(kv.slice(i + 1));
  }
  const n = +(args.n || 12);
  if (+args.force) {
    const runs = [];
    for (let s = 1; s <= n; s++) {
      const r = drill({ seed: s, w: args.w || 'zweihander', foe: args.foe || 'longsword' });
      runs.push(r);
      console.log(JSON.stringify(r));
    }
    const ok = runs.filter((r) => r.started);
    const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : null; };
    const zones = ok.reduce((o, r) => { if (r.zone) o[r.zone] = (o[r.zone] ?? 0) + 1; return o; }, {});
    const sum = { n, started: ok.length, fired: ok.filter((r) => r.fireT != null).length, hit: ok.filter((r) => r.hitT != null).length, hitBy: ok.filter((r) => r.hitBy > 0).length, fireT50: med(ok.map((r) => r.fireT)), hitT50: med(ok.map((r) => r.hitT)), endT50: med(ok.map((r) => r.endT)), zones, cancel: ok.reduce((o, r) => { for (const [k, v] of Object.entries(r.rd?.cancel ?? {})) o[k] = (o[k] ?? 0) + v; return o; }, {}) };
    console.log('SUM', JSON.stringify(sum));
    if (args.json) writeFileSync(args.json, JSON.stringify({ set: args.set ?? '', force: 1, sum, runs }, null, 1));
    process.exit(0);
  }
  const runs = [];
  const from = +(args.from || 1); // 씨앗 시작 (--from=13 → 13 ~ 12 + n)
  for (let s = from; s < from + n; s++) {
    const r = duel({ seed: s, dur: +(args.dur || 45), w: args.w || 'zweihander', foe: args.foe || 'longsword' });
    runs.push(r);
    console.log(JSON.stringify(r));
  }
  const w = args.w || 'zweihander';
  const sum = { n, wins: runs.filter((r) => r.winner === w).length, losses: runs.filter((r) => r.winner && r.winner !== w && r.winner !== 'both').length, draws: runs.filter((r) => !r.winner || r.winner === 'both').length, picks: runs.reduce((a, r) => a + r.picks, 0), begin: runs.reduce((a, r) => a + (r.rd?.begin ?? 0), 0), fire: runs.reduce((a, r) => a + (r.rd?.fire ?? 0), 0), rdWounds: runs.reduce((a, r) => a + r.rdWounds, 0), cancel: runs.reduce((o, r) => { for (const [k, v] of Object.entries(r.rd?.cancel ?? {})) o[k] = (o[k] ?? 0) + v; return o; }, {}), skip: runs.reduce((o, r) => { for (const [k, v] of Object.entries(r.rd?.skip ?? {})) o[k] = (o[k] ?? 0) + v; return o; }, {}), fireWhy: runs.reduce((o, r) => { for (const [k, v] of Object.entries(r.rd?.why ?? {})) o[k] = (o[k] ?? 0) + v; return o; }, {}), tMean: +(runs.filter((r) => r.t).reduce((a, r) => a + r.t, 0) / Math.max(1, runs.filter((r) => r.t).length)).toFixed(1) };
  console.log('SUM', JSON.stringify(sum));
  if (args.json) writeFileSync(args.json, JSON.stringify({ set: args.set ?? '', sum, runs }, null, 1));
}
