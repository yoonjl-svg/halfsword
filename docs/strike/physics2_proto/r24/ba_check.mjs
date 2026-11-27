// r24 읽기 지적 뒤 재기 (probe24 나옴 $S/r24/a13/<이름>_<장면>.jsonl 에서):
//  A6 (새 줄 · 지적 1): 디딘 다리 축마다 |근육 토크| ÷ 한도의 p50 · p90 — 바탕(엔진 모터가 실제로 낸 몫 = 사본 풀이 x) 대 나무(건 근육 j.musW).
//      바탕 표본은 둘로: 풀이 잔차 < 0.05 (믿을 것 · 적고 치우침) · 모든 표본. 비 = 나무 ÷ 바탕. 잣대(재기 앞에 정함): 두 표본 모두 축마다 p50 · p90 비 0.5 ~ 2.
//  A3 (가) 다시 (지적 3): 근육 토크 부호 바뀜(앞뒤 두 스텝 모두 |τ| > 0.1 한도) — (1) 모든 스텝 (2) 두 스텝 모두 그 나무의 풀이 잔차 < 0.05 인 스텝만 · 1000 스텝당
//      (3) 잰 값끼리: 관절 빠르기(스텝 뒤) 부호 바뀜(앞뒤 두 스텝 모두 |ω| > 0.5 rad/s) · 1000 스텝당 — 두 나무 같은 양.
//  쓰는 법: node ba_check.mjs <a13 폴더> base <나무 이름>...   (장면: stand · walk · lunge)
import fs from 'fs';
const [dir, base, ...trees] = process.argv.slice(2);
const q = (v, p) => { if (!v.length) return NaN; const s = [...v].sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
const rows = (tag, sc) => { const f = `${dir}/${tag}_${sc}.jsonl`; return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []; };
const AX = ['abd', 'rot', 'flex', 'knee', 'ankInv', 'ankRot', 'ankle'];
// A6
console.log('A6 디딘 다리 |τ|/한도 p50 · p90 — 바탕(잔차<0.05 · 모두) 대 나무');
let fails = {};
for (const sc of ['walk', 'lunge', 'stand30']) {
  const load = (tag, useMus, th) => { const per = {}; for (const r of rows(tag, sc)) r.J.forEach((j, ji) => { if (!j.st) return; const ok = (r.per?.[ji]?.[0] ?? 1) < th; if (!ok) return; for (const [an, v] of Object.entries(j.ax)) { const x = useMus ? v[9] ?? 0 : v[1]; const s = Math.abs(x) / (x >= 0 ? v[11] : v[12]); if (s > 5) continue; (per[an] ||= []).push(s); } }); return per; };
  const B = { rel: load(base, false, 0.05), all: load(base, false, 1e9) };
  for (const t of trees) {
    const T = load(t, true, 1e9);
    if (!Object.keys(T).length) continue;
    const parts = [];
    for (const an of AX) {
      if (!T[an]) continue;
      const t50 = q(T[an], 0.5), t90 = q(T[an], 0.9);
      const cells = ['rel', 'all'].map((k) => { const b = B[k][an] || []; const r50 = t50 / q(b, 0.5), r90 = t90 / q(b, 0.9); const ok = r50 >= 0.5 && r50 <= 2 && r90 >= 0.5 && r90 <= 2; if (!ok) (fails[t] ||= []).push(`${sc} ${an} ${k}`); return `${k} n${b.length} ${q(b, 0.5).toFixed(3)}/${q(b, 0.9).toFixed(3)} 비 ${r50.toFixed(2)}/${r90.toFixed(2)}${ok ? '' : '✗'}`; });
      parts.push(`  ${sc.padEnd(7)} ${an.padEnd(6)} ${t.padEnd(6)} ${t50.toFixed(3)}/${t90.toFixed(3)} | ${cells.join(' | ')}`);
    }
    console.log(parts.join('\n'));
  }
}
for (const t of trees) console.log(`A6 ${t}: 잣대 밖 ${(fails[t] || []).length} 칸 ${(fails[t] || []).length ? '— ' + fails[t].join(', ') : ''}`);
// A3 (가) 다시
console.log('\nA3 (가) 부호 바뀜 (stand · walk · lunge 합)');
for (const tag of [base, ...trees]) {
  let all = 0, steps = 0, rel = 0, relSteps = 0, wf = 0, wSteps = 0;
  for (const sc of ['stand', 'walk', 'lunge']) {
    const ser = new Map();
    for (const r of rows(tag, sc)) r.J.forEach((j, ji) => { const ok = (r.per?.[ji]?.[0] ?? 1) < 0.05; for (const [an, v] of Object.entries(j.ax)) { const k = `${r.wid}:${r.who}:${j.n}:${an}`; if (!ser.has(k)) ser.set(k, []); ser.get(k).push({ s: r.s, t: tag === base ? v[1] : v[9] ?? 0, w: v[10], lp: v[11], ln: v[12], ok }); } });
    for (const v of ser.values()) {
      v.sort((a, b) => a.s - b.s);
      for (let i = 1; i < v.length; i++) {
        if (v[i].s !== v[i - 1].s + 1) continue;
        steps++;
        const big = (t) => Math.abs(t) > 0.1 * (t >= 0 ? v[i].lp : v[i].ln);
        const f = Math.sign(v[i].t) !== Math.sign(v[i - 1].t) && big(v[i].t) && big(v[i - 1].t);
        if (f) all++;
        if (v[i].ok && v[i - 1].ok) { relSteps++; if (f) rel++; }
        if (v[i].w != null && v[i - 1].w != null) { wSteps++; if (Math.sign(v[i].w) !== Math.sign(v[i - 1].w) && Math.abs(v[i].w) > 0.5 && Math.abs(v[i - 1].w) > 0.5) wf++; }
      }
    }
  }
  console.log(`  ${tag.padEnd(6)} 모든 스텝 ${all} / ${steps} (${((1000 * all) / steps).toFixed(2)}‰) · 두 스텝 믿을 것 ${rel} / ${relSteps} (${((1000 * rel) / Math.max(1, relSteps)).toFixed(2)}‰) · 관절 빠르기 부호 바뀜 ${wf} / ${wSteps} (${((1000 * wf) / Math.max(1, wSteps)).toFixed(2)}‰)`);
}
