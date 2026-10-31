// ─────────────────────────────────────────────────────────────
//  redondo_ai_duel.mjs — AI 풍차 베기(머리 위 돌려 베기 — UNIQUE_ASSIST.rdAiWind) 가 AI 싸움을 어떻게 바꾸나 (사장님 10/31 08:xx '플레이어만 그런 건가? 누가봐도 레돈두 준비처럼 보여야해.' ·
//   docs/strike/redondo_hold_2026-10-29.md §8-12). 재기만 — 게임 값은 --set 으로.
//  이베리아 AI(츠바이핸더 등 · 숙련도 4 — 머리 위 돌려 베기 단계 3 열림) 대 상대 AI(롱소드 · 숙련도 4) · 씨앗마다 dur 게임 초 · 두 쪽 AI.
//  잼: 이긴 쪽(죽음 · 시간 끝 = 무) · 판 길이 · 이베리아 AI 의 머리 위 돌려 베기 고름 수 · 감기 시작 · 내려침 · 그만둠 까닭 · 내려침이 낸 상처 · 패드 길 머리 위 돌려 베기 수(옛 판)
//  사용법: node tools/sim/redondo_ai_duel.mjs [--n=12] [--dur=45] [--w=zweihander] [--foe=longsword] [--set=UNIQUE_ASSIST.rdAiWind=0] [--json=.tmp/파일]
// ─────────────────────────────────────────────────────────────
import { writeFileSync } from 'node:fs';
import { newRound, DT, CONFIG } from './harness_m.mjs';
import { AI } from '../../src/ai.js';
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
  const runs = [];
  for (let s = 1; s <= n; s++) {
    const r = duel({ seed: s, dur: +(args.dur || 45), w: args.w || 'zweihander', foe: args.foe || 'longsword' });
    runs.push(r);
    console.log(JSON.stringify(r));
  }
  const w = args.w || 'zweihander';
  const sum = { n, wins: runs.filter((r) => r.winner === w).length, losses: runs.filter((r) => r.winner && r.winner !== w && r.winner !== 'both').length, draws: runs.filter((r) => !r.winner || r.winner === 'both').length, picks: runs.reduce((a, r) => a + r.picks, 0), begin: runs.reduce((a, r) => a + (r.rd?.begin ?? 0), 0), fire: runs.reduce((a, r) => a + (r.rd?.fire ?? 0), 0), rdWounds: runs.reduce((a, r) => a + r.rdWounds, 0), cancel: runs.reduce((o, r) => { for (const [k, v] of Object.entries(r.rd?.cancel ?? {})) o[k] = (o[k] ?? 0) + v; return o; }, {}), tMean: +(runs.filter((r) => r.t).reduce((a, r) => a + r.t, 0) / Math.max(1, runs.filter((r) => r.t).length)).toFixed(1) };
  console.log('SUM', JSON.stringify(sum));
  if (args.json) writeFileSync(args.json, JSON.stringify({ set: args.set ?? '', sum, runs }, null, 1));
}
