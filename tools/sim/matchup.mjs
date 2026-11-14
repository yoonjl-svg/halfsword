// ─────────────────────────────────────────────────────────────
//  matchup.mjs — 유파 상성 재기 (11/14 — 사장님 '일본 > 독일 > 이탈리아 > 동방 > 이베리아 > 일본 일수도 있어. 이 부분은 너의 제안과 비교해서
//   뭐가 더 현실에서 유사한 결과가 나오는지 재보자' · '숙련 3으로도 재고 숙련 5로도 재' · 기록 docs/strike/matchup_2026-11-14.md)
//  다섯 유파 AI 끼리(인물 없이 유파 숙련도만 — 대표 무기 하나 · 같은 겉모습) · 짝마다 씨앗 × 자리 바꿔 두 번 · 30 s · 벽.
//  run   : 판마다 한 줄 JSON (stdout) — 이김 쪽 · 판 길이 · 맞힌 칼(기술 이름별 · 칼날 상처만) · 비기 냄 · 맞힘 · 남은 피
//  table : run 의 줄들을 모아 5 × 5 이김 몫 표(비김 = 반 이김 · 95 % 흔들림 = 1.96 × 판 점수 표준편차 ÷ √n) · 두 안의 화살표 · 짝마다 큰 기술
//  node tools/sim/matchup.mjs run [--pairs=japanese-german,...|all] [--profs=3,5] [--seeds=1-6] [--dur=30] [--alt=german,japanese] > raw.jsonl
//  node tools/sim/matchup.mjs table raw1.jsonl raw2.jsonl ...
//  코드(판정 · AI)는 안 바꿈 — 재기만
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';

const SCHOOLS = ['japanese', 'german', 'italian', 'chinese', 'iberian'];
const KO = { japanese: '일본', german: '독일', italian: '이탈리아', chinese: '동방', iberian: '이베리아' };
const WEAPON = { german: 'longsword', japanese: 'uchigatana', italian: 'rapier', chinese: 'hwando', iberian: 'zweihander' }; // 대표 무기
const ALT = { german: 'sabre', japanese: 'monohoshizao', iberian: 'flamberge', chinese: 'qinggang', italian: 'rapier' }; // 둘째 무기 (무기 길이 탓을 가를 때)
// 두 안 (화살표 a → b = a 가 b 에 강함)
const PLANS = {
  감독: [['japanese', 'german'], ['german', 'italian'], ['italian', 'iberian'], ['iberian', 'chinese'], ['chinese', 'japanese']],
  사장님: [['japanese', 'german'], ['german', 'italian'], ['italian', 'chinese'], ['chinese', 'iberian'], ['iberian', 'japanese']],
};

const args = process.argv.slice(2);
const mode = args[0];
const arg = (k, d) => {
  const a = args.find((x) => x.startsWith(`--${k}=`));
  return a ? a.slice(k.length + 3) : d;
};
const range = (s) => {
  const [a, b] = s.split('-').map(Number);
  return Array.from({ length: (b ?? a) - a + 1 }, (_, i) => a + i);
};
const allPairs = () => {
  const out = [];
  for (let i = 0; i < SCHOOLS.length; i++) for (let j = i + 1; j < SCHOOLS.length; j++) out.push([SCHOOLS[i], SCHOOLS[j]]);
  return out;
};

/** 한 판: 자리 0(사람 자리 — AI) = a · 자리 1 = b. 돌려줌: 이김 쪽 'a' | 'b' | 'D' · 맞힌 칼 */
async function fightOne({ a, b, wa, wb, seed, prof, dur }) {
  const { newRound, AI } = await import('./harness_m.mjs');
  const G = newRound({ walls: true, seed, weapon: wa, weapon2: wb, AI2Class: AI, sameLook: true, persona: { proficiency: prof }, persona2: { proficiency: prof } });
  const P = G.player; // a
  const E = G.enemy; // b
  const aiOf = (f) => (f === P ? G.ai2 : G.ai);
  const hit = { a: {}, b: {} };
  const nHit = { a: 0, b: 0 };
  let last = null;
  G.onWound = (att, vic, r) => {
    const sv = r.type === 'blunt' ? 0 : r.severity ?? 0;
    if (!(sv > 0)) return;
    const side = att === P ? 'a' : 'b';
    const A = aiOf(att);
    const name = A?.secretRun ? `비기 ${A.secretRun.S?.name}` : A?.tech?.name ?? A?.mode ?? '?';
    hit[side][name] = (hit[side][name] ?? 0) + 1;
    nHit[side]++;
    last = { side, name };
  };
  const out = (f) => !f.alive || f.state === 'dead';
  while (G.t < dur && !out(P) && !out(E)) G.step();
  const sec = (A) => {
    const s = A?.stats?.secrets ?? {};
    let f = 0;
    let l = 0;
    for (const v of Object.values(s)) (f += v.fired ?? 0), (l += v.landed ?? 0);
    return [f, l];
  };
  const r = {
    prof, a, b, wa, wb, seed, T: +G.t.toFixed(2),
    win: out(E) && !out(P) ? 'a' : out(P) && !out(E) ? 'b' : 'D',
    nHit, hit, last: out(P) || out(E) ? last : null,
    sec: { a: sec(G.ai2), b: sec(G.ai) },
    blood: { a: +P.blood.toFixed(3), b: +E.blood.toFixed(3) },
  };
  G.world.free();
  return r;
}

async function run() {
  const profs = arg('profs', '3,5').split(',').map(Number);
  const seeds = range(arg('seeds', '1-6'));
  const dur = +arg('dur', 30);
  const alt = new Set(arg('alt', '').split(',').filter(Boolean));
  const ps = arg('pairs', 'all');
  const pairs = ps === 'all' ? allPairs() : ps.split(',').map((p) => p.split('-'));
  const W = (s) => (alt.has(s) ? ALT[s] : WEAPON[s]);
  for (const prof of profs) for (const [x, y] of pairs) for (const seed of seeds) for (const swap of [false, true]) {
    const [a, b] = swap ? [y, x] : [x, y];
    const r = await fightOne({ a, b, wa: W(a), wb: W(b), seed, prof, dur });
    console.log(JSON.stringify(r));
  }
}

/** 판 점수 (s 쪽에서): 이김 1 · 비김 ½ · 짐 0 */
const scoreOf = (r, s) => (r.win === 'D' ? 0.5 : (r.win === 'a') === (r.a === s) ? 1 : 0);

function table() {
  const rows = [];
  for (const f of args.slice(1)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim().startsWith('{')) rows.push(JSON.parse(l));
  const profs = [...new Set(rows.map((r) => r.prof))].sort();
  const L = [];
  const pct = (x) => `${Math.round(x * 100)}`;
  for (const prof of profs) {
    const R = rows.filter((r) => r.prof === prof);
    const stat = (s, t, wkey = null) => {
      const xs = R.filter((r) => ((r.a === s && r.b === t) || (r.a === t && r.b === s)) && (!wkey || wkey(r)));
      const sc = xs.map((r) => scoreOf(r, s));
      const n = sc.length;
      const m = sc.reduce((u, v) => u + v, 0) / Math.max(1, n);
      const sd = Math.sqrt(sc.reduce((u, v) => u + (v - m) ** 2, 0) / Math.max(1, n - 1));
      const W = xs.filter((r) => r.win !== 'D' && scoreOf(r, s) === 1).length;
      const D = xs.filter((r) => r.win === 'D').length;
      return { n, m, ci: (1.96 * sd) / Math.sqrt(Math.max(1, n)), W, D, Lo: n - W - D, xs };
    };
    L.push(`### 숙련 ${prof} — 줄 유파의 이김 몫 % (비김 = 반 · ± 95 % 흔들림 · 이김-비김-짐 / 판)`, '');
    L.push(`| 줄 \\ 칸 | ${SCHOOLS.map((s) => KO[s]).join(' | ')} | 평균 |`, `|---|${SCHOOLS.map(() => '---').join('|')}|---|`);
    for (const s of SCHOOLS) {
      const cells = [];
      let tot = 0;
      let k = 0;
      for (const t of SCHOOLS) {
        if (s === t) {
          cells.push('—');
          continue;
        }
        const S = stat(s, t);
        if (!S.n) {
          cells.push('');
          continue;
        }
        tot += S.m;
        k++;
        cells.push(`${pct(S.m)} ± ${pct(S.ci)} (${S.W}-${S.D}-${S.Lo}/${S.n})`);
      }
      L.push(`| ${KO[s]} | ${cells.join(' | ')} | ${k ? pct(tot / k) : ''} |`);
    }
    L.push('');
    for (const [nm, arrows] of Object.entries(PLANS)) {
      if (!arrows.every(([s, t]) => stat(s, t).n)) continue; // 다섯 화살표를 다 잰 판만 (둘째 무기 판 같은 일부 재기는 뺌)
      const hits = arrows.map(([s, t]) => {
        const S = stat(s, t);
        const ok = S.m - S.ci > 0.5 ? '맞음(뚜렷)' : S.m > 0.5 ? '맞음' : S.m === 0.5 ? '반반' : S.m + S.ci < 0.5 ? '거꾸로(뚜렷)' : '거꾸로';
        return `${KO[s]} > ${KO[t]} ${pct(S.m)} % ${ok}`;
      });
      const n = arrows.filter(([s, t]) => stat(s, t).m > 0.5).length;
      L.push(`- ${nm} 안 — 맞는 화살표 ${n} / 5: ${hits.join(' · ')}`);
    }
    L.push('');
    L.push(`#### 숙련 ${prof} — 짝마다 판 길이 · 맞힌 칼 · 비기 · 마지막 칼`, '');
    L.push('| 짝 | 판 길이 s | 맞힘/판 (앞 · 뒤) | 앞 유파 많이 맞힌 기술 | 뒤 유파 많이 맞힌 기술 | 비기 냄 · 맞힘 /판 (앞 · 뒤) | 끝낸 칼 (앞 · 뒤) | 비김 피 우세 (앞 · 뒤 / 비김) |', '|---|---|---|---|---|---|---|---|');
    for (let i = 0; i < SCHOOLS.length; i++) for (let j = i + 1; j < SCHOOLS.length; j++) {
      const s = SCHOOLS[i];
      const t = SCHOOLS[j];
      const S = stat(s, t);
      if (!S.n) continue;
      const side = (r, u) => (r.a === u ? 'a' : 'b');
      const agg = (u) => {
        const m = {};
        let n = 0;
        let sf = 0;
        let sl = 0;
        const fin = {};
        for (const r of S.xs) {
          const k = side(r, u);
          n += r.nHit[k];
          for (const [nm, c] of Object.entries(r.hit[k])) m[nm] = (m[nm] ?? 0) + c;
          sf += r.sec[k][0];
          sl += r.sec[k][1];
          if (r.last && r.last.side === k && r.win === k) fin[r.last.name] = (fin[r.last.name] ?? 0) + 1;
        }
        const top = Object.entries(m).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([nm, c]) => `${nm} ${c}`).join(' · ');
        const ft = Object.entries(fin).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([nm, c]) => `${nm} ${c}`).join(' · ');
        return { n: n / S.n, top, sf: sf / S.n, sl: sl / S.n, ft };
      };
      const A = agg(s);
      const B = agg(t);
      const T = S.xs.reduce((u, r) => u + r.T, 0) / S.n;
      // 비김 판의 기울기 (재기 덧 — 판정엔 안 씀): 남은 피가 0.02 넘게 많은 쪽
      const lean = (u) => S.xs.filter((r) => r.win === 'D' && r.blood[side(r, u)] - r.blood[side(r, u) === 'a' ? 'b' : 'a'] > 0.02).length;
      L.push(`| ${KO[s]} – ${KO[t]} | ${T.toFixed(1)} | ${A.n.toFixed(2)} · ${B.n.toFixed(2)} | ${A.top} | ${B.top} | ${A.sf.toFixed(2)} · ${A.sl.toFixed(2)} / ${B.sf.toFixed(2)} · ${B.sl.toFixed(2)} | ${A.ft || '-'} / ${B.ft || '-'} | ${lean(s)} · ${lean(t)} / ${S.D} |`);
    }
    L.push('');
  }
  console.log(L.join('\n'));
}

if (mode === 'run') await run();
else if (mode === 'table') table();
else console.log('node tools/sim/matchup.mjs run|table ...');
