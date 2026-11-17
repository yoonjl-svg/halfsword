// ─────────────────────────────────────────────────────────────
//  guard_line_report.mjs — ③ 자세 → 칼길 전 · 후 견줌 표 (11/17 · 읽기 전용 · 기록 docs/design/guard_line_2026-11-17.md §10-5)
//  입력: tell_study 기록(전 판 · 이 판 — 같은 씨앗 · 같은 짜임) · 출력: 유파마다 전 → 후 (손 자세 인정 · H(줄|손 자세) · 줄 · 기술 맞히기 · 약속 · 읽은 줄 덮기 · 유파 맛 · 판 흐름)
//  node tools/sim/guard_line_report.mjs --before=a.json,b.json --after=c.json,d.json
// ─────────────────────────────────────────────────────────────
import { measured, load, KO, SCHOOLS, FLAVOUR } from './guard_line_study.mjs';
import { isMain } from './is_main.mjs';

const pc = (x) => (Number.isFinite(x) ? (100 * x).toFixed(0) + ' %' : '-');
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : '-');
// 설계 §6-3 모형 (τ = 1 · 버릇 고정 · 손 기준 자세) — H(줄) → H(줄|자세) · 줄 맞히기 · 기술 맞히기
export const MODEL = {
  german: { H: [1.48, 1.33], L: [66, 66], T: [58, 58] },
  italian: { H: [0.96, 0.9], L: [73, 76], T: [38, 46] },
  iberian: { H: [2.01, 1.86], L: [40, 48], T: [26, 37] },
  japanese: { H: [1.72, 1.57], L: [57, 58], T: [28, 37] },
  chinese: { H: [0.94, 0.88], L: [84, 84], T: [59, 60] },
};

function flow(runs) {
  const A = runs.flatMap((r) => r.attacks);
  const W = A.filter((a) => a.wound);
  return { runs: runs.length, len: runs.reduce((s, r) => s + r.endT, 0) / runs.length, atk: A.length / runs.length, wound: W.length / runs.length };
}

export function report(before, after) {
  const B = measured(before), A = measured(after);
  const by = (R) => Object.fromEntries(R.map((r) => [r.school, r]));
  const b = by(B), a = by(A);
  const L = [];
  const fb = flow(before), fa = flow(after);
  L.push(`판 ${fb.runs} → ${fa.runs} · 판 길이 평균 ${f2(fb.len)} → ${f2(fa.len)} s · 판당 휘두름 ${f2(fb.atk)} → ${f2(fa.atk)} · 판당 상처 공격 ${f2(fb.wound)} → ${f2(fa.wound)} · 새 공격 ${B.reduce((s, r) => s + r.n, 0)} → ${A.reduce((s, r) => s + r.n, 0)}`);
  L.push('');
  L.push('**① 자세 → 줄 (새 공격 · 손 자세 인정된 것)** — H 는 같은 표(작은 칸 치우침 고침 Miller–Madow) · 맞히기는 반 나눠 시험(홀수 씨앗 표 → 짝수 씨앗) · 모형 = 설계 §6-3 (τ 1 · 버릇 고정 · 손 기준)');
  L.push('');
  L.push('| 유파 | 손 자세 인정 전 → 후 | H(줄) → H(줄\\|손 자세) bit 전 | 후 | 모형 | 줄 맞히기 모름 → 앎 전 | 후 | 모형 | 기술 맞히기 모름 → 앎 전 | 후 | 모형 |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const sc of SCHOOLS) {
    const x = b[sc], y = a[sc], m = MODEL[sc];
    L.push(`| ${KO[sc]} | ${pc(x.rec)} → ${pc(y.rec)} | ${f2(x.H0MM)} → ${f2(x.HcMM)} | ${f2(y.H0MM)} → **${f2(y.HcMM)}** | ${m.H[0]} → ${m.H[1]} | ${pc(x.hl0)} → ${pc(x.hl)} | ${pc(y.hl0)} → **${pc(y.hl)}** | ${m.L[0]} → ${m.L[1]} % | ${pc(x.ht0)} → ${pc(x.ht)} | ${pc(y.ht0)} → **${pc(y.ht)}** | ${m.T[0]} → ${m.T[1]} % |`);
  }
  L.push('');
  L.push('**② 공격하는 쪽 — 약속 · 박자 · 속임** (손 자세가 인정된 새 공격 가운데 그 자세에서 그 기술의 칸 — 묶인 기술끼리 · 묶지 않음 = 고유 기술 넷 밖 · 간수세)');
  L.push('');
  L.push('| 유파 | 기본 P 전 → 후 | 보조 S 전 → 후 | 드묾 U 전 → 후 | 묶지 않음 전 → 후 | 박자 뒤 공격 (후) | 박자 · 건너뜀 · 박자 뒤 낸 공격 (후 · 판 합) | 속임 몫 전 → 후 |');
  L.push('|---|---|---|---|---|---|---|---|');
  for (const sc of SCHOOLS) {
    const x = b[sc], y = a[sc];
    L.push(`| ${KO[sc]} | ${pc(x.adhP)} → **${pc(y.adhP)}** | ${pc(x.adhS)} → ${pc(y.adhS)} | ${pc(x.adhU)} → ${pc(y.adhU)} | ${pc(x.free)} → ${pc(y.free)} | ${pc(y.beat)} | ${y.gl.beat ?? 0} · ${y.gl.beatSkip ?? 0} · ${y.gl.beatFire ?? 0} | ${pc(x.feint)} → ${pc(y.feint)} |`);
  }
  L.push('');
  L.push('**③ 읽는 쪽 — 걸어 드는 상대의 자세 줄을 미리 덮음** (후 · 판 합 · 적중 = 덮은 줄 = 실제 칼 줄(속임은 바꾼 길) · 위협 봄 적중 = 내 눈이 처음 본 위협 줄 = 덮은 줄)');
  L.push('');
  L.push('| 유파(친 쪽) | 휘두름 시작 때 덮고 있던 몫 · 적중 | 결정 ~ 휘두름 사이 덮은 몫 · 적중 | 읽을 자세로 들어옴 · 읽음 · 걸음에 치기 · 덮는 중 위협 봄 · 그 줄 맞음 · 안 옴 (막는 쪽 유파) |');
  L.push('|---|---|---|---|');
  for (const sc of SCHOOLS) {
    const y = a[sc], g = y.gl;
    L.push(`| ${KO[sc]} | ${pc(y.cov)} · **${pc(y.covHit)}** | ${pc(y.covAny)} · ${pc(y.covAnyHit)} | ${g.enter ?? 0} · ${g.go ?? 0} · ${g.debana ?? 0} · ${g.th ?? 0} · ${g.hit ?? 0} · ${g.end ?? 0} |`);
  }
  L.push('');
  L.push('**④ 유파 맛 (새 공격 가운데 그 기술 몫 — 결정 2 \'그대로\')**');
  L.push('');
  L.push('| 유파 | 맛 기술 전 → 후 | 많이 쓴 기술 (전) | 많이 쓴 기술 (후) |');
  L.push('|---|---|---|---|');
  for (const sc of SCHOOLS) {
    const x = b[sc], y = a[sc];
    L.push(`| ${KO[sc]} | ${(FLAVOUR[sc] ?? []).map((t) => `${t} ${pc(x.flav[t])} → **${pc(y.flav[t])}**`).join(' · ')} | ${x.top4} | ${y.top4} |`);
  }
  return L.join('\n');
}

if (isMain(import.meta.url)) {
  const arg = (k) => process.argv.find((x) => x.startsWith(`--${k}=`))?.slice(k.length + 3).split(',') ?? [];
  console.log(report(load(arg('before')), load(arg('after'))));
}
