// ─────────────────────────────────────────────────────────────
//  secret_free_measure.mjs — 끝없는 비기 · 유파 대가 재기 (11/16 사장님 '고노센을 … 무한으로 풀어주고' · '0.6으로 하고 기력 소모 50으로.' · '알티바슈는 -35까지 기력 강제 소진으로 해.' ·
//   '둘째로 해' · '맞든 빗나가든 항상 0.6초 무방비. 리솔루토와 죽음의 일격 모두 적용. 리솔루토는 기력 50 죽음의 일격은 기력 35 소모.' — 기록 docs/strike/secret_free_2026-11-16.md)
//  재기만 한다 — 판(--vars)마다 스위치를 이 프로세스 안에서만 바꿈. 둘 다 AI(숙련 5) · 30 s · 벽 · 유파마다 대표 무기 둘(ai_ring_measure.mjs WEAPONS) ·
//  짝마다 무기 넷(2 × 2) × 씨앗(1 ~ 3) = 12 판 · 자리는 (무기 짝 번호 + 씨앗) 홀짝으로 바꿈 · 이김 몫 = 이김 + 비김 ½ (앞 유파 쪽).
//  판마다 앞 유파 쪽: 비기 냄(AI 비기 셈 stats.secrets — acts 는 비기 칼 물건 수라 검술 층 · AI 비기 꼴이 따로인 비기는 둘로 셈) · 맞힘(판정이 난 상처 — 칼날 심각도 > 0 · 둔타 — 를 낸 비기 하나) · 뽑기(수 · 뽑는 동안 맞은 뽑기 · 상처) · 기력 강제(알티바슈 −35) · 뗀 순간 기력 · 칼끝 몫 ·
//   비기 뒤 0.6 s 무방비 동안 받은 상처(독일 · 이탈리아 — secretGuardLog)
//  판: old = 스위치 모두 끔(11/15 판) · new = 기본(사장님 11/16 결정) · f1 = new + 알티바슈 빠르기 'f1' · dmg = new + 알티바슈 옛 위력 판(speed 0) · capN = new + 알티바슈 판정 배율 N (견줌)
//  node tools/sim/secret_free_measure.mjs [--pairs=japanese:german,…] [--vars=old,new] [--seeds=1-3] [--json=..]   · node tools/sim/secret_free_measure.mjs agg a.json …
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI, CONFIG } from './harness_m.mjs';
import { isMain } from './is_main.mjs';
import { WEAPONS } from './ai_ring_measure.mjs';

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };
export const PAIRS = ['japanese:german', 'japanese:iberian', 'iberian:japanese', 'iberian:chinese', 'german:italian', 'german:japanese', 'italian:german', 'italian:chinese'];
/** 사장님 고리 '일본 > 독일 > 이탈리아 > 동방 > 이베리아 > 일본' — 이기는 쪽 55 ~ 85 % · 나머지 35 ~ 65 % (앞 유파 쪽 목표) */
const RING = [['japanese', 'german'], ['german', 'italian'], ['italian', 'chinese'], ['chinese', 'iberian'], ['iberian', 'japanese']];
export function target(a, b) {
  if (RING.some(([x, y]) => x === a && y === b)) return [55, 85];
  if (RING.some(([x, y]) => x === b && y === a)) return [15, 45];
  return [35, 65];
}

const S = CONFIG.SECRET;
/** 판 스위치 (이 프로세스 안에서만) */
export function withVar(v, fn) {
  const keep = { hm: S.altibHitMul, gnsFree: S.gnsFree, gnsCost: S.gnsCost, gnsDraw: S.gnsDraw, free: S.altib.free, drop: S.altib.drop, speed: S.altib.speed, read: CONFIG.AI_PLAN_JP.drawRead, mordFree: S.mord.free, mordCost: S.mord.cost, mordGuard: S.mord.guard, risoFree: S.risolutoFree, risoCost: S.risolutoCost, risoGuard: S.risolutoBack };
  if (v === 'old') {
    S.gnsFree = 0; S.gnsCost = null; S.gnsDraw = 0; S.altib.free = 0; S.altib.drop = null; S.altib.speed = 0; CONFIG.AI_PLAN_JP.drawRead = 0;
    S.mord.free = 0; S.mord.cost = null; S.mord.guard = 0; S.risolutoFree = 0; S.risolutoCost = null; S.risolutoBack = 0;
  } else if (v === 'f1') S.altib.speed = 'f1';
  else if (v === 'dmg') S.altib.speed = 0;
  else if (/^cap[0-9.]+$/.test(v)) S.altibHitMul = +v.slice(3); // 견줌: 둘째 셈 + 알티바슈 판정 배율 (예: cap0.2 — 사장님 판정 전 · 넣지 않음)
  try { return fn(); } finally {
    Object.assign(S, { altibHitMul: keep.hm, gnsFree: keep.gnsFree, gnsCost: keep.gnsCost, gnsDraw: keep.gnsDraw, risolutoFree: keep.risoFree, risolutoCost: keep.risoCost, risolutoBack: keep.risoGuard });
    Object.assign(S.altib, { free: keep.free, drop: keep.drop, speed: keep.speed });
    Object.assign(S.mord, { free: keep.mordFree, cost: keep.mordCost, guard: keep.mordGuard });
    CONFIG.AI_PLAN_JP.drawRead = keep.read;
  }
}

/** 이 몸이 지금 비기 칼을 내는 중인가 — 그 칼 하나(같은 물건)를 돌려줌 */
function secretAct(f) {
  if (f.skill?.sec && !f.skill.sec.special) return f.skill.sec;
  if (f.iai?.secret) return f.iai;
  const r = f.aiCtl?.secretRun;
  if (r && r.stage !== 'stiff') return r;
  return null;
}

/** 한 판: a 유파 무기 wa 대 b 유파 무기 wb · swap 이면 a 가 E 자리 */
export function oneFight({ wa, wb, seed, swap, dur = 30 }) {
  const G = newRound({ seed, walls: true, weapon: swap ? wb : wa, weapon2: swap ? wa : wb, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const A = swap ? G.enemy : G.player;
  const B = swap ? G.player : G.enemy;
  const out = (f) => !f.alive || f.state === 'dead';
  const acts = new Set();
  const landed = new Set();
  let cur = null;
  const prev = G.onWound;
  G.onWound = (att, vic, r) => {
    prev?.(att, vic, r);
    if (att === A && vic === B && cur && (r.type === 'blunt' || (r.severity ?? 0) > 0)) landed.add(cur); // 폼멜 찍기(죽음의 일격)는 둔타 — 판정이 난 닿음이면 맞힘
  };
  while (G.t < dur && !out(A) && !out(B)) {
    G.step();
    cur = secretAct(A);
    if (cur) acts.add(cur);
  }
  const ai = A.aiCtl;
  const sec = Object.values(ai?.stats?.secrets ?? {}).reduce((s, x) => s + (x.fired ?? 0), 0);
  const L = A.drawLog ?? null;
  const al = ai?.stats?.altib ?? null;
  const gl = A.secretGuardLog ?? null;
  const r = {
    win: out(B) && !out(A), lose: out(A) && !out(B), t: +(G.t / CONFIG.TIME.k).toFixed(1),
    fired: sec, acts: acts.size, landed: landed.size,
    draw: L ? { n: L.n, why: L.why, hitN: L.hitN, wounds: L.wounds, sev: +L.sev.toFixed(2), refused: L.refused } : null,
    drawB: B.drawLog ? { n: B.drawLog.n, hitN: B.drawLog.hitN } : null,
    forced: al?.fired ?? 0, altibS: al?.s ?? [], altibShare: al?.share ?? [],
    guard: gl ? { n: gl.n, hitN: gl.hitN, wounds: gl.wounds, sev: +gl.sev.toFixed(2) } : null,
    jp: ai?.stats?.plan?.jp ? { lure: ai.stats.plan.jp.lure, keep: ai.stats.plan.jp.keep, wait: ai.stats.plan.jp.sheatheWait ?? 0, read: ai.stats.plan.jp.drawRead ?? 0 } : null,
    stA: +A.stamina.value.toFixed(0),
  };
  G.world.free();
  return r;
}

const share = (rs) => (100 * rs.reduce((x, r) => x + (r.win ? 1 : r.lose ? 0 : 0.5), 0)) / Math.max(1, rs.length);
const sum = (rs, f) => rs.reduce((s, r) => s + (f(r) ?? 0), 0);
export function table(runs) {
  const vs = [...new Set(runs.map((r) => r.v))];
  const L = [`| 짝 (앞 쪽) | 판 | 판 수 | 이김 몫 (이김 · 짐 · 비김) | 고리 목표 | 비기 / 판 | 맞힘 / 판 | 뽑기 / 판 (맞은 뽑기 · 상처) | 기력 강제 / 판 | 무방비 0.6 s 받은 상처 (맞은 수) |`, '|---|---|---:|---|---|---:|---:|---|---:|---|'];
  for (const p of [...new Set(runs.map((r) => `${r.a}:${r.b}`))]) {
    const [a, b] = p.split(':');
    for (const v of vs) {
      const rs = runs.filter((r) => r.a === a && r.b === b && r.v === v);
      if (!rs.length) continue;
      const n = rs.length;
      const W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
      const T = target(a, b);
      const x = share(rs);
      L.push(`| ${KO[a]} 대 ${KO[b]} | ${v} | ${n} | ${x.toFixed(0)} %${x >= T[0] && x <= T[1] ? ' ✓' : ''} (${W} · ${Ls} · ${n - W - Ls}) | ${T[0]} ~ ${T[1]} % | ${(sum(rs, (r) => r.fired) / n).toFixed(2)} | ${(sum(rs, (r) => r.landed) / n).toFixed(2)} | ${(sum(rs, (r) => r.draw?.n) / n).toFixed(2)} (${sum(rs, (r) => r.draw?.hitN)} · ${sum(rs, (r) => r.draw?.wounds)}) | ${(sum(rs, (r) => r.forced) / n).toFixed(2)} | ${rs.some((r) => r.guard) ? `${sum(rs, (r) => r.guard?.wounds)} (${sum(rs, (r) => r.guard?.hitN)} / ${sum(rs, (r) => r.guard?.n)})` : '–'} |`);
    }
  }
  const sv = runs.flatMap((r) => r.altibS.map((s, i) => ({ v: r.v, s, sh: r.altibShare[i] })));
  if (sv.length) {
    L.push('', '| 판 | 알티바슈 낸 수 | 뗀 순간 기력 (가장 작음 · 가운데 · 가장 큼) | 칼끝 몫 (가운데 · 고르게) |', '|---|---:|---|---|');
    for (const v of vs) {
      const X = sv.filter((x) => x.v === v);
      if (!X.length) continue;
      const s = X.map((x) => x.s).sort((p, q) => p - q);
      const h = X.map((x) => x.sh).sort((p, q) => p - q);
      const med = (A) => A[Math.floor(A.length / 2)];
      L.push(`| ${v} | ${X.length} | ${s[0]} · ${med(s)} · ${s.at(-1)} | ${med(h)} · ${(h.reduce((p, q) => p + q, 0) / h.length).toFixed(3)} |`);
    }
  }
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  if (mode === 'agg') {
    console.log(table(args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  } else {
    const pairs = arg('pairs', PAIRS.join(',')).split(',');
    const vars = arg('vars', 'old,new').split(',');
    const seeds = range(arg('seeds', '1-3'));
    const runs = [];
    for (const p of pairs) {
      const [a, b] = p.split(':');
      let k = 0;
      for (const wa of WEAPONS[a]) for (const wb of WEAPONS[b]) {
        for (const seed of seeds) {
          const swap = (k + seed) % 2 === 1;
          for (const v of vars) {
            const r = withVar(v, () => oneFight({ wa, wb, seed, swap }));
            runs.push({ a, b, v, wa, wb, seed, swap, ...r });
            process.stderr.write(`${a}:${b} ${v} ${wa}/${wb} s${seed} ${r.win ? 'W' : r.lose ? 'L' : 'D'} sec ${r.acts}/${r.landed} draw ${r.draw?.n ?? '-'} forced ${r.forced}\n`);
          }
        }
        k++;
      }
    }
    const json = arg('json', null);
    if (json) writeFileSync(json, JSON.stringify(runs));
    console.log(table(runs));
  }
}
