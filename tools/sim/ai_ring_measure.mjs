// ─────────────────────────────────────────────────────────────
//  ai_ring_measure.mjs — 다섯 유파 AI 맞대결 고리 재기 (11/15 ① 둥근 칼 읽기 + 칼끝 틈 건너기 [사장님 11/15 결정 '둥근 칼 읽기 모든 유파에 넣어'] · 기록 docs/strike/ai_arc_2026-11-15.md)
//  유파마다 대표 무기 둘(독일 롱소드 · 크리크스메서 / 이탈리아 레이피어 · 파펜하이머 / 이베리아 츠바이핸더 · 플랑베르주 / 일본 우치가타나 · 모노호시자오 / 동방 환도 · 청강검) ·
//  짝마다 무기 넷(2 × 2) × 씨앗(1 ~ 3) = 12 판 · 둘 다 숙련 5 · 30 s · 벽 · 자리는 (무기 짝 번호 + 씨앗) 홀짝으로 바꿈 · 이김 몫 = 이김 + 비김 ½.
//  목표 — 사장님 고리 '일본 > 독일 > 이탈리아 > 동방 > 이베리아 > 일본': 이기는 쪽 55 ~ 85 % · 나머지 짝 35 ~ 65 %.
//  판: 본판 하나 (① · 동방 편섬 꺾음은 늘 켬 — 11/17 끈 판 견줌 지움)
//  node tools/sim/ai_ring_measure.mjs [--pairs=japanese:german,…] [--seeds=1-3] [--json=..]   · node tools/sim/ai_ring_measure.mjs agg a.json …
// ─────────────────────────────────────────────────────────────
import { writeFileSync, readFileSync } from 'node:fs';
import { newRound, AI } from './harness_m.mjs';
import { isMain } from './is_main.mjs';

const args = process.argv.slice(2);
const mode = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const arg = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const range = (s) => { const [a, b] = s.split('-').map(Number); return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i); };

export const WEAPONS = { german: ['longsword', 'kriegsmesser'], italian: ['rapier', 'pappenheimer'], iberian: ['zweihander', 'flamberge'], japanese: ['uchigatana', 'monohoshizao'], chinese: ['hwando', 'qinggang'] };
const KO = { german: '독일', italian: '이탈리아', iberian: '이베리아', japanese: '일본', chinese: '동방' };
/** 짝 열 — 고리의 이기는 쪽을 앞에 (목표 55 ~ 85) · 나머지(35 ~ 65) */
export const PAIRS = [
  ['japanese', 'german', 'ring'], ['german', 'italian', 'ring'], ['italian', 'chinese', 'ring'], ['chinese', 'iberian', 'ring'], ['iberian', 'japanese', 'ring'],
  ['japanese', 'italian', 'even'], ['japanese', 'chinese', 'even'], ['german', 'chinese', 'even'], ['german', 'iberian', 'even'], ['italian', 'iberian', 'even'],
];
const VK = { main: '본판' };

/** 한 판: a 유파 무기 wa 대 b 유파 무기 wb · swap 이면 a 가 E 자리 — a 쪽 이김 · 짐 */
export function ringFight({ wa, wb, seed, swap, dur = 30 }) {
  const G = newRound({ seed, walls: true, weapon: swap ? wb : wa, weapon2: swap ? wa : wb, AI2Class: AI, persona: { proficiency: 5 }, persona2: { proficiency: 5 } });
  const A = swap ? G.enemy : G.player;
  const B = swap ? G.player : G.enemy;
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(A) && !out(B)) G.step();
  const r = { win: out(B) && !out(A), lose: out(A) && !out(B), bloodA: A.blood, bloodB: B.blood };
  G.world.free();
  return r;
}

const share = (rs) => (100 * rs.reduce((x, r) => x + (r.win ? 1 : r.lose ? 0 : 0.5), 0)) / Math.max(1, rs.length);
export function ringTable(runs) {
  const vs = [...new Set(runs.map((r) => r.v))];
  const L = [`| 짝 (앞 쪽 이김 몫) | 목표 | ${vs.map((v) => VK[v] ?? v).join(' | ')} |`, `|---|---|${vs.map(() => '---').join('|')}|`];
  let inN = Object.fromEntries(vs.map((v) => [v, 0]));
  let pairs = 0;
  for (const [a, b, kind] of PAIRS) {
    const rs0 = runs.filter((r) => r.a === a && r.b === b);
    if (!rs0.length) continue;
    pairs++;
    const T = kind === 'ring' ? [55, 85] : [35, 65];
    L.push(`| ${KO[a]} 대 ${KO[b]}${kind === 'ring' ? ' (고리)' : ''} | ${T[0]} ~ ${T[1]} % | ${vs.map((v) => {
      const rs = rs0.filter((r) => r.v === v);
      if (!rs.length) return '-';
      const x = share(rs);
      const ok = x >= T[0] && x <= T[1];
      if (ok) inN[v]++;
      const W = rs.filter((r) => r.win).length, Ls = rs.filter((r) => r.lose).length;
      return `${x.toFixed(0)} %${ok ? ' ✓' : ''} (${W} · ${Ls} · ${rs.length - W - Ls})`;
    }).join(' | ')} |`);
  }
  L.push(`| 목표 안 짝 | | ${vs.map((v) => `${inN[v]} / ${pairs}`).join(' | ')} |`);
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  if (mode === 'agg') {
    console.log(ringTable(args.slice(1).filter((a) => !a.startsWith('--')).flatMap((p) => JSON.parse(readFileSync(p, 'utf8')))));
  } else {
    const want = arg('pairs', null);
    const pairs = want ? want.split(',').map((s) => PAIRS.find(([a, b]) => `${a}:${b}` === s)).filter(Boolean) : PAIRS;
    const vars = ['main'];
    const seeds = range(arg('seeds', '1-3'));
    const runs = [];
    for (const [a, b] of pairs) for (const v of vars) {
      let ci = 0;
      for (const wa of WEAPONS[a]) for (const wb of WEAPONS[b]) {
        for (const seed of seeds) {
          const swap = (ci + seed) % 2 === 1;
          const r = ringFight({ wa, wb, seed, swap });
          runs.push({ a, b, wa, wb, seed, swap, v, ...r });
          console.error(a, b, v, wa, wb, seed, r.win ? 'W' : r.lose ? 'L' : 'D');
        }
        ci++;
      }
    }
    const out = arg('json', null);
    if (out) writeFileSync(out, JSON.stringify(runs));
    console.log(ringTable(runs));
  }
}
